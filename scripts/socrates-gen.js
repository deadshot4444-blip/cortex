export const meta = {
  name: 'socrates-gen',
  description: 'Generate + verify Socratic teaching dialogues (hint-before-answer chains)',
  phases: [{ title: 'Write', detail: 'one tutor per discipline' }, { title: 'Verify', detail: 'fact-check + pedagogy' }],
}
const DISCIPLINES = [
  { key: 'biochem', name: 'Biochemistry', topics: 'amino acid charge/pKa & buffers, enzyme kinetics & inhibition, glycolysis regulation, oxidative phosphorylation & the chemiosmotic theory, the urea cycle / nitrogen, protein folding & denaturation' },
  { key: 'physiology', name: 'Human physiology', topics: 'the cardiac cycle & pressure-volume loops, the action potential, renal handling of sodium & the RAAS, acid-base compensation, oxygen-hemoglobin dissociation, the baroreceptor reflex' },
  { key: 'cell-mol', name: 'Cell & molecular biology', topics: 'the central dogma & mutation consequences, the cell cycle & cancer checkpoints, membrane transport & the Nernst/resting potential, signal transduction (GPCR vs RTK), apoptosis' },
  { key: 'genchem', name: 'General chemistry', topics: 'acid-base equilibria & buffer design, Le Chatelier & equilibrium shifts, reaction kinetics & rate-determining step, thermodynamics (spontaneity, Gibbs), electrochemistry & the Nernst equation, titration curves' },
  { key: 'physics', name: 'Physics', topics: 'projectile motion reasoning, work-energy vs force approaches, fluid continuity & Bernoulli in vessels, circuits & equivalent resistance, the Doppler effect, lens/optics image formation' },
  { key: 'orgo', name: 'Organic chemistry', topics: 'SN1 vs SN2 decision-making, stereochemistry (R/S, enantiomer vs diastereomer, meso), choosing a separation technique, interpreting IR/NMR, acid-base/pKa to predict reactivity' },
  { key: 'psych', name: 'Psychology', topics: 'classical vs operant conditioning, the theories of emotion compared, memory systems & forgetting, reinforcement schedules & behavior, signal detection theory, the stress response' },
  { key: 'sociology', name: 'Sociology', topics: 'the three sociological paradigms compared, social determinants of health, demographic transition, social stratification & mobility, types of capital, the sick role & medicalization' },
  { key: 'clinical', name: 'Clinical reasoning', topics: 'building a differential for chest pain, interpreting an anion-gap metabolic acidosis, approaching hyponatremia, reading a basic ECG logic, sensitivity/specificity & predictive values, when to image vs treat' },
]
const SCHEMA = {
  type: 'object', required: ['dialogues'],
  properties: { dialogues: { type: 'array', items: {
    type: 'object', required: ['topic', 'steps'],
    properties: {
      topic: { type: 'string' },
      steps: { type: 'array', minItems: 5, maxItems: 7, items: {
        type: 'object', required: ['question', 'hint', 'answer', 'why'],
        properties: {
          question: { type: 'string', description: 'a probing Socratic question the learner should attempt' },
          hint: { type: 'string', description: 'a nudge toward the answer WITHOUT giving it away' },
          answer: { type: 'string', description: 'the model answer' },
          why: { type: 'string', description: 'the deeper reasoning / why it matters, connecting to the next step' },
        } } } } } } },
}
function gp(d) { return `You are a brilliant Socratic tutor. For ${d.name}, write Socratic dialogues for these topics: ${d.topics}. One dialogue per topic.

Each dialogue: a 'topic' and 5-7 'steps' that build understanding from foundation to mastery. Each step:
- question: a focused, probing question the learner attempts FIRST (never just "what is X" — make them reason).
- hint: a nudge that guides WITHOUT revealing the answer.
- answer: the correct model answer (concise).
- why: the deeper reasoning and how it sets up the next question.
The LAST step should be a synthesis / "explain it in your own words" teach-back prompt.
Accurate, current, genuinely Socratic (each question builds on the prior answer). Return one dialogue per listed topic.` }
function vp(name, ds) { return `Meticulous tutor & fact-checker. Return the CORRECTED dialogues (same topics) for ${name}: fix any scientific errors, ensure hints don't give away answers, ensure questions build logically, keep 5-7 steps each. ${JSON.stringify(ds)}` }
const merged = await pipeline(DISCIPLINES,
  d => agent(gp(d), { label: `write:${d.key}`, phase: 'Write', schema: SCHEMA }).then(r => ({ d, dialogues: r?.dialogues || [] })),
  (r, d) => { if (!r.dialogues.length) { log(`FAIL ${d.key}`); return null }
    return agent(vp(d.name, r.dialogues), { label: `verify:${d.key}`, phase: 'Verify', schema: SCHEMA }).then(v => {
      const ds = (v?.dialogues?.length) ? v.dialogues : r.dialogues; log(`${d.key}: ${ds.length} dialogues`)
      return ds.map((x, i) => ({ ...x, id: `${d.key}-${i + 1}`, discipline: d.key, disciplineName: d.name })) }) })
const all = merged.filter(Boolean).flat(); log(`TOTAL dialogues: ${all.length}`); return all
