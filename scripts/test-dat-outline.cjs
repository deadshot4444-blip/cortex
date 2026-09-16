// data/dat-outline.json is the DAT track's content map: six sections, 37 stable category ids,
// the option-count policy, the six PAT subtests and the fragment registry. Shape only — the
// on-disk half of the registry check (every fragment exists) belongs to test-dat-content.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const outline = JSON.parse(fs.readFileSync('data/dat-outline.json', 'utf8'));
const SECTIONS = ['bio', 'gchem', 'ochem', 'pat', 'rc', 'qr'];
const PREFIX = { bio: 'BIO', gchem: 'GC', ochem: 'OC', qr: 'QR', rc: 'RC', pat: 'PAT' };
const categories = outline.concepts.flatMap(c => c.categories);
const categoryIds = new Set(categories.map(c => c.id));

test('six sections with the fixed keys, ADA question counts and pacing targets', () => {
  assert.deepEqual(Object.keys(outline.sections), SECTIONS);
  assert.deepEqual(
    SECTIONS.map(key => outline.sections[key].questions),
    [40, 30, 30, 90, 50, 40]
  );
  for (const key of SECTIONS) {
    const s = outline.sections[key];
    assert.match(s.abbr, /^[A-Z]{2,3}$/, key);
    assert.ok(s.name.length > 3, key);
    assert.ok(
      outline.blocks.some(b => b.id === s.block),
      key + ' block exists'
    );
    assert.ok(Number.isInteger(outline.pacingSeconds[key]) && outline.pacingSeconds[key] > 0, key + ' pacing');
  }
  assert.equal(outline.sections.rc.passages, 3);
  const sns = outline.blocks.find(b => b.id === 'sns');
  assert.deepEqual(sns.sections, ['bio', 'gchem', 'ochem']);
  assert.equal(
    sns.sections.reduce((n, key) => n + outline.sections[key].questions, 0),
    sns.questions
  );
  assert.deepEqual(
    outline.blocks.map(b => b.id),
    ['sns', 'pat', 'break', 'rc', 'qr']
  );
  assert.equal(
    outline.blocks.reduce((n, b) => n + (b.questions || 0), 0),
    280
  );
});

test('37 unique category ids, each under the concept whose section matches its prefix', () => {
  assert.equal(categories.length, 37);
  assert.equal(categoryIds.size, 37);
  assert.deepEqual(outline.concepts.map(c => c.section).sort(), [...SECTIONS].sort());
  for (const concept of outline.concepts) {
    assert.equal(concept.id, concept.section);
    assert.ok(concept.title && concept.summary, concept.id);
    for (const category of concept.categories) {
      assert.match(category.id, /^(BIO|GC|OC|QR|RC|PAT)-[0-9A-Z]+$/, category.id);
      assert.equal(category.id.split('-')[0], PREFIX[concept.section], category.id + ' sits under ' + concept.section);
      assert.ok(category.title, category.id + ' title');
      assert.match(category.slug, /^[a-z0-9]+$/, category.id + ' slug');
      assert.ok(Array.isArray(category.topics) && category.topics.length >= 3, category.id + ' topics');
      assert.equal(new Set(category.topics).size, category.topics.length, category.id + ' topics unique');
      for (const topic of category.topics)
        assert.ok(typeof topic === 'string' && topic.trim() === topic && topic.length);
    }
  }
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(PREFIX).map(([s, p]) => [p, categories.filter(c => c.id.startsWith(p + '-')).length])
    ),
    { BIO: 5, GC: 13, OC: 5, QR: 5, RC: 3, PAT: 6 }
  );
  // The QLOG category for an RC question is 'RC-' + skill number, so the two id sets must mirror.
  assert.deepEqual(
    outline.readingSkills.map(s => 'RC-' + s.id.split('-')[1]),
    ['RC-1', 'RC-2', 'RC-3']
  );
  assert.deepEqual(
    outline.scienceSkills.map(s => s.id),
    ['skill-1', 'skill-2', 'skill-3']
  );
});

