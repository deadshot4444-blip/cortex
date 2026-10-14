// Notebook UI (lab-notebook.js) against the engine (silver-lab-core.js) and the shipped
// data/lab/*.json. Designer: two screens ([data-labn-wizard-step="1".."2"], Plan and Predict and
// reveal; SIMPLE-notebook) whose reveal gate
// stays closed until predictions, a control, measures and two performed runs exist; the engine's
// reasons are kept verbatim in data-labn-reason and shown as plain "things left" links; the reveal
// locks the pre-registered fields and shows a locked summary, badged outcome cards with a plain
// summary, and the interpretation, which drives status 'done'. Report: sections in rubric order,
// colored entry labels (the bracket tags stay in the export only), a derived "From your lab work" list
// that never writes into notebook.entries, one "Add to my report" menu, one Export button with Copy
// and Print under More, a free-text Notes pad through the shell's getNotepad / setNotepad that the
// export appends as "## Notes". exportMarkdown stays a thin wrapper over lab.exportNotebook, the print view
// escapes markup, and focus is never dropped to <body>.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const S = require('../silver-lab-core.js');

const ROOT = path.join(__dirname, '..');
const FILES = ['sources', 'claims', 'rules', 'methods', 'specimens', 'safety', 'modules', 'assets'];
const content = Object.fromEntries(
  FILES.map(f => [f, JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'lab', `${f}.json`), 'utf8'))])
);
const lab = S.createLab(content);
const SOURCE = fs.readFileSync(path.join(ROOT, 'lab-notebook.js'), 'utf8');

// Runs built exactly as scripts/test-lab-core.cjs test 11 builds them.
let seqCounter = 0;
const stepEvent = (stepId, params) => ({
  seq: ++seqCounter,
  type: 'step',
  step: stepId,
  ...(params ? { params } : {}),
});
function perform(run, steps = S.STEPS, overrides = {}) {
  seqCounter = 0;
  return steps.reduce((r, s) => lab.applyEvent(r, stepEvent(s, overrides[s])), run);
}
const fullRun = (id, specimenId, params, method = 'bielschowsky-modified', overrides = {}) =>
  perform(lab.createRun({ id, specimenId, method, params }), S.STEPS, overrides);

function freshState() {
  return {
    v: 1,
    mode: 'list',
    safetyAcknowledgedAt: null,
    activeSpecimenId: 'SPEC-SYN-AD-01',
    runs: {
      base: fullRun('base', 'SPEC-SYN-AD-01'),
      ext: fullRun('ext', 'SPEC-SYN-AD-01', { development: { endpoint: 'extended' } }),
    },
    runOrder: ['base', 'ext'],
    experiments: {},
    experimentOrder: [],
    notebook: lab.newNotebook(),
    measurements: {},
    measurementOrder: [],
    moduleProgress: {},
    counters: { run: 2, exp: 0, entry: 0, measurement: 0 },
    settings: { reducedMotion: 'auto', highContrast: false, objective: 10 },
  };
}

function harness(view = 'designer') {
  const dom = new JSDOM('<!doctype html><div id="app"></div>', {
    url: `http://localhost/lab?view=${view}`,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.SilverLab = S;
  w.LAB_FLAGS = { activities: true, designer: true, report: true }; // BENCH-1: these pages are off by default
  w.print = () => {};
  w.confirm = () => true;
  vm.runInContext(SOURCE, dom.getInternalVMContext());
  const app = w.document.querySelector('#app');
  const type = (node, value) => {
    node.value = value;
    node.dispatchEvent(new w.Event('input', { bubbles: true }));
    node.dispatchEvent(new w.Event('change', { bubbles: true }));
  };
  // A real click on a checkbox toggles it and fires input then change; both handlers must be idempotent.
  const check = (node, checked = true) => {
    node.checked = checked;
    node.dispatchEvent(new w.Event('input', { bubbles: true }));
    node.dispatchEvent(new w.Event('change', { bubbles: true }));
  };
  const wait = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));
  return { w, app, type, check, wait, close: () => w.close() };
}

const field = (root, name) => root.querySelector(`[data-labn-field="${name}"]`);
const texts = nodes => Array.from(nodes).map(n => n.textContent.trim());
// Objects made inside the jsdom vm context carry another Object.prototype; compare plain copies.
const plain = x => JSON.parse(JSON.stringify(x));
const step = (app, n) => app.querySelector(`[data-labn-wizard-step="${n}"]`);
const shownStep = app =>
  Array.from(app.querySelectorAll('[data-labn-wizard-step]'))
    .filter(s => !s.hidden)
    .map(s => Number(s.getAttribute('data-labn-wizard-step')));
const reasonAttrs = app =>
  Array.from(app.querySelectorAll('.labn-reasons li')).map(li => li.getAttribute('data-labn-reason'));
// Text a sighted reader sees: skips [hidden] subtrees, visually hidden spans and form control values.
function visibleText(node) {
  if (node.nodeType === 3) return node.textContent;
  if (node.nodeType !== 1) return '';
  if (node.hidden || node.classList.contains('labn-sr-only') || node.classList.contains('lab-sr-only')) return '';
  if (['SCRIPT', 'STYLE', 'TEMPLATE', 'DATALIST', 'OPTION'].includes(node.tagName)) return '';
  return Array.from(node.childNodes).map(visibleText).join(' ');
}
const ENGINE_WORDS =
  /\b(SPEC-|R-model|C-[a-z]|S-[a-z]|sop-default|SOP defaults|step-skipped|param-uncovered|illustrative-synthetic|no-basis|schematic ordinal|independentVariable|baselineRunId|predictions\.)/;
// The prompts of the designer are written by the student to the engine's experiment schema; build
// one complete draft (used by several tests).
function completeExperiment(id = 'exp-3') {
  return {
    id,
    status: 'draft',
    title: 't',
    background: 'b',
    question: 'q',
    hypothesis: 'h',
    alternative: 'a',
    independentVariable: 'development.endpoint',
    measures: ['contrast-ordinal'],
    heldComparable: ['specimenId'],
    changed: ['development.endpoint'],
    controls: [{ type: 'negative-biological', addresses: 'x' }],
    predictions: { expected: 'e', negligible: 'n', opposite: 'o' },
    limitations: 'l',
    baselineRunId: 'base',
    experimentalRunId: 'ext',
  };
}

// lab.js's change list (this round's shared API): CortexLab.changeOptions() lists the bench's "What do you
// want to change?" options in its order and words; matchChange(text) matches "<option>: <value>" or the
// option alone (its one change, else value null), letter case and spacing aside, never a guess (the
// rule of lab.js labMatchChange).
const CHANGE_OPTIONS = [
  { id: 'standard', label: 'Nothing (standard, per procedure)', values: [] },
  {
    id: 'impregnation-time',
    label: 'Impregnation time',
    values: [
      { value: 'early', label: 'shorter' },
      { value: 'sop-default', label: 'standard' },
      { value: 'extended', label: 'longer' },
    ],
  },
  {
    id: 'development-time',
    label: 'Development time',
    values: [
      { value: 'early', label: 'shorter' },
      { value: 'sop-default', label: 'standard' },
      { value: 'extended', label: 'longer' },
    ],
  },
  {
    id: 'developer-strength',
    label: 'Developer strength',
    values: [
      { value: 'weak', label: 'weaker' },
      { value: 'sop-default', label: 'standard' },
      { value: 'strong', label: 'stronger' },
    ],
  },
  {
    id: 'washes',
    label: 'Washes',
    values: [
      { value: 'sop-default', label: 'standard' },
      { value: 'deviated', label: 'changed (not modeled)' },
    ],
  },
  {
    id: 'toning-thiosulfate',
    label: 'Toning and thiosulfate',
    values: [
      { value: 'none', label: 'both done (standard)' },
      { value: 'toning', label: 'skip gold toning' },
      { value: 'thiosulfate', label: 'skip thiosulfate' },
    ],
  },
];
function changeShell(extra = {}) {
  const key = t =>
    String(t ?? '')
      .replace(/\s+/g, ' ')
      .replace(/\s*:\s*/g, ': ')
      .trim()
      .toLowerCase();
  return {
    words: {},
    changeOptions: () => JSON.parse(JSON.stringify(CHANGE_OPTIONS)),
    matchChange: text => {
      const k = key(text);
      if (!k) return null;
      for (const o of CHANGE_OPTIONS) {
        const name = key(o.label);
        if (k === name) {
          const changes = o.values.filter(v => !['sop-default', 'none'].includes(v.value));
          return { id: o.id, value: changes.length === 1 ? changes[0].value : null };
        }
        for (const v of o.values) if (k === `${name}: ${key(v.label)}`) return { id: o.id, value: v.value };
      }
      return null;
    },
    ...extra,
  };
}

test('the designer is two screens: every Experiment field labeled, plain options, Back / Next', () => {
  const { w, app, check, close } = harness();
  const state = freshState();
  const saved = [];
  const handle = w.CortexLabNotebook.mountDesigner(app, {
    lab,
    state,
    experimentId: 'exp-1',
    onSave: exp => saved.push(exp),
    onRequestRuns() {},
    onReveal() {},
  });
  assert.equal(app.querySelectorAll('[data-labn-wizard-step]').length, 2);
  assert.deepEqual(shownStep(app), [1], 'a draft opens on step 1');
  assert.match(step(app, 1).querySelector('h2').textContent, /^Step 1 of 2\s+Plan your experiment$/);
  for (const [n, names] of [
    [
      1,
      [
        'title',
        'background',
        'question',
        'hypothesis',
        'alternative',
        'independentVariable',
        'baselineRunId',
        'experimentalRunId',
      ],
    ],
    [2, ['predictions.expected', 'predictions.negligible', 'predictions.opposite', 'limitations']],
  ])
    for (const name of names)
      assert.ok(step(app, n).querySelector(`[data-labn-field="${name}"]`), `step ${n}: ${name}`);
  for (const name of ['title', 'background', 'question', 'hypothesis', 'alternative'])
    assert.ok(field(app, name).getAttribute('placeholder').startsWith('e.g. '), `${name} has an example`);
  assert.ok(step(app, 1).textContent.includes('The course raises these four explanations; none is established'));
  for (const hid of S.HYPOTHESES) assert.ok(step(app, 1).textContent.includes(S.HYPOTHESIS_TEXT[hid]), hid);
  // Screen 1 also holds the chips, three control checkboxes, measures with a one-line rule, two run selects.
  assert.ok(step(app, 1).querySelector('input[data-labn-chip-input="changed"]'));
  assert.ok(step(app, 1).querySelector('input[data-labn-chip-input="heldComparable"]'));
  const controlBoxes = step(app, 1).querySelectorAll('input[type="checkbox"][data-labn-control-type]');
  assert.deepEqual(
    Array.from(controlBoxes).map(b => b.getAttribute('data-labn-control-type')),
    ['characterized-positive', 'negative-biological', 'baseline-process']
  );
  assert.equal(
    step(app, 1).textContent.split('your report marks each control as a stand-in').length - 1,
    1,
    'the stand-in note appears once'
  );
  assert.ok(step(app, 1).textContent.includes('practice specimen (not real tissue)'));
  const measures = app.querySelectorAll('input[data-labn-field="measures"]');
  assert.equal(measures.length, lab.measurementRules().length);
  for (const rule of lab.measurementRules()) {
    const detail = app.querySelector(`[data-labn-measure-detail="${rule.id}"]`);
    assert.equal(detail.hidden, true, 'the rule waits until the measure is chosen');
    // KB-07: plain words describe the box; the written rule (engine wording) sits under "Full rule".
    const box = app.querySelector(`input[data-labn-field="measures"][value="${rule.id}"]`);
    const described = box.getAttribute('aria-describedby').split(' ');
    const line = box.closest('.labn-check').querySelector('.labn-check-line');
    assert.ok(described.includes(line.id), 'the plain line describes the box');
    assert.ok(described.includes(detail.querySelector('p').id), 'how it is recorded describes the box');
    assert.match(detail.querySelector('p').textContent, /^You agree to this rule before you look\. /);
    const full = detail.querySelector('button.labn-disclose');
    assert.equal(full.textContent, `Full rule: ${rule.title}`, 'the disclosure names its measure');
    const panel = app.querySelector(`#${full.getAttribute('aria-controls')}`);
    assert.equal(panel.hidden, true);
    assert.ok(panel.textContent.includes(rule.rule), `full rule text ${rule.id}`);
  }
  // The plain lines are the microscope Measure sheet's.
  assert.equal(
    app.querySelector('input[value="contrast-ordinal"]').closest('.labn-check').querySelector('.labn-check-line')
      .textContent,
    'Compare the darkest structure with the background.'
  );
  assert.ok(
    app.textContent.includes("Read from the simulated picture; the model's own value is saved in the note."),
    'the derived measurement says where its value comes from'
  );
  // HON-14: the negative comparison need not be blank, as the source says (not "axons still stain").
  assert.ok(
    step(app, 1).textContent.includes('It need not be blank: normal structures such as axons can still stain.')
  );
  check(app.querySelector('input[data-labn-control-type="baseline-process"]'));
  assert.ok(field(app, 'controls.0.addresses'), 'a checked control asks what it rules out');
  assert.equal(app.querySelectorAll('[data-labn-field^="controls."]').length, 1, 'input + change add one control');
  const runOptions = texts(field(app, 'baselineRunId').querySelectorAll('option'));
  assert.ok(
    runOptions.some(t => t.startsWith('Run base') && t.includes('standard (per procedure)')),
    runOptions
  );
  assert.ok(
    runOptions.some(t => t.startsWith('Run ext') && t.includes('Development time: longer')),
    runOptions
  );
  assert.ok(!runOptions.some(t => /SOP defaults|development\.endpoint=|SPEC-/.test(t)), runOptions);
  // UX-LAST: without lab.js's change list there is no "Make the runs for me" (it would have to guess).
  assert.equal(app.querySelector('[data-labn-action="request-runs"]'), null);
  // Every form control has an accessible name; required is said in text.
  for (const control of app.querySelectorAll('input, textarea, select')) {
    const labelled =
      (control.id && app.querySelector(`label[for="${control.id}"]`)) ||
      control.getAttribute('aria-label') ||
      control.closest('label');
    assert.ok(labelled, `unlabeled control ${control.outerHTML.slice(0, 80)}`);
  }
  // SIMPLE-notebook: required and optional are both said in text; the five optional fields carry no "required".
  assert.ok(app.querySelectorAll('.labn-req:not(.labn-opt)').length >= 10, 'required markers are text');
  assert.deepEqual(
    Array.from(app.querySelectorAll('.labn-opt')).map(n => n.closest('label').textContent.replace(/\s*optional$/, '')),
    ['Title', 'Background', 'Another explanation', 'What you keep the same', 'Limits of your design']
  );
  assert.equal(app.querySelector('[data-labn-status]').textContent, 'Status: Draft');
  // Back / Next move one step, focus the step heading and keep the progress list in sync.
  const next = app.querySelector('[data-labn-action="wizard-next"]'),
    back = app.querySelector('[data-labn-action="wizard-back"]');
  assert.equal(back.hidden, true);
  assert.equal(next.textContent, 'Next: Predict and reveal');
  next.click();
  assert.deepEqual(shownStep(app), [2]);
  assert.equal(w.document.activeElement, step(app, 2).querySelector('h2'));
  assert.equal(app.querySelector('[data-labn-progress="2"] button').getAttribute('aria-current'), 'step');
  assert.equal(app.querySelector('[data-labn-progress="1"] button').hasAttribute('aria-current'), false);
  assert.equal(back.textContent, 'Back: Plan');
  assert.equal(next.hidden, true, 'no Next on the last step');
  assert.match(step(app, 2).querySelector('h2').textContent, /^Step 2 of 2\s+Predict, then reveal$/);
  back.click();
  assert.deepEqual(shownStep(app), [1]);
  assert.equal(handle.getExperiment().id, 'exp-1');
  handle.destroy();
  assert.equal(app.childElementCount, 0);
  assert.equal(saved.length, 1, 'destroy flushes the pending save from adding a control');
  assert.deepEqual(plain(saved[0].controls), [{ type: 'baseline-process', addresses: '' }]);
  close();
});

test('step 1 and the run options show no engine identifier; the first change becomes the main variable', () => {
  const { w, app, type, close } = harness();
  const state = freshState();
  w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-1', onSave() {} });
  const seen = visibleText(app);
  assert.doesNotMatch(seen, ENGINE_WORDS, seen.match(ENGINE_WORDS)?.[0]);
  const chip = app.querySelector('input[data-labn-chip-input="changed"]');
  type(chip, 'Development time');
  chip.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  assert.equal(field(app, 'independentVariable').value, 'Development time');
  type(app.querySelector('input[data-labn-chip-input="changed"]'), 'Developer strength');
  app.querySelector('[data-labn-action="chip-add"][data-labn-list="changed"]').click();
  assert.equal(field(app, 'independentVariable').value, 'Development time', 'only the first change fills it');
  app.querySelector('[data-labn-action="chip-remove"][data-labn-list="changed"][data-labn-index="0"]').click();
  assert.equal(field(app, 'independentVariable').value, 'Developer strength', 'it follows the removed chip');
  close();
});

test('the reveal gate lists the engine reasons as "things left" links until the design and runs are complete, then reveals', async () => {
  const { w, app, type, check, wait, close } = harness();
  const state = freshState();
  const saved = [],
    revealed = [];
  w.CortexLabNotebook.mountDesigner(app, {
    lab,
    state,
    experimentId: 'exp-1',
    onSave: exp => {
      saved.push(exp);
      state.experiments[exp.id] = exp;
      return true;
    },
    onReveal: exp => {
      revealed.push(exp);
      return undefined; // the shell leaves the reveal to the module
    },
  });
  const gateButton = () => app.querySelector('[data-labn-action="reveal"]');
  const noCards = () => assert.equal(app.querySelectorAll('.labn-card').length, 0, 'no outcome before the gate');

  assert.equal(gateButton().disabled, true);
  const initial = lab.canReveal({ id: 'exp-1' }, state.runs).reasons;
  assert.deepEqual(reasonAttrs(app), initial, 'the engine reasons, verbatim and in order');
  assert.equal(app.querySelector('.labn-left-h').textContent, `${initial.length} things left before you can reveal:`);
  assert.deepEqual(texts(app.querySelectorAll('.labn-reasons a[data-labn-jump]')), [
    'Expected outcome',
    'Negligible change',
    'Opposite outcome',
    'A control',
    'Main variable',
    'An outcome measure',
    'Baseline run',
    'Experimental run',
  ]);
  assert.doesNotMatch(visibleText(app.querySelector('.labn-reasons')), ENGINE_WORDS);
  assert.equal(app.querySelectorAll('[data-labn-check]').length, 0, 'no separate Missing panel');
  noCards();

  // A link opens the field's step and focuses the field.
  app.querySelector('.labn-reasons a[data-labn-jump="predictions.negligible"]').click();
  assert.deepEqual(shownStep(app), [2]);
  assert.equal(w.document.activeElement, field(app, 'predictions.negligible'));
  app.querySelector('.labn-reasons a[data-labn-jump="controls"]').click();
  assert.deepEqual(shownStep(app), [1]);
  assert.equal(w.document.activeElement, app.querySelector('input[data-labn-control-type="characterized-positive"]'));

  type(field(app, 'predictions.expected'), 'Darker plaque cores in the simulated field.');
  type(field(app, 'predictions.negligible'), 'No visible change; endpoint not limiting.');
  type(field(app, 'predictions.opposite'), 'Lighter targets; something else dominates.');
  assert.equal(gateButton().disabled, true);
  assert.ok(reasonAttrs(app).includes('no control is specified'), reasonAttrs(app));
  assert.ok(!reasonAttrs(app).some(r => r.startsWith('predictions.')), reasonAttrs(app));
  noCards();

  check(app.querySelector('input[data-labn-control-type="characterized-positive"]'));
  // KB-19: focus stays on the box; its description names the new field, the next tab stop.
  const positive = app.querySelector('input[data-labn-control-type="characterized-positive"]');
  assert.equal(w.document.activeElement, positive, 'checking a control keeps focus on its box');
  const addressLabel = app.querySelector(`label[for="${field(app, 'controls.0.addresses').id}"]`);
  assert.ok(positive.getAttribute('aria-describedby').split(' ').includes(addressLabel.id));
  assert.equal(positive.getAttribute('aria-controls'), field(app, 'controls.0.addresses').id);
  const tabbable = Array.from(step(app, 1).querySelectorAll('input, button, select, textarea, a[href]'));
  assert.equal(tabbable[tabbable.indexOf(positive) + 1], field(app, 'controls.0.addresses'), 'next in tab order');
  type(field(app, 'controls.0.addresses'), 'that the stain worked at all');
  assert.ok(!reasonAttrs(app).includes('no control is specified'));
  assert.equal(gateButton().disabled, true);

  check(app.querySelector('input[data-labn-field="measures"][value="contrast-ordinal"]'));
  assert.equal(
    app.querySelector('[data-labn-measure-detail="contrast-ordinal"]').hidden,
    false,
    'the rule shows once chosen'
  );
  type(field(app, 'independentVariable'), 'development.endpoint');
  assert.equal(gateButton().disabled, true);
  assert.ok(reasonAttrs(app).includes('baselineRunId does not name a run'), reasonAttrs(app));
  noCards();

  type(field(app, 'baselineRunId'), 'base');
  type(field(app, 'experimentalRunId'), 'ext');
  assert.equal(gateButton().disabled, false);
  assert.equal(reasonAttrs(app).length, 0);
  assert.ok(app.querySelector('.labn-reasons').textContent.includes('Ready to reveal'));
  // Fields the reveal does not wait for are still offered as links.
  const also = app.querySelector('[data-labn-also]');
  assert.equal(also.hidden, false);
  // SIMPLE-notebook: the title fills itself in, so it is never asked for; the optional fields are a soft hint.
  assert.equal(also.querySelector('a[data-labn-jump="title"]'), null, also.textContent);
  assert.ok(also.querySelector('a[data-labn-jump="question"]'), also.textContent);
  assert.ok(also.querySelector('a[data-labn-jump="background"]'), also.textContent);
  assert.match(app.querySelector('[data-labn-step-check="1"]').textContent, /^Still empty: Question, Hypothesis/);
  assert.match(
    app.querySelector('[data-labn-step-check="1"]').textContent,
    / Optional, still empty: Background, Another explanation, What you keep the same\.$/
  );
  noCards();
  assert.equal(field(app, 'question').readOnly, false, 'a draft is editable');
  assert.equal(app.querySelector('[data-labn-lock-note]').hidden, true);
  assert.equal(app.querySelector('[data-labn-summary]').hidden, true, 'no locked summary before the reveal');

  app.querySelector('[data-labn-action="wizard-next"]').click(); // the reveal sits on the last screen
  gateButton().click();
  assert.equal(revealed.length, 1);
  assert.equal(revealed[0].experimentalRunId, 'ext');
  const cards = app.querySelectorAll('.labn-card');
  assert.equal(cards.length, 1);
  assert.equal(cards[0].getAttribute('data-labn-label'), 'illustrative-synthetic');
  const badge = cards[0].querySelector('[data-lab-badge]');
  assert.equal(badge.getAttribute('data-lab-badge'), 'simulated');
  assert.equal(badge.getAttribute('data-lab-label'), 'illustrative-synthetic');
  assert.ok(badge.textContent.includes('Simulated · not a measurement'));
  const summary = cards[0].querySelector('[data-labn-plain]').textContent;
  assert.match(summary, /visible silver/);
  // F18: next to the comparison (background up 1 step) the card says how the background moved.
  assert.match(summary, /The background rose to low \(from trace\); contrast is low\./);
  assert.ok(!summary.includes('stays at'), summary);
  assert.match(
    app.querySelector('[data-labn-reveal] .labn-hint').textContent,
    /^Revealed \d{4}-\d{2}-\d{2}\. The model shows one outcome for your experimental run\.$/
  );
  assert.doesNotMatch(summary, /\b(result|data|measured|predicts)\b/);
  assert.equal(cards[0].querySelector('.labn-conditional'), null, 'no "Conditional on" line without a hypothesis');
  // The engine's own text stays, behind Why? and then Sources (UX-R2).
  const why = cards[0].querySelector('[data-labn-why]');
  assert.equal(why.getAttribute('aria-expanded'), 'false');
  assert.ok(cards[0].querySelector('.labn-card-body').textContent.startsWith(S.LABEL_TEXT['illustrative-synthetic']));
  assert.equal(cards[0].querySelector('.labn-card-body').closest('.labn-why').hidden, true);
  assert.equal(cards[0].querySelector('.labn-card-body').closest('.labn-why-sources').hidden, true);
  const compare = app.querySelector('.labn-compare');
  assert.ok(compare.textContent.includes('What differs between the runs: Development time'), compare.textContent);
  assert.equal(compare.querySelector('[data-lab-badge]').getAttribute('data-lab-label'), 'illustrative-synthetic');
  assert.match(compare.querySelector('[data-labn-plain]').textContent, /up 1 step/);
  assert.equal(app.querySelector('[data-labn-status]').textContent, 'Status: Revealed');
  assert.equal(app.querySelectorAll('textarea[data-labn-field^="interpretation."]').length, 3);
  for (const area of app.querySelectorAll('textarea[data-labn-field^="interpretation."]'))
    assert.ok(area.hasAttribute('required') && area.getAttribute('aria-required') === 'true');
  assert.equal(field(app, 'question').readOnly, true, 'the reveal locks the pre-registered fields');
  assert.equal(field(app, 'experimentalRunId').disabled, true);
  assert.equal(app.querySelector('[data-labn-lock-note]').hidden, false);
  // After the reveal: the locked design as a summary, then the cards, then the interpretation.
  const summaryCard = app.querySelector('[data-labn-summary]');
  assert.equal(summaryCard.hidden, false);
  assert.equal(summaryCard.querySelector('h3').textContent, 'Your design (locked)');
  assert.ok(summaryCard.textContent.includes('Darker plaque cores in the simulated field.'));
  assert.ok(summaryCard.textContent.includes('Characterized positive control: rules out that the stain worked at all'));
  const order = Array.from(step(app, 2).querySelectorAll('[data-labn-summary], .labn-card, .labn-interpretation'));
  assert.deepEqual(
    order.map(n => (n.matches('[data-labn-summary]') ? 'summary' : n.matches('.labn-card') ? 'card' : 'interpret')),
    ['summary', 'card', 'interpret']
  );
  assert.equal(app.querySelector('[data-labn-gate]').hidden, true, 'the gate steps aside once the cards show');
  assert.equal(w.document.activeElement, app.querySelector('[data-labn-reveal] h3'), 'focus moves to the cards');
  await wait();
  const last = saved[saved.length - 1];
  assert.equal(last.status, 'revealed');
  assert.ok(typeof last.revealedAt === 'string' && last.revealedAt.length > 0);
  assert.equal(last.interpretation, null, 'CC-4: the reveal stores no empty interpretation');
  assert.equal(last.predictions.expected, 'Darker plaque cores in the simulated field.');
  assert.deepEqual(plain(last.controls), [
    { type: 'characterized-positive', addresses: 'that the stain worked at all' },
  ]);
  close();
});

