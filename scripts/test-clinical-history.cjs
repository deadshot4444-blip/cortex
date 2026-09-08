/* Actual rendered controls in jsdom; separate browser acceptance is required. */
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  vm = require('node:vm'),
  { JSDOM } = require('jsdom');
const manifest = JSON.parse(fs.readFileSync('data/clinical-shift-pilot.json'));
const caseData = JSON.parse(fs.readFileSync('data/neurology.json')).cases.find(c => c.id === 'nr-101');
const KEY = 'cs-clinical-shift-v1',
  clone = value => JSON.parse(JSON.stringify(value));
function record() {
  const c = clone(caseData),
    investigation = clone(manifest.investigations[c.id]);
  c.title = 'Original saved title';
  c.stages[0].options[c.stages[0].answer] = 'Original saved answer';
  const differential = c.stages.findIndex(s => s.label === 'DIAGNOSIS');
  const active = {
    runId: 'saved-run',
    key: 'neurology',
    caseId: c.id,
    phase: 'debrief',
    stageCursor: c.stages.length,
    revealed: { history: true, exam: true, interviewItems: [0, 1, 2], examItems: [0, 1, 2] },
    optionOrders: {},
    drafts: {},
    locks: Object.fromEntries(
      c.stages.flatMap((s, i) =>
        s.type === 'question' && i !== differential ? [[i, { choice: s.answer, lockedAt: 10 }]] : []
      )
    ),
    differential: {
      stageIndex: differential,
      ranked: [c.stages[differential].answer],
      rationale: 'Original rationale',
      lockedAt: 10,
    },
    resultsRevealed: c.stages.flatMap((s, i) => (s.type === 'result' ? [i] : [])),
    note: { assessment: '<img src=x onerror=alert(1)> Original assessment', plan: 'Original plan', revealedAt: 10 },
    completedAt: 20,
    content: {
      caseData: c,
      investigation,
      modelNote: { assessment: 'Original model assessment', plan: 'Original model plan' },
      review: clone(manifest.caseReviews[c.id]),
    },
  };
  return { caseId: c.id, key: 'neurology', ts: 20, score: 100, encounter: active };
}
function unfinished() {
  return { ...clone(record().encounter), runId: 'unfinished', phase: 'note', completedAt: null };
}
function harness(history = [record()], active = null, route = '/practice?view=shift-history&run=saved-run') {
  const dom = new JSDOM('<div id="app"></div>', {
    url: 'http://localhost' + route,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window,
    ctx = dom.getInternalVMContext(),
    state = { version: 1, active, history, completed: { 'nr-101': { attempts: 1, lastAt: 20 } } };
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  w.confirm = () => {
    throw new Error('Native confirmation must not be used');
  };
  w.localStorage.setItem(KEY, JSON.stringify(state));
  let writes = 0,
    awards = 0,
    downloads = 0;
  const set = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = function (k, v) {
    writes++;
    return set.call(this, k, v);
  };
  Object.assign(w, {
    store: { progress: {}, cases: {}, history: [], streak: {} },
    NAME_BY_KEY: { neurology: 'Neurology' },
    stopTimer() {},
    session: null,
    esc: v => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
    el: html => {
      const t = w.document.createElement('template');
      t.innerHTML = html;
      return t.content.firstElementChild;
    },
    topbar: () => w.document.createElement('header'),
    setView: root => w.document.querySelector('#app').replaceChildren(root),
    renderClinicalCaseBank() {},
    recordClinicalShiftCompletion() {
      awards++;
    },
    fetch: async () => {
      downloads++;
      return { ok: true, json: async () => manifest };
    },
  });
  for (const file of ['study-storage.js', 'clinical-shift.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
  return {
    w,
    entry: () => w.renderClinicalShift(),
    text: () => w.document.querySelector('main').textContent,
    click: s => {
      const node = w.document.querySelector(s);
      assert.ok(node, s);
      node.click();
    },
    original: JSON.stringify(state),
    raw: () => w.localStorage.getItem(KEY),
    counts: () => ({ writes, awards, downloads }),
    close: () => dom.window.close(),
  };
}
test('saved debrief uses original content without download, writes, credit, or changing an unfinished shift', async () => {
  const active = unfinished();
  const h = harness([record()], active);
  await h.entry();
  for (const text of [
    'Original saved title',
    'Original saved answer',
    'Original rationale',
    'Original assessment',
    'Original plan',
    'Original model assessment',
    'Original model plan',
  ])
    assert.ok(h.text().includes(text), text);
  assert.equal(h.w.document.querySelector('main img'), null);
  assert.equal(h.w.document.querySelector('#cshift-next-patient'), null);
  assert.ok(h.text().includes(manifest.investigations['nr-101'].interview[0].finding));
  assert.ok(h.text().includes(caseData.stages.find(s => s.label === 'SUBSEQUENT EEG').content));
  assert.deepEqual(h.counts(), { writes: 0, awards: 0, downloads: 0 });
  assert.equal(h.raw(), h.original);
  h.click('#cshift-exit');
  assert.ok(h.text().includes('Your saved shifts.'));
  h.click('[data-shift-record]');
  assert.ok(h.text().includes('Original saved title'));
  assert.equal(h.raw(), h.original);
  assert.deepEqual(h.counts(), { writes: 0, awards: 0, downloads: 0 });
  h.close();
});
test('history link matches exact completion and an unavailable record does not start another case', async () => {
  const h = harness();
  await h.entry();
  h.w.openClinicalShiftHistory({ caseId: 'nr-101', ts: 20 });
  assert.ok(h.text().includes('Original model plan'));
  h.w.openClinicalShiftHistory({ caseId: 'nr-101', ts: 21 });
  assert.ok(h.text().includes('unavailable or incomplete'));
  assert.equal(h.raw(), h.original);
  assert.equal(h.counts().writes, 0);
  h.close();
});
test('empty, missing and malformed archives render safely without repairs or new work', async () => {
  for (const history of [
    [],
    [null],
    [{ caseId: 'old', key: 'neurology', ts: 5 }],
    [{ ...record(), encounter: { runId: 'saved-run', completedAt: 20, content: { caseData } } }],
  ]) {
    const h = harness(history);
    await h.entry();
    assert.ok(h.text().includes('Your saved shifts.'));
    assert.equal(h.raw(), h.original);
    assert.deepEqual(h.counts(), { writes: 0, awards: 0, downloads: 0 });
    h.close();
  }
});
test('case-bank history opens the saved shift while ordinary rows remain replay actions', () => {
  const source = fs.readFileSync('app.js', 'utf8');
  let element,
    opened = null,
    replayed = null;
  const context = vm.createContext({
    esc: String,
    NAME_BY_KEY: { neurology: 'Neurology' },
    el: () => (element = { addEventListener: (_, fn) => (element.click = fn) }),
    startCaseById: (id, key) => (replayed = [id, key]),
  });
  vm.runInContext(
    source.slice(source.indexOf('function caseRow(entry)'), source.indexOf('function scorePill')),
    context
  );
  context.caseRow({ id: 'nr-101', key: 'neurology', title: 'Case', onOpen: () => (opened = 'saved') }).click();
  assert.equal(opened, 'saved');
  assert.equal(replayed, null);
  context.caseRow({ id: 'nr-101', key: 'neurology', title: 'Case' }).click();
  assert.deepEqual(replayed, ['nr-101', 'neurology']);
});
test('ending a shift requires confirmation; cancel and Escape preserve exact work and focus', async () => {
  const h = harness([record()], unfinished(), '/practice');
  await h.entry();
  const trigger = h.w.document.querySelector('#cshift-end-active');
  trigger.focus();
  h.click('#cshift-end-active');
  assert.equal(h.w.document.activeElement.id, 'cshift-keep');
  assert.equal(h.raw(), h.original);
  const dialog = h.w.document.querySelector('.cshift-confirm');
  dialog.dispatchEvent(new h.w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }));
  assert.equal(h.w.document.activeElement.id, 'cshift-confirm-end');
  dialog.dispatchEvent(new h.w.KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
  assert.equal(h.w.document.activeElement.id, 'cshift-keep');
  h.click('#cshift-keep');
  assert.equal(h.w.document.activeElement, trigger);
  assert.equal(h.raw(), h.original);
  h.click('#cshift-end-active');
  h.w.document.querySelector('.cshift-confirm').dispatchEvent(new h.w.Event('cancel', { cancelable: true }));
  assert.equal(h.w.document.querySelector('.cshift-confirm'), null);
  assert.equal(h.w.document.activeElement, trigger);
  assert.equal(h.raw(), h.original);
  h.click('#cshift-end-active');
  h.click('#cshift-confirm-end');
  const saved = JSON.parse(h.raw());
  assert.equal(saved.active, null);
  assert.deepEqual(saved.history, [record()]);
  assert.equal(saved.completed['nr-101'].attempts, 1);
  assert.equal(h.counts().awards, 0);
  h.close();
});
test('failed replacement download preserves the current shift and cancellation starts no download', async () => {
  const h = harness([record()], unfinished(), '/practice');
  let requested = 0;
  h.w.loadSpecialty = async () => {
    requested++;
    throw new Error('Synthetic download failure');
  };
  await h.entry();
  h.click('[data-shift-specialty]');
  h.click('#cshift-keep');
  assert.equal(requested, 0);
  assert.equal(h.raw(), h.original);
  h.click('[data-shift-specialty]');
  h.click('#cshift-confirm-end');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requested, 1);
  assert.ok(h.text().includes('patient download failed'));
  assert.equal(h.raw(), h.original);
  h.close();
});
test('failed end-shift save retains the browser copy and retries once without losing history', async () => {
  const h = harness([record()], unfinished(), '/practice');
  await h.entry();
  const set = h.w.Storage.prototype.setItem;
  h.w.Storage.prototype.setItem = function () {
    throw new Error('Synthetic storage failure');
  };
  h.click('#cshift-end-active');
  h.click('#cshift-confirm-end');
  assert.equal(h.raw(), h.original);
  assert.ok(h.w.document.querySelector('#study-save-conflict').textContent.includes('could not be saved'));
  h.w.Storage.prototype.setItem = set;
  h.click('#study-save-retry');
  const saved = JSON.parse(h.raw());
  assert.equal(saved.active, null);
  assert.deepEqual(saved.history, [record()]);
  assert.equal(h.counts().awards, 0);
  h.close();
});
test('a newer tab save blocks both an open confirmation and a pending patient replacement', async () => {
  for (const pendingDownload of [false, true]) {
    const h = harness([record()], unfinished(), '/practice');
    let release;
    h.w.loadSpecialty = () =>
      new Promise(resolve => {
        release = resolve;
      });
    await h.entry();
    h.click(pendingDownload ? '[data-shift-specialty="neurology"]' : '#cshift-end-active');
    if (pendingDownload) h.click('#cshift-confirm-end');
    const newer = JSON.stringify({ ...JSON.parse(h.original), completed: { 'nr-101': { attempts: 2, lastAt: 30 } } });
    h.w.localStorage.setItem(KEY, newer);
    h.w.dispatchEvent(new h.w.StorageEvent('storage', { key: KEY, newValue: newer, storageArea: h.w.localStorage }));
    if (pendingDownload) {
      release({ cases: [caseData] });
      await new Promise(resolve => setImmediate(resolve));
    } else h.click('#cshift-confirm-end');
    assert.equal(h.raw(), newer);
    assert.equal(h.counts().awards, 0);
    assert.ok(h.w.document.querySelector('#study-save-conflict').textContent.includes('Newer study work'));
    h.close();
  }
});
