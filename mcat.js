/* Rounds — MCAT PRIME: evidence-based MCAT prep
   Core loop (per spec): baseline -> confidence -> learn -> retrieve -> review -> retest
   Methods: spaced repetition + retrieval practice + interleaving + confidence calibration + distractor autopsy */

const MCAT = { outline: null, cards: [], questions: [], cars: [], sci: [], loaded: false };

const SEC_ABBR = { chemPhys: 'C/P', bioBiochem: 'B/B', psychSoc: 'P/S', cars: 'CARS' };
const SIM_SECTIONS = {
  chemPhys: { abbr: 'C/P', min: 95 }, cars: { abbr: 'CARS', min: 90 }, bioBiochem: { abbr: 'B/B', min: 95 }, psychSoc: { abbr: 'P/S', min: 95 },
};
const CONF = { guess: 'Guess', unsure: 'Unsure', sure: 'Sure' };
const ROOT_CAUSES = ['Content gap', 'Misread', 'Data/graph', 'Math/setup', 'Reasoning', 'Careless', 'Guessed'];

/* ---------- storage ---------- */
const SRS = McatStorage.read('cs-mcat-srs', {});      // cardId -> {ease,interval,reps,lapses,due,last}
const QHIST = McatStorage.read('cs-mcat-q', {});      // qId -> {n,lastCorrect,conf,root,ts}
let QLOG = McatStorage.read('cs-mcat-log', []);       // [{qId,section,category,correct,conf,ts}]
McatStorage.watch('cs-mcat-srs',()=>SRS);
McatStorage.watch('cs-mcat-q',()=>QHIST);
McatStorage.watch('cs-mcat-log',()=>QLOG);
function saveSRS() { return McatStorage.write('cs-mcat-srs', SRS); }
function saveQ() { if (QLOG.length > 1000) QLOG.splice(0, QLOG.length - 1000); const historySaved=McatStorage.write('cs-mcat-q', QHIST); const logSaved=McatStorage.write('cs-mcat-log', QLOG); return historySaved && logSaved; }

const DAY = 86400000;
function srsRec(id) { if (!SRS[id]) SRS[id] = { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: 0, last: 0 }; return SRS[id]; }
function schedule(rec, rating) {
  if (rating === 'again') { rec.ease = Math.max(1.3, rec.ease - 0.2); rec.reps = 0; rec.interval = 0; rec.lapses++; rec.due = nowTs() + 60000; }
  else {
    if (rating === 'hard') rec.ease = Math.max(1.3, rec.ease - 0.15);
    if (rating === 'easy') rec.ease = rec.ease + 0.15;
    let i;
    if (rec.reps === 0) i = rating === 'easy' ? 3 : 1;
    else if (rec.reps === 1) i = rating === 'hard' ? 3 : rating === 'easy' ? 6 : 3;
    else i = rec.interval * (rating === 'hard' ? 1.2 : rating === 'easy' ? rec.ease * 1.3 : rec.ease);
    rec.interval = Math.max(1, Math.round(i)); rec.reps++; rec.due = nowTs() + rec.interval * DAY;
  }
  rec.last = nowTs(); return rec;
}
function nowTs() { return Date.now(); }
function dueCount() { const t = nowTs(); return MCAT.cards.filter(c => SRS[c.id] && SRS[c.id].due <= t && SRS[c.id].reps > 0).length; }
function newCount() { return MCAT.cards.filter(c => !SRS[c.id] || SRS[c.id].reps === 0).length; }

/* ---------- data ---------- */
async function loadMCAT() {
  await Promise.all([loadMcatRepairs(), loadExperimentNotes(), loadMcatCourse(), loadMcatV2()]);
  if (MCAT.loaded) return;
  await Promise.all(MCAT_DATA.map(async([key,file])=>{
    if(mcatDataPresent(key))return;
    try{const response=await fetch(file);if(!response.ok)return;const data=await response.json();
      if(key==='outline'?Array.isArray(data?.concepts)&&data.concepts.length>0:Array.isArray(data)&&data.length>0)MCAT[key]=data;
    }catch{ /* The workspace offers retry without replacing saved work. */ }
  }));
  MCAT.loaded=MCAT_DATA.every(([key])=>mcatDataPresent(key));
}
const MCAT_DATA=[['outline','data/mcat-outline.json','content map'],['cards','data/mcat-cards.json','flashcards'],['questions','data/mcat-questions.json','question drills'],['cars','data/mcat-cars.json?v=3','CARS passages'],['sci','data/mcat-science-passages.json?v=2','science passages']];
function mcatDataPresent(key){return key==='outline'?Array.isArray(MCAT.outline?.concepts)&&MCAT.outline.concepts.length>0:Array.isArray(MCAT[key])&&MCAT[key].length>0;}
function mcatDataNotice(main){
  const missing=MCAT_DATA.filter(([key])=>!mcatDataPresent(key)).map(([, ,label])=>label);
  if(!courseData)missing.push('course lessons');if(!v2Data)missing.push('coaching tools');if(!repairData)missing.push('concept sessions');
  if(!missing.length)return;
  const notice=el(`<aside class="course-notice" role="status"><strong>Some study material could not load.</strong><p>Unavailable: ${esc(missing.join(', '))}. Your saved progress is unchanged. Loaded activities remain available.</p><button class="btn" id="mcat-data-retry">Retry loading study material</button></aside>`);
  notice.querySelector('button').onclick=async e=>{e.currentTarget.disabled=true;e.currentTarget.textContent='Loading…';await loadMCAT();renderMCATEntry();};
  main.prepend(notice);
}

/* ---------- hub ---------- */
/* ---------- resume: persist in-progress sessions to localStorage ---------- */
function saveResume(key, obj) {
  try {
    if (!obj) return;
    const o = Object.assign({}, obj);
    const type = {flash:'flash',drill:'drill',cars:'cars',plab:'passage',sim:'exam'}[key];
    const active = guidePlan()?.active;
    if (!o.guideTask && active?.type === type) o.guideTask = active;
    delete o.timerId; delete o._reveal;
    if (o.deadline) o._remain = Math.max(0, o.deadline - nowTs());
    o._saved = nowTs();
    return McatStorage.watch('cs-mcat-r-' + key,()=>o).save(o);
  } catch { McatStorage.sessionFailed(); return false; }
}
function loadResume(key) { return McatStorage.read('cs-mcat-r-' + key,null); }
function clearResume(key) { return McatStorage.remove('cs-mcat-r-' + key); }

const RESUME_SPECS = [
  { key: 'sim', mod: 'Exam Simulator',
    progressOf(r) { return r.queue?.length && !r.finishedAt ? 1 : 0; },
    label(r) { const s = r.queue[r.si]; return r.onBreak ? `Break &middot; ${SIM_SECTIONS[s.key].abbr} next` : `${SIM_SECTIONS[s.key].abbr} Q ${(r.idx || 0) + 1}/${s.items.length}`; },
    resume(r) { studyRestoreGuide(r); sim = r; if (simTimerId) clearInterval(simTimerId); simTimerId = null; if (r.onBreak) { renderBreak(); return; } sim.deadline = nowTs() + (r._remain ?? 600000); simTimerId = setInterval(simTick, 500); renderSimQ(); },
  },
  { key: 'drill', mod: 'Question Drills',
    progressOf(r) { return (r.results ? r.results.length : 0) || r.idx || 0; },
    label(r) { return `Q ${(r.idx || 0) + 1}/${r.qs.length}`; },
    resume(r) { studyRestoreGuide(r); drill = r; renderDrillQ(); },
  },
  { key: 'cars', mod: 'CARS Studio',
    progressOf(r) { return r.phase === 'blind' || r.phase === 'done' ? 1 : (r.results?.length || (r.p?.questions?.length ? 1 : 0)); },
    label(r) { return r.phase === 'blind' ? 'Blind review' : r.phase === 'done' ? 'Review results' : `Q ${(r.idx || 0) + 1}/${r.p.questions.length}`; },
    resume(r) { resumeCarsSession(r); },
  },
  { key: 'plab', mod: 'Passage Lab',
    progressOf(r) { return r.phase === 'analysis' || r.phase === 'done' ? 1 : (r.results?.length || (r.p?.questions?.length ? 1 : 0)); },
    label(r) { return r.phase === 'analysis' ? 'Experiment notebook' : r.phase === 'done' ? 'Review results' : `Q ${(r.idx || 0) + 1}/${r.p.questions.length}`; },
    resume(r) { resumePassageSession(r); },
  },
  { key: 'flash', mod: 'Flashcard Reactor',
    progressOf(r) { return r.queue?.length ? 1 : 0; },
    label(r) { return `${r.done || 0} / ${r.total || 0} cards`; },
    resume(r) { studyRestoreGuide(r); flash = r; renderFlashCard(); },
  },
];

// build a "Resume where you left off" button if a saved session has real progress
function resumeBtn(key) {
  const spec = RESUME_SPECS.find(s => s.key === key);
  if (!spec) return null;
  const r = loadResume(key);
  if (!r) return null;
  // a stale/legacy resume blob (wrong shape) must never crash the landing page — treat as "no resume"
  let lbl;
  try { if (!(spec.progressOf(r) > 0)) return null; lbl = spec.label(r); } catch { McatStorage.sessionFailed(); return null; }
  const btn = el(`<button class="btn btn-resume" id="resume">&#8634; Resume &middot; ${lbl}</button>`);
  btn.addEventListener('click', () => { try { spec.resume(r); } catch { McatStorage.sessionFailed(); } });
  return btn;
}
function findHubResume() {
  let best = null;
  for (const spec of RESUME_SPECS) {
    const r = loadResume(spec.key);
    if (!r) continue;
    try {
      if (spec.progressOf(r) <= 0) continue;
      const saved = r._saved || 0;
      if (!best || saved > best.saved) best = { spec, r, saved, lbl: spec.label(r) };
    } catch { McatStorage.sessionFailed(); }
  }
  return best;
}
function hubResumeChip() {
  const best = findHubResume();
  if (!best) return null;
  const wrap = el('<div class="mcat-resume-hint"></div>');
  const btn = el(`<button class="btn btn-resume" id="hub-resume">&#8634; Resume &middot; ${best.spec.mod} &middot; ${best.lbl}</button>`);
  btn.addEventListener('click', () => { try { best.spec.resume(best.r); } catch { McatStorage.sessionFailed(); } });
  wrap.appendChild(btn);
  return wrap;
}
function enterMCAT() {
  renderGuide();
}

// A first visit starts a flexible session or an optional reference plan.
// Returning learners open Today; the tool library remains available below it.
async function renderMCATEntry() {
  coursePauseTools(); await loadMCAT();
  const params = new URLSearchParams(location.search), view = params.get('view'), unit = params.get('unit');
  if (view === 'course') { if (unit === 'starting-check') return renderCoursePlacement(); return unit ? renderCourseUnit(unit) : renderCourseHome(); }
  if (['coach','math','weekly','diagnose','review'].includes(view)) return v2Go(view);
  if (view === 'practice') return renderMCAT();
  if (view === 'progress') return renderCourseProgress();
  renderGuide();
}

/* ---------- shared in-task header (breadcrumb + safe exit) ---------- */
function mcatTaskHeader(segs, right, exitLabel) {
  const parts = (segs || []).filter(Boolean).map(s => `<span class="crumb-seg">${s}</span>`).join('<span class="crumb-sep">&middot;</span>');
  return `<header class="topbar runbar">
    <div class="side"><button class="backbtn" id="exit">${exitLabel || '&larr; Exit'}</button></div>
    <nav class="center run-crumb"><button class="crumb-home" id="crumbmcat">MCAT</button>${parts ? '<span class="crumb-sep">&middot;</span>' + parts : ''}</nav>
    <div class="side right">${right || ''}</div>
  </header>`;
}
function wireRunHeader(root, onExit) {
  const c = root.querySelector('#crumbmcat'); if (c) c.addEventListener('click', renderMCATEntry);
  const x = root.querySelector('#exit'); if (x) x.addEventListener('click', onExit);
}
function confirmExit(hasProgress, onLeave) {
  if (!hasProgress) { onLeave(); return; }
  const m = el(`<dialog class="modal" id="cfx" aria-labelledby="cfx-title" aria-describedby="cfx-description"><div class="modal-box">
    <div class="modal-head"><h2 class="label" id="cfx-title">Leave this session?</h2></div>
    <p class="cfx-msg" id="cfx-description">Your place is saved. You can resume right where you left off.</p>
    <div class="endbtns cfx-btns"><button class="btn" id="cfx-cancel" autofocus>Keep going</button><button class="btn btn-solid" id="cfx-quit">Leave</button></div>
  </div></dialog>`);
  const close = () => { m.close();m.remove(); };
  m.addEventListener('cancel',e=>{e.preventDefault();close();});
  m.addEventListener('click', e => { if (e.target.id === 'cfx' || e.target.id === 'cfx-cancel') close(); });
  m.querySelector('#cfx-quit').addEventListener('click', () => { close(); onLeave(); });
  document.body.appendChild(m);m.showModal();
}

