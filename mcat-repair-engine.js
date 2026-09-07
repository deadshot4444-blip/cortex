/* Small, deterministic evidence model. Shared by the browser and Node tests. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  function empty() { return { version: 1, records: {}, active: null }; }
  function normalize(value, concepts) {
    if (!value || value.version !== 1 || !value.records || Array.isArray(value.records) || typeof value.records !== 'object') return empty();
    const state = empty();
    for (const concept of concepts) {
      const r = value.records[concept.id];
      if (!r || typeof r !== 'object') continue;
      const ids = new Set([concept.diagnostic.id, ...concept.checks.map(q => q.id)]);
      const attempts = Array.isArray(r.attempts) ? r.attempts.filter(a => a && ids.has(a.questionId) && typeof a.correct === 'boolean' && Number.isFinite(a.at) && ['diagnose', 'transfer', 'later', 'practice'].includes(a.mode)).map(a => ({ ...a, firstExposure: a.firstExposure === true })) : [];
      state.records[concept.id] = { attempts, reviewedAt: Number.isFinite(r.reviewedAt) ? r.reviewedAt : 0, dueAt: Number.isFinite(r.dueAt) ? r.dueAt : 0 };
    }
    const a = value.active;
    const c = concepts.find(c => c.id === a?.conceptId);
    if (c && ['repair','later','practice'].includes(a.kind) && ['diagnose','lesson','question','feedback','done'].includes(a.phase)
      && [c.diagnostic.id, ...c.checks.map(q => q.id)].includes(a.questionId) && Number.isFinite(a.startedAt)) {
      state.active = { ...a };
      if (a.phase === 'feedback' && (!a.result || typeof a.result.correct !== 'boolean')) state.active = null;
    }
    return state;
  }
  function recordFor(state, id) { return state.records[id] ||= { attempts: [], reviewedAt: 0, dueAt: 0 }; }
  function unseenChecks(concept, state) {
    const seen = new Set((state.records[concept.id]?.attempts || []).map(a => a.questionId));
    return concept.checks.filter(q => !seen.has(q.id));
  }
  function status(concept, state) {
    const checks = (state.records[concept.id]?.attempts || []).filter(a => a.mode !== 'diagnose');
    if (!checks.length) return 'Not checked';
    if (!checks[checks.length - 1].correct) return 'Needs practice';
    const latestEvidence = checks.filter(a => a.firstExposure).at(-1);
    if (latestEvidence && !latestEvidence.correct) return 'Needs practice';
    if (latestEvidence?.mode === 'later' && latestEvidence.correct) return 'Passed a later check';
    if (latestEvidence?.correct) return 'Passed a new question';
    return 'Practice completed';
  }
  function gaps(concepts, state, logs) {
    return concepts.map(concept => {
      const latest = new Map();
      for (const a of logs || []) if (concept.questionIds.includes(a.qId) && Number.isFinite(a.ts) && a.ts > (state.records[concept.id]?.reviewedAt || 0)) {
        const old = latest.get(a.qId); if (!old || a.ts >= old.ts) latest.set(a.qId, a);
      }
      const misses = [...latest.values()].filter(a => a.correct === false);
      return { concept, misses: misses.length, sure: misses.filter(a => a.conf === 'sure').length };
    }).filter(g => g.misses).sort((a,b) => b.sure-a.sure || b.misses-a.misses);
  }
  function recommend(concepts, state, logs, now) {
    if (state.active) return { concept: concepts.find(c => c.id === state.active.conceptId), kind: state.active.kind, reason: 'Your place is saved. Continue where you left off.', resume: true };
    const due = concepts.filter(c => state.records[c.id]?.dueAt && state.records[c.id].dueAt <= now && unseenChecks(c,state).length)
      .sort((a,b) => state.records[a.id].dueAt-state.records[b.id].dueAt)[0];
    if (due) return { concept: due, kind: 'later', reason: 'A fresh application is due. Try it before reopening the lesson.' };
    const gap = gaps(concepts,state,logs)[0];
    if (gap) return { concept: gap.concept, kind: 'repair', reason: `${gap.misses} recent missed ${gap.misses === 1 ? 'question' : 'questions'}${gap.sure ? `, including ${gap.sure} marked Sure` : ''}. Check the idea behind the answer.` };
    const fresh = concepts.find(c => !(state.records[c.id]?.attempts || []).some(a => a.mode !== 'diagnose'));
    return fresh ? { concept: fresh, kind: 'repair', reason: 'Try one concept: a quick question, a short lesson, and a new application.' } : null;
  }
  function begin(concept, state, kind, now) {
    const remaining = unseenChecks(concept, state);
    const due = state.records[concept.id]?.dueAt || 0;
    // An early visit cannot consume a scheduled unseen check or earn delayed evidence.
    if (kind === 'later' && (!due || now < due || !remaining.length)) return false;
    state.active = { conceptId: concept.id, kind, phase: kind === 'later' ? 'question' : kind === 'practice' ? 'lesson' : 'diagnose', questionId: kind === 'later' ? remaining[0].id : concept.diagnostic.id, startedAt: now, confidence: 'unsure', result: null };
    return true;
  }
  function answer(concept, state, choice, confidence, now) {
    const a = state.active;
    if (!a || a.conceptId !== concept.id || !['diagnose','question'].includes(a.phase)) return null;
    const q = [concept.diagnostic, ...concept.checks].find(q => q.id === a.questionId);
    if (!q || !Number.isInteger(choice) || choice < 0 || choice >= q.options.length) return null;
    const r = recordFor(state, concept.id);
    const firstExposure = !r.attempts.some(x => x.questionId === q.id);
    let mode = a.phase === 'diagnose' ? 'diagnose' : a.kind === 'later' && r.dueAt && now >= r.dueAt ? 'later' : a.kind === 'practice' ? 'practice' : 'transfer';
    if (!firstExposure && mode !== 'diagnose') mode = 'practice';
    const result = { questionId: q.id, choice, correct: choice === q.answer, confidence: ['guess','unsure','sure'].includes(confidence) ? confidence : 'unsure', at: now, firstExposure, mode };
    r.attempts.push(result);
    if (mode !== 'diagnose') {
      r.reviewedAt = now;
      // Replaying a known question never postpones or replaces a scheduled check.
      if (mode !== 'practice') r.dueAt = unseenChecks(concept,state).length ? now + (mode === 'later' && result.correct ? 3 : 1) * DAY : 0;
    }
    a.result = result; a.phase = 'feedback'; a.confidence = result.confidence;
    return result;
  }
  function afterLesson(concept,state) {
    const a = state.active;
    if (!a || a.phase !== 'lesson') return;
    if (a.kind === 'later') { a.phase = 'done'; return; }
    // Practice mode uses a previously seen item; scheduled unseen items stay reserved.
    const seen = new Set((state.records[concept.id]?.attempts || []).map(x => x.questionId));
    const q = a.kind === 'practice' ? concept.checks.find(q => seen.has(q.id)) || concept.diagnostic : unseenChecks(concept,state)[0] || concept.checks[0];
    a.questionId=q.id; a.phase='question'; a.result=null; a.confidence='unsure';
  }
  function stats(concepts,state) {
    const checks = concepts.flatMap(c => state.records[c.id]?.attempts || []);
    const later = checks.filter(a => a.mode === 'later' && a.firstExposure);
    return { practiced: concepts.filter(c => (state.records[c.id]?.attempts || []).some(a => a.mode !== 'diagnose')).length,
      laterPassed: concepts.filter(c => status(c,state) === 'Passed a later check').length,
      laterCorrect: later.filter(a => a.correct).length, laterTotal: later.length };
  }
  const api = { empty, normalize, unseenChecks, status, gaps, recommend, begin, answer, afterLesson, stats };
  root.McatRepairCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