test('after reveal the three interpretation answers are required for status done', async () => {
  const { w, app, type, wait, close } = harness();
  const state = freshState();
  state.experiments['exp-2'] = revealedExperiment();
  state.experimentOrder = ['exp-2'];
  const saved = [];
  w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-2', onSave: exp => saved.push(exp) });
  // Already revealed: the wizard opens on the last screen and the cards are restored because the gate still passes.
  assert.deepEqual(shownStep(app), [2]);
  assert.equal(app.querySelectorAll('.labn-card').length, 1);
  assert.equal(app.querySelector('[data-labn-status]').textContent, 'Status: Revealed');
  type(field(app, 'interpretation.supports'), 'That development endpoint changes simulated visibility.');
  type(field(app, 'interpretation.failsToEstablish'), 'Which reduction site is involved.');
  assert.equal(app.querySelector('[data-labn-status]').textContent, 'Status: Revealed');
  type(field(app, 'interpretation.next'), 'A negative comparison under the same two endpoints.');
  assert.equal(app.querySelector('[data-labn-status]').textContent, 'Status: Done');
  assert.ok(app.querySelector('[data-labn-progress="2"]').textContent.includes('(done)'));
  await wait();
  assert.equal(saved[saved.length - 1].status, 'done');
  assert.equal(saved[saved.length - 1].interpretation.next, 'A negative comparison under the same two endpoints.');
  // Clearing an answer drops the experiment back to revealed.
  type(field(app, 'interpretation.next'), '');
  assert.equal(app.querySelector('[data-labn-status]').textContent, 'Status: Revealed');
  close();
});

test('a refused reveal from the shell shows its reasons and never a card; a Not modeled card keeps what it would need', () => {
  const { w, app, close } = harness();
  const state = freshState();
  state.experiments['exp-3'] = completeExperiment('exp-3');
  w.CortexLabNotebook.mountDesigner(app, {
    lab,
    state,
    experimentId: 'exp-3',
    onSave() {},
    onReveal: () => ({ ok: false, reasons: ['the shell says not yet'] }),
  });
  const button = app.querySelector('[data-labn-action="reveal"]');
  assert.equal(button.disabled, false);
  button.click();
  assert.equal(app.querySelectorAll('.labn-card').length, 0);
  assert.ok(texts(app.querySelectorAll('.labn-reasons li')).includes('the shell says not yet'));
  assert.equal(app.querySelector('[data-labn-status]').textContent, 'Status: Draft');
  // A Reveal object from the shell is rendered as is (including the hypothesis-unencoded case).
  state.runs.probe = fullRun('probe', 'SPEC-SYN-AD-01', { pretreatment: 'probe-placeholder-1' });
  state.runOrder.push('probe');
  state.experiments['exp-3'].experimentalRunId = 'probe';
  const handle = w.CortexLabNotebook.mountDesigner(app, {
    lab,
    state,
    experimentId: 'exp-3',
    onSave() {},
    onReveal: exp => lab.reveal(exp, state.runs),
  });
  app.querySelectorAll('[data-labn-action="reveal"]')[1].click();
  const cards = app.querySelectorAll('.labn-card');
  assert.equal(cards.length, 1);
  assert.equal(cards[0].getAttribute('data-labn-label'), 'no-basis');
  const badge = cards[0].querySelector('[data-lab-badge]');
  assert.equal(badge.getAttribute('data-lab-badge'), 'not-modeled');
  assert.equal(badge.getAttribute('data-lab-label'), 'no-basis');
  assert.ok(badge.textContent.startsWith('Not modeled'));
  assert.match(cards[0].querySelector('[data-labn-plain]').textContent, /^Not modeled: /);
  assert.ok(cards[0].querySelector('.labn-needed').textContent.includes('What the model would need:'));
  for (const hid of S.HYPOTHESES) assert.ok(cards[0].textContent.includes(S.HYPOTHESIS_TEXT[hid]), hid);
  assert.ok(cards[0].querySelector('.labn-card-body').textContent.includes(S.LABEL_TEXT['no-basis']));
  handle.destroy();
  close();
});

function notebookState() {
  const state = freshState();
  state.runs.w = fullRun('w', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } });
  state.runOrder.push('w');
  let nb = lab.newNotebook();
  nb = lab.addEntry(nb, {
    id: 'entry-1',
    type: 'published',
    section: 'starting-ideas',
    text: 'Temperature matters.',
    claimId: 'C-litchfield-2001-temp',
  });
  nb = lab.addEntry(
    nb,
    {
      id: 'entry-2',
      type: 'simulated',
      section: 'outcomes-limitations',
      text: 'Extended development darkened the simulated field.',
      runId: 'ext',
      label: 'illustrative-synthetic',
    },
    state.runs
  );
  nb = lab.addEntry(
    nb,
    {
      id: 'entry-3',
      type: 'simulated',
      section: 'outcomes-limitations',
      text: 'Washes gave no basis.',
      runId: 'w',
      label: 'no-basis',
    },
    state.runs
  );
  nb = lab.addEntry(nb, {
    id: 'entry-4',
    type: 'observed',
    section: 'process-decisions',
    text: 'Slides looked uneven.',
    assetId: null,
    observedAt: '2026-10-10',
  });
  nb = lab.addEntry(nb, {
    id: 'entry-5',
    type: 'reflection',
    section: 'learning-reflection',
    text: 'I learned to write predictions first.',
  });
  state.notebook = nb;
  state.counters.entry = 5;
  state.experiments['exp-1'] = {
    id: 'exp-1',
    status: 'done',
    title: 'Development endpoint',
    background: 'b',
    question: 'q',
    hypothesis: 'h',
    alternative: 'a',
    independentVariable: 'development.endpoint',
    measures: ['contrast-ordinal'],
    heldComparable: ['specimenId'],
    changed: ['development.endpoint'],
    controls: [{ type: 'characterized-positive', addresses: 'that the stain worked at all' }],
    predictions: { expected: 'e', negligible: 'n', opposite: 'o' },
    limitations: 'l',
    baselineRunId: 'base',
    experimentalRunId: 'ext',
    interpretation: { supports: 's', failsToEstablish: 'f', next: 'n' },
  };
  state.experimentOrder = ['exp-1'];
  state.measurements.m1 = {
    id: 'm1',
    measurementId: 'contrast-ordinal',
    runId: 'ext',
    label: 'illustrative-synthetic',
    value: 2,
    unit: 'ordinal',
    manual: false,
    note: 'read from the simulated field',
  };
  state.measurementOrder = ['m1'];
  return state;
}

test('exportMarkdown wraps lab.exportNotebook: without lab.js the notebook words specimens, methods, controls and strengths', () => {
  const { w, close } = harness('notebook');
  const state = notebookState();
  let seen = null;
  const spy = {
    ...lab,
    exportNotebook: (input, options) => {
      seen = options;
      return lab.exportNotebook(input, options);
    },
  };
  const md = w.CortexLabNotebook.exportMarkdown(state, spy);
  // Only the module's own formatters (lab.js absent): the shell's run names, settings, steps and
  // summaries keep the engine's defaults.
  assert.deepEqual(Object.keys(seen).sort(), [
    'controlText',
    'isSealed',
    'methodTitle',
    'specimenTitle',
    'strengthText',
    'title',
  ]);
  assert.equal(
    md,
    lab.exportNotebook(
      {
        notebook: state.notebook,
        experiments: [state.experiments['exp-1']],
        runsById: state.runs,
        measurements: [state.measurements.m1],
      },
      seen
    ),
    'the bytes are the engine export of the state lists with those options'
  );
  assert.ok(md.includes(S.EXPORT_DISCLAIMER));
  for (const tag of Object.values(S.ENTRY_TAG)) assert.ok(md.includes(tag), tag);
  assert.ok(md.includes(`Run ext, label: ${S.LABEL_TEXT['illustrative-synthetic']}`));
  assert.ok(md.includes(`Run w, label: ${S.LABEL_TEXT['no-basis']}`));
  assert.ok(md.includes('Real-lab observation, 2026-10-10'));
  const lines = md.split('\n');
  assert.equal(lines[0], "# My lab report: Alzheimer's Histology Lab");
  assert.ok(!lines.includes('Student'), 'no "Student" line');
  assert.ok(lines.includes('Name: ________'), 'a Name line to fill in');
  // The engine's v3 layout (ENGINE-13): fields as "- Field: value" items, ids and strength codes only
  // under Model detail.
  assert.ok(lines.includes('#### Run base'), 'engine run heading');
  assert.ok(lines.includes('- Specimen: Practice specimen A · high burden (not real tissue)'));
  assert.ok(lines.includes('- Method: Modified Bielschowsky silver stain (course procedure)'));
  const controls = lines.find(l => l.startsWith('- Controls: '));
  assert.equal(
    controls,
    `- Controls: Characterized positive control, rules out: that the stain worked at all ${S.STAND_IN_SUFFIX}`
  );
  assert.equal(controls.split(S.STAND_IN_SUFFIX).length - 1, 1, 'the stand-in note once on the line');
  const student = md.split('## Model detail (for instructors)')[0];
  assert.ok(!/SPEC-SYN-|bielschowsky-modified|characterized-positive/.test(student), 'no engine id on those lines');
  const sources = lines.slice(lines.indexOf('## Sources'), lines.indexOf('## Model detail (for instructors)'));
  assert.ok(
    sources.some(l => l.includes('(published, qualitative)')),
    'strengths in words'
  );
  assert.ok(!/\((published-qualitative|schematic-analogy|course-handout)\)/.test(student), 'no strength code');
  const detail = lines.slice(lines.indexOf('## Model detail (for instructors)'));
  assert.ok(
    lines.some(l => l.startsWith('- Description: ')) &&
      !lines.some(l => l.startsWith('- Summary: ')) &&
      detail.filter(l => l.startsWith('### ')).join() === '### Model sources',
    'no summary without lab.js: each description stays in its run block'
  );
  const headings = lines.filter(l => l.startsWith('## ')).map(l => l.slice(3));
  assert.deepEqual(headings, [
    ...S.SECTIONS.map(s => S.SECTION_TEXT[s]),
    'Experiment log',
    'Sources',
    'Model detail (for instructors)',
  ]);
  close();
});
test("exportMarkdown hands the engine the shell's run names, setting words and step names when lab.js has them", () => {
  const { w, close } = harness('notebook');
  const state = notebookState();
  let seen = null;
  const spy = {
    ...lab,
    exportNotebook: (input, options) => {
      seen = options;
      return lab.exportNotebook(input, options);
    },
  };
  const runTitle = run => `Trial ${run.id}`,
    paramText = (p, v) => `${p} is ${v}`,
    stepTitle = id => `Step called ${id}`;
  w.CortexLab = { words: {}, runTitle, paramText, stepTitle };
  const md = w.CortexLabNotebook.exportMarkdown(state, spy);
  const OWN = ['controlText', 'isSealed', 'methodTitle', 'specimenTitle', 'strengthText'];
  assert.deepEqual(Object.keys(seen).sort(), [...OWN, 'paramText', 'runTitle', 'stepTitle', 'title'].sort());
  assert.equal(seen.runTitle({ id: 'x' }), 'Trial x');
  assert.equal(seen.paramText('washes.condition', 'deviated'), 'washes.condition is deviated');
  assert.equal(seen.stepTitle('development'), 'Step called development');
  assert.ok(!('studentLabel' in seen), 'no student label');
  // Through the engine: every run heading, simulated entry line, setting line and step uses them.
  assert.ok(md.includes('#### Trial base') && md.includes('#### Trial ext'), 'run headings');
  assert.ok(md.includes(`Trial ext, label: ${S.LABEL_TEXT['illustrative-synthetic']}`), 'simulated entry line');
  assert.ok(md.includes(`Trial w, label: ${S.LABEL_TEXT['no-basis']}`), 'a Not modeled entry keeps its label');
  assert.ok(!md.includes('#### Run base') && !md.includes('Run ext, label:'), 'no raw run ids');
  assert.ok(md.includes('development.endpoint is extended'), 'setting words');
  assert.ok(md.includes('Step called development'), 'step names');
  // The rest of the export is unchanged: disclaimer, tags, section order, stand-in suffix.
  assert.ok(md.includes(S.EXPORT_DISCLAIMER));
  for (const tag of Object.values(S.ENTRY_TAG)) assert.ok(md.includes(tag), tag);
  assert.ok(
    md.includes(`Characterized positive control, rules out: that the stain worked at all ${S.STAND_IN_SUFFIX}`)
  );
  assert.deepEqual(
    md
      .split('\n')
      .filter(l => l.startsWith('## '))
      .map(l => l.slice(3)),
    [...S.SECTIONS.map(x => S.SECTION_TEXT[x]), 'Experiment log', 'Sources', 'Model detail (for instructors)']
  );
  // Only the formatters lab.js has are passed; the others keep the engine's defaults, and one that
  // throws leaves the engine's default on its lines instead of breaking the export.
  w.CortexLab = { words: {}, runTitle, paramText: 'not a function' };
  w.CortexLabNotebook.exportMarkdown(state, spy);
  assert.deepEqual(Object.keys(seen).sort(), [...OWN, 'runTitle', 'title'].sort());
  w.CortexLab = {
    words: {},
    runTitle: () => {
      throw new Error('broken');
    },
    stepTitle,
  };
  const partial = w.CortexLabNotebook.exportMarkdown(state, spy);
  assert.ok(partial.includes('#### Run base') && partial.includes('Run ext, label:'), 'engine run names kept');
  assert.ok(partial.includes('Step called development') && partial.includes('development.endpoint=extended'));
  w.CortexLab = undefined;
  w.CortexLabNotebook.exportMarkdown(state, spy);
  assert.deepEqual(Object.keys(seen).sort(), [...OWN, 'title'].sort());
  close();
});

test('UX-SMALL-verify-2: an experiment without a title is headed "Untitled experiment" in the export, never by its id', () => {
  const { w, close } = harness('notebook');
  const state = notebookState();
  for (const title of [undefined, '', '   ']) {
    if (title === undefined) delete state.experiments['exp-1'].title;
    else state.experiments['exp-1'].title = title;
    const md = w.CortexLabNotebook.exportMarkdown(state, lab);
    const lines = md.split('\n');
    assert.ok(lines.includes('### Untitled experiment'), `title ${JSON.stringify(title)}`);
    assert.ok(!lines.includes('### exp-1'), 'no experiment id as a heading');
    assert.equal(state.experiments['exp-1'].title, title, 'the state is not changed');
    // Everything else is the export of the same state with that title.
    assert.equal(
      md,
      w.CortexLabNotebook.exportMarkdown(
        {
          ...state,
          experiments: { 'exp-1': { ...state.experiments['exp-1'], title: 'Untitled experiment' } },
        },
        lab
      )
    );
  }
  close();
});

test('byte-identity: mounting the report and its derived lab-work list never changes the export for the same state', () => {
  const { w, app, close } = harness('notebook');
  const state = notebookState();
  const before = w.CortexLabNotebook.exportMarkdown(state, lab),
    entriesBefore = JSON.stringify(state.notebook);
  const handle = w.CortexLabNotebook.mountNotebook(app, { lab, state, onAdd() {}, onRemove() {}, onExport() {} });
  assert.ok(app.querySelectorAll('[data-labn-work]').length > 0, 'the lab-work list rendered');
  handle.update({ state });
  assert.equal(JSON.stringify(state.notebook), entriesBefore, 'nothing was written into notebook.entries');
  assert.equal(w.CortexLabNotebook.exportMarkdown(state, lab), before);
  let delivered = null;
  handle.destroy();
  w.CortexLabNotebook.mountNotebook(app, {
    lab,
    state,
    onAdd() {},
    onRemove() {},
    onExport: () => (delivered = w.CortexLabNotebook.exportMarkdown(state, lab)),
  });
  app.querySelector('#labn-export').click();
  assert.equal(delivered, before, 'Export my report hands the same bytes to the shell');
  close();
});

test('markdownToHtml escapes markup and print renders the view in the page without a new window', () => {
  const { w, close } = harness('notebook');
  const md = `# Title <script>alert(1)</script>\n\n## Section\n\n- [Reflection] a <b>bold</b> note\n  Run ext, label: ${S.LABEL_TEXT['illustrative-synthetic']}\n\nPlain & paragraph`;
  const html = w.CortexLabNotebook.markdownToHtml(md);
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('<h2>Title &lt;script&gt;alert(1)&lt;/script&gt;</h2>'));
  assert.ok(html.includes('<h3>Section</h3>'));
  assert.ok(
    html.includes('<li>[Reflection] a &lt;b&gt;bold&lt;/b&gt; note<span class="labn-print-sub">Run ext, label:')
  );
  assert.ok(html.includes('<p>Plain &amp; paragraph</p>'));
  let printed = 0;
  w.print = () => printed++;
  const view = w.CortexLabNotebook.print(md);
  assert.equal(w.document.querySelector('.labn-print-view'), view);
  assert.equal(view.getAttribute('role'), 'dialog');
  assert.equal(view.querySelectorAll('script').length, 0);
  assert.ok(view.querySelector('.labn-print-doc').textContent.includes('<script>alert(1)</script>'));
  assert.ok(w.document.body.classList.contains('labn-printing'));
  view.querySelector('[data-labn-action="print-again"]').click();
  assert.equal(printed, 1);
  view.querySelector('[data-labn-action="close"]').click();
  assert.equal(w.document.querySelector('.labn-print-view'), null);
  assert.ok(!w.document.body.classList.contains('labn-printing'));
  close();
});

test('the report lists sections in rubric order with hints, colored labels with words, and removes through onRemove', () => {
  const { w, app, close } = harness('notebook');
  const state = notebookState();
  const removed = [];
  w.CortexLabNotebook.mountNotebook(app, { lab, state, onAdd() {}, onRemove: id => removed.push(id), onExport() {} });
  // SIMPLE-notebook: a section shows only once it holds a note (the file still prints all five).
  const used = S.SECTIONS.filter(s => state.notebook.entries.some(e => e.section === s));
  assert.deepEqual(used.length, 4, 'four of the five sections hold a note');
  assert.deepEqual(
    texts(app.querySelectorAll('.labn-section h3')),
    used.map(s => S.SECTION_TEXT[s])
  );
  assert.equal(app.querySelector('[data-labn-no-entries]'), null);
  for (const section of app.querySelectorAll('.labn-section'))
    assert.ok(section.querySelector('.labn-hint').textContent.length > 20, 'each section has a one-line hint');
  const entries = app.querySelectorAll('.labn-entry');
  assert.equal(entries.length, 5);
  const byId = id => app.querySelector(`[data-labn-entry="${id}"]`);
  const tag = id => byId(id).querySelector('.labn-entry-head .labn-tag');
  assert.equal(tag('entry-1').textContent, 'Published');
  assert.equal(tag('entry-2').textContent, 'Simulated');
  assert.equal(tag('entry-4').textContent, 'Observed');
  assert.equal(tag('entry-5').textContent, 'Reflection');
  assert.ok(!app.textContent.includes('[Simulated'), 'no bracket tags in the UI');
  assert.ok(!app.textContent.includes('[Published]'));
  // Published: the finding in words; its ids sit under Sources.
  assert.ok(byId('entry-1').textContent.includes('Cites: “The Bielschowsky stain is highly sensitive'));
  const sources = byId('entry-1').querySelector('[data-labn-why]');
  assert.equal(sources.textContent, 'Sources');
  assert.equal(sources.getAttribute('aria-expanded'), 'false');
  assert.ok(byId('entry-1').textContent.includes('S-litchfield-2001'));
  assert.doesNotMatch(visibleText(byId('entry-1')), /C-litchfield|S-litchfield/);
  sources.click();
  assert.match(visibleText(byId('entry-1')), /C-litchfield-2001-temp/);
  // Simulated: the badge carries the stored engine label; the plain summary follows.
  const b2 = byId('entry-2').querySelector('[data-lab-badge]');
  assert.equal(b2.getAttribute('data-lab-label'), 'illustrative-synthetic');
  assert.equal(b2.getAttribute('data-lab-badge'), 'simulated');
  assert.ok(byId('entry-2').querySelector('[data-labn-plain]').textContent.includes('visible silver'));
  const b3 = byId('entry-3').querySelector('[data-lab-badge]');
  assert.equal(b3.getAttribute('data-lab-label'), 'no-basis');
  assert.equal(b3.getAttribute('data-lab-badge'), 'not-modeled');
  assert.ok(!byId('entry-3').textContent.includes('Illustrative simulation'));
  assert.ok(byId('entry-4').textContent.includes('Real-lab observation, 2026-10-10'));
  const legend = texts(app.querySelectorAll('.labn-taglist .labn-tag'));
  assert.deepEqual(legend, ['Published', 'Observed', 'Simulated', 'Reflection']);
  // SIMPLE-notebook: the legend is one folded line.
  const legendFold = app.querySelector('button[data-labn-toggle="legend"]');
  assert.equal(legendFold.textContent, 'What the four labels mean');
  assert.equal(legendFold.getAttribute('aria-expanded'), 'false');
  assert.equal(app.querySelector('.labn-taglist').closest('.labn-disclosure').hidden, true);
  legendFold.click();
  assert.equal(app.querySelector('.labn-taglist').closest('.labn-disclosure').hidden, false);
  const remove = byId('entry-4').querySelector('[data-labn-action="remove"]');
  assert.equal(remove.getAttribute('aria-label'), 'Remove: Slides looked uneven.');
  remove.click();
  assert.deepEqual(removed, ['entry-4']);
  close();
});

test('"From your lab work" lists finished runs, measurements and revealed experiments with badges, from state only', () => {
  const { w, app, type, close } = harness('notebook');
  const state = notebookState();
  // An unfinished run is not "resolved" and stays out of the list.
  state.runs.half = perform(
    lab.createRun({ id: 'half', specimenId: 'SPEC-SYN-AD-01', method: 'bielschowsky-modified' }),
    S.STEPS.slice(0, 3)
  );
  state.runOrder.push('half');
  const added = [];
  w.CortexLabNotebook.mountNotebook(app, {
    lab,
    state,
    onAdd: entry => {
      added.push(entry);
      state.notebook = lab.addEntry(state.notebook, entry, state.runs);
      state.counters.entry += 1;
      return entry;
    },
    onRemove() {},
    onExport() {},
  });
  const items = app.querySelectorAll('[data-labn-work]');
  assert.deepEqual(
    Array.from(items).map(n => `${n.getAttribute('data-labn-work')}:${n.getAttribute('data-labn-ref')}`),
    ['run:base', 'run:ext', 'run:w', 'measurement:m1', 'experiment:exp-1']
  );
  for (const item of items) {
    const badge = item.querySelector('[data-lab-badge]');
    assert.ok(
      badge && badge.getAttribute('data-lab-label'),
      `${item.getAttribute('data-labn-ref')} carries a labeled badge`
    );
  }
  const run = app.querySelector('[data-labn-work="run"][data-labn-ref="ext"]');
  assert.ok(run.textContent.includes('Development time: longer'));
  assert.match(run.querySelector('.labn-work-line').textContent, /visible silver/);
  const notModeled = app.querySelector('[data-labn-work="run"][data-labn-ref="w"] [data-lab-badge]');
  assert.equal(notModeled.getAttribute('data-lab-badge'), 'not-modeled');
  const measure = app.querySelector('[data-labn-work="measurement"]');
  assert.ok(measure.textContent.includes('Target/background contrast on Run ext'));
  assert.ok(measure.textContent.includes('low (model scale)'));
  assert.ok(
    app.querySelector('[data-labn-work="experiment"]').textContent.includes('Experiment: Development endpoint')
  );
  assert.equal(state.notebook.entries.length, 5, 'derived items are not entries');
  // "Add a note about this" opens the simulated form pre-filled with that run.
  const before = state.notebook.entries.length;
  run.querySelector('[data-labn-action="note-about"]').click();
  const form = app.querySelector('[data-labn-add]');
  assert.equal(form.hidden, false);
  assert.equal(app.querySelector('[data-labn-form-title]').textContent, 'Note on a simulated run');
  assert.equal(app.querySelector('select[data-labn-draft="runId"]').value, 'ext');
  assert.equal(app.querySelector('select[data-labn-draft="section"]').value, 'outcomes-limitations');
  assert.equal(w.document.activeElement, app.querySelector('textarea[data-labn-draft="text"]'));
  type(app.querySelector('textarea[data-labn-draft="text"]'), 'The extended run moved up one step.');
  app.querySelector('[data-labn-add-form]').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(added.length, 1);
  assert.equal(added[0].type, 'simulated');
  assert.equal(added[0].runId, 'ext');
  assert.equal(added[0].label, 'illustrative-synthetic');
  assert.equal(state.notebook.entries.length, before + 1);
  assert.equal(form.hidden, true, 'the form closes after adding');
  assert.equal(w.document.activeElement, app.querySelector(`[data-labn-entry="${added[0].id}"]`));
  // A revealed experiment opens a reflection that names it.
  app.querySelector('[data-labn-work="experiment"] [data-labn-action="note-about"]').click();
  assert.equal(app.querySelector('[data-labn-form-title]').textContent, 'New reflection');
  assert.equal(
    app.querySelector('textarea[data-labn-draft="text"]').value,
    'About my experiment “Development endpoint”: '
  );
  close();
});