async function renderMCAT() {
  coursePauseTools();
  if (typeof stopTimer === 'function') stopTimer();
  if (typeof session !== 'undefined') session = null;
  // tear down any in-flight timed-module countdowns so a leftover timer can't auto-finish
  // and hijack a screen the user navigated to (e.g. leaving the Exam Simulator via the breadcrumb)
  if (cars) { clearInterval(cars.timerId); cars = null; }
  if (plab) { clearInterval(plab.timerId); plab = null; }
  if (simTimerId) { clearInterval(simTimerId); simTimerId = null; }
  sim = null; drill = null;
  await loadMCAT();

  const due = dueCount(), fresh = newCount();
  const qn = MCAT.questions.length, cn = MCAT.cards.length;
  const t = mcatTotals();

  const carsN = MCAT.cars.length, sciN = MCAT.sci.length;
  const conceptsN = MCAT.outline ? MCAT.outline.concepts.length : 0;

  const tools = [
    { name: 'Flashcards', desc: 'Recall facts on a spaced schedule', stat: cn ? `${due} due &middot; ${fresh} new` : 'Unavailable', go: renderFlashHome, on: cn > 0, core: true },
    { name: 'Question drills', desc: 'Practice discrete questions and review every answer', stat: qn ? `${qn} questions` : 'Unavailable', go: renderDrillSetup, on: qn > 0, core: true },
    { name: 'CARS practice', desc: 'Work through passages with blind review', stat: carsN ? `${carsN} passages` : 'Unavailable', go: renderCarsHome, on: carsN > 0, core: true },
    { name: 'Science passages', desc: 'Interpret experiments, figures, and data tables', stat: sciN ? `${sciN} passages` : 'Unavailable', go: renderPassageHome, on: sciN > 0, core: true },
    { name: 'Practice exam', desc: 'Train with intact passage sets, then review each timed run', stat: 'Timed', go: renderSimHome, on: qn > 0 && !!MCAT.outline, core: true },
    { name: 'Mistake lab', desc: 'Work through gaps and check your learning', stat: t.answered ? `${t.answered} answered &middot; ${t.acc}%` : 'No data yet', go: renderMistakeLab, on: true, core: false },
    { name: 'Blueprint', desc: 'Check coverage against the MCAT content map', stat: `${conceptsN} concepts`, go: renderCourseHome, on: !!MCAT.outline, core: false },
    { name: 'Study plan', desc: 'Build a 120, 90, or 60-day schedule', stat: guidePlan() ? 'Plan active' : 'Build a plan', go: renderGuide, on: !!MCAT.outline, core: false },
    { name: 'Course mapper', desc: 'Mark the prerequisite courses already completed', stat: 'Pre-study check', go: renderMapper, on: !!MCAT.outline, core: false },
  ];

  const method = {
    intro: 'The study tools combine scheduled review, practice questions, and written reflection. Here is what each tool does with your answers. Practice records describe your work in Cortex; they do not establish mastery or predict an MCAT score.',
    points: [
      ['Scheduled review', 'Flashcard intervals respond to your ratings. Course checks return after scheduled delays that respond to previous answers. These schedules do not measure exactly when you will forget something.'],
      ['Answer before feedback', 'Choose an answer before reading its explanation. Some activities also ask for a written explanation or passage evidence; multiple-choice drills record your selected answer.'],
      ['Mixed practice', 'Mixed sessions include questions or activities from different topics. Topic filters remain available when you want to focus on one area.'],
      ['Confidence and accuracy', 'Record how sure you are, then compare confidence with the accuracy of your saved answers. This can highlight answers you may want to revisit.'],
      ['Answer explanations', 'Read the authored explanation after answering. Where available, additional notes explain the distractors and suggest a related concept to review.'],
      ['Blind review', 'Reconsider CARS answers and write your reasoning before seeing explanations. Your first answers and later revisions remain separate in the review.'],
      ['Teach-back', 'Write an explanation in your own words, then compare it with the authored model where provided. Your writing is saved for self-review and is not automatically graded for mastery.'],
    ],
  };

  const root = el('<div></div>');
  root.appendChild(topbar('mcat'));
  const main = el(`<main class="panel mcat-landing">
    <header class="mcat-simple-hero">
      <span class="mcat-eyebrow">Free MCAT preparation</span>
      <h1>Practice with purpose.</h1>
      <p>Apply the ideas you have studied, review the reasoning, and build stamina one session at a time.</p>
      <div id="course-practice-mode"></div>
      <div class="mcat-simple-facts"><span><strong>${cn || '—'}</strong> cards</span><span><strong>${qn || '—'}</strong> questions</span><span><strong>${carsN + sciN || '—'}</strong> passages</span></div>
      <div class="mcat-cta"><button class="btn btn-solid" id="mc-enter">${findHubResume() || guidePlan() ? 'Continue studying' : 'Start studying'} &rarr;</button><button class="btn" id="mc-quick">Try a 5-minute session</button></div>
    </header>

    ${v2FeatureCards()}
    <section class="mcat-simple-tools" id="mcat-study-tools">
      <div class="mcat-simple-section-head"><span class="label">Study tools</span><span>Choose one place to begin</span></div>
      <div class="mcat-simple-list" id="mcat-core-tools"></div>
    </section>

    <details class="mcat-simple-fold">
      <summary><span><strong>Planning &amp; progress</strong><small>Study plan, blueprint, mistakes, and course map</small></span><i>Open</i></summary>
      <div class="mcat-simple-list" id="mcat-support-tools"></div>
    </details>

    <details class="mcat-simple-fold" id="mcat-method">
      <summary><span><strong>How the study system works</strong><small>The learning principles behind the tools</small></span><i>Open</i></summary>
      <div class="mcat-simple-method">
        <p>${method.intro}</p>
        <ul>${method.points.map(p => `<li><strong>${p[0]}</strong><span>${p[1]}</span></li>`).join('')}</ul>
      </div>
    </details>

    <p class="mcat-simple-note">Free forever. No account, paywall, or catch.</p>
  </main>`);

  tools.forEach((tool, index) => {
    const row = el(`<button class="mcat-simple-tool" data-mcat-tool="${index}" ${tool.on ? '' : 'disabled'}>
      <span class="mcat-simple-tool-num mono">${String(index + 1).padStart(2, '0')}</span>
      <span class="mcat-simple-tool-copy"><strong>${tool.name}</strong><span>${tool.desc}</span></span>
      <span class="mcat-simple-tool-stat">${tool.stat}</span>
      ${tool.on ? '<span class="mcat-simple-tool-go" aria-hidden="true">&rarr;</span>' : ''}
    </button>`);
    if (tool.on) row.addEventListener('click', () => { guideClearActiveTask(); tool.go(); });
    main.querySelector(tool.core ? '#mcat-core-tools' : '#mcat-support-tools').appendChild(row);
  });

  main.querySelector('#mc-enter').addEventListener('click', enterMCAT);
  main.querySelector('#mc-quick').addEventListener('click', startMcatQuickSession);
  const hubResume = hubResumeChip();
  if (hubResume) main.querySelector('.mcat-simple-hero').appendChild(hubResume);

  main.querySelector('#course-practice-mode').innerHTML = courseModeMarkup();
  wireCourseModes(main, renderMCAT);
  root.appendChild(main); mcatWorkspace(root,'practice');
  studySetView(root);
}

function mcatTotals() {
  let answered = QLOG.length, correct = QLOG.filter(x => x.correct).length;
  return { answered, correct, acc: answered ? Math.round(100 * correct / answered) : null };
}

/* ---------- Flashcard Reactor (SRS) ---------- */
let flash = null;
function renderFlashHome() {
  const sections = ['chemPhys', 'bioBiochem', 'psychSoc'];
  const root = el('<div></div>');
  root.appendChild(topbar('mcat'));
  const main = el(`<main class="panel">
    <div class="hero"><h1>Flashcard Reactor.</h1><p class="sub">Active recall on a spaced schedule — the highest-yield way to lock in facts.</p></div>
    <div class="ctl"><span class="label">Deck</span><div class="modes" id="fdeck">
      <button class="mode active" data-deck="all">All</button>
      ${sections.map(s => `<button class="mode" data-deck="${s}">${SEC_ABBR[s]}</button>`).join('')}
    </div></div>
    <div class="fstats" id="fstats"></div>
    <div class="endbtns"><button class="btn btn-solid" id="study">Study now</button><button class="btn" id="back">&larr; MCAT</button></div>
  </main>`);
  let deck = 'all';
  const refresh = () => {
    const pool = deck === 'all' ? MCAT.cards : MCAT.cards.filter(c => c.section === deck);
    const t = nowTs();
    const due = pool.filter(c => SRS[c.id] && SRS[c.id].reps > 0 && SRS[c.id].due <= t).length;
    const neu = pool.filter(c => !SRS[c.id] || SRS[c.id].reps === 0).length;
    const learned = pool.filter(c => SRS[c.id] && SRS[c.id].reps > 0).length;
    const mature = pool.filter(c => SRS[c.id] && SRS[c.id].interval >= 21).length;
    main.querySelector('#fstats').innerHTML = `
      <div class="metrics">
        <div class="metric"><span class="m-num">${due}</span><span class="m-lab">Due now</span></div>
        <div class="metric"><span class="m-num">${neu}</span><span class="m-lab">New</span></div>
        <div class="metric"><span class="m-num">${learned}</span><span class="m-lab">Learned</span><span class="m-sub">of ${pool.length}</span></div>
        <div class="metric"><span class="m-num">${mature}</span><span class="m-lab">Mature</span><span class="m-sub">21d+ interval</span></div>
      </div>`;
  };
  refresh();
  main.querySelectorAll('#fdeck .mode').forEach(b => b.addEventListener('click', () => { deck = b.dataset.deck; main.querySelectorAll('#fdeck .mode').forEach(x => x.classList.toggle('active', x === b)); refresh(); }));
  main.querySelector('#study').addEventListener('click', () => startFlash(deck));
  main.querySelector('#back').addEventListener('click', renderMCAT);
  const rb = resumeBtn('flash');
  if (rb) main.querySelector('.endbtns').prepend(rb);
  root.appendChild(main);
  setView(root);
}

function startFlash(deck, limitNew = 20, limitDue = 60, focusCategory = null, limitTotal = Infinity) {
  const pool = deck === 'all' ? MCAT.cards : MCAT.cards.filter(c => c.section === deck);
  const t = nowTs();
  const dueCards = pool.filter(c => SRS[c.id] && SRS[c.id].reps > 0 && SRS[c.id].due <= t).slice(0, limitDue);
  let newPool = pool.filter(c => !SRS[c.id] || SRS[c.id].reps === 0);
  if (focusCategory) {
    const focused = newPool.filter(c => c.category === focusCategory);
    if (focused.length) newPool = focused.concat(newPool.filter(c => c.category !== focusCategory));
  }
  const newCards = newPool.slice(0, limitNew);
  const queue = shuffleArr(dueCards.concat(newCards).slice(0, limitTotal));
  if (!queue.length) {
    if (guideCompleteActiveTask('flash')) renderGuide();
    else renderFlashHome();
    return;
  }
  flash = { deck, focusCategory, queue, idx: 0, total: queue.length, again: 0, done: 0 };
  renderFlashCard();
}
function shuffleArr(a) { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[x[i], x[j]] = [x[j], x[i]]; } return x; }

function renderFlashCard() {
  flash.attemptId ||= studyAttemptId();
  // A rating may have reached storage before its following resume save failed.
  while(flash.idx<flash.queue.length){
    const card=flash.queue[flash.idx],record=SRS[card.id];
    if(record?.lastRatingId!==`${flash.attemptId}:${flash.idx}`)break;
    advanceFlash(card,record.lastRating);
  }
  if (flash.idx >= flash.queue.length) { finishFlash(); return; }
  const c = flash.queue[flash.idx];
  saveResume('flash', flash);
  const root = el(`<div>
    ${mcatTaskHeader(['Flashcards', `${SEC_ABBR[c.section] || ''} ${esc(catTitle(c.category))}`.trim()], `<span class="topstat">${flash.done} / ${flash.total}</span>`)}
    <main class="flash-stage">
      <div class="flash-card" id="fc">
        <span class="label">${esc(c.tag || 'Recall')}</span>
        <div class="flash-front">${esc(c.front)}</div>
        <div class="flash-back" id="flash-back" style="display:none"><div class="rule-h"></div><div class="flash-ans">${esc(c.back)}</div></div>
      </div>
      <div class="flash-foot" id="ff"></div>
    </main>
  </div>`);
  wireRunHeader(root, () => confirmExit(flash && (flash.done > 0 || flash.again > 0 || flash.idx > 0), () => guideLeaveActive('flash', renderFlashHome)));
  setView(root);
  const ff = root.querySelector('#ff');
  const showReveal = () => {
    root.querySelector('#flash-back').style.display = 'block';
    ff.innerHTML = `<span class="hint">How well did you recall it?</span>
      <div class="rate"><button class="ratebtn again" data-r="again">Again<span class="rk">1</span></button><button class="ratebtn hard" data-r="hard">Hard<span class="rk">2</span></button><button class="ratebtn good" data-r="good">Good<span class="rk">3</span></button><button class="ratebtn easy" data-r="easy">Easy<span class="rk">4</span></button></div>`;
    ff.querySelectorAll('.ratebtn').forEach(b => b.addEventListener('click', () => rateFlash(c, b.dataset.r)));
  };
  ff.innerHTML = `<div class="continue-row"><span class="hint">SPACE / tap to flip</span><button class="btn btn-solid" id="reveal">Show answer</button></div>`;
  ff.querySelector('#reveal').addEventListener('click', showReveal);
  root.querySelector('#fc').addEventListener('click', () => { if (root.querySelector('#flash-back').style.display === 'none') showReveal(); });
  flash._reveal = showReveal;
}

function rateFlash(c, rating) {
  if(!['again','hard','good','easy'].includes(rating))return;
  flash.attemptId ||= studyAttemptId();
  const rec = srsRec(c.id);
  const ratingId=`${flash.attemptId}:${flash.idx}`;
  if(rec.lastRatingId!==ratingId){schedule(rec,rating);rec.lastRatingId=ratingId;rec.lastRating=rating;saveSRS();}
  advanceFlash(c,rec.lastRating);
  renderFlashCard();
}
function advanceFlash(c,rating){
  if (rating === 'again') { flash.again++; flash.queue.push(c); }   // re-show later this session
  else flash.done++;
  flash.idx++;
}

