// Microscope module (lab-microscope.js) against the shipped data/lab/*.json: deterministic shape
// lists from the specimen seed, shape counts that scale with presence and vanish at presence 0, the
// five illustrative tints, describe() text, the compare difference-table builder, the measurement
// payload shape, and the UX-C one-view layout (PLAN-ALZ-LAB-SIMPLIFY §3.4, contract §8): badge with
// data-lab-label, top bar, reference note, Measure sheet with the rule checkbox, View controls,
// the "Numbers behind this image" expander, plain default words, the control budget, and focus
// after every rebuild. jsdom has no 2D canvas, so getContext is stubbed to null and only the pure
// parts and the DOM are exercised.
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
const ENGINE_SRC = fs.readFileSync(path.join(ROOT, 'silver-lab-core.js'), 'utf8');
const MICRO_SRC = fs.readFileSync(path.join(ROOT, 'lab-microscope.js'), 'utf8');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const perform = (lab, run, steps = S.STEPS) =>
  steps.reduce((r, s, i) => lab.applyEvent(r, { seq: i + 1, type: 'step', step: s }), run);
const fullRun = (lab, id, specimenId, params) => perform(lab, lab.createRun({ id, specimenId, params }));

// A jsdom window with the engine and the microscope evaluated as classic scripts. The shipped
// real-slide library (data/lab/assets.json) is stripped unless `library` is asked for, so the
// drawing tests mount the drawing (REF-micro: with a matching photo the real slide is the default).
const contentFor = library => (library ? content : { ...content, assets: { v: 1, items: [] } });
function harness({ library = false } = {}) {
  const dom = new JSDOM('<!doctype html><div id="app"></div>', {
    url: 'http://localhost/lab?view=microscope',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.HTMLCanvasElement.prototype.getContext = () => null; // jsdom has no 2D canvas
  const context = dom.getInternalVMContext();
  vm.runInContext(ENGINE_SRC, context);
  vm.runInContext(MICRO_SRC, context);
  const lab = w.SilverLab.createLab(contentFor(library));
  return { w, M: w.CortexLabMicroscope, lab, app: w.document.getElementById('app'), close: () => w.close() };
}
function key(w, node, key) {
  node.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

test('the module exposes exactly the contract surface plus pure helpers, and loads in node', () => {
  require('../lab-microscope.js');
  const M = globalThis.CortexLabMicroscope;
  for (const name of ['mount', 'renderSynthetic', 'describe']) assert.equal(typeof M[name], 'function', name);
  for (const name of ['prng', 'shapeList', 'tintFor', 'differenceRows', 'measurementPayload', 'toolsEnabled'])
    assert.equal(typeof M[name], 'function', name);
  // Classic script: no import/export, no Math.random, one global.
  assert.doesNotMatch(MICRO_SRC, /^\s*(import|export)\s/m);
  assert.doesNotMatch(MICRO_SRC, /Math\.random\s*\(/);
  assert.equal((MICRO_SRC.match(/root\.CortexLabMicroscope\s*=/g) || []).length, 1);
  assert.doesNotMatch(MICRO_SRC, /window\.[A-Za-z_$][\w$]*\s*=(?!=)/);
});

test('PRNG and shape lists are deterministic per seed and differ across seeds', () => {
  require('../lab-microscope.js');
  const M = globalThis.CortexLabMicroscope;
  const a = M.prng(101),
    b = M.prng(101),
    c = M.prng(102);
  const seqA = Array.from({ length: 50 }, () => a()),
    seqB = Array.from({ length: 50 }, () => b()),
    seqC = Array.from({ length: 50 }, () => c());
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);
  for (const x of seqA) assert.ok(x >= 0 && x < 1);
  const lab = S.createLab(content),
    spec = lab.getSpecimen('SPEC-SYN-AD-01');
  const first = M.shapeList(spec),
    again = M.shapeList(spec),
    other = M.shapeList(spec, 9999);
  assert.equal(JSON.stringify(first.shapes), JSON.stringify(again.shapes));
  assert.equal(JSON.stringify(first.noise), JSON.stringify(again.noise));
  assert.deepEqual(other.counts, first.counts, 'a different seed keeps the counts');
  assert.notEqual(JSON.stringify(other.shapes), JSON.stringify(first.shapes), 'a different seed moves the shapes');
  const specB = { ...spec, seed: spec.seed + 1 };
  assert.notEqual(JSON.stringify(M.shapeList(specB).shapes), JSON.stringify(first.shapes));
  assert.ok(Object.isFrozen(first.shapes), 'the cached list is frozen');
});

test('shape counts scale linearly with presence and are zero at presence 0', () => {
  require('../lab-microscope.js');
  const M = globalThis.CortexLabMicroscope;
  const sites = S.SITE_CLASSES.filter(s => s !== 'background');
  const specimenWith = p => ({
    id: `T-${p}`,
    seed: 7,
    sites: Object.fromEntries(sites.map(s => [s, { presence: p, reductionSites: 1 }])),
  });
  const base = M.shapeList(specimenWith(1)).counts;
  for (const site of sites) assert.ok(base[site] > 0, `${site} draws something at presence 1`);
  for (const p of [0, 1, 2, 3, 4]) {
    const counts = M.shapeList(specimenWith(p)).counts;
    for (const site of sites) assert.equal(counts[site], base[site] * p, `${site} at presence ${p}`);
  }
  // Shipped specimens: the negative comparison has axons only; LOWCHEM (4) > AD-01 (3) > AD-02 (2).
  const lab = S.createLab(content);
  const neg = M.shapeList(lab.getSpecimen('SPEC-SYN-NEG-01')).counts;
  assert.ok(neg.axon > 0);
  for (const site of ['plaque-core', 'plaque-neurite', 'tangle', 'neuropil-thread']) assert.equal(neg[site], 0, site);
  const low = M.shapeList(lab.getSpecimen('SPEC-SYN-LOWCHEM-01')).counts,
    ad1 = M.shapeList(lab.getSpecimen('SPEC-SYN-AD-01')).counts,
    ad2 = M.shapeList(lab.getSpecimen('SPEC-SYN-AD-02')).counts;
  for (const site of ['plaque-core', 'plaque-neurite', 'tangle', 'neuropil-thread'])
    assert.ok(low[site] > ad1[site] && ad1[site] > ad2[site], site);
  // Every shape names a site class the engine knows.
  for (const shape of M.shapeList(lab.getSpecimen('SPEC-SYN-AD-01')).shapes) assert.ok(sites.includes(shape.site));
});

test('tint mapping covers 0..4, darkens monotonically, and index 0 is invisible', () => {
  require('../lab-microscope.js');
  const M = globalThis.CortexLabMicroscope;
  const lum = hex => {
    const n = parseInt(hex.slice(1), 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  };
  for (const tints of [M.TINTS, M.TINTS_HC]) {
    assert.equal(tints.length, 5);
    assert.equal(tints[0].alpha, 0, 'visibility none draws nothing');
    assert.equal(tints[4].alpha, 1);
    for (let i = 1; i < 5; i++) {
      assert.ok(lum(tints[i].color) < lum(tints[i - 1].color), `tint ${i} is darker than ${i - 1}`);
      assert.ok(tints[i].alpha >= tints[i - 1].alpha, `alpha is non-decreasing at ${i}`);
    }
    assert.ok(lum(tints[4].color) < 0.08, 'near-black at high');
  }
  for (let v = 0; v <= 4; v++) {
    assert.equal(M.tintFor(v), M.TINTS[v]);
    assert.equal(M.tintFor(v, true), M.TINTS_HC[v]);
  }
  assert.equal(M.tintFor(-3), M.TINTS[0]);
  assert.equal(M.tintFor(9), M.TINTS[4]);
  assert.equal(M.tintFor('2'), M.TINTS[2]);
});

test("MODE-FIX-micro-1: describe() is the picture's text alternative in plain words (label, summary, look, caveats) plus objective and view suffixes; a card keeps the engine card text", () => {
  require('../lab-microscope.js');
  const M = globalThis.CortexLabMicroscope;
  const lab = S.createLab(content),
    spec = lab.getSpecimen('SPEC-SYN-AD-01'),
    outcome = lab.resolve(fullRun(lab, 'r1', 'SPEC-SYN-AD-01'));
  const text = M.describe(outcome, spec, lab, { objective: 20, tab: 'layers', zoom: 1.25 });
  assert.ok(text.startsWith(`${S.LABEL_TEXT[S.LABELS.SYNTHETIC]}. `), text.slice(0, 80));
  // The engine's describeOutcome text (ordinals, enum values, raw caveats) stays under Sources.
  assert.ok(!text.includes(lab.describeOutcome(outcome, spec)), 'no longer delegates to lab.describeOutcome');
  assert.doesNotMatch(text, /schematic|ordinal|\bSOP\b|sop-default|registry|Artifacts:|Conditional on: none/);
  for (const plural of ['plaque cores', 'plaque neurites', 'tangles', 'axons', 'neuropil threads'])
    assert.ok(text.toLowerCase().includes(plural), plural);
  assert.ok(
    text.includes(`background ${S.ORDINAL_TEXT[outcome.background]}; contrast ${S.ORDINAL_TEXT[outcome.contrast]}`)
  );
  assert.ok(text.includes(`By eye: ${outcome.look.text}`), 'the by-eye look');
  assert.ok(outcome.caveats.length >= 2, 'the standard run carries rule caveats');
  assert.ok(
    text.includes("Keep in mind: Shorter, standard and longer are ordered places on the model's scale, not times."),
    'caveats in plain words'
  );
  assert.ok(text.includes("No one knows where the course's real times fall on a binding or build-up curve."));
  assert.ok(text.includes('Objective: 20x (approximate).'));
  assert.ok(text.includes('Zoom: 1.25x'));
  assert.ok(text.includes('View: simulated picture with layers.'));
  assert.match(text, /\. Objective: 20x/, 'a period separates the description from the suffix');
  const dflt = M.describe(outcome, spec, lab);
  assert.ok(dflt.endsWith('Objective: 10x (approximate). View: simulated picture.'));
  const card = lab.resolve(fullRun(lab, 'r2', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } }));
  assert.equal(card.label, 'no-basis');
  const cardText = M.describe(card, spec, lab, { compare: true, compareMode: 'swipe' });
  assert.ok(cardText.startsWith(S.LABEL_TEXT['no-basis']));
  assert.ok(cardText.includes('View: simulated picture, compare swipe.'));
  // Without a lab a drawn outcome still describes itself; a card has only the view suffix.
  assert.ok(M.describe(outcome, spec, null).startsWith(`${S.LABEL_TEXT[S.LABELS.SYNTHETIC]}. `));
  assert.equal(M.describe(card, spec, null), 'Objective: 10x (approximate). View: simulated picture.');
  // The shell's plainCaveat (lab.js) is used first when it is loaded; the private copy stays a fallback.
  globalThis.CortexLab = { plainCaveat: t => `SHELL ${t}` };
  try {
    assert.ok(M.plainCaveat('x').startsWith('SHELL x'));
    assert.ok(
      M.describe(outcome, spec, lab).includes('Keep in mind: SHELL Shorter, standard and longer'),
      'shell first, then the private pairs'
    );
  } finally {
    delete globalThis.CortexLab;
  }
});

test('differenceRows builds the per-site table from lab.compare and is empty for no-basis', () => {
  require('../lab-microscope.js');
  const M = globalThis.CortexLabMicroscope;
  const lab = S.createLab(content);
  const base = fullRun(lab, 'b', 'SPEC-SYN-AD-01'),
    ext = fullRun(lab, 'e', 'SPEC-SYN-AD-01', { development: { endpoint: 'extended' } });
  const cmp = lab.compare(base, ext);
  const rows = M.differenceRows(cmp);
  assert.deepEqual(
    rows.map(r => r.site),
    [...S.SITE_CLASSES]
  );
  for (const r of rows) {
    assert.equal(r.siteText, S.SITE_TEXT[r.site]);
    assert.equal(r.delta, cmp.perSite[r.site].delta);
    assert.equal(r.experimental - r.baseline, r.delta);
    assert.equal(r.baselineText, S.ORDINAL_TEXT[r.baseline]);
    assert.equal(r.experimentalText, S.ORDINAL_TEXT[r.experimental]);
  }
  const core = rows.find(r => r.site === 'plaque-core');
  assert.equal(core.delta, 1);
  assert.equal(core.deltaText, '+1');
  assert.equal(core.changed, true);
  const weak = lab.compare(base, fullRun(lab, 'w', 'SPEC-SYN-AD-01', { development: { strength: 'weak' } }));
  const weakCore = M.differenceRows(weak).find(r => r.site === 'plaque-core');
  assert.equal(weakCore.delta, -1);
  assert.equal(weakCore.deltaText, '−1');
  const same = M.differenceRows(lab.compare(base, fullRun(lab, 'b2', 'SPEC-SYN-AD-01')));
  assert.ok(same.every(r => r.deltaText === '0' && !r.changed));
  const card = fullRun(lab, 'c', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } });
  const noBasis = lab.compare(base, card);
  assert.equal(noBasis.label, 'no-basis');
  assert.deepEqual(M.differenceRows(noBasis), []);
  assert.deepEqual(M.differenceRows(null), []);
});

test('measurementPayload has the contract shape and toolsEnabled refuses a card', () => {
  require('../lab-microscope.js');
  const M = globalThis.CortexLabMicroscope;
  const lab = S.createLab(content);
  const run = fullRun(lab, 'run-7', 'SPEC-SYN-AD-01'),
    outcome = lab.resolve(run),
    rule = lab.measurementRules().find(r => r.id === 'roi-lesion-count');
  const payload = M.measurementPayload({ rule, run, outcome, value: 12, note: 'class=tangle' });
  assert.deepEqual(Object.keys(payload).sort(), ['label', 'manual', 'measurementId', 'note', 'runId', 'unit', 'value']);
  assert.deepEqual(payload, {
    measurementId: 'roi-lesion-count',
    runId: 'run-7',
    label: 'illustrative-synthetic',
    value: 12,
    unit: 'count',
    manual: true,
    note: 'class=tangle',
  });
  assert.equal(payload.label, S.LABELS.SYNTHETIC);
  const card = lab.resolve(fullRun(lab, 'run-8', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } }));
  assert.equal(M.toolsEnabled(outcome), true);
  assert.equal(M.toolsEnabled(card), false);
  assert.equal(M.toolsEnabled(null), false);
  assert.equal(M.toolsEnabled({ label: 'validated-prediction' }), false, 'only the synthetic label enables tools');
});

// ---- UX-C helpers: what a sighted student sees by default (jsdom applies no CSS, so visibility
// is structural: not inside [hidden], a closed <details> body, a visually hidden span or a live region).
function hiddenByStructure(el) {
  if (el.closest('[hidden], .labm-sr-only, .lab-sr-only, [aria-live]')) return true;
  for (let d = el.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) {
    const summary = el.closest('summary');
    if (!d.open && !(summary && summary.parentElement === d)) return true;
  }
  return false;
}
function visibleText(rootEl) {
  const w = rootEl.ownerDocument.defaultView,
    walker = rootEl.ownerDocument.createTreeWalker(rootEl, w.NodeFilter.SHOW_TEXT),
    parts = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode())
    if (!hiddenByStructure(n.parentElement)) parts.push(n.nodeValue);
  return parts.join(' ').replace(/\s+/g, ' ');
}
// Visible controls; `widgets` counts a segmented control (.labm-seg) once, like a select.
function controlBudget(rootEl) {
  const list = [...rootEl.querySelectorAll('button, summary, input, select, textarea')].filter(
    el => !hiddenByStructure(el)
  );
  const segs = new Set(list.map(el => el.closest('.labm-seg')).filter(Boolean));
  return { buttons: list.length, widgets: list.filter(el => !el.closest('.labm-seg')).length + segs.size, list };
}
const ENGINE_WORDS = /ordinal|schematic|illustrative-synthetic|Illustrative simulation|uncertainty card|No basis for/i;
const SIM = 'Simulated · not a measurement';
// Engine vocabulary the short live sentence never reads (A11Y-06, K7).
const LIVE_ENGINE_WORDS =
  /ordinal|schematic|illustrative-synthetic|Illustrative simulation|sop-default|Conditional on|Caveats|deposit|R-model|SPEC-/;
const mountOne = (M, lab, app, extra = {}) => {
  const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
    run = fullRun(lab, 'run-1', 'SPEC-SYN-AD-01');
  return M.mount(app, {
    lab,
    specimen: spec,
    runs: [run],
    outcomes: [lab.resolve(run)],
    settings: { reducedMotion: 'on' },
    ...extra,
  });
};

test('mount: one view with a badge (data-lab-label), a top bar, the picture, a reference note and plain words; at most 8 controls', async () => {
  const { w, M, lab, app, close } = harness();
  try {
    const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      run = fullRun(lab, 'run-1', 'SPEC-SYN-AD-01'),
      outcome = lab.resolve(run),
      settings = [],
      closes = [];
    const handle = M.mount(app, {
      lab,
      specimen: spec,
      runs: [run],
      outcomes: [outcome],
      settings: { reducedMotion: 'on', highContrast: false, objective: 10 },
      onSettings: patch => settings.push(patch),
      onMeasurement() {},
      onClose: () => closes.push(1),
    });
    const rootEl = app.querySelector('.labm');
    assert.equal(app.querySelectorAll('[role="tab"], [role="tablist"], [role="tabpanel"]').length, 0, 'no tabs');
    // The badge replaces the banner and carries the engine label.
    const badge = app.querySelector('[data-labm-banner] .lab-badge');
    assert.ok(badge, 'badge above the picture');
    assert.equal(badge.getAttribute('data-lab-badge'), 'simulated');
    assert.equal(badge.getAttribute('data-lab-label'), S.LABELS.SYNTHETIC);
    assert.equal(badge.querySelector('.lab-badge-text').textContent, SIM);
    assert.ok(badge.querySelector('.lab-sr-only').textContent.includes('not a measurement'));
    // Viewer: role=application stage, one canvas named with the short label.
    const stage = app.querySelector('[role="application"]');
    assert.equal(stage.getAttribute('aria-roledescription'), 'microscope viewer');
    assert.equal(stage.tabIndex, 0);
    assert.ok(stage.getAttribute('aria-label').startsWith('Microscope viewer for run-1, simulated picture.'));
    assert.equal(app.querySelectorAll('canvas').length, 1);
    assert.equal(app.querySelector('canvas').getAttribute('aria-label'), `run-1: ${SIM}`);
    // Top bar: objective segmented 4x..40x labeled approximate, Layers toggle; Compare only for two runs.
    assert.equal(
      [...app.querySelectorAll('.labm-toolbar .labm-seg [data-labm-objective]')].map(b => b.textContent).join(),
      '4x,10x,20x,40x'
    );
    assert.ok(app.querySelector('.labm-toolbar').textContent.includes('approximate'));
    assert.equal(app.querySelector('[data-labm-compare-group]').hidden, true, 'no Compare toggle for one run');
    assert.equal(app.querySelector('[data-labm-layers-toggle]').getAttribute('aria-pressed'), 'false');
    // REF-micro: with no real photo for this condition, one line under the picture says so (no badge).
    const ref = app.querySelector('.labm-below [data-labm-reference="none"]');
    assert.equal(
      ref.textContent,
      "No real photo of this condition is in the library; this drawing is the model's picture."
    );
    assert.equal(ref.querySelector('[data-lab-badge]'), null);
    assert.equal(app.querySelector('[data-labm-view-group]').hidden, true, 'no Picture switch without a photo');
    assert.equal(app.querySelectorAll('img').length, 0);
    // One Measure button; View controls and Numbers are closed disclosures.
    assert.equal(app.querySelectorAll('[data-labm-measure-open]').length, 1);
    assert.equal(app.querySelector('[data-labm-tools]').hidden, true, 'sheet closed');
    assert.equal(app.querySelector('[data-labm-view-controls]').tagName, 'DETAILS');
    assert.equal(app.querySelector('[data-labm-view-controls]').open, false);
    assert.equal(app.querySelector('[data-labm-numbers]').open, false);
    assert.equal(app.querySelector('[data-labm-numbers] summary').textContent, 'Numbers behind this image');
    // Budget and words: at most 8 visible controls, no engine vocabulary in the default view.
    const budget = controlBudget(rootEl);
    assert.ok(budget.buttons <= 8, `visible controls ${budget.buttons}`);
    assert.equal(budget.widgets, 5, 'objective, Layers, Measure, View controls, Numbers');
    const seen = visibleText(rootEl);
    assert.doesNotMatch(seen, ENGINE_WORDS, seen);
    assert.ok(seen.includes(SIM));
    assert.ok(seen.includes('Shading follows the model scale, not an amount.'));
    // A11Y-06: nothing is announced on mount (the bench remounts the viewer on every redraw); the
    // engine's full description is the visible text alternative inside Numbers.
    const live = app.querySelector('[aria-live="polite"]');
    assert.equal(live, app.querySelector('[data-labm-live]'), 'the summary region is the first aria-live match');
    await sleep(200);
    assert.equal(live.textContent, '', 'no announcement on mount');
    const textAlt = app.querySelector('[data-labm-numbers] [data-labm-text-alt]').textContent;
    assert.ok(textAlt.startsWith(S.LABEL_TEXT[S.LABELS.SYNTHETIC]), textAlt.slice(0, 80));
    assert.ok(textAlt.includes('Objective: 10x (approximate)'));
    // Keyboard on the viewer (keys unchanged).
    key(w, stage, '3');
    assert.equal(handle.state().objective, 20);
    assert.deepEqual({ ...settings.at(-1) }, { objective: 20 });
    assert.equal(app.querySelector('[data-labm-objective="20"]').getAttribute('aria-pressed'), 'true');
    const before = handle.state();
    key(w, stage, 'ArrowRight');
    assert.ok(handle.state().cx > before.cx, 'arrow pans');
    key(w, stage, '+');
    assert.ok(handle.state().zoom > 1, 'plus zooms (synchronously under reduced motion)');
    key(w, stage, '-');
    key(w, stage, '0');
    assert.equal(handle.state().zoom, 1);
    key(w, app.querySelector('[role="application"]'), 'l');
    assert.equal(handle.state().tab, 'layers');
    assert.equal(handle.state().layers, true);
    await sleep(200);
    assert.ok(
      live.textContent.startsWith('Simulated, not a measurement. run-1, 20x, layers on: Plaque cores '),
      live.textContent
    );
    assert.ok(live.textContent.length < 300, `short: ${live.textContent.length}`);
    assert.doesNotMatch(live.textContent, LIVE_ENGINE_WORDS);
    assert.equal(rootEl.getAttribute('data-labm-tab'), 'layers');
    assert.equal(app.querySelector('[data-labm-layers-toggle]').getAttribute('aria-pressed'), 'true');
    assert.ok(app.querySelector('[data-labm-legend]').textContent.includes('dashed outline = where lesions are'));
    assert.equal(app.querySelectorAll('[data-labm-numbers] [data-labm-layer]').length, 5, 'five layer choices');
    const table = app.querySelector('[data-labm-numbers] .labm-table');
    assert.ok(table.textContent.includes('model scale'));
    for (const site of S.SITE_CLASSES) assert.ok(table.textContent.includes(S.SITE_TEXT[site]), site);
    assert.ok(table.textContent.includes('moderate'));
    assert.ok(table.textContent.includes('Bound silver') && table.textContent.includes('ionic bound'));
    assert.doesNotMatch(table.textContent, /\d of 4/, 'words, never digits');
    assert.ok(app.querySelector('[data-labm-scale]').textContent.startsWith('Model scale: none · trace · low'));
    key(w, app.querySelector('[role="application"]'), 'l');
    assert.equal(handle.state().tab, 'simulation');
    key(w, app.querySelector('[role="application"]'), 'Escape');
    assert.equal(closes.length, 1, 'Esc calls onClose');
    // High contrast lives in View controls and is a settings patch.
    app.querySelector('[data-labm-view-controls] [data-labm-contrast]').click();
    assert.deepEqual({ ...settings.at(-1) }, { highContrast: true });
    assert.ok(rootEl.classList.contains('labm-hc'));
    // tab: 'observed' (old links) opens the same single view.
    handle.update({ tab: 'observed' });
    assert.equal(handle.state().tab, 'simulation');
    assert.equal(app.querySelectorAll('canvas').length, 1);
    handle.update({ tab: 'layers' });
    assert.equal(handle.state().layers, true);
    handle.destroy();
    assert.equal(app.children.length, 0, 'destroy removes every node');
    const layered = mountOne(M, lab, app, { tab: 'layers' });
    assert.equal(layered.state().tab, 'layers');
    layered.destroy();
  } finally {
    close();
  }
});

test('mount: one Compare menu (two runs only) holds side by side / swipe and the one-run choices; plain compare and contrast lines; differences in the Numbers expander; a card side stays visible as Not modeled', async () => {
  const { w, M, lab, app, close } = harness();
  try {
    const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      base = fullRun(lab, 'run-1', 'SPEC-SYN-AD-01'),
      ext = fullRun(lab, 'run-2', 'SPEC-SYN-AD-01', { development: { endpoint: 'extended' } });
    const handle = M.mount(app, {
      lab,
      specimen: spec,
      runs: [base, ext],
      outcomes: [lab.resolve(base), lab.resolve(ext)],
      settings: { reducedMotion: 'on' },
    });
    const rootEl = app.querySelector('.labm'),
      menuBtn = app.querySelector('[data-labm-compare-toggle]'),
      menu = app.querySelector('[data-labm-compare-menu]'),
      [o0, o1] = [lab.resolve(base), lab.resolve(ext)];
    assert.equal(handle.state().compare, true, 'two outcomes open in compare mode');
    assert.equal(handle.state().compareMode, 'side');
    assert.equal(app.querySelector('[data-labm-compare-group]').hidden, false);
    // K9: one Compare button (a disclosure) whose menu holds the modes and the one-run choices.
    assert.equal(menuBtn.getAttribute('aria-expanded'), 'false');
    assert.equal(menuBtn.getAttribute('aria-controls'), menu.id);
    assert.equal(menuBtn.hasAttribute('aria-pressed'), false, 'a menu button, not a toggle');
    assert.equal(menuBtn.textContent, 'Compare: side by side');
    assert.equal(menu.hidden, true, 'the menu starts closed');
    assert.ok(menu.contains(app.querySelector('[data-labm-compare-modes]')), 'modes sit in the menu');
    assert.ok(menu.contains(app.querySelector('[data-labm-side-group]')), 'one-run choices sit in the menu');
    assert.equal(app.querySelector('[data-labm-compare-mode="side"]').getAttribute('aria-pressed'), 'true');
    assert.equal(app.querySelector('[data-labm-side="0"]').getAttribute('aria-pressed'), 'false');
    assert.equal(app.querySelector('[data-labm-side="1"]').textContent, 'Experimental: run-2 only');
    assert.equal(app.querySelectorAll('canvas').length, 2, 'side by side');
    assert.ok(rootEl.classList.contains('labm-pair'));
    // One badge for two runs with the same label.
    assert.equal(app.querySelectorAll('[data-labm-banner] [data-lab-label]').length, 1);
    // Plain summary under the pictures (KB-26: the background is named, not counted as a sixth
    // site) and the contrast line (F2: same model contrast although the picture looks crisper).
    assert.equal(
      app.querySelector('[data-labm-compare-summary]').textContent,
      'Experimental vs baseline: Drawn darker for all five structures and the background (model scale). The table is under “Numbers behind this image”.'
    );
    assert.equal(o0.contrast, o1.contrast, 'longer development keeps the model contrast');
    assert.equal(
      app.querySelector('.labm-below [data-labm-compare-contrast]').textContent,
      `Same model contrast in both (${S.ORDINAL_TEXT[o0.contrast]}): the background darkened too.`
    );
    const section = app.querySelector('[data-labm-compare]');
    assert.ok(section.closest('[data-labm-numbers]'), 'the difference table is inside Numbers');
    assert.equal(section.hidden, false);
    const rows = [...section.querySelectorAll('tbody tr')];
    assert.equal(rows.length, S.SITE_CLASSES.length);
    assert.ok(rows.every(r => r.classList.contains('labm-changed')));
    assert.ok(rows.every(r => r.querySelector('.labm-delta').textContent === '+1'));
    assert.ok(section.textContent.includes('R-model-03') && section.textContent.includes('R-model-04'));
    assert.ok(section.textContent.includes(lab.getRule('R-model-03').title), 'rule titles first');
    assert.ok(section.textContent.includes('Why the model did this'));
    assert.ok(section.textContent.includes('Keep in mind'));
    assert.ok(section.textContent.includes('development.endpoint'));
    assert.ok(section.textContent.includes('Longer development is assumed'), 'caveats printed');
    assert.equal(app.querySelectorAll('[data-labm-numbers] .labm-table-wrap .labm-table').length, 3);
    // Budget with Compare on and the menu closed: objective (4 segments), Compare, Layers, Measure,
    // View controls, Numbers = 9 buttons / 6 widgets (was 11 / 7 with modes and runs on the bar).
    const budget = controlBudget(rootEl);
    assert.equal(budget.buttons, 9, budget.list.map(el => el.textContent.trim()).join(' | '));
    assert.equal(budget.widgets, 6);
    assert.doesNotMatch(visibleText(rootEl), ENGINE_WORDS);
    // Swipe from the menu: one canvas and a split slider; the menu closes on the choice.
    menuBtn.click();
    assert.equal(menu.hidden, false);
    assert.equal(menuBtn.getAttribute('aria-expanded'), 'true');
    assert.equal(handle.state().menu, true);
    app.querySelector('[data-labm-compare-mode="swipe"]').click();
    assert.equal(handle.state().compareMode, 'swipe');
    assert.equal(menu.hidden, true, 'a choice closes the menu');
    assert.equal(menuBtn.textContent, 'Compare: swipe');
    assert.equal(app.querySelectorAll('canvas').length, 1);
    assert.equal(app.querySelector('[data-labm-split-wrap]').hidden, false);
    assert.equal(controlBudget(rootEl).buttons, 10, 'the split slider while swiping');
    assert.ok(app.querySelector('[data-labm-compare-contrast]'), 'the contrast line shows while swiping too');
    await sleep(200);
    const compareLive = app.querySelector('[aria-live="polite"]').textContent;
    assert.ok(
      compareLive.startsWith(
        'Simulated, not a measurement. Comparing the baseline and experimental runs, swipe, 10x: Drawn darker for all five structures and the background (model scale). Same model contrast in both'
      ),
      compareLive
    );
    assert.ok(compareLive.length < 300, `short: ${compareLive.length}`);
    assert.doesNotMatch(compareLive, LIVE_ENGINE_WORDS);
    // C toggles compare off: the menu button says which run shows, the section hides.
    key(w, app.querySelector('[role="application"]'), 'c');
    assert.equal(handle.state().compare, false);
    assert.equal(menuBtn.textContent, 'Compare: off (baseline shown)');
    assert.equal(app.querySelector('[data-labm-side="0"]').getAttribute('aria-pressed'), 'true');
    assert.equal(app.querySelector('[data-labm-compare-mode="swipe"]').getAttribute('aria-pressed'), 'false');
    assert.equal(section.hidden, true);
    assert.equal(controlBudget(rootEl).buttons, 9);
    menuBtn.click();
    app.querySelector('[data-labm-side="1"]').click();
    assert.equal(handle.state().active, 1);
    assert.equal(menuBtn.textContent, 'Compare: off (experimental shown)');
    await sleep(200);
    assert.ok(
      app
        .querySelector('[aria-live="polite"]')
        .textContent.startsWith('Simulated, not a measurement. Experimental run, 10x: ')
    );
    // Side by side again from the menu.
    menuBtn.click();
    app.querySelector('[data-labm-compare-mode="side"]').click();
    assert.equal(handle.state().compare, true);
    assert.equal(handle.state().compareMode, 'side');
    assert.equal(app.querySelectorAll('canvas').length, 2);
    // A card on the experimental side: two badges, a visible Not modeled line with what is needed.
    const card = fullRun(lab, 'run-3', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } });
    handle.update({ runs: [base, card], outcomes: [lab.resolve(base), lab.resolve(card)], compare: true });
    assert.equal(handle.state().compare, true);
    assert.deepEqual(
      [...app.querySelectorAll('[data-labm-banner] [data-lab-label]')].map(b => b.getAttribute('data-lab-label')),
      ['illustrative-synthetic', 'no-basis']
    );
    assert.equal(
      app.querySelector('[data-labm-banner] [data-lab-badge="not-modeled"] .lab-badge-text').textContent,
      'Not modeled'
    );
    const line = app.querySelector('.labm-below [data-labm-card="1"]');
    assert.ok(line.textContent.startsWith('Experimental: The model has no rule for this change'), line.textContent);
    assert.ok(line.textContent.includes('What would be needed: a sourced rule for washes.condition=deviated.'));
    assert.equal(section.querySelectorAll('tbody tr').length, 0, 'no delta table for no-basis');
    assert.ok(section.textContent.includes('Not modeled: no per-site difference'));
    const detail = app.querySelector('[data-labm-numbers] [data-labm-card-detail="1"]');
    assert.ok(detail.textContent.includes('No sourced rule covers washes.condition = deviated'));
    assert.ok(detail.textContent.includes('Suggested next:'));
    assert.equal(app.querySelector('[data-labm-compare-summary]'), null, 'the card line already explains');
    assert.equal(app.querySelector('[data-labm-compare-contrast]'), null, 'no contrast line without two pictures');
    handle.destroy();
  } finally {
    close();
  }
});

