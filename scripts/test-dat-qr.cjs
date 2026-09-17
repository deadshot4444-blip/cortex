// Quantitative Reasoning: the calculator state machine and the runner's contracts.
// The calculator is the piece with real semantics — the exam ships a Windows-standard basic
// calculator, so immediate execution and the memory keys have to behave exactly, and it must
// stay mouse-only. The runner checks guard the conventions a DAT module has to keep: the shared
// attempt cache, canonical qc/ds option order, set-mates staying together, and no markup in storage.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Calc = require('../dat-calc-engine.js');
const data = require('./dat-data.cjs');

const ROOT = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const run = keys => Calc.display(Calc.run(keys));

test('the calculator executes immediately, the way the exam’s does', () => {
  // The whole point: a basic calculator has no precedence, so 2 + 3 x 4 is 20, never 14.
  assert.equal(run(['2', 'add', '3', 'mul', '4', 'eq']), '20');
  assert.equal(run(['9', 'sub', '4', 'eq']), '5');
  assert.equal(run(['8', 'div', '2', 'eq']), '4');
  assert.equal(run(['2', 'add', '3', 'eq']), '5');
  // A chained operator applies the pending one first.
  assert.equal(run(['2', 'add', '3', 'mul']), '5');
  // Equals repeats the last operation, as the Windows calculator does.
  assert.equal(run(['2', 'add', '3', 'eq', 'eq']), '8');
});

test('clear entry and clear all are different keys', () => {
  // CE drops only what is being typed; C forgets the pending operation too.
  assert.equal(run(['1', '2', 'add', '5', 'ce', '3', 'eq']), '15');
  assert.equal(run(['1', '2', 'add', '5', 'c', '3', 'eq']), '3');
  assert.equal(run(['1', '2', '3', 'back']), '12');
});

test('the memory keys behave', () => {
  assert.equal(run(['9', 'ms', 'c', 'mr']), '9');
  assert.equal(run(['9', 'ms', 'c', '1', 'm+', 'mr']), '10');
  assert.equal(run(['9', 'ms', 'c', '4', 'm-', 'mr']), '5');
  assert.equal(run(['9', 'ms', 'mc', 'c', 'mr']), '0');
  assert.equal(Calc.memoryActive(Calc.run(['9', 'ms'])), true);
  assert.equal(Calc.memoryActive(Calc.run(['9', 'ms', 'mc'])), false);
});

test('square root, sign, reciprocal and percent', () => {
  assert.equal(run(['9', 'sqrt']), '3');
  assert.equal(run(['4', 'recip']), '0.25');
  assert.equal(run(['5', 'sign']), '-5');
  // Percent reads as a fraction of the pending left operand: 50 + 10% is 50 + 5.
  assert.equal(run(['5', '0', 'add', '1', '0', 'pct', 'eq']), '55');
});

test('an impossible operation shows an error and the next entry clears it', () => {
  const bad = Calc.run(['4', 'sign', 'sqrt']);
  assert.match(Calc.display(bad), /[A-Za-z]/, 'the root of a negative is an error, not a number');
  assert.equal(Calc.display(Calc.press(bad, '7')), '7', 'typing recovers');
  const byZero = Calc.run(['5', 'div', '0', 'eq']);
  assert.match(Calc.display(byZero), /[A-Za-z]/, 'division by zero is an error');
  assert.equal(Calc.display(Calc.press(byZero, 'c')), '0');
});

