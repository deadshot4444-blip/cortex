/* Actual project controllers and StudyStorage in jsdom, with a CPython execution adapter.
 * This is not a real-browser, file-dialog or Pyodide acceptance test.
 */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), { spawnSync } = require('node:child_process');
const { JSDOM } = require('jsdom'), crypto = require('node:crypto').webcrypto;
const Core = require('../neuro-project-engine.js');
const data = JSON.parse(fs.readFileSync('data/neuro-projects.json')), projects = data.projects;
const units = JSON.parse(fs.readFileSync('data/neuro.json')).learningPaths[0].steps.map(s => s.id), KEY = 'cs-neuro';
const tick = () => new Promise(resolve => setImmediate(resolve));
function python(code) { const r = spawnSync('python3', ['-'], { input: code, encoding: 'utf8', timeout: 5000, maxBuffer: 2000000 }); return { ok: r.status === 0, stdout: r.stdout || '', stderr: r.stderr || r.error?.message || '' }; }
const defaultSaved = () => new Map([[KEY, JSON.stringify({ pathDone: units, milestones: { 'neural-signal-viewer': { passed: true, ts: 50 } } })]]);
function harness(seed = defaultSaved(), path = '/neuro?project=neural-signal-viewer') {
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', { url: 'http://localhost' + path, runScripts: 'outside-only', pretendToBeVisual: true, storageQuota: 20000000 });
  const w = dom.window, ctx = dom.getInternalVMContext(), errors = [], fetched = [], downloads = [], blobs = new Map();
  let failure = false, fetchFailure = false, fetchGate = null, holdExecution = false, failResult = false, executions = 0;
  for (const [key, value] of seed) w.localStorage.setItem(key, value);
  const originalSet = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = function (key, value) { if (failure && key === KEY) throw new w.DOMException('Test quota', 'QuotaExceededError'); return originalSet.call(this, key, value); };
  w.addEventListener('error', event => { errors.push(event.error); event.preventDefault(); });
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); }; w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  w.TextEncoder = TextEncoder; Object.defineProperty(w, 'crypto', { value: crypto });
  w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {}; w.confirm = () => true;
  w.CortexProgress = { OWNER: 'test-owner' }; w.stopTimer = () => {}; w.session = null;
  w.el = html => { const t = w.document.createElement('template'); t.innerHTML = html; return t.content.firstElementChild; };
  w.esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  w.topbar = () => w.el('<header>Neuroengineering</header>'); w.sectionUrl = () => '/neuro';
  w.setView = root => w.document.querySelector('#app').replaceChildren(root);
  w.Blob = class { constructor(parts) { this.text = parts.join(''); } };
  w.URL.createObjectURL = blob => { const url = 'blob:test-' + blobs.size; blobs.set(url, blob.text); return url; }; w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () { downloads.push({ name: this.download, text: blobs.get(this.href) }); };
  w.fetch = async url => { fetched.push(url); if (fetchGate) await fetchGate; return { ok: !fetchFailure, json: async () => JSON.parse(fs.readFileSync(String(url).split('?')[0])) }; };
  w.runPythonCode = async (code, options = {}) => {
    executions++;
    if (holdExecution) return new Promise(resolve => { const finish = () => resolve({ ok: false, reason: 'stopped', stdout: '', stderr: 'Stopped in test adapter' }); if (options.signal.aborted) finish(); else options.signal.addEventListener('abort', finish, { once: true }); });
    const result = python(code); if (failResult) failure = true; return result;
  };
  const run = code => vm.runInContext(code, ctx);
  for (const file of ['study-storage.js', 'code-evaluator.js', 'neuro-project-engine.js', 'neuro-practitioner.js', 'neuro.js']) run(fs.readFileSync(file, 'utf8'));
  const find = selector => w.document.querySelector(selector);
  const click = selector => { const node = find(selector); assert.ok(node, 'Missing ' + selector + ': ' + find('main')?.textContent.slice(0, 200)); node.click(); assert.equal(errors.length, 0, errors[0]?.stack); };
  const input = (selector, value) => { const node = find(selector); assert.ok(node, selector); node.value = value; node.dispatchEvent(new w.Event('input', { bubbles: true })); };
  return { w, dom, run, find, click, input, fetched, downloads, errors, entry: () => w.renderNeuroEngineering({ fromUrl: true }),
    async until(predicate) { const end = Date.now() + 2000; while (!predicate() && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 5)); assert.ok(predicate(), 'Expected async project view did not settle'); },
    state: () => JSON.parse(w.localStorage.getItem(KEY)), work: id => JSON.parse(w.localStorage.getItem(KEY)).projects?.[id]?.current,
    raw: () => w.localStorage.getItem(KEY), force(key, value) { originalSet.call(w.localStorage, key, value); },
    snapshot: () => new Map(Array.from({ length: w.localStorage.length }, (_, i) => { const key = w.localStorage.key(i); return [key, w.localStorage.getItem(key)]; })),
    async open(id, runId) { w.history.pushState({}, '', '/neuro?project=' + id + (runId ? '&run=' + runId : '')); await this.entry(); },
    async start(id) { await this.open(id); click('#project-start'); },
    async check(project) { input('#project-prediction', 'I predict a result that depends on these inputs.'); input('#project-code', project.solution); click('#project-check'); await tick(); },
    memo() { for (const key of Core.MEMO) input(`[data-project-memo="${key}"]`, 'My own ' + key + ' and evidence.'); },
    get executions() { return executions; }, set fail(value) { failure = value; }, set fetchFail(value) { fetchFailure = value; }, set fetchGate(value) { fetchGate = value; }, set hold(value) { holdExecution = value; }, set failResult(value) { failResult = value; }, close() { dom.window.close(); } };
}

