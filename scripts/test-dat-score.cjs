// DAT score layer (dat-score-core.js, dat-progress.js, data/dat-score-tables.json). The DESIGN §5
// cases, the ADA table transcription, monotonic estimates on the 10-point grid, rolling counts
// that leave review re-asks out, and the progress page rendering from a synthetic log.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const Score = require('../dat-score-core.js');

const tables = JSON.parse(fs.readFileSync('data/dat-score-tables.json', 'utf8'));
Score.load(tables);
const GRID = new Set(Array.from({ length: 41 }, (_, i) => 200 + i * 10));

test('the DESIGN §5 examples', () => {
  assert.equal(Score.estimate('bio', 26, 40).scaled, 410);
  const pat = Score.estimate('pat', 61, 90);
  assert.equal(pat.scaled, 420);
  assert.equal(pat.low, 400);
  assert.equal(pat.high, 440);
  assert.deepEqual(pat.band, [400, 440]);
  assert.equal(pat.percentile, 65);
  assert.equal(pat.oldScale, 19);
  assert.equal(pat.old, 19);
  assert.equal(Score.academicAverage({ qr: 400, rc: 430, bio: 410, gchem: 390, ochem: 420 }), 410);
  assert.equal(Score.totalScience({ qr: 400, rc: 430, bio: 410, gchem: 390, ochem: 420 }), 410);
  assert.equal(Score.academicAverage({ qr: 400, rc: 430, bio: 410, gchem: 390 }), null);
  assert.equal(Score.academicAverage({ qr: 400, rc: 430, bio: 410, gchem: 390, ochem: 420, pat: 200 }), 410);
  assert.equal(Score.round10(343), 340);
  assert.equal(Score.round10(345), 350);
  assert.equal(Score.oldScale('aa', 390), 18);
  assert.equal(Score.oldScale('aa', 415), 19);
  assert.equal(Score.oldScale('aa', 300), 13, 'Academic Average reaches below 15 through aaLow');
  assert.equal(Score.oldScale('rc', 290), null);
  assert.equal(Score.percentile('aa', 395), 47);
  assert.equal(Score.percentile('qr', 460), 85, 'the ADA worked example');
  const few = Score.estimate('qr', 10, 14);
  assert.equal(few.scaled, null);
  assert.equal(few.note, 'Too few items for an estimate.');
});

test('the display line carries band, percentile and the 1-30 comparison', () => {
  assert.equal(
    Score.describe('PAT', Score.estimate('pat', 61, 90)),
    'PAT 61/90 · est. 420 (band 400–440) · about the 65th percentile (ADA Table 2, Jan 2025; the 2025 cohort ran 5–7 points lower) · ≈ 19 on the pre-2025 1–30 scale (ADA concordance)'
  );
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 62, 100].map(Score.ordinal), [
    '1st',
    '2nd',
    '3rd',
    '4th',
    '11th',
    '12th',
    '13th',
    '21st',
    '62nd',
    '100th',
  ]);
});

test('estimates never fall as correct answers rise, and always land on the grid', () => {
  for (const section of Score.SECTIONS)
    for (const total of [30, 40, 50, 90, 100]) {
      let last = -Infinity;
      for (let correct = 0; correct <= total; correct++) {
        const est = Score.estimate(section, correct, total);
        assert.ok(GRID.has(est.scaled), `${section} ${correct}/${total} → ${est.scaled}`);
        assert.ok(est.scaled >= last, `${section} ${correct}/${total} fell`);
        assert.ok(est.low >= 200 && est.high <= 600 && est.low <= est.scaled && est.scaled <= est.high);
        last = est.scaled;
      }
    }
});

test('the tables: anchors increase, columns never fall, and Table 1 matches RESEARCH §6.3', () => {
  for (let i = 1; i < tables.rawAnchors.length; i++) {
    assert.ok(tables.rawAnchors[i][0] > tables.rawAnchors[i - 1][0]);
    assert.ok(tables.rawAnchors[i][1] > tables.rawAnchors[i - 1][1]);
  }
  const conc = tables.concordance;
  assert.deepEqual(
    conc.old,
    Array.from({ length: 16 }, (_, i) => 15 + i)
  );
  for (const kind of ['aa', 'ts', 'bio', 'gchem', 'ochem', 'pat', 'qr', 'rc']) {
    assert.equal(conc[kind].length, 16, kind);
    for (let i = 1; i < 16; i++) assert.ok(conc[kind][i] >= conc[kind][i - 1], `concordance ${kind} row ${i}`);
    const col = Object.entries(tables.percentiles[kind]).map(([s, p]) => [Number(s), p]);
    assert.equal(col.length, 41, `percentiles ${kind} cover 200-600`);
    col.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < col.length; i++) assert.ok(col[i][1] >= col[i - 1][1], `percentile ${kind} at ${col[i][0]}`);
  }
  assert.deepEqual(conc.aa, [330, 350, 370, 390, 410, 420, 440, 460, 470, 490, 510, 520, 540, 560, 580, 600]);
  assert.deepEqual(conc.rc, [300, 320, 340, 360, 370, 390, 410, 430, 450, 470, 490, 510, 550, 550, 560, 580]);
  assert.deepEqual(conc.aaLow, { 10: 250, 11: 260, 12: 270, 13: 290, 14: 310 });
  // Spot rows from RESEARCH §6.4.
  assert.equal(tables.percentiles.aa['400'], 54);
  assert.equal(tables.percentiles.pat['300'], 8);
  assert.equal(tables.percentiles.rc['390'], 49);
  assert.equal(tables.percentiles.gchem['500'], 94);
});