test('mount: ONE Measure button opens a sheet of five tools; the rule is confirmed with a checkbox before the tool UI; payloads unchanged; tools disabled on a card', async () => {
  const { w, M, lab, app, close } = harness();
  try {
    const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      run = fullRun(lab, 'run-1', 'SPEC-SYN-AD-01'),
      outcome = lab.resolve(run),
      taken = [];
    const handle = M.mount(app, {
      lab,
      specimen: spec,
      runs: [run],
      outcomes: [outcome],
      settings: { reducedMotion: 'on' },
      onMeasurement: m => taken.push(m),
    });
    const rules = lab.measurementRules(),
      measure = app.querySelector('[data-labm-measure-open]'),
      sheet = app.querySelector('[data-labm-tools]');
    assert.equal(measure.textContent.trim(), 'Measure');
    assert.equal(measure.getAttribute('aria-expanded'), 'false');
    assert.equal(measure.getAttribute('aria-controls'), sheet.id);
    assert.equal(sheet.hidden, true);
    measure.click();
    assert.equal(sheet.hidden, false);
    assert.equal(measure.getAttribute('aria-expanded'), 'true');
    assert.equal(handle.state().sheet, true);
    const buttons = [...sheet.querySelectorAll('[data-labm-tool]')];
    assert.deepEqual(
      buttons.map(b => b.getAttribute('data-labm-tool')),
      Array.from(rules, r => r.id)
    );
    assert.equal(buttons.length, 5);
    assert.ok(buttons.every(b => !b.disabled && b.querySelector('.labm-tool-line').textContent.length > 10));
    assert.equal(
      sheet.querySelector('[data-labm-tool="roi-lesion-count"] .labm-tool-line').textContent,
      'Count one kind of lesion inside 9 fixed regions.'
    );
    assert.equal(app.querySelectorAll('[role="dialog"]').length, 0, 'no modal: the rule sits in the sheet');
    // Picking a tool shows its full rule and the checkbox, not the tool.
    const roi = rules.find(r => r.id === 'roi-lesion-count');
    sheet.querySelector('[data-labm-tool="roi-lesion-count"]').click();
    assert.equal(handle.state().tool, 'roi-lesion-count');
    const pane = () => sheet.querySelector('[data-labm-tool-pane="roi-lesion-count"]');
    assert.ok(pane().textContent.includes(roi.rule));
    const ok = () => pane().querySelector('[data-labm-rule-ok]');
    assert.equal(ok().type, 'checkbox');
    assert.equal(ok().checked, false);
    assert.equal(app.querySelector('[data-labm-tool-form]'), null, 'no tool before the rule is confirmed');
    assert.equal(sheet.querySelector('[data-labm-tool="roi-lesion-count"]').getAttribute('aria-expanded'), 'true');
    ok().focus();
    ok().click();
    assert.equal(ok().checked, true);
    assert.equal(w.document.activeElement, ok(), 'focus stays on the checkbox after the rebuild');
    const form = app.querySelector('[data-labm-tool-form="roi-lesion-count"]');
    assert.ok(form);
    assert.equal(form.querySelectorAll('[data-labm-roi]').length, 9, 'fixed 3x3 grid of regions');
    // Missing criterion is refused.
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(taken.length, 0);
    assert.ok(form.querySelector('[role="alert"]').textContent.includes('criterion'));
    const crit = form.querySelector('[data-labm-field="criterion"]');
    crit.value = 'fully inside the region';
    crit.dispatchEvent(new w.Event('input', { bubbles: true }));
    for (const [i, v] of [
      [3, '2'],
      [8, '3'],
    ]) {
      const box = form.querySelector(`[data-labm-roi="${i}"]`);
      box.value = v;
      box.dispatchEvent(new w.Event('input', { bubbles: true }));
    }
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(taken.length, 1);
    assert.deepEqual(Object.keys(taken[0]).sort(), [
      'label',
      'manual',
      'measurementId',
      'note',
      'runId',
      'unit',
      'value',
    ]);
    assert.equal(taken[0].measurementId, 'roi-lesion-count');
    assert.equal(taken[0].runId, 'run-1');
    assert.equal(taken[0].label, 'illustrative-synthetic');
    assert.equal(taken[0].value, 5);
    assert.equal(taken[0].unit, 'count');
    assert.equal(taken[0].manual, true);
    assert.ok(taken[0].note.includes('criterion="fully inside the region"') && taken[0].note.includes('objective=10x'));
    assert.ok(app.querySelector('[data-labm-status]').textContent.startsWith('Recorded: Count lesions = 5 (count)'));
    assert.ok(app.querySelector('[data-labm-status]').textContent.includes(SIM));
    // The rule is not asked for again; unticking it hides the tool.
    sheet.querySelector('[data-labm-tool="roi-lesion-count"]').click();
    assert.equal(ok().checked, true);
    assert.ok(app.querySelector('[data-labm-tool-form="roi-lesion-count"]'));
    ok().click();
    assert.equal(app.querySelector('[data-labm-tool-form]'), null);
    ok().click();
    // Blinded score: manual 1..5 with the caveat.
    sheet.querySelector('[data-labm-tool="blinded-quality-score"]').click();
    assert.equal(sheet.querySelectorAll('[data-labm-tool-pane]').length, 1, 'one tool open at a time');
    sheet.querySelector('[data-labm-rule-ok]').click();
    const score = app.querySelector('[data-labm-tool-form="blinded-quality-score"]');
    assert.ok(score.textContent.includes('not a measurement of protein or pathology'));
    assert.equal(score.querySelectorAll('input[type="radio"]').length, 5);
    // Contrast without a canvas falls back to the model-state value and says so.
    sheet.querySelector('[data-labm-tool="contrast-ordinal"]').click();
    sheet.querySelector('[data-labm-rule-ok]').click();
    const contrast = app.querySelector('[data-labm-tool-form="contrast-ordinal"]');
    assert.ok(contrast.textContent.includes(`The model gives: ${S.ORDINAL_TEXT[outcome.contrast]} contrast.`));
    contrast.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(taken.length, 2);
    assert.equal(taken[1].measurementId, 'contrast-ordinal');
    assert.equal(taken[1].value, outcome.contrast);
    assert.equal(taken[1].manual, false);
    assert.ok(taken[1].note.includes('no 2D canvas'));
    assert.equal(taken[1].unit, 'ordinal', 'the payload keeps the engine unit');
    assert.ok(app.querySelector('[data-labm-status]').textContent.includes('(steps on the model scale)'));
    assert.doesNotMatch(app.querySelector('[data-labm-status]').textContent, ENGINE_WORDS);
    // Esc inside the sheet closes it and returns to Measure.
    const firstTool = sheet.querySelector('[data-labm-tool]');
    firstTool.focus();
    key(w, firstTool, 'Escape');
    assert.equal(sheet.hidden, true);
    assert.equal(handle.state().sheet, false);
    assert.equal(handle.state().tool, null);
    assert.equal(w.document.activeElement, measure);
    // A card disables every tool and says why; the canvas and badge say Not modeled.
    const cardRun = fullRun(lab, 'run-2', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } }),
      card = lab.resolve(cardRun);
    assert.equal(card.label, 'no-basis');
    handle.update({ runs: [cardRun], outcomes: [card] });
    measure.click();
    const disabled = [...sheet.querySelectorAll('[data-labm-tool]')];
    assert.equal(disabled.length, rules.length);
    assert.ok(
      disabled.every(b => b.disabled),
      'tools disabled on an uncertainty card'
    );
    assert.ok(sheet.querySelector('[data-labm-tools-note]').textContent.startsWith('Nothing to measure'));
    assert.equal(app.querySelector('[data-labm-tool-form]'), null);
    const badge = app.querySelector('[data-labm-banner] .lab-badge');
    assert.equal(badge.getAttribute('data-lab-badge'), 'not-modeled');
    assert.equal(badge.getAttribute('data-lab-label'), 'no-basis');
    assert.equal(app.querySelector('canvas').getAttribute('aria-label'), 'run-2: Not modeled');
    assert.ok(app.querySelector('[data-labm-card="0"]').textContent.includes('What would be needed'));
    assert.equal(app.querySelector('[data-labm-caption]'), null, 'no shading note without a picture');
    disabled[0].click();
    assert.equal(app.querySelector('[data-labm-tool-pane]'), null, 'a disabled tool opens nothing');
    assert.equal(taken.length, 2);
    handle.destroy();
  } finally {
    close();
  }
});

test('renderSynthetic returns null without a 2D context; referenceAsset skips unknown rights; an asset with no role or looks is never shown (the fallback line stays)', () => {
  const { M, lab, app, close } = harness();
  try {
    const canvas = app.ownerDocument.createElement('canvas');
    assert.equal(M.renderSynthetic(canvas, { specimen: lab.getSpecimen('SPEC-SYN-AD-01'), outcome: null }), null);
    assert.equal(M.referenceAsset(lab, lab.getSpecimen('SPEC-SYN-AD-01')), null, 'the harness strips the library');
    const items = [
      {
        id: 'A-1',
        kind: 'reference-image',
        label: 'observed-reference',
        specimenId: 'X',
        rights: { status: 'unknown' },
        src: '/x.png',
      },
      {
        id: 'A-2',
        kind: 'reference-image',
        label: 'observed-reference',
        specimenId: 'X',
        rights: { status: 'cleared' },
        src: '/y.png',
        description: 'Cleared slide',
      },
    ];
    const fake = { content: { assets: { items } } };
    assert.equal(M.referenceAsset(fake, { id: 'X' }).id, 'A-2', 'unknown rights are never shown');
    // Mounted: the cleared asset replaces the "none yet" line, separate from the simulated picture.
    const spec = { ...lab.getSpecimen('SPEC-SYN-AD-01') },
      run = fullRun(lab, 'run-1', 'SPEC-SYN-AD-01');
    const withAsset = {
      ...lab,
      content: { ...lab.content, assets: { items: [{ ...items[1], specimenId: spec.id }] } },
    };
    const handle = M.mount(app, { lab: withAsset, specimen: spec, runs: [run], outcomes: [lab.resolve(run)] });
    // REF-micro: an asset without a role and looks matches no run: the drawing, the fallback line, no img.
    assert.equal(app.querySelector('figure[data-labm-reference]'), null);
    assert.equal(app.querySelectorAll('img').length, 0);
    assert.ok(app.querySelector('.labm-below [data-labm-reference="none"]'));
    assert.equal(app.querySelector('[data-lab-badge="reference-none"]'), null);
    assert.deepEqual(M.referenceSlides(withAsset, lab.resolve(run), spec), []);
    handle.destroy();
  } finally {
    close();
  }
});

test('mount: focus is never dropped to body: Record / Close tool, the rule checkbox, Layers, compare keys, run choice and Esc all land on a control (A3)', () => {
  const { w, M, lab, app, close } = harness();
  try {
    const doc = w.document,
      spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      base = fullRun(lab, 'run-1', 'SPEC-SYN-AD-01'),
      ext = fullRun(lab, 'run-2', 'SPEC-SYN-AD-01', { development: { endpoint: 'extended' } });
    const handle = mountOne(M, lab, app, { onMeasurement() {} });
    app.querySelector('[data-labm-measure-open]').click();
    app.querySelector('[data-labm-tool="tissue-coverage"]').click();
    app.querySelector('[data-labm-rule-ok]').click();
    const form = app.querySelector('[data-labm-tool-form="tissue-coverage"]');
    const cells = form.querySelector('[data-labm-field="cells"]');
    cells.value = '12';
    cells.dispatchEvent(new w.Event('input', { bubbles: true }));
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.focus();
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(app.querySelector('[data-labm-tool-form]'), null, 'the form is gone after recording');
    assert.equal(doc.activeElement, app.querySelector('[data-labm-tool="tissue-coverage"]'));
    assert.equal(app.querySelector('[data-labm-status]').tabIndex, -1, 'the status line is the focus fallback');
    app.querySelector('[data-labm-tool="tissue-coverage"]').click();
    const closeBtn = app.querySelector('[data-labm-tool-close]');
    closeBtn.focus();
    closeBtn.click();
    assert.equal(app.querySelector('[data-labm-tool-pane]'), null);
    assert.equal(doc.activeElement, app.querySelector('[data-labm-tool="tissue-coverage"]'));
    // An unread rule: its pane also has Close tool.
    app.querySelector('[data-labm-tool="artifact-area"]').click();
    const closeUnread = app.querySelector('[data-labm-tool-pane="artifact-area"] [data-labm-tool-close]');
    closeUnread.focus();
    closeUnread.click();
    assert.equal(doc.activeElement, app.querySelector('[data-labm-tool="artifact-area"]'));
    // The sheet's Close returns to Measure.
    app.querySelector('[data-labm-measure-close]').click();
    assert.equal(doc.activeElement, app.querySelector('[data-labm-measure-open]'));
    // Layers toggle: the stage is rebuilt, focus stays on the toggle.
    const layers = app.querySelector('[data-labm-layers-toggle]');
    layers.focus();
    layers.click();
    assert.equal(doc.activeElement, layers);
    // Keys on the stage rebuild the stage: focus follows to the new one.
    let stage = app.querySelector('[role="application"]');
    stage.focus();
    key(w, stage, 'l');
    assert.notEqual(app.querySelector('[role="application"]'), stage, 'rebuilt');
    assert.equal(doc.activeElement, app.querySelector('[role="application"]'));
    handle.destroy();
    // Two runs: C off and the measure-side buttons inside the sheet.
    const two = M.mount(app, {
      lab,
      specimen: spec,
      runs: [base, ext],
      outcomes: [lab.resolve(base), lab.resolve(ext)],
      settings: { reducedMotion: 'on' },
    });
    stage = app.querySelector('[role="application"]');
    stage.focus();
    key(w, stage, 'c');
    assert.equal(doc.activeElement, app.querySelector('[role="application"]'));
    // The Compare menu: opening keeps focus on its button; a choice closes it and returns there;
    // Esc inside it and a press outside it close it too.
    const menuBtn = app.querySelector('[data-labm-compare-toggle]'),
      menu = app.querySelector('[data-labm-compare-menu]');
    menuBtn.focus();
    menuBtn.click();
    assert.equal(menu.hidden, false);
    assert.equal(doc.activeElement, menuBtn);
    const sideBtn = app.querySelector('[data-labm-compare-mode="side"]');
    sideBtn.focus();
    sideBtn.click();
    assert.equal(two.state().compare, true);
    assert.equal(menu.hidden, true);
    assert.equal(doc.activeElement, menuBtn, 'focus returns to the Compare button');
    menuBtn.click();
    const swipeBtn = app.querySelector('[data-labm-compare-mode="swipe"]');
    swipeBtn.focus();
    key(w, swipeBtn, 'Escape');
    assert.equal(menu.hidden, true, 'Esc closes the menu');
    assert.equal(two.state().compareMode, 'side', 'Esc chooses nothing');
    assert.equal(doc.activeElement, menuBtn);
    menuBtn.click();
    app.querySelector('[data-labm-measure-open]').dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
    assert.equal(menu.hidden, true, 'a press outside closes the menu');
    menuBtn.click();
    app.querySelector('[data-labm-side="0"]').dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
    assert.equal(menu.hidden, false, 'a press inside keeps it open');
    menuBtn.click();
    assert.equal(menu.hidden, true, 'the button closes it again');
    app.querySelector('[data-labm-measure-open]').click();
    const pick = app.querySelector('[data-labm-measure-side="1"]');
    pick.focus();
    pick.click();
    assert.equal(two.state().active, 1);
    assert.equal(doc.activeElement, app.querySelector('[data-labm-measure-side="1"]'));
    assert.notEqual(doc.activeElement, doc.body);
    two.destroy();
  } finally {
    close();
  }
});

test('mount: headingLevel 2 or 3 (default 3) sets the sheet and difference headings, the tool title sits one level lower', () => {
  const { M, lab, app, close } = harness();
  try {
    const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      base = fullRun(lab, 'run-1', 'SPEC-SYN-AD-01'),
      ext = fullRun(lab, 'run-2', 'SPEC-SYN-AD-01', { development: { endpoint: 'extended' } }),
      opts = {
        lab,
        specimen: spec,
        runs: [base, ext],
        outcomes: [lab.resolve(base), lab.resolve(ext)],
        settings: { reducedMotion: 'on' },
      },
      texts = sel => [...app.querySelectorAll(sel)].map(n => n.textContent.trim()),
      tissue = lab.measurementRules().find(r => r.id === 'tissue-coverage');
    const dflt = M.mount(app, opts);
    assert.equal(dflt.state().headingLevel, 3);
    assert.ok(texts('.labm h3').includes('Measurement tools'));
    assert.ok(texts('.labm h3').some(t => t.startsWith('Per-site difference')));
    assert.equal(app.querySelectorAll('.labm h2').length, 0);
    app.querySelector('[data-labm-measure-open]').click();
    app.querySelector('[data-labm-tool="tissue-coverage"]').click();
    assert.equal(app.querySelector('[data-labm-tool-pane] h4').textContent, tissue.title);
    dflt.destroy();
    const two = M.mount(app, { ...opts, headingLevel: 2 });
    assert.equal(two.state().headingLevel, 2);
    assert.ok(texts('.labm h2').includes('Measurement tools'));
    assert.ok(texts('.labm h2').some(t => t.startsWith('Per-site difference')));
    assert.equal(app.querySelectorAll('.labm h3, .labm h4').length, 0, 'nothing below the section level yet');
    app.querySelector('[data-labm-measure-open]').click();
    app.querySelector('[data-labm-tool="tissue-coverage"]').click();
    assert.equal(app.querySelector('[data-labm-tool-pane] h3').textContent, tissue.title);
    assert.equal(app.querySelectorAll('.labm h4').length, 0);
    for (const hd of app.querySelectorAll('.labm h2, .labm h3'))
      assert.ok(hd.classList.contains('labm-h') || hd.classList.contains('labm-h-sub'), 'level-independent class');
    two.update({ headingLevel: 3 });
    assert.equal(two.state().headingLevel, 3);
    assert.ok(texts('.labm h3').includes('Measurement tools'));
    two.destroy();
    const bad = M.mount(app, { ...opts, headingLevel: 5 });
    assert.equal(bad.state().headingLevel, 3, 'anything but 2 falls back to 3');
    bad.destroy();
    const css = fs.readFileSync(path.join(ROOT, 'lab-microscope.css'), 'utf8');
    assert.match(css, /\.labm \.labm-h \{/);
    assert.match(css, /\.labm \.labm-h-sub \{/);
    assert.doesNotMatch(css, /\.labm(?:-[a-z]+)? h[2-4] \{/, 'no level-bound heading rule remains');
  } finally {
    close();
  }
});

test('mount: pans, zooms and objectives announce a short delta; view changes announce one short plain sentence; the full description (text alternative) lists the layers (G1, G2, A11Y-06)', async () => {
  const { w, M, lab, app, close } = harness();
  try {
    const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      run = fullRun(lab, 'run-1', 'SPEC-SYN-AD-01'),
      outcome = lab.resolve(run);
    const handle = mountOne(M, lab, app);
    const full = app.querySelector('[data-labm-live]'),
      delta = app.querySelector('[data-labm-live-delta]'),
      textAlt = app.querySelector('[data-labm-text-alt]'),
      stage = app.querySelector('[role="application"]');
    assert.equal(full.getAttribute('aria-atomic'), 'true');
    assert.equal(delta.getAttribute('aria-live'), 'polite');
    assert.equal(delta.getAttribute('aria-atomic'), 'false');
    assert.equal(app.querySelector('[aria-live="polite"]'), full, 'the full region stays the first aria-live match');
    await sleep(200);
    assert.equal(full.textContent, '', 'nothing is announced on mount');
    assert.ok(textAlt.textContent.length > 200, 'the full description is the text alternative');
    const fullText = full.textContent;
    assert.equal(delta.textContent, '');
    key(w, stage, 'ArrowRight');
    await sleep(150);
    assert.match(delta.textContent, /^Panned right; centre 5[1-9]% \/ 50%$/, delta.textContent);
    assert.equal(full.textContent, fullText, 'a pan does not rewrite the full description');
    key(w, stage, '+');
    await sleep(150);
    assert.equal(delta.textContent, 'Zoom 1.25x');
    assert.ok(textAlt.textContent.includes('Zoom: 1.25x'), 'the visible text alternative follows the zoom');
    key(w, stage, '3');
    await sleep(150);
    assert.equal(delta.textContent, 'Objective 20x (approximate)');
    key(w, stage, '0');
    await sleep(150);
    assert.equal(delta.textContent, 'View reset: objective 20x (approximate), zoom 1x, centre 50% / 50%');
    for (let i = 0; i < 20; i++) key(w, stage, 'ArrowLeft');
    await sleep(150);
    assert.equal(handle.state().cx, 0);
    assert.equal(delta.textContent, 'Edge of the field, no further pan; centre 0% / 50%');
    // The buttons moved into View controls and still work.
    app.querySelector('[data-labm-view-controls] [data-labm-pan="down"]').click();
    await sleep(150);
    assert.match(delta.textContent, /^Panned down; centre 0% \/ 5[1-9]%$/, delta.textContent);
    app.querySelector('[data-labm-view-controls] [data-labm-zoom="in"]').click();
    await sleep(150);
    assert.equal(delta.textContent, 'Zoom 1.25x');
    assert.equal(full.textContent, fullText, 'zooms and objective keys do not write the summary region');
    key(w, stage, 'l');
    await sleep(200);
    assert.notEqual(full.textContent, fullText);
    assert.ok(full.textContent.startsWith('Simulated, not a measurement. run-1, 20x, layers on: '), full.textContent);
    assert.ok(full.textContent.length < 300 && !LIVE_ENGINE_WORDS.test(full.textContent), full.textContent);
    assert.ok(
      textAlt.textContent.includes(
        'View: simulated picture with layers. Layers shown: lesions, ionic, nuclei, deposit, background.'
      )
    );
    const afterLayers = full.textContent,
      ionic = app.querySelector('[data-labm-layer="ionic"]');
    ionic.checked = false;
    ionic.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(200);
    assert.equal(delta.textContent, 'Bound silver layer hidden', 'one layer: a short update');
    assert.equal(full.textContent, afterLayers, 'the summary is not read again for one layer');
    assert.ok(textAlt.textContent.includes('Layers shown: lesions, nuclei, deposit, background.'));
    assert.ok(!app.querySelector('[data-labm-legend]').textContent.includes('halo'), 'the legend follows the choice');
    // Picking a layer while Layers is off turns Layers on.
    key(w, app.querySelector('[role="application"]'), 'l');
    assert.equal(handle.state().layers, false);
    ionic.checked = true;
    ionic.dispatchEvent(new w.Event('change', { bubbles: true }));
    assert.equal(handle.state().layers, true);
    const layered = M.describe(outcome, spec, lab, { tab: 'layers', layers: { lesions: true, deposit: true } });
    assert.ok(layered.endsWith('View: simulated picture with layers. Layers shown: lesions, deposit.'), layered);
    assert.ok(M.describe(outcome, spec, lab, { tab: 'layers', layers: {} }).endsWith('Layers shown: none.'));
    assert.ok(
      !M.describe(outcome, spec, lab, { tab: 'simulation', layers: { deposit: true } }).includes('Layers shown')
    );
    assert.ok(!M.describe(outcome, spec, lab, { tab: 'layers' }).includes('Layers shown'), 'no layers given, no claim');
    handle.destroy();
  } finally {
    close();
  }
});

test('mount: Esc calls onClose when present, is inert without it, and the help in View controls claims Esc only then (A8)', () => {
  const { w, M, lab, app, close } = harness();
  try {
    const help = () => app.querySelector('[data-labm-view-controls] .labm-keys').textContent,
      srHelp = () => app.querySelector('[id$="-stage-help"]').textContent,
      escape = () => {
        const e = new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        app.querySelector('[role="application"]').dispatchEvent(e);
        return e.defaultPrevented;
      },
      closes = [];
    const handle = mountOne(M, lab, app);
    assert.doesNotMatch(help(), /Esc/, help());
    assert.doesNotMatch(srHelp(), /Escape/, srHelp());
    assert.ok(help().includes('L toggles layers.'), 'the sentence still closes cleanly');
    for (const k of ['arrow keys pan', '0 resets the view', '1 to 4 pick', 'C toggles compare', 'Drag to pan'])
      assert.ok(help().includes(k), k);
    assert.equal(escape(), false, 'Esc is not swallowed without onClose');
    assert.equal(app.querySelectorAll('.labm').length, 1, 'the viewer stays');
    handle.update({ onClose: () => closes.push('u') });
    // UX-SMALL-verify: no "(when opened from the bench)"; the host decides where Esc leads.
    assert.ok(help().includes('L toggles layers, Esc closes the microscope.'), help());
    assert.ok(srHelp().includes('Escape closes the microscope'), srHelp());
    assert.doesNotMatch(help() + srHelp(), /opened from the bench/);
    assert.equal(escape(), true);
    assert.deepEqual(closes, ['u']);
    handle.update({ onClose: null });
    assert.doesNotMatch(help(), /Esc/);
    assert.equal(escape(), false);
    handle.destroy();
    const withClose = mountOne(M, lab, app, { onClose: () => closes.push('m') });
    assert.ok(help().includes('Esc closes the microscope.'));
    assert.equal(escape(), true);
    assert.deepEqual(closes, ['u', 'm']);
    withClose.destroy();
  } finally {
    close();
  }
});

test('wording: plain note under the picture, the thin-section sentence verbatim in Numbers, blinded caveat and contrast derivation explicit (R1, F1, F7)', () => {
  const { M, lab, app, close } = harness();
  try {
    const NOTE =
      'The field is one drawn thin section; a single section cannot establish a true 3D reconstruction of a plaque or tangle.';
    const run = fullRun(lab, 'run-1', 'SPEC-SYN-AD-01'),
      card = fullRun(lab, 'run-2', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } });
    const handle = mountOne(M, lab, app);
    const caption = () => app.querySelector('.labm-below [data-labm-caption]');
    assert.equal(
      caption().textContent,
      'Shading follows the model scale, not an amount. One thin section cannot show a plaque or tangle in 3D.'
    );
    assert.ok(caption().textContent.split(/\s+/).length <= 25, 'caption ≤ 25 words');
    const notes = app.querySelector('[data-labm-numbers] [data-labm-notes]').textContent;
    assert.ok(notes.endsWith(NOTE), notes);
    assert.ok(notes.includes('not intensity data'));
    handle.update({ runs: [card], outcomes: [lab.resolve(card)] });
    assert.equal(caption(), null, 'a card draws no section, so no shading note');
    handle.update({ runs: [run], outcomes: [lab.resolve(run)] });
    app.querySelector('[data-labm-measure-open]').click();
    app.querySelector('[data-labm-tool="blinded-quality-score"]').click();
    const paneCaption = () => app.querySelector('[data-labm-tool-pane] .labm-caption').textContent;
    assert.ok(paneCaption().includes('Manual: you enter the value.'));
    app.querySelector('[data-labm-rule-ok]').click();
    const caveat = app.querySelector('[data-labm-tool-form="blinded-quality-score"] .labm-warn').textContent;
    assert.ok(
      caveat.includes(
        'A blinded score needs a second scorer who cannot see which run produced the image; this version has no image-set export, so every score recorded here is tagged blinded=no.'
      ),
      caveat
    );
    assert.ok(caveat.includes('not a measurement of protein or pathology'));
    assert.doesNotMatch(MICRO_SRC, /export the image set, score, import/);
    app.querySelector('[data-labm-tool="contrast-ordinal"]').click();
    assert.ok(paneCaption().includes('Worked out from the picture (nearest of five shades)'), paneCaption());
    handle.destroy();
  } finally {
    close();
  }
});

test('mount: a run still in progress shows the in-progress badge (data-lab-label no-basis), a steps line and no tools', () => {
  const { M, lab, app, close } = harness();
  try {
    const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      partial = perform(lab, lab.createRun({ id: 'run-9', specimenId: 'SPEC-SYN-AD-01' }), S.STEPS.slice(0, 3)),
      card = lab.resolve(partial);
    assert.equal(card.code, 'step-skipped');
    const handle = M.mount(app, { lab, specimen: spec, runs: [partial], outcomes: [card] });
    const badge = app.querySelector('[data-labm-banner] .lab-badge');
    assert.equal(badge.getAttribute('data-lab-badge'), 'in-progress');
    assert.equal(badge.getAttribute('data-lab-label'), 'no-basis');
    assert.equal(badge.querySelector('.lab-badge-text').textContent, 'Steps still to do');
    const line = app.querySelector('[data-labm-card="0"]').textContent;
    assert.ok(line.startsWith(`3 of ${S.STEPS.length} steps done.`), line);
    assert.doesNotMatch(line, /silver-impregnation|step event/, 'no engine step ids in the default view');
    app.querySelector('[data-labm-measure-open]').click();
    assert.ok([...app.querySelectorAll('[data-labm-tool]')].every(b => b.disabled));
    assert.doesNotMatch(visibleText(app.querySelector('.labm')), ENGINE_WORDS);
    handle.destroy();
  } finally {
    close();
  }
});

test('shell vocabulary: window.CortexLab.words / badge / badgeForOutcome / level are used when present; the private copy keeps the contract strings', () => {
  const { w, M, lab, app, close } = harness();
  try {
    // Without lab.js: the contract §8.1 strings.
    let handle = mountOne(M, lab, app);
    const text = () => app.querySelector('[data-labm-banner] .lab-badge-text').textContent;
    assert.equal(text(), 'Simulated · not a measurement');
    assert.equal(
      app.querySelector('[data-labm-banner] .lab-sr-only').textContent.trim(),
      'Illustrative simulation from a teaching model, not a measurement.'
    );
    assert.equal(
      app.querySelector('[data-labm-scale]').textContent,
      'Model scale: none · trace · low · moderate · high (positions, not amounts)'
    );
    handle.destroy();
    // With lab.js: its functions win (the stub marks its output).
    const calls = [];
    w.CortexLab = {
      words: { simulated: 'SIM-WORD', notModeled: 'NM-WORD', modelScale: 'scale-word' },
      badge: (kind, opts = {}) => {
        calls.push(['badge', kind, opts.label || null]);
        return `<span class="lab-badge stub" data-lab-badge="${kind}"${opts.label ? ` data-lab-label="${opts.label}"` : ''}><span class="lab-badge-text">STUB ${kind}</span></span>`;
      },
      badgeForOutcome: out => {
        calls.push(['badgeForOutcome', out.label]);
        return `<span class="lab-badge stub" data-lab-badge="simulated" data-lab-label="${out.label}"><span class="lab-badge-text">STUB outcome</span></span>`;
      },
      level: n => `L${n}`,
    };
    handle = mountOne(M, lab, app);
    assert.equal(text(), 'STUB outcome');
    assert.ok(calls.some(c => c[0] === 'badgeForOutcome' && c[1] === 'illustrative-synthetic'));
    assert.ok(!calls.some(c => c[0] === 'badge' && c[1] === 'reference-none'), 'REF-micro: no reference-none badge');
    assert.equal(app.querySelector('canvas').getAttribute('aria-label'), 'run-1: SIM-WORD');
    assert.ok(
      app.querySelector('[data-labm-numbers] .labm-table').textContent.includes('L3'),
      'level() fills the table'
    );
    assert.ok(app.querySelector('[data-labm-numbers] .labm-table caption').textContent.includes('scale-word'));
    // Missing words fall back key by key.
    assert.ok(app.querySelector('[data-labm-caption]').textContent.includes('One thin section'));
    handle.destroy();
    // UX-INT: runTitle names the run and plain words the engine's "path = value" (lab.js loaded).
    w.CortexLab.runTitle = run => `Title of ${run.id}`;
    w.CortexLab.plain = t => String(t).replace(/washes\.condition ?= ?deviated/g, 'PLAIN');
    const cardRun = fullRun(lab, 'run-2', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } });
    handle = mountOne(M, lab, app, { runs: [cardRun], outcomes: [lab.resolve(cardRun)] });
    assert.equal(app.querySelector('canvas').getAttribute('aria-label'), 'Title of run-2: NM-WORD');
    const needed = app.querySelector('[data-labm-card="0"]').textContent;
    assert.ok(needed.includes('PLAIN') && !needed.includes('washes.condition'), needed);
    handle.destroy();
    delete w.CortexLab;
  } finally {
    close();
  }
});

