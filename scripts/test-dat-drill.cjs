// The pure DAT drill engine (dat-drill-engine.js, DAT-03): pool building for every scope, the
// seeded shuffle and the display permutation that never reorders a qc/ds/data item, pace targets
// read from the outline rather than a literal, the run summary's arithmetic (accuracy, seconds
// per item against the pace target, the fast-wrong / slow-wrong split and the by-topic grouping)
// and the cs-dat-log row builder's shape. Runs over the real merged bank through dat-data.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../dat-drill-engine.js');
const { outline, questions } = require('./dat-data.cjs');

const SNS = outline.blocks.find(b => b.id === 'sns').sections;
const FIXED = ['qc', 'ds', 'data'];
const ids = list => list.map(q => q.id);

test('pool filters by every scope the runner offers and leaves the bank untouched', () => {
  const before = ids(questions);

  assert.deepEqual(ids(Core.pool(questions, outline, {})), before, 'no scope keeps the whole bank');

  for (const section of Object.keys(outline.sections)) {
    const got = Core.pool(questions, outline, { section });
    assert.deepEqual(ids(got), ids(questions.filter(q => q.section === section)), section + ' keeps authored order');
    assert.ok(
      got.every(q => q.section === section),
      section + ' is pure'
    );
  }

  // `mixed` is the SNS block read from the outline, so QR/RC/PAT items never reach an SNS drill.
  const mixed = Core.pool(questions, outline, { section: 'mixed' });
  assert.deepEqual(
    [...new Set(mixed.map(q => q.section))].sort(),
    [...SNS].sort(),
    'mixed draws exactly the outline SNS sections'
  );
  assert.ok(!mixed.some(q => q.section === 'qr'));
  assert.equal(
    mixed.length,
    SNS.reduce((n, s) => n + questions.filter(q => q.section === s).length, 0)
  );

  const category = Core.pool(questions, outline, { section: 'bio', category: 'BIO-1' });
  assert.ok(category.length > 0);
  assert.ok(category.every(q => q.category === 'BIO-1'));

  const topic = category[0].topic;
  const scoped = Core.pool(questions, outline, { category: 'BIO-1', topic });
  assert.ok(scoped.length > 0);
  assert.ok(scoped.every(q => q.category === 'BIO-1' && q.topic === topic));

  // Category and topic narrow without a section, and an impossible pair yields nothing.
  assert.deepEqual(Core.pool(questions, outline, { section: 'gchem', category: 'BIO-1' }), []);
  assert.deepEqual(Core.pool(questions, outline, { category: 'BIO-1', topic: 'not a topic' }), []);
});

test('pool honours an exclusion list given as a Set or an array', () => {
  const bio = Core.pool(questions, outline, { section: 'bio' });
  const drop = [bio[0].id, bio[1].id];
  for (const exclude of [new Set(drop), drop]) {
    const got = Core.pool(questions, outline, { section: 'bio', exclude });
    assert.equal(got.length, bio.length - 2);
    assert.ok(!got.some(q => drop.includes(q.id)));
  }
  assert.equal(Core.pool(questions, outline, { section: 'bio', exclude: null }).length, bio.length);
});

test('mixedSections comes from the outline block, not from a hard-coded section list', () => {
  assert.deepEqual(Core.mixedSections(outline), SNS);
  assert.deepEqual(
    Core.mixedSections({ blocks: [{ id: 'sns', sections: ['alpha', 'beta'] }] }),
    ['alpha', 'beta'],
    'a re-sectioned outline re-sections the drill'
  );
  // Only a missing or empty block falls back to the built-in default.
  assert.deepEqual(Core.mixedSections({ blocks: [{ id: 'sns', sections: [] }] }), ['bio', 'gchem', 'ochem']);
  assert.deepEqual(Core.mixedSections(null), ['bio', 'gchem', 'ochem']);
});

