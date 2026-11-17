/* Lab instruments: every lab's authored setting must reproduce the numbers its own text states,
 * each task must be reachable with the controls on screen, and the screen must update when a
 * control moves. Models run in a plain VM; the screen runs in jsdom, which lays nothing out. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const data = JSON.parse(fs.readFileSync('data/neuro.json'));
const source = fs.readFileSync('neuro-instruments.js', 'utf8');
const esc = value =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('"', '&quot;');
const context = vm.createContext({ esc, console, Math, Number, String, Object, Set, JSON });
vm.runInContext(source, context);
const run = code => vm.runInContext(code, context);
const bench = name => run(name);
const plain = value => JSON.parse(JSON.stringify(value));
const close = (actual, expected, label) => {
  assert.equal(actual.length, expected.length, label + ' length');
  actual.forEach((value, i) =>
    assert.ok(Math.abs(value - expected[i]) < 1e-9, `${label}[${i}] ${value} vs ${expected[i]}`)
  );
};

const steps = data.learningPaths[0].steps;
const unitSims = Object.values(data.unitLessons)
  .map(unit => unit.simulation)
  .filter(Boolean);
const labs = [...data.simulations, ...unitSims];
const lab = id => labs.find(item => item.id === id);
const live = labs.filter(item => item.instrument);
const detect = bench('neuroBenchDetect'),
  band = bench('neuroBenchBand'),
  loop = bench('neuroBenchLoop'),
  boundary = bench('neuroBenchBoundary'),
  smooth = bench('neuroBenchSmooth'),
  price = bench('neuroBenchCosts'),
  valid = bench('neuroBenchValid'),
  markup = bench('neuroBenchMarkup');

/* ---------- Which labs carry an instrument ---------- */
assert.deepEqual(
  live.map(item => item.id).sort(),
  [
    'sim-bci-abstain-hold',
    'sim-bci-latency-trace',
    'sim-bci-speed-limit',
    'sim-cl-confirm-cost',
    'sim-cl-false-positive',
    'sim-dec-score-boundary',
    'unit-smoothing-peak',
    'unit-threshold-episodes',
  ],
  'Eight labs are adjustable'
);
for (const item of live) {
  assert.equal(valid(item.instrument, item), true, item.id + ' instrument is valid');
  const inPath = steps.some(step => step.simulationId === item.id) || unitSims.includes(item);
  assert.ok(inPath, item.id + ' is a lab the guided path reaches');
}
assert.equal(new Set(labs.map(item => item.id)).size, labs.length, 'Lab ids are unique, so saved settings never mix');

/* ---------- Trigger-Happy Detector ---------- */
{
  const sim = lab('sim-cl-false-positive'),
    spec = sim.instrument,
    values = sim.series.values;
  assert.equal(spec.threshold.value, sim.series.threshold);
  const at5 = detect(values, 5, 1, spec.event);
  assert.deepEqual(
    plain(at5.episodes.map(episode => episode.start)),
    sim.series.markerIndices,
    'Circled episode starts'
  );
  assert.deepEqual(
    plain(at5.episodes.filter(episode => episode.start <= spec.event.end && episode.end >= spec.event.start)),
    [{ start: 7, end: 8, act: 7 }],
    'Only the episode at index 7 overlaps the labeled event'
  );
  assert.deepEqual([at5.windows, at5.inside, at5.outside, at5.eventWindows], [5, 2, 3, 2]);
  assert.match(sim.signalDescription, /four episodes start \(circled\) and only the one at index 7 overlaps/);
  const at6 = detect(values, 6, 1, spec.event);
  assert.deepEqual([at6.inside, at6.outside, at6.episodes.length], [2, 0, 1], 'Threshold 6 keeps the event only');
  assert.match(
    sim.choices[sim.bestAnswerIndex].rationale,
    /threshold of 6 would keep the event at index 7 and drop the three brief crossings/
  );
  // The task's stated range: every step from 5.5 to 9.6 works, and nothing outside it does.
  for (let tenths = spec.threshold.min * 10; tenths <= spec.threshold.max * 10; tenths++) {
    const result = detect(values, tenths / 10, 1, spec.event);
    assert.equal(result.inside >= 1 && result.outside === 0, tenths >= 55 && tenths <= 96, 'threshold ' + tenths / 10);
  }
  assert.match(spec.done, /from 5\.5 to 9\.6/);
  const lower = detect(values, 3, 1, spec.event);
  assert.ok(lower.outside > at5.outside, 'A lower threshold adds windows outside the event');
}

