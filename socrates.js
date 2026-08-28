/* Cortex — Socrates: guided Socratic dialogues.
   Each topic is a chain of steps: a probing question → optional hint → your attempt → model answer + why.
   The last step is always a teach-back ("explain it in your own words"). */

const SOC = { dialogues: [], loaded: false, byDisc: {} };
const SOC_DONE = (typeof loadJSON === 'function') ? loadJSON('cs-socrates', {}) : {};
function saveSocDone() { localStorage.setItem('cs-socrates', JSON.stringify(SOC_DONE)); }

const LTL = { tracks: [], sources: [], loaded: false, byId: {}, sourceById: {} };
const LTL_PROGRESS = (typeof loadJSON === 'function') ? loadJSON('cs-ltl-progress-v1', {}) : {};
function saveLtlProgress() {
  if (typeof safeSet === 'function') safeSet('cs-ltl-progress-v1', JSON.stringify(LTL_PROGRESS));
  else localStorage.setItem('cs-ltl-progress-v1', JSON.stringify(LTL_PROGRESS));
}
function ltlProgress(trackId) {
  const current = LTL_PROGRESS[trackId];
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    LTL_PROGRESS[trackId] = { completed: [], lastLesson: null, lastStep: 0 };
  }
  if (!Array.isArray(LTL_PROGRESS[trackId].completed)) LTL_PROGRESS[trackId].completed = [];
  return LTL_PROGRESS[trackId];
}
function ltlCompleted(trackId, lessonId) {
  return ltlProgress(trackId).completed.includes(lessonId);
}
function ltlLessonUnlocked(track, index) {
  return index === 0 || ltlCompleted(track.id, track.lessons[index - 1].id);
}
function ltlNextLesson(track) {
  const progress = ltlProgress(track.id);
  const saved = track.lessons.find(l => l.id === progress.lastLesson && !ltlCompleted(track.id, l.id));
  return saved || track.lessons.find(l => !ltlCompleted(track.id, l.id)) || track.lessons[track.lessons.length - 1];
}

async function loadLearnCourses() {
  if (LTL.loaded) return;
  try {
    const d = await fetch('data/learn-to-learn.json?v=3').then(r => r.ok ? r.json() : null);
    LTL.tracks = d?.tracks || [];
    LTL.sources = d?.sources || [];
  } catch {
    LTL.tracks = [];
    LTL.sources = [];
  }
  LTL.byId = Object.fromEntries(LTL.tracks.map(track => [track.id, track]));
  LTL.sourceById = Object.fromEntries(LTL.sources.map(source => [source.id, source]));
  LTL.loaded = true;
}

async function loadSocrates() {
  if (SOC.loaded) return;
  try {
    const d = await fetch('data/socrates.json').then(r => r.ok ? r.json() : []).catch(() => []);
    SOC.dialogues = d || [];
  } catch { SOC.dialogues = SOC.dialogues || []; }
  SOC.byDisc = {};
  for (const dlg of SOC.dialogues) (SOC.byDisc[dlg.discipline] = SOC.byDisc[dlg.discipline] || []).push(dlg);
  SOC.loaded = true;
}
function discName(key) { return (SOC.byDisc[key] && SOC.byDisc[key][0]?.disciplineName) || key; }

