export const meta = {
  name: 'mcat-science-expand',
  description: 'More AAMC-style science passages (fresh scenarios) with question sets',
  phases: [{ title: 'Write', detail: 'one author per passage' }, { title: 'Verify', detail: 'keys, data, grounding' }],
}

const SPECS = [
  { key: 'cp7', section: 'chemPhys', cats: '4B', topic: 'a fluids/biomechanics study: flow rate or pressure through vessels of varied radius (Poiseuille), or buoyancy measurements', table: true },
  { key: 'cp8', section: 'chemPhys', cats: '4D,4E', topic: 'a thermodynamics/calorimetry experiment: heat exchange measured for reactions or phase changes', table: true },
  { key: 'cp9', section: 'chemPhys', cats: '5A,5E', topic: 'a solubility/Ksp or precipitation study: ion concentrations vs conditions', table: true },
  { key: 'cp10', section: 'chemPhys', cats: '4C', topic: 'an electromagnetism or wave experiment: measured force/field, or interference/standing-wave data', table: true },
  { key: 'cp11', section: 'chemPhys', cats: '5C,5D', topic: 'an organic reaction-yield/mechanism study with product distribution under varied conditions', table: true },
  { key: 'cp12', section: 'chemPhys', cats: '5B,5D', topic: 'a spectroscopy identification scenario: IR/NMR/MS data used to deduce an unknown structure', table: false },
  { key: 'bb7', section: 'bioBiochem', cats: '1A,1D', topic: 'a metabolic-flux or bioenergetics experiment: pathway intermediate levels measured under perturbations', table: true },
  { key: 'bb8', section: 'bioBiochem', cats: '1B,2C', topic: 'a gene-regulation study: reporter expression measured across promoter mutations or signaling conditions', table: true },
  { key: 'bb9', section: 'bioBiochem', cats: '2B', topic: 'a microbiology/immunology experiment: bacterial growth or antibody titer measured across treatments', table: true },
  { key: 'bb10', section: 'bioBiochem', cats: '3A', topic: 'a neurophysiology study: membrane potential or firing rate measured across ionic/pharmacologic conditions', table: true },
  { key: 'bb11', section: 'bioBiochem', cats: '3B', topic: 'a cardiovascular or respiratory physiology study: pressure/flow/volume measured across interventions', table: true },
  { key: 'bb12', section: 'bioBiochem', cats: '1C', topic: 'a genetics linkage or expression study: recombination frequencies or inheritance data across a cross', table: true },
  { key: 'ps7', section: 'psychSoc', cats: '6B,6C', topic: 'a cognition/decision-making experiment: accuracy or bias measured across framing conditions', table: true },
  { key: 'ps8', section: 'psychSoc', cats: '7A,8A', topic: 'a clinical/behavioral study: symptom or behavior change across a therapy vs control', table: true },
  { key: 'ps9', section: 'psychSoc', cats: '8B,8C', topic: 'a social-identity or attribution study: judgments measured across in-group/out-group conditions', table: true },
  { key: 'ps10', section: 'psychSoc', cats: '9A,9B,10A', topic: 'a sociology study: institutional or stratification outcomes across demographic groups, with survey data', table: true },
]

const SCHEMA = {
  type: 'object', required: ['section', 'title', 'type', 'text', 'questions'],
  properties: {
    section: { type: 'string', enum: ['chemPhys', 'bioBiochem', 'psychSoc'] },
    title: { type: 'string' },
    type: { type: 'string', enum: ['research', 'data', 'conceptual'] },
    text: { type: 'string', description: '~250-360 words, paragraphs separated by \\n\\n; reference Table 1/Figure 1' },
    table: { type: 'object', required: ['caption', 'headers', 'rows'],
      properties: { caption: { type: 'string' }, headers: { type: 'array', items: { type: 'string' } }, rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } } } },
    questions: { type: 'array', minItems: 4, maxItems: 6, items: {
      type: 'object', required: ['stem', 'options', 'answer', 'explanation', 'distractors', 'skill', 'category', 'difficulty'],
      properties: {
        stem: { type: 'string' },
        options: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string' } },
        answer: { type: 'integer' },
        explanation: { type: 'string', description: '80-140 words' },
        distractors: { type: 'array', items: { type: 'object', required: ['i', 'why'], properties: { i: { type: 'integer' }, why: { type: 'string' } } } },
        skill: { type: 'string', enum: ['skill-1', 'skill-2', 'skill-3', 'skill-4'] },
        category: { type: 'string' }, difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
      } } },
  },
}

function writePrompt(s) {
  return `You are writing an ORIGINAL AAMC-style MCAT science passage with its question set (like a real ${s.section} passage). The passage presents a scenario; questions are answered using the passage PLUS testable MCAT content knowledge.

Section: ${s.section}
Scenario: ${s.topic}
Relevant AAMC content categories: ${s.cats}

Write:
- title: short.
- type: "research" or "data".
- text: ~250-360 word original passage describing setup, method, findings. Reference "Table 1"/"Figure 1" where used. Original prose; realistic invented data.
${s.table ? '- table: {caption, headers[], rows[][]} with realistic numbers the questions require (4-6 rows).' : '- (no table; describe spectra/figures in the text, e.g., IR peaks, NMR shifts.)'}
- questions: 5 answerable from the passage + standard MCAT knowledge. Include >=1 skill-3 (research design) and >=1 skill-4 (data/stats), plus skill-1/skill-2.
  - each: 4 options, one best answer (VARY position), explanation 80-140 words, "distractors" = one {i, why} per wrong option.
  - category = best fit from ${s.cats}; difficulty easy/medium/hard.

Be scientifically accurate and self-consistent (answers must follow from your invented data). Return the structured object.`
}
function verifyPrompt(title, obj) {
  return `You are a strict MCAT science reviewer. Return the CORRECTED object (same shape) for this passage. Verify: the keyed answer is correct and uniquely best; data-interpretation questions are consistent with the table/figure; questions answerable from passage + standard knowledge; exactly 4 options & a distractor entry per wrong option; skills/categories fit. Keep passage/table mostly intact. Title: ${title}.

${JSON.stringify(obj)}`
}

const merged = await pipeline(SPECS,
  (s) => agent(writePrompt(s), { label: `write:${s.key}`, phase: 'Write', schema: SCHEMA }).then(r => r ? { ...r, key: s.key } : null),
  (r, s) => { if (!r) { log(`write FAILED ${s.key}`); return null }
    const base = { section: r.section, title: r.title, type: r.type, text: r.text, questions: r.questions }
    if (r.table) base.table = r.table
    return agent(verifyPrompt(r.title, base), { label: `verify:${s.key}`, phase: 'Verify', schema: SCHEMA })
      .then(v => { const out = (v?.questions?.length >= 4) ? v : r; log(`${s.key}: "${out.title}" (${out.questions.length} q)`)
        return { id: s.key, section: out.section, title: out.title, type: out.type, text: out.text, table: out.table || null, questions: out.questions.map((q, i) => ({ ...q, id: `${s.key}-${i + 1}` })) } }) })

const all = merged.filter(Boolean)
log(`TOTAL new science passages: ${all.length}`)
return all
