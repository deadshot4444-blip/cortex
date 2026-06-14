export const meta = {
  name: 'mcat-science-passages-gen',
  description: 'Generate + verify AAMC-style science passages (research/data) with question sets',
  phases: [
    { title: 'Write', detail: 'one author per passage' },
    { title: 'Verify', detail: 'check answer keys, data consistency, passage-grounding' },
  ],
}

const SPECS = [
  { key: 'cp1', section: 'chemPhys', cats: '4A', topic: 'a mechanics experiment (projectile or inclined-plane): students vary one parameter and measure range/time/acceleration', table: true },
  { key: 'cp2', section: 'chemPhys', cats: '5A,5E', topic: 'a weak-acid/buffer titration: pH measured vs volume of titrant added', table: true },
  { key: 'cp3', section: 'chemPhys', cats: '5E', topic: 'a reaction-kinetics study: initial rate measured at varied reactant concentrations', table: true },
  { key: 'cp4', section: 'chemPhys', cats: '4C,4D', topic: 'a circuits or optics lab: measured current/voltage across a network, or image distance vs object distance for a lens', table: true },
  { key: 'cp5', section: 'chemPhys', cats: '5C,5D,5B', topic: 'an organic chemistry separation + spectroscopy scenario (extraction/chromatography then IR/NMR/MS data to identify a product)', table: false },
  { key: 'cp6', section: 'chemPhys', cats: '4C,5E', topic: 'an electrochemistry/thermochemistry scenario: a galvanic cell with measured potentials, or calorimetry data', table: true },
  { key: 'bb1', section: 'bioBiochem', cats: '1A', topic: 'an enzyme-kinetics experiment: initial velocity vs [substrate] with and without an inhibitor', table: true },
  { key: 'bb2', section: 'bioBiochem', cats: '1B', topic: 'a molecular-biology study: a gene knockdown/mutation with a described Western blot or RT-qPCR result', table: true },
  { key: 'bb3', section: 'bioBiochem', cats: '2A', topic: 'a membrane-transport or cell-biology experiment: solute uptake measured under varied conditions (temperature, inhibitor, gradient)', table: true },
  { key: 'bb4', section: 'bioBiochem', cats: '3A,3B', topic: 'a physiology study: a hormone or organ-system response measured across conditions (e.g., glucose/insulin, GFR, ventilation)', table: true },
  { key: 'bb5', section: 'bioBiochem', cats: '1C', topic: 'a genetics study: a pedigree or allele/genotype frequencies in a population (Hardy-Weinberg)', table: true },
  { key: 'bb6', section: 'bioBiochem', cats: '1D', topic: 'a metabolism study: substrate utilization or respiratory exchange measured during fasting/exercise', table: true },
  { key: 'ps1', section: 'psychSoc', cats: '7A', topic: 'a memory/learning experiment: recall or response measured across experimental conditions', table: true },
  { key: 'ps2', section: 'psychSoc', cats: '6A,6B', topic: 'a sensation/perception or cognition study: thresholds, reaction time, or accuracy across conditions', table: true },
  { key: 'ps3', section: 'psychSoc', cats: '7B,7C', topic: 'a social-psychology experiment: conformity, attitudes, or persuasion measured across groups', table: true },
  { key: 'ps4', section: 'psychSoc', cats: '9C,10A,10B', topic: 'a sociology study: social stratification or health disparities with demographic data', table: true },
  { key: 'ps5', section: 'psychSoc', cats: '6C,7A', topic: 'a developmental or motivation/emotion study with outcomes measured across groups or ages', table: true },
  { key: 'ps6', section: 'psychSoc', cats: '8A', topic: 'a health-behavior or clinical-psychology study: a treatment/intervention outcome across conditions', table: true },
]