test('one "Add to my report" menu (Reflection first) adds every entry type with engine validation', () => {
  const { w, app, type, close } = harness('notebook');
  const state = freshState();
  const added = [];
  w.CortexLabNotebook.mountNotebook(app, {
    lab,
    state,
    onAdd: entry => {
      added.push(entry);
      state.notebook = lab.addEntry(state.notebook, entry, state.runs);
      state.counters.entry += 1;
      return true;
    },
    onRemove() {},
    onExport() {},
  });
  const form = app.querySelector('[data-labn-add-form]');
  const submit = () => form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  const error = () => app.querySelector('[data-labn-add-error]').textContent;
  const toggle = app.querySelector('[data-labn-action="add-menu"]');
  const pick = typeName => {
    if (toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
    app.querySelector(`[data-labn-add-type="${typeName}"]`).click();
  };
  assert.equal(app.querySelector('[data-labn-add]').hidden, true, 'the form waits for the menu');
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  const menu = app.querySelector(`#${toggle.getAttribute('aria-controls')}`);
  assert.equal(menu.hidden, false);
  assert.deepEqual(
    Array.from(menu.querySelectorAll('[data-labn-add-type]')).map(b => b.getAttribute('data-labn-add-type')),
    ['reflection', 'observed', 'published', 'simulated']
  );
  assert.equal(
    w.document.activeElement,
    menu.querySelector('[data-labn-add-type="reflection"]'),
    'focus enters the menu'
  );
  // Escape closes the menu and returns focus to its button.
  w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(menu.hidden, true);
  assert.equal(w.document.activeElement, toggle);

  // Published without a claim: the engine's message is shown, onAdd is not called.
  pick('published');
  assert.equal(menu.hidden, true, 'choosing closes the menu');
  assert.equal(w.document.activeElement, app.querySelector('input[data-labn-draft="search"]'));
  assert.equal(app.querySelector('select[data-labn-draft="section"]').value, 'starting-ideas');
  type(app.querySelector('textarea[data-labn-draft="text"]'), 'Temperature matters.');
  submit();
  assert.ok(/claimId/.test(error()), error());
  assert.equal(added.length, 0);
  type(app.querySelector('input[data-labn-draft="search"]'), 'temperature');
  const claim = app.querySelector('input[data-labn-draft="claimId"][value="C-litchfield-2001-temp"]');
  assert.ok(claim, 'the search lists the Litchfield claim');
  claim.checked = true;
  claim.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.ok(app.textContent.includes('S-litchfield-2001'), 'sources of the chosen claim are shown');
  type(app.querySelector('textarea[data-labn-draft="text"]'), 'Temperature matters.');
  submit();
  assert.equal(error(), '');
  assert.equal(added.length, 1);
  assert.equal(added[0].type, 'published');
  assert.equal(added[0].claimId, 'C-litchfield-2001-temp');
  assert.equal(added[0].id, 'entry-1');

  // Observed: real-lab only, dated, no runId, assetId null.
  pick('observed');
  assert.ok(app.textContent.includes('what you saw yourself in the real lab'));
  type(app.querySelector('textarea[data-labn-draft="text"]'), 'Slides looked uneven.');
  submit();
  assert.ok(/observedAt/.test(error()), error());
  type(app.querySelector('input[data-labn-draft="observedAt"]'), '2026-10-10');
  submit();
  assert.equal(error(), '');
  assert.equal(added.length, 2);
  assert.equal(added[1].type, 'observed');
  assert.equal(added[1].section, 'process-decisions');
  assert.equal(added[1].assetId, null);
  assert.equal(added[1].observedAt, '2026-10-10');
  assert.ok(!('runId' in added[1]));

  // Simulated: the label comes from lab.resolve(run).
  pick('simulated');
  type(app.querySelector('textarea[data-labn-draft="text"]'), 'Extended development darkened the simulated field.');
  submit();
  assert.ok(/runId/.test(error()), error());
  type(app.querySelector('select[data-labn-draft="runId"]'), 'ext');
  const preview = app.querySelector('.labn-run-preview [data-lab-badge]');
  assert.equal(preview.getAttribute('data-lab-label'), 'illustrative-synthetic');
  submit();
  assert.equal(error(), '');
  assert.equal(added[2].type, 'simulated');
  assert.equal(added[2].runId, 'ext');
  assert.equal(added[2].label, 'illustrative-synthetic');
  assert.equal(added[2].section, 'outcomes-limitations');

  // Reflection.
  pick('reflection');
  type(app.querySelector('textarea[data-labn-draft="text"]'), 'I learned to write predictions first.');
  submit();
  assert.equal(added[3].type, 'reflection');
  assert.equal(added[3].section, 'learning-reflection');
  assert.ok(!('label' in added[3]) && !('runId' in added[3]) && !('claimId' in added[3]));
  assert.equal(app.querySelectorAll('.labn-entry').length, 4);
  assert.equal(added[3].id, 'entry-4');

  // Empty text is refused before the engine is asked; Cancel closes and returns focus to the menu button.
  pick('reflection');
  submit();
  assert.equal(error(), 'Your note is empty.');
  assert.equal(added.length, 4);
  app.querySelector('[data-labn-action="add-cancel"]').click();
  assert.equal(app.querySelector('[data-labn-add]').hidden, true);
  assert.equal(w.document.activeElement, toggle);
  // A click elsewhere closes an open menu.
  toggle.click();
  w.document.body.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  assert.equal(menu.hidden, true);
  close();
});

test('one primary "Download my report (.md)" calls onExport once; the copies and Print live under More and never call it', () => {
  const { w, app, close } = harness('notebook');
  const state = notebookState();
  let calls = 0;
  const first = w.CortexLabNotebook.mountNotebook(app, {
    lab,
    state,
    onAdd() {},
    onRemove() {},
    onExport: () => {
      calls += 1;
      return w.CortexLabNotebook.exportMarkdown(state, lab);
    },
  });
  const exportBtn = app.querySelector('#labn-export');
  assert.equal(exportBtn.textContent, 'Download my report (.md)');
  assert.ok(exportBtn.classList.contains('btn-solid'));
  assert.equal(app.querySelectorAll('.labn-notebook .btn-solid:not([type="submit"])').length, 1, 'one primary');
  for (const action of ['copy-plain', 'copy', 'print'])
    assert.ok(app.querySelector(`[data-labn-action="${action}"]`).closest('[hidden]'), `${action} waits in More`);
  exportBtn.click();
  assert.equal(calls, 1);
  assert.equal(app.querySelector('[data-labn-export-status]').textContent, 'Report file ready: my-lab-report.md');
  app.querySelector('[data-labn-action="more"]').click();
  app.querySelector('[data-labn-action="print"]').click();
  assert.equal(calls, 1, 'Print never calls onExport');
  assert.ok(w.document.querySelector('.labn-print-view'));
  w.document.querySelector('.labn-print-view [data-labn-action="close"]').click();
  assert.equal(w.document.activeElement, app.querySelector('[data-labn-action="more"]'), 'focus returns to More');
  first.destroy();
  // No string back (jsdom has no URL.createObjectURL): the module tries to download itself and says why it cannot.
  w.CortexLabNotebook.mountNotebook(app, { lab, state, onAdd() {}, onRemove() {}, onExport: () => undefined });
  app.querySelector('#labn-export').click();
  assert.match(app.querySelector('[data-labn-export-status]').textContent, /Downloading is not available here/);
  close();
});

test('the module exposes only window.CortexLabNotebook and declares no top-level names', () => {
  assert.doesNotMatch(SOURCE, /^\s*(import|export)\s/m);
  assert.doesNotMatch(SOURCE, /^(const|let|var|function|class)\s/m);
  const { w, close } = harness();
  assert.deepEqual(Object.keys(w.CortexLabNotebook).sort(), [
    'exportMarkdown',
    'fileName',
    'markdownToHtml',
    'markdownToPlain',
    'mountDesigner',
    'mountNotebook',
    'print',
  ]);
  close();
});

test('window.CortexLab words, badges and summaries are used when lab.js provides them', () => {
  const { w, app, close } = harness();
  w.CortexLab = {
    words: { practiceSpecimen: 'SHELL specimen words' },
    badge: (kind, opts) =>
      `<span class="lab-badge" data-lab-badge="${kind}" data-lab-label="${opts.label || ''}">SHELL ${kind}</span>`,
    // A shell badge without the engine label still ends up carrying it.
    badgeForOutcome: () => '<span class="lab-badge" data-lab-badge="simulated">SHELL outcome</span>',
    summarize: () => 'SHELL summary.',
  };
  const state = freshState();
  state.experiments['exp-2'] = revealedExperiment();
  state.experimentOrder = ['exp-2'];
  w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-2', onSave() {} });
  assert.ok(app.textContent.includes('SHELL specimen words'));
  const card = app.querySelector('.labn-card');
  assert.equal(card.querySelector('[data-lab-badge]').textContent, 'SHELL outcome');
  assert.equal(card.querySelector('[data-lab-badge]').getAttribute('data-lab-label'), 'illustrative-synthetic');
  assert.equal(card.querySelector('[data-labn-plain]').textContent, 'SHELL summary.');
  assert.equal(app.querySelector('.labn-compare [data-lab-badge]').textContent, 'SHELL simulated');
  close();
});

// ---- review round: locking, stale reveals, live region, focus management, print lifecycle ----------
function revealedExperiment(id = 'exp-2') {
  return {
    id,
    status: 'revealed',
    revealedAt: '2026-10-10T00:00:00.000Z',
    title: 'Development endpoint',
    background: 'b',
    question: 'q',
    hypothesis: 'h',
    alternative: 'a',
    independentVariable: 'development.endpoint',
    measures: ['contrast-ordinal'],
    heldComparable: ['specimenId'],
    changed: ['development.endpoint'],
    controls: [{ type: 'baseline-process', addresses: 'process drift' }],
    predictions: { expected: 'e', negligible: 'n', opposite: 'o' },
    limitations: 'l',
    baselineRunId: 'base',
    experimentalRunId: 'ext',
    interpretation: { supports: '', failsToEstablish: '', next: '' },
  };
}

test('M2: after reveal every pre-registered control is locked; title, limitations and interpretation stay editable', async () => {
  const { w, app, type, wait, close } = harness();
  const state = freshState();
  state.experiments['exp-2'] = revealedExperiment();
  state.experimentOrder = ['exp-2'];
  const saved = [];
  w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-2', onSave: exp => saved.push(exp) });
  const note = app.querySelector('[data-labn-lock-note]');
  assert.equal(note.hidden, false);
  assert.equal(note.textContent, 'Your plan is locked now that you have seen the outcome.');
  for (const name of [
    'background',
    'question',
    'hypothesis',
    'alternative',
    'independentVariable',
    'predictions.expected',
    'predictions.negligible',
    'predictions.opposite',
    'controls.0.addresses',
  ])
    assert.equal(field(app, name).readOnly, true, `${name} is read-only`);
  for (const name of ['baselineRunId', 'experimentalRunId'])
    assert.equal(field(app, name).disabled, true, `${name} is disabled`);
  for (const box of app.querySelectorAll('input[data-labn-control-type]'))
    assert.equal(box.disabled, true, 'control box');
  const boxes = app.querySelectorAll('input[data-labn-field="measures"]');
  assert.ok(boxes.length > 0);
  for (const box of boxes) assert.equal(box.disabled, true, 'measure checkbox disabled');
  for (const sel of [
    'input[data-labn-chip-input]',
    '[data-labn-action="chip-add"]',
    '[data-labn-action="chip-remove"]',
  ]) {
    const nodes = app.querySelectorAll(sel);
    assert.ok(nodes.length > 0, sel);
    for (const node of nodes) assert.ok(node.disabled || node.readOnly, `${sel} is locked`);
  }
  for (const name of [
    'title',
    'limitations',
    'interpretation.supports',
    'interpretation.failsToEstablish',
    'interpretation.next',
  ]) {
    const node = field(app, name);
    assert.ok(node && !node.readOnly && !node.disabled, `${name} stays editable`);
  }
  // The wizard buttons are not part of the lock: the student can still read every step.
  assert.equal(app.querySelector('[data-labn-action="wizard-back"]').disabled, false);
  type(field(app, 'title'), 'Renamed after reveal');
  type(field(app, 'limitations'), 'Also the limitations');
  await wait();
  assert.equal(saved[saved.length - 1].title, 'Renamed after reveal');
  assert.equal(saved[saved.length - 1].limitations, 'Also the limitations');
  assert.equal(saved[saved.length - 1].question, 'q');
  close();
});

test('m1: changing a paired run clears the revealed cards and re-arms the gate', () => {
  const { w, app, type, close } = harness();
  const state = freshState();
  state.experiments['exp-2'] = revealedExperiment();
  state.experimentOrder = ['exp-2'];
  w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-2', onSave() {} });
  const button = () => app.querySelector('[data-labn-action="reveal"]');
  assert.equal(app.querySelectorAll('.labn-card').length, 1);
  assert.ok(app.querySelector('.labn-reasons').textContent.includes('Your outcome is shown below'));
  assert.equal(app.querySelector('[data-labn-gate]').hidden, true);
  // The run selects are disabled after reveal (M2); the change is dispatched programmatically to exercise the guard.
  type(field(app, 'experimentalRunId'), '');
  assert.equal(app.querySelectorAll('.labn-card').length, 0, 'stale cards are gone');
  assert.equal(app.querySelectorAll('.labn-compare').length, 0);
  assert.equal(app.querySelector('[data-labn-gate]').hidden, false, 'the gate is back');
  assert.ok(reasonAttrs(app).includes('experimentalRunId does not name a run'));
  assert.equal(button().textContent, 'Reveal the simulated outcome');
  assert.equal(button().disabled, true);
  type(field(app, 'experimentalRunId'), 'ext');
  assert.equal(app.querySelectorAll('.labn-card').length, 0, 'the cards do not return without a new reveal');
  assert.ok(app.querySelector('.labn-reasons').textContent.includes('Ready to reveal'));
  assert.equal(button().disabled, false);
  close();
});

test('B6: the gate reasons live in one persistent aria-live node whose children are replaced', () => {
  const { w, app, type, close } = harness();
  const state = freshState();
  w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-1', onSave() {} });
  const live = app.querySelector('.labn-reasons');
  assert.equal(live.getAttribute('aria-live'), 'polite');
  assert.equal(live.getAttribute('aria-atomic'), 'true');
  assert.equal(app.querySelectorAll('.labn-reasons').length, 1);
  assert.ok(reasonAttrs(app).includes('predictions.expected is empty'));
  assert.equal(app.querySelector('[data-labn-action="reveal"]').getAttribute('aria-describedby'), live.id);
  type(field(app, 'predictions.expected'), 'Darker cores.');
  assert.equal(app.querySelector('.labn-reasons'), live, 'the same node after the gate changed');
  assert.ok(!reasonAttrs(app).includes('predictions.expected is empty'));
  assert.ok(reasonAttrs(app).includes('predictions.negligible is empty'));
  assert.equal(app.querySelector('[data-labn-action="reveal"]').getAttribute('aria-describedby'), live.id);
  // The save line is a persistent status too.
  const save = app.querySelector('[data-labn-save]');
  assert.equal(save.getAttribute('role'), 'status');
  type(field(app, 'question'), 'Q?');
  assert.equal(app.querySelector('[data-labn-save]'), save);
  close();
});

test('A5: removing a chip focuses its input; unchecking a control keeps focus on its box', () => {
  const { w, app, check, close } = harness();
  const state = freshState();
  state.experiments['exp-1'] = {
    id: 'exp-1',
    status: 'draft',
    changed: ['development.endpoint'],
    heldComparable: ['specimenId'],
    controls: [
      { type: 'baseline-process', addresses: 'x' },
      { type: 'negative-biological', addresses: 'y' },
    ],
  };
  w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-1', onSave() {} });
  app.querySelector('[data-labn-action="chip-remove"][data-labn-list="changed"]').click();
  assert.equal(w.document.activeElement, app.querySelector('input[data-labn-chip-input="changed"]'));
  assert.equal(app.querySelectorAll('[data-labn-action="chip-remove"][data-labn-list="changed"]').length, 0);
  const box = app.querySelector('input[data-labn-control-type="baseline-process"]');
  assert.equal(box.checked, true);
  box.focus();
  check(box, false);
  assert.equal(w.document.activeElement, app.querySelector('input[data-labn-control-type="baseline-process"]'));
  assert.notEqual(w.document.activeElement, w.document.body);
  assert.equal(app.querySelectorAll('[data-labn-field$=".addresses"]').length, 1);
  assert.equal(field(app, 'controls.0.addresses').value, 'y');
  close();
});

test('A4: removing an entry moves focus to the next entry, or to the report heading when none follows', () => {
  const { w, app, close } = harness('notebook');
  const state = notebookState();
  w.CortexLabNotebook.mountNotebook(app, {
    lab,
    state,
    onAdd() {},
    onRemove: id => {
      state.notebook = { v: 1, entries: state.notebook.entries.filter(e => e.id !== id) };
    },
    onExport() {},
  });
  const order = () => Array.from(app.querySelectorAll('[data-labn-entry]')).map(n => n.getAttribute('data-labn-entry'));
  assert.deepEqual(order(), ['entry-1', 'entry-4', 'entry-2', 'entry-3', 'entry-5']);
  app.querySelector('[data-labn-entry="entry-1"] [data-labn-action="remove"]').click();
  assert.deepEqual(order(), ['entry-4', 'entry-2', 'entry-3', 'entry-5']);
  assert.equal(w.document.activeElement, app.querySelector('[data-labn-entry="entry-4"]'));
  assert.equal(app.querySelector('[data-labn-export-status]').textContent, 'Note removed.');
  app.querySelector('[data-labn-entry="entry-5"] [data-labn-action="remove"]').click();
  assert.deepEqual(order(), ['entry-4', 'entry-2', 'entry-3']);
  assert.equal(w.document.activeElement, app.querySelector('.labn-entries h2'));
  close();
});

test('A6: the Copy fallback removes its textarea and returns focus to the More button', () => {
  const { w, app, close } = harness('notebook');
  const state = notebookState();
  w.CortexLabNotebook.mountNotebook(app, { lab, state, onAdd() {}, onRemove() {}, onExport() {} });
  const more = app.querySelector('[data-labn-action="more"]');
  more.click();
  app.querySelector('[data-labn-action="copy"]').click(); // jsdom has neither navigator.clipboard nor execCommand
  assert.equal(more.getAttribute('aria-expanded'), 'false', 'the menu closed');
  assert.equal(w.document.activeElement, more);
  assert.equal(w.document.querySelectorAll('textarea.labn-sr-only').length, 0);
  assert.match(app.querySelector('[data-labn-export-status]').textContent, /Copying is not available here/);
  close();
});

test('m7: a simulated entry whose run now resolves to another label keeps its stored label and hides the live text', () => {
  const { w, app, close } = harness('notebook');
  const state = notebookState();
  // entry-2 was recorded as illustrative-synthetic on run ext; the run is then changed to a deviated wash.
  state.runs.ext = fullRun('ext', 'SPEC-SYN-AD-01', {
    development: { endpoint: 'extended' },
    washes: { condition: 'deviated' },
  });
  assert.equal(lab.resolve(state.runs.ext).label, 'no-basis');
  w.CortexLabNotebook.mountNotebook(app, { lab, state, onAdd() {}, onRemove() {}, onExport() {} });
  const item = app.querySelector('[data-labn-entry="entry-2"]');
  assert.equal(
    item.querySelector('[data-lab-badge]').getAttribute('data-lab-label'),
    'illustrative-synthetic',
    'stored label kept'
  );
  const stale = item.querySelector('[data-labn-stale]');
  assert.equal(stale.textContent, 'This run changed after the entry was recorded; the stored label is kept.');
  assert.equal(item.querySelector('[data-labn-plain]'), null, 'no live outcome text');
  assert.ok(!item.textContent.includes('Not modeled'));
  // entry-3 still matches its run and shows the live plain summary.
  const live = app.querySelector('[data-labn-entry="entry-3"]');
  assert.ok(live.querySelector('[data-labn-plain]'));
  assert.equal(live.querySelector('[data-labn-stale]'), null);
  close();
});

test('m5 + A7: print registers one pauser in window.LAB.pausers, closes idempotently and traps focus', () => {
  const { w, close } = harness('notebook');
  w.LAB = { pausers: [] };
  const trapped = [];
  w.trapModal = (node, onEscape) => trapped.push({ node, onEscape });
  const opener = w.document.createElement('button');
  w.document.querySelector('#app').appendChild(opener);
  opener.focus();
  const view = w.CortexLabNotebook.print('# Title\n\nBody');
  assert.equal(w.LAB.pausers.length, 1);
  assert.equal(trapped.length, 1);
  assert.equal(trapped[0].node, view);
  assert.equal(typeof trapped[0].onEscape, 'function');
  assert.equal(w.document.activeElement, view.querySelector('[data-labn-action="close"]'));
  // A second print view replaces the first and adds no second pauser.
  const view2 = w.CortexLabNotebook.print('# Second');
  assert.equal(w.document.querySelectorAll('.labn-print-view').length, 1);
  assert.equal(w.document.querySelector('.labn-print-view'), view2);
  assert.ok(!view.isConnected);
  assert.equal(w.LAB.pausers.length, 1);
  // Leaving the section runs the pauser: the view and the body class go, focus returns to the opener.
  w.LAB.pausers[0]();
  assert.equal(w.document.querySelector('.labn-print-view'), null);
  assert.ok(!w.document.body.classList.contains('labn-printing'));
  assert.equal(w.document.activeElement, opener);
  w.LAB.pausers[0](); // idempotent
  trapped[1].onEscape(); // trapModal's Escape path after the view is gone: nothing left to do
  assert.equal(w.document.querySelector('.labn-print-view'), null);
  // The document Escape listener still closes a fresh view once.
  const view3 = w.CortexLabNotebook.print('# Third');
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.ok(!view3.isConnected);
  assert.equal(w.document.querySelector('.labn-print-view'), null);
  assert.equal(w.document.activeElement, opener);
  close();
});

test('A7 fallback: without trapModal the print view makes the rest of the page inert and restores it on close', () => {
  const { w, app, close } = harness('notebook');
  const other = w.document.createElement('div');
  w.document.body.appendChild(other);
  const opener = w.document.createElement('button');
  app.appendChild(opener);
  opener.focus();
  const view = w.CortexLabNotebook.print('# Title');
  assert.ok(app.hasAttribute('inert') && other.hasAttribute('inert'), 'siblings are inert');
  assert.ok(!view.hasAttribute('inert'));
  view.querySelector('[data-labn-action="close"]').click();
  assert.ok(!app.hasAttribute('inert') && !other.hasAttribute('inert'), 'inert removed on close');
  assert.equal(w.document.activeElement, opener, 'focus returns to the opener');
  close();
});

test('model scale: the Why? tables print words with the scale legend, never a bare number', () => {
  const { w, app, close } = harness();
  const state = freshState();
  state.experiments['exp-2'] = revealedExperiment();
  state.experimentOrder = ['exp-2'];
  w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-2', onSave() {} });
  const tables = app.querySelectorAll('.labn-table');
  assert.equal(tables.length, 2, 'per-site table and comparison table');
  for (const table of tables) {
    assert.ok(table.closest('.labn-why'), 'tables live under Why?');
    assert.equal(
      table.querySelector('caption').textContent,
      'Model scale: none · trace · low · moderate · high (positions, not amounts)'
    );
    for (const td of table.querySelectorAll('td'))
      assert.match(
        td.textContent,
        /^(none|trace|low|moderate|high|not modeled|no change|(up|down) \d steps?)$/,
        td.textContent
      );
  }
  const cells = texts(tables[0].querySelectorAll('td'));
  assert.ok(cells.includes('high'), cells);
  const compare = texts(tables[1].querySelectorAll('td'));
  assert.ok(compare.includes('moderate'), compare);
  assert.ok(compare.includes('up 1 step'), compare);
  close();
});

test('F12: the hypothesis text prefers the engine export and the fallback copies carry the same strings', () => {
  for (const hid of S.HYPOTHESES) {
    assert.match(S.HYPOTHESIS_TEXT[hid], /^Hypothesis: /);
    assert.ok(SOURCE.includes(`'${S.HYPOTHESIS_TEXT[hid]}'`), `fallback copy of ${hid}`);
  }
  const { w, app, close } = harness();
  w.SilverLab = { ...S, HYPOTHESIS_TEXT: { ...S.HYPOTHESIS_TEXT, 'H-reduced-metal': 'Engine wording wins' } };
  w.CortexLabNotebook.mountDesigner(app, { lab, state: freshState(), experimentId: 'exp-1', onSave() {} });
  assert.ok(app.textContent.includes('Engine wording wins'));
  assert.ok(!app.textContent.includes(S.HYPOTHESIS_TEXT['H-reduced-metal']));
  close();
});

test('tab: an entry type opens its form, a section opens a reflection for it, export / add focus their button', () => {
  for (const [tab, check] of [
    [
      'observed',
      app => assert.equal(app.querySelector('[data-labn-form-title]').textContent, 'New real-lab observation'),
    ],
    ['next-steps', app => assert.equal(app.querySelector('select[data-labn-draft="section"]').value, 'next-steps')],
    ['export', (app, w) => assert.equal(w.document.activeElement, app.querySelector('#labn-export'))],
    ['add', (app, w) => assert.equal(w.document.activeElement, app.querySelector('[data-labn-action="add-menu"]'))],
  ]) {
    const { w, app, close } = harness('notebook');
    w.CortexLabNotebook.mountNotebook(app, { lab, state: freshState(), tab, onAdd() {}, onRemove() {}, onExport() {} });
    check(app, w);
    close();
  }
});

// ---- UX-FIX round (student review 2026-10-11) --------------------------------------------------------
test('F7: dates show the local calendar day, while the stored values stay UTC ISO strings', () => {
  const tz = process.env.TZ;
  process.env.TZ = 'America/Chicago';
  try {
    const { w, app, close } = harness();
    const state = freshState();
    // 20:36 CDT on 11 Oct is 01:36 UTC on 12 Oct.
    state.experiments['exp-2'] = { ...revealedExperiment(), revealedAt: '2026-10-12T01:36:00.000Z' };
    state.experimentOrder = ['exp-2'];
    w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-2', onSave() {} });
    assert.match(app.querySelector('[data-labn-reveal] .labn-hint').textContent, /^Revealed 2026-10-11\. /);
    close();
    const nb = harness('notebook');
    const notes = notebookState();
    notes.notebook.entries[4].createdAt = '2026-10-12T01:36:00.000Z';
    nb.w.CortexLabNotebook.mountNotebook(nb.app, { lab, state: notes, onAdd() {}, onRemove() {}, onExport() {} });
    assert.ok(nb.app.querySelector('[data-labn-entry="entry-5"]').textContent.includes('Added 2026-10-11'));
    // A real-lab date the student typed is a calendar day already and is never shifted.
    assert.ok(
      nb.app.querySelector('[data-labn-entry="entry-4"]').textContent.includes('Real-lab observation, 2026-10-10')
    );
    nb.close();
  } finally {
    if (tz === undefined) delete process.env.TZ;
    else process.env.TZ = tz;
  }
});

test('F17 + KB-18: a new design opens on its question; the step indicator is buttons; ?step= follows the step', () => {
  const { w, app, type, close } = harness();
  const state = freshState();
  // The activity links ?view=designer&step=2; a design with nothing on step 1 still opens on step 1.
  w.history.replaceState(null, '', '/lab?view=designer&step=2');
  const handle = w.CortexLabNotebook.mountDesigner(app, { lab, state, step: 2, onSave() {} });
  assert.deepEqual(shownStep(app), [1]);
  assert.equal(w.location.search, '?view=designer&step=2', 'the first render leaves the address alone');
  const buttons = app.querySelectorAll(
    'ol.labn-progress > li[data-labn-progress] > button[data-labn-action="wizard-go"]'
  );
  assert.equal(buttons.length, 2, 'every step of the indicator is a button');
  assert.deepEqual(
    texts(buttons).map(t => t.replace(/\s+/g, ' ')),
    ['Step 1: 1Plan', 'Step 2: 2Predict and reveal']
  );
  assert.equal(buttons[0].getAttribute('aria-current'), 'step');
  buttons[1].click();
  assert.deepEqual(shownStep(app), [2]);
  assert.equal(w.document.activeElement, step(app, 2).querySelector('h2'), 'focus on the step heading');
  assert.equal(buttons[1].getAttribute('aria-current'), 'step');
  assert.equal(buttons[0].hasAttribute('aria-current'), false);
  assert.equal(new URLSearchParams(w.location.search).get('step'), '2');
  buttons[0].click();
  assert.deepEqual(shownStep(app), [1]);
  assert.equal(new URLSearchParams(w.location.search).get('step'), '1');
  handle.destroy();
  // Once step 1 has something written, the step asked for is honored.
  state.experiments['exp-5'] = { ...blankish('exp-5'), title: 'Started' };
  state.experimentOrder = ['exp-5'];
  w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-5', step: 2, onSave() {} });
  assert.deepEqual(shownStep(app), [2]);
  type(field(app, 'title'), 'Started again');
  close();
});

function blankish(id) {
  return { id, status: 'draft', baselineRunId: null, experimentalRunId: null, interpretation: null };
}

test('F5: the first save names the new experiment in the address; other experiments stay one click away', async () => {
  const { w, app, type, wait, close } = harness();
  const state = freshState();
  state.experiments['exp-1'] = { ...completeExperiment('exp-1'), title: 'First idea', status: 'draft' };
  state.experimentOrder = ['exp-1'];
  w.history.replaceState(null, '', '/lab?view=designer&exp=new');
  // The shell mounts ?exp=new with an empty experimentOrder view and allocates the id on the first save.
  const view = { ...state, experimentOrder: [] };
  w.CortexLabNotebook.mountDesigner(app, {
    lab,
    state: view,
    experimentId: null,
    onSave: exp => {
      const stored = { ...exp, id: exp.id || 'exp-2' };
      state.experiments[stored.id] = stored;
      if (!state.experimentOrder.includes(stored.id)) state.experimentOrder.push(stored.id);
      return stored;
    },
  });
  const others = app.querySelector('[data-labn-others]');
  assert.equal(others.hidden, false);
  const link = others.querySelector('a[data-lab-go][data-labn-other="exp-1"]');
  assert.equal(link.textContent, 'First idea (draft)');
  assert.equal(link.getAttribute('href'), '/lab?view=designer&exp=exp-1');
  type(field(app, 'title'), 'Second idea');
  await wait();
  assert.equal(new URLSearchParams(w.location.search).get('exp'), 'exp-2', 'a reload now opens this draft');
  assert.equal(new URLSearchParams(w.location.search).get('view'), 'designer');
  assert.ok(!others.querySelector('[data-labn-other="exp-2"]'), 'the open experiment is not listed as another');
  close();
});

test('CC-2: "Make the runs for me" on a never-saved draft saves it first, so the shell gets an id', () => {
  const { w, app, close } = harness();
  const state = freshState();
  const calls = [];
  w.CortexLab = changeShell();
  w.CortexLabNotebook.mountDesigner(app, {
    lab,
    state: { ...state, experimentOrder: [] },
    experimentId: null,
    onSave: exp => {
      calls.push(['save', exp.id]);
      const stored = { ...exp, id: exp.id || 'exp-1' };
      state.experiments[stored.id] = stored;
      return stored;
    },
    onRequestRuns: exp => {
      calls.push(['runs', exp.id]);
      return null;
    },
  });
  app.querySelector('[data-labn-action="wizard-next"]').click();
  const chip = app.querySelector('input[data-labn-chip-input="changed"]');
  chip.value = 'Development time: longer';
  app.querySelector('[data-labn-action="chip-add"][data-labn-list="changed"]').click();
  app.querySelector('[data-labn-action="request-runs"]').click();
  assert.deepEqual(calls, [
    ['save', null],
    ['runs', 'exp-1'],
  ]);
  close();
});

test('CC-4 + K5: no interpretation is stored until the student writes one; clearing it stores null again', async () => {
  const { w, app, type, wait, close } = harness();
  const state = freshState();
  state.experiments['exp-3'] = completeExperiment('exp-3');
  state.experimentOrder = ['exp-3'];
  const saved = [];
  w.CortexLabNotebook.mountDesigner(app, {
    lab,
    state,
    experimentId: 'exp-3',
    onSave: exp => {
      saved.push(exp);
      state.experiments[exp.id] = exp;
      return true;
    },
  });
  app.querySelector('[data-labn-action="reveal"]').click();
  await wait();
  assert.equal(saved[saved.length - 1].status, 'revealed');
  assert.equal(saved[saved.length - 1].interpretation, null);
  assert.ok(w.CortexLabNotebook.exportMarkdown(state, lab).includes('Interpretation: not written'));
  type(field(app, 'interpretation.supports'), 'Something');
  await wait();
  assert.equal(saved[saved.length - 1].interpretation.supports, 'Something');
  type(field(app, 'interpretation.supports'), '');
  await wait();
  assert.equal(saved[saved.length - 1].interpretation, null, 'three empty answers are stored as null');
  assert.ok(w.CortexLabNotebook.exportMarkdown(state, lab).includes('Interpretation: not written'));
  // A stored all-empty object (written by an earlier version) loads as no interpretation.
  state.experiments['exp-2'] = revealedExperiment();
  const handle = w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-2', onSave() {} });
  assert.equal(handle.getExperiment().interpretation, null);
  close();
});

test('F19 + F11 + KB-21: a finished interpretation says "Experiment done" under the form, with a link to the report', () => {
  const { w, app, type, close } = harness();
  const state = freshState();
  state.experiments['exp-2'] = revealedExperiment();
  state.experimentOrder = ['exp-2'];
  w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-2', onSave() {} });
  const line = app.querySelector('[data-labn-done-line]'),
    link = app.querySelector('a[data-labn-report-link]');
  assert.equal(line.getAttribute('role'), 'status');
  assert.equal(line.textContent, '');
  assert.equal(link.hidden, true);
  const form = app.querySelector('.labn-interpretation');
  assert.ok(form.compareDocumentPosition(line) & w.Node.DOCUMENT_POSITION_FOLLOWING, 'the line sits under the form');
  type(field(app, 'interpretation.supports'), 's');
  type(field(app, 'interpretation.failsToEstablish'), 'f');
  type(field(app, 'interpretation.next'), 'n');
  assert.equal(line.textContent, 'Experiment done. It is in your report, in the Experiment log.');
  assert.equal(link.hidden, false);
  assert.equal(link.textContent, 'Go to My report');
  assert.ok(link.classList.contains('btn-solid') && link.hasAttribute('data-lab-go'));
  assert.equal(link.getAttribute('href'), '/lab?view=notebook');
  type(field(app, 'interpretation.next'), '');
  assert.equal(line.textContent, '');
  assert.equal(link.hidden, true);
  close();
});

test('F10 + F18 + KB-08: the comparison shows both simulated pictures and a microscope link; the count matches', () => {
  const { w, app, close } = harness();
  const painted = [];
  w.CortexLabMicroscope = { renderSynthetic: (canvas, opts) => painted.push(opts) };
  const state = freshState();
  state.experiments['exp-2'] = revealedExperiment();
  state.experimentOrder = ['exp-2'];
  w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-2', onSave() {} });
  assert.ok(
    step(app, 2)
      .querySelector('.labn-lede')
      .textContent.includes('what the teaching model gives for your experimental run next to your baseline')
  );
  assert.ok(!step(app, 2).textContent.includes('simulated picture of your experimental run'));
  assert.equal(
    step(app, 2).textContent.split('never says which explanation is right').length - 1,
    1,
    'the honesty note appears once on the screen'
  );
  const figures = app.querySelectorAll('.labn-compare [data-labn-thumbs] figure');
  assert.deepEqual(texts(app.querySelectorAll('.labn-compare figcaption')), [
    'Baseline: Run base',
    'Experimental: Run ext',
  ]);
  assert.equal(figures.length, 2);
  assert.equal(painted.length, 2);
  assert.deepEqual(
    painted.map(o => [o.outcome.label, o.tag, o.objective]),
    [
      ['illustrative-synthetic', false, 4],
      ['illustrative-synthetic', false, 4],
    ]
  );
  for (const canvas of app.querySelectorAll('.labn-thumb-canvas'))
    assert.match(canvas.getAttribute('aria-label'), /^Simulated · not a measurement: picture of Run /);
  const scope = app.querySelector('a[data-labn-scope-link]');
  assert.equal(scope.textContent, 'Look at both in the microscope');
  assert.ok(scope.hasAttribute('data-lab-go'));
  assert.deepEqual(
    Object.fromEntries(new URLSearchParams(scope.getAttribute('href').split('?')[1])),
    { view: 'microscope', run: 'base,ext', from: 'designer', exp: 'exp-2', step: '2', at: 'compare' },
    'the microscope knows to come back to this experiment on the last screen, at the comparison'
  );
  close();
  // Without the microscope module: no picture, still the link; a Not modeled pair never gets a picture.
  const second = harness();
  const s2 = freshState();
  s2.runs.w = fullRun('w', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } });
  s2.experiments['exp-2'] = { ...revealedExperiment(), experimentalRunId: 'w' };
  second.w.CortexLabMicroscope = { renderSynthetic: () => assert.fail('no picture for a Not modeled run') };
  second.w.CortexLabNotebook.mountDesigner(second.app, { lab, state: s2, experimentId: 'exp-2', onSave() {} });
  assert.equal(second.app.querySelectorAll('[data-labn-thumbs]').length, 0);
  assert.ok(second.app.querySelector('a[data-labn-scope-link]'));
  second.close();
});

