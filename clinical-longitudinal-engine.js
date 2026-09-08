/* Deterministic teaching paths. Written reasoning is retained, never graded. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClinicalLongitudinalCore = api;
})(typeof window === 'undefined' ? globalThis : window, () => {
  'use strict';
  const REASON = ['hypothesis', 'alternative', 'evidence'];
  const HANDOFF = ['situation', 'assessment', 'uncertainty', 'next', 'changed'];
  const copy = value => JSON.parse(JSON.stringify(value));
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 6000;
  const id = value => typeof value === 'string' && /^[a-z0-9-]{1,100}$/.test(value);
  function validateCase(item) {
    if (
      !object(item) ||
      !id(item.id) ||
      !Number.isInteger(item.revision) ||
      item.revision < 1 ||
      !['title', 'objective', 'prerequisites', 'scope'].every(key => text(item[key])) ||
      !Array.isArray(item.sources) ||
      !item.sources.length ||
      item.sources.some(s => !text(s.title) || !/^https:\/\/[^\s<>"']+$/.test(s.url)) ||
      !object(item.review) ||
      !['pending', 'reviewed'].includes(item.review.status) ||
      (item.review.status === 'reviewed' && (!text(item.review.reviewer) || !text(item.review.reviewedOn))) ||
      !Array.isArray(item.nodes) ||
      item.nodes.length < 3 ||
      item.nodes.length > 30
    )
      throw Error('The case description is incomplete.');
    const nodes = new Map(item.nodes.map(n => [n.id, n]));
    if (nodes.size !== item.nodes.length || !nodes.has(item.start))
      throw Error('The case has an invalid starting point.');
    for (const node of item.nodes) {
      if (
        !id(node.id) ||
        !['decision', 'handoff'].includes(node.kind) ||
        !['title', 'time', 'observation'].every(key => text(node[key])) ||
        !Array.isArray(node.reviewQuestions) ||
        !node.reviewQuestions.length ||
        !node.reviewQuestions.every(text)
      )
        throw Error('A case checkpoint is incomplete.');
      if (node.kind === 'handoff') {
        if (!object(node.model) || !HANDOFF.every(key => text(node.model[key])) || node.options)
          throw Error('The handoff comparison is incomplete.');
      } else if (
        !text(node.prompt) ||
        !text(node.model) ||
        !Array.isArray(node.options) ||
        !node.options.length ||
        new Set(node.options.map(o => o.id)).size !== node.options.length ||
        node.options.some(o => !id(o.id) || !text(o.text) || !text(o.feedback) || !nodes.has(o.next))
      )
        throw Error('A teaching branch is incomplete.');
    }
    const reached = new Set();
    function visit(key, ancestors) {
      if (ancestors.has(key)) throw Error('A teaching branch loops without a handoff.');
      if (reached.has(key)) return;
      reached.add(key);
      for (const option of nodes.get(key).options || []) visit(option.next, new Set([...ancestors, key]));
    }
    visit(item.start, new Set());
    if (reached.size !== nodes.size) throw Error('The case contains an unreachable checkpoint.');
    return true;
  }
  function paths(item) {
    validateCase(item);
    const all = [];
    function visit(key, path) {
      const node = item.nodes.find(n => n.id === key);
      if (node.kind === 'handoff') {
        if (all.length >= 1000) throw Error('The case has too many paths to review as one encounter.');
        all.push([...path, { node: key }]);
        return;
      }
      for (const option of node.options) visit(option.next, [...path, { node: key, choice: option.id }]);
    }
    visit(item.start, []);
    return all;
  }
  function create(item, runId, now = Date.now()) {
    validateCase(item);
    if (!id(runId) || !Number.isFinite(now)) throw Error('The encounter could not start.');
    return {
      version: 1,
      runId,
      caseData: copy(item),
      startedAt: now,
      nodeId: item.start,
      phase: 'reason',
      records: [],
      drafts: {},
      handoff: null,
      handoffDraft: {},
      comparison: '',
      completedAt: null,
    };
  }
  const nodeFor = run => run.caseData.nodes.find(n => n.id === run.nodeId);
  const filled = (value, fields) => object(value) && fields.every(key => text(value[key]));
  function validateRun(run) {
    if (!object(run) || run.version !== 1 || !id(run.runId) || !Number.isFinite(run.startedAt))
      throw Error('The saved encounter is incomplete.');
    validateCase(run.caseData);
    if (
      !['reason', 'feedback', 'handoff', 'compare', 'complete'].includes(run.phase) ||
      !Array.isArray(run.records) ||
      !object(run.drafts) ||
      !object(run.handoffDraft) ||
      typeof run.comparison !== 'string' ||
      run.comparison.length > 6000
    )
      throw Error('The saved reasoning could not open.');
    /* Timestamps must be finite but need not be monotonic: a device clock stepped backwards between checkpoints must not lock the run. */
    let current = run.caseData.start;
    for (const record of run.records) {
      const node = run.caseData.nodes.find(n => n.id === current);
      const option = node?.options?.find(o => o.id === record.choice);
      if (!option || record.nodeId !== current || !filled(record.reason, REASON) || !Number.isFinite(record.lockedAt))
        throw Error('The saved branch sequence is invalid.');
      current = option.next;
    }
    if (run.phase === 'feedback') {
      if (!run.records.length || run.nodeId !== run.records.at(-1).nodeId)
        throw Error('The saved comparison is invalid.');
    } else if (run.nodeId !== current) throw Error('The saved checkpoint does not match the reasoning history.');
    const node = nodeFor(run);
    if (
      !node ||
      (['handoff', 'compare', 'complete'].includes(run.phase) ? node.kind !== 'handoff' : node.kind !== 'decision')
    )
      throw Error('The saved encounter has an invalid stage.');
    if (['compare', 'complete'].includes(run.phase) ? !filled(run.handoff, HANDOFF) : run.handoff !== null)
      throw Error('The saved first handoff is invalid.');
    if (
      run.phase === 'complete' ? !text(run.comparison) || !Number.isFinite(run.completedAt) : run.completedAt !== null
    )
      throw Error('The saved completion is invalid.');
    for (const [key, draft] of Object.entries(run.drafts)) {
      const node = run.caseData.nodes.find(n => n.id === key);
      if (
        !node ||
        node.kind !== 'decision' ||
        !object(draft) ||
        Object.entries(draft).some(([field, value]) =>
          field === 'choice'
            ? !node.options.some(o => o.id === value)
            : !REASON.includes(field) || typeof value !== 'string' || value.length > 6000
        )
      )
        throw Error('The saved draft is invalid.');
    }
    if (
      Object.entries(run.handoffDraft).some(
        ([key, value]) => !HANDOFF.includes(key) || typeof value !== 'string' || value.length > 6000
      )
    )
      throw Error('The handoff draft is invalid.');
    return true;
  }
  function lock(run, now = Date.now()) {
    validateRun(run);
    if (run.phase !== 'reason') throw Error('This decision has already been recorded.');
    const node = nodeFor(run),
      draft = run.drafts[node.id];
    if (!filled(draft, REASON) || !node.options.some(o => o.id === draft.choice))
      throw Error('Add your working explanation, an alternative, the evidence, and a next step.');
    const next = copy(run);
    next.records.push({
      nodeId: node.id,
      choice: draft.choice,
      reason: Object.fromEntries(REASON.map(key => [key, draft[key]])),
      lockedAt: now,
    });
    next.phase = 'feedback';
    return next;
  }
  function advance(run) {
    validateRun(run);
    if (run.phase !== 'feedback') throw Error('Record your reasoning before opening the next checkpoint.');
    const next = copy(run),
      node = nodeFor(run);
    next.nodeId = node.options.find(o => o.id === run.records.at(-1).choice).next;
    next.phase = nodeFor(next).kind === 'handoff' ? 'handoff' : 'reason';
    return next;
  }
  function revealHandoff(run) {
    validateRun(run);
    if (run.phase !== 'handoff' || !filled(run.handoffDraft, HANDOFF))
      throw Error('Complete each handoff field before opening the comparison.');
    const next = copy(run);
    next.handoff = copy(run.handoffDraft);
    next.phase = 'compare';
    return next;
  }
  function complete(run, now = Date.now()) {
    validateRun(run);
    if (run.phase !== 'compare' || !text(run.comparison)) throw Error('Record one comparison or question to revisit.');
    const next = copy(run);
    next.phase = 'complete';
    next.completedAt = now;
    return next;
  }
  return {
    REASON,
    HANDOFF,
    copy,
    validateCase,
    validateRun,
    paths,
    create,
    nodeFor,
    lock,
    advance,
    revealHandoff,
    complete,
  };
});