test('the seeded shuffle is deterministic, a true permutation and seed-sensitive', () => {
  const list = Array.from({ length: 40 }, (_, i) => 'q' + i);
  assert.deepEqual(Core.shuffle(list, 12345), Core.shuffle(list, 12345), 'same seed, same order');
  assert.deepEqual(Core.shuffle(list, 'abc'), Core.shuffle(list, 'abc'), 'string seeds hash stably');
  assert.notDeepEqual(Core.shuffle(list, 1), Core.shuffle(list, 2));
  assert.deepEqual([...Core.shuffle(list, 7)].sort(), [...list].sort(), 'nothing is added or lost');
  assert.deepEqual(Core.shuffle(list, 7).length, list.length);
  assert.deepEqual(
    list,
    Array.from({ length: 40 }, (_, i) => 'q' + i),
    'the input array is not mutated'
  );
  assert.deepEqual(Core.shuffle([], 3), []);
  assert.deepEqual(Core.shuffle(null, 3), []);
  // Over many seeds the first slot lands on many different items: the shuffle really shuffles.
  const firsts = new Set(Array.from({ length: 200 }, (_, s) => Core.shuffle(list, s)[0]));
  assert.ok(firsts.size > 10, 'seeds spread the deal');
});

test('orderOptions permutes a standard item and never reorders qc, ds or data options', () => {
  const standard = questions.find(q => (q.format || 'standard') === 'standard');
  assert.ok(standard, 'the merged bank has a standard-format item to permute');
  const identity = Array.from({ length: standard.options.length }, (_, i) => i);
  assert.deepEqual(Core.orderOptions(standard, 4), Core.orderOptions(standard, 4), 'deterministic per seed');
  for (let seed = 0; seed < 50; seed++) {
    const order = Core.orderOptions(standard, seed);
    assert.deepEqual(
      [...order].sort((a, b) => a - b),
      identity,
      'seed ' + seed + ' is a permutation'
    );
  }
  assert.ok(
    Array.from({ length: 50 }, (_, s) => Core.orderOptions(standard, s)).some(o => !o.every((v, i) => v === i)),
    'some seed actually moves a standard item'
  );

  // The fixed-order formats carry canonical answer sets; their display order is the authored order.
  for (const format of FIXED) {
    const item = questions.find(q => q.format === format);
    assert.ok(item, 'the bank seeds a ' + format + ' item');
    const fixedIdentity = Array.from({ length: item.options.length }, (_, i) => i);
    for (let seed = 0; seed < 200; seed++)
      assert.deepEqual(Core.orderOptions(item, seed), fixedIdentity, format + ' never shuffles (seed ' + seed + ')');
    assert.deepEqual(Core.orderOptions(item), fixedIdentity, 'not even without a seed');
  }
  // Every fixed-format item in the bank, whatever its option count.
  for (const item of questions.filter(q => FIXED.includes(q.format)))
    assert.deepEqual(
      Core.orderOptions(item, 99),
      Array.from({ length: item.options.length }, (_, i) => i),
      item.id
    );
  // Falling back to the item id as the seed still yields a permutation.
  assert.deepEqual(
    [...Core.orderOptions(standard)].sort((a, b) => a - b),
    identity
  );
  assert.deepEqual(Core.orderOptions({}, 1), []);
});

test('the qc and ds canonical option sets survive the display order verbatim', () => {
  for (const format of ['qc', 'ds']) {
    const item = questions.find(q => q.format === format);
    const canonical = outline.optionPolicy[format].canonical;
    assert.equal(item.options.length, outline.optionPolicy[format].options);
    assert.deepEqual(
      Core.orderOptions(item, 31).map(i => item.options[i]),
      canonical,
      format + ' renders the canonical set in order'
    );
  }
});

test('pace targets are read from the outline, per section, never from a literal', () => {
  for (const [section, seconds] of Object.entries(outline.pacingSeconds)) {
    assert.equal(Core.pace(outline, section), seconds, section + ' by key');
    assert.equal(Core.pace(outline, { section }), seconds, section + ' by item');
  }
  const item = questions.find(q => q.section === 'bio');
  assert.equal(Core.pace(outline, item), outline.pacingSeconds.bio);
  // Change the outline and the pace changes with it — nothing pins 54 in the engine.
  const edited = { pacingSeconds: Object.assign({}, outline.pacingSeconds, { bio: 41 }) };
  assert.equal(Core.pace(edited, item), 41);
  // A section the outline does not pace falls back to a neutral minute.
  assert.equal(Core.pace(outline, { section: 'nope' }), 60);
  assert.equal(Core.pace(null, item), 60);
  assert.equal(Core.pace({ pacingSeconds: { bio: 0 } }, item), 60);
});

