/* ============================================================================
   CCMA Medical Assistant — LEARN MODE
   Socratic, guided lessons with interactive diagrams. Loaded after ccma.js;
   shares globals (el, esc, topbar, siteFooter, setView, CCMA, ccmaSave, ccmaClearTimer,
   ccmaTrack, startCcmaTopic, startCcmaSmart, renderCcmaHome). Teaching, not graded —
   separate from the box/competency system.

   Ships with NO lessons yet (CCMA_LESSONS_DATA = []) → renderCcmaLearnHome shows a graceful
   "coming soon" state pointing to Smart Review. Add teach-lessons by pushing objects
   into CCMA_LESSONS_DATA (schema below); each auto-appears once its `chapter` is in CCMA_CH.

   Lesson schema:
     { id, chapter, topic, title, blurb, steps: [ ...step ] }
   Step kinds:
     { kind:'teach', body:'<html>' }
     { kind:'ask', prompt:'<html>', reveal:'<html>', choices?:[...], answer?:int }
     { kind:'interactive', widget:'<CCMALW key>', instructions:'text' }
     { kind:'checkpoint', q:'text', options:[...], answer:int, explain:'text' }
   Interactive widgets live in CCMALW (register: CCMALW.myWidget = fn(host, onDone)).
   ========================================================================= */

/* Interactive widget registry — add medical-assistant widgets here as lessons need them
   (e.g. a classical-conditioning stepper, a Donders reaction-time demo). Empty for now. */
const CCMALW = {};

/* ---------------------------------------------------------------------------
   LESSONS  (empty until authored — Learn shows the coming-soon state)
   --------------------------------------------------------------------------- */
let CCMA_LESSONS_DATA = [];
let ccmaLearnReady = false;
async function ccmaLoadLearn() {
  if (ccmaLearnReady) return;
  try {
    const r = await fetch('data/ccma-learn.json?v=2');
    if (!r.ok) throw new Error('http '+r.status);
    const data = await r.json();
    if (Array.isArray(data)) CCMA_LESSONS_DATA = data;
    ccmaLearnReady = true;
  } catch (e) { CCMA_LESSONS_DATA = CCMA_LESSONS_DATA || []; ccmaLearnReady = true; }
}


/* ---------------------------------------------------------------------------
   PROGRESS
   --------------------------------------------------------------------------- */
function ccmaglDone(id) { return !!(CCMA.learned && CCMA.learned[id]); }
function ccmaglMark(id) { if (!CCMA.learned) CCMA.learned = {}; CCMA.learned[id] = 1; ccmaSave(); }

/* ---------------------------------------------------------------------------
   LEARN HOME
   --------------------------------------------------------------------------- */
