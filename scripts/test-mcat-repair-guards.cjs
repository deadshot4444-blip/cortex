/* Repair-session guards in jsdom: missing lesson data and daily-task launches must never throw or misattribute work.
 * Runs the actual controllers with isolated storage and a controlled clock. Not a real-browser walkthrough.
 * Provide jsdom as a development dependency or through NODE_PATH.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const REPAIR_KEY = 'cs-mcat-repairs-v1';
const repairsJson = fs.readFileSync('data/mcat-repairs.json', 'utf8');
const courseJson = fs.readFileSync('data/mcat-course.json', 'utf8');
const START = new Date(2026, 8, 7, 10).getTime(),
  DAY = 86400000;

function harness({ repairs = true, seed = new Map(), realHub = false } = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: 'http://localhost/mcat?view=today',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window,
    context = dom.getInternalVMContext(),
    errors = [],
    calls = { guide: 0, hub: 0, session: 0 };
  let clock = START;
  const NativeDate = w.Date;
  w.Date = class extends NativeDate {
    constructor(...args) {
      super(...(args.length ? args : [clock]));
    }
    static now() {
      return clock;
    }
  };
  w.addEventListener('error', event => {
    errors.push(event.error);
    event.preventDefault();
  });
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  for (const [key, value] of seed) w.localStorage.setItem(key, value);
  w.CortexProgress = { OWNER: 'test-owner' };
  w.el = html => {
    const template = w.document.createElement('template');
    template.innerHTML = html;
    return template.content.firstElementChild;
  };
  w.esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  w.topbar = () => w.el('<header class="mainbar"><button id="test-home">MCAT</button></header>');
  w.siteFooter = () => w.el('<footer><p class="sf-legal">Original study content with guided self-review.</p></footer>');
  w.setView = root => {
    w.document.getElementById('app').replaceChildren(root);
  };
  w.sectionUrl = () => '/mcat';
  w.loadJSON = (key, fallback) => {
    const value = w.localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  };
  w.fetch = async () => ({ ok: false, json: async () => ({}) });
  const run = code => vm.runInContext(code, context);
  for (const name of [
    'study-storage.js',
    'mcat-course-engine.js',
    'mcat-v2-engine.js',
    'mcat-repair-engine.js',
    'mcat.js',
    'mcat-repair.js',
    'mcat-course.js',
    'mcat-workflows.js',
  ])
    run(fs.readFileSync(name, 'utf8'));
  run(
    `courseData=${courseJson}; var v2Data=null; renderMCATEntry=()=>{}; renderAcademyStats=()=>{}; loadMCAT=async()=>{};`
  );
  if (repairs)
    run(
      `repairData=${repairsJson}; repairState=McatRepairCore.normalize(StudyStorage.read('${REPAIR_KEY}',null),repairData.concepts);`
    );
  w.testCalls = calls;
  run('renderGuide=()=>{testCalls.guide++;}; renderRepairSession=()=>{testCalls.session++;};');
  if (!realHub) run('renderRepairHub=async()=>{testCalls.hub++;};');
  const find = selector => w.document.querySelector(selector);
  const click = selector => {
    const node = find(selector);
    assert.ok(node, 'Missing ' + selector);
    node.click();
    assert.equal(errors.length, 0, errors[0]?.stack);
  };
  return {
    w,
    run,
    find,
    click,
    errors,
    calls,
    advance: ms => {
      clock += ms;
    },
    raw: key => w.localStorage.getItem(key),
    close: () => dom.window.close(),
  };
}
const plain = value => JSON.parse(JSON.stringify(value));
/* One completed repair session on the first concept, finished `daysAgo` days before the clock. */
const seededRecords =
  daysAgo => `(()=>{const c=repairData.concepts[0],at=Date.now()-${daysAgo}*${DAY},s=McatRepairCore.empty();
  McatRepairCore.begin(c,s,'repair',at);McatRepairCore.answer(c,s,c.diagnostic.answer,'sure',at);s.active.phase='lesson';McatRepairCore.afterLesson(c,s,at);
  McatRepairCore.answer(c,s,c.checks[0].answer,'sure',at+1000);s.active=null;repairState=s;saveMcatRepair();})()`;

test('Progress view renders with a visible retry state instead of throwing when repair lessons failed to load', () => {
  const h = harness({ repairs: false });
  h.run('renderCourseProgress()');
  assert.equal(h.errors.length, 0, h.errors[0]?.stack);
  assert.ok(h.find('.course-progress-heading'), 'progress view mounted');
  const evidence = h.find('#course-repair-evidence');
  assert.match(evidence.textContent, /lessons could not load/);
  assert.ok(evidence.querySelector('[data-repair-retry]'), 'retry control offered');
  h.close();
});

