/* Storage safety for the generated PAT records (DAT-04, DESIGN §9 risk 5).
   study-backup.js refuses any value containing markup (study-backup.js:101-110; safeMarkup's
   allow-list has no SVG), so a single figure string reaching cs-dat-log, cs-dat-srs or
   cs-dat-r-pat would make the learner's whole workspace unexportable. This suite runs the real
   dat-pat.js runner in jsdom, answers a whole 15-item set, then round-trips everything it wrote
   through StudyBackup.create/parse and asserts no "<" of any kind reaches the file. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const crypto = require('node:crypto').webcrypto;
const Backup = require('../study-backup.js');
const Core = require('../dat-pat-engine.js');

const ROOT = path.join(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', name + '.json'), 'utf8'));
const options = { crypto, now: '2026-09-16T12:00:00.000Z' };

function harness(search) {
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', {
    url: 'http://localhost/dat' + search,
    runScripts: 'outside-only',
  });
  const w = dom.window,
    ctx = dom.getInternalVMContext();
  const store = {};
  w.LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  w.esc = value =>
    String(value).replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  w.el = html => {
    const template = w.document.createElement('template');
    template.innerHTML = String(html).trim();
    return template.content.firstElementChild;
  };
  w.datUrl = (params = {}) => {
    const query = new w.URLSearchParams(Object.entries(params).filter(([, v]) => v != null)).toString();
    return '/dat' + (query ? '?' + query : '');
  };
  w.datView = main => w.document.getElementById('app').replaceChildren(main);
  w.datDataNotice = () => {};
  w.StudyStorage = {
    read: (key, fallback) => (key in store ? JSON.parse(store[key]) : fallback),
    write: (key, value) => {
      store[key] = JSON.stringify(value);
      return true;
    },
    remove: key => {
      delete store[key];
      return true;
    },
    watch: () => {},
  };
  w.DAT = {
    pausers: [],
    loaded: true,
    outline: read('dat-outline'),
    pat: read('dat-pat'),
    course: null,
    questions: [],
    cards: [],
    rc: null,
    repairs: null,
    rehearsals: null,
    scoreTables: null,
  };
  // dat-drill-engine.js first, exactly as SECTION_SCRIPTS.dat loads it in app.js: dat-pat.js's
  // enrol() ages a PAT miss through the shared DatDrillCore scheduler, so the harness needs it.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'dat-drill-engine.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'dat-pat-engine.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'dat-pat.js'), 'utf8'), ctx);
  return { dom, w, store };
}
function answerItem(w, position) {
  const option = w.document.querySelector('#dat-pat-opt-' + position);
  assert.ok(option, 'an option button is on screen');
  option.click();
  const next = w.document.querySelector('#dat-pat-next');
  assert.ok(next, 'the continue button appears after answering');
  next.click();
}

test('a full PAT set writes only ids, the regeneration triple and answers — never markup', () => {
  const { dom, w, store } = harness('?view=pat&subtest=holes&level=2');
  w.DatPat.render();
  assert.ok(w.document.querySelector('.dat-pat-run'), 'the runner rendered');
  assert.ok(w.document.querySelector('.dat-pat-figure svg'), 'the figure is drawn as live SVG');

  // Mid-set: the resume blob must already exist and must be markup-free.
  answerItem(w, 0);
  answerItem(w, 1);
  const resume = JSON.parse(store['cs-dat-r-pat']);
  assert.equal(resume.subtest, 'holes');
  assert.equal(resume.level, 2);
  assert.equal(resume.ids.length, 15);
  assert.equal(resume.idx, 2);
  assert.doesNotMatch(store['cs-dat-r-pat'], /</, 'the resume blob carries no markup');
  for (const id of resume.ids) assert.ok(Core.fromId(id), id + ' regenerates from the resume blob alone');
  assert.equal(resume.results.filter(Boolean).length, 2, 'only answered slots are recorded');
  for (const result of resume.results.filter(Boolean))
    assert.deepEqual(Object.keys(result).sort(), ['conf', 'correct', 'ms', 'picked']);

  for (let i = 2; i < 15; i++) answerItem(w, i % 5);
  assert.ok(w.document.querySelector('.dat-pat-review'), 'the review page rendered');
  assert.equal(store['cs-dat-r-pat'], undefined, 'the resume blob is cleared when the set finishes');

  // Add-to-mistake-log writes the triple, not the figure.
  const enrol = w.document.querySelector('[data-dat-enrol]');
  assert.ok(enrol, 'the review offers an add-to-mistake-log button');
  enrol.click();
  const srs = JSON.parse(store['cs-dat-srs']);
  const srsIds = Object.keys(srs);
  assert.ok(srsIds.length, 'the mistake log has entries');
  for (const id of srsIds) {
    const record = srs[id];
    assert.equal(record.section, 'pat', id);
    assert.equal(record.subtest, 'holes', id);
    assert.equal(record.category, 'PAT-HOLE', id);
    assert.equal(record.level, 2, id);
    assert.ok(Number.isInteger(record.seed), id + ' seed');
    assert.deepEqual(Core.fromId(id).params.pattern, Core.generate('holes', record.seed, record.level).params.pattern);
  }

  const log = JSON.parse(store['cs-dat-log']);
  assert.equal(log.length, 15, 'one row per answered item');
  for (const row of log) {
    assert.deepEqual(Object.keys(row).sort(), [
      'attemptId',
      'category',
      'conf',
      'correct',
      'level',
      'ms',
      'qId',
      'section',
      'seed',
      'source',
      'subtest',
      'topic',
      'ts',
    ]);
    assert.equal(row.section, 'pat');
    assert.equal(row.source, 'pat');
    assert.equal(row.subtest, 'holes');
    assert.equal(row.level, 2);
    assert.ok(Number.isInteger(row.seed));
    assert.equal(row.qId, Core.itemId(row.subtest, row.seed, row.level));
  }
  for (const [key, value] of Object.entries(store)) {
    assert.doesNotMatch(value, /<svg/i, key + ' carries no SVG');
    assert.doesNotMatch(value, /</, key + ' carries no markup at all');
  }
  w.DatPat.pause();
  dom.window.close();
});

test('everything a PAT set writes round-trips through a portable backup with no markup in the file', async () => {
  const { dom, w, store } = harness('?view=pat&subtest=angles&level=2');
  w.DatPat.render();
  for (let i = 0; i < 15; i++) answerItem(w, i % 4);
  const enrol = w.document.querySelector('[data-dat-enrol]');
  if (enrol) enrol.click();
  w.DatPat.pause();
  dom.window.close();

  // A half-finished set as well, so the resume blob is in the file too.
  const second = harness('?view=pat&subtest=cubes&level=3');
  second.w.DatPat.render();
  answerItem(second.w, 0);
  answerItem(second.w, 2);
  const data = Object.assign({}, store, { 'cs-dat-r-pat': second.store['cs-dat-r-pat'] });
  second.w.DatPat.pause();
  second.dom.window.close();

  assert.ok(data['cs-dat-log'] && data['cs-dat-q'] && data['cs-dat-srs'] && data['cs-dat-r-pat']);
  const text = await Backup.create(data, '2.31.0-local.1', options);
  assert.doesNotMatch(text, /<svg/i, 'no SVG reaches the exported file');
  assert.doesNotMatch(text, /</, 'no markup of any kind reaches the exported file');
  const file = await Backup.parse(text, options);
  assert.deepEqual(file.data, Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b))));
  // The triple survives the round-trip, which is the whole point: figures are regenerated.
  for (const row of JSON.parse(file.data['cs-dat-log']))
    assert.ok(Core.fromId(row.qId), row.qId + ' regenerates after a backup round-trip');
  for (const id of JSON.parse(file.data['cs-dat-r-pat']).ids)
    assert.ok(Core.fromId(id), id + ' regenerates after a backup round-trip');
});

test('a figure smuggled into a DAT record is refused by the backup, which is why none is stored', async () => {
  const item = Core.generate('holes', 4101, 2);
  const withFigure = JSON.stringify([{ qId: item.id, section: 'pat', figure: item.figure }]);
  await assert.rejects(
    Backup.create({ 'cs-dat-log': withFigure }, 'test', options),
    /HTML/,
    'an SVG in cs-dat-log blocks the whole export'
  );
  await assert.rejects(
    Backup.create({ 'cs-dat-r-pat': JSON.stringify({ figure: item.figure }) }, 'test', options),
    /HTML/,
    'an SVG in the resume blob blocks the whole export'
  );
  // The stripped record is what is safe to persist.
  await Backup.create({ 'cs-dat-r-pat': JSON.stringify(Core.strip(item)) }, 'test', options);
});
