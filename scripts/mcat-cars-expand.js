export const meta = {
  name: 'mcat-cars-expand',
  description: 'More original MCAT CARS passages on fresh topics with passage-bound questions',
  phases: [{ title: 'Write', detail: 'one author per passage' }, { title: 'Verify', detail: 'passage-only + uniquely best' }],
}

const PASSAGES = [
  { key: 'h9', disc: 'humanities', topic: 'whether photography is an art of seeing or merely of recording' },
  { key: 'h10', disc: 'humanities', topic: 'the paradox of fiction: why we feel real emotion for invented characters' },
  { key: 'h11', disc: 'humanities', topic: 'the value of difficulty in art — whether obscurity can be a virtue' },
  { key: 'h12', disc: 'humanities', topic: 'irony as a mode of moral seriousness rather than evasion' },
  { key: 'h13', disc: 'humanities', topic: 'the canon: who decides what counts as a "great" work, and on what grounds' },
  { key: 'h14', disc: 'humanities', topic: 'silence and the unsaid as carriers of meaning in literature' },
  { key: 'h15', disc: 'humanities', topic: 'whether tragedy consoles or merely disturbs' },
  { key: 'h16', disc: 'humanities', topic: 'the moral status of nostalgia and the idealized past' },
  { key: 's9', disc: 'social science', topic: 'the gift economy and whether all giving is ultimately self-interested' },
  { key: 's10', disc: 'social science', topic: 'whether expertise can survive in an age of distributed information' },
  { key: 's11', disc: 'social science', topic: 'the surveillance dilemma: security, trust, and the watched society' },
  { key: 's12', disc: 'social science', topic: 'ritual and its persistence in secular, modern life' },
  { key: 's13', disc: 'social science', topic: 'meritocracy as ideal and as ideology' },
  { key: 's14', disc: 'social science', topic: 'the tension between individual rights and collective welfare in public policy' },
  { key: 's15', disc: 'social science', topic: 'how categories and labels shape the social realities they claim to describe' },
  { key: 's16', disc: 'social science', topic: 'whether globalization homogenizes or diversifies culture' },
]

const SCHEMA = {
  type: 'object', required: ['title', 'discipline', 'text', 'questions'],
  properties: {
    title: { type: 'string' },
    discipline: { type: 'string', enum: ['humanities', 'social science'] },
    text: { type: 'string', description: 'the passage, ~500-600 words, paragraphs separated by \\n\\n' },
    questions: { type: 'array', minItems: 6, maxItems: 6, items: {
      type: 'object', required: ['stem', 'options', 'answer', 'explanation', 'skill'],
      properties: {
        stem: { type: 'string' },
        options: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string' } },
        answer: { type: 'integer' },
        explanation: { type: 'string', description: '80-140 words, cite passage + why others fail' },
        skill: { type: 'string', enum: ['cars-1', 'cars-2', 'cars-3'] },
      } } },
  },
}

function writePrompt(p) {
  return `You are writing an ORIGINAL MCAT CARS passage and question set. CARS tests reading and reasoning ONLY — never outside content knowledge.

Discipline: ${p.disc}
Topic: ${p.topic}

Write:
- title: short.
- text: an original, sophisticated ~500-600 word passage in MCAT CARS style (${p.disc}). Nuanced argument with a discernible authorial stance, complexity/tension, and at least one shift or qualification. Paragraphs separated by \\n\\n. No questions in the text. Original prose only; do not quote real copyrighted works.
- questions: EXACTLY 6 answerable SOLELY from the passage. Distribution: 2 cars-1 (comprehension), 2 cars-2 (reasoning within text), 2 cars-3 (reasoning beyond text — apply/strengthen/weaken/analogy).
  - each: 4 options, exactly ONE defensible best answer; VARY the answer position.
  - explanation: justify the credited answer from the passage AND say why each other option fails. 80-140 words.

Make distractors tempting (half-true, too extreme, out of scope, or reversing the author). Return the structured object.`
}
function verifyPrompt(title, obj) {
  return `You are a strict MCAT CARS reviewer. For this passage + 6 questions, return the CORRECTED object (same shape). Ensure: every question is answerable using ONLY the passage; the keyed answer is the single best, passage-supported choice (fix the index if not); exactly 4 options and 6 questions; skill labels fit; explanations cite the passage and address distractors. Keep the passage text largely intact. Title: ${title}.

${JSON.stringify(obj)}`
}

const merged = await pipeline(PASSAGES,
  (p) => agent(writePrompt(p), { label: `write:${p.key}`, phase: 'Write', schema: SCHEMA }).then(r => r ? { ...r, key: p.key } : null),
  (r, p) => { if (!r) { log(`write FAILED ${p.key}`); return null }
    return agent(verifyPrompt(r.title, { title: r.title, discipline: r.discipline, text: r.text, questions: r.questions }), { label: `verify:${p.key}`, phase: 'Verify', schema: SCHEMA })
      .then(v => { const out = (v?.questions?.length === 6) ? v : r; log(`${p.key}: "${out.title}"`)
        return { id: p.key, title: out.title, discipline: out.discipline, text: out.text, questions: out.questions.map((q, i) => ({ ...q, id: `${p.key}-${i + 1}` })) } }) })

const all = merged.filter(Boolean)
log(`TOTAL new CARS passages: ${all.length}`)
return all
