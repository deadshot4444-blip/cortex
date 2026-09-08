/* Authoring consistency checks, not independent clinical approval. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ECGTrace = require('../ecg-engine.js');
const read = file => JSON.parse(fs.readFileSync(file));
const medicine = read('data/medicine-foundations.json'), anatomy = read('data/anatomy-foundations.json');
const clinical = read('data/clinical-shift-pilot.json'), labs = read('data/labs.json'), revisions = read('data/lab-context-revisions.json');
const lessons = medicine.lessons.filter(lesson => lesson.group === 'interpretation');
assert.equal(lessons.length, 8); assert.equal(lessons.flatMap(l => l.steps).filter(s => s.kind === 'check').length, 24);
const targets = { reference: new Set(medicine.lessons.map(l => l.id)), anatomy: new Set(anatomy.lessons.map(l => l.id)) };
let links = 0;
for (const lesson of lessons) {
  assert.equal(lesson.review.status, 'pending'); assert.equal(lesson.review.reviewer, null); assert.equal(lesson.review.reviewedAt, null);
  assert.ok(lesson.steps.some(s => s.kind === 'reflect' && s.required));
  for (const link of lesson.connections) {
    links++;
    if (link.params.lesson) assert.ok(targets[link.section].has(link.params.lesson), `${lesson.id}: missing lesson ${link.params.lesson}`);
    if (link.hash) assert.ok(clinical.caseReviews[link.hash.slice(5)], `${lesson.id}: missing case ${link.hash}`);
    if (link.params.focus) assert.ok(ECGTrace.kinds.includes(link.params.focus));
  }
}
for (const review of Object.values(clinical.caseReviews)) for (const link of review.learningLinks || []) assert.ok(targets.reference.has(link.lesson));
for (const [id, kind] of Object.entries({ 'med-ecg-measure': 'sinus', 'med-ecg-av-timing': 'mobitz1', 'med-potassium-sample': 'hyperk', 'med-st-troponin': 'stemi' })) {
  const trace = medicine.lessons.find(l => l.id === id).steps.find(s => s.trace).trace;
  assert.deepEqual(trace, ECGTrace.create(kind), `${id}: the authored trace must include the latest boundary correction`);
}
assert.equal(labs.length, 84); assert.equal(new Set(labs.map(row => row.id)).size, 84); assert.equal(revisions.rows.length, 49);
for (const row of labs) {
  assert.ok(row.rangeContext && row.sources.length); assert.equal(row.review.status, 'pending'); assert.equal(row.review.reviewer, null);
}
const plateletCBC = labs.find(row => row.id === 'cbc-9'), plateletCoags = labs.find(row => row.id === 'coags-6');
assert.equal(plateletCBC.range, plateletCoags.range); assert.equal(plateletCBC.units, plateletCoags.units);
assert.equal(labs.find(row => row.id === 'coags-4').units, 'ng/mL FEU (cited Mayo assay)');
console.log(`8 interpretation lessons, 24 checks, 4 frozen traces, ${links} valid connections, 84 retained lab rows and 49 scoped corrections passed authoring checks. Independent review remains pending.`);
