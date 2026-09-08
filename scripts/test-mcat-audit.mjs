import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.CORTEX_URL||'http://127.0.0.1:8805/',browser=await chromium.launch({headless:true});
let failures=0;
async function test(name,fn){const ctx=await browser.newContext({viewport:{width:390,height:844}}),errors=[];ctx.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));await ctx.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"value":0}'}));try{await fn(ctx);assert.deepEqual(errors,[]);console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.message);}finally{await ctx.close();}}
async function open(ctx,view){const p=await ctx.newPage();await p.goto(base+'mcat?gates=prod&view='+view,{waitUntil:'networkidle'});return p;}
try{
await test('An older tab cannot erase a math answer saved in a second tab',async ctx=>{
  const older=await open(ctx,'weekly'),writer=await open(ctx,'math');
  await writer.click('[data-math-skill="units"]');await writer.check('[name="math-setup"][value="0"]');await writer.click('#math-setup-save');await writer.fill('#math-value','0.6');await writer.click('#math-calculate button');
  assert.equal(await writer.evaluate(()=>JSON.parse(localStorage.getItem('cs-mcat-v2')).math.history.length),1);
  await older.evaluate(()=>v2Go('weekly'));
  assert.equal(await older.evaluate(()=>JSON.parse(localStorage.getItem('cs-mcat-v2')).math.history.length),1);
  assert.equal(await older.locator('#study-save-conflict').count(),1);
  await older.click('#study-conflict-reload');await older.waitForLoadState('networkidle');
  assert.equal(await older.evaluate(()=>v2State.math.history.length),1);
});
await test('An older course tab preserves the newer notebook and can export its own work',async ctx=>{
  const older=await open(ctx,'course'),writer=await open(ctx,'course');
  await writer.evaluate(()=>renderCourseUnit('protein-structure','learn'));await writer.fill('#course-notes','Newer notebook, preserved.');
  await older.evaluate(()=>{courseRecord('protein-structure').notes='Unsaved local draft';saveCourse();});
  assert.equal(await older.evaluate(()=>JSON.parse(localStorage.getItem('cs-mcat-course-v1')).units['protein-structure'].notes),'Newer notebook, preserved.');
  const downloadEvent=older.waitForEvent('download');await older.click('#study-conflict-export');const download=await downloadEvent;
  let content='';for await(const chunk of await download.createReadStream())content+=chunk.toString();const backup=JSON.parse(content);
  assert.equal(backup.records['cs-mcat-course-v1'].thisTab.units['protein-structure'].notes,'Unsaved local draft');
  assert.equal(backup.records['cs-mcat-course-v1'].saved.units['protein-structure'].notes,'Newer notebook, preserved.');
  assert.ok(await older.evaluate(()=>document.querySelector('#study-save-conflict').getBoundingClientRect().width<=innerWidth));
});
await test('An unfinished ordinary passage counts as prior exposure in Passage Coach',async ctx=>{
  const p=await open(ctx,'practice');await p.evaluate(()=>{startCars(MCAT.cars.find(p=>p.id==='h2'),false);coursePauseTools();v2Go('coach');});
  await p.click('[data-coach-start="coach-h2"]');await p.check('[name="coach-mode"][value="independent"]');await p.click('#coach-begin');
  assert.equal(await p.evaluate(()=>v2State.coach.active.prior.length),await p.evaluate(()=>MCAT.cars.find(p=>p.id==='h2').questions.length));
});
await test('Moving from later feedback to Apply never mislabels the later question',async ctx=>{
  const p=await open(ctx,'course');
  const delayedStem=await p.evaluate(()=>{const u=courseUnit('protein-structure'),r=courseRecord(u.id),q=u.questions.find(q=>q.kind==='delayed');r.learnedAt=1;r.exploredAt=2;r.completedAt=Date.now()-86400000*2;r.attempts=[...u.questions.filter(q=>q.kind==='check').map(q=>({qId:q.id,kind:q.kind,chosen:q.answer,correct:true,ts:3})),{qId:q.id,kind:'delayed',chosen:q.answer,correct:true,ts:Date.now()}];r.feedback=q.id;McatCourseCore.refreshSchedule(courseState,u);saveCourse();renderCourseUnit(u.id,'delayed');return q.stem;});
  assert.ok((await p.locator('#course-body').innerText()).includes(delayedStem));await p.click('[data-course-stage="check"]');
  assert.equal((await p.locator('#course-body').innerText()).includes(delayedStem),false);
  assert.equal(await p.evaluate(()=>courseRecord('protein-structure').attempts.length),3);
});
await test('Shared footer and study-method copy accurately describe review and scheduling',async ctx=>{
  const p=await open(ctx,'practice');const text=await p.locator('body').textContent();assert.ok(text.includes('These schedules do not measure exactly when you will forget'));assert.equal(text.includes('independently reviewed'),false);assert.equal(text.includes('strongest test of mastery'),false);
  await p.goto(base+'learn',{waitUntil:'networkidle'});assert.equal((await p.locator('.sf-legal').innerText()).includes('independently reviewed'),false);
});
await test('A same-tab external update is checked before saving, with recovery available at 320px',async ctx=>{
  const p=await open(ctx,'weekly');await p.setViewportSize({width:320,height:844});
  await p.evaluate(()=>{const newer=JSON.parse(localStorage.getItem('cs-mcat-v2'));newer.weekly.targetDate='2027-06-01';localStorage.setItem('cs-mcat-v2',JSON.stringify(newer));v2State.weekly.targetDate='2027-01-01';v2Save();});
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('cs-mcat-v2')).weekly.targetDate),'2027-06-01');
  assert.equal(await p.locator('#study-save-conflict').isVisible(),true);await p.keyboard.press('Escape');assert.equal(await p.locator('#study-save-conflict').isVisible(),true);
  assert.ok(await p.evaluate(()=>document.querySelector('#study-save-conflict').getBoundingClientRect().width<=innerWidth));
  await p.screenshot({path:'output/playwright/mcat-audit-conflict-320.png'});
});
await test('Saving an exam review keeps the completed reservation after reload',async ctx=>{
  const p=await open(ctx,'weekly');await p.evaluate(()=>{v2State.weekly.availability.fill(30);v2State.weekly.exams=[{id:'audit-exam',name:'Practice exam',date:McatV2Core.addDays(guideDateKey(),-1),minutes:120}];v2Save();renderV2ExamReview('audit-exam');});
  await p.fill('#external-exam-note','I will check the comparison before calculating.');await p.click('#external-review-done');await p.reload({waitUntil:'networkidle'});
  const today=await p.evaluate(()=>v2WeekDays()[0]);assert.ok(today.tasks.some(t=>t.type==='externalReview'&&t.done&&t.minutes===20));assert.ok(today.tasks.reduce((n,t)=>n+t.minutes,0)<=30);
});
}finally{await browser.close();}process.exitCode=failures?1:0;