/* ---------- hub ---------- */
async function renderSocrates() {
  if (typeof stopTimer === 'function') stopTimer();
  if (typeof session !== 'undefined') session = null;
  await Promise.all([loadLearnCourses(), loadSocrates()]);

  const root = el('<div></div>');
  root.appendChild(topbar('socrates'));
  const total = SOC.dialogues.length;
  const done = SOC.dialogues.filter(d => SOC_DONE[d.id]).length;
  const main = el(`<main class="panel ltl-shell">
    <section class="ltl-hero">
      <div class="ltl-hero-top"><span class="label">Learn better</span><span class="ltl-count">${String(LTL.tracks.length).padStart(2, '0')} courses</span></div>
      <h1>Learn to Learn.</h1>
      <p class="sub">Learn how to remember more, understand difficult ideas, practice effectively, and improve when something does not work.</p>
    </section>
    <section class="ltl-chooser" aria-labelledby="ltl-choose-title">
      <div class="ltl-section-head">
        <div><span class="label">Choose a course</span><h2 id="ltl-choose-title">Start with the kind of learning you do.</h2></div>
        <p>All three courses teach the same core skills. The examples and exercises change for everyday learning, business, and medicine.</p>
      </div>
      <div class="ltl-tracks"></div>
    </section>
    <section class="ltl-method">
      <span class="ltl-method-mark" aria-hidden="true">LTL</span>
      <div><span class="label">How every lesson works</span><h2>Learn it. Try it. Use it. Fix it.</h2></div>
      <p>Every lesson explains one idea in plain language, shows an example, checks your understanding, and lets you try it before showing a strong answer.</p>
    </section>
  </main>`);

  const tracks = main.querySelector('.ltl-tracks');
  if (!LTL.tracks.length) tracks.appendChild(el('<div class="empty">The courses could not load. Refresh to try again.</div>'));
  LTL.tracks.forEach(track => {
    const courseDone = track.lessons.filter(lesson => ltlCompleted(track.id, lesson.id)).length;
    const courseStatus = courseDone === track.lessons.length ? 'Course complete' : `${courseDone}/${track.lessons.length} lessons`;
    const card = el(`<button class="ltl-track-card ltl-track-${track.id}" data-track="${track.id}" aria-label="Open Learn to Learn ${esc(track.name)}">
      <span class="ltl-track-top"><span class="ltl-track-no">${track.number}</span><span class="ltl-track-status">${courseStatus}</span></span>
      <span class="ltl-track-copy">
        <span class="ltl-track-eyebrow">${esc(track.eyebrow)}</span>
        <span class="ltl-track-name">${esc(track.name)}</span>
        <span class="ltl-track-desc">${esc(track.intro)}</span>
      </span>
      <span class="ltl-track-tags">${track.topics.map(t => `<span>${esc(t)}</span>`).join('')}</span>
      <span class="ltl-track-open">${courseDone ? 'Continue course' : 'View course'} <span aria-hidden="true">&rarr;</span></span>
    </button>`);
    card.addEventListener('click', () => renderLearnTrack(track.id));
    tracks.appendChild(card);
  });

  root.appendChild(main);
  setView(root);
}

