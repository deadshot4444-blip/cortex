/* Authoring consistency checks for the ALZ histology lab content (data/lab/*.json), not subject-matter approval.
   Re-implements the structural checks of context/ALZ-LAB-CONTRACT.md §3 (and §7 for clip.json) so it runs before the
   engine lands; when silver-lab-core.js exists, SilverLab.lint(content) runs as well and its problems are appended.
   Exit 1 on any problem. */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'lab');
const FILES = ['sources', 'claims', 'rules', 'methods', 'specimens', 'safety', 'modules', 'assets', 'clip', 'reagents'];

// Enumerations mirror the contract §1 so the check does not depend on the engine.
const LABELS = ['observed-reference', 'illustrative-synthetic', 'validated-prediction', 'no-basis'];
const BASIS = ['course-handout', 'published-qualitative', 'hypothesis-conditional', 'schematic-analogy', 'placeholder'];
const HYPOTHESES = ['H-fixation-carbonyl', 'H-endogenous-carbonyl', 'H-reduced-metal', 'H-other-reduction-site'];
const TARGET_SITES = ['axon', 'plaque-core', 'plaque-neurite', 'tangle', 'neuropil-thread'];
const RATE_PHASES = ['before-reference', 'reference', 'after-reference', 'unknown'];
const STEPS = [
  'deparaffinize-rehydrate',
  'silver-impregnation',
  'water-wash',
  'ammoniacal-silver',
  'ammonium-hydroxide-wash',
  'development',
  'gold-toning',
  'sodium-thiosulfate',
  'final-wash-dehydrate-clear-mount',
];
const METHODS = ['bielschowsky-modified', 'cps-i', 'cps-ii'];
const ENDPOINTS = ['early', 'sop-default', 'extended', 'unspecified'];
const STRENGTHS = ['weak', 'sop-default', 'strong', 'unspecified'];
const CONDITIONS = ['sop-default', 'deviated', 'unspecified'];
const DEVIATION_KINDS = ['out-of-order', 'repeated', 'skipped', 'not-runnable', 'not-planned']; // §1 (ENGINE-14)
// §13.2: S9 "Your jars" is the 3D tray for the free bench's extra jars (no procedure step).
const STATION_IDS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'];
// 'rights-policy' is a recorded deviation (contract Deviations, content stage): S-pmc-copyright fits no contract type.
const SOURCE_TYPES = [
  'course-handout',
  'course-recording',
  'course-pdf',
  'peer-reviewed',
  'vendor-protocol',
  'legacy-protocol',
  'institutional-ehs',
  'rights-policy',
];
const VERIFIED_LEVELS = ['abstract', 'metadata', 'title-only', 'not-fetched', 'not-read', 'full-text'];
const RIGHTS = ['cite-only', 'course-access-only', 'cleared', 'original', 'cc-by', 'public-domain', 'unknown'];
const TRANSFERABLE = ['qualitative-only', 'analogy-only', 'course-specific'];
const EFFECT_OPS = [
  'bind',
  'nuclei',
  'develop',
  'background',
  'visibility',
  'ratePhase',
  'confidence',
  'caveat',
  'artifact',
  'schematicOutcome',
  'conditional',
  // §11 (MODE-engine-1): the free-bench reaction model and the strict additions.
  'bindFree',
  'prime',
  'developAgain',
  'tone',
  'fix',
  'seal',
  'dewax',
  'flag',
  'look',
  'react',
  // §13.2 (SHELF-engine): one step more or less background.
  'shiftBackground',
];
// §11: bench modes, the ammonia leaf, the reaction kinds and the by-eye looks (mirror the engine).
const MODES = ['practice', 'free'];
const AMMONIA = ['just-clear', 'extra', 'cloudy'];
const REACTION_KINDS = ['reaction', 'no-reaction', 'sealed'];
const LOOK_KEYS = [
  'unstained',
  'faint-yellow',
  'tan-brown',
  'light-detail',
  'black-on-tan',
  'dark-brown',
  'gray-black',
  'patchy',
];
const REACTION_MAX_WORDS = 30;
// §13.2: slide flags a rule may set (or, with value false, clear), and the dip facts rules read as `dip.*`.
const SLIDE_FLAGS = [
  'unfixed',
  'oxidized',
  'pretreated',
  'oldSilver',
  'longAmmoniacal',
  'shortXylene',
  'tooWarm',
  'pastTen',
];
// §13.1 the reagent shelf (data/lab/reagents.json): the bottles the contract lists, the fields a bottle may
// carry, the shelf groups, the four handling choices (in order), and the word limit for unknownWhy.
const REAGENT_IDS = [
  'dewax-series',
  'silver-nitrate',
  'distilled-water',
  'ammoniacal-silver',
  'ammonia-water',
  'developer',
  'gold-chloride',
  'thiosulfate',
  'dehydrate-mount',
  'permanganate',
  'oxalic-acid',
  'tap-water',
  'formic-acid',
  'copper-sulfate',
  'hydrogen-peroxide',
];
const REAGENT_FIELDS = ['strength', 'drops', 'ammonia', 'minutes', 'tempC', 'dark', 'fresh', 'into'];
const REAGENT_GROUPS = ['procedure', 'pretreatment', 'other'];
const HANDLING_IDS = ['forceps', 'glass', 'between', 'fill'];
const PROCEDURE_MARK = '(procedure)';
const UNKNOWN_WHY_MAX_WORDS = 30;
// §12.1 real reference slides (assets.json): kinds, roles, the rights a photo and its source may carry,
// and the student-text word limit for the description.
const ASSET_KINDS = ['reference-image', 'synthetic-render', 'schematic'];
const ASSET_ROLES = ['positive', 'negative', 'other'];
const REFERENCE_RIGHTS = ['cc-by-4.0', 'cc-by', 'cc-by-sa-4.0', 'cc0', 'public-domain', 'cleared'];
const REFERENCE_SOURCE_RIGHTS = ['cc-by', 'public-domain', 'cleared'];
const REFERENCE_MAX_WORDS = 25;
const REFERENCE_DESCRIPTION_START = 'Real slide:';
const AXIOMS = {
  'R-model-01': {
    op: 'bind',
    claims: ['C-brief-binding-not-development', 'C-gallyas-1979-separable', 'C-peters-1955-bound-silver'],
  },
  'R-model-02': { op: 'nuclei', claims: ['C-peters-1955-nuclei', 'C-dion-1983-nucleation'] },
  'R-model-03': {
    op: 'develop',
    claims: ['C-brief-binding-not-development', 'C-gallyas-1979-separable', 'C-peters-1955-developer-strength'],
  },
  'R-model-04': { op: 'background', claims: ['C-peters-1955-developer-strength'] },
  'R-model-05': { op: 'visibility', claims: ['C-peters-1955-nuclei', 'C-dion-1983-lysine'] },
  'R-model-06': { op: 'ratePhase', claims: ['C-brief-binding-not-development'] },
};
const SHARED_ENDPOINT_CAVEAT =
  "Endpoint positions early / sop-default / extended are ordered schematic positions. Nothing is known about where the course SOP's actual times fall on any binding or deposition curve.";
