const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const manifest = JSON.parse(fs.readFileSync('data/clinical-shift-pilot.json'));
const revisions = JSON.parse(fs.readFileSync('data/clinical-shift-revisions.json'));
const source = fs
  .readFileSync('clinical-shift.js', 'utf8')
  .replace(
    'window.renderClinicalShift = renderClinicalShift;',
    'window.testShift={loadShiftState,caseIsCompatible,activeIsCompatible,newActiveShift,finishClinicalShift,shiftInProgress,releaseFinishedShift,setManifest:value=>shiftManifest=value,setSession:(value,state)=>{shiftSession=value;shiftState=state;}}; window.renderClinicalShift = renderClinicalShift;'
  );
let saved = null,
  invalid = 0,
  writes = 0,
  canSave = true;
const context = vm.createContext({
  console,
  Date,
  Math,
  URL,
  URLSearchParams,
  JSON,
  Set,
  store: { progress: {}, cases: {}, history: [], streak: {} },
  window: { addEventListener() {} },
  StudyStorage: {
    read: (key, fallback) => (key === 'cs-clinical-shift-v1' ? (saved ?? fallback) : fallback),
    write() {
      writes++;
      return canSave;
    },
    watch() {},
    sessionFailed() {
      invalid++;
    },
    remove: () => true,
  },
});
vm.runInContext(source, context);
const engine = context.window.testShift;
engine.setManifest(manifest);
const ids = new Set();
for (const rotation of manifest.rotations) {
  const data = JSON.parse(fs.readFileSync(`data/${rotation.key}.json`));
  for (const id of rotation.caseIds) {
    assert.equal(ids.has(id), false);
    ids.add(id);
    const c = data.cases.find(c => c.id === id);
    assert.ok(engine.caseIsCompatible(c), id);
    assert.ok(manifest.modelNotes[id].assessment && manifest.modelNotes[id].plan);
    for (const kind of ['interview', 'exam'])
      assert.ok(manifest.investigations[id][kind].every(item => item.prompt && item.finding));
    const review = manifest.caseReviews[id];
    assert.equal(review.independentReview, 'pending');
    assert.ok(review.sources.every(s => new URL(s.url).protocol === 'https:'));
    const active = engine.newActiveShift(rotation, c);
    assert.ok(engine.activeIsCompatible(active, c));
    const diagnosis = c.stages.findIndex(s => s.label === 'DIAGNOSIS');
    active.differential.stageIndex = diagnosis;
    active.differential.ranked = [c.stages[diagnosis].answer];
    for (const [i, s] of c.stages.entries())
      if (s.type === 'question' && s.label !== 'DIAGNOSIS') active.locks[i] = { choice: s.answer, lockedAt: 100 };
    active.note = { assessment: 'Original assessment', plan: 'Original plan', revealedAt: 100 };
    const state = { version: 1, active, completed: {}, history: [] };
    engine.setSession({ caseData: c, rotation, active }, state);
    assert.equal(engine.shiftInProgress(), true);
    assert.equal(engine.releaseFinishedShift(), false);
    assert.equal(state.active, active);
    canSave = false;
    assert.equal(engine.finishClinicalShift(), false);
    const time = active.completedAt;
    canSave = true;
    assert.equal(engine.finishClinicalShift(), true);
    assert.equal(active.completedAt, time);
    assert.equal(state.completed[id].attempts, 1);
    assert.equal(state.history.length, 1);
    assert.equal(state.history[0].encounter.note.assessment, 'Original assessment');
    assert.equal(engine.shiftInProgress(), false, 'A debriefed encounter is not an unfinished shift');
    assert.equal(engine.releaseFinishedShift(), true);
    assert.equal(state.active, null);
    assert.equal(state.history.length, 1);
    assert.ok(active.content.caseData !== c, 'New encounters freeze their content');
    assert.ok(active.content.modelNote !== manifest.modelNotes[id], 'The model note must also be frozen');
    assert.ok(
      active.content.investigation !== manifest.investigations[id],
      'Investigation findings must also be frozen'
    );
    assert.ok(active.content.review !== manifest.caseReviews[id], 'Review metadata must also be frozen');
    active.locks[0].choice = 999;
    assert.equal(engine.activeIsCompatible(active, c), false);
  }
}
assert.equal(ids.size, 18);
saved = { version: 1, active: null, completed: { 'legacy-case': { attempts: 2, lastAt: 44 } }, history: [] };
const priorWrites = writes;
assert.equal(engine.loadShiftState().completed['legacy-case'].lastAt, 44);
assert.equal(writes, priorWrites);
saved = { version: 1, active: { caseId: 'damaged' }, completed: {}, history: [] };
engine.loadShiftState();
assert.equal(invalid, 1);
assert.equal(writes, priorWrites);
const bank = new Set(
  Object.keys(JSON.parse(fs.readFileSync('data/manifest.json'))).flatMap(key =>
    JSON.parse(fs.readFileSync(`data/${key}.json`)).cases.map(c => c.id)
  )
);
assert.ok(revisions.changes.length >= 60);
assert.ok(revisions.changes.every(change => ids.has(change.caseId) || bank.has(change.caseId)));
console.log(
  '18 case structures, frozen content, preserved prior records, corrupt-session protection, and idempotent completion after save failure passed.'
);