test('the calculator is mouse-only and lives only in Quantitative Reasoning', () => {
  const source = read('dat-qr.js');
  // The real calculator ignores the keyboard; a keydown handler here would diverge from test day.
  assert.doesNotMatch(source, /addEventListener\(\s*['"]keydown/, 'no keydown handler in the QR module');
  assert.doesNotMatch(read('dat-calc-engine.js'), /addEventListener/, 'the engine touches no DOM at all');
  // Availability comes from the outline, not from a literal.
  assert.match(source, /tools\??\.\s*calculator/, 'the module reads the outline for where the calculator is allowed');
  const outline = data.outline;
  assert.deepEqual(outline.tools.calculator.sections, ['qr'], 'the outline allows it in QR only');
  // Every key the module renders is a key the engine understands.
  const declared = new Set(Calc.KEYS.flat().map(k => k.key));
  assert.ok(declared.size >= 24, 'a full basic keypad');
  for (const key of ['mc', 'mr', 'ms', 'm+', 'm-', 'back', 'ce', 'c', 'sign', 'sqrt', 'pct', 'recip', 'eq'])
    assert.ok(declared.has(key), 'keypad has ' + key);
  // No scientific keys: the exam's calculator has none.
  for (const absent of ['sin', 'cos', 'tan', 'log', 'ln', 'exp', 'pow', '(', ')'])
    assert.equal(declared.has(absent), false, 'no ' + absent + ' key');
});

test('the runner keeps the conventions a DAT module has to keep', () => {
  const source = read('dat-qr.js');
  assert.match(source, /DAT\.attemptStores/, 'uses the one shared attempt cache, not a private copy');
  assert.doesNotMatch(source, /let\s+QLOG\b|let\s+QHIST\b|let\s+SRS\b/, 'no private cache of the attempt keys');
  assert.match(source, /DAT\.pausers\.push/, 'registers a pauser');
  assert.match(source, /window\.DatQr = \{[^}]*reset/, 'exports the reset hook the shell calls');
  // A workspace reset nulls the run while the screen stays mounted; unguarded handlers then throw.
  assert.ok((source.match(/if \(!run\) return/g) || []).length >= 6, 'handlers guard a null run');
  // Options render from the data, never from a hard-coded A-E.
  assert.doesNotMatch(source, /'ABCDE'|"ABCDE"/, 'no hard-coded option letters');
});

test('the shell resets the Quantitative Reasoning runner with the others', () => {
  // dat-practice, dat-pat and dat-rc are all reset here; leaving one out is how a previous
  // workspace's attempt leaked into a fresh one.
  const shell = read('dat.js');
  for (const hook of ['DatPractice', 'DatPat', 'DatRc', 'DatQr'])
    assert.match(shell, new RegExp('window\\.' + hook + '\\?\\.reset\\?\\.\\(\\)'), hook + ' is reset');
});

test('the Quantitative Reasoning bank is reachable and its shapes are intact', () => {
  const items = data.questions.filter(q => q.section === 'qr');
  assert.ok(items.length >= 52, 'the authored QR bank is present: ' + items.length);
  const byFormat = {};
  for (const q of items) byFormat[q.format || 'standard'] = (byFormat[q.format || 'standard'] || 0) + 1;
  for (const shape of ['standard', 'qc', 'ds']) assert.ok(byFormat[shape] > 0, 'bank has ' + shape + ' items');
  // Comparison and sufficiency option sets are canonical: same wording every time, never shuffled.
  const canonical = shape => {
    const sets = new Set(items.filter(q => q.format === shape).map(q => JSON.stringify(q.options)));
    assert.equal(sets.size, 1, 'every ' + shape + ' item uses one canonical option set');
  };
  canonical('qc');
  canonical('ds');
  for (const q of items.filter(q => q.format === 'qc'))
    assert.equal(q.options.length, 4, q.id + ' qc has four options');
  for (const q of items.filter(q => q.format === 'ds'))
    assert.equal(q.options.length, 5, q.id + ' ds has five options');
  // A data set's siblings must be answerable together, so they have to share a set id.
  const sets = items.filter(q => q.setId);
  for (const q of sets) assert.ok(items.filter(o => o.setId === q.setId).length >= 2, q.setId + ' has siblings');
});

test('the pace target comes from the outline, not from a literal', () => {
  const qr = data.outline.sections.qr;
  assert.equal(qr.questions, 40);
  assert.equal(qr.minutes, 45);
  // 40 items in 45 minutes is 67.5 s each; the module derives it rather than writing it in.
  assert.equal((qr.minutes * 60) / qr.questions, 67.5);
  const Core = require('../dat-drill-engine.js');
  assert.equal(Core.pace(data.outline, 'qr'), Math.floor(67.5), 'the engine floors the pace target');
  assert.doesNotMatch(read('dat-qr.js'), /pace\w*\s*=\s*6[78]\b/, 'the pace is computed, not written in');
});