test('option policy carries the two canonical answer sets and an evidence grade per entry', () => {
  assert.deepEqual(Object.keys(outline.optionPolicy), ['sns', 'rc', 'qr', 'qc', 'ds', 'course']);
  for (const [key, policy] of Object.entries(outline.optionPolicy)) {
    assert.ok([4, 5].includes(policy.options), key);
    assert.ok(typeof policy.status === 'string' && policy.status, key + ' status');
  }
  assert.equal(outline.optionPolicy.qc.canonical.length, 4);
  assert.equal(outline.optionPolicy.qc.options, 4);
  assert.equal(outline.optionPolicy.ds.canonical.length, 5);
  assert.equal(outline.optionPolicy.ds.options, 5);
  assert.equal(outline.optionPolicy.course.options, 4);
  assert.deepEqual(outline.extendedTime.multipliers, [1, 1.5, 2]);
  assert.deepEqual(outline.tools.calculator.sections, ['qr']);
  assert.deepEqual(outline.tools.periodicTable.sections, ['bio', 'gchem', 'ochem']);
});

test('six PAT subtests in ADA order with the official option counts and a PAT category each', () => {
  assert.deepEqual(
    outline.patSubtests.map(s => s.id),
    ['keyholes', 'tfe', 'angles', 'holes', 'cubes', 'patterns']
  );
  assert.deepEqual(
    outline.patSubtests.map(s => s.options),
    [5, 4, 4, 5, 5, 4]
  );
  for (const subtest of outline.patSubtests) {
    assert.ok(categoryIds.has(subtest.category), subtest.id + ' category');
    assert.equal(subtest.questions, 15);
    assert.ok(subtest.seconds > 0 && subtest.adaName && subtest.alias, subtest.id);
  }
  assert.equal(
    outline.patSubtests.reduce((n, s) => n + s.questions, 0),
    outline.sections.pat.questions
  );
});

test('the fragment registry has 16 course, 16 card and 12 question fragments with unique safe names', () => {
  const { course, cards, questions } = outline.files;
  assert.equal(course.length, 16);
  assert.equal(cards.length, 16);
  assert.equal(questions.length, 12);
  const all = [...course, ...cards, ...questions];
  assert.equal(new Set(all).size, all.length);
  for (const name of all) assert.match(name, /^dat-[a-z0-9-]+$/, name);
  for (const name of course) assert.match(name, /^dat-course-/, name);
  for (const name of cards) assert.match(name, /^dat-cards-/, name);
  for (const name of questions) assert.match(name, /^dat-questions-(bio|gchem|ochem|qr)-[123]$/, name);
  // Every course chapter has a matching card fragment.
  assert.deepEqual(
    course.map(n => n.replace('dat-course-', '')),
    cards.map(n => n.replace('dat-cards-', ''))
  );
});

test('targets name real categories, layers are ordered fractions, and the provenance block is complete', () => {
  for (const id of Object.keys(outline.targets.questions)) assert.ok(categoryIds.has(id), id);
  for (const id of categoryIds)
    if (!/^(RC|PAT)-/.test(id)) assert.ok(outline.targets.questions[id] > 0, id + ' has a question target');
  assert.deepEqual(Object.values(outline.targets.layers), [0.4, 0.75, 1.0]);
  assert.deepEqual(Object.keys(outline.targets.cards).sort(), [...SECTIONS].sort());
  assert.equal(outline.targets.rc.questionsTotal, 100);
  assert.equal(outline.targets.rc.passages, 6);
  for (const key of ['authoredOn', 'author', 'reviewStatus', 'sourceCheckedOn', 'contentNote'])
    assert.ok(typeof outline[key] === 'string' && outline[key], key);
  assert.match(outline.reviewStatus, /pending/);
  assert.ok(outline.sources.length > 0);
  for (const source of outline.sources) assert.match(source.url, /^https:/);
  assert.ok(outline.ochemGoLive.includes('April 2026'));
  assert.equal(outline.ochemPriorSpec.areas.length, 7);
});