function finishFlash() {
  const guided = guideCompleteActiveTask('flash');
  clearResume('flash');
  if (typeof bumpStreak === 'function') bumpStreak();
  const root = el('<div></div>');
  root.appendChild(topbar('mcat'));
  const main = el(`<main class="panel"><section class="anat-results" style="border:0">
    <span class="label">Session complete</span>
    <div class="score">${flash.done}<span class="of"> cards</span></div>
    <div class="anat-pct">${flash.again} needed another look &middot; scheduled by your recall</div>
    <div class="endbtns">${guided ? '<button class="btn btn-solid" id="guide">Continue today\'s plan &rarr;</button>' : ''}<button class="btn ${guided ? '' : 'btn-solid'}" id="more">Study more</button><button class="btn" id="home">&larr; MCAT</button></div>
  </section></main>`);
  if (guided) main.querySelector('#guide').addEventListener('click', renderGuide);
  main.querySelector('#more').addEventListener('click', () => startFlash(flash.deck));
  main.querySelector('#home').addEventListener('click', renderMCAT);
  root.appendChild(main); setView(root);
}

/* ---------- Question Drills ---------- */
let drill = null;
function renderDrillSetup() {
  const sections = ['chemPhys', 'bioBiochem', 'psychSoc'];
  const root = el('<div></div>');
  root.appendChild(topbar('mcat'));
  const main = el(`<main class="panel">
    <div class="hero"><h1>Question Drills.</h1><p class="sub">Retrieval practice with confidence tagging and distractor autopsy. Interleaving mixes topics to build discrimination.</p></div>
    <div class="ctl"><span class="label">Scope</span><div class="modes" id="dscope">
      <button class="mode active" data-scope="all">Interleaved (all)</button>
      ${sections.map(s => `<button class="mode" data-scope="${s}">${SEC_ABBR[s]}</button>`).join('')}
    </div></div>
    <div class="ctl" style="margin-top:18px"><span class="label">Length</span><div class="modes" id="dlen">
      ${[5, 10, 20].map((n, i) => `<button class="mode ${i === 1 ? 'active' : ''}" data-len="${n}">${n}</button>`).join('')}
    </div></div>
    <div class="ctl" style="margin-top:18px"><span class="label">Mode</span><div class="modes" id="dmode">
      <button class="mode active" data-dm="standard">Standard</button>
      <button class="mode" data-dm="blind">Blind review</button>
    </div></div>
    <p class="anat-modehint" id="dmh">Standard: feedback after each question.</p>
    <div class="endbtns"><button class="btn btn-solid" id="start">Start drill</button><button class="btn" id="back">&larr; MCAT</button></div>
  </main>`);
  let scope = 'all', len = 10, mode = 'standard';
  const seg = (sel, set) => main.querySelectorAll(sel).forEach(b => b.addEventListener('click', () => { set(b); main.querySelectorAll(sel).forEach(x => x.classList.toggle('active', x === b)); }));
  seg('#dscope .mode', b => scope = b.dataset.scope);
  seg('#dlen .mode', b => len = +b.dataset.len);
  seg('#dmode .mode', b => { mode = b.dataset.dm; main.querySelector('#dmh').textContent = mode === 'blind' ? 'Blind review: answer everything first with no feedback, then review all at once — trains honest judgment.' : 'Standard: feedback after each question.'; });
  main.querySelector('#start').addEventListener('click', () => startDrill(scope, len, mode));
  main.querySelector('#back').addEventListener('click', renderMCAT);
  const rb = resumeBtn('drill');
  if (rb) main.querySelector('.endbtns').prepend(rb);
  root.appendChild(main); setView(root);
}

function startDrill(scope, len, mode) {
  let pool = scope === 'all' ? MCAT.questions : MCAT.questions.filter(q => q.section === scope);
  if (!pool.length) return;
  // prefer least-recently-seen / missed
  const qs = shuffleArr(pool).slice(0, Math.min(len, pool.length));
  drill = { qs, idx: 0, mode, results: [], scope };
  renderDrillQ();
}