/* ---------- Safety: Price the Errors ---------- */
{
  const sim = lab('sim-cl-confirm-cost'),
    spec = sim.instrument,
    values = sim.series.values;
  assert.equal(spec.threshold.value, sim.series.threshold);
  const [a, b, c] = spec.presets.map(preset => detect(values, preset.threshold, preset.confirm, spec.event));
  assert.deepEqual(plain(a.actions), sim.series.markerIndices, 'Circles mark where setting A would act');
  assert.deepEqual([a.actionsOff, a.caught, a.delay], [1, true, 0]);
  assert.deepEqual(plain(b.actions), [7], 'B waits for the third window');
  assert.deepEqual([b.actionsOff, b.caught, b.delay * (1000 / sim.series.sampleRateHz)], [0, true, 200]);
  assert.match(
    sim.scenario,
    /B: threshold 5, act after 3 consecutive 100 ms windows: 4 false actions, 1 missed event, 200 ms added delay/
  );
  assert.deepEqual([plain(c.actions), c.actionsOff, c.caught], [[2, 7], 1, true], 'C still acts on the artifact');
  assert.equal(values[spec.artifact.index], 9);
  assert.deepEqual([spec.event.start, spec.event.end], [5, 9]);
  assert.match(sim.series.description, /Index 2 is a single-window artifact; indices 5 to 9 are a sustained event/);
  // With one window, no threshold on the slider both ignores the artifact and still acts on the event.
  for (let threshold = spec.threshold.min; threshold <= spec.threshold.max; threshold += spec.threshold.step) {
    const result = detect(values, threshold, 1, spec.event);
    assert.ok(!(result.actionsOff === 0 && result.caught), 'threshold ' + threshold);
  }
  const costs = price(spec.costs.settings, spec.costs.falseAction, spec.costs.missedEvent);
  assert.deepEqual(plain(costs), { costs: [30, 12, 34], lowest: [1] });
  assert.match(sim.choices[sim.bestAnswerIndex].label, /B: 4 × 1 \+ 1 × 8 = 12/);
  assert.ok(sim.choices.some(choice => choice.rationale === 'They cost 30, 12 and 34.'));
  for (const setting of spec.costs.settings)
    assert.match(
      sim.scenario,
      new RegExp(`${setting.label}: [^.]*: ${setting.falseActions} false actions, ${setting.missed} missed event`),
      'Setting ' + setting.label + ' matches the scenario'
    );
  // "A wins once one missed event costs more than 26 false actions."
  for (let falseCost = 1; falseCost <= 10; falseCost++)
    for (let missCost = 1; missCost <= 40; missCost++) {
      const { lowest } = price(spec.costs.settings, falseCost, missCost);
      assert.equal(lowest.length === 1 && lowest[0] === 0, missCost > 26 * falseCost, `${falseCost}/${missCost}`);
    }
}

/* ---------- Count entries, not samples ---------- */
{
  const sim = lab('unit-threshold-episodes'),
    spec = sim.instrument;
  const at2 = detect(sim.series.values, spec.threshold.value);
  assert.deepEqual([at2.windows, at2.episodes.length], [3, 2]);
  assert.equal(sim.choices[sim.bestAnswerIndex].label, 'Three qualifying samples and two episodes');
  assert.match(sim.signalDescription, /A sample qualifies when it is at least 2/);
  assert.equal(detect(sim.series.values, 2.5).windows, 0, 'One step higher, nothing qualifies');
  const all = detect(sim.series.values, 0);
  assert.deepEqual([all.windows, all.episodes.length], [5, 1]);
}

/* ---------- Uncertainty: The Cursor Has Stopped ---------- */
{
  const sim = lab('sim-bci-abstain-hold'),
    spec = sim.instrument,
    rate = sim.series.sampleRateHz;
  const authored = band(sim.series.values, spec.threshold, spec.margin.value, rate);
  assert.deepEqual([authored.acted, authored.held, authored.longestHold, authored.flips], [3, 9, 2.25, 0]);
  assert.match(
    sim.scenario,
    /abstains when a score is within 0\.5 of 0\. After three confident windows, the next nine scores all fall inside the margin, so the cursor has held still for 2\.25 s/
  );
  const none = band(sim.series.values, spec.threshold, 0, rate);
  assert.deepEqual([none.acted, none.held, none.flips], [11, 1, 4], 'No margin: four direction changes');
  assert.match(spec.done, /^Four direction changes in the last 2\.25 s, each driven by a score of 0\.4 or less/);
  const weak = sim.series.values.slice(3);
  assert.ok(weak.every(value => Math.abs(value) <= 0.4) && weak.length / rate === 2.25);
  assert.deepEqual(plain(authored.decisions.slice(0, 3)), [1, 1, 1], 'The confident windows are above the threshold');
  assert.ok(sim.choices.some(choice => /Keep moving right, the last confident label/.test(choice.label)));
  assert.equal(spec.labels[1], 'right');
}

