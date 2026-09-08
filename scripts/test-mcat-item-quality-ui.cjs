/* Actual item-review controller, account engine and save recovery in jsdom. */
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm');
const { JSDOM } = require('jsdom'),
  crypto = require('node:crypto').webcrypto,
  Progress = require('../auth-progress.js'),
  Core = require('../mcat-item-quality-core.js');
const SOURCE = 'cs-mcat-course-v1',
  row = {
    qId: 'q1',
    chosen: 0,
    correct: true,
    ts: 100,
    kind: 'check',
    questionSnapshot: {
      stem: '<img src=x>Original question',
      options: ['First', 'Second'],
      answer: 0,
      explanation: 'Original explanation',
    },
  };
function harness(
  seed = { [SOURCE]: JSON.stringify({ units: { u1: { attempts: [row] } } }), 'sb-token': 'SECRET_ACCOUNT' }
) {
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', {
      url: 'http://localhost/mcat?view=quality',
      runScripts: 'outside-only',
    }),
    w = dom.window,
    ctx = dom.getInternalVMContext();
  const originalSet = w.Storage.prototype.setItem,
    originalGet = w.Storage.prototype.getItem,
    originalRemove = w.Storage.prototype.removeItem;
  for (const [k, v] of Object.entries(seed)) originalSet.call(w.localStorage, k, v);
  const storage = {
    get length() {
      return w.localStorage.length;
    },
    key: i => w.localStorage.key(i),
    getItem: k => originalGet.call(w.localStorage, k),
    setItem: (k, v) => originalSet.call(w.localStorage, k, v),
    removeItem: k => originalRemove.call(w.localStorage, k),
  };
  const engine = Progress.create({ storage });
  let fail = false,
    gate = null;
  w.CortexProgress = Progress;
  w.CortexAccount = { available: true, snapshot: () => engine.portableSnapshot() };
  w.Storage.prototype.setItem = function (k, v) {
    engine.beforeWrite(k);
    if (fail && k === Core.KEY) throw Error('Quota test');
    originalSet.call(this, k, v);
    engine.afterWrite(k);
  };
  w.TextEncoder = TextEncoder;
  Object.defineProperty(w, 'crypto', {
    value: {
      subtle: {
        async digest(...args) {
          if (gate) await gate;
          return crypto.subtle.digest(...args);
        },
      },
    },
  });
  w.el = html => {
    const t = w.document.createElement('template');
    t.innerHTML = html;
    return t.content.firstElementChild;
  };
  w.esc = x => String(x).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  w.topbar = () => w.el('<header>MCAT</header>');
  w.sectionUrl = () => '/mcat';
  w.setView = root => w.document.querySelector('#app').replaceChildren(root);
  w.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  const blobs = new Map(),
    downloads = [],
    errors = [];
  w.Blob = class {
    constructor(parts) {
      this.text = parts.join('');
    }
  };
  w.URL.createObjectURL = b => {
    const key = 'blob:test-' + blobs.size;
    blobs.set(key, b.text);
    return key;
  };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () {
    downloads.push(blobs.get(this.href));
  };
  w.addEventListener('error', e => {
    errors.push(e.error);
    e.preventDefault();
  });
  const run = code => vm.runInContext(code, ctx);
  for (const file of ['study-storage.js', 'mcat-item-quality-core.js', 'mcat-item-quality.js'])
    run(fs.readFileSync(file, 'utf8'));
  const find = s => w.document.querySelector(s),
    click = s => {
      const n = find(s);
      assert.ok(n, s);
      n.click();
      assert.equal(errors.length, 0, errors[0]?.stack);
    },
    input = (s, value) => {
      const n = find(s);
      assert.ok(n, s);
      if (n.type === 'checkbox') n.checked = value;
      else n.value = value;
      n.dispatchEvent(new w.Event(n.tagName === 'TEXTAREA' ? 'input' : 'change', { bubbles: true }));
    };
  return {
    w,
    run,
    find,
    click,
    input,
    downloads,
    render: () => w.McatItemQuality.render(),
    raw: k => storage.getItem(k),
    state: () => JSON.parse(storage.getItem(Core.KEY) || 'null'),
    force: (k, v) => storage.setItem(k, v),
    set fail(v) {
      fail = v;
    },
    set gate(v) {
      gate = v;
    },
    async until(fn) {
      const end = Date.now() + 2000;
      while (!fn() && Date.now() < end) await new Promise(r => setTimeout(r, 5));
      assert.ok(fn(), 'Async quality view did not settle');
    },
    close() {
      engine.stop();
      dom.window.close();
    },
  };
}
test('the MCAT quality route opens saved evidence without course downloads or progress writes', async () => {
  const h = harness(),
    before = h.raw(SOURCE);
  h.run(fs.readFileSync('mcat.js', 'utf8'));
  h.w.coursePauseTools = () => {};
  h.w.loadMCAT = () => {
    throw Error('Unexpected catalog request');
  };
  await h.w.renderMCATEntry();
  assert.equal(h.state(), null);
  assert.equal(h.raw(SOURCE), before);
  assert.equal(h.find('main img'), null);
  assert.match(h.find('#quality-body').textContent, /1 retained response records/);
  h.close();
});
test('concerns save exact wording privately and the explicit export excludes accounts and unfinished drafts', async () => {
  const h = harness();
  await h.render();
  h.input('[data-note]', 'Both options seem possible because of the scope.');
  h.click('[data-report]');
  await h.until(() => h.find('#quality-reports article'));
  assert.equal(h.state().reports.length, 1);
  assert.equal(h.state().reports[0].item.question.stem, row.questionSnapshot.stem);
  assert.equal(h.state().reports[0].resolution, null);
  h.input('[data-note]', 'UNFINISHED_DRAFT');
  h.click('#quality-export');
  const exact = h.find('.quality-export pre').textContent;
  assert.ok(!exact.includes('UNFINISHED_DRAFT'));
  assert.ok(!exact.includes('SECRET_ACCOUNT'));
  h.click('[data-download]');
  assert.equal(h.downloads.length, 0);
  h.input('[data-reviewed]', true);
  h.click('[data-download]');
  assert.equal(h.downloads[0], exact);
  assert.match(h.find('#quality-status').textContent, /No report has been submitted/);
  h.close();
});
test('save failures retain concern drafts and queued reports, with no false saved-report display', async () => {
  const h = harness();
  await h.render();
  h.fail = true;
  h.input('[data-note]', 'Unsaved concern');
  assert.equal(h.state(), null);
  assert.ok(h.find('#study-save-conflict'));
  h.fail = false;
  h.run('StudyStorage.retry()');
  await h.until(() => h.find('[data-report]') && !h.find('[data-report]').disabled);
  h.fail = true;
  h.click('[data-report]');
  assert.equal(h.state().reports.length, 0);
  assert.equal(h.find('#quality-reports article'), null);
  h.fail = false;
  h.run('StudyStorage.retry()');
  await h.until(() => h.find('#quality-reports article'));
  assert.equal(h.state().reports.length, 1);
  assert.equal(h.state().reports[0].note, 'Unsaved concern');
  h.close();
});
test('source changes during asynchronous hashing reject the stale summary', async () => {
  const h = harness();
  let release;
  h.gate = new Promise(r => {
    release = r;
  });
  const pending = h.render();
  h.force(SOURCE, JSON.stringify({ units: {} }));
  release();
  await pending;
  assert.match(h.find('#quality-status').textContent, /changed while/);
  assert.equal(h.find('#quality-export'), null);
  h.close();
});
test('account changes, source changes and canceled previews prevent stale downloads', async () => {
  for (const kind of ['account', 'source', 'cancel']) {
    const h = harness();
    await h.render();
    h.click('#quality-export');
    h.input('[data-reviewed]', true);
    const button = h.find('[data-download]');
    if (kind === 'account') h.force(Progress.OWNER, JSON.stringify({ id: 'B', token: 'new-owner' }));
    else if (kind === 'source') h.force(SOURCE, JSON.stringify({ units: {} }));
    else h.click('[data-cancel]');
    button.click();
    assert.equal(h.downloads.length, 0, kind);
    h.close();
  }
});
test('malformed saved reports remain recoverable and empty workspaces do not invent sample outcomes', async () => {
  const raw = JSON.stringify({ version: 99 }),
    bad = harness({ [Core.KEY]: raw });
  await bad.render();
  assert.equal(bad.raw(Core.KEY), raw);
  assert.ok(bad.find('#study-save-conflict'));
  bad.close();
  const h = harness({});
  await h.render();
  assert.match(h.find('#quality-items').textContent, /No sample data or learner outcomes/);
  h.click('#quality-export');
  assert.equal(JSON.parse(h.find('.quality-export pre').textContent).summary.groups.length, 0);
  h.close();
});
test('a saved concern with changed wording is retained for recovery, while unknown imported fields never enter exports', async () => {
  const h = harness();
  await h.render();
  h.input('[data-note]', 'Review this exact wording');
  h.click('[data-report]');
  await h.until(() => h.find('#quality-reports article'));
  const saved = h.state();
  saved.reports[0].privateExtra = 'SECRET_EXTRA';
  saved.reports[0].item.context = { unknown: 'SECRET_CONTEXT' };
  const clean = harness({ [SOURCE]: h.raw(SOURCE), [Core.KEY]: JSON.stringify(saved) });
  await clean.render();
  clean.click('#quality-export');
  const output = clean.find('.quality-export pre').textContent;
  assert.ok(!output.includes('SECRET_EXTRA'));
  assert.ok(!output.includes('SECRET_CONTEXT'));
  clean.close();
  saved.reports[0].item.question.stem = 'Changed after report';
  const raw = JSON.stringify(saved),
    bad = harness({ [Core.KEY]: raw });
  await bad.render();
  assert.equal(bad.raw(Core.KEY), raw);
  assert.ok(bad.find('#study-save-conflict'));
  assert.match(bad.find('#quality-status').textContent, /fingerprint/);
  bad.close();
  h.close();
});
