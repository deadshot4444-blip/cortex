/* ============================================================================
   Cortex · Cognitive Psychology  —  the science of the mind
   A public, lessons-first course across the whole subject: how cognition is
   studied, the brain, perception, attention, memory, knowledge, imagery,
   language, problem solving, and decision making. Guided Socratic lessons
   are the spine; active recall, spaced repetition, and interleaving keep it.

   Self-contained: uses app.js globals (el, esc, setView, topbar, siteFooter).
   Progress lives in localStorage['cs-cogpsych'] — fully separate from
   clinical / MCAT progress. Earlier class-module progress is archived under
   its own key the first time the course loads.
   ========================================================================= */

const COG_DIAGRAMS = []; // reserved for inline-SVG diagram questions (bank uses the COG_FIGS registry)


/* ---------- generated + verified MCQ bank (from data/cogpsych-bank.json) ---------- */
let COG_GENERATED = [];   // loaded from data/cogpsych-bank.json
let COG_HY = [];           // retired subset — kept declared for legacy helpers

/* ---------- small helpers ---------- */
function cogRand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
const COG_GENERATORS = []; // no procedural generators — Cognitive Psychology uses the static bank


let COG_BANK = COG_DIAGRAMS.concat(COG_GENERATORS);   // COG_GENERATED merged in after cogLoadBank()

/* ---------- course topic metadata (one lesson per topic; drills + weakness reporting) ----------
   Must mirror the topic map in scripts/validate-cogpsych.mjs exactly. */
const COG_TOPICS = {
  // Chapter 1 — Introduction
  'ch1-cognition': { name: 'What Cognition Is', ch: 1, blurb: 'The definition of cognition, how ordinary acts recruit perception, attention, memory, language, and decisions.' },
  'ch1-whystudy': { name: 'Why Study the Mind', ch: 1, blurb: 'Basic versus applied research, and where cognitive science pays off — health, education, design, AI.' },
  'ch1-ai': { name: 'Measuring Progress with AI', ch: 1, blurb: 'Deep Blue, scripted chatbots, missing housekeeping robots, and what machines reveal about minds.' },
  'ch1-approaches': { name: 'Three Ways In', ch: 1, blurb: 'Neuroscience, cognitive psychology, and computational modeling — what each contributes and why all three.' },
  // Chapter 2 — How to Study Cognition
  'ch2-mindbrain': { name: 'Mind & Brain', ch: 2, blurb: 'The mind–body problem, dualism and monism, Descartes, and levels of explanation.' },
  'ch2-history': { name: 'Structuralism to Behaviorism', ch: 2, blurb: 'Introspection, Pavlov, Watson, Skinner, and Tolman’s maze rats that learned without reward.' },
  'ch2-cognitive': { name: 'The Cognitive Revolution', ch: 2, blurb: 'Opening the black box: information processing, Donders’ chronometry, and why behaviorism fell short.' },
  'ch2-methods': { name: 'Measuring the Mind', ch: 2, blurb: 'Reaction time, accuracy, Stroop interference, and psychophysics as windows on hidden processes.' },
  'ch2-neuromethods': { name: 'Watching the Brain Work', ch: 2, blurb: 'Lesions, single cells, EEG, fMRI, and TMS — what each can and cannot tell you.' },
  // Chapter 3 — The Brain
  'ch3-nervous': { name: 'The Nervous System', ch: 3, blurb: 'Central and peripheral divisions, voluntary and autonomic control, and reflex circuits.' },
  'ch3-cortex': { name: 'Mapping the Cortex', ch: 3, blurb: 'Lobes, landmarks, gyri and sulci, and the subcortical structures beneath.' },
  'ch3-function': { name: 'Localization of Function', ch: 3, blurb: 'Motor, sensory, and association cortex, hierarchy, contralateral wiring, and plasticity.' },
  'ch3-neurons': { name: 'Neurons & Signaling', ch: 3, blurb: 'Action potentials, synapses, neurotransmitters, and how cells compute.' },
  'ch3-ann': { name: 'Artificial Neural Networks', ch: 3, blurb: 'Units and weights as neuron analogs, learning from data, and where the analogy breaks.' },
  // Chapter 4 — Perception
  'ch4-sensation': { name: 'Sensation vs Perception', ch: 4, blurb: 'Transduction, and the leap from registering energy to constructing experience.' },
  'ch4-systems': { name: 'The Perceptual Systems', ch: 4, blurb: 'Eye and retina, the visual pathway, receptive fields, and the other senses.' },
  'ch4-theories': { name: 'Theories of Perception', ch: 4, blurb: 'Bottom-up versus top-down, Gibson’s direct pickup, Helmholtz’s unconscious inference, Gestalt grouping.' },
  'ch4-visual': { name: 'Seeing Objects', ch: 4, blurb: 'Object recognition, the invariance problem, depth cues, and what illusions reveal.' },
  'ch4-cnn': { name: 'Machine Vision', ch: 4, blurb: 'Convolutional networks as models of seeing — their wins, and their very human-unlike failures.' },
  // Chapter 5 — Attention
  'ch5-selective': { name: 'Selective Attention', ch: 5, blurb: 'Limited capacity, the cocktail-party effect, dichotic listening, and shadowing.' },
  'ch5-filter': { name: 'Where the Filter Sits', ch: 5, blurb: 'Early versus late selection, Broadbent, Treisman’s attenuator, and perceptual load.' },
  'ch5-divided': { name: 'Divided Attention', ch: 5, blurb: 'Dual-task costs, automaticity, practice, and the driving-while-distracted evidence.' },
  'ch5-purpose': { name: 'Aiming Attention', ch: 5, blurb: 'Binding, the spotlight, overt and covert shifts, visual search, and inattentional blindness.' },
  'ch5-neural': { name: 'Attention in the Brain', ch: 5, blurb: 'Biased competition, attentional networks, and how attention amplifies neural responses.' },
  // Chapter 6 — Short-term and working memory
  'ch6-foundations': { name: 'Memory Foundations', ch: 6, blurb: 'Encoding, storage, retrieval, capacity, duration, and evidence for distinct memory systems.' },
  'ch6-sensory-modal': { name: 'Modal Model & Sensory Memory', ch: 6, blurb: 'Atkinson–Shiffrin stages, attention, iconic persistence, and Sperling’s whole- versus partial-report results.' },
  'ch6-stm-capacity': { name: 'Short-Term Memory Capacity', ch: 6, blurb: 'Auditory and visual limits, Miller’s span, change detection, chunking, expertise, and mnemonists.' },
  'ch6-stm-forgetting': { name: 'STM Duration & Forgetting', ch: 6, blurb: 'Rehearsal, Brown–Peterson, decay, proactive and retroactive interference, and the modern debate.' },
  'ch6-working-memory': { name: 'Working Memory Model', ch: 6, blurb: 'Phonological loop, visuospatial sketchpad, central executive, episodic buffer, filtering, aging, and training transfer.' },
  'ch6-neural': { name: 'Neural Basis of Working Memory', ch: 6, blurb: 'Distributed modality-specific activity, prefrontal delay activity, lesion evidence, and executive control.' },
  // Chapter 7 — Long-term memory
  'ch7-systems-amnesia': { name: 'STM vs LTM & Amnesia', ch: 7, blurb: 'Long-term storage, anterograde/retrograde amnesia, H.M., Clive Wearing, K.F., and dissociations.' },
  'ch7-encoding-retrieval': { name: 'Encoding & Retrieval Match', ch: 7, blurb: 'Rehearsal, serial position, levels of processing, transfer-appropriate processing, and encoding specificity.' },
  'ch7-memory-factors': { name: 'Factors That Strengthen Memory', ch: 7, blurb: 'Elaboration, organization, imagery, self-reference, generation, spacing, and retrieval practice.' },
  'ch7-explicit': { name: 'Explicit Memory', ch: 7, blurb: 'Declarative memory, episodic versus semantic knowledge, autobiographical access, and conscious recollection.' },
  'ch7-implicit': { name: 'Implicit Memory', ch: 7, blurb: 'Procedural skills, priming, conditioning, nondeclarative learning, and durable effects without conscious recall.' },
  'ch7-neural': { name: 'Long-Term Memory in the Brain', ch: 7, blurb: 'Hippocampal encoding, consolidation, distributed cortical storage, implicit systems, and lesion evidence.' },
  // Chapter 8 — Autobiographical memory
  'ch8-foundations': { name: 'Autobiographical Memory & the Self', ch: 8, blurb: 'Episodic and semantic self-knowledge, directive/social/self functions, and the self-memory system.' },
  'ch8-lifespan': { name: 'Memory Across the Lifespan', ch: 8, blurb: 'Infantile amnesia, hippocampal and language accounts, neurogenesis, and the reminiscence bump.' },
  'ch8-emotion': { name: 'Emotion & Flashbulb Memory', ch: 8, blurb: 'Arousal, valence, amygdala effects, flashbulb confidence, rehearsal, and accuracy over time.' },
  'ch8-construction': { name: 'Constructive & False Memory', ch: 8, blurb: 'Reconstruction, schemas, the misinformation effect, imagination, suggestion, and implanted memories.' },
  'ch8-source-reconsolidation': { name: 'Source Monitoring & Reconsolidation', ch: 8, blurb: 'Source errors, familiarity, reactivation, updating, and why recalled memories can change.' },
  'ch8-justice-neural': { name: 'Eyewitness Memory & the Brain', ch: 8, blurb: 'Lineups, confidence limits, criminal-justice consequences, autobiographical networks, and memory evidence.' },
  // Chapter 9 — Knowledge
  'ch9-foundations': { name: 'Knowledge, Concepts & Categories', ch: 9, blurb: 'Semantic inference, implicit commonsense knowledge, exemplars, concepts, and the classical feature view.' },
  'ch9-typicality': { name: 'Typicality Effects', ch: 9, blurb: 'Rosch ratings, naming and categorization speed, lexical priming, language, and limits of defining features.' },
  'ch9-prototype-exemplar': { name: 'Prototype vs Exemplar Theories', ch: 9, blurb: 'Characteristic features, abstract averages, stored examples, context, atypical members, and comparison evidence.' },
  'ch9-knowledge-based': { name: 'Knowledge-Based Categorization', ch: 9, blurb: 'Coherence, feature selection, psychological essentialism, social categories, and stereotyping risk.' },
  'ch9-hierarchies-networks': { name: 'Hierarchies & Semantic Networks', ch: 9, blurb: 'Basic/subordinate/superordinate levels, cognitive economy, inheritance, sentence verification, and spreading activation.' },
  'ch9-schemas-embodied': { name: 'Schemas & Embodied Cognition', ch: 9, blurb: 'Organized knowledge, reconstructive memory, repeated reproduction, body-state effects, and grounded representations.' },
  'ch9-neural': { name: 'Neural Representation of Knowledge', ch: 9, blurb: 'Semantic dementia, anterior temporal hub, distributed spokes, TMS virtual lesions, and localized/distributed coding.' },
  // Chapter 10 — Visual Imagery
  'ch10-nature': { name: 'What Imagery Is', ch: 10, blurb: 'Recreating perception without a stimulus, multimodal imagery, and Paivio’s dual coding of analog and abstract codes.' },
  'ch10-debate': { name: 'The Imagery Debate', ch: 10, blurb: 'Kosslyn’s depictive pictures versus Pylyshyn’s propositions and the epiphenomenon challenge.' },
  'ch10-evidence': { name: 'Scanning, Rotation & Scaling', ch: 10, blurb: 'Mental scanning maps, Shepard–Metzler rotation, size scaling, imagery–perception interference, and the counterevidence.' },
  'ch10-brain': { name: 'Imagery in the Brain', ch: 10, blurb: 'Patient dissociations, V1 activation, TMS disruption, and what shared circuitry settles.' },
  'ch10-uses': { name: 'Using the Mind’s Eye', ch: 10, blurb: 'Imagery in memory and practice, vividness differences, aphantasia and hyperphantasia.' },
  // Chapter 11 — Language
  'ch11-unique': { name: 'Is Language Uniquely Human?', ch: 11, blurb: 'Design features, generativity, animal communication, and the ape-language projects.' },
  'ch11-acquisition': { name: 'Learning to Talk', ch: 11, blurb: 'Acquisition stages, universal grammar versus statistical learning, and critical-period evidence.' },
  'ch11-comprehension': { name: 'Understanding Speech', ch: 11, blurb: 'Segmentation, lexical ambiguity, parsing, garden-path sentences, and eye-tracking evidence.' },
  'ch11-discourse': { name: 'Beyond the Sentence', ch: 11, blurb: 'Inference, situation models, and how comprehension builds coherence across sentences.' },
  'ch11-brain': { name: 'Language in the Brain', ch: 11, blurb: 'Broca’s and Wernicke’s aphasias, lateralization, and modern network views.' },
  'ch11-thought': { name: 'Language & Thought', ch: 11, blurb: 'Linguistic relativity, the Russian-blues evidence, and what large language models change.' },
  // Chapter 12 — Problem Solving
  'ch12-nature': { name: 'What a Problem Is', ch: 12, blurb: 'Initial state, goal, obstacle — and well-defined versus ill-defined problems.' },
  'ch12-process': { name: 'How Solving Unfolds', ch: 12, blurb: 'Reproductive versus productive thinking, restructuring, and the recursive solving cycle.' },
  'ch12-barriers': { name: 'Why We Get Stuck', ch: 12, blurb: 'Functional fixedness, mental set, irrelevant information, and self-imposed constraints.' },
  'ch12-insight': { name: 'Insight & Creativity', ch: 12, blurb: 'Aha moments, feeling-of-warmth evidence, incubation, and divergent thinking.' },
  'ch12-expertise': { name: 'Experts vs Novices', ch: 12, blurb: 'Chess chunking, principle-based categorization, when expertise backfires, and means–end analysis.' },
  // Chapter 13 — Reasoning & Decision Making
  'ch13-reasoning': { name: 'Reasoning Beyond the Data', ch: 13, blurb: 'Extrapolating from what you know, and validity versus truth.' },
  'ch13-deduction': { name: 'Deduction & Its Traps', ch: 13, blurb: 'Syllogisms, valid and invalid forms, belief bias, and the Wason selection task.' },
  'ch13-induction': { name: 'Induction', ch: 13, blurb: 'Generalizing from cases, what makes an induction strong, and confirmation bias.' },
  'ch13-heuristics': { name: 'Heuristics & Biases', ch: 13, blurb: 'Availability, anchoring, representativeness, base-rate neglect, conjunction errors, and framing.' },
  'ch13-decisions': { name: 'Choosing & the Brain', ch: 13, blurb: 'Expected utility and its violations, loss aversion, neuroeconomics, and nudges.' },
};

