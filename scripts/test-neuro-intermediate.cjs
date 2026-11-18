/* The intermediate tier (NumPy exercises) and the module checkpoints.
 * Exercises: the data is consistent with the course, the checker handles arrays in real CPython with
 * NumPy, and the exercise screen asks the runner for NumPy. Checkpoints: the draw, the first-answer
 * scoring, the pass mark, saving and the screens, in jsdom. Pyodide itself is covered by the browser
 * suite. python3 needs NumPy for this file (pip install numpy). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { JSDOM } = require('jsdom');

const data = JSON.parse(fs.readFileSync('data/neuro.json'));
const path = data.learningPaths[0],
  steps = path.steps,
  modules = path.modules;
const lessons = data.neuroCodeLessons,
  numpy = lessons.filter(lesson => lesson.packages),
  byId = Object.fromEntries(lessons.map(lesson => [lesson.id, lesson])),
  sim = id => data.simulations.find(item => item.id === id);
const moduleOf = lessonId => {
  const step = steps.find(item => item.neuroCodeLessonId === lessonId);
  return step ? modules.find(module => module.unitOrders.includes(step.order)).id : null;
};
const esc = value =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('"', '&quot;');

/* ---------- The eight exercises ---------- */
assert.equal(numpy.length, 8, 'Eight NumPy exercises');
for (const module of modules)
  assert.equal(numpy.filter(lesson => lesson.moduleId === module.id).length, 2, 'Two per module: ' + module.id);
