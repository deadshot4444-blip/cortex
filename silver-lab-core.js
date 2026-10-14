/* Silver stain simulation engine (ALZ lab, ALZ-LAB-CONTRACT.md §1-§2, §5). Pure UMD, no DOM:
   state model, step reducer, rule evaluation driven by data/lab/rules.json, label enforcement,
   uncertainty cards, notebook and export wording, serialization. Every staining effect traces to
   a rule id whose claims trace to sources; the content lint (lint()) refuses anything else. The
   ordinal arithmetic is a schematic teaching device labeled illustrative-synthetic on every
   output; it is never a quantity. Node tests require() this. */
(function (root) {
  'use strict';

  // ---- §1 enumerations -------------------------------------------------------------------
  const LABELS = Object.freeze({
    OBSERVED: 'observed-reference',
    SYNTHETIC: 'illustrative-synthetic',
    VALIDATED: 'validated-prediction',
    NO_BASIS: 'no-basis',
  });
  const LABEL_TEXT = Object.freeze({
    [LABELS.OBSERVED]: 'Observed reference image',
    [LABELS.SYNTHETIC]: 'Illustrative simulation (synthetic, not a measurement)',
    [LABELS.VALIDATED]: 'Validated model prediction',
    [LABELS.NO_BASIS]: 'No basis for a simulated result',
  });
  const BASIS = Object.freeze([
    'course-handout',
    'published-qualitative',
    'hypothesis-conditional',
    'schematic-analogy',
    'placeholder',
  ]);
  const HYPOTHESES = Object.freeze([
    'H-fixation-carbonyl',
    'H-endogenous-carbonyl',
    'H-reduced-metal',
    'H-other-reduction-site',
  ]);
  const HYPOTHESIS_TEXT = Object.freeze({
    'H-fixation-carbonyl': 'Hypothesis: fixation-related carbonyls are the reduction sites',
    'H-endogenous-carbonyl': 'Hypothesis: endogenous carbonyls are the reduction sites',
    'H-reduced-metal': 'Hypothesis: reduced metals are the reduction sites',
    'H-other-reduction-site': 'Hypothesis: other reduction sites',
  });
  const SITE_CLASSES = Object.freeze([
    'axon',
    'plaque-core',
    'plaque-neurite',
    'tangle',
    'neuropil-thread',
    'background',
  ]);
  const SITE_TEXT = Object.freeze({
    axon: 'Axon',
    'plaque-core': 'Plaque core',
    'plaque-neurite': 'Plaque neurite',
    tangle: 'Tangle',
    'neuropil-thread': 'Neuropil thread',
    background: 'Background',
  });
  const TARGET_SITES = Object.freeze(SITE_CLASSES.filter(site => site !== 'background'));
  const ORDINAL_TEXT = Object.freeze(['none', 'trace', 'low', 'moderate', 'high']);
  const RATE_PHASES = Object.freeze(['before-reference', 'reference', 'after-reference', 'unknown']);
  const STEPS = Object.freeze([
    'deparaffinize-rehydrate',
    'silver-impregnation',
    'water-wash',
    'ammoniacal-silver',
    'ammonium-hydroxide-wash',
    'development',
    'gold-toning',
    'sodium-thiosulfate',
    'final-wash-dehydrate-clear-mount',
  ]);
  const METHODS = Object.freeze(['bielschowsky-modified', 'cps-i', 'cps-ii']);
  const ENDPOINTS = Object.freeze(['early', 'sop-default', 'extended', 'unspecified']);
  const STRENGTHS = Object.freeze(['weak', 'sop-default', 'strong', 'unspecified']);
  const CONDITIONS = Object.freeze(['sop-default', 'deviated', 'unspecified']);
  const DEVIATION_KINDS = Object.freeze(['out-of-order', 'repeated', 'skipped', 'not-runnable', 'not-planned']);
  const ENTRY_TYPES = Object.freeze(['published', 'observed', 'simulated', 'reflection']);
  const SECTIONS = Object.freeze([
    'starting-ideas',
    'process-decisions',
    'outcomes-limitations',
    'learning-reflection',
    'next-steps',
  ]);
  const SECTION_TEXT = Object.freeze({
    'starting-ideas': 'Starting ideas',
    'process-decisions': 'Process and decisions',
    'outcomes-limitations': 'Outcomes and limitations',
    'learning-reflection': 'Learning and reflection',
    'next-steps': 'Next steps',
  });
  const VERSION = '1.0.0';
  // §11: the two bench modes, the ammonia leaf, the reaction kinds and the by-eye looks.
  const MODES = Object.freeze(['practice', 'free']);
  const AMMONIA = Object.freeze(['just-clear', 'extra', 'cloudy']);
  // §13.2: 'unknown' is the engine-fixed "Currently unknown reaction" of a dip no source describes.
  const REACTION_KINDS = Object.freeze(['reaction', 'no-reaction', 'sealed', 'unknown']);
  const LOOK_KEYS = Object.freeze([
    'unstained',
    'faint-yellow',
    'tan-brown',
    'light-detail',
    'black-on-tan',
    'dark-brown',
    'gray-black',
    'patchy',
  ]);
  // §11.4: the course procedure's "what you should see" column in the engine's words (LOOK_TEXT) and
  // a drawing colour per look (never a stain image). Exported as LOOKS / LOOK_COLORS.
  const LOOK_TEXT = Object.freeze({
    unstained: 'Unstained: a pale section, no silver on it.',
    'faint-yellow': 'Faintly yellow to light brown; nothing specific yet under the microscope.',
    'tan-brown': 'Tan to brown; fine brown fibres may show, no black yet.',
    'light-detail': 'Light, incomplete staining: faint structures on a pale background.',
    'black-on-tan': 'Black detail on a tan to light brown background: contrast, not darkness.',
    'dark-brown': 'Dark brown everywhere: no contrast; this hides the structures you want to count.',
    'gray-black': 'Gray-black detail on a light background: the gold-toned stain.',
    patchy: 'Patchy, uneven staining: the solution did not reach the whole section evenly.',
  });
  const LOOK_COLORS = Object.freeze({
    unstained: '#eef2f6',
    'faint-yellow': '#f1e6c2',
    'tan-brown': '#c8a877',
    'light-detail': '#b79b70',
    'black-on-tan': '#7a6648',
    'dark-brown': '#4e3b2a',
    'gray-black': '#5f6368',
    patchy: '#d9cfae',
  });
  const LOOKS = Object.freeze(
    Object.fromEntries(LOOK_KEYS.map(key => [key, Object.freeze({ text: LOOK_TEXT[key], color: LOOK_COLORS[key] })]))
  );
  // Fallback thresholds for the look when no rule carries a `look` op (the shipped R-react-look does).
  const LOOK_DEFAULTS = Object.freeze({ darkBackground: 3, blackFrom: 3, patchyBelow: 3 });
  // §11.3: a free run's slide record (primed = first silver bath done; ammoniated = the ammoniacal
  // bath raised the bound silver, cleared by thiosulfate (MODE-FIX-engine-2: the look follows the
  // state, not the step list); unfixed = mounted with unreduced silver still in it). §13.2 (the
  // shelf's dips): oxidized = permanganate before any silver; pretreated = oxalic acid after it;
  // oldSilver = the silver nitrate (and the ammoniacal silver made from it) is old or light-exposed;
  // longAmmoniacal = an ammoniacal bath far beyond 15 min; shortXylene = a xylene change too short
  // to take the wax off; tooWarm / pastTen = a developer at 37 °C / past 10 min (records).
  const INITIAL_SLIDE = Object.freeze({
    wax: true,
    coverslipped: false,
    fixed: false,
    toned: false,
    primed: false,
    ammoniated: false,
    unfixed: false,
    oxidized: false,
    pretreated: false,
    oldSilver: false,
    longAmmoniacal: false,
    shortXylene: false,
    tooWarm: false,
    pastTen: false,
  });
  const SLIDE_OUT = Object.freeze(['wax', 'coverslipped', 'fixed', 'toned', 'unfixed']);
  // A step event of a free run that no reaction rule describes (the shipped rules cover every
  // step; tests assert it never happens there).
  const NO_RULE_REACTION = Object.freeze({
    kind: 'no-reaction',
    text: 'No reaction: nothing on the slide changes at this step.',
    why: 'No rule in the model describes this step on this slide.',
  });
  // Ops that change the silver state or the slide; a reaction rule whose ops changed nothing
  // reports its `noChange` words instead (a repeat at plateau is a real no-reaction).
  const STATE_OPS = Object.freeze([
    'bind',
    'bindFree',
    'nuclei',
    'develop',
    'background',
    'ratePhase',
    'developAgain',
    'tone',
    'fix',
    'seal',
    'dewax',
    'prime',
    'flag',
    'shiftBackground',
  ]);
  // §13.1 / §13.2 the reagent shelf. Field names a bottle may carry, in the order a jar's contents
  // read (`solutionText`); fields printed only when they differ from the bottle's default; the
  // steps whose bath is a silver solution (the handling choices for black grains apply there).
  const REAGENT_FIELDS = Object.freeze(['strength', 'drops', 'ammonia', 'minutes', 'tempC', 'dark', 'fresh', 'into']);
  const SOLUTION_QUIET = Object.freeze(['fresh', 'into']);
  const REAGENT_GROUPS = Object.freeze(['procedure', 'pretreatment', 'other']);
  const HANDLING_IDS = Object.freeze(['forceps', 'glass', 'between', 'fill']);
  const SILVER_STEPS = Object.freeze(['silver-impregnation', 'ammoniacal-silver', 'development']);
  const PROCEDURE_MARK = / \(procedure\)$/;
  // The course procedure's developer window: "typically 1 to 5 min and never past 10"
  // (C-course-endpoint-microscope); its ammonia water is 1 to 5 min (C-course-procedure-quantities).
  const DEVELOPER_MINUTES = Object.freeze({ earlyBelow: 1, extendedAbove: 5, pastTenAbove: 10 });
  const AMMONIA_WATER_MAX_MINUTES = 5;
  // §13.2 tier 2: the fields of a known bottle whose effect no source here gives ('changed' = any
  // value but the bottle's default). A bottle missing here (a later addition) treats every changed
  // field as currently unknown; a value outside the field's list is always currently unknown.
  const UNKNOWN_WHEN = Object.freeze({
    'dewax-series': Object.freeze({}),
    'silver-nitrate': Object.freeze({ strength: 'changed', tempC: 'changed', dark: 'changed' }),
    'distilled-water': Object.freeze({}),
    'ammoniacal-silver': Object.freeze({ tempC: 'changed', dark: 'changed' }),
    'ammonia-water': Object.freeze({ minutes: v => typeof v === 'number' && v > AMMONIA_WATER_MAX_MINUTES }),
    developer: Object.freeze({ dark: 'changed' }),
    'gold-chloride': Object.freeze({ minutes: 'changed' }),
    thiosulfate: Object.freeze({ minutes: 'changed' }),
    'dehydrate-mount': Object.freeze({}),
    permanganate: Object.freeze({}),
    'oxalic-acid': Object.freeze({}),
  });
  // The sentence a partly-unknown field adds after "Currently unknown: …", with the claims it cites.
  const UNKNOWN_NOTES = Object.freeze({
    'silver-nitrate': Object.freeze({
      tempC: Object.freeze({
        5: Object.freeze({
          text: 'Litchfield 2001 found a controlled low-temperature version the most reproducible.',
          claims: Object.freeze(['C-litchfield-2001-reproducible', 'C-course-alternatives']),
        }),
        37: Object.freeze({
          text: 'The procedure lists 37 °C for 15 min as an experiment the class may run.',
          claims: Object.freeze(['C-course-alternatives']),
        }),
      }),
      // 10% is on the procedure's list of alternatives too (cited, no extra sentence).
      strength: Object.freeze({ 10: Object.freeze({ text: '', claims: Object.freeze(['C-course-alternatives']) }) }),
    }),
  });
  // §13.2 tier 1 wording (engine-fixed, like the old no-effect caveat: no rule, nothing to cite).
  const UNKNOWN_LABEL = 'Currently unknown reaction';
  const UNKNOWN_LIBRARY =
    "No published source in this lab's library describes it, so the drawing leaves this dip out. The real lab is how to find out.";
  const UNKNOWN_NO_SHELF = "This bottle is not on this lab's shelf.";
  const UNKNOWN_FALLBACK_WHY = 'No source here describes this dip.';
  // §5 export: the toning / thiosulfate lines in the course procedure's words (R-model-08 / 09 / 10).
  const TONING_TEXT = Object.freeze({
    performed: 'the stain turns from brown-black to gray-black',
    skipped: 'the stain stays brown-black',
  });
  const THIOSULFATE_TEXT = Object.freeze({
    performed: 'silver that was never reduced is removed, so the slide stops changing',
    skipped: 'silver that was never reduced stays in the section, so the slide will keep changing',
  });

  // Engine-fixed wording (§2 compare, §5 export). MODE-engine-1: the engine-fixed record-only caveat
  // is gone (R-model-08 / 09 / 10 model toning and thiosulfate); the object stays exported, empty.
  const FIXED_CAVEATS = Object.freeze({});
  const CROSS_METHOD_CAVEAT =
    "The two outcomes are schematized from different bases (ordinal model for the Bielschowsky run; Velasco 1992 description for CPS). No source in the registry compares these methods on the same sections, so per-site differences are not computed; view the two labeled outcomes side by side and read each method's own sources.";
  const CROSS_METHOD_RULES = Object.freeze(['R-method-01', 'R-method-02']);
  const EXPORT_DISCLAIMER =
    'Simulated outputs in this document are illustrative predictions from a qualitative teaching model. They are not observations and must not be reported as experimental results.';
  const ENTRY_TAG = Object.freeze({
    published: '[Published]',
    observed: '[Observed]',
    simulated: '[Simulated: illustrative, not a measurement]',
    reflection: '[Reflection]',
  });
  const STAND_IN_SUFFIX = '(stand-in: synthetic specimen, not characterized)';
  // ENGINE-13: a claim's strength in words for the student part of the export (no parentheses inside,
  // the export prints them around the words); the code itself appears only under Model sources.
  const STRENGTH_TEXT = Object.freeze({
    'course-handout': 'course materials',
    'published-qualitative': 'published, qualitative',
    'hypothesis-conditional': 'conditional on a hypothesis',
    'schematic-analogy': 'schematic analogy',
    placeholder: 'not yet sourced',
  });
  const CURVE_SYSTEM =
    'Schematic shapes only; no tissue system is represented. The course Gallyas activity concerns treated human spinal cord; those data were not consulted and no shape here is derived from them.';
  const CURVE_NOTE = 'Shape only. Not calibrated to any tissue. No numbers are implied.';
  const PENDING_EHS = 'PENDING-EHS';
  const FORBIDDEN_DISPOSAL = /\b(drain|sink)\b/i;

  // §2.1 defaults. Which step event each param group is read from (§2 effective params).
  const DEFAULT_PARAMS = Object.freeze({
    impregnation: Object.freeze({ endpoint: 'sop-default', temperature: 'sop-default', condition: 'sop-default' }),
    ammoniacal: Object.freeze({ endpoint: 'sop-default', ammonia: 'just-clear', condition: 'sop-default' }),
    development: Object.freeze({ endpoint: 'sop-default', strength: 'sop-default', condition: 'sop-default' }),
    washes: Object.freeze({ condition: 'sop-default' }),
    pretreatment: 'none',
    toning: true,
    thiosulfate: true,
  });
  const GROUP_STEP = Object.freeze({
    impregnation: 'silver-impregnation',
    ammoniacal: 'ammoniacal-silver',
    development: 'development',
    washes: 'water-wash',
  });
  // Inverse: the param group a step's card sets (explainStep names the rules that read it).
  const STEP_GROUP = Object.freeze(
    Object.fromEntries(Object.entries(GROUP_STEP).map(([group, step]) => [step, group]))
  );
  // pretreatment has its own card code. toning / thiosulfate true are the defaults (no gap); false is
  // read by R-model-10 in the shipped rules and is a gap only in content without such a rule.
  const COVERAGE_EXEMPT = Object.freeze(['pretreatment']);
  // ENGINE-14: toning / thiosulfate false skips that step. The step is then not required (nor expected
  // before a later step). MODE-engine-1: R-model-10 reads the false flag (practice runs); a free run
  // ignores both flags (the student dips or not).
  const SKIP_FLAGS = Object.freeze({
    toning: Object.freeze({ step: 'gold-toning', words: 'gold toning', title: 'Gold toning' }),
    thiosulfate: Object.freeze({ step: 'sodium-thiosulfate', words: 'sodium thiosulfate', title: 'Thiosulfate' }),
  });
  const skipFlag = path => (Object.prototype.hasOwnProperty.call(SKIP_FLAGS, path) ? SKIP_FLAGS[path] : null);
  const skipsStep = (params, step) =>
    isObj(params) && Object.keys(SKIP_FLAGS).some(flag => SKIP_FLAGS[flag].step === step && params[flag] === false);
  const OP_READS = Object.freeze({
    bind: ['impregnation.endpoint', 'ammoniacal.ammonia'],
    bindFree: ['impregnation.endpoint'],
    develop: ['development.endpoint', 'development.strength'],
    background: ['development.endpoint', 'development.strength'],
    ratePhase: ['development.endpoint', 'development.strength'],
  });
  // What one effect op consults by definition (§2.1 "read"): the fixed list, plus the ammoniacal
  // leaves a free-mode bind reads when it carries the matching delta map.
  const opReads = op => {
    const out = [...(OP_READS[op.op] || [])];
    if (op.op === 'bindFree') {
      if (isObj(op.endpointDelta)) out.push('ammoniacal.endpoint');
      if (isObj(op.ammoniaDelta)) out.push('ammoniacal.ammonia');
    }
    return out;
  };
  const CARD_PRECEDENCE = Object.freeze([
    'specimen-unknown',
    'method-unknown',
    'step-skipped',
    'hypothesis-unencoded',
    'param-uncovered',
  ]);
  const LINT_CODES = Object.freeze([
    'rule-without-claim',
    'claim-without-source',
    'unknown-source',
    'unknown-claim',
    'asset-without-label',
    'asset-rights-unknown',
    'asset-looks-invalid',
    'asset-source-missing',
    'validated-label-present',
    'hazard-without-source',
    'forbidden-disposal-phrase',
    'step-unknown',
    'module-fact-without-claim',
    'method-compare-only-has-steps',
    'quantity-not-unspecified-without-source',
    'axiom-missing',
    'basis-invalid',
    'hypothesis-rule-without-condition',
    'station-unknown',
    'default-run-invalid',
    'outcome-rule-unknown',
    'clip-fact-without-claim',
    'clip-scene-unknown',
    'clip-site-unknown',
    'reagent-invalid',
  ]);
  const AXIOMS = Object.freeze(['R-model-01', 'R-model-02', 'R-model-03', 'R-model-04', 'R-model-05', 'R-model-06']);
  // §7 tissue clip: scene ids in play order (captions live in data/lab/clip.json, an optional content file).
  const CLIP_SCENES = Object.freeze([
    'brain-overview',
    'region',
    'section-cut',
    'slide',
    'dive',
    'structures',
    'impregnation',
    'development',
    'record-only',
    'end',
  ]);

  class ContentError extends Error {
    constructor(problems) {
      const list = Array.isArray(problems) ? problems : [problems];
      super(
        `Lab content has ${list.length} problem${list.length === 1 ? '' : 's'}: ` +
          list.map(p => `${p.code} at ${p.path}: ${p.message}`).join('; ')
      );
      this.name = 'ContentError';
      this.problems = list;
    }
  }

  // ---- helpers ---------------------------------------------------------------------------
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const clone = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const uniq = list => list.filter((x, i) => list.indexOf(x) === i);
  function deepMerge(base, patch) {
    if (!isObj(patch)) return patch === undefined ? clone(base) : clone(patch);
    const out = isObj(base) ? clone(base) : {};
    for (const key of Object.keys(patch))
      out[key] = isObj(patch[key]) && isObj(out[key]) ? deepMerge(out[key], patch[key]) : clone(patch[key]);
    return out;
  }
  function deepFreeze(x) {
    if (x && typeof x === 'object' && !Object.isFrozen(x)) {
      Object.freeze(x);
      for (const key of Object.keys(x)) deepFreeze(x[key]);
    }
    return x;
  }
  const getPath = (obj, path) =>
    String(path)
      .split('.')
      .reduce((o, k) => (o == null ? undefined : o[k]), obj);
  function leaves(obj, prefix = '') {
    const out = [];
    for (const key of Object.keys(obj || {})) {
      const value = obj[key],
        path = prefix ? `${prefix}.${key}` : key;
      if (isObj(value)) out.push(...leaves(value, path));
      else out.push([path, value]);
    }
    return out;
  }
  const items = file => (file && Array.isArray(file.items) ? file.items : []);
  const str = x => (typeof x === 'string' ? x : '');
  const ordinalWord = n => ORDINAL_TEXT[clamp(Math.round(Number(n) || 0), 0, 4)];
  function walkStrings(value, path, visit) {
    if (typeof value === 'string') visit(value, path);
    else if (Array.isArray(value)) value.forEach((v, i) => walkStrings(v, `${path}[${i}]`, visit));
    else if (isObj(value)) for (const key of Object.keys(value)) walkStrings(value[key], `${path}.${key}`, visit);
  }
  function stableStringify(value) {
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    if (isObj(value))
      return (
        '{' +
        Object.keys(value)
          .filter(k => value[k] !== undefined)
          .sort()
          .map(k => JSON.stringify(k) + ':' + stableStringify(value[k]))
          .join(',') +
        '}'
      );
    return value === undefined ? 'null' : JSON.stringify(value);
  }

  // Predicate mini-language (§3 rules.json). A `when` tree never mutates anything.
  function hasPredicate(when, name) {
    if (!isObj(when)) return false;
    if (name in when) return true;
    return ['all', 'any'].some(k => Array.isArray(when[k]) && when[k].some(w => hasPredicate(w, name)));
  }
  function matches(when, ctx) {
    if (!isObj(when)) return false;
    if (Array.isArray(when.all)) return when.all.every(w => matches(w, ctx));
    if (Array.isArray(when.any)) return when.any.some(w => matches(w, ctx));
    if ('step' in when) return ctx.step === when.step;
    if ('mode' in when) return ctx.mode === when.mode;
    // { event: 'step' }: any bath, a step event or a dip (the sealed-slide rule fires at every one);
    // { event: 'dip' }: a dip only (§13.2: rules that read the dip's contents or handling).
    if ('event' in when) {
      if (when.event === 'dip') return ctx.event === 'dip';
      return when.event === 'step' && (typeof ctx.step === 'string' || ctx.event === 'dip');
    }
    if (Array.isArray(when.stepsDone)) return when.stepsDone.every(s => ctx.stepsDone.includes(s));
    if ('deviation' in when) return ctx.deviationKinds.includes(when.deviation);
    if (typeof when.path === 'string') {
      const value = getPath(ctx, when.path);
      if ('eq' in when) return value === when.eq;
      if (Array.isArray(when.in)) return when.in.includes(value);
      if ('defined' in when) return (value !== undefined && value !== null) === !!when.defined;
    }
    return false;
  }
  function whenPaths(when, out = []) {
    if (!isObj(when)) return out;
    if (typeof when.path === 'string' && when.path.startsWith('params.')) out.push(when.path.slice('params.'.length));
    for (const k of ['all', 'any']) if (Array.isArray(when[k])) when[k].forEach(w => whenPaths(w, out));
    return out;
  }
  function whenSteps(when, out = []) {
    if (!isObj(when)) return out;
    if (typeof when.step === 'string') out.push(when.step);
    if (Array.isArray(when.stepsDone)) out.push(...when.stepsDone);
    for (const k of ['all', 'any']) if (Array.isArray(when[k])) when[k].forEach(w => whenSteps(w, out));
    return out;
  }
  // Only the `step` predicates: the step event(s) at which a step rule fires (stepsDone excluded).
  function fireSteps(when, out = []) {
    if (!isObj(when)) return out;
    if (typeof when.step === 'string') out.push(when.step);
    for (const k of ['all', 'any']) if (Array.isArray(when[k])) when[k].forEach(w => fireSteps(w, out));
    return out;
  }
  // Every dotted RunParams path a rule reads: named `path` predicates (in the rule's `when` and in
  // any op-level `when`) plus what its ops consult.
  function rulePaths(rule) {
    const out = whenPaths(rule.when);
    for (const op of rule.effect || []) {
      out.push(...opReads(op));
      if (isObj(op.when)) whenPaths(op.when, out);
    }
    return uniq(out);
  }
  // §11: the modes a rule's `when` names (none = the rule applies in both modes).
  function whenModes(when, out = []) {
    if (!isObj(when)) return out;
    if (typeof when.mode === 'string') out.push(when.mode);
    for (const k of ['all', 'any']) if (Array.isArray(when[k])) when[k].forEach(w => whenModes(w, out));
    return out;
  }
  const ruleInMode = (rule, mode) => {
    const modes = whenModes(rule.when);
    return !modes.length || modes.includes(mode);
  };
  const atStep = when => hasPredicate(when, 'step') || hasPredicate(when, 'event');
  const isStepRule = rule => !rule.informational && atStep(rule.when);
  const isResolveRule = rule => !rule.informational && isObj(rule.when) && !atStep(rule.when);
  const isHypothesisRule = rule => /^R-hyp-/.test(str(rule.id));

  // ---- §2 lint -----------------------------------------------------------------------------
  function lint(content) {
    const problems = [];
    const add = (code, path, message) => problems.push({ code, path, message });
    const c = isObj(content) ? content : {};
    const sources = items(c.sources),
      claims = items(c.claims),
      rules = items(c.rules),
      hypothesisRules = c.rules && Array.isArray(c.rules.hypothesisRules) ? c.rules.hypothesisRules : [],
      methods = items(c.methods),
      safety = items(c.safety),
      modules = items(c.modules),
      assets = items(c.assets),
      specimens = items(c.specimens),
      stations = c.methods && Array.isArray(c.methods.stations) ? c.methods.stations : [];
    const sourceIds = new Set(sources.map(s => s.id)),
      claimIds = new Set(claims.map(k => k.id)),
      claimById = new Map(claims.map(k => [k.id, k])),
      ruleById = new Map([...rules, ...hypothesisRules].map(r => [r.id, r])),
      hazardIds = new Set(safety.map(h => h.id)),
      specimenIds = new Set(specimens.map(s => s.id)),
      methodIds = new Set(methods.map(m => m.id)),
      stationIds = new Set(stations.map(s => s.id)),
      defaultPaths = new Set(leaves(DEFAULT_PARAMS).map(([p]) => p));

    // Any string value anywhere equal to the reserved third label; disposal words anywhere
    // except sources[].excluded (which names the excluded advice).
    for (const file of Object.keys(c)) {
      walkStrings(c[file], file, (value, path) => {
        if (value === LABELS.VALIDATED)
          add('validated-label-present', path, 'the reserved label has zero members in v1');
        if (FORBIDDEN_DISPOSAL.test(value) && !/^sources\.items\[\d+\]\.excluded/.test(path))
          add('forbidden-disposal-phrase', path, 'disposal wording must come from the course procedure, SDS or EHS');
      });
    }

    claims.forEach((claim, i) => {
      const path = `claims.items[${i}]`;
      if (!Array.isArray(claim.sources) || !claim.sources.length)
        add('claim-without-source', path, `${claim.id} has no source`);
      else
        claim.sources.forEach(
          id => sourceIds.has(id) || add('unknown-source', `${path}.sources`, `${claim.id} cites unknown source ${id}`)
        );
      if (!BASIS.includes(claim.strength))
        add(
          'basis-invalid',
          `${path}.strength`,
          `${claim.id} strength ${JSON.stringify(claim.strength)} is not in BASIS`
        );
    });

    const checkRule = (rule, path) => {
      const ruleClaims = Array.isArray(rule.claims) ? rule.claims : [];
      if (!ruleClaims.length) add('rule-without-claim', path, `${rule.id} has no claim`);
      ruleClaims.forEach(
        id => claimIds.has(id) || add('unknown-claim', `${path}.claims`, `${rule.id} cites unknown claim ${id}`)
      );
      if (!BASIS.includes(rule.basis))
        add(
          'basis-invalid',
          `${path}.basis`,
          `${rule.id} basis ${JSON.stringify(rule.basis)} is not a single BASIS value`
        );
      else {
        const strengths = uniq(ruleClaims.map(id => claimById.get(id) && claimById.get(id).strength).filter(Boolean));
        if (AXIOMS.includes(rule.id) && rule.basis !== 'schematic-analogy')
          add('basis-invalid', `${path}.basis`, `${rule.id} is a model axiom and must carry basis schematic-analogy`);
        else if (strengths.length > 1 && strengths.includes('schematic-analogy') && rule.basis !== 'schematic-analogy')
          add(
            'basis-invalid',
            `${path}.basis`,
            `${rule.id} mixes claim strengths and must carry basis schematic-analogy`
          );
      }
      if (isHypothesisRule(rule) && !HYPOTHESES.includes(rule.conditionalOn))
        add('hypothesis-rule-without-condition', `${path}.conditionalOn`, `${rule.id} must name one of HYPOTHESES`);
      for (const stepId of whenSteps(rule.when))
        if (!STEPS.includes(stepId)) add('step-unknown', `${path}.when`, `${rule.id} names unknown step ${stepId}`);
    };
    rules.forEach((rule, i) => checkRule(rule, `rules.items[${i}]`));
    hypothesisRules.forEach((rule, i) => checkRule(rule, `rules.hypothesisRules[${i}]`));
    for (const id of AXIOMS) if (!ruleById.has(id)) add('axiom-missing', 'rules.items', `model axiom ${id} is absent`);

    methods.forEach((method, i) => {
      const path = `methods.items[${i}]`;
      (method.sources || []).forEach(
        id => sourceIds.has(id) || add('unknown-source', `${path}.sources`, `${method.id} cites unknown source ${id}`)
      );
      if (method.compareOnly || method.runnable === false) {
        if (Array.isArray(method.steps) && method.steps.length)
          add('method-compare-only-has-steps', `${path}.steps`, `${method.id} is compare-only and must carry no steps`);
        if (method.schematicOutcome !== undefined)
          add(
            'method-compare-only-has-steps',
            `${path}.schematicOutcome`,
            `${method.id}: rules.json is the single source of the schematic outcome`
          );
        const rule = ruleById.get(method.outcomeRule);
        if (!rule || !(rule.effect || []).some(op => op.op === 'schematicOutcome'))
          add(
            'outcome-rule-unknown',
            `${path}.outcomeRule`,
            `${method.id} outcomeRule ${JSON.stringify(method.outcomeRule)} is not a rule with a schematicOutcome effect`
          );
      }
      (method.steps || []).forEach((step, j) => {
        const sp = `${path}.steps[${j}]`;
        if (!STEPS.includes(step.id))
          add('step-unknown', `${sp}.id`, `${method.id} step ${JSON.stringify(step.id)} is not in STEPS`);
        const purpose = step.purpose || {};
        if (!BASIS.includes(purpose.basis))
          add(
            'basis-invalid',
            `${sp}.purpose.basis`,
            `${step.id} purpose basis ${JSON.stringify(purpose.basis)} is not in BASIS`
          );
        (purpose.claims || []).forEach(
          id => claimIds.has(id) || add('unknown-claim', `${sp}.purpose.claims`, `${step.id} cites unknown claim ${id}`)
        );
        // A quantity other than 'unspecified' needs a sourced purpose (course-handout basis with at
        // least one claim); a placeholder step carries none (SOP-1).
        const sourced =
          purpose.basis === 'course-handout' && Array.isArray(purpose.claims) && purpose.claims.length > 0;
        for (const [q, v] of Object.entries(step.quantities || {}))
          if (v !== 'unspecified' && !(sourced && typeof v === 'string' && v.trim()))
            add(
              'quantity-not-unspecified-without-source',
              `${sp}.quantities.${q}`,
              `${step.id} ${q} is ${JSON.stringify(v)}; a quantity needs a sourced purpose (course-handout basis with claims)`
            );
        (step.hazards || []).forEach(
          id =>
            hazardIds.has(id) || add('hazard-without-source', `${sp}.hazards`, `${step.id} names unknown hazard ${id}`)
        );
        if (step.station !== undefined && !stationIds.has(step.station))
          add(
            'station-unknown',
            `${sp}.station`,
            `${step.id} station ${JSON.stringify(step.station)} is not a station id`
          );
      });
    });
    if (methods.length) {
      const seen = new Map();
      stations.forEach((station, i) => {
        (station.steps || []).forEach(stepId => {
          if (!STEPS.includes(stepId))
            add(
              'station-unknown',
              `methods.stations[${i}].steps`,
              `station ${station.id} lists unknown step ${stepId}`
            );
          else if (seen.has(stepId))
            add(
              'station-unknown',
              `methods.stations[${i}].steps`,
              `step ${stepId} appears in stations ${seen.get(stepId)} and ${station.id}`
            );
          else seen.set(stepId, station.id);
        });
      });
      for (const stepId of STEPS)
        if (!seen.has(stepId)) add('station-unknown', 'methods.stations', `step ${stepId} appears in no station`);
      methods.forEach((method, i) =>
        (method.steps || []).forEach((step, j) => {
          if (seen.has(step.id) && step.station !== undefined && seen.get(step.id) !== step.station)
            add(
              'station-unknown',
              `methods.items[${i}].steps[${j}].station`,
              `${step.id} is listed under station ${seen.get(step.id)} but declares ${step.station}`
            );
        })
      );
    }

    safety.forEach((hazard, i) => {
      const path = `safety.items[${i}]`;
      if (typeof hazard.sourceId !== 'string' || !hazard.sourceId)
        add('hazard-without-source', `${path}.sourceId`, `${hazard.id} needs a source id or ${PENDING_EHS}`);
      else if (hazard.sourceId !== PENDING_EHS && !sourceIds.has(hazard.sourceId))
        add('unknown-source', `${path}.sourceId`, `${hazard.id} cites unknown source ${hazard.sourceId}`);
    });

    modules.forEach((mod, i) => {
      const path = `modules.items[${i}]`;
      (mod.facts || []).forEach((fact, j) => {
        if (!Array.isArray(fact.claims) || !fact.claims.length)
          add('module-fact-without-claim', `${path}.facts[${j}]`, `${mod.id} fact has no claim`);
        else
          fact.claims.forEach(
            id =>
              claimIds.has(id) ||
              add('unknown-claim', `${path}.facts[${j}].claims`, `${mod.id} fact cites unknown claim ${id}`)
          );
      });
      (mod.defaultRuns || []).forEach((run, j) => {
        const rp = `${path}.defaultRuns[${j}]`;
        if (!specimenIds.has(run.specimenId))
          add(
            'default-run-invalid',
            `${rp}.specimenId`,
            `${mod.id} default run names unknown specimen ${run.specimenId}`
          );
        if (run.method !== undefined && !methodIds.has(run.method))
          add('default-run-invalid', `${rp}.method`, `${mod.id} default run names unknown method ${run.method}`);
        if (run.params !== undefined && !isObj(run.params))
          add('default-run-invalid', `${rp}.params`, `${mod.id} default run params must be an object`);
        else
          for (const [p] of leaves(run.params || {}))
            if (!defaultPaths.has(p))
              add('default-run-invalid', `${rp}.params.${p}`, `${mod.id} default run sets unknown param ${p}`);
      });
    });

    assets.forEach((asset, i) => {
      const path = `assets.items[${i}]`;
      if (!Object.values(LABELS).includes(asset.label))
        add('asset-without-label', `${path}.label`, `${asset.id} needs an output label`);
      const status = asset.rights && asset.rights.status;
      if (!status || status === 'unknown')
        add('asset-rights-unknown', `${path}.rights`, `${asset.id} has no cleared rights status`);
      // §12.1 real reference slides: the looks a photo stands for are by-eye look keys, and the
      // photo cites a registered source (rights are checked by scripts/check-lab-content.cjs).
      if (asset.kind === 'reference-image') {
        const looks = Array.isArray(asset.looks) ? asset.looks : [];
        if (!looks.length || looks.some(key => !LOOK_KEYS.includes(key)))
          add('asset-looks-invalid', `${path}.looks`, `${asset.id} needs a non-empty subset of LOOK_KEYS`);
        if (!sourceIds.has(asset.sourceId))
          add('asset-source-missing', `${path}.sourceId`, `${asset.id} cites unknown source ${asset.sourceId}`);
      }
    });

    // §7 tissue clip (optional; the shell loads clip.json separately). Scene ids and order are
    // fixed; every fact (in a scene, a structure sub-caption or a top-level caption) needs claims
    // that exist; a structure sub-caption names a non-background site class. The string walk
    // above already covers clip.json for the reserved label and disposal wording.
    if (c.clip !== undefined && c.clip !== null) {
      const scenes = items(c.clip);
      const clipFacts = (facts, path, owner) =>
        (Array.isArray(facts) ? facts : []).forEach((fact, k) => {
          const fp = `${path}[${k}]`,
            claims = isObj(fact) ? fact.claims : undefined;
          if (!Array.isArray(claims) || !claims.length)
            add('clip-fact-without-claim', fp, `${owner} fact has no claim`);
          else
            claims.forEach(
              id =>
                claimIds.has(id) ||
                add('clip-fact-without-claim', `${fp}.claims`, `${owner} fact cites unknown claim ${id}`)
            );
        });
      const ids = scenes.map(scene => (isObj(scene) ? scene.id : undefined));
      let listed = 0;
      ids.forEach((id, i) => {
        if (CLIP_SCENES.includes(id)) return;
        listed += 1;
        add('clip-scene-unknown', `clip.items[${i}].id`, `${JSON.stringify(id)} is not a clip scene`);
      });
      CLIP_SCENES.forEach(id => {
        if (ids.includes(id)) return;
        listed += 1;
        add('clip-scene-unknown', 'clip.items', `scene ${id} is missing`);
      });
      if (!listed && ids.join(',') !== CLIP_SCENES.join(','))
        add('clip-scene-unknown', 'clip.items', `scene ids must be exactly ${CLIP_SCENES.join(', ')} in that order`);
      scenes.forEach((scene, i) => {
        if (!isObj(scene)) return;
        const path = `clip.items[${i}]`;
        clipFacts(scene.facts, `${path}.facts`, `clip scene ${scene.id}`);
        (Array.isArray(scene.sub) ? scene.sub : []).forEach((sub, j) => {
          const sp = `${path}.sub[${j}]`,
            site = isObj(sub) ? sub.site : undefined;
          if (!TARGET_SITES.includes(site))
            add('clip-site-unknown', `${sp}.site`, `${JSON.stringify(site)} is not a non-background site class`);
          clipFacts(isObj(sub) ? sub.facts : [], `${sp}.facts`, `clip scene ${scene.id} sub ${site}`);
        });
      });
      const captionFacts = isObj(c.clip.captionFacts) ? c.clip.captionFacts : {};
      for (const key of Object.keys(captionFacts))
        clipFacts(captionFacts[key], `clip.captionFacts.${key}`, `clip caption ${key}`);
    }

    // §13.1 reagent shelf (optional; no file = no shelf, every dip currently unknown). The shape the
    // engine relies on: a bottle runs a registered step or none, every field's default is one of its
    // values, each procedure jar holds a bottle that runs that jar's step, the handling ids are the
    // four. scripts/check-lab-content.cjs checks the words and the defaults on top of this.
    if (c.reagents !== undefined && c.reagents !== null) {
      const bad = (path, message) => add('reagent-invalid', path, message);
      if (!isObj(c.reagents) || !Array.isArray(c.reagents.items)) bad('reagents', 'expected { v: 1, items: [...] }');
      const shelf = items(c.reagents),
        byId = new Map(shelf.filter(isObj).map(r => [r.id, r]));
      shelf.forEach((r, i) => {
        const path = `reagents.items[${i}]`;
        if (!isObj(r) || typeof r.id !== 'string' || !r.id) return bad(path, 'a bottle needs a string id');
        if (!REAGENT_GROUPS.includes(r.group))
          bad(`${path}.group`, `${r.id} group ${JSON.stringify(r.group)} is not ${REAGENT_GROUPS.join(' | ')}`);
        if (r.step !== null && !STEPS.includes(r.step))
          bad(`${path}.step`, `${r.id} step ${JSON.stringify(r.step)} is not a step id or null`);
        if (!isObj(r.fields)) return bad(`${path}.fields`, `${r.id} fields must be an object`);
        for (const [field, spec] of Object.entries(r.fields)) {
          if (!REAGENT_FIELDS.includes(field))
            bad(`${path}.fields.${field}`, `${r.id}: ${field} is not a bottle field`);
          if (!isObj(spec) || !Array.isArray(spec.values) || !spec.values.includes(spec.default))
            bad(`${path}.fields.${field}`, `${r.id} ${field}: the default must be one of the values`);
        }
        (Array.isArray(r.claims) ? r.claims : []).forEach(
          id => claimIds.has(id) || add('unknown-claim', `${path}.claims`, `${r.id} cites unknown claim ${id}`)
        );
      });
      const jars = isObj(c.reagents) && isObj(c.reagents.jars) ? c.reagents.jars : {};
      for (const [stepId, solution] of Object.entries(jars)) {
        const path = `reagents.jars.${stepId}`,
          bottle = isObj(solution) ? byId.get(solution.reagent) : undefined;
        if (!STEPS.includes(stepId)) bad(path, `${stepId} is not a step id`);
        else if (!bottle) bad(`${path}.reagent`, `the ${stepId} jar holds no bottle on the shelf`);
        else if (bottle.step !== stepId) bad(`${path}.reagent`, `${bottle.id} does not run ${stepId}`);
      }
      const handling = isObj(c.reagents) && Array.isArray(c.reagents.handling) ? c.reagents.handling : [];
      handling.forEach((h, i) => {
        const path = `reagents.handling[${i}]`;
        if (!isObj(h) || !HANDLING_IDS.includes(h.id)) return bad(path, `handling ids are ${HANDLING_IDS.join(', ')}`);
        if (!Array.isArray(h.values) || !h.values.some(v => isObj(v) && v.id === h.default))
          bad(`${path}.default`, `${h.id}: the default must be one of the values`);
      });
    }
    return problems;
  }

  // ---- §2 lab ------------------------------------------------------------------------------
  function createLab(rawContent) {
    const problems = lint(rawContent);
    if (problems.length) throw new ContentError(problems);
    const content = deepFreeze(clone(rawContent));
    const index = list => new Map(list.map(x => [x.id, x]));
    const sources = index(items(content.sources)),
      claims = index(items(content.claims)),
      rules = [...items(content.rules), ...(content.rules.hypothesisRules || [])],
      ruleById = index(rules),
      methods = index(items(content.methods)),
      specimens = index(items(content.specimens)),
      hazards = index(items(content.safety)),
      modules = index(items(content.modules)),
      stations = content.methods.stations || [],
      measurements = content.modules.measurements || [];
    const stepRules = rules.filter(isStepRule),
      resolveRules = rules.filter(isResolveRule);
    // §13.1 the shelf (empty without reagents.json: every dip is then currently unknown).
    const shelf = isObj(content.reagents) ? items(content.reagents) : [],
      reagents = index(shelf),
      shelfJars = isObj(content.reagents) && isObj(content.reagents.jars) ? content.reagents.jars : {},
      shelfHandling =
        isObj(content.reagents) && Array.isArray(content.reagents.handling) ? content.reagents.handling : [];

    const getSpecimen = id => specimens.get(id);
    const getMethod = id => methods.get(id);
    const getRule = id => ruleById.get(id);
    const getClaim = id => claims.get(id);
    const getSource = id => sources.get(id);
    const getHazard = id => hazards.get(id);
    const isCompareOnly = method => !!method && (method.compareOnly === true || method.runnable === false);
    const methodSteps = method =>
      method && Array.isArray(method.steps) && method.steps.length ? method.steps.map(s => s.id) : STEPS;
    // ENGINE-14: the method's steps minus the ones the run's settings skip.
    const plannedSteps = (method, params) => methodSteps(method).filter(s => !skipsStep(params, s));

    const initialState = () =>
      Object.fromEntries(SITE_CLASSES.map(site => [site, { ionicBound: 0, nuclei: 0, deposit: 0, ratePhase: null }]));
    // §11: older saves carry no mode, slide or reactions; they read as practice runs whose slide
    // follows the steps done (wax off after the first step, coverslipped after the last).
    const runMode = run => (run && run.mode === 'free' ? 'free' : 'practice');
    const runSlide = run => {
      const done = run && Array.isArray(run.stepsDone) ? run.stepsDone : [];
      if (run && isObj(run.slide)) {
        // A save from before `ammoniated` existed: read it from the steps, as the look used to.
        const ammoniated =
          typeof run.slide.ammoniated === 'boolean'
            ? run.slide.ammoniated
            : done.includes('ammoniacal-silver') && run.slide.fixed !== true;
        return { ...INITIAL_SLIDE, ...run.slide, ammoniated };
      }
      const firedOp = name =>
        (run && Array.isArray(run.rulesApplied) ? run.rulesApplied : []).some(id =>
          (getRule(id) ? getRule(id).effect || [] : []).some(op => op.op === name)
        );
      return {
        ...INITIAL_SLIDE,
        wax: !done.includes('deparaffinize-rehydrate'),
        coverslipped: done.includes('final-wash-dehydrate-clear-mount'),
        primed: done.includes('silver-impregnation'),
        ammoniated: done.includes('ammoniacal-silver') && !firedOp('fix'),
        toned: firedOp('tone'),
        fixed: firedOp('fix'),
      };
    };
    const runReactions = run => (run && Array.isArray(run.reactions) ? run.reactions : []);
    const runUnknownDips = run => (run && Array.isArray(run.unknownDips) ? run.unknownDips : []);
    const num = x => (typeof x === 'number' ? x : 0);
    // The silver state in three numbers, for rule predicates (`silver.maxBound` etc.) and the look.
    const silverSummary = state => ({
      maxBound: Math.max(...SITE_CLASSES.map(site => num(state[site] && state[site].ionicBound))),
      maxDeposit: Math.max(...TARGET_SITES.map(site => num(state[site] && state[site].deposit))),
      background: num(state.background && state.background.deposit),
    });
    const artifactOps = rule => (rule ? (rule.effect || []).filter(op => op.op === 'artifact').map(op => op.id) : []);
    // Artifacts set by step rules that fired on the run (they stay set, like the rule id in rulesApplied).
    const runArtifacts = run => uniq((run.rulesApplied || []).flatMap(id => artifactOps(getRule(id))));
    // §11.4: the by-eye look, from the state, the slide and the artifacts (a drawing aid).
    function lookKey(state, slide, artifacts, th = LOOK_DEFAULTS) {
      const { maxBound, maxDeposit, background } = silverSummary(state);
      if (artifacts.includes('patchy') && maxDeposit < th.patchyBelow) return 'patchy';
      // No deposit yet: by the silver stage. Nothing bound and no first bath (or the thiosulfate
      // took the bound silver back out) is unstained; the first bath alone is faintly yellow; tan
      // to brown once an ammoniacal bath raised the bound silver (MODE-FIX-engine-2: a bath that
      // bound nothing, or one the thiosulfate undid, leaves the look where it was).
      if (maxDeposit === 0) {
        if (maxBound === 0 && (!slide.primed || slide.fixed)) return 'unstained';
        return slide.ammoniated ? 'tan-brown' : 'faint-yellow';
      }
      // MODE-FIX-engine-1: dark brown needs a genuinely dark background; a trace deposit on a
      // trace background is light, incomplete staining (C-course-trouble-no-black), not over-development.
      if (background >= th.darkBackground) return 'dark-brown';
      if (maxDeposit >= th.blackFrom) return slide.toned ? 'gray-black' : 'black-on-tan';
      return 'light-detail';
    }
    const lookThresholds = () => {
      const rule = resolveRules.find(r => (r.effect || []).some(op => op.op === 'look')),
        op = rule ? rule.effect.find(o => o.op === 'look') : null;
      return op ? { ...LOOK_DEFAULTS, ...op } : LOOK_DEFAULTS;
    };
    // The look of a run as it stands now (any mode, any number of steps); null for a compare-only run.
    function lookOf(run) {
      if (!run || isCompareOnly(getMethod(run.method))) return null;
      const key = lookKey(run.state || initialState(), runSlide(run), runArtifacts(run), lookThresholds());
      return { key, text: LOOK_TEXT[key], color: LOOK_COLORS[key] };
    }

    // The effective-params view of §2: each group from its step event, else run.params, over the
    // defaults (an older save lacks the ammonia leaf).
    function effectiveView(run) {
      const view = {};
      for (const group of Object.keys(DEFAULT_PARAMS)) {
        const step = GROUP_STEP[group],
          fromStep = step && run.effectiveParams[step] ? run.effectiveParams[step][group] : undefined,
          chosen = fromStep !== undefined ? fromStep : run.params[group];
        view[group] = isObj(DEFAULT_PARAMS[group]) ? deepMerge(DEFAULT_PARAMS[group], chosen) : clone(chosen);
      }
      return view;
    }
    function context(run, extra = {}) {
      const deviations = extra.deviations || run.deviations;
      return {
        params: extra.params || effectiveView(run),
        method: run.method,
        specimen: getSpecimen(run.specimenId) || null,
        stepsDone: run.stepsDone,
        deviations,
        deviationKinds: uniq(deviations.map(d => d.kind)),
        step: extra.step,
        // §13.2: 'dip' for a dip (rules read its contents as `dip.*`), else undefined.
        event: extra.event,
        dip: extra.dip,
        mode: runMode(run),
        slide: runSlide(run),
        silver: silverSummary(run.state || initialState()),
      };
    }

    // Effect ops. `state` is a fresh working copy; `slide` a working copy of the slide record; `acc`
    // collects outcome-level effects. An op with its own `when` applies only when it matches.
    function applyEffects(rule, state, acc, ctx, slide = { ...INITIAL_SLIDE }) {
      const specimen = ctx.specimen,
        sites = specimen && isObj(specimen.sites) ? specimen.sites : {},
        dev = ctx.params.development || {},
        imp = ctx.params.impregnation || {},
        amm = ctx.params.ammoniacal || {},
        at = (map, key) => (isObj(map) && typeof map[key] === 'number' ? map[key] : 0);
      for (const op of rule.effect || []) {
        if (isObj(op.when) && !matches(op.when, ctx)) continue;
        switch (op.op) {
          case 'bind':
            for (const site of TARGET_SITES) {
              if (!sites[site]) continue;
              const gain = Math.max(0, at(op.gain, imp.endpoint) + at(op.ammoniaDelta, amm.ammonia)),
                target = clamp(Math.min(sites[site].presence, gain), 0, 4);
              if (target > state[site].ionicBound && ctx.step === 'ammoniacal-silver') slide.ammoniated = true;
              state[site].ionicBound = target;
            }
            break;
          // §11.3 free-mode binding: B rises to min(presence, g) and never falls; g from the gain map
          // (impregnation.endpoint), or `unprimedGain` when no first bath was done, plus the
          // ammoniacal endpoint and ammonia deltas (floor 0); wax on the section caps it at `waxCap`.
          case 'bindFree': {
            let rose = false;
            for (const site of TARGET_SITES) {
              if (!sites[site]) continue;
              let g =
                typeof op.unprimedGain === 'number' && !slide.primed ? op.unprimedGain : at(op.gain, imp.endpoint);
              // §13.2: `flagDelta` lowers (or raises) the gain while a slide flag is set (oldSilver: the
              // ammoniacal silver made from old silver nitrate binds 2 less, like extra ammonia).
              const flagged = Object.keys(isObj(op.flagDelta) ? op.flagDelta : {})
                .filter(flag => slide[flag] === true)
                .reduce((sum, flag) => sum + at(op.flagDelta, flag), 0);
              g = Math.max(0, g + at(op.endpointDelta, amm.endpoint) + at(op.ammoniaDelta, amm.ammonia) + flagged);
              let target = clamp(Math.min(sites[site].presence, g), 0, 4);
              if (slide.wax && typeof op.waxCap === 'number') target = Math.min(target, op.waxCap);
              if (target > state[site].ionicBound) {
                state[site].ionicBound = target;
                rose = true;
              }
            }
            if (rose) slide.fixed = false;
            if (rose && ctx.step === 'ammoniacal-silver') slide.ammoniated = true;
            break;
          }
          case 'prime':
            slide.primed = true;
            break;
          // §11.3 development again: one more step of deposit where nuclei exist, and of background.
          case 'developAgain':
            for (const site of TARGET_SITES)
              if (sites[site] && state[site].nuclei > 0)
                state[site].deposit = clamp(state[site].deposit + at(op, 'deposit'), 0, 4);
            state.background.deposit = clamp(state.background.deposit + at(op, 'background'), 0, 4);
            break;
          case 'tone':
            slide.toned = true;
            break;
          // Thiosulfate: unreduced (bound) silver gone at every site and background; deposit stays.
          case 'fix':
            for (const site of SITE_CLASSES) if (state[site]) state[site].ionicBound = 0;
            slide.fixed = true;
            slide.ammoniated = false;
            break;
          case 'seal':
            slide.coverslipped = true;
            break;
          case 'dewax':
            slide.wax = false;
            break;
          // A slide flag goes up (set after the rule's ops) or, with `value: false`, down at once.
          case 'flag':
            if (typeof op.id === 'string') {
              if (op.value === false) slide[op.id] = false;
              else acc.flags.push(op.id);
            }
            break;
          // §13.2: one step more (or less) background, floor 0 (a long ammoniacal bath, a warm
          // developer, development past 10 min, the oxidizing pretreatment).
          case 'shiftBackground':
            state.background.deposit = clamp(state.background.deposit + at(op, 'by'), 0, 4);
            break;
          case 'look':
            acc.look = { ...LOOK_DEFAULTS, ...op };
            break;
          case 'react':
            break; // read by the free-mode event loop, not an effect on the state
          case 'nuclei':
            for (const site of TARGET_SITES)
              if (sites[site]) state[site].nuclei = Math.min(state[site].ionicBound, sites[site].reductionSites);
            break;
          case 'develop':
            for (const site of TARGET_SITES) {
              if (!sites[site]) continue;
              const ed = (op.endpointDelta || {})[dev.endpoint],
                sd = (op.strengthDelta || {})[dev.strength];
              state[site].deposit =
                state[site].nuclei === 0 ? 0 : clamp(state[site].nuclei + (ed || 0) + (sd || 0), 0, 4);
            }
            break;
          case 'background': {
            const base = op.base === undefined ? 1 : op.base;
            state.background.deposit = clamp(
              base +
                (dev.endpoint === 'extended' ? op.extendedDelta || 0 : 0) +
                (dev.strength === 'strong' ? op.strongDelta || 0 : 0),
              0,
              4
            );
            state.background.ionicBound = base;
            state.background.nuclei = base;
            break;
          }
          case 'visibility':
            acc.visibility = true; // visibility[site] = deposit[site]; derived at resolve from state
            break;
          case 'ratePhase':
            for (const site of SITE_CLASSES)
              state[site].ratePhase =
                op.map && RATE_PHASES.includes(op.map[dev.endpoint]) ? op.map[dev.endpoint] : null;
            break;
          case 'confidence':
            acc.confidence = op.level;
            break;
          case 'caveat':
            acc.caveats.push(op.text);
            break;
          case 'artifact':
            acc.artifacts.push(op.id);
            break;
          case 'schematicOutcome':
            acc.schematic = { perSite: op.perSite || {}, background: op.background || 0 };
            break;
          case 'conditional':
            acc.conditionalOn = op.hypothesis;
            break;
          default:
            break;
        }
      }
    }
    const newAcc = () => ({
      confidence: 'nominal',
      caveats: [],
      artifacts: [],
      conditionalOn: null,
      schematic: null,
      flags: [],
      look: null,
    });

    function createRun({ id, specimenId, method = 'bielschowsky-modified', params, label = null, mode } = {}) {
      const merged = deepMerge(DEFAULT_PARAMS, isObj(params) ? params : {});
      return {
        v: 1,
        id,
        specimenId,
        method,
        mode: mode === 'free' ? 'free' : 'practice',
        label: label === undefined ? null : label,
        params: merged,
        baseParams: clone(merged),
        events: [],
        stepsDone: [],
        deviations: [],
        state: initialState(),
        slide: { ...INITIAL_SLIDE },
        reactions: [],
        unknownDips: [],
        rulesApplied: [],
        effectiveParams: {},
      };
    }

    // §11.3: the one Reaction of a free run's step event, from the react ops of the rules that fired
    // (the first non-append op is the primary; its `noChange` words when the rule's state ops changed
    // nothing; a `byLook` sentence keyed by the look after the event; `append` ops follow).
    // MODE-FIX-engine-3: when the primary resolved to its no-change words, an append op's own
    // `noChange` names the cause instead; the first such op replaces the primary's text and why (the
    // plateau words would mask the cause), later ones follow. §13.2: resolved here, after every rule
    // ran, so an append that fires before its primary is read the same way.
    function composeReaction(event, step, parts, fired, look) {
      const primary = parts.primary ? { ...parts.primary } : { ...NO_RULE_REACTION },
        extra = [];
      let replaced = false;
      for (const append of parts.appends) {
        if (primary.noChange && isObj(append.noChange)) {
          if (replaced) extra.push(append.noChange.text);
          else {
            primary.text = append.noChange.text;
            if (typeof append.noChange.why === 'string') primary.why = append.noChange.why;
            replaced = true;
          }
        } else extra.push(append.text);
      }
      const byLook = isObj(primary.byLook) && typeof primary.byLook[look] === 'string' ? primary.byLook[look] : '',
        text = [primary.text, byLook, ...extra].filter(s => typeof s === 'string' && s.trim()).join(' ');
      return {
        seq: event.seq,
        step,
        kind: REACTION_KINDS.includes(primary.kind) ? primary.kind : 'reaction',
        text,
        why: str(primary.why),
        rules: [...fired],
        claims: uniq(fired.flatMap(id => (getRule(id) ? getRule(id).claims || [] : []))),
        look,
      };
    }

    // The step rules on one bath (a step event or a dip), in file order, on `next` (mutated): each rule
    // that matches applies its ops and goes to `fired` / rulesApplied; a free run also collects the
    // react ops (an op with its own `when` counts only when that matches). A `final` op stops the list.
    function runStepRules(next, ctx, free, fired) {
      const parts = { primary: null, appends: [] };
      for (const rule of stepRules) {
        if (!matches(rule.when, ctx)) continue;
        const stateOps = (rule.effect || []).some(op => STATE_OPS.includes(op.op)),
          before = stateOps ? stableStringify([next.state, next.slide]) : null,
          acc = newAcc();
        applyEffects(rule, next.state, acc, ctx, next.slide);
        for (const id of acc.flags) next.slide[id] = true;
        const changed = stateOps && stableStringify([next.state, next.slide]) !== before;
        fired.push(rule.id);
        if (!next.rulesApplied.includes(rule.id)) next.rulesApplied.push(rule.id);
        if (!free) continue;
        let stop = false;
        for (const op of rule.effect || []) {
          if (op.op !== 'react' || (isObj(op.when) && !matches(op.when, ctx))) continue;
          if (op.append) parts.appends.push({ text: op.text, noChange: op.noChange });
          else if (!parts.primary)
            parts.primary =
              stateOps && !changed && isObj(op.noChange)
                ? { kind: 'no-reaction', text: op.noChange.text, why: op.noChange.why, noChange: true }
                : { kind: op.kind, text: op.text, why: op.why, byLook: op.byLook };
          if (op.final) stop = true;
        }
        if (stop) break;
      }
      return parts;
    }

    // Applies one event. Also returns the step rules that fired on this very event (rulesApplied
    // holds each id once, so a repeated step's rules would otherwise vanish from its replay frame)
    // and, for a free run's step event or dip, the Reaction it appended.
    function applyEventWith(run, event) {
      const mode = runMode(run),
        free = mode === 'free';
      const next = {
        ...run,
        mode,
        params: clone(run.params),
        events: [...run.events, clone(event)],
        stepsDone: [...run.stepsDone],
        deviations: run.deviations.map(clone),
        state: clone(run.state),
        slide: runSlide(run),
        reactions: runReactions(run).map(clone),
        unknownDips: runUnknownDips(run).map(clone),
        rulesApplied: [...run.rulesApplied],
        effectiveParams: clone(run.effectiveParams),
      };
      const fired = [];
      let reaction = null;
      const done = () => ({ run: next, fired, reaction });
      if (!isObj(event)) return done();
      if (event.type === 'set-params') {
        next.params = deepMerge(next.params, isObj(event.params) ? event.params : {});
        return done();
      }
      if (event.type === 'dip') {
        reaction = applyDip(run, next, event, free, fired);
        return done();
      }
      if (event.type !== 'step' || typeof event.step !== 'string') return done();
      const step = event.step,
        method = getMethod(run.method);
      if (isCompareOnly(method)) next.deviations.push({ seq: event.seq, kind: 'not-runnable', step });
      // §11.3: a free run records 'repeated' only; order is the point, and the flags are not plans.
      else if (free) {
        if (next.stepsDone.includes(step)) next.deviations.push({ seq: event.seq, kind: 'repeated', step });
      }
      // ENGINE-14: toning / thiosulfate are run-level settings (§2), read from run.params.
      else if (skipsStep(next.params, step)) next.deviations.push({ seq: event.seq, kind: 'not-planned', step });
      else {
        if (next.stepsDone.includes(step)) next.deviations.push({ seq: event.seq, kind: 'repeated', step });
        const order = plannedSteps(method, next.params),
          at = order.indexOf(step),
          expectedBefore = at > 0 ? order.slice(0, at).filter(s => !next.stepsDone.includes(s)) : [];
        if (expectedBefore.length) next.deviations.push({ seq: event.seq, kind: 'out-of-order', step, expectedBefore });
      }
      next.effectiveParams[step] = deepMerge(next.params, isObj(event.params) ? event.params : {});
      if (!next.stepsDone.includes(step)) next.stepsDone.push(step);
      if (isCompareOnly(method)) return done();
      // Preconditions are read before the event changes anything (the slide and the silver numbers).
      const parts = runStepRules(next, context(next, { step }), free, fired);
      if (free) {
        reaction = composeReaction(event, step, parts, fired, lookOf(next).key);
        next.reactions.push(reaction);
      } else {
        // Practice bookkeeping (no staining claim): the wax leaves at the first step, the first
        // silver bath primes the slide, the coverslip goes on at the last; R-model-08 / 09 set
        // toned / fixed through their ops.
        if (step === 'deparaffinize-rehydrate') next.slide.wax = false;
        if (step === 'silver-impregnation') next.slide.primed = true;
        if (step === 'final-wash-dehydrate-clear-mount') next.slide.coverslipped = true;
      }
      return done();
    }
    const applyEvent = (run, event) => applyEventWith(run, event).run;

    // ---- §13 the reagent shelf and the dip ----------------------------------------------------
    const getReagent = id => reagents.get(id);
    const listReagents = () => shelf.map(clone);
    const procedureJars = () => clone(shelfJars);
    const handlingChoices = () => shelfHandling.map(clone);
    const fieldsOf = reagent => (reagent && isObj(reagent.fields) ? reagent.fields : {});
    const lowerFirst = text => (/^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text);
    // A field value in the shelf's words, without the "(procedure)" mark (a value the shelf does not
    // list reads in plain units).
    function valueWords(reagent, field, value) {
      const spec = fieldsOf(reagent)[field],
        words = isObj(spec) && isObj(spec.words) ? spec.words[String(value)] : undefined;
      if (typeof words === 'string' && words.trim()) return words.replace(PROCEDURE_MARK, '');
      if (field === 'strength') return `${value}%`;
      if (field === 'minutes') return value === 0.5 ? '30 s' : `${value} min`;
      if (field === 'tempC') return `${value} °C`;
      if (field === 'drops') return `${value} drops per 50 ml`;
      if (field === 'dark') return value === false ? 'in the light' : 'in the dark';
      return String(value);
    }
    // §13.2 lab.solutionText: "20% silver nitrate · 20 min · room temperature · in the dark". A field
    // missing from the solution reads as the bottle's default; fresh / into print only when changed.
    function solutionText(solution) {
      const s = isObj(solution) ? solution : {},
        reagent = getReagent(s.reagent);
      if (!reagent) return str(s.reagent);
      const fields = fieldsOf(reagent),
        value = f => (s[f] === undefined ? fields[f].default : s[f]),
        names = [
          ...REAGENT_FIELDS.filter(f => f in fields),
          ...Object.keys(fields).filter(f => !REAGENT_FIELDS.includes(f)),
        ],
        parts = [
          fields.strength
            ? `${valueWords(reagent, 'strength', value('strength'))} ${lowerFirst(reagent.name)}`
            : reagent.name,
        ];
      for (const f of names) {
        if (f === 'strength' || (SOLUTION_QUIET.includes(f) && value(f) === fields[f].default)) continue;
        parts.push(valueWords(reagent, f, value(f)));
      }
      return parts.join(' · ');
    }
    // §13.2 lab.isProcedureSolution: the jar holds the procedure's bottle with every field at the
    // procedure's value (a field left out reads as the bottle's default).
    function isProcedureSolution(stepId, solution) {
      const jar = shelfJars[stepId],
        reagent = jar ? getReagent(jar.reagent) : undefined;
      if (!reagent || !isObj(solution) || solution.reagent !== jar.reagent) return false;
      const fields = fieldsOf(reagent);
      return Object.keys(fields).every(f => (solution[f] === undefined ? fields[f].default : solution[f]) === jar[f]);
    }
    // Every field of the bottle present (missing: its default); `invalid` lists the fields whose value
    // is not on the shelf's list (currently unknown; the model reads the default for them).
    function normalSolution(reagent, solution) {
      const out = { reagent: reagent.id },
        invalid = [];
      for (const [field, spec] of Object.entries(fieldsOf(reagent))) {
        const v = solution[field];
        out[field] = v === undefined ? spec.default : clone(v);
        if (v !== undefined && !(Array.isArray(spec.values) && spec.values.includes(v))) invalid.push(field);
      }
      return { solution: out, invalid };
    }
    // The four handling choices, each at the dip's value or the procedure's default.
    function normalHandling(handling) {
      const out = {};
      for (const choice of shelfHandling) {
        const v = isObj(handling) ? handling[choice.id] : undefined;
        out[choice.id] = (choice.values || []).some(x => x.id === v) ? v : choice.default;
      }
      return out;
    }
    // §13.2 tier 3: a known bottle's fields mapped to the step's RunParams and to the dip's facts
    // (`dip.*` for the rules; only the true ones are kept, so a step event and a default dip read alike).
    function mapDip(reagent, solution, invalid, run) {
      const fields = fieldsOf(reagent),
        val = f => (!fields[f] ? undefined : invalid.includes(f) ? fields[f].default : solution[f]),
        def = f => (fields[f] ? fields[f].default : undefined),
        order = (v, d, below, at, above) => (v < d ? below : v > d ? above : at);
      if (reagent.id === 'dewax-series') return { params: {}, facts: { shortXylene: val('minutes') < def('minutes') } };
      if (reagent.id === 'silver-nitrate') {
        // A bath off room temperature stays on the run's record (R-temp-01 reads it at resolve).
        const before = getPath(run.effectiveParams, 'silver-impregnation.impregnation.temperature') === 'deviated';
        return {
          params: {
            impregnation: {
              endpoint: order(val('minutes'), def('minutes'), 'early', 'sop-default', 'extended'),
              temperature: before || solution.tempC !== def('tempC') ? 'deviated' : 'sop-default',
            },
          },
          facts: { oldSilver: val('fresh') === 'old' },
        };
      }
      if (reagent.id === 'ammoniacal-silver')
        return {
          params: {
            ammoniacal: {
              endpoint: val('minutes') < def('minutes') ? 'early' : 'sop-default',
              ammonia: val('ammonia') === undefined ? DEFAULT_PARAMS.ammoniacal.ammonia : val('ammonia'),
            },
          },
          facts: { longAmmoniacal: val('minutes') > def('minutes') },
        };
      if (reagent.id === 'developer') {
        const minutes = val('minutes'),
          drops = val('drops');
        return {
          params: {
            development: {
              endpoint:
                minutes < DEVELOPER_MINUTES.earlyBelow
                  ? 'early'
                  : minutes > DEVELOPER_MINUTES.extendedAbove
                    ? 'extended'
                    : 'sop-default',
              strength: order(drops, def('drops'), 'weak', 'sop-default', 'strong'),
            },
          },
          facts: {
            tooWarm: val('tempC') > def('tempC'),
            pastTen: minutes > DEVELOPER_MINUTES.pastTenAbove,
            tooMuch: drops > def('drops'),
          },
        };
      }
      return { params: {}, facts: {} };
    }
    // §13.2 tier 2: the fields of a known bottle that no source here describes, each with its sentence.
    function partlyUnknown(reagent, solution, invalid) {
      const table = Object.prototype.hasOwnProperty.call(UNKNOWN_WHEN, reagent.id) ? UNKNOWN_WHEN[reagent.id] : null,
        fields = fieldsOf(reagent),
        name = lowerFirst(reagent.name),
        out = [];
      for (const field of Object.keys(fields)) {
        const value = solution[field],
          test = table ? table[field] : 'changed',
          unknown =
            invalid.includes(field) ||
            (test === 'changed' && value !== fields[field].default) ||
            (typeof test === 'function' && test(value, fields[field].default));
        if (!unknown) continue;
        const words = valueWords(reagent, field, value),
          phrase =
            field === 'strength' || field === 'tempC'
              ? `${words} ${name}`
              : field === 'dark'
                ? `${name} ${words}`
                : `${words} in ${name}`,
          note = ((UNKNOWN_NOTES[reagent.id] || {})[field] || {})[String(value)] || null;
        out.push({
          field,
          value: clone(value),
          text: `Currently unknown: what ${phrase} changes; the drawing shows the procedure's effect.${note && note.text ? ` ${note.text}` : ''}`,
          claims: note ? note.claims.filter(id => getClaim(id)) : [],
        });
      }
      return out;
    }
    // A dip (§13.2). Practice and compare-only runs record 'not-runnable' and change nothing. A free
    // run: a sealed slide is sealed for every bottle; a bottle that runs a procedure step runs it like a
    // step event (repeat, effective params from its fields, stepsDone) through the same rules, with the
    // dip's facts; a bottle with no step (or a dip no rule describes) whose rules give no reaction is
    // currently unknown and leaves the run as it was, bar the event and the unknown-dip record.
    function applyDip(run, next, event, free, fired) {
      const solution = isObj(event.solution) ? event.solution : {},
        reagent = getReagent(solution.reagent),
        jarId = typeof event.jarId === 'string' ? event.jarId : null,
        step = reagent && STEPS.includes(reagent.step) ? reagent.step : null;
      if (!free || isCompareOnly(getMethod(run.method))) {
        next.deviations.push({ seq: event.seq, kind: 'not-runnable', step, jarId });
        return null;
      }
      const normal = reagent ? normalSolution(reagent, solution) : { solution: clone(solution), invalid: [] },
        sealed = next.slide.coverslipped === true,
        // The developer in a fresh jar (any `into` but the procedure's) is a different reaction.
        whole = !reagent || (isObj(fieldsOf(reagent).into) && normal.solution.into !== fieldsOf(reagent).into.default),
        runsStep = !!step && !whole,
        mapped =
          runsStep && !sealed ? mapDip(reagent, normal.solution, normal.invalid, next) : { params: {}, facts: {} };
      if (runsStep) {
        if (next.stepsDone.includes(step)) next.deviations.push({ seq: event.seq, kind: 'repeated', step });
        // On a sealed slide nothing reaches the section: the step's earlier record stays.
        if (!sealed || !isObj(next.effectiveParams[step]))
          next.effectiveParams[step] = deepMerge(next.params, mapped.params);
        if (!next.stepsDone.includes(step)) next.stepsDone.push(step);
      }
      const facts = Object.fromEntries(Object.entries(mapped.facts).filter(([, v]) => v === true)),
        dip = {
          reagent: reagent ? reagent.id : str(solution.reagent),
          jarId,
          handling: normalHandling(event.handling),
          ...(runsStep && SILVER_STEPS.includes(step) ? { silver: true } : {}),
          ...facts,
        },
        parts = runStepRules(
          next,
          context(next, { step: runsStep ? step : undefined, event: 'dip', dip }),
          true,
          fired
        );
      let reaction;
      // A bottle off the shelf or a developer in a fresh jar is currently unknown unless sealed.
      if (!runsStep && (!parts.primary || (whole && parts.primary.kind !== 'sealed'))) {
        // Tier 1: whole dip currently unknown. Nothing on the slide changes and no rule is listed.
        next.state = clone(run.state);
        next.slide = runSlide(run);
        next.rulesApplied = [...run.rulesApplied];
        fired.length = 0;
        const text = solutionText(normal.solution) || 'this bottle',
          why = reagent ? str(reagent.unknownWhy) || UNKNOWN_FALLBACK_WHY : UNKNOWN_NO_SHELF;
        reaction = {
          seq: event.seq,
          step,
          kind: 'unknown',
          text: `${UNKNOWN_LABEL}: ${lowerFirst(text)} on this slide.`,
          why: `${why} ${UNKNOWN_LIBRARY}`,
          rules: [],
          claims: [],
          look: lookOf(next).key,
          jarId,
          reagent: dip.reagent,
          unknown: [{ field: 'reagent', value: dip.reagent }],
        };
        next.unknownDips.push({ seq: event.seq, jarId, solution: clone(normal.solution) });
      } else {
        reaction = composeReaction(event, step, parts, fired, lookOf(next).key);
        // Tier 2: a field no source describes adds its sentence (never on a sealed slide: nothing
        // reached the section).
        const unknown =
          reaction.kind === 'sealed' || !reagent ? [] : partlyUnknown(reagent, normal.solution, normal.invalid);
        reaction.text = [reaction.text, ...unknown.map(u => u.text)].join(' ');
        reaction.claims = uniq([...reaction.claims, ...unknown.flatMap(u => u.claims)]);
        reaction.jarId = jarId;
        reaction.reagent = dip.reagent;
        reaction.unknown = unknown.map(({ field, value, text }) => ({ field, value, text }));
      }
      next.reactions.push(reaction);
      return reaction;
    }

    function replay(run) {
      const frames = [];
      let current = createRun({
        id: run.id,
        specimenId: run.specimenId,
        method: run.method,
        params: run.baseParams || run.params,
        label: run.label,
        mode: runMode(run),
      });
      const events = [...(run.events || [])].sort((a, b) => (a.seq || 0) - (b.seq || 0));
      for (const event of events) {
        const applied = applyEventWith(current, event);
        current = applied.run;
        const look = lookOf(current);
        frames.push({
          seq: event.seq,
          event: clone(event),
          stepsDone: [...current.stepsDone],
          state: clone(current.state),
          rulesFired: [...applied.fired],
          deviationsSoFar: current.deviations.map(clone),
          reaction: applied.reaction ? clone(applied.reaction) : null,
          slide: clone(current.slide),
          look: look ? look.key : null,
        });
      }
      return frames;
    }

    // §2.1 / §2.2 resolve. `opts.hypothesis` restricts R-hyp rules to one hypothesis (reveal).
    // §11.3: a free run (any runnable method) always resolves to an Outcome: no step is required, a
    // setting with no rule is listed in `gaps`, and the flags toning / thiosulfate are not read.
    function resolveWith(run, opts = {}) {
      const specimen = getSpecimen(run.specimenId),
        method = getMethod(run.method),
        compareOnly = isCompareOnly(method),
        mode = runMode(run),
        free = mode === 'free' && !compareOnly,
        view = effectiveView(run),
        gaps = {
          'specimen-unknown': [],
          'method-unknown': [],
          'step-skipped': [],
          'hypothesis-unencoded': [],
          'param-uncovered': [],
        },
        needed = [];
      if (!specimen) {
        gaps['specimen-unknown'].push('specimenId');
        needed.push(`a registered specimen (${JSON.stringify(run.specimenId)} is not in specimens.json)`);
      }
      if (!method) {
        gaps['method-unknown'].push('method');
        needed.push(`a registered method (${JSON.stringify(run.method)} is not in methods.json)`);
      }
      const notDone = method && !compareOnly ? methodSteps(method).filter(s => !run.stepsDone.includes(s)) : [],
        skipped =
          free || !method || compareOnly ? [] : plannedSteps(method, view).filter(s => !run.stepsDone.includes(s));
      for (const s of skipped) {
        gaps['step-skipped'].push(s);
        needed.push(`a step event for ${s}`);
      }
      const deviations = [...run.deviations, ...skipped.map(s => ({ seq: null, kind: 'skipped', step: s }))];
      const ctx = context(run, { params: view, deviations });
      const state = clone(run.state),
        slide = runSlide(run),
        acc = newAcc(),
        fired = [...run.rulesApplied];
      // §2.2 rule 11: a compare-only run is schematized by its method's outcomeRule alone. The
      // Bielschowsky resolve-time rules (R-temp-01, R-norm-01, R-order-01) never fire on it; a
      // param they would have read falls through to the coverage check instead.
      const applicable =
        compareOnly && method.outcomeRule ? resolveRules.filter(rule => rule.id === method.outcomeRule) : resolveRules;
      for (const rule of applicable) {
        if (isHypothesisRule(rule) && opts.hypothesis && rule.conditionalOn !== opts.hypothesis) continue;
        if (!matches(rule.when, ctx)) continue;
        applyEffects(rule, state, acc, ctx, slide);
        // Attribution comes from the rule's own conditionalOn (lint-checked); the 'conditional' op is optional.
        if (isHypothesisRule(rule) && HYPOTHESES.includes(rule.conditionalOn)) acc.conditionalOn = rule.conditionalOn;
        if (!fired.includes(rule.id)) fired.push(rule.id);
      }
      for (const id of acc.flags) slide[id] = true;
      const firedRules = fired.map(getRule).filter(Boolean);
      const probe = view.pretreatment;
      if (!free && probe !== 'none' && !firedRules.some(isHypothesisRule)) {
        gaps['hypothesis-unencoded'].push('pretreatment');
        needed.push(
          'instructor guidance on which pretreatment probes which hypothesis, and the direction each hypothesis predicts'
        );
      }
      // Coverage (§2.1). A skip flag that is false and read by no fired rule (content without
      // R-model-10) is still a gap, with ENGINE-14's words.
      const read = new Set(firedRules.flatMap(rulePaths));
      let freeGaps = [];
      if (free) freeGaps = settingGaps(view);
      else
        for (const [path, value] of leaves(view)) {
          if (COVERAGE_EXEMPT.includes(path.split('.')[0])) continue;
          if (skipFlag(path) && value !== false) continue;
          if (value === 'unspecified' || (value !== getPath(DEFAULT_PARAMS, path) && !read.has(path))) {
            gaps['param-uncovered'].push(path);
            needed.push(
              skipFlag(path)
                ? `a sourced rule for what ${skipFlag(path).words} does in this protocol (the course procedure gives the step, not its effect on the picture)`
                : `a sourced rule for ${path}=${value}`
            );
          }
        }
      const code = CARD_PRECEDENCE.find(k => gaps[k].length);
      const base = { runId: run.id, specimenId: run.specimenId, method: run.method };
      if (code) {
        const explain = {
          'specimen-unknown': () =>
            `Specimen ${JSON.stringify(run.specimenId)} is not in the registry; the model has no lesion map to stain.`,
          'method-unknown': () =>
            `Method ${JSON.stringify(run.method)} is not in the registry; no rule base exists for it.`,
          'step-skipped': () =>
            `The run has no step event for ${skipped.join(', ')}; the model only resolves a complete run of the method.`,
          'hypothesis-unencoded': () =>
            `Pretreatment ${JSON.stringify(probe)} probes a mechanism, but no rule encodes which hypothesis it tests or what direction each hypothesis predicts; the model cannot say what it does.`,
          'param-uncovered': () =>
            gaps['param-uncovered']
              .map(p =>
                skipFlag(p)
                  ? `No sourced rule covers skipping ${skipFlag(p).words}, so the model cannot say what that changes.`
                  : `No sourced rule covers ${p} = ${getPath(view, p)}; the model cannot say what this change does.`
              )
              .join(' '),
        };
        return {
          label: LABELS.NO_BASIS,
          ...base,
          code,
          outsideSupport: CARD_PRECEDENCE.flatMap(k => gaps[k]),
          explanation: explain[code](),
          whatWouldBeNeeded: uniq(needed),
          suggestedNext: uniq([
            ...(skipped.length ? ['perform the missing step and resolve again'] : []),
            'write the predictions for all three outcome classes',
            'design the control that would distinguish the hypotheses',
          ]),
          hypotheses: code === 'hypothesis-unencoded' ? [...HYPOTHESES] : null,
          rulesConsulted: fired,
        };
      }
      const caveats = uniq(
        firedRules.flatMap(rule =>
          (rule.effect || [])
            .filter(op => op.op === 'caveat' && !(isObj(op.when) && !matches(op.when, ctx)))
            .map(op => op.text)
        )
      );
      const claimsOut = uniq(firedRules.flatMap(rule => rule.claims || []));
      // Artifacts: every artifact op of a step rule that fired on the run (they stay set) plus the
      // resolve-time ones.
      const artifacts = uniq([...runArtifacts(run), ...acc.artifacts]);
      let outState, perSite, background;
      if (compareOnly && acc.schematic) {
        background = clamp(acc.schematic.background, 0, 4);
        perSite = Object.fromEntries(
          SITE_CLASSES.map(site => [
            site,
            { visibility: site === 'background' ? background : clamp(acc.schematic.perSite[site] || 0, 0, 4) },
          ])
        );
        outState = Object.fromEntries(
          SITE_CLASSES.map(site => [
            site,
            { ionicBound: null, nuclei: null, deposit: perSite[site].visibility, ratePhase: 'unknown' },
          ])
        );
      } else {
        outState = state;
        background = state.background.deposit;
        perSite = Object.fromEntries(SITE_CLASSES.map(site => [site, { visibility: state[site].deposit }]));
      }
      const contrast = clamp(Math.max(...TARGET_SITES.map(site => perSite[site].visibility)) - background, 0, 4);
      const key = compareOnly ? null : lookKey(outState, slide, artifacts, acc.look || lookThresholds());
      return {
        label: LABELS.SYNTHETIC,
        ...base,
        mode,
        state: outState,
        perSite,
        contrast,
        background,
        confidence: acc.confidence === 'low' ? 'low' : 'nominal',
        artifacts,
        conditionalOn: acc.conditionalOn,
        rulesApplied: fired,
        claims: claimsOut,
        caveats: uniq(caveats),
        deviations: run.deviations.map(clone),
        look: key ? { key, text: LOOK_TEXT[key] } : null,
        tone: slide.toned ? 'gold' : 'silver',
        slide: Object.fromEntries(SLIDE_OUT.map(k => [k, !!slide[k]])),
        ...(free
          ? {
              reactions: runReactions(run).map(clone),
              gaps: freeGaps,
              stepsNotDone: notDone,
              // §13.2: the dips left out of the drawing, and every field the drawing read as the
              // procedure's because no source describes it.
              unknownDips: runUnknownDips(run).map(clone),
              unknownFields: unknownFieldsOf(run),
            }
          : {}),
      };
    }
    const unknownFieldsOf = run =>
      runReactions(run)
        .filter(r => r && r.kind !== 'unknown' && Array.isArray(r.unknown))
        .flatMap(r =>
          r.unknown.map(u => ({
            seq: r.seq,
            jarId: r.jarId === undefined ? null : r.jarId,
            reagent: r.reagent,
            field: u.field,
            value: clone(u.value),
            text: u.text,
          }))
        );
    const resolve = run => resolveWith(run);
    // §11.3: a free run's settings with no rule. A leaf is a gap when it is 'unspecified', a
    // pretreatment other than none, or differs from its default and no rule that can fire on a
    // free run reads it (toning / thiosulfate are not settings of a free run).
    const freeReaders = new Set(
      rules.filter(rule => !rule.informational && ruleInMode(rule, 'free')).flatMap(rulePaths)
    );
    function settingGaps(view) {
      const out = [];
      for (const [path, value] of leaves(view)) {
        if (skipFlag(path)) continue;
        const gap =
          path === 'pretreatment'
            ? value !== 'none'
            : value === 'unspecified' || (value !== getPath(DEFAULT_PARAMS, path) && !freeReaders.has(path));
        if (gap) out.push({ path, value, text: `No rule for ${path} = ${value}: the picture leaves it out.` });
      }
      return out;
    }

    function compare(baselineRun, experimentalRun) {
      const baseline = resolve(baselineRun),
        experimental = resolve(experimentalRun),
        changedParams = leaves(effectiveView(baselineRun))
          .filter(([path, value]) => value !== getPath(effectiveView(experimentalRun), path))
          .map(([path]) => path);
      if (baselineRun.specimenId !== experimentalRun.specimenId) changedParams.push('specimenId');
      if (baselineRun.method !== experimentalRun.method) changedParams.push('method');
      const sideRules = out => out.rulesApplied || out.rulesConsulted || [];
      const onlyOneSide = [...sideRules(baseline), ...sideRules(experimental)].filter(
        id => sideRules(baseline).includes(id) !== sideRules(experimental).includes(id)
      );
      // Both conditions are independent: a cross-method pair whose CPS side is a card still gets the
      // §2 cross-method rules and caveat (a per-side rule diff is meaningless across methods).
      const cardSide = baseline.label === LABELS.NO_BASIS || experimental.label === LABELS.NO_BASIS,
        crossMethod = baselineRun.method !== experimentalRun.method;
      if (cardSide || crossMethod) {
        const caveats = [];
        if (crossMethod) {
          for (const id of CROSS_METHOD_RULES) {
            const rule = getRule(id);
            if (rule) caveats.push(...(rule.effect || []).filter(op => op.op === 'caveat').map(op => op.text));
          }
          caveats.push(CROSS_METHOD_CAVEAT);
        }
        if (cardSide)
          for (const side of [baseline, experimental])
            if (side.label === LABELS.NO_BASIS)
              caveats.push(
                `Run ${side.runId} resolved to an uncertainty card (${side.code}); per-site differences are not computed. ${side.explanation}`
              );
        return {
          label: LABELS.NO_BASIS,
          baseline,
          experimental,
          changedParams: uniq(changedParams),
          perSite: null,
          rulesResponsible: crossMethod ? [...CROSS_METHOD_RULES] : uniq(onlyOneSide),
          caveats: uniq(caveats),
        };
      }
      const readers = rules
        .filter(
          rule =>
            !rule.informational &&
            ruleInMode(rule, runMode(baselineRun)) &&
            rulePaths(rule).some(p => changedParams.includes(p))
        )
        .map(rule => rule.id);
      const perSite = Object.fromEntries(
        SITE_CLASSES.map(site => {
          const b = baseline.perSite[site].visibility,
            e = experimental.perSite[site].visibility;
          return [site, { baseline: b, experimental: e, delta: e - b }];
        })
      );
      const caveats = uniq([...baseline.caveats, ...experimental.caveats]);
      if (!changedParams.length) caveats.push('No parameter, specimen or method differs between the two runs.');
      return {
        label: LABELS.SYNTHETIC,
        baseline,
        experimental,
        changedParams: uniq(changedParams),
        perSite,
        rulesResponsible: uniq([...onlyOneSide, ...readers]),
        caveats,
      };
    }

    // Shape-only curves (§2). Fixed indices; the rate maximum is never at the sop-default index.
    const CURVE_INDEX = Object.freeze({ early: 3, 'sop-default': 5, extended: 8 });
    const CURVE_BINDING = [0, 2, 3, 4, 4, 4, 4, 4, 4, 4, 4];
    const CURVE_ACCUMULATED = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4];
    const CURVE_RATE = [0, 1, 2, 3, 3, 3, 4, 3, 2, 1, 0];
    function schematicCurves(run) {
      const endpoint = (effectiveView(run).development || {}).endpoint,
        kinetics = getRule('R-kinetics-01'),
        binding = getRule('R-model-01'),
        caveats = uniq(
          [binding, kinetics].flatMap(rule =>
            rule ? (rule.effect || []).filter(op => op.op === 'caveat').map(op => op.text) : []
          )
        );
      return {
        label: LABELS.SYNTHETIC,
        basis: 'schematic-analogy',
        system: CURVE_SYSTEM,
        claims: ['C-gallyas-1979-separable', 'C-brief-binding-not-development'],
        rulesApplied: ['R-kinetics-01'],
        note: CURVE_NOTE,
        points: CURVE_BINDING.map((b, t) => ({
          t,
          binding: b,
          accumulated: CURVE_ACCUMULATED[t],
          rate: CURVE_RATE[t],
        })),
        endpointIndex: CURVE_INDEX[endpoint] === undefined ? -1 : CURVE_INDEX[endpoint],
        caveats,
      };
    }

    // ---- experiments (§2, §4) --------------------------------------------------------------
    const filled = x => (Array.isArray(x) ? x.length > 0 : typeof x === 'string' ? x.trim().length > 0 : x != null);
    const TEXT_FIELDS = [
      'title',
      'background',
      'question',
      'hypothesis',
      'alternative',
      'independentVariable',
      'limitations',
    ];
    function checkExperiment(exp) {
      const e = isObj(exp) ? exp : {},
        predictions = isObj(e.predictions) ? e.predictions : {},
        missing = [],
        warnings = [];
      for (const field of TEXT_FIELDS) if (!filled(e[field])) missing.push(field);
      for (const field of ['measures', 'heldComparable', 'changed', 'controls'])
        if (!filled(e[field])) missing.push(field);
      for (const field of ['expected', 'negligible', 'opposite'])
        if (!filled(predictions[field])) missing.push(`predictions.${field}`);
      for (const field of ['baselineRunId', 'experimentalRunId']) if (!filled(e[field])) missing.push(field);
      const changed = Array.isArray(e.changed) ? e.changed : [],
        held = Array.isArray(e.heldComparable) ? e.heldComparable : [],
        overlaps = changed.filter(x => held.includes(x));
      if (filled(e.independentVariable) && changed.length && !changed.includes(e.independentVariable))
        warnings.push('independentVariable is not listed under changed');
      for (const m of Array.isArray(e.measures) ? e.measures : [])
        if (!measurements.some(x => x.id === m))
          warnings.push(`measure ${JSON.stringify(m)} is not a measurement rule id`);
      for (const control of Array.isArray(e.controls) ? e.controls : [])
        if (!isObj(control) || !filled(control.addresses))
          warnings.push('a control does not say which alternative explanation it addresses');
      return { complete: missing.length === 0 && overlaps.length === 0, missing, overlaps: uniq(overlaps), warnings };
    }
    function canReveal(exp, runsById) {
      const e = isObj(exp) ? exp : {},
        runs = isObj(runsById) ? runsById : {},
        predictions = isObj(e.predictions) ? e.predictions : {},
        reasons = [];
      for (const field of ['expected', 'negligible', 'opposite'])
        if (!filled(predictions[field])) reasons.push(`predictions.${field} is empty`);
      if (!filled(e.controls)) reasons.push('no control is specified');
      if (!filled(e.independentVariable)) reasons.push('independentVariable is empty');
      if (!filled(e.measures)) reasons.push('no outcome measure is chosen');
      for (const field of ['baselineRunId', 'experimentalRunId']) {
        const run = runs[e[field]];
        if (!run) reasons.push(`${field} does not name a run`);
        else if (!(run.events || []).some(ev => ev && ev.type === 'step'))
          reasons.push(`${field} (${run.id}) has no step event`);
      }
      return { ok: reasons.length === 0, reasons };
    }
    const PROMPTS = Object.freeze({
      supports: 'What would this outcome support?',
      failsToEstablish: 'What would it fail to establish?',
      next: 'What experiment would be informative next?',
    });
    function hypothesisCard(run, hypothesis, probe) {
      return {
        label: LABELS.NO_BASIS,
        runId: run.id,
        specimenId: run.specimenId,
        method: run.method,
        code: 'hypothesis-unencoded',
        outsideSupport: ['pretreatment'],
        explanation: `No rule encodes what "${HYPOTHESIS_TEXT[hypothesis]}" predicts for pretreatment ${JSON.stringify(probe)}; no direction is encoded.`,
        whatWouldBeNeeded: [
          'instructor guidance on which pretreatment probes which hypothesis, and the direction each hypothesis predicts',
        ],
        suggestedNext: [
          'write the predictions for all three outcome classes',
          'design the control that would distinguish the hypotheses',
        ],
        hypotheses: [...HYPOTHESES],
        rulesConsulted: [],
      };
    }
    function reveal(exp, runsById) {
      const gate = canReveal(exp, runsById);
      if (!gate.ok) return { ok: false, reasons: gate.reasons };
      const baselineRun = runsById[exp.baselineRunId],
        experimentalRun = runsById[exp.experimentalRunId],
        comparison = compare(baselineRun, experimentalRun),
        specimen = getSpecimen(experimentalRun.specimenId),
        probe = effectiveView(experimentalRun).pretreatment,
        card = (c, conditionalOn = null) => ({
          kind: 'uncertainty',
          conditionalOn,
          title: conditionalOn
            ? `${LABEL_TEXT[LABELS.NO_BASIS]}, conditional on: ${HYPOTHESIS_TEXT[conditionalOn]}`
            : LABEL_TEXT[LABELS.NO_BASIS],
          body: describeOutcome(c, specimen),
          card: c,
          prompts: { ...PROMPTS },
        }),
        outcome = (o, conditionalOn = null) => ({
          kind: 'outcome',
          conditionalOn,
          title: conditionalOn
            ? `${LABEL_TEXT[LABELS.SYNTHETIC]}, conditional on: ${HYPOTHESIS_TEXT[conditionalOn]}`
            : LABEL_TEXT[LABELS.SYNTHETIC],
          body: describeOutcome(o, specimen),
          outcome: o,
          prompts: { ...PROMPTS },
        });
      let cards;
      const { baseline, experimental } = comparison;
      if (baseline.label === LABELS.NO_BASIS || experimental.label === LABELS.NO_BASIS)
        cards = [card(experimental.label === LABELS.NO_BASIS ? experimental : baseline)];
      else if (probe === 'none') cards = [outcome(experimental)];
      else {
        const ctx = context(experimentalRun),
          encoded = HYPOTHESES.filter(h =>
            resolveRules.some(rule => isHypothesisRule(rule) && rule.conditionalOn === h && matches(rule.when, ctx))
          );
        cards = encoded.length
          ? HYPOTHESES.map(h =>
              encoded.includes(h)
                ? outcome(resolveWith(experimentalRun, { hypothesis: h }), h)
                : card(hypothesisCard(experimentalRun, h, probe), h)
            )
          : [card(hypothesisCard(experimentalRun, null, probe))];
        if (!encoded.length) {
          cards[0].card.explanation = `Pretreatment ${JSON.stringify(probe)} probes a mechanism, but no rule encodes which of the four hypotheses it tests or what direction any of them predicts; no direction is encoded.`;
          cards[0].body = describeOutcome(cards[0].card, specimen);
        }
      }
      return { ok: true, label: comparison.label, comparison, cards };
    }
    const measurementRules = () =>
      measurements.map(m => ({ id: m.id, title: m.title, rule: m.rule, unit: m.unit, manual: !!m.manual }));

    // ---- text alternative (§2) -------------------------------------------------------------
    function describeOutcome(out) {
      if (!isObj(out)) return '';
      if (out.label === LABELS.NO_BASIS) {
        const list = x => (Array.isArray(x) && x.length ? x.join('; ') : 'none');
        return `${LABEL_TEXT[LABELS.NO_BASIS]}. ${str(out.explanation)} Outside support: ${Array.isArray(out.outsideSupport) && out.outsideSupport.length ? out.outsideSupport.join(', ') : 'none'}. What would be needed: ${list(out.whatWouldBeNeeded)}. Suggested next: ${list(out.suggestedNext)}.`;
      }
      const compareOnly = isCompareOnly(getMethod(out.method)),
        word = compareOnly ? 'visibility' : 'deposit',
        sites = TARGET_SITES.map(site => {
          const n = out.perSite && out.perSite[site] ? out.perSite[site].visibility : 0;
          return `${SITE_TEXT[site]}: ${ordinalWord(n)} (${word}, schematic ordinal ${n} of 4).`;
        });
      return [
        `${LABEL_TEXT[out.label] || out.label}.`,
        ...sites,
        `Background: ${ordinalWord(out.background)}.`,
        `Contrast: ${ordinalWord(out.contrast)}.`,
        `Artifacts: ${Array.isArray(out.artifacts) && out.artifacts.length ? out.artifacts.join(', ') : 'none'}.`,
        `Conditional on: ${out.conditionalOn ? HYPOTHESIS_TEXT[out.conditionalOn] || out.conditionalOn : 'none'}.`,
        `Caveats: ${Array.isArray(out.caveats) && out.caveats.length ? out.caveats.join(' ') : 'none'}`,
      ].join(' ');
    }

    // ---- lookups (§2) ----------------------------------------------------------------------
    const sourceRef = id => {
      const s = getSource(id);
      return s
        ? { id: s.id, citation: s.citation, url: s.url, rights: s.rights }
        : { id, citation: null, url: null, rights: null };
    };
    // MODE-FIX-integrate-1: `mode` ('practice' default, or 'free') picks the model the card describes.
    // Practice: the rules that fire on a standard complete run. Free: every reaction rule that fires at
    // this step, each branch by its title (the free rules branch on the slide's state, so a sheet
    // opened on the free bench lists what the jar can do: "the wax leaves…; nothing left to remove").
    function explainStep(stepId, methodId = 'bielschowsky-modified', mode = 'practice') {
      const method = getMethod(methodId),
        step = method && Array.isArray(method.steps) ? method.steps.find(s => s.id === stepId) : undefined;
      if (!step) return undefined;
      const free = mode === 'free',
        purpose = step.purpose || {
          text: 'Purpose text not yet sourced.',
          basis: 'placeholder',
          claims: [],
        },
        claimIds = purpose.claims || [],
        // The card describes the procedure (practice) model on a standard complete run: every step
        // done, silver bound and reduced, so a rule gated on the slide's state can be named.
        cardCtx = {
          step: stepId,
          stepsDone: STEPS,
          deviationKinds: [],
          params: DEFAULT_PARAMS,
          mode: free ? 'free' : 'practice',
          slide: { ...INITIAL_SLIDE, wax: false, primed: true },
          silver: { maxBound: 4, maxDeposit: 4, background: 1 },
        },
        practiceRules = stepRules.filter(rule => ruleInMode(rule, free ? 'free' : 'practice')),
        modelRules = practiceRules.filter(rule =>
          free
            ? fireSteps(rule.when).includes(stepId)
            : whenSteps(rule.when).includes(stepId) && hasPredicate(rule.when, 'step') && matches(rule.when, cardCtx)
        ),
        // Step rules that fire elsewhere but read a param this step's card sets (impregnation.* is
        // chosen at silver-impregnation and read by R-model-01 at ammoniacal-silver): the student
        // reads this card before choosing, so the rule is named here with where it applies.
        group = STEP_GROUP[stepId],
        inGroup = p => p.split('.')[0] === group,
        readers = group
          ? practiceRules.filter(rule => !modelRules.includes(rule) && rulePaths(rule).some(inGroup))
          : [],
        effects = [
          ...modelRules.map(rule => `${rule.title} (${rule.id})`),
          ...readers.map(
            rule =>
              `${rule.title} (${rule.id}; reads ${rulePaths(rule).filter(inGroup).join(', ')}, applied at the ${uniq(fireSteps(rule.when)).join(' / ')} step)`
          ),
        ],
        hazardList = (step.hazards || [])
          .map(getHazard)
          .filter(Boolean)
          .map(h => ({ id: h.id, title: h.title, text: h.text, sourceId: h.sourceId }));
      return {
        step: stepId,
        title: step.title,
        purpose: { text: purpose.text, basis: purpose.basis, claims: [...claimIds] },
        quantities: clone(step.quantities || {}),
        modelEffect: effects.length ? effects.join('; ') : 'No modeled effect (no sourced rule)',
        hazards: hazardList,
        sources: uniq([
          ...claimIds.flatMap(id => (getClaim(id) ? getClaim(id).sources : [])),
          ...(method.sources || []),
        ]).map(sourceRef),
      };
    }
    const listStations = () => stations.map(clone);
    const listSpecimens = () => [...specimens.values()];
    const listModules = () => [...modules.values()];
    const getModule = id => modules.get(id);
    // §7: the frozen tissue clip data when the content carried clip.json, else null (the shell may load it later).
    const getClip = () => content.clip || null;

    // ---- notebook (§2.3) and export (§5) ---------------------------------------------------
    const newNotebook = () => ({ v: 1, entries: [] });
    function addEntry(notebook, entry, runsById) {
      const e = isObj(entry) ? entry : {};
      if (!ENTRY_TYPES.includes(e.type)) throw new Error(`entry.type must be one of ${ENTRY_TYPES.join(', ')}`);
      if (!SECTIONS.includes(e.section)) throw new Error(`entry.section must be one of ${SECTIONS.join(', ')}`);
      if (typeof e.text !== 'string') throw new Error('entry.text must be a string');
      if (e.label === LABELS.VALIDATED) throw new Error('entry.label: that label has zero members in v1');
      if (e.type === 'published') {
        if (!getClaim(e.claimId)) throw new Error(`entry.claimId ${JSON.stringify(e.claimId)} is not in claims.json`);
      } else if (e.type === 'simulated') {
        if (typeof e.runId !== 'string') throw new Error('entry.runId is required for a simulated entry');
        if (![LABELS.SYNTHETIC, LABELS.NO_BASIS].includes(e.label))
          throw new Error('entry.label must be illustrative-synthetic or no-basis');
        if (isObj(runsById)) {
          const run = runsById[e.runId];
          if (!run) throw new Error(`entry.runId ${JSON.stringify(e.runId)} is not a known run`);
          if (resolve(run).label !== e.label)
            throw new Error('entry.label does not match the resolved label of entry.runId');
        }
      } else if (e.type === 'observed') {
        if (e.runId !== undefined) throw new Error('entry.runId is not allowed on an observed entry');
        if (!(typeof e.assetId === 'string' || e.assetId === null))
          throw new Error('entry.assetId must be a string or null');
        if (typeof e.observedAt !== 'string' || !e.observedAt) throw new Error('entry.observedAt is required');
      } else {
        for (const field of ['claimId', 'runId', 'label', 'assetId'])
          if (e[field] !== undefined) throw new Error(`entry.${field} is not allowed on a reflection`);
      }
      const base = isObj(notebook) ? notebook : newNotebook();
      return { v: 1, entries: [...(base.entries || []).map(clone), clone(e)] };
    }
    // ENGINE-13: the instructors' line for a claim, with every id and the strength code ("Model
    // sources" under "Model detail (for instructors)"); the student part never prints these.
    function claimLine(id) {
      const claim = getClaim(id);
      if (!claim) return `${id}: (claim not in registry)`;
      const refs = (claim.sources || [])
        .map(sourceRef)
        .map(s => `${s.id}${s.citation ? ` ${s.citation}` : ''}${s.url ? ` <${s.url}>` : ''}`);
      return `${claim.id}: "${claim.text}" (${claim.strength}). Sources: ${refs.join(' | ') || 'none'}`;
    }
    // ENGINE-10 / ENGINE-11: a caller's formatter text replaces the default words only when it is a
    // non-blank one-line string that never names the reserved label and never says "result" without
    // "simulated" (test 13's check); otherwise (a throw included), or when an argument names the
    // reserved label, the default text stays. Formatters get copies, so they cannot change what is
    // resolved after them.
    const reserved = x =>
      [LABELS.VALIDATED, LABEL_TEXT[LABELS.VALIDATED]].some(s =>
        String(JSON.stringify(x)).toLowerCase().includes(s.toLowerCase())
      );
    function formatted(fn, args, fallback) {
      if (typeof fn !== 'function' || reserved(args)) return fallback;
      let text;
      try {
        text = fn(...args.map(clone));
      } catch {
        return fallback;
      }
      return typeof text === 'string' &&
        text.trim() &&
        !/[\r\n]/.test(text) &&
        !reserved(text) &&
        !/\bresults?\b/i.test(text.replace(/simulated results?/gi, ''))
        ? text
        : fallback;
    }
    // ENGINE-11 / MODE-engine-1: toning and thiosulfate print on their own lines, in the course
    // procedure's words for what each does (R-model-08 / 09) or what skipping it leaves (R-model-10).
    const RECORD_ONLY = Object.freeze(['toning', 'thiosulfate']);
    const SEALED_RUN_TEXT = 'Sealed until this experiment is revealed.';
    const flagLines = (run, out, view) => {
      const free = runMode(run) === 'free',
        slide = out && isObj(out.slide) ? out.slide : null,
        toned = free ? !!(slide && slide.toned) : view.toning !== false,
        fixed = free ? !!(slide && slide.fixed) : view.thiosulfate !== false,
        word = yes => (free ? (yes ? 'done' : 'not done') : yes ? 'performed' : 'skipped');
      if (toned && fixed && !free)
        return [`- Toning and thiosulfate: performed (${TONING_TEXT.performed}; ${THIOSULFATE_TEXT.performed})`];
      return [
        `- Gold toning: ${word(toned)} (${toned ? TONING_TEXT.performed : TONING_TEXT.skipped})`,
        `- Thiosulfate: ${word(fixed)} (${fixed ? THIOSULFATE_TEXT.performed : THIOSULFATE_TEXT.skipped})`,
      ];
    };
    // ENGINE-14: an ordinal measurement value (an integer 0..4, or its digit as text), else null.
    const ordinalOf = v => {
      const n = typeof v === 'number' ? v : typeof v === 'string' && /^\s*\d\s*$/.test(v) ? Number(v) : NaN;
      return Number.isInteger(n) && n >= 0 && n <= 4 ? n : null;
    };
    // ENGINE-13: the experiment block's field names are the designer's own (lab-notebook.js FIELD_TEXT,
    // wizard steps 1-4), so the file reads with the words the student wrote under.
    const FIELD = Object.freeze({
      status: 'Status',
      background: 'Background',
      question: 'Your question',
      hypothesis: 'Your hypothesis',
      alternative: 'Another explanation',
      changed: 'What you change',
      independentVariable: 'Main variable (the one you test)',
      heldComparable: 'What you keep the same',
      controls: 'Controls',
      measures: 'Outcome measures',
      baselineRunId: 'Baseline run (standard)',
      experimentalRunId: 'Experimental run (with your change)',
      expected: 'Expected outcome',
      negligible: 'Negligible change',
      opposite: 'Opposite outcome',
      limitations: 'Limits of your design',
      supports: 'What it supports',
      failsToEstablish: 'What it fails to establish',
      next: 'Next experiment',
    });
    // ENGINE-13: the stand-in note belongs to the controls that are a specimen (every specimen here is
    // synthetic); the baseline process comparison is a run, not a specimen.
    const SPECIMEN_CONTROLS = Object.freeze(['characterized-positive', 'negative-biological']);
    // ENGINE-13: what the model gives for an automatic (not manual) outcome measure, read off a
    // resolved simulated outcome as an ordinal; a measure missing here gets no readout line.
    const MODEL_READ = Object.freeze({ 'contrast-ordinal': out => out.contrast });
    const REVEALED = Object.freeze(['revealed', 'done']);
    function exportNotebook(
      { notebook, experiments = [], runsById = {}, measurements: taken = [] } = {},
      {
        title = 'Lab notebook',
        studentLabel = '',
        runTitle,
        paramText,
        stepTitle,
        specimenTitle,
        methodTitle,
        controlText,
        strengthText,
        outcomeText,
        isSealed,
      } = {}
    ) {
      // ENGINE-12 / ENGINE-13: isSealed is asked once per run (a simulated entry, the model readout
      // and the run block share the answer).
      const sealedMemo = new Map(),
        sealedRun = run => {
          if (!run || typeof isSealed !== 'function' || reserved([run])) return false;
          if (!sealedMemo.has(run.id)) {
            let answer;
            try {
              answer = isSealed(clone(run)) === true;
            } catch {
              answer = false;
            }
            sealedMemo.set(run.id, answer);
          }
          return sealedMemo.get(run.id);
        },
        runName = (run, fallback) => (run ? formatted(runTitle, [run], fallback) : fallback),
        stepName = id => formatted(stepTitle, [id], id),
        paramItems = pairs => pairs.map(([k, v]) => formatted(paramText, [k, v], `${k}=${v}`)).join('; '),
        // ENGINE-13: strength words in the student part (strengthText, else the engine's words; the
        // code itself is printed only under Model sources).
        strengthWords = s => formatted(strengthText, [s], STRENGTH_TEXT[s] || String(s).replace(/-/g, ' ')),
        sourceWords = s =>
          s.citation
            ? `${s.citation}${s.url ? ` <${s.url}>` : ''}`
            : s.url
              ? `<${s.url}>`
              : "(source not in this lab's list)",
        refsOf = claim => (claim.sources || []).map(sourceRef).map(sourceWords),
        // ENGINE-9 / ENGINE-11: a blank text or an empty list prints 'not written'.
        written = x => (str(x).trim() ? str(x) : 'not written'),
        listed = xs =>
          (Array.isArray(xs) ? xs : [])
            .map(str)
            .filter(x => x.trim())
            .join(', ') || 'not written',
        field = (name, value) => `- ${FIELD[name]}: ${value}`;
      const lines = [`# ${title}`];
      // ENGINE-10: no name given -> a line the student fills in by hand.
      lines.push('', !studentLabel || !String(studentLabel).trim() ? 'Name: ________' : studentLabel);
      lines.push('', EXPORT_DISCLAIMER, '');
      const entries = notebook && Array.isArray(notebook.entries) ? notebook.entries : [],
        evidence = [],
        cited = [],
        detail = [];
      for (const section of SECTIONS) {
        lines.push(`## ${SECTION_TEXT[section]}`, '');
        const rows = entries.filter(e => e.section === section);
        if (!rows.length) lines.push('(no entries)');
        for (const e of rows) {
          lines.push(`- ${ENTRY_TAG[e.type]} ${e.text}`);
          if (e.type === 'published') {
            // ENGINE-13: the claim's words, strength and citation; its ids are in Model sources.
            evidence.push(e.claimId);
            cited.push(e.claimId);
            const claim = getClaim(e.claimId),
              refs = claim ? refsOf(claim) : [];
            lines.push(
              claim
                ? `  "${claim.text}" (${strengthWords(claim.strength)}). ${refs.length === 1 ? 'Source' : 'Sources'}: ${refs.join(' | ') || 'none'}`
                : "  (claim not in this lab's list of sources)"
            );
          } else if (e.type === 'simulated') {
            // ENGINE-13: an entry about a sealed run shows no label until its experiment is revealed.
            const run = runsById[e.runId];
            lines.push(
              `  ${sealedRun(run) ? SEALED_RUN_TEXT : `${runName(run, `Run ${e.runId}`)}, label: ${LABEL_TEXT[e.label] || e.label}`}`
            );
          } else if (e.type === 'observed')
            lines.push(`  ${e.assetId === null ? `Real-lab observation, ${e.observedAt}` : `Asset ${e.assetId}`}`);
        }
        lines.push('');
      }
      lines.push('## Experiment log', '');
      if (!experiments.length) lines.push('(no experiments)', '');
      // ENGINE-11 / ENGINE-13: each control through controlText; the stand-in note follows each
      // specimen-based control (after its type by default, at the end of a worded item) and never a
      // baseline process comparison. Text that already carries the note is refused.
      const controlsLine = controls => {
        if (!controls.length) return 'none';
        return controls
          .map(c => {
            const text = formatted(controlText, [c], null),
              worded = text === null || text.includes(STAND_IN_SUFFIX) ? null : text,
              note = SPECIMEN_CONTROLS.includes(c.type),
              addresses = c.addresses ? `, addresses: ${c.addresses}` : '';
            if (worded !== null) return note ? `${worded} ${STAND_IN_SUFFIX}` : worded;
            return note ? `${c.type} ${STAND_IN_SUFFIX}${addresses}` : `${c.type}${addresses}`;
          })
          .join('; ');
      };
      // §13.2: a jar by its procedure step's title, or an extra jar by its number.
      const jarWords = jarId =>
        STEPS.includes(jarId)
          ? stepName(jarId)
          : /^x\d+$/.test(str(jarId))
            ? `extra ${jarId.slice(1)}`
            : str(jarId) || 'a';
      // A free run's step line ends with what happened on the slide (its Reaction, §11.3); a dip's
      // line names the jar and its contents first (§13.2).
      const eventText = (ev, reactions = []) => {
        const items = isObj(ev.params) ? leaves(ev.params) : [],
          reaction = ev.type === 'step' || ev.type === 'dip' ? reactions.find(r => r && r.seq === ev.seq) : null;
        if (ev.type === 'dip')
          return `Dip, ${jarWords(ev.jarId)} jar: ${solutionText(ev.solution) || 'contents not recorded'}${reaction ? `. ${reaction.text}` : ''}`;
        if (ev.type === 'step' && ev.step)
          return `${stepName(ev.step)}${items.length ? ` (changed setting: ${paramItems(items)})` : ''}${reaction ? `: ${reaction.text}` : ''}`;
        if (ev.type === 'set-params') return `Changed setting: ${paramItems(items) || 'none'}`;
        if (ev.type === 'note') return `Note: ${written(ev.text)}`;
        return String(ev.type);
      };
      const measureOf = id => measurements.find(x => x.id === id);
      // ENGINE-13: "Model readout (simulated)" for a revealed experiment whose two runs exist and are
      // not sealed: one line per automatic measure it chose, in the designer's words for its outcome
      // measures and with no digit (ORDINAL_TEXT words; a move is counted in words).
      const STEP_WORDS = ['no', 'one', 'two', 'three', 'four'];
      const readout = exp => {
        const base = runsById[exp.baselineRunId],
          other = runsById[exp.experimentalRunId];
        if (!REVEALED.includes(exp.status) || !base || !other || sealedRun(base) || sealedRun(other)) return [];
        const outs = [resolve(base), resolve(other)];
        return uniq(Array.isArray(exp.measures) ? exp.measures : [])
          .map(measureOf)
          .filter(m => m && !m.manual && MODEL_READ[m.id])
          .map(m => {
            let text;
            const gaps = ['baseline', 'experimental']
              .map((side, n) =>
                outs[n].label === LABELS.SYNTHETIC
                  ? null
                  : `the ${side} run is ${outs[n].code === 'step-skipped' ? 'not finished' : 'not modeled'}`
              )
              .filter(Boolean);
            if (gaps.length) text = `no model value, because ${gaps.join(' and ')}`;
            else {
              const [b, x] = outs.map(o => clamp(Math.round(Number(MODEL_READ[m.id](o)) || 0), 0, 4)),
                d = Math.abs(x - b);
              if (base.method !== other.method)
                text = `${ORDINAL_TEXT[b]} in the baseline, ${ORDINAL_TEXT[x]} in the experimental run (different methods, not compared on the model scale)`;
              else if (!d) text = `${ORDINAL_TEXT[b]} in both runs (no change on the model scale)`;
              else
                text = `${ORDINAL_TEXT[b]} in the baseline, ${ORDINAL_TEXT[x]} in the experimental run (${x > b ? 'up' : 'down'} ${STEP_WORDS[d]} ${d === 1 ? 'step' : 'steps'} on the model scale)`;
            }
            return `- Model readout (simulated): ${m.title}: ${text}`;
          });
      };
      for (const exp of experiments) {
        const p = exp.predictions || {},
          i = exp.interpretation || null,
          runIds = [exp.baselineRunId, exp.experimentalRunId],
          headings = runIds.map(runId => {
            const run = runsById[runId];
            return runName(run, `Run ${runId}${run && run.label ? ` (${run.label})` : ''}`);
          }),
          change = listed(exp.changed) !== 'not written' ? listed(exp.changed) : written(exp.independentVariable),
          main = written(exp.independentVariable);
        // ENGINE-13: one bullet per field, in the designer's order and words; the main variable only
        // when it says something "What you change" does not.
        lines.push(
          `### ${exp.title || exp.id}`,
          '',
          field('status', exp.status || 'draft'),
          field('background', written(exp.background)),
          field('question', written(exp.question)),
          field('hypothesis', written(exp.hypothesis)),
          field('alternative', written(exp.alternative)),
          field('changed', change),
          ...(main === change ? [] : [field('independentVariable', main)]),
          field('heldComparable', listed(exp.heldComparable)),
          field('controls', controlsLine(exp.controls || [])),
          field(
            'measures',
            listed((Array.isArray(exp.measures) ? exp.measures : []).map(id => (measureOf(id) || { title: id }).title))
          ),
          field('baselineRunId', str(runIds[0]).trim() ? headings[0] : 'not chosen'),
          field('experimentalRunId', str(runIds[1]).trim() ? headings[1] : 'not chosen'),
          field('expected', written(p.expected)),
          field('negligible', written(p.negligible)),
          field('opposite', written(p.opposite)),
          field('limitations', written(exp.limitations)),
          ...readout(exp),
          ...(i
            ? [
                field('supports', written(i.supports)),
                field('failsToEstablish', written(i.failsToEstablish)),
                field('next', written(i.next)),
              ]
            : ['- Interpretation: not written']),
          ''
        );
        // ENGINE-14: a run the designer has not chosen yet (blank id) gets no block; one line says so.
        if (runIds.some(runId => !str(runId).trim())) lines.push('- Runs: not chosen yet', '');
        for (const [n, runId] of runIds.entries()) {
          if (!str(runId).trim()) continue;
          const run = runsById[runId],
            heading = headings[n];
          lines.push(`#### ${heading}`, '');
          if (!run) {
            lines.push('(run not found)', '');
            continue;
          }
          const out = resolve(run),
            view = effectiveView(run),
            free = runMode(run) === 'free',
            changed = leaves(view).filter(([k, v]) => !RECORD_ONLY.includes(k) && v !== getPath(DEFAULT_PARAMS, k)),
            skips = free ? [] : RECORD_ONLY.filter(flag => view[flag] === false),
            events = run.events || [],
            reactions = runReactions(run);
          lines.push(
            `- Specimen: ${formatted(specimenTitle, [run.specimenId], run.specimenId)}`,
            `- Method: ${formatted(methodTitle, [run.method], run.method)}`,
            ...(free ? ['- Bench: free (any jar, any order, any number of times)'] : []),
            changed.length
              ? `- Settings changed from standard: ${paramItems(changed)}`
              : // TONING-verify-1: never "all standard" right above a skipped step's line.
                `- Settings: all standard (per procedure)${skips.length ? ` except ${skips.map(flag => SKIP_FLAGS[flag].title.toLowerCase()).join(' and ')}` : ''}`,
            // MODE-engine-1: toning / thiosulfate in the procedure's words (R-model-08 / 09 / 10).
            ...flagLines(run, out, view)
          );
          // ENGINE-13: the events are their own numbered list, with a blank line on each side.
          if (events.length)
            lines.push('- Events:', '', ...events.map(ev => `${ev.seq}. ${eventText(ev, reactions)}`), '');
          else lines.push('- Events: none');
          lines.push(
            `- Deviations: ${(run.deviations || []).map(d => `${d.kind} ${d.step ? stepName(d.step) : `${jarWords(d.jarId)} jar`}${d.expectedBefore ? ` (expected before: ${d.expectedBefore.map(stepName).join(', ')})` : ''}`).join('; ') || 'none'}`,
            // §13.2: one line per dip no source describes (left out of the drawing).
            ...runUnknownDips(run).map(
              u =>
                `- ${UNKNOWN_LABEL}: ${solutionText(u.solution) || 'contents not recorded'} (event ${u.seq}), left out of the drawing`
            )
          );
          // ENGINE-12: a run the caller seals (its experiment not revealed yet) shows no outcome: one
          // line in place of its label, description or summary and measurements, no model detail and
          // no claims of its own in Model sources. Only a strict true seals.
          if (sealedRun(run)) {
            lines.push('', SEALED_RUN_TEXT, '');
            continue;
          }
          // ENGINE-11: with outcomeText the block reads "Summary: ..." and the engine's full
          // description moves, with the label, to "Model detail (for instructors)" at the end.
          const description = describeOutcome(out, getSpecimen(run.specimenId)),
            summary = formatted(outcomeText, [out], null);
          lines.push(
            `- Label: ${LABEL_TEXT[out.label]}`,
            summary === null ? `- Description: ${description}` : `- Summary: ${summary}`
          );
          if (summary !== null && !detail.some(d => d.runId === runId))
            detail.push({ runId, heading, label: LABEL_TEXT[out.label], description });
          evidence.push(
            ...(out.claims || []),
            ...(out.rulesConsulted || []).flatMap(id => (getRule(id) ? getRule(id).claims || [] : []))
          );
          const mine = taken.filter(m => m.runId === runId);
          lines.push(`- Measurements:${mine.length ? '' : ' none'}`);
          for (const m of mine) {
            const rule = measureOf(m.measurementId),
              n = (m.unit || (rule && rule.unit)) === 'ordinal' ? ordinalOf(m.value) : null,
              value = n === null ? `${m.value} ${m.unit || ''}` : `${ORDINAL_TEXT[n]} (model scale)`;
            lines.push(
              `  - ${ENTRY_TAG.simulated} ${rule ? rule.title : m.measurementId}: ${value} (${m.manual ? 'manual' : 'derived'})${m.note ? `, note: ${m.note}` : ''}`
            );
          }
          lines.push('');
        }
      }
      // ENGINE-13: the student's Sources are the claims the student cited, in words (the citation, then
      // what it is cited for as a sub-item, so no viewer runs the two together); the model's claims and
      // every id and strength code are under Model detail (for instructors).
      lines.push('## Sources', '');
      const mineCited = uniq(cited.filter(Boolean)).map(getClaim).filter(Boolean);
      if (!mineCited.length) lines.push('(no sources cited)');
      for (const claim of mineCited)
        lines.push(
          `- ${refsOf(claim).join(' | ') || 'no source listed'}`,
          `  - Cited for: "${claim.text}" (${strengthWords(claim.strength)})`
        );
      lines.push('');
      const ids = uniq(evidence.filter(Boolean));
      if (detail.length || ids.length) {
        lines.push('## Model detail (for instructors)', '');
        for (const d of detail)
          lines.push(`### ${d.heading}`, '', `- Label: ${d.label}`, `- Description: ${d.description}`, '');
        if (ids.length) {
          lines.push('### Model sources', '');
          for (const id of ids) lines.push(`- ${claimLine(id)}`);
          lines.push('');
        }
      }
      return lines.join('\n');
    }

    return deepFreeze({
      content,
      getSpecimen,
      listSpecimens,
      getMethod,
      getModule,
      listModules,
      getClip,
      listReagents,
      getReagent,
      procedureJars,
      handlingChoices,
      solutionText,
      isProcedureSolution,
      getSource,
      getClaim,
      getRule,
      getHazard,
      listStations,
      explainStep,
      createRun,
      applyEvent,
      replay,
      resolve,
      lookOf,
      compare,
      schematicCurves,
      checkExperiment,
      canReveal,
      reveal,
      measurementRules,
      describeOutcome,
      newNotebook,
      addEntry,
      exportNotebook,
    });
  }

  // ---- serialization (§2) ------------------------------------------------------------------
  const serialize = obj => stableStringify(obj);
  function deserialize(text) {
    const obj = JSON.parse(text);
    if (!isObj(obj) || obj.v !== 1)
      throw new ContentError([{ code: 'version-unsupported', path: 'v', message: 'expected { v: 1 }' }]);
    const found = [];
    walkStrings(obj, '$', (value, path) => {
      if (value === LABELS.VALIDATED) found.push(path);
    });
    if (found.length)
      throw new ContentError([
        { code: 'validated-label-present', path: found[0], message: 'that label has zero members in v1' },
      ]);
    return obj;
  }

  const api = {
    VERSION,
    LABELS,
    LABEL_TEXT,
    BASIS,
    HYPOTHESES,
    HYPOTHESIS_TEXT,
    SITE_CLASSES,
    SITE_TEXT,
    ORDINAL_TEXT,
    RATE_PHASES,
    STEPS,
    METHODS,
    ENDPOINTS,
    STRENGTHS,
    CONDITIONS,
    DEVIATION_KINDS,
    MODES,
    AMMONIA,
    REACTION_KINDS,
    LOOK_KEYS,
    LOOKS,
    LOOK_COLORS,
    TONING_TEXT,
    THIOSULFATE_TEXT,
    ENTRY_TYPES,
    SECTIONS,
    SECTION_TEXT,
    DEFAULT_PARAMS,
    FIXED_CAVEATS,
    CROSS_METHOD_CAVEAT,
    EXPORT_DISCLAIMER,
    ENTRY_TAG,
    STAND_IN_SUFFIX,
    STRENGTH_TEXT,
    LINT_CODES,
    CLIP_SCENES,
    ContentError,
    lint,
    createLab,
    serialize,
    deserialize,
  };
  root.SilverLab = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