const COG_CH = {
  1: 'Introduction',
  2: 'How to Study Cognition',
  3: 'The Brain',
  4: 'Perception',
  5: 'Attention',
  6: 'Short-Term & Working Memory',
  7: 'Long-Term Memory',
  8: 'Autobiographical Memory',
  9: 'Knowledge',
  10: 'Visual Imagery',
  11: 'Language',
  12: 'Problem Solving',
  13: 'Reasoning & Decision Making',
};

const COG_CH_OVERVIEW = {
  1: 'Meet cognitive psychology and learn how hidden mental processes become something science can study.',
  2: 'Follow the field from philosophy and behaviorism to experiments that measure the mind and brain.',
  3: 'Build a working map of neurons, brain systems, cortical organization, and artificial neural networks.',
  4: 'See how sensation becomes perception through pathways, inference, organization, and object recognition.',
  5: 'Understand selection, divided attention, visual search, automaticity, and the neural control of focus.',
  6: 'Explore sensory memory, short-term limits, working-memory systems, forgetting, and executive control.',
  7: 'Learn how long-term memories are encoded, organized, retrieved, consolidated, and expressed.',
  8: 'Examine the remembered self, emotion, false memory, eyewitness evidence, and memory across a lifetime.',
  9: 'Study concepts, categories, schemas, semantic networks, embodiment, and how knowledge lives in the brain.',
  10: 'Investigate mental images, the imagery debate, spatial transformations, vividness, and shared visual circuitry.',
  11: 'Trace language from acquisition and comprehension to discourse, the brain, thought, and machine language.',
  12: 'Learn how problems are represented, why solvers get stuck, where insight comes from, and what experts see.',
  13: 'Finish with deduction, induction, heuristics, bias, choice, loss aversion, and the neuroscience of decisions.',
};

/* ---------- state + persistence ---------- */
const COG_KEY = 'cs-cogpsych';
const COG_MODULE = 'cogpsych-course-v1';   // stable tag — the course accumulates, it doesn't rotate
function cogLoad() { try { return JSON.parse(localStorage.getItem(COG_KEY)) || {}; } catch { return {}; } }
let COG = Object.assign({
  module: '', xp: 0, answered: 0, correct: 0,
  bestScore: 0, bestCombo: 0, bestExam: 0, plays: 0,
  streak: { current: 0, longest: 0, lastDate: '' },
  q: {},            // qid -> { box: 0..5, a, c, ts }
  ach: [], mastered: false, starred: {}, learned: {},
}, cogLoad());
// Tag changed since last visit (old class-module state) -> archive it, then start the course fresh.
if (COG.module !== COG_MODULE) {
  if (COG.answered || COG.xp) {
    try { localStorage.setItem('cs-cogpsych-' + (COG.module || 'legacy'), JSON.stringify(COG)); } catch {}
  }
  COG = {
    module: COG_MODULE,
    xp: 0, answered: 0, correct: 0, bestScore: 0, bestCombo: 0, bestExam: 0, plays: 0,
    streak: { current: 0, longest: 0, lastDate: '' },
    q: {}, ach: [], mastered: false, starred: {}, learned: {},
  };
  try { localStorage.setItem(COG_KEY, JSON.stringify(COG)); } catch {}
}
function cogSave() { try { localStorage.setItem(COG_KEY, JSON.stringify(COG)); } catch {} }

/* ---------- anonymous usage analytics (research) ----------
   Write-only to Supabase `usage_events`. No names / PII — a random per-browser id
   only. Fire-and-forget; never blocks or breaks the UI if offline/unconfigured.   */
