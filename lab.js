/* Alzheimer's Histology Lab — section shell (context/ALZ-LAB-CONTRACT.md §4 "window.CortexLab",
   context/ALZ-LAB-CONVENTIONS.md §3.2). Loads after study-storage.js and silver-lab-core.js in
   SECTION_SCRIPTS.lab and declares window.LAB so lab-microscope.js and lab-notebook.js can push
   their pause functions into LAB.pausers at load time. Owns: the data loader, the ?view= router,
   shared state under cs-lab-state-v1, the safety gate, list-mode bench, run log, replay, paired
   runs, uncertainty cards, the activities stepper M1..M7 (one step per screen), the 3D bench overlay (with the tissue clip's
   caption line, transcript, controls and structure card; contract §7.1) and the microscope /
   notebook / designer host views, plus the student vocabulary and badges every lab module shares
   (contract §8.1: CortexLab.words / badge / badgeForOutcome / level / summarize). Every simulated
   output carries a badge with data-lab-label = its engine label; nothing here is a measurement.
   Naming contract: globals prefixed lab/Lab/LAB, ids #lab-*, attributes data-lab-*, classes .lab-*. */

// benchModule: a harness may supply { mountBench } where a dynamic import() cannot run (jsdom);
// clipData / clipError: data/lab/clip.json is optional and never blocks the lab from loading.
window.LAB = {
  pausers: [],
  loaded: false,
  lab: null,
  bench: null,
  benchModule: null,
  clipData: null,
  clipError: null,
  loadError: null,
  stateError: null,
};
const LAB = window.LAB;

/* ---------- constants ---------- */
const LAB_TITLE = "Alzheimer's Histology Lab";
const LAB_STATE_KEY = 'cs-lab-state-v1';
// One file per line so `python3 scripts/bump-cache.py <file>.json` bumps only that line.
const LAB_DATA_VERSIONS = [
  '/data/lab/sources.json?v=1',
  '/data/lab/claims.json?v=1',
  '/data/lab/rules.json?v=1',
  '/data/lab/methods.json?v=3',
  '/data/lab/specimens.json?v=3',
  '/data/lab/safety.json?v=3',
  '/data/lab/modules.json?v=3',
  '/data/lab/assets.json?v=1',
  '/data/lab/reagents.json?v=1', // §13.1: the free bench's shelf, jars and hands
];
// Optional: scene captions for the tissue clip (contract §7 / §7.1). A 404 or a damaged file leaves
// LAB.clipData null and the lab otherwise unaffected.
const LAB_CLIP_FILE = '/data/lab/clip.json?v=3';
// Module stylesheets are not linked from index.html; the shell injects them once on first render.
const LAB_MODULE_CSS = ['/lab-microscope.css?v=3', '/lab-notebook.css?v=3'];
const LAB_RUNNABLE_METHOD = 'bielschowsky-modified';
const LAB_VIEWS = ['home', 'about', 'intro', 'bench', 'modules', 'module', 'microscope', 'notebook', 'designer'];
// BENCH-1 (Kevin: "just a bench to see how the lab will react", not another class): the activities, the
// experiment designer and the report are off by default; `window.LAB_FLAGS = { activities, designer,
// report }` turns them back on (the tests and the smoke do, so the code stays covered).
const labFlags = () => ({ activities: false, designer: false, report: false, ...(window.LAB_FLAGS || {}) });
const labFeatureOn = name => typeof name === 'string' && labFlags()[name] === true;
const labViewOn = name =>
  name === 'modules' || name === 'module'
    ? labFlags().activities
    : name === 'designer'
      ? labFlags().designer
      : name === 'notebook'
        ? labFlags().report
        : true;
const LAB_SAVE_PAUSED = 'Saving is paused. Your work stays in this tab until the browser copy can be written again.';
const LAB_SAVED = 'Your work is saved in this browser. Signed-in sync follows your account settings.';
// The one short honesty line a screen carries (the badges carry the rest; contract §8.1).
const LAB_ILLUSTRATIVE =
  'Everything here is simulated by a teaching model, not measured. Darker does not mean more protein, more pathology or a better method.';
// A finished practice run is final (MODE, contract §11.1: no Redo a step): the jars, the 3D tip and a
// step's sheet say where another run starts.
const LAB_RUN_FINISHED = 'This run is finished. New run (in the Run menu) starts another.';
// A finished run that something cites (a recorded measurement, G4): no step can be added to it. The
// lock notice above the bench says what cites it.
const LAB_RUN_LOCKED_TIP = 'This run is locked: its log stays as it is, so no step is added to it.';
const labFinishedTip = ctx => (ctx && ctx.locked ? LAB_RUN_LOCKED_TIP : LAB_RUN_FINISHED);
// The two bench modes (contract §11.1): the course procedure step by step with the standard settings, or
// any jar in any order with any mix. A run carries `mode`; settings.benchMode remembers the last choice.
const LAB_BENCH_MODES = Object.freeze({
  practice: { title: 'Practice the procedure', line: 'Step by step, with the standard settings.' },
  free: { title: 'Free bench', line: 'Any jar, any order, any mix. See what happens, even when nothing does.' },
});
const labBenchModeOf = value => (value === 'free' ? 'free' : 'practice');
const labIsFree = run => !!run && run.mode === 'free';
// A sealed slide (free bench): mounting put a coverslip on it, so every later dip is a no-reaction.
const LAB_SEALED_TIP = 'Sealed under a coverslip: start a new slide';
const labSlideSealed = run => !!run && labIsObj(run.slide) && run.slide.coverslipped === true;
// The engine's by-eye looks and their drawing colours (§11.4; read through these so the shell renders
// before the engine build that exports them lands).
const labLooks = () => (labIsObj(SilverLab.LOOKS) ? SilverLab.LOOKS : {});
const labLookColors = () => (labIsObj(SilverLab.LOOK_COLORS) ? SilverLab.LOOK_COLORS : {});
const LAB_AMMONIA_VALUES = ['just-clear', 'extra', 'cloudy'];
const labAmmoniaValues = () => (Array.isArray(SilverLab.AMMONIA) ? SilverLab.AMMONIA : LAB_AMMONIA_VALUES);
// Tissue clip (contract §7.1): the label every clip surface carries when clip.json has no `label`,
// the text shown where captions would be when clip.json is missing, the id of the transient
// sop-default run the clip falls back to when the bench has no run (never written to state), and
// the scene id that opens the dive half of the timeline (the intro is every scene before it).
const LAB_CLIP_LABEL = 'A drawing, not a reconstruction of any section';
const LAB_CLIP_UNAVAILABLE = 'Clip captions are not available.';
const LAB_CLIP_RUN_ID = 'clip-preview';
const LAB_CLIP_DIVE_SCENE = 'dive';
const LAB_CLIP_NO_RUN =
  'If you look into the tissue before starting a run, the staining scenes show a built-in standard run (per procedure), not saved.';
// A `step-skipped` card is a run still in progress: the director paints the steps performed so far
// (3D-4), so the structure card says so instead of telling the no-basis story.
const LAB_CLIP_INCOMPLETE = 'Run incomplete: drawn from the steps done so far';
const LAB_CLIP_KEYS =
  'Keys while the tissue clip is focused: Space plays or pauses, Right and Left arrows move between scenes, S skips, E explores or leaves explore, Escape skips the intro, leaves explore or returns to the bench.';
// The run-level parameter leaves (§2.1) under their plain names (PLAN-ALZ-LAB-SIMPLIFY §4); values come
// from the engine enums and are worded by labValueText. Engine paths show only in History and the export.
// `noun` is the leaf inside a sentence ("This run changes the washes.").
const LAB_PARAM_LEAVES = [
  { path: 'impregnation.endpoint', label: 'Impregnation time', values: 'ENDPOINTS' },
  { path: 'impregnation.temperature', label: 'Impregnation temperature', values: 'CONDITIONS' },
  {
    path: 'impregnation.condition',
    label: 'Impregnation, other conditions',
    values: 'CONDITIONS',
    noun: 'other impregnation conditions',
  },
  { path: 'ammoniacal.endpoint', label: 'Ammoniacal silver bath time', values: 'ENDPOINTS' },
  // §11.5: how much ammonia went into the ammoniacal silver (the course procedure: just clear + 2 drops).
  { path: 'ammoniacal.ammonia', label: 'Ammonia in the ammoniacal silver', values: 'AMMONIA' },
  {
    path: 'ammoniacal.condition',
    label: 'Ammoniacal silver bath, other conditions',
    values: 'CONDITIONS',
    noun: 'other ammoniacal silver bath conditions',
  },
  { path: 'development.endpoint', label: 'Development time', values: 'ENDPOINTS' },
  { path: 'development.strength', label: 'Developer strength', values: 'STRENGTHS' },
  {
    path: 'development.condition',
    label: 'Development, other conditions',
    values: 'CONDITIONS',
    noun: 'other development conditions',
  },
  { path: 'washes.condition', label: 'Washes', values: 'CONDITIONS' },
];
// Activity screens get a short title: the step's own `title` (data, optional) wins, then the title of
// the answer field it writes, then its kind's (PLAN-ALZ-LAB-SIMPLIFY §3.5).
const LAB_STEP_KIND_TEXT = {
  view: 'Look in the microscope',
  annotate: 'Label what you see',
  choose: 'Weigh the explanations',
  write: 'Write your answer',
  run: 'Run it on the bench',
  compare: 'Compare two runs',
  curves: 'Read the curves',
  clip: 'Watch the clip',
  design: 'Plan your test',
  predict: 'Predict the outcomes',
  interpret: 'Interpret the reveal',
  notebook: 'Build your report',
};
const LAB_FIELD_TITLES = {
  observations: 'Find the structures',
  annotations: 'Label the structures',
  candidates: 'Weigh the explanations',
  statement: 'Write a testable statement',
  baseline: 'Run the standard protocol',
  developerComparison: 'Change the developer',
  methodComparison: 'Compare the methods',
  reflection: 'Your reflection',
  bindingObservation: 'Binding over time',
  developmentObservation: 'Development over time',
  endpointRuns: 'Two longer runs',
  burdenComparison: 'Two specimens, one protocol',
  sameDarkness: 'Same darkness, different amounts',
  siteChemistry: 'More target, less signal',
  changedHeld: 'What you change and what you keep',
  controls: 'Choose your controls',
  measures: 'Choose your measure',
  interpretation: 'Interpret the reveal',
  published: 'Published findings',
  observedVsSimulated: 'Observed or simulated?',
  limitations: 'Limits of the design',
  nextSteps: 'Next steps',
};
// M6: the three predict steps share one screen, one labeled box each.
const LAB_PREDICT_LABELS = {
  expected: 'Expected outcome',
  negligible: 'Negligible change',
  opposite: 'Opposite outcome',
};
// Report steps open the matching add form (lab-notebook.js `tab`: an entry type or a section id).
const LAB_NOTEBOOK_TOOLS = {
  published: ['published', 'Cite a published finding'],
  observedVsSimulated: ['observed', 'Add a real-lab observation'],
  limitations: ['outcomes-limitations', 'Write about the limits'],
};

/* ---------- small helpers ---------- */
const labIsObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const labClone = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
function labGetPath(obj, path) {
  return String(path)
    .split('.')
    .reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function labSetPath(obj, path, value) {
  const keys = String(path).split('.');
  let node = obj;
  for (const key of keys.slice(0, -1)) {
    if (!labIsObj(node[key])) node[key] = {};
    node = node[key];
  }
  node[keys[keys.length - 1]] = value;
  return obj;
}
function labLeaves(obj, prefix = '') {
  const out = [];
  for (const key of Object.keys(obj || {})) {
    const value = obj[key],
      path = prefix ? `${prefix}.${key}` : key;
    if (labIsObj(value)) out.push(...labLeaves(value, path));
    else out.push([path, value]);
  }
  return out;
}
const labOrdinal = n =>
  n === null || n === undefined ? 'not modeled' : SilverLab.ORDINAL_TEXT[Math.max(0, Math.min(4, Math.round(n)))];
const labSiteText = site => SilverLab.SITE_TEXT[site] || site;
function labFmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
}
function labFmtDay(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso || '') : d.toLocaleDateString();
}
let labUidCounter = 0;
const labUid = prefix => `lab-${prefix}-${++labUidCounter}`;
function labList(items, empty = 'none') {
  return items && items.length
    ? items.map(x => `<li>${esc(x)}</li>`).join('')
    : `<li class="lab-dim">${esc(empty)}</li>`;
}
// Backup-safe record key: study-backup.js refuses keys carrying & " ' < > (and nothing else is lost).
function labSlug(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
// Heading at a caller-chosen level so nested output never skips a level (h2 section -> h3 -> h4).
function labHeading(level, inner, attrs = '') {
  const n = Math.max(2, Math.min(6, Number(level) || 3));
  return `<h${n}${attrs}>${inner}</h${n}>`;
}

/* ---------- student vocabulary and badges (contract §8.1; PLAN-ALZ-LAB-SIMPLIFY §4) ---------- */
// The exact strings every lab screen uses; the microscope and notebook read them from CortexLab.words.
const LAB_WORDS = Object.freeze({
  standard: 'standard (per procedure)',
  changed: 'changed',
  notSet: 'not set',
  simulated: 'Simulated · not a measurement',
  simulatedLong: 'Illustrative simulation from a teaching model, not a measurement.',
  notModeled: 'Not modeled',
  notModeledLong: 'The model has no rule for this change, so it shows no picture.',
  referenceNone: 'Real slide', // §12.4: the real-photo badge (the kind keeps its name for the microscope and the report)
  inProgress: 'Steps still to do',
  modelScale: 'model scale',
  scaleLegend: 'Model scale: none · trace · low · moderate · high (positions, not amounts)',
  keepInMind: 'Keep in mind',
  why: 'Why?',
  sources: 'Sources',
  boundSilver: 'bound silver',
  nuclei: 'silver nuclei',
  visibleSilver: 'visible silver',
  practiceSpecimen: 'practice specimen (not real tissue)',
  outOfOrder: 'Done out of order',
  howItWorks: 'How this lab works',
});
// Badge kind -> [visible short text, visually hidden long text]. §8.1 names long forms for two kinds;
// the other three are written here (Deviations UX-A-1).
const LAB_BADGE_TEXT = Object.freeze({
  simulated: [LAB_WORDS.simulated, LAB_WORDS.simulatedLong],
  'not-modeled': [LAB_WORDS.notModeled, LAB_WORDS.notModeledLong],
  'reference-none': [
    LAB_WORDS.referenceNone,
    'A real photomicrograph from an open-access study, shown when one matches the run; credited under the picture.',
  ],
  'in-progress': [LAB_WORDS.inProgress, 'The run is not finished; some steps are still to do.'],
});
// Pass `label` (the engine label) for a badge that sits on an engine output: tests find it by data-lab-label.
// `long` replaces the visually hidden long text where the kind's own does not fit (a comparison).
function labBadge(kind, { label, long } = {}) {
  const text = LAB_BADGE_TEXT[kind];
  if (!text) throw new Error(`Unknown lab badge kind: ${kind}`);
  return `<span class="lab-badge lab-badge-${kind}" data-lab-badge="${kind}"${label ? ` data-lab-label="${esc(label)}"` : ''}><span class="lab-badge-text">${esc(text[0])}</span><span class="lab-sr-only"> ${esc(long || text[1])}</span></span>`;
}
// An Outcome is Simulated; an UncertaintyCard is Not modeled, except a run still missing steps.
function labBadgeForOutcome(result) {
  const label = result && result.label;
  if (label === SilverLab.LABELS.NO_BASIS)
    return labBadge(result.code === 'step-skipped' ? 'in-progress' : 'not-modeled', { label });
  return labBadge('simulated', { label });
}
// A Comparison (lab.compare) is never "no picture": both runs can still be viewed. A pair with an
// unfinished side reads Steps still to do; any other no-basis pair says no difference is computed.
const LAB_COMPARE_NOT_MODELED = 'The model computes no difference for this pair; read each run on its own.';
const labIsComparison = result => labIsObj(result) && 'baseline' in result && 'experimental' in result;
function labBadgeForComparison(cmp) {
  const label = cmp && cmp.label;
  const sides = cmp ? [cmp.baseline, cmp.experimental] : [];
  if (sides.some(s => s && s.label === SilverLab.LABELS.NO_BASIS && s.code === 'step-skipped'))
    return labBadge('in-progress', { label });
  if (label === SilverLab.LABELS.NO_BASIS) return labBadge('not-modeled', { label, long: LAB_COMPARE_NOT_MODELED });
  return labBadge('simulated', { label });
}
// The background rule (R-model-04) is an assumption the model marks: it has no source for this stain.
// When it moved the background (above the rule's base in an Outcome; a different background between
// the two runs of a Comparison) the first-view sentence says so in one clause (F3 / KB-05).
const LAB_ASSUMPTION_RAISED = 'raised by a model assumption with no source for this stain';
const LAB_ASSUMPTION_CHANGE = 'the background change is a model assumption with no source for this stain';
function labAssumedBackgroundOp(ruleIds) {
  const lab = LAB.lab;
  if (!lab || !Array.isArray(ruleIds)) return null;
  for (const id of ruleIds) {
    const rule = lab.getRule(id);
    const op = rule && rule.basis === 'schematic-analogy' && (rule.effect || []).find(e => e && e.op === 'background');
    if (op) return op;
  }
  return null;
}
function labAssumptionNote(result) {
  if (!labIsObj(result)) return '';
  if (labIsComparison(result)) {
    const bg = result.perSite && result.perSite.background;
    if (!bg || bg.baseline === bg.experimental) return '';
    return labAssumedBackgroundOp(result.rulesResponsible) ? LAB_ASSUMPTION_CHANGE : '';
  }
  const op = labAssumedBackgroundOp(result.rulesApplied);
  return op && Number(result.background) > Number(op.base) ? LAB_ASSUMPTION_RAISED : '';
}
// summarize(): plain restatement of the outcome's ordinal words, lesion structures first.
const LAB_SUMMARY_SITES = ['plaque-core', 'plaque-neurite', 'tangle', 'axon', 'neuropil-thread'];
const LAB_SITE_PLURAL = {
  'plaque-core': 'plaque cores',
  'plaque-neurite': 'plaque neurites',
  tangle: 'tangles',
  axon: 'axons',
  'neuropil-thread': 'neuropil threads',
};
const LAB_SUMMARY_BANNED = /\b(results?|data|measured|predicts?)\b/i;
// Engine ids, enum values and parameter paths a summary never shows.
const LAB_SUMMARY_ENGINE = /\b(?:R|C|S|SPEC|H)-[A-Za-z0-9]|\brun-\d|sop-default|\b[a-z]+\.[a-z]+\b|"/;
const labAnd = items => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
function labSummarize(result /* , specimen: accepted for the §8.1 signature; only the outcome is restated */) {
  if (!labIsObj(result)) return '';
  if (result.label === SilverLab.LABELS.NO_BASIS) {
    if (result.code === 'step-skipped') {
      // Over the steps the run needs: a skipped toning / thiosulfate step shows in the card's gaps as its
      // setting ('toning', 'thiosulfate'), not as a missing step (ENGINE-14).
      const gaps = result.outsideSupport || [];
      // §11.5: the engine lists a skipped toning / thiosulfate step neither as a gap nor as a missing step
      // (R-model-10 reads the flag), so the run's own settings say how many steps it needs.
      const run = result.runId && labIsObj(LAB_STATE.runs[result.runId]) ? LAB_STATE.runs[result.runId] : null;
      const flagged = gaps.filter(id => id === 'toning' || id === 'thiosulfate').length;
      const total = SilverLab.STEPS.length - Math.max(flagged, run ? labSkippedSteps(run).size : 0);
      const missing = gaps.filter(id => SilverLab.STEPS.includes(id)).length;
      // A run whose settings the model has no rule for never gets a picture, finished or not (TONING).
      const after = gaps.some(id => !SilverLab.STEPS.includes(id))
        ? `Finished, it still comes back ${LAB_WORDS.notModeled}: the model has no rule for its settings.`
        : 'The picture comes once every step is done.';
      return `${LAB_WORDS.inProgress}: ${total - missing} of ${total} done. ${after}`;
    }
    // A damaged or older save: the card names an id the lab no longer has (CC-14).
    if (result.code === 'specimen-unknown')
      return `${LAB_WORDS.notModeled}: this run's specimen is not in the lab any more, so the model has nothing to stain.`;
    if (result.code === 'method-unknown')
      return `${LAB_WORDS.notModeled}: this run names a method the lab does not know, so the model has no rules for it.`;
    // The card's first sentence with parameters in plain words ("this change (washes changed)"), unless
    // it uses a word a summary never uses (hypothesis-unencoded says "predicts") or still names an
    // engine id (an unknown specimen or method): then the plain long form.
    const first = labPlainEngineText((String(result.explanation || '').match(/^.*?[.!?](?=\s|$)/) || [''])[0].trim());
    const plain = first && !LAB_SUMMARY_BANNED.test(first) && !LAB_SUMMARY_ENGINE.test(first);
    return `${LAB_WORDS.notModeled}: ${plain ? first : LAB_WORDS.notModeledLong}`;
  }
  const groups = new Map(); // ordinal word -> plural site names, in LAB_SUMMARY_SITES order
  for (const site of LAB_SUMMARY_SITES) {
    const entry = result.perSite && result.perSite[site];
    if (!entry) continue;
    const word = labOrdinal(entry.visibility);
    if (!groups.has(word)) groups.set(word, []);
    groups.get(word).push(LAB_SITE_PLURAL[site]);
  }
  if (!groups.size) return '';
  const rank = word => SilverLab.ORDINAL_TEXT.indexOf(word);
  const clauses = [...groups]
    .sort((a, b) => rank(b[0]) - rank(a[0]))
    .map(([word, sites], i) => {
      if (i > 0) return `${labAnd(sites)} show ${word}`;
      return `${labAnd(sites)} show ${word === 'none' ? 'no' : word} ${LAB_WORDS.visibleSilver}`;
    });
  const sentence = clauses.join('; ');
  // "is at", not "stays at ... so": the levels say where things sit, not why (HON-4 / KB-04).
  const note = labAssumptionNote(result);
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}. The background is at ${labOrdinal(result.background)}${note ? ` (${note})` : ''}; contrast is ${labOrdinal(result.contrast)}.`;
}

/* ---------- state (cs-lab-state-v1 through StudyStorage; contract §4) ---------- */
// §12.3: the microscope's picture choice (settings.microscopeView) and the defaults getSetting answers.
const LAB_MICROSCOPE_VIEWS = Object.freeze(['real', 'drawing']);
const LAB_SETTING_DEFAULTS = Object.freeze({ microscopeView: 'real' });
function labEmptyState() {
  return {
    v: 1,
    // 3D is the default bench (Kevin, 2026-10-13); list only when the student picked it (modeChosen) or the
    // browser cannot run 3D (labCurrentMode falls back on its own).
    mode: '3d',
    modeChosen: false,
    safetyAcknowledgedAt: null,
    activeSpecimenId: null,
    runs: {},
    runOrder: [],
    experiments: {},
    experimentOrder: [],
    notebook: { v: 1, entries: [] },
    measurements: {},
    measurementOrder: [],
    moduleProgress: {},
    counters: { run: 0, exp: 0, entry: 0, measurement: 0 },
    // hints (GAME-shell): "Show hints" in the Run menu; older saves merge to true.
    settings: {
      reducedMotion: 'auto',
      highContrast: false,
      objective: 10,
      notesOpen: true,
      notesOpenNarrow: false, // E4 (FIX2): the notepad drawer below 1100 px, closed until opened
      readAloud: false,
      hints: true,
      benchMode: 'practice', // MODE (§11.1): the last mode chosen in Your slide; older saves merge to practice
      microscopeView: 'real', // §12.3: Real slide when one is offered; 'drawing' once chosen; older saves merge to real
    },
    // Free writing beside the bench and on the report (FREE-2): one string, saved as typed.
    notepad: '',
    // §13.3: the free bench's jars ({ jars: { <stepId>: Solution }, extra: [{ id, solution }], handling }),
    // null until the student changes one; read through labFreeJars, which fills it from the procedure's jars
    // (older saves, and anything the shelf does not know, merge to the procedure).
    freeJars: null,
    // Runs "Make the runs for me" made for a draft experiment: { [runId]: expId } (ids only). A run is
    // sealed while that experiment is a draft that still names it (labSealedExp); nothing shows its
    // outcome until the reveal (UX-POLISH).
    sealed: {},
  };
}
function labValidState(s) {
  if (!labIsObj(s) || s.v !== 1) return false;
  const strList = x => Array.isArray(x) && x.every(id => typeof id === 'string');
  if (!labIsObj(s.runs) || !strList(s.runOrder || [])) return false;
  if (!labIsObj(s.experiments || {}) || !strList(s.experimentOrder || [])) return false;
  if (!labIsObj(s.measurements || {}) || !strList(s.measurementOrder || [])) return false;
  if (s.notebook !== undefined && !(labIsObj(s.notebook) && Array.isArray(s.notebook.entries))) return false;
  if (s.moduleProgress !== undefined && !labIsObj(s.moduleProgress)) return false;
  if (s.counters !== undefined && !labIsObj(s.counters)) return false;
  if (s.settings !== undefined && !labIsObj(s.settings)) return false;
  if (s.settings !== undefined && s.settings.hints !== undefined && typeof s.settings.hints !== 'boolean') return false;
  if (s.notepad !== undefined && typeof s.notepad !== 'string') return false;
  if (s.freeJars !== undefined && s.freeJars !== null && !labIsObj(s.freeJars)) return false;
  if (s.mode !== undefined && !['list', '3d'].includes(s.mode)) return false;
  if (s.sealed !== undefined && !(labIsObj(s.sealed) && Object.values(s.sealed).every(id => typeof id === 'string')))
    return false;
  if (
    s.safetyAcknowledgedAt !== undefined &&
    s.safetyAcknowledgedAt !== null &&
    typeof s.safetyAcknowledgedAt !== 'string'
  )
    return false;
  for (const id of s.runOrder || []) {
    const run = s.runs[id];
    if (!labIsObj(run) || run.id !== id || typeof run.specimenId !== 'string' || typeof run.method !== 'string')
      return false;
    if (!Array.isArray(run.events) || !run.events.every(labIsObj) || !labIsObj(run.params)) return false;
  }
  return true;
}
function labMergeState(saved) {
  const state = labEmptyState();
  Object.assign(state, saved);
  state.counters = { ...labEmptyState().counters, ...(saved.counters || {}) };
  state.settings = { ...labEmptyState().settings, ...(saved.settings || {}) };
  state.settings.benchMode = labBenchModeOf(state.settings.benchMode);
  if (!LAB_MICROSCOPE_VIEWS.includes(state.settings.microscopeView)) state.settings.microscopeView = 'real';
  state.notebook = labIsObj(saved.notebook) ? saved.notebook : { v: 1, entries: [] };
  state.moduleProgress = labIsObj(saved.moduleProgress) ? saved.moduleProgress : {};
  state.experiments = labIsObj(saved.experiments) ? saved.experiments : {};
  state.measurements = labIsObj(saved.measurements) ? saved.measurements : {};
  state.experimentOrder = Array.isArray(saved.experimentOrder) ? saved.experimentOrder : [];
  state.measurementOrder = Array.isArray(saved.measurementOrder) ? saved.measurementOrder : [];
  state.runOrder = Array.isArray(saved.runOrder) ? saved.runOrder.filter(id => state.runs[id]) : [];
  // A saved 'list' stays only when the student chose it; older saves (no modeChosen) open in 3D.
  state.modeChosen = saved.modeChosen === true;
  state.mode = saved.mode === 'list' && state.modeChosen ? 'list' : '3d';
  state.notepad = typeof saved.notepad === 'string' ? saved.notepad : '';
  state.freeJars = labIsObj(saved.freeJars) ? saved.freeJars : null; // §13.3: labFreeJars merges the rest
  state.safetyAcknowledgedAt = typeof saved.safetyAcknowledgedAt === 'string' ? saved.safetyAcknowledgedAt : null;
  state.sealed = labSealPruned(state);
  return state;
}
// The seals that still hold: the run exists and its experiment is a draft that still names it.
// Revealing, deleting the experiment or switching its runs drops the old seals (UX-POLISH).
function labSealPruned(state) {
  const out = {};
  for (const [runId, expId] of Object.entries(labIsObj(state.sealed) ? state.sealed : {}))
    if (typeof expId === 'string' && labSealHolds(state, runId)) out[runId] = expId;
  return out;
}
// What decides a run's picture: specimen, method and every setting. Toning and thiosulfate count too
// (ENGINE-14, now §11.5): skipping either changes the run's picture, so a standard run is never the twin of a run
// that skips one (TONING; the earlier key left them out, and labMergeState's prune drops such seals).
function labTwinKey(run) {
  const leaves = labLeaves(labIsObj(run.params) ? run.params : {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify([run.specimenId, run.method, leaves]);
}
// The experiment a run's seal names, while the seal holds (null otherwise): that experiment is a draft
// and names the run, or (a twin, UX-LAST) names a sealed run with the same specimen, method and
// modeled settings, so the twin would show that run's outcome.
function labSealHolds(state, runId) {
  const sealed = labIsObj(state.sealed) ? state.sealed : {};
  const expId = sealed[runId];
  const exp = typeof expId === 'string' && labIsObj(state.experiments) ? state.experiments[expId] : null;
  const run = labIsObj(state.runs) ? state.runs[runId] : null;
  if (!labIsObj(exp) || exp.status !== 'draft' || !labIsObj(run)) return null;
  if (exp.baselineRunId === runId || exp.experimentalRunId === runId) return exp;
  const key = labTwinKey(run);
  const twin = [exp.baselineRunId, exp.experimentalRunId].some(
    id => id && id !== runId && sealed[id] === exp.id && labIsObj(state.runs[id]) && labTwinKey(state.runs[id]) === key
  );
  return twin ? exp : null;
}
// Read through SilverLab.deserialize (version check + the reserved-label refusal) and a shape check.
// A damaged record is kept for recovery and never overwritten with empty progress.
function labReadState() {
  const empty = labEmptyState();
  let saved;
  try {
    saved = StudyStorage.read(LAB_STATE_KEY, null);
  } catch {
    return empty;
  }
  if (saved === null || saved === undefined) return empty;
  try {
    saved = SilverLab.deserialize(JSON.stringify(saved));
  } catch (error) {
    LAB.stateError = `The saved lab state was refused (${error.message}). It was kept for recovery; an empty workspace is shown and saving is paused.`;
    StudyStorage.sessionFailed([LAB_STATE_KEY]);
    return empty;
  }
  if (!labValidState(saved)) {
    LAB.stateError =
      'The saved lab state has an unexpected shape. It was kept for recovery; an empty workspace is shown and saving is paused.';
    StudyStorage.sessionFailed([LAB_STATE_KEY]);
    return empty;
  }
  return labMergeState(saved);
}
let LAB_STATE = labReadState();
StudyStorage.watch(LAB_STATE_KEY, () => LAB_STATE);
let labSaveFailed = false;
function labSaveStatus(ok) {
  const node = document.querySelector('#lab-save-status');
  if (node) node.textContent = ok ? '' : LAB_SAVE_PAUSED;
}
// Written through SilverLab.serialize (stable key order); writeRaw's boolean says whether the browser
// copy was written (false = held in this tab, saving paused).
function labSave() {
  let ok;
  try {
    ok = StudyStorage.writeRaw(LAB_STATE_KEY, SilverLab.serialize(LAB_STATE));
  } catch {
    ok = false;
  }
  labSaveFailed = !ok;
  labSaveStatus(ok);
  labEvents.emit('state', LAB_STATE);
  return ok;
}
function labSetState(patch) {
  if (labIsObj(patch)) Object.assign(LAB_STATE, patch);
  return LAB_STATE;
}
// Ids are `${prefix}-${counter}`, never Date.now(), so saved state is stable (contract §4).
function labNextId(kind) {
  LAB_STATE.counters[kind] = (Number(LAB_STATE.counters[kind]) || 0) + 1;
  return `${kind}-${LAB_STATE.counters[kind]}`;
}
const labNow = () => new Date().toISOString();

/* ---------- tiny emitter: 'state', 'run', 'mode', 'station' ---------- */
const labEvents = (() => {
  const listeners = new Map();
  const api = {
    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return () => api.off(name, fn);
    },
    off(name, fn) {
      listeners.get(name)?.delete(fn);
    },
    emit(name, payload) {
      for (const fn of [...(listeners.get(name) || [])]) {
        try {
          fn(payload);
        } catch (error) {
          console.error('lab listener failed', name, error);
        }
      }
    },
  };
  return api;
})();

/* ---------- hints (contract §10, GAME-shell): say what a control does; never an order, a question or a gate ---------- */
// "Show hints" (Run menu, settings.hints) switches every .lab-hint off through html.lab-hints-off;
// the 3D bench reads api.hintsOn(), the microscope CortexLab.hintsOn() and the 'hints' event.
const labHintsOn = () => LAB_STATE.settings.hints !== false;
const labTouch = () => labMedia('(pointer: coarse)');
function labSyncHintsClass() {
  if (typeof document === 'undefined' || !document.documentElement) return;
  document.documentElement.classList.toggle('lab-hints-off', !labHintsOn());
}
// Saves the choice, syncs the html class and the Run menu box, emits 'hints'. A non-boolean is refused
// (false, nothing changes); otherwise returns whether the browser copy was written.
function labSetHints(on) {
  if (typeof on !== 'boolean') return false;
  LAB_STATE.settings.hints = on;
  labSyncHintsClass();
  const box = typeof document === 'undefined' ? null : document.querySelector('#lab-hints-toggle');
  if (box) box.checked = on;
  const ok = labSave();
  labEvents.emit('hints', on);
  return ok;
}
labSyncHintsClass();
// §12.3 / §12.4: named settings the microscope reads and writes through the shell (settings.microscopeView:
// 'real' | 'drawing', default 'real'). getSetting answers the stored value, else the default; setSetting
// writes it through labSave and emits 'setting' { name, value }; a name that is not a non-empty string is
// refused (false, nothing changes). An older save without the key reads the default.
function labGetSetting(name) {
  const settings = LAB_STATE.settings || {};
  const own = Object.prototype.hasOwnProperty.call(settings, name) ? settings[name] : undefined;
  return own === undefined ? LAB_SETTING_DEFAULTS[name] : own;
}
function labSetSetting(name, value) {
  if (typeof name !== 'string' || !name) return false;
  if (!labIsObj(LAB_STATE.settings)) LAB_STATE.settings = { ...labEmptyState().settings };
  LAB_STATE.settings[name] = value;
  const ok = labSave();
  labEvents.emit('setting', { name, value });
  return ok;
}
// One hint chip, the verb first: <span class="lab-hint"><span class="lab-hint-verb">Click a jar</span>:
// what it does</span>. A row of them is p.lab-hints.
const labHint = (verb, what, { sep = ': ', attrs = '' } = {}) =>
  `<span class="lab-hint"${attrs}><span class="lab-hint-verb">${esc(verb)}</span>${esc(sep)}${esc(what)}</span>`;
// Why a slide dropped on `stepId` would do nothing now ('' when it would do that step): the same checks,
// in the same order, as a 3D jar's double click (api.onEvent) and ctx.doStep. Reads state, changes nothing.
// H8 (FIX4): the reasons describe, never order (D5), in the words the bench's status lines use: no run
// "No run yet: Start the run is under Your slide, above" is the one no-run wording (the tag, the stage
// hint, a list note; MODE-FIX-shell: the button starts a run, a part does not "set one up"). MODE (§11.1):
// in practice only the next step in procedure order can be done; any other jar says which step is next
// ("Next in the procedure: …", "Done. Next: …"). On the free bench any jar takes the slide until it is
// sealed under a coverslip.
const LAB_DROP_HINTS = Object.freeze({
  safety: 'The safety notes below open the bench',
  noRun: 'No run yet: Start the run is under Your slide, above',
  noSteps: 'This run has no bench steps',
  noStep: 'That is not one of this run’s steps',
  skipped: 'Your settings skip this step',
  finished: 'This run is finished',
  locked: 'This run is locked',
  sealed: LAB_SEALED_TIP,
  noJar: 'That jar is not on this bench',
});
// §13.4: the 3D bench names a jar 'jar:<id>' (an extra jar x1..x4, or a procedure jar by its step); the
// list and the Dip control name it by its id. Both reach the same checks.
function labDropHint(lab, ctx, stepId) {
  if (!LAB_STATE.safetyAcknowledgedAt) return LAB_DROP_HINTS.safety;
  const run = ctx && ctx.runId ? LAB_STATE.runs[ctx.runId] : null;
  if (!run) return LAB_DROP_HINTS.noRun;
  const p = labStepProgress(lab, run);
  if (!p.steps.length) return LAB_DROP_HINTS.noSteps;
  const id = labJarIdOf(stepId);
  if (labIsExtraJar(id)) {
    if (!labIsFree(run) || !labJarById(lab, run, id)) return LAB_DROP_HINTS.noJar;
  } else if (!p.steps.some(s => s.id === id)) return LAB_DROP_HINTS.noStep;
  stepId = id;
  if (labRunLocked(run.id)) return LAB_DROP_HINTS.locked;
  if (labIsFree(run)) return labSlideSealed(run) ? LAB_DROP_HINTS.sealed : '';
  if (p.skipped.has(stepId)) return LAB_DROP_HINTS.skipped;
  if (!p.next) return LAB_DROP_HINTS.finished;
  if (p.next.id === stepId) return '';
  const next = labStepTitle(p.next);
  return p.done.has(stepId) ? `Done. Next: ${next}` : `Next in the procedure: ${next}`;
}
// A step of the bench's run: 'next' | 'todo' | 'done' | 'skipped' (by the run's settings), or null (no
// run, a compare-only run, not one of its steps). A free run has nothing next (§11.1): 'done' or 'todo'.
function labStepState(lab, ctx, stepId) {
  const run = ctx && ctx.runId ? LAB_STATE.runs[ctx.runId] : null;
  if (!run) return null;
  stepId = labJarIdOf(stepId);
  // An extra jar (§13.3, free bench only): 'done' once dipped, else 'todo'.
  if (labIsExtraJar(stepId))
    return labIsFree(run) && labJarById(lab, run, stepId) ? (labStepCount(run, stepId) ? 'done' : 'todo') : null;
  const p = labStepProgress(lab, run);
  if (!p.steps.some(s => s.id === stepId)) return null;
  if (p.done.has(stepId)) return 'done';
  if (labIsFree(run)) return 'todo';
  if (p.skipped.has(stepId)) return 'skipped';
  return p.next && p.next.id === stepId ? 'next' : 'todo';
}
// True while a slide drop (or a jar's double click) would do a step: the run's next step in practice,
// any step on the free bench. The slide chip and the dip hints show only then.
function labCanDip(lab, ctx) {
  const run = ctx && ctx.runId ? LAB_STATE.runs[ctx.runId] : null;
  if (!run) return false;
  const p = labStepProgress(lab, run);
  const step = labIsFree(run) ? p.steps[0] : p.next;
  return !!step && labDropHint(lab, ctx, step.id) === '';
}
// How many times a step was done in the run (a free run may do a step again and again); on the free bench
// a jar's dips count too (§13.3: a dip names its jar, a procedure jar by its step).
function labStepCount(run, stepId) {
  const id = labJarIdOf(stepId);
  return run && Array.isArray(run.events) ? run.events.filter(e => labEventJar(e) === id).length : 0;
}
// The jar an event dipped the slide in: a step event's step, a dip's jar; null for any other event.
const labEventJar = e =>
  !e ? null : e.type === 'step' && e.step ? e.step : e.type === 'dip' && typeof e.jarId === 'string' ? e.jarId : null;

/* ---------- the free bench's jars (contract §13): the shelf, each jar's contents, Your hands ---------- */
// Up to four extra jars beside the procedure's nine (§13.3), drawn on the 3D tray at station S9 "Your
// jars". A new extra jar holds potassium permanganate (the first bottle of the pretreatment) until edited.
const LAB_EXTRA_JARS = Object.freeze(['x1', 'x2', 'x3', 'x4']);
const LAB_EXTRA_JAR_BOTTLE = 'permanganate';
const LAB_JARS_STATION = 'S9';
const labIsExtraJar = id => LAB_EXTRA_JARS.includes(id);
const labExtraJarTitle = id => `Your jar ${LAB_EXTRA_JARS.indexOf(id) + 1}`;
// 'jar:<id>' (the 3D bench's hotspot name for a jar, §13.4) and the plain id name the same jar.
const labJarIdOf = id => (typeof id === 'string' ? id.replace(/^jar:/, '') : id);
// The engine's shelf (§13.1-13.2), read through guards: an engine build without it keeps the older free bench
// (a dip is a step event and no jar is edited), so the shell never throws on it.
const LAB_SHELF_API = ['listReagents', 'getReagent', 'procedureJars', 'handlingChoices', 'solutionText'];
function labShelfCall(lab, name, fallback, ...args) {
  if (!lab || typeof lab[name] !== 'function') return fallback;
  try {
    return lab[name](...args);
  } catch {
    return fallback;
  }
}
let labShelfCache = null;
function labShelf(lab) {
  if (!lab || !LAB_SHELF_API.every(name => typeof lab[name] === 'function')) return null;
  if (labShelfCache && labShelfCache.lab === lab) return labShelfCache.shelf;
  const reagents = labShelfCall(lab, 'listReagents', []);
  const jars = labShelfCall(lab, 'procedureJars', {});
  const handling = labShelfCall(lab, 'handlingChoices', []);
  const shelf =
    Array.isArray(reagents) && reagents.length && labIsObj(jars) && Object.keys(jars).length
      ? {
          reagents,
          byId: new Map(reagents.filter(labIsObj).map(r => [r.id, r])),
          jars,
          handling: Array.isArray(handling) ? handling.filter(c => labIsObj(c) && Array.isArray(c.values)) : [],
        }
      : null;
  labShelfCache = { lab, shelf };
  return shelf;
}
const labShelfOn = lab => !!labShelf(lab);
const labFieldValues = def => (labIsObj(def) && Array.isArray(def.values) ? def.values : []);
// A solution the shelf knows, every field of its bottle present (a value the bottle does not offer falls back
// to the bottle's default); null for a bottle the shelf does not have.
function labJarSolution(shelf, solution) {
  const reagent = shelf && labIsObj(solution) ? shelf.byId.get(solution.reagent) : null;
  if (!reagent) return null;
  const out = { reagent: reagent.id };
  for (const [field, def] of Object.entries(labIsObj(reagent.fields) ? reagent.fields : {})) {
    const values = labFieldValues(def);
    out[field] = values.some(v => v === solution[field]) ? solution[field] : def.default;
  }
  return out;
}
// The bench's jars as they stand: LAB_STATE.freeJars over the procedure's contents (lab.procedureJars()); a
// missing or unknown jar, an extra jar beyond four and a hand the shelf does not offer merge back to the
// procedure. null without the shelf. Never written here (labWriteJars writes).
function labFreeJars(lab) {
  const shelf = labShelf(lab);
  if (!shelf) return null;
  const saved = labIsObj(LAB_STATE.freeJars) ? LAB_STATE.freeJars : {};
  const savedJars = labIsObj(saved.jars) ? saved.jars : {};
  const jars = {};
  for (const [stepId, solution] of Object.entries(shelf.jars))
    jars[stepId] = labJarSolution(shelf, savedJars[stepId]) || labJarSolution(shelf, solution) || labClone(solution);
  const seen = new Set();
  const extra = (Array.isArray(saved.extra) ? saved.extra : [])
    .filter(x => labIsObj(x) && labIsExtraJar(x.id) && !seen.has(x.id) && !!seen.add(x.id))
    .map(x => ({ id: x.id, solution: labJarSolution(shelf, x.solution) }))
    .filter(x => x.solution)
    .sort((a, b) => LAB_EXTRA_JARS.indexOf(a.id) - LAB_EXTRA_JARS.indexOf(b.id));
  const savedHands = labIsObj(saved.handling) ? saved.handling : {};
  const handling = {};
  for (const choice of shelf.handling) {
    const ids = choice.values.map(v => v && v.id);
    handling[choice.id] = ids.includes(savedHands[choice.id]) ? savedHands[choice.id] : choice.default;
  }
  return { jars, extra, handling };
}
function labWriteJars(next) {
  LAB_STATE.freeJars = labClone(next);
  return labSave();
}
// The contents in the engine's words ("20% silver nitrate · 20 min · room temperature · in the dark").
function labSolutionText(lab, solution) {
  const words = labShelfCall(lab, 'solutionText', '', solution);
  if (typeof words === 'string' && words) return words;
  const shelf = labShelf(lab);
  const reagent = shelf && labIsObj(solution) ? shelf.byId.get(solution.reagent) : null;
  return reagent ? reagent.name : '';
}
// A procedure jar whose contents are not the procedure's (the engine's isProcedureSolution, else a field-by-
// field comparison with procedureJars). Extra jars have no procedure contents.
function labJarChanged(lab, stepId, solution) {
  if (typeof lab.isProcedureSolution === 'function')
    try {
      return !lab.isProcedureSolution(stepId, solution);
    } catch {
      /* compared below */
    }
  const shelf = labShelf(lab);
  const procedure = shelf ? labJarSolution(shelf, shelf.jars[stepId]) : null;
  return !procedure || JSON.stringify(procedure) !== JSON.stringify(labJarSolution(shelf, solution));
}
// Every jar of the free bench in bench order: the procedure's jars (in procedure order), the extra jars after
// them. [] without the shelf.
function labJars(lab, run) {
  const free = labFreeJars(lab);
  if (!free) return [];
  const out = labStepProgress(lab, run)
    .steps.filter(s => free.jars[s.id])
    .map(s => ({ id: s.id, step: s.id, title: labStepTitle(s), solution: free.jars[s.id], extra: false }));
  for (const x of free.extra)
    out.push({ id: x.id, step: null, title: labExtraJarTitle(x.id), solution: x.solution, extra: true });
  for (const jar of out) {
    jar.changed = !jar.extra && labJarChanged(lab, jar.step, jar.solution);
    jar.text = labSolutionText(lab, jar.solution);
  }
  return out;
}
const labJarById = (lab, run, id) => labJars(lab, run).find(jar => jar.id === id) || null;
// A jar's title wherever it is named: a procedure jar by its step's student title, an extra one "Your jar 2".
const labJarTitleById = id => (labIsExtraJar(id) ? labExtraJarTitle(id) : labStepTitleById(id));
// The one dip a free run receives (§13.2): the jar, what is in it now and the hands it is done with.
function labDipEvent(lab, run, jarId) {
  const jar = labJarById(lab, run, jarId);
  const free = labFreeJars(lab);
  return jar && free
    ? { type: 'dip', jarId: jar.id, solution: labClone(jar.solution), handling: labClone(free.handling) }
    : null;
}
// The hands that are not the procedure's, in the shelf's words ("metal forceps"), for a log line.
function labHandsText(lab, handling) {
  const shelf = labShelf(lab);
  if (!shelf || !labIsObj(handling)) return '';
  return shelf.handling
    .filter(c => handling[c.id] !== undefined && handling[c.id] !== c.default)
    .map(c => {
      const value = c.values.find(v => v && v.id === handling[c.id]);
      return `${c.label}: ${value && value.words ? value.words : handling[c.id]}`;
    })
    .join('; ');
}
// Why the microscope has no picture of the bench's run to show ('' when it has one: every step done,
// not sealed, an outcome with a picture). A double-click on the 3D microscope opens it only then
// (api.canLook); else the microscope's sheet shows this line (contract §10, D2/D3). A free run can be
// looked at any time (§11.1): an unstained section is a real thing to see.
const LAB_LOOK_HINTS = Object.freeze({
  noRun: 'No run on the bench yet, so there is no picture to look at.',
  steps: 'Steps still to do: the picture comes once every step is done.',
  notModeled: `${LAB_WORDS.notModeled}: this run has no picture to look at.`,
});
function labLookReason(lab, ctx) {
  const run = ctx && ctx.runId ? LAB_STATE.runs[ctx.runId] : null;
  if (!run) return LAB_LOOK_HINTS.noRun;
  const sealed = labSealedExp(run.id);
  if (sealed) return `Sealed until you reveal ${labExperimentName(sealed)}.`;
  if (!labIsFree(run) && labStepProgress(lab, run).next) return LAB_LOOK_HINTS.steps;
  let result;
  try {
    result = lab.resolve(run);
  } catch {
    return LAB_LOOK_HINTS.notModeled;
  }
  return labIsObj(result) && result.label !== SilverLab.LABELS.NO_BASIS ? '' : LAB_LOOK_HINTS.notModeled;
}
// The by-eye look of the bench's run as it stands (§11.4): the outcome's `look` ({ key, text }), else the
// last reaction's look key read through the engine's LOOKS; null when neither is there (an engine build
// without looks). Never invented here.
function labRunLook(lab, run) {
  if (!run || labIsSealed(run.id)) return null;
  let result;
  try {
    result = lab.resolve(run);
  } catch {
    result = null;
  }
  if (labIsObj(result) && labIsObj(result.look) && typeof result.look.text === 'string') return result.look;
  // Mid-run (the strict model answers a Not modeled card until every step is done): the last replay
  // frame's look key, else the last reaction's.
  let frames;
  try {
    frames = Array.isArray(run.events) && run.events.length ? lab.replay(run) : [];
  } catch {
    frames = [];
  }
  const frame = frames.length ? frames[frames.length - 1] : null;
  const last = Array.isArray(run.reactions) ? run.reactions[run.reactions.length - 1] : null;
  const key =
    frame && typeof frame.look === 'string' ? frame.look : last && typeof last.look === 'string' ? last.look : null;
  const known = key ? labLooks()[key] : null;
  return known && typeof known.text === 'string' ? { key, text: known.text } : null;
}
// The drawn slide's colour for a look key (LOOK_COLORS), null for the bench's default grey.
const labLookColor = key => (key && typeof labLookColors()[key] === 'string' ? labLookColors()[key] : null);
const labCanLook = (lab, ctx) => labLookReason(lab, ctx) === '';

/* ---------- data (root-relative, parallel, memoized; readable failure) ---------- */
let labLoading = null;
async function labLoad() {
  if (LAB.lab) return LAB.lab;
  if (labLoading) return labLoading;
  labLoading = (async () => {
    const content = {};
    const clip = labLoadClip(); // optional; resolves null on any failure
    await Promise.all(
      LAB_DATA_VERSIONS.map(async file => {
        const key = file.split('/').pop().split('.')[0];
        let response;
        try {
          response = await fetch(file);
        } catch {
          throw new Error(`${key}.json could not be downloaded`);
        }
        if (!response.ok) throw new Error(`${key}.json answered ${response.status}`);
        try {
          content[key] = await response.json();
        } catch {
          throw new Error(`${key}.json is not valid JSON`);
        }
      })
    );
    // The clip goes to the engine too (lab.getClip(), §7). createLab throws SilverLab.ContentError with
    // the problems; when every problem lies in the optional clip, the lab loads without it instead.
    const clipData = await clip;
    let lab;
    try {
      lab = SilverLab.createLab(clipData ? { ...content, clip: clipData } : content);
    } catch (error) {
      const problems = error && Array.isArray(error.problems) ? error.problems : [];
      const clipOnly = problems.length > 0 && problems.every(p => String(p && p.path).startsWith('clip'));
      if (!clipData || !clipOnly) throw error;
      LAB.clipError = `clip.json was refused: ${problems.map(p => `${p.code} at ${p.path}`).join('; ')}`;
      lab = SilverLab.createLab(content);
    }
    labHydrateRuns(lab);
    LAB.clipData = LAB.clipError ? null : clipData;
    LAB.lab = lab;
    LAB.loaded = true;
    LAB.loadError = null;
    return lab;
  })();
  try {
    return await labLoading;
  } catch (error) {
    LAB.loadError = error && error.message ? error.message : String(error);
    throw error;
  } finally {
    labLoading = null;
  }
}
// The clip captions are optional content: a 404, a network failure or invalid JSON leaves the lab
// usable and the clip surfaces reading LAB_CLIP_UNAVAILABLE (LAB.clipError says why).
async function labLoadClip() {
  try {
    const response = await fetch(LAB_CLIP_FILE);
    if (!response || !response.ok) throw new Error(`clip.json answered ${response ? response.status : 'nothing'}`);
    const parsed = await response.json();
    if (!labIsObj(parsed)) throw new Error('clip.json is not an object');
    LAB.clipError = null;
    return parsed;
  } catch (error) {
    LAB.clipError = error && error.message ? error.message : String(error);
    return null;
  }
}
// The parsed clip: the engine's accessor when it has one (contract §7 `lab.getClip()`), else the
// shell's copy, else null.
function labClip(lab) {
  let clip = null;
  if (lab && typeof lab.getClip === 'function') {
    try {
      clip = lab.getClip();
    } catch {
      clip = null;
    }
  }
  return labIsObj(clip) ? clip : LAB.clipData;
}
// Scenes as [{ id, title, captions: string[] }]: a scene may carry `caption` or `captions` (strings or
// { text }), and the structures scene carries one caption per structure.
function labClipScenes(clip) {
  const scenes = clip && Array.isArray(clip.items) ? clip.items : clip && Array.isArray(clip.scenes) ? clip.scenes : [];
  const textOf = c => (typeof c === 'string' ? c : labIsObj(c) ? String(c.caption ?? c.text ?? '') : '').trim();
  return scenes.filter(labIsObj).map(scene => {
    const own = Array.isArray(scene.captions) ? scene.captions.map(textOf) : [textOf(scene.caption)];
    // The structures scene names one sub-caption per site class: "Plaque core: ...".
    const sub = (Array.isArray(scene.sub) ? scene.sub : []).filter(labIsObj).map(s => {
      const name = String(s.title || (s.site ? labSiteText(s.site) : '')).trim();
      return name ? `${name}: ${textOf(s)}` : textOf(s);
    });
    return {
      id: String(scene.id ?? ''),
      title: String(scene.title ?? scene.id ?? ''),
      captions: [...own, ...sub].filter(Boolean),
    };
  });
}
const labClipLabel = clip =>
  clip && typeof clip.label === 'string' && clip.label.trim() ? clip.label.trim() : LAB_CLIP_LABEL;
const labClipText = (clip, key, fallback = '') =>
  clip && typeof clip[key] === 'string' && clip[key].trim() ? clip[key].trim() : fallback;
// The intro is every scene before the dive scene; the dive is that scene and the rest.
function labClipSequence(clip, phase) {
  const scenes = labClipScenes(clip);
  const at = scenes.findIndex(s => s.id === LAB_CLIP_DIVE_SCENE);
  if (at < 0) return scenes;
  return phase === 'intro' ? scenes.slice(0, at) : scenes.slice(at);
}
// Saved runs are rebuilt from their events so stepsDone / state / rulesApplied always come from the
// engine that is loaded, not from an older save. A run that cannot be rebuilt keeps its saved copy.
function labHydrateRuns(lab) {
  for (const id of LAB_STATE.runOrder) {
    const saved = LAB_STATE.runs[id];
    if (!saved) continue;
    try {
      const mode = labBenchModeOf(saved.mode); // a stored run without the field is practice (§11.1)
      let run = lab.createRun({
        id: saved.id,
        specimenId: saved.specimenId,
        method: saved.method,
        params: saved.baseParams || saved.params,
        label: saved.label,
        mode,
      });
      if (run.mode !== mode) run.mode = mode;
      for (const event of [...saved.events].sort((a, b) => (a.seq || 0) - (b.seq || 0)))
        run = lab.applyEvent(run, event);
      if (saved.createdAt) run.createdAt = saved.createdAt;
      if (typeof saved.guess === 'string') run.guess = saved.guess;
      LAB_STATE.runs[id] = run;
    } catch {
      /* keep the saved copy */
    }
  }
}

/* ---------- runs, experiments, events ---------- */
function labFirstSpecimenId(lab) {
  const list = lab.listSpecimens();
  return list.length ? list[0].id : null;
}
function labNewRun(opts = {}) {
  const lab = LAB.lab;
  if (!lab) throw new Error('Lab content is not loaded yet');
  const specimenId = opts.specimenId || LAB_STATE.activeSpecimenId || labFirstSpecimenId(lab);
  const id = labNextId('run');
  const mode = labBenchModeOf(opts.mode);
  const run = lab.createRun({
    id,
    specimenId,
    method: opts.method || LAB_RUNNABLE_METHOD,
    params: labIsObj(opts.params) ? opts.params : {},
    label: typeof opts.label === 'string' && opts.label.trim() ? opts.label.trim() : null,
    mode,
  });
  if (run.mode !== mode) run.mode = mode; // an engine build before §11 does not keep the field
  run.createdAt = labNow();
  LAB_STATE.runs[id] = run;
  LAB_STATE.runOrder.push(id);
  LAB_STATE.activeSpecimenId = specimenId;
  if (!opts.deferSave) labSave();
  labEvents.emit('run', run);
  return run;
}
function labNewExperiment(opts = {}) {
  const id = labNextId('exp');
  const exp = {
    id,
    status: 'draft',
    title: '',
    background: '',
    question: '',
    hypothesis: '',
    alternative: '',
    independentVariable: '',
    measures: [],
    heldComparable: [],
    changed: [],
    controls: [],
    predictions: { expected: '', negligible: '', opposite: '' },
    limitations: '',
    baselineRunId: null,
    experimentalRunId: null,
    interpretation: null,
    createdAt: labNow(),
  };
  for (const [key, value] of Object.entries(opts || {})) if (key !== 'id' && value !== undefined) exp[key] = value;
  exp.id = id;
  if (!['draft', 'revealed', 'done'].includes(exp.status)) exp.status = 'draft';
  LAB_STATE.experiments[id] = exp;
  LAB_STATE.experimentOrder.push(id);
  labSave();
  return exp;
}
// seq is per run: (last seq) + 1, starting at 1. Several events save once.
function labApplyEvents(runId, events) {
  const lab = LAB.lab;
  let run = LAB_STATE.runs[runId];
  if (!lab || !run) return null;
  for (const event of events) {
    if (!labIsObj(event) || typeof event.type !== 'string') continue;
    const seq = run.events.reduce((max, e) => Math.max(max, Number(e && e.seq) || 0), 0) + 1;
    const clean = { seq, type: event.type };
    if (event.step !== undefined) clean.step = event.step;
    if (event.params !== undefined) clean.params = labClone(event.params);
    if (event.text !== undefined) clean.text = String(event.text);
    // §13.2: a free dip names its jar, what is in it and the hands it is done with.
    if (event.jarId !== undefined) clean.jarId = String(event.jarId);
    if (event.solution !== undefined) clean.solution = labClone(event.solution);
    if (event.handling !== undefined) clean.handling = labClone(event.handling);
    run = lab.applyEvent(run, clean);
  }
  LAB_STATE.runs[runId] = run;
  labSave();
  labEvents.emit('run', run);
  return run;
}
const labApplyEvent = (runId, event) => labApplyEvents(runId, [event]);
// Every step the run needs, in procedure order: a step its settings skip (gold toning, thiosulfate) is
// never performed (ENGINE-14).
function labFullProtocolEvents(lab, run) {
  const method = lab.getMethod(run.method);
  if (!method || method.compareOnly || method.runnable === false) return [];
  const skipped = labSkippedSteps(run);
  return [...method.steps]
    .sort((a, b) => a.order - b.order)
    .filter(step => !skipped.has(step.id))
    .map(step => ({ type: 'step', step: step.id }));
}
const labIsCompareOnly = method => !!method && (method.compareOnly === true || method.runnable === false);
const labHasStep = run => !!run && run.events.some(e => !!labEventJar(e));
// A run is locked (no new events through the bench) once something cites it: a notebook entry, a
// measurement or a revealed experiment. Appending to it would silently change what the citation meant.
// H2 (FIX4): a measurement cites a run only while the report is on (LAB_FLAGS.report); with it off the
// student can neither open nor remove the record, so it never locks the run they are working on.
function labRunReferences(runId) {
  const refs = [];
  const n = id => (/-(\d+)$/.exec(String(id)) || [])[1] || id;
  for (const entry of LAB_STATE.notebook.entries || [])
    if (entry && entry.runId === runId) refs.push(`report entry ${n(entry.id)}`);
  if (labFeatureOn('report'))
    for (const id of LAB_STATE.measurementOrder) {
      const m = LAB_STATE.measurements[id];
      if (m && m.runId === runId) refs.push(`measurement ${n(id)}`);
    }
  for (const id of LAB_STATE.experimentOrder) {
    const e = LAB_STATE.experiments[id];
    if (e && e.status !== 'draft' && (e.baselineRunId === runId || e.experimentalRunId === runId)) {
      // The experiment by its title, as the student named it (KB-24); a number only when untitled.
      const title = String(e.title || '').trim();
      refs.push(
        `${title ? `your experiment “${title}”` : `experiment ${n(id)}`} (${e.status === 'done' ? 'done' : 'revealed'})`
      );
    }
  }
  return refs;
}
const labRunLocked = runId => !!runId && labRunReferences(runId).length > 0;
// Sealed runs (UX-POLISH): the runs "Make the runs for me" made for a draft experiment show no outcome
// anywhere until that experiment is revealed, so the predictions come first (BRIEF §4E). The seal holds
// while the experiment is a draft that still names the run; revealing it, deleting it or switching its
// runs lifts the seal.
// A new run that matches a sealed run is sealed to the same experiment (a twin, UX-LAST).
const labSealedExp = runId => (runId ? labSealHolds(LAB_STATE, runId) : null);
const labIsSealed = runId => !!labSealedExp(runId);
const labIsTwin = runId => {
  const exp = labSealedExp(runId);
  return !!exp && exp.baselineRunId !== runId && exp.experimentalRunId !== runId;
};
const labSealedCards = runs =>
  runs
    .map(
      run =>
        `<div class="lab-sealed-card"><p class="lab-sealed-run">${esc(labRunTitle(run))}</p>${labSealedNote(run.id)}</div>`
    )
    .join('');
const labExperimentName = exp => {
  const title = String((exp && exp.title) || '').trim();
  return title ? `“${title}”` : 'your experiment';
};
const labSealedUrl = exp => labUrl({ view: 'designer', exp: exp.id, step: 2 }); // screen 2: predict and reveal (SIMPLE)
// "Sealed until you reveal <title>. Write your predictions first." (the second sentence links to the
// experiment's predictions step).
function labSealedNote(runId) {
  const exp = labSealedExp(runId);
  if (!exp) return '';
  const lead = labIsTwin(runId) ? labTwinText(exp) : `Sealed until you reveal ${labExperimentName(exp)}.`;
  return `<p class="lab-sealed" data-lab-sealed="${esc(runId)}">${esc(lead)} <a data-lab-go href="${esc(labSealedUrl(exp))}">Write your predictions first.</a></p>`;
}
const labTwinText = exp =>
  `This run matches a sealed run, so it stays sealed until you reveal ${labExperimentName(exp)}.`;
// Twin sealing (UX-LAST): a run just made with the same specimen, method and modeled settings as a run
// sealed for a draft would show that sealed outcome, so it is sealed to the same experiment. Returns
// that experiment (the caller tells the student) or null. The caller saves.
function labSealTwin(runId) {
  const run = LAB_STATE.runs[runId];
  if (!run || labIsSealed(runId) || !labIsObj(LAB_STATE.sealed)) return null;
  const key = labTwinKey(run);
  for (const [id, expId] of Object.entries(LAB_STATE.sealed)) {
    const exp = id === runId ? null : labSealedExp(id);
    if (!exp || exp.id !== expId || (exp.baselineRunId !== id && exp.experimentalRunId !== id)) continue;
    if (labTwinKey(LAB_STATE.runs[id]) !== key) continue;
    LAB_STATE.sealed[runId] = exp.id;
    return exp;
  }
  return null;
}
// What the 3D bench may show of a run: a sealed run without its state, so the slide stays untinted
// (the done-step markers and the rack position stay).
const labBenchRun = run => (run && labIsSealed(run.id) ? { ...run, state: null } : run);
function labSealRuns(expId, runIds) {
  if (!labIsObj(LAB_STATE.sealed)) LAB_STATE.sealed = {};
  for (const id of runIds) if (id) LAB_STATE.sealed[id] = expId;
  LAB_STATE.sealed = labSealPruned(LAB_STATE);
}
// The clip's fallback when the bench has no run (contract §7.1): a full-protocol run at SOP defaults
// on the active specimen, built with the engine only. It is never stored, never gets a counter id and
// never reaches LAB_STATE; the overlay tells the student the stain phases come from it.
function labTransientRun(lab, specimenId) {
  let run = lab.createRun({
    id: LAB_CLIP_RUN_ID,
    specimenId: specimenId || LAB_STATE.activeSpecimenId || labFirstSpecimenId(lab),
    method: LAB_RUNNABLE_METHOD,
    params: {},
    label: 'built-in default (not saved)',
  });
  labFullProtocolEvents(lab, run).forEach((event, i) => {
    run = lab.applyEvent(run, { seq: i + 1, ...event });
  });
  return run;
}

/* ---------- navigation ---------- */
function labBasePath() {
  const base = typeof sectionUrl === 'function' ? sectionUrl('lab') : '/lab';
  return base.startsWith('/lab') ? base : '/lab' + (base.includes('?') ? base.slice(base.indexOf('?')) : '');
}
function labUrl(params = {}) {
  const url = new URL(labBasePath(), location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  return url.pathname + url.search;
}
function labGo(params = {}) {
  const url = labUrl(params);
  if (location.pathname + location.search !== url) {
    labMarkDesignerReturn(params);
    history.pushState({ sec: 'lab' }, '', url);
  }
  return renderLabEntry();
}
// Leaving the designer for the microscope with at=<anchor> (UX-LAST): the designer's own history entry
// gets the anchor (and the step), so browser Back restores that section with its heading focused, as
// the back link does; the designer drops `at` again on its first wizard move.
function labMarkDesignerReturn(params) {
  if (params.view !== 'microscope') return;
  const back = labScopeReturn(params.from, params.exp, params.step, params.at);
  if (!back || !back.at) return;
  const here = new URLSearchParams(location.search);
  if (here.get('view') !== 'designer' || (back.exp && here.get('exp') !== back.exp)) return;
  try {
    history.replaceState(
      history.state,
      '',
      labUrl({ ...Object.fromEntries(here), step: back.step || here.get('step'), at: back.at })
    );
  } catch {
    /* the address is a convenience here */
  }
}
function labTrack() {
  return typeof CortexAcademy !== 'undefined' ? CortexAcademy.tracks.find(t => t.id === 'lab') : null;
}
function labStatusText() {
  const track = labTrack();
  if (track && typeof CortexAcademy.status === 'function') return CortexAcademy.status(track);
  return 'Local preview';
}
function labInjectModuleCss() {
  if (typeof document === 'undefined' || !document.head) return;
  for (const href of LAB_MODULE_CSS) {
    if (document.querySelector(`link[href="${href}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}
// The site's sticky top bar is 64 px wide-screen and up to 159 px at 320 px (it wraps). Its height is
// kept in --lab-topbar-h so the lab's scroll padding, the side sheet and the visibility checks clear it
// (A11Y-04 / KB-01).
function labTopbarHeight() {
  if (typeof document === 'undefined') return 0;
  const bar = document.querySelector('header.topbar') || document.querySelector('#app header');
  const height = bar ? Math.round(bar.getBoundingClientRect().height || bar.offsetHeight || 0) : 0;
  if (height > 0) document.documentElement.style.setProperty('--lab-topbar-h', `${height}px`);
  return height;
}
// G8: how far the site's fixed or sticky top bar reaches into the viewport now (0 when there is none,
// or a bar in the flow has scrolled away).
function labTopInset() {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return 0;
  if (document.querySelector('section.lab-stage-full')) return 0; // full view covers the top bar
  const bar = document.querySelector('header.topbar') || document.querySelector('#app header');
  if (!bar) return 0;
  const position = getComputedStyle(bar).position;
  if (position !== 'fixed' && position !== 'sticky') return 0;
  const box = bar.getBoundingClientRect();
  const bottom = Math.min(box.bottom, window.innerHeight || box.bottom);
  return bottom > 0 && box.height > 0 ? Math.round(bottom) : 0;
}
// H10 (FIX4): the part of the window the page is seen through, as insets: `top` the site's sticky top bar
// (labTopInset), `bottom` the open notes drawer of a narrow screen (its height on screen; 0 when it is
// closed or the notepad is the side column). Reveals (the microscope view's, the bench's) keep what they
// bring into view between the two (CortexLab.viewportInsets, api.viewportInsets).
function labViewportInsets() {
  const insets = { top: labTopInset(), bottom: 0 };
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return insets;
  const pad = document.querySelector('#lab-notepad');
  if (!pad || pad.hidden || getComputedStyle(pad).position !== 'fixed') return insets;
  // The drawer is anchored to the window's bottom (lab.css), so its own height is the inset, also while the
  // view's page-in transform still holds it out of place.
  const box = pad.getBoundingClientRect();
  const height = window.innerHeight || 0;
  if (box.height > 0) insets.bottom = Math.round(Math.min(box.height, height));
  return insets;
}
// Whether a node is wholly in that part of the window (under the top bar, above an open drawer); a node in
// the drawer itself counts as seen.
function labInFreeBand(node) {
  if (!node || !node.isConnected || typeof node.getBoundingClientRect !== 'function') return false;
  if (typeof window === 'undefined' || !window.innerHeight) return false;
  const box = node.getBoundingClientRect();
  if (!box.width && !box.height) return false;
  if (node.closest && node.closest('#lab-notepad')) return box.top >= 0 && box.bottom <= window.innerHeight + 1;
  const { top, bottom } = labViewportInsets();
  return box.top >= top - 1 && box.bottom <= window.innerHeight - bottom + 1;
}
// I8 (FIX5): whether some of a node is in that part of the window (at least partly seen).
function labPartlyInBand(node) {
  if (!node || !node.isConnected || typeof node.getBoundingClientRect !== 'function') return false;
  if (typeof window === 'undefined' || !window.innerHeight) return false;
  const box = node.getBoundingClientRect();
  if (!box.width && !box.height) return false;
  const { top, bottom } = labViewportInsets();
  return box.bottom > top + 1 && box.top < window.innerHeight - bottom - 1;
}
// H7 (FIX4): an open notes drawer lies over this node (a phone's stuck "Do this step" is always under it).
function labDrawerCovers(node) {
  if (!node || typeof node.getBoundingClientRect !== 'function' || typeof window === 'undefined') return false;
  if (node.closest && node.closest('#lab-notepad')) return false;
  const { bottom } = labViewportInsets();
  if (!bottom) return false;
  const box = node.getBoundingClientRect();
  return (box.width > 0 || box.height > 0) && box.bottom > window.innerHeight - bottom;
}
// Scrolls just enough to bring a node into the free band (top under the top bar, else bottom above the
// drawer), never under either.
function labRevealInBand(node) {
  if (!node || typeof node.getBoundingClientRect !== 'function' || typeof window.scrollBy !== 'function') return;
  const { top, bottom } = labViewportInsets();
  const box = node.getBoundingClientRect();
  const low = window.innerHeight - bottom;
  const delta =
    box.top < top || box.height > low - top - 16 ? box.top - top - 8 : box.bottom > low ? box.bottom - low + 8 : 0;
  if (Math.abs(delta) >= 1) window.scrollBy({ top: delta, behavior: 'instant' });
}
let labTopbarWatched = false;
function labWatchTopbar() {
  labTopbarHeight();
  if (labTopbarWatched || typeof window === 'undefined') return;
  labTopbarWatched = true;
  window.addEventListener('resize', () => labTopbarHeight());
}
// Whether a part, from its top down to `until` (one of its controls; else its own bottom), fits the
// viewport under the site's top bar (G6: what is brought to the top is seen down to that control).
function labFitsView(node, until = null) {
  if (!node || typeof node.getBoundingClientRect !== 'function' || typeof window === 'undefined') return false;
  const box = node.getBoundingClientRect();
  const bottom = until && until.isConnected ? until.getBoundingClientRect().bottom : box.bottom;
  return bottom - box.top <= (window.innerHeight || 0) - labTopbarHeight() - 8;
}
// Brings a node fully into view when it sits under the top bar or below the viewport (a focus moved
// with preventScroll, or Chrome leaving a partly visible element where it is). Instant: it follows focus.
// H10 (FIX4): an open notes drawer counts as part of the bottom inset, so nothing lands under it.
function labEnsureVisible(node, { bottomInset = 0 } = {}) {
  if (!node || !node.isConnected || typeof node.getBoundingClientRect !== 'function') return;
  if (typeof window === 'undefined' || !window.innerHeight) return;
  const rect = node.getBoundingClientRect();
  if (!rect.height && !rect.width) return;
  const top = labTopbarHeight();
  const drawer = node.closest && node.closest('#lab-notepad') ? 0 : labViewportInsets().bottom;
  if (rect.top >= top && rect.bottom <= window.innerHeight - Math.max(bottomInset, drawer)) return;
  if (drawer > bottomInset) return labRevealInBand(node);
  // 'instant': the site's html { scroll-behavior: smooth } would otherwise animate a focus move.
  if (typeof node.scrollIntoView === 'function') node.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}
// Every view: el('<div></div>') -> topbar('lab') -> <main> (one h1) -> setView(root).
function labView(main) {
  labInjectModuleCss();
  const root = el('<div></div>');
  root.appendChild(topbar('lab'));
  root.appendChild(main);
  setView(root);
  labWatchTopbar();
  labSyncHintsClass(); // a state patched through CortexLab.setState shows on the next view
  labSetTitle(main);
  // A re-render from browser Back can land with the restored scroll position below the focused h1.
  const h1 = main.querySelector('h1');
  if (h1 && typeof requestAnimationFrame === 'function')
    requestAnimationFrame(() => {
      if (document.activeElement === h1 && h1.getBoundingClientRect().bottom < labTopbarHeight()) window.scrollTo(0, 0);
    });
  labSaveStatus(!labSaveFailed);
  // Delegated, so links rendered after this point (refreshes, module tools) also stay in-app.
  main.addEventListener('click', event => {
    const link = event.target && event.target.closest ? event.target.closest('a[data-lab-go]') : null;
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return;
    event.preventDefault();
    labGo(Object.fromEntries(new URL(link.getAttribute('href'), location.origin).searchParams));
  });
  return main;
}
// Each lab view names itself in the tab and history (WCAG 2.4.2): "<h1> · Alzheimer's Histology Lab |
// Cortex Medical Academy"; the home h1 is the lab's name. `extra` prefixes a stepper's "Step n of N".
function labSetTitle(main, extra = '') {
  if (typeof document === 'undefined') return;
  const h1 = main && main.querySelector ? main.querySelector('h1') : null;
  const name = h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : '';
  const parts = [extra, name && name !== LAB_TITLE ? name : '', LAB_TITLE].filter(Boolean);
  document.title = `${parts.join(' · ')} | Cortex Medical Academy`;
}
function labAnnounce(text) {
  const live = document.querySelector('#lab-live');
  if (live) live.textContent = text;
}
const labHeaderHtml = (kicker, h1, lede) =>
  `<span class="label">${esc(LAB_TITLE)} &middot; ${esc(kicker)}</span>
   <h1>${esc(h1)}</h1>
   ${lede ? `<p class="sub lab-lede">${lede}</p>` : ''}
   <p role="status" id="lab-save-status" class="lab-save-status"></p>
   <div id="lab-live" role="status" aria-live="polite" class="lab-sr-only"></div>`;

/* ---------- pause / recover (conventions §3.10) ---------- */
const labHandles = new Set(); // view-level handles (microscope, notebook, designer mounts, listeners)
let labBenchGeneration = 0;
let labRenderGeneration = 0; // bumped here too, so an in-flight labRender never paints over another section
function labPauseTools() {
  labBenchGeneration++;
  labRenderGeneration++;
  labSpeechStop();
  labModeOverride = null; // a borrowed 3D mode ends with the visit
  for (const pause of LAB.pausers) {
    try {
      pause();
    } catch {
      /* One broken pauser must not block leaving the section. */
    }
  }
  for (const handle of [...labHandles]) {
    labHandles.delete(handle);
    try {
      if (typeof handle === 'function') handle();
      else if (handle && typeof handle.destroy === 'function') handle.destroy();
    } catch {
      /* already gone */
    }
  }
  if (LAB.bench) {
    const bench = LAB.bench;
    LAB.bench = null;
    try {
      bench.destroy();
    } catch {
      /* already gone */
    }
  }
  // The notebook's print view lives on <body>, outside #app, so a view swap alone would keep it; so
  // would the inert marks a modal side sheet put on <body>'s other children.
  document.querySelectorAll('.labn-print-view').forEach(node => node.remove());
  for (const node of document.querySelectorAll('[data-lab-inert]')) {
    node.removeAttribute('inert');
    node.removeAttribute('data-lab-inert');
  }
  if (document.body) document.body.classList.remove('labn-printing');
}
window.addEventListener('pagehide', () => labPauseTools());
window.addEventListener('study-storage-paused', () => {
  labPauseTools();
  labSaveStatus(false);
});
window.addEventListener('study-storage-recovered', () => {
  labSaveFailed = false;
  const status = document.querySelector('#lab-save-status');
  if (status) status.textContent = LAB_SAVED;
  if (location.pathname === new URL(labBasePath(), location.origin).pathname) renderLabEntry();
});

/* ---------- shared UI pieces ---------- */
// The label line on an output: its badge (data-lab-label = the engine label) plus a short meta text.
// `result` is an Outcome, an UncertaintyCard, a Comparison or anything else carrying `label`.
function labBanner(result, extra = '', { focusable = false } = {}) {
  const badge = labIsComparison(result) ? labBadgeForComparison(result) : labBadgeForOutcome(result);
  return `<p class="lab-banner"${focusable ? ' tabindex="-1"' : ''}>${badge}${extra ? ` <span class="lab-banner-meta">${esc(extra)}</span>` : ''}</p>`;
}
// Disclosure: a real button with aria-expanded controlling a panel. `body` is HTML or a Node builder.
// `key` is a stable id (data-lab-drawer) so a refresh can reopen the drawer; `ariaLabel` names it.
function labDisclosure(label, body, { open = false, cls = '', key = '', ariaLabel = '' } = {}) {
  const id = labUid('drawer');
  const wrap = el(
    `<div class="lab-disclosure ${esc(cls)}"${key ? ` data-lab-drawer="${esc(key)}"` : ''}><button type="button" class="lab-drawer-btn" aria-expanded="${open}" aria-controls="${id}"${ariaLabel ? ` aria-label="${esc(ariaLabel)}"` : ''}>${esc(label)}</button><div class="lab-drawer" id="${id}"${open ? '' : ' hidden'}></div></div>`
  );
  const panel = wrap.querySelector('.lab-drawer'),
    button = wrap.querySelector('button');
  let built = open;
  const fill = () => {
    if (built) return;
    built = true;
    if (typeof body === 'function') {
      const node = body();
      if (node) panel.appendChild(node);
    } else panel.innerHTML = body;
  };
  if (open) {
    built = false;
    fill();
  }
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    panel.hidden = expanded;
    if (!expanded) fill();
  });
  return wrap;
}
// Open drawers (data-lab-drawer) and chip details (data-lab-chips) survive a re-render: capture
// their stable keys before the swap, click them open again after it (drawers first: chips live inside).
function labCaptureOpen(root) {
  const drawers = [...root.querySelectorAll('[data-lab-drawer]')]
    .filter(wrap => wrap.querySelector('.lab-drawer-btn')?.getAttribute('aria-expanded') === 'true')
    .map(wrap => wrap.dataset.labDrawer);
  const chips = [];
  for (const group of root.querySelectorAll('[data-lab-chips]'))
    for (const chip of group.querySelectorAll('.lab-chip[aria-expanded="true"]'))
      chips.push(`${group.dataset.labChips}>${chip.textContent.trim()}`);
  return { drawers, chips };
}
// The bench's next refresh leaves this drawer closed even if it was open (ctx.closeUi).
function labCloseOnRefresh(ctx, key) {
  ctx.closeUi = [...(ctx.closeUi || []), key];
}
function labRestoreOpen(root, open) {
  if (!open) return;
  for (const wrap of root.querySelectorAll('[data-lab-drawer]')) {
    if (!open.drawers.includes(wrap.dataset.labDrawer)) continue;
    const button = wrap.querySelector('.lab-drawer-btn[aria-expanded="false"]');
    if (button) button.click();
  }
  for (const group of root.querySelectorAll('[data-lab-chips]'))
    for (const chip of group.querySelectorAll('.lab-chip[aria-expanded="false"]'))
      if (open.chips.includes(`${group.dataset.labChips}>${chip.textContent.trim()}`)) chip.click();
}
function labSourceHtml(lab, sourceId) {
  const s = lab.getSource(sourceId);
  if (!s) return `<li><code>${esc(sourceId)}</code> (not in the source registry)</li>`;
  const level = s.verified && s.verified.level ? `verified: ${s.verified.level}` : 'verification level unknown';
  return `<li><code>${esc(s.id)}</code> ${esc(s.citation || '')}${s.url ? ` <a href="${esc(s.url)}" target="_blank" rel="noopener">link<span class="lab-sr-only"> (opens in a new tab)</span></a>` : ''} <span class="lab-dim">(${esc(level)}; rights: ${esc(s.rights || 'unknown')}${s.system ? `; system: ${esc(s.system)}` : ''})</span></li>`;
}
function labClaimHtml(lab, claimId) {
  const c = lab.getClaim(claimId);
  if (!c) return `<div class="lab-claim"><code>${esc(claimId)}</code> is not in the claim registry.</div>`;
  return `<div class="lab-claim"><p><code>${esc(c.id)}</code> &ldquo;${esc(c.text)}&rdquo;</p><p class="lab-dim">Strength: ${esc(c.strength)}${c.system ? ` · system: ${esc(c.system)}` : ''}${c.transferable ? ` · ${esc(c.transferable)}` : ''}</p><ul class="lab-sources">${(c.sources || []).map(id => labSourceHtml(lab, id)).join('')}</ul></div>`;
}
// Chips that reveal claim text + source citations. One shared detail area per chip group.
function labClaimChips(lab, claimIds, { label = 'Claims', key = '' } = {}) {
  const ids = (claimIds || []).filter(Boolean);
  const wrap = el(
    `<div class="lab-chips" role="group" aria-label="${esc(label)}"${key ? ` data-lab-chips="${esc(key)}"` : ''}></div>`
  );
  if (!ids.length) {
    wrap.appendChild(el('<span class="lab-chip lab-chip-static lab-dim">no claim (placeholder)</span>'));
    return wrap;
  }
  const detail = el('<div class="lab-chip-detail" hidden></div>');
  detail.id = labUid('chipdetail');
  for (const id of ids) {
    const btn = el(
      `<button type="button" class="lab-chip" aria-expanded="false" aria-controls="${detail.id}">${esc(id)}</button>`
    );
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      wrap.querySelectorAll('.lab-chip[aria-expanded]').forEach(b => b.setAttribute('aria-expanded', 'false'));
      if (open) {
        detail.hidden = true;
        return;
      }
      btn.setAttribute('aria-expanded', 'true');
      detail.innerHTML = labClaimHtml(lab, id);
      detail.hidden = false;
    });
    wrap.appendChild(btn);
  }
  wrap.appendChild(detail);
  return wrap;
}
function labRuleHtml(lab, ruleId) {
  const r = lab.getRule(ruleId);
  if (!r) return `<div class="lab-claim"><code>${esc(ruleId)}</code> is not in the rule registry.</div>`;
  const caveats = (r.effect || []).filter(op => op.op === 'caveat').map(op => op.text);
  return `<div class="lab-claim"><p><strong>${esc(r.title || r.id)}</strong> <code>${esc(r.id)}</code></p>
    <p class="lab-dim">Basis: ${esc(r.basis)}${r.informational ? ' · informational (never evaluated by resolve)' : ''}${r.conditionalOn ? ` · conditional on ${esc(SilverLab.HYPOTHESIS_TEXT[r.conditionalOn] || r.conditionalOn)}` : ''}</p>
    ${caveats.length ? `<p><strong>Caveat.</strong> ${caveats.map(esc).join(' ')}</p>` : ''}
    <p><strong>Claims</strong></p>${(r.claims || []).map(id => labClaimHtml(lab, id)).join('') || '<p class="lab-dim">none</p>'}</div>`;
}
function labRuleChips(lab, ruleIds, { label = 'Rules applied' } = {}) {
  const ids = (ruleIds || []).filter(Boolean);
  const wrap = el(`<div class="lab-chips" role="group" aria-label="${esc(label)}"></div>`);
  if (!ids.length) {
    wrap.appendChild(el('<span class="lab-chip lab-chip-static lab-dim">none</span>'));
    return wrap;
  }
  const detail = el('<div class="lab-chip-detail" hidden></div>');
  detail.id = labUid('ruledetail');
  for (const id of ids) {
    const rule = lab.getRule(id);
    const btn = el(
      `<button type="button" class="lab-chip lab-chip-rule" aria-expanded="false" aria-controls="${detail.id}" title="${esc(rule ? rule.title : id)}">${esc(id)}</button>`
    );
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      wrap.querySelectorAll('.lab-chip[aria-expanded]').forEach(b => b.setAttribute('aria-expanded', 'false'));
      if (open) {
        detail.hidden = true;
        return;
      }
      btn.setAttribute('aria-expanded', 'true');
      detail.innerHTML = labRuleHtml(lab, id);
      detail.hidden = false;
    });
    wrap.appendChild(btn);
  }
  wrap.appendChild(detail);
  return wrap;
}
function labSelectHtml(id, name, options, value, { labelText, extraClass = '' } = {}) {
  return `<label class="lab-field ${esc(extraClass)}"><span>${esc(labelText || name)}</span><select id="${esc(id)}" name="${esc(name)}">${options
    .map(o => `<option value="${esc(o.value)}"${o.value === value ? ' selected' : ''}>${esc(o.text)}</option>`)
    .join('')}</select></label>`;
}
/* ---------- outcome / uncertainty card / state tables ---------- */
function labStateTable(state, { caption = 'Per-site schematic state' } = {}) {
  const rows = SilverLab.SITE_CLASSES.map(site => {
    const s = (state && state[site]) || {};
    return `<tr><th scope="row">${esc(labSiteText(site))}</th><td>${esc(labOrdinal(s.ionicBound))}</td><td>${esc(labOrdinal(s.nuclei))}</td><td>${esc(labOrdinal(s.deposit))}</td><td>${esc(s.ratePhase || 'not reached')}</td></tr>`;
  }).join('');
  return `<div class="lab-table-wrap"><table class="lab-table"><caption>${esc(caption)} (ordinal positions, not quantities)</caption><thead><tr><th scope="col">Site</th><th scope="col">Ionic bound</th><th scope="col">Nuclei</th><th scope="col">Deposit</th><th scope="col">Rate phase</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function labFrameView(lab, frame, index, total) {
  const ev = frame.event || {};
  // The event line in the export's words (UX-POLISH): "Frame 4 of 9 · 4. Ammoniacal silver and develop".
  const node = el(`<div class="lab-frame">
    <p class="lab-frame-head"><strong>Frame ${index + 1} of ${total}</strong> · ${esc(ev.seq)}. ${esc(labEventText(ev))}</p>
    <p>Steps done so far: ${esc(frame.stepsDone.length ? [...new Set(frame.stepsDone)].map(labStepTitleById).join(', ') : 'none')}</p>
    <p>Deviations so far: ${esc(frame.deviationsSoFar.length ? labDeviationsText(frame.deviationsSoFar) : 'none')}</p>
    <div class="lab-rules-host"></div>
    ${labStateTable(frame.state, { caption: `State after seq ${ev.seq}` })}
  </div>`);
  node.querySelector('.lab-rules-host').appendChild(labRuleChips(lab, frame.rulesFired, { label: 'Rules fired' }));
  return node;
}
/* ---------- curves (M3): inline SVG + a table, model-scale words only ---------- */
// The plot, its legend and one plain line stay in view; the engine's note, system line, caveats and
// the claim / rule chips sit under Why? (PLAN-ALZ-LAB-SIMPLIFY §3.3, §4). `stepNumber` names the step
// in the chart's accessible name so two curve steps never share one.
function labCurvesFigure(lab, curves, { stepNumber = null } = {}) {
  const uid = labUid('curves');
  const simulated = LAB_WORDS.simulated;
  const where = stepNumber ? ` for step ${stepNumber}` : '';
  const W = 620,
    H = 300,
    L = 92,
    R = 18,
    T = 26,
    B = 54,
    pw = W - L - R,
    ph = H - T - B,
    n = curves.points.length;
  const x = i => (L + (pw * i) / Math.max(1, n - 1)).toFixed(1);
  const y = v => (T + ph - (ph * v) / 4).toFixed(1);
  const line = key => curves.points.map((p, i) => `${x(i)},${y(p[key])}`).join(' ');
  const grid = SilverLab.ORDINAL_TEXT.map(
    (word, v) =>
      `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="lab-curve-grid"/><text x="${L - 8}" y="${Number(y(v)) + 4}" text-anchor="end" class="lab-curve-tick">${esc(word)}</text>`
  ).join('');
  const ep = curves.endpointIndex;
  const hasMarker = ep >= 0 && ep < n;
  const marker = hasMarker
    ? `<line x1="${x(ep)}" x2="${x(ep)}" y1="${T}" y2="${T + ph}" class="lab-curve-marker"/><text x="${Number(x(ep)) + 6}" y="${T + 12}" class="lab-curve-label">development stops</text>`
    : '';
  const rows = curves.points
    .map(
      (p, i) =>
        `<tr${hasMarker && i === ep ? ' class="lab-row-marked"' : ''}><th scope="row">Position ${i + 1}${hasMarker && i === ep ? ' (development stops)' : ''}</th><td>${esc(labOrdinal(p.binding))}</td><td>${esc(labOrdinal(p.accumulated))}</td><td>${esc(labOrdinal(p.rate))}</td></tr>`
    )
    .join('');
  const figure = el(`<figure class="lab-curves">
    ${labBanner(curves, 'shapes only')}
    <div class="lab-curves-plot" role="region" tabindex="0" aria-label="Curves chart${esc(where)} (${esc(simulated)}). The table below lists the same positions.">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${uid}-title ${uid}-desc" aria-describedby="${uid}-table" class="lab-curves-svg">
      <title id="${uid}-title">Curves${esc(where)}: bound silver, built-up silver and how fast silver builds up. ${esc(simulated)}</title>
      <desc id="${uid}-desc">${esc(simulated)}. Three shapes on the ${esc(LAB_WORDS.modelScale)} (none, trace, low, moderate, high) from earlier to later, with no time units and not drawn from any tissue. Solid line: bound silver; dashed: built-up silver; dotted: how fast silver builds up. ${hasMarker ? 'A dashed red line marks where development stops.' : 'No marker: the development time is not set.'}</desc>
      ${grid}
      <polyline points="${line('binding')}" class="lab-curve lab-curve-binding"/>
      <polyline points="${line('accumulated')}" class="lab-curve lab-curve-accumulated"/>
      <polyline points="${line('rate')}" class="lab-curve lab-curve-rate"/>
      ${marker}
      <text x="${L + pw / 2}" y="${H - 12}" text-anchor="middle" class="lab-curve-axis">earlier to later (no time units)</text>
      <text x="14" y="${T + ph / 2}" text-anchor="middle" transform="rotate(-90 14 ${T + ph / 2})" class="lab-curve-axis">${esc(LAB_WORDS.modelScale)}</text>
    </svg></div>
    <ul class="lab-curve-legend" aria-label="Line styles"><li><span class="lab-legend-binding" aria-hidden="true"></span> solid: bound silver</li><li><span class="lab-legend-accumulated" aria-hidden="true"></span> dashed: built-up silver</li><li><span class="lab-legend-rate" aria-hidden="true"></span> dotted: how fast silver builds up</li></ul>
    <p class="lab-curves-note">Shapes only: no times, temperatures or amounts, and not drawn from any tissue.</p>
    <div class="lab-result-links" data-lab-slot="why"></div>
    <details class="lab-details"><summary>Same positions as a table</summary><div class="lab-table-wrap"><table class="lab-table" id="${uid}-table"><caption>The three curves on the ${esc(LAB_WORDS.modelScale)} (shapes only)</caption><thead><tr><th scope="col">Position</th><th scope="col">Bound silver</th><th scope="col">Built-up silver</th><th scope="col">How fast it builds up</th></tr></thead><tbody>${rows}</tbody></table></div></details>
  </figure>`);
  const why = labDisclosure(
    LAB_WORDS.why,
    () => {
      const body = el(`<div class="lab-why-body">
        <p>${esc(curves.note)} ${esc(curves.system)}</p>
        ${labHeading(3, LAB_WORDS.keepInMind)}<ul class="lab-caveats">${labList(curves.caveats)}</ul>
      </div>`);
      body.appendChild(
        labSourcesDisclosure(lab, `why-curves-sources-${stepNumber || 0}`, () => {
          const box = el('<div class="lab-sources-body lab-chips-host"></div>');
          box.appendChild(labClaimChips(lab, curves.claims, { label: 'Curve claims' }));
          box.appendChild(labRuleChips(lab, curves.rulesApplied, { label: 'Curve rules' }));
          return box;
        })
      );
      return body;
    },
    { key: `why:curves:${stepNumber || 0}`, cls: 'lab-why' }
  );
  why.dataset.labWhy = 'curves';
  figure.querySelector('[data-lab-slot="why"]').appendChild(why);
  return figure;
}

/* ---------- safety gate ---------- */
// The clicked button leaves with the old card; unless the caller focused something, land on the
// replacement button (or the card heading), never on <body>.
function labFocusAfterGate() {
  const active = document.activeElement;
  if (active && active !== document.body && active.isConnected) return;
  const target = ['#lab-safety-reset', '#lab-safety-ack', '#lab-safety-h']
    .map(sel => document.querySelector(sel))
    .find(Boolean);
  if (target && target.focus) target.focus({ preventScroll: true });
}
// Every safety note but the disclaimer: the course procedure's notes (§11.7: nothing waits on anyone).
const labSafetyNotes = lab => (lab.content.safety.items || []).filter(h => h.kind !== 'disclaimer');
// The notes, titles plus the full sentence. `details`: each sentence sits behind its title (the How
// this lab works page keeps its word budget).
function labSafetyNotesHtml(lab, { details = false } = {}) {
  return `<ul class="lab-safety-notes${details ? ' lab-safety-notes-details' : ''}">${labSafetyNotes(lab)
    .map(h =>
      details
        ? `<li><details><summary>${esc(h.title)}</summary><p>${esc(h.text)}</p></details></li>`
        : `<li><strong>${esc(h.title)}.</strong> ${esc(h.text)}</li>`
    )
    .join('')}</ul>`;
}
// The one safety sentence the gate and the About page share (§11.7): the notes follow the course
// procedure; waste goes to the silver waste container the lab's EHS procedure names; every reagent's
// safety data sheet is read before the first run.
const LAB_SAFETY_LINE =
  "Hazards, personal protective equipment (PPE) and fume-hood steps follow the course procedure. Waste goes to the silver waste container the lab's EHS procedure names, and every reagent's safety data sheet (SDS) is read before the first run.";
// One compact card before the bench: three lines, the notes behind a disclosure, one button. Once
// acknowledged it shrinks to one "Safety notes" link in the bench header whose drawer holds the date,
// the notes and "Review again". The stored semantics are unchanged: an ISO timestamp in
// safetyAcknowledgedAt, cleared by Review again.
function labSafetyCard(lab, onChange, { ackText = 'I understand, open the bench' } = {}) {
  const disclaimer = lab.getHazard('H-disclaimer');
  const count = labSafetyNotes(lab).length;
  const ack = LAB_STATE.safetyAcknowledgedAt;
  if (ack) {
    const body = el(`<div class="lab-safety-drawer">
      <p class="lab-ack">Safety notes acknowledged on ${esc(labFmtDay(ack))}.</p>
      ${labSafetyNotesHtml(lab)}
      <p class="lab-safety-again"><button type="button" class="lab-linkbtn" id="lab-safety-reset">Review again</button></p>
    </div>`);
    body.querySelector('#lab-safety-reset').addEventListener('click', () => {
      LAB_STATE.safetyAcknowledgedAt = null;
      labSave();
      onChange?.();
      labFocusAfterGate();
    });
    const card = el('<div class="lab-safety" data-lab-safety="acknowledged"></div>');
    card.appendChild(
      labDisclosure('Safety notes', () => body, { key: 'safety-notes', cls: 'lab-safety-notes-disclosure' })
    );
    return card;
  }
  const card = el(`<section class="lab-safety" aria-labelledby="lab-safety-h" data-lab-safety="open">
      <h2 id="lab-safety-h" tabindex="-1">Before you start</h2>
      <ul class="lab-safety-lines">
        <li><strong>${esc(disclaimer ? disclaimer.title : 'Educational software, not qualification')}</strong> to perform hazardous procedures independently.</li>
        <li>${esc(LAB_SAFETY_LINE)}</li>
        <li>In the real lab, the approved protocols and the lab's own rules govern.</li>
      </ul>
      <div data-lab-slot="notes"></div>
      <div class="lab-row"><button type="button" class="btn btn-solid" id="lab-safety-ack">${esc(ackText)}</button></div>
    </section>`);
  card.querySelector('[data-lab-slot="notes"]').replaceWith(
    labDisclosure(`Safety notes (${count})`, labSafetyNotesHtml(lab), {
      key: 'safety-notes-gate',
      cls: 'lab-safety-notes-disclosure',
    })
  );
  card.querySelector('#lab-safety-ack').addEventListener('click', () => {
    LAB_STATE.safetyAcknowledgedAt = labNow();
    labSave();
    labAnnounce('Safety notes acknowledged.');
    onChange?.();
    labFocusAfterGate();
  });
  return card;
}

/* ---------- 3D capability ---------- */
// Probed once per page: every probe context counts against the browser's WebGL context budget.
let labWebgl2Cache = null;
function labWebgl2() {
  if (labWebgl2Cache !== null) return labWebgl2Cache;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext && canvas.getContext('webgl2');
    labWebgl2Cache = !!gl;
    const lose = gl && gl.getExtension && gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  } catch {
    labWebgl2Cache = false;
  }
  return labWebgl2Cache;
}
const labOffline = () => /[?&]offline=/.test(location.search) || !!window.CortexOffline?.selected?.();
function lab3dBlockedReason() {
  if (labOffline()) return 'The 3D bench is online-only; this is an offline session. List mode has the same steps.';
  if (!labWebgl2()) return 'This browser cannot run the 3D bench (no WebGL2). List mode has the same steps.';
  return null;
}
function labMedia(query) {
  try {
    return !!(window.matchMedia && window.matchMedia(query).matches);
  } catch {
    return false;
  }
}
const labSystemReducedMotion = () => labMedia('(prefers-reduced-motion: reduce)');
function labPrefersReducedMotion() {
  return LAB_STATE.settings.reducedMotion === 'on' || labSystemReducedMotion();
}
// 3D is the default bench at every width (Kevin, 2026-10-13; was: phones kept List, contract §8.4 #3).
// A student's own switch is saved (modeChosen); the home intro on a phone that chose List still borrows
// 3D for the visit only and gives List back when the intro ends (F7).
const labNarrow = () => labMedia('(max-width: 560px)');
let labModeOverride = null;
const labCurrentMode = () => (lab3dBlockedReason() ? 'list' : labModeOverride || LAB_STATE.mode);
/* ---------- activities: cards, progress strip (home + modules views) ---------- */
const labModuleNumber = mod => mod.order ?? mod.week;
// Read-only: labModuleProgress() would create an empty record for every module it looks at.
const labModuleIsDone = mod => !!(LAB_STATE.moduleProgress[mod.id] && LAB_STATE.moduleProgress[mod.id].done);
const labGoalLead = mod => {
  const goal = String(mod.goal || '');
  return goal.split(/(?<=\.)\s/)[0] || goal;
};
const LAB_CHECKLIST_DONE = 'Checklist complete (not graded)';
// A card is a list item whose title link covers the whole card (one link per card, named by its title).
function labModuleCard(mod) {
  const progress = LAB_STATE.moduleProgress[mod.id] || { fields: {}, done: false };
  const required = mod.steps.filter(s => s.required && s.field);
  const filled = required.filter(s => String((progress.fields || {})[s.field] || '').trim()).length;
  const status = progress.done
    ? `<span aria-hidden="true">✓</span> ${LAB_CHECKLIST_DONE}`
    : required.length
      ? `${filled} of ${required.length} required answer${required.length === 1 ? '' : 's'} written`
      : 'No required answers';
  return `<li class="lab-card lab-module-card${progress.done ? ' lab-module-done' : ''}">
    <span class="label">Activity ${esc(labModuleNumber(mod))}</span>
    <h2 class="lab-card-title"><a data-lab-go href="${esc(labUrl({ view: `module:${mod.id}` }))}">${esc(mod.title)}</a></h2>
    <p class="lab-card-text">${esc(labGoalLead(mod))}</p>
    <p class="lab-module-status">${status}</p>
  </li>`;
}
// Seven segments, one link per activity, and the count in words; the next unfinished one is current.
function labProgressStrip(lab) {
  const modules = lab.listModules();
  const done = modules.filter(labModuleIsDone).length;
  const next = modules.find(mod => !labModuleIsDone(mod));
  const segments = modules
    .map(mod => {
      const isDone = labModuleIsDone(mod);
      const name = `Activity ${labModuleNumber(mod)}: ${mod.title}, ${isDone ? 'checklist complete' : 'not done yet'}`;
      return `<li><a class="lab-progress-seg${isDone ? ' lab-progress-done' : ''}" data-lab-go href="${esc(labUrl({ view: `module:${mod.id}` }))}" aria-label="${esc(name)}"${mod === next ? ' aria-current="step"' : ''}><span aria-hidden="true">${esc(labModuleNumber(mod))}${isDone ? '<span class="lab-progress-check">✓</span>' : ''}</span></a></li>`;
    })
    .join('');
  return `<nav class="lab-progress" id="lab-progress-strip" aria-labelledby="lab-progress-text">
    <p class="lab-progress-text" id="lab-progress-text">${done} of ${modules.length} activities done</p>
    <ol class="lab-progress-segs">${segments}</ol>
  </nav>`;
}
// The one honesty line on the home and activities screens; the explanation lives on ?view=about.
const labHonestyLine = () =>
  `<p class="lab-honesty">Everything here is a simulation. <a data-lab-go href="${esc(labUrl({ view: 'about' }))}">${esc(LAB_WORDS.howItWorks)}</a></p>`;
// The intro is every clip scene before the dive (contract §7.1); its length comes from clip.json's
// durationMs hints, rounded to five seconds (27 s reads "25-second"; ten-second rounding promised 30
// for a clip that ends in about 25, F12), so the label never promises a length the clip does not have.
function labIntroLabel(lab) {
  const clip = labClip(lab);
  const items = clip && Array.isArray(clip.items) ? clip.items.filter(labIsObj) : [];
  const at = items.findIndex(scene => scene.id === LAB_CLIP_DIVE_SCENE);
  const ms = (at < 0 ? items : items.slice(0, at)).reduce((sum, scene) => sum + (Number(scene.durationMs) || 0), 0);
  const seconds = Math.round(ms / 5000) * 5;
  return seconds > 0 ? `Watch the ${seconds}-second intro` : 'Watch the intro';
}

/* ---------- home: three cards, a report link, the progress strip, one honesty line ---------- */
function labRenderHome(lab) {
  // FREE-1: one page, one button. The intro clip, the activities, the designer and the report are
  // reached from the bench's nav line (labNavHtml); the activity progress strip lives on ?view=modules.
  const main = el(`<main class="panel lab-page lab-view-home">
    ${labHeaderHtml(labStatusText(), LAB_TITLE, 'Practice the modified Bielschowsky silver stain step by step, or take the free bench and mix anything to see what happens. Finished runs can be compared with real slides from open-access studies.')}
    ${LAB.stateError ? `<aside class="course-notice" role="status"><strong>Saved state refused.</strong><p>${esc(LAB.stateError)}</p></aside>` : ''}
    <div class="lab-home-intro">
      <p>You get a virtual bench with a practice specimen on a slide. Practice the procedure does the course steps in order with the standard settings; the free bench takes any jar in any order with any mix, and every dip says what happened, even when nothing did.</p>
      <p>Anything can change: a bath time, the developer, the ammonia, a skipped step, or several at once. The teaching model draws what might happen, says plainly when it has no rule for a change, and never pretends to be a measurement.</p>
    </div>
    <div class="lab-home-enter"><a class="btn btn-solid lab-enter" id="lab-enter" data-lab-go href="${esc(labUrl({ view: 'bench' }))}">Enter the lab</a></div>
    ${labHonestyLine()}
  </main>`);
  labView(main);
}
// The bench's nav line (FREE-1): the intro clip (or the text intro where 3D cannot run), the activities,
// the designer, the report and How this lab works. The intro link keeps the ids the home cards had.
function labNavHtml(lab) {
  const intro = lab3dBlockedReason()
    ? `<a id="lab-intro-text" data-lab-go href="${esc(labUrl({ view: 'intro' }))}">Read the intro</a>`
    : `<a id="lab-clip-watch" data-lab-go href="${esc(labUrl({ view: 'bench', mode: '3d', intro: '1' }))}">${esc(labIntroLabel(lab))}</a>`;
  const flags = labFlags();
  return `<nav class="lab-nav" aria-label="Lab pages">${intro}${flags.activities ? `<a data-lab-go href="${esc(labUrl({ view: 'modules' }))}">Activities</a>` : ''}${flags.designer ? `<a id="lab-home-designer" data-lab-go href="${esc(labUrl({ view: 'designer' }))}">Design an experiment</a>` : ''}${flags.report ? `<a data-lab-go href="${esc(labUrl({ view: 'notebook' }))}">My report</a>` : ''}<a data-lab-go href="${esc(labUrl({ view: 'about' }))}">${esc(LAB_WORDS.howItWorks)}</a></nav>`;
}

/* ---------- the intro as text (?view=intro): for devices without WebGL2 or offline sessions ---------- */
function labRenderIntroText(lab) {
  const main = el(`<main class="panel lab-page lab-view-intro">
    ${labHeaderHtml('Intro', 'The intro, as text', 'The same scenes the 3D clip shows, written out. Everything in them is a drawing, not real tissue. Finished runs can be compared with real slides from open-access studies.')}
    ${labSpeechSupported() ? '<p class="lab-row"><button type="button" class="btn" id="lab-intro-read">Read it aloud</button></p>' : ''}
    ${labClipTextHtml(lab, { level: 2, id: 'lab-intro-text-body' })}
    <div class="endbtns lab-endbtns"><a class="btn btn-solid" data-lab-go href="${esc(labUrl({ view: 'bench' }))}">Run the stain</a><a class="btn" data-lab-go href="${esc(labUrl())}">Back to the lab</a></div>
  </main>`);
  labView(main);
  // BENCH-3: the whole intro, read by the browser's voice; the button stops it too.
  const read = main.querySelector('#lab-intro-read');
  if (read)
    read.addEventListener('click', () => {
      if (read.dataset.labReading === '1') {
        labSpeechStop();
        read.dataset.labReading = '0';
        read.textContent = 'Read it aloud';
        return;
      }
      const text = [...main.querySelectorAll('.lab-clip-text [data-lab-scene]')]
        .map(item => item.textContent.trim())
        .join(' ');
      const was = LAB_STATE.settings.readAloud;
      LAB_STATE.settings.readAloud = true;
      labSpeak(text, { force: true });
      LAB_STATE.settings.readAloud = was;
      read.dataset.labReading = '1';
      read.textContent = 'Stop reading';
    });
}

/* ---------- How this lab works (?view=about): the labels explained once, at most 350 words ---------- */
function labRenderAbout(lab) {
  const count = labSafetyNotes(lab).length;
  const disclaimer = lab.getHazard('H-disclaimer');
  const label = (badge, text) => `<div><dt>${badge}</dt><dd>${text}</dd></div>`;
  const main = el(`<main class="panel lab-page lab-view-about">
    ${labHeaderHtml('About', LAB_WORDS.howItWorks, '')}
    <section class="lab-about-section" aria-labelledby="lab-about-what-h">
      <h2 id="lab-about-what-h">What this is</h2>
      <p>A practice bench for the modified Bielschowsky silver stain studied in UTSA NDRB 2903. A small rule model moves each structure along one scale: none, trace, low, moderate, high. These are positions, not amounts. Each effect comes from a written rule that lists the claims it leans on. Several rules are assumptions of the model (the background rule has no source for this stain), and no step size comes from data. It is not a measurement, not a validated predictor and not qualification for any lab procedure. Finished runs can be compared with real slides from open-access studies, credited under each. Darker does not mean more protein, more pathology or a better method.</p>
    </section>
    <section class="lab-about-section" aria-labelledby="lab-about-labels-h">
      <h2 id="lab-about-labels-h">What the labels mean</h2>
      <dl class="lab-about-labels">
        ${label(labBadge('simulated'), 'A drawing or table from the teaching model. Never report it as an observation.')}
        ${label(labBadge('not-modeled'), 'No sourced rule covers this change, so there is no picture. The note says what would be needed.')}
        ${label(labBadge('in-progress'), 'The run is not finished: some steps are still to do.')}
        ${label(labBadge('reference-none'), 'A real photomicrograph of a published slide. Real slides from open-access studies appear in the microscope when one matches the run, credited under each; it is never your run.')}
        ${label(`<strong class="lab-about-reserved" data-lab-label="${esc(SilverLab.LABELS.VALIDATED)}">${esc(SilverLab.LABEL_TEXT[SilverLab.LABELS.VALIDATED])}</strong>`, 'Never shown: no output has earned it. Earning it would require paired conditions with raw images, specimen metadata, biological and technical replication across operators, days and reagent lots, expert annotations and held-out validation by specimen or run.')}
      </dl>
    </section>
    <section class="lab-about-section" id="lab-about-safety" aria-labelledby="lab-about-safety-h">
      <h2 id="lab-about-safety-h">Safety notes</h2>
      <p><strong>${esc(disclaimer ? disclaimer.title : 'Educational software, not qualification')}</strong> to perform hazardous procedures independently. In the real lab, the approved protocols and the lab's own rules govern. The ${count} notes below follow the course procedure; waste goes to the silver waste container the lab's EHS procedure names, and every reagent's safety data sheet is read before the first run.</p>
      ${labSafetyNotesHtml(lab, { details: true })}
    </section>
    <div class="endbtns lab-endbtns"><a class="btn" data-lab-go href="${esc(labUrl())}">Back to the lab</a></div>
  </main>`);
  labView(main);
}

/* ---------- weekly activities list ---------- */
function labRenderModules(lab) {
  const main = el(`<main class="panel lab-page lab-view-modules">
    ${labHeaderHtml('Activities', 'Weekly activities', 'Seven short activities, one per week of the course. Your answers stay in this browser; nothing here is graded.')}
    ${labProgressStrip(lab)}
    <ol class="lab-cards lab-module-grid">${lab.listModules().map(labModuleCard).join('')}</ol>
    ${labHonestyLine()}
    <div class="endbtns lab-endbtns"><a class="btn" data-lab-go href="${esc(labUrl())}">Back to the lab</a></div>
  </main>`);
  labView(main);
}
function labNotBuilt(view) {
  const main = el(`<main class="panel lab-page lab-view-notice lab-notice">
    ${labHeaderHtml(labStatusText(), 'This part of the lab is not available.', view ? `The view <code>${esc(view)}</code> is not part of the lab, or its module has not shipped. Nothing you saved has changed.` : 'The requested page is not part of the lab. Nothing you saved has changed.')}
    <div class="endbtns lab-endbtns"><a class="btn btn-solid" data-lab-go href="${esc(labUrl())}">Back to the lab</a></div>
  </main>`);
  labView(main);
}
function labLoadFailed(error) {
  const main = el(`<main class="panel lab-page lab-view-notice lab-notice">
    ${labHeaderHtml('Could not load', 'The lab could not load.', `Your saved work has been kept. ${esc(LAB.loadError || (error && error.message) || 'The lab content did not download.')}`)}
    <div class="endbtns lab-endbtns"><button type="button" class="btn btn-solid" id="lab-retry">Retry</button><a class="btn" data-lab-go href="${esc(labUrl())}">Back to the lab</a></div>
  </main>`);
  main.querySelector('#lab-retry').addEventListener('click', () => renderLabEntry());
  labView(main);
}

/* ---------- bench: plain words for runs, parameters and steps (PLAN-ALZ-LAB-SIMPLIFY §4) ---------- */
// Engine paths and enum values stay in All settings, History, Why? / Sources and the export; every
// other bench surface names a parameter and its value with these words.
const LAB_VALUE_WORDS = {
  ENDPOINTS: { early: 'shorter', 'sop-default': 'standard', extended: 'longer', unspecified: LAB_WORDS.notSet },
  STRENGTHS: { weak: 'weaker', 'sop-default': 'standard', strong: 'stronger', unspecified: LAB_WORDS.notSet },
  CONDITIONS: { 'sop-default': 'standard', deviated: LAB_WORDS.changed, unspecified: LAB_WORDS.notSet },
  // §11.5: the course procedure adds ammonia "while stirring. Only add enough to dissolve the dark solid".
  AMMONIA: {
    'just-clear': 'just clear + 2 drops (procedure)',
    extra: 'extra drops',
    cloudy: 'left cloudy, not filtered',
  },
};
const LAB_PARAM_NAMES = {
  pretreatment: 'pretreatment',
  toning: 'gold toning',
  thiosulfate: 'thiosulfate',
  specimenId: 'specimen',
  method: 'method',
};
const labLeafOf = path => LAB_PARAM_LEAVES.find(leaf => leaf.path === path) || null;
const labIsParamPath = path => !!labLeafOf(path) || Object.prototype.hasOwnProperty.call(LAB_PARAM_NAMES, path);
const labParamName = path => (labLeafOf(path) ? labLeafOf(path).label.toLowerCase() : LAB_PARAM_NAMES[path] || path);
function labValueText(path, value) {
  const leaf = labLeafOf(path);
  if (leaf) return LAB_VALUE_WORDS[leaf.values][value] || String(value);
  if (path === 'toning' || path === 'thiosulfate') return value === true || value === 'true' ? 'performed' : 'skipped';
  if (path === 'pretreatment') {
    if (value === 'none') return 'none';
    const probes = (LAB.lab && LAB.lab.getMethod(LAB_RUNNABLE_METHOD)?.probes) || [];
    const at = probes.findIndex(p => p.id === value);
    return `probe ${at >= 0 ? at + 1 : '?'}`;
  }
  return String(value);
}
const labParamPhrase = (path, value) => `${labParamName(path)}: ${labValueText(path, value)}`;
// One change as a verb phrase: "changes the washes", "changes the development time to longer",
// "skips gold toning" (KB-24: never "changes washes: changed").
function labChangeClause(path, value) {
  const leaf = labLeafOf(path);
  if (leaf) {
    const noun = leaf.noun || leaf.label.toLowerCase();
    if (value === 'unspecified') return `leaves the ${noun} not set`;
    if (value === 'sop-default') return `keeps the ${noun} standard`;
    if (value === 'deviated') return `changes the ${noun}`;
    return `changes the ${noun} to ${labValueText(path, value)}`;
  }
  if (path === 'toning' || path === 'thiosulfate')
    return `${value === true || value === 'true' ? 'does' : 'skips'} ${LAB_PARAM_NAMES[path]}`;
  if (path === 'pretreatment')
    return value === 'none' ? 'uses no pretreatment' : `adds pretreatment ${labValueText(path, value)}`;
  return `changes the ${labParamName(path)}`;
}
// Engine sentences name a parameter as `path = value`; students read "this change (washes: changed)".
const labPlainEngineText = text =>
  String(text || '').replace(/\b([a-zA-Z]+(?:\.[a-z]+)?)\s*=\s*([a-z0-9-]+)/g, (all, path, value) =>
    labIsParamPath(path) ? `this change (${labParamPhrase(path, value)})` : all
  );
// Leaves of `to` that differ from `from`, as a set-params patch and its paths (engine order).
function labParamDiff(from, to) {
  const patch = {},
    paths = [];
  for (const [path, value] of labLeaves(to)) {
    if (labGetPath(from, path) === value) continue;
    labSetPath(patch, path, value);
    paths.push(path);
  }
  return { patch, paths };
}
// What a run (or a draft) changes from the procedure, in plain words, named like the export and a copy's
// name ("Developer strength: weaker", CortexLab.paramText; TONING).
// `flags: false` (a free run, MODE-FIX-shell-2): the toning / thiosulfate flags are jars on the free bench,
// not settings (§11.3), so an older save's false never prints "Gold toning: skipped".
function labProtocolText(lab, params, methodId = LAB_RUNNABLE_METHOD, { flags = true } = {}) {
  const method = lab.getMethod(methodId);
  if (method && labIsCompareOnly(method)) return `${method.title} (compare only)`;
  const paths = labParamDiff(SilverLab.DEFAULT_PARAMS, params || {}).paths.filter(
    p => flags || !LAB_FLAG_PATHS.includes(p)
  );
  return paths.length ? paths.map(p => labParamText(p, labGetPath(params, p))).join('; ') : LAB_WORDS.standard;
}
const LAB_FLAG_PATHS = Object.freeze(['toning', 'thiosulfate']);
const labStepTitle = step => (step ? step.studentTitle || step.title || step.id : '');
// A run whose specimen id is no longer registered (an older or damaged save) never shows the raw id.
const LAB_UNKNOWN_SPECIMEN = 'unknown specimen';
const labSpecimenName = specimen => (specimen ? specimen.studentLabel || specimen.label || specimen.id : '');
const labSpecimenNote = specimen => (specimen ? specimen.studentNote || specimen.notes || '' : '');
function labStepById(lab, id) {
  const method = lab.getMethod(LAB_RUNNABLE_METHOD);
  return (method && method.steps.find(s => s.id === id)) || null;
}
// The steps a run's settings skip (ENGINE-14): gold toning when params.toning is false, thiosulfate when
// params.thiosulfate is false. The run does not need them and the bench never offers them; the course
// procedure says what the skip leaves (§11.5, R-model-10).
const LAB_SKIP_FLAGS = Object.freeze({ 'gold-toning': 'toning', 'sodium-thiosulfate': 'thiosulfate' });
const LAB_SKIPPED_WORDS = 'Skipped (your setting)';
const LAB_SKIPPED_SHEET = 'Skipped by this run’s setting';
function labSkippedSteps(run) {
  if (labIsFree(run)) return new Set(); // the free bench skips nothing: toning and thiosulfate are jars (§11.3)
  const params = run && labIsObj(run.params) ? run.params : {};
  return new Set(Object.keys(LAB_SKIP_FLAGS).filter(step => params[LAB_SKIP_FLAGS[step]] === false));
}
// The procedure steps of the run's method (all of them, for the lists), which are done (distinct), which
// its settings skip, and over the steps the run needs: the count, the total and the next step in
// procedure order (the first needed one not yet done; out-of-order work is the engine's to record).
function labStepProgress(lab, run) {
  const method = run ? lab.getMethod(run.method) : lab.getMethod(LAB_RUNNABLE_METHOD);
  const steps = method && !labIsCompareOnly(method) ? [...method.steps].sort((a, b) => a.order - b.order) : [];
  // A free run's dips count by jar (§13.3: a procedure jar's id is its step), so its row reads done.
  const done = new Set((run ? run.events : []).map(labEventJar).filter(Boolean));
  const skipped = labSkippedSteps(run);
  const needed = steps.filter(s => !skipped.has(s.id));
  return {
    steps,
    needed,
    done,
    skipped,
    count: needed.filter(s => done.has(s.id)).length,
    total: needed.length,
    next: needed.find(s => !done.has(s.id)) || null,
  };
}
const labRunNumber = run => {
  const match = /^run-(\d+)$/.exec(run.id);
  return match ? match[1] : run.id;
};
// "Run 3 · first": module runs read "Activity 2: …", and the activities' default-run labels (data that
// keys saved runs, so it cannot change) and older pair labels are put in plain words.
function labRunTitle(run) {
  if (!run) return '';
  const label = String(run.label || '')
    .replace(/^M(\d+): /, 'Activity $1: ')
    .replace(/\bSOP defaults\b/g, 'standard')
    .replace(/\bschematic\b/g, 'picture')
    .replace(/\(resolves to an uncertainty card\)/g, `(comes back ${LAB_WORDS.notModeled})`)
    .replace(
      /\b(Early|Extended) (impregnation|development) endpoint\b/g,
      (all, when, what) => `${when === 'Early' ? 'Shorter' : 'Longer'} ${what} time`
    )
    .replace(/\bextended development\b/g, 'longer development time')
    .replace(
      /^pair of run-(\d+): ([\w.]+)=(\S+)$/,
      (all, n, path, value) => `copy of Run ${n} · ${labParamText(path, value)}`
    )
    // A copy saved before TONING named its change in lower case: "Developer strength: weaker" now.
    .replace(
      /^(copy of Run \d+ · )(.+)$/,
      (all, head, what) => head + what.replace(/(^|; )([a-z])/g, (m, sep, letter) => sep + letter.toUpperCase())
    );
  return `Run ${labRunNumber(run)}${label ? ` · ${label}` : ''}`;
}
function labRunLabel(run) {
  if (!run) return '';
  const lab = LAB.lab;
  const method = lab ? lab.getMethod(run.method) : null;
  const specimen = lab ? lab.getSpecimen(run.specimenId) : null;
  let what = 'unknown method';
  if (method && labIsCompareOnly(method)) what = 'compare only';
  else if (method) {
    const p = labStepProgress(lab, run);
    what = `${p.count} of ${p.total} steps done`;
  }
  return `${labRunTitle(run)} · ${labSpecimenName(specimen) || LAB_UNKNOWN_SPECIMEN} · ${what}`;
}
// For the report export (and anyone naming a run in full; UX-SMALL): History's run name with what the
// run changes in place of its progress, "Run 3 · Practice specimen A · high burden · development time:
// longer" (a copy's name already says its change, so it is not repeated).
function labRunHeading(run) {
  if (!run) return '';
  const lab = LAB.lab;
  const title = labRunTitle(run);
  const method = lab ? lab.getMethod(run.method) : null;
  const specimen = lab ? lab.getSpecimen(run.specimenId) : null;
  const what = method ? labProtocolText(lab, run.params, run.method) : 'unknown method';
  const said = title.toLowerCase().includes(what.toLowerCase());
  return [title, labSpecimenName(specimen) || LAB_UNKNOWN_SPECIMEN, said ? '' : what].filter(Boolean).join(' · ');
}
// One parameter in plain words with its capitalized name: "Development time: longer", "Gold toning:
// performed", "Pretreatment: none"; a path the bench does not know stays "path = value".
function labParamText(path, value) {
  const leaf = labLeafOf(path);
  const name = leaf
    ? leaf.label
    : ['pretreatment', 'toning', 'thiosulfate'].includes(path)
      ? LAB_PARAM_NAMES[path]
      : '';
  if (!name) return `${path} = ${value}`;
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}: ${labValueText(path, value)}`;
}
// A procedure step id in the student's words (studentTitle, else the procedure title); an unknown id as is.
const labStepTitleById = stepId =>
  labStepTitle(LAB.lab && stepId ? labStepById(LAB.lab, stepId) : null) || String(stepId ?? '');
// History's event lines and settings in the export's words (UX-POLISH; the engine's export v2): "First
// silver bath", "Changed setting: Development time: longer", "Note: …"; the settings as two lines.
function labEventText(ev) {
  const items = labIsObj(ev.params) ? labLeaves(ev.params) : [];
  const changed = items.map(([path, value]) => labParamText(path, value)).join('; ');
  if (ev.type === 'step' && ev.step)
    return `${labStepTitleById(ev.step)}${changed ? ` (changed setting: ${changed})` : ''}`;
  // §13.3: "First silver bath: 20% silver nitrate · 30 min · 37 °C · in the dark (Forceps: metal)".
  if (ev.type === 'dip') {
    const hands = LAB.lab ? labHandsText(LAB.lab, ev.handling) : '';
    const contents = LAB.lab ? labSolutionText(LAB.lab, ev.solution) : '';
    return `${labJarTitleById(ev.jarId)}${contents ? `: ${contents}` : ''}${hands ? ` (${hands})` : ''}`;
  }
  if (ev.type === 'set-params') return `Changed setting: ${changed || 'none'}`;
  if (ev.type === 'note') return `Note: ${String(ev.text || '').trim() ? ev.text : 'not written'}`;
  return String(ev.type || '');
}
// Toning and thiosulfate in the course procedure's words for what each does, or what skipping it leaves
// (§11.5, R-model-08 / 09 / 10; the engine's TONING_TEXT / THIOSULFATE_TEXT, read through a fallback
// for an older engine build).
const labFlagText = (flag, done) => {
  const table = flag === 'toning' ? SilverLab.TONING_TEXT : SilverLab.THIOSULFATE_TEXT;
  const key = done ? 'performed' : 'skipped';
  return labIsObj(table) && typeof table[key] === 'string' ? table[key] : '';
};
const labFlagLine = (flag, done) => {
  const words = labFlagText(flag, done);
  return `${labParamText(flag, done)}${words ? ` (${words})` : ''}`;
};
function labSettingsLines(run) {
  const params = (run && run.params) || {};
  const changed = labLeaves(params).filter(
    ([path, value]) => !['toning', 'thiosulfate'].includes(path) && labGetPath(SilverLab.DEFAULT_PARAMS, path) !== value
  );
  const changedLine = changed.length
    ? `Settings changed from standard: ${changed.map(([path, value]) => labParamText(path, value)).join('; ')}`
    : '';
  // A free run (MODE-FIX-shell-2, as the engine's export): toning and thiosulfate are jars, read from the
  // slide the run has now ("done" / "not done"), never from the flags.
  if (labIsFree(run)) {
    const out = LAB.lab ? labFreeOutcome(LAB.lab, run) : null;
    const slide = labIsObj(out && out.slide) ? out.slide : labIsObj(run.slide) ? run.slide : {};
    const word = (flag, done) =>
      `${flag === 'toning' ? 'Gold toning' : 'Thiosulfate'}: ${done ? 'done' : 'not done'}${labFlagText(flag, done) ? ` (${labFlagText(flag, done)})` : ''}`;
    return [
      changedLine || 'Settings: all standard (per procedure)',
      word('toning', !!slide.toned),
      word('thiosulfate', !!slide.fixed),
    ];
  }
  const skipped = ['toning', 'thiosulfate'].filter(flag => params[flag] === false);
  const record = ['toning', 'thiosulfate'].filter(flag => params[flag] !== false);
  return [
    changedLine ||
      // TONING-verify-1: as the engine's export, never "all standard" right above a skipped step's line.
      `Settings: all standard (per procedure)${skipped.length ? ` except ${skipped.map(flag => (flag === 'toning' ? 'gold toning' : 'thiosulfate')).join(' and ')}` : ''}`,
    ...(record.length === 2
      ? [
          `Toning and thiosulfate: performed${labFlagText('toning', true) ? ` (${labFlagText('toning', true)}; ${labFlagText('thiosulfate', true)})` : ''}`,
        ]
      : ['toning', 'thiosulfate'].map(flag => labFlagLine(flag, !skipped.includes(flag)))),
  ].filter(Boolean);
}
function labDeviationText(deviation) {
  const step = LAB.lab ? labStepTitle(labStepById(LAB.lab, deviation.step)) || deviation.step : deviation.step;
  if (deviation.kind === 'out-of-order') return `${LAB_WORDS.outOfOrder}: ${step}`;
  if (deviation.kind === 'repeated') return `Done twice: ${step}`;
  if (deviation.kind === 'skipped') return `Skipped: ${step}`;
  if (deviation.kind === 'not-planned') return `Done though your setting skips it: ${step}`;
  return `${step}: this method has no bench steps`;
}
// Deviations as one line, each wording once: a slide dropped twice on a step out of order records two
// deviations that read the same ("Done out of order: Ammonia rinse"), and the line says it once.
const labDeviationsText = deviations => [...new Set(deviations.map(labDeviationText))].join('; ');

/* ---------- bench: shared form pieces ---------- */
function labRunSelectHtml(id, selected, { empty = 'no run yet', labelText = 'Run' } = {}) {
  const options = LAB_STATE.runOrder.map(runId => ({ value: runId, text: labRunLabel(LAB_STATE.runs[runId]) }));
  if (!options.length) options.push({ value: '', text: empty });
  return labSelectHtml(id, id, options, selected || '', { labelText });
}
// "What do you want to change?" (contract §8.3 #lab-change-what): one option per parameter group, each
// revealing exactly one plain control that writes the engine values below into the run's params.
const LAB_CHANGE = [
  { id: 'standard', text: 'Nothing (standard, per procedure)' },
  {
    id: 'impregnation-time',
    text: 'Impregnation time',
    path: 'impregnation.endpoint',
    values: [
      ['early', 'shorter'],
      ['sop-default', 'standard'],
      ['extended', 'longer'],
    ],
    hint: 'Shorter or longer than the procedure’s 20 min. The model uses positions, not minutes.',
  },
  {
    id: 'impregnation-temperature',
    text: 'Impregnation temperature',
    path: 'impregnation.temperature',
    values: [
      ['sop-default', 'standard'],
      ['deviated', 'changed (low confidence)'],
    ],
    hint: 'The model has no direction for this change, so it marks the picture low confidence.',
  },
  {
    id: 'development-time',
    text: 'Development time',
    path: 'development.endpoint',
    values: [
      ['early', 'shorter'],
      ['sop-default', 'standard'],
      ['extended', 'longer'],
    ],
    hint: 'Shorter or longer than the procedure’s 1 to 5 min. The model uses positions, not minutes.',
  },
  {
    id: 'developer-strength',
    text: 'Developer strength',
    path: 'development.strength',
    values: [
      ['weak', 'weaker'],
      ['sop-default', 'standard'],
      ['strong', 'stronger'],
    ],
    hint: 'Weaker or stronger than the procedure’s 3 drops per 50 ml. The model uses positions, not a recipe.',
  },
  {
    id: 'washes',
    text: 'Washes',
    path: 'washes.condition',
    values: [
      ['sop-default', 'standard'],
      ['deviated', 'changed (not modeled)'],
    ],
    hint: 'No sourced rule covers a change to the washes, so the run comes back Not modeled.',
  },
  {
    // One radio group, one leaf at a time (CC-10): skip (or, from a run that skipped it, do) gold
    // toning, or the same for thiosulfate; never both in one change. Skipping is modeled (§11.5, R-model-10).
    id: 'toning-thiosulfate',
    text: 'Toning and thiosulfate',
    flags: ['toning', 'thiosulfate'],
    hint: 'Both are done in the procedure. Skipped, the course procedure says what is left: without gold toning the stain stays brown-black; without thiosulfate the slide keeps changing.',
  },
];
// The skip options say only what they do ("skip gold toning"): skipping is modeled (§11.5, R-model-10),
// so they carry no "(not modeled)" tag (the washes' option keeps its own).
function labChangeValues(lab, option, base = SilverLab.DEFAULT_PARAMS, compare = false) {
  if (option.flags)
    return [
      ['none', compare ? 'both as in this run' : 'both done (standard)'],
      ...option.flags.map(flag => [flag, base[flag] ? `skip ${LAB_PARAM_NAMES[flag]}` : `do ${LAB_PARAM_NAMES[flag]}`]),
    ];
  return option.values || [];
}
// For other modules (UX-LAST, shared API): the set-up select's options in its order and words, each with
// its control's values for a new run (from the procedure's settings). Fresh copies on every call.
function labChangeOptions() {
  return LAB_CHANGE.map(option => ({
    id: option.id,
    label: option.text,
    values: labChangeValues(LAB.lab, option).map(([value, label]) => ({ value, label })),
  }));
}
// The value an option holds on the procedure's settings ('sop-default', 'none').
const labChangeStandard = option =>
  option.path || option.flags ? labChangeGet(option, SilverLab.DEFAULT_PARAMS, SilverLab.DEFAULT_PARAMS) : null;
const labChangeKey = text =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s*:\s*/g, ': ')
    .trim()
    .replace(/\.$/, '')
    .toLowerCase();
// A planned change in the bench's own words (UX-LAST): "<option>: <value>" (or "<option> (<value>)")
// with the labels of changeOptions(), letter case and spacing aside; nothing is guessed. The option's
// name alone gives its one change when it has only one (washes: changed), else value null (shorter or
// longer is not said). Anything else is null.
function labMatchChange(text) {
  const key = labChangeKey(text);
  if (!key) return null;
  for (const option of labChangeOptions()) {
    const name = labChangeKey(option.label);
    const standard = labChangeStandard(LAB_CHANGE.find(o => o.id === option.id));
    if (key === name) {
      const changes = option.values.filter(v => v.value !== standard);
      return { id: option.id, value: changes.length === 1 ? changes[0].value : null };
    }
    for (const v of option.values) {
      const word = labChangeKey(v.label);
      if (key === `${name}: ${word}` || key === `${name} (${word})`) return { id: option.id, value: v.value };
    }
  }
  return null;
}
// The value a change control shows: the leaf's value, or for the toning / thiosulfate group the flag
// that differs from the base ('none' while neither does).
function labChangeGet(option, params, base) {
  if (!option.flags) return labGetPath(params, option.path);
  return option.flags.find(flag => !!params[flag] !== !!base[flag]) || 'none';
}
function labChangeSet(option, change, value) {
  if (!option.flags) return labSetPath(change.params, option.path, value);
  for (const flag of option.flags) change.params[flag] = flag === value ? !change.base[flag] : !!change.base[flag];
  return change.params;
}
// `base` is what the change starts from (the procedure for a new run, the baseline run for a copy);
// `params` is the edited copy the run receives through one set-params event.
const labChangeState = (base, what = 'standard') => ({ what, base: labClone(base), params: labClone(base) });
// Picking a change picks its next value too, for a new run as for a copy (F2: "Development time" left on
// standard started a standard run); the student can still pick another value.
function labChangePreselect(lab, change) {
  const option = LAB_CHANGE.find(o => o.id === change.what);
  if (!option || !(option.path || option.flags)) return;
  const current = labChangeGet(option, change.base, change.base);
  const values = labChangeValues(lab, option, change.base).map(([value]) => value);
  const at = values.indexOf(current);
  const other = at >= 0 && at + 1 < values.length ? values[at + 1] : values.find(value => value !== current);
  if (other && labChangeGet(option, change.params, change.base) === current) labChangeSet(option, change, other);
}
function labChangeSummary(change, compare) {
  const { paths } = labParamDiff(change.base, change.params);
  if (!paths.length) return compare ? 'Pick a value that differs from this run.' : 'Standard protocol (per procedure).';
  const clauses = paths.map(p => labChangeClause(p, labGetPath(change.params, p)));
  return `${compare ? 'The copy' : 'This run'} ${labAnd(clauses)}.`;
}
// The one control a choice reveals: a radio group (shorter / standard / longer …; skip gold toning or
// thiosulfate). In a comparison the baseline's own value is shown and disabled.
function labChangeControl(lab, change, { compare = false, onPick } = {}) {
  const option = LAB_CHANGE.find(o => o.id === change.what);
  if (!option || option.id === 'standard') return document.createDocumentFragment();
  const box = el(
    `<fieldset class="lab-change-group" data-lab-change="${esc(option.id)}"><legend>${esc(option.text)}</legend><div class="lab-change-options"></div><p class="lab-dim lab-change-hint">${esc(option.hint)}</p></fieldset>`
  );
  const host = box.querySelector('.lab-change-options');
  const base = labChangeGet(option, change.base, change.base);
  const current = labChangeGet(option, change.params, change.base);
  for (const [value, text] of labChangeValues(lab, option, change.base, compare)) {
    const same = compare && value === base;
    const item = el(
      `<label class="lab-seg-option"><input type="radio" name="lab-change-value" value="${esc(value)}" data-lab-change-value="${esc(value)}"${value === current ? ' checked' : ''}${same ? ' disabled' : ''}><span>${esc(text)}${same ? ' (same as this run)' : ''}</span></label>`
    );
    item.querySelector('input').addEventListener('change', event => {
      if (!event.target.checked) return;
      labChangeSet(option, change, value);
      onPick?.();
    });
    host.appendChild(item);
  }
  return box;
}
// The select plus its control and a one-line summary. Only one of these exists on the page at a time
// (the set-up panel and the compare panel never show together), so the ids stay unique.
function labChangeFields(lab, change, { compare = false, onChange } = {}) {
  const options = LAB_CHANGE.filter(o => !(compare && o.id === 'standard'));
  const wrap = el(`<div class="lab-change">
    <label class="lab-field lab-change-what"><span>What do you want to change?</span><select id="lab-change-what" name="what">${options
      .map(o => `<option value="${esc(o.id)}"${o.id === change.what ? ' selected' : ''}>${esc(o.text)}</option>`)
      .join('')}</select></label>
    <div class="lab-change-control" id="lab-change-control"></div>
    <p class="lab-change-summary" id="lab-change-summary"></p>
  </div>`);
  const control = wrap.querySelector('#lab-change-control'),
    summary = wrap.querySelector('#lab-change-summary');
  const picked = () => {
    summary.textContent = labChangeSummary(change, compare);
    onChange?.(change);
  };
  const paint = () => {
    control.replaceChildren(labChangeControl(lab, change, { compare, onPick: picked }));
    summary.textContent = labChangeSummary(change, compare);
  };
  wrap.querySelector('#lab-change-what').addEventListener('change', event => {
    change.what = event.target.value;
    change.params = labClone(change.base); // one change at a time
    labChangePreselect(lab, change);
    paint();
    onChange?.(change);
  });
  paint();
  return { node: wrap, repaint: paint };
}
// The values a setting offers, in the engine's order (an engine build before §11.5 has no AMMONIA list).
/* ---------- bench: header ---------- */
// Specimen chip, run name, History, Safety notes and the 3D / List segmented control (PLAN §3.3).
// ONE toggle button for the bench view (UX-R2): it names the view it switches to, and its
// data-lab-mode is that target ("3d" while the list shows), so [data-lab-mode="3d"] still means "go
// to 3D". The label is the state, so no aria-pressed. Without WebGL2, "Switch to 3D" is disabled with
// the reason beside it.
function labModeSwitch(onChange) {
  const reason = lab3dBlockedReason();
  const target = labCurrentMode() === '3d' ? 'list' : '3d';
  const wrap = el(
    `<div class="lab-mode-wrap"><button type="button" class="lab-head-btn lab-mode-toggle" id="lab-mode-toggle" data-lab-mode="${target}"${reason && target === '3d' ? ' disabled' : ''}>${target === '3d' ? 'Switch to 3D' : 'Switch to list'}</button>${reason ? `<p class="lab-dim lab-mode-reason">${esc(reason)}</p>` : ''}</div>`
  );
  const button = wrap.querySelector('#lab-mode-toggle');
  button.addEventListener('click', () => {
    const next = button.dataset.labMode;
    if (next === labCurrentMode()) return;
    labModeOverride = null; // the student's own choice is saved
    LAB_STATE.mode = next;
    LAB_STATE.modeChosen = true;
    labSave();
    labEvents.emit('mode', next);
    onChange?.(next);
  });
  return wrap;
}
// "New run" (collapsed set-up, in the Run menu) / "Close the set-up" (open set-up, in its own head).
function labSetupToggle(ctx, open) {
  const toggle = el(
    `<button type="button" class="lab-linkbtn" id="lab-setup-toggle" aria-expanded="${open}"${open ? ' aria-controls="lab-newrun"' : ''}>${open ? 'Close the set-up' : 'New run'}</button>`
  );
  toggle.addEventListener('click', () => {
    ctx.setupOpen = !ctx.setupOpen;
    ctx.runMenuOpen = false;
    if (ctx.setupOpen) {
      ctx.setup = null; // a fresh set-up for the new run, starting from the procedure
      ctx.compareOpen = false; // one "What do you want to change?" on the page
    }
    ctx.refresh(ctx.setupOpen ? '#lab-setup [name="specimen"]:checked' : ['#lab-setup-toggle', '#lab-run-menu-btn']);
  });
  return toggle;
}
// The Run menu (UX-R2): one disclosure button in the header holding New run, History and the Safety
// notes (and Show hints, GAME-shell), so the first view keeps to the plan's control budget while steps
// remain. Esc closes it and returns focus to the button; a click or focus outside closes it; an item
// that redraws the bench closes it too (ctx.runMenuOpen keeps it open across any other redraw).
function labRunMenu(ctx, items) {
  const open = !!ctx.runMenuOpen;
  const wrap = el(`<div class="lab-menu" data-lab-menu="run">
    <button type="button" class="lab-head-btn lab-menu-btn" id="lab-run-menu-btn" aria-expanded="${open}" aria-controls="lab-run-menu">Run<span class="lab-menu-caret" aria-hidden="true"></span></button>
    <div class="lab-menu-panel" id="lab-run-menu" role="group" aria-labelledby="lab-run-menu-btn"${open ? '' : ' hidden'}></div>
  </div>`);
  const button = wrap.querySelector('#lab-run-menu-btn'),
    panel = wrap.querySelector('#lab-run-menu');
  for (const item of items) if (item) panel.appendChild(item);
  const outside = event => {
    if (!wrap.isConnected) return stopWatching();
    if (!wrap.contains(event.target)) setOpen(false);
  };
  const watching = on => {
    for (const type of ['pointerdown', 'focusin']) {
      if (on) document.addEventListener(type, outside, true);
      else document.removeEventListener(type, outside, true);
    }
  };
  const stopWatching = () => watching(false);
  function setOpen(next, { focus = false } = {}) {
    ctx.runMenuOpen = next;
    button.setAttribute('aria-expanded', String(next));
    panel.hidden = !next;
    stopWatching();
    if (next) watching(true);
    if (focus) button.focus({ preventScroll: true });
  }
  button.addEventListener('click', () => setOpen(!ctx.runMenuOpen));
  wrap.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || panel.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false, { focus: true });
  });
  if (open) watching(true);
  return wrap;
}
// "Show hints" (GAME-shell): the last item of the Run menu; changing it redraws nothing, so the menu
// stays open and the box keeps focus.
function labHintsToggle() {
  const row = el(
    `<label class="lab-check lab-menu-check" id="lab-hints-row"><input type="checkbox" id="lab-hints-toggle"${labHintsOn() ? ' checked' : ''}> Show hints</label>`
  );
  row.querySelector('#lab-hints-toggle').addEventListener('change', event => labSetHints(event.target.checked));
  return row;
}
function labBenchHead(lab, run, ctx) {
  const specimen = lab.getSpecimen(run ? run.specimenId : labSetupState(lab, ctx, run).specimenId);
  const head = el(`<div class="lab-bench-head" role="group" aria-label="Your run and view">
    <p class="lab-bench-id"><span class="lab-specimen-chip" id="lab-specimen-chip">${esc(labSpecimenName(specimen) || (run ? 'Unknown specimen' : 'No specimen yet'))}</span>${run ? `<span class="lab-run-name" id="lab-run-name">${esc(labRunTitle(run))}</span>` : ''}</p>
    <div class="lab-bench-tools">
      <div data-lab-slot="menu"></div>
      <div data-lab-slot="mode"></div>
      ${labNotesButtonHtml()}
    </div>
  </div>`);
  const history = LAB_STATE.runOrder.length
    ? el(
        `<button type="button" class="lab-linkbtn" id="lab-history-toggle" aria-expanded="${ctx.historyOpen}" aria-controls="lab-history">History</button>`
      )
    : null;
  history?.addEventListener('click', () => {
    ctx.historyOpen = !ctx.historyOpen;
    ctx.runMenuOpen = false;
    ctx.refresh(ctx.historyOpen ? '#lab-history-h' : ['#lab-history-toggle', '#lab-run-menu-btn']);
    if (ctx.historyOpen) labReveal('#lab-history');
  });
  const safety = labSafetyCard(lab, () =>
    ctx.refresh(['#lab-safety-ack', '#lab-do-step:not(:disabled)', '#lab-setup-h'])
  );
  head
    .querySelector('[data-lab-slot="menu"]')
    .replaceWith(
      labRunMenu(ctx, [run && !ctx.setupOpen ? labSetupToggle(ctx, false) : null, history, safety, labHintsToggle()])
    );
  head.querySelector('#lab-notes-toggle').addEventListener('click', () => labNotepadToggle());
  head.querySelector('[data-lab-slot="mode"]').replaceWith(
    labModeSwitch(next => {
      // The part that changed comes up under the top bar (G6): the 3D stage with its station row and the
      // primary action in view at every width (MODE-FIX-shell-1, amending CC-8: a switch to 3D no longer
      // keeps focus on the toggle, which would scroll the page back up to it), or, on a phone, the list
      // with its slide chip; focus moves to the part's heading, in view.
      const phone = labNarrow();
      const to3d = next === '3d';
      const focus = to3d || phone ? '#lab-do-h' : '#lab-mode-toggle';
      ctx.mountFocus = to3d ? focus : null;
      if (to3d || phone) ctx.revealSel = '#lab-do';
      ctx.refresh(focus);
    })
  );
  return head;
}
// Scrolls a freshly opened part into view (no smooth scrolling under reduced motion). `later` waits one
// frame so a part rendered by the same refresh has its final layout (an inline microscope, a card).
function labReveal(sel, block = 'start', { later = false } = {}) {
  const go = () => {
    const node = typeof document === 'undefined' ? null : document.querySelector(sel);
    if (node && typeof node.scrollIntoView === 'function')
      node.scrollIntoView({ block, behavior: labPrefersReducedMotion() ? 'instant' : 'smooth' });
  };
  if (later && typeof requestAnimationFrame === 'function') requestAnimationFrame(go);
  else go();
}

// §13.3: the mode switch at the top of the bench body (under the nav line), there whatever the run: two
// buttons with aria-pressed, "Practice the procedure" / "Free bench". The pressed one is the run's mode (no
// run: the mode the next run starts in). A press on the other one: ctx.switchMode.
function labBenchModeSwitch(lab, run, ctx) {
  const current = run ? labBenchModeOf(run.mode) : labSetupState(lab, ctx, run).benchMode;
  const wrap = el(
    `<div class="lab-mode-switch" id="lab-mode-switch" role="group" aria-label="How you work">${['practice', 'free']
      .map(
        id =>
          `<button type="button" class="lab-mode-switch-btn" data-lab-benchmode="${id}" aria-pressed="${id === current}">${esc(LAB_BENCH_MODES[id].title)}</button>`
      )
      .join('')}</div>`
  );
  wrap.addEventListener('click', event => {
    const button = event.target && event.target.closest ? event.target.closest('[data-lab-benchmode]') : null;
    if (button && wrap.contains(button)) ctx.switchMode(button.dataset.labBenchmode);
  });
  return wrap;
}

/* ---------- bench: Your slide (the set-up; MODE §11.1) ---------- */
function labSetupState(lab, ctx, run) {
  if (!ctx.setup)
    ctx.setup = {
      specimenId: (run && run.specimenId) || LAB_STATE.activeSpecimenId || labFirstSpecimenId(lab),
      method: LAB_RUNNABLE_METHOD,
      label: '',
      guess: '', // BENCH-2: "What do you think will happen?" (optional, free bench), shown beside the result
      benchMode: labBenchModeOf(LAB_STATE.settings.benchMode), // remembered across runs and reloads
    };
  return ctx.setup;
}
// Every setting of `run` on top of the procedure's defaults (a run stores only what it set).
function labRunParamsFull(run) {
  const params = labClone(SilverLab.DEFAULT_PARAMS);
  for (const [path, value] of labLeaves(labIsObj(run.params) ? run.params : {})) labSetPath(params, path, value);
  return params;
}
// "Run it again on the free bench" (a finished run's card): a fresh free-bench set-up on the run's specimen
// (§13.3: the jars hold the mix, so nothing else carries over).
function labSetupFromRun(ctx, run) {
  LAB_STATE.settings.benchMode = 'free';
  labSave();
  ctx.setup = { specimenId: run.specimenId, method: run.method, label: '', guess: '', benchMode: 'free' };
  Object.assign(ctx, { setupOpen: true, compareOpen: false, scopeOpen: false, runMenuOpen: false });
}
// The jars in one phrase (§13.3): "the procedure's jars", "2 jars changed · 1 extra jar".
function labJarsSummary(lab, run) {
  const jars = labJars(lab, run);
  const changed = jars.filter(j => j.changed).length,
    extra = jars.filter(j => j.extra).length;
  const parts = [
    changed ? `${changed} ${changed === 1 ? 'jar' : 'jars'} changed` : '',
    extra ? `${extra} extra ${extra === 1 ? 'jar' : 'jars'}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'the procedure’s jars';
}
// The collapsed set-up's one line: "<specimen> · Practice the procedure" / "<specimen> · Free bench ·
// <settings summary>" (§11.1). §13.3: on the free bench the summary is the jars ("the procedure's jars", "2
// jars changed · 1 extra jar"); an older free run that changed settings keeps its settings sentence.
function labFreeSummary(lab, run) {
  const settings = labParamDiff(SilverLab.DEFAULT_PARAMS, labRunParamsFull(run)).paths.some(
    path => !LAB_FLAG_PATHS.includes(path)
  );
  return labShelfOn(lab) && !settings
    ? labJarsSummary(lab, run)
    : labProtocolText(lab, run.params, run.method, { flags: false });
}
function labSetupLine(lab, run) {
  const specimen = labSpecimenName(lab.getSpecimen(run.specimenId)) || LAB_UNKNOWN_SPECIMEN;
  const mode = LAB_BENCH_MODES[labBenchModeOf(run.mode)].title;
  return labIsFree(run) ? `${specimen} · ${mode} · ${labFreeSummary(lab, run)}` : `${specimen} · ${mode}`;
}
// Open while there is no run (or after "New run"): the two mode cards, the specimen cards, on the free
// bench the guess, then Start. Once a run exists it collapses to one line.
function labSetupSection(lab, run, ctx) {
  const open = !run || ctx.setupOpen;
  const section =
    el(`<section class="lab-part lab-setup" id="lab-setup" aria-labelledby="lab-setup-h" data-lab-setup="${open ? 'open' : 'collapsed'}">
    <div class="lab-part-head">
      <h2 id="lab-setup-h" tabindex="-1">Your slide</h2>
      ${run && !open ? `<p class="lab-setup-line">${esc(labSetupLine(lab, run))}</p>` : ''}
    </div>
  </section>`);
  // "New run" lives in the Run menu (UX-R2); an open set-up keeps "Close the set-up" in its own head.
  if (run && open) section.querySelector('.lab-part-head').appendChild(labSetupToggle(ctx, true));
  if (!open) return section;
  const setup = labSetupState(lab, ctx, run);
  const free = setup.benchMode === 'free';
  const cards = lab
    .listSpecimens()
    .slice(0, 4)
    .map(
      s =>
        `<label class="lab-specimen-card"><input type="radio" name="specimen" value="${esc(s.id)}" data-lab-specimen="${esc(s.id)}"${s.id === setup.specimenId ? ' checked' : ''}><span class="lab-specimen-text"><strong>${esc(labSpecimenName(s))}</strong><span>${esc(labSpecimenNote(s))}</span></span></label>`
    )
    .join('');
  const modeCard = id =>
    `<label class="lab-mode-card"><input type="radio" name="benchmode" value="${id}" data-lab-bench-mode="${id}"${setup.benchMode === id ? ' checked' : ''}><span class="lab-mode-text"><strong>${esc(LAB_BENCH_MODES[id].title)}</strong><span>${esc(LAB_BENCH_MODES[id].line)}</span></span></label>`;
  const form = el(`<form class="lab-newrun" id="lab-newrun">
    <fieldset class="lab-bench-mode" id="lab-bench-mode"><legend>How do you want to work?</legend><div class="lab-mode-cards">${modeCard('practice')}${modeCard('free')}</div></fieldset>
    <fieldset class="lab-specimens" id="lab-newrun-specimen"><legend>Specimen</legend><div class="lab-specimen-cards">${cards}</div></fieldset>
    ${free ? `<label class="lab-field lab-guess"><span>What do you think will happen? <span class="lab-dim">(optional, kept beside the result)</span></span><textarea id="lab-newrun-guess" name="guess" rows="2" maxlength="400">${esc(setup.guess || '')}</textarea></label>` : ''}
    <div class="lab-row"><button type="submit" class="btn btn-solid" id="lab-newrun-create">${run ? 'Start a new run' : 'Start the run'}</button></div>
  </form>`);
  form.querySelector('#lab-newrun-guess')?.addEventListener('input', event => {
    setup.guess = event.target.value;
  });
  // Switching the card while a run exists only changes what the next run will be (§11.1); the choice is
  // remembered.
  form.querySelectorAll('[name="benchmode"]').forEach(input =>
    input.addEventListener('change', () => {
      if (!input.checked) return;
      setup.benchMode = labBenchModeOf(input.value);
      LAB_STATE.settings.benchMode = setup.benchMode;
      labSave();
      ctx.refresh('#lab-bench-mode input:checked');
    })
  );
  form.querySelectorAll('[name="specimen"]').forEach(input =>
    input.addEventListener('change', () => {
      setup.specimenId = input.value;
      const chip = document.querySelector('#lab-specimen-chip');
      if (chip && !run) chip.textContent = labSpecimenName(lab.getSpecimen(input.value));
    })
  );
  form.addEventListener('submit', event => {
    event.preventDefault();
    const specimenId = form.querySelector('[name="specimen"]:checked')?.value || setup.specimenId;
    // §13.3: the Mix panel left the free bench (its settings are the jars' fields now), so a run starts with
    // the procedure's settings in either mode; the free bench's jars hold the mix.
    const created = labNewRun({
      specimenId,
      method: free ? setup.method : LAB_RUNNABLE_METHOD,
      label: setup.label,
      mode: setup.benchMode,
      deferSave: true,
    });
    // A run that matches a sealed one stays sealed with it (UX-LAST): it would show the sealed outcome.
    const twin = labSealTwin(created.id);
    labSave();
    const fresh = LAB_STATE.runs[created.id];
    const guess = free ? String(setup.guess || '').trim() : '';
    if (guess) {
      fresh.guess = guess; // BENCH-2: the student's own words, never read by the model
      labSave();
    }
    Object.assign(ctx, {
      runId: created.id,
      makeRefused: null, // the student has moved on from "Make the runs for me"
      setup: null,
      setupOpen: false,
      frame: 0,
      freeStep: null,
      stepNote: null,
      pairBaseline: created.id,
      pairChange: null,
      compared: false,
      compareOpen: !!ctx.experiment, // a proposal's pairing stays open
      scopeOpen: false,
      sheet: null,
    });
    labCloseOnRefresh(ctx, '3d-options'); // a new run starts with the 3D options closed
    labStageHint(ctx, ''); // MODE-FIX-integrate-7: the last run's look line never hangs over a new run's stage
    // The stage in view, not under the top bar (UX-POLISH); in list mode the steps part from its top
    // (FIX2 on a phone, G6 at every width): the slide chip, its hints and the rows, with Do this step
    // below. Wider than a phone it comes up only when it fits under the top bar down to Do this step
    // (`revealFit`); a taller one keeps the focus reveal (Do this step in view).
    ctx.revealSel = '#lab-do';
    ctx.revealFit = ctx.mode !== '3d' && !labNarrow() ? (free ? '#lab-free-dip' : '#lab-do-step') : null;
    labAnnounce(
      `${labRunTitle(fresh)} started on ${labSpecimenName(lab.getSpecimen(specimenId))}: ${LAB_BENCH_MODES[labBenchModeOf(fresh.mode)].title}${free ? `, ${labFreeSummary(lab, fresh)}` : ''}.${twin ? ` ${labTwinText(twin)}` : ''}`
    );
    ctx.refresh([
      free ? '#lab-free-dip:not(:disabled)' : '#lab-do-step:not(:disabled)',
      '#lab-resolve-out .lab-banner',
      '#lab-do-h',
    ]);
    if (ctx.mode === '3d') labFrameRun(lab, ctx); // G9: the camera at the new run's rack, the picker naming it
  });
  section.appendChild(form);
  return section;
}

/* ---------- bench: The procedure (practice) / The bench (free) ---------- */
// Practice: the status line ("3 of 9 done"), ONE primary action (#lab-do-step: the next step in
// procedure order), Run all, and one link: Explain this step (side sheet). Free bench (§11.1): no
// status, no progress; the jar row (keyboard), "Do the whole procedure", "New slide", the Mix panel
// mid-run, and Explain a step. Before the result card exists, Look into the tissue sits with the
// result's placeholder (UX-R2).
function labDoControls(lab, run, ctx, mode) {
  const frag = document.createDocumentFragment();
  const method = run ? lab.getMethod(run.method) : null;
  if (!run) {
    frag.appendChild(el(`<p class="lab-do-status lab-do-norun" id="lab-3d-norun">${esc(LAB_DROP_HINTS.noRun)}.</p>`));
    // The keyboard's way to every step's sheet before a run (a row or a jar click is the pointer's):
    // the sheet opens on step 1 and its "Explain another step" select reaches the others.
    const first = labStepProgress(lab, null).steps[0];
    if (first) {
      const explain = el(
        `<button type="button" class="lab-linkbtn" id="lab-explain-open" aria-expanded="${!!(ctx.sheet && ctx.sheet.follow)}" aria-controls="lab-sheet">Explain a step</button>`
      );
      explain.addEventListener('click', () =>
        ctx.sheet && ctx.sheet.follow
          ? labCloseSheet(lab, ctx)
          : labOpenSheet(lab, ctx, { kind: 'step', id: first.id, follow: true, opener: '#lab-explain-open' })
      );
      frag.appendChild(el('<div class="lab-do-more"></div>')).appendChild(explain);
    }
    return frag;
  }
  if (!method || labIsCompareOnly(method)) {
    frag.appendChild(
      el(
        `<p class="lab-do-status" role="status">${method ? `${esc(method.title)} is compare only: it has no bench steps. Its picture below comes from the published description.` : 'This run names a method the lab does not know, so it has no steps.'}</p>`
      )
    );
    return frag;
  }
  const p = labStepProgress(lab, run);
  if (labIsFree(run)) {
    // The free bench (§11.1): nothing is next and nothing finishes; the slide is sealed once mounted.
    const sealed = labSlideSealed(run);
    const actions = el(`<div class="lab-do-actions lab-free-actions">
      <button type="button" class="btn" id="lab-run-all"${ctx.locked || sealed ? ' disabled' : ''}>Do the whole procedure</button>
      <button type="button" class="btn" id="lab-new-slide">New slide</button>
    </div>`);
    actions.querySelector('#lab-run-all').addEventListener('click', () => ctx.runAll());
    actions.querySelector('#lab-new-slide').addEventListener('click', () => ctx.newSlide());
    // §13.3: the jars' own tools (Add a jar, Reset every jar) right under the list, then Your hands; the Mix
    // panel left the free bench (its settings are the jars' fields).
    const tools = labJarTools(lab, run, ctx);
    const hands = labHandsFieldset(lab, ctx);
    if (mode === '3d') {
      // MODE-FIX-integrate-4: in 3D the jar select, Dip, Do the whole procedure and New slide share one
      // wrapping row (the list keeps its row above the steps and the two buttons below them).
      const row = labFreeRow(lab, run, ctx, mode);
      if (row.querySelector && row.querySelector('#lab-free-dip')) {
        while (actions.firstElementChild) row.appendChild(actions.firstElementChild);
        frag.appendChild(row);
      } else frag.appendChild(actions);
      if (tools) frag.appendChild(tools);
      if (hands) frag.appendChild(hands);
    } else {
      if (tools) frag.appendChild(tools);
      if (hands) frag.appendChild(hands);
      frag.appendChild(actions);
    }
    if (sealed)
      frag.appendChild(el(`<p class="lab-do-status lab-do-sealed" id="lab-do-sealed">${esc(LAB_SEALED_TIP)}.</p>`));
    frag.appendChild(labDoExtras(lab, run, ctx, { progress: p }));
    return frag;
  }
  frag.appendChild(
    el(`<div class="lab-do-status" id="lab-do-status">
      <span id="lab-do-count">${p.count} of ${p.total} done</span>
      <progress id="lab-do-progress" max="${p.total}" value="${p.count}" aria-labelledby="lab-do-count"></progress>
      ${p.next ? '' : `<span class="lab-do-finished">${esc(labFinishedText(run, mode))}</span><button type="button" class="btn lab-new-slide" id="lab-new-slide">New slide</button>`}
    </div>`)
  );
  // §13.3: a finished practice run offers "New slide" beside "Run complete": another practice run on the
  // same specimen.
  frag.querySelector('#lab-new-slide')?.addEventListener('click', () => ctx.newSlide());
  // Once every step is done the result card carries the next actions; a locked run keeps its
  // buttons, disabled, beside the lock notice.
  if (p.next) {
    const actions = el(`<div class="lab-do-actions">
      <button type="button" class="btn btn-solid" id="lab-do-step"${ctx.locked ? ' disabled' : ''}>Do this step: ${esc(labStepTitle(p.next))}</button>
      <button type="button" class="btn" id="lab-run-all"${ctx.locked ? ' disabled' : ''}>${p.count ? 'Run the rest' : 'Run all steps'}</button>
    </div>`);
    actions.querySelector('#lab-do-step').addEventListener('click', () => ctx.doStep(null));
    actions.querySelector('#lab-run-all').addEventListener('click', () => ctx.runAll());
    frag.appendChild(actions);
  }
  // Once every step is done, Explain moves into History ("Explain a step"): the first view of a finished
  // run keeps to the header, the set-up line and the steps (PLAN §2.3).
  if (p.next) frag.appendChild(labDoExtras(lab, run, ctx, { progress: p }));
  return frag;
}
// The free bench's keyboard path (§11.1): a jar select and "Dip the slide"; focus stays on the button, the
// reaction lands on that row's note line (list) or the stage hint (3D). §13.3: the select lists every jar,
// the extra ones too, by its contents ("20% silver nitrate · 20 min · … (First silver bath)").
function labFreeRow(lab, run, ctx, mode) {
  const p = labStepProgress(lab, run);
  // A compare-only method has no jars (MODE-FIX-shell-12): no empty select and no Dip that does nothing;
  // the status line under the list says the method is compare only.
  if (!p.steps.length) return document.createDocumentFragment();
  const sealed = labSlideSealed(run);
  const jars = labJars(lab, run);
  const options = jars.length
    ? jars.map(j => ({ value: j.id, text: `${j.text} (${j.title})` }))
    : p.steps.map(s => ({ value: s.id, text: labStepTitle(s) }));
  const picked = options.some(o => o.value === ctx.freeStep) ? ctx.freeStep : options[0].value;
  const row = el(`<div class="lab-free-row" role="group" aria-label="Dip the slide in a jar">
    ${labSelectHtml('lab-free-step', 'free-step', options, picked, {
      labelText: 'Jar',
      extraClass: 'lab-inline lab-free-pick',
    })}
    <button type="button" class="btn btn-solid" id="lab-free-dip"${ctx.locked || sealed ? ' disabled' : ''}>Dip the slide</button>
  </div>`);
  row.querySelector('#lab-free-step').addEventListener('change', event => {
    ctx.freeStep = event.target.value;
  });
  row.querySelector('#lab-free-dip').addEventListener('click', () => {
    const stepId = row.querySelector('#lab-free-step').value;
    ctx.freeStep = stepId;
    ctx.doStep(stepId, '#lab-free-dip', { fromStage: mode === '3d', fromList: mode !== '3d' });
  });
  return row;
}
// §13.3: under the list (list mode) or the stage's row (3D): "Add a jar" (up to four extra jars; at four it
// says how to free a place) and, once a jar differs from the procedure, "Reset every jar". null without the
// shelf.
function labJarTools(lab, run, ctx) {
  const jars = labJars(lab, run);
  if (!jars.length) return null;
  const extra = jars.filter(j => j.extra).length;
  const full = extra >= LAB_EXTRA_JARS.length;
  const touched = jars.some(j => j.changed || j.extra);
  const row = el(`<div class="lab-jar-tools" role="group" aria-label="Jars">
    <button type="button" class="lab-linkbtn lab-jar-add" id="lab-add-jar"${full ? ' disabled aria-describedby="lab-add-jar-full"' : ''}>Add a jar</button>
    ${touched ? '<button type="button" class="lab-linkbtn" id="lab-jars-reset">Reset every jar</button>' : ''}
    ${full ? '<span class="lab-dim lab-jar-full" id="lab-add-jar-full">Four extra jars is the most the bench holds; Remove jar, in a jar’s sheet, frees a place.</span>' : ''}
  </div>`);
  row.querySelector('#lab-add-jar').addEventListener('click', () => ctx.addJar());
  row.querySelector('#lab-jars-reset')?.addEventListener('click', () => ctx.resetJars());
  return row;
}
// A value in the shelf's words; the procedure's own value carries "(procedure)" (§13.1), set apart so it can
// be drawn small. `mark`: whether this value is the procedure's.
function labValueWordsHtml(words, mark) {
  const plain = String(words).replace(/\s*\(procedure\)\s*$/, '');
  return `${esc(plain)}${mark ? ' <span class="lab-proc">(procedure)</span>' : ''}`;
}
// §13.3 Your hands: the procedure's troubleshooting choices (forceps, glassware, between steps, how full) as
// small segmented controls, the procedure's choice first and marked. A change applies from the next dip on.
function labHandsFieldset(lab, ctx) {
  const shelf = labShelf(lab);
  const free = labFreeJars(lab);
  if (!shelf || !free || !shelf.handling.length) return null;
  const choice = c => {
    const values = [...c.values].filter(v => v && v.id !== undefined);
    values.sort((a, b) => (a.id === c.default ? -1 : b.id === c.default ? 1 : 0));
    const label = `lab-hand-${esc(c.id)}-l`;
    return `<div class="lab-hand" role="radiogroup" aria-labelledby="${label}"><span class="lab-hand-label" id="${label}">${esc(c.label || c.id)}</span><span class="lab-hand-seg">${values
      .map(
        v =>
          `<label class="lab-hand-opt"><input type="radio" name="lab-hand-${esc(c.id)}" id="lab-hand-${esc(c.id)}-${esc(v.id)}" value="${esc(v.id)}" data-lab-hand="${esc(c.id)}"${free.handling[c.id] === v.id ? ' checked' : ''}><span>${labValueWordsHtml(v.words || v.id, v.id === c.default)}</span></label>`
      )
      .join('')}</span></div>`;
  };
  const box = el(
    `<fieldset class="lab-hands" id="lab-hands"><legend>Your hands</legend><div class="lab-hands-grid">${shelf.handling.map(choice).join('')}</div></fieldset>`
  );
  box.addEventListener('change', event => {
    const input = event.target;
    if (!input || !input.matches('input[data-lab-hand]') || !input.checked) return;
    const c = shelf.handling.find(x => x.id === input.dataset.labHand);
    const value = c && c.values.find(v => v && String(v.id) === input.value);
    if (!value) return;
    const next = labFreeJars(lab);
    next.handling[c.id] = value.id;
    labWriteJars(next);
    labAnnounce(
      `${c.label || c.id}: ${String(value.words || value.id).replace(/\s*\(procedure\)\s*$/, '')}. It applies from the next dip on.`
    );
  });
  return box;
}
// The status line of a finished run: "Run complete" on the 3D stage (UX-POLISH), and where the result
// is, or that it is sealed until the experiment is revealed.
function labFinishedText(run, mode) {
  const sealed = run ? labSealedExp(run.id) : null;
  const where = sealed ? `sealed until you reveal ${labExperimentName(sealed)}` : 'the result is below';
  return `${mode === '3d' ? 'Run complete' : 'All steps done'}: ${where}.`;
}
// While steps remain: Explain this step (its sheet). In History once the run is finished, and on the
// free bench, where nothing is next: Explain a step. No Redo a step in either mode (§11.1).
function labDoExtras(lab, run, ctx, { progress } = {}) {
  const row = el('<div class="lab-do-more"></div>');
  const any = !progress.next || labIsFree(run);
  const explain = el(
    `<button type="button" class="lab-linkbtn" id="lab-explain-open" aria-expanded="${!!(ctx.sheet && ctx.sheet.follow)}" aria-controls="lab-sheet">${any ? 'Explain a step' : 'Explain this step'}</button>`
  );
  explain.addEventListener('click', () => {
    if (ctx.sheet && ctx.sheet.follow) return labCloseSheet(lab, ctx);
    // §13.3: the jar picked in the Jar select, an extra one too (its sheet holds its editor)
    if (labIsFree(run) && labIsExtraJar(ctx.freeStep) && labJarById(lab, run, ctx.freeStep))
      return labOpenSheet(lab, ctx, { kind: 'jar', id: ctx.freeStep, follow: true, opener: '#lab-explain-open' });
    const target = labIsFree(run)
      ? progress.steps.find(s => s.id === ctx.freeStep) || progress.steps[0]
      : progress.next || progress.steps[progress.steps.length - 1];
    labOpenSheet(lab, ctx, { kind: 'step', id: target.id, follow: true, opener: '#lab-explain-open' });
  });
  row.appendChild(explain);
  return row;
}
// A station's student title for the station row (§11.2): "Waste and safety", "Notebook"; no step numbers.
function labStationShort(station) {
  return String(station.studentTitle || station.title || station.id)
    .replace(/ \+ /g, ' and ')
    .split(' / ')[0];
}
// Under the stage (3D): the hint about the canvas, after the intro where the drawn section sits, and
// ONE "3D options" disclosure (UX-R2) holding the intro and the reduced-motion override (cuts instead of
// camera moves, for the bench and the clip; checked and fixed while the system asks for reduced motion,
// KB-13) and Read aloud. The stations are the row under the stage (labStationRow, §11.2). `gated`: the
// intro's part before the safety notes, a plain row with the intro and Reduce motion only.
function labStageExtras(lab, ctx, { gated = false } = {}) {
  const system = labSystemReducedMotion();
  const touch = labMedia('(pointer: coarse)');
  // A finished practice run, or a sealed slide: no jar or zoom tip, only where the next run starts.
  const run = ctx.runId ? LAB_STATE.runs[ctx.runId] : null;
  const progress = run ? labStepProgress(lab, run) : null;
  // I7 (FIX5): the jar and zoom sentence is a verb line (span.lab-tip-verbs): Show hints off hides it; the
  // finished or locked tip and the honesty sentence stay.
  const tip =
    run && labIsFree(run) && labSlideSealed(run)
      ? esc(`${ctx.locked ? LAB_RUN_LOCKED_TIP : LAB_SEALED_TIP}.`)
      : progress && progress.total && !progress.next && !labIsFree(run)
        ? esc(labFinishedTip(ctx))
        : `<span class="lab-tip-verbs">${
            touch
              ? 'Tap a jar to read about its step; double-tap it to do the step. Drag sideways to turn the view; pinch with two fingers to zoom.'
              : 'Click a jar to read about its step; double-click it to do the step. Hold Ctrl (⌘ on Mac) and scroll to zoom.'
          }</span>`;
  const readAloud = `<label class="lab-check lab-do-read-aloud"><input type="checkbox" id="lab-3d-read-aloud"${LAB_STATE.settings.readAloud ? ' checked' : ''}${labSpeechSupported() ? '' : ' disabled'}> Read the captions aloud${labSpeechSupported() ? '' : ' <span class="lab-dim">(no voice on this device)</span>'}</label>`;
  const reduced = `<label class="lab-check lab-do-reduced"><input type="checkbox" id="lab-3d-reduced"${system || LAB_STATE.settings.reducedMotion === 'on' ? ' checked' : ''}${system ? ' disabled' : ''}> ${system ? 'Reduce motion (on: your system setting)' : 'Reduce motion'}</label>`;
  const loaded =
    '<p class="lab-clip-loaded" id="lab-clip-loaded" hidden><span class="lab-dim">Slide rack:</span> Section on slide 1 (a drawing)</p>';
  const drawerId = labUid('drawer');
  const row = gated
    ? el(
        `<div class="lab-stage-extras" role="group" aria-label="3D bench options">${reduced}${readAloud}${loaded}</div>`
      )
    : el(`<div class="lab-stage-extras">
    <div class="lab-disclosure lab-3d-options" data-lab-drawer="3d-options"><button type="button" class="lab-drawer-btn" aria-expanded="false" aria-controls="${drawerId}">3D options</button><div class="lab-drawer lab-3d-options-body" id="${drawerId}" role="group" aria-label="3D options" hidden>${reduced}</div></div>
    <p class="lab-dim lab-stage-tip">${tip} The slide's tint follows the procedure's by-eye column; it is a drawing, not a stain image.</p>
    ${loaded}
  </div>`);
  if (!gated) {
    const toggle = row.querySelector('.lab-3d-options > .lab-drawer-btn'),
      body = row.querySelector('.lab-3d-options-body');
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      body.hidden = expanded;
    });
  }
  if (labClipSupported()) {
    const intro = el('<button type="button" class="lab-linkbtn" id="lab-clip-intro">Play the intro</button>');
    intro.addEventListener('click', () => labClipStart(lab, ctx, 'intro'));
    intro.hidden = ctx.clip.phase === 'intro'; // never offered while the intro plays (UX-R2)
    row.querySelector('.lab-do-reduced').before(intro);
  }
  row.querySelector('#lab-3d-reduced').addEventListener('change', event => {
    LAB_STATE.settings.reducedMotion = event.target.checked ? 'on' : 'auto';
    labSave();
    if (LAB.bench) LAB.bench.setReducedMotion(labPrefersReducedMotion());
  });
  if (!gated) row.querySelector('.lab-do-reduced').after(el(readAloud));
  row.querySelector('#lab-3d-read-aloud').addEventListener('change', event => {
    LAB_STATE.settings.readAloud = event.target.checked;
    labSave();
    if (event.target.checked) labSpeak(ctx.clip.caption, { force: true });
    else labSpeechStop();
  });
  return row;
}
/* ---------- read-aloud (BENCH-3): the browser's own voice reads each clip caption ---------- */
const labSpeechSupported = () =>
  typeof window !== 'undefined' && !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function';
let labSpokenLast = '';
function labSpeechStop() {
  labSpokenLast = '';
  if (labSpeechSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* no voice: nothing to stop */
    }
  }
}
// Speaks `text` once (a repaint of the same caption stays silent) while the setting is on.
function labSpeak(text, { force = false } = {}) {
  const words = typeof text === 'string' ? text.trim() : '';
  if (!LAB_STATE.settings.readAloud || !labSpeechSupported()) return false;
  if (!words) return (labSpeechStop(), false);
  if (!force && words === labSpokenLast) return false;
  labSpokenLast = words;
  try {
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(words);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}
// The station row (§11.2): one button per station in bench order plus "Whole bench", directly under the
// stage (above the HUD), always there in the bench phase. A press flies there; the row never scrolls the
// page. The current station carries aria-current (labUpdateStation, from the bench's api.onStation).
function labStationRow(lab, ctx) {
  // §13.3: "Your jars" (S9) only on the free bench while it has extra jars (the tray is drawn only then).
  const extra = labExtraJarsForBench(lab, ctx).length > 0;
  const stations = lab.listStations().filter(s => s.id !== LAB_JARS_STATION || extra);
  const button = (id, text) =>
    `<button type="button" class="lab-station-btn" data-lab-station="${esc(id)}"${ctx.station === id ? ' aria-current="true"' : ''}>${esc(text)}</button>`;
  const nav = el(
    `<nav class="lab-stations" id="lab-stations" aria-label="Bench stations" hidden>${stations
      .map(s => button(s.id, labStationShort(s)))
      .join('')}${button('overview', 'Whole bench')}</nav>`
  );
  nav.addEventListener('click', event => {
    const target = event.target && event.target.closest ? event.target.closest('.lab-station-btn') : null;
    if (!target || !nav.contains(target)) return;
    const id = target.dataset.labStation;
    if (LAB.bench && typeof LAB.bench.goToStation === 'function')
      try {
        LAB.bench.goToStation(id);
      } catch {
        /* the camera is cosmetic here */
      }
    ctx.station = id;
    labUpdateStation(lab, ctx);
    if (id !== 'overview') labEvents.emit('station', id);
    labHudSoon(ctx);
  });
  return nav;
}
// Runs `change` (a layout change: the side sheet opening or closing beside list mode) and scrolls the page
// by however far `node` moved, so what sits under the pointer stays there (FIX2).
function labKeepY(node, change) {
  const top = () => (node && node.isConnected ? node.getBoundingClientRect().top : null);
  const before = top();
  change();
  const after = top();
  if (before === null || after === null || Math.abs(after - before) < 1) return;
  if (typeof window !== 'undefined' && typeof window.scrollBy === 'function')
    window.scrollBy({ top: after - before, behavior: 'instant' });
}
// The row whose step sheet is open is marked (.lab-step-viewing), so the list says which step it explains.
function labSyncViewing(ctx, doc = typeof document === 'undefined' ? null : document) {
  if (!doc) return;
  const id = ctx.sheet && (ctx.sheet.kind === 'step' || ctx.sheet.kind === 'jar') ? ctx.sheet.id : null;
  for (const row of doc.querySelectorAll('li.lab-step[data-lab-step], li.lab-step[data-lab-jar]'))
    row.classList.toggle('lab-step-viewing', !!id && (row.dataset.labJar || row.dataset.labStep) === id);
}
// List mode: the nine steps in procedure order in place of the stage (done, next, to do, or skipped by
// the run's setting: never next, never done; ENGINE-14). On the free bench nothing is next and a done
// row reads "done" / "done ×N" (§11.1). `verbs` (GAME-shell): each row carries what a
// click does, and with `drop` what a dropped slide does (aria-hidden, shown on hover by lab.css, only
// where the list is wide enough to keep the title whole). A done step says how the log has it ("done
// twice", "done (out of order)"); `note` ({ id, text }, E5) is the lab's reaction on the row the
// student just acted on (aria-hidden: the live region says it; no verbs there). H13 (FIX4): the state
// sits on its own line under the title (`span.lab-step-line`, one line kept for it while a run exists),
// and a note takes that same line in place of the state (lab.css), so a note coming or going never
// changes a row's height and no row moves; a sheet over the list's right side never hides a state.
// MODE-FIX-shell-28: on the free bench the rows carry a jar glyph (`.lab-step-order.lab-step-jar`, drawn by
// lab.css) in place of the circled numeral: nothing is next and no order is framed (§11.1); practice keeps
// its numbers. A count reads "×N" and, for screen readers, "N times".
// §13.3: on the free bench (with the engine's shelf) the rows are the jars: the procedure's nine
// (`data-lab-jar` = `data-lab-step` = the step) and the extra ones (`data-lab-jar` x1..x4, no step), each with
// a second line saying what is in it, "(changed)" when that is not the procedure's.
function labStepList(lab, run, { verbs = false, drop = false, note = null } = {}) {
  const p = labStepProgress(lab, run);
  if (!p.steps.length) return el('<div class="lab-step-list-empty"></div>');
  const deviations = run && Array.isArray(run.deviations) ? run.deviations : [];
  const logged = (id, kind) => deviations.some(d => d && d.step === id && d.kind === kind);
  const free = labIsFree(run);
  const jars = free ? labJars(lab, run) : [];
  const rows = jars.length
    ? jars.map(jar => ({ ...(jar.step ? labStepById(lab, jar.step) : {}), id: jar.id, jar }))
    : p.steps.map(step => ({ ...step, jar: null }));
  return el(
    `<ol class="lab-step-list" aria-label="${jars.length ? 'Jars on the bench' : 'Steps in procedure order'}">${rows
      .map(step => {
        // Before any run nothing is next or still to do (G9): the rows are the procedure, not a run.
        const skipped = !free && p.skipped.has(step.id),
          done = !skipped && p.done.has(step.id),
          next = !!run && !free && !!p.next && p.next.id === step.id;
        const times = free && done ? labStepCount(run, step.id) : 0;
        const how = !done
          ? ''
          : free
            ? times > 1
              ? `<span class="lab-step-how"><span aria-hidden="true"> ×${times}</span><span class="lab-sr-only"> ${times} times</span></span>`
              : ''
            : logged(step.id, 'repeated')
              ? '<span class="lab-step-how"> twice</span>'
              : logged(step.id, 'out-of-order')
                ? '<span class="lab-step-how"> (out of order)</span>'
                : '';
        // Performed anyway (an older save): the log has it, the engine records it as not planned.
        const state = skipped
          ? esc(p.done.has(step.id) ? `${LAB_SKIPPED_WORDS}, but done` : LAB_SKIPPED_WORDS)
          : done
            ? `<span aria-hidden="true">✓</span> done${how}`
            : next
              ? 'next'
              : run
                ? '<span class="lab-sr-only">to do</span>'
                : '';
        const noted = !!note && note.id === step.id && !!note.text;
        const reaction = noted ? `<span class="lab-step-note" aria-hidden="true">${esc(note.text)}</span>` : '';
        const hints =
          verbs && !noted
            ? `<span class="lab-step-verbs" aria-hidden="true">${labHint('Click', 'what it does')}${drop && !skipped ? ` ${labHint('Drop the slide', 'dip')}` : ''}</span>`
            : '';
        const jar = step.jar;
        const title = jar ? jar.title : labStepTitle(step);
        const contents = jar
          ? `<span class="lab-step-contents">${esc(jar.text)}${jar.changed ? ' <span class="lab-jar-changed">(changed)</span>' : ''}</span>`
          : '';
        const ids = jar
          ? `data-lab-jar="${esc(jar.id)}"${jar.step ? ` data-lab-step="${esc(jar.step)}"` : ''}`
          : `data-lab-step="${esc(step.id)}"`;
        return `<li class="lab-step${done ? ' lab-step-done' : ''}${next ? ' lab-step-next' : ''}${skipped ? ' lab-step-skipped' : ''}${noted ? ' lab-step-noted' : ''}${jar && jar.extra ? ' lab-step-extra' : ''}${jar && jar.changed ? ' lab-step-changed' : ''}" ${ids}${skipped ? ' data-lab-step-skipped' : ''}${next ? ' aria-current="step"' : ''}><span class="lab-step-order${free ? ' lab-step-jar' : ''}" aria-hidden="true">${free ? '' : esc(step.order)}</span><span class="lab-step-main"><span class="lab-step-title">${esc(title)}</span>${contents}<span class="lab-step-line"><span class="lab-step-state">${state}</span>${reaction}</span></span>${hints}</li>`;
      })
      .join('')}</ol>`
  );
}
// The steps part's heading (§11.1): "The procedure" in practice (and before any run), "The bench" on the
// free bench. No numbers.
const labDoHeading = run => (labIsFree(run) ? 'The bench' : 'The procedure');
function labDoSection(lab, run, ctx, mode) {
  let section;
  if (mode === '3d') section = labBench3D(lab, run, ctx);
  else {
    section = el(
      `<section class="lab-part lab-do" id="lab-do" aria-labelledby="lab-do-h"><h2 id="lab-do-h" tabindex="-1">${labDoHeading(run)}</h2><div data-lab-slot="controls"></div></section>`
    );
    const play = labCanDip(lab, ctx);
    const note = ctx.stepNote && ctx.stepNote.runId === ctx.runId ? ctx.stepNote : null;
    const list = labStepList(lab, run, { verbs: true, drop: play, note });
    section.querySelector('[data-lab-slot="controls"]').before(list);
    // The free bench's keyboard path sits above the list (§11.1), with the slide chip's bar.
    if (labIsFree(run)) list.before(labFreeRow(lab, run, ctx, mode));
    labListPlay(lab, ctx, section, list, play);
  }
  section.querySelector('[data-lab-slot="controls"]').replaceWith(labDoControls(lab, run, ctx, mode));
  return section;
}
// List mode as a bench (contract §10, GAME-shell). A row's click explains its step (the sheet, as on a
// jar); rows stay plain list items, since Explain this step (Explain a step before a run) and its
// "Explain another step" select are the keyboard's way. A hint line above the list says what a click
// does. While the run has a step left and is not locked (`play`), the slide chip drags
// onto any row: the drop does that step through ctx.doStep, the path of "Do a different step", or
// says in #lab-drop-note why it does nothing (labDropHint). The chip and its hints repeat keyboard
// paths, so they are aria-hidden; only the note (role=status) speaks.
function labListPlay(lab, ctx, section, list, play) {
  if (!list.matches('ol')) return;
  list.classList.add('lab-step-list-click');
  // The list holds still under the pointer (FIX2): the sheet's column change keeps the clicked row at its
  // height on screen, and a double click's second click opens nothing (only the first one counts); its
  // second press keeps focus where the first click put it (the sheet) and selects no word.
  list.addEventListener('mousedown', event => {
    if (event.detail > 1 && event.target && event.target.closest && event.target.closest('li.lab-step'))
      event.preventDefault();
  });
  // A row click opens its sheet over the page (`overlay`, FIX3): the list keeps its width, so the row stays
  // under the pointer sideways too (a sheet already open keeps its layout, labOpenSheet). The press that
  // follows within a double click's time is ignored wherever it lands (labBenchMount's guard).
  list.addEventListener('click', event => {
    if (event.detail > 1) return;
    const row = event.target && event.target.closest ? event.target.closest('li.lab-step') : null;
    if (!row || !list.contains(row)) return;
    ctx.rowClickAt = Date.now();
    // §13.3: an extra jar's row (no step) opens its jar sheet; a procedure jar's opens its step's sheet,
    // which carries the jar's editor on the free bench.
    const sheet = row.dataset.labStep
      ? { kind: 'step', id: row.dataset.labStep }
      : { kind: 'jar', id: row.dataset.labJar };
    labKeepY(row, () => labOpenSheet(lab, ctx, { ...sheet, follow: false, opener: null, overlay: true }));
  });
  // §13.3: on the free bench the rows are jars, and the hints say so.
  const noun = list.querySelector('li[data-lab-jar]') ? 'jar' : 'step';
  const click = labHint(labTouch() ? `Tap a ${noun}` : `Click a ${noun}`, 'what it does');
  if (!play) {
    list.before(el(`<p class="lab-hints lab-list-hints" aria-hidden="true">${click}</p>`));
    return;
  }
  const bar = el(`<div class="lab-play" data-lab-play>
    <div class="lab-slide-chip" data-lab-slide-chip aria-hidden="true"><span class="lab-slide-glass"></span>Your slide</div>
    <p class="lab-hints" aria-hidden="true">${labHint(`Drag the slide onto a ${noun}`, 'dip it')} ${click}</p>
  </div>`);
  const note = el('<p class="lab-drop-note lab-sr-only" id="lab-drop-note" role="status"></p>');
  list.before(bar, note);
  labSlideDrag(lab, ctx, { chip: bar.querySelector('[data-lab-slide-chip]'), list, note, host: section });
}
// The step row under a point: the browser's own hit test (the ghost takes no pointer events), else the
// rows' boxes.
function labRowAt(list, x, y) {
  const doc = list.ownerDocument;
  const hit =
    typeof doc.elementFromPoint === 'function'
      ? doc.elementFromPoint(x, y)
      : [...list.querySelectorAll('li.lab-step')].find(row => {
          const r = row.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        }) || null;
  const row = hit && typeof hit.closest === 'function' ? hit.closest('li.lab-step') : null;
  return row && list.contains(row) ? row : null;
}
// G6: a refused drop's reason on that row (aria-hidden: #lab-drop-note says it), in place of the row's
// verbs. It stays until the list is drawn again (a drop that is taken). H13 (FIX4): it takes the row's
// state line (the line kept for the state under the title), so the row keeps its height and no row moves.
function labRowRefusal(row, hint) {
  const slot = row.querySelector('.lab-step-line');
  if (!slot) return;
  let line = slot.querySelector('.lab-step-refused');
  if (!line) {
    slot.querySelector('.lab-step-note')?.remove(); // one reaction per row
    line = slot.appendChild(el('<span class="lab-step-note lab-step-refused" aria-hidden="true"></span>'));
    row.classList.add('lab-step-noted');
    row.querySelector('.lab-step-verbs')?.remove();
  }
  if (line.textContent !== hint) line.textContent = hint;
  labClearStickyBar(row);
}
// G6: a row the student just acted on (a drop) never sits under a phone's sticky "Do this step": the page
// scrolls just enough to show the row's bottom above it, never the row's top under the top bar. H5 (FIX4):
// only the bar counts; the floating Notes button moves itself out of the way (labNotesFloatSync). I5
// (FIX5): an open notes drawer (slim after the drop, its bar) counts like the bar: the row clears its top.
function labClearStickyBar(row) {
  const doc = row && row.ownerDocument;
  const win = doc && doc.defaultView;
  if (!win || typeof row.getBoundingClientRect !== 'function') return;
  const over = labStuckBar(doc); // in the flow (not stuck) it sits under the list, over no row
  const drawer = labViewportInsets().bottom;
  const limit = Math.min(over ? over.top : Infinity, drawer ? win.innerHeight - drawer : Infinity);
  if (!Number.isFinite(limit)) return;
  const box = row.getBoundingClientRect();
  const cover = box.bottom + 8 - limit;
  if (cover <= 0 || box.top >= win.innerHeight) return;
  const room = box.top - labTopbarHeight() - 8;
  const delta = Math.min(cover, Math.max(0, room));
  if (delta > 0 && typeof win.scrollBy === 'function') win.scrollBy({ top: delta, behavior: 'instant' });
}
// How long after a row click a multi-click's later presses still belong to it (FIX3, desktop-3).
const LAB_DOUBLE_CLICK_MS = 600;
// A press on the slide becomes a drag after this much movement (a plain click does nothing).
const LAB_DRAG_PX = 4;
// While a dragged slide is this close to the bottom of the window, or to the bottom of the site's top
// bar, the page scrolls toward that edge (at most LAB_DRAG_SCROLL_PX a frame, faster nearer the edge):
// a held finger cannot scroll the page (the chip is touch-action none), so rows below the fold come up
// to it (a 320 px phone shows the last rows only after a scroll). MODE-FIX-shell-7: the scroll starts only
// after the finger has rested in the band for LAB_DRAG_SCROLL_DELAY_MS (a drag that ends in the band drops
// on the row its tip names) and moves at most 4 px a frame (about a row every 200 ms), so the tip under a
// resting finger can be read before the lift.
const LAB_DRAG_EDGE_PX = 48;
const LAB_DRAG_SCROLL_PX = 4;
const LAB_DRAG_SCROLL_DELAY_MS = 350;
const labDragClock = win =>
  win && win.performance && typeof win.performance.now === 'function' ? win.performance.now() : Date.now();
// The scroll step for a pointer at `y` (client px) between `top` (the top bar's bottom) and `bottom`
// (the window's height): > 0 down, < 0 up, 0 outside both edge bands. An edge counts only once
// `armed` says the pointer has been out of its band (a drag that starts in a band does not scroll).
function labDragScrollDelta(y, top, bottom, { up = true, down = true } = {}) {
  if (!Number.isFinite(y) || !(bottom - top > 2 * LAB_DRAG_EDGE_PX)) return 0;
  const speed = depth => Math.ceil(LAB_DRAG_SCROLL_PX * Math.min(1, depth / LAB_DRAG_EDGE_PX));
  if (down && y > bottom - LAB_DRAG_EDGE_PX) return speed(y - (bottom - LAB_DRAG_EDGE_PX));
  if (up && y < top + LAB_DRAG_EDGE_PX) return -speed(top + LAB_DRAG_EDGE_PX - y);
  return 0;
}
// The bottom of the part of the window a dragged slide can reach: the window's bottom, or the top of an
// open notes drawer (G7: it shrinks to its bar while a drag is on, so this is read once that applies).
function labDragBottom(doc, win) {
  const bottom = win ? win.innerHeight : 0;
  const pad = doc ? doc.querySelector('#lab-notepad') : null;
  if (!pad || pad.hidden || !win || typeof win.getComputedStyle !== 'function') return bottom;
  if (win.getComputedStyle(pad).position !== 'fixed') return bottom;
  const top = pad.getBoundingClientRect().top;
  return top > 0 && top < bottom ? top : bottom;
}
// Pointer drag of the slide chip: pointer capture, a ghost that follows the pointer (no animation),
// the row under it highlighted (dashed when the drop would be refused), the drop on pointerup; Escape
// and pointercancel cancel. Nothing changes until a drop the run can take. The layout holds still
// while a drag is on: a refused drop's note stays until a drop is taken (the rows never jump under
// the pointer), and the sticky "Do this step" bar of a phone hides (#lab-do.lab-slide-dragging) so
// it never covers a row.
function labSlideDrag(lab, ctx, { chip, list, note, host }) {
  let drag = null,
    doc = null; // read at the press: el() builds the chip in a template's own document
  const mark = row => {
    for (const other of list.querySelectorAll('.lab-step-over'))
      if (other !== row) other.classList.remove('lab-step-over', 'lab-step-drop-no');
    if (!row) return '';
    const hint = labDropHint(lab, ctx, row.dataset.labJar || row.dataset.labStep);
    row.classList.add('lab-step-over');
    row.classList.toggle('lab-step-drop-no', !!hint);
    return hint;
  };
  const samePointer = event => !drag || drag.pointerId === undefined || event.pointerId === drag.pointerId;
  const view = () => (doc && doc.defaultView) || null;
  // The ghost and the row under the pointer (also after an auto-scroll moved the rows under it).
  function follow() {
    const row = labRowAt(list, drag.x1, drag.y1);
    const hint = mark(row);
    const tip = row ? hint || `Drop here: ${labJarTitleById(row.dataset.labJar || row.dataset.labStep)}` : 'Your slide';
    const label = drag.ghost.querySelector('.lab-slide-ghost-tip');
    if (label.textContent !== tip) label.textContent = tip;
  }
  function scrollTick() {
    if (!drag) return;
    drag.raf = 0;
    const win = view();
    if (!drag.ghost || !win || typeof win.scrollBy !== 'function') return;
    const delta = labDragScrollDelta(drag.y1, drag.top, drag.bottom, drag.armed);
    if (!delta) {
      drag.bandSince = 0;
      return;
    }
    if (labDragClock(win) - drag.bandSince < LAB_DRAG_SCROLL_DELAY_MS) {
      drag.raf = win.requestAnimationFrame(scrollTick); // the dwell: the finger rests, the rows hold still
      return;
    }
    const before = win.scrollY;
    win.scrollBy({ top: delta, behavior: 'instant' }); // never the page's smooth scroll: it follows the finger
    if (win.scrollY === before) return; // the page's end: a later move starts it again
    follow();
    drag.raf = win.requestAnimationFrame(scrollTick);
  }
  function stop() {
    if (doc) {
      doc.removeEventListener('pointermove', move, true);
      doc.removeEventListener('pointerup', up, true);
      doc.removeEventListener('pointercancel', stop, true);
      doc.removeEventListener('keydown', key, true);
    }
    const was = drag;
    drag = null;
    if (!was) return;
    if (was.raf && view()) view().cancelAnimationFrame(was.raf);
    if (was.ghost) was.ghost.remove();
    chip.classList.remove('lab-dragging');
    host.classList.remove('lab-slide-dragging');
    mark(null);
    // I5 (FIX5): an open drawer stays slim after the drag (until the student opens it again), and the floating
    // Notes button is placed afresh (the drag hid it; an auto-scroll may have ended with no scroll event).
    if (was.ghost) labNotesSlim(true);
    else labNotesFloatSync();
    if (was.pointerId !== undefined && typeof chip.releasePointerCapture === 'function')
      try {
        chip.releasePointerCapture(was.pointerId);
      } catch {
        /* capture already gone */
      }
  }
  function move(event) {
    if (!drag || !samePointer(event)) return;
    const win = view();
    if (!drag.ghost) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < LAB_DRAG_PX) return;
      chip.classList.add('lab-dragging');
      host.classList.add('lab-slide-dragging');
      drag.top = labTopbarHeight(); // the site's top bar does not change during a drag
      drag.bottom = labDragBottom(doc, win); // the window's bottom, or an open drawer's top (G7)
      // the press point counts: a press outside a band arms that band's edge
      drag.armed.up = drag.y >= drag.top + LAB_DRAG_EDGE_PX;
      drag.armed.down = !!win && drag.y <= drag.bottom - LAB_DRAG_EDGE_PX;
      drag.ghost = el(
        '<div class="lab-slide-ghost" aria-hidden="true"><span class="lab-slide-glass"></span><span class="lab-slide-ghost-tip">Your slide</span></div>'
      );
      host.appendChild(drag.ghost);
    }
    if (event.cancelable) event.preventDefault();
    drag.x1 = event.clientX;
    drag.y1 = event.clientY;
    drag.ghost.style.top = `${event.clientY}px`;
    follow();
    // MODE-FIX-shell-6: the ghost (centred on the pointer) stays inside the window with the page's 16 px
    // gutter, so its tip reads on a phone's left-side thumb path; measured after follow(), whose tip can
    // change the ghost's width.
    const half = drag.ghost.offsetWidth / 2;
    const vw = win ? win.innerWidth : 0;
    const x = vw ? Math.min(Math.max(event.clientX, 16 + half), Math.max(16 + half, vw - 16 - half)) : event.clientX;
    drag.ghost.style.left = `${x}px`;
    if (!win) return;
    if (event.clientY >= drag.top + LAB_DRAG_EDGE_PX) drag.armed.up = true;
    if (event.clientY <= drag.bottom - LAB_DRAG_EDGE_PX) drag.armed.down = true;
    const inBand = !!labDragScrollDelta(event.clientY, drag.top, drag.bottom, drag.armed);
    if (!inBand) drag.bandSince = 0;
    else if (!drag.bandSince) drag.bandSince = labDragClock(win);
    if (!drag.raf && typeof win.requestAnimationFrame === 'function' && inBand)
      drag.raf = win.requestAnimationFrame(scrollTick);
  }
  function up(event) {
    if (!drag || !samePointer(event)) return;
    const row = drag.ghost && list.isConnected ? labRowAt(list, event.clientX, event.clientY) : null;
    stop();
    if (!row) return;
    const stepId = row.dataset.labJar || row.dataset.labStep; // §13.3: a jar row names its jar
    const hint = labDropHint(lab, ctx, stepId);
    if (hint) {
      // G6: the reason shows on the row the slide was dropped on (the list above it never moves); the
      // status line (read by screen readers, out of view) names the step.
      note.textContent = `${labJarTitleById(stepId)}: ${hint}`;
      labRowRefusal(row, hint);
    } else {
      note.textContent = '';
      ctx.doStep(stepId, '#lab-do-step', { fromList: true });
    }
  }
  function key(event) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    stop();
  }
  chip.addEventListener('pointerdown', event => {
    if (drag || event.button > 0 || event.isPrimary === false) return;
    event.preventDefault();
    doc = chip.ownerDocument;
    drag = {
      x: event.clientX,
      y: event.clientY,
      x1: event.clientX,
      y1: event.clientY,
      pointerId: event.pointerId,
      ghost: null,
      top: 0,
      bottom: 0,
      raf: 0,
      bandSince: 0, // when the pointer came into an edge band (the scroll waits LAB_DRAG_SCROLL_DELAY_MS)
      armed: { up: false, down: false }, // an edge scrolls once the pointer has been out of its band
    };
    if (event.pointerId !== undefined && typeof chip.setPointerCapture === 'function')
      try {
        chip.setPointerCapture(event.pointerId);
      } catch {
        /* the document listeners still follow the pointer */
      }
    doc.addEventListener('pointermove', move, true);
    doc.addEventListener('pointerup', up, true);
    doc.addEventListener('pointercancel', stop, true);
    doc.addEventListener('keydown', key, true);
  });
  chip.addEventListener('lostpointercapture', () => stop());
}

/* ---------- bench: step side sheet (Explain this step; a jar or object on the 3D bench) ---------- */
// Model effects and rule titles in plain words (the same clauses: a step's model effect lists its
// rules' titles). Rule ids stay for Sources; text that matches nothing passes through unchanged.
const LAB_EFFECT_WORDS = [
  [
    /^Rate phase: schematic position of the development endpoint relative to the reference$/,
    "Timing: where the development time sits on the model's scale compared with the procedure's (before, at or after it)",
  ],
  // R-model-01 as a whole: "fixes" read as fixation, and the sentence named step 4 from step 2 (F15).
  [
    /^Binding \(schematic\): the model fixes the bound-ionic-silver ordinal at the ammoniacal-silver step from impregnation\.endpoint/,
    'Bound silver: the impregnation time sets how much silver binds; the model reads it at the ammoniacal silver bath (step 4)',
  ],
  [/^Binding \(schematic\): /, 'Bound silver: '],
  [/^Nuclei: /, 'Silver nuclei: '],
  [/^Deposit: /, 'Visible silver: '],
  [/^Visibility: /, 'What you see: '],
  [
    /^Background \(schematic assumption; no source for Bielschowsky\): /,
    'Background (an assumption of the model, with no source for this stain): ',
  ],
  [/the bound-ionic-silver ordinal/g, 'the bound silver level'],
  [/from impregnation\.endpoint/g, 'from the impregnation time'],
  [/at the ammoniacal-silver step/g, 'at the ammoniacal silver bath'],
  [/reduced-silver nuclei/g, 'silver nuclei'],
  [/grows deposit on nuclei/g, 'grows visible silver on the nuclei'],
  [/development endpoint/g, 'development time'],
  [/background deposit by one ordinal step/g, 'the background by one step on the model scale'],
  [
    /accumulated deposit, never presence and never bound ionic silver/g,
    'built-up silver, never the amount of target and never bound silver',
  ],
];
const labPlainRule = text => LAB_EFFECT_WORDS.reduce((out, [from, to]) => out.replace(from, to), String(text || ''));
// Keep in mind in plain words (F16): the engine's caveats name enum values, "the registry" and "v1";
// the engine text itself stays under Sources.
const LAB_CAVEAT_WORDS = [
  [
    /Endpoint positions early \/ sop-default \/ extended are ordered schematic positions\./g,
    "Shorter, standard and longer are ordered places on the model's scale, not times.",
  ],
  [
    /Nothing is known about where the course SOP's actual times fall on any binding or deposition curve\./g,
    "No one knows where the course's real times fall on a binding or build-up curve.",
  ],
  [
    /Longer development is assumed to raise background in this schematic; no source in the registry supports or refutes this for Bielschowsky\./g,
    'The model assumes that longer development raises the background; no source in this lab supports or refutes this for this stain.',
  ],
  [
    /Toning and thiosulfate are recorded but have no modeled effect in v1 \(no sourced rule\)\.?/g,
    'Gold toning and thiosulfate are recorded in the log, but they change nothing in this teaching model (no rule with a source).',
  ],
  [/^Bielschowsky staining is reported/g, 'This stain is reported'],
  [
    /this run's temperature deviates from the SOP, so the outcome is low-confidence and no direction of change is encoded/g,
    "this run changes the temperature from the procedure's, so the model marks the picture low confidence and gives no direction of change",
  ],
  [
    /Protocol deviation: at least one step was performed out of the course procedure order or repeated\./g,
    'At least one step was done out of procedure order or done twice.',
  ],
  [
    /The illustrative state is whatever the performed order produced/g,
    'The picture is whatever that order produces in the model',
  ],
  [/describes the staining consequence of this deviation/g, 'describes what this does to a real stain'],
  [/so nothing beyond the recorded deviation is encoded/g, 'so the model adds nothing beyond the record'],
  [/The course SOP developer is not characterized here/g, "The course's developer is not described here"],
  [
    /the strength positions weak \/ sop-default \/ strong are ordered schematic positions only/g,
    "weaker, standard and stronger are only ordered places on the model's scale",
  ],
  [
    /are schematized from different bases \(ordinal model for the Bielschowsky run; Velasco 1992 description for CPS\)/g,
    'come from different bases (the teaching model for the Bielschowsky run; the Velasco 1992 description for CPS)',
  ],
  [
    /so per-site differences are not computed; view the two labeled outcomes side by side and read each method's own sources/g,
    'so no difference is computed; read each picture on its own, with its own sources',
  ],
  [
    /Compare-only method; not runnable on the bench; schematic from the published description\./g,
    'Compare only: no bench steps; the picture is drawn from the published description.',
  ],
  [/The cap on binding under wax is a schematic device/g, 'The cap on binding under wax is a device of the model'],
  [/\bthe schematic shows\b/g, 'the drawing shows'],
  [
    /Axon 0 and plaque core 1 \(trace\) are schematic readings of the CPS-II description/g,
    'Axons at none and plaque cores at trace are the drawing’s reading of the CPS-II description',
  ],
  [/\bin the registry\b/g, 'in this lab'],
];
const labPlainCaveat = text => LAB_CAVEAT_WORDS.reduce((out, [from, to]) => out.replace(from, to), String(text || ''));
// Keep in mind: the plain list in view; the Sources disclosure below repeats the engine's own words.
const labCaveatsHtml = (caveats, level) =>
  `${labHeading(level, LAB_WORDS.keepInMind)}<ul class="lab-caveats">${labList((caveats || []).map(labPlainCaveat))}</ul>`;
const labEngineCaveatsHtml = caveats =>
  caveats && caveats.length
    ? `<p class="lab-dim">${esc(LAB_WORDS.keepInMind)}, as the model words it:</p><ul class="lab-caveats lab-caveats-engine">${labList(caveats)}</ul>`
    : '';
function labEffectItems(text) {
  const raw = String(text || '').trim();
  if (!raw || /^No modeled effect/i.test(raw))
    return ['Nothing: no sourced rule gives this step an effect, so the picture does not change.'];
  return raw
    .split(/(?<=\));\s/) // clauses end with their rule ids: "…sites (R-model-02); Deposit: …"
    .map(part => part.replace(/\s*\((R-[^)]*)\)/g, '').trim())
    .filter(Boolean)
    .map(labPlainRule);
}
const LAB_SHEET_OBJECTS = {
  microscope: {
    title: 'Microscope',
    text: 'The 2D microscope view of the current run.',
    action: 'microscope',
    button: 'Open the microscope',
  },
  notebook: {
    title: 'Notebook',
    text: 'Your report: runs, measurements and notes.',
    action: 'notebook',
    button: 'Open my report',
    // G4: with the report off (LAB_FLAGS) the object never points at it
    offText: 'A lab notebook. Your notes go in the Notes panel (the Notes button).',
  },
  whiteboard: {
    title: 'Whiteboard',
    text: 'Plan an experiment before you look at its runs.',
    action: 'designer',
    button: 'Open the designer',
    offText: 'A whiteboard for planning. Planning experiments is not part of this build.',
  },
  rack: {
    title: 'Slide rack',
    text: "Holds the slide of the current run. Its tint follows the procedure's by-eye column; it is a drawing, not a stain image.",
  },
  'waste-silver': {
    title: 'Silver waste',
    text: "Ammoniacal silver and developer go to the silver waste container the lab's EHS procedure names (the course procedure).",
    station: 'S7',
  },
  'waste-solvent': {
    title: 'Solvent waste',
    text: "Xylene and ethanol are never poured away; they go to the waste container the lab's EHS procedure names.",
    station: 'S7',
  },
  ppe: {
    title: 'Personal protective equipment',
    text: 'Gloves, goggles and a lab coat from set-up to clean-up, and plastic forceps near silver (the course procedure).',
    station: 'S7',
  },
  'safety-binder': {
    title: 'Safety binder',
    text: "The course procedure's safety notes: PPE for every reagent, the waste containers the lab's EHS procedure names, and each reagent's safety data sheet, read before the first run.",
    station: 'S7',
  },
  specimen: {
    title: 'Specimen tray',
    text: 'A brain drawn for teaching, not taken from any atlas. The intro picks a patch of cortex, cuts a thin section and lands it on the first slide.',
    action: 'intro',
    button: 'Play the intro',
  },
};
// The step's quantities from the course procedure (methods.json `quantities`, plus `requiresHood`) as a
// definition list; a value the procedure does not give is left out (§11.7: nothing waits on anyone).
const LAB_QUANTITY_LABELS = Object.freeze({
  reagent: 'Reagent',
  concentration: 'Strength',
  time: 'Time',
  temperature: 'Temperature',
});
function labQuantitiesHtml(step) {
  const quantities = labIsObj(step.quantities) ? step.quantities : {};
  const given = value => typeof value === 'string' && value.trim() && value !== 'unspecified';
  const rows = Object.entries(LAB_QUANTITY_LABELS)
    .filter(([key]) => given(quantities[key]))
    .map(([key, label]) => [label, quantities[key]]);
  if (step.requiresHood === true || step.requiresHood === false)
    rows.push(['Fume hood', step.requiresHood ? 'yes' : 'not needed']);
  if (!rows.length)
    return '<p class="lab-sheet-quant lab-dim">The course procedure gives no time, temperature or amount for this step.</p>';
  return `<dl class="lab-sheet-quant">${rows
    .map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`)
    .join('')}</dl>`;
}
const labHazardListHtml = hazards =>
  hazards.length
    ? `<ul class="lab-hazards">${hazards
        .map(
          h =>
            `<li><p class="lab-hazard-title"><strong>${esc(h.title || h.id)}</strong></p><p class="lab-hazard-text">${esc(h.text || '')}</p></li>`
        )
        .join('')}</ul>`
    : '<p class="lab-dim">The course procedure lists no safety note for this step.</p>';
function labSheetStep(lab, ctx, sheet) {
  const run = ctx.runId ? LAB_STATE.runs[ctx.runId] : null;
  // The sheet describes the model of the run it is opened on (MODE-FIX-shell-3): the free bench's R-react
  // rules for a free run (the engine's third argument), the procedure's model otherwise.
  const info =
    lab.explainStep(sheet.id, run ? run.method : LAB_RUNNABLE_METHOD, labIsFree(run) ? 'free' : 'practice') ||
    lab.explainStep(sheet.id);
  const p = labStepProgress(lab, run);
  const step = p.steps.find(s => s.id === sheet.id) || labStepById(lab, sheet.id);
  if (!info || !step) return null;
  const rules = [...new Set(String(info.modelEffect || '').match(/R-[A-Za-z0-9-]+/g) || [])];
  const free = labIsFree(run);
  // A step the run's settings skip (ENGINE-14, practice): the sheet says so in place of the finished
  // note, since the bench never does it. A sealed free slide: where the next slide comes from.
  const skipped = !free && p.skipped.has(step.id);
  const skipNote = skipped
    ? `<p class="lab-sheet-skipped" data-lab-sheet-skipped="${esc(step.id)}"><strong>${esc(LAB_SKIPPED_SHEET)}.</strong> This run skips ${esc(LAB_PARAM_NAMES[LAB_SKIP_FLAGS[step.id]])}, so the bench does not do this step.${labFlagText(LAB_SKIP_FLAGS[step.id], false) ? ` The course procedure says what that leaves: ${esc(labFlagText(LAB_SKIP_FLAGS[step.id], false))}.` : ''}</p>`
    : '';
  const times = free ? labStepCount(run, step.id) : 0;
  const doneWords = free
    ? times > 1
      ? ` · done ${times} times`
      : times
        ? ' · done'
        : ''
    : p.done.has(step.id)
      ? ' · done'
      : '';
  const finishedNote = free
    ? labSlideSealed(run)
      ? `<p class="lab-sheet-finished">${esc(ctx.locked ? LAB_RUN_LOCKED_TIP : `${LAB_SEALED_TIP}.`)}</p>`
      : ''
    : run && p.total && !p.next
      ? `<p class="lab-sheet-finished">${esc(labFinishedTip(ctx))}</p>`
      : '';
  const body = el(`<div class="lab-sheet-body">
    <p class="lab-sheet-kicker">Step ${esc(step.order)} of ${esc(p.steps.length || SilverLab.STEPS.length)}${skipped ? ' · skipped by this run’s setting' : doneWords} · procedure name: ${esc(step.title)}</p>
    ${skipNote || finishedNote}
    <h3 class="lab-sheet-purpose-h">What it is for</h3>
    <p>${esc(info.purpose.text)}</p>
    <h3>What the model does</h3>
    <ul class="lab-sheet-effects">${labEffectItems(info.modelEffect)
      .map(item => `<li>${esc(item)}</li>`)
      .join('')}</ul>
    <h3>Safety</h3>
    ${labHazardListHtml(info.hazards || [])}
    <h3>Time, temperature and amounts</h3>
    ${labQuantitiesHtml(step)}
    ${labSheetPickHtml(lab, run, step.id)}
    <div data-lab-slot="sources"></div>
  </div>`);
  // A jar's sheet opened from the stage carries the jar's dip line (FIX2), which a phone's tap tag cannot
  // show under this sheet, while a drop would do that step (aria-hidden: Do a different step is the
  // keyboard's way; hidden with Show hints off, like every hint).
  if (sheet.from === 'stage' && !labDropHint(lab, ctx, step.id))
    body
      .querySelector('.lab-sheet-kicker')
      .after(
        el(
          `<p class="lab-hints lab-sheet-hints" aria-hidden="true">${labHint(labTouch() ? 'Double-tap the jar or drop the slide' : 'Double-click the jar or drop the slide', 'dip')}</p>`
        )
      );
  // §13.3: on the free bench a procedure jar's sheet carries its editor first (what is in it, Edit jar).
  const editor = free ? labJarEditor(lab, ctx, run, step.id) : null;
  if (editor) body.querySelector('.lab-sheet-purpose-h').before(editor);
  body.querySelector('[data-lab-slot="sources"]').replaceWith(
    labDisclosure(
      LAB_WORDS.sources,
      () => {
        const box = el(
          `<div class="lab-sources-body"><ul class="lab-sources">${info.sources.map(s => labSourceHtml(lab, s.id)).join('') || '<li class="lab-dim">none</li>'}</ul></div>`
        );
        box.appendChild(
          labClaimChips(lab, info.purpose.claims, { label: 'Purpose claims', key: `${info.step}:claims` })
        );
        if (rules.length) box.appendChild(labRuleChips(lab, rules, { label: 'Rules for this step' }));
        return box;
      },
      { key: 'sheet-sources', cls: 'lab-sources-disclosure' }
    )
  );
  labSheetPickWire(lab, ctx, body);
  return { title: labStepTitle(step), body };
}
// The sheet's "Explain another step" select: every step's sheet without a tab stop per row. §13.3: on the
// free bench it is "Explain another jar" and reaches the extra jars too (their sheets carry the editor), so
// every jar's editor has a keyboard path.
function labSheetPickHtml(lab, run, currentId) {
  const p = labStepProgress(lab, run);
  const extra = labIsFree(run) ? labJars(lab, run).filter(j => j.extra) : [];
  return labSelectHtml(
    'lab-sheet-step',
    'step',
    [
      ...p.steps.map(s => ({ value: s.id, text: `${s.order}. ${labStepTitle(s)}` })),
      ...extra.map(j => ({ value: j.id, text: j.title })),
    ],
    currentId,
    {
      labelText: labIsFree(run) && labShelfOn(lab) ? 'Explain another jar' : 'Explain another step',
      extraClass: 'lab-sheet-pick',
    }
  );
}
function labSheetPickWire(lab, ctx, body) {
  body.querySelector('#lab-sheet-step').addEventListener('change', event => {
    const id = event.target.value;
    ctx.sheet = { ...ctx.sheet, kind: labIsExtraJar(id) ? 'jar' : 'step', id, follow: false };
    labFillSheet(lab, ctx);
    document.querySelector('#lab-sheet-step')?.focus({ preventScroll: true });
  });
}
// §13.3 the jar editor (free bench): what the jar holds now ("(changed)" when a procedure jar's contents are
// not the procedure's), then `form#lab-jar-edit`: the Bottle (the shelf grouped Procedure / Pretreatment /
// Other) and one select per field of that bottle, labels above, every value in the shelf's words with the
// procedure's marked "(procedure)"; a field with one value is shown, not offered. A new bottle starts at
// its own defaults (the procedure's contents, for the procedure's own bottle in its own jar). "Back to the
// procedure's contents" (a changed procedure jar), "Remove jar" (an extra jar). Every change saves at once.
const LAB_JAR_FIELD_LABELS = Object.freeze({
  strength: 'Strength',
  minutes: 'Time',
  tempC: 'Temperature',
  dark: 'Light',
  fresh: 'Freshness',
  ammonia: 'Ammonia',
  drops: 'Developer drops',
  into: 'Developer goes',
});
const LAB_JAR_GROUPS = [
  ['procedure', 'Procedure'],
  ['pretreatment', 'Pretreatment'],
  ['other', 'Other'],
];
const labReagentGroup = r => (r && ['procedure', 'pretreatment'].includes(r.group) ? r.group : 'other');
// A field's value in the shelf's words (its `words` map, which marks the procedure's value "(procedure)"), else
// plain units.
function labFieldWords(def, field, value) {
  const words = labIsObj(def) && labIsObj(def.words) ? def.words[String(value)] : undefined;
  if (typeof words === 'string' && words) return words;
  if (field === 'strength') return `${value}%`;
  if (field === 'minutes') return value < 1 ? `${Math.round(value * 60)} s` : `${value} min`;
  if (field === 'tempC') return value === 22 ? 'room temperature' : `${value} °C`;
  if (field === 'dark') return value ? 'in the dark' : 'in room light';
  if (field === 'drops') return `${value} drops per 50 ml`;
  return String(value);
}
function labJarEditor(lab, ctx, run, jarId) {
  const shelf = labShelf(lab);
  const jar = shelf ? labJarById(lab, run, jarId) : null;
  const reagent = jar ? shelf.byId.get(jar.solution.reagent) : null;
  if (!reagent) return null;
  const procedure = jar.step ? labJarSolution(shelf, shelf.jars[jar.step]) : null;
  const bottle = LAB_JAR_GROUPS.map(([group, label]) => {
    const items = shelf.reagents.filter(r => labReagentGroup(r) === group);
    return items.length
      ? `<optgroup label="${label}">${items
          .map(
            r =>
              `<option value="${esc(r.id)}"${r.id === reagent.id ? ' selected' : ''}>${esc(r.name)}${procedure && procedure.reagent === r.id ? ' (procedure)' : ''}</option>`
          )
          .join('')}</optgroup>`
      : '';
  }).join('');
  const fields = Object.entries(labIsObj(reagent.fields) ? reagent.fields : {}).map(([field, def]) => {
    const values = labFieldValues(def);
    // The procedure's value: this jar's own in the procedure, or the bottle's default for a procedure bottle.
    const proc =
      procedure && procedure.reagent === reagent.id ? procedure[field] : reagent.step ? def.default : undefined;
    const label = esc(def.label || LAB_JAR_FIELD_LABELS[field] || field);
    const words = v => {
      const said = labFieldWords(def, field, v);
      return v === proc && !/\(procedure\)/.test(said) ? `${said} (procedure)` : said;
    };
    if (values.length < 2)
      return `<div class="lab-field lab-jar-field lab-jar-fixed" data-lab-jar-field="${esc(field)}"><span>${label}</span><p>${esc(words(jar.solution[field]))}</p></div>`;
    return `<label class="lab-field lab-jar-field"><span>${label}</span><select id="lab-jar-${esc(field)}" name="${esc(field)}" data-lab-jar-field="${esc(field)}">${values
      .map(
        v =>
          `<option value="${esc(String(v))}"${v === jar.solution[field] ? ' selected' : ''}>${esc(words(v))}</option>`
      )
      .join('')}</select></label>`;
  });
  const box = el(`<section class="lab-jar-box" aria-labelledby="lab-jar-h" data-lab-jar-edit="${esc(jar.id)}">
    <h3 id="lab-jar-h">Edit jar</h3>
    <p class="lab-jar-now" id="lab-jar-now"><span class="lab-jar-now-label">In it now</span> <strong>${esc(jar.text)}</strong>${jar.changed ? ' <span class="lab-jar-changed">(changed)</span>' : ''}</p>
    <form class="lab-jar-edit" id="lab-jar-edit" aria-labelledby="lab-jar-h">
      <div class="lab-jar-fields">
        <label class="lab-field lab-jar-field lab-jar-bottle"><span>Bottle</span><select id="lab-jar-bottle" name="reagent">${bottle}</select></label>
        ${fields.join('')}
      </div>
      ${
        jar.extra
          ? '<div class="lab-jar-actions"><button type="button" class="lab-linkbtn lab-jar-remove" id="lab-jar-remove">Remove jar</button></div>'
          : jar.changed
            ? '<div class="lab-jar-actions"><button type="button" class="lab-linkbtn" id="lab-jar-reset">Back to the procedure’s contents</button></div>'
            : ''
      }
    </form>
    ${reagent.step === null && typeof reagent.unknownWhy === 'string' && reagent.unknownWhy ? `<p class="lab-jar-why">${esc(reagent.unknownWhy)}</p>` : ''}
  </section>`);
  const form = box.querySelector('#lab-jar-edit');
  form.addEventListener('submit', event => event.preventDefault());
  form.querySelector('#lab-jar-bottle').addEventListener('change', event => {
    const id = event.target.value;
    // A new bottle starts at its own defaults; the procedure's bottle in its own jar, at the procedure's.
    const solution = procedure && procedure.reagent === id ? procedure : labJarSolution(shelf, { reagent: id });
    ctx.editJar(jar.id, solution, '#lab-jar-bottle');
  });
  form.querySelectorAll('select[data-lab-jar-field]').forEach(select =>
    select.addEventListener('change', () => {
      const field = select.dataset.labJarField;
      const value = labFieldValues(reagent.fields[field]).find(v => String(v) === select.value);
      if (value === undefined) return;
      ctx.editJar(jar.id, { ...jar.solution, [field]: value }, `#lab-jar-${field}`);
    })
  );
  form
    .querySelector('#lab-jar-reset')
    ?.addEventListener('click', () => ctx.editJar(jar.id, procedure, '#lab-jar-bottle'));
  form.querySelector('#lab-jar-remove')?.addEventListener('click', () => ctx.removeJar(jar.id));
  return box;
}
// An extra jar's sheet (§13.3; a list row or the 3D tray's jar): what it is, the dip line from the stage, and
// the editor.
function labSheetJar(lab, ctx, sheet) {
  const run = ctx.runId ? LAB_STATE.runs[ctx.runId] : null;
  const jar = labIsFree(run) ? labJarById(lab, run, sheet.id) : null;
  const editor = jar ? labJarEditor(lab, ctx, run, jar.id) : null;
  if (!editor) return null;
  const times = labStepCount(run, jar.id);
  const body = el(
    `<div class="lab-sheet-body"><p class="lab-sheet-kicker">An extra jar on the free bench${times > 1 ? ` · done ${times} times` : times ? ' · done' : ''}</p></div>`
  );
  if (labSlideSealed(run))
    body.appendChild(
      el(`<p class="lab-sheet-finished">${esc(ctx.locked ? LAB_RUN_LOCKED_TIP : `${LAB_SEALED_TIP}.`)}</p>`)
    );
  if (sheet.from === 'stage' && !labDropHint(lab, ctx, jar.id))
    body.appendChild(
      el(
        `<p class="lab-hints lab-sheet-hints" aria-hidden="true">${labHint(labTouch() ? 'Double-tap the jar or drop the slide' : 'Double-click the jar or drop the slide', 'dip')}</p>`
      )
    );
  body.appendChild(editor);
  body.appendChild(el(`<div>${labSheetPickHtml(lab, run, jar.id)}</div>`).firstElementChild);
  labSheetPickWire(lab, ctx, body);
  return { title: jar.title, body };
}
function labSheetObject(lab, ctx, sheet) {
  const run = ctx.runId ? LAB_STATE.runs[ctx.runId] : null;
  const obj = LAB_SHEET_OBJECTS[sheet.id] || { title: 'Bench object', text: 'Nothing to explain for this object.' };
  // BENCH-1: the notebook and whiteboard objects open their pages only when turned on; off, their words
  // say what they are without pointing at a page that is not there (G4).
  const actionOn =
    obj.action === 'notebook' ? labFlags().report : obj.action === 'designer' ? labFlags().designer : true;
  const body = el(
    `<div class="lab-sheet-body"><p>${esc(!actionOn && obj.offText ? obj.offText : obj.text)}</p>${sheet.id === 'rack' && run ? `<p class="lab-dim">${esc(labRunLabel(run))}</p>` : ''}</div>`
  );
  if (obj.station)
    body.insertAdjacentHTML(
      'beforeend',
      `<h3>Safety notes</h3>${labHazardListHtml(labStationHazards(lab, obj.station))}`
    );
  // GAME (contract §10): why the microscope has nothing to show yet, in view (a double-click on it opens
  // this sheet then); the rack's drag, which a phone's tap tag cannot show under this sheet, while a
  // drop would do a step (aria-hidden: Do this step is the keyboard's way).
  const lookReason = sheet.id === 'microscope' ? labLookReason(lab, ctx) : '';
  if (lookReason) body.appendChild(el(`<p class="lab-look-reason" data-lab-look-reason>${esc(lookReason)}</p>`));
  if (sheet.id === 'rack' && labCanDip(lab, ctx))
    body.appendChild(
      el(
        `<p class="lab-hints lab-sheet-hints" aria-hidden="true">${labHint('Drag the rack onto a jar', 'dip the slide')}</p>`
      )
    );
  if (obj.action === 'intro' && !labClipSupported())
    body.appendChild(el(`<p class="lab-dim">${esc(labClipUnsupportedText())}</p>`));
  else if (obj.action && actionOn) {
    const button = el(
      `<button type="button" class="btn"${obj.action === 'intro' ? ' data-lab-clip-intro' : ''}>${esc(obj.button)}</button>`
    );
    if (obj.action === 'intro') button.hidden = ctx.clip.phase === 'intro'; // as in 3D options (UX-R2)
    button.addEventListener('click', () => {
      if (obj.action === 'intro') labClipStart(lab, ctx, 'intro');
      else if (obj.action === 'microscope') labOpenMicroscope({ runIds: run ? [run.id] : [] });
      else if (obj.action === 'notebook') labOpenNotebook();
      else labOpenDesigner();
    });
    body.appendChild(el('<div class="lab-row"></div>')).appendChild(button);
  }
  return { title: obj.title, body };
}
function labFillSheet(lab, ctx, node = typeof document === 'undefined' ? null : document.querySelector('#lab-sheet')) {
  if (!node) return;
  const sheet = ctx.sheet;
  if (sheet && sheet.kind === 'step' && sheet.follow) {
    const next = labStepProgress(lab, ctx.runId ? LAB_STATE.runs[ctx.runId] : null).next;
    if (next) sheet.id = next.id;
  }
  const content = sheet
    ? sheet.kind === 'step'
      ? labSheetStep(lab, ctx, sheet)
      : sheet.kind === 'jar'
        ? labSheetJar(lab, ctx, sheet)
        : labSheetObject(lab, ctx, sheet)
    : null;
  if (node.isConnected) labSyncViewing(ctx, node.ownerDocument);
  if (!content) {
    node.hidden = true;
    node.replaceChildren();
    return;
  }
  node.replaceChildren(
    el(
      `<div class="lab-sheet-head"><h2 id="lab-sheet-h" tabindex="-1">${esc(content.title)}</h2><button type="button" class="lab-linkbtn" id="lab-sheet-close">Close</button></div>`
    ),
    content.body
  );
  node.querySelector('#lab-sheet-close').addEventListener('click', () => labCloseSheet(lab, ctx));
  node.hidden = false;
}
const LAB_SHEET_FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
function labSheetNode(lab, ctx) {
  const node = el('<aside class="lab-sheet" id="lab-sheet" aria-labelledby="lab-sheet-h" hidden></aside>');
  node.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      labCloseSheet(lab, ctx);
      return;
    }
    // As a modal (below 900 px) Tab wraps inside the sheet.
    if (event.key !== 'Tab' || node.getAttribute('aria-modal') !== 'true') return;
    const items = [...node.querySelectorAll(LAB_SHEET_FOCUSABLE)].filter(n => !n.closest('[hidden]'));
    if (!items.length) return;
    const first = items[0],
      last = items[items.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === node.querySelector('#lab-sheet-h'))
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  labFillSheet(lab, ctx, node);
  return node;
}
// The sheet covers most of a narrow screen (and 200 % zoom): there it is a modal dialog, the page under
// it inert, so no Tab stop hides beneath it (A11Y-02). At 900 px and up it sits beside the bench, below
// the top bar, with room kept for it (lab.css), and stays a non-modal complementary panel.
const labSheetIsModal = () => labMedia('(max-width: 899.98px)') || labMedia('(max-height: 519.98px)');
function labSheetModal(ctx) {
  if (typeof document === 'undefined') return;
  const node = document.querySelector('#lab-sheet');
  for (const inert of document.querySelectorAll('[data-lab-inert]')) {
    inert.removeAttribute('inert');
    inert.removeAttribute('data-lab-inert');
  }
  const main = node ? node.closest('main') : null;
  const open = !!(node && !node.hidden && ctx.sheet);
  const modal = open && labSheetIsModal();
  // lab.css keeps room for it beside list mode; in 3D it lies over the page so the stage keeps its width
  // and a jar's second click lands where the first did (UX-POLISH), and so does a step row's sheet
  // (`overlay`, FIX3): the clicked row keeps its place under the pointer.
  if (main)
    main.classList.toggle(
      'lab-sheet-side',
      open && !modal && main.dataset.mode !== '3d' && !(ctx.sheet && ctx.sheet.overlay)
    );
  if (!node) return;
  if (modal) {
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-modal', 'true');
    // Every sibling on the way up to <body> goes inert, except live regions (they must still speak).
    for (let child = node; child.parentElement && child !== document.body; child = child.parentElement)
      for (const sibling of child.parentElement.children) {
        if (sibling === child || sibling.hasAttribute('inert')) continue;
        if (sibling.matches('[aria-live], [role="status"], [role="alert"], script, style, link')) continue;
        sibling.setAttribute('inert', '');
        sibling.setAttribute('data-lab-inert', '');
      }
  } else {
    node.removeAttribute('role');
    node.removeAttribute('aria-modal');
  }
}
// A sheet that is already open keeps its layout when it switches to another step or object (`overlay`:
// over the page; else beside list mode, labSheetModal), so nothing under the pointer moves.
function labOpenSheet(lab, ctx, sheet) {
  ctx.sheet = { ...sheet, overlay: ctx.sheet ? !!ctx.sheet.overlay : !!sheet.overlay };
  labFillSheet(lab, ctx);
  labSheetModal(ctx);
  document.querySelector('#lab-explain-open')?.setAttribute('aria-expanded', String(!!sheet.follow));
  document.querySelector('#lab-sheet-h')?.focus({ preventScroll: true });
}
// Focus goes back to whatever opened the sheet when it is still there to see (a finished run moves
// Explain into the hidden History; a jar on the canvas has no focus), else to the primary action, the
// result card or the steps heading (F10, A11Y-01, CC-5). A sheet a pointer opened (a jar or object on
// the stage, a step row: no opener) leaves the page where it is (FIX2): focus moves without a scroll,
// as after a step done on the stage, and the row it explained keeps its place on screen.
function labCloseSheet(lab, ctx) {
  const opener = ctx.sheet && ctx.sheet.opener;
  const row = ctx.sheet && ctx.sheet.kind === 'step' ? document.querySelector('li.lab-step-viewing') : null;
  labKeepY(row, () => {
    ctx.sheet = null;
    labFillSheet(lab, ctx);
    labSheetModal(ctx);
  });
  document.querySelector('#lab-explain-open')?.setAttribute('aria-expanded', 'false');
  // I5 (FIX5): with the notes drawer open (a narrow screen) the page never scrolls: focus goes back into the
  // drawer, to its textarea (to its Open button while it is slim).
  if (labNotesNarrow() && labNotesOpen()) {
    const pad = document.querySelector(labNotesSlimNow() ? '#lab-notepad-more' : '#lab-notepad-text');
    if (pad && !pad.closest('[hidden]')) return pad.focus({ preventScroll: true });
  }
  const target = [opener, '#lab-do-step:not(:disabled)', '#lab-resolve-out .lab-banner', '#lab-do-h', '#lab-result-h']
    .filter(Boolean)
    .map(sel => document.querySelector(sel))
    .find(node => node && !node.closest('[hidden]'));
  // H7: never onto a control the open notes drawer covers (labFocusUncovered).
  if (target) labFocusUncovered(document, target, { reveal: !!opener });
}

/* ---------- bench: 3. Result (one card) and the comparison ---------- */
function labScaleTableHtml(rows, head, caption) {
  return `<div class="lab-table-wrap"><table class="lab-table lab-why-table"><caption>${esc(caption)}</caption><thead><tr>${head.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map(
      r =>
        `<tr><th scope="row">${esc(r[0])}</th>${r
          .slice(1)
          .map(c => `<td>${esc(c)}</td>`)
          .join('')}</tr>`
    )
    .join('')}</tbody></table></div>`;
}
const labEngineHead = (words, engine) =>
  `${esc(words.charAt(0).toUpperCase() + words.slice(1))} <span class="lab-th-engine">${esc(engine)}</span>`;
function labRuleTitlesHtml(lab, ruleIds, level) {
  const titles = (ruleIds || []).map(id => lab.getRule(id)).filter(Boolean);
  return titles.length
    ? `${labHeading(level, 'Why the model did this')}<ul class="lab-why-rules">${titles.map(r => `<li>${esc(labPlainRule(r.title))}</li>`).join('')}</ul>`
    : '';
}
function labSourcesDisclosure(lab, key, build) {
  return labDisclosure(LAB_WORDS.sources, build, { key, cls: 'lab-sources-disclosure' });
}
// A Not modeled card in plain words: what is missing and what the model would need (never a picture).
function labCardWhyHtml(card, level) {
  if (card.code === 'step-skipped') {
    const missing = (card.outsideSupport || []).filter(id => SilverLab.STEPS.includes(id));
    const gaps = (card.outsideSupport || []).filter(id => !SilverLab.STEPS.includes(id) && labIsParamPath(id));
    // A skipped toning / thiosulfate step is a gap of its setting: "skipping gold toning" (ENGINE-14).
    const gapName = id => (id === 'toning' || id === 'thiosulfate' ? `skipping ${labParamName(id)}` : labParamName(id));
    return `<p>${esc(LAB_WORDS.inProgress)}: ${esc(missing.map(id => labStepTitle(labStepById(LAB.lab, id)) || id).join(', '))}.</p>${gaps.length ? `<p>Also Not modeled once finished: ${esc(gaps.map(gapName).join(', '))}.</p>` : ''}`;
  }
  const hyps = card.hypotheses && card.hypotheses.length;
  return `<p>${esc(labPlainEngineText(card.explanation))}</p>
    ${labHeading(level, 'What the model would need')}<ul>${labList((card.whatWouldBeNeeded || []).map(labPlainEngineText))}</ul>
    ${labHeading(level, 'What you could do next')}<ul>${labList(card.suggestedNext)}</ul>
    ${hyps ? `${labHeading(level, 'Explanations this probe could concern (none is encoded, none is favored)')}<ul class="lab-hypotheses">${card.hypotheses.map(h => `<li>${esc(SilverLab.HYPOTHESIS_TEXT[h] || h)} <code>${esc(h)}</code></li>`).join('')}</ul>` : ''}`;
}
function labWhyResult(lab, result, run, level = 3) {
  const noBasis = result.label === SilverLab.LABELS.NO_BASIS;
  const wrap = el(`<div class="lab-why-body"${noBasis ? ` data-lab-card="${esc(result.code)}"` : ''}></div>`);
  if (!noBasis) {
    const state = result.state || {};
    const rows = LAB_SUMMARY_SITES.map(site => [
      labSiteText(site),
      labOrdinal(result.perSite && result.perSite[site] ? result.perSite[site].visibility : null),
      labOrdinal((state[site] || {}).ionicBound),
      labOrdinal((state[site] || {}).nuclei),
    ]);
    rows.push([
      labSiteText('background'),
      labOrdinal(result.background),
      labOrdinal((state.background || {}).ionicBound),
      labOrdinal((state.background || {}).nuclei),
    ]);
    const deviations = (run.deviations || []).filter(d => d.kind !== 'not-runnable');
    // No "Confidence: normal" (it read as a reliability claim, F9 / KB-04); a low flag says what it means.
    wrap.innerHTML = `<p class="lab-scale">${esc(LAB_WORDS.scaleLegend)}</p>
      ${labScaleTableHtml(rows, ['Structure', labEngineHead(LAB_WORDS.visibleSilver, 'visibility'), labEngineHead(LAB_WORDS.boundSilver, 'ionicBound'), labEngineHead(LAB_WORDS.nuclei, 'nuclei')], `Each structure on the ${LAB_WORDS.modelScale}`)}
      <p>Contrast: <strong>${esc(labOrdinal(result.contrast))}</strong> (${esc(LAB_WORDS.modelScale)}): how many steps the darkest structure sits above the background (0 none … 4 high); not an amount of protein.</p>
      ${result.confidence === 'low' ? `<p class="lab-why-flag">${esc(labLowConfidenceText(result))}</p>` : ''}
      ${result.conditionalOn ? `<p>This picture assumes one explanation for the sake of argument: ${esc(SilverLab.HYPOTHESIS_TEXT[result.conditionalOn] || result.conditionalOn)}. The model does not say it is true.</p>` : ''}
      ${deviations.length ? `<p>${esc(labDeviationsText(deviations))}.</p>` : ''}
      ${labRuleTitlesHtml(lab, result.rulesApplied, level)}
      ${labCaveatsHtml(result.caveats, level)}`;
  } else wrap.innerHTML = labCardWhyHtml(result, level);
  wrap.appendChild(
    labSourcesDisclosure(lab, 'why-result-sources', () => {
      const box = el(`<div class="lab-sources-body">${noBasis ? '' : labEngineCaveatsHtml(result.caveats)}</div>`);
      box.appendChild(
        labRuleChips(lab, noBasis ? result.rulesConsulted : result.rulesApplied, {
          label: noBasis ? 'Rules consulted' : 'Rules applied',
        })
      );
      if (!noBasis)
        box.appendChild(
          el(
            `<p class="lab-dim lab-describe">${esc(lab.describeOutcome(result, lab.getSpecimen(result.specimenId)))}</p>`
          )
        );
      return box;
    })
  );
  return wrap;
}
// The thumbnail is the microscope's own synthetic renderer (with its in-canvas label plate); without
// the microscope module the slot stays an empty frame and the summary carries the content.
function labPaintThumb(lab, result, host) {
  const scope = window.CortexLabMicroscope;
  if (!host || !scope || typeof scope.renderSynthetic !== 'function') return;
  const specimen = lab.getSpecimen(result.specimenId) || null;
  const canvas = document.createElement('canvas');
  canvas.className = 'lab-result-canvas';
  host.replaceChildren(canvas);
  try {
    scope.renderSynthetic(canvas, {
      specimen,
      outcome: result,
      width: host.clientWidth || 216,
      height: host.clientHeight || 162,
      objective: 4,
      zoom: 1,
      seed: specimen ? specimen.seed : undefined,
      highContrast: !!LAB_STATE.settings.highContrast,
      tag: false,
    });
  } catch (error) {
    console.error('lab result thumbnail', error);
    host.replaceChildren();
  }
}
// §12.4: the first real photo the microscope would show for this outcome, through the microscope's own
// selection rule (CortexLabMicroscope.referenceSlides(lab, outcome, specimen) -> Asset[]); null without
// the module or the function, for a result with no picture, when none matches, or when the rule throws.
// A real photo is an observed reference of a published slide, never the student's run.
function labRealSlide(lab, result, specimen) {
  const scope = window.CortexLabMicroscope;
  if (!scope || typeof scope.referenceSlides !== 'function') return null;
  if (!labIsObj(result) || result.label === SilverLab.LABELS.NO_BASIS) return null;
  try {
    const list = scope.referenceSlides(lab, result, specimen || null);
    const first = Array.isArray(list) ? list.find(a => labIsObj(a) && typeof a.src === 'string' && a.src) : null;
    return first || null;
  } catch (error) {
    console.error('lab real slide', error);
    return null;
  }
}
// The thumbnail box (the drawing's box, 216 x 162): the real photo when one matches (object-fit cover,
// src / alt from the asset), else the empty frame labPaintThumb draws into. The box is aria-hidden: the
// button's text names it.
const LAB_REAL_SLIDE_SR = 'A real slide from a published study, not your run; the microscope shows its credit.';
function labThumbPicHtml(asset) {
  if (!asset) return '<span class="lab-result-pic" data-lab-slot="thumb" aria-hidden="true"></span>';
  const size = `${asset.width ? ` width="${esc(asset.width)}"` : ''}${asset.height ? ` height="${esc(asset.height)}"` : ''}`;
  return `<span class="lab-result-pic lab-result-pic-real" data-lab-slot="thumb" data-lab-real-slide="${esc(asset.id || '')}" aria-hidden="true"><img class="lab-result-photo" src="${esc(asset.src)}" alt="${esc(asset.description || 'Real slide')}"${size} loading="lazy" decoding="async"></span>`;
}
// The small badge above a real-photo thumbnail (visible "Real slide"; the hidden words say whose it is).
const labThumbBadgeHtml = asset =>
  asset
    ? `<p class="lab-thumb-real" data-lab-thumb-real="${esc(asset.id || '')}">${labBadge('reference-none', { label: asset.label || 'observed-reference', long: LAB_REAL_SLIDE_SR })} <span class="lab-dim lab-thumb-real-note">a published slide that matches your run's look, not your run</span></p>`
    : '';
function labResultCard(lab, run, ctx, mode) {
  const result = lab.resolve(run);
  const specimen = lab.getSpecimen(run.specimenId);
  const noBasis = result.label === SilverLab.LABELS.NO_BASIS;
  const inProgress = noBasis && result.code === 'step-skipped';
  const realSlide = noBasis ? null : labRealSlide(lab, result, specimen);
  // MODE-FIX-integrate-2: the procedure's by-eye line under the summary (the Slide now card's line), so
  // "contrast is low" on a standard run sits beside "Gray-black detail on a light background".
  const look = noBasis ? null : labRunLook(lab, run);
  const card =
    el(`<article class="lab-result-card" data-lab-result="${esc(result.label)}" ${noBasis ? `data-lab-card="${esc(result.code)}"` : `data-lab-outcome="${esc(run.id)}"`}>
    ${labBanner(result, labRunTitle(run), { focusable: true })}
    <div class="lab-result-body">
      ${noBasis ? '' : `<div class="lab-result-thumbwrap">${labThumbBadgeHtml(realSlide)}<button type="button" class="lab-result-thumb" id="lab-scope-btn" aria-expanded="${ctx.scopeOpen}" aria-controls="lab-scope-inline">${labThumbPicHtml(realSlide)}<span class="lab-result-thumb-text">${ctx.scopeOpen ? 'Close the microscope' : 'Open in the microscope'}</span></button>${ctx.scopeOpen ? '' : `<p class="lab-hints lab-thumb-hints" aria-hidden="true">${labHint(`${labTouch() ? 'Tap' : 'Click'} the slide`, 'open the microscope')}</p>`}</div>`}
      <div class="lab-result-text">
        ${typeof run.guess === 'string' && run.guess.trim() ? `<p class="lab-result-guess"><strong>Your guess:</strong> ${esc(run.guess.trim())}</p>` : ''}
        <p class="lab-result-summary">${esc(labSummarize(result, specimen))}</p>
        ${look ? `<p class="lab-look"><span class="lab-look-swatch" data-lab-look="${esc(look.key)}" aria-hidden="true"></span><span class="lab-look-text">By eye: ${esc(look.text)}</span></p>` : ''}
        ${noBasis && !inProgress ? `<p class="lab-result-needs"><strong>What the model would need:</strong> ${esc(labNeedsText(result))}.</p>` : ''}
        ${labResultFlags(run, result)
          .map(flag => `<p class="lab-result-flag">${esc(flag)}</p>`)
          .join('')}
      </div>
    </div>
    <div class="lab-result-links"></div>
  </article>`);
  const swatch = card.querySelector('.lab-look-swatch');
  const lookColor = look ? labLookColor(look.key) : null;
  if (swatch && lookColor) swatch.style.background = lookColor;
  const links = card.querySelector('.lab-result-links');
  const why = labDisclosure(LAB_WORDS.why, () => labWhyResult(lab, result, run), { key: 'why:result', cls: 'lab-why' });
  why.dataset.labWhy = 'result';
  links.appendChild(why);
  if (!inProgress) {
    const compare = el(
      `<button type="button" class="lab-linkbtn" id="lab-compare-open" aria-expanded="${ctx.compareOpen}"${ctx.compareOpen ? ' aria-controls="lab-pair"' : ''}>Compare with another run</button>`
    );
    compare.addEventListener('click', () => {
      ctx.compareOpen = !ctx.compareOpen;
      if (ctx.compareOpen) {
        // One "What do you want to change?" on the page; Run 1's own microscope and Why? close, so
        // the picture above the comparison is never mistaken for the new run's (F1).
        Object.assign(ctx, { setupOpen: false, scopeOpen: false, closeUi: ['why:result'] });
      } else Object.assign(ctx, { compared: false, scopeCompareOpen: false });
      ctx.refresh(ctx.compareOpen ? '#lab-change-what' : '#lab-compare-open');
      if (ctx.compareOpen) labReveal('#lab-pair', 'start', { later: true });
    });
    links.appendChild(compare);
    // FREE-3: a new run on the free bench, on this run's specimen (§13.3: the jars hold the mix now, so the
    // link names the bench, not a mix it would no longer show)
    const again = el('<button type="button" class="lab-linkbtn" id="lab-mix-again">Try it on the free bench</button>');
    again.addEventListener('click', () => {
      labSetupFromRun(ctx, run);
      ctx.refresh('#lab-bench-mode input:checked');
      labReveal('#lab-setup', 'start', { later: true });
    });
    links.appendChild(again);
  }
  links.appendChild(labTissueLink(lab, ctx, mode));
  // The designer was found only by guessing (F4, KB-06): one link from the result to it (BENCH-1: only
  // while the designer is turned on).
  if (labFlags().designer)
    links.appendChild(
      el(
        `<a class="lab-result-design" id="lab-result-design" data-lab-go href="${esc(labUrl({ view: 'designer' }))}">Design your experiment</a>`
      )
    );
  card.querySelector('#lab-scope-btn')?.addEventListener('click', () => {
    ctx.scopeOpen = !ctx.scopeOpen;
    ctx.refresh('#lab-scope-btn');
    // The viewer renders under the card (and under an open Why?): bring it up (F14).
    if (ctx.scopeOpen) labReveal('#lab-scope-title', 'start', { later: true });
  });
  const thumb = card.querySelector('[data-lab-slot="thumb"]');
  if (thumb && !realSlide) ctx.afterAttach.push(() => labPaintThumb(lab, result, thumb)); // the photo box keeps its img
  return card;
}
// The warning lines on a result card's face (low confidence; a step done out of order, twice, or though
// the run's setting skips it). The report shows the same lines through CortexLab.flags (UX-FIX-notebook-8).
function labResultFlags(run, result) {
  if (!run) return [];
  const out = [];
  if (labIsObj(result) && result.label !== SilverLab.LABELS.NO_BASIS && result.confidence === 'low')
    out.push(labLowConfidenceText(result));
  const deviations = (run.deviations || []).filter(d => ['out-of-order', 'repeated', 'not-planned'].includes(d.kind));
  if (deviations.length) out.push(`${labDeviationsText(deviations)}.`);
  return out;
}
// Low confidence in words: what the flag means here, and that it is not a probability (F9 / KB-04).
function labLowConfidenceText(result) {
  const why = (result.rulesApplied || []).includes('R-temp-01')
    ? 'the impregnation temperature changed, and the model has no direction for that change'
    : result.conditionalOn
      ? 'this picture depends on one explanation you picked for the sake of argument'
      : 'a rule behind this picture gives no direction';
  return `Low confidence: ${why}. It is a flag in the model, not a probability.`;
}
// "What the model would need" without engine ids: an unknown specimen or method in plain words (CC-14).
function labNeedsText(card) {
  if (card.code === 'specimen-unknown') return 'a practice specimen the lab knows (start a new run)';
  if (card.code === 'method-unknown') return 'a method the lab knows (start a new run)';
  return (card.whatWouldBeNeeded || []).map(labPlainEngineText).join('; ');
}
// "Look into the tissue": the dive on the 3D bench (when the bench build has the clip), else the
// clip's captions as text ("What the tissue view shows"), so list mode keeps the content.
function labTissueLink(lab, ctx, mode) {
  if (mode === '3d' && labClipSupported()) {
    const tissue = el('<button type="button" class="lab-linkbtn" id="lab-clip-dive">Look into the tissue</button>');
    tissue.addEventListener('click', () => labClipDive(lab, ctx));
    return tissue;
  }
  if (mode === '3d') return document.createDocumentFragment(); // the stage's transcript has the captions
  return labDisclosure('Look into the tissue', () => el(labClipTextHtml(lab, { level: 3 })), {
    key: 'tissue-text',
    cls: 'lab-tissue-text',
  });
}
/* ---------- the free bench's result (§11.1): the Slide now card and the What happened log ---------- */
// The flags of a free run's slide in plain words (§11.1), from the outcome's `slide` (else the run's).
const LAB_SLIDE_FLAGS = [
  ['wax', true, 'wax still on'],
  ['coverslipped', true, 'sealed under a coverslip'],
  ['fixed', true, 'unreduced silver removed'],
  ['toned', true, 'gold toned'],
  ['unfixed', true, 'unfixed: silver that was never reduced is still in it'],
];
function labSlideFlags(run, result) {
  const slide = labIsObj(result && result.slide) ? result.slide : labIsObj(run && run.slide) ? run.slide : null;
  if (!slide) return [];
  return LAB_SLIDE_FLAGS.filter(([key, value]) => slide[key] === value).map(([, , words]) => words);
}
// The drawn artifacts a free run carries (patchy, black grains), in the microscope's words.
const LAB_ARTIFACT_WORDS = { patchy: 'patchy (drawn)', grains: 'black grains (drawn)' };
// The free run's outcome: always an Outcome from the engine (§11.3); an engine build before §11 answers
// a Not modeled card mid-run, which the card then shows as it is (never invented here).
function labFreeOutcome(lab, run) {
  try {
    return lab.resolve(run);
  } catch (error) {
    return {
      label: SilverLab.LABELS.NO_BASIS,
      code: 'error',
      explanation: error && error.message ? error.message : String(error),
    };
  }
}
// A gap (a setting with no rule, §11.3) in the bench's words: "No rule for “Washes: changed”: the picture
// leaves it out." (the engine's own line names the path; it stays under Why / sources).
function labGapText(gap) {
  if (!labIsObj(gap)) return String(gap ?? '');
  if (gap.path && labIsParamPath(gap.path))
    return `No rule for “${labParamText(gap.path, gap.value)}”: the picture leaves it out.`;
  return String(gap.text || gap.path || '');
}
// The Slide now card (§11.1): the by-eye look with its swatch, the flags, "Look at your slide", what is
// not in the model, and the Why / sources disclosure (the same rendering as the result card's).
function labSlideNowCard(lab, run, ctx) {
  const result = labFreeOutcome(lab, run);
  const noBasis = result.label === SilverLab.LABELS.NO_BASIS;
  const method = lab.getMethod(run.method);
  const jars = !!method && !labIsCompareOnly(method); // a compare-only method has no slide to dip (MODE-FIX-shell-12)
  const look = noBasis ? null : labRunLook(lab, run);
  const flags = noBasis || !jars ? [] : labSlideFlags(run, result);
  const artifacts = noBasis
    ? []
    : (result.artifacts || []).filter(a => LAB_ARTIFACT_WORDS[a]).map(a => LAB_ARTIFACT_WORDS[a]);
  const gaps = noBasis ? [] : Array.isArray(result.gaps) ? result.gaps : [];
  // §12.4: the first matching real photo as the card's thumbnail (the result card's box), opening the
  // microscope on this run as Look at your slide does; no photo, no thumbnail (the look line stands).
  const realSlide = noBasis || !jars ? null : labRealSlide(lab, result, lab.getSpecimen(run.specimenId));
  const card =
    el(`<section class="lab-result-card lab-slide-now" id="lab-slide-now" aria-labelledby="lab-result-h" data-lab-result="${esc(result.label)}"${noBasis ? ` data-lab-card="${esc(result.code)}"` : ` data-lab-outcome="${esc(run.id)}"`}${labHasStep(run) ? '' : ' data-lab-slide-fresh=""'}>
    ${labBanner(result, labRunTitle(run), { focusable: true })}
    ${realSlide ? `<div class="lab-result-thumbwrap lab-slide-now-thumbwrap">${labThumbBadgeHtml(realSlide)}<button type="button" class="lab-result-thumb" id="lab-slide-now-scope">${labThumbPicHtml(realSlide)}<span class="lab-result-thumb-text">Open in the microscope</span></button><p class="lab-hints lab-thumb-hints" aria-hidden="true">${labHint(`${labTouch() ? 'Tap' : 'Click'} the slide`, 'open the microscope')}</p></div>` : ''}
    <div class="lab-slide-now-body">
      ${look ? `<p class="lab-look"><span class="lab-look-swatch" data-lab-look="${esc(look.key)}" aria-hidden="true"></span><span class="lab-look-text" id="lab-look-text">${esc(look.text)}</span></p>` : ''}
      ${flags.length || artifacts.length ? `<p class="lab-slide-flags">${esc([...flags, ...artifacts].join(' · '))}</p>` : ''}
      ${typeof run.guess === 'string' && run.guess.trim() ? `<p class="lab-result-guess"><strong>Your guess:</strong> ${esc(run.guess.trim())}</p>` : ''}
      ${labHasStep(run) ? `<p class="lab-slide-summary">${esc(labSummarize(result, lab.getSpecimen(run.specimenId)))}</p>` : ''}
      ${noBasis ? '' : labSlideUnknownHtml(lab, run, result)}
      ${gaps.length ? `<div class="lab-slide-gaps"><h4>Not in the model</h4><ul>${gaps.map(g => `<li>${esc(labGapText(g))}</li>`).join('')}</ul></div>` : ''}
    </div>
    <div class="lab-result-links"></div>
  </section>`);
  const swatch = card.querySelector('.lab-look-swatch');
  const color = look ? labLookColor(look.key) : null;
  if (swatch && color) swatch.style.background = color;
  const links = card.querySelector('.lab-result-links');
  const lookBtn = el('<button type="button" class="lab-linkbtn" id="lab-look-slide">Look at your slide</button>');
  lookBtn.addEventListener('click', () => {
    const reason = labLookReason(lab, ctx);
    if (reason) return labAnnounce(reason);
    labOpenMicroscope({ runIds: [run.id] });
  });
  links.appendChild(lookBtn);
  card.querySelector('#lab-slide-now-scope')?.addEventListener('click', () => {
    const reason = labLookReason(lab, ctx);
    if (reason) return labAnnounce(reason);
    labOpenMicroscope({ runIds: [run.id] });
  });
  const why = labDisclosure(LAB_WORDS.why, () => labWhyResult(lab, result, run), {
    key: 'why:result',
    cls: 'lab-why',
    ariaLabel: `${LAB_WORDS.why} Slide now`, // MODE-FIX-shell-15: one name per Why on the page
  });
  why.dataset.labWhy = 'result';
  links.appendChild(why);
  return card;
}
// The What happened log (§11.1): one entry per dip, oldest first, the latest marked; each with the jar's
// title, the reaction's words and a Why (the chemistry in one sentence, the rules and their claims). §13.3: a
// dip's entry says what was in the jar; a currently unknown reaction (`data-lab-reaction-kind="unknown"`)
// carries the chip "Currently unknown reaction" with a "?" mark in the house's neutral tone (a result, never
// an error), and a partly unknown one the chip "Partly unknown" with its "Currently unknown: …" sentences
// listed under the known text. The Why says why it is unknown and that the real lab is how to find out.
const LAB_UNKNOWN_CHIPS = Object.freeze({ unknown: 'Currently unknown reaction', partly: 'Partly unknown' });
const labUnknownChip = which =>
  `<span class="lab-reaction-chip" data-lab-chip="${which}"><span class="lab-unknown-mark" aria-hidden="true">?</span>${esc(LAB_UNKNOWN_CHIPS[which])}</span>`;
// The unknown sentences of a partly unknown reaction, and its text without them (the engine appends them).
function labReactionParts(reaction) {
  const unknown = (Array.isArray(reaction.unknown) ? reaction.unknown : []).filter(
    u => labIsObj(u) && typeof u.text === 'string' && u.text.trim()
  );
  const whole = reaction.kind === 'unknown';
  const lines = whole ? [] : unknown.map(u => u.text.trim());
  let known = String(reaction.text || '');
  for (const line of lines) known = known.replace(line, ' ');
  return { whole, partly: lines.length > 0, known: known.replace(/\s+/g, ' ').trim(), lines };
}
const labEventBySeq = (run, seq) =>
  (Array.isArray(run.events) ? run.events.find(e => e && e.seq === seq) : null) || null;
function labReactionsLog(lab, run) {
  const reactions = Array.isArray(run.reactions) ? run.reactions : [];
  const wrap = el(`<section class="lab-reactions" aria-labelledby="lab-reactions-h">
    <h3 id="lab-reactions-h">What happened</h3>
    ${reactions.length ? '<ol class="lab-reactions-list" id="lab-reactions"></ol>' : '<p class="lab-empty-line" id="lab-reactions-empty">No dip yet. Every dip is written here: a reaction, or none.</p>'}
  </section>`);
  const list = wrap.querySelector('#lab-reactions');
  reactions.forEach((reaction, i) => {
    const latest = i === reactions.length - 1;
    const kind = reaction.kind || 'reaction';
    const ev = labEventBySeq(run, reaction.seq);
    const title = labJarTitleById(labEventJar(ev) || reaction.step);
    const parts = labReactionParts(reaction);
    const contents = ev && ev.type === 'dip' ? labSolutionText(lab, ev.solution) : '';
    const hands = ev && ev.type === 'dip' ? labHandsText(lab, ev.handling) : '';
    const chip = parts.whole ? labUnknownChip('unknown') : parts.partly ? labUnknownChip('partly') : '';
    const item =
      el(`<li class="lab-reaction${latest ? ' lab-reaction-latest' : ''}" data-lab-reaction="${esc(kind)}" data-lab-reaction-kind="${esc(kind)}"${parts.partly ? ' data-lab-reaction-partly=""' : ''}>
      <p class="lab-reaction-head"><strong class="lab-reaction-step">${esc(title)}</strong>${chip}</p>
      ${contents ? `<p class="lab-reaction-jar">${esc(contents)}${hands ? ` · ${esc(hands)}` : ''}</p>` : ''}
      <p class="lab-reaction-text">${esc(parts.partly ? parts.known : reaction.text || '')}</p>
      ${parts.partly ? `<ul class="lab-reaction-unknown">${parts.lines.map(line => `<li>${esc(line)}</li>`).join('')}</ul>` : ''}
      <div data-lab-slot="why"></div>
    </li>`);
    const why = labDisclosure(
      LAB_WORDS.why,
      () => {
        const box = el(`<div class="lab-reaction-why">${reaction.why ? `<p>${esc(reaction.why)}</p>` : ''}</div>`);
        if (Array.isArray(reaction.rules) && reaction.rules.length)
          box.appendChild(labRuleChips(lab, reaction.rules, { label: 'Rules for this dip' }));
        if (Array.isArray(reaction.claims) && reaction.claims.length)
          box.appendChild(labClaimChips(lab, reaction.claims, { label: 'Claims', key: `reaction:${reaction.seq}` }));
        return box;
      },
      {
        key: `why:reaction:${reaction.seq}`,
        cls: 'lab-why lab-reaction-disclosure',
        // MODE-FIX-shell-15: a name per entry ("Why? Develop the silver"), so a buttons list tells the dips
        // apart; aria-label outranks the contents, so the CSS glyph stays out of the name.
        ariaLabel: `${LAB_WORDS.why} ${title}`,
      }
    );
    item.querySelector('[data-lab-slot="why"]').replaceWith(why);
    list.appendChild(item);
  });
  return wrap;
}
// §13.3 Slide now: "Currently unknown: N dip(s), left out of the drawing" with each dip's jar and contents
// (outcome.unknownDips), and one "Partly unknown (<jar>): …" line per partly unknown field
// (outcome.unknownFields). '' when the slide has neither.
function labSlideUnknownHtml(lab, run, result) {
  const dips = (Array.isArray(result.unknownDips) ? result.unknownDips : []).filter(labIsObj);
  const fields = (Array.isArray(result.unknownFields) ? result.unknownFields : []).filter(labIsObj);
  if (!dips.length && !fields.length) return '';
  const jarOf = x => x.jarId || labEventJar(labEventBySeq(run, x.seq));
  const dipLines = dips.map(d => {
    const ev = labEventBySeq(run, d.seq);
    const contents = labSolutionText(lab, d.solution || (ev && ev.solution));
    return `<li>${esc(labJarTitleById(jarOf(d)))}${contents ? `: ${esc(contents)}` : ''}</li>`;
  });
  const fieldLines = fields.map(f => {
    const words = String(f.text || '').replace(/^Currently unknown:\s*/, '');
    const jar = jarOf(f);
    return `<li>Partly unknown${jar ? ` (${esc(labJarTitleById(jar))})` : ''}: ${esc(words)}</li>`;
  });
  return `<div class="lab-slide-unknown" id="lab-slide-unknown">${
    dips.length
      ? `<p class="lab-slide-unknown-head"><span class="lab-unknown-mark" aria-hidden="true">?</span>Currently unknown: ${dips.length} ${dips.length === 1 ? 'dip' : 'dips'}, left out of the drawing</p><ul class="lab-slide-unknown-dips">${dipLines.join('')}</ul>`
      : ''
  }${fields.length ? `<ul class="lab-slide-partly">${fieldLines.join('')}</ul>` : ''}</div>`;
}
function labResultSection(lab, run, ctx, mode) {
  const free = labIsFree(run);
  const section =
    el(`<section class="lab-part lab-result${free ? ' lab-result-free' : ''}" id="lab-result" aria-labelledby="lab-result-h">
    <h2 id="lab-result-h" tabindex="-1">${free ? 'Slide now' : 'Result'}</h2>
    <div id="lab-resolve-out" class="lab-resolve-out" role="region" aria-label="${free ? 'Slide now and what happened' : 'Result: simulated picture or Not modeled card'}"></div>
    <div id="lab-scope-inline" class="lab-scope-inline"></div>
    <div data-lab-slot="compare"></div>
    <p class="lab-honesty lab-bench-honesty">${esc(LAB_ILLUSTRATIVE)}</p>
  </section>`);
  const out = section.querySelector('#lab-resolve-out');
  if (free && !labIsSealed(run.id)) {
    const method = lab.getMethod(run.method);
    out.appendChild(labSlideNowCard(lab, run, ctx));
    if (method && !labIsCompareOnly(method)) out.appendChild(labReactionsLog(lab, run)); // no jars, no log (MODE-FIX-shell-12)
    const links = out.appendChild(el('<div class="lab-result-links lab-free-links"></div>'));
    links.appendChild(labTissueLink(lab, ctx, mode));
    if (!links.childNodes.length) links.remove();
    section.querySelector('[data-lab-slot="compare"]').remove();
    return section;
  }
  const method = run ? lab.getMethod(run.method) : null;
  const ready = run && (labHasStep(run) || !method || labIsCompareOnly(method));
  // A sealed run shows no card, no microscope and no comparison until its experiment is revealed; the
  // pair "Make the runs for me" just made says so in one message (UX-POLISH).
  if (run && labIsSealed(run.id)) {
    out.appendChild(labSealedResult(run, ctx));
    section.querySelector('[data-lab-slot="compare"]').remove();
    return section;
  }
  if (!ready) {
    out.appendChild(
      el(
        `<p class="lab-empty-line">${run ? 'Your result appears here after the first step.' : 'Your result appears here once a run has steps.'}</p>`
      )
    );
    // Before a result card exists, "Look into the tissue" waits here (it left the step links, UX-R2).
    const links = out.appendChild(el('<div class="lab-result-links lab-empty-links"></div>'));
    links.appendChild(labTissueLink(lab, ctx, mode));
    if (!links.childNodes.length) links.remove();
  } else out.appendChild(labResultCard(lab, run, ctx, mode));
  if (ready && ctx.scopeOpen) {
    const host = section.querySelector('#lab-scope-inline');
    // Every inline microscope names its run above the picture (F1).
    host.before(el(`<p class="lab-scope-title" id="lab-scope-title">In the microscope: ${esc(labRunTitle(run))}</p>`));
    host.after(
      el(
        `<p class="lab-scope-full"><a data-lab-go href="${esc(labUrl({ view: 'microscope', run: run.id }))}">Full microscope view</a></p>`
      )
    );
    ctx.afterAttach.push(() =>
      labMountScope(lab, host, [run], {
        headingLevel: 3,
        onClose() {
          ctx.scopeOpen = false;
          ctx.refresh('#lab-scope-btn');
        },
      })
    );
  }
  if (run && ctx.compareOpen)
    section.querySelector('[data-lab-slot="compare"]').replaceWith(labComparePanel(lab, run, ctx));
  return section;
}
// The result part of a sealed run: the message after "Make the runs for me" (focused, so the student
// lands on it), else the run's name and the sealed note.
function labSealedResult(run, ctx) {
  const exp = labSealedExp(run.id);
  const pair = exp && ctx.sealedReady === exp.id ? [exp.baselineRunId, exp.experimentalRunId] : [];
  if (pair.includes(run.id)) {
    const [base, copy] = pair.map(id => LAB_STATE.runs[id]);
    // A baseline the student had already seen stays open; only the run with the change is sealed (UX-LAST).
    const seen = !!base && !labIsSealed(base.id);
    // A run whose settings skip a step did every step it needs, not all nine (ENGINE-14).
    const every = [base, copy].some(r => labSkippedSteps(r).size)
      ? 'Both runs did every step their settings call for.'
      : 'Both runs did every step.';
    return el(`<div class="lab-sealed-ready" id="lab-sealed-ready" tabindex="-1" data-lab-sealed="${esc(run.id)}" aria-labelledby="lab-sealed-ready-h">
      <p class="lab-sealed-ready-h" id="lab-sealed-ready-h"><strong>${seen ? 'Your two runs are ready; the run with your change is sealed.' : 'Your two runs are ready and sealed.'}</strong> <a data-lab-go href="${esc(labSealedUrl(exp))}">Go back to your experiment to write your predictions.</a></p>
      <ul class="lab-sealed-runs"><li>Baseline${seen ? ' (already seen)' : ''}: ${esc(labRunTitle(base))}</li><li>With your change: ${esc(labRunTitle(copy))}</li></ul>
      <p class="lab-dim">${esc(every)} ${seen ? `You have already seen the baseline, so it stays open; the run with your change stays hidden until you reveal ${esc(labExperimentName(exp))}.` : `What they show stays hidden until you reveal ${esc(labExperimentName(exp))}.`}</p>
    </div>`);
  }
  return el(labSealedCards([run]));
}
// "Make the runs for me" for a change the bench does not offer (UX-LAST): nothing is made; the second
// sentence leads back to the experiment's step 2, where the runs are picked or the change is chosen.
function labMakeRefusedNote(exp) {
  return el(`<div class="lab-make-refused" id="lab-make-refused" tabindex="-1" data-lab-make-refused="${esc(exp.id)}" aria-labelledby="lab-make-refused-text">
    <p id="lab-make-refused-text"><strong>The bench can't make this change for you.</strong> <a data-lab-go href="${esc(labUrl({ view: 'designer', exp: exp.id, step: 1 }))}">Pick your two runs yourself on the plan screen, or choose a change the bench offers.</a></p>
  </div>`);
}
// Comparison in plain words: what changed, which structures moved and by how many steps of the
// model scale, then background and contrast. Darker is never called better.
const LAB_COUNT_WORDS = ['no', 'one', 'two', 'three', 'four'];
function labDeltaText(delta) {
  if (!delta) return 'no change';
  const n = Math.abs(delta);
  return `${LAB_COUNT_WORDS[n] || n} step${n === 1 ? '' : 's'} ${delta > 0 ? 'darker' : 'lighter'}`;
}
function labCompareSummary(lab, cmp, a, b) {
  const nameA = `Run ${labRunNumber(a)}`,
    nameB = `Run ${labRunNumber(b)}`;
  if (!cmp.perSite) {
    const card = [cmp.baseline, cmp.experimental].find(r => r && r.label === SilverLab.LABELS.NO_BASIS);
    const who = card && card.runId === a.id ? nameA : nameB;
    if (card && card.code === 'step-skipped')
      return `${LAB_WORDS.inProgress}: ${who} is not finished, so there is nothing to compare yet.`;
    if (card) return `${labSummarize(card)} (${who})`;
    return `${LAB_WORDS.notModeled}: these two runs use different methods, so the lab does not compute a difference between them.`;
  }
  const changed = cmp.changedParams.map(path =>
    path === 'specimenId'
      ? `the specimen (${labSpecimenName(lab.getSpecimen(b.specimenId)) || LAB_UNKNOWN_SPECIMEN})`
      : path === 'method'
        ? 'the method'
        : labParamPhrase(path, labGetPath(b.params, path))
  );
  const lead = changed.length
    ? `${nameB} differs from ${nameA} in ${labAnd(changed)}.`
    : `${nameA} and ${nameB} use the same settings.`;
  const groups = new Map();
  for (const site of LAB_SUMMARY_SITES) {
    const d = cmp.perSite[site];
    if (!d) continue;
    const word = labDeltaText(d.delta);
    if (!groups.has(word)) groups.set(word, []);
    groups.get(word).push(LAB_SITE_PLURAL[site]);
  }
  const clauses = [...groups].map(
    ([word, sites]) => `${labAnd(sites)} ${word === 'no change' ? 'show no change' : `are ${word}`}`
  );
  const sentence = clauses.join('; ');
  const bg = cmp.perSite.background || { baseline: 0, experimental: 0 };
  const from = labOrdinal(cmp.baseline.contrast),
    to = labOrdinal(cmp.experimental.contrast);
  const note = labAssumptionNote(cmp);
  const background =
    bg.baseline === bg.experimental
      ? `The background stays at ${labOrdinal(bg.baseline)}`
      : `The background goes from ${labOrdinal(bg.baseline)} to ${labOrdinal(bg.experimental)}${note ? ` (${note})` : ''}`;
  const contrast = from === to ? `contrast stays ${from}` : `contrast goes from ${from} to ${to}`;
  return `${lead} ${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}. ${background}; ${contrast}.`;
}
function labWhyCompare(lab, cmp, a, b, level = 4) {
  const nameA = `Run ${labRunNumber(a)}`,
    nameB = `Run ${labRunNumber(b)}`;
  const wrap = el('<div class="lab-why-body"></div>');
  let html = '';
  if (cmp.perSite)
    html += `<p class="lab-scale">${esc(LAB_WORDS.scaleLegend)}</p>${labScaleTableHtml(
      [...LAB_SUMMARY_SITES, 'background'].map(site => {
        const d = cmp.perSite[site] || { baseline: 0, experimental: 0, delta: 0 };
        return [labSiteText(site), labOrdinal(d.baseline), labOrdinal(d.experimental), labDeltaText(d.delta)];
      }),
      ['Structure', esc(nameA), esc(nameB), 'Change'],
      `Visible silver on the ${LAB_WORDS.modelScale}`
    )}`;
  else
    html +=
      '<p>No difference is computed: the two sides come from different bases, or one side is Not modeled. Read each side on its own terms.</p>';
  html += labRuleTitlesHtml(lab, cmp.rulesResponsible, level);
  html += labCaveatsHtml(cmp.caveats, level);
  for (const [side, name] of [
    [cmp.baseline, nameA],
    [cmp.experimental, nameB],
  ])
    if (side && side.label === SilverLab.LABELS.NO_BASIS)
      html += `<div class="lab-why-card" data-lab-card="${esc(side.code)}">${labHeading(level, `${esc(name)}: ${esc(side.code === 'step-skipped' ? LAB_WORDS.inProgress : LAB_WORDS.notModeled)}`)}${labBanner(side, name)}${labCardWhyHtml(side, level + 1)}</div>`;
  wrap.innerHTML = html;
  wrap.appendChild(
    labSourcesDisclosure(lab, 'why-compare-sources', () => {
      // The settings in the export's words (UX-POLISH): "Changed settings: Development time: longer".
      const changed = cmp.changedParams.map(path =>
        path === 'specimenId'
          ? `Specimen: ${labSpecimenName(lab.getSpecimen(b.specimenId)) || LAB_UNKNOWN_SPECIMEN}`
          : path === 'method'
            ? `Method: ${(lab.getMethod(b.method) || {}).title || b.method}`
            : labParamText(path, labGetPath(b.params, path))
      );
      const box = el(
        `<div class="lab-sources-body"><p class="lab-dim">Changed settings: ${esc(changed.length ? changed.join('; ') : 'none')}</p>${labEngineCaveatsHtml(cmp.caveats)}</div>`
      );
      box.appendChild(labRuleChips(lab, cmp.rulesResponsible, { label: 'Rules responsible' }));
      return box;
    })
  );
  return wrap;
}
function labComparisonCard(lab, a, b, ctx) {
  const cmp = lab.compare(a, b);
  const card = el(`<article class="lab-result-card lab-compare" data-lab-compare="${esc(cmp.label)}">
    ${labBanner(cmp, `Run ${labRunNumber(a)} and Run ${labRunNumber(b)}`, { focusable: true })}
    <p class="lab-result-summary">${esc(labCompareSummary(lab, cmp, a, b))}</p>
    <div class="lab-result-links"></div>
  </article>`);
  const links = card.querySelector('.lab-result-links');
  const why = labDisclosure(LAB_WORDS.why, () => labWhyCompare(lab, cmp, a, b), { key: 'why:compare', cls: 'lab-why' });
  why.dataset.labWhy = 'compare';
  links.appendChild(why);
  const scope = el(
    `<button type="button" class="lab-linkbtn" id="lab-compare-scope" aria-expanded="${ctx.scopeCompareOpen}" aria-controls="lab-scope-compare">${ctx.scopeCompareOpen ? 'Close the microscope' : 'Look at both in the microscope'}</button>`
  );
  scope.addEventListener('click', () => {
    ctx.scopeCompareOpen = !ctx.scopeCompareOpen;
    ctx.refresh('#lab-compare-scope');
    // The side-by-side view renders below the card: bring it up (F1).
    if (ctx.scopeCompareOpen) labReveal('#lab-scope-compare-title', 'start', { later: true });
  });
  links.appendChild(scope);
  return card;
}
// The copy that "Run both and compare" just made with these exact settings, if it is still the pair
// on show: a second press shows that comparison again instead of making a duplicate run (F1).
function labPairShown(ctx, run) {
  const copy = ctx.compared && ctx.pairBaseline === run.id ? LAB_STATE.runs[ctx.pairExperimental] : null;
  return (
    !!copy &&
    !!ctx.pairChange &&
    copy.specimenId === run.specimenId &&
    copy.method === run.method &&
    SilverLab.serialize(copy.params) === SilverLab.serialize(ctx.pairChange.params)
  );
}
// Compare with another run: a copy of this run that changes one thing (the same "What do you want to
// change?" control), both run in full, then one comparison card. Two existing runs can be compared too.
function labComparePanel(lab, run, ctx) {
  if (!ctx.pairChange || ctx.pairChange.runId !== run.id) {
    ctx.pairChange = { ...labChangeState(run.params, 'development-time'), runId: run.id };
    labChangePreselect(lab, ctx.pairChange);
  }
  // A draft proposal's pairing (?exp=, draft only, CC-1) is saved into it; the link goes back (CC-3).
  const proposal = ctx.experiment
    ? `<p class="lab-note">The two runs you compare here are saved into your proposal. <a id="lab-pair-proposal" data-lab-go href="${esc(labUrl({ view: 'designer', exp: ctx.experiment, step: 1 }))}">Back to your proposal</a></p>`
    : '';
  const section = el(`<section class="lab-pair" id="lab-pair" aria-labelledby="lab-pair-h">
    <h3 id="lab-pair-h" tabindex="-1">Compare with another run</h3>
    ${proposal}
    <form class="lab-pair-form" id="lab-pair-form">
      <p class="lab-note">Make a copy of ${esc(labRunTitle(run))} that changes one thing, run both in full, and compare them.</p>
      <div data-lab-slot="change"></div>
      <div class="lab-row"><button type="submit" class="btn btn-solid" id="lab-pair-btn">Run both and compare</button><span class="lab-dim" id="lab-pair-status" role="status"></span></div>
    </form>
    <div data-lab-slot="existing"></div>
    <div id="lab-compare-out" class="lab-compare-out" role="region" aria-label="Comparison: simulated difference or Not modeled card"></div>
    <div id="lab-scope-compare" class="lab-scope-inline"></div>
  </section>`);
  const form = section.querySelector('#lab-pair-form');
  const pairButton = form.querySelector('#lab-pair-btn');
  const label = () => {
    pairButton.textContent = labPairShown(ctx, run) ? 'Compared: see below' : 'Run both and compare';
  };
  form
    .querySelector('[data-lab-slot="change"]')
    .replaceWith(labChangeFields(lab, ctx.pairChange, { compare: true, onChange: label }).node);
  label();
  // After the comparison renders, its card comes to the top of the view (under the site bar), not
  // Run 1's result above it (F1, KB-03).
  const showComparison = () => {
    ctx.refresh(['#lab-compare-out .lab-banner', '#lab-compare-out .lab-sealed a']);
    labReveal('#lab-compare-out > *', 'start', { later: true });
  };
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (labPairShown(ctx, run)) {
      labAnnounce('Already compared: the comparison is below.');
      showComparison();
      return;
    }
    const { patch, paths } = labParamDiff(run.params, ctx.pairChange.params);
    if (!paths.length) {
      form.querySelector('#lab-pair-status').textContent = 'Pick a value that differs from this run first.';
      return;
    }
    const result = labPairRuns(lab, run.id, patch);
    if (!result) return;
    const twin = labSealTwin(result.experimental.id); // UX-LAST: a copy that matches a sealed run
    if (twin) labSave();
    Object.assign(ctx, {
      pairBaseline: run.id,
      pairExperimental: result.experimental.id,
      compared: true,
      scopeCompareOpen: false,
    });
    if (ctx.experiment) labAttachRunsToExperiment(ctx.experiment, run.id, result.experimental.id);
    labAnnounce(
      `${labRunTitle(result.experimental)} ran in full and is compared with ${labRunTitle(run)}.${twin ? ` ${labTwinText(twin)}` : ''}`
    );
    showComparison();
  });
  section.querySelector('[data-lab-slot="existing"]').replaceWith(
    labDisclosure(
      'Compare two runs you already have',
      () => {
        const existing = el(`<form class="lab-pair-existing" id="lab-compare-form">
          <div class="lab-fields">
            ${labRunSelectHtml('lab-compare-a', ctx.pairBaseline || run.id, { labelText: 'Baseline run' })}
            ${labRunSelectHtml('lab-compare-b', ctx.pairExperimental || '', { labelText: 'Run to compare' })}
          </div>
          <div class="lab-row"><button type="submit" class="btn" id="lab-compare-btn">Compare</button></div>
        </form>`);
        existing.addEventListener('submit', event => {
          event.preventDefault();
          const a = existing.querySelector('#lab-compare-a').value,
            b = existing.querySelector('#lab-compare-b').value;
          if (!LAB_STATE.runs[a] || !LAB_STATE.runs[b]) return;
          Object.assign(ctx, { pairBaseline: a, pairExperimental: b, compared: true, scopeCompareOpen: false });
          if (ctx.experiment) labAttachRunsToExperiment(ctx.experiment, a, b);
          labAnnounce(`Compared ${labRunTitle(LAB_STATE.runs[a])} with ${labRunTitle(LAB_STATE.runs[b])}.`);
          showComparison();
        });
        return existing;
      },
      { key: 'compare-existing', cls: 'lab-compare-existing' }
    )
  );
  const a = LAB_STATE.runs[ctx.pairBaseline],
    b = LAB_STATE.runs[ctx.pairExperimental];
  // A comparison with a sealed run would show its outcome: the sealed note per sealed run (UX-POLISH).
  const sealedSides = a && b ? [a, b].filter(r => labIsSealed(r.id)) : [];
  if (ctx.compared && sealedSides.length)
    section.querySelector('#lab-compare-out').innerHTML = labSealedCards(sealedSides);
  else if (ctx.compared && a && b) {
    section.querySelector('#lab-compare-out').appendChild(labComparisonCard(lab, a, b, ctx));
    if (ctx.scopeCompareOpen)
      section
        .querySelector('#lab-scope-compare')
        .before(
          el(
            `<p class="lab-scope-title" id="lab-scope-compare-title">In the microscope: ${esc(labRunTitle(a))} and ${esc(labRunTitle(b))}</p>`
          )
        );
    if (ctx.scopeCompareOpen)
      ctx.afterAttach.push(() =>
        labMountScope(lab, section.querySelector('#lab-scope-compare'), [a, b], {
          headingLevel: 3,
          onClose() {
            ctx.scopeCompareOpen = false;
            ctx.refresh('#lab-compare-scope');
          },
        })
      );
  }
  return section;
}
// Inline microscope host: feature-detects the microscope module and stores the handle for pausing.
// A sealed run is refused (its sealed note in place of the viewer; UX-POLISH).
function labMountScope(lab, host, runs, extra = {}) {
  const names = runs.map(run => labRunTitle(run)).join(' and ');
  host.setAttribute('role', 'region');
  host.setAttribute('aria-label', runs.length > 1 ? `Microscope compare: ${names}` : `Microscope on ${names}`);
  const sealed = runs.filter(run => run && labIsSealed(run.id));
  const open = runs.filter(run => run && !labIsSealed(run.id));
  if (sealed.length && !open.length) {
    host.innerHTML = labSealedCards(sealed);
    return null;
  }
  // One run sealed, the other not (UX-LAST): the open run's picture beside the sealed card, in the
  // order the runs were chosen; the viewer mounts on the open run alone.
  let target = host;
  if (sealed.length) {
    host.innerHTML = `<div class="lab-scope-split">${runs
      .filter(Boolean)
      .map(run =>
        labIsSealed(run.id)
          ? labSealedCards([run])
          : `<div class="lab-scope-split-open"><p class="lab-scope-title">In the microscope: ${esc(labRunTitle(run))}</p><div data-lab-scope-open></div></div>`
      )
      .join('')}</div>`;
    target = host.querySelector('[data-lab-scope-open]');
  }
  if (!window.CortexLabMicroscope || typeof window.CortexLabMicroscope.mount !== 'function') {
    target.innerHTML =
      '<p class="course-notice" role="status">The microscope module is not loaded. The result card above has the same information in words.</p>';
    return null;
  }
  try {
    const handle = window.CortexLabMicroscope.mount(target, labScopeOptions(lab, open, extra));
    if (handle) labHandles.add(handle);
    return handle;
  } catch (error) {
    target.innerHTML = `<p class="course-notice" role="status">The microscope could not open: ${esc(error && error.message ? error.message : error)}</p>`;
    return null;
  }
}
function labScopeOptions(lab, runs, extra = {}) {
  return {
    lab,
    specimen: lab.getSpecimen(runs[0].specimenId) || null,
    runs,
    outcomes: runs.map(run => lab.resolve(run)),
    settings: LAB_STATE.settings,
    onSettings(patch) {
      Object.assign(LAB_STATE.settings, patch || {});
      labSave();
    },
    onMeasurement(m) {
      const id = labNextId('measurement');
      const record = {
        id,
        measurementId: m.measurementId,
        runId: m.runId,
        label: m.label,
        value: m.value,
        unit: m.unit,
        manual: !!m.manual,
        note: typeof m.note === 'string' ? m.note : '',
        createdAt: labNow(),
      };
      LAB_STATE.measurements[id] = record;
      LAB_STATE.measurementOrder.push(id);
      labSave();
      // I6 (FIX5): no announcement here: the microscope's own status says what was recorded, once, in the
      // words of the build (H2: "Recorded." while the report is off).
      return record;
    },
    ...extra,
  };
}
// The copy keeps the baseline's specimen, method and params with `patch` applied (one parameter
// group), runs the full protocol (the steps its settings need); a step-less baseline runs it too unless
// it is locked. Its name says the change as a set-up run's does: "Developer strength: weaker" (TONING).
function labPairRuns(lab, baselineId, patch) {
  const baseline = LAB_STATE.runs[baselineId];
  if (!baseline || !labIsObj(patch)) return null;
  const params = labClone(baseline.params);
  const paths = [];
  for (const [path, value] of labLeaves(patch)) {
    labSetPath(params, path, value);
    paths.push(labParamText(path, value));
  }
  if (!paths.length) return null;
  const experimental = labNewRun({
    specimenId: baseline.specimenId,
    method: baseline.method,
    params,
    label: `copy of Run ${labRunNumber(baseline)} · ${paths.join('; ')}`,
    deferSave: true,
  });
  // Each run its own steps: the two may differ in a step their settings skip (ENGINE-14).
  const events = labFullProtocolEvents(lab, experimental);
  const baseEvents = labFullProtocolEvents(lab, baseline);
  if (!labHasStep(baseline) && baseEvents.length && !labRunLocked(baseline.id)) labApplyEvents(baseline.id, baseEvents);
  if (events.length) labApplyEvents(experimental.id, events);
  else labSave();
  return { baseline: LAB_STATE.runs[baseline.id], experimental: LAB_STATE.runs[experimental.id] };
}
function labAttachRunsToExperiment(expId, baselineRunId, experimentalRunId) {
  const exp = LAB_STATE.experiments[expId];
  if (!exp) return;
  // A revealed or done proposal was judged on its runs: the bench never swaps them (CC-1).
  if (exp.status !== 'draft') {
    labAnnounce('This proposal is revealed; its runs are locked.');
    return;
  }
  exp.baselineRunId = baselineRunId;
  exp.experimentalRunId = experimentalRunId;
  LAB_STATE.sealed = labSealPruned(LAB_STATE); // runs it no longer names are unsealed
  labSave();
}
// "Make the runs for me" (UX-LAST): the change the experiment plans, read with CortexLab.matchChange
// only. Every item of "What you change" must be a bench change; the main variable counts when it is
// one too (else it is the student's own wording). All of them must name ONE option and ONE value, and
// that value must differ from `base`. Otherwise null: the bench makes nothing and says so (no guess, no
// default change).
function labChangeForExperiment(lab, exp, base) {
  const said = text => String(text ?? '').trim();
  const changed = (Array.isArray(exp.changed) ? exp.changed : []).filter(said);
  const main = said(exp.independentVariable) ? labMatchChange(exp.independentVariable) : null;
  const matches = changed.map(labMatchChange);
  if (matches.some(m => !m)) return null; // a planned change the bench does not offer
  if (main) matches.push(main);
  if (!matches.length || new Set(matches.map(m => m.id)).size !== 1) return null; // one change at a time
  const values = [...new Set(matches.map(m => m.value).filter(v => v !== null))];
  const option = LAB_CHANGE.find(o => o.id === matches[0].id);
  if (values.length !== 1 || !option || !(option.path || option.flags)) return null;
  const change = labChangeState(base, option.id);
  if (option.flags) {
    // "skip gold toning" / "skip thiosulfate": the labels changeOptions() gives from the procedure
    if (!option.flags.includes(values[0])) return null;
    change.params[values[0]] = !SilverLab.DEFAULT_PARAMS[values[0]];
  } else labSetPath(change.params, option.path, values[0]);
  return labParamDiff(base, change.params).paths.length ? change : null;
}
// A finished run the student has already seen that can be the baseline (UX-LAST): unsealed, on the
// specimen, the procedure method in full and in order (no deviation, no step-level setting), and every
// setting standard. The newest one.
function labSeenBaseline(lab, specimenId) {
  for (const id of [...LAB_STATE.runOrder].reverse()) {
    const run = LAB_STATE.runs[id];
    if (!run || run.specimenId !== specimenId || run.method !== LAB_RUNNABLE_METHOD || labIsSealed(id)) continue;
    const p = labStepProgress(lab, run);
    if (!p.total || p.next || (run.deviations || []).length) continue;
    if (run.events.some(e => e && e.type === 'step' && e.params !== undefined)) continue;
    if (labParamDiff(SilverLab.DEFAULT_PARAMS, run.params).paths.length) continue;
    if (labParamDiff(run.params, SilverLab.DEFAULT_PARAMS).paths.length) continue;
    return run;
  }
  return null;
}
// Makes the experiment's two runs in full and seals the ones whose outcome first appears here: the
// baseline it names when that one can still run, else a finished standard run the student has already
// seen (it stays unsealed), else a new standard run on the active specimen; and a copy with the
// experiment's change. Returns { exp, baseline, experimental, reused }, { exp, refused: true } when the
// planned change is not a bench change (nothing is made), or null.
function labMakeSealedPair(lab, expId) {
  const exp = LAB_STATE.experiments[expId];
  if (!exp || exp.status !== 'draft') return null;
  let base = LAB_STATE.runs[exp.baselineRunId] || null;
  const method = base ? lab.getMethod(base.method) : null;
  if (base && (!method || labIsCompareOnly(method) || (labStepProgress(lab, base).next && labRunLocked(base.id))))
    base = null;
  const reused = base ? null : labSeenBaseline(lab, LAB_STATE.activeSpecimenId || labFirstSpecimenId(lab));
  if (reused) base = reused;
  // The change is read before anything is made: a refusal leaves the state as it was.
  const change = labChangeForExperiment(lab, exp, base ? base.params : labClone(SilverLab.DEFAULT_PARAMS));
  if (!change) return { exp, refused: true };
  const sealed = [];
  if (!base) {
    base = labNewRun({ label: LAB_WORDS.standard, deferSave: true });
    sealed.push(base.id);
  } else if (!reused) {
    const p = labStepProgress(lab, base);
    if (p.next && !p.count) sealed.push(base.id);
    const rest = p.needed.filter(s => !p.done.has(s.id)).map(s => ({ type: 'step', step: s.id }));
    if (rest.length) labApplyEvents(base.id, rest);
  }
  const pair = labPairRuns(lab, base.id, labParamDiff(base.params, change.params).patch);
  if (!pair) {
    labSave();
    return null;
  }
  exp.baselineRunId = pair.baseline.id;
  exp.experimentalRunId = pair.experimental.id;
  labSealRuns(exp.id, [...sealed, pair.experimental.id]);
  labSave();
  return { exp, baseline: pair.baseline, experimental: pair.experimental, reused: !!reused };
}

/* ---------- bench: History (run picker, log, replay), out of the main view ---------- */
// The log in the export's words (UX-POLISH): one line per event ("2. Changed setting: Development
// time: longer"), the settings as the export prints them, deviations by step name. The run's saved
// ids stay on the first line.
function labRunLog(run, { locked = false } = {}) {
  const rows = run.events
    .map(e => `<tr><td class="lab-num">${esc(e.seq)}.</td><td>${esc(labEventText(e))}</td></tr>`)
    .join('');
  const deviations = (run.deviations || []).filter(d => d.kind !== 'not-runnable');
  return el(`<section class="lab-log" aria-labelledby="lab-log-h">
    <h3 id="lab-log-h">Run log</h3>
    <p class="lab-dim">${esc(labRunLabel(run))} · <code>${esc(run.id)}</code> · ${esc(run.specimenId)} · ${esc(run.method)}${run.createdAt ? ` · created ${esc(labFmtDate(run.createdAt))}` : ''}</p>
    ${labSettingsLines(run)
      .map(line => `<p class="lab-log-settings">${esc(line)}</p>`)
      .join('')}
    <div class="lab-table-wrap"><table class="lab-table lab-log-table"><caption>Events in order</caption><thead><tr><th scope="col">#</th><th scope="col">What happened</th></tr></thead><tbody>${rows || '<tr><td colspan="2" class="lab-dim">no events yet</td></tr>'}</tbody></table></div>
    <p>Deviations: ${esc(deviations.length ? labDeviationsText(deviations) : 'none recorded')}</p>
    <form class="lab-note-form" id="lab-note-form"><label class="lab-field"><span>Add a note to the log</span><input type="text" id="lab-note-text" name="text" maxlength="300" autocomplete="off"${locked ? ' disabled' : ''}></label><button type="submit" class="btn" id="lab-note-add"${locked ? ' disabled' : ''}>Add note</button></form>
  </section>`);
}
function labReplayPanel(lab, run, ctx) {
  // The replay's state tables would show a sealed run's outcome: only the note (UX-POLISH).
  if (labIsSealed(run.id))
    return el(
      `<section class="lab-replay" aria-labelledby="lab-replay-h"><h3 id="lab-replay-h">Replay</h3>${labSealedNote(run.id)}</section>`
    );
  const frames = lab.replay(run);
  const section = el(`<section class="lab-replay" aria-labelledby="lab-replay-h">
    <h3 id="lab-replay-h">Replay</h3>
    ${labBanner({ label: SilverLab.LABELS.SYNTHETIC }, 'Replay')}
    <p class="lab-note">Scrub through the log: each frame shows the event, the rules that fired on it and the state of each structure after it.</p>
    ${
      frames.length
        ? `<div class="lab-replay-controls"><button type="button" class="btn" id="lab-replay-prev" aria-label="Previous frame">Previous</button><label class="lab-field lab-range"><span>Frame <output id="lab-replay-pos">${Math.min(ctx.frame, frames.length - 1) + 1}</output> of ${frames.length}</span><input type="range" id="lab-replay-range" min="0" max="${frames.length - 1}" value="${Math.min(ctx.frame, frames.length - 1)}"></label><button type="button" class="btn" id="lab-replay-next" aria-label="Next frame">Next</button></div><p class="lab-replay-live" id="lab-replay-live" aria-live="polite"></p><div id="lab-replay-frame"></div>`
        : '<p class="lab-dim">No events to replay yet.</p>'
    }
  </section>`);
  if (!frames.length) return section;
  const range = section.querySelector('#lab-replay-range'),
    pos = section.querySelector('#lab-replay-pos'),
    live = section.querySelector('#lab-replay-live'),
    host = section.querySelector('#lab-replay-frame');
  const progress = labStepProgress(lab, run);
  const total = progress.total || SilverLab.STEPS.length;
  // One short line is announced per frame; the frame's table stays out of the live region (A11Y-08).
  // Counted over the steps the run needs (a step its settings skip is not one of them; ENGINE-14).
  const say = frame => {
    const done = new Set(frame.stepsDone.filter(step => !progress.skipped.has(step)));
    return `${labEventText(frame.event || {})}, ${done.size} of ${total} steps`;
  };
  const show = index => {
    ctx.frame = Math.max(0, Math.min(frames.length - 1, index));
    range.value = String(ctx.frame);
    pos.textContent = String(ctx.frame + 1);
    live.textContent = `Frame ${ctx.frame + 1} of ${frames.length}: ${say(frames[ctx.frame])}`;
    host.replaceChildren(labFrameView(lab, frames[ctx.frame], ctx.frame, frames.length));
  };
  range.addEventListener('input', () => show(Number(range.value)));
  section.querySelector('#lab-replay-prev').addEventListener('click', () => show(ctx.frame - 1));
  section.querySelector('#lab-replay-next').addEventListener('click', () => show(ctx.frame + 1));
  show(ctx.frame);
  return section;
}
function labHistorySection(lab, run, ctx, mode) {
  const section =
    el(`<section class="lab-part lab-history" id="lab-history" aria-labelledby="lab-history-h"${ctx.historyOpen ? '' : ' hidden'}>
    <div class="lab-part-head"><h2 id="lab-history-h" tabindex="-1">History</h2><button type="button" class="lab-linkbtn" id="lab-history-close">Close history</button></div>
    <p class="lab-note">Every run you made, the full log of the current one and a frame-by-frame replay. Engine names appear here as they are saved.</p>
    <div class="lab-fields lab-history-runs">${labRunSelectHtml('lab-run-select', ctx.runId, { labelText: 'Your runs' })}</div>
  </section>`);
  const close = () => {
    ctx.historyOpen = false;
    // Focus comes back to what opened History, scrolled into view (A11Y-12): the Run menu's button,
    // since the toggle itself sits in the closed menu (UX-R2).
    ctx.refresh(['#lab-history-toggle', '#lab-run-menu-btn']);
  };
  section.querySelector('#lab-history-close').addEventListener('click', close);
  // Esc closes History from anywhere inside it, like the side sheet (A11Y-12).
  section.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (event.target && event.target.closest && event.target.closest('select, input[type="range"]')) return;
    event.preventDefault();
    close();
  });
  section.querySelector('#lab-run-select').addEventListener('change', event => {
    Object.assign(ctx, {
      runId: event.target.value || null,
      frame: 0,
      pairBaseline: event.target.value || null,
      pairChange: null,
      compared: false,
      compareOpen: false,
      scopeOpen: false,
      setupOpen: false,
    });
    // The address names the run shown, so a reload or a shared link opens it (UX-LAST); replaceState,
    // so Back still leaves the bench. The pairing and experiment keys belong to the run left behind.
    try {
      history.replaceState({ sec: 'lab' }, '', labUrl({ view: 'bench', run: ctx.runId }));
    } catch {
      /* the URL is cosmetic here */
    }
    labEvents.emit('run', ctx.runId ? LAB_STATE.runs[ctx.runId] : null);
    ctx.refresh('#lab-run-select');
  });
  if (!run) return section;
  const log = labRunLog(run, { locked: ctx.locked });
  log.querySelector('#lab-note-form').addEventListener('submit', event => {
    event.preventDefault();
    const text = log.querySelector('#lab-note-text').value.trim();
    if (!text || ctx.locked) return;
    labApplyEvent(ctx.runId, { type: 'note', text });
    ctx.refresh('#lab-note-text');
  });
  section.appendChild(log);
  const progress = labStepProgress(lab, run);
  if (progress.total && !progress.next) section.appendChild(labDoExtras(lab, run, ctx, { progress }));
  section.appendChild(labReplayPanel(lab, run, ctx));
  if (mode === '3d' && !labIsSealed(run.id)) {
    const events = run.events;
    const row = el(`<div class="lab-row lab-3d-replay" role="group" aria-label="Replay on the 3D bench">
      <button type="button" class="btn" id="lab-3d-replay"${events.length ? '' : ' disabled'}>Replay on the bench</button>
      <label class="lab-field lab-inline"><span>Speed</span><select id="lab-3d-speed"><option value="0.5"${ctx.speed === 0.5 ? ' selected' : ''}>slow</option><option value="1"${ctx.speed === 1 ? ' selected' : ''}>normal</option><option value="2"${ctx.speed === 2 ? ' selected' : ''}>fast</option></select></label>
      <span class="lab-dim" id="lab-3d-status" role="status">${LAB.bench ? '3D bench ready.' : 'Loading the 3D bench…'}</span>
    </div>`);
    row.querySelector('#lab-3d-speed').addEventListener('change', event => {
      ctx.speed = Number(event.target.value) || 1;
    });
    row.querySelector('#lab-3d-replay').addEventListener('click', async () => {
      const current = ctx.runId ? LAB_STATE.runs[ctx.runId] : null;
      if (!current || !LAB.bench) return;
      const status = row.querySelector('#lab-3d-status');
      status.textContent = 'Replaying…';
      labReveal('#lab-clip-stage');
      const done = await LAB.bench.replay(lab.replay(current), { speed: ctx.speed });
      if (status.isConnected) status.textContent = done ? 'Replay finished.' : 'Replay stopped.';
      if (LAB.bench) LAB.bench.setRun(labBenchRun(current), { animate: false });
      labSyncSlideTint(lab, ctx); // §11.4: the bench's replay() cleared the look tint
    });
    section.appendChild(row);
  }
  return section;
}

/* ---------- bench view: one component, list mode or 3D mode, refreshed in place ---------- */
/* ---------- notepad beside the bench (FREE-2) ---------- */
// E4 (FIX2): at 1100 px and up the notepad is the sticky column beside the bench (settings.notesOpen,
// open by default); narrower it is a bottom drawer over the page (lab.css), closed until the student
// opens it, which is remembered on its own (settings.notesOpenNarrow). The bench and the full microscope
// view (main.lab-notes-host) carry the same Notes button and notepad.
// Below 900 px the notepad is a bottom drawer; from 900 px up a side column (G7, FIX3; was 1100 px).
const LAB_NOTES_NARROW = '(max-width: 899.98px)';
const labNotesNarrow = () => labMedia(LAB_NOTES_NARROW);
const labNotesOpen = () =>
  labNotesNarrow() ? LAB_STATE.settings.notesOpenNarrow === true : !!LAB_STATE.settings.notesOpen;
function labSetNotepad(text) {
  LAB_STATE.notepad = typeof text === 'string' ? text : String(text ?? '');
  return labSave();
}
const labNotesButtonHtml = (cls = '') =>
  `<button type="button" class="lab-head-btn${cls}" id="lab-notes-toggle" aria-expanded="${labNotesOpen()}" aria-controls="lab-notepad">Notes</button>`;
// G7: a second Notes button, fixed at the bottom right, for the drawer's layout while the header's Notes
// button is off screen (labNotesFloatSync); the same notepad, the same open state.
const labNotesFloatHtml = () =>
  '<button type="button" class="lab-notes-float" id="lab-notes-float" aria-controls="lab-notepad" aria-expanded="false" hidden>Notes</button>';
function labNotepadHtml() {
  const open = labNotesOpen();
  return `<aside class="lab-notepad" id="lab-notepad" aria-labelledby="lab-notepad-h"${open ? '' : ' hidden'}>
    <div class="lab-notepad-head"><h2 id="lab-notepad-h">Notes</h2><button type="button" class="lab-linkbtn" id="lab-notepad-more" hidden>Open</button><button type="button" class="lab-linkbtn" id="lab-notepad-close">Close</button></div>
    <p class="lab-dim lab-notepad-hint">Write what you notice. Saved as you type; download it any time.</p>
    <textarea id="lab-notepad-text" rows="14" aria-describedby="lab-notepad-status">${esc(LAB_STATE.notepad || '')}</textarea>
    <p class="lab-dim lab-notepad-status" id="lab-notepad-status" role="status"></p>
    <p class="lab-row"><button type="button" class="lab-linkbtn" id="lab-notepad-download">Download my notes (.txt)</button></p>
  </aside>`;
}
// Typing saves after a short pause (one write per pause, not per key); Close (and Escape in the drawer)
// closes it like the Notes button.
function labNotepadWire(main) {
  const area = main.querySelector('#lab-notepad-text'),
    status = main.querySelector('#lab-notepad-status');
  if (!area) return;
  let timer = null;
  const flush = () => {
    timer = null;
    if (area.value === (LAB_STATE.notepad || '')) return;
    const ok = labSetNotepad(area.value);
    if (status) status.textContent = ok ? 'Saved.' : LAB_SAVE_PAUSED;
  };
  area.addEventListener('input', () => {
    if (status) status.textContent = '';
    clearTimeout(timer);
    timer = setTimeout(flush, 400);
  });
  area.addEventListener('blur', () => {
    clearTimeout(timer);
    flush();
  });
  main.querySelector('#lab-notepad-download')?.addEventListener('click', () => {
    clearTimeout(timer);
    flush();
    const body = `My notes: ${LAB_TITLE}\n\n${LAB_STATE.notepad || ''}\n`;
    try {
      const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my-lab-notes.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (status) status.textContent = 'Downloaded.';
    } catch {
      if (status) status.textContent = 'This browser could not start the download; copy the text instead.';
    }
  });
  main.querySelector('#lab-notepad-close')?.addEventListener('click', () => labNotepadToggle(false));
  main.querySelector('#lab-notes-float')?.addEventListener('click', () => labNotepadToggle(true));
  // I5 (FIX5): a slim drawer (left so by a drop) opens again with its Open button, a press on its bar, typing
  // in it or a focus the student moves into its textarea.
  main.querySelector('#lab-notepad-more')?.addEventListener('click', () => labNotepadToggle(true));
  main.querySelector('#lab-notepad')?.addEventListener('pointerdown', event => {
    if (labNotesSlimNow() && !event.target.closest('#lab-notepad-close, #lab-notepad-more')) labNotesSlim(false);
  });
  // typing, or the student moving focus into it (a focus it kept through a drop moves nowhere)
  for (const type of ['input', 'focus'])
    area.addEventListener(type, () => {
      if (labNotesSlimNow()) labNotesSlim(false);
    });
  // The floating Notes button follows the header's: shown while that one is scrolled out of view. I5 (FIX5):
  // one function places it (labNotesFloatSync), run once a frame after a scroll, a resize, any change of
  // the page's size (ResizeObserver) or of what it draws (a redraw, a part opened or closed, the 3D HUD, a
  // mode switch: MutationObserver; the bench's own canvas and tags left out), a <details> toggled, and the
  // view's page-in animation ending (its transform holds the fixed button out of place until then).
  let frame = 0;
  const follow = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      labNotesFloatSync();
    });
  };
  window.addEventListener('scroll', follow, { passive: true });
  window.addEventListener('resize', follow);
  main.addEventListener('animationend', follow);
  main.addEventListener('toggle', follow, true);
  const resized = typeof ResizeObserver === 'function' ? new ResizeObserver(follow) : null;
  if (resized) resized.observe(main);
  const own = node => {
    const at = node && node.nodeType === 1 ? node : node && node.parentElement;
    return !!at && !!at.closest('#lab-notes-float, #lab-bench-3d, .labm-tag, .lab-slide-ghost');
  };
  const drawn =
    typeof MutationObserver === 'function'
      ? new MutationObserver(records => {
          if (records.some(record => !own(record.target))) follow();
        })
      : null;
  if (drawn)
    drawn.observe(main, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['hidden', 'open', 'class'],
    });
  labHandles.add(() => {
    window.removeEventListener('scroll', follow);
    window.removeEventListener('resize', follow);
    if (resized) resized.disconnect();
    if (drawn) drawn.disconnect();
    if (frame) cancelAnimationFrame(frame);
  });
  // Escape closes the drawer (narrow screens); beside the bench the column stays until Close or Notes.
  main.querySelector('#lab-notepad')?.addEventListener('keydown', event => {
    // A rack drag in 3D takes Escape first (it cancels the drag; the bench listens on the window).
    if (event.key !== 'Escape' || !labNotesNarrow() || main.classList.contains('lab-rack-dragging')) return;
    event.preventDefault();
    event.stopPropagation();
    labNotepadToggle(false);
  });
  // Crossing 900 px swaps the column for the drawer (or back), each with its own open state.
  const query = typeof window.matchMedia === 'function' ? window.matchMedia(LAB_NOTES_NARROW) : null;
  if (query && typeof query.addEventListener === 'function') {
    const sync = () => labNotesSync();
    query.addEventListener('change', sync);
    labHandles.add(() => query.removeEventListener('change', sync));
  }
}
// The page shows the open state of the current layout (the class, the aside, the buttons). A slim drawer
// (I5) is the drawer's own state: it goes when the drawer closes or the layout becomes the column.
function labNotesSync() {
  const open = labNotesOpen();
  document.querySelector('main.lab-notes-host')?.classList.toggle('lab-notes-open', open);
  const aside = document.querySelector('#lab-notepad');
  if (aside) aside.hidden = !open;
  for (const button of document.querySelectorAll('#lab-notes-toggle, #lab-notes-float'))
    button.setAttribute('aria-expanded', String(open));
  if (labNotesSlimNow() && !(open && labNotesNarrow())) labNotesSlim(false);
  labNotesFloatSync();
}
// I5 (FIX5): after a drag on the bench (the list's slide or the 3D rack) ends with the drawer open, the
// drawer stays slim (its bar, as during the drag) until the student opens it again (its Open button, a
// press on the bar, typing, a Notes button), so it never covers the row or the stage that just reacted.
const labNotesSlimNow = () =>
  typeof document !== 'undefined' && !!document.querySelector('main.lab-notes-host.lab-notes-slim');
function labNotesSlim(on) {
  if (typeof document === 'undefined') return;
  const main = document.querySelector('main.lab-notes-host');
  if (!main) return;
  // LEAD-1 (simplified): the slim bar after a drag kept producing edge cases (a tap on the bar starting a
  // download, the bar cutting a stuck Do this step, focus left on a textarea under the bar). On a narrow
  // screen a drag's end now CLOSES an open drawer; the Notes buttons open it again. Nothing stays slim.
  if (on) {
    if (labNotesNarrow() && labNotesOpen()) {
      const aside = document.querySelector('#lab-notepad');
      const had = !!(aside && aside.contains(document.activeElement));
      LAB_STATE.settings.notesOpenNarrow = false;
      labSave();
      labNotesSync();
      if (had) labFocusAfterDrawerClose();
    }
    on = false;
  }
  const slim = !!on && labNotesNarrow() && labNotesOpen();
  if (main.classList.contains('lab-notes-slim') !== slim) main.classList.toggle('lab-notes-slim', slim);
  const more = main.querySelector('#lab-notepad-more');
  if (more && more.hidden === slim) more.hidden = !slim;
  labNotesFloatSync();
}
// LEAD-1: the drawer closed while focus was in it (a drag's end): focus the first heading or control in view.
function labFocusAfterDrawerClose() {
  const main = document.querySelector('main.lab-notes-host');
  const target = labFirstInView(main) || document.querySelector('#lab-notes-float:not([hidden])');
  if (target) target.focus({ preventScroll: true });
}
// G7: the floating Notes button shows in the drawer's layout (below 900 px) while the drawer is closed and
// the header's Notes button is out of view (scrolled under the top bar or below the window). H5 (FIX4): it
// never covers a control: it stands 8 px above a stuck "Do this step" (its real top; else 16 px + the safe
// area, lab.css) and hides wherever it would lie over a drawn button, link, field, the 3D stage or the
// microscope's picture with its chips (D1: nothing covers what the student clicks). I5 (FIX5): nor over a
// label's words (a specimen card's name) or a row's note; nodes that are not drawn (display none, inside a
// closed <details>, visibility hidden) do not count. While a microscope picture is on screen (the microscope
// view, the inline one on the result card) it is never hidden for that: it moves to the free place nearest its
// own, up the right edge, else up the left edge, over the page beside the picture (never over the picture or
// its chips' words).
const LAB_FLOAT_CLEAR = '#lab-bench-3d canvas, .labm-stage canvas';
const LAB_FLOAT_AVOID = `${LAB_FLOAT_CLEAR}, a[href], button, input, select, textarea, summary, [role="button"]`;
// ... nor over the words of a label, of the lab's reaction on a row, of the 3D stage's chips or of the picture's
// chips and count line (measured by their words: a row's own empty right side may still be under the button, as
// its title may be, and so may the empty end of a chip row).
// MODE-FIX-shell-8: a row's title, the picture's captions and the What happened log's lines too.
const LAB_FLOAT_TEXT =
  'li.lab-step .lab-step-note, li.lab-step .lab-step-title, label, .lab-hud, .labm-hud, .labm-tally, .labm-caption, .labm-textalt, #lab-reactions .lab-reaction-text, #lab-reactions .lab-reaction-step, .lab-empty-line';
const LAB_FLOAT_GAP_PX = 8;
// The step of the microscope view's search for a free place (px).
const LAB_FLOAT_STEP_PX = 4;
// A phone's sticky "Do this step" while it is stuck to the window's bottom (its box), else null: in the flow
// (above its stuck place, under the list) it covers nothing.
function labStuckBar(doc = typeof document === 'undefined' ? null : document) {
  const bar = doc ? doc.querySelector('#lab-do:not(.lab-bench-3d) #lab-do-step') : null;
  const win = doc && doc.defaultView;
  if (!bar || !win || typeof win.getComputedStyle !== 'function' || bar.closest('[hidden]')) return null;
  const style = win.getComputedStyle(bar);
  if (style.position !== 'sticky' || style.visibility === 'hidden') return null;
  const box = bar.getBoundingClientRect();
  const offset = parseFloat(style.bottom);
  if (!box.height || !Number.isFinite(offset)) return null;
  return Math.abs(box.bottom - (win.innerHeight - offset)) < 1.5 ? box : null;
}
// I5 (FIX5): whether a node is drawn now (the browser's checkVisibility where it has one), never inside a
// closed <details> other than in its summary, nor hidden or visibility hidden.
function labDrawn(node) {
  if (!node || !node.isConnected) return false;
  const closed = node.closest('details:not([open])');
  if (closed) {
    const summary = node.closest('summary');
    if (!summary || summary.parentElement !== closed) return false;
  }
  if (typeof node.checkVisibility === 'function')
    return node.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
  if (node.closest('[hidden]')) return false;
  const style = typeof getComputedStyle === 'function' ? getComputedStyle(node) : null;
  return !style || (style.display !== 'none' && style.visibility !== 'hidden');
}
// The boxes the floating button must keep off: every drawn control (and the canvases) and the words of a
// label or a row's note, as client rects.
function labFloatBlocks(float) {
  const boxes = [];
  const keep = r => r && r.width > 1 && r.height > 1;
  for (const node of document.querySelectorAll(LAB_FLOAT_AVOID)) {
    if (node === float || float.contains(node)) continue;
    const r = node.getBoundingClientRect();
    if (keep(r) && labDrawn(node)) boxes.push(r);
  }
  if (typeof document.createRange !== 'function') return boxes;
  for (const node of document.querySelectorAll(LAB_FLOAT_TEXT)) {
    const outer = node.getBoundingClientRect();
    if (!keep(outer) || !labDrawn(node)) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = typeof range.getClientRects === 'function' ? [...range.getClientRects()] : [];
    for (const r of rects) if (r.width > 1 && r.height > 0) boxes.push(r);
  }
  return boxes;
}
const labMeets = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
// A microscope picture (the microscope view's, or the one inline on the bench's result card) while some of
// it is in the free band (between the top bar and the window's bottom), else null.
function labPictureOnScreen() {
  const { top } = labViewportInsets();
  return (
    [...document.querySelectorAll('main.lab-notes-host .labm-stage canvas')].find(canvas => {
      const r = canvas.getBoundingClientRect();
      return r.width > 1 && r.height > 1 && r.bottom > top && r.top < window.innerHeight && labDrawn(canvas);
    }) || null
  );
}
function labNotesFloatSync() {
  if (typeof document === 'undefined') return;
  const float = document.querySelector('#lab-notes-float');
  if (!float) return;
  const head = document.querySelector('#lab-notes-toggle');
  let show = false;
  if (head && labNotesNarrow() && !labNotesOpen() && !head.closest('[hidden]')) {
    const box = head.getBoundingClientRect();
    // I5 (FIX5): not wholly in view (also half under the top bar) is out of view
    show = (box.width > 0 || box.height > 0) && (box.top < labTopbarHeight() || box.bottom > window.innerHeight);
  }
  const bar = show ? labStuckBar() : null;
  // Its own place: 8 px above a stuck Do this step, else the CSS place (bottom right).
  const place = { bottom: bar ? `${Math.round(window.innerHeight - bar.top + LAB_FLOAT_GAP_PX)}px` : '', left: '' };
  const put = ({ bottom, left }) => {
    if (float.style.bottom !== bottom) float.style.bottom = bottom;
    if (float.style.left !== left) float.style.left = left;
    const right = left ? 'auto' : '';
    if (float.style.right !== right) float.style.right = right;
  };
  put(place);
  if (show) {
    const was = float.hidden;
    float.hidden = false; // measured where it would sit (fixed: the same at any scroll)
    const spot = float.getBoundingClientRect();
    float.hidden = was;
    const blocks = labFloatBlocks(float);
    const free = r => !blocks.some(b => labMeets(r, b));
    if (!free(spot)) {
      show = false;
      if (spot.width > 1 && labPictureOnScreen()) {
        // A picture on screen: the nearest free place up the right edge, else up the left edge (the same gap
        // from the window's side), never above the top bar.
        const ceiling = labViewportInsets().top + LAB_FLOAT_GAP_PX;
        const gap = Math.max(0, window.innerWidth - spot.right);
        const sides = [
          { left: spot.left, right: spot.right, css: '' },
          { left: gap, right: gap + spot.width, css: `${Math.round(gap)}px` },
        ];
        search: for (const side of sides)
          for (let lift = side.css ? 0 : LAB_FLOAT_STEP_PX; spot.top - lift >= ceiling; lift += LAB_FLOAT_STEP_PX) {
            const r = { left: side.left, right: side.right, top: spot.top - lift, bottom: spot.bottom - lift };
            if (!free(r)) continue;
            put({ bottom: `${Math.round(window.innerHeight - r.bottom)}px`, left: side.css });
            show = true;
            break search;
          }
      }
    }
  }
  if (!show) put(place);
  if (float.hidden === show) float.hidden = !show;
}
// Opens or closes the notepad of the current layout and remembers it; focus goes into the textarea on
// open and, on close, back to whichever Notes button is in view (the header's, or the floating one), never
// with a scroll: the column and the drawer are in view. I5 (FIX5): Notes on a slim drawer opens it again
// (`open` left out: the header's button toggles); on the microscope views the drawer opening brings the
// picture into the band above it; a Close with no Notes button in view gives focus to the first control
// (or heading) in view, never to one off screen.
function labNotepadToggle(open) {
  if (open === undefined) open = labNotesSlimNow() || !labNotesOpen();
  LAB_STATE.settings[labNotesNarrow() ? 'notesOpenNarrow' : 'notesOpen'] = !!open;
  labSave();
  labNotesSlim(false);
  labNotesSync();
  if (open) {
    labPictureAboveDrawer();
    const area = document.querySelector('#lab-notepad-text');
    if (area) {
      area.focus({ preventScroll: true });
      // LEAD-2: new notes go after the old ones (the caret at the end, on a new line when the text has one)
      const end = area.value.length;
      try {
        area.setSelectionRange(end, end);
      } catch {
        /* a field without selection support */
      }
      area.scrollTop = area.scrollHeight;
    }
    return;
  }
  const head = document.querySelector('#lab-notes-toggle');
  const float = document.querySelector('#lab-notes-float');
  const seen = node => !!node && labDrawn(node) && labInFreeBand(node);
  // A page with no layout (no box to measure) cannot say what is in view: the header's button, as before.
  const box = head ? head.getBoundingClientRect() : null;
  const unmeasured = !!box && !box.width && !box.height;
  const target = seen(head)
    ? head
    : float && !float.hidden
      ? float
      : labFirstInView(head && head.closest('main')) || (unmeasured ? head : null);
  target?.focus({ preventScroll: true });
}
// I5 (FIX5): the microscope view's picture (with its chips when they fit; on the bench the inline picture of
// the result card while it is on screen) brought into the band between the top bar and the open drawer, when
// it is not wholly there.
function labPictureAboveDrawer() {
  // the microscope view's picture wherever it is; on the bench the inline one only while it is on screen
  const main =
    document.querySelector('main.lab-view-microscope') ||
    (labPictureOnScreen() && document.querySelector('main.lab-notes-host'));
  // LEAD-3: in 3D on a narrow screen, opening Notes brings the bench's stage above the drawer too
  const bench = !main && labNotesNarrow() && document.querySelector('main.lab-view-bench #lab-bench-3d');
  if (bench && labDrawn(bench) && labViewportInsets().bottom) {
    const canvas = bench.querySelector('canvas') || bench;
    if (!labInFreeBand(canvas)) labRevealInBand(canvas);
    return;
  }
  if (!main || !labNotesNarrow() || !labViewportInsets().bottom) return;
  const stages = [...main.querySelectorAll('.labm-stage')].filter(labDrawn);
  if (!stages.length) return;
  const middle = window.innerHeight / 2;
  const centre = node => {
    const r = node.getBoundingClientRect();
    return Math.abs((r.top + r.bottom) / 2 - middle);
  };
  const stage = stages.sort((a, b) => centre(a) - centre(b))[0];
  const { top, bottom } = labViewportInsets();
  const room = window.innerHeight - bottom - top - 16;
  const canvas = stage.querySelector('canvas');
  const target = stage.getBoundingClientRect().height <= room || !canvas ? stage : canvas;
  if (!labInFreeBand(target)) labRevealInBand(target);
}
// The first heading the page lets take focus, else the first control, wholly in the free band (never one in
// the notepad).
function labFirstInView(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return null;
  const usable = node =>
    !node.disabled && !node.closest('#lab-notepad, #lab-notes-float') && labDrawn(node) && labInFreeBand(node);
  return (
    [...root.querySelectorAll('h1[tabindex], h2[tabindex], h3[tabindex]')].find(usable) ||
    [...root.querySelectorAll('button, a[href], summary, select, input, textarea, canvas[tabindex]')].find(usable) ||
    null
  );
}

function labRenderBench(lab, params) {
  // ?mode=3d&intro=1 (the home intro card #lab-clip-watch, the M1 clip step; contract §7.1): switch to the
  // 3D bench when it can run (the blocked-mode notice shows otherwise) and queue the intro for the
  // moment the bench is ready. The intro plays before the safety gate (PLAN §3.1; the gate is about
  // doing steps, which stay gated). Both keys are consumed: a reload or a later mode switch must not
  // re-force the mode or replay the intro. On a phone the intro borrows 3D without saving it (F7).
  const wants3d = params.get('mode') === '3d';
  const intro = params.get('intro') === '1';
  if (wants3d && !lab3dBlockedReason() && labCurrentMode() !== '3d') {
    if (intro && labNarrow()) labModeOverride = '3d';
    else {
      LAB_STATE.mode = '3d';
      labSave();
    }
    labEvents.emit('mode', '3d');
  }
  if (params.has('mode') || params.has('intro')) {
    const rest = Object.fromEntries([...params].filter(([key]) => key !== 'mode' && key !== 'intro'));
    try {
      history.replaceState({ sec: 'lab' }, '', labUrl(rest));
    } catch {
      /* the URL is cosmetic here */
    }
  }
  const main = el(`<main class="panel lab-page lab-view-bench lab-notes-host" data-mode="${esc(labCurrentMode())}">
    <span class="label">${esc(LAB_TITLE)} &middot; Bench</span>
    <div class="lab-titlebar"><h1>Bench</h1><div class="lab-bench-headhost" id="lab-bench-head"></div></div>
    ${labNavHtml(lab)}
    ${intro && lab3dBlockedReason() ? `<aside class="course-notice lab-intro-blocked" role="status"><p>The 3D intro cannot play here. ${esc(lab3dBlockedReason())} <a data-lab-go href="${esc(labUrl({ view: 'intro' }))}">Read the intro as text</a>.</p></aside>` : ''}
    <p role="status" id="lab-save-status" class="lab-save-status"></p>
    <div id="lab-live" role="status" aria-live="polite" class="lab-sr-only"></div>
    <div id="lab-bench-body" class="lab-bench-body"></div>
    ${labNotepadHtml()}
    ${labNotesFloatHtml()}
    <div class="endbtns lab-endbtns"><a class="btn" data-lab-go href="${esc(labUrl())}">Back to the lab</a></div>
  </main>`);
  if (labNotesOpen()) main.classList.add('lab-notes-open');
  labView(main);
  labNotepadWire(main);
  // List mode on a phone: the sticky "Do this step" covers the bottom of the screen, and Chrome leaves a
  // partly covered control where it is: a focused control under it is lifted above it (A11Y-03). The
  // side sheet is drawn over the bar and scrolls on its own.
  main.addEventListener('focusin', event => {
    const bar = main.querySelector('#lab-do-step');
    const target = event.target;
    if (!bar || !target || target === bar || typeof getComputedStyle !== 'function') return;
    if (target.closest('#lab-sheet, #lab-notepad') || getComputedStyle(bar).position !== 'sticky') return;
    const box = target.getBoundingClientRect(),
      over = bar.getBoundingClientRect();
    if (box.bottom > over.top && box.top < over.bottom)
      labEnsureVisible(target, { bottomInset: Math.max(0, window.innerHeight - over.top) });
  });
  labBenchMount(lab, main, {
    runId: params.get('run'),
    pairId: params.get('pair'),
    experiment: params.get('exp'),
    intro,
  });
}
function labBenchMount(lab, main, opts) {
  const host = main.querySelector('#lab-bench-body');
  const headHost = main.querySelector('#lab-bench-head');
  const runParam = opts.runId && LAB_STATE.runs[opts.runId] ? opts.runId : null;
  const pairParam = opts.pairId && LAB_STATE.runs[opts.pairId] ? opts.pairId : null;
  // Only a draft proposal takes its runs from the bench: a revealed or done design is locked (CC-1).
  // "Make the runs for me" (?exp=, UX-POLISH): a draft without its two runs gets them made and sealed
  // once the safety notes are acknowledged; a draft whose sealed pair exists shows its message again;
  // a draft that names two runs of its own keeps the pairing panel (CC-3).
  const wanted = opts.experiment ? LAB_STATE.experiments[opts.experiment] : null;
  const draft = wanted && wanted.status === 'draft' ? wanted : null;
  const paired = !!draft && !!LAB_STATE.runs[draft.baselineRunId] && !!LAB_STATE.runs[draft.experimentalRunId];
  const sealedPair = paired && (labIsSealed(draft.baselineRunId) || labIsSealed(draft.experimentalRunId));
  const experiment = paired && !sealedPair ? draft.id : null;
  const ctx = {
    runId: sealedPair ? draft.experimentalRunId : runParam || LAB_STATE.runOrder[LAB_STATE.runOrder.length - 1] || null,
    sealDraftId: draft && !paired ? draft.id : null, // make the sealed pair on the next acknowledged refresh
    sealedReady: sealedPair ? draft.id : null, // the experiment whose sealed pair the result part announces
    makeRefused: null, // the experiment whose planned change the bench could not make (UX-LAST)
    revealSel: sealedPair ? '#lab-sealed-ready' : null, // scrolled to the top of the view after the refresh
    scopeOpen: false,
    scopeCompareOpen: false,
    frame: 0,
    setup: null, // the run being set up: { specimenId, method, label, change: { what, base, params } }
    setupOpen: false, // "New run" reopens the set-up while a run exists
    pairChange: null, // the comparison's change: { what, base, params, runId }
    pairBaseline: runParam,
    pairExperimental: pairParam,
    compared: !!pairParam,
    compareOpen: !!(pairParam || experiment), // a module / proposal pairing opens the comparison
    experiment,
    historyOpen: false,
    runMenuOpen: false, // the header's Run menu (New run, History, Safety notes), UX-R2
    sheet: null, // the side sheet: { kind: 'step' | 'object', id, follow, opener }
    station: null,
    stationsNav: null, // the station row under the stage (§11.2), rebuilt with the 3D part
    freeStep: null, // the free bench's jar select (§11.1), kept across redraws
    stage: null, // persistent 3D container (moved, never rebuilt, across refreshes)
    speed: 1,
    locked: false, // the active run is cited by an entry, a measurement or a revealed experiment
    openUi: null, // drawers / chip details open before the last refresh (reopened after it)
    afterAttach: [],
    mode: 'list',
    clip: labClipCtx(opts.intro), // tissue clip state (contract §7.1); `introQueued` plays the intro once the bench is ready
    caption: null, // the clip caption line (aria-live) and the transcript: built once, re-attached on refresh
    transcript: null,
    introGate: !!opts.intro, // the requested intro plays above the safety gate until it is acknowledged
    mountFocus: null, // the control a finished 3D mount gives focus back to (only the 3D button that asked)
    closeUi: null, // drawer keys the next refresh leaves closed
    refresh,
    doStep,
    runAll,
    newSlide,
    switchMode,
    editJar,
    addJar,
    removeJar,
    resetJars,
  };
  if (wanted && !draft) labAnnounce('This proposal is revealed; its runs are locked.');
  // FIX3 (desktop-3): the second press of a double click on a step row lands wherever the row's sheet
  // put things (its text, a button, Notes); within a double click's time it is part of that click and
  // does nothing (no focus move, no word selected, no button pressed). The listeners go with the view.
  const multi = event => {
    if (event.detail > 1 && ctx.rowClickAt && Date.now() - ctx.rowClickAt < LAB_DOUBLE_CLICK_MS) {
      event.preventDefault();
      if (event.type === 'click') event.stopPropagation();
    }
  };
  for (const type of ['mousedown', 'click']) document.addEventListener(type, multi, true);
  labHandles.add(() => {
    for (const type of ['mousedown', 'click']) document.removeEventListener(type, multi, true);
  });
  const run = () => (ctx.runId ? LAB_STATE.runs[ctx.runId] || null : null);
  // A finished run has no next step to explain: a step sheet closes with it (F13 / A11Y-01). "3D
  // options" closes too, so the finished run's first view keeps its few controls (an ordinary redraw
  // keeps it open while the student uses it). The 3D camera flies to the microscope station (S6), where
  // the finished slide goes next (UX-LAST; was the whole bench), unless a clip holds it (3D-5); Go to
  // station then names it.
  function finishedRun() {
    if (ctx.sheet && ctx.sheet.kind === 'step') ctx.sheet = null;
    ctx.station = null;
    labCloseOnRefresh(ctx, '3d-options');
    const clip = labClipState();
    if (LAB.bench && typeof LAB.bench.goToStation === 'function' && (!clip || clip.phase === 'bench'))
      try {
        LAB.bench.goToStation(LAB_FINISHED_STATION);
        ctx.station = LAB_FINISHED_STATION;
      } catch {
        /* the camera is cosmetic here */
      }
  }
  // What follows "n of 9 steps done" once a run is finished: where the result is, or that it is sealed.
  const doneLine = () => {
    const sealed = labSealedExp(ctx.runId);
    return sealed ? ` Sealed until you reveal ${labExperimentName(sealed)}.` : ' The result is ready below.';
  };
  // ONE primary action: the next step in procedure order; `stepId` (Pick a different step, a double click
  // on a jar) may name any step, in or out of order; the engine records any deviation. Steps wait for
  // the safety notes (the intro alone may play before them). `fromStage` (a jar's double click or a
  // slide dropped on it in 3D): the page does not move, so the next jar is still under the pointer.
  // `fromList` (the slide dropped on a row, G6): the same, and the row keeps its place on screen across
  // the redraw (the play bar above the list goes once the run is finished) and its note stays clear of a
  // phone's sticky Do this step.
  // What the bench says where the student acted (§11.1): the stage hint in 3D (quiet: the live region
  // says it too), the row's note line in list mode (until the next step is done).
  function placeNote(stepId, words) {
    if (!words) return;
    if (ctx.mode === '3d') labStageHint(ctx, words, { quiet: true });
    else ctx.stepNote = { runId: ctx.runId, id: stepId, text: words };
  }
  // MODE (§11.1): a refused step says why where the student acted and in the live region, and changes
  // nothing: practice refuses any jar but the next ("Next in the procedure: …" / "Done. Next: …"), the
  // free bench a sealed slide. `fromList`: the row is drawn again so its note shows.
  // §13.3: a jar row is found by its jar (a procedure jar's id is its step).
  const rowSel = id => `#lab-do li.lab-step[data-lab-jar="${id}"], #lab-do li.lab-step[data-lab-step="${id}"]`;
  function refuseStep(step, hint, { fromList = false } = {}) {
    labAnnounce(`${step.name || labStepTitle(step)}: ${hint}.`);
    placeNote(step.id, hint);
    if (ctx.mode !== '3d') {
      const rowAt = () => main.querySelector(rowSel(step.id));
      const rowTop = fromList && rowAt() ? rowAt().getBoundingClientRect().top : null;
      refresh(undefined, { reveal: false });
      const row = rowAt();
      if (row && rowTop !== null) {
        const moved = row.getBoundingClientRect().top - rowTop;
        if (Math.abs(moved) >= 1 && typeof window.scrollBy === 'function')
          window.scrollBy({ top: moved, behavior: 'instant' });
      }
    }
  }
  function doStep(stepId, focusSel, { fromStage = false, fromList = false } = {}) {
    const current = run();
    if (!current || labRunLocked(current.id) || !LAB_STATE.safetyAcknowledgedAt) return;
    const before = labStepProgress(lab, current);
    const free = labIsFree(current);
    // §13.3: on the free bench `stepId` names a jar (a procedure jar by its step, an extra one x1..x4); the
    // dip carries what is in it now and the hands it is done with. An engine without the shelf takes the
    // older step event.
    const jarId = labJarIdOf(stepId);
    const jar = free && jarId ? labJarById(lab, current, jarId) : null;
    const step = jar
      ? { id: jar.id, name: jar.title }
      : labIsExtraJar(jarId)
        ? { id: jarId, name: labExtraJarTitle(jarId) } // not on this bench: labDropHint says so below
        : jarId
          ? before.steps.find(s => s.id === jarId)
          : before.next;
    if (!step) return;
    // A step the run's settings skip is never done from the bench (ENGINE-14, practice).
    if (!free && before.skipped.has(step.id)) {
      labAnnounce(`${LAB_SKIPPED_SHEET}: ${labStepTitle(step)}.`);
      return;
    }
    const hint = labDropHint(lab, ctx, step.id);
    if (hint) return refuseStep(step, hint, { fromList });
    const again = before.done.has(step.id),
      early = !again && before.next && before.next.id !== step.id;
    const sealedBefore = labSlideSealed(current);
    ctx.stepNote = null;
    labApplyEvent(ctx.runId, (jar && labDipEvent(lab, current, jar.id)) || { type: 'step', step: step.id });
    const fresh = run();
    const after = labStepProgress(lab, fresh);
    const still = fromStage || fromList;
    const rowAt = () => main.querySelector(rowSel(step.id));
    const rowTop = fromList && rowAt() ? rowAt().getBoundingClientRect().top : null;
    if (free) {
      // Every dip on the free bench produces one reaction (§11.3), shown where the student acted, in the
      // live region and in the What happened log; mounting seals the slide (the camera goes to the
      // microscope, where the slide goes next). §13.2: a currently unknown reaction is said the same way.
      const reactions = Array.isArray(fresh.reactions) ? fresh.reactions : [];
      const last = reactions.length ? reactions[reactions.length - 1] : null;
      const title = step.name || labStepTitle(step);
      const words = last && last.text ? last.text : `${title} done.`;
      placeNote(step.id, words);
      const sealedNow = labSlideSealed(fresh) && !sealedBefore;
      if (sealedNow) finishedRun();
      else labFollowStation(lab, ctx, step.id, null);
      // A repeat says so (MODE-FIX-shell-14): the same jar's second no-reaction is a new announcement.
      const repeat = labStepCount(fresh, step.id) > 1;
      labAnnounce(`${title}${repeat ? ' again' : ''}: ${words}`);
      // The dip button, or, once the slide is sealed (the button disabled), the one live action, New slide
      // (MODE-FIX-shell-13: focus never drops to the body).
      refresh(
        [
          ...(still && ctx.sheet ? ['#lab-sheet-h'] : []),
          ...[].concat(focusSel || []),
          ...(sealedNow ? ['#lab-new-slide', '#lab-result-h'] : ['#lab-free-dip']),
        ],
        { reveal: !still }
      );
    } else {
      // Practice: after each step the procedure's own "what you should see" line for that stage (§11.1)
      // shows where the student acted and in the live region.
      const look = labRunLook(lab, fresh);
      const finished = !after.next && !!before.next;
      if (look && look.text) placeNote(step.id, look.text);
      if (!finished) labFollowStation(lab, ctx, step.id, after.next && after.next.id);
      labAnnounce(
        `${labStepTitle(step)} done${early ? ', out of order' : again ? ' again' : ''}.${look && look.text ? ` ${look.text}` : ''} ${after.count} of ${after.total} steps done.${after.next ? ` Next: ${labStepTitle(after.next)}.` : doneLine()}`
      );
      if (finished) finishedRun();
      // In 3D the stage comes back into view under the site's top bar after each step done from the
      // buttons (UX-POLISH); one done on the stage (or dropped on a row) leaves the page where it is.
      else if (ctx.mode === '3d' && after.next && !still) ctx.revealSel = '#lab-do';
      // H7 (FIX4): a drop or a jar's double click while a sheet is open keeps focus in that sheet (its
      // heading), so Escape still closes it.
      refresh(
        [
          ...(still && ctx.sheet ? ['#lab-sheet-h'] : []),
          ...[].concat(focusSel || []),
          ...(finished ? ['#lab-resolve-out .lab-banner', '#lab-result-h'] : ['#lab-do-step']),
        ],
        { reveal: !still }
      );
      if (finished && !focusSel) labReveal('#lab-result');
    }
    const row = fromList ? rowAt() : null;
    if (row && rowTop !== null) {
      const moved = row.getBoundingClientRect().top - rowTop;
      if (Math.abs(moved) >= 1 && typeof window.scrollBy === 'function')
        window.scrollBy({ top: moved, behavior: 'instant' });
      labClearStickyBar(row);
      // MODE-FIX-shell-4: a dip from the Dip control writes its reaction on a row that may sit below the
      // fold (a phone): the page scrolls just enough to show that row (a drop's row is already in view).
      if (focusSel === '#lab-free-dip') labEnsureVisible(row);
    }
  }
  // Every needed step not yet done, in procedure order (all nine on a fresh standard run; never a step
  // the run's settings skip, ENGINE-14). On the free bench "Do the whole procedure" (§11.1): the same
  // dips from where the slide is; a sealed slide takes none.
  function runAll() {
    const current = run();
    if (!current || labRunLocked(current.id) || !LAB_STATE.safetyAcknowledgedAt) return;
    const free = labIsFree(current);
    if (free && labSlideSealed(current)) {
      labAnnounce(`${LAB_SEALED_TIP}.`);
      if (ctx.mode === '3d') labStageHint(ctx, LAB_SEALED_TIP, { quiet: true });
      return;
    }
    const p = labStepProgress(lab, current);
    const done = free ? labFreeStepsDone(current) : p.done;
    // §13.3: on the free bench each procedure jar is dipped with what is in it now (the jars as they stand).
    const events = p.needed
      .filter(s => !done.has(s.id))
      .map(s => (free && labDipEvent(lab, current, s.id)) || { type: 'step', step: s.id });
    if (!events.length) return;
    ctx.stepNote = null;
    labApplyEvents(ctx.runId, events);
    if (free) {
      const fresh = run();
      const reactions = Array.isArray(fresh.reactions) ? fresh.reactions : [];
      const last = reactions.length ? reactions[reactions.length - 1] : null;
      const lastJar = last ? labEventJar(fresh.events.find(e => e && e.seq === last.seq)) || last.step : null;
      labAnnounce(
        `${events.length} dips done, in procedure order.${last && last.text ? ` ${labJarTitleById(lastJar)}: ${last.text}` : ''}`
      );
      if (last && last.text) placeNote(lastJar, last.text);
      if (labSlideSealed(fresh)) finishedRun();
      else labFollowStation(lab, ctx, labEventJar(events[events.length - 1]), null);
      refresh(['#lab-resolve-out .lab-banner', '#lab-result-h']);
      labReveal('#lab-result');
      return;
    }
    // MODE-FIX-integrate-3: the run's final by-eye line replaces the stage hint of the last single step
    // (a stale "no black yet" after Run the rest) and joins the announcement, as doStep's does.
    const look = labRunLook(lab, run());
    if (look && look.text) placeNote(events[events.length - 1].step, look.text);
    labAnnounce(
      `${events.length === p.total ? 'All' : 'The remaining'} ${events.length} steps done.${look && look.text ? ` ${look.text}` : ''}${doneLine()}`
    );
    finishedRun();
    refresh(['#lab-resolve-out .lab-banner', '#lab-result-h']);
    labReveal('#lab-result');
  }
  // "Do the whole procedure" dips from where the slide is (§11.1): a step counts as done only when its
  // latest dip changed the slide (a reaction); a dip that found nothing to act on (a no-reaction, say
  // the developer before any silver) is done again in its turn, so the procedure still runs in full.
  // §13.3: counted by jar (a dip's jar, read from its event), so a currently unknown dip is done again too.
  function labFreeStepsDone(current) {
    const done = new Set();
    const events = Array.isArray(current.events) ? current.events : [];
    for (const r of Array.isArray(current.reactions) ? current.reactions : []) {
      const id = r ? labEventJar(events.find(e => e && e.seq === r.seq)) || r.step : null;
      if (typeof id !== 'string') continue;
      if (r.kind === 'reaction') done.add(id);
      else done.delete(id);
    }
    return done;
  }
  // "New slide" (§11.1, §13.3): another run on the same specimen, in `mode` (the run's own by default): the
  // free bench keeps an older free run's settings (the jars carry over by themselves); practice is always the
  // procedure. The old run stays in History. Focus goes to `focus` (the mode switch keeps it), else to the
  // new run's first action.
  function newSlide(mode, { focus = null } = {}) {
    const current = run();
    if (!current || !LAB_STATE.safetyAcknowledgedAt) return;
    const next = labBenchModeOf(typeof mode === 'string' ? mode : current.mode);
    const keep = next === 'free' && labIsFree(current);
    LAB_STATE.settings.benchMode = next; // saved with the new run
    const made = labNewRun({
      specimenId: current.specimenId,
      method: keep ? current.method : LAB_RUNNABLE_METHOD,
      params: keep ? labRunParamsFull(current) : {},
      mode: next,
    });
    Object.assign(ctx, {
      runId: made.id,
      setup: null,
      setupOpen: false,
      frame: 0,
      stepNote: null,
      pairBaseline: made.id,
      pairChange: null,
      compared: false,
      compareOpen: false,
      scopeOpen: false,
      sheet: null,
    });
    labAnnounce(`New slide: ${LAB_BENCH_MODES[next].title}.`);
    labStageHint(ctx, ''); // MODE-FIX-integrate-7
    refresh([
      ...[].concat(focus || []),
      next === 'free' ? '#lab-free-dip:not(:disabled)' : '#lab-do-step:not(:disabled)',
      '#lab-do-h',
    ]);
    if (ctx.mode === '3d') labFrameRun(lab, ctx);
  }
  // §13.3 the mode switch: with a run, the other mode starts a new slide in it at once (the old run stays in
  // History; "New slide: <mode>."); with none, it sets the mode the next run starts in (the set-up's cards
  // follow). Pressing the mode already on does nothing.
  function switchMode(mode) {
    const next = labBenchModeOf(mode);
    const current = run();
    const now = current ? labBenchModeOf(current.mode) : labSetupState(lab, ctx, null).benchMode;
    const focus = `#lab-mode-switch [data-lab-benchmode="${next}"]`;
    if (next === now) return;
    if (current && LAB_STATE.safetyAcknowledgedAt) return newSlide(next, { focus });
    labSetupState(lab, ctx, null).benchMode = next;
    LAB_STATE.settings.benchMode = next;
    labSave();
    labAnnounce(`${LAB_BENCH_MODES[next].title}: the next run starts in this mode.`);
    refresh(focus);
  }
  // §13.3 the jars (bench state, LAB_STATE.freeJars; never a run event): each change saves, redraws the bench
  // (the rows' contents, the Jar select, the 3D tags and tray through api.jarLabel / api.extraJars) and
  // says what the jar holds now. Focus stays on the control the student used (its id), or `focus`.
  function writeJars(next, words, focus) {
    labWriteJars(next);
    if (words) labAnnounce(words);
    refresh(focus, { reveal: false });
  }
  function editJar(jarId, solution, focus) {
    const free = labFreeJars(lab);
    const clean = labJarSolution(labShelf(lab), solution);
    if (!free || !clean) return;
    const extra = free.extra.find(x => x.id === jarId);
    if (extra) extra.solution = clean;
    else if (free.jars[jarId]) free.jars[jarId] = clean;
    else return;
    writeJars(free, `${labJarTitleById(jarId)} now holds ${labSolutionText(lab, clean)}.`, focus);
  }
  // "Add a jar" (up to four): the first free place x1..x4, potassium permanganate until edited; its sheet
  // opens on the editor with focus on the bottle.
  function addJar() {
    const free = labFreeJars(lab);
    const shelf = labShelf(lab);
    const id = free ? LAB_EXTRA_JARS.find(x => !free.extra.some(j => j.id === x)) : null;
    const solution = id
      ? labJarSolution(shelf, { reagent: LAB_EXTRA_JAR_BOTTLE }) ||
        labJarSolution(shelf, { reagent: shelf.reagents[0].id })
      : null;
    if (!id || !solution) return;
    free.extra.push({ id, solution });
    labWriteJars(free);
    labAnnounce(`${labExtraJarTitle(id)} added: ${labSolutionText(lab, solution)}. Its editor is open.`);
    ctx.sheet = { kind: 'jar', id, follow: false, opener: '#lab-add-jar', overlay: true };
    refresh(['#lab-jar-bottle', '#lab-sheet-h'], { reveal: false });
  }
  function removeJar(jarId) {
    const free = labFreeJars(lab);
    if (!free || !free.extra.some(x => x.id === jarId)) return;
    free.extra = free.extra.filter(x => x.id !== jarId);
    if (ctx.freeStep === jarId) ctx.freeStep = null;
    if (ctx.stepNote && ctx.stepNote.id === jarId) ctx.stepNote = null;
    ctx.sheet = null;
    writeJars(free, `${labExtraJarTitle(jarId)} removed.`, ['#lab-add-jar:not(:disabled)', '#lab-do-h']);
  }
  // "Reset every jar": the procedure's contents in all nine, the extra jars gone (Your hands keep theirs).
  function resetJars() {
    const free = labFreeJars(lab);
    if (!free) return;
    const shelf = labShelf(lab);
    for (const stepId of Object.keys(free.jars)) free.jars[stepId] = labJarSolution(shelf, shelf.jars[stepId]);
    const gone = new Set(free.extra.map(x => x.id));
    free.extra = [];
    if (gone.has(ctx.freeStep)) ctx.freeStep = null;
    if (ctx.sheet && ctx.sheet.kind === 'jar' && gone.has(ctx.sheet.id)) ctx.sheet = null;
    writeJars(free, 'Every jar holds the procedure’s contents again; no extra jar is left.', [
      '#lab-add-jar',
      '#lab-do-h',
    ]);
  }
  const offRun = labEvents.on('run', changed => {
    if (!host.isConnected) {
      offRun();
      return;
    }
    if (changed && changed.id === ctx.runId && LAB.bench) {
      LAB.bench.setRun(labBenchRun(changed));
      labSyncSlideTint(lab, ctx);
    }
  });
  labHandles.add(offRun);

  // A refresh that throws (stale DOM, a damaged run) must leave a readable notice, not a frozen bench.
  // `reveal: false` focuses without scrolling the focused control into view (a step done on the stage).
  function refresh(focusSel, { reveal = true } = {}) {
    try {
      refreshNow(focusSel, { reveal });
    } catch (error) {
      console.error('lab bench refresh failed', error);
      host.replaceChildren(
        el(
          `<p class="course-notice" role="alert">The bench could not redraw (${esc(error && error.message ? error.message : error)}). Reload the page; your saved work is kept.</p>`
        )
      );
    }
  }
  function refreshNow(focusSel, { reveal: show = true } = {}) {
    // The 3D stage is moved, not rebuilt, into the new parts: while they are built it is out of the page,
    // and a layout then clamps the scroll position by its height. The redraw puts it back (UX-POLISH).
    const scrollTop = typeof window === 'undefined' ? 0 : window.scrollY;
    const keepScroll = () => {
      if (typeof window !== 'undefined' && window.scrollY !== scrollTop)
        window.scrollTo({ top: scrollTop, behavior: 'instant' });
    };
    ctx.openUi = labCaptureOpen(main);
    if (ctx.closeUi) {
      ctx.openUi.drawers = ctx.openUi.drawers.filter(key => !ctx.closeUi.includes(key));
      ctx.closeUi = null;
    }
    // Without an explicit target, the control that had focus keeps it across the redraw (CC-8).
    const keep = focusSel ? null : labFocusKey(main);
    // "Make the runs for me" (UX-POLISH): the sealed pair is made once the safety notes are
    // acknowledged (making it performs every step), and the view lands on its message.
    if (ctx.sealDraftId && LAB_STATE.safetyAcknowledgedAt) {
      const made = labMakeSealedPair(lab, ctx.sealDraftId);
      ctx.sealDraftId = null;
      if (made && made.refused) {
        // The planned change is not one the bench offers: nothing was made, and the bench says so
        // with the way back to step 2 (UX-LAST).
        Object.assign(ctx, { makeRefused: made.exp.id, revealSel: '#lab-make-refused' });
        focusSel = '#lab-make-refused';
      } else if (made) {
        Object.assign(ctx, {
          runId: made.experimental.id,
          sealedReady: made.exp.id,
          setupOpen: false,
          compareOpen: false,
          compared: false,
          pairBaseline: made.experimental.id,
          pairChange: null,
          scopeOpen: false,
          frame: 0,
          sheet: null,
          revealSel: '#lab-sealed-ready',
        });
        focusSel = '#lab-sealed-ready';
        try {
          history.replaceState(
            { sec: 'lab' },
            '',
            labUrl({ view: 'bench', run: made.experimental.id, exp: made.exp.id })
          );
        } catch {
          /* the URL is cosmetic here */
        }
      }
    }
    // Inline microscope handles belong to the previous render: drop them before anything new mounts.
    for (const handle of [...labHandles]) {
      if (handle && typeof handle.destroy === 'function' && handle !== LAB.bench) {
        labHandles.delete(handle);
        try {
          handle.destroy();
        } catch {
          /* already gone */
        }
      }
    }
    ctx.afterAttach = [];
    const current = run();
    const references = current ? labRunReferences(current.id) : [];
    ctx.locked = references.length > 0;
    const mode = labCurrentMode();
    main.dataset.mode = mode;
    ctx.mode = mode;
    if (!LAB_STATE.safetyAcknowledgedAt) {
      headHost.replaceChildren();
      ctx.runMenuOpen = false; // Review again (in the Run menu) leaves the menu closed for later
      // H7 (FIX4): "I understand, open the bench" lands on the bench's first part, its "1. Set up" heading
      // under the top bar (the safety notes the student scrolled through go above it); focus on the first
      // control there without a scroll of its own.
      const gate = labSafetyCard(lab, () => {
        ctx.revealSel = '#lab-mode-switch'; // §13.3: the bench's first piece, the mode switch above Your slide
        refresh(['#lab-do-step:not(:disabled)', '#lab-setup [name="specimen"]:checked'], { reveal: false });
      });
      // The requested intro plays above the gate (PLAN §3.1); everything that does a step waits for it.
      if (ctx.introGate && mode === '3d') host.replaceChildren(labBench3D(lab, current, ctx, { gated: true }), gate);
      else {
        host.replaceChildren(gate);
        if (LAB.bench) labDestroyBench();
      }
      keepScroll();
      labFocusFirst(main, [].concat(focusSel || []), { reveal: show }) ||
        labFocusFirst(main, [].concat(keep || []), { reveal: false });
      return;
    }
    ctx.introGate = false;
    headHost.replaceChildren(labBenchHead(lab, current, ctx));
    const frag = document.createDocumentFragment();
    frag.appendChild(labBenchModeSwitch(lab, current, ctx)); // §13.3: always there, at the top of the bench body
    if (ctx.locked)
      frag.appendChild(
        el(
          `<p class="course-notice lab-locked" role="status" id="lab-run-locked"><strong>This run is locked.</strong> It is cited by ${esc(references.join(', '))}, so its log cannot change. Start a new run, or compare with a copy, to keep experimenting.</p>`
        )
      );
    const refused = ctx.makeRefused && LAB_STATE.experiments[ctx.makeRefused];
    if (refused) frag.appendChild(labMakeRefusedNote(refused));
    frag.appendChild(labSetupSection(lab, current, ctx));
    if (mode !== '3d' && LAB.bench) labDestroyBench();
    frag.appendChild(labDoSection(lab, current, ctx, mode));
    frag.appendChild(labResultSection(lab, current, ctx, mode));
    frag.appendChild(labHistorySection(lab, current, ctx, mode));
    frag.appendChild(labSheetNode(lab, ctx));
    host.replaceChildren(frag);
    labSyncViewing(ctx);
    labRestoreOpen(main, ctx.openUi);
    // Microscope mounts and the thumbnail need a connected container (canvas sizing): after the swap.
    for (const mount of ctx.afterAttach.splice(0)) mount();
    labSheetModal(ctx);
    keepScroll();
    labFocusFirst(main, [].concat(focusSel || []), { reveal: show }) ||
      labFocusFirst(main, [].concat(keep || []), { reveal: false });
    // One part to bring to the top of the view, under the site's top bar (UX-POLISH): the stage after a
    // step in 3D, the sealed pair's message. The focused control stays in view whatever the height.
    const reveal = ctx.revealSel && main.querySelector(ctx.revealSel);
    const fit = ctx.revealFit;
    ctx.revealSel = null;
    ctx.revealFit = null;
    if (
      reveal &&
      typeof reveal.scrollIntoView === 'function' &&
      (!fit || labFitsView(reveal, main.querySelector(fit)))
    ) {
      reveal.scrollIntoView({ block: 'start', behavior: 'instant' });
      const active = document.activeElement;
      if (active && active !== reveal && main.contains(active)) labEnsureVisible(active);
    }
    labNotesFloatSync(); // the header (and its Notes button) was drawn again
    labSyncSlideTint(lab, ctx); // §11.4: the drawn slide follows the run's by-eye look
    labSyncJars(); // §13.4: the tray at S9 and the jars' tags follow the jars and the run's mode
  }
  refresh(ctx.sealedReady ? '#lab-sealed-ready' : undefined);
}
// A selector that finds the focused control again after a redraw (its id, or its stable data hook).
function labFocusKey(root) {
  const active = typeof document === 'undefined' ? null : document.activeElement;
  if (!active || active === document.body || !root.contains(active)) return null;
  if (active.id && /^[\w-]+$/.test(active.id)) return `#${active.id}`;
  for (const attr of [
    'data-lab-mode',
    'data-lab-station',
    'data-lab-specimen',
    'data-lab-change-value',
    'data-lab-bench-mode',
    'data-lab-benchmode',
  ]) {
    const value = active.getAttribute(attr);
    if (value && /^[\w.-]+$/.test(value)) return `[${attr}="${value}"]`;
  }
  const drawer = active.matches('.lab-drawer-btn') && active.closest('[data-lab-drawer]');
  if (drawer && /^[\w:.-]+$/.test(drawer.dataset.labDrawer))
    return `[data-lab-drawer="${drawer.dataset.labDrawer}"] > .lab-drawer-btn`;
  return null;
}
// Focuses the first usable target (connected, enabled, not inside a hidden part) without the browser's
// own jump, then brings it clear of the top bar and the viewport edge (A11Y-12: the ring stays seen).
// A control that only keeps its focus across a redraw is left where the student scrolled (`reveal`).
function labFocusFirst(root, selectors, { reveal = true } = {}) {
  for (const sel of selectors) {
    const target = root.querySelector(sel);
    if (target && target.focus && !target.disabled && !target.closest('[hidden]'))
      return labFocusUncovered(root, target, { reveal });
  }
  return null;
}
// H7 (FIX4): focus never lands on a control the open notes drawer covers (a phone's stuck "Do this step"
// is always under it): the steps heading ("2. Do the steps") takes it, brought into the free band when it
// is out of it (between the top bar and the drawer, never under either). After a step done by a pointer on
// the stage or the list (`reveal` false), a focus the student left in the drawer (typing notes) stays there.
function labFocusUncovered(root, target, { reveal = true } = {}) {
  if (labDrawerCovers(target)) {
    const active = typeof document === 'undefined' ? null : document.activeElement;
    if (!reveal && active && active.closest && active.closest('#lab-notepad')) return active;
    const heading = (root && root.querySelector && root.querySelector('#lab-do-h')) || null;
    if (heading && heading !== target && !heading.closest('[hidden]')) {
      heading.focus({ preventScroll: true });
      if (!labInFreeBand(heading)) labRevealInBand(heading);
      return heading;
    }
  }
  target.focus({ preventScroll: true });
  if (reveal) labEnsureVisible(target);
  return target;
}
// The camera follows the work on the 3D bench, but never during the intro or the dive (a station
// flight would end the clip; 3D-5). The rack sits at the station of the step just done; when the next
// step's jar is at another station the camera frames both (E1, FIX2: frameStations, whose last station
// is the select's), so the rack can be dragged onto the next jar; an older bench without it flies to
// the rack's station as before.
// The station a jar stands at: its step's, or "Your jars" (S9) for an extra jar (§13.4).
function labJarStation(lab, id) {
  if (!id) return null;
  const stations = lab.listStations();
  return labIsExtraJar(id)
    ? stations.find(s => s.id === LAB_JARS_STATION) || null
    : stations.find(s => Array.isArray(s.steps) && s.steps.includes(id)) || null;
}
function labFollowStation(lab, ctx, stepId, nextId = null) {
  if (!LAB.bench || typeof LAB.bench.goToStation !== 'function') return;
  const state = labClipState();
  if (state && state.phase !== 'bench') return;
  const stationOf = id => labJarStation(lab, id);
  const rack = stationOf(stepId);
  if (!rack) return;
  const next = stationOf(nextId);
  const frame = !!next && next.id !== rack.id && typeof LAB.bench.frameStations === 'function';
  ctx.station = frame ? next.id : rack.id;
  try {
    if (frame) LAB.bench.frameStations([rack.id, next.id]);
    else LAB.bench.goToStation(rack.id);
  } catch {
    /* the camera is cosmetic here */
  }
  labHudSoon(ctx); // p5-5 (FIX5): every framing decision re-reads the HUD
}

// G3 / G9 (FIX3): the camera's place for the bench's run as it stands, the view a step leaves: a finished
// run at the microscope (S6); otherwise the rack's station (the last step done; S1 before any) framed with
// the next step's jar when that stands elsewhere (frameStations). Used when the 3D bench mounts (Switch to
// 3D, a reload, Back from the microscope: asked before the bench's first frame, the flight is a cut, so
// the bench opens on that view) and when a new run starts in 3D, where the camera may already rest there.
// Either way the station picker names where the camera is, as the sign's "you are here" does. Never
// while a clip holds the camera or the intro is about to play.
function labFrameRun(lab, ctx) {
  const bench = LAB.bench;
  if (!bench || typeof bench.goToStation !== 'function' || ctx.clip.introQueued) return;
  const clip = labClipState();
  if (clip && clip.phase !== 'bench') return;
  const run = ctx.runId ? LAB_STATE.runs[ctx.runId] || null : null;
  const p = run ? labStepProgress(lab, run) : null;
  const stationOf = id => labJarStation(lab, id);
  const last = run ? [...run.events].reverse().find(e => !!labEventJar(e)) : null;
  // §13.4: an extra jar that was removed since its dip has no tray to stand at: the rack starts at S1.
  const lastJar = last ? labEventJar(last) : null;
  const gone = labIsExtraJar(lastJar) && !labExtraJarsForBench(lab, ctx).some(j => j.id === lastJar);
  const rack = (lastJar && !gone && stationOf(lastJar)) || { id: 'S1' };
  // §11.1: a free run has nothing next: the rack's station alone (sealed: the microscope).
  const free = labIsFree(run);
  const next = p && p.next && !free ? stationOf(p.next.id) : null;
  const ids =
    (p && p.total && !p.next) || (free && labSlideSealed(run))
      ? [LAB_FINISHED_STATION]
      : next && next.id !== rack.id
        ? [rack.id, next.id]
        : [rack.id];
  const pair = ids.length > 1 && typeof bench.frameStations === 'function';
  // Named before the flight: the bench reports the station it really framed (api.onStation; H6, FIX4: a far
  // pair is framed at the rack's station alone), and that report wins.
  ctx.station = pair ? ids[1] : ids[0];
  try {
    if (pair) bench.frameStations(ids);
    else bench.goToStation(ids[0]);
  } catch {
    /* the camera is cosmetic here */
  }
  labUpdateStation(lab, ctx);
  labHudSoon(ctx); // p5-5 (FIX5): every framing decision re-reads the HUD
}

// §13.4: the bench re-reads api.extraJars / api.jarLabel (its "Your jars" tray, a showing tag) after every
// redraw: a jar edited, added or removed, a new slide in the other mode. A bench without it keeps its jars.
function labSyncJars() {
  const bench = LAB.bench;
  if (!bench || typeof bench.refreshJars !== 'function') return;
  try {
    bench.refreshJars();
  } catch {
    /* the tray is cosmetic here */
  }
}
// §13.4 the bench's view of the free bench's jars (api.extraJars / api.jarLabel).
function labExtraJarsForBench(lab, ctx) {
  const run = ctx && ctx.runId ? LAB_STATE.runs[ctx.runId] || null : null;
  if (!labIsFree(run) || labIsSealed(run.id)) return [];
  return labJars(lab, run)
    .filter(j => j.extra)
    .map(j => ({ id: j.id, label: j.text, title: j.title }));
}
function labJarLabel(lab, ctx, id) {
  const run = ctx && ctx.runId ? LAB_STATE.runs[ctx.runId] || null : null;
  if (!labIsFree(run)) return null;
  const jar = labJarById(lab, run, labJarIdOf(id));
  return jar && (jar.extra || jar.changed) && jar.text ? jar.text : null;
}

/* ---------- 3D mode: persistent stage + DOM overlay (contract §4 lab-3d, 3D-1, PLAN §4) ---------- */
function labDestroyBench() {
  labBenchGeneration++;
  clearInterval(labClipSettleTimer);
  labClipSettleTimer = null;
  if (typeof document !== 'undefined')
    document.querySelector('main.lab-rack-dragging')?.classList.remove('lab-rack-dragging');
  const bench = LAB.bench;
  LAB.bench = null;
  if (bench) {
    try {
      bench.destroy();
    } catch {
      /* already gone */
    }
  }
}
// "2. Do the steps" in 3D: the stage full width, the clip block (caption, controls, transcript and
// label, shown only while the intro or the dive plays), then the shared controls and one row of
// secondary controls (Go to station, Play the intro, Reduce motion). `run` may be null: the clip has a
// built-in default run (SHELL-8). `gated`: the home intro before the safety notes are acknowledged
// (PLAN §3.1, CC-7): an "Intro" part with the stage and the clip block only; no step can be done.
function labBench3D(lab, run, ctx, { gated = false } = {}) {
  if (!ctx.stage) {
    ctx.stage = el(
      '<div class="lab-stage" id="lab-bench-3d" data-lab-bench-stage><p class="lab-stage-status" data-lab-bench-status role="status">Loading the 3D bench…</p></div>'
    );
  }
  // The caption line (aria-live) and the transcript persist like the stage: a refresh re-attaches
  // the same nodes, so a step performed mid-dive does not replace the node that announces captions.
  if (!ctx.caption) ctx.caption = el('<p class="lab-clip-caption" id="lab-clip-caption" aria-live="polite"></p>');
  if (!ctx.transcript) ctx.transcript = labClipTranscript(lab);
  // The bench's transient hints (api.onHint, e.g. how to zoom), shown over the stage's lower edge.
  if (!ctx.hint) ctx.hint = el('<p class="lab-stage-hint" id="lab-stage-hint" role="status"></p>');
  const clip = labClip(lab);
  const head = gated ? { id: 'lab-intro-h', text: 'Intro' } : { id: 'lab-do-h', text: labDoHeading(run) };
  const section =
    el(`<section class="lab-part lab-do lab-bench-3d${gated ? ' lab-intro-gated' : ''}" id="${gated ? 'lab-intro' : 'lab-do'}" aria-labelledby="${head.id}" data-lab-clip-phase="${esc(ctx.clip.phase)}">
    <h2 id="${head.id}" tabindex="-1">${head.text}</h2>
    <div class="lab-clip-layout" data-lab-clip-card="closed">
      <div class="lab-clip-stage-wrap" id="lab-clip-stage" tabindex="-1" role="group" aria-label="Tissue clip stage" aria-describedby="lab-clip-keys"><div class="lab-stage-box"><div data-lab-slot="stage"></div></div></div>
      <aside class="lab-clip-card" id="lab-clip-card" aria-labelledby="lab-clip-card-h" hidden></aside>
    </div>
    <div class="lab-clip-block">
      <div data-lab-slot="caption"></div>
      ${labClipNoRun(ctx) ? `<p class="lab-dim lab-clip-note" id="lab-clip-note" hidden>${esc(labClipNoRunText(lab))}</p>` : ''}
      ${labClipControlsHtml()}
      <p class="lab-clip-ended" id="lab-clip-ended" hidden></p>
      <div data-lab-slot="transcript"></div>
      ${labClipBanner(clip)}
    </div>
    <p class="lab-sr-only" id="lab-clip-keys">${esc(LAB_CLIP_KEYS)}</p>
    ${gated ? '' : '<div data-lab-slot="controls"></div>'}
    <div data-lab-slot="extras"></div>
  </section>`);
  section.querySelector('[data-lab-slot="stage"]').replaceWith(ctx.stage);
  ctx.stage.after(ctx.hint); // beside the stage, not in it: the bench replaces the stage's children
  // The HUD (GAME-shell): what the bench's objects do, a row under the stage that never covers the
  // scene (labHudSync); the stage box keeps the hint over the stage's lower edge.
  if (!ctx.hud) ctx.hud = el('<div class="lab-hud" data-lab-hud="" aria-hidden="true" hidden></div>');
  // MODE-FIX-shell-16: after the clip layout (the stage's group #lab-clip-stage and its card), not inside
  // the group, so its name and its clip keys never describe the station row; the row keeps its 8 px under
  // the stage (outside the layout's grid gap).
  section.querySelector('.lab-clip-layout').after(ctx.hud);
  // §11.2: the station row directly under the stage, above the HUD; shown with the HUD (labStationsSync).
  ctx.stationsNav = gated ? null : labStationRow(lab, ctx);
  if (ctx.stationsNav) section.querySelector('.lab-clip-layout').after(ctx.stationsNav);
  // I2 (FIX5): the way back to the follow view after a turn or a zoom, over the stage's corner (labRecenterSync).
  if (!ctx.recenter) {
    ctx.recenter = el(
      '<button type="button" class="lab-recenter" id="lab-recenter" hidden>Back to my station</button>'
    );
    ctx.recenter.addEventListener('click', () => labRecenter(ctx));
  }
  ctx.hint.after(ctx.recenter);
  // Full view (Kevin, 2026-10-14: "the window is too small"): the 3D part fills the browser window, the
  // stage as tall as it fits with the station row, the hints and the controls under it; Escape or the
  // button gives the page back. The bench resizes itself (ResizeObserver), so only the layout changes.
  if (!ctx.expand) {
    ctx.expand = el(
      '<button type="button" class="lab-stage-expand" id="lab-stage-expand" aria-pressed="false"><span class="lab-stage-expand-icon" aria-hidden="true"></span><span class="lab-stage-expand-text">Full view</span></button>'
    );
    ctx.expand.addEventListener('click', () => labStageFull(ctx, !ctx.stageFull));
  }
  ctx.recenter.after(ctx.expand);
  section.classList.toggle('lab-stage-full', !!ctx.stageFull);
  labStageFullSync(ctx);
  ctx.hudGated = gated;
  section.querySelector('[data-lab-slot="extras"]').replaceWith(labStageExtras(lab, ctx, { gated }));
  section.querySelector('#lab-clip-stage').addEventListener('keydown', event => labClipKeys(lab, ctx, event));
  // I3 (FIX5): where on the stage the last press was (0 left .. 1 right): the structure card opens on the other
  // side. Escape in the card closes it (and only it).
  section.querySelector('#lab-clip-stage').addEventListener('pointerdown', event => {
    const r = event.currentTarget.getBoundingClientRect();
    if (r.width > 0) ctx.clip.pressX = (event.clientX - r.left) / r.width;
  });
  section.querySelector('#lab-clip-card').addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !ctx.clip.inspected) return;
    event.preventDefault();
    event.stopPropagation();
    labClipCardClose(lab, ctx);
  });
  section.querySelector('[data-lab-slot="caption"]').replaceWith(ctx.caption);
  section.querySelector('[data-lab-slot="transcript"]').replaceWith(ctx.transcript);
  labClipBindControls(lab, ctx, section);
  labUpdateStructure(lab, ctx, section);
  labClipSync(ctx, section); // also syncs the HUD (labHudSync)
  if (!LAB.bench && !ctx.mounting) {
    ctx.clip = labClipCtx(ctx.clip.introQueued); // a fresh mount starts at the bench phase
    labClipPaint(ctx);
    labStartBench(lab, ctx);
  } else if (LAB.bench) LAB.bench.setRun(labBenchRun(run), { animate: false });
  return section;
}
function labStageFullSync(ctx) {
  if (!ctx.expand) return;
  const on = !!ctx.stageFull;
  ctx.expand.setAttribute('aria-pressed', String(on));
  ctx.expand.querySelector('.lab-stage-expand-text').textContent = on ? 'Exit full view' : 'Full view';
  ctx.expand.title = on ? 'Back to the page (Esc)' : 'Fill the window with the 3D bench';
}
function labStageFull(ctx, on) {
  ctx.stageFull = !!on;
  const section = ctx.expand && ctx.expand.closest('section.lab-bench-3d');
  if (section) section.classList.toggle('lab-stage-full', ctx.stageFull);
  labStageFullSync(ctx);
  if (!ctx.stageFullKeys) {
    ctx.stageFullKeys = event => {
      if (event.key !== 'Escape' || !ctx.stageFull || event.defaultPrevented) return;
      // Escape inside a sheet, the notepad or a structure card belongs to them.
      if (event.target && event.target.closest && event.target.closest('#lab-sheet, #lab-notepad, #lab-clip-card'))
        return;
      labStageFull(ctx, false);
    };
    document.addEventListener('keydown', ctx.stageFullKeys);
    labHandles.add(() => document.removeEventListener('keydown', ctx.stageFullKeys));
  }
  if (section) section.scrollTop = 0;
  labAnnounce(
    ctx.stageFull ? 'Full view: the 3D bench fills the window. Escape returns to the page.' : 'Back to the page.'
  );
  ctx.expand?.focus({ preventScroll: true });
}
async function labStartBench(lab, ctx) {
  const token = ++labBenchGeneration;
  ctx.mounting = true;
  const status = () => ctx.stage.querySelector('[data-lab-bench-status]');
  const fallback = message => {
    ctx.mounting = false;
    labModeOverride = null;
    LAB_STATE.mode = 'list';
    LAB_STATE.modeChosen = true; // the 3D bench failed to start here: keep list on the next visit
    labSave();
    labEvents.emit('mode', 'list');
    labAnnounce(message);
    const note = status();
    if (note) note.textContent = message;
    ctx.stage = null;
    ctx.refresh(['#lab-mode-toggle', '#lab-run-menu-btn', '#lab-do-h']);
    const live = document.querySelector('#lab-bench-body');
    if (live)
      live.insertAdjacentElement('afterbegin', el(`<p class="course-notice" role="status">${esc(message)}</p>`));
  };
  const reason = lab3dBlockedReason();
  // Before the safety notes only the requested intro may mount the bench (its steps stay gated).
  if (reason || (!LAB_STATE.safetyAcknowledgedAt && !ctx.introGate))
    return fallback(reason || 'Acknowledge the safety notes before opening the 3D bench.');
  let mod;
  try {
    // Always awaited, so the continuation runs after the stage is attached (an injected module too).
    mod = await (LAB.benchModule ? Promise.resolve(LAB.benchModule) : import('/lab-3d/bench.js?v=2'));
  } catch (error) {
    if (token !== labBenchGeneration) return;
    return fallback(
      `The 3D bench could not load (${error && error.message ? error.message : error}). List mode has the same steps.`
    );
  }
  if (token !== labBenchGeneration || !ctx.stage || !ctx.stage.isConnected) {
    ctx.mounting = false;
    return;
  }
  const api = {
    lab,
    // A sealed run reaches the bench without its state (an untinted slide; UX-POLISH).
    getRun: () => labBenchRun(ctx.runId ? LAB_STATE.runs[ctx.runId] || null : null),
    // The specimen the tissue is built for: the bench run's, else the transient run's (the active
    // specimen), so the director never builds the tissue for a null specimen; getRun() stays null.
    getSpecimen: () => {
      const run = labClipRunFor(lab, ctx);
      return run ? lab.getSpecimen(run.specimenId) || null : null;
    },
    onEvent: event => {
      if (!labIsObj(event)) return;
      // §13.4: a double click or a rack drop on an extra jar of the tray ({ type: 'jar', jarId }) dips the
      // slide in it, as a procedure jar's { type: 'step' } does (on the free bench both are dips).
      const jarEvent = event.type === 'step' || event.type === 'jar';
      // A double click cancels the step sheet its first click asked for (labStartBench's onInspect), also
      // when it can do nothing: the stage then says why where the student acted (G9, D5: no order).
      if (jarEvent) labCancelJarSheet(ctx);
      // H8 (FIX4): both say why on the stage too, quietly (the live region already says it), with no order.
      if (!LAB_STATE.safetyAcknowledgedAt) {
        labAnnounce('Steps wait for the safety notes; nothing was recorded.');
        if (jarEvent) labStageHint(ctx, `${LAB_DROP_HINTS.safety}.`, { quiet: true });
        return;
      }
      if (!ctx.runId) {
        labAnnounce(`${LAB_DROP_HINTS.noRun}. The clip’s built-in default run is not saved.`);
        if (jarEvent) labStageHint(ctx, `${LAB_DROP_HINTS.noRun}.`, { quiet: true });
        return;
      }
      if (event.type === 'jar') {
        if (labRunLocked(ctx.runId)) return labAnnounce('This run is locked; no new event was recorded.');
        return typeof event.jarId === 'string'
          ? ctx.doStep(event.jarId, '#lab-clip-stage', { fromStage: true })
          : undefined;
      }
      const current = LAB_STATE.runs[ctx.runId];
      const progress = current ? labStepProgress(lab, current) : null;
      const free = labIsFree(current);
      // A jar whose step the run's settings skip is never done (ENGINE-14, practice): its sheet says so.
      if (event.type === 'step' && !free && progress && progress.skipped.has(event.step)) {
        labAnnounce(`${LAB_SKIPPED_SHEET}: ${labStepTitleById(event.step)}.`);
        labOpenSheet(lab, ctx, { kind: 'step', id: event.step, follow: false, opener: null });
        return;
      }
      // A finished practice run is never changed from the bench: the jar shows its step's sheet with
      // where the next run starts (UX-POLISH, §11.1).
      if (event.type === 'step' && !free && progress && progress.total && !progress.next) {
        labAnnounce(labFinishedTip(ctx));
        if (event.step && labStepById(lab, event.step))
          labOpenSheet(lab, ctx, { kind: 'step', id: event.step, follow: false, opener: null });
        return;
      }
      if (labRunLocked(ctx.runId)) {
        labAnnounce('This run is locked; no new event was recorded.');
        return;
      }
      // A double click on a jar (or a slide dropped on it) does that step through the same path as the
      // buttons; the page stays where it is, so the jars stay under the pointer, and focus stays on the stage
      // (MODE-FIX-shell-18: never parked on a button below the fold).
      if (event.type === 'step' && event.step) return ctx.doStep(event.step, '#lab-clip-stage', { fromStage: true });
      labApplyEvent(ctx.runId, event); // allocates seq, saves, emits 'run'
      labAnnounce('Recorded in the run log.');
      ctx.refresh('#lab-do-h');
    },
    onInspect: what => {
      // §13.4: an extra jar of the tray arrives as { kind: 'jar', id } (its sheet, after the same wait as a
      // jar's); a procedure jar named that way is its step's jar.
      const asJar = labIsObj(what) && what.kind === 'jar' ? labJarIdOf(what.id) : null;
      const id = asJar || what;
      if (asJar && labIsExtraJar(asJar)) {
        if (!LAB_STATE.safetyAcknowledgedAt) return;
        labCancelJarSheet(ctx);
        ctx.jarTimer = setTimeout(() => {
          ctx.jarTimer = null;
          if (ctx.stage && ctx.stage.isConnected)
            labOpenSheet(lab, ctx, { kind: 'jar', id: asJar, follow: false, opener: null, from: 'stage' });
        }, LAB_JAR_SHEET_DELAY_MS);
        return;
      }
      // One callback for both worlds: a tissue site (or 'soma') opens the structure card, a jar opens
      // the step's side sheet and any other bench object its own sheet (not before the safety notes).
      if (labClipIsSite(id)) {
        ctx.clip.inspected = id;
        labUpdateStructure(lab, ctx);
        return;
      }
      if (!LAB_STATE.safetyAcknowledgedAt) return;
      const kind = labStepById(lab, id) ? 'step' : 'object';
      if (kind === 'object' && !LAB_ACTION_OBJECTS.has(id))
        return labOpenSheet(lab, ctx, { kind, id, follow: false, opener: null, from: 'stage' });
      // A jar's sheet waits a moment: the second click of a double click (do the step) cancels it, so the
      // sheet never opens over the jar between the two clicks (UX-POLISH). The microscope's and the
      // brain tray's wait the same way for their double click (onAction).
      labCancelJarSheet(ctx);
      ctx.jarTimer = setTimeout(() => {
        ctx.jarTimer = null;
        if (ctx.stage && ctx.stage.isConnected)
          labOpenSheet(lab, ctx, { kind, id, follow: false, opener: null, from: 'stage' });
      }, LAB_JAR_SHEET_DELAY_MS);
    },
    // D2 (contract §10): a click says what an object is (its sheet), a double click does it. The bench
    // sends a double click on the microscope or the brain tray here: the tray plays the intro; the
    // microscope opens the bench run's picture when there is one (api.canLook), else its sheet says
    // why not (in view, and announced).
    onAction: id => {
      if (!LAB_ACTION_OBJECTS.has(id)) return;
      labCancelJarSheet(ctx);
      const sheet = () => {
        if (LAB_STATE.safetyAcknowledgedAt) labOpenSheet(lab, ctx, { kind: 'object', id, follow: false, opener: null });
      };
      if (id === 'specimen') {
        if (!labClipSupported()) return sheet(); // its sheet says the clip is missing
        if (ctx.clip.phase === 'bench') labClipStart(lab, ctx, 'intro');
        return;
      }
      const reason = labLookReason(lab, ctx);
      if (!reason) return labOpenMicroscope({ runIds: [ctx.runId] });
      labAnnounce(reason);
      sheet();
    },
    canLook: () => labCanLook(lab, ctx),
    // p5-5 (FIX5): the bench's own report of the station it framed (H6) is a framing decision too: the HUD
    // re-reads the signs on screen (no stale sign chip).
    onStation: id => {
      ctx.station = id;
      labEvents.emit('station', id);
      labUpdateStation(lab, ctx);
      labHudSoon(ctx);
    },
    // G1 (FIX3): a camera flight ended, OrbitControls ended a change or the canvas resized: the HUD
    // re-reads whether the rack is on screen (debounced); I2 (FIX5): and whether the camera is away.
    onViewChange: () => labHudSoon(ctx),
    // G8 (FIX3): px of the site's fixed / sticky top bar over the viewport's top (0 if none), so the
    // bench keeps its tags in the part of the canvas the student can see.
    topInset: () => labTopInset(),
    // H10 (FIX4): { top, bottom }: the top bar as topInset, and an open notes drawer's height on screen
    // (narrow screens; 0 when closed), so framing and tags keep to the part between them.
    viewportInsets: () => labViewportInsets(),
    // H10 (FIX4): the bench says when a rack drag starts and ends; while it is on, an open notes drawer
    // shrinks to its bar (as for the list's slide), so the jars under it can take the drop.
    onDragState: active => labRackDragState(ctx, active === true),
    // Tissue clip (contract §7.1): captions and ends come back through the shell; the stain phases
    // of the dive read the run's own frames, or the built-in default run's when there is no run.
    clip: labClip(lab),
    onScene: (sceneId, caption, index) => labClipScene(lab, ctx, sceneId, caption, index),
    onEnd: which => labClipEnd(lab, ctx, which),
    getFrames: () => {
      const run = labClipRunFor(lab, ctx);
      return run && !labIsSealed(run.id) ? lab.replay(run) : [];
    },
    getOutcome: () => {
      const run = labClipRunFor(lab, ctx);
      return run && !labIsSealed(run.id) ? lab.resolve(run) : null;
    },
    // A short hint from the bench ("Hold Ctrl (⌘ on Mac) and scroll to zoom" after a plain wheel over
    // the stage, RC-2) shown over the stage until onHint('') takes it away. A bench build without
    // hints never calls it. I7 (FIX5): a verb line, so Show hints off keeps it away.
    onHint: hint => labStageHint(ctx, labHintsOn() ? (typeof hint === 'string' ? hint : hint && hint.text) : ''),
    // GAME-shell (contract §10): a jar's place in the run ('next' | 'todo' | 'done' | 'skipped' | null),
    // why a slide dropped on it would do nothing ('' when it would do the step; the drop then sends
    // onEvent({ type: 'step', step }) like a double click), and whether hint verbs show.
    stepState: stepId => labStepState(lab, ctx, stepId),
    // MODE-bench3d-2 (§11.1): how many times the bench's run did a step (a free run may do one again and
    // again): the tag reads "done ×N".
    stepCount: stepId => labStepCount(ctx.runId ? LAB_STATE.runs[ctx.runId] || null : null, stepId),
    dropHint: stepId => labDropHint(lab, ctx, stepId),
    // §13.4: the free bench's extra jars for the "Your jars" tray at S9 ([{ id: 'x1'…'x4', label, title }];
    // [] off the free bench, so no tray is drawn), and a jar's contents for its tag ("First silver bath · 10%
    // silver nitrate · …"): an extra jar's always, a procedure jar's only while it differs from the
    // procedure; null otherwise (practice, no run, an unchanged jar).
    extraJars: () => labExtraJarsForBench(lab, ctx),
    jarLabel: id => labJarLabel(lab, ctx, id),
    // Before the safety notes the bench only plays the intro: a jar or object click does nothing yet, so
    // the 3D tags drop their verbs until the notes are acknowledged (GAME-FIX-shell, honest tags).
    hintsOn: () => labHintsOn() && !!LAB_STATE.safetyAcknowledgedAt,
    prefersReducedMotion: labPrefersReducedMotion(),
    mode: window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'desktop',
    debug: false,
  };
  let handle;
  try {
    handle = await mod.mountBench(ctx.stage, api);
  } catch (error) {
    handle = { ok: false, reason: 'error', message: error && error.message ? error.message : String(error) };
  }
  if (token !== labBenchGeneration) {
    if (handle && handle.ok) {
      try {
        handle.destroy();
      } catch {
        /* already gone */
      }
    }
    ctx.mounting = false;
    return;
  }
  ctx.mounting = false;
  if (!handle || !handle.ok)
    return fallback(`${(handle && handle.message) || 'The 3D bench could not start.'} Switched to list mode.`);
  LAB.bench = handle;
  if (handle.element) handle.element.setAttribute('aria-hidden', 'true');
  ctx.stage.classList.add('lab-stage-live');
  labAnnounce('3D bench ready.');
  // The 3D button that started the mount gets focus back; any other mount (a page load in 3D, the
  // gate, the intro) leaves focus where it is (CC-8, A11Y-07).
  const focus = ctx.mountFocus;
  ctx.mountFocus = null;
  ctx.refresh(focus);
  labSyncSlideTint(lab, ctx); // §11.4: the drawn slide follows the run's by-eye look from the first frame
  labFrameRun(lab, ctx); // G3: the bench opens on the view a step leaves
  labClipAutoIntro(lab, ctx);
}
// The stage hint (api.onHint): one short line over the stage, in a status region. The bench shows it
// with onHint(text) and takes it away with onHint('') (bench.js: once the wheel has been still); a
// fallback timer hides it if no '' ever comes. The same hint again only keeps it up (no second
// announcement); the text clears after it fades, so the next hint is announced again.
const LAB_STAGE_HINT_MS = 6000;
// A jar's click opens its step sheet after this delay unless a double click (the step) comes first;
// so do the microscope's and the brain tray's (their double click: api.onAction).
const LAB_JAR_SHEET_DELAY_MS = 300;
const LAB_ACTION_OBJECTS = new Set(['microscope', 'specimen']);
// Where the camera goes when a run's last step is done: the microscope station (UX-LAST).
const LAB_FINISHED_STATION = 'S6';
function labCancelJarSheet(ctx) {
  clearTimeout(ctx.jarTimer);
  ctx.jarTimer = null;
}
// `quiet`: shown, not announced (aria-hidden while it shows), for words the live region already says.
function labStageHint(ctx, text, { quiet = false } = {}) {
  const node = ctx.hint;
  if (!node) return;
  const words = String(text || '').trim();
  clearTimeout(ctx.hintTimer);
  const hide = () => {
    node.classList.remove('lab-stage-hint-on');
    ctx.hintTimer = setTimeout(() => {
      node.textContent = '';
    }, 300);
  };
  if (!words) return hide();
  if (quiet) node.setAttribute('aria-hidden', 'true');
  else node.removeAttribute('aria-hidden');
  if (node.textContent !== words) node.textContent = words;
  node.classList.add('lab-stage-hint-on');
  ctx.hintTimer = setTimeout(hide, LAB_STAGE_HINT_MS);
}
// The 3D HUD (GAME-shell, contract §10): a row of hints under the stage (never over the scene) that
// say what the bench's objects do, aria-hidden (the tip under the stage and the controls say the
// same), for the bench phase only: hidden before the safety notes (the gated intro), while the intro
// or the dive plays, and inside the tissue, where Explore has its own chip. The chips state the bench's
// rules, never an object that may be off screen (E3, FIX2): a click (tap) says what anything is, a double
// click does it (D2), a station sign flies there; the rack's drag only while a drop would do the run's
// next step (D3) and the rack is on the canvas (G1, FIX3: the bench's rackOnScreen(); the HUD re-reads it
// when the view changes, api.onViewChange).
function labHudChips(lab, ctx, phase) {
  const touch = labTouch();
  if (phase === 'explore') return [['explore', `${touch ? 'Tap' : 'Click'} a structure`, 'what it is']];
  return [
    ['turn', touch ? 'Drag sideways' : 'Drag', 'turn the bench'], // a vertical drag scrolls the page on touch
    ['zoom', touch ? 'Pinch' : 'Ctrl/⌘ + scroll', 'zoom'],
    ['click', touch ? 'Tap anything' : 'Click anything', 'what it is'],
    ['double', touch ? 'Double-tap' : 'Double-click', 'do it'],
    labCanDip(lab, ctx) && labRackOnScreen() && ['drop', 'Drag the rack onto a jar', 'dip'],
    labOtherSignOnScreen(ctx) && ['sign', touch ? 'Tap a sign' : 'Click a sign', 'go to that station'],
  ].filter(Boolean);
}
// r3-left-shell-9 (FIX4): the sign chip promises a flight, so it shows only while the canvas shows a sign
// other than the current station's ("you are here", which goes nowhere): the bench's visibleSigns() (the
// stations whose sign is drawn now). A bench without it cannot say: the chip shows as before.
function labOtherSignOnScreen(ctx) {
  const bench = LAB.bench;
  if (!bench || typeof bench.visibleSigns !== 'function') return true;
  try {
    const ids = bench.visibleSigns();
    return Array.isArray(ids) && ids.some(id => id !== ctx.station);
  } catch {
    return false;
  }
}
// Whether the rack is on the canvas now (G1). A bench without rackOnScreen() cannot say, so the drag chip
// that names the rack stays off (E3: never an object that may be off screen).
function labRackOnScreen() {
  const bench = LAB.bench;
  if (!bench || typeof bench.rackOnScreen !== 'function') return false;
  try {
    return bench.rackOnScreen() === true;
  } catch {
    return false;
  }
}
// H10 (FIX4): a rack drag in 3D marks the page like the list's slide drag (main.lab-rack-dragging): lab.css
// shrinks an open notes drawer to its bar and steps the floating Notes button aside until it ends.
// I5 (FIX5): when it ends an open drawer stays slim (its bar) until the student opens it again, so the stage
// that just reacted stays in view (the drop's step event comes after this).
function labRackDragState(ctx, active) {
  const main = ctx.stage && ctx.stage.closest ? ctx.stage.closest('main') : null;
  if (!main || main.classList.contains('lab-rack-dragging') === active) return;
  main.classList.toggle('lab-rack-dragging', active);
  if (!active) labNotesSlim(true);
  else labNotesFloatSync();
}
// G1: the bench reports a view change (a flight landed, an orbit ended, the canvas resized); the HUD
// re-reads what is on screen once the changes settle (one sync for a burst of reports).
const LAB_HUD_SETTLE_MS = 80;
function labHudSoon(ctx) {
  clearTimeout(ctx.hudTimer);
  ctx.hudTimer = setTimeout(() => {
    ctx.hudTimer = null;
    if (ctx.hud && ctx.hud.isConnected) labHudSync(ctx);
  }, LAB_HUD_SETTLE_MS);
}
function labHudSync(ctx) {
  const hud = ctx.hud;
  if (!hud) return;
  const phase = ctx.clip.phase;
  const mode =
    !LAB.bench || !LAB.lab || ctx.hudGated || !LAB_STATE.safetyAcknowledgedAt
      ? ''
      : phase === 'bench' || phase === 'explore'
        ? phase
        : '';
  const html = mode
    ? labHudChips(LAB.lab, ctx, mode)
        .map(([key, verb, what]) => labHint(verb, what, { attrs: ` data-lab-hud-hint="${key}"` }))
        .join(' ')
    : '';
  // labClipSettle re-syncs every 250 ms after a clip call: write only what changed.
  let changed = false;
  if (ctx.hudHtml !== html) {
    hud.innerHTML = html;
    ctx.hudHtml = html;
    changed = true;
  }
  if (hud.dataset.labHud !== mode) hud.dataset.labHud = mode;
  if (hud.hidden !== !html) {
    hud.hidden = !html;
    changed = true;
  }
  if (labRecenterSync(ctx)) changed = true;
  if (labStationsSync(ctx)) changed = true; // §11.2: the station row shows with the HUD, in the bench phase
  // I5 (FIX5): the HUD's height moves what is under it (Do this step at 320 px): the floating Notes button
  // is placed afresh.
  if (changed) labNotesFloatSync();
}
// I2 (FIX5): "Back to my station" (button#lab-recenter, over the stage's bottom-right corner) shows while the
// student has turned or zoomed the camera away from the view the shell last asked for (the bench's
// isAway(), re-read on api.onViewChange), in the bench phase only; a press flies back (the bench's
// recenter()) and hides it. A bench without both functions never shows it. Returns whether it changed.
function labRecenterSync(ctx) {
  const button = ctx.recenter;
  if (!button) return false;
  const bench = LAB.bench;
  let away = false;
  if (bench && typeof bench.isAway === 'function' && typeof bench.recenter === 'function' && ctx.clip.phase === 'bench')
    try {
      away = bench.isAway() === true;
    } catch {
      away = false;
    }
  if (button.hidden !== away) return false;
  if (!away && typeof document !== 'undefined' && document.activeElement === button)
    document.querySelector('#lab-clip-stage')?.focus({ preventScroll: true });
  button.hidden = !away;
  return true;
}
function labRecenter(ctx) {
  const bench = LAB.bench;
  if (!bench || typeof bench.recenter !== 'function') return;
  try {
    bench.recenter();
  } catch {
    /* the camera is cosmetic here */
  }
  if (!ctx.recenter || ctx.recenter.hidden) return;
  if (document.activeElement === ctx.recenter)
    document.querySelector('#lab-clip-stage')?.focus({ preventScroll: true });
  ctx.recenter.hidden = true;
  labNotesFloatSync();
}
function labStationHazards(lab, stationId) {
  return (lab.content.safety.items || []).filter(h => Array.isArray(h.stations) && h.stations.includes(stationId));
}
// The station row names where the camera is (§11.2): aria-current on the current station's button; below
// 640 px the row scrolls sideways, so the current button is brought into the row's view (the row's own
// scroll, never the page's).
function labUpdateStation(lab, ctx) {
  if (typeof document === 'undefined') return;
  const nav = document.querySelector('#lab-stations');
  if (!nav) return;
  let current = null;
  for (const button of nav.querySelectorAll('.lab-station-btn')) {
    const here = !!ctx.station && button.dataset.labStation === ctx.station;
    if (here) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
    if (here) current = button;
  }
  if (!current || !(nav.scrollWidth > nav.clientWidth)) return;
  const left = current.offsetLeft - Math.max(0, (nav.clientWidth - current.offsetWidth) / 2);
  if (typeof nav.scrollTo === 'function') nav.scrollTo({ left: Math.max(0, left), behavior: 'instant' });
  else nav.scrollLeft = Math.max(0, left);
}
// The station row shows in the bench phase only (like the HUD): not before the safety notes, not while
// the intro or the dive plays, not inside the tissue, and not before the bench exists.
function labStationsSync(ctx) {
  const nav = ctx.stationsNav;
  if (!nav) return false;
  const show = !!LAB.bench && !ctx.hudGated && !!LAB_STATE.safetyAcknowledgedAt && ctx.clip.phase === 'bench';
  if (nav.hidden === !show) return false;
  nav.hidden = !show;
  return true;
}
// The drawn slide's tint follows the run's by-eye look (§11.4): LOOK_COLORS[look.key], null for the
// bench's default. Called after every refresh; a bench build without setSlideTint keeps its grey.
function labSyncSlideTint(lab, ctx) {
  const bench = LAB.bench;
  if (!bench || typeof bench.setSlideTint !== 'function') return;
  const run = ctx.runId ? LAB_STATE.runs[ctx.runId] || null : null;
  const look = run ? labRunLook(lab, run) : null;
  try {
    bench.setSlideTint(labLookColor(look && look.key));
  } catch {
    /* the tint is cosmetic here */
  }
}

/* ---------- tissue clip inside the 3D bench (contract §7.1; SHELL-8) ---------- */
// The bench handle is the clip's handle: intro(), dive(run, outcome, frames), explore(),
// leaveExplore(), surface(), seek(sceneId), skip(), play(), pause(), clipState(). Every call is
// feature-detected so an older bench build simply shows no clip controls (the transcript stays).
const labClipCtx = introQueued => ({
  introQueued: !!introQueued, // play the intro as soon as the bench is ready (?intro=1)
  phase: 'bench', // 'bench' | 'intro' | 'dive' | 'explore' (mirrors clipState().phase)
  scene: null,
  index: -1,
  caption: '',
  diveDone: false, // the dive timeline finished: Explore opens
  inspected: null, // tissue site shown in the structure card
  transient: null, // the built-in default run used while the bench has no run (never saved)
  played: false, // a clip ran in this bench visit: its transcript stays reachable after it ends (KB-14)
  introEnded: false, // the intro just ended: one visible line under the stage says so (F12)
});
const labClipSupported = () => !!LAB.bench && typeof LAB.bench.intro === 'function';
const labClipUnsupportedText = () =>
  'This build of the 3D bench has no tissue clip yet; the transcript under the stage has its captions.';
const labClipIsSite = id => typeof id === 'string' && (id === 'soma' || SilverLab.SITE_CLASSES.includes(id));
// The clip reads the transient run whenever the bench has no run of its own.
const labClipNoRun = ctx => !(ctx.runId && LAB_STATE.runs[ctx.runId]);
const labClipNoRunText = lab => labClipText(labClip(lab), 'noRunCaption', LAB_CLIP_NO_RUN);
// A `step-skipped` card is a run still in progress (its performed steps paint; 3D-4); every other
// card code is a true no-basis outcome: the tissue stays unstained and the caption names the gap.
const labClipInProgress = outcome =>
  !!outcome && outcome.label === SilverLab.LABELS.NO_BASIS && outcome.code === 'step-skipped';
function labClipState() {
  const bench = LAB.bench;
  if (!bench || typeof bench.clipState !== 'function') return null;
  try {
    const state = bench.clipState();
    return labIsObj(state) ? state : null;
  } catch {
    return null;
  }
}
// The run the clip reads: the bench's run, else the transient sop-default run (built once per mount).
function labClipRunFor(lab, ctx) {
  const real = ctx.runId ? LAB_STATE.runs[ctx.runId] : null;
  if (real) return real;
  if (!ctx.clip.transient) {
    try {
      ctx.clip.transient = labTransientRun(lab);
    } catch (error) {
      console.error('lab clip: transient run', error);
      return null;
    }
  }
  return ctx.clip.transient;
}
// The state the tissue is drawn from: the last replay frame, else the outcome's state.
function labClipCurrentState(lab, ctx) {
  const run = labClipRunFor(lab, ctx);
  if (!run || labIsSealed(run.id)) return { state: null, outcome: null };
  const frames = lab.replay(run),
    outcome = lab.resolve(run);
  const state = frames.length
    ? frames[frames.length - 1].state
    : labIsObj(run.state)
      ? run.state
      : outcome && outcome.state
        ? outcome.state
        : null;
  return { state, outcome };
}
// One guarded call into the handle; the UI is re-synced when it returns (and again when a returned
// promise settles, since intro() and dive() run a timeline).
function labClipRun(lab, ctx, method, ...args) {
  const bench = LAB.bench;
  if (!bench || typeof bench[method] !== 'function') return null;
  if (method === 'intro' || method === 'dive') Object.assign(ctx.clip, { played: true, introEnded: false });
  let result = null;
  try {
    result = bench[method](...args);
  } catch (error) {
    console.error('lab clip', method, error);
    labAnnounce(`The tissue clip could not run ${method}.`);
  }
  if (result && typeof result.then === 'function') {
    const resync = () => {
      if (LAB.bench === bench) labClipSync(ctx);
    };
    result.then(resync, resync);
  }
  labClipSync(ctx);
  labClipSettle(ctx, bench);
  return result;
}
// A clip started from a link: bring the stage into view and give the keyboard its controls.
function labClipStart(lab, ctx, method, ...args) {
  const result = labClipRun(lab, ctx, method, ...args);
  labReveal('#lab-clip-stage');
  const wrap = document.querySelector('#lab-clip-stage');
  if (wrap && wrap.tabIndex === 0) wrap.focus({ preventScroll: true });
  return result;
}
// The student asked for the intro (home card, M1): it plays with the keyboard on the stage, where
// Space, the arrows and S work (KB-02, A11Y-07). Under reduced motion it waits on its first still
// for Play or Next, so each caption can be read at the student's pace (KB-14).
function labClipAutoIntro(lab, ctx) {
  if (!ctx.clip.introQueued) return;
  ctx.clip.introQueued = false;
  if (!labClipSupported()) return labAnnounce(labClipUnsupportedText());
  labClipStart(lab, ctx, 'intro');
  if (labPrefersReducedMotion()) labClipRun(lab, ctx, 'pause');
}
function labClipDive(lab, ctx) {
  const run = labClipRunFor(lab, ctx);
  if (!run) return;
  // A sealed run's tissue would show its outcome: no dive until the experiment is revealed (UX-POLISH).
  const sealed = labSealedExp(run.id);
  if (sealed) return labAnnounce(`Sealed until you reveal ${labExperimentName(sealed)}. Write your predictions first.`);
  ctx.station = 'S6';
  labUpdateStation(lab, ctx);
  labClipStart(lab, ctx, 'dive', run, lab.resolve(run), lab.replay(run));
}
function labClipExploreToggle(lab, ctx) {
  const state = labClipState() || {};
  if (state.phase === 'explore') labClipRun(lab, ctx, 'leaveExplore');
  else if (ctx.clip.diveDone || (state.phase === 'dive' && state.ended)) labClipRun(lab, ctx, 'explore');
}
// Previous / Next move within the half of the timeline that is playing (intro or dive).
function labClipStep(lab, ctx, delta) {
  const state = labClipState() || {};
  const clip = labClip(lab);
  const scene = state.scene || ctx.clip.scene;
  // The half of the timeline the handle is in; on the bench (an ended intro) the scene decides.
  const inIntro =
    state.phase === 'intro' ||
    (state.phase !== 'dive' && state.phase !== 'explore' && labClipSequence(clip, 'intro').some(s => s.id === scene));
  const sequence = labClipSequence(clip, inIntro ? 'intro' : 'dive');
  if (!sequence.length) return;
  const current = sequence.findIndex(s => s.id === scene);
  const base = current < 0 ? (delta > 0 ? -1 : 0) : current;
  const next = Math.max(0, Math.min(sequence.length - 1, base + delta));
  labClipRun(lab, ctx, 'seek', sequence[next].id);
}
// The director fills clip.json's noBasisCaption with the engine's explanation ("No sourced rule covers
// washes.condition = deviated ..."). Students read one plain line instead, and it says why no stain is
// drawn, not that the tissue did not stain (F8, KB-10, CC-6).
function labClipNoBasisCaption(lab, ctx, text) {
  const template = labClipText(labClip(lab), 'noBasisCaption', '');
  const prefix = template.split('{explanation}')[0].trim();
  if (!prefix || !text.startsWith(prefix)) return labPlainEngineText(text);
  const run = labClipRunFor(lab, ctx);
  const card = run ? lab.resolve(run) : null;
  // "No sourced rule covers skipping gold toning, so ..." (ENGINE-14) ends its gap at ", so".
  const first =
    card && card.code === 'param-uncovered' ? String(card.explanation || '').split(/;|,\s+so\s|\.(?:\s|$)/)[0] : '';
  const plain = labPlainEngineText(first).trim();
  const what = plain && !LAB_SUMMARY_ENGINE.test(plain) ? plain.replace(/^No sourced rule covers /, '') : 'this run';
  return `${LAB_WORDS.notModeled}: the model has no rule for ${what}, so no stain is drawn here.`;
}
function labClipScene(lab, ctx, sceneId, caption, index) {
  ctx.clip.scene = typeof sceneId === 'string' ? sceneId : null;
  ctx.clip.index = Number.isInteger(index) ? index : -1;
  let text = labClipNoBasisCaption(lab, ctx, typeof caption === 'string' ? caption : '');
  // Without a run the stain scenes play the built-in default run: the impregnation caption says so.
  if (ctx.clip.scene === 'impregnation' && labClipNoRun(ctx)) text = `${labClipNoRunText(lab)} ${text}`.trim();
  ctx.clip.caption = text;
  labClipSync(ctx);
  labClipPaint(ctx);
}
// Paints the persistent caption line and the transcript's current-scene marker from ctx.clip.
function labClipPaint(ctx) {
  if (ctx.caption) ctx.caption.textContent = ctx.clip.caption;
  labSpeak(ctx.clip.caption); // BENCH-3: silent unless "Read the captions aloud" is on
  if (ctx.transcript)
    ctx.transcript.querySelectorAll('[data-lab-scene]').forEach(item => {
      if (item.dataset.labScene === ctx.clip.scene) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
}
// What the intro's end says, on screen and to screen readers (F12): what the bench is waiting for, never
// an order (D5, FIX2). A finished run's "Run complete" is the progress row's line: said once there (H9,
// FIX4), so the intro's end is plain "Intro finished." then.
function labClipEndedText(ctx) {
  if (!LAB_STATE.safetyAcknowledgedAt) return 'Intro finished. The safety notes below open the bench.';
  if (labClipNoRun(ctx)) return `Intro finished. ${LAB_DROP_HINTS.noRun}.`;
  return 'Intro finished.';
}
// H9 (FIX4): the intro ends on the rack's close-up; the camera goes back to the view every other way into
// the run lands on (labFrameRun: a finished run at the microscope, S6; I3 (FIX5): mid-run, or with no run
// yet, the rack's station with the next jar), and the picker says so. Deferred: the handle is still inside
// its own onEnd call.
function labClipEndFrame(lab, ctx) {
  const bench = LAB.bench;
  setTimeout(() => {
    if (LAB.bench !== bench || ctx.clip.introQueued) return;
    labFrameRun(lab, ctx);
  }, 0);
}
// I7 (FIX5): whether the bench's run has any step done (the section-on-slide line belongs to a run that
// has not started its steps).
function labRunHasStep(ctx) {
  const run = ctx.runId ? LAB_STATE.runs[ctx.runId] : null;
  return !!run && Array.isArray(run.events) && run.events.some(e => !!labEventJar(e));
}
function labClipEnd(lab, ctx, which) {
  if (which === 'intro') {
    ctx.clip.introEnded = true;
    const where = document.querySelector('[data-lab-drawer="3d-options"] #lab-clip-intro') ? ' (under 3D options)' : '';
    // I7 (FIX5): where the section sits is news only before the run's first step.
    const slide = labRunHasStep(ctx) ? '' : ' The section is on the first slide (a drawing);';
    labAnnounce(`${labClipEndedText(ctx)}${slide} Play the intro${where} replays it.`);
    // On a phone the intro only borrowed 3D: List comes back once it ends (F7).
    // Deferred: the handle is still inside its own onEnd call, and the redraw destroys it.
    if (labModeOverride) {
      const bench = LAB.bench;
      labModeOverride = null;
      labEvents.emit('mode', labCurrentMode());
      if (labCurrentMode() !== '3d') {
        setTimeout(() => {
          if (LAB.bench !== bench) return;
          // Focus inside the stage leaves with it: hand it to the steps heading (or the gate's button).
          const active = document.activeElement;
          const inStage = !active || active === document.body || !!active.closest('.lab-bench-3d');
          ctx.refresh(inStage ? ['#lab-safety-ack', '#lab-do-h'] : null);
        }, 0);
        return;
      }
    }
    labClipEndFrame(lab, ctx);
  } else if (which === 'dive') {
    ctx.clip.diveDone = true;
    ctx.station = 'S6';
    labUpdateStation(lab, ctx);
    labAnnounce('Tissue view finished. Explore the tissue, or go back to the bench.');
  }
  labClipSync(ctx);
}
// The timeline controls (Play, Previous, Next, Skip; Space, arrows, S) are live while the intro or
// the dive plays, and on an ended intro the bench still holds, so a storyboard can be stepped again.
const labClipTimelineOpen = state =>
  state.phase === 'intro' ||
  state.phase === 'dive' ||
  (state.phase === 'bench' && !!state.ended && typeof state.scene === 'string');
// Transitions (descend, fly, dip) change clipState() after a call has returned: poll briefly after
// every call so the buttons follow; the poll stops with the handle (labDestroyBench clears it).
let labClipSettleTimer = null;
function labClipSettle(ctx, bench) {
  clearInterval(labClipSettleTimer);
  let ticks = 0,
    last = null;
  labClipSettleTimer = setInterval(() => {
    if (LAB.bench !== bench || ++ticks > 40) {
      clearInterval(labClipSettleTimer);
      labClipSettleTimer = null;
      return;
    }
    const s = labClipState();
    const sig = s ? `${s.phase}|${s.scene}|${s.playing}|${s.ended}|${s.loaded}` : '';
    if (sig !== last) {
      last = sig;
      labClipSync(ctx);
    }
  }, 250);
}
// Everything clip-shaped follows clipState(): the caption, the controls row, the transcript, the
// clip label and the no-run note show only while the intro or the dive plays (phase !== 'bench'),
// and only then is the stage wrapper a tab stop. Explore and Back to the bench show inside the tissue.
// A control that had focus when its row hides hands focus to the tissue link or the primary action.
function labClipSync(ctx, root = typeof document === 'undefined' ? null : document) {
  if (!root || !root.querySelector) return; // a promise can settle after the page is gone
  const state = labClipState() || { phase: 'bench', playing: false, ended: false };
  ctx.clip.phase = typeof state.phase === 'string' ? state.phase : 'bench';
  labHudSync(ctx);
  const section = root === document ? document.querySelector('.lab-bench-3d') : root;
  if (!section) return;
  section.dataset.labClipPhase = ctx.clip.phase;
  const q = sel => section.querySelector(sel);
  const playing = ctx.clip.phase !== 'bench';
  const timeline = labClipTimelineOpen({ ...state, phase: ctx.clip.phase });
  const exploring = ctx.clip.phase === 'explore';
  const inTissue = exploring || ctx.clip.phase === 'dive';
  const active = typeof document === 'undefined' ? null : document.activeElement;
  let rescue = false;
  const row = q('#lab-clip-controls');
  if (row) {
    const hide = !labClipSupported() || !playing;
    if (hide && !row.hidden && active && row.contains(active)) rescue = true;
    row.hidden = hide;
  }
  const play = q('#lab-clip-play');
  if (play) {
    play.textContent = state.playing ? 'Pause' : 'Play'; // the label is the state (F22: no aria-pressed)
    play.disabled = !timeline;
  }
  for (const sel of ['#lab-clip-prev', '#lab-clip-next', '#lab-clip-skip']) {
    const button = q(sel);
    if (button) button.disabled = !timeline;
  }
  const explore = q('#lab-clip-explore');
  if (explore) {
    explore.hidden = !inTissue;
    explore.textContent = exploring ? 'Leave explore' : 'Explore';
    explore.setAttribute('aria-pressed', String(exploring));
    explore.disabled = !(exploring || ctx.clip.diveDone || (ctx.clip.phase === 'dive' && !!state.ended));
    // I3 (FIX5): a greyed-out Explore says why, in view (the dive still plays), not a locked button.
    const why = q('#lab-clip-explore-why');
    if (why) why.hidden = explore.hidden || !explore.disabled;
  }
  // I3 (FIX5): the structure card belongs to explore: leaving it (a key, the button, the dive's end) closes it.
  if (!exploring && ctx.clip.inspected && LAB.lab) {
    ctx.clip.inspected = null;
    labUpdateStructure(LAB.lab, ctx, section);
  }
  const surface = q('#lab-clip-surface');
  if (surface) {
    surface.hidden = !inTissue;
    surface.disabled = !inTissue;
  }
  // The label shows while a clip plays; the transcript stays reachable once one has played (KB-14);
  // the no-run note is about the staining scenes, so only the dive shows it (F12).
  const banner = q('.lab-clip-banner');
  if (banner) banner.hidden = !playing;
  const transcript = q('#lab-clip-transcript');
  if (transcript) transcript.hidden = !(playing || ctx.clip.played);
  const note = q('#lab-clip-note');
  if (note) note.hidden = !inTissue;
  const ended = q('#lab-clip-ended');
  if (ended) {
    const show = ctx.clip.introEnded && !playing;
    ended.hidden = !show;
    ended.textContent = show ? labClipEndedText(ctx) : '';
  }
  const caption = q('#lab-clip-caption');
  if (caption) caption.classList.toggle('lab-sr-only', !playing);
  const wrap = q('#lab-clip-stage');
  if (wrap) wrap.tabIndex = playing ? 0 : -1;
  // The section sits on the rack's first slide (clipState().loaded); I7 (FIX5): said right after the intro,
  // and only while the run has no step done (later it reads as stale).
  const chip = q('#lab-clip-loaded');
  if (chip) chip.hidden = !(state.loaded && ctx.clip.introEnded && !labRunHasStep(ctx));
  // "Play the intro" (3D options, the specimen tray's sheet) is never offered while the intro plays (UX-R2).
  for (const intro of (root === document ? document : section).querySelectorAll(
    '#lab-clip-intro, [data-lab-clip-intro]'
  )) {
    const hide = ctx.clip.phase === 'intro';
    if (hide && !intro.hidden && active && intro.contains(active)) rescue = true;
    intro.hidden = hide;
  }
  if (rescue) {
    const targets = [
      '#lab-clip-dive',
      '#lab-do-step:not(:disabled)',
      '#lab-safety-ack',
      '#lab-clip-intro',
      '#lab-do-h',
      '#lab-intro-h',
      '#lab-clip-stage',
    ]
      .map(sel => section.ownerDocument.querySelector(sel))
      .filter(node => node && !node.closest('[hidden]'));
    // H9 (FIX4): the first one the student can see takes focus (a finished run's tissue link sits far
    // below the stage; the stage itself, where the clip just played, is the last of them). I8 (FIX5): none
    // wholly in view, the first one at least partly in view (the stage, a visible Play the intro); none at
    // all, the stage: never one far below the fold.
    const target =
      targets.find(labInFreeBand) ||
      targets.find(labPartlyInBand) ||
      targets.find(node => node.id === 'lab-clip-stage') ||
      targets[0];
    if (target) target.focus({ preventScroll: true });
  }
}
// Keys on the stage wrapper only (buttons inside keep their own keys): Space play/pause, arrows
// previous/next scene, S skip, E explore/leave explore, Esc leave explore or back to the bench.
function labClipKeys(lab, ctx, event) {
  if (event.target !== event.currentTarget || !labClipSupported()) return;
  const state = labClipState() || { phase: 'bench' };
  const phase = typeof state.phase === 'string' ? state.phase : 'bench';
  const timeline = labClipTimelineOpen({ ...state, phase });
  const canExplore = phase === 'explore' || ctx.clip.diveDone || (phase === 'dive' && !!state.ended);
  switch (event.key) {
    case ' ':
    case 'Spacebar':
      if (timeline) labClipRun(lab, ctx, state.playing ? 'pause' : 'play');
      break;
    case 'ArrowRight':
      if (timeline) labClipStep(lab, ctx, 1);
      break;
    case 'ArrowLeft':
      if (timeline) labClipStep(lab, ctx, -1);
      break;
    case 's':
    case 'S':
      if (timeline) labClipRun(lab, ctx, 'skip');
      break;
    case 'e':
    case 'E':
      if (canExplore) labClipExploreToggle(lab, ctx);
      break;
    case 'Escape':
      // I3 (FIX5): an open structure card closes first, and only it.
      if (ctx.clip.inspected) labClipCardClose(lab, ctx);
      else if (phase === 'explore') labClipRun(lab, ctx, 'leaveExplore');
      else if (phase === 'dive') labClipRun(lab, ctx, 'surface');
      else if (phase === 'intro') labClipRun(lab, ctx, 'skip'); // the key help promises it (A11Y-16)
      break;
    default:
      return;
  }
  // A documented key never reaches the page (Space would scroll it), even when nothing applies.
  event.preventDefault();
}
// The clip's label only: the screen's one honesty line (or the development caption) already says that
// darker does not mean more (K3: the sentence appeared twice on one screen).
const labClipBanner = clip =>
  `<p class="lab-banner lab-clip-banner" data-lab-label="schematic"><strong>${esc(labClipLabel(clip))}</strong></p>`;
function labClipListHtml(scenes, currentId) {
  return `<ol class="lab-clip-list">${scenes
    .map(
      s =>
        `<li data-lab-scene="${esc(s.id)}"${s.id === currentId ? ' aria-current="step"' : ''}><strong>${esc(s.title)}</strong>${s.captions.map(c => `<p>${esc(c)}</p>`).join('') || '<p class="lab-dim">(no caption)</p>'}</li>`
    )
    .join('')}</ol>`;
}
const labClipMissingHtml = () =>
  `<p class="lab-dim lab-clip-missing">${esc(LAB_CLIP_UNAVAILABLE)}${LAB.clipError ? ` (${esc(LAB.clipError)})` : ''}</p>`;
// The transcript ("Transcript", a <details> under the clip controls): every scene caption. Built once
// per bench context and re-attached on every refresh, so its open state and the current-scene
// marker (labClipPaint) persist.
function labClipTranscript(lab) {
  const scenes = labClipScenes(labClip(lab));
  const details = el(
    '<details class="lab-clip-transcript" id="lab-clip-transcript" hidden><summary>Transcript</summary></details>'
  );
  details.appendChild(el(scenes.length ? labClipListHtml(scenes, null) : labClipMissingHtml()));
  return details;
}
// Plain-text form of the clip for list mode and the modules: readable without WebGL2.
function labClipTextHtml(lab, { level = 3, id = 'lab-clip-text' } = {}) {
  const clip = labClip(lab),
    scenes = labClipScenes(clip);
  return `<section class="lab-clip-text" aria-labelledby="${esc(id)}-h">${labHeading(level, 'What the tissue view shows', ` id="${esc(id)}-h"`)}${labClipBanner(clip)}<p class="lab-note">On the 3D bench these scenes play as a short drawn clip: a brain becomes a section, and the view goes into the tissue as the stain builds up, step by step from the run's own log. The captions say everything the pictures show.</p>${scenes.length ? labClipListHtml(scenes, null) : labClipMissingHtml()}</section>`;
}
// The row under the stage while a clip plays: timeline buttons, then Explore and Back to the bench
// inside the tissue. "Play the intro" sits with the step links; the loaded chip in the status line.
function labClipControlsHtml() {
  return `<div class="lab-clip-controls" id="lab-clip-controls" role="group" aria-label="Tissue clip" hidden>
      <button type="button" class="btn" id="lab-clip-play" disabled>Play</button>
      <button type="button" class="btn" id="lab-clip-prev" disabled>Previous scene</button>
      <button type="button" class="btn" id="lab-clip-next" disabled>Next scene</button>
      <button type="button" class="btn" id="lab-clip-skip" disabled>Skip</button>
      <button type="button" class="btn" id="lab-clip-explore" aria-pressed="false" aria-describedby="lab-clip-explore-why" disabled hidden>Explore</button>
      <button type="button" class="btn" id="lab-clip-surface" disabled hidden>Back to the bench</button>
      <p class="lab-dim lab-clip-explore-why" id="lab-clip-explore-why" hidden>${esc(LAB_CLIP_EXPLORE_WAIT)}</p>
    </div>`;
}
// I3 (FIX5): why Explore is greyed out while the dive plays (shown under the clip's buttons).
const LAB_CLIP_EXPLORE_WAIT = 'Explore opens when the dive ends.';
function labClipBindControls(lab, ctx, root) {
  const on = (sel, fn) => root.querySelector(sel)?.addEventListener('click', fn);
  on('#lab-clip-play', () => {
    const state = labClipState() || {};
    labClipRun(lab, ctx, state.playing ? 'pause' : 'play');
  });
  on('#lab-clip-prev', () => labClipStep(lab, ctx, -1));
  on('#lab-clip-next', () => labClipStep(lab, ctx, 1));
  on('#lab-clip-skip', () => labClipRun(lab, ctx, 'skip'));
  on('#lab-clip-explore', () => labClipExploreToggle(lab, ctx));
  on('#lab-clip-surface', () => labClipRun(lab, ctx, 'surface'));
}
// Structure card beside the stage: the structure's name, its three levels in plain words from the
// drawn state, and its labels (the outcome's badge keeps the engine label). A run in progress shows
// the state its performed steps reached so far; any other Not modeled card has no state to show.
function labUpdateStructure(lab, ctx, root = document) {
  const card = root.querySelector('#lab-clip-card');
  if (!card) return;
  const layout = card.closest('.lab-clip-layout');
  const site = ctx.clip.inspected;
  if (!site) {
    card.hidden = true;
    card.replaceChildren();
    if (layout) layout.dataset.labClipCard = 'closed';
    return;
  }
  const name = site === 'soma' ? 'Neuron cell body (drawing)' : labSiteText(site);
  const { state, outcome } = labClipCurrentState(lab, ctx);
  const inProgress = labClipInProgress(outcome);
  const noBasis = !inProgress && !!outcome && outcome.label === SilverLab.LABELS.NO_BASIS;
  const s = (state && state[site]) || {};
  const word = value => (noBasis ? LAB_WORDS.notModeled.toLowerCase() : labOrdinal(value));
  const labels = [esc(labClipLabel(labClip(lab)))];
  if (inProgress) labels.push(esc(LAB_CLIP_INCOMPLETE));
  if (labClipNoRun(ctx)) labels.push(esc(labClipNoRunText(lab)));
  card.innerHTML = `<h3 id="lab-clip-card-h">Structure: ${esc(name)}</h3>
    ${outcome ? `<p class="lab-clip-card-badge">${labBadgeForOutcome(outcome)}</p>` : ''}
    <dl class="lab-kv lab-clip-kv"><div><dt>${esc(LAB_WORDS.boundSilver)}</dt><dd>${esc(word(s.ionicBound))}</dd></div><div><dt>${esc(LAB_WORDS.nuclei)}</dt><dd>${esc(word(s.nuclei))}</dd></div><div><dt>${esc(LAB_WORDS.visibleSilver)}</dt><dd>${esc(word(s.deposit))}</dd></div></dl>
    ${site === 'soma' ? '<p class="lab-dim">The cell body has no level of its own in the model; a tangle inside it does.</p>' : ''}
    ${noBasis ? `<p class="lab-explanation">${esc(labPlainEngineText(outcome.explanation))}</p>` : ''}
    <p class="lab-dim lab-clip-card-labels">${labels.join(' · ')}</p>
    <button type="button" class="btn" id="lab-clip-card-close">Close</button>`;
  card.querySelector('#lab-clip-card-close').addEventListener('click', () => labClipCardClose(lab, ctx));
  card.hidden = false;
  if (layout) {
    layout.dataset.labClipCard = 'open';
    // I3 (FIX5): on wide screens the card lies over the stage on the side away from the pointer's last press
    // (the canvas keeps its size, so the structure under the pointer stays the one the card names).
    layout.dataset.labClipSide = ctx.clip.pressX > 0.5 ? 'left' : 'right';
  }
}
// Closes the structure card (its Close, Escape) with focus back on the stage, where the next structure is.
function labClipCardClose(lab, ctx) {
  ctx.clip.inspected = null;
  labUpdateStructure(lab, ctx);
  document.querySelector('#lab-clip-stage')?.focus({ preventScroll: true });
}

/* ---------- activities M1..M7: a stepper, one step per screen (PLAN-ALZ-LAB-SIMPLIFY §3.5; contract §8.3) ---------- */
function labModuleProgress(id) {
  if (!labIsObj(LAB_STATE.moduleProgress[id])) LAB_STATE.moduleProgress[id] = { fields: {}, done: false };
  const p = LAB_STATE.moduleProgress[id];
  if (!labIsObj(p.fields)) p.fields = {};
  return p;
}
const labModuleDone = (mod, progress) =>
  mod.steps.filter(s => s.required && s.field).every(s => String(progress.fields[s.field] || '').trim().length > 0);
function labSaveModuleField(mod, field, value) {
  const progress = labModuleProgress(mod.id);
  progress.fields[field] = String(value || '');
  progress.done = labModuleDone(mod, progress);
  return labSave();
}
// The module's default runs are created once (full protocol on runnable methods) and remembered under
// moduleProgress[M].runs (slug of the default-run label -> run id; additive field, Deviations SHELL-1 /
// SHELL-7). Keys are slugs, never the label: study-backup refuses record keys carrying & " ' < >.
function labModuleRunKeys(mod) {
  const keys = [];
  for (const def of mod.defaultRuns || []) {
    let key = labSlug(def.label) || `run-${keys.length + 1}`;
    if (keys.includes(key)) key = `${key}-${keys.length + 1}`;
    keys.push(key);
  }
  return keys;
}
// Older saves keyed runs by the label itself; move them to the slug and drop any key a backup would refuse.
function labModuleRunMap(mod) {
  const progress = labModuleProgress(mod.id);
  if (!labIsObj(progress.runs)) progress.runs = {};
  const keys = labModuleRunKeys(mod);
  let migrated = false;
  (mod.defaultRuns || []).forEach((def, i) => {
    if (def.label !== keys[i] && progress.runs[keys[i]] === undefined && typeof progress.runs[def.label] === 'string') {
      progress.runs[keys[i]] = progress.runs[def.label];
      delete progress.runs[def.label];
      migrated = true;
    }
  });
  for (const key of Object.keys(progress.runs))
    if (/[<>"'`&]/.test(key)) {
      delete progress.runs[key];
      migrated = true;
    }
  if (migrated) labSave();
  return { progress, keys };
}
function labPrepareModuleRuns(lab, mod) {
  const { progress, keys } = labModuleRunMap(mod);
  const ids = [];
  let created = false;
  (mod.defaultRuns || []).forEach((def, i) => {
    let id = progress.runs[keys[i]];
    if (!id || !LAB_STATE.runs[id]) {
      const run = labNewRun({
        specimenId: def.specimenId,
        method: def.method || LAB_RUNNABLE_METHOD,
        params: def.params || {},
        label: `${mod.id}: ${def.label}`,
        deferSave: true,
      });
      const events = labFullProtocolEvents(lab, run);
      if (events.length) labApplyEvents(run.id, events);
      labSealTwin(run.id); // UX-LAST: its sealed card says why
      id = run.id;
      progress.runs[keys[i]] = id;
      created = true;
    }
    ids.push(id);
  });
  if (created || !ids.length) labSave();
  return ids;
}
// Inside an activity a run is named without the activity prefix: "Run 3 · Longer impregnation time".
const labModuleRunName = run => labRunTitle(run).replace(/ · Activity \d+: /, ' · ');
function labModuleRunIds(mod) {
  const { progress, keys } = labModuleRunMap(mod);
  return keys.map(key => progress.runs[key]).filter(id => id && LAB_STATE.runs[id]);
}
// m4: the designer at the wizard step a module step writes (M5 design -> 2, M6 predictions -> 3,
// interpret -> 4; it resumes the latest design), plus a text link to start a second one (a blank
// draft starts at step 1). Named like the designer's own h1 (F4, KB-06). The designer keeps the
// design; this activity's checklist counts only its own answer boxes (F20).
const LAB_DESIGNER_CHECKLIST =
  'The designer keeps your design on its own. This activity’s checklist counts only the answer boxes marked required on these screens.';
function labDesignerLinks(step, { fresh = true } = {}) {
  // SIMPLE: the designer has two screens; the old wizard steps 1-2 land on Plan, 3-4 on Predict and reveal.
  const screen = step >= 3 ? 2 : 1;
  return `<div class="lab-row"><a class="btn btn-solid" data-lab-go href="${esc(labUrl({ view: 'designer', step: screen }))}">${screen === 2 ? 'Open the predict and reveal screen' : 'Design your experiment'}</a>${fresh ? `<a class="lab-designer-fresh" data-lab-go href="${esc(labUrl({ view: 'designer', exp: 'new' }))}">Start a new design</a>` : ''}</div><p class="lab-note lab-designer-checklist">${esc(LAB_DESIGNER_CHECKLIST)}</p>`;
}
// One screen per step, except consecutive predict steps, which share one screen with a box each (M6:
// expected / negligible / opposite, then the interpretation on the next screen).
function labModuleScreens(mod) {
  const screens = [];
  mod.steps.forEach((step, index) => {
    const last = screens[screens.length - 1];
    if (step.kind === 'predict' && last && last.kind === 'predict') last.items.push({ step, index });
    else screens.push({ kind: step.kind, items: [{ step, index }] });
  });
  return screens;
}
function labScreenTitle(screen) {
  if (screen.items.length > 1) return LAB_STEP_KIND_TEXT[screen.kind] || screen.kind;
  const { step } = screen.items[0];
  return step.title || LAB_FIELD_TITLES[step.field] || LAB_STEP_KIND_TEXT[step.kind] || step.kind;
}
const LAB_GROUP_PROMPT = 'Answer each box before any run is revealed.';
const labScreenUrl = (mod, n) => labUrl({ view: `module:${mod.id}`, step: n > 1 ? n : null });
// The tool a screen needs, painted into `tool`. Steps that prepare default runs (view, run, compare)
// wait for the same safety gate as the bench, because preparing a run performs the full protocol.
function labModuleTool(lab, mod, screen, n, tool, page) {
  const step = screen.items[0].step;
  if (['view', 'run', 'compare'].includes(step.kind) && !LAB_STATE.safetyAcknowledgedAt) {
    tool.appendChild(labSafetyCard(lab, () => page.rebuild('tool'), { ackText: 'I understand, continue' }));
    return;
  }
  const total = (mod.defaultRuns || []).length;
  const prepared = () => {
    const ids = labModuleRunIds(mod);
    return { ids, ready: ids.length > 0 && ids.length === total };
  };
  const prepareButton = (text, after) => {
    const button = el(`<button type="button" class="btn" data-lab-module-action="prepare">${esc(text)}</button>`);
    button.addEventListener('click', () => {
      const runIds = labPrepareModuleRuns(lab, mod);
      labAnnounce(`${runIds.length} run${runIds.length === 1 ? '' : 's'} ready for this activity.`);
      after(runIds, button);
    });
    return button;
  };
  switch (step.kind) {
    case 'clip': {
      // The clip plays on the 3D bench (contract §7.1), on the activity's first run when it exists; the
      // same captions are readable here without WebGL2.
      const ids = labModuleRunIds(mod);
      tool.innerHTML = `<p class="lab-note">A short drawn clip on the 3D bench: a brain becomes a thin section on a slide, and the view goes into the tissue while the stain builds up.</p><div class="lab-row"><a class="btn" data-lab-go href="${esc(labUrl({ view: 'bench', mode: '3d', intro: '1', run: ids[0] || null }))}">Open the tissue clip</a></div>`;
      tool.appendChild(
        labDisclosure('Read the clip as text', () => el(labClipTextHtml(lab, { level: 3, id: `${page.uid}-clip` })), {
          key: 'clip-text',
          cls: 'lab-clip-text-disclosure',
        })
      );
      break;
    }
    case 'view': {
      // The short specimen names ("Practice specimen A", "Negative comparison") of the first two runs.
      const names = (mod.defaultRuns || [])
        .slice(0, 2)
        .map(d => (labSpecimenName(lab.getSpecimen(d.specimenId)) || 'a practice specimen').split(' · ')[0]);
      const { ids } = prepared();
      tool.innerHTML = `<p class="lab-note">In the microscope${names.length > 1 ? ', side by side' : ''}: ${esc(labAnd(names))}.</p><div class="lab-row" data-lab-slot="actions"></div><div class="lab-scope-inline" data-lab-slot="scope"></div>`;
      const actions = tool.querySelector('[data-lab-slot="actions"]');
      const full = runIds =>
        el(
          `<a class="lab-module-full" data-lab-go href="${esc(labUrl({ view: 'microscope', run: runIds.slice(0, 2).join(',') }))}">Full microscope view</a>`
        );
      actions.appendChild(
        prepareButton('Show the pictures here', (runIds, button) => {
          if (!actions.querySelector('.lab-module-full')) actions.appendChild(full(runIds));
          const host = tool.querySelector('[data-lab-slot="scope"]');
          for (const old of [...page.handles]) labDropHandle(old, page.handles);
          host.replaceChildren();
          const handle = labMountScope(
            lab,
            host,
            runIds.slice(0, 2).map(id => LAB_STATE.runs[id]),
            {
              headingLevel: 3,
              onClose() {
                labDropHandle(handle, page.handles);
                host.replaceChildren();
                button.focus();
              },
            }
          );
          if (handle) page.handles.add(handle);
        })
      );
      if (ids.length) actions.appendChild(full(ids));
      break;
    }
    case 'run':
    case 'compare': {
      const paint = () => {
        const { ids, ready } = prepared();
        if (!ready) {
          tool.innerHTML = `<p class="lab-note">This activity comes with ${total} ready-made run${total === 1 ? '' : 's'}. Preparing them does every step for you.</p><div class="lab-row" data-lab-slot="actions"></div>`;
          tool.querySelector('[data-lab-slot="actions"]').appendChild(
            prepareButton('Prepare the runs', () => {
              paint();
              tool.querySelector('a, select, button')?.focus({ preventScroll: true });
            })
          );
          return;
        }
        if (step.kind === 'run') {
          tool.innerHTML = `<p class="lab-note">Open a run on the bench to see its result, or to compare it with another run.</p><ul class="lab-module-runs">${ids
            .map(
              id =>
                `<li><a data-lab-go href="${esc(labUrl({ view: 'bench', run: id }))}">${esc(labModuleRunName(LAB_STATE.runs[id]))}</a></li>`
            )
            .join('')}</ul>`;
          return;
        }
        const options = ids.map(id => ({ value: id, text: labModuleRunName(LAB_STATE.runs[id]) }));
        tool.innerHTML = `<form class="lab-fields lab-module-compare">${labSelectHtml(`${page.uid}-a`, 'a', options, ids[0], { labelText: 'Baseline' })}${labSelectHtml(`${page.uid}-b`, 'b', options, ids[1] || ids[0], { labelText: 'Compare with' })}<div class="lab-row"><button type="submit" class="btn">Compare on the bench</button></div></form>`;
        const form = tool.querySelector('form');
        form.addEventListener('submit', event => {
          event.preventDefault();
          labGo({
            view: 'bench',
            run: form.querySelector(`#${page.uid}-a`).value,
            pair: form.querySelector(`#${page.uid}-b`).value,
          });
        });
      };
      paint();
      break;
    }
    case 'curves': {
      const specimenId = (mod.specimens && mod.specimens[0]) || labFirstSpecimenId(lab);
      tool.innerHTML = `<div class="lab-fields lab-curves-fields">${labSelectHtml(
        `${page.uid}-endpoint`,
        'endpoint',
        SilverLab.ENDPOINTS.map(v => ({ value: v, text: LAB_VALUE_WORDS.ENDPOINTS[v] || v })),
        'sop-default',
        { labelText: 'Development time (moves only the marker)' }
      )}</div><div data-lab-slot="figure"></div>`;
      const select = tool.querySelector(`#${page.uid}-endpoint`);
      const draw = () => {
        const preview = lab.createRun({
          id: 'curves-preview',
          specimenId,
          params: { development: { endpoint: select.value } },
        });
        tool
          .querySelector('[data-lab-slot="figure"]')
          .replaceChildren(labCurvesFigure(lab, lab.schematicCurves(preview), { stepNumber: n }));
      };
      select.addEventListener('change', draw);
      draw();
      break;
    }
    case 'design':
      tool.innerHTML = labDesignerLinks(2);
      break;
    case 'predict':
      tool.innerHTML = `<p class="lab-note">Your experiment design asks for the same three predictions, written before its runs are revealed.</p>${labDesignerLinks(3)}`;
      break;
    case 'interpret':
      tool.innerHTML = `<p class="lab-note">The reveal is the last step of your experiment design; it never says which explanation is right.</p>${labDesignerLinks(4, { fresh: false })}`;
      break;
    case 'notebook': {
      const [tab, text] = LAB_NOTEBOOK_TOOLS[step.field] || ['', 'Open my report'];
      tool.innerHTML = `<div class="lab-row"><a class="btn" data-lab-go href="${esc(labUrl({ view: 'notebook', tab: tab || null }))}">${esc(text)}</a></div>`;
      break;
    }
    case 'choose':
      tool.innerHTML = `<ul class="lab-hypotheses">${SilverLab.HYPOTHESES.map(h => `<li>${esc(SilverLab.HYPOTHESIS_TEXT[h])}</li>`).join('')}</ul><p class="lab-note">Four competing explanations from the course recording. None is established; the lab never marks one as true.</p>`;
      break;
    default:
      break;
  }
}
// Drops one microscope handle a screen mounted (it is also in labHandles for pausing).
function labDropHandle(handle, set) {
  if (!handle) return;
  set.delete(handle);
  labHandles.delete(handle);
  try {
    handle.destroy();
  } catch {
    /* already gone */
  }
}
// An answer box: a visible label ("required" in words), an optional hint, a textarea saved on change and
// blur, and a persistent status line.
function labAnswerHtml(uid, step, progress, { name = 'Your answer', hint = '', describedBy = '' } = {}) {
  const described = hint ? `${uid}-hint` : describedBy;
  return `<div class="lab-answer" data-lab-answer="${esc(step.field)}">
    <label class="lab-answer-name" for="${uid}">${esc(name)}${step.required ? ' <span class="lab-req">(required)</span>' : ''}</label>
    ${hint ? `<p class="lab-answer-hint" id="${uid}-hint">${esc(hint)}</p>` : ''}
    <textarea class="lab-answer-text" id="${uid}" rows="4" data-lab-field="${esc(step.field)}"${step.required ? ' required aria-required="true"' : ''}${described ? ` aria-describedby="${described}"` : ''}>${esc(progress.fields[step.field] || '')}</textarea>
    <p class="lab-field-status" role="status"></p>
  </div>`;
}
// Read first: the module's first three facts in words; their claim chips and every other fact sit
// under Sources (PLAN-ALZ-LAB-SIMPLIFY §3.5; contract §8.2 orders `facts` for this).
function labReadFirst(lab, mod, uid) {
  const facts = (mod.facts || []).filter(f => f && f.text);
  if (!facts.length) return null;
  const first = facts.slice(0, 3),
    rest = facts.slice(3);
  const aside = el(`<aside class="lab-readfirst" aria-labelledby="${uid}-rf-h">
    <h3 id="${uid}-rf-h">Read first</h3>
    <ol class="lab-readfirst-list">${first.map(f => `<li>${esc(f.text)}</li>`).join('')}</ol>
    <div data-lab-slot="sources"></div>
  </aside>`);
  aside.querySelector('[data-lab-slot="sources"]').replaceWith(
    labSourcesDisclosure(lab, 'module-sources', () => {
      const box = el(
        '<div class="lab-sources-body lab-module-sources"><ol class="lab-fact-list lab-fact-refs"></ol></div>'
      );
      const refs = box.querySelector('.lab-fact-refs');
      first.forEach((fact, i) => {
        const li = el(`<li><p class="lab-dim">Read first, fact ${i + 1}</p></li>`);
        li.appendChild(labClaimChips(lab, fact.claims, { label: `Claims for read-first fact ${i + 1}` }));
        refs.appendChild(li);
      });
      if (rest.length) {
        box.appendChild(el('<h4>More facts</h4>'));
        const more = el('<ul class="lab-fact-list"></ul>');
        for (const fact of rest) {
          const li = el(`<li><p>${esc(fact.text)}</p></li>`);
          li.appendChild(labClaimChips(lab, fact.claims));
          more.appendChild(li);
        }
        box.appendChild(more);
      }
      return box;
    })
  );
  return aside;
}
// One screen: progress dots, the step (title, prompt, read first, tool, answer boxes), then Back / Next
// (Finish on the last screen returns to the activities list).
function labModuleScreen(lab, mod, screens, n, page) {
  const screen = screens[n - 1];
  const progress = labModuleProgress(mod.id);
  const uid = page.uid;
  const single = screen.items.length === 1 ? screen.items[0].step : null;
  const prompt = single ? single.prompt : LAB_GROUP_PROMPT;
  const answers = screen.items
    .filter(item => item.step.field)
    .map(item =>
      single
        ? labAnswerHtml(`${uid}-field`, item.step, progress, { describedBy: `${uid}-prompt` })
        : labAnswerHtml(`${uid}-${labSlug(item.step.field)}`, item.step, progress, {
            name: LAB_PREDICT_LABELS[item.step.field] || labScreenTitle({ items: [item] }),
            hint: item.step.prompt,
          })
    )
    .join('');
  const last = n === screens.length;
  const frag = document.createDocumentFragment();
  frag.appendChild(
    el(
      `<ol class="lab-mstep-dots" aria-hidden="true">${screens.map((s, i) => `<li class="${i + 1 < n ? 'lab-dot-done' : i + 1 === n ? 'lab-dot-current' : ''}"></li>`).join('')}</ol>`
    )
  );
  const section =
    el(`<section class="lab-mstep lab-mstep-${esc(screen.kind)}" aria-labelledby="${uid}-h" data-lab-mstep="${n}">
    <div class="lab-mstep-head">
      <h2 id="${uid}-h" tabindex="-1"><span class="label">Step ${n} of ${screens.length}</span> ${esc(labScreenTitle(screen))}</h2>
      <p class="lab-mstep-prompt" id="${uid}-prompt">${esc(prompt)}</p>
    </div>
    <div class="lab-mstep-work">
      <div class="lab-mstep-tool" data-lab-slot="tool"></div>
      ${answers ? `<div class="lab-answers${single ? '' : ' lab-answers-grouped'}">${answers}</div>` : ''}
    </div>
  </section>`);
  const readFirst = labReadFirst(lab, mod, uid);
  if (readFirst) section.querySelector('.lab-mstep-head').after(readFirst);
  labModuleTool(lab, mod, screen, n, section.querySelector('[data-lab-slot="tool"]'), page);
  for (const area of section.querySelectorAll('textarea[data-lab-field]')) {
    const status = area.parentElement.querySelector('.lab-field-status');
    const save = () => {
      // Tabbing through an untouched box saves nothing (and says nothing).
      if (area.value === String(labModuleProgress(mod.id).fields[area.dataset.labField] || '')) return;
      const ok = labSaveModuleField(mod, area.dataset.labField, area.value);
      status.textContent = ok ? 'Saved in this browser.' : LAB_SAVE_PAUSED;
      labUpdateModuleStatus(mod);
    };
    area.addEventListener('change', save);
    area.addEventListener('blur', save);
  }
  frag.appendChild(section);
  const next = last ? null : screens[n];
  const nav = el(`<nav class="lab-mstep-nav" aria-label="Activity steps">
    ${n > 1 ? `<a class="btn lab-mstep-back" id="lab-module-prev" href="${esc(labScreenUrl(mod, n - 1))}">Back<span class="lab-sr-only">: step ${n - 1}, ${esc(labScreenTitle(screens[n - 2]))}</span></a>` : ''}
    ${
      last
        ? `<a class="btn btn-solid" id="lab-module-next" data-lab-go href="${esc(labUrl({ view: 'modules' }))}">Finish<span class="lab-sr-only">: back to all activities</span></a>`
        : `<a class="btn btn-solid" id="lab-module-next" href="${esc(labScreenUrl(mod, n + 1))}">Next<span class="lab-mstep-next-name">: ${esc(labScreenTitle(next))}</span></a>`
    }
  </nav>`);
  nav.querySelector('#lab-module-prev')?.addEventListener('click', event => page.go(n - 1, event));
  if (!last) nav.querySelector('#lab-module-next').addEventListener('click', event => page.go(n + 1, event));
  frag.appendChild(nav);
  return frag;
}
function labModuleStatusText(mod) {
  const progress = labModuleProgress(mod.id);
  const required = mod.steps.filter(s => s.required && s.field);
  const filled = required.filter(s => String(progress.fields[s.field] || '').trim()).length;
  return {
    done: !!progress.done,
    text: progress.done
      ? LAB_CHECKLIST_DONE
      : `${filled} of ${required.length} required answer${required.length === 1 ? '' : 's'} written`,
  };
}
// A persistent live region: saving an answer updates its text in place (never replaced).
function labModuleStatusChip(mod) {
  const status = labModuleStatusText(mod);
  return el(
    `<span class="pill ${status.done ? 'ok' : 'tag'}" id="lab-module-status" role="status">${esc(status.text)}</span>`
  );
}
function labUpdateModuleStatus(mod) {
  const chip = typeof document === 'undefined' ? null : document.querySelector('#lab-module-status');
  if (!chip) return;
  const status = labModuleStatusText(mod);
  chip.className = `pill ${status.done ? 'ok' : 'tag'}`;
  chip.textContent = status.text;
}
// ?view=module:M3&step=2 (1-based, default 1; contract §8.3). Back / Next swap the screen in place
// (pushState, focus on the new step's heading); a reload or a shared link opens the same step.
function labRenderModule(lab, id, params = new URLSearchParams()) {
  const mod = lab.getModule(id);
  if (!mod) return labNotBuilt(`module:${id}`);
  const modules = lab.listModules();
  const screens = labModuleScreens(mod);
  // Digits only: "2abc" or "1.9" is not a step number and opens step 1 (contract UX-E-1, CC-9).
  const raw = String(params.get('step') || '').trim();
  const wanted = /^\d+$/.test(raw) ? Number(raw) : 1;
  const first = Math.min(screens.length, Math.max(1, wanted));
  // One honesty note per screen: the shell line stays out when a read-first fact already says it.
  const factSaysIt = (mod.facts || [])
    .slice(0, 3)
    .some(fact => (fact.claims || []).includes('C-brief-intensity-not-amount'));
  const main = el(`<main class="panel lab-page lab-view-module" data-lab-module="${esc(mod.id)}">
    ${labBackLinkHtml(labUrl({ view: 'modules' }), 'All activities')}
    ${labHeaderHtml(`Activity ${labModuleNumber(mod)} of ${modules.length}`, mod.title, esc(labGoalLead(mod)))}
    <p class="lab-module-state"><span data-lab-slot="status"></span></p>
    <div class="lab-mstepper" id="lab-mstepper"></div>
    ${factSaysIt ? '' : `<p class="lab-honesty">${esc(LAB_ILLUSTRATIVE)}</p>`}
    ${mod.activityUrl ? `<p class="lab-module-meta"><a href="${esc(mod.activityUrl)}" target="_blank" rel="noopener">Course activity on Canvas (sign-in required)<span class="lab-sr-only"> (opens in a new tab)</span></a></p>` : ''}
  </main>`);
  main.querySelector('[data-lab-slot="status"]').replaceWith(labModuleStatusChip(mod));
  const stepper = main.querySelector('#lab-mstepper');
  const page = { uid: '', current: first, handles: new Set(), go, rebuild };
  function show(n, focus = null) {
    for (const handle of [...page.handles]) labDropHandle(handle, page.handles);
    page.current = n;
    page.uid = labUid(`m${mod.id}-${n}`);
    stepper.replaceChildren(labModuleScreen(lab, mod, screens, n, page));
    if (main.isConnected) labSetTitle(main, `Step ${n} of ${screens.length}`);
    const heading = stepper.querySelector('.lab-mstep h2');
    if (focus === 'heading' && heading) heading.focus({ preventScroll: true });
    if (focus === 'tool') {
      const target = stepper.querySelector(
        '[data-lab-slot="tool"] button:not(:disabled), [data-lab-slot="tool"] a, [data-lab-slot="tool"] select'
      );
      (target || heading)?.focus({ preventScroll: true });
    }
  }
  // Acknowledging the safety gate inside a step rebuilds the screen and focuses its tool.
  function rebuild(focus) {
    show(page.current, focus);
  }
  function go(n, event) {
    if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button)) return;
    event?.preventDefault();
    const to = Math.min(screens.length, Math.max(1, n));
    try {
      history.pushState({ sec: 'lab' }, '', labScreenUrl(mod, to));
    } catch {
      /* the URL is cosmetic here; the screen still changes */
    }
    show(to, 'heading');
    labReveal('#lab-mstepper');
  }
  show(first);
  labView(main);
  labSetTitle(main, `Step ${first} of ${screens.length}`);
  // On phones the sticky Back / Next bar can cover a focused answer box, and Chrome leaves a partly
  // visible element where it is: lift the focused control above the bar and below the site bar (A11Y-03).
  main.addEventListener('focusin', event => {
    const nav = main.querySelector('.lab-mstep-nav');
    const target = event.target;
    if (!nav || !target || nav.contains(target) || typeof getComputedStyle !== 'function') return;
    if (getComputedStyle(nav).position !== 'sticky') return;
    const box = target.getBoundingClientRect(),
      bar = nav.getBoundingClientRect();
    if (box.bottom > bar.top || box.top < labTopbarHeight())
      labEnsureVisible(target, { bottomInset: Math.max(0, window.innerHeight - bar.top) });
  });
}

/* ---------- microscope / notebook / designer host views ---------- */
function labModuleMissing(name, what) {
  return `<aside class="course-notice" role="status"><strong>${esc(name)} module not loaded.</strong><p>${esc(what)} Nothing you saved has changed.</p></aside>`;
}
// Host views (microscope, report, designer): the page header only (back link, kicker, h1, one-sentence
// lede); lab-microscope.js and lab-notebook.js own everything below it.
const labBackLinkHtml = (href, text, extra = '') =>
  `<p class="lab-backlink"><a data-lab-go href="${esc(href)}"><span aria-hidden="true">←</span>${esc(text)}</a>${extra}</p>`;
// A microscope opened from the designer (its links carry from=designer, exp=<id>, step=<n> and at=<the
// designer's anchor>) leads back to that experiment, to the place the link sat: the back links, Esc
// (onClose) and the run picker keep the way back. An unknown experiment, a step outside 1..4 or an
// anchor that is not a plain id is dropped (the designer then opens its newest design).
function labScopeReturn(from, exp, step, at) {
  if (from !== 'designer') return null;
  const n = String(step ?? '').trim();
  const anchor = String(at ?? '').trim();
  return {
    from: 'designer',
    exp: exp && LAB_STATE.experiments[exp] ? String(exp) : null,
    step: /^[1-4]$/.test(n) ? n : null,
    at: /^[A-Za-z][\w-]{0,79}$/.test(anchor) ? anchor : null,
  };
}
// The run picker for the full view: open when no run is chosen, else one "Choose other runs" link.
function labScopePick(ids, back = null) {
  const form = el(`<form class="lab-fields lab-scope-pick" id="lab-scope-pick">
      ${labRunSelectHtml('lab-scope-a', ids[0] || '', { labelText: 'Run' })}
      ${labRunSelectHtml('lab-scope-b', ids[1] || '', { empty: 'none', labelText: 'Compare with (optional)' })}
      <div class="lab-row"><button type="submit" class="btn">Open</button></div>
    </form>`);
  const second = form.querySelector('#lab-scope-b');
  if (!second.querySelector('option[value=""]'))
    second.insertAdjacentHTML('afterbegin', '<option value="">none</option>');
  if (!ids[1]) second.value = '';
  form.addEventListener('submit', event => {
    event.preventDefault();
    const a = form.querySelector('#lab-scope-a').value,
      b = second.value;
    if (!a) return;
    labGo({ view: 'microscope', run: b ? `${a},${b}` : a, ...(back || {}) });
  });
  return form;
}
function labRenderMicroscope(lab, params) {
  const ids = String(params.get('run') || '')
    .split(',')
    .map(s => s.trim())
    .filter(id => LAB_STATE.runs[id]);
  const runs = ids.map(id => LAB_STATE.runs[id]);
  const back = labScopeReturn(params.get('from'), params.get('exp'), params.get('step'), params.get('at'));
  const leave = back
    ? { view: 'designer', exp: back.exp, step: back.step, at: back.at }
    : { view: 'bench', run: ids[0] || null };
  const backText = back ? 'Back to your experiment' : 'Back to the bench';
  // A second way back under the viewer, so a long page need not be scrolled up again (UX-POLISH). The
  // bench's Notes button and notepad come along (E4, FIX2): the same text, saved the same way.
  const main = el(`<main class="panel lab-page lab-view-microscope lab-view-host lab-notes-host">
    ${labBackLinkHtml(labUrl(leave), backText, labNotesButtonHtml(' lab-notes-btn'))}
    ${labHeaderHtml('Microscope', 'Microscope', "Look closely at a run's simulated picture; darker does not mean more protein, more pathology or a better method.")}
    <div data-lab-slot="pick"></div>
    <div id="lab-scope-host" class="lab-scope-host"></div>
    <p class="lab-backlink-end" id="lab-scope-back-end"><a data-lab-go href="${esc(labUrl(leave))}"><span aria-hidden="true">←</span>${esc(backText)}</a></p>
    ${labNotepadHtml()}
    ${labNotesFloatHtml()}
  </main>`);
  if (labNotesOpen()) main.classList.add('lab-notes-open');
  main.querySelector('#lab-notes-toggle').addEventListener('click', () => labNotepadToggle());
  const pick = main.querySelector('[data-lab-slot="pick"]');
  if (!LAB_STATE.runOrder.length) pick.remove();
  else if (!runs.length) pick.replaceWith(labScopePick(ids, back));
  else
    pick.replaceWith(
      labDisclosure('Choose other runs', () => labScopePick(ids, back), {
        key: 'scope-pick',
        cls: 'lab-scope-pick-wrap',
      })
    );
  labView(main);
  labNotepadWire(main);
  const host = main.querySelector('#lab-scope-host');
  if (!runs.length) {
    host.innerHTML = LAB_STATE.runOrder.length
      ? '<p class="lab-empty">Choose a run above.</p>'
      : `<p class="lab-empty">No run yet. <a data-lab-go href="${esc(labUrl({ view: 'bench' }))}">Start one on the bench</a>.</p>`;
    return;
  }
  if (!window.CortexLabMicroscope || typeof window.CortexLabMicroscope.mount !== 'function') {
    // Without the viewer, each run's result card in words (badge, plain summary, Why?).
    host.innerHTML = labModuleMissing(
      'Microscope',
      'The viewer ships in lab-microscope.js; each result is described below.'
    );
    for (const run of runs) {
      if (labIsSealed(run.id)) {
        host.insertAdjacentHTML('beforeend', labSealedCards([run]));
        continue;
      }
      const result = lab.resolve(run);
      const card = el(
        `<article class="lab-result-card" data-lab-result="${esc(result.label)}">${labBanner(result, labRunTitle(run))}<p class="lab-result-summary">${esc(labSummarize(result))}</p><div class="lab-result-links"></div></article>`
      );
      const why = labDisclosure(LAB_WORDS.why, () => labWhyResult(lab, result, run, 2), {
        key: `why:scope:${run.id}`,
        cls: 'lab-why',
      });
      why.dataset.labWhy = 'result';
      card.querySelector('.lab-result-links').appendChild(why);
      host.appendChild(card);
    }
    return;
  }
  labMountScope(lab, host, runs, {
    tab: params.get('tab') || undefined,
    headingLevel: 2,
    onClose: () => labGo(leave),
  });
}
function labRenderNotebook(lab, params) {
  const main = el(`<main class="panel lab-page lab-view-notebook lab-view-host">
    ${labBackLinkHtml(labUrl(), 'Back to the lab')}
    ${labHeaderHtml('My report', 'My report', '')}
    <div id="lab-notebook-host" class="lab-notebook-host"></div>
  </main>`);
  labView(main);
  const host = main.querySelector('#lab-notebook-host');
  if (!window.CortexLabNotebook || typeof window.CortexLabNotebook.mountNotebook !== 'function') {
    host.innerHTML =
      labModuleMissing('Notebook', 'The notebook ships in lab-notebook.js.') +
      `<p class="lab-dim">${esc(LAB_STATE.notebook.entries.length)} entr${LAB_STATE.notebook.entries.length === 1 ? 'y' : 'ies'} saved.</p>`;
    return;
  }
  try {
    const handle = window.CortexLabNotebook.mountNotebook(host, {
      lab,
      state: LAB_STATE,
      tab: params.get('tab') || undefined,
      onAdd(entry) {
        const draft = { ...entry, id: `entry-${(Number(LAB_STATE.counters.entry) || 0) + 1}`, createdAt: labNow() };
        const notebook = lab.addEntry(LAB_STATE.notebook, draft, LAB_STATE.runs); // throws with the field name
        labNextId('entry');
        LAB_STATE.notebook = notebook;
        labSave();
        // No shell announcement: the notebook's own status line says where the entry went (A11Y-18).
        return draft;
      },
      onRemove(id) {
        LAB_STATE.notebook = { v: 1, entries: LAB_STATE.notebook.entries.filter(e => e.id !== id) };
        labSave();
        return LAB_STATE.notebook;
      },
      onExport() {
        const markdown = window.CortexLabNotebook.exportMarkdown(LAB_STATE, lab);
        // The file the report's own status names (UX-FIX-notebook-8), else the old name.
        labDownload(window.CortexLabNotebook.fileName || 'lab-notebook.md', markdown);
        return markdown;
      },
    });
    if (handle) labHandles.add(handle);
  } catch (error) {
    host.innerHTML = `<p class="course-notice" role="status">The notebook could not open: ${esc(error && error.message ? error.message : error)}</p>`;
  }
}
function labDownload(name, text) {
  try {
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    /* the markdown is still returned to the caller */
  }
}
function labRenderDesigner(lab, params) {
  const wanted = params.get('exp');
  const isNew = wanted === 'new'; // a blank draft; the id is allocated on the first save
  const expId = !isNew && wanted && LAB_STATE.experiments[wanted] ? wanted : undefined;
  // ?step=1..4 opens that wizard step (the activities link M5 to 2, M6 to 3 and 4).
  const step = Number(params.get('step'));
  const main = el(`<main class="panel lab-page lab-view-designer lab-view-host">
    ${labBackLinkHtml(labUrl(), 'Back to the lab', ` <a class="lab-designer-new" id="lab-designer-new" data-lab-go href="${esc(labUrl({ view: 'designer', exp: 'new' }))}">Start a new design</a>`)}
    ${labHeaderHtml('Designer', 'Design your experiment', 'Plan one test on two short screens, before you reveal this experiment’s simulated outcome.')}
    <div id="lab-designer-host" class="lab-designer-host"></div>
  </main>`);
  labView(main);
  const host = main.querySelector('#lab-designer-host');
  if (!window.CortexLabNotebook || typeof window.CortexLabNotebook.mountDesigner !== 'function') {
    host.innerHTML =
      labModuleMissing('Designer', 'The designer ships in lab-notebook.js.') +
      `<p class="lab-dim">${esc(LAB_STATE.experimentOrder.length)} experiment${LAB_STATE.experimentOrder.length === 1 ? '' : 's'} saved.</p>`;
    return;
  }
  try {
    const handle = window.CortexLabNotebook.mountDesigner(host, {
      lab,
      // ?exp=new: the designer falls back to the newest experiment whenever experimentId is falsy, so it
      // gets a view of the state whose experimentOrder is empty; `experiments` stays the shared object,
      // so the id that onSave allocates is adopted and found again on update().
      state: isNew ? { ...LAB_STATE, experimentOrder: [] } : LAB_STATE,
      experimentId: isNew ? null : expId,
      step: Number.isInteger(step) && step >= 1 && step <= 4 ? step : undefined,
      // the designer's own anchor a microscope link carried away and back (at=, UX-POLISH)
      at: params.get('at') || undefined,
      onSave(exp) {
        if (!labIsObj(exp)) return null;
        let saved,
          refused = false;
        const stored = exp.id ? LAB_STATE.experiments[exp.id] : null;
        if (stored && stored.status !== 'draft') {
          // After a reveal only the interpretation, the status, the title and the limitations may change:
          // the question, hypothesis, predictions, controls and runs are what the reveal was judged on.
          const same = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
          const open = ['interpretation', 'title', 'limitations'];
          const patch = {};
          for (const key of open) if (exp[key] !== undefined) patch[key] = exp[key];
          if (['revealed', 'done'].includes(exp.status)) patch.status = exp.status;
          refused = Object.keys(exp).some(
            key => ![...open, 'id', 'status', 'createdAt', 'revealedAt'].includes(key) && !same(exp[key], stored[key])
          );
          saved = Object.assign(stored, patch);
        } else if (stored) saved = Object.assign(stored, exp);
        else {
          saved = labNewExperiment(exp);
          // ?exp=new becomes this design's own address, so a reload or browser Back finds it again
          // instead of opening another blank draft (CC-3).
          if (isNew) {
            const shown = main.querySelector('[data-labn-wizard-step]:not([hidden])');
            const at = Number(shown && shown.dataset.labnWizardStep);
            try {
              history.replaceState(
                { sec: 'lab' },
                '',
                labUrl({ view: 'designer', exp: saved.id, step: at >= 1 && at <= 4 ? at : null })
              );
            } catch {
              /* the URL is cosmetic here */
            }
          }
        }
        const i = saved.interpretation;
        if (
          saved.status === 'revealed' &&
          labIsObj(i) &&
          ['supports', 'failsToEstablish', 'next'].every(k => String(i[k] || '').trim())
        )
          saved.status = 'done';
        LAB_STATE.sealed = labSealPruned(LAB_STATE); // runs the design no longer names are unsealed
        labSave();
        return refused
          ? { ...saved, message: 'Saved. After a reveal only the title, limitations and interpretation can change.' }
          : saved;
      },
      onRequestRuns(exp) {
        const e = exp && exp.id ? LAB_STATE.experiments[exp.id] : null;
        if (e && LAB_STATE.runs[e.baselineRunId] && LAB_STATE.runs[e.experimentalRunId])
          return { baselineRunId: e.baselineRunId, experimentalRunId: e.experimentalRunId };
        labGo({ view: 'bench', exp: e ? e.id : null, run: e && e.baselineRunId ? e.baselineRunId : null });
        return null;
      },
      onReveal(exp) {
        const e = exp && exp.id ? LAB_STATE.experiments[exp.id] : exp;
        const result = lab.reveal(e, LAB_STATE.runs);
        if (result.ok && e && LAB_STATE.experiments[e.id]) {
          if (e.status === 'draft') e.status = 'revealed';
          e.revealedAt = labNow();
          LAB_STATE.sealed = labSealPruned(LAB_STATE); // revealing unseals its runs
          labSave();
          // No card count: the experimental card and the comparison both show (UX-FIX-notebook-8).
          labAnnounce('Experiment revealed: the simulated outcome is below, next to your baseline.');
        }
        return result;
      },
    });
    if (handle) labHandles.add(handle);
  } catch (error) {
    host.innerHTML = `<p class="course-notice" role="status">The designer could not open: ${esc(error && error.message ? error.message : error)}</p>`;
  }
}
// `from: 'designer'` with `exp`, `step` and `at` makes the way back lead to that experiment (labScopeReturn).
function labOpenMicroscope({ runIds = [], view, from, exp, step, at } = {}) {
  const ids = (runIds || []).filter(id => LAB_STATE.runs[id]);
  return labGo({
    view: 'microscope',
    run: ids.length ? ids.slice(0, 2).join(',') : null,
    tab: view || null,
    ...(labScopeReturn(from, exp, step, at) || {}),
  });
}
const labOpenNotebook = tab => labGo({ view: 'notebook', tab: tab || null });
const labOpenDesigner = (expId, step) => labGo({ view: 'designer', exp: expId || null, step: step || null });

/* ---------- router ---------- */
// False once the learner has moved to another section while the lab content was still downloading.
const labStillHere = () => typeof sectionFromPath !== 'function' || sectionFromPath() === 'lab';
async function labRender(view) {
  labInjectModuleCss();
  const token = ++labRenderGeneration;
  let lab;
  try {
    lab = await labLoad();
  } catch (error) {
    if (token === labRenderGeneration && labStillHere()) labLoadFailed(error);
    return;
  }
  if (token !== labRenderGeneration || !labStillHere()) return;
  const params = new URLSearchParams(location.search);
  const raw = String(view || params.get('view') || 'home');
  const parts = raw.split(':');
  const [name, arg] = parts;
  const unit = arg || params.get('unit');
  if (!LAB_VIEWS.includes(name) || !labViewOn(name)) return labNotBuilt(raw);
  // One argument at most, and only on the activity views: "module:M3:extra" or "about:x" is not a
  // page of the lab (CC-9).
  if (parts.length > 2 || (arg && !['module', 'modules'].includes(name))) return labNotBuilt(raw);
  switch (name) {
    case 'home':
      return labRenderHome(lab);
    case 'about':
      return labRenderAbout(lab);
    case 'intro':
      return labRenderIntroText(lab);
    case 'bench':
      return labRenderBench(lab, params);
    case 'modules':
      return unit ? labRenderModule(lab, unit, params) : labRenderModules(lab);
    case 'module':
      return unit ? labRenderModule(lab, unit, params) : labRenderModules(lab);
    case 'microscope':
      return labRenderMicroscope(lab, params);
    case 'notebook':
      return labRenderNotebook(lab, params);
    case 'designer':
      return labRenderDesigner(lab, params);
    default:
      return labNotBuilt(raw);
  }
}
async function renderLabEntry() {
  labPauseTools();
  if (typeof stopTimer === 'function') stopTimer();
  if (typeof session !== 'undefined') session = null;
  const params = new URLSearchParams(location.search);
  const view = params.get('view') || 'home';
  return labRender(view);
}

window.CortexLab = {
  render: labRender,
  load: labLoad,
  getState: () => LAB_STATE,
  setState: labSetState,
  // FREE-2: the notepad text (one string); setNotepad saves at once, so callers debounce typing.
  getNotepad: () => (typeof LAB_STATE.notepad === 'string' ? LAB_STATE.notepad : ''),
  setNotepad: labSetNotepad,
  save: labSave,
  newRun: labNewRun,
  newExperiment: labNewExperiment,
  applyEvent: labApplyEvent,
  openMicroscope: labOpenMicroscope,
  openNotebook: labOpenNotebook,
  openDesigner: labOpenDesigner,
  events: labEvents,
  url: labUrl,
  go: labGo,
  // UX layer (contract §8.1); runTitle: "Run 3 · Activity 2: Strong developer" (UX-E-4)
  words: LAB_WORDS,
  badge: labBadge,
  badgeForOutcome: labBadgeForOutcome,
  level: labOrdinal,
  summarize: labSummarize,
  runTitle: labRunTitle,
  // engine sentences with `path = value` in plain words ("this change (washes: changed)"; UX-INT-3)
  plain: labPlainEngineText,
  // UX-FIX-lab.js (additive): the comparison badge (Steps still to do / Not modeled with its own long
  // text, HON-12) and the clause that marks a background moved by the model's unsourced assumption
  // (F3 / KB-05: '' when none; the report and designer append it after their background words).
  badgeForComparison: labBadgeForComparison,
  assumptionNote: labAssumptionNote,
  // for the report's run lines (UX-FIX-notebook-8): the bench's words for a value, and its flag lines
  valueText: labValueText,
  flags: labResultFlags,
  // UX-SMALL (additive): rule titles and the engine's caveats in plain words (the notebook's copies
  // become fallbacks, UX-R2-notebook-4), and the export's run / parameter / step names: runHeading(run)
  // "Run 3 · Practice specimen A · high burden · development time: longer", paramText(path, value)
  // "Development time: longer", stepTitle(stepId) the step's studentTitle.
  plainRule: labPlainRule,
  plainCaveat: labPlainCaveat,
  runHeading: labRunHeading,
  paramText: labParamText,
  stepTitle: labStepTitleById,
  // UX-POLISH (additive): true while a run "Make the runs for me" made is sealed (state.sealed, its
  // experiment still a draft that names it).
  isSealed: labIsSealed,
  // UX-LAST (shared API): the "What do you want to change?" options [{ id, label, values: [{ value,
  // label }] }] in the bench's order and words, and a planned change read against them exactly
  // ({ id, value } | null; value null when the text names an option but not which of its changes).
  changeOptions: labChangeOptions,
  matchChange: labMatchChange,
  // GAME-shell (contract §10): "Show hints" (settings.hints; setHints saves, toggles html.lab-hints-off
  // and emits 'hints'; a non-boolean is refused) and whether the pointer is coarse (touch wording).
  hintsOn: labHintsOn,
  setHints: labSetHints,
  touch: labTouch,
  // §12.3 (shell half): named settings (settings.microscopeView 'real' | 'drawing', default 'real'); setSetting
  // saves and emits 'setting' { name, value }.
  getSetting: labGetSetting,
  setSetting: labSetSetting,
  // G4 (FIX3): whether a part of the lab that LAB_FLAGS can turn off is on ('activities', 'designer',
  // 'report'); the microscope and the report never point at a part that is off.
  featureOn: labFeatureOn,
  // H10 (FIX4): { top, bottom } px of the window hidden by the site's sticky top bar and by an open notes
  // drawer (narrow screens); a reveal keeps what it shows between them.
  viewportInsets: labViewportInsets,
};
window.renderLabEntry = renderLabEntry;
window.pauseLabTools = labPauseTools;
