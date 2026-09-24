// Content contract for every data/dat-*.json: the six-key ROOT provenance block on every
// file, the registry half DAT-01 could not assert (every registered fragment exists, parses
// and agrees with its registry entry), and the per-record provenance for each file type.
// Singletons a later milestone creates (dat-pat, dat-score-tables) are skipped while absent.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const data = require('./dat-data.cjs');

const { outline, fragments } = data;
const ROOT_KEYS = ['authoredOn', 'author', 'reviewStatus', 'sourceCheckedOn', 'contentNote', 'sources'];
const SINGLETONS = ['dat-outline', 'dat-rc', 'dat-pat', 'dat-repairs', 'dat-rehearsals', 'dat-score-tables'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const categories = new Map(
  outline.concepts.flatMap(c => c.categories.map(cat => [cat.id, { ...cat, section: c.section }]))
);
const registered = [...fragments.course, ...fragments.cards, ...fragments.questions];

test('every registered fragment exists on disk, parses, and its ROOT agrees with its registry entry', () => {
  for (const f of registered) {
    assert.ok(fs.existsSync(f.file), f.file + ' exists');
    assert.ok(f.data && typeof f.data === 'object', f.file + ' parses');
    if (f.kind === 'course') {
      assert.equal(f.data.format, 'dat-course', f.file);
      assert.equal(f.data.chapter?.id, f.name.replace('dat-course-', ''), f.file + ' chapter id');
      assert.ok(outline.sections[f.data.chapter.section], f.file + ' chapter section');
      assert.ok(Array.isArray(f.data.units), f.file + ' units[]');
      assert.ok(typeof f.data.status === 'string' && f.data.status, f.file + ' status line');
    } else if (f.kind === 'cards') {
      assert.equal(f.data.format, 'dat-cards', f.file);
      assert.equal(f.data.chapter, f.name.replace('dat-cards-', ''), f.file + ' chapter');
      assert.ok(Array.isArray(f.data.cards), f.file + ' cards[]');
    } else {
      const [, section, layer] = /^dat-questions-([a-z]+)-(\d)$/.exec(f.name);
      assert.equal(f.data.format, 'dat-bank', f.file);
      assert.equal(f.data.section, section, f.file + ' section');
      assert.equal(f.data.layer, Number(layer), f.file + ' layer');
      assert.ok(Array.isArray(f.data.items), f.file + ' items[]');
    }
    assert.equal(f.data.version, 1, f.file + ' version');
  }
  // One card fragment per course chapter, in the same order.
  assert.deepEqual(
    fragments.course.map(f => f.data.chapter.id),
    fragments.cards.map(f => f.data.chapter)
  );
});

test('the six-key ROOT provenance block is present on every data/dat-*.json on disk', () => {
  const files = [
    ...registered.map(f => [f.file, f.data]),
    ...SINGLETONS.map(name => ['data/' + name + '.json', data.read(name)]),
  ].filter(([, d]) => d);
  assert.ok(files.length >= 44 + 4, 'outline, rc, repairs, rehearsals and all 44 fragments are present');
  for (const [file, d] of files) {
    for (const key of ROOT_KEYS) assert.ok(key in d, `${file} has ${key}`);
    assert.match(d.authoredOn, ISO, file + ' authoredOn');
    assert.match(d.sourceCheckedOn, ISO, file + ' sourceCheckedOn');
    assert.ok(typeof d.author === 'string' && d.author, file + ' author');
    assert.match(d.reviewStatus, /pending/, file + ' reviewStatus says pending until a named reviewer signs');
    assert.ok(typeof d.contentNote === 'string' && d.contentNote.length > 20, file + ' contentNote');
    assert.ok(Array.isArray(d.sources) && d.sources.length > 0, file + ' sources non-empty');
    for (const s of d.sources) {
      assert.ok(typeof s.title === 'string' && s.title, file + ' source title');
      assert.match(s.url, /^https:\/\//, file + ' source url https');
    }
  }
  const disk = fs
    .readdirSync('data')
    .filter(n => /^dat-.*\.json$/.test(n))
    .map(n => n.replace(/\.json$/, ''));
  const known = new Set([...registered.map(f => f.name), ...SINGLETONS]);
  assert.deepEqual(
    disk.filter(n => !known.has(n)),
    [],
    'no unregistered data/dat-*.json files'
  );
});

test('course units follow the unit schema: kind order, option count from the outline, verbatim topics, provenance', () => {
  const units = data.course.units,
    cardIds = new Set(data.cards.map(c => c.id)),
    optionCount = outline.optionPolicy.course.options;
  assert.equal(new Set(units.map(u => u.id)).size, units.length, 'unit ids unique');
  for (const f of fragments.course)
    for (const u of f.data.units) {
      assert.equal(u.chapter, f.data.chapter.id, u.id + ' chapter');
      assert.equal(u.section, f.data.chapter.section, u.id + ' section');
      assert.ok(
        u.categories.length && u.categories.every(id => categories.get(id)?.section === u.section),
        u.id + ' categories'
      );
      const topics = new Set(u.categories.flatMap(id => categories.get(id).topics));
      assert.ok(u.topics.length && u.topics.every(t => topics.has(t)), u.id + ' topics verbatim from its categories');
      assert.ok(u.title && u.subtitle && Number.isInteger(u.minutes), u.id + ' title/subtitle/minutes');
      assert.equal(u.blocks.length, 3, u.id + ' three blocks');
      for (const b of u.blocks)
        assert.ok(b.title && typeof b.text === 'string' && b.text.length > 80, u.id + ' block text');
      assert.ok(u.example?.prompt && u.example?.reasoning && u.prediction, u.id + ' example/prediction');
      assert.equal(u.lab, null, u.id + ' lab null');
      assert.equal('authoredHelp' in u, false, u.id + ' no authoredHelp');
      assert.deepEqual(
        u.questions.map(q => q.kind),
        ['diagnostic', 'check', 'check', 'delayed', 'delayed', 'delayed'],
        u.id + ' question kinds'
      );
      assert.deepEqual(
        u.questions.map(q => q.id),
        [0, 1, 2].map(n => `${u.id}-${n}`).concat([1, 2, 3].map(n => `${u.id}-later-${n}`)),
        u.id + ' question ids'
      );
      for (const q of u.questions) {
        assert.equal(q.options.length, optionCount, q.id + ' option count');
        assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < optionCount, q.id + ' answer');
        assert.ok(q.explanation.length > 60, q.id + ' explanation');
        assert.doesNotMatch(q.explanation, /\b(?:option|choice)\s+[A-F]\b/i, q.id + ' explanation names no letter');
      }
      assert.ok(new Set(u.questions.map(q => q.answer)).size >= 3, u.id + ' rotates answer positions');
      for (const id of u.cards) assert.ok(cardIds.has(id), u.id + ' card ' + id);
      for (const id of u.prerequisites)
        assert.ok(
          units.some(x => x.id === id),
          u.id + ' prerequisite ' + id
        );
      assert.match(u.source?.url || '', /^https:\/\//, u.id + ' source url');
      assert.ok(
        Array.isArray(u.skills) && u.skills.every(s => outline.scienceSkills.some(k => k.id === s)),
        u.id + ' skills'
      );
      assert.ok(['reuse', 'adapt', 'new'].includes(u.provenance?.origin), u.id + ' provenance.origin');
      assert.ok(
        'mcatUnit' in u.provenance && u.provenance.reviewStatus && ISO.test(u.provenance.sourceCheckedOn),
        u.id + ' provenance'
      );
      if (u.provenance.origin === 'new') assert.equal(u.provenance.mcatUnit, null, u.id);
      if (u.figures)
        for (const fig of u.figures) {
          assert.ok(fig.id && fig.caption, u.id + ' figure meta');
          assert.match(fig.svg, /^\s*<svg[^>]*viewBox/, u.id + ' figure viewBox');
          assert.match(fig.svg, /role="img"/, u.id + ' figure role');
          assert.match(fig.svg, /aria-label=/, u.id + ' figure aria-label');
          assert.doesNotMatch(fig.svg, /<script|href=/i, u.id + ' figure safe');
          assert.ok(Buffer.byteLength(fig.svg) <= 8192, u.id + ' figure ≤ 8 KB');
        }
    }
});

test('cards carry section, category and a verbatim topic, with ids unique and prefixed per chapter', () => {
  assert.equal(new Set(data.cards.map(c => c.id)).size, data.cards.length);
  for (const f of fragments.cards)
    for (const c of f.data.cards) {
      const cat = categories.get(c.category);
      assert.ok(cat, c.id + ' category');
      assert.equal(c.section, cat.section, c.id + ' section');
      assert.ok(cat.topics.includes(c.topic), c.id + ' topic verbatim');
      assert.ok(c.front && c.back, c.id + ' front/back');
      assert.match(c.id, /^[a-z0-9]+-[a-z0-9-]+-\d+$/, c.id + ' id pattern');
      if (c.tag) assert.equal(c.tag, 'cheat-sheet', c.id + ' tag');
    }
});

test('bank items carry per-record provenance and pass the checker with zero findings', () => {
  const { checkDatBanks } = require('./check-dat-banks.cjs');
  const report = checkDatBanks(
    outline,
    fragments.questions.map(f => ({ file: f.file, data: f.data }))
  );
  assert.deepEqual(
    [...report.errors, ...report.warnings].map(f => `${f.reason} ${f.file} ${f.itemId || ''} ${f.message}`),
    []
  );
  for (const item of data.questions) {
    assert.ok(item.provenance?.reviewStatus && ISO.test(item.provenance.sourceCheckedOn), item.id + ' provenance');
    assert.ok(['reuse', 'adapt', 'new'].includes(item.provenance.origin), item.id + ' origin');
  }
});

test('the DAT-02 seeds are in place: six units (one per section) and twenty items (one per category)', () => {
  const seeds = [
    'protists-fungi',
    'stoichiometry-and-moles',
    'curved-arrow-conventions',
    'quantitative-comparison-method',
    'rc-question-types',
    'angle-ranking-method',
  ];
  for (const id of seeds)
    assert.ok(
      data.course.units.some(u => u.id === id),
      id
    );
  assert.deepEqual(new Set(data.course.units.map(u => u.section)).size, 6, 'one seed unit per section');
  assert.ok(data.course.units.every(u => u.placementEligible === true));
  // The seeds are the floor; content sessions grow every count from here.
  const seedIds = [
    'bio-cell-1',
    'bio-diversity-1',
    'bio-systems-1',
    'bio-genetics-1',
    'bio-evolution-1',
    'gc-stoich-1',
    'gc-gases-1',
    'gc-phases-1',
    'gc-solutions-1',
    'gc-acidbase-1',
    'oc-mech-1',
    'oc-synth-1',
    'oc-acid-1',
    'oc-prop-1',
    'oc-struct-1',
    'qr-alg-1',
    'qr-ds-1',
    'qr-qc-1',
    'qr-stat-1',
    'qr-applied-1',
  ];
  const ids = new Set(data.questions.map(q => q.id));
  for (const id of seedIds) assert.ok(ids.has(id), 'seed item ' + id);
  const seedItems = data.questions.filter(q => seedIds.includes(q.id));
  const byCategory = Object.fromEntries(seedItems.map(q => [q.category, q.format || 'standard']));
  assert.ok(data.questions.length >= 20);
  for (const id of [
    'BIO-1',
    'BIO-2',
    'BIO-3',
    'BIO-4',
    'BIO-5',
    'GC-1',
    'GC-2',
    'GC-3',
    'GC-4',
    'GC-5',
    'OC-1',
    'OC-2',
    'OC-3',
    'OC-4',
    'OC-5',
    'QR-1',
    'QR-2',
    'QR-3',
    'QR-4',
    'QR-5',
  ])
    assert.ok(id in byCategory, 'seed in ' + id);
  assert.equal(byCategory['QR-2'], 'ds');
  assert.equal(byCategory['QR-3'], 'qc');
  assert.equal(byCategory['QR-4'], 'data');
  assert.equal(seedItems.filter(q => q.section !== 'qr').length, 15, 'fifteen SNS seeds feed the mixed drill');
  // Reading Comprehension is authored now (C16, set rc-set-1); its shape rules are
  // scripts/test-dat-rc.cjs's job, so this inventory only pins that the set landed.
  assert.equal(data.rc.passages.length, outline.sections.rc.passages);
  assert.deepEqual(data.repairs.concepts, []);
  assert.deepEqual(data.rehearsals.forms, []);
});

/* ---------- content regressions: false statements found in the 2026-09-16 accuracy review ----------
   Each of these fails on the pre-review bank text. They guard a class of defect the bank checker
   cannot see: a stem, explanation or distractor rationale that states something the item's own
   data contradicts, while the answer key itself is correct. */
const reviewItems = new Map(data.questions.map(q => [q.id, q]));
const get = id => {
  const it = reviewItems.get(id);
  assert.ok(it, id + ' missing from the banks');
  return it;
};

test('a data-table item that quotes a statistic quotes the one its own table has', () => {
  // qr-stat-6 claimed sigma = 2 for a table whose sigma is 2.19 (population) / 2.21 (sample).
  const it = get('qr-stat-6');
  const pairs = it.table.rows.map(r => [Number(r[0]), Number(r[1])]);
  const n = pairs.reduce((s, [, c]) => s + c, 0);
  const mean = pairs.reduce((s, [v, c]) => s + v * c, 0) / n;
  const sd = Math.sqrt(pairs.reduce((s, [v, c]) => s + c * (v - mean) ** 2, 0) / n);
  assert.equal(mean, 16);
  assert.ok(Math.abs(sd - 2.19) < 0.01, `sigma is ${sd}`);
  // the stem must not assert a standard deviation the table does not have
  assert.ok(!/standard deviation of 2 points/.test(it.stem), 'stem asserts sigma = 2');
  assert.match(it.stem, /standard deviation of about 2\.2 points/);
  // and the keyed percent must be the real within-1-SD count
  const within = pairs.filter(([v]) => Math.abs(v - mean) <= sd).reduce((s, [, c]) => s + c, 0);
  assert.equal(it.options[it.answer], `${Math.round((within / n) * 100)} %`);
});

test('a frequency-table item does not call a non-middle row the middle row', () => {
  // qr-stat-7 distractors[i=2] called 18 "the middle row"; 16 is the middle row and the key.
  const it = get('qr-stat-7');
  const labels = it.table.rows.map(r => r[0]);
  const middle = labels[(labels.length - 1) / 2];
  assert.equal(it.options[it.answer], middle, 'the key is the middle row label');
  for (const d of it.distractors) {
    if (/middle row/.test(d.why))
      assert.ok(
        d.why.includes(middle) || /not the middle/.test(d.why) || /rather than the middle/.test(d.why),
        `why[${d.i}] calls ${it.options[d.i]} the middle row, but the middle row is ${middle}`
      );
  }
});

test('the "subtract the speeds" distractor carries the value that error actually produces', () => {
  // qr-applied-10 paired "This subtracts the speeds" with 7 hours; 210/(80-60) = 10.5.
  const it = get('qr-applied-10');
  const d = it.distractors.find(x => /subtracts the speeds/.test(x.why));
  assert.ok(d, 'the subtract-the-speeds rationale is present');
  assert.equal(it.options[d.i], '10.5 hours');
});

test('the average-rate trap uses the mean of the two rates and reaches its distractor', () => {
  const it = get('qr-applied-5');
  const rates = [...it.stem.matchAll(/(\d+) (?:instrument )?trays per hour/g)].map(m => Number(m[1]));
  const trays = Number(it.stem.match(/prepare (\d+) trays/)[1]);
  assert.equal(rates.length, 2);
  const sum = rates.reduce((a, b) => a + b, 0);
  assert.equal(it.options[it.answer], `${trays / sum} hours`);
  const d = it.distractors.find(x => /instead of the combined rate/.test(x.why));
  assert.ok(d, 'the average-rate trap is present');
  assert.equal(it.options[d.i], `${trays / (sum / rates.length)} hours`);
  assert.doesNotMatch(it.explanation + d.why, /16 trays/);
});

test('x greater than one does not exclude fractions greater than one', () => {
  const it = get('qr-qc-8');
  assert.ok(it.worked.values.x.some(x => x > 1 && !Number.isInteger(x)));
  assert.doesNotMatch(it.explanation, /rules fractions out/);
  assert.match(it.explanation, /between 0 and 1/);
  assert.equal(it.answer, 0);
});

test('the unsquared-radius gloss calls pi*r*h an area, not a length times an area', () => {
  // qr-applied-7's explanation said "a length times an area", which is a volume.
  const it = get('qr-applied-7');
  assert.ok(!/length times an area/.test(it.explanation), 'explanation mis-states the dimensions of pi*r*h');
  assert.match(it.explanation, /is an area rather than a volume/);
});

test('alpha-decay distractor rationales state the direction of the Z change correctly', () => {
  // gc-nuclear-1 distractors[i=1] said Pa-234 (Z = 91) "raises the charge" relative to U-238 (Z = 92).
  const it = get('gc-nuclear-1');
  const parentZ = Number(it.stem.match(/Z = (\d+)/)[1]);
  for (const d of it.distractors) {
    const m = it.options[d.i].match(/Z = (\d+)/);
    if (!m) continue;
    const z = Number(m[1]);
    if (z < parentZ)
      assert.ok(!/raises the charge|raises the atomic number/.test(d.why), `why[${d.i}]: Z falls ${parentZ}->${z}`);
    if (z > parentZ)
      assert.ok(!/drops the charge|lowers the charge/.test(d.why), `why[${d.i}]: Z rises ${parentZ}->${z}`);
  }
  // and the explanation must not claim no decay mode changes one number alone — beta decay does.
  assert.ok(!/which no single decay mode does/.test(it.explanation));
});

test('no two options answer an outcome-only stem the same way', () => {
  // gc-phases-2 and gc-equil-1 had two options asserting the same correct outcome.
  // A stem that asks for the outcome must not have two options leading with the same outcome.
  const outcomeStem = /^(At what temperature|What happens)/m;
  for (const id of ['gc-phases-2', 'gc-equil-1']) {
    const it = get(id);
    const last = it.stem.split(/(?<=[.?]) /).pop();
    assert.ok(!outcomeStem.test(last), `${id} stem asks only for the outcome: "${last}"`);
    assert.match(last, /Which statement/);
  }
});

/* ---------- content regressions: the 2026-09-16 explanation audit (AUD-01 .. AUD-09) ----------
   Nine defects in teaching copy whose answer keys were all correct: an explanation that
   contradicted the item's own rationales, two rationales whose arithmetic was wrong, two traps
   that did not lead where the copy said, an unqualified rule a sibling card qualifies, an
   unsourced directional strategy claim, a spelled-out option count in prose, and a card filed
   under the wrong topic row. Each test fails on the pre-audit text. */

test('a "closest competitor" claim outranks every other option the item prices', () => {
  // AUD-01: gc-phases-4 called the ionic solid the nearest competitor to SiO2, but its own
  // rationales put copper (several hundred degrees below) above NaCl (near 800 C).
  const it = get('gc-phases-4');
  const key = Number(/melts near (\d+)\s*°C/.exec(it.explanation)[1]);
  const ionicWhy = it.distractors.find(d => it.options[d.i] === 'Sodium chloride').why;
  const ionic = Number(/melts near (\d+)\s*°C/.exec(ionicWhy)[1]);
  assert.ok(
    !/strongest competitor is the ionic solid/.test(it.explanation),
    'the explanation promotes the ionic solid over copper'
  );
  const runnerUp = Number(/copper melts near (\d+)\s*°C/.exec(it.explanation)[1]);
  assert.ok(ionic < runnerUp && runnerUp < key, `runner-up ${runnerUp} must sit between ${ionic} and ${key}`);
});

test('a balancing distractor states the oxygen shortfall its own coefficient actually leaves', () => {
  // AUD-02: gc-stoich-3 said 3 O2 leaves "two oxygen atoms unaccounted for"; it leaves one.
  const it = get('gc-stoich-3');
  const productO = 2 * 2 + 3; // 2 CO2 + 3 H2O per C2H6
  const d = it.distractors.find(x => /unaccounted for/.test(x.why));
  assert.ok(d, 'the shortfall rationale is present');
  const shortfall = productO - 2 * Number(it.options[d.i]);
  assert.equal(shortfall, 1);
  const words = { one: 1, two: 2, three: 3, four: 4 };
  const stated = /leaves (one|two|three|four) oxygen atoms? unaccounted for/.exec(d.why);
  assert.ok(stated, 'the rationale names a shortfall');
  assert.equal(words[stated[1]], shortfall, `why[${d.i}] states ${stated[1]}, the real shortfall is ${shortfall}`);
});

test('the octet-closure rule in a lesson carries the qualification its own card carries', () => {
  // AUD-03: curved-arrow-conventions stated octet closure for every atom while ocm-arrows-2,
  // which the unit references, exempts third-period atoms.
  const unit = data.course.units.find(u => u.id === 'curved-arrow-conventions');
  const card = data.cards.find(c => c.id === 'ocm-arrows-2');
  assert.ok(unit && card && unit.cards.includes(card.id));
  assert.match(card.back, /second-period atom/);
  assert.match(card.back, /third-period atom/);
  const text = unit.blocks.map(b => b.text).join(' ');
  assert.ok(
    !/lands on an atom that already has a full octet/.test(text),
    'the lesson states octet closure for every atom, which is false for third-period atoms'
  );
  assert.match(text, /second-period atom that already has a full octet/);
  assert.match(text, /third-period atom/);
});

test('a Hardy-Weinberg distractor names an error that produces its own value', () => {
  // AUD-04: bio-evolution-3 sent the 0.32 picker at 2pq = 0.48, which 0.32 is nowhere near.
  const it = get('bio-evolution-3');
  const q2 = Number(/(\d+)% of individuals/.exec(it.stem)[1]) / 100;
  const q = Math.sqrt(q2),
    twopq = 2 * (1 - q) * q;
  assert.ok(Math.abs(Number(it.options[it.answer]) - q) < 1e-9, 'the key is q');
  const d = it.distractors.find(x => Math.abs(Number(it.options[x.i]) - 2 * q2) < 1e-9);
  assert.ok(d, 'the doubled-phenotype distractor is present');
  assert.ok(Math.abs(2 * q2 - twopq) > 0.1, `${2 * q2} is not close to 2pq = ${twopq}`);
  assert.ok(
    !/close to the heterozygote frequency/.test(d.why),
    `why[${d.i}] points at 2pq, which is not near its value`
  );
  assert.match(d.why, /doubling the homozygous-recessive frequency/);
});

test('the trap an explanation names does not lead back to the keyed answer', () => {
  // AUD-05: qr-qc-2 warned against stopping at 15, which still picks Quantity A, the key.
  const it = get('qr-qc-2');
  const x = it.worked.values.x,
    b = Number(it.quantityB);
  assert.equal(3 * x + 2, 17);
  assert.equal(it.options[it.answer], 'Quantity A is greater');
  assert.ok(17 - 2 > b, 'subtracting and stopping at 15 still beats 4, so that shortcut is not a trap');
  assert.ok(
    !/subtracting 2 from 17 and stopping there/.test(it.explanation),
    'the named trap produces the keyed answer'
  );
  assert.match(it.explanation, /dividing before subtracting/);
  assert.ok(17 / 3 - 2 < b, 'dividing first must land below 4, i.e. on a wrong option');
});

test('a "testing only X hides the flip" claim holds over the values the condition admits', () => {
  // AUD-06: qr-qc-11 said integers hide the flip, but z = -2 exposes it at once.
  const it = get('qr-qc-11');
  const A = z => z + 1,
    B = z => 1 / z;
  assert.equal(it.options[it.answer], 'The relationship cannot be determined from the information given');
  assert.ok(A(-2) < B(-2) && A(-3) < B(-3), 'negative integers already show the flip');
  assert.ok(A(1) > B(1) && A(2) > B(2), 'positive integers do not');
  assert.ok(!/testing only integers,/.test(it.explanation), 'negative integers are integers and expose the flip');
  assert.match(it.explanation, /testing only positive integers/);
});

test('no PAT strategy surface asserts a direction for the arm-length illusion', () => {
  // AUD-07: the unit text, its figure caption and card p2d-ang-1 all claimed longer arms look
  // wider. Research §4.3 records only the neutral method, with no direction.
  const direction = /(?:long(?:er)?|short(?:er)?) arms\b[^.;]{0,60}look (?:wider|narrower|larger|smaller)/i;
  const unit = data.course.units.find(u => u.id === 'angle-ranking-method');
  assert.ok(unit);
  for (const b of unit.blocks) assert.doesNotMatch(b.text, direction, unit.id + ' block: ' + b.title);
  for (const f of unit.figures || []) assert.doesNotMatch(f.caption, direction, 'caption ' + f.id);
  for (const c of data.cards.filter(c => c.section === 'pat')) assert.doesNotMatch(c.back, direction, c.id);
  // the method the research does record must survive the cut
  assert.match(unit.blocks.map(b => b.text).join(' '), /trimmed to the same/);
});

test('RC lesson prose and cards render no spelled-out option count', () => {
  // AUD-08: optionPolicy.rc is unverified at 5 and dat-trim-options.cjs rewrites items only,
  // never prose, so a trim to 4 would silently falsify any spelled-out count.
  assert.equal(outline.optionPolicy.rc.status, 'unverified');
  const spelled =
    /\b(?:two|three|four|five|six)\b (?:of the )?options?\b|\bthe (?:fourth|fifth|sixth) option\b|\bverify (?:two|three|four|five)\b|\bas (?:two|three|four|five) (?:small look-ups|verification tasks)\b/i;
  const surfaces = [];
  for (const u of data.course.units.filter(u => u.section === 'rc')) {
    for (const b of u.blocks) surfaces.push([u.id + ' block: ' + b.title, b.title + ' ' + b.text]);
    surfaces.push([u.id + ' example', u.example.prompt + ' ' + u.example.reasoning]);
    for (const q of u.questions) surfaces.push([q.id, [q.stem, ...q.options, q.explanation].join(' ')]);
  }
  for (const c of data.cards.filter(c => c.section === 'rc')) surfaces.push([c.id, c.front + ' ' + c.back]);
  assert.ok(surfaces.length, 'there is RC lesson copy to check');
  for (const [id, text] of surfaces) assert.doesNotMatch(text, spelled, id + ' spells out an option count');
});

test('every "Curved arrows: <mechanism>" card actually names that mechanism', () => {
  // AUD-09: ocm-arrows-2 sat in the proton-transfer coverage row while teaching the general
  // formal-charge rule. Legal topic string, wrong row — the bank checker cannot see this.
  const offenders = [];
  for (const c of data.cards) {
    const m = /^Curved arrows: ([a-z]+)/.exec(c.topic || '');
    if (!m || ['other', 'combined'].includes(m[1])) continue;
    if (!new RegExp('\\b' + m[1], 'i').test(c.front + ' ' + c.back)) offenders.push(`${c.id} -> ${c.topic}`);
  }
  assert.deepEqual(offenders, []);
});
