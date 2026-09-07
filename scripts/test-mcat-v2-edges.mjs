import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true}),base=process.env.CORTEX_URL||'http://127.0.0.1:8805/';
try{
const ctx=await browser.newContext({viewport:{width:390,height:844}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"value":0}'}));const open=async view=>page.goto(base+'mcat?gates=prod&view='+view,{waitUntil:'networkidle'});
await open('weekly');
// A completed course review task closes without rescoring old answers.
await page.evaluate(()=>{const id='protein-structure',r=courseRecord(id);r.completedAt=Date.now()-10;r.learnedAt=Date.now()-20;r.exploredAt=Date.now()-15;r.stage='record';v2State.weekly.active={id:'course:'+id,type:'course',key:id,kind:'review',day:guideDateKey(),minutes:15};v2Save();saveCourse();renderCourseUnit(id,'learn');});await page.click('#course-learned');assert.ok(await page.evaluate(()=>Object.values(v2State.weekly.done).some(t=>t.kind==='review')));assert.equal(await page.evaluate(()=>courseRecord('protein-structure').attempts.length),0);
// Study timing stops when navigating outside a learning tool and never includes an offline gap.
await open('math');await page.click('[data-math-skill="units"]');assert.ok(await page.evaluate(()=>v2Clock?.type==='math'));await page.evaluate(()=>{v2Clock.last=Date.now()-60*60000;v2Tick();});assert.equal(await page.evaluate(()=>v2State.activityTime['math:units']||0),0);await page.evaluate(()=>courseGo('today'));assert.equal(await page.evaluate(()=>v2Clock),null);
// CARS investigation uses CARS skills, never an unrelated calculation.
await open('diagnose');await page.selectOption('#diagnostic-unit','cars-main-idea');await page.click('#diagnostic-start');assert.deepEqual(await page.evaluate(()=>v2State.diagnostics.active.probes.map(p=>p.domain)),['reading','argument','transfer']);
// A legacy passage answer marks a coached item as repeated, even before this coach was used.
await page.evaluate(()=>{QHIST['h2-1']={n:1};saveQ();});await open('coach');await page.click('[data-coach-start="coach-h2"]');await page.click('#coach-begin');assert.ok(await page.evaluate(()=>v2State.coach.active.prior.includes('h2-1')));
// Future results and unscored values are rejected by the concrete results form.
await open('weekly');await page.click('#week-exam-add');await page.fill('#planned-exam-name','Future result');await page.fill('#planned-exam-date','2099-01-01');await page.selectOption('#planned-exam-source','official');await page.fill('[data-planned-score="chemPhys"]','125');await page.locator('#planned-exam-form .btn-solid').click();assert.ok((await page.locator('#planned-exam-error').innerText()).includes('before today'));assert.equal(await page.evaluate(()=>v2State.weekly.exams.length),0);
// Support-data failures preserve ordinary practice; Retry loads v2 when the source recovers.
await page.route('**/data/mcat-v2.json*',r=>r.fulfill({status:503,body:'unavailable'}));await open('coach');assert.equal(await page.locator('#v2-retry').count(),1);await page.unroute('**/data/mcat-v2.json*');await page.click('#v2-retry');await page.waitForSelector('#coach-resume');
// Failed storage is visible on the newly mounted view, not only on the previous page.
await page.evaluate(()=>{Object.defineProperty(localStorage,'setItem',{configurable:true,value:function(){throw new DOMException('Quota exceeded','QuotaExceededError');}});v2Go('weekly');});assert.ok((await page.locator('#v2-save-status').innerText()).includes('Storage unavailable'));
assert.deepEqual(errors,[]);console.log('PASS review completion, timing pause and offline gap, CARS-specific probes, prior exposure, invalid future scores, missing data retry, and storage failure visibility');await ctx.close();
}finally{await browser.close();}