/* ---------- Latency: Why Does the Cursor Overshoot? ---------- */
{
  const sim = lab('sim-bci-latency-trace'),
    spec = sim.instrument;
  const settings = {
    gain: spec.gain.value,
    limit: spec.limit.value,
    delaySteps: spec.delay.value,
    target: spec.target,
    dt: spec.dt,
    steps: spec.steps,
  };
  const authored = loop(settings);
  close(authored.positions.slice(0, sim.series.values.length), sim.series.values, 'Delayed run');
  assert.equal(1 / spec.dt, sim.series.sampleRateHz);
  const direct = loop({ ...settings, ...spec.compare.set });
  close(direct.positions.slice(0, 5), [0, 0.5, 0.75, 0.875, 0.9375], 'No-delay run');
  assert.match(
    sim.signalDescription,
    /^No delay \(for comparison\): 0, 0\.5, 0\.75, 0\.875, 0\.9375\. With 0\.2 s delay \(plotted\)/
  );
  assert.match(
    sim.scenario,
    /velocity = 5 × \(target - observed position\).*speed limit, 10 units\/s.*observed position is 0\.2 s old/
  );
  assert.equal(spec.delay.value * spec.dt, 0.2);
  assert.ok(Math.abs(authored.peak - 1.75) < 1e-9 && authored.settle === null && authored.clippedCount === 0);
  assert.equal(direct.overshoot, 0);
  // "At a gain of 2 or less the cursor passes the target by no more than 0.04. At 2 it settles in 0.6 s."
  for (let gain = spec.gain.min; gain <= spec.gain.max; gain += spec.gain.step) {
    const overshoot = loop({ ...settings, gain }).overshoot;
    assert.equal(overshoot <= 0.05, gain <= 2, 'gain ' + gain);
    if (gain <= 2) assert.ok(overshoot <= 0.04 + 1e-9, 'gain ' + gain + ' overshoot ' + overshoot);
  }
  assert.ok(Math.abs(loop({ ...settings, gain: 2 }).settle - 0.6) < 1e-9);
  assert.equal(
    spec.done,
    'At a gain of 2 or less the cursor passes the target by no more than 0.04. At 2 it settles in 0.6 s. At 5 it was still swinging after 3 s.'
  );
  assert.equal(spec.steps * spec.dt, 3);
}

/* ---------- Cursor: Why Is the Start So Steady? ---------- */
{
  const sim = lab('sim-bci-speed-limit'),
    spec = sim.instrument;
  const settings = {
    gain: spec.gain.value,
    limit: spec.limit.value,
    delaySteps: spec.delay.value,
    target: spec.target,
    dt: spec.dt,
    steps: spec.steps,
  };
  const authored = loop(settings);
  close(authored.positions.slice(0, sim.series.values.length), sim.series.values, 'Speed-limited run');
  assert.match(sim.scenario, /velocity = 8 × \(target - position\), clips it to a 2 units\/s speed limit/);
  assert.deepEqual(plain(authored.clipped.slice(0, 6)), [true, true, true, true, false, false], 'Four clipped updates');
  assert.ok(
    Math.abs(authored.firstStep - 0.2) < 1e-9 && Math.abs(authored.settle - 0.5) < 1e-9 && authored.overshoot === 0
  );
  // "At a limit of 8 or more the first command passes unclipped and the first step is 0.8."
  for (let limit = spec.limit.min; limit <= spec.limit.max; limit += spec.limit.step) {
    const result = loop({ ...settings, limit });
    assert.equal(result.clippedCount === 0, limit >= 8, 'limit ' + limit);
    if (limit >= 8) assert.ok(Math.abs(result.firstStep - 0.8) < 1e-9);
  }
  assert.deepEqual(plain(spec.mask), ['clipped'], 'The clipped updates stay hidden until the first answer');
}

/* ---------- Decoder: Where Does the Fixed Rule Fail? ---------- */
{
  const sim = lab('sim-dec-score-boundary'),
    spec = sim.instrument;
  const authored = boundary(spec.trials, spec.weights, spec.bias.value);
  assert.deepEqual(plain(authored.scores), sim.series.values, 'Scores f1 - f0');
  assert.deepEqual(plain(authored.wrong), [3]);
  assert.match(sim.choices[sim.bestAnswerIndex].label, /^The trial at 3 s \[12, 11\]/);
  for (const [i, [f0, f1, label]] of spec.trials.entries())
    assert.ok(sim.scenario.includes(`[${f0}, ${f1}, ${spec.labels[label]}]`), 'Trial ' + i + ' is in the scenario');
  assert.match(sim.scenario, /weights \[-1, 1\] and bias 0.*labels right only when the score is above 0/);
  // "A bias above 1 fixes the trial at [12, 11] and breaks the one at [10, 10]. No shift labels all six."
  for (let bias = spec.bias.min; bias <= spec.bias.max; bias += spec.bias.step) {
    const result = boundary(spec.trials, spec.weights, bias);
    assert.ok(result.correct <= 5, 'bias ' + bias);
    if (bias > 1) assert.ok(!result.wrong.includes(3) && result.wrong.includes(5), 'bias ' + bias);
  }
}