/* ---------- course overview ---------- */
async function renderLearnTrack(trackId) {
  await Promise.all([loadLearnCourses(), loadSocrates()]);
  const track = LTL.byId[trackId];
  if (!track) { renderSocrates(); return; }
  const isMedical = track.id === 'medical';
  const total = SOC.dialogues.length;
  const done = SOC.dialogues.filter(d => SOC_DONE[d.id]).length;
  const pct = total ? Math.round(100 * done / total) : 0;
  const progress = ltlProgress(track.id);
  const completedCount = track.lessons.filter(lesson => ltlCompleted(track.id, lesson.id)).length;
  const coursePct = Math.round(100 * completedCount / track.lessons.length);
  const nextLesson = ltlNextLesson(track);
  const nextIndex = track.lessons.findIndex(lesson => lesson.id === nextLesson.id);
  const resumeStep = nextLesson.id === progress.lastLesson ? Math.max(0, Number(progress.lastStep) || 0) : 0;
  const isComplete = completedCount === track.lessons.length;
  const root = el('<div></div>');
  root.appendChild(topbar('socrates'));
  const main = el(`<main class="panel ltl-shell ltl-path">
    <button class="ltl-back" id="ltlback">&larr; All courses</button>
    <section class="ltl-path-hero">
      <div class="ltl-path-title">
        <span class="ltl-route">Learn to Learn <i>/</i> ${track.number}</span>
        <span class="ltl-track-eyebrow">${esc(track.eyebrow)}</span>
        <h1>${esc(track.name)}.</h1>
        <p class="sub">${esc(track.intro)}</p>
        <div class="ltl-track-tags">${track.topics.map(t => `<span>${esc(t)}</span>`).join('')}</div>
      </div>
      <aside class="ltl-audience">
        <span class="label">Built for</span><p>${esc(track.audience)}</p>
        <div class="ltlc-meta"><strong>${esc(track.estimated)}</strong><span>${track.lessons.length} lessons in order</span></div>
      </aside>
    </section>
    <section class="ltlc-start" aria-label="Course progress">
      <div class="ltlc-progress-copy">
        <span class="label">${isComplete ? 'Course complete' : completedCount ? 'Continue your course' : 'Begin the course'}</span>
        <h2>${isComplete ? 'You finished the course.' : esc(nextLesson.title)}</h2>
        <p>${isComplete ? 'Come back to any lesson whenever you want to refresh or use the ideas again.' : esc(nextLesson.question)}</p>
      </div>
      <div class="ltlc-progress-action">
        <div class="ltlc-progress-number"><strong>${completedCount}</strong><span>of ${track.lessons.length} lessons</span></div>
        <div class="ltlc-progress-bar"><i style="width:${coursePct}%"></i></div>
        <button class="btn btn-solid ltlc-primary" id="ltlcstart">${isComplete ? 'Revisit final lesson' : completedCount || resumeStep ? 'Continue course' : 'Start course'}</button>
      </div>
    </section>
    <section class="ltlc-outcomes" aria-labelledby="ltlc-outcomes-title">
      <div><span class="label">By the end</span><h2 id="ltlc-outcomes-title">What you will be able to do.</h2></div>
      <ol>${track.outcomes.map(outcome => `<li>${esc(outcome)}</li>`).join('')}</ol>
    </section>
    <section class="ltl-curriculum ltlc-curriculum" aria-labelledby="ltl-curriculum-title">
      <div class="ltl-section-head">
        <div><span class="label">Lessons</span><h2 id="ltl-curriculum-title">${track.lessons.length} lessons, in a clear order.</h2></div>
        <span class="ltl-research-state">${completedCount}/${track.lessons.length} complete</span>
      </div>
      <div class="ltlc-syllabus"></div>
    </section>
    ${isMedical ? `<section class="ltl-lab" aria-labelledby="ltl-lab-title">
      <div class="ltl-lab-head">
        <div><span class="label">Extra practice</span><h2 id="ltl-lab-title">Practice medical reasoning.</h2><p>Use these guided questions to explain how something works before you reveal the answer.</p></div>
        <div class="ltl-lab-progress"><strong>${done}/${total}</strong><span>complete</span><i><b style="width:${pct}%"></b></i></div>
      </div>
      <div class="mcat-mods ltl-disciplines"></div>
      <p class="anat-credit">Original guided questions, independently reviewed. Write what you think before revealing the answer.</p>
    </section>` : ''}
  </main>`);
  main.querySelector('#ltlback').addEventListener('click', renderSocrates);
  main.querySelector('#ltlcstart').addEventListener('click', () => renderLtlLesson(track.id, nextLesson.id, isComplete ? 0 : resumeStep));

  const syllabus = main.querySelector('.ltlc-syllabus');
  track.lessons.forEach((lesson, index) => {
    const complete = ltlCompleted(track.id, lesson.id);
    const unlocked = ltlLessonUnlocked(track, index);
    const state = complete ? 'Complete' : unlocked ? (lesson.id === nextLesson.id ? 'Up next' : 'Available') : 'Locked';
    const row = el(`<button class="ltlc-lesson ${complete ? 'is-complete' : ''} ${unlocked ? '' : 'is-locked'}" ${unlocked ? '' : 'disabled'} aria-label="${unlocked ? `Open lesson ${index + 1}: ${esc(lesson.title)}` : `Lesson ${index + 1} locked`}">
      <span class="ltlc-lesson-no">${complete ? '&#10003;' : String(index + 1).padStart(2, '0')}</span>
      <span class="ltlc-lesson-copy"><span class="ltlc-lesson-title">${esc(lesson.title)}</span><span class="ltlc-lesson-question">${esc(lesson.question)}</span></span>
      <span class="ltlc-lesson-meta"><span>${esc(lesson.duration)}</span><b>${state}</b></span>
    </button>`);
    if (unlocked) row.addEventListener('click', () => renderLtlLesson(track.id, lesson.id, 0));
    syllabus.appendChild(row);
  });

  if (isMedical) {
    const disciplines = main.querySelector('.ltl-disciplines');
    const keys = Object.keys(SOC.byDisc);
    if (!keys.length) disciplines.appendChild(el('<div class="empty">Reasoning dialogues are loading&hellip;</div>'));
    keys.forEach(k => {
      const list = SOC.byDisc[k];
      const dn = list.filter(d => SOC_DONE[d.id]).length;
      const card = el(`<button class="modcard">
        <span class="mod-name">${esc(discName(k))}</span>
        <span class="mod-desc">${list.length} topics &middot; guided practice</span>
        <span class="mod-stat">${dn ? `${dn}/${list.length} done` : `${list.length} to explore`}</span>
      </button>`);
      card.addEventListener('click', () => renderSocDiscipline(k));
      disciplines.appendChild(card);
    });
  }

  root.appendChild(main);
  setView(root);
}

