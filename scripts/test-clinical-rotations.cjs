const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { validate } = require('./check-clinical-rotations.cjs');
const read = file => JSON.parse(fs.readFileSync(`data/${file}.json`, 'utf8'));
const manifest = read('clinical-shift-pilot'),
  index = read('index'),
  counts = read('manifest');
const banks = Object.fromEntries(manifest.rotations.map(rotation => [rotation.key, read(rotation.key)]));
const checked = validate(manifest, banks, index, counts);
assert.deepEqual(checked.errors, []);
const registered = manifest.rotations.reduce((sum, rotation) => sum + rotation.caseIds.length, 0);
assert.equal(checked.queue.length, registered);
assert.equal(
  checked.queue.filter(row => row.independentReview === 'pending' && row.reviewer === null && row.reviewedAt === null)
    .length,
  registered
);
assert.equal(
  Object.values(counts).reduce((sum, count) => sum + count, 0),
  2602
);
assert.equal(index.length, 2602);
assert.equal(new Set(index.map(row => row.id)).size, 2602);
const positions = [0, 0, 0, 0];
let longest = 0;
for (const [key, id] of [
  ['emergency-medicine', 'em-101'],
  ['cardiology', 'cd-101'],
  ['neurology', 'nr-101'],
]) {
  const c = banks[key].cases.find(item => item.id === id);
  assert.ok(manifest.rotations.find(rotation => rotation.key === key).caseIds.includes(id));
  assert.equal(c.contentRevision, 2);
  assert.equal(c.stages.filter(stage => stage.type === 'question').length, 4);
  for (const stage of c.stages.filter(stage => stage.type === 'question')) {
    positions[stage.answer]++;
    if (stage.options[stage.answer].length === Math.max(...stage.options.map(option => option.length))) longest++;
  }
}
assert.deepEqual(positions, [3, 3, 3, 3]);
assert.ok(longest <= 6, 'Correct options should not systematically be longest');
const pressure = banks.cardiology.cases.find(c => c.id === 'cd-101');
assert.equal(148 - 112, 36);
assert.equal(82 - 64, 18);
assert.match(pressure.stages.find(s => s.label === 'DIAGNOSIS').explanation, /36 mmHg systolic and 18 mmHg diastolic/);
const seizure = banks.neurology.cases.find(c => c.id === 'nr-101');
assert.ok(
  seizure.stages.findIndex(s => s.label === 'SUBSEQUENT EEG') > seizure.stages.findIndex(s => s.label === 'MANAGEMENT')
);
assert.match(manifest.modelNotes['nr-101'].assessment, /normal routine EEG does not exclude epilepsy/);
assert.match(banks['emergency-medicine'].cases.find(c => c.id === 'em-101').stages.at(-1).question, /separate version/);
for (const mutate of [
  m => delete m.modelNotes['nr-101'].plan,
  m => m.rotations[0].caseIds.push('em-101'),
  m => {
    m.caseReviews['nr-101'].independentReview = 'approved';
  },
  m => {
    m.rotations = [];
  },
]) {
  const changed = structuredClone(manifest);
  mutate(changed);
  assert.ok(validate(changed, banks, index, counts).errors.length > 0);
}
const changedBanks = structuredClone(banks);
changedBanks.neurology.cases.find(c => c.id === 'nr-101').stages[0].answer = 4;
assert.ok(validate(manifest, changedBanks, index, counts).errors.some(error => error.includes('invalid answer')));

