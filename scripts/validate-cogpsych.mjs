// Validates the Cognitive Psychology course data (chapters 1–13).
// Manual tool — run `node scripts/validate-cogpsych.mjs` after every data batch and before ship.
// The topic map below is the authoring contract and must mirror COG_TOPICS in cogpsych.js exactly.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
const bank = read('cogpsych-bank.json');
const lessons = read('cogpsych-learn.json');

const topics = {
  // Ch 1 — Introduction
  'ch1-cognition': 1, 'ch1-whystudy': 1, 'ch1-ai': 1, 'ch1-approaches': 1,
  // Ch 2 — How to Study Cognition
  'ch2-mindbrain': 2, 'ch2-history': 2, 'ch2-cognitive': 2, 'ch2-methods': 2, 'ch2-neuromethods': 2,
  // Ch 3 — The Brain
  'ch3-nervous': 3, 'ch3-cortex': 3, 'ch3-function': 3, 'ch3-neurons': 3, 'ch3-ann': 3,
  // Ch 4 — Perception
  'ch4-sensation': 4, 'ch4-systems': 4, 'ch4-theories': 4, 'ch4-visual': 4, 'ch4-cnn': 4,
  // Ch 5 — Attention
  'ch5-selective': 5, 'ch5-filter': 5, 'ch5-divided': 5, 'ch5-purpose': 5, 'ch5-neural': 5,
  // Ch 6 — Short-Term & Working Memory (existing)
  'ch6-foundations': 6, 'ch6-sensory-modal': 6, 'ch6-stm-capacity': 6,
  'ch6-stm-forgetting': 6, 'ch6-working-memory': 6, 'ch6-neural': 6,
  // Ch 7 — Long-Term Memory (existing)
  'ch7-systems-amnesia': 7, 'ch7-encoding-retrieval': 7, 'ch7-memory-factors': 7,
  'ch7-explicit': 7, 'ch7-implicit': 7, 'ch7-neural': 7,
  // Ch 8 — Autobiographical Memory (existing)
  'ch8-foundations': 8, 'ch8-lifespan': 8, 'ch8-emotion': 8,
  'ch8-construction': 8, 'ch8-source-reconsolidation': 8, 'ch8-justice-neural': 8,
  // Ch 9 — Knowledge (existing)
  'ch9-foundations': 9, 'ch9-typicality': 9, 'ch9-prototype-exemplar': 9,
  'ch9-knowledge-based': 9, 'ch9-hierarchies-networks': 9,
  'ch9-schemas-embodied': 9, 'ch9-neural': 9,
  // Ch 10 — Visual Imagery
  'ch10-nature': 10, 'ch10-debate': 10, 'ch10-evidence': 10, 'ch10-brain': 10, 'ch10-uses': 10,
  // Ch 11 — Language
  'ch11-unique': 11, 'ch11-acquisition': 11, 'ch11-comprehension': 11,
  'ch11-discourse': 11, 'ch11-brain': 11, 'ch11-thought': 11,
  // Ch 12 — Problem Solving
  'ch12-nature': 12, 'ch12-process': 12, 'ch12-barriers': 12, 'ch12-insight': 12, 'ch12-expertise': 12,
  // Ch 13 — Reasoning & Decision Making
  'ch13-reasoning': 13, 'ch13-deduction': 13, 'ch13-induction': 13, 'ch13-heuristics': 13, 'ch13-decisions': 13,
};
const chapters = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
// Ch 6–9 shipped with deep drill banks; new chapters carry a lighter reinforcement bank.
const CH_MIN = { 6: 50, 7: 50, 8: 50, 9: 50 };
const CH_MIN_DEFAULT = 24;
// Interactive lesson steps may only mount known COG_FIGS widgets (cogpsych-figs.js).
const WIDGETS = new Set([
  'dualism', 'levels', 'classicalConditioning', 'operantConditioning', 'tolmanMaze',
  'blackBox', 'functionMap', 'donders', 'stroop', 'infoProcessing',
]);
const errors = [];
const fail = message => errors.push(message);
const norm = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const countBy = (rows, key) => Object.fromEntries([...new Set(rows.map(row => row[key]))].sort().map(value => [value, rows.filter(row => row[key] === value).length]));

if (!Array.isArray(bank)) fail('bank must be an array');
if (!Array.isArray(lessons)) fail('lessons must be an array');

const ids = new Set();
const stems = new Set();
let strictLongest = 0;
for (const [i, q] of bank.entries()) {
  const at = `bank[${i}]`;
  if (!q || typeof q !== 'object') { fail(`${at} is not an object`); continue; }
  if (typeof q.id !== 'string' || !q.id) fail(`${at} missing id`);
  else if (ids.has(q.id)) fail(`duplicate id ${q.id}`);
  else ids.add(q.id);
  const stem = norm(q.q);
  if (!stem) fail(`${q.id || at} missing stem`);
  else if (stems.has(stem)) fail(`duplicate stem ${q.id}`);
  else stems.add(stem);
  if (!(q.topic in topics)) fail(`${q.id || at} has unknown topic ${q.topic}`);
  if (topics[q.topic] !== q.chapter) fail(`${q.id || at} topic/chapter mismatch`);
  if (!chapters.includes(q.chapter)) fail(`${q.id || at} has inactive chapter ${q.chapter}`);
  if (!['concept', 'calc', 'label'].includes(q.type)) fail(`${q.id || at} has invalid type ${q.type}`);
  if (!['easy', 'med', 'hard'].includes(q.difficulty)) fail(`${q.id || at} has invalid difficulty ${q.difficulty}`);
  if (q.fig && !WIDGETS.has(q.fig)) fail(`${q.id || at} references unknown fig ${q.fig}`);
  if (!Array.isArray(q.options) || q.options.length !== 4) fail(`${q.id || at} must have four options`);
  else {
    if (new Set(q.options.map(norm)).size !== 4) fail(`${q.id || at} has duplicate options`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) fail(`${q.id || at} has invalid answer`);
    else {
      const lengths = q.options.map(option => norm(option).length);
      if (lengths[q.answer] > Math.max(...lengths.filter((_, idx) => idx !== q.answer))) strictLongest++;
    }
  }
  if (typeof q.explain !== 'string' || q.explain.trim().length < 45) fail(`${q.id || at} explanation is too thin`);
  if (typeof q.hint !== 'string' || q.hint.trim().length < 18) fail(`${q.id || at} hint is too thin`);
  if (typeof q.tag !== 'string' || !q.tag.trim()) fail(`${q.id || at} missing tag`);
}

