/* scripts/dat-trim-options.cjs over inline fixtures (DAT-04; DESIGN §7.4 item 7, §8).
   The migration only ever runs once, on the day the live option count is settled, so it is
   tested here rather than exercised against the real banks: it must drop exactly the weakest
   distractor, keep the key pointing at the same text, renumber every index that referred to a
   later option, and leave an item it cannot safely touch completely alone. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Trim = require('./dat-trim-options.cjs');

const outline = {
  sections: {
    bio: { block: 'sns' },
    gchem: { block: 'sns' },
    ochem: { block: 'sns' },
    qr: { block: 'qr' },
    rc: { block: 'rc' },
  },
  optionPolicy: {
    sns: { options: 4, status: 'corroborated' },
    qr: { options: 4, status: 'corroborated' },
    rc: { options: 4, status: 'corroborated' },
    qc: { options: 4, status: 'corroborated' },
    ds: { options: 5, status: 'single-secondary' },
  },
};
function item(overrides) {
  return Object.assign(
    {
      id: 'bio-cell-1',
      section: 'bio',
      format: 'standard',
      stem: 'Which organelle digests worn-out organelles?',
      options: ['Ribosome', 'Golgi apparatus', 'Lysosome', 'Mitochondrion', 'Peroxisome'],
      answer: 2,
      explanation: 'Lysosomes hold acid hydrolases.',
      distractors: [
        { i: 0, why: 'Ribosomes assemble proteins.' },
        { i: 1, why: 'The Golgi ships enzymes.' },
        { i: 3, why: 'Mitochondria make ATP.', weakest: true },
        { i: 4, why: 'Peroxisomes use catalase.' },
      ],
    },
    overrides
  );
}

test('the weakest distractor is dropped and every index that pointed past it moves down', () => {
  const before = item();
  const result = Trim.trimItem(before, 4);
  assert.equal(result.changed, true);
  const after = result.item;
  assert.deepEqual(after.options, ['Ribosome', 'Golgi apparatus', 'Lysosome', 'Peroxisome']);
  assert.equal(after.options[after.answer], before.options[before.answer], 'the key is still the same text');
  assert.equal(after.answer, 2);
  assert.deepEqual(
    after.distractors.map(d => d.i),
    [0, 1, 3]
  );
  assert.deepEqual(
    after.distractors.map(d => d.why),
    ['Ribosomes assemble proteins.', 'The Golgi ships enzymes.', 'Peroxisomes use catalase.']
  );
  assert.ok(
    after.distractors.every(d => !('weakest' in d)),
    'no weakest tag survives, because a verified count requires zero'
  );
  assert.equal(Trim.trimItem(before, 4).item.options.length, 4);
  // The source item is never mutated in place.
  assert.equal(before.options.length, 5);
  assert.equal(before.distractors.filter(d => d.weakest).length, 1);
});

test('the revision record names the prior stem, options and explanation', () => {
  const after = Trim.trimItem(item(), 4).item;
  assert.equal(after.revision, 1);
  assert.deepEqual(Object.keys(after.previousVersion).sort(), ['explanation', 'options', 'stem']);
  assert.deepEqual(after.previousVersion.options, item().options);
  assert.equal(after.previousVersion.stem, item().stem);
  assert.equal(after.previousVersion.explanation, item().explanation);
  assert.equal(Trim.trimItem(item({ revision: 3 }), 4).item.revision, 4, 'an existing revision is incremented');
});

test('the key moves down only when it sat after the dropped option', () => {
  // weakest at index 0, key at 2 -> key becomes 1.
  const low = item({
    distractors: [
      { i: 0, why: 'a', weakest: true },
      { i: 1, why: 'b' },
      { i: 3, why: 'c' },
      { i: 4, why: 'd' },
    ],
  });
  const after = Trim.trimItem(low, 4).item;
  assert.equal(after.answer, 1);
  assert.equal(after.options[after.answer], 'Lysosome');
  assert.deepEqual(
    after.distractors.map(d => d.i),
    [0, 2, 3]
  );
});

test('displayOrder is renumbered and stays a permutation of the new option count', () => {
  const after = Trim.trimItem(item({ displayOrder: [4, 0, 2, 1, 3] }), 4).item;
  assert.deepEqual(after.displayOrder.slice().sort(), [0, 1, 2, 3]);
  assert.deepEqual(after.displayOrder, [3, 0, 2, 1]);
});

test('an item the script cannot trim safely is returned untouched with a reason', () => {
  const cases = [
    [item({ options: ['a', 'b', 'c', 'd'], distractors: [] }), 'ALREADY_TRIMMED'],
    [item({ distractors: item().distractors.map(d => Object.assign({}, d, { weakest: false })) }), 'WEAKEST_TAG'],
    [
      item({
        distractors: [
          { i: 0, why: 'a', weakest: true },
          { i: 1, why: 'b', weakest: true },
          { i: 3, why: 'c' },
          { i: 4, why: 'd' },
        ],
      }),
      'WEAKEST_TAG',
    ],
    [item({ answer: 3 }), 'WEAKEST_IS_KEY'],
    [item({ distractors: [{ i: 9, why: 'off the end', weakest: true }] }), 'WEAKEST_INDEX'],
    [item({ options: ['a', 'b', 'c', 'd', 'e', 'f'] }), 'UNEXPECTED_COUNT'],
    [{ id: 'x' }, 'NO_OPTIONS'],
  ];
  for (const [fixture, reason] of cases) {
    const result = Trim.trimItem(fixture, 4);
    assert.equal(result.changed, false, reason);
    assert.equal(result.reason, reason);
    assert.equal(result.item, fixture, reason + ' returns the same object');
  }
});

test('trimBank only touches the items the named policy governs', () => {
  const bank = {
    format: 'dat-bank',
    section: 'bio',
    items: [
      item(),
      item({ id: 'bio-cell-2' }),
      item({ id: 'qr-qc-1', section: 'qr', format: 'qc', options: ['A', 'B', 'C', 'D'], answer: 0, distractors: [] }),
      item({
        id: 'qr-ds-1',
        section: 'qr',
        format: 'ds',
        options: ['1', '2', '3', '4', '5'],
        answer: 0,
        distractors: [],
      }),
    ],
  };
  const result = Trim.trimBank(outline, bank, 'sns');
  assert.deepEqual(result.trimmed, ['bio-cell-1', 'bio-cell-2']);
  assert.deepEqual(result.skipped, []);
  assert.deepEqual(
    result.data.items.map(i => i.options.length),
    [4, 4, 4, 5],
    'the fixed qc and ds sets are left exactly as authored'
  );
  assert.equal(bank.items[0].options.length, 5, 'the input bank is not mutated');
  // A second run is a no-op rather than a double trim.
  const again = Trim.trimBank(outline, result.data, 'sns');
  assert.deepEqual(again.trimmed, []);
  assert.deepEqual(again.skipped, []);
  assert.deepEqual(
    again.data.items.map(i => i.answer),
    [2, 2, 0, 0]
  );
});

test('policyKey routes every section to the block policy, never to a per-section key', () => {
  assert.equal(Trim.policyKey(outline, { section: 'bio', format: 'standard' }), 'sns');
  assert.equal(Trim.policyKey(outline, { section: 'gchem', format: 'standard' }), 'sns');
  assert.equal(Trim.policyKey(outline, { section: 'ochem', format: 'standard' }), 'sns');
  assert.equal(Trim.policyKey(outline, { section: 'qr', format: 'standard' }), 'qr');
  assert.equal(Trim.policyKey(outline, { section: 'qr', format: 'data' }), 'qr');
  assert.equal(Trim.policyKey(outline, { section: 'qr', format: 'qc' }), 'qc');
  assert.equal(Trim.policyKey(outline, { section: 'qr', format: 'ds' }), 'ds');
  assert.equal(Trim.policyKey(outline, { section: 'rc', format: 'standard' }), 'rc');
  assert.equal(Trim.policyKey(outline, { section: 'nope', format: 'standard' }), undefined);
});

test('RC questions are trimmed inside their passages', () => {
  const rc = {
    passages: [
      {
        id: 'rc-1',
        questions: [item({ id: 'rc-1-1', section: 'rc' }), item({ id: 'rc-1-2', section: 'rc', answer: 4 })],
      },
    ],
  };
  const result = Trim.trimRc(outline, rc);
  assert.deepEqual(result.trimmed, ['rc-1:rc-1-1', 'rc-1:rc-1-2']);
  assert.deepEqual(
    rc.passages[0].questions.map(q => q.options.length),
    [4, 4]
  );
  assert.equal(rc.passages[0].questions[1].answer, 3, 'a key after the dropped option moves down');
});

test('the live banks are already consistent with the option policy as it stands today', () => {
  // optionPolicy is still "unverified" at five options, so a dry run must find nothing to do.
  const report = Trim.plan(['sns', 'qr'], false);
  assert.equal(report.trimmed, 0, 'no item is trimmed while the policy still says five options');
  assert.deepEqual(report.skipped, [], 'and no item is in a state the migration could not handle');
});