function cogRandId() {
  try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch {}
  return 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
const COGA_ANON = (() => { try { let a = localStorage.getItem('cs-anon-id'); if (!a) { a = cogRandId(); localStorage.setItem('cs-anon-id', a); } return a; } catch { return cogRandId(); } })();
const COGA_SESSION = cogRandId();
let COGA_sessionLogged = false;
function cogTrack(event, props) {
  try {
    const sb = window.__cortexSB;
    if (!sb || !sb.from) return;
    sb.from('usage_events').insert({
      anon_id: COGA_ANON,
      session_id: COGA_SESSION,
      app_version: (typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''),
      section: 'cogpsych',
      event,
      props: props || {},
    }).then(() => {}, () => {});   // fire-and-forget
  } catch {}
}

let cogTimer = null;
let cogKeyHandler = null;
function cogUnbindKey() { if (cogKeyHandler) { document.removeEventListener('keydown', cogKeyHandler); cogKeyHandler = null; } }
function cogBindKey(fn) { cogUnbindKey(); cogKeyHandler = fn; document.addEventListener('keydown', fn); }
// every view transition runs cogClearTimer() first, so this is the single chokepoint that
// also tears down the previous question's keydown handler (prevents stale-handler leaks).
function cogClearTimer() { if (cogTimer) { clearInterval(cogTimer); cogTimer = null; } cogUnbindKey(); }

/* ---------- spaced-repetition box model ---------- */
const COG_INTERVAL_H = [0, 0.3, 4, 24, 72, 168]; // Leitner review intervals (hours) by box
function cogQ(id) { return COG.q[id] || (COG.q[id] = { box: 0, a: 0, c: 0, ts: 0 }); }
function cogBox(id) { return (COG.q[id] && COG.q[id].box) || 0; }
function cogComp(list) { if (!list.length) return 0; return Math.round(list.reduce((s, q) => s + cogBox(q.id), 0) / (list.length * 5) * 100); }
function cogChapterQs(ch) { return COG_BANK.filter(q => q.chapter === ch); }
function cogHyQs() {
  if (Array.isArray(COG_HY) && COG_HY.length) return COG_HY;
  return COG_BANK.filter(q => q.hy === true);
}
function cogHyMastery() { return cogComp(cogHyQs()); }
let COG_POOL_FILTER = null;
function cogActiveBank() { return COG_POOL_FILTER || COG_BANK; }

function cogTopicQs(t) { return COG_BANK.filter(q => q.topic === t); }
function cogMastery(ch) { return cogComp(cogChapterQs(ch)); }
function cogOverall() { return cogComp(COG_BANK); }
function cogAccuracy() { return COG.answered ? Math.round(COG.correct / COG.answered * 100) : 0; }
function cogReadyGate() {
  const seen = COG_BANK.filter(q => COG.q[q.id] && COG.q[q.id].a > 0).length;
  const topicFloor = Object.keys(COG_TOPICS).every(topic => {
    const qs = cogTopicQs(topic); return qs.length && cogComp(qs) >= 80;
  });
  return { seen, allSeen: seen === COG_BANK.length, topicFloor };
}

function cogStatus() {
  const c = cogOverall();
  const gate = cogReadyGate();
  if (c >= 90 && gate.allSeen && gate.topicFloor) return { c, label: 'COURSE MASTERED', cls: 'ready' };
  if (c >= 90 && !gate.allSeen) return { c, label: 'Finish full coverage', cls: 'almost' };
  if (c >= 90 && !gate.topicFloor) return { c, label: 'Raise weak topics', cls: 'almost' };
  if (c >= 75) return { c, label: 'Almost there', cls: 'almost' };
  if (c >= 50) return { c, label: 'Solid progress', cls: 'building' };
  if (c > 0) return { c, label: 'Getting started', cls: 'start' };
  return { c, label: 'Not started', cls: 'none' };
}

/* weakest topics first (only count topics that exist in the bank) */
function cogWeakTopics() {
  return Object.keys(COG_TOPICS)
    .map(t => { const qs = cogTopicQs(t); return { topic: t, name: COG_TOPICS[t].name, ch: COG_TOPICS[t].ch, comp: cogComp(qs), n: qs.length, seen: qs.filter(q => { const r = COG.q[q.id]; return r && r.a > 0; }).length }; })
    .filter(x => x.n > 0)
    .sort((a, b) => a.comp - b.comp || b.n - a.n);
}

/* adaptive selection: weak + unseen + due-for-review, interleaved */
function cogSmartPool(n) {
  const now = Date.now();
  const scored = COG_BANK.map(q => {
    const r = COG.q[q.id], box = r ? r.box : 0, ts = r ? r.ts : 0;
    const ageH = ts ? (now - ts) / 3.6e6 : 1e6;
    const due = box === 0 || ageH >= COG_INTERVAL_H[box];
    const pr = (5 - box) * 12 + (box === 0 ? 40 : 0) + (due ? 8 : -40) + Math.random() * 6;
    return { q, pr };
  });
  scored.sort((a, b) => b.pr - a.pr);
  return cogShuffle(scored.slice(0, Math.max(n, 1)).map(s => s.q)); // interleave the chosen set
}

function cogShuffle(a) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

/* ---------- ranks ---------- */
const COG_RANKS = [
  { min: 0, name: 'Armchair Philosopher' }, { min: 150, name: 'Introspectionist' }, { min: 400, name: 'Behaviorist' },
  { min: 800, name: 'Cognitivist' }, { min: 1400, name: 'Experimentalist' }, { min: 2200, name: 'Psychophysicist' },
  { min: 3200, name: 'Cognitive Scientist' }, { min: 4500, name: 'Cognitive Neuroscientist' }, { min: 6200, name: 'Mind Theorist' },
  { min: 8500, name: 'Master of Cognition' },
];
function cogRank(xp) {
  let idx = 0; for (let i = 0; i < COG_RANKS.length; i++) if (xp >= COG_RANKS[i].min) idx = i;
  const cur = COG_RANKS[idx], next = COG_RANKS[idx + 1] || null;
  const span = next ? next.min - cur.min : 1, into = next ? xp - cur.min : 1;
  return { lvl: idx + 1, name: cur.name, pct: next ? Math.max(2, Math.round(into / span * 100)) : 100, toNext: next ? next.min - xp : 0, next: next ? next.min : null };
}

/* ---------- achievements ---------- */
const COG_ACH = [
  { id: 'first', name: 'First Insight', desc: 'Answer your first question' },
  { id: 'combo5', name: 'On a Roll', desc: 'Reach a 5× combo' },
  { id: 'combo10', name: 'Chain Reaction', desc: 'Reach a 10× combo' },
  { id: 'blitz500', name: 'Blitz Master', desc: 'Score 500+ in one Blitz' },
  { id: 'smart', name: 'Study Smart', desc: 'Finish a Smart Review session' },
  { id: 'perfect', name: 'Flawless', desc: 'Finish a run 100% correct (8+ Q)' },
  { id: 'stm', name: 'Memory Buffer', desc: 'Reach 100% mastery on Short-Term & Working Memory' },
  { id: 'ltm', name: 'Long Haul', desc: 'Reach 100% mastery on Long-Term Memory' },
  { id: 'autobio', name: 'Life Story', desc: 'Reach 100% mastery on Autobiographical Memory' },
  { id: 'knowledge', name: 'Knowledge Architect', desc: 'Reach 100% mastery on Knowledge' },
  { id: 'survey', name: 'Field Master', desc: 'Reach 100% mastery on every chapter' },
  { id: 'exam', name: 'Boss Cleared', desc: 'Beat the Mastery Boss (85%+)' },
  { id: 'scholar', name: 'Course Scholar', desc: 'Complete every lesson in the course' },
  { id: 'ready', name: 'Course Mastered', desc: 'See every question, hold every topic at 80%+, and reach 90% overall' },
  { id: 'cogscientist', name: 'Certified Cognitive Scientist', desc: 'Reach the Cognitive Neuroscientist level' },
];
function cogGrant(id) {
  if (COG.ach.includes(id)) return;
  COG.ach.push(id); cogSave();
  const a = COG_ACH.find(x => x.id === id);
  if (a) cogToast(`Achievement unlocked · ${a.name}`);
}
function cogToast(msg) {
  const t = el(`<div class="gen-toast">${esc(msg)}</div>`);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 350); }, 2300);
}
function cogCheckAch() {
  if (cogMastery(6) >= 100) cogGrant('stm');
  if (cogMastery(7) >= 100) cogGrant('ltm');
  if (cogMastery(8) >= 100) cogGrant('autobio');
  if (cogMastery(9) >= 100) cogGrant('knowledge');
  if (Object.keys(COG_CH).map(Number).every(ch => cogMastery(ch) >= 100)) cogGrant('survey');
  if (cogRank(COG.xp).lvl >= 8) cogGrant('cogscientist');
  const gate = cogReadyGate();
  if (cogOverall() >= 90 && gate.allSeen && gate.topicFloor) { cogGrant('ready'); if (!COG.mastered) { COG.mastered = true; cogSave(); cogTrack('milestone', { kind: 'course_mastered', competency: cogOverall(), seen: gate.seen }); } }
}

function cogBumpStreak() {
  const d = new Date(), today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const s = COG.streak; if (s.lastDate === today) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  s.current = s.lastDate === `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}` ? s.current + 1 : 1;
  s.lastDate = today; if (s.current > s.longest) s.longest = s.current;
}

/* record an answered question; updates box + xp */
function cogRecord(qq, right) {
  COG.answered++; if (right) COG.correct++;
  const r = cogQ(qq.id); r.a++; r.ts = Date.now();
  if (right) { r.c++; r.box = Math.min(5, r.box + 1); r.lastWrong = false; } else { r.box = Math.max(0, r.box - 1); r.lastWrong = true; }
  const diff = qq.difficulty === 'hard' ? 6 : qq.difficulty === 'med' ? 3 : 0;
  const xp = right ? 10 + (qq.type === 'calc' ? 5 : qq.type === 'label' ? 3 : 0) + diff : 1;
  COG.xp += xp;
  if (!COG.ach.includes('first')) cogGrant('first');
  return xp;
}

/* ============================================================================
   ENTRY + PASSWORD GATE
   ========================================================================= */
