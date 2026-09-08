/* Debriefed encounters are archived history, never an unfinished shift (jsdom, real StudyStorage). Not visual acceptance. */
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  vm = require('node:vm'),
  { JSDOM } = require('jsdom');
const KEY = 'cs-clinical-shift-v1',
  pause = () => new Promise(resolve => setImmediate(resolve));
const pilot = JSON.parse(fs.readFileSync('data/clinical-shift-pilot.json'));
const rotation = pilot.rotations[0],
  caseData = JSON.parse(fs.readFileSync(`data/${rotation.key}.json`)).cases.find(c => c.id === rotation.caseIds[0]);
const expose = source =>
  source.replace(
    'window.renderClinicalShift = renderClinicalShift;',
    'window.testShift={newActiveShift,setSession:(value,state)=>{shiftSession=value;shiftState=state;}}; window.renderClinicalShift = renderClinicalShift;'
  );
function harness(seed = new Map(), path = '/practice') {
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', {
    url: 'http://localhost' + path,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window,
    ctx = dom.getInternalVMContext(),
    errors = [];
  for (const [key, value] of seed) w.localStorage.setItem(key, value);
  w.addEventListener('error', event => {
    errors.push(event.error);
    event.preventDefault();
  });
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  w.el = html => {
    const template = w.document.createElement('template');
    template.innerHTML = html;
    return template.content.firstElementChild;
  };
  w.esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  w.topbar = () => w.el('<header>Clinical Scenarios</header>');
  w.setView = root => w.document.querySelector('#app').replaceChildren(root);
  w.store = { progress: {}, cases: {}, history: [], streak: {} };
  w.stopTimer = () => {};
  w.session = null;
  w.renderClinicalCaseBank = () => {};
  w.renderReview = () => {};
  w.CortexProgress = { OWNER: 'test-owner' };
  w.confirm = () => true;
  w.fetch = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(String(url).split('?')[0])) });
  w.loadSpecialty = () =>
    new Promise(() => {}); /* app.js helper; a pending assignment keeps the hub assertions synchronous */
  for (const file of ['study-storage.js', 'clinical-longitudinal-engine.js', 'clinical-longitudinal.js'])
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
  vm.runInContext(expose(fs.readFileSync('clinical-shift.js', 'utf8')), ctx);
  const find = selector => w.document.querySelector(selector);
  const click = selector => {
    const node = find(selector);
    assert.ok(node, 'Missing ' + selector);
    node.click();
    assert.equal(errors.length, 0, errors[0]?.stack);
  };
  return {
    w,
    find,
    click,
    errors,
    entry: () => w.renderClinicalShift(),
    state: () => JSON.parse(w.localStorage.getItem(KEY)),
    close: () => w.close(),
  };
}
function debriefReady(w) {
  const active = w.testShift.newActiveShift(rotation, caseData);
  const diagnosis = caseData.stages.findIndex(s => s.label === 'DIAGNOSIS');
  active.differential = {
    stageIndex: diagnosis,
    ranked: [caseData.stages[diagnosis].answer],
    rationale: 'Because',
    lockedAt: 100,
  };
  for (const [i, s] of caseData.stages.entries())
    if (s.type === 'question' && i !== diagnosis) active.locks[i] = { choice: s.answer, lockedAt: 100 };
  active.note = { assessment: 'My assessment', plan: 'My plan', revealedAt: 100 };
  active.phase = 'debrief';
  return active;
}
test('leaving a completed debrief archives the encounter instead of keeping it as a shift in progress', async () => {
  const h = harness();
  await h.entry();
  assert.ok(h.find('.cshift-hub'));
  const active = debriefReady(h.w);
  h.w.testShift.setSession({ rotation, caseData, active }, { version: 1, active, completed: {}, history: [] });
  h.w.history.pushState({}, '', `/practice?view=shift&run=${active.runId}`);
  await h.entry();
  await pause();
  assert.ok(h.find('.cshift-debrief'), 'Debrief renders');
  assert.ok(h.state().active.completedAt);
  assert.equal(h.state().history.length, 1);
  h.click('#cshift-exit');
  await pause();
  assert.ok(h.find('.cshift-hub'));
  assert.equal(h.state().active, null, 'The archived encounter is released');
  assert.equal(h.state().history.length, 1);
  assert.equal(h.state().completed[caseData.id].attempts, 1);
  assert.equal(h.find('.cshift-resume'), null, 'No shift in progress block');
  assert.equal(h.w.location.search, '');
  h.click('[data-shift-specialty]');
  assert.equal(h.find('dialog.cshift-confirm'), null, 'No replacement confirmation for finished work');
  h.close();
});
test('an already saved completed encounter is not offered as an unfinished shift on the hub', async () => {
  const source = harness();
  await source.entry();
  const active = debriefReady(source.w);
  source.close();
  active.completedAt = 200;
  active.scores = { total: 80 };
  const seed = new Map([
    [
      KEY,
      JSON.stringify({
        version: 1,
        active,
        completed: { [caseData.id]: { attempts: 1, bestScore: 80, lastScore: 80, lastAt: 200, key: rotation.key } },
        history: [{ caseId: caseData.id, key: rotation.key, score: 80, ts: 200, encounter: active }],
      }),
    ],
  ]);
  const h = harness(seed);
  await h.entry();
  assert.ok(h.find('.cshift-hub'));
  assert.equal(h.find('.cshift-resume'), null);
  assert.ok(!h.find('.cshift-hub').textContent.includes('Shift in progress'));
  assert.equal(h.find('#cshift-end-active'), null);
  assert.equal(h.state().history.length, 1);
  h.click('[data-shift-specialty]');
  assert.equal(h.find('dialog.cshift-confirm'), null);
  h.close();
});
