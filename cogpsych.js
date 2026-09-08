/* ============================================================================
   Cortex · Cognitive Psychology  —  the science of the mind
   A public, lessons-first course across the whole subject: how cognition is
   studied, the brain, perception, attention, memory, knowledge, imagery,
   language, problem solving, and decision making. Guided Socratic lessons
   are the spine; active recall, spaced repetition, and interleaving keep it.

   Self-contained: uses app.js globals (el, esc, setView, topbar, siteFooter).
   Progress lives in localStorage['cs-cogpsych'] — fully separate from
   clinical / MCAT progress. Earlier class-module progress is preserved under its original IDs.
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
  'ch1-ai': { name: 'Models and Task Performance', ch: 1, blurb: 'Deep Blue, pattern matching, training, generalization, and tests of a model’s predictions.' },
  'ch1-approaches': { name: 'Three Ways In', ch: 1, blurb: 'Behavior, brain measurements, and computational models: what each contributes and how evidence can converge.' },
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
function cogDefaults() {
  return { module: COG_MODULE, xp: 0, answered: 0, correct: 0, bestScore: 0, bestCombo: 0, bestExam: 0, plays: 0,
    streak: { current: 0, longest: 0, lastDate: '' }, q: {}, ach: [], mastered: false, starred: {}, learned: {}, lessons: {} };
}
function cogQuestionCopy(q) {
  const copy={};
  for(const key of ['id','chapter','topic','type','difficulty','q','answer','explain','hint','tag','revision'])if(q[key]!==undefined)copy[key]=q[key];
  copy.options=[...q.options];if(q._retry)copy._retry=true;return copy;
}
function cogPracticeText(value) {
  // Older authored questions use bare bold tags. Keep their words as escaped text.
  return esc(String(value ?? '').replace(/<\/?b>/gi,''));
}
function cogValidPractice(run) {
  const integer=n=>Number.isInteger(n)&&n>=0;
  const question=q=>cogValidBankItem(q,new Set())&&/^[\w.-]{1,180}$/.test(q.id)&&!q.svg&&!q.fig&&
    ['concept','calc','label'].includes(q.type)&&['easy','med','hard'].includes(q.difficulty);
  const pool=p=>Array.isArray(p)&&p.every(question);
  const current=run?.current;
  return !!run&&run.version===1&&typeof run.id==='string'&&/^[\w.-]{1,180}$/.test(run.id)&&
    ['smart','blitz','chapter','topic','exam','misses','starred'].includes(run.mode)&&
    (run.mode!=='topic'||!!COG_TOPICS[run.topic])&&(run.mode!=='chapter'||!!COG_CH[run.chapter])&&
    ['idx','score','combo','maxCombo','correct','answered','supportedAnswers','pauses'].every(k=>integer(run[k]))&&run.correct<=run.answered&&run.supportedAnswers<=run.answered&&
    pool(run.pool)&&pool(run.sourcePool)&&run.idx<=run.pool.length&&Array.isArray(run.retryQ)&&run.retryQ.every(r=>question(r.q)&&integer(r.due))&&
    Number.isFinite(run.startedAt)&&Number.isFinite(run.remainingMs)&&run.remainingMs>=0&&run.remainingMs<=90000&&
    (run.deadline===null||Number.isFinite(run.deadline))&&(run.completedAt===null||Number.isFinite(run.completedAt))&&
    typeof run.scratch==='string'&&run.scratch.length<=6000&&typeof run.calculator==='string'&&run.calculator.length<=100&&
    typeof run.toolsOpen==='boolean'&&typeof run.calculatorEvaluated==='boolean'&&run.endless===(run.mode==='smart')&&
    (run.mode!=='exam'||integer(run.lives)&&run.lives<=4&&run.maxLives===4)&&
    (current===null||current&&question(current.question)&&Array.isArray(current.order)&&current.order.length===4&&new Set(current.order).size===4&&current.order.every(n=>integer(n)&&n<4)&&
      typeof current.hintShown==='boolean'&&typeof current.toolsUsed==='boolean'&&
      (current.selected===null&&current.answeredAt===null||integer(current.selected)&&current.selected<4&&Number.isFinite(current.answeredAt)));
}
function cogNewPractice(input) {
  return {version:1,id:'practice-'+cogRandId(),mode:input.mode,topic:input.topic,chapter:input.chapter,
    endless:input.mode==='smart',pool:input.pool.map(cogQuestionCopy),sourcePool:input.mode==='smart'?cogActiveBank().map(cogQuestionCopy):[],retryQ:[],
    idx:0,score:0,combo:0,maxCombo:0,correct:0,answered:0,supportedAnswers:0,pauses:0,
    lives:input.lives,maxLives:input.maxLives,remainingMs:input.mode==='blitz'?90000:0,timeLeft:input.mode==='blitz'?90:0,deadline:null,
    startedAt:Date.now(),completedAt:null,current:null,scratch:'',calculator:'',calculatorEvaluated:false,toolsOpen:false};
}
function cogLoad() {
  const saved = StudyStorage.read(COG_KEY, {});
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  if (!object(saved) || ['q', 'starred', 'learned', 'lessons', 'streak'].some(key => saved[key] !== undefined && !object(saved[key])) ||
      (saved.ach !== undefined && !Array.isArray(saved.ach)) ||
      Object.values(saved.lessons || {}).some(record => !object(record) || !object(record.steps) || Object.values(record.steps).some(step => !object(step))) ||
      saved.practice!==undefined&&!cogValidPractice(saved.practice)) {
    StudyStorage.sessionFailed();
    return cogDefaults();
  }
  // Keep earlier module work and IDs; a restored route must never reset a course.
  return { ...cogDefaults(), ...saved, module: COG_MODULE,
    ...(saved.module && saved.module !== COG_MODULE ? { previousModule: saved.module } : {}),
    streak: { ...cogDefaults().streak, ...saved.streak } };
}
let COG = cogLoad();
StudyStorage.watch(COG_KEY, () => COG);
let cogBatching=false,cogLiveRun=null;
function cogSave() { return cogBatching || StudyStorage.write(COG_KEY, COG); }

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
  if (typeof IS_LOCAL_PREVIEW !== 'undefined' && IS_LOCAL_PREVIEW) return;
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
function cogClearTimer() {
  if(cogTimer){clearInterval(cogTimer);cogTimer=null;}cogUnbindKey();
  if(cogLiveRun){
    const run=cogLiveRun;cogLiveRun=null;
    if(run.deadline!==null){run.remainingMs=Math.min(90000,Math.max(0,run.deadline-Date.now()));run.timeLeft=Math.ceil(run.remainingMs/1000);run.deadline=null;}
    cogSave();
  }
}
window.addEventListener?.('beforeunload',cogClearTimer);
window.addEventListener?.('study-storage-paused',cogClearTimer);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&cogLiveRun){cogLiveRun.pauses++;cogClearTimer();if(location.pathname.replace(/\/$/,'')==='/cogpsych')renderCogHome();}});

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
  if (c >= 90 && gate.allSeen && gate.topicFloor) return { c, label: 'REVIEW MILESTONE', cls: 'ready' };
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
  { min: 8500, name: 'Consistent Reviewer' },
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
  { id: 'blitz500', name: 'Blitz Master', desc: 'Score 500+ in one Quick recall session' },
  { id: 'smart', name: 'Study Smart', desc: 'Bring every question to the longest review interval in Smart Review' },
  { id: 'perfect', name: 'Flawless', desc: 'Finish a run 100% correct (8+ Q)' },
  { id: 'stm', name: 'Memory Buffer', desc: 'Reach 100% mastery on Short-Term & Working Memory' },
  { id: 'ltm', name: 'Long Haul', desc: 'Reach 100% mastery on Long-Term Memory' },
  { id: 'autobio', name: 'Life Story', desc: 'Reach 100% mastery on Autobiographical Memory' },
  { id: 'knowledge', name: 'Knowledge Architect', desc: 'Reach 100% mastery on Knowledge' },
  { id: 'survey', name: 'Full Review Cycle', desc: 'Reach the longest review interval in every chapter' },
  { id: 'exam', name: 'Boss Cleared', desc: 'Finish a full Course challenge at 85%+ accuracy' },
  { id: 'scholar', name: 'Course Scholar', desc: 'Complete every lesson in the course' },
  { id: 'ready', name: 'Review Milestone', desc: 'See every question, hold every topic at 80%+, and reach 90% overall' },
  { id: 'cogscientist', name: 'Cognitive Science Explorer', desc: 'Reach the Cognitive Neuroscientist practice rank' },
];
let cogPendingToasts=[];   // achievements granted inside a batch; announced once the batch saves
function cogGrant(id) {
  if (COG.ach.includes(id)) return;
  COG.ach.push(id); cogSave();
  const a = COG_ACH.find(x => x.id === id);
  if (!a) return;
  if (cogBatching) cogPendingToasts.push(a.name); else cogToast(`Achievement unlocked · ${a.name}`);
}
function cogFlushToasts(saved) {
  const names = cogPendingToasts.splice(0);
  if (saved) names.forEach(name => cogToast(`Achievement unlocked · ${name}`));
}
function cogToast(msg) {
  const t = el(`<div class="gen-toast">${esc(msg)}</div>`);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 350); }, 2300);
}
function cogAllLessonsDone() {
  const lessons = (typeof COG_LESSONS !== 'undefined' ? COG_LESSONS : []).filter(l => COG_CH[l.chapter]);
  return lessons.length > 0 && lessons.every(l => cogglDone(l.id));
}
function cogCheckAch() {
  if (cogAllLessonsDone()) cogGrant('scholar');
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
let cogBankReady = false;
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
    const r = await fetch('data/cogpsych-bank.json?v=8');
    if (!r.ok) throw new Error('http ' + r.status);
    const data = await r.json();
    if (!Array.isArray(data) || !data.length) throw new Error('Practice bank unavailable');
    const seen = new Set(COG_DIAGRAMS.concat(COG_GENERATORS).map(q => q.id)), valid = [];
    for (const q of data) {
      if (!cogValidBankItem(q, seen)) throw new Error('Practice item is invalid');
      seen.add(q.id);
      if (q.type !== 'concept' && q.type !== 'calc' && q.type !== 'label') q.type = 'concept';
      if (q.difficulty !== 'easy' && q.difficulty !== 'med' && q.difficulty !== 'hard') q.difficulty = 'med';
      valid.push(q);
    }
    if (data.length && !valid.length) throw new Error('no valid bank items');   // non-empty but all malformed -> failure screen
    COG_GENERATED = valid;
    COG_BANK = COG_DIAGRAMS.concat(COG_GENERATED).concat(COG_GENERATORS);
    cogBankReady = true;
  } catch { cogBankReady = false; }
}
function cogLoadingScreen() {
  const root = el('<div></div>'); root.appendChild(topbar('cogpsych'));
  root.appendChild(el('<main class="panel gen-lock" id="main" tabindex="-1"><div class="gen-lock-box cornerframe"><span class="label">Cognitive Psychology</span><p class="gen-lock-sub">Loading course…</p></div></main>'));
  root.appendChild(siteFooter()); setView(root);
}
async function renderCogPsych() {
  cogClearTimer();
  cogLoadingScreen();
  if (new URLSearchParams(location.search).get('view') === 'research') return openCogResearch();
  await Promise.all([cogBankReady ? Promise.resolve() : cogLoadBank(), cogLoadLessons().catch(error=>{
    // Saved practice contains its own questions; a lesson download is optional.
    if(new URLSearchParams(location.search).get('view')!=='practice'||!COG.practice)throw error;
  })]);
  if (location.pathname.replace(/\/$/, '') !== '/cogpsych') return;
  const params = new URLSearchParams(location.search);
  if (params.get('lesson')) return renderCogLesson(params.get('lesson'));
  if (params.get('view') === 'lessons') return renderCogLearnHome(Number(params.get('chapter')) || undefined);
  if (params.get('view') === 'practice' && COG.practice) return cogRunQuestion(COG.practice);
  renderCogHome();
}

async function openCogResearch() {
  const current = () => location.pathname.replace(/\/$/, '') === '/cogpsych' && new URLSearchParams(location.search).get('view') === 'research';
  try {
    await loadScript('cogpsych-research.js?v=1');
    if (current()) await window.CogResearch.open();
  } catch {
    if (!current()) return;
    const root = el('<div></div>'); root.appendChild(topbar('cogpsych'));
    const main = el('<main class="panel" id="main"><h1>Research lab could not open</h1><p>Retry this optional tool or return to the psychology course.</p><button class="btn" id="cog-research-retry">Retry research lab</button><button class="btn" id="cog-research-home">Course home</button></main>');
    main.querySelector('#cog-research-retry').onclick = openCogResearch;
    main.querySelector('#cog-research-home').onclick = () => { cogRoute('home'); renderCogPsych(); };
    root.append(main); setView(root);
  }
}
window.addEventListener?.('study-storage-recovered', () => {
  if (location.pathname.replace(/\/$/, '') === '/cogpsych' && new URLSearchParams(location.search).get('view') !== 'research') return renderCogPsych();
});

/* ============================================================================
   HOME / DASHBOARD
   ========================================================================= */
