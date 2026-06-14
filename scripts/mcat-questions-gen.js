export const meta = {
  name: 'mcat-questions-gen',
  description: 'Generate + verify MCAT-style discrete questions with distractor autopsy',
  phases: [
    { title: 'Generate', detail: 'writers per section sub-area' },
    { title: 'Verify', detail: 'fact-check answer + distractor rationales' },
  ],
}

const BATCHES = [
  { key: 'cp-physics', section: 'chemPhys', focus: 'physics: kinematics, forces, work/energy, fluids, circuits, waves/optics, sound', cats: '4A,4B,4C,4D' },
  { key: 'cp-chem', section: 'chemPhys', focus: 'general + organic chemistry: acids/bases/buffers, thermo, kinetics, equilibrium, electrochem, bonding, stereochemistry, reactions, spectroscopy', cats: '4E,5A,5B,5C,5D,5E' },
  { key: 'bb-biochem', section: 'bioBiochem', focus: 'biochemistry: amino acids, protein structure, enzyme kinetics & inhibition, metabolism, bioenergetics', cats: '1A,1D,5D' },
  { key: 'bb-bio', section: 'bioBiochem', focus: 'biology: molecular biology, genetics, cell biology, microbiology, and human physiology (nervous, endocrine, organ systems)', cats: '1B,1C,2A,2B,2C,3A,3B' },
  { key: 'ps-psych', section: 'psychSoc', focus: 'psychology: sensation/perception, cognition, consciousness, learning, memory, motivation, emotion, development, personality, disorders', cats: '6A,6B,6C,7A,8A' },
  { key: 'ps-soc', section: 'psychSoc', focus: 'sociology + social psychology: attitudes, social influence, group behavior, social structure, demographics, stratification, social determinants of health', cats: '7B,7C,8B,8C,9A,9B,9C,10A,10B' },
]

const SCHEMA = {
  type: 'object',
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['stem', 'options', 'answer', 'explanation', 'distractors', 'section', 'category', 'skill', 'difficulty'],
        properties: {
          stem: { type: 'string', description: 'the question (may include a short data/scenario setup)' },
          options: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string' } },
          answer: { type: 'integer', description: '0-based index of the correct option' },
          explanation: { type: 'string', description: 'why the correct answer is right (80-140 words)' },
          distractors: {
            type: 'array', description: 'one rationale per WRONG option (distractor autopsy)',
            items: { type: 'object', required: ['i', 'why'], properties: { i: { type: 'integer' }, why: { type: 'string', description: 'why this wrong option is tempting / the misconception it targets' } } },
          },
          section: { type: 'string', enum: ['chemPhys', 'bioBiochem', 'psychSoc'] },
          category: { type: 'string' },
          skill: { type: 'string', enum: ['skill-1', 'skill-2', 'skill-3', 'skill-4'] },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        },
      },
    },
  },
}

function genPrompt(b) {
  return `You are an MCAT item writer creating ORIGINAL discrete (standalone, no passage) multiple-choice questions at true MCAT difficulty.

Section: ${b.section}
Topic focus: ${b.focus}
Allowed AAMC category ids: ${b.cats}

Write 20 questions. For EACH:
- stem: a focused question; may include a brief scenario, value, or mini data setup. Test reasoning, not just recall, where possible.
- options: exactly 4 plausible choices.
- answer: 0-based index of the single best answer. VARY the position across questions.
- explanation: 80-140 words on why the correct answer is right.
- distractors: for EACH of the 3 wrong options, an object {i: option index, why: the specific misconception or trap that makes it tempting} (this is the "distractor autopsy").
- section = ${b.section}; category = best-fit id from ${b.cats}; skill = one of skill-1 (knowledge), skill-2 (reasoning/problem-solving), skill-3 (research design), skill-4 (data/stats); difficulty = easy/medium/hard (aim ~30/45/25).
- Accurate, current, original. No two questions on the same exact fact.

Return exactly 20 questions.`
}

function verifyPrompt(key, qs) {
  return `You are a meticulous MCAT answer-key reviewer. For these ${key} questions, return the CORRECTED full list (same count). Verify the keyed answer is truly correct and uniquely best; fix the answer index if wrong; ensure each distractor rationale matches its option index; fix any science errors; ensure exactly 4 options and 3 distractor entries each. Keep section/category/skill/difficulty.

${JSON.stringify(qs)}`
}

const merged = await pipeline(
  BATCHES,
  (b) => agent(genPrompt(b), { label: `gen:${b.key}`, phase: 'Generate', schema: SCHEMA })
    .then(r => ({ key: b.key, qs: (r?.questions || []) })),
  (r, b) => {
    if (!r || !r.qs.length) { log(`gen FAILED ${b.key}`); return null }
    return agent(verifyPrompt(b.key, r.qs), { label: `verify:${b.key}`, phase: 'Verify', schema: SCHEMA })
      .then(v => {
        const qs = (v?.questions && v.questions.length) ? v.questions : r.qs
        log(`${b.key}: ${qs.length} questions`)
        return qs.map((q, i) => ({ ...q, id: `${b.key}-${i + 1}` }))
      })
  }
)

const all = merged.filter(Boolean).flat()
log(`TOTAL questions: ${all.length}`)
return all