test('policyKey routes an item to the option policy the outline states', () => {
  assert.equal(
    Core.policyKey(
      outline,
      questions.find(q => q.section === 'bio')
    ),
    'sns'
  );
  assert.equal(
    Core.policyKey(
      outline,
      questions.find(q => q.section === 'gchem')
    ),
    'sns'
  );
  assert.equal(
    Core.policyKey(
      outline,
      questions.find(q => q.section === 'ochem')
    ),
    'sns'
  );
  assert.equal(
    Core.policyKey(
      outline,
      questions.find(q => q.format === 'qc')
    ),
    'qc'
  );
  assert.equal(
    Core.policyKey(
      outline,
      questions.find(q => q.format === 'ds')
    ),
    'ds'
  );
  assert.equal(Core.policyKey(outline, { section: 'qr', format: 'standard' }), 'qr');
  // Every key policyKey can produce for a bank item exists in the outline's policy.
  for (const item of questions) assert.ok(outline.optionPolicy[Core.policyKey(outline, item)], item.id);
  // …and each item carries exactly the option count that policy states.
  for (const item of questions)
    assert.equal(item.options.length, outline.optionPolicy[Core.policyKey(outline, item)].options, item.id);
});

test('letters come from the shared LETTERS list and stop at the option count', () => {
  const saved = globalThis.LETTERS;
  globalThis.LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  try {
    assert.deepEqual(Core.letters(outline.optionPolicy.sns.options), ['A', 'B', 'C', 'D', 'E']);
    assert.deepEqual(Core.letters(outline.optionPolicy.qc.options), ['A', 'B', 'C', 'D']);
    assert.equal(Core.letters(5).length, 5);
    globalThis.LETTERS = ['A', 'B'];
    assert.deepEqual(Core.letters(4), ['A', 'B', 'C', 'D'], 'a short LETTERS falls back to the alphabet');
    delete globalThis.LETTERS;
    assert.deepEqual(Core.letters(3), ['A', 'B', 'C']);
  } finally {
    if (saved === undefined) delete globalThis.LETTERS;
    else globalThis.LETTERS = saved;
  }
});

test('groupSets keeps the members of a data set adjacent at the first member drawn', () => {
  const set = [
    { id: 'a' },
    { id: 's2', setId: 'S' },
    { id: 'b' },
    { id: 's1', setId: 'S' },
    { id: 's3', setId: 'S' },
    { id: 'c' },
  ];
  assert.deepEqual(ids(Core.groupSets(set)), ['a', 's2', 's1', 's3', 'b', 'c']);
  assert.deepEqual(ids(Core.groupSets([{ id: 'a' }, { id: 'b' }])), ['a', 'b'], 'setless lists are unchanged');
  assert.deepEqual(Core.groupSets([]), []);
  assert.deepEqual(Core.groupSets(null), []);
  // Two sets interleaved each collapse to their first member's position.
  const two = [
    { id: 'x1', setId: 'X' },
    { id: 'y1', setId: 'Y' },
    { id: 'x2', setId: 'X' },
    { id: 'y2', setId: 'Y' },
  ];
  assert.deepEqual(ids(Core.groupSets(two)), ['x1', 'x2', 'y1', 'y2']);
  // The real bank round-trips: same members, no duplicates.
  const bio = Core.pool(questions, outline, { section: 'qr' });
  assert.deepEqual(ids(Core.groupSets(bio)).sort(), ids(bio).sort());
});

// 54 s pace: 40 s is inside it, 90 s is over it.
const RUN = {
  paceSeconds: 54,
  attemptId: 'dat-run-1',
  results: [
    { id: 'q1', section: 'bio', category: 'BIO-1', topic: 'Cells', correct: true, chosen: 2, ms: 40000 },
    { id: 'q2', section: 'bio', category: 'BIO-1', topic: 'Cells', correct: false, chosen: 1, ms: 12000 },
    { id: 'q3', section: 'bio', category: 'BIO-2', topic: 'Fungi', correct: false, chosen: 0, ms: 90000 },
    { id: 'q4', section: 'gchem', category: 'GC-1', topic: 'Moles', correct: true, chosen: 3, ms: 62000 },
    { id: 'q5', section: 'gchem', category: 'GC-1', topic: 'Moles', correct: false, chosen: null, ms: null },
  ],
};