test('Saved-work section still lists an in-progress concept session when repairs are loaded', () => {
  const h = harness();
  h.run(
    "McatRepairCore.begin(repairData.concepts[2],repairState,'repair',Date.now());saveMcatRepair();renderCourseProgress()"
  );
  assert.equal(h.errors.length, 0, h.errors[0]?.stack);
  assert.match(h.find('#app').textContent, /Concept repair · Session in progress/);
  h.close();
});

test('Learning-record repair button opens the hub and leaves saved records untouched when lessons are missing', () => {
  const stored = JSON.stringify({
    version: 1,
    records: { 'enzyme-inhibition': { attempts: [], reviewedAt: 5, dueAt: 0 } },
    active: null,
  });
  const h = harness({ repairs: false, seed: new Map([[REPAIR_KEY, stored]]) });
  h.run(
    "var body=el('<section></section>');document.getElementById('app').appendChild(body);var unit=courseUnit('enzyme-rates');courseLearningRecord(body,unit,courseRecord(unit.id));"
  );
  assert.ok(h.find('[data-course-repair]'), 'repair button rendered from the static unit list');
  h.click('[data-course-repair]');
  assert.equal(h.calls.hub, 1);
  assert.equal(h.calls.session, 0);
  assert.equal(h.raw(REPAIR_KEY), stored, 'a null state must never overwrite saved repair records');
  h.close();
});

test('The repair hub itself renders the unavailable state without throwing after a failed fetch', async () => {
  const h = harness({ repairs: false, realHub: true });
  await h.run('renderRepairHub()');
  assert.equal(h.errors.length, 0, h.errors[0]?.stack);
  assert.match(h.find('#app').textContent, /lessons could not load/);
  assert.ok(h.find('[data-repair-retry]'));
  h.close();
});

test('A stale due-check task whose check was already taken today is marked complete instead of throwing', () => {
  const h = harness();
  h.run(seededRecords(2));
  const task = plain(
    h.run("var plan=buildFlexiblePlan(30);var task=studyDailySession(plan).tasks.find(t=>t.type==='repair');task")
  );
  assert.equal(task.repairKind, 'later');
  assert.equal(task.conceptId, 'enzyme-inhibition');
  // The later check is completed from the dashboard path, which never attaches the daily task.
  h.run(
    "(()=>{const c=repairConcept(task.conceptId);McatRepairCore.begin(c,repairState,'later',Date.now());McatRepairCore.answer(c,repairState,c.checks[1].answer,'sure',Date.now()+5);repairState.active=null;saveMcatRepair();})()"
  );
  const attemptsBefore = h.run('repairState.records[task.conceptId].attempts.length');
  h.run('studyLaunchTask(task,guidePlan())');
  assert.equal(h.errors.length, 0, h.errors[0]?.stack);
  assert.equal(h.run('guideTaskDone(guidePlan(),task.day,task.id)'), true);
  assert.equal(h.run('repairState.active'), null, 'no session started for an already-taken check');
  assert.equal(h.run('repairState.records[task.conceptId].attempts.length'), attemptsBefore);
  assert.equal(h.calls.guide, 1);
  assert.equal(h.calls.session, 0);
  h.close();
});

test('A stale due-check task with no check today rebuilds the session instead of throwing', () => {
  const h = harness();
  h.run(seededRecords(2));
  const task = plain(
    h.run("var plan=buildFlexiblePlan(30);var task=studyDailySession(plan).tasks.find(t=>t.type==='repair');task")
  );
  assert.equal(task.repairKind, 'later');
  // Records were reset elsewhere: the scheduled check no longer exists.
  h.run('repairState=McatRepairCore.empty();saveMcatRepair();');
  h.run('studyLaunchTask(task,guidePlan())');
  assert.equal(h.errors.length, 0, h.errors[0]?.stack);
  assert.equal(h.calls.guide, 1);
  assert.equal(h.run('guideTaskDone(guidePlan(),task.day,task.id)'), false, 'nothing was completed');
  assert.equal(h.run('repairState.active'), null);
  const rebuilt = plain(h.run("studyDailySession(guidePlan()).tasks.find(t=>t.type==='repair')"));
  assert.notEqual(rebuilt.repairKind, 'later');
  h.close();
});

test('A daily task for one concept never attaches to a saved session for a different concept', () => {
  const h = harness();
  const task = plain(
    h.run("var plan=buildFlexiblePlan(30);var task=studyDailySession(plan).tasks.find(t=>t.type==='repair');task")
  );
  const other = h.run(`repairData.concepts.find(c=>c.id!=='${task.conceptId}').id`);
  h.run(`McatRepairCore.begin(repairConcept('${other}'),repairState,'repair',Date.now());saveMcatRepair();`);
  h.run('studyLaunchTask(task,guidePlan())');
  assert.equal(h.errors.length, 0, h.errors[0]?.stack);
  assert.equal(h.calls.hub, 1);
  assert.equal(h.calls.session, 0);
  assert.equal(h.run('repairState.active.conceptId'), other);
  assert.equal(h.run('repairState.active.guideTask'), undefined);
  assert.equal(h.run('guidePlan().active'), undefined);
  // Finishing the other concept must not credit this concept's task.
  h.run("repairState.active.phase='done';studyCompleteRepair(repairState.active)");
  assert.equal(h.run('guideTaskDone(guidePlan(),task.day,task.id)'), false);
  h.close();
});

