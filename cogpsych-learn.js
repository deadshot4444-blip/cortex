/* ============================================================================
   Cognitive Psychology — LEARN MODE
   Socratic, guided lessons with interactive diagrams. Loaded after cogpsych.js;
   shares globals (el, esc, topbar, siteFooter, setView, COG, cogSave, cogClearTimer,
   cogTrack, startCogTopic, startCogSmart, renderCogHome). Teaching, not graded —
   separate from the box/competency system.

   Ships with NO lessons yet (COG_LESSONS = []) → renderCogLearnHome shows a graceful
   "coming soon" state pointing to Smart Review. Add teach-lessons by pushing objects
   into COG_LESSONS (schema below); each auto-appears once its `chapter` is in COG_CH.

   Lesson schema:
     { id, chapter, topic, title, blurb, steps: [ ...step ] }
   Step kinds:
     { kind:'teach', body:'<html>' }
     { kind:'ask', prompt:'<html>', reveal:'<html>', choices?:[...], answer?:int }
     { kind:'interactive', widget:'<COGLW key>', instructions:'text' }
     { kind:'checkpoint', q:'text', options:[...], answer:int, explain:'text' }
   Interactive widgets live in COGLW (register: COGLW.myWidget = fn(host, onDone)).
   ========================================================================= */

/* Interactive widget registry — add cognitive-psychology widgets here as lessons need them
   (e.g. a classical-conditioning stepper, a Donders reaction-time demo). Empty for now. */
const COGLW = {};

/* ---------------------------------------------------------------------------
   LESSONS  (empty until authored — Learn shows the coming-soon state)
   --------------------------------------------------------------------------- */
const COG_LESSONS = [];

/* ---------------------------------------------------------------------------
   PROGRESS
   --------------------------------------------------------------------------- */
function cogglDone(id) { return !!(COG.learned && COG.learned[id]); }
function cogglMark(id) { if (!COG.learned) COG.learned = {}; COG.learned[id] = 1; cogSave(); }

/* ---------------------------------------------------------------------------
   LEARN HOME
   --------------------------------------------------------------------------- */
function renderCogLearnHome() {
  cogClearTimer();
  cogTrack('learn_home', {});
  // only show lessons for chapters currently in COG_CH. Others stay dormant.
  const byCh = {};
  COG_LESSONS.filter(l => typeof COG_CH !== 'undefined' && COG_CH[l.chapter]).forEach(l => { (byCh[l.chapter] = byCh[l.chapter] || []).push(l); });
  const hasLessons = Object.keys(byCh).length > 0;
  const chBlock = (ch) => `<section class="gen-learn-ch">
      <span class="label">Chapter ${ch} · ${(typeof COG_CH !== 'undefined' && COG_CH[ch]) || ''}</span>
      <div class="gen-learn-grid">
        ${byCh[ch].map(l => `<button class="gen-learn-card cornerframe ${cogglDone(l.id) ? 'done' : ''}" data-lesson="${l.id}">
          ${cogglDone(l.id) ? '<span class="gen-learn-check">✓ learned</span>' : '<span class="gen-learn-go2">lesson</span>'}
          <h2>${esc(l.title)}</h2>
          <p>${esc(l.blurb)}</p>
          <span class="gen-learn-meta mono">${l.steps.length} steps · interactive</span>
        </button>`).join('')}
      </div>
    </section>`;
  const root = el('<div></div>');
  root.appendChild(topbar('cogpsych'));
  const main = el(`<main class="panel gen-learn-home" id="main" tabindex="-1">
    <div class="gen-pick-head"><button class="ghostbtn" id="gen-back">← Home</button><h1>Learn</h1></div>
    <p class="gen-learn-intro">Short, guided lessons that <b>teach</b> the concept the Socratic way — a question, your reasoning, then the idea — with interactive diagrams you build and step through. When a lesson clicks, jump to the drills to lock it in.</p>
    ${hasLessons ? Object.keys(byCh).sort((a, b) => a - b).map(chBlock).join('') : `<div class="gen-learn-empty cornerframe"><span class="label">Coming soon</span><h2>Guided lessons are on the way</h2><p>Socratic teach-lessons for this course are being built. For now, <b>Smart Review</b> and the topic drills have you covered — every question comes with a “think it through” hint when you miss it.</p><button class="btn btn-solid" id="gen-learn-smart">Start Smart Review →</button></div>`}
  </main>`);
  const smb = main.querySelector('#gen-learn-smart'); if (smb) smb.addEventListener('click', startCogSmart);
  main.querySelector('#gen-back').addEventListener('click', renderCogHome);
  main.querySelectorAll('[data-lesson]').forEach(b => b.addEventListener('click', () => renderCogLesson(b.dataset.lesson)));
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

/* ---------------------------------------------------------------------------
   LESSON PLAYER  (ready for authored lessons; unused while COG_LESSONS is empty)
   --------------------------------------------------------------------------- */
function renderCogLesson(id) {
  cogClearTimer();
  const lesson = COG_LESSONS.find(l => l.id === id);
  if (!lesson) { renderCogLearnHome(); return; }
  cogTrack('learn_start', { lesson: id });
  let idx = 0;

  function frame(inner, opts) {
    opts = opts || {};
    const root = el('<div></div>');
    root.appendChild(topbar('cogpsych'));
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
    main.querySelector('#gen-exit').addEventListener('click', renderCogLearnHome);
    main.querySelector('#lesson-back').addEventListener('click', () => { if (idx > 0) { idx--; show(); } });
    const nextBtn = main.querySelector('#lesson-next');
    nextBtn.addEventListener('click', () => {
      if (idx < lesson.steps.length - 1) { idx++; show(); }
      else { cogglMark(lesson.id); cogTrack('learn_done', { lesson: lesson.id }); finish(); }
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
      const widget = COGLW[step.widget];
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
    cogClearTimer();
    const root = el('<div></div>');
    root.appendChild(topbar('cogpsych'));
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
    main.querySelector('#l-drill').addEventListener('click', () => { if (typeof startCogTopic === 'function') startCogTopic(lesson.topic); else renderCogHome(); });
    main.querySelector('#l-more').addEventListener('click', renderCogLearnHome);
    main.querySelector('#l-home').addEventListener('click', renderCogHome);
    root.appendChild(main); root.appendChild(siteFooter()); setView(root);
  }

  show();
}