test('summary reports accuracy, seconds per item against the pace target and the wrong-answer split', () => {
  const s = Core.summary(RUN);
  assert.equal(s.n, 5);
  assert.equal(s.correct, 2);
  assert.equal(s.accuracy, 2 / 5);
  assert.equal(s.paceSeconds, 54, 'the target travels with the run, not with the engine');
  // Mean over the four timed items only; the unanswered one never drags the average down.
  assert.equal(s.msPerItem, Math.round((40000 + 12000 + 90000 + 62000) / 4));
  assert.equal(s.overPace, 2, 'q3 and q4 ran past 54 s');
  assert.equal(s.fastWrong, 1, 'q2: wrong inside the pace target');
  assert.equal(s.slowWrong, 2, 'q3 ran over; q5 never came back');
  assert.equal(s.unanswered, 1);
  assert.equal(s.fastWrong + s.slowWrong, s.n - s.correct, 'every miss lands on exactly one side of the split');
});

test('summary groups by category and by topic, and each topic row names its category', () => {
  const s = Core.summary(RUN);
  assert.deepEqual(s.byCategory, {
    'BIO-1': { n: 2, correct: 1 },
    'BIO-2': { n: 1, correct: 0 },
    'GC-1': { n: 2, correct: 1 },
  });
  assert.deepEqual(s.byTopic, {
    Cells: { n: 2, correct: 1, category: 'BIO-1' },
    Fungi: { n: 1, correct: 0, category: 'BIO-2' },
    Moles: { n: 2, correct: 1, category: 'GC-1' },
  });
  // A result with no topic is counted in the run but adds no phantom row.
  const s2 = Core.summary({ paceSeconds: 54, results: [{ id: 'q', category: 'BIO-1', correct: true, ms: 1000 }] });
  assert.deepEqual(s2.byTopic, {});
  assert.deepEqual(s2.byCategory, { 'BIO-1': { n: 1, correct: 1 } });
});

test('summary degrades safely: empty runs, untimed runs and holes in the results array', () => {
  const empty = Core.summary({ results: [], paceSeconds: 54 });
  assert.equal(empty.n, 0);
  assert.equal(empty.accuracy, 0);
  assert.equal(empty.msPerItem, 0);
  assert.equal(empty.overPace, 0);
  assert.deepEqual(empty.byTopic, {});
  assert.equal(Core.summary(null).n, 0);
  assert.equal(Core.summary({ results: [null, undefined] }).n, 0, 'holes are dropped, not counted');

  // Untimed: no pace target, so nothing is "over pace" and every miss is a fast-wrong.
  const untimed = Core.summary({
    paceSeconds: 0,
    results: [
      { id: 'a', topic: 'T', category: 'C', correct: false, chosen: 1, ms: 300000 },
      { id: 'b', topic: 'T', category: 'C', correct: true, chosen: 0, ms: 1000 },
    ],
  });
  assert.equal(untimed.overPace, 0);
  assert.equal(untimed.slowWrong, 0);
  assert.equal(untimed.fastWrong, 1);
  assert.equal(untimed.msPerItem, Math.round(301000 / 2));
  // Exactly on the target is not over it.
  const onPace = Core.summary({ paceSeconds: 54, results: [{ id: 'a', correct: false, chosen: 1, ms: 54000 }] });
  assert.equal(onPace.overPace, 0);
  assert.equal(onPace.fastWrong, 1);
});

