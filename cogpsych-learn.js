/* ============================================================================
   Cognitive Psychology — LEARN MODE
   Socratic, guided lessons with interactive diagrams. Loaded after cogpsych.js;
   shares globals (el, esc, topbar, siteFooter, setView, COG, cogSave, cogClearTimer,
   cogTrack, startCogTopic, startCogSmart, renderCogHome). Teaching, not graded —
   separate from the box/competency system.

   Lessons load from data/cogpsych-learn.json and are filtered to the current module.

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
let COG_LESSONS = [];
let cogLearnReady = false;
function cogValidLesson(l, seen) {
  const topic = l && typeof COG_TOPICS !== 'undefined' && COG_TOPICS[l.topic];
  const kinds = new Set(['teach', 'ask', 'interactive', 'checkpoint']);
  return l && typeof l.id === 'string' && l.id && !seen.has(l.id)
    && Number.isInteger(l.chapter) && topic && topic.ch === l.chapter && COG_CH[l.chapter]
    && typeof l.title === 'string' && l.title && typeof l.blurb === 'string' && l.blurb
    && Array.isArray(l.steps) && l.steps.length >= 4
    && l.steps.every(s => s && kinds.has(s.kind));
}
async function cogLoadLessons() {
  if (cogLearnReady) return;
  try {
    const r = await fetch('data/cogpsych-learn.json?v=2');
    if (!r.ok) throw new Error('http '+r.status);
    const data = await r.json();
    if (Array.isArray(data)) {
      const seen = new Set();
      COG_LESSONS = data.filter(l => { if (!cogValidLesson(l, seen)) return false; seen.add(l.id); return true; });
    }
  } catch (e) {}
  cogLearnReady = true;
}


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
  if (!cogLearnReady) {
    cogLoadLessons().then(renderCogLearnHome);
    const root = el('<div></div>'); root.appendChild(topbar('cogpsych'));
    root.appendChild(el('<main class="panel gen-lock" id="main"><div class="gen-lock-box cornerframe"><span class="label">Learn</span><p class="gen-lock-sub">Loading lessons…</p></div></main>'));
    root.appendChild(siteFooter()); setView(root);
    return;
  }
  cogTrack('learn_home', {});
  const byCh = {};
  COG_LESSONS.filter(l => typeof COG_CH !== 'undefined' && COG_CH[l.chapter]).forEach(l => { (byCh[l.chapter] = byCh[l.chapter] || []).push(l); });
  const hasLessons = Object.keys(byCh).length > 0;
  const chBlock = (ch) => `<section class="gen-learn-ch">
      <span class="label">${ch} · ${(typeof COG_CH !== 'undefined' && COG_CH[ch]) || ''}</span>
      <div class="gen-learn-grid">
        ${byCh[ch].map(l => `<button class="gen-learn-card cornerframe ${cogglDone(l.id) ? 'done' : ''}" data-lesson="${l.id}">
          ${cogglDone(l.id) ? '<span class="gen-learn-check">✓ learned</span>' : '<span class="gen-learn-go2">lesson</span>'}
          <h2>${esc(l.title)}</h2>
          <p>${esc(l.blurb)}</p>
          <span class="gen-learn-meta mono">${l.steps.length} steps · ${l.steps.some(s => s.kind === 'interactive') ? 'interactive' : 'guided mastery'}</span>
        </button>`).join('')}
      </div>
    </section>`;
  const root = el('<div></div>');
  root.appendChild(topbar('cogpsych'));
  const main = el(`<main class="panel gen-learn-home" id="main" tabindex="-1">
    <div class="gen-pick-head"><button class="ghostbtn" id="gen-back">← Home</button><h1>Learn Cognitive Psychology</h1></div>
    <p class="gen-learn-intro">Module 2 lessons follow the exam map: learn the model, retrieve it, pass the checkpoint, then drill. Finish Chapters 6–9 in order or jump straight to a weak topic.</p>
    ${hasLessons ? Object.keys(byCh).sort((a, b) => a - b).map(chBlock).join('') : `<div class="gen-learn-empty cornerframe"><span class="label">Load error</span><h2>Lessons did not load</h2><p>Reload the page, or use <b>Smart Review</b> while the lesson file reconnects.</p><button class="btn btn-solid" id="gen-learn-smart">Start Smart Review →</button></div>`}
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
      const handle = frame(box, { gate: true, nextLabel });
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
          handle.ungate();
        }));
      } else {
        const btn = el('<button type="button" class="btn gen-ask-show">Show me ▾</button>');
        const reveal = el(`<div class="gen-ask-reveal" hidden><p>${step.reveal}</p></div>`);
        body.append(btn, reveal);
        btn.addEventListener('click', () => { reveal.hidden = false; btn.hidden = true; handle.ungate(); });
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
        const right = pick === step.answer;
        if (right) {
          opts.querySelectorAll('.gen-check-opt').forEach((b, i) => { b.disabled = true; if (i === step.answer) b.classList.add('correct'); });
          fb.hidden = false; fb.className = 'gen-check-fb right';
          fb.innerHTML = `<b>Correct.</b> ${esc(step.explain)}`;
          handle.ungate();
        } else {
          opts.dataset.locked = '';
          btn.disabled = true; btn.classList.add('wrong');
          fb.hidden = false; fb.className = 'gen-check-fb wrong';
          fb.innerHTML = '<b>Not quite.</b> Use the feedback, then try another answer.';
        }
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