function renderCogHome() {
  cogClearTimer();
  cogRoute('home');
  COG_POOL_FILTER = null;
  if (!COGA_sessionLogged) { COGA_sessionLogged = true; cogTrack('session_start', { competency: cogOverall(), mastered: COG_BANK.filter(q => cogBox(q.id) >= 5).length, total: COG_BANK.length, mobile: (window.innerWidth || 0) < 700 }); }
  const status = cogStatus();
  const missCount = cogMissPool().length, starredCount = cogStarredList().length;
  const lessons = (typeof COG_LESSONS !== 'undefined' ? COG_LESSONS : [])
    .filter(l => COG_CH[l.chapter]);
  const lessonDone = lessons.filter(l => cogglDone(l.id)).length;
  if (!StudyStorage.paused && lessons.length && lessonDone === lessons.length) cogGrant('scholar');
  const foundation = lessons.filter(l => l.foundationOrder).sort((a,b) => a.foundationOrder-b.foundationOrder);
  const foundationDone = foundation.filter(l => cogglDone(l.id)).length;
  const foundationPct = foundation.length ? Math.round(foundationDone/foundation.length*100) : 0;
  const research = lessons.filter(l => l.researchOrder).sort((a,b) => a.researchOrder-b.researchOrder);
  const nextLesson = foundation.find(l => COG.lessons[l.id] && !cogglDone(l.id)) || [...foundation, ...research].find(l => !cogglDone(l.id)) || lessons.find(l => !cogglDone(l.id)) || lessons[0] || null;
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
      <span class="label">Cortex / Cognitive Psychology / Local preview</span>
      <h1>Cognitive Psychology</h1>
      <p>Start with seven connected lessons on cognition, evidence, attention, and memory. Continue into research reasoning and two synthetic data investigations.</p>
      <div class="cog-simple-progress" aria-label="Foundations progress">
        <span><strong>${foundationDone} of ${foundation.length}</strong> foundation lessons complete</span>
        <span class="mono">${foundationPct}%</span>
        <span class="cog-course-bar"><i style="width:${foundationPct}%"></i></span>
      </div>
      <div class="cog-course-actions">
        <button class="btn btn-solid" data-course-action="continue">${nextLesson?.researchOrder ? 'Continue research reasoning' : foundationDone === foundation.length ? 'Explore a draft lesson' : foundationDone ? 'Continue foundations' : 'Start foundations'} →</button>
        <button class="ghostbtn" data-course-action="browse">Browse all lessons</button>
      </div>
    </header>

    <section class="cog-foundation" aria-label="Foundations pathway">
      <h2>A first path through the mind</h2><p>About 50 minutes across seven short lessons. No prior psychology course is required. Each lesson asks you to explain an idea and apply it. Sources checked September 7, 2026; independent subject review remains pending.</p>
      <ol>${foundation.map(l => `<li><button class="ghostbtn" data-foundation="${l.id}">${esc(l.title)}${cogglDone(l.id) ? ' · Complete' : ''}</button></li>`).join('')}</ol>
      <a class="btn" href="${sectionUrl('socrates')}">Apply a strategy in Learn to Learn →</a>
    </section>
    <section class="cog-foundation" aria-label="Research reasoning pathway"><h2>From plausible story to evidence</h2>
      <p>Four lessons, about 36 minutes: design, measurement, inference and retention. Build on the foundations above. Independent subject review remains pending.</p>
      <ol>${research.map(l => `<li><button class="ghostbtn" data-foundation="${l.id}">${esc(l.title)}${cogglDone(l.id) ? ' · Complete' : ''}</button></li>`).join('')}</ol>
      <button class="btn" id="cog-research-open">Open research reasoning lab →</button><p>Two reproducible teaching models. No participant data, reaction-time measurement or cognitive diagnosis.</p>
    </section>
    <section class="cog-simple-syllabus">
      <div class="cog-simple-section-head"><span class="label">Full draft library</span><span>${COG_CH && Object.keys(COG_CH).length} chapters · ${lessons.length} lessons</span></div>
      <p class="course-caption">All existing lessons and saved completions remain available. The 63 lessons outside the foundations and research sequences have not completed this local content pass. Independent review remains pending for all lessons.</p><div class="cog-chapter-list">${chapterRows}</div>
    </section>

    <details class="cog-simple-fold">
      <summary><span><strong>Practice</strong><small>Optional review tools</small></span><i>Open</i></summary>
      ${!cogBankReady ? '<p role="status">The optional practice bank did not download. Your lessons and saved work are available.</p><button class="btn" id="cog-retry-bank">Retry practice download</button>' : ''}
      <p class="course-caption">Additional draft practice. These questions have a separate review status from the foundation lessons.</p>
      ${COG.practice?`<div class="course-notice"><strong>${COG.practice.completedAt?'Your latest session is saved.':'Your practice session is saved.'}</strong><p>${COG.practice.answered} ${COG.practice.answered===1?'answer':'answers'} recorded. ${COG.practice.completedAt?'Reopen its results before starting another session.':'Resume the same question and answer order, or end it and review your results.'}</p><button class="btn btn-solid" id="cog-practice-resume">${COG.practice.completedAt?'View saved session':'Resume practice'}</button>${!COG.practice.completedAt?'<button class="btn" id="cog-practice-end">End session & review</button>':''}</div>`:''}
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
      <p class="course-caption">Review-box progress summarizes spacing levels from prior practice. It is not a retention estimate, examination score, or competency assessment.</p><div class="cog-record-stats">
        <div><strong class="mono">${lessonDone}/${lessons.length}</strong><span>Lessons complete</span></div>
        <div><strong class="mono">${status.c}%</strong><span>Review-box progress</span></div>
        <div><strong class="mono">${cogAccuracy()}%</strong><span>Practice accuracy</span></div>
        <div><strong class="mono">${COG.streak.current}</strong><span>Day streak</span></div>
      </div>
      ${status.cls === 'ready' ? `<p class="cog-course-mastered">Review scheduling milestone · ${status.c}% of maximum box level</p>` : ''}
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

  main.querySelectorAll('[data-foundation]').forEach(button => button.onclick = () => renderCogLesson(button.dataset.foundation));
  main.querySelector('#cog-research-open').onclick = () => { cogRoute('research'); openCogResearch(); };
  const retryBank = main.querySelector('#cog-retry-bank');
  if (retryBank) retryBank.onclick = async () => { retryBank.disabled = true; await cogLoadBank(); if (location.pathname.replace(/\/$/, '') === '/cogpsych') renderCogHome(); };
  if (!cogBankReady) main.querySelectorAll('[data-mode]').forEach(button => button.disabled = true);
  if(COG.practice&&!COG.practice.completedAt)main.querySelectorAll('[data-mode]:not([data-mode="stats"])').forEach(button=>{button.disabled=true;button.title='Resume or end your saved practice session first';});
  const savedPractice=COG.practice,practiceActive=()=>main.isConnected&&COG.practice===savedPractice&&!StudyStorage.paused;
  main.querySelector('#cog-practice-resume')?.addEventListener('click',()=>{if(practiceActive()&&cogSave())cogRunQuestion(savedPractice);});
  main.querySelector('#cog-practice-end')?.addEventListener('click',()=>{if(practiceActive()&&cogSave()){savedPractice.endedEarly=true;cogEndRun(savedPractice);}});
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
  main.querySelector('#gen-reset').addEventListener('click', event => cogConfirmReset(event.currentTarget));
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

function cogConfirmReset(trigger) {
  const main = trigger.closest('main'), saved = COG;
  if (!main?.isConnected || main.querySelector('dialog') || StudyStorage.paused) return;
  const dialog = el(`<dialog class="cog-reset-confirm" aria-labelledby="cog-reset-title" aria-describedby="cog-reset-scope">
    <h2 id="cog-reset-title">Reset Psychology lessons and practice?</h2>
    <p id="cog-reset-scope">This removes saved Psychology lessons, practice answers and sessions, starred questions, XP and achievements from the active workspace. Research investigations and other courses stay saved.</p>
    <p>Keep a study backup first if you want to restore this work later.</p>
    <div><button class="btn" id="cog-reset-keep" autofocus>Keep my progress</button><button class="btn btn-solid" id="cog-reset-confirm">Reset lessons &amp; practice</button></div>
  </dialog>`);
  const finish = reset => {
    dialog.close(); dialog.remove();
    if (!reset) { if (trigger.isConnected) trigger.focus(); return; }
    // Check ownership and the loaded copy before discarding the in-memory work.
    if (!main.isConnected || COG !== saved || StudyStorage.paused || !cogSave()) return;
    COG = cogDefaults();
    if (cogSave()) renderCogHome();
  };
  dialog.querySelector('#cog-reset-keep').onclick = () => finish(false);
  dialog.querySelector('#cog-reset-confirm').onclick = () => finish(true);
  dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const first = dialog.querySelector('#cog-reset-keep'), last = dialog.querySelector('#cog-reset-confirm');
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  main.appendChild(dialog); dialog.showModal(); dialog.querySelector('#cog-reset-keep').focus();
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
  // Continue until every question reaches the longest review interval (box 5).
  cogTrack('mode_start', { mode: 'smart' });
  cogRunQuestion({ mode: 'smart', pool: [] });
}
function startCogBlitz() {
  cogTrack('mode_start', { mode: 'blitz' });
  cogRunQuestion({ mode: 'blitz', pool: cogShuffle(COG_BANK) });
}
function startCogChapter(ch) {
  cogTrack('mode_start', { mode: 'chapter', chapter: ch });
  cogRunQuestion({ mode: 'chapter', chapter: ch, pool: cogShuffle(cogChapterQs(ch)) });
}
function startCogTopic(t) {
  cogTrack('mode_start', { mode: 'topic', topic: t });
  cogRunQuestion({ mode: 'topic', topic: t, pool: cogShuffle(cogTopicQs(t)) });
}
function startCogExam() {
  const chs = Object.keys(COG_CH).map(Number);
  const per = Math.ceil(20 / Math.max(1, chs.length));
  let pool = [];
  chs.forEach(ch => { pool = pool.concat(cogShuffle(cogChapterQs(ch)).slice(0, per)); });
  pool = cogShuffle(pool).slice(0, 20);
  if (pool.length < 20) { const have = new Set(pool.map(q => q.id)); pool = pool.concat(cogShuffle(COG_BANK).filter(q => !have.has(q.id)).slice(0, 20 - pool.length)); }
  cogTrack('mode_start', { mode: 'exam', n: pool.length });
  cogRunQuestion({ mode: 'exam', pool, lives: 4, maxLives: 4 });
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
function cogBankMissing() { cogEmpty('Practice unavailable', 'The practice bank is not available. Your saved work has been kept. Return home to retry the download.'); }
function startCogMisses() {
  if (!cogBankReady) return cogBankMissing();
  const pool = cogShuffle(cogMissPool());
  if (!pool.length) { cogEmpty('Review misses', 'No misses to review right now — nice work. Play a mode to surface your weak spots, then come back.'); return; }
  cogRunQuestion({ mode: 'misses', pool });
}
function startCogStarred() {
  if (!cogBankReady) return cogBankMissing();
  const pool = cogShuffle(cogStarredList());
  if (!pool.length) { cogEmpty('Starred questions', "You haven't starred any questions yet. Tap the star on any question to save it here for later."); return; }
  cogRunQuestion({ mode: 'starred', pool });
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
      <div class="gen-stat"><span class="gen-stat-n mono">${cogOverall()}%</span><span class="gen-stat-l">Review-box progress</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${cogAccuracy()}%</span><span class="gen-stat-l">Accuracy</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${COG.answered.toLocaleString()}</span><span class="gen-stat-l">Answered</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${maxed}/${COG_BANK.length}</span><span class="gen-stat-l">Maxed out</span></div>
    </div>
    <p class="course-caption">Box progress is a scheduling heuristic. Accuracy includes repeated practice. Neither measures general competence or predicts an exam score.</p><section class="gen-mastery cornerframe"><span class="label">By topic — box progress · practice accuracy · advanced boxes</span>${topicRows}</section>
    <div class="gen-res-btns gen-stats-actions"><button class="btn" id="gen-misses2">Review my misses (${cogMissPool().length})</button><button class="btn" id="gen-starred2">★ Starred (${cogStarredList().length})</button></div>
  </main>`);
  main.querySelector('#gen-back').addEventListener('click', renderCogHome);
  main.querySelector('#gen-misses2').addEventListener('click', startCogMisses);
  main.querySelector('#gen-starred2').addEventListener('click', startCogStarred);
  if(COG.practice&&!COG.practice.completedAt){
    main.querySelectorAll('#gen-misses2,#gen-starred2').forEach(button=>{button.disabled=true;button.title='Resume or end your saved practice session first';});
    main.querySelector('.gen-stats-actions').insertAdjacentHTML('beforebegin','<p class="course-caption" role="status" id="gen-stats-saved">Your practice session is saved. Resume or end it from the course home before starting another review.</p>');
  }
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
  const bankSrc = run.sourcePool?.length ? run.sourcePool : cogActiveBank();
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

/* ---------- practice tools: saved calculator + scratchpad ---------- */
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
        <div class="gen-pad"><textarea class="gen-pad-area" id="gen-pad-area" rows="6" maxlength="6000" aria-label="Practice scratchpad" placeholder="Scratchpad — work it out here…"></textarea></div>
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
function cogWireTools(main,run,active) {
  const toggle = main.querySelector('#gen-tools-toggle');
  if (!toggle) return;
  const panel = main.querySelector('#gen-tools-panel');
  const disp = main.querySelector('#gen-calc-disp');
  const pad = main.querySelector('#gen-pad-area');
  toggle.addEventListener('click', () => {
    if(!active()||!cogSave())return;
    cogToolsOpen = panel.hidden; panel.hidden = !cogToolsOpen;
    run.toolsOpen=cogToolsOpen;
    if(cogToolsOpen&&(run.scratch||run.calculator)&&run.current.selected===null)run.current.toolsUsed=true;
    toggle.textContent = (cogToolsOpen ? '▾' : '▸') + ' Calculator & scratchpad';
    cogSave();
  });
  if (pad) { pad.value = run.scratch; pad.addEventListener('input', () => {
    if(!active())return;
    cogScratch=run.scratch=pad.value.slice(0,6000);if(run.current.selected===null)run.current.toolsUsed=true;cogSave();
  }); }
  disp.value=run.calculator;
  main.querySelectorAll('.gen-calc-key').forEach(b => b.addEventListener('click', () => {
    if(!active()||!cogSave())return;
    const k = b.dataset.k;
    if(k==='clear'){disp.value='';run.calculatorEvaluated=false;}
    else if(k==='back'){disp.value=disp.value.slice(0,-1);run.calculatorEvaluated=false;}
    else if(k==='eq'){disp.value=cogCalcEval(disp.value);run.calculatorEvaluated=true;}
    else {
      if(disp.value==='Error'||run.calculatorEvaluated&&/[0-9.(]/.test(k))disp.value='';
      run.calculatorEvaluated=false;disp.value=(disp.value+k).slice(0,100);
    }
    run.calculator=disp.value;if(run.current.selected===null)run.current.toolsUsed=true;cogSave();
  }));
}

function cogRunQuestion(input) {
  cogClearTimer();
  if(StudyStorage.paused)return;
  let run=input;
  if(!run.version){
    if(COG.practice&&!COG.practice.completedAt)return renderCogHome();   // saved-session notice; never swap in another mode's run
    run=cogNewPractice(input);
    if(!cogValidPractice(run)){StudyStorage.sessionFailed();return;}
    if(!(run.endless?run.sourcePool:run.pool).length)return cogEmpty('Practice unavailable','The practice bank is not available. Your saved work has been kept. Return home to retry the download.');
    COG.practice=run;COG.plays++;cogBumpStreak();
  }
  if(run!==COG.practice||!cogValidPractice(run)){StudyStorage.sessionFailed();return;}
  cogRoute('practice');
  if(run.completedAt)return cogEndRun(run);
  if(run.deadline!==null){run.remainingMs=Math.min(90000,Math.max(0,run.deadline-Date.now()));run.deadline=null;}
  run.timeLeft=Math.ceil(run.remainingMs/1000);
  if(run.mode==='blitz'&&!run.remainingMs)return cogEndRun(run);
  if(!run.current){
    let q;
    if(run.endless){q=cogNextSmart(run);if(!q){run.allAtLongest=true;return cogEndRun(run);}}
    else {
      if(!run.pool.length)return cogEndRun(run);
      if(run.idx>=run.pool.length){if(run.mode==='blitz'){run.pool=cogShuffle(run.pool);run.idx=0;}else return cogEndRun(run);}
      q=run.pool[run.idx];
    }
    run.current={question:cogQuestionCopy(q),order:cogShuffle([0,1,2,3]),selected:null,answeredAt:null,
      hintShown:!!((q._retry||COG.q[q.id]?.lastWrong)&&q.hint),toolsUsed:!!(run.toolsOpen&&(run.scratch||run.calculator))};
  }
  const current=run.current,qq=current.question,order=current.order;
  run.locked=current.selected!==null;
  cogToolsOpen=run.toolsOpen;cogScratch=run.scratch;
  if(run.mode==='blitz')run.deadline=Date.now()+run.remainingMs;
  cogLiveRun=run;
  if(!cogSave())return;
  const root=el('<div></div>');root.appendChild(topbar('cogpsych'));
  const main=el(`<main class="panel gen-game" id="main" tabindex="-1" data-cog-practice>
    ${cogHud(run)}<p class="course-caption">Your question, answer order and feedback are saved. ${run.mode==='blitz'?'The clock pauses when you leave or hide this practice. Reloads retain the remaining time.':'You can save and leave at any point.'}</p>
    <div class="gen-q cornerframe" data-qid="${esc(qq.id)}"><div class="gen-q-meta"><span class="mono">${qq.chapter}</span><span class="gen-q-tag">${esc(COG_TOPICS[qq.topic]?.name||'Practice')}</span><span class="gen-q-diff gen-d-${qq.difficulty}">${qq.difficulty}</span><button type="button" class="gen-star ${COG.starred?.[qq.id]?'on':''}" id="gen-star" aria-label="Star this question">${COG.starred?.[qq.id]?'★':'☆'}</button></div>
    <h2 class="gen-q-stem">${esc(qq.q)}</h2>${qq.revision>1?'<p class="course-caption">Revised draft question. Prior practice totals can include earlier wording.</p>':''}
    ${current.hintShown?`<div class="gen-hint"><span class="gen-hint-lab">Think it through</span> ${cogPracticeText(qq.hint)}</div>`:''}
    <div class="gen-opts">${order.map((original,index)=>`<button class="gen-opt" data-disp="${index}" data-choice="${original}" ${run.locked?'disabled':''}><span class="gen-opt-key mono">${String.fromCharCode(65+index)}</span><span class="gen-opt-txt">${esc(qq.options[original])}</span></button>`).join('')}</div>
    ${cogToolsHtml()}<div class="gen-explain" id="gen-explain" ${run.locked?'':'hidden'}></div>
    <div class="gen-next-row" id="gen-next-row" ${run.locked?'':'hidden'}><button class="btn btn-solid" id="gen-next">Next →</button></div></div></main>`);
  const active=()=>main.isConnected&&COG.practice===run&&run.current===current&&!StudyStorage.paused&&cogLiveRun===run;
  const advance=()=>{
    if(!active()||current.selected===null||!cogSave())return;
    if(run.mode==='exam'&&run.lives<=0||!run.endless&&run.mode!=='blitz'&&run.idx+1>=run.pool.length)return cogEndRun(run);
    run.idx++;if(run.endless)run.idx=0;run.current=null;
    cogRunQuestion(run);
  };
  const choose=button=>{
    if(!active()||current.selected!==null||!cogSave())return;
    if(run.mode==='blitz'&&Date.now()>=run.deadline)return cogEndRun(run);
    const selected=Number(button.dataset.choice),right=selected===qq.answer;
    cogBatching=true;
    try{
      current.selected=selected;current.answeredAt=Date.now();run.locked=true;
      cogRecord(qq,right);run.answered++;if(current.hintShown||current.toolsUsed)run.supportedAnswers++;
      if(right){
        run.correct++;run.combo++;run.maxCombo=Math.max(run.maxCombo,run.combo);COG.bestCombo=Math.max(COG.bestCombo,run.combo);
        if(run.combo===5)cogGrant('combo5');if(run.combo===10)cogGrant('combo10');
        const base=(qq.type==='calc'?150:qq.type==='label'?130:100)+(qq.difficulty==='hard'?50:qq.difficulty==='med'?25:0);
        run.score+=base*cogComboMult(run.combo);
      }else{
        run.combo=0;if(run.mode==='exam')run.lives--;
        const retry={...cogQuestionCopy(qq),_retry:true};
        if(['chapter','topic','misses','starred'].includes(run.mode))run.pool.splice(Math.min(run.pool.length,run.idx+1+cogRand(1,2)),0,retry);
        else if(run.endless)run.retryQ.push({q:retry,due:run.answered+cogRand(1,2)});
      }
      cogCheckAch();
    }finally{cogBatching=false;}
    const saved=cogSave();cogFlushToasts(saved);
    if(saved){
      cogTrack('answer',{mode:run.mode,qid:qq.id,chapter:qq.chapter,topic:qq.topic,type:qq.type,difficulty:qq.difficulty,correct:right?1:0});
      cogRunQuestion(run);
    }
  };
  main.querySelectorAll('.gen-opt').forEach(button=>button.onclick=()=>choose(button));
  if(run.locked){
    main.querySelectorAll('.gen-opt').forEach(button=>{
      const choice=Number(button.dataset.choice);if(choice===qq.answer)button.classList.add('correct');else if(choice===current.selected)button.classList.add('wrong');
      if(choice===current.selected)button.setAttribute('aria-pressed','true');
    });
    main.querySelector('#gen-explain').innerHTML=`<span class="gen-ex-label">${current.selected===qq.answer?'Correct':'Answer'}</span> ${cogPracticeText(qq.explain)}<p class="course-caption">This answer is already recorded. Reopening it does not add another result.</p>`;
    const next=main.querySelector('#gen-next');if(run.mode==='exam'&&run.lives<=0||!run.endless&&run.mode!=='blitz'&&run.idx+1>=run.pool.length)next.textContent='See results →';next.onclick=advance;
  }
  cogWireTools(main,run,active);
  main.querySelector('#gen-star').onclick=event=>{if(!active()||!cogSave())return;const on=cogToggleStar(qq.id);event.currentTarget.textContent=on?'★':'☆';event.currentTarget.classList.toggle('on',on);};
  const onKey=event=>{
    if(!active())return;const target=event.target;if(target&&(target.matches('input,textarea,select')||target.isContentEditable))return;
    const control=target&&target.closest?target.closest('button,a,summary,[role="button"]'):null;
    if(current.selected!==null){if(event.key==='Enter'&&!(control&&!control.classList.contains('gen-opt')))advance();return;}
    const n=/^[a-d]$/i.test(event.key)?event.key.toUpperCase().charCodeAt(0)-65:/^[1-4]$/.test(event.key)?Number(event.key)-1:-1;
    if(n>=0){event.preventDefault();choose(main.querySelector(`[data-disp="${n}"]`));}
  };
  cogBindKey(onKey);root.appendChild(main);root.appendChild(siteFooter());setView(root);
  if(run.mode==='blitz'){
    const clock=main.querySelector('#gen-time');
    const timer=setInterval(()=>{
      if(!active()){clearInterval(timer);return;}run.timeLeft=Math.min(90,Math.max(0,Math.ceil((run.deadline-Date.now())/1000)));clock.textContent=run.timeLeft;clock.classList.toggle('low',run.timeLeft<=10);
      if(!run.timeLeft)cogEndRun(run);
    },250);
    cogTimer=timer;
    if(run.locked)setTimeout(advance,current.selected===qq.answer?650:1100);
  }
}

function cogHud(run) {
  const quit = '<button class="ghostbtn gen-quit" id="cog-quit">Save & leave</button>';
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
    const bankSrc = run.sourcePool?.length ? run.sourcePool : cogActiveBank();
    const mastered = bankSrc.filter(q => cogBox(q.id) >= 5).length;
    return `<div class="gen-hud">${quit}
    <div class="gen-hud-q"><span class="mono">${mastered}/${bankSrc.length}</span><span class="gen-hud-l">at longest interval</span></div>
    <div class="gen-hud-q"><span class="mono">${cogComp(bankSrc)}%</span><span class="gen-hud-l">review-box progress</span></div>
    <div class="gen-hud-combo ${run.combo >= 3 ? 'hot' : ''}"><span class="mono">${run.combo}×</span><span class="gen-hud-l">streak</span></div>
    <div class="gen-hud-score"><span class="mono">${run.correct}/${run.answered}</span><span class="gen-hud-l">correct</span></div></div>`;
  }
  const label = run.mode === 'smart' ? 'Smart Review' : run.mode === 'hy-all' ? 'High Yield' : run.mode === 'hy-chapter' ? `High Yield · Ch ${run.chapter}` : run.mode === 'misses' ? 'Review misses' : run.mode === 'starred' ? 'Starred' : run.mode === 'topic' ? (COG_TOPICS[run.topic] ? COG_TOPICS[run.topic].name : 'Drill') : `Ch ${run.chapter}`;
  return `<div class="gen-hud">${quit}
    <div class="gen-hud-q"><span class="mono">${run.idx + 1}/${run.pool.length}</span><span class="gen-hud-l">${esc(label)}</span></div>
    <div class="gen-hud-combo ${run.combo >= 3 ? 'hot' : ''}"><span class="mono">${run.combo}×</span><span class="gen-hud-l">streak</span></div>
    <div class="gen-hud-score"><span class="mono">${run.correct}/${run.answered}</span><span class="gen-hud-l">correct</span></div></div>`;
}

document.addEventListener('click', (e) => { if (e.target && e.target.id === 'cog-quit') { if(cogLiveRun)cogLiveRun.pauses++;cogClearTimer();COG_POOL_FILTER=null;renderCogHome(); } });

/* ============================================================================
   RESULTS
   ========================================================================= */
function cogEndRun(run) {
  cogClearTimer();
  if(StudyStorage.paused||run!==COG.practice||!cogValidPractice(run))return;
  if(!run.completedAt){
    cogBatching=true;
    try{
      if(!run.endedEarly&&run.answered){
        if(run.mode==='blitz'){COG.bestScore=Math.max(COG.bestScore,run.score);if(run.score>=500)cogGrant('blitz500');}
        if(run.mode==='exam'&&run.current?.selected!==null&&run.idx+1>=run.pool.length){
          const accuracy=Math.round(run.correct/run.answered*100);COG.bestExam=Math.max(COG.bestExam,accuracy);if(accuracy>=85)cogGrant('exam');
        }
        if(run.correct===run.answered&&run.answered>=8)cogGrant('perfect');
        if(run.mode==='smart')cogGrant('smart');
        cogCheckAch();
      }
      run.completedAt=Date.now();run.deadline=null;
    }finally{cogBatching=false;}
    const saved=cogSave();cogFlushToasts(saved);
    if(!saved)return;
    cogTrack('run_end',{mode:run.mode,answered:run.answered,correct:run.correct,score:run.score,endedEarly:!!run.endedEarly});
  }
  cogRoute('practice');
  const names={smart:'Smart Review',blitz:'Quick recall',chapter:'Chapter practice',topic:'Topic practice',exam:'Course challenge',misses:'Review misses',starred:'Starred questions'};
  const current=run.current,livesOut=run.mode==='exam'&&run.lives<=0&&run.answered<run.pool.length,root=el('<div></div>');root.appendChild(topbar('cogpsych'));
  const main=el(`<main class="panel gen-result" id="main" tabindex="-1"><div class="gen-res-box cornerframe">
    <span class="label">${names[run.mode]} · Saved session</span><h1>${run.endedEarly?'Session ended early':livesOut?'Challenge stopped: no lives left':run.allAtLongest?'Review intervals reached':'Session finished'}</h1>
    ${livesOut?`<p id="gen-lives-out">All ${run.maxLives||4} lives were lost after ${run.answered} of ${run.pool.length} questions, so the challenge stopped there. No best score was recorded for this session.</p>`:''}
    <div class="gen-res-grid"><div><span class="mono">${run.correct}/${run.answered}</span><span>answers correct</span></div><div><span class="mono">${run.answered?Math.round(run.correct/run.answered*100)+'%':'—'}</span><span>practice accuracy</span></div><div><span class="mono">${run.supportedAnswers}</span><span>answers with recorded hints or tools</span></div></div>
    <p class="course-caption">Accuracy includes repeated practice. Recorded hints and calculator or scratchpad use are counted separately; help received elsewhere is unknown. These results are not an examination score, competency assessment or credential.</p>
    ${run.mode==='blitz'?`<p>Quick recall used ${Math.round((90000-run.remainingMs)/1000)} seconds of its study clock. Pauses are allowed. ${run.pauses} ${run.pauses===1?'pause was':'pauses were'} recorded.</p>`:''}
    ${current?`<details><summary>Last saved question</summary><h2>${esc(current.question.q)}</h2>${current.selected===null?'<p>This question was not answered. No answer was credited.</p>':`<p>Your answer: ${esc(current.question.options[current.selected])}</p><p>${cogPracticeText(current.question.explain)}</p>`}</details>`:''}
    <p class="course-caption">The saved session can be reopened until you start another one. Earlier per-question totals, lessons and achievements stay in your progress.</p>
    <div class="gen-res-btns"><button class="btn btn-solid" id="gen-again">Start another session</button><button class="btn" id="gen-homebtn">Course home</button></div>
    </div></main>`);
  const active=()=>main.isConnected&&COG.practice===run&&!StudyStorage.paused;
  main.querySelector('#gen-homebtn').onclick=()=>{if(active())renderCogHome();};
  main.querySelector('#gen-again').onclick=()=>{
    if(!active()||!cogSave())return;
    if(run.mode==='blitz')startCogBlitz();else if(run.mode==='exam')startCogExam();else if(run.mode==='smart')startCogSmart();
    else if(run.mode==='misses')startCogMisses();else if(run.mode==='starred')startCogStarred();else if(run.mode==='topic')startCogTopic(run.topic);else startCogChapter(run.chapter);
  };
  root.appendChild(main);root.appendChild(siteFooter());setView(root);
}