test('mount: two viewers get distinct landmark names; "Drag to pan" gates touch-action; forced colors outline pressed toggles (B8, E3, C4)', () => {
  const { w, M, lab, app, close } = harness();
  try {
    const doc = w.document,
      spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      base = fullRun(lab, 'run-1', 'SPEC-SYN-AD-01'),
      ext = fullRun(lab, 'run-2', 'SPEC-SYN-AD-01', { development: { endpoint: 'extended' } }),
      second = doc.body.appendChild(doc.createElement('div')),
      common = { lab, specimen: spec, settings: { reducedMotion: 'on' } };
    const a = M.mount(app, { ...common, runs: [base], outcomes: [lab.resolve(base)] });
    const b = M.mount(second, { ...common, runs: [base, ext], outcomes: [lab.resolve(base), lab.resolve(ext)] });
    const name = (host, sel) => host.querySelector(sel).getAttribute('aria-label');
    assert.equal(name(app, '[data-labm-tools]'), 'Measurement tools, run-1');
    assert.equal(name(second, '[data-labm-tools]'), 'Measurement tools, run-1 and run-2');
    assert.equal(name(app, '.labm-toolbar'), 'Viewer controls, run-1');
    assert.equal(name(second, '.labm-toolbar'), 'Viewer controls, run-1 and run-2');
    assert.equal(name(second, '[data-labm-compare]'), 'Per-site difference, run-1 and run-2');
    assert.ok(
      name(second, '[role="application"]').startsWith(
        'Microscope viewer for run-1 and run-2, simulated picture, comparing two runs.'
      )
    );
    assert.notEqual(app.querySelector('[data-labm-tools]').id, second.querySelector('[data-labm-tools]').id);
    a.update({ runs: [ext], outcomes: [lab.resolve(ext)] });
    assert.equal(name(app, '[data-labm-tools]'), 'Measurement tools, run-2');
    // E3: the toggle, now inside View controls.
    const toggle = app.querySelector('[data-labm-view-controls] [data-labm-touch-pan]'),
      rootEl = app.querySelector('.labm');
    assert.equal(toggle.getAttribute('aria-pressed'), 'false');
    assert.ok(toggle.textContent.includes('Drag to pan'));
    toggle.click();
    assert.equal(toggle.getAttribute('aria-pressed'), 'true');
    assert.ok(rootEl.classList.contains('labm-touch-pan'));
    assert.equal(a.state().touchPan, true);
    toggle.click();
    assert.equal(a.state().touchPan, false);
    assert.equal(rootEl.classList.contains('labm-touch-pan'), false);
    // Every button in the microscope has visible text (no icon-only buttons).
    for (const btn of app.querySelectorAll('button'))
      assert.ok(btn.textContent.replace(/[←↑↓→]/g, '').trim(), btn.outerHTML.slice(0, 80));
    const css = fs.readFileSync(path.join(ROOT, 'lab-microscope.css'), 'utf8');
    assert.match(
      css,
      /\n\.labm-canvas \{[^\n]*touch-action: pan-y pinch-zoom;/,
      'one finger scrolls the page by default'
    );
    assert.match(css, /\n\.labm-touch-pan \.labm-canvas \{ touch-action: none; \}/);
    assert.doesNotMatch(css, /\n\.labm-canvas \{[^\n]*touch-action: none/);
    assert.match(css, /@media \(max-width: 420px\)/);
    assert.match(css, /\.labm button:not\(\.btn\) \{[^\n]*min-height: 44px;/, '44px targets');
    assert.match(css, /\.labm \.btn \{ min-height: 44px; \}/);
    assert.match(css, /\.labm-more > summary \{[^\n]*min-height: 44px;/);
    assert.match(css, /\.labm-check \{[^\n]*min-height: 44px;/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    // A cancelled pointer (the browser took the scroll) never counts as an outline click.
    app.querySelector('[data-labm-measure-open]').click();
    app.querySelector('[data-labm-tool="artifact-area"]').click();
    app.querySelector('[data-labm-rule-ok]').click();
    const canvas = app.querySelector('canvas'),
      pointer = type =>
        canvas.dispatchEvent(
          new w.PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: 160, clientY: 120, bubbles: true })
        ),
      info = () => app.querySelector('[data-labm-outline-info]').textContent;
    pointer('pointerdown');
    pointer('pointercancel');
    assert.ok(info().includes('(0 in the open outline'), info());
    pointer('pointerdown');
    pointer('pointerup');
    assert.ok(info().includes('(1 in the open outline'), 'a completed tap still adds a point');
    // With the sheet closed a tap adds nothing (no overlay is drawn then).
    app.querySelector('[data-labm-measure-open]').click();
    pointer('pointerdown');
    pointer('pointerup');
    app.querySelector('[data-labm-measure-open]').click();
    app.querySelector('[data-labm-tool="artifact-area"]').click();
    assert.ok(info().includes('(1 in the open outline'), info());
    // C4: forced colors mark pressed toggles with an outline (background alone disappears there).
    assert.match(
      css,
      /@media \(forced-colors: active\) \{[^\n]*\.labm button\[aria-pressed="true"\]:not\(\.btn\)[^{]*\{ outline: 2px solid Highlight; outline-offset: -2px; \}/
    );
    a.destroy();
    b.destroy();
    second.remove();
  } finally {
    close();
  }
});

test('UX-FIX: where a measurement goes (HON-7), the short live sentence (A11Y-06, K7), the sticky offset (A11Y-14), the uneven-shades note (F2) and the plain compare words (KB-26)', async () => {
  const { w, M, lab, app, close } = harness();
  try {
    const REPORT =
      'Saved in this lab and listed under From your lab work in My report. Add a note about it (or use the run in an experiment) to put it in the exported report.';
    const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      base = fullRun(lab, 'run-1', 'SPEC-SYN-AD-01'),
      outcome = lab.resolve(base);
    // HON-7: the sheet and the status never say the record "goes to your report" (the export lists
    // measurements only under the runs of an experiment).
    let handle = mountOne(M, lab, app, { onMeasurement() {} });
    app.querySelector('[data-labm-measure-open]').click();
    const note = app.querySelector('[data-labm-tools-note]').textContent;
    assert.ok(
      note.startsWith(
        `Each tool shows its rule; the tool opens once the rule is read. Each record is labeled “${SIM}” and listed under From your lab work in My report.`
      ),
      note
    );
    assert.ok(!note.includes('exported report'), 'the export sentence shows once, in the status');
    app.querySelector('[data-labm-tool="tissue-coverage"]').click();
    app.querySelector('[data-labm-rule-ok]').click();
    const cells = app.querySelector('[data-labm-field="cells"]');
    cells.value = '8';
    cells.dispatchEvent(new w.Event('input', { bubbles: true }));
    app
      .querySelector('[data-labm-tool-form]')
      .dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    const status = app.querySelector('[data-labm-status]').textContent;
    assert.equal(status, `Recorded: Tissue coverage = 0.5 (fraction) for run-1, labeled “${SIM}”. ${REPORT}`, status);
    assert.doesNotMatch(app.querySelector('.labm').textContent, /Saved to your report|goes to your report/);
    handle.destroy();
    // A11Y-06 / K7: no announcement on mount or update(); CortexLab.summarize words when lab.js is
    // there; a card says why there is no picture; never the engine description.
    w.CortexLab = {
      summarize: (out, specimen) => `SUMMARY ${out.label} ${specimen.id}`,
      runTitle: run => `Run ${run.id.slice(4)}`,
    };
    handle = mountOne(M, lab, app);
    const live = () => app.querySelector('[data-labm-live]').textContent;
    await sleep(200);
    assert.equal(live(), '');
    handle.update({ settings: { objective: 40 } });
    await sleep(200);
    assert.equal(live(), '', 'update() is host-driven: no announcement');
    app.querySelector('[data-labm-layers-toggle]').click();
    await sleep(200);
    assert.equal(
      live(),
      'Simulated, not a measurement. Run 1, 40x, layers on: SUMMARY illustrative-synthetic SPEC-SYN-AD-01'
    );
    handle.destroy();
    delete w.CortexLab;
    const cardRun = fullRun(lab, 'run-2', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } }),
      partial = perform(lab, lab.createRun({ id: 'run-3', specimenId: 'SPEC-SYN-AD-01' }), S.STEPS.slice(0, 4));
    handle = M.mount(app, {
      lab,
      specimen: spec,
      runs: [base, cardRun],
      outcomes: [outcome, lab.resolve(cardRun)],
      settings: { reducedMotion: 'on' },
    });
    key(w, app.querySelector('[role="application"]'), 'l');
    await sleep(200);
    assert.equal(
      live(),
      'Baseline simulated, not a measurement; experimental not modeled. Comparing the baseline and experimental runs, side by side, 10x, layers on: Experimental: The model has no rule for this change, so it shows no picture.'
    );
    handle.destroy();
    handle = M.mount(app, { lab, specimen: spec, runs: [partial], outcomes: [lab.resolve(partial)] });
    key(w, app.querySelector('[role="application"]'), 'l');
    await sleep(200);
    assert.ok(
      live().startsWith(
        `Steps still to do. run-3, 10x, layers on: 4 of ${S.STEPS.length} steps done; the picture is drawn once every step is done.`
      ),
      live()
    );
    handle.destroy();
    // Without lab.js: the private summary lists each structure's model-scale word.
    handle = mountOne(M, lab, app);
    key(w, app.querySelector('[role="application"]'), 'l');
    await sleep(200);
    const word = n => S.ORDINAL_TEXT[n];
    assert.ok(
      live().endsWith(
        `Plaque cores ${word(outcome.perSite['plaque-core'].visibility)}, plaque neurites ${word(outcome.perSite['plaque-neurite'].visibility)}, tangles ${word(outcome.perSite.tangle.visibility)}, axons ${word(outcome.perSite.axon.visibility)}, neuropil threads ${word(outcome.perSite['neuropil-thread'].visibility)}; background ${word(outcome.background)}; contrast ${word(outcome.contrast)} (model scale).`
      ),
      live()
    );
    assert.doesNotMatch(live(), LIVE_ENGINE_WORDS);
    // F2 / MODE-FIX-micro-2: the Numbers note says the field takes the background's shade and
    // contrast is judged by the model's words.
    assert.ok(
      app
        .querySelector('[data-labm-notes]')
        .textContent.includes(
          "and the field is painted in the background's shade: an illustrative device, not intensity data. The picture's contrast is the model's words drawn out (a structure one step above the background stands out by one shade), never a measurement, so judge contrast by the words."
        )
    );
    handle.destroy();
    // KB-26: other directions in the same words; identical runs say "the same".
    const same = fullRun(lab, 'run-4', 'SPEC-SYN-AD-01'),
      weak = fullRun(lab, 'run-5', 'SPEC-SYN-AD-01', { development: { strength: 'weak' } }),
      summaryFor = runs => {
        const hd = M.mount(app, { lab, specimen: spec, runs, outcomes: runs.map(r => lab.resolve(r)) });
        const out = [
          app.querySelector('[data-labm-compare-summary]').textContent,
          (app.querySelector('[data-labm-compare-contrast]') || {}).textContent,
        ];
        hd.destroy();
        return out;
      };
    const [sameLine, sameContrast] = summaryFor([base, same]);
    assert.ok(
      sameLine.startsWith(
        'Experimental vs baseline: Drawn the same for all five structures and the background (model scale).'
      ),
      sameLine
    );
    assert.equal(sameContrast, `Same model contrast in both (${S.ORDINAL_TEXT[outcome.contrast]}).`);
    const weakOut = lab.resolve(weak),
      rows = M.differenceRows(lab.compare(base, weak)),
      [weakLine, weakContrast] = summaryFor([base, weak]);
    assert.ok(/^Experimental vs baseline: Drawn (lighter|the same|darker) for /.test(weakLine), weakLine);
    if (rows.every(r => r.delta < 0))
      assert.ok(weakLine.includes('Drawn lighter for all five structures and the background'), weakLine);
    assert.ok(
      weakContrast ===
        (outcome.contrast === weakOut.contrast
          ? `Same model contrast in both (${S.ORDINAL_TEXT[outcome.contrast]})${rows.find(r => r.site === 'background').delta ? `: the background ${rows.find(r => r.site === 'background').delta > 0 ? 'darkened' : 'lightened'} too` : ''}.`
          : `Model contrast: ${S.ORDINAL_TEXT[outcome.contrast]} in the baseline, ${S.ORDINAL_TEXT[weakOut.contrast]} in the experimental run.`),
      weakContrast
    );
    // A11Y-14: the sticky picture sits below the site's top bar, whatever its height.
    const css = fs.readFileSync(path.join(ROOT, 'lab-microscope.css'), 'utf8');
    assert.match(
      css,
      /\.labm-panel \{ position: sticky; top: calc\(var\(--lab-topbar-h, var\(--topbar-h, 64px\)\) \+ 8px\); \}/
    );
    assert.doesNotMatch(css, /top: 64px/);
  } finally {
    close();
  }
});

// TONING-verify-1: a run whose setting skips gold toning counts the 8 steps it needs (as the bench), and
// never promises a picture once its steps are done: finished, it still comes back Not modeled.
test('TONING-verify: a run in progress with a setting the model has no rule for counts the steps it needs and promises no picture; a skip run (§11.5: toning off is modeled) only counts', async () => {
  const { w, M, lab, app, close } = harness();
  try {
    const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      partial = perform(
        lab,
        lab.createRun({ id: 'run-4', specimenId: 'SPEC-SYN-AD-01', params: { washes: { condition: 'deviated' } } }),
        S.STEPS.slice(0, 3)
      ),
      card = lab.resolve(partial);
    assert.equal(card.code, 'step-skipped');
    assert.ok(card.outsideSupport.includes('washes.condition'), 'a setting gap beside the steps');
    let handle = M.mount(app, {
      lab,
      specimen: spec,
      runs: [partial],
      outcomes: [card],
      settings: { reducedMotion: 'on' },
    });
    assert.equal(
      app.querySelector('[data-labm-card="0"]').textContent,
      '3 of 9 steps done. Finished, it still comes back Not modeled: the model has no rule for its settings.'
    );
    key(w, app.querySelector('[role="application"]'), 'l');
    await sleep(200);
    const live = app.querySelector('[data-labm-live]').textContent;
    assert.ok(
      live.endsWith(
        '3 of 9 steps done; finished, it still comes back Not modeled: the model has no rule for its settings.'
      ),
      live
    );
    handle.destroy();
    // MODE (§11.5): toning off is read by a rule now, so a skip run in progress is only in progress.
    const skip = perform(
        lab,
        lab.createRun({ id: 'run-5', specimenId: 'SPEC-SYN-AD-01', params: { toning: false } }),
        S.STEPS.slice(0, 3)
      ),
      skipCard = lab.resolve(skip);
    assert.equal(skipCard.code, 'step-skipped');
    handle = M.mount(app, {
      lab,
      specimen: spec,
      runs: [skip],
      outcomes: [skipCard],
      settings: { reducedMotion: 'on' },
    });
    assert.equal(
      app.querySelector('[data-labm-card="0"]').textContent,
      '3 of 8 steps done. The microscope draws the picture once every step is done.'
    );
    handle.destroy();
  } finally {
    close();
  }
});

// ---- GAME-micro (contract §10): hint chips over the picture, Show hints, the identify tag ----
const hints = app => [...app.querySelectorAll('.labm-stage [data-labm-hud] .labm-hint')].map(n => n.textContent);
// GAME-FIX-micro-1: no key chips (keys work only once the picture has focus; the keys list says so).
const DESKTOP_HINTS = ['Drag: move around', 'Ctrl/⌘ + scroll: zoom', 'Click a structure: what it is'];
// The client point that shows field point (fx, fy) in jsdom (no layout: the canvas falls back to 320x240).
function clientAt(handle, fx, fy) {
  const { objective, zoom, cx, cy } = handle.state(),
    scale = (240 / 1000) * (objective / 4) * zoom;
  return { clientX: 160 - cx * scale + fx * scale, clientY: 120 - cy * scale + fy * scale };
}
function pointer(w, canvas, type, at, extra = {}) {
  canvas.dispatchEvent(
    new w.PointerEvent(type, { pointerId: 3, pointerType: 'mouse', bubbles: true, ...at, ...extra })
  );
}
// A tiny stand-in for the shell's labEvents (on returns its own off, like lab.js).
function eventBus() {
  const listeners = new Map();
  const bus = {
    listeners,
    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return () => bus.off(name, fn);
    },
    off(name, fn) {
      if (listeners.has(name)) listeners.get(name).delete(fn);
    },
    emit(name, payload) {
      for (const fn of [...(listeners.get(name) || [])]) fn(payload);
    },
  };
  return bus;
}

test('GAME-micro: structureAt finds the top-most drawn shape under a field point, honours the drawn filter and tolerance', () => {
  require('../lab-microscope.js');
  const M = globalThis.CortexLabMicroscope;
  assert.equal(typeof M.structureAt, 'function');
  const only = (site, p = 1) => ({ id: `ONLY-${site}`, seed: 11, sites: { [site]: { presence: p } } });
  for (const site of ['plaque-core', 'tangle', 'axon', 'neuropil-thread', 'plaque-neurite']) {
    const spec = only(site),
      shape = M.shapeList(spec).shapes[0];
    const at =
      shape.kind === 'blob' || shape.kind === 'flame'
        ? { x: shape.x, y: shape.y }
        : shape.kind === 'curve'
          ? {
              x: 0.25 * shape.x1 + 0.5 * shape.cx + 0.25 * shape.x2,
              y: 0.25 * shape.y1 + 0.5 * shape.cy + 0.25 * shape.y2,
            }
          : { x: (shape.x1 + shape.x2) / 2, y: (shape.y1 + shape.y2) / 2 };
    const hit = M.structureAt(spec, at.x, at.y);
    assert.ok(hit, `${site}: a point on the shape hits`);
    assert.equal(hit.site, site);
    assert.equal(M.structureAt(spec, at.x, at.y, { drawn: () => false }), null, `${site}: not drawn, not found`);
    assert.equal(M.structureAt(spec, -400, -400, { tolerance: 5 }), null, `${site}: far off the field`);
  }
  // Tolerance widens a thin line; a blob is hit just outside its edge only with tolerance.
  const blobSpec = only('plaque-core'),
    blob = M.shapeList(blobSpec).shapes[0],
    edge = blob.r * blob.lobes[0] + 3; // straight right of the centre is the first lobe's radius
  assert.equal(M.structureAt(blobSpec, blob.x + edge, blob.y, { drawn: s => s === blob }), null);
  assert.equal(M.structureAt(blobSpec, blob.x + edge, blob.y, { tolerance: 8, drawn: s => s === blob }), blob);
  // The tangle (drawn last) wins over the plaque core it sits on.
  const lab = S.createLab(content),
    spec = lab.getSpecimen('SPEC-SYN-AD-01'),
    tangle = M.shapeList(spec).shapes.find(s => s.site === 'tangle');
  assert.equal(M.structureAt(spec, tangle.x, tangle.y).site, 'tangle');
});

test('GAME-micro: the HUD under the picture says what each gesture does (desktop words), swaps to a picture tool verb, and steps aside on a Not modeled plate', async () => {
  const { w, M, lab, app, close } = harness();
  try {
    const handle = mountOne(M, lab, app, { onMeasurement() {} }),
      hud = () => app.querySelector('[data-labm-hud]');
    assert.ok(hud().closest('.labm-stage'), 'the HUD is a row of the stage, under the picture');
    assert.ok(
      app.querySelector('canvas').compareDocumentPosition(hud()) & w.Node.DOCUMENT_POSITION_FOLLOWING,
      'after the canvas'
    );
    assert.equal(hud().getAttribute('aria-hidden'), 'true');
    assert.equal(hud().hidden, false);
    assert.deepEqual(hints(app), DESKTOP_HINTS);
    assert.equal(hud().querySelectorAll('button, a, input, [tabindex]').length, 0, 'nothing to click or tab to');
    for (const chip of hints(app)) assert.ok(chip.split(/\s+/).length <= 8, chip);
    assert.equal(app.querySelectorAll('[data-labm-hud]').length, 1);
    // The keys list (the accessible path) is unchanged.
    assert.ok(
      app.querySelector('.labm-keys').textContent.includes('Mouse: drag to pan; hold Ctrl or Cmd and scroll to zoom.')
    );
    // A stage rebuild (Layers) keeps one HUD over the new picture.
    key(w, app.querySelector('[role="application"]'), 'l');
    assert.ok(app.querySelector('[role="application"]').contains(hud()));
    assert.deepEqual(hints(app), DESKTOP_HINTS);
    key(w, app.querySelector('[role="application"]'), 'l');
    // A picture tool: its verb replaces the view chips once its rule is read (the outline is drawn).
    app.querySelector('[data-labm-measure-open]').click();
    app.querySelector('[data-labm-tool="artifact-area"]').click();
    assert.deepEqual(hints(app), DESKTOP_HINTS, 'rule not read yet: clicks do nothing new');
    app.querySelector('[data-labm-rule-ok]').click();
    assert.deepEqual(hints(app), ['Click: add an outline point']);
    assert.ok(app.querySelector('.labm').classList.contains('labm-picking'), 'crosshair while clicks add points');
    app.querySelector('[data-labm-tool="roi-lesion-count"]').click();
    app.querySelector('[data-labm-rule-ok]').click();
    assert.deepEqual(hints(app), ['Click a lesion: count it in its region']);
    // A tool that does not take clicks on the picture keeps the view chips.
    app.querySelector('[data-labm-tool="tissue-coverage"]').click();
    app.querySelector('[data-labm-rule-ok]').click();
    assert.deepEqual(hints(app), DESKTOP_HINTS);
    assert.equal(app.querySelector('.labm').classList.contains('labm-picking'), false);
    app.querySelector('[data-labm-measure-close]').click();
    assert.deepEqual(hints(app), DESKTOP_HINTS);
    // A Not modeled plate does not pan or zoom: no chips.
    const cardRun = fullRun(lab, 'run-2', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } });
    handle.update({ runs: [cardRun], outcomes: [lab.resolve(cardRun)] });
    assert.equal(hud().hidden, true);
    assert.deepEqual(hints(app), []);
    handle.destroy();
    // Two runs side by side: the chips stay (both pictures pan and zoom together).
    const base = fullRun(lab, 'run-3', 'SPEC-SYN-AD-01'),
      ext = fullRun(lab, 'run-4', 'SPEC-SYN-AD-01', { development: { endpoint: 'extended' } }),
      two = M.mount(app, {
        lab,
        specimen: lab.getSpecimen('SPEC-SYN-AD-01'),
        runs: [base, ext],
        outcomes: [lab.resolve(base), lab.resolve(ext)],
        settings: { reducedMotion: 'on' },
      });
    assert.equal(app.querySelectorAll('canvas').length, 2);
    assert.deepEqual(hints(app), DESKTOP_HINTS);
    two.destroy();
    // The CSS: decoration only, hidden under lab-hints-off and in print, forced colors outline.
    const css = fs.readFileSync(path.join(ROOT, 'lab-microscope.css'), 'utf8');
    assert.match(css, /\n\.labm-hud \{[^\n]*pointer-events: none;/);
    assert.match(css, /\n\.labm-tag \{[^\n]*pointer-events: none;/);
    assert.match(css, /\n\.lab-hints-off \.labm-hud \{ display: none; \}/);
    assert.match(css, /@media print \{ \.labm-hud, \.labm-tag(, \.labm-tally)? \{ display: none; \} \}/);
    assert.match(css, /@media \(forced-colors: active\) \{ \.labm-tag \{ border: 1px solid CanvasText;/);
    assert.doesNotMatch(css, /\.labm-hint[^{\n]*\{[^\n]*min-height: 44px/, 'the HUD is not a click target');
  } finally {
    close();
  }
});

test('GAME-micro: touch words under a coarse pointer name the "Drag to pan" toggle (and where it is) until it is on', () => {
  const { w, M, lab, app, close } = harness();
  try {
    w.matchMedia = query => ({
      media: query,
      matches: query === '(pointer: coarse)',
      addListener() {},
      removeListener() {},
    });
    const handle = mountOne(M, lab, app, { onMeasurement() {} });
    // GAME-FIX-micro-4: the toggle sits in the closed View controls, so the chip says where.
    assert.deepEqual(hints(app), ['Tap a structure: what it is', 'View controls › Drag to pan: move around']);
    assert.ok(app.querySelector('[data-labm-view-controls] [data-labm-touch-pan]'), 'it is there');
    for (const chip of hints(app)) assert.ok(chip.split(/\s+/).length <= 8, chip);
    app.querySelector('[data-labm-touch-pan]').click();
    assert.equal(handle.state().touchPan, true);
    assert.deepEqual(hints(app), ['Drag: move around', 'Pinch: zoom', 'Tap a structure: what it is']);
    app.querySelector('[data-labm-measure-open]').click();
    app.querySelector('[data-labm-tool="artifact-area"]').click();
    app.querySelector('[data-labm-rule-ok]').click();
    assert.deepEqual(hints(app), ['Tap: add an outline point']);
    app.querySelector('[data-labm-tool="roi-lesion-count"]').click();
    app.querySelector('[data-labm-rule-ok]').click();
    assert.deepEqual(hints(app), ['Tap a lesion: count it in its region']);
    handle.destroy();
  } finally {
    close();
  }
});

test('GAME-micro: Show hints off hides the HUD (CortexLab.hintsOn, a hints event, the html class); destroy unsubscribes', () => {
  const { w, M, lab, app, close } = harness();
  try {
    const bus = eventBus(),
      hud = () => app.querySelector('[data-labm-hud]');
    let on = true;
    w.CortexLab = { hintsOn: () => on, events: bus };
    let handle = mountOne(M, lab, app);
    assert.equal(bus.listeners.get('hints').size, 1, 'one listener per viewer');
    assert.equal(hud().hidden, false);
    on = false;
    bus.emit('hints', false);
    assert.equal(hud().hidden, true, 'hidden live on the hints event');
    assert.deepEqual(hints(app), []);
    // Hints stay off through view changes.
    key(w, app.querySelector('[role="application"]'), 'l');
    assert.equal(hud().hidden, true);
    on = true;
    bus.emit('hints', true);
    assert.equal(hud().hidden, false);
    assert.deepEqual(hints(app), DESKTOP_HINTS);
    handle.destroy();
    assert.equal(bus.listeners.get('hints').size, 0, 'destroy unsubscribes');
    bus.emit('hints', false); // nothing throws after destroy
    // Off before mount: no chips from the start.
    on = false;
    handle = mountOne(M, lab, app);
    assert.equal(hud().hidden, true);
    handle.destroy();
    // A viewer whose DOM the host replaced without destroy() lets go on the next event.
    on = true;
    handle = mountOne(M, lab, app);
    app.replaceChildren();
    bus.emit('hints', true);
    assert.equal(bus.listeners.get('hints').size, 0);
    // Without hintsOn: the html class decides; without CortexLab at all: on.
    delete w.CortexLab;
    w.document.documentElement.classList.add('lab-hints-off');
    handle = mountOne(M, lab, app);
    assert.equal(hud().hidden, true);
    handle.destroy();
    w.document.documentElement.classList.remove('lab-hints-off');
    handle = mountOne(M, lab, app);
    assert.equal(hud().hidden, false);
    handle.destroy();
  } finally {
    close();
  }
});

test('GAME-micro: hover or click names the drawn structure (plain words, simulated label, aria-hidden); never on a Not modeled picture; a lesion click counts in its region', async () => {
  const { w, M, lab, app, close } = harness();
  try {
    const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      run = fullRun(lab, 'run-1', 'SPEC-SYN-AD-01'),
      outcome = lab.resolve(run),
      taken = [],
      handle = mountOne(M, lab, app, { onMeasurement: m => taken.push(m) }),
      tag = () => app.querySelector('[data-labm-tag]'),
      canvas = () => app.querySelector('canvas');
    key(w, app.querySelector('[role="application"]'), '1'); // 4x: the whole field is on the canvas
    const core = M.shapeList(spec).shapes.find(s => s.site === 'plaque-core' && M.structureAt(spec, s.x, s.y) === s);
    assert.ok(core, 'a plaque core no tangle covers');
    const at = clientAt(handle, core.x, core.y),
      word = S.ORDINAL_TEXT[outcome.perSite['plaque-core'].visibility];
    assert.equal(tag().hidden, true, 'no tag before the pointer moves');
    pointer(w, canvas(), 'pointermove', at);
    assert.equal(tag().hidden, false);
    assert.equal(tag().getAttribute('aria-hidden'), 'true');
    assert.ok(tag().closest('.labm-stage'));
    assert.equal(tag().querySelector('.labm-tag-main').textContent, `Plaque core (drawn) · visible silver: ${word}`);
    assert.equal(tag().querySelector('.labm-tag-line').textContent, SIM, 'the simulated label stays with it');
    assert.doesNotMatch(tag().textContent, ENGINE_WORDS);
    pointer(w, canvas(), 'pointerleave', at);
    assert.equal(tag().hidden, true, 'leaving the picture hides it');
    assert.equal(tag().textContent, '');
    // A touch move without a press is not a hover; a click / tap pins the tag for a moment.
    pointer(w, canvas(), 'pointermove', at, { pointerType: 'touch' });
    assert.equal(tag().hidden, true);
    pointer(w, canvas(), 'pointerdown', at, { pointerType: 'touch' });
    pointer(w, canvas(), 'pointerup', at, { pointerType: 'touch' });
    assert.equal(tag().hidden, false);
    assert.ok(tag().textContent.startsWith('Plaque core (drawn)'));
    pointer(w, canvas(), 'pointerleave', at);
    assert.equal(tag().hidden, false, 'a pinned tag outlasts the pointer leaving');
    // A pan or zoom repaints and drops the tag.
    key(w, app.querySelector('[role="application"]'), 'ArrowRight');
    assert.equal(tag().hidden, true);
    // CortexLab.level words when the shell is loaded.
    w.CortexLab = { level: n => `L${n}` };
    const at2 = clientAt(handle, core.x, core.y);
    pointer(w, canvas(), 'pointermove', at2);
    assert.ok(
      tag().textContent.includes(`visible silver: L${outcome.perSite['plaque-core'].visibility}`),
      tag().textContent
    );
    delete w.CortexLab;
    // Count lesions: with the rule read, a click adds one to that region's typed count.
    app.querySelector('[data-labm-measure-open]').click();
    app.querySelector('[data-labm-tool="roi-lesion-count"]').click();
    app.querySelector('[data-labm-rule-ok]').click();
    // FIX4 (d4-8): the pane's caption says so in visible text too (it said "Manual: you enter the value").
    assert.ok(
      app
        .querySelector('[data-labm-tool-pane="roi-lesion-count"] .labm-caption')
        .textContent.includes('Click lesions on the picture, or type counts.'),
      'the sheet says so in visible text too'
    );
    key(w, app.querySelector('[role="application"]'), '0');
    // FIX3 (G5): only a click on a drawn plaque core counts (here one in region 5, the middle).
    // FIX5 (I1): two clicks in a row on it (a double click) count that lesion once.
    const mid = coreIn(M, spec, 4),
      onCore = clientAt(handle, mid.x, mid.y);
    for (let k = 0; k < 2; k++) {
      pointer(w, canvas(), 'pointerdown', onCore);
      pointer(w, canvas(), 'pointerup', onCore);
    }
    assert.equal(app.querySelector('[data-labm-roi="4"]').value, '1');
    assert.equal(tag().querySelector('.labm-tag-main').textContent, 'Region 5: 1 counted');
    const outside = clientAt(handle, -50, 500);
    pointer(w, canvas(), 'pointerdown', outside);
    pointer(w, canvas(), 'pointerup', outside);
    assert.equal(tag().textContent, 'Outside the field: nothing counted');
    const form = app.querySelector('[data-labm-tool-form="roi-lesion-count"]'),
      crit = form.querySelector('[data-labm-field="criterion"]');
    crit.value = 'fully inside';
    crit.dispatchEvent(new w.Event('input', { bubbles: true }));
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(taken.length, 1, 'the picture counts record like typed ones');
    assert.equal(taken[0].value, 1);
    assert.ok(taken[0].note.includes('regions=[0,0,0,0,1,0,0,0,0]'), taken[0].note);
    // A Not modeled picture never names a structure.
    const cardRun = fullRun(lab, 'run-2', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } });
    handle.update({ runs: [cardRun], outcomes: [lab.resolve(cardRun)] });
    pointer(w, canvas(), 'pointermove', clientAt(handle, core.x, core.y));
    assert.equal(tag().hidden, true);
    pointer(w, canvas(), 'pointerdown', clientAt(handle, core.x, core.y));
    pointer(w, canvas(), 'pointerup', clientAt(handle, core.x, core.y));
    assert.equal(tag().hidden, true);
    handle.destroy();
    assert.equal(app.querySelector('[data-labm-tag]'), null);
    await sleep(10);
  } finally {
    close();
  }
});

// ---- GAME-FIX-micro: the review fixes (contract GAME-FIX-micro-n) ----
const tagOf = app => app.querySelector('[data-labm-tag]');
const tagMain = app => {
  const t = tagOf(app);
  return t && !t.hidden ? t.querySelector('.labm-tag-main').textContent : null;
};
// FIX3 (G5): a plaque core whose centre lies in region i (0..8 of the fixed 3x3 grid).
function coreIn(M, spec, i) {
  const cell = 1000 / 3;
  coreIn.last = M.shapeList(spec).shapes.find(
    s => s.site === 'plaque-core' && Math.floor(s.y / cell) * 3 + Math.floor(s.x / cell) === i
  );
  assert.ok(coreIn.last, `a plaque core in region ${i + 1}`);
  return coreIn.last;
}
// A plaque core no tangle covers, and the client point that shows it at 4x (the whole field).
function coreAt(w, M, lab, app, handle) {
  key(w, app.querySelector('[role="application"]'), '1');
  const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
    core = M.shapeList(spec).shapes.find(s => s.site === 'plaque-core' && M.structureAt(spec, s.x, s.y) === s);
  coreAt.last = { core, at: clientAt(handle, core.x, core.y) };
  return coreAt.last;
}

test('GAME-FIX-micro: the chips promise only what works now: no key chips, and no "Click a structure" when nothing is drawn', () => {
  const { w, M, lab, app, close } = harness();
  try {
    let handle = mountOne(M, lab, app);
    assert.deepEqual(hints(app), DESKTOP_HINTS);
    assert.ok(!hints(app).some(c => /^0:|\+ −|\+ -/.test(c)), 'no chip names a key that needs focus first');
    assert.ok(
      app
        .querySelector('.labm-keys')
        .textContent.includes('With the picture focused (click it or Tab to it): arrow keys pan'),
      'the keys list still names the keys and the focus they need'
    );
    // Ctrl / ⌘ + scroll zooms with no focus on the picture.
    const before = handle.state().zoom;
    app
      .querySelector('canvas')
      .dispatchEvent(new w.WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true }));
    assert.ok(handle.state().zoom > before);
    handle.destroy();
    // Development first: no visible silver anywhere, so nothing can be identified.
    const order = ['development', ...S.STEPS.filter(s => s !== 'development')],
      blank = perform(lab, lab.createRun({ id: 'run-blank', specimenId: 'SPEC-SYN-AD-01' }), order),
      outcome = lab.resolve(blank);
    assert.equal(outcome.label, 'illustrative-synthetic');
    assert.ok(Object.values(outcome.perSite).every(p => p.visibility === 0 || p === outcome.perSite.background));
    handle = M.mount(app, {
      lab,
      specimen: lab.getSpecimen('SPEC-SYN-AD-01'),
      runs: [blank],
      outcomes: [outcome],
      settings: { reducedMotion: 'on' },
    });
    assert.deepEqual(hints(app), ['Drag: move around', 'Ctrl/⌘ + scroll: zoom']);
    // Layers on: the ionic layer (and the dashed outline) draw structures, so the chip comes back.
    key(w, app.querySelector('[role="application"]'), 'l');
    assert.deepEqual(hints(app), DESKTOP_HINTS);
    key(w, app.querySelector('[role="application"]'), 'l');
    assert.deepEqual(hints(app), ['Drag: move around', 'Ctrl/⌘ + scroll: zoom']);
    handle.destroy();
    // Touch words drop it too.
    w.matchMedia = query => ({
      media: query,
      matches: query === '(pointer: coarse)',
      addListener() {},
      removeListener() {},
    });
    handle = M.mount(app, {
      lab,
      specimen: lab.getSpecimen('SPEC-SYN-AD-01'),
      runs: [blank],
      outcomes: [outcome],
      settings: { reducedMotion: 'on' },
    });
    assert.deepEqual(hints(app), ['View controls › Drag to pan: move around']);
    app.querySelector('[data-labm-touch-pan]').click();
    assert.deepEqual(hints(app), ['Drag: move around', 'Pinch: zoom']);
    handle.destroy();
    // Side by side with one drawn run: there is something to name.
    delete w.matchMedia;
    const full = fullRun(lab, 'run-full', 'SPEC-SYN-AD-01');
    handle = M.mount(app, {
      lab,
      specimen: lab.getSpecimen('SPEC-SYN-AD-01'),
      runs: [blank, full],
      outcomes: [outcome, lab.resolve(full)],
      settings: { reducedMotion: 'on' },
    });
    assert.deepEqual(hints(app), DESKTOP_HINTS);
    handle.destroy();
  } finally {
    close();
  }
});

test('GAME-FIX-micro: a finger or pen tap that wobbles under 8 px still identifies and counts (where it came down); a longer drag pans; a mouse keeps 3 px', () => {
  const { w, M, lab, app, close } = harness();
  try {
    const handle = mountOne(M, lab, app, { onMeasurement() {} }),
      canvas = () => app.querySelector('canvas'),
      { at } = coreAt(w, M, lab, app, handle),
      press = (type, dx, dy, extra = {}) => {
        const end = { clientX: at.clientX + dx, clientY: at.clientY + dy };
        pointer(w, canvas(), 'pointerdown', at, { pointerType: type, ...extra });
        if (dx || dy) pointer(w, canvas(), 'pointermove', end, { pointerType: type, ...extra });
        pointer(w, canvas(), 'pointerup', end, { pointerType: type, ...extra });
      };
    const start = handle.state();
    for (const [type, dx, dy] of [
      ['touch', 5, 3],
      ['touch', 0, 7],
      ['touch', 6, -4],
      ['pen', 4, 4],
    ]) {
      press(type, dx, dy);
      assert.ok(String(tagMain(app)).startsWith('Plaque core (drawn)'), `${type} ${dx},${dy}: ${tagMain(app)}`);
      assert.equal(handle.state().cx, start.cx, 'no pan');
      assert.equal(handle.state().cy, start.cy);
    }
    // On a thin line a 7 px wobble ends off the line: the tap still names what it came down on.
    const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      px = 0.24, // 4x on jsdom's 320 x 240 fallback: screen px per field unit
      thin = M.shapeList(spec)
        .shapes.filter(s => s.site === 'axon' && s.kind !== 'blob' && s.kind !== 'flame')
        .map(s => {
          const m =
            s.kind === 'curve'
              ? { x: 0.25 * s.x1 + 0.5 * s.cx + 0.25 * s.x2, y: 0.25 * s.y1 + 0.5 * s.cy + 0.25 * s.y2 }
              : { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 };
          return { s, m };
        })
        .find(({ s, m }) => {
          const off = M.structureAt(spec, m.x, m.y + 7 / px, { tolerance: 4 / px });
          return M.structureAt(spec, m.x, m.y, { tolerance: 4 / px }) === s && (!off || off.site !== 'axon');
        });
    assert.ok(thin, 'an axon whose midpoint is clear 7 px below');
    const onLine = clientAt(handle, thin.m.x, thin.m.y);
    pointer(w, canvas(), 'pointerdown', onLine, { pointerType: 'touch' });
    pointer(
      w,
      canvas(),
      'pointermove',
      { clientX: onLine.clientX, clientY: onLine.clientY + 7 },
      { pointerType: 'touch' }
    );
    pointer(
      w,
      canvas(),
      'pointerup',
      { clientX: onLine.clientX, clientY: onLine.clientY + 7 },
      { pointerType: 'touch' }
    );
    assert.ok(String(tagMain(app)).startsWith('Axon (drawn)'), String(tagMain(app)));
    // With "Drag to pan" off a finger drag is the page's: it names nothing and never pans
    // (FIX2 partial-micro-pan-nudge). With it on, the same drag pans.
    press('touch', 20, 0);
    assert.equal(tagMain(app), null);
    assert.equal(handle.state().cx, start.cx, 'Drag to pan off: no pan');
    app.querySelector('[data-labm-touch-pan]').click();
    press('touch', 20, 0);
    assert.equal(tagMain(app), null);
    assert.notEqual(handle.state().cx, start.cx, 'Drag to pan on: the drag panned');
    app.querySelector('[data-labm-touch-pan]').click();
    key(w, app.querySelector('[role="application"]'), '0');
    key(w, app.querySelector('[role="application"]'), '1');
    // A mouse press that moves 5 px is still a drag (unchanged).
    const before = handle.state().cx;
    press('mouse', 5, 0);
    assert.equal(tagMain(app), null);
    assert.notEqual(handle.state().cx, before);
    // Count lesions: a wobbly tap counts once in the region it came down in.
    key(w, app.querySelector('[role="application"]'), '0');
    app.querySelector('[data-labm-measure-open]').click();
    app.querySelector('[data-labm-tool="roi-lesion-count"]').click();
    app.querySelector('[data-labm-rule-ok]').click();
    const centre = clientAt(handle, coreIn(M, lab.getSpecimen('SPEC-SYN-AD-01'), 4).x, coreIn.last.y);
    pointer(w, canvas(), 'pointerdown', centre, { pointerType: 'touch' });
    pointer(
      w,
      canvas(),
      'pointermove',
      { clientX: centre.clientX + 4, clientY: centre.clientY + 2 },
      { pointerType: 'touch' }
    );
    pointer(
      w,
      canvas(),
      'pointerup',
      { clientX: centre.clientX + 4, clientY: centre.clientY + 2 },
      { pointerType: 'touch' }
    );
    assert.equal(app.querySelector('[data-labm-roi="4"]').value, '1');
    assert.equal(tagMain(app), 'Region 5: 1 counted');
    handle.destroy();
  } finally {
    close();
  }
});

test('GAME-FIX-micro: Esc hides the tag and does nothing else; a tap keeps its tag (no timer) until the next press; a finger tag sits above the finger', () => {
  const { w, M, lab, app, close } = harness();
  try {
    let closed = 0;
    const handle = mountOne(M, lab, app, { onClose: () => closed++ }),
      canvas = () => app.querySelector('canvas'),
      stage = () => app.querySelector('[role="application"]'),
      { at } = coreAt(w, M, lab, app, handle),
      escOn = node =>
        node.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    // Focus elsewhere (body): Esc hides the hover tag; the viewer stays, onClose is not called.
    pointer(w, canvas(), 'pointermove', at);
    assert.ok(tagMain(app));
    escOn(w.document.body);
    assert.equal(tagOf(app).hidden, true);
    assert.equal(closed, 0);
    assert.ok(app.querySelector('.labm-stage'));
    // Resting on the same structure does not bring it straight back; leaving and coming back does.
    pointer(w, canvas(), 'pointermove', { clientX: at.clientX + 1, clientY: at.clientY });
    assert.equal(tagOf(app).hidden, true, 'dismissed stays dismissed on the same structure');
    pointer(w, canvas(), 'pointerleave', at);
    pointer(w, canvas(), 'pointermove', at);
    assert.ok(tagMain(app), 'back after leaving the picture');
    // Esc on the picture itself: the tag first, the viewer on the next Esc.
    escOn(stage());
    assert.equal(tagOf(app).hidden, true);
    assert.equal(closed, 0, 'the first Esc only hid the tag');
    escOn(stage());
    assert.equal(closed, 1, 'the next Esc closes the viewer as before');
    // Esc with nothing shown changes nothing.
    escOn(w.document.body);
    assert.equal(closed, 1);
    // Timers: a mouse click pins for TAG_PIN_MS; a tap sets no timer and stays.
    const realSetTimeout = w.setTimeout,
      delays = [];
    w.setTimeout = (fn, ms, ...rest) => {
      delays.push(ms);
      return realSetTimeout.call(w, fn, ms, ...rest);
    };
    try {
      pointer(w, canvas(), 'pointerdown', at);
      pointer(w, canvas(), 'pointerup', at);
      assert.ok(delays.includes(2500), 'a mouse click still pins for 2.5 s (hover brings it back)');
      const mouseTop = parseFloat(tagOf(app).style.top);
      assert.ok(mouseTop > at.clientY, 'mouse: the tag sits beside / below the pointer');
      delays.length = 0;
      pointer(w, canvas(), 'pointerdown', at, { pointerType: 'touch' });
      pointer(w, canvas(), 'pointerup', at, { pointerType: 'touch' });
      pointer(w, canvas(), 'pointerleave', at, { pointerType: 'touch' });
      assert.ok(tagMain(app), 'a tap shows the tag');
      assert.ok(!delays.includes(2500), 'no timer takes a tapped tag away (WCAG 2.2.1)');
      assert.ok(parseFloat(tagOf(app).style.top) < at.clientY, 'touch: the tag sits above the finger');
    } finally {
      w.setTimeout = realSetTimeout;
    }
    // The next press anywhere (here: the page) takes it away; so does Esc.
    w.document.body.dispatchEvent(new w.PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
    assert.equal(tagOf(app).hidden, true);
    pointer(w, canvas(), 'pointerdown', at, { pointerType: 'touch' });
    pointer(w, canvas(), 'pointerup', at, { pointerType: 'touch' });
    assert.ok(tagMain(app));
    escOn(w.document.body);
    assert.equal(tagOf(app).hidden, true);
    // destroy removes the document listeners (Esc after destroy throws nothing).
    handle.destroy();
    escOn(w.document.body);
    w.document.body.dispatchEvent(new w.PointerEvent('pointerdown', { bubbles: true }));
  } finally {
    close();
  }
});

test('GAME-FIX-micro: the mouse can move onto the tag (WCAG 1.4.13 hoverable): it holds still on the tag and across the gap, and goes once the pointer leaves', () => {
  const { w, M, lab, app, close } = harness();
  try {
    const handle = mountOne(M, lab, app),
      canvas = () => app.querySelector('canvas'),
      { at } = coreAt(w, M, lab, app, handle);
    pointer(w, canvas(), 'pointermove', at);
    const text = tagMain(app);
    assert.ok(text.startsWith('Plaque core (drawn)'));
    // jsdom has no layout: give the tag the box showTag placed it in (14 px below right, 200 x 42).
    const left = parseFloat(tagOf(app).style.left),
      top = parseFloat(tagOf(app).style.top);
    assert.equal(left, Math.round(at.clientX + 14));
    assert.equal(top, Math.round(at.clientY + 14));
    tagOf(app).getBoundingClientRect = () => ({
      left,
      top,
      right: left + 200,
      bottom: top + 42,
      width: 200,
      height: 42,
    });
    // Across the gap (off the structure, toward the tag) and on the tag: it stays, unmoved.
    const offField = clientAt(handle, -60, -60);
    for (const p of [
      { clientX: left - 4, clientY: top + 21 }, // in the gap, off the core (37 px from its centre)
      { clientX: left + 100, clientY: top + 20 },
    ]) {
      pointer(w, canvas(), 'pointermove', p);
      assert.equal(tagMain(app), text, JSON.stringify(p));
      assert.equal(parseFloat(tagOf(app).style.left), left);
    }
    // Far from the tag on empty paper: it goes.
    pointer(w, canvas(), 'pointermove', offField);
    assert.equal(tagOf(app).hidden, true);
    // At 40x a plaque core runs under its own tag: moving toward the tag on the same structure, the tag
    // holds still (it no longer runs away from the pointer); far off on the same structure it follows.
    key(w, app.querySelector('[role="application"]'), '4');
    // Drag the core to the middle of jsdom's 320 x 240 canvas.
    const big = { clientX: 160, clientY: 120 };
    pointer(w, canvas(), 'pointerdown', clientAt(handle, coreAt.last.core.x, coreAt.last.core.y));
    pointer(w, canvas(), 'pointermove', big);
    pointer(w, canvas(), 'pointerup', big);
    pointer(w, canvas(), 'pointermove', big);
    assert.ok(tagMain(app).startsWith('Plaque core (drawn)'));
    const l2 = parseFloat(tagOf(app).style.left),
      t2 = parseFloat(tagOf(app).style.top);
    tagOf(app).getBoundingClientRect = () => ({
      left: l2,
      top: t2,
      right: l2 + 200,
      bottom: t2 + 42,
      width: 200,
      height: 42,
    });
    for (const d of [20, -20]) {
      // onto the tag, then a little away from it (34 px off its box): still on the core
      pointer(w, canvas(), 'pointermove', { clientX: big.clientX + d, clientY: big.clientY + d });
      assert.ok(tagMain(app).startsWith('Plaque core (drawn)'), 'still on the core');
      assert.equal(parseFloat(tagOf(app).style.left), l2, `the tag waits for the pointer (${d})`);
    }
    pointer(w, canvas(), 'pointermove', { clientX: big.clientX - 40, clientY: big.clientY });
    assert.ok(tagMain(app).startsWith('Plaque core (drawn)'));
    assert.equal(parseFloat(tagOf(app).style.left), Math.round(big.clientX - 40 + 14), 'far from it, the tag follows');
    handle.destroy();
  } finally {
    close();
  }
});

test('GAME-FIX-micro: CSS: the chips are a caption row under the picture (never over it) and plain text, not pills', () => {
  const css = fs.readFileSync(path.join(ROOT, 'lab-microscope.css'), 'utf8'),
    rule = sel =>
      (css.match(new RegExp(`\\n${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^\\n]*)\\}`)) || [])[1] || '';
  const hud = rule('.labm-hud'),
    hint = rule('.labm-hint');
  assert.ok(hud, 'a .labm-hud rule');
  assert.doesNotMatch(hud, /position: absolute|bottom:|left:/, 'not an overlay on the picture');
  assert.match(hud, /grid-column: 1 \/ -1;/, 'one full-width row of the stage, under both pictures');
  assert.match(hud, /pointer-events: none;/);
  assert.doesNotMatch(
    css,
    /\.labm-picking \.labm-hud/,
    'no tool-only placement needed: it is never over the grid labels'
  );
  assert.ok(hint, 'a .labm-hint rule');
  assert.doesNotMatch(
    hint,
    /border|background|border-radius|box-shadow|padding/,
    'no pill: nothing looks like a button'
  );
  assert.doesNotMatch(
    css,
    /\.labm-hc \.labm-hint[^{\n]*\{[^\n]*(border|background)/,
    'high contrast adds no box either'
  );
  assert.doesNotMatch(css, /\(forced-colors: active\) \{ \.labm-hint/, 'forced colors draws no box around a chip');
});

// ---- FIX2 (contract §10, round 2): plate words, no order-giving, no pan from a page scroll ----
// A 2D context stub that records the words painted into the bitmap (jsdom has no canvas).
function recordingCanvas(width = 480, height = 360) {
  const texts = [],
    ctx = new Proxy(
      {},
      {
        get(target, prop) {
          if (prop === 'fillText') return text => texts.push(String(text));
          if (prop === 'measureText') return text => ({ width: String(text).length * 7 });
          if (prop in target) return target[prop];
          return () => {};
        },
        set(target, prop, value) {
          target[prop] = value;
          return true;
        },
      }
    );
  return { canvas: { getContext: () => ctx, clientWidth: width, clientHeight: height, width: 0, height: 0 }, texts };
}
const ORDER_WORDS = /\bthen\b|\bfinish\b|\bpick\b|\bfirst\b|\bturn\b/i;

test('FIX2-micro desktop-9: an unfinished run is headed "Steps still to do" on the plate, the painted label, the canvas name and the Measure note; Not modeled stays on a real no-basis card', () => {
  const { M, lab, app, close } = harness();
  try {
    const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      partial = perform(lab, lab.createRun({ id: 'run-9', specimenId: 'SPEC-SYN-AD-01' }), S.STEPS.slice(0, 3)),
      inProgress = lab.resolve(partial),
      // MODE (§11.5): toning off is modeled now; a deviated washes condition is still a setting gap.
      gapRun = perform(
        lab,
        lab.createRun({ id: 'run-4', specimenId: 'SPEC-SYN-AD-01', params: { washes: { condition: 'deviated' } } }),
        S.STEPS.slice(0, 3)
      ),
      gap = lab.resolve(gapRun),
      cardRun = fullRun(lab, 'run-2', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } }),
      card = lab.resolve(cardRun);
    assert.equal(inProgress.code, 'step-skipped');
    assert.equal(gap.code, 'step-skipped');
    assert.equal(card.label, 'no-basis');
    assert.notEqual(card.code, 'step-skipped');
    const paint = outcome => {
      const { canvas, texts } = recordingCanvas();
      assert.ok(M.renderSynthetic(canvas, { specimen: spec, outcome }));
      return texts;
    };
    // In progress: the plate's heading, its words and the painted label strip.
    let texts = paint(inProgress);
    assert.equal(texts[0], 'Steps still to do', 'the plate heading');
    assert.equal(texts[texts.length - 1], 'Steps still to do', 'the painted label strip');
    assert.ok(!texts.some(t => /not modeled/i.test(t)), texts.join(' | '));
    assert.ok(texts.join(' ').includes('The picture is drawn once every step is done.'), texts.join(' | '));
    // In progress with a setting the model has no rule for: still headed in progress; the body says
    // what it comes back as once finished.
    texts = paint(gap);
    assert.equal(texts[0], 'Steps still to do');
    assert.equal(texts[texts.length - 1], 'Steps still to do');
    assert.match(
      texts.join(' '),
      /Finished, it still comes back Not modeled: the model has no rule for its settings\./
    );
    // A real no-basis card keeps Not modeled.
    texts = paint(card);
    assert.equal(texts[0], 'Not modeled');
    assert.equal(texts[texts.length - 1], 'Not modeled');
    assert.ok(texts.includes('(no stain is drawn without a model rule)'));
    // Mounted: the canvas name and the Measure note use the same words.
    let handle = M.mount(app, { lab, specimen: spec, runs: [partial], outcomes: [inProgress] });
    assert.equal(app.querySelector('canvas').getAttribute('aria-label'), 'run-9: Steps still to do');
    app.querySelector('[data-labm-measure-open]').click();
    assert.equal(
      app.querySelector('[data-labm-tools-note]').textContent,
      'Nothing to measure: run-9 has steps still to do, so there is no picture yet.'
    );
    assert.doesNotMatch(app.querySelector('.labm').textContent, /Not modeled/);
    handle.destroy();
    handle = M.mount(app, { lab, specimen: spec, runs: [cardRun], outcomes: [card] });
    assert.equal(app.querySelector('canvas').getAttribute('aria-label'), 'run-2: Not modeled');
    app.querySelector('[data-labm-measure-open]').click();
    assert.equal(
      app.querySelector('[data-labm-tools-note]').textContent,
      'Nothing to measure: run-2 is not modeled, so there is no picture.'
    );
    handle.destroy();
  } finally {
    close();
  }
});

test('FIX2-micro desktop-10: the microscope says what things do, never an order or a "then" (plate, steps line, keys list, layers legend, Measure note, swipe caption, stage name)', () => {
  const { M, lab, app, close } = harness();
  try {
    const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      partial = perform(lab, lab.createRun({ id: 'run-9', specimenId: 'SPEC-SYN-AD-01' }), S.STEPS.slice(0, 3)),
      inProgress = lab.resolve(partial);
    const { canvas, texts } = recordingCanvas();
    M.renderSynthetic(canvas, { specimen: spec, outcome: inProgress });
    assert.doesNotMatch(texts.join(' '), ORDER_WORDS, texts.join(' | '));
    let handle = M.mount(app, { lab, specimen: spec, runs: [partial], outcomes: [inProgress] });
    const line = app.querySelector('[data-labm-card="0"]').textContent;
    assert.equal(
      line,
      '3 of 9 steps done. The microscope draws the picture once every step is done.'.replace('9', S.STEPS.length)
    );
    const keys = app.querySelector('.labm-keys').textContent;
    assert.doesNotMatch(keys, /\bthen\b/i, keys);
    assert.ok(keys.includes('With the picture focused (click it or Tab to it): arrow keys pan'), keys);
    assert.ok(
      keys.includes(
        'Touch: with Drag to pan off, one finger scrolls the page; with it on, one finger pans the picture and two fingers pinch to zoom.'
      ),
      keys
    );
    handle.destroy();
    // A finished run: the stage name, the layers legend and the Measure note (one run, then two).
    const a = fullRun(lab, 'run-1', 'SPEC-SYN-AD-01'),
      b = fullRun(lab, 'run-3', 'SPEC-SYN-AD-01', { silverImpregnation: { time: 'shorter' } });
    handle = M.mount(app, {
      lab,
      specimen: spec,
      runs: [a, b],
      outcomes: [lab.resolve(a), lab.resolve(b)],
      settings: { reducedMotion: 'on' },
    });
    const stage = app.querySelector('[role="application"]');
    assert.doesNotMatch(stage.getAttribute('aria-label'), /\bUse\b/);
    assert.ok(stage.getAttribute('aria-label').endsWith('Arrow keys pan; plus and minus zoom.'));
    app.querySelector('[data-labm-layers-toggle]').click();
    const legend = app.querySelector('[data-labm-legend]');
    assert.ok(legend, 'Layers on shows the legend');
    assert.doesNotMatch(legend.textContent, ORDER_WORDS, legend.textContent);
    assert.ok(legend.textContent.includes('The layers are picked under “Numbers behind this image”.'));
    app.querySelector('[data-labm-measure-open]').click();
    let note = app.querySelector('[data-labm-tools-note]').textContent;
    assert.ok(note.startsWith('Each tool shows its rule; the tool opens once the rule is read.'), note);
    assert.doesNotMatch(note, ORDER_WORDS, note);
    app.querySelector('[data-labm-measure-open]').click();
    handle.update({ compare: true });
    assert.equal(handle.state().compare, true);
    app.querySelector('[data-labm-measure-open]').click();
    note = app.querySelector('[data-labm-tools-note]').textContent;
    assert.ok(note.endsWith('Grids and outlines show on one run only, with Compare off.'), note);
    assert.doesNotMatch(note, ORDER_WORDS, note);
    // The swipe caption says what the slider does.
    app.querySelector('[data-labm-compare-mode="swipe"]').click();
    const swipe = app.querySelector('.labm-swipe figcaption');
    assert.ok(swipe, 'swipe view');
    assert.ok(swipe.textContent.endsWith('The slider moves the split.'), swipe.textContent);
    handle.destroy();
  } finally {
    close();
  }
});

test('FIX2-micro partial-micro-pan-nudge: with Drag to pan off a finger never pans or zooms the picture (a page scroll starting on it leaves it put); a cancelled gesture puts back any pan or zoom; Drag to pan on still pans and pinches', async () => {
  const { w, M, lab, app, close } = harness();
  try {
    const handle = mountOne(M, lab, app),
      canvas = () => app.querySelector('canvas'),
      delta = app.querySelector('[data-labm-live-delta]'),
      view = () => {
        const { cx, cy, zoom } = handle.state();
        return { cx, cy, zoom };
      },
      ev = (type, id, x, y, pointerType = 'touch') =>
        canvas().dispatchEvent(
          new w.PointerEvent(type, { pointerId: id, pointerType, clientX: x, clientY: y, bubbles: true })
        );
    const start = view();
    assert.equal(handle.state().touchPan, false, 'Drag to pan is off by default');
    // The browser's page scroll: a few moves past the tap slop, then pointercancel.
    ev('pointerdown', 1, 160, 160);
    ev('pointermove', 1, 160, 140);
    ev('pointermove', 1, 158, 120);
    assert.deepEqual(view(), start, 'no pan while the browser decides');
    ev('pointercancel', 1, 158, 120);
    assert.deepEqual(view(), start, 'nothing to put back');
    // A sideways finger drag (pan-y: the page does not take it) is still the page's, not a pan.
    delta.textContent = '';
    ev('pointerdown', 1, 200, 120);
    for (const x of [190, 170, 140, 110]) ev('pointermove', 1, x, 120);
    ev('pointerup', 1, 110, 120);
    await sleep(150);
    assert.deepEqual(view(), start, 'a sideways finger drag does not pan');
    assert.equal(delta.textContent, '', 'and announces no pan');
    assert.equal(tagMain(app), null, 'and names nothing');
    // Two fingers: the page's pinch, never the picture's zoom.
    ev('pointerdown', 1, 140, 120);
    ev('pointerdown', 2, 180, 120);
    ev('pointermove', 1, 100, 120);
    ev('pointermove', 2, 220, 120);
    assert.deepEqual(view(), start, 'no zoom from a page pinch');
    ev('pointercancel', 1, 100, 120);
    ev('pointercancel', 2, 220, 120);
    assert.deepEqual(view(), start);
    // A pen pans (it is not the page's finger); if the browser then takes it, the pan is put back.
    ev('pointerdown', 5, 160, 120, 'pen');
    ev('pointermove', 5, 130, 100, 'pen');
    assert.notDeepEqual(view(), start, 'a pen drag pans');
    ev('pointercancel', 5, 130, 100, 'pen');
    assert.deepEqual(view(), start, 'a cancelled pen drag is put back');
    // Drag to pan on: a finger pans and a pinch zooms; a cancel mid-pinch puts the zoom back.
    app.querySelector('[data-labm-touch-pan]').click();
    assert.equal(handle.state().touchPan, true);
    delta.textContent = '';
    ev('pointerdown', 1, 200, 120);
    ev('pointermove', 1, 170, 120);
    ev('pointerup', 1, 170, 120);
    await sleep(150);
    const panned = view();
    assert.notEqual(panned.cx, start.cx, 'Drag to pan on: a finger pans');
    assert.match(delta.textContent, /^Panned; /);
    ev('pointerdown', 1, 140, 120);
    ev('pointerdown', 2, 180, 120);
    ev('pointermove', 2, 240, 120);
    assert.ok(view().zoom > panned.zoom, 'Drag to pan on: a pinch zooms');
    ev('pointercancel', 2, 240, 120);
    ev('pointercancel', 1, 140, 120);
    assert.equal(view().zoom, panned.zoom, 'a cancelled pinch puts the zoom back');
    ev('pointerdown', 1, 140, 120);
    ev('pointerdown', 2, 180, 120);
    ev('pointermove', 2, 240, 120);
    ev('pointerup', 2, 240, 120);
    ev('pointerup', 1, 140, 120);
    assert.ok(view().zoom > panned.zoom, 'a finished pinch keeps its zoom');
    // A mouse drag always pans (unchanged).
    app.querySelector('[data-labm-touch-pan]').click();
    const before = view();
    ev('pointerdown', 9, 160, 120, 'mouse');
    ev('pointermove', 9, 120, 120, 'mouse');
    ev('pointerup', 9, 120, 120, 'mouse');
    assert.notEqual(view().cx, before.cx, 'a mouse drag pans with Drag to pan off');
    handle.destroy();
  } finally {
    close();
  }
});

// ---- FIX3-micro: round-3 shared decisions G4, G5, G6 (contract FIX3-micro-n) ----
const LOCK = 'This run now stays as it is so the record keeps matching; changes go in a new run.';
// Records a tissue coverage of 8 squares on the mounted viewer and returns the status line.
function recordCoverage(w, app) {
  app.querySelector('[data-labm-measure-open]').click();
  app.querySelector('[data-labm-tool="tissue-coverage"]').click();
  app.querySelector('[data-labm-rule-ok]').click();
  const cells = app.querySelector('[data-labm-field="cells"]');
  cells.value = '8';
  cells.dispatchEvent(new w.Event('input', { bubbles: true }));
  app.querySelector('[data-labm-tool-form]').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  return app.querySelector('[data-labm-status]').textContent;
}

test('FIX3-micro d3-2 (G4): My report and experiments are named only while CortexLab.featureOn has them on; with the shell loaded a record says the run now stays as it is', async () => {
  const { w, M, lab, app, close } = harness();
  try {
    const REPORT =
        'Saved in this lab and listed under From your lab work in My report. Add a note about it (or use the run in an experiment) to put it in the exported report.',
      head = `Recorded: Tissue coverage = 0.5 (fraction) for run-1, labeled “${SIM}”.`,
      note = () => app.querySelector('[data-labm-tools-note]').textContent,
      text = () => app.querySelector('.labm').textContent;
    // No shell (standalone): as before, and nothing locks, so no lock line.
    let handle = mountOne(M, lab, app, { onMeasurement() {} });
    assert.equal(recordCoverage(w, app), `${head} ${REPORT}`);
    assert.ok(note().includes('listed under From your lab work in My report.'), note());
    handle.destroy();
    // The app with the report, designer and activities off (the BENCH-1 default).
    const asked = [];
    w.CortexLab = {
      featureOn: name => {
        asked.push(name);
        return false;
      },
    };
    handle = mountOne(M, lab, app, { onMeasurement() {} });
    const status = recordCoverage(w, app);
    // FIX4 (H2): with the report off nothing locks, so the status says what was recorded, plainly.
    assert.equal(status, `Recorded. Tissue coverage = 0.5 (fraction) for run-1, labeled “${SIM}”.`);
    assert.equal(
      note(),
      `Each tool shows its rule; the tool opens once the rule is read. Each record is labeled “${SIM}”.`
    );
    assert.doesNotMatch(text(), /My report|experiment\b|experiments|exported report|saved in this lab|stays as it is/i);
    assert.ok(asked.includes('report'), 'the shell is asked');
    handle.destroy();
    // Report on, designer off: the report is named, experiments are not.
    w.CortexLab = { featureOn: name => name === 'report' };
    handle = mountOne(M, lab, app, { onMeasurement() {} });
    assert.equal(
      recordCoverage(w, app),
      `${head} Saved in this lab and listed under From your lab work in My report. Add a note about it to put it in the exported report. ${LOCK}`
    );
    assert.ok(note().includes('My report'));
    handle.destroy();
    // Both on, an older shell without featureOn, and a featureOn that throws: the full sentence.
    for (const shell of [
      { featureOn: () => true },
      {},
      {
        featureOn: () => {
          throw new Error('x');
        },
      },
    ]) {
      w.CortexLab = shell;
      handle = mountOne(M, lab, app, { onMeasurement() {} });
      assert.equal(recordCoverage(w, app), `${head} ${REPORT} ${LOCK}`);
      handle.destroy();
    }
    // The line says what it does, never an order.
    assert.doesNotMatch(LOCK, /\bthen\b|^Start|start a new run/);
    delete w.CortexLab;
    await sleep(30);
  } finally {
    close();
  }
});

test('FIX3-micro d3-8 (G5): a click counts only on a drawn lesion of the counted kind; elsewhere the tag says so and nothing counts; a running total under the picture; Record with no rule brings the rule field', async () => {
  const { w, M, lab, app, close } = harness();
  try {
    const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      px = 0.24, // 4x on jsdom's 320 x 240 fallback: screen px per field unit
      shapes = M.shapeList(spec).shapes,
      taken = [],
      handle = mountOne(M, lab, app, { onMeasurement: m => taken.push(m) }),
      canvas = () => app.querySelector('canvas'),
      tally = () => app.querySelector('[data-labm-tally]'),
      counts = () => [...app.querySelectorAll('[data-labm-roi]')].map(i => i.value).join(','),
      lines = () => [...tagOf(app).children].map(n => n.textContent),
      press = (field, type = 'mouse') => {
        const at = clientAt(handle, field.x, field.y);
        pointer(w, canvas(), 'pointerdown', at, { pointerType: type });
        pointer(w, canvas(), 'pointerup', at, { pointerType: type });
      };
    key(w, app.querySelector('[role="application"]'), '1');
    app.querySelector('[data-labm-measure-open]').click();
    app.querySelector('[data-labm-tool="roi-lesion-count"]').click();
    assert.equal(tally().hidden, true, 'no total before the rule is read (no grid, no counting)');
    assert.ok(tally().closest('.labm-stage'), 'the total sits with the picture');
    assert.equal(tally().getAttribute('aria-hidden'), 'true', 'the region boxes are the accessible path');
    app.querySelector('[data-labm-rule-ok]').click();
    assert.equal(tally().hidden, false);
    assert.equal(tally().textContent, 'Plaque cores counted: 0');
    // Empty paper: nothing within 14 screen px.
    let blank = null;
    for (let y = 60; y < 960 && !blank; y += 20)
      for (let x = 60; x < 960; x += 20)
        if (!M.structureAt(spec, x, y, { tolerance: 14 / px })) {
          blank = { x, y };
          break;
        }
    press(blank);
    assert.deepEqual(lines(), ['No lesion here', 'Nothing counted']);
    assert.equal(counts(), '0,0,0,0,0,0,0,0,0');
    // A tangle (the top-most shape there, no plaque core near): named, not counted.
    const tangle = shapes.find(
      s =>
        s.site === 'tangle' &&
        M.structureAt(spec, s.x, s.y) === s &&
        !M.structureAt(spec, s.x, s.y, { tolerance: 30 / px, drawn: o => o.site === 'plaque-core' })
    );
    press(tangle);
    assert.deepEqual(lines(), ['Tangle (drawn): not counted', 'Counting: plaque core']);
    assert.equal(counts(), '0,0,0,0,0,0,0,0,0');
    assert.equal(tally().textContent, 'Plaque cores counted: 0');
    // A plaque core in region 5 counts there, even under a tangle drawn on top of it.
    // FIX5 (I1): the tag also says what a second click does (a hint line, hints on).
    const core = coreIn(M, spec, 4);
    let now = 1000;
    w.Date.now = () => now;
    press(core);
    assert.deepEqual(lines(), ['Region 5: 1 counted', 'Plaque core (drawn)', 'Click it again: take it off']);
    assert.equal(counts(), '0,0,0,0,1,0,0,0,0');
    assert.equal(tally().textContent, 'Plaque cores counted: 1');
    // Tolerance: 9 screen px past the core's edge a mouse click misses (6 px), a tap counts (12 px).
    let edge = null;
    for (let a = 0; a < Math.PI * 2 && !edge; a += Math.PI / 8) {
      let d = 0;
      while (M.structureAt(spec, core.x + Math.cos(a) * d, core.y + Math.sin(a) * d, { drawn: s => s === core }))
        d += 1;
      const p = { x: core.x + Math.cos(a) * (d + 9 / px), y: core.y + Math.sin(a) * (d + 9 / px) },
        onlyCores = { drawn: s => s.site === 'plaque-core' };
      if (
        Math.floor(p.y / (1000 / 3)) === 1 &&
        Math.floor(p.x / (1000 / 3)) === 1 &&
        !M.structureAt(spec, p.x, p.y, { ...onlyCores, tolerance: 6 / px }) &&
        M.structureAt(spec, p.x, p.y, { ...onlyCores, tolerance: 12 / px }) === core
      )
        edge = p;
    }
    assert.ok(edge, 'a point 9 px off the core, still in region 5');
    press(edge, 'mouse');
    assert.doesNotMatch(lines()[0], /^Region /, lines()[0]);
    assert.equal(lines()[1].startsWith('Nothing counted') || lines()[1] === 'Counting: plaque core', true, lines()[1]);
    assert.equal(counts(), '0,0,0,0,1,0,0,0,0');
    // FIX5 (I1): the tap reaches the same core (already counted), so a while later it takes it off,
    // and one more tap counts it again: one lesion, one count.
    now += 2000;
    press(edge, 'touch');
    assert.deepEqual(lines(), ['Region 5: 0 counted', 'Plaque core (drawn): taken off']);
    assert.equal(tally().textContent, 'Plaque cores counted: 0');
    now += 2000;
    press(edge, 'touch');
    assert.deepEqual(lines(), ['Region 5: 1 counted', 'Plaque core (drawn)', 'Tap it again: take it off']);
    assert.equal(tally().textContent, 'Plaque cores counted: 1');
    // Typed counts still work, and the total follows them and the kind being counted.
    const box = app.querySelector('[data-labm-roi="0"]');
    box.value = '3';
    box.dispatchEvent(new w.Event('input', { bubbles: true }));
    assert.equal(tally().textContent, 'Plaque cores counted: 4');
    const sel = app.querySelector('[data-labm-field="site"]');
    sel.value = 'tangle';
    sel.dispatchEvent(new w.Event('change', { bubbles: true }));
    // FIX4 (r3-d3-8): each kind keeps its own counts; the cores counted so far are not called tangles.
    assert.equal(tally().textContent, 'Tangles counted: 0');
    assert.equal(counts(), '0,0,0,0,0,0,0,0,0');
    // Counting tangles, the same tangle now counts (one in its region).
    const ti = Math.floor(tangle.y / (1000 / 3)) * 3 + Math.floor(tangle.x / (1000 / 3));
    press(tangle);
    assert.deepEqual(lines(), [`Region ${ti + 1}: 1 counted`, 'Tangle (drawn)', 'Click it again: take it off']);
    assert.equal(tally().textContent, 'Tangles counted: 1');
    sel.value = 'plaque-core';
    sel.dispatchEvent(new w.Event('change', { bubbles: true }));
    assert.equal(tally().textContent, 'Plaque cores counted: 4', 'the cores come back');
    assert.equal(counts(), '3,0,0,0,1,0,0,0,0');
    // Show hints off hides the chips, not the total (it is a count, not a hint).
    w.CortexLab = { hintsOn: () => false };
    key(w, app.querySelector('[role="application"]'), '0');
    assert.equal(app.querySelector('[data-labm-hud]').hidden, true);
    assert.equal(tally().hidden, false);
    delete w.CortexLab;
    // Record with no rule: refused, and the rule field (above the region boxes) gets focus.
    const form = app.querySelector('[data-labm-tool-form="roi-lesion-count"]'),
      crit = form.querySelector('[data-labm-field="criterion"]');
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(taken.length, 0);
    assert.equal(w.document.activeElement, crit);
    assert.equal(
      form.querySelector('.labm-error').textContent,
      'Write your rule for what counts (the inclusion criterion) first.'
    );
    crit.value = 'drawn cores only';
    crit.dispatchEvent(new w.Event('input', { bubbles: true }));
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(taken.length, 1);
    assert.equal(taken[0].value, 4);
    assert.ok(taken[0].note.startsWith('class=plaque-core;'), taken[0].note);
    assert.ok(taken[0].note.includes('regions=[3,0,0,0,1,0,0,0,0]'), taken[0].note);
    assert.equal(tally().hidden, true, 'the total goes with the tool');
    handle.destroy();
    await sleep(30);
  } finally {
    close();
  }
});

test('FIX3-micro d3-7 (G6): the full microscope view opens with the badge, objectives and picture (with its chips) in view below the top bar; an inline viewer or a picture already in view moves nothing', async () => {
  const { w, M, lab, app, close } = harness();
  try {
    const doc = w.document,
      calls = [];
    doc.documentElement.style.setProperty('--lab-topbar-h', '64px');
    w.innerHeight = 800;
    w.scrollTo = opts => calls.push(opts);
    let scrollY = 0;
    Object.defineProperty(w, 'scrollY', { configurable: true, get: () => scrollY });
    const host = (inView = true) => {
      app.replaceChildren();
      const main = doc.createElement('main');
      if (inView) main.className = 'panel lab-page lab-view-microscope';
      const div = doc.createElement('div');
      main.appendChild(div);
      app.appendChild(main);
      return div;
    };
    // Rects as the page lays them out at scrollY 0 (1280 x 800: badge 389, picture 481-1049).
    const layout = (stage, badge) => {
      app.querySelector('.labm-stage').getBoundingClientRect = () => ({
        top: stage[0] - scrollY,
        bottom: stage[1] - scrollY,
        height: stage[1] - stage[0],
      });
      app.querySelector('.labm-badges').getBoundingClientRect = () => ({ top: badge - scrollY });
    };
    const open = async (stage, badge, inView = true, before) => {
      calls.length = 0;
      const handle = mountOne(M, lab, host(inView));
      layout(stage, badge);
      if (before) before(handle);
      await sleep(60);
      handle.destroy();
      return calls.map(c => ({ ...c }));
    };
    // Fits from the badge: the badge lands 20 px under the 64 px bar (instant, not smooth).
    assert.deepEqual(await open([481, 1049], 389), [{ top: 389 - 64 - 20, behavior: 'instant' }]);
    // The shell's smooth scroll to the top still running (scrollY 138): the same place.
    scrollY = 138;
    assert.deepEqual(await open([481, 1049], 389), [{ top: 305, behavior: 'instant' }]);
    scrollY = 0;
    // A picture too tall for the badge to come along: from the picture's top.
    assert.deepEqual(await open([481, 1381], 389), [{ top: 481 - 84, behavior: 'instant' }]);
    // Already in view at the page top, an inline viewer, or a viewer gone before the frame: nothing.
    assert.deepEqual(await open([200, 700], 120), []);
    assert.deepEqual(await open([481, 1049], 389, false), []);
    assert.deepEqual(await open([481, 1049], 389, true, handle => handle.destroy()), []);
  } finally {
    close();
  }
});

test('FIX3-micro: CSS: the running total is a line under the chips (full width, no pointer events), hidden with [hidden] and in print', () => {
  const css = fs.readFileSync(path.join(ROOT, 'lab-microscope.css'), 'utf8');
  assert.match(css, /\.labm \.labm-tally \{ grid-column: 1 \/ -1; [^}]*pointer-events: none; \}/);
  assert.match(css, /\.labm-tally\[hidden\] \{ display: none; \}/);
  assert.match(css, /@media print \{ \.labm-hud, \.labm-tag, \.labm-tally \{ display: none; \} \}/);
  assert.doesNotMatch(css.match(/\.labm \.labm-tally \{[^}]*\}/)[0], /hints-off/);
});

test('FIX4-micro r3-d3-2 (H2): with the report off a record says "Recorded." and what was recorded (no place, no lock line); with it on, the full sentence and the lock line; the caption follows', async () => {
  const { w, M, lab, app, close } = harness();
  try {
    const plain = `Recorded. Tissue coverage = 0.5 (fraction) for run-1, labeled “${SIM}”.`,
      caption = () => app.querySelector('[data-labm-tool-pane] .labm-caption').textContent,
      openCount = () => {
        app.querySelector('[data-labm-measure-open]').click();
        app.querySelector('[data-labm-tool="roi-lesion-count"]').click();
      };
    // The shipped app: report (and designer) off.
    w.CortexLab = { featureOn: () => false };
    let handle = mountOne(M, lab, app, { onMeasurement() {} });
    assert.equal(recordCoverage(w, app), plain);
    openCount();
    assert.ok(caption().endsWith(`Recorded with the label “${SIM}”.`), caption());
    assert.doesNotMatch(app.querySelector('.labm').textContent, /saved|stays as it is|My report|experiment/i);
    handle.destroy();
    // Report on, designer off: the report sentence without experiments, the lock line, "Saved with".
    w.CortexLab = { featureOn: name => name === 'report' };
    handle = mountOne(M, lab, app, { onMeasurement() {} });
    assert.equal(
      recordCoverage(w, app),
      `Recorded: Tissue coverage = 0.5 (fraction) for run-1, labeled “${SIM}”. Saved in this lab and listed under From your lab work in My report. Add a note about it to put it in the exported report. ${LOCK}`
    );
    openCount();
    assert.ok(caption().endsWith(`Saved with the label “${SIM}”.`), caption());
    handle.destroy();
    // Standalone (no shell): the old sentence and nothing locks.
    delete w.CortexLab;
    handle = mountOne(M, lab, app, { onMeasurement() {} });
    const solo = recordCoverage(w, app);
    assert.ok(solo.startsWith('Recorded: Tissue coverage') && !solo.includes(LOCK), solo);
    handle.destroy();
    await sleep(30);
  } finally {
    close();
  }
});

test('FIX4-micro d4-8: the picture tools caption what a click / tap does; the others keep their words', () => {
  const { w, M, lab, app, close } = harness();
  try {
    const caption = toolId => {
      app.querySelector(`[data-labm-tool="${toolId}"]`).click();
      return app.querySelector(`[data-labm-tool-pane="${toolId}"] .labm-caption`).textContent;
    };
    let handle = mountOne(M, lab, app, { onMeasurement() {} });
    app.querySelector('[data-labm-measure-open]').click();
    const count = caption('roi-lesion-count');
    assert.ok(count.startsWith('Unit: count. Click lesions on the picture, or type counts. '), count);
    assert.doesNotMatch(count, /Manual/);
    assert.ok(
      caption('artifact-area').startsWith('Unit: fraction. Click outline points on the picture, or mark squares.')
    );
    assert.ok(caption('blinded-quality-score').includes('Manual: you enter the value.'));
    assert.ok(caption('contrast-ordinal').includes('Worked out from the picture'));
    handle.destroy();
    w.matchMedia = query => ({
      media: query,
      matches: query === '(pointer: coarse)',
      addListener() {},
      removeListener() {},
    });
    handle = mountOne(M, lab, app, { onMeasurement() {} });
    app.querySelector('[data-labm-measure-open]').click();
    assert.ok(caption('roi-lesion-count').includes('Tap lesions on the picture, or type counts.'));
    assert.ok(caption('artifact-area').includes('Tap outline points on the picture, or mark squares.'));
    handle.destroy();
    delete w.matchMedia;
  } finally {
    close();
  }
});

test('FIX4-micro r3-d3-8: the count chip promises a count only while a lesion of the counted kind is drawn; the kind select re-checks it', () => {
  const { M, lab, app, close } = harness();
  try {
    const run = fullRun(lab, 'run-neg', 'SPEC-SYN-NEG-01'),
      hud = () => [...app.querySelectorAll('[data-labm-hud] .labm-hint')].map(n => n.textContent);
    // The negative comparison draws axons only: no plaque core or tangle to count.
    let handle = M.mount(app, {
      lab,
      specimen: lab.getSpecimen('SPEC-SYN-NEG-01'),
      runs: [run],
      outcomes: [lab.resolve(run)],
      settings: { reducedMotion: 'on' },
    });
    app.querySelector('[data-labm-measure-open]').click();
    app.querySelector('[data-labm-tool="roi-lesion-count"]').click();
    app.querySelector('[data-labm-rule-ok]').click();
    assert.ok(app.querySelector('.labm').classList.contains('labm-picking'), 'the tool takes clicks');
    assert.ok(!hud().some(t => /lesion/i.test(t)), hud().join(' | '));
    assert.ok(hud().includes('Drag: move around'), 'the view chips instead');
    assert.equal(app.querySelector('[data-labm-tally]').textContent, 'Plaque cores counted: 0', 'the total stays');
    handle.destroy();
    // AD-01 draws cores: the chip is there; it follows the kind select.
    handle = mountOne(M, lab, app, { onMeasurement() {} });
    app.querySelector('[data-labm-measure-open]').click();
    app.querySelector('[data-labm-tool="roi-lesion-count"]').click();
    app.querySelector('[data-labm-rule-ok]').click();
    assert.deepEqual(hud(), ['Click a lesion: count it in its region']);
    handle.destroy();
  } finally {
    close();
  }
});

// A small layout model for the FIX4 H3 checks: page positions per element (two layouts, as the
// picture tool's CSS would give), a scroll position that scrollBy / scrollTo move, and the stage's
// computed position (sticky above the sheet on a narrow viewer, or not).
function layoutModel(w, app, { stuck = false, submit = [1730, 1774] } = {}) {
  const model = { y: 0, calls: [], stuck };
  const picking = () => !!app.querySelector('.labm.labm-picking');
  const page = el => {
    if (el.classList.contains('labm-stage'))
      return stuck ? [129 + model.y, 429 + model.y, 16, 374] : [100, 400, 16, 374];
    if (el.classList.contains('labm-aside')) return [500, 3000, 16, 374];
    if (el.matches('[data-labm-rule-ok]')) return picking() ? [1100, 1120] : [900, 920];
    if (el.matches('[data-labm-tool-form] button[type="submit"]')) return submit;
    if (el.matches('[data-labm-tool-form] label:has([data-labm-field="criterion"])')) return [1150, 1237];
    if (el.matches('[data-labm-tool-form] .labm-error')) return [1249, 1294];
    return [0, 0];
  };
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    const [t, b, l = 0, r = 300] = page(this);
    return { top: t - model.y, bottom: b - model.y, height: b - t, left: l, right: r, width: r - l };
  };
  Object.defineProperty(w.HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return this.classList.contains('labm-stage') ? 300 : 0;
    },
  });
  const real = w.getComputedStyle.bind(w);
  w.getComputedStyle = el => {
    const cs = real(el);
    if (el.classList && el.classList.contains('labm-stage') && model.stuck && picking())
      return { position: 'sticky', top: '129px', getPropertyValue: p => cs.getPropertyValue(p) };
    return cs;
  };
  w.innerHeight = 800;
  w.document.documentElement.style.setProperty('--lab-topbar-h', '121px');
  w.scrollBy = opts => {
    model.calls.push({ by: Math.round(opts.top), behavior: opts.behavior });
    model.y += opts.top;
  };
  w.scrollTo = opts => {
    model.calls.push({ to: Math.round(opts.top), behavior: opts.behavior });
    model.y = opts.top;
  };
  return model;
}