/* ---------- Inspect a smoothed peak ---------- */
{
  const sim = lab('unit-smoothing-peak'),
    spec = sim.instrument,
    values = sim.series.values;
  const authored = smooth(values, spec.width.value, spec.pad.value);
  assert.deepEqual(
    plain(authored),
    [1, 2, 3].map(index => ({ index, value: 3 }))
  );
  assert.match(sim.choices[sim.bestAnswerIndex].label, /^\[3, 3, 3\]/);
  assert.match(sim.signalDescription, /original center indices 1, 2 and 3/);
  assert.deepEqual(
    plain(smooth(values, 3, true).map(item => item.value)),
    [0, 3, 3, 3, 0],
    'Zero padding gives the distractor'
  );
  assert.deepEqual(plain(smooth(values, 5, false)), [{ index: 2, value: 1.8 }]);
  assert.deepEqual(plain(smooth(values, 1, false).map(item => item.value)), values);
  assert.match(spec.done, /one output: 9 \/ 5 = 1\.8/);
}

/* ---------- Steering by hand: the view is the position `delay` seconds ago ---------- */
{
  const seen = bench('neuroBenchSeen'),
    trail = [
      [0, 0],
      [1, 1],
      [2, 1],
    ];
  assert.equal(seen(trail, 1, 0), 1, 'A live view is the current position');
  assert.equal(seen(trail, 1, 0.5), 0.5, 'A delayed view is interpolated');
  assert.equal(seen(trail, 0.2, 0.5), 0, 'Before the trail starts the cursor has not moved');
  assert.equal(seen(trail, 2.4, 0.2), 1, 'At rest the view catches up');
  assert.equal(seen([[3, 0.4]], 5, 0.2), 0.4);
  const sim = lab('sim-bci-latency-trace'),
    html = markup(sim, sim.instrument, false);
  assert.deepEqual(plain(sim.instrument.hand), { speed: 1, zone: 0.1 });
  assert.ok(html.includes('data-bench-hand') && html.includes('data-hand-move="1"'));
  assert.equal(live.filter(item => markup(item, item.instrument, true).includes('data-bench-hand')).length, 1);
  assert.equal(valid({ ...sim.instrument, hand: { speed: 0, zone: 0.1 } }, sim), false);
  assert.equal(valid({ ...sim.instrument, hand: { speed: 1 } }, sim), false);
}

/* ---------- Tasks: not already met, and reachable with the controls on screen ---------- */
const tool = (sim, full = true) => run('neuroBenchTool')(sim, sim.instrument);
for (const sim of live) {
  const spec = sim.instrument,
    instrument = tool(sim),
    controls = instrument.controls(true);
  const start = {
    ...(instrument.start || {}),
    ...Object.fromEntries(controls.map(control => [control.key, control.value])),
  };
  const met = state => run('neuroBenchMet')(instrument.facts(state, instrument.compute(state)), spec.goal);
  assert.ok(spec.goal, sim.id + ' has a task with a checkable goal');
  assert.equal(met(start), false, sim.id + ' task is not met at the scenario setting');
  const grid = control =>
    control.toggle
      ? [0, 1]
      : Array.from({ length: Math.round((control.max - control.min) / control.step) + 1 }, (_, i) =>
          run('neuroBenchSnap')(control.min + i * control.step, control)
        );
  let reachable = false;
  const walk = (index, state) => {
    if (reachable) return;
    if (index === controls.length) return void (reachable = met(state));
    for (const value of grid(controls[index])) walk(index + 1, { ...state, [controls[index].key]: value });
  };
  walk(0, start);
  assert.ok(reachable, sim.id + ' task can be done with the controls shown');
  for (const control of controls.filter(item => !item.toggle)) {
    assert.ok(grid(control).includes(control.value), `${sim.id} ${control.key} starts on a step`);
    assert.ok(typeof control.text(control.value) === 'string' && control.label);
  }
}

