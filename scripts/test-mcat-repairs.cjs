const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const core = require('../mcat-repair-engine.js');
const data = JSON.parse(readFileSync(new URL('../data/mcat-repairs.json', `file://${__filename}`), 'utf8'));
const old = JSON.parse(readFileSync(new URL('../data/mcat-questions.json', `file://${__filename}`), 'utf8'));
const concepts = data.concepts,
  c = concepts[0],
  now = 1800000000000,
  DAY = 86400000;
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('PASS', name);
}
function firstSession(correct = true) {
  const s = core.empty();
  core.begin(c, s, 'repair', now);
  core.answer(c, s, c.diagnostic.answer, 'sure', now);
  s.active.phase = 'lesson';
  core.afterLesson(c, s);
  const q = c.checks[0];
  core.answer(c, s, correct ? q.answer : (q.answer + 1) % 4, 'unsure', now + 1000);
  s.active = null;
  return s;
}
test('10 source-backed concepts / 40 unique, well-formed questions', () => {
  assert.equal(concepts.length, 10);
  const ids = new Set();
  const positions = [0, 0, 0, 0];
  for (const c of concepts) {
    assert.ok(c.source.url.startsWith('https://openstax.org/'));
    assert.equal(c.checks.length, 3);
    assert.equal(c.diagram.length, 3);
    for (const id of c.questionIds)
      assert.ok(
        old.some(q => q.id === id),
        id
      );
    for (const q of [c.diagnostic, ...c.checks]) {
      assert.ok(!ids.has(q.id));
      ids.add(q.id);
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options).size, 4);
      assert.ok(q.stem.length > 20 && q.explanation.length > 20);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4);
      positions[q.answer]++;
    }
  }
  assert.equal(ids.size, 40);
  assert.deepEqual(positions, [10, 10, 10, 10]);
});
test('fresh learner gets an introductory session without an invented weakness', () => {
  const r = core.recommend(concepts, core.empty(), [], now);
  assert.equal(r.kind, 'repair');
  assert.ok(!r.reason.includes('miss'));
});
test('high-confidence misses take priority; latest correct answer resolves a miss', () => {
  const logs = [
    { qId: 'cp-chem-1', ts: now, correct: false, conf: 'unsure' },
    { qId: 'bb-biochem-3', ts: now, correct: false, conf: 'sure' },
  ];
  assert.equal(core.recommend(concepts, core.empty(), logs, now).concept.id, c.id);
  logs.push({ qId: 'bb-biochem-3', ts: now + 1, correct: true, conf: 'sure' });
  assert.equal(core.recommend(concepts, core.empty(), logs, now).concept.id, 'buffers');
});
test('diagnostic alone never earns application evidence', () => {
  const s = core.empty();
  core.begin(c, s, 'repair', now);
  core.answer(c, s, c.diagnostic.answer, 'sure', now);
  assert.equal(core.status(c, s), 'Not checked');
  assert.equal(core.stats(concepts, s).practiced, 0);
});
test('first application is distinct, saved once, and schedules tomorrow', () => {
  const s = firstSession();
  assert.equal(core.status(c, s), 'Passed a new question');
  assert.equal(s.records[c.id].dueAt, now + 1000 + DAY);
  assert.equal(s.records[c.id].attempts.length, 2);
  assert.equal(core.stats(concepts, s).laterTotal, 0);
});
test('incorrect application earns no pass and still schedules practice', () => {
  const s = firstSession(false);
  assert.equal(core.status(c, s), 'Needs practice');
  assert.ok(s.records[c.id].dueAt);
});
test('early later-check requests are rejected and reserve unseen questions', () => {
  const s = firstSession();
  assert.equal(core.begin(c, s, 'later', now + 5000), false);
  assert.equal(core.unseenChecks(c, s).length, 2);
  core.begin(c, s, 'practice', now + 6000);
  core.afterLesson(c, s);
  assert.equal(s.active.questionId, c.checks[0].id);
});
test('an early repair-kind visit replays a seen question and keeps the scheduled check reserved', () => {
  const s = firstSession(),
    due = s.records[c.id].dueAt;
  assert.ok(core.begin(c, s, 'repair', now + 5000));
  core.answer(c, s, c.diagnostic.answer, 'sure', now + 5000);
  s.active.phase = 'lesson';
  core.afterLesson(c, s, now + 5001);
  assert.equal(s.active.questionId, c.checks[0].id);
  const r = core.answer(c, s, c.checks[0].answer, 'sure', now + 5002);
  assert.equal(r.mode, 'practice');
  assert.equal(r.firstExposure, false);
  assert.equal(s.records[c.id].dueAt, due);
  assert.equal(core.unseenChecks(c, s).length, 2);
  assert.equal(core.stats(concepts, s).laterTotal, 0);
  assert.equal(core.status(c, s), 'Passed a new question');
});
test('a repair-kind visit once the check is due still serves a fresh question', () => {
  const s = firstSession(),
    due = s.records[c.id].dueAt;
  core.begin(c, s, 'repair', due);
  core.answer(c, s, c.diagnostic.answer, 'sure', due);
  s.active.phase = 'lesson';
  core.afterLesson(c, s, due + 1);
  assert.equal(s.active.questionId, c.checks[1].id);
});
test('repeat practice cannot create new evidence or postpone the due check', () => {
  const s = firstSession(),
    due = s.records[c.id].dueAt;
  core.begin(c, s, 'practice', now + 5000);
  core.afterLesson(c, s);
  core.answer(c, s, c.checks[0].answer, 'sure', now + 5001);
  assert.equal(core.stats(concepts, s).laterTotal, 0);
  assert.equal(s.records[c.id].dueAt, due);
  assert.equal(core.unseenChecks(c, s).length, 2);
});
test('due session uses a different item and records first-attempt delayed evidence', () => {
  const s = firstSession(),
    due = s.records[c.id].dueAt;
  assert.equal(core.recommend(concepts, s, [], due).kind, 'later');
  core.begin(c, s, 'later', due);
  assert.equal(s.active.questionId, c.checks[1].id);
  core.answer(c, s, c.checks[1].answer, 'sure', due + 100);
  assert.equal(core.status(c, s), 'Passed a later check');
  assert.equal(core.stats(concepts, s).laterCorrect, 1);
  assert.equal(core.stats(concepts, s).laterTotal, 1);
});
test('a later miss remains in denominator; repeated correction is not a delayed pass', () => {
  const s = firstSession(),
    due = s.records[c.id].dueAt;
  core.begin(c, s, 'later', due);
  core.answer(c, s, (c.checks[1].answer + 1) % 4, 'sure', due + 1);
  assert.equal(core.stats(concepts, s).laterTotal, 1);
  assert.equal(core.stats(concepts, s).laterCorrect, 0);
  assert.equal(core.status(c, s), 'Needs practice');
});
test('completed repair suppresses old logs but a new miss is eligible', () => {
  const s = firstSession();
  const oldLogs = [{ qId: 'bb-biochem-3', ts: now - 1, correct: false, conf: 'sure' }];
  assert.equal(core.gaps(concepts, s, oldLogs).length, 0);
  oldLogs.push({ qId: 'bb-biochem-3', ts: now + 2000, correct: false, conf: 'sure' });
  assert.equal(core.gaps(concepts, s, oldLogs).length, 1);
});
test('locked feedback survives refresh and cannot be counted twice', () => {
  const s = firstSession();
  core.begin(c, s, 'later', now + DAY + 1001);
  core.answer(c, s, c.checks[1].answer, 'sure', now + DAY + 1002);
  const restored = core.normalize(JSON.parse(JSON.stringify(s)), concepts);
  assert.equal(restored.active.phase, 'feedback');
  assert.equal(core.answer(c, restored, 0, 'sure', now + DAY + 1003), null);
  assert.equal(restored.records[c.id].attempts.length, 3);
});
test('all authored applications exhausted stops scheduling unseen checks', () => {
  const s = firstSession();
  for (let i = 1; i < 3; i++) {
    const due = s.records[c.id].dueAt;
    core.begin(c, s, 'later', due);
    core.answer(c, s, c.checks[i].answer, 'sure', due + 1);
    s.active = null;
  }
  assert.equal(s.records[c.id].dueAt, 0);
  assert.equal(core.unseenChecks(c, s).length, 0);
  assert.equal(core.begin(c, s, 'later', now + 99 * DAY), false);
});
test('malformed persisted state recovers without losing unrelated learning data', () => {
  for (const v of [null, {}, [], { version: 1, records: [] }])
    assert.deepEqual(core.normalize(v, concepts), core.empty());
  const s = firstSession();
  s.records.junk = {};
  s.active = { conceptId: 'gone' };
  const fixed = core.normalize(s, concepts);
  assert.equal(fixed.active, null);
  assert.equal(fixed.records[c.id].attempts.length, 2);
  assert.ok(!fixed.records.junk);
});
test('repeat correction cannot overwrite a failed fresh later check', () => {
  const s = firstSession(),
    due = s.records[c.id].dueAt;
  core.begin(c, s, 'later', due);
  core.answer(c, s, (c.checks[1].answer + 1) % 4, 'sure', due + 1);
  s.active = null;
  core.begin(c, s, 'practice', due + 2);
  core.afterLesson(c, s);
  core.answer(c, s, c.checks[0].answer, 'sure', due + 3);
  assert.equal(core.status(c, s), 'Needs practice');
  assert.equal(core.stats(concepts, s).laterCorrect, 0);
});
console.log(`${passed} MCAT repair checks passed.`);
