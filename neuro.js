/* Cortex — Neuroengineering course */

const NEURO = { loaded: false, data: null, milestones: null, topicMap: {}, simMap: {}, codeMap: {} };
const NEURO_PROG = (typeof loadJSON === 'function') ? loadJSON('cs-neuro', {
  pathDone: [], topicQuiz: {}, topicAtlas: {}, sims: {}, code: {},
}) : { pathDone: [], topicQuiz: {}, topicAtlas: {}, sims: {}, code: {} };

function saveNeuroProg() { if (typeof safeSet === 'function') safeSet('cs-neuro', JSON.stringify(NEURO_PROG)); else localStorage.setItem('cs-neuro', JSON.stringify(NEURO_PROG)); }

async function loadNeuro() {
  if (NEURO.loaded) return;
  try {
    const [r, m] = await Promise.all([
      fetch('data/neuro.json', { cache: 'no-store' }),
      fetch('data/neuro-milestones.json', { cache: 'no-store' }),
    ]);
    NEURO.data = r.ok ? await r.json() : null;
    NEURO.milestones = m.ok ? await m.json() : null;
  } catch { NEURO.data = null; NEURO.milestones = null; }
  if (!NEURO.data) return;
  NEURO.topicMap = Object.fromEntries(NEURO.data.topics.map(t => [t.id, t]));
  NEURO.simMap = Object.fromEntries(NEURO.data.simulations.map(s => [s.id, s]));
  NEURO.codeMap = Object.fromEntries(NEURO.data.neuroCodeLessons.map(c => [c.id, c]));
  NEURO.loaded = true;
}

function neuroPath() { return NEURO.data?.learningPaths?.[0] || null; }
function neuroSubject(id) { return NEURO.data?.subjects?.find(s => s.id === id); }
function neuroTopic(id) { return NEURO.topicMap[id]; }
function neuroSim(id) { return NEURO.simMap[id]; }
function neuroCode(id) { return NEURO.codeMap[id]; }
function neuroUnitLesson(order) { return NEURO.data?.unitLessons?.[String(order)]; }

function pathProgress() {
  const path = neuroPath();
  if (!path) return { done: 0, total: 0, pct: 0, next: null };
  const done = NEURO_PROG.pathDone.length;
  const total = path.steps.length;
  const next = path.steps.find(s => !NEURO_PROG.pathDone.includes(s.id)) || null;
  return { done, total, pct: total ? Math.round(100 * done / total) : 0, next };
}

function topicQuizBest(id) {
  const r = NEURO_PROG.topicQuiz[id];
  return r ? `${r.c}/${r.t}` : null;
}

/* ---------- hub ---------- */

async function renderNeuroEngineering() {
  if (typeof stopTimer === 'function') stopTimer();
  if (typeof session !== 'undefined') session = null;
  await loadNeuro();

  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const path = neuroPath();
  const pg = pathProgress();
  const subjN = NEURO.data?.subjects?.length || 0;
  const topicN = NEURO.data?.topics?.length || 0;

  const main = el(`<main class="neuro-page">
    <section class="neuro-hero">
      <video class="neuro-video" autoplay loop muted playsinline preload="auto">
        <source src="assets/neuro-bg.mp4?v=2" type="video/mp4">
      </video>
      <div class="neuro-veil"></div>
      <div class="neuro-hero-inner">
        <span class="neuro-eyebrow">Neuroengineering &middot; Cortex Medical Academy</span>
        <h1>Where the mind meets the machine.</h1>
        <p class="neuro-lede">The Cortex Neuroengineering curriculum &mdash; ${topicN} topics across ${subjN} domains, the 20-unit BCI Builder Path, NeuroSim decision labs, and guided active recall.</p>
        <p class="neuro-tagline">Engineering the human brain &mdash; from first principles.</p>
        ${path ? `<div class="neuro-cta">
          <button class="btn btn-solid neuro-btn" id="ne-path">${pg.next ? `Continue BCI Builder &middot; Unit ${pg.next.order}` : 'BCI Builder Path complete'}</button>
          <button class="btn neuro-btn" id="ne-subjects">Browse subjects</button>
        </div>` : ''}
      </div>
    </section>
    <section class="neuro-body">
      ${path ? `<div class="neuro-pathband cornerframe">
        <div class="neuro-pathband-head">
          <span class="label">BCI Builder Path</span>
          <span class="neuro-pathstat">${pg.done}/${pg.total} units &middot; ${pg.pct}%</span>
        </div>
        <span class="bar"><i style="width:${pg.pct}%"></i></span>
        <p class="neuro-pathsum">${esc(path.summary)}</p>
      </div>` : ''}
      ${NEURO.milestones ? `<div class="neuro-practitioner cornerframe">
        <div class="neuro-pathband-head">
          <span class="label">Practitioner Track &middot; expert path</span>
          <span class="neuro-pathstat">${pg.done >= 7 ? 'Milestone 1 unlocking' : `Unlocks at unit 7 &middot; ${pg.done}/7`}</span>
        </div>
        <p class="neuro-pathsum">${esc(NEURO.milestones.tagline)}</p>
        <div class="neuro-milestones">${NEURO.milestones.milestones.map(ms => {
          const unlocked = pg.done >= ms.unlockUnit || ms.status === 'building';
          const active = ms.status === 'building';
          return `<div class="neuro-ms ${unlocked ? 'unlocked' : 'locked'} ${active ? 'active' : ''}">
            <span class="neuro-ms-phase">${esc(ms.phase)}</span>
            <span class="neuro-ms-title">${esc(ms.title)}</span>
            <span class="neuro-ms-sub">Unit ${ms.unlockUnit} &middot; ${esc(ms.shortDescription)}</span>
            ${active ? '<span class="neuro-ms-badge">Building now</span>' : unlocked ? '' : '<span class="neuro-ms-badge">Locked</span>'}
          </div>`;
        }).join('')}</div>
      </div>` : ''}
      <div class="neuro-hubtools">
        <button class="btn neuro-btn" id="ne-codelab">NeuroCode Lab &middot; ${NEURO.data?.neuroCodeLessons?.length || 12}</button>
        <button class="btn neuro-btn" id="ne-simlib">NeuroSim Labs &middot; ${NEURO.data?.simulations?.length || 12}</button>
      </div>
      <div class="neuro-grid" id="ne-grid"></div>
    </section>
  </main>`);

  const grid = main.querySelector('#ne-grid');
  if (!NEURO.data?.subjects?.length) {
    grid.appendChild(el('<div class="neuro-pt"><span class="np-name">Loading course&hellip;</span><p>Could not load neuroengineering content.</p></div>'));
  } else {
    for (const s of NEURO.data.subjects) {
      const done = (s.topicIds || []).filter(id => NEURO_PROG.topicQuiz[id]).length;
      const card = el(`<button class="neuro-pt neuro-subcard" style="--ne-accent:#${s.accentHex}">
        <span class="np-name">${esc(s.name)}</span>
        <p>${esc(s.summary)}</p>
        <span class="neuro-substat">${done ? `${done}/${s.topicIds.length} quizzed` : `${s.topicIds.length} topics`}</span>
      </button>`);
      card.addEventListener('click', () => renderNeuroSubject(s.id));
      grid.appendChild(card);
    }
  }

  if (path) {
    const go = main.querySelector('#ne-path');
    if (pg.next) go.addEventListener('click', () => renderNeuroUnit(pg.next.id));
    else go.disabled = true;
    main.querySelector('#ne-subjects')?.addEventListener('click', () => renderNeuroSubjects());
  }
  main.querySelector('#ne-codelab')?.addEventListener('click', renderNeuroCodeLab);
  main.querySelector('#ne-simlib')?.addEventListener('click', renderNeuroSimLibrary);
  root.appendChild(main);
  if (typeof siteFooter === 'function') root.appendChild(siteFooter());
  setView(root);

  const nv = root.querySelector('.neuro-video');
  if (nv) {
    nv.muted = true; nv.defaultMuted = true; nv.setAttribute('muted', '');
    const tryPlay = () => { try { const p = nv.play(); if (p?.catch) p.catch(() => {}); } catch {} };
    tryPlay();
    const kick = () => { tryPlay(); ['touchstart', 'click', 'scroll'].forEach(ev => window.removeEventListener(ev, kick)); };
    ['touchstart', 'click', 'scroll'].forEach(ev => window.addEventListener(ev, kick, { passive: true }));
  }
}

