// Drives checkDatBanks() over inline fixtures and asserts the exact reason code per rule
// class (DECISIONS-NUMERIC §N3), plus minimumFor() and the option-policy resolver.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkDatBanks, minimumFor, policyKey, REASONS } = require('./check-dat-banks.cjs');
const { outline } = require('./dat-data.cjs');

const SOURCE = { title: 'OpenStax Biology 2e', url: 'https://openstax.org/books/biology-2e' };
let n = 0;
function item(overrides = {}) {
  n++;
  const base = {
    id: 'bio-cell-' + n,
    section: 'bio',
    category: 'BIO-1',
    topic: 'Cell structure and function',
    skill: 'skill-1',
    difficulty: ['easy', 'medium', 'hard'][n % 3],
    format: 'standard',
    stem: `Which organelle is the primary site of ATP synthesis in a eukaryotic cell, case ${n}?`,
    options: ['Mitochondrion', 'Ribosome', 'Lysosome', 'Golgi apparatus', 'Nucleolus'],
    answer: 0,
    explanation:
      'Oxidative phosphorylation runs on the inner mitochondrial membrane; ribosomes build protein and do not make ATP.',
    distractors: [
      { i: 1, why: 'Ribosomes consume ATP to make protein.' },
      { i: 2, why: 'Lysosomes digest; they do not phosphorylate ADP.' },
      { i: 3, why: 'The Golgi modifies and sorts proteins.' },
      { i: 4, why: 'The nucleolus assembles ribosomal subunits.', weakest: true },
    ],
    provenance: { origin: 'new', source: SOURCE, reviewStatus: 'author-checked', sourceCheckedOn: '2026-09-16' },
  };
  return { ...base, ...overrides };
}
function fragment(items, overrides = {}) {
  return {
    file: 'data/dat-questions-bio-1.json',
    data: { format: 'dat-bank', version: 1, section: 'bio', layer: 1, items, ...overrides },
  };
}
const reasons = report => [...report.errors, ...report.warnings].map(f => f.reason);
const qc = (overrides = {}) => {
  const answer = overrides.answer ?? 3;
  return item({
    id: 'qr-qc-' + n,
    section: 'qr',
    category: 'QR-3',
    topic: 'Two-quantity comparison',
    format: 'qc',
    common: 'x is an integer and 2 < x < 6.',
    quantityA: 'x² − 5x',
    quantityB: '0',
    stem: 'Compare Quantity A and Quantity B.',
    options: outline.optionPolicy.qc.canonical,
    answer: 3,
    explanation: 'x ∈ {3, 4, 5} gives −6, −4 and 0, so Quantity A is sometimes less than and sometimes equal to 0.',
    worked: { values: { x: [3, 4, 5] }, workedCheckedOn: '2026-09-16' },
    distractors: [0, 1, 2, 3].filter(i => i !== answer).map(i => ({ i, why: `Option ${i} misreads the range of x.` })),
    ...overrides,
  });
};
const qrFragment = items => ({
  file: 'data/dat-questions-qr-1.json',
  data: { format: 'dat-bank', version: 1, section: 'qr', layer: 1, items },
});

test('a valid five-option science item and a valid QC item pass with no findings', () => {
  const report = checkDatBanks(outline, [fragment([item()]), qrFragment([qc()])]);
  assert.deepEqual(reasons(report), []);
  assert.equal(report.ok, true);
  assert.equal(report.inventory.bySection.bio.items, 1);
  assert.equal(report.inventory.byFormat.qc, 1);
  assert.match(report.table, /BIO-1\s+1/);
});

