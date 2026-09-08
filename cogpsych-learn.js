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
     { kind:'interactive', widget:'<COGLW or COG_FIGS key>', instructions:'text' }
     { kind:'checkpoint', q:'text', options:[...], answer:int, explain:'text' }
   Interactive widgets resolve from COGLW first (fn(host, onDone)), then fall
   back to the COG_FIGS registry in cogpsych-figs.js (fn(host) — self-paced
   stepped SVG figures; no onDone).
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
    && new Set(l.steps.map(s => s?.id)).size === l.steps.length
    && l.steps.every(s => {
      if (!s || typeof s.id !== 'string' || !s.id || !kinds.has(s.kind)) return false;
      if (s.kind === 'teach') return typeof s.body === 'string' && !!s.body;
      if (s.kind === 'interactive') return typeof s.widget === 'string' && typeof s.instructions === 'string';
      const options = s.options || s.choices;
      if (s.kind === 'checkpoint' && (typeof s.q !== 'string' || typeof s.explain !== 'string' || !options)) return false;
      if (s.kind === 'ask' && (typeof s.prompt !== 'string' || typeof s.reveal !== 'string')) return false;
      return !options || Array.isArray(options) && options.length >= 2 && options.every(o => typeof o === 'string' && !!o) && Number.isInteger(s.answer) && s.answer >= 0 && s.answer < options.length;
    });
}
async function cogLoadLessons() {
  if (cogLearnReady) return;
  const response = await fetch('data/cogpsych-learn.json?v=5');
  if (!response.ok) throw new Error('Psychology lessons did not download');
  const data = await response.json(), seen = new Set();
  if (!Array.isArray(data) || !data.length) throw new Error('Psychology lessons are unavailable');
  for (const lesson of data) {
    if (!cogValidLesson(lesson, seen)) throw new Error('Psychology lesson structure is invalid');
    seen.add(lesson.id);
  }
  if (Object.entries(COG.lessons).some(([id, record]) => record.content &&
      (record.content.id !== id || !cogValidLesson(record.content, new Set())))) {
    StudyStorage.sessionFailed(); throw new Error('Saved psychology lesson needs recovery');
  }
  COG_LESSONS = data; cogLearnReady = true;
}

function cogglDone(id) { return !!COG.learned[id]; }
function cogLessonRecord(lesson) {
  const record = COG.lessons[lesson.id] ||= { revision: lesson.revision || 1, index: 0, steps: {}, startedAt: Date.now() };
  // Retain earlier exposed step wording when adding a whole-lesson snapshot.
  record.content ||= JSON.parse(JSON.stringify({ ...lesson, steps: lesson.steps.map(step => record.steps[step.id]?.content || step) }));
  return record;
}
function cogStepReady(step, record = {}) {
  if (step.kind === 'checkpoint' || (step.kind === 'ask' && step.choices)) return Number.isInteger(record.selected);
  if (step.kind === 'ask') return !!record.revealedAt;
  return !!record.seenAt;
}
function cogRoute(view, lesson, step, chapter) {
  const url = new URL(location.href), previous = new URL(location.href);
  url.pathname = '/cogpsych';
  for (const key of ['view', 'lesson', 'step', 'chapter', 'demo', 'run']) url.searchParams.delete(key);
  if (view !== 'home') url.searchParams.set('view', view);
  if (lesson) url.searchParams.set('lesson', lesson);
  if (step !== undefined) url.searchParams.set('step', String(step));
  if (chapter) url.searchParams.set('chapter', String(chapter));
  if (url.href === previous.href) return;
  const sameLesson = lesson && previous.searchParams.get('lesson') === lesson;
  const method = sameLesson ? 'replaceState' : 'pushState';
  history[method]({}, '', url.pathname + url.search);
}

/* ---------------------------------------------------------------------------
   LEARN HOME
   --------------------------------------------------------------------------- */
