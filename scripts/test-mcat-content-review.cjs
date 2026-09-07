const assert = require('node:assert/strict');
const fs = require('node:fs');
const core = require('../mcat-v2-engine.js');
const read = name => JSON.parse(fs.readFileSync('data/' + name));
const course = read('mcat-course.json'), v2 = read('mcat-v2.json');
const passages = [...read('mcat-cars.json'), ...read('mcat-science-passages.json')];
const passage = id => passages.find(p => p.id === id);
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }
function near(a, b, tolerance = 1e-8) { assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`); }

test('ANOVA reported in passage and question agrees with its four summary groups', () => {
  const p = passage('ps1'), rows = p.table.rows, n = 20;
  const means = rows.map(r => Number(r[2])), sd = rows.map(r => Number(r[3]));
  const grand = means.reduce((a, b) => a + b) / means.length;
  const between = n * means.reduce((sum, m) => sum + (m - grand) ** 2, 0);
  const within = sd.reduce((sum, s) => sum + (n - 1) * s ** 2, 0);
  const f = (between / (means.length - 1)) / (within / (n * means.length - means.length));
  for (const text of [p.text, p.questions.find(q => q.id === 'ps1-4').stem]) {
    const match = text.match(/F\(3, 76\) = ([\d.]+)/);
    assert.ok(match); near(Number(match[1]), f, .05);
  }
  near(100 * means[3] / 60, 45.6666666667, 1e-7);
  assert.ok(p.questions.every(q => !/option\s+[A-D]\b/i.test(q.explanation)), 'Avoid stale option-letter explanations');
});

test('Titration table agrees with the stated weak-acid equilibrium and stoichiometry', () => {
  const p = passage('cp2'), ka = 10 ** -4.74, kw = 1e-14, acidMoles = .025 * .1;
  for (const [volumeText, pHText] of p.table.rows) {
    const volume = Number(volumeText) / 1000, baseMoles = volume * .1, totalVolume = .025 + volume;
    let pH;
    if (!volume) {
      const h = (-ka + Math.sqrt(ka * ka + 4 * ka * .1)) / 2;
      pH = -Math.log10(h);
    } else if (Math.abs(baseMoles - acidMoles) < 1e-10) {
      const kb = kw / ka, concentration = acidMoles / totalVolume;
      const oh = (-kb + Math.sqrt(kb * kb + 4 * kb * concentration)) / 2;
      pH = 14 + Math.log10(oh);
    } else if (baseMoles > acidMoles) pH = 14 + Math.log10((baseMoles - acidMoles) / totalVolume);
    else pH = 4.74 + Math.log10(baseMoles / (acidMoles - baseMoles));
    near(Number(pHText), pH, .02);
  }
});

test('Enzyme table fits a common Vmax and different apparent Km values', () => {
  for (const row of passage('bb1').table.rows) {
    const [s, control, inhibited] = row.map(Number);
    near(control, 100 * s / (2 + s), .051);
    near(inhibited, 100 * s / (6 + s), .051);
  }
  const p = passage('bb2'), mock = p.table.rows.find(r => r[0] === 'Mock'), knockdown = p.table.rows.find(r => r[0] === 'si-HSF1');
  near(Number(knockdown[4]) / Number(mock[4]), .257142857, 1e-8);
  assert.ok(Number(knockdown[2]) > Number(p.table.rows.find(r => r[0] === 'si-HSF1 (no heat shock)')[2]));
});

test('Doubling absorbance squares transmission; the former second correct choice is removed', () => {
  const q = course.units.find(u => u.id === 'absorbance').questions.find(q => q.id === 'absorbance-1');
  for (const absorbance of [.2, .7, 1.3]) near(10 ** (-2 * absorbance), (10 ** -absorbance) ** 2);
  assert.equal(q.answer, 2);
  assert.ok(!q.options.some(o => /square.*transmittance/i.test(o)));
  assert.match(q.explanation, /squared/);
});

test('All 48 math values agree with independently parsed prompt inputs', () => {
  for (const skill of Object.keys(core.SKILLS)) for (let i = 0; i < 8; i++) {
    const q = core.quant(skill, i); let expected;
    if (skill === 'units') { const m = q.stem.match(/(\d+) mg of solute in ([\d.]+) L/); expected = Number(m[1]) / 1000 / Number(m[2]); }
    if (skill === 'notation') { const m = q.stem.match(/\((\d+) × 10\^−(\d+)\) × \((\d+) × 10²\)/); expected = Number(m[1]) / 10 ** Number(m[2]) * Number(m[3]) * 100; }
    if (skill === 'logs') { const m = q.stem.match(/= (\d+) × 10\^−(\d+) mol/); expected = -Math.log10(Number(m[1]) / 10 ** Number(m[2])); }
    if (skill === 'ratios') { const m = q.stem.match(/resistance (\d+) units.*increases (\d+)-fold/); expected = Number(m[1]) * (1 / Number(m[2])) ** 4; }
    if (skill === 'slopes') { const [[x0,y0],[x1,y1]] = q.graph.points; expected = (y1-y0)/(x1-x0); }
    if (skill === 'estimation') { const m = q.stem.match(/a (\d+) kg object at ([\d.]+) m\/s²/); expected = Number(m[1]) * Number(m[2]); }
    near(q.value, expected, 1e-5);
  }
});

test('Review metadata preserves pending human validation and all four science disclosures', () => {
  assert.match(v2.aiReview.reviewer, /AI/); assert.match(v2.aiReview.status, /independent human review remains pending/);
  for (const id of ['cp2', 'bb1', 'bb2', 'ps1']) {
    const p = passage(id); assert.match(p.contentNote, /illustrative data/); assert.doesNotMatch(p.text, /Figure 1/);
  }
  assert.equal(v2.coaches.flatMap(c => passage(c.passageId).questions).length, 44);
});
console.log(`${checks} content regression checks passed.`);