test('logRow builds one cs-dat-log row with the documented shape, topic included', () => {
  const entry = {
    id: 'bio-cell-1',
    section: 'bio',
    category: 'BIO-1',
    topic: 'Cell structure and function',
    correct: true,
    conf: 'sure',
    ms: 31000,
  };
  const row = Core.logRow({ attemptId: 'dat-abc' }, entry, 1700);
  assert.deepEqual(Object.keys(row).sort(), [
    'attemptId',
    'category',
    'conf',
    'correct',
    'ms',
    'qId',
    'section',
    'source',
    'topic',
    'ts',
  ]);
  assert.deepEqual(row, {
    qId: 'bio-cell-1',
    section: 'bio',
    category: 'BIO-1',
    topic: 'Cell structure and function',
    correct: true,
    conf: 'sure',
    ms: 31000,
    ts: 1700,
    attemptId: 'dat-abc',
    source: 'drill',
  });

  // Defaults: no run, no confidence, no timing, and a caller-supplied timestamp wins.
  const bare = Core.logRow(null, { id: 'q', section: 'bio', category: 'BIO-1', topic: 'T', correct: 0 }, 42);
  assert.equal(bare.correct, false, 'correct is always a boolean');
  assert.equal(bare.conf, null);
  assert.equal(bare.ms, null, 'an unanswered item logs no duration');
  assert.equal(bare.attemptId, null);
  assert.equal(bare.source, 'drill');
  assert.equal(bare.ts, 42);
  assert.equal(Core.logRow(null, { id: 'q', ts: 9 }, 42).ts, 9, 'the entry timestamp wins over the clock');
  assert.equal(Core.logRow({ source: 'review' }, { id: 'q' }, 1).source, 'review', 'the run names the source');
  // A drill result feeds straight in, and the row carries no rendered markup.
  for (const value of Object.values(Core.logRow({ attemptId: 'a', source: 'drill' }, RUN.results[0], 1)))
    assert.ok(typeof value !== 'string' || !value.includes('<'), 'log rows stay plain');
});

/* ---------- DAT-05: the SM-2 schedule behind the mistake log ---------- */
test('schedule: again lapses the record and brings it back in a minute; ease never drops below 1.3', () => {
  const t = 1_000_000;
  const rec = Core.srsRec({}, 'x');
  Core.schedule(rec, 'again', t);
  assert.deepEqual([rec.reps, rec.interval, rec.lapses, rec.due, rec.last], [0, 0, 1, t + 60000, t]);
  assert.equal(rec.ease, 2.3);
  for (let i = 0; i < 20; i++) Core.schedule(rec, 'again', t);
  assert.equal(rec.ease, 1.3);
});

test('schedule: good gives 1, then 3 days, then grows by ease; hard and easy bend both', () => {
  const t = 0,
    DAY = Core.DAY;
  const good = Core.srsRec({}, 'g');
  Core.schedule(good, 'good', t);
  assert.equal(good.interval, 1);
  Core.schedule(good, 'good', t);
  assert.equal(good.interval, 3);
  Core.schedule(good, 'good', t);
  assert.equal(good.interval, Math.round(3 * 2.5), 'after two reps the interval multiplies by ease');
  assert.equal(good.due, 8 * DAY);
  const easy = Core.srsRec({}, 'e');
  Core.schedule(easy, 'easy', t);
  assert.deepEqual([easy.interval, easy.ease], [3, 2.65]);
  const hard = Core.srsRec({}, 'h');
  Core.schedule(hard, 'good', t);
  Core.schedule(hard, 'hard', t);
  assert.deepEqual([hard.interval, hard.ease], [3, 2.35]);
});

test('enroll starts a missed item due in a minute and lapses a repeat miss; dueMistakes lists the due ones oldest first', () => {
  const srs = {};
  const item = { id: 'bio-1', section: 'bio', category: 'BIO-1', topic: 'Cells' };
  Core.enroll(srs, item, 1000);
  assert.deepEqual(
    [srs['bio-1'].due, srs['bio-1'].lapses, srs['bio-1'].section, srs['bio-1'].topic],
    [61000, 0, 'bio', 'Cells']
  );
  srs['bio-1'].extra = 'kept';
  Core.enroll(srs, item, 5000);
  assert.deepEqual([srs['bio-1'].lapses, srs['bio-1'].due, srs['bio-1'].extra], [1, 65000, 'kept']);
  srs.early = { due: 10 };
  srs.later = { due: 70000 };
  srs.broken = { due: NaN };
  assert.deepEqual(
    Core.dueMistakes(srs, 66000).map(r => r.id),
    ['early', 'bio-1'],
    'due now, most overdue first; future and malformed records are left out'
  );
});