test('FIX4-micro H3: the rule field comes first with its refusal under it, the region note sits under Record (it names the boxes); a tick keeps the checkbox in place, then brings it down to Record into the band', () => {
  const { w, M, lab, app, close } = harness();
  try {
    const handle = mountOne(M, lab, app, { onMeasurement() {} });
    app.querySelector('[data-labm-measure-open]').click();
    app.querySelector('[data-labm-tool="roi-lesion-count"]').click();
    const model = layoutModel(w, app, { submit: [1650, 1694] });
    model.y = 600; // the checkbox at 300 on screen
    app.querySelector('[data-labm-rule-ok]').click();
    // The picture tool's layout moved the checkbox 200 px down: the page follows it (300 stays 300),
    // then the checkbox down to Record (1100..1694, 594 px) comes into the band under the 121 px bar
    // (129..792): its end at the band's bottom.
    assert.deepEqual(model.calls, [
      { by: 200, behavior: 'instant' },
      { by: 1694 - 800 - 792, behavior: 'instant' },
    ]);
    assert.equal(1100 - model.y, 1100 - 1694 + 792, 'the checkbox stays in view');
    assert.ok(app.querySelector('[data-labm-rule-ok]') === w.document.activeElement, 'focus stays on the checkbox');
    const form = app.querySelector('[data-labm-tool-form="roi-lesion-count"]'),
      body = form.querySelector('.labm-tool-body'),
      kids = [...body.children].map(n =>
        n.matches('label')
          ? n.querySelector('[data-labm-field]')?.getAttribute('data-labm-field')
          : n.className || n.tagName
      );
    assert.deepEqual(kids, ['criterion', 'labm-error', 'site', 'labm-roi', 'btn']);
    const where = form.lastElementChild;
    assert.equal(where.id, form.querySelector('.labm-roi').getAttribute('aria-describedby'));
    assert.equal(
      where.textContent,
      'Regions 1 to 9 run left to right, top to bottom on the picture (a fixed 3×3 grid); a lesion counts in the region it sits in.'
    );
    assert.ok(
      form.querySelector('button[type="submit"]').compareDocumentPosition(where) & 4,
      'the note is under Record'
    );
    // The tool closed again (Close tool): the layout goes; focus on the tool's button, nothing thrown.
    model.calls.length = 0;
    form.querySelector('[data-labm-tool-close]').click();
    assert.equal(app.querySelector('.labm').classList.contains('labm-picking'), false);
    assert.equal(w.document.activeElement.getAttribute('data-labm-tool'), 'roi-lesion-count');
    handle.destroy();
  } finally {
    close();
  }
});

