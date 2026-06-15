export const meta = {
  name: 'mcat-landing-design',
  description: 'Design a commercial-grade MCAT landing/hub: 3 concepts → synthesize one implementable spec',
  phases: [{ title: 'Concepts', detail: '3 distinct landing directions' }, { title: 'Synthesize', detail: 'merge into one build spec' }],
}

const CONTEXT = `PRODUCT: "Cortex Medical Academy" — a FREE, evidence-based MCAT prep platform (also has clinical case scenarios, but this page is JUST the MCAT section). Live at cortexmedical.academy. Audience: pre-meds (and some med students). Mission: genuinely the best free MCAT prep, "for humanity."

WHAT'S ACTUALLY IN IT (real numbers, don't inflate):
- 504 spaced-repetition flashcards (SM-2 scheduling)
- 263 discrete practice questions with full "distractor autopsy" (why each wrong answer is tempting)
- 32 original CARS passages (96+ questions)
- 34 AAMC-style science passages with data tables
- Exam Simulator (real test-day timer, question flagging, stamina/full-length chains, periodic table)
- Blueprint Navigator (the full AAMC content map + your coverage heat-check)
- Mistake Lab (confidence-vs-accuracy calibration, weakest categories, root-cause analysis)
- Guide Engine (personalized day-by-day study campaign: 120/90/60-day tracks)
- Course Mapper (rate your coursework → coverage heat map)

THE METHOD (real differentiator — this is evidence-based, Dunlosky high-utility):
spaced repetition · active retrieval practice · interleaving · confidence calibration · distractor autopsy · blind review · teach-back. The pitch: most MCAT tools are flashcard toys; this is built on how memory actually works.

AESTHETIC (must stay in this lane): white background, near-black text, hairline gray borders, SHARP corners (no rounded), monospace ALL-CAPS micro-labels (letter-spaced) as accents, generous whitespace, color used ONLY as signal (a green/red/amber). Think SpaceX/Grok engineering-console minimalism — precise, confident, premium, NOT playful/colorful/startup-gradient. It must read "official" and "serious tool," not "cutesy app."

GOAL: turn the MCAT section's landing/hub into something that feels like a real, premium, commercial product page — strong hero with a value proposition, a credibility/stat band, the modules presented with clear hierarchy and grouping, an evidence/"why it works" section, and a closing call-to-action — while staying 100% in the aesthetic above and remaining a functional in-app hub (the module cards still launch the tools).`

const CONCEPT_SCHEMA = {
  type: 'object',
  required: ['conceptName', 'angle', 'heroEyebrow', 'heroHeadline', 'heroSubhead', 'primaryCta', 'secondaryCta', 'statBand', 'moduleGroups', 'evidence', 'extraSections', 'closing'],
  properties: {
    conceptName: { type: 'string' },
    angle: { type: 'string', description: 'the distinct positioning angle in one line' },
    heroEyebrow: { type: 'string', description: 'tiny mono-caps label above the headline, e.g. "MCAT PREP · FREE"' },
    heroHeadline: { type: 'string', description: 'punchy value-prop headline, <= 9 words' },
    heroSubhead: { type: 'string', description: '1-2 sentences under the headline' },
    primaryCta: { type: 'string', description: 'primary button label (action)' },
    secondaryCta: { type: 'string', description: 'secondary button label' },
    statBand: { type: 'array', items: { type: 'object', required: ['num', 'label'], properties: { num: { type: 'string' }, label: { type: 'string' } } }, description: '4-6 credibility stats (num + short label), drawn from the real numbers' },
    moduleGroups: { type: 'array', items: { type: 'object', required: ['groupTitle', 'blurb', 'modules'], properties: { groupTitle: { type: 'string' }, blurb: { type: 'string' }, modules: { type: 'array', items: { type: 'string' } } } }, description: 'how to group the 9 modules into 2-3 labeled clusters' },
    evidence: { type: 'object', required: ['title', 'intro', 'points'], properties: { title: { type: 'string' }, intro: { type: 'string' }, points: { type: 'array', items: { type: 'object', required: ['name', 'why'], properties: { name: { type: 'string' }, why: { type: 'string' } } } } } },
    extraSections: { type: 'array', items: { type: 'object', required: ['title', 'body'], properties: { title: { type: 'string' }, body: { type: 'string' } } }, description: 'any extra sections (how it works, who it is for, the free promise, etc.)' },
    closing: { type: 'object', required: ['headline', 'sub', 'cta'], properties: { headline: { type: 'string' }, sub: { type: 'string' }, cta: { type: 'string' } } },
  },
}

const ANGLES = [
  'PRESTIGE / ACADEMIC AUTHORITY — reads like an elite institution or a serious research-grade tool. Restrained, confident, credentialed. Copy emphasizes rigor, the science, completeness.',
  'PERFORMANCE / BOLD CHALLENGER — confident, direct, a little swagger; positions against flimsy flashcard apps. Copy is punchy, motivating, outcome-focused ("score higher", "train like the exam").',
  'STUDENT-FIRST / CLARITY & TRUST — warm but premium; emphasizes that it is free, built by/for students, no gimmicks, you actually understand WHY. Calm, reassuring, human.',
]

phase('Concepts')
const concepts = await parallel(ANGLES.map((angle, i) => () =>
  agent(`${CONTEXT}\n\nDesign ONE complete landing-page concept for the MCAT section in this specific angle:\n${angle}\n\nReturn a full concept: hero (eyebrow, headline, subhead, CTAs), a credibility stat band (use the REAL numbers), a grouping of the 9 modules into 2-3 labeled clusters with a blurb each, an evidence/"why it works" section drawn from the real method, any extra sections that strengthen the page, and a closing CTA. Copy must be crisp and premium — every word earns its place. Stay in the white/mono/engineering aesthetic (no emoji, no hype-startup fluff).`,
    { label: `concept ${i + 1}`, phase: 'Concepts', schema: CONCEPT_SCHEMA })))

const valid = concepts.filter(Boolean)
log(`got ${valid.length} concepts`)

phase('Synthesize')
const final = await agent(`${CONTEXT}\n\nYou are the creative director. Here are ${valid.length} landing-page concepts for the MCAT section. Synthesize the SINGLE BEST implementable spec — take the strongest hero, the clearest module grouping, the most compelling evidence section, and the tightest copy from across them. It must be cohesive (one voice), premium, and fully in the white/mono/engineering aesthetic. Return the same concept shape — this is the final build spec the developer will implement verbatim, so make every field polished and final.\n\nCONCEPTS:\n${JSON.stringify(valid)}`,
  { label: 'synthesis', phase: 'Synthesize', schema: CONCEPT_SCHEMA })

return { final, concepts: valid }