/* ---------- subjects ---------- */

function renderNeuroSubjects() {
  renderNeuroEngineering();
}

function renderNeuroSubject(subjectId) {
  const sub = neuroSubject(subjectId);
  if (!sub) { renderNeuroEngineering(); return; }
  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner">
    <section class="neuro-body">
      <button class="backbtn topback" id="neback">&larr; Neuroengineering</button>
      <span class="neuro-eyebrow">${esc(sub.name).toUpperCase()}</span>
      <h1 class="neuro-h1">${esc(sub.name)}.</h1>
      <p class="neuro-lede">${esc(sub.summary)}</p>
      <div class="neuro-rows" id="nerows"></div>
    </section>
  </main>`);
  main.querySelector('#neback').addEventListener('click', renderNeuroEngineering);
  const rows = main.querySelector('#nerows');
  for (const tid of sub.topicIds) {
    const t = neuroTopic(tid);
    if (!t) continue;
    const qb = topicQuizBest(tid);
    const row = el(`<button class="neuro-row">
      <span class="neuro-row-main"><span class="neuro-row-title">${esc(t.title)}</span><span class="neuro-row-sub">${t.quizQuestions?.length || 0} questions</span></span>
      <span class="neuro-row-right">${qb ? `<span class="pill ok">${qb}</span>` : '<span class="mod-go">&rarr;</span>'}</span>
    </button>`);
    row.addEventListener('click', () => renderNeuroTopic(tid));
    rows.appendChild(row);
  }
  root.appendChild(main);
  setView(root);
}

/* ---------- topic hub ---------- */

function renderNeuroTopic(topicId) {
  const t = neuroTopic(topicId);
  if (!t) { renderNeuroEngineering(); return; }
  const sub = neuroSubject(t.subjectId);
  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner">
    <section class="neuro-body">
      <button class="backbtn topback" id="neback">&larr; ${esc(sub?.name || 'Subjects')}</button>
      <span class="neuro-eyebrow">${esc(sub?.name || '').toUpperCase()}</span>
      <h1 class="neuro-h1">${esc(t.title)}</h1>
      <p class="neuro-lede">${esc(t.oneLineMaster)}</p>
      <div class="neuro-block"><span class="label">Explanation</span><p class="neuro-prose">${esc(t.explanation)}</p></div>
      <div class="neuro-block"><span class="label">Clinical relevance</span><p class="neuro-prose">${esc(t.clinicalRelevance)}</p></div>
      ${t.vocabulary?.length ? `<div class="neuro-block"><span class="label">Vocabulary</span><div class="neuro-vocab">${t.vocabulary.map(v => `<div class="neuro-vterm"><span class="k">${esc(v.term)}</span><span>${esc(v.definition)}</span></div>`).join('')}</div></div>` : ''}
      <div class="neuro-actions">
        <button class="btn btn-solid neuro-btn" id="ne-atlas">Socratic study</button>
        <button class="btn neuro-btn" id="ne-quiz">Quiz &middot; ${t.quizQuestions?.length || 0}</button>
      </div>
    </section>
  </main>`);
  main.querySelector('#neback').addEventListener('click', () => renderNeuroSubject(t.subjectId));
  main.querySelector('#ne-atlas').addEventListener('click', () => renderNeuroAtlas(topicId));
  main.querySelector('#ne-quiz').addEventListener('click', () => renderNeuroQuiz(topicId));
  root.appendChild(main);
  setView(root);
}

/* ---------- Socratic study ---------- */