let cogBankReady = false, cogBankFailed = false;
function cogValidBankItem(q, seen) {
  const topic = q && COG_TOPICS[q.topic];
  return q && typeof q === 'object'
    && typeof q.id === 'string' && q.id && !seen.has(q.id)
    && typeof q.q === 'string' && q.q
    && typeof q.topic === 'string' && topic
    && Number.isInteger(q.chapter) && q.chapter === topic.ch && COG_CH[q.chapter]
    && Array.isArray(q.options) && q.options.length === 4 && q.options.every(o => typeof o === 'string' && o.length)
    && Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3
    && typeof q.explain === 'string' && q.explain.length
    && typeof q.hint === 'string' && q.hint.length
    && typeof q.tag === 'string' && q.tag.length;
}
async function cogLoadBank() {
  try {
    const r = await fetch('data/cogpsych-bank.json?v=4');
    if (!r.ok) throw new Error('http ' + r.status);
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error('bad bank');   // an empty array is valid (no content yet)
    const seen = new Set(COG_DIAGRAMS.concat(COG_GENERATORS).map(q => q.id)), valid = [];
    for (const q of data) {
      if (!cogValidBankItem(q, seen)) continue;
      seen.add(q.id);
      if (q.type !== 'concept' && q.type !== 'calc' && q.type !== 'label') q.type = 'concept';
      if (q.difficulty !== 'easy' && q.difficulty !== 'med' && q.difficulty !== 'hard') q.difficulty = 'med';
      valid.push(q);
    }
    if (data.length && !valid.length) throw new Error('no valid bank items');   // non-empty but all malformed -> failure screen
    COG_GENERATED = valid;
    COG_BANK = COG_DIAGRAMS.concat(COG_GENERATED).concat(COG_GENERATORS);
    cogBankReady = true; cogBankFailed = false;
  } catch (e) { cogBankFailed = true; }
}
function cogLoadingScreen() {
  const root = el('<div></div>'); root.appendChild(topbar('cogpsych'));
  root.appendChild(el('<main class="panel gen-lock" id="main" tabindex="-1"><div class="gen-lock-box cornerframe"><span class="label">Cognitive Psychology</span><p class="gen-lock-sub">Loading course…</p></div></main>'));
  root.appendChild(siteFooter()); setView(root);
}
function cogBankError() {
  const root = el('<div></div>'); root.appendChild(topbar('cogpsych'));
  const main = el('<main class="panel gen-lock" id="main" tabindex="-1"><div class="gen-lock-box cornerframe"><span class="label">Cognitive Psychology</span><p class="gen-lock-sub">Couldn\'t load the question bank — check your connection.</p><button class="btn btn-solid" id="gen-retry">Retry</button></div></main>');
  main.querySelector('#gen-retry').addEventListener('click', () => { cogBankFailed = false; renderCogPsych(); });
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}
function renderCogPsych() {
  cogClearTimer();
  const lessonsPending = typeof cogLoadLessons === 'function' && !cogLearnReady;
  if (!cogBankReady || lessonsPending) {
    if (cogBankFailed) { cogBankError(); return; }
    cogLoadingScreen();
    const loads = [];
    if (!cogBankReady) loads.push(cogLoadBank());
    if (lessonsPending) loads.push(cogLoadLessons());
    Promise.all(loads).then(renderCogPsych);
    return;
  }
  if (!COG_BANK.length) { renderCogEmpty(); return; }
  renderCogHome();
}

function renderCogEmpty() {
  cogClearTimer();
  const root = el('<div></div>'); root.appendChild(topbar('cogpsych'));
  const main = el(`<main class="panel gen-lock" id="main" tabindex="-1"><div class="gen-lock-box cornerframe"><span class="label">Cognitive Psychology</span><h1 class="gen-lock-title">Coming soon</h1><p class="gen-lock-sub">Questions are being added. Check back shortly.</p></div></main>`);
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

/* ============================================================================
   HOME / DASHBOARD
   ========================================================================= */
function renderCogHome() {
  cogClearTimer();
  COG_POOL_FILTER = null;
  if (!COGA_sessionLogged) { COGA_sessionLogged = true; cogTrack('session_start', { competency: cogOverall(), mastered: COG_BANK.filter(q => cogBox(q.id) >= 5).length, total: COG_BANK.length, mobile: (window.innerWidth || 0) < 700 }); }
  const status = cogStatus();
  const missCount = cogMissPool().length, starredCount = cogStarredList().length;
  const lessons = (typeof COG_LESSONS !== 'undefined' ? COG_LESSONS : [])
    .filter(l => COG_CH[l.chapter]);
  const lessonDone = lessons.filter(l => cogglDone(l.id)).length;
  const coursePct = lessons.length ? Math.round(lessonDone / lessons.length * 100) : 0;
  const nextLesson = lessons.find(l => !cogglDone(l.id)) || lessons[0] || null;
  const currentChapter = nextLesson ? nextLesson.chapter : 1;
  const chapterRows = Object.keys(COG_CH).map(Number).sort((a, b) => a - b).map(ch => {
    const chapterLessons = lessons.filter(l => l.chapter === ch);
    const complete = chapterLessons.filter(l => cogglDone(l.id)).length;
    const state = chapterLessons.length && complete === chapterLessons.length
      ? 'done' : ch === currentChapter ? 'current' : '';
    const action = state === 'done' ? 'Review' : complete ? 'Continue' : 'Explore';
    return `<button class="cog-chapter-row ${state}" data-course-chapter="${ch}">
      <span class="cog-chapter-num mono">${String(ch).padStart(2, '0')}</span>
      <span class="cog-chapter-copy">
        <strong>${esc(COG_CH[ch])}</strong>
        <span>Chapter ${ch} · ${chapterLessons.length} ${chapterLessons.length === 1 ? 'lesson' : 'lessons'}</span>
      </span>
      <span class="cog-chapter-progress">
        <span class="cog-chapter-progress-copy">${complete}/${chapterLessons.length} complete</span>
        <span class="cog-chapter-action">${action} →</span>
      </span>
    </button>`;
  }).join('');

  const root = el('<div></div>');
  root.appendChild(topbar('cogpsych'));
  const main = el(`<main class="panel gen-home cog-course-home" id="main" tabindex="-1">
    <header class="cog-simple-hero">
      <span class="label">Cortex open course</span>
      <h1>Cognitive Psychology</h1>
      <p>Learn how the mind perceives, remembers, uses language, solves problems, and makes decisions.</p>
      <div class="cog-simple-progress" aria-label="Course progress">
        <span><strong>${lessonDone} of ${lessons.length}</strong> lessons complete</span>
        <span class="mono">${coursePct}%</span>
        <span class="cog-course-bar"><i style="width:${coursePct}%"></i></span>
      </div>
      <div class="cog-course-actions">
        <button class="btn btn-solid" data-course-action="continue">${lessonDone ? 'Continue course' : 'Start course'} →</button>
        <button class="ghostbtn" data-course-action="browse">Browse all lessons</button>
      </div>
    </header>

    <section class="cog-simple-syllabus">
      <div class="cog-simple-section-head"><span class="label">Course outline</span><span>${COG_CH && Object.keys(COG_CH).length} chapters · ${lessons.length} lessons</span></div>
      <div class="cog-chapter-list">${chapterRows}</div>
    </section>

    <details class="cog-simple-fold">
      <summary><span><strong>Practice</strong><small>Optional review tools</small></span><i>Open</i></summary>
      <div class="cog-practice-list">
        <button data-mode="smart"><strong>Smart Review</strong><span>Adaptive review</span></button>
        <button data-mode="chapter"><strong>Practice by topic</strong><span>Choose a subject</span></button>
        <button data-mode="misses"><strong>Revisit questions</strong><span>${missCount ? `${missCount} waiting` : 'No misses yet'}</span></button>
        <button data-mode="blitz"><strong>Quick recall</strong><span>90 seconds</span></button>
        <button data-mode="exam"><strong>Course challenge</strong><span>20 mixed questions${COG.bestExam ? ` · best ${COG.bestExam}%` : ''}</span></button>
      </div>
    </details>

    <details class="cog-records">
      <summary><span><strong>Progress, records & achievements</strong><small>Course completion, practice history, saved questions, and milestones</small></span><i>Open</i></summary>
      <div class="cog-record-stats">
        <div><strong class="mono">${lessonDone}/${lessons.length}</strong><span>Lessons complete</span></div>
        <div><strong class="mono">${status.c}%</strong><span>Knowledge retention</span></div>
        <div><strong class="mono">${cogAccuracy()}%</strong><span>Practice accuracy</span></div>
        <div><strong class="mono">${COG.streak.current}</strong><span>Day streak</span></div>
      </div>
      ${status.cls === 'ready' ? `<p class="cog-course-mastered">Course knowledge mastered · ${status.c}% retained</p>` : ''}
      <div class="cog-record-actions">
        <button class="ghostbtn" data-mode="stats">View detailed stats →</button>
        <button class="ghostbtn" data-mode="starred">★ Saved questions (${starredCount})</button>
      </div>
      <div class="gen-trophy">
        <span class="label">Achievements · ${COG.ach.length}/${COG_ACH.length}</span>
        <div class="gen-badges">
          ${COG_ACH.map(a => { const got = COG.ach.includes(a.id); return `<div class="gen-badge ${got ? 'got' : ''}" title="${esc(a.desc)}"><span class="gen-badge-name">${esc(a.name)}</span><span class="gen-badge-desc">${esc(a.desc)}</span></div>`; }).join('')}
        </div>
      </div>
    </details>

    <p class="gen-foot-note">A free Cortex course in the science of the mind. <button class="ghostbtn" id="gen-reset">Reset progress</button></p>
  </main>`);

  main.querySelectorAll('[data-course-action]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.courseAction === 'continue' && nextLesson) renderCogLesson(nextLesson.id);
    else renderCogLearnHome();
  }));
  main.querySelectorAll('[data-course-chapter]').forEach(b => b.addEventListener('click', () => renderCogLearnHome(Number(b.dataset.courseChapter))));

  main.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    const m = b.dataset.mode;
    if (m === 'learn') renderCogLearnHome();
    else if (m === 'smart') startCogSmart();
    else if (m === 'blitz') startCogBlitz();
    else if (m === 'chapter') renderCogChapterPick();
    else if (m === 'exam') startCogExam();
    else if (m === 'misses') startCogMisses();
    else if (m === 'stats') renderCogStats();
    else if (m === 'starred') startCogStarred();
  }));
  main.querySelectorAll('[data-topic]').forEach(b => b.addEventListener('click', () => startCogTopic(b.dataset.topic)));
  main.querySelector('#gen-reset').addEventListener('click', () => {
    if (!confirm('Reset all Cognitive Psychology progress (XP, mastery, lessons, achievements)?')) return;
    COG = Object.assign({ module: COG_MODULE, xp: 0, answered: 0, correct: 0, bestScore: 0, bestCombo: 0, bestExam: 0, plays: 0, streak: { current: 0, longest: 0, lastDate: '' }, q: {}, starred: {}, learned: {}, ach: [], mastered: false });
    cogSave(); renderCogHome();
  });
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

