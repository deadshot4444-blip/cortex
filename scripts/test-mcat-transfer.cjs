const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../mcat-v2-engine.js');
const read = file => JSON.parse(fs.readFileSync(`data/${file}.json`));
const transfer = read('mcat-math-transfer'), passages = read('mcat-science-passages');
const course = read('mcat-course'), models = read('mcat-experiments');
assert.equal(core.validMathTransfer(transfer), true);
for (const damage of [d => d.items[0] = null, d => d.items[0].answer = 3, d => d.items[0].value = Infinity,
  d => d.items[0].id = d.items[1].id, d => d.items[0].graph = { points: [[0, 'bad'], [1, 2]] }]) {
  const bad = structuredClone(transfer); damage(bad); assert.equal(core.validMathTransfer(bad), false);
}
const expected = [360000 / 60 / (2 / 10000), .120 / .00025 / 120, 2e6 * .003 * 1000,
  3e8 / (500e-9), 10 ** (20 / 10), 10 ** -.6, 4 * 9 / 2, 8 * 3 * .5 ** 2,
  (3 - 1) / ((7 - 3) / 1000), (2 + 6) / 2 * 4, 100 * 4.2 * 2.98, .98 * 8.31 * 298 / 101000 * 1000];
const lessons = new Set(course.units.map(unit => unit.id));
transfer.items.forEach((q, i) => {
  assert.equal(core.numeric(expected[i], q.value).correct, true, q.id);
  assert.equal(core.numeric(expected[i] * 1.1, q.value).correct, false, q.id);
  assert.ok(q.unitIds.every(id => lessons.has(id)), q.id);
  assert.equal(core.quant(q.skill, q.variant).id === q.id, false);
});
for (const skill of Object.keys(core.SKILLS)) {
  const state = core.normalize({});
  assert.equal(core.mathTransferAllowed(state, skill), false);
  state.math.history = [{ qId: `math-${skill}-0`, completedAt: 1 }, { qId: `math-${skill}-0`, completedAt: 2 },
    { qId: `math-transfer-${skill}-1`, completedAt: 3 }, { qId: `math-${skill}-1` }];
  assert.equal(core.mathTransferAllowed(state, skill), false, 'Repeats, transfer runs and unfinished variants do not unlock');
  state.math.history.at(-1).completedAt = 4;
  assert.equal(core.mathTransferAllowed(state, skill), true);
}

// Exercise actual math handlers without a browser. This verifies state, not visual usability.
let saved, failed = false, lastHtml = '';
const nodes = new Map();
function node(selector) {
  if (!nodes.has(selector)) nodes.set(selector, { value: '', disabled: false, innerHTML: '',
    querySelector: node, querySelectorAll: () => [], addEventListener() {} });
  return nodes.get(selector);
}
const context = vm.createContext({ console, Date, Math, JSON, Set, Map, URL, URLSearchParams, transfer,
  window: { addEventListener() {} }, document: { addEventListener() {}, querySelector: () => null }, setInterval() {},
  StudyStorage: { paused: false, read: (_, fallback) => fallback, watch: () => ({ save(value) {
    if (failed) return false; saved = JSON.stringify(value); return true;
  } }) }, McatV2Core: core, esc: String, loadJSON: (_, fallback) => fallback, courseUnit: id => course.units.find(unit => unit.id === id),
  el: html => { lastHtml = html; return { querySelector: node, querySelectorAll: () => [] }; }
});
vm.runInContext(fs.readFileSync('mcat-v2.js', 'utf8'), context);
const run = code => vm.runInContext(code, context);
run('v2MathTransfer=JSON.parse(JSON.stringify(transfer));v2Shell=()=>{};v2CompleteActivity=()=>{};');
for (const skill of Object.keys(core.SKILLS)) {
  run(`v2State.math.history.push({qId:'math-${skill}-0',completedAt:1},{qId:'math-${skill}-1',completedAt:2});`);
  for (let i = 0; i < 2; i++) {
    run(`delete v2State.math.active;v2StartTransfer('${skill}');`);
    const q = transfer.items.find(item => item.id === run('v2State.math.active.qId'));
    assert.equal(q.variant, i);
    const firstStem = run('v2MathQuestion(v2State.math.active).stem');
    run('v2MathTransfer.items.find(q=>q.id===v2State.math.active.qId).stem="Revised after this session started";');
    assert.equal(run('v2MathQuestion(v2State.math.active).stem'), firstStem);
    run(`v2State.math.active.draft=${i ? q.answer : (q.answer + 1) % 3};`);
    const setupClick = node('#math-setup-save').onclick;
    setupClick(); setupClick();
    assert.equal(run('v2State.math.active.setup'), i ? q.answer : (q.answer + 1) % 3);
    assert.equal(run('v2State.math.active.assisted'), i === 0);
    run('v2State.math.active=JSON.parse(JSON.stringify(v2State.math.active));renderV2Math();');
    const before = run('v2State.math.history.length');
    node('#math-value').value = String(q.value);
    node('#math-value').oninput({ target: node('#math-value') });
    const submit = node('form').onsubmit;
    failed = i === 0;
    submit({ preventDefault() {} }); submit({ preventDefault() {} });
    assert.equal(run('v2State.math.history.length'), before + 1, 'Double submission must preserve one first calculation');
    assert.equal(run('v2State.math.history.at(-1).correct'), i === 1);
    failed = false; run('v2Save();');
    const history = JSON.parse(saved).math.history.at(-1);
    assert.equal(history.question.stem, firstStem);
    assert.equal(history.valueDraft, String(q.value));
  }
  run(`delete v2State.math.active;v2StartTransfer('${skill}');`);
  assert.equal(run('v2State.math.active.repeat'), true);
  assert.match(lastHtml, /PREVIOUSLY SEEN SETUP/);
}
run('delete v2State.math.active;StudyStorage.paused=true;v2StartTransfer("units");v2StartMath("units");');
assert.equal(run('v2State.math.active'), undefined);
const exposure = core.normalize({});
core.noteMathExposure(exposure, transfer.items[0].id, 'abandoned', 'math', 10);
assert.equal(core.mathPrior(exposure, transfer.items[0].id, 20, 'new-run'), 'math');

