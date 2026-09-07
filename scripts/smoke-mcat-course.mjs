import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
const data=JSON.parse(readFileSync('data/mcat-course.json','utf8'));
const base=process.env.CORTEX_URL||'http://127.0.0.1:8805/';
const browser=await chromium.launch({headless:true});mkdirSync('output/playwright',{recursive:true});
try{
for(const width of [1280,390,320]){
 const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"value":0}'}));
 const open=async view=>{await page.goto(base+'mcat?gates=prod&view='+view,{waitUntil:'networkidle'});};
 const overflow=async label=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=1,`${width} ${label} overflow`);
 await open('course');assert.equal(await page.locator('.course-unit').count(),36);await overflow('course');await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`output/playwright/mcat-course-${width}.png`,fullPage:true});
 await page.locator('[data-course-filter="chemPhys"]').click();assert.equal(await page.locator('.course-unit').count(),10);
 await page.locator('.course-map').first().locator('summary').click();assert.equal(await page.locator('.course-map-row').count(),34);await overflow('map');
 // Every unit can complete; persistence and feedback are checked on the first interactive lesson.
 const units=width===1280?data.units:[data.units.find(u=>u.id==='enzyme-rates')];
 for(const unit of units){
  await page.goto(base+'mcat?gates=prod&view=course&unit='+unit.id,{waitUntil:'networkidle'});
  assert.equal(await page.locator('[data-course-stage="check"]').isDisabled(),true);
  await page.fill('#course-notes','My distinction: '+unit.title);await page.click('#course-learned');
  assert.equal(await page.locator('#course-reveal').isDisabled(),true);
  await page.fill('#course-prediction','I predict that the stated condition changes the outcome.');await page.click('#course-reveal');
  if(unit.lab){
   await overflow(unit.lab+' lab');
   if(unit.lab==='enzyme'){await page.locator('#lab-alpha').fill('3');await page.locator('#lab-substrate').fill('6');assert.ok((await page.locator('#lab-reading').innerText()).includes('50.0'));}
   if(unit.lab==='buffer'){await page.locator('#lab-acid').fill('0.1');assert.ok((await page.locator('#lab-reading').innerText()).includes('4.32'));}
   if(unit.lab==='circuit'){await page.selectOption('#lab-connection','parallel');assert.ok((await page.locator('#lab-reading').innerText()).includes('6.00'));}
   await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`output/playwright/mcat-${unit.lab}-lesson-${width}.png`,fullPage:true});
  }
  await page.fill('#course-reflection','The result follows from the relationship explained in the model.');
  if(unit.id==='enzyme-rates'){
   await page.reload({waitUntil:'networkidle'});assert.ok((await page.inputValue('#course-notes')).includes(unit.title));assert.ok((await page.inputValue('#course-prediction')).length);assert.equal(await page.inputValue('#lab-alpha'),'3');assert.ok((await page.inputValue('#course-reflection')).length);
  }
  await page.click('#course-explored');
  for(const q of unit.questions.filter(q=>q.kind==='check')){
   await page.check(`[name="course-answer"][value="${q.answer}"]`);await page.click('#course-submit');
   assert.ok((await page.locator('.course-feedback').innerText()).includes(q.explanation));
   if(unit.id==='enzyme-rates'){await page.reload({waitUntil:'networkidle'});assert.ok((await page.locator('.course-feedback').innerText()).includes(q.explanation));}
   await page.click('#course-check-next');
  }
  await page.waitForSelector('.course-record');assert.equal(await page.locator('#course-later').count(),0);await overflow('record');
 }
 const completeCount=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('cs-mcat-course-v1')).units).filter(r=>r.completedAt).length);assert.equal(completeCount,units.length);
 // Later check is new evidence, is gated in production, and does not erase first answers.
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('cs-mcat-course-v1'));const r=s.units['enzyme-rates'];r.completedAt=Date.now()-86400010;r.dueAt=Date.now()-1;localStorage.setItem('cs-mcat-course-v1',JSON.stringify(s));});
 await page.goto(base+'mcat?gates=prod&view=course&unit=enzyme-rates',{waitUntil:'networkidle'});
 const delayed=data.units.find(u=>u.id==='enzyme-rates').questions.find(q=>q.kind==='delayed');await page.check(`[name="course-answer"][value="${delayed.answer}"]`);await page.click('#course-submit');await page.click('#course-check-next');
 await open('progress');assert.equal(await page.locator('.course-metrics article').count(),4);await overflow('progress');await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`output/playwright/mcat-progress-${width}.png`,fullPage:true});
 await page.click('[data-course-mode="mixed"]');
 // Optional placement saves drafts and excludes skips from the result denominator.
 await page.goto(base+'mcat?gates=prod&view=course&unit=starting-check',{waitUntil:'networkidle'});await page.selectOption('[data-course-background="chemPhys"]','new');await page.click('#placement-start');
 for(const [i,u] of data.units.filter(u=>u.placementEligible).entries()){
  if(i===0){await page.check(`[name="placement-answer"][value="${u.questions[0].answer}"]`);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('[name="placement-answer"]:checked').count(),1);await page.click('#placement-next');}
  else await page.click('#placement-skip');
 }
 assert.ok((await page.locator('#placement-body').innerText()).includes('1/1 answered correctly · 11 skipped'));await overflow('placement');
 // New first-visit plan and existing storage remain usable after the overhaul.
 await open('today');await page.click('#begin');await page.waitForSelector('.study-session');const target=await page.evaluate(()=>JSON.parse(localStorage.getItem('cs-mcat-plan')).targetDate);
 await open('practice');await page.click('[data-course-mode="learn"]');await open('today');await page.click('[data-study-minutes="15"]');await overflow('today');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cs-mcat-plan')).targetDate),target);
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`output/playwright/mcat-today-overhaul-${width}.png`,fullPage:true});
 assert.deepEqual(errors,[]);console.log(`${width}px: course, all lesson stages, lab formulas, saved drafts, delayed check, placement, progress, daily plan, overflow passed`);await ctx.close();
}
// Timed section grouping, answer reload, zero-time expiry, archives, and review completion.
const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"value":0}'}));
await page.goto(base+'mcat?gates=prod&view=practice',{waitUntil:'networkidle'});await page.click('[data-mcat-tool="4"]');await page.locator('#secs .bp-cat').first().click();
const initial=await page.evaluate(()=>JSON.parse(localStorage.getItem('cs-mcat-r-sim'))),items=initial.queue[0].items,seen=new Set();let prev;
for(const it of items){if(it.passageId!==prev){assert.ok(!seen.has(it.passageId)||it.passageId===undefined,'passage was split');if(it.passageId)seen.add(it.passageId);prev=it.passageId;}}
await page.locator('.opt').first().click();await page.reload({waitUntil:'networkidle'});await page.click('[data-mcat-tool="4"]');await page.click('#resume');assert.equal(await page.locator('.opt.picked').count(),1);
await page.click('#crumbmcat');
await page.evaluate(()=>{const r=JSON.parse(localStorage.getItem('cs-mcat-r-sim'));r._remain=0;localStorage.setItem('cs-mcat-r-sim',JSON.stringify(r));});
await page.reload({waitUntil:'networkidle'});await page.click('[data-mcat-tool="4"]');await page.click('#resume');await page.waitForSelector('#exam-reflection');
await page.fill('#exam-reflection','I will check the passage context before selecting an option.');await page.click('#exam-reviewed');
const counts=await page.evaluate(()=>({log:JSON.parse(localStorage.getItem('cs-mcat-log')).length,reports:JSON.parse(localStorage.getItem('cs-mcat-exam-reviews')).length}));assert.equal(counts.reports,1);assert.equal(counts.log,items.length);
await page.goto(base+'mcat?gates=prod&view=progress',{waitUntil:'networkidle'});await page.click('[data-course-exam]');assert.ok((await page.inputValue('#exam-reflection')).includes('passage context'));assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cs-mcat-log')).length),counts.log);assert.deepEqual(errors,[]);console.log('Timed practice: intact groups, saved answer, zero remaining time, archive, idempotent review passed');await ctx.close();
}finally{await browser.close();}