/* ============================================================================
   CHAPTER PICKER
   ========================================================================= */
function renderCogChapterPick() {
  cogClearTimer();
  const card = (key) => { const t = COG_TOPICS[key], qs = cogTopicQs(key); return `<button class="gen-ch-card cornerframe" data-topic="${key}">
    <span class="gen-ch-num mono">${t.ch}</span><h2>${esc(t.name)}</h2><p>${esc(t.blurb)}</p>
    <div class="gen-meter"><div class="gen-bar"><span style="width:${cogComp(qs)}%"></span></div></div>
    <span class="mono gen-ch-pct">${cogComp(qs)}% · ${qs.length} Q</span></button>`; };
  // grouped by chapter so ~70 topic cards stay navigable
  const chBlocks = Object.keys(COG_CH).map(Number).sort((a, b) => a - b).map(ch => {
    const keys = Object.keys(COG_TOPICS).filter(key => COG_TOPICS[key].ch === ch && cogTopicQs(key).length);
    if (!keys.length) return '';
    return `<section class="gen-learn-ch">
      <span class="label">${ch} · ${esc(COG_CH[ch])}</span>
      <div class="gen-ch-grid">${keys.map(card).join('')}</div>
    </section>`;
  }).join('');
  const root = el('<div></div>');
  root.appendChild(topbar('cogpsych'));
  const main = el(`<main class="panel gen-pick" id="main" tabindex="-1">
    <div class="gen-pick-head"><button class="ghostbtn" id="gen-back">← Home</button><h1>Topics</h1></div>
    ${chBlocks}
  </main>`);
  main.querySelector('#gen-back').addEventListener('click', renderCogHome);
  main.querySelectorAll('[data-topic]').forEach(b => b.addEventListener('click', () => startCogTopic(b.dataset.topic)));
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

/* ============================================================================
   GAME RUNS
   ========================================================================= */
function startCogSmart() {
  cogBumpStreak(); COG.plays++; cogSave();
  // Endless adaptive loop: serve the single most-needed (weakest/due/unseen) question
  // each time, forever, until every question is fully mastered (box 5).
  cogTrack('mode_start', { mode: 'smart' });
  cogRunQuestion({ mode: 'smart', endless: true, pool: [], retryQ: [], idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false, lastId: null, lastTopic: null });
}
function startCogBlitz() {
  cogBumpStreak(); COG.plays++; cogSave();
  cogTrack('mode_start', { mode: 'blitz' });
  cogRunQuestion({ mode: 'blitz', pool: cogShuffle(COG_BANK), idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, timeLeft: 90, locked: false });
}
function startCogChapter(ch) {
  COG.plays++; cogSave();
  cogTrack('mode_start', { mode: 'chapter', chapter: ch });
  cogRunQuestion({ mode: 'chapter', chapter: ch, pool: cogShuffle(cogChapterQs(ch)), idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false });
}
function startCogTopic(t) {
  COG.plays++; cogSave();
  cogTrack('mode_start', { mode: 'topic', topic: t });
  cogRunQuestion({ mode: 'topic', topic: t, pool: cogShuffle(cogTopicQs(t)), idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false });
}
function startCogExam() {
  cogBumpStreak(); COG.plays++; cogSave();
  const chs = Object.keys(COG_CH).map(Number);
  const per = Math.ceil(20 / Math.max(1, chs.length));
  let pool = [];
  chs.forEach(ch => { pool = pool.concat(cogShuffle(cogChapterQs(ch)).slice(0, per)); });
  pool = cogShuffle(pool).slice(0, 20);
  if (pool.length < 20) { const have = new Set(pool.map(q => q.id)); pool = pool.concat(cogShuffle(COG_BANK).filter(q => !have.has(q.id)).slice(0, 20 - pool.length)); }
  cogTrack('mode_start', { mode: 'exam', n: pool.length });
  cogRunQuestion({ mode: 'exam', pool, idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, lives: 4, maxLives: 4, locked: false });
}
/* ---------- review misses, starred, stats ---------- */
function cogMissPool() { return COG_BANK.filter(q => { const r = COG.q[q.id]; return r && r.lastWrong; }); }
function cogMockWrongPool(responses) {
  const ids = new Set((responses || []).filter(r => !r.right).map(r => r.id));
  return COG_BANK.filter(q => ids.has(q.id));
}
function cogStarredList() { return COG_BANK.filter(q => COG.starred && COG.starred[q.id]); }
function cogToggleStar(id) { if (!COG.starred) COG.starred = {}; if (COG.starred[id]) delete COG.starred[id]; else COG.starred[id] = 1; cogSave(); return !!COG.starred[id]; }
function cogEmpty(title, msg) {
  cogClearTimer();
  const root = el('<div></div>'); root.appendChild(topbar('cogpsych'));
  const main = el(`<main class="panel gen-result" id="main" tabindex="-1"><div class="gen-res-box cornerframe"><span class="label">${esc(title)}</span><p class="gen-empty-msg">${esc(msg)}</p><div class="gen-res-btns"><button class="btn btn-solid" id="gen-homebtn">Back to home</button></div></div></main>`);
  main.querySelector('#gen-homebtn').addEventListener('click', renderCogHome);
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}
function startCogMisses() {
  const pool = cogShuffle(cogMissPool());
  if (!pool.length) { cogEmpty('Review misses', 'No misses to review right now — nice work. Play a mode to surface your weak spots, then come back.'); return; }
  COG.plays++; cogSave();
  cogRunQuestion({ mode: 'misses', pool, idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false });
}
function startCogStarred() {
  const pool = cogShuffle(cogStarredList());
  if (!pool.length) { cogEmpty('Starred questions', "You haven't starred any questions yet. Tap the star on any question to save it here for later."); return; }
  COG.plays++; cogSave();
  cogRunQuestion({ mode: 'starred', pool, idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false });
}
function renderCogStats() {
  cogClearTimer();
  const topicRows = Object.keys(COG_TOPICS).map(t => {
    const qs = cogTopicQs(t); if (!qs.length) return '';
    let a = 0, c = 0, m = 0; qs.forEach(q => { const r = COG.q[q.id]; if (r) { a += r.a; c += r.c; if (r.box >= 4) m++; } });
    const acc = a ? Math.round(c / a * 100) : 0;
    return `<div class="gen-srow"><span class="gen-srow-name">${esc(COG_TOPICS[t].name)}</span><span class="gen-srow-bar"><span style="width:${cogComp(qs)}%"></span></span><span class="mono gen-srow-vals">${cogComp(qs)}% · ${acc}% acc · ${m}/${qs.length}</span></div>`;
  }).join('');
  const maxed = COG_BANK.filter(q => COG.q[q.id] && COG.q[q.id].box >= 5).length;
  const root = el('<div></div>'); root.appendChild(topbar('cogpsych'));
  const main = el(`<main class="panel gen-pick" id="main" tabindex="-1">
    <div class="gen-pick-head"><button class="ghostbtn" id="gen-back">← Home</button><h1>Your stats</h1></div>
    <div class="gen-statrow">
      <div class="gen-stat"><span class="gen-stat-n mono">${cogOverall()}%</span><span class="gen-stat-l">Competency</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${cogAccuracy()}%</span><span class="gen-stat-l">Accuracy</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${COG.answered.toLocaleString()}</span><span class="gen-stat-l">Answered</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${maxed}/${COG_BANK.length}</span><span class="gen-stat-l">Maxed out</span></div>
    </div>
    <section class="gen-mastery cornerframe"><span class="label">By topic — competency · accuracy · strong</span>${topicRows}</section>
    <div class="gen-res-btns gen-stats-actions"><button class="btn" id="gen-misses2">Review my misses (${cogMissPool().length})</button><button class="btn" id="gen-starred2">★ Starred (${cogStarredList().length})</button></div>
  </main>`);
  main.querySelector('#gen-back').addEventListener('click', renderCogHome);
  main.querySelector('#gen-misses2').addEventListener('click', startCogMisses);
  main.querySelector('#gen-starred2').addEventListener('click', startCogStarred);
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

function cogComboMult(combo) { return Math.min(5, 1 + Math.floor(combo / 3)); }

// Endless Smart Review: pick the one most-needed question right now. Weakest box
// first, then due-for-review, lightly interleaved, never the same one twice in a row.
// Returns null once everything is fully mastered (box 5).
function cogNextSmart(run) {
  // In-session requeue (Quizlet-style): a missed question cycles back within 2-3 questions,
  // ahead of the normal adaptive pick, and reappears with its "think it through" hint.
  if (run.retryQ && run.retryQ.length) {
    const i = run.retryQ.findIndex(r => r.due <= run.answered);
    if (i >= 0) { const r = run.retryQ.splice(i, 1)[0]; run.lastId = r.q.id; run.lastTopic = r.q.topic; return r.q; }
  }
  const now = Date.now();
  const bankSrc = (typeof cogActiveBank === 'function' ? cogActiveBank() : COG_BANK);
  const pool = bankSrc.filter(q => cogBox(q.id) < 5);
  if (!pool.length) {
    // everything mastered but a retry is still pending -> serve it rather than ending
    if (run.retryQ && run.retryQ.length) { const r = run.retryQ.shift(); run.lastId = r.q.id; run.lastTopic = r.q.topic; return r.q; }
    return null;
  }
  let best = null, bestPr = -1e9;
  for (const q of pool) {
    const r = COG.q[q.id], box = r ? r.box : 0, ts = r ? r.ts : 0;
    const ageH = ts ? (now - ts) / 3.6e6 : 1e6;
    const due = box === 0 || ageH >= COG_INTERVAL_H[box];
    let pr = (5 - box) * 12 + (box === 0 ? 30 : 0) + (due ? 8 : -30) + Math.random() * 6;
    if (q.id === run.lastId) pr -= 100;                         // no immediate repeat
    if (run.lastTopic && q.topic === run.lastTopic) pr -= 4;    // light interleaving
    if (pr > bestPr) { bestPr = pr; best = q; }
  }
  run.lastId = best.id; run.lastTopic = best.topic;
  return best;
}

function cogSmartComplete(run) {
  cogClearTimer(); cogGrant('smart'); cogCheckAch(); cogSave();
  const bankSrc = cogActiveBank();
  const comp = cogComp(bankSrc);
  cogTrack('milestone', { kind: 'fully_mastered' });
  cogTrack('run_end', { mode: 'smart', answered: run.answered, correct: run.correct, maxCombo: run.maxCombo, competency: comp, scope: bankSrc.length });
  const root = el('<div></div>');
  root.appendChild(topbar('cogpsych'));
  const main = el(`<main class="panel gen-result" id="main" tabindex="-1">
    <div class="gen-res-box cornerframe">
      <span class="label">Fully mastered</span>
      <h1 class="gen-res-sub">All ${bankSrc.length} questions maxed</h1>
      <div class="gen-res-grid">
        <div><span class="mono">${comp}%</span><span>competency</span></div>
        <div><span class="mono">${run.correct}/${run.answered}</span><span>this session</span></div>
        <div><span class="mono">${run.maxCombo}×</span><span>best streak</span></div>
        <div><span class="mono">${COG.xp.toLocaleString()}</span><span>total XP</span></div>
      </div>
      <p class="gen-res-ready">Every question is maxed out — you mastered the material. Run a maintenance pass anytime to stay sharp.</p>
      <div class="gen-res-btns">
        <button class="btn btn-solid" id="gen-maint">Maintenance pass</button>
        <button class="btn" id="gen-homebtn">Home</button>
      </div>
    </div>
  </main>`);
  main.querySelector('#gen-homebtn').addEventListener('click', renderCogHome);
  main.querySelector('#gen-maint').addEventListener('click', () => cogRunQuestion({ mode: 'smart', pool: cogShuffle(bankSrc), idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false }));
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

/* ---------- calc tools: mini calculator + scratchpad (calc questions only) ---------- */
let cogToolsOpen = false;   // panel open-state persists across questions in a session
let cogScratch = '';        // scratchpad text persists across questions in a session
function cogToolsHtml() {
  const keys = ['C', '←', '(', ')', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+'];
  const dk = { 'C': 'clear', '←': 'back', '=': 'eq' };
  const cl = { 'C': 'gen-calc-fn', '←': 'gen-calc-fn', '=': 'gen-calc-eq', '÷': 'gen-calc-op', '×': 'gen-calc-op', '−': 'gen-calc-op', '+': 'gen-calc-op' };
  const grid = keys.map(k => `<button type="button" class="gen-calc-key ${cl[k] || ''}" data-k="${dk[k] || k}">${k}</button>`).join('');
  return `<div class="gen-tools">
      <button type="button" class="gen-tools-toggle" id="gen-tools-toggle">${cogToolsOpen ? '▾' : '▸'} Calculator &amp; scratchpad</button>
      <div class="gen-tools-panel" id="gen-tools-panel"${cogToolsOpen ? '' : ' hidden'}>
        <div class="gen-calc">
          <input type="text" class="gen-calc-disp" id="gen-calc-disp" inputmode="none" readonly aria-label="Calculator display" />
          <div class="gen-calc-keys">${grid}</div>
        </div>
        <div class="gen-pad"><textarea class="gen-pad-area" id="gen-pad-area" rows="6" placeholder="Scratchpad — work it out here…"></textarea></div>
      </div>
    </div>`;
}
function cogCalcEval(expr) {
  if (!/^[-−0-9+*/×÷().%\s]*$/.test(expr)) return 'Error';
  const clean = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/%/g, '/100');
  if (!clean.trim()) return '';
  try {
    const v = Function('"use strict";return (' + clean + ')')();
    if (typeof v !== 'number' || !isFinite(v)) return 'Error';
    return String(Math.round(v * 1e6) / 1e6);
  } catch { return 'Error'; }
}
function cogWireTools(main) {
  const toggle = main.querySelector('#gen-tools-toggle');
  if (!toggle) return;
  const panel = main.querySelector('#gen-tools-panel');
  const disp = main.querySelector('#gen-calc-disp');
  const pad = main.querySelector('#gen-pad-area');
  toggle.addEventListener('click', () => {
    cogToolsOpen = panel.hidden; panel.hidden = !cogToolsOpen;
    toggle.textContent = (cogToolsOpen ? '▾' : '▸') + ' Calculator & scratchpad';
  });
  if (pad) { pad.value = cogScratch; pad.addEventListener('input', () => { cogScratch = pad.value; }); }
  let evaluated = false;
  main.querySelectorAll('.gen-calc-key').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.k;
    if (k === 'clear') { disp.value = ''; evaluated = false; return; }
    if (k === 'back') { disp.value = disp.value.slice(0, -1); evaluated = false; return; }
    if (k === 'eq') { disp.value = cogCalcEval(disp.value); evaluated = true; return; }
    if (disp.value === 'Error') disp.value = '';
    if (evaluated) { if (/[0-9.(]/.test(k)) disp.value = ''; evaluated = false; }
    disp.value += k;
  }));
}

function cogRunQuestion(run) {
  cogClearTimer();
  run.locked = false;
  let qq;
  if (run.endless) {
    qq = cogNextSmart(run);
    if (!qq) { cogSmartComplete(run); return; }
  } else {
    if (!run.pool.length) { cogEndRun(run); return; }
    if (run.mode === 'blitz') { if (run.idx >= run.pool.length) { run.pool = cogShuffle((run.sourcePool || COG_BANK).slice()); run.idx = 0; } }
    else if (run.idx >= run.pool.length) { cogEndRun(run); return; }
    qq = run.pool[run.idx];
  }
  if (qq && qq.make) qq = Object.assign({}, qq, qq.make());
  const showHint = run.mode !== 'mock' && !!((qq._retry || (COG.q[qq.id] && COG.q[qq.id].lastWrong)) && qq.hint);
  const order = cogShuffle([0, 1, 2, 3]);
  const correctDisp = order.indexOf(qq.answer);

  const root = el('<div></div>');
  root.appendChild(topbar('cogpsych'));
  const main = el(`<main class="panel gen-game" id="main" tabindex="-1">
    ${cogHud(run)}
    <div class="gen-q cornerframe" data-qid="${qq.id}">
      <div class="gen-q-meta"><span class="mono">${qq.chapter}</span><span class="gen-q-tag">${esc((COG_TOPICS[qq.topic] && COG_TOPICS[qq.topic].name) || 'Practice')}</span><span class="gen-q-diff gen-d-${qq.difficulty}">${qq.difficulty}</span>${qq.type === 'label' ? '<span class="gen-q-pic">diagram</span>' : ''}<button type="button" class="gen-star ${COG.starred && COG.starred[qq.id] ? 'on' : ''}" id="gen-star" aria-label="Star this question">${COG.starred && COG.starred[qq.id] ? '★' : '☆'}</button></div>
      ${qq.svg ? `<div class="gen-q-svg">${qq.svg}</div>` : ''}
      ${qq.fig && window.COG_FIGS && window.COG_FIGS[qq.fig] ? '<div class="gen-q-fig" id="gen-fig"></div>' : ''}
      <h2 class="gen-q-stem">${esc(qq.q)}</h2>
      ${showHint ? `<div class="gen-hint"><span class="gen-hint-lab">Think it through</span> ${esc(qq.hint)}</div>` : ''}
      <div class="gen-opts">
        ${order.map((origIdx, dispIdx) => `<button class="gen-opt" data-disp="${dispIdx}" data-ok="${dispIdx === correctDisp ? 1 : 0}"><span class="gen-opt-key mono">${String.fromCharCode(65 + dispIdx)}</span><span class="gen-opt-txt">${esc(qq.options[origIdx])}</span></button>`).join('')}
      </div>
      ${qq.type === 'calc' ? cogToolsHtml() : ''}
      <div class="gen-explain" id="gen-explain" hidden></div>
      <div class="gen-next-row" id="gen-next-row" hidden><button class="btn btn-solid" id="gen-next">Next →</button></div>
    </div>
  </main>`);

  const optsWrap = main.querySelector('.gen-opts');
  const explainBox = main.querySelector('#gen-explain');
  const nextRow = main.querySelector('#gen-next-row');

  const choose = (btn) => {
    if (run.locked) return;
    run.locked = true;
    const right = btn.dataset.ok === '1';
    const beforeBox = cogBox(qq.id);
    cogRecord(qq, right); run.answered++;
    if (right && run.mode !== 'blitz' && run.mode !== 'mock' && cogBox(qq.id) === 5 && beforeBox === 4) cogToast(`Mastered · ${qq.tag}`);
    cogTrack('answer', { mode: run.mode, qid: qq.id, chapter: qq.chapter, topic: qq.topic, type: qq.type, difficulty: qq.difficulty, correct: right ? 1 : 0 });
    if (run.mode === 'mock') {
      run.responses.push({ id: qq.id, chapter: qq.chapter, topic: qq.topic, selected: order[+btn.dataset.disp], right });
      if (right) run.correct++;
      [...optsWrap.querySelectorAll('.gen-opt')].forEach(o => { o.disabled = true; });
      btn.setAttribute('aria-pressed', 'true');
      btn.style.borderColor = 'var(--text)';
      btn.style.background = 'var(--surface)';
      cogSave();
      explainBox.innerHTML = '<span class="gen-ex-label">Answer locked</span> Correct answers stay hidden until the end.';
      explainBox.hidden = false;
      nextRow.hidden = false;
      const nb = main.querySelector('#gen-next');
      if (run.idx + 1 >= run.pool.length) nb.textContent = 'Finish exam →';
      nb.addEventListener('click', () => { run.idx++; cogRunQuestion(run); }); nb.focus();
      return;
    }
    [...optsWrap.querySelectorAll('.gen-opt')].forEach(o => { o.disabled = true; if (o.dataset.ok === '1') o.classList.add('correct'); else if (o === btn) o.classList.add('wrong'); });

    if (right) {
      run.correct++; run.combo++; if (run.combo > run.maxCombo) run.maxCombo = run.combo;
      if (run.combo > COG.bestCombo) COG.bestCombo = run.combo;
      if (run.combo === 5) cogGrant('combo5');
      if (run.combo === 10) cogGrant('combo10');
      const mult = cogComboMult(run.combo);
      const base = (qq.type === 'calc' ? 150 : qq.type === 'label' ? 130 : 100) + (qq.difficulty === 'hard' ? 50 : qq.difficulty === 'med' ? 25 : 0);
      run.score += base * mult;
      cogFlash(main, `+${base * mult}`, run.combo >= 3 ? `${mult}× COMBO` : '', true);
    } else {
      run.combo = 0; if (run.mode === 'exam' || run.mode === 'hy-boss') run.lives--;
      cogFlash(main, 'MISS', '', false);
      if (run.mode === 'chapter' || run.mode === 'topic' || run.mode === 'hy-all' || run.mode === 'hy-chapter' || run.mode === 'misses' || run.mode === 'starred') {
        const retry = Object.assign({}, qq); delete retry.make; retry._retry = true;
        run.pool.splice(Math.min(run.pool.length, run.idx + 1 + cogRand(1, 2)), 0, retry);
      } else if (run.endless) {
        // Smart Review: requeue the miss to reappear within 2-3 questions with its hint.
        const retry = Object.assign({}, qq); delete retry.make; retry._retry = true;
        (run.retryQ || (run.retryQ = [])).push({ q: retry, due: run.answered + cogRand(1, 2) });
      }
    }
    cogCheckAch(); cogSave();
    explainBox.innerHTML = `<span class="gen-ex-label">${right ? 'Correct' : 'Answer'}</span> ${esc(qq.explain)}`;
    explainBox.hidden = false;

    if ((run.mode === 'exam' || run.mode === 'hy-boss') && run.lives <= 0) {
      nextRow.hidden = false; const nb = main.querySelector('#gen-next'); nb.textContent = 'See results →';
      nb.addEventListener('click', () => cogEndRun(run)); nb.focus(); return;
    }
    if (run.mode === 'blitz') {
      setTimeout(() => { run.idx++; if (run.timeLeft > 0) cogRunQuestion(run); }, right ? 650 : 1100);
    } else {
      nextRow.hidden = false; const nb = main.querySelector('#gen-next');
      if (!run.endless && run.idx + 1 >= run.pool.length) nb.textContent = 'Finish →';
      nb.addEventListener('click', () => { run.idx++; cogRunQuestion(run); }); nb.focus();
    }
  };

  optsWrap.querySelectorAll('.gen-opt').forEach(b => b.addEventListener('click', () => choose(b)));
  const onKey = (e) => {
    // self-guard: if this question's view is gone (e.g. navigated away), retire this handler
    if (!document.body.contains(main)) { document.removeEventListener('keydown', onKey); if (cogKeyHandler === onKey) cogKeyHandler = null; return; }
    const tg = e.target;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable)) return;
    if (run.locked) { if (e.key === 'Enter' && !nextRow.hidden) main.querySelector('#gen-next')?.click(); return; }
    let k = -1;
    if (/^[a-dA-D]$/.test(e.key)) k = e.key.toLowerCase().charCodeAt(0) - 97;
    else if (/^[1-4]$/.test(e.key)) k = +e.key - 1;
    if (k >= 0) { const b = optsWrap.querySelector(`.gen-opt[data-disp="${k}"]`); if (b) choose(b); }
  };
  cogWireTools(main);
  const starBtn = main.querySelector('#gen-star'); if (starBtn) starBtn.addEventListener('click', (e) => { const on = cogToggleStar(qq.id); e.currentTarget.textContent = on ? '★' : '☆'; e.currentTarget.classList.toggle('on', on); });
  cogBindKey(onKey);   // replaces any previous question's handler

  root.appendChild(main); root.appendChild(siteFooter()); setView(root);

  // mount the interactive figure (if this question has one) above the stem
  if (qq.fig && window.COG_FIGS && window.COG_FIGS[qq.fig]) {
    const figHost = main.querySelector('#gen-fig');
    if (figHost) { try { window.COG_FIGS[qq.fig](figHost); } catch (e) { figHost.remove(); } }
  }

  if (run.mode === 'blitz') {
    const tEl = main.querySelector('#gen-time');
    cogTimer = setInterval(() => {
      if (!document.body.contains(main)) { cogClearTimer(); return; }
      run.timeLeft--;
      if (tEl) { tEl.textContent = run.timeLeft; if (run.timeLeft <= 10) tEl.classList.add('low'); }
      if (run.timeLeft <= 0) { cogClearTimer(); cogEndRun(run); }
    }, 1000);
  }
}

