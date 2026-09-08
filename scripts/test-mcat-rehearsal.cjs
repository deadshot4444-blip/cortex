const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Core = require('../mcat-rehearsal-engine.js');
const manifest = JSON.parse(fs.readFileSync('data/mcat-rehearsals.json'));
const bank = {
  cars: JSON.parse(fs.readFileSync('data/mcat-cars.json')),
  sci: JSON.parse(fs.readFileSync('data/mcat-science-passages.json')),
  questions: JSON.parse(fs.readFileSync('data/mcat-questions.json')),
};
const clone = value => JSON.parse(JSON.stringify(value));
const queue = manifest.forms.map(f => Core.assemble(f, bank, manifest.protectedPassages));
const start = 1800000000000;
const run = (mode = 'continuous', sections = queue) =>
  Core.create(sections, { mode, repeatAcknowledged: false, priorExposureSelfReport: 'unsure' }, 'attempt-test', start);

test('four fixed forms have the exact supplied format, unchanged passage text and no repeated IDs', async () => {
  for (const form of manifest.forms) {
    const section = await Core.verify(form, bank, manifest.protectedPassages);
    assert.equal(section.items.length, form.section === 'cars' ? 53 : 59);
    for (const item of section.items.filter(it => it.passageId))
      assert.equal(item.passageText, [...bank.cars, ...bank.sci].find(p => p.id === item.passageId).text);
  }
  assert.equal(
    queue.reduce((n, s) => n + s.items.length, 0),
    230
  );
  assert.equal(new Set(queue.flatMap(s => s.items.map(it => it.q.id))).size, 230);
  assert.equal(Core.fullLengthEligible(queue), false);
  const changed = clone(bank);
  changed.sci.find(p => p.id === manifest.forms[0].passages[0].id).questions[0].explanation += ' Changed.';
  await assert.rejects(Core.verify(manifest.forms[0], changed, manifest.protectedPassages), /changed/);
});
test('missing, duplicate, protected or wrong-length questions cannot silently yield a shorter form', () => {
  for (const change of [
    f => f.passages.pop(),
    f => f.discretes.pop(),
    f => (f.passages[0].questions[0] = 'missing'),
    f => (f.passages[1] = f.passages[0]),
    f => (f.minutes = 94),
  ]) {
    const form = clone(manifest.forms[0]);
    change(form);
    assert.throws(() => Core.assemble(form, bank));
  }
  assert.throws(() => Core.assemble(manifest.forms[0], bank, [manifest.forms[0].passages[0].id]), /reserved/);
  const form = clone(manifest.forms[0]);
  form.status = 'reviewed';
  assert.throws(() => Core.assemble(form, bank), /review/);
});
test('exposure distinguishes recorded displays from legacy history and absence of a record', () => {
  const state = Core.emptyExposure(),
    item = queue[0].items[0],
    other = queue[0].items[1];
  assert.equal(Core.exposure(queue[0], state).hasKnownExposure, false);
  Core.expose(state, { questionId: item.q.id, passageId: item.passageId, context: 'practice' }, start);
  Core.expose(state, { questionId: item.q.id, passageId: item.passageId, context: 'practice' }, start + 1);
  const e = Core.exposure(queue[0], state, { [other.q.id]: { n: 1 } });
  assert.deepEqual(e.seenQuestions, [item.q.id]);
  assert.deepEqual(e.seenPassages, [item.passageId]);
  assert.deepEqual(e.recordedQuestions, [other.q.id]);
  assert.equal(e.hasKnownExposure, true);
  assert.equal(state.questions[item.q.id].contexts.length, 1);
  assert.ok(Core.validExposure(state));
  Core.reserve(state, queue[0], true);
  const reserved = Core.reservedItems(state);
  assert.equal(reserved.passages.size, 10);
  assert.equal(reserved.questions.size, 59);
  assert.ok(Core.validExposure(clone(state)));
  assert.deepEqual(Core.reservedItems(clone(state)), reserved);
  Core.reserve(state, queue[0], false);
  assert.equal(Core.reservedItems(state).questions.size, 0);
});
test('snapshots retain passage tables, options and original form metadata after source changes', () => {
  const source = clone(queue),
    r = Core.create(source, { mode: 'continuous' }, 'frozen', start),
    before = clone(r.queue);
  source[0].items[0].q.answer = (source[0].items[0].q.answer + 1) % 4;
  source[0].items[0].passageText = 'Changed';
  assert.deepEqual(r.queue, before);
  assert.ok(r.queue[0].items.some(it => it.table));
  assert.ok(Core.validRun(r));
});
test('continuous reload does not give time back and a displayed interval is not assumed observed while closed', () => {
  const r = run();
  Core.begin(r, start);
  Core.present(r, 0, start + 1000);
  Core.answer(r, 2, start + 2000);
  const deadline = r.deadline;
  r._saved = start + 3000;
  r._remain = deadline - r._saved;
  const restored = clone(r);
  Core.resume(restored, start + 600000, { reload: true });
  assert.equal(restored.deadline, deadline);
  assert.equal(restored.timing.sections[0].visibleAt, null);
  assert.equal(restored.timing.unobservedInterval, true);
  Core.interrupt(restored, 'hidden-tab', start + 700000);
  Core.resume(restored, start + 800000);
  assert.equal(restored.deadline, deadline);
  assert.equal(restored.timing.interruptions.at(-1).resumedAt, start + 800000);
  assert.equal(Core.answer(restored, 1, deadline), false);
  assert.equal(restored.answers['0:0'], 2);
  const result = Core.submit(restored, deadline + 1);
  assert.equal(result.reason, 'time-expired');
  assert.equal(result.elapsedMs, 95 * 60000);
  assert.equal(Core.submit(restored, deadline + 2), null);
  assert.ok(Core.validRun(restored));
});
test('flexible pause/resume preserves remaining time and records interruptions instead of claiming continuous timing', () => {
  const r = run('flexible');
  Core.begin(r, start);
  Core.present(r, 0, start + 1000);
  Core.interrupt(r, 'left-workspace', start + 60000);
  const remaining = r._remain;
  assert.equal(Core.answer(r, 1, start + 70000), false);
  Core.resume(r, start + 3600000);
  assert.equal(r.deadline, start + 3600000 + remaining);
  assert.equal(r.timing.interruptions[0].resumedAt, start + 3600000);
  assert.equal(r.timing.sections[0].displayMs['0:0'], 59000);
  const copy = clone(r);
  copy._saved = start + 3601000;
  copy._remain = copy.deadline - copy._saved;
  Core.resume(copy, start + 7200000, { reload: true });
  assert.equal(copy.deadline, start + 7200000 + copy._remain);
});
test('first answers stay fixed while final answers can change before submission', () => {
  const r = run();
  Core.begin(r, start);
  Core.present(r, 0, start + 1000);
  Core.answer(r, 1, start + 2000);
  Core.answer(r, 2, start + 3000);
  assert.equal(r.firstAnswers['0:0'].chosen, 1);
  assert.equal(r.answers['0:0'], 2);
  Core.present(r, 1, start + 10000);
  const result = Core.submit(r, start + 15000);
  assert.equal(result.firstAnswers['0:0'].chosen, 1);
  assert.equal(result.answers['0:0'], 2);
  assert.equal(result.unanswered, 58);
  assert.equal(result.displayMs['0:0'], 9000);
  assert.equal(result.displayMs['0:1'], 5000);
  assert.equal(Core.answer(r, 3, start + 16000), false);
  assert.equal(r.results.length, 1);
});
test('continuous late return keeps section and break boundaries instead of adding free breaks', () => {
  const r = run();
  Core.begin(r, start);
  const firstDeadline = r.deadline,
    late = start + 8 * 3600000;
  Core.resume(r, late, { reload: true });
  Core.submit(r, late);
  Core.next(r, late);
  assert.equal(r.timing.breaks[0].startedAt, firstDeadline);
  assert.equal(r.timing.breaks[0].targetMs, 10 * 60000);
  Core.endBreak(r, late);
  assert.equal(r.timing.sections[1].startedAt, firstDeadline + 10 * 60000);
  assert.equal(Core.present(r, 0, late), false);
  Core.submit(r, late);
  Core.next(r, late);
  assert.equal(r.timing.breaks[1].targetMs, 30 * 60000);
  Core.endBreak(r, late);
  Core.submit(r, late);
  Core.next(r, late);
  assert.equal(r.timing.breaks[2].targetMs, 10 * 60000);
  Core.endBreak(r, late);
  Core.submit(r, late);
  Core.next(r, late);
  assert.equal(r.phase, 'finished');
  assert.equal(r.results.length, 4);
  assert.ok(r.results.every(result => result.reason === 'time-expired'));
  assert.deepEqual(r.seen, []);
  assert.ok(Core.validRun(r));
});
test('early breaks and ending a partial run retain the submitted section without exposing later answers', () => {
  const r = run();
  Core.begin(r, start);
  Core.submit(r, start + 10000);
  Core.next(r, start + 10000);
  Core.endBreak(r, start + 20000);
  assert.equal(r.timing.sections[1].startedAt, start + 20000);
  Core.submit(r, start + 25000);
  Core.next(r, start + 25000);
  Core.finishEarly(r, start + 30000);
  assert.equal(r.results.length, 2);
  assert.equal(r.stoppedEarly, true);
  assert.equal(r.phase, 'finished');
  assert.ok(Core.validRun(r));
});
test('clock rollback is flagged and invalid saved answer/state shapes are rejected', () => {
  const r = run();
  Core.begin(r, start);
  Core.present(r, 0, start + 1000);
  Core.answer(r, 0, start + 2000);
  Core.answer(r, 1, start + 1000);
  assert.equal(r.timing.clockChanged, true);
  assert.equal(r.timing.lastObservedAt, start + 2000);
  for (const change of [
    r => (r.answers['0:0'] = 4),
    r => delete r.firstAnswers['0:0'],
    r => (r.si = 5),
    r => r.queue[0].items.pop(),
    r => (r.deadline = null),
    r => (r.phase = 'unknown'),
  ]) {
    const bad = clone(r);
    change(bad);
    assert.equal(Core.validRun(bad), false);
  }
  const clock = clone(r);
  clock.timing.sections[0].deadline = null;
  assert.equal(Core.validRun(clock), false);
  Core.submit(r, start + 20000);
  const score = clone(r);
  score.results[0].correct = 59;
  assert.equal(Core.validRun(score), false);
  const answer = clone(r);
  answer.results[0].answers['0:0'] = 3;
  assert.equal(Core.validRun(answer), false);
});
test('compact storage retains every passage/table and reconstructs full reviews without the catalog', () => {
  const r = run();
  Core.begin(r, start);
  Core.present(r, 0, start + 1000);
  Core.answer(r, 1, start + 2000);
  Core.submit(r, start + 3000);
  Core.next(r, start + 3000);
  Core.finishEarly(r, start + 4000);
  const packed = Core.pack(r),
    restored = Core.unpack(packed);
  assert.deepEqual(restored, r);
  assert.ok(JSON.stringify(packed).length < JSON.stringify(r).length * 0.8);
  const bad = clone(packed);
  delete bad.queue[0].passages[bad.queue[0].items[0].passageId];
  assert.throws(() => Core.unpack(bad), /passage/);
  assert.throws(() => Core.unpack({ ...packed, compact: 2 }), /format/);
});
test('fixed option presentation balances CARS without changing canonical answers or older run labels', () => {
  const V2 = require('../mcat-v2-engine.js'),
    section = queue.find(s => s.key === 'cars'),
    counts = [0, 0, 0, 0];
  for (const item of section.items) {
    const source = bank.cars.find(p => p.id === item.passageId).questions.find(q => q.id === item.q.id);
    assert.deepEqual(item.q.options, source.options);
    assert.equal(item.q.answer, source.answer);
    const order = V2.optionOrder(item.q.options, item.q.displayOrder),
      position = order.indexOf(item.q.answer);
    counts[position]++;
    assert.equal(V2.optionLabel(item.q, item.q.answer), 'ABCD'[position]);
  }
  assert.deepEqual(counts, [14, 13, 13, 13]);
  const current = Core.create([section], { mode: 'continuous' }, 'ordered', start),
    restored = Core.unpack(Core.pack(current));
  assert.deepEqual(restored.queue, current.queue);
  assert.ok(restored.queue[0].items.some(it => it.sources?.length));
  const legacy = clone(current);
  legacy.queue[0].items.forEach(it => delete it.q.displayOrder);
  assert.ok(Core.validRun(legacy));
  assert.equal(V2.optionLabel(Core.unpack(Core.pack(legacy)).queue[0].items[0].q, 1), 'B');
});
test('incomplete and invalid form option maps cannot silently fall back to a different presentation', () => {
  const source = manifest.forms.find(f => f.section === 'cars'),
    missing = clone(source),
    invalid = clone(source),
    key = source.passages[0].questions[0];
  delete missing.optionOrders[key];
  invalid.optionOrders[key] = [0, 0, 2, 3];
  assert.throws(() => Core.assemble(missing, bank), /presentation/);
  assert.throws(() => Core.assemble(invalid, bank), /presentation/);
  const corrupt = Core.create([queue.find(s => s.key === 'cars')], { mode: 'continuous' }, 'corrupt-order', start);
  corrupt.queue[0].items[0].q.displayOrder = [0, 0, 2, 3];
  assert.equal(Core.validRun(corrupt), false);
});
