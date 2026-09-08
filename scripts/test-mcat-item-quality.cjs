const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto').webcrypto;
const Core = require('../mcat-item-quality-core.js');
const clone = x => JSON.parse(JSON.stringify(x));
const q = {
  id: 'q1',
  stem: 'Which option follows?',
  options: ['Supported', 'Distractor'],
  answer: 0,
  explanation: 'The first follows from the evidence.',
};
const a = (id = 'q1', chosen = 0, ts = 100) => ({
  qId: id,
  chosen,
  correct: chosen === 0,
  kind: 'check',
  ts,
  questionSnapshot: { ...q, id },
});
const analyze = (data, now = 1000) =>
  Core.analyze(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, JSON.stringify(v)])), now, crypto);
const course = attempts => ({ 'cs-mcat-course-v1': { units: { u1: { attempts } } } });
test('missing fields are explicit and unknown history never becomes first-exposure or unassisted evidence', async () => {
  const result = await analyze({
    'cs-mcat-log': [
      { qId: 'q1', correct: false, ts: 1 },
      { qId: 'q1', correct: true },
    ],
    ...course([a()]),
  });
  assert.equal(result.quality.retainedRows, 3);
  assert.equal(result.quality.missingSnapshot, 2);
  assert.equal(result.quality.unknownEventIds, 2);
  assert.equal(result.quality.missingChoice, 2);
  assert.equal(result.quality.missingTimestamp, 1);
  assert.equal(result.verifiedLearners, null);
  assert.equal(result.consentedResearchSample, null);
  assert.equal(result.groups.find(g => g.family === 'practice-log').exposure, 'unknown');
  assert.ok(result.groups.every(g => g.support === 'unknown'));
  assert.match(result.scope, /not a verified number of learners/);
});
test('exact duplicate events count once while conflicting event IDs are excluded without choosing a winner', async () => {
  const exact = await analyze(course([a(), a()]));
  assert.equal(exact.quality.retainedRows, 1);
  assert.equal(exact.quality.duplicateRows, 1);
  const conflict = await analyze(course([a(), a('q1', 1)]));
  assert.equal(conflict.quality.retainedRows, 0);
  assert.equal(conflict.quality.conflictingEventIds, 1);
});
test('wording, answer key and passage-table revisions stay separate from delivery and support conditions', async () => {
  const passage = {
    title: 'Synthetic passage',
    text: 'A context.',
    table: { headers: ['x'], rows: [['1']], privateExtra: 'SECRET_TABLE' },
    questions: [q],
  };
  const run = (id, p, assisted = false) => ({
    id,
    completedAt: 200,
    content: { passage: p },
    answers: [{ qId: 'q1', chosen: 0, correct: true, repeat: false, assisted, ts: 100 }],
  });
  const revised = clone(passage);
  revised.table.rows[0][0] = '2';
  const result = await analyze({
    'cs-mcat-v2': { coach: { history: [run('one', passage), run('two', revised), run('three', passage, true)] } },
  });
  assert.equal(result.groups.length, 3);
  assert.equal(new Set(result.groups.map(g => g.version)).size, 2);
  assert.ok(!JSON.stringify(result).includes('SECRET_TABLE'));
  assert.deepEqual(
    result.groups.map(g => g.n),
    [1, 1, 1]
  );
  assert.ok(result.groups.some(g => g.support === 'recorded-help'));
});
test('first and delayed applications are separate and later help does not relabel the original response', async () => {
  const first = a(),
    later = { ...a('later', 1, 900), kind: 'delayed' },
    data = course([first, later]);
  data['cs-mcat-course-v1'].units.u1.help = { q1: { chosen: 0 } };
  const result = await analyze(data);
  assert.equal(result.groups.length, 2);
  assert.equal(result.groups.find(g => g.itemId === 'q1').laterSupportRecorded, 1);
  assert.ok(result.groups.every(g => g.support === 'unknown'));
  assert.equal(result.groups.find(g => g.itemId === 'later').condition, 'delayed application');
});
test('impossible choices, future dates and outcomes inconsistent with a saved key cannot bias retained accuracy', async () => {
  const rows = [
    a(),
    { ...a('bad-choice'), chosen: 99 },
    a('future', 0, 5000),
    { ...a('contradiction'), correct: false },
    { ...a('missing-time'), ts: undefined },
  ];
  const result = await analyze(course(rows));
  assert.equal(result.quality.invalidChoice, 1);
  assert.equal(result.quality.futureTimestamp, 1);
  assert.equal(result.quality.inconsistentOutcome, 1);
  assert.equal(result.quality.missingTimestamp, 1);
  assert.equal(result.quality.retainedRows, 2);
});
test('unfinished workshops do not expose answers; math uses retained diagnostic exposure and separate setup/calculation counts', async () => {
  const question = { ...q, setups: q.options, value: 2 },
    math = {
      id: 'mathrun',
      qId: 'math-units-1',
      question,
      startedAt: 100,
      completedAt: 200,
      repeat: false,
      assisted: true,
      hint: false,
      setup: 0,
      setupCorrect: true,
      value: 3,
      calculationCorrect: false,
      correct: false,
      transfer: true,
    };
  const result = await analyze({
    'cs-mcat-v2': {
      coach: {
        active: { content: { passage: { questions: [{ ...q, stem: 'HIDDEN_ACTIVE_ANSWER' }] } } },
        parked: [{}],
      },
      math: { history: [math] },
      diagnostics: { history: [{ answers: [{ qId: 'probe-math-units-1', ts: 50 }] }] },
    },
  });
  assert.equal(result.quality.unfinishedWorkExcluded, 2);
  assert.ok(!JSON.stringify(result).includes('HIDDEN_ACTIVE_ANSWER'));
  const group = result.groups[0];
  assert.equal(group.exposure, 'repeat-recorded');
  assert.equal(group.condition, 'new-context math task');
  assert.deepEqual(group.setup, { n: 1, correct: 1 });
  assert.deepEqual(group.calculation, { n: 1, correct: 0 });
  assert.equal(group.correct, 0);
  assert.equal(result.quality.inconsistentOutcome, 0);
});
test('distractor counts use canonical saved choices and reports freeze an exact version without marking it defective', async () => {
  const result = await analyze({
    'cs-mcat-v2': {
      coach: {
        history: [0, 1, 1].map((chosen, i) => ({
          id: 'r' + i,
          completedAt: 200,
          content: { passage: { text: 'Context', questions: [q] } },
          answers: [{ qId: 'q1', chosen, correct: chosen === 0, repeat: true, assisted: false, ts: 100 }],
        })),
      },
    },
  });
  const group = result.groups[0];
  assert.equal(group.n, 3);
  assert.equal(group.correct, 1);
  assert.deepEqual(
    group.choices.map(c => c.n),
    [1, 2]
  );
  const report = Core.report(group, 'Both choices seem plausible because…', 'report1', 300);
  group.question.stem = 'Later change';
  assert.equal(report.item.question.stem, q.stem);
  assert.equal(report.status, 'unreviewed learner concern');
  assert.equal(report.resolution, null);
});
test('malformed sources and a capped legacy log are disclosed, without reading account or unrelated records', async () => {
  const result = await Core.analyze(
    {
      'cs-mcat-course-v1': '{bad',
      'cs-mcat-log': JSON.stringify(Array.from({ length: 1000 }, () => ({ qId: 'q1', correct: false }))),
      'sb-token': 'SECRET',
    },
    1000,
    crypto
  );
  assert.equal(result.issues.length, 1);
  assert.equal(result.quality.legacyLogAtLimit, true);
  assert.equal(result.quality.retainedRows, 1000);
  assert.equal(result.quality.unknownEventIds, 1000);
  assert.ok(!JSON.stringify(result).includes('SECRET'));
});
test('routine math setup feedback remains visible even when no additional help was recorded', async () => {
  const r = {
    id: 'math1',
    qId: 'math-units-1',
    question: { ...q, setups: q.options, value: 2 },
    startedAt: 100,
    completedAt: 200,
    repeat: false,
    assisted: false,
    hint: false,
    setup: 0,
    setupCorrect: true,
    value: 2,
    calculationCorrect: true,
    correct: true,
  };
  const result = await analyze({ 'cs-mcat-v2': { math: { history: [r] } } });
  assert.equal(result.groups[0].support, 'setup-feedback-only');
  const malformed = { title: 'Passage', text: 'Context', questions: [q], table: { unknown: 'MISSING_TABLE' } };
  const bad = await analyze({
    'cs-mcat-v2': {
      coach: {
        history: [
          {
            id: 'c1',
            completedAt: 200,
            content: { passage: malformed },
            answers: [{ qId: 'q1', chosen: 0, correct: true, ts: 100 }],
          },
        ],
      },
    },
  });
  assert.equal(bad.groups[0].version, 'unrecorded');
  assert.equal(bad.quality.missingSnapshot, 1);
});
test('private reports and literal concern text round-trip through the portable study backup', async () => {
  const Backup = require('../study-backup.js'),
    summary = await analyze(course([a()])),
    report = Core.report(summary.groups[0], 'The text says x<cutoff; please check.', 'report1', 300);
  const data = { [Core.KEY]: JSON.stringify({ version: 1, reports: [report], drafts: {} }) },
    file = await Backup.create(data, 'local', { crypto });
  assert.deepEqual((await Backup.parse(file, { crypto })).data, data);
});
