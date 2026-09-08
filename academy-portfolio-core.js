/* Selected evidence only. No raw workspace, account identity or inferred credentials. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AcademyPortfolioCore = api;
})(typeof window === 'undefined' ? globalThis : window, () => {
  'use strict';
  const KEY = 'cs-academy-portfolio-v1';
  const SOURCES = [
    'cs-mcat-course-v1',
    'cs-ltl-progress-v1',
    'cs-cogpsych',
    'cs-academy-anatomy-v1',
    'cs-academy-reference-v1',
    'cs-clinical-shift-v1',
    'cs-clinical-longitudinal-v1',
    'cs-neuro',
  ];
  const TRACKS = ['mcat', 'socrates', 'cogpsych', 'anatomy', 'reference', 'practice', 'neuro'];
  const ROLES = ['context', 'original', 'draft', 'revision', 'assistance', 'result'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const text = (value, max = 100000) => typeof value === 'string' && value.length <= max;
  const identifier = value => typeof value === 'string' && /^[\w:./-]{1,250}$/.test(value);
  const date = value =>
    typeof value === 'number' && Number.isFinite(value)
      ? value
      : typeof value === 'string' && Number.isFinite(Date.parse(value))
        ? Date.parse(value)
        : null;
  const pairs = value => (object(value) ? Object.entries(value) : []);
  const list = value => (Array.isArray(value) ? value : []);
  const choice = (options, index) =>
    Number.isInteger(index) && typeof options?.[index] === 'string'
      ? options[index]
      : Number.isInteger(index)
        ? 'Recorded option index ' + index + '; original option wording unavailable.'
        : '';
  function fields(target, label, role, value) {
    if (value == null || value === '') return;
    if (!text(value)) throw Error('A saved response exceeds the portfolio text limit.');
    target.push({ label, role, text: value });
  }
  function item(key, track, id, title, kind, record, content, evidence) {
    return {
      id: key + '/' + id,
      track,
      title: text(title, 1000) && title ? title : kind + ': ' + id,
      kind,
      provenance: {
        recordKey: key,
        recordId: id,
        revision: Number.isInteger(content?.revision)
          ? content.revision
          : Number.isInteger(record.revision)
            ? record.revision
            : null,
        startedAt: date(record.startedAt),
        completedAt: date(record.completedAt),
        contentSnapshot: content
          ? 'Saved wording'
          : 'Only recorded step or answer wording; whole lesson snapshot unavailable',
        contentReview:
          content?.review?.status === 'reviewed' && content.review.reviewer && content.review.reviewedOn
            ? 'Content review recorded in source'
            : 'Independent content review not established by this record',
        learnerReview: 'No independent review of this learner work is recorded',
      },
      evidence,
    };
  }
  function lessonEvidence(record) {
    const result = [],
      content = record.content;
    for (const [id, saved] of pairs(record.steps)) {
      if (!object(saved)) continue;
      const step = saved.content || list(content?.steps).find(s => s.id === id);
      const options = step?.options || step?.choices;
      fields(result, id + ' · prompt', 'context', step?.prompt || step?.q || step?.question);
      fields(result, id + ' · first choice', 'original', choice(options, saved.selected));
      const original = typeof saved.firstDraft === 'string' ? saved.firstDraft : saved.revealedAt ? saved.draft : null;
      fields(result, id + ' · writing before comparison', 'original', original);
      if (typeof saved.draft === 'string' && saved.draft !== original)
        fields(result, id + ' · current writing', 'draft', saved.draft);
      fields(result, id + ' · later comparison', 'revision', saved.comparison);
      if (saved.revealedAt)
        fields(
          result,
          id + ' · support record',
          'assistance',
          'Authored comparison opened' +
            (date(saved.revealedAt) === null
              ? '; time unavailable'
              : ' at ' + new Date(date(saved.revealedAt)).toISOString()) +
            '. This does not describe help received elsewhere.'
        );
    }
    return result;
  }
  function candidates(data) {
    const items = [],
      unavailable = [];
    const add = entry => {
      validateArtifact(entry);
      if (entry.evidence.length || entry.provenance.completedAt !== null) items.push(entry);
    };
    for (const key of SOURCES) {
      if (data[key] == null) continue;
      let saved;
      try {
        saved = JSON.parse(data[key]);
        if (!object(saved)) throw Error('Unsupported record shape');
      } catch {
        unavailable.push(key + ': saved record could not be interpreted; original copy retained.');
        continue;
      }
      const attempt = (id, fn) => {
        try {
          fn();
        } catch {
          unavailable.push(key + '/' + id + ': a portfolio summary could not be prepared; original copy retained.');
        }
      };
      if (key === 'cs-mcat-course-v1')
        for (const [id, r] of pairs(saved.units))
          attempt(id, () => {
            const evidence = [];
            for (const a of list(r.attempts)) {
              const q = a.questionSnapshot,
                label = (a.kind === 'delayed' ? 'Delayed application' : 'First application') + ' · ' + a.qId;
              fields(evidence, label + ' · prompt', 'context', q?.stem || 'Original question wording was not saved.');
              fields(evidence, label + ' · original answer', 'original', choice(q?.options, a.chosen));
              fields(
                evidence,
                label + ' · outcome',
                'result',
                (a.correct === true ? 'Correct' : a.correct === false ? 'Incorrect' : 'Unrecorded') +
                  ' at ' +
                  (date(a.ts) === null ? 'unrecorded time' : new Date(date(a.ts)).toISOString()) +
                  '; confidence: ' +
                  (text(a.confidence, 100) ? a.confidence : 'unrecorded') +
                  '.'
              );
              const help = r.help?.[a.qId];
              if (help)
                fields(
                  evidence,
                  label + ' · later support',
                  'assistance',
                  'A separate supported check was opened after this answer. ' +
                    choice(help.questionSnapshot?.options, help.chosen)
                );
              const guide = help?.guide;
              if (guide && Array.isArray(guide.reveals)) {
                fields(evidence, label + ' · note before hints', 'original', guide.firstNote?.text);
                fields(evidence, label + ' · unfinished hint note', 'draft', guide.firstNote ? '' : guide.draft);
                for (const stage of list(guide.content?.stages).slice(0, guide.reveals.length))
                  fields(
                    evidence,
                    label + ' · authored hint opened',
                    'assistance',
                    text(stage?.title) && text(stage?.text)
                      ? stage.title + ': ' + stage.text
                      : 'Original hint wording unavailable.'
                  );
                fields(evidence, label + ' · reflection after hints', 'revision', guide.reflection);
              }
            }
            fields(evidence, 'Current lesson note', 'draft', r.notes);
            add(item(key, 'mcat', id, null, 'MCAT lesson record', r, null, evidence));
          });
      else if (key === 'cs-ltl-progress-v1')
        for (const [track, progress] of pairs(saved))
          for (const [id, r] of pairs(progress?.lessons))
            attempt(id, () =>
              add(item(key, 'socrates', track + '/' + id, null, 'Learn to Learn lesson', r, null, lessonEvidence(r)))
            );
      else if (['cs-cogpsych', 'cs-academy-anatomy-v1', 'cs-academy-reference-v1'].includes(key)) {
        const track = key === 'cs-cogpsych' ? 'cogpsych' : key.includes('anatomy') ? 'anatomy' : 'reference';
        for (const [id, r] of pairs(saved.lessons))
          attempt(id, () =>
            add(item(key, track, id, r.content?.title, 'Lesson record', r, r.content, lessonEvidence(r)))
          );
      } else if (key === 'cs-clinical-longitudinal-v1') {
        const runs = [...list(saved.history), ...(saved.active ? [saved.active] : [])];
        for (const run of runs)
          attempt(run?.runId, () => {
            const evidence = [],
              c = run.caseData;
            for (const r of list(run.records)) {
              const node = list(c?.nodes).find(n => n.id === r.nodeId);
              fields(evidence, r.nodeId + ' · presented evidence', 'context', node?.observation);
              fields(
                evidence,
                r.nodeId + ' · next step',
                'original',
                node?.options?.find(o => o.id === r.choice)?.text || r.choice
              );
              for (const field of ['hypothesis', 'alternative', 'evidence'])
                fields(evidence, r.nodeId + ' · ' + field, 'original', r.reason?.[field]);
            }
            for (const field of ['situation', 'assessment', 'uncertainty', 'next', 'changed'])
              fields(evidence, 'First handoff · ' + field, 'original', run.handoff?.[field]);
            if (!run.handoff)
              for (const field of ['situation', 'assessment', 'uncertainty', 'next', 'changed'])
                fields(evidence, 'Handoff draft · ' + field, 'draft', run.handoffDraft?.[field]);
            for (const [nodeId, draft] of pairs(run.drafts))
              if (!list(run.records).some(r => r.nodeId === nodeId)) {
                for (const field of ['hypothesis', 'alternative', 'evidence'])
                  fields(evidence, nodeId + ' · current draft · ' + field, 'draft', draft?.[field]);
              }
            fields(evidence, 'After the authored comparison', 'revision', run.comparison);
            if (run.handoff)
              fields(
                evidence,
                'Support record',
                'assistance',
                'Authored handoff comparison was opened. Written quality was not automatically graded.'
              );
            add(item(key, 'practice', run.runId, c?.title, 'Fictional patient timeline', run, c, evidence));
          });
      } else if (key === 'cs-clinical-shift-v1') {
        const runs = [...list(saved.history).map(h => h.encounter), saved.active].filter(Boolean);
        for (const run of runs)
          attempt(run.runId, () => {
            const evidence = [],
              c = run.content?.caseData;
            fields(
              evidence,
              'Differential rationale',
              run.differential?.lockedAt ? 'original' : 'draft',
              run.differential?.rationale
            );
            for (const field of ['assessment', 'plan'])
              fields(
                evidence,
                'Clinical note · ' + field,
                run.note?.revealedAt ? 'original' : 'draft',
                run.note?.[field]
              );
            if (run.note?.revealedAt)
              fields(
                evidence,
                'Support record',
                'assistance',
                'The authored clinical note was opened after the recorded writing.'
              );
            add(
              item(
                key,
                'practice',
                run.runId,
                c?.title,
                'Fictional Clinical Shift reflection',
                run,
                run.content,
                evidence
              )
            );
          });
      } else if (key === 'cs-neuro') {
        for (const [id, r] of pairs(saved.units))
          attempt(id, () => {
            const evidence = [];
            list(r.recall).forEach((a, i) => {
              fields(evidence, 'Recall ' + (i + 1), a.revealedAt ? 'original' : 'draft', a.draft);
              if (a.revealedAt)
                fields(evidence, 'Recall ' + (i + 1) + ' support', 'assistance', 'Authored comparison opened.');
            });
            for (const q of list(r.content?.checks))
              fields(evidence, q.prompt || q.id, 'original', choice(q.choices, r.answers?.[q.id]?.chosen));
            fields(evidence, 'Debrief', 'revision', r.debrief);
            add(
              item(
                key,
                'neuro',
                'unit/' + id,
                r.content?.step?.title,
                'Engineering foundation unit',
                r,
                r.content,
                evidence
              )
            );
          });
        for (const [id, group] of pairs(saved.projects))
          for (const r of [...list(group?.history), ...(group?.current ? [group.current] : [])])
            attempt(id, () => {
              const evidence = [],
                p = r.content;
              fields(evidence, 'Project objective', 'context', p?.objective);
              fields(evidence, 'Input provenance', 'context', p?.provenance);
              fields(evidence, 'Example input SHA-256', 'context', p?.inputSha256);
              if (Array.isArray(p?.checks?.cases?.[0]?.args))
                fields(
                  evidence,
                  'Exact first example arguments',
                  'context',
                  JSON.stringify(p.checks.cases[0].args, null, 2)
                );
              fields(evidence, 'First prediction', 'original', r.firstPrediction?.text);
              if (!r.firstPrediction) fields(evidence, 'Prediction draft', 'draft', r.prediction);
              for (const [i, a] of list(r.attempts).entries()) {
                fields(evidence, 'Check ' + (i + 1) + ' · exact code', i ? 'revision' : 'original', a.draft);
                fields(
                  evidence,
                  'Check ' + (i + 1) + ' · outcome',
                  'result',
                  a.status === 'done'
                    ? a.result?.passed === true
                      ? 'All listed function cases passed. Written quality was not graded.'
                      : 'The listed function checks did not all pass.'
                    : 'Interrupted or unfinished check; no pass.'
                );
                for (const [j, c] of list(a.result?.cases).entries()) {
                  fields(
                    evidence,
                    'Check ' + (i + 1) + ', input ' + (j + 1) + ' · saved actual output',
                    'result',
                    c.actual
                  );
                  fields(
                    evidence,
                    'Check ' + (i + 1) + ', input ' + (j + 1) + ' · saved expected output',
                    'context',
                    c.expected
                  );
                }
                fields(
                  evidence,
                  'Check ' + (i + 1) + ' · support record',
                  'assistance',
                  a.assisted === true
                    ? 'In-app reference was opened before this check.'
                    : 'No in-app reference opening was recorded before this check. Other assistance is unknown.'
                );
              }
              if (r.draft !== list(r.attempts).at(-1)?.draft) fields(evidence, 'Current code draft', 'draft', r.draft);
              for (const field of ['result', 'limitation', 'next'])
                fields(evidence, 'Project memo · ' + field, r.completedAt ? 'revision' : 'draft', r.memo?.[field]);
              add(
                item(
                  key,
                  'neuro',
                  'project/' + id + '/' + r.runId,
                  p?.title,
                  'Synthetic engineering project',
                  r,
                  p,
                  evidence
                )
              );
            });
      }
    }
    const unique = [...new Map(items.map(entry => [entry.id, entry])).values()];
    unique.sort(
      (a, b) =>
        (b.provenance.completedAt || b.provenance.startedAt || 0) -
        (a.provenance.completedAt || a.provenance.startedAt || 0)
    );
    return { items: unique, unavailable };
  }
  function validateArtifact(a) {
    if (
      !object(a) ||
      !identifier(a.id) ||
      !TRACKS.includes(a.track) ||
      !text(a.title, 1000) ||
      !text(a.kind, 100) ||
      !object(a.provenance) ||
      !SOURCES.includes(a.provenance.recordKey) ||
      !identifier(a.provenance.recordId) ||
      !Array.isArray(a.evidence) ||
      a.evidence.length > 1000 ||
      a.evidence.some(e => !object(e) || !text(e.label, 2000) || !ROLES.includes(e.role) || !text(e.text))
    )
      throw Error('A portfolio entry is invalid.');
    const p = a.provenance;
    if (
      !['contentSnapshot', 'contentReview', 'learnerReview'].every(key => text(p[key], 1000)) ||
      !['startedAt', 'completedAt'].every(key => p[key] === null || Number.isFinite(p[key])) ||
      !(p.revision === null || (Number.isInteger(p.revision) && p.revision > 0))
    )
      throw Error('The provenance is incomplete.');
    if (JSON.stringify(a).length > 2000000)
      throw Error('This entry is too large for the portfolio; use its course export.');
    return true;
  }
  const empty = () => ({ version: 1, entries: [] });
  function validate(state) {
    if (
      !object(state) ||
      state.version !== 1 ||
      !Array.isArray(state.entries) ||
      new Set(state.entries.map(e => e.id)).size !== state.entries.length
    )
      throw Error('The saved portfolio could not open.');
    for (const e of state.entries) {
      validateArtifact(e.source);
      if (
        e.id !== e.source.id ||
        !Number.isFinite(e.addedAt) ||
        (e.hiddenAt !== null && !Number.isFinite(e.hiddenAt)) ||
        !text(e.draft, 6000) ||
        !Array.isArray(e.revisions) ||
        e.revisions.some(
          r =>
            !text(r.text, 6000) ||
            !r.text.trim() ||
            !Number.isFinite(r.recordedAt) ||
            !['used', 'none-recorded', 'unknown'].includes(r.help)
        )
      )
        throw Error('A saved portfolio revision is invalid.');
    }
    return true;
  }
  function add(state, source, now = Date.now()) {
    validate(state);
    validateArtifact(source);
    if (state.entries.some(e => e.id === source.id)) return false;
    state.entries.push({
      id: source.id,
      source: clone(source),
      addedAt: now,
      hiddenAt: null,
      draft: '',
      revisions: [],
    });
    return true;
  }
  function revise(entry, help, now = Date.now()) {
    if (!text(entry.draft, 6000) || !entry.draft.trim() || !['used', 'none-recorded', 'unknown'].includes(help))
      return false;
    entry.revisions.push({ text: entry.draft, help, recordedAt: now });
    entry.draft = '';
    return true;
  }
  function exportFile(state, selected, now = Date.now()) {
    validate(state);
    if (
      !Array.isArray(selected) ||
      !selected.length ||
      new Set(selected).size !== selected.length ||
      selected.some(id => !state.entries.some(e => e.id === id && e.hiddenAt === null))
    )
      throw Error('Choose visible portfolio entries to export.');
    const entries = selected.map(id => {
      const e = state.entries.find(e => e.id === id);
      // Rebuild every field. Unknown imported keys and unfinished portfolio drafts are excluded.
      const p = e.source.provenance;
      return {
        capturedAt: e.addedAt,
        track: e.source.track,
        title: e.source.title,
        kind: e.source.kind,
        provenance: {
          recordKey: p.recordKey,
          recordId: p.recordId,
          revision: p.revision ?? null,
          startedAt: p.startedAt ?? null,
          completedAt: p.completedAt ?? null,
          contentSnapshot: p.contentSnapshot,
          contentReview: p.contentReview,
          learnerReview: p.learnerReview,
        },
        evidence: e.source.evidence.map(x => ({ label: x.label, role: x.role, text: x.text })),
        portfolioRevisions: e.revisions.map(r => ({ text: r.text, help: r.help, recordedAt: r.recordedAt })),
      };
    });
    return JSON.stringify(
      {
        format: 'cortex-selected-portfolio',
        version: 1,
        createdAt: now,
        scope:
          'Selected personal learning records. Participation and recorded checks are not accreditation, a clinical credential or proof of independent competence. Assistance outside recorded events is unknown. This file is not a study-backup import.',
        entries,
      },
      null,
      2
    );
  }
  return { KEY, SOURCES, TRACKS, ROLES, clone, candidates, validateArtifact, empty, validate, add, revise, exportFile };
});
