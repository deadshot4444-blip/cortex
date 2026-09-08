import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true}),base=process.env.CORTEX_URL||'http://127.0.0.1:8805/';
const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"value":0}'}));
try{
 await page.goto(base+'mcat?gates=prod',{waitUntil:'networkidle'});await page.click('#guide-reference-options > summary');await page.click('#begin');await page.click('[data-study-minutes="15"]');
 let session=await page.evaluate(()=>studyDailySession(guidePlan()));assert.equal(session.tasks[0].type,'course');assert.equal(session.tasks[0].minutes,12);
 await page.click('#study-next');await page.fill('#course-notes','Saved lesson plan association.');
 const unit=await page.evaluate(()=>courseData.units[0]);await page.click('#course-learned');await page.fill('#course-prediction','Folding can alter activity.');await page.click('#course-reveal');assert.equal(await page.locator('#course-reveal').isVisible(),false);await page.fill('#course-reflection','The sequence can remain intact while the fold changes.');await page.click('#course-explored');
 for(const q of unit.questions.filter(q=>q.kind==='check')){await page.check(`[name="course-answer"][value="${q.answer}"]`);await page.click('#course-submit');await page.click('#course-check-next');}
 await page.click('#course-today');assert.equal(await page.locator('.study-task.done').count(),1);
 // A new miss after completion opens a review without inflating prior learning evidence.
 await page.evaluate(()=>{QLOG.push({qId:courseData.units[0].questionIds[0],correct:false,ts:Date.now()});saveQ();renderGuide();});
 await page.click('#course-today [data-course-revisit]');await page.waitForSelector('#course-learned');await page.click('#course-learned');
 assert.equal(await page.evaluate(()=>courseRecord(courseData.units[0].id).attempts.length),2);assert.ok(await page.evaluate(()=>courseRecord(courseData.units[0].id).reviewedAt));
 await page.click('[aria-controls="course-study-menu"]');await page.click('.course-nav [data-course-view="today"]');
 // A due course check invalidates the cached daily recommendation.
 await page.evaluate(()=>{const p=guidePlan();p.sessions={};p.completed={};saveGuidePlan(p);const r=courseRecord('protein-structure');r.completedAt=Date.now()-86400001;r.dueAt=Date.now()-1;saveCourse();renderGuide();});
 session=await page.evaluate(()=>studyDailySession(guidePlan()));assert.ok(session.tasks.some(t=>t.type==='course'&&t.unitId==='protein-structure'));
 // A mapped passage miss recommends its underlying lesson even though old tags vary.
 const rec=await page.evaluate(()=>{const state=McatCourseCore.normalize({});const p=MCAT.sci.find(p=>p.id==='cp2');return McatCourseCore.recommendation(courseData,state,[{qId:p.questions[0].id,correct:false,ts:Date.now()}],Date.now()).unit.id;});assert.equal(rec,'buffer-balance');
 // Navigation repeatedly visits Course without consuming a paused passage timer.
 await page.evaluate(()=>{guideClearActiveTask();startCars(MCAT.cars[0],true);});await page.click('#crumbmcat');
 const remain=await page.evaluate(()=>loadResume('cars')._remain);
 await page.evaluate(()=>{cars.deadline-=30000;courseGo('course');courseGo('progress');courseGo('today');});
 assert.equal(await page.evaluate(()=>loadResume('cars')._remain),remain);
 // Explicitly selecting Rehearse keeps a valid bounded CARS set in a 60-minute plan.
 const examPlan=await page.evaluate(()=>{cars=null;clearResume('cars');courseState.activeUnit=null;courseState.mode='exam';courseRecord('protein-structure').dueAt=null;saveCourse();const p=guidePlan();p.sessions={};p.completed={};delete p.active;saveGuidePlan(p);return studyBuildSession(p,60);});assert.ok(examPlan.tasks.some(t=>t.type==='exam'&&t.section==='cars'));assert.ok(examPlan.tasks.reduce((n,t)=>n+t.minutes,0)<=60);
 // A course data failure must leave preexisting practice and records accessible.
 await page.route('**/data/mcat-course.json*',r=>r.fulfill({status:503,body:'unavailable'}));
 await page.evaluate(()=>{courseState.activeUnit='enzyme-rates';saveCourse();});
 await page.goto(base+'mcat?gates=prod&view=today',{waitUntil:'networkidle'});assert.ok((await page.locator('#course-today').innerText()).includes('temporarily unavailable'));
 await page.click('.course-nav [data-course-view="practice"]');await page.waitForSelector('#mcat-core-tools');assert.equal(await page.locator('#mcat-core-tools [data-mcat-tool]').count(),5);
 await page.click('.course-nav [data-course-view="course"]');await page.unroute('**/data/mcat-course.json*');await page.click('#course-retry');await page.waitForSelector('.course-unit');assert.equal(await page.locator('.course-unit').count(),36);
 // A quota error must be visible rather than claiming a successful save.
 await page.locator('.course-unit').first().click();await page.evaluate(()=>{Object.defineProperty(localStorage,'setItem',{configurable:true,value:function(){throw new DOMException('Quota exceeded','QuotaExceededError');}});});await page.fill('#course-notes','A note that cannot persist.');assert.ok((await page.locator('#course-note-status').innerText()).includes('Storage is unavailable'));
 assert.deepEqual(errors,[]);console.log('PASS course plan completion, due cache, mapped passage recommendation, paused timers, bounded Rehearse plan, failed data recovery, storage error feedback');
}finally{await browser.close();}
