// McatCourseCore (unchanged engine) over the merged DAT course: gating, scheduling and
// recommendation behave as they do for the MCAT course. Twin of test-mcat-course.cjs with
// the option count read from outline.optionPolicy.course instead of a literal.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../mcat-course-engine.js');
const { outline, course: data, cards, questions } = require('./dat-data.cjs');

const OPTIONS = outline.optionPolicy.course.options;
const cardIds = new Set(cards.map(c => c.id)),
  questionIds = new Set(questions.map(q => q.id));

test('the merged DAT course has the ROOT shape the engine reads and every reference resolves', () => {
  assert.equal(data.version, 1);
  assert.equal(data.categories.length, 37);
  assert.equal(new Set(data.categories.map(c => c.id)).size, 37);
  assert.equal(data.chapters.length, 16);
  assert.ok(data.units.length >= 6);
  for (const chapter of data.chapters) {
    assert.ok(chapter.id && chapter.title && outline.sections[chapter.section], chapter.id);
    assert.deepEqual(
      chapter.units,
      data.units.filter(u => u.chapter === chapter.id).map(u => u.id)
    );
    for (const p of chapter.prerequisites)
      assert.ok(
        data.chapters.some(c => c.id === p),
        chapter.id + ' prerequisite ' + p
      );
  }
  for (const u of data.units) {
    assert.equal(u.questions.length, 6);
    assert.equal(u.questions[0].kind, 'diagnostic');
    assert.equal(u.questions.at(-1).kind, 'delayed');
    for (const q of u.questions) {
      assert.equal(q.options.length, OPTIONS, q.id);
      assert.ok(q.answer >= 0 && q.answer < OPTIONS, q.id);
      assert.ok(q.explanation.length > 30, q.id);
    }
    for (const id of u.cards) assert.ok(cardIds.has(id), id);
    for (const id of u.questionIds) assert.ok(questionIds.has(id), id);
    for (const id of u.prerequisites)
      assert.ok(
        data.units.some(x => x.id === id),
        id
      );
    assert.deepEqual(u.passages, [], u.id + ' has no passages until RC content lands');
  }
});

test('completion gates on both checks, first answers are immutable and the delayed schedule advances', () => {
  let s = core.normalize({});
  const u = data.units[0],
    now = 1000000,
    r = core.record(s, u.id);
  assert.equal(core.complete(s, u, now), false);
  r.learnedAt = now;
  r.exploredAt = now;
  const checks = u.questions.filter(q => q.kind === 'check');
  core.answer(s, u, checks[0], (checks[0].answer + 1) % OPTIONS, 'sure', now);
  core.answer(s, u, checks[0], checks[0].answer, 'sure', now + 1);
  assert.equal(r.attempts.length, 1);
  assert.equal(r.attempts[0].correct, false);
  assert.equal(core.complete(s, u, now), false);
  core.answer(s, u, checks[1], checks[1].answer, 'unsure', now);
  assert.ok(core.complete(s, u, now));
  assert.equal(r.dueAt, now + core.DAY);
  assert.equal(core.answer(s, u, u.questions[3], u.questions[3].answer, 'sure', now + core.DAY - 1), null);
  assert.equal(core.recommendation(data, s, [], now + core.DAY).kind, 'delayed');
  assert.ok(core.answer(s, u, u.questions[3], u.questions[3].answer, 'sure', now + core.DAY));
  assert.equal(r.dueAt, now + core.DAY * 4);
  core.answer(s, u, u.questions[3], (u.questions[3].answer + 1) % OPTIONS, 'guess', now + core.DAY * 3);
  assert.equal(r.attempts.length, 3);
  core.complete(s, u, now + core.DAY * 3);
  assert.equal(r.dueAt, now + core.DAY * 4);
  assert.deepEqual(core.metrics(data, s).first, { correct: 1, total: 2 });
  assert.deepEqual(core.metrics(data, s).delayed, { correct: 1, total: 1 });
  assert.equal(core.metrics(data, s).available, data.units.length);
});

test('placement, preferred and active units drive the recommendation over DAT units', () => {
  const now = 1000000,
    [first, second] = data.units;
  let s = core.normalize({
    placement: { answers: { [second.id]: { chosen: 1, correct: false, confidence: 'sure' } }, background: {} },
  });
  const rec = core.recommendation(data, s, [], now);
  assert.ok(rec.unit, 'a missed placement item points at a unit');
  assert.ok(data.units.some(u => u.id === rec.unit.id));
  s.preferredUnit = first.id;
  assert.equal(core.recommendation(data, s, [], now).unit.id, first.id);
  s.activeUnit = second.id;
  assert.equal(core.recommendation(data, s, [], now).kind, 'resume');
  s = core.normalize({});
  assert.equal(core.recommendation(data, s, [], now).kind !== 'resume', true);
  const placement = data.units.filter(u => u.placementEligible);
  assert.ok(placement.length >= 6, 'every seed unit is placement-eligible until its chapter grows');
});
