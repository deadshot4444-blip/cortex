/* MCAT workspace: authored foundations and connected local learning records. */
let courseData = null;
let courseState = McatCourseCore.normalize(loadJSON('cs-mcat-course-v1', {}));
const courseStore = McatStorage.watch('cs-mcat-course-v1',()=>courseState);
let courseFilter = 'all';
const COURSE_SECTIONS = {bioBiochem:'Biology & biochemistry',chemPhys:'Chemistry & physics',psychSoc:'Psychology & sociology',cars:'Critical analysis & reasoning'};
async function loadMcatCourse() {
  if (courseData) return;
  try { const r = await fetch('data/mcat-course.json?v=6'); if (r.ok) { const d = await r.json(); if (Array.isArray(d.units) && Array.isArray(d.categories)) courseData = d; if (courseData) { courseData.units.forEach(u=>McatCourseCore.refreshSchedule(courseState,u)); saveCourse(); } } } catch {}
}
let courseSaveFailed = false;
function saveCourse() {
  try { if(!courseStore.save(courseState))return false;courseSaveFailed=false;return true; }
  catch { courseSaveFailed=true; const status=document.querySelector('#course-note-status');if(status)status.textContent='Storage is unavailable. Keep this tab open and copy important notes.';return false; }
}
function courseUnit(id) { return courseData?.units.find(u => u.id === id); }
function courseRecord(id) { return McatCourseCore.record(courseState,id); }
function courseRec() { return courseData && McatCourseCore.recommendation(courseData,courseState,QLOG,nowTs()); }
function courseRoute(view,unit) {
  const url = new URL(location.href); url.pathname = '/mcat'; url.searchParams.set('view',view);
  if (unit) url.searchParams.set('unit',unit); else url.searchParams.delete('unit');
  history.replaceState({},'',url.pathname+url.search+url.hash);
}
function coursePauseTools() {
  if(typeof v2PauseActivity==='function')v2PauseActivity();
  if (cars?.phase === 'attempt' && cars.timerId) studyPausePassage('cars',cars);
  if (plab?.phase === 'attempt' && plab.timerId) studyPausePassage('plab',plab);
  if (sim && simTimerId) { clearInterval(simTimerId); simTimerId = null; saveResume('sim',sim); }
}
function courseGo(view) {
  coursePauseTools(); courseRoute(view);
  if (view === 'today') renderGuide();
  else if (view === 'practice') renderMCAT();
  else if (view === 'progress') renderCourseProgress();
  else renderCourseHome();
}
function mcatWorkspace(root,view) {
  courseRoute(view);
  const nav = el(`<nav class="course-nav" aria-label="MCAT workspace"><span class="course-nav-brand">MCAT<span> / YOUR WORKSPACE</span></span><div>${['today','course','practice','progress'].map(v => `<button data-course-view="${v}" ${v===view?'aria-current="page"':''}>${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</div></nav>`);
  nav.querySelectorAll('[data-course-view]').forEach(b => b.onclick = () => courseGo(b.dataset.courseView));
  root.insertBefore(nav,root.children[1] || null);
  root.classList.add('course-workspace');
  return root;
}
function courseView(main,view='course',unit) {
  const root = el('<div></div>'); root.appendChild(topbar('mcat')); root.appendChild(main);
  mcatWorkspace(root,view); if (unit) courseRoute(view,unit);
  if(courseSaveFailed)main.prepend(el('<p class="course-notice" role="alert">This browser could not save your course work. Keep this tab open and copy important notes before leaving.</p>'));
  studySetView(root);
}
function courseStatus(u) {
  const r=courseRecord(u.id);
  if (r.dueAt && r.dueAt<=nowTs()) return 'Later check due';
  if (r.delayedAt) return `${r.attempts.filter(a=>a.kind==='delayed').length}/3 later checks reviewed`;
  if (r.completedAt) return 'Lesson complete';
  if (r.startedAt) return 'In progress';
  return 'Ready to start';
}
function courseToday(host) {
  if (!courseData) { host.innerHTML='<div class="course-notice"><strong>Course is temporarily unavailable.</strong><p>Your existing study tools and saved work are available. Reload to retry loading lessons.</p></div>'; return; }
  const rec=courseRec(), m=McatCourseCore.metrics(courseData,courseState);
  host.innerHTML=`<section class="course-today"><div><span class="course-eyebrow">YOUR NEXT CHAPTER</span><h2>${rec ? esc(rec.unit.title) : 'Foundations completed.'}</h2><p>${rec ? esc(rec.reason) : 'Keep applying these ideas in passages. Your later checks will appear when due.'}</p><div class="course-actions">${rec ? `<button class="btn btn-solid" data-course-open="${rec.unit.id}" ${rec.kind==='review'?'data-course-revisit="true"':''}>${rec.kind==='delayed'?'Take later check':rec.kind==='resume'?'Continue lesson':rec.kind==='review'?'Revisit lesson':'Open lesson'} →</button>` : '<button class="btn btn-solid" data-course-view="practice">Practice passages →</button>'}<button class="btn" data-course-view="course">Explore the course</button></div></div><div class="course-today-aside"><span class="course-number">${String(m.completed).padStart(2,'0')}<small> / ${m.available}</small></span><span>lessons complete</span><div class="course-mini-track"><i style="width:${m.completed/m.available*100}%"></i></div><button class="ghostbtn" id="course-placement">${courseState.placement.doneAt?'View starting check':'Find my starting point'} ↗</button><small>Optional · 12 questions · no score prediction</small></div></section>`;
  host.querySelector('#course-placement').onclick=renderCoursePlacement;
  host.querySelectorAll('[data-course-view]').forEach(b=>b.onclick=()=>courseGo(b.dataset.courseView));
}
function courseModeMarkup() {
  return `<section class="course-mode"><div><span class="label">Study stage</span><p>Choose what to emphasize. Your target date and saved work stay in place.</p></div><div class="course-mode-options">${[['learn','Learn','Lessons + recall'],['mixed','Apply','Mixed passage practice'],['exam','Rehearse','Timed sections + review']].map(([id,title,desc])=>`<button data-course-mode="${id}" aria-pressed="${courseState.mode===id}"><strong>${title}</strong><small>${desc}</small></button>`).join('')}</div></section>`;
}
function wireCourseModes(main,rerender) {
  main.querySelectorAll('[data-course-mode]').forEach(b=>b.onclick=()=>{courseState.mode=b.dataset.courseMode;saveCourse();const plan=guidePlan();if(plan)studyDailySession(plan,plan.dailyMinutes||30);rerender();});
}
function renderCourseHome() {
  coursePauseTools();
  if (!courseData) {
    const main=el('<main class="course-page"><h1>Course unavailable</h1><p>Lessons could not load. Your saved progress is unchanged.</p><button class="btn" id="course-retry">Retry</button><button class="btn" data-course-view="practice">Open practice</button></main>');
    main.querySelector('#course-retry').onclick=async()=>{await loadMcatCourse();renderCourseHome();};main.querySelector('[data-course-view]').onclick=()=>courseGo('practice');courseView(main);return;
  }
  const m=McatCourseCore.metrics(courseData,courseState),rec=courseRec();
  const main=el(`<main class="course-page"><header class="course-hero"><div><span class="course-eyebrow">CORTEX / MCAT 2.0</span><h1>Understand it.<br><em>Then put it to work.</em></h1><p>A clear path through the science and reasoning behind the test. Read, predict, explore, explain, and apply.</p><div class="course-actions"><button class="btn btn-solid" id="course-continue">${rec?'Continue your course →':'Go to practice →'}</button><button class="btn" id="placement">Find my starting point</button></div></div><div class="course-hero-index"><span>THE CONNECTED COURSE</span><strong>${m.available}<span>lessons</span></strong><div>${courseData.chapters.length} chapters · 04 sections<br>03 interactive science labs<br>${courseData.units.reduce((n,u)=>n+u.questions.length,0)} original checks</div></div></header>
  <div class="course-coverage"><span><b>${m.completed}/${m.available}</b> lessons completed</span><span><b>${m.categories}/34</b> outline areas introduced</span><span>3 fresh follow-up questions per lesson</span></div>
  <p class="course-caption">These lessons introduce selected topics; this is still a growing course. They do not cover every topic within an outline area. Original instructional content with linked sources and guided self-review.</p>
  <div class="course-filters" role="group" aria-label="Course section">${[['all','All sections'],...Object.entries(COURSE_SECTIONS).map(([k])=>[k,SEC_ABBR[k]])].map(([k,n])=>`<button class="btn" data-course-filter="${k}" aria-pressed="${courseFilter===k}">${n}</button>`).join('')}</div>
  <div id="course-units"></div><details class="course-map"><summary>Explore the full content map <span>34 areas · availability shown</span></summary><div>${Object.entries(COURSE_SECTIONS).map(([s,title])=>`<h3>${esc(title)}</h3>${courseData.categories.filter(c=>c.section===s).map(c=>{const us=courseData.units.filter(u=>u.categories.includes(c.id));return `<div class="course-map-row"><span>${c.id}</span><strong>${esc(c.title)}</strong><span>${us.length?`${us.length} foundation ${us.length===1?'lesson':'lessons'}`:'Lessons planned'}</span>${us.map(u=>`<button class="ghostbtn" data-course-open="${u.id}">${esc(u.title)} →</button>`).join('')}</div>`;}).join('')}`).join('')}</div></details>
  <p class="course-caption">Content map aligned to the <a href="${courseData.outlineSource}" target="_blank" rel="noopener">AAMC content outline</a>. Existing practice is available from the Practice tab. This course is not endorsed by the AAMC.</p></main>`);
  for (const chapter of courseData.chapters) {
    const units=courseData.units.filter(u=>u.chapter===chapter.id && (courseFilter==='all'||u.section===courseFilter));
    if(!units.length)continue;
    const section=el(`<section class="course-section"><div class="course-section-heading"><span>${[...new Set(units.map(u=>SEC_ABBR[u.section]))].join(' / ')}</span><h2>${esc(chapter.title)}</h2><small>${units.filter(u=>courseRecord(u.id).completedAt).length}/${units.length} lessons complete</small></div><div class="course-grid">${units.map((u,i)=>`<button class="course-unit" data-course-open="${u.id}"><span class="course-unit-top"><span>LESSON ${String(i+1).padStart(2,'0')} · ${u.categories.join(' / ')}</span>${u.lab?'<span class="course-lab-badge">INTERACTIVE</span>':''}</span><h3>${esc(u.title)}</h3><p>${esc(u.subtitle)}</p><span class="course-unit-bottom"><span>${courseStatus(u)}</span><span>~${u.minutes} min ↗</span></span></button>`).join('')}</div></section>`);
    main.querySelector('#course-units').appendChild(section);
  }
  main.querySelector('#course-continue').onclick=()=>rec?renderCourseUnit(rec.unit.id,rec.kind==='review'?'learn':undefined):courseGo('practice');
  main.querySelector('#placement').onclick=renderCoursePlacement;
  main.querySelectorAll('[data-course-filter]').forEach(b=>b.onclick=()=>{courseFilter=b.dataset.courseFilter;renderCourseHome();});
  courseView(main);
}
function courseStudyTaskDone(r,unitId) {
  const plan=guidePlan(),task=r.guideTask || plan?.sessions?.[guideDateKey()]?.tasks.find(t=>t.type==='course' && t.unitId===unitId && !guideTaskDone(plan,t.day,t.id));
  if(plan && task) {plan.completed ||= {};plan.completed[guideTaskKey(task.day,task.id)] ||= nowTs();if(plan.active?.id===task.id && plan.active?.day===task.day)delete plan.active;studyTouch(plan);}
  delete r.guideTask;
  if(typeof v2CompleteActivity==='function')v2CompleteActivity('course',unitId);
}
function renderCourseUnit(id,requested) {
  const u=courseUnit(id);if(!u)return renderCourseHome();
  coursePauseTools();if(typeof v2BeginActivity==='function')v2BeginActivity('course',id);const r=courseRecord(id);r.startedAt ||= nowTs();
  if (!r.completedAt) courseState.activeUnit=id;
  if (requested) r.stage=requested;
  else if(r.dueAt && r.dueAt<=nowTs()){r.stage='delayed';if(r.feedback!==McatCourseCore.nextDelayed(courseState,u)?.id)delete r.feedback;}
  const stage=r.stage;
  saveCourse();
  const tabs=[['learn','01 · Learn'],['explore','02 · Explore'],['check','03 · Apply'],['record','Learning record']];
  const main=el(`<main class="course-page course-lesson"><button class="backbtn" id="course-back">← Course</button><header class="course-lesson-heading"><span class="course-eyebrow">${SEC_ABBR[u.section]} / ${u.categories.join(' · ')} / ~${u.minutes} MIN</span><h1>${esc(u.title)}</h1><p>${esc(u.subtitle)}</p></header><nav class="course-steps" aria-label="Lesson steps">${tabs.map(([s,n])=>`<button data-course-stage="${s}" ${s===stage?'aria-current="step"':''} ${s==='explore'&&!r.learnedAt || s==='check'&&!r.exploredAt?'disabled':''}>${n}</button>`).join('')}</nav><div class="course-lesson-grid"><section id="course-body"></section><aside class="course-notebook"><span class="label">Your notebook</span><label for="course-notes">Keep the idea in your own words.</label><textarea id="course-notes" rows="8" placeholder="A distinction, a question, or the step you want to remember…">${esc(r.notes)}</textarea><small id="course-note-status" role="status">Notes stay on this device.</small><div class="course-next-links"><span class="label">Builds on</span>${u.prerequisites.length?u.prerequisites.map(p=>`<button class="ghostbtn" data-course-open="${p}">${esc(courseUnit(p)?.title || p)} →</button>`).join(''):'<p>No earlier course unit required.</p>'}<span class="label">Source</span><a href="${u.source.url}" target="_blank" rel="noopener">${esc(u.source.title)} ↗</a>${(u.additionalSources||[]).map(source=>`<a href="${source.url}" target="_blank" rel="noopener">${esc(source.title)} ↗</a>`).join('')}<small>Original lessons and practice questions, with explanations to support your study.</small></div></aside></div></main>`);
  main.querySelector('#course-back').onclick=renderCourseHome;
  main.querySelectorAll('[data-course-stage]').forEach(b=>b.onclick=()=>renderCourseUnit(id,b.dataset.courseStage));
  main.querySelector('#course-notes').oninput=e=>{r.notes=e.target.value;const saved=saveCourse();main.querySelector('#course-note-status').textContent=saved?'Saved on this device.':'Storage is unavailable. Copy this note before leaving.';};
  const body=main.querySelector('#course-body');
  if(stage==='learn') {
    body.innerHTML=`<div class="course-blocks">${u.blocks.map((b,i)=>`<article><span>${String(i+1).padStart(2,'0')}</span><div><h2>${esc(b.title)}</h2><p>${esc(b.text)}</p></div></article>`).join('')}</div><button class="btn btn-solid" id="course-learned">Try the worked example →</button>`;
    body.querySelector('#course-learned').onclick=()=>{r.learnedAt ||=nowTs();if(r.completedAt){r.reviewedAt=nowTs();if(r.guideTask?.courseKind==='review'||typeof v2State!=='undefined'&&v2State.weekly.active?.type==='course'&&v2State.weekly.active.key===id&&v2State.weekly.active.kind==='review')courseStudyTaskDone(r,id);}saveCourse();renderCourseUnit(id,'explore');};
  } else if(stage==='explore' && r.learnedAt) courseExplore(body,u,r);
  else if(stage==='check' && r.exploredAt) { const q=u.questions.find(q=>q.id===r.feedback&&q.kind==='check');q ? courseAnswerFeedback(body,u,r,q,false) : courseCheckpoint(body,u,r,false); }
  else if(stage==='delayed' && (r.feedback && r.attempts.some(a=>a.qId===r.feedback&&a.kind==='delayed') || r.dueAt && r.dueAt<=nowTs() && r.completedAt)) { const q=u.questions.find(q=>q.id===r.feedback&&q.kind==='delayed');q ? courseAnswerFeedback(body,u,r,q,true) : courseCheckpoint(body,u,r,true); }
  else courseLearningRecord(body,u,r);
  if(stage!=='record'){main.dataset.v2Activity='course';main.dataset.v2Key=id;}
  courseView(main,'course',id);
}
function courseExplore(body,u,r) {
  const lab=r.lab;
  body.innerHTML=`<article class="course-explore"><span class="label">Predict before you reveal</span><h2>${u.lab?'Make one change. Explain the result.':'Work through the reasoning.'}</h2><p>${esc(u.prediction)}</p><label for="course-prediction">Your prediction</label><textarea id="course-prediction" rows="3">${esc(lab.prediction||'')}</textarea><button class="btn btn-solid" id="course-reveal" ${lab.shown?'hidden':''} ${lab.prediction?.trim()?'':'disabled'}>Reveal & explore →</button><div id="course-experiment" ${lab.shown?'':'hidden'}></div></article>`;
  const input=body.querySelector('#course-prediction'),button=body.querySelector('#course-reveal');
  input.oninput=()=>{lab.prediction=input.value;saveCourse();button.disabled=!input.value.trim();};
  const reveal=()=>{
    const host=body.querySelector('#course-experiment');host.hidden=false;button.hidden=true;
    host.innerHTML=`${u.lab?'<div id="course-lab"></div>':''}<div class="course-worked"><span class="label">Worked example</span><h3>${esc(u.example.prompt)}</h3><p>${esc(u.example.reasoning)}</p></div><label for="course-reflection">Explain what changed, using the idea from this lesson.</label><textarea id="course-reflection" rows="3">${esc(lab.reflection||'')}</textarea><p class="course-caption">Compare your explanation with the worked reasoning. Your writing is saved for self-review.</p><button class="btn btn-solid" id="course-explored" ${lab.reflection?.trim()?'':'disabled'}>Continue to application →</button>`;
    if(u.lab) courseLab(host.querySelector('#course-lab'),u,r);
    host.querySelector('#course-reflection').oninput=e=>{lab.reflection=e.target.value;saveCourse();host.querySelector('#course-explored').disabled=!e.target.value.trim();};
    host.querySelector('#course-explored').onclick=()=>{r.exploredAt ||=nowTs();saveCourse();renderCourseUnit(u.id,'check');};
  };
  button.onclick=()=>{lab.shown=true;saveCourse();reveal();};
  if(lab.shown)reveal();
}
function courseCheckpoint(body,u,r,delayed) {
  const qs=u.questions.filter(q=>q.kind===(delayed?'delayed':'check'));
  let q=delayed?McatCourseCore.nextDelayed(courseState,u):(qs.find(q=>!r.attempts.some(a=>a.qId===q.id)) || qs.at(-1));
  if(!q || delayed && (!r.dueAt || r.dueAt>nowTs()))return courseLearningRecord(body,u,r);
  const a=r.attempts.find(a=>a.qId===q.id);
  q=McatCourseCore.questionForRecord(q,a||(r.draft?.qId===q.id?r.draft:null));
  let chosen=r.draft?.qId===q.id?r.draft.chosen:null,conf=r.draft?.qId===q.id?r.draft.confidence:'unsure';
  body.innerHTML=`<section class="course-check"><span class="label">${delayed?'Later application · new question':`Application ${qs.findIndex(x=>x.id===q.id)+1} of ${qs.length}`}</span><h2>${esc(q.stem)}</h2><fieldset class="course-answers"><legend>Choose one answer</legend>${q.options.map((o,i)=>`<label class="${a&&i===q.answer?'course-correct':''}"><input type="radio" name="course-answer" value="${i}" ${a?a.chosen===i?'checked':'':chosen===i?'checked':''} ${a?'disabled':''}><span>${'ABCD'[i]}. ${esc(o)}</span></label>`).join('')}</fieldset>${a?'':`<label for="course-confidence">How sure are you?</label><select id="course-confidence">${Object.entries(CONF).map(([v,n])=>`<option value="${v}" ${conf===v?'selected':''}>${n}</option>`).join('')}</select><button class="btn btn-solid" id="course-submit" ${chosen===null?'disabled':''}>Check answer</button>`}${a?`<div class="course-feedback" role="status"><strong>${a.correct?'Correct':'Review this distinction'}</strong><p>${esc(q.explanation)}</p><small>First answer saved. Reopening this explanation does not add another result.</small></div><button class="btn btn-solid" id="course-check-next">${qs.some(x=>!r.attempts.some(a=>a.qId===x.id))?'Next application →':'Open learning record →'}</button>`:''}</section>`;
  const saveDraft=()=>{r.draft={qId:q.id,chosen,confidence:conf,questionSnapshot:McatCourseCore.snapshot(q)};saveCourse();};
  if(!a)saveDraft();
  body.querySelectorAll('input[name="course-answer"]').forEach(i=>i.onchange=()=>{chosen=Number(i.value);saveDraft();body.querySelector('#course-submit').disabled=false;});
  body.querySelector('#course-confidence')?.addEventListener('change',e=>{conf=e.target.value;saveDraft();});
  body.querySelector('#course-submit')?.addEventListener('click',()=>{
    const result=McatCourseCore.answer(courseState,u,q,chosen,conf,nowTs());if(!result)return;delete r.draft;
    if(delayed || McatCourseCore.complete(courseState,u,nowTs()))courseStudyTaskDone(r,u.id);
    r.stage=delayed?'delayed':'check';saveCourse();
    // Keep the just-answered question visible before moving to the next one.
    courseAnswerFeedback(body,u,r,q,delayed);
  });
  body.querySelector('#course-check-next')?.addEventListener('click',()=>renderCourseUnit(u.id,qs.some(x=>!r.attempts.some(a=>a.qId===x.id))?(delayed?'delayed':'check'):'record'));
}
function courseAnswerFeedback(body,u,r,q,delayed) {
  const a=r.attempts.find(a=>a.qId===q.id);if(!a)return renderCourseUnit(u.id,'record');
  q=McatCourseCore.questionForRecord(q,a);
  r.feedback=q.id;saveCourse();
  body.innerHTML=`<section class="course-check"><span class="label">${delayed?'Later application':'Application feedback'}</span><h2>${esc(q.stem)}</h2><div class="course-feedback" role="status"><strong>${a.correct?'Correct':'Review this distinction'}</strong><p>Your answer: ${esc(q.options[a.chosen])}</p><p><b>Answer:</b> ${esc(q.options[q.answer])}</p><p>${esc(q.explanation)}</p></div><div class="course-actions"><button class="btn btn-solid" id="course-check-next">Continue →</button>${!a.correct?`<button class="btn" data-v2-diagnose="${u.id}">Find the sticking point →</button>`:''}</div></section>`;
  body.querySelector('#course-check-next').onclick=()=>{delete r.feedback;saveCourse();const pending=u.questions.some(x=>x.kind==='check'&&!r.attempts.some(a=>a.qId===x.id));renderCourseUnit(u.id,pending?'check':'record');};
}
function courseLearningRecord(body,u,r) {
  const mapped=QLOG.filter(x=>u.questionIds.includes(x.qId)),missed=mapped.filter(x=>!x.correct);
  const cards=u.cards.map(id=>MCAT.cards.find(c=>c.id===id)).filter(Boolean);
  const passages=u.section==='cars'?MCAT.cars.slice(0,3):MCAT.sci.filter(p=>u.passages.includes(p.id));
  const due=r.dueAt && r.dueAt<=nowTs();
  body.innerHTML=`<section class="course-record"><span class="label">One connected learning record</span><h2>${courseStatus(u)}</h2><p>${r.completedAt?'You worked through the lesson and its two applications. Completion records the work; accuracy is shown separately.':'Finish the lesson, reflection, and applications to schedule a new question for later.'}</p>${r.dueAt?`<div class="course-notice"><strong>${due?'Your later check is ready.':'A new application returns later.'}</strong><p>${due?'Try a different question before rereading the lesson.':`Available ${new Date(r.dueAt).toLocaleString()}. The next fresh question is spaced from your previous work.`}</p>${due?'<button class="btn btn-solid" id="course-later">Take later check →</button>':''}</div>`:''}
  <div class="course-record-stats"><div><strong>${r.attempts.filter(a=>a.kind==='check'&&a.correct).length}/${r.attempts.filter(a=>a.kind==='check').length}</strong><span>First application answers</span></div><div><strong>${r.attempts.filter(a=>a.kind==='delayed'&&a.correct).length}/${r.attempts.filter(a=>a.kind==='delayed').length}</strong><span>Later answers · ${r.attempts.filter(a=>a.kind==='delayed').length}/3 reviewed</span></div></div>
  ${r.attempts.length?`<details class="course-map"><summary>Review saved answers</summary>${r.attempts.map(a=>{const q=McatCourseCore.questionForRecord(u.questions.find(q=>q.id===a.qId),a);return q?`<article class="course-saved-answer"><span class="label">${a.kind==='delayed'?'Later application':'First application'} · ${a.correct?'Correct':'Missed'} · ${esc(CONF[a.confidence]||'Unsure')}</span><h3>${esc(q.stem)}</h3><p>You: ${esc(q.options[a.chosen])}</p><p>Answer: ${esc(q.options[q.answer])}</p><p>${esc(q.explanation)}</p></article>`:'';}).join('')}</details>`:''}
  <h3>Apply this in practice</h3>${loadResume('flash') || loadResume(u.section==='cars'?'cars':'plab')?'<p>A saved card or passage session will resume first. Related practice stays available here.</p>':''}<p>${mapped.length} related practice answers saved, including ${missed.length} misses. Repeated attempts may be included.</p><div class="course-related-actions">${cards.length?`<button class="btn" id="course-cards">Review ${cards.length} related cards</button>`:''}${passages.map(p=>`<button class="btn" data-course-passage="${p.id}">${esc(p.title)} →</button>`).join('')}${u.repairs.map(id=>`<button class="btn" data-course-repair="${id}">Short concept repair →</button>`).join('')}</div>
  ${r.lab.prediction?`<details class="course-map"><summary>Your prediction & explanation</summary><div class="course-saved-answer"><h3>Prediction</h3><p>${esc(r.lab.prediction)}</p><h3>Explanation</h3><p>${esc(r.lab.reflection||'No explanation saved yet.')}</p></div></details>`:''}<div class="course-actions"><button class="btn" id="course-today">Return to Today</button><button class="btn" id="course-focus">Make this my focus</button></div></section>`;
  body.querySelector('#course-later')?.addEventListener('click',()=>{delete r.feedback;renderCourseUnit(u.id,'delayed');});
  body.querySelector('#course-today').onclick=()=>courseGo('today');
  body.querySelector('#course-focus').onclick=()=>{courseState.preferredUnit=u.id;saveCourse();renderCourseUnit(u.id,r.completedAt?'learn':r.stage);};
  body.querySelector('#course-cards')?.addEventListener('click',()=>{
    const saved=loadResume('flash');if(saved){RESUME_SPECS.find(s=>s.key==='flash').resume(saved);return;}
    guideClearActiveTask();flash={deck:u.section,queue:cards,idx:0,total:cards.length,again:0,done:0};renderFlashCard();
  });
  body.querySelectorAll('[data-course-passage]').forEach(b=>b.onclick=()=>{guideClearActiveTask();const p=passages.find(p=>p.id===b.dataset.coursePassage);u.section==='cars'?startCars(p,false):startPassage(p,false);});
  body.querySelectorAll('[data-course-repair]').forEach(b=>b.onclick=()=>{const c=repairConcept(b.dataset.courseRepair);if(!repairState.active)McatRepairCore.begin(c,repairState,'repair',nowTs());saveMcatRepair();renderRepairSession();});
}
function courseRelatedLinks(qId) {
  const units=courseData?.units.filter(u=>u.questionIds.includes(qId)||u.passages.some(id=>MCAT.sci.find(p=>p.id===id)?.questions.some(q=>q.id===qId))) || [];
  return units.length?`<div class="course-feedback-links"><span>Revisit the idea</span>${units.map(u=>`<button class="ghostbtn" data-course-open="${u.id}">${esc(u.title)} →</button>`).join('')}</div>`:'';
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-course-open]');if(b){e.preventDefault();renderCourseUnit(b.dataset.courseOpen,b.dataset.courseRevisit?'learn':undefined);}});
function courseLab(host,u,r) {
  const v=r.lab.values ||= {};
  const slider=(key,label,min,max,step,initial)=>{if(!Number.isFinite(v[key]))v[key]=initial;return `<label class="course-slider" for="lab-${key}"><span>${label}<output id="out-${key}">${v[key]}</output></span><input id="lab-${key}" data-lab-value="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${v[key]}"></label>`;};
  let controls='';
  if(u.lab==='enzyme')controls=slider('substrate','Substrate [S] · mM',0,20,.5,2)+slider('alpha','Competitive factor α',1,5,.5,1);
  if(u.lab==='buffer')controls=slider('acid','Added strong acid · mol',0,.15,.01,0);
  if(u.lab==='circuit')controls=slider('voltage','Ideal source · V',1,24,1,12)+slider('r1','Resistor 1 · Ω',1,12,1,6)+slider('r2','Resistor 2 · Ω',1,12,1,3)+`<label for="lab-connection">Connection</label><select id="lab-connection"><option value="series" ${v.connection!=='parallel'?'selected':''}>Series</option><option value="parallel" ${v.connection==='parallel'?'selected':''}>Parallel</option></select>`;
  host.innerHTML=`<div class="course-lab-controls">${controls}</div><div class="course-lab-visual" id="lab-visual"></div><div class="course-lab-reading" id="lab-reading" aria-live="polite"></div>`;
  const draw=()=>{
    const visual=host.querySelector('#lab-visual'),reading=host.querySelector('#lab-reading');
    if(u.lab==='enzyme'){
      const rate=(s,a)=>100*s/(2*a+s),path=a=>Array.from({length:81},(_,i)=>{const s=i/4;return `${i?'L':'M'}${45+s*16.5},${210-rate(s,a)*1.7}`;}).join(' ');
      visual.innerHTML=`<svg viewBox="0 0 420 260" role="img" aria-label="Rate versus substrate. Gray is baseline, blue includes competitive inhibition. The curve approaches Vmax 100; higher alpha shifts it right."><path d="M45 30V210H380" fill="none" stroke="currentColor"/><path d="M45 40H380" stroke="#8992a0" stroke-dasharray="5 5"/><text x="50" y="28">Vmax = 100</text><text x="25" y="215">0</text><text x="26" y="128">50</text><text x="12" y="175" transform="rotate(-90 12 175)">Rate (units/min)</text><text x="160" y="252">Substrate [S] · mM</text><text x="366" y="229">20</text><path d="${path(1)}" fill="none" stroke="#8992a0" stroke-width="3"/><path d="${path(v.alpha)}" fill="none" stroke="#315be8" stroke-width="3"/><circle cx="${45+v.substrate*16.5}" cy="${210-rate(v.substrate,v.alpha)*1.7}" r="5" fill="#315be8"/></svg>`;
      reading.innerHTML=`<strong>${rate(v.substrate,v.alpha).toFixed(1)} <small>units/min</small></strong><p>v = 100 × ${v.substrate} / (${(2*v.alpha).toFixed(1)} + ${v.substrate})</p><p>Apparent Km: ${(2*v.alpha).toFixed(1)} mM · Vmax: 100 units/min. Gray = no inhibitor; blue = chosen competitive factor.</p><small>Ideal Michaelis–Menten model. α = 1 + [I]/Ki; it represents competition, not inhibitor concentration directly.</small>`;
    } else if(u.lab==='buffer'){
      const base=.2-v.acid,acid=.2+v.acid,ph=4.8+Math.log10(base/acid);
      visual.innerHTML=`<svg viewBox="0 0 420 185" role="img" aria-label="After neutralization, conjugate base ${base.toFixed(2)} moles and weak acid ${acid.toFixed(2)} moles."><text x="20" y="25">AFTER NEUTRALIZATION</text><rect x="20" y="50" width="${base/.4*380}" height="52" rx="4" fill="#315be8"/><rect x="${20+base/.4*380}" y="50" width="${acid/.4*380}" height="52" rx="4" fill="#c9d3ee"/><text x="20" y="132">A−: ${base.toFixed(2)} mol</text><text x="230" y="132">HA: ${acid.toFixed(2)} mol</text><text x="20" y="165">A− + H+ → HA</text></svg>`;
      reading.innerHTML=`<strong>${ph.toFixed(2)} <small>pH</small></strong><p>4.80 + log10(${base.toFixed(2)} / ${acid.toFixed(2)})</p><small>Starts with 0.20 mol of each partner. Ideal weak-acid buffer at fixed pKa 4.80; both components remain throughout this slider range. No activity or dilution correction.</small>`;
    } else {
      const parallel=v.connection==='parallel',req=parallel?1/(1/v.r1+1/v.r2):v.r1+v.r2,current=v.voltage/req;
      const wire=parallel?'M50 90H150V45H350V90H390V155H50V90M150 90V115H350V90':'M50 90H390V155H50V90';
      visual.innerHTML=`<svg viewBox="0 0 440 200" role="img" aria-label="Two ideal resistors connected in ${parallel?'parallel':'series'} to a ${v.voltage} volt source."><path d="${wire}" fill="none" stroke="#8992a0" stroke-width="3"/><circle cx="50" cy="125" r="19" fill="white" stroke="#315be8" stroke-width="3"/><text x="43" y="132">+</text>${parallel?`<rect x="215" y="32" width="70" height="26" fill="#e9eeff" stroke="#315be8"/><rect x="215" y="102" width="70" height="26" fill="#e9eeff" stroke="#315be8"/><text x="228" y="21">${v.r1} Ω</text><text x="225" y="95">${v.r2} Ω</text>`:`<rect x="140" y="77" width="70" height="26" fill="#e9eeff" stroke="#315be8"/><rect x="270" y="77" width="70" height="26" fill="#e9eeff" stroke="#315be8"/><text x="155" y="63">${v.r1} Ω</text><text x="285" y="63">${v.r2} Ω</text>`}<text x="35" y="186">${v.voltage} V</text></svg>`;
      reading.innerHTML=`<strong>${current.toFixed(2)} <small>A total</small></strong><p>R<sub>eq</sub> = ${req.toFixed(2)} Ω · I = ${v.voltage} / ${req.toFixed(2)}</p><p>${parallel?`Branch currents: ${(v.voltage/v.r1).toFixed(2)} A + ${(v.voltage/v.r2).toFixed(2)} A.`:`The same ${current.toFixed(2)} A passes through both resistors.`}</p><small>Ideal constant-voltage source, ideal wires, and ohmic resistors.</small>`;
    }
  };
  host.querySelectorAll('[data-lab-value]').forEach(input=>input.oninput=()=>{v[input.dataset.labValue]=Number(input.value);host.querySelector('#out-'+input.dataset.labValue).value=input.value;saveCourse();draw();});
  host.querySelector('#lab-connection')?.addEventListener('change',e=>{v.connection=e.target.value;saveCourse();draw();});draw();
}
function renderCoursePlacement() {
  if(!courseData)return renderCourseHome();coursePauseTools();
  const placementUnits=courseData.units.filter(u=>u.placementEligible!==false);
  const p=courseState.placement,unanswered=placementUnits.find(u=>!p.answers[u.id]);
  const main=el(`<main class="course-page course-placement"><span class="course-eyebrow">OPTIONAL / STARTING CHECK</span><h1>Find a useful first step.</h1><p>Twelve short questions sample these foundation topics. Skip anything you prefer. This guides a starting recommendation; it cannot estimate your MCAT score or assess the entire outline.</p><details class="course-map" ${p.startedAt?'':'open'}><summary>Your coursework background</summary><div class="course-background">${Object.entries(COURSE_SECTIONS).map(([s,n])=>`<label for="background-${s}">${n}<select id="background-${s}" data-course-background="${s}">${[['unknown','Prefer not to say'],['new','New to this'],['some','Some coursework'],['comfortable','Comfortable with the basics']].map(([v,n])=>`<option value="${v}" ${p.background[s]===v?'selected':''}>${n}</option>`).join('')}</select></label>`).join('')}</div></details><div id="placement-body"></div><button class="backbtn" id="placement-back">← Back to course</button></main>`);
  main.querySelectorAll('[data-course-background]').forEach(s=>s.onchange=()=>{p.background[s.dataset.courseBackground]=s.value;saveCourse();});
  main.querySelector('#placement-back').onclick=renderCourseHome;
  const body=main.querySelector('#placement-body');
  if(!p.startedAt){body.innerHTML='<button class="btn btn-solid" id="placement-start">Start the 12-question check →</button>';body.querySelector('#placement-start').onclick=()=>{p.startedAt=nowTs();saveCourse();renderCoursePlacement();};}
  else if(unanswered){
    const u=unanswered,q=McatCourseCore.questionForRecord(u.questions[0],p.draft?.unitId===u.id?p.draft:null);let chosen=p.draft?.unitId===u.id?p.draft.chosen:null,confidence=p.draft?.unitId===u.id?p.draft.confidence:'unsure';
    body.innerHTML=`<section class="course-check"><span class="label">${Object.keys(p.answers).length+1} / 12 · ${SEC_ABBR[u.section]}</span><h2>${esc(q.stem)}</h2><fieldset class="course-answers"><legend>Choose one answer, or skip</legend>${q.options.map((o,i)=>`<label><input type="radio" name="placement-answer" value="${i}" ${chosen===i?'checked':''}><span>${esc(o)}</span></label>`).join('')}</fieldset><label for="placement-confidence">How sure are you?</label><select id="placement-confidence">${Object.entries(CONF).map(([v,n])=>`<option value="${v}" ${confidence===v?'selected':''}>${n}</option>`).join('')}</select><div class="course-actions"><button class="btn btn-solid" id="placement-next" ${chosen===null?'disabled':''}>Save & continue →</button><button class="btn" id="placement-skip">Skip this question</button></div></section>`;
    const draft=()=>{p.draft={unitId:u.id,chosen,confidence,questionSnapshot:McatCourseCore.snapshot(q)};saveCourse();};
    draft();
    body.querySelectorAll('[name="placement-answer"]').forEach(i=>i.onchange=()=>{chosen=Number(i.value);draft();body.querySelector('#placement-next').disabled=false;});
    body.querySelector('#placement-confidence').onchange=e=>{confidence=e.target.value;draft();};
    const advance=skip=>{p.answers[u.id]={qId:q.id,chosen:skip?null:chosen,correct:skip?null:chosen===q.answer,confidence,ts:nowTs(),questionSnapshot:McatCourseCore.snapshot(q)};delete p.draft;if(Object.keys(p.answers).length===placementUnits.length)p.doneAt=nowTs();saveCourse();renderCoursePlacement();};
    body.querySelector('#placement-next').onclick=()=>advance(false);body.querySelector('#placement-skip').onclick=()=>advance(true);
  } else {
    const answers=Object.values(p.answers),taken=answers.filter(a=>a.chosen!==null),rec=courseRec();
    body.innerHTML=`<div class="course-notice"><h2>Your starting check is saved.</h2><p>${taken.filter(a=>a.correct).length}/${taken.length} answered correctly · ${answers.length-taken.length} skipped. Skipped questions are excluded from accuracy.</p>${rec?`<h3>Suggested next: ${esc(rec.unit.title)}</h3><p>${esc(rec.reason)}</p><button class="btn btn-solid" data-course-open="${rec.unit.id}">Open lesson →</button>`:'<p>All available foundation lessons are complete. Continue with passage practice.</p>'}</div><h2>Review your starting answers</h2>${placementUnits.map(u=>{const a=p.answers[u.id],q=McatCourseCore.questionForRecord(u.questions[0],a);return `<details class="course-map"><summary>${esc(u.title)} <span>${a.chosen===null?'Skipped':a.correct?'Correct':'Revisit'}</span></summary><div class="course-saved-answer"><h3>${esc(q.stem)}</h3><p>You: ${a.chosen===null?'Skipped':esc(q.options[a.chosen])}</p><p>Answer: ${esc(q.options[q.answer])}</p><p>${esc(q.explanation)}</p><button class="btn" data-course-focus="${u.id}">Choose this as my starting unit</button></div></details>`;}).join('')}`;
    body.querySelectorAll('[data-course-focus]').forEach(b=>b.onclick=()=>{courseState.preferredUnit=b.dataset.courseFocus;saveCourse();renderCourseUnit(b.dataset.courseFocus);});
  }
  courseView(main,'course','starting-check');
}
function courseExamReports() { return loadJSON('cs-mcat-exam-reviews',[]); }
let courseExamSaveFailed=false;
function courseArchiveExam(run) {
  if(run.archived)return;
  run.attemptId ||=studyAttemptId();run.finishedAt ||=nowTs();
  const reports=courseExamReports().filter(r=>r.attemptId!==run.attemptId);
  const copy={attemptId:run.attemptId,finishedAt:run.finishedAt,archived:true,queue:run.queue.map(s=>({key:s.key})),results:run.results.map(r=>({...r,items:r.items.map(it=>({q:it.q,passageId:it.passageId}))}))};
  reports.unshift(copy);
  try{localStorage.setItem('cs-mcat-exam-reviews',JSON.stringify(reports.slice(0,8)));courseExamSaveFailed=false;}catch{courseExamSaveFailed=true;}
}
function courseOpenExam(id) {
  const run=courseExamReports().find(r=>r.attemptId===id);if(!run)return renderCourseProgress();
  coursePauseTools();sim=run;finishSim();
}
function courseExamReviewControls(main,run) {
  const section=el(`<section class="course-notice"><strong>${run.results.length}/${run.queue.length} sections completed</strong>${courseExamSaveFailed?'<p role="alert">This browser could not save the exam archive. Keep this tab open and copy important results before leaving.</p>':''}<p>Save a takeaway after reviewing the answers. This does not change your original score.</p><label for="exam-reflection">What will you change in the next session?</label><textarea id="exam-reflection" rows="3">${esc(courseState.examReviews[run.attemptId]?.note||'')}</textarea><button class="btn" id="exam-reviewed" ${courseState.examReviews[run.attemptId]?.note?.trim()?'':'disabled'}>${courseState.examReviews[run.attemptId]?.reviewedAt?'Review saved':'Mark review complete'}</button><small id="exam-review-status" role="status"></small></section>`);
  const input=section.querySelector('textarea'),button=section.querySelector('#exam-reviewed');
  input.oninput=()=>{courseState.examReviews[run.attemptId] ||= {};courseState.examReviews[run.attemptId].note=input.value;saveCourse();button.disabled=!input.value.trim();};
  button.onclick=()=>{courseState.examReviews[run.attemptId].reviewedAt ||=nowTs();saveCourse();const plan=guidePlan();if(plan?.active?.type==='examReview' && plan.active.examId===run.attemptId)guideCompleteActiveTask('examReview');button.textContent='Review saved';section.querySelector('#exam-review-status').textContent='Saved to Progress.';};
  main.querySelector('.drill-review')?.before(section);
}
function renderCourseProgress() {
  coursePauseTools();if(!courseData)return renderCourseHome();
  const m=McatCourseCore.metrics(courseData,courseState),reports=courseExamReports(),ratio=x=>x.total?`${Math.round(100*x.correct/x.total)}%`:'—';
  const main=el(`<main class="course-page"><header class="course-progress-heading"><span class="course-eyebrow">YOUR LEARNING RECORD</span><h1>See what is changing.</h1><p>Track the work, the answers, and the pace separately. Everything here comes from activity saved on this device.</p></header><div class="course-metrics"><article><span>Content work</span><strong>${m.completed}<small>/${m.available}</small></strong><p>Foundation lessons complete. ${m.categories}/34 outline areas introduced by available lessons.</p></article><article><span>First application accuracy</span><strong>${ratio(m.first)}</strong><p>${m.first.correct}/${m.first.total} first answers to lesson applications. Reopening feedback adds no attempts.</p></article><article><span>Delayed recall</span><strong>${ratio(m.delayed)}</strong><p>${m.delayed.correct}/${m.delayed.total} new application questions answered after at least 24 hours.</p></article><article><span>Timed pacing</span><strong>${reports.length?reports.length:'—'}<small>${reports.length?' runs':''}</small></strong><p>Active time and raw accuracy by section below. No scaled score prediction.</p></article></div>${courseModeMarkup()}<section class="course-progress-section"><h2>Learning by section</h2>${Object.entries(COURSE_SECTIONS).map(([s,n])=>{const us=courseData.units.filter(u=>u.section===s),complete=us.filter(u=>courseRecord(u.id).completedAt).length;return `<div class="course-section-progress"><div><strong>${n}</strong><span>${complete}/${us.length} lessons</span></div><progress value="${complete}" max="${us.length}" aria-label="${n} lessons completed"></progress><div>${us.map(u=>`<button class="ghostbtn" data-course-open="${u.id}">${esc(u.title)} · ${courseStatus(u)}</button>`).join('')}</div></div>`;}).join('')}</section><section class="course-progress-section"><h2>Timed runs & review</h2><p>Original practice sets keep each passage together. Set length and time vary with the available bank; they are not official full-length exams. The most recent eight runs are saved.</p><div id="course-exam-history">${reports.length?reports.map(run=>`<article class="course-exam-record"><div><h3>${new Date(run.finishedAt).toLocaleDateString()} · ${run.results.length}/${run.queue.length} sections</h3><span>${courseState.examReviews[run.attemptId]?.reviewedAt?'Review complete':'Review pending'}</span></div>${run.results.map(r=>`<p><b>${SEC_ABBR[r.key]}</b> · ${r.correct}/${r.total} correct · ${Number.isFinite(r.elapsedMs)?`${(r.elapsedMs/60000).toFixed(1)} active min · ${(r.elapsedMs/1000/r.total).toFixed(0)} sec / presented question`:'Timing unavailable for this older run'}</p>`).join('')}<button class="btn" data-course-exam="${run.attemptId}">Open answers & review →</button></article>`).join(''):'<div class="course-notice">Your first timed run will appear here with its answer review.</div>'}</div></section><section class="course-progress-section"><h2>Practice evidence</h2><p>${QLOG.length} retained practice answers · ${Object.keys(SRS).filter(id=>SRS[id]?.last).length} cards encountered. Practice history retains the latest 1,000 answers and can include repeats. It is separate from the lesson metrics above.</p><div id="course-repair-evidence"></div></section></main>`);
  wireCourseModes(main,renderCourseProgress);
  main.querySelectorAll('[data-course-exam]').forEach(b=>b.onclick=()=>courseOpenExam(b.dataset.courseExam));
  mountRepairDashboard(main.querySelector('#course-repair-evidence'));
  if(typeof v2Progress==='function')v2Progress(main);
  courseView(main,'progress');
}

window.pauseMcatTools = coursePauseTools;