// A reacting patient is checked option for option: a layer that drifts from its case must fail.
const course = read('mcat-course');
assert.deepEqual(validate(manifest, banks, index, counts, course).errors, []);
// The mutations below are written against the model layer: its first decision has an unsafe delay with
// changed readings and a near miss, and a later call shows a rising blood pressure.
const reactingId = 'em-018';
assert.ok(manifest.reactions[reactingId]);
const firstDecision = reaction => Object.values(reaction.decisions)[0];
for (const [mutate, expected] of [
  [
    r => {
      const outcomes = firstDecision(r).outcomes;
      [outcomes[0], outcomes[1]] = [outcomes[1], outcomes[0]];
    },
    /only the case's keyed option may be the safe call/,
  ],
  [r => firstDecision(r).outcomes.pop(), /one outcome per option/],
  [r => firstDecision(r).options.pop(), /one distinct plain option per case option/],
  [r => delete firstDecision(r).outcomes.find(outcome => outcome.kind === 'delay').status, /visibly worse/],
  [
    r => {
      firstDecision(r).outcomes.find(outcome => outcome.kind === 'near-miss').vitals = { HR: '40 bpm' };
    },
    /caught before it reaches the patient/,
  ],
  [
    r => {
      firstDecision(r).outcomes.find(outcome => outcome.kind === 'safe').status = 'critical';
    },
    /the safe call cannot make the patient worse/,
  ],
  [
    r => {
      firstDecision(r).outcomes[0].minutes = 0;
    },
    /positive whole number/,
  ],
  [
    r => {
      firstDecision(r).outcomes.find(outcome => outcome.vitals).vitals.Mood = 'low';
    },
    /vitals this case records/,
  ],
  [
    r => {
      firstDecision(r).outcomes.find(outcome => outcome.trend).trend.Temp = 'up';
    },
    /a trend must point up or down on a vital that changed/,
  ],
  [
    r => {
      // a later "rising" reading that is lower than one an earlier call could have left behind
      const later = Object.values(r.decisions)
        .slice(1)
        .flatMap(decision => decision.outcomes)
        .find(outcome => outcome.trend?.BP === 'up');
      later.vitals.BP = '160/90 mmHg';
    },
    /BP is shown rising but an earlier call can already leave it at/,
  ],
  [r => delete r.decisions[Object.keys(r.decisions)[0]], /exactly the case's decision stages/],
  [r => delete firstDecision(r).fix, /resident line, question and fix required/],
  [r => r.differential.options.pop(), /one distinct plain diagnosis/],
  [r => delete r.differential.reveal, /a resident line, a question and a reveal/],
  [r => r.investigation.interview.pop(), /match the authored list/],
  [
    r => {
      r.results = {};
    },
    /every result needs a plain-language version/,
  ],
  [
    r => {
      r.science[0].lesson = 'no-such-lesson';
    },
    /must name an MCAT lesson/,
  ],
  [
    r => {
      r.science[0].lessonTitle = 'A title the lesson no longer has';
    },
    /must name an MCAT lesson/,
  ],
  [
    r => {
      r.sources = [];
    },
    /primary source links required/,
  ],
  [r => delete r.ending.critical, /an ending is required/],
  [
    r => {
      r.independentReview = 'approved';
    },
    /completed review needs identity and date/,
  ],
  [r => delete r.plainDiagnosis, /missing plainDiagnosis/],
  [
    r => {
      r.start = { status: 'doomed' };
    },
    /a starting state takes a known status/,
  ],
  [
    r => {
      r.start = { status: 'unstable', alarm: 7 };
    },
    /a starting state takes a known status/,
  ],
]) {
  const changed = structuredClone(manifest);
  mutate(changed.reactions[reactingId]);
  const { errors } = validate(changed, banks, index, counts, course);
  assert.ok(
    errors.some(error => expected.test(error)),
    `${expected} was not reported: ${errors.join(' | ')}`
  );
}
const stray = structuredClone(manifest);
stray.reactions['em-001'] = stray.reactions[reactingId];
assert.ok(validate(stray, banks, index, counts, course).errors.some(error => error.includes('outside the rotations')));
assert.equal(
  validate(manifest, banks, index, counts, course).queue.filter(row => row.reactingPatient).length,
  Object.keys(manifest.reactions).length
);

// Render the content register as a DOM stub to check inclusion and non-mutation, not appearance.
let markup = '',
  writes = 0;
const element = html => {
  markup += html;
  return { appendChild() {}, querySelector: () => ({}) };
};
const context = vm.createContext({
  console,
  Date,
  Math,
  URL,
  URLSearchParams,
  JSON,
  Set,
  location: new URL('http://localhost/practice?gates=prod'),
  sectionUrl: () => '/medicine?gates=prod',
  window: { addEventListener() {} },
  store: { progress: {}, cases: {}, history: [], streak: {} },
  StudyStorage: {
    read: (_, fallback) => fallback,
    write: () => {
      writes++;
      return true;
    },
    watch() {},
    sessionFailed() {},
  },
  el: element,
  esc: String,
  topbar: () => ({}),
  setView() {},
});
const source = fs
  .readFileSync('clinical-shift.js', 'utf8')
  .replace(
    'window.renderClinicalShift = renderClinicalShift;',
    'window.testContent={setManifest:value=>shiftManifest=value,render:renderShiftContentStatus};window.renderClinicalShift = renderClinicalShift;'
  );
vm.runInContext(source, context);
context.window.testContent.setManifest(manifest);
context.window.testContent.render();
assert.equal((markup.match(/<details id="case-/g) || []).length, registered);
assert.match(markup, /Questions for review/);
assert.match(markup, /Independent clinician review: pending/);
assert.match(markup, /lesson=med-ecg-av-timing/);
assert.match(markup, /gates=prod/);
assert.equal(writes, 0, 'Reading content status cannot award progress or reviewer approval');
console.log(
  'Three clinical contrasts, 12 decisions, exact index/count agreement, content-register inclusion and review-queue failure checks passed. Actual encounter browser walkthroughs remain pending.'
);