test('FIX4-micro H3: with the picture stuck above the sheet (narrow), a refused Record focuses the rule field without the browser scroll and brings it and the refusal in under the picture; --labm-stuck-h follows', () => {
  const { w, M, lab, app, close } = harness();
  try {
    const handle = mountOne(M, lab, app, { onMeasurement() {} }),
      html = w.document.documentElement;
    app.querySelector('[data-labm-measure-open]').click();
    app.querySelector('[data-labm-tool="roi-lesion-count"]').click();
    const model = layoutModel(w, app, { stuck: true });
    model.y = 1000;
    app.querySelector('[data-labm-rule-ok]').click();
    assert.equal(html.style.getPropertyValue('--labm-stuck-h'), '308px', 'the stuck picture (300 px) + 8');
    // The checkbox lands just under the stuck picture (129 + 300 + 8); checkbox to Record (674 px) is
    // taller than what is left of the band, so the checkbox leads.
    assert.equal(1100 - model.y, 437);
    assert.ok(model.calls.every(c => c.behavior === 'instant'));
    // Refused Record: focus without the browser's scroll, then field (1150) + refusal (1294) under the picture.
    const focusOpts = [];
    const realFocus = w.HTMLInputElement.prototype.focus;
    w.HTMLInputElement.prototype.focus = function (opts) {
      focusOpts.push(opts);
      return realFocus.call(this, opts);
    };
    model.y = 1400; // the field at -250: under the picture and the bar
    model.calls.length = 0;
    const form = app.querySelector('[data-labm-tool-form="roi-lesion-count"]');
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(JSON.stringify(focusOpts), '[{"preventScroll":true}]');
    assert.equal(w.document.activeElement.getAttribute('data-labm-field'), 'criterion');
    assert.deepEqual(model.calls, [{ by: 1150 - 1400 - 437, behavior: 'instant' }]);
    assert.equal(
      form
        .querySelector('.labm-error')
        .previousElementSibling.querySelector('[data-labm-field]')
        .getAttribute('data-labm-field'),
      'criterion',
      'the refusal is right under the field'
    );
    w.HTMLInputElement.prototype.focus = realFocus;
    // The tool closes: the stuck height goes; destroy leaves nothing behind either.
    form.querySelector('[data-labm-tool-close]').click();
    assert.equal(html.style.getPropertyValue('--labm-stuck-h'), '');
    app.querySelector('[data-labm-tool="roi-lesion-count"]').click();
    assert.equal(
      html.style.getPropertyValue('--labm-stuck-h'),
      '308px',
      'the rule is still read: the tool opens taking clicks'
    );
    handle.destroy();
    assert.equal(html.style.getPropertyValue('--labm-stuck-h'), '');
  } finally {
    close();
  }
});

test('FIX4-micro p4-3 (H10): the full view opens with the picture in the band between the top bar and an open Notes drawer (CortexLab.viewportInsets), the canvas whole when the chips cannot fit; once more after the page-in animation when the band changed', async () => {
  const { w, M, lab, app, close } = harness();
  try {
    const doc = w.document,
      calls = [];
    doc.documentElement.style.setProperty('--lab-topbar-h', '159px');
    w.innerHeight = 640;
    let scrollY = 0,
      insets = { top: 159, bottom: 252 };
    Object.defineProperty(w, 'scrollY', { configurable: true, get: () => scrollY });
    w.scrollTo = opts => {
      calls.push({ ...opts });
      scrollY = opts.top;
    };
    w.CortexLab = { viewportInsets: () => insets };
    let anim = null;
    const host = () => {
      app.replaceChildren();
      const main = doc.createElement('main');
      main.className = 'panel lab-page lab-view-microscope';
      main.getAnimations = () => (anim ? [anim] : []);
      const div = doc.createElement('div');
      main.appendChild(div);
      app.appendChild(main);
      return div;
    };
    // 320 x 640 at the page top: badge 556, stage 702..970 (chips to 962), canvas 711..913.
    const layout = () => {
      const at = (sel, t, b) =>
        (app.querySelector(sel).getBoundingClientRect = () => ({
          top: t - scrollY,
          bottom: b - scrollY,
          height: b - t,
        }));
      at('.labm-stage', 702, 970);
      at('.labm-canvas', 711, 913);
      at('.labm-badges', 556, 584);
    };
    const open = async () => {
      calls.length = 0;
      scrollY = 0;
      const handle = mountOne(M, lab, host());
      layout();
      await sleep(60);
      return handle;
    };
    // Drawer open (band 179..388 with the 20 px gap): the stage with its chips (268) does not fit, so
    // the canvas (202) is brought whole above the drawer.
    let handle = await open();
    assert.deepEqual(calls, [{ top: 711 - 179, behavior: 'instant' }]);
    handle.destroy();
    // No drawer: as before (badge to picture bottom fits under the bar).
    insets = { top: 159, bottom: 0 };
    handle = await open();
    assert.deepEqual(calls, [{ top: 556 - 179, behavior: 'instant' }]);
    handle.destroy();
    // A shell without viewportInsets (or one that throws): the top bar's --lab-topbar-h, no drawer.
    w.CortexLab = {
      viewportInsets: () => {
        throw new Error('x');
      },
    };
    handle = await open();
    assert.deepEqual(calls, [{ top: 556 - 179, behavior: 'instant' }]);
    handle.destroy();
    // The page-in animation still running: the drawer reads 0 until it ends; then the band changed and
    // the stage is not whole in it, so the canvas comes up above the drawer.
    let done;
    anim = { playState: 'running', finished: new Promise(resolve => (done = resolve)) };
    insets = { top: 159, bottom: 0 };
    w.CortexLab = { viewportInsets: () => insets };
    handle = await open();
    assert.deepEqual(calls, [{ top: 556 - 179, behavior: 'instant' }]);
    insets = { top: 159, bottom: 252 };
    done();
    await sleep(60);
    assert.deepEqual(calls.at(-1), { top: 711 - 179, behavior: 'instant' });
    assert.equal(calls.length, 2);
    handle.destroy();
    // The animation ends with the band unchanged: no second scroll.
    anim = { playState: 'running', finished: new Promise(resolve => (done = resolve)) };
    insets = { top: 159, bottom: 0 };
    handle = await open();
    done();
    await sleep(60);
    assert.equal(calls.length, 1);
    handle.destroy();
    delete w.CortexLab;
  } finally {
    close();
  }
});

