/* Verify that coverage claims match the content learners can actually open. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { rows } = require('../mcat-coverage.js');
const read = name => JSON.parse(fs.readFileSync(`data/${name}.json`, 'utf8'));
const outline = read('mcat-outline'), course = read('mcat-course');
const banks = { questions: read('mcat-questions'), cards: read('mcat-cards'), sci: read('mcat-science-passages'), cars: read('mcat-cars') };
const categories = new Map(outline.concepts.flatMap(concept => concept.categories.map(category => [category.id, { ...category, section: concept.section }])));
const skills = new Set([...outline.scienceSkills, ...outline.carsSkills].map(skill => skill.id));
assert.equal(categories.size, 34);
assert.equal([...categories.keys()].filter(id => !id.startsWith('CARS-')).length, 31);
for (const item of [...banks.questions, ...banks.cards, ...banks.sci.flatMap(p => p.questions.map(q => ({ ...q, section: p.section })))]) {
  assert.ok(categories.has(item.category), `${item.id}: invalid category ${item.category}`);
  assert.equal(item.section, categories.get(item.category).section, `${item.id}: wrong section`);
  if (item.skill) assert.ok(skills.has(item.skill), `${item.id}: invalid skill`);
}
for (const unit of course.units) {
  assert.ok(unit.skills.length && unit.skills.every(skill => skills.has(skill)), unit.id);
  assert.ok(unit.categories.every(id => categories.has(id)), unit.id);
  for (const topic of unit.topics) assert.ok(unit.categories.some(id => categories.get(id).topics.includes(topic)), `${unit.id}: unlinked topic ${topic}`);
}
const actual = rows(outline, course, banks);
assert.equal(actual.length, 34);
assert.equal(actual.filter(row => row.lessons.length).length, 29);
const light = actual.find(row => row.id === '4D');
assert.equal(light.practiceCount, 38);
assert.equal(light.cardCount, 12);
assert.ok(light.lessons.some(unit => unit.id === 'absorbance'));
assert.equal(light.missingTopics.includes('Geometric optics'), false);
assert.ok(light.lessons.some(unit => unit.id === 'thin-lenses'));
assert.equal(banks.sci.find(p => p.id === 'cp8').questions.every(q => q.category === '5E'), true);
assert.equal(banks.questions.find(q => q.id === 'cp-physics-3').category, '4C');
assert.equal(banks.cards.find(c => c.id === 'genchem-r2-1').category, '4E');
const microbial = actual.find(row => row.id === '2B');
assert.equal(microbial.practiceCount, 4);
assert.equal(microbial.cardCount, 12);
assert.equal(microbial.firstChecks, 2);
assert.equal(microbial.laterChecks, 3);
assert.ok(microbial.missingTopics.includes('Bacterial structure and growth'));
assert.equal(actual.find(row => row.id === 'CARS-1').practiceCount, 64);
assert.ok(actual.some(row => !row.lessons.length && row.missingTopics.length));
const duplicates = rows(outline, course, { ...banks, questions: [...banks.questions, ...banks.questions], cards: [...banks.cards, ...banks.cards], sci: [...banks.sci, ...banks.sci], cars: [...banks.cars, ...banks.cars] });
assert.deepEqual(duplicates.map(row => [row.id, row.practiceCount, row.cardCount]), actual.map(row => [row.id, row.practiceCount, row.cardCount]));
console.log('Canonical categories, section and topic alignment, available assessments, gaps, and unique inventory counts passed.');
