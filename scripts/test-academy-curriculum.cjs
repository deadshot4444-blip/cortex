const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const Core = require('../academy-curriculum.js');
const Backup = require('../study-backup.js');
const data = JSON.parse(fs.readFileSync('data/academy-curriculum.json'));
const clone = value => JSON.parse(JSON.stringify(value));
const KEY = 'cs-academy-connections-v1';

test('index resolves all current lesson IDs and keeps drafts distinct from revised material', () => {
  assert.equal(Core.validate(data), data); assert.equal(data.entries.length, 200);
  assert.equal(data.cards.length, 12); assert.equal(data.connections.length, 23);
  assert.equal(new Set(data.entries.map(e => e.track)).size, 6);
  assert.equal(data.entries.filter(e => e.status === 'draft').length, 27);
  assert.equal(data.entries.filter(e => e.track === 'reference' && e.kind === 'Lesson').length, 22);
  assert.ok(data.entries.every(e => /pending/.test(e.reviewStatus)));
  assert.equal(data.entries.find(e => e.id === 'neuro-sim:sim-dec-overfit').status, 'draft', 'A citation or narrow copy correction does not promote a wider draft scenario');
  for (const e of data.entries) assert.equal(Core.contextKey(e.url), e.id);
  for (const card of data.cards) assert.ok(new Set(card.links.map(e => e.track)).size > 1);
});
test('missing prerequisites, cycles, invalid destinations and broken connections are rejected', () => {
  for (const damage of [d => d.entries[0].prerequisites.push('missing'), d => d.entries[0].prerequisites.push(d.entries[0].id),
    d => d.entries[0].url = '//evil.test', d => d.connections[0].to = 'missing', d => d.entries[0].objectives.push('missing'),
    d => d.cards[0].links[0].url = '/account', d => d.cards.push(d.cards[0])]) {
    const d = clone(data); damage(d); assert.throws(() => Core.validate(d));
  }
});
test('search honors intersecting track, preparation, text and shared-objective filters', () => {
  assert.equal(Core.search(data).length, 173);
  assert.equal(Core.search(data, { drafts: true }).length, 200);
  const result = Core.search(data, { track: 'reference', level: 'applied', q: 'measurement', objective: 'measurement-artifact' });
  assert.ok(result.length); assert.ok(result.every(e => e.track === 'reference' && e.level === 'applied' && e.objectives.includes('measurement-artifact')));
  assert.equal(Core.search(data, { track: 'neuro', level: 'advanced' }).length, 0);
  assert.equal(Core.search(data, { track: 'neuro', level: 'advanced', drafts: true }).length, 15);
  assert.equal(Core.search(data, { q: 'no-such-phrase' }).length, 0);
});
test('return destinations reject redirects and preserve valid original progress routes', () => {
  for (const value of ['https://evil.test/mcat', '//evil.test', '/\\evil.test', '/account', '/mcat/../academy', '/%2f%2fevil.test', '/mcat?token=secret', '/academy#<script>', '/mcat?unit=%00bad']) assert.equal(Core.safeReturn(value), null, value);
  const start = '/medicine?gates=prod&lesson=med-flow-resistance&step=4';
  assert.equal(Core.safeReturn(start), start);
  assert.equal(Core.safeReturn(start + '&returnTo=%2Fmcat'), start);
  const dest = Core.destination(data.entries[0], '/academy?gates=prod&offline=pack', start);
  const url = new URL(dest, 'https://cortex.invalid');
  assert.equal(url.searchParams.get('returnTo'), start); assert.equal(url.searchParams.get('offline'), 'pack');
  assert.equal(url.searchParams.get('gates'), 'prod');
  const hop = Core.destination(data.entries[1], dest);
  assert.equal(new URL(hop, 'https://cortex.invalid').searchParams.get('returnTo'), start);
  assert.equal(Core.contextKey('/practice?view=shift&run=private-run'), '');
  assert.equal(Core.contextKey('/mcat?view=coach&unit=protein-structure'), '');
  assert.equal(Core.contextKey('/medicine?tool=ecg&mode=drill&record=run'), '');
});
test('retrieval requires opt-in, preserves first writing and freezes content through a new revision', () => {
  const state = Core.emptyState(), card = clone(data.cards[0]);
  assert.equal(Core.enqueue(state, card, 'run-1', 100), null); state.enabled = true;
  const record = Core.enqueue(state, card, 'run-1', 100); assert.equal(Core.enqueue(state, card, 'run-2', 101), record);
  card.model = 'Changed model'; card.links[0].title = 'Changed title';
  assert.notEqual(record.content.model, card.model); assert.notEqual(record.content.links[0].title, card.links[0].title);
  assert.equal(Core.reveal(state, 'run-1', 102), false);
  assert.equal(Core.edit(state, 'run-1', 'draft', 'My original explanation.'), true);
  assert.equal(Core.reveal(state, 'run-1', 103), true);
  assert.equal(Core.edit(state, 'run-1', 'draft', 'Change after reveal'), false);
  assert.equal(Core.complete(state, 'run-1', 104), false);
  Core.edit(state, 'run-1', 'comparison', 'I missed the delayed return.');
  assert.equal(Core.complete(state, 'run-1', 105), true); assert.equal(Core.complete(state, 'run-1', 106), false);
  assert.equal(Core.edit(state, 'run-1', 'comparison', 'Overwrite'), false);
  assert.equal(Core.validState(clone(state)), true);
  assert.ok(Core.enqueue(state, card, 'run-2', 110)); assert.equal(state.records.length, 2);
});
test('pause, set-aside, remove and restore keep work and prevent duplicate pending attempts', () => {
  const state = Core.emptyState(); state.enabled = true;
  const record = Core.enqueue(state, data.cards[0], 'run-1', 100);
  Core.edit(state, record.id, 'draft', 'Keep this writing.'); state.enabled = false;
  assert.equal(Core.edit(state, record.id, 'draft', 'Overwrite'), false);
  assert.equal(Core.reveal(state, record.id, 101), false); assert.equal(record.draft, 'Keep this writing.');
  assert.equal(Core.move(state, record.id, 'deferred'), true); state.enabled = true;
  assert.equal(Core.enqueue(state, data.cards[0], 'run-2', 102), record);
  assert.equal(Core.move(state, record.id, 'removed'), true);
  assert.ok(Core.enqueue(state, data.cards[0], 'run-2', 103));
  assert.equal(Core.move(state, record.id, 'pending'), false);
  Core.move(state, 'run-2', 'removed'); assert.equal(Core.move(state, record.id, 'pending'), true);
  assert.equal(record.draft, 'Keep this writing.'); assert.ok(Core.validState(state));
});
test('damaged first explanations and completion records are not silently reset', () => {
  const state = Core.emptyState(); state.enabled = true; const record = Core.enqueue(state, data.cards[0], 'run-1', 100);
  Core.edit(state, record.id, 'draft', 'First'); Core.reveal(state, record.id, 101); Core.edit(state, record.id, 'comparison', 'Compared'); Core.complete(state, record.id, 102);
  for (const damage of [s => delete s.records[0].firstDraft, s => s.records[0].comparison = '', s => s.records[0].draft = 'altered', s => s.records[0].status = 'removed', s => s.records.push(s.records[0])]) {
    const d = clone(state); damage(d); assert.equal(Core.validState(d), false);
  }
});
test('new retrieval records round-trip through portable backup without adding course credit', async () => {
  const state = Core.emptyState(); state.enabled = true;
  for (const card of data.cards) Core.enqueue(state, card, 'run-' + card.id, 100);
  const workspace = { [KEY]: JSON.stringify(state), 'cs-mcat-course-v1': '{"units":{}}' };
  const options = { crypto }, text = await Backup.create(workspace, '2.4.0-local.1', options);
  const restored = await Backup.parse(text, options); assert.deepEqual(restored.data, workspace);
  assert.ok(Core.validState(JSON.parse(restored.data[KEY])));
});

