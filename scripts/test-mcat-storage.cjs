/* Failure injection in isolated memory only. No browser, account, or learner writes. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function setup(seed=new Map()){
  const data=seed,events=new Map(),nodes=new Map(),timers=new Map(),operations=[];
  let writeFault=null,readFault=null,clock=1800000000000,timerId=0;
  const node=()=>({style:{},classList:{toggle(){}},setAttribute(){},addEventListener(){},appendChild(){},showModal(){this.open=true;},close(){this.open=false;},remove(){},querySelector:s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},querySelectorAll:()=>[]});
  const storage={getItem:key=>{if(readFault?.(key))throw new Error('Unavailable');return data.get(key)??null;},setItem:(key,value)=>{if(writeFault?.(key))throw new Error('QuotaExceeded');data.set(key,String(value));operations.push(['set',key]);},removeItem:key=>{if(writeFault?.(key))throw new Error('QuotaExceeded');data.delete(key);operations.push(['remove',key]);}};
  const dispatch=event=>{for(const fn of events.get(event.type)||[])fn(event);};
  class TestDate extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
  const context=vm.createContext({console,Date:TestDate,Event,URL,URLSearchParams,sectionUrl:key=>'/'+key,localStorage:storage,CortexProgress:{OWNER:'owner'},loadJSON:(key,fallback)=>JSON.parse(data.get(key)||'null')??fallback,location:{origin:'http://localhost',pathname:'/mcat',search:'',reload(){}},
    window:{addEventListener:(type,fn)=>{if(!events.has(type))events.set(type,[]);events.get(type).push(fn);},dispatchEvent:dispatch},
    document:{body:node(),hidden:false,addEventListener(){},createElement:node,querySelector:s=>nodes.get(s)||null},
    setInterval:fn=>{timers.set(++timerId,fn);return timerId;},clearInterval:id=>timers.delete(id),setTimeout(){},
    repairSaveFailed:false,esc:value=>String(value),McatCourseCore:require('../mcat-course-engine.js'),McatV2Core:require('../mcat-v2-engine.js'),
    el(){throw new Error('RENDER_BOUNDARY');}});
  const run=code=>vm.runInContext(code,context);
  const load=files=>files.forEach(file=>run(fs.readFileSync(path.join(root,file),'utf8')));
  load(['study-storage.js']);
  return {run,load,data,nodes,operations,timers,storage,dispatch,advance:ms=>{clock+=ms;},failWrite:fn=>{writeFault=fn;},failRead:fn=>{readFault=fn;}};
}
const integrations=s=>s.load(['mcat.js','mcat-course.js','mcat-workflows.js','mcat-v2.js']);
const stopAtRender=(s,code)=>assert.throws(()=>s.run(code),/RENDER_BOUNDARY/);
let failures=0;
function test(name,fn){try{fn();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.stack);}}
test('Successful saves, reads, and removals remain compatible',()=>{
  const s=setup();assert.equal(s.run('StudyStorage.write("draft",{note:"first"})'),true);
  assert.equal(s.run('StudyStorage.read("draft",null).note'),'first');
  assert.equal(s.run('StudyStorage.remove("draft")'),true);assert.equal(s.data.has('draft'),false);
});
test('Failed saves preserve both copies, expose a modal, and retry the newest queued draft',()=>{
  const s=setup(new Map([['draft','{"note":"saved"}']]));s.failWrite(()=>true);
  assert.equal(s.run('StudyStorage.write("draft",{note:"unsaved"})'),false);
  assert.equal(s.nodes.get('#study-conflict-title').textContent,'Your latest work could not be saved.');
  assert.equal(s.run('StudyStorage.read("draft",null).note'),'unsaved');
  s.run('StudyStorage.write("draft",{note:"newest"})');
  assert.equal(JSON.parse(s.data.get('draft')).note,'saved');
  assert.equal(s.run('StudyStorage.recovery().records.draft.thisTab.note'),'newest');
  assert.equal(s.run('StudyStorage.recovery().records.draft.saved.note'),'saved');
  assert.equal(s.run('StudyStorage.retry()'),false);
  s.failWrite(null);assert.equal(s.run('StudyStorage.retry()'),true);
  assert.equal(JSON.parse(s.data.get('draft')).note,'newest');assert.equal(s.run('StudyStorage.paused'),false);
});
test('Queued archive writes finish before the resumable copy is deleted',()=>{
  const s=setup(new Map([['resume','{"answer":1}']]));s.failWrite(()=>true);
  s.run('StudyStorage.write("archive",{answer:1});StudyStorage.remove("resume")');
  assert.ok(s.data.has('resume'));s.failWrite(null);s.run('StudyStorage.retry()');
  assert.deepEqual(s.operations,[['set','archive'],['remove','resume']]);
});
test('An accidental close is guarded, while choosing Reload still keeps stale writes paused',()=>{
  const s=setup();s.failWrite(()=>true);s.run('StudyStorage.write("draft",{note:"pending"})');
  let prompts=0;const event={type:'beforeunload',preventDefault(){prompts++;}};
  s.dispatch(event);assert.equal(prompts,1);
  s.nodes.get('#study-conflict-reload').onclick();s.dispatch(event);assert.equal(prompts,1);
  assert.equal(s.run('StudyStorage.paused'),true);assert.equal(s.run('StudyStorage.write("draft",{note:"late event"})'),false);
});
test('Retry preflights every observed key before changing any saved copy',()=>{
  const s=setup(new Map([['first','1'],['second','2']]));s.run('StudyStorage.read("second",null)');s.failWrite(()=>true);
  s.run('StudyStorage.write("first",3)');s.data.set('second','4');s.failWrite(null);
  assert.equal(s.run('StudyStorage.retry()'),false);assert.equal(s.data.get('first'),'1');
  assert.equal(s.run('StudyStorage.conflicted'),true);assert.equal(s.nodes.get('#study-save-retry').hidden,true);
});
test('Cross-tab changes pause immediately and retain the old tab draft for recovery',()=>{
  const s=setup(new Map([['draft','{"note":"old"}']]));s.run('var current={note:"this tab"};StudyStorage.watch("draft",()=>current)');
  s.data.set('draft','{"note":"other tab"}');s.dispatch({type:'storage',storageArea:s.storage,key:'draft'});
  assert.equal(s.run('StudyStorage.conflicted'),true);
  assert.equal(s.run('StudyStorage.recovery().records.draft.thisTab.note'),'this tab');
  assert.equal(s.run('StudyStorage.recovery().records.draft.saved.note'),'other tab');
  assert.equal(s.run('StudyStorage.write("draft",current)'),false);
});
test('Read failures and malformed JSON never get replaced with default progress',()=>{
  for(const damaged of [false,true]){
    const s=setup(new Map([['draft',damaged?'{broken':'{"note":"saved"}']]));if(!damaged)s.failRead(()=>true);
    s.run('StudyStorage.read("draft",{});StudyStorage.write("draft",{})');s.failRead(null);
    assert.equal(s.run('StudyStorage.retry()'),false);assert.equal(s.data.get('draft'),damaged?'{broken':'{"note":"saved"}');
  }
});
test('An account switch prevents writes and excludes the new account from the recovery export',()=>{
  const s=setup(new Map([['owner','A'],['draft','{"note":"A saved"}']]));s.run('StudyStorage.read("draft",null)');
  s.data.set('owner','B');s.data.set('draft','{"note":"B private"}');
  assert.equal(s.run('StudyStorage.write("draft",{note:"A pending"})'),false);
  const text=s.run('JSON.stringify(StudyStorage.recovery())');assert.ok(!text.includes('B private'));assert.ok(text.includes('A saved'));assert.ok(text.includes('A pending'));
  assert.equal(s.run('StudyStorage.recovery().accountChanged'),true);
});
test('A serialization failure cannot falsely report recovery or delete the resumable copy',()=>{
  const s=setup(new Map([['resume','{"answer":1}']]));
  s.run('var circular={};circular.self=circular;StudyStorage.write("archive",circular);StudyStorage.remove("resume")');
  assert.equal(s.run('StudyStorage.retry()'),false);assert.ok(s.data.has('resume'));assert.equal(s.data.has('archive'),false);
  assert.doesNotThrow(()=>s.run('JSON.stringify(StudyStorage.recovery())'));
  s.run('delete circular.self;circular.answer=1');assert.equal(s.run('StudyStorage.retry()'),true);assert.equal(s.data.has('resume'),false);
});
test('Finishing a drill after a partial save and reload counts each answer once',()=>{
  const s=setup();integrations(s);
  s.run('drill={attemptId:"run",idx:1,qs:[],results:[{id:"q",section:"bioBiochem",category:"cat",correct:true,conf:"sure"}]};saveResume("drill",drill)');
  s.failWrite(key=>key==='cs-mcat-log');stopAtRender(s,'finishDrill()');
  assert.equal(JSON.parse(s.data.get('cs-mcat-q')).q.n,1);assert.ok(s.data.has('cs-mcat-r-drill'));
  const again=setup(s.data);integrations(again);again.run('drill=loadResume("drill")');stopAtRender(again,'finishDrill()');
  assert.equal(JSON.parse(s.data.get('cs-mcat-q')).q.n,1);assert.equal(JSON.parse(s.data.get('cs-mcat-log')).length,1);
  assert.equal(s.data.has('cs-mcat-r-drill'),false);
});
test('Passage history also survives a partially saved log without double counting',()=>{
  const s=setup();integrations(s);const run={attemptId:'p-run',attemptEndedAt:1800000000000,p:{id:'p',section:'bioBiochem'},results:[{q:{id:'q',category:'cat'},correct:true}]};
  s.failWrite(key=>key==='cs-mcat-log');s.run(`studyLogAttempt(${JSON.stringify(run)},'plab')`);
  const again=setup(s.data);integrations(again);again.run(`studyLogAttempt(${JSON.stringify(run)},'plab')`);
  assert.equal(JSON.parse(s.data.get('cs-mcat-q')).q.n,1);assert.equal(JSON.parse(s.data.get('cs-mcat-log')).length,1);
});
test('Failed exam archiving preserves the resume until recovery completes',()=>{
  const s=setup();integrations(s);
  s.run('sim={attemptId:"exam",queue:[{key:"chemPhys"}],results:[{key:"chemPhys",items:[],correct:0,total:1}]};saveResume("sim",sim)');
  s.failWrite(key=>key==='cs-mcat-exam-reviews');stopAtRender(s,'finishSim()');
  assert.ok(s.data.has('cs-mcat-r-sim'));assert.equal(s.data.has('cs-mcat-exam-reviews'),false);
  s.failWrite(null);assert.equal(s.run('StudyStorage.retry()'),true);
  assert.equal(JSON.parse(s.data.get('cs-mcat-exam-reviews'))[0].attemptId,'exam');assert.equal(s.data.has('cs-mcat-r-sim'),false);
});
test('Resubmitting a section after a partial save does not duplicate exam history',()=>{
  const s=setup();integrations(s);
  s.run('sim={attemptId:"exam-repeat",si:0,idx:0,answers:{"0:0":1},deadline:Date.now()+60000,queue:[{key:"chemPhys",items:[{q:{id:"exam-q",answer:1,category:"cat"}}]}],results:[]};saveResume("sim",sim)');
  s.failWrite(key=>key==='cs-mcat-log');stopAtRender(s,'submitSection()');
  const again=setup(s.data);integrations(again);again.run('sim=loadResume("sim")');stopAtRender(again,'submitSection()');
  assert.equal(JSON.parse(s.data.get('cs-mcat-q'))['exam-q'].n,1);assert.equal(JSON.parse(s.data.get('cs-mcat-log')).length,1);
  assert.equal(JSON.parse(s.data.get('cs-mcat-exam-reviews'))[0].results[0].correct,1);
});
test('A saved session that cannot open is kept for recovery instead of deleted',()=>{
  const raw='{"idx":1,"results":[{}]}',s=setup(new Map([['cs-mcat-r-drill',raw]]));integrations(s);
  assert.equal(s.run('resumeBtn("drill")'),null);assert.equal(s.data.get('cs-mcat-r-drill'),raw);
  assert.equal(s.run('StudyStorage.paused'),true);assert.equal(s.nodes.get('#study-conflict-title').textContent,'Your saved session could not open.');
});
test('A saved final flashcard rating survives failed resume deletion without a second scheduling update',()=>{
  const s=setup();integrations(s);
  s.run('flash={attemptId:"flash-run",queue:[{id:"card"}],idx:0,done:0,again:0,total:1};saveResume("flash",flash)');
  s.failWrite(key=>key==='cs-mcat-r-flash');stopAtRender(s,'rateFlash(flash.queue[0],"good")');
  const rated=s.data.get('cs-mcat-srs');assert.ok(s.data.has('cs-mcat-r-flash'));
  const again=setup(s.data);integrations(again);again.run('flash=loadResume("flash")');
  assert.ok(again.run('RESUME_SPECS.find(s=>s.key==="flash").progressOf(flash)'));
  stopAtRender(again,'renderFlashCard()');
  assert.equal(s.data.get('cs-mcat-srs'),rated);assert.equal(again.run('flash.done'),1);assert.equal(s.data.has('cs-mcat-r-flash'),false);
});
test('Recovering an Again rating repeats the card once and preserves its lapse count',()=>{
  const s=setup();integrations(s);s.run('mcatTaskHeader=()=>"";flash={attemptId:"again-run",queue:[{id:"card",category:"cat"}],idx:0,done:0,again:0,total:1};saveResume("flash",flash)');
  s.failWrite(key=>key==='cs-mcat-r-flash');stopAtRender(s,'rateFlash(flash.queue[0],"again")');
  const rated=s.data.get('cs-mcat-srs'),again=setup(s.data);integrations(again);again.run('mcatTaskHeader=()=>"";flash=loadResume("flash")');stopAtRender(again,'renderFlashCard()');
  assert.equal(s.data.get('cs-mcat-srs'),rated);assert.equal(again.run('flash.idx'),1);assert.equal(again.run('flash.again'),1);assert.equal(again.run('flash.queue.length'),2);
  stopAtRender(again,'rateFlash(flash.queue[flash.idx],"good")');
  assert.equal(JSON.parse(s.data.get('cs-mcat-srs')).card.lapses,1);assert.equal(again.run('flash.done'),1);
});
test('Timed work pauses during failed saving and resumes with the same time remaining',()=>{
  const s=setup();integrations(s);s.nodes.set('#cars-timer',{});
  s.run('cars={phase:"attempt",deadline:Date.now()+60000,timerId:setInterval(()=>{},500),results:[]};saveResume("cars",cars);v2BeginActivity("course","unit")');
  s.advance(5000);s.failWrite(()=>true);s.run('saveResume("cars",cars)');
  assert.equal(s.run('cars.timerId'),null);assert.equal(s.run('v2Clock'),null);
  assert.equal(s.run('loadResume("cars")._remain'),55000);
  s.advance(120000);s.failWrite(null);s.run('StudyStorage.retry()');
  assert.equal(s.run('cars.deadline-Date.now()'),55000);assert.ok(s.run('cars.timerId'));
});
test('Learn to Learn retains original answers and newest drafts through a failed save',()=>{
  const s=setup();s.load(['socrates.js']);
  s.run('var lesson={id:"g1",revision:1};var step={id:"g1.practice.4",type:"practice"};var response=ltlStepRecord("general",lesson,step);response.draft="first";saveLtlProgress()');
  s.failWrite(()=>true);
  s.run('response.draft="newest";response.revealedAt="2026-09-07T00:00:00Z";saveLtlProgress()');
  assert.equal(JSON.parse(s.data.get('cs-ltl-progress-v1')).general.lessons.g1.steps['g1.practice.4'].draft,'first');
  assert.equal(s.run('StudyStorage.recovery().records["cs-ltl-progress-v1"].thisTab.general.lessons.g1.steps["g1.practice.4"].draft'),'newest');
  s.failWrite(null);assert.equal(s.run('StudyStorage.retry()'),true);
  const restored=setup(new Map(s.data));restored.load(['socrates.js']);
  assert.equal(restored.run('LTL_PROGRESS.general.lessons.g1.steps["g1.practice.4"].draft'),'newest');
  assert.equal(restored.run('ltlStepReady({type:"practice"},LTL_PROGRESS.general.lessons.g1.steps["g1.practice.4"])'),true);
});
test('Malformed learning records are paused and kept for recovery',()=>{
  for(const value of [[],{general:{completed:"broken"}},{general:{completed:[],lessons:{g1:{steps:null}}}}]){
    const raw=JSON.stringify(value),s=setup(new Map([['cs-ltl-progress-v1',raw]]));s.load(['socrates.js']);
    assert.equal(s.run('StudyStorage.paused'),true);
    assert.equal(s.run('saveLtlProgress()'),false);
    assert.equal(s.data.get('cs-ltl-progress-v1'),raw);
  }
});
test('Learning completion survives save recovery and repeat completion without changing its time',()=>{
  const s=setup();s.load(['socrates.js']);
  const track=JSON.parse(fs.readFileSync(path.join(root,'data/learn-to-learn.json'),'utf8')).tracks[0];
  s.run('LTL.byId.general='+JSON.stringify(track));
  s.run('var lesson=LTL.byId.general.lessons[0];var record=ltlLessonRecord("general",lesson);for(const step of lesson.steps){record.steps[step.id]=step.type==="check"?{selected:0}:step.type==="practice"?{draft:"Original response",revealedAt:new Date().toISOString()}:{};}');
  s.failWrite(()=>true);s.run('finishLtlLesson("general","g1")');
  const completedAt=s.run('record.completedAt');
  s.advance(60000);s.failWrite(null);assert.equal(s.run('StudyStorage.retry()'),true);
  stopAtRender(s,'finishLtlLesson("general","g1")');
  assert.equal(s.run('record.completedAt'),completedAt);
  assert.equal(s.run('LTL_PROGRESS.general.completed.filter(id=>id==="g1").length'),1);
  assert.equal(JSON.parse(s.data.get('cs-ltl-progress-v1')).general.lessons.g1.completedAt,completedAt);
});
process.exitCode=failures?1:0;
