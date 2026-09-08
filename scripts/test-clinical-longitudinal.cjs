const { test } = require('node:test');
const assert = require('node:assert/strict'), fs = require('node:fs');
const Core = require('../clinical-longitudinal-engine.js');
const cases = JSON.parse(fs.readFileSync('data/clinical-longitudinal.json')).cases;
const reason = choice => ({ choice, hypothesis: 'Initial hypothesis', alternative: 'Alternative', evidence: 'Current evidence and a disconfirming observation' });
const handoff = Object.fromEntries(Core.HANDOFF.map(key => [key, 'Written ' + key]));
test('every authored branch terminates and preserves the exact first reasoning and handoff', () => {
  let completed = 0;
  for (const item of cases) for (const path of Core.paths(item)) {
    let run = Core.create(item, 'path-' + completed, 1000);
    for (const step of path.filter(s => s.choice)) {
      assert.equal(run.nodeId, step.node); run.drafts[step.node] = reason(step.choice);
      const before = JSON.stringify(run); const locked = Core.lock(run, 1100);
      assert.equal(JSON.stringify(run), before); assert.equal(locked.records.at(-1).choice, step.choice);
      assert.throws(() => Core.lock(locked)); run = Core.advance(locked); Core.validateRun(run);
    }
    run.handoffDraft = Core.copy(handoff); const revealed = Core.revealHandoff(run);
    revealed.handoffDraft.assessment = 'Later draft change'; assert.equal(revealed.handoff.assessment, handoff.assessment);
    revealed.comparison = 'The later evidence changed my working explanation.';
    const finished = Core.complete(revealed, 2000); Core.validateRun(finished); assert.equal(finished.phase, 'complete'); completed++;
  }
  assert.equal(completed, 12);
});
test('a run contains an independent full case revision and cannot jump to future evidence', () => {
  const item = Core.copy(cases[0]), run = Core.create(item, 'snapshot', 1000);
  item.nodes[0].observation = 'Edited source'; assert.notEqual(run.caseData.nodes[0].observation, item.nodes[0].observation);
  assert.throws(() => Core.advance(run)); assert.throws(() => Core.revealHandoff(run)); assert.throws(() => Core.complete(run));
  run.nodeId = 'handoff'; run.phase = 'handoff'; assert.throws(() => Core.validateRun(run));
});
test('missing reasoning, choice, handoff and comparison remain unfinished', () => {
  let run = Core.create(cases[0], 'empty-fields', 1000); assert.throws(() => Core.lock(run));
  run.drafts.arrival = reason('serial'); run.drafts.arrival.alternative = '  '; assert.throws(() => Core.lock(run));
  run.drafts.arrival.alternative = 'Reflux'; run = Core.advance(Core.lock(run, 1100));
  run.drafts.repeat = reason('escalate'); run = Core.advance(Core.lock(run, 1200));
  assert.throws(() => Core.revealHandoff(run)); run.handoffDraft = Core.copy(handoff); run = Core.revealHandoff(run);
  assert.throws(() => Core.complete(run));
});
test('content rejects broken links, loops, unreachable checkpoints and unsupported reviewer claims', () => {
  for (const modify of [c => c.nodes[0].options[0].next = 'missing', c => c.nodes[0].options[0].next = 'arrival',
    c => c.nodes.push({ ...c.nodes.at(-1), id: 'unreachable' }), c => c.review.status = 'reviewed']) {
    const item = Core.copy(cases[0]); modify(item); assert.throws(() => Core.validateCase(item));
  }
});
test('damaged branch records and unsupported saved phases fail without migration guesses', () => {
  let run = Core.create(cases[0], 'invalid-record', 1000); run.drafts.arrival = reason('serial'); run = Core.lock(run, 1100);
  for (const modify of [r => r.records[0].choice = 'missing', r => r.records[0].nodeId = 'repeat', r => r.phase = 'finished',
    r => r.drafts.arrival.evidence = 5, r => r.comparison = null]) {
    const value = Core.copy(run); modify(value); assert.throws(() => Core.validateRun(value));
  }
});
test('a device clock that steps backwards between checkpoints keeps the run openable', () => {
  let run = Core.create(cases[0], 'clock-step', 1000000); run.drafts.arrival = reason('serial');
  run = Core.lock(run, 999000); assert.equal(run.phase, 'feedback'); Core.validateRun(run);
  run = Core.advance(run); assert.equal(run.phase, 'reason'); run.drafts.repeat = reason('escalate');
  run = Core.advance(Core.lock(run, 998000)); run.handoffDraft = Core.copy(handoff); run = Core.revealHandoff(run);
  run.comparison = 'The comparison survived the clock change.'; run = Core.complete(run, 997000);
  assert.equal(run.phase, 'complete'); Core.validateRun(run);
  for (const modify of [r => r.records[0].lockedAt = NaN, r => r.records[1].lockedAt = 'later', r => r.completedAt = Infinity]) {
    const value = Core.copy(run); modify(value); assert.throws(() => Core.validateRun(value));
  }
});