test('FIX4-micro H3: CSS: the sheet beside the picture at 600-859 px while a picture tool is open, the picture stuck under the top bar on tall windows (the stage alone under 600 px), never with an open drawer; the page scroll padding clears a stuck picture', () => {
  const css = fs.readFileSync(path.join(ROOT, 'lab-microscope.css'), 'utf8');
  const block = css.slice(css.indexOf('FIX4 (H3)'), css.indexOf('/* ---------- GAME-micro'));
  assert.match(
    block,
    /@container labm \(min-width: 600px\) and \(max-width: 859px\) \{\n {2}\.labm-picking \.labm-main \{ display: grid; grid-template-columns: minmax\(0, 1fr\) minmax\(260px, 300px\);/
  );
  assert.match(
    block,
    /@media \(min-height: 560px\) \{\n {2}@container labm \(min-width: 600px\) and \(max-width: 859px\) \{\n {4}\.labm-picking \.labm-panel \{ position: sticky; top: calc\(var\(--lab-topbar-h/
  );
  assert.match(
    block,
    /@container labm \(max-width: 599px\) \{\n {4}\.labm-picking \.labm-panel \{ display: contents; \}\n {4}\.labm-picking \.labm-stage \{ position: sticky; top: calc\(var\(--lab-topbar-h, var\(--topbar-h, 64px\)\) \+ 8px\); z-index: 2;/
  );
  assert.match(
    block,
    /html:has\(\.labm-picking\) \{ scroll-padding-top: calc\(var\(--lab-topbar-h, 64px\) \+ 8px \+ var\(--labm-stuck-h, 0px\)\); \}/
  );
  assert.match(
    block,
    /@media \(max-width: 899\.98px\) \{ main\.lab-notes-open \.labm-picking \.labm-stage \{ position: relative; box-shadow: none; \} \}/
  );
  // One rule per line.
  for (const line of block.split('\n'))
    assert.ok((line.match(/\{/g) || []).length <= 2 || line.startsWith('@media (max-width: 899.98px)'), line);
});

// ---- FIX5 (contract §10, round 5): lesions counted once, Record in view after a refusal, one announcement ----
// A 2D context for the mounted canvas that keeps what the last paint drew: the ring numbers (the only
// text painted in bold 700) and every arc (centre and radius, field units).
function ringRecorder(w) {
  let labels = [],
    arcs = [];
  const ctx = new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === 'clearRect')
          return () => {
            labels = [];
            arcs = [];
          };
        if (prop === 'fillText')
          return text => {
            if (/^700 /.test(String(target.font || ''))) labels.push(String(text));
          };
        if (prop === 'arc') return (x, y, r) => arcs.push({ x, y, r });
        if (prop === 'measureText') return text => ({ width: String(text).length * 7 });
        if (prop in target) return target[prop];
        return () => {};
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    }
  );
  w.HTMLCanvasElement.prototype.getContext = () => ctx;
  return {
    labels: () => labels.slice(),
    ringAt: s => arcs.some(a => Math.abs(a.x - s.x) < 1e-6 && Math.abs(a.y - s.y) < 1e-6 && a.r > s.r),
  };
}

test('FIX5-micro I1 (d5-1): Count lesions counts lesions: a double click counts one lesion once, a later click takes it back, each counted lesion is ringed and numbered in the order counted, each kind keeps its own rings', () => {
  const { w, M, lab, app, close } = harness();
  try {
    const rec = ringRecorder(w),
      spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      taken = [],
      handle = mountOne(M, lab, app, { onMeasurement: m => taken.push(m) }),
      canvas = () => app.querySelector('canvas'),
      tally = () => app.querySelector('[data-labm-tally]').textContent,
      counts = () => [...app.querySelectorAll('[data-labm-roi]')].map(i => i.value).join(','),
      lines = () => [...tagOf(app).children].map(n => n.textContent),
      cell = 1000 / 3,
      regionOf = s => Math.floor(s.y / cell) * 3 + Math.floor(s.x / cell),
      click = (shape, pointerType = 'mouse') => {
        const at = clientAt(handle, shape.x, shape.y);
        pointer(w, canvas(), 'pointerdown', at, { pointerType });
        pointer(w, canvas(), 'pointerup', at, { pointerType });
      };
    let now = 5000;
    w.Date.now = () => now;
    key(w, app.querySelector('[role="application"]'), '1');
    app.querySelector('[data-labm-measure-open]').click();
    app.querySelector('[data-labm-tool="roi-lesion-count"]').click();
    app.querySelector('[data-labm-rule-ok]').click();
    assert.deepEqual(rec.labels(), [], 'no ring before a count');
    const a = coreIn(M, spec, 4),
      b = M.shapeList(spec).shapes.find(
        s => s.site === 'plaque-core' && s !== a && regionOf(s) !== 4 && M.structureAt(spec, s.x, s.y) === s
      ),
      rb = regionOf(b);
    // A double click (two clicks 80 ms apart) and a third quick click: one lesion, one count, ring 1.
    click(a);
    now += 80;
    click(a);
    now += 80;
    click(a);
    assert.equal(tally(), 'Plaque cores counted: 1');
    assert.equal(counts(), '0,0,0,0,1,0,0,0,0');
    assert.deepEqual(lines(), ['Region 5: 1 counted', 'Plaque core (drawn)', 'Click it again: take it off']);
    assert.deepEqual(rec.labels(), ['1']);
    assert.ok(rec.ringAt(a), 'a ring round the counted core');
    // Another lesion: ring 2.
    now += 1000;
    click(b);
    assert.equal(tally(), 'Plaque cores counted: 2');
    assert.deepEqual(rec.labels(), ['1', '2']);
    assert.ok(rec.ringAt(a) && rec.ringAt(b));
    // A click a moment later on the first takes it back: its ring goes, the other is now 1.
    now += 1000;
    click(a);
    assert.deepEqual(lines(), ['Region 5: 0 counted', 'Plaque core (drawn): taken off']);
    assert.equal(tally(), 'Plaque cores counted: 1');
    assert.deepEqual(rec.labels(), ['1']);
    assert.ok(!rec.ringAt(a) && rec.ringAt(b));
    // A quick double tap on a counted lesion takes it back once (never below zero, never back on).
    now += 1000;
    click(b, 'touch');
    now += 120;
    click(b, 'touch');
    assert.equal(tally(), 'Plaque cores counted: 0');
    assert.deepEqual(lines(), [`Region ${rb + 1}: 0 counted`, 'Plaque core (drawn): taken off']);
    assert.deepEqual(rec.labels(), []);
    // A tap counts again and its tag says Tap; with Show hints off the tag keeps only what happened.
    now += 1000;
    click(a, 'touch');
    assert.deepEqual(lines(), ['Region 5: 1 counted', 'Plaque core (drawn)', 'Tap it again: take it off']);
    w.CortexLab = { hintsOn: () => false };
    now += 1000;
    click(b);
    assert.deepEqual(lines(), [`Region ${rb + 1}: 1 counted`, 'Plaque core (drawn)']);
    delete w.CortexLab;
    assert.deepEqual(rec.labels(), ['1', '2']);
    // Each kind keeps its own rings: none for tangles; the cores' come back.
    const sel = app.querySelector('[data-labm-field="site"]');
    sel.value = 'tangle';
    sel.dispatchEvent(new w.Event('change', { bubbles: true }));
    assert.deepEqual(rec.labels(), []);
    assert.equal(tally(), 'Tangles counted: 0');
    sel.value = 'plaque-core';
    sel.dispatchEvent(new w.Event('change', { bubbles: true }));
    assert.deepEqual(rec.labels(), ['1', '2']);
    // Record: one count per lesion.
    const form = app.querySelector('[data-labm-tool-form="roi-lesion-count"]'),
      crit = form.querySelector('[data-labm-field="criterion"]');
    crit.value = 'one dark core, once';
    crit.dispatchEvent(new w.Event('input', { bubbles: true }));
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(taken.length, 1);
    assert.equal(taken[0].value, 2);
    assert.deepEqual(rec.labels(), [], 'the rings go with the tool');
    handle.destroy();
  } finally {
    close();
  }
});

test('FIX5-micro I1 (d5-7): a refused Record (no rule) brings the rule field, its refusal and Record into the band when they fit (Count lesions and Artifact area)', () => {
  for (const tool of ['roi-lesion-count', 'artifact-area']) {
    const { w, M, lab, app, close } = harness();
    try {
      const handle = mountOne(M, lab, app, { onMeasurement() {} });
      app.querySelector('[data-labm-measure-open]').click();
      app.querySelector(`[data-labm-tool="${tool}"]`).click();
      // The sheet beside the picture (nothing stuck over it): field 1150..1237, refusal ..1294, Record
      // 1600..1644; the band is 129..792 (121 px bar, 800 px window, 8 px in).
      const model = layoutModel(w, app, { submit: [1600, 1644] });
      app.querySelector('[data-labm-rule-ok]').click();
      model.y = 800; // field at 350, Record at 800..844: the refusal pushed Record under the window's edge
      model.calls.length = 0;
      const form = app.querySelector(`[data-labm-tool-form="${tool}"]`);
      form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
      assert.equal(w.document.activeElement.getAttribute('data-labm-field'), 'criterion', tool);
      assert.deepEqual(model.calls, [{ by: 844 - 792, behavior: 'instant' }], tool);
      assert.ok(1150 - model.y >= 129 && 1644 - model.y <= 792, `${tool}: field and Record in the band`);
      assert.match(form.querySelector('.labm-error').textContent, /^Write your rule/);
      handle.destroy();
    } finally {
      close();
    }
  }
});

test('FIX5-micro I6 (d5-8): Record is announced once (the status line; no other live region of the microscope speaks) and, with the report off, nothing in the microscope says "saved"', async () => {
  for (const report of [false, true]) {
    const { w, M, lab, app, close } = harness();
    try {
      w.CortexLab = { featureOn: name => (name === 'report' ? report : false) };
      const handle = mountOne(M, lab, app, { onMeasurement() {} }),
        spoken = [];
      const observer = new w.MutationObserver(records => {
        for (const r of records) {
          const node = r.target.nodeType === 1 ? r.target : r.target.parentElement,
            region = node && node.closest('[aria-live], [role="status"], [role="alert"]'),
            text = region ? region.textContent.trim() : '';
          if (text) spoken.push({ status: region.hasAttribute('data-labm-status'), text });
        }
      });
      for (const region of app.querySelectorAll('[aria-live], [role="status"], [role="alert"]'))
        observer.observe(region, { childList: true, characterData: true, subtree: true });
      key(w, app.querySelector('[role="application"]'), '1');
      app.querySelector('[data-labm-measure-open]').click();
      app.querySelector('[data-labm-tool="roi-lesion-count"]').click();
      app.querySelector('[data-labm-rule-ok]').click();
      await sleep(200);
      spoken.length = 0;
      const form = app.querySelector('[data-labm-tool-form="roi-lesion-count"]'),
        crit = form.querySelector('[data-labm-field="criterion"]');
      crit.value = 'drawn cores';
      crit.dispatchEvent(new w.Event('input', { bubbles: true }));
      form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
      await sleep(200);
      const said = [...new Map(spoken.map(s => [s.text, s])).values()];
      assert.equal(said.length, 1, JSON.stringify(said));
      assert.equal(said[0].status, true, 'the status line says it');
      if (!report) {
        assert.match(said[0].text, /^Recorded\. Count lesions = 0 \(count\) for run-1/);
        assert.doesNotMatch(app.textContent, /saved/i, 'nothing in the microscope says saved');
      } else assert.match(said[0].text, /^Recorded: .* Saved in this lab/);
      observer.disconnect();
      handle.destroy();
    } finally {
      close();
    }
  }
});

test('FIX5-micro I5 (p5-3): the chips and the count line sit inside the picture box (the shell keeps its floating Notes button off their words); while a picture tool is open under a stuck picture in the drawer layout the Measure sheet keeps a right gutter for that button', () => {
  const { M, lab, app, close } = harness();
  try {
    const handle = mountOne(M, lab, app, { onMeasurement() {} });
    app.querySelector('[data-labm-measure-open]').click();
    app.querySelector('[data-labm-tool="roi-lesion-count"]').click();
    app.querySelector('[data-labm-rule-ok]').click();
    const stage = app.querySelector('.labm-stage');
    for (const sel of ['[data-labm-hud]', '[data-labm-tally]', '[data-labm-tag]'])
      assert.equal(app.querySelector(sel).parentElement, stage, sel);
    handle.destroy();
  } finally {
    close();
  }
  const css = fs.readFileSync(path.join(ROOT, 'lab-microscope.css'), 'utf8');
  assert.match(
    css,
    /\n@media \(max-width: 899\.98px\) \{ @container labm \(max-width: 599px\) \{ main\.lab-notes-host:not\(\.lab-notes-open\) \.labm-picking \.labm-tools \{ padding-right: 86px; \} \} \}\n/
  );
});

// ---- MODE-micro (contract §11.6): tone, the drawn artifacts, the unstained caption, the look ----
// A recording 2D context: every method call and style write in order (jsdom has no canvas).
function recorder() {
  const log = [],
    state = {};
  const ctx = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === 'log') return log;
        if (prop in state) return state[prop];
        if (prop === 'measureText') return text => ({ width: String(text).length * 6 });
        return (...args) => {
          log.push({ op: prop, args, fillStyle: state.fillStyle, strokeStyle: state.strokeStyle });
          return undefined;
        };
      },
      set(_, prop, value) {
        state[prop] = value;
        return true;
      },
    }
  );
  return ctx;
}
const fakeCanvas = ctx => ({ getContext: () => ctx, width: 0, height: 0, clientWidth: 320, clientHeight: 240 });
// A copy with the given fields set (undefined removes one); `bare` strips the engine's own tone / look
// so the "absent" cases hold with and without the engine's §11 fields.
const withExtra = (outcome, extra) => JSON.parse(JSON.stringify({ ...outcome, ...extra }));
const bare = outcome => withExtra(outcome, { tone: undefined, look: undefined, artifacts: [] });
// A hex colour as jsdom reads it back from an inline style ("rgb(r, g, b)").
const cssColor = (w, hex) => {
  const n = w.document.createElement('i');
  n.style.background = hex;
  return n.style.background;
};

test('MODE-micro: a gold-toned outcome draws the gray-black family (both palettes), same five positions; missing tone keeps the silver family', () => {
  require('../lab-microscope.js');
  const M = globalThis.CortexLabMicroscope;
  const lum = hex => {
    const n = parseInt(hex.slice(1), 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  };
  for (const tints of [M.TINTS_GOLD, M.TINTS_GOLD_HC]) {
    assert.equal(tints.length, 5);
    assert.equal(tints[0].alpha, 0, 'visibility none draws nothing');
    assert.equal(tints[4].alpha, 1);
    for (let i = 1; i < 5; i++) {
      assert.ok(lum(tints[i].color) < lum(tints[i - 1].color), `gold tint ${i} is darker than ${i - 1}`);
      assert.ok(tints[i].alpha >= tints[i - 1].alpha);
      // A gray-black family: the three channels sit close together (no brown cast).
      const n = parseInt(tints[i].color.slice(1), 16),
        ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      assert.ok(Math.max(...ch) - Math.min(...ch) <= 14, `${tints[i].color} is gray`);
    }
    assert.ok(lum(tints[4].color) < 0.08, 'near-black at high');
  }
  // The silver family is brown (red channel above blue at the mid positions); the gold one is not.
  for (let v = 0; v <= 4; v++) {
    assert.equal(M.tintFor(v, false, 'gold'), M.TINTS_GOLD[v]);
    assert.equal(M.tintFor(v, true, 'gold'), M.TINTS_GOLD_HC[v]);
    assert.equal(M.tintFor(v, false, 'silver'), M.TINTS[v]);
    assert.equal(M.tintFor(v, false), M.TINTS[v], "no tone: today's family");
    assert.equal(M.tintFor(v, true), M.TINTS_HC[v]);
  }
  assert.equal(M.toneOf({ tone: 'gold' }), 'gold');
  assert.equal(M.toneOf({}), 'silver');
  assert.equal(M.toneOf(null), 'silver');
  assert.equal(M.toneOf({ tone: 'platinum' }), 'silver', "only the engine's gold value");
  // Painted: the deposit fills of a toned outcome use the gold colours, never the silver ones.
  const lab = S.createLab(content),
    spec = lab.getSpecimen('SPEC-SYN-AD-01'),
    run = fullRun(lab, 'run-tone', 'SPEC-SYN-AD-01'),
    plain = bare(lab.resolve(run)),
    toned = withExtra(plain, { tone: 'gold' });
  const paintWith = (outcome, highContrast) => {
    const ctx = recorder();
    M.renderSynthetic(fakeCanvas(ctx), { specimen: spec, outcome, highContrast, runId: run.id });
    return new Set(ctx.log.filter(e => e.op === 'fill').map(e => e.fillStyle));
  };
  const silverFills = paintWith(plain, false),
    goldFills = paintWith(toned, false),
    goldHcFills = paintWith(toned, true);
  const silver = M.TINTS.slice(1).map(t => t.color),
    gold = M.TINTS_GOLD.slice(1).map(t => t.color),
    goldHc = M.TINTS_GOLD_HC.slice(1).map(t => t.color);
  assert.ok(
    silver.some(c => silverFills.has(c)),
    'the plain picture fills with the silver family'
  );
  assert.ok(!gold.some(c => silverFills.has(c)), 'and never with the gold one');
  assert.ok(
    gold.some(c => goldFills.has(c)),
    'the toned picture fills with the gold family'
  );
  assert.ok(!silver.some(c => goldFills.has(c)), 'and never with the silver one');
  assert.ok(
    goldHc.some(c => goldHcFills.has(c)),
    'high contrast has a gold family too'
  );
  assert.ok(!M.TINTS_HC.slice(1).some(t => goldHcFills.has(t.color)));
});

test('MODE-micro: the patchy artifact is a seeded pale overlay (stable per run id) under the count rings; its tag reads "patchy (drawn)" only where no structure is; the caption names it', async () => {
  const { w, M, lab, app, close } = harness();
  try {
    const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      run = fullRun(lab, 'run-1', 'SPEC-SYN-AD-01'),
      plain = bare(lab.resolve(run)),
      patchy = withExtra(plain, { artifacts: ['patchy'] });
    // Stable per run id, different across ids, nothing random.
    const a = M.artifactList(M.hashSeed('run-1')),
      b = M.artifactList(M.hashSeed('run-1')),
      c = M.artifactList(M.hashSeed('run-2'));
    assert.equal(a, b, 'cached per seed');
    assert.equal(a.patches.length, 6);
    assert.notEqual(JSON.stringify(a.patches), JSON.stringify(c.patches), 'another run, other patches');
    assert.ok(a.patches.every(p => p.x > 0 && p.x < 1000 && p.y > 0 && p.y < 1000 && p.r > 0 && p.lobes.length === 11));
    assert.ok(Object.isFrozen(a.patches));
    assert.ok(M.hashSeed('') > 0 && M.hashSeed(undefined) > 0, 'a missing run id still seeds');
    // Painted after the deposits and before the count rings (paintMarks' rings / numbers).
    const ctx = recorder(),
      core = M.shapeList(spec).shapes.find(s => s.site === 'plaque-core');
    M.renderSynthetic(fakeCanvas(ctx), {
      specimen: spec,
      outcome: patchy,
      runId: 'run-1',
      overlay: { grid: 3, numbered: true, marks: [core] },
    });
    const fills = ctx.log.filter(e => e.op === 'fill'),
      firstDeposit = fills.findIndex(e => M.TINTS.slice(1).some(t => t.color === e.fillStyle)),
      paperFills = fills
        .map((e, i) =>
          /^#[0-9a-f]{6}$/.test(e.fillStyle) &&
          i > firstDeposit &&
          e.fillStyle !== '#1769d2' &&
          e.fillStyle !== '#ffffff' &&
          !M.TINTS.some(t => t.color === e.fillStyle)
            ? i
            : -1
        )
        .filter(i => i > firstDeposit),
      firstRingNumber = ctx.log.findIndex(e => e.op === 'fillText' && e.args[0] === '1');
    assert.ok(firstDeposit >= 0, 'deposits were painted');
    assert.ok(paperFills.length >= 12, `patch fills after the deposits (${paperFills.length})`);
    assert.ok(firstRingNumber > 0, 'the count ring number was painted');
    const lastPatchFillAt = ctx.log.indexOf(fills[paperFills[paperFills.length - 1]]);
    assert.ok(lastPatchFillAt < firstRingNumber, 'every patch is under the count rings');
    // The plain outcome paints no patches: no fill after the deposits that is not a tool colour.
    const ctx2 = recorder();
    M.renderSynthetic(fakeCanvas(ctx2), { specimen: spec, outcome: plain, runId: 'run-1' });
    const fills2 = ctx2.log.filter(e => e.op === 'fill'),
      firstDeposit2 = fills2.findIndex(e => M.TINTS.slice(1).some(t => t.color === e.fillStyle));
    assert.ok(
      fills2.slice(firstDeposit2).every(e => M.TINTS.some(t => t.color === e.fillStyle)),
      'no artifact fill'
    );
    // Identify: a structure under the pointer still wins; a patch with no structure says "patchy (drawn)".
    const handle = M.mount(app, {
        lab,
        specimen: spec,
        runs: [run],
        outcomes: [patchy],
        settings: { reducedMotion: 'on' },
      }),
      tag = () => app.querySelector('[data-labm-tag]'),
      canvas = () => app.querySelector('canvas');
    key(w, app.querySelector('[role="application"]'), '1');
    const visibleCore = M.shapeList(spec).shapes.find(
      s => s.site === 'plaque-core' && M.structureAt(spec, s.x, s.y) === s
    );
    pointer(w, canvas(), 'pointermove', clientAt(handle, visibleCore.x, visibleCore.y));
    assert.ok(
      tag().querySelector('.labm-tag-main').textContent.startsWith('Plaque core (drawn)'),
      'the structure wins'
    );
    // A point on a patch and on no drawn structure.
    let on = null;
    for (const p of a.patches) {
      for (let k = 0; k < 40 && !on; k++) {
        const ang = (k / 40) * Math.PI * 2,
          x = p.x + Math.cos(ang) * p.r * 0.3,
          y = p.y + Math.sin(ang) * p.r * 0.3;
        if (
          M.artifactAt(M.hashSeed('run-1'), ['patchy'], x, y, 0) === 'patchy' &&
          !M.structureAt(spec, x, y, { tolerance: 20 })
        )
          on = { x, y };
      }
      if (on) break;
    }
    assert.ok(on, 'a patch point free of structures');
    pointer(w, canvas(), 'pointermove', clientAt(handle, on.x, on.y));
    assert.equal(tag().hidden, false);
    assert.equal(tag().querySelector('.labm-tag-main').textContent, 'patchy (drawn)');
    assert.equal(tag().querySelector('.labm-tag-line').textContent, SIM);
    // The caption under the picture names it; the plain outcome has no such line.
    const cap = app.querySelector('.labm-below [data-labm-artifacts]');
    assert.ok(cap && cap.textContent.includes('patchy (drawn)'), cap && cap.textContent);
    assert.equal(app.querySelector('[data-labm-unstained]'), null);
    assert.ok(
      app.querySelector('[data-labm-text-alt]').textContent.includes('Drawn on the section: patchy (drawn).'),
      "the text alternative names it in the caption's words"
    );
    handle.update({ runs: [run], outcomes: [plain] });
    assert.equal(app.querySelector('[data-labm-artifacts]'), null);
    // The artifact-area tool still opens and takes outline points on a patchy picture.
    handle.update({ runs: [run], outcomes: [patchy] });
    app.querySelector('[data-labm-measure-open]').click();
    app.querySelector('[data-labm-tool="artifact-area"]').click();
    app.querySelector('[data-labm-rule-ok]').click();
    assert.equal(hints(app)[0], 'Click: add an outline point');
    pointer(w, canvas(), 'pointerdown', clientAt(handle, on.x, on.y));
    pointer(w, canvas(), 'pointerup', clientAt(handle, on.x, on.y));
    assert.equal(handle.state().tool, 'artifact-area');
    handle.destroy();
  } finally {
    close();
  }
});

test('MODE-micro: the grains artifact scatters seeded black specks with a sheen under the count rings; its tag reads "black grains (drawn)"; both artifacts caption together', () => {
  const { w, M, lab, app, close } = harness();
  try {
    const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      run = fullRun(lab, 'run-1', 'SPEC-SYN-AD-01'),
      plain = bare(lab.resolve(run)),
      grainy = withExtra(plain, { artifacts: ['grains', 'patchy', 'protocol-deviation'] });
    const list = M.artifactList(M.hashSeed('run-1'));
    assert.equal(list.grains.length, 160);
    assert.ok(list.grains.every(g => g.s >= 1.6 && g.s <= 3.4));
    const ctx = recorder(),
      core = M.shapeList(spec).shapes.find(s => s.site === 'plaque-core');
    M.renderSynthetic(fakeCanvas(ctx), {
      specimen: spec,
      outcome: grainy,
      runId: 'run-1',
      overlay: { grid: 3, numbered: true, marks: [core] },
    });
    const black = ctx.log.filter(e => e.op === 'fill' && e.fillStyle === '#101010'),
      sheen = ctx.log.filter(e => e.op === 'fill' && e.fillStyle === '#ffffff'),
      ringNumber = ctx.log.findIndex(e => e.op === 'fillText' && e.args[0] === '1');
    assert.equal(black.length, 160, 'one black speck per grain');
    assert.ok(sheen.length >= 160, 'each with a sheen dot');
    assert.ok(ctx.log.indexOf(black[black.length - 1]) < ringNumber, 'grains under the count rings');
    // In the layers view with the deposit layer off the artifacts are not drawn.
    const ctx3 = recorder();
    M.renderSynthetic(fakeCanvas(ctx3), {
      specimen: spec,
      outcome: grainy,
      runId: 'run-1',
      layers: { lesions: true, ionic: false, nuclei: false, deposit: false, background: true },
    });
    assert.equal(ctx3.log.filter(e => e.op === 'fill' && e.fillStyle === '#101010').length, 0);
    // High contrast: pure black specks.
    const ctx4 = recorder();
    M.renderSynthetic(fakeCanvas(ctx4), { specimen: spec, outcome: grainy, runId: 'run-1', highContrast: true });
    assert.equal(ctx4.log.filter(e => e.op === 'fill' && e.fillStyle === '#000000').length, 160);
    // Identify on a grain free of structures; unknown artifact ids are ignored.
    const handle = M.mount(app, {
        lab,
        specimen: spec,
        runs: [run],
        outcomes: [grainy],
        settings: { reducedMotion: 'on' },
      }),
      tag = () => app.querySelector('[data-labm-tag]'),
      canvas = () => app.querySelector('canvas');
    key(w, app.querySelector('[role="application"]'), '1');
    const grain = list.grains.find(
      g =>
        !M.structureAt(spec, g.x, g.y, { tolerance: 20 }) &&
        M.artifactAt(M.hashSeed('run-1'), ['patchy'], g.x, g.y, 0) !== 'patchy'
    );
    assert.ok(grain, 'a grain on bare paper');
    pointer(w, canvas(), 'pointermove', clientAt(handle, grain.x, grain.y));
    assert.equal(tag().querySelector('.labm-tag-main').textContent, 'black grains (drawn)');
    assert.equal(M.artifactAt(M.hashSeed('run-1'), ['grains'], grain.x, grain.y, 0), 'grains');
    assert.equal(M.artifactAt(M.hashSeed('run-1'), [], grain.x, grain.y, 0), null, 'no artifact: no tag');
    assert.equal(M.artifactAt(M.hashSeed('run-1'), ['protocol-deviation'], grain.x, grain.y, 0), null);
    const cap = app.querySelector('.labm-below [data-labm-artifacts]');
    assert.equal(cap.textContent, 'Also drawn on the section: patchy (drawn) · black grains (drawn).');
    assert.doesNotMatch(cap.textContent, /protocol-deviation/);
    assert.doesNotMatch(app.textContent, /pending|instructor/i);
    handle.destroy();
  } finally {
    close();
  }
});

test('MODE-micro: an outcome with every visibility 0 and background 0 captions "Unstained: …(a drawing)." under the picture and in the description; one with any silver does not', () => {
  const { M, lab, app, close } = harness();
  try {
    const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      run = fullRun(lab, 'run-1', 'SPEC-SYN-AD-01'),
      plain = bare(lab.resolve(run)),
      blank = JSON.parse(JSON.stringify(plain));
    for (const site of Object.keys(blank.perSite)) blank.perSite[site].visibility = 0;
    blank.background = 0;
    blank.contrast = 0;
    assert.equal(M.isUnstained(blank), true);
    assert.equal(M.isUnstained(plain), false);
    assert.equal(M.isUnstained({ ...blank, background: 1 }), false, 'background silver is silver');
    assert.equal(M.isUnstained({ ...blank, label: 'no-basis' }), false, 'a card is not a drawing');
    const handle = M.mount(app, {
      lab,
      specimen: spec,
      runs: [run],
      outcomes: [blank],
      settings: { reducedMotion: 'on' },
    });
    const line = app.querySelector('.labm-below [data-labm-unstained]');
    assert.ok(line, 'the unstained caption');
    assert.equal(line.textContent, 'Unstained: no silver was reduced on this section (a drawing).');
    assert.ok(app.querySelector('[data-labm-caption]'), 'the shading note still prints (it is a drawn picture)');
    // The text alternative stands in for the picture, so it says the same (MODE-FIX-micro-1).
    assert.ok(M.describe(blank, spec, lab).includes('Unstained: no silver was reduced on this section (a drawing).'));
    assert.ok(!M.describe(plain, spec, lab).includes('Unstained: no silver'));
    handle.update({ runs: [run], outcomes: [plain] });
    assert.equal(app.querySelector('[data-labm-unstained]'), null);
    handle.destroy();
  } finally {
    close();
  }
});

test('MODE-micro: outcome.look.text prints under the picture ("By eye: …") with the engine\'s LOOK_COLORS swatch when it exists; a gold outcome adds the "Gold toned (drawn)" line; both absent today', () => {
  const { w, M, lab, app, close } = harness();
  try {
    const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      run = fullRun(lab, 'run-1', 'SPEC-SYN-AD-01'),
      plain = bare(lab.resolve(run)),
      looked = withExtra(plain, {
        tone: 'gold',
        look: { key: 'gray-black', text: 'Gray-black detail on a light background: the gold-toned stain.' },
      });
    let handle = M.mount(app, {
      lab,
      specimen: spec,
      runs: [run],
      outcomes: [plain],
      settings: { reducedMotion: 'on' },
    });
    assert.equal(app.querySelector('[data-labm-look]'), null, 'no look without the field');
    assert.equal(app.querySelector('[data-labm-tone]'), null, 'no tone without the field');
    handle.update({ runs: [run], outcomes: [looked] });
    const look = app.querySelector('.labm-below [data-labm-look]');
    assert.ok(look);
    assert.equal(look.getAttribute('data-labm-look'), 'gray-black');
    assert.equal(look.textContent, 'By eye: Gray-black detail on a light background: the gold-toned stain.');
    // The swatch follows the engine's LOOK_COLORS: none without the export, its colour with it.
    const engineColors = w.SilverLab.LOOK_COLORS;
    if (engineColors && engineColors['gray-black'])
      assert.equal(look.querySelector('.labm-look-swatch').style.background, cssColor(w, engineColors['gray-black']));
    else assert.equal(look.querySelector('.labm-look-swatch'), null, 'no swatch without SilverLab.LOOK_COLORS');
    const tone = app.querySelector('.labm-below [data-labm-tone]');
    assert.ok(tone && tone.textContent.startsWith('Gold toned (drawn)'), tone && tone.textContent);
    // The swatch appears once the engine exports LOOK_COLORS (guarded read: the colour, aria-hidden).
    const saved = w.SilverLab.LOOK_COLORS;
    w.SilverLab.LOOK_COLORS = { 'gray-black': '#5f6368' };
    handle.update({ runs: [run], outcomes: [looked] });
    const swatch = app.querySelector('[data-labm-look] .labm-look-swatch');
    assert.ok(swatch, 'swatch with LOOK_COLORS');
    assert.equal(swatch.getAttribute('aria-hidden'), 'true');
    assert.equal(swatch.style.background, 'rgb(95, 99, 104)');
    if (saved === undefined) delete w.SilverLab.LOOK_COLORS;
    else w.SilverLab.LOOK_COLORS = saved;
    // A look with no text prints nothing; a look sits in the plain part, not the engine words.
    handle.update({ runs: [run], outcomes: [withExtra(plain, { look: { key: 'tan-brown' } })] });
    assert.equal(app.querySelector('[data-labm-look]'), null);
    // Compare: each side's lines carry the side name.
    handle.destroy();
    const run2 = fullRun(lab, 'run-2', 'SPEC-SYN-AD-01');
    handle = M.mount(app, {
      lab,
      specimen: spec,
      runs: [run, run2],
      outcomes: [plain, looked],
      settings: { reducedMotion: 'on' },
    });
    const tones = [...app.querySelectorAll('[data-labm-tone]')];
    assert.equal(tones.length, 1);
    assert.equal(tones[0].getAttribute('data-labm-tone'), '1');
    assert.ok(tones[0].textContent.startsWith('Experimental: Gold toned (drawn)'), tones[0].textContent);
    assert.doesNotMatch(app.textContent, /pending|instructor/i);
    handle.destroy();
  } finally {
    close();
  }
});

test('MODE-micro: nothing in the module says pending or instructor; the badge kinds are simulated, not-modeled, in-progress, observed (REF-micro: reference-none is gone); the CSS has no pending badge rule', () => {
  assert.doesNotMatch(MICRO_SRC, /pending|instructor|reference-none|referenceNone/i);
  assert.doesNotMatch(
    fs.readFileSync(path.join(ROOT, 'lab-microscope.css'), 'utf8'),
    /pending|instructor|reference-none/i
  );
  const { M, lab, app, close } = harness();
  try {
    const handle = mountOne(M, lab, app);
    const kinds = new Set([...app.querySelectorAll('[data-lab-badge]')].map(n => n.getAttribute('data-lab-badge')));
    assert.deepEqual([...kinds].sort(), ['simulated']);
    assert.doesNotMatch(app.textContent, /pending|instructor/i);
    handle.destroy();
  } finally {
    close();
  }
});

test('MODE-integrate: a run whose slide went through thiosulfate (outcome.slide.fixed) says under the layers table why Bound silver reads none; an outcome without the flag prints no such line', () => {
  const { M, lab, app, close } = harness();
  try {
    const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      run = fullRun(lab, 'run-1', 'SPEC-SYN-AD-01'),
      out = lab.resolve(run);
    if (!(out.slide && out.slide.fixed === true)) return; // an engine without §11.5 slides: nothing to pin
    const handle = M.mount(app, {
      lab,
      specimen: spec,
      runs: [run],
      outcomes: [out],
      settings: { reducedMotion: 'on' },
    });
    const note = app.querySelector('[data-labm-fixed="0"]');
    assert.ok(note, 'the note under the table');
    assert.equal(
      note.textContent,
      'Bound silver is at none here: the thiosulfate step removed the unreduced silver; the visible silver is what was reduced before it (course procedure).'
    );
    assert.ok(note.closest('.labm-table-wrap'), 'inside the layers table block');
    const bare = JSON.parse(JSON.stringify(out));
    delete bare.slide;
    handle.update({ runs: [run], outcomes: [bare] });
    assert.equal(app.querySelector('[data-labm-fixed]'), null, 'no flag, no line');
    handle.destroy();
  } finally {
    close();
  }
});

// ---- MODE-FIX-micro (2026-10-13): the review round's microscope fixes --------------------------
const FREE_STEPS = [
  'deparaffinize-rehydrate',
  'silver-impregnation',
  'water-wash',
  'ammoniacal-silver',
  'ammonium-hydroxide-wash',
  'development',
];
const freeRun = (lab, id, steps, params) =>
  perform(lab, lab.createRun({ id, specimenId: 'SPEC-SYN-AD-01', mode: 'free', params }), steps);
const lum = hex => {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};

test("MODE-FIX-micro-1: the visible text alternative of a free run uses the captions' words (drawn artifacts, by-eye look, Keep in mind) and no engine vocabulary, with or without the shell", async () => {
  const { w, M, lab, app, close } = harness();
  try {
    // A silver bath while the wax is on (the wax-cap rule and its caveat, patchy) and a cloudy
    // ammoniacal bath (black grains), then the rest of the procedure to the developer.
    const run = freeRun(lab, 'free-1', ['silver-impregnation', ...FREE_STEPS], { ammoniacal: { ammonia: 'cloudy' } }),
      outcome = lab.resolve(run);
    assert.deepEqual([...outcome.artifacts].sort(), ['grains', 'patchy']);
    assert.ok(
      outcome.caveats.some(c => /schematic device/.test(c)),
      'the wax-cap caveat is raw engine text'
    );
    const handle = mountOne(M, lab, app, { runs: [run], outcomes: [outcome] });
    const textAlt = () => app.querySelector('[data-labm-numbers] [data-labm-text-alt]').textContent;
    assert.doesNotMatch(textAlt(), /schematic|ordinal|\bSOP\b|sop-default|registry|Artifacts:|Conditional on/);
    assert.ok(textAlt().startsWith(S.LABEL_TEXT[S.LABELS.SYNTHETIC]));
    assert.ok(textAlt().includes('Drawn on the section: patchy (drawn), black grains (drawn).'));
    assert.ok(textAlt().includes(`By eye: ${outcome.look.text}`));
    assert.ok(textAlt().includes('Keep in mind: '));
    assert.ok(textAlt().includes('The cap on binding under wax is a device of the model;'), 'the private pair');
    assert.ok(textAlt().includes("Shorter, standard and longer are ordered places on the model's scale, not times."));
    assert.ok(textAlt().endsWith('Objective: 10x (approximate). View: simulated picture.'));
    // The visible caption and the text alternative agree on the artifacts and the look.
    assert.ok(app.querySelector('[data-labm-artifacts]').textContent.includes('patchy (drawn) · black grains (drawn)'));
    assert.ok(app.querySelector('[data-labm-look]').textContent.includes(outcome.look.text));
    handle.destroy();
    // With lab.js loaded the shell's summarize and plainCaveat give the words.
    w.CortexLab = {
      summarize: () => 'Shell summary words.',
      plainCaveat: t =>
        t.replace(
          /^Endpoint positions early \/ sop-default \/ extended are ordered schematic positions\./,
          'SHELL first sentence.'
        ),
    };
    const handle2 = mountOne(M, lab, app, { runs: [run], outcomes: [outcome] });
    assert.ok(textAlt().includes('Shell summary words.'));
    assert.ok(
      textAlt().includes("SHELL first sentence. No one knows where the course's real times fall"),
      'shell first, private pairs after'
    );
    assert.doesNotMatch(textAlt(), /schematic|ordinal|\bSOP\b|sop-default|registry/);
    handle2.destroy();
  } finally {
    delete w.CortexLab;
    close();
  }
});

test('MODE-FIX-micro-2: the field is painted on the five-shade scale, so a dark-brown look puts the field within one shade step of the darkest structure and a black-on-tan look keeps more than one', () => {
  require('../lab-microscope.js');
  const M = globalThis.CortexLabMicroscope;
  const lab = S.createLab(content);
  const papers = [0, 1, 2, 3, 4].map(k => M.paperFor(k, false)),
    steps = papers.slice(1).map((p, i) => lum(papers[i]) - lum(p)),
    oneStep = Math.max(...steps);
  assert.equal(papers[0], '#f8f2e7', 'no background silver: the paper itself');
  assert.ok(
    steps.every(d => d > 0.15),
    `every background step is a visible step (${steps.map(d => d.toFixed(2))})`
  );
  assert.equal(M.paperFor(4, false), M.TINTS[4].color, 'background high is the darkest shade');
  assert.equal(M.paperFor(3, true), '#ffffff', 'high contrast keeps a white field');
  const gap = out => {
    const field = M.paperFor(out.background, false),
      darkest = Math.max(...Object.values(out.perSite).map(e => e.visibility));
    return lum(field) - M.compositeLuminance(M.TINTS[darkest], field);
  };
  // Three developments on a free run: background 3 under structures at 4 (the engine's dark-brown).
  const dark = lab.resolve(freeRun(lab, 'dark', [...FREE_STEPS, 'development', 'development']));
  assert.equal(dark.look.key, 'dark-brown');
  assert.equal(dark.background, 3);
  assert.ok(
    gap(dark) <= oneStep + 1e-9,
    `dark-brown: field within one shade step of the darkest structure (${gap(dark).toFixed(3)} vs ${oneStep.toFixed(3)})`
  );
  // Longer and stronger development twice: background catches the deposit and the two merge.
  const merged = lab.resolve(
    freeRun(lab, 'merged', [...FREE_STEPS, 'development'], {
      development: { endpoint: 'extended', strength: 'strong' },
    })
  );
  assert.equal(merged.look.key, 'dark-brown');
  assert.ok(merged.background >= Math.max(...Object.values(merged.perSite).map(e => e.visibility)));
  assert.ok(
    gap(merged) < 0.02,
    `background at the darkest structure: no contrast in the picture (${gap(merged).toFixed(3)})`
  );
  // The correct endpoint keeps its contrast: black detail on a tan field, more than one step apart.
  const ok = lab.resolve(freeRun(lab, 'ok', FREE_STEPS));
  assert.equal(ok.look.key, 'black-on-tan');
  assert.ok(gap(ok) > oneStep, `black-on-tan keeps contrast (${gap(ok).toFixed(3)})`);
  // The gold family paints its own field shades.
  assert.notEqual(M.paperFor(1, false, 'gold'), M.paperFor(1, false, 'silver'));
  assert.equal(M.paperFor(0, false, 'gold'), '#f8f2e7');
});

test('MODE-FIX-micro-4: every patchy region gets a dashed boundary stroke (legible on an unstained cream section too); a plain picture strokes no dashes', () => {
  require('../lab-microscope.js');
  const M = globalThis.CortexLabMicroscope;
  const lab = S.createLab(content),
    spec = lab.getSpecimen('SPEC-SYN-AD-01');
  // A silver bath with the wax on and nothing else: background 0 (the paper itself) and patchy.
  const waxOn = lab.resolve(freeRun(lab, 'wax', ['silver-impregnation']));
  assert.ok(waxOn.artifacts.includes('patchy'));
  assert.equal(waxOn.background, 0);
  assert.equal(waxOn.look.key, 'patchy');
  const dashes = ctx => {
    const log = ctx.log,
      on = log.map((e, i) => (e.op === 'setLineDash' && e.args[0].length ? i : -1)).filter(i => i >= 0);
    return on.map(i => ({
      next: log.slice(i + 1).find(e => e.op === 'stroke' || e.op === 'setLineDash'),
      strokeStyle: log[i].strokeStyle,
    }));
  };
  const ctx = recorder();
  M.renderSynthetic(fakeCanvas(ctx), { specimen: spec, outcome: waxOn, runId: 'run-1' });
  const d = dashes(ctx);
  assert.equal(d.length, M.artifactList(M.hashSeed('run-1')).patches.length, 'one dashed outline per patch');
  assert.ok(
    d.every(x => x.next && x.next.op === 'stroke'),
    'each dash setting is followed by its stroke'
  );
  const strokes = ctx.log.filter(e => e.op === 'stroke').slice(-d.length);
  assert.ok(
    strokes.every(
      e => /^#[0-9a-f]{6}$/.test(e.strokeStyle) && e.strokeStyle !== '#f8f2e7' && e.strokeStyle !== '#ffffff'
    ),
    'a tinted edge, not the paper'
  );
  assert.ok(lum(strokes[0].strokeStyle) < lum('#f8f2e7') - 0.05, 'darker than the cream paper');
  // High contrast: a black dashed edge.
  const hc = recorder();
  M.renderSynthetic(fakeCanvas(hc), { specimen: spec, outcome: waxOn, runId: 'run-1', highContrast: true });
  assert.ok(
    hc.log
      .filter(e => e.op === 'stroke')
      .slice(-d.length)
      .every(e => e.strokeStyle === '#000000')
  );
  // No artifact: no dashed stroke at all in the plain picture (the lesion outlines are off by default).
  const plain = recorder();
  M.renderSynthetic(plain, { specimen: spec, outcome: withExtra(waxOn, { artifacts: [] }), runId: 'run-1' });
  M.renderSynthetic(fakeCanvas(plain), {
    specimen: spec,
    outcome: withExtra(waxOn, { artifacts: [] }),
    runId: 'run-1',
  });
  assert.equal(dashes(plain).length, 0);
});

// ---- REF-micro (contract §12): real reference slides in the microscope ----
const REF = {
  positive: [
    'A-ref-ikonomovic-2020-fig4d',
    'A-ref-ikonomovic-2020-fig4h',
    'A-ref-marengo-2022-fig1-ad',
    'A-ref-zhang-2025-fig1b',
    'A-ref-zhang-2025-fig1b-detail',
    'A-ref-liu-2022-fig4b-np',
    'A-ref-liu-2022-fig4c-np',
    'A-ref-zhang-2025-fig1c',
    'A-ref-zhang-2025-fig1c-detail',
  ],
  negative: ['A-ref-marengo-2022-fig1-control', 'A-ref-liu-2022-fig4a-np'],
};
const IKONOMOVIC_CREDIT = 'Ikonomovic et al., Acta Neuropathol 2020, Fig. 4, panel d (cropped) · CC BY 4.0';
const mountReal = (M, lab, app, extra = {}) => mountOne(M, lab, app, { onMeasurement() {}, ...extra });
const photoOf = app => app.querySelector('.labm-stage [data-labm-photo]');
function photoPointer(w, box, type, clientX, clientY, extra = {}) {
  box.dispatchEvent(
    new w.PointerEvent(type, { pointerId: 7, pointerType: 'mouse', bubbles: true, clientX, clientY, ...extra })
  );
}
function openCount(app) {
  app.querySelector('[data-labm-measure-open]').click();
  app.querySelector('[data-labm-tool="roi-lesion-count"]').click();
  app.querySelector('[data-labm-rule-ok]').click();
}

test('REF-micro-1: referenceSlides is pure (no DOM) and follows the §12.2 table: every look × role, a card, a compare-only run, no specimen, an unknown role, grains; positive cortex → hippocampus order, negative likewise', () => {
  require('../lab-microscope.js');
  const M = globalThis.CortexLabMicroscope,
    lab = S.createLab(content),
    withLook = (out, key) => ({ ...out, look: { key, text: S.LOOKS[key].text } }),
    ids = list => list.map(a => a.id);
  assert.equal(typeof M.referenceSlides, 'function');
  assert.ok(Object.isFrozen(lab.content.assets.items), 'the engine freezes the library');
  const expected = {
    'SPEC-SYN-AD-01': { 'black-on-tan': REF.positive, 'gray-black': REF.positive },
    'SPEC-SYN-AD-02': { 'black-on-tan': REF.positive, 'gray-black': REF.positive },
    'SPEC-SYN-LOWCHEM-01': { 'black-on-tan': REF.positive, 'gray-black': REF.positive },
    'SPEC-SYN-NEG-01': { 'black-on-tan': REF.negative, 'gray-black': REF.negative, 'light-detail': REF.negative },
  };
  for (const specimenId of Object.keys(expected)) {
    const spec = lab.getSpecimen(specimenId),
      out = lab.resolve(fullRun(lab, 'r', specimenId));
    assert.equal(out.label, 'illustrative-synthetic');
    for (const key of S.LOOK_KEYS)
      assert.deepEqual(
        ids(M.referenceSlides(lab, withLook(out, key), spec)),
        expected[specimenId][key] || [],
        `${specimenId} × ${key}`
      );
  }
  // The shipped finished run (gray-black) and the role rule, not the asset's specimenId, decide.
  const ad2 = lab.getSpecimen('SPEC-SYN-AD-02'),
    outAd2 = lab.resolve(fullRun(lab, 'r2', 'SPEC-SYN-AD-02'));
  assert.deepEqual(ids(M.referenceSlides(lab, outAd2, ad2)), REF.positive);
  assert.ok(M.referenceSlides(lab, outAd2, ad2).every(a => a.specimenId === 'SPEC-SYN-AD-01'));
  // Nothing: a card, a run in progress, a compare-only run (no look), no specimen, an unknown role, grains.
  const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
    out = lab.resolve(fullRun(lab, 'r', 'SPEC-SYN-AD-01'));
  assert.deepEqual(
    M.referenceSlides(
      lab,
      lab.resolve(fullRun(lab, 'c', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } })),
      spec
    ),
    []
  );
  assert.deepEqual(
    M.referenceSlides(lab, lab.resolve(lab.createRun({ id: 'p', specimenId: 'SPEC-SYN-AD-01' })), spec),
    []
  );
  const cps = lab.resolve(lab.createRun({ id: 'x', specimenId: 'SPEC-SYN-AD-01', method: 'cps-i' }));
  assert.equal(cps.look, null, 'a compare-only run has no look');
  assert.deepEqual(M.referenceSlides(lab, cps, spec), []);
  assert.deepEqual(M.referenceSlides(lab, out, null), []);
  assert.deepEqual(M.referenceSlides(lab, out, { ...spec, role: 'something-else' }), []);
  assert.deepEqual(M.referenceSlides(lab, { ...out, artifacts: ['grains'] }, spec), []);
  assert.deepEqual(
    ids(M.referenceSlides(lab, { ...out, artifacts: ['patchy'] }, spec)),
    REF.positive,
    'patchy is a look, not this filter'
  );
  assert.deepEqual(M.referenceSlides(null, out, spec), []);
  assert.deepEqual(M.referenceSlides(lab, null, spec), []);
  // Unknown rights or a missing src never show; 'other' roles sort after every positive.
  const fake = {
    content: {
      assets: {
        items: [
          {
            id: 'o',
            kind: 'reference-image',
            label: 'observed-reference',
            role: 'other',
            region: 'frontal cortex',
            looks: ['gray-black'],
            src: '/o.jpg',
            rights: { status: 'cc-by' },
          },
          {
            id: 'h',
            kind: 'reference-image',
            label: 'observed-reference',
            role: 'positive',
            region: 'hippocampus',
            looks: ['gray-black'],
            src: '/h.jpg',
            rights: { status: 'cc-by' },
          },
          {
            id: 'u',
            kind: 'reference-image',
            label: 'observed-reference',
            role: 'positive',
            region: 'frontal cortex',
            looks: ['gray-black'],
            src: '/u.jpg',
            rights: { status: 'unknown' },
          },
          {
            id: 'n',
            kind: 'reference-image',
            label: 'observed-reference',
            role: 'positive',
            region: 'frontal cortex',
            looks: ['gray-black'],
            rights: { status: 'cc-by' },
          },
          {
            id: 'c',
            kind: 'reference-image',
            label: 'observed-reference',
            role: 'positive',
            region: 'middle temporal gyrus',
            looks: ['gray-black'],
            src: '/c.jpg',
            rights: { status: 'cc-by' },
          },
          {
            id: 'x',
            kind: 'reference-image',
            label: 'observed-reference',
            role: 'positive',
            region: 'thalamus',
            looks: ['gray-black'],
            src: '/x.jpg',
            rights: { status: 'cc-by' },
          },
        ],
      },
    },
  };
  assert.deepEqual(ids(M.referenceSlides(fake, out, spec)), ['c', 'h', 'x', 'o']);
});

test('REF-micro-2: the credit builders: parseCitation on the four sources, licenseName, creditFor text and the two urls', () => {
  require('../lab-microscope.js');
  const M = globalThis.CortexLabMicroscope,
    lab = S.createLab(content);
  assert.deepEqual(M.parseCitation(lab.getSource('S-ikonomovic-2020').citation), {
    author: 'Ikonomovic',
    journal: 'Acta Neuropathol',
    year: '2020',
  });
  assert.deepEqual(M.parseCitation(lab.getSource('S-liu-2022').citation), {
    author: 'Liu',
    journal: 'Neurosci Bull',
    year: '2022',
  });
  assert.deepEqual(M.parseCitation(lab.getSource('S-marengo-2022').citation), {
    author: 'Marengo',
    journal: 'Cell Mol Life Sci',
    year: '2022',
  });
  assert.deepEqual(M.parseCitation(lab.getSource('S-zhang-2025').citation), {
    author: 'Zhang',
    journal: 'Aging Dis',
    year: '2025',
  });
  assert.deepEqual(M.parseCitation(''), { author: '', journal: '', year: '' });
  assert.equal(M.licenseName('cc-by-4.0'), 'CC BY 4.0');
  assert.equal(M.licenseName('cc-by'), 'CC BY');
  assert.equal(M.licenseName('cc-by-3.0'), 'CC BY 3.0');
  assert.equal(M.licenseName('public-domain'), 'public-domain');
  const byId = id => lab.content.assets.items.find(a => a.id === id),
    c = M.creditFor(lab, byId('A-ref-ikonomovic-2020-fig4d'));
  assert.equal(c.text, IKONOMOVIC_CREDIT);
  assert.equal(c.head, 'Ikonomovic et al., Acta Neuropathol 2020');
  assert.equal(c.articleUrl, 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7498488/');
  assert.equal(c.licenseUrl, 'https://creativecommons.org/licenses/by/4.0/');
  assert.equal(
    M.creditText(lab, byId('A-ref-zhang-2025-fig1b')),
    'Zhang et al., Aging Dis 2025, Fig. 1, panel B (low magnification) (cropped) · CC BY'
  );
  assert.equal(
    M.creditText(lab, byId('A-ref-liu-2022-fig4a-np')),
    'Liu et al., Neurosci Bull 2022, Fig. 4, panel A (neuritic plaque column) (cropped) · CC BY 4.0'
  );
  // Every shipped asset credits with an author, a journal, a year, its figure and a license.
  for (const a of lab.content.assets.items) {
    const credit = M.creditFor(lab, a);
    assert.match(credit.text, /^[A-Z][a-z]+ et al\., [A-Za-z ]+ \d{4}, Fig\. .+ \(cropped\) · CC BY/, credit.text);
    assert.ok(
      credit.articleUrl.startsWith('https://pmc.ncbi.nlm.nih.gov/') &&
        credit.licenseUrl.startsWith('https://creativecommons.org/'),
      a.id
    );
  }
  // A missing source still gives the figure and the license, never throws.
  assert.equal(
    M.creditText(
      { getSource: () => undefined },
      { sourceId: 'S-x', figure: 'Fig. 2', rights: { status: 'cc-by', changes: 'cropped' } }
    ),
    'S-x, Fig. 2 (cropped) · CC BY'
  );
});

test('REF-micro-3: a finished run on specimen A opens on the Real slide: the switch (role=group "Picture"), the figure with img, badge "Real slide · observed reference", the credit with both links, the facts, the honesty lines; no canvas, no identify tag, nothing over the photo', async () => {
  const { w, M, lab, app, close } = harness({ library: true });
  try {
    const handle = mountReal(M, lab, app),
      rootEl = app.querySelector('.labm');
    assert.equal(handle.state().view, 'real');
    assert.equal(handle.state().slides, 9);
    assert.equal(rootEl.getAttribute('data-labm-picture'), 'real');
    const group = app.querySelector('.labm-toolbar .labm-view[role="group"][aria-label="Picture"]');
    assert.ok(group && !group.hidden, 'the Picture switch sits in the top bar');
    assert.ok(group.querySelector('.labm-seg'), 'a segmented control');
    assert.deepEqual(
      [...group.querySelectorAll('[data-labm-view]')].map(b => [
        b.getAttribute('data-labm-view'),
        b.textContent,
        b.getAttribute('aria-pressed'),
      ]),
      [
        ['real', 'Real slide', 'true'],
        ['drawing', 'Drawing (simulation)', 'false'],
      ]
    );
    assert.equal(app.querySelectorAll('canvas').length, 0, 'no drawing while the photo shows');
    const stage = app.querySelector('[role="application"]');
    assert.ok(
      stage.getAttribute('aria-label').startsWith('Microscope viewer for run-1, real slide (observed reference).')
    );
    const fig = stage.querySelector('figure.labm-observed[data-lab-label="observed-reference"]');
    assert.ok(fig, 'the figure is the main picture, inside the viewer');
    const img = fig.querySelector('[data-labm-photo] img[data-labm-photo-img]');
    assert.equal(img.getAttribute('src'), '/assets/lab/reference/ikonomovic-2020-fig4d.jpg?v=1');
    assert.equal(
      img.getAttribute('alt'),
      "Real slide: Bielschowsky silver stain of Alzheimer's disease frontal cortex; the arrows mark neuritic plaques."
    );
    assert.equal(img.getAttribute('width'), '499');
    assert.equal(img.getAttribute('height'), '375');
    assert.match(photoOf(app).getAttribute('style'), /aspect-ratio: 499 \/ 375/);
    assert.match(photoOf(app).getAttribute('style'), /max-width: min\(998px,/, 'never upscaled beyond 2×');
    // The badge above the picture carries the engine label.
    const badge = app.querySelector('[data-labm-banner] .lab-badge');
    assert.equal(badge.getAttribute('data-lab-badge'), 'observed');
    assert.equal(badge.getAttribute('data-lab-label'), 'observed-reference');
    assert.equal(badge.querySelector('.lab-badge-text').textContent, 'Real slide · observed reference');
    assert.equal(
      badge.querySelector('.lab-sr-only').textContent.trim(),
      'A real slide from a published study, not your run.'
    );
    // The credit: author, journal, year, figure, (cropped), license; two links to the article and the license.
    const credit = fig.querySelector('p.labm-credit[data-labm-credit]');
    assert.equal(credit.textContent, IKONOMOVIC_CREDIT);
    const links = [...credit.querySelectorAll('a')];
    assert.equal(links.length, 2);
    assert.deepEqual(
      links.map(a => [a.getAttribute('href'), a.textContent, a.getAttribute('target'), a.getAttribute('rel')]),
      [
        [
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC7498488/',
          'Ikonomovic et al., Acta Neuropathol 2020',
          '_blank',
          'noopener',
        ],
        ['https://creativecommons.org/licenses/by/4.0/', 'CC BY 4.0', '_blank', 'noopener'],
      ]
    );
    assert.equal(
      fig.querySelector('[data-labm-facts]').textContent,
      "Bielschowsky silver stain · frontal cortex · Alzheimer's disease, autopsy (case 27) · scale bar 100 µm (shown in panel h)"
    );
    assert.ok(
      fig.compareDocumentPosition(credit) & w.Node.DOCUMENT_POSITION_CONTAINED_BY,
      'the credit is under the photo, in the figure'
    );
    // Honesty under the real view.
    const below = app.querySelector('.labm-below');
    assert.equal(
      below.querySelector('[data-labm-real-note]').textContent,
      'A real slide from a published study, not your run.'
    );
    assert.equal(
      below.querySelector('[data-labm-honesty]').textContent,
      'Darker does not mean more protein, more pathology or a better method.'
    );
    assert.equal(below.querySelector('[data-labm-reference="none"]'), null, 'no fallback line while a photo shows');
    assert.equal(below.querySelector('[data-labm-caption]'), null, "the drawing's shading note belongs to the drawing");
    assert.ok(below.querySelector('[data-labm-look]').textContent.startsWith('Your run, by eye:'));
    // Chips in the real view; no identify tag ever.
    assert.deepEqual(hints(app), [
      'Drag: move around',
      'Ctrl/⌘ + scroll: zoom',
      'Click: count (Measure › Count lesions)',
    ]);
    for (const chip of hints(app)) assert.ok(chip.split(/\s+/).length <= 8, chip);
    photoPointer(w, photoOf(app), 'pointerdown', 100, 100);
    photoPointer(w, photoOf(app), 'pointerup', 100, 100);
    assert.equal(tagOf(app).hidden, true, 'no identify tag on a photo');
    assert.equal(
      fig.querySelector('[data-labm-photo]').querySelectorAll('button, a').length,
      0,
      'nothing sits over the photo'
    );
    // Words: no engine vocabulary, no order-giving, nothing the honesty rules forbid.
    const seen = visibleText(rootEl);
    assert.doesNotMatch(seen, ENGINE_WORDS, seen);
    assert.doesNotMatch(seen, /\bthen\b|pending|\bv1\b|schematic|ordinal|\bparam\b|\bSOP\b/i, seen);
    // The live region stays quiet on mount; the text alternative is the description plus the credit.
    await sleep(200);
    assert.equal(app.querySelector('[data-labm-live]').textContent, '');
    assert.equal(
      app.querySelector('[data-labm-text-alt]').textContent,
      `${img.getAttribute('alt')} ${IKONOMOVIC_CREDIT}`
    );
    handle.destroy();
  } finally {
    close();
  }
});

test('REF-micro-4: default and remembered view: without the shell the choice lasts the page (module memory); with CortexLab.getSetting / setSetting it is read on mount and written on every switch', async () => {
  const { w, M, lab, app, close } = harness({ library: true });
  try {
    let handle = mountReal(M, lab, app);
    assert.equal(handle.state().view, 'real', 'Real slide when offered');
    app.querySelector('[data-labm-view="drawing"]').click();
    assert.equal(handle.state().view, 'drawing');
    assert.equal(app.querySelectorAll('canvas').length, 1);
    assert.equal(app.querySelector('[data-labm-view="drawing"]').getAttribute('aria-pressed'), 'true');
    assert.equal(app.querySelector('.labm').getAttribute('data-labm-picture'), 'drawing');
    await sleep(200);
    assert.ok(
      app.querySelector('[data-labm-live]').textContent.startsWith('Simulated, not a measurement.'),
      'the switch announces the drawing'
    );
    handle.destroy();
    handle = mountReal(M, lab, app);
    assert.equal(handle.state().view, 'drawing', 'remembered for the page');
    app.querySelector('[data-labm-view="real"]').click();
    assert.equal(handle.state().view, 'real');
    await sleep(200);
    assert.ok(
      app
        .querySelector('[data-labm-live]')
        .textContent.startsWith('Real slide · observed reference. run-1: Real slide:')
    );
    handle.destroy();
    // With the shell: its setting wins on mount; every switch writes it.
    const store = { microscopeView: 'drawing' },
      writes = [];
    w.CortexLab = {
      getSetting: key => store[key],
      setSetting: (key, value) => {
        writes.push([key, value]);
        store[key] = value;
      },
    };
    handle = mountReal(M, lab, app);
    assert.equal(handle.state().view, 'drawing', 'the shell remembered the drawing');
    app.querySelector('[data-labm-view="real"]').click();
    assert.deepEqual(writes, [['microscopeView', 'real']]);
    assert.equal(handle.state().view, 'real');
    handle.destroy();
    store.microscopeView = undefined;
    handle = mountReal(M, lab, app);
    assert.equal(handle.state().view, 'real', 'an unset shell setting falls back to the page memory (last: real)');
    handle.destroy();
    delete w.CortexLab;
  } finally {
    close();
  }
});

test('REF-micro-5: the strip: one 56 px thumbnail button per matching photo, aria-label "Slide n of m: …", the first pressed; a choice swaps the img, credit and facts, keeps focus on the choice, lasts the view session and resets with the run', () => {
  const { M, lab, app, close } = harness({ library: true });
  try {
    const handle = mountReal(M, lab, app),
      strip = () => app.querySelector('.labm-stage figure [data-labm-strip]'),
      buttons = () => [...strip().querySelectorAll('button[data-labm-slide]')];
    assert.ok(strip(), 'a strip when several photos match');
    assert.equal(strip().getAttribute('role'), 'group');
    assert.equal(buttons().length, 9);
    assert.deepEqual(
      buttons().map(b => b.getAttribute('aria-pressed')),
      ['true', 'false', 'false', 'false', 'false', 'false', 'false', 'false', 'false']
    );
    assert.equal(
      buttons()[0].getAttribute('aria-label'),
      "Slide 1 of 9: Real slide: Bielschowsky silver stain of Alzheimer's disease frontal cortex; the arrows mark neuritic plaques."
    );
    assert.equal(buttons()[2].getAttribute('aria-label').slice(0, 14), 'Slide 3 of 9: ');
    assert.ok(
      buttons().every(
        b =>
          b.querySelector('img') &&
          b.querySelector('img').getAttribute('alt') === '' &&
          b.querySelector('img').getAttribute('width') === '56'
      )
    );
    assert.deepEqual(
      buttons().map(b =>
        b.querySelector('img').getAttribute('src').replace('/assets/lab/reference/', '').replace('.jpg?v=1', '')
      ),
      [
        'ikonomovic-2020-fig4d',
        'ikonomovic-2020-fig4h',
        'marengo-2022-fig1-ad',
        'zhang-2025-fig1b',
        'zhang-2025-fig1b-detail',
        'liu-2022-fig4b-np',
        'liu-2022-fig4c-np',
        'zhang-2025-fig1c',
        'zhang-2025-fig1c-detail',
      ],
      'positive cortex first, then hippocampus'
    );
    buttons()[5].click();
    assert.equal(handle.state().slide, 5);
    assert.equal(
      app.querySelector('[data-labm-photo-img]').getAttribute('src'),
      '/assets/lab/reference/liu-2022-fig4b-np.jpg?v=1'
    );
    assert.equal(buttons()[5].getAttribute('aria-pressed'), 'true');
    assert.equal(buttons()[0].getAttribute('aria-pressed'), 'false');
    assert.equal(app.ownerDocument.activeElement, buttons()[5], 'focus stays on the choice after the rebuild');
    assert.ok(
      app.querySelector('[data-labm-credit]').textContent.startsWith('Liu et al., Neurosci Bull 2022, Fig. 4, panel B')
    );
    assert.ok(app.querySelector('[data-labm-facts]').textContent.includes('hippocampus'));
    // The choice lasts the view session: a view switch there and back, Measure, keeps it.
    app.querySelector('[data-labm-view="drawing"]').click();
    app.querySelector('[data-labm-view="real"]').click();
    assert.equal(handle.state().slide, 5);
    app.querySelector('[data-labm-measure-open]').click();
    assert.equal(handle.state().slide, 5);
    // A different run with the same photos keeps it; a run with other photos starts at the first.
    const run2 = fullRun(lab, 'run-2', 'SPEC-SYN-AD-01');
    handle.update({ runs: [run2], outcomes: [lab.resolve(run2)] });
    assert.equal(handle.state().slide, 5);
    const neg = fullRun(lab, 'run-3', 'SPEC-SYN-NEG-01');
    handle.update({ specimen: lab.getSpecimen('SPEC-SYN-NEG-01'), runs: [neg], outcomes: [lab.resolve(neg)] });
    assert.equal(handle.state().slide, 0);
    assert.equal(handle.state().slides, 2);
    handle.destroy();
  } finally {
    close();
  }
});

test('REF-micro-6: the negative comparison specimen shows a control photo (cortex first, then hippocampus); one match shows no strip', () => {
  const { M, lab, app, close } = harness({ library: true });
  try {
    const spec = lab.getSpecimen('SPEC-SYN-NEG-01'),
      run = fullRun(lab, 'run-1', 'SPEC-SYN-NEG-01'),
      handle = M.mount(app, {
        lab,
        specimen: spec,
        runs: [run],
        outcomes: [lab.resolve(run)],
        settings: { reducedMotion: 'on' },
      });
    assert.equal(handle.state().view, 'real');
    assert.equal(
      app.querySelector('[data-labm-photo-img]').getAttribute('src'),
      '/assets/lab/reference/marengo-2022-fig1-control.jpg?v=1'
    );
    assert.ok(
      app.querySelector('[data-labm-facts]').textContent.includes('control'),
      app.querySelector('[data-labm-facts]').textContent
    );
    assert.equal(app.querySelectorAll('[data-labm-slide]').length, 2);
    assert.equal(
      app.querySelector('[data-labm-slide="1"] img').getAttribute('src'),
      '/assets/lab/reference/liu-2022-fig4a-np.jpg?v=1'
    );
    handle.destroy();
    // One match only: no strip.
    const one = {
        ...lab,
        content: {
          ...lab.content,
          assets: { items: lab.content.assets.items.filter(a => a.id === 'A-ref-liu-2022-fig4a-np') },
        },
      },
      h2 = M.mount(app, {
        lab: one,
        specimen: spec,
        runs: [run],
        outcomes: [lab.resolve(run)],
        settings: { reducedMotion: 'on' },
      });
    assert.equal(h2.state().slides, 1);
    assert.ok(app.querySelector('[data-labm-photo-img]'));
    assert.equal(app.querySelector('[data-labm-strip]'), null);
    h2.destroy();
  } finally {
    close();
  }
});

test('REF-micro-7: no photo for the condition (a fresh free run, a card, a compare-only run): the drawing, the fallback line, no switch, no img; the honesty line stays under the drawing', () => {
  const { M, lab, app, close } = harness({ library: true });
  try {
    const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      free = lab.createRun({ id: 'free-1', specimenId: 'SPEC-SYN-AD-01', mode: 'free' }),
      out = lab.resolve(free);
    assert.equal(out.look && out.look.key, 'unstained');
    const handle = M.mount(app, {
      lab,
      specimen: spec,
      runs: [free],
      outcomes: [out],
      settings: { reducedMotion: 'on' },
    });
    assert.equal(handle.state().view, 'drawing');
    assert.equal(handle.state().slides, 0);
    assert.equal(app.querySelector('[data-labm-view-group]').hidden, true, 'no switch');
    assert.equal(app.querySelectorAll('img').length, 0);
    assert.equal(app.querySelectorAll('canvas').length, 1);
    const line = app.querySelector('.labm-below p.labm-reference[data-labm-reference="none"]');
    assert.equal(
      line.textContent,
      "No real photo of this condition is in the library; this drawing is the model's picture."
    );
    assert.equal(line.querySelector('[data-lab-badge]'), null);
    assert.equal(
      app.querySelector('.labm-below [data-labm-honesty]').textContent,
      'Darker does not mean more protein, more pathology or a better method.'
    );
    assert.equal(app.querySelector('[data-labm-objective-group]').hidden, false);
    assert.equal(app.querySelector('[data-labm-layers-toggle]').hidden, false);
    // A card: no line at all (there is no drawing to speak of), no switch.
    const card = fullRun(lab, 'run-c', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } });
    handle.update({ runs: [card], outcomes: [lab.resolve(card)] });
    assert.equal(app.querySelector('[data-labm-view-group]').hidden, true);
    assert.equal(app.querySelector('[data-labm-reference="none"]'), null);
    assert.equal(app.querySelector('[data-labm-honesty]'), null);
    // A finished practice run brings the switch and the photo back.
    const done = fullRun(lab, 'run-d', 'SPEC-SYN-AD-01');
    handle.update({ runs: [done], outcomes: [lab.resolve(done)] });
    assert.equal(handle.state().view, 'real');
    assert.equal(app.querySelector('[data-labm-view-group]').hidden, false);
    handle.destroy();
  } finally {
    close();
  }
});

test('REF-micro-8: Measure › Count lesions on the photo: each click adds a numbered ring at the click point (photo coordinates, no snapping, no de-duplication), counts in its region, the caption, the tally, the chips, and Record notes the real slide', () => {
  const { w, M, lab, app, close } = harness({ library: true });
  try {
    const taken = [],
      handle = mountReal(M, lab, app, { onMeasurement: m => taken.push(m) }),
      rings = () => [...app.querySelectorAll('[data-labm-rings] .labm-ring')];
    openCount(app);
    assert.equal(handle.state().tool, 'roi-lesion-count');
    assert.equal(
      app.querySelector('[data-labm-photo-count]').textContent,
      'Your own count on a real slide; the model does not know the answer.'
    );
    assert.equal(app.querySelector('[data-labm-whole-field]'), null, 'the objective button belongs to the drawing');
    assert.deepEqual(hints(app), ['Click: add a numbered ring']);
    assert.ok(app.querySelector('.labm').classList.contains('labm-picking'));
    assert.ok(app.querySelector('[data-labm-rings]').classList.contains('labm-rings-grid'), 'the 3×3 regions show');
    const box = photoOf(app);
    // jsdom has no layout: the box falls back to the picture's own size (499 × 375).
    photoPointer(w, box, 'pointerdown', 100, 75);
    photoPointer(w, box, 'pointerup', 100, 75);
    photoPointer(w, box, 'pointerdown', 400, 300);
    photoPointer(w, box, 'pointerup', 400, 300);
    photoPointer(w, box, 'pointerdown', 400, 300);
    photoPointer(w, box, 'pointerup', 400, 300);
    assert.equal(rings().length, 3, 'no de-duplication: the same point rings again');
    assert.deepEqual(
      rings().map(r => r.textContent),
      ['1', '2', '3']
    );
    assert.match(rings()[0].getAttribute('style'), /left:20\.040%;top:20\.000%/);
    assert.match(rings()[1].getAttribute('style'), /left:80\.160%;top:80\.000%/);
    assert.equal(app.querySelector('[data-labm-roi="0"]').value, '1');
    assert.equal(app.querySelector('[data-labm-roi="8"]').value, '2');
    assert.equal(app.querySelector('[data-labm-tally]').textContent, 'Plaque cores counted: 3');
    assert.equal(tagOf(app).hidden, true, 'no tag on the photo');
    // Outside the box: nothing.
    photoPointer(w, box, 'pointerdown', 600, 75);
    photoPointer(w, box, 'pointerup', 600, 75);
    assert.equal(rings().length, 3);
    // The rings follow pan / zoom: they share the img's transform and keep their photo position.
    box.dispatchEvent(new w.WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true }));
    assert.ok(handle.state().photo.zoom > 1);
    assert.equal(
      app.querySelector('[data-labm-rings]').style.transform,
      app.querySelector('[data-labm-photo-img]').style.transform
    );
    assert.match(rings()[0].getAttribute('style'), /left:20\.040%;top:20\.000%/);
    // Another photo keeps its own rings; the first photo's come back with it.
    app.querySelector('[data-labm-slide="1"]').click();
    assert.equal(rings().length, 0);
    app.querySelector('[data-labm-slide="0"]').click();
    assert.equal(rings().length, 3);
    // Record works as on the drawing (a manual count), and the note says the real slide.
    const form = app.querySelector('[data-labm-tool-form="roi-lesion-count"]'),
      crit = form.querySelector('[data-labm-field="criterion"]');
    crit.value = 'a dark ring with a core';
    crit.dispatchEvent(new w.Event('input', { bubbles: true }));
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(taken.length, 1);
    assert.equal(taken[0].value, 3);
    assert.equal(taken[0].manual, true);
    assert.ok(
      taken[0].note.includes('on=real slide A-ref-ikonomovic-2020-fig4d (observed reference; your own count)'),
      taken[0].note
    );
    assert.ok(app.querySelector('[data-labm-status]').textContent.startsWith('Recorded'));
    handle.destroy();
  } finally {
    close();
  }
});

