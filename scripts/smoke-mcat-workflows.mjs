import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const data = name => JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
const carsData=data('mcat-cars.json'), science=data('mcat-science-passages.json'), notes=data('mcat-experiments.json');
for(const p of science) {
 assert.ok(notes[p.id],p.id);
 for(const field of ['hypothesis','independent','dependent','control','conclusion','limitation']) assert.ok(notes[p.id][field]?.length>20,`${p.id} ${field}`);
 if(notes[p.id].graph) for(const r of p.table.rows) for(const col of [notes[p.id].graph.xColumn,...notes[p.id].graph.series.map(s=>s.column)]) assert.ok(Number.isFinite(Number(r[col])));
}
const base=process.env.CORTEX_URL||'http://127.0.0.1:8805/';
const browser=await chromium.launch({headless:true});
mkdirSync('output/playwright',{recursive:true});
try {
 for(const width of [1280,390,320]) {
  const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"value":0}'}));
  const overflow=async label=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=1,`${width}: ${label} overflow`);
  const plan=async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cs-mcat-plan')));
  const library=async()=>{await page.goto(base+'mcat?gates=prod',{waitUntil:'networkidle'}); await page.click('#back');};
  await page.addInitScript(()=>{if(!localStorage.getItem('cs-mcat-course-v1'))localStorage.setItem('cs-mcat-course-v1',JSON.stringify({mode:'mixed'}));});
  await page.goto(base+'mcat?gates=prod',{waitUntil:'networkidle'});await page.click('#guide-reference-options > summary');await page.click('#begin');await page.waitForSelector('.study-session');
  const target=(await plan()).targetDate;
  for(const n of [15,30,60]) { await page.click(`[data-study-minutes="${n}"]`);const state=await plan(),session=Object.values(state.sessions).at(-1);assert.equal(session.minutes,n);assert.ok(session.tasks.reduce((v,t)=>v+t.minutes,0)<=n);assert.equal(state.targetDate,target);await overflow(`budget ${n}`); }
  await page.click('[data-study-minutes="15"]');
  await page.locator('.study-task').filter({hasText:'Focused recall'}).click();
  assert.ok(Number((await page.locator('.topstat').innerText()).split('/')[1])<=10);
  while(await page.locator('#reveal').count()){await page.click('#reveal');await page.click('.ratebtn.good');}
  await page.click('#guide');assert.equal(await page.locator('.study-task.done').count(),1);
  const completed=Object.keys((await plan()).completed);
  await page.click('[data-study-minutes="60"]');assert.equal(await page.locator('.study-task.done').count(),1);assert.deepEqual(Object.keys((await plan()).completed),completed);
  await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('[data-study-minutes="60"]').getAttribute('aria-pressed'),'true');
  await page.screenshot({path:`output/playwright/mcat-daily-${width}.png`,fullPage:true});
  // CARS first pass -> saved blind review -> first-pass statistics remain immutable.
  await library();await page.click('[data-mcat-tool="2"]');await page.click('[data-t="on"]');await page.locator('#plist .row').first().click();
  const p=carsData[0];
  for(const [i,q] of p.questions.entries()){if(i===0)await page.check('#cars-flag');await page.click(`.opt[data-i="${(q.answer+1)%4}"]`);}
  await page.waitForSelector('#cars-rationale');assert.equal(await page.locator('#cars-timer').count(),0);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cs-mcat-log')||'[]').filter(r=>r.section==='cars').length),0);
  assert.ok(!(await page.locator('body').innerText()).includes(p.questions[0].explanation));
  await page.fill('#cars-rationale','The author supports this interpretation with the selected evidence.');await page.locator('[data-sentence]').first().click();
  await page.reload({waitUntil:'networkidle'});await page.click('.course-nav [data-course-view="today"]');await page.click('#study-next');await page.waitForSelector('#cars-rationale');
  assert.ok((await page.inputValue('#cars-rationale')).includes('selected evidence'));
  assert.equal(await page.locator('.cars-evidence.selected').count(),1);await overflow('CARS review');
  await page.screenshot({path:`output/playwright/mcat-cars-review-${width}.png`,fullPage:true});
  for(const q of p.questions){await page.click(`[data-review-answer="${q.answer}"]`);if(!(await page.locator('.cars-evidence.selected').count()))await page.locator('[data-sentence]').first().click();await page.fill('#cars-rationale','The selected sentence supports the interpretation.');await page.click('#cars-review-next');}
  await page.waitForSelector('.study-score-pair');assert.deepEqual(await page.locator('.study-score-pair strong').allTextContents(),[`0/${p.questions.length}`,`${p.questions.length}/${p.questions.length}`]);
  let log=await page.evaluate(()=>JSON.parse(localStorage.getItem('cs-mcat-log')));assert.equal(log.filter(r=>r.section==='cars'&&r.correct).length,0);
  const carsCount=log.filter(r=>r.section==='cars').length;
  await page.click('#review-passages');await page.getByRole('button',{name:'Open last review',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cs-mcat-log')).filter(r=>r.section==='cars').length),carsCount);
  await overflow('CARS result');
  // Notebook notes and graph draft survive reload. Model content appears only after reveal.
  await library();await page.click('[data-mcat-tool="3"]');await page.locator('#plist .row').first().click();
  for(const q of science[0].questions)await page.click(`.opt[data-i="${q.answer}"]`);
  await page.waitForSelector('[data-experiment]');assert.equal(await page.locator('.study-graph svg').count(),1);
  assert.ok(!(await page.locator('body').innerText()).includes(notes.cp1.limitation));
  for(const input of await page.locator('[data-experiment]').all())await input.fill('A saved interpretation grounded in the passage.');
  await overflow('science notebook');await page.screenshot({path:`output/playwright/mcat-experiment-${width}.png`,fullPage:true});
  await page.reload({waitUntil:'networkidle'});await page.click('.course-nav [data-course-view="today"]');await page.click('#study-next');await page.waitForSelector('[data-experiment]');
  assert.equal(await page.inputValue('[data-experiment="hypothesis"]'),'A saved interpretation grounded in the passage.');
  await page.click('#experiment-reveal');await page.waitForSelector('.experiment-comparison');
  await page.locator('.experiment-comparison summary').filter({hasText:'Supported conclusion'}).click();
  assert.ok((await page.locator('.experiment-comparison').innerText()).includes(notes.cp1.conclusion));
  assert.equal(await page.locator('.experiment-comparison .rev').count(),7);await overflow('science result');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('cs-mcat-log')).length);await page.click('#next');await page.getByRole('button',{name:'Open last review',exact:true}).click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cs-mcat-log')).length),before);
  assert.deepEqual(errors,[]);await ctx.close();console.log(`PASS ${width}px: budgets/completion, blind review, persistence, honest scores, notebook/models, graphs, no overflow/errors`);
 }
 // Controlled test fixtures: old-day carryover, due-check priority and expired/legacy sessions.
 const ctx=await browser.newContext(),page=await ctx.newPage();
 await page.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"value":0}'}));
 await page.goto(base+'mcat',{waitUntil:'networkidle'});await page.click('#guide-reference-options > summary');await page.click('#begin');
 await page.evaluate(()=>{
  const plan=guidePlan();plan.startDate=guideAddDays(guideDateKey(),-6);plan.lastStudyDate=plan.startDate;plan.targetDate=guideAddDays(plan.startDate,119);plan.sessions={};plan.completed={'1:drill':Date.now()-6*DAY};
  const task={...guideDayTasks(plan,1).find(t=>t.type==='flash'),limitCards:2};plan.active=task;saveGuidePlan(plan);
  saveResume('flash',{deck:'all',queue:MCAT.cards.slice(0,2),idx:1,total:2,again:0,done:1,guideTask:task});
 });
 await page.reload({waitUntil:'networkidle'});assert.ok((await page.locator('.study-recovery').innerText()).includes('5 days away'));
 const before=await page.evaluate(()=>guidePlan().targetDate);await page.click('#study-next');assert.equal(await page.locator('.topstat').innerText(),'1 / 2');await page.click('#reveal');await page.click('.ratebtn.good');await page.click('#guide');
 assert.ok(await page.evaluate(()=>guidePlan().completed['1:flash']));assert.ok(await page.evaluate(()=>guidePlan().completed['1:drill']));assert.equal(await page.evaluate(()=>guidePlan().targetDate),before);
 // Timer expiration records every omitted answer and starts review without a new timer.
 await page.evaluate(()=>{guideClearActiveTask();startCars(MCAT.cars[0],true);cars.deadline=Date.now()-1;carsTick();});
 assert.equal(await page.locator('#cars-rationale').count(),1);assert.equal(await page.evaluate(()=>cars.results.filter(r=>r.unanswered).length),carsData[0].questions.length);
 while(await page.locator('#cars-review-skip').count())await page.click('#cars-review-skip');
 assert.equal((await page.locator('.study-score-pair strong').allTextContents())[0],`0/${carsData[0].questions.length}`);
 await page.evaluate(()=>{startPassage(MCAT.sci[0],true);plab.deadline=Date.now()-1;plabTick();});
 assert.equal(await page.locator('[data-experiment="hypothesis"]').count(),1);await page.click('#experiment-skip');
 assert.ok((await page.locator('.score').innerText()).includes('/05'));
 await ctx.close();console.log('PASS recovery, prior-day completion, unchanged target, timeout/unanswered, explicit reflection skip');
} finally {await browser.close();}
