/* Reference Python is executed in CPython; this does not verify the browser runtime. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), { spawnSync } = require('node:child_process');
const crypto = require('node:crypto').webcrypto;
const Core = require('../neuro-project-engine.js'), Backup = require('../study-backup.js');
const data = JSON.parse(fs.readFileSync('data/neuro-projects.json')), projects = data.projects;
const clone = value => JSON.parse(JSON.stringify(value));
const context = vm.createContext({ Date, Math, JSON, Map, console, runPythonCode: async code => {
  const output = spawnSync('python3', ['-'], { input: code, encoding: 'utf8', timeout: 5000, maxBuffer: 2000000 });
  return { ok: output.status === 0, stdout: output.stdout || '', stderr: output.stderr || output.error?.message || '' };
} });
vm.runInContext(fs.readFileSync('code-evaluator.js', 'utf8'), context);
const evaluate = (code, project) => context.neuroCodeEvaluateOJT(code, project, () => {});
const passed = project => ({ passed: true, message: 'Listed cases passed.', cases: project.checks.cases.map(() => ({ passed: true, actual: 'recorded value', expected: 'reference value', argsPreserved: true })) });

test('all six reference implementations pass the 37 documented input cases in CPython', async () => {
  assert.equal(projects.length, 6); let checks = 0;
  for (const project of projects) {
    Core.validateProject(project); assert.equal(await Core.inputDigest(project, crypto), project.inputSha256);
    const result = await evaluate(project.solution, project);
    assert.equal(result.passed, true, project.id + ': ' + JSON.stringify(result));
    assert.ok(result.cases[0].value); checks += result.cases.length;
    assert.equal((await evaluate(project.starter, project)).passed, false, 'An unimplemented starter cannot pass');
  }
  assert.equal(checks, 37);
});
test('plausible wrong algorithms fail beyond the original example', async () => {
  const mutants = [
    'import json\ndef analyze_signal(samples, threshold, sample_rate_hz):\n    return json.loads(' + JSON.stringify(JSON.stringify(projects[0].checks.cases[0].expected)) + ')',
    projects[1].solution.replaceAll('i - start', '1'),
    projects[2].solution.replace('samples[max(0, i - window + 1):i + 1]', 'samples[i:min(len(samples), i + window)]'),
    projects[3].solution.replace(/    bias = -0\.5[^\n]+/, '    bias = 0.0'),
    projects[4].solution.replace('positions[max(0, t - delay_steps)]', 'positions[t]'),
    projects[5].solution.replace("remove_baseline(channel, data['window'])['residual']", 'channel'),
  ];
  for (let i = 0; i < projects.length; i++) assert.equal((await evaluate(mutants[i], projects[i])).passed, false, 'Weak algorithm passed ' + projects[i].id);
});
test('all project input checksums survive saved JSON and the known signed-zero record remains recoverable', async () => {
  for (const project of projects) {
    const saved = clone(Core.create(project, 'saved-json-round-trip', 1));
    assert.equal(await Core.verifyInputs(saved.content, crypto), true, project.id);
    assert.equal(await Core.inputDigest(project, crypto), await Core.inputDigest(saved.content, crypto));
  }
  const legacy = clone(projects.find(project => project.id === 'spike-detector'));
  legacy.revision = 1;
  legacy.inputSha256 = 'fc384baf91e4481bc8d5bd48b57b8c521b7a85921179910271f35018e96e26f2';
  assert.equal(await Core.verifyInputs(legacy, crypto), true);
  legacy.checks.cases[0].args[0][0] += 0.1;
  assert.equal(await Core.verifyInputs(legacy, crypto), false, 'Compatibility must not accept changed samples');
});
test('independent numerical checks verify sample duration, grouping, baseline edges and centroid geometry', () => {
  const sample = projects[0].checks.cases[0], x = sample.args[0], result = sample.expected;
  assert.equal(result.sample_count, x.filter(v => v >= -50).length); assert.equal(result.duration_s, 0.024);
  assert.notEqual(result.duration_s, (x.length - 1) / sample.args[2]);
  const detector = projects[1].checks.cases[0], values = detector.args[0], mean = values.reduce((a, b) => a + b) / values.length;
  const threshold = mean - 3.5 * Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  assert.ok(Math.abs(threshold - detector.expected.threshold) < 1e-10);
  const groups = [];
  values.forEach((v, i) => { if (v < threshold) { if (i === 0 || values[i - 1] >= threshold) groups.push([]); groups.at(-1).push(i); } });
  assert.deepEqual(groups.map(group => group.length), detector.expected.events.map(e => e.width_samples));
  for (const event of detector.expected.events) assert.equal(event.width_ms, event.width_samples / 2);
  assert.deepEqual(projects[2].checks.cases[1].expected, { baseline: [2, 3, 5], residual: [0, 1, 1] });
  const decoder = projects[3].checks.cases[0], [rows, labels, heldout] = decoder.args;
  const centers = [-1, 1].map(label => [0, 1].map(j => rows.filter((_, i) => labels[i] === label).reduce((s, row) => s + row[j], 0) / labels.filter(y => y === label).length));
  const distance = (row, center) => row.reduce((s, x, j) => s + (x - center[j]) ** 2, 0);
  assert.deepEqual(heldout.map(row => distance(row, centers[1]) <= distance(row, centers[0]) ? 1 : -1), decoder.expected.test_predictions);
});
test('delayed cursor outputs obey the recurrence, saturation and complete capstone chain', () => {
  for (const example of projects[4].checks.cases.filter(c => !c.raises)) {
    const [targets, gain, delay, speed, dt] = example.args, { positions, commands } = example.expected;
    assert.equal(positions.length, targets.length + 1); assert.equal(commands.length, targets.length);
    targets.forEach((target, t) => {
      const u = Math.max(-speed, Math.min(speed, gain * (target - positions[Math.max(0, t - delay)])));
      assert.ok(Math.abs(commands[t] - u) < 1e-10); assert.ok(Math.abs(positions[t + 1] - positions[t] - u * dt) < 1e-10);
    });
  }
  const first = projects[5].checks.cases[0], settings = first.args[0], output = first.expected;
  assert.deepEqual(output.train_features, [[3, 1], [3, 1], [1, 3], [1, 3]]);
  assert.deepEqual(output.test_features, [[3, 1], [1, 3], [2, 2], [1, 3]]);
  assert.deepEqual(output.predictions, [-1, 1, 1, 1]); assert.equal(output.positions.length, settings.test_trials.length * settings.hold_steps + 1);
  assert.ok(!Object.hasOwn(settings, 'test_labels')); assert.ok(!Object.hasOwn(settings, 'testLabels'));
  output.predictions.forEach((prediction, i) => assert.deepEqual(output.targets.slice(i * settings.hold_steps, (i + 1) * settings.hold_steps), Array(settings.hold_steps).fill(prediction)));
});
test('project completion freezes the prediction, code result and memo without changing legacy records', () => {
  const original = clone(projects[0]), work = Core.create(original, 'first-project', 1000), legacy = { passed: true, ts: 50 };
  original.prompt = 'Changed source'; assert.notEqual(work.content.prompt, original.prompt);
  assert.throws(() => Core.begin(work, 'missing-prediction', 1100));
  Core.edit(work, 'prediction', 'Eight qualifying samples, not eight neurons.'); Core.edit(work, 'draft', 'def analyze_signal(*args): return {}');
  const attempt = Core.begin(work, 'first-check', 1200); assert.equal(Core.edit(work, 'prediction', 'Rewrite after seeing output'), false);
  assert.equal(Core.finish(work, attempt.id, passed(work.content), 1300), true); assert.equal(Core.complete(work, 1400), false);
  for (const key of Core.MEMO) Core.edit(work, key, 'My ' + key);
  Core.edit(work, 'draft', 'changed'); assert.equal(Core.ready(work), false); Core.edit(work, 'draft', attempt.draft);
  assert.equal(Core.complete(work, 1500), true); assert.equal(Core.edit(work, 'result', 'Later rewrite'), false);
  assert.equal(Core.complete(work, 1600), false); Core.validateWork(work);
  assert.deepEqual(legacy, { passed: true, ts: 50 });
});
test('interruption retains code and first prediction without a pass; broken saved output is rejected', () => {
  const work = Core.create(projects[0], 'interrupted-project', 1000); Core.edit(work, 'prediction', 'My prediction');
  const attempt = Core.begin(work, 'pending-check', 1100); assert.equal(Core.interrupt(work), true); assert.equal(Core.ready(work), false);
  assert.equal(Core.finish(work, attempt.id, passed(work.content)), false); Core.validateWork(work);
  for (const damage of [w => w.content.preview.samples = 'broken', w => w.firstPrediction = null,
    w => { w.attempts[0].status = 'done'; w.attempts[0].result = { passed: false, message: 'failed', cases: {} }; }]) {
    const value = clone(work); damage(value); assert.throws(() => Core.validateWork(value));
  }
});
test('portable project code is plain text while older HTML snapshots retain markup validation', async () => {
  const work = Core.create(projects[0], 'portable-project', 1000);
  work.draft = 'def f(x, cutoff):\n    if x<cutoff:\n        return "<script>plain code string</script>"\n';
  const records = { 'cs-neuro': JSON.stringify({ projects: { [work.content.id]: { current: work, history: [] } }, milestones: { old: { passed: true } } }) };
  const file = await Backup.create(records, 'local', { crypto }); assert.deepEqual((await Backup.parse(file, { crypto })).data, records);
  await assert.rejects(() => Backup.create({ 'cs-neuro': JSON.stringify({ units: { old: { content: '<script>not allowed</script>' } } }) }, 'local', { crypto }), /HTML/);
});
test('new project prerequisite records must identify actual units and the preceding completed project', () => {
  const project = projects[1]; assert.equal(Core.unlocked(project, [project.prerequisites.at(-1)], null), false);
  assert.equal(Core.unlocked(project, project.prerequisites, null), false);
  assert.equal(Core.unlocked(project, project.prerequisites, { history: [{ completedAt: 1234 }], current: null }), true);
});
test('saved check strings mark truncation with the full length instead of cutting silently', async () => {
  const project = projects[4], long = project.checks.cases.findIndex(c => !c.raises && JSON.stringify(c.expected).length > 2000);
  assert.ok(long >= 0, 'The cursor project has an expected value beyond the 2000-character view');
  const result = await evaluate('def control_cursor(targets, gain, delay_steps, max_speed, dt):\n    return {"positions": [0.0] * (len(targets) + 1), "commands": [123456789.0] * len(targets)}\n', project);
  assert.equal(result.passed, false); const item = result.cases[long];
  assert.match(item.expected, /… \(truncated; full length \d+ characters\)$/); assert.match(item.actual, /… \(truncated; full length \d+ characters\)$/);
  assert.ok(Number(item.expected.match(/full length (\d+)/)[1]) > 2000);
  const short = result.cases.find(c => c.expected.length < 200); assert.ok(short); assert.doesNotMatch(short.expected, /truncated/);
  const reference = await evaluate(project.solution, project); assert.match(reference.cases[long].actual, /truncated/); assert.equal(reference.cases[long].passed, true);
});