/* ---------- Markup: both modes, nothing leaked before the first answer ---------- */
for (const sim of live) {
  for (const full of [false, true]) {
    run('for (const key of Object.keys(NEURO_BENCH_STATE)) delete NEURO_BENCH_STATE[key]');
    const html = markup(sim, sim.instrument, full);
    assert.match(html, /^<figure class="neuro-series nx-live" data-bench="/, sim.id);
    assert.ok(!/NaN|Infinity|undefined|\[object/.test(html), sim.id + ' markup is clean');
    assert.match(html, /<svg viewBox="0 0 560 276" role="img" aria-label="/);
    assert.match(html, /scope="col"/);
    assert.equal(html.includes('data-bench-mode="full"'), full);
    assert.equal(html.includes('<b>Try this</b>'), full, sim.id + ' task appears after the answer');
    assert.equal(html.includes('<b>Explore</b>'), !full);
    assert.match(html, /<p class="nx-live-won" data-bench-won hidden><\/p>/, sim.id + ' is not done on arrival');
    assert.equal(
      (html.match(/type="range"/g) || []).length,
      tool(sim)
        .controls(full)
        .filter(item => !item.toggle).length
    );
    for (const id of html.matchAll(/ for="([^"]+)"/g))
      assert.ok(html.includes(` id="${id[1]}"`), 'label target ' + id[1]);
  }
}
{
  run('for (const key of Object.keys(NEURO_BENCH_STATE)) delete NEURO_BENCH_STATE[key]');
  const decoder = lab('sim-dec-score-boundary'),
    before = markup(decoder, decoder.instrument, false),
    after = markup(decoder, decoder.instrument, true);
  assert.ok(
    !/Labeled correctly|Labeled wrongly|nx-live-miss|Decoded<\/th>/.test(before),
    'No verdict before the answer'
  );
  assert.ok(
    /Labeled correctly<\/dt><dd>5 of 6/.test(after) && after.includes('3 s [12, 11]') && after.includes('nx-live-miss')
  );
  const speed = lab('sim-bci-speed-limit'),
    hidden = markup(speed, speed.instrument, false),
    shown = markup(speed, speed.instrument, true);
  assert.ok(!/speed limit clipped|Updates the limit clipped|nx-live-clip|Clipped<\/th>/.test(hidden));
  assert.ok(/Updates the limit clipped<\/dt><dd>4 of 15/.test(shown) && shown.includes('nx-live-clip'));
  const cost = lab('sim-cl-confirm-cost'),
    excerpt = markup(cost, cost.instrument, false),
    priced = markup(cost, cost.instrument, true);
  assert.ok(!/nx-live-costs|falseCost|missCost/.test(excerpt), 'The cost table would give the answer away');
  assert.ok(
    /<li class="is-low"><b>B<\/b><span>4 false, 1 missed<\/span>.*<strong>12<\/strong><em>lowest<\/em>/.test(priced)
  );
  assert.equal((priced.match(/class="is-low"/g) || []).length, 1);
}

/* ---------- Malformed instruments render nothing, so the lab keeps its static plot ---------- */
{
  const sim = lab('sim-cl-false-positive');
  const broken = [
    null,
    {},
    { ...sim.instrument, kind: 'pie' },
    { ...sim.instrument, gate: 'never' },
    { ...sim.instrument, threshold: { ...sim.instrument.threshold, step: 0 } },
    { ...sim.instrument, threshold: { ...sim.instrument.threshold, value: 99 } },
    { ...sim.instrument, event: { start: 7, end: 40, label: 'Labeled event' } },
    { ...sim.instrument, explore: '' },
    { ...sim.instrument, goal: [['inside', '~', 1]] },
    { ...sim.instrument, done: '' },
  ];
  for (const spec of broken) {
    assert.equal(valid(spec, sim), false);
    assert.equal(markup(sim, spec, true), '');
  }
  assert.equal(valid(sim.instrument, { ...sim, series: null }), false);
  assert.equal(valid(sim.instrument, { ...sim, series: { ...sim.series, values: [1, NaN] } }), false);
  const decoder = lab('sim-dec-score-boundary');
  assert.equal(
    valid({ ...decoder.instrument, weights: [-1, 0] }, decoder),
    false,
    'A vertical boundary cannot be drawn'
  );
  assert.equal(valid({ ...decoder.instrument, trials: [[1, 2, 3]] }, decoder), false);
  const cursor = lab('sim-bci-latency-trace');
  assert.equal(valid({ ...cursor.instrument, steps: 4000 }, cursor), false);
  assert.equal(valid({ ...cursor.instrument, readouts: ['velocity'] }, cursor), false);
}

/* ---------- Screen: controls, presets, reset, task, and neuro.js wiring ---------- */
function screen(path, seed, manualFrames) {
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', {
    url: 'http://localhost' + path,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window,
    errors = [];
  if (seed) w.localStorage.setItem('cs-neuro', JSON.stringify(seed));
  w.addEventListener('error', event => errors.push(event.error || event.message));
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  const queue = [];
  let frameTime = 0;
  if (manualFrames) w.requestAnimationFrame = callback => queue.push(callback);
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
  const find = selector => w.document.querySelector(selector);
  return {
    w,
    find,
    errors,
    all: selector => [...w.document.querySelectorAll(selector)],
    open: () => w.renderNeuroEngineering({ fromUrl: true }),
    slide(key, value) {
      const input = find(`[data-bench-control="${key}"]`);
      assert.ok(input, 'control ' + key);
      input.value = String(value);
      input.dispatchEvent(new w.Event('input', { bubbles: true }));
    },
    reading(label) {
      const item = [...w.document.querySelectorAll('[data-bench-read] > div')].find(
        node => node.querySelector('dt').textContent === label
      );
      return item ? item.querySelector('dd').textContent : null;
    },
    saved: () => JSON.parse(w.localStorage.getItem('cs-neuro')),
    pending: () => queue.length,
    frames(count, gap = 16) {
      for (let i = 0; i < count; i++) {
        frameTime += gap;
        for (const callback of queue.splice(0)) callback(frameTime);
      }
    },
  };
}
const answer = (page, index) => page.find(`[data-sim-choice="${index}"]`).click();

(async () => {
  // Standalone lab: explore, answer, then the task.
  const page = screen('/neuro?sim=sim-cl-false-positive');
  await page.open();
  assert.equal(page.find('[data-bench]').dataset.benchMode, 'explore');
  assert.ok(page.find('.nx-lab-brief.has-plot .nx-lab-plot > figure.nx-live'));
  assert.equal(page.reading('Outside it'), '3');
  assert.equal(page.find('[data-bench-reset]').disabled, true);
  page.slide('threshold', 6);
  assert.equal(page.reading('Outside it'), '0');
  assert.equal(page.reading('Inside the labeled event'), '2 of 2');
  assert.equal(page.find('[data-bench-out="threshold"]').textContent, '6 detector units');
  assert.equal(page.find('[data-bench-control="threshold"]').getAttribute('aria-valuetext'), '6 detector units');
  assert.equal(page.all('[data-bench-plot] svg').length, 1, 'The plot is replaced, not stacked');
  assert.equal(page.all('[data-bench-plot] .neuro-series-marker').length, 1, 'One episode starts at threshold 6');
  assert.match(page.find('[data-bench-table]').textContent, /9\.6yes, episode starts/);
  assert.equal(page.find('[data-bench-reset]').disabled, false);
  assert.equal(
    page.find('[data-bench-task]').textContent,
    'ExploreDrag the threshold or use the slider. Watch which windows trigger and where they fall.'
  );
  const sim = lab('sim-cl-false-positive');
  answer(page, sim.bestAnswerIndex);
  assert.equal(page.find('[data-bench]').dataset.benchMode, 'full', 'The instrument opens fully after the answer');
  assert.equal(page.find('[data-bench-control="threshold"]').value, '6', 'Settings survive the redraw');
  assert.ok(page.find('[data-bench-task]').classList.contains('is-done'), 'A setting found while exploring counts');
  assert.equal(
    page.find('[data-bench-task]').textContent,
    'DoneFind a threshold that triggers inside the labeled event and nowhere else.'
  );
  assert.equal(page.find('[data-bench-won]').hidden, false);
  assert.match(page.find('[data-bench-won]').textContent, /^In this excerpt any threshold from 5\.5 to 9\.6 does it\./);
  page.find('[data-bench-reset]').click();
  assert.equal(page.find('[data-bench-control="threshold"]').value, '5');
  assert.equal(page.reading('Outside it'), '3');
  assert.equal(page.find('[data-bench-reset]').disabled, true);
  assert.equal(
    page.w.document.activeElement,
    page.find('[data-bench-control="threshold"]'),
    'Focus moves off the disabled button'
  );
  assert.ok(page.find('[data-bench-task]').classList.contains('is-done'), 'A finished task stays finished');
  assert.equal(page.saved().simWork['sim-cl-false-positive'].content.instrument.kind, 'detector');
  assert.equal(JSON.stringify(page.saved()).includes('"threshold":6'), false, 'Instrument settings are never saved');
  assert.deepEqual(page.errors, []);

  // Presets, a second control, and the cost table that appears with the answer.
  const cost = screen('/neuro?sim=sim-cl-confirm-cost');
  await cost.open();
  const pressed = () => cost.all('[data-bench-preset]').map(button => button.getAttribute('aria-pressed'));
  assert.deepEqual(pressed(), ['true', 'false', 'false']);
  assert.equal(cost.reading('Single-window artifact'), 'Acted on');
  cost.all('[data-bench-preset]')[1].click();
  assert.deepEqual(pressed(), ['false', 'true', 'false']);
  assert.equal(cost.find('[data-bench-control="confirm"]').value, '3');
  assert.equal(cost.reading('Single-window artifact'), 'Ignored');
  assert.equal(cost.reading('Sustained event'), 'Acted on 200 ms after it starts');
  cost.all('[data-bench-preset]')[2].click();
  assert.equal(cost.reading('Single-window artifact'), 'Acted on');
  assert.equal(cost.reading('Actions in this excerpt'), '2');
  cost.slide('threshold', 10);
  assert.equal(cost.reading('Sustained event'), 'Missed');
  assert.deepEqual(pressed(), ['false', 'false', 'false']);
  assert.equal(cost.find('.nx-live-costs'), null);
  answer(cost, lab('sim-cl-confirm-cost').bestAnswerIndex);
  assert.equal(cost.all('.nx-live-costs li').length, 3);
  assert.equal(cost.find('.nx-live-costs li.is-low b').textContent, 'B');
  assert.ok(!cost.find('[data-bench-task]').classList.contains('is-done'));
  assert.equal(cost.find('[data-bench-won]').hidden, true);
  cost.slide('missCost', 26);
  assert.equal(cost.all('.nx-live-costs li.is-low').length, 2, 'A tie is shown as a tie');
  assert.ok(!cost.find('[data-bench-task]').classList.contains('is-done'));
  cost.slide('missCost', 27);
  assert.equal(cost.find('.nx-live-costs li.is-low b').textContent, 'A');
  assert.ok(cost.find('[data-bench-task]').classList.contains('is-done'));
  assert.match(
    cost.find('[data-bench-won]').textContent,
    /^A wins once one missed event costs more than 26 false actions\./
  );
  const order = [...cost.find('[data-bench]').children].map(node => node.className.split(' ')[0] || node.tagName);
  assert.ok(
    order.indexOf('nx-live-task') < order.indexOf('nx-live-stage') &&
      order.indexOf('nx-live-won') > order.indexOf('nx-live-read'),
    'The task sits above the plot and its result below the controls, so nothing moves under a dragging pointer: ' +
      order
  );
  assert.deepEqual(cost.errors, []);

  // The decoder shows its verdict only after the answer.
  const decoder = screen('/neuro?sim=sim-dec-score-boundary');
  await decoder.open();
  assert.equal(decoder.reading('Labeled correctly'), null);
  decoder.slide('bias', 1.5);
  assert.equal(decoder.reading('Scores, trials 0 s to 5 s'), '8.5, -6.5, 5.5, 0.5, -7.5, 1.5');
  answer(decoder, 0);
  assert.equal(decoder.reading('Labeled correctly'), '5 of 6');
  assert.equal(decoder.reading('Labeled wrongly'), '5 s [10, 10]');
  assert.ok(decoder.find('[data-bench-task]').classList.contains('is-done'));
  assert.deepEqual(decoder.errors, []);

  // Work saved before this release has no instrument in its snapshot. It borrows the current one
  // while the saved lab still describes the same signal, and keeps its static plot otherwise.
  const old = plain(lab('sim-bci-latency-trace'));
  delete old.instrument;
  const record = content => ({
    pathDone: [],
    simWork: { [content.id]: { content, answers: {}, debrief: '', startedAt: 1 } },
  });
  const kept = screen('/neuro?sim=sim-bci-latency-trace', record(old));
  await kept.open();
  assert.ok(kept.find('[data-bench]'), 'An unchanged older snapshot gets the instrument');
  assert.equal(kept.reading('Highest position'), '1.75');
  kept.slide('delay', 0);
  assert.equal(kept.reading('Past the target by'), 'nothing');
  assert.equal(kept.saved().simWork[old.id].content.instrument, undefined, 'The saved snapshot is not rewritten');
  const edited = { ...old, series: { ...old.series, values: old.series.values.map(value => value + 1) } };
  const stale = screen('/neuro?sim=sim-bci-latency-trace', record(edited));
  await stale.open();
  assert.equal(stale.find('[data-bench]'), null, 'A snapshot with a different signal keeps its static plot');
  assert.ok(stale.find('.nx-lab-plot > figure.neuro-series svg'));
  assert.deepEqual([...kept.errors, ...stale.errors], []);

  // In a unit, an instrument gated "after" waits for the first answer.
  const unitStep = steps.find(step => data.unitLessons[String(step.order)]?.simulation?.id === 'unit-smoothing-peak');
  const unit = data.unitLessons[String(unitStep.order)];
  const content = {
    step: unitStep,
    unit,
    topic: data.topics.find(topic => topic.id === unitStep.topicId) || null,
    checks: unit.checks || [],
    code: null,
    sim: unit.simulation,
  };
  const stages = ['lesson', 'recall', ...(content.checks.length ? ['quiz'] : []), 'sim', 'debrief'];
  const gated = screen('/neuro?unit=' + unitStep.id, {
    units: {
      [unitStep.id]: {
        layout: 2,
        content,
        stageIdx: stages.indexOf('sim'),
        recallIdx: (unit.activeRecallPrompts || []).length,
        recall: [],
        answers: {},
        debrief: '',
        startedAt: 1,
      },
    },
    pathStarted: true,
    pathDone: [],
  });
  await gated.open();
  assert.equal(
    gated.find('#neunitlab').textContent,
    `Stage ${stages.indexOf('sim') + 1} / ${stages.length} · NeuroSim`
  );
  assert.equal(gated.find('[data-bench]'), null, 'Closed until the first answer');
  assert.ok(gated.find('.nx-lab-plot > figure.neuro-series svg'), 'The static plot shows meanwhile');
  assert.match(gated.find('.nx-live-soon').textContent, /^Answer first\./);
  gated.find(`[data-choice="${unit.simulation.bestAnswerIndex}"]`).click();
  assert.equal(gated.find('[data-bench]').dataset.benchMode, 'full');
  assert.equal(gated.find('.nx-live-soon'), null);
  assert.equal(gated.reading('Output'), '[3, 3, 3]');
  gated.slide('width', 5);
  assert.equal(gated.reading('Output'), '[1.8]');
  assert.ok(gated.find('[data-bench-task]').classList.contains('is-done'));
  const pad = gated.find('[data-bench-control="pad"]');
  pad.checked = true;
  pad.dispatchEvent(new gated.w.Event('input', { bubbles: true }));
  assert.equal(gated.reading('Output'), '[1.8, 1.8, 1.8, 1.8, 1.8]');
  gated.slide('width', 3);
  assert.equal(gated.reading('Output'), '[0, 3, 3, 3, 0]');
  assert.deepEqual(gated.errors, []);

  // Steering by hand, with animation frames driven by the test so the timing is exact:
  // hold for 15 frames of 16 ms at 1 unit/s, let go, and the cursor has moved 0.24.
  const hand = screen('/neuro?sim=sim-bci-latency-trace', null, true);
  await hand.open();
  const status = () => hand.find('[data-hand-say]').textContent;
  const dotAt = () => Number.parseFloat(hand.find('[data-hand-dot]').style.left);
  const shown = position => ((position + 0.25) / 2) * 100;
  const key = (type, name) =>
    hand.find('[data-hand-move="1"]').dispatchEvent(new hand.w.KeyboardEvent(type, { key: name, bubbles: true }));
  assert.equal(hand.find('[data-hand-lag]').textContent, 'Your view of it is 0.2 s old.');
  assert.equal(status(), 'The dot is at 0.');
  key('keydown', 'ArrowRight');
  key('keydown', 'ArrowRight');
  assert.equal(status(), 'Moving. Let go to stop.');
  hand.frames(16);
  key('keyup', 'ArrowRight');
  assert.ok(Math.abs(dotAt() - shown(0.04)) < 0.2, 'While moving, the dot shows the position 0.2 s ago: ' + dotAt());
  hand.frames(8);
  assert.ok(
    dotAt() > shown(0.04) && dotAt() < shown(0.24),
    'After release the dot keeps moving: the view is catching up'
  );
  hand.frames(12);
  assert.equal(status(), 'Stopped at 0.24: 0.76 short of the target. Moves so far: 1.');
  assert.ok(Math.abs(dotAt() - shown(0.24)) < 0.1, 'At rest the dot sits where the cursor stopped');
  assert.equal(hand.pending(), 0, 'No frames are requested while the cursor rests');
  // A second move, by the button and the space bar, with a live view: no catching up.
  hand.slide('delay', 0);
  assert.equal(hand.find('[data-hand-lag]').textContent, 'Your view of it is live.');
  key('keydown', ' ');
  hand.frames(51);
  key('keyup', ' ');
  hand.frames(1);
  assert.equal(status(), 'Stopped at 1.04: inside the target. Moves so far: 2.');
  assert.ok(hand.find('[data-bench-hand]').classList.contains('is-in'));
  // A long gap between frames means the page was in the background. The cursor stops by itself.
  key('keydown', 'ArrowRight');
  hand.frames(2);
  hand.frames(1, 2000);
  hand.frames(2);
  assert.match(status(), /^Stopped at 1\.0[5-9]: inside the target\. Moves so far: 3\.$/);
  hand.find('[data-hand-reset]').click();
  assert.equal(status(), 'The dot is at 0.');
  assert.equal(hand.find('[data-hand-dot]').style.left, '12.5%');
  assert.ok(!hand.find('[data-bench-hand]').classList.contains('is-in'));
  assert.deepEqual(hand.errors, []);

  // A finished task is announced once, with the next pause, for readers who cannot see the strip.
  const spoken = screen('/neuro?sim=sim-bci-abstain-hold');
  await spoken.open();
  answer(spoken, lab('sim-bci-abstain-hold').bestAnswerIndex);
  spoken.slide('margin', 0.2);
  spoken.slide('margin', 0);
  assert.equal(spoken.find('[data-bench-say]').textContent, '', 'Nothing is announced mid-drag');
  await new Promise(resolve => setTimeout(resolve, 750));
  assert.equal(
    spoken.find('[data-bench-say]').textContent,
    'Abstain margin within 0 of the threshold. Windows acted on: 11 of 12. Windows held: 1. Longest hold: 0.25 s. Direction changes: 4. Task done. ' +
      lab('sim-bci-abstain-hold').instrument.done
  );
  spoken.slide('margin', 0.1);
  await new Promise(resolve => setTimeout(resolve, 750));
  assert.ok(!spoken.find('[data-bench-say]').textContent.includes('Task done'), 'The result is announced once');
  assert.deepEqual(spoken.errors, []);

  // The instrument is an extra: if it fails to draw or to wire up, the lab opens with its static plot.
  for (const broken of ['neuroBenchMarkup', 'neuroBenchMount']) {
    const failing = screen('/neuro?sim=sim-cl-false-positive');
    failing.w[broken] = () => {
      throw new Error('instrument failure');
    };
    await failing.open();
    assert.equal(failing.find('[data-bench]'), null, broken + ' failure leaves no dead controls');
    assert.ok(
      failing.find('.nx-lab-plot > figure.neuro-series svg'),
      broken + ' failure falls back to the static plot'
    );
    assert.equal(failing.all('[data-sim-choice]').length, 4, 'The lab itself still works');
    answer(failing, lab('sim-cl-false-positive').bestAnswerIndex);
    assert.ok(failing.find('#sim-debrief'));
    assert.deepEqual(failing.errors, []);
  }

  // The loader lists the instruments before neuro.js, which calls into them.
  const app = fs.readFileSync('app.js', 'utf8');
  assert.match(app, /'neuro-instruments\.js\?v=\d+',\s*'neuro\.js\?v=\d+',/);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
