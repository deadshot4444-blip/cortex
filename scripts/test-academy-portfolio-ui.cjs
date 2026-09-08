/* Real controller, StudyStorage and account boundary in jsdom; no browser claim. */
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm');
const { JSDOM } = require('jsdom'),
  Progress = require('../auth-progress.js'),
  Core = require('../academy-portfolio-core.js');
const SOURCE = 'cs-mcat-course-v1',
  original = {
    units: {
      unit1: {
        completedAt: 100,
        notes: '<img src=x onerror="alert(1)">Literal note',
        attempts: [
          {
            qId: 'q1',
            chosen: 0,
            correct: true,
            ts: 90,
            kind: 'check',
            questionSnapshot: { stem: 'Saved prompt', options: ['Chosen answer', 'Other answer'] },
          },
        ],
      },
      unit2: { completedAt: 200, notes: 'Unselected other lesson', attempts: [] },
    },
  };
function harness(
  seed = { [SOURCE]: JSON.stringify(original), 'sb-token': 'SECRET_TOKEN', 'cs-other-private': 'UNRELATED_PRIVATE' }
) {
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', {
      url: 'http://localhost/academy?view=portfolio',
      runScripts: 'outside-only',
    }),
    w = dom.window,
    ctx = dom.getInternalVMContext();
  const rawSet = w.Storage.prototype.setItem,
    rawGet = w.Storage.prototype.getItem,
    rawRemove = w.Storage.prototype.removeItem;
  for (const [key, value] of Object.entries(seed)) rawSet.call(w.localStorage, key, value);
  const storage = {
    get length() {
      return w.localStorage.length;
    },
    key: i => w.localStorage.key(i),
    getItem: k => rawGet.call(w.localStorage, k),
    setItem: (k, v) => rawSet.call(w.localStorage, k, v),
    removeItem: k => rawRemove.call(w.localStorage, k),
  };
  let failure = false;
  const engine = Progress.create({ storage });
  w.CortexProgress = Progress;
  w.Storage.prototype.setItem = function (key, value) {
    engine.beforeWrite(key);
    if (failure && key === Core.KEY) throw Error('Test quota');
    rawSet.call(this, key, value);
    engine.afterWrite(key);
  };
  w.CortexAccount = { available: true, snapshot: () => engine.portableSnapshot() };
  w.CortexAcademy = { tracks: Core.TRACKS.map(id => ({ id, name: id })) };
  w.el = html => {
    const t = w.document.createElement('template');
    t.innerHTML = html;
    return t.content.firstElementChild;
  };
  w.esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  w.sectionUrl = () => '/academy';
  w.topbar = () => w.el('<header>Academy</header>');
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
  w.URL.createObjectURL = blob => {
    const url = 'blob:test-' + blobs.size;
    blobs.set(url, blob.text);
    return url;
  };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () {
    downloads.push({ name: this.download, text: blobs.get(this.href) });
  };
  w.addEventListener('error', e => {
    errors.push(e.error);
    e.preventDefault();
  });
  const run = code => vm.runInContext(code, ctx);
  for (const file of ['study-storage.js', 'academy-portfolio-core.js', 'academy-portfolio.js'])
    run(fs.readFileSync(file, 'utf8'));
  const find = s => w.document.querySelector(s),
    click = s => {
      const n = find(s);
      assert.ok(n, 'Missing ' + s + ': ' + find('main')?.textContent.slice(-400));
      n.click();
      assert.equal(errors.length, 0, errors[0]?.stack);
    };
  const change = (s, value) => {
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
    change,
    downloads,
    errors,
    engine,
    render: () => w.AcademyPortfolio.render(),
    state: () => JSON.parse(storage.getItem(Core.KEY) || 'null'),
    raw: key => storage.getItem(key),
    force: (key, value) => storage.setItem(key, value),
    set fail(value) {
      failure = value;
    },
    snapshot: () =>
      Object.fromEntries(
        Array.from({ length: storage.length }, (_, i) => {
          const k = storage.key(i);
          return [k, storage.getItem(k)];
        })
      ),
    close() {
      engine.stop();
      dom.window.close();
    },
  };
}
const add = (h, id = 'unit1') => h.click(`[data-add="${SOURCE}/${id}"]`);
const prepare = h => {
  h.change('[data-select]', true);
  h.click('#portfolio-prepare');
};
test('opening is read-only; explicit additions retain source wording and reload without source writes', () => {
  const h = harness(),
    before = h.raw(SOURCE);
  h.render();
  assert.equal(h.state(), null);
  assert.equal(h.find('#portfolio-prepare').disabled, true);
  assert.equal(h.find('main img'), null, 'Learner HTML renders as literal text');
  add(h);
  assert.equal(h.state().entries.length, 1);
  assert.equal(h.raw(SOURCE), before);
  const reloaded = harness(h.snapshot());
  reloaded.render();
  assert.equal(reloaded.state().entries.length, 1);
  assert.match(reloaded.find('.portfolio-entry').textContent, /Literal note/);
  assert.equal(reloaded.find('[data-select]').checked, false);
  h.close();
  reloaded.close();
});
test('export preview starts unchecked and downloads exactly reviewed selected records, excluding drafts and account data', () => {
  const h = harness();
  h.render();
  add(h);
  h.change('[data-draft]', 'UNFINISHED_REFLECTION');
  prepare(h);
  const exact = h.find('.portfolio-export pre').textContent;
  assert.equal(h.find('[data-download]').disabled, true);
  h.click('[data-download]');
  assert.equal(h.downloads.length, 0);
  for (const value of ['SECRET_TOKEN', 'UNRELATED_PRIVATE', 'UNFINISHED_REFLECTION', 'Unselected other lesson'])
    assert.ok(!exact.includes(value));
  h.change('[data-reviewed]', true);
  h.click('[data-download]');
  assert.equal(h.downloads.length, 1);
  assert.equal(h.downloads[0].text, exact);
  assert.equal(JSON.parse(exact).entries.length, 1);
  const stale = h.find('[data-download]');
  h.click('[data-cancel]');
  stale.click();
  assert.equal(h.downloads.length, 1);
  h.close();
});
test('recorded reflections append separately; hide and restore retain work while clearing export selection', () => {
  const h = harness();
  h.render();
  add(h);
  const original = JSON.stringify(h.state().entries[0].source);
  h.change('[data-draft]', 'A later reconsideration');
  h.change('[data-help]', 'used');
  h.click('[data-revise]');
  assert.equal(h.state().entries[0].revisions[0].help, 'used');
  assert.equal(h.state().entries[0].draft, '');
  assert.equal(JSON.stringify(h.state().entries[0].source), original);
  h.click('[data-hide]');
  assert.equal(h.find('[data-select]'), null);
  assert.ok(h.state().entries[0].hiddenAt);
  h.click('[data-restore]');
  assert.equal(h.state().entries[0].hiddenAt, null);
  assert.equal(h.state().entries[0].revisions.length, 1);
  assert.equal(h.find('[data-select]').checked, false);
  h.close();
});
test('failed additions and reflection writes keep drafts and advance only after shared recovery', () => {
  const h = harness();
  h.render();
  h.fail = true;
  add(h);
  assert.equal(h.state(), null);
  assert.ok(h.find('#study-save-conflict'));
  assert.equal(h.find('.portfolio-entry'), null);
  h.fail = false;
  assert.equal(h.run('StudyStorage.retry()'), true);
  assert.equal(h.state().entries.length, 1);
  h.fail = true;
  h.change('[data-draft]', 'My unsaved portfolio draft');
  assert.equal(h.state().entries[0].draft, '');
  assert.equal(
    h.run(`StudyStorage.recovery().records['${Core.KEY}'].thisTab.entries[0].draft`),
    'My unsaved portfolio draft'
  );
  h.fail = false;
  assert.equal(h.run('StudyStorage.retry()'), true);
  assert.equal(h.find('[data-draft]').value, 'My unsaved portfolio draft');
  h.close();
});
test('source and portfolio changes after inspection refuse stale additions and exports', () => {
  const h = harness();
  h.render();
  const changed = JSON.parse(h.raw(SOURCE));
  changed.units.unit1.notes = 'Newer source';
  h.force(SOURCE, JSON.stringify(changed));
  add(h);
  assert.equal(h.state(), null);
  assert.match(h.find('#portfolio-status').textContent, /source changed/);
  h.render();
  add(h);
  prepare(h);
  h.change('[data-reviewed]', true);
  const next = h.state();
  next.entries[0].draft = 'Other-tab draft';
  h.force(Core.KEY, JSON.stringify(next));
  h.click('[data-download]');
  assert.equal(h.downloads.length, 0);
  assert.match(h.find('#portfolio-status').textContent, /changed in another tab/);
  assert.equal(h.state().entries[0].draft, 'Other-tab draft');
  h.close();
});
test('the real account boundary rejects an export after an owner switch even before a storage event', () => {
  const h = harness();
  h.render();
  add(h);
  prepare(h);
  h.change('[data-reviewed]', true);
  h.force(Progress.OWNER, JSON.stringify({ id: 'other', token: 'other-owner' }));
  h.force(SOURCE, JSON.stringify({ private: 'OTHER_ACCOUNT_SECRET' }));
  h.click('[data-download]');
  assert.equal(h.downloads.length, 0);
  assert.match(h.find('#portfolio-status').textContent, /workspace changed/);
  assert.ok(!h.find('main').textContent.includes('OTHER_ACCOUNT_SECRET'));
  h.close();
});
test('malformed portfolios are retained for recovery and navigation invalidates old download controls', () => {
  const malformed = JSON.stringify({ version: 99, entries: [] }),
    bad = harness({ [Core.KEY]: malformed });
  bad.render();
  assert.equal(bad.raw(Core.KEY), malformed);
  assert.ok(bad.find('#study-save-conflict'));
  assert.equal(bad.find('#portfolio-prepare'), null);
  bad.close();
  const h = harness();
  h.render();
  add(h);
  prepare(h);
  h.change('[data-reviewed]', true);
  const old = h.find('[data-download]');
  h.w.document.querySelector('#app').replaceChildren();
  old.click();
  assert.equal(h.downloads.length, 0);
  h.close();
});
