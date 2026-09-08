const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const lessons = JSON.parse(fs.readFileSync('data/cogpsych-learn.json'));
const bank = JSON.parse(fs.readFileSync('data/cogpsych-bank.json'));
const revisions = JSON.parse(fs.readFileSync('data/cogpsych-revisions.json'));
assert.equal(revisions.previousItems.length,21);
assert.equal(new Set(revisions.previousItems.map(q=>q.id)).size,21);
for (const prior of revisions.previousItems) {
  const revised = bank.find(q=>q.id===prior.id);
  assert.ok(revised);
  assert.equal(revised.answer,prior.answer,'Historical answer index must stay comparable');
  assert.equal(revised.revision,2);
  assert.notEqual(revised.q+revised.explain,prior.q+prior.explain);
}
const events=new Map();
const context = vm.createContext({ console, StudyStorage:{read:()=>({}),watch(){},write:()=>true,sessionFailed(){throw Error('Unexpected corrupted record');}},localStorage:{getItem(){return 'synthetic';}},window:{addEventListener:(name,handler)=>events.set(name,handler)},document:{addEventListener(){}},Date });
for (const file of ['cogpsych.js','cogpsych-learn.js']) vm.runInContext(fs.readFileSync(file,'utf8'),context);
const run = code => vm.runInContext(code,context);
context.lessons = lessons;context.bank = bank;
assert.equal(lessons.length,74);assert.equal(bank.length,538);
assert.equal(run('var seen=new Set();lessons.every(l=>{const valid=cogValidLesson(l,seen);seen.add(l.id);return valid;})'),true);
assert.equal(run('seen=new Set();bank.every(q=>{const valid=cogValidBankItem(q,seen);seen.add(q.id);return valid;})'),true);
const foundation = lessons.filter(l=>l.foundationOrder).sort((a,b)=>a.foundationOrder-b.foundationOrder);
assert.equal(foundation.length,7);
for(const [i,lesson] of foundation.entries()) {
  assert.equal(lesson.foundationOrder,i+1);
  assert.deepEqual(lesson.prerequisites,i ? [foundation[i-1].id] : []);
  assert.ok(lesson.sources.length && lesson.sources.every(source=>new URL(source.url).protocol==='https:'));
  assert.ok(lesson.steps.some(step=>step.kind==='checkpoint'));
  assert.ok(lesson.steps.filter(step=>step.kind==='ask'&&!step.choices).length>=2);
}
assert.equal(run('cogStepReady({kind:"checkpoint"},{selected:0})'),true);
assert.equal(run('cogStepReady({kind:"checkpoint"},{})'),false);
assert.equal(run('cogStepReady({kind:"ask"},{draft:"Unrevealed writing"})'),false);
assert.equal(run('cogStepReady({kind:"ask"},{draft:"Original",revealedAt:123})'),true);
assert.equal(run('cogStepReady({kind:"teach"},{})'),false);
assert.equal(run('cogStepReady({kind:"teach"},{seenAt:123})'),true);
const research = lessons.filter(lesson=>lesson.researchOrder).sort((a,b)=>a.researchOrder-b.researchOrder);
assert.equal(research.length,4);
const course = JSON.parse(fs.readFileSync('data/mcat-course.json'));
const unitIds = new Set(course.units.map(unit=>unit.id));
for (const [i,lesson] of research.entries()) {
  assert.equal(lesson.researchOrder,i+1);
  assert.deepEqual(lesson.prerequisites,[i ? research[i-1].id : foundation.at(-1).id]);
  assert.equal(lesson.steps.filter(step=>step.kind==='checkpoint').length,2);
  assert.equal(lesson.steps.filter(step=>step.kind==='ask').length,2);
  assert.ok(lesson.mcatLinks.every(link=>unitIds.has(link.unitId)));
}
context.research=research;
run('COG_LESSONS=lessons; cogLearnReady=true; var frozen=cogLessonRecord(research[0]);');
const oldTitle=run('frozen.content.title');
run('research[0].title="Changed after starting"');
assert.equal(run('cogLessonRecord(research[0]).content.title'),oldTitle);
run('research[0].title=frozen.content.title');
run('var oldLesson=lessons[0]; var oldStep={...oldLesson.steps[0],body:"Earlier wording"}; COG.lessons[oldLesson.id]={index:1,steps:{[oldStep.id]:{content:oldStep,seenAt:10}},startedAt:5};');
assert.equal(run('cogLessonRecord(oldLesson).content.steps[0].body'),'Earlier wording','Whole-lesson snapshot migration retains exposed legacy wording');
const nodes = new Map(); let latestMain = '', fail = false, writes = new Map();
context.URL=URL;context.URLSearchParams=URLSearchParams;context.location=new URL('http://localhost/cogpsych?gates=prod');
context.history=Object.fromEntries(['pushState','replaceState'].map(method=>[method,(_,__,url)=>context.location.href=new URL(url,context.location).href]));
context.esc=String;context.sectionUrl=section=>'/'+section+'?gates=prod';
function element(html='') {
  const own=new Map();
  for (const match of html.matchAll(/id="([^"]+)"/g)) {const value={value:'',append(){}};own.set('#'+match[1],value);nodes.set('#'+match[1],value);}
  const textarea=html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/);
  if(textarea&&own.get('#cog-response'))own.get('#cog-response').value=textarea[1];
  const result={html,append(){},appendChild(){},querySelector:selector=>selector==='textarea'?own.get('#cog-response'):own.get(selector)||null,
    querySelectorAll:()=>[...html.matchAll(/data-pick="(\d+)"/g)].map(match=>{const value={dataset:{pick:match[1]}};nodes.set('pick-'+match[1],value);return value;})};
  if(html.includes('<main'))latestMain=html;
  return result;
}
context.el=element;context.topbar=()=>element();context.siteFooter=()=>element();context.setView=()=>{};
context.document.querySelector=selector=>nodes.get(selector);
context.StudyStorage.write=(key,value)=>{if(fail){context.StudyStorage.paused=true;return false;}writes.set(key,JSON.stringify(value));return true;};
run('COG.lessons={};COG.learned={};');
for(const lesson of [...foundation,...research]) {
  context.lessonId=lesson.id;run('renderCogLesson(lessonId)');
  let checks=0;
  for(const [index,step] of lesson.steps.entries()) {
    assert.equal(run('COG.lessons[lessonId].index'),index);
    if(step.kind==='ask') {
      const input=nodes.get('#cog-response');input.value='A specific explanation connecting the observed response to a possible process.';input.oninput();
      nodes.get('#lesson-next').onclick();assert.equal(run('COG.lessons[lessonId].index'),index);
      nodes.get('#cog-reveal').onclick();
    }else if(step.kind==='checkpoint') {
      const chosen=checks++===0?(step.answer+1)%step.options.length:step.answer;
      nodes.get('pick-'+chosen).onclick();nodes.get('pick-'+step.answer).onclick();
      context.stepId=step.id;assert.equal(run('COG.lessons[lessonId].steps[stepId].selected'),chosen);
    }
    if(index===lesson.steps.length-1) {
      fail=true;nodes.get('#lesson-next').onclick();
      const timestamp=run('COG.lessons[lessonId].completedAt');assert.ok(timestamp);
      assert.equal(JSON.parse(writes.get('cs-cogpsych')).learned[lesson.id],undefined);
      nodes.get('#lesson-next').onclick();assert.equal(run('COG.lessons[lessonId].completedAt'),timestamp);
      fail=false;context.StudyStorage.paused=false;nodes.get('#lesson-next').onclick();
      assert.equal(JSON.parse(writes.get('cs-cogpsych')).learned[lesson.id],timestamp);
    }else nodes.get('#lesson-next').onclick();
  }
  assert.match(latestMain,/Lesson complete/);assert.ok(latestMain.includes(`${checks-1}/${checks} first answers correct`));
  if(lesson.researchOrder)assert.match(latestMain,/Apply the methods in the research lab/);
}
(async()=>{
  run('cogBankReady=true');
  const lesson=foundation[0],index=lesson.steps.findIndex(step=>step.kind==='checkpoint');
  context.location.search='?view=lesson&lesson='+lesson.id+'&step='+(index+1);
  await events.get('study-storage-recovered')();
  assert.match(latestMain,/lesson-next/);assert.doesNotMatch(latestMain,/id="lesson-next" disabled/);
  assert.equal(run('COG.lessons[COG_LESSONS[0].id].index'),index,'A successful recovery refreshes the exact saved lesson screen');
  console.log('All 74 lesson structures and 538 practice items, eleven lesson journeys, valid MCAT links, snapshots, legacy wording, required-step gates and automatic recovery refresh passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
