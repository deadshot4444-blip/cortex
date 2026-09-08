/* Shared Academy UI: readable research inputs, no self-referential return links, in-app catalog navigation. */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { JSDOM } = require('jsdom'), Core = require('../academy-curriculum.js');
const data = JSON.parse(fs.readFileSync('data/academy-curriculum.json'));
function dom(url, globals = {}) {
  const d = new JSDOM('<!doctype html><body><div id="app"></div></body>', { url, runScripts: 'outside-only' }), w = d.window, opened = [];
  Object.assign(w, { IS_LOCAL_PREVIEW: true, AcademyCurriculum: Core, CortexAcademy: { tracks: Object.keys(Core.paths).filter(k => k !== 'academy').map(id => ({ id, name: id, available: true })) },
    StudyStorage: { paused: false, read: (k, fallback) => fallback, watch() {}, sessionFailed() {}, write() { return true; } },
    sectionUrl(key) { const u = new URL(Core.paths[key], w.location.origin); for (const k of ['gates', 'offline', 'returnTo']) if (w.location.searchParams?.get(k) || new URLSearchParams(w.location.search).get(k)) u.searchParams.set(k, new URLSearchParams(w.location.search).get(k)); return u.pathname + u.search; },
    el: html => { const t = w.document.createElement('template'); t.innerHTML = html; return t.content.firstElementChild; },
    esc: v => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'), topbar: () => w.el('<header data-section="academy"></header>'),
    setView: root => w.document.querySelector('#app').replaceChildren(root), openSection: key => { opened.push(key); }, navigateSection: key => { opened.push(key); },
    fetch: async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(data)) }) }, globals);
  const run = file => vm.runInContext(fs.readFileSync(file, 'utf8'), d.getInternalVMContext());
  const click = node => { const event = new w.MouseEvent('click', { bubbles: true, cancelable: true }); node.dispatchEvent(event); return event.defaultPrevented; };
  return { w, run, opened, click, find: s => w.document.querySelector(s), all: s => [...w.document.querySelectorAll(s)], close: () => w.close() };
}
test('research lab inputs use defined light-theme tokens, not undefined dark fallbacks', () => {
  const css = fs.readFileSync('academy.css', 'utf8'), theme = fs.readFileSync('styles.css', 'utf8');
  const rule = css.match(/\.cog-research textarea, \.cog-research select \{([^}]*)\}/); assert.ok(rule, 'rule present');
  const defined = new Set([...theme.matchAll(/(--[\w-]+):/g)].map(m => m[1]));
  const tokens = [...rule[1].matchAll(/var\((--[\w-]+)(?:,\s*([^)]*))?\)/g)];
  assert.ok(tokens.length >= 3);
  for (const [, token, fallback] of tokens) { assert.ok(defined.has(token), token + ' is defined in styles.css'); assert.equal(fallback, undefined, token + ' needs no fallback'); }
  assert.match(rule[1], /color:\s*var\(--text\)/); assert.doesNotMatch(rule[1], /color:\s*inherit/);
});
test('"Stay with this lesson" does not send the learner back with a return link to that same lesson', async () => {
  const lesson = '/mcat?view=course&unit=protein-structure';
  const h = dom('http://localhost/academy?view=curriculum&context=mcat:protein-structure&returnTo=' + encodeURIComponent(lesson)); h.run('academy-connect.js');
  await h.w.AcademyConnect.render(); await new Promise(r => setImmediate(r));
  const stay = h.all('a').find(a => a.textContent === 'Stay with this lesson'); assert.ok(stay, 'link rendered');
  const target = new URL(stay.getAttribute('href'), 'http://localhost');
  assert.equal(target.pathname + target.search, lesson); assert.equal(target.searchParams.get('returnTo'), null);
  const other = h.all('a[data-connect-course]').find(a => Core.contextKey(a.getAttribute('href')) && Core.contextKey(a.getAttribute('href')) !== 'mcat:protein-structure');
  assert.ok(other, 'another lesson link exists'); assert.equal(new URL(other.getAttribute('href'), 'http://localhost').searchParams.get('returnTo'), lesson, 'Other lessons still return to the starting lesson');
  const all = h.all('a').find(a => a.textContent === 'All courses'); assert.ok(all.hasAttribute('data-connect-view'));
  assert.equal(h.click(all), true); assert.deepEqual(h.opened, ['academy']); assert.equal(h.w.location.pathname, '/academy'); h.close();
});
test('catalog view links stay inside the app instead of reloading the document', () => {
  const h = dom('http://localhost/academy'); h.run('academy.js'); h.w.CortexAcademy.renderCatalog();
  const links = h.all('[data-academy-view]'); assert.deepEqual(links.map(a => new URL(a.href).searchParams.get('view')), ['storage', 'portfolio', 'curriculum', 'queue']);
  for (const link of links) {
    assert.equal(h.click(link), true, link.textContent + ' is handled in-app');
    assert.equal(h.w.location.pathname + h.w.location.search, new URL(link.href).pathname + new URL(link.href).search);
  }
  assert.deepEqual(h.opened, ['academy', 'academy', 'academy', 'academy']);
  const modified = new h.w.MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }); links[0].dispatchEvent(modified);
  assert.equal(modified.defaultPrevented, false, 'Modifier clicks keep the browser default'); h.close();
});
test('saved retrieval opens and completes without fetching the public catalog', async () => {
  const saved = Core.emptyState(); saved.enabled = true;
  const record = Core.enqueue(saved, data.cards[0], 'saved-run', Date.now());
  Core.edit(saved, record.id, 'draft', 'Explain from memory, then compare with the source.');
  let requests = 0;
  const h = dom('http://localhost/academy?view=queue&run=saved-run', {
    fetch: async () => { requests++; throw Error('Offline'); },
    StudyStorage: { paused: false, read: () => saved, watch() {}, sessionFailed() { assert.fail('Saved prompt must validate'); }, write: () => true }
  }); h.run('academy-connect.js'); await h.w.AcademyConnect.render();
  assert.equal(h.find('h1').textContent, record.content.title); assert.equal(h.find('#connect-draft').value, record.draft); assert.equal(requests, 0);
  h.click(h.find('#connect-reveal')); assert.equal(h.find('#connect-draft').readOnly, true);
  const comparison = h.find('#connect-comparison'); comparison.value = 'The model adds explicit comparison of missing links.';
  comparison.dispatchEvent(new h.w.Event('input')); h.click(h.find('#connect-complete'));
  assert.ok(record.completedAt); assert.equal(requests, 0); h.close();
});
test('catalog outage retains queue links and retries new prompts without changing saved writing', async () => {
  const saved = Core.emptyState(); saved.enabled = true;
  const record = Core.enqueue(saved, data.cards[0], 'saved-run', Date.now());
  Core.edit(saved, record.id, 'draft', 'Retained private draft.');
  let unavailable = true;
  const h = dom('http://localhost/academy?view=queue', {
    fetch: async () => { if (unavailable) throw Error('Offline'); return { ok: true, json: async () => structuredClone(data) }; },
    StudyStorage: { paused: false, read: () => saved, watch() {}, sessionFailed() { assert.fail('Saved prompt must validate'); }, write: () => true }
  }); h.run('academy-connect.js'); await h.w.AcademyConnect.render();
  assert.match(h.find('main').textContent, /New prompts could not load/);
  assert.ok(h.all('a').some(a => a.getAttribute('href').includes('run=saved-run')));
  assert.equal(h.all('[data-connect-add]').length, 0);
  unavailable = false; h.click(h.find('#connect-retry')); await new Promise(r => setImmediate(r));
  assert.ok(h.all('[data-connect-add]').length > 0); assert.equal(record.draft, 'Retained private draft.'); h.close();
});
test('a locked connected lesson explains its prerequisite and keeps its URL and original return destination', async () => {
  const lessons = JSON.parse(fs.readFileSync('data/learn-to-learn.json'));
  const returnTo = '/academy?view=queue&run=saved-run';
  const address = 'http://localhost/learn?track=general&lesson=g6&step=1&returnTo=' + encodeURIComponent(returnTo);
  let writes = 0;
  const h = dom(address, {
    fetch: async () => ({ ok: true, json: async () => structuredClone(lessons) }),
    StudyStorage: { paused: false, read: (key, fallback) => fallback, watch() {}, sessionFailed() { assert.fail('Empty guest workspace is valid'); }, write() { writes++; return true; } }
  }); h.run('socrates.js'); await h.w.openLearnToLearn();
  assert.equal(h.w.location.href, address); assert.match(h.find('[role="status"]').textContent, /Protect your attention opens after Mix similar problems/);
  assert.equal(writes, 0); assert.equal(h.find('[aria-label="Lesson 6 locked"]').disabled, true);
  h.click(h.find('#ltlcstart')); await new Promise(r => setImmediate(r));
  const destination = new URL(h.w.location.href); assert.equal(destination.searchParams.get('lesson'), 'g1'); assert.equal(destination.searchParams.get('returnTo'), returnTo);
  assert.equal(h.find('h1').textContent, lessons.tracks.find(t => t.id === 'general').lessons[0].steps[0].title); h.close();
});