// Minimal DOM stand-in for actual handler logic. It does not render or automate a browser.
function harness(saved = new Map(), initial = '/academy?view=queue', catalog = clone(data)) {
  let screen, fail = false, reads = 0, writes = 0, invalid = 0, fetchOK = true, fetchGate;
  const elements = [], listeners = new Map(), watchers = new Map(), location = new URL(initial, 'http://localhost');
  function node(html = '') {
    const children = [], parsed = [];
    for (const match of html.matchAll(/<(a|input|button|textarea|form|select|p)\b([^>]*)>(?:([^<]*)(?=<))?/g)) {
      const attrs = Object.fromEntries([...match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(m => [m[1], m[2] ?? '']));
      const child = { tag: match[1], attrs, dataset: {}, value: match[1] === 'textarea' ? match[3] || '' : attrs.value || '', disabled: 'disabled' in attrs,
        readOnly: 'readonly' in attrs, textContent: '', focus() { this.focused = true; }, getAttribute(name) { return attrs[name]; }, setAttribute(name, value) { attrs[name] = value; } };
      for (const [key, value] of Object.entries(attrs)) if (key.startsWith('data-')) child.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      parsed.push(child);
    }
    const matches = (child, selector) => selector.startsWith('#') ? child.attrs?.id === selector.slice(1) : selector.startsWith('[') ? selector.slice(1, -1) in (child.attrs || {}) : child.tag === selector;
    const root = { html, children, appendChild(child) { children.push(child); return child; }, prepend(child) { children.unshift(child); },
      querySelectorAll(selector) { return selector.split(',').flatMap(s => [...parsed.filter(child => matches(child, s.trim())), ...children.flatMap(child => child.querySelectorAll(s.trim()))]); },
      querySelector(selector) { if (selector === 'main' && html.startsWith('<main')) return root; return this.querySelectorAll(selector)[0] || children.map(child => child.querySelector(selector)).find(Boolean) || null; } };
    elements.push(root); return root;
  }
  const storage = { paused: false, read(key, fallback) { reads++; return saved.has(key) ? JSON.parse(saved.get(key)) : fallback; },
    watch(key, reader) { watchers.set(key, reader); }, sessionFailed() { invalid++; storage.paused = true; },
    write(key, value) { writes++; if (fail || storage.paused) { storage.paused = true; return false; } saved.set(key, JSON.stringify(value)); return true; } };
  const tracks = Object.keys(Core.paths).filter(key => key !== 'academy').map(id => ({ id, name: id }));
  const context = vm.createContext({ window: { addEventListener: (key, fn) => listeners.set(key, fn) }, document: { querySelector: () => screen },
    AcademyCurriculum: Core, CortexAcademy: { tracks }, StudyStorage: storage, URL, URLSearchParams, Date, JSON, crypto, location,
    history: { pushState(_, __, path) { location.href = new URL(path, location).href; } },
    sectionUrl(key) { const u = new URL(Core.paths[key], location.origin); for (const k of ['gates', 'offline', 'returnTo']) if (location.searchParams.get(k)) u.searchParams.set(k, location.searchParams.get(k)); return u.pathname + u.search; },
    el: node, topbar: () => node(), esc: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
    setView: root => screen = root, openSection() {},
    fetch: async () => { if (fetchGate) await fetchGate; return { ok: fetchOK, json: async () => catalog }; } });
  vm.runInContext(fs.readFileSync('academy-connect.js', 'utf8'), context);
  const api = context.window.AcademyConnect;
  return { saved, storage, watchers, location, listeners, api, render: () => api.render(), find: s => screen.querySelector(s), all: s => screen.querySelectorAll(s),
    get html() { return screen.children.map(c => c.html).join(''); }, get writes() { return writes; }, get reads() { return reads; }, get invalid() { return invalid; },
    get state() { return watchers.get(KEY)?.(); }, set fail(value) { fail = value; }, set fetchOK(value) { fetchOK = value; }, set fetchGate(value) { fetchGate = value; } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('discovery does not read or write private progress; loading after navigation cannot replace the new page', async () => {
  const h = harness(new Map(), '/academy?view=curriculum&context=mcat:circulatory-flow');
  await h.render(); assert.equal(h.reads, 0); assert.equal(h.writes, 0); assert.match(h.html, /Connected to:/); assert.match(h.html, /Page 1 of/);
  const delayed = harness(new Map(), '/academy?view=curriculum'); let release;
  delayed.fetchGate = new Promise(r => release = r); const pending = delayed.render();
  delayed.location.href = 'http://localhost/mcat?view=today'; release(); await pending;
  assert.doesNotMatch(delayed.html, /matching entries/); assert.equal(delayed.reads, 0);
});
test('queue handlers opt in, save drafts, freeze first writing, require a comparison and resume it', async () => {
  const h = harness(); await h.render(); assert.equal(h.writes, 0); assert.ok(h.all('[data-connect-add]').every(b => b.disabled));
  h.find('#connect-enable').onclick(); await tick(); assert.equal(h.state.enabled, true);
  h.all('[data-connect-add]')[0].onclick(); await tick(); assert.equal(h.state.records.length, 1);
  const record = h.state.records[0]; assert.equal(h.location.searchParams.get('run'), record.id);
  h.find('#connect-reveal').onclick(); assert.equal(record.revealedAt, undefined);
  const draft = h.find('#connect-draft'); draft.value = 'I will retrieve before checking.'; draft.oninput();
  h.find('#connect-reveal').onclick(); await tick(); assert.equal(record.firstDraft, draft.value);
  h.find('#connect-complete').onclick(); assert.equal(record.completedAt, undefined);
  const comparison = h.find('#connect-comparison'); comparison.value = 'I also need to return after a delay.'; comparison.oninput();
  h.find('#connect-complete').onclick(); await tick(); assert.ok(record.completedAt);
  const reload = harness(h.saved, h.location.pathname + h.location.search); await reload.render();
  assert.match(reload.html, /Written comparison completed/); assert.equal(reload.find('#connect-draft').readOnly, true);
  assert.deepEqual([...h.saved.keys()], [KEY]);
});
test('pause actually saves and preserves records; failed writes retain pending content for recovery', async () => {
  const h = harness(); await h.render(); h.find('#connect-enable').onclick(); await tick();
  h.find('#connect-enable').onclick(); await tick(); assert.equal(JSON.parse(h.saved.get(KEY)).enabled, false);
  h.find('#connect-enable').onclick(); await tick(); h.fail = true;
  h.all('[data-connect-add]')[0].onclick(); await tick();
  assert.equal(h.state.records.length, 1); assert.equal(JSON.parse(h.saved.get(KEY)).records.length, 0);
  assert.equal(h.location.searchParams.get('run'), h.state.records[0].id); assert.equal(h.storage.paused, true);
  const before = h.writes; h.all('[data-connect-add]')[1].onclick(); assert.equal(h.writes, before);
  h.fail = false; h.storage.paused = false; h.saved.set(KEY, JSON.stringify(h.state));
  h.listeners.get('study-storage-recovered')(); await tick(); assert.match(h.html, /Explain before checking/);
  h.find('#connect-draft').value = 'Newest pending explanation.'; h.fail = true; h.find('#connect-draft').oninput();
  assert.equal(h.state.records[0].draft, 'Newest pending explanation.'); assert.equal(JSON.parse(h.saved.get(KEY)).records[0].draft, '');
  h.find('#connect-reveal').onclick(); assert.equal(h.state.records[0].revealedAt, undefined);
});
test('corrupt saved queue is retained and saving is paused; unavailable catalog can retry', async () => {
  const saved = new Map([[KEY, '{"version":1,"enabled":true,"records":[{}]}']]), h = harness(saved);
  await h.render(); assert.equal(h.invalid, 1); assert.equal(h.writes, 0); assert.equal(saved.get(KEY), '{"version":1,"enabled":true,"records":[{}]}');
  const unavailable = harness(); unavailable.fetchOK = false; await unavailable.render(); assert.match(unavailable.html, /could not load/); assert.equal(unavailable.reads, 1); assert.equal(unavailable.writes, 0);
  unavailable.fetchOK = true; await unavailable.find('#connect-retry').onclick(); assert.match(unavailable.html, /Optional retrieval is off/);
});
