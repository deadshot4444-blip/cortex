/* Verify source/index/history alignment; this does not validate clinical judgment. */
const fs = require('node:fs'),
  assert = require('node:assert/strict'),
  { createHash } = require('node:crypto');
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const history = read('content/clinical-corrections-m29.json'),
  manifest = read('data/manifest.json'),
  index = read('data/index.json');
const source = new Map();
for (const key of Object.keys(manifest))
  for (const c of read('data/' + key + '.json').cases) {
    assert.ok(!source.has(c.id), 'Duplicate case ID: ' + c.id);
    source.set(c.id, { key, case: c });
  }
assert.equal(index.length, source.size);
assert.equal(new Set(index.map(c => c.id)).size, index.length);
for (const row of index) {
  const entry = source.get(row.id);
  assert.ok(entry, row.id);
  assert.equal(row.key, entry.key);
  for (const field of ['title', 'difficulty', 'diagnosis'])
    assert.equal(row[field], entry.case[field], row.id + ' ' + field);
}
const reconciliation = read('content/clinical-corrections-reconciliation-2026-09-23.json');
assert.equal(reconciliation.format, 'cortex-clinical-history-reconciliation');
assert.equal(reconciliation.kind, 'reconstructed-authoring-history');
assert.equal(reconciliation.caseId, history.case.id);
assert.equal(reconciliation.actualChangeDate, null);
assert.match(reconciliation.recordedOn, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(reconciliation.sourceEvidence.preservedHistoryPath, 'content/clinical-corrections-m29.json');
assert.equal(
  createHash('sha256').update(fs.readFileSync(reconciliation.sourceEvidence.preservedHistoryPath)).digest('hex'),
  reconciliation.sourceEvidence.preservedHistorySha256,
  'The original correction record must remain intact'
);
const later = [
    ...read('data/clinical-shift-revisions.json').changes.filter(r => r.caseId === history.case.id),
    ...reconciliation.changes,
  ],
  expected = JSON.parse(JSON.stringify(history.case.after));
for (const r of later) {
  assert.equal(r.caseId, history.case.id);
  assert.match(r.path, /^\/case\//);
  const keys = r.path.replace(/^\/case\//, '').split('/');
  let node = expected;
  for (const k of keys.slice(0, -1)) node = node[k];
  assert.ok(Object.hasOwn(node, keys.at(-1)), r.path + ' must identify an existing field');
  assert.equal(node[keys.at(-1)], r.before, r.path + ' before');
  node[keys.at(-1)] = r.after;
}
const c = source.get(history.case.id).case;
assert.deepEqual(c, expected);
assert.equal(c.id, history.case.before.id);
assert.deepEqual(
  c.stages.filter(s => s.type === 'question').map(s => s.answer),
  history.case.before.stages.filter(s => s.type === 'question').map(s => s.answer)
);
for (const stage of c.stages.filter(s => s.type === 'question')) {
  assert.ok(stage.options[stage.answer]);
  assert.equal(stage.options.length, 4);
  assert.ok(stage.explanation);
}
assert.equal(c.review.status, 'pending');
assert.equal(c.review.reviewer, null);
for (const source of c.sources) assert.equal(new URL(source.url).protocol, 'https:');
const labs = read('data/labs.json'),
  lab = labs.find(r => r.id === history.lab.id);
assert.deepEqual(lab, history.lab.after);
assert.equal(lab.id, history.lab.before.id);
assert.equal(lab.review.status, 'pending');
console.log(
  `${source.size} current case/index entries agree; corrected case and lab match their preserved history and dated reconciliation; five answer indices retained. No new clinical review is claimed.`
);