test('REF-micro-9: a geometry tool on the photo refuses ("This tool reads the drawing: switch to Drawing (simulation).") with a button that switches; the tools note says which tool works', () => {
  const { M, lab, app, close } = harness({ library: true });
  try {
    const handle = mountReal(M, lab, app);
    app.querySelector('[data-labm-measure-open]').click();
    assert.ok(
      app
        .querySelector('[data-labm-tools-note]')
        .textContent.includes('On the real slide, Count lesions takes your clicks; the other tools read the drawing.')
    );
    for (const toolId of ['artifact-area', 'contrast-ordinal', 'tissue-coverage', 'blinded-quality-score']) {
      app.querySelector(`[data-labm-tool="${toolId}"]`).click();
      const pane = app.querySelector(`[data-labm-tool-pane="${toolId}"]`);
      assert.ok(pane, toolId);
      assert.equal(
        pane.querySelector('[data-labm-tool-refusal]').textContent,
        'This tool reads the drawing: switch to Drawing (simulation).'
      );
      assert.equal(pane.querySelector('[data-labm-rule-ok]'), null, `${toolId}: no rule checkbox on the photo`);
      assert.equal(pane.querySelector('[data-labm-switch-drawing]').textContent, 'Drawing (simulation)');
      app.querySelector(`[data-labm-tool="${toolId}"]`).click(); // closes it
    }
    assert.deepEqual(
      hints(app),
      ['Drag: move around', 'Ctrl/⌘ + scroll: zoom', 'Click: count (Measure › Count lesions)'],
      'the view chips stay'
    );
    app.querySelector('[data-labm-tool="artifact-area"]').click();
    app.querySelector('[data-labm-switch-drawing]').click();
    assert.equal(handle.state().view, 'drawing');
    assert.equal(handle.state().tool, 'artifact-area', 'the tool stays open on the drawing');
    assert.ok(app.querySelector('[data-labm-tool-pane="artifact-area"] [data-labm-rule-ok]'), 'its rule is there now');
    assert.equal(app.querySelector('[data-labm-tool-refusal]'), null);
    assert.equal(app.querySelector('[data-labm-view="drawing"]').getAttribute('aria-pressed'), 'true');
    handle.destroy();
  } finally {
    close();
  }
});