let neAtlas = null;
function renderNeuroAtlas(topicId) {
  const t = neuroTopic(topicId);
  if (!t?.socraticPrompts?.length) { renderNeuroTopic(topicId); return; }
  neAtlas = { topicId, prompts: t.socraticPrompts, idx: 0 };
  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner">
    <section class="neuro-body">
      <button class="backbtn topback" id="neback">&larr; ${esc(t.title)}</button>
      <span class="neuro-eyebrow">Socratic &middot; ${esc(t.title).toUpperCase()}</span>
      <h1 class="neuro-h1">Socratic study.</h1>
      <div class="neuro-dots" id="nedots"></div>
      <div id="nestages"></div>
    </section>
  </main>`);
  main.querySelector('#neback').addEventListener('click', () => renderNeuroTopic(topicId));
  root.appendChild(main);
  setView(root);
  neuroAtlasDots();
  neuroAtlasAppend();
}

function neuroAtlasDots() {
  const dots = document.getElementById('nedots');
  if (!dots || !neAtlas) return;
  dots.replaceChildren();
  neAtlas.prompts.forEach((_, i) => dots.appendChild(el(`<span class="neuro-dot ${i < neAtlas.idx ? 'past' : i === neAtlas.idx ? 'now' : ''}"></span>`)));
}

function neuroAtlasAppend() {
  if (!neAtlas || neAtlas.idx >= neAtlas.prompts.length) return neuroAtlasFinish();
  const s = neAtlas.prompts[neAtlas.idx];
  const isLast = neAtlas.idx === neAtlas.prompts.length - 1;
  const node = el(`<section class="neuro-stage">
    <div class="stage-head"><span class="label">Prompt ${neAtlas.idx + 1}</span><span class="rule"></span></div>
    <p class="q">${esc(s.question)}</p>
    <textarea class="socinput neuro-input" rows="3" placeholder="Reason it out first&hellip;"></textarea>
    <div class="socactions">
      ${s.hint ? '<button class="btn neuro-btn" data-hint>Hint</button>' : ''}
      <button class="btn btn-solid neuro-btn" data-reveal>Reveal</button>
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
    node.querySelector('.socactions')?.remove();
    after.appendChild(el(`<div class="socans"><div class="socblock"><span class="label">Answer</span><p>${esc(s.answer)}</p></div></div>`));
    const row = el(`<div class="continue-row"><button class="btn btn-solid neuro-btn" data-cont>${isLast ? 'Finish study' : 'Next'}</button></div>`);
    row.querySelector('[data-cont]').addEventListener('click', () => { neAtlas.idx++; neuroAtlasDots(); neuroAtlasAppend(); });
    after.appendChild(row);
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  document.getElementById('nestages').appendChild(node);
  if (neAtlas.idx > 0) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function neuroAtlasFinish() {
  NEURO_PROG.topicAtlas[neAtlas.topicId] = true;
  saveNeuroProg();
  const t = neuroTopic(neAtlas.topicId);
  const node = el(`<section class="neuro-stage">
    <span class="label">Study complete</span>
    <div class="neuro-score">&#10003;</div>
    <p class="neuro-prose">${esc(t?.oneLineMaster || '')}</p>
    <div class="endbtns">
      <button class="btn btn-solid neuro-btn" id="neq">Take quiz</button>
      <button class="btn neuro-btn" id="net">Back to topic</button>
    </div>
  </section>`);
  node.querySelector('#neq').addEventListener('click', () => renderNeuroQuiz(neAtlas.topicId));
  node.querySelector('#net').addEventListener('click', () => renderNeuroTopic(neAtlas.topicId));
  document.getElementById('nestages').appendChild(node);
  node.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- quiz ---------- */

let neQuiz = null;
function renderNeuroQuiz(topicId, opts = {}) {
  const t = neuroTopic(topicId);
  if (!t?.quizQuestions?.length) { if (opts.onDone) opts.onDone(false); else renderNeuroTopic(topicId); return; }
  const qs = [...t.quizQuestions];
  if (opts.limit) qs.length = Math.min(opts.limit, qs.length);
  neQuiz = { topicId, qs, idx: 0, correct: 0, results: [], onDone: opts.onDone, mount: opts.mount || null, dotsEl: null, stagesEl: null };
  if (opts.mount) {
    const mount = typeof opts.mount === 'string' ? document.querySelector(opts.mount) : opts.mount;
    if (!mount) { if (opts.onDone) opts.onDone(false); return; }
    const wrap = el(`<section class="neuro-stage neuro-embed"><span class="label">Mini quiz</span><div class="neuro-dots" data-neuro-dots></div><div data-neuro-quiz-stages></div></section>`);
    mount.appendChild(wrap);
    neQuiz.dotsEl = wrap.querySelector('[data-neuro-dots]');
    neQuiz.stagesEl = wrap.querySelector('[data-neuro-quiz-stages]');
    neuroQuizDots();
    neuroQuizAppend();
    return;
  }
  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner">
    <section class="neuro-body">
      <button class="backbtn topback" id="neback">&larr; ${esc(t.title)}</button>
      <span class="neuro-eyebrow">Quiz &middot; ${esc(t.title).toUpperCase()}</span>
      <div class="neuro-dots" id="nedots"></div>
      <div id="neqstages"></div>
    </section>
  </main>`);
  main.querySelector('#neback').addEventListener('click', () => renderNeuroTopic(topicId));
  root.appendChild(main);
  setView(root);
  neuroQuizDots();
  neuroQuizAppend();
}

function neuroQuizDots() {
  const dots = neQuiz?.dotsEl || document.getElementById('nedots');
  if (!dots || !neQuiz) return;
  dots.replaceChildren();
  neQuiz.qs.forEach((_, i) => {
    const r = neQuiz.results[i];
    const cls = r ? (r.correct ? 'ok' : 'no') : (i === neQuiz.idx ? 'now' : '');
    dots.appendChild(el(`<span class="neuro-dot ${cls}"></span>`));
  });
}

function neuroQuizAppend() {
  if (!neQuiz) return;
  if (neQuiz.idx >= neQuiz.qs.length) return neuroQuizFinish();
  const q = neQuiz.qs[neQuiz.idx];
  const shuffled = q.choices.map((c, i) => ({ c, i })).sort(() => Math.random() - 0.5);
  const node = el(`<section class="neuro-stage">
    <div class="stage-head"><span class="label">Q${neQuiz.idx + 1} / ${neQuiz.qs.length}</span><span class="rule"></span></div>
    <p class="q">${esc(q.prompt)}</p>
    <div class="opts">${shuffled.map((o, n) => `<button class="opt" data-i="${o.i}"><span class="key">${LETTERS[n]}</span><span>${esc(o.c)}</span></button>`).join('')}</div>
    <div class="after"></div>
  </section>`);
  node.querySelectorAll('.opt').forEach(btn => btn.addEventListener('click', () => {
    if (neQuiz.results[neQuiz.idx]) return;
    const choice = Number(btn.dataset.i);
    const correct = choice === q.correctIndex;
    neQuiz.results[neQuiz.idx] = { correct };
    if (correct) neQuiz.correct++;
    node.querySelectorAll('.opt').forEach(b => {
      const i = Number(b.dataset.i);
      b.disabled = true;
      if (i === q.correctIndex) b.classList.add('correct');
      else if (i === choice) b.classList.add('wrong');
      else b.classList.add('dimmed');
    });
    const after = node.querySelector('.after');
    after.appendChild(el(`<div class="explain ${correct ? 'good' : 'bad'}"><span class="verdict">${correct ? 'CORRECT' : 'INCORRECT'}</span><p>${esc(q.explanation)}</p>${q.wrongAnswerHint && !correct ? `<p class="neuro-hint">${esc(q.wrongAnswerHint)}</p>` : ''}</div>`));
    const row = el(`<div class="continue-row"><button class="btn btn-solid neuro-btn" data-cont>${neQuiz.idx === neQuiz.qs.length - 1 ? 'Finish' : 'Next'}</button></div>`);
    const contBtn = row.querySelector('[data-cont]');
    contBtn.addEventListener('click', () => {
      if (!neQuiz || contBtn.disabled) return;
      contBtn.disabled = true;
      neQuiz.idx++; neuroQuizDots(); neuroQuizAppend();
    });
    after.appendChild(row);
    neuroQuizDots();
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }));
  (neQuiz.stagesEl || document.getElementById('neqstages')).appendChild(node);
  if (neQuiz.idx > 0) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function neuroQuizFinish() {
  if (!neQuiz) return;
  const { topicId, correct, qs, onDone } = neQuiz;
  const prev = NEURO_PROG.topicQuiz[topicId];
  if (!prev || correct > prev.c) NEURO_PROG.topicQuiz[topicId] = { c: correct, t: qs.length, ts: Date.now() };
  saveNeuroProg();
  if (onDone) { onDone(correct === qs.length); neQuiz = null; return; }
  const node = el(`<section class="neuro-stage">
    <span class="label">Quiz complete</span>
    <div class="neuro-score">${String(correct).padStart(2, '0')}<span class="of">/${String(qs.length).padStart(2, '0')}</span></div>
    <div class="endbtns">
      <button class="btn btn-solid neuro-btn" id="ner">Retry</button>
      <button class="btn neuro-btn" id="net">Back to topic</button>
    </div>
  </section>`);
  node.querySelector('#ner').addEventListener('click', () => renderNeuroQuiz(topicId));
  node.querySelector('#net').addEventListener('click', () => renderNeuroTopic(topicId));
  (neQuiz.stagesEl || document.getElementById('neqstages')).appendChild(node);
  node.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- NeuroSim ---------- */

function renderNeuroSim(simId, opts = {}) {
  const sim = neuroSim(simId);
  if (!sim) { if (opts.onDone) opts.onDone(false); else renderNeuroEngineering(); return; }
  let main, optsEl, afterMount;
  if (opts.mount) {
    const mount = typeof opts.mount === 'string' ? document.querySelector(opts.mount) : opts.mount;
    if (!mount) { if (opts.onDone) opts.onDone(false); return; }
    main = el(`<section class="neuro-stage">
      <span class="neuro-eyebrow">NeuroSim &middot; ${esc(sim.difficulty || 'lab')}</span>
      <h2 class="neuro-h2">${esc(sim.title)}</h2>
      <div class="neuro-block"><span class="label">Scenario</span><p class="neuro-prose">${esc(sim.scenario)}</p></div>
      <div class="neuro-block"><span class="label">Signal</span><p class="neuro-mono">${esc(sim.signalDescription)}</p></div>
      <p class="q">${esc(sim.decisionQuestion)}</p>
      <div class="opts" id="nesimopts"></div><div id="nesimafter"></div>
    </section>`);
    mount.appendChild(main);
    optsEl = main.querySelector('#nesimopts');
    afterMount = main.querySelector('#nesimafter');
  } else {
    const root = el('<div></div>');
    root.appendChild(topbar('neuro'));
    main = el(`<main class="neuro-page neuro-inner">
      <section class="neuro-body">
        <button class="backbtn topback" id="neback">&larr; Neuroengineering</button>
        <span class="neuro-eyebrow">NeuroSim &middot; ${esc(sim.difficulty || 'lab')}</span>
        <h1 class="neuro-h1">${esc(sim.title)}</h1>
        <div class="neuro-block"><span class="label">Scenario</span><p class="neuro-prose">${esc(sim.scenario)}</p></div>
        <div class="neuro-block"><span class="label">Signal</span><p class="neuro-mono">${esc(sim.signalDescription)}</p></div>
        <p class="q">${esc(sim.decisionQuestion)}</p>
        <div class="opts" id="nesimopts"></div>
        <div id="nesimafter"></div>
      </section>
    </main>`);
    main.querySelector('#neback').addEventListener('click', renderNeuroEngineering);
    root.appendChild(main);
    setView(root);
    optsEl = main.querySelector('#nesimopts');
    afterMount = main.querySelector('#nesimafter');
  }
  sim.choices.forEach((ch, i) => {
    const btn = el(`<button class="opt"><span class="key">${LETTERS[i]}</span><span>${esc(ch.label)}</span></button>`);
    btn.addEventListener('click', () => {
      optsEl.querySelectorAll('.opt').forEach(b => { b.disabled = true; b.classList.add('dimmed'); });
      const ok = i === sim.bestAnswerIndex;
      btn.classList.remove('dimmed');
      btn.classList.add(ok ? 'correct' : 'wrong');
      if (!ok) optsEl.querySelectorAll('.opt')[sim.bestAnswerIndex]?.classList.add('correct');
      NEURO_PROG.sims[simId] = { ok, ts: Date.now() };
      saveNeuroProg();
      afterMount.replaceChildren(el(`<div class="explain ${ok ? 'good' : 'bad'}"><span class="verdict">${ok ? 'CORRECT' : 'INCORRECT'}</span><p>${esc(ch.rationale)}</p></div>
        <div class="neuro-block"><span class="label">One-line master</span><p class="neuro-prose">${esc(sim.oneLineMaster)}</p></div>
        <div class="continue-row"><button class="btn btn-solid neuro-btn" id="nesimdone">Continue</button></div>`));
      afterMount.querySelector('#nesimdone')?.addEventListener('click', () => {
        if (opts.onDone) opts.onDone(ok);
        else renderNeuroEngineering();
      });
      afterMount.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    optsEl.appendChild(btn);
  });
}

/* ---------- NeuroCode Lab (guided sandbox) ---------- */

function neuroCodePassed(codeId) {
  const r = NEURO_PROG.code[codeId];
  return r === true || (r && r.passed);
}

function mountNeuroCodeSandbox(lesson, codeId, opts, shell) {
  if (typeof neuroCodeEvaluateOJT !== 'function') return;
  const guidance = neuroCodeGuidance(lesson);
  let codePassed = neuroCodePassed(codeId);
  const starterCode = (lesson.codeExample || '').trim();

  const sandbox = el(`<div class="neuro-sandbox">
    <div class="neuro-sandbox-head">
      <span class="label">OJT code lab &middot; Python 3</span>
      <span class="neuro-sandbox-badge" data-pass-badge ${codePassed ? '' : 'hidden'}>Complete</span>
    </div>
    <p class="neuro-sandbox-note">On-the-job style practice: edit the script, <strong>Run</strong> to execute real Python in-browser, <strong>Check</strong> to validate stdout against the reference solution.</p>
    <div class="neuro-sandbox-goals">
      <span class="neuro-mono">${esc(guidance.exerciseType)}</span>
      <span>Coding: ${esc(guidance.codingGoal)}</span>
      <span>Neuro: ${esc(guidance.neuroengineeringGoal)}</span>
    </div>
    <div class="neuro-ojt-brief">
      <span class="label">Ticket</span>
      <p class="neuro-prose">${esc(lesson.challengePrompt)}</p>
    </div>
    <textarea class="neuro-code-draft" rows="14" spellcheck="false" aria-label="Python editor">${esc(starterCode)}</textarea>
    <div class="neuro-terminal neuro-ojt-terminal">
      <div class="neuro-terminal-bar">
        <span class="neuro-terminal-dot"></span>
        <span class="neuro-terminal-title">bci-lab@cortex &mdash; task.py</span>
        <span class="neuro-terminal-status" data-py-status>Python idle</span>
      </div>
      <div class="neuro-terminal-log" data-term-log>
        <div class="neuro-term-line muted"># OJT lab ready. Run executes Python 3 (Pyodide). Check compares stdout to the reference.</div>
      </div>
      <p class="neuro-terminal-msg" data-term-msg>Load the runtime on first Run.</p>
      <p class="neuro-terminal-hint" data-term-hint>Tip: solve the ticket, run it, then Check before loading the solution.</p>
    </div>
    <div class="neuro-sandbox-actions">
      <button class="btn btn-solid neuro-btn" data-run-code>Run</button>
      <button class="btn neuro-btn" data-check-code>Check</button>
      <button class="btn neuro-btn" data-reset-code>Reset starter</button>
      <button class="btn neuro-btn" data-predict-out>Predict output</button>
      <button class="btn neuro-btn" data-copy-code>Copy code</button>
      <button class="btn neuro-btn" data-load-sol>Load solution</button>
      <button class="btn neuro-btn" data-show-hint>Hint</button>
      <button class="btn neuro-btn" data-show-sol>Reveal solution</button>
    </div>
    <div class="neuro-sandbox-extra" data-extra></div>
    ${opts.requirePass ? '<p class="neuro-sandbox-gate" data-gate>Pass Check to continue this unit.</p>' : ''}
    <div class="continue-row" data-continue-row ${opts.requirePass && !codePassed ? 'hidden' : ''}>
      <button class="btn btn-solid neuro-btn" data-code-done>Continue</button>
    </div>
  </div>`);

  const draft = sandbox.querySelector('.neuro-code-draft');
  const termLog = sandbox.querySelector('[data-term-log]');
  const termMsg = sandbox.querySelector('[data-term-msg]');
  const termHint = sandbox.querySelector('[data-term-hint]');
  const pyStatus = sandbox.querySelector('[data-py-status]');
  const extra = sandbox.querySelector('[data-extra]');
  const passBadge = sandbox.querySelector('[data-pass-badge]');
  const continueRow = sandbox.querySelector('[data-continue-row]');
  const gate = sandbox.querySelector('[data-gate]');
  const runBtn = sandbox.querySelector('[data-run-code]');
  const checkBtn = sandbox.querySelector('[data-check-code]');
  let busy = false;

  const setBusy = (on, label) => {
    busy = on;
    runBtn.disabled = on;
    checkBtn.disabled = on;
    if (label) pyStatus.textContent = label;
  };

  const appendTerm = (cls, text) => {
    const line = el(`<div class="neuro-term-line ${cls}"></div>`);
    line.textContent = text;
    termLog.appendChild(line);
    termLog.scrollTop = termLog.scrollHeight;
  };

  const showRunResult = (result, label) => {
    appendTerm('cmd', `$ ${label}`);
    if (result.stdout) appendTerm('out', result.stdout.trimEnd());
    if (result.stderr) appendTerm('err', result.stderr.trimEnd());
    if (!result.stdout && !result.stderr) appendTerm('muted', '(no output)');
  };

  const markPassed = () => {
    codePassed = true;
    NEURO_PROG.code[codeId] = { passed: true, ts: Date.now() };
    saveNeuroProg();
    passBadge.hidden = false;
    if (opts.requirePass) {
      continueRow.hidden = false;
      gate?.remove();
    }
  };

  const runCode = async () => {
    if (busy) return;
    setBusy(true, 'Running…');
    termMsg.textContent = 'Executing Python 3…';
    try {
      const result = await runPythonCode(draft.value, {
        onStatus: (s) => { pyStatus.textContent = s; },
      });
      showRunResult(result, 'python task.py');
      termMsg.textContent = result.ok ? 'Run complete.' : 'Run failed — read stderr above.';
      termMsg.classList.toggle('ok', result.ok);
      termMsg.classList.toggle('bad', !result.ok);
      pyStatus.textContent = result.ok ? 'Python ready' : 'Python error';
    } catch (e) {
      appendTerm('err', e?.message || String(e));
      termMsg.textContent = 'Could not load Python runtime.';
      termMsg.classList.add('bad');
      pyStatus.textContent = 'Runtime error';
    } finally {
      setBusy(false);
    }
  };

  const checkCode = async () => {
    if (busy) return;
    setBusy(true, 'Checking…');
    termMsg.textContent = 'Running Check against reference solution…';
    try {
      const feedback = await neuroCodeEvaluateOJT(draft.value, lesson, (s) => {
        pyStatus.textContent = s;
      });
      if (feedback.stdout || feedback.stderr) {
        showRunResult({
          ok: !feedback.stderr || feedback.passed,
          stdout: feedback.stdout,
          stderr: feedback.stderr,
        }, 'python task.py  # check');
      }
      if (feedback.targetOutput && !feedback.passed) {
        appendTerm('muted', `# reference stdout:\n${feedback.targetOutput.trim()}`);
      }
      termMsg.textContent = feedback.message;
      termHint.textContent = feedback.explanation;
      termMsg.classList.toggle('ok', feedback.passed);
      termMsg.classList.toggle('bad', !feedback.passed);
      pyStatus.textContent = feedback.passed ? 'Check passed' : 'Check failed';
      if (feedback.passed) markPassed();
    } catch (e) {
      appendTerm('err', e?.message || String(e));
      termMsg.textContent = 'Check failed — runtime unavailable.';
      termMsg.classList.add('bad');
    } finally {
      setBusy(false);
    }
  };

  runBtn.addEventListener('click', runCode);
  checkBtn.addEventListener('click', checkCode);
  sandbox.querySelector('[data-reset-code]').addEventListener('click', () => {
    draft.value = starterCode;
    appendTerm('muted', '# reset to starter code');
  });
  sandbox.querySelector('[data-predict-out]').addEventListener('click', e => {
    const on = e.target.textContent.includes('Hide');
    e.target.textContent = on ? 'Predict output' : 'Hide expected output';
    extra.querySelector('[data-predict]')?.remove();
    if (!on) {
      extra.appendChild(el(`<div class="neuro-block" data-predict><span class="label">Expected output</span><pre class="neuro-code">${esc(lesson.expectedOutput)}</pre></div>`));
    }
  });
  sandbox.querySelector('[data-copy-code]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(draft.value); } catch {}
  });
  sandbox.querySelector('[data-load-sol]').addEventListener('click', () => {
    draft.value = (lesson.solution || '').trim();
    appendTerm('muted', '# solution loaded into editor');
    termMsg.textContent = 'Solution loaded. Run, then Check when ready.';
    termHint.textContent = guidance.successExplanation;
  });
  sandbox.querySelector('[data-show-hint]').addEventListener('click', e => {
    e.target.disabled = true;
    extra.appendChild(el(`<div class="sochint"><span class="label">Hint</span><p>${esc(lesson.hint)}</p></div>`));
  });
  sandbox.querySelector('[data-show-sol]').addEventListener('click', e => {
    e.target.disabled = true;
    extra.appendChild(el(`<div class="neuro-block"><span class="label">Solution</span><pre class="neuro-code">${esc(lesson.solution)}</pre></div>`));
  });
  sandbox.querySelector('[data-code-done]')?.addEventListener('click', () => {
    if (opts.requirePass && !codePassed) return;
    if (opts.onDone) opts.onDone(codePassed);
    else if (!opts.mount) renderNeuroCodeLab();
  });

  shell.appendChild(sandbox);
}

