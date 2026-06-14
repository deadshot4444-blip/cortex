export const meta = {
  name: 'mcat-cars-gen',
  description: 'Generate + verify original MCAT CARS passages with passage-bound questions',
  phases: [
    { title: 'Write', detail: 'one author per passage' },
    { title: 'Verify', detail: 'check answers are passage-only + uniquely best' },
  ],
}

const PASSAGES = [
  { key: 'h1', disc: 'humanities', topic: 'what distinguishes art from craft, and whether the distinction holds' },
  { key: 'h2', disc: 'humanities', topic: 'the ethics and value of forgetting versus the duty to remember' },
  { key: 'h3', disc: 'humanities', topic: 'translation as interpretation: whether a translated text can be "faithful"' },
  { key: 'h4', disc: 'humanities', topic: 'why instrumental music moves us if it represents nothing' },
  { key: 'h5', disc: 'humanities', topic: 'the "death of the author" and whether authorial intent should constrain meaning' },
  { key: 'h6', disc: 'humanities', topic: 'historiography: whether historical narratives can be objective' },
  { key: 'h7', disc: 'humanities', topic: 'authenticity and the self in existentialist thought' },
  { key: 'h8', disc: 'humanities', topic: 'architecture as an argument: buildings as expressions of values' },
  { key: 's1', disc: 'social science', topic: 'urbanization and the supposed decline of close social ties' },
  { key: 's2', disc: 'social science', topic: 'diffusion of responsibility and the limits of the bystander explanation' },
  { key: 's3', disc: 'social science', topic: 'cultural relativism versus claims of universal human values' },
  { key: 's4', disc: 'social science', topic: 'behavioral economics: whether "nudges" respect autonomy' },
  { key: 's5', disc: 'social science', topic: 'social capital and the debate over civic decline' },
  { key: 's6', disc: 'social science', topic: 'how schooling can both reduce and reproduce inequality' },
  { key: 's7', disc: 'social science', topic: 'collective memory and the construction of national identity' },
  { key: 's8', disc: 'social science', topic: 'media framing and its effect on public opinion' },
]

const SCHEMA = {
  type: 'object',
  required: ['title', 'discipline', 'text', 'questions'],
  properties: {
    title: { type: 'string' },
    discipline: { type: 'string', enum: ['humanities', 'social science'] },
    text: { type: 'string', description: 'the passage, ~500-600 words, paragraphs separated by \\n\\n' },
    questions: {
      type: 'array', minItems: 6, maxItems: 6,
      items: {
        type: 'object',
        required: ['stem', 'options', 'answer', 'explanation', 'skill'],
        properties: {
          stem: { type: 'string' },
          options: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string' } },
          answer: { type: 'integer', description: '0-based index of the single best answer' },
          explanation: { type: 'string', description: 'justify the credited answer AND why the others fail, citing the passage (80-140 words)' },
          skill: { type: 'string', enum: ['cars-1', 'cars-2', 'cars-3'], description: 'cars-1 comprehension, cars-2 reasoning within text, cars-3 reasoning beyond text' },
        },
      },
    },
  },
}

function writePrompt(p) {
  return `You are writing an ORIGINAL MCAT CARS passage and question set. CARS tests reading and reasoning ONLY — never outside content knowledge.

Discipline: ${p.disc}
Topic: ${p.topic}

Write:
- title: short.
- text: an original, sophisticated ~500-600 word passage in the style of MCAT CARS (${p.disc}). Present a nuanced argument with a discernible authorial stance, some complexity/tension, and at least one shift or qualification. Paragraphs separated by \\n\\n. Do NOT include any questions in the text. Original prose only — do not quote real copyrighted works.
- questions: EXACTLY 6 questions answerable SOLELY from the passage (no outside facts). Distribution: 2 cars-1 (comprehension: main idea, tone, structure, what the author states), 2 cars-2 (reasoning within: inference, the function of a claim, evaluating the author's argument), 2 cars-3 (reasoning beyond: apply the author's reasoning to a NEW scenario, strengthen/weaken, judge an analogy).
  - Each: 4 options, exactly ONE defensible best answer (others must be clearly worse to a careful reader). VARY the answer position.
  - explanation: justify the credited answer with reference to the passage AND briefly say why each other option fails (distractor analysis). 80-140 words.

Make distractors tempting (half-true, too extreme, out of scope, or reversing the author). Return the structured object.`
}

function verifyPrompt(title, obj) {
  return `You are a strict MCAT CARS reviewer. For this passage + 6 questions, return the CORRECTED object (same shape). Ensure: every question is answerable using ONLY the passage (remove reliance on outside knowledge); the keyed answer is the single best, passage-supported choice (fix the index if not); exactly 4 options and 6 questions; skill labels fit; explanations cite the passage and address distractors. Keep the passage text largely intact (fix only clarity/argument issues). Title: ${title}.

${JSON.stringify(obj)}`
}

const merged = await pipeline(
  PASSAGES,
  (p) => agent(writePrompt(p), { label: `write:${p.key}`, phase: 'Write', schema: SCHEMA })
    .then(r => r ? { ...r, key: p.key } : null),
  (r, p) => {
    if (!r) { log(`write FAILED ${p.key}`); return null }
    return agent(verifyPrompt(r.title, { title: r.title, discipline: r.discipline, text: r.text, questions: r.questions }), { label: `verify:${p.key}`, phase: 'Verify', schema: SCHEMA })
      .then(v => {
        const out = (v && v.questions && v.questions.length === 6) ? v : r
        log(`${p.key}: "${out.title}" (${out.questions.length} q)`)
        return { id: p.key, title: out.title, discipline: out.discipline, text: out.text, questions: out.questions.map((q, i) => ({ ...q, id: `${p.key}-${i + 1}` })) }
      })
  }
)

const all = merged.filter(Boolean)
log(`TOTAL passages: ${all.length}`)
return all
