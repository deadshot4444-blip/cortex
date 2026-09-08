/* Product handlers with real StudyStorage in jsdom. This is not visual/browser acceptance. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), { JSDOM } = require('jsdom');
const crypto = require('node:crypto').webcrypto, Core = require('../clinical-longitudinal-engine.js');
const cases = JSON.parse(fs.readFileSync('data/clinical-longitudinal.json')).cases, KEY = 'cs-clinical-longitudinal-v1';
const pause = () => new Promise(resolve => setImmediate(resolve));
function harness(seed = new Map(), path = '/practice?view=longitudinal') {
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', { url: 'http://localhost' + path, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, ctx = dom.getInternalVMContext(), errors = [], fetched = [];
  let failure = null, fetchFailure = false, gate = null;
  for (const [key, value] of seed) w.localStorage.setItem(key, value);
  const originalSet = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = function (key, value) { if (failure?.(key)) throw new w.DOMException('Test quota', 'QuotaExceededError'); return originalSet.call(this, key, value); };
  w.addEventListener('error', event => { errors.push(event.error); event.preventDefault(); });
  w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  w.el = html => { const template = w.document.createElement('template'); template.innerHTML = html; return template.content.firstElementChild; };
  w.esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  w.topbar = () => w.el('<header>Clinical Scenarios</header>');
  w.setView = root => w.document.querySelector('#app').replaceChildren(root);
  w.store = { progress: {}, cases: {}, history: [], streak: {} };
  w.stopTimer = () => {}; w.session = null; w.renderClinicalCaseBank = () => {}; w.renderReview = () => {};
  w.CortexProgress = { OWNER: 'test-owner' }; w.confirm = () => true;
  w.fetch = async url => { fetched.push(url); if (gate) await gate; return { ok: !fetchFailure, json: async () => JSON.parse(fs.readFileSync(String(url).split('?')[0])) }; };
  const run = code => vm.runInContext(code, ctx);
  for (const file of ['study-storage.js', 'clinical-longitudinal-engine.js', 'clinical-longitudinal.js', 'clinical-shift.js']) run(fs.readFileSync(file, 'utf8'));
  const find = selector => w.document.querySelector(selector);
  const click = selector => { const node = find(selector); assert.ok(node, 'Missing ' + selector); node.click(); assert.equal(errors.length, 0, errors[0]?.stack); };
  const input = (name, value) => { const node = find(`[name="${name}"]`); assert.ok(node, name); node.value = value; node.dispatchEvent(new w.Event('input', { bubbles: true })); };
  return { w, dom, run, find, click, input, fetched, errors, entry: () => w.renderClinicalShift(),
    state: () => JSON.parse(w.localStorage.getItem(KEY)), raw: () => w.localStorage.getItem(KEY),
    snapshot: () => new Map(Array.from({ length: w.localStorage.length }, (_, i) => { const key = w.localStorage.key(i); return [key, w.localStorage.getItem(key)]; })),
    choose(value) { const node = find(`[name="choice"][value="${value}"]`); assert.ok(node); node.checked = true; node.dispatchEvent(new w.Event('input', { bubbles: true })); },
    first(choice) { for (const field of Core.REASON) input(field, 'My first ' + field); this.choose(choice); click('#clong-reason button[type="submit"]'); },
    handoff() { for (const field of Core.HANDOFF) input(field, 'My handoff ' + field); click('#clong-handoff button[type="submit"]'); },
    force(key, value) { originalSet.call(w.localStorage, key, value); },
    set fail(fn) { failure = fn; }, set fetchFail(value) { fetchFailure = value; }, set fetchGate(value) { gate = value; }, close: () => dom.window.close() };
}
const seedRun = active => new Map([[KEY, JSON.stringify({ version: 1, active, history: [] })]]);
function runAt(phase) {
  let run = Core.create(cases[0], 'saved-run', Date.now() - 10000);
  run.drafts.arrival = { hypothesis: 'Earlier explanation', alternative: 'Other explanation', evidence: 'Early evidence', choice: 'serial' };
  if (phase === 'reason') return run;
  run = Core.lock(run);
  if (phase === 'feedback') return run;
  run = Core.advance(run); run.drafts.repeat = { ...run.drafts.arrival, choice: 'escalate' };
  run = Core.advance(Core.lock(run));
  run.handoffDraft = Object.fromEntries(Core.HANDOFF.map(key => [key, 'First ' + key]));
  if (phase === 'handoff') return run;
  run = Core.revealHandoff(run); run.comparison = 'One useful revision'; return run;
}
test('the real clinical route enters timelines before loading specialty data; home is read-only', async () => {
  const h = harness(); await h.entry(); assert.equal(h.raw(), null);
  assert.equal(h.find('h1').textContent, 'Follow the evidence. Revise the story.');
  assert.deepEqual(h.fetched, ['data/clinical-longitudinal.json?v=1']);
  h.click('#clong-rotations'); await pause();
  assert.ok(h.find('#cshift-longitudinal')); h.click('#cshift-longitudinal'); await pause(); assert.ok(h.find('[data-clong-start]')); h.close();
});
test('all 12 paths expose evidence in order, retain first work and archive a full case without a competence score', async () => {
  for (const item of cases) for (const path of Core.paths(item)) {
    const h = harness(); await h.entry(); h.click(`[data-clong-start="${item.id}"]`);
    for (const step of path.filter(s => s.choice)) {
      const node = item.nodes.find(n => n.id === step.node);
      assert.equal(h.state().active.nodeId, step.node);
      const finalText = item.nodes.at(-1).observation;
      assert.ok(!h.find('main').textContent.includes(finalText), 'Future handoff evidence leaked');
      assert.ok(!h.find('#clong-reason').textContent.includes(node.model), 'Decision model leaked');
      h.first(step.choice); assert.equal(h.state().active.phase, 'feedback');
      assert.ok(h.find('main').textContent.includes(node.model)); h.click('#clong-next');
    }
    assert.equal(h.state().active.phase, 'handoff');
    assert.ok(!h.find('main').textContent.includes(item.nodes.at(-1).model.situation));
    h.handoff(); assert.equal(h.state().active.phase, 'compare');
    h.input('comparison', 'I changed my explanation after the new evidence.'); h.click('#clong-comparison button');
    const saved = h.state(); assert.equal(saved.active, null); assert.equal(saved.history.length, 1);
    assert.deepEqual(saved.history[0].caseData, item); assert.equal(saved.history[0].handoff.assessment, 'My handoff assessment');
    assert.equal(saved.history[0].records[0].reason.hypothesis, 'My first hypothesis');
    assert.match(h.find('main').textContent, /No automated judgment/); assert.equal(h.find('textarea'), null);
    h.close();
  }
});
test('direct resume opens the frozen case without a catalog request, and unavailable catalog still offers saved work', async () => {
  const active = runAt('reason'), h = harness(seedRun(active), '/practice?view=longitudinal&run=saved-run');
  h.fetchFail = true; await h.entry(); assert.equal(h.fetched.length, 0); assert.equal(h.find('[name="hypothesis"]').value, 'Earlier explanation');
  h.input('hypothesis', 'New draft before leaving'); const snapshot = h.snapshot(); h.close();
  const next = harness(snapshot, '/practice?view=longitudinal&run=saved-run'); next.fetchFail = true; await next.entry();
  assert.equal(next.find('[name="hypothesis"]').value, 'New draft before leaving'); next.click('#clong-hub'); await pause();
  assert.ok(next.find('[data-clong-open="saved-run"]')); next.click('[data-clong-open="saved-run"]'); await pause(); assert.ok(next.find('#clong-reason')); next.close();
});
test('failed decision, advance, handoff and final archive stay off the next screen until successful recovery', async () => {
  for (const [phase, selector, expected] of [['reason', '#clong-reason button', 'feedback'], ['feedback', '#clong-next', 'reason'], ['handoff', '#clong-handoff button', 'compare'], ['compare', '#clong-comparison button', 'complete']]) {
    const h = harness(seedRun(runAt(phase)), '/practice?view=longitudinal&run=saved-run'); await h.entry();
    const before = h.raw(), title = h.find('main').textContent;
    h.fail = key => key === KEY; h.click(selector); assert.equal(h.raw(), before); assert.equal(h.find('main').textContent, title);
    assert.ok(h.find('#study-save-conflict')); h.fail = null; assert.equal(h.run('StudyStorage.retry()'), true); await pause();
    const state = h.state(); assert.equal((state.active || state.history[0]).phase, expected);
    if (expected === 'complete') assert.equal(state.active, null);
    else if (expected === 'feedback') assert.ok(h.find('#clong-next'));
    h.close();
  }
});
test('failed draft is held in recovery; retry renders it and does not unlock the model', async () => {
  const h = harness(seedRun(runAt('reason')), '/practice?view=longitudinal&run=saved-run'); await h.entry();
  const before = h.raw(); h.fail = key => key === KEY; h.input('hypothesis', 'Unsaved but retained');
  assert.equal(h.raw(), before); assert.equal(h.run(`StudyStorage.recovery().records['${KEY}'].thisTab.active.drafts.arrival.hypothesis`), 'Unsaved but retained');
  h.fail = null; h.run('StudyStorage.retry()'); await pause(); assert.equal(h.find('[name="hypothesis"]').value, 'Unsaved but retained');
  assert.equal(h.find('#clong-next'), null); h.close();
});
test('newer workspace or account writes cannot be replaced by this tab', async () => {
  for (const account of [false, true]) {
    const h = harness(seedRun(runAt('reason')), '/practice?view=longitudinal&run=saved-run'); await h.entry();
    const key = account ? 'test-owner' : KEY, value = account ? 'different-account' : JSON.stringify({ version: 1, active: null, history: [] });
    h.force(key, value); h.w.dispatchEvent(new h.w.StorageEvent('storage', { key, storageArea: h.w.localStorage }));
    h.click('#clong-reason button'); assert.equal(h.w.localStorage.getItem(key), value); assert.equal(h.find('#clong-next'), null);
    assert.equal(h.run('StudyStorage.conflicted'), true); h.close();
  }
});
test('reset clears the new domain and portable backups retain its full snapshot and first handoff', async () => {
  const active = runAt('compare'), h = harness(seedRun(active), '/practice?view=longitudinal&run=saved-run'); await h.entry(); h.click('#clong-comparison button');
  const Backup = require('../study-backup.js'), records = { [KEY]: h.raw() }, file = await Backup.create(records, 'local', { crypto });
  assert.deepEqual((await Backup.parse(file, { crypto })).data, records);
  h.w.ClinicalLongitudinal.reset(); assert.equal(h.raw(), null); h.w.ClinicalLongitudinal.open(); await pause(); assert.equal(h.find('[data-clong-open]'), null); h.close();
});
test('stale downloads, foreign run IDs and damaged saved branches do not substitute another encounter', async () => {
  const h = harness(); let release; h.fetchGate = new Promise(resolve => { release = resolve; }); const pending = h.entry();
  h.w.history.pushState({}, '', '/academy'); h.w.setView(h.w.el('<main>Different page</main>')); release(); await pending;
  assert.equal(h.find('main').textContent, 'Different page'); h.close();
  const foreign = harness(seedRun(runAt('reason')), '/practice?view=longitudinal&run=absent'); await foreign.entry(); assert.match(foreign.find('h1').textContent, /not in this workspace/); foreign.close();
  const damaged = runAt('feedback'); damaged.records[0].choice = 'unknown';
  const bad = harness(seedRun(damaged), '/practice?view=longitudinal&run=saved-run'), original = bad.raw(); await bad.entry();
  assert.ok(bad.find('#study-save-conflict')); assert.equal(bad.raw(), original); assert.equal(bad.find('#clong-next'), null); bad.close();
});
test('discard confirmation preserves work on cancel, stale copy and failed preflight; confirmed discard keeps completed history', async () => {
  const active=runAt('reason'), done=Core.complete(runAt('compare')); done.runId='older-completed';
  const seed=new Map([[KEY,JSON.stringify({version:1,active,history:[done]})]]),h=harness(seed);await h.entry();
  const before=h.raw();h.click('#clong-discard');assert.equal(h.w.document.activeElement.id,'clong-keep');
  h.find('dialog').dispatchEvent(new h.w.Event('cancel',{cancelable:true}));assert.equal(h.raw(),before);assert.equal(h.w.document.activeElement.id,'clong-discard');
  h.click('#clong-discard');h.fail=key=>key===KEY;h.click('#clong-confirm-discard');assert.equal(h.raw(),before);assert.equal(h.run(`StudyStorage.recovery().records['${KEY}'].thisTab.active.runId`),active.runId);
  h.fail=null;h.run('StudyStorage.retry()');await pause();h.click('#clong-discard');h.click('#clong-confirm-discard');await pause();assert.equal(h.state().active,null);assert.deepEqual(h.state().history,[done]);h.close();
  const stale=harness(seed);await stale.entry();stale.click('#clong-discard');const newer=JSON.stringify({version:1,active:null,history:[done]});stale.force(KEY,newer);stale.w.dispatchEvent(new stale.w.StorageEvent('storage',{key:KEY,storageArea:stale.w.localStorage}));stale.click('#clong-confirm-discard');assert.equal(stale.raw(),newer);stale.close();
});
