const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const ECGTrace = require('../ecg-engine.js');
const medicine = JSON.parse(fs.readFileSync('data/medicine-foundations.json'));
const history = JSON.parse(fs.readFileSync('content/ecg-frozen-trace-reconciliation-2026-09-23.json'));
const sha = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const lessons = new Map(medicine.lessons.map(lesson => [lesson.id, lesson]));

test('four reconciled lesson figures have explicit revisions and unchanged event metadata', () => {
  assert.equal(history.changes.length, 4);
  assert.equal(new Set(history.changes.map(change => change.lessonId)).size, 4);
  for (const change of history.changes) {
    const lesson = lessons.get(change.lessonId);
    const trace = lesson.steps.find(step => step.id === change.stepId).trace;
    const metadata = { ...trace };
    delete metadata.values;
    assert.equal(lesson.revision, change.revisionAfter);
    assert.equal(change.revisionAfter, change.revisionBefore + 1);
    assert.equal(sha(trace), change.traceSha256After);
    assert.notEqual(change.traceSha256Before, change.traceSha256After);
    assert.equal(sha(metadata), change.unchangedTraceMetadataSha256);
    assert.equal(trace.version, 1, 'Historical trace schema stays valid');
    assert.ok(ECGTrace.valid(trace));
    assert.deepEqual(trace, ECGTrace.create(change.patternId));
    assert.equal(lesson.review.status, 'pending');
    assert.equal(lesson.review.reviewer, null);
  }
});

test('stored lesson waveforms retain the existing model QT and repolarize before the next atrial event', () => {
  // These are the existing schematic-model timing contracts, not clinical diagnostic limits.
  for (const [id, expectedQT] of [
    ['med-ecg-measure', 0.38],
    ['med-ecg-av-timing', 0.38],
    ['med-potassium-sample', 0.34],
    ['med-st-troponin', 0.38],
  ]) {
    const trace = lessons.get(id).steps.find(step => step.trace).trace;
    const q = trace.qrs[0];
    const nextP = trace.atrial.find(p => p > q.end);
    let last = q.end;
    for (let i = Math.round(q.end * trace.sampleRate) + 1; i < Math.round(nextP * trace.sampleRate); i++)
      if (Math.abs(trace.values[i]) > 1e-6) last = i / trace.sampleRate;
    assert.ok(Math.abs(last - q.start - expectedQT) <= 2 / trace.sampleRate, `${id}: sampled QT ${last - q.start}`);
    assert.ok(last < nextP - 0.05, `${id}: T wave must return to baseline before the next P wave`);
    assert.equal(q.start, 0.3);
    assert.equal(q.end, 0.38);
    assert.equal(q.p, 0.14);
  }
  const st = lessons.get('med-st-troponin').steps.find(step => step.trace).trace;
  assert.equal(st.values[Math.round(st.qrs[0].end * st.sampleRate)], 0.2);
  assert.equal(st.values[Math.round(st.qrs[0].end * st.sampleRate) + 1], 0.2);
  const tallT = lessons.get('med-potassium-sample').steps.find(step => step.trace).trace;
  assert.equal(tallT.values[Math.round(0.54 * tallT.sampleRate)], 0.58);
});