test('UX-SMALL: designer links to the microscope go through CortexLab.url and follow the wizard step', () => {
  const { w, app, close } = harness();
  const built = [];
  w.CortexLab = {
    words: {},
    url: params => {
      built.push({ ...params });
      return `/lab?${new w.URLSearchParams(Object.entries(params).filter(([, v]) => v !== null && v !== undefined)).toString()}`;
    },
  };
  const state = freshState();
  state.experiments['exp-2'] = revealedExperiment();
  state.experimentOrder = ['exp-2'];
  w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-2', onSave() {} });
  const links = Array.from(app.querySelectorAll('a[data-labn-scope-runs]'));
  assert.ok(links.length >= 1, 'the comparison link at least');
  const params = link => Object.fromEntries(new URLSearchParams(link.getAttribute('href').split('?')[1]));
  for (const link of links) {
    assert.ok(link.hasAttribute('data-lab-go'), 'the shell routes it');
    assert.deepEqual(params(link), {
      view: 'microscope',
      run: 'base,ext',
      from: 'designer',
      exp: 'exp-2',
      step: '2',
      at: link.getAttribute('data-labn-scope-at'),
    });
  }
  assert.ok(built.length >= links.length, 'built by the shell');
  // A step change (and a click) rewrites the step the microscope returns to.
  app.querySelector('[data-labn-action="wizard-go"][data-labn-step="1"]').click();
  for (const link of links) assert.equal(params(link).step, '1');
  app.querySelector('[data-labn-action="wizard-go"][data-labn-step="2"]').click();
  const event = new w.MouseEvent('click', { bubbles: true, cancelable: true });
  links[0].dispatchEvent(event);
  assert.equal(params(links[0]).step, '2');
  assert.equal(event.defaultPrevented, false, 'the module leaves the navigation to the shell (or the browser)');
  // With the shell's openMicroscope, a plain click opens the microscope through it with the same keys;
  // a modified click (new tab) is left to the browser and the href.
  const opened = [];
  w.CortexLab.openMicroscope = opts => opened.push(JSON.parse(JSON.stringify(opts)));
  const plainClick = new w.MouseEvent('click', { bubbles: true, cancelable: true });
  links[0].dispatchEvent(plainClick);
  assert.equal(plainClick.defaultPrevented, true);
  assert.deepEqual(opened, [
    {
      runIds: ['base', 'ext'],
      from: 'designer',
      exp: 'exp-2',
      step: 2,
      at: links[0].getAttribute('data-labn-scope-at'),
    },
  ]);
  const newTab = new w.MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
  links[0].dispatchEvent(newTab);
  assert.equal(newTab.defaultPrevented, false);
  assert.equal(opened.length, 1);
  delete w.CortexLab.openMicroscope;
  // A shell url() that fails falls back to the module's own link, keys included.
  w.CortexLab.url = () => {
    throw new Error('nope');
  };
  app.querySelector('[data-labn-action="wizard-go"][data-labn-step="1"]').click();
  assert.deepEqual(params(links[0]), {
    view: 'microscope',
    run: 'base,ext',
    from: 'designer',
    exp: 'exp-2',
    step: '1',
    at: links[0].getAttribute('data-labn-scope-at'),
  });
  close();
});
test('HON-2 + HON-9: runs say compare only and done out of order; a pretreatment value prints as plain words; flags reach the cards', () => {
  const { w, app, close } = harness('notebook');
  const state = freshState();
  const order = ['development', ...S.STEPS.filter(st => st !== 'development')];
  state.runs.ooo = perform(
    lab.createRun({ id: 'ooo', specimenId: 'SPEC-SYN-AD-01', method: 'bielschowsky-modified' }),
    order
  );
  state.runs.temp = fullRun('temp', 'SPEC-SYN-AD-01', { impregnation: { temperature: 'deviated' } });
  state.runs.cps = lab.createRun({ id: 'cps', specimenId: 'SPEC-SYN-AD-01', method: 'cps-i' });
  state.runs.probe = fullRun('probe', 'SPEC-SYN-AD-01', { pretreatment: 'probe-placeholder-1' });
  state.runOrder.push('ooo', 'temp', 'cps', 'probe');
  w.CortexLabNotebook.mountNotebook(app, { lab, state, onAdd() {}, onRemove() {}, onExport() {} });
  const item = ref => app.querySelector(`[data-labn-work="run"][data-labn-ref="${ref}"]`);
  const title = ref => item(ref).querySelector('.labn-work-title').textContent;
  assert.match(title('ooo'), /Done out of order: /);
  assert.ok(!title('ooo').includes('standard (per procedure)'), title('ooo'));
  assert.equal(item('ooo').querySelectorAll('[data-labn-flag]').length, 0, 'the name already says it');
  assert.match(title('cps'), / · compare only$/);
  assert.ok(!title('cps').includes('standard (per procedure)'), title('cps'));
  // MODE-notebook (§11.7): no "(pending instructor)" anywhere; the value prints as plain words.
  assert.ok(title('probe').includes('Pretreatment: probe placeholder 1'), title('probe'));
  assert.ok(!/pending|instructor/i.test(title('probe')), title('probe'));
  assert.match(item('probe').querySelector('.labn-work-needs').textContent, /^What the model would need: /);
  assert.equal(
    item('temp').querySelector('[data-labn-flag]').textContent,
    'Low confidence: the impregnation temperature changed, and the model has no direction for that change.'
  );
  close();
  // Designer: the experimental card shows the same flag on its face, not only under Why?.
  const d = harness();
  const s2 = freshState();
  s2.runs.ooo = state.runs.ooo;
  s2.experiments['exp-2'] = { ...revealedExperiment(), experimentalRunId: 'ooo' };
  d.w.CortexLabNotebook.mountDesigner(d.app, { lab, state: s2, experimentId: 'exp-2', onSave() {} });
  const flag = d.app.querySelector('.labn-card [data-labn-flag]');
  assert.match(flag.textContent, /^Done out of order: .+\.$/);
  assert.equal(flag.closest('[hidden]'), null, 'visible on the card face');
  d.close();
  // The shell's helpers win when lab.js provides them.
  const e = harness('notebook');
  e.w.CortexLab = { flags: () => ['SHELL flag.'], valueText: (path, v) => `SHELL ${path}=${v}` };
  e.w.CortexLabNotebook.mountNotebook(e.app, { lab, state, onAdd() {}, onRemove() {}, onExport() {} });
  assert.ok(e.app.querySelector('[data-labn-ref="temp"] [data-labn-flag]').textContent === 'SHELL flag.');
  assert.ok(
    e.app.querySelector('[data-labn-ref="probe"]').textContent.includes('SHELL pretreatment=probe-placeholder-1')
  );
  e.close();
});

test('F4 + F6 + KB-09 (SIMPLE-notebook): one quiet Download block; each lab-work row says if it is in the file', () => {
  const { w, app, type, close } = harness('notebook');
  const state = freshState();
  state.runs.w = fullRun('w', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } });
  state.runs.lone = fullRun('lone', 'SPEC-SYN-AD-02');
  state.runOrder.push('w', 'lone');
  state.experiments['exp-1'] = { ...revealedExperiment('exp-1'), status: 'done' };
  state.experimentOrder = ['exp-1'];
  state.measurements.m1 = {
    id: 'm1',
    measurementId: 'contrast-ordinal',
    runId: 'lone',
    label: 'illustrative-synthetic',
    value: 2,
    unit: 'ordinal',
    manual: false,
  };
  state.measurementOrder = ['m1'];
  const before = w.CortexLabNotebook.exportMarkdown(state, lab);
  w.CortexLabNotebook.mountNotebook(app, {
    lab,
    state,
    onAdd: entry => {
      state.notebook = lab.addEntry(state.notebook, entry, state.runs);
      state.counters.entry += 1;
      return entry;
    },
    onRemove() {},
    onExport() {},
  });
  assert.equal(
    app.querySelector('.labn-lede').textContent,
    'Your notes, your lab work and the notes you add to the five report sections all go into one file you can download.'
  );
  assert.ok(!app.textContent.includes('collected for you'), 'no promise that the lab work is in the report');
  // The counts box, its "Not in your file yet" line and the two long paragraphs are gone: one primary
  // button, a quiet More, one honesty line, after the report.
  const panel = app.querySelector('[data-labn-file]');
  assert.ok(panel.contains(app.querySelector('#labn-export')));
  assert.equal(panel.querySelector('[data-labn-file-list]'), null);
  assert.equal(panel.querySelector('[data-labn-file-missing]'), null);
  assert.equal(app.querySelector('.labn-file-lead'), null);
  assert.equal(
    panel.querySelector('[data-labn-file-honesty]').textContent,
    'The file starts with a note that every simulated line comes from a teaching model, not the lab.'
  );
  assert.deepEqual(texts(panel.querySelectorAll('button')).slice(0, 2), [
    'Download my report (.md)',
    'More ways to save the report',
  ]);
  assert.ok(
    app.querySelector('[data-labn-entries]').compareDocumentPosition(panel) & w.Node.DOCUMENT_POSITION_FOLLOWING,
    'the download block closes the page'
  );
  const headings = texts(app.querySelectorAll('h2'));
  assert.deepEqual(headings, ['Notes', 'Your lab work', 'Your report']);
  assert.equal(app.querySelector('[data-labn-notepad]').hidden, true, 'no shell notepad: the Notes block hides');
  // Each lab-work row still says, as data, whether the file holds it; no sentence about it.
  const mark = ref => app.querySelector(`[data-labn-work][data-labn-ref="${ref}"]`);
  assert.equal(mark('base').getAttribute('data-labn-in-file'), 'yes');
  assert.equal(mark('lone').getAttribute('data-labn-in-file'), 'no');
  assert.equal(mark('m1').getAttribute('data-labn-in-file'), 'no');
  assert.equal(mark('exp-1').getAttribute('data-labn-in-file'), 'yes');
  assert.ok(!app.textContent.includes('In your file'), 'no file sentence per row');
  assert.equal(app.querySelectorAll('.labn-work-file').length, 0);
  for (const row of app.querySelectorAll('[data-labn-work]')) {
    assert.ok(row.querySelector('.labn-work-title'), 'a title');
    assert.ok(row.querySelector('.labn-work-line'), 'a readout under it');
    assert.equal(row.querySelectorAll('[data-labn-action="note-about"]').length, 1, 'one note link');
  }
  assert.equal(w.CortexLabNotebook.exportMarkdown(state, lab), before, 'rendering changes nothing in the export');
  // A note about the measurement starts with its value, and both it and its run then count as in the file.
  app.querySelector('[data-labn-ref="m1"] [data-labn-action="note-about"]').click();
  const text = app.querySelector('textarea[data-labn-draft="text"]');
  assert.equal(text.value, 'About the Target/background contrast measurement, low on the model scale: ');
  type(text, `${text.value}the contrast stayed low.`);
  app.querySelector('[data-labn-add-form]').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(mark('m1').getAttribute('data-labn-in-file'), 'yes');
  assert.equal(mark('lone').getAttribute('data-labn-in-file'), 'yes');
  // The one section that now holds a note is the only one shown.
  assert.deepEqual(texts(app.querySelectorAll('.labn-section h3')), ['Outcomes and limitations']);
  assert.ok(
    w.CortexLabNotebook.exportMarkdown(state, lab).includes('low on the model scale: the contrast stayed low.')
  );
  close();
});

test('KB-22 + A11Y-11: report headings sit one level under the page h1; headingLevel moves them', () => {
  for (const [level, top, sub] of [
    [undefined, 'H2', 'H3'],
    [3, 'H3', 'H4'],
  ]) {
    const { w, app, close } = harness('notebook');
    w.CortexLabNotebook.mountNotebook(app, {
      lab,
      state: notebookState(),
      headingLevel: level,
      onAdd() {},
      onRemove() {},
      onExport() {},
    });
    const tags = Array.from(app.querySelectorAll('h1, h2, h3, h4, h5')).map(n => n.tagName);
    // Notes, Your lab work, Your report; then the add form's heading and one per section that holds a note.
    assert.deepEqual(tags, [top, top, top, sub, sub, sub, sub, sub], `headingLevel ${level}`);
    close();
  }
});

