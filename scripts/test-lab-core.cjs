// Silver-stain engine (silver-lab-core.js): the 18 tests of ALZ-LAB-CONTRACT.md §6 (plus test 19
// for the §7 tissue clip data) against an inline fixture that mirrors the data/lab/*.json schemas,
// then a subset against the shipped data when every data/lab file exists. Nothing here is a
// staining claim; the fixture carries the same source and claim ids the content files must carry.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../silver-lab-core.js');

const ROOT = path.join(__dirname, '..');
const clone = x => JSON.parse(JSON.stringify(x));
// §13.2: the slide flags the reagent shelf's dips set (every run starts with them false).
const SHELF_FLAGS = Object.freeze({
  oxidized: false,
  pretreated: false,
  oldSilver: false,
  longAmmoniacal: false,
  shortXylene: false,
  tooWarm: false,
  pastTen: false,
});

// ---- fixture content (schemas of contract §3) ----------------------------------------------
const ENDPOINT_CAVEAT =
  "Endpoint positions early / sop-default / extended are ordered schematic positions. Nothing is known about where the course SOP's actual times fall on any binding or deposition curve.";
const COMPARE_ONLY_CAVEAT = 'Compare-only method; not runnable on the bench; schematic from the published description.';
const CPS2_CAVEAT =
  'Axon 0 and plaque core 1 (trace) are schematic readings of the CPS-II description: the abstract states unstained normal neurites for CPS-I, not CPS-II, and says amyloid staining is suppressed, not abolished.';
const src = (id, citation, url, type, level, system, rights, extra = {}) => ({
  id,
  citation,
  url,
  type,
  verified: { date: '2026-10-10', level },
  system,
  rights,
  excluded: [],
  ...extra,
});
const claim = (id, text, sources, strength, system = 'human AD brain') => ({
  id,
  text,
  sources,
  strength,
  system,
  transferable: 'qualitative-only',
});
const rule = (id, title, when, effect, basis, claims, extra = {}) => ({
  id,
  title,
  when,
  effect,
  basis,
  claims,
  system: 'see claims',
  transferable: 'qualitative-only',
  conditionalOn: null,
  informational: false,
  ...extra,
});
const info = (id, title, text, basis, claims) =>
  rule(id, title, null, [{ op: 'caveat', text }], basis, claims, { informational: true });
const step = (id, title, order, station, hazards = []) => ({
  id,
  title,
  order,
  purpose: { text: 'Purpose text not yet sourced.', basis: 'placeholder', claims: [] },
  quantities: { time: 'unspecified', temperature: 'unspecified', concentration: 'unspecified' },
  hazards,
  station,
  requiresHood: 'unspecified',
});
const specimen = (id, label, role, sites, notes) => ({
  id,
  label,
  kind: 'synthetic-schematic',
  species: null,
  region: null,
  fixation: null,
  thicknessUm: null,
  processingKnown: false,
  seed: 101,
  sites: Object.fromEntries(
    S.SITE_CLASSES.filter(s => s !== 'background').map((s, i) => [
      s,
      { presence: sites[i][0], reductionSites: sites[i][1] },
    ])
  ),
  role,
  notes,
  assetId: null,
});
const moduleItem = (id, week, title, facts = [], extra = {}) => ({
  id,
  title,
  week,
  order: week,
  activityUrl: `https://utsa.instructure.com/courses/91998/assignments/14183${50 + week}`,
  goal: 'Fixture goal.',
  steps: [
    {
      kind: 'write',
      prompt: 'What variable and observable does your statement name?',
      field: 'statement',
      required: true,
    },
  ],
  facts,
  engine: ['resolve'],
  specimens: ['SPEC-SYN-AD-01'],
  defaultRuns: [{ label: 'Baseline', specimenId: 'SPEC-SYN-AD-01', method: 'bielschowsky-modified', params: {} }],
  ...extra,
});
// Contract §7 tissue clip: the fixed scene list with placeholder narration; every fact cites a fixture claim.
const clipFixture = () => ({
  v: 1,
  label: 'A drawing, not a reconstruction of any section',
  noRunCaption:
    'No run was given, so the staining scenes play a default full protocol at sop-default on this specimen.',
  noBasisCaption: 'This run resolved to an uncertainty card, so the tissue stays unstained; the gap is: {explanation}.',
  impregnationNotDone: 'Fixture: the impregnation step has not been performed, so nothing is bound in the model yet.',
  developmentNotDone: 'Fixture: bound silver only, no deposit yet; binding is not development.',
  captionFacts: { developmentNotDone: [{ text: 'Fixture fact.', claims: ['C-brief-binding-not-development'] }] },
  items: S.CLIP_SCENES.map(id => ({
    id,
    title: `Fixture ${id}`,
    caption: `Fixture narration for ${id}; nothing here is a staining claim.`,
    durationMs: 5000,
    facts: id === 'development' ? [{ text: 'Fixture fact.', claims: ['C-brief-binding-not-development'] }] : [],
    sub:
      id === 'structures'
        ? S.SITE_CLASSES.filter(site => site !== 'background').map(site => ({
            site,
            title: S.SITE_TEXT[site],
            caption: `Fixture shape standing for ${site}.`,
            facts: [],
          }))
        : [],
  })),
});

function fixture() {
  const pubmed = n => `https://pubmed.ncbi.nlm.nih.gov/${n}/`;
  const sources = [
    src(
      'S-litchfield-2001',
      'Litchfield S, Nagy Z. Acta Neuropathol. 2001;101(1):17-21.',
      pubmed(11194935),
      'peer-reviewed',
      'abstract',
      'human AD brain (OPTIMA, Oxford)',
      'cite-only'
    ),
    src(
      'S-yamamoto-1986',
      'Yamamoto T, Hirano A. Neuropathol Appl Neurobiol. 1986;12(1):3-9.',
      pubmed(2422580),
      'peer-reviewed',
      'abstract',
      'serial sections, two AD brains',
      'cite-only'
    ),
    src(
      'S-dion-1983',
      'Dion AS, Pomenti AA. Anal Biochem. 1983;129(2):490-6.',
      pubmed(6189426),
      'peer-reviewed',
      'abstract',
      'polyacrylamide gels (NOT tissue)',
      'cite-only'
    ),
    src(
      'S-rosenwald-1993',
      'Rosenwald A, et al. Acta Neuropathol. 1993;86(2):182-6.',
      pubmed(7692696),
      'peer-reviewed',
      'abstract',
      'hippocampal serial sections, 35 human brains, paraffin',
      'cite-only'
    ),
    src(
      'S-velasco-1992',
      'Velasco ME. Mod Pathol. 1992;5(4):455-63.',
      pubmed(1495951),
      'peer-reviewed',
      'abstract',
      'human AD brain',
      'cite-only'
    ),
    src(
      'S-peters-1955',
      'Peters A. Quart J Microsc Sci 1955; s3-96(33):103-115.',
      'https://journals.biologists.com/jcs/article/s3-96/33/103/64148/',
      'peer-reviewed',
      'abstract',
      'nerve tissue sections',
      'cite-only'
    ),
    src(
      'S-gallyas-1979a',
      'Gallyas F. Histochemistry 1979;64:87-96.',
      'https://link.springer.com/article/10.1007/BF00493357',
      'peer-reviewed',
      'title-only',
      'treated human spinal cord (per the course)',
      'cite-only'
    ),
    src(
      'S-gallyas-1979b',
      'Gallyas F. Histochemistry 1979;64:97-109.',
      'https://link.springer.com/article/10.1007/BF00493358',
      'peer-reviewed',
      'title-only',
      'treated human spinal cord (per the course)',
      'cite-only'
    ),
    src(
      'S-alafuzoff-2006',
      'Alafuzoff I, et al. J Neuropathol Exp Neurol. 2006;65(8):740-757.',
      pubmed(16896308),
      'peer-reviewed',
      'metadata',
      'human brain, participating laboratories',
      'cite-only'
    ),
    src(
      'S-abcam-protocol',
      'Abcam Bielschowsky silver stain protocol.',
      'https://www.abcam.com/en-us/technical-resources/protocols/bielschowskys-silver-stain',
      'vendor-protocol',
      'not-fetched',
      'vendor protocol',
      'cite-only'
    ),
    src(
      'S-utah-webpath',
      'University of Utah WebPath Bielschowsky protocol.',
      'https://webpath.med.utah.edu/HISTHTML/MANUALS/BIELSCH.PDF',
      'legacy-protocol',
      'not-fetched',
      'legacy protocol',
      'cite-only',
      { excluded: ['drain disposal advice'] }
    ),
    src(
      'S-pmc-copyright',
      'PMC copyright and reuse rules.',
      'https://pmc.ncbi.nlm.nih.gov/about/copyright/',
      'institutional-ehs',
      'not-fetched',
      'reuse rules',
      'cite-only'
    ),
    src(
      'S-course-handout',
      'Course protocol procedure (Canvas file 15321361).',
      'https://utsa.instructure.com/courses/91998/files/15321361',
      'course-handout',
      'not-read',
      'course procedure',
      'course-access-only'
    ),
    src(
      'S-course-recording',
      'Perry introductory recording (Panopto).',
      'https://utsa.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=db803f1d-4637-410b-9bcf-b4ad0047b3e4',
      'course-recording',
      'not-read',
      'course recording',
      'course-access-only'
    ),
    src(
      'S-course-velasco-pdf',
      'Velasco course PDF (Canvas file 15491908).',
      'https://utsa.instructure.com/courses/91998/files/15491908',
      'course-pdf',
      'not-read',
      'course PDF',
      'course-access-only'
    ),
    src(
      'S-course-procedure',
      'NDRB 2903 Bielschowsky Silver Stain Procedure (course procedure, approved for course use 2026-10-12).',
      undefined,
      'course-handout',
      'full-text',
      'course procedure, paraffin sections',
      'course-access-only'
    ),
    src(
      'S-course-guide',
      'Start here: course guide and the project brief.',
      'https://utsa.instructure.com/courses/91998/pages/start-here-course-guide',
      'course-handout',
      'not-read',
      'course guide',
      'course-access-only'
    ),
  ];
  const claims = [
    claim(
      'C-litchfield-2001-temp',
      'The Bielschowsky stain is highly sensitive to changes in ambient temperature.',
      ['S-litchfield-2001'],
      'published-qualitative'
    ),
    claim(
      'C-litchfield-2001-what-stains',
      'Bielschowsky impregnates both amyloid and neuritic components of senile plaques and reliably stains tangles.',
      ['S-litchfield-2001'],
      'published-qualitative'
    ),
    claim(
      'C-yamamoto-1986-more-nft',
      'Modified Bielschowsky demonstrated more tangles, and more distinctly, than Bodian on serial sections.',
      ['S-yamamoto-1986'],
      'published-qualitative'
    ),
    claim(
      'C-rosenwald-1993-sensitivity',
      'Among six silver methods, Gallyas and Bielschowsky were among the most sensitive for tangles.',
      ['S-rosenwald-1993'],
      'published-qualitative'
    ),
    claim(
      'C-rosenwald-1993-lack-of-control',
      'Most silver methods are complicated and not reliable because certain steps lack control.',
      ['S-rosenwald-1993'],
      'published-qualitative'
    ),
    claim(
      'C-velasco-1992-cps1',
      'CPS-I stains plaques, tangles and neuropil threads black on a clear background.',
      ['S-velasco-1992'],
      'published-qualitative'
    ),
    claim(
      'C-velasco-1992-cps2',
      'CPS-II suppresses amyloid staining while keeping tangles and neuropil threads and delineating the dystrophic neurites of plaques.',
      ['S-velasco-1992'],
      'published-qualitative'
    ),
    claim(
      'C-velasco-1992-normal-neurites-unstained',
      'With CPS-I, normal neurites remain unstained (not stated for CPS-II).',
      ['S-velasco-1992'],
      'published-qualitative'
    ),
    claim(
      'C-peters-1955-nuclei',
      'Silver staining requires reduced-silver nuclei in the section on which the developer deposits more silver.',
      ['S-peters-1955'],
      'published-qualitative',
      'nerve tissue sections'
    ),
    claim(
      'C-peters-1955-bound-silver',
      'Deposited silver can come from silver already bound during impregnation or from the developing solution.',
      ['S-peters-1955'],
      'published-qualitative',
      'nerve tissue sections'
    ),
    claim(
      'C-peters-1955-developer-strength',
      'A developer that is too weak gives light, incomplete staining; one that is too strong gives no differentiated staining.',
      ['S-peters-1955'],
      'published-qualitative',
      'nerve tissue sections'
    ),
    claim(
      'C-gallyas-1979-separable',
      'Binding of silver ions and formation of metallic silver are separable processes with different time courses.',
      ['S-gallyas-1979a', 'S-gallyas-1979b'],
      'schematic-analogy',
      'treated human spinal cord (per the course)'
    ),
    claim(
      'C-dion-1983-nucleation',
      'Metallic silver deposited at oxidized aldehyde groups acts as nucleation sites for further deposition when developer is added.',
      ['S-dion-1983'],
      'schematic-analogy',
      'polyacrylamide gels'
    ),
    claim(
      'C-dion-1983-lysine',
      'Staining intensity in gels was related to the lysine content of standard proteins, not protein amount alone.',
      ['S-dion-1983'],
      'schematic-analogy',
      'polyacrylamide gels'
    ),
    claim(
      'C-alafuzoff-2006-interlab',
      'The same AD-related lesions received different assessments across participating laboratories.',
      ['S-alafuzoff-2006'],
      'published-qualitative'
    ),
    claim(
      'C-course-steps-order',
      'The course procedure lists the modified Bielschowsky steps in a fixed order.',
      ['S-course-handout'],
      'course-handout',
      'course procedure'
    ),
    claim(
      'C-course-hypotheses',
      'The course raises fixation-related carbonyls, endogenous carbonyls, reduced metals and other reduction sites as competing explanations.',
      ['S-course-recording'],
      'course-handout',
      'course recording'
    ),
    claim(
      'C-course-negative-tissue-stains',
      'Negative tissue need not be completely unstained because normal neural structures can stain.',
      ['S-course-guide'],
      'course-handout',
      'course guide'
    ),
    claim(
      'C-brief-binding-not-development',
      'A plateau in silver binding does not mean visible deposition has finished; binding and development are modeled as separate processes.',
      ['S-course-guide'],
      'schematic-analogy',
      'course guide'
    ),
    // §11: the course procedure's what-you-see column, purposes and troubleshooting rows (fixture
    // paraphrases; the shipped claims quote the procedure).
    ...[
      [
        'C-course-what-you-see',
        'After silver nitrate "Sections turn faintly yellow to light brown"; after ammoniacal silver "Sections turn tan to brown".',
      ],
      [
        'C-course-thiosulfate-purpose',
        'Thiosulfate: "This removes silver that was never reduced, so the slide stops changing."',
      ],
      ['C-course-toning-colour', 'Gold toning: "It turns the stain from brown-black to gray-black."'],
      [
        'C-course-trouble-no-black',
        'Little or no black: "Too much ammonia in step 4; silver nitrate old or light-exposed; development stopped too early".',
      ],
      ['C-course-trouble-dark', 'Everything dark brown: "Development too long or too warm; too much developer".'],
      [
        'C-course-trouble-grains',
        'Black grains: "Metal forceps touched a silver solution; dirty or scratched glass; ammoniacal silver starting to precipitate".',
      ],
      [
        'C-course-trouble-patchy',
        'Patchy staining: "Wax left behind; section dried between steps; jar not full enough to cover the section".',
      ],
      [
        'C-course-ammonia-endpoint',
        '"Do not add extra ammonia beyond that: too much weakens the stain"; "If it stays faintly cloudy, filter it through paper".',
      ],
      [
        'C-course-mount-seal',
        'The slide is finished with "coverslip with resinous medium"; no bath follows the mounting.',
      ],
    ].map(([id, text]) => ({
      ...claim(id, text, ['S-course-procedure'], 'course-handout', 'course procedure, paraffin sections'),
      transferable: 'course-specific',
    })),
  ];
  // §11: the strict model's rules fire on practice runs only (a free run has its own R-react-* rules,
  // which this fixture does not carry; the shipped data does).
  const PRACTICE = { mode: 'practice' };
  const dev = { all: [PRACTICE, { step: 'development' }] };
  const rules = [
    rule(
      'R-model-01',
      'Binding of ionic silver',
      { all: [PRACTICE, { step: 'ammoniacal-silver' }, { stepsDone: ['silver-impregnation'] }] },
      [
        {
          op: 'bind',
          gain: { early: 2, 'sop-default': 4, extended: 4 },
          ammoniaDelta: { 'just-clear': 0, extra: -2, cloudy: 0 },
        },
        { op: 'caveat', text: ENDPOINT_CAVEAT },
      ],
      'schematic-analogy',
      [
        'C-brief-binding-not-development',
        'C-gallyas-1979-separable',
        'C-peters-1955-bound-silver',
        'C-course-ammonia-endpoint',
        'C-course-trouble-no-black',
      ]
    ),
    rule(
      'R-model-02',
      'Nuclei form where bound silver meets reduction sites',
      dev,
      [{ op: 'nuclei' }],
      'schematic-analogy',
      ['C-peters-1955-nuclei', 'C-dion-1983-nucleation']
    ),
    rule(
      'R-model-03',
      'Developer grows deposit on nuclei',
      dev,
      [
        {
          op: 'develop',
          endpointDelta: { early: -1, 'sop-default': 0, extended: 1 },
          strengthDelta: { weak: -1, 'sop-default': 0, strong: 0 },
        },
      ],
      'schematic-analogy',
      ['C-brief-binding-not-development', 'C-gallyas-1979-separable', 'C-peters-1955-developer-strength']
    ),
    rule(
      'R-model-04',
      'Background deposit',
      dev,
      [
        { op: 'background', base: 1, extendedDelta: 1, strongDelta: 1 },
        {
          op: 'caveat',
          text: 'Longer development is assumed to raise background in this schematic; no source in the registry supports or refutes this for Bielschowsky.',
        },
      ],
      'schematic-analogy',
      ['C-peters-1955-developer-strength']
    ),
    rule('R-model-05', 'Visibility is deposit, not amount', dev, [{ op: 'visibility' }], 'schematic-analogy', [
      'C-peters-1955-nuclei',
      'C-dion-1983-lysine',
    ]),
    rule(
      'R-model-06',
      'Rate phase as an ordering device',
      dev,
      [
        {
          op: 'ratePhase',
          map: { early: 'before-reference', 'sop-default': 'reference', extended: 'after-reference' },
        },
        { op: 'caveat', text: ENDPOINT_CAVEAT },
      ],
      'schematic-analogy',
      ['C-brief-binding-not-development']
    ),
    // §11.5: gold toning tones the reduced silver; thiosulfate removes the unreduced silver.
    rule(
      'R-model-08',
      'Gold toning (practice)',
      { all: [PRACTICE, { step: 'gold-toning' }, { path: 'silver.maxDeposit', in: [1, 2, 3, 4] }] },
      [{ op: 'tone', tone: 'gold' }],
      'schematic-analogy',
      ['C-course-toning-colour']
    ),
    rule(
      'R-model-09',
      'Sodium thiosulfate (practice)',
      { all: [PRACTICE, { step: 'sodium-thiosulfate' }] },
      [{ op: 'fix' }],
      'schematic-analogy',
      ['C-course-thiosulfate-purpose']
    ),
    rule(
      'R-temp-01',
      'Temperature deviation lowers reproducibility',
      { all: [{ path: 'params.impregnation.temperature', eq: 'deviated' }] },
      [
        { op: 'confidence', level: 'low' },
        {
          op: 'caveat',
          text: "Bielschowsky staining is reported to be highly sensitive to ambient temperature; this run's temperature deviates from the SOP, so the outcome is low-confidence and no direction of change is encoded.",
        },
      ],
      'published-qualitative',
      ['C-litchfield-2001-temp']
    ),
    rule(
      'R-model-07',
      'Cloudy ammoniacal silver (practice): black grains',
      { all: [PRACTICE, { path: 'params.ammoniacal.ammonia', eq: 'cloudy' }] },
      [
        { op: 'artifact', id: 'grains' },
        { op: 'caveat', text: 'The ammoniacal silver was left cloudy and not filtered: black grains on the slide.' },
      ],
      'schematic-analogy',
      ['C-course-trouble-grains', 'C-course-ammonia-endpoint']
    ),
    rule(
      'R-model-10',
      'Skipping gold toning or thiosulfate (practice)',
      {
        all: [
          PRACTICE,
          {
            any: [
              { path: 'params.toning', eq: false },
              { path: 'params.thiosulfate', eq: false },
            ],
          },
        ],
      },
      [
        {
          op: 'caveat',
          text: 'No gold toning: the stain stays brown-black.',
          when: {
            all: [
              { path: 'params.toning', eq: false },
              { path: 'slide.toned', eq: false },
            ],
          },
        },
        {
          op: 'caveat',
          text: 'No thiosulfate: silver that was never reduced stays in the section, so the slide will keep changing (course procedure).',
          when: {
            all: [
              { path: 'params.thiosulfate', eq: false },
              { path: 'slide.fixed', eq: false },
            ],
          },
        },
        {
          op: 'flag',
          id: 'unfixed',
          when: {
            all: [
              { path: 'params.thiosulfate', eq: false },
              { path: 'slide.fixed', eq: false },
            ],
          },
        },
      ],
      'schematic-analogy',
      ['C-course-toning-colour', 'C-course-thiosulfate-purpose']
    ),
    rule(
      'R-react-look',
      'By-eye look',
      { path: 'method', eq: 'bielschowsky-modified' },
      [{ op: 'look', darkBackground: 3, blackFrom: 3, patchyBelow: 3 }],
      'course-handout',
      ['C-course-what-you-see', 'C-course-trouble-dark', 'C-course-trouble-patchy']
    ),
    info(
      'R-method-01',
      'Method choice changes which tangles are shown',
      'Modified Bielschowsky showed more tangles than Bodian on serial sections; method choice changes what is seen.',
      'published-qualitative',
      ['C-yamamoto-1986-more-nft']
    ),
    info(
      'R-method-02',
      'Silver methods differ in sensitivity and control',
      'Silver methods differ in sensitivity and most lack control in some steps.',
      'published-qualitative',
      ['C-rosenwald-1993-sensitivity', 'C-rosenwald-1993-lack-of-control']
    ),
    rule(
      'R-method-03-cps1',
      'CPS-I schematic outcome',
      { path: 'method', eq: 'cps-i' },
      [
        {
          op: 'schematicOutcome',
          perSite: { axon: 0, 'plaque-core': 4, 'plaque-neurite': 4, tangle: 4, 'neuropil-thread': 4 },
          background: 0,
        },
        { op: 'caveat', text: COMPARE_ONLY_CAVEAT },
        {
          op: 'caveat',
          text: 'In CPS-I the dystrophic neurites of plaques are obscured by amyloid argyrophilia (Velasco 1992); the schematic shows the plaque stained as a whole and cannot show the neurites separately.',
        },
      ],
      'published-qualitative',
      ['C-velasco-1992-cps1', 'C-velasco-1992-normal-neurites-unstained']
    ),
    rule(
      'R-method-03-cps2',
      'CPS-II schematic outcome',
      { path: 'method', eq: 'cps-ii' },
      [
        {
          op: 'schematicOutcome',
          perSite: { axon: 0, 'plaque-core': 1, 'plaque-neurite': 4, tangle: 4, 'neuropil-thread': 4 },
          background: 0,
        },
        { op: 'caveat', text: COMPARE_ONLY_CAVEAT },
        { op: 'caveat', text: CPS2_CAVEAT },
      ],
      'published-qualitative',
      ['C-velasco-1992-cps2']
    ),
    info(
      'R-dev-01',
      'Developer strength',
      'Too weak a developer gives light, incomplete staining; too strong loses differentiation.',
      'published-qualitative',
      ['C-peters-1955-developer-strength']
    ),
    info(
      'R-kinetics-01',
      'Binding and formation are separable',
      'Binding of silver ions and formation of metallic silver are separable processes with different time courses; shape only.',
      'schematic-analogy',
      ['C-gallyas-1979-separable', 'C-brief-binding-not-development']
    ),
    info(
      'R-intensity-01',
      'Intensity tracks site chemistry',
      'Silver intensity tracks site chemistry rather than protein amount alone (gel analogy).',
      'schematic-analogy',
      ['C-dion-1983-lysine', 'C-dion-1983-nucleation']
    ),
    info(
      'R-interlab-01',
      'Assessments differ across laboratories',
      'The same lesions get different assessments across laboratories.',
      'published-qualitative',
      ['C-alafuzoff-2006-interlab']
    ),
    rule(
      'R-order-01',
      'Protocol order deviation',
      { all: [PRACTICE, { any: [{ deviation: 'out-of-order' }, { deviation: 'repeated' }] }] },
      [
        { op: 'artifact', id: 'protocol-deviation' },
        {
          op: 'caveat',
          text: 'A step was performed out of the procedure order or repeated; the state is whatever the performed order produced and no staining claim is made about the deviation.',
        },
      ],
      'course-handout',
      ['C-course-steps-order']
    ),
    rule(
      'R-norm-01',
      'Negative comparison still stains normal structures',
      { path: 'specimen.role', eq: 'negative-comparison-stand-in' },
      [
        {
          op: 'caveat',
          text: 'A negative biological comparison is not expected to be blank: normal neural structures such as axons can stain.',
        },
      ],
      'course-handout',
      ['C-course-negative-tissue-stains']
    ),
  ];
  const methods = {
    v: 1,
    items: [
      {
        id: 'bielschowsky-modified',
        title: 'Modified Bielschowsky silver stain (course procedure)',
        runnable: true,
        steps: [
          step('deparaffinize-rehydrate', 'Deparaffinization and rehydration', 1, 'S1'),
          step('silver-impregnation', 'Initial silver impregnation', 2, 'S2', ['H-impregnation-reagent']),
          step('water-wash', 'Water washes', 3, 'S2'),
          step('ammoniacal-silver', 'Ammoniacal-silver impregnation', 4, 'S3', ['H-ammoniacal-silver']),
          step('ammonium-hydroxide-wash', 'Ammonium-hydroxide washes', 5, 'S3'),
          step('development', 'Development/reduction to visible deposits', 6, 'S3'),
          step('gold-toning', 'Gold chloride toning', 7, 'S4'),
          step('sodium-thiosulfate', 'Sodium thiosulfate treatment', 8, 'S4'),
          step('final-wash-dehydrate-clear-mount', 'Final washes, dehydration, clearing and mounting', 9, 'S5'),
        ],
        probes: [
          {
            id: 'probe-placeholder-1',
            title: 'Pretreatment probe (instructor to define)',
            status: 'pending-instructor',
          },
        ],
        sources: ['S-course-handout'],
      },
      {
        id: 'cps-i',
        title: 'Copper-peroxide-silver, CPS-I (Velasco 1992)',
        runnable: false,
        compareOnly: true,
        outcomeRule: 'R-method-03-cps1',
        sources: ['S-velasco-1992'],
      },
      {
        id: 'cps-ii',
        title: 'Copper-peroxide-silver, CPS-II (Velasco 1992)',
        runnable: false,
        compareOnly: true,
        outcomeRule: 'R-method-03-cps2',
        sources: ['S-velasco-1992'],
      },
    ],
    stations: [
      { id: 'S1', title: 'Deparaffinize / rehydrate', steps: ['deparaffinize-rehydrate'] },
      { id: 'S2', title: 'Silver impregnation', steps: ['silver-impregnation', 'water-wash'] },
      {
        id: 'S3',
        title: 'Ammoniacal silver + developer',
        steps: ['ammoniacal-silver', 'ammonium-hydroxide-wash', 'development'],
      },
      { id: 'S4', title: 'Toning + thiosulfate', steps: ['gold-toning', 'sodium-thiosulfate'] },
      { id: 'S5', title: 'Dehydrate / clear / mount', steps: ['final-wash-dehydrate-clear-mount'] },
      { id: 'S6', title: 'Microscope', steps: [] },
      { id: 'S7', title: 'Waste + safety', steps: [] },
      { id: 'S8', title: 'Notebook / whiteboard', steps: [] },
    ],
  };
  const specimens = [
    specimen(
      'SPEC-SYN-AD-01',
      'Synthetic AD-like section (schematic)',
      'positive-control-stand-in',
      [
        [3, 3],
        [3, 3],
        [3, 3],
        [3, 3],
        [2, 2],
      ],
      'Synthetic stand-in for a characterized positive staining control. Not derived from any real specimen.'
    ),
    specimen(
      'SPEC-SYN-AD-02',
      'Synthetic AD-like section, lower burden (schematic)',
      'experimental',
      [
        [3, 3],
        [2, 3],
        [2, 3],
        [2, 3],
        [1, 2],
      ],
      'Synthetic. Lower schematic lesion burden.'
    ),
    specimen(
      'SPEC-SYN-NEG-01',
      'Synthetic negative comparison (schematic)',
      'negative-comparison-stand-in',
      [
        [3, 3],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
      ],
      'Synthetic stand-in for a negative biological comparison; normal structures (axons) still stain.'
    ),
    specimen(
      'SPEC-SYN-LOWCHEM-01',
      'Synthetic high-amount, low-reduction-site section (schematic)',
      'experimental',
      [
        [4, 1],
        [4, 1],
        [4, 1],
        [4, 1],
        [4, 1],
      ],
      'Synthetic. High schematic amount, few schematic reduction sites.'
    ),
  ];
  const safety = [
    {
      id: 'H-ammoniacal-silver',
      title: 'Ammoniacal silver',
      text: 'Ammoniacal silver solutions have dangerous residue hazards. Handling and disposal instructions are pending the instructor SOP, current SDS and UTSA EHS guidance.',
      sourceId: 'PENDING-EHS',
      stations: ['S3', 'S7'],
    },
    {
      id: 'H-impregnation-reagent',
      title: 'Initial silver impregnation reagent',
      text: 'Reagent identity, concentration and hazards for the initial silver impregnation are pending the instructor SOP and current SDS.',
      sourceId: 'PENDING-EHS',
      stations: ['S2', 'S7'],
    },
    {
      id: 'H-disclaimer',
      title: 'Educational software',
      text: 'This is educational software, not qualification to perform hazardous procedures independently.',
      sourceId: 'S-course-guide',
      stations: ['S7'],
    },
  ];
  const modules = {
    v: 1,
    items: [
      moduleItem('M1', 1, 'Observation to explanation'),
      moduleItem('M2', 2, 'How methods shape images', [], { engine: ['resolve', 'compare'] }),
      moduleItem('M3', 3, 'Time courses', [], { engine: ['schematicCurves'] }),
      moduleItem('M4', 4, 'Intensity versus protein amount', [
        {
          text: 'In gels, silver intensity tracked site chemistry rather than protein amount alone.',
          claims: ['C-dion-1983-lysine', 'C-dion-1983-nucleation'],
        },
      ]),
      moduleItem('M5', 5, 'Controls', [
        {
          text: 'The same lesions received different assessments across laboratories.',
          claims: ['C-alafuzoff-2006-interlab'],
        },
      ]),
      moduleItem('M6', 6, 'Alternative outcomes', [], { engine: ['canReveal', 'reveal'] }),
      moduleItem('M7', 7, 'Evidence-supported writing', [], { engine: ['exportNotebook'] }),
    ],
    measurements: [
      {
        id: 'contrast-ordinal',
        title: 'Target/background contrast',
        rule: 'Read the ordinal contrast of the simulated field; it is illustrative, not a measurement.',
        unit: 'ordinal',
        manual: false,
      },
      {
        id: 'roi-lesion-count',
        title: 'Predefined-region lesion count',
        rule: 'Count tagged lesions inside the fixed regions only.',
        unit: 'count',
        manual: true,
      },
      {
        id: 'artifact-area',
        title: 'Artifact area',
        rule: 'Outline artifact regions by hand; report the fraction of the field.',
        unit: 'fraction',
        manual: true,
      },
      {
        id: 'tissue-coverage',
        title: 'Tissue coverage',
        rule: 'Estimate the fraction of the field covered by tissue.',
        unit: 'fraction',
        manual: true,
      },
      {
        id: 'blinded-quality-score',
        title: 'Blinded quality score',
        rule: 'Score with run ids hidden; record the rubric you used.',
        unit: 'score',
        manual: true,
      },
    ],
  };
  return {
    sources: { v: 1, items: sources },
    claims: { v: 1, items: claims },
    rules: {
      v: 1,
      items: rules,
      hypothesisRules: [],
      note: 'No hypothesis-conditional rules in v1: the instructor has not said which pretreatment probes which hypothesis.',
    },
    methods,
    specimens: { v: 1, items: specimens },
    safety: { v: 1, items: safety },
    modules,
    assets: {
      v: 1,
      items: [],
      note: 'Synthetic renders are generated at runtime and labeled by the microscope; no observed-reference assets exist until rights are cleared.',
    },
    clip: clipFixture(),
  };
}

// ---- helpers --------------------------------------------------------------------------------
const ENGINE_SRC = fs.readFileSync(path.join(ROOT, 'silver-lab-core.js'), 'utf8');
const TARGETS = S.SITE_CLASSES.filter(s => s !== 'background');
const PROBE = 'probe-placeholder-1';
let seqCounter = 0;
const stepEvent = (stepId, params) => ({
  seq: ++seqCounter,
  type: 'step',
  step: stepId,
  ...(params ? { params } : {}),
});
function perform(lab, run, steps = S.STEPS, overrides = {}) {
  seqCounter = 0;
  return steps.reduce((r, s) => lab.applyEvent(r, stepEvent(s, overrides[s])), run);
}
const fullRun = (lab, id, specimenId, params, method = 'bielschowsky-modified', overrides = {}) =>
  perform(lab, lab.createRun({ id, specimenId, method, params }), S.STEPS, overrides);
const vis = (out, site) => out.perSite[site].visibility;
const count = (list, x) => list.filter(y => y === x).length;
// §11: a free run from a step list (seq from 1), and the reaction of its last step event.
const freeRun = (lab, steps, params = {}, specimenId = 'SPEC-SYN-AD-01') =>
  perform(lab, lab.createRun({ id: 'x', specimenId, params, mode: 'free' }), steps);
const last = run => run.reactions[run.reactions.length - 1];
// §13: the reagent shelf. A dip of a jar (a procedure jar's contents, patched; an extra jar's patch
// alone), its seq after the run's last event; a list of dips (an id, or [jarId, patch, handling]).
const nextSeq = run => run.events.reduce((m, e) => Math.max(m, e.seq || 0), 0) + 1;
const dip = (lab, run, jarId, patch = {}, handling) =>
  lab.applyEvent(run, {
    seq: nextSeq(run),
    type: 'dip',
    jarId,
    solution: { ...(lab.procedureJars()[jarId] || {}), ...patch },
    ...(handling ? { handling } : {}),
  });
const dips = (lab, run, list) =>
  list.reduce((r, item) => (Array.isArray(item) ? dip(lab, r, ...item) : dip(lab, r, item)), run);