const chapterCounts = countBy(bank, 'chapter');
for (const ch of chapters) {
  const min = CH_MIN[ch] || CH_MIN_DEFAULT;
  if ((chapterCounts[ch] || 0) < min) fail(`Chapter ${ch} has only ${chapterCounts[ch] || 0} questions (needs ${min})`);
}
const topicCounts = countBy(bank, 'topic');
for (const topic of Object.keys(topics)) if ((topicCounts[topic] || 0) < 4) fail(`${topic} has only ${topicCounts[topic] || 0} questions`);
const answerCounts = [0, 1, 2, 3].map(answer => bank.filter(q => q.answer === answer).length);
if (Math.max(...answerCounts) - Math.min(...answerCounts) > 8) fail(`answer positions are imbalanced: ${answerCounts.join('/')}`);
if (strictLongest / Math.max(1, bank.length) > 0.35) fail(`correct option is strict longest too often: ${strictLongest}/${bank.length}`);

const lessonIds = new Set();
const lessonsByTopic = {};
for (const [i, lesson] of lessons.entries()) {
  const at = `lesson[${i}]`;
  if (!lesson || typeof lesson !== 'object') { fail(`${at} is not an object`); continue; }
  if (typeof lesson.id !== 'string' || !lesson.id) fail(`${at} missing id`);
  else if (lessonIds.has(lesson.id)) fail(`duplicate lesson id ${lesson.id}`);
  else lessonIds.add(lesson.id);
  if (!(lesson.topic in topics)) fail(`${lesson.id || at} has unknown topic ${lesson.topic}`);
  if (topics[lesson.topic] !== lesson.chapter) fail(`${lesson.id || at} topic/chapter mismatch`);
  lessonsByTopic[lesson.topic] = (lessonsByTopic[lesson.topic] || 0) + 1;
  if (typeof lesson.title !== 'string' || !lesson.title.trim()) fail(`${lesson.id || at} missing title`);
  if (typeof lesson.blurb !== 'string' || !lesson.blurb.trim()) fail(`${lesson.id || at} missing blurb`);
  if (!Array.isArray(lesson.steps) || lesson.steps.length < 5) { fail(`${lesson.id || at} needs at least five steps`); continue; }
  if (!lesson.steps.some(step => step.kind === 'ask')) fail(`${lesson.id || at} has no retrieval ask`);
  if (!lesson.steps.some(step => step.kind === 'checkpoint')) fail(`${lesson.id || at} has no checkpoint`);
  for (const [j, step] of lesson.steps.entries()) {
    const where = `${lesson.id || at}.steps[${j}]`;
    if (!['teach', 'ask', 'interactive', 'checkpoint'].includes(step.kind)) fail(`${where} has invalid kind ${step.kind}`);
    if (step.kind === 'teach' && (typeof step.body !== 'string' || !step.body.trim())) fail(`${where} missing body`);
    if (step.kind === 'ask') {
      if (typeof step.prompt !== 'string' || !step.prompt.trim()) fail(`${where} missing prompt`);
      if (typeof step.reveal !== 'string' || !step.reveal.trim()) fail(`${where} missing reveal`);
      if (step.choices && (!Array.isArray(step.choices) || step.choices.length !== 4 || !Number.isInteger(step.answer) || step.answer < 0 || step.answer > 3)) fail(`${where} has invalid choices/answer`);
    }
    if (step.kind === 'interactive') {
      if (!WIDGETS.has(step.widget)) fail(`${where} references unknown widget ${step.widget}`);
      if (typeof step.instructions !== 'string' || !step.instructions.trim()) fail(`${where} missing instructions`);
    }
    if (step.kind === 'checkpoint' && (!Array.isArray(step.options) || step.options.length !== 4 || !Number.isInteger(step.answer) || step.answer < 0 || step.answer > 3 || typeof step.explain !== 'string')) fail(`${where} has invalid checkpoint schema`);
  }
}
for (const topic of Object.keys(topics)) if (lessonsByTopic[topic] !== 1) fail(`${topic} must have exactly one lesson, got ${lessonsByTopic[topic] || 0}`);

const summary = {
  questions: bank.length,
  lessons: lessons.length,
  lessonSteps: lessons.reduce((sum, lesson) => sum + (Array.isArray(lesson.steps) ? lesson.steps.length : 0), 0),
  chapterCounts,
  answerCounts,
  strictLongest: `${strictLongest}/${bank.length}`,
};

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors, summary }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, summary }, null, 2));
