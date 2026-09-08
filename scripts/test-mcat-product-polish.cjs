const assert = require('node:assert/strict');
const core = require('../mcat-v2-engine.js');
let checks = 0;
function test(name, fn) {
  fn();
  console.log('PASS', name);
  checks++;
}

test('Legacy workshop records normalize without changing saved answers', () => {
  const active = {
    id: 'a',
    coachId: 'one',
    answers: [{ qId: 'q', chosen: 2, correct: false }],
    notes: ['map'],
    hints: { q: 1 },
    draft: { q2: { chosen: 1 } },
  };
  const before = JSON.stringify(active);
  const s = core.normalize({ coach: { active } });
  assert.equal(JSON.stringify(s.coach.active), before);
  assert.deepEqual(s.coach.parked, []);
});
test('Parking and switching survive serialization with both complete drafts and plan links', () => {
  let s = core.normalize({});
  const a = {
    id: 'a',
    coachId: 'one',
    stage: 'questions',
    answers: [{ qId: 'q1', chosen: 2, correct: false }],
    notes: ['map'],
    roles: ['context'],
    hints: { q1: 1 },
    draft: { q2: { chosen: 1, evidence: 'draft' } },
  };
  const b = { id: 'b', coachId: 'two', stage: 'map', answers: [], notes: ['science draft'], hints: {}, draft: {} };
  s.coach.active = a;
  s.weekly.active = { id: 'coach:one', type: 'coach', key: 'one', day: '2026-09-07' };
  assert.ok(core.parkCoach(s));
  assert.equal(s.weekly.active, undefined);
  assert.equal(core.parkCoach(s), false);
  s.coach.active = b;
  s = core.normalize(JSON.parse(JSON.stringify(s)));
  assert.equal(core.resumeCoach(s, 'a').draft.q2.evidence, 'draft');
  assert.equal(s.coach.active.answers[0].chosen, 2);
  assert.equal(s.coach.active.hints.q1, 1);
  assert.equal(s.weekly.active.key, 'one');
  assert.equal(s.coach.parked[0].notes[0], 'science draft');
  assert.equal(core.resumeCoach(s, 'missing'), null);
  core.resumeCoach(s, 'b');
  assert.equal(s.coach.parked.length, 1);
  assert.equal(s.coach.parked[0].id, 'a');
  assert.equal(s.weekly.active, undefined);
});
test('Displayed diagnostic setup counts as exposure before it is answered', () => {
  const s = core.normalize({});
  core.noteMathExposure(s, 'math-units-0', 'diagnostic', 'investigation', 100);
  assert.equal(core.mathPrior(s, 'math-units-0', 200, 'math-run'), 'investigation');
  assert.equal(core.mathPrior(s, 'math-units-1', 200, 'math-run'), null);
  assert.equal(core.mathPrior(s, 'math-units-0', 50, 'math-run'), null);
});
test('Earlier diagnostic answers classify legacy math evidence without rewriting originals', () => {
  const s = core.normalize({});
  s.diagnostics.history = [{ answers: [{ qId: 'probe-math-units-0', ts: 100 }] }];
  const r = { id: 'm', qId: 'math-units-0', startedAt: 200, correct: true, repeat: false };
  const before = JSON.stringify(r);
  assert.equal(core.bucket(core.mathEvidence(s, r)), 'repeat');
  assert.equal(JSON.stringify(r), before);
  assert.equal(core.bucket(core.mathEvidence(s, { ...r, startedAt: 50 })), 'independent');
});
test('A math run does not count its own display or saved result as prior exposure', () => {
  const s = core.normalize({});
  const r = { id: 'm', qId: 'math-units-0', startedAt: 100, completedAt: 200, correct: true };
  core.noteMathExposure(s, r.qId, r.id, 'math', 101);
  s.math.history.push(r);
  assert.equal(core.bucket(core.mathEvidence(s, r)), 'independent');
  assert.equal(core.bucket(core.mathEvidence(s, { ...r, id: 'later', startedAt: 300 })), 'repeat');
});
test('Visiting a related investigation during a math attempt makes assistance explicit', () => {
  const s = core.normalize({});
  s.math.active = { id: 'm', qId: 'math-units-0', startedAt: 100 };
  core.noteMathExposure(s, 'math-units-0', 'm', 'math', 100);
  core.noteMathExposure(s, 'math-units-0', 'd', 'investigation', 200);
  assert.equal(core.bucket(core.mathEvidence(s, s.math.active)), 'assisted');
});
console.log(`${checks} product polish logic checks passed.`);
