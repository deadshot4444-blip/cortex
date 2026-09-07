/* Daily sessions and passage reflection. All progress stays on this device. */
let experimentNotes = null;
async function loadExperimentNotes() {
  if (experimentNotes) return;
  try {
    const response = await fetch('data/mcat-experiments.json?v=2');
    if (response.ok) experimentNotes = await response.json();
  } catch { /* The notebook remains usable without model notes. */ }
}

function studyDayGap(from, to = guideDateKey()) {
  const utc = key => { const d = guideDateFromKey(key); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
  return Math.max(0, Math.round((utc(to) - utc(from)) / DAY));
}
function studyLastDay(plan) {
  const times = [plan.lastStudyDate || plan.startDate];
  Object.values(plan.completed || {}).filter(Number.isFinite).forEach(ts => times.push(guideDateKey(new Date(ts))));
  const activity = [...Object.values(courseState.units).flatMap(r => [r.startedAt,r.completedAt,...(r.attempts || []).map(a => a.ts)]), ...QLOG.map(x => x.ts), ...Object.values(SRS).map(x => x.last), ...Object.values(repairState?.records || {}).map(x => x.reviewedAt)].filter(Number.isFinite);
  if (activity.length) times.push(guideDateKey(new Date(Math.max(...activity))));
  return times.sort().at(-1);
}
function studyTouch(plan) { plan.lastStudyDate = guideDateKey(); saveGuidePlan(plan); }
function studyCompletedActivities(plan) {
  const completed=new Map();
  for(const session of Object.values(plan?.sessions||{}))for(const task of session.tasks||[]) {
    const id=guideTaskKey(task.day,task.id),ts=plan.completed?.[id];
    if(!Number.isFinite(ts))continue;
    completed.set(id,{id:`daily:${id}`,type:task.type,key:task.unitId||task.conceptId||task.id,
      title:task.type==='course'?task.desc:task.title,minutes:task.minutes,ts,
      day:guideDateKey(new Date(ts)),kind:task.courseKind||'lesson',reason:'Completed in your daily session.'});
  }
  return [...completed.values()];
}
function studyRestoreGuide(r) {
  const plan = guidePlan();
  if (plan && r.guideTask && !guideTaskDone(plan, r.guideTask.day, r.guideTask.id)) {
    plan.active = r.guideTask; studyTouch(plan);
  }
}
function studySavedTask(plan) {
  if (plan.active && !guideTaskDone(plan, plan.active.day, plan.active.id)) {
    const a = plan.active;
    const spec = guideResumeSpec(a.type);
    if ((spec && loadResume(spec.key)) || (a.type === 'repair' && repairState?.active) || (a.type === 'course' && courseUnit(a.unitId)) || (a.type === 'examReview' && courseExamReports().some(r => r.attemptId === a.examId))) {
      const original = a.title ? a : guideDayTasks(plan, a.day).find(t => t.id === a.id);
      if (original) return { ...original, resume: true, minutes: original.minutes || ({flash:10,drill:15,cars:20,passage:25,exam:65,repair:5}[a.type]) };
    }
  }
  if(repairState?.active && repairState.active.phase!=='done') {
    const active=repairState.active,concept=repairConcept(active.conceptId);
    if(concept)return {...(active.guideTask||{}),id:active.guideTask?.id||`flex-${guideDateKey()}-repair`,day:active.guideTask?.day||guidePlanDay(plan),
      type:'repair',conceptId:concept.id,title:'Continue your concept session',desc:concept.title,minutes:5,resume:true};
  }
  const best = findHubResume();
  if (!best && courseUnit(courseState.activeUnit) && !courseRecord(courseState.activeUnit).completedAt) { const unit=courseUnit(courseState.activeUnit),record=courseRecord(unit.id);return {...(record.guideTask || {}),id:record.guideTask?.id || `flex-${guideDateKey()}-course`,day:record.guideTask?.day || guidePlanDay(plan),type:'course',unitId:unit.id,title:'Continue your lesson',desc:unit.title,minutes:12,resume:true}; }
  if (!best) return null;
  const type = {flash:'flash',drill:'drill',cars:'cars',plab:'passage',sim:'exam'}[best.spec.key];
  return { ...(best.r.guideTask || {}), id: best.r.guideTask?.id || `flex-${guideDateKey()}-resume-${type}`,
    day: best.r.guideTask?.day || guidePlanDay(plan), type, resume: true, resumeKey: best.spec.key,
    title: `Resume ${best.spec.mod}`, desc: 'Your unfinished session is saved, including its review.',
    minutes: {flash:10,drill:15,cars:20,passage:25,exam:65}[type] };
}
function studyBuildSession(plan, minutes, previous) {
  const date = guideDateKey(), day = guidePlanDay(plan);
  const gap = studyDayGap(studyLastDay(plan));
  const recoveryDays = previous?.recoveryDays || Math.max(0, gap - 1);
  const focus = guideFocusCategory(plan, recoveryDays ? Math.max(1, day - gap) : day);
  const taper = guidePhase(plan,day) === 'Taper';
  // Completed work survives a budget change and continues to use its original identity.
  const tasks = (previous?.tasks || []).filter(t => guideTaskDone(plan, t.day, t.id));
  let remaining = (taper ? Math.min(15,minutes) : minutes) - tasks.reduce((n, t) => n + t.minutes, 0);
  const add = t => {
    if (tasks.some(x => x.id === t.id && x.day === t.day)) return;
    tasks.push(t); remaining -= t.minutes;
  };
  const saved = studySavedTask(plan);
  if (saved && !tasks.some(t => t.type === saved.type)) add(saved);
  const base = type => ({ id:`flex-${date}-${type}`, day, type, category:focus?.id || null, section:focus?.section || 'bioBiochem' });
  const examReview = courseState.mode === 'exam' && courseExamReports().find(r => !courseState.examReviews[r.attemptId]?.reviewedAt);
  if (!taper && courseState.mode === 'exam' && !examReview && remaining >= 51 && !tasks.some(t => t.type === 'exam')) add({...base('exam'),minutes:51,title:'Rehearse a timed CARS set',desc:'Up to 30 questions in whole passage sets, followed by a saved review.',section:'cars'});
  const rec = repairData && repairState?.active?.phase !== 'done' && McatRepairCore.recommend(repairData.concepts, repairState, QLOG, nowTs());
  if (rec && remaining >= (courseState.mode === 'learn' && courseRec() && !taper ? 17 : 5) && !tasks.some(t => t.type === 'repair')) add({ ...base('repair'), minutes:5,
    title:rec.kind === 'later' ? 'Due concept check' : 'Five-minute concept repair', desc:rec.concept.title,
    conceptId:rec.concept.id, repairKind:rec.kind });
  const courseNext = courseRec();
  if (!taper && examReview && remaining >= 10 && !tasks.some(t => t.type === 'examReview')) add({...base('examReview'),minutes:10,title:'Review your timed run',desc:'Revisit answers and save one change for next time.',examId:examReview.attemptId});
  if (!taper && courseNext && remaining >= (['delayed','review'].includes(courseNext.kind) ? 5 : 12) && !tasks.some(t => t.type === 'course') && (courseState.mode === 'learn' || ['delayed','review'].includes(courseNext.kind))) add({...base('course'),minutes:['delayed','review'].includes(courseNext.kind)?5:12,courseKind:courseNext.kind,title:courseNext.kind === 'delayed'?'Later application check':courseNext.kind === 'review'?'Revisit a foundation':'Learn one foundation',desc:courseNext.unit.title,unitId:courseNext.unit.id});
  // Reserve time for a complete passage at 30/60 minutes; a short session keeps recall manageable.
  const cardMinutes = Math.min(remaining, minutes === 15 ? 10 : minutes === 30 ? 5 : 10);
  if (cardMinutes >= 5 && !tasks.some(t => t.type === 'flash') && MCAT.cards.length) add({ ...base('flash'),
    title:dueCount() ? 'Due cards first' : 'Focused recall', desc:'A small card set. Due cards take priority over new cards.',
    minutes:cardMinutes, limitCards:cardMinutes, limitDue:cardMinutes, newCards:taper ? 0 : Math.min(3,cardMinutes) });
  const passageTypes = day % 2 ? ['cars','passage'] : ['passage','cars'];
  for (const type of taper ? [] : passageTypes) {
    const cost = type === 'cars' ? 20 : 25;
    if (remaining >= cost && !tasks.some(t => t.type === type) && (type === 'cars' ? MCAT.cars.length : MCAT.sci.length))
      add({ ...base(type), title:type === 'cars' ? 'CARS + blind review' : 'Science + experiment notebook',
        desc:type === 'cars' ? 'Answer, revisit your reasoning, then see the key.' : 'Work the data, map the experiment, then compare explanations.', minutes:cost });
  }
  if (remaining >= 4 && !tasks.some(t => t.type === 'drill') && MCAT.questions.length) {
    const questions = Math.min(8,Math.floor(remaining/2));
    add({ ...base('drill'), title:'Focused question practice', desc:focus ? `${focus.id} · ${focus.title}` : 'Practice and review a few questions.', minutes:questions*2, questions });
  }
  return { courseVersion:2,mode:courseState.mode,date, minutes, recoveryDays, tasks, createdAt:previous?.createdAt || nowTs() };
}
function studyDailySession(plan, minutes) {
  plan.sessions ||= {};
  const today = guideDateKey();
  const old = plan.sessions[today];
  // An outage must not rebuild an existing assignment as an empty/completed day.
  const unavailable=task=>task.type==='course'?!courseUnit(task.unitId):task.type==='repair'?!repairData:
    task.type==='flash'?!MCAT.cards.length:task.type==='drill'?!MCAT.questions.length:
    task.type==='cars'?!MCAT.cars.length:task.type==='passage'?!MCAT.sci.length:
    task.type==='exam'?!MCAT.questions.length||!MCAT.cars.length||!MCAT.sci.length:false;
  if(old?.tasks.some(task=>!guideTaskDone(plan,task.day,task.id)&&unavailable(task)))return old;
  const saved = studySavedTask(plan);
  const first = old?.tasks.find(t => !guideTaskDone(plan,t.day,t.id));
  const rec = repairData && McatRepairCore.recommend(repairData.concepts,repairState,QLOG,nowTs());
  const courseDue = courseRec();
  const courseDueChanged = !saved && courseDue?.kind === 'delayed' && !old?.tasks.some(t => t.type === 'course' && t.unitId === courseDue.unit.id && !guideTaskDone(plan,t.day,t.id));
  const dueChanged = !saved && rec?.kind === 'later' && !rec.resume && !old?.tasks.some(t => t.type === 'repair' && t.conceptId === rec.concept.id && t.repairKind === 'later');
  if (!old || old.courseVersion !== 2 || old.mode !== courseState.mode || minutes || dueChanged || courseDueChanged || (saved && (first?.id !== saved.id || first?.day !== saved.day))) {
    plan.sessions[today] = studyBuildSession(plan, minutes || plan.dailyMinutes || 30, old);
    plan.dailyMinutes = minutes || plan.dailyMinutes || 30;
    saveGuidePlan(plan);
  }
  return plan.sessions[today];
}
function studyLaunchTask(task, plan) {
  if (task.type === 'course') { const record=courseRecord(task.unitId);record.guideTask=task;plan.active=task;studyTouch(plan);saveCourse();renderCourseUnit(task.unitId,task.courseKind==='review'?'learn':undefined);return; }
  if (task.type === 'examReview') { plan.active=task;studyTouch(plan);courseOpenExam(task.examId);return; }
  if (task.type === 'repair') {
    const concept = repairConcept(task.conceptId || repairState?.active?.conceptId);
    if (!concept) return renderRepairHub();
    if (!repairState.active) McatRepairCore.begin(concept, repairState, task.repairKind || 'repair', nowTs());
    repairState.active.guideTask = task;
    plan.active = task; studyTouch(plan); saveMcatRepair(); renderRepairSession(); return;
  }
  const spec = guideResumeSpec(task.type), saved = spec && loadResume(spec.key);
  // Never overwrite an unfinished tool session to start a fresh assignment of the same type.
  if (saved && (task.resume || spec.progressOf(saved) > 0 || saved.guideTask)) {
    plan.active = saved.guideTask || task; saved.guideTask = plan.active; studyTouch(plan);
    spec.resume(saved); return;
  }
  guideStartTask(task, plan);
}
function studyCompleteRepair(active) {
  const plan = guidePlan(), task = active?.guideTask;
  if (!plan || !task) return;
  plan.completed ||= {};
  plan.completed[guideTaskKey(task.day,task.id)] ||= nowTs();
  if (plan.active?.id === task.id && plan.active?.day === task.day) delete plan.active;
  studyTouch(plan);
}
function mountDailySession(host, plan) {
  const session = studyDailySession(plan), tasks = session.tasks;
  const done = tasks.filter(t => guideTaskDone(plan,t.day,t.id));
  const next = tasks.find(t => !guideTaskDone(plan,t.day,t.id));
  const estimate = tasks.reduce((n,t) => n+t.minutes,0);
  const resume = next && (next.resume || (plan.active?.id === next.id && plan.active?.day === next.day));
  host.innerHTML = `<section class="study-session" aria-label="Flexible daily session">
    <div class="study-session-heading"><h2>Your session</h2><span class="study-count">${done.length} of ${tasks.length} complete</span></div>
    ${session.recoveryDays ? `<p class="study-recovery">${session.recoveryDays} ${session.recoveryDays === 1 ? 'day' : 'days'} away. Resume saved work, then take one small next step. Your previous work is still here.</p>` : ''}
    <div class="study-time-picker"><span class="label">Time today</span><div class="study-budgets" role="group" aria-label="Time available today">${[15,30,60].map(n => `<button class="btn" data-study-minutes="${n}" aria-pressed="${session.minutes === n}">${n} min</button>`).join('')}</div></div>
    <div class="study-progress-track" aria-hidden="true"><span style="width:${tasks.length ? done.length/tasks.length*100 : 0}%"></span></div>
    ${next ? `<div class="study-next-step"><span class="label">${resume ? 'Saved work' : 'Up next'} · About ${next.minutes} min</span><h3>${esc(next.title)}</h3><p>${esc(next.desc || '')}</p><button class="btn btn-solid" id="study-next">${resume ? 'Resume session' : done.length ? 'Continue session' : 'Start session'} →</button></div>` : '<div class="study-next-step"><span class="label">All done for today</span><h3>Session complete.</h3><p class="study-complete" role="status">Your work is saved. Your next session will be ready tomorrow.</p></div>'}
    <h3 class="study-list-heading">Today’s checklist</h3>
    <div class="study-task-list">${tasks.map((t,i) => { const complete = guideTaskDone(plan,t.day,t.id); return `<button class="study-task ${complete ? 'done' : ''}" data-study-task="${i}" ${complete ? 'disabled' : ''}><span class="study-task-index">${complete ? '✓' : String(i+1).padStart(2,'0')}</span><span><strong>${esc(t.title)}</strong><small>${esc(t.desc || '')}${t.resume ? ' · Saved session' : ''}</small></span><span class="study-task-time">~${t.minutes}m</span></button>`; }).join('')}</div>
    <p class="study-budget-note">About ${estimate} minutes total, including review. ${estimate > session.minutes ? 'Your saved or completed work exceeds this budget; pause at any point.' : 'Pause whenever you need to.'}${plan.targetDate ? ` Target: <strong>${guideFormatDate(plan.targetDate)}</strong>.` : ''}</p>
    <p class="repair-fine">${plan.flexible ? 'Changing your time adjusts this session. Build a weekly plan below when you want to set availability or a test date.' : 'Changing your time adjusts this session. Your target date stays the same; full content coverage is not guaranteed.'}</p>
  </section>`;
  host.querySelectorAll('[data-study-minutes]').forEach(b => b.onclick = () => { studyDailySession(guidePlan(),Number(b.dataset.studyMinutes)); renderGuide(); });
  host.querySelectorAll('[data-study-task]').forEach(b => b.onclick = () => studyLaunchTask(tasks[Number(b.dataset.studyTask)],guidePlan()));
  host.querySelector('#study-next')?.addEventListener('click',() => studyLaunchTask(next,guidePlan()));
}

/* Passage attempt IDs keep first-pass statistics idempotent across reloads. */
function studyAttemptId() { return `${Date.now()}-${Math.random().toString(36).slice(2,10)}`; }
function studyFinishAttempt(run) {
  if (run.timerId) clearInterval(run.timerId);
  run.timerId = null; run.attemptId ||= studyAttemptId();
  run.attemptEndedAt ||= nowTs();
  run.p.questions.forEach((q,i) => { if (!run.results[i]) run.results[i] = {q,chosen:null,correct:false,conf:run.confidence?.[q.id] || 'unsure',flagged:!!run.flags?.[q.id],unanswered:true}; });
}
function studyLogAttempt(run, kind) {
  const t = run.attemptEndedAt || nowTs();
  let added=false;
  run.results.forEach(r => {
    if (QLOG.some(x => x.attemptId === run.attemptId && x.qId === r.q.id)) return;
    added=true;
    QLOG.push({ qId:r.q.id, section:kind === 'cars' ? 'cars' : run.p.section, category:kind === 'cars' ? 'CARS-'+r.q.skill.split('-')[1] : r.q.category,
      passage:run.p.id, correct:r.correct, conf:r.conf || 'unsure', unanswered:!!r.unanswered, ts:t, attemptId:run.attemptId });
    const old=QHIST[r.q.id];
    QHIST[r.q.id] = { n:(old?.n || 0)+(old?.lastAttemptId===run.attemptId?0:1), lastAttemptId:run.attemptId, lastCorrect:r.correct, conf:r.conf || 'unsure', ts:t };
  });
  saveQ();
  if (added) {
    if (typeof bumpStreak === 'function') bumpStreak();
    const plan=guidePlan(); if (plan) studyTouch(plan);
  }
}
function studySaveReport(kind, run) {
  const reports = McatStorage.read('cs-mcat-passage-reviews',{});
  const copy = { ...run, passageId:run.p.id, results:run.results.map(r => ({...r,q:r.q.id})) };
  delete copy.p; delete copy.timerId; delete copy.deadline;
  reports[`${kind}:${run.p.id}`] = copy;
  return McatStorage.write('cs-mcat-passage-reviews',reports);
}
function studyReportButton(kind, main) {
  const reports = Object.entries(McatStorage.read('cs-mcat-passage-reviews',{})).filter(([key]) => key.startsWith(kind+':'));
  const report = reports.map(([,v]) => v).sort((a,b) => b.attemptEndedAt-a.attemptEndedAt)[0];
  if (!report) return;
  const p = (kind === 'cars' ? MCAT.cars : MCAT.sci).find(p => p.id === report.passageId);
  if (!p) return;
  const button = el('<button class="btn">Open last review</button>');
  const open = (saved,passage) => {
    const run = { ...saved, p:passage, archived:true, results:saved.results.map(r => ({...r,q:passage.questions.find(q => q.id === r.q)})) };
    if (kind === 'cars') { cars = run; renderCarsReviewResult(); } else { plab = run; finishPassage(); }
  };
  button.onclick=() => open(report,p);
  main.querySelector('.endbtns').prepend(button);
  const history=el('<details class="guide-schedule"><summary><span><strong>Saved passage reviews</strong><small>Your most recent review for each passage</small></span><i>Open</i></summary><div class="rows"></div></details>');
  reports.map(([,r]) => r).sort((a,b) => b.attemptEndedAt-a.attemptEndedAt).forEach(r => {
    const passage=(kind === 'cars' ? MCAT.cars : MCAT.sci).find(p => p.id === r.passageId);
    if (!passage) return;
    const row=el(`<button class="row"><span class="row-main"><span class="row-title">${esc(passage.title)}</span><span class="row-when">${new Date(r.attemptEndedAt).toLocaleDateString()}</span></span><span class="row-right">Review →</span></button>`);
    row.onclick=() => open(r,passage); history.querySelector('.rows').appendChild(row);
  });
  main.appendChild(history);
}
function studySetView(root) {
  if(typeof v2TrackView==='function')v2TrackView(root);
  const footer=siteFooter();
  root.appendChild(footer); setView(root);
}
function studyPausePassage(kind, run) {
  if (run.timerId) clearInterval(run.timerId);
  run.timerId = null; saveResume(kind,run);
}
function resumeCarsSession(r) {
  studyRestoreGuide(r); cars=r; cars.timerId=null;
  if (!cars.phase || cars.phase === 'attempt') {
    if (cars.timed) { cars.deadline=nowTs()+(r._remain ?? 600000); cars.timerId=setInterval(carsTick,500); }
    renderCarsRunner();
  } else if (cars.phase === 'blind') renderCarsBlindReview();
  else renderCarsReviewResult();
}
function resumePassageSession(r) {
  studyRestoreGuide(r); plab=r; plab.timerId=null;
  if (!plab.phase || plab.phase === 'attempt') {
    if (plab.timed) { plab.deadline=nowTs()+(r._remain ?? 600000); plab.timerId=setInterval(plabTick,500); }
    renderPassageRunner();
  } else if (plab.phase === 'analysis') renderExperimentNotebook();
  else finishPassage();
}
function studyWirePassageExit(root,kind,run,fallback) {
  const leave = () => { studyPausePassage(kind,run); guideLeaveActive(kind === 'plab' ? 'passage' : kind,fallback); };
  root.querySelector('#exit').onclick = leave;
  root.querySelector('#crumbmcat').onclick = () => { studyPausePassage(kind,run); renderMCATEntry(); };
}
function studyLockPassageList(kind,main) {
  const saved=loadResume(kind), spec=RESUME_SPECS.find(s => s.key === kind);
  if (!saved || !spec || spec.progressOf(saved) <= 0) return;
  main.querySelectorAll('#plist .row, #rand').forEach(b => { b.disabled=true; });
  main.querySelector('#plist').before(el('<p class="study-instruction">You have a passage in progress. Resume it before starting another; your answers and review notes are saved.</p>'));
}

/* CARS: an answer-key-free second pass with text evidence and a saved rationale. */
function carsSentences(p) {
  return p.text.split(/\n\n+/).map(par => par.match(/[^.!?]+(?:[.!?]+[”"']?|$)/g)?.map(s => s.trim()).filter(Boolean) || [par]);
}
function beginCarsBlindReview() {
  studyFinishAttempt(cars);
  cars.phase = 'blind'; cars.reviews ||= {};
  cars.reviewOrder ||= cars.results.map((r,i) => i).sort((a,b) => Number(cars.results[b].flagged || cars.results[b].conf !== 'sure')-Number(cars.results[a].flagged || cars.results[a].conf !== 'sure'));
  cars.reviewIdx ||= 0;
  saveResume('cars',cars); renderCarsBlindReview();
}
function renderCarsBlindReview() {
  const order = cars.reviewOrder, index = order[cars.reviewIdx];
  if (index == null) { cars.phase='done'; saveResume('cars',cars); renderCarsReviewResult(); return; }
  const r = cars.results[index], q = r.q;
  const draft = cars.reviews[q.id] ||= {chosen:r.chosen,evidence:[],rationale:''};
  let sentenceIndex = 0;
  const passage = carsSentences(cars.p).map(par => `<p>${par.map(sentence => { const i=sentenceIndex++; return `<button class="cars-evidence ${draft.evidence.includes(i) ? 'selected' : ''}" data-sentence="${i}" aria-pressed="${draft.evidence.includes(i)}">${esc(sentence)}</button>`; }).join(' ')}</p>`).join('');
  const root = el(`<div>${mcatTaskHeader(['CARS','Blind review'],`<span class="topstat">${cars.reviewIdx+1}/${order.length}</span>`)}
    <main class="cars-stage study-review-stage"><section class="cars-passage" tabindex="0" aria-label="Passage text: select supporting sentences"><span class="label">${esc(cars.p.title)}</span><p class="study-instruction">Select the sentence or sentences that support your reasoning.</p>${passage}</section>
    <section class="cars-q"><span class="label">Untimed second pass · answers hidden</span><h1 class="study-question-heading">Revisit your reasoning.</h1>
    <p class="repair-fine">Q${index+1} · ${r.flagged ? 'Flagged · ' : ''}${r.unanswered ? 'Unanswered in first pass' : `${cars.timed ? 'Timed' : 'Original'} answer: ${McatV2Core.optionLabel(q,r.chosen)} · ${CONF[r.conf || 'unsure']}`}</p>
    <p class="q">${esc(q.stem)}</p><div class="opts">${McatV2Core.optionOrder(q.options,q.displayOrder).map((i,position) => `<button class="opt ${draft.chosen === i ? 'study-selected' : ''}" data-review-answer="${i}" aria-pressed="${draft.chosen === i}"><span class="key">${'ABCD'[position]}</span><span>${esc(q.options[i])}</span></button>`).join('')}</div>
    <label class="study-field">Why does the text support your answer?<textarea id="cars-rationale" rows="3" maxlength="1800" placeholder="One or two sentences is enough.">${esc(draft.rationale)}</textarea></label>
    <p class="repair-fine" id="cars-evidence-count" role="status">${draft.evidence.length} supporting sentences selected.</p>
    <div class="study-actions"><button class="btn btn-solid" id="cars-review-next">${cars.reviewIdx === order.length-1 ? 'Save review & reveal answers' : 'Save review & continue'} →</button><button class="ghostbtn" id="cars-review-skip">Keep original answer; skip reflection</button></div>
    <p class="repair-fine">Your original score stays unchanged. Reflections are saved for self-review.</p></section></main></div>`);
  const next = root.querySelector('#cars-review-next');
  const update = () => { next.disabled = !Number.isInteger(draft.chosen) || !draft.evidence.length || !draft.rationale.trim(); saveResume('cars',cars); };
  root.querySelectorAll('[data-review-answer]').forEach(b => b.onclick = () => {
    draft.chosen=Number(b.dataset.reviewAnswer);
    root.querySelectorAll('[data-review-answer]').forEach(option => { option.classList.toggle('study-selected',option===b); option.setAttribute('aria-pressed',option===b); });
    update();
  });
  root.querySelectorAll('[data-sentence]').forEach(b => b.onclick = () => {
    const i=Number(b.dataset.sentence); draft.evidence=draft.evidence.includes(i) ? draft.evidence.filter(v => v!==i) : [...draft.evidence,i];
    b.classList.toggle('selected',draft.evidence.includes(i)); b.setAttribute('aria-pressed',draft.evidence.includes(i));
    root.querySelector('#cars-evidence-count').textContent=`${draft.evidence.length} supporting sentences selected.`; update();
  });
  root.querySelector('#cars-rationale').oninput = e => { draft.rationale=e.target.value; update(); };
  next.onclick = () => { draft.reviewed=true; cars.reviewIdx++; saveResume('cars',cars); renderCarsBlindReview(); window.scrollTo(0,0); };
  root.querySelector('#cars-review-skip').onclick = () => { draft.reviewed=false; draft.skipped=true; cars.reviewIdx++; saveResume('cars',cars); renderCarsBlindReview(); window.scrollTo(0,0); };
  studyWirePassageExit(root,'cars',cars,renderCarsHome); update(); studySetView(root);
}
function renderCarsReviewResult() {
  if (!cars.archived) {
    studyLogAttempt(cars,'cars'); cars.guided ||= guideCompleteActiveTask('cars');
    studySaveReport('cars',cars); clearResume('cars');
  }
  const total=cars.p.questions.length, original=cars.results.filter(r => r.correct).length;
  const reviewed=cars.results.filter(r => cars.reviews?.[r.q.id]?.reviewed);
  const revised=cars.results.filter(r => (cars.reviews?.[r.q.id]?.reviewed ? cars.reviews[r.q.id].chosen : r.chosen) === r.q.answer).length;
  const improved=reviewed.filter(r => !r.correct && cars.reviews[r.q.id].chosen === r.q.answer).length;
  const lost=reviewed.filter(r => r.correct && cars.reviews[r.q.id].chosen !== r.q.answer).length;
  const sentences=carsSentences(cars.p).flat();
  const root=el('<div></div>'); root.appendChild(topbar('mcat'));
  const main=el(`<main class="panel study-result"><span class="label">CARS · ${esc(cars.p.title)}</span><h1>What changed on review?</h1>
    <div class="study-score-pair"><div><strong>${original}/${total}</strong><span>${cars.timed ? 'Timed' : 'Original'} first pass</span></div><div><strong>${revised}/${total}</strong><span>After blind review</span></div></div>
    <p>${reviewed.length}/${total} questions reflected on. ${improved} changed to correct; ${lost} changed away from correct. Unanswered first-pass questions count in the original total.</p>
    <p class="repair-fine">Only the first pass enters practice accuracy. A second-pass change does not by itself explain why you missed a question.</p>
    <div class="drill-review">${cars.results.map((r,i) => { const d=cars.reviews?.[r.q.id]; return `<details class="rev"><summary>Q${i+1} · ${SKILL_LABEL[r.q.skill]} · ${r.correct ? 'Correct first pass' : r.unanswered ? 'Unanswered first pass' : 'Missed first pass'}</summary><div class="rev-body"><p>Original: ${r.chosen == null ? 'Unanswered' : McatV2Core.optionLabel(r.q,r.chosen)} · Review: ${d?.reviewed ? McatV2Core.optionLabel(r.q,d.chosen) : 'Skipped'} · Correct: <b>${McatV2Core.optionLabel(r.q,r.q.answer)}</b></p><p>${esc(r.q.stem)}</p>${d?.reviewed ? `<blockquote>${esc(d.rationale)}</blockquote>${d.evidence.map(n => `<p class="study-quote">“${esc(sentences[n] || '')}”</p>`).join('')}` : ''}<p><b>Explanation</b> · ${esc(r.q.explanation)}</p>${courseRelatedLinks(r.q.id)}</div></details>`; }).join('')}</div>
    <div class="endbtns"><button class="btn btn-solid" id="review-plan">Back to my MCAT plan →</button><button class="btn" id="review-passages">Back to passages</button></div></main>`);
  main.querySelector('#review-plan').onclick=renderMCATEntry; main.querySelector('#review-passages').onclick=renderCarsHome;
  root.appendChild(main); studySetView(root); window.scrollTo(0,0);
}

/* Science: write before revealing, then compare with passage-grounded model notes. */
const EXPERIMENT_FIELDS = [
  ['hypothesis','Hypothesis or research question','What relationship or identification is being tested?'],
  ['independent','Independent variable or exposure','What was changed or compared? For observational work, identify the measured exposure.'],
  ['dependent','Dependent variable or measurement','What outcome was measured, and in what units?'],
  ['control','Control or comparison','What makes the comparison useful? If there is no control group, say so.'],
  ['conclusion','Supported conclusion','Use a specific result. Separate what the data show from a proposed mechanism.'],
  ['limitation','Limit or alternative explanation','What cannot be concluded from this design or sample?']
];
function experimentGraph(p) {
  const graph=experimentNotes?.[p.id]?.graph;
  if (!graph) return '';
  const rows=p.table.rows, xs=rows.map(r => Number(r[graph.xColumn]));
  const series=graph.series.map(s => ({...s,ys:rows.map(r => Number(r[s.column]))}));
  const maxX=Math.max(...xs), minX=Math.min(0,...xs), maxY=Math.max(...series.flatMap(s => s.ys))*1.1;
  const x=v => 52+330*(v-minX)/(maxX-minX || 1), y=v => 205-160*v/(maxY || 1);
  const colors=['#0b5cad','#263442'];
  return `<figure class="study-graph"><svg viewBox="0 0 430 265" role="img" aria-label="${esc(graph.description)}"><title>${esc(graph.description)}</title><path d="M52 35V205H390" fill="none" stroke="#677786"/>${[0,.5,1].map(f => `<text x="46" y="${y(maxY*f)+4}" text-anchor="end" font-size="11">${Number((maxY*f).toFixed(1))}</text><path d="M52 ${y(maxY*f)}H390" stroke="#dae2eb"/>`).join('')}${xs.map(v => `<text x="${x(v)}" y="223" text-anchor="middle" font-size="11">${v}</text>`).join('')}${series.map((s,i) => `<path d="${s.ys.map((v,j) => `${j ? 'L' : 'M'}${x(xs[j])},${y(v)}`).join(' ')}" fill="none" stroke="${colors[i]}" stroke-width="2.5" ${i ? 'stroke-dasharray="5 4"' : ''}/>${s.ys.map((v,j) => `<circle cx="${x(xs[j])}" cy="${y(v)}" r="3" fill="${colors[i]}"/>`).join('')}`).join('')}<text x="52" y="18" font-size="12">${esc(graph.yLabel)}</text><text x="220" y="247" text-anchor="middle" font-size="12">${esc(graph.xLabel)}</text></svg><figcaption>${series.map((s,i) => `${i ? 'Dashed' : 'Solid'}: ${esc(s.label)}`).join(' · ')}. Points come directly from the passage table; connecting lines are guides.</figcaption></figure>`;
}
function renderExperimentNotebook() {
  plab.phase='analysis'; plab.analysis ||= {};
  const p=plab.p, model=experimentNotes?.[p.id];
  const root=el(`<div>${mcatTaskHeader(['Science','Experiment notebook'],'<span class="topstat">Untimed</span>')}<main class="cars-stage study-review-stage">
    <section>${passageBody(p.title,p.text,p.table,p.contentNote)}${experimentGraph(p)}</section>
    <section class="cars-q"><span class="label">Before the answer key</span><h1 class="study-question-heading">Map the experiment.</h1><p class="study-instruction">Keep it brief. Your notes save as you write. Use “not applicable” when a variable or control is absent.</p>
    ${EXPERIMENT_FIELDS.map(([id,label,hint]) => `<label class="study-field">${label}<small>${hint}</small><textarea data-experiment="${id}" rows="2" maxlength="1800">${esc(plab.analysis[id] || '')}</textarea></label>`).join('')}
    ${model?.graph ? `<label class="study-field">Read the graph<small>${esc(model.graph.prompt)}</small><textarea data-experiment="graph" rows="3" maxlength="1800">${esc(plab.analysis.graph || '')}</textarea></label>` : ''}
    <div class="study-actions"><button class="btn btn-solid" id="experiment-reveal">Save notebook & reveal answers →</button><button class="ghostbtn" id="experiment-skip">Skip notebook & reveal answers</button></div><p class="repair-fine">This is a reflection workspace. Your writing is not automatically graded.</p></section></main></div>`);
  const next=root.querySelector('#experiment-reveal');
  const save=() => { next.disabled=!EXPERIMENT_FIELDS.every(([id]) => plab.analysis[id]?.trim()) || !!(model?.graph && !plab.analysis.graph?.trim()); saveResume('plab',plab); };
  root.querySelectorAll('[data-experiment]').forEach(input => input.oninput=() => { plab.analysis[input.dataset.experiment]=input.value; save(); });
  next.onclick=() => { plab.analysisSkipped=false; plab.phase='done'; saveResume('plab',plab); finishPassage(); };
  root.querySelector('#experiment-skip').onclick=() => { plab.analysisSkipped=true; plab.phase='done'; saveResume('plab',plab); finishPassage(); };
  root.querySelector('.cars-passage').setAttribute('tabindex','0');
  root.querySelector('.cars-passage').setAttribute('aria-label','Science passage and data table');
  studyWirePassageExit(root,'plab',plab,renderPassageHome); save(); studySetView(root); window.scrollTo(0,0);
}
function experimentComparison(run) {
  const model=experimentNotes?.[run.p.id];
  return `<section class="experiment-comparison"><h2>Your experiment notebook</h2><p class="repair-fine">${run.analysisSkipped ? 'Notebook skipped. Any draft notes are preserved below.' : 'Compare the reasoning, rather than matching exact wording. This notebook has no automated score.'}</p>
    ${EXPERIMENT_FIELDS.map(([id,label]) => `<details class="rev"><summary>${label}</summary><div class="rev-body"><span class="label">Your note</span><p>${esc(run.analysis?.[id] || 'No note saved.')}</p><span class="label">Model note</span><p>${esc(model?.[id] || 'Model notes are unavailable. Recheck this point against the passage and its answer explanations.')}</p></div></details>`).join('')}
    ${model?.graph ? `<details class="rev"><summary>Graph interpretation</summary><div class="rev-body">${experimentGraph(run.p)}<p>${esc(model.graph.prompt)}</p><blockquote>${esc(run.analysis?.graph || 'No note saved.')}</blockquote><p>${esc(model.graph.answer)}</p></div></details>` : ''}
    <p class="repair-fine">Model notes interpret this original practice passage. They are examples for self-review, not an official AAMC answer key.</p></section>`;
}

// Capture time spent on the current question before a reload or full-page navigation.
window.addEventListener('pagehide',() => {
  if (typeof cars !== 'undefined' && cars?.timerId) saveResume('cars',cars);
  if (typeof plab !== 'undefined' && plab?.timerId) saveResume('plab',plab);
});