test('all six projects check, finish, export and preserve prior completion records through real controllers', async () => {
  const h = harness(), before = h.raw(); await h.entry(); assert.equal(h.raw(), before, 'Opening the specification is read-only');
  for (const p of projects) {
    await h.start(p.id); assert.equal(h.work(p.id).draft, p.starter);
    h.click('#project-reference'); assert.ok(h.work(p.id).modelViewedAt);
    await h.check(p); const checked = h.work(p.id); assert.equal(checked.attempts.at(-1).result.passed, true, p.id);
    assert.equal(h.find('#project-prediction').readOnly, true); assert.equal(h.find('#project-finish').disabled, true);
    h.memo(); assert.equal(h.find('#project-finish').disabled, false); h.click('#project-finish');
    const work = h.work(p.id); assert.ok(work.completedAt); assert.equal(work.completion.assisted, true); Core.validateWork(work);
    assert.ok(h.find('#project-new')); assert.match(h.find('main').textContent, /not independent engineering approval/);
    h.click('#project-python'); const exported = h.downloads.at(-1); assert.equal(exported.name, p.id + '.py');
    assert.ok(exported.text.includes(p.inputSha256)); const reproduced = python(exported.text); assert.equal(reproduced.ok, true);
    const report = JSON.parse(reproduced.stdout.split('CORTEX_PROJECT_RESULT:')[1]); assert.ok(report.cases.every(c => c.passed));
    h.click('#project-record'); assert.equal(JSON.parse(h.downloads.at(-1).text).work.runId, work.runId);
  }
  assert.deepEqual(h.state().milestones['neural-signal-viewer'], { passed: true, ts: 50 }); assert.equal(h.executions, 6); h.close();
});
test('actual unit prerequisites and prior project access replace the old any-N-units gate', async () => {
  const locked = harness(new Map([[KEY, JSON.stringify({ pathDone: units.slice(7), milestones: {} })]])); await locked.entry();
  assert.equal(locked.find('#project-start').disabled, true); locked.close();
  const retained = harness(new Map([[KEY, JSON.stringify({ pathDone: [], milestones: { 'spike-detector': { passed: true, ts: 123 } } })]]), '/neuro?project=spike-detector');
  await retained.entry(); assert.equal(retained.find('#project-start').disabled, false); retained.click('#project-start'); assert.match(retained.find('main').textContent, /earlier output-only/); retained.close();
});
test('a stored revision-one spike project resumes without the catalog after signed-zero normalization', async () => {
  const project = JSON.parse(JSON.stringify(projects.find(p => p.id === 'spike-detector')));
  project.revision = 1;
  project.inputSha256 = 'fc384baf91e4481bc8d5bd48b57b8c521b7a85921179910271f35018e96e26f2';
  const work = Core.create(project, 'legacy-spike-run', 1);
  work.prediction = 'Preserve this prediction across reload.';
  const saved = new Map([[KEY, JSON.stringify({ pathDone: [], projects: { 'spike-detector': { current: work, history: [] } } })]]);
  const h = harness(saved, '/neuro?project=spike-detector&run=legacy-spike-run');
  h.fetchFail = true;
  await h.entry();
  assert.equal(h.find('h1').textContent, 'Spike Detector + Feature Vector');
  assert.equal(h.find('#project-prediction').value, work.prediction);
  assert.equal(h.fetched.length, 0, 'A frozen record must resume without new content');
  assert.equal(h.raw(), saved.get(KEY), 'Compatibility must preserve the original saved checksum');
  h.close();
});
test('saved work reloads without a course/catalog request and an edited draft requires a fresh check', async () => {
  const h = harness(); await h.start(projects[0].id); await h.check(projects[0]); h.memo();
  h.input('#project-code', projects[0].solution + '\n# a changed draft'); assert.equal(h.find('#project-finish').disabled, true);
  const work = h.work(projects[0].id), next = harness(h.snapshot(), '/neuro?project=' + projects[0].id + '&run=' + work.runId); next.fetchFail = true; await next.entry();
  assert.equal(next.fetched.length, 0); assert.equal(next.find('#project-code').value, work.draft); assert.equal(next.find('#project-finish').disabled, true);
  assert.deepEqual(next.work(projects[0].id).content, projects[0]); h.close(); next.close();
});
test('failed draft/start/check writes retain work and never launch Python before the first save succeeds', async () => {
  const h = harness(); await h.entry(); const before = h.raw(); h.fail = true; h.click('#project-start'); assert.equal(h.raw(), before);
  h.fail = false; h.run('StudyStorage.retry()'); await h.until(() => h.find('#project-code'));
  const saved = h.raw(); h.fail = true; h.input('#project-code', 'def f(x):\n    return x<2');
  assert.equal(h.raw(), saved); assert.match(h.run("StudyStorage.recovery().records['cs-neuro'].thisTab.projects['neural-signal-viewer'].current.draft"), /x<2/);
  h.fail = false; h.run('StudyStorage.retry()'); await tick();
  h.input('#project-prediction', 'My saved prediction'); h.input('#project-code', projects[0].solution);
  h.fail = true; h.click('#project-check'); assert.equal(h.executions, 0);
  h.fail = false; h.run('StudyStorage.retry()'); await tick();
  assert.equal(h.work(projects[0].id).attempts.at(-1).status, 'interrupted'); assert.equal(h.find('#project-finish').disabled, true); h.close();
});
test('failed result and completion saves do not advance the visible state until recovery', async () => {
  const h = harness(); await h.start(projects[0].id); h.failResult = true; await h.check(projects[0]);
  assert.ok(h.find('#study-save-conflict')); assert.equal(h.work(projects[0].id).attempts.at(-1).status, 'running');
  h.fail = false; h.failResult = false; h.run('StudyStorage.retry()'); await tick();
  assert.equal(h.work(projects[0].id).attempts.at(-1).result.passed, true); h.memo();
  h.fail = true; h.click('#project-finish'); assert.equal(h.work(projects[0].id).completedAt, null); assert.equal(h.find('#project-new'), null);
  h.fail = false; h.run('StudyStorage.retry()'); await tick(); assert.ok(h.work(projects[0].id).completedAt); assert.ok(h.find('#project-new')); h.close();
});
test('Stop and navigation cancel an active check; reloading a pending check never assigns a pass', async () => {
  const h = harness(); await h.start(projects[0].id); h.input('#project-prediction', 'I predict a stopping case.'); h.input('#project-code', projects[0].solution); h.hold = true;
  h.click('#project-check'); assert.equal(h.find('#project-stop').hidden, false); h.click('#project-stop'); await tick();
  assert.equal(h.work(projects[0].id).attempts.at(-1).result.passed, false); assert.equal(h.find('#project-code').readOnly, false);
  h.click('#project-check'); const snapshot = h.snapshot(), runId = h.work(projects[0].id).runId;
  h.w.history.pushState({}, '', '/academy'); h.w.setView(h.w.el('<main>A different page</main>')); await tick();
  assert.equal(h.find('main').textContent, 'A different page'); assert.equal(h.work(projects[0].id).attempts.at(-1).result.passed, false);
  const next = harness(snapshot, '/neuro?project=' + projects[0].id + '&run=' + runId); await next.entry();
  assert.equal(next.work(projects[0].id).attempts.at(-1).status, 'interrupted'); assert.equal(next.find('#project-finish').disabled, true); h.close(); next.close();
});
test('new account and newer-tab records cannot be replaced by this project', async () => {
  for (const owner of [false, true]) {
    const h = harness(); await h.start(projects[0].id); h.input('#project-prediction', 'Before conflict');
    const key = owner ? 'test-owner' : KEY, value = owner ? 'new-owner' : JSON.stringify({ pathDone: [], milestones: {} }); h.force(key, value);
    h.w.dispatchEvent(new h.w.StorageEvent('storage', { key, storageArea: h.w.localStorage })); h.click('#project-check');
    assert.equal(h.executions, 0); assert.equal(h.w.localStorage.getItem(key), value); assert.equal(h.run('StudyStorage.conflicted'), true); h.close();
  }
});
test('wrong-shaped returned data remains inspectable without crashing or earning completion', async () => {
  const h = harness(new Map([[KEY, JSON.stringify({ pathDone: units, milestones: { 'leftright-decoder': { passed: true } } })]]), '/neuro?project=leftright-decoder');
  await h.entry(); h.click('#project-start'); h.input('#project-prediction', 'My function may return a wrong shape.');
  h.input('#project-code', 'def fit_decoder(*args):\n    return {"test_predictions": [1,1,1,1], "train_predictions": "bad"}\n');
  h.click('#project-check'); await tick(); assert.equal(h.errors.length, 0); assert.equal(h.find('#project-finish').disabled, true);
  assert.match(h.find('main').textContent, /Training: unavailable/); h.close();
});
test('completed history stays fixed when a new run begins, and corrupt input snapshots are retained for recovery', async () => {
  const h = harness(); await h.start(projects[0].id); await h.check(projects[0]); h.memo(); h.click('#project-finish');
  const original = h.work(projects[0].id); h.click('#project-new'); assert.notEqual(h.work(projects[0].id).runId, original.runId);
  await h.open(projects[0].id, original.runId); assert.equal(h.find('#project-code').readOnly, true); assert.equal(h.find('#project-check'), null);
  assert.deepEqual(h.state().projects[projects[0].id].history[0], original);
  const snapshot = h.snapshot(), damaged = h.state(); damaged.projects[projects[0].id].current.content.checks.cases[0].args[0][0] += 1; snapshot.set(KEY, JSON.stringify(damaged));
  const bad = harness(snapshot, '/neuro?project=' + projects[0].id); const raw = bad.raw(); await bad.entry(); assert.equal(bad.raw(), raw); assert.ok(bad.find('#study-save-conflict')); h.close(); bad.close();
});
test('late catalog downloads do not replace a newer route', async () => {
  const h = harness(); let release; h.fetchGate = new Promise(resolve => { release = resolve; }); const pending = h.entry();
  h.w.history.pushState({}, '', '/academy'); h.w.setView(h.w.el('<main>Other route</main>')); release(); await pending;
  assert.equal(h.find('main').textContent, 'Other route'); h.close();
});
test('Back leaves a project with a current run instead of re-pushing the run URL', async () => {
  const h = harness(defaultSaved(), '/neuro'), id = projects[0].id;
  // Mirror app.js: popstate re-routes from the URL; the hub itself is outside this harness.
  h.w.addEventListener('popstate', () => { if (new URLSearchParams(h.w.location.search).has('project')) h.w.renderNeuroEngineering({ fromUrl: true }); else h.w.setView(h.w.el('<main>Hub</main>')); });
  const popped = () => new Promise(resolve => h.w.addEventListener('popstate', () => setTimeout(resolve, 20), { once: true }));
  await h.w.renderNeuroMilestone(id); await h.until(() => h.find('#project-start'));
  assert.equal(h.w.history.length, 2); assert.equal(h.w.location.search, '?project=' + id);
  h.click('#project-start'); const runId = h.work(id).runId;
  assert.equal(h.w.location.search, `?project=${id}&run=${runId}`); assert.equal(h.w.history.length, 2, 'Start replaces the project entry');
  let back = popped(); h.w.history.back(); await back;
  assert.equal(h.w.location.search, ''); assert.equal(h.find('main').textContent, 'Hub'); assert.equal(h.w.history.length, 2);
  let forward = popped(); h.w.history.forward(); await forward; await h.until(() => h.find('#project-code'));
  assert.equal(h.w.location.search, `?project=${id}&run=${runId}`); assert.equal(h.w.history.length, 2, 'Re-routing to the same run writes no history');
  // A bookmark or old entry without the run parameter resolves to the current run in place.
  h.w.history.pushState({}, '', '/neuro?project=' + id); await h.entry(); await h.until(() => h.find('#project-code'));
  assert.equal(h.w.location.search, `?project=${id}&run=${runId}`); assert.equal(h.w.history.length, 3);
  back = popped(); h.w.history.back(); await back; assert.equal(h.w.location.search, `?project=${id}&run=${runId}`);
  back = popped(); h.w.history.back(); await back; assert.equal(h.find('main').textContent, 'Hub'); h.close();
});
test('the saved record omits the reference until it is opened in-app, and the runtime note states the standard-library limit', async () => {
  const h = harness(), id = projects[0].id; await h.open(id); assert.match(h.find('main').textContent, /Only the Python standard library/);
  h.click('#project-start'); assert.match(h.find('main').textContent, /Only the Python standard library/);
  h.click('#project-record'); const hidden = JSON.parse(h.downloads.at(-1).text);
  assert.equal(hidden.work.content.solution, undefined); assert.equal(hidden.work.content.modelMemo, undefined); assert.match(hidden.omitted, /reference/);
  assert.equal(hidden.work.runId, h.work(id).runId); assert.deepEqual(h.work(id).content, projects[0], 'The saved record itself is untouched');
  h.click('#project-reference'); h.click('#project-record'); const shown = JSON.parse(h.downloads.at(-1).text);
  assert.equal(shown.work.content.solution, projects[0].solution); assert.deepEqual(shown.work.content.modelMemo, projects[0].modelMemo); assert.equal(shown.omitted, undefined); h.close();
});