function renderNeuroCode(codeId, opts = {}) {
  const lesson = neuroCode(codeId);
  if (!lesson) { if (opts.onDone) opts.onDone(false); else renderNeuroEngineering(); return; }

  const conceptBlock = `<div class="neuro-block"><span class="label">Concept</span><p class="neuro-prose">${esc(lesson.explanation)}</p>
    <p class="neuro-mono">${esc(lesson.codingConcept)} &middot; ${esc(lesson.neuroengineeringConcept)}</p></div>
    <div class="neuro-block"><span class="label">Code example</span><pre class="neuro-code">${esc(lesson.codeExample)}</pre></div>
    <div class="neuro-block"><span class="label">Challenge</span><p class="neuro-prose">${esc(lesson.challengePrompt)}</p></div>`;

  if (opts.mount) {
    const mount = typeof opts.mount === 'string' ? document.querySelector(opts.mount) : opts.mount;
    if (!mount) { if (opts.onDone) opts.onDone(false); return; }
    const wrap = el(`<section class="neuro-stage neuro-embed">
      <span class="neuro-eyebrow">NeuroCode &middot; ${esc(lesson.codingConcept)}</span>
      <h2 class="neuro-h2">${esc(lesson.title)}</h2>
      ${conceptBlock}
    </section>`);
    mount.appendChild(wrap);
    mountNeuroCodeSandbox(lesson, codeId, opts, wrap);
    return;
  }

  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner">
    <section class="neuro-body">
      <button class="backbtn topback" id="neback">&larr; NeuroCode Lab</button>
      <span class="neuro-eyebrow">NeuroCode &middot; ${esc(lesson.codingConcept)}</span>
      <h1 class="neuro-h1">${esc(lesson.title)}</h1>
      ${conceptBlock}
      <p class="neuro-mono neuro-master">${esc(lesson.oneLineMaster)}</p>
    </section>
  </main>`);
  main.querySelector('#neback').addEventListener('click', renderNeuroCodeLab);
  mountNeuroCodeSandbox(lesson, codeId, opts, main.querySelector('.neuro-body'));
  root.appendChild(main);
  setView(root);
}

function renderNeuroCodeLab() {
  const lessons = NEURO.data?.neuroCodeLessons || [];
  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner">
    <section class="neuro-body">
      <button class="backbtn topback" id="neback">&larr; Neuroengineering</button>
      <span class="neuro-eyebrow">NeuroCode Lab</span>
      <h1 class="neuro-h1">Guided code practice.</h1>
      <p class="neuro-lede">Twelve OJT Python tickets wired to neuroengineering workflows. Real Python 3 in-browser &mdash; run code, read stdout, pass Check against the reference.</p>
      <div class="neuro-rows" id="necodelab"></div>
    </section>
  </main>`);
  main.querySelector('#neback').addEventListener('click', renderNeuroEngineering);
  const rows = main.querySelector('#necodelab');
  for (const lesson of lessons) {
    const done = neuroCodePassed(lesson.id);
    const row = el(`<button class="neuro-row">
      <span class="neuro-row-main"><span class="neuro-row-title">${esc(lesson.title)}</span>
      <span class="neuro-row-sub">${esc(lesson.codingConcept)} &middot; ${esc(lesson.difficulty || 'beginner')}</span></span>
      <span class="neuro-row-right">${done ? '<span class="pill ok">passed</span>' : '<span class="mod-go">&rarr;</span>'}</span>
    </button>`);
    row.addEventListener('click', () => renderNeuroCode(lesson.id));
    rows.appendChild(row);
  }
  root.appendChild(main);
  setView(root);
}