test('F13 + KB-23: the file is named for the page and the module downloads the same bytes', () => {
  const { w, app, close } = harness('notebook');
  const state = notebookState();
  let blob = null,
    name = null;
  w.URL.createObjectURL = b => ((blob = b), 'blob:report');
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () {
    name = this.getAttribute('download');
  };
  w.CortexLabNotebook.mountNotebook(app, { lab, state, onAdd() {}, onRemove() {}, onExport: () => undefined });
  app.querySelector('#labn-export').click();
  assert.equal(name, 'my-lab-report.md');
  assert.equal(w.CortexLabNotebook.fileName, 'my-lab-report.md');
  assert.equal(app.querySelector('[data-labn-export-status]').textContent, 'Report file ready: my-lab-report.md');
  assert.ok(blob, 'a file was made');
  close();
});

test('A11Y-13: designer check rows and the step buttons reach 44px at 768px and below', () => {
  const css = fs.readFileSync(path.join(ROOT, 'lab-notebook.css'), 'utf8');
  const touch = css.slice(css.indexOf('@media (max-width: 768px)'));
  const block = touch.slice(0, touch.indexOf('\n}\n'));
  for (const sel of ['.labn-check-title', '.labn-progress-btn'])
    assert.match(block, new RegExp(`${sel.replace('.', '\\.')}[^{]*\\{[^}]*min-height: 44px`), sel);
  assert.ok(!css.includes('.labn-btn-quiet'), 'CC-13: the dead rule is gone');
});

test('verify: the shell comparison badge and assumption note (once per screen), step titles in what the model would need, a revealed proposal whose run is gone', () => {
  const { w, app, close } = harness();
  w.CortexLab = {
    badgeForComparison: () => '<span class="lab-badge" data-lab-badge="simulated">SHELL comparison</span>',
    assumptionNote: result => (result && 'baseline' in result ? 'SHELL change note' : ''),
  };
  let state = freshState();
  state.experiments['exp-2'] = revealedExperiment();
  state.experimentOrder = ['exp-2'];
  let handle = w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-2', onSave() {} });
  const compare = app.querySelector('.labn-compare');
  assert.equal(compare.querySelector('[data-lab-badge]').textContent, 'SHELL comparison');
  assert.equal(compare.querySelector('[data-lab-badge]').getAttribute('data-lab-label'), 'illustrative-synthetic');
  assert.match(compare.querySelector('[data-labn-plain]').textContent, /on the model scale \(SHELL change note\)\.$/);
  const card = app.querySelector('.labn-card [data-labn-plain]').textContent;
  assert.match(card, /The background rose to low \(from trace\); contrast is low\./);
  assert.doesNotMatch(card, /SHELL change note/, 'the comparison line carries the note, the card does not repeat it');
  handle.destroy();
  // HON-5: a step the run still needs reads as the step's student title, not its id.
  const method = lab.getMethod('bielschowsky-modified');
  state = freshState();
  state.runs.part = perform(
    lab.createRun({ id: 'part', specimenId: 'SPEC-SYN-AD-01', method: 'bielschowsky-modified' }),
    S.STEPS.slice(0, 8)
  );
  state.runOrder.push('part');
  state.experiments['exp-2'] = { ...revealedExperiment(), experimentalRunId: 'part' };
  state.experimentOrder = ['exp-2'];
  handle = w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-2', onSave() {} });
  const needed = texts(app.querySelectorAll('.labn-needed li'));
  const last = method.steps.find(s => s.id === S.STEPS[8]);
  assert.ok(needed.includes(`the step “${last.studentTitle || last.title}”`), JSON.stringify(needed));
  assert.ok(!needed.some(x => /step event|\b[a-z]+-[a-z]+-[a-z]+\b/.test(x)), JSON.stringify(needed));
  handle.destroy();
  // CC-14: a revealed proposal whose run was removed says so in its own words.
  state = freshState();
  delete state.runs.ext;
  state.runOrder = ['base'];
  state.experiments['exp-2'] = revealedExperiment();
  state.experimentOrder = ['exp-2'];
  handle = w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-2', onSave() {} });
  assert.equal(
    app.querySelector('[data-labn-run-summary="experimentalRunId"]').textContent,
    "This proposal's run is no longer in your runs."
  );
  handle.destroy();
  close();
});

// ---- UX-R2 (student re-walk 2026-10-11): RC-1 measures in the reveal, plain Why?, glosses ----------
// lab.js's plain-word pairs, read from its source, so the notebook's private copies are pinned to them.
const LAB_SOURCE = fs.readFileSync(path.join(ROOT, 'lab.js'), 'utf8');
function labPairs(name) {
  const start = LAB_SOURCE.indexOf(`const ${name} = [`);
  assert.ok(start >= 0, `lab.js declares ${name}`);
  const open = LAB_SOURCE.indexOf('[', start);
  let depth = 0;
  for (let i = open; i < LAB_SOURCE.length; i++) {
    if (LAB_SOURCE[i] === '[') depth++;
    else if (LAB_SOURCE[i] === ']' && --depth === 0) return vm.runInNewContext(LAB_SOURCE.slice(open, i + 1));
  }
  throw new Error(`unterminated ${name}`);
}
const applyPairs = (pairs, text) => pairs.reduce((out, [from, to]) => out.replace(from, to), String(text));
function measuresExperiment(measures, experimentalRunId = 'ext') {
  return { ...revealedExperiment(), measures, experimentalRunId };
}
const measuresBlock = app => app.querySelector('[data-labn-measures-out]');
const measureItem = (app, id) => app.querySelector(`[data-labn-measure-out="${id}"]`);

test('UX-R2 RC-1: the reveal states each chosen measure for both runs, before the cards', () => {
  const { w, app, close } = harness();
  const state = freshState();
  state.runs.other = fullRun('other', 'SPEC-SYN-AD-02');
  state.runOrder.push('other');
  state.measurements = {
    'measurement-1': {
      id: 'measurement-1',
      measurementId: 'contrast-ordinal',
      runId: 'ext',
      label: 'illustrative-synthetic',
      value: 2,
      unit: 'ordinal',
      manual: false,
    },
    'measurement-2': {
      id: 'measurement-2',
      measurementId: 'roi-lesion-count',
      runId: 'base',
      label: 'illustrative-synthetic',
      value: 12,
      unit: 'count',
      manual: true,
    },
    // Another run's measurement never shows under this experiment.
    'measurement-3': {
      id: 'measurement-3',
      measurementId: 'roi-lesion-count',
      runId: 'other',
      label: 'illustrative-synthetic',
      value: 99,
      unit: 'count',
      manual: true,
    },
  };
  state.measurementOrder = ['measurement-1', 'measurement-2', 'measurement-3'];
  state.experiments['exp-2'] = measuresExperiment(['contrast-ordinal', 'roi-lesion-count', 'artifact-area']);
  state.experimentOrder = ['exp-2'];
  let handle = w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-2', onSave() {} });
  const block = measuresBlock(app);
  assert.ok(block, 'a "Your outcome measures" block');
  assert.equal(block.querySelector('h4').textContent, 'Your outcome measures');
  assert.ok(
    block.compareDocumentPosition(app.querySelector('.labn-card')) & w.Node.DOCUMENT_POSITION_FOLLOWING,
    'the block comes before the cards'
  );
  assert.equal(
    block.querySelector('.labn-card-head [data-lab-badge]').getAttribute('data-lab-label'),
    'illustrative-synthetic'
  );
  assert.deepEqual(
    Array.from(block.querySelectorAll('[data-labn-measure-out]')).map(n => n.getAttribute('data-labn-measure-out')),
    ['contrast-ordinal', 'roi-lesion-count', 'artifact-area'],
    'one item per chosen measure, in the order chosen'
  );
  // Longer development: every structure and the background move up 1 step, so contrast does not change.
  const contrast = measureItem(app, 'contrast-ordinal');
  assert.equal(
    contrast.querySelector('[data-labn-measure-line]').textContent,
    'Target/background contrast: low in both runs (no change on the model scale).'
  );
  assert.equal(
    contrast.querySelector('.labn-measure-sub').textContent,
    'Background: trace in the baseline, low in the experimental run (up 1 step on the model scale).'
  );
  assert.equal(
    contrast.querySelector('[data-labn-recorded="measurement-1"]').textContent.trim().split(' Simulated')[0],
    'Recorded for the experimental run: low (model scale)'
  );
  // A hand-recorded measure has no model value: a link to both runs in the microscope.
  const roi = measureItem(app, 'roi-lesion-count');
  assert.match(
    roi.querySelector('[data-labn-measure-line]').textContent,
    /^Predefined-region lesion count: the model gives no value for this; measure it yourself\. Open both runs in the microscope/
  );
  const link = roi.querySelector('a[data-labn-measure-scope="roi-lesion-count"]');
  assert.ok(link.hasAttribute('data-lab-go'));
  const query = new URLSearchParams(link.getAttribute('href').split('?')[1]);
  assert.equal(query.get('view'), 'microscope');
  assert.equal(query.get('run'), 'base,ext');
  assert.equal(query.get('from'), 'designer');
  assert.equal(query.get('exp'), 'exp-2');
  assert.equal(query.get('step'), '2');
  const recorded = roi.querySelectorAll('[data-labn-recorded]');
  assert.equal(recorded.length, 1, 'only measurements of these two runs');
  assert.ok(recorded[0].textContent.startsWith('Recorded for the baseline run: 12 (count), by hand'));
  const badge = recorded[0].querySelector('[data-lab-badge]');
  assert.equal(badge.getAttribute('data-lab-badge'), 'simulated');
  assert.equal(badge.getAttribute('data-lab-label'), 'illustrative-synthetic');
  assert.equal(
    measureItem(app, 'artifact-area').querySelector('.labn-measure-sub').textContent,
    'Nothing recorded for these two runs yet.'
  );
  assert.doesNotMatch(visibleText(block), ENGINE_WORDS);
  assert.doesNotMatch(visibleText(block), /\b(results?|data|predicts?|supports?|proves?)\b/i);
  // The comparison's microscope link is still the first data-labn-scope-link on the page.
  assert.equal(app.querySelector('a[data-labn-scope-link]').textContent, 'Look at both in the microscope');
  handle.destroy();

  // A stronger developer darkens the background and not the targets: contrast goes down a step.
  state.runs.strong = fullRun('strong', 'SPEC-SYN-AD-01', { development: { strength: 'strong' } });
  state.experiments['exp-2'] = measuresExperiment(['contrast-ordinal'], 'strong');
  handle = w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-2', onSave() {} });
  assert.equal(
    measureItem(app, 'contrast-ordinal').querySelector('[data-labn-measure-line]').textContent,
    'Target/background contrast: low in the baseline, trace in the experimental run (down 1 step on the model scale).'
  );
  handle.destroy();

  // A Not modeled experimental run gives no model value, and says why.
  state.runs.w = fullRun('w', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } });
  state.experiments['exp-2'] = measuresExperiment(['contrast-ordinal'], 'w');
  handle = w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-2', onSave() {} });
  const notModeled = measureItem(app, 'contrast-ordinal');
  assert.equal(
    notModeled.querySelector('[data-labn-measure-line]').textContent,
    'Target/background contrast: no model value, because the experimental run is Not modeled.'
  );
  assert.equal(notModeled.querySelector('.labn-measure-sub'), null, 'no background line without both values');
  assert.equal(measuresBlock(app).querySelector('[data-lab-badge]').getAttribute('data-lab-label'), 'no-basis');
  handle.destroy();
  close();
});

test('UX-R2: the designer Why? is in plain words; engine wording and ids sit only under the nested Sources', () => {
  const { w, app, close } = harness();
  const state = freshState();
  state.experiments['exp-2'] = revealedExperiment();
  state.experimentOrder = ['exp-2'];
  let handle = w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-2', onSave() {} });
  const whys = Array.from(app.querySelectorAll('[data-labn-reveal] [data-labn-why]'));
  assert.equal(whys.length, 2, 'the card and the comparison');
  for (const button of whys) button.click();
  const RAW =
    /sop-default|ordinal|\bv1\b|\b[RCS]-[a-z]|registry|schematic|uncertainty card|development\.endpoint|\bSOP\b/;
  for (const panel of app.querySelectorAll('[data-labn-reveal] .labn-why')) {
    assert.equal(panel.hidden, false);
    const seen = visibleText(panel);
    assert.doesNotMatch(seen, RAW, seen.match(RAW)?.[0]);
    const sources = panel.querySelector('[data-labn-sources]');
    assert.ok(sources, 'a nested Sources disclosure');
    assert.equal(sources.textContent, 'Sources');
    assert.equal(sources.getAttribute('aria-expanded'), 'false');
    assert.equal(panel.querySelector('.labn-why-sources').hidden, true);
  }
  const card = app.querySelector('.labn-card');
  assert.match(
    card.querySelector('[data-labn-contrast]').textContent,
    /^Contrast: low \(model scale\): how many steps the darkest structure sits above the background/
  );
  const cardSources = card.querySelector('.labn-why-sources');
  assert.ok(cardSources.querySelector('.labn-card-body').textContent.includes('schematic ordinal'));
  assert.match(cardSources.textContent, /Rules applied: R-model-01, /);
  const compare = app.querySelector('.labn-compare');
  const compareSources = compare.querySelector('.labn-why-sources');
  assert.match(compareSources.textContent, /Changed settings: development\.endpoint/);
  assert.match(compareSources.textContent, /Rules responsible: R-model-03, R-model-04, R-model-06/);
  assert.ok(compareSources.textContent.includes('sop-default'), 'the engine caveats, as written, under Sources');
  // The same plain words as the bench (lab.js LAB_EFFECT_WORDS / LAB_CAVEAT_WORDS).
  const cmp = lab.compare(state.runs.base, state.runs.ext);
  assert.deepEqual(
    texts(compare.querySelectorAll('[data-labn-keep] li')),
    cmp.caveats.map(c => applyPairs(labPairs('LAB_CAVEAT_WORDS'), c))
  );
  const titles = Array.from(compare.querySelectorAll('.labn-why > .labn-list:not([data-labn-keep]) li'));
  assert.deepEqual(
    texts(titles),
    cmp.rulesResponsible.map(id => applyPairs(labPairs('LAB_EFFECT_WORDS'), lab.getRule(id).title))
  );
  handle.destroy();

  // lab.js's own plainRule / plainCaveat win when it exports them.
  w.CortexLab = { plainRule: () => 'SHELL rule', plainCaveat: () => 'SHELL caveat' };
  handle = w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-2', onSave() {} });
  assert.ok(texts(app.querySelectorAll('.labn-compare [data-labn-keep] li')).every(t => t === 'SHELL caveat'));
  assert.ok(
    texts(app.querySelectorAll('.labn-compare .labn-why > .labn-list:not([data-labn-keep]) li')).every(
      t => t === 'SHELL rule'
    )
  );
  handle.destroy();
  delete w.CortexLab;

  // A Not modeled side: the comparison caveat names the run, not its id or the engine code.
  state.runs.w = fullRun('w', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } });
  state.experiments['exp-2'] = { ...revealedExperiment(), experimentalRunId: 'w' };
  handle = w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-2', onSave() {} });
  const keep = texts(app.querySelectorAll('.labn-compare [data-labn-keep] li'));
  assert.ok(keep[0].startsWith('Run w: Not modeled, so no difference is computed. '), keep[0]);
  assert.doesNotMatch(keep.join(' '), /uncertainty card|param-uncovered/);
  assert.ok(app.querySelector('.labn-card .labn-why-sources .labn-card-body'), 'the card text under Sources');
  assert.match(app.querySelector('.labn-card .labn-why-sources').textContent, /Rules consulted: /);
  handle.destroy();
  close();
});

test('UX-R2: the four explanations gloss their jargon; the opposite prediction takes a procedure answer', () => {
  const { w, app, close } = harness();
  w.CortexLabNotebook.mountDesigner(app, { lab, state: freshState(), experimentId: 'exp-1', onSave() {} });
  const items = Array.from(step(app, 1).querySelectorAll('.labn-hint-list li'));
  assert.equal(items.length, 4);
  // SIMPLE-notebook: the glossary is folded under one line until the student opens it.
  const glossary = app.querySelector('button[data-labn-toggle="glossary"]');
  assert.equal(glossary.textContent, 'The four explanations the course raises');
  assert.equal(glossary.getAttribute('aria-expanded'), 'false');
  assert.equal(items[0].closest('.labn-disclosure').hidden, true);
  glossary.click();
  assert.equal(items[0].closest('.labn-disclosure').hidden, false);
  assert.equal(glossary.getAttribute('aria-expanded'), 'true');
  const gloss = Object.fromEntries(
    items.map(li => {
      const node = li.querySelector('[data-labn-gloss]');
      return [node.getAttribute('data-labn-gloss'), node.textContent];
    })
  );
  assert.deepEqual(Object.keys(gloss), S.HYPOTHESES);
  assert.match(gloss['H-fixation-carbonyl'], /^Carbonyls: a kind of chemical group\. Fixation-related: /);
  assert.equal(gloss['H-endogenous-carbonyl'], 'Endogenous: already present in the tissue, not created by fixation.');
  assert.match(gloss['H-reduced-metal'], /^Reduced metals: /);
  assert.match(gloss['H-other-reduction-site'], /^Other reduction sites: /);
  // Definitions only: no gloss says an explanation is right, likely or shown.
  for (const text of Object.values(gloss))
    assert.doesNotMatch(text, /\b(true|right|correct|likely|shown|proven|established|the reduction sites)\b/i, text);
  items.forEach((li, i) => assert.ok(li.textContent.startsWith(S.HYPOTHESIS_TEXT[S.HYPOTHESES[i]])));
  // Predict: the "which of the four explanations" part accepts "none of the four" for a procedure test.
  const opposite = field(app, 'predictions.opposite');
  const note = step(app, 2).querySelector('[data-labn-procedure-note]');
  assert.match(note.textContent, /None of the four: my hypothesis is about the procedure/);
  const described = opposite
    .getAttribute('aria-describedby')
    .split(' ')
    .map(id => w.document.getElementById(id));
  assert.ok(
    described.some(node => node && node.contains(note)),
    'the note describes the field'
  );
  // Leads never say the student has seen no picture yet (the bench shows pictures first).
  const lede = step(app, 2).querySelector('.labn-lede').textContent;
  assert.doesNotMatch(lede, /before you see/);
  assert.match(lede, /before you reveal what the teaching model gives for your experimental run/);
  close();
});

// ---- UX-POLISH (final student check 2026-10-12): export v2 words, plain-text copy, one set of outcome
// names, sealed runs, and the way back from the microscope landing where the student left ----------
test('UX-POLISH: the export takes the v2 formatters (lab.js words + the module words) and keeps every label', () => {
  const { w, close } = harness('notebook');
  const state = notebookState();
  state.experiments['exp-1'].controls.push(
    { type: 'baseline-process', addresses: 'day-to-day drift' },
    { type: 'mystery-control', addresses: 'z' }
  );
  let seen = null;
  const spy = {
    ...lab,
    exportNotebook: (input, options) => {
      seen = options;
      return lab.exportNotebook(input, options);
    },
  };
  const summaries = [];
  w.CortexLab = {
    words: {},
    runTitle: run => `Trial ${run.id}`,
    paramText: (p, v) => `${p} is ${v}`,
    stepTitle: id => `Step called ${id}`,
    summarize: o => {
      summaries.push(o.label);
      return o.label === S.LABELS.SYNTHETIC
        ? `Plain summary: contrast is ${S.ORDINAL_TEXT[o.contrast]}.`
        : 'Not modeled: the model has no rule for this change.';
    },
  };
  const md = w.CortexLabNotebook.exportMarkdown(state, spy);
  assert.deepEqual(Object.keys(seen).sort(), [
    'controlText',
    'isSealed',
    'methodTitle',
    'outcomeText',
    'paramText',
    'runTitle',
    'specimenTitle',
    'stepTitle',
    'strengthText',
    'title',
  ]);
  // Each module formatter on its own: plain names, undefined (= the engine's default) when unknown.
  assert.equal(seen.specimenTitle('SPEC-SYN-AD-01'), 'Practice specimen A · high burden (not real tissue)');
  assert.equal(
    seen.specimenTitle('SPEC-SYN-NEG-01'),
    'Negative comparison · no plaques or tangles (practice specimen, not real tissue)'
  );
  assert.equal(seen.specimenTitle('SPEC-NOPE'), undefined);
  assert.equal(seen.methodTitle('bielschowsky-modified'), 'Modified Bielschowsky silver stain (course procedure)');
  assert.equal(seen.methodTitle('cps-i'), 'Copper-peroxide-silver, CPS-I (Velasco 1992)');
  assert.equal(seen.methodTitle('nope'), undefined);
  assert.equal(seen.controlText({ type: 'negative-biological', addresses: '' }), 'Negative biological comparison');
  assert.equal(seen.controlText({ type: 'mystery-control', addresses: 'z' }), undefined);
  assert.deepEqual(
    ['published-qualitative', 'schematic-analogy', 'course-handout', 'placeholder', 'hypothesis-conditional', 'x'].map(
      seen.strengthText
    ),
    [
      'published, qualitative',
      'schematic: a model assumption or an analogy',
      'course materials',
      'not yet sourced',
      'conditional on a hypothesis',
      undefined,
    ]
  );
  const lines = md.split('\n');
  // Run blocks (the engine's v3 "- Field:" items): plain specimen / method / settings / steps, and
  // "Summary:" in place of "Description:".
  assert.ok(lines.includes('#### Trial base') && lines.includes('#### Trial ext'));
  assert.equal(lines.filter(l => l === '- Specimen: Practice specimen A · high burden (not real tissue)').length, 2);
  assert.equal(lines.filter(l => l === '- Method: Modified Bielschowsky silver stain (course procedure)').length, 2);
  assert.ok(lines.includes('- Settings changed from standard: development.endpoint is extended'));
  assert.ok(lines.includes('- Settings: all standard (per procedure)'));
  assert.ok(
    lines.some(l => /^\d+\. Step called development$/.test(l)),
    'steps by name'
  );
  const log = lines.slice(lines.indexOf('## Experiment log'), lines.indexOf('## Sources'));
  assert.equal(log.filter(l => l.startsWith('- Summary: ')).length, 2);
  assert.ok(log.includes('- Summary: Plain summary: contrast is low.'));
  assert.equal(log.filter(l => l.startsWith('- Description: ')).length, 0, 'the description moved to the appendix');
  assert.equal(log.filter(l => l === `- Label: ${S.LABEL_TEXT['illustrative-synthetic']}`).length, 2, 'labels stay');
  // The controls in the designer's words with the stand-in note on the specimen-based one only; an unknown
  // type keeps the engine words.
  const controls = lines.find(l => l.startsWith('- Controls: '));
  assert.equal(
    controls,
    `- Controls: Characterized positive control, rules out: that the stain worked at all ${S.STAND_IN_SUFFIX}; Baseline process comparison, rules out: day-to-day drift; mystery-control, addresses: z`
  );
  // Outcome names, one per line, the same as the designer's.
  for (const line of ['- Expected outcome: e', '- Negligible change: n', '- Opposite outcome: o'])
    assert.ok(lines.includes(line), line);
  for (const line of ['- What it supports: s', '- What it fails to establish: f', '- Next experiment: n'])
    assert.ok(lines.includes(line), line);
  // The student's Sources: strengths in words; the codes only under Model detail.
  const sources = lines.slice(lines.indexOf('## Sources'), lines.indexOf('## Model detail (for instructors)'));
  assert.ok(sources.length > 2 && sources.every(l => !/\((published-qualitative|schematic-analogy)\)/.test(l)));
  assert.ok(sources.some(l => l.includes('(published, qualitative)')));
  assert.ok(!/another system/.test(md), 'a schematic claim is never "from another system"');
  // Nothing is lost: the appendix lists each run's label and the engine's description.
  const detail = lines.slice(lines.indexOf('## Model detail (for instructors)'));
  assert.ok(detail.length > 1, 'a Model detail section at the end');
  for (const id of ['base', 'ext']) {
    const at = detail.indexOf(`### Trial ${id}`);
    assert.ok(at > 0, id);
    assert.equal(detail[at + 2], `- Label: ${S.LABEL_TEXT['illustrative-synthetic']}`);
    assert.equal(
      detail[at + 3],
      `- Description: ${lab.describeOutcome(lab.resolve(state.runs[id]), lab.getSpecimen('SPEC-SYN-AD-01'))}`
    );
  }
  // The rest stays the engine's: disclaimer, tags, section order and the "result" check.
  assert.ok(md.includes(S.EXPORT_DISCLAIMER));
  for (const tag of Object.values(S.ENTRY_TAG)) assert.ok(md.includes(tag), tag);
  assert.deepEqual(
    lines.filter(l => l.startsWith('## ')).map(l => l.slice(3)),
    [...S.SECTIONS.map(x => S.SECTION_TEXT[x]), 'Experiment log', 'Sources', 'Model detail (for instructors)']
  );
  // A summary that throws, or that says "results" bare, leaves the engine's Description for that run.
  w.CortexLab.summarize = () => {
    throw new Error('broken');
  };
  const thrown = w.CortexLabNotebook.exportMarkdown(state, lab);
  assert.ok(!thrown.includes('- Summary: ') && thrown.includes('- Description: '));
  assert.ok(!thrown.split('## Model detail (for instructors)')[1].includes('### Trial '), 'no run in the appendix');
  w.CortexLab.summarize = () => 'These are the results.';
  assert.ok(!w.CortexLabNotebook.exportMarkdown(state, lab).includes('Summary: These are the results.'));
  close();
});

