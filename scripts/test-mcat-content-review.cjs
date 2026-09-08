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

test('signal-detection indices reproduce the supplied rates under the stated normal model', () => {
  // Forward numerical integration is independent of the inverse-normal
  // calculation used to author the table. Allow displayed rounding.
  function normalCDF(z) {
    const n = 256, h = Math.abs(z) / n, density = x => Math.exp(-x*x/2)/Math.sqrt(2*Math.PI);
    let sum = density(0) + density(Math.abs(z));
    for (let i=1;i<n;i++) sum += (i%2 ? 4 : 2)*density(i*h);
    return .5 + Math.sign(z)*h*sum/3;
  }
  const p = passage('ps2');
  for (const row of p.table.rows) {
    const hit = Number(row[2]), falseAlarm = Number(row[3]), d = Number(row[4]), c = Number(row[6]);
    near(normalCDF(d/2-c),hit,.004); near(normalCDF(-d/2-c),falseAlarm,.004);
    assert.equal(Math.sign(c),row[1]==='Conservative'?1:-1);
  }
});

test('the HRT week-eight ANOVA agrees with its displayed group means and common within-group SD', () => {
  const p = passage('ps8'), rows=p.table.rows, n=32;
  const means=rows.slice(0,3).map(row=>Number(row[2])), grand=means.reduce((a,b)=>a+b)/3;
  const sd=Number(rows[3][2]), f=n*means.reduce((sum,x)=>sum+(x-grand)**2,0)/2/(sd*sd);
  near(Number(p.text.match(/F\(2, 93\) = ([\d.]+)/)[1]),f,.05);
  const baseline=Number(rows[0][1]),after=Number(rows[0][2]);
  const q=p.questions.find(q=>q.id==='ps8-4');near(Number(q.options[q.answer].replace('%','')),100*(baseline-after)/baseline,.5);
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

test('ALP rate units and volume keep the stated early-window consumption below five percent', () => {
  const p = passage('bb1');
  assert.ok(p.table.headers.slice(1).every(h => /nmol\/min/.test(h)));
  const volumeMl = Number(p.text.match(/([\d.]+)-mL reaction tubes/)[1]);
  const seconds = Number(p.text.match(/([\d.]+)-second measurement window/)[1]);
  for (const row of p.table.rows) {
    const initialNmol = Number(row[0]) * volumeMl * 1000;
    for (const rate of row.slice(1).map(Number)) assert.ok(rate * seconds / 60 / initialNmol < .05);
  }
  assert.match(read('mcat-experiments.json').bb1.graph.yLabel, /nmol\/min/);
  assert.ok(v2.coaches.filter(c => c.passageId === 'bb1').every(c => !JSON.stringify(c).includes('micromol/min')));
});

test('regional HWE arithmetic has a heterozygote deficit when pooled, not a homozygote deficit', () => {
  const p = passage('bb5'), rows = p.table.rows;
  rows.forEach(row => {
    const q = Number(row[3]); near(q * q, Number(row[2])); near(2 * q * (1 - q), Number(row[4]));
    near(2000 * q * q, Number(row[1]));
  });
  const pooledQ = rows.reduce((sum, row) => sum + Number(row[3]), 0) / rows.length;
  const regionalHeterozygotes = rows.reduce((sum, row) => sum + Number(row[4]), 0) / rows.length;
  near(pooledQ, .25); near(regionalHeterozygotes, .35); near(2 * pooledQ * (1 - pooledQ), .375);
  assert.ok(regionalHeterozygotes < 2 * pooledQ * (1 - pooledQ));
  const q = p.questions.find(q => q.id === 'bb5-1'); near(Number(q.options[q.answer].match(/[\d,]+/)[0].replace(/,/g,'')), 2000 * Number(rows[3][4]));
  assert.match(p.questions.find(q => q.id === 'bb5-3').explanation, /heterozygote deficit/);
});

test('hemodynamic rows and local linkage intervals agree with their independent arithmetic', () => {
  passage('bb11').table.rows.forEach(row => {
    const [,hr,sv,co,map,cvp,svr] = row.map(Number); near(hr * sv / 1000, co, .005); near((map-cvp)/co, svr, .051);
  });
  const rows = passage('bb12').table.rows, n = rows.reduce((sum,row) => sum + Number(row[1]),0);
  const doubles = rows.filter(row => row[2] === 'Double crossover').reduce((sum,row) => sum + Number(row[1]),0);
  const interval = label => (doubles + rows.filter(row=>row[2].includes(label)).reduce((sum,row)=>sum+Number(row[1]),0))/n;
  near(interval('nt–pf'),.11); near(interval('sg–nt'),.10);
  const expected = interval('nt–pf') * interval('sg–nt') * n;
  near(expected,11); near(doubles/expected,10/11); near(1-doubles/expected,1/11);
  assert.match(passage('bb12').questions.find(q=>q.id==='bb12-3').explanation,/sampling|uncertainty/);
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
