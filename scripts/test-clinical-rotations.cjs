const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { validate } = require('./check-clinical-rotations.cjs');
const read = file => JSON.parse(fs.readFileSync(`data/${file}.json`, 'utf8'));
const manifest = read('clinical-shift-pilot'), index = read('index'), counts = read('manifest');
const banks = Object.fromEntries(manifest.rotations.map(rotation => [rotation.key, read(rotation.key)]));
const checked = validate(manifest, banks, index, counts);
assert.deepEqual(checked.errors, []);
assert.equal(checked.queue.length, 18);
assert.equal(checked.queue.filter(row => row.independentReview === 'pending' && row.reviewer === null && row.reviewedAt === null).length, 18);
assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), 2602);
assert.equal(index.length, 2602);
assert.equal(new Set(index.map(row => row.id)).size, 2602);
const positions = [0,0,0,0]; let longest = 0;
for (const [key, id] of [['emergency-medicine','em-101'],['cardiology','cd-101'],['neurology','nr-101']]) {
  const c = banks[key].cases.find(item => item.id === id);
  assert.ok(manifest.rotations.find(rotation => rotation.key === key).caseIds.includes(id));
  assert.equal(c.contentRevision, 2);
  assert.equal(c.stages.filter(stage => stage.type === 'question').length, 4);
  for (const stage of c.stages.filter(stage => stage.type === 'question')) {
    positions[stage.answer]++;
    if (stage.options[stage.answer].length === Math.max(...stage.options.map(option => option.length))) longest++;
  }
}
assert.deepEqual(positions, [3,3,3,3]);
assert.ok(longest <= 6, 'Correct options should not systematically be longest');
const pressure = banks.cardiology.cases.find(c => c.id === 'cd-101');
assert.equal(148 - 112, 36); assert.equal(82 - 64, 18);
assert.match(pressure.stages.find(s => s.label === 'DIAGNOSIS').explanation, /36 mmHg systolic and 18 mmHg diastolic/);
const seizure = banks.neurology.cases.find(c => c.id === 'nr-101');
assert.ok(seizure.stages.findIndex(s => s.label === 'SUBSEQUENT EEG') > seizure.stages.findIndex(s => s.label === 'MANAGEMENT'));
assert.match(manifest.modelNotes['nr-101'].assessment, /normal routine EEG does not exclude epilepsy/);
assert.match(banks['emergency-medicine'].cases.find(c => c.id === 'em-101').stages.at(-1).question, /separate version/);
for (const mutate of [m => delete m.modelNotes['nr-101'].plan, m => m.rotations[0].caseIds.push('em-101'),
  m => { m.caseReviews['nr-101'].independentReview = 'approved'; }, m => { m.rotations = []; }]) {
  const changed = structuredClone(manifest); mutate(changed);
  assert.ok(validate(changed, banks, index, counts).errors.length > 0);
}
const changedBanks = structuredClone(banks);
changedBanks.neurology.cases.find(c => c.id === 'nr-101').stages[0].answer = 4;
assert.ok(validate(manifest, changedBanks, index, counts).errors.some(error => error.includes('invalid answer')));

// Render the content register as a DOM stub to check inclusion and non-mutation, not appearance.
let markup = '', writes = 0;
const element = html => { markup += html; return { appendChild() {}, querySelector: () => ({}) }; };
const context = vm.createContext({ console, Date, Math, URL, URLSearchParams, JSON, Set, location: new URL('http://localhost/practice?gates=prod'), sectionUrl: () => '/medicine?gates=prod',
  window: { addEventListener() {} }, store: { progress: {}, cases: {}, history: [], streak: {} },
  StudyStorage: { read: (_, fallback) => fallback, write: () => { writes++; return true; }, watch() {}, sessionFailed() {} },
  el: element, esc: String, topbar: () => ({}), setView() {} });
const source = fs.readFileSync('clinical-shift.js', 'utf8').replace('window.renderClinicalShift = renderClinicalShift;',
  'window.testContent={setManifest:value=>shiftManifest=value,render:renderShiftContentStatus};window.renderClinicalShift = renderClinicalShift;');
vm.runInContext(source, context);
context.window.testContent.setManifest(manifest); context.window.testContent.render();
assert.equal((markup.match(/<details id="case-/g) || []).length, 18);
assert.match(markup, /Questions for review/);
assert.match(markup, /Independent clinician review: pending/);
assert.match(markup, /lesson=med-ecg-av-timing/); assert.match(markup, /gates=prod/);
assert.equal(writes, 0, 'Reading content status cannot award progress or reviewer approval');
console.log('Three clinical contrasts, 12 decisions, exact index/count agreement, content-register inclusion and review-queue failure checks passed. Actual encounter browser walkthroughs remain pending.');
