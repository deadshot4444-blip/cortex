export const meta = {
  name: 'new-specialties-gen',
  description: 'Generate 14 new clinical specialties (~1,400 detailed multi-stage MC cases)',
  phases: [
    { title: 'Topics', detail: 'one curator per specialty → 100 distinct case topics' },
    { title: 'Generate', detail: '10 writers per specialty × 10 cases → data/raw JSON' },
  ],
}

const RAW = '/Users/kevinvigil/Documents/clinical-scenarios/data/raw'
const SPECIALTIES = [
  { key: 'nephrology', name: 'Nephrology' },
  { key: 'endocrinology', name: 'Endocrinology' },
  { key: 'hematology-oncology', name: 'Hematology & Oncology' },
  { key: 'rheumatology', name: 'Rheumatology' },
  { key: 'general-surgery', name: 'General Surgery' },
  { key: 'orthopedics', name: 'Orthopedics' },
  { key: 'urology', name: 'Urology' },
  { key: 'dermatology', name: 'Dermatology' },
  { key: 'ophthalmology', name: 'Ophthalmology' },
  { key: 'otolaryngology', name: 'Otolaryngology (ENT)' },
  { key: 'pmr', name: 'Physical Medicine & Rehabilitation' },
  { key: 'vascular-neurology', name: 'Vascular Neurology (Stroke)' },
  { key: 'neuro-oncology', name: 'Neuro-Oncology' },
  { key: 'pediatric-neurology', name: 'Pediatric Neurology' },
]

const TOPIC_SCHEMA = {
  type: 'object', required: ['topics'],
  properties: {
    topics: {
      type: 'array', minItems: 100, maxItems: 100,
      items: {
        type: 'object', required: ['dx', 'patient', 'setting', 'difficulty', 'angle'],
        properties: {
          dx: { type: 'string' }, patient: { type: 'string' }, setting: { type: 'string' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] }, angle: { type: 'string' },
        },
      },
    },
  },
}
const SUMMARY_SCHEMA = {
  type: 'object', required: ['files', 'caseCount'],
  properties: { files: { type: 'array', items: { type: 'string' } }, caseCount: { type: 'number' }, notes: { type: 'string' } },
}

function topicPrompt(sp) {
  return `You are a senior ${sp.name} attending physician and medical educator designing a case-based question bank. Produce EXACTLY 100 distinct clinical case topics for ${sp.name}. Do not read or write files — just return the structured list.

Coverage: span the full breadth of ${sp.name} — ~40% bread-and-butter presentations every student must master, ~40% classic board-relevant (USMLE Step 2 CK / shelf) diagnoses, ~20% high-yield less-common conditions. Difficulty mix ~30 easy / 45 medium / 25 hard. Vary patient age, sex, and setting realistically (ED, clinic, inpatient ward, ICU, OR, etc. as appropriate to ${sp.name}). No two topics share a primary diagnosis unless the clinical angle clearly differs (the angle field must make the difference explicit).

For each topic return: dx (primary diagnosis), patient (age + sex, e.g. '58-year-old man'), setting, difficulty, angle (one-line hook — atypical presentation, key complication, classic finding, or management dilemma).`
}

function genPrompt(sp, batch, bIdx) {
  const fileA = `${RAW}/${sp.key}-b${bIdx}-a.json`
  const fileB = `${RAW}/${sp.key}-b${bIdx}-b.json`
  return `You are a board-certified ${sp.name} attending writing detailed interactive clinical cases for a medical-student case simulator (step-through format like Neural Consult). Write EXACTLY 10 cases — one per assigned topic below, in order — then save them to disk.

ASSIGNED TOPICS:
${JSON.stringify(batch, null, 2)}

CASE FORMAT — each case is one JSON object with EXACTLY these fields:
{
  "title": "...",            // short, symptom-based, MUST NOT reveal the diagnosis
  "difficulty": "easy|medium|hard",
  "setting": "...",
  "patient": "...",
  "chiefComplaint": "...",   // one sentence
  "history": "...",          // 130-220 words: detailed HPI, PMH, meds w/ doses where relevant, allergies, social, family hx
  "vitals": {"BP": "132/84 mmHg", "HR": "96 bpm", "RR": "18 /min", "Temp": "37.2 °C", "SpO2": "98% RA"},
  "exam": "...",             // 60-130 words: focused exam with pertinent positives AND negatives
  "stages": [...],
  "diagnosis": "...",
  "pearls": ["...", "...", "..."]   // 3-4 high-yield one-liners
}

STAGES — ordered array:
- 4 question stages (5 for hard cases). Each: {"type":"question","label":"INITIAL APPROACH","question":"...","options":["...","...","...","..."],"answer":2,"explanation":"..."}
  - label = short uppercase step (INITIAL APPROACH, DIAGNOSIS, MANAGEMENT, DISPOSITION, COMPLICATION, NEXT STEP...)
  - 4-5 options, exactly one best answer; distractors plausible/commonly-confused
  - "answer" = 0-BASED index; VARY which position is correct across questions/cases
  - explanation = 90-160 words: why the right answer is right AND a brief line on why each other is wrong
- 1-2 result stages interleaved where new data returns: {"type":"result","label":"LABS & IMAGING","content":"WBC 14.2 ×10³/µL\\nNa 128 mEq/L\\n..."}  (realistic values WITH units, one finding per line via \\n)
- Typical flow: question -> result -> question -> question -> question

QUALITY: USMLE Step 2 CK / shelf level, clinically accurate, current guidelines. Internally consistent (vitals/exam/labs fit the dx). Each question answerable from info revealed before it. Do NOT add fields beyond the schema (no id, no specialty).

SAVE TO DISK (use the Write tool yourself):
1. Write cases 1-5 as a JSON array to: ${fileA}
2. Write cases 6-10 as a JSON array to: ${fileB}
3. Validate BOTH: run  python3 -m json.tool "<file>" > /dev/null  — fix and re-validate until both parse.

Return via structured output: files written and total case count (10).`
}

const results = await pipeline(
  SPECIALTIES,
  (sp) => agent(topicPrompt(sp), { label: `topics:${sp.key}`, phase: 'Topics', schema: TOPIC_SCHEMA }),
  (topicsResult, sp) => {
    if (!topicsResult) { log(`topics FAILED for ${sp.key}`); return null }
    const topics = topicsResult.topics
    const batches = []
    for (let b = 0; b < 10; b++) batches.push(topics.slice(b * 10, b * 10 + 10))
    return parallel(batches.map((batch, b) => () =>
      agent(genPrompt(sp, batch, b + 1), { label: `gen:${sp.key}:${b + 1}`, phase: 'Generate', schema: SUMMARY_SCHEMA })
    )).then((sums) => {
      const ok = sums.filter(Boolean)
      const total = ok.reduce((a, s) => a + (s.caseCount || 0), 0)
      log(`${sp.key}: ${total} cases across ${ok.length}/10 batches`)
      return { key: sp.key, total, batchesOk: ok.length }
    })
  }
)
return results.filter(Boolean)