test('every reason code is either an error or a warning and the named codes fire on the named faults', () => {
  for (const level of Object.values(REASONS)) assert.ok(['error', 'warning'].includes(level));
  const cases = [
    ['TOPIC_NOT_IN_CATEGORY', fragment([item({ topic: 'Fungi' })])],
    [
      'OPTION_COUNT',
      fragment([
        item({
          options: ['A', 'B', 'C', 'D'],
          distractors: [
            { i: 1, why: 'x' },
            { i: 2, why: 'x' },
            { i: 3, why: 'x', weakest: true },
          ],
        }),
      ]),
    ],
    ['VENDOR_TOKEN', fragment([item({ stem: 'As taught in a Kaplan course, which organelle makes ATP?' })])],
    ['MISSING_WORKED', qrFragment([qc({ worked: undefined })])],
    [
      'CANONICAL_OPTIONS',
      qrFragment([qc({ options: ['A is greater', 'B is greater', 'Equal', 'Cannot be determined'] })]),
    ],
    ['DISPLAY_ORDER_FORBIDDEN', qrFragment([qc({ displayOrder: [0, 1, 2, 3] })])],
    ['UNKNOWN_CATEGORY', fragment([item({ category: 'BIO-9' })])],
    ['SECTION_MISMATCH', fragment([item({ category: 'GC-1', topic: 'Molar mass' })])],
    ['UNKNOWN_SKILL', fragment([item({ skill: 'skill-9' })])],
    ['ANSWER_RANGE', fragment([item({ answer: 5 })])],
    ['EXPLANATION_SHORT', fragment([item({ explanation: 'Too short.' })])],
    [
      'DISTRACTOR_COVERAGE',
      fragment([
        item({
          distractors: [
            { i: 1, why: 'x' },
            { i: 2, why: 'x' },
            { i: 3, why: 'x', weakest: true },
          ],
        }),
      ]),
    ],
    [
      'WEAKEST_TAG',
      fragment([
        item({
          distractors: [
            { i: 1, why: 'x', weakest: true },
            { i: 2, why: 'x', weakest: true },
            { i: 3, why: 'x' },
            { i: 4, why: 'x' },
          ],
        }),
      ]),
    ],
    [
      'WEAKEST_TAG',
      qrFragment([
        qc({
          distractors: [
            { i: 0, why: 'x', weakest: true },
            { i: 1, why: 'x' },
            { i: 2, why: 'x' },
          ],
        }),
      ]),
    ],
    ['ID_FORMAT', fragment([item({ id: 'Bad Id!' })])],
    ['FIGURE_INVALID', fragment([item({ figure: '<svg><script>alert(1)</script></svg>' })])],
    [
      'SOURCE_URL',
      fragment([
        item({
          provenance: {
            origin: 'new',
            source: { title: 'x', url: 'http://example.org' },
            reviewStatus: 'author-checked',
            sourceCheckedOn: '2026-09-16',
          },
        }),
      ]),
    ],
    ['SUSPECT_TERM', fragment([item({ stem: 'Deficiency of ADA impairs which cell line?' })])],
    [
      'BANK_SHAPE',
      {
        file: 'data/dat-questions-bio-2.json',
        data: { format: 'dat-bank', version: 1, section: 'bio', layer: 1, items: [] },
      },
    ],
  ];
  for (const [code, frag] of cases) {
    const report = checkDatBanks(outline, [frag]);
    assert.ok(reasons(report).includes(code), `${code} expected, got ${JSON.stringify(reasons(report))}`);
    assert.equal(report.ok, REASONS[code] === 'warning', code + ' ok flag');
  }
});

test('DUP_ID and DUPLICATE_STEM fire across fragments, not just within one', () => {
  const a = item(),
    b = item({ id: a.id, stem: 'A different stem about the same organelle and its role in respiration.' }),
    c = item({ stem: a.stem.toUpperCase() + '!!' });
  const report = checkDatBanks(outline, [
    fragment([a]),
    {
      file: 'data/dat-questions-bio-2.json',
      data: { format: 'dat-bank', version: 1, section: 'bio', layer: 2, items: [b, c] },
    },
  ]);
  assert.ok(reasons(report).includes('DUP_ID'));
  assert.ok(reasons(report).includes('DUPLICATE_STEM'));
});

test('lexicalExceptions clears a legitimate ambiguous term and an unused exception is itself a warning', () => {
  const clean = checkDatBanks(outline, [
    fragment([item({ stem: 'Deficiency of ADA impairs which cell line?' })], { lexicalExceptions: ['ADA'] }),
  ]);
  assert.deepEqual(reasons(clean), []);
  const stale = checkDatBanks(outline, [fragment([item()], { lexicalExceptions: ['Booster'] })]);
  assert.deepEqual(reasons(stale), ['SUSPECT_TERM']);
  assert.match(stale.warnings[0].message, /no item text matches/);
  const cracking = checkDatBanks(outline, [
    fragment([item({ stem: 'Catalytic cracking of alkanes yields which products?' })]),
  ]);
  assert.deepEqual(reasons(cracking), ['SUSPECT_TERM']);
  assert.equal(cracking.ok, true, 'warnings alone leave ok true outside --strict');
});

test('distributional warnings fire only once a fragment has 20 items', () => {
  const skewed = Array.from({ length: 20 }, (_, i) =>
    item({
      answer: 0,
      difficulty: 'medium',
      stem: `Distinct stem number ${i} about mitochondria and ATP synthesis in eukaryotes.`,
    })
  );
  const report = checkDatBanks(outline, [fragment(skewed)]);
  assert.ok(reasons(report).includes('ANSWER_BALANCE'));
  assert.ok(reasons(report).includes('DIFFICULTY_MIX'));
  assert.equal(report.errors.length, 0);
  const small = checkDatBanks(outline, [fragment(skewed.slice(0, 19))]);
  assert.deepEqual(reasons(small), []);
  const strict = checkDatBanks(outline, [fragment(skewed)], { strict: true });
  assert.equal(strict.ok, false, '--strict fails on warnings');
});

