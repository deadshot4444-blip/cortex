/* Pure planner integration. Synthetic records never touch browser or account storage. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const json = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
function setup() {
  const store = new Map();
  const repairData=json('data/mcat-repairs.json');
  let clock = new Date(2026, 8, 7, 10).getTime();
  class TestDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const context = vm.createContext({
    Date: TestDate, console,
    document: { addEventListener() {} }, window: { addEventListener() {} },
    loadJSON: (key, fallback) => store.has(key) ? JSON.parse(store.get(key)) : fallback,
    safeSet: (key, value) => { store.set(key, value); return true; },
    localStorage: { getItem: key => store.get(key) ?? null, setItem: (key,value) => store.set(key,value), removeItem: key => store.delete(key) },
    McatCourseCore: require('../mcat-course-engine.js'),
    McatV2Core: require('../mcat-v2-engine.js'),
    McatRepairCore: require('../mcat-repair-engine.js'),
    repairState: require('../mcat-repair-engine.js').empty(),
    repairData, repairConcept: id=>repairData.concepts.find(c=>c.id===id),
    inputCourse: json('data/mcat-course.json'),
    inputMcat: { outline: json('data/mcat-outline.json'), cards: json('data/mcat-cards.json'), questions: json('data/mcat-questions.json'), cars: json('data/mcat-cars.json'), sci: json('data/mcat-science-passages.json') }
  });
  const run = code => vm.runInContext(code, context);
  for (const file of ['mcat-storage.js','mcat.js','mcat-course.js','mcat-workflows.js']) run(fs.readFileSync(path.join(root,file),'utf8'));
  run('courseData=inputCourse; Object.assign(MCAT,inputMcat);');
  return { run, advance: days => { clock += days*86400000; }, setDate: date => { clock = date.getTime(); } };
}
let failures = 0;
function test(name, fn) { try { fn(); console.log('PASS',name); } catch(error) { failures++; console.error('FAIL',name,error.stack); } }

test('A first 15-minute session starts one lesson without choosing a test date', () => {
  const {run}=setup();
  const result=run(`var plan=buildFlexiblePlan(15); var session=studyDailySession(plan); ({plan:guidePlan(),session})`);
  assert.equal(result.plan.flexible,true);
  assert.equal(result.plan.targetDate,'');
  assert.equal(result.plan.dailyMinutes,15);
  assert.equal(result.session.tasks.length,1);
  assert.equal(result.session.tasks[0].type,'course');
  assert.equal(result.session.tasks[0].unitId,'protein-structure');
  assert.equal(result.session.tasks[0].minutes,12);
});

test('Flexible study has no arbitrary taper, deadline, or final-day cap', () => {
  const {run,advance}=setup();
  run('var plan=buildFlexiblePlan();');
  advance(180);
  assert.equal(run('guidePlanDay(plan)'),181);
  assert.equal(run('guidePhase(plan,guidePlanDay(plan))'),'Build');
  assert.ok(run('guideFocusCategory(plan,guidePlanDay(plan)).id'));
  assert.ok(run('studyDailySession(plan).tasks.some(t=>t.type==="course")'));
});

test('The first-session action resumes an unfinished five-minute concept without replacing its answer', () => {
  const {run}=setup();
  const result=run(`var concept=repairData.concepts[0];McatRepairCore.begin(concept,repairState,'repair',Date.now());
    McatRepairCore.answer(concept,repairState,1,'sure',Date.now());
    var before=JSON.stringify(repairState);var task=studyBuildSession(buildFlexiblePlan(15),15).tasks[0];
    ({task,unchanged:JSON.stringify(repairState)===before})`);
  assert.equal(result.task.type,'repair');assert.equal(result.task.resume,true);
  assert.equal(result.unchanged,true);
});

test('Existing dated tracks retain their schedule and completion identities', () => {
  const {run,advance}=setup();
  const before=run(`var plan=buildPlan('90');plan.completed['1:flash']=Date.now();saveGuidePlan(plan);JSON.stringify(plan)`);
  assert.equal(run('JSON.stringify(guidePlan())'),before);
  assert.equal(run('guidePhase(plan,90)'),'Taper');
  assert.equal(run('plan.weeks.length'),13);
  assert.ok(run('plan.targetDate'));
  advance(120);
  assert.equal(run('guidePlanDay(guidePlan())'),90);
  assert.ok(run('guideTaskDone(guidePlan(),1,"flash")'));
});

test('Seven days of flexible study stay bounded and do not invent completed work', () => {
  for(const budget of [15,30,60]) {
    const {run,advance}=setup();
    run(`var plan=buildFlexiblePlan(${budget});`);
    const seen=new Set();
    for(let day=1;day<=7;day++) {
      const session=run('studyDailySession(plan)');
      assert.ok(session.tasks.length>0);
      assert.ok(session.tasks.reduce((n,t)=>n+t.minutes,0)<=budget);
      assert.equal(new Set(session.tasks.map(t=>`${t.day}:${t.id}`)).size,session.tasks.length);
      assert.equal(run('Object.keys(plan.completed).length'),0);
      assert.ok(!seen.has(session.date)); seen.add(session.date);
      advance(1);
    }
  }
});

test('A saved lesson survives missed days and a smaller budget, retaining its draft and identity', () => {
  const {run,advance}=setup();
  run(`var plan=buildFlexiblePlan(30);var first=studyDailySession(plan).tasks.find(t=>t.type==='course');
    var record=courseRecord(first.unitId);record.startedAt=Date.now();record.notes='Synthetic saved draft';record.guideTask=first;
    courseState.activeUnit=first.unitId;plan.active=first;saveCourse();studyTouch(plan);`);
  advance(4);
  const session=run('studyDailySession(guidePlan(),15)');
  assert.equal(session.tasks[0].type,'course');
  assert.equal(session.tasks[0].day,1);
  assert.equal(session.tasks[0].resume,true);
  assert.equal(session.recoveryDays,3);
  assert.equal(run('courseRecord(first.unitId).notes'),'Synthetic saved draft');
  assert.equal(run('Object.keys(guidePlan().completed).length'),0);
});

test('Completed work remains completed through budget changes and a due check gets a new identity', () => {
  const {run,advance}=setup();
  run(`var plan=buildFlexiblePlan(15);var first=studyDailySession(plan).tasks[0];var unit=courseUnit(first.unitId);
    var record=courseRecord(unit.id);record.learnedAt=Date.now();record.exploredAt=Date.now();record.guideTask=first;
    unit.questions.filter(q=>q.kind==='check').forEach(q=>McatCourseCore.answer(courseState,unit,q,q.answer,'sure',Date.now()));
    McatCourseCore.complete(courseState,unit,Date.now());courseStudyTaskDone(record,unit.id);`);
  const sameDay=run('studyDailySession(guidePlan(),60)');
  assert.equal(sameDay.tasks.filter(t=>t.type==='course').length,1);
  assert.ok(run('guideTaskDone(guidePlan(),first.day,first.id)'));
  advance(1);
  const nextDay=run('studyDailySession(guidePlan(),15)');
  const later=nextDay.tasks.find(t=>t.type==='course');
  assert.equal(later.courseKind,'delayed');
  assert.equal(later.unitId,run('first.unitId'));
  assert.notEqual(later.id,run('first.id'));
  assert.equal(run('courseRecord(unit.id).attempts.length'),2);
});

test('Calendar day numbering follows local dates across daylight-saving changes', () => {
  const {run,setDate}=setup();
  setDate(new Date(2026,2,7,10)); run('var plan=buildFlexiblePlan();');
  setDate(new Date(2026,2,9,10));
  assert.equal(run('guidePlanDay(plan)'),3);
});
test('A content outage cannot erase an unfinished daily assignment or change its budget',()=>{
  const {run}=setup();
  const before=run('var plan=buildFlexiblePlan(15);studyDailySession(plan);JSON.stringify(guidePlan())');
  const original=run('JSON.stringify(plan.sessions[guideDateKey()])');
  run('courseData=null');
  assert.equal(run('JSON.stringify(studyDailySession(plan,60))'),original);
  assert.equal(run('JSON.stringify(guidePlan())'),before);
  run('courseData=inputCourse;studyDailySession(plan,60)');
  assert.equal(run('guidePlan().dailyMinutes'),60);
});

test('Weekly setup carries today’s finished daily lesson once and keeps its original budget', () => {
  const {run}=setup();
  const day=run(`var plan=buildFlexiblePlan(15),task=studyDailySession(plan).tasks[0];
    plan.completed[guideTaskKey(task.day,task.id)]=Date.now();
    courseRecord(task.unitId).completedAt=Date.now();
    var state=McatV2Core.normalize({weekly:{availability:[15,15,15,15,15,15,15]}});
    var input={start:guideDateKey(),now:Date.now(),units:courseData.units,records:courseState.units,coaches:[],completedActivities:studyCompletedActivities(plan)};
    McatV2Core.week(state,input)[0]`);
  assert.equal(day.tasks.length,1);
  assert.equal(day.tasks[0].done,true);
  assert.equal(day.tasks[0].minutes,12);
  assert.equal(day.tasks[0].title,'From amino acid to protein');
});

test('Course work started outside any planner still counts toward today', () => {
  const {run}=setup();
  const day=run(`var state=McatV2Core.normalize({weekly:{availability:[15,15,15,15,15,15,15]}});
    courseRecord('protein-structure').completedAt=Date.now();
    McatV2Core.week(state,{start:guideDateKey(),now:Date.now(),units:courseData.units,records:courseState.units,coaches:[]})[0]`);
  assert.equal(day.tasks.length,1); assert.equal(day.tasks[0].done,true);
});

test('A weekly completion and its underlying course record do not double count', () => {
  const {run}=setup();
  const day=run(`var state=McatV2Core.normalize({weekly:{availability:[30,30,30,30,30,30,30]}});
    var stamp=Date.now();courseRecord('protein-structure').completedAt=stamp;
    state.weekly.done.saved={id:'course:protein-structure',type:'course',key:'protein-structure',title:'Completed lesson',minutes:15,ts:stamp+5,day:guideDateKey()};
    McatV2Core.week(state,{start:guideDateKey(),now:stamp+10,units:courseData.units,records:courseState.units,coaches:[]})[0]`);
  assert.equal(day.tasks.filter(t=>t.done&&t.key==='protein-structure').length,1);
  assert.ok(day.tasks.reduce((n,t)=>n+t.minutes,0)<=30);
});

test('A lesson completed after an interruption belongs to its actual completion day', () => {
  const {run,advance}=setup();
  run(`var plan=buildFlexiblePlan(15),task=studyDailySession(plan).tasks[0];`);
  advance(3);
  const result=run(`plan.completed[guideTaskKey(task.day,task.id)]=Date.now();
    var state=McatV2Core.normalize({weekly:{availability:[0,0,0,0,0,0,0]}});
    var records=studyCompletedActivities(plan);
    ({date:guideDateKey(),records,day:McatV2Core.week(state,{start:guideDateKey(),now:Date.now(),units:[],records:{},coaches:[],completedActivities:records})[0]})`);
  assert.equal(result.records[0].day,result.date);
  assert.equal(result.day.tasks.length,1);assert.equal(result.day.tasks[0].done,true);
  assert.equal(result.day.budget,0);
});
process.exitCode=failures?1:0;