const SCHEMA = {
  type: 'object',
  required: ['section', 'title', 'type', 'text', 'questions'],
  properties: {
    section: { type: 'string', enum: ['chemPhys', 'bioBiochem', 'psychSoc'] },
    title: { type: 'string' },
    type: { type: 'string', enum: ['research', 'data', 'conceptual'] },
    text: { type: 'string', description: 'the passage, ~250-360 words, paragraphs separated by \\n\\n; describe methods + findings; refer to the table/figure as "Table 1"/"Figure 1" if present' },
    table: {
      type: 'object', description: 'optional data table',
      required: ['caption', 'headers', 'rows'],
      properties: { caption: { type: 'string' }, headers: { type: 'array', items: { type: 'string' } }, rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } } },
    },
    questions: {
      type: 'array', minItems: 4, maxItems: 6,
      items: {
        type: 'object',
        required: ['stem', 'options', 'answer', 'explanation', 'distractors', 'skill', 'category', 'difficulty'],
        properties: {
          stem: { type: 'string' },
          options: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string' } },
          answer: { type: 'integer' },
          explanation: { type: 'string', description: '80-140 words' },
          distractors: { type: 'array', items: { type: 'object', required: ['i', 'why'], properties: { i: { type: 'integer' }, why: { type: 'string' } } } },
          skill: { type: 'string', enum: ['skill-1', 'skill-2', 'skill-3', 'skill-4'] },
          category: { type: 'string' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        },
      },
    },
  },
}

function writePrompt(s) {
  return `You are writing an ORIGINAL AAMC-style MCAT science passage with its question set (like a real ${s.section} passage). The passage presents a scenario; questions are answered using the passage PLUS testable MCAT content knowledge.

Section: ${s.section}
Scenario: ${s.topic}
Relevant AAMC content categories: ${s.cats}

Write:
- title: short.
- type: "research" (experiment with methods) or "data" (data-heavy).
- text: ~250-360 word original passage describing the setup, method, and findings. Reference "Table 1" / "Figure 1" where used. Original prose; realistic but invented data.
${s.table ? '- table: a data table {caption, headers[], rows[][]} with realistic numbers the questions will require interpreting (4-6 rows).' : '- (no table needed; you may describe spectra/figures in the text, e.g., IR peaks, NMR shifts.)'}
- questions: 5 questions answerable from the passage + standard MCAT knowledge. INCLUDE at least one skill-3 (research design: variables, controls, validity, confounds) and one skill-4 (data/stats: read the table/trend, interpret results), plus content/reasoning (skill-1/skill-2).
  - each: 4 options, one best answer (VARY position), explanation 80-140 words, and "distractors" = one {i, why} per wrong option (the misconception/trap).
  - category = best fit from ${s.cats}; difficulty easy/medium/hard.

Be scientifically accurate and self-consistent (answers must follow from the data you invented). Return the structured object.`
}

function verifyPrompt(title, obj) {
  return `You are a strict MCAT science reviewer. Return the CORRECTED object (same shape) for this passage. Verify: the keyed answer is correct and uniquely best; any data-interpretation question is consistent with the table/figure; questions are answerable from passage + standard knowledge (no missing info); exactly 4 options & a distractor entry per wrong option; skills/categories fit. Keep the passage and table mostly intact (fix only errors/inconsistencies). Title: ${title}.

${JSON.stringify(obj)}`
}

const merged = await pipeline(
  SPECS,
  (s) => agent(writePrompt(s), { label: `write:${s.key}`, phase: 'Write', schema: SCHEMA }).then(r => r ? { ...r, key: s.key } : null),
  (r, s) => {
    if (!r) { log(`write FAILED ${s.key}`); return null }
    const base = { section: r.section, title: r.title, type: r.type, text: r.text, questions: r.questions };
    if (r.table) base.table = r.table;
    return agent(verifyPrompt(r.title, base), { label: `verify:${s.key}`, phase: 'Verify', schema: SCHEMA })
      .then(v => {
        const out = (v && v.questions && v.questions.length >= 4) ? v : r;
        log(`${s.key}: "${out.title}" (${out.questions.length} q)`);
        return { id: s.key, section: out.section, title: out.title, type: out.type, text: out.text, table: out.table || null, questions: out.questions.map((q, i) => ({ ...q, id: `${s.key}-${i + 1}` })) };
      })
  }
)

const all = merged.filter(Boolean)
log(`TOTAL science passages: ${all.length}`)
return all
