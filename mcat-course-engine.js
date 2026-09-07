/* Pure learning-record rules. Completion, first exposure, and delayed recall stay distinct. */
(function (root) {
  const DAY = 86400000;
  function normalize(raw) {
    const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    s.version = 1;
    for (const key of ['units','placement','examReviews']) if (!s[key] || typeof s[key] !== 'object' || Array.isArray(s[key])) s[key] = {};
    s.placement.answers ||= {}; s.placement.background ||= {};
    if (!['learn','mixed','exam'].includes(s.mode)) s.mode = 'learn';
    return s;
  }
  function record(state,id) {
    if (!state.units[id] || typeof state.units[id] !== 'object' || Array.isArray(state.units[id])) state.units[id] = {};
    const r = state.units[id];
    if (!Array.isArray(r.attempts)) r.attempts = [];
    r.lab ||= {}; r.notes ||= ''; r.stage ||= 'learn';
    return r;
  }
  // Store the wording actually shown. Legacy records use the pre-revision copy in content.
  function snapshot(question) {
    return {id:question.id,kind:question.kind,stem:question.stem,options:[...question.options],answer:question.answer,explanation:question.explanation};
  }
  function questionForRecord(question,record) {
    if (!question || !record) return question;
    return record.questionSnapshot || question.previousVersion || question;
  }
  function answer(state,unit,question,chosen,confidence,now) {
    const r = record(state,unit.id);
    if (!Number.isInteger(chosen) || chosen < 0 || chosen >= question.options.length) return null;
    // Questions are scored once. Reopening feedback never creates fresh evidence.
    const existing = r.attempts.find(a => a.qId === question.id);
    if (existing) return existing;
    refreshSchedule(state,unit);
    if (question.kind === 'delayed' && (!r.completedAt || !r.dueAt || now < r.dueAt || nextDelayed(state,unit)?.id !== question.id)) return null;
    const a = {qId:question.id,kind:question.kind,chosen,confidence,correct:chosen === question.answer,ts:now,questionSnapshot:snapshot(question)};
    r.attempts.push(a);
    if (question.kind === 'delayed') { r.delayedAt = now; r.scheduleVersion = 0; refreshSchedule(state,unit); }
    return a;
  }
  function nextDelayed(state,unit) {
    const r = record(state,unit.id);
    return unit.questions.find(q => q.kind === 'delayed' && !r.attempts.some(a => a.qId === q.id)) || null;
  }
  function refreshSchedule(state,unit) {
    const r = record(state,unit.id);
    if (!r.completedAt) return;
    const later = r.attempts.filter(a => unit.questions.some(q => q.kind === 'delayed' && q.id === a.qId)).sort((a,b)=>a.ts-b.ts);
    if (!nextDelayed(state,unit)) { r.dueAt=null; r.scheduleVersion=2; return; }
    if (r.scheduleVersion === 2 && r.dueAt) return;
    const last = later.at(-1);
    r.dueAt = last ? last.ts + DAY * (last.correct ? (later.length === 1 ? 3 : 7) : 1) : (r.dueAt || r.completedAt + DAY);
    r.scheduleVersion=2;
  }
  function complete(state,unit,now) {
    const r = record(state,unit.id), checks = unit.questions.filter(q => q.kind === 'check');
    if (!r.learnedAt || !r.exploredAt || !checks.every(q => r.attempts.some(a => a.qId === q.id))) return false;
    if (!r.completedAt) { r.completedAt = now; r.dueAt = now + DAY; }
    refreshSchedule(state,unit);
    r.stage = 'record';
    if (state.activeUnit === unit.id) state.activeUnit = null;
    return true;
  }
  function recommendation(data,state,logs,now) {
    data.units.forEach(u=>refreshSchedule(state,u));
    const unit = id => data.units.find(u => u.id === id);
    const active = unit(state.activeUnit);
    if (active && !record(state,active.id).completedAt) return {unit:active,kind:'resume',reason:'Your lesson is saved. Continue from the same step.'};
    const due = data.units.find(u => record(state,u.id).dueAt && state.units[u.id].dueAt <= now);
    if (due) return {unit:due,kind:'delayed',reason:'A new application question is ready after at least 24 hours.'};
    const preferred = unit(state.preferredUnit);
    if (preferred && !record(state,preferred.id).completedAt) return {unit:preferred,kind:'lesson',reason:'You chose this unit as your next focus.'};
    const revisit = data.units.find(u => {
      const r = record(state,u.id); if (!r.completedAt) return false;
      const cutoff = Math.max(r.completedAt,r.reviewedAt || 0);
      const latest = new Map(); (logs || []).filter(a => u.questionIds.includes(a.qId)).forEach(a => { if (!latest.has(a.qId) || latest.get(a.qId).ts <= a.ts) latest.set(a.qId,a); });
      return [...latest.values()].some(a => !a.correct && a.ts > cutoff) || r.attempts.some(a => a.kind === 'delayed' && !a.correct && a.ts > cutoff);
    });
    if (revisit) return {unit:revisit,kind:'review',reason:'A more recent application was missed. Revisit the explanation, then try related practice.'};
    const candidates = data.units.filter(u => !record(state,u.id).completedAt);
    const scored = candidates.map((u,i) => {
      const p = state.placement.answers[u.id];
      const mapped = (logs || []).filter(x => u.questionIds.includes(x.qId));
      const latest = new Map(); mapped.forEach(x => { const old = latest.get(x.qId); if (!old || old.ts <= x.ts) latest.set(x.qId,x); });
      const misses = [...latest.values()].filter(x => !x.correct).length;
      const needs = u.prerequisites.some(id => !record(state,id).completedAt);
      const score = (p && p.chosen !== null && !p.correct ? (p.confidence === 'sure' ? 8 : 6) : 0) + Math.min(5,misses) + (state.placement.background[u.section] === 'new' ? 1 : 0) - (needs ? 2 : 0);
      return {unit:u,score,i,misses,p};
    }).sort((a,b) => b.score-a.score || a.i-b.i);
    const top = scored[0];
    if (!top) return null;
    return {unit:top.unit,kind:'lesson',reason:top.misses ? 'Recent related practice includes a miss. This lesson revisits the underlying idea.' : top.p && top.p.chosen !== null && !top.p.correct ? 'Your starting check suggests this topic is worth revisiting.' : 'A foundation unit to build on. You can choose any available unit.'};
  }
  function metrics(data,state) {
    const attempts = data.units.flatMap(u => record(state,u.id).attempts);
    const first = attempts.filter(a => a.kind === 'check');
    const delayed = attempts.filter(a => a.kind === 'delayed');
    const ratio = xs => ({correct:xs.filter(a => a.correct).length,total:xs.length});
    return {completed:data.units.filter(u => record(state,u.id).completedAt).length,available:data.units.length,first:ratio(first),delayed:ratio(delayed),categories:new Set(data.units.flatMap(u => u.categories)).size};
  }
  const api = {DAY,normalize,record,answer,complete,recommendation,metrics,nextDelayed,refreshSchedule,snapshot,questionForRecord};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.McatCourseCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