test('UX-POLISH: "Copy as plain text" copies the report without Markdown signs; "Copy as Markdown" copies the file', async () => {
  const { w, app, close } = harness('notebook');
  const state = notebookState();
  const md = w.CortexLabNotebook.exportMarkdown(state, lab),
    plain = w.CortexLabNotebook.markdownToPlain(md),
    lines = plain.split('\n');
  assert.ok(!lines.some(l => /^#/.test(l)), 'no Markdown heading signs');
  // UX-LAST: the heading levels stay readable. # and ## in capitals with a blank line after them; ### and
  // #### over a line of dashes; every other line is the file's, line for line.
  assert.equal(lines[0], "MY LAB REPORT: ALZHEIMER'S HISTOLOGY LAB");
  assert.equal(lines[1], '');
  const mdLines = md.split('\n'),
    heads = mdLines.map((l, i) => [/^(#{1,6})\s+(.*)$/.exec(l), i]).filter(([m]) => m);
  let added = 0;
  for (const [m, i] of heads) {
    const text = m[2].trim();
    if (m[1].length <= 2) {
      const at = lines.indexOf(text.toUpperCase());
      assert.ok(at >= 0, text);
      assert.equal(lines[at + 1], '', `a blank line after ${text}`);
      if (mdLines[i + 1] && mdLines[i + 1].trim()) added++;
    } else {
      const at = lines.indexOf(text);
      assert.ok(at >= 0, text);
      assert.equal(lines[at + 1], '-'.repeat(Math.max(3, text.length)), `dashes under ${text}`);
      added++;
    }
  }
  assert.ok(heads.some(([m]) => m[1] === '###') && heads.some(([m]) => m[1] === '####'), 'both levels seen');
  assert.ok(lines.includes('STARTING IDEAS') && lines.includes('EXPERIMENT LOG'));
  assert.equal(lines.length, mdLines.length + added, 'only the heading lines change');
  assert.equal(w.CortexLabNotebook.markdownToPlain('# T\nx'), 'T\n\nx');
  assert.equal(w.CortexLabNotebook.markdownToPlain('## Next steps\n\n(no entries)'), 'NEXT STEPS\n\n(no entries)');
  assert.equal(w.CortexLabNotebook.markdownToPlain('### My test\n\nStatus: done'), 'My test\n-------\n\nStatus: done');
  assert.equal(w.CortexLabNotebook.markdownToPlain('#### Run 2\n'), 'Run 2\n-----\n');
  assert.equal(w.CortexLabNotebook.markdownToPlain('##### Deep'), 'Deep');
  assert.ok(lines.includes('Name: ________') && plain.includes(S.EXPORT_DISCLAIMER), 'name line and disclaimer kept');
  assert.ok(!/\[(Published|Observed|Reflection|Simulated)/.test(plain), 'no bracket tags');
  assert.ok(
    lines.includes('- Simulated (illustrative, not a measurement): Extended development darkened the simulated field.')
  );
  assert.ok(lines.includes('- Reflection: I learned to write predictions first.'));
  assert.ok(lines.includes('- Published: Temperature matters.'));
  assert.ok(lines.includes('- Observed: Slides looked uneven.'));
  assert.ok(
    lines.some(l => /^\s*- Simulated \(illustrative, not a measurement\): Target\/background contrast/.test(l))
  );
  assert.ok(!/<https?:/.test(plain) && plain.includes('https://pubmed.ncbi.nlm.nih.gov/11194935/'), 'bare links');
  assert.ok(lines.includes(`  Run ext, label: ${S.LABEL_TEXT['illustrative-synthetic']}`), 'labels kept word for word');
  // Numbered event lines need no dash; every word of a line other than the signs is unchanged.
  assert.equal(w.CortexLabNotebook.markdownToPlain('- 1. Remove the wax'), '1. Remove the wax');
  assert.equal(w.CortexLabNotebook.markdownToPlain('  - [Reflection] x'), '  - Reflection: x');
  assert.equal(w.CortexLabNotebook.markdownToPlain('- not a [Reflection] tag'), '- not a [Reflection] tag');
  // The More menu: plain text first, then the Markdown copy, then Print; neither copy calls onExport.
  let calls = 0;
  const copied = [];
  Object.defineProperty(w.navigator, 'clipboard', {
    value: { writeText: text => (copied.push(text), Promise.resolve()) },
    configurable: true,
  });
  w.CortexLabNotebook.mountNotebook(app, { lab, state, onAdd() {}, onRemove() {}, onExport: () => (calls += 1) });
  assert.deepEqual(texts(app.querySelectorAll('[data-labn-menu="more"] .labn-menu-item')), [
    'Copy as plain text',
    'Copy as Markdown',
    'Print',
  ]);
  const status = () => app.querySelector('[data-labn-export-status]').textContent;
  app.querySelector('[data-labn-action="more"]').click();
  app.querySelector('[data-labn-action="copy-plain"]').click();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(copied[0], plain);
  assert.equal(status(), 'Report copied as plain text.');
  assert.equal(w.document.activeElement, app.querySelector('[data-labn-action="more"]'), 'focus back on More');
  app.querySelector('[data-labn-action="more"]').click();
  app.querySelector('[data-labn-action="copy"]').click();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(copied[1], md);
  assert.equal(status(), 'Report copied as Markdown.');
  assert.equal(calls, 0);
  assert.equal(app.querySelector('#labn-export').textContent, 'Download my report (.md)');
  assert.equal(
    app.querySelector('.labn-file-hint').textContent,
    'The file starts with a note that every simulated line comes from a teaching model, not the lab.'
  );
  close();
});

test('UX-POLISH: the three outcome names and the three interpretation names are the same in the designer and the export', () => {
  const { w, app, close } = harness();
  const state = freshState();
  state.experiments['exp-2'] = revealedExperiment();
  state.experimentOrder = ['exp-2'];
  w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-2', onSave() {} });
  const NAMES = ['Expected outcome', 'Negligible change', 'Opposite outcome'];
  const labels = ['expected', 'negligible', 'opposite'].map(k =>
    app.querySelector(`label[for="${field(app, `predictions.${k}`).id}"]`).firstChild.textContent.trim()
  );
  assert.deepEqual(labels, NAMES, 'step 3 labels');
  // The locked design on the reveal step names them the same way.
  const summary = visibleText(app.querySelector('[data-labn-summary]'));
  for (const [name, value] of [
    ['Expected outcome', 'e'],
    ['Negligible change', 'n'],
    ['Opposite outcome', 'o'],
  ])
    assert.ok(summary.includes(`${name}: ${value}`), name);
  assert.doesNotMatch(visibleText(app), /Expected change|Almost no change|Opposite change|If you see the change/);
  // Interpretation: the names, with the engine's prompt as the hint the field is described by.
  const INTERP = {
    supports: 'What it supports',
    failsToEstablish: 'What it fails to establish',
    next: 'Next experiment',
  };
  const prompts = lab.reveal(revealedExperiment(), state.runs).cards[0].prompts;
  for (const [key, name] of Object.entries(INTERP)) {
    const area = field(app, `interpretation.${key}`);
    assert.equal(app.querySelector(`label[for="${area.id}"]`).firstChild.textContent.trim(), name);
    const hint = w.document.getElementById(area.getAttribute('aria-describedby'));
    assert.equal(hint.textContent, prompts[key]);
  }
  // The things-left links use the same names.
  close();
  const second = harness();
  second.w.CortexLabNotebook.mountDesigner(second.app, { lab, state: freshState(), experimentId: 'exp-9' });
  assert.deepEqual(texts(second.app.querySelectorAll('.labn-reasons a[data-labn-jump]')).slice(0, 3), NAMES);
  second.close();
  // And the export prints them as the student saw them.
  const s3 = notebookState();
  const md = lab.exportNotebook(
    { notebook: s3.notebook, experiments: [s3.experiments['exp-1']], runsById: s3.runs, measurements: [] },
    {}
  );
  for (const name of [...NAMES, ...Object.values(INTERP)])
    assert.ok(
      md.split('\n').some(l => l.startsWith(`- ${name}: `)),
      `export: ${name}`
    );
});

test('UX-POLISH: a sealed run shows no outcome in the report or the designer until its experiment is revealed', () => {
  const sealedState = () => {
    const state = notebookState();
    state.runs.s1 = fullRun('s1', 'SPEC-SYN-AD-01');
    state.runs.s2 = fullRun('s2', 'SPEC-SYN-AD-01', { development: { endpoint: 'extended' } });
    state.runOrder.push('s1', 's2');
    state.experiments['exp-5'] = {
      ...completeExperiment('exp-5'),
      title: 'Longer development',
      baselineRunId: 's1',
      experimentalRunId: 's2',
    };
    state.experimentOrder.push('exp-5');
    state.sealed = { s1: 'exp-5', s2: 'exp-5' };
    state.measurements.m2 = {
      id: 'm2',
      measurementId: 'contrast-ordinal',
      runId: 's2',
      label: 'illustrative-synthetic',
      value: 3,
      unit: 'ordinal',
      manual: false,
    };
    state.measurementOrder.push('m2');
    state.notebook = lab.addEntry(
      state.notebook,
      {
        id: 'entry-9',
        type: 'simulated',
        section: 'next-steps',
        text: 'I will look at this pair after my predictions.',
        runId: 's2',
        label: 'illustrative-synthetic',
      },
      state.runs
    );
    return state;
  };
  const SEALED = 'Sealed until you reveal “Longer development”. Write your predictions first.';
  const sealedOutcome = lab.resolve(fullRun('s2', 'SPEC-SYN-AD-01', { development: { endpoint: 'extended' } }));
  // ---- the report ----
  const { w, app, close } = harness('notebook');
  const state = sealedState();
  const report = w.CortexLabNotebook.mountNotebook(app, { lab, state, onAdd() {}, onRemove() {}, onExport() {} });
  const item = ref => app.querySelector(`[data-labn-ref="${ref}"]`);
  for (const ref of ['s1', 's2', 'm2']) {
    const node = item(ref);
    assert.ok(node, ref);
    assert.equal(node.querySelectorAll('[data-lab-badge]').length, 0, `${ref}: no badge`);
    assert.equal(node.querySelector('[data-labn-sealed]').textContent, SEALED);
    assert.equal(node.querySelectorAll('.labn-flag, .labn-work-needs').length, 0);
    const link = node.querySelector('a[data-labn-sealed-link]');
    const params = Object.fromEntries(new URLSearchParams(link.getAttribute('href').split('?')[1]));
    assert.deepEqual(params, { view: 'designer', exp: 'exp-5', step: '2' });
    assert.ok(link.hasAttribute('data-lab-go'));
  }
  assert.doesNotMatch(item('m2').textContent, /Value:|moderate|high/, 'no measured value');
  // An unsealed run keeps its badge and summary.
  assert.ok(item('base').querySelector('[data-lab-badge]'));
  assert.ok(!item('base').querySelector('[data-labn-sealed]'));
  // The note on the sealed run: no badge, no summary, the sealed line instead.
  const entry = app.querySelector('[data-labn-entry="entry-9"]');
  assert.equal(entry.querySelectorAll('[data-lab-badge], [data-labn-plain]').length, 0);
  assert.equal(entry.querySelector('[data-labn-sealed]').textContent, SEALED);
  // No outcome words on any sealed item or note (an unsealed run's summary does say them).
  assert.match(item('ext').textContent, /visible silver/);
  for (const node of [item('s1'), item('s2'), item('m2'), entry])
    assert.doesNotMatch(node.textContent, /visible silver|contrast is|background is|Not modeled|Simulated ·/);
  assert.ok(!app.textContent.includes(lab.describeOutcome(sealedOutcome, lab.getSpecimen('SPEC-SYN-AD-01'))));
  // The add form (UX-LAST): a sealed run is listed but cannot be chosen (a note on it would carry its
  // label); forced anyway, its preview says sealed, never its badge, and the note is refused.
  app.querySelector('[data-labn-action="add-menu"]').click();
  app.querySelector('[data-labn-add-type="simulated"]').click();
  const select = app.querySelector('select[data-labn-draft="runId"]');
  for (const id of ['s1', 's2']) {
    const option = select.querySelector(`option[value="${id}"]`);
    assert.equal(option.disabled, true, `${id} cannot be chosen`);
    assert.match(option.textContent, / · sealed until you reveal “Longer development”$/);
  }
  assert.equal(select.querySelector('option[value="ext"]').disabled, false);
  assert.equal(
    app.querySelector('.labn-run-preview').textContent,
    'Your note keeps the label of the run you choose. A sealed run takes no note until you reveal its experiment: write a reflection about it instead.'
  );
  select.value = 's2';
  select.dispatchEvent(new w.Event('change', { bubbles: true }));
  const preview = app.querySelector('.labn-run-preview');
  assert.equal(preview.querySelectorAll('[data-lab-badge]').length, 0);
  assert.equal(preview.querySelector('[data-labn-sealed]').textContent, SEALED);
  const entriesBefore = state.notebook.entries.length;
  app.querySelector('textarea[data-labn-draft="text"]').value = 'A note on the sealed run.';
  app.querySelector('textarea[data-labn-draft="text"]').dispatchEvent(new w.Event('input', { bubbles: true }));
  app.querySelector('[data-labn-add-form]').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  assert.match(
    app.querySelector('[data-labn-add-error]').textContent,
    /^That run is sealed until you reveal “Longer development”/
  );
  assert.equal(state.notebook.entries.length, entriesBefore, 'no note on a sealed run');
  app.querySelector('[data-labn-action="add-cancel"]').click();
  // "Add a note about this" on a sealed run or a value read from one opens a reflection (no run, no label).
  for (const [ref, text] of [
    ['s2', 'About Run 2: '],
    ['m2', 'About the Target/background contrast measurement: '],
  ]) {
    item(ref).querySelector('[data-labn-action="note-about"]').click();
    assert.equal(app.querySelector('[data-labn-form-title]').textContent, 'New reflection', ref);
    assert.equal(app.querySelector('select[data-labn-draft="section"]').value, 'process-decisions', ref);
    assert.equal(app.querySelector('textarea[data-labn-draft="text"]').value, text, ref);
    assert.equal(app.querySelector('select[data-labn-draft="runId"]'), null, `${ref}: no run to pick`);
    app.querySelector('[data-labn-action="add-cancel"]').click();
  }
  // Revealed (or a seal naming a missing experiment): the outcome shows again.
  state.experiments['exp-5'].status = 'revealed';
  report.update({ state });
  assert.ok(item('s2').querySelector('[data-lab-badge]') && !item('s2').querySelector('[data-labn-sealed]'));
  assert.ok(app.querySelector('[data-labn-entry="entry-9"] [data-lab-badge]'));
  state.experiments['exp-5'].status = 'draft';
  state.sealed = { s2: 'exp-gone' };
  report.update({ state });
  assert.ok(item('s2').querySelector('[data-lab-badge]'), 'a seal whose experiment is gone seals nothing');
  state.sealed = { s1: 'exp-5', s2: 'exp-5' };
  state.experiments['exp-5'].experimentalRunId = 'ext';
  report.update({ state });
  assert.ok(item('s2').querySelector('[data-lab-badge]'), 'a run its experiment no longer names is unsealed');
  assert.ok(item('s1').querySelector('[data-labn-sealed]'), 'the run it still names stays sealed');
  close();
  // ---- the designer, on the experiment the runs were made for: "ready (sealed)" ----
  const d = harness();
  const s2 = sealedState();
  d.w.CortexLabNotebook.mountDesigner(d.app, { lab, state: s2, experimentId: 'exp-5', step: 2, onSave() {} });
  const option = (fieldName, id) => field(d.app, fieldName).querySelector(`option[value="${id}"]`).textContent;
  assert.match(option('experimentalRunId', 's2'), / · ready \(sealed\)$/);
  assert.doesNotMatch(option('experimentalRunId', 'base'), /sealed/);
  const summaryNode = d.app.querySelector('[data-labn-run-summary="experimentalRunId"]');
  assert.equal(
    summaryNode.textContent,
    'Ready (sealed): all steps done. You see its outcome when you reveal this experiment.'
  );
  assert.ok(summaryNode.hasAttribute('data-labn-run-sealed'));
  assert.equal(d.app.querySelectorAll('.labn-card, [data-labn-thumbs]').length, 0, 'no outcome before the reveal');
  assert.equal(d.app.querySelector('[data-labn-action="reveal"]').disabled, false, 'its own reveal is open');
  d.close();
  // ---- another draft that picks those runs waits for that reveal ----
  const o = harness();
  const s3 = sealedState();
  s3.experiments['exp-6'] = { ...completeExperiment('exp-6'), baselineRunId: 's1', experimentalRunId: 's2' };
  s3.experimentOrder.push('exp-6');
  o.w.CortexLabNotebook.mountDesigner(o.app, { lab, state: s3, experimentId: 'exp-6', step: 4, onSave() {} });
  assert.equal(lab.canReveal(s3.experiments['exp-6'], s3.runs).ok, true, 'the engine would allow it');
  const button = o.app.querySelector('[data-labn-action="reveal"]');
  assert.equal(button.disabled, true);
  assert.deepEqual(reasonAttrs(o.app), [
    'Run 1 is sealed until you reveal “Longer development”',
    'Run 2 is sealed until you reveal “Longer development”',
  ]);
  button.disabled = false;
  button.click();
  assert.equal(o.app.querySelectorAll('.labn-card').length, 0, 'never a card for a run sealed elsewhere');
  assert.equal(
    o.app.querySelector('[data-labn-run-summary="experimentalRunId"]').textContent,
    'Sealed until you reveal “Longer development”. Choose another run, or reveal that experiment first.'
  );
  o.close();
});

test('UX-POLISH-verify: the file shows no outcome of a sealed run until its experiment is revealed', () => {
  const { w, close } = harness('notebook');
  const state = notebookState();
  state.runs.s1 = fullRun('s1', 'SPEC-SYN-AD-01');
  state.runs.s2 = fullRun('s2', 'SPEC-SYN-AD-01', { development: { endpoint: 'extended' } });
  state.runOrder.push('s1', 's2');
  state.experiments['exp-5'] = {
    ...completeExperiment('exp-5'),
    title: 'Longer development',
    baselineRunId: 's1',
    experimentalRunId: 's2',
  };
  state.experimentOrder.push('exp-5');
  state.sealed = { s1: 'exp-5', s2: 'exp-5' };
  state.measurements.m2 = {
    id: 'm2',
    measurementId: 'contrast-ordinal',
    runId: 's2',
    label: 'illustrative-synthetic',
    value: 3,
    unit: 'ordinal',
    manual: false,
  };
  state.measurementOrder.push('m2');
  w.CortexLab = { words: {}, runTitle: run => `Trial ${run.id}`, summarize: () => 'Plain summary.' };
  // A run's block in the engine's v3 layout: from its heading to the next heading, blank lines dropped.
  const blockOf = (md, id) => {
    const lines = md.split('\n'),
      at = lines.indexOf(`#### Trial ${id}`);
    assert.ok(at > 0, id);
    const next = lines.findIndex((l, i) => i > at && l.startsWith('#'));
    return lines.slice(at, next < 0 ? undefined : next).filter(l => l.trim());
  };
  const detailOf = md =>
    md
      .split('\n## Model detail (for instructors)\n')[1]
      .split('\n')
      .filter(l => l.startsWith('### '));
  const md = w.CortexLabNotebook.exportMarkdown(state, lab);
  for (const id of ['s1', 's2']) {
    const block = blockOf(md, id);
    assert.equal(block.at(-1), 'Sealed until this experiment is revealed.', id);
    assert.ok(
      block.includes('- Settings: all standard (per procedure)') || block.some(l => l.startsWith('- Settings changed'))
    );
    assert.ok(!block.some(l => /^- (Label|Summary|Description|Measurements):/.test(l) || l.startsWith('  - ')), id);
  }
  assert.ok(blockOf(md, 'ext').includes('- Summary: Plain summary.'), 'a revealed experiment keeps its outcome');
  assert.deepEqual(detailOf(md), ['### Trial base', '### Trial ext', '### Model sources']);
  assert.ok(md.includes(S.EXPORT_DISCLAIMER));
  assert.ok(
    w.CortexLabNotebook.markdownToPlain(md).includes('\nSealed until this experiment is revealed.\n'),
    'the plain-text copy follows the file'
  );
  // Revealed: the same runs print their label, summary, measurement and model detail.
  state.experiments['exp-5'].status = 'revealed';
  const open = w.CortexLabNotebook.exportMarkdown(state, lab);
  assert.ok(!open.includes('Sealed until'));
  assert.ok(blockOf(open, 's2').includes('- Summary: Plain summary.'));
  assert.ok(blockOf(open, 's2').some(l => l.startsWith('  - [Simulated: illustrative, not a measurement] ')));
  assert.deepEqual(detailOf(open), [
    '### Trial base',
    '### Trial ext',
    '### Trial s1',
    '### Trial s2',
    '### Model sources',
  ]);
  w.CortexLab = undefined;
  close();
});
test('UX-POLISH: microscope links carry at=<anchor>; back with at= the designer lands on that section, heading focused', () => {
  const run = (at, opts = {}) => {
    const h = harness(opts.view || 'designer');
    const scrolled = [];
    h.w.Element.prototype.scrollIntoView = function () {
      scrolled.push(this);
    };
    const state = freshState();
    state.runs.other = fullRun('other', 'SPEC-SYN-AD-02');
    state.experiments['exp-2'] = { ...revealedExperiment(), measures: ['contrast-ordinal', 'roi-lesion-count'] };
    state.experimentOrder = ['exp-2'];
    if (opts.draft) state.experiments['exp-2'].status = 'draft';
    const handle = h.w.CortexLabNotebook.mountDesigner(h.app, {
      lab,
      state,
      experimentId: 'exp-2',
      onSave() {},
      ...(at === undefined ? {} : { at }),
    });
    return { ...h, scrolled, handle };
  };
  // The links: the hand-recorded measure's at=measures, the comparison's at=compare.
  const a = run(undefined);
  const params = link => Object.fromEntries(new URLSearchParams(link.getAttribute('href').split('?')[1]));
  assert.equal(params(a.app.querySelector('a[data-labn-measure-scope="roi-lesion-count"]')).at, 'measures');
  assert.equal(params(a.app.querySelector('a[data-labn-scope-link]')).at, 'compare');
  const opened = [];
  a.w.CortexLab = { words: {}, openMicroscope: opts => opened.push(JSON.parse(JSON.stringify(opts))) };
  a.app.querySelector('a[data-labn-measure-scope="roi-lesion-count"]').click();
  assert.deepEqual(opened, [{ runIds: ['base', 'ext'], from: 'designer', exp: 'exp-2', step: 2, at: 'measures' }]);
  assert.equal(a.scrolled.length, 0, 'no anchor: nothing scrolls on mount');
  a.close();
  // Back with at=: that section scrolls into view and its heading has focus.
  for (const [at, selector, heading] of [
    ['measures', '[data-labn-measures-out]', 'Your outcome measures'],
    ['compare', '.labn-compare', 'Compared with your baseline'],
    ['cards', '.labn-cards', 'Your experimental run'],
  ]) {
    const b = run(at);
    const active = b.w.document.activeElement;
    assert.equal(active.textContent, heading, at);
    assert.equal(active.getAttribute('tabindex'), '-1');
    assert.ok(b.app.querySelector(selector).contains(active));
    assert.equal(b.scrolled[0], b.app.querySelector(selector), `${at}: that section scrolls into view`);
    b.close();
  }
  // From the address when the shell passes nothing (?view=designer&at=compare), and the first move in
  // the wizard drops at= from the address again.
  const c = run(undefined, { view: 'designer&exp=exp-2&step=2&at=compare' });
  assert.equal(c.w.document.activeElement.textContent, 'Compared with your baseline');
  c.app.querySelector('[data-labn-action="wizard-go"][data-labn-step="1"]').click();
  assert.equal(new URL(c.w.location.href).searchParams.get('at'), null);
  c.close();
  // Unknown anchors and drafts (nothing revealed) leave focus and scroll alone; update({ at }) works too.
  const d = run('nowhere');
  assert.equal(d.scrolled.length, 0);
  assert.ok(!d.app.contains(d.w.document.activeElement) || d.w.document.activeElement === d.w.document.body);
  d.handle.update({ at: 'measures' });
  assert.equal(d.w.document.activeElement.textContent, 'Your outcome measures');
  d.close();
  const e = run('measures', { draft: true });
  assert.equal(e.scrolled.length, 0, 'a draft has no reveal to land on');
  e.close();
});

test('UX-LAST: "What you change" suggests only the bench’s changes; "Make the runs for me" waits for one it can make', () => {
  const listOf = (app, input) =>
    Array.from(app.querySelector(`#${input.getAttribute('list')}`).querySelectorAll('option')).map(o => o.value);
  // Without lab.js's change list (or with one that throws or that the bench recognizes nothing of): the
  // plain setting names as before and no button, since it could only guess.
  for (const shellApi of [
    undefined,
    changeShell({
      changeOptions: () => {
        throw new Error('broken');
      },
    }),
    changeShell({ matchChange: () => null }),
  ]) {
    const { w, app, close } = harness();
    w.CortexLab = shellApi;
    w.CortexLabNotebook.mountDesigner(app, { lab, state: freshState(), experimentId: 'exp-1', onSave() {} });
    const input = app.querySelector('input[data-labn-chip-input="changed"]');
    assert.ok(listOf(app, input).includes('Development time') && listOf(app, input).includes('Specimen'));
    assert.equal(app.querySelector('[data-labn-action="request-runs"]'), null);
    assert.equal(field(app, 'independentVariable').hasAttribute('list'), false);
    close();
  }
  const { w, app, type, close } = harness();
  w.CortexLab = changeShell();
  const asked = [];
  w.CortexLabNotebook.mountDesigner(app, {
    lab,
    state: freshState(),
    experimentId: 'exp-1',
    onSave() {},
    onRequestRuns: exp => {
      asked.push(plain(exp));
    },
  });
  const chipInput = () => app.querySelector('input[data-labn-chip-input="changed"]');
  // Only the bench's changes, in its order and words, one per value other than the procedure's own.
  assert.deepEqual(listOf(app, chipInput()), [
    'Impregnation time: shorter',
    'Impregnation time: longer',
    'Development time: shorter',
    'Development time: longer',
    'Developer strength: weaker',
    'Developer strength: stronger',
    'Washes: changed (not modeled)',
    'Toning and thiosulfate: skip gold toning',
    'Toning and thiosulfate: skip thiosulfate',
  ]);
  assert.equal(chipInput().getAttribute('placeholder'), 'e.g. Development time: longer');
  assert.equal(field(app, 'independentVariable').getAttribute('list'), chipInput().getAttribute('list'));
  const held = app.querySelector('input[data-labn-chip-input="heldComparable"]');
  assert.notEqual(held.getAttribute('list'), chipInput().getAttribute('list'), 'what stays the same keeps its names');
  assert.ok(listOf(app, held).includes('Specimen'));
  // The hint says what the button does now.
  const button = () => app.querySelector('[data-labn-action="request-runs"]');
  const reason = () => app.querySelector('p[data-labn-request-reason]');
  const [hintId, reasonId] = button().getAttribute('aria-describedby').split(' ');
  assert.equal(
    app.querySelector(`#${hintId}`).textContent,
    'Opens the bench with both runs, every step done: a standard run (one you already finished, if you have one) and a copy with your change. What a new run shows stays hidden until you reveal this experiment.'
  );
  assert.equal(reasonId, reason().id);
  const waits = (why, text) => {
    assert.equal(button().disabled, true, why);
    assert.equal(reason().hidden, false, why);
    assert.equal(reason().getAttribute('data-labn-request-reason'), why);
    assert.equal(reason().textContent, text);
  };
  const add = text => {
    chipInput().value = text;
    app.querySelector('[data-labn-action="chip-add"][data-labn-list="changed"]').click();
  };
  const removeFirst = () =>
    app.querySelector('[data-labn-action="chip-remove"][data-labn-list="changed"][data-labn-index="0"]').click();
  waits('empty', 'Pick what you change from the list first.');
  reason().querySelector('a[data-labn-jump="changed"]').click();
  assert.equal(w.document.activeElement, chipInput(), 'the reason leads to the field');
  add('longer development');
  waits('unknown', '“longer development” is not one of the changes the bench can make. Pick one from the list.');
  removeFirst();
  add('Development time');
  waits('direction', '“Development time” does not say which way to change it. Pick one from the list.');
  removeFirst();
  add('Development time: standard');
  waits(
    'standard',
    '“Development time: standard” is the procedure’s own setting, not a change. Pick one from the list.'
  );
  removeFirst();
  add('Development time: longer');
  assert.equal(field(app, 'independentVariable').value, 'Development time: longer');
  assert.equal(button().disabled, false);
  assert.equal(reason().hidden, true);
  // The main variable in the student's own words leaves the change to "What you change"; one naming
  // another change, or a second change, is one too many; letter case and spacing do not matter.
  type(field(app, 'independentVariable'), 'how long the slide develops');
  assert.equal(button().disabled, false);
  type(field(app, 'independentVariable'), 'Developer strength: weaker');
  waits(
    'several',
    'The bench makes one change at a time. Keep one in “What you change” and the same one as your main variable.'
  );
  type(field(app, 'independentVariable'), 'development time:LONGER');
  assert.equal(button().disabled, false);
  add('Washes: changed (not modeled)');
  assert.equal(button().disabled, true);
  app.querySelector('[data-labn-action="chip-remove"][data-labn-list="changed"][data-labn-index="1"]').click();
  button().click();
  assert.equal(asked.length, 1);
  assert.deepEqual(asked[0].changed, ['Development time: longer']);
  close();
  // After the reveal the plan is locked: the button is disabled and the lock note (not a reason) says why.
  const r = harness();
  r.w.CortexLab = changeShell();
  const state = freshState();
  state.experiments['exp-2'] = {
    ...revealedExperiment(),
    changed: ['Development time: longer'],
    independentVariable: 'Development time: longer',
  };
  state.experimentOrder = ['exp-2'];
  r.w.CortexLabNotebook.mountDesigner(r.app, { lab, state, experimentId: 'exp-2', onSave() {} });
  assert.equal(r.app.querySelector('[data-labn-action="request-runs"]').disabled, true);
  assert.equal(r.app.querySelector('p[data-labn-request-reason]').hidden, true);
  r.close();
});

test('UX-LAST: on a phone the stuck Back / Next bar never hides the focused field', async () => {
  const { w, app, wait, close } = harness();
  w.CortexLabNotebook.mountDesigner(app, { lab, state: freshState(), experimentId: 'exp-1', onSave() {} });
  const nav = app.querySelector('.labn-wizard-nav');
  let sticky = true;
  // The bar (two lines, 95px) stuck at the bottom of an 844px screen, under a 121px site bar.
  w.getComputedStyle = node => ({
    position: node === nav && sticky ? 'sticky' : 'static',
    getPropertyValue: name => (name === '--lab-topbar-h' ? '121px' : ''),
  });
  nav.getBoundingClientRect = () => ({ top: 749, bottom: 844, width: 390, height: 95 });
  const lifted = [];
  w.scrollBy = opts => lifted.push(plain(opts));
  const at = (node, top, bottom) => {
    node.getBoundingClientRect = () => ({ top, bottom, width: 300, height: bottom - top });
    return node;
  };
  // A field the bar half covers: lifted to 8px above the bar, at once and not animated.
  at(field(app, 'question'), 700, 790).focus();
  assert.deepEqual(lifted[0], { top: 790 - 749 + 8, behavior: 'instant' });
  await wait(50);
  assert.ok(lifted.length >= 2, 'checked again after the browser has scrolled');
  lifted.length = 0;
  // A tall field is lifted only as far as its top stays below the site bar.
  at(field(app, 'background'), 150, 800).focus();
  assert.deepEqual(lifted[0], { top: 150 - 121 - 8, behavior: 'instant' });
  lifted.length = 0;
  await wait(50);
  lifted.length = 0;
  at(field(app, 'title'), 200, 244).focus(); // above the bar
  at(nav.querySelector('[data-labn-action="wizard-next"]'), 780, 824).focus(); // the bar's own button
  sticky = false; // wider screens: the bar is not stuck
  at(field(app, 'alternative'), 740, 800).focus();
  await wait(50);
  assert.equal(lifted.length, 0);
  // The page keeps that room under a focused control while the bar is stuck (phones).
  const css = fs.readFileSync(path.join(ROOT, 'lab-notebook.css'), 'utf8');
  const phone = css.slice(css.indexOf('@media (max-width: 560px)'));
  const block = phone.slice(0, phone.indexOf('\n}\n'));
  assert.match(block, /\.labn-wizard-nav \{ position: sticky; bottom: 0;/);
  assert.match(
    block,
    /html:has\(\.labn-designer\) \{ scroll-padding-bottom: calc\(104px \+ env\(safe-area-inset-bottom\)\); \}/
  );
  assert.ok(!css.includes('scroll-margin-bottom: 96px'), 'the per-control margin is replaced');
  // Long run names end before the select's chevron.
  assert.match(css, /\.labn-select \{ padding-right: 36px; text-overflow: ellipsis; \}/);
  close();
});

test('UX-LAST: strengths in words, bare links in the print view, "Save note" in the add form', () => {
  const { w, app, close } = harness('notebook');
  const state = notebookState();
  let seen = null;
  const spy = {
    ...lab,
    exportNotebook: (input, options) => {
      seen = options;
      return lab.exportNotebook(input, options);
    },
  };
  w.CortexLabNotebook.exportMarkdown(state, spy);
  // Words only (the engine adds the brackets); a schematic claim is never "from another system", since
  // several are the course's own modeling rules.
  assert.deepEqual(
    ['published-qualitative', 'schematic-analogy', 'course-handout', 'placeholder', 'hypothesis-conditional'].map(
      seen.strengthText
    ),
    [
      'published, qualitative',
      'schematic: a model assumption or an analogy',
      'course materials',
      'not yet sourced',
      'conditional on a hypothesis',
    ]
  );
  assert.ok(!/[()]/.test(seen.strengthText('published-qualitative')));
  assert.equal(seen.strengthText('unknown-strength'), undefined, 'unknown: the engine keeps its default');
  // The print view shows a link as its bare address; every other character is still escaped.
  const html = w.CortexLabNotebook.markdownToHtml(
    '- [Published] x\n  "c" (published, qualitative). Source: A. <https://pubmed.ncbi.nlm.nih.gov/11194935/>\n\nSee <b>this</b>'
  );
  assert.ok(html.includes('Source: A. https://pubmed.ncbi.nlm.nih.gov/11194935/</span>'), html);
  assert.ok(!html.includes('&lt;https'));
  assert.ok(html.includes('See &lt;b&gt;this&lt;/b&gt;'));
  // The export's event list prints as a numbered list that keeps its numbers.
  const events = w.CortexLabNotebook.markdownToHtml(
    '- Events:\n\n1. Remove the wax\n2. <First> bath\n\n- Deviations: none'
  );
  assert.equal(
    events,
    '<ul><li>Events:</li></ul>\n<ol><li value="1">Remove the wax</li><li value="2">&lt;First&gt; bath</li></ol>\n<ul><li>Deviations: none</li></ul>'
  );
  // The report: the menu button adds, the form's button saves; a published note's strength in words.
  w.CortexLabNotebook.mountNotebook(app, { lab, state, onAdd() {}, onRemove() {}, onExport() {} });
  assert.equal(app.querySelector('[data-labn-action="add-menu"]').textContent, 'Add to my report');
  assert.equal(app.querySelector('[data-labn-add-form] button[type="submit"]').textContent, 'Save note');
  const published = app.querySelector('[data-labn-entry="entry-1"]');
  assert.ok(published.textContent.includes('(published, qualitative)'), published.textContent);
  assert.ok(!published.textContent.includes('published qualitative'));
  close();
});

test("UX-LAST: the export labels each experiment field with the designer's own field name", () => {
  const { w, app, close } = harness();
  const state = notebookState();
  Object.assign(state.experiments['exp-1'], {
    changed: ['Development time: longer'],
    independentVariable: 'how long the slide develops', // differs, so the engine prints it too
  });
  w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-1', onSave() {} });
  // What the student sees as each field's name (the "required" pill aside).
  const name = node => node.firstChild.textContent.trim();
  const labelFor = control => name(app.querySelector(`label[for="${control.id}"]`));
  const legend = sel => name(app.querySelector(sel).closest('fieldset').querySelector('legend'));
  const labels = [
    labelFor(field(app, 'background')),
    labelFor(field(app, 'question')),
    labelFor(field(app, 'hypothesis')),
    labelFor(field(app, 'alternative')),
    labelFor(app.querySelector('input[data-labn-chip-input="changed"]')),
    labelFor(field(app, 'independentVariable')),
    labelFor(app.querySelector('input[data-labn-chip-input="heldComparable"]')),
    legend('input[data-labn-control-type]'),
    legend('input[data-labn-field="measures"]'),
    labelFor(field(app, 'baselineRunId')),
    labelFor(field(app, 'experimentalRunId')),
    ...['expected', 'negligible', 'opposite'].map(k => labelFor(field(app, `predictions.${k}`))),
    labelFor(field(app, 'limitations')),
    ...['supports', 'failsToEstablish', 'next'].map(k => labelFor(field(app, `interpretation.${k}`))),
  ];
  assert.deepEqual(labels, [
    'Background',
    'Your question',
    'Your hypothesis',
    'Another explanation',
    'What you change',
    'Main variable (the one you test)',
    'What you keep the same',
    'Controls',
    'Outcome measures',
    'Baseline run (standard)',
    'Experimental run (with your change)',
    'Expected outcome',
    'Negligible change',
    'Opposite outcome',
    'Limits of your design',
    'What it supports',
    'What it fails to establish',
    'Next experiment',
  ]);
  const lines = w.CortexLabNotebook.exportMarkdown(state, lab).split('\n');
  const block = lines.slice(lines.indexOf('### Development endpoint'), lines.indexOf('#### Run base'));
  for (const label of labels)
    assert.ok(
      block.some(l => l.startsWith(`- ${label}: `)),
      `export: ${label}`
    );
  close();
});

test('UX-LAST-verify: a twin of a sealed run (lab.js CortexLab.isSealed) is held back in the report, the add form and the file', () => {
  const twinState = () => {
    const state = notebookState();
    state.runs.s1 = fullRun('s1', 'SPEC-SYN-AD-01');
    state.runs.s2 = fullRun('s2', 'SPEC-SYN-AD-01', { development: { strength: 'weak' } });
    state.runs.t1 = fullRun('t1', 'SPEC-SYN-AD-01', { development: { strength: 'weak' } });
    state.runOrder.push('s1', 's2', 't1');
    state.experiments['exp-7'] = {
      ...completeExperiment('exp-7'),
      title: 'Weaker developer',
      baselineRunId: 's1',
      experimentalRunId: 's2',
    };
    state.experimentOrder.push('exp-7');
    // The experiment names s2; t1 is its twin (lab.js labSealTwin), so lab.js seals it to the same draft.
    state.sealed = { s2: 'exp-7', t1: 'exp-7' };
    state.notebook = lab.addEntry(
      state.notebook,
      {
        id: 'entry-t',
        type: 'simulated',
        section: 'next-steps',
        text: 'Written before the twin was sealed.',
        runId: 't1',
        label: 'illustrative-synthetic',
      },
      state.runs
    );
    return state;
  };
  const SEALED = 'Sealed until you reveal “Weaker developer”. Write your predictions first.';
  const { w, app, close } = harness('notebook');
  const state = twinState();
  const asked = [];
  w.CortexLab = {
    words: {},
    isSealed: id => {
      asked.push(id);
      return id === 's2' || id === 't1';
    },
  };
  w.CortexLabNotebook.mountNotebook(app, { lab, state, onAdd() {}, onRemove() {}, onExport() {} });
  const item = ref => app.querySelector(`[data-labn-ref="${ref}"]`);
  assert.equal(item('t1').querySelectorAll('[data-lab-badge]').length, 0, 'the twin shows no badge');
  assert.equal(item('t1').querySelector('[data-labn-sealed]').textContent, SEALED);
  assert.doesNotMatch(item('t1').textContent, /visible silver|contrast is|background is/);
  assert.ok(item('s1').querySelector('[data-lab-badge]'), 'the unsealed baseline keeps its badge');
  assert.ok(asked.includes('t1'), 'lab.js decides the twin');
  assert.ok(!asked.includes('s2'), 'a run the experiment names needs no question');
  // The add form lists the twin but it cannot be chosen.
  app.querySelector('[data-labn-action="add-menu"]').click();
  app.querySelector('[data-labn-add-type="simulated"]').click();
  const option = app.querySelector('select[data-labn-draft="runId"] option[value="t1"]');
  assert.equal(option.disabled, true);
  assert.equal(option.getAttribute('data-labn-sealed-run'), 'exp-7');
  app.querySelector('[data-labn-action="add-cancel"]').click();
  // The file: the entry about the twin prints the sealed line, not its label.
  const lines = w.CortexLabNotebook.exportMarkdown(state, lab).split('\n');
  const at = lines.indexOf('- [Simulated: illustrative, not a measurement] Written before the twin was sealed.');
  assert.ok(at > 0);
  assert.equal(lines[at + 1], '  Sealed until this experiment is revealed.');
  close();
  // Without lab.js (or when its answer is not a plain true, or it throws) a run the experiment does
  // not name is not sealed by the module on its own.
  for (const shellApi of [
    undefined,
    { isSealed: () => 'yes' },
    {
      isSealed: () => {
        throw new Error('x');
      },
    },
  ]) {
    const h = harness('notebook');
    const s = twinState();
    h.w.CortexLab = shellApi;
    h.w.CortexLabNotebook.mountNotebook(h.app, { lab, state: s, onAdd() {}, onRemove() {}, onExport() {} });
    assert.ok(h.app.querySelector('[data-labn-ref="t1"] [data-lab-badge]'), JSON.stringify(shellApi));
    assert.ok(h.app.querySelector('[data-labn-ref="s2"] [data-labn-sealed]'), 'the named run stays sealed');
    h.close();
  }
  // Revealed: the twin opens with its experiment.
  const r = harness('notebook');
  const open = twinState();
  open.experiments['exp-7'].status = 'revealed';
  r.w.CortexLab = { words: {}, isSealed: id => id === 't1' };
  r.w.CortexLabNotebook.mountNotebook(r.app, { lab, state: open, onAdd() {}, onRemove() {}, onExport() {} });
  assert.ok(r.app.querySelector('[data-labn-ref="t1"] [data-lab-badge]'), 'a revealed experiment seals nothing');
  r.close();
});

// TONING (ENGINE-14): skipping gold toning or thiosulfate is a change no sourced rule covers, so its run
// reveals Not modeled. The designer says so before "Make the runs for me" (the button stays usable), the
// reveal asks what that means, a step done although the settings skip it is named, and the print view
// nests the export's sub-items.
const NOT_MODELED_NOTE =
  'The model has no rule for this change, so the reveal will say Not modeled. That is a valid result to interpret.';
test('TONING: a change the model has no rule for says before "Make the runs for me" that the reveal will say Not modeled', () => {
  const { w, app, type, close } = harness();
  w.CortexLab = changeShell();
  const asked = [];
  w.CortexLabNotebook.mountDesigner(app, {
    lab,
    state: freshState(),
    experimentId: 'exp-1',
    onSave() {},
    onRequestRuns: exp => {
      asked.push(plain(exp));
    },
  });
  const button = () => app.querySelector('[data-labn-action="request-runs"]');
  const note = () => app.querySelector('p[data-labn-request-note]');
  const chipInput = () => app.querySelector('input[data-labn-chip-input="changed"]');
  const setChange = text => {
    for (let b; (b = app.querySelector('[data-labn-action="chip-remove"][data-labn-list="changed"]'));) b.click();
    type(field(app, 'independentVariable'), '');
    if (!text) return;
    chipInput().value = text;
    app.querySelector('[data-labn-action="chip-add"][data-labn-list="changed"]').click();
  };
  // One line, before the button, read with it (aria-describedby), hidden until it applies.
  assert.equal(note().nextElementSibling, button(), 'the note sits right before the button');
  assert.ok(button().getAttribute('aria-describedby').split(' ').includes(note().id));
  assert.equal(note().hidden, true, 'nothing planned yet');
  for (const text of ['Washes: changed (not modeled)', 'Washes']) {
    setChange(text);
    assert.equal(note().hidden, false, text);
    assert.equal(note().textContent, NOT_MODELED_NOTE, text);
    assert.equal(button().disabled, false, `${text}: the option stays available`);
    assert.equal(app.querySelector('p[data-labn-request-reason]').hidden, true, text);
  }
  // A modeled change (a skip is modeled since §11.5), an unfinished plan or a change the bench cannot
  // make: no note.
  for (const text of [
    'Toning and thiosulfate: skip gold toning',
    'Toning and thiosulfate: skip thiosulfate',
    'Development time: longer',
    'Developer strength: weaker',
    'Impregnation time: shorter',
    'Toning and thiosulfate',
    'Toning and thiosulfate: both done (standard)',
    'Toning and thiosulfate: skip gold toning (not modeled)',
    'skip toning',
    '',
  ]) {
    setChange(text);
    assert.equal(note().hidden, true, text || '(empty)');
  }
  // Two changes are one too many even when one is not modeled.
  setChange('Washes: changed (not modeled)');
  type(field(app, 'independentVariable'), 'Development time: longer');
  assert.equal(note().hidden, true);
  assert.equal(button().disabled, true);
  type(field(app, 'independentVariable'), 'Washes: changed (not modeled)');
  assert.equal(note().hidden, false);
  button().click();
  assert.equal(asked.length, 1, 'the runs are still made');
  assert.deepEqual(asked[0].changed, ['Washes: changed (not modeled)']);
  assert.doesNotMatch(visibleText(step(app, 2)), ENGINE_WORDS);
  close();
  // After the reveal the plan is locked: no note (the cards say what the model shows).
  const r = harness();
  r.w.CortexLab = changeShell();
  const state = freshState();
  state.experiments['exp-2'] = {
    ...revealedExperiment(),
    changed: ['Washes: changed (not modeled)'],
    independentVariable: 'Washes: changed (not modeled)',
  };
  r.w.CortexLabNotebook.mountDesigner(r.app, { lab, state, experimentId: 'exp-2', onSave() {} });
  assert.equal(r.app.querySelector('p[data-labn-request-note]').hidden, true);
  r.close();
});

test('TONING: a Not modeled reveal asks what it means that the model cannot say; a simulated or unfinished one does not', () => {
  const PROMPT = 'What does it mean that the model cannot say?';
  const mount = (experimentalRunId, extraRuns = {}) => {
    const d = harness();
    const state = freshState();
    Object.assign(state.runs, extraRuns);
    state.runOrder.push(...Object.keys(extraRuns));
    state.experiments['exp-2'] = { ...revealedExperiment(), experimentalRunId };
    state.experimentOrder = ['exp-2'];
    d.w.CortexLabNotebook.mountDesigner(d.app, { lab, state, experimentId: 'exp-2', onSave() {} });
    return d;
  };
  // Washes changed: the experimental run is Not modeled.
  const washes = mount('w', { w: fullRun('w', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } }) });
  const line = washes.app.querySelector('[data-labn-not-modeled-prompt]');
  assert.ok(line, 'the interpretation asks the question');
  assert.ok(line.textContent.endsWith(PROMPT), line.textContent);
  assert.ok(line.textContent.startsWith('The model has no rule for this change'), line.textContent);
  assert.ok(line.closest('.labn-interpretation'), 'inside the Interpret form');
  const supports = field(washes.app, 'interpretation.supports');
  assert.ok(supports.getAttribute('aria-describedby').split(' ').includes(line.id));
  // The engine's three prompts stay as the hint under each answer, and the measures say "no model value".
  const hints = Array.from(washes.app.querySelectorAll('.labn-interpretation .labn-field .labn-hint')).map(p =>
    p.textContent.trim()
  );
  assert.deepEqual(hints, [
    'What would this outcome support?',
    'What would it fail to establish?',
    'What experiment would be informative next?',
  ]);
  assert.match(
    washes.app.querySelector('[data-labn-measure-out="contrast-ordinal"] [data-labn-measure-line]').textContent,
    /: no model value, because the experimental run is Not modeled\.$/
  );
  assert.doesNotMatch(visibleText(washes.app.querySelector('.labn-interpretation')), ENGINE_WORDS);
  washes.close();
  // A simulated reveal, and a run with steps still to do, keep today's form.
  const simulated = mount('ext');
  assert.equal(simulated.app.querySelector('[data-labn-not-modeled-prompt]'), null);
  assert.equal(field(simulated.app, 'interpretation.supports').getAttribute('aria-describedby').split(' ').length, 1);
  simulated.close();
  const unfinished = perform(lab.createRun({ id: 'half', specimenId: 'SPEC-SYN-AD-01' }), S.STEPS.slice(0, 4));
  assert.equal(lab.resolve(unfinished).code, 'step-skipped');
  const half = mount('half', { half: unfinished });
  assert.equal(half.app.querySelectorAll('.labn-card').length, 1);
  assert.equal(half.app.querySelector('[data-labn-not-modeled-prompt]'), null, 'steps still to do, not Not modeled');
  half.close();
});

test('TONING (§11.5, was ENGINE-14): a run that skips gold toning or thiosulfate reveals a drawn outcome whose Keep in mind carries the engine caveat; nothing says Not modeled', () => {
  for (const [flag, step, words] of [
    ['toning', 'gold-toning', /No gold toning/],
    ['thiosulfate', 'sodium-thiosulfate', /No thiosulfate/],
  ]) {
    // The step the run's setting skips is not done: the run is complete without it. Both flags are
    // read by a rule now (R-model-10), so the run resolves to a picture with a caveat.
    const run = perform(
      lab.createRun({ id: 'skip', specimenId: 'SPEC-SYN-AD-01', params: { [flag]: false } }),
      S.STEPS.filter(st => st !== step)
    );
    const outcome = lab.resolve(run);
    assert.equal(outcome.label, 'illustrative-synthetic', flag);
    assert.ok(
      outcome.caveats.some(c => words.test(c)),
      `${flag}: ${JSON.stringify(outcome.caveats)}`
    );
    const d = harness();
    const state = freshState();
    state.runs.skip = run;
    state.runOrder.push('skip');
    state.experiments['exp-2'] = { ...revealedExperiment(), experimentalRunId: 'skip' };
    d.w.CortexLabNotebook.mountDesigner(d.app, { lab, state, experimentId: 'exp-2', onSave() {} });
    const cards = d.app.querySelectorAll('.labn-card');
    assert.ok(cards.length >= 1, flag);
    const card = [...cards].find(c => c.getAttribute('data-labn-label') === 'illustrative-synthetic');
    assert.ok(card, `${flag}: a drawn card`);
    assert.ok(card.querySelector('[data-lab-badge="simulated"]'), flag);
    assert.equal(d.app.querySelector('[data-lab-badge="not-modeled"]'), null, flag);
    assert.match(d.app.textContent, words, `${flag}: the caveat reaches the page (Keep in mind)`);
    assert.doesNotMatch(d.app.textContent, /What does it mean that the model cannot say\?/, flag);
    assert.doesNotMatch(
      d.app.querySelector('[data-labn-measure-out="contrast-ordinal"] [data-labn-measure-line]').textContent,
      /is Not modeled/,
      flag
    );
    d.close();
  }
});

test('TONING: a step done although the run’s settings skip it is named in the run’s line', () => {
  const { w, app, close } = harness('notebook');
  const state = freshState();
  // The engine records it as deviation kind 'not-planned' (ENGINE-14).
  state.runs.tone = fullRun('tone', 'SPEC-SYN-AD-01', { toning: false });
  assert.deepEqual(plain(state.runs.tone.deviations), [{ seq: 7, kind: 'not-planned', step: 'gold-toning' }]);
  state.runOrder.push('tone');
  w.CortexLabNotebook.mountNotebook(app, { lab, state, onAdd() {}, onRemove() {}, onExport() {} });
  const title = app.querySelector('[data-labn-work="run"][data-labn-ref="tone"] .labn-work-title').textContent;
  assert.ok(title.includes('Done though your setting skips it: Gold toning'), title);
  assert.ok(title.includes('Gold toning: skipped'), title);
  assert.ok(!title.includes('not-planned'), title);
  close();
});

test('TONING: the print view nests "Cited for" and a run’s measurements under their item', () => {
  const { w, close } = harness('notebook');
  const md = [
    '## Sources',
    '',
    '- A. Author. <https://example.org/a>',
    '  - Cited for: "a <b>claim</b>" (published, qualitative)',
    '- B. Author. <https://example.org/b>',
    '  - Cited for: "b" (course materials)',
    '',
    '#### Run 2',
    '',
    '- Label: Illustrative simulation',
    '- Measurements:',
    '  - [Simulated: illustrative, not a measurement] Contrast: low (model scale) (derived)',
    '  - [Simulated: illustrative, not a measurement] Count: 12 count (manual)',
    '- Next: x',
    '',
    '- [Published] y',
    '  "c" (published, qualitative). Source: C <https://example.org/c>',
    '  - Cited for: z',
    '    - deeper',
    '- back out',
    '  1. one',
    '  2. two',
    '- last',
  ].join('\n');
  const html = w.CortexLabNotebook.markdownToHtml(md);
  assert.ok(
    html.includes(
      '<ul><li>A. Author. https://example.org/a<ul><li>Cited for: &quot;a &lt;b&gt;claim&lt;/b&gt;&quot; (published, qualitative)</li></ul></li><li>B. Author. https://example.org/b<ul><li>Cited for: &quot;b&quot; (course materials)</li></ul></li></ul>'
    ),
    html
  );
  const doc = new JSDOM(`<div id="d">${html}</div>`).window.document;
  const root = doc.querySelector('#d');
  const top = Array.from(root.children);
  assert.deepEqual(
    top.map(n => n.tagName),
    ['H3', 'UL', 'H5', 'UL', 'UL'],
    'one list per block, sub-items inside their item'
  );
  const own = li => li.firstChild.textContent.trim();
  // Sources: two items, each with its "Cited for" inside it.
  assert.deepEqual(Array.from(top[1].children).map(own), [
    'A. Author. https://example.org/a',
    'B. Author. https://example.org/b',
  ]);
  for (const li of top[1].children) {
    const sub = li.querySelector(':scope > ul');
    assert.ok(sub && sub.children.length === 1 && own(sub.children[0]).startsWith('Cited for: '), li.textContent);
  }
  // The run block: three items; the measurements are a list inside "Measurements:".
  assert.deepEqual(Array.from(top[3].children).map(own), [
    'Label: Illustrative simulation',
    'Measurements:',
    'Next: x',
  ]);
  const measures = top[3].children[1].querySelector(':scope > ul');
  assert.deepEqual(Array.from(measures.children).map(own), [
    '[Simulated: illustrative, not a measurement] Contrast: low (model scale) (derived)',
    '[Simulated: illustrative, not a measurement] Count: 12 count (manual)',
  ]);
  // A continuation line stays in its item; deeper items nest again; a numbered sub-list keeps its numbers.
  const entry = top[4].children[0];
  assert.equal(
    entry.querySelector(':scope > .labn-print-sub').textContent,
    '"c" (published, qualitative). Source: C https://example.org/c'
  );
  const cited = entry.querySelector(':scope > ul > li');
  assert.equal(own(cited), 'Cited for: z');
  assert.equal(cited.querySelector(':scope > ul > li').textContent, 'deeper');
  assert.deepEqual(Array.from(top[4].children).map(own), ['[Published] y', 'back out', 'last']);
  const ol = top[4].children[1].querySelector(':scope > ol');
  assert.deepEqual(
    Array.from(ol.children).map(li => [li.getAttribute('value'), li.textContent]),
    [
      ['1', 'one'],
      ['2', 'two'],
    ]
  );
  assert.equal(root.querySelectorAll('script, b').length, 0, 'still escaped');
  // The real export: no "Cited for" and no measurement is ever a sibling of its parent item.
  const real = new JSDOM(
    `<div id="d">${w.CortexLabNotebook.markdownToHtml(w.CortexLabNotebook.exportMarkdown(notebookState(), lab))}</div>`
  ).window.document;
  const citedFor = Array.from(real.querySelectorAll('li')).filter(li => own(li).startsWith('Cited for: '));
  assert.ok(citedFor.length > 0);
  for (const li of citedFor) assert.equal(li.parentElement.parentElement.tagName, 'LI', own(li));
  const measured = Array.from(real.querySelectorAll('li')).filter(
    li => own(li).startsWith('[Simulated: illustrative, not a measurement] ') && /\((derived|manual)\)/.test(own(li))
  );
  assert.ok(measured.length > 0);
  for (const li of measured) assert.match(own(li.parentElement.parentElement), /^Measurements:/);
  close();
});

// TONING-verify-1: the designer's run lines count over the steps a run needs, as the bench does, so a
// skip run with its 8 steps done is "ready (sealed)" (it read "8 of 9 steps done." and stayed "sealed").
test('TONING-verify: a run that skips a step counts the steps it needs in the designer (8, not 9)', () => {
  const without = step => S.STEPS.filter(st => st !== step);
  const d = harness();
  const state = freshState();
  state.runs.skip = perform(
    lab.createRun({ id: 'skip', specimenId: 'SPEC-SYN-AD-01', params: { toning: false } }),
    without('gold-toning')
  );
  state.runs.half = perform(
    lab.createRun({ id: 'half', specimenId: 'SPEC-SYN-AD-01', params: { thiosulfate: false } }),
    S.STEPS.slice(0, 5)
  );
  state.runOrder.push('skip', 'half');
  state.experiments['exp-7'] = { ...completeExperiment('exp-7'), title: 'Skip toning', experimentalRunId: 'skip' };
  state.experimentOrder.push('exp-7');
  state.sealed = { skip: 'exp-7' };
  d.w.CortexLabNotebook.mountDesigner(d.app, { lab, state, experimentId: 'exp-7', step: 2, onSave() {} });
  assert.match(
    field(d.app, 'experimentalRunId').querySelector('option[value="skip"]').textContent,
    / · ready \(sealed\)$/
  );
  assert.equal(
    d.app.querySelector('[data-labn-run-summary="experimentalRunId"]').textContent,
    'Ready (sealed): all steps done. You see its outcome when you reveal this experiment.'
  );
  d.close();
  const o = harness();
  state.sealed = {};
  state.experiments['exp-7'].experimentalRunId = 'half';
  o.w.CortexLabNotebook.mountDesigner(o.app, { lab, state, experimentId: 'exp-7', step: 2, onSave() {} });
  assert.equal(o.app.querySelector('[data-labn-run-summary="experimentalRunId"]').textContent, '5 of 8 steps done.');
  state.experiments['exp-7'].experimentalRunId = 'skip';
  o.close();
  const s = harness();
  s.w.CortexLabNotebook.mountDesigner(s.app, { lab, state, experimentId: 'exp-7', step: 2, onSave() {} });
  assert.equal(s.app.querySelector('[data-labn-run-summary="experimentalRunId"]').textContent, 'All 8 steps done.');
  s.close();
});

// ---- SIMPLE-notebook (2026-10-12, Kevin: "the my report tab looks much too fluff"; "make the design
// experiment more simplistic"): a Notes pad through the shell, "## Notes" in the file, sections only
// once they hold a note, two designer screens with folds, a title filled in from the change ----------
function notepadShell(initial = '') {
  const saves = [];
  const shell = {
    words: {},
    store: initial,
    saves,
    getNotepad: () => shell.store,
    setNotepad: text => {
      shell.store = text;
      saves.push(text);
      return shell.refuse ? false : true;
    },
  };
  return shell;
}

test('SIMPLE: the Notes pad reads CortexLab.getNotepad, saves through setNotepad after a pause, and flushes on leaving', async () => {
  const { w, app, type, wait, close } = harness('notebook');
  const shell = (w.CortexLab = notepadShell('Day one.'));
  const handle = w.CortexLabNotebook.mountNotebook(app, {
    lab,
    state: notebookState(),
    onAdd() {},
    onRemove() {},
    onExport() {},
  });
  const block = app.querySelector('[data-labn-notepad]'),
    pad = app.querySelector('#labn-notepad'),
    status = () => app.querySelector('[data-labn-notepad-status]').textContent;
  assert.equal(block.hidden, false);
  assert.equal(block.querySelector('h2').textContent, 'Notes');
  assert.ok(block.compareDocumentPosition(app.querySelector('.labn-work')) & w.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.match(block.querySelector('.labn-hint').textContent, /goes into your download as a “Notes” section/);
  assert.equal(pad.value, 'Day one.');
  assert.equal(pad.getAttribute('data-labn-notepad-text'), '');
  assert.ok(app.querySelector(`label[for="labn-notepad"]`) || pad.getAttribute('aria-labelledby'), 'the pad is named');
  // Debounced: nothing is written on the keystroke, one write after the pause, "Saved" in the status line.
  type(pad, 'Day one. Day two.');
  assert.deepEqual(shell.saves, []);
  assert.equal(status(), 'Saving');
  await wait();
  assert.deepEqual(shell.saves, ['Day one. Day two.']);
  assert.equal(status(), 'Saved');
  // The shell's copy changed elsewhere (the bench shows the same pad): a re-render adopts it when the
  // student is not typing.
  shell.store = 'Written beside the bench.';
  handle.update({});
  assert.equal(pad.value, 'Written beside the bench.');
  // A refused save (storage paused) says so; the text stays on the page.
  shell.refuse = true;
  type(pad, 'Kept here.');
  await wait();
  assert.match(status(), /^Saving is paused/);
  assert.equal(pad.value, 'Kept here.');
  shell.refuse = false;
  // Leaving the page flushes a pending save.
  type(pad, 'Last words.');
  handle.destroy();
  assert.equal(shell.saves[shell.saves.length - 1], 'Last words.');
  close();
  // Without the shell's pair the block is hidden and the page works as before (test F4 + F6 + KB-09).
  const alone = harness('notebook');
  alone.w.CortexLab = { words: {}, getNotepad: () => 'half an API' };
  alone.w.CortexLabNotebook.mountNotebook(alone.app, { lab, state: notebookState(), onAdd() {}, onRemove() {} });
  assert.equal(alone.app.querySelector('[data-labn-notepad]').hidden, true);
  alone.close();
});

test('SIMPLE: the file gets a "## Notes" section between the five sections and the Experiment log, under one Reflection tag', async () => {
  const { w, app, type, close } = harness('notebook');
  const state = notebookState();
  const base = w.CortexLabNotebook.exportMarkdown(state, lab);
  state.notepad = '  \n';
  assert.equal(w.CortexLabNotebook.exportMarkdown(state, lab), base, 'blank notes add nothing');
  state.notepad = 'First thought.\r\n\r\n- a dash line\nSecond <b>thought</b>.\n';
  const md = w.CortexLabNotebook.exportMarkdown(state, lab);
  const block = [
    '## Notes',
    '',
    `${S.ENTRY_TAG.reflection} Free notes, written by the student as they worked.`,
    '',
    'First thought.',
    '',
    '- a dash line',
    'Second <b>thought</b>.',
    '',
  ].join('\n');
  const at = base.indexOf('\n## Experiment log\n') + 1;
  assert.ok(at > 0);
  assert.equal(md, `${base.slice(0, at)}${block}\n${base.slice(at)}`, 'the engine text around it is byte for byte');
  assert.ok(md.indexOf('## Notes') > md.indexOf(`## ${S.SECTION_TEXT['next-steps']}`));
  assert.ok(md.indexOf('## Notes') < md.indexOf('## Experiment log'));
  // Plain copy: the tag line loses its brackets like an entry; print: a heading, escaped text.
  const plain = w.CortexLabNotebook.markdownToPlain(md);
  assert.ok(
    plain.includes('NOTES\n\nReflection: Free notes, written by the student as they worked.\n\nFirst thought.')
  );
  assert.ok(!plain.includes('[Reflection]'));
  const html = w.CortexLabNotebook.markdownToHtml(md);
  assert.ok(html.includes('<h3>Notes</h3>'));
  assert.ok(html.includes('Second &lt;b&gt;thought&lt;/b&gt;.') && !html.includes('<b>thought'));
  // No state.notepad: the shell's getNotepad is asked; neither: nothing.
  delete state.notepad;
  assert.equal(w.CortexLabNotebook.exportMarkdown(state, lab), base);
  w.CortexLab = notepadShell('From the shell.');
  assert.ok(w.CortexLabNotebook.exportMarkdown(state, lab).includes('## Notes\n\n[Reflection] Free notes'));
  assert.ok(w.CortexLabNotebook.exportMarkdown(state, lab).includes('\n\nFrom the shell.\n\n## Experiment log'));
  // On the page, a copy saves the pad first, so the file carries what was just typed.
  const copied = [];
  Object.defineProperty(w.navigator, 'clipboard', {
    value: { writeText: text => (copied.push(text), Promise.resolve()) },
    configurable: true,
  });
  w.CortexLabNotebook.mountNotebook(app, { lab, state, onAdd() {}, onRemove() {} });
  type(app.querySelector('#labn-notepad'), 'Typed, then copied at once.');
  app.querySelector('[data-labn-action="more"]').click();
  app.querySelector('[data-labn-action="copy"]').click();
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(w.CortexLab.saves, ['Typed, then copied at once.'], 'the pending save ran before the export');
  assert.ok(copied[0].includes('\n\nTyped, then copied at once.\n\n## Experiment log'));
  close();
});

test('SIMPLE: an empty report is one line, not five empty headings; a section appears once it holds a note', () => {
  const { w, app, type, close } = harness('notebook');
  const state = freshState();
  w.CortexLabNotebook.mountNotebook(app, {
    lab,
    state,
    onAdd: entry => {
      state.notebook = lab.addEntry(state.notebook, entry, state.runs);
      return entry;
    },
    onRemove() {},
  });
  assert.equal(app.querySelectorAll('.labn-section').length, 0);
  const empty = app.querySelector('[data-labn-no-entries]');
  assert.match(empty.textContent, /^No notes yet\. Use “Add to my report”/);
  assert.ok(!app.textContent.includes('No notes yet. Your file shows'), 'no per-section placeholder');
  app.querySelector('[data-labn-action="add-menu"]').click();
  app.querySelector('[data-labn-add-type="reflection"]').click();
  type(app.querySelector('textarea[data-labn-draft="text"]'), 'One thing I learned.');
  app.querySelector('[data-labn-add-form]').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  assert.deepEqual(texts(app.querySelectorAll('.labn-section h3')), [S.SECTION_TEXT['learning-reflection']]);
  assert.equal(app.querySelector('[data-labn-no-entries]'), null);
  assert.equal(app.querySelectorAll('.labn-entry').length, 1);
  // The file still prints every section, in order, "(no entries)" where the page shows nothing.
  const md = w.CortexLabNotebook.exportMarkdown(state, lab);
  for (const s of S.SECTIONS) assert.ok(md.includes(`## ${S.SECTION_TEXT[s]}`), s);
  assert.equal(md.split('(no entries)').length - 1, 4);
  close();
});

test('SIMPLE: a blank title is filled in from the change when the experiment is saved; a written one is kept', async () => {
  const { w, app, type, wait, close } = harness();
  const state = freshState();
  const saved = [];
  const handle = w.CortexLabNotebook.mountDesigner(app, {
    lab,
    state,
    experimentId: 'exp-1',
    onSave: e => saved.push(e),
  });
  const title = field(app, 'title');
  assert.equal(title.closest('.labn-field').querySelector('.labn-opt').textContent, 'optional');
  assert.match(
    app.querySelector(`#${title.getAttribute('aria-describedby').split(' ')[0]}`).textContent,
    /filled in from your change/
  );
  type(field(app, 'question'), 'Does it?');
  await wait();
  assert.equal(saved[saved.length - 1].title, '', 'no change yet: no title');
  const chip = app.querySelector('input[data-labn-chip-input="changed"]');
  chip.value = 'Development time: longer';
  app.querySelector('[data-labn-action="chip-add"][data-labn-list="changed"]').click();
  await wait();
  assert.equal(saved[saved.length - 1].title, 'Development time: longer vs standard');
  assert.equal(title.value, 'Development time: longer vs standard', 'the field shows it');
  assert.equal(handle.getExperiment().title, 'Development time: longer vs standard');
  type(title, 'My own name');
  await wait();
  assert.equal(saved[saved.length - 1].title, 'My own name');
  // The file heads the experiment with that title (never its id).
  state.experiments['exp-1'] = saved[saved.length - 1];
  state.experimentOrder = ['exp-1'];
  assert.ok(w.CortexLabNotebook.exportMarkdown(state, lab).includes('### My own name'));
  close();
});

test('SIMPLE: the optional fields fold under "More detail"; a gate link opens the fold; an old step=3 or 4 link lands on the last screen', () => {
  const { w, app, type, close } = harness();
  const state = freshState();
  w.CortexLabNotebook.mountDesigner(app, { lab, state, experimentId: 'exp-1', onSave() {} });
  const fold = name => app.querySelector(`button[data-labn-toggle="${name}"]`),
    panel = name => w.document.getElementById(fold(name).getAttribute('aria-controls'));
  assert.equal(fold('more-question').textContent, 'More detail: background, another explanation');
  assert.equal(fold('more-design').textContent, 'More detail: main variable, what you keep the same');
  for (const name of ['glossary', 'more-question', 'more-design']) {
    assert.equal(fold(name).getAttribute('aria-expanded'), 'false', name);
    assert.equal(panel(name).hidden, true, name);
  }
  assert.ok(panel('more-question').contains(field(app, 'background')));
  assert.ok(panel('more-question').contains(field(app, 'alternative')));
  assert.ok(panel('more-design').contains(field(app, 'independentVariable')));
  assert.ok(panel('more-design').contains(app.querySelector('input[data-labn-chip-input="heldComparable"]')));
  // The visible screen 1 asks for the question, the hypothesis, the change, a control, a measure, the runs.
  assert.ok(!panel('more-question').contains(field(app, 'question')));
  assert.ok(!panel('more-question').contains(field(app, 'hypothesis')));
  // A "things left" link to the main variable opens its fold and focuses the field.
  app.querySelector('.labn-reasons a[data-labn-jump="independentVariable"]').click();
  assert.equal(panel('more-design').hidden, false);
  assert.equal(fold('more-design').getAttribute('aria-expanded'), 'true');
  assert.equal(w.document.activeElement, field(app, 'independentVariable'));
  fold('more-design').click();
  assert.equal(panel('more-design').hidden, true);
  // Another explanation is a soft hint: the engine lists it as missing, the screen never blocks on it.
  type(field(app, 'question'), 'q');
  type(field(app, 'hypothesis'), 'h');
  const check = app.querySelector('[data-labn-step-check="1"]').textContent;
  assert.doesNotMatch(check, /Still empty:[^.]*Another explanation/);
  assert.match(check, /Optional, still empty: Background, Another explanation/);
  assert.equal(
    app.querySelectorAll('.labn-reasons li[data-labn-reason]').length,
    lab.canReveal(state.experiments['exp-1'] || {}, state.runs).reasons.length,
    'the gate is the engine’s'
  );
  close();
  // Links written for the old four steps (lab.js labSealedUrl step 3; a module's step 4) open the last screen.
  for (const old of [3, 4, '4']) {
    const h = harness();
    const s = freshState();
    s.experiments['exp-2'] = revealedExperiment();
    s.experimentOrder = ['exp-2'];
    h.w.CortexLabNotebook.mountDesigner(h.app, { lab, state: s, experimentId: 'exp-2', step: old, onSave() {} });
    assert.deepEqual(shownStep(h.app), [2], `step ${old}`);
    assert.ok(
      h.app.querySelector('button[data-labn-toggle="glossary"]').disabled === false,
      'folds stay usable when locked'
    );
    h.close();
  }
});

test('MODE-notebook (§11.7): the run line names a free run as "Free bench"; a practice run (mode set or absent) adds no mode word; no pending badge kind or wording remains', () => {
  const { w, app, close } = harness('notebook');
  const state = freshState();
  state.runs.free = { ...fullRun('free', 'SPEC-SYN-AD-01'), mode: 'free' };
  state.runs.prac = { ...fullRun('prac', 'SPEC-SYN-AD-01'), mode: 'practice' };
  state.runOrder.push('free', 'prac');
  w.CortexLabNotebook.mountNotebook(app, { lab, state, onAdd() {}, onRemove() {}, onExport() {} });
  const title = ref => app.querySelector(`[data-labn-work="run"][data-labn-ref="${ref}"] .labn-work-title`).textContent;
  assert.match(title('free'), /^Run \S+ · Free bench · /, title('free'));
  assert.ok(!title('prac').includes('Practice the procedure'), title('prac'));
  assert.ok(!title('base').includes('bench'), title('base'));
  // Nothing student-facing says pending / instructor (the engine's export heading is not this module's).
  assert.ok(!/Pending instructor|Waiting on the instructor|pending instructor|instructor to define/.test(SOURCE));
  assert.doesNotMatch(SOURCE, /pending: \[/);
  assert.doesNotMatch(SOURCE, /'pending'/);
  assert.ok(!app.textContent.toLowerCase().includes('pending'), 'no "pending" on the report page');
  close();
});

test('MODE-notebook (§11.7): a free run lists its What happened lines (one per reaction) under its line; a practice run has none', () => {
  const { w, app, close } = harness('notebook');
  const state = freshState();
  const reactions = [
    {
      seq: 1,
      step: 'deparaffinize-rehydrate',
      kind: 'reaction',
      text: 'Wax removed; the section is wet and even, in water.',
    },
    {
      seq: 2,
      step: 'development',
      kind: 'no-reaction',
      text: 'No reaction: the developer found no bound silver on the section, so there was nothing to reduce.',
    },
  ];
  state.runs.free = { ...fullRun('free', 'SPEC-SYN-AD-01'), mode: 'free', reactions };
  state.runOrder.push('free');
  w.CortexLabNotebook.mountNotebook(app, { lab, state, onAdd() {}, onRemove() {}, onExport() {} });
  const item = ref => app.querySelector(`[data-labn-work="run"][data-labn-ref="${ref}"]`);
  const list = item('free').querySelector('[data-labn-reactions="free"]');
  assert.ok(list, 'the free run carries a What happened block');
  assert.equal(list.querySelector('.labn-work-reactions-h').textContent, 'What happened');
  assert.deepEqual(
    texts(list.querySelectorAll('li')),
    reactions.map(r => r.text)
  );
  assert.equal(item('base').querySelector('[data-labn-reactions]'), null, 'a practice run lists no reactions');
  // The block sits after the run's line and before its note button.
  const kids = Array.from(item('free').children).map(n => n.className);
  assert.ok(kids.indexOf('labn-work-reactions') > kids.indexOf('labn-work-line'));
  assert.ok(kids.indexOf('labn-work-reactions') < kids.indexOf('labn-textbtn'));
  close();
});

test('OPEN-notebook (§13.6): a What happened line of kind "unknown" always reads "Currently unknown reaction: …" (the engine text kept as is when it already does); other kinds unchanged', () => {
  const { w, app, close } = harness('notebook');
  const state = freshState();
  const reactions = [
    {
      seq: 1,
      jarId: 'x1',
      kind: 'unknown',
      text: 'Currently unknown reaction: Tap water · 3 min on this slide.',
    },
    { seq: 2, jarId: 'x2', kind: 'unknown', text: 'Formic acid · 5 min on this slide.' },
    { seq: 3, jarId: 'x3', kind: 'unknown' },
    { seq: 4, step: 'water-wash', kind: 'reaction', text: 'Rinsed in distilled water.' },
  ];
  state.runs.free = { ...fullRun('free', 'SPEC-SYN-AD-01'), mode: 'free', reactions };
  state.runOrder.push('free');
  w.CortexLabNotebook.mountNotebook(app, { lab, state, onAdd() {}, onRemove() {}, onExport() {} });
  const list = app.querySelector('[data-labn-work="run"][data-labn-ref="free"] [data-labn-reactions="free"]');
  assert.deepEqual(texts(list.querySelectorAll('li')), [
    'Currently unknown reaction: Tap water · 3 min on this slide.',
    'Currently unknown reaction: Formic acid · 5 min on this slide.',
    'Currently unknown reaction.',
    'Rinsed in distilled water.',
  ]);
  assert.doesNotMatch(list.textContent, /error|invalid|not allowed/i, 'an unknown dip is a result');
  close();
});
