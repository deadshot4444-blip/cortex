/* Descriptive item records from one active workspace, never a learner-population estimate. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.McatItemQualityCore = api;
})(typeof window === 'undefined' ? globalThis : window, () => {
  'use strict';
  const KEY = 'cs-mcat-item-reports-v1';
  const SOURCES = ['cs-mcat-course-v1', 'cs-mcat-v2', 'cs-mcat-log'];
  const object = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const list = x => Array.isArray(x) ? x : [];
  const pairs = x => object(x) ? Object.entries(x) : [];
  const id = x => typeof x === 'string' && /^[\w:.-]{1,180}$/.test(x);
  const text = (x, max = 100000) => typeof x === 'string' && x.length <= max;
  const clone = x => JSON.parse(JSON.stringify(x));
  const finite = x => typeof x === 'number' && Number.isFinite(x);
  function table(value) {
    if (!object(value) || !Array.isArray(value.headers) || !value.headers.every(x => text(x,2000)) || !Array.isArray(value.rows) ||
      !value.rows.every(row => Array.isArray(row) && row.length === value.headers.length && row.every(x => text(x,10000) || finite(x)))) return null;
    return { caption: text(value.caption,2000) ? value.caption : '', headers: [...value.headers], rows: value.rows.map(row => [...row]) };
  }
  function graph(value) {
    if (!object(value) || !text(value.xLabel,2000) || !text(value.yLabel,2000) || !Array.isArray(value.points) ||
      !value.points.every(point => Array.isArray(point) && point.length === 2 && point.every(finite))) return null;
    return { xLabel: value.xLabel, yLabel: value.yLabel, points: value.points.map(point => [...point]) };
  }
  function question(q) {
    if (!object(q) || !text(q.stem) || !q.stem || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 12 ||
      !q.options.every(x => text(x, 20000)) || !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length || !text(q.explanation || '')) return null;
    return { stem: q.stem, options: [...q.options], answer: q.answer, explanation: q.explanation || '' };
  }
  function context(p) {
    if (!object(p) || !text(p.text)) return null;
    const result = { title: text(p.title, 1000) ? p.title : '', text: p.text };
    // Tables and figures can change the question even when its stem does not.
    if (p.table != null) { result.table = table(p.table); if (!result.table) return null; }
    return result;
  }
  function savedContext(value) {
    if (!object(value)) return null;
    if (typeof value.text === 'string') return context(value);
    if (Object.hasOwn(value,'numericTarget')) return { numericTarget: finite(value.numericTarget) ? value.numericTarget : null, table: table(value.table), graph: graph(value.graph) };
    return null;
  }
  function collect(data) {
    const events = [], issues = [], counts = { sourceRows: 0, malformedRows: 0, unfinishedWorkExcluded: 0, legacyLogAtLimit: false };
    const add = value => { counts.sourceRows++; if (!id(value.itemId) || typeof value.correct !== 'boolean') { counts.malformedRows++; return; } events.push(value); };
    for (const key of SOURCES) {
      if (data[key] == null) continue;
      let saved; try { saved = JSON.parse(data[key]); if (key === 'cs-mcat-log' ? !Array.isArray(saved) : !object(saved)) throw Error('shape'); }
      catch { issues.push(key + ': malformed or unsupported source; excluded without changing the original.'); continue; }
      if (key === 'cs-mcat-course-v1') for (const [unitId, r] of pairs(saved.units)) {
        for (const a of list(r?.attempts)) add({ eventId: id(unitId) && id(a?.qId) ? 'course:' + unitId + ':' + a.qId : null,
          family: 'course', itemId: a?.qId, condition: a?.kind === 'delayed' ? 'delayed application' : 'lesson application', exposure: 'first-recorded-in-this-lesson', support: 'unknown',
          timestamp: a?.ts, chosen: a?.chosen, correct: a?.correct, question: question(a?.questionSnapshot), context: null,
          laterSupportRecorded: !!r?.help?.[a?.qId], measurement: 'mcq' });
      } else if (key === 'cs-mcat-v2') {
        if (saved.coach?.active) counts.unfinishedWorkExcluded++;
        counts.unfinishedWorkExcluded += list(saved.coach?.parked).length;
        for (const r of list(saved.coach?.history)) {
          if (!finite(r?.completedAt)) { counts.unfinishedWorkExcluded++; continue; }
          for (const a of list(r.answers)) add({ eventId: id(r.id) && id(a?.qId) ? 'coach:' + r.id + ':' + a.qId : null,
            family: 'coach', itemId: a?.qId, condition: 'completed passage workshop', exposure: a?.repeat === true ? 'repeat-recorded' : a?.repeat === false ? 'no-prior-record-or-self-report' : 'unknown',
            support: a?.assisted === true ? 'recorded-help' : a?.assisted === false ? 'no-in-app-help-recorded' : 'unknown', timestamp: a?.ts, chosen: a?.chosen, correct: a?.correct,
            question: context(r.content?.passage) ? question(list(r.content?.passage?.questions).find(q => q.id === a?.qId)) : null, context: context(r.content?.passage), laterSupportRecorded: false, measurement: 'mcq' });
        }
        for (const r of list(saved.math?.history)) {
          if (!finite(r?.completedAt)) { counts.unfinishedWorkExcluded++; continue; }
          const q = r.question, prompt = q ? { stem: q.stem, options: q.setups, answer: q.answer, explanation: q.explanation } : null;
          const first = saved.math?.exposures?.[r.qId], before = finite(r.startedAt) ? r.startedAt : r.completedAt;
          const prior = first && first.runId !== r.id && first.ts <= before || list(saved.math?.history).some(other => other?.qId === r.qId && other.id !== r.id && (other.startedAt || other.completedAt) < before) ||
            [...list(saved.diagnostics?.history), saved.diagnostics?.active].filter(Boolean).some(run => list(run.answers).some(a => a?.qId === 'probe-' + r.qId && a.ts <= before));
          add({ eventId: id(r.id) ? 'math:' + r.id : null, family: 'math', itemId: r.qId, condition: r.transfer ? 'new-context math task' : 'foundation math task',
            exposure: r.repeat === true || prior ? 'repeat-recorded' : r.repeat === false ? 'no-prior-record-or-self-report' : 'unknown',
            support: r.assisted === true || r.externalAssistance === true || r.hint === true ? 'recorded-help' : r.assisted === false && r.hint === false ? 'setup-feedback-only' : 'unknown',
            timestamp: r.completedAt, chosen: r.setup, correct: r.correct, question: q && (q.table != null && !table(q.table) || q.graph != null && !graph(q.graph)) ? null : question(prompt), context: q ? { numericTarget: finite(q.value) ? q.value : null, table: table(q.table), graph: graph(q.graph) } : null,
            laterSupportRecorded: false, measurement: 'combined-math', numericValue: finite(r.value) ? r.value : null,
            setupCorrect: typeof r.setupCorrect === 'boolean' ? r.setupCorrect : null, calculationCorrect: typeof r.calculationCorrect === 'boolean' ? r.calculationCorrect : null });
        }
      } else {
        counts.legacyLogAtLimit = saved.length >= 1000;
        for (const a of saved) add({ eventId: id(a?.attemptId) && id(a?.qId) ? 'log:' + a.attemptId + ':' + a.qId : null,
          family: 'practice-log', itemId: a?.qId, condition: a?.sim ? 'timed practice log' : 'ordinary practice log', exposure: 'unknown', support: 'unknown', timestamp: a?.ts,
          chosen: a?.chosen, correct: a?.correct, unanswered: a?.unanswered === true, question: question(a?.questionSnapshot), context: context(a?.passageSnapshot), laterSupportRecorded: false, measurement: 'mcq' });
      }
    }
    return { events, issues, counts };
  }
  async function digest(value, cryptoAPI = globalThis.crypto) {
    if (!cryptoAPI?.subtle) throw Error('Exact item-version checks require HTTPS or localhost.');
    return [...new Uint8Array(await cryptoAPI.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))].map(x => x.toString(16).padStart(2,'0')).join('');
  }
  async function analyze(data, now = Date.now(), cryptoAPI = globalThis.crypto) {
    const source = collect(data), quality = { ...source.counts, duplicateRows: 0, conflictingEventIds: 0, unknownEventIds: 0, missingSnapshot: 0,
      missingChoice: 0, knownUnanswered: 0, invalidChoice: 0, missingTimestamp: 0, futureTimestamp: 0, inconsistentOutcome: 0, unknownExposure: 0, unknownSupport: 0, scannedRows: 0, retainedRows: 0 };
    const byId = new Map(), unique = [], conflicts = new Set();
    for (const event of source.events) {
      if (!event.eventId) { quality.unknownEventIds++; unique.push(event); continue; }
      const before = byId.get(event.eventId);
      if (before) { if (JSON.stringify(before) === JSON.stringify(event)) quality.duplicateRows++; else conflicts.add(event.eventId); }
      else { byId.set(event.eventId, event); unique.push(event); }
    }
    quality.conflictingEventIds = conflicts.size;
    const groups = new Map();
    for (const event of unique.filter(e => !conflicts.has(e.eventId))) {
      quality.scannedRows++;
      if (!event.question) quality.missingSnapshot++;
      if (event.unanswered) quality.knownUnanswered++;
      const choiceMissing = event.chosen == null, choiceInvalid = !choiceMissing && (!Number.isInteger(event.chosen) || event.chosen < 0 || event.question && event.chosen >= event.question.options.length);
      if (choiceMissing) quality.missingChoice++; if (choiceInvalid) quality.invalidChoice++;
      if (event.exposure === 'unknown') quality.unknownExposure++;
      if (event.support === 'unknown') quality.unknownSupport++;
      if (!finite(event.timestamp) || event.timestamp <= 0) quality.missingTimestamp++; else if (event.timestamp > now) { quality.futureTimestamp++; continue; }
      if (event.unanswered && event.correct || event.measurement === 'mcq' && event.question && !choiceMissing && !choiceInvalid && event.correct !== (event.chosen === event.question.answer)) { quality.inconsistentOutcome++; continue; }
      if (choiceInvalid) continue;
      const version = event.question ? await digest({ question: event.question, context: event.context }, cryptoAPI) : 'unrecorded';
      const key = [event.family, event.itemId, version, event.condition, event.exposure, event.support].join('|');
      if (!groups.has(key)) groups.set(key, { key, family: event.family, itemId: event.itemId, version, condition: event.condition, exposure: event.exposure, support: event.support,
        measurement: event.measurement, question: event.question, context: event.context, n: 0, correct: 0, missingChoice: 0, knownUnanswered: 0, missingTimestamp: 0, laterSupportRecorded: 0,
        firstAt: null, lastAt: null, choices: event.question ? event.question.options.map((text,index)=>({index,text,n:0})) : [], setup: { n:0,correct:0 }, calculation: { n:0,correct:0 } });
      const group = groups.get(key); group.n++; group.correct += Number(event.correct); group.laterSupportRecorded += Number(event.laterSupportRecorded); group.knownUnanswered += Number(!!event.unanswered);
      if (choiceMissing) group.missingChoice++; else if (group.choices[event.chosen]) group.choices[event.chosen].n++;
      if (finite(event.timestamp) && event.timestamp > 0) { group.firstAt = group.firstAt === null ? event.timestamp : Math.min(group.firstAt,event.timestamp); group.lastAt = group.lastAt === null ? event.timestamp : Math.max(group.lastAt,event.timestamp); } else group.missingTimestamp++;
      for (const field of ['setup','calculation']) if (typeof event[field+'Correct'] === 'boolean') { group[field].n++; group[field].correct += Number(event[field+'Correct']); }
      quality.retainedRows++;
    }
    return { format: 'cortex-local-item-summary', version: 1, generatedAt: now,
      scope: 'One active workspace. Counts are retained response records, including recorded omissions, not a verified number of learners. Descriptive review only; no calibrated item difficulty, population reliability, learning-effect estimate or score prediction.',
      verifiedLearners: null, consentedResearchSample: null, quality, issues: source.issues,
      limits: ['Practice log retains at most 1,000 rows. Its earliest row does not establish first exposure.', 'Unknown wording, exposure and support stay explicit; they are not combined with documented conditions.',
        'One learner may contribute several correlated answers. Unique learner count and representative sampling are unavailable.', 'Only completed passage workshops are included; unfinished and parked work cannot reveal withheld answers here.',
        'Course help opened after an answer stays separate from the unknown support conditions of that original answer.', 'Delayed and new-context tasks are different questions. Their rates do not estimate a causal gain in retention or transfer.',
        'No automatic item retirement follows a low local success rate or a reported concern. Qualified review and appropriate real-learner evidence remain pending.'],
      groups: [...groups.values()].sort((a,b)=>a.itemId.localeCompare(b.itemId)||a.key.localeCompare(b.key)) };
  }
  function report(group, note, reportId, now = Date.now()) {
    if (!group?.question || !/^[a-f0-9]{64}$/.test(group.version) || !id(reportId) || !text(note,6000) || !note.trim()) throw Error('Select a recorded item version and describe the concern.');
    return { id: reportId, createdAt: now, status: 'unreviewed learner concern', item: { family: group.family, itemId: group.itemId, version: group.version, question: clone(group.question), context: clone(group.context),
      condition: group.condition, exposure: group.exposure, support: group.support }, note, resolution: null };
  }
  return { KEY, SOURCES, question, savedContext, collect, digest, analyze, report };
});