function renderCogLearnHome(focusChapter) {
  cogClearTimer();
  if (!cogLearnReady) return renderCogPsych();
  cogRoute('lessons', undefined, undefined, focusChapter);
  cogTrack('learn_home', {});
  const byCh = {};
  COG_LESSONS.filter(l => typeof COG_CH !== 'undefined' && COG_CH[l.chapter]).forEach(l => { (byCh[l.chapter] = byCh[l.chapter] || []).push(l); });
  const hasLessons = Object.keys(byCh).length > 0;
  const completed = COG_LESSONS.filter(l => cogglDone(l.id)).length;
  const pct = COG_LESSONS.length ? Math.round(completed / COG_LESSONS.length * 100) : 0;
  const nextLesson = COG_LESSONS.find(l => !cogglDone(l.id)) || COG_LESSONS[0] || null;
  const chBlock = (ch) => {
    const done = byCh[ch].filter(l => cogglDone(l.id)).length;
    return `<section class="gen-learn-ch cog-curriculum-chapter" id="cog-chapter-${ch}">
      <header class="cog-curriculum-chapter-head">
        <span class="cog-curriculum-chapter-num mono">${String(ch).padStart(2, '0')}</span>
        <div><span class="label">Chapter ${ch} · ${done}/${byCh[ch].length} complete</span><h2>${esc((typeof COG_CH !== 'undefined' && COG_CH[ch]) || '')}</h2><p>${esc((typeof COG_CH_OVERVIEW !== 'undefined' && COG_CH_OVERVIEW[ch]) || '')}</p></div>
      </header>
      <div class="gen-learn-grid">
        ${byCh[ch].map((l, index) => `<button class="gen-learn-card ${cogglDone(l.id) ? 'done' : ''}" data-lesson="${l.id}">
          ${cogglDone(l.id) ? '<span class="gen-learn-check">✓ complete</span>' : `<span class="gen-learn-go2">Lesson ${index + 1}</span>`}
          <h2>${esc(l.title)}</h2>
          <p>${esc(l.blurb)}</p>
          <span class="gen-learn-meta mono">${l.steps.length} steps · ${l.steps.some(s => s.kind === 'interactive') ? 'interactive' : 'guided lesson'}</span>
        </button>`).join('')}
      </div>
    </section>`;
  };
  const root = el('<div></div>');
  root.appendChild(topbar('cogpsych'));
  const main = el(`<main class="panel gen-learn-home cog-curriculum-page" id="main" tabindex="-1">
    <button class="ghostbtn cog-curriculum-back" id="gen-back">← Course home</button>
    <header class="cog-curriculum-hero">
      <div><span class="label">Draft library · 13 chapters</span><h1>Cognitive Psychology</h1><p>Browse the existing library or begin the seven-lesson foundations path on the course home. Independent review remains pending; saved completion records are preserved.</p></div>
      <aside><strong class="mono">${pct}%</strong><span>${completed} of ${COG_LESSONS.length} lessons complete</span><span class="cog-course-bar"><i style="width:${pct}%"></i></span>${nextLesson ? `<button class="btn btn-solid" id="cog-continue-course">${completed ? 'Continue' : 'Start'} course →</button>` : ''}</aside>
    </header>
    ${hasLessons ? Object.keys(byCh).sort((a, b) => a - b).map(chBlock).join('') : `<div class="gen-learn-empty cornerframe"><span class="label">Load error</span><h2>Lessons did not load</h2><p>Reload the page, or use <b>Smart Review</b> while the lesson file reconnects.</p><button class="btn btn-solid" id="gen-learn-smart">Start Smart Review →</button></div>`}
  </main>`);
  const smb = main.querySelector('#gen-learn-smart'); if (smb) smb.addEventListener('click', startCogSmart);
  const continueBtn = main.querySelector('#cog-continue-course'); if (continueBtn && nextLesson) continueBtn.addEventListener('click', () => renderCogLesson(nextLesson.id));
  main.querySelector('#gen-back').addEventListener('click', renderCogHome);
  main.querySelectorAll('[data-lesson]').forEach(b => b.addEventListener('click', () => renderCogLesson(b.dataset.lesson)));
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
  if (focusChapter) requestAnimationFrame(() => document.querySelector(`#cog-chapter-${focusChapter}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

/* ---------------------------------------------------------------------------
   LESSON PLAYER  (ready for authored lessons; unused while COG_LESSONS is empty)
   --------------------------------------------------------------------------- */
function renderCogLesson(id) {
  if (StudyStorage.paused) return;
  cogClearTimer();
  const currentLesson = COG_LESSONS.find(item => item.id === id);
  if (!currentLesson) return renderCogLearnHome();
  const record = cogLessonRecord(currentLesson), lesson = record.content, params = new URLSearchParams(location.search);
  if (!cogSave()) return;
  const requested = params.get('lesson') === id ? params.get('step') : null;
  const firstUnfinished = lesson.steps.findIndex(step => !cogStepReady(step, record.steps[step.id]));
  let idx = Math.max(0, Math.min(Number.isInteger(Number(requested)) && Number(requested) > 0 ? Number(requested)-1 : Number.isInteger(record.index) ? record.index : 0,
    firstUnfinished < 0 ? lesson.steps.length-1 : firstUnfinished));
  if (requested === 'done' && record.completedAt) return finish();
  cogTrack('learn_start', { lesson: id });

  function save() { return cogSave(); }
  function snapshot(step, saved) { saved.content ||= JSON.parse(JSON.stringify(step)); }
  function frame(inner, ready) {
    record.index = idx; cogRoute('lesson', id, idx+1);
    const root = el('<div></div>'); root.appendChild(topbar('cogpsych'));
    const main = el(`<main class="panel gen-lesson" id="main" tabindex="-1">
      <div class="gen-lesson-top"><button class="ghostbtn" id="gen-exit">← Save & leave</button><h1 class="gen-lesson-title">${esc(lesson.title)}</h1><span class="mono gen-lesson-count">${idx+1}/${lesson.steps.length}</span></div>
      <div class="gen-lesson-bar"><span style="width:${idx/lesson.steps.length*100}%"></span></div>
      <div class="gen-lesson-body" id="lesson-body"></div>
      <div class="gen-lesson-nav"><button class="btn" id="lesson-back" ${idx ? '' : 'disabled'}>Back</button><button class="btn btn-solid" id="lesson-next" ${ready ? '' : 'disabled'}>${idx === lesson.steps.length-1 ? 'Save lesson completion' : 'Next →'}</button></div>
      <aside class="cog-lesson-source"><span class="label">${lesson.foundationOrder ? 'Foundation lesson' : lesson.researchOrder ? 'Research reasoning lesson' : 'Draft library lesson'} · ${esc(lesson.reviewStatus || 'Independent subject review pending.')}</span>
      ${(lesson.sources || []).map(source => `<a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)} ↗</a>`).join('')}
      <p>Original Cortex teaching and examples. Responses are saved in this browser with your course progress. Lesson completion records participation; first answers are shown separately.</p></aside>
    </main>`);
    main.querySelector('#lesson-body').append(inner);
    main.querySelector('#gen-exit').onclick = () => { if (save()) renderCogLearnHome(lesson.chapter); };
    main.querySelector('#lesson-back').onclick = () => { if (!StudyStorage.paused && idx > 0) { idx--; show(); } };
    main.querySelector('#lesson-next').onclick = () => {
      if (StudyStorage.paused) return;
      const step = lesson.steps[idx], saved = record.steps[step.id] ||= {};
      if (step.kind === 'teach' || step.kind === 'interactive') { snapshot(step, saved); saved.seenAt ||= Date.now(); }
      if (!cogStepReady(step, saved)) return;
      if (idx < lesson.steps.length-1) { record.index = idx+1; if (save()) { idx++; show(); } }
      else if (lesson.steps.every(item => cogStepReady(item, record.steps[item.id]))) {
        record.completedAt ||= Date.now(); COG.learned[id] ||= record.completedAt;
        if (save()) { cogTrack('learn_done', { lesson: id }); finish(); }
      }
    };
    root.append(main); setView(root);
  }

  function show() {
    const current = lesson.steps[idx], saved = record.steps[current.id] ||= {};
    const step = saved.content || current;
    if (step.kind === 'teach') {
      frame(el(`<article class="gen-step gen-step-teach">${step.body}</article>`), true);
    } else if (step.kind === 'interactive') {
      const box = el(`<article class="gen-step"><p>${esc(step.instructions)}</p><div class="gen-inter-host"></div><p>Review the figure and its explanation before continuing. This is a teaching illustration, not a measured experiment.</p></article>`);
      frame(box, true);
      const host = box.querySelector('.gen-inter-host'), widget = COGLW[step.widget] || window.COG_FIGS?.[step.widget];
      if (widget) { try { widget(host, () => {}); } catch { host.textContent = 'The illustration could not open. The written explanation above remains available.'; } }
      else host.textContent = 'This illustration is unavailable. Use the written explanation above.';
    } else if (step.kind === 'checkpoint' || step.choices) {
      const options = step.options || step.choices, answered = Number.isInteger(saved.selected);
      const box = el(`<article class="gen-step gen-step-check"><span class="gen-step-kind">${step.kind === 'checkpoint' ? 'Application check' : 'Think it through'}</span><h2 class="gen-check-q">${step.kind === 'checkpoint' ? esc(step.q) : step.prompt}</h2>
        <div class="gen-check-opts">${options.map((option,i) => `<button type="button" class="gen-check-opt${answered && i === step.answer ? ' correct' : answered && i === saved.selected ? ' wrong' : ''}" data-pick="${i}" ${answered ? 'disabled' : ''}>${esc(option)}</button>`).join('')}</div>
        ${answered ? `<div class="gen-check-fb ${saved.selected === step.answer ? 'right' : 'wrong'}" role="status"><b>${saved.selected === step.answer ? 'Correct.' : 'Revisit this idea.'}</b><p>Your first answer: ${esc(options[saved.selected])}</p><p>Answer: ${esc(options[step.answer])}</p><p>${step.kind === 'checkpoint' ? esc(step.explain) : step.reveal}</p></div>` : ''}</article>`);
      frame(box, answered);
      box.querySelectorAll('[data-pick]').forEach(button => button.onclick = () => {
        if (StudyStorage.paused || Number.isInteger(saved.selected)) return;
        snapshot(current, saved); saved.selected = Number(button.dataset.pick); saved.answeredAt = Date.now();
        if (save()) show();
      });
    } else {
      const revealed = !!saved.revealedAt;
      const box = el(`<article class="gen-step gen-step-ask"><span class="gen-step-kind">Explain it in your own words</span><h2 class="gen-ask-prompt">${step.prompt}</h2>
        <label for="cog-response">Your response</label><textarea id="cog-response" rows="4" ${revealed ? 'readonly' : ''}>${esc(saved.draft || '')}</textarea>
        ${revealed ? `<div class="gen-ask-reveal" role="status"><b>Authored comparison</b><p>${step.reveal}</p></div>` : '<button type="button" class="btn" id="cog-reveal">Compare with an example</button>'}</article>`);
      frame(box, revealed);
      const input = box.querySelector('textarea'), reveal = box.querySelector('#cog-reveal');
      if (!revealed) {
        reveal.disabled = !input.value.trim();
        input.oninput = () => { snapshot(current, saved); saved.draft = input.value; save(); reveal.disabled = !input.value.trim(); };
        reveal.onclick = () => { if (StudyStorage.paused || saved.revealedAt || !input.value.trim()) return; snapshot(current, saved); saved.revealedAt = Date.now(); if (save()) show(); };
      }
    }
    if (saved.content && JSON.stringify(saved.content) !== JSON.stringify(current)) {
      document.querySelector('#lesson-body').append(el('<p class="course-notice">This saved response belongs to an earlier wording of the lesson. Your original prompt and answer are preserved.</p>'));
    }
  }

  function finish() {
    cogRoute('lesson', id, 'done');
    const foundation = COG_LESSONS.filter(item => item.foundationOrder).sort((a,b) => a.foundationOrder-b.foundationOrder);
    const research = COG_LESSONS.filter(item => item.researchOrder).sort((a,b) => a.researchOrder-b.researchOrder);
    const sequence = lesson.foundationOrder || lesson.researchOrder ? [...foundation, ...research] : COG_LESSONS;
    const next = sequence[sequence.findIndex(item => item.id === id)+1];
    const answers = Object.values(record.steps).filter(step => Number.isInteger(step.selected));
    const correct = answers.filter(step => step.selected === step.content?.answer).length;
    const root = el('<div></div>'); root.appendChild(topbar('cogpsych'));
    const main = el(`<main class="panel gen-result" id="main" tabindex="-1"><div class="gen-res-box cornerframe"><span class="label">Lesson complete</span><h1 class="gen-res-sub">${esc(lesson.title)}</h1>
      <p>Completed <time datetime="${new Date(record.completedAt).toISOString()}">${new Date(record.completedAt).toLocaleString()}</time>.</p><p>${correct}/${answers.length} first answers correct. Completion and accuracy are separate.</p>
      <p>Your explanations and first answers are saved. Use Review my work to revisit them, then apply one idea to another study task.</p>
      <div class="gen-res-btns">${next ? `<button class="btn btn-solid" id="cog-next-lesson">Next: ${esc(next.title)} →</button>` : `<a class="btn btn-solid" href="${sectionUrl('socrates')}">Apply a strategy in Learn to Learn →</a>`}<button class="btn" id="cog-review">Review my work</button><button class="btn" id="cog-home">Course home</button></div>
      ${lesson.researchOrder ? `<div class="gen-res-btns"><button class="btn" id="cog-research-lab">Apply the methods in the research lab →</button>${(lesson.mcatLinks || []).map(link => { const url = new URL(sectionUrl('mcat'), location.origin); url.searchParams.set('view', 'course'); url.searchParams.set('unit', link.unitId); return `<a class="btn" href="${esc(url.pathname + url.search)}">MCAT: ${esc(link.title)}</a>`; }).join('')}</div>` : ''}
      <details class="cog-saved-responses"><summary>Saved responses</summary>${lesson.steps.map(step => record.steps[step.id]).filter(saved => saved?.draft).map(saved => `<p>${esc(saved.draft)}</p>`).join('') || '<p>No written response recorded.</p>'}</details>
    </div></main>`);
    const nextButton = main.querySelector('#cog-next-lesson'); if (nextButton) nextButton.onclick = () => renderCogLesson(next.id);
    main.querySelector('#cog-review').onclick = () => { idx = 0; show(); };
    main.querySelector('#cog-home').onclick = renderCogHome;
    const lab = main.querySelector('#cog-research-lab'); if (lab) lab.onclick = () => { cogRoute('research'); openCogResearch(); };
    root.append(main); setView(root);
  }
  show();
}