function cogHud(run) {
  const quit = `<button class="ghostbtn gen-quit" id="cog-quit">✕ ${run.mode === 'blitz' || run.mode === 'exam' || run.mode === 'hy-boss' || run.mode === 'mock' ? 'Quit' : 'Exit'}</button>`;
  if (run.mode === 'blitz') return `<div class="gen-hud">${quit}
    <div class="gen-hud-time"><span class="mono" id="gen-time">${run.timeLeft}</span><span class="gen-hud-l">sec</span></div>
    <div class="gen-hud-score"><span class="mono">${run.score}</span><span class="gen-hud-l">score</span></div>
    <div class="gen-hud-combo ${run.combo >= 3 ? 'hot' : ''}"><span class="mono">${run.combo}×</span><span class="gen-hud-l">combo</span></div></div>`;
  if (run.mode === 'exam' || run.mode === 'hy-boss') return `<div class="gen-hud">${quit}
    <div class="gen-hud-q"><span class="mono">${run.idx + 1}/${run.pool.length}</span><span class="gen-hud-l">${run.mode === 'hy-boss' ? 'High Yield boss' : 'question'}</span></div>
    <div class="gen-hud-lives">${'◆'.repeat(Math.max(0, run.lives))}${'◇'.repeat(Math.max(0, (run.maxLives || 4) - run.lives))}</div>
    <div class="gen-hud-score"><span class="mono">${run.correct}</span><span class="gen-hud-l">correct</span></div></div>`;
  if (run.mode === 'mock') return `<div class="gen-hud">${quit}
    <div class="gen-hud-q"><span class="mono">${run.idx + 1}/${run.pool.length}</span><span class="gen-hud-l">Module 2 mock</span></div>
    <div class="gen-hud-score"><span class="mono">${run.answered}</span><span class="gen-hud-l">answers saved</span></div></div>`;
  if (run.mode === 'smart' && run.endless) {
    const bankSrc = (typeof cogActiveBank === 'function' ? cogActiveBank() : COG_BANK);
    const mastered = bankSrc.filter(q => cogBox(q.id) >= 5).length;
    return `<div class="gen-hud">${quit}
    <div class="gen-hud-q"><span class="mono">${mastered}/${bankSrc.length}</span><span class="gen-hud-l">mastered</span></div>
    <div class="gen-hud-q"><span class="mono">${cogComp(bankSrc)}%</span><span class="gen-hud-l">competency</span></div>
    <div class="gen-hud-combo ${run.combo >= 3 ? 'hot' : ''}"><span class="mono">${run.combo}×</span><span class="gen-hud-l">streak</span></div>
    <div class="gen-hud-score"><span class="mono">${run.correct}/${run.answered}</span><span class="gen-hud-l">correct</span></div></div>`;
  }
  const label = run.mode === 'smart' ? 'Smart Review' : run.mode === 'hy-all' ? 'High Yield' : run.mode === 'hy-chapter' ? `High Yield · Ch ${run.chapter}` : run.mode === 'misses' ? 'Review misses' : run.mode === 'starred' ? 'Starred' : run.mode === 'topic' ? (COG_TOPICS[run.topic] ? COG_TOPICS[run.topic].name : 'Drill') : `Ch ${run.chapter}`;
  return `<div class="gen-hud">${quit}
    <div class="gen-hud-q"><span class="mono">${run.idx + 1}/${run.pool.length}</span><span class="gen-hud-l">${esc(label)}</span></div>
    <div class="gen-hud-combo ${run.combo >= 3 ? 'hot' : ''}"><span class="mono">${run.combo}×</span><span class="gen-hud-l">streak</span></div>
    <div class="gen-hud-score"><span class="mono">${run.correct}/${run.answered}</span><span class="gen-hud-l">correct</span></div></div>`;
}