test('worked values that contradict a QC answer warn; consistent values and unevaluable expressions do not', () => {
  const wrong = checkDatBanks(outline, [
    qrFragment([
      qc({
        quantityA: 'x + 1',
        quantityB: 'x',
        worked: { values: { x: [1, 2] }, workedCheckedOn: '2026-09-16' },
        answer: 1,
        distractors: [
          { i: 0, why: 'x' },
          { i: 2, why: 'x' },
          { i: 3, why: 'x' },
        ],
      }),
    ]),
  ]);
  assert.deepEqual(reasons(wrong), ['WORKED_MISMATCH']);
  assert.equal(wrong.warnings[0].have, 0);
  const right = checkDatBanks(outline, [
    qrFragment([
      qc({
        quantityA: 'x + 1',
        quantityB: 'x',
        worked: { values: { x: [1, 2] }, workedCheckedOn: '2026-09-16' },
        answer: 0,
      }),
    ]),
  ]);
  assert.deepEqual(reasons(right), []);
  const prose = checkDatBanks(outline, [
    qrFragment([
      qc({
        quantityA: 'the number of primes below 10',
        quantityB: '4',
        worked: { values: { primes: 4 }, workedCheckedOn: '2026-09-16' },
        answer: 2,
      }),
    ]),
  ]);
  assert.deepEqual(reasons(prose), []);
});

test('minimumFor floors the per-category target and returns null for ungated categories', () => {
  assert.equal(minimumFor(outline, 'BIO-1', 1), 14);
  assert.equal(minimumFor(outline, 'GC-1', 1), 4);
  assert.equal(minimumFor(outline, 'GC-3', 1), 4);
  assert.equal(minimumFor(outline, 'GC-2', 1), 3);
  assert.equal(minimumFor(outline, 'GC-12', 1), 2);
  assert.equal(minimumFor(outline, 'BIO-1', 3), 35);
  assert.equal(minimumFor(outline, 'RC-1', 1), null);
  assert.equal(minimumFor(outline, 'PAT-ANG', 1), null);
  const cats = outline.concepts.flatMap(c => c.categories.map(x => x.id)).filter(id => !/^(RC|PAT)-/.test(id));
  const total = layer => cats.reduce((s, id) => s + minimumFor(outline, id, layer), 0);
  assert.equal(total(1), 216, 'layer 1 is 216 items (164 SNS + 52 QR)');
  assert.equal(total(3), 550);
});

test('the strict layer gate counts cumulatively per category and reports shortfalls', () => {
  const report = checkDatBanks(
    outline,
    [fragment([item(), item({ category: 'BIO-2', topic: 'Fungi', id: 'bio-diversity-1' })])],
    { strict: true, layer: 1, section: 'bio' }
  );
  assert.equal(report.ok, false);
  assert.equal(report.gate.layer, 1);
  assert.equal(report.gate.minima['BIO-1'], 14);
  assert.equal(report.gate.counts['BIO-1'], 1);
  assert.equal(report.gate.shortfalls.length, 5);
  assert.equal(report.errors.filter(f => f.reason === 'LAYER_SHORTFALL').length, 5);
  assert.equal(
    report.warnings.some(f => f.reason === 'THIN_TOPIC'),
    false,
    'topic coverage is not judged at layer 1'
  );
  const complete = checkDatBanks(outline, [fragment([item()])], { layer: 3, section: 'bio' });
  assert.ok(
    complete.warnings.some(f => f.reason === 'THIN_TOPIC'),
    'THIN_TOPIC fires at the complete layer'
  );
  assert.match(report.table, /BIO-3\s+0\s+16\s+SHORT/);
  const loose = checkDatBanks(outline, [fragment([item()])], { layer: 1, section: 'bio' });
  assert.equal(loose.errors.length, 0, 'without --strict the gate is reported, not enforced');
  assert.equal(loose.gate.shortfalls.length, 5);
});

test('policyKey resolves science sections through the sns block and QC/DS by format', () => {
  assert.equal(policyKey(outline, { section: 'bio', format: 'standard' }), 'sns');
  assert.equal(policyKey(outline, { section: 'ochem' }), 'sns');
  assert.equal(policyKey(outline, { section: 'qr', format: 'standard' }), 'qr');
  assert.equal(policyKey(outline, { section: 'qr', format: 'data' }), 'qr');
  assert.equal(policyKey(outline, { section: 'qr', format: 'qc' }), 'qc');
  assert.equal(policyKey(outline, { section: 'qr', format: 'ds' }), 'ds');
  assert.equal(policyKey(outline, { section: 'rc' }), 'rc');
  assert.equal(policyKey(outline, { section: 'dental' }), undefined);
});