for (const lesson of numpy) {
  const label = lesson.id;
  assert.deepEqual(lesson.packages, ['numpy'], label);
  assert.equal(lesson.difficulty, 'intermediate', label);
  assert.equal(lesson.checks.arrays, true, label);
  assert.ok(lesson.checks.cases.length >= 6, label + ' has at least six cases');
  assert.ok(
    steps.every(step => step.neuroCodeLessonId !== lesson.id),
    label + ' is optional, not a unit stage'
  );
  if (lesson.buildsOn) {
    assert.ok(byId[lesson.buildsOn] && !byId[lesson.buildsOn].packages, label + ' revisits a plain-Python exercise');
    assert.equal(moduleOf(lesson.buildsOn), lesson.moduleId, label + ' revisits an exercise from its own module');
  }
  for (const code of [lesson.codeExample, lesson.solution]) {
    assert.ok(code.startsWith('import numpy as np\n\ndef ' + lesson.checks.function + '('), label + ' code shape');
    assert.ok(code.trimEnd().split('\n').at(-1).startsWith('print('), label + ' ends by printing its example');
  }
  assert.ok(
    lesson.codeExample.split('\n').every(line => line.length <= 62),
    label + ' starter lines fit the editor without wrapping'
  );
  assert.ok(/Replace (this|the next) line/.test(lesson.codeExample), label + ' starter marks what to change');
  assert.ok(
    lesson.sources.length && lesson.sources.every(source => source.url.startsWith('https://numpy.org/doc/stable/'))
  );
  assert.ok(lesson.reviewStatus && lesson.hint && lesson.oneLineMaster && lesson.expectedOutput, label);
  assert.match(lesson.challengePrompt, /^Complete \w+\(/, label);
}

/* ---------- The numbers are the course's own ---------- */
const cases = id => byId[id].checks.cases;
{
  const decoder = sim('sim-dec-score-boundary'),
    first = cases('code-np-decode-trials')[0];
  assert.deepEqual(first.expected[0], decoder.series.values, 'The six decoder scores from the lab');
  assert.deepEqual(
    first.args[0].map((row, i) => [...row, first.args[1][i]]),
    decoder.instrument.trials,
    'The six labeled trials from the lab'
  );
  assert.equal(first.expected[1], 5 / 6, 'Five of six, as the lab shows');
  const cursor = cases('code-np-delayed-cursor');
  assert.deepEqual(cursor[0].expected, sim('sim-bci-latency-trace').series.values, 'The latency lab trace');
  assert.deepEqual(cursor[2].expected, sim('sim-bci-speed-limit').series.values, 'The speed-limit lab trace');
  const cost = sim('sim-cl-confirm-cost'),
    triggers = cases('code-np-confirm-triggers');
  assert.deepEqual(triggers[0].args[0], cost.series.values);
  assert.deepEqual(triggers[1].expected, cost.series.markerIndices, 'Setting A acts where the lab circles');
  assert.deepEqual([triggers[0].expected, triggers[2].expected], [[7], [2, 7]], 'Settings B and C');
  const priced = cases('code-np-error-costs')[0],
    settings = cost.instrument.costs.settings;
  assert.deepEqual(priced.args.slice(0, 2), [settings.map(s => s.falseActions), settings.map(s => s.missed)]);
  assert.deepEqual(priced.expected, [[30, 12, 34], 1], 'B is cheapest at the agreed costs');
  const smooth = data.unitLessons['5'].simulation;
  assert.deepEqual(cases('code-np-moving-average')[0].args[0], smooth.series.values);
  assert.deepEqual(cases('code-np-moving-average')[0].expected, [3, 3, 3]);
  for (const [np, plain] of [
    ['code-np-count-episodes', 'code-loops-spike-counting'],
    ['code-np-moving-average', 'code-noise-smoothing'],
  ])
    assert.ok(
      cases(plain).some(item =>
        cases(np).some(other => JSON.stringify(other.expected) === JSON.stringify(item.expected))
      ),
      np + ' shares a case with ' + plain
    );
}

/* ---------- The checker with arrays, in CPython ---------- */
const evaluator = vm.createContext({ console, JSON, Date, Math, Map });
vm.runInContext(fs.readFileSync('code-evaluator.js', 'utf8'), evaluator);
function check(lesson, code) {
  const marker = 'CHECK_MARK:';
  const script = vm.runInContext('neuroCodeCheckScript', evaluator)(code, lesson, marker);
  const run = spawnSync('python3', ['-'], { input: script, encoding: 'utf8', timeout: 20000 });
  assert.equal(run.status, 0, lesson.id + ' check script failed (python3 needs NumPy):\n' + run.stderr);
  const line = run.stdout.split('\n').find(item => item.startsWith(marker));
  return JSON.parse(line.slice(marker.length)).cases;
}
for (const lesson of numpy) {
  const solved = check(lesson, lesson.solution);
  assert.ok(
    solved.every(item => item.passed),
    lesson.id + ' solution passes: ' + JSON.stringify(solved.filter(item => !item.passed))
  );
  assert.ok(!check(lesson, lesson.codeExample).every(item => item.passed), lesson.id + ' starter does not pass');
}
{
  const average = byId['code-np-moving-average'];
  const asList = average.solution.replace(
    'return np.convolve(samples, weights, mode="valid")',
    'return [float(v) for v in np.convolve(samples, weights, mode="valid")]'
  );
  assert.notEqual(asList, average.solution);
  assert.ok(
    check(average, asList).every(item => item.passed),
    'A plain list of numbers is as good as an array'
  );
  const loop = `import numpy as np\n\ndef moving_average(samples, width):\n    if not isinstance(width, int) or not 1 <= width <= len(samples):\n        raise ValueError("width")\n    return [sum(samples[i:i + width]) / width for i in range(len(samples) - width + 1)]\n`;
  assert.ok(
    check(average, loop).every(item => item.passed),
    'A correct loop passes too: the result is what is checked'
  );
  const mutating = byId['code-np-normalize-session'].solution.replace(
    '    return (features - rest_means) / scales',
    '    features = features.astype(float)\n    scales[0] = 1.0\n    return (features - rest_means) / [10, 10, 2][: scales.size]'
  );
  const kept = check(byId['code-np-normalize-session'], mutating);
  assert.ok(
    kept.some(item => item.argsPreserved === false && !item.passed),
    'Changing an input array fails the case'
  );
  const offByOne = byId['code-np-confirm-triggers'].solution.replace('+ n - 1', '+ n');
  assert.ok(
    !check(byId['code-np-confirm-triggers'], offByOne).every(item => item.passed),
    'An off-by-one index is caught'
  );
  const tie = byId['code-np-decode-trials'].solution.replace('(scores > 0)', '(scores >= 0)');
  assert.ok(!check(byId['code-np-decode-trials'], tie)[0].passed, 'The wrong tie rule is caught by the lab trials');
  const noDelay = byId['code-np-delayed-cursor'].codeExample;
  const traced = check(byId['code-np-delayed-cursor'], noDelay);
  assert.deepEqual(
    [traced[0].passed, traced[1].passed],
    [false, true],
    'Ignoring the delay passes only the no-delay case'
  );
}
// Plain-Python exercises are checked exactly as before: lists stay lists and nothing imports NumPy.
{
  const plainLesson = byId['code-noise-smoothing'];
  assert.ok(check(plainLesson, plainLesson.solution).every(item => item.passed));
  const tuple = plainLesson.solution.replace('return result', 'return tuple(result)');
  assert.ok(!check(plainLesson, tuple).every(item => item.passed), 'Without arrays a tuple is not a list');
  const script = vm.runInContext('neuroCodeCheckScript', evaluator)(plainLesson.solution, plainLesson, 'M:');
  assert.ok(
    script.includes("arrays = bool(spec.get('arrays'))") && script.includes('if arrays:\n        import numpy as np')
  );
}

/* ---------- Screens ---------- */
function screen(route, seed, random) {
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', {
    url: 'http://localhost' + route,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window,
    errors = [],
    runs = [];
  if (seed) w.localStorage.setItem('cs-neuro', JSON.stringify(seed));
  w.addEventListener('error', event => errors.push(event.error || event.message));
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  // jsdom has no modal dialogs; the storage layer opens one when saved work cannot be read.
  w.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  if (random) w.Math.random = random;
  w.el = html => {
    const template = w.document.createElement('template');
    template.innerHTML = html;
    return template.content.firstElementChild;
  };
  w.esc = esc;
  w.LETTERS = ['A', 'B', 'C', 'D', 'E'];
  w.topbar = () => w.el('<header>Neuroengineering</header>');
  w.sectionUrl = () => '/neuro';
  w.setView = root => w.document.querySelector('#app').replaceChildren(root);
  w.fetch = async url => ({
    ok: true,
    json: async () => JSON.parse(fs.readFileSync(String(url).split('?')[0].replace(/^\//, ''))),
  });
  const ctx = dom.getInternalVMContext();
  for (const file of [
    'study-storage.js',
    'code-evaluator.js',
    'neuro-project-engine.js',
    'neuro-practitioner.js',
    'neuro-instruments.js',
    'neuro.js',
  ])
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
  w.runPythonCode = async (code, options) => {
    runs.push({ code, packages: options.packages });
    return { ok: true, stdout: '', stderr: '' };
  };
  const find = selector => w.document.querySelector(selector);
  return {
    w,
    find,
    errors,
    runs,
    all: selector => [...w.document.querySelectorAll(selector)],
    open: () => w.renderNeuroEngineering({ fromUrl: true }),
    saved: () => JSON.parse(w.localStorage.getItem('cs-neuro')),
    raw: () => w.localStorage.getItem('cs-neuro'),
    run: code => vm.runInContext(code, ctx),
  };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
// A repeatable stand-in for Math.random, so a draw can be asserted exactly and varied by seed.
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
const questionsOf = module =>
  module.unitOrders.flatMap(order => data.unitLessons[String(order)].checks.map(question => ({ ...question, order })));
const byPrompt = Object.fromEntries(
  Object.values(data.unitLessons).flatMap(unit => unit.checks.map(question => [question.prompt, question]))
);

(async () => {
  /* ----- exercise screen and list ----- */
  const exercise = screen('/neuro?code=code-np-decode-trials');
  await exercise.open();
  assert.equal(exercise.find('.nx-tag-tier').textContent, 'Intermediate · NumPy');
  assert.match(
    exercise.find('.nx-builds').textContent,
    /plain-Python version of this is “Held-Out Evaluation: Keep the Rule Fixed”/
  );
  assert.ok(exercise.all('.nx-ex-brief details summary').some(node => node.textContent === 'New to NumPy arrays?'));
  assert.ok(
    !exercise.all('.nx-ex-brief details summary').some(node => node.textContent === 'New to Python functions?')
  );
  assert.match(exercise.find('.nx-task').textContent, /List inputs arrive as NumPy arrays\./);
  assert.equal(exercise.find('#neuro-code-editor').value, byId['code-np-decode-trials'].codeExample.trim());
  exercise.find('[data-run-code]').click();
  await tick();
  await tick();
  exercise.find('[data-check-code]').click();
  await tick();
  await tick();
  assert.equal(exercise.runs.length, 2, 'Run and Check both reach the runner');
  assert.deepEqual(
    exercise.runs.map(run => [...run.packages]),
    [['numpy'], ['numpy']],
    'Both ask for NumPy'
  );
  assert.deepEqual(exercise.errors, []);
  const plain = screen('/neuro?code=code-noise-smoothing');
  await plain.open();
  assert.equal(plain.find('.nx-tag-tier'), null);
  assert.ok(plain.all('.nx-ex-brief details summary').some(node => node.textContent === 'New to Python functions?'));
  plain.find('[data-run-code]').click();
  await tick();
  await tick();
  assert.deepEqual([...plain.runs[0].packages], [], 'Plain exercises load nothing extra');
  assert.equal(
    plain.run("JSON.stringify(neuroCodePackages({ packages: ['numpy', 'micropip', 'pandas'] }))"),
    '["numpy"]'
  );
  assert.equal(plain.run("JSON.stringify(neuroCodePackages({ packages: 'numpy' }))"), '[]');

  const list = screen('/neuro?view=code');
  await list.open();
  assert.match(list.find('.neuro-lede').textContent, /^22 exercises in plain Python and 8 in NumPy\./);
  assert.deepEqual(
    list.all('.neuro-tier').map(node => node.textContent.replace(/\s+/g, ' ').trim()),
    ['Foundations plain Python', 'Intermediate NumPy']
  );
  assert.equal(list.all('#necodelab [data-code]').length, 22);
  assert.equal(list.all('#necodelab-numpy [data-code]').length, 8);
  assert.match(list.find('#necodelab-numpy [data-code] .neuro-row-sub').textContent, /Module 1: Signals$/);
  list.find('#necodelab-numpy [data-code="code-np-error-costs"]').click();
  assert.equal(list.find('h1').textContent, 'Arrays of Settings: Price the Errors and Choose');
  assert.equal(list.find('.nx-builds'), null, 'An exercise that revisits a lab names no plain-Python version');
  assert.deepEqual(list.errors, []);

  /* ----- the draw ----- */
  const drawer = screen('/neuro');
  await drawer.open();
  for (const module of modules) {
    const pool = questionsOf(module);
    assert.equal(pool.length, 10, module.id + ' has ten unit questions');
    for (let seed = 1; seed <= 40; seed++) {
      drawer.w.Math.random = seeded(seed * 7919);
      const run = drawer.run(
        `(() => { const module = neuroModules().find(item => item.id === ${JSON.stringify(module.id)}); const first = neuroCheckpointDraw(module); return JSON.stringify([first, neuroCheckpointDraw(module, first.ids)]); })()`
      );
      const [first, second] = JSON.parse(run);
      for (const draw of [first, second]) {
        assert.equal(draw.ids.length, 6);
        assert.equal(new Set(draw.ids).size, 6, 'No question twice');
        const drawn = draw.ids.map(id => pool.find(question => question.id === id));
        assert.ok(drawn.every(Boolean), 'Every question comes from this module');
        assert.equal(new Set(drawn.map(question => question.order)).size, 5, 'Every unit is represented');
        for (const question of drawn)
          assert.deepEqual(
            [...draw.order[question.id]].sort(),
            question.choices.map((_, i) => i),
            'Options are a full shuffle'
          );
        assert.deepEqual(draw.answers, {});
      }
      const repeated = second.ids.filter(id => first.ids.includes(id)).length;
      assert.equal(repeated, 2, 'A retake brings the four unseen questions and repeats two');
    }
  }
  assert.deepEqual(drawer.raw(), null, 'Drawing and viewing the hub saves nothing');
  assert.equal(drawer.all('[data-checkpoint]').length, 4, 'One checkpoint row per module on the hub');
  assert.match(
    drawer.find('[data-checkpoint="signals"]').textContent,
    /Checkpoint\s+Module 1 mixed review\s+6 mixed questions/
  );

  /* ----- a pass ----- */
  const page = screen('/neuro?checkpoint=decoding', null, seeded(11));
  await page.open();
  assert.equal(page.find('.neuro-eyebrow').textContent, 'Module 2 checkpoint');
  assert.equal(page.find('h1').textContent, 'Features & decoding: mixed review.');
  assert.match(
    page.find('.neuro-lede').textContent,
    /^Six questions from Units 6–10, in a new mix each time\. Five right is a pass\./
  );
  assert.equal(page.find('#necpmeta').textContent, '0 of 6 answered');
  assert.equal(page.all('#necpquestions [data-q]').length, 6);
  assert.equal(page.find('#necpresult'), null);
  const answer = (target, n, right) => {
    const block = target.find(`#necpquestions [data-q="${n}"]`),
      question = byPrompt[block.querySelector('p.q').textContent];
    assert.match(block.querySelector('.nx-q-n').textContent, new RegExp(`^Question ${n + 1} of 6 · Unit \\d+$`));
    const pick = right ? question.correctIndex : (question.correctIndex + 1) % question.choices.length;
    block.querySelector(`[data-cp-choice="${pick}"]`).click();
    return question;
  };
  const firstQuestion = answer(page, 0, true);
  assert.equal(page.find('#necpmeta').textContent, '1 of 6 answered');
  const explain = page.find('[data-q="0"] .explain');
  assert.equal(explain.querySelector('b').textContent, 'Correct first answer');
  assert.ok(explain.textContent.includes(firstQuestion.explanation));
  assert.equal(page.w.document.activeElement, explain, 'Focus moves to the explanation');
  assert.ok(
    page.all('[data-q="0"] [data-cp-choice]').every(button => button.disabled),
    'The first answer is final'
  );
  page.find('[data-q="0"] [data-cp-choice]').click();
  assert.equal(page.saved().checkpoints.decoding.attempts, 0, 'Nothing is scored until every question is answered');
  for (let n = 1; n < 6; n++) answer(page, n, true);
  assert.equal(page.find('#necpmeta').textContent, 'Attempt 1 finished · passed');
  const result = page.find('#necpresult');
  assert.ok(result.classList.contains('is-passed'));
  assert.equal(result.querySelector('.label').textContent, 'Checkpoint passed');
  assert.equal(result.querySelector('.nx-cp-score').textContent, '6 of 6');
  assert.equal(result.querySelector('.nx-cp-take').textContent, 'Every first answer was right.');
  assert.equal(page.w.document.activeElement, result);
  assert.equal(result.querySelector('[data-module]').textContent, 'Module 3 · The control loop →');
  assert.deepEqual(
    [...result.querySelectorAll('[data-code]')].map(button => button.dataset.code),
    ['code-np-channel-features', 'code-np-decode-trials'],
    'A pass points at the module in NumPy'
  );
  let saved = page.saved().checkpoints.decoding;
  assert.deepEqual([saved.attempts, saved.best, saved.last.length, typeof saved.passedAt], [1, 6, 6, 'number']);
  assert.ok(
    !/[<>]/.test(JSON.stringify(page.saved().checkpoints)),
    'Only ids and numbers are saved, so backups stay inert'
  );
  const passedAt = saved.passedAt;

  /* ----- a retake that falls short keeps the pass ----- */
  result.querySelector('#necpretake').click();
  assert.equal(page.find('#necpmeta').textContent, '0 of 6 answered · passed');
  assert.equal(page.find('#necpresult'), null);
  const again = page.saved().checkpoints.decoding.current.ids;
  assert.equal(again.filter(id => saved.last.includes(id)).length, 2);
  const missed = [answer(page, 0, false), answer(page, 1, false)];
  assert.equal(page.find('[data-q="1"] .explain b').textContent, 'First answer needs review');
  for (let n = 2; n < 6; n++) answer(page, n, true);
  const units = [
    ...new Set(
      missed.map(
        question => steps.findIndex(step => data.unitLessons[String(step.order)].checks.includes(question)) + 1
      )
    ),
  ].sort((a, b) => a - b);
  const where = units.length === 1 ? `Unit ${units[0]}` : `Units ${units[0]} and ${units[1]}`;
  const short = page.find('#necpresult');
  assert.ok(!short.classList.contains('is-passed'));
  assert.equal(short.querySelector('.label').textContent, 'Not yet');
  assert.equal(short.querySelector('.nx-cp-score').textContent, '4 of 6');
  assert.equal(
    short.querySelector('.nx-cp-take').textContent,
    `Five right is a pass. The questions you missed come from ${where}. Reread ${units.length === 1 ? 'that lesson' : 'those lessons'}, then try a new mix. Your earlier pass still stands.`
  );
  assert.deepEqual(
    [...short.querySelectorAll('[data-cp-unit]')].map(button => button.textContent),
    units.map(unit => `Review Unit ${unit}`)
  );
  assert.equal(short.querySelector('[data-module]'), null, 'No next-module button on a short attempt');
  saved = page.saved().checkpoints.decoding;
  assert.deepEqual([saved.attempts, saved.best, saved.passedAt], [2, 6, passedAt]);
  short.querySelector('[data-cp-unit]').click();
  assert.match(page.find('h1').textContent, new RegExp(steps[units[0] - 1].title.slice(0, 12)));
  assert.deepEqual(page.errors, []);

  /* ----- five of six passes with one miss named; a reload shows the finished attempt ----- */
  const five = screen('/neuro?checkpoint=signals', null, seeded(5));
  await five.open();
  const slip = answer(five, 3, false);
  for (const n of [0, 1, 2, 4, 5]) answer(five, n, true);
  const slipUnit = steps.findIndex(step => data.unitLessons[String(step.order)].checks.includes(slip)) + 1;
  assert.equal(five.find('.nx-cp-score').textContent, '5 of 6');
  assert.equal(five.find('.nx-cp-take').textContent, `You missed one question, from Unit ${slipUnit}.`);
  assert.ok(five.find('#necpresult').classList.contains('is-passed'));
  const reopened = screen('/neuro?checkpoint=signals', five.saved());
  await reopened.open();
  assert.equal(reopened.find('#necpmeta').textContent, 'Attempt 1 finished · passed');
  assert.equal(reopened.find('.nx-cp-score').textContent, '5 of 6');
  assert.equal(reopened.all('[data-cp-choice]:not([disabled])').length, 0);
  // The hub and the module page show the result and still write nothing.
  const before = JSON.stringify(reopened.saved());
  reopened.find('#neback').click();
  assert.equal(reopened.find('h1').textContent, 'Signals.');
  assert.match(reopened.find('[data-checkpoint="signals"]').textContent, /Passed · best 5\/6/);
  assert.equal(
    reopened
      .all('.neuro-module .neuro-rows [data-code]')
      .map(button => button.dataset.code)
      .join(),
    'code-np-count-episodes,code-np-moving-average'
  );
  assert.equal(JSON.stringify(reopened.saved()), before);
  reopened.find('[data-checkpoint="signals"]').click();
  assert.equal(reopened.find('h1').textContent, 'Signals: mixed review.');
  assert.deepEqual([...five.errors, ...reopened.errors], []);

  /* ----- saved records: a retired question forces a new draw, a damaged record is not overwritten ----- */
  const stale = five.saved();
  stale.checkpoints.signals.current.ids[0] = 'retired-question';
  stale.checkpoints.signals.current.order['retired-question'] = [0, 1, 2, 3];
  stale.checkpoints.signals.current.answers = {};
  delete stale.checkpoints.signals.current.finishedAt;
  const redrawn = screen('/neuro?checkpoint=signals', stale, seeded(9));
  await redrawn.open();
  assert.equal(redrawn.find('#necpmeta').textContent, '0 of 6 answered · passed');
  assert.ok(!redrawn.saved().checkpoints.signals.current.ids.includes('retired-question'));
  assert.equal(redrawn.saved().checkpoints.signals.attempts, 1, 'The result so far is kept');
  const valid = code => redrawn.run(`neuroValidCheckpoint(${code})`);
  const good = JSON.stringify(five.saved().checkpoints.signals);
  assert.equal(valid(good), true);
  assert.equal(valid(JSON.stringify({ attempts: 0, best: 0, passedAt: null, last: [], current: null })), true);
  for (const damage of [
    'null',
    '[]',
    JSON.stringify({ attempts: -1, best: 0, passedAt: null, last: [], current: null }),
    JSON.stringify({ attempts: 1, best: 'six', passedAt: null, last: [], current: null }),
    JSON.stringify({ attempts: 1, best: 1, passedAt: 'yesterday', last: [], current: null }),
    JSON.stringify({ attempts: 1, best: 1, passedAt: null, last: [3], current: null }),
    good.replace('"answers":{', '"answers":{"not-drawn":0,'),
    good.replace(/"order":\{"([^"]+)":\[[^\]]+\]/, '"order":{"$1":[0,0,1,2]'),
    good.replace('"startedAt":', '"startedAt":"soon","was":'),
  ])
    assert.equal(valid(damage), false, damage.slice(0, 60));
  const damaged = five.saved();
  damaged.checkpoints.signals.best = 'six';
  const guarded = screen('/neuro?checkpoint=signals', damaged);
  assert.ok(guarded.find('dialog[open]'), 'The reader is told that saved work could not be read');
  await guarded.open().catch(() => {});
  assert.equal(
    guarded.saved().checkpoints.signals.best,
    'six',
    'A record that cannot be read is left exactly as it was'
  );

  /* ----- routes ----- */
  const unknown = screen('/neuro?checkpoint=no-such-module');
  await unknown.open();
  assert.equal(unknown.find('[data-checkpoint="signals"]') != null, true, 'An unknown checkpoint opens the hub');
  assert.equal(page.w.location.search.startsWith('?unit='), true);
  assert.equal(five.w.location.search, '?checkpoint=signals');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
