/* Public curriculum lookup and separate, optional written retrieval records. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AcademyCurriculum = api;
})(typeof window === 'undefined' ? globalThis : window, () => {
  'use strict';
  const paths = { mcat: '/mcat', socrates: '/learn', cogpsych: '/cogpsych', practice: '/practice', anatomy: '/anatomy', reference: '/medicine', neuro: '/neuro', academy: '/academy' };
  const levels = ['foundation', 'applied', 'advanced'];
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9][\w:.-]{0,160}$/.test(value);
  const text = value => typeof value === 'string' && value.length > 0 && value.length <= 6000;
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const clone = value => JSON.parse(JSON.stringify(value));
  const queryKeys = new Set('gates offline view unit step stage lesson track chapter demo run case project code sim tool mode focus record category q gaps section context level scope objective card queue page'.split(' '));
  function safeReturn(value) {
    if (typeof value !== 'string' || value.length > 3000 || !value.startsWith('/') || value.startsWith('//') || /[\\<>"'`\u0000-\u0020]/.test(value)) return null;
    try {
      const url = new URL(value, 'https://cortex.invalid');
      if (url.origin !== 'https://cortex.invalid' || !Object.values(paths).includes(url.pathname) || value.split(/[?#]/)[0] !== url.pathname) return null;
      url.searchParams.delete('returnTo');
      if ([...url.searchParams.keys()].some(key => !queryKeys.has(key)) || [...url.searchParams.values()].some(v => v.length > 600 || /[<>"'`\u0000-\u001f]/.test(v))) return null;
      if (url.hash && !/^#(?:case-)?[\w.-]{1,180}$/.test(url.hash)) return null;
      return url.pathname + url.search + url.hash;
    } catch { return null; }
  }
  function validEntry(entry) {
    return object(entry) && id(entry.id) && paths[entry.track] && entry.track !== 'academy'
      && text(entry.title) && text(entry.summary) && text(entry.kind) && levels.includes(entry.level)
      && ['revised', 'draft'].includes(entry.status) && text(entry.reviewStatus)
      && Number.isInteger(entry.revision) && entry.revision > 0 && safeReturn(entry.url) === entry.url
      && new URL(entry.url, 'https://cortex.invalid').pathname === paths[entry.track]
      && Array.isArray(entry.objectives) && entry.objectives.every(id)
      && Array.isArray(entry.prerequisites) && entry.prerequisites.every(id);
  }
  function validCard(card) {
    return object(card) && id(card.id) && text(card.title) && text(card.prompt) && text(card.model) && text(card.compare)
      && Number.isInteger(card.revision) && card.revision > 0 && levels.includes(card.level)
      && text(card.reviewStatus) && Array.isArray(card.links) && card.links.length >= 2 && card.links.every(validEntry)
      && Array.isArray(card.sources) && card.sources.length > 0 && card.sources.every(source => text(source.title) && typeof source.url === 'string' && /^https:\/\/[^\s<>"'`]+$/.test(source.url));
  }
  function validate(data) {
    if (!object(data) || data.format !== 1 || !Array.isArray(data.entries) || !data.entries.every(validEntry)
      || new Set(data.entries.map(e => e.id)).size !== data.entries.length || !Array.isArray(data.objectives)
      || !data.objectives.every(o => object(o) && id(o.id) && text(o.title) && text(o.description))
      || new Set(data.objectives.map(o => o.id)).size !== data.objectives.length) throw Error('The curriculum index is incomplete.');
    const entries = new Map(data.entries.map(e => [e.id, e])), objectives = new Set(data.objectives.map(o => o.id));
    for (const entry of data.entries) if (entry.prerequisites.some(p => !entries.has(p)) || entry.objectives.some(o => !objectives.has(o))) throw Error('A curriculum reference is missing.');
    const visited = new Set(), visiting = new Set();
    function walk(key) {
      if (visiting.has(key)) throw Error('Curriculum prerequisites form a loop.');
      if (visited.has(key)) return;
      visiting.add(key); entries.get(key).prerequisites.forEach(walk); visiting.delete(key); visited.add(key);
    }
    entries.forEach((_, key) => walk(key));
    if (!Array.isArray(data.connections) || !data.connections.every(c => object(c) && entries.has(c.from) && entries.has(c.to) && c.from !== c.to
      && ['application', 'comparison', 'foundation'].includes(c.relation) && text(c.why) && text(c.limits))) throw Error('A course connection is incomplete.');
    if (!Array.isArray(data.cards) || !data.cards.every(c => validCard(c) && c.links.every(e => entries.has(e.id)))
      || new Set(data.cards.map(c => c.id)).size !== data.cards.length) throw Error('A retrieval prompt is incomplete.');
    return data;
  }
  function search(data, filters = {}) {
    const tokens = String(filters.q || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    const names = Object.fromEntries(data.objectives.map(o => [o.id, o.title + ' ' + o.description]));
    return data.entries.filter(e => (!filters.track || e.track === filters.track) && (!filters.level || e.level === filters.level)
      && (!filters.objective || e.objectives.includes(filters.objective)) && (filters.drafts || e.status === 'revised'))
      .map(entry => {
        const title = entry.title.toLowerCase(), summary = (entry.summary + ' ' + entry.objectives.map(o => names[o]).join(' ')).toLowerCase();
        return { entry, score: tokens.every(t => title.includes(t) || summary.includes(t)) ? tokens.reduce((sum, t) => sum + (title.includes(t) ? 3 : 1), 0) : -1 };
      }).filter(item => item.score >= 0).sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title)).map(item => item.entry);
  }
  function contextKey(value) {
    const safe = safeReturn(value); if (!safe) return '';
    const url = new URL(safe, 'https://cortex.invalid'), p = url.searchParams;
    if (url.pathname === '/practice' && p.get('view') === 'longitudinal' && p.get('case') && !p.get('run')) return 'practice-timeline:' + p.get('case');
    if (url.pathname === '/neuro' && p.get('project') && !p.get('run')) return 'neuro-project:' + p.get('project');
    if (url.pathname === '/mcat' && p.get('view') === 'course' && p.get('unit')) return 'mcat:' + p.get('unit');
    if (url.pathname === '/learn' && p.get('track') && p.get('lesson')) return 'socrates:' + p.get('track') + ':' + p.get('lesson');
    if (url.pathname === '/cogpsych' && p.get('view') === 'lesson' && p.get('lesson')) return 'cogpsych:' + p.get('lesson');
    if (['/anatomy', '/medicine'].includes(url.pathname) && p.get('lesson')) return (url.pathname === '/anatomy' ? 'anatomy:' : 'reference:') + p.get('lesson');
    if (url.pathname === '/medicine' && p.get('tool') === 'ecg' && p.get('mode') === 'library' && p.get('focus')) return 'ecg:' + p.get('focus');
    if (url.pathname === '/neuro') for (const key of ['unit', 'code', 'sim']) if (p.get(key)) return 'neuro-' + key + ':' + p.get(key);
    if (url.pathname === '/practice' && p.get('view') === 'content' && url.hash.startsWith('#case-')) return 'practice:' + url.hash.slice(6);
    return '';
  }
  function destination(entry, current, returnTo) {
    const safe = safeReturn(entry.url); if (!safe) return null;
    const url = new URL(safe, 'https://cortex.invalid'), origin = new URL(current, 'https://cortex.invalid');
    for (const key of ['gates', 'offline']) if (origin.searchParams.get(key)) url.searchParams.set(key, origin.searchParams.get(key));
    const back = safeReturn(returnTo || origin.searchParams.get('returnTo'));
    if (back) url.searchParams.set('returnTo', back);
    return url.pathname + url.search + url.hash;
  }
  const emptyState = () => ({ version: 1, enabled: false, records: [] });
  const time = value => Number.isFinite(value) && value > 0;
  function validState(state) {
    return object(state) && state.version === 1 && typeof state.enabled === 'boolean' && Array.isArray(state.records)
      && state.records.length <= 1000 && new Set(state.records.map(r => r?.id)).size === state.records.length
      && state.records.every(r => object(r) && id(r.id) && validCard(r.content) && time(r.queuedAt)
        && ['pending', 'deferred', 'removed'].includes(r.status) && typeof r.draft === 'string' && r.draft.length <= 6000
        && typeof r.comparison === 'string' && r.comparison.length <= 6000
        && (r.revealedAt == null || time(r.revealedAt) && text(r.firstDraft) && r.firstDraft.trim().length > 0 && r.draft === r.firstDraft)
        && (r.revealedAt != null || r.firstDraft == null && !r.comparison && r.completedAt == null)
        && (r.completedAt == null || time(r.completedAt) && r.revealedAt != null && r.comparison.trim().length > 0 && r.status === 'pending'));
  }
  function enqueue(state, card, runId, now) {
    if (!state.enabled || !validCard(card) || !id(runId) || !time(now)) return null;
    const existing = state.records.find(r => r.content.id === card.id && !r.completedAt && r.status !== 'removed');
    if (existing) return existing;
    if (state.records.length >= 1000 || state.records.some(r => r.id === runId)) return null;
    const record = { id: runId, content: clone(card), queuedAt: now, status: 'pending', draft: '', comparison: '' };
    state.records.push(record); return record;
  }
  function edit(state, key, field, value) {
    const record = state.records.find(r => r.id === key);
    if (!state.enabled || !record || record.status !== 'pending' || record.completedAt || !['draft', 'comparison'].includes(field) || typeof value !== 'string' || value.length > 6000
      || (field === 'draft' ? record.revealedAt != null : record.revealedAt == null)) return false;
    record[field] = value; return true;
  }
  function reveal(state, key, now) {
    const record = state.records.find(r => r.id === key);
    if (!state.enabled || !record || record.status !== 'pending' || record.revealedAt != null || !record.draft.trim() || !time(now)) return false;
    record.firstDraft = record.draft; record.revealedAt = now; return true;
  }
  function complete(state, key, now) {
    const record = state.records.find(r => r.id === key);
    if (!state.enabled || !record || record.status !== 'pending' || record.completedAt || record.revealedAt == null || !record.comparison.trim() || !time(now)) return false;
    record.completedAt = now; return true;
  }
  function move(state, key, status) {
    const record = state.records.find(r => r.id === key);
    if (!record || record.completedAt || !['pending', 'deferred', 'removed'].includes(status)) return false;
    if (status === 'pending' && state.records.some(r => r.id !== key && r.content.id === record.content.id && !r.completedAt && r.status === 'pending')) return false;
    record.status = status; return true;
  }
  return { paths, levels, safeReturn, validate, search, contextKey, destination, validCard, emptyState, validState, enqueue, edit, reveal, complete, move };
});