function cogFlash(scope, big, small, good) {
  const f = el(`<div class="gen-flash ${good ? 'good' : 'bad'}"><span class="gen-flash-big">${esc(big)}</span>${small ? `<span class="gen-flash-small">${esc(small)}</span>` : ''}</div>`);
  scope.appendChild(f); requestAnimationFrame(() => f.classList.add('in'));
  setTimeout(() => { f.classList.remove('in'); setTimeout(() => f.remove(), 300); }, 700);
}
document.addEventListener('click', (e) => { if (e.target && e.target.id === 'cog-quit') { cogClearTimer(); COG_POOL_FILTER = null; renderCogHome(); } });

/* ============================================================================
   RESULTS
   ========================================================================= */
function cogEndRun(run) {
  cogClearTimer();
  const acc = run.answered ? Math.round(run.correct / run.answered * 100) : 0;
  let headline = '', sub = '', extra = '';
  const grid = (cells) => `<div class="gen-res-grid">${cells.map(c => `<div><span class="mono">${c[0]}</span><span>${c[1]}</span></div>`).join('')}</div>`;

  if (run.mode === 'blitz') {
    const best = run.score > COG.bestScore; if (best) COG.bestScore = run.score;
    if (run.score >= 500) cogGrant('blitz500');
    if (acc === 100 && run.answered >= 8) cogGrant('perfect');
    headline = best ? 'NEW HIGH SCORE' : 'Time!'; sub = `${run.score} points`;
    extra = grid([[`${run.correct}/${run.answered}`, 'answered'], [`${acc}%`, 'accuracy'], [`${run.maxCombo}×`, 'best combo'], [`${COG.bestScore}`, 'all-time best']]);
  } else if (run.mode === 'exam') {
    const beat = acc >= 85 && run.lives > 0; if (acc > COG.bestExam) COG.bestExam = acc; if (beat) cogGrant('exam');
    headline = run.lives <= 0 ? 'BOSS WINS' : (beat ? 'CLEARED' : 'Not yet'); sub = `${acc}% · ${run.correct}/${run.answered}`;
    extra = grid([[`${acc}%`, 'score'], [`${run.maxCombo}×`, 'best combo'], [`${run.lives}`, 'lives left'], [`${COG.bestExam}%`, 'best ever']]);
  } else if (run.mode === 'hy-boss') {
    const beat = acc >= 85 && run.lives > 0;
    headline = run.lives <= 0 ? 'HY BOSS WINS' : (beat ? 'HY BOSS CLEARED' : 'Not yet'); sub = `${acc}% · ${run.correct}/${run.answered}`;
    extra = grid([[`${acc}%`, 'score'], [`${run.maxCombo}×`, 'best combo'], [`${run.lives}`, 'lives left'], [`${cogHyMastery()}%`, 'HY mastery']]);
  } else if (run.mode === 'mock') {
    const passed = acc >= 85;
    if (acc > COG.bestMock) COG.bestMock = acc;
    if (passed) { COG.mockPassed = true; cogGrant('mock'); }
    const chScore = ch => {
      const rows = run.responses.filter(r => r.chapter === ch);
      return rows.length ? Math.round(rows.filter(r => r.right).length / rows.length * 100) : 0;
    };
    headline = passed ? 'MODULE 2 PASSED' : 'RETEST NEEDED'; sub = `${acc}% · ${run.correct}/${run.answered} · pass 85% · best ${COG.bestMock}%`;
    extra = grid([[`${chScore(6)}%`, 'Ch 6'], [`${chScore(7)}%`, 'Ch 7'], [`${chScore(8)}%`, 'Ch 8'], [`${chScore(9)}%`, 'Ch 9']]);
  } else if (run.mode === 'smart') {
    cogGrant('smart'); if (acc === 100 && run.answered >= 8) cogGrant('perfect');
    headline = 'Smart Review done'; sub = `${cogOverall()}% overall competency`;
    extra = grid([[`${run.correct}/${run.answered}`, 'correct'], [`${acc}%`, 'accuracy'], [`+${run.maxCombo}`, 'best streak'], [`${cogOverall()}%`, 'competency']]);
  } else if (run.mode === 'topic') {
    headline = 'Drill complete'; sub = `${COG_TOPICS[run.topic] ? COG_TOPICS[run.topic].name : ''} · ${cogComp(cogTopicQs(run.topic))}%`;
    extra = grid([[`${run.correct}/${run.answered}`, 'correct'], [`${acc}%`, 'accuracy'], [`${cogComp(cogTopicQs(run.topic))}%`, 'topic competency'], [`${cogOverall()}%`, 'overall']]);
  } else if (run.mode === 'hy-all' || run.mode === 'hy-chapter') {
    const scope = run.mode === 'hy-chapter' ? cogHyQs().filter(q => q.chapter === run.chapter) : cogHyQs();
    headline = 'High Yield complete'; sub = `${run.mode === 'hy-chapter' ? `Ch ${run.chapter} · ` : ''}${acc}%`;
    extra = grid([[`${run.correct}/${run.answered}`, 'correct'], [`${acc}%`, 'accuracy'], [`${cogComp(scope)}%`, 'HY mastery'], [`${cogOverall()}%`, 'overall']]);
  } else if (run.mode === 'misses' || run.mode === 'starred') {
    if (acc === 100 && run.answered >= 8) cogGrant('perfect');
    headline = run.mode === 'misses' ? 'Misses reviewed' : 'Starred reviewed'; sub = `${run.correct}/${run.answered} correct`;
    extra = grid([[`${run.correct}/${run.answered}`, 'correct'], [`${acc}%`, 'accuracy'], [`${cogMissPool().length}`, 'misses left'], [`${cogOverall()}%`, 'competency']]);
  } else {
    if (acc === 100 && run.answered >= 8) cogGrant('perfect');
    headline = 'Chapter complete'; sub = `Ch ${run.chapter} · ${cogMastery(run.chapter)}% mastered`;
    extra = grid([[`${run.correct}/${run.answered}`, 'correct'], [`${acc}%`, 'accuracy'], [`${run.maxCombo}×`, 'best streak'], [`${cogMastery(run.chapter)}%`, 'mastery']]);
  }
  cogCheckAch(); cogSave();
  cogTrack('run_end', { mode: run.mode, answered: run.answered, correct: run.correct, accuracy: acc, score: run.score, maxCombo: run.maxCombo, competency: cogOverall() });
  const status = cogStatus();
  const mockWrong = run.mode === 'mock' ? run.responses.filter(r => !r.right).length : 0;

  const root = el('<div></div>');
  root.appendChild(topbar('cogpsych'));
  const main = el(`<main class="panel gen-result" id="main" tabindex="-1">
    <div class="gen-res-box cornerframe">
      <span class="label">${esc(headline)}</span>
      <h1 class="gen-res-sub">${esc(sub)}</h1>
      ${extra}
      ${status.cls === 'ready' ? '<p class="gen-res-ready">COURSE MASTERED — 90%+ across every topic. Keep Smart Review warm.</p>' : ''}
      ${run.mode === 'mock' ? `<p class="gen-empty-msg">Answer key unlocked — review every answer and explanation from this attempt.</p>` : ''}
      <p class="gen-res-xp mono">${COG.xp.toLocaleString()} XP total · LV ${cogRank(COG.xp).lvl} ${esc(cogRank(COG.xp).name)}</p>
      <div class="gen-res-btns">
        ${run.mode === 'mock' ? `<button class="btn btn-solid" id="gen-review-key">Review all ${run.responses.length} answers</button><button class="btn" id="gen-again">Retake mock</button>` : `<button class="btn btn-solid" id="gen-again">${run.mode === 'blitz' ? 'Run it back' : run.mode === 'exam' || run.mode === 'hy-boss' ? 'Try again' : run.mode === 'smart' ? 'Another set' : 'Again'}</button>`}
        ${run.mode === 'mock' && mockWrong ? `<button class="btn" id="gen-review-mock">Drill mock misses (${mockWrong})</button>` : ''}
        <button class="btn" id="gen-homebtn">Home</button>
      </div>
    </div>
  </main>`);
  main.querySelector('#gen-homebtn').addEventListener('click', renderCogHome);
  const reviewKey = main.querySelector('#gen-review-key'); if (reviewKey) reviewKey.addEventListener('click', () => renderCogMockReview(run.responses));
  const reviewMock = main.querySelector('#gen-review-mock'); if (reviewMock) reviewMock.addEventListener('click', () => startCogMockMisses(run.responses));
  main.querySelector('#gen-again').addEventListener('click', () => {
    if (run.mode === 'blitz') startCogBlitz();
    else if (run.mode === 'exam') startCogExam();
    else if (run.mode === 'mock') startCogMock();
    else if (run.mode === 'hy-boss') startCogHyBoss();
    else if (run.mode === 'hy-all') startCogHyAll();
    else if (run.mode === 'hy-chapter') startCogHyChapter(run.chapter);
    else if (run.mode === 'smart') startCogSmart();
    else if (run.mode === 'misses') run.mockResponses ? startCogMockMisses(run.mockResponses) : startCogMisses();
    else if (run.mode === 'starred') startCogStarred();
    else if (run.mode === 'topic') startCogTopic(run.topic);
    else startCogChapter(run.chapter);
  });
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}