const COMPARE_ONLY_CAVEAT = 'Compare-only method; not runnable on the bench; schematic from the published description.';
const CPS_OUTCOMES = {
  'R-method-03-cps1': {
    perSite: { axon: 0, 'plaque-core': 4, 'plaque-neurite': 4, tangle: 4, 'neuropil-thread': 4 },
    background: 0,
  },
  'R-method-03-cps2': {
    perSite: { axon: 0, 'plaque-core': 1, 'plaque-neurite': 4, tangle: 4, 'neuropil-thread': 4 },
    background: 0,
  },
};
const REQUIRED = {
  sources: [
    'S-litchfield-2001',
    'S-yamamoto-1986',
    'S-dion-1983',
    'S-rosenwald-1993',
    'S-velasco-1992',
    'S-peters-1955',
    'S-gallyas-1979a',
    'S-gallyas-1979b',
    'S-alafuzoff-2006',
    'S-abcam-protocol',
    'S-utah-webpath',
    'S-pmc-copyright',
    'S-course-handout',
    'S-course-recording',
    'S-course-velasco-pdf',
    'S-course-guide',
    'S-intorcia-2019',
  ],
  claims: [
    'C-litchfield-2001-temp',
    'C-litchfield-2001-what-stains',
    'C-yamamoto-1986-more-nft',
    'C-rosenwald-1993-sensitivity',
    'C-rosenwald-1993-lack-of-control',
    'C-velasco-1992-cps1',
    'C-velasco-1992-cps2',
    'C-velasco-1992-normal-neurites-unstained',
    'C-peters-1955-nuclei',
    'C-peters-1955-bound-silver',
    'C-peters-1955-developer-strength',
    'C-gallyas-1979-separable',
    'C-dion-1983-nucleation',
    'C-dion-1983-lysine',
    'C-alafuzoff-2006-interlab',
    'C-course-steps-order',
    'C-course-hypotheses',
    'C-course-negative-tissue-stains',
    'C-brief-binding-not-development',
    'C-course-what-you-see',
    'C-course-thiosulfate-purpose',
    'C-course-toning-colour',
    'C-course-trouble-no-black',
    'C-course-trouble-dark',
    'C-course-trouble-grains',
    'C-course-trouble-patchy',
    'C-course-ammonia-endpoint',
    'C-course-mount-seal',
    'C-intorcia-2019-pretreat',
    'C-course-pretreat-blobs',
    'C-course-alternatives',
  ],
  rules: [
    ...Object.keys(AXIOMS),
    'R-temp-01',
    'R-method-01',
    'R-method-02',
    'R-method-03-cps1',
    'R-method-03-cps2',
    'R-dev-01',
    'R-kinetics-01',
    'R-intensity-01',
    'R-interlab-01',
    'R-order-01',
    'R-model-07',
    'R-model-08',
    'R-model-09',
    'R-model-10',
    'R-react-look',
    'R-norm-01',
  ],
  methods: METHODS,
  specimens: ['SPEC-SYN-AD-01', 'SPEC-SYN-AD-02', 'SPEC-SYN-NEG-01', 'SPEC-SYN-LOWCHEM-01'],
  safety: ['H-ammoniacal-silver', 'H-impregnation-reagent', 'H-disclaimer'],
  modules: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'],
  assets: [],
  reagents: REAGENT_IDS,
};
// Contract §3 specimen tables are load-bearing for engine tests 2 to 5; pin them.
const SPECIMEN_SITES = {
  'SPEC-SYN-AD-01': {
    axon: [3, 3],
    'plaque-core': [3, 3],
    'plaque-neurite': [3, 3],
    tangle: [3, 3],
    'neuropil-thread': [2, 2],
  },
  'SPEC-SYN-AD-02': {
    axon: [3, 3],
    'plaque-core': [2, 3],
    'plaque-neurite': [2, 3],
    tangle: [2, 3],
    'neuropil-thread': [1, 2],
  },
  'SPEC-SYN-NEG-01': {
    axon: [3, 3],
    'plaque-core': [0, 0],
    'plaque-neurite': [0, 0],
    tangle: [0, 0],
    'neuropil-thread': [0, 0],
  },
  'SPEC-SYN-LOWCHEM-01': {
    axon: [4, 1],
    'plaque-core': [4, 1],
    'plaque-neurite': [4, 1],
    tangle: [4, 1],
    'neuropil-thread': [4, 1],
  },
};
const SPECIMEN_ROLES = {
  'SPEC-SYN-AD-01': 'positive-control-stand-in',
  'SPEC-SYN-AD-02': 'experimental',
  'SPEC-SYN-NEG-01': 'negative-comparison-stand-in',
  'SPEC-SYN-LOWCHEM-01': 'experimental',
};
const ROLES = [
  'positive-control-stand-in',
  'negative-comparison-stand-in',
  'baseline-process-stand-in',
  'experimental',
];
const ACTIVITY_URLS = [1418350, 1418363, 1418365, 1418366, 1418367, 1418368, 1418369].map(
  n => `https://utsa.instructure.com/courses/91998/assignments/${n}`
);
const STEP_KINDS = [
  'view',
  'annotate',
  'choose',
  'write',
  'run',
  'compare',
  'curves',
  'design',
  'predict',
  'interpret',
  'notebook',
  'clip',
];
// Contract §7 / §7.1 tissue clip: site display names, scene ids in play order, the fixed label, the top-level
// caption keys, and the honesty wording each scene must carry in its caption or a fact (like module-notice-missing).
const SITE_TEXT = {
  axon: 'Axon',
  'plaque-core': 'Plaque core',
  'plaque-neurite': 'Plaque neurite',
  tangle: 'Tangle',
  'neuropil-thread': 'Neuropil thread',
};
const CLIP_SCENES = [
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
];
const CLIP_LABEL = 'A drawing, not a reconstruction of any section';
const CLIP_CAPTIONS = ['noRunCaption', 'noBasisCaption', 'impregnationNotDone', 'developmentNotDone'];
const CLIP_NOTICES = {
  'brain-overview': [/not an atlas/i],
  region: [/stands? in|stand-in/i, /unknown/i],
  slide: [/cannot establish a true 3D reconstruction/i],
  impregnation: [/binding is not development/i, /plateau/i],
  development: [/darker\b.*does not mean/i],
  'record-only': [/gray-black/i, /stops changing/i],
};
const ENGINE_FUNCTIONS = [
  'explainStep',
  'createRun',
  'applyEvent',
  'replay',
  'resolve',
  'compare',
  'schematicCurves',
  'checkExperiment',
  'canReveal',
  'reveal',
  'measurementRules',
  'describeOutcome',
  'addEntry',
  'exportNotebook',
];
const MEASUREMENT_IDS = [
  'contrast-ordinal',
  'roi-lesion-count',
  'artifact-area',
  'tissue-coverage',
  'blinded-quality-score',
];
const MEASUREMENT_UNITS = ['ordinal', 'count', 'fraction', 'score'];
const PARAM_LEAVES = {
  'impregnation.endpoint': ENDPOINTS,
  'impregnation.temperature': CONDITIONS,
  'impregnation.condition': CONDITIONS,
  'ammoniacal.endpoint': ENDPOINTS,
  'ammoniacal.ammonia': AMMONIA,
  'ammoniacal.condition': CONDITIONS,
  'development.endpoint': ENDPOINTS,
  'development.strength': STRENGTHS,
  'development.condition': CONDITIONS,
  'washes.condition': CONDITIONS,
  pretreatment: 'probe',
  toning: 'boolean',
  thiosulfate: 'boolean',
};
const PURPOSE_PLACEHOLDER = 'Purpose text not yet sourced.';
const BINDING_CLAIM_TEXT =
  'A plateau in silver binding does not mean visible deposition has finished; binding and development are modeled as separate processes.';
const PENDING = 'PENDING-EHS';
const FORBIDDEN_DISPOSAL = /\b(drain|sink)\b/i;
const VALIDATED = 'validated-prediction';
// Contract §8.2 / PLAN-ALZ-LAB-SIMPLIFY §4 rule (c): student-facing length limits; the disclaimer is the brief's text.
const DISCLAIMER_TEXT =
  'This is educational software, not qualification to perform hazardous procedures independently. Use instructor-approved protocols, current SDS information and institutional EHS guidance.';
const wordCount = text =>
  String(text)
    .replace(/\{[^}]*\}/g, ' ')
    .split(/\s+/)
    .filter(w => /[A-Za-z0-9]/.test(w)).length;
const sentenceCount = text =>
  String(text)
    .split(/[.!?]+(?=\s|$)/)
    .filter(s => /[A-Za-z0-9]/.test(s)).length;

const isObj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
// Reads a JPEG's pixel size from its first SOF marker (no dependencies); null when the bytes are not a JPEG
// or no frame header is found.
function jpegSize(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (offset + 9 > buffer.length) return null;
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    if (marker === 0xda) return null; // scan data begins: no frame header seen
    offset += 2 + length;
  }
  return null;
}
const isOrdinal = value => Number.isInteger(value) && value >= 0 && value <= 4;

function walkReagentStrings(value, at, visit) {
  if (typeof value === 'string') visit(value, at);
  else if (Array.isArray(value)) value.forEach((v, i) => walkReagentStrings(v, `${at}[${i}]`, visit));
  else if (isObj(value)) for (const [key, v] of Object.entries(value)) walkReagentStrings(v, `${at}.${key}`, visit);
}

