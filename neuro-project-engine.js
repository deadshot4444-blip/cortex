/* Reproducible project records; automated function checks and written review stay separate. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NeuroProjectCore = api;
})(typeof window === 'undefined' ? globalThis : window, () => {
  'use strict';
  const MEMO = ['result', 'limitation', 'next'];
  // Revision 1 used the sign bit of zero, which JSON storage cannot retain.
  // Accept only this known example's exact normalized digest; edits still fail.
  const LEGACY_SPIKE_HASH = 'fc384baf91e4481bc8d5bd48b57b8c521b7a85921179910271f35018e96e26f2';
  const SPIKE_HASH = '3ff58dff685a6aac7d7ad9f4bda88f9b1cc575d4df83bdca2c84c2a2757b6a21';
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const text = (value, max = 6000) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  const id = value => typeof value === 'string' && /^[a-z0-9-]{1,120}$/.test(value);
  const vector = value =>
    Array.isArray(value) && value.length > 0 && value.length <= 512 && value.every(Number.isFinite);
  const matrix = value => Array.isArray(value) && value.length > 0 && value.every(vector);
  function validPreview(preview) {
    if (!object(preview) || !text(preview.units)) return false;
    if (preview.kind === 'signal')
      return (
        vector(preview.samples) &&
        Number.isFinite(preview.sampleRateHz) &&
        preview.sampleRateHz > 0 &&
        text(preview.note)
      );
    if (preview.kind === 'cursor') return vector(preview.targets) && Number.isFinite(preview.dt) && preview.dt > 0;
    const labels = (value, length) =>
      Array.isArray(value) && value.length === length && value.every(v => v === -1 || v === 1);
    if (preview.kind === 'decoder')
      return (
        matrix(preview.train) &&
        matrix(preview.test) &&
        labels(preview.trainLabels, preview.train.length) &&
        labels(preview.testLabels, preview.test.length)
      );
    if (preview.kind !== 'pipeline' || !object(preview.example)) return false;
    const trials = value => Array.isArray(value) && value.length > 0 && value.every(t => matrix(t) && t.length === 2);
    return (
      trials(preview.example.train_trials) &&
      trials(preview.example.test_trials) &&
      labels(preview.testLabels, preview.example.test_trials.length)
    );
  }
  function canonicalInputs(value) {
    if (typeof value === 'number') {
      const buffer = new ArrayBuffer(8);
      new DataView(buffer).setFloat64(0, value === 0 ? 0 : value, false);
      return 'n' + [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    }
    if (Array.isArray(value)) return '[' + value.map(canonicalInputs).join(',') + ']';
    if (object(value))
      return (
        '{' +
        Object.keys(value)
          .sort()
          .map(key => JSON.stringify(key) + ':' + canonicalInputs(value[key]))
          .join(',') +
        '}'
      );
    return JSON.stringify(value);
  }
  async function inputDigest(project, cryptoAPI = globalThis.crypto) {
    const bytes = new TextEncoder().encode(canonicalInputs(project.checks.cases[0].args));
    return [...new Uint8Array(await cryptoAPI.subtle.digest('SHA-256', bytes))]
      .map(x => x.toString(16).padStart(2, '0'))
      .join('');
  }
  function portableInputHash(project) {
    return project.id === 'spike-detector' && project.revision === 1 && project.inputSha256 === LEGACY_SPIKE_HASH
      ? SPIKE_HASH
      : project.inputSha256;
  }
  async function verifyInputs(project, cryptoAPI = globalThis.crypto) {
    return (await inputDigest(project, cryptoAPI)) === portableInputHash(project);
  }
  function validateProject(project) {
    if (
      !object(project) ||
      !id(project.id) ||
      !Number.isInteger(project.revision) ||
      project.revision < 1 ||
      !['title', 'objective', 'prompt', 'inputContract', 'provenance'].every(key => text(project[key])) ||
      !text(project.starter, 40000) ||
      !text(project.solution, 40000) ||
      !/^[a-f0-9]{64}$/.test(project.inputSha256) ||
      !Array.isArray(project.prerequisites) ||
      !project.prerequisites.every(id) ||
      !Array.isArray(project.method) ||
      !project.method.length ||
      !project.method.every(x => text(x)) ||
      !Array.isArray(project.rubric) ||
      !project.rubric.length ||
      !project.rubric.every(x => text(x)) ||
      !object(project.modelMemo) ||
      !MEMO.every(key => text(project.modelMemo[key])) ||
      !validPreview(project.preview) ||
      !Array.isArray(project.sources) ||
      project.sources.some(
        s => !text(s.title) || typeof s.url !== 'string' || !/^https:\/\/[^\s<>"'`]+$/.test(s.url)
      ) ||
      !object(project.review) ||
      !['pending', 'reviewed'].includes(project.review.status) ||
      (project.review.status === 'reviewed' && (!text(project.review.reviewer) || !text(project.review.reviewedOn)))
    )
      throw Error('The project description is incomplete.');
    const checks = project.checks;
    if (
      !object(checks) ||
      !/^[a-z_][a-z0-9_]*$/.test(checks.function) ||
      checks.preserveArgs !== true ||
      checks.captureExampleResult !== true ||
      !Array.isArray(checks.cases) ||
      checks.cases.length < 2 ||
      checks.cases.length > 40 ||
      !Array.isArray(checks.captureResultIndices) ||
      checks.captureResultIndices.some(i => !Number.isInteger(i) || i < 0 || i >= checks.cases.length) ||
      checks.cases.some(
        c =>
          !text(c.label) ||
          !Array.isArray(c.args) ||
          (c.raises ? c.raises !== 'ValueError' : !Object.hasOwn(c, 'expected'))
      )
    )
      throw Error('The project checks are incomplete.');
    return true;
  }
  function create(project, runId, now = Date.now()) {
    validateProject(project);
    if (!id(runId) || !Number.isFinite(now)) throw Error('The project could not start.');
    return {
      version: 1,
      runId,
      startedAt: now,
      content: clone(project),
      draft: project.starter,
      prediction: '',
      firstPrediction: null,
      attempts: [],
      memo: { result: '', limitation: '', next: '' },
      modelViewedAt: null,
      completedAt: null,
      completion: null,
    };
  }
  function validResult(result, project) {
    return (
      object(result) &&
      typeof result.passed === 'boolean' &&
      typeof result.message === 'string' &&
      (result.cases == null ||
        (Array.isArray(result.cases) &&
          result.cases.length === project.checks.cases.length &&
          result.cases.every(
            c =>
              object(c) &&
              typeof c.passed === 'boolean' &&
              typeof c.actual === 'string' &&
              typeof c.expected === 'string' &&
              typeof c.argsPreserved === 'boolean'
          ))) &&
      (!result.passed ||
        (Array.isArray(result.cases) &&
          result.cases.length === project.checks.cases.length &&
          result.cases.every(c => c.passed === true && c.argsPreserved === true)))
    );
  }
  function validateWork(work) {
    if (!object(work) || work.version !== 1 || !id(work.runId) || !Number.isFinite(work.startedAt))
      throw Error('The saved project is incomplete.');
    validateProject(work.content);
    if (
      typeof work.draft !== 'string' ||
      work.draft.length > 40000 ||
      typeof work.prediction !== 'string' ||
      work.prediction.length > 6000 ||
      !object(work.memo) ||
      MEMO.some(key => typeof work.memo[key] !== 'string' || work.memo[key].length > 6000) ||
      !Array.isArray(work.attempts) ||
      new Set(work.attempts.map(a => a.id)).size !== work.attempts.length ||
      (work.firstPrediction !== null &&
        (!object(work.firstPrediction) ||
          !text(work.firstPrediction.text) ||
          !Number.isFinite(work.firstPrediction.recordedAt))) ||
      (work.modelViewedAt !== null && !Number.isFinite(work.modelViewedAt))
    )
      throw Error('The saved writing could not open.');
    for (const attempt of work.attempts) {
      if (
        !id(attempt.id) ||
        !text(attempt.draft, 40000) ||
        !Number.isFinite(attempt.startedAt) ||
        !['running', 'done', 'interrupted'].includes(attempt.status) ||
        typeof attempt.assisted !== 'boolean' ||
        (attempt.status === 'done' ? !validResult(attempt.result, work.content) : attempt.result !== null)
      )
        throw Error('A saved project check is invalid.');
    }
    if (
      work.attempts.filter(a => a.status === 'running').length > 1 ||
      work.attempts.some((a, i) => a.status === 'running' && i !== work.attempts.length - 1)
    )
      throw Error('The saved project has conflicting checks.');
    if (work.attempts.length && !work.firstPrediction) throw Error('The first prediction is missing.');
    if (work.completedAt !== null) {
      const attempt = work.attempts.find(a => a.id === work.completion?.attemptId);
      if (
        !Number.isFinite(work.completedAt) ||
        !attempt ||
        attempt !== work.attempts.at(-1) ||
        attempt.status !== 'done' ||
        !attempt.result.passed ||
        attempt.draft !== work.draft ||
        !MEMO.every(key => text(work.memo[key])) ||
        !object(work.completion.memo) ||
        MEMO.some(key => work.completion.memo[key] !== work.memo[key])
      )
        throw Error('The saved project completion is invalid.');
    } else if (work.completion !== null) throw Error('An unfinished project has a completion record.');
    return true;
  }
  function validateRecords(records) {
    if (!object(records)) throw Error('The saved project collection is invalid.');
    for (const [key, value] of Object.entries(records)) {
      if (
        !id(key) ||
        !object(value) ||
        !Array.isArray(value.history) ||
        (value.current !== null && !object(value.current))
      )
        throw Error('A project history is invalid.');
      const runs = [...value.history, ...(value.current ? [value.current] : [])];
      if (new Set(runs.map(run => run.runId)).size !== runs.length)
        throw Error('Project histories contain a duplicate run.');
      for (const run of runs) {
        validateWork(run);
        if (run.content.id !== key) throw Error('A project history has the wrong source.');
      }
      if (value.history.some(run => run.completedAt === null))
        throw Error('An unfinished run was archived as complete.');
    }
    return true;
  }
  function edit(work, key, value) {
    if (work.completedAt !== null || typeof value !== 'string' || value.length > (key === 'draft' ? 40000 : 6000))
      return false;
    if (key === 'draft') work.draft = value;
    else if (key === 'prediction' && !work.firstPrediction) work.prediction = value;
    else if (MEMO.includes(key)) work.memo[key] = value;
    else return false;
    return true;
  }
  function begin(work, attemptId, now = Date.now()) {
    validateWork(work);
    if (
      work.completedAt !== null ||
      work.attempts.some(a => a.status === 'running') ||
      !text(work.draft, 40000) ||
      !(work.firstPrediction || text(work.prediction)) ||
      !id(attemptId) ||
      work.attempts.some(a => a.id === attemptId)
    )
      throw Error('Write a prediction and code before checking; wait for any active check to finish.');
    work.firstPrediction ||= { text: work.prediction, recordedAt: now };
    const attempt = {
      id: attemptId,
      startedAt: now,
      draft: work.draft,
      status: 'running',
      result: null,
      assisted: work.modelViewedAt !== null,
    };
    work.attempts.push(attempt);
    return attempt;
  }
  function finish(work, attemptId, result, now = Date.now()) {
    const attempt = work.attempts.find(a => a.id === attemptId);
    if (!attempt || attempt.status !== 'running' || !validResult(result, work.content)) return false;
    attempt.result = clone(result);
    attempt.status = 'done';
    attempt.finishedAt = now;
    return true;
  }
  function interrupt(work) {
    let changed = false;
    for (const attempt of work.attempts)
      if (attempt.status === 'running') {
        attempt.status = 'interrupted';
        changed = true;
      }
    return changed;
  }
  function ready(work) {
    const last = work.attempts.at(-1);
    return (
      work.completedAt === null &&
      last?.status === 'done' &&
      last.result.passed &&
      last.draft === work.draft &&
      MEMO.every(key => text(work.memo[key]))
    );
  }
  function complete(work, now = Date.now()) {
    validateWork(work);
    if (!ready(work)) return false;
    work.completedAt = now;
    work.completion = {
      attemptId: work.attempts.at(-1).id,
      memo: clone(work.memo),
      assisted: work.modelViewedAt !== null,
    };
    return true;
  }
  function completed(record) {
    return (
      !!record &&
      [...(record.history || []), ...(record.current ? [record.current] : [])].some(work =>
        Number.isFinite(work?.completedAt)
      )
    );
  }
  function unlocked(project, done, previous) {
    return project.prerequisites.every(id => done.includes(id)) && (!project.previousProject || completed(previous));
  }
  return {
    MEMO,
    clone,
    canonicalInputs,
    inputDigest,
    portableInputHash,
    verifyInputs,
    validateProject,
    validateWork,
    validateRecords,
    create,
    edit,
    begin,
    finish,
    interrupt,
    ready,
    complete,
    completed,
    unlocked,
  };
});