/* ---------- full course lesson player ---------- */
function ltlLessonSources(lesson) {
  const sources = (lesson.sources || []).map(id => LTL.sourceById[id]).filter(Boolean);
  if (!sources.length) return '';
  return `<details class="ltlc-sources">
    <summary>Sources for this lesson</summary>
    <div>${sources.map(source => `<a href="${esc(source.url)}" target="_blank" rel="noopener"><span>${esc(source.short)}</span>${esc(source.title)} <i aria-hidden="true">&nearr;</i></a>`).join('')}</div>
  </details>`;
}

function ltlStepBody(step) {
  if (step.type === 'teach') {
    return `<div class="ltlc-prose">${(step.body || []).map(p => `<p>${esc(p)}</p>`).join('')}</div>
      ${step.callout ? `<aside class="ltlc-callout"><span class="label">${esc(step.callout.label)}</span><p>${esc(step.callout.text)}</p></aside>` : ''}`;
  }
  if (step.type === 'example') {
    return `<p class="ltlc-setup">${esc(step.setup)}</p>
      <ol class="ltlc-points">${(step.points || []).map(point => `<li>${esc(point)}</li>`).join('')}</ol>
      <aside class="ltlc-callout ltlc-callout-example"><span class="label">What this example shows</span><p>${esc(step.lesson)}</p></aside>`;
  }
  if (step.type === 'check') {
    return `<p class="ltlc-prompt">${esc(step.prompt)}</p>
      <div class="ltlc-options">${(step.options || []).map((option, index) => `<button class="ltlc-option" data-option="${index}"><span>${String.fromCharCode(65 + index)}</span>${esc(option)}</button>`).join('')}</div>
      <div class="ltlc-feedback" aria-live="polite"></div>`;
  }
  if (step.type === 'practice') {
    return `<p class="ltlc-prompt">${esc(step.prompt)}</p>
      <textarea class="ltlc-response" rows="7" placeholder="${esc(step.starter || 'Write your response here...')}"></textarea>
      <div class="ltlc-compare-action"><span>Your response stays on this device and is not graded.</span><button class="btn" data-compare disabled>Compare with sample answer</button></div>
      <div class="ltlc-model" hidden><span class="label">One strong answer</span><p>${esc(step.model)}</p><p class="ltlc-model-note">Do not copy the wording. Compare the ideas: what did this answer include that yours missed, and what did you notice that it did not?</p></div>`;
  }
  return `<div class="ltlc-summary-mark" aria-hidden="true">&#10003;</div>
    <ul class="ltlc-takeaways">${(step.takeaways || []).map(item => `<li>${esc(item)}</li>`).join('')}</ul>
    <aside class="ltlc-action"><span class="label">Try this now</span><p>${esc(step.action)}</p></aside>`;
}