function lintLabContent(content) {
  const problems = [];
  const problem = (code, at, message) => problems.push({ code, path: at, message });
  const items = name => (isObj(content[name]) && Array.isArray(content[name].items) ? content[name].items : []);
  const nonEmpty = (value, at) => {
    if (typeof value !== 'string' || !value.trim()) problem('schema', at, 'expected a non-empty string');
  };
  const oneOf = (value, allowed, at, code = 'enum-invalid') => {
    if (!allowed.includes(value)) problem(code, at, `${JSON.stringify(value)} is not one of ${allowed.join(' | ')}`);
  };

  // File shapes and ids.
  for (const name of FILES) {
    const file = content[name];
    if (!isObj(file)) problem('file-shape', `${name}.json`, 'expected an object');
    else {
      if (file.v !== 1) problem('file-shape', `${name}.json`, 'v must be 1');
      if (!Array.isArray(file.items)) problem('file-shape', `${name}.json`, 'items must be an array');
    }
  }
  const ids = {};
  for (const name of FILES) {
    ids[name] = new Set();
    items(name).forEach((item, i) => {
      const at = `${name}.items[${i}]`;
      if (!isObj(item) || typeof item.id !== 'string' || !item.id) problem('schema', at, 'item needs a string id');
      else if (ids[name].has(item.id)) problem('duplicate-id', at, `duplicate id ${item.id}`);
      else ids[name].add(item.id);
    });
  }
  for (const [name, required] of Object.entries(REQUIRED))
    for (const id of required) if (!ids[name].has(id)) problem('required-id-missing', `${name}.json`, `missing ${id}`);
  const byId = name => new Map(items(name).map(item => [item.id, item]));
  const claimById = byId('claims');
  const ruleById = byId('rules');
  const claimRefs = (list, at, code) => {
    if (!Array.isArray(list) || !list.length) problem(code, at, 'needs at least one claim id');
    else for (const id of list) if (!ids.claims.has(id)) problem('unknown-claim', at, `unknown claim ${id}`);
  };
  const sourceRefs = (list, at, code) => {
    if (!Array.isArray(list) || !list.length) problem(code, at, 'needs at least one source id');
    else for (const id of list) if (!ids.sources.has(id)) problem('unknown-source', at, `unknown source ${id}`);
  };

  // sources.json
  items('sources').forEach((s, i) => {
    const at = `sources.items[${i}] (${s.id})`;
    nonEmpty(s.citation, `${at}.citation`);
    // MODE-FIX-engine-9: a course-access-only source may carry no url (no dead link for the
    // student); every other source links, and a url given is never empty.
    if (s.url !== undefined || s.rights !== 'course-access-only') nonEmpty(s.url, `${at}.url`);
    oneOf(s.type, SOURCE_TYPES, `${at}.type`);
    if (!isObj(s.verified)) problem('schema', `${at}.verified`, 'expected { date, level }');
    else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s.verified.date)))
        problem('schema', `${at}.verified.date`, 'expected YYYY-MM-DD');
      oneOf(s.verified.level, VERIFIED_LEVELS, `${at}.verified.level`);
    }
    oneOf(s.rights, RIGHTS, `${at}.rights`);
    if (s.rights === 'unknown')
      problem('source-rights-unknown', `${at}.rights`, 'a source with unknown rights cannot be referenced');
    if (s.system !== null && typeof s.system !== 'string')
      problem('schema', `${at}.system`, 'expected a string or null');
    if (!Array.isArray(s.excluded) || s.excluded.some(x => typeof x !== 'string'))
      problem('schema', `${at}.excluded`, 'expected an array of strings');
    if (s.id === 'S-utah-webpath' && !(s.excluded || []).length)
      problem('schema', `${at}.excluded`, 'S-utah-webpath must name its excluded disposal advice');
    if (s.id === 'S-course-guide') {
      if (s.type !== 'course-handout') problem('schema', `${at}.type`, 'S-course-guide is type course-handout');
      if (s.verified && s.verified.level !== 'not-read')
        problem('schema', `${at}.verified.level`, 'S-course-guide is not-read');
      if (s.rights !== 'course-access-only') problem('schema', `${at}.rights`, 'S-course-guide is course-access-only');
    }
  });

  // claims.json
  items('claims').forEach((c, i) => {
    const at = `claims.items[${i}] (${c.id})`;
    nonEmpty(c.text, `${at}.text`);
    sourceRefs(c.sources, `${at}.sources`, 'claim-without-source');
    oneOf(c.strength, BASIS, `${at}.strength`, 'basis-invalid');
    nonEmpty(c.system, `${at}.system`);
    oneOf(c.transferable, TRANSFERABLE, `${at}.transferable`);
  });
  const binding = claimById.get('C-brief-binding-not-development');
  if (binding) {
    const at = 'claims C-brief-binding-not-development';
    if (binding.text !== BINDING_CLAIM_TEXT) problem('schema', at, 'text must match the contract wording');
    if (JSON.stringify(binding.sources) !== '["S-course-guide"]')
      problem('schema', at, 'sources must be ["S-course-guide"]');
    if (binding.strength !== 'schematic-analogy') problem('basis-invalid', at, 'strength must be schematic-analogy');
  }

  // rules.json
  const checkWhen = (node, at) => {
    if (!isObj(node)) return problem('when-invalid', at, 'predicate must be an object');
    if ('all' in node || 'any' in node) {
      const list = node.all || node.any;
      if (!Array.isArray(list) || !list.length) return problem('when-invalid', at, 'all / any need a non-empty array');
      return list.forEach((child, j) => checkWhen(child, `${at}[${j}]`));
    }
    if ('step' in node) return oneOf(node.step, STEPS, `${at}.step`, 'step-unknown');
    // §11: { mode } gates a rule to one bench mode; { event: 'step' } fires at any step event.
    if ('mode' in node) return oneOf(node.mode, MODES, `${at}.mode`, 'mode-invalid');
    // §13.2: { event: 'dip' } fires at a dip only ({ event: 'step' } at a step event or a dip).
    if ('event' in node) return oneOf(node.event, ['step', 'dip'], `${at}.event`, 'when-invalid');
    if ('stepsDone' in node) {
      if (!Array.isArray(node.stepsDone) || !node.stepsDone.length)
        return problem('when-invalid', at, 'stepsDone needs a list');
      return node.stepsDone.forEach(step => oneOf(step, STEPS, `${at}.stepsDone`, 'step-unknown'));
    }
    if ('deviation' in node) return oneOf(node.deviation, DEVIATION_KINDS, `${at}.deviation`);
    if ('path' in node) {
      if (
        typeof node.path !== 'string' ||
        !/^(params\.|method$|specimen\.|stepsDone|deviations|slide\.|silver\.|dip\.)/.test(node.path)
      )
        problem(
          'when-invalid',
          `${at}.path`,
          'path must resolve against params / method / specimen / stepsDone / deviations / slide / silver / dip'
        );
      if (!('eq' in node) && !('in' in node) && !('defined' in node))
        problem('when-invalid', at, 'path needs eq, in or defined');
      return;
    }
    problem('when-invalid', at, `unknown predicate keys ${Object.keys(node).join(', ')}`);
  };
  const keyedInts = (map, keys, at) => {
    if (!isObj(map)) return problem('effect-invalid', at, 'expected an object');
    for (const key of keys)
      if (!Number.isInteger(map[key])) problem('effect-invalid', `${at}.${key}`, 'expected an integer');
    for (const key of Object.keys(map))
      if (!keys.includes(key)) problem('effect-invalid', `${at}.${key}`, 'unexpected key');
  };
  const wordCountOf = text =>
    String(text || '')
      .split(/\s+/)
      .filter(Boolean).length;
  const checkEffect = (e, at) => {
    if (!isObj(e)) return problem('effect-invalid', at, 'effect must be an object');
    oneOf(e.op, EFFECT_OPS, `${at}.op`, 'effect-op-unknown');
    // §11 (R-model-10): an op may carry its own `when`; it applies only when that matches.
    if (e.when !== undefined) checkWhen(e.when, `${at}.when`);
    switch (e.op) {
      case 'bind':
        if (e.ammoniaDelta !== undefined) keyedInts(e.ammoniaDelta, AMMONIA, `${at}.ammoniaDelta`);
        return keyedInts(e.gain, ['early', 'sop-default', 'extended'], `${at}.gain`);
      // §11.3 free-mode binding: a gain map, optional ammoniacal deltas, the unprimed gain and the wax cap.
      case 'bindFree':
        keyedInts(e.gain, ['early', 'sop-default', 'extended'], `${at}.gain`);
        if (e.endpointDelta !== undefined)
          keyedInts(e.endpointDelta, ['early', 'sop-default', 'extended'], `${at}.endpointDelta`);
        if (e.ammoniaDelta !== undefined) keyedInts(e.ammoniaDelta, AMMONIA, `${at}.ammoniaDelta`);
        for (const key of ['unprimedGain', 'waxCap'])
          if (e[key] !== undefined && !Number.isInteger(e[key]))
            problem('effect-invalid', `${at}.${key}`, 'expected an integer');
        // §13.2: a gain change while a slide flag is set (oldSilver).
        if (e.flagDelta !== undefined) {
          if (!isObj(e.flagDelta)) problem('effect-invalid', `${at}.flagDelta`, 'expected an object');
          else
            for (const [flag, delta] of Object.entries(e.flagDelta)) {
              oneOf(flag, SLIDE_FLAGS, `${at}.flagDelta.${flag}`);
              if (!Number.isInteger(delta)) problem('effect-invalid', `${at}.flagDelta.${flag}`, 'expected an integer');
            }
        }
        return;
      case 'developAgain':
        for (const key of ['deposit', 'background'])
          if (!Number.isInteger(e[key])) problem('effect-invalid', `${at}.${key}`, 'expected an integer');
        return;
      case 'tone':
        return oneOf(e.tone, ['gold'], `${at}.tone`);
      case 'flag':
        if (e.value !== undefined && e.value !== false)
          problem('effect-invalid', `${at}.value`, 'expected false (a flag op sets the flag unless value is false)');
        return oneOf(e.id, SLIDE_FLAGS, `${at}.id`);
      case 'shiftBackground':
        if (!Number.isInteger(e.by) || e.by === 0) problem('effect-invalid', `${at}.by`, 'expected a non-zero integer');
        return;
      case 'look':
        for (const key of ['darkBackground', 'blackFrom', 'patchyBelow'])
          if (!isOrdinal(e[key])) problem('effect-invalid', `${at}.${key}`, 'expected 0..4');
        return;
      // §11.3 Reaction: plain words, at most 30; `why` for a primary op; `noChange` / `byLook` optional.
      case 'react': {
        nonEmpty(e.text, `${at}.text`);
        if (wordCountOf(e.text) > REACTION_MAX_WORDS)
          problem('effect-invalid', `${at}.text`, `reaction text is over ${REACTION_MAX_WORDS} words`);
        // MODE-FIX-engine-3: an append op may carry `noChange` too (its words when the primary
        // changed nothing: the cause, in place of the plateau sentence).
        const noChange = () => {
          if (e.noChange === undefined) return;
          if (!isObj(e.noChange)) problem('effect-invalid', `${at}.noChange`, 'expected { text, why }');
          else {
            nonEmpty(e.noChange.text, `${at}.noChange.text`);
            nonEmpty(e.noChange.why, `${at}.noChange.why`);
            if (wordCountOf(e.noChange.text) > REACTION_MAX_WORDS)
              problem('effect-invalid', `${at}.noChange.text`, `reaction text is over ${REACTION_MAX_WORDS} words`);
          }
        };
        if (e.append) {
          if (e.append !== true) problem('effect-invalid', `${at}.append`, 'expected true');
          noChange();
          return;
        }
        oneOf(e.kind, REACTION_KINDS, `${at}.kind`);
        nonEmpty(e.why, `${at}.why`);
        noChange();
        if (e.byLook !== undefined) {
          if (!isObj(e.byLook)) problem('effect-invalid', `${at}.byLook`, 'expected an object keyed by look');
          else
            for (const key of Object.keys(e.byLook)) {
              oneOf(key, LOOK_KEYS, `${at}.byLook.${key}`);
              nonEmpty(e.byLook[key], `${at}.byLook.${key}`);
            }
        }
        if (e.final !== undefined && e.final !== true) problem('effect-invalid', `${at}.final`, 'expected true');
        return;
      }
      case 'develop':
        keyedInts(e.endpointDelta, ['early', 'sop-default', 'extended'], `${at}.endpointDelta`);
        return keyedInts(e.strengthDelta, ['weak', 'sop-default', 'strong'], `${at}.strengthDelta`);
      case 'background':
        for (const key of ['base', 'extendedDelta', 'strongDelta'])
          if (!Number.isInteger(e[key])) problem('effect-invalid', `${at}.${key}`, 'expected an integer');
        return;
      case 'ratePhase':
        if (!isObj(e.map)) return problem('effect-invalid', `${at}.map`, 'expected an object');
        for (const key of ['early', 'sop-default', 'extended']) oneOf(e.map[key], RATE_PHASES, `${at}.map.${key}`);
        return;
      case 'confidence':
        return oneOf(e.level, ['nominal', 'low'], `${at}.level`);
      case 'caveat':
        return nonEmpty(e.text, `${at}.text`);
      case 'artifact':
        return nonEmpty(e.id, `${at}.id`);
      case 'conditional':
        return oneOf(e.hypothesis, HYPOTHESES, `${at}.hypothesis`);
      case 'schematicOutcome':
        if (!isObj(e.perSite)) problem('effect-invalid', `${at}.perSite`, 'expected an object');
        else {
          for (const site of TARGET_SITES)
            if (!isOrdinal(e.perSite[site])) problem('effect-invalid', `${at}.perSite.${site}`, 'expected 0..4');
          for (const site of Object.keys(e.perSite))
            if (!TARGET_SITES.includes(site))
              problem('effect-invalid', `${at}.perSite.${site}`, 'not a non-background site class');
        }
        if (!isOrdinal(e.background)) problem('effect-invalid', `${at}.background`, 'expected 0..4');
        return;
      default:
        return;
    }
  };
  if (isObj(content.rules)) {
    const at = 'rules.json';
    if (!Array.isArray(content.rules.hypothesisRules)) problem('schema', `${at}.hypothesisRules`, 'expected an array');
    else
      content.rules.hypothesisRules.forEach((r, i) => {
        if (!isObj(r) || !/^R-hyp-/.test(String(r.id)))
          problem('schema', `${at}.hypothesisRules[${i}]`, 'expected an R-hyp-* rule');
        if (!isObj(r) || !HYPOTHESES.includes(r.conditionalOn))
          problem(
            'hypothesis-rule-without-condition',
            `${at}.hypothesisRules[${i}]`,
            'R-hyp-* rules must carry conditionalOn'
          );
      });
    nonEmpty(content.rules.note, `${at}.note`);
  }
  items('rules').forEach((r, i) => {
    const at = `rules.items[${i}] (${r.id})`;
    nonEmpty(r.title, `${at}.title`);
    claimRefs(r.claims, `${at}.claims`, 'rule-without-claim');
    oneOf(r.basis, BASIS, `${at}.basis`, 'basis-invalid');
    nonEmpty(r.system, `${at}.system`);
    oneOf(r.transferable, TRANSFERABLE, `${at}.transferable`);
    if (r.conditionalOn !== null) oneOf(r.conditionalOn, HYPOTHESES, `${at}.conditionalOn`);
    if (typeof r.informational !== 'boolean') problem('schema', `${at}.informational`, 'expected a boolean');
    if (!Array.isArray(r.effect) || !r.effect.length)
      problem('effect-invalid', `${at}.effect`, 'expected a non-empty array');
    else r.effect.forEach((e, j) => checkEffect(e, `${at}.effect[${j}]`));
    if (r.informational) {
      if (r.when !== null) problem('schema', `${at}.when`, 'informational rules carry when: null');
      if (Array.isArray(r.effect) && r.effect.some(e => e.op !== 'caveat'))
        problem('schema', `${at}.effect`, 'informational rules carry only caveat effects');
    } else checkWhen(r.when, `${at}.when`);
    if (/^R-hyp-/.test(r.id)) problem('schema', at, 'R-hyp-* rules live in hypothesisRules, and v1 ships none');
    // §11: every reaction rule (a step rule named R-react-*) is free-bench only; every R-model-*
    // step rule and R-order-01 are practice only; no R-model-* rule fires on a free run.
    const whenText = JSON.stringify(r.when);
    const stepRule = /"step":|"event":"(step|dip)"/.test(whenText);
    if (/^R-react-/.test(r.id) && stepRule && !/"mode":"free"/.test(whenText))
      problem('mode-invalid', `${at}.when`, 'R-react-* step rules carry { mode: "free" }');
    if (/^R-react-/.test(r.id) && stepRule && !(r.effect || []).some(e => e.op === 'react'))
      problem('effect-invalid', `${at}.effect`, 'R-react-* step rules carry a react op');
    if ((/^R-model-/.test(r.id) || r.id === 'R-order-01') && !/"mode":"practice"/.test(whenText))
      problem('mode-invalid', `${at}.when`, `${r.id} carries { mode: "practice" }`);
    if (/^R-model-/.test(r.id) && r.basis !== 'schematic-analogy')
      problem('basis-invalid', `${at}.basis`, 'R-model-* rules are schematic-analogy');
    const strengths = new Set((r.claims || []).map(id => claimById.get(id)?.strength));
    if (strengths.has('published-qualitative') && strengths.has('schematic-analogy') && r.basis !== 'schematic-analogy')
      problem('basis-invalid', `${at}.basis`, 'a rule mixing published and schematic claims is schematic-analogy');
    const caveats = (r.effect || []).filter(e => e.op === 'caveat').map(e => e.text);
    if ((r.id === 'R-model-01' || r.id === 'R-model-06') && !caveats.includes(SHARED_ENDPOINT_CAVEAT))
      problem('schema', at, 'must carry the shared endpoint caveat');
    if (r.id === 'R-model-04' && !caveats.some(text => /no source in the registry supports or refutes/.test(text)))
      problem('schema', at, 'must carry the no-source caveat for the extended term');
    if (r.id === 'R-method-03-cps2') {
      if ((r.claims || []).includes('C-velasco-1992-normal-neurites-unstained'))
        problem('schema', `${at}.claims`, 'unstained normal neurites is verified for CPS-I only');
      if (!caveats.some(text => /unstained normal neurites for CPS-I, not CPS-II/.test(text)))
        problem('schema', at, 'must carry the CPS-I-only caveat for its axon and plaque-core readings');
    }
    if (CPS_OUTCOMES[r.id]) {
      const outcome = (r.effect || []).find(e => e.op === 'schematicOutcome');
      if (
        !outcome ||
        JSON.stringify(outcome.perSite) !== JSON.stringify(CPS_OUTCOMES[r.id].perSite) ||
        outcome.background !== 0
      )
        problem('schema', at, 'schematicOutcome must match the contract §3 values');
      if (!caveats.includes(COMPARE_ONLY_CAVEAT)) problem('schema', at, 'must carry the compare-only caveat');
      if (!isObj(r.when) || r.when.path !== 'method')
        problem('when-invalid', `${at}.when`, 'compare-only rules match on method');
    }
    if (r.id === 'R-temp-01' && JSON.stringify(r.when).indexOf('"params.impregnation.temperature"') < 0)
      problem('when-invalid', `${at}.when`, 'R-temp-01 reads params.impregnation.temperature');
    if (r.id === 'R-norm-01' && (!isObj(r.when) || r.when.path !== 'specimen.role'))
      problem('when-invalid', `${at}.when`, 'R-norm-01 reads specimen.role');
    if (r.id === 'R-order-01' && !/"deviation":"out-of-order"/.test(JSON.stringify(r.when)))
      problem('when-invalid', `${at}.when`, 'R-order-01 matches the out-of-order deviation');
  });
  for (const [id, axiom] of Object.entries(AXIOMS)) {
    const r = ruleById.get(id);
    if (!r) problem('axiom-missing', 'rules.json', `${id} is missing`);
    else {
      if (!(r.effect || []).some(e => e.op === axiom.op))
        problem('axiom-missing', `rules ${id}`, `needs an effect with op ${axiom.op}`);
      for (const claimId of axiom.claims)
        if (!(r.claims || []).includes(claimId)) problem('axiom-missing', `rules ${id}.claims`, `must list ${claimId}`);
      if (r.informational) problem('axiom-missing', `rules ${id}`, 'axioms are evaluated, not informational');
    }
  }

  // methods.json
  const stationOf = {};
  if (isObj(content.methods)) {
    const stations = content.methods.stations;
    if (!Array.isArray(stations)) problem('station-unknown', 'methods.json.stations', 'expected an array');
    else {
      if (JSON.stringify(stations.map(s => s && s.id)) !== JSON.stringify(STATION_IDS))
        problem('station-unknown', 'methods.json.stations', `ids must be ${STATION_IDS.join(', ')} in order`);
      stations.forEach((station, i) => {
        const at = `methods.stations[${i}]`;
        if (!isObj(station)) return problem('station-unknown', at, 'expected an object');
        nonEmpty(station.title, `${at}.title`);
        if (station.studentTitle !== undefined) nonEmpty(station.studentTitle, `${at}.studentTitle`);
        if (station.id === 'S9' && (station.studentTitle !== 'Your jars' || (station.steps || []).length))
          problem('station-unknown', at, 'S9 is "Your jars" (studentTitle "Your jars") with no procedure step');
        if (!Array.isArray(station.steps)) return problem('station-unknown', `${at}.steps`, 'expected an array');
        for (const stepId of station.steps) {
          if (!STEPS.includes(stepId)) problem('station-unknown', `${at}.steps`, `${stepId} is not a step`);
          else if (stationOf[stepId])
            problem('station-unknown', `${at}.steps`, `${stepId} is already in ${stationOf[stepId]}`);
          else stationOf[stepId] = station.id;
        }
      });
      for (const stepId of STEPS)
        if (!stationOf[stepId]) problem('station-unknown', 'methods.json.stations', `${stepId} is in no station`);
    }
  }
  const probeIds = new Set();
  items('methods').forEach((m, i) => {
    const at = `methods.items[${i}] (${m.id})`;
    oneOf(m.id, METHODS, `${at}.id`);
    nonEmpty(m.title, `${at}.title`);
    if (typeof m.runnable !== 'boolean') problem('schema', `${at}.runnable`, 'expected a boolean');
    sourceRefs(m.sources, `${at}.sources`, 'method-without-source');
    if (m.compareOnly) {
      if (m.runnable) problem('schema', `${at}.runnable`, 'compare-only methods are not runnable');
      if ('steps' in m) problem('method-compare-only-has-steps', `${at}.steps`, 'compare-only methods carry no steps');
      if ('schematicOutcome' in m)
        problem('schema', `${at}.schematicOutcome`, 'the outcome lives in rules.json (outcomeRule)');
      const rule = ruleById.get(m.outcomeRule);
      if (!rule || !(rule.effect || []).some(e => e.op === 'schematicOutcome'))
        problem(
          'outcome-rule-unknown',
          `${at}.outcomeRule`,
          `${m.outcomeRule} is not a rule with a schematicOutcome effect`
        );
      return;
    }
    if (!m.runnable) problem('schema', `${at}.runnable`, 'a method is either runnable or compareOnly');
    if (!Array.isArray(m.steps)) problem('schema', `${at}.steps`, 'expected an array');
    else {
      if (JSON.stringify(m.steps.map(s => s && s.id)) !== JSON.stringify(STEPS))
        problem('step-unknown', `${at}.steps`, 'step ids must be the nine STEPS in procedure order');
      m.steps.forEach((s, j) => {
        const sat = `${at}.steps[${j}] (${s && s.id})`;
        if (!isObj(s)) return problem('schema', sat, 'expected an object');
        if (!STEPS.includes(s.id)) problem('step-unknown', `${sat}.id`, `${s.id} is not a step`);
        nonEmpty(s.title, `${sat}.title`);
        if (s.order !== j + 1) problem('schema', `${sat}.order`, `expected ${j + 1}`);
        if (!isObj(s.purpose)) problem('schema', `${sat}.purpose`, 'expected { text, basis, claims }');
        else {
          nonEmpty(s.purpose.text, `${sat}.purpose.text`);
          oneOf(s.purpose.basis, ['course-handout', 'placeholder'], `${sat}.purpose.basis`, 'basis-invalid');
          if (s.purpose.basis === 'placeholder') {
            if (s.purpose.text !== PURPOSE_PLACEHOLDER)
              problem('schema', `${sat}.purpose.text`, `placeholder text must be "${PURPOSE_PLACEHOLDER}"`);
            if (!Array.isArray(s.purpose.claims) || s.purpose.claims.length)
              problem('schema', `${sat}.purpose.claims`, 'placeholder purposes carry []');
          } else claimRefs(s.purpose.claims, `${sat}.purpose.claims`, 'purpose-without-claim');
        }
        if (!isObj(s.quantities) || !Object.keys(s.quantities).length)
          problem('schema', `${sat}.quantities`, 'expected an object');
        else {
          // A quantity other than "unspecified" needs a sourced purpose: the course procedure (basis
          // course-handout) with at least one claim; a placeholder step carries no quantity (SOP-1).
          const sourced =
            isObj(s.purpose) &&
            s.purpose.basis === 'course-handout' &&
            Array.isArray(s.purpose.claims) &&
            s.purpose.claims.length > 0;
          for (const [key, value] of Object.entries(s.quantities))
            if (value !== 'unspecified' && !(sourced && typeof value === 'string' && value.trim()))
              problem(
                'quantity-not-unspecified-without-source',
                `${sat}.quantities.${key}`,
                'a quantity needs a sourced purpose (basis course-handout with claims); otherwise "unspecified"'
              );
        }
        if (!Array.isArray(s.hazards)) problem('schema', `${sat}.hazards`, 'expected an array');
        else
          for (const h of s.hazards)
            if (!ids.safety.has(h)) problem('hazard-unknown', `${sat}.hazards`, `unknown hazard ${h}`);
        if (!STATION_IDS.includes(s.station))
          problem('station-unknown', `${sat}.station`, `${s.station} is not a station`);
        else if (stationOf[s.id] && stationOf[s.id] !== s.station)
          problem('station-unknown', `${sat}.station`, `step is listed under ${stationOf[s.id]}`);
        if (![true, false, 'unspecified'].includes(s.requiresHood))
          problem('schema', `${sat}.requiresHood`, 'expected true, false or "unspecified"');
      });
    }
    if (!Array.isArray(m.probes)) problem('schema', `${at}.probes`, 'expected an array');
    else
      m.probes.forEach((p, j) => {
        const pat = `${at}.probes[${j}]`;
        if (!isObj(p)) return problem('schema', pat, 'expected an object');
        nonEmpty(p.id, `${pat}.id`);
        nonEmpty(p.title, `${pat}.title`);
        oneOf(p.status, ['pending-instructor'], `${pat}.status`);
        probeIds.add(p.id);
      });
  });

  // specimens.json
  items('specimens').forEach((sp, i) => {
    const at = `specimens.items[${i}] (${sp.id})`;
    nonEmpty(sp.label, `${at}.label`);
    nonEmpty(sp.notes, `${at}.notes`);
    if (sp.kind !== 'synthetic-schematic') problem('schema', `${at}.kind`, 'v1 specimens are synthetic-schematic');
    for (const key of ['species', 'region', 'fixation', 'thicknessUm'])
      if (sp[key] !== null) problem('schema', `${at}.${key}`, 'nothing about real tissue is known; must be null');
    if (sp.processingKnown !== false) problem('schema', `${at}.processingKnown`, 'must be false');
    if (!Number.isInteger(sp.seed)) problem('schema', `${at}.seed`, 'expected an integer');
    oneOf(sp.role, ROLES, `${at}.role`);
    if (SPECIMEN_ROLES[sp.id] && sp.role !== SPECIMEN_ROLES[sp.id])
      problem('schema', `${at}.role`, `contract role is ${SPECIMEN_ROLES[sp.id]}`);
    if (sp.assetId !== null && !ids.assets.has(sp.assetId))
      problem('schema', `${at}.assetId`, 'expected null or an asset id');
    if (!isObj(sp.sites)) problem('schema', `${at}.sites`, 'expected an object');
    else {
      if (JSON.stringify(Object.keys(sp.sites).sort()) !== JSON.stringify([...TARGET_SITES].sort()))
        problem('schema', `${at}.sites`, 'exactly one entry per non-background site class');
      for (const [siteId, value] of Object.entries(sp.sites)) {
        if (!isObj(value) || !isOrdinal(value.presence) || !isOrdinal(value.reductionSites))
          problem('schema', `${at}.sites.${siteId}`, 'expected { presence: 0..4, reductionSites: 0..4 }');
        else if (SPECIMEN_SITES[sp.id] && SPECIMEN_SITES[sp.id][siteId]) {
          const [presence, reductionSites] = SPECIMEN_SITES[sp.id][siteId];
          if (value.presence !== presence || value.reductionSites !== reductionSites)
            problem('schema', `${at}.sites.${siteId}`, `contract values are {${presence}, ${reductionSites}}`);
        }
      }
    }
  });

  // safety.json
  items('safety').forEach((h, i) => {
    const at = `safety.items[${i}] (${h.id})`;
    nonEmpty(h.title, `${at}.title`);
    nonEmpty(h.text, `${at}.text`);
    if (h.sourceId !== PENDING && !ids.sources.has(h.sourceId))
      problem('hazard-without-source', `${at}.sourceId`, `expected a source id or ${PENDING}`);
    if (h.sourceId === PENDING && !/pending/i.test(h.text))
      problem('hazard-without-source', `${at}.text`, 'PENDING-EHS text must say the information is pending');
    if (!Array.isArray(h.stations)) problem('schema', `${at}.stations`, 'expected an array');
    else
      for (const s of h.stations)
        if (!STATION_IDS.includes(s)) problem('station-unknown', `${at}.stations`, `${s} is not a station`);
  });

  // modules.json
  const modules = items('modules');
  if (JSON.stringify(modules.map(m => m && m.id)) !== JSON.stringify(REQUIRED.modules))
    problem('schema', 'modules.json.items', 'ids must be M1..M7 in order');
  const factClaims = {};
  modules.forEach((m, i) => {
    const at = `modules.items[${i}] (${m.id})`;
    nonEmpty(m.title, `${at}.title`);
    nonEmpty(m.goal, `${at}.goal`);
    if (m.order !== i + 1) problem('schema', `${at}.order`, `expected ${i + 1}`);
    if (m.week !== undefined && m.week !== m.order)
      problem('schema', `${at}.week`, 'must equal order while lab.js still reads week');
    if (m.activityUrl !== ACTIVITY_URLS[i])
      problem('activity-url', `${at}.activityUrl`, `expected ${ACTIVITY_URLS[i]}`);
    if (!Array.isArray(m.steps) || !m.steps.length) problem('schema', `${at}.steps`, 'expected a non-empty array');
    else {
      const fields = new Set();
      m.steps.forEach((s, j) => {
        const sat = `${at}.steps[${j}]`;
        if (!isObj(s)) return problem('schema', sat, 'expected an object');
        oneOf(s.kind, STEP_KINDS, `${sat}.kind`);
        nonEmpty(s.prompt, `${sat}.prompt`);
        if (s.kind === 'clip') {
          // Contract §7: the clip step is an instruction that opens the bench intro; it writes no field of its own.
          if (s.field !== undefined) nonEmpty(s.field, `${sat}.field`);
        } else {
          if (typeof s.prompt === 'string' && !s.prompt.includes('?'))
            problem('prompt-not-question', `${sat}.prompt`, 'prompts are questions to the student');
          nonEmpty(s.field, `${sat}.field`);
        }
        if (s.field !== undefined) {
          if (fields.has(s.field)) problem('schema', `${sat}.field`, `duplicate field ${s.field}`);
          fields.add(s.field);
        }
        if (typeof s.required !== 'boolean') problem('schema', `${sat}.required`, 'expected a boolean');
      });
      if (m.id === 'M1' && !(isObj(m.steps[0]) && m.steps[0].kind === 'clip'))
        problem('schema', `${at}.steps[0]`, 'M1 opens with the clip step (contract §7)');
    }
    factClaims[m.id] = new Set();
    if (!Array.isArray(m.facts)) problem('schema', `${at}.facts`, 'expected an array');
    else {
      m.facts.forEach((f, j) => {
        const fat = `${at}.facts[${j}]`;
        if (!isObj(f)) return problem('schema', fat, 'expected an object');
        nonEmpty(f.text, `${fat}.text`);
        claimRefs(f.claims, `${fat}.claims`, 'module-fact-without-claim');
        for (const id of f.claims || []) factClaims[m.id].add(id);
      });
      const texts = m.facts.map(f => (f && f.text) || '');
      if (!texts.some(t => /illustrative simulation/i.test(t)) || !texts.some(t => /darker .* does not mean/i.test(t)))
        problem(
          'module-notice-missing',
          `${at}.facts`,
          'must say outputs are illustrative simulations and that darker does not mean more'
        );
    }
    if (!Array.isArray(m.engine) || !m.engine.length) problem('schema', `${at}.engine`, 'expected a non-empty array');
    else for (const fn of m.engine) oneOf(fn, ENGINE_FUNCTIONS, `${at}.engine`);
    if (!Array.isArray(m.specimens)) problem('schema', `${at}.specimens`, 'expected an array');
    else
      for (const id of m.specimens)
        if (!ids.specimens.has(id)) problem('default-run-invalid', `${at}.specimens`, `unknown specimen ${id}`);
    if (!Array.isArray(m.defaultRuns)) problem('schema', `${at}.defaultRuns`, 'expected an array');
    else
      m.defaultRuns.forEach((r, j) => {
        const rat = `${at}.defaultRuns[${j}]`;
        if (!isObj(r)) return problem('default-run-invalid', rat, 'expected an object');
        nonEmpty(r.label, `${rat}.label`);
        if (!ids.specimens.has(r.specimenId))
          problem('default-run-invalid', `${rat}.specimenId`, `unknown specimen ${r.specimenId}`);
        if (!ids.methods.has(r.method)) problem('default-run-invalid', `${rat}.method`, `unknown method ${r.method}`);
        if (!isObj(r.params)) return problem('default-run-invalid', `${rat}.params`, 'expected an object');
        const leaves = [];
        const flatten = (node, prefix) => {
          for (const [key, value] of Object.entries(node)) {
            const dotted = prefix ? `${prefix}.${key}` : key;
            if (isObj(value)) flatten(value, dotted);
            else leaves.push([dotted, value]);
          }
        };
        flatten(r.params, '');
        for (const [dotted, value] of leaves) {
          const allowed = PARAM_LEAVES[dotted];
          if (!allowed) problem('default-run-invalid', `${rat}.params.${dotted}`, 'not a RunParams path');
          else if (allowed === 'boolean') {
            if (typeof value !== 'boolean')
              problem('default-run-invalid', `${rat}.params.${dotted}`, 'expected a boolean');
          } else if (allowed === 'probe') {
            if (value !== 'none' && !probeIds.has(value))
              problem('default-run-invalid', `${rat}.params.${dotted}`, `${value} is not none or a probe id`);
          } else oneOf(value, allowed, `${rat}.params.${dotted}`, 'default-run-invalid');
        }
      });
  });
  for (const [moduleId, ruleId] of [
    ['M4', 'R-intensity-01'],
    ['M5', 'R-interlab-01'],
  ]) {
    const rule = ruleById.get(ruleId);
    if (rule && factClaims[moduleId])
      for (const claimId of rule.claims || [])
        if (!factClaims[moduleId].has(claimId))
          problem('module-fact-without-claim', `modules ${moduleId}.facts`, `must cite ${claimId} (${ruleId})`);
  }
  if (isObj(content.modules)) {
    const measurements = content.modules.measurements;
    if (!Array.isArray(measurements)) problem('schema', 'modules.json.measurements', 'expected an array');
    else {
      const seen = new Set();
      measurements.forEach((mr, i) => {
        const at = `modules.measurements[${i}]`;
        if (!isObj(mr)) return problem('schema', at, 'expected an object');
        nonEmpty(mr.id, `${at}.id`);
        if (seen.has(mr.id)) problem('duplicate-id', at, `duplicate id ${mr.id}`);
        seen.add(mr.id);
        nonEmpty(mr.title, `${at}.title`);
        nonEmpty(mr.rule, `${at}.rule`);
        oneOf(mr.unit, MEASUREMENT_UNITS, `${at}.unit`);
        if (typeof mr.manual !== 'boolean') problem('schema', `${at}.manual`, 'expected a boolean');
        if (Array.isArray(mr.claims)) claimRefs(mr.claims, `${at}.claims`, 'module-fact-without-claim');
      });
      for (const id of MEASUREMENT_IDS)
        if (!seen.has(id)) problem('required-id-missing', 'modules.json.measurements', `missing ${id}`);
    }
  }

  // assets.json (§3; §12.1 for real reference slides)
  const sourceById = byId('sources');
  items('assets').forEach((a, i) => {
    const at = `assets.items[${i}] (${a.id})`;
    oneOf(a.kind, ASSET_KINDS, `${at}.kind`);
    if (!LABELS.includes(a.label)) problem('asset-without-label', `${at}.label`, 'expected an output label');
    if (a.label === VALIDATED)
      problem('validated-label-present', `${at}.label`, 'validated-prediction has zero members');
    const rightsKnown = isObj(a.rights) && typeof a.rights.status === 'string' && a.rights.status !== 'unknown';
    if (!rightsKnown) problem('asset-rights-unknown', `${at}.rights`, 'rights.status must be known');
    nonEmpty(a.description, `${at}.description`);
    if ('specimenId' in a && !ids.specimens.has(a.specimenId))
      problem('schema', `${at}.specimenId`, `unknown specimen ${a.specimenId}`);
    if (a.kind !== 'reference-image') return;

    // A real photo of a published slide: its rights, its source's rights, what it stands for, and the file.
    if (rightsKnown) {
      oneOf(a.rights.status, REFERENCE_RIGHTS, `${at}.rights.status`, 'asset-rights-unknown');
      nonEmpty(a.rights.changes, `${at}.rights.changes`);
    }
    if (!ids.sources.has(a.sourceId)) problem('asset-source-missing', `${at}.sourceId`, `unknown source ${a.sourceId}`);
    else {
      const rights = sourceById.get(a.sourceId).rights;
      if (!REFERENCE_SOURCE_RIGHTS.includes(rights))
        problem(
          'asset-source-rights',
          `${at}.sourceId`,
          `${a.sourceId} has rights ${JSON.stringify(rights)}, not one of ${REFERENCE_SOURCE_RIGHTS.join(' | ')}`
        );
    }
    if (!('specimenId' in a))
      problem('schema', `${at}.specimenId`, 'a reference image names the specimen it illustrates');
    oneOf(a.role, ASSET_ROLES, `${at}.role`);
    if (!Array.isArray(a.looks) || !a.looks.length)
      problem('asset-looks-invalid', `${at}.looks`, 'expected a non-empty list of look keys');
    else for (const key of a.looks) oneOf(key, LOOK_KEYS, `${at}.looks`, 'asset-looks-invalid');
    if (typeof a.description === 'string') {
      if (!a.description.startsWith(REFERENCE_DESCRIPTION_START))
        problem('schema', `${at}.description`, `must start with "${REFERENCE_DESCRIPTION_START}"`);
      const words = wordCount(a.description);
      if (words > REFERENCE_MAX_WORDS)
        problem('student-text-too-long', `${at}.description`, `${words} words, limit ${REFERENCE_MAX_WORDS}`);
    }
    for (const field of ['stain', 'tissue']) {
      nonEmpty(a[field], `${at}.${field}`);
      if (/\bcourse\b/i.test(String(a[field])))
        problem('schema', `${at}.${field}`, "uses the authors' words, never the course");
    }
    nonEmpty(a.figure, `${at}.figure`);
    if (!Number.isInteger(a.width) || a.width <= 0 || !Number.isInteger(a.height) || a.height <= 0)
      problem('schema', `${at}.width/height`, 'expected positive integer pixel sizes');
    if (typeof a.src !== 'string' || !a.src.startsWith('/') || a.src.startsWith('//'))
      problem('schema', `${at}.src`, 'expected a root-relative URL');
    else if (!/\?v=\d+$/.test(a.src)) problem('schema', `${at}.src`, 'expected a ?v= pin');
    else {
      const file = path.join(ROOT, a.src.replace(/\?.*$/, ''));
      if (!fs.existsSync(file)) problem('asset-file-missing', `${at}.src`, `${a.src} is not on disk`);
      else {
        const size = jpegSize(fs.readFileSync(file));
        if (!size) problem('asset-file-invalid', `${at}.src`, `${a.src} is not a readable JPEG`);
        else if (size.width !== a.width || size.height !== a.height)
          problem(
            'asset-size-mismatch',
            `${at}.width/height`,
            `item says ${a.width}×${a.height}, the file is ${size.width}×${size.height}`
          );
      }
    }
  });

  // clip.json (contract §7 and §7.1): the fixed label and top-level captions; scene ids in the fixed order; every
  // fact (scene, structure sub-caption or top-level caption) cites claims that exist; the structures scene carries
  // one sub-caption per non-background site class, in SITE_CLASSES order, titled with the SITE_TEXT name.
  if (isObj(content.clip)) {
    const at = 'clip.json';
    if (content.clip.label !== CLIP_LABEL) problem('schema', `${at}.label`, `must be "${CLIP_LABEL}"`);
    for (const key of CLIP_CAPTIONS) nonEmpty(content.clip[key], `${at}.${key}`);
    if (typeof content.clip.noBasisCaption === 'string' && !content.clip.noBasisCaption.includes('{explanation}'))
      problem('schema', `${at}.noBasisCaption`, 'must carry the {explanation} placeholder');
    if (
      typeof content.clip.developmentNotDone === 'string' &&
      !/binding is not development/i.test(content.clip.developmentNotDone)
    )
      problem('clip-notice-missing', `${at}.developmentNotDone`, 'must say that binding is not development');
    if (
      typeof content.clip.impregnationNotDone === 'string' &&
      !/not been performed/i.test(content.clip.impregnationNotDone)
    )
      problem('clip-notice-missing', `${at}.impregnationNotDone`, 'must say the step has not been performed');
    const checkFacts = (facts, fat, owner) => {
      if (!Array.isArray(facts)) return problem('schema', fat, 'expected an array');
      facts.forEach((f, k) => {
        const p = `${fat}[${k}]`;
        if (!isObj(f)) return problem('schema', p, 'expected { text, claims }');
        nonEmpty(f.text, `${p}.text`);
        if (!Array.isArray(f.claims) || !f.claims.length)
          problem('clip-fact-without-claim', p, `${owner} fact needs at least one claim id`);
        else
          for (const id of f.claims)
            if (!ids.claims.has(id)) problem('clip-fact-without-claim', `${p}.claims`, `unknown claim ${id}`);
      });
    };
    const scenes = items('clip');
    const sceneIds = scenes.map(s => (isObj(s) ? s.id : undefined));
    let listed = 0;
    sceneIds.forEach((id, i) => {
      if (CLIP_SCENES.includes(id)) return;
      listed += 1;
      problem('clip-scene-unknown', `${at}.items[${i}].id`, `${JSON.stringify(id)} is not a clip scene`);
    });
    for (const id of CLIP_SCENES)
      if (!sceneIds.includes(id)) {
        listed += 1;
        problem('clip-scene-unknown', `${at}.items`, `scene ${id} is missing`);
      }
    if (!listed && sceneIds.join(',') !== CLIP_SCENES.join(','))
      problem('clip-scene-unknown', `${at}.items`, `scenes must be in the order ${CLIP_SCENES.join(', ')}`);
    scenes.forEach((scene, i) => {
      if (!isObj(scene)) return;
      const sat = `${at}.items[${i}] (${scene.id})`;
      nonEmpty(scene.title, `${sat}.title`);
      nonEmpty(scene.caption, `${sat}.caption`);
      if (!Number.isInteger(scene.durationMs) || scene.durationMs < 4000 || scene.durationMs > 9000)
        problem('schema', `${sat}.durationMs`, 'expected an integer 4000..9000 (a hint for the director)');
      checkFacts(scene.facts, `${sat}.facts`, `scene ${scene.id}`);
      const texts = [scene.caption, ...(Array.isArray(scene.facts) ? scene.facts.map(f => f && f.text) : [])].map(
        String
      );
      for (const re of CLIP_NOTICES[scene.id] || [])
        if (!texts.some(t => re.test(t))) problem('clip-notice-missing', sat, `caption or a fact must match ${re}`);
      if (!Array.isArray(scene.sub)) return problem('schema', `${sat}.sub`, 'expected an array');
      scene.sub.forEach((sub, j) => {
        const sp = `${sat}.sub[${j}]`;
        if (!isObj(sub)) return problem('schema', sp, 'expected { site, title, caption, facts }');
        if (!TARGET_SITES.includes(sub.site))
          problem('clip-site-unknown', `${sp}.site`, `${JSON.stringify(sub.site)} is not a non-background site class`);
        else if (sub.title !== SITE_TEXT[sub.site])
          problem('schema', `${sp}.title`, `expected the SITE_TEXT name "${SITE_TEXT[sub.site]}"`);
        nonEmpty(sub.caption, `${sp}.caption`);
        checkFacts(sub.facts, `${sp}.facts`, `sub ${sub.site}`);
      });
      if (scene.id === 'structures' && scene.sub.map(s => s && s.site).join(',') !== TARGET_SITES.join(','))
        problem(
          'schema',
          `${sat}.sub`,
          `one entry per non-background site class, in order: ${TARGET_SITES.join(', ')}`
        );
    });
    if (content.clip.captionFacts !== undefined) {
      if (!isObj(content.clip.captionFacts))
        problem('schema', `${at}.captionFacts`, 'expected an object keyed by top-level caption');
      else
        for (const [key, facts] of Object.entries(content.clip.captionFacts)) {
          if (!CLIP_CAPTIONS.includes(key))
            problem('schema', `${at}.captionFacts.${key}`, `not a top-level caption (${CLIP_CAPTIONS.join(', ')})`);
          checkFacts(facts, `${at}.captionFacts.${key}`, `caption ${key}`);
        }
    }
  }

  // Contract §8.2 (content-check only): goals one sentence, prompts at most two, captions at most 25 words, safety
  // texts at most 20 words (the disclaimer verbatim); the optional student fields are non-empty and the specimen
  // note says the section is not real tissue.
  const limit = (ok, at, message) => ok || problem('student-text-limit', at, message);
  modules.forEach((m, i) => {
    const at = `modules.items[${i}] (${m.id})`;
    if (typeof m.goal === 'string') limit(sentenceCount(m.goal) <= 1, `${at}.goal`, 'one sentence');
    (Array.isArray(m.steps) ? m.steps : []).forEach((s, j) => {
      if (isObj(s) && typeof s.prompt === 'string')
        limit(sentenceCount(s.prompt) <= 2, `${at}.steps[${j}].prompt`, 'at most two sentences');
    });
  });
  if (isObj(content.clip)) {
    const captions = CLIP_CAPTIONS.map(key => [`clip.json.${key}`, content.clip[key]]);
    for (const scene of items('clip').filter(isObj)) {
      captions.push([`clip.json.items (${scene.id}).caption`, scene.caption]);
      for (const sub of Array.isArray(scene.sub) ? scene.sub.filter(isObj) : [])
        captions.push([`clip.json.items (${scene.id}).sub (${sub.site}).caption`, sub.caption]);
    }
    for (const [at, text] of captions)
      if (typeof text === 'string') limit(wordCount(text) <= 25, at, `${wordCount(text)} words; at most 25`);
  }
  items('safety').forEach((h, i) => {
    const at = `safety.items[${i}] (${h.id}).text`;
    if (h.id === 'H-disclaimer') limit(h.text === DISCLAIMER_TEXT, at, 'the disclaimer stays verbatim');
    else if (typeof h.text === 'string') limit(wordCount(h.text) <= 20, at, `${wordCount(h.text)} words; at most 20`);
  });
  const bielschowsky = items('methods').find(m => isObj(m) && m.id === 'bielschowsky-modified');
  ((bielschowsky && bielschowsky.steps) || []).forEach((s, j) => {
    if (isObj(s) && s.studentTitle !== undefined)
      nonEmpty(s.studentTitle, `methods bielschowsky.steps[${j}].studentTitle`);
  });
  items('specimens').forEach((sp, i) => {
    const at = `specimens.items[${i}] (${sp.id})`;
    if (sp.studentLabel !== undefined) nonEmpty(sp.studentLabel, `${at}.studentLabel`);
    if (sp.studentNote !== undefined) {
      nonEmpty(sp.studentNote, `${at}.studentNote`);
      if (!/not real tissue/i.test(String(sp.studentNote)))
        problem('student-text-limit', `${at}.studentNote`, 'must say the section is not real tissue');
    }
  });

  // reagents.json (contract §13.1): the free bench's shelf, the nine procedure jars and the four handling
  // choices. A bottle runs a registered step or none; every field's default is one of its values and every
  // value has words (the procedure's value marked "(procedure)", nothing marked on an "other" bottle, which
  // carries no strength); a bottle with no step (or a fresh-jar choice) says in at most 30 words why a dip of
  // it is currently unknown; each procedure jar holds the bottle that runs its step, at every default.
  if (isObj(content.reagents)) {
    const at = 'reagents.json';
    const shelf = items('reagents');
    const bottleById = new Map(shelf.filter(isObj).map(r => [r.id, r]));
    const wordsAt = (spec, value) => (isObj(spec.words) ? spec.words[String(value)] : undefined);
    shelf.forEach((r, i) => {
      const rat = `${at}.items[${i}] (${r && r.id})`;
      if (!isObj(r)) return;
      nonEmpty(r.name, `${rat}.name`);
      nonEmpty(r.short, `${rat}.short`);
      oneOf(r.group, REAGENT_GROUPS, `${rat}.group`, 'reagent-invalid');
      if (r.step !== null) oneOf(r.step, STEPS, `${rat}.step`, 'step-unknown');
      if ((r.group === 'procedure') !== (r.step !== null))
        problem(
          'reagent-invalid',
          `${rat}.step`,
          'a procedure bottle runs its step; a pretreatment or other bottle none'
        );
      if (r.claims !== undefined) claimRefs(r.claims, `${rat}.claims`, 'reagent-invalid');
      if (!isObj(r.fields)) return problem('reagent-invalid', `${rat}.fields`, 'expected an object (empty: no fields)');
      if (r.group === 'other' && 'strength' in r.fields)
        problem('reagent-invalid', `${rat}.fields.strength`, 'no strength is invented for an "other" bottle');
      for (const [field, spec] of Object.entries(r.fields)) {
        const fat = `${rat}.fields.${field}`;
        oneOf(field, REAGENT_FIELDS, fat, 'reagent-invalid');
        if (!isObj(spec) || !Array.isArray(spec.values) || !spec.values.length) {
          problem('reagent-invalid', fat, 'expected { values: [...], default, words }');
          continue;
        }
        if (new Set(spec.values.map(String)).size !== spec.values.length)
          problem('reagent-invalid', `${fat}.values`, 'values must be unique');
        if (!spec.values.includes(spec.default))
          problem('reagent-invalid', `${fat}.default`, `${JSON.stringify(spec.default)} is not one of the values`);
        if (!isObj(spec.words)) problem('reagent-invalid', `${fat}.words`, 'expected words for every value');
        else
          for (const key of Object.keys(spec.words))
            if (!spec.values.map(String).includes(key))
              problem('reagent-invalid', `${fat}.words.${key}`, 'words for a value the field does not list');
        for (const value of spec.values) {
          const words = wordsAt(spec, value);
          nonEmpty(words, `${fat}.words.${value}`);
          if (typeof words !== 'string') continue;
          const marked = words.includes(PROCEDURE_MARK);
          if (r.group === 'other' && marked)
            problem('reagent-invalid', `${fat}.words.${value}`, 'an "other" bottle has no procedure value to mark');
          else if (r.group !== 'other' && value === spec.default && !words.endsWith(` ${PROCEDURE_MARK}`))
            problem(
              'reagent-invalid',
              `${fat}.words.${value}`,
              `the procedure's value is worded "… ${PROCEDURE_MARK}"`
            );
          else if (r.group !== 'other' && value !== spec.default && marked)
            problem(
              'reagent-invalid',
              `${fat}.words.${value}`,
              `only the procedure's value is marked ${PROCEDURE_MARK}`
            );
        }
      }
      const needsWhy = r.step === null || 'into' in r.fields;
      if (r.unknownWhy !== undefined || needsWhy) {
        nonEmpty(r.unknownWhy, `${rat}.unknownWhy`);
        if (typeof r.unknownWhy === 'string' && wordCount(r.unknownWhy) > UNKNOWN_WHY_MAX_WORDS)
          problem(
            'student-text-too-long',
            `${rat}.unknownWhy`,
            `${wordCount(r.unknownWhy)} words, limit ${UNKNOWN_WHY_MAX_WORDS}`
          );
      }
    });
    const jars = content.reagents.jars;
    if (!isObj(jars)) problem('reagent-invalid', `${at}.jars`, 'expected an object keyed by step id');
    else {
      if (JSON.stringify(Object.keys(jars)) !== JSON.stringify(STEPS))
        problem('reagent-invalid', `${at}.jars`, 'one jar per procedure step, in procedure order');
      for (const [stepId, solution] of Object.entries(jars)) {
        const jat = `${at}.jars.${stepId}`;
        const bottle = isObj(solution) ? bottleById.get(solution.reagent) : undefined;
        if (!bottle) {
          problem('reagent-invalid', `${jat}.reagent`, 'expected a bottle on the shelf');
          continue;
        }
        if (bottle.step !== stepId) problem('reagent-invalid', `${jat}.reagent`, `${bottle.id} does not run ${stepId}`);
        const fields = isObj(bottle.fields) ? bottle.fields : {};
        for (const [field, spec] of Object.entries(fields))
          if (!isObj(spec) || solution[field] !== spec.default)
            problem(
              'reagent-invalid',
              `${jat}.${field}`,
              `expected the procedure's value ${JSON.stringify(spec && spec.default)}`
            );
        for (const key of Object.keys(solution))
          if (key !== 'reagent' && !(key in fields))
            problem('reagent-invalid', `${jat}.${key}`, `${bottle.id} has no field ${key}`);
      }
    }
    const handling = content.reagents.handling;
    if (!Array.isArray(handling)) problem('reagent-invalid', `${at}.handling`, 'expected an array');
    else {
      if (JSON.stringify(handling.map(h => h && h.id)) !== JSON.stringify(HANDLING_IDS))
        problem('reagent-invalid', `${at}.handling`, `ids must be ${HANDLING_IDS.join(', ')} in order`);
      handling.forEach((h, i) => {
        const hat = `${at}.handling[${i}] (${h && h.id})`;
        if (!isObj(h)) return;
        nonEmpty(h.label, `${hat}.label`);
        const values = Array.isArray(h.values) ? h.values : [];
        if (values.length < 2 || values.some(v => !isObj(v)))
          return problem('reagent-invalid', `${hat}.values`, 'expected at least two { id, words }');
        if (new Set(values.map(v => v.id)).size !== values.length)
          problem('reagent-invalid', `${hat}.values`, 'value ids must be unique');
        values.forEach((v, j) => {
          nonEmpty(v.id, `${hat}.values[${j}].id`);
          nonEmpty(v.words, `${hat}.values[${j}].words`);
          const marked = typeof v.words === 'string' && v.words.endsWith(` ${PROCEDURE_MARK}`);
          if (marked !== (j === 0))
            problem(
              'reagent-invalid',
              `${hat}.values[${j}].words`,
              `the procedure's choice comes first, worded "… ${PROCEDURE_MARK}"`
            );
        });
        if (h.default !== values[0].id)
          problem('reagent-invalid', `${hat}.default`, "the default is the procedure's choice, listed first");
      });
    }
    walkReagentStrings(content.reagents, at, (value, sat) => {
      if (/\bpending\b/i.test(value)) problem('student-text-limit', sat, 'no student-facing text says "pending"');
    });
  }

  // Every string value, every file: no disposal phrases, no validated-prediction label (value equality).
  const walk = (value, at) => {
    if (typeof value === 'string') {
      if (FORBIDDEN_DISPOSAL.test(value) && !/^sources\.items\[\d+\]\.excluded/.test(at))
        problem(
          'forbidden-disposal-phrase',
          at,
          'disposal wording must come from the current institutional procedure, not the legacy protocol'
        );
      if (value === VALIDATED) problem('validated-label-present', at, 'validated-prediction has zero members in v1');
    } else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${at}[${i}]`));
    else if (isObj(value)) for (const [key, v] of Object.entries(value)) walk(v, `${at}.${key}`);
  };
  for (const name of FILES) walk(content[name], name);

  return problems;
}

function loadLabContent(dir = DATA_DIR) {
  const content = {};
  const problems = [];
  for (const name of FILES) {
    try {
      content[name] = JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'));
    } catch (error) {
      content[name] = null;
      problems.push({ code: 'json-parse', path: `${name}.json`, message: error.message });
    }
  }
  return { content, problems };
}

function engineLint(content) {
  const enginePath = path.join(ROOT, 'silver-lab-core.js');
  if (!fs.existsSync(enginePath)) return { ran: false, problems: [] };
  let SilverLab;
  try {
    SilverLab = require(enginePath);
  } catch (error) {
    return {
      ran: true,
      problems: [{ code: 'engine-load-failed', path: 'silver-lab-core.js', message: error.message }],
    };
  }
  if (!SilverLab || typeof SilverLab.lint !== 'function')
    return {
      ran: true,
      problems: [
        { code: 'engine-lint-missing', path: 'silver-lab-core.js', message: 'SilverLab.lint is not a function' },
      ],
    };
  try {
    const found = SilverLab.lint(content);
    if (!Array.isArray(found))
      return {
        ran: true,
        problems: [
          { code: 'engine-lint-invalid', path: 'silver-lab-core.js', message: 'lint did not return an array' },
        ],
      };
    return {
      ran: true,
      problems: found.map(p => ({ code: `engine:${p.code}`, path: String(p.path), message: String(p.message) })),
    };
  } catch (error) {
    return { ran: true, problems: [{ code: 'engine-lint-threw', path: 'silver-lab-core.js', message: error.message }] };
  }
}

if (require.main === module) {
  const { content, problems: parseProblems } = loadLabContent();
  const problems = parseProblems.length ? parseProblems : lintLabContent(content);
  const engine = parseProblems.length ? { ran: false, problems: [] } : engineLint(content);
  problems.push(...engine.problems);
  if (problems.length) {
    console.error(`lab content FAILED: ${problems.length} problem(s)`);
    for (const p of problems) console.error(`  ${p.code.padEnd(40)} ${p.path}: ${p.message}`);
    process.exitCode = 1;
  } else {
    const count = name => content[name].items.length;
    console.log(
      `lab content OK (${count('sources')} sources, ${count('claims')} claims, ${count('rules')} rules, ${count('methods')} methods, ` +
        `${content.methods.stations.length} stations, ${count('specimens')} specimens, ${count('safety')} hazards, ${count('modules')} modules, ` +
        `${content.modules.measurements.length} measurements, ${count('assets')} assets, ${count('clip')} clip scenes, ` +
        `${count('reagents')} reagents, ${Object.keys(content.reagents.jars || {}).length} jars, ${(content.reagents.handling || []).length} handling choices; ` +
        (engine.ran ? 'engine lint clean' : 'engine lint skipped, silver-lab-core.js not present') +
        '). Independent review remains pending.'
    );
  }
}

module.exports = { lintLabContent, loadLabContent, engineLint, FILES, DATA_DIR };