function renderNeuroSimLibrary() {
  const sims = NEURO.data?.simulations || [];
  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner">
    <section class="neuro-body">
      <button class="backbtn topback" id="neback">&larr; Neuroengineering</button>
      <span class="neuro-eyebrow">NeuroSim Labs</span>
      <h1 class="neuro-h1">Decision labs.</h1>
      <p class="neuro-lede">Twelve short NeuroSim scenarios &mdash; signal interpretation, decoder drift, DBS side effects, ethics, and more.</p>
      <div class="neuro-rows" id="nesimlib"></div>
    </section>
  </main>`);
  main.querySelector('#neback').addEventListener('click', renderNeuroEngineering);
  const rows = main.querySelector('#nesimlib');
  for (const sim of sims) {
    const prev = NEURO_PROG.sims[sim.id];
    const row = el(`<button class="neuro-row">
      <span class="neuro-row-main"><span class="neuro-row-title">${esc(sim.title)}</span>
      <span class="neuro-row-sub">${esc(sim.difficulty || 'lab')} &middot; ${esc((sim.scoringCategories || []).join(', ') || 'decision')}</span></span>
      <span class="neuro-row-right">${prev ? `<span class="pill ${prev.ok ? 'ok' : 'no'}">${prev.ok ? 'ok' : 'retry'}</span>` : '<span class="mod-go">&rarr;</span>'}</span>
    </button>`);
    row.addEventListener('click', () => renderNeuroSim(sim.id));
    rows.appendChild(row);
  }
  root.appendChild(main);
  setView(root);
}

/* ---------- BCI Builder unit (guided path) ---------- */

let neUnit = null;
const UNIT_STAGE_ORDER = ['orientation', 'lesson', 'mental', 'worked', 'recall', 'quiz', 'code', 'sim', 'debrief'];

function renderNeuroUnit(stepId) {
  const path = neuroPath();
  const step = path?.steps?.find(s => s.id === stepId);
  if (!step) { renderNeuroEngineering(); return; }
  const topic = neuroTopic(step.topicId);
  const unit = neuroUnitLesson(step.order);
  neUnit = { step, topic, unit, stageIdx: 0, recallIdx: 0 };
  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner">
    <section class="neuro-body">
      <button class="backbtn topback" id="neback">&larr; Neuroengineering</button>
      <span class="neuro-eyebrow">BCI Builder &middot; Unit ${step.order} / ${path.steps.length}</span>
      <h1 class="neuro-h1">${esc(step.title)}</h1>
      <div class="neuro-runbar cornerframe"><div class="cs-runbar-meta"><span class="label">Unit progress</span><span id="neunitlab">Starting</span></div><span class="bar"><i id="neunitfill" style="width:0%"></i></span></div>
      <div id="neunitstages"></div>
    </section>
  </main>`);
  main.querySelector('#neback').addEventListener('click', renderNeuroEngineering);
  root.appendChild(main);
  setView(root);
  neuroUnitStages();
  neuroUnitAppend();
}

