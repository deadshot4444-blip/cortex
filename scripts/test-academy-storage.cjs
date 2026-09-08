/* Exercise actual screen handlers with a small DOM stand-in; no browser claim. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Backup = require('../study-backup.js');
const Progress = require('../auth-progress.js');
const crypto = require('node:crypto').webcrypto;
const markupDocument = new (require('jsdom').JSDOM)('').window.document;
function setup(seed = {}) {
  const data = new Map([['cs-mode', 'timed'], ...Object.entries(seed)]), elements = [], revoked = [], events = {}; let main, root, reloads = 0, downloads = 0, recoveries = 0, urls = 0;
  const storage = { get length() { return data.size; }, key: i => [...data.keys()][i], getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
  const engine = Progress.create({ storage, onReload() { reloads++; } });
  function node(html = '') {
    const childMap = new Map(), item = { html, children: [], isConnected: true, textContent: '', value: '', checked: false, disabled: false,
      appendChild(n) { this.children.push(n); }, replaceChildren() { this.children = []; }, querySelector(s) { if (!childMap.has(s)) childMap.set(s, node()); return childMap.get(s); }, click() { downloads++; } };
    elements.push(item); if (html.startsWith('<main')) main = item; return item;
  }
  const study = { paused: false };
  const location = new URL('http://localhost/academy?view=storage');
  class TestURL extends URL { static createObjectURL() { return 'blob:local-test-' + ++urls; } static revokeObjectURL(url) { revoked.push(url); } }
  const context = vm.createContext({ window: { addEventListener: (name, fn) => { events[name] = fn; } }, document: { createElement: () => node() }, URL: TestURL, Blob, Date, setTimeout() {}, location, APP_VERSION: '2.4.0-local.1',
    el: node, esc: String, topbar: () => node(), sectionUrl: () => '/academy', setView(r) { if (root) root.children.forEach(n => { n.isConnected = false; }); root = r; },
    StudyStorage: study, StudyBackup: { ...Backup, safeMarkup: value => Backup.safeMarkup(value, markupDocument), create: (data, v, o) => Backup.create(data, v, { ...o, crypto }), parse: (text, o) => Backup.parse(text, { ...o, crypto }) },
    CortexAccount: { label: 'Guest workspace on this device', snapshot: () => engine.portableSnapshot(), prepareRestore: d => engine.prepareRestore(d), restore: p => engine.restore(p), downloadRecovery() { recoveries++; } } });
  vm.runInContext(fs.readFileSync('academy-storage.js', 'utf8'), context);
  const render = () => context.window.AcademyStorage.render(); render();
  return { engine, data, study, render, revoked, events, get main() { return main; }, get reloads() { return reloads; }, get downloads() { return downloads; }, get recoveries() { return recoveries; },
    select: async file => { const input = main.querySelector('#storage-file'); input.files = [file]; input.value = 'chosen.json'; await input.onchange({ target: input }); },
    get panel() { return main.querySelector('#storage-preview').children[0]; },
    status: () => main.querySelector('#storage-import-status').textContent };
}
const file = async data => { const text = await Backup.create(data, 'test', { crypto }); return { size: Buffer.byteLength(text), text: async () => text }; };
let checks = 0;
async function test(name, fn) { await fn(); console.log('PASS', name); checks++; }
(async () => {
  await test('File selection previews changes without restoring; an explicit checked action restores once', async () => {
    const h = setup(); await h.select(await file({ 'cs-mode': 'untimed' })); assert.equal(h.data.get('cs-mode'), 'timed'); assert.match(h.status(), /Nothing has been restored/);
    const panel = h.panel, apply = panel.querySelector('[data-apply]'), checkbox = panel.querySelector('[data-confirm]'); apply.onclick(); assert.equal(h.reloads, 0);
    checkbox.checked = true; checkbox.onchange(); assert.equal(apply.disabled, false); apply.onclick(); assert.equal(h.reloads, 1); assert.equal(h.data.get('cs-mode'), 'untimed');
    apply.onclick(); assert.equal(h.reloads, 1); h.engine.stop();
  });
  await test('Cancel and stale previews preserve active work and allow choosing the same file again', async () => {
    const h = setup(), f = await file({ 'cs-mode': 'untimed' }); await h.select(f); h.panel.querySelector('[data-cancel]').onclick(); assert.equal(h.panel, undefined); assert.equal(h.data.get('cs-mode'), 'timed');
    await h.select(f); h.data.set('cs-mode', 'newer'); const panel = h.panel; panel.querySelector('[data-confirm]').checked = true; panel.querySelector('[data-apply]').onclick();
    assert.equal(h.data.get('cs-mode'), 'newer'); assert.match(h.status(), /changed after/); assert.equal(h.main.querySelector('#storage-file').value, ''); h.engine.stop();
  });
  await test('A later file selection wins over an earlier slow file read', async () => {
    const h = setup(), a = await file({ 'cs-mode': 'first' }), b = await file({ 'cs-mode': 'second' }); let release;
    const pending = h.select({ size: a.size, text: () => new Promise(r => { release = r; }) }); await h.select(b); release(await a.text()); await pending;
    assert.match(h.panel.querySelector('[data-records]').textContent, /second/); const panel = h.panel; panel.querySelector('[data-confirm]').checked = true; panel.querySelector('[data-apply]').onclick(); assert.equal(h.data.get('cs-mode'), 'second'); h.engine.stop();
  });
  await test('Invalid files reset the selector and pending unsaved drafts block portable actions', async () => {
    const h = setup(); await h.select({ size: 1, text: async () => '{' }); assert.match(h.status(), /JSON/); assert.equal(h.main.querySelector('#storage-file').value, '');
    h.study.paused = true; await h.select(await file({ 'cs-mode': 'untimed' })); assert.match(h.status(), /Saving is paused/); assert.equal(h.panel, undefined);
    const button = h.main.querySelector('#storage-export'); await button.onclick({ currentTarget: button }); assert.equal(h.downloads, 0); assert.equal(button.disabled, false);
    h.main.querySelector('#storage-recovery').onclick(); assert.equal(h.recoveries, 1); h.engine.stop();
  });
  await test('Navigating away invalidates a pending import screen and does not restore work', async () => {
    const h = setup(), f = await file({ 'cs-mode': 'untimed' }); let release; const pending = h.select({ size: f.size, text: () => new Promise(r => { release = r; }) });
    h.render(); release(await f.text()); await pending; assert.equal(h.panel, undefined); assert.equal(h.reloads, 0); assert.equal(h.data.get('cs-mode'), 'timed'); h.engine.stop();
  });
  await test('A portable export exposes an explicit download link without changing the workspace or starting an automatic download', async () => {
    const h = setup(), button = h.main.querySelector('#storage-export'); await button.onclick({ currentTarget: button }); assert.equal(h.downloads, 0);
    const link=h.main.querySelector('#storage-download').children[0];assert.match(link.href,/^blob:/);assert.match(link.download,/^cortex-study-.*\.json$/);
    let prevented=false;link.onclick({preventDefault(){prevented=true;}});assert.equal(prevented,false);
    assert.equal(h.data.get('cs-mode'), 'timed'); assert.equal(h.reloads, 0); h.engine.stop();
  });
  await test('Newer saved work or a paused save prevents downloading a prepared stale copy', async () => {
    for(const paused of [false,true]){
      const h=setup(),button=h.main.querySelector('#storage-export');await button.onclick({currentTarget:button});
      const link=h.main.querySelector('#storage-download').children[0];if(paused)h.study.paused=true;else h.data.set('cs-mode','newer');
      let prevented=false;link.onclick({preventDefault(){prevented=true;}});assert.equal(prevented,true);
      assert.equal(h.main.querySelector('#storage-download').children.length,0);assert.deepEqual(h.revoked,[link.href]);h.engine.stop();
    }
  });
  await test('Learner notes with angle-bracket shorthand still export; authored markup reports an export failure, not a failed restore', async () => {
    const note = '{"version":1,"active":{"note":{"assessment":"Na<K and K>Cl","plan":"Replete K<3.5"}},"history":[]}';
    const h = setup({ 'cs-clinical-shift-v1': note }), button = h.main.querySelector('#storage-export'); await button.onclick({ currentTarget: button });
    assert.match(h.main.querySelector('#storage-export-status').textContent, /Backup prepared from 2 saved records/);
    const link = h.main.querySelector('#storage-download').children[0]; assert.match(link.download, /^cortex-study-/); h.engine.stop();
    const bad = setup({ 'cs-cogpsych': '{"lessons":{"l1":{"steps":{"0":{"content":{"body":"<img src=x onerror=alert(1)>"}}}}}}' }), b = bad.main.querySelector('#storage-export'); await b.onclick({ currentTarget: b });
    const status = bad.main.querySelector('#storage-export-status').textContent; assert.match(status, /no backup was prepared/); assert.match(status, /cs-cogpsych/); assert.doesNotMatch(status, /restored/);
    assert.equal(bad.main.querySelector('#storage-download').children.length, 0); assert.equal(b.disabled, false); bad.engine.stop();
  });
  await test('Preparing a replacement, leaving the page and rerendering release prepared URLs', async () => {
    const h=setup(),button=h.main.querySelector('#storage-export');await button.onclick({currentTarget:button});await button.onclick({currentTarget:button});
    assert.deepEqual(h.revoked,['blob:local-test-1']);h.events.pagehide();assert.deepEqual(h.revoked,['blob:local-test-1','blob:local-test-2']);
    await button.onclick({currentTarget:button});h.render();assert.deepEqual(h.revoked,['blob:local-test-1','blob:local-test-2','blob:local-test-3']);h.engine.stop();
  });
  console.log(`${checks} backup screen handler checks passed. File dialogs and visual browser walkthroughs remain pending.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