const stepOf = (lab, run, stepId) => lab.applyEvent(run, { seq: nextSeq(run), type: 'step', step: stepId });
const freeSlide = (lab, specimenId = 'SPEC-SYN-AD-01') => lab.createRun({ id: 'shelf', specimenId, mode: 'free' });
const pick = (obj, keys) => Object.fromEntries(keys.map(k => [k, obj[k]]));
const REACTION_FIELDS = ['seq', 'step', 'kind', 'text', 'why', 'rules', 'claims', 'look'];
const RUN_RECORD = ['state', 'slide', 'stepsDone', 'deviations', 'rulesApplied', 'effectiveParams'];
const SHELF_IDS = [
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
const SHELF_RULES = [
  'R-react-short-xylene',
  'R-react-old-silver',
  'R-react-long-ammoniacal',
  'R-react-dev-too-much',
  'R-react-dev-too-warm',
  'R-react-dev-past-ten',
  'R-react-pretreated-background',
  'R-react-permanganate',
  'R-react-oxalic',
  'R-react-handling-grains',
  'R-react-handling-patchy',
];
const UNKNOWN_TAIL =
  "No published source in this lab's library describes it, so the drawing leaves this dip out. The real lab is how to find out.";
const maxOf = (run, key) => Math.max(...TARGETS.map(site => run.state[site][key]));
const bgOf = run => run.state.background.deposit;
const READY = [
  'deparaffinize-rehydrate',
  'silver-impregnation',
  'water-wash',
  'ammoniacal-silver',
  'ammonium-hydroxide-wash',
];
const experiment = (baselineRunId, experimentalRunId) => ({
  id: 'exp-1',
  status: 'draft',
  title: 'Development endpoint',
  background: 'b',
  question: 'q',
  hypothesis: 'h',
  alternative: 'a',
  independentVariable: 'development.endpoint',
  measures: ['contrast-ordinal'],
  heldComparable: ['specimen', 'impregnation.endpoint'],
  changed: ['development.endpoint'],
  controls: [{ type: 'characterized-positive', addresses: 'that the stain worked at all' }],
  predictions: { expected: 'e', negligible: 'n', opposite: 'o' },
  limitations: 'l',
  baselineRunId,
  experimentalRunId,
  interpretation: null,
});
// ENGINE-10 / ENGINE-11 (tests 20, 21): one fixed export input that reaches every place a formatter
// is used: a named run, a set-params event with two settings, a note, a step-level override, an
// out-of-order step, a no-basis run, a run id missing from runsById, simulated entries of both
// labels, one and two controls, a blank prediction, a half-written interpretation, and toning /
// thiosulfate performed (set explicitly once) and both skipped (ENGINE-14: the skipping run leaves
// both steps out, so it is not modeled, with no step missing and no deviation).
function exportFixture(lab) {
  const base = perform(lab, lab.createRun({ id: 'base', specimenId: 'SPEC-SYN-AD-01', label: 'Baseline' }));
  let ext = lab.createRun({ id: 'ext', specimenId: 'SPEC-SYN-AD-01' });
  ext = lab.applyEvent(ext, {
    seq: 1,
    type: 'set-params',
    params: { development: { endpoint: 'extended' }, thiosulfate: true },
  });
  ext = lab.applyEvent(ext, { seq: 2, type: 'note', text: 'Started late.' });
  ['deparaffinize-rehydrate', 'water-wash', 'silver-impregnation', ...S.STEPS.slice(3)].forEach((s, i) => {
    const params = s === 'development' ? { params: { development: { strength: 'strong' } } } : {};
    ext = lab.applyEvent(ext, { seq: 3 + i, type: 'step', step: s, ...params });
  });
  const runsById = {
    base,
    ext,
    w: perform(
      lab,
      lab.createRun({
        id: 'w',
        specimenId: 'SPEC-SYN-AD-01',
        params: { washes: { condition: 'deviated' }, toning: false, thiosulfate: false },
      }),
      S.STEPS.filter(s => s !== 'gold-toning' && s !== 'sodium-thiosulfate')
    ),
  };
  let notebook = lab.newNotebook();
  for (const entry of [
    {
      id: 'e1',
      type: 'published',
      section: 'starting-ideas',
      text: 'Temperature matters.',
      claimId: 'C-litchfield-2001-temp',
    },
    {
      id: 'e2',
      type: 'observed',
      section: 'process-decisions',
      text: 'Slides looked uneven.',
      assetId: null,
      observedAt: '2026-10-10',
    },
    {
      id: 'e3',
      type: 'simulated',
      section: 'outcomes-limitations',
      text: 'The simulated field is darker.',
      runId: 'ext',
      label: 'illustrative-synthetic',
    },
    {
      id: 'e4',
      type: 'simulated',
      section: 'outcomes-limitations',
      text: 'The washes change has no rule.',
      runId: 'w',
      label: 'no-basis',
    },
    { id: 'e5', type: 'reflection', section: 'next-steps', text: 'Repeat with the steps in order.' },
  ])
    notebook = lab.addEntry(notebook, entry, runsById);
  const experiments = [
    { ...experiment('base', 'ext'), predictions: { expected: 'e', negligible: '  ', opposite: 'o' } },
    {
      ...experiment('w', 'gone'),
      id: 'exp-2',
      title: 'Washes',
      status: 'revealed',
      controls: [
        { type: 'characterized-positive', addresses: 'that the stain worked at all' },
        { type: 'baseline-process', addresses: '' },
      ],
      interpretation: { supports: 's', failsToEstablish: ' ', next: 'x' },
    },
    // ENGINE-13: a done experiment with both runs (its Model readout), a main variable that differs
    // from "What you change" and a negative biological comparison.
    {
      ...experiment('base', 'ext'),
      id: 'exp-3',
      title: 'Developer strength',
      status: 'done',
      independentVariable: 'Developer strength',
      changed: ['development.strength'],
      measures: ['contrast-ordinal', 'roi-lesion-count'],
      controls: [
        { type: 'negative-biological', addresses: 'lesion-free staining' },
        { type: 'baseline-process', addresses: 'drift between runs' },
      ],
      interpretation: { supports: 's3', failsToEstablish: 'f3', next: 'n3' },
    },
  ];
  const measurements = [
    {
      id: 'm1',
      measurementId: 'contrast-ordinal',
      runId: 'ext',
      label: 'illustrative-synthetic',
      value: 0,
      unit: 'ordinal',
      manual: false,
    },
  ];
  return { notebook, experiments, runsById, measurements };
}

// The eight exportNotebook formatters (ENGINE-10's three, ENGINE-11's five).
const FORMATTERS = [
  'runTitle',
  'paramText',
  'stepTitle',
  'specimenTitle',
  'methodTitle',
  'controlText',
  'strengthText',
  'outcomeText',
];
// Test 13's mechanical check: no simulated entry line, nor its indented continuation lines, says
// 'result' / 'results' unless 'simulated' comes before it.
function resultCheck(text) {
  let inSimulated = false;
  for (const line of text.split('\n')) {
    if (/^\s*(- )?\[Simulated: illustrative, not a measurement\]/.test(line)) inSimulated = true;
    else if (!/^\s{2,}\S/.test(line)) inSimulated = false;
    if (inSimulated) assert.doesNotMatch(line.replace(/simulated results?/gi, ''), /\bresults?\b/i, line);
  }
}
// ENGINE-13's tiny Markdown check, so a viewer never folds two fields into one line: a list (its
// top-level "- " or "1. " items with their indented lines) starts after a blank line (or the file's
// first line), is one kind of list, and the line after it is blank (or the file ends); an indented
// line belongs to a list; below "## Experiment log" no "Field: value" line stands outside a list.
// Returns the number of "- Field: value" items.
function markdownCheck(text) {
  const lines = text.split('\n'),
    kindOf = l => (/^- /.test(l) ? 'bullet' : /^\d+\. /.test(l) ? 'number' : null);
  let open = null,
    fields = 0;
  lines.forEach((line, n) => {
    const kind = kindOf(line),
      at = `line ${n + 1}: ${JSON.stringify(line)}`;
    if (kind) {
      if (open === null) assert.ok(n === 0 || lines[n - 1] === '', `a blank line before the list, ${at}`);
      else assert.equal(kind, open, `one kind of list, ${at}`);
      open = kind;
      if (/^- [A-Z][a-z][^:[]*:( |$)/.test(line)) fields++;
    } else if (/^ {2,}\S/.test(line)) assert.ok(open !== null, `an indented line inside a list, ${at}`);
    else if (line === '') open = null;
    else assert.equal(open, null, `a blank line after the list, ${at}`);
  });
  for (const line of lines.slice(lines.indexOf('## Experiment log')))
    assert.doesNotMatch(line, /^[A-Z][A-Za-z ()/]*: /, `every field is a list item: ${line}`);
  return fields;
}
// ENGINE-13: ids (C-, S-, R-) and strength codes appear only under "Model detail (for instructors)".
const ID_PATTERN = /\b[CSR]-[A-Za-z0-9]/;
const CODE_PATTERN = new RegExp(`\\b(${S.BASIS.join('|')})\\b`);
const DETAIL_HEADING = '\n## Model detail (for instructors)\n';
function studentPartClean(text) {
  const student = text.split(DETAIL_HEADING)[0];
  for (const line of student.split('\n')) {
    assert.doesNotMatch(line, ID_PATTERN, line);
    assert.doesNotMatch(line, CODE_PATTERN, line);
  }
  return student;
}
// The export of exportFixture(fixture lab) with { title: 'Fixed notebook', studentLabel: 'Student' } and no
// formatters, in the ENGINE-13 default layout: every experiment and run field a "- Field: value" item
// under the designer's field names, each list with a blank line before and after it, the events a
// numbered list of their own, the main variable only when it differs from "What you change", the
// stand-in note only on specimen-based controls, the Model readout of the done experiment, claims in
// words and citations (with no id or strength code) in the sections and in Sources, and every id and
// strength code under "Model detail (for instructors)" / "Model sources", plus (ENGINE-14) a
// line per skipped step in the procedure's words (MODE-engine-1) and an ordinal measurement in words on the
// model scale. Checked by reading it; every default must stay byte-identical to it.
const EXPORT_ENGINE_13 = `# Fixed notebook

Student

Simulated outputs in this document are illustrative predictions from a qualitative teaching model. They are not observations and must not be reported as experimental results.

## Starting ideas

- [Published] Temperature matters.
  "The Bielschowsky stain is highly sensitive to changes in ambient temperature." (published, qualitative). Source: Litchfield S, Nagy Z. Acta Neuropathol. 2001;101(1):17-21. <https://pubmed.ncbi.nlm.nih.gov/11194935/>

## Process and decisions

- [Observed] Slides looked uneven.
  Real-lab observation, 2026-10-10

## Outcomes and limitations

- [Simulated: illustrative, not a measurement] The simulated field is darker.
  Run ext, label: Illustrative simulation (synthetic, not a measurement)
- [Simulated: illustrative, not a measurement] The washes change has no rule.
  Run w, label: No basis for a simulated result

## Learning and reflection

(no entries)

## Next steps

- [Reflection] Repeat with the steps in order.

## Experiment log

### Development endpoint

- Status: draft
- Background: b
- Your question: q
- Your hypothesis: h
- Another explanation: a
- What you change: development.endpoint
- What you keep the same: specimen, impregnation.endpoint
- Controls: characterized-positive (stand-in: synthetic specimen, not characterized), addresses: that the stain worked at all
- Outcome measures: Target/background contrast
- Baseline run (standard): Run base (Baseline)
- Experimental run (with your change): Run ext
- Expected outcome: e
- Negligible change: not written
- Opposite outcome: o
- Limits of your design: l
- Interpretation: not written

#### Run base (Baseline)

- Specimen: SPEC-SYN-AD-01
- Method: bielschowsky-modified
- Settings: all standard (per procedure)
- Toning and thiosulfate: performed (the stain turns from brown-black to gray-black; silver that was never reduced is removed, so the slide stops changing)
- Events:

1. deparaffinize-rehydrate
2. silver-impregnation
3. water-wash
4. ammoniacal-silver
5. ammonium-hydroxide-wash
6. development
7. gold-toning
8. sodium-thiosulfate
9. final-wash-dehydrate-clear-mount

- Deviations: none
- Label: Illustrative simulation (synthetic, not a measurement)
- Description: Illustrative simulation (synthetic, not a measurement). Axon: moderate (deposit, schematic ordinal 3 of 4). Plaque core: moderate (deposit, schematic ordinal 3 of 4). Plaque neurite: moderate (deposit, schematic ordinal 3 of 4). Tangle: moderate (deposit, schematic ordinal 3 of 4). Neuropil thread: low (deposit, schematic ordinal 2 of 4). Background: trace. Contrast: low. Artifacts: none. Conditional on: none. Caveats: Endpoint positions early / sop-default / extended are ordered schematic positions. Nothing is known about where the course SOP's actual times fall on any binding or deposition curve. Longer development is assumed to raise background in this schematic; no source in the registry supports or refutes this for Bielschowsky.
- Measurements: none

#### Run ext

- Specimen: SPEC-SYN-AD-01
- Method: bielschowsky-modified
- Settings changed from standard: development.endpoint=extended; development.strength=strong
- Toning and thiosulfate: performed (the stain turns from brown-black to gray-black; silver that was never reduced is removed, so the slide stops changing)
- Events:

1. Changed setting: development.endpoint=extended; thiosulfate=true
2. Note: Started late.
3. deparaffinize-rehydrate
4. water-wash
5. silver-impregnation
6. ammoniacal-silver
7. ammonium-hydroxide-wash
8. development (changed setting: development.strength=strong)
9. gold-toning
10. sodium-thiosulfate
11. final-wash-dehydrate-clear-mount

- Deviations: out-of-order water-wash (expected before: silver-impregnation)
- Label: Illustrative simulation (synthetic, not a measurement)
- Description: Illustrative simulation (synthetic, not a measurement). Axon: high (deposit, schematic ordinal 4 of 4). Plaque core: high (deposit, schematic ordinal 4 of 4). Plaque neurite: high (deposit, schematic ordinal 4 of 4). Tangle: high (deposit, schematic ordinal 4 of 4). Neuropil thread: moderate (deposit, schematic ordinal 3 of 4). Background: moderate. Contrast: trace. Artifacts: protocol-deviation. Conditional on: none. Caveats: Endpoint positions early / sop-default / extended are ordered schematic positions. Nothing is known about where the course SOP's actual times fall on any binding or deposition curve. Longer development is assumed to raise background in this schematic; no source in the registry supports or refutes this for Bielschowsky. A step was performed out of the procedure order or repeated; the state is whatever the performed order produced and no staining claim is made about the deviation.
- Measurements:
  - [Simulated: illustrative, not a measurement] Target/background contrast: none (model scale) (derived)

### Washes

- Status: revealed
- Background: b
- Your question: q
- Your hypothesis: h
- Another explanation: a
- What you change: development.endpoint
- What you keep the same: specimen, impregnation.endpoint
- Controls: characterized-positive (stand-in: synthetic specimen, not characterized), addresses: that the stain worked at all; baseline-process
- Outcome measures: Target/background contrast
- Baseline run (standard): Run w
- Experimental run (with your change): Run gone
- Expected outcome: e
- Negligible change: n
- Opposite outcome: o
- Limits of your design: l
- What it supports: s
- What it fails to establish: not written
- Next experiment: x

#### Run w

- Specimen: SPEC-SYN-AD-01
- Method: bielschowsky-modified
- Settings changed from standard: washes.condition=deviated
- Gold toning: skipped (the stain stays brown-black)
- Thiosulfate: skipped (silver that was never reduced stays in the section, so the slide will keep changing)
- Events:

1. deparaffinize-rehydrate
2. silver-impregnation
3. water-wash
4. ammoniacal-silver
5. ammonium-hydroxide-wash
6. development
7. final-wash-dehydrate-clear-mount

- Deviations: none
- Label: No basis for a simulated result
- Description: No basis for a simulated result. No sourced rule covers washes.condition = deviated; the model cannot say what this change does. Outside support: washes.condition. What would be needed: a sourced rule for washes.condition=deviated. Suggested next: write the predictions for all three outcome classes; design the control that would distinguish the hypotheses.
- Measurements: none

#### Run gone

(run not found)

### Developer strength

- Status: done
- Background: b
- Your question: q
- Your hypothesis: h
- Another explanation: a
- What you change: development.strength
- Main variable (the one you test): Developer strength
- What you keep the same: specimen, impregnation.endpoint
- Controls: negative-biological (stand-in: synthetic specimen, not characterized), addresses: lesion-free staining; baseline-process, addresses: drift between runs
- Outcome measures: Target/background contrast, Predefined-region lesion count
- Baseline run (standard): Run base (Baseline)
- Experimental run (with your change): Run ext
- Expected outcome: e
- Negligible change: n
- Opposite outcome: o
- Limits of your design: l
- Model readout (simulated): Target/background contrast: low in the baseline, trace in the experimental run (down one step on the model scale)
- What it supports: s3
- What it fails to establish: f3
- Next experiment: n3

#### Run base (Baseline)

- Specimen: SPEC-SYN-AD-01
- Method: bielschowsky-modified
- Settings: all standard (per procedure)
- Toning and thiosulfate: performed (the stain turns from brown-black to gray-black; silver that was never reduced is removed, so the slide stops changing)
- Events:

1. deparaffinize-rehydrate
2. silver-impregnation
3. water-wash
4. ammoniacal-silver
5. ammonium-hydroxide-wash
6. development
7. gold-toning
8. sodium-thiosulfate
9. final-wash-dehydrate-clear-mount

- Deviations: none
- Label: Illustrative simulation (synthetic, not a measurement)
- Description: Illustrative simulation (synthetic, not a measurement). Axon: moderate (deposit, schematic ordinal 3 of 4). Plaque core: moderate (deposit, schematic ordinal 3 of 4). Plaque neurite: moderate (deposit, schematic ordinal 3 of 4). Tangle: moderate (deposit, schematic ordinal 3 of 4). Neuropil thread: low (deposit, schematic ordinal 2 of 4). Background: trace. Contrast: low. Artifacts: none. Conditional on: none. Caveats: Endpoint positions early / sop-default / extended are ordered schematic positions. Nothing is known about where the course SOP's actual times fall on any binding or deposition curve. Longer development is assumed to raise background in this schematic; no source in the registry supports or refutes this for Bielschowsky.
- Measurements: none

#### Run ext

- Specimen: SPEC-SYN-AD-01
- Method: bielschowsky-modified
- Settings changed from standard: development.endpoint=extended; development.strength=strong
- Toning and thiosulfate: performed (the stain turns from brown-black to gray-black; silver that was never reduced is removed, so the slide stops changing)
- Events:

1. Changed setting: development.endpoint=extended; thiosulfate=true
2. Note: Started late.
3. deparaffinize-rehydrate
4. water-wash
5. silver-impregnation
6. ammoniacal-silver
7. ammonium-hydroxide-wash
8. development (changed setting: development.strength=strong)
9. gold-toning
10. sodium-thiosulfate
11. final-wash-dehydrate-clear-mount

- Deviations: out-of-order water-wash (expected before: silver-impregnation)
- Label: Illustrative simulation (synthetic, not a measurement)
- Description: Illustrative simulation (synthetic, not a measurement). Axon: high (deposit, schematic ordinal 4 of 4). Plaque core: high (deposit, schematic ordinal 4 of 4). Plaque neurite: high (deposit, schematic ordinal 4 of 4). Tangle: high (deposit, schematic ordinal 4 of 4). Neuropil thread: moderate (deposit, schematic ordinal 3 of 4). Background: moderate. Contrast: trace. Artifacts: protocol-deviation. Conditional on: none. Caveats: Endpoint positions early / sop-default / extended are ordered schematic positions. Nothing is known about where the course SOP's actual times fall on any binding or deposition curve. Longer development is assumed to raise background in this schematic; no source in the registry supports or refutes this for Bielschowsky. A step was performed out of the procedure order or repeated; the state is whatever the performed order produced and no staining claim is made about the deviation.
- Measurements:
  - [Simulated: illustrative, not a measurement] Target/background contrast: none (model scale) (derived)

## Sources

- Litchfield S, Nagy Z. Acta Neuropathol. 2001;101(1):17-21. <https://pubmed.ncbi.nlm.nih.gov/11194935/>
  - Cited for: "The Bielschowsky stain is highly sensitive to changes in ambient temperature." (published, qualitative)

## Model detail (for instructors)

### Model sources

- C-litchfield-2001-temp: "The Bielschowsky stain is highly sensitive to changes in ambient temperature." (published-qualitative). Sources: S-litchfield-2001 Litchfield S, Nagy Z. Acta Neuropathol. 2001;101(1):17-21. <https://pubmed.ncbi.nlm.nih.gov/11194935/>
- C-brief-binding-not-development: "A plateau in silver binding does not mean visible deposition has finished; binding and development are modeled as separate processes." (schematic-analogy). Sources: S-course-guide Start here: course guide and the project brief. <https://utsa.instructure.com/courses/91998/pages/start-here-course-guide>
- C-gallyas-1979-separable: "Binding of silver ions and formation of metallic silver are separable processes with different time courses." (schematic-analogy). Sources: S-gallyas-1979a Gallyas F. Histochemistry 1979;64:87-96. <https://link.springer.com/article/10.1007/BF00493357> | S-gallyas-1979b Gallyas F. Histochemistry 1979;64:97-109. <https://link.springer.com/article/10.1007/BF00493358>
- C-peters-1955-bound-silver: "Deposited silver can come from silver already bound during impregnation or from the developing solution." (published-qualitative). Sources: S-peters-1955 Peters A. Quart J Microsc Sci 1955; s3-96(33):103-115. <https://journals.biologists.com/jcs/article/s3-96/33/103/64148/>
- C-course-ammonia-endpoint: ""Do not add extra ammonia beyond that: too much weakens the stain"; "If it stays faintly cloudy, filter it through paper"." (course-handout). Sources: S-course-procedure NDRB 2903 Bielschowsky Silver Stain Procedure (course procedure, approved for course use 2026-10-12).
- C-course-trouble-no-black: "Little or no black: "Too much ammonia in step 4; silver nitrate old or light-exposed; development stopped too early"." (course-handout). Sources: S-course-procedure NDRB 2903 Bielschowsky Silver Stain Procedure (course procedure, approved for course use 2026-10-12).
- C-peters-1955-nuclei: "Silver staining requires reduced-silver nuclei in the section on which the developer deposits more silver." (published-qualitative). Sources: S-peters-1955 Peters A. Quart J Microsc Sci 1955; s3-96(33):103-115. <https://journals.biologists.com/jcs/article/s3-96/33/103/64148/>
- C-dion-1983-nucleation: "Metallic silver deposited at oxidized aldehyde groups acts as nucleation sites for further deposition when developer is added." (schematic-analogy). Sources: S-dion-1983 Dion AS, Pomenti AA. Anal Biochem. 1983;129(2):490-6. <https://pubmed.ncbi.nlm.nih.gov/6189426/>
- C-peters-1955-developer-strength: "A developer that is too weak gives light, incomplete staining; one that is too strong gives no differentiated staining." (published-qualitative). Sources: S-peters-1955 Peters A. Quart J Microsc Sci 1955; s3-96(33):103-115. <https://journals.biologists.com/jcs/article/s3-96/33/103/64148/>
- C-dion-1983-lysine: "Staining intensity in gels was related to the lysine content of standard proteins, not protein amount alone." (schematic-analogy). Sources: S-dion-1983 Dion AS, Pomenti AA. Anal Biochem. 1983;129(2):490-6. <https://pubmed.ncbi.nlm.nih.gov/6189426/>
- C-course-toning-colour: "Gold toning: "It turns the stain from brown-black to gray-black."" (course-handout). Sources: S-course-procedure NDRB 2903 Bielschowsky Silver Stain Procedure (course procedure, approved for course use 2026-10-12).
- C-course-thiosulfate-purpose: "Thiosulfate: "This removes silver that was never reduced, so the slide stops changing."" (course-handout). Sources: S-course-procedure NDRB 2903 Bielschowsky Silver Stain Procedure (course procedure, approved for course use 2026-10-12).
- C-course-what-you-see: "After silver nitrate "Sections turn faintly yellow to light brown"; after ammoniacal silver "Sections turn tan to brown"." (course-handout). Sources: S-course-procedure NDRB 2903 Bielschowsky Silver Stain Procedure (course procedure, approved for course use 2026-10-12).
- C-course-trouble-dark: "Everything dark brown: "Development too long or too warm; too much developer"." (course-handout). Sources: S-course-procedure NDRB 2903 Bielschowsky Silver Stain Procedure (course procedure, approved for course use 2026-10-12).
- C-course-trouble-patchy: "Patchy staining: "Wax left behind; section dried between steps; jar not full enough to cover the section"." (course-handout). Sources: S-course-procedure NDRB 2903 Bielschowsky Silver Stain Procedure (course procedure, approved for course use 2026-10-12).
- C-course-steps-order: "The course procedure lists the modified Bielschowsky steps in a fixed order." (course-handout). Sources: S-course-handout Course protocol procedure (Canvas file 15321361). <https://utsa.instructure.com/courses/91998/files/15321361>
`;

// Each §6 test as a function of (lab, content, S) so it can run on the fixture and the shipped data.
const T = {
  1: (lab, content) => {
    assert.deepEqual(S.lint(content), []);
    const broken = (code, mutate) => {
      const c = clone(content);
      mutate(c);
      const codes = S.lint(c).map(p => p.code);
      assert.ok(codes.includes(code), `${code}: got ${JSON.stringify(codes)}`);
      assert.throws(() => S.createLab(c), S.ContentError);
    };
    const firstRule = c => c.rules.items[0];
    const compareOnly = c => c.methods.items.find(m => m.compareOnly);
    const bielschowsky = c => c.methods.items.find(m => m.runnable);
    const assetBase = {
      id: 'A-1',
      kind: 'schematic',
      label: S.LABELS.SYNTHETIC,
      rights: { status: 'original' },
      description: 'x',
    };
    broken('rule-without-claim', c => (firstRule(c).claims = []));
    broken('claim-without-source', c => (c.claims.items[0].sources = []));
    broken('unknown-source', c => (c.claims.items[0].sources = ['S-nope']));
    broken('unknown-claim', c => (firstRule(c).claims = ['C-nope']));
    broken('asset-without-label', c => c.assets.items.push({ ...assetBase, label: undefined }));
    broken('asset-rights-unknown', c => c.assets.items.push({ ...assetBase, rights: { status: 'unknown' } }));
    broken('validated-label-present', c => c.assets.items.push({ ...assetBase, label: S.LABELS.VALIDATED }));
    broken('asset-looks-invalid', c => c.assets.items.push({ ...referenceAsset(c), looks: ['nope'] }));
    broken('asset-source-missing', c => c.assets.items.push({ ...referenceAsset(c), sourceId: 'S-nope' }));
    broken('hazard-without-source', c => (c.safety.items[0].sourceId = ''));
    broken(
      'forbidden-disposal-phrase',
      c => (c.safety.items[0].text = 'Pour it down the ' + ['dr', 'ain'].join('') + '.')
    );
    broken('step-unknown', c => (bielschowsky(c).steps[0].id = 'nope'));
    broken('module-fact-without-claim', c => (c.modules.items[0].facts = [{ text: 'x', claims: [] }]));
    broken('method-compare-only-has-steps', c => (compareOnly(c).steps = [{ id: 'development' }]));
    // a quantity needs a sourced purpose (SOP-1): a placeholder step with a time fails on both fixtures
    broken('quantity-not-unspecified-without-source', c => {
      const s = bielschowsky(c).steps[1];
      s.purpose = { text: 'Purpose text not yet sourced.', basis: 'placeholder', claims: [] };
      s.quantities.time = '10 min';
    });
    broken('axiom-missing', c => (c.rules.items = c.rules.items.filter(r => r.id !== 'R-model-03')));
    broken('basis-invalid', c => (firstRule(c).basis = 'nope'));
    broken('basis-invalid', c => (c.rules.items.find(r => r.id === 'R-model-02').basis = 'published-qualitative'));
    broken('hypothesis-rule-without-condition', c =>
      c.rules.hypothesisRules.push({
        id: 'R-hyp-01',
        title: 'x',
        when: { path: 'params.pretreatment', eq: PROBE },
        effect: [],
        basis: 'hypothesis-conditional',
        claims: ['C-course-hypotheses'],
      })
    );
    broken('station-unknown', c => (bielschowsky(c).steps[0].station = 'S9'));
    broken('station-unknown', c => c.methods.stations[0].steps.push('silver-impregnation'));
    broken('default-run-invalid', c => (c.modules.items[0].defaultRuns = [{ specimenId: 'nope' }]));
    broken(
      'default-run-invalid',
      c =>
        (c.modules.items[0].defaultRuns = [{ specimenId: 'SPEC-SYN-AD-01', params: { development: { minutes: 3 } } }])
    );
    broken('outcome-rule-unknown', c => (compareOnly(c).outcomeRule = 'R-temp-01'));
    if (content.clip) {
      // §7 clip codes; the string walk covers clip.json too.
      const structures = c => c.clip.items.find(s => s.id === 'structures');
      broken('clip-fact-without-claim', c => (c.clip.items[0].facts = [{ text: 'x', claims: [] }]));
      broken('clip-fact-without-claim', c => (c.clip.items[0].facts = [{ text: 'x', claims: ['C-nope'] }]));
      broken('clip-fact-without-claim', c => (structures(c).sub[0].facts = [{ text: 'x', claims: [] }]));
      broken(
        'clip-fact-without-claim',
        c => (c.clip.captionFacts = { developmentNotDone: [{ text: 'x', claims: [] }] })
      );
      broken('clip-scene-unknown', c => (c.clip.items[0].id = 'nope'));
      broken('clip-scene-unknown', c => c.clip.items.reverse());
      broken('clip-scene-unknown', c => c.clip.items.pop());
      broken('clip-scene-unknown', c => c.clip.items.push(clone(c.clip.items[0])));
      broken('clip-site-unknown', c => (structures(c).sub[0].site = 'background'));
      broken('clip-site-unknown', c => (structures(c).sub[0].site = 'soma'));
      broken('forbidden-disposal-phrase', c => (c.clip.items[0].caption = 'Down the ' + ['dr', 'ain'].join('') + '.'));
      broken('validated-label-present', c => (c.clip.items[0].title = S.LABELS.VALIDATED));
    }
    for (const code of S.LINT_CODES) assert.ok(typeof code === 'string');
  },
  2: lab => {
    const out = lab.resolve(fullRun(lab, 'r1', 'SPEC-SYN-AD-01'));
    assert.equal(out.label, 'illustrative-synthetic');
    for (const site of ['plaque-core', 'plaque-neurite', 'tangle', 'axon']) assert.equal(vis(out, site), 3, site);
    assert.equal(vis(out, 'neuropil-thread'), 2);
    assert.equal(out.background, 1);
    assert.equal(vis(out, 'background'), 1);
    assert.equal(out.contrast, 2);
    for (const id of ['R-model-01', 'R-model-02', 'R-model-03', 'R-model-04', 'R-model-05', 'R-model-06'])
      assert.ok(out.rulesApplied.includes(id), id);
    assert.ok(!out.rulesApplied.includes('R-order-01'));
    for (const site of S.SITE_CLASSES) assert.equal(out.state[site].ratePhase, 'reference', site);
    const endpointCaveat = lab.getRule('R-model-01').effect.find(op => op.op === 'caveat').text;
    assert.equal(count(out.caveats, endpointCaveat), 1);
    // MODE-engine-1: toning and thiosulfate are modeled (R-model-08 / 09); no engine-fixed caveat.
    assert.ok(!('no-effect-v1' in S.FIXED_CAVEATS));
    assert.ok(!out.caveats.some(c => /no modeled effect/i.test(c)));
    for (const id of ['R-model-08', 'R-model-09', 'R-react-look']) assert.ok(out.rulesApplied.includes(id), id);
    assert.equal(out.mode, 'practice');
    assert.equal(out.tone, 'gold');
    assert.deepEqual(out.look, { key: 'gray-black', text: S.LOOKS['gray-black'].text });
    assert.deepEqual(out.slide, { wax: false, coverslipped: true, fixed: true, toned: true, unfixed: false });
    for (const site of S.SITE_CLASSES)
      assert.equal(out.state[site].ionicBound, 0, `${site}: thiosulfate removed the unreduced silver`);
    assert.ok(!('reactions' in out) && !('gaps' in out));
    assert.equal(out.confidence, 'nominal');
    assert.deepEqual(out.artifacts, []);
    assert.equal(out.conditionalOn, null);
    assert.ok(lab.describeOutcome(out).includes('Plaque core: moderate (deposit, schematic ordinal 3 of 4).'));
  },
  3: lab => {
    const sop = lab.resolve(fullRun(lab, 'sop', 'SPEC-SYN-AD-01'));
    const impExt = lab.resolve(fullRun(lab, 'imp', 'SPEC-SYN-AD-01', { impregnation: { endpoint: 'extended' } }));
    // Bound silver is read at the ammoniacal-silver frame (R-model-09 removes it at thiosulfate).
    const bound = run => lab.replay(run)[S.STEPS.indexOf('ammoniacal-silver')].state;
    const sopBound = bound(fullRun(lab, 'sop', 'SPEC-SYN-AD-01')),
      extBound = bound(fullRun(lab, 'imp', 'SPEC-SYN-AD-01', { impregnation: { endpoint: 'extended' } }));
    for (const site of TARGETS) {
      assert.equal(extBound[site].ionicBound, sopBound[site].ionicBound, site);
      assert.ok(sopBound[site].ionicBound > 0, site);
      assert.equal(impExt.state[site].deposit, sop.state[site].deposit, site);
    }
    const devExt = lab.resolve(fullRun(lab, 'dev', 'SPEC-SYN-AD-01', { development: { endpoint: 'extended' } }));
    for (const site of TARGETS)
      if (sop.state[site].deposit > 0) assert.equal(devExt.state[site].deposit, sop.state[site].deposit + 1, site);
    assert.equal(devExt.background, sop.background + 1);
    assert.equal(devExt.contrast, 2);
    const strong = lab.resolve(fullRun(lab, 'strong', 'SPEC-SYN-AD-01', { development: { strength: 'strong' } }));
    for (const site of ['plaque-core', 'plaque-neurite', 'tangle', 'axon']) assert.equal(vis(strong, site), 3, site);
    assert.equal(strong.background, 2);
    assert.equal(strong.contrast, 1);
    assert.ok(strong.contrast < sop.contrast);
    const weak = lab.resolve(fullRun(lab, 'weak', 'SPEC-SYN-AD-01', { development: { strength: 'weak' } }));
    for (const site of ['plaque-core', 'plaque-neurite', 'tangle', 'axon'])
      assert.equal(weak.state[site].deposit, 2, site);
    assert.equal(weak.background, 1);
  },
  4: lab => {
    const low = lab.resolve(fullRun(lab, 'low', 'SPEC-SYN-LOWCHEM-01'));
    const ad2 = lab.resolve(fullRun(lab, 'ad2', 'SPEC-SYN-AD-02'));
    const ad2ext = lab.resolve(fullRun(lab, 'ad2x', 'SPEC-SYN-AD-02', { development: { endpoint: 'extended' } }));
    const ad1 = lab.resolve(fullRun(lab, 'ad1', 'SPEC-SYN-AD-01'));
    assert.equal(vis(low, 'plaque-core'), 1);
    assert.equal(vis(ad2, 'plaque-core'), 2);
    assert.equal(vis(ad2ext, 'plaque-core'), 3);
    assert.equal(vis(ad2ext, 'plaque-core'), vis(ad1, 'plaque-core'));
    assert.ok(
      lab.getSpecimen('SPEC-SYN-LOWCHEM-01').sites['plaque-core'].presence >
        lab.getSpecimen('SPEC-SYN-AD-02').sites['plaque-core'].presence
    );
  },
  5: lab => {
    const out = lab.resolve(fullRun(lab, 'neg', 'SPEC-SYN-NEG-01'));
    assert.equal(out.label, 'illustrative-synthetic');
    assert.equal(vis(out, 'axon'), 3);
    assert.equal(vis(out, 'plaque-core'), 0);
    assert.ok(out.rulesApplied.includes('R-norm-01'));
    const caveat = lab.getRule('R-norm-01').effect.find(op => op.op === 'caveat').text;
    assert.ok(out.caveats.includes(caveat));
  },
  6: lab => {
    const card = (run, code) => {
      const out = lab.resolve(run);
      assert.equal(out.label, 'no-basis', JSON.stringify(out.code || out.label));
      assert.equal(out.code, code);
      assert.ok(out.explanation.length > 0 && out.whatWouldBeNeeded.length > 0 && out.suggestedNext.length > 0);
      return out;
    };
    const missing = S.STEPS.filter(s => s !== 'gold-toning');
    const inOrder = card(
      perform(lab, lab.createRun({ id: 'a', specimenId: 'SPEC-SYN-AD-01' }), missing),
      'step-skipped'
    );
    const shuffled = card(
      perform(lab, lab.createRun({ id: 'b', specimenId: 'SPEC-SYN-AD-01' }), [...missing].reverse()),
      'step-skipped'
    );
    assert.deepEqual(inOrder.outsideSupport, ['gold-toning']);
    assert.deepEqual(shuffled.outsideSupport, ['gold-toning']);
    assert.deepEqual(
      card(fullRun(lab, 'w', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } }), 'param-uncovered')
        .outsideSupport,
      ['washes.condition']
    );
    assert.deepEqual(
      card(fullRun(lab, 'am', 'SPEC-SYN-AD-01', { ammoniacal: { endpoint: 'early' } }), 'param-uncovered')
        .outsideSupport,
      ['ammoniacal.endpoint']
    );
    assert.ok(
      card(
        fullRun(lab, 'ic', 'SPEC-SYN-AD-01', { impregnation: { condition: 'deviated' } }),
        'param-uncovered'
      ).outsideSupport.includes('impregnation.condition')
    );
    assert.ok(
      card(
        fullRun(lab, 'ds', 'SPEC-SYN-AD-01', { development: { strength: 'unspecified' } }),
        'param-uncovered'
      ).outsideSupport.includes('development.strength')
    );
    const hyp = card(fullRun(lab, 'p', 'SPEC-SYN-AD-01', { pretreatment: PROBE }), 'hypothesis-unencoded');
    assert.deepEqual(hyp.hypotheses, [...S.HYPOTHESES]);
    assert.equal(hyp.hypotheses.length, 4);
    card(fullRun(lab, 'm', 'SPEC-SYN-AD-01', {}, 'nope'), 'method-unknown');
    card(fullRun(lab, 's', 'SPEC-NOPE'), 'specimen-unknown');
    const both = card(
      perform(
        lab,
        lab.createRun({ id: 'c', specimenId: 'SPEC-SYN-AD-01', params: { washes: { condition: 'deviated' } } }),
        missing
      ),
      'step-skipped'
    );
    assert.deepEqual(both.outsideSupport, ['gold-toning', 'washes.condition']);
  },
  7: lab => {
    const literal = S.LABELS.VALIDATED;
    const lines = ENGINE_SRC.split('\n').filter(line => line.includes(literal));
    assert.equal(lines.length, 1, 'the literal appears once, in LABELS');
    assert.match(lines[0], /VALIDATED:/);
    const outcomes = [
      lab.resolve(fullRun(lab, 'a', 'SPEC-SYN-AD-01')),
      lab.resolve(fullRun(lab, 'b', 'SPEC-SYN-AD-02', { development: { endpoint: 'extended', strength: 'strong' } })),
      lab.resolve(fullRun(lab, 'c', 'SPEC-SYN-NEG-01', { impregnation: { temperature: 'deviated' } })),
      lab.resolve(lab.createRun({ id: 'd', specimenId: 'SPEC-SYN-AD-01', method: 'cps-i' })),
      lab.resolve(lab.createRun({ id: 'e', specimenId: 'SPEC-SYN-AD-01', method: 'cps-ii' })),
    ];
    for (const out of outcomes) assert.equal(out.label, 'illustrative-synthetic');
    assert.equal(
      lab.schematicCurves(outcomes[0] && fullRun(lab, 'f', 'SPEC-SYN-AD-01')).label,
      'illustrative-synthetic'
    );
  },
  8: lab => {
    const order = [
      'deparaffinize-rehydrate',
      'development',
      'silver-impregnation',
      'water-wash',
      'ammoniacal-silver',
      'ammonium-hydroxide-wash',
      'gold-toning',
      'sodium-thiosulfate',
      'final-wash-dehydrate-clear-mount',
    ];
    const run = perform(lab, lab.createRun({ id: 'o', specimenId: 'SPEC-SYN-AD-01' }), order);
    const out = lab.resolve(run);
    assert.equal(out.label, 'illustrative-synthetic');
    for (const site of TARGETS) assert.equal(vis(out, site), 0, site);
    assert.equal(out.background, 1);
    assert.equal(out.contrast, 0);
    assert.deepEqual(out.artifacts, ['protocol-deviation']);
    assert.ok(out.rulesApplied.includes('R-order-01'));
    const dev = out.deviations.find(d => d.kind === 'out-of-order' && d.step === 'development');
    assert.deepEqual(dev.expectedBefore, [
      'silver-impregnation',
      'water-wash',
      'ammoniacal-silver',
      'ammonium-hydroxide-wash',
    ]);
    assert.ok(!out.deviations.some(d => d.kind === 'skipped'));
    const repeated = lab.applyEvent(fullRun(lab, 'rep', 'SPEC-SYN-AD-01'), {
      seq: 10,
      type: 'step',
      step: 'water-wash',
    });
    const rout = lab.resolve(repeated);
    assert.ok(rout.deviations.some(d => d.kind === 'repeated' && d.step === 'water-wash'));
    assert.deepEqual(rout.artifacts, ['protocol-deviation']);
    assert.equal(rout.label, 'illustrative-synthetic');
  },
  9: lab => {
    const out = lab.resolve(fullRun(lab, 't', 'SPEC-SYN-AD-01', { impregnation: { temperature: 'deviated' } }));
    assert.equal(out.label, 'illustrative-synthetic');
    assert.equal(out.confidence, 'low');
    assert.ok(out.claims.includes('C-litchfield-2001-temp'));
    assert.ok(out.rulesApplied.includes('R-temp-01'));
  },
  10: lab => {
    const base = fullRun(lab, 'base', 'SPEC-SYN-AD-01');
    const ext = fullRun(lab, 'ext', 'SPEC-SYN-AD-01', { development: { endpoint: 'extended' } });
    const a = lab.compare(base, ext);
    assert.equal(a.label, 'illustrative-synthetic');
    assert.deepEqual(a.changedParams, ['development.endpoint']);
    for (const site of S.SITE_CLASSES) {
      assert.equal(
        a.perSite[site].delta,
        a.experimental.perSite[site].visibility - a.baseline.perSite[site].visibility
      );
      if (site === 'background' || a.baseline.perSite[site].visibility > 0)
        assert.equal(a.perSite[site].delta, 1, site);
    }
    assert.ok(a.rulesResponsible.includes('R-model-03') && a.rulesResponsible.includes('R-model-04'));
    const b = lab.compare(base, fullRun(lab, 'ad2', 'SPEC-SYN-AD-02'));
    assert.deepEqual(b.changedParams, ['specimenId']);
    assert.ok(S.SITE_CLASSES.some(site => b.perSite[site].delta !== 0));
    const c = lab.compare(base, fullRun(lab, 'w', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } }));
    assert.equal(c.label, 'no-basis');
    assert.equal(c.perSite, null);
    const d = lab.compare(base, lab.createRun({ id: 'cps', specimenId: 'SPEC-SYN-AD-01', method: 'cps-i' }));
    assert.equal(d.label, 'no-basis');
    assert.equal(d.perSite, null);
    assert.deepEqual(d.rulesResponsible, ['R-method-01', 'R-method-02']);
    assert.ok(d.caveats.includes(S.CROSS_METHOD_CAVEAT));
    assert.ok(d.changedParams.includes('method'));
    // F4: cross-method stays cross-method when the cps side resolves to a card; the per-side rule
    // diff is never reported across methods, and both caveat sets are present.
    const cpsCard = lab.createRun({
      id: 'cpsw',
      specimenId: 'SPEC-SYN-AD-01',
      method: 'cps-i',
      params: { washes: { condition: 'deviated' } },
    });
    assert.equal(lab.resolve(cpsCard).label, 'no-basis');
    const d2 = lab.compare(base, cpsCard);
    assert.equal(d2.label, 'no-basis');
    assert.equal(d2.perSite, null);
    assert.deepEqual(d2.rulesResponsible, ['R-method-01', 'R-method-02']);
    assert.ok(d2.caveats.includes(S.CROSS_METHOD_CAVEAT));
    for (const id of ['R-method-01', 'R-method-02'])
      assert.ok(d2.caveats.includes(lab.getRule(id).effect.find(op => op.op === 'caveat').text), id);
    assert.ok(d2.caveats.some(c => c.startsWith('Run cpsw resolved to an uncertainty card (param-uncovered)')));
    assert.ok(d2.changedParams.includes('method') && d2.changedParams.includes('washes.condition'));
    assert.ok(!d2.rulesResponsible.some(id => /^R-model-/.test(id) || id === 'R-method-03-cps1'));
    const stepLevel = fullRun(lab, 'ext', 'SPEC-SYN-AD-01', {}, 'bielschowsky-modified', {
      development: { development: { endpoint: 'extended' } },
    });
    assert.deepEqual(lab.resolve(stepLevel), lab.resolve(ext));
    assert.deepEqual(lab.compare(base, stepLevel).changedParams, a.changedParams);
    assert.deepEqual(lab.compare(base, stepLevel).perSite, a.perSite);
  },
  11: (lab, content) => {
    const runs = {
      base: fullRun(lab, 'base', 'SPEC-SYN-AD-01'),
      ext: fullRun(lab, 'ext', 'SPEC-SYN-AD-01', { development: { endpoint: 'extended' } }),
    };
    const exp = experiment('base', 'ext');
    assert.equal(
      lab.canReveal({ ...exp, predictions: { expected: 'e', negligible: '', opposite: 'o' } }, runs).ok,
      false
    );
    assert.equal(lab.canReveal({ ...exp, controls: [] }, runs).ok, false);
    assert.equal(lab.canReveal({ ...exp, measures: [] }, runs).ok, false);
    assert.equal(lab.canReveal({ ...exp, independentVariable: '' }, runs).ok, false);
    assert.equal(lab.canReveal(exp, { base: runs.base }).ok, false);
    assert.equal(
      lab.canReveal(exp, { ...runs, ext: lab.createRun({ id: 'ext', specimenId: 'SPEC-SYN-AD-01' }) }).ok,
      false
    );
    const refused = lab.reveal({ ...exp, controls: [] }, runs);
    assert.equal(refused.ok, false);
    assert.ok(refused.reasons.length > 0 && !('cards' in refused) && !('comparison' in refused));
    assert.equal(lab.canReveal(exp, runs).ok, true);
    const plain = lab.reveal(exp, runs);
    assert.equal(plain.ok, true);
    assert.equal(plain.cards.length, 1);
    assert.equal(plain.cards[0].kind, 'outcome');
    assert.equal(plain.cards[0].conditionalOn, null);
    assert.ok(
      plain.cards[0].prompts.supports && plain.cards[0].prompts.failsToEstablish && plain.cards[0].prompts.next
    );
    const probeRuns = { ...runs, probe: fullRun(lab, 'probe', 'SPEC-SYN-AD-01', { pretreatment: PROBE }) };
    const unencoded = lab.reveal(experiment('base', 'probe'), probeRuns);
    assert.equal(unencoded.cards.length, 1);
    assert.equal(unencoded.cards[0].kind, 'uncertainty');
    assert.equal(unencoded.cards[0].card.code, 'hypothesis-unencoded');
    assert.deepEqual(unencoded.cards[0].card.hypotheses, [...S.HYPOTHESES]);
    assert.equal(unencoded.label, 'no-basis');
    const withHyp = clone(content);
    withHyp.rules.hypothesisRules.push({
      id: 'R-hyp-fixture-01',
      title: 'Fixture-only hypothesis rule',
      when: { path: 'params.pretreatment', eq: PROBE },
      effect: [
        { op: 'conditional', hypothesis: 'H-fixation-carbonyl' },
        { op: 'caveat', text: 'Test fixture only: encodes no real direction.' },
      ],
      basis: 'hypothesis-conditional',
      claims: ['C-course-hypotheses'],
      system: 'course recording',
      transferable: 'qualitative-only',
      conditionalOn: 'H-fixation-carbonyl',
      informational: false,
    });
    const lab2 = S.createLab(withHyp);
    const runs2 = {
      base: fullRun(lab2, 'base', 'SPEC-SYN-AD-01'),
      probe: fullRun(lab2, 'probe', 'SPEC-SYN-AD-01', { pretreatment: PROBE }),
    };
    const four = lab2.reveal(experiment('base', 'probe'), runs2);
    assert.equal(four.ok, true);
    assert.equal(four.cards.length, 4);
    assert.deepEqual(
      four.cards.map(c => c.conditionalOn),
      [...S.HYPOTHESES]
    );
    assert.deepEqual(
      four.cards.map(c => c.kind),
      ['outcome', 'uncertainty', 'uncertainty', 'uncertainty']
    );
    assert.equal(four.cards[0].outcome.conditionalOn, 'H-fixation-carbonyl');
    assert.equal(four.cards[0].outcome.label, 'illustrative-synthetic');
    for (const c of four.cards.slice(1)) assert.equal(c.card.code, 'hypothesis-unencoded');
    assert.equal(four.label, 'illustrative-synthetic');
    // SH-9: attribution is tied to rule.conditionalOn (what lint checks and reveal filters by), so a
    // hypothesis rule that lacks the optional 'conditional' op still yields outcome.conditionalOn ===
    // card.conditionalOn and a body that names the same hypothesis as the title.
    const noOp = clone(content);
    noOp.rules.hypothesisRules.push({
      id: 'R-hyp-fixture-02',
      title: 'Fixture-only hypothesis rule without a conditional op',
      when: { path: 'params.pretreatment', eq: PROBE },
      effect: [{ op: 'caveat', text: 'Test fixture only: encodes no real direction.' }],
      basis: 'hypothesis-conditional',
      claims: ['C-course-hypotheses'],
      system: 'course recording',
      transferable: 'qualitative-only',
      conditionalOn: 'H-reduced-metal',
      informational: false,
    });
    const lab3 = S.createLab(noOp);
    const runs3 = {
      base: fullRun(lab3, 'base', 'SPEC-SYN-AD-01'),
      probe: fullRun(lab3, 'probe', 'SPEC-SYN-AD-01', { pretreatment: PROBE }),
    };
    assert.equal(lab3.resolve(runs3.probe).conditionalOn, 'H-reduced-metal');
    const cards3 = lab3.reveal(experiment('base', 'probe'), runs3).cards;
    assert.deepEqual(
      cards3.map(c => c.kind),
      ['uncertainty', 'uncertainty', 'outcome', 'uncertainty']
    );
    const metal = cards3[S.HYPOTHESES.indexOf('H-reduced-metal')];
    assert.equal(metal.conditionalOn, 'H-reduced-metal');
    assert.equal(metal.outcome.conditionalOn, metal.conditionalOn);
    assert.ok(metal.title.includes(S.HYPOTHESIS_TEXT['H-reduced-metal']));
    assert.ok(metal.body.includes(`Conditional on: ${S.HYPOTHESIS_TEXT['H-reduced-metal']}.`));
    assert.ok(!metal.body.includes('Conditional on: none'));
  },
  12: lab => {
    const cps1 = lab.resolve(lab.createRun({ id: 'c1', specimenId: 'SPEC-SYN-AD-01', method: 'cps-i' }));
    const cps2 = lab.resolve(lab.createRun({ id: 'c2', specimenId: 'SPEC-SYN-AD-01', method: 'cps-ii' }));
    for (const out of [cps1, cps2]) {
      assert.equal(out.label, 'illustrative-synthetic');
      assert.equal(vis(out, 'axon'), 0);
      assert.equal(vis(out, 'plaque-neurite'), 4);
      assert.equal(out.background, 0);
      assert.ok(out.caveats.includes(COMPARE_ONLY_CAVEAT));
      for (const site of S.SITE_CLASSES) {
        assert.equal(out.state[site].ionicBound, null, site);
        assert.equal(out.state[site].nuclei, null, site);
        assert.equal(out.state[site].ratePhase, 'unknown', site);
      }
      assert.equal(out.confidence, 'nominal');
    }
    assert.equal(vis(cps1, 'plaque-core'), 4);
    assert.equal(vis(cps2, 'plaque-core'), 1);
    assert.deepEqual(cps1.rulesApplied, ['R-method-03-cps1']);
    assert.deepEqual(cps2.rulesApplied, ['R-method-03-cps2']);
    assert.ok(cps2.caveats.includes(CPS2_CAVEAT));
    assert.ok(!cps1.caveats.includes(CPS2_CAVEAT));
    assert.ok(cps1.claims.includes('C-velasco-1992-normal-neurites-unstained'));
    assert.ok(!cps2.claims.includes('C-velasco-1992-normal-neurites-unstained'));
    const stepped = lab.applyEvent(lab.createRun({ id: 'c3', specimenId: 'SPEC-SYN-AD-01', method: 'cps-i' }), {
      seq: 1,
      type: 'step',
      step: 'development',
    });
    assert.deepEqual(
      stepped.deviations.map(d => d.kind),
      ['not-runnable']
    );
    const out = lab.resolve(stepped);
    assert.equal(out.label, 'illustrative-synthetic');
    assert.deepEqual(
      out.deviations.map(d => d.kind),
      ['not-runnable']
    );
    assert.equal(lab.describeOutcome(cps1).includes('(visibility, schematic ordinal 4 of 4)'), true);
    // F1: a compare-only run is schematized by its outcomeRule alone. R-norm-01 (Bielschowsky axons)
    // and R-temp-01 (Litchfield studied Bielschowsky) never fire on it; a param they would have read
    // falls through to the coverage check instead of silently changing a CPS outcome.
    const negCps = lab.resolve(lab.createRun({ id: 'n', specimenId: 'SPEC-SYN-NEG-01', method: 'cps-i' }));
    assert.deepEqual(negCps.rulesApplied, ['R-method-03-cps1']);
    assert.ok(!negCps.claims.includes('C-course-negative-tissue-stains'));
    assert.ok(!negCps.caveats.includes(lab.getRule('R-norm-01').effect.find(op => op.op === 'caveat').text));
    const tempCps = lab.resolve(
      lab.createRun({
        id: 't',
        specimenId: 'SPEC-SYN-AD-01',
        method: 'cps-i',
        params: { impregnation: { temperature: 'deviated' } },
      })
    );
    assert.equal(tempCps.label, 'no-basis');
    assert.equal(tempCps.code, 'param-uncovered');
    assert.deepEqual(tempCps.outsideSupport, ['impregnation.temperature']);
    assert.deepEqual(tempCps.rulesConsulted, ['R-method-03-cps1']);
  },
  13: lab => {
    const runs = {
      base: fullRun(lab, 'base', 'SPEC-SYN-AD-01'),
      ext: fullRun(lab, 'ext', 'SPEC-SYN-AD-01', { development: { endpoint: 'extended' } }),
    };
    runs.w = fullRun(lab, 'w', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } });
    let nb = lab.newNotebook();
    nb = lab.addEntry(nb, {
      id: 'e1',
      type: 'published',
      section: 'starting-ideas',
      text: 'Temperature matters.',
      claimId: 'C-litchfield-2001-temp',
    });
    nb = lab.addEntry(
      nb,
      {
        id: 'e2',
        type: 'simulated',
        section: 'outcomes-limitations',
        text: 'Extended development darkened the simulated field.',
        runId: 'ext',
        label: 'illustrative-synthetic',
      },
      runs
    );
    nb = lab.addEntry(
      nb,
      {
        id: 'e3',
        type: 'simulated',
        section: 'outcomes-limitations',
        text: 'Washes change gave no basis.',
        runId: 'w',
        label: 'no-basis',
      },
      runs
    );
    nb = lab.addEntry(nb, {
      id: 'e4',
      type: 'observed',
      section: 'process-decisions',
      text: 'Slides looked uneven.',
      assetId: null,
      observedAt: '2026-10-10',
    });
    nb = lab.addEntry(nb, {
      id: 'e5',
      type: 'reflection',
      section: 'learning-reflection',
      text: 'I learned to write predictions first.',
    });
    nb = lab.addEntry(nb, {
      id: 'e6',
      type: 'reflection',
      section: 'next-steps',
      text: 'Design the negative comparison.',
    });
    const measurements = [
      {
        id: 'm1',
        measurementId: 'contrast-ordinal',
        runId: 'ext',
        label: 'illustrative-synthetic',
        value: 2,
        unit: 'ordinal',
        manual: false,
        note: 'read from the simulated field',
      },
    ];
    // ENGINE-9: one experiment carrying the designer fields, one with them blank or empty.
    const written = { ...experiment('base', 'ext'), measures: ['contrast-ordinal', 'roi-lesion-count'] },
      empty = {
        ...experiment('base', 'ext'),
        id: 'exp-2',
        title: 'Empty design',
        background: '  ',
        changed: [],
        heldComparable: [' '],
        measures: [],
      };
    const md = lab.exportNotebook(
      { notebook: nb, experiments: [written, empty], runsById: runs, measurements },
      { title: 'Test notebook', studentLabel: 'Student A' }
    );
    // ENGINE-9 / ENGINE-13: the experiment's fields, one "- Field: value" item each under the
    // designer's names and in its order, up to the blank line before the first run.
    const designLines = title => md.split(`### ${title}\n\n`)[1].split('\n\n')[0].split('\n');
    const design = (fields, measures) => [
      '- Status: draft',
      `- Background: ${fields.background}`,
      '- Your question: q',
      '- Your hypothesis: h',
      '- Another explanation: a',
      // the main variable equals "What you change", so it is not printed twice
      '- What you change: development.endpoint',
      `- What you keep the same: ${fields.held}`,
      `- Controls: characterized-positive ${S.STAND_IN_SUFFIX}, addresses: that the stain worked at all`,
      `- Outcome measures: ${measures}`,
      '- Baseline run (standard): Run base',
      '- Experimental run (with your change): Run ext',
      '- Expected outcome: e',
      '- Negligible change: n',
      '- Opposite outcome: o',
      '- Limits of your design: l',
      '- Interpretation: not written',
    ];
    assert.deepEqual(
      designLines('Development endpoint'),
      design(
        { background: 'b', held: 'specimen, impregnation.endpoint' },
        'Target/background contrast, Predefined-region lesion count'
      )
    );
    // an empty chip list falls back to the main variable the student wrote
    assert.deepEqual(
      designLines('Empty design'),
      design({ background: 'not written', held: 'not written' }, 'not written')
    );
    assert.ok(md.includes(S.EXPORT_DISCLAIMER));
    for (const tag of Object.values(S.ENTRY_TAG)) assert.ok(md.includes(tag), tag);
    const headings = md
      .split('\n')
      .filter(l => l.startsWith('## '))
      .map(l => l.slice(3));
    assert.deepEqual(headings, [
      ...S.SECTIONS.map(s => S.SECTION_TEXT[s]),
      'Experiment log',
      'Sources',
      'Model detail (for instructors)',
    ]);
    const lines = md.split('\n');
    let inSimulated = false;
    for (const line of lines) {
      if (/^\s*(- )?\[Simulated: illustrative, not a measurement\]/.test(line)) inSimulated = true;
      else if (!/^\s{2,}\S/.test(line)) inSimulated = false;
      if (inSimulated) assert.doesNotMatch(line.replace(/simulated results?/gi, ''), /\bresults?\b/i, line);
    }
    assert.ok(md.includes(`characterized-positive ${S.STAND_IN_SUFFIX}`));
    assert.ok(md.includes('Run ext, label: Illustrative simulation (synthetic, not a measurement)'));
    assert.ok(md.includes('Real-lab observation, 2026-10-10'));
    assert.throws(
      () => lab.addEntry(nb, { id: 'x', type: 'published', section: 'starting-ideas', text: 't', claimId: 'C-nope' }),
      /claimId/
    );
    assert.throws(() => lab.addEntry(nb, { id: 'x', type: 'reflection', section: 'nope', text: 't' }), /section/);
    assert.throws(
      () =>
        lab.addEntry(nb, {
          id: 'x',
          type: 'simulated',
          section: 'next-steps',
          text: 't',
          label: 'illustrative-synthetic',
        }),
      /runId/
    );
    assert.throws(
      () =>
        lab.addEntry(nb, {
          id: 'x',
          type: 'observed',
          section: 'next-steps',
          text: 't',
          assetId: null,
          observedAt: 'now',
          runId: 'base',
        }),
      /runId/
    );
    assert.throws(
      () =>
        lab.addEntry(
          nb,
          { id: 'x', type: 'simulated', section: 'next-steps', text: 't', runId: 'w', label: 'illustrative-synthetic' },
          runs
        ),
      /label/
    );
  },
  14: () => {
    const a = S.serialize({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: 2 } });
    const b = S.serialize({ a: { c: 2, d: [1, { y: 2, z: 1 }] }, b: 1 });
    assert.equal(a, b);
    assert.deepEqual(S.deserialize(S.serialize({ v: 1, x: 'y' })), { v: 1, x: 'y' });
    assert.throws(() => S.deserialize(JSON.stringify({ v: 2 })), S.ContentError);
    assert.throws(() => S.deserialize(JSON.stringify({ x: 1 })), S.ContentError);
  },
  15: () => {
    const body = ENGINE_SRC.split('\n')
      .filter(line => !/^\(function \(root\)|^\}\)\(typeof globalThis/.test(line))
      .join('\n');
    assert.doesNotMatch(body, /\bDate\b/);
    assert.doesNotMatch(body, /Math\.random/);
    assert.doesNotMatch(body, /\bfetch\b/);
    assert.doesNotMatch(body, /\bdocument\./);
    assert.doesNotMatch(body, /\bwindow\./);
    assert.doesNotMatch(body, /\bsetTimeout\b|\bperformance\b|\brequestAnimationFrame\b/);
    assert.match(ENGINE_SRC, /root\.SilverLab = api/);
    assert.match(ENGINE_SRC, /module\.exports = api/);
    assert.doesNotMatch(ENGINE_SRC, /^\s*(import|export)\s/m);
  },
  16: lab => {
    const nb = lab.newNotebook();
    assert.throws(
      () =>
        lab.addEntry(nb, {
          id: 'x',
          type: 'simulated',
          section: 'next-steps',
          text: 't',
          runId: 'r',
          label: S.LABELS.VALIDATED,
        }),
      /label/
    );
    assert.throws(
      () =>
        lab.addEntry(nb, { id: 'x', type: 'reflection', section: 'next-steps', text: 't', label: S.LABELS.VALIDATED }),
      /label/
    );
    let err;
    try {
      S.deserialize(JSON.stringify({ v: 1, runs: { r1: { outcome: { label: S.LABELS.VALIDATED } } } }));
    } catch (e) {
      err = e;
    }
    assert.ok(err instanceof S.ContentError);
    assert.equal(err.problems.length, 1);
    assert.equal(err.problems[0].code, 'validated-label-present');
    const mention = {
      v: 1,
      notebook: {
        v: 1,
        entries: [
          {
            id: 'e',
            type: 'reflection',
            section: 'next-steps',
            text: `The ${S.LABELS.VALIDATED} label has no members.`,
          },
        ],
      },
    };
    assert.deepEqual(S.deserialize(JSON.stringify(mention)), mention);
    const runs = { w: fullRun(lab, 'w', 'SPEC-SYN-AD-01', { washes: { condition: 'deviated' } }) };
    const notebook = lab.addEntry(
      nb,
      {
        id: 'e1',
        type: 'simulated',
        section: 'outcomes-limitations',
        text: 'Washes changed.',
        runId: 'w',
        label: 'no-basis',
      },
      runs
    );
    const md = lab.exportNotebook({ notebook, experiments: [], runsById: runs, measurements: [] }, { title: 't' });
    const block = md.split('## Outcomes and limitations')[1].split('## ')[0];
    assert.ok(block.includes('Run w, label: No basis for a simulated result'));
    assert.ok(!block.includes('Illustrative simulation'));
  },
  17: lab => {
    const run = fullRun(lab, 'r', 'SPEC-SYN-AD-01', { impregnation: { endpoint: 'early' } });
    const frames = lab.replay(run);
    assert.equal(frames.length, run.events.length);
    assert.deepEqual(
      frames.map(f => f.seq),
      run.events.map(e => e.seq)
    );
    assert.deepEqual(frames[frames.length - 1].state, lab.resolve(run).state);
    const fired = [...new Set(frames.flatMap(f => f.rulesFired))].sort();
    const stepRules = lab
      .resolve(run)
      .rulesApplied.filter(id => run.rulesApplied.includes(id))
      .sort();
    assert.deepEqual(fired, stepRules);
    assert.deepEqual(fired, [...run.rulesApplied].sort());
    const truncated = { ...run, events: run.events.slice(0, 4) };
    const partial = lab.replay(truncated);
    assert.equal(partial.length, 4);
    assert.ok(partial.every(f => !('code' in f) && f.label === undefined));
    assert.deepEqual(partial[3].stepsDone, S.STEPS.slice(0, 4));
    const withSet = lab.applyEvent(
      lab.applyEvent(lab.createRun({ id: 's', specimenId: 'SPEC-SYN-AD-01' }), {
        seq: 1,
        type: 'step',
        step: 'deparaffinize-rehydrate',
      }),
      { seq: 2, type: 'set-params', params: { development: { endpoint: 'extended' } } }
    );
    const done = S.STEPS.slice(1).reduce(
      (r, s, i) => lab.applyEvent(r, { seq: i + 3, type: 'step', step: s }),
      withSet
    );
    assert.deepEqual(lab.replay(done)[lab.replay(done).length - 1].state, lab.resolve(done).state);
    assert.equal(lab.resolve(done).background, 2);
    // R1-05: a repeated step re-fires its rules and changes state; the frame attributes that change
    // to the rules even though rulesApplied holds each id once.
    const again = lab.applyEvent(fullRun(lab, 'again', 'SPEC-SYN-AD-01'), {
      seq: 10,
      type: 'step',
      step: 'development',
      params: { development: { endpoint: 'extended' } },
    });
    const againFrames = lab.replay(again);
    assert.equal(againFrames.length, 10);
    assert.deepEqual([...againFrames[9].rulesFired].sort(), [
      'R-model-02',
      'R-model-03',
      'R-model-04',
      'R-model-05',
      'R-model-06',
    ]);
    assert.equal(againFrames[8].state.background.deposit, 1);
    assert.equal(againFrames[9].state.background.deposit, 2);
    assert.deepEqual(againFrames[9].state, lab.resolve(again).state);
    assert.ok(againFrames[9].deviationsSoFar.some(d => d.kind === 'repeated' && d.step === 'development'));
    assert.deepEqual([...new Set(againFrames.flatMap(f => f.rulesFired))].sort(), [...again.rulesApplied].sort());
    assert.ok(Object.isFrozen(lab.content));
  },
  18: lab => {
    assert.deepEqual(
      lab.listStations().map(s => s.id),
      ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']
    );
    const all = lab.listStations().flatMap(s => s.steps);
    for (const stepId of S.STEPS) assert.equal(count(all, stepId), 1, stepId);
    const ex = lab.explainStep('ammoniacal-silver');
    assert.ok(Array.isArray(ex.hazards) && ex.hazards.length > 0);
    for (const h of ex.hazards) assert.ok(h.sourceId === 'PENDING-EHS' || lab.getSource(h.sourceId), h.id);
    assert.equal(ex.step, 'ammoniacal-silver');
    assert.ok(typeof ex.modelEffect === 'string' && ex.modelEffect.includes('R-model-01'));
    // §11.5: gold toning and thiosulfate name their practice rules; a free-bench rule is never named.
    assert.ok(lab.explainStep('gold-toning').modelEffect.includes('R-model-08'));
    assert.ok(lab.explainStep('sodium-thiosulfate').modelEffect.includes('R-model-09'));
    for (const stepId of S.STEPS) assert.ok(!/R-react-/.test(lab.explainStep(stepId).modelEffect), stepId);
    // SH-2: the card for the step where a param is chosen names the rule that reads it, with the
    // step where it applies; the four no-effect steps keep the no-effect sentence.
    const imp = lab.explainStep('silver-impregnation').modelEffect;
    assert.ok(imp.includes('R-model-01'), imp);
    assert.ok(imp.includes('reads impregnation.endpoint'), imp);
    assert.ok(imp.includes('applied at the ammoniacal-silver step'), imp);
    for (const stepId of [
      'deparaffinize-rehydrate',
      'water-wash',
      'ammonium-hydroxide-wash',
      'final-wash-dehydrate-clear-mount',
    ])
      assert.equal(lab.explainStep(stepId).modelEffect, 'No modeled effect (no sourced rule)', stepId);
    const devEffect = lab.explainStep('development').modelEffect;
    for (const id of ['R-model-02', 'R-model-03', 'R-model-04', 'R-model-05', 'R-model-06'])
      assert.equal((devEffect.match(new RegExp(id, 'g')) || []).length, 1, id);
    assert.ok(!devEffect.includes('R-model-01') && !devEffect.includes('reads '));
    assert.equal((ex.modelEffect.match(/R-model-01/g) || []).length, 1);
    assert.equal(lab.explainStep('gold-toning').quantities.time, 'unspecified');
    assert.equal(lab.getMethod('nope'), undefined);
    assert.equal(lab.getSpecimen('nope'), undefined);
    assert.equal(lab.getModule('nope'), undefined);
    assert.equal(lab.explainStep('nope'), undefined);
    assert.equal(lab.listModules().length, 7);
    assert.equal(lab.measurementRules().length, 5);
    assert.ok(lab.measurementRules().every(m => ['ordinal', 'count', 'fraction', 'score'].includes(m.unit)));
    const curves = lab.schematicCurves(fullRun(lab, 'c', 'SPEC-SYN-AD-01'));
    assert.equal(curves.basis, 'schematic-analogy');
    assert.deepEqual(curves.rulesApplied, ['R-kinetics-01']);
    const maxRate = Math.max(...curves.points.map(p => p.rate));
    assert.notEqual(curves.points[curves.endpointIndex].rate, maxRate);
    assert.ok(curves.points.every(p => p.binding <= 4 && p.accumulated <= 4 && p.rate <= 4));
    assert.ok(curves.caveats.includes(ENDPOINT_CAVEAT));
    assert.ok(curves.system.startsWith('Schematic shapes only;') && !/^none/.test(curves.system), curves.system);
    for (const h of S.HYPOTHESES) assert.ok(S.HYPOTHESIS_TEXT[h].startsWith('Hypothesis: '), h);
  },
  19: (lab, content) => {
    const clip = lab.getClip();
    assert.ok(clip && Array.isArray(clip.items), 'getClip returns the clip data');
    assert.deepEqual(clip, content.clip);
    assert.ok(Object.isFrozen(clip) && Object.isFrozen(clip.items) && Object.isFrozen(clip.items[0]), 'frozen');
    assert.deepEqual(
      clip.items.map(s => s.id),
      S.CLIP_SCENES
    );
    assert.equal(clip.label, 'A drawing, not a reconstruction of any section');
    for (const key of ['noRunCaption', 'noBasisCaption', 'impregnationNotDone', 'developmentNotDone'])
      assert.ok(typeof clip[key] === 'string' && clip[key].trim(), key);
    assert.ok(clip.noBasisCaption.includes('{explanation}'));
    const structures = clip.items.find(s => s.id === 'structures');
    assert.deepEqual(
      structures.sub.map(s => s.site),
      TARGETS
    );
    for (const sub of structures.sub) assert.equal(sub.title, S.SITE_TEXT[sub.site]);
    const facts = clip.items
      .flatMap(s => [...s.facts, ...s.sub.flatMap(x => x.facts)])
      .concat(Object.values(clip.captionFacts || {}).flat());
    assert.ok(facts.length > 0);
    for (const fact of facts) for (const id of fact.claims) assert.ok(lab.getClaim(id), `claim ${id} exists`);
    for (const scene of clip.items) assert.ok(scene.durationMs >= 4000 && scene.durationMs <= 9000, scene.id);
    // The clip is optional: content without it (or with null) creates a lab whose getClip() is null.
    const without = clone(content);
    delete without.clip;
    assert.deepEqual(S.lint(without), []);
    assert.equal(S.createLab(without).getClip(), null);
    assert.equal(S.createLab({ ...clone(content), clip: null }).getClip(), null);
    for (const code of ['clip-fact-without-claim', 'clip-scene-unknown', 'clip-site-unknown'])
      assert.ok(S.LINT_CODES.includes(code), code);
  },
  20: lab => {
    const input = exportFixture(lab),
      opts = { title: 'Fixed notebook', studentLabel: 'Student' },
      md = lab.exportNotebook(input, opts);
    // Defaults: byte-identical to the stored ENGINE-11 export; a non-function formatter counts as absent.
    assert.equal(md, EXPORT_ENGINE_13);
    const junk = [null, 'x', undefined, 42, { fn: true }];
    assert.equal(
      lab.exportNotebook(input, { ...opts, ...Object.fromEntries(FORMATTERS.map((name, n) => [name, junk[n % 5]])) }),
      md
    );
    // No name given (absent, empty or blank): a line to fill in by hand, nothing else changes.
    const named = md.replace('\n\nStudent\n\n', '\n\nName: ________\n\n');
    assert.notEqual(named, md);
    for (const studentLabel of [undefined, '', '   '])
      assert.equal(lab.exportNotebook(input, { title: 'Fixed notebook', studentLabel }), named, String(studentLabel));
    assert.equal(lab.exportNotebook(input), named.replace('# Fixed notebook', '# Lab notebook'));
    assert.deepEqual(named.split('\n').slice(0, 5), [
      '# Fixed notebook',
      '',
      'Name: ________',
      '',
      S.EXPORT_DISCLAIMER,
    ]);

    // runTitle / paramText / stepTitle where specified, on copies; every other line unchanged.
    const calls = { runTitle: [], paramText: [], stepTitle: [] },
      before = JSON.stringify(input),
      out = lab.exportNotebook(input, {
        ...opts,
        runTitle: run => {
          calls.runTitle.push([run]);
          run.label = 'changed by the formatter';
          return `Your run ${run.id}`;
        },
        paramText: (p, v) => (calls.paramText.push([p, v]), `${p}: ${v}`),
        stepTitle: id => (calls.stepTitle.push([id]), `<${id}>`),
      });
    assert.equal(JSON.stringify(input), before, 'formatters receive copies');
    const a = md.split('\n'),
      b = out.split('\n');
    assert.equal(b.length, a.length);
    const changed = b.filter((line, i) => line !== a[i]);
    // 5 run headings + 5 run field lines (the missing run keeps 'Run gone') + 2 simulated entry lines
    // + 3 settings lines + 2 set-params events + 43 step events (two with a step-level setting; the w
    // run skips toning and thiosulfate) + 2 deviations lines (the ext run is printed in two experiments)
    assert.equal(changed.length, 62);
    for (const line of changed)
      assert.match(
        line,
        /^(#### Your run |- (Baseline run \(standard\)|Experimental run \(with your change\)): Your run | {2}Your run |- Settings changed from standard: |1\. Changed setting: |\d+\. <|- Deviations: out-of-order <)/
      );
    assert.deepEqual(
      b.filter(l => l.startsWith('#### ')),
      [
        '#### Your run base',
        '#### Your run ext',
        '#### Your run w',
        '#### Run gone',
        '#### Your run base',
        '#### Your run ext',
      ]
    );
    assert.ok(b.includes(`  Your run ext, label: ${S.LABEL_TEXT['illustrative-synthetic']}`));
    assert.ok(b.includes(`  Your run w, label: ${S.LABEL_TEXT['no-basis']}`));
    assert.ok(b.includes('- Experimental run (with your change): Run gone'));
    // Asked once per experiment and run: the heading and the run's field line share the name.
    assert.deepEqual(
      calls.runTitle.map(([run]) => run.id),
      ['ext', 'w', 'base', 'ext', 'w', 'base', 'ext']
    );
    assert.deepEqual(calls.runTitle[2][0], { ...input.runsById.base, label: 'changed by the formatter' });
    for (const line of [
      '- Settings: all standard (per procedure)',
      '- Settings changed from standard: development.endpoint: extended; development.strength: strong',
      '- Settings changed from standard: washes.condition: deviated',
      '- Toning and thiosulfate: performed (the stain turns from brown-black to gray-black; silver that was never reduced is removed, so the slide stops changing)',
      '- Gold toning: skipped (the stain stays brown-black)',
      '- Thiosulfate: skipped (silver that was never reduced stays in the section, so the slide will keep changing)',
      '1. Changed setting: development.endpoint: extended; thiosulfate: true',
      '2. Note: Started late.',
      '4. <water-wash>',
      '8. <development> (changed setting: development.strength: strong)',
      '- Deviations: out-of-order <water-wash> (expected before: <silver-impregnation>)',
    ])
      assert.ok(b.includes(line), line);
    // Toning and thiosulfate are on their own engine-worded line, never in the changed settings.
    const extParams = [
      ['development.endpoint', 'extended'],
      ['development.strength', 'strong'],
      ['development.endpoint', 'extended'],
      ['thiosulfate', true],
      ['development.strength', 'strong'],
    ];
    assert.deepEqual(calls.paramText, [...extParams, ['washes.condition', 'deviated'], ...extParams]);
    assert.ok(calls.stepTitle.every(([id]) => S.STEPS.includes(id)));

    // The reserved label: never handed to a formatter, never printed from one. A formatter that
    // throws, returns a blank, a non-string, two lines, the reserved label (id or words, any case)
    // or 'result' without 'simulated' leaves every default line in place (all eight formatters).
    const reserved = [S.LABELS.VALIDATED, S.LABEL_TEXT[S.LABELS.VALIDATED]].map(x => x.toLowerCase());
    for (const x of reserved) {
      assert.ok(!JSON.stringify(calls).toLowerCase().includes(x), x);
      assert.ok(!md.toLowerCase().includes(x), x);
    }
    const rejected = [
      S.LABELS.VALIDATED,
      `Run 1 (${S.LABEL_TEXT[S.LABELS.VALIDATED].toUpperCase()})`,
      'two\n- [Simulated: illustrative, not a measurement] lines',
      'one\rline',
      undefined,
      42,
      '',
      '   ',
      'The result',
      'Results',
    ];
    const every = fn => Object.fromEntries(FORMATTERS.map(name => [name, fn]));
    for (const text of rejected)
      assert.equal(lab.exportNotebook(input, { ...opts, ...every(() => text) }), md, String(text));
    const thrower = () => {
      throw new Error('broken formatter');
    };
    assert.equal(lab.exportNotebook(input, { ...opts, ...every(thrower) }), md, 'a throwing formatter');
    const tainted = clone(input),
      got = [];
    tainted.runsById.base.label = S.LABELS.VALIDATED;
    lab.exportNotebook(tainted, { ...opts, runTitle: run => (got.push(run.id), run.id) });
    assert.ok(got.length && !got.includes('base'), 'a run naming the reserved label never reaches runTitle');

    // Test 13's mechanical 'result' check still passes with formatters on.
    resultCheck(out);
    const worded = lab.exportNotebook(input, {
      ...opts,
      runTitle: run => `The ${run.id} result`,
      paramText: () => 'Results',
      stepTitle: id => `${id} (simulated result)`,
    });
    resultCheck(worded);
    assert.ok(worded.includes(`\n  Run ext, label: ${S.LABEL_TEXT['illustrative-synthetic']}\n`));
    assert.ok(!worded.includes('#### The ') && !worded.includes('Results'));
    assert.ok(worded.includes('\n4. water-wash (simulated result)\n'));
  },
  21: lab => {
    const input = exportFixture(lab),
      opts = { title: 'Fixed notebook', studentLabel: 'Student' },
      md = lab.exportNotebook(input, opts),
      runs = input.runsById;

    // Default layout: predictions, limits and interpretation one "- Field:" item per answer, blanks
    // 'not written' (the done experiment's Model readout sits between its limits and interpretation).
    const designTail = (text, title) => {
      const block = text.split(`### ${title}\n\n`)[1].split('\n\n')[0].split('\n');
      return block.slice(block.findIndex(l => l.startsWith('- Expected outcome: ')));
    };
    assert.deepEqual(designTail(md, 'Development endpoint'), [
      '- Expected outcome: e',
      '- Negligible change: not written',
      '- Opposite outcome: o',
      '- Limits of your design: l',
      '- Interpretation: not written',
    ]);
    assert.deepEqual(designTail(md, 'Washes'), [
      '- Expected outcome: e',
      '- Negligible change: n',
      '- Opposite outcome: o',
      '- Limits of your design: l',
      '- What it supports: s',
      '- What it fails to establish: not written',
      '- Next experiment: x',
    ]);
    const bare = {
      ...input.experiments[0],
      predictions: undefined,
      interpretation: { supports: '', failsToEstablish: null, next: '  ' },
    };
    assert.deepEqual(designTail(lab.exportNotebook({ ...input, experiments: [bare] }, opts), 'Development endpoint'), [
      '- Expected outcome: not written',
      '- Negligible change: not written',
      '- Opposite outcome: not written',
      '- Limits of your design: l',
      '- What it supports: not written',
      '- What it fails to establish: not written',
      '- Next experiment: not written',
    ]);
    // Without outcomeText no run block has a Summary and Model detail holds only Model sources.
    assert.ok(!/^- (Predictions|Effective params|Summary):/m.test(md));
    assert.deepEqual(
      md
        .split(DETAIL_HEADING)[1]
        .split('\n')
        .filter(l => l.startsWith('### ')),
      ['### Model sources']
    );
    // Each run block: specimen, method, the settings line, the toning / thiosulfate record line (or,
    // ENGINE-14, one not-modeled line per skipped step), then the numbered events (steps by name,
    // set-params as 'Changed setting', notes as 'Note') as a list of their own.
    const runBlocks = md.split('\n#### ').slice(1, 4);
    assert.deepEqual(
      runBlocks.map(block => block.split('\n').slice(2, 7)),
      [
        [
          '- Specimen: SPEC-SYN-AD-01',
          '- Method: bielschowsky-modified',
          '- Settings: all standard (per procedure)',
          '- Toning and thiosulfate: performed (the stain turns from brown-black to gray-black; silver that was never reduced is removed, so the slide stops changing)',
          '- Events:',
        ],
        [
          '- Specimen: SPEC-SYN-AD-01',
          '- Method: bielschowsky-modified',
          '- Settings changed from standard: development.endpoint=extended; development.strength=strong',
          '- Toning and thiosulfate: performed (the stain turns from brown-black to gray-black; silver that was never reduced is removed, so the slide stops changing)',
          '- Events:',
        ],
        [
          '- Specimen: SPEC-SYN-AD-01',
          '- Method: bielschowsky-modified',
          '- Settings changed from standard: washes.condition=deviated',
          '- Gold toning: skipped (the stain stays brown-black)',
          '- Thiosulfate: skipped (silver that was never reduced stays in the section, so the slide will keep changing)',
        ],
      ]
    );
    const events = block => {
      const lines = block.split('\n'),
        at = lines.indexOf('- Events:');
      assert.equal(lines[at + 1], '', 'a blank line before the events');
      const end = lines.indexOf('', at + 2);
      assert.match(lines[end + 1], /^- Deviations: /, 'a blank line after the events');
      return lines.slice(at + 2, end);
    };
    assert.deepEqual(
      events(runBlocks[0]),
      S.STEPS.map((id, n) => `${n + 1}. ${id}`)
    );
    assert.deepEqual(events(runBlocks[1]).slice(0, 4), [
      '1. Changed setting: development.endpoint=extended; thiosulfate=true',
      '2. Note: Started late.',
      '3. deparaffinize-rehydrate',
      '4. water-wash',
    ]);
    assert.ok(events(runBlocks[1]).includes('8. development (changed setting: development.strength=strong)'));
    const empty = { ...input, experiments: [{ ...input.experiments[0], experimentalRunId: 'fresh' }] };
    empty.runsById = { ...runs, fresh: lab.createRun({ id: 'fresh', specimenId: 'SPEC-SYN-AD-01' }) };
    assert.ok(lab.exportNotebook(empty, opts).includes('\n- Events: none\n- Deviations: none\n'));
    empty.runsById.fresh = lab.applyEvent(empty.runsById.fresh, { seq: 1, type: 'note', text: '  ' });
    assert.ok(lab.exportNotebook(empty, opts).includes('\n- Events:\n\n1. Note: not written\n\n- Deviations: none\n'));

    // The five ENGINE-11 formatters, each only where specified, on copies.
    const calls = { specimenTitle: [], methodTitle: [], controlText: [], strengthText: [], outcomeText: [] },
      before = JSON.stringify(input),
      out = lab.exportNotebook(input, {
        ...opts,
        specimenTitle: id => (calls.specimenTitle.push(id), `Practice specimen ${id}`),
        methodTitle: id => (calls.methodTitle.push(id), `Procedure method ${id}`),
        controlText: c => (calls.controlText.push(c.type), `${c.type} comparison`),
        strengthText: s => (calls.strengthText.push(s), `${s} claim`),
        outcomeText: o => {
          calls.outcomeText.push(o.label);
          o.label = 'changed by the formatter';
          return `In plain words: ${calls.outcomeText.length}`;
        },
      });
    assert.equal(JSON.stringify(input), before, 'formatters receive copies');
    // Everything before Model detail lines up with the default export.
    const a = md.split(DETAIL_HEADING)[0].split('\n'),
      b = out.split(DETAIL_HEADING)[0].split('\n');
    assert.equal(b.length, a.length);
    const changed = a.map((line, i) => [line, b[i]]).filter(([x, y]) => x !== y);
    // the published entry's claim line + 5 Specimen + 5 Method + 3 Controls + 5 Summary + the Sources
    // item's claim line
    assert.equal(changed.length, 20);
    for (const [, line] of changed)
      assert.match(
        line,
        /^(- Specimen: Practice specimen |- Method: Procedure method |- Controls: |- Summary: In plain words: | {2}".*" \([a-z-]+ claim\)\. Source: | {2}- Cited for: ".*" \([a-z-]+ claim\)$)/
      );
    assert.deepEqual(calls.specimenTitle, Array(5).fill('SPEC-SYN-AD-01'));
    assert.deepEqual(calls.methodTitle, Array(5).fill('bielschowsky-modified'));
    assert.deepEqual(calls.controlText, [
      'characterized-positive',
      'characterized-positive',
      'baseline-process',
      'negative-biological',
      'baseline-process',
    ]);
    // ENGINE-13: the stand-in note after each specimen-based control, never after a baseline process.
    assert.deepEqual(
      b.filter(l => l.startsWith('- Controls: ')),
      [
        `- Controls: characterized-positive comparison ${S.STAND_IN_SUFFIX}`,
        `- Controls: characterized-positive comparison ${S.STAND_IN_SUFFIX}; baseline-process comparison`,
        `- Controls: negative-biological comparison ${S.STAND_IN_SUFFIX}; baseline-process comparison`,
      ]
    );
    // strengthText words the student part only (the entry's claim line and its Sources item); Model
    // sources keeps every strength code.
    assert.deepEqual(calls.strengthText, ['published-qualitative', 'published-qualitative']);
    const sources = text => text.split('\n### Model sources\n\n')[1].split('\n\n')[0];
    assert.equal(sources(out), sources(md));
    // outcomeText: a "- Summary:" item in place of "- Description:" in each run block (the label line
    // stays), then Model detail keeps every summarized run's label and full description, once per run,
    // before Model sources.
    assert.deepEqual(calls.outcomeText, [
      'illustrative-synthetic',
      'illustrative-synthetic',
      'no-basis',
      'illustrative-synthetic',
      'illustrative-synthetic',
    ]);
    assert.deepEqual(b.filter(l => /^- (Label|Summary|Description): /.test(l)).slice(0, 6), [
      `- Label: ${S.LABEL_TEXT['illustrative-synthetic']}`,
      '- Summary: In plain words: 1',
      `- Label: ${S.LABEL_TEXT['illustrative-synthetic']}`,
      '- Summary: In plain words: 2',
      `- Label: ${S.LABEL_TEXT['no-basis']}`,
      '- Summary: In plain words: 3',
    ]);
    const headings = out
      .split('\n')
      .filter(l => l.startsWith('## '))
      .map(l => l.slice(3));
    assert.deepEqual(headings, [
      ...S.SECTIONS.map(s => S.SECTION_TEXT[s]),
      'Experiment log',
      'Sources',
      'Model detail (for instructors)',
    ]);
    const detail = (id, heading) => {
      const resolved = lab.resolve(runs[id]);
      return [
        `### ${heading}`,
        '',
        `- Label: ${S.LABEL_TEXT[resolved.label]}`,
        `- Description: ${lab.describeOutcome(resolved, lab.getSpecimen(runs[id].specimenId))}`,
        '',
      ];
    };
    const mdTail = md.split(DETAIL_HEADING)[1].split('\n');
    assert.deepEqual(out.split(DETAIL_HEADING)[1].split('\n'), [
      '',
      ...detail('base', 'Run base (Baseline)'),
      ...detail('ext', 'Run ext'),
      ...detail('w', 'Run w'),
      ...mdTail.slice(1),
    ]);
    // Nothing is lost: every default Description line is in Model detail, word for word.
    for (const line of md.split('\n').filter(l => l.startsWith('- Description: ')))
      assert.ok(out.split(DETAIL_HEADING)[1].split('\n').includes(line));
    // Model detail names runs with runTitle; a run in two experiments is listed once; a run whose
    // summary falls back keeps its Description in place and is not repeated there.
    const runHeadings = text =>
      text
        .split(DETAIL_HEADING)[1]
        .split('\n')
        .filter(l => l.startsWith('### '));
    const twice = lab.exportNotebook(
      { ...input, experiments: [input.experiments[0], { ...input.experiments[0], id: 'exp-4', title: 'Again' }] },
      { ...opts, runTitle: run => `Named ${run.id}`, outcomeText: o => (o.label === 'no-basis' ? null : 'Short.') }
    );
    assert.deepEqual(runHeadings(twice), ['### Named base', '### Named ext', '### Model sources']);
    assert.equal(twice.split('\n').filter(l => l === '- Summary: Short.').length, 4);
    const partial = lab.exportNotebook(input, { ...opts, outcomeText: o => (o.label === 'no-basis' ? '' : 'Short.') });
    assert.ok(
      partial.includes(`- Label: ${S.LABEL_TEXT['no-basis']}\n- Description: No basis for a simulated result.`)
    );
    assert.deepEqual(runHeadings(partial), ['### Run base (Baseline)', '### Run ext', '### Model sources']);

    // controlText: an item whose text fails (or carries the note itself) prints the type and what it
    // addresses; the note follows exactly the specimen-based controls whatever the formatter says; a
    // control whose words name the reserved label never reaches the formatter.
    const mixed = lab.exportNotebook(input, {
      ...opts,
      controlText: c => (c.type === 'baseline-process' ? `Baseline ${S.STAND_IN_SUFFIX}` : 'Positive'),
    });
    assert.deepEqual(
      mixed.split('\n').filter(l => l.startsWith('- Controls: ')),
      [
        `- Controls: Positive ${S.STAND_IN_SUFFIX}`,
        `- Controls: Positive ${S.STAND_IN_SUFFIX}; baseline-process`,
        `- Controls: Positive ${S.STAND_IN_SUFFIX}; baseline-process, addresses: drift between runs`,
      ]
    );
    const half = lab.exportNotebook(input, {
      ...opts,
      controlText: c => (c.type === 'baseline-process' ? 'Baseline' : undefined),
    });
    assert.deepEqual(
      half.split('\n').filter(l => l.startsWith('- Controls: ')),
      [
        `- Controls: characterized-positive ${S.STAND_IN_SUFFIX}, addresses: that the stain worked at all`,
        `- Controls: characterized-positive ${S.STAND_IN_SUFFIX}, addresses: that the stain worked at all; Baseline`,
        `- Controls: negative-biological ${S.STAND_IN_SUFFIX}, addresses: lesion-free staining; Baseline`,
      ]
    );
    const specimenBased = input.experiments.map(
      e => e.controls.filter(c => ['characterized-positive', 'negative-biological'].includes(c.type)).length
    );
    for (const text of [md, mixed, half])
      assert.deepEqual(
        text
          .split('\n')
          .filter(l => l.startsWith('- Controls: '))
          .map(l => l.split(S.STAND_IN_SUFFIX).length - 1),
        specimenBased
      );
    const seen = [],
      flagged = clone(input);
    flagged.experiments[1].controls[1].addresses = `not a ${S.LABEL_TEXT[S.LABELS.VALIDATED]}`;
    lab.exportNotebook(flagged, { ...opts, controlText: c => (seen.push(c.type), 'Control') });
    assert.deepEqual(seen, [
      'characterized-positive',
      'characterized-positive',
      'negative-biological',
      'baseline-process',
    ]);

    // The reserved label is never emitted, and test 13's result check passes with all eight on.
    const all = lab.exportNotebook(input, {
      ...opts,
      runTitle: run => `Run ${run.id}`,
      paramText: (p, v) => `${p} is ${v}`,
      stepTitle: id => `Step ${id}`,
      specimenTitle: () => 'Practice specimen',
      methodTitle: () => 'Procedure method',
      controlText: c => `${c.type} (simulated result)`,
      strengthText: () => 'claim',
      outcomeText: () => 'The simulated result in plain words.',
    });
    for (const text of [md, out, all]) {
      resultCheck(text);
      for (const x of [S.LABELS.VALIDATED, S.LABEL_TEXT[S.LABELS.VALIDATED]])
        assert.ok(!text.toLowerCase().includes(x.toLowerCase()), x);
      assert.ok(text.includes(S.EXPORT_DISCLAIMER));
    }
    assert.ok(all.includes('- Summary: The simulated result in plain words.'));
  },
  22: lab => {
    const input = exportFixture(lab),
      opts = { title: 'Fixed notebook', studentLabel: 'Student', outcomeText: () => 'Short.' },
      md = lab.exportNotebook(input, opts),
      runs = input.runsById;
    // ENGINE-12 (UX-POLISH-verify-1): only a strict true seals; absent, not a function, any other
    // value or a throw leaves the export byte-identical.
    const thrower = () => {
      throw new Error('broken');
    };
    for (const isSealed of [undefined, null, 'yes', true, () => false, () => 1, () => 'true', thrower])
      assert.equal(lab.exportNotebook(input, { ...opts, isSealed }), md, String(isSealed));
    const seen = [],
      before = JSON.stringify(input),
      out = lab.exportNotebook(input, {
        ...opts,
        isSealed: run => {
          seen.push(run.id);
          run.events = [];
          return run.id === 'ext';
        },
      });
    assert.equal(JSON.stringify(input), before, 'isSealed receives copies');
    // ENGINE-13: asked once per run, at its first use (the simulated entries come first); a missing run
    // is never passed.
    assert.deepEqual(seen, ['ext', 'w', 'base'], 'asked once per run');
    // A run block: from its heading up to the next heading.
    const block = (text, heading, nth = 0) => {
      const lines = text.split('\n'),
        at = lines.reduce((found, l, i) => (l === `#### ${heading}` ? [...found, i] : found), [])[nth];
      return lines.slice(
        at,
        lines.findIndex((l, i) => i > at && /^#{2,4} /.test(l))
      );
    };
    // The sealed run keeps its process lines (specimen, method, settings, events, deviations) and
    // prints one line after them, set apart by a blank line, in place of Label, Summary / Description
    // and Measurements, in both experiments that print it.
    for (const nth of [0, 1]) {
      const sealed = block(out, 'Run ext', nth),
        open = block(md, 'Run ext', nth),
        cut = open.findIndex(l => l.startsWith('- Label: '));
      assert.deepEqual(sealed, [...open.slice(0, cut), '', 'Sealed until this experiment is revealed.', '']);
      assert.ok(
        open.some(l => l.startsWith('  - [Simulated: illustrative, not a measurement] ')),
        'a measurement'
      );
      assert.ok(!sealed.some(l => /^- (Label|Summary|Description|Measurements):/.test(l) || l.startsWith('  - ')));
    }
    // Other runs are unchanged; the sealed run is not in Model detail; the simulated entry about it
    // prints the sealed line in place of its label line (ENGINE-13); the other entry keeps its own.
    assert.deepEqual(block(out, 'Run base (Baseline)'), block(md, 'Run base (Baseline)'));
    const detail = text =>
      text
        .split(DETAIL_HEADING)[1]
        .split('\n')
        .filter(l => l.startsWith('### '));
    assert.deepEqual(detail(md), ['### Run base (Baseline)', '### Run ext', '### Run w', '### Model sources']);
    assert.deepEqual(detail(out), ['### Run base (Baseline)', '### Run w', '### Model sources']);
    assert.ok(
      out.includes(
        '\n- [Simulated: illustrative, not a measurement] The simulated field is darker.\n  Sealed until this experiment is revealed.\n'
      )
    );
    assert.ok(!out.includes('Run ext, label: '));
    assert.ok(out.includes(`\n  Run w, label: ${S.LABEL_TEXT['no-basis']}\n`));
    // The done experiment shows no Model readout while one of its runs is sealed.
    assert.equal(md.split('\n').filter(l => l.startsWith('- Model readout (simulated): ')).length, 1);
    assert.ok(!out.includes('Model readout'));
    // Model sources drop the claims only the sealed run brought; every other claim stays.
    const index = text =>
      text
        .split('\n### Model sources\n\n')[1]
        .split('\n\n')[0]
        .split('\n')
        .filter(Boolean)
        .map(l => /^- ([^:]+):/.exec(l)[1]);
    const own = id => {
      const o = lab.resolve(runs[id]);
      return [...(o.claims || []), ...(o.rulesConsulted || []).flatMap(r => (lab.getRule(r) || {}).claims || [])];
    };
    const kept = new Set(['C-litchfield-2001-temp', ...own('base'), ...own('w')]);
    assert.deepEqual(
      index(out),
      index(md).filter(id => kept.has(id))
    );
    assert.ok(
      index(md).some(id => !kept.has(id)),
      'the fixture has a claim only the sealed run brings'
    );
    // Disclaimer, tags, labels of the other runs, the Markdown check and test 13's check hold.
    resultCheck(out);
    markdownCheck(out);
    assert.ok(out.includes(S.EXPORT_DISCLAIMER));
    assert.equal(out.split('\n').filter(l => l.startsWith('- Label: ')).length, 5);
    assert.equal(md.split('\n').filter(l => l.startsWith('- Label: ')).length, 8);
    // A run carrying the reserved label is never handed to isSealed.
    const tainted = clone(input),
      asked = [];
    tainted.runsById.base.label = S.LABELS.VALIDATED;
    lab.exportNotebook(tainted, { ...opts, isSealed: run => (asked.push(run.id), false) });
    assert.ok(!asked.includes('base') && asked.length, String(asked));
  },
  23: lab => {
    const input = exportFixture(lab),
      opts = { title: 'Fixed notebook', studentLabel: 'Student' },
      md = lab.exportNotebook(input, opts),
      runs = input.runsById;
    // Words like the notebook's (no parentheses, no ids), for the formatter-on checks.
    const words = {
      runTitle: run => `Run ${run.id.length}`,
      paramText: p => `Setting ${p.split('.').length}`,
      stepTitle: () => 'A step',
      specimenTitle: () => 'Practice specimen A (not real tissue)',
      methodTitle: () => 'Procedure method',
      controlText: c => (c.type === 'baseline-process' ? 'Baseline process comparison' : 'A specimen control'),
      strengthText: s => (s === 'published-qualitative' ? 'published, qualitative' : 'other words'),
      outcomeText: () => 'Short.',
    };
    const worded = lab.exportNotebook(input, { ...opts, ...words });

    // Markdown: every experiment and run field is a "- Field:" item in a list with a blank line on
    // each side; the events are a numbered list of their own; no field line follows a list directly.
    // 16 + 18 + 20 experiment fields (two interpretations written; the third experiment's main
    // variable and readout) + 9 fields in each of the 5 run blocks + 1 (ENGINE-14: the w run's two
    // skipped steps take two lines where the toning / thiosulfate record took one)
    assert.equal(markdownCheck(md), 16 + 18 + 20 + 5 * 9 + 1);
    for (const text of [worded, lab.exportNotebook({ ...input, experiments: [] }, opts)]) markdownCheck(text);
    assert.ok(md.includes('\n- Events:\n\n1. deparaffinize-rehydrate\n'));
    assert.ok(md.includes('\n9. final-wash-dehydrate-clear-mount\n\n- Deviations: none\n'));

    // Ids and strength codes: none before Model detail (formatters or not); Model sources lists every
    // claim with its id, strength code and source ids.
    for (const text of [md, worded]) {
      const student = studentPartClean(text),
        model = text.split('\n### Model sources\n\n')[1];
      for (const entry of input.notebook.entries.filter(e => e.type === 'published')) {
        const claim = lab.getClaim(entry.claimId);
        assert.ok(model.includes(`- ${claim.id}: "${claim.text}" (${claim.strength}). Sources: `), claim.id);
        for (const id of claim.sources) assert.ok(model.includes(`${id} ${lab.getSource(id).citation}`), id);
        assert.ok(student.includes(`"${claim.text}"`), 'the claim text stays with the entry');
      }
      assert.match(model, ID_PATTERN);
      assert.match(model, CODE_PATTERN);
    }
    // The published entry: claim text, strength words, citation and url; no id.
    const claim = lab.getClaim('C-litchfield-2001-temp'),
      source = lab.getSource(claim.sources[0]),
      cite = `${source.citation} <${source.url}>`;
    assert.ok(
      md.includes(`- [Published] Temperature matters.\n  "${claim.text}" (published, qualitative). Source: ${cite}\n`)
    );
    assert.equal(S.STRENGTH_TEXT['published-qualitative'], 'published, qualitative');
    for (const s of S.BASIS) assert.doesNotMatch(S.STRENGTH_TEXT[s], /[()]|-/, s);
    assert.ok(worded.includes(`  "${claim.text}" (published, qualitative). Source: ${cite}\n`));
    // Sources: only the claims the student cited, once each, citation and url first, then the claim
    // text and its strength words; the model's claims are not there.
    const sourcesOf = text => text.split('\n## Sources\n\n')[1].split('\n\n')[0].split('\n');
    assert.deepEqual(sourcesOf(md), [`- ${cite}`, `  - Cited for: "${claim.text}" (published, qualitative)`]);
    const again = lab.addEntry(input.notebook, {
      id: 'e6',
      type: 'published',
      section: 'next-steps',
      text: 'Temperature again.',
      claimId: 'C-litchfield-2001-temp',
    });
    assert.deepEqual(sourcesOf(lab.exportNotebook({ ...input, notebook: again }, opts)), sourcesOf(md));
    assert.ok(!sourcesOf(md).join('\n').includes(lab.getClaim('C-peters-1955-nuclei').text));
    assert.ok(md.split(DETAIL_HEADING)[1].includes('C-peters-1955-nuclei: '));
    const none = { ...input, notebook: { v: 1, entries: input.notebook.entries.filter(e => e.type !== 'published') } };
    assert.deepEqual(sourcesOf(lab.exportNotebook(none, opts)), ['(no sources cited)']);
    assert.deepEqual(
      lab
        .exportNotebook({ notebook: lab.newNotebook() }, opts)
        .split('\n')
        .filter(l => l.startsWith('## '))
        .slice(-2),
      ['## Experiment log', '## Sources'],
      'no claim and no summarized run: no Model detail'
    );

    // The main variable: omitted when it equals "What you change", printed when it differs.
    const fieldsOf = (text, title) => text.split(`### ${title}\n\n`)[1].split('\n\n')[0].split('\n');
    const mainLine = (text, title) => fieldsOf(text, title).filter(l => l.startsWith('- Main variable'));
    assert.deepEqual(mainLine(md, 'Development endpoint'), []);
    assert.deepEqual(mainLine(md, 'Developer strength'), ['- Main variable (the one you test): Developer strength']);
    const variants = [
      [{ changed: [], independentVariable: 'Development time' }, '- What you change: Development time', []],
      [{ changed: [' '], independentVariable: '' }, '- What you change: not written', []],
      [
        { changed: ['development.endpoint'], independentVariable: ' ' },
        '- What you change: development.endpoint',
        ['- Main variable (the one you test): not written'],
      ],
    ];
    for (const [patch, change, main] of variants) {
      const text = lab.exportNotebook({ ...input, experiments: [{ ...input.experiments[0], ...patch }] }, opts);
      assert.ok(fieldsOf(text, 'Development endpoint').includes(change), change);
      assert.deepEqual(mainLine(text, 'Development endpoint'), main, JSON.stringify(patch));
    }
    // Controls: the stand-in note follows each specimen-based control and never the baseline process.
    assert.deepEqual(
      md.split('\n').filter(l => l.startsWith('- Controls: ')),
      [
        `- Controls: characterized-positive ${S.STAND_IN_SUFFIX}, addresses: that the stain worked at all`,
        `- Controls: characterized-positive ${S.STAND_IN_SUFFIX}, addresses: that the stain worked at all; baseline-process`,
        `- Controls: negative-biological ${S.STAND_IN_SUFFIX}, addresses: lesion-free staining; baseline-process, addresses: drift between runs`,
      ]
    );
    // The run fields name each experiment's two runs as the headings do.
    assert.deepEqual(fieldsOf(md, 'Washes').slice(9, 11), [
      '- Baseline run (standard): Run w',
      '- Experimental run (with your change): Run gone',
    ]);
    const unchosen = lab.exportNotebook(
      { ...input, experiments: [{ ...input.experiments[0], experimentalRunId: '' }] },
      opts
    );
    assert.ok(fieldsOf(unchosen, 'Development endpoint').includes('- Experimental run (with your change): not chosen'));

    // Model readout (simulated): only for a revealed (or done) experiment whose two runs exist and are
    // not sealed, one line per automatic measure it chose, in model-scale words and no digit.
    const readouts = text => text.split('\n').filter(l => l.startsWith('- Model readout (simulated): '));
    assert.deepEqual(readouts(md), [
      '- Model readout (simulated): Target/background contrast: low in the baseline, trace in the experimental run (down one step on the model scale)',
    ]);
    assert.ok(fieldsOf(md, 'Developer strength').indexOf(readouts(md)[0]) === 16, 'after the limits');
    const readout = (baseline, experimental, patch = {}) =>
      readouts(
        lab.exportNotebook(
          {
            ...input,
            runsById: { ...runs, ...baseline, ...experimental },
            experiments: [
              {
                ...input.experiments[2],
                baselineRunId: Object.keys(baseline)[0],
                experimentalRunId: Object.keys(experimental)[0],
                ...patch,
              },
            ],
          },
          opts
        )
      );
    const same = { same: fullRun(lab, 'same', 'SPEC-SYN-AD-01') };
    const line = text => [`- Model readout (simulated): Target/background contrast: ${text}`];
    assert.deepEqual(readout({ base: runs.base }, same), line('low in both runs (no change on the model scale)'));
    assert.deepEqual(readout({ base: runs.base }, same, { status: 'revealed' }), readout({ base: runs.base }, same));
    assert.deepEqual(readout({ base: runs.base }, same, { status: 'draft' }), []);
    assert.deepEqual(readout({ base: runs.base }, same, { measures: ['roi-lesion-count'] }), []);
    assert.deepEqual(readout({ base: runs.base }, same, { measures: [] }), []);
    assert.deepEqual(
      readout({ base: runs.base }, same, { measures: ['contrast-ordinal', 'contrast-ordinal'] }),
      line('low in both runs (no change on the model scale)')
    );
    assert.deepEqual(readout({ base: runs.base }, { gone: undefined }), []);
    assert.deepEqual(
      readout({ base: runs.base }, { w: runs.w }),
      line('no model value, because the experimental run is not modeled')
    );
    const half = {
      half: perform(lab, lab.createRun({ id: 'half', specimenId: 'SPEC-SYN-AD-01' }), S.STEPS.slice(0, 4)),
    };
    assert.deepEqual(
      readout(half, { w: runs.w }),
      line('no model value, because the baseline run is not finished and the experimental run is not modeled')
    );
    const cps = { cps: lab.createRun({ id: 'cps', specimenId: 'SPEC-SYN-AD-01', method: 'cps-i' }) };
    assert.deepEqual(
      readout({ base: runs.base }, cps),
      line('low in the baseline, high in the experimental run (different methods, not compared on the model scale)')
    );
    const weak = { weak: fullRun(lab, 'weak', 'SPEC-SYN-AD-01', { development: { strength: 'weak' } }) };
    assert.deepEqual(
      readout(weak, { base: runs.base }),
      line('trace in the baseline, low in the experimental run (up one step on the model scale)')
    );
    for (const text of [md, worded]) for (const l of readouts(text)) assert.doesNotMatch(l, /\d/, l);
    for (const l of readouts(md)) assert.doesNotMatch(l, /\bresults?\b/i, l);
  },
  // ENGINE-14 + MODE-engine-1: toning / thiosulfate false skips that step. It is not required and not
  // expected before a later step; performing it anyway records 'not-planned' (never out-of-order or
  // repeated). R-model-10 reads the false flag, so the run resolves to an Outcome with the course
  // procedure's caveat (tone silver / the unfixed flag), never to a card; a content without
  // R-model-10 still gives ENGINE-14's 'param-uncovered' card.
  24: (lab, content) => {
    assert.deepEqual(S.lint(content), []);
    assert.deepEqual(S.DEVIATION_KINDS, ['out-of-order', 'repeated', 'skipped', 'not-runnable', 'not-planned']);
    assert.ok(Object.isFrozen(S.DEVIATION_KINDS));
    const SKIP = {
      toning: {
        step: 'gold-toning',
        caveat: 'No gold toning: the stain stays brown-black.',
        explanation: 'No sourced rule covers skipping gold toning, so the model cannot say what that changes.',
        needed:
          'a sourced rule for what gold toning does in this protocol (the course procedure gives the step, not its effect on the picture)',
      },
      thiosulfate: {
        step: 'sodium-thiosulfate',
        caveat:
          'No thiosulfate: silver that was never reduced stays in the section, so the slide will keep changing (course procedure).',
        explanation: 'No sourced rule covers skipping sodium thiosulfate, so the model cannot say what that changes.',
        needed:
          'a sourced rule for what sodium thiosulfate does in this protocol (the course procedure gives the step, not its effect on the picture)',
      },
    };
    const without = (...steps) => S.STEPS.filter(s => !steps.includes(s));
    const run = (id, params, steps = S.STEPS) =>
      perform(lab, lab.createRun({ id, specimenId: 'SPEC-SYN-AD-01', params }), steps);
    const same = (a, b) => assert.deepEqual({ ...a, runId: b.runId }, b);

    // True (the default, or set explicitly): the standard outcome, toned and fixed, no record-only caveat.
    const standard = lab.resolve(run('std', {}));
    assert.equal(standard.label, 'illustrative-synthetic');
    assert.deepEqual(lab.resolve(run('std', { toning: true, thiosulfate: true })), standard);
    assert.ok(!standard.caveats.some(c => /no modeled effect|record only/i.test(c)));
    assert.deepEqual(standard.deviations, []);
    assert.equal(standard.tone, 'gold');
    assert.deepEqual(standard.slide, { wax: false, coverslipped: true, fixed: true, toned: true, unfixed: false });
    assert.ok(!standard.rulesApplied.includes('R-model-10'));

    for (const [flag, x] of Object.entries(SKIP)) {
      const other = SKIP[flag === 'toning' ? 'thiosulfate' : 'toning'];
      const missing = lab.resolve(run(`missing-${flag}`, { [flag]: true }, without(x.step)));
      assert.equal(missing.code, 'step-skipped', flag);
      assert.deepEqual(missing.outsideSupport, [x.step]);

      // Skipped as planned: no step missing, no deviation, an Outcome with the procedure's caveat.
      const skipped = run(`skip-${flag}`, { [flag]: false }, without(x.step));
      assert.deepEqual(skipped.deviations, [], flag);
      const out = lab.resolve(skipped);
      assert.equal(out.label, 'illustrative-synthetic', flag);
      assert.ok(out.rulesApplied.includes('R-model-10'));
      assert.equal(count(out.caveats, x.caveat), 1, flag);
      assert.ok(!out.caveats.includes(other.caveat), flag);
      assert.deepEqual(out.perSite, standard.perSite, 'the picture is the same; the flag changes tone or fixing');
      if (flag === 'toning') {
        assert.equal(out.tone, 'silver');
        assert.deepEqual(out.slide, { ...standard.slide, toned: false });
        assert.equal(out.look.key, 'black-on-tan');
      } else {
        assert.equal(out.tone, 'gold');
        assert.deepEqual(out.slide, { ...standard.slide, fixed: false, unfixed: true });
        for (const site of TARGETS) assert.ok(out.state[site].ionicBound > 0, `${site}: unreduced silver still in it`);
        assert.equal(out.look.key, 'gray-black');
      }
      assert.ok(lab.describeOutcome(out).includes(x.caveat));

      // Set by a 'set-params' event before the steps: the same outcome.
      let mid = lab.createRun({ id: `mid-${flag}`, specimenId: 'SPEC-SYN-AD-01' });
      mid = lab.applyEvent(mid, { seq: 1, type: 'set-params', params: { [flag]: false } });
      without(x.step).forEach((s, i) => (mid = lab.applyEvent(mid, { seq: 2 + i, type: 'step', step: s })));
      assert.deepEqual(mid.deviations, []);
      same(lab.resolve(mid), out);

      // Performed anyway (in order, or first): one 'not-planned' deviation at its event; the step's
      // rule still fires, so the slide shows it done and R-model-10 adds no caveat for it.
      const anyway = run(`anyway-${flag}`, { [flag]: false });
      assert.deepEqual(anyway.deviations, [{ seq: S.STEPS.indexOf(x.step) + 1, kind: 'not-planned', step: x.step }]);
      const anywayOut = lab.resolve(anyway);
      assert.equal(anywayOut.label, 'illustrative-synthetic');
      assert.ok(!anywayOut.caveats.includes(x.caveat), flag);
      assert.deepEqual(anywayOut.slide, standard.slide);
      assert.equal(anywayOut.tone, 'gold');
      assert.ok(!anywayOut.artifacts.includes('protocol-deviation'));
      const frames = lab.replay(anyway);
      assert.deepEqual(frames[frames.length - 1].deviationsSoFar, anyway.deviations);
      const first = run(`first-${flag}`, { [flag]: false }, [x.step, ...without(x.step)]);
      assert.deepEqual(first.deviations, [{ seq: 1, kind: 'not-planned', step: x.step }]);
      const twice = run(`twice-${flag}`, { [flag]: false }, [...S.STEPS, x.step]);
      assert.deepEqual(
        twice.deviations.map(d => d.kind),
        ['not-planned', 'not-planned']
      );

      // Precedence: a missing required step comes first; the flag is read, so it is no gap.
      const gaps = lab.resolve(
        run(`gaps-${flag}`, { [flag]: false, washes: { condition: 'deviated' } }, without(x.step, 'development'))
      );
      assert.equal(gaps.code, 'step-skipped');
      assert.deepEqual(gaps.outsideSupport, ['development', 'washes.condition']);
      const hyp = lab.resolve(run(`hyp-${flag}`, { [flag]: false, pretreatment: PROBE }, without(x.step)));
      assert.equal(hyp.code, 'hypothesis-unencoded');
      assert.deepEqual(hyp.outsideSupport, ['pretreatment']);
      // A compare-only run's params are coverage-checked too (its outcome rule is the only rule).
      const cps = lab.resolve(
        lab.createRun({ id: `cps-${flag}`, specimenId: 'SPEC-SYN-AD-01', method: 'cps-i', params: { [flag]: false } })
      );
      assert.equal(cps.code, 'param-uncovered');
      assert.deepEqual(cps.outsideSupport, [flag]);

      // compare() and reveal(): two Outcomes, the flag the only changed param, R-model-10 responsible.
      const base = run('base', {}),
        cmp = lab.compare(base, skipped);
      assert.equal(cmp.label, 'illustrative-synthetic');
      assert.deepEqual(cmp.changedParams, [flag]);
      for (const site of S.SITE_CLASSES) assert.equal(cmp.perSite[site].delta, 0, site);
      assert.ok(cmp.rulesResponsible.includes('R-model-10'));
      assert.ok(cmp.caveats.includes(x.caveat));
      const revealed = lab.reveal(
        { ...experiment('base', skipped.id), independentVariable: flag, changed: [flag] },
        { base, [skipped.id]: skipped }
      );
      assert.equal(revealed.ok, true);
      assert.equal(revealed.label, 'illustrative-synthetic');
      assert.equal(revealed.cards.length, 1);
      assert.equal(revealed.cards[0].kind, 'outcome');
      same(revealed.cards[0].outcome, out);
    }

    // Both false: both caveats, tone silver, unfixed; both done anyway: two 'not-planned'.
    const neither = run('neither', { toning: false, thiosulfate: false }, without('gold-toning', 'sodium-thiosulfate'));
    assert.deepEqual(neither.deviations, []);
    const both = lab.resolve(neither);
    assert.equal(both.label, 'illustrative-synthetic');
    assert.ok(both.caveats.includes(SKIP.toning.caveat) && both.caveats.includes(SKIP.thiosulfate.caveat));
    assert.equal(both.tone, 'silver');
    assert.deepEqual(both.slide, { wax: false, coverslipped: true, fixed: false, toned: false, unfixed: true });
    const bothAnyway = run('neither', { toning: false, thiosulfate: false });
    assert.deepEqual(bothAnyway.deviations, [
      { seq: 7, kind: 'not-planned', step: 'gold-toning' },
      { seq: 8, kind: 'not-planned', step: 'sodium-thiosulfate' },
    ]);
    assert.deepEqual(lab.resolve(bothAnyway).slide, standard.slide);

    // Without R-model-10 (ENGINE-14's content): the false flag is a gap with the same words as before.
    const older = S.createLab({
      ...content,
      rules: { ...content.rules, items: content.rules.items.filter(r => r.id !== 'R-model-10') },
    });
    for (const [flag, x] of Object.entries(SKIP)) {
      const card = older.resolve(
        perform(
          older,
          older.createRun({ id: `old-${flag}`, specimenId: 'SPEC-SYN-AD-01', params: { [flag]: false } }),
          without(x.step)
        )
      );
      assert.equal(card.code, 'param-uncovered', flag);
      assert.deepEqual(card.outsideSupport, [flag]);
      assert.equal(card.explanation, x.explanation);
      assert.deepEqual(card.whatWouldBeNeeded, [x.needed]);
    }
  },
  // MODE-engine-1 export: the toning / thiosulfate lines in the procedure's words (one combined line
  // when both are performed, else one line each), the 'not-planned' deviation, no run block for a run
  // not chosen yet (one "Runs: not chosen yet" item instead) and ordinal measurements in words.
  25: lab => {
    const opts = { title: 'Fixed notebook', studentLabel: 'Student' },
      none = lab.newNotebook(),
      without = (...steps) => S.STEPS.filter(s => !steps.includes(s)),
      run = (id, params, steps = S.STEPS) =>
        perform(lab, lab.createRun({ id, specimenId: 'SPEC-SYN-AD-01', params }), steps),
      exp = (title, baselineRunId, experimentalRunId, extra = {}) => ({
        ...experiment(baselineRunId, experimentalRunId),
        id: title,
        title,
        ...extra,
      });
    const runsById = {
      std: run('std', {}),
      ton: run('ton', { toning: false }, without('gold-toning')),
      thio: run('thio', { thiosulfate: false }),
      both: run('both', { toning: false, thiosulfate: false }, without('gold-toning', 'sodium-thiosulfate')),
    };
    const input = {
      notebook: none,
      experiments: [exp('A', 'std', 'ton', { status: 'done' }), exp('B', 'thio', 'both')],
      runsById,
      measurements: [],
    };
    const TONED = S.TONING_TEXT,
      FIXED = S.THIOSULFATE_TEXT;
    const md = lab.exportNotebook(input, opts),
      settings = (text, id) => text.split(`\n#### Run ${id}\n\n`)[1].split('\n- Events:')[0].split('\n').slice(2),
      runBlock = (text, id) => text.split(`\n#### Run ${id}\n\n`)[1].split('\n\n#### ')[0];
    assert.deepEqual(settings(md, 'std'), [
      '- Settings: all standard (per procedure)',
      `- Toning and thiosulfate: performed (${TONED.performed}; ${FIXED.performed})`,
    ]);
    assert.deepEqual(settings(md, 'ton'), [
      '- Settings: all standard (per procedure) except gold toning',
      `- Gold toning: skipped (${TONED.skipped})`,
      `- Thiosulfate: performed (${FIXED.performed})`,
    ]);
    assert.deepEqual(settings(md, 'thio'), [
      '- Settings: all standard (per procedure) except thiosulfate',
      `- Gold toning: performed (${TONED.performed})`,
      `- Thiosulfate: skipped (${FIXED.skipped})`,
    ]);
    assert.deepEqual(settings(md, 'both'), [
      '- Settings: all standard (per procedure) except gold toning and thiosulfate',
      `- Gold toning: skipped (${TONED.skipped})`,
      `- Thiosulfate: skipped (${FIXED.skipped})`,
    ]);
    assert.ok(!md.includes('record only') && !md.includes('not modeled)'), 'no record-only wording anywhere');
    assert.equal(md.split('\n- Toning and thiosulfate: ').length, 2, 'only the standard run has the combined line');
    for (const id of ['ton', 'thio', 'both']) {
      const block = runBlock(md, id);
      assert.ok(block.includes(`\n- Label: ${S.LABEL_TEXT['illustrative-synthetic']}\n`), id);
      assert.ok(block.includes(`\n- Description: ${lab.describeOutcome(lab.resolve(runsById[id]))}\n`), id);
    }
    assert.ok(runBlock(md, 'ton').includes('No gold toning: the stain stays brown-black.'));
    assert.ok(runBlock(md, 'ton').includes('\n- Deviations: none\n'));
    assert.ok(runBlock(md, 'thio').includes('\n- Deviations: not-planned sodium-thiosulfate\n'));
    assert.ok(!runBlock(md, 'thio').includes('No thiosulfate:'), 'done anyway: fixed, so no caveat');
    assert.ok(
      md.includes(
        '\n- Model readout (simulated): Target/background contrast: low in both runs (no change on the model scale)\n'
      )
    );
    const worded = lab.exportNotebook(input, { ...opts, stepTitle: id => `<${id}>`, paramText: () => 'x' });
    assert.ok(worded.includes('\n- Deviations: not-planned <sodium-thiosulfate>\n'));
    assert.deepEqual(settings(worded, 'thio'), settings(md, 'thio'), 'the flag lines are engine words');
    for (const text of [md, worded]) {
      markdownCheck(text);
      resultCheck(text);
      studentPartClean(text);
    }

    // A blank run id (empty, spaces, null, undefined) gets no block and no "(run not found)"; one
    // "Runs: not chosen yet" item follows the fields. A named run that is missing is still reported.
    const blanks = lab.exportNotebook(
      {
        notebook: none,
        experiments: [
          exp('None', '', '  '),
          exp('Nulls', null, undefined),
          exp('Half', 'std', ''),
          exp('Gone', 'std', 'gone'),
        ],
        runsById,
        measurements: [],
      },
      opts
    );
    const expBlock = title => blanks.split(`\n### ${title}\n\n`)[1].split('\n### ')[0];
    for (const title of ['None', 'Nulls', 'Half']) {
      const block = expBlock(title);
      assert.ok(!block.includes('(run not found)'), title);
      assert.equal(block.split('\n').filter(l => l === '- Runs: not chosen yet').length, 1, title);
      assert.ok(block.includes('\n- Interpretation: not written\n\n- Runs: not chosen yet\n'), title);
      assert.ok(block.includes('\n- Experimental run (with your change): not chosen\n'), title);
    }
    for (const title of ['None', 'Nulls']) {
      assert.ok(!expBlock(title).includes('#### '), title);
      assert.ok(expBlock(title).includes('\n- Baseline run (standard): not chosen\n'), title);
    }
    assert.equal(expBlock('Half').split('\n#### Run std\n').length, 2);
    assert.ok(expBlock('Gone').includes('\n#### Run gone\n\n(run not found)\n'));
    assert.ok(!expBlock('Gone').includes('- Runs: not chosen yet'));
    markdownCheck(blanks);

    // Ordinal measurements print their word on the model scale (the unit from the measurement, else
    // its rule); other units, and a value that is no ordinal, print as before.
    const m = (n, value, extra = {}) => ({
      id: `m${n}`,
      measurementId: 'contrast-ordinal',
      runId: 'std',
      label: 'illustrative-synthetic',
      value,
      unit: 'ordinal',
      manual: false,
      ...extra,
    });
    const measurements = [
      ...[0, 1, 2, 3, 4, '3'].map((value, n) => m(n, value)),
      m(6, 2, { unit: undefined }),
      m(7, 7),
      m(8, 12, { measurementId: 'roi-lesion-count', unit: 'count', manual: true, note: 'two fields' }),
    ];
    const lines = lab
      .exportNotebook({ ...input, experiments: [exp('M', 'std', 'ton')], measurements }, opts)
      .split('\n')
      .filter(l => l.startsWith(`  - ${S.ENTRY_TAG.simulated} `))
      .map(l => l.slice(`  - ${S.ENTRY_TAG.simulated} `.length));
    assert.deepEqual(lines, [
      'Target/background contrast: none (model scale) (derived)',
      'Target/background contrast: trace (model scale) (derived)',
      'Target/background contrast: low (model scale) (derived)',
      'Target/background contrast: moderate (model scale) (derived)',
      'Target/background contrast: high (model scale) (derived)',
      'Target/background contrast: moderate (model scale) (derived)',
      'Target/background contrast: low (model scale) (derived)',
      'Target/background contrast: 7 ordinal (derived)',
      'Predefined-region lesion count: 12 count (manual), note: two fields',
    ]);
    for (const line of lines.slice(0, 7)) assert.doesNotMatch(line, /\d/, line);
  },
  // ---- §11 (MODE-engine-1): two modes and the reaction model ---------------------------------------
  // Helpers: a free run from a step list; the last reaction; the state numbers.
  26: (lab, content) => {
    // createRun({ mode }): practice by default; every run carries slide and reactions.
    const practice = lab.createRun({ id: 'p', specimenId: 'SPEC-SYN-AD-01' }),
      free = lab.createRun({ id: 'f', specimenId: 'SPEC-SYN-AD-01', mode: 'free' }),
      odd = lab.createRun({ id: 'o', specimenId: 'SPEC-SYN-AD-01', mode: 'whatever' });
    assert.equal(practice.mode, 'practice');
    assert.equal(free.mode, 'free');
    assert.equal(odd.mode, 'practice');
    for (const run of [practice, free]) {
      assert.deepEqual(run.slide, {
        wax: true,
        coverslipped: false,
        fixed: false,
        toned: false,
        primed: false,
        ammoniated: false,
        unfixed: false,
        ...SHELF_FLAGS,
      });
      assert.deepEqual(run.unknownDips, []);
      assert.deepEqual(run.reactions, []);
    }
    assert.deepEqual(S.MODES, ['practice', 'free']);
    assert.ok(Object.isFrozen(S.MODES));
    // An older save without mode / slide / reactions loads and resolves as before: a practice run
    // whose slide follows its steps; applyEvent adds the fields.
    const fresh = fullRun(lab, 'old', 'SPEC-SYN-AD-01'),
      old = clone(fresh);
    delete old.mode;
    delete old.slide;
    delete old.reactions;
    const fromOld = lab.resolve(old),
      fromFresh = lab.resolve(fresh);
    assert.deepEqual(fromOld, fromFresh);
    assert.equal(fromOld.mode, 'practice');
    assert.deepEqual(fromOld.slide, { wax: false, coverslipped: true, fixed: true, toned: true, unfixed: false });
    const oldPartial = clone(
      perform(lab, lab.createRun({ id: 'op', specimenId: 'SPEC-SYN-AD-01' }), S.STEPS.slice(0, 2))
    );
    delete oldPartial.mode;
    delete oldPartial.slide;
    delete oldPartial.reactions;
    assert.equal(lab.resolve(oldPartial).code, 'step-skipped');
    assert.deepEqual(lab.lookOf(oldPartial), {
      key: 'faint-yellow',
      text: S.LOOKS['faint-yellow'].text,
      color: S.LOOK_COLORS['faint-yellow'],
    });
    const continued = lab.applyEvent(oldPartial, { seq: 3, type: 'step', step: 'water-wash' });
    assert.equal(continued.mode, 'practice');
    assert.deepEqual(continued.reactions, []);
    assert.equal(continued.slide.wax, false);
    assert.deepEqual(
      lab.replay(continued).map(f => f.look),
      ['unstained', 'faint-yellow', 'faint-yellow']
    );
    // A stored free run keeps its mode through replay and resolve.
    const stored = clone(freeRun(lab, ['deparaffinize-rehydrate', 'silver-impregnation']));
    assert.equal(lab.replay(stored)[1].reaction.step, 'silver-impregnation');
    assert.equal(lab.resolve(stored).mode, 'free');
    assert.deepEqual(S.lint(content), []);
  },
  // Every step event of a free run appends exactly one Reaction (set-params and notes none); a
  // practice run keeps none; replay frames carry reaction, slide and look.
  27: lab => {
    let run = lab.createRun({ id: 'r', specimenId: 'SPEC-SYN-AD-01', mode: 'free' });
    run = lab.applyEvent(run, { seq: 1, type: 'set-params', params: { development: { endpoint: 'extended' } } });
    assert.deepEqual(run.reactions, []);
    run = lab.applyEvent(run, { seq: 2, type: 'note', text: 'hello' });
    assert.deepEqual(run.reactions, []);
    S.STEPS.forEach((step, i) => {
      run = lab.applyEvent(run, { seq: 3 + i, type: 'step', step });
      assert.equal(run.reactions.length, i + 1, step);
      const r = run.reactions[i];
      assert.deepEqual(Object.keys(r).sort(), ['claims', 'kind', 'look', 'rules', 'seq', 'step', 'text', 'why'].sort());
      assert.equal(r.seq, 3 + i);
      assert.equal(r.step, step);
      assert.ok(S.REACTION_KINDS.includes(r.kind), r.kind);
      assert.ok(r.rules.length > 0 && r.claims.length > 0, `${step}: traceable`);
      assert.ok(
        r.rules.every(id => /^R-react-/.test(id)),
        r.rules.join(',')
      );
      for (const id of r.rules) assert.ok(lab.getRule(id) && (lab.getRule(id).claims || []).length, id);
      assert.ok(S.LOOK_KEYS.includes(r.look), r.look);
      assert.ok(r.text.split(/\s+/).length <= 60 && r.why.length > 0, r.text);
    });
    const frames = lab.replay(run);
    assert.equal(frames.length, 11);
    assert.equal(frames[0].reaction, null);
    assert.equal(frames[1].reaction, null);
    assert.deepEqual(frames[2].reaction, run.reactions[0]);
    assert.deepEqual(frames[10].reaction, run.reactions[8]);
    assert.deepEqual(frames[10].slide, run.slide);
    assert.equal(frames[10].look, lab.resolve(run).look.key);
    assert.deepEqual(frames[2].slide, {
      ...run.slide,
      wax: false,
      coverslipped: false,
      fixed: false,
      toned: false,
      primed: false,
      ammoniated: false,
      unfixed: false,
    });
    // A practice run: no reactions, frames carry null reactions and the slide bookkeeping.
    const p = fullRun(lab, 'p', 'SPEC-SYN-AD-01');
    assert.deepEqual(p.reactions, []);
    assert.ok(lab.replay(p).every(f => f.reaction === null));
    assert.deepEqual(lab.replay(p)[8].slide, {
      wax: false,
      coverslipped: true,
      fixed: true,
      toned: true,
      primed: true,
      ammoniated: false,
      unfixed: false,
      ...SHELF_FLAGS,
    });
    // A free run's step rules never include the strict axioms, and a practice run's never a reaction rule.
    assert.ok(
      run.rulesApplied.every(id => !/^R-model-/.test(id)),
      run.rulesApplied.join(',')
    );
    assert.ok(
      p.rulesApplied.every(id => !/^R-react-/.test(id)),
      p.rulesApplied.join(',')
    );
  },
  // Sealed: mount, then any step is a 'sealed' no-reaction that changes nothing.
  28: lab => {
    const done = freeRun(lab, S.STEPS),
      before = lab.resolve(done);
    assert.equal(before.slide.coverslipped, true);
    for (const step of S.STEPS) {
      const again = lab.applyEvent(done, { seq: 99, type: 'step', step }),
        r = last(again);
      assert.equal(r.kind, 'sealed', step);
      assert.equal(r.text, 'No reaction: the slide is under a coverslip, so the solution never reaches the section.');
      assert.deepEqual(r.rules, ['R-react-sealed']);
      assert.ok(r.claims.includes('C-course-mount-seal'));
      const after = lab.resolve(again);
      assert.deepEqual(after.state, before.state, step);
      assert.deepEqual(after.slide, before.slide, step);
      assert.deepEqual(after.artifacts, before.artifacts, step);
      assert.deepEqual(after.look, before.look, step);
      assert.ok(after.caveats.some(c => /back through xylene/.test(c)));
    }
    // Mounting with the wax still on seals the wax in: a later dewax is sealed too.
    const waxed = lab.applyEvent(freeRun(lab, ['final-wash-dehydrate-clear-mount']), {
      seq: 2,
      type: 'step',
      step: 'deparaffinize-rehydrate',
    });
    assert.equal(last(waxed).kind, 'sealed');
    assert.equal(waxed.slide.wax, true);
  },
  // Dewax: the wax leaves and the section is in water; a repeat is a real no-reaction.
  29: lab => {
    const run = freeRun(lab, ['deparaffinize-rehydrate']);
    assert.equal(run.slide.wax, false);
    assert.equal(last(run).kind, 'reaction');
    assert.equal(last(run).text, 'Wax removed; the section is wet and even, in water.');
    assert.deepEqual(last(run).rules, ['R-react-dewax']);
    assert.ok(last(run).claims.includes('C-course-trouble-patchy'));
    assert.equal(last(run).look, 'unstained');
    const twice = lab.applyEvent(run, { seq: 2, type: 'step', step: 'deparaffinize-rehydrate' });
    assert.equal(last(twice).kind, 'no-reaction');
    assert.equal(last(twice).text, 'No wax left to remove.');
    assert.deepEqual(last(twice).rules, ['R-react-dewax-repeat']);
    assert.deepEqual(
      twice.deviations.map(d => d.kind),
      ['repeated']
    );
    assert.equal(lab.resolve(twice).look.key, 'unstained');
    assert.deepEqual(
      lab.resolve(twice).deviations.map(d => d.kind),
      ['repeated']
    );
    assert.ok(!lab.resolve(twice).artifacts.includes('protocol-deviation'));
  },
  // Wax cap: a silver bath on a waxed section binds at most trace, sets 'patchy', and says so.
  30: lab => {
    const waxed = freeRun(lab, ['silver-impregnation']);
    for (const site of TARGETS) assert.equal(waxed.state[site].ionicBound, 1, site);
    assert.deepEqual(last(waxed).rules, ['R-react-silver-1', 'R-react-wax-cap']);
    assert.ok(
      last(waxed).text.endsWith('The wax left on the section keeps the solution from reaching it evenly: patchy.')
    );
    assert.ok(last(waxed).text.startsWith('Silver bound to the section'));
    assert.equal(last(waxed).look, 'patchy');
    const out = lab.resolve(waxed);
    assert.deepEqual(out.artifacts, ['patchy']);
    assert.equal(out.look.key, 'patchy');
    assert.equal(out.look.text, S.LOOKS.patchy.text);
    const second = lab.applyEvent(waxed, { seq: 2, type: 'step', step: 'ammoniacal-silver' });
    for (const site of TARGETS) assert.equal(second.state[site].ionicBound, 1, site);
    assert.ok(last(second).rules.includes('R-react-wax-cap'));
    // MODE-FIX-engine-3: a first ammoniacal dip the wax held at trace is not "at its plateau".
    assert.equal(last(second).kind, 'no-reaction');
    assert.equal(
      last(second).text,
      'No more silver bound: the wax on the section keeps the silver solution out, so the staining stays patchy.'
    );
    assert.doesNotMatch(last(second).text, /plateau/);
    assert.match(last(second).why, /wax/i);
    assert.equal(last(second).look, 'patchy');
    const developed = lab.applyEvent(second, { seq: 3, type: 'step', step: 'development' });
    assert.equal(lab.resolve(developed).look.key, 'patchy', 'patchy wins while the deposit is below black');
    assert.ok(lab.resolve(developed).caveats.some(c => /schematic device/.test(c)));
    // Dewaxed first: full binding, no cap, no artifact.
    const clean = freeRun(lab, ['deparaffinize-rehydrate', 'silver-impregnation']);
    for (const site of TARGETS) assert.equal(clean.state[site].ionicBound, 2, site);
    assert.deepEqual(last(clean).rules, ['R-react-silver-1']);
    assert.deepEqual(lab.resolve(clean).artifacts, []);
    assert.equal(lab.resolve(clean).look.key, 'faint-yellow');
    // Repeat at plateau: a real no-reaction with the bath's own rule.
    const plateau = lab.applyEvent(clean, { seq: 3, type: 'step', step: 'silver-impregnation' });
    assert.equal(last(plateau).kind, 'no-reaction');
    assert.equal(last(plateau).text, 'No reaction: binding is at its plateau for this bath.');
    assert.deepEqual(last(plateau).rules, ['R-react-silver-1']);
  },
  // Development: first bath only gives light detail; no silver gives a no-reaction and an unstained slide.
  31: lab => {
    const light = freeRun(lab, ['deparaffinize-rehydrate', 'silver-impregnation', 'development']),
      out = lab.resolve(light);
    for (const site of TARGETS) assert.equal(out.perSite[site].visibility, 2, site);
    assert.equal(out.background, 1);
    assert.equal(out.look.key, 'light-detail');
    assert.equal(last(light).kind, 'reaction');
    assert.equal(
      last(light).text,
      'Silver reduced where bound silver met reduction sites. Only a little: faint structures on a pale background.'
    );
    assert.deepEqual(last(light).rules, ['R-react-develop']);
    assert.ok(last(light).claims.includes('C-course-endpoint-microscope'));
    const none = freeRun(lab, ['deparaffinize-rehydrate', 'development']);
    assert.equal(last(none).kind, 'no-reaction');
    assert.equal(
      last(none).text,
      'No reaction: the developer found no bound silver on the section, so there was nothing to reduce.'
    );
    assert.deepEqual(last(none).rules, ['R-react-develop-none']);
    const noneOut = lab.resolve(none);
    assert.equal(noneOut.look.key, 'unstained');
    assert.equal(noneOut.background, 0);
    for (const site of S.SITE_CLASSES) assert.equal(noneOut.perSite[site].visibility, 0, site);
    // The full free procedure in order reproduces the practice picture.
    const full = lab.resolve(freeRun(lab, S.STEPS)),
      strict = lab.resolve(fullRun(lab, 'strict', 'SPEC-SYN-AD-01'));
    assert.deepEqual(full.perSite, strict.perSite);
    assert.equal(full.contrast, strict.contrast);
    assert.deepEqual(full.slide, strict.slide);
    assert.equal(full.tone, 'gold');
    assert.deepEqual(full.look, strict.look);
    assert.deepEqual(full.deviations, []);
    assert.deepEqual(full.gaps, []);
    assert.deepEqual(full.stepsNotDone, []);
  },
  // Thiosulfate before development: back to unstained and fixed; the developer then has nothing.
  32: lab => {
    const steps = ['deparaffinize-rehydrate', 'silver-impregnation', 'ammoniacal-silver'],
      bound = freeRun(lab, steps);
    for (const site of TARGETS)
      assert.equal(
        bound.state[site].ionicBound,
        lab.getSpecimen('SPEC-SYN-AD-01').sites[site].presence > 4
          ? 4
          : Math.min(4, lab.getSpecimen('SPEC-SYN-AD-01').sites[site].presence),
        site
      );
    const fixed = lab.applyEvent(bound, { seq: 4, type: 'step', step: 'sodium-thiosulfate' });
    for (const site of S.SITE_CLASSES) assert.equal(fixed.state[site].ionicBound, 0, site);
    assert.equal(fixed.slide.fixed, true);
    assert.equal(last(fixed).kind, 'reaction');
    assert.equal(
      last(fixed).text,
      'Unreduced silver removed: the bound silver is gone, so the section is back to unstained and a developer now has nothing to reduce.'
    );
    assert.deepEqual(last(fixed).rules, ['R-react-fix-unstained']);
    assert.equal(lab.resolve(fixed).look.key, 'unstained');
    const developed = lab.applyEvent(fixed, { seq: 5, type: 'step', step: 'development' });
    assert.equal(last(developed).kind, 'no-reaction');
    assert.equal(
      last(developed).text,
      'No reaction: the thiosulfate removed the unreduced silver, so the developer has nothing left to reduce.'
    );
    assert.deepEqual(last(developed).rules, ['R-react-develop-fixed']);
    assert.equal(lab.resolve(developed).look.key, 'unstained');
    // Thiosulfate with nothing bound: a no-reaction; after development: the deposit stays.
    const empty = freeRun(lab, ['deparaffinize-rehydrate', 'sodium-thiosulfate']);
    assert.equal(last(empty).kind, 'no-reaction');
    assert.deepEqual(last(empty).rules, ['R-react-fix-none']);
    assert.equal(empty.slide.fixed, false);
    const after = freeRun(lab, [...steps, 'development', 'sodium-thiosulfate']),
      out = lab.resolve(after);
    assert.equal(last(after).text, 'Unreduced silver removed: the slide stops changing.');
    assert.deepEqual(last(after).rules, ['R-react-fix']);
    for (const site of TARGETS)
      assert.equal(out.perSite[site].visibility, 3 - (site === 'neuropil-thread' ? 1 : 0), site);
    assert.equal(out.slide.fixed, true);
    assert.equal(out.look.key, 'black-on-tan');
    // A new silver bath after thiosulfate binds again and unfixes the slide.
    const rebound = lab.applyEvent(fixed, { seq: 9, type: 'step', step: 'silver-impregnation' });
    assert.equal(rebound.slide.fixed, false);
    assert.equal(last(rebound).kind, 'reaction');
  },
  // Gold toning: nothing to tone, then gold and gray-black, then already toned.
  33: lab => {
    const none = freeRun(lab, ['deparaffinize-rehydrate', 'gold-toning']);
    assert.equal(last(none).kind, 'no-reaction');
    assert.equal(last(none).text, 'No reaction: there is no reduced silver on the section for the gold to tone.');
    assert.deepEqual(last(none).rules, ['R-react-tone-none']);
    assert.equal(none.slide.toned, false);
    assert.equal(lab.resolve(none).tone, 'silver');
    const boundOnly = freeRun(lab, [
      'deparaffinize-rehydrate',
      'silver-impregnation',
      'ammoniacal-silver',
      'gold-toning',
    ]);
    assert.equal(last(boundOnly).kind, 'no-reaction', 'bound silver is not a stain');
    const steps = ['deparaffinize-rehydrate', 'silver-impregnation', 'ammoniacal-silver', 'development'],
      before = lab.resolve(freeRun(lab, steps)),
      toned = freeRun(lab, [...steps, 'gold-toning']),
      out = lab.resolve(toned);
    assert.equal(before.look.key, 'black-on-tan');
    assert.equal(before.tone, 'silver');
    assert.equal(last(toned).kind, 'reaction');
    assert.equal(last(toned).text, 'Gold toned: the silver turns from brown-black to gray-black.');
    assert.deepEqual(last(toned).rules, ['R-react-tone']);
    assert.ok(last(toned).claims.includes('C-course-toning-colour'));
    assert.equal(last(toned).look, 'gray-black');
    assert.equal(out.tone, 'gold');
    assert.equal(out.look.key, 'gray-black');
    assert.deepEqual(out.perSite, before.perSite, 'the deposit itself is unchanged');
    const again = lab.applyEvent(toned, { seq: 9, type: 'step', step: 'gold-toning' });
    assert.equal(last(again).kind, 'no-reaction');
    assert.equal(last(again).text, 'Already toned.');
    assert.deepEqual(last(again).rules, ['R-react-tone-repeat']);
    assert.deepEqual(
      again.deviations.map(d => d.kind),
      ['repeated']
    );
  },
  // Development again: +1 deposit where nuclei exist and +1 background; dark brown when it crosses.
  34: lab => {
    const steps = ['deparaffinize-rehydrate', 'silver-impregnation', 'ammoniacal-silver', 'development'],
      once = lab.resolve(freeRun(lab, steps)),
      twiceRun = freeRun(lab, [...steps, 'development']),
      twice = lab.resolve(twiceRun);
    for (const site of TARGETS)
      assert.equal(twice.perSite[site].visibility, Math.min(4, once.perSite[site].visibility + 1), site);
    assert.equal(twice.background, once.background + 1);
    assert.equal(last(twiceRun).kind, 'reaction');
    assert.equal(
      last(twiceRun).text,
      'Developed again: more silver reduced where it was already reduced, and the background darkens with it.'
    );
    assert.deepEqual(last(twiceRun).rules, ['R-react-develop-again']);
    assert.ok(last(twiceRun).claims.includes('C-course-trouble-dark'));
    assert.equal(twice.look.key, 'black-on-tan');
    assert.deepEqual(
      twice.deviations.map(d => d.kind),
      ['repeated']
    );
    assert.ok(!twice.artifacts.includes('protocol-deviation'), 'order is the point on the free bench');
    const thriceRun = lab.applyEvent(twiceRun, { seq: 9, type: 'step', step: 'development' }),
      thrice = lab.resolve(thriceRun);
    assert.equal(thrice.background, 3);
    assert.equal(thrice.look.key, 'dark-brown');
    assert.equal(last(thriceRun).look, 'dark-brown');
    assert.ok(last(thriceRun).text.endsWith('Too long / too strong: dark brown everywhere.'), last(thriceRun).text);
    assert.equal(thrice.look.text, S.LOOKS['dark-brown'].text);
    // At the top of the scale a further development is a real no-reaction.
    let top = thriceRun;
    for (let n = 0; n < 3; n += 1) top = lab.applyEvent(top, { seq: 10 + n, type: 'step', step: 'development' });
    assert.equal(last(top).kind, 'no-reaction');
    assert.ok(last(top).text.startsWith('No reaction:'));
    assert.deepEqual(last(top).rules, ['R-react-develop-again']);
    // No site with nuclei in a repeat on a site without them: the negative comparison's plaques stay at 0.
    const neg = lab.resolve(freeRun(lab, [...steps, 'development'], {}, 'SPEC-SYN-NEG-01'));
    assert.equal(neg.perSite['plaque-core'].visibility, 0);
    assert.equal(neg.perSite.axon.visibility, 4);
  },
  // Ammonia: extra drops weaken the binding (and say so); a cloudy bath leaves grains.
  35: lab => {
    const steps = ['deparaffinize-rehydrate', 'silver-impregnation', 'ammoniacal-silver'],
      clear = freeRun(lab, steps),
      extra = freeRun(lab, steps, { ammoniacal: { ammonia: 'extra' } }),
      cloudy = freeRun(lab, steps, { ammoniacal: { ammonia: 'cloudy' } });
    for (const site of TARGETS) {
      assert.equal(
        clear.state[site].ionicBound,
        Math.min(4, lab.getSpecimen('SPEC-SYN-AD-01').sites[site].presence),
        site
      );
      assert.equal(
        extra.state[site].ionicBound,
        Math.min(2, lab.getSpecimen('SPEC-SYN-AD-01').sites[site].presence),
        site
      );
    }
    assert.equal(last(clear).text, 'More silver bound: tan to brown by eye; fine brown fibres may show, no black yet.');
    assert.deepEqual(last(clear).rules, ['R-react-silver-2']);
    assert.equal(last(clear).look, 'tan-brown');
    // Extra: the first bath already bound 2, so the weakened bath binds nothing more and says why.
    assert.equal(last(extra).kind, 'no-reaction');
    assert.equal(
      last(extra).text,
      'No more silver bound: the extra ammonia weakened this bath, so it added nothing to what the section already carried.'
    );
    assert.doesNotMatch(last(extra).text, /plateau/);
    assert.match(last(extra).why, /extra ammonia/i);
    assert.equal(last(extra).look, 'faint-yellow', 'a bath that bound nothing leaves the look where it was');
    assert.equal(extra.slide.ammoniated, false);
    assert.deepEqual(last(extra).rules, ['R-react-silver-2', 'R-react-ammonia-extra']);
    assert.ok(
      last(extra).claims.includes('C-course-ammonia-endpoint') &&
        last(extra).claims.includes('C-course-trouble-no-black')
    );
    const extraDev = lab.resolve(lab.applyEvent(extra, { seq: 4, type: 'step', step: 'development' })),
      clearDev = lab.resolve(lab.applyEvent(clear, { seq: 4, type: 'step', step: 'development' }));
    assert.equal(extraDev.look.key, 'light-detail');
    assert.equal(clearDev.look.key, 'black-on-tan');
    for (const site of TARGETS) assert.ok(extraDev.perSite[site].visibility <= clearDev.perSite[site].visibility, site);
    assert.deepEqual(extraDev.gaps, [], 'ammoniacal.ammonia is read by the bath rule');
    // Extra ammonia without a first bath: the shortest-exposure gain minus the extra, floor 0.
    const noFirst = freeRun(lab, ['deparaffinize-rehydrate', 'ammoniacal-silver'], {
      ammoniacal: { ammonia: 'extra' },
    });
    for (const site of TARGETS) assert.equal(noFirst.state[site].ionicBound, 0, site);
    assert.equal(last(noFirst).kind, 'no-reaction');
    assert.deepEqual(last(noFirst).rules, ['R-react-silver-2', 'R-react-ammonia-extra', 'R-react-silver-2-unprimed']);
    assert.equal(lab.resolve(noFirst).look.key, 'unstained');
    const noFirstClear = freeRun(lab, ['deparaffinize-rehydrate', 'ammoniacal-silver']);
    for (const site of TARGETS) assert.equal(noFirstClear.state[site].ionicBound, 2, site);
    assert.equal(lab.resolve(noFirstClear).look.key, 'tan-brown');
    // MODE-FIX-engine-7: the no-first-bath position is said and caveated, like the wax cap.
    assert.deepEqual(last(noFirstClear).rules, ['R-react-silver-2', 'R-react-silver-2-unprimed']);
    assert.ok(
      last(noFirstClear).text.endsWith(
        'No first silver bath: the model gives this bath its shortest-exposure position.'
      ),
      last(noFirstClear).text
    );
    assert.ok(lab.resolve(noFirstClear).caveats.some(c => /Skipping the first silver bath/.test(c)));
    assert.ok(!lab.resolve(clear).caveats.some(c => /Skipping the first silver bath/.test(c)));
    // Cloudy: full binding, the grains artifact and the sentence.
    for (const site of TARGETS) assert.equal(cloudy.state[site].ionicBound, clear.state[site].ionicBound, site);
    assert.ok(last(cloudy).text.endsWith('The cloudy bath left black grains on the slide.'), last(cloudy).text);
    assert.deepEqual(last(cloudy).rules, ['R-react-silver-2', 'R-react-ammonia-cloudy']);
    assert.deepEqual(lab.resolve(cloudy).artifacts, ['grains']);
    assert.ok(last(cloudy).claims.includes('C-course-trouble-grains'));
    // Early ammoniacal endpoint: one less; it is read, so no gap.
    const early = freeRun(lab, steps, { ammoniacal: { endpoint: 'early' } });
    for (const site of TARGETS)
      assert.equal(
        early.state[site].ionicBound,
        Math.min(3, lab.getSpecimen('SPEC-SYN-AD-01').sites[site].presence),
        site
      );
    assert.deepEqual(lab.resolve(early).gaps, []);
  },
  // Mounting: sealed; mounted with unreduced silver in it: the unfixed flag and its sentence.
  36: lab => {
    const steps = ['deparaffinize-rehydrate', 'silver-impregnation', 'ammoniacal-silver', 'development'],
      unfixedRun = freeRun(lab, [...steps, 'final-wash-dehydrate-clear-mount']),
      unfixed = lab.resolve(unfixedRun);
    assert.equal(last(unfixedRun).kind, 'reaction');
    assert.equal(
      last(unfixedRun).text,
      'Dehydrated, cleared and coverslipped: the slide is sealed. Silver that was never reduced is still in it (no thiosulfate), so it will keep changing.'
    );
    assert.deepEqual(last(unfixedRun).rules, ['R-react-seal', 'R-react-seal-unfixed']);
    assert.deepEqual(unfixed.slide, { wax: false, coverslipped: true, fixed: false, toned: false, unfixed: true });
    const fixedRun = freeRun(lab, [...steps, 'sodium-thiosulfate', 'final-wash-dehydrate-clear-mount']),
      fixed = lab.resolve(fixedRun);
    assert.equal(last(fixedRun).text, 'Dehydrated, cleared and coverslipped: the slide is sealed.');
    assert.deepEqual(last(fixedRun).rules, ['R-react-seal']);
    assert.deepEqual(fixed.slide, { wax: false, coverslipped: true, fixed: true, toned: false, unfixed: false });
    // Mounting an untouched slide: sealed, nothing in it, no flag.
    const blank = freeRun(lab, ['final-wash-dehydrate-clear-mount']);
    assert.deepEqual(last(blank).rules, ['R-react-seal']);
    assert.deepEqual(lab.resolve(blank).slide, {
      wax: true,
      coverslipped: true,
      fixed: false,
      toned: false,
      unfixed: false,
    });
    assert.deepEqual(lab.resolve(blank).stepsNotDone, S.STEPS.slice(0, 8));
  },
  // A free run never gets out-of-order or not-planned, only repeated; settings with no rule are gaps,
  // never a card; steps not done are listed; the toning / thiosulfate flags are not read.
  37: lab => {
    const order = [
        'development',
        'gold-toning',
        'silver-impregnation',
        'silver-impregnation',
        'deparaffinize-rehydrate',
      ],
      run = freeRun(lab, order, { toning: false, thiosulfate: false });
    assert.deepEqual(run.deviations, [{ seq: 4, kind: 'repeated', step: 'silver-impregnation' }]);
    const out = lab.resolve(run);
    assert.equal(out.label, 'illustrative-synthetic');
    assert.equal(out.mode, 'free');
    assert.deepEqual(out.deviations, run.deviations);
    assert.ok(!out.artifacts.includes('protocol-deviation'));
    assert.ok(!out.rulesApplied.includes('R-order-01') && !out.rulesApplied.includes('R-model-10'));
    assert.deepEqual(out.gaps, []);
    assert.deepEqual(
      out.stepsNotDone,
      S.STEPS.filter(s => !order.includes(s))
    );
    assert.deepEqual(out.reactions, run.reactions);
    assert.notEqual(out.reactions, run.reactions, 'a clone');
    assert.ok(!out.caveats.some(c => /No gold toning|No thiosulfate/.test(c)));
    // Gaps: condition deviated, washes deviated, an unspecified leaf, a pretreatment; never a card.
    const gapped = lab.resolve(
      freeRun(lab, ['deparaffinize-rehydrate'], {
        impregnation: { condition: 'deviated' },
        washes: { condition: 'deviated' },
        development: { strength: 'unspecified' },
        pretreatment: 'probe-x',
      })
    );
    assert.equal(gapped.label, 'illustrative-synthetic');
    assert.deepEqual(
      gapped.gaps.map(g => g.path),
      ['impregnation.condition', 'development.strength', 'washes.condition', 'pretreatment']
    );
    assert.deepEqual(gapped.gaps[0], {
      path: 'impregnation.condition',
      value: 'deviated',
      text: 'No rule for impregnation.condition = deviated: the picture leaves it out.',
    });
    assert.equal(gapped.gaps[3].value, 'probe-x');
    assert.equal(gapped.conditionalOn, null);
    // A setting a reaction rule reads is no gap; temperature deviated keeps R-temp-01 in both modes.
    const temp = lab.resolve(
      freeRun(lab, S.STEPS, {
        impregnation: { temperature: 'deviated', endpoint: 'early' },
        development: { endpoint: 'extended' },
      })
    );
    assert.deepEqual(temp.gaps, []);
    assert.equal(temp.confidence, 'low');
    assert.ok(temp.rulesApplied.includes('R-temp-01'));
    // The slide can be looked at before any step: an unstained section.
    const fresh = lab.createRun({ id: 'fresh', specimenId: 'SPEC-SYN-AD-01', mode: 'free' }),
      freshOut = lab.resolve(fresh);
    assert.equal(freshOut.label, 'illustrative-synthetic');
    assert.equal(freshOut.look.key, 'unstained');
    assert.deepEqual(freshOut.stepsNotDone, [...S.STEPS]);
    assert.deepEqual(freshOut.reactions, []);
    assert.deepEqual(lab.lookOf(fresh), { key: 'unstained', text: S.LOOKS.unstained.text, color: '#eef2f6' });
    // A broken reference is still a card (not a setting): unknown specimen / method.
    assert.equal(
      lab.resolve(lab.createRun({ id: 'x', specimenId: 'SPEC-NOPE', mode: 'free' })).code,
      'specimen-unknown'
    );
    assert.equal(
      lab.resolve(lab.createRun({ id: 'x', specimenId: 'SPEC-SYN-AD-01', method: 'nope', mode: 'free' })).code,
      'method-unknown'
    );
    // compare() over two free runs works like any two outcomes.
    const cmp = lab.compare(freeRun(lab, S.STEPS), freeRun(lab, S.STEPS, { development: { endpoint: 'extended' } }));
    assert.equal(cmp.label, 'illustrative-synthetic');
    assert.deepEqual(cmp.changedParams, ['development.endpoint']);
    assert.ok(cmp.rulesResponsible.includes('R-react-develop'));
    assert.ok(!cmp.rulesResponsible.some(id => /^R-model-/.test(id)));
  },
  // §11.5 strict additions: the ammonia leaf is covered by bind; cloudy adds grains; toning /
  // thiosulfate false resolve with caveats, not cards; tone gold on a standard run; no 'no-effect-v1'.
  38: (lab, content) => {
    assert.deepEqual(S.AMMONIA, ['just-clear', 'extra', 'cloudy']);
    assert.ok(Object.isFrozen(S.AMMONIA));
    assert.equal(S.DEFAULT_PARAMS.ammoniacal.ammonia, 'just-clear');
    assert.deepEqual(S.FIXED_CAVEATS, {});
    assert.ok(!ENGINE_SRC.includes('no-effect-v1'));
    const standard = lab.resolve(fullRun(lab, 's', 'SPEC-SYN-AD-01'));
    assert.equal(standard.tone, 'gold');
    assert.equal(standard.look.key, 'gray-black');
    assert.ok(!standard.caveats.some(c => /no modeled effect/i.test(c)));
    const extra = lab.resolve(fullRun(lab, 'e', 'SPEC-SYN-AD-01', { ammoniacal: { ammonia: 'extra' } }));
    assert.equal(extra.label, 'illustrative-synthetic', 'ammoniacal.ammonia is read by bind');
    for (const site of TARGETS) assert.equal(extra.perSite[site].visibility, 2, site);
    assert.equal(extra.look.key, 'light-detail');
    assert.ok(extra.claims.includes('C-course-ammonia-endpoint'));
    const cloudy = lab.resolve(fullRun(lab, 'c', 'SPEC-SYN-AD-01', { ammoniacal: { ammonia: 'cloudy' } }));
    assert.equal(cloudy.label, 'illustrative-synthetic');
    assert.deepEqual(cloudy.artifacts, ['grains']);
    assert.ok(cloudy.rulesApplied.includes('R-model-07'));
    assert.deepEqual(cloudy.perSite, standard.perSite);
    assert.ok(cloudy.caveats.some(c => /black grains/.test(c)));
    const unspecified = lab.resolve(fullRun(lab, 'u', 'SPEC-SYN-AD-01', { ammoniacal: { ammonia: 'unspecified' } }));
    assert.equal(unspecified.code, 'param-uncovered');
    assert.deepEqual(unspecified.outsideSupport, ['ammoniacal.ammonia']);
    // Both flags false, both steps left out: an Outcome with both caveats, silver tone, unfixed.
    const skip = lab.resolve(
      perform(
        lab,
        lab.createRun({ id: 'k', specimenId: 'SPEC-SYN-AD-01', params: { toning: false, thiosulfate: false } }),
        S.STEPS.filter(s => s !== 'gold-toning' && s !== 'sodium-thiosulfate')
      )
    );
    assert.equal(skip.label, 'illustrative-synthetic');
    assert.equal(skip.tone, 'silver');
    assert.equal(skip.slide.unfixed, true);
    assert.equal(skip.look.key, 'black-on-tan');
    assert.ok(skip.caveats.includes('No gold toning: the stain stays brown-black.'));
    assert.ok(skip.caveats.some(c => c.startsWith('No thiosulfate:')));
    // A step done out of order in practice still gets protocol-deviation (R-order-01 is practice-only).
    const odd = lab.resolve(
      perform(lab, lab.createRun({ id: 'o', specimenId: 'SPEC-SYN-AD-01' }), [...S.STEPS].reverse())
    );
    assert.ok(odd.artifacts.includes('protocol-deviation'));
    // explainStep names the practice rules and never a reaction rule.
    assert.ok(lab.explainStep('ammoniacal-silver').modelEffect.includes('R-model-01'));
    assert.ok(!lab.explainStep('ammoniacal-silver').modelEffect.includes('R-react-'));
    assert.deepEqual(S.lint(content), []);
  },
  // Lint accepts the mode / event predicates and the new ops; every R-react step rule carries a claim
  // and { mode: 'free' }; every R-model step rule { mode: 'practice' }; content without reaction rules
  // gives a free run the engine's no-rule reaction with no rule id.
  39: (lab, content) => {
    const rules = content.rules.items;
    const text = rule => JSON.stringify(rule.when);
    const stepRule = rule => /"step":|"event":"(step|dip)"/.test(text(rule));
    const reacts = rules.filter(r => /^R-react-/.test(r.id) && stepRule(r));
    for (const rule of rules) {
      if (/^R-react-/.test(rule.id)) {
        assert.ok(Array.isArray(rule.claims) && rule.claims.length > 0, rule.id);
        for (const id of rule.claims) assert.ok(lab.getClaim(id), `${rule.id} cites ${id}`);
        if (stepRule(rule)) {
          assert.ok(/"mode":"free"/.test(text(rule)), `${rule.id} carries mode free`);
          assert.ok(
            rule.effect.some(op => op.op === 'react'),
            `${rule.id} carries a react op`
          );
        }
      }
      if (/^R-model-/.test(rule.id) || rule.id === 'R-order-01')
        assert.ok(/"mode":"practice"/.test(text(rule)), rule.id);
      if (/^R-model-/.test(rule.id)) assert.equal(rule.basis, 'schematic-analogy', rule.id);
      for (const op of rule.effect || [])
        if (op.op === 'react' && !op.append) {
          assert.ok(op.text.split(/\s+/).length <= 30, `${rule.id}: ${op.text}`);
          assert.ok(typeof op.why === 'string' && op.why.length > 0, rule.id);
          assert.ok(S.REACTION_KINDS.includes(op.kind), rule.id);
        }
    }
    // Every reaction rule's claim, and every claim's source, is registered (the engine lint agrees).
    assert.deepEqual(S.lint(content), []);
    // Mutations the engine lint refuses: a reaction rule without a claim, a rule naming an unknown
    // step in an `any` list, an unknown claim id on a new rule.
    const broken = (code, mutate) => {
      const c = clone(content);
      mutate(c);
      assert.ok(
        S.lint(c).some(p => p.code === code),
        code
      );
    };
    broken('rule-without-claim', c => c.rules.items.push({ ...clone(rules[0]), id: 'R-react-x', claims: [] }));
    broken('step-unknown', c =>
      c.rules.items.push({
        ...clone(rules[0]),
        id: 'R-react-y',
        when: { all: [{ mode: 'free' }, { any: [{ step: 'nope' }] }] },
      })
    );
    broken('unknown-claim', c => c.rules.items.push({ ...clone(rules[0]), id: 'R-react-z', claims: ['C-nope'] }));
    // The predicates and ops are accepted: a content whose rule carries every new construct lints clean.
    const accepted = clone(content);
    accepted.rules.items.push({
      ...clone(rules[0]),
      id: 'R-react-fixture-ops',
      title: 'Fixture: every §11 construct',
      when: {
        all: [
          { mode: 'free' },
          { event: 'step' },
          { path: 'slide.coverslipped', eq: false },
          { path: 'silver.maxBound', in: [0] },
        ],
      },
      effect: [
        {
          op: 'bindFree',
          gain: { early: 1, 'sop-default': 2, extended: 2 },
          unprimedGain: 2,
          endpointDelta: { early: -1, 'sop-default': 0, extended: 0 },
          ammoniaDelta: { 'just-clear': 0, extra: -2, cloudy: 0 },
          waxCap: 1,
        },
        { op: 'prime' },
        { op: 'developAgain', deposit: 1, background: 1 },
        { op: 'tone', tone: 'gold' },
        { op: 'fix' },
        { op: 'seal' },
        { op: 'dewax' },
        { op: 'flag', id: 'unfixed' },
        { op: 'look', darkBackground: 3, blackFrom: 3, patchyBelow: 3 },
        { op: 'caveat', text: 'x', when: { path: 'params.toning', eq: false } },
        {
          op: 'react',
          kind: 'reaction',
          text: 'x',
          why: 'y',
          noChange: { text: 'n', why: 'w' },
          byLook: { 'dark-brown': 'd' },
          final: true,
        },
        { op: 'react', append: true, text: 'z' },
      ],
      basis: 'course-handout',
      claims: ['C-course-steps-order'],
    });
    assert.deepEqual(S.lint(accepted), []);
    assert.doesNotThrow(() => S.createLab(accepted));
    // Without any reaction step rule, a free run's step gets the engine's own no-rule reaction.
    const bare = S.createLab({
      ...content,
      rules: { ...content.rules, items: rules.filter(r => !reacts.includes(r)) },
    });
    const run = bare.applyEvent(bare.createRun({ id: 'b', specimenId: 'SPEC-SYN-AD-01', mode: 'free' }), {
      seq: 1,
      type: 'step',
      step: 'development',
    });
    assert.equal(run.reactions.length, 1);
    assert.deepEqual(run.reactions[0], {
      seq: 1,
      step: 'development',
      kind: 'no-reaction',
      text: 'No reaction: nothing on the slide changes at this step.',
      why: 'No rule in the model describes this step on this slide.',
      rules: [],
      claims: [],
      look: 'unstained',
    });
    assert.deepEqual(
      run.state,
      bare.createRun({ id: 'b', specimenId: 'SPEC-SYN-AD-01' }).state,
      'no strict rule fires on a free run'
    );
    assert.equal(bare.resolve(run).label, 'illustrative-synthetic');
  },
  // Exports: LOOKS / LOOK_COLORS / LOOK_KEYS / REACTION_KINDS / TONING_TEXT are frozen and complete;
  // lookOf follows the state; no look text or reaction says 'pending', 'v1', 'schematic', 'ordinal',
  // 'param', 'SOP' or 'drain'.
  40: (lab, content) => {
    assert.deepEqual(S.LOOK_KEYS, [
      'unstained',
      'faint-yellow',
      'tan-brown',
      'light-detail',
      'black-on-tan',
      'dark-brown',
      'gray-black',
      'patchy',
    ]);
    for (const key of S.LOOK_KEYS) {
      assert.ok(typeof S.LOOKS[key].text === 'string' && S.LOOKS[key].text.length > 0, key);
      assert.match(S.LOOK_COLORS[key], /^#[0-9a-f]{6}$/, key);
      assert.equal(S.LOOKS[key].color, S.LOOK_COLORS[key]);
      assert.ok(Object.isFrozen(S.LOOKS[key]));
    }
    assert.deepEqual(Object.keys(S.LOOKS), S.LOOK_KEYS);
    assert.equal(S.LOOK_COLORS.unstained, '#eef2f6');
    assert.equal(S.LOOK_COLORS['gray-black'], '#5f6368');
    for (const x of [S.LOOKS, S.LOOK_COLORS, S.LOOK_KEYS, S.REACTION_KINDS, S.TONING_TEXT, S.THIOSULFATE_TEXT])
      assert.ok(Object.isFrozen(x));
    assert.deepEqual(S.REACTION_KINDS, ['reaction', 'no-reaction', 'sealed', 'unknown']);
    const forbidden = /\b(pending|v1|schematic|ordinal|param|SOP|drain|sink)\b/i;
    for (const key of S.LOOK_KEYS) assert.doesNotMatch(S.LOOKS[key].text, forbidden, key);
    for (const rule of content.rules.items)
      for (const op of rule.effect || [])
        if (op.op === 'react') {
          assert.doesNotMatch(op.text, forbidden, rule.id);
          if (op.why) assert.doesNotMatch(op.why, forbidden, rule.id);
          if (op.noChange) assert.doesNotMatch(`${op.noChange.text} ${op.noChange.why}`, forbidden, rule.id);
        }
    for (const t of [...Object.values(S.TONING_TEXT), ...Object.values(S.THIOSULFATE_TEXT)])
      assert.doesNotMatch(t, forbidden);
    // lookOf: null for a compare-only run; the strict run's look matches its outcome.
    assert.equal(lab.lookOf(lab.createRun({ id: 'c', specimenId: 'SPEC-SYN-AD-01', method: 'cps-i' })), null);
    const strict = fullRun(lab, 's', 'SPEC-SYN-AD-01');
    assert.equal(lab.lookOf(strict).key, lab.resolve(strict).look.key);
    assert.equal(lab.resolve(lab.createRun({ id: 'c', specimenId: 'SPEC-SYN-AD-01', method: 'cps-i' })).look, null);
    const low = lab.resolve(fullRun(lab, 'l', 'SPEC-SYN-LOWCHEM-01'));
    assert.equal(low.look.key, 'light-detail', 'trace deposit on a trace background is not over-development');
    assert.equal(low.contrast, 0);
  },
  // Export of a free run: the bench line, each step line with its reaction, the toning / thiosulfate
  // lines from the slide; a practice run's lines unchanged; the result check still holds.
  41: lab => {
    const free = freeRun(lab, [
        'deparaffinize-rehydrate',
        'silver-impregnation',
        'ammoniacal-silver',
        'development',
        'development',
      ]),
      runsById = { free, std: fullRun(lab, 'std', 'SPEC-SYN-AD-01') },
      md = lab.exportNotebook(
        {
          notebook: lab.newNotebook(),
          experiments: [{ ...experiment('std', 'free'), id: 'F', title: 'Free bench' }],
          runsById,
          measurements: [],
        },
        { title: 'Fixed notebook', studentLabel: 'Student' }
      ),
      block = md.split('\n#### Run free\n\n')[1].split('\n\n#### ')[0].split('\n');
    assert.deepEqual(block.slice(0, 6), [
      '- Specimen: SPEC-SYN-AD-01',
      '- Method: bielschowsky-modified',
      '- Bench: free (any jar, any order, any number of times)',
      '- Settings: all standard (per procedure)',
      `- Gold toning: not done (${S.TONING_TEXT.skipped})`,
      `- Thiosulfate: not done (${S.THIOSULFATE_TEXT.skipped})`,
    ]);
    assert.ok(block.includes('1. deparaffinize-rehydrate: Wax removed; the section is wet and even, in water.'));
    assert.ok(
      block.includes(
        '5. development: Developed again: more silver reduced where it was already reduced, and the background darkens with it.'
      )
    );
    assert.ok(block.includes('- Deviations: repeated development'));
    assert.ok(block.includes(`- Label: ${S.LABEL_TEXT['illustrative-synthetic']}`));
    const toned = freeRun(lab, S.STEPS),
      md2 = lab.exportNotebook(
        {
          notebook: lab.newNotebook(),
          experiments: [{ ...experiment('std', 'x'), id: 'G', title: 'Toned' }],
          runsById: { std: runsById.std, x: toned },
          measurements: [],
        },
        { title: 'Fixed notebook', studentLabel: 'Student' }
      );
    assert.ok(
      md2.includes(
        `\n- Gold toning: done (${S.TONING_TEXT.performed})\n- Thiosulfate: done (${S.THIOSULFATE_TEXT.performed})\n`
      )
    );
    assert.ok(
      !md2.includes('- Toning and thiosulfate:') || md2.split('- Toning and thiosulfate:').length === 2,
      'only the practice run has the combined line'
    );
    for (const text of [md, md2]) {
      markdownCheck(text);
      resultCheck(text);
      studentPartClean(text);
    }
  },
  // MODE-FIX-engine (2026-10-13 review round): the look follows the state (dark brown only on a
  // dark background; tan-brown only after an ammoniacal bath that raised binding, cleared by
  // thiosulfate); a no-change append names its cause; the develop sentences describe this slide and
  // name no structure; a late dewax says the patchiness stays; the free first-bath time matches the
  // practice model; no first bath is said and caveated; the first-bath why keeps to its claims; the
  // course procedure carries no dead link.
  42: (lab, content) => {
    const sites = site => Object.fromEntries(TARGETS.map(s => [s, site(s)]));
    // 1. A trace deposit on a trace background is light, incomplete staining, never over-development.
    const low = lab.resolve(fullRun(lab, 'low', 'SPEC-SYN-LOWCHEM-01'));
    assert.equal(low.look.key, 'light-detail');
    assert.equal(low.background, 1);
    assert.deepEqual(
      sites(s => low.perSite[s].visibility),
      sites(() => 1)
    );
    const lowFree = freeRun(
      lab,
      ['deparaffinize-rehydrate', 'silver-impregnation', 'ammoniacal-silver', 'development'],
      {},
      'SPEC-SYN-LOWCHEM-01'
    );
    assert.equal(last(lowFree).look, 'light-detail');
    assert.doesNotMatch(last(lowFree).text, /Too long|too strong|dark brown/);
    assert.ok(last(lowFree).text.endsWith('Only a little: faint structures on a pale background.'));
    const earlyWeak = lab.resolve(
      fullRun(lab, 'ew', 'SPEC-SYN-AD-02', { development: { endpoint: 'early', strength: 'weak' } })
    );
    assert.equal(earlyWeak.look.key, 'light-detail');
    // A genuinely dark background still reads dark brown (extended + strong; developed three times).
    const over = lab.resolve(
      fullRun(lab, 'over', 'SPEC-SYN-AD-01', { development: { endpoint: 'extended', strength: 'strong' } })
    );
    assert.equal(over.background, 3);
    assert.equal(over.look.key, 'dark-brown');
    const thrice = freeRun(lab, [
      'deparaffinize-rehydrate',
      'silver-impregnation',
      'ammoniacal-silver',
      'development',
      'development',
      'development',
    ]);
    assert.equal(last(thrice).look, 'dark-brown');
    // 2. The look follows the bound silver, not the step list: a bath that bound nothing leaves it;
    //    thiosulfate then a first bath is faintly yellow again; a repeat ammoniacal bath tan-brown.
    const extra = freeRun(lab, ['deparaffinize-rehydrate', 'silver-impregnation', 'ammoniacal-silver'], {
      ammoniacal: { ammonia: 'extra' },
    });
    assert.equal(last(extra).kind, 'no-reaction');
    assert.equal(last(extra).look, 'faint-yellow');
    assert.equal(lab.lookOf(extra).key, 'faint-yellow');
    assert.equal(lab.resolve(extra).look.key, 'faint-yellow');
    const redip = freeRun(lab, [
      'deparaffinize-rehydrate',
      'silver-impregnation',
      'ammoniacal-silver',
      'sodium-thiosulfate',
      'silver-impregnation',
    ]);
    assert.ok(last(redip).text.startsWith('Silver bound to the section: faintly yellow'));
    assert.equal(last(redip).look, 'faint-yellow');
    assert.equal(lab.lookOf(redip).key, 'faint-yellow');
    assert.equal(redip.slide.ammoniated, false);
    const redipAmm = lab.applyEvent(redip, { seq: 6, type: 'step', step: 'ammoniacal-silver' });
    assert.ok(last(redipAmm).text.startsWith('More silver bound: tan to brown'));
    assert.equal(last(redipAmm).look, 'tan-brown');
    assert.equal(redipAmm.slide.ammoniated, true);
    // A practice run reads tan-brown after its ammoniacal bath (the strict model binds there).
    const practice = perform(lab, lab.createRun({ id: 'p', specimenId: 'SPEC-SYN-AD-01' }), S.STEPS.slice(0, 4));
    assert.equal(lab.lookOf(practice).key, 'tan-brown');
    assert.equal(
      lab.lookOf(perform(lab, lab.createRun({ id: 'q', specimenId: 'SPEC-SYN-AD-01' }), S.STEPS.slice(0, 3))).key,
      'faint-yellow'
    );
    // A save from before `ammoniated` existed reads it from the steps, as the look used to.
    const stored = clone(freeRun(lab, ['deparaffinize-rehydrate', 'silver-impregnation', 'ammoniacal-silver']));
    delete stored.slide.ammoniated;
    assert.equal(lab.lookOf(stored).key, 'tan-brown');
    assert.ok(!('ammoniated' in lab.resolve(stored).slide), 'internal bookkeeping, not an outcome field');
    // 3. A no-change append names its cause in place of the plateau words (wax; extra ammonia).
    const waxAmm = freeRun(lab, ['silver-impregnation', 'ammoniacal-silver']);
    assert.equal(last(waxAmm).kind, 'no-reaction');
    assert.doesNotMatch(last(waxAmm).text, /plateau/);
    assert.match(last(waxAmm).text, /^No more silver bound: the wax/);
    assert.match(last(waxAmm).why, /wax/i);
    assert.doesNotMatch(last(extra).text, /plateau/);
    assert.match(last(extra).why, /extra ammonia/i);
    // A true repeat keeps the plateau words (the bath's own rule, nothing else fired).
    const repeat = freeRun(lab, [
      'deparaffinize-rehydrate',
      'silver-impregnation',
      'ammoniacal-silver',
      'ammoniacal-silver',
    ]);
    assert.equal(last(repeat).text, 'No reaction: binding is at its plateau for this bath.');
    assert.deepEqual(last(repeat).rules, ['R-react-silver-2']);
    // 4. The develop sentences describe this slide and name no structure, no order.
    const devs = ['deparaffinize-rehydrate', 'silver-impregnation', 'ammoniacal-silver', 'development'];
    for (const spec of ['SPEC-SYN-AD-01', 'SPEC-SYN-NEG-01']) {
      const dev = freeRun(lab, devs, {}, spec);
      assert.equal(
        last(dev).text,
        'Silver reduced where bound silver met reduction sites. Black detail on a background that is still tan.',
        spec
      );
      assert.doesNotMatch(last(dev).text, /tangle|plaque|axon|neurite|first|then/i, spec);
      const again = lab.applyEvent(dev, { seq: 5, type: 'step', step: 'development' });
      assert.equal(
        last(again).text,
        'Developed again: more silver reduced where it was already reduced, and the background darkens with it.'
      );
    }
    const patchyDev = freeRun(lab, ['silver-impregnation', 'ammoniacal-silver', 'development']);
    assert.equal(last(patchyDev).look, 'patchy');
    assert.ok(last(patchyDev).text.endsWith('Uneven: the solution did not reach the whole section.'));
    assert.ok(last(patchyDev).claims.includes('C-course-trouble-patchy'));
    const develop = content.rules.items.find(r => r.id === 'R-react-develop');
    assert.deepEqual(Object.keys(develop.effect.find(op => op.op === 'react').byLook).sort(), [
      'black-on-tan',
      'dark-brown',
      'light-detail',
      'patchy',
    ]);
    // 5. A late dewax says the patchiness stays; a first dewax is unchanged.
    const late = freeRun(lab, ['silver-impregnation', 'ammoniacal-silver', 'development', 'deparaffinize-rehydrate']);
    assert.equal(
      last(late).text,
      'Wax removed; the section is wet and even, in water. The silver already went on unevenly under the wax, so the patchiness stays.'
    );
    assert.equal(last(late).look, 'patchy');
    assert.equal(
      last(freeRun(lab, ['deparaffinize-rehydrate'])).text,
      'Wax removed; the section is wet and even, in water.'
    );
    // 6. The free bench's first-bath time is the practice model's (early → 2): the same mix, the same picture.
    const gain = content.rules.items
      .find(r => r.id === 'R-react-silver-2')
      .effect.find(op => op.op === 'bindFree').gain;
    assert.deepEqual(
      gain,
      content.rules.items.find(r => r.id === 'R-model-01').effect.find(op => op.op === 'bind').gain
    );
    const earlyFree = lab.resolve(freeRun(lab, S.STEPS, { impregnation: { endpoint: 'early' } })),
      earlyPractice = lab.resolve(fullRun(lab, 'ep', 'SPEC-SYN-AD-01', { impregnation: { endpoint: 'early' } }));
    assert.deepEqual(earlyFree.perSite, earlyPractice.perSite);
    assert.equal(earlyFree.look.key, earlyPractice.look.key);
    assert.equal(earlyFree.look.key, 'light-detail');
    // 7. No first bath: the append sentence and its caveat (the rule mirrors R-react-wax-cap).
    const unprimed = content.rules.items.find(r => r.id === 'R-react-silver-2-unprimed');
    assert.equal(unprimed.basis, 'schematic-analogy');
    assert.ok(unprimed.claims.length >= 1);
    const noFirst = freeRun(lab, ['deparaffinize-rehydrate', 'ammoniacal-silver']);
    assert.deepEqual(last(noFirst).rules, ['R-react-silver-2', 'R-react-silver-2-unprimed']);
    assert.ok(
      last(noFirst).text.endsWith('No first silver bath: the model gives this bath its shortest-exposure position.')
    );
    assert.equal(last(noFirst).look, 'tan-brown');
    assert.ok(lab.resolve(noFirst).caveats.some(c => /Skipping the first silver bath/.test(c)));
    // 8. The first-bath why keeps to its claims (no "nothing is reduced" as a fact).
    for (const id of ['R-react-silver-1', 'R-react-ammonia-wait']) {
      const op = content.rules.items.find(r => r.id === id).effect.find(o => o.op === 'react');
      assert.doesNotMatch(op.why, /nothing is reduced/, id);
    }
    assert.match(
      content.rules.items.find(r => r.id === 'R-react-silver-1').effect.find(o => o.op === 'react').why,
      /separate steps/
    );
    // 9. The course procedure is registered without a dead link; the export prints its citation alone.
    const proc = content.sources.items.find(s => s.id === 'S-course-procedure');
    assert.equal(proc.rights, 'course-access-only');
    assert.ok(!('url' in proc));
    assert.deepEqual(S.lint(content), []);
    const md = lab.exportNotebook(
      {
        notebook: lab.newNotebook(),
        experiments: [{ ...experiment('std', 'x'), id: 'H', title: 'Sources' }],
        runsById: { std: fullRun(lab, 'std', 'SPEC-SYN-AD-01'), x: freeRun(lab, S.STEPS) },
        measurements: [],
      },
      { title: 'Fixed notebook', studentLabel: 'Student' }
    );
    assert.ok(!md.includes('claude.ai'));
    assert.ok(md.includes('S-course-procedure NDRB 2903'));
    // No reaction or look text carries a forbidden word after the rewording.
    const forbidden = /\b(pending|v1|schematic|ordinal|param|SOP|drain|sink)\b/i;
    for (const rule of content.rules.items)
      for (const op of rule.effect || [])
        if (op.op === 'react') {
          for (const t of [op.text, op.why, ...(op.noChange ? [op.noChange.text, op.noChange.why] : [])])
            if (t) assert.doesNotMatch(t, forbidden, rule.id);
          for (const t of Object.values(op.byLook || {})) assert.doesNotMatch(t, forbidden, rule.id);
        }
  },
  // MODE-FIX-integrate-1: explainStep(step, method, mode). The default describes the practice model
  // (R-model-* only); 'free' lists every reaction rule that fires at that step, each branch by its
  // title, so a sheet opened on the free bench never says the jar does nothing.
  43: lab => {
    for (const stepId of S.STEPS) {
      const practice = lab.explainStep(stepId).modelEffect;
      assert.equal(lab.explainStep(stepId, 'bielschowsky-modified', 'practice').modelEffect, practice, stepId);
      assert.doesNotMatch(practice, /R-react-/, stepId);
      const free = lab.explainStep(stepId, 'bielschowsky-modified', 'free').modelEffect;
      assert.doesNotMatch(free, /R-model-|No modeled effect/, stepId);
      const ids = [...free.matchAll(/\((R-react-[a-z0-9-]+)/g)].map(m => m[1]);
      assert.ok(ids.length >= 1, `${stepId}: ${free}`);
      assert.equal(new Set(ids).size, ids.length, 'each rule once');
      for (const id of ids)
        assert.equal(
          lab.getRule(id).when.all.some(w => w.mode === 'free'),
          true,
          id
        );
      assert.doesNotMatch(free, /\b(pending|v1|schematic|ordinal|param|SOP)\b/i, stepId);
    }
    const seal = lab.explainStep('final-wash-dehydrate-clear-mount', 'bielschowsky-modified', 'free').modelEffect;
    assert.match(seal, /the slide is sealed \(R-react-seal\)/);
    assert.match(seal, /R-react-seal-unfixed/);
    const dewax = lab.explainStep('deparaffinize-rehydrate', 'bielschowsky-modified', 'free').modelEffect;
    assert.match(dewax, /\(R-react-dewax\); Dewax again: nothing left to remove \(R-react-dewax-repeat\)$/);
    assert.match(lab.explainStep('development', 'bielschowsky-modified', 'free').modelEffect, /R-react-develop-none/);
    // the free sheet for the first bath still names the ammoniacal rule that reads impregnation.endpoint
    assert.match(
      lab.explainStep('silver-impregnation', 'bielschowsky-modified', 'free').modelEffect,
      /R-react-silver-2; reads impregnation\.endpoint, applied at the ammoniacal-silver step/
    );
    assert.equal(lab.explainStep('nope', 'bielschowsky-modified', 'free'), undefined);
  },
  44: (lab, content) => {
    const withAsset = mutate => {
      const c = clone(content);
      const asset = referenceAsset(c);
      mutate(asset);
      c.assets.items.push(asset);
      return S.lint(c).map(p => p.code);
    };
    assert.deepEqual(
      withAsset(() => {}),
      []
    );
    for (const key of S.LOOK_KEYS)
      assert.deepEqual(
        withAsset(a => (a.looks = [key])),
        [],
        key
      );
    assert.deepEqual(
      withAsset(a => (a.looks = ['nope'])),
      ['asset-looks-invalid']
    );
    assert.deepEqual(
      withAsset(a => (a.looks = ['black-on-tan', 'nope'])),
      ['asset-looks-invalid']
    );
    assert.deepEqual(
      withAsset(a => (a.looks = [])),
      ['asset-looks-invalid']
    );
    assert.deepEqual(
      withAsset(a => delete a.looks),
      ['asset-looks-invalid']
    );
    assert.deepEqual(
      withAsset(a => (a.sourceId = 'S-nope')),
      ['asset-source-missing']
    );
    assert.deepEqual(
      withAsset(a => delete a.sourceId),
      ['asset-source-missing']
    );
    assert.deepEqual(
      withAsset(a => (a.rights = { status: 'unknown' })),
      ['asset-rights-unknown']
    );
    // the two codes are reference-image only: a schematic asset carries neither looks nor a source
    assert.deepEqual(
      withAsset(a => {
        a.kind = 'schematic';
        a.label = S.LABELS.SYNTHETIC;
        a.looks = ['nope'];
        a.sourceId = 'S-nope';
      }),
      []
    );
    for (const code of ['asset-looks-invalid', 'asset-source-missing']) assert.ok(S.LINT_CODES.includes(code), code);
    // an asset the lint rejects never becomes a lab
    const bad = clone(content);
    bad.assets.items.push({ ...referenceAsset(bad), looks: ['nope'] });
    assert.throws(() => S.createLab(bad), S.ContentError);
    // the items the lab exposes keep the asset's fields
    const good = clone(content);
    good.assets.items.push(referenceAsset(good));
    const item = S.createLab(good).content.assets.items.find(a => a.id === 'A-ref-fixture');
    assert.equal(item.label, S.LABELS.OBSERVED);
    assert.deepEqual(item.looks, ['black-on-tan', 'gray-black']);
  },
  // §13.1 / §13.2: the shelf API and the jar wording.
  45: lab => {
    assert.deepEqual(
      lab.listReagents().map(r => r.id),
      SHELF_IDS
    );
    const copy = lab.listReagents();
    copy[0].name = 'changed';
    assert.equal(lab.listReagents()[0].name, 'Xylene and ethanol series', 'listReagents hands out copies');
    const silver = lab.getReagent('silver-nitrate');
    assert.equal(silver.step, 'silver-impregnation');
    assert.equal(silver.group, 'procedure');
    assert.ok(Object.isFrozen(silver));
    assert.deepEqual(silver.fields.strength.values, [10, 20]);
    assert.deepEqual(silver.fields.minutes.values, [10, 15, 20, 30, 40]);
    assert.deepEqual(silver.fields.tempC.values, [5, 22, 37, 60]);
    assert.equal(silver.fields.tempC.words['22'], 'room temperature (procedure)');
    assert.equal(silver.fields.fresh.words.old, 'old or light-exposed');
    assert.equal(lab.getReagent('nope'), undefined);
    for (const id of ['permanganate', 'oxalic-acid']) {
      assert.equal(lab.getReagent(id).group, 'pretreatment', id);
      assert.equal(lab.getReagent(id).step, null, id);
    }
    for (const id of ['tap-water', 'formic-acid', 'copper-sulfate', 'hydrogen-peroxide']) {
      const r = lab.getReagent(id);
      assert.equal(r.group, 'other', id);
      assert.equal(r.step, null, id);
      assert.ok(!('strength' in r.fields), `${id}: no strength is invented`);
      assert.ok(typeof r.unknownWhy === 'string' && r.unknownWhy.split(/\s+/).length <= 30, id);
    }
    assert.equal(
      lab.getReagent('tap-water').unknownWhy,
      'The procedure uses distilled water throughout; no source here says what tap water does to this stain.'
    );
    const jars = lab.procedureJars();
    assert.deepEqual(Object.keys(jars), S.STEPS);
    jars['silver-impregnation'].minutes = 40;
    assert.deepEqual(lab.procedureJars()['silver-impregnation'], {
      reagent: 'silver-nitrate',
      strength: 20,
      minutes: 20,
      tempC: 22,
      dark: true,
      fresh: 'fresh',
    });
    assert.deepEqual(lab.procedureJars().development, {
      reagent: 'developer',
      drops: 3,
      minutes: 3,
      tempC: 22,
      dark: true,
      into: 'ammoniacal-jar',
    });
    for (const stepId of S.STEPS) assert.equal(lab.getReagent(jars[stepId].reagent).step, stepId, stepId);
    const hands = lab.handlingChoices();
    assert.deepEqual(
      hands.map(h => [h.id, h.default, h.values.map(v => v.id)]),
      [
        ['forceps', 'plastic', ['plastic', 'metal']],
        ['glass', 'acid-cleaned', ['acid-cleaned', 'ordinary']],
        ['between', 'kept-wet', ['kept-wet', 'let-dry']],
        ['fill', 'full', ['full', 'half']],
      ]
    );
    for (const h of hands) assert.match(h.values[0].words, /\(procedure\)$/, h.id);
    const J = lab.procedureJars();
    assert.equal(
      lab.solutionText(J['silver-impregnation']),
      '20% silver nitrate · 20 min · room temperature · in the dark'
    );
    assert.equal(
      lab.solutionText({ reagent: 'silver-nitrate' }),
      '20% silver nitrate · 20 min · room temperature · in the dark'
    );
    assert.equal(
      lab.solutionText({
        ...J['silver-impregnation'],
        strength: 10,
        minutes: 30,
        tempC: 37,
        dark: false,
        fresh: 'old',
      }),
      '10% silver nitrate · 30 min · 37 °C · in the light · old or light-exposed'
    );
    assert.equal(
      lab.solutionText(J.development),
      'Developer · 3 drops per 50 ml · 3 min · room temperature · in the dark'
    );
    assert.equal(
      lab.solutionText({ ...J.development, minutes: 0.5, into: 'fresh-jar' }),
      'Developer · 3 drops per 50 ml · 30 s · room temperature · in the dark · in a fresh jar with no silver'
    );
    assert.equal(
      lab.solutionText(J['ammoniacal-silver']),
      'Ammoniacal silver · ammonia just clear + 2 drops · 15 min · room temperature · in the dark'
    );
    assert.equal(lab.solutionText(J['deparaffinize-rehydrate']), 'Xylene and ethanol series · 5 min per xylene change');
    assert.equal(lab.solutionText(J['final-wash-dehydrate-clear-mount']), 'Ethanol, xylene and coverslip');
    assert.equal(lab.solutionText({ reagent: 'tap-water' }), 'Tap water · 3 min');
    assert.equal(lab.solutionText({ reagent: 'permanganate' }), 'Potassium permanganate 0.25% · 2 min');
    assert.equal(
      lab.solutionText({ reagent: 'silver-nitrate', minutes: 25 }),
      '20% silver nitrate · 25 min · room temperature · in the dark'
    );
    assert.equal(lab.solutionText({ reagent: 'nope' }), 'nope');
    assert.equal(lab.solutionText(null), '');
    for (const stepId of S.STEPS) {
      assert.doesNotMatch(lab.solutionText(J[stepId]), /\(procedure\)/, stepId);
      assert.equal(lab.isProcedureSolution(stepId, J[stepId]), true, stepId);
      assert.equal(
        lab.isProcedureSolution(stepId, { reagent: J[stepId].reagent }),
        true,
        `${stepId}: fields left out read as defaults`
      );
    }
    assert.equal(lab.isProcedureSolution('silver-impregnation', { ...J['silver-impregnation'], minutes: 30 }), false);
    assert.equal(lab.isProcedureSolution('water-wash', { reagent: 'tap-water', minutes: 3 }), false);
    assert.equal(lab.isProcedureSolution('silver-impregnation', J['water-wash']), false);
    assert.equal(lab.isProcedureSolution('nope', J['water-wash']), false);
    assert.equal(lab.isProcedureSolution('water-wash', null), false);
    assert.ok(S.REACTION_KINDS.includes('unknown') && Object.isFrozen(S.REACTION_KINDS));
  },
  // §13.2: no reagents.json (or a bottle off the shelf) is "no shelf": every dip is currently unknown.
  46: (lab, content) => {
    const bare = content.reagents
      ? S.createLab(Object.fromEntries(Object.entries(content).filter(([key]) => key !== 'reagents')))
      : lab;
    assert.deepEqual(bare.listReagents(), []);
    assert.deepEqual(bare.procedureJars(), {});
    assert.deepEqual(bare.handlingChoices(), []);
    assert.equal(bare.getReagent('silver-nitrate'), undefined);
    assert.equal(bare.solutionText({ reagent: 'silver-nitrate' }), 'silver-nitrate');
    assert.equal(bare.isProcedureSolution('silver-impregnation', { reagent: 'silver-nitrate' }), false);
    for (const reagent of ['silver-nitrate', 'permanganate']) {
      const start = bare.createRun({ id: 'n', specimenId: 'SPEC-SYN-AD-01', mode: 'free' }),
        solution = { reagent, minutes: 20 },
        run = bare.applyEvent(start, { seq: 1, type: 'dip', jarId: 'silver-impregnation', solution }),
        r = run.reactions[0];
      assert.equal(r.kind, 'unknown', reagent);
      assert.equal(r.text, `Currently unknown reaction: ${reagent} on this slide.`);
      assert.equal(r.why, `This bottle is not on this lab's shelf. ${UNKNOWN_TAIL}`);
      assert.deepEqual([r.rules, r.claims, r.unknown], [[], [], [{ field: 'reagent', value: reagent }]]);
      for (const key of RUN_RECORD) assert.deepEqual(run[key], start[key], `${reagent} ${key}`);
      assert.deepEqual(run.unknownDips, [{ seq: 1, jarId: 'silver-impregnation', solution }]);
      const out = bare.resolve(run);
      assert.equal(out.label, S.LABELS.SYNTHETIC);
      assert.deepEqual(out.unknownDips, run.unknownDips);
      assert.deepEqual(out.unknownFields, []);
    }
    const practice = bare.applyEvent(bare.createRun({ id: 'p', specimenId: 'SPEC-SYN-AD-01' }), {
      seq: 1,
      type: 'dip',
      jarId: 'x1',
      solution: { reagent: 'silver-nitrate' },
    });
    assert.deepEqual(practice.deviations, [{ seq: 1, kind: 'not-runnable', step: null, jarId: 'x1' }]);
    assert.deepEqual(practice.reactions, []);
  },
  // §13.2 tier 1: tap water, formic acid, copper sulfate, hydrogen peroxide.
  47: lab => {
    const prepared = dips(lab, freeSlide(lab), ['deparaffinize-rehydrate', 'silver-impregnation', 'water-wash']);
    for (const start of [freeSlide(lab), prepared])
      for (const id of ['tap-water', 'formic-acid', 'copper-sulfate', 'hydrogen-peroxide']) {
        const reagent = lab.getReagent(id),
          run = dip(lab, start, 'x1', { reagent: id }, { between: 'let-dry', forceps: 'metal', fill: 'half' }),
          r = last(run),
          words = lab.solutionText({ reagent: id });
        assert.equal(r.kind, 'unknown', id);
        assert.equal(r.text, `Currently unknown reaction: ${words[0].toLowerCase()}${words.slice(1)} on this slide.`);
        assert.equal(r.why, `${reagent.unknownWhy} ${UNKNOWN_TAIL}`);
        assert.deepEqual([r.rules, r.claims, r.step, r.jarId, r.reagent], [[], [], null, 'x1', id]);
        assert.deepEqual(r.unknown, [{ field: 'reagent', value: id }]);
        assert.equal(r.look, lab.lookOf(start).key);
        for (const key of RUN_RECORD) assert.deepEqual(run[key], start[key], `${id} ${key}`);
        assert.deepEqual(run.unknownDips, [
          ...start.unknownDips,
          { seq: r.seq, jarId: 'x1', solution: { reagent: id, minutes: reagent.fields.minutes.default } },
        ]);
        assert.equal(run.events[run.events.length - 1].type, 'dip');
        assert.deepEqual(lab.resolve(run).artifacts, lab.resolve(start).artifacts, `${id}: the handling never applies`);
        assert.doesNotMatch(`${r.text} ${r.why}`, /\b(error|invalid|not allowed)\b/i);
      }
    assert.equal(
      lab.getReagent('formic-acid').unknownWhy,
      'Velasco 1992 found formic acid abolishes CPS silver staining, a different method; no source here says what it does to the Bielschowsky stain.'
    );
    for (const id of ['copper-sulfate', 'hydrogen-peroxide'])
      assert.equal(
        lab.getReagent(id).unknownWhy,
        'Velasco 1992 uses it before ammoniacal silver in the CPS method; no source here says what it does inside this Bielschowsky sequence.'
      );
  },
  // §13.2 tier 1 by context: the developer in a fresh jar; permanganate or oxalic acid once silver is on.
  48: lab => {
    const ready = dips(lab, freeSlide(lab), READY),
      fresh = dip(lab, ready, 'development', { into: 'fresh-jar' }),
      r = last(fresh);
    assert.equal(r.kind, 'unknown');
    assert.equal(r.step, 'development');
    assert.equal(r.why, `${lab.getReagent('developer').unknownWhy} ${UNKNOWN_TAIL}`);
    for (const key of RUN_RECORD) assert.deepEqual(fresh[key], ready[key], key);
    assert.ok(!fresh.stepsDone.includes('development'));
    const onSilver = [
      dips(lab, freeSlide(lab), ['deparaffinize-rehydrate', 'silver-impregnation']),
      // the thiosulfate took the bound silver back out, but the first bath was done
      dips(lab, freeSlide(lab), ['deparaffinize-rehydrate', 'silver-impregnation', 'sodium-thiosulfate']),
      // no first bath, but the ammoniacal bath bound silver
      dips(lab, freeSlide(lab), ['deparaffinize-rehydrate', 'ammoniacal-silver']),
    ];
    assert.equal(maxOf(onSilver[1], 'ionicBound'), 0);
    for (const start of onSilver)
      for (const id of ['permanganate', 'oxalic-acid']) {
        const run = dip(lab, start, 'x1', { reagent: id });
        assert.equal(last(run).kind, 'unknown', id);
        assert.equal(last(run).why, `${lab.getReagent(id).unknownWhy} ${UNKNOWN_TAIL}`);
        for (const key of RUN_RECORD) assert.deepEqual(run[key], start[key], `${id} ${key}`);
      }
    // the published pretreatment runs on dewaxed sections: through the wax (none taken off, or a
    // xylene change too short) permanganate and oxalic acid are currently unknown
    for (const waxed of [freeSlide(lab), dip(lab, freeSlide(lab), 'deparaffinize-rehydrate', { minutes: 1 })]) {
      assert.equal(waxed.slide.wax, true);
      for (const id of ['permanganate', 'oxalic-acid']) {
        const run = dip(lab, waxed, 'x1', { reagent: id }),
          r = last(run);
        assert.equal(r.kind, 'unknown', id);
        assert.match(r.why, /^The published pretreatment .*dewaxed sections.*through the wax/, id);
        assert.ok(r.why.split(UNKNOWN_TAIL)[0].trim().split(/\s+/).length <= 30, id);
        for (const key of RUN_RECORD) assert.deepEqual(run[key], waxed[key], `${id} ${key}`);
      }
    }
    const alone = dip(lab, dip(lab, freeSlide(lab), 'deparaffinize-rehydrate'), 'x1', { reagent: 'oxalic-acid' });
    assert.equal(last(alone).kind, 'unknown', 'oxalic acid with no permanganate before it');
    assert.equal(alone.slide.pretreated, false);
    const late = dips(lab, freeSlide(lab), [
      'deparaffinize-rehydrate',
      ['x1', { reagent: 'permanganate' }],
      'silver-impregnation',
      ['x2', { reagent: 'oxalic-acid' }],
    ]);
    assert.equal(last(late).kind, 'unknown', 'oxalic acid after the silver');
    assert.deepEqual([late.slide.oxidized, late.slide.pretreated], [true, false]);
    const out = lab.resolve(late);
    assert.equal(out.label, S.LABELS.SYNTHETIC);
    assert.deepEqual(out.unknownDips, [{ seq: 4, jarId: 'x2', solution: { reagent: 'oxalic-acid', minutes: 2 } }]);
  },
  // §13.2: a sealed slide is sealed for every bottle; no unknown sentence, nothing reaches the section.
  49: lab => {
    const mounted = dips(lab, freeSlide(lab), S.STEPS);
    assert.equal(mounted.slide.coverslipped, true);
    for (const [jarId, patch] of [
      ['x1', { reagent: 'tap-water' }],
      ['silver-impregnation', { tempC: 37, strength: 10 }],
      ['development', { into: 'fresh-jar' }],
      ['x1', { reagent: 'permanganate' }],
      ['deparaffinize-rehydrate', { minutes: 1 }],
    ]) {
      const run = dip(lab, mounted, jarId, patch, { forceps: 'metal', fill: 'half' }),
        r = last(run);
      assert.equal(r.kind, 'sealed', jarId);
      assert.deepEqual(r.rules, ['R-react-sealed']);
      assert.deepEqual(r.unknown, []);
      assert.doesNotMatch(r.text, /Currently unknown/);
      assert.deepEqual(
        [run.state, run.slide, run.unknownDips, run.effectiveParams],
        [mounted.state, mounted.slide, [], mounted.effectiveParams]
      );
      const out = lab.resolve(run);
      assert.deepEqual([out.artifacts, out.confidence], [lab.resolve(mounted).artifacts, 'nominal']);
    }
  },
  // §13.2 tier 2: a known bottle with a field no source describes runs the procedure's effect and says so.
  50: lab => {
    const base = dip(lab, freeSlide(lab), 'deparaffinize-rehydrate'),
      ref = dip(lab, base, 'silver-impregnation'),
      sentence = phrase => `Currently unknown: what ${phrase} changes; the drawing shows the procedure's effect.`,
      partly = (start, jarId, patch, phrase, extra = '') => {
        const run = dip(lab, start, jarId, patch),
          plain = dip(lab, start, jarId),
          text = `${sentence(phrase)}${extra ? ` ${extra}` : ''}`;
        assert.deepEqual([run.state, last(run).kind], [plain.state, last(plain).kind], phrase);
        assert.equal(last(run).text, `${last(plain).text} ${text}`, phrase);
        const field = Object.keys(patch)[0];
        assert.deepEqual(last(run).unknown, [{ field, value: patch[field], text }], phrase);
        return run;
      };
    const ten = partly(base, 'silver-impregnation', { strength: 10 }, '10% silver nitrate');
    assert.ok(last(ten).claims.includes('C-course-alternatives'), '10% cites the alternatives line');
    const cold = partly(
      base,
      'silver-impregnation',
      { tempC: 5 },
      '5 °C silver nitrate',
      'Litchfield 2001 found a controlled low-temperature version the most reproducible.'
    );
    for (const id of ['C-litchfield-2001-reproducible', 'C-course-alternatives'])
      assert.ok(last(cold).claims.includes(id), id);
    assert.equal(cold.effectiveParams['silver-impregnation'].impregnation.temperature, 'deviated');
    const coldOut = lab.resolve(cold);
    assert.equal(coldOut.confidence, 'low');
    assert.ok(coldOut.rulesApplied.includes('R-temp-01'));
    assert.ok(coldOut.caveats.some(c => /highly sensitive to ambient temperature/.test(c)));
    assert.equal(lab.resolve(ref).confidence, 'nominal');
    const warm = partly(
      base,
      'silver-impregnation',
      { tempC: 37 },
      '37 °C silver nitrate',
      'The procedure lists 37 °C for 15 min as an experiment the class may run.'
    );
    assert.ok(last(warm).claims.includes('C-course-alternatives'), '37 °C cites the alternatives line');
    const hot = partly(base, 'silver-impregnation', { tempC: 60 }, '60 °C silver nitrate');
    assert.ok(!last(hot).claims.includes('C-course-alternatives'), '60 °C is not on the list');
    assert.ok(!last(ref).claims.includes('C-course-alternatives'));
    // a later bath at room temperature keeps the run's temperature record
    const back = dip(lab, warm, 'silver-impregnation');
    assert.deepEqual(last(back).unknown, []);
    assert.equal(back.effectiveParams['silver-impregnation'].impregnation.temperature, 'deviated');
    assert.equal(lab.resolve(back).confidence, 'low');
    partly(base, 'silver-impregnation', { dark: false }, 'silver nitrate in the light');
    const primed = dips(lab, base, ['silver-impregnation', 'water-wash']),
      ready = dips(lab, base, READY.slice(1));
    partly(primed, 'ammoniacal-silver', { tempC: 37 }, '37 °C ammoniacal silver');
    partly(primed, 'ammoniacal-silver', { dark: false }, 'ammoniacal silver in the light');
    partly(ready, 'development', { dark: false }, 'developer in the light');
    partly(primed, 'ammonium-hydroxide-wash', { minutes: 15 }, '15 min in ammonia water');
    const developed = dip(lab, ready, 'development');
    partly(developed, 'gold-toning', { minutes: 1 }, '1 min in gold chloride 0.2%');
    partly(developed, 'gold-toning', { minutes: 10 }, '10 min in gold chloride 0.2%');
    partly(developed, 'sodium-thiosulfate', { minutes: 5 }, '5 min in sodium thiosulfate 5%');
    partly(developed, 'sodium-thiosulfate', { minutes: 1 }, '1 min in sodium thiosulfate 5%');
    // a value off the shelf's list is currently unknown and read as the procedure's
    const odd = partly(base, 'silver-impregnation', { minutes: 25 }, '25 min in silver nitrate');
    assert.equal(odd.effectiveParams['silver-impregnation'].impregnation.endpoint, 'sop-default');
    // known: distilled water at any time, ammonia water 1 to 5 min
    for (const [start, jarId, patch] of [
      [primed, 'water-wash', { minutes: 1 }],
      [primed, 'water-wash', { minutes: 10 }],
      [primed, 'ammonium-hydroxide-wash', { minutes: 1 }],
      [primed, 'ammonium-hydroxide-wash', { minutes: 5 }],
    ]) {
      const run = dip(lab, start, jarId, patch);
      assert.deepEqual(last(run).unknown, [], `${jarId} ${JSON.stringify(patch)}`);
      assert.equal(last(run).text, last(dip(lab, start, jarId)).text);
    }
    const combined = dips(lab, base, [
      ['silver-impregnation', { strength: 10 }],
      'water-wash',
      ['ammoniacal-silver', { tempC: 37 }],
    ]);
    assert.deepEqual(lab.resolve(combined).unknownFields, [
      {
        seq: 2,
        jarId: 'silver-impregnation',
        reagent: 'silver-nitrate',
        field: 'strength',
        value: 10,
        text: sentence('10% silver nitrate'),
      },
      {
        seq: 4,
        jarId: 'ammoniacal-silver',
        reagent: 'ammoniacal-silver',
        field: 'tempC',
        value: 37,
        text: sentence('37 °C ammoniacal silver'),
      },
    ]);
    assert.deepEqual(lab.resolve(combined).unknownDips, []);
  },
  // §13.2 tier 3: silver nitrate time and age.
  51: lab => {
    const base = dip(lab, freeSlide(lab), 'deparaffinize-rehydrate'),
      ref = dip(lab, base, 'silver-impregnation'),
      endpoint = run => run.effectiveParams['silver-impregnation'].impregnation.endpoint;
    assert.deepEqual([endpoint(ref), maxOf(ref, 'ionicBound')], ['sop-default', 2]);
    for (const minutes of [10, 15]) {
      const run = dip(lab, base, 'silver-impregnation', { minutes });
      assert.deepEqual([endpoint(run), maxOf(run, 'ionicBound')], ['early', 1], `${minutes} min`);
      assert.deepEqual(last(run).unknown, []);
      // the ammoniacal bath reads the first bath's endpoint (the existing free rule)
      assert.equal(maxOf(dips(lab, run, ['water-wash', 'ammoniacal-silver']), 'ionicBound'), 2);
    }
    for (const minutes of [30, 40]) {
      const run = dip(lab, base, 'silver-impregnation', { minutes });
      assert.deepEqual([endpoint(run), maxOf(run, 'ionicBound')], ['extended', 2], `${minutes} min`);
    }
    const old = dip(lab, base, 'silver-impregnation', { fresh: 'old' });
    assert.equal(old.slide.oldSilver, true);
    assert.deepEqual(old.state, ref.state, 'the first bath binds as usual');
    assert.deepEqual(last(old).rules, ['R-react-silver-1', 'R-react-old-silver']);
    assert.equal(
      last(old).text,
      `${last(ref).text} The silver nitrate is old or light-exposed: the procedure lists that as a cause of little or no black.`
    );
    assert.ok(last(old).claims.includes('C-course-trouble-no-black'));
    const refAmm = dips(lab, ref, ['water-wash', 'ammoniacal-silver']),
      oldAmm = dips(lab, old, ['water-wash', 'ammoniacal-silver']);
    assert.deepEqual([maxOf(refAmm, 'ionicBound'), maxOf(oldAmm, 'ionicBound')], [3, 2]);
    assert.equal(last(oldAmm).kind, 'no-reaction');
    assert.equal(
      last(oldAmm).text,
      'No more silver bound: ammoniacal silver made from old or light-exposed silver nitrate added nothing to what the section held.'
    );
    assert.ok(last(oldAmm).rules.includes('R-react-old-silver'));
    const develop = run => dips(lab, run, ['ammonium-hydroxide-wash', 'development']);
    assert.deepEqual(
      [lab.lookOf(develop(refAmm)).key, lab.lookOf(develop(oldAmm)).key],
      ['black-on-tan', 'light-detail']
    );
    assert.ok(lab.resolve(oldAmm).caveats.some(c => /names the cause, not an amount/.test(c)));
    // a fresh silver nitrate bath: the ammoniacal silver made from it binds as usual again
    const renewed = dip(lab, old, 'silver-impregnation');
    assert.equal(renewed.slide.oldSilver, false);
    assert.equal(maxOf(dips(lab, renewed, ['water-wash', 'ammoniacal-silver']), 'ionicBound'), 3);
  },
  // §13.2 tier 3: ammoniacal silver time, ammonia, temperature.
  52: lab => {
    const primed = specimenId =>
        dips(lab, freeSlide(lab, specimenId), ['deparaffinize-rehydrate', 'silver-impregnation', 'water-wash']),
      ad = primed('SPEC-SYN-AD-01'),
      ref = dip(lab, ad, 'ammoniacal-silver'),
      amm = run => run.effectiveParams['ammoniacal-silver'].ammoniacal;
    assert.deepEqual(amm(ref), { endpoint: 'sop-default', ammonia: 'just-clear', condition: 'sop-default' });
    // short: the early position (presence 4 shows the step down)
    const low = primed('SPEC-SYN-LOWCHEM-01');
    assert.equal(maxOf(dip(lab, low, 'ammoniacal-silver'), 'ionicBound'), 4);
    for (const minutes of [5, 10]) {
      const run = dip(lab, low, 'ammoniacal-silver', { minutes });
      assert.equal(amm(run).endpoint, 'early', `${minutes} min`);
      assert.equal(maxOf(run, 'ionicBound'), 3, `${minutes} min`);
    }
    // long: flagged, a darker background once developed
    const refDev = dips(lab, ref, ['ammonium-hydroxide-wash', 'development']);
    for (const minutes of [30, 60]) {
      const run = dip(lab, ad, 'ammoniacal-silver', { minutes });
      assert.equal(run.slide.longAmmoniacal, true);
      assert.deepEqual(run.state, ref.state);
      assert.equal(amm(run).endpoint, 'sop-default');
      assert.equal(
        last(run).text,
        `${last(ref).text} Left far beyond 15 min: the procedure lists that as a cause of dark brown everywhere once developed.`
      );
      const dev = dips(lab, run, ['ammonium-hydroxide-wash', 'development']);
      assert.deepEqual([bgOf(refDev), bgOf(dev)], [1, 2], `${minutes} min`);
      assert.ok(last(dev).rules.includes('R-react-long-ammoniacal'));
      assert.match(last(dev).text, /The long ammoniacal bath darkens the background too\.$/);
      // only the first development: a second one darkens by the usual one step
      assert.equal(bgOf(dip(lab, dev, 'development')), 3);
    }
    // the ammonia field is the ammonia setting
    const extra = dip(lab, ad, 'ammoniacal-silver', { ammonia: 'extra' });
    assert.equal(amm(extra).ammonia, 'extra');
    assert.ok(last(extra).rules.includes('R-react-ammonia-extra'));
    const cloudy = dip(lab, ad, 'ammoniacal-silver', { ammonia: 'cloudy' });
    assert.ok(last(cloudy).rules.includes('R-react-ammonia-cloudy'));
    assert.ok(lab.resolve(cloudy).artifacts.includes('grains'));
    // 37 °C: the procedure's effect, said to be currently unknown (test 50)
    assert.deepEqual(dip(lab, ad, 'ammoniacal-silver', { tempC: 37 }).state, ref.state);
  },
  // §13.2 tier 3: developer drops, time and temperature.
  53: lab => {
    const ready = dips(lab, freeSlide(lab), READY),
      dev = run => run.effectiveParams.development.development,
      ref = dip(lab, ready, 'development');
    assert.deepEqual(
      [maxOf(ref, 'deposit'), bgOf(ref), dev(ref).endpoint, dev(ref).strength],
      [3, 1, 'sop-default', 'sop-default']
    );
    const weak = dip(lab, ready, 'development', { drops: 1 });
    assert.deepEqual([dev(weak).strength, maxOf(weak, 'deposit'), bgOf(weak)], ['weak', 2, 1]);
    for (const drops of [6, 9]) {
      const run = dip(lab, ready, 'development', { drops });
      assert.deepEqual([dev(run).strength, maxOf(run, 'deposit'), bgOf(run)], ['strong', 3, 2], `${drops} drops`);
      assert.ok(last(run).rules.includes('R-react-dev-too-much'));
      assert.match(
        last(run).text,
        /Too much developer: the procedure lists that as a cause of dark brown everywhere\.$/
      );
    }
    const early = dip(lab, ready, 'development', { minutes: 0.5 });
    assert.deepEqual([dev(early).endpoint, maxOf(early, 'deposit'), bgOf(early)], ['early', 2, 1]);
    for (const minutes of [1, 5])
      assert.deepEqual(dip(lab, ready, 'development', { minutes }).state, ref.state, `${minutes} min`);
    const ten = dip(lab, ready, 'development', { minutes: 10 });
    assert.deepEqual(
      [dev(ten).endpoint, maxOf(ten, 'deposit'), bgOf(ten), ten.slide.pastTen],
      ['extended', 4, 2, false]
    );
    const fifteen = dip(lab, ready, 'development', { minutes: 15 });
    assert.deepEqual([dev(fifteen).endpoint, bgOf(fifteen), fifteen.slide.pastTen], ['extended', 3, true]);
    assert.equal(lab.lookOf(fifteen).key, 'dark-brown');
    assert.ok(last(fifteen).rules.includes('R-react-dev-past-ten'));
    assert.match(
      last(fifteen).text,
      /Past 10 minutes: the procedure stops by then, and too long means dark brown everywhere\./
    );
    const warm = dip(lab, ready, 'development', { tempC: 37 });
    assert.deepEqual([bgOf(warm), warm.slide.tooWarm, maxOf(warm, 'deposit')], [2, true, 3]);
    assert.match(
      last(warm).text,
      /Developed too warm: the procedure lists that as a cause of dark brown everywhere\.$/
    );
    assert.deepEqual(last(warm).unknown, []);
    const worst = dip(lab, ready, 'development', { tempC: 37, minutes: 15, drops: 9 });
    assert.deepEqual([bgOf(worst), lab.lookOf(worst).key], [4, 'dark-brown']);
    // no bound silver: the developer has nothing to reduce, whatever its settings
    const unbound = dip(lab, freeSlide(lab), 'deparaffinize-rehydrate'),
      none = dip(lab, unbound, 'development', { tempC: 37, minutes: 15, drops: 9 });
    assert.deepEqual([last(none).kind, last(none).rules, bgOf(none)], ['no-reaction', ['R-react-develop-none'], 0]);
  },
  // §13.2 tier 3: a short xylene change leaves the wax; the silver baths then go on patchy.
  54: lab => {
    for (const minutes of [1, 2]) {
      const short = dip(lab, freeSlide(lab), 'deparaffinize-rehydrate', { minutes });
      assert.deepEqual([short.slide.wax, short.slide.shortXylene], [true, true], `${minutes} min`);
      assert.deepEqual(pick(last(short), ['kind', 'text', 'rules']), {
        kind: 'reaction',
        text: 'Xylene too short: wax is left on the section, so later solutions will not reach it evenly.',
        rules: ['R-react-short-xylene'],
      });
      const silvered = dip(lab, short, 'silver-impregnation');
      assert.ok(last(silvered).rules.includes('R-react-wax-cap'));
      assert.ok(lab.resolve(silvered).artifacts.includes('patchy'));
      assert.equal(lab.lookOf(silvered).key, 'patchy');
      const cleaned = dip(lab, silvered, 'deparaffinize-rehydrate');
      assert.equal(cleaned.slide.wax, false);
      assert.match(last(cleaned).text, /The silver already went on unevenly under the wax, so the patchiness stays\.$/);
    }
    const long = dip(lab, freeSlide(lab), 'deparaffinize-rehydrate', { minutes: 10 });
    assert.deepEqual([long.slide.wax, long.slide.shortXylene, last(long).rules], [false, false, ['R-react-dewax']]);
    const again = dip(lab, long, 'deparaffinize-rehydrate', { minutes: 1 });
    assert.deepEqual([again.slide.shortXylene, last(again).rules], [false, ['R-react-dewax-repeat']]);
  },
  // §13.2: permanganate then oxalic acid before any silver pretreat; one step less background at development.
  55: lab => {
    const dewaxed = dip(lab, freeSlide(lab), 'deparaffinize-rehydrate'),
      ox = dip(lab, dewaxed, 'x1', { reagent: 'permanganate' }),
      r = last(ox);
    assert.deepEqual(pick(r, ['kind', 'text', 'rules', 'step', 'unknown', 'jarId', 'reagent']), {
      kind: 'reaction',
      text: 'Oxidized: the first half of the pretreatment. Oxalic acid completes it.',
      rules: ['R-react-permanganate'],
      step: null,
      unknown: [],
      jarId: 'x1',
      reagent: 'permanganate',
    });
    assert.deepEqual(r.claims.sort(), ['C-course-pretreat-blobs', 'C-intorcia-2019-pretreat']);
    assert.deepEqual([ox.slide.oxidized, ox.state, ox.stepsDone], [true, dewaxed.state, dewaxed.stepsDone]);
    const pre = dip(lab, ox, 'x2', { reagent: 'oxalic-acid' });
    assert.equal(
      last(pre).text,
      'Pretreated: in the published method this removes plaque-like artifact blobs and lowers the background. What it does to the real lesions is currently unknown.'
    );
    assert.deepEqual([last(pre).rules, pre.slide.pretreated, pre.state], [['R-react-oxalic'], true, dewaxed.state]);
    const rest = READY.slice(1).concat('development'),
      plain = dips(lab, dewaxed, rest),
      treated = dips(lab, pre, rest);
    assert.deepEqual([bgOf(plain), bgOf(treated)], [1, 0]);
    for (const site of TARGETS) assert.equal(treated.state[site].deposit, plain.state[site].deposit, site);
    assert.ok(last(treated).rules.includes('R-react-pretreated-background'));
    assert.match(last(treated).text, /The pretreatment keeps the background lighter\.$/);
    const out = lab.resolve(treated);
    assert.equal(out.contrast, lab.resolve(plain).contrast + 1);
    for (const id of ['C-intorcia-2019-pretreat', 'C-course-pretreat-blobs']) assert.ok(out.claims.includes(id), id);
    assert.ok(out.caveats.some(c => /what the pretreatment does to the real lesions is currently unknown/.test(c)));
    assert.equal(bgOf(dip(lab, treated, 'development')), 1, 'only the first development');
    // permanganate after the oxalic acid opens the pretreatment again until oxalic acid completes it
    const reopened = dip(lab, pre, 'x1', { reagent: 'permanganate' });
    assert.deepEqual([reopened.slide.oxidized, reopened.slide.pretreated], [true, false]);
    assert.equal(dip(lab, reopened, 'x2', { reagent: 'oxalic-acid' }).slide.pretreated, true);
    // a long ammoniacal bath and the pretreatment cancel at development
    const both = dips(lab, pre, [
      'silver-impregnation',
      'water-wash',
      ['ammoniacal-silver', { minutes: 30 }],
      'ammonium-hydroxide-wash',
      'development',
    ]);
    assert.equal(bgOf(both), 1);
  },
  // §13.2: the four handling choices.
  56: lab => {
    const dewaxed = dip(lab, freeSlide(lab), 'deparaffinize-rehydrate'),
      primed = dips(lab, dewaxed, ['silver-impregnation', 'water-wash']),
      ready = dips(lab, dewaxed, READY.slice(1)),
      grains = run => lab.resolve(run).artifacts.includes('grains'),
      patchy = run => lab.resolve(run).artifacts.includes('patchy'),
      METAL =
        'The procedure lists metal forceps in a silver solution as a cause of black grains, so the drawing shows it.',
      GLASS = 'The procedure lists ordinary glassware as a cause of black grains, so the drawing shows it.',
      DRY = 'The procedure lists a section left to dry as a cause of patchy staining, so the drawing shows it.',
      HALF = 'The procedure lists a half-filled jar as a cause of patchy staining, so the drawing shows it.';
    const metal = dip(lab, dewaxed, 'silver-impregnation', {}, { forceps: 'metal' }),
      plain = dip(lab, dewaxed, 'silver-impregnation');
    assert.deepEqual([metal.state, grains(metal), grains(plain)], [plain.state, true, false]);
    assert.equal(last(metal).text, `${last(plain).text} ${METAL}`);
    assert.ok(last(metal).rules.includes('R-react-handling-grains'));
    assert.ok(last(metal).claims.includes('C-course-trouble-grains'));
    const glass = dip(lab, ready, 'development', {}, { glass: 'ordinary' });
    assert.ok(grains(glass) && last(glass).text.endsWith(GLASS));
    const both = dip(lab, primed, 'ammoniacal-silver', {}, { forceps: 'metal', glass: 'ordinary' });
    assert.ok(last(both).text.endsWith(`${METAL} ${GLASS}`));
    // not a silver solution: no grains
    for (const [start, jarId, patch] of [
      [primed, 'water-wash', {}],
      [dewaxed, 'x1', { reagent: 'permanganate' }],
      [ready, 'ammonium-hydroxide-wash', {}],
    ]) {
      const run = dip(lab, start, jarId, patch, { forceps: 'metal', glass: 'ordinary' });
      assert.ok(!grains(run) && !last(run).rules.includes('R-react-handling-grains'), jarId);
    }
    // a developer in a fresh jar is currently unknown: the handling never applies
    assert.ok(!grains(dip(lab, ready, 'development', { into: 'fresh-jar' }, { forceps: 'metal' })));
    // patchy: any dip that reacts
    const dried = dip(lab, primed, 'water-wash', {}, { between: 'let-dry' });
    assert.ok(patchy(dried) && last(dried).text.endsWith(DRY));
    assert.equal(lab.lookOf(dried).key, 'patchy');
    const half = dip(lab, primed, 'ammonium-hydroxide-wash', {}, { fill: 'half' });
    assert.ok(patchy(half) && last(half).text.endsWith(HALF));
    const permHalf = dip(lab, dewaxed, 'x1', { reagent: 'permanganate' }, { between: 'let-dry', fill: 'half' });
    assert.ok(patchy(permHalf) && last(permHalf).text.endsWith(`${DRY} ${HALF}`));
    assert.ok(last(permHalf).rules.includes('R-react-handling-patchy'));
    // the procedure's handling, or a value the shelf does not list, changes nothing
    for (const handling of [
      { forceps: 'plastic', glass: 'acid-cleaned', between: 'kept-wet', fill: 'full' },
      { forceps: 'gold', glass: 'cracked' },
      {},
    ]) {
      const run = dip(lab, dewaxed, 'silver-impregnation', {}, handling);
      assert.deepEqual(
        [run.state, run.slide, last(run)],
        [plain.state, plain.slide, last(plain)],
        JSON.stringify(handling)
      );
    }
  },
  // §13.2: a dip of each procedure jar at its defaults equals that jar's step event.
  57: lab => {
    const J = lab.procedureJars(),
      same = (a, b, jarId, label) => {
        for (const key of [...RUN_RECORD, 'params', 'unknownDips'])
          assert.deepEqual(b[key], a[key], `${label}: ${key}`);
        assert.deepEqual(lab.lookOf(b), lab.lookOf(a), `${label}: look`);
        assert.deepEqual(pick(last(b), REACTION_FIELDS), pick(last(a), REACTION_FIELDS), `${label}: reaction`);
        assert.deepEqual([last(b).jarId, last(b).reagent, last(b).unknown], [jarId, J[jarId].reagent, []], label);
        assert.deepEqual(
          Object.keys(last(b)).sort(),
          [...REACTION_FIELDS, 'jarId', 'reagent', 'unknown'].sort(),
          label
        );
        assert.deepEqual(
          Object.keys(last(a)).sort(),
          [...REACTION_FIELDS].sort(),
          `${label}: a step event's reaction is as before`
        );
      };
    const scrambled = [
      'silver-impregnation',
      'deparaffinize-rehydrate',
      'ammoniacal-silver',
      'development',
      'silver-impregnation',
      'water-wash',
      'ammoniacal-silver',
      'ammonium-hydroxide-wash',
      'development',
      'development',
      'gold-toning',
      'gold-toning',
      'sodium-thiosulfate',
      'development',
      'final-wash-dehydrate-clear-mount',
      'water-wash',
      'deparaffinize-rehydrate',
    ];
    for (const specimenId of ['SPEC-SYN-AD-01', 'SPEC-SYN-AD-02', 'SPEC-SYN-NEG-01', 'SPEC-SYN-LOWCHEM-01']) {
      for (const stepId of S.STEPS) {
        const fresh = freeSlide(lab, specimenId);
        same(stepOf(lab, fresh, stepId), dip(lab, fresh, stepId), stepId, `${specimenId} ${stepId} alone`);
        const before = S.STEPS.slice(0, S.STEPS.indexOf(stepId)).reduce(
          (r, s) => stepOf(lab, r, s),
          freeSlide(lab, specimenId)
        );
        same(stepOf(lab, before, stepId), dip(lab, before, stepId), stepId, `${specimenId} ${stepId} in order`);
      }
      for (const order of [S.STEPS, scrambled]) {
        let a = freeSlide(lab, specimenId),
          b = a;
        for (const [i, stepId] of order.entries()) {
          a = stepOf(lab, a, stepId);
          b = dip(lab, b, stepId);
          same(a, b, stepId, `${specimenId} #${i} ${stepId}`);
        }
        const strip = out => ({ ...out, reactions: out.reactions.map(r => pick(r, REACTION_FIELDS)) });
        assert.deepEqual(strip(lab.resolve(b)), strip(lab.resolve(a)), `${specimenId} resolve`);
        const fa = lab.replay(a),
          fb = lab.replay(b);
        fa.forEach((f, i) =>
          assert.deepEqual(
            pick(fb[i], ['seq', 'stepsDone', 'state', 'rulesFired', 'deviationsSoFar', 'slide', 'look']),
            pick(f, ['seq', 'stepsDone', 'state', 'rulesFired', 'deviationsSoFar', 'slide', 'look']),
            `${specimenId} frame ${i}`
          )
        );
      }
    }
  },
  // §13.2: free runs of step events (older saves included) are as before.
  58: lab => {
    const run = freeRun(lab, [...S.STEPS.slice(0, 6), 'development', ...S.STEPS.slice(6)]);
    assert.ok(run.reactions.every(r => !('jarId' in r) && !('unknown' in r) && !('reagent' in r)));
    assert.deepEqual(run.unknownDips, []);
    for (const flag of Object.keys(SHELF_FLAGS)) assert.equal(run.slide[flag], false, flag);
    assert.ok(!run.rulesApplied.some(id => SHELF_RULES.includes(id)));
    const out = lab.resolve(run);
    assert.deepEqual([out.unknownDips, out.unknownFields], [[], []]);
    assert.deepEqual(Object.keys(out.slide), ['wax', 'coverslipped', 'fixed', 'toned', 'unfixed']);
    const old = clone(run);
    delete old.unknownDips;
    for (const flag of Object.keys(SHELF_FLAGS)) delete old.slide[flag];
    assert.deepEqual(lab.resolve(old), out);
    assert.deepEqual(lab.replay(old), lab.replay(run));
    // an older unmounted save takes a dip (the mounted one is sealed for every bottle)
    const open = clone(freeRun(lab, S.STEPS.slice(0, 6)));
    delete open.unknownDips;
    for (const flag of Object.keys(SHELF_FLAGS)) delete open.slide[flag];
    const more = lab.applyEvent(open, { seq: 99, type: 'dip', jarId: 'x1', solution: { reagent: 'tap-water' } });
    assert.deepEqual([last(more).kind, more.unknownDips.length], ['unknown', 1]);
    assert.deepEqual(pick(more.slide, Object.keys(SHELF_FLAGS)), SHELF_FLAGS);
    assert.equal(
      last(lab.applyEvent(old, { seq: 99, type: 'dip', jarId: 'x1', solution: { reagent: 'tap-water' } })).kind,
      'sealed'
    );
    // the shelf's rules never fire on a step event, whatever the run's settings
    for (const params of [
      { impregnation: { endpoint: 'early', temperature: 'deviated' } },
      { ammoniacal: { ammonia: 'cloudy', endpoint: 'early' } },
      { development: { endpoint: 'extended', strength: 'strong' } },
    ]) {
      const r = freeRun(lab, [...S.STEPS, 'development', 'silver-impregnation'], params);
      assert.ok(!r.rulesApplied.some(id => SHELF_RULES.includes(id)), JSON.stringify(params));
    }
  },
  // §13.2: a practice run never takes a dip; compare-only runs neither.
  59: lab => {
    const J = lab.procedureJars();
    let p = perform(lab, lab.createRun({ id: 'p', specimenId: 'SPEC-SYN-AD-01' }), S.STEPS.slice(0, 3));
    const before = clone(p);
    p = lab.applyEvent(p, {
      seq: 50,
      type: 'dip',
      jarId: 'ammoniacal-silver',
      solution: J['ammoniacal-silver'],
      handling: { forceps: 'metal' },
    });
    assert.deepEqual(p.deviations[p.deviations.length - 1], {
      seq: 50,
      kind: 'not-runnable',
      step: 'ammoniacal-silver',
      jarId: 'ammoniacal-silver',
    });
    for (const key of ['state', 'slide', 'stepsDone', 'reactions', 'rulesApplied', 'effectiveParams', 'unknownDips'])
      assert.deepEqual(p[key], before[key], key);
    assert.equal(p.events.length, before.events.length + 1);
    const full = S.STEPS.slice(3).reduce((r, s) => stepOf(lab, r, s), p),
      plain = fullRun(lab, 'q', 'SPEC-SYN-AD-01'),
      a = lab.resolve(full),
      b = lab.resolve(plain);
    assert.equal(a.label, S.LABELS.SYNTHETIC);
    for (const key of [
      'state',
      'perSite',
      'contrast',
      'background',
      'artifacts',
      'rulesApplied',
      'claims',
      'caveats',
      'look',
      'tone',
      'slide',
    ])
      assert.deepEqual(a[key], b[key], key);
    assert.deepEqual(a.deviations, [
      { seq: 50, kind: 'not-runnable', step: 'ammoniacal-silver', jarId: 'ammoniacal-silver' },
    ]);
    assert.ok(!('unknownDips' in a) && !('reactions' in a));
    assert.ok(lab.replay(full).every(f => f.reaction === null));
    const tap = lab.applyEvent(lab.createRun({ id: 't', specimenId: 'SPEC-SYN-AD-01' }), {
      seq: 1,
      type: 'dip',
      jarId: 'x1',
      solution: { reagent: 'tap-water' },
    });
    assert.deepEqual(tap.deviations, [{ seq: 1, kind: 'not-runnable', step: null, jarId: 'x1' }]);
    const cps = lab.applyEvent(
      lab.createRun({ id: 'c', specimenId: 'SPEC-SYN-AD-01', method: 'cps-i', mode: 'free' }),
      {
        seq: 1,
        type: 'dip',
        jarId: 'silver-impregnation',
        solution: J['silver-impregnation'],
      }
    );
    assert.deepEqual([cps.deviations.map(d => d.kind), cps.reactions], [['not-runnable'], []]);
  },
  // §13.2: the export prints each dip with its jar and contents, and one line per currently unknown dip.
  60: lab => {
    const shelfRun = {
        ...dips(lab, freeSlide(lab), [
          'deparaffinize-rehydrate',
          ['x1', { reagent: 'tap-water' }],
          ['silver-impregnation', { tempC: 37 }],
          ['development', { into: 'fresh-jar' }],
        ]),
        id: 'shelf',
      },
      plainRun = { ...dips(lab, freeSlide(lab), ['deparaffinize-rehydrate']), id: 'plain' },
      practice = lab.applyEvent(lab.createRun({ id: 'prac', specimenId: 'SPEC-SYN-AD-01' }), {
        seq: 1,
        type: 'dip',
        jarId: 'x2',
        solution: { reagent: 'permanganate' },
      }),
      titles = {
        'deparaffinize-rehydrate': 'Remove the wax',
        'silver-impregnation': 'First silver bath',
        development: 'Develop',
      },
      runsById = { shelf: shelfRun, plain: plainRun, prac: practice },
      md = lab.exportNotebook(
        {
          notebook: lab.newNotebook(),
          experiments: [experiment('plain', 'shelf'), { ...experiment('prac', 'plain'), id: 'exp-2' }],
          runsById,
        },
        { stepTitle: id => titles[id] || id }
      ),
      lines = md.split('\n');
    for (const line of [
      '1. Dip, Remove the wax jar: Xylene and ethanol series · 5 min per xylene change. Wax removed; the section is wet and even, in water.',
      '2. Dip, extra 1 jar: Tap water · 3 min. Currently unknown reaction: tap water · 3 min on this slide.',
      "3. Dip, First silver bath jar: 20% silver nitrate · 20 min · 37 °C · in the dark. Silver bound to the section: faintly yellow to light brown by eye; nothing specific under the microscope yet. Currently unknown: what 37 °C silver nitrate changes; the drawing shows the procedure's effect. The procedure lists 37 °C for 15 min as an experiment the class may run.",
      '- Currently unknown reaction: Tap water · 3 min (event 2), left out of the drawing',
      '- Currently unknown reaction: Developer · 3 drops per 50 ml · 3 min · room temperature · in the dark · in a fresh jar with no silver (event 4), left out of the drawing',
      '- Deviations: not-runnable extra 2 jar',
    ])
      assert.ok(lines.includes(line), line);
    assert.equal(lines.filter(l => l.startsWith('- Currently unknown reaction: ')).length, 2, 'the shelf run only');
    markdownCheck(md);
    studentPartClean(md);
    resultCheck(md);
  },
  // §13.1 lint: the shipped shelf passes both lints; a broken shelf fails; the new rules, claims and source.
  61: (lab, content) => {
    assert.deepEqual(S.lint(content), []);
    const R = (c, id) => c.reagents.items.find(r => r.id === id),
      broken = (mutate, code = 'reagent-invalid') => {
        const c = clone(content);
        mutate(c);
        const codes = S.lint(c).map(p => p.code);
        assert.ok(codes.includes(code), `${code}: got ${JSON.stringify(codes)}`);
        assert.throws(() => S.createLab(c), S.ContentError);
      };
    broken(c => (R(c, 'tap-water').step = 'rinse'));
    broken(c => (R(c, 'tap-water').group = 'kitchen'));
    broken(c => (R(c, 'silver-nitrate').fields.minutes.default = 25));
    broken(c => (R(c, 'silver-nitrate').fields.colour = { values: ['x'], default: 'x', words: { x: 'x' } }));
    broken(c => (c.reagents.jars['water-wash'] = { reagent: 'tap-water', minutes: 3 }));
    broken(c => (c.reagents.jars['water-wash'] = { reagent: 'nope' }));
    broken(c => (c.reagents.handling[0].id = 'gloves'));
    broken(c => (c.reagents.handling[1].default = 'plastic'));
    broken(c => (R(c, 'tap-water').claims = ['C-nope']), 'unknown-claim');
    broken(c => (R(c, 'tap-water').unknownWhy = 'Pour it down the drain.'), 'forbidden-disposal-phrase');
    assert.ok(S.LINT_CODES.includes('reagent-invalid'));
    // scripts/check-lab-content.cjs on the shipped files and on a broken shelf
    const check = require(path.join(__dirname, 'check-lab-content.cjs')),
      { content: files, problems } = check.loadLabContent();
    assert.deepEqual(problems, []);
    assert.deepEqual(check.lintLabContent(files), []);
    assert.ok(check.FILES.includes('reagents'));
    assert.deepEqual(
      files.methods.stations.map(s => s.id),
      ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9']
    );
    assert.deepEqual(files.methods.stations[8], { id: 'S9', title: 'Your jars', studentTitle: 'Your jars', steps: [] });
    assert.deepEqual(lab.listStations()[8], { id: 'S9', title: 'Your jars', studentTitle: 'Your jars', steps: [] });
    const codes = mutate => {
      const c = clone(files);
      mutate(c);
      return check.lintLabContent(c).map(p => p.code);
    };
    const expect = (code, mutate) => assert.ok(codes(mutate).includes(code), code);
    expect('student-text-too-long', c => (R(c, 'tap-water').unknownWhy = Array(31).fill('word').join(' ')));
    expect('schema', c => delete R(c, 'formic-acid').unknownWhy);
    expect('schema', c => delete R(c, 'developer').unknownWhy);
    expect('reagent-invalid', c => (c.reagents.jars['silver-impregnation'].minutes = 30));
    expect('reagent-invalid', c => delete c.reagents.jars['gold-toning']);
    expect('reagent-invalid', c => (c.reagents.jars['gold-toning'].colour = 'gold'));
    expect('reagent-invalid', c => (R(c, 'tap-water').fields.minutes.words['3'] = '3 min (procedure)'));
    expect('reagent-invalid', c => (R(c, 'silver-nitrate').fields.minutes.words['20'] = '20 min'));
    expect('reagent-invalid', c => (R(c, 'silver-nitrate').fields.minutes.words['30'] = '30 min (procedure)'));
    expect(
      'reagent-invalid',
      c => (R(c, 'copper-sulfate').fields.strength = { values: [5], default: 5, words: { 5: '5%' } })
    );
    expect('reagent-invalid', c => c.reagents.handling.reverse());
    expect('reagent-invalid', c => (R(c, 'permanganate').step = 'water-wash'));
    expect('step-unknown', c => (R(c, 'silver-nitrate').step = 'rinse'));
    expect('required-id-missing', c => (c.reagents.items = c.reagents.items.filter(r => r.id !== 'formic-acid')));
    expect('forbidden-disposal-phrase', c => (R(c, 'tap-water').fields.minutes.words['1'] = '1 min, then the sink'));
    expect('station-unknown', c => (c.methods.stations[8].steps = ['water-wash']));
    expect('student-text-limit', c => (R(c, 'tap-water').short = 'Tap water (pending)'));
    // every shelf rule: free bench only, step or dip, a react op, claims that exist
    for (const id of SHELF_RULES) {
      const r = lab.getRule(id);
      assert.ok(r, id);
      assert.ok(
        r.when.all.some(w => w.mode === 'free'),
        id
      );
      assert.ok(
        r.effect.some(op => op.op === 'react'),
        id
      );
      assert.ok(r.claims.length >= 1 && r.claims.every(c => lab.getClaim(c)), id);
      assert.doesNotMatch(r.title, /\b(pending|v1|schematic|ordinal|param|SOP)\b/i, id);
    }
    const intorcia = lab.getSource('S-intorcia-2019');
    assert.match(
      intorcia.citation,
      /^Intorcia AJ, Filon JR, Hoffman B, Serrano GE, Sue LI, Beach TG\. .*bioRxiv 2019 \(preprint/
    );
    assert.deepEqual(
      [intorcia.type, intorcia.rights, intorcia.verified.level],
      ['peer-reviewed', 'cite-only', 'abstract']
    );
    const quote =
      'pretreatment with oxidizing agents prior to the initial incubation in silver nitrate eliminates these artifacts and reduces the commonly observed high background staining';
    assert.ok(lab.getClaim('C-intorcia-2019-pretreat').text.includes(`"${quote}"`));
    assert.ok(quote.split(' ').length <= 25);
    assert.deepEqual(lab.getClaim('C-intorcia-2019-pretreat').sources, ['S-intorcia-2019']);
    const alternatives = lab.getClaim('C-course-alternatives'),
      altQuote =
        'impregnation at 37 °C for 15 min instead of 20 min at room temperature; a cold 5 °C impregnation; 10% silver nitrate for 30 min';
    assert.deepEqual([alternatives.sources, alternatives.strength], [['S-course-procedure'], 'course-handout']);
    assert.ok(alternatives.text.includes(`"${altQuote}"`));
    assert.ok(altQuote.split(' ').length <= 25);
    const blobs = lab.getClaim('C-course-pretreat-blobs');
    assert.deepEqual([blobs.sources, blobs.strength], [['S-course-procedure'], 'course-handout']);
    assert.ok(
      blobs.text.includes(
        '"Pretreating with 0.25% potassium permanganate 2 min then 2% oxalic acid 2 min (3 water washes of 1 min after each) before step 2 removes them"'
      )
    );
  },
  // §13.2: replay frames of dips, and resolve's unknown lists after a save round trip.
  62: lab => {
    const run = dips(lab, freeSlide(lab), [
        'deparaffinize-rehydrate',
        ['x1', { reagent: 'permanganate' }],
        ['x2', { reagent: 'formic-acid' }],
        ['silver-impregnation', { tempC: 5, minutes: 30 }],
        'water-wash',
        ['ammoniacal-silver', { minutes: 30, tempC: 37 }],
        'ammonium-hydroxide-wash',
        ['development', { minutes: 10 }, { between: 'let-dry' }],
      ]),
      frames = lab.replay(run);
    assert.equal(frames.length, run.events.length);
    frames.forEach((f, i) => assert.deepEqual(f.reaction, run.reactions[i], `frame ${i}`));
    assert.deepEqual([frames[7].state, frames[7].slide, frames[7].look], [run.state, run.slide, lab.lookOf(run).key]);
    assert.deepEqual(
      [frames[2].state, frames[2].slide, frames[2].rulesFired, frames[2].reaction.kind],
      [frames[1].state, frames[1].slide, [], 'unknown']
    );
    const out = lab.resolve(run);
    assert.deepEqual(out.unknownDips, [{ seq: 3, jarId: 'x2', solution: { reagent: 'formic-acid', minutes: 5 } }]);
    assert.deepEqual(
      out.unknownFields.map(u => [u.seq, u.jarId, u.reagent, u.field, u.value]),
      [
        [4, 'silver-impregnation', 'silver-nitrate', 'tempC', 5],
        [6, 'ammoniacal-silver', 'ammoniacal-silver', 'tempC', 37],
      ]
    );
    assert.deepEqual([out.label, out.confidence, out.reactions], [S.LABELS.SYNTHETIC, 'low', run.reactions]);
    assert.ok(out.artifacts.includes('patchy'));
    assert.deepEqual(lab.resolve(S.deserialize(S.serialize(run))), out);
    assert.deepEqual([run.slide.oxidized, run.slide.pretreated, run.slide.longAmmoniacal], [true, false, true]);
  },
};
// §12.1 real reference slide (schema of contract §12.1) that cites the first registered source and specimen
// of whatever content it is built for; the src is not resolved by the engine (the content check reads the file).
function referenceAsset(content) {
  return {
    id: 'A-ref-fixture',
    kind: 'reference-image',
    label: S.LABELS.OBSERVED,
    src: '/assets/lab/reference/fixture.jpg?v=1',
    width: 400,
    height: 300,
    specimenId: content.specimens.items[0].id,
    role: 'positive',
    looks: ['black-on-tan', 'gray-black'],
    stain: 'Bielschowsky silver stain',
    region: 'frontal cortex',
    tissue: "Alzheimer's disease, autopsy",
    shows: ['neuritic plaques'],
    scale: 'scale bar 100 µm',
    magnification: null,
    description: 'Real slide: a fixture entry; not a photo.',
    sourceId: content.sources.items[0].id,
    figure: 'Fig. 1, panel a',
    rights: {
      status: 'cc-by-4.0',
      holder: 'fixture',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      changes: 'none',
    },
  };
}
const TITLES = {
  1: 'lint is clean on good content and every code fails a mutated fixture',
  2: 'full Bielschowsky run at sop-default on SPEC-SYN-AD-01',
  3: 'binding is not development',
  4: 'intensity is not amount',
  5: 'negative comparison still stains axons',
  6: 'uncertainty cards with precedence and every gap listed',
  7: 'no code path emits the reserved third label',
  8: 'out-of-order and repeated steps become protocol-deviation artifacts',
  9: 'temperature deviation lowers confidence without an uncertainty card',
  10: 'compare() labels, deltas, rules responsible and the cross-method case',
  11: 'reveal gate and hypothesis-conditional cards',
  12: 'cps-i / cps-ii resolve to schematic compare-only outcomes',
  13: 'export wording, section order and the mechanical result check',
  14: 'serialize is stable and deserialize checks the version',
  15: 'engine source is deterministic and a classic script',
  16: 'reserved-label guards in addEntry, deserialize and export',
  17: 'replay frames match resolve and never become a card',
  18: 'stations, explainStep hazards and undefined lookups',
  19: 'tissue clip: getClip, fixed scene order, structure sub-captions, optional file',
  20: 'export formatters: stored default export, name line, where each applies, reserved label, result check',
  21: 'export v2: three-line answers, settings and events, five more formatters, summary and model detail',
  22: 'export isSealed: a sealed run prints no outcome, no model detail and no claims of its own',
  23: 'export v3: Markdown lists, designer field names, ids only for instructors, Sources, Model readout',
  24: 'skipping gold toning or thiosulfate: step not required, not-planned when done, Not modeled',
  25: 'export: skipped-step lines, runs not chosen yet, ordinal measurements in words',
  26: 'modes: createRun({ mode }), slide and reactions on every run, older saves load as practice',
  27: 'free bench: one Reaction per step event, none for set-params, replay frames carry reaction / slide / look',
  28: 'free bench: a mounted slide is sealed, every later step a sealed no-reaction that changes nothing',
  29: 'free bench: dewax, and a repeat is a real no-reaction',
  30: 'free bench: wax left on caps binding at trace and makes the slide patchy',
  31: 'free bench: first bath only then develop is light detail; no silver then develop is no reaction',
  32: 'free bench: thiosulfate before development returns the slide to unstained; the developer then has nothing',
  33: 'free bench: gold toning with no deposit, after development (gray-black), and again',
  34: 'free bench: development again adds one step everywhere and dark brown when it crosses',
  35: 'free bench: extra ammonia weakens the binding, a cloudy bath leaves grains',
  36: 'free bench: mounting seals the slide; unfixed when unreduced silver is still in it',
  37: 'free bench: never out-of-order, gaps for settings with no rule, never a card',
  38: 'practice: ammonia leaf covered, cloudy grains, flags false resolve with caveats, gold tone, no no-effect-v1',
  39: 'lint: mode / event predicates and the new ops accepted; every R-react rule has a claim and mode free',
  40: 'exports: LOOKS, LOOK_COLORS, LOOK_KEYS, REACTION_KINDS, lookOf, no forbidden words in reactions',
  41: 'export of a free run: bench line, reactions on the step lines, toning / thiosulfate from the slide',
  42: 'MODE-FIX-engine: look from the state, no-change causes, develop sentences, late dewax, free first-bath time, no first bath, whys, no dead link',
  43: 'MODE-FIX-integrate: explainStep mode: the practice model by default, every free-bench branch for free',
  44: 'real reference slides: a valid reference-image passes lint, a bad look or a missing source fails',
  45: 'shelf API: listReagents, getReagent, procedureJars, handlingChoices, solutionText, isProcedureSolution',
  46: 'no shelf: without reagents.json every dip is a currently unknown reaction; practice still not-runnable',
  47: 'tier 1: tap water, formic acid, copper sulfate, hydrogen peroxide are currently unknown and change nothing',
  48: 'tier 1 by context: developer in a fresh jar, permanganate or oxalic acid on silver, oxalic acid alone',
  49: 'sealed slide: every dip is the sealed no-reaction, with no unknown sentence and no change',
  50: 'tier 2: strength, temperature, light, long ammonia water, gold and thiosulfate times are partly unknown',
  51: 'tier 3: silver nitrate early / extended, old silver nitrate binds 2 less in the ammoniacal bath',
  52: 'tier 3: ammoniacal silver short, long (background +1 at development), ammonia field, 37 °C',
  53: 'tier 3: developer drops 1 / 6 / 9, 30 s / 10 / 15 min, 37 °C, nothing to reduce',
  54: 'tier 3: a short xylene change leaves the wax and the silver baths go on patchy',
  55: 'pretreatment: permanganate then oxalic acid before silver, background one step lower at development',
  56: 'handling: metal forceps or ordinary glass on a silver dip gives grains; dried or half-filled gives patchy',
  57: 'nine-jar equivalence: a dip of each procedure jar at its defaults equals that step event',
  58: 'free runs of step events and older saves are unchanged by the shelf',
  59: 'practice and compare-only: a dip records not-runnable and changes nothing',
  60: 'export: dip lines name the jar and contents, a Currently unknown reaction line per unknown dip',
  61: 'lint: the shelf passes both lints, a broken shelf fails, the shelf rules, claims and source',
  62: 'replay frames of dips, resolve unknownDips / unknownFields, save round trip',
};
function register(name, content, numbers) {
  describe(name, () => {
    const lab = S.createLab(content);
    for (const n of numbers) test(`${n}. ${TITLES[n]}`, () => T[n](lab, content));
  });
}

// §11 tests that need the shipped reaction rules (R-react-*) run on the shipped data below; the
// fixture carries the strict additions only.
const SHIPPED_ONLY = [
  27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 41, 42, 43, 45, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
  61, 62,
];
register(
  'fixture content',
  fixture(),
  Object.keys(T)
    .map(Number)
    .filter(n => !SHIPPED_ONLY.includes(n))
);

// reagents.json (§13.1) is a content file the shelf tests need; createLab still accepts content without it.
const FILES = ['sources', 'claims', 'rules', 'methods', 'specimens', 'safety', 'modules', 'assets', 'reagents'];
const dataDir = path.join(ROOT, 'data', 'lab');
const missing = FILES.filter(f => !fs.existsSync(path.join(dataDir, `${f}.json`)));
if (missing.length) {
  test(
    `shipped data/lab/*.json (skipped: missing ${missing.map(f => `${f}.json`).join(', ')})`,
    { skip: true },
    () => {}
  );
} else {
  const shipped = Object.fromEntries(
    FILES.map(f => [f, JSON.parse(fs.readFileSync(path.join(dataDir, `${f}.json`), 'utf8'))])
  );
  // clip.json is optional for createLab (the shell fetches it separately) but linted when present.
  const clipPath = path.join(dataDir, 'clip.json');
  if (fs.existsSync(clipPath)) shipped.clip = JSON.parse(fs.readFileSync(clipPath, 'utf8'));
  describe('shipped data/lab/*.json', () => {
    test('lint is clean', () => assert.deepEqual(S.lint(shipped), []));
    test('§12.1: 11 real reference slides pass lint', () => {
      const refs = shipped.assets.items.filter(a => a.kind === 'reference-image');
      assert.equal(refs.length, 11);
      assert.equal(shipped.assets.items.length, 11);
      const sourceIds = new Set(shipped.sources.items.map(s => s.id));
      for (const a of refs) {
        assert.equal(a.label, S.LABELS.OBSERVED, a.id);
        assert.ok(a.looks.length && a.looks.every(key => S.LOOK_KEYS.includes(key)), `${a.id} looks`);
        assert.ok(sourceIds.has(a.sourceId), `${a.id} source`);
        assert.notEqual(a.rights.status, 'unknown', a.id);
      }
      const lab = S.createLab(shipped);
      assert.equal(lab.content.assets.items.length, 11);
      assert.ok(Object.isFrozen(lab.content.assets.items));
      for (const a of refs) assert.ok(lab.getSource(a.sourceId), `${a.id} getSource`);
    });
  });
  register(
    'shipped data/lab/*.json: contract tests 1, 2, 4, 5, 6, 12, 24, 26 to 43, 45 to 62' + (shipped.clip ? ', 19' : ''),
    shipped,
    [1, 2, 4, 5, 6, 12, 24, ...(shipped.clip ? [19] : []), 26, 38, 39, 40, 46, ...SHIPPED_ONLY]
  );
}
