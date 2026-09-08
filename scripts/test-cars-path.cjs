const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../mcat-v2-engine.js');
const path = JSON.parse(fs.readFileSync('data/mcat-cars-path.json'));
const base = JSON.parse(fs.readFileSync('data/mcat-v2.json'));
const bank = JSON.parse(fs.readFileSync('data/mcat-cars.json'));
const lessons = JSON.parse(fs.readFileSync('data/mcat-course.json'));
assert.equal(core.validCarsPath(path), true);
assert.equal(path.coaches.length, 2);
const ids = new Set(bank.flatMap(passage => [passage.id, ...passage.questions.map(question => question.id)]));
let longest = 0;
for (const coach of path.coaches) {
  assert.equal(ids.has(coach.passageId), false, 'Pathway passages are not in the general practice pool');
  assert.equal(coach.passage.questions.length, 6);
  assert.equal(
    coach.model.filter(item => item.label.startsWith('Paragraph')).length,
    coach.passage.text.split(/\n\n+/).length
  );
  for (const q of coach.passage.questions) {
    assert.equal(ids.has(q.id), false);
    ids.add(q.id);
    assert.deepEqual([...q.displayOrder].sort(), [0, 1, 2, 3]);
    if (q.options[q.answer].length === Math.max(...q.options.map(option => option.length))) longest++;
  }
}
assert.ok(longest <= 6, 'Correct choices must not systematically be the longest');
for (const step of path.steps) {
  assert.ok([...base.coaches, ...path.coaches].some(coach => coach.id === step.coachId));
  assert.ok(lessons.units.some(unit => unit.id === step.unitId));
}
const bad = structuredClone(path);
bad.coaches[0].passage.questions[0].evidenceParagraphs = [99];
assert.equal(core.validCarsPath(bad), false);
assert.deepEqual(
  core.priorQuestionIds(path.coaches[0].passage, { coachExposures: { [path.coaches[0].passageId]: { ts: 1 } } }),
  path.coaches[0].passage.questions.map(q => q.id)
);

let fail = false,
  lastHtml = '',
  saved;
const nodes = new Map();
function element(html) {
  lastHtml = html;
  return {
    html,
    querySelector(selector) {
      if (selector === '[name="coach-mode"]:checked') return { value: 'independent' };
      if (selector === '#coach-seen') return { checked: false };
      if (!nodes.has(selector)) nodes.set(selector, { addEventListener() {}, value: '', disabled: false });
      return nodes.get(selector);
    },
    querySelectorAll: () => [],
    classList: { add() {} },
    dataset: {},
    appendChild() {},
  };
}
const context = vm.createContext({
  console,
  Date,
  Math,
  JSON,
  Set,
  Map,
  URL,
  URLSearchParams,
  path,
  base,
  window: { addEventListener() {} },
  document: { addEventListener() {}, querySelector: () => null },
  setInterval() {},
  StudyStorage: {
    paused: false,
    read: (_, fallback) => fallback,
    watch: () => ({
      save(value) {
        if (fail) return false;
        saved = JSON.stringify(value);
        return true;
      },
    }),
  },
  McatV2Core: core,
  MCAT: { cars: bank, sci: [] },
  QLOG: [],
  QHIST: {},
  loadResume: () => null,
  loadJSON: (_, fallback) => fallback,
  esc: String,
  el: element,
});
vm.runInContext(fs.readFileSync('mcat-v2.js', 'utf8'), context);
const run = code => vm.runInContext(code, context);
run(
  'v2Data=JSON.parse(JSON.stringify(base));v2CarsPath=JSON.parse(JSON.stringify(path));v2Data.coaches.push(...v2CarsPath.coaches);v2Shell=()=>{};v2CompleteActivity=()=>{};'
);
assert.equal(run('v2CoachAllowed(v2Coach("coach-cars-archive"))'), false);
run(
  'v2State.coach.history=v2CarsPath.steps.slice(0,3).map(step=>({id:step.coachId,coachId:step.coachId,completedAt:1,answers:[]}));'
);
assert.equal(run('v2CoachAllowed(v2Coach("coach-cars-archive"))'), true);
run('var realRender=renderV2Coach;renderV2Coach=()=>{};renderV2CoachSetup("coach-cars-archive");');
nodes.get('#coach-begin').onclick();
assert.equal(run('v2State.coach.active.prior.length'), 0);
const frozenTitle = run('v2State.coach.active.content.passage.title');
run('v2Coach("coach-cars-archive").passage.title="Changed after start";');
assert.equal(run('v2Passage(v2RunCoach(v2State.coach.active),v2State.coach.active).title'), frozenTitle);
run(
  `var active=v2State.coach.active;active.stage='blind';active.answers=active.content.passage.questions.map((q,i)=>({qId:q.id,chosen:i? q.answer:(q.answer+1)%4,correct:i!==0,evidence:'First evidence',ts:10,assisted:false,repeat:false}));var first=JSON.stringify(active.answers);renderV2Coach=realRender;renderV2CoachBlind();`
);
assert.doesNotMatch(lastHtml, /Authored model|Before-feedback review:|Your option:/);
for (let i = 0; i < 6; i++) {
  run(
    `var question=active.content.passage.questions[${i}];active.revisionDraft[question.id]={chosen:question.answer,evidence:'Revised reasoning tied to the passage.'};`
  );
  const click = nodes.get('#coach-revised-save').onclick;
  if (i === 0) fail = true;
  click();
  click();
  assert.equal(run('active.revisions.length'), i + 1);
  assert.equal(run('JSON.stringify(active.answers)===first'), true);
  if (i === 0) {
    fail = false;
    run('v2Save();renderV2CoachBlind();');
  }
}
assert.match(lastHtml, /Authored model/);
assert.equal(run('active.stage'), 'reflect');
run('active.reflection="Keep scope and qualification together in the next passage.";');
nodes.get('#coach-finish').onclick();
const completed = run('v2State.coach.history.at(-1)');
assert.equal(completed.answers.filter(a => a.correct).length, 5);
assert.equal(completed.revisions.filter(a => a.correct).length, 6);
assert.ok(completed.revisions.every(a => a.feedbackSeen === false));
assert.equal(JSON.parse(saved).coach.history.at(-1).content.passage.title, frozenTitle);
assert.equal(JSON.parse(saved).coach.active, undefined);
console.log(
  'Two original passages, 12 rationale-linked checks, reserved-pool separation, staged access, exposure tracking, content snapshots, and separate before-feedback revision through save failure passed.'
);