function renderCcmaLearnHome() {
  ccmaClearTimer();
  if (!ccmaLearnReady) {
    ccmaLoadLearn().then(renderCcmaLearnHome);
    const root = el('<div></div>'); root.appendChild(topbar('ccma'));
    root.appendChild(el('<main class="panel gen-lock" id="main"><div class="gen-lock-box cornerframe"><span class="label">Learn</span><p class="gen-lock-sub">Loading lessons…</p></div></main>'));
    root.appendChild(siteFooter()); setView(root);
    return;
  }
  ccmaTrack('learn_home', {});
  // Group by program lesson number when present, else chapter/domain
  const byCh = {};
  CCMA_LESSONS_DATA.forEach(l => {
    const key = (l.lessonNum != null) ? l.lessonNum : l.chapter;
    (byCh[key] = byCh[key] || []).push(l);
  });
  const hasLessons = Object.keys(byCh).length > 0;
  const chBlock = (ch) => `<section class="gen-learn-ch">
      <span class="label">Lesson ${ch} · ${(byCh[ch][0] && byCh[ch][0].title) || ''}</span>
      <div class="gen-learn-grid">
        ${byCh[ch].map(l => `<button class="gen-learn-card cornerframe ${ccmaglDone(l.id) ? 'done' : ''}" data-lesson="${l.id}">
          ${ccmaglDone(l.id) ? '<span class="gen-learn-check">✓ learned</span>' : '<span class="gen-learn-go2">lesson</span>'}
          <h2>${esc(l.title)}</h2>
          <p>${esc(l.blurb)}</p>
          <span class="gen-learn-meta mono">${l.steps.length} steps · interactive</span>
        </button>`).join('')}
      </div>
    </section>`;
  const root = el('<div></div>');
  root.appendChild(topbar('ccma'));
  const main = el(`<main class="panel gen-learn-home" id="main" tabindex="-1">
    <div class="gen-pick-head"><button class="ghostbtn" id="gen-back">← Home</button><h1>Learn</h1></div>
    <p class="gen-learn-intro">Guided mastery briefs for all 38 CCMA lessons — teach, check, then drill. Built for your private study rail — a question, your reasoning, then the idea — with interactive diagrams you build and step through. When a lesson clicks, jump to the drills to lock it in.</p>
    ${hasLessons ? Object.keys(byCh).sort((a, b) => a - b).map(chBlock).join('') : `<div class="gen-learn-empty cornerframe"><span class="label">Coming soon</span><h2>Guided lessons are on the way</h2><p>Socratic teach-lessons for this course are being built. For now, <b>Smart Review</b> and the topic drills have you covered — every question comes with a “think it through” hint when you miss it.</p><button class="btn btn-solid" id="gen-learn-smart">Start Smart Review →</button></div>`}
  </main>`);
  const smb = main.querySelector('#gen-learn-smart'); if (smb) smb.addEventListener('click', startCcmaSmart);
  main.querySelector('#gen-back').addEventListener('click', renderCcmaHome);
  main.querySelectorAll('[data-lesson]').forEach(b => b.addEventListener('click', () => renderCcmaLesson(b.dataset.lesson)));
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

/* ---------------------------------------------------------------------------
   LESSON PLAYER  (ready for authored lessons; unused while CCMA_LESSONS_DATA is empty)
   --------------------------------------------------------------------------- */
function renderCcmaLesson(id) {
  ccmaClearTimer();
  const lesson = CCMA_LESSONS_DATA.find(l => l.id === id);
  if (!lesson) { renderCcmaLearnHome(); return; }
  ccmaTrack('learn_start', { lesson: id });
  let idx = 0;

  function frame(inner, opts) {
    opts = opts || {};
    const root = el('<div></div>');
    root.appendChild(topbar('ccma'));
    const pct = Math.round((idx) / lesson.steps.length * 100);
    const main = el(`<main class="panel gen-lesson" id="main" tabindex="-1">
      <div class="gen-lesson-top">
        <button class="ghostbtn" id="gen-exit">← Lessons</button>
        <span class="gen-lesson-title">${esc(lesson.title)}</span>
        <span class="mono gen-lesson-count">${Math.min(idx + 1, lesson.steps.length)}/${lesson.steps.length}</span>
      </div>
      <div class="gen-lesson-bar"><span style="width:${pct}%"></span></div>
      <div class="gen-lesson-body" id="lesson-body"></div>
      <div class="gen-lesson-nav">
        <button class="btn" id="lesson-back" ${idx === 0 ? 'disabled' : ''}>Back</button>
        <button class="btn btn-solid" id="lesson-next" ${opts.gate ? 'disabled' : ''}>${opts.nextLabel || 'Next'}</button>
      </div>
    </main>`);
    main.querySelector('#lesson-body').appendChild(inner);
    main.querySelector('#gen-exit').addEventListener('click', renderCcmaLearnHome);
    main.querySelector('#lesson-back').addEventListener('click', () => { if (idx > 0) { idx--; show(); } });
    const nextBtn = main.querySelector('#lesson-next');
    nextBtn.addEventListener('click', () => {
      if (idx < lesson.steps.length - 1) { idx++; show(); }
      else { ccmaglMark(lesson.id); ccmaTrack('learn_done', { lesson: lesson.id }); finish(); }
    });
    root.appendChild(main); root.appendChild(siteFooter()); setView(root);
    return { ungate: () => { nextBtn.disabled = false; } };
  }

  function show() {
    const step = lesson.steps[idx];
    const last = idx === lesson.steps.length - 1;
    const nextLabel = last ? 'Finish ✓' : 'Next →';

    if (step.kind === 'teach') {
      frame(el(`<div class="gen-step gen-step-teach"><p>${step.body}</p></div>`), { nextLabel });

    } else if (step.kind === 'ask') {
      const box = el(`<div class="gen-step gen-step-ask">
        <span class="gen-step-kind">Think it through</span>
        <p class="gen-ask-prompt">${step.prompt}</p>
        <div class="gen-ask-body"></div>
      </div>`);
      const body = box.querySelector('.gen-ask-body');
      frame(box, { nextLabel });
      if (Array.isArray(step.choices)) {
        const opts = el('<div class="gen-ask-choices"></div>');
        step.choices.forEach((c, i) => opts.appendChild(el(`<button type="button" class="gen-ask-choice" data-i="${i}">${esc(c)}</button>`)));
        body.appendChild(opts);
        const reveal = el(`<div class="gen-ask-reveal" hidden><p>${step.reveal}</p></div>`);
        body.appendChild(reveal);
        opts.querySelectorAll('.gen-ask-choice').forEach(btn => btn.addEventListener('click', () => {
          if (opts.dataset.locked) return; opts.dataset.locked = '1';
          const pick = +btn.dataset.i;
          opts.querySelectorAll('.gen-ask-choice').forEach((b, i) => { b.disabled = true; if (i === step.answer) b.classList.add('correct'); else if (i === pick) b.classList.add('wrong'); });
          const right = pick === step.answer;
          reveal.classList.add(right ? 'right' : 'wrong');
          reveal.insertAdjacentHTML('afterbegin', `<p class="gen-ask-verdict"><b>${right ? 'Correct.' : 'Not quite.'}</b></p>`);
          reveal.hidden = false;
        }));
      } else {
        const btn = el('<button type="button" class="btn gen-ask-show">Show me ▾</button>');
        const reveal = el(`<div class="gen-ask-reveal" hidden><p>${step.reveal}</p></div>`);
        body.append(btn, reveal);
        btn.addEventListener('click', () => { reveal.hidden = false; btn.hidden = true; });
      }

    } else if (step.kind === 'interactive') {
      const box = el(`<div class="gen-step gen-step-interactive">
        <p class="gen-inter-instr">${esc(step.instructions)}</p>
        <div class="gen-inter-host"></div>
        <p class="gen-inter-done" hidden>✓ nice work</p>
      </div>`);
      frame(box, { nextLabel });
      const host = box.querySelector('.gen-inter-host');
      const doneMsg = box.querySelector('.gen-inter-done');
      const widget = CCMALW[step.widget];
      if (widget) widget(host, () => { doneMsg.hidden = false; });
      else host.appendChild(el('<p class="gen-inter-instr">[missing widget]</p>'));

    } else if (step.kind === 'checkpoint') {
      const box = el(`<div class="gen-step gen-step-check">
        <span class="gen-step-kind">Quick check</span>
        <p class="gen-check-q">${esc(step.q)}</p>
        <div class="gen-check-opts"></div>
        <div class="gen-check-fb" hidden></div>
      </div>`);
      const handle = frame(box, { gate: true, nextLabel });
      const opts = box.querySelector('.gen-check-opts');
      const fb = box.querySelector('.gen-check-fb');
      step.options.forEach((o, i) => opts.appendChild(el(`<button type="button" class="gen-check-opt" data-i="${i}">${esc(o)}</button>`)));
      opts.querySelectorAll('.gen-check-opt').forEach(btn => btn.addEventListener('click', () => {
        if (opts.dataset.locked) return; opts.dataset.locked = '1';
        const pick = +btn.dataset.i;
        opts.querySelectorAll('.gen-check-opt').forEach((b, i) => { b.disabled = true; if (i === step.answer) b.classList.add('correct'); else if (i === pick) b.classList.add('wrong'); });
        fb.hidden = false; fb.className = 'gen-check-fb ' + (pick === step.answer ? 'right' : 'wrong');
        fb.innerHTML = `<b>${pick === step.answer ? 'Correct.' : 'Not quite.'}</b> ${esc(step.explain)}`;
        handle.ungate();
      }));
    }
  }

  function finish() {
    ccmaClearTimer();
    const root = el('<div></div>');
    root.appendChild(topbar('ccma'));
    const main = el(`<main class="panel gen-result" id="main" tabindex="-1">
      <div class="gen-res-box cornerframe">
        <span class="label">Lesson complete</span>
        <h1 class="gen-res-sub">${esc(lesson.title)}</h1>
        <p class="gen-empty-msg">You’ve got the concept — now lock it in with a few drills on this topic.</p>
        <div class="gen-res-btns">
          <button class="btn btn-solid" id="l-drill">Drill this topic →</button>
          <button class="btn" id="l-more">More lessons</button>
          <button class="btn" id="l-home">Home</button>
        </div>
      </div>
    </main>`);
    main.querySelector('#l-drill').addEventListener('click', () => { if (typeof startCcmaTopic === 'function') startCcmaTopic(lesson.topic); else renderCcmaHome(); });
    main.querySelector('#l-more').addEventListener('click', renderCcmaLearnHome);
    main.querySelector('#l-home').addEventListener('click', renderCcmaHome);
    root.appendChild(main); root.appendChild(siteFooter()); setView(root);
  }

  show();
}