const science = passages.filter(p => p.id.startsWith('cp-transfer-'));
assert.equal(science.length, 3);
for (const p of science) {
  assert.equal(p.questions.length, 6);
  assert.match(p.contentNote, /review.*pending/i);
  assert.ok(p.sources.length > 0);
  const model = models[p.id];
  assert.ok(['hypothesis', 'independent', 'dependent', 'control', 'conclusion', 'limitation'].every(field => model[field]));
  for (const row of p.table.rows) for (const column of [model.graph.xColumn, ...model.graph.series.map(s => s.column)]) {
    assert.ok(Number.isFinite(Number(row[column])));
  }
  for (const q of p.questions) assert.equal(new Set(q.options).size, 4);
}
const [decay, optics, assay] = science;
const corrected = decay.table.rows.map(row => Number(row[1]) - Number(row[2]));
assert.deepEqual(corrected, [1000, 500, 250, 125]);
assert.equal(Number(decay.questions[0].options[decay.questions[0].answer]), corrected[2] / corrected[0]);
optics.table.rows.forEach(([o, i]) => assert.ok(Math.abs(1 / (1 / Number(o) + 1 / Number(i)) - 10) < 1e-10));
assert.equal(-Number(optics.table.rows[0][1]) / Number(optics.table.rows[0][0]), -.5);
const delta = assay.table.rows.map(row => Number(row[2]) - Number(row[1]) - (Number(row[4]) - Number(row[3])));
assert.ok(Math.abs(delta[1] - .22) < 1e-10);
assert.ok(Math.abs(delta[1] / 10000 / 60 * 1e6 - .3666666666667) < 1e-10);
assert.equal(delta.indexOf(Math.max(...delta)), 1);

const experimentContext = vm.createContext({ console, JSON, Object, Math, Number, esc: String, models,
  window: { addEventListener() {} } });
vm.runInContext(fs.readFileSync('mcat-workflows.js', 'utf8'), experimentContext);
vm.runInContext('experimentNotes=JSON.parse(JSON.stringify(models));var session={p:{id:"cp-transfer-decay"}};experimentModel(session);experimentNotes[session.p.id].conclusion="Changed later";', experimentContext);
assert.equal(vm.runInContext('experimentModel(session).conclusion', experimentContext), models[decay.id].conclusion);
console.log('MCAT transfer: 12 independent numerical checks, 12 persisted handler journeys, access/exposure/failure guards, three experiment models and frozen notes passed. Browser verification remains separate.');