async function renderLtlLesson(trackId, lessonId, stepIndex = 0) {
  await loadLearnCourses();
  const track = LTL.byId[trackId];
  const lessonIndex = track?.lessons.findIndex(item => item.id === lessonId) ?? -1;
  if (!track || lessonIndex < 0 || !ltlLessonUnlocked(track, lessonIndex)) { renderLearnTrack(trackId); return; }
  const lesson = track.lessons[lessonIndex];
  const step = lesson.steps[Math.max(0, Math.min(Number(stepIndex) || 0, lesson.steps.length - 1))];
  const currentStep = lesson.steps.indexOf(step);
  const progress = ltlProgress(track.id);
  progress.lastLesson = lesson.id;
  progress.lastStep = currentStep;
  saveLtlProgress();

  const root = el('<div class="ltlc-player-page"></div>');
  root.appendChild(el(`<header class="topbar ltlc-player-topbar">
    <div class="side"><button class="backbtn" id="ltlcexit">&larr; ${esc(track.name).toUpperCase()} COURSE</button></div>
    <div class="center"><span class="topstat">LESSON ${String(lessonIndex + 1).padStart(2, '0')} &middot; ${esc(lesson.title).toUpperCase()}</span></div>
    <div class="side right"><span class="topstat">${currentStep + 1}/${lesson.steps.length}</span></div>
  </header>`));
  const main = el(`<main class="ltlc-player">
    <div class="ltlc-step-progress" aria-label="Lesson progress">${lesson.steps.map((_, index) => `<i class="${index < currentStep ? 'past' : index === currentStep ? 'now' : ''}"></i>`).join('')}</div>
    <section class="ltlc-stage">
      <div class="ltlc-stage-head"><span class="label">${esc(step.eyebrow)}</span><span>${esc(lesson.duration)}</span></div>
      <h1>${esc(step.title)}</h1>
      <div class="ltlc-stage-content">${ltlStepBody(step)}</div>
      ${currentStep === lesson.steps.length - 1 ? ltlLessonSources(lesson) : ''}
      <div class="ltlc-nav">
        ${currentStep > 0 ? '<button class="btn" data-prev>&larr; Back</button>' : '<span></span>'}
        <button class="btn btn-solid" data-next ${step.type === 'check' || step.type === 'practice' ? 'disabled' : ''}>${currentStep === lesson.steps.length - 1 ? 'Complete lesson' : 'Continue'}</button>
      </div>
    </section>
  </main>`);
  root.appendChild(main);
  setView(root);

  root.querySelector('#ltlcexit').addEventListener('click', () => renderLearnTrack(track.id));
  root.querySelector('[data-prev]')?.addEventListener('click', () => renderLtlLesson(track.id, lesson.id, currentStep - 1));
  const nextButton = root.querySelector('[data-next]');
  nextButton.addEventListener('click', () => {
    if (currentStep === lesson.steps.length - 1) finishLtlLesson(track.id, lesson.id);
    else renderLtlLesson(track.id, lesson.id, currentStep + 1);
  });

  if (step.type === 'check') {
    const optionButtons = [...root.querySelectorAll('[data-option]')];
    const feedback = root.querySelector('.ltlc-feedback');
    optionButtons.forEach(button => button.addEventListener('click', () => {
      const selected = Number(button.dataset.option);
      optionButtons.forEach((option, index) => {
        option.disabled = true;
        if (index === step.answer) option.classList.add('is-correct');
        else if (index === selected) option.classList.add('is-wrong');
      });
      const correct = selected === step.answer;
      feedback.innerHTML = `<div class="${correct ? 'is-correct' : 'is-repair'}"><span class="label">${correct ? 'Correct' : 'Review the idea'}</span><p>${esc(step.explain)}</p></div>`;
      nextButton.disabled = false;
    }));
  }

  if (step.type === 'practice') {
    const response = root.querySelector('.ltlc-response');
    const compare = root.querySelector('[data-compare]');
    const model = root.querySelector('.ltlc-model');
    response.addEventListener('input', () => { compare.disabled = response.value.trim().length < 12; });
    compare.addEventListener('click', () => {
      model.hidden = false;
      compare.disabled = true;
      compare.textContent = 'Sample shown';
      response.disabled = true;
      nextButton.disabled = false;
      model.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
}

function finishLtlLesson(trackId, lessonId) {
  const track = LTL.byId[trackId];
  const lessonIndex = track.lessons.findIndex(lesson => lesson.id === lessonId);
  const lesson = track.lessons[lessonIndex];
  const progress = ltlProgress(track.id);
  if (!progress.completed.includes(lesson.id)) progress.completed.push(lesson.id);
  const next = track.lessons[lessonIndex + 1];
  progress.lastLesson = next?.id || lesson.id;
  progress.lastStep = 0;
  saveLtlProgress();
  const finishedCourse = !next;
  const root = el('<div class="ltlc-player-page"></div>');
  root.appendChild(topbar('socrates'));
  const main = el(`<main class="ltlc-finish">
    <span class="ltlc-finish-mark" aria-hidden="true">&#10003;</span>
    <span class="label">${finishedCourse ? `${esc(track.name)} course complete` : `Lesson ${String(lessonIndex + 1).padStart(2, '0')} complete`}</span>
    <h1>${finishedCourse ? 'You finished the course.' : esc(lesson.title)}</h1>
    <p>${finishedCourse ? 'Now use what you learned, check what you still remember later, and improve anything that does not hold up.' : `You finished the lesson. Next, ${next.title.toLowerCase()} builds directly on it.`}</p>
    <div class="ltlc-finish-actions">
      ${next ? '<button class="btn btn-solid" data-next-lesson>Start next lesson</button>' : '<button class="btn btn-solid" data-course-map>Return to course</button>'}
      <button class="btn" data-revisit>Review this lesson</button>
      ${next ? '<button class="btn" data-course-map>Course page</button>' : ''}
    </div>
  </main>`);
  root.appendChild(main);
  setView(root);
  main.querySelector('[data-next-lesson]')?.addEventListener('click', () => renderLtlLesson(track.id, next.id, 0));
  main.querySelectorAll('[data-course-map]').forEach(button => button.addEventListener('click', () => renderLearnTrack(track.id)));
  main.querySelector('[data-revisit]').addEventListener('click', () => renderLtlLesson(track.id, lesson.id, 0));
}

/* ---------- topic list for a discipline ---------- */
function renderSocDiscipline(key) {
  const list = SOC.byDisc[key] || [];
  const root = el('<div></div>');
  root.appendChild(topbar('socrates'));
  const main = el(`<main class="panel">
    <div class="hero"><h1>${esc(discName(key))}.</h1><p class="sub">${list.length} topics. Pick one and work through it step by step.</p></div>
    <div class="tabs"><button class="ghostbtn" id="socback" style="margin-left:auto">&larr; Medical course</button></div>
    <div class="rows" id="socrows"></div>
  </main>`);
  main.querySelector('#socback').addEventListener('click', () => renderLearnTrack('medical'));
  const rows = main.querySelector('#socrows');
  list.forEach(dlg => {
    const done = !!SOC_DONE[dlg.id];
    const row = el(`<button class="row">
      <span class="row-main">
        <span class="row-spec">${dlg.steps.length} steps</span>
        <span class="row-title">${esc(dlg.topic)}</span>
      </span>
      <span class="row-right">${done ? '<span class="pill ok">done</span>' : '<span class="row-when">start &rarr;</span>'}</span>
    </button>`);
    row.addEventListener('click', () => renderSocPlayer(key, dlg.id));
    rows.appendChild(row);
  });
  root.appendChild(main);
  setView(root);
}

/* ---------- step-through player ---------- */
let soc = null;
function renderSocPlayer(key, id) {
  const dlg = (SOC.byDisc[key] || []).find(d => d.id === id);
  if (!dlg) { renderSocDiscipline(key); return; }
  soc = { key, dlg, idx: 0 };
  const root = el('<div></div>');
  root.appendChild(el(`<header class="topbar">
    <div class="side"><button class="backbtn" id="socexit">&larr; ${esc(discName(key)).toUpperCase()}</button></div>
    <div class="center"><span class="topstat">${esc(discName(key)).toUpperCase()}</span></div>
    <div class="side right"><span class="topstat" id="socprog"></span></div>
  </header>`));
  root.querySelector('#socexit').addEventListener('click', () => renderSocDiscipline(key));
  const main = el(`<main class="case socplay">
    <div class="case-meta"><span>Guided questions</span><span class="sep">/</span><span>${esc(discName(key))}</span></div>
    <h2>${esc(dlg.topic)}</h2>
    <div class="socdots" id="socdots"></div>
    <div id="socsteps"></div>
  </main>`);
  root.appendChild(main);
  setView(root);
  renderSocDots();
  appendSocStep();
}

function renderSocDots() {
  const dots = document.getElementById('socdots');
  if (!dots) return;
  dots.replaceChildren();
  soc.dlg.steps.forEach((_, i) => dots.appendChild(el(`<span class="socdot ${i < soc.idx ? 'past' : i === soc.idx ? 'now' : ''}"></span>`)));
  const p = document.getElementById('socprog');
  if (p) p.textContent = `Step ${Math.min(soc.idx + 1, soc.dlg.steps.length)}/${soc.dlg.steps.length}`;
}

function appendSocStep() {
  const { dlg } = soc;
  if (soc.idx >= dlg.steps.length) return finishSoc();
  const s = dlg.steps[soc.idx];
  const isLast = soc.idx === dlg.steps.length - 1;
  const container = document.getElementById('socsteps');

  const node = el(`<section class="stage socstep">
    <div class="stage-head"><span class="label">${isLast ? 'Explain it in your own words' : 'Question ' + (soc.idx + 1)}</span><span class="rule"></span></div>
    <p class="q">${esc(s.question)}</p>
    <textarea class="socinput" rows="3" placeholder="Write what you think first&hellip;"></textarea>
    <div class="socactions">
      ${s.hint ? '<button class="btn" data-hint>Need a hint</button>' : ''}
      <button class="btn btn-solid" data-reveal>Reveal answer</button>
    </div>
    <div class="socafter"></div>
  </section>`);
  const after = node.querySelector('.socafter');
  const hintBtn = node.querySelector('[data-hint]');
  if (hintBtn) hintBtn.addEventListener('click', () => {
    hintBtn.disabled = true;
    after.appendChild(el(`<div class="sochint"><span class="label">Hint</span><p>${esc(s.hint)}</p></div>`));
  });
  node.querySelector('[data-reveal]').addEventListener('click', () => {
    node.querySelector('.socactions').remove();
    after.appendChild(el(`<div class="socans">
      <div class="socblock"><span class="label">Answer</span><p>${esc(s.answer)}</p></div>
      ${s.why ? `<div class="socblock why"><span class="label">Why it matters</span><p>${esc(s.why)}</p></div>` : ''}
    </div>`));
    const row = el(`<div class="continue-row"><span class="hint">ENTER &rarr;</span><button class="btn btn-solid" data-continue>${isLast ? 'Finish' : 'Next question'}</button></div>`);
    row.querySelector('[data-continue]').addEventListener('click', () => { soc.idx++; renderSocDots(); appendSocStep(); });
    after.appendChild(row);
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  container.appendChild(node);
  if (soc.idx > 0) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function finishSoc() {
  const { dlg, key } = soc;
  SOC_DONE[dlg.id] = { done: true, ts: Date.now() };
  saveSocDone();
  const idx = (SOC.byDisc[key] || []).findIndex(d => d.id === dlg.id);
  const next = (SOC.byDisc[key] || [])[idx + 1];
  const node = el(`<section class="summary">
    <span class="label">Practice complete</span>
    <div class="score">&#10003;</div>
    <p class="socdone-ttl">${esc(dlg.topic)}</p>
    <p class="sub" style="text-align:center;margin-top:6px">You worked through all ${dlg.steps.length} questions. If the last answer was hard to explain clearly, try it again. That difficult part is what to study next.</p>
    <div class="endbtns">
      ${next ? '<button class="btn btn-solid" id="socnext">Next topic</button>' : ''}
      <button class="btn" id="socredo">Try it again</button>
      <button class="btn" id="socdisc">All topics</button>
    </div>
  </section>`);
  if (next) node.querySelector('#socnext').addEventListener('click', () => renderSocPlayer(key, next.id));
  node.querySelector('#socredo').addEventListener('click', () => renderSocPlayer(key, dlg.id));
  node.querySelector('#socdisc').addEventListener('click', () => renderSocDiscipline(key));
  document.getElementById('socsteps').appendChild(node);
  renderSocDots();
  node.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