function renderDrillQ() {
  drill.attemptId ||= studyAttemptId();
  if (drill.idx >= drill.qs.length) { finishDrill(); return; }
  const q = drill.qs[drill.idx];
  saveResume('drill', drill);
  const root = el(`<div>
    ${mcatTaskHeader(['Drill', SEC_ABBR[q.section] || '', esc(catTitle(q.category))], `<span class="topstat">Q ${drill.idx + 1}/${drill.qs.length}</span>`)}
    <main class="case">
      <div class="block"><p class="q">${esc(q.stem)}</p></div>
      <div class="conf-row"><span class="label">Confidence</span>
        <div class="modes" id="conf">
          <button class="mode" data-c="guess">Guess</button>
          <button class="mode active" data-c="unsure">Unsure</button>
          <button class="mode" data-c="sure">Sure</button>
        </div>
      </div>
      <div class="opts" id="opts">${q.options.map((o, i) => `<button class="opt" data-i="${i}"><span class="key">${'ABCD'[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>
      <div class="after" id="after"></div>
    </main>
  </div>`);
  wireRunHeader(root, () => confirmExit(drill && drill.results.length > 0, () => guideLeaveActive('drill', renderDrillSetup)));
  let conf = 'unsure';
  root.querySelectorAll('#conf .mode').forEach(b => b.addEventListener('click', () => { conf = b.dataset.c; root.querySelectorAll('#conf .mode').forEach(x => x.classList.toggle('active', x === b)); }));
  root.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => answerDrill(root, q, +b.dataset.i, conf)));
  setView(root);
  const saved=drill.results[drill.idx];if(saved)answerDrill(root,q,saved.chosen,saved.conf);
}

function answerDrill(root, q, choice, conf) {
  const correct = choice === q.answer;
  root.querySelectorAll('.opt').forEach(btn => {
    const i = +btn.dataset.i; btn.disabled = true;
    if (drill.mode === 'standard') {
      if (i === q.answer) btn.classList.add('correct');
      else if (i === choice) btn.classList.add('wrong');
      else btn.classList.add('dimmed');
    } else if (i === choice) btn.classList.add('chosen-blind');
  });
  root.querySelectorAll('#conf .mode').forEach(b => b.disabled = true);
  const res = drill.results[drill.idx] ||= { id: q.id, section: q.section, category: q.category, chosen: choice, correct, conf, root: null };
  saveResume('drill',drill);

  const after = root.querySelector('#after');
  if (drill.mode === 'blind') {
    after.innerHTML = `<div class="continue-row"><span class="hint">no feedback yet &middot; ENTER &rarr;</span><button class="btn btn-solid" data-next>${drill.idx + 1 >= drill.qs.length ? 'Review all' : 'Next'}</button></div>`;
  } else {
    const autopsy = (q.distractors || []).filter(d => d.i !== q.answer).map(d => `<div class="autopsy-row"><span class="ak">${'ABCD'[d.i]}</span><span>${esc(d.why)}</span></div>`).join('');
    after.innerHTML = `<div class="explain ${correct ? 'good' : 'bad'}"><span class="verdict">${correct ? 'CORRECT' : 'INCORRECT'}</span><p>${esc(q.explanation)}</p>
      ${autopsy ? `<div class="autopsy"><span class="label">Distractor autopsy</span>${autopsy}</div>` : ''}</div>
      ${correct ? '' : `<div class="rootcause"><span class="label">What went wrong? (tags your weak spots)</span><div class="rc-chips">${ROOT_CAUSES.map(rc => `<button class="rc-chip" data-rc="${esc(rc)}">${esc(rc)}</button>`).join('')}</div></div>`}
      <div class="continue-row"><span class="hint">ENTER &rarr;</span><button class="btn btn-solid" data-next>${drill.idx + 1 >= drill.qs.length ? 'Results' : 'Next'}</button></div>`;
    after.querySelectorAll('.rc-chip').forEach(ch => {ch.classList.toggle('on',ch.dataset.rc===res.root);ch.addEventListener('click', () => { res.root = ch.dataset.rc; saveResume('drill',drill); after.querySelectorAll('.rc-chip').forEach(x => x.classList.toggle('on', x === ch)); });});
  }
  const nb = after.querySelector('[data-next]');
  nb.addEventListener('click', () => { drill.idx++; renderDrillQ(); });
  nb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function finishDrill() {
  drill.attemptId ||= studyAttemptId();
  const guided = guideCompleteActiveTask('drill');
  // commit to history + log
  const t = drill.finishedAt ||= (drill.results.map(r=>QHIST[r.id]).find(h=>h?.lastAttemptId===drill.attemptId)?.ts || nowTs());
  drill.results.forEach(r => {
    if(QLOG.some(a=>a.attemptId===drill.attemptId&&a.qId===r.id))return;
    const h = QHIST[r.id] || { n: 0 };
    if(h.lastAttemptId!==drill.attemptId)h.n++;
    h.lastAttemptId=drill.attemptId;h.lastCorrect = r.correct; h.conf = r.conf; h.root = r.root; h.ts = t; QHIST[r.id] = h;
    QLOG.push({ qId: r.id, section: r.section, category: r.category, correct: r.correct, conf: r.conf, ts: t, attemptId:drill.attemptId });
  });
  saveQ();
  saveResume('drill',drill);
  clearResume('drill');
  if (typeof bumpStreak === 'function') bumpStreak();

  const correct = drill.results.filter(r => r.correct).length;
  const total = drill.results.length;
  const root = el('<div></div>');
  root.appendChild(topbar('mcat'));
  const main = el(`<main class="panel">
    <section class="summary" style="border:0;margin-top:8px">
      <span class="label">Drill complete</span>
      <div class="score">${String(correct).padStart(2, '0')}<span class="of">/${String(total).padStart(2, '0')}</span></div>
      <div class="ticks">${drill.results.map((r, i) => `<span class="${r.correct ? 'ok' : 'no'}">Q${i + 1} ${r.correct ? '&#10003;' : '&#10007;'}</span>`).join('')}</div>
      <div class="calib-mini" id="cm"></div>
      <div class="drill-review" id="dr"></div>
      <div class="endbtns">${guided ? '<button class="btn btn-solid" id="guide">Continue today\'s plan &rarr;</button>' : ''}<button class="btn ${guided ? '' : 'btn-solid'}" id="again">New drill</button><button class="btn" id="lab">Mistake Lab</button><button class="btn" id="home">&larr; MCAT</button></div>
    </section>
  </main>`);
  // mini calibration for this drill
  main.querySelector('#cm').innerHTML = calibRows(drill.results);
  // full review (always) — explanations + autopsy, esp. valuable after blind mode
  const dr = main.querySelector('#dr');
  dr.innerHTML = `<span class="label">Review</span>` + drill.qs.map((q, i) => {
    const r = drill.results[i]; if (!r) return '';
    const autopsy = (q.distractors || []).filter(d => d.i !== q.answer).map(d => `<div class="autopsy-row"><span class="ak">${'ABCD'[d.i]}</span><span>${esc(d.why)}</span></div>`).join('');
    return `<details class="rev" ${r.correct ? '' : 'open'}>
      <summary><span class="${r.correct ? 'ok' : 'no'}">${r.correct ? '&#10003;' : '&#10007;'}</span> Q${i + 1}. ${esc(q.stem.slice(0, 90))}${q.stem.length > 90 ? '&hellip;' : ''}</summary>
      <div class="rev-body">
        <div class="rev-ans">You: ${r.chosen == null ? 'Unanswered' : 'ABCD'[r.chosen]} &middot; Correct: <b>${'ABCD'[q.answer]}</b> &middot; felt ${CONF[r.conf]}</div>
        <p>${esc(q.explanation)}</p>
        ${autopsy ? `<div class="autopsy">${autopsy}</div>` : ''}
        ${courseRelatedLinks(q.id)}${!r.correct?'<button class="btn" data-v2-view="diagnose">Investigate the sticking point →</button>':''}
      </div></details>`;
  }).join('');
  if (guided) main.querySelector('#guide').addEventListener('click', renderGuide);
  main.querySelector('#again').addEventListener('click', () => renderDrillSetup());
  main.querySelector('#lab').addEventListener('click', renderMistakeLab);
  main.querySelector('#home').addEventListener('click', renderMCAT);
  root.appendChild(main); setView(root); window.scrollTo(0, 0);
}

function calibRows(results) {
  const order = ['sure', 'unsure', 'guess'];
  const rows = order.map(c => {
    const set = results.filter(r => r.conf === c);
    if (!set.length) return '';
    const acc = Math.round(100 * set.filter(r => r.correct).length / set.length);
    return `<div class="calib-row"><span class="cl">${CONF[c]}</span><span class="cbar"><i style="width:${acc}%"></i></span><span class="cv">${acc}% &middot; ${set.length}q</span></div>`;
  }).filter(Boolean).join('');
  return rows ? `<div class="calib"><span class="label">Confidence vs accuracy</span>${rows}</div>` : '';
}

/* ---------- Blueprint Navigator ---------- */
function renderBlueprint() {
  const root = el('<div></div>');
  root.appendChild(topbar('mcat'));
  const o = MCAT.outline;
  const main = el(`<main class="panel">
    <button class="backbtn topback" id="back">&larr; MCAT</button>
    <div class="hero"><h1>Blueprint Navigator.</h1><p class="sub">The full AAMC content map. Coverage = how you've performed on each category's questions. Tap any category to drill or study it.</p></div>
    <div class="bp-legend"><span class="bpl ok">Solid 75%+</span><span class="bpl mid">Shaky 50&ndash;74%</span><span class="bpl no">Weak &lt;50%</span><span class="bpl">&mdash; Not tested yet</span></div>
    <div id="bp"></div>
  </main>`);
  main.querySelector('#back').addEventListener('click', renderMCAT);
  const bp = main.querySelector('#bp');
  ['bioBiochem', 'chemPhys', 'psychSoc', 'cars'].forEach(secKey => {
    const sec = o.sections[secKey];
    const concepts = o.concepts.filter(c => c.section === secKey);
    const wrap = el(`<div class="bp-sec"><div class="bp-sec-head"><span class="bp-abbr">${sec.abbr}</span><span class="bp-name">${esc(sec.name)}</span></div></div>`);
    concepts.forEach(con => {
      con.categories.forEach(cat => {
        const stat = catStat(cat.id);
        const cls = stat.n === 0 ? '' : stat.acc >= 75 ? 'ok' : stat.acc >= 50 ? 'mid' : 'no';
        const row = el(`<button class="bp-cat">
          <span class="bp-cat-id">${cat.id}</span>
          <span class="bp-cat-title">${esc(cat.title)}</span>
          <span class="bp-cat-stat ${cls}">${stat.n ? stat.acc + '%' : '&mdash;'}</span>
        </button>`);
        // CARS categories have no discrete questions/cards — send the user to CARS Studio instead of a dead-end
        row.addEventListener('click', () => secKey === 'cars' ? renderCarsHome() : renderCategory(cat, con, secKey));
        wrap.appendChild(row);
      });
    });
    bp.appendChild(wrap);
  });
  root.appendChild(main); setView(root);
}
function catStat(catId) {
  const log = QLOG.filter(x => x.category === catId);
  return { n: log.length, acc: log.length ? Math.round(100 * log.filter(x => x.correct).length / log.length) : 0 };
}
function renderCategory(cat, con, secKey) {
  const cards = MCAT.cards.filter(c => c.category === cat.id);
  const qs = MCAT.questions.filter(q => q.category === cat.id);
  const root = el('<div></div>');
  root.appendChild(topbar('mcat'));
  const main = el(`<main class="panel">
    <button class="backbtn" id="back" style="margin-bottom:18px">&larr; Blueprint</button>
    <div class="hero"><h1 style="font-size:26px">${cat.id} &middot; ${esc(cat.title)}</h1><p class="sub">${esc(con.summary)}</p></div>
    <div class="statblock"><span class="label">Topics</span><div class="topic-chips">${cat.topics.map(t => `<span class="tchip">${esc(t)}</span>`).join('')}</div></div>
    <div class="endbtns">
      <button class="btn btn-solid" id="drill" ${qs.length ? '' : 'disabled'}>${qs.length ? `Drill ${qs.length} question${qs.length === 1 ? '' : 's'}` : 'No questions yet'}</button>
      <button class="btn" id="study" ${cards.length ? '' : 'disabled'}>${cards.length ? `Study ${cards.length} card${cards.length === 1 ? '' : 's'}` : 'No cards yet'}</button>
    </div>
  </main>`);
  main.querySelector('#back').addEventListener('click', renderBlueprint);
  if (qs.length) main.querySelector('#drill').addEventListener('click', () => { drill = { qs: shuffleArr(qs).slice(0, 10), idx: 0, mode: 'standard', results: [], scope: cat.id }; renderDrillQ(); });
  if (cards.length) main.querySelector('#study').addEventListener('click', () => { flash = { deck: cat.id, queue: shuffleArr(cards), idx: 0, total: cards.length, again: 0, done: 0 }; renderFlashCard(); });
  root.appendChild(main); setView(root);
}

/* ---------- Mistake Lab ---------- */
function renderMistakeLab() {
  const root = el('<div></div>');
  root.appendChild(topbar('mcat'));
  const t = mcatTotals();
  // calibration across all logged answers
  const calib = calibRows(QLOG.map(x => ({ conf: x.conf, correct: x.correct })));
  // weak categories (>=2 attempts)
  const byCat = {};
  QLOG.forEach(x => { (byCat[x.category] ||= { n: 0, c: 0 }); byCat[x.category].n++; if (x.correct) byCat[x.category].c++; });
  const weak = Object.entries(byCat).filter(([, v]) => v.n >= 2).map(([k, v]) => ({ cat: k, acc: Math.round(100 * v.c / v.n), n: v.n })).sort((a, b) => a.acc - b.acc).slice(0, 6);
  // root causes
  const roots = {};
  Object.values(QHIST).forEach(h => { if (h.root) roots[h.root] = (roots[h.root] || 0) + 1; });
  const rootRows = Object.entries(roots).sort((a, b) => b[1] - a[1]);
  // missed — only ids that "Redo missed" can actually load (discrete questions), so the count matches the action
  const missed = Object.entries(QHIST).filter(([id, h]) => h.lastCorrect === false && MCAT.questions.some(q => q.id === id)).map(([id]) => id);

  const main = el(`<main class="panel">
    <div class="hero"><h1>Mistake Lab.</h1><p class="sub">Every miss should generate a next move. Here's where to aim.</p></div>
    <div id="mistake-repair"></div>
    ${t.answered ? `<div class="metrics">
      <div class="metric"><span class="m-num">${t.answered}</span><span class="m-lab">Answered</span></div>
      <div class="metric"><span class="m-num">${t.acc}%</span><span class="m-lab">Accuracy</span><span class="m-sub">${t.correct} correct</span></div>
      <div class="metric"><span class="m-num">${missed.length}</span><span class="m-lab">To redo</span></div>
      <div class="metric"><span class="m-num">${weak.length ? weak[0].acc + '%' : '&mdash;'}</span><span class="m-lab">Weakest area</span><span class="m-sub">${weak.length ? esc(catTitle(weak[0].cat)) : ''}</span></div>
    </div>` : '<div class="empty">No drill data yet — run a Question Drill and your weak spots show up here.</div>'}

    ${calib ? `<div class="statblock">${calib}<p class="anat-modehint">If "Sure" accuracy isn't far above "Guess", you're overconfident — slow down and verify.</p></div>` : ''}

    ${weak.length ? `<div class="statblock"><span class="label">Target these (lowest accuracy)</span><div id="weak"></div></div>` : ''}
    ${rootRows.length ? `<div class="statblock"><span class="label">Why you miss (root causes)</span><div class="rootbars">${rootRows.map(([k, v]) => `<div class="calib-row"><span class="cl">${esc(k)}</span><span class="cbar"><i style="width:${Math.min(100, v * 20)}%;background:var(--red)"></i></span><span class="cv">${v}</span></div>`).join('')}</div></div>` : ''}

    <div class="endbtns">
      ${missed.length ? '<button class="btn btn-solid" id="redo">Practice missed questions again</button>' : ''}
      <button class="btn" id="home">&larr; MCAT</button>
    </div>
  </main>`);

  mountRepairDashboard(main.querySelector('#mistake-repair'));
  if (weak.length) {
    const wc = main.querySelector('#weak');
    weak.forEach(w => {
      const cat = findCat(w.cat);
      const qs = MCAT.questions.filter(q => q.category === w.cat);
      // only categories with a real drill pool get a clickable row (CARS/passage-only cats can't be drilled here)
      const row = el(`<button class="bp-cat" ${qs.length ? '' : 'disabled'}><span class="bp-cat-id">${esc(w.cat)}</span><span class="bp-cat-title">${cat ? esc(cat.title) : ''}</span><span class="bp-cat-stat no">${w.acc}% &middot; ${w.n}q</span></button>`);
      if (qs.length) row.addEventListener('click', () => { drill = { qs: shuffleArr(qs).slice(0, 10), idx: 0, mode: 'standard', results: [], scope: w.cat }; renderDrillQ(); });
      wc.appendChild(row);
    });
  }
  const redo = main.querySelector('#redo');
  if (redo) redo.addEventListener('click', () => {
    const qs = missed.map(id => MCAT.questions.find(q => q.id === id)).filter(Boolean);
    if (qs.length) { drill = { qs: shuffleArr(qs).slice(0, 20), idx: 0, mode: 'standard', results: [], scope: 'missed' }; renderDrillQ(); }
  });
  main.querySelector('#home').addEventListener('click', renderMCAT);
  root.appendChild(main); setView(root);
}
function findCat(id) { if (!MCAT.outline) return null; for (const c of MCAT.outline.concepts) { const f = c.categories.find(x => x.id === id); if (f) return f; } return null; }
function catTitle(id) { const c = findCat(id); return c ? c.title : (id || ''); }

/* ---------- CARS Studio ---------- */
let cars = null;
const SKILL_LABEL = { 'cars-1': 'Comprehension', 'cars-2': 'Reasoning within', 'cars-3': 'Reasoning beyond' };
function renderCarsHome() {
  const root = el('<div></div>'); root.appendChild(topbar('mcat'));
  const main = el(`<main class="panel">
    <div class="hero"><h1>CARS Studio.</h1><p class="sub">Original passages. No outside knowledge — just reading, logic, and disciplined answer-choice analysis.</p></div>
    <div class="ctl"><span class="label">Timer</span><div class="modes" id="ctime">
      <button class="mode active" data-t="off">Untimed</button><button class="mode" data-t="on">Timed (10 min)</button></div></div>
    <div class="endbtns" style="margin-top:18px"><button class="btn btn-solid" id="rand">Random passage</button><button class="btn" id="back">&larr; MCAT</button></div>
    <div class="statblock"><span class="label">Passages</span><div class="rows" id="plist"></div></div>
  </main>`);
  let timed = false;
  main.querySelectorAll('#ctime .mode').forEach(b => b.addEventListener('click', () => { timed = b.dataset.t === 'on'; main.querySelectorAll('#ctime .mode').forEach(x => x.classList.toggle('active', x === b)); }));
  const list = main.querySelector('#plist');
  MCAT.cars.forEach(p => {
    const log = QLOG.filter(x => x.passage === p.id);
    const acc = log.length ? Math.round(100 * log.filter(x => x.correct).length / log.length) : null;
    const row = el(`<button class="row"><span class="row-main"><span class="row-spec">${esc(p.discipline)}</span><span class="row-title">${esc(p.title)}</span></span><span class="row-right">${acc != null ? `<span class="pill ${acc >= 75 ? 'ok' : acc >= 50 ? 'mid' : 'no'}">${acc}%</span>` : `<span class="row-when">${p.questions.length}q &rarr;</span>`}</span></button>`);
    row.addEventListener('click', () => startCars(p, timed));
    list.appendChild(row);
  });
  main.querySelector('#rand').addEventListener('click', () => startCars(MCAT.cars[Math.floor(Math.random() * MCAT.cars.length)], timed));
  main.querySelector('#back').addEventListener('click', renderMCAT);
  studyLockPassageList('cars',main);
  studyReportButton('cars', main);
  const rb = resumeBtn('cars');
  if (rb) main.querySelector('.endbtns').prepend(rb);
  root.appendChild(main); setView(root);
}
function startCars(p, timed) {
  const saved=loadResume('cars');
  if (saved?.p?.questions?.length && Array.isArray(saved.results)) return resumeCarsSession(saved);
  cars = { p, phase:'attempt', attemptId:studyAttemptId(), flags:{}, confidence:{}, idx: 0, results: [], timed, deadline: timed ? nowTs() + 600000 : 0, timerId: null };
  if (timed) cars.timerId = setInterval(carsTick, 500);
  renderCarsRunner();
}
function carsTick() { if (!cars || (cars.phase && cars.phase !== 'attempt')) return; const left = (cars.deadline - nowTs()) / 1000; const t = document.getElementById('cars-timer'); if (t) { t.textContent = fmtTime(left); t.classList.toggle('crit', left <= 60); } if (left <= 0) { clearInterval(cars.timerId); finishCars(); } }
function renderCarsRunner() {
  if (cars.phase === 'blind') return renderCarsBlindReview();
  if (cars.phase === 'done') return renderCarsReviewResult();
  cars.flags ||= {}; cars.confidence ||= {};
  const p = cars.p;
  if (cars.idx >= p.questions.length) { finishCars(); return; }
  const q = p.questions[cars.idx];
  saveResume('cars', cars);
  const root = el(`<div>
    ${mcatTaskHeader(['CARS', esc(p.discipline)], `${cars.timed ? '<span class="timer" id="cars-timer"></span>' : ''}<span class="topstat">Q ${cars.idx + 1}/${p.questions.length}</span>`)}
    <main class="cars-stage">
      <div class="cars-passage"><span class="label">${esc(p.title)}</span>${p.text.split(/\n\n+/).map(par => `<p>${esc(par)}</p>`).join('')}</div>
      <div class="cars-q">
        <p class="q">${esc(q.stem)}</p>
        <fieldset class="repair-confidence"><legend>How sure are you?</legend>${Object.entries(CONF).map(([key,label]) => `<label><input type="radio" name="cars-confidence" value="${key}" ${(cars.confidence[q.id] || 'unsure') === key ? 'checked' : ''}>${label}</label>`).join('')}</fieldset>
        <label class="study-flag"><input type="checkbox" id="cars-flag" ${cars.flags[q.id] ? 'checked' : ''}> Flag for blind review</label>
        <div class="opts">${McatV2Core.optionOrder(q.options,q.displayOrder).map((i,position) => `<button class="opt" data-i="${i}"><span class="key">${'ABCD'[position]}</span><span>${esc(q.options[i])}</span></button>`).join('')}</div>
      </div>
    </main>
  </div>`);
  studyWirePassageExit(root,'cars',cars,renderCarsHome);
  root.querySelectorAll('[name="cars-confidence"]').forEach(input => input.onchange = () => { cars.confidence[q.id]=input.value; saveResume('cars',cars); });
  root.querySelector('#cars-flag').onchange = e => { cars.flags[q.id]=e.target.checked; saveResume('cars',cars); };
  root.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => { cars.results.push({ q, chosen: +b.dataset.i, correct: +b.dataset.i === q.answer, conf:cars.confidence[q.id] || 'unsure', flagged:!!cars.flags[q.id] }); cars.idx++; renderCarsRunner(); window.scrollTo(0, 0); }));
  setView(root); window.scrollTo(0, 0);
  if (cars.timed) carsTick();
}
function finishCars() { beginCarsBlindReview(); }

/* ---------- shared passage rendering ---------- */
function dataTableHTML(table) {
  if (!table || !table.headers) return '';
  return `<div class="dtable">${table.caption ? `<div class="dt-cap">${esc(table.caption)}</div>` : ''}<table><thead><tr>${table.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${(table.rows || []).map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function passageBody(title, text, table, contentNote) {
  return `<div class="cars-passage"><span class="label">${esc(title)}</span>${contentNote ? `<p class="course-caption">${esc(contentNote)}</p>` : ''}${text.split(/\n\n+/).map(p => `<p>${esc(p)}</p>`).join('')}${dataTableHTML(table)}</div>`;
}

/* ---------- Passage Lab (AAMC-style science passages) ---------- */
let plab = null;
function renderPassageHome() {
  const root = el('<div></div>'); root.appendChild(topbar('mcat'));
  const main = el(`<main class="panel">
    <div class="hero"><h1>Passage Lab.</h1><p class="sub">AAMC-style science passages — a study, its data, and a question set. The real test is passage-based; train that.</p></div>
    <div class="ctl"><span class="label">Section</span><div class="modes" id="psec">
      <button class="mode active" data-s="all">All</button><button class="mode" data-s="chemPhys">C/P</button><button class="mode" data-s="bioBiochem">B/B</button><button class="mode" data-s="psychSoc">P/S</button></div></div>
    <div class="ctl" style="margin-top:18px"><span class="label">Timer</span><div class="modes" id="ptime">
      <button class="mode active" data-t="off">Untimed</button><button class="mode" data-t="on">Timed (10 min)</button></div></div>
    <div class="statblock"><span class="label">Passages</span><div class="rows" id="plist"></div></div>
    <div class="endbtns"><button class="btn" id="back">&larr; MCAT</button></div>
  </main>`);
  let sec = 'all', timed = false;
  const list = main.querySelector('#plist');
  const refresh = () => {
    list.replaceChildren();
    const saved=loadResume('plab');
    const paused=!!(saved?.p?.questions?.length && Array.isArray(saved.results));
    MCAT.sci.filter(p => sec === 'all' || p.section === sec).forEach(p => {
      const log = QLOG.filter(x => x.passage === p.id);
      const acc = log.length ? Math.round(100 * log.filter(x => x.correct).length / log.length) : null;
      const row = el(`<button class="row"><span class="row-main"><span class="row-spec">${SEC_ABBR[p.section]} &middot; ${esc(p.type)}</span><span class="row-title">${esc(p.title)}</span></span><span class="row-right">${acc != null ? `<span class="pill ${acc >= 75 ? 'ok' : acc >= 50 ? 'mid' : 'no'}">${acc}%</span>` : `<span class="row-when">${p.questions.length}q &rarr;</span>`}</span></button>`);
      row.disabled=paused;
      row.addEventListener('click', () => startPassage(p, timed));
      list.appendChild(row);
    });
  };
  refresh();
  main.querySelectorAll('#psec .mode').forEach(b => b.addEventListener('click', () => { sec = b.dataset.s; main.querySelectorAll('#psec .mode').forEach(x => x.classList.toggle('active', x === b)); refresh(); }));
  main.querySelectorAll('#ptime .mode').forEach(b => b.addEventListener('click', () => { timed = b.dataset.t === 'on'; main.querySelectorAll('#ptime .mode').forEach(x => x.classList.toggle('active', x === b)); }));
  main.querySelector('#back').addEventListener('click', renderMCAT);
  studyLockPassageList('plab',main);
  studyReportButton('plab', main);
  const rb = resumeBtn('plab');
  if (rb) main.querySelector('.endbtns').prepend(rb);
  root.appendChild(main); setView(root);
}
function startPassage(p, timed) { const saved=loadResume('plab'); if (saved?.p?.questions?.length && Array.isArray(saved.results)) return resumePassageSession(saved); plab = { p, phase:'attempt', attemptId:studyAttemptId(), idx: 0, results: [], timed, deadline: timed ? nowTs() + 600000 : 0, timerId: null }; if (timed) plab.timerId = setInterval(plabTick, 500); renderPassageRunner(); }
function plabTick() { if (!plab || (plab.phase && plab.phase !== 'attempt')) return; const left = (plab.deadline - nowTs()) / 1000; const t = document.getElementById('plab-timer'); if (t) { t.textContent = fmtTime(left); t.classList.toggle('crit', left <= 60); } if (left <= 0) { clearInterval(plab.timerId); finishPassage(); } }
function renderPassageRunner() {
  if (plab.phase === 'analysis') return renderExperimentNotebook();
  if (plab.phase === 'done') return finishPassage();
  const p = plab.p;
  if (plab.idx >= p.questions.length) { finishPassage(); return; }
  const q = p.questions[plab.idx];
  saveResume('plab', plab);
  const root = el(`<div>
    ${mcatTaskHeader([`${SEC_ABBR[p.section]} Passage`], `<button class="bookmark" id="pt" title="Periodic table" aria-label="Periodic table">PT</button>${plab.timed ? '<span class="timer" id="plab-timer"></span>' : ''}<span class="topstat">Q ${plab.idx + 1}/${p.questions.length}</span>`)}
    <main class="cars-stage">
      ${passageBody(p.title, p.text, p.table, p.contentNote)}
      <div class="cars-q"><p class="q">${esc(q.stem)}</p>
        <div class="opts">${q.options.map((o, i) => `<button class="opt" data-i="${i}"><span class="key">${'ABCD'[i]}</span><span>${esc(o)}</span></button>`).join('')}</div></div>
    </main></div>`);
  studyWirePassageExit(root,'plab',plab,renderPassageHome);
  root.querySelector('#pt').addEventListener('click', periodicModal);
  root.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => { plab.results.push({ q, chosen: +b.dataset.i, correct: +b.dataset.i === q.answer }); plab.idx++; renderPassageRunner(); }));
  setView(root); window.scrollTo(0, 0); if (plab.timed) plabTick();
}
function finishPassage() {
  if (plab.phase !== 'done') { studyFinishAttempt(plab); renderExperimentNotebook(); return; }
  if (!plab.archived) { studyLogAttempt(plab,'plab'); plab.guided ||= guideCompleteActiveTask('passage'); studySaveReport('plab',plab); clearResume('plab'); }
  const guided = plab.guided, p = plab.p;
  const correct = plab.results.filter(r => r.correct).length, total = plab.results.length;
  const root = el('<div></div>'); root.appendChild(topbar('mcat'));
  const main = el(`<main class="panel"><section class="summary" style="border:0;margin-top:8px">
    <span class="label">Passage complete &middot; ${esc(p.title)}</span>
    <div class="score">${String(correct).padStart(2, '0')}<span class="of">/${String(total).padStart(2, '0')}</span></div>
    <div class="drill-review" id="dr"></div>
    <div class="endbtns">${guided ? '<button class="btn btn-solid" id="guide">Continue today\'s plan &rarr;</button>' : ''}<button class="btn ${guided ? '' : 'btn-solid'}" id="next">Back to passages</button><button class="btn" id="home">&larr; MCAT</button></div>
  </section></main>`);
  main.querySelector('#dr').innerHTML = experimentComparison(plab) + `<span class="label">Question review · original score</span>` + plab.results.map((r, i) => { const autopsy = (r.q.distractors || []).filter(d => d.i !== r.q.answer).map(d => `<div class="autopsy-row"><span class="ak">${'ABCD'[d.i]}</span><span>${esc(d.why)}</span></div>`).join(''); return `<details class="rev" ${r.correct ? '' : 'open'}><summary><span class="${r.correct ? 'ok' : 'no'}">${r.correct ? '&#10003;' : '&#10007;'}</span> Q${i + 1}</summary><div class="rev-body"><div class="rev-ans">You: ${r.chosen == null ? 'Unanswered' : 'ABCD'[r.chosen]} &middot; Correct: <b>${'ABCD'[r.q.answer]}</b></div><p>${esc(r.q.explanation)}</p>${courseRelatedLinks(r.q.id)}${autopsy ? `<div class="autopsy">${autopsy}</div>` : ''}</div></details>`; }).join('');
  if (guided) main.querySelector('#guide').addEventListener('click', renderGuide);
  main.querySelector('#next').addEventListener('click', renderPassageHome);
  main.querySelector('#home').addEventListener('click', renderMCAT);
  root.appendChild(main); studySetView(root); window.scrollTo(0, 0);
}

/* ---------- Exam Simulator ---------- */
let sim = null, simTimerId = null;
function renderSimHome() {
  if (!MCAT.outline) return renderMCAT();
  const root = el('<div></div>'); root.appendChild(topbar('mcat'));
  const main = el(`<main class="panel">
    <div class="hero"><h1>Timed practice.</h1><p class="sub">Build pacing with whole passage sets, a countdown, flags, and feedback after submission. These original sets vary in length; the timer scales to the number of questions. They are not official full-length exams.</p></div>
    <div class="statblock"><span class="label">Section simulators</span><div id="secs"></div></div>
    <div class="statblock"><span class="label">Stamina</span>
      <button class="bp-cat" id="full"><span class="bp-cat-id">FL</span><span class="bp-cat-title">Four-section practice, with breaks</span><span class="bp-cat-stat">Variable length</span></button></div>
    <div class="endbtns"><button class="btn" id="back">&larr; MCAT</button></div>
  </main>`);
  const secs = main.querySelector('#secs');
  ['chemPhys', 'cars', 'bioBiochem', 'psychSoc'].forEach(k => {
    const n = simPracticeItems(k).length;
    const row = el(`<button class="bp-cat" ${n ? '' : 'disabled'}><span class="bp-cat-id">${SIM_SECTIONS[k].abbr}</span><span class="bp-cat-title">${esc(MCAT.outline.sections[k].name)}</span><span class="bp-cat-stat">${n} q</span></button>`);
    if (n) row.addEventListener('click', () => startSim([k]));
    secs.appendChild(row);
  });
  main.querySelector('#full').addEventListener('click', () => startSim(['chemPhys', 'cars', 'bioBiochem', 'psychSoc']));
  main.querySelector('#back').addEventListener('click', renderMCAT);
  const rb = resumeBtn('sim');
  if (rb) { const sb = main.querySelector('.endbtns'); if (sb) sb.prepend(rb); }
  root.appendChild(main); setView(root);
}
function simPool(secKey) {
  if (secKey === 'cars') {
    const groups = MCAT.cars.map(p => p.questions.map(q => ({ q, passageId: p.id, passageText: p.text, passageTitle: p.title })));
    return shuffleArr(groups).flat();
  }
  // science: passage sets (kept together) first, then discretes — like a real section
  const groups = MCAT.sci.filter(p => p.section === secKey).map(p => p.questions.map(q => ({ q, passageId: p.id, passageText: p.text, passageTitle: p.title, table: p.table, contentNote: p.contentNote })));
  const passageItems = shuffleArr(groups).flat();
  const discretes = shuffleArr(MCAT.questions.filter(q => q.section === secKey)).slice(0, 15).map(q => ({ q }));
  return passageItems.concat(discretes);
}
function simPracticeItems(key) {
  const pool = simPool(key), chosen = [], passageLimit = key === 'cars' ? 30 : 25;
  const groups = new Map();
  pool.filter(it => it.passageId).forEach(it => { if (!groups.has(it.passageId)) groups.set(it.passageId, []); groups.get(it.passageId).push(it); });
  for (const group of groups.values()) { if (chosen.length && chosen.length + group.length > passageLimit) break; chosen.push(...group); }
  return chosen.concat(pool.filter(it => !it.passageId).slice(0, key === 'cars' ? 0 : 15));
}
function startSim(sectionKeys) {
  const saved = loadResume('sim');
  if (saved?.queue?.length && !saved.finishedAt) { RESUME_SPECS.find(s => s.key === 'sim').resume(saved); return; }
  const queue = sectionKeys.map(k => ({ key:k, items:simPracticeItems(k) })).filter(s => s.items.length);
  if (!queue.length) return renderSimHome();
  sim = { queue, attemptId:studyAttemptId(), si:0, idx:0, answers:{}, flags:{}, deadline:0, results:[] };
  beginSection();
}
function beginSection() {
  const s = sim.queue[sim.si];
  sim.onBreak = false;
  const minutes = Math.max(8, Math.round(SIM_SECTIONS[s.key].min * s.items.length / (s.key === 'cars' ? 53 : 59)));
  sim.sectionDurationMs = minutes * 60000; sim.deadline = nowTs() + sim.sectionDurationMs; sim.idx = 0;
  if (simTimerId) clearInterval(simTimerId); simTimerId = setInterval(simTick, 500);
  renderSimQ();
}
function simTick() { if (!sim) return; const left = (sim.deadline - nowTs()) / 1000; const t = document.getElementById('sim-timer'); if (t) { t.textContent = fmtTime(left); t.classList.toggle('warn', left <= 300 && left > 60); t.classList.toggle('crit', left <= 60); } if (left <= 0) { submitSection(); } }
function renderSimQ() {
  const s = sim.queue[sim.si], it = s.items[sim.idx], q = it.q;
  const key = sim.si + ':' + sim.idx;
  const chosen = sim.answers[key];
  sim.seen ||= [];if(!sim.seen.includes(key))sim.seen.push(key);
  saveResume('sim', sim);
  const root = el(`<div>
    ${mcatTaskHeader([SIM_SECTIONS[s.key].abbr, sim.queue.length > 1 ? `Sec ${sim.si + 1}/${sim.queue.length}` : '', `Q ${sim.idx + 1}/${s.items.length}`], `${s.key !== 'cars' ? '<button class="bookmark" id="pt" title="Periodic table" aria-label="Periodic table">PT</button>' : ''}<span class="timer" id="sim-timer"></span>`, '&larr; Quit')}
    <main class="case">
      ${it.passageText ? passageBody(it.passageTitle || 'Passage', it.passageText, it.table, it.contentNote) : ''}
      <p class="q">${esc(q.stem)}</p>
      <div class="opts" id="opts">${McatV2Core.optionOrder(q.options,q.displayOrder).map((i,position) => `<button class="opt ${chosen === i ? 'picked' : ''}" data-i="${i}"><span class="key">${'ABCD'[position]}</span><span>${esc(q.options[i])}</span></button>`).join('')}</div>
      <div class="sim-bar">
        <button class="btn" id="flag">${sim.flags[key] ? '&#9873; Flagged' : '&#9872; Flag'}</button>
        <span style="flex:1"></span>
        <button class="btn" id="prev" ${sim.idx === 0 && sim.si === 0 ? 'disabled' : ''}>&larr; Prev</button>
        <button class="btn" id="nav">Navigator</button>
        <button class="btn btn-solid" id="next">${sim.idx + 1 >= s.items.length ? 'Review &amp; end' : 'Next &rarr;'}</button>
      </div>
      <div id="navwrap"></div>
    </main></div>`);
  wireRunHeader(root, () => confirmExit(sim && Object.keys(sim.answers).length > 0, () => { coursePauseTools(); guideLeaveActive('exam', renderSimHome); }));
  root.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => { sim.answers[key] = +b.dataset.i; saveResume('sim',sim); root.querySelectorAll('.opt').forEach(x => x.classList.toggle('picked', x === b)); }));
  root.querySelector('#flag').addEventListener('click', () => { sim.flags[key] = !sim.flags[key]; renderSimQ(); });
  root.querySelector('#prev').addEventListener('click', () => { if (sim.idx > 0) { sim.idx--; renderSimQ(); } });
  root.querySelector('#next').addEventListener('click', () => { if (sim.idx + 1 >= s.items.length) renderSimReview(); else { sim.idx++; renderSimQ(); } });
  root.querySelector('#nav').addEventListener('click', () => toggleNav(root));
  const pt = root.querySelector('#pt'); if (pt) pt.addEventListener('click', periodicModal);
  setView(root); window.scrollTo(0, 0); simTick();
}
function toggleNav(root) {
  const w = root.querySelector('#navwrap');
  if (w.innerHTML) { w.innerHTML = ''; return; }
  const s = sim.queue[sim.si];
  w.innerHTML = `<div class="navgrid">${s.items.map((it, i) => { const k = sim.si + ':' + i; const cls = sim.answers[k] != null ? 'ans' : ''; const fl = sim.flags[k] ? 'fl' : ''; return `<button class="navcell ${cls} ${fl}" data-i="${i}">${i + 1}</button>`; }).join('')}</div>`;
  w.querySelectorAll('.navcell').forEach(c => c.addEventListener('click', () => { sim.idx = +c.dataset.i; renderSimQ(); }));
}
function renderSimReview() {
  const s = sim.queue[sim.si];
  const root = el('<div></div>'); root.appendChild(topbar('mcat'));
  const blank = s.items.filter((_, i) => sim.answers[sim.si + ':' + i] == null).length;
  const flagged = s.items.filter((_, i) => sim.flags[sim.si + ':' + i]).length;
  const main = el(`<main class="panel">
    <div class="hero"><h1>${SIM_SECTIONS[s.key].abbr} review.</h1><p class="sub">${blank} unanswered &middot; ${flagged} flagged. Jump back or submit.</p></div>
    <div class="navgrid" id="ng"></div>
    <div class="endbtns"><button class="btn btn-solid" id="submit">Submit section</button><button class="btn" id="back">Back to questions</button></div>
  </main>`);
  const ng = main.querySelector('#ng');
  ng.innerHTML = s.items.map((it, i) => { const k = sim.si + ':' + i; const cls = sim.answers[k] != null ? 'ans' : ''; const fl = sim.flags[k] ? 'fl' : ''; return `<button class="navcell ${cls} ${fl}" data-i="${i}">${i + 1}</button>`; }).join('');
  ng.querySelectorAll('.navcell').forEach(c => c.addEventListener('click', () => { sim.idx = +c.dataset.i; renderSimQ(); }));
  main.querySelector('#submit').addEventListener('click', submitSection);
  main.querySelector('#back').addEventListener('click', () => { sim.idx = 0; renderSimQ(); });
  root.appendChild(main); setView(root);
}
function submitSection() {
  if (!sim || sim.onBreak || sim.finishedAt) return;
  if (simTimerId) clearInterval(simTimerId); simTimerId = null;
  sim.attemptId ||= studyAttemptId();
  const s = sim.queue[sim.si], t = nowTs();
  let correct = 0;
  s.items.forEach((it, i) => {
    const chosen = sim.answers[s === sim.queue[sim.si] ? sim.si + ':' + i : ''];
    const c = chosen === it.q.answer; if (c) correct++;
    if(QLOG.some(a=>a.attemptId===sim.attemptId&&a.qId===it.q.id))return;
    const cat = s.key === 'cars' ? 'CARS-' + it.q.skill.split('-')[1] : it.q.category;
    QLOG.push({ qId: it.q.id, section: s.key, category: cat, passage:it.passageId, correct:c, unanswered:chosen == null, conf:'unsure', ts:t, sim:true, attemptId:sim.attemptId });
    const old=QHIST[it.q.id];
    QHIST[it.q.id] = { n: (old?.n || 0) + (old?.lastAttemptId===sim.attemptId?0:1), lastAttemptId:sim.attemptId, lastCorrect: c, ts: t };
  });
  saveQ();
  sim.results.push({ key:s.key, sectionIndex:sim.si, correct, total:s.items.length, items:s.items, answers:Object.assign({},sim.answers), elapsedMs:sim.sectionDurationMs == null ? null : Math.max(0,Math.min(sim.sectionDurationMs,sim.sectionDurationMs-Math.max(0,sim.deadline-t))) });
  if (sim.si + 1 < sim.queue.length) { sim.si++; renderBreak(); }
  else { if (typeof bumpStreak === 'function') bumpStreak(); finishSim(); }
}
function renderBreak() {
  const next = sim.queue[sim.si];
  // persist the between-sections state so quitting on the break screen doesn't lose the finished section
  sim.onBreak = true; sim.idx = 0; saveResume('sim', sim);
  const root = el('<div></div>'); root.appendChild(topbar('mcat'));
  const main = el(`<main class="panel"><section class="anat-results" style="border:0">
    <span class="label">Break</span>
    <div class="score">${sim.si}<span class="of">/${sim.queue.length} sections done</span></div>
    <div class="anat-pct">Next up: ${SIM_SECTIONS[next.key].abbr} &middot; ${next.items.length} questions. Rest, then continue when ready.</div>
    <div class="endbtns"><button class="btn btn-solid" id="go">Begin ${SIM_SECTIONS[next.key].abbr}</button><button class="btn" id="stop">End here</button></div>
  </section></main>`);
  main.querySelector('#go').addEventListener('click', beginSection);
  main.querySelector('#stop').addEventListener('click', () => { if (typeof bumpStreak === 'function') bumpStreak(); finishSim(); });
  root.appendChild(main); setView(root);
}
function finishSim() {
  if (simTimerId) clearInterval(simTimerId); simTimerId = null;
  const complete = sim.results.length === sim.queue.length;
  const guided = !sim.archived && complete && guideCompleteActiveTask('exam');
  if (!sim.archived) { courseArchiveExam(sim); clearResume('sim'); }

  const tot = sim.results.reduce((a, r) => a + r.total, 0), cor = sim.results.reduce((a, r) => a + r.correct, 0);
  const root = el('<div></div>'); root.appendChild(topbar('mcat'));
  const secRows = sim.results.map(r => `<div class="calib-row"><span class="cl">${SIM_SECTIONS[r.key].abbr}</span><span class="cbar"><i style="width:${Math.round(100 * r.correct / r.total)}%"></i></span><span class="cv">${r.correct}/${r.total}</span></div>`).join('');
  const main = el(`<main class="panel"><section class="summary" style="border:0;margin-top:8px">
    <span class="label">${complete ? 'Practice complete' : 'Partial practice run'}</span>
    <div class="score">${Math.round(100 * cor / tot)}<span class="of">% &middot; ${cor}/${tot}</span></div>
    <div class="calib"><span class="label">By section</span>${secRows}</div>
    <div class="drill-review" id="dr"></div>
    <div class="endbtns">${guided ? '<button class="btn btn-solid" id="guide">Continue today\'s plan &rarr;</button>' : ''}<button class="btn ${guided ? '' : 'btn-solid'}" id="again">New sim</button><button class="btn" id="lab">Mistake Lab</button><button class="btn" id="home">&larr; MCAT</button></div>
  </section></main>`);
  const dr = main.querySelector('#dr'); dr.innerHTML = `<span class="label">Review</span>`;
  sim.results.forEach(r => r.items.forEach((it, i) => {
    const chosen = r.answers[sim.results.indexOf(r) + ':' + i];
    const c = chosen === it.q.answer;
    dr.innerHTML += `<details class="rev" ${c ? '' : 'open'}><summary><span class="${c ? 'ok' : 'no'}">${c ? '&#10003;' : '&#10007;'}</span> ${SIM_SECTIONS[r.key].abbr} Q${i + 1}. ${esc(it.q.stem.slice(0, 80))}&hellip;</summary><div class="rev-body"><div class="rev-ans">You: ${chosen != null ? McatV2Core.optionLabel(it.q,chosen) : '—'} &middot; Correct: <b>${McatV2Core.optionLabel(it.q,it.q.answer)}</b></div><p>${esc(it.q.explanation)}</p>${courseRelatedLinks(it.q.id)}</div></details>`;
  }));
  if (guided) main.querySelector('#guide').addEventListener('click', renderGuide);
  courseExamReviewControls(main,sim);
  main.querySelector('#again').addEventListener('click', renderSimHome);
  main.querySelector('#lab').addEventListener('click', renderMistakeLab);
  main.querySelector('#home').addEventListener('click', renderMCAT);
  root.appendChild(main); setView(root); window.scrollTo(0, 0);
}
function periodicModal() {
  const m = el(`<div class="modal" id="ptm"><div class="modal-box"><div class="modal-head"><span class="label">Periodic table</span><button class="btn" id="close">Close</button></div><img src="assets/periodic-table.svg" alt="Periodic table" style="max-width:100%;display:block" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><p style="display:none;color:var(--dim);font-size:13px">Periodic table image unavailable offline.</p></div></div>`);
  m.addEventListener('click', e => { if (e.target.id === 'ptm' || e.target.id === 'close') m.remove(); });
  document.body.appendChild(m);
}

/* ---------- Guide Engine ---------- */
const GUIDE_PLAN_VERSION = 2;
const TRACKS = {
  '120': { label: '120-day steady', days: 120, newCards: 10, questions: 10, minutes: '60–90 min/day', carsDays: [1, 2, 4, 6], passageDays: [3, 6] },
  '90': { label: '90-day focused', days: 90, newCards: 15, questions: 12, minutes: '90–120 min/day', carsDays: [1, 2, 4, 5, 6], passageDays: [2, 4, 6] },
  '60': { label: '60-day intensive', days: 60, newCards: 20, questions: 15, minutes: '2–3 hr/day', carsDays: [1, 2, 3, 4, 5, 6], passageDays: [2, 3, 5, 6] },
};
const TRACK_ORDER = ['120', '90', '60'];

function guideDateKey(date = new Date()) {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function guideDateFromKey(key) {
  const [y, m, d] = String(key || '').split('-').map(Number);
  return new Date(y, Math.max(0, (m || 1) - 1), d || 1);
}
function guideAddDays(key, days) { const d = guideDateFromKey(key); d.setDate(d.getDate() + days); return guideDateKey(d); }
function guideFormatDate(key) { return guideDateFromKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
function saveGuidePlan(plan) { return McatStorage.write('cs-mcat-plan',plan); }
function guidePlan() {
  const raw = McatStorage.read('cs-mcat-plan',null);
  if (!raw) return null;
  if (raw.version === GUIDE_PLAN_VERSION && TRACKS[raw.track]) return raw;
  const migrated = buildPlan(TRACKS[raw.track] ? raw.track : '120');
  saveGuidePlan(migrated);
  return migrated;
}
function guideClearActiveTask() {
  const plan = guidePlan();
  if (!plan || !plan.active) return;
  delete plan.active;
  saveGuidePlan(plan);
}
function guidePlanDay(plan) {
  const start = guideDateFromKey(plan.startDate);
  const today = guideDateFromKey(guideDateKey());
  const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const day = Math.floor((todayUTC - startUTC) / DAY) + 1;
  return Math.max(1, plan.flexible ? day : Math.min(plan.durationDays, day));
}
function guidePhase(plan, day) {
  if (plan.flexible) return 'Build';
  if (day > plan.durationDays - 2) return 'Taper';
  if (day > plan.durationDays - 21) return 'Exam prep';
  return 'Build';
}
function guideCategories() {
  const out = [];
  if (!MCAT.outline) return out;
  MCAT.outline.concepts.filter(c => c.section !== 'cars').forEach(c => c.categories.forEach(cat => out.push({ id: cat.id, title: cat.title, section: c.section })));
  return out;
}
function guideWeakCategory() {
  const byCat = {};
  QLOG.filter(x => x.section !== 'cars').forEach(x => { (byCat[x.category] ||= { n: 0, c: 0 }).n++; if (x.correct) byCat[x.category].c++; });
  const weak = Object.entries(byCat).filter(([, v]) => v.n >= 2).map(([id, v]) => ({ id, n: v.n, acc: Math.round(100 * v.c / v.n) })).sort((a, b) => a.acc - b.acc || b.n - a.n)[0];
  return weak && weak.acc < 70 ? guideCategories().find(c => c.id === weak.id) || null : null;
}
function guideFocusCategory(plan, day) {
  const cats = guideCategories();
  if (!cats.length) return null;
  const weak = day % 4 === 0 ? guideWeakCategory() : null;
  if (weak) return Object.assign({ adaptive: true }, weak);
  if (plan.flexible) return Object.assign({ adaptive: false }, cats[Math.floor((day - 1) / 3) % cats.length]);
  const contentDays = Math.max(1, plan.durationDays - 21);
  const index = Math.min(cats.length - 1, Math.floor((Math.min(day, contentDays) - 1) * cats.length / contentDays));
  return Object.assign({ adaptive: false }, cats[index]);
}
function guideTaskKey(day, id) { return `${day}:${id}`; }
function guideTaskDone(plan, day, id) { return !!(plan.completed && plan.completed[guideTaskKey(day, id)]); }
function guideDayTasks(plan, day) {
  const track = TRACKS[plan.track];
  const phase = guidePhase(plan, day);
  const focus = guideFocusCategory(plan, day);
  const weekday = ((day - 1) % 7) + 1;
  const tasks = [];
  const add = task => tasks.push(Object.assign({ day, category: focus?.id || null, section: focus?.section || 'bioBiochem' }, task));

  if (phase === 'Taper') {
    add({ id: 'flash', type: 'flash', title: 'Due flashcards', desc: 'Review only what is due. Add no new material.', meta: 'Due cards · about 15 min', newCards: 0 });
    add({ id: 'drill', type: 'drill', title: 'Light weak-area review', desc: focus ? `${focus.id} · ${focus.title}` : 'Review the weakest tested category', meta: '10 questions · untimed', questions: 10 });
    return tasks;
  }

  if (phase === 'Exam prep') {
    add({ id: 'flash', type: 'flash', title: 'Due flashcards', desc: 'Keep older material retrievable without adding much new content.', meta: 'Due cards · about 20 min', newCards: 0 });
    add({ id: 'drill', type: 'drill', title: focus?.adaptive ? 'Weak-area repair' : 'Mixed weak-area drill', desc: focus ? `${focus.id} · ${focus.title}` : 'Target recent misses', meta: '20 questions · review every miss', questions: 20 });
    if (weekday !== 7) add({ id: 'cars', type: 'cars', title: 'CARS passage', desc: 'One passage with full answer review.', meta: '1 passage · untimed first' });
    if ((day - (plan.durationDays - 20)) % 7 === 0) {
      const sections = ['chemPhys', 'bioBiochem', 'psychSoc', 'cars'];
      const section = sections[Math.floor((day - (plan.durationDays - 20)) / 7) % sections.length];
      add({ id: 'exam', type: 'exam', title: `${SEC_ABBR[section]} section simulation`, desc: 'Practice under the same no-feedback conditions as test day.', meta: 'Timed section', section });
    } else if (weekday % 2 === 0) {
      add({ id: 'passage', type: 'passage', title: 'Science passage', desc: 'Read the experiment, work the data, then review every answer.', meta: '1 passage · about 20 min' });
    }
    return tasks;
  }

  add({ id: 'flash', type: 'flash', title: 'Focused flashcards', desc: focus ? `${focus.id} · ${focus.title}` : 'New and due cards', meta: `${track.newCards} new + anything due`, newCards: track.newCards });
  add({ id: 'drill', type: 'drill', title: focus?.adaptive ? 'Weak-area drill' : 'Focused question drill', desc: focus ? `${focus.id} · ${focus.title}` : 'Current content block', meta: `${track.questions} questions · full review`, questions: track.questions });
  if (track.carsDays.includes(weekday)) add({ id: 'cars', type: 'cars', title: 'CARS passage', desc: 'Read for structure and justify every answer from the text.', meta: '1 passage · about 15 min' });
  if (track.passageDays.includes(weekday)) add({ id: 'passage', type: 'passage', title: 'Science passage', desc: `Apply ${focus ? focus.id : 'today’s content'} to an experiment or data set.`, meta: '1 passage · about 20 min' });
  return tasks;
}
function guideLeastAttempted(list) {
  if (!list.length) return null;
  return list.slice().sort((a, b) => QLOG.filter(x => x.passage === a.id).length - QLOG.filter(x => x.passage === b.id).length || a.id.localeCompare(b.id))[0];
}
function guideResumeSpec(type) {
  const key = { flash: 'flash', drill: 'drill', cars: 'cars', passage: 'plab', exam: 'sim' }[type];
  return key ? RESUME_SPECS.find(spec => spec.key === key) || null : null;
}
function guideStartTask(task, plan) {
  if (plan.active && plan.active.day === task.day && plan.active.id === task.id && plan.active.type === task.type) {
    const spec = guideResumeSpec(task.type);
    const resume = spec ? loadResume(spec.key) : null;
    if (spec && resume) {
      try { spec.resume(resume); return; } catch { McatStorage.sessionFailed(); return; }
    }
  }
  plan.active = { ...task };
  studyTouch(plan);
  if (task.type === 'flash') { startFlash('all', task.newCards, task.limitDue ?? 60, task.category, task.limitCards ?? Infinity); return; }
  if (task.type === 'drill') {
    let pool = MCAT.questions.filter(q => q.category === task.category);
    if (pool.length < task.questions) pool = MCAT.questions.filter(q => q.section === task.section);
    if (!pool.length) pool = MCAT.questions;
    drill = { qs: shuffleArr(pool).slice(0, Math.min(task.questions, pool.length)), idx: 0, mode: 'standard', results: [], scope: task.category || task.section };
    renderDrillQ(); return;
  }
  if (task.type === 'cars') { const passage = guideLeastAttempted(MCAT.cars); if (passage) startCars(passage, true); else { guideClearActiveTask(); renderGuide(); } return; }
  if (task.type === 'passage') {
    const sectionPool = MCAT.sci.filter(p => p.section === task.section);
    const passage = guideLeastAttempted(sectionPool.length ? sectionPool : MCAT.sci);
    if (passage) startPassage(passage, false); else { guideClearActiveTask(); renderGuide(); }
    return;
  }
  if (task.type === 'exam') { startSim([task.section]); return; }
}
function guideCompleteActiveTask(expectedType) {
  const plan = guidePlan();
  if (!plan?.active || plan.active.type !== expectedType) return false;
  plan.completed ||= {};
  plan.completed[guideTaskKey(plan.active.day, plan.active.id)] = nowTs();
  delete plan.active;
  studyTouch(plan);
  return true;
}
function guideLeaveActive(expectedType, fallback) {
  const plan = guidePlan();
  if (!plan?.active || plan.active.type !== expectedType) { fallback(); return; }
  renderGuide();
}
function buildPlan(track) {
  const config = TRACKS[track] || TRACKS['120'];
  const startDate = guideDateKey();
  const plan = {
    version: GUIDE_PLAN_VERSION,
    track,
    label: config.label,
    durationDays: config.days,
    startDate,
    targetDate: guideAddDays(startDate, config.days - 1),
    completed: {},
    weeks: [],
  };
  const cats = guideCategories();
  const weekCount = Math.ceil(config.days / 7);
  for (let w = 0; w < weekCount; w++) {
    const firstDay = w * 7 + 1, lastDay = Math.min(config.days, firstDay + 6);
    const ids = [];
    for (let day = firstDay; day <= lastDay; day++) {
      const focus = guideFocusCategory(plan, day);
      if (focus && !ids.includes(focus.id)) ids.push(focus.id);
    }
    const phase = guidePhase(plan, firstDay);
    const titles = ids.map(id => cats.find(c => c.id === id)).filter(Boolean).map(c => `${c.id} ${c.title}`);
    const note = phase === 'Build' ? titles.join(' · ') : phase === 'Taper' ? 'Light review, sleep, logistics, and confidence.' : 'Section practice, weak-area repair, daily recall, and passage review.';
    plan.weeks.push({ n: w + 1, firstDay, lastDay, phase, focus: ids, note });
  }
  return plan;
}
function showPlan(host, plan) {
  host.innerHTML = plan.weeks.map(w => `<div class="guide-week"><span class="guide-week-num">Week ${w.n}</span><span class="guide-week-days">Days ${w.firstDay}–${w.lastDay}</span><strong>${w.phase}</strong><p>${esc(w.note)}</p></div>`).join('');
}
function buildFlexiblePlan(minutes = 15) {
  const plan = buildPlan('120');
  plan.flexible = true;
  plan.label = 'Flexible study';
  plan.dailyMinutes = [15,30,60].includes(minutes) ? minutes : 15;
  plan.targetDate = '';
  plan.weeks = [];
  return plan;
}
function renderGuide(useOriginal = false) {
  coursePauseTools();
  if(useOriginal !== true && typeof v2State !== 'undefined' && v2State.weekly.configured)return renderV2Today();
  const existing = guidePlan();
  const root = el('<div></div>'); root.appendChild(topbar('mcat'));

  if (!existing) {
    const defaultTrack = '120';
    const main = el(`<main class="panel guide-page today-page guide-welcome">
      <header class="guide-day-hero"><span class="label">YOUR FIRST STEP / MCAT</span><h1>Start your session.</h1><p>Learn one idea, check your understanding, and save your place for next time.</p></header>
      <section class="study-session" aria-label="Your first study session">
        <div class="study-time-picker"><span class="label">Time today</span><div class="study-budgets" role="group" aria-label="Time available today">${[15,30,60].map(n=>`<button class="btn" data-first-minutes="${n}" aria-pressed="${n===15}">${n} min</button>`).join('')}</div></div>
        <div id="first-session-preview" aria-live="polite"></div>
        <button class="btn btn-solid" id="first-start">Start my session →</button>
        <p id="first-session-detail" class="repair-fine"></p>
        <p class="study-budget-note">Pause whenever you need to. You can set a weekly schedule or test date later.</p>
      </section>
      <p class="study-save-help">Your work saves in this browser. Return here to resume. Optional sign-in adds account sync; guest work stays separate until you choose to copy it into your account.</p>
      <div class="today-library"><button class="ghostbtn" id="back">Browse all study tools ↗</button></div>
      <details class="guide-schedule" id="guide-other-starts"><summary><span><strong>Other ways to start</strong><small>Choose a lesson, find your starting point, or try a five-minute concept</small></span><i>Open</i></summary><div id="course-today"></div><div id="guide-first-repair"></div></details>
      <details class="guide-schedule" id="guide-reference-options"><summary><span><strong>Choose a reference schedule</strong><small>Optional 60-, 90-, or 120-day outline</small></span><i>Open</i></summary>
      <p class="repair-fine">These dated outlines suggest a pace. Your daily session can still fit the time you have; finishing the schedule does not guarantee full content coverage.</p>
      <div class="guide-track-list">
        ${TRACK_ORDER.map(key => { const track = TRACKS[key]; return `<button class="guide-track ${key === defaultTrack ? 'active' : ''}" data-track="${key}" aria-pressed="${key===defaultTrack}"><span><strong>${track.label}</strong><small>Reference pace: ${track.minutes}</small></span><span>Target ${guideFormatDate(guideAddDays(guideDateKey(), track.days - 1))}</span></button>`; }).join('')}
      </div>
      <div class="guide-setup-actions"><button class="btn" id="begin">Start the 120-day plan &rarr;</button><span>Starting today · progress stays in this browser</span></div>
      </details>
    </main>`);
    let minutes = 15;
    const preview = () => {
      const session = studyBuildSession(buildFlexiblePlan(minutes), minutes), next = session.tasks[0];
      main.querySelector('#first-session-preview').innerHTML = next ? `<div class="study-next-step"><span class="label">${next.resume?'SAVED WORK':'UP FIRST'} · About ${next.minutes} min</span><h2>${esc(next.title)}</h2><p>${esc(next.desc || '')}</p></div>` : '<p role="status">Study activities could not load. Reload to try again, or browse your saved work below.</p>';
      main.querySelector('#first-session-detail').textContent = next ? `${session.tasks.length} ${session.tasks.length===1?'activity':'activities'} · About ${session.tasks.reduce((n,t)=>n+t.minutes,0)} minutes including review` : '';
      main.querySelector('#first-start').disabled = !next;
      main.querySelector('#first-start').textContent = next?.resume ? 'Resume my session →' : 'Start my session →';
    };
    main.querySelectorAll('[data-first-minutes]').forEach(button=>button.onclick=()=>{
      minutes = Number(button.dataset.firstMinutes);
      main.querySelectorAll('[data-first-minutes]').forEach(item=>item.setAttribute('aria-pressed', String(item===button)));
      preview();
    });
    main.querySelector('#first-start').onclick = () => {
      const plan = guidePlan() || buildFlexiblePlan(minutes);
      const session = studyDailySession(plan, minutes);
      const next = session.tasks.find(t=>!guideTaskDone(plan,t.day,t.id));
      if(next) studyLaunchTask(next,plan); else renderGuide();
    };
    preview();
    courseToday(main.querySelector('#course-today'),true);
    v2Today(main.querySelector('#course-today'),true);
    mountRepairDashboard(main.querySelector('#guide-first-repair'), false);
    let track = defaultTrack;
    main.querySelectorAll('[data-track]').forEach(button => button.addEventListener('click', () => {
      track = button.dataset.track;
      main.querySelectorAll('[data-track]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed',String(item===button)); });
      main.querySelector('#begin').textContent = `Start the ${track}-day plan →`;
    }));
    main.querySelector('#begin').addEventListener('click', () => { saveGuidePlan(buildPlan(track)); renderGuide(); });
    main.querySelector('#back').addEventListener('click', renderMCAT);
    root.appendChild(main); mcatWorkspace(root,'today'); studySetView(root); window.scrollTo(0, 0); return;
  }

  const plan = existing;
  const day = guidePlanDay(plan);
  const tasks = guideDayTasks(plan, day);
  const done = tasks.filter(task => guideTaskDone(plan, day, task.id)).length;
  const activeTask = tasks.find(task => !guideTaskDone(plan, day, task.id)
    && plan.active?.day === day && plan.active?.id === task.id && plan.active?.type === task.type);
  const nextTask = activeTask || tasks.find(task => !guideTaskDone(plan, day, task.id));
  const phase = guidePhase(plan, day);
  const focus = guideFocusCategory(plan, day);
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 100;
  const calendarStart = guideDateFromKey(plan.startDate), calendarNow = new Date();
  const elapsedDays = Math.max(0, (Date.UTC(calendarNow.getFullYear(), calendarNow.getMonth(), calendarNow.getDate()) - Date.UTC(calendarStart.getFullYear(), calendarStart.getMonth(), calendarStart.getDate())) / DAY);
  const calendarPct = Math.round(Math.min(1, elapsedDays / plan.durationDays) * 100);
  const completedWork = Object.values(plan.completed || {}).filter(Boolean).length;
  const main = el(`<main class="panel guide-page today-page">
    <header class="guide-day-hero">
      <span class="label">${esc(plan.label)} &middot; Day ${day}${plan.flexible?'':` of ${plan.durationDays}`}</span>
      <h1>Today’s MCAT plan</h1>
      <p>Choose your time. Take the next step. Pick up where you leave off.</p>

    </header>
    <div id="guide-daily-session"></div>
    <div class="today-library"><button class="ghostbtn" id="back">All study tools ↗</button></div>
    <div id="course-today" class="today-support"></div>
    <details class="guide-schedule"><summary><span><strong>Concept repair &amp; learning evidence</strong><small>All ten concepts and scheduled follow-up checks</small></span><i>Open</i></summary><div id="guide-repair"></div></details>
    ${plan.flexible?'':`<details class="guide-schedule guide-original"><summary><span><strong>Original track assignments</strong><small>Optional extra work from your ${plan.track}-day schedule</small></span><i>Open</i></summary>
    <section class="guide-today">
      <p class="repair-fine">${phase} &middot; Week ${Math.ceil(day / 7)}${focus ? ` &middot; ${focus.adaptive ? 'Weak-area review' : 'Focus'}: ${focus.id} ${esc(focus.title)}` : ''}</p>
      <div class="guide-section-head"><span class="label">Today</span><span>Target date ${guideFormatDate(plan.targetDate)} &middot; Schedule elapsed: ${calendarPct}%</span></div>
      ${nextTask ? `<button class="btn btn-solid" id="guide-next">${activeTask ? 'Resume current task' : 'Start next task'} &rarr;</button>` : '<div class="guide-day-done">Your planned assignments are complete. Continue a focus session or return tomorrow.</div>'}
      <div class="guide-task-list">${tasks.map((task, index) => {
        const completed = guideTaskDone(plan, day, task.id);
        return `<button class="guide-task ${completed ? 'done' : ''}" data-guide-task="${task.id}" ${completed ? 'disabled' : ''}>
          <span class="guide-task-num">${completed ? '&#10003;' : String(index + 1).padStart(2, '0')}</span>
          <span class="guide-task-copy"><strong>${esc(task.title)}</strong><span>${esc(task.desc)}</span></span>
          <span class="guide-task-meta">${esc(task.meta)}</span><span class="guide-task-go">${completed ? 'Done' : '&rarr;'}</span>
        </button>`;
      }).join('')}</div>
    </section>
    </details>
    <details class="guide-schedule"><summary><span><strong>Full ${plan.track}-day schedule</strong><small>${plan.weeks.length} weeks · content, review, exams, and taper</small></span><i>Open</i></summary><div class="guide-week-list" id="guide-weeks"></div></details>
    <p class="repair-fine">${completedWork} ${completedWork === 1 ? "assignment" : "assignments"} completed in this plan. Calendar time and assignment completion do not measure understanding.</p>
    <div class="guide-plan-actions"><button class="ghostbtn" id="restart">Change or restart plan</button></div>`}
  </main>`);
  courseToday(main.querySelector('#course-today'),true);
  v2Today(main.querySelector('#course-today'),true);
  mountDailySession(main.querySelector('#guide-daily-session'),plan);
  mountRepairDashboard(main.querySelector('#guide-repair'));
  const launch = task => studyLaunchTask(task, guidePlan());
  if (nextTask) main.querySelector('#guide-next')?.addEventListener('click', () => launch(nextTask));
  main.querySelectorAll('[data-guide-task]').forEach(button => button.addEventListener('click', () => {
    const task = tasks.find(item => item.id === button.dataset.guideTask);
    if (task) launch(task);
  }));
  if(!plan.flexible) showPlan(main.querySelector('#guide-weeks'), plan);
  main.querySelector('#restart')?.addEventListener('click', () => {
    if (!confirm('Restart your guided MCAT plan? Completed plan days will be cleared. Your flashcard and question history will stay.')) return;
    McatStorage.remove('cs-mcat-plan');
    Object.values(courseState.units).forEach(r => delete r.guideTask); saveCourse();
    // Keep unfinished study work, but detach assignments from the retired calendar.
    RESUME_SPECS.forEach(spec => { const saved=loadResume(spec.key); if (saved?.guideTask) { delete saved.guideTask; saveResume(spec.key,saved); } });
    if (repairState?.active?.guideTask) { delete repairState.active.guideTask; saveMcatRepair(); }
    renderGuide();
  });
  main.querySelector('#back').addEventListener('click', renderMCAT);
  root.appendChild(main); mcatWorkspace(root,'today'); studySetView(root); window.scrollTo(0, 0);
}

/* ---------- Course Mapper ---------- */
function mapperState() { return McatStorage.read('cs-mcat-coursework', {}); }
function renderMapper() {
  if (!MCAT.outline) return renderMCAT();
  const state = mapperState();
  const root = el('<div></div>'); root.appendChild(topbar('mcat'));
  const main = el(`<main class="panel">
    <button class="backbtn topback" id="back">&larr; MCAT</button>
    <div class="hero"><h1>Course Mapper.</h1><p class="sub">Rate each content category by how solid your coursework left you. Get a coverage heat map and a place to start — before you waste a day.</p></div>
    <p class="map-legend"><b>S</b> Strong &nbsp;&middot;&nbsp; <b>O</b> OK &nbsp;&middot;&nbsp; <b>W</b> Weak &mdash; tap to rate each one.</p>
    <div id="map"></div>
    <div class="statblock"><span class="label">Start here (weak / unrated)</span><div id="startlist"></div></div>
  </main>`);
  main.querySelector('#back').addEventListener('click', renderMCAT);
  const map = main.querySelector('#map');
  ['bioBiochem', 'chemPhys', 'psychSoc'].forEach(sk => {
    const sec = MCAT.outline.sections[sk];
    const wrap = el(`<div class="statblock"><span class="label">${sec.abbr} — ${esc(sec.name)}</span><div class="maprows"></div></div>`);
    const mr = wrap.querySelector('.maprows');
    MCAT.outline.concepts.filter(c => c.section === sk).forEach(con => con.categories.forEach(cat => {
      const v = state[cat.id] || '';
      const row = el(`<div class="maprow"><span class="mr-id">${cat.id}</span><span class="mr-title">${esc(cat.title)}</span><span class="mr-rate">${['strong', 'ok', 'weak'].map(r => `<button class="rb ${v === r ? 'on ' + r : ''}" data-cat="${cat.id}" data-r="${r}">${r[0].toUpperCase()}</button>`).join('')}</span></div>`);
      row.querySelectorAll('.rb').forEach(b => b.addEventListener('click', () => { const s = mapperState(); s[b.dataset.cat] = (s[b.dataset.cat] === b.dataset.r) ? '' : b.dataset.r; McatStorage.write('cs-mcat-coursework',s); renderMapper(); }));
      mr.appendChild(row);
    }));
    map.appendChild(wrap);
  });
  // start-here: weak + unrated
  const all = [];
  MCAT.outline.concepts.filter(c => c.section !== 'cars').forEach(c => c.categories.forEach(cat => all.push(cat)));
  const start = all.filter(cat => state[cat.id] === 'weak' || !state[cat.id]).slice(0, 12);
  const sl = main.querySelector('#startlist');
  if (!start.length) sl.innerHTML = '<div class="empty">All rated — nice. Drill your weak ones from the Blueprint.</div>';
  else start.forEach(cat => { const qn = MCAT.questions.filter(q => q.category === cat.id).length; const row = el(`<button class="bp-cat"><span class="bp-cat-id">${cat.id}</span><span class="bp-cat-title">${esc(cat.title)}</span><span class="bp-cat-stat ${state[cat.id] === 'weak' ? 'no' : ''}">${state[cat.id] === 'weak' ? 'weak' : 'unrated'}</span></button>`); if (qn) row.addEventListener('click', () => { drill = { qs: shuffleArr(MCAT.questions.filter(q => q.category === cat.id)).slice(0, 10), idx: 0, mode: 'standard', results: [], scope: cat.id }; renderDrillQ(); }); sl.appendChild(row); });
  root.appendChild(main); setView(root);
}

/* keyboard: flip flashcard on space, answer drills A-D / 1-4, Enter continue */
document.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.querySelector('.modal, .fbmodal-back')) return;   // don't drive the screen behind an open overlay
  if (flash && document.querySelector('.flash-stage')) {
    if (e.key === ' ' && document.querySelector('#flash-back')?.style.display === 'none') { e.preventDefault(); flash._reveal && flash._reveal(); return; }
    const map = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
    if (map[e.key] && document.querySelector('.ratebtn')) { document.querySelector(`.ratebtn.${map[e.key]}`)?.click(); }
    return;
  }
  // Drill: 1–4 or A–D selects an answer. Gated on #conf (drill-only) so it can't leak into the
  // Exam Simulator, which reuses id="opts" (Enter → Next is handled by the global handler in app.js).
  if (drill && document.getElementById('conf') && document.getElementById('opts')) {
    let i = -1;
    if (/^[1-4]$/.test(e.key)) i = +e.key - 1;
    else if (/^[a-dA-D]$/.test(e.key)) i = e.key.toLowerCase().charCodeAt(0) - 97;
    if (i >= 0) {
      const opt = document.querySelectorAll('#opts .opt')[i];
      if (opt && !opt.disabled) { e.preventDefault(); opt.click(); }
    }
    return;
  }
});