function neuroUnitStages() {
  if (!neUnit) return [];
  const { step, unit } = neUnit;
  const stages = ['orientation', 'lesson', 'mental', 'worked', 'recall'];
  if (step.topicId && neuroTopic(step.topicId)?.quizQuestions?.length) stages.push('quiz');
  if (step.neuroCodeLessonId) stages.push('code');
  if (step.simulationId) stages.push('sim');
  stages.push('debrief');
  neUnit.stages = stages;
  return stages;
}

function neuroUnitProgress() {
  if (!neUnit) return;
  const total = neUnit.stages.length;
  const pct = Math.round(100 * neUnit.stageIdx / total);
  const fill = document.getElementById('neunitfill');
  const lab = document.getElementById('neunitlab');
  if (fill) fill.style.width = `${pct}%`;
  if (lab) lab.textContent = `Stage ${Math.min(neUnit.stageIdx + 1, total)} / ${total}`;
}

function neuroUnitAppend() {
  neuroUnitStages();
  neuroUnitProgress();
  if (!neUnit || neUnit.stageIdx >= neUnit.stages.length) return neuroUnitFinish();
  const stage = neUnit.stages[neUnit.stageIdx];
  const { step, topic, unit } = neUnit;
  const container = document.getElementById('neunitstages');
  let node;

  if (stage === 'orientation') {
    node = el(`<section class="neuro-stage"><span class="label">Orientation</span>
      <p class="neuro-prose">${esc(step.explanation)}</p>
      <div class="neuro-kv"><span>Objective</span><span>${esc(step.stepObjective)}</span></div>
      <div class="neuro-kv"><span>Focus</span><span>${esc(step.estimatedFocus)}</span></div>
      <p class="neuro-mono">${esc(step.oneLineMaster)}</p>
      <div class="continue-row"><button class="btn btn-solid neuro-btn" data-cont>Continue</button></div></section>`);
  } else if (stage === 'lesson' && unit) {
    node = el(`<section class="neuro-stage"><span class="label">Short lesson</span>
      <div class="neuro-block"><span class="label">Why it matters</span><p class="neuro-prose">${esc(unit.whyItMatters)}</p></div>
      <p class="neuro-prose">${esc(unit.shortLesson)}</p>
      ${unit.keyTerms?.length ? `<div class="neuro-tags">${unit.keyTerms.map(t => `<span class="cs-chip">${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="continue-row"><button class="btn btn-solid neuro-btn" data-cont>Continue</button></div></section>`);
  } else if (stage === 'mental' && unit) {
    node = el(`<section class="neuro-stage"><span class="label">Mental model</span><p class="neuro-prose">${esc(unit.mentalModel)}</p>
      <div class="continue-row"><button class="btn btn-solid neuro-btn" data-cont>Continue</button></div></section>`);
  } else if (stage === 'worked' && unit) {
    node = el(`<section class="neuro-stage"><span class="label">Worked example</span><p class="neuro-mono">${esc(unit.workedExample)}</p>
      <div class="neuro-block"><span class="label">Common mistake</span><p class="neuro-prose">${esc(unit.commonMistake)}</p></div>
      <div class="continue-row"><button class="btn btn-solid neuro-btn" data-cont>Continue</button></div></section>`);
  } else if (stage === 'recall' && unit) {
    const prompts = unit.activeRecallPrompts || [];
    if (neUnit.recallIdx >= prompts.length) { neUnit.stageIdx++; neUnit.recallIdx = 0; neuroUnitAppend(); return; }
    const p = prompts[neUnit.recallIdx];
    const isLast = neUnit.recallIdx === prompts.length - 1;
    node = el(`<section class="neuro-stage"><span class="label">Active recall ${neUnit.recallIdx + 1}</span>
      <p class="q">${esc(p.prompt)}</p>
      <textarea class="socinput neuro-input" rows="2" placeholder="Answer first&hellip;"></textarea>
      <div class="socactions"><button class="btn neuro-btn" data-hint>Hint</button><button class="btn btn-solid neuro-btn" data-reveal>Reveal</button></div>
      <div class="socafter"></div></section>`);
    const after = node.querySelector('.socafter');
    node.querySelector('[data-hint]').addEventListener('click', e => { e.target.disabled = true; after.appendChild(el(`<div class="sochint"><span class="label">Hint</span><p>${esc(p.hint)}</p></div>`)); });
    node.querySelector('[data-reveal]').addEventListener('click', () => {
      node.querySelector('.socactions')?.remove();
      after.appendChild(el(`<div class="socans"><div class="socblock"><span class="label">Answer</span><p>${esc(p.answer)}</p></div></div>`));
      const row = el(`<div class="continue-row"><button class="btn btn-solid neuro-btn" data-cont>${isLast ? 'Continue' : 'Next'}</button></div>`);
      row.querySelector('[data-cont]').addEventListener('click', () => { neUnit.recallIdx++; neuroUnitAppend(); });
      after.appendChild(row);
    });
    container.appendChild(node);
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  } else if (stage === 'quiz') {
    renderNeuroQuiz(step.topicId, {
      limit: 2,
      mount: container,
      onDone: (ok) => {
        if (!ok) return;
        neUnit.stageIdx++; neuroUnitProgress(); neuroUnitAppend();
      },
    });
    return;
  } else if (stage === 'code') {
    renderNeuroCode(step.neuroCodeLessonId, {
      mount: container,
      requirePass: true,
      onDone: (ok) => {
        if (!ok) return;
        neUnit.stageIdx++; neuroUnitProgress(); neuroUnitAppend();
      },
    });
    return;
  } else if (stage === 'sim') {
    renderNeuroSim(step.simulationId, {
      mount: container,
      onDone: (ok) => {
        if (!ok) return;
        neUnit.stageIdx++; neuroUnitProgress(); neuroUnitAppend();
      },
    });
    return;
  } else if (stage === 'debrief') {
    node = el(`<section class="neuro-stage"><span class="label">Debrief</span>
      ${step.reflectionQuestion ? `<p class="q">${esc(step.reflectionQuestion)}</p><textarea class="socinput neuro-input" rows="3" placeholder="Reflect&hellip;"></textarea>` : ''}
      ${step.checkpointPrompt ? `<div class="neuro-block"><span class="label">Checkpoint</span><p class="neuro-prose">${esc(step.checkpointPrompt)}</p></div>` : ''}
      ${unit ? `<p class="neuro-mono">Mastery: ${esc(unit.masteryCriteria)}</p>` : ''}
      <div class="continue-row"><button class="btn btn-solid neuro-btn" data-cont>Complete unit</button></div></section>`);
  } else {
    neUnit.stageIdx++;
    neuroUnitAppend();
    return;
  }

  node.querySelector('[data-cont]')?.addEventListener('click', () => { neUnit.stageIdx++; neuroUnitAppend(); });
  container.appendChild(node);
  node.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function neuroUnitFinish() {
  const { step } = neUnit;
  if (!NEURO_PROG.pathDone.includes(step.id)) NEURO_PROG.pathDone.push(step.id);
  saveNeuroProg();
  const path = neuroPath();
  const next = path?.steps?.find(s => s.order === step.order + 1);
  const node = el(`<section class="neuro-stage">
    <span class="label">Unit ${step.order} complete</span>
    <div class="neuro-score">&#10003;</div>
    <p class="neuro-prose">${esc(step.oneLineMaster)}</p>
    <div class="endbtns">
      ${next ? '<button class="btn btn-solid neuro-btn" id="nenu">Next unit</button>' : ''}
      <button class="btn neuro-btn" id="nehub">Course hub</button>
    </div>
  </section>`);
  if (next) node.querySelector('#nenu').addEventListener('click', () => renderNeuroUnit(next.id));
  node.querySelector('#nehub').addEventListener('click', renderNeuroEngineering);
  document.getElementById('neunitstages').appendChild(node);
  neuroUnitProgress();
  document.getElementById('neunitfill').style.width = '100%';
  node.scrollIntoView({ behavior: 'smooth', block: 'start' });
}