test('Launching the same concept task twice resumes one session and attaches it once', () => {
  const h = harness();
  const task = plain(
    h.run("var plan=buildFlexiblePlan(30);var task=studyDailySession(plan).tasks.find(t=>t.type==='repair');task")
  );
  h.run('studyLaunchTask(task,guidePlan())');
  const started = h.run('repairState.active.startedAt');
  h.advance(60000);
  h.run('studyLaunchTask(task,guidePlan())');
  assert.equal(h.errors.length, 0, h.errors[0]?.stack);
  assert.equal(h.calls.session, 2);
  assert.equal(h.run('repairState.active.startedAt'), started);
  assert.equal(h.run('repairState.active.conceptId'), task.conceptId);
  assert.equal(h.run('repairState.active.guideTask.id'), task.id);
  assert.equal(h.run('guidePlan().active.id'), task.id);
  h.close();
});

test('A repair task launched while lessons are unavailable opens the hub without throwing', () => {
  const h = harness({ repairs: false });
  h.run(
    "studyLaunchTask({id:'flex-x-repair',day:1,type:'repair',conceptId:'enzyme-inhibition',repairKind:'later',minutes:5},{sessions:{},completed:{}})"
  );
  assert.equal(h.errors.length, 0, h.errors[0]?.stack);
  assert.equal(h.calls.hub, 1);
  h.close();
});

test('An early repair visit practices a seen question and the result screen keeps its reservation promise', () => {
  const h = harness();
  h.run(seededRecords(0));
  h.advance(5 * 3600000);
  const before = plain(h.run('repairState.records["enzyme-inhibition"]'));
  h.run(
    "const c=repairData.concepts[0];McatRepairCore.begin(c,repairState,'repair',Date.now());McatRepairCore.answer(c,repairState,c.diagnostic.answer,'sure',Date.now());repairState.active.phase='lesson';McatRepairCore.afterLesson(c,repairState,Date.now());"
  );
  assert.equal(
    h.run('repairState.active.questionId'),
    h.run('repairData.concepts[0].checks[0].id'),
    'the seen check is replayed'
  );
  h.run(
    "McatRepairCore.answer(repairData.concepts[0],repairState,repairData.concepts[0].checks[0].answer,'sure',Date.now())"
  );
  assert.equal(h.run('repairState.active.result.mode'), 'practice');
  assert.equal(
    h.run('repairState.records["enzyme-inhibition"].dueAt'),
    before.dueAt,
    'the scheduled check keeps its date'
  );
  assert.equal(
    h.run('McatRepairCore.unseenChecks(repairData.concepts[0],repairState).length'),
    2,
    'unseen checks stay reserved'
  );
  h.close();
});

test('The repair dashboard distinguishes reserved checks from an exhausted library without creating work', () => {
  const h = harness();
  h.run(`for(const c of repairData.concepts){
    const at=Date.now(),s=repairState;
    McatRepairCore.begin(c,s,'repair',at);McatRepairCore.answer(c,s,c.diagnostic.answer,'sure',at);
    s.active.phase='lesson';McatRepairCore.afterLesson(c,s,at);
    McatRepairCore.answer(c,s,c.checks[0].answer,'sure',at+1);s.active=null;
  }
  var dashboard=el('<section></section>');document.getElementById('app').appendChild(dashboard);
  mountRepairDashboard(dashboard);`);
  assert.match(h.find('.repair-priority').textContent, /Your next checks are scheduled/);
  assert.equal(h.find('[data-repair-start]'), null);
  h.run(`for(const c of repairData.concepts){
    for(const q of c.checks.slice(1)){
      const due=repairState.records[c.id].dueAt;
      McatRepairCore.begin(c,repairState,'later',due);
      McatRepairCore.answer(c,repairState,q.answer,'sure',due+1);repairState.active=null;
    }
  } saveMcatRepair();`);
  const before = h.raw(REPAIR_KEY);
  h.run('mountRepairDashboard(dashboard)');
  assert.match(h.find('.repair-priority').textContent, /All authored applications have been seen/);
  assert.match(h.find('.repair-priority').textContent, /repeat practice/);
  assert.doesNotMatch(h.find('.repair-priority').textContent, /scheduled|when they are due/);
  assert.equal(h.find('[data-repair-start]'), null);
  h.click('[data-repair-library]');
  assert.equal(h.calls.hub, 1);
  assert.equal(h.raw(REPAIR_KEY), before, 'rendering and opening the library must not add attempts');
  h.close();
});