test('REF-micro-10: the objective buttons and Layers hide in the real view and come back in the drawing; L and 1-4 do nothing on the photo; View controls zoom / pan / reset act on the photo', () => {
  const { w, M, lab, app, close } = harness({ library: true });
  try {
    const handle = mountReal(M, lab, app),
      stage = () => app.querySelector('[role="application"]');
    assert.equal(app.querySelector('[data-labm-objective-group]').hidden, true);
    assert.equal(app.querySelector('[data-labm-layers-toggle]').hidden, true);
    key(w, stage(), 'l');
    assert.equal(handle.state().layers, false, "L is the drawing's key");
    key(w, stage(), '3');
    assert.equal(handle.state().objective, 10);
    key(w, stage(), '+');
    assert.ok(Math.abs(handle.state().photo.zoom - 1.25) < 1e-9, '+ zooms the photo');
    assert.equal(handle.state().zoom, 1, "the drawing's zoom is untouched");
    key(w, stage(), 'ArrowRight');
    assert.ok(handle.state().photo.ox > 0, 'the arrow pans the photo');
    key(w, stage(), '0');
    assert.deepEqual({ ...handle.state().photo }, { zoom: 1, ox: 0, oy: 0 });
    app.querySelector('[data-labm-zoom="in"]').click();
    assert.ok(handle.state().photo.zoom > 1);
    app.querySelector('[data-labm-pan="down"]').click();
    assert.ok(handle.state().photo.oy > 0);
    app.querySelector('[data-labm-zoom="reset"]').click();
    assert.deepEqual({ ...handle.state().photo }, { zoom: 1, ox: 0, oy: 0 });
    assert.ok(
      app.querySelector('.labm-keys').textContent.includes('Mouse: drag to pan; hold Ctrl or Cmd and scroll to zoom.')
    );
    app.querySelector('[data-labm-view="drawing"]').click();
    assert.equal(app.querySelector('[data-labm-objective-group]').hidden, false);
    assert.equal(app.querySelector('[data-labm-layers-toggle]').hidden, false);
    key(w, stage(), 'l');
    assert.equal(handle.state().layers, true);
    key(w, stage(), '3');
    assert.equal(handle.state().objective, 20);
    assert.deepEqual(hints(app), DESKTOP_HINTS);
    handle.destroy();
  } finally {
    close();
  }
});

test('REF-micro-11: pan and zoom on the photo: Ctrl + wheel zooms about the pointer, a drag pans within the clamp, the photo never leaves the box empty, "Reset view" appears once moved and resets; a pinch zooms; a cancelled gesture puts the view back', () => {
  const { w, M, lab, app, close } = harness({ library: true });
  try {
    const handle = mountReal(M, lab, app),
      box = photoOf(app),
      img = () => app.querySelector('[data-labm-photo-img]'),
      reset = () => app.querySelector('[data-labm-photo-reset]');
    assert.equal(reset().hidden, true, 'nothing to reset yet');
    assert.equal(img().style.transform, 'translate(0%, 0%) scale(1)');
    // A plain wheel scrolls the page; Ctrl / ⌘ + wheel zooms.
    const plain = new w.WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
    box.dispatchEvent(plain);
    assert.equal(plain.defaultPrevented, false);
    assert.equal(handle.state().photo.zoom, 1);
    const zoomEv = new w.WheelEvent('wheel', {
      deltaY: -100,
      metaKey: true,
      bubbles: true,
      cancelable: true,
      clientX: 0,
      clientY: 0,
    });
    box.dispatchEvent(zoomEv);
    assert.equal(zoomEv.defaultPrevented, true);
    assert.ok(Math.abs(handle.state().photo.zoom - 1.1) < 1e-9);
    assert.deepEqual([handle.state().photo.ox, handle.state().photo.oy], [0, 0], 'zoomed about the top-left pointer');
    assert.equal(img().style.transform, 'translate(0%, 0%) scale(1.1)');
    assert.equal(reset().hidden, false, 'Reset view once moved');
    assert.equal(reset().textContent, 'Reset view');
    assert.ok(!reset().closest('[data-labm-photo]'), 'the link sits beside the photo, not over it');
    // Zoom out below 1 is refused (the box would show an empty strip).
    for (let i = 0; i < 5; i++)
      box.dispatchEvent(new w.WheelEvent('wheel', { deltaY: 100, ctrlKey: true, bubbles: true, cancelable: true }));
    assert.equal(handle.state().photo.zoom, 1);
    assert.equal(reset().hidden, true);
    // A drag at zoom 2 pans; the clamp stops at the photo's edge (ox, oy ≤ 1 - 1/zoom).
    app.querySelector('[data-labm-zoom="in"]').click();
    app.querySelector('[data-labm-zoom="in"]').click();
    app.querySelector('[data-labm-zoom="in"]').click();
    app.querySelector('[data-labm-zoom="in"]').click();
    const z = handle.state().photo.zoom;
    assert.ok(z > 2 && z <= 4, `zoom ${z}`);
    photoPointer(w, box, 'pointerdown', 200, 200);
    photoPointer(w, box, 'pointermove', 190, 200);
    const afterSmall = handle.state().photo;
    assert.ok(afterSmall.ox > 0, 'a 10 px drag pans');
    photoPointer(w, box, 'pointermove', -5000, 200);
    assert.ok(Math.abs(handle.state().photo.ox - (1 - 1 / z)) < 1e-9, 'clamped at the right edge');
    photoPointer(w, box, 'pointermove', 5000, 200);
    assert.equal(handle.state().photo.ox, 0, 'clamped at the left edge');
    photoPointer(w, box, 'pointerup', 5000, 200);
    assert.equal(app.querySelectorAll('.labm-ring').length, 0, 'a drag never counts');
    // A tiny press is a click, not a pan.
    photoPointer(w, box, 'pointerdown', 100, 100);
    photoPointer(w, box, 'pointermove', 102, 101);
    photoPointer(w, box, 'pointerup', 102, 101);
    assert.equal(handle.state().photo.ox, 0);
    // A cancelled drag (the browser took the gesture) restores the view (the View-controls zoom-ins
    // zoomed about the centre, so oy sits at 0.5 - 0.5 / zoom here; the drags only moved ox).
    const beforeDrag = { ...handle.state().photo };
    assert.ok(Math.abs(beforeDrag.oy - (0.5 - 0.5 / z)) < 1e-9, 'zoomed about the centre');
    photoPointer(w, box, 'pointerdown', 200, 200);
    photoPointer(w, box, 'pointermove', 150, 150);
    assert.ok(handle.state().photo.ox > beforeDrag.ox && handle.state().photo.oy > beforeDrag.oy);
    photoPointer(w, box, 'pointercancel', 150, 150);
    assert.deepEqual({ ...handle.state().photo }, beforeDrag);
    // Reset view.
    reset().click();
    assert.deepEqual({ ...handle.state().photo }, { zoom: 1, ox: 0, oy: 0 });
    assert.equal(reset().hidden, true);
    // Pinch (Drag to pan on): two fingers spreading zoom in; closing zoom out, never below 1.
    app.querySelector('[data-labm-touch-pan]').click();
    const finger = (type, id, x, y) =>
      box.dispatchEvent(
        new w.PointerEvent(type, { pointerId: id, pointerType: 'touch', bubbles: true, clientX: x, clientY: y })
      );
    finger('pointerdown', 11, 100, 100);
    finger('pointerdown', 12, 200, 100);
    finger('pointermove', 12, 300, 100);
    assert.ok(Math.abs(handle.state().photo.zoom - 2) < 1e-9, 'spread ×2');
    finger('pointermove', 12, 150, 100);
    assert.equal(handle.state().photo.zoom, 1, 'closed below the start: clamped at 1');
    finger('pointerup', 12, 150, 100);
    finger('pointerup', 11, 100, 100);
    assert.equal(app.querySelectorAll('.labm-ring').length, 0);
    // Drag to pan off: a finger's moves never pan the photo (the page scrolls).
    app.querySelector('[data-labm-touch-pan]').click();
    finger('pointerdown', 13, 200, 200);
    finger('pointermove', 13, 100, 100);
    assert.deepEqual([handle.state().photo.ox, handle.state().photo.oy], [0, 0]);
    finger('pointercancel', 13, 100, 100);
    // Touch chips.
    w.matchMedia = query => ({
      media: query,
      matches: query === '(pointer: coarse)',
      addListener() {},
      removeListener() {},
    });
    handle.update({});
    assert.deepEqual(hints(app), ['Tap: count (Measure › Count lesions)', 'View controls › Drag to pan: move around']);
    app.querySelector('[data-labm-touch-pan]').click();
    assert.deepEqual(hints(app), ['Drag: move around', 'Pinch: zoom', 'Tap: count (Measure › Count lesions)']);
    openCount(app);
    assert.deepEqual(hints(app), ['Tap: add a numbered ring']);
    handle.destroy();
  } finally {
    close();
  }
});

test('REF-micro-12: comparison keeps the drawings and hides the switch; one run again brings the real slide back; the real view is single-run only', () => {
  const { M, lab, app, close } = harness({ library: true });
  try {
    const base = fullRun(lab, 'run-1', 'SPEC-SYN-AD-01'),
      ext = fullRun(lab, 'run-2', 'SPEC-SYN-AD-01', { development: { endpoint: 'extended' } }),
      handle = M.mount(app, {
        lab,
        specimen: lab.getSpecimen('SPEC-SYN-AD-01'),
        runs: [base, ext],
        outcomes: [lab.resolve(base), lab.resolve(ext)],
        settings: { reducedMotion: 'on' },
      });
    assert.equal(handle.state().compare, true);
    assert.equal(handle.state().view, 'drawing');
    assert.equal(app.querySelector('[data-labm-view-group]').hidden, true, 'no switch while comparing');
    assert.equal(app.querySelectorAll('canvas').length, 2);
    assert.equal(app.querySelector('figure.labm-observed'), null);
    assert.equal(app.querySelector('[data-labm-reference="none"]'), null, 'no fallback line in a comparison either');
    assert.equal(app.querySelectorAll('[data-labm-honesty]').length, 1);
    app.querySelector('[data-labm-compare-toggle]').click();
    app.querySelector('[data-labm-side="1"]').click();
    assert.equal(handle.state().compare, false);
    assert.equal(handle.state().view, 'real');
    assert.equal(app.querySelector('[data-labm-view-group]').hidden, false);
    assert.ok(app.querySelector('figure.labm-observed [data-labm-photo-img]'));
    assert.equal(app.querySelector('[data-labm-banner] .lab-badge').getAttribute('data-lab-badge'), 'observed');
    handle.update({ compare: true });
    assert.equal(handle.state().view, 'drawing');
    assert.equal(app.querySelectorAll('canvas').length, 2);
    handle.destroy();
  } finally {
    close();
  }
});

test('REF-micro-13: CSS: the photo box clips and takes the drag (touch like the canvas), the strip is 56 px, the credit wraps, nothing over the photo; no reference-none rule', () => {
  const css = fs.readFileSync(path.join(ROOT, 'lab-microscope.css'), 'utf8'),
    rule = sel =>
      (css.match(new RegExp(`\\n${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^\\n]*)\\}`)) || [])[1] || '';
  assert.match(
    rule('.labm-photo'),
    /position: relative;.*overflow: hidden;.*touch-action: pan-y pinch-zoom;.*cursor: grab;/
  );
  assert.match(css, /\n\.labm-touch-pan \.labm-photo \{ touch-action: none; \}/);
  assert.match(css, /\n\.labm-picking \.labm-photo \{ cursor: crosshair; \}/);
  assert.match(rule('.labm-photo-img'), /width: 100%;.*height: auto;.*transform-origin: 0 0;/);
  assert.match(rule('.labm-rings'), /position: absolute; inset: 0;.*pointer-events: none;/);
  assert.match(css, /\.labm \.labm-strip > button:not\(\.btn\) \{ width: 56px; height: 56px;/);
  assert.match(rule('.labm-credit'), /font-size: 13px;.*overflow-wrap: anywhere;/);
  assert.match(css, /\n\.labm-view\[hidden\], \.labm button\[hidden\] \{ display: none; \}/);
  assert.doesNotMatch(css, /reference-none/);
  assert.match(css, /@media print \{ \.labm-photo-bar, \.labm-strip \{ display: none; \} \}/);
});

// OPEN-micro (contract §13.5): a free run with a currently unknown reaction. The engine adds
// outcome.unknownDips [{ seq, jarId, solution }] and outcome.unknownFields [{ seq, field, value,
// text }]; these tests add them to a finished run (whose look matches photos) so the rule is seen.
const UNKNOWN_DIP = { seq: 3, jarId: 'x1', solution: { reagent: 'tap-water', minutes: 3 } };
const UNKNOWN_FIELD = {
  seq: 2,
  field: 'strength',
  value: 10,
  text: "Currently unknown: what 10% silver nitrate changes; the drawing shows the procedure's effect.",
};
const REF_UNKNOWN =
  'This slide had a currently unknown reaction, so no real photo is matched; the drawing leaves that dip out.';
const REF_PARTLY =
  "This slide had a partly unknown reaction, so no real photo is matched; the drawing shows the procedure's effect for it.";
const UNKNOWN_NOTE = 'Includes a currently unknown reaction (left out of the drawing).';
const PICTURE =
  'Shading follows the model scale, not an amount. One thin section cannot show a plaque or tangle in 3D.';
const mountUnknown = (M, lab, app, extra) => {
  const run = fullRun(lab, 'free-u', 'SPEC-SYN-AD-01'),
    outcome = withExtra(lab.resolve(run), extra);
  return {
    run,
    outcome,
    handle: M.mount(app, {
      lab,
      specimen: lab.getSpecimen('SPEC-SYN-AD-01'),
      runs: [run],
      outcomes: [outcome],
      settings: { reducedMotion: 'on' },
    }),
  };
};

test('OPEN-micro-1: referenceSlides returns [] when the outcome has any unknownDips or unknownFields; empty or missing lists keep the photos', () => {
  const { M, lab, close } = harness({ library: true });
  try {
    const spec = lab.getSpecimen('SPEC-SYN-AD-01'),
      out = lab.resolve(fullRun(lab, 'r', 'SPEC-SYN-AD-01')),
      ids = list => Array.from(list, a => a.id); // the jsdom realm's array → this realm's
    assert.deepEqual(ids(M.referenceSlides(lab, out, spec)), REF.positive, 'the finished run matches photos');
    assert.deepEqual(ids(M.referenceSlides(lab, withExtra(out, { unknownDips: [UNKNOWN_DIP] }), spec)), []);
    assert.deepEqual(ids(M.referenceSlides(lab, withExtra(out, { unknownFields: [UNKNOWN_FIELD] }), spec)), []);
    assert.deepEqual(
      ids(M.referenceSlides(lab, withExtra(out, { unknownDips: [UNKNOWN_DIP], unknownFields: [UNKNOWN_FIELD] }), spec)),
      []
    );
    // Guarded: an empty list, or a field that is not a list, is today's behaviour.
    assert.deepEqual(
      ids(M.referenceSlides(lab, withExtra(out, { unknownDips: [], unknownFields: [] }), spec)),
      REF.positive
    );
    assert.deepEqual(
      ids(M.referenceSlides(lab, withExtra(out, { unknownDips: null, unknownFields: 'x' }), spec)),
      REF.positive
    );
    // The negative comparison specimen follows the same rule.
    const neg = lab.getSpecimen('SPEC-SYN-NEG-01'),
      outNeg = lab.resolve(fullRun(lab, 'n', 'SPEC-SYN-NEG-01'));
    assert.ok(M.referenceSlides(lab, outNeg, neg).length > 0);
    assert.deepEqual(ids(M.referenceSlides(lab, withExtra(outNeg, { unknownDips: [UNKNOWN_DIP] }), neg)), []);
  } finally {
    close();
  }
});

test('OPEN-micro-2: a run with a currently unknown dip opens on the drawing with the fallback line "…the drawing leaves that dip out." (also when a field is partly unknown too); no switch, no img; a run without it brings the photo back', () => {
  const { M, lab, app, close } = harness({ library: true });
  try {
    const { run, outcome, handle } = mountUnknown(M, lab, app, { unknownDips: [UNKNOWN_DIP] });
    assert.equal(handle.state().view, 'drawing');
    assert.equal(handle.state().slides, 0);
    assert.equal(app.querySelector('[data-labm-view-group]').hidden, true, 'no switch');
    assert.equal(app.querySelectorAll('img').length, 0);
    assert.equal(app.querySelectorAll('canvas').length, 1);
    const line = () => app.querySelector('.labm-below p.labm-reference[data-labm-reference="none"]');
    assert.equal(line().textContent, REF_UNKNOWN);
    assert.equal(
      app.querySelector('.labm-below [data-labm-honesty]').textContent,
      'Darker does not mean more protein, more pathology or a better method.'
    );
    // Both lists: the whole-dip sentence (the drawing leaves a dip out).
    handle.update({ runs: [run], outcomes: [withExtra(outcome, { unknownFields: [UNKNOWN_FIELD] })] });
    assert.equal(line().textContent, REF_UNKNOWN);
    // The same run without unknowns: the real slide again.
    const plain = lab.resolve(run);
    handle.update({ runs: [run], outcomes: [plain] });
    assert.equal(handle.state().view, 'real');
    assert.equal(line(), null);
    assert.ok(app.querySelector('figure.labm-observed [data-labm-photo-img]'));
    handle.destroy();
  } finally {
    close();
  }
});

test('OPEN-micro-3: a run with only a partly unknown field says "…the drawing shows the procedure\'s effect for it." and its caption adds nothing', () => {
  const { M, lab, app, close } = harness({ library: true });
  try {
    const { handle } = mountUnknown(M, lab, app, { unknownFields: [UNKNOWN_FIELD] });
    assert.equal(handle.state().view, 'drawing');
    assert.equal(handle.state().slides, 0);
    assert.equal(app.querySelector('[data-labm-view-group]').hidden, true);
    assert.equal(app.querySelector('.labm-below p.labm-reference[data-labm-reference="none"]').textContent, REF_PARTLY);
    assert.equal(app.querySelector('.labm-below [data-labm-caption]').textContent, PICTURE);
    assert.ok(!app.querySelector('[data-labm-text-alt]').textContent.includes(UNKNOWN_NOTE));
    handle.destroy();
  } finally {
    close();
  }
});

test('OPEN-micro-4: the drawing\'s caption adds "Includes a currently unknown reaction (left out of the drawing)." when unknownDips is non-empty; in a comparison the side is named; none without it', () => {
  const { M, lab, app, close } = harness({ library: true });
  try {
    const { run, outcome, handle } = mountUnknown(M, lab, app, { unknownDips: [UNKNOWN_DIP] });
    const caption = () => app.querySelector('.labm-below [data-labm-caption]');
    assert.equal(caption().textContent, `${PICTURE} ${UNKNOWN_NOTE}`);
    // A comparison: only the side with the unknown dip is named.
    const base = fullRun(lab, 'run-b', 'SPEC-SYN-AD-01');
    handle.update({ runs: [base, run], outcomes: [lab.resolve(base), outcome], compare: true });
    assert.equal(handle.state().compare, true);
    assert.equal(caption().textContent, `${PICTURE} Experimental: ${UNKNOWN_NOTE}`);
    assert.equal(caption().querySelector('strong').textContent, 'Experimental:');
    assert.equal(app.querySelector('[data-labm-reference="none"]'), null, 'no fallback line in a comparison');
    // No unknown dip: the real slide is offered; its drawing's caption is the plain shading note.
    handle.update({ runs: [base], outcomes: [lab.resolve(base)] });
    assert.equal(handle.state().view, 'real');
    app.querySelector('[data-labm-view="drawing"]').click();
    assert.equal(handle.state().view, 'drawing');
    assert.equal(caption().textContent, PICTURE);
    handle.destroy();
  } finally {
    close();
  }
});

test('OPEN-micro-5: the text alternative (describe() and the Numbers expander) includes "Includes a currently unknown reaction (left out of the drawing)." for an unknown dip, never for a run without one', () => {
  const { M, lab, app, close } = harness({ library: true });
  try {
    const { outcome, handle } = mountUnknown(M, lab, app, { unknownDips: [UNKNOWN_DIP] }),
      spec = lab.getSpecimen('SPEC-SYN-AD-01');
    assert.ok(M.describe(outcome, spec, lab).includes(UNKNOWN_NOTE));
    assert.ok(!M.describe(lab.resolve(fullRun(lab, 'p', 'SPEC-SYN-AD-01')), spec, lab).includes(UNKNOWN_NOTE));
    const textAlt = app.querySelector('[data-labm-numbers] [data-labm-text-alt]').textContent;
    assert.ok(textAlt.includes(UNKNOWN_NOTE), textAlt);
    assert.doesNotMatch(textAlt, /error|invalid|not allowed/i, 'an unknown dip is a result (§13.6)');
    handle.destroy();
  } finally {
    close();
  }
});