test('rolling counts take the last 60 per section and skip review re-asks', () => {
  const log = [];
  for (let i = 0; i < 80; i++) log.push({ section: 'bio', correct: i >= 20, ms: 50000, source: 'drill' });
  for (let i = 0; i < 5; i++) log.push({ section: 'bio', correct: false, ms: 1000, source: 'review' });
  log.push({ section: 'qr', correct: true, ms: null, source: 'qr' }, { section: 'nope', correct: true }, null);
  const r = Score.rolling(log);
  assert.deepEqual(r.bio, { correct: 60, total: 60, ms: 3000000, timed: 60 });
  assert.deepEqual(r.qr, { correct: 1, total: 1, ms: 0, timed: 0 });
  assert.equal(r.nope, undefined);
});

test('the disclaimer says what it is and the pages that estimate print it', () => {
  assert.match(Score.DISCLAIMER, /not an official ADA score/);
  assert.match(fs.readFileSync('dat-progress.js', 'utf8'), /DISCLAIMER/);
});

function progressPage(log, srs = {}) {
  const dom = new JSDOM('<!doctype html><div id="app"></div>', {
    url: 'http://localhost/dat?view=progress',
    runScripts: 'outside-only',
  });
  const w = dom.window;
  const store = new Map([
    ['cs-dat-log', JSON.stringify(log)],
    ['cs-dat-srs', JSON.stringify(srs)],
  ]);
  Object.assign(w, {
    DAT: {
      attemptStores: null,
      scoreTables: tables,
      outline: JSON.parse(fs.readFileSync('data/dat-outline.json', 'utf8')),
      pat: { subtests: [{ id: 'angles', alias: 'Angle ranking' }] },
    },
    StudyStorage: { read: (key, fallback) => (store.has(key) ? JSON.parse(store.get(key)) : fallback) },
    el(html) {
      const node = w.document.createElement('template');
      node.innerHTML = html.trim();
      return node.content.firstElementChild;
    },
    esc: value =>
      String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;'),
    datUrl: (params = {}) => '/dat?' + new w.URLSearchParams(params).toString(),
    datView(main) {
      w.document.querySelector('#app').replaceChildren(main);
    },
    datDataNotice() {},
  });
  const context = dom.getInternalVMContext();
  vm.runInContext(fs.readFileSync('dat-score-core.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('dat-progress.js', 'utf8'), context);
  w.DatProgress.render();
  return { w, close: () => w.close() };
}

test('the progress page shows six estimates, AA and TS, PAT by level, and "too few items"', () => {
  const rows = [];
  const add = (section, n, correct, extra = {}) => {
    for (let i = 0; i < n; i++)
      rows.push(Object.assign({ section, correct: i < correct, ms: 40000, source: 'drill' }, extra));
  };
  add('bio', 40, 26);
  add('gchem', 30, 20);
  add('ochem', 30, 20);
  add('qr', 40, 26);
  add('rc', 40, 26);
  add('pat', 30, 20, { subtest: 'angles', level: 2, source: 'pat' });
  const page = progressPage(rows, { a: { due: 0 }, b: { due: Date.now() + 1e9 } });
  const doc = page.w.document;
  const estimates = [...doc.querySelectorAll('.dat-progress-table tbody tr')].map(tr => tr.children[1].textContent);
  assert.equal(estimates.length, 6);
  for (const cell of estimates) assert.match(cell, /^\d{3} \d{3}–\d{3}$/);
  assert.match(doc.querySelector('#dat-progress-aa').textContent, /^\d{3}$/);
  assert.match(doc.querySelector('#dat-progress-ts').textContent, /^\d{3}$/);
  assert.match(doc.querySelector('[data-dat-subtest="angles"]').textContent, /Angle ranking.*67%.*20\/30/);
  assert.match(doc.body.textContent, /not an official ADA score/);
  assert.equal(doc.querySelector('#dat-progress-due').textContent, '1', 'no DatDrillCore: counted from due times');
  page.close();

  const thin = progressPage(
    rows.filter(r => r.section !== 'qr').concat([{ section: 'qr', correct: true, source: 'qr' }])
  );
  const qr = thin.w.document.querySelector('[data-dat-section="qr"]').textContent;
  assert.match(qr, /too few items \(1\/15\)/);
  assert.match(thin.w.document.querySelector('[data-dat-composite="aa"]').textContent, /Needs an estimate in QR/);
  assert.ok(thin.w.document.querySelector('#dat-progress-ts'), 'TS does not need QR');
  thin.close();
});