function resetMcatState() {
  courseState = McatCourseCore.normalize({});
  repairState = McatRepairCore.empty(); repairSaveFailed = false;
  Object.keys(SRS).forEach(k => delete SRS[k]);
  Object.keys(QHIST).forEach(k => delete QHIST[k]);
  QLOG.length = 0;
  MCAT.loaded = false;
  MCAT.outline = null; MCAT.cards = []; MCAT.questions = []; MCAT.cars = []; MCAT.sci = [];
  RESUME_SPECS.forEach(s => clearResume(s.key));
  if (simTimerId) clearInterval(simTimerId);
  simTimerId = null; sim = null; drill = null; flash = null; cars = null; plab = null;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('cs-mcat')) keys.push(k);
  }
  keys.forEach(k => McatStorage.remove(k));
}
window.renderMCAT = renderMCAT;
window.renderMCATEntry = renderMCATEntry;
window.resetMcatState = resetMcatState;

window.addEventListener('pagehide', () => { if (sim && simTimerId) saveResume('sim',sim); });
let mcatPausedTimers=[];
window.addEventListener('mcat-storage-paused',()=>{
  if(typeof v2Clock!=='undefined'&&v2Clock){v2Tick();v2Clock=null;v2Save();}
  for(const [key,run] of [['cars',cars],['plab',plab]])if(run?.timerId){mcatPausedTimers.push({key,run,remaining:Math.max(0,run.deadline-nowTs())});clearInterval(run.timerId);run.timerId=null;saveResume(key,run);}
  if(sim&&simTimerId){mcatPausedTimers.push({key:'sim',run:sim,remaining:Math.max(0,sim.deadline-nowTs())});clearInterval(simTimerId);simTimerId=null;saveResume('sim',sim);}
});
window.addEventListener('mcat-storage-recovered',()=>{
  courseSaveFailed=false;courseExamSaveFailed=false;repairSaveFailed=false;v2SaveFailed=false;
  const note=document.querySelector('#course-note-status');if(note)note.textContent='Saved in this browser.';
  const status=document.querySelector('#v2-save-status');if(status)status.textContent='Your work is saved in this browser. Signed-in sync follows your account settings.';
  for(const {key,run,remaining} of mcatPausedTimers){
    if(key==='sim'&&sim===run&&!run.finishedAt&&document.querySelector('#sim-timer')){run.deadline=nowTs()+remaining;simTimerId=setInterval(simTick,500);}
    if(key==='cars'&&cars===run&&run.phase==='attempt'&&document.querySelector('#cars-timer')){run.deadline=nowTs()+remaining;run.timerId=setInterval(carsTick,500);}
    if(key==='plab'&&plab===run&&run.phase==='attempt'&&document.querySelector('#plab-timer')){run.deadline=nowTs()+remaining;run.timerId=setInterval(plabTick,500);}
  }
  mcatPausedTimers=[];
  const activity=document.querySelector('[data-v2-activity]');if(activity)v2BeginActivity(activity.dataset.v2Activity,activity.dataset.v2Key);
});
