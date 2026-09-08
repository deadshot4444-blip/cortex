const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const data = JSON.parse(fs.readFileSync('data/neuro.json'));
const evaluator = fs.readFileSync('code-evaluator.js', 'utf8');
const source = fs.readFileSync('neuro.js', 'utf8');
const python = code => {
  const result = spawnSync('python3', ['-'], { input: code, encoding: 'utf8', timeout: 5000 });
  return { ok: result.status === 0, stdout: result.stdout || '', stderr: result.stderr || result.error?.message || '' };
};
function harness(saved = new Map(), content = data) {
  let invalid = 0,
    fail = false,
    blocked = '';
  const requests = [];
  const storage = {
    paused: false,
    read: (key, fallback) => (saved.has(key) ? JSON.parse(saved.get(key)) : fallback),
    watch() {},
    sessionFailed() {
      invalid++;
      this.paused = true;
    },
    write(key, value) {
      if (fail) return false;
      saved.set(key, JSON.stringify(value));
      return true;
    },
  };
  const context = vm.createContext({
    console,
    Date,
    Math,
    JSON,
    URL,
    URLSearchParams,
    Set,
    Map,
    StudyStorage: storage,
    window: { addEventListener() {} },
    runPythonCode: async code => python(code),
    fetch: async file => {
      requests.push(file);
      return {
        ok: !blocked || !file.includes(blocked),
        json: async () => (file.includes('milestones') ? { milestones: [] } : structuredClone(content)),
      };
    },
  });
  vm.runInContext(evaluator, context);
  vm.runInContext(source, context);
  return {
    context,
    run: code => vm.runInContext(code, context),
    saved,
    storage,
    requests,
    get invalid() {
      return invalid;
    },
    set fail(value) {
      fail = value;
    },
    set blocked(value) {
      blocked = value;
    },
  };
}
(async () => {
  assert.equal(data.learningPaths[0].steps.length, 20);
  assert.equal(data.neuroCodeLessons.length, 13);
  assert.equal(data.simulations.length, 15);
  const old = {
    pathStarted: true,
    pathDone: [data.learningPaths[0].steps[19].id, data.learningPaths[0].steps[19].id, 'retired-unit'],
    topicQuiz: { legacy: { c: 3, t: 4 } },
    topicAtlas: {},
    sims: {},
    code: { legacy: { passed: true, ts: 1234 } },
    milestones: { legacy: { passed: true } },
  };
  const saved = new Map([['cs-neuro', JSON.stringify(old)]]),
    h = harness(saved);
  h.blocked = 'neuro.json';
  await assert.rejects(h.run('loadNeuro()'), /did not download/);
  assert.equal(h.run('NEURO.loaded'), false);
  h.blocked = 'milestones';
  await Promise.all([h.run('loadNeuro()'), h.run('loadNeuro()')]);
  assert.equal(h.run('NEURO.loaded'), true, 'Optional projects do not block foundations');
  assert.equal(h.requests.length, 4, 'Concurrent requests share one load');
  assert.equal(h.run('pathProgress().done'), 1, 'Unknown IDs and duplicate IDs cannot inflate progress');
  assert.equal(h.run('NEURO_PROG.code.legacy.ts'), 1234);
  assert.equal(h.run('NEURO_PROG.topicQuiz.legacy.c'), 3);
  assert.equal(h.run('neuroWorkComplete({})'), false);
  assert.equal(h.run('neuroCodeOutputsMatch("A: 1", "A: 1\\nB: 2")'), false);
  assert.equal(h.run('neuroCodeOutputsMatch("", "A: 1")'), false);
  assert.equal(h.run('neuroCodeEvaluate("anything", {}).passed'), false, 'Offline text matching cannot assign a pass');
  let cases = 0;
  for (const step of data.learningPaths[0].steps.slice(0, 5)) {
    h.context.stepId = step.id;
    h.run('var record = neuroUnitRecord(neuroPath().steps.find(step => step.id === stepId))');
    const record = h.run('record'),
      content = record.content,
      lesson = content.code;
    assert.equal(content.unit.revision, step.order === 4 ? 2 : 3);
    const application =
      data.unitLessons[String(step.order)].simulation || data.simulations.find(sim => sim.id === step.simulationId);
    assert.deepEqual(
      JSON.parse(JSON.stringify(content.sim)),
      application,
      'Snapshot uses the application matched to this foundation'
    );
    assert.equal(content.checks.length, 2);
    assert.ok(content.unit.sources.length);
    const advance = stage => h.context.neuroUnitAdvance(record, stage);
    assert.equal(advance('quiz'), false, 'A different stage cannot be skipped');
    assert.equal(advance('orientation'), true);
    assert.equal(advance('orientation'), false, 'A stale button cannot advance twice');
    for (const stage of ['lesson', 'mental', 'worked']) assert.equal(advance(stage), true);
    assert.equal(advance('recall'), false, 'Written comparisons must be opened');
    content.unit.activeRecallPrompts.forEach(
      (prompt, i) => (record.recall[i] = { draft: 'First written explanation ' + i, revealedAt: Date.now() })
    );
    record.recallIdx = record.recall.length;
    assert.equal(advance('recall'), true);
    for (const q of content.checks) {
      const wrong = (q.correctIndex + 1) % q.choices.length;
      assert.equal(h.context.neuroChoose(record, q, wrong), true);
      const at = record.answers[q.id].answeredAt;
      assert.equal(h.context.neuroChoose(record, q, q.correctIndex), false);
      assert.equal(record.answers[q.id].chosen, wrong);
      assert.equal(record.answers[q.id].answeredAt, at);
    }
    assert.equal(advance('quiz'), true);
    record.codeWork = h.context.neuroNewCodeWork(lesson);
    assert.equal(advance('code'), false);
    const starter = await h.context.neuroCodeEvaluateOJT(lesson.codeExample, lesson);
    assert.equal(starter.passed, false, lesson.id + ' starter leaves meaningful work');
    const printOnly = await h.context.neuroCodeEvaluateOJT(
      'print(' + JSON.stringify(lesson.expectedOutput) + ')',
      lesson
    );
    assert.equal(printOnly.passed, false, 'A memorized printout does not implement the function');
    const result = await h.context.neuroCodeEvaluateOJT(lesson.solution, lesson);
    assert.equal(result.passed, true, lesson.id + ': ' + result.stderr);
    cases += result.cases.length;
    record.codeWork.draft = lesson.solution;
    record.codeWork.attempts.push({ ...result, draft: lesson.solution, at: Date.now() });
    record.codeWork.draft += '\n# Changed after checking';
    assert.equal(advance('code'), false, 'A check is tied to the submitted draft');
    record.codeWork.draft = lesson.solution;
    assert.equal(advance('code'), true);
    const q = { id: 'simulation', choices: content.sim.choices };
    assert.equal(advance('sim'), false);
    assert.equal(h.context.neuroChoose(record, q, 1), true);
    assert.equal(advance('sim'), true, 'Reviewed practice can finish while retaining a wrong first answer');
    record.debrief = 'The threshold gives a candidate, not a source identity.';
    h.fail = true;
    assert.equal(advance('debrief'), false);
    const completedAt = record.completedAt;
    assert.ok(completedAt);
    assert.equal(
      JSON.parse(saved.get('cs-neuro')).units[step.id].completedAt,
      undefined,
      'Failed persistence must not pretend to reach disk'
    );
    h.fail = false;
    assert.equal(h.run('saveNeuroProg()'), true);
    assert.equal(advance('debrief'), false);
    assert.equal(record.completedAt, completedAt);
    assert.equal(h.context.neuroValidUnit(record), true);
  }
  const list = data.neuroCodeLessons.find(lesson => lesson.id === 'code-lists-samples');
  const mutating = await h.context.neuroCodeEvaluateOJT(
    'def append_sample(samples, value):\n    samples.append(value)\n    return samples',
    list
  );
  assert.equal(mutating.passed, false, 'Correct-looking return values cannot hide input mutation');
  const loops = data.neuroCodeLessons.find(lesson => lesson.id === 'code-loops-spike-counting');
  const badCount = await h.context.neuroCodeEvaluateOJT(
    'def count_events(samples, threshold):\n    return sum(value >= threshold for value in samples)',
    loops
  );
  assert.equal(badCount.passed, false, 'Per-sample counting must fail the multi-sample event case');
  const condition = data.neuroCodeLessons.find(lesson => lesson.id === 'code-if-threshold');
  const equalityWrong = await h.context.neuroCodeEvaluateOJT(
    'def at_or_above(sample, threshold):\n    return sample > threshold',
    condition
  );
  assert.equal(equalityWrong.passed, false, 'Boundary equality is tested');
  const prose = await h.context.neuroCodeEvaluateOJT('noise', {
    id: 'reflection',
    solution: 'Smoothing can hide details.',
    expectedOutput: 'noise',
  });
  assert.equal(prose.passed, false);
  assert.equal(prose.needsSelfReview, true);
  const changed = structuredClone(data);
  changed.unitLessons['1'].shortLesson = 'Replacement content';
  changed.simulations.find(sim => sim.id === 'sim-sampling-time').decisionQuestion = 'Changed application';
  const reload = harness(saved, changed);
  await reload.run('loadNeuro()');
  const firstId = data.learningPaths[0].steps[0].id;
  reload.context.firstId = firstId;
  assert.notEqual(reload.run('NEURO_PROG.units[firstId].content.unit.shortLesson'), 'Replacement content');
  assert.notEqual(
    reload.run('NEURO_PROG.units[firstId].content.sim.decisionQuestion'),
    'Changed application',
    'Saved applications remain frozen when the catalog changes'
  );
  assert.equal(reload.run('NEURO_PROG.units[firstId].recall[0].draft'), 'First written explanation 0');
  assert.equal(reload.run('NEURO_PROG.pathDone.length'), 8, 'Legacy IDs remain stored unchanged');
  assert.equal(reload.run('pathProgress().done'), 6);
  const damaged = JSON.parse(saved.get('cs-neuro'));
  damaged.units[firstId].answers[damaged.units[firstId].content.checks[0].id].chosen = 99;
  const corrupted = new Map([['cs-neuro', JSON.stringify(damaged)]]),
    bad = harness(corrupted);
  assert.equal(bad.invalid, 1);
  assert.equal(corrupted.get('cs-neuro'), JSON.stringify(damaged));
  console.log(
    `Neuro foundations: 5 complete state journeys, ${cases} Python reference cases, wrong-code counterexamples, first-answer retention, immutable content, legacy progress, loading retry and damaged-record protection passed. Browser walkthroughs remain separate.`
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
