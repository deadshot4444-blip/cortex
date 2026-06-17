/* Rounds — MCAT PRIME: evidence-based MCAT prep
   Core loop (per spec): baseline -> confidence -> learn -> retrieve -> review -> retest
   Methods: spaced repetition + retrieval practice + interleaving + confidence calibration + distractor autopsy */

const MCAT = { outline: null, cards: [], questions: [], cars: [], sci: [], loaded: false };

const SEC_ABBR = { chemPhys: 'C/P', bioBiochem: 'B/B', psychSoc: 'P/S', cars: 'CARS' };
const CONF = { guess: 'Guess', unsure: 'Unsure', sure: 'Sure' };
const ROOT_CAUSES = ['Content gap', 'Misread', 'Data/graph', 'Math/setup', 'Reasoning', 'Careless', 'Guessed'];

/* ---------- storage ---------- */
const SRS = (typeof loadJSON === 'function') ? loadJSON('cs-mcat-srs', {}) : {};      // cardId -> {ease,interval,reps,lapses,due,last}
const QHIST = (typeof loadJSON === 'function') ? loadJSON('cs-mcat-q', {}) : {};      // qId -> {n,lastCorrect,conf,root,ts}
let QLOG = (typeof loadJSON === 'function') ? loadJSON('cs-mcat-log', []) : [];       // [{qId,section,category,correct,conf,ts}]
const mset = (k, v) => { if (typeof safeSet === 'function') safeSet(k, v); else { try { localStorage.setItem(k, v); } catch {} } };
function saveSRS() { mset('cs-mcat-srs', JSON.stringify(SRS)); }
function saveQ() { mset('cs-mcat-q', JSON.stringify(QHIST)); mset('cs-mcat-log', JSON.stringify(QLOG.slice(-1000))); }

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
  if (MCAT.loaded) return;
  try {
    const [o, c, q, cars, sci] = await Promise.all([
      fetch('data/mcat-outline.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('data/mcat-cards.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('data/mcat-questions.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('data/mcat-cars.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('data/mcat-science-passages.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
    ]);
    MCAT.outline = o; MCAT.cards = c || []; MCAT.questions = q || []; MCAT.cars = cars || []; MCAT.sci = sci || [];
  } catch { /* ok */ }
  MCAT.loaded = true;
}

/* ---------- hub ---------- */
/* ---------- resume: persist in-progress sessions to localStorage ---------- */
function saveResume(key, obj) {
  try {
    if (!obj) return;
    const o = Object.assign({}, obj);
    delete o.timerId; delete o._reveal;
    if (o.deadline) o._remain = Math.max(0, o.deadline - nowTs());
    localStorage.setItem('cs-mcat-r-' + key, JSON.stringify(o));
  } catch {}
}
function loadResume(key) { try { return JSON.parse(localStorage.getItem('cs-mcat-r-' + key) || 'null'); } catch { return null; } }
function clearResume(key) { try { localStorage.removeItem('cs-mcat-r-' + key); } catch {} }
// build a "Resume where you left off" button if a saved session has real progress
function resumeBtn(key, progressOf, label, onResume) {
  const r = loadResume(key);
  if (!r) return null;
  // a stale/legacy resume blob (wrong shape) must never crash the landing page — treat as "no resume"
  let lbl;
  try { if (!(progressOf(r) > 0)) return null; lbl = label(r); } catch { clearResume(key); return null; }
  const btn = el(`<button class="btn btn-resume" id="resume">&#8634; Resume &middot; ${lbl}</button>`);
  btn.addEventListener('click', () => { try { onResume(r); } catch { clearResume(key); renderMCAT(); } });
  return btn;
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
  const c = root.querySelector('#crumbmcat'); if (c) c.addEventListener('click', renderMCAT);
  const x = root.querySelector('#exit'); if (x) x.addEventListener('click', onExit);
}
function confirmExit(hasProgress, onLeave) {
  if (!hasProgress) { onLeave(); return; }
  const m = el(`<div class="modal" id="cfx"><div class="modal-box">
    <div class="modal-head"><span class="label">Leave this session?</span></div>
    <p class="cfx-msg">No problem &mdash; your place is saved. You can resume right where you left off.</p>
    <div class="endbtns cfx-btns"><button class="btn" id="cfx-cancel">Keep going</button><button class="btn btn-solid" id="cfx-quit">Leave</button></div>
  </div></div>`);
  const close = () => { m.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  m.addEventListener('click', e => { if (e.target.id === 'cfx' || e.target.id === 'cfx-cancel') close(); });
  m.querySelector('#cfx-quit').addEventListener('click', () => { close(); onLeave(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(m);
}

async function renderMCAT() {
  if (typeof stopTimer === 'function') stopTimer();
  if (typeof session !== 'undefined') session = null;
  // tear down any in-flight timed-module countdowns so a leftover timer can't auto-finish
  // and hijack a screen the user navigated to (e.g. leaving the Exam Simulator via the breadcrumb)
  if (cars) { clearInterval(cars.timerId); cars = null; }
  if (plab) { clearInterval(plab.timerId); plab = null; }
  if (simTimerId) { clearInterval(simTimerId); simTimerId = null; }
  sim = null;
  await loadMCAT();

  const due = dueCount(), fresh = newCount();
  const qn = MCAT.questions.length, cn = MCAT.cards.length;
  const t = mcatTotals();

  const carsN = MCAT.cars.length, sciN = MCAT.sci.length;
  const conceptsN = MCAT.outline ? MCAT.outline.concepts.length : 0;

  const groups = [
    { title: 'Foundations &middot; Acquire',
      blurb: 'Build durable knowledge through active retrieval, not passive review. Every fact is earned on a schedule; every question is dissected down to the wrong answers engineered to tempt you.',
      mods: [
        { name: 'Flashcard Reactor', desc: '504 cards on SM-2 spaced scheduling, surfaced the moment they start to fade', stat: cn ? `${due} due &middot; ${fresh} new` : 'generating&hellip;', go: renderFlashHome, on: cn > 0 },
        { name: 'Question Drills', desc: '263 discrete questions, interleaved, with a full distractor autopsy', stat: qn ? `${qn} questions` : 'generating&hellip;', go: renderDrillSetup, on: qn > 0 },
        { name: 'CARS Studio', desc: '32 original passages, 96+ questions, with a blind-review workflow', stat: carsN ? `${carsN} passages` : 'generating&hellip;', go: renderCarsHome, on: carsN > 0 },
        { name: 'Science Passages', desc: '34 AAMC-style passages with live data tables', stat: sciN ? `${sciN} passages` : 'generating&hellip;', go: renderPassageHome, on: sciN > 0 },
      ] },
    { title: 'Examination &middot; Prove',
      blurb: 'Move from knowing to performing under test-day conditions. Train the stamina the real exam demands &mdash; then face yourself honestly in review, before the AAMC charges you to find out.',
      mods: [
        { name: 'Exam Simulator', desc: 'Real-time countdown, flag navigator, stamina &amp; full-length chains, periodic table', stat: 'section &amp; full-length', go: renderSimHome, on: qn > 0 && !!MCAT.outline },
        { name: 'Mistake Lab', desc: 'Confidence-vs-accuracy calibration, weakest categories, root-cause analysis', stat: t.answered ? `${t.answered} answered &middot; ${t.acc}%` : 'no data yet', go: renderMistakeLab, on: true },
      ] },
    { title: 'Navigation &middot; Direct',
      blurb: 'Know exactly where you stand against the full AAMC blueprint, and exactly what to do next &mdash; every day, no guesswork.',
      mods: [
        { name: 'Blueprint Navigator', desc: 'The complete AAMC content map with a live coverage heat-check', stat: `${conceptsN} concepts`, go: renderBlueprint, on: !!MCAT.outline },
        { name: 'Guide Engine', desc: 'A personalized day-by-day campaign on 120 / 90 / 60-day tracks', stat: guidePlan() ? 'plan active' : 'build a plan', go: renderGuide, on: !!MCAT.outline },
        { name: 'Course Mapper', desc: 'Rate your coursework, generate a pre-study coverage heat map', stat: 'pre-study check', go: renderMapper, on: !!MCAT.outline },
      ] },
  ];

  const stats = [
    [String(cn || 504), 'Spaced-repetition cards'],
    [String(qn || 263), 'Questions &middot; distractor autopsy'],
    [String(carsN || 32), 'Original CARS passages'],
    [String(sciN || 34), 'AAMC-style science passages'],
    ['9', 'Integrated instruments'],
    ['$0', 'Free forever &middot; no account'],
  ];

  const method = {
    intro: 'Most MCAT tools stop at one technique and call it a study system. This one is engineered around the techniques cognitive science rates highest-utility &mdash; the same principles Dunlosky and colleagues found most reliably improve real retention and transfer. Nothing here is decoration; every instrument exists to exploit a known mechanism of learning.',
    points: [
      ['Spaced repetition', 'Material returns at the precise interval before you would forget it. SM-2 scheduling fights the forgetting curve instead of ignoring it.'],
      ['Active retrieval practice', 'Recalling an answer strengthens memory far more than re-reading it. Every drill forces you to produce, not recognize.'],
      ['Interleaving', 'Mixed topics build the discrimination the real exam requires &mdash; you learn to tell similar concepts apart, not just repeat them in blocks.'],
      ['Confidence calibration', 'You log how sure you were, then see confidence plotted against accuracy. Overconfidence is the silent score-killer; this makes it visible.'],
      ['Distractor autopsy', 'For every question, we explain why each wrong answer was engineered to be tempting &mdash; so you stop falling for the same trap twice.'],
      ['Blind review', 'Re-attempt flagged questions with no feedback before reading explanations. It separates true understanding from lucky recognition.'],
      ['Teach-back', 'Explaining a concept in your own words is the strongest test of mastery there is. The system prompts you to teach, not just answer.'],
    ],
  };

  const extras = [
    ['Built on the full AAMC blueprint', 'This is not a curated highlight reel. Every instrument is mapped to the official AAMC content outline, and the Blueprint Navigator shows your measured coverage across every category &mdash; what you have mastered, what you have merely touched, and what you have not yet faced.'],
    ['One integrated system, not nine apps', 'The nine instruments share one record of your performance. A miss in Question Drills surfaces in the Mistake Lab, reshapes your Blueprint coverage, and changes what the Guide Engine assigns tomorrow. You study; the system keeps the bookkeeping.'],
    ['The free promise', 'MCAT preparation on Cortex is free forever &mdash; no account, no paywall, no catch. Other parts of the Academy may one day be part of a membership that helps fund the mission, but everything in the MCAT suite stays free. The cost of becoming a physician should never be the price of preparing for the exam that begins it.'],
  ];

  const root = el('<div></div>');
  root.appendChild(topbar('mcat'));
  const main = el(`<main class="panel mcat-landing">
    <section class="mcat-hero">
      <span class="mcat-eyebrow">MCAT Preparation &middot; Evidence-Based &middot; Free forever</span>
      <h1>Prepare the way the science says you should.</h1>
      <p class="mcat-lede">A complete, research-grade MCAT preparation system built on the cognitive science of how memory actually works &mdash; spaced retrieval, calibrated feedback, full AAMC coverage. Most MCAT tools are flashcard toys. This is the whole instrument. No account. No paywall. No gimmicks.</p>
      <div class="mcat-cta"><button class="btn btn-solid" id="mc-enter">Enter the system</button><button class="btn" id="mc-method">Read the method</button></div>
    </section>
    <div class="mcat-statband cornerframe">${stats.map(s => `<div class="mcat-stat"><span class="ms-num" data-countup="${s[0]}">${s[0]}</span><span class="ms-lab">${s[1]}</span></div>`).join('')}</div>
    <div id="mcat-groups"></div>
    <section class="mcat-method" id="mcat-method">
      <span class="label">The Method</span>
      <p class="mcat-method-intro">${method.intro}</p>
      <div class="method-grid" data-reveal-stagger>${method.points.map(p => `<div class="method-pt"><span class="mp-name">${p[0]}</span><p>${p[1]}</p></div>`).join('')}</div>
    </section>
    <div class="mcat-extras" data-reveal-stagger>${extras.map(e => `<div class="mcat-extra"><span class="label">${e[0]}</span><p>${e[1]}</p></div>`).join('')}</div>
    <section class="mcat-closing" data-reveal>
      <h2>Begin with the system, not the syllabus.</h2>
      <p>The complete, evidence-based MCAT preparation system &mdash; every instrument, every passage, every card, open and free forever. The only thing required is the discipline to start.</p>
      <button class="btn btn-solid" id="mc-enter2">Enter the system</button>
    </section>
  </main>`);

  const gWrap = main.querySelector('#mcat-groups');
  groups.forEach(g => {
    const sec = el(`<section class="mcat-group"><div class="mcat-group-head"><span class="label">${g.title}</span><p>${g.blurb}</p></div><div class="mcat-mods" data-reveal-stagger></div></section>`);
    const mc = sec.querySelector('.mcat-mods');
    g.mods.forEach(m => {
      const card = el(`<button class="modcard" ${m.on ? '' : 'disabled'}>
        <span class="mod-name">${m.name}</span>
        <span class="mod-desc">${m.desc}</span>
        <span class="mod-stat">${m.stat}</span>
        ${m.on ? '<span class="mod-go" aria-hidden="true">&rarr;</span>' : ''}
      </button>`);
      if (m.on) card.addEventListener('click', m.go);
      mc.appendChild(card);
    });
    gWrap.appendChild(sec);
  });

  const enter = () => renderDrillSetup();
  main.querySelector('#mc-enter').addEventListener('click', enter);
  main.querySelector('#mc-enter2').addEventListener('click', enter);
  main.querySelector('#mc-method').addEventListener('click', () => main.querySelector('#mcat-method').scrollIntoView({ behavior: 'smooth', block: 'start' }));

  root.appendChild(main);
  if (typeof siteFooter === 'function') root.appendChild(siteFooter());
  setView(root);
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
  const rb = resumeBtn('flash', r => r.idx || r.done || 0, r => `${r.done || 0} / ${r.total || 0} cards`, r => { flash = r; renderFlashCard(); });
  if (rb) main.querySelector('.endbtns').prepend(rb);
  root.appendChild(main);
  setView(root);
}

function startFlash(deck, limitNew = 20, limitDue = 60) {
  const pool = deck === 'all' ? MCAT.cards : MCAT.cards.filter(c => c.section === deck);
  const t = nowTs();
  const dueCards = pool.filter(c => SRS[c.id] && SRS[c.id].reps > 0 && SRS[c.id].due <= t).slice(0, limitDue);
  const newCards = pool.filter(c => !SRS[c.id] || SRS[c.id].reps === 0).slice(0, limitNew);
  const queue = shuffleArr(dueCards.concat(newCards));
  if (!queue.length) { renderFlashHome(); return; }
  flash = { deck, queue, idx: 0, total: queue.length, again: 0, done: 0 };
  renderFlashCard();
}
function shuffleArr(a) { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[x[i], x[j]] = [x[j], x[i]]; } return x; }

function renderFlashCard() {
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
  wireRunHeader(root, () => confirmExit(flash && (flash.done > 0 || flash.again > 0 || flash.idx > 0), renderFlashHome));
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
  const rec = srsRec(c.id);
  schedule(rec, rating); saveSRS();
  if (rating === 'again') { flash.again++; flash.queue.push(c); }   // re-show later this session
  else flash.done++;
  flash.idx++;
  renderFlashCard();
}

function finishFlash() {
  clearResume('flash');
  if (typeof bumpStreak === 'function') bumpStreak();
  const root = el('<div></div>');
  root.appendChild(topbar('mcat'));
  const main = el(`<main class="panel"><section class="anat-results" style="border:0">
    <span class="label">Session complete</span>
    <div class="score">${flash.done}<span class="of"> cards</span></div>
    <div class="anat-pct">${flash.again} needed another look &middot; scheduled by your recall</div>
    <div class="endbtns"><button class="btn btn-solid" id="more">Study more</button><button class="btn" id="home">&larr; MCAT</button></div>
  </section></main>`);
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
  const rb = resumeBtn('drill', r => (r.results ? r.results.length : 0) || r.idx || 0, r => `Q ${(r.idx || 0) + 1}/${r.qs.length}`, r => { drill = r; renderDrillQ(); });
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
  wireRunHeader(root, () => confirmExit(drill && drill.results.length > 0, renderDrillSetup));
  let conf = 'unsure';
  root.querySelectorAll('#conf .mode').forEach(b => b.addEventListener('click', () => { conf = b.dataset.c; root.querySelectorAll('#conf .mode').forEach(x => x.classList.toggle('active', x === b)); }));
  root.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => answerDrill(root, q, +b.dataset.i, conf)));
  setView(root);
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
  const res = { id: q.id, section: q.section, category: q.category, chosen: choice, correct, conf, root: null };
  drill.results.push(res);

  const after = root.querySelector('#after');
  if (drill.mode === 'blind') {
    after.innerHTML = `<div class="continue-row"><span class="hint">no feedback yet &middot; ENTER &rarr;</span><button class="btn btn-solid" data-next>${drill.idx + 1 >= drill.qs.length ? 'Review all' : 'Next'}</button></div>`;
  } else {
    const autopsy = (q.distractors || []).filter(d => d.i !== q.answer).map(d => `<div class="autopsy-row"><span class="ak">${'ABCD'[d.i]}</span><span>${esc(d.why)}</span></div>`).join('');
    after.innerHTML = `<div class="explain ${correct ? 'good' : 'bad'}"><span class="verdict">${correct ? 'CORRECT' : 'INCORRECT'}</span><p>${esc(q.explanation)}</p>
      ${autopsy ? `<div class="autopsy"><span class="label">Distractor autopsy</span>${autopsy}</div>` : ''}</div>
      ${correct ? '' : `<div class="rootcause"><span class="label">What went wrong? (tags your weak spots)</span><div class="rc-chips">${ROOT_CAUSES.map(rc => `<button class="rc-chip" data-rc="${esc(rc)}">${esc(rc)}</button>`).join('')}</div></div>`}
      <div class="continue-row"><span class="hint">ENTER &rarr;</span><button class="btn btn-solid" data-next>${drill.idx + 1 >= drill.qs.length ? 'Results' : 'Next'}</button></div>`;
    after.querySelectorAll('.rc-chip').forEach(ch => ch.addEventListener('click', () => { res.root = ch.dataset.rc; after.querySelectorAll('.rc-chip').forEach(x => x.classList.toggle('on', x === ch)); }));
  }
  const nb = after.querySelector('[data-next]');
  nb.addEventListener('click', () => { drill.idx++; renderDrillQ(); });
  nb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function finishDrill() {
  clearResume('drill');
  // commit to history + log
  const t = nowTs();
  drill.results.forEach(r => {
    const h = QHIST[r.id] || { n: 0 };
    h.n++; h.lastCorrect = r.correct; h.conf = r.conf; h.root = r.root; h.ts = t; QHIST[r.id] = h;
    QLOG.push({ qId: r.id, section: r.section, category: r.category, correct: r.correct, conf: r.conf, ts: t });
  });
  saveQ();
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
      <div class="endbtns"><button class="btn btn-solid" id="again">New drill</button><button class="btn" id="lab">Mistake Lab</button><button class="btn" id="home">&larr; MCAT</button></div>
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
        <div class="rev-ans">You: ${'ABCD'[r.chosen]} &middot; Correct: <b>${'ABCD'[q.answer]}</b> &middot; felt ${CONF[r.conf]}</div>
        <p>${esc(q.explanation)}</p>
        ${autopsy ? `<div class="autopsy">${autopsy}</div>` : ''}
      </div></details>`;
  }).join('');
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
      ${missed.length ? '<button class="btn btn-solid" id="redo">Redo missed</button>' : ''}
      <button class="btn" id="home">&larr; MCAT</button>
    </div>
  </main>`);

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
  const rb = resumeBtn('cars', r => (r.results ? r.results.length : 0), r => `Q ${(r.idx || 0) + 1}/${r.p.questions.length}`, r => { cars = r; cars.timerId = null; if (cars.timed) { cars.deadline = nowTs() + (r._remain || 600000); cars.timerId = setInterval(carsTick, 500); } renderCarsRunner(); });
  if (rb) main.querySelector('.endbtns').prepend(rb);
  root.appendChild(main); setView(root);
}
function startCars(p, timed) {
  cars = { p, idx: 0, results: [], timed, deadline: timed ? nowTs() + 600000 : 0, timerId: null };
  if (timed) cars.timerId = setInterval(carsTick, 500);
  renderCarsRunner();
}
function carsTick() { if (!cars) return; const left = (cars.deadline - nowTs()) / 1000; const t = document.getElementById('cars-timer'); if (t) { t.textContent = fmtTime(left); t.classList.toggle('crit', left <= 60); } if (left <= 0) { clearInterval(cars.timerId); finishCars(); } }
function renderCarsRunner() {
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
        <div class="opts">${q.options.map((o, i) => `<button class="opt" data-i="${i}"><span class="key">${'ABCD'[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>
      </div>
    </main>
  </div>`);
  wireRunHeader(root, () => confirmExit(cars && cars.results.length > 0, () => { if (cars.timerId) clearInterval(cars.timerId); renderCarsHome(); }));
  root.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => { cars.results.push({ q, chosen: +b.dataset.i, correct: +b.dataset.i === q.answer }); cars.idx++; renderCarsRunner(); window.scrollTo(0, 0); }));
  setView(root); window.scrollTo(0, 0);
  if (cars.timed) carsTick();
}
function finishCars() {
  clearResume('cars');
  if (cars.timerId) clearInterval(cars.timerId);
  const p = cars.p, t = nowTs();
  cars.results.forEach(r => { const cat = 'CARS-' + r.q.skill.split('-')[1]; QLOG.push({ qId: r.q.id, section: 'cars', category: cat, passage: p.id, correct: r.correct, conf: 'unsure', ts: t }); QHIST[r.q.id] = { n: (QHIST[r.q.id]?.n || 0) + 1, lastCorrect: r.correct, ts: t }; });
  saveQ(); if (typeof bumpStreak === 'function') bumpStreak();
  const correct = cars.results.filter(r => r.correct).length, total = cars.results.length;
  const bySkill = ['cars-1', 'cars-2', 'cars-3'].map(s => { const set = cars.results.filter(r => r.q.skill === s); return set.length ? `<div class="calib-row"><span class="cl">${SKILL_LABEL[s]}</span><span class="cbar"><i style="width:${Math.round(100 * set.filter(r => r.correct).length / set.length)}%"></i></span><span class="cv">${Math.round(100 * set.filter(r => r.correct).length / set.length)}%</span></div>` : ''; }).join('');
  const root = el('<div></div>'); root.appendChild(topbar('mcat'));
  const main = el(`<main class="panel"><section class="summary" style="border:0;margin-top:8px">
    <span class="label">Passage complete &middot; ${esc(p.title)}</span>
    <div class="score">${String(correct).padStart(2, '0')}<span class="of">/${String(total).padStart(2, '0')}</span></div>
    <div class="calib"><span class="label">By skill</span>${bySkill}</div>
    <div class="drill-review" id="dr"></div>
    <div class="endbtns"><button class="btn btn-solid" id="next">Back to passages</button><button class="btn" id="home">&larr; MCAT</button></div>
  </section></main>`);
  main.querySelector('#dr').innerHTML = `<span class="label">Review &amp; justification</span>` + cars.results.map((r, i) => `<details class="rev" ${r.correct ? '' : 'open'}><summary><span class="${r.correct ? 'ok' : 'no'}">${r.correct ? '&#10003;' : '&#10007;'}</span> Q${i + 1} &middot; ${SKILL_LABEL[r.q.skill]}</summary><div class="rev-body"><div class="rev-ans">You: ${'ABCD'[r.chosen]} &middot; Correct: <b>${'ABCD'[r.q.answer]}</b></div><p>${esc(r.q.explanation)}</p></div></details>`).join('');
  main.querySelector('#next').addEventListener('click', renderCarsHome);
  main.querySelector('#home').addEventListener('click', renderMCAT);
  root.appendChild(main); setView(root); window.scrollTo(0, 0);
}

/* ---------- shared passage rendering ---------- */
function dataTableHTML(table) {
  if (!table || !table.headers) return '';
  return `<div class="dtable">${table.caption ? `<div class="dt-cap">${esc(table.caption)}</div>` : ''}<table><thead><tr>${table.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${(table.rows || []).map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function passageBody(title, text, table) {
  return `<div class="cars-passage"><span class="label">${esc(title)}</span>${text.split(/\n\n+/).map(p => `<p>${esc(p)}</p>`).join('')}${dataTableHTML(table)}</div>`;
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
    MCAT.sci.filter(p => sec === 'all' || p.section === sec).forEach(p => {
      const log = QLOG.filter(x => x.passage === p.id);
      const acc = log.length ? Math.round(100 * log.filter(x => x.correct).length / log.length) : null;
      const row = el(`<button class="row"><span class="row-main"><span class="row-spec">${SEC_ABBR[p.section]} &middot; ${esc(p.type)}</span><span class="row-title">${esc(p.title)}</span></span><span class="row-right">${acc != null ? `<span class="pill ${acc >= 75 ? 'ok' : acc >= 50 ? 'mid' : 'no'}">${acc}%</span>` : `<span class="row-when">${p.questions.length}q &rarr;</span>`}</span></button>`);
      row.addEventListener('click', () => startPassage(p, timed));
      list.appendChild(row);
    });
  };
  refresh();
  main.querySelectorAll('#psec .mode').forEach(b => b.addEventListener('click', () => { sec = b.dataset.s; main.querySelectorAll('#psec .mode').forEach(x => x.classList.toggle('active', x === b)); refresh(); }));
  main.querySelectorAll('#ptime .mode').forEach(b => b.addEventListener('click', () => { timed = b.dataset.t === 'on'; main.querySelectorAll('#ptime .mode').forEach(x => x.classList.toggle('active', x === b)); }));
  main.querySelector('#back').addEventListener('click', renderMCAT);
  const rb = resumeBtn('plab', r => (r.results ? r.results.length : 0), r => `Q ${(r.idx || 0) + 1}/${r.p.questions.length}`, r => { plab = r; plab.timerId = null; if (plab.timed) { plab.deadline = nowTs() + (r._remain || 600000); plab.timerId = setInterval(plabTick, 500); } renderPassageRunner(); });
  if (rb) main.querySelector('.endbtns').prepend(rb);
  root.appendChild(main); setView(root);
}
function startPassage(p, timed) { plab = { p, idx: 0, results: [], timed, deadline: timed ? nowTs() + 600000 : 0, timerId: null }; if (timed) plab.timerId = setInterval(plabTick, 500); renderPassageRunner(); }
function plabTick() { if (!plab) return; const left = (plab.deadline - nowTs()) / 1000; const t = document.getElementById('plab-timer'); if (t) { t.textContent = fmtTime(left); t.classList.toggle('crit', left <= 60); } if (left <= 0) { clearInterval(plab.timerId); finishPassage(); } }
function renderPassageRunner() {
  const p = plab.p;
  if (plab.idx >= p.questions.length) { finishPassage(); return; }
  const q = p.questions[plab.idx];
  saveResume('plab', plab);
  const root = el(`<div>
    ${mcatTaskHeader([`${SEC_ABBR[p.section]} Passage`], `<button class="bookmark" id="pt" title="Periodic table" aria-label="Periodic table">PT</button>${plab.timed ? '<span class="timer" id="plab-timer"></span>' : ''}<span class="topstat">Q ${plab.idx + 1}/${p.questions.length}</span>`)}
    <main class="cars-stage">
      ${passageBody(p.title, p.text, p.table)}
      <div class="cars-q"><p class="q">${esc(q.stem)}</p>
        <div class="opts">${q.options.map((o, i) => `<button class="opt" data-i="${i}"><span class="key">${'ABCD'[i]}</span><span>${esc(o)}</span></button>`).join('')}</div></div>
    </main></div>`);
  wireRunHeader(root, () => confirmExit(plab && plab.results.length > 0, () => { if (plab.timerId) clearInterval(plab.timerId); renderPassageHome(); }));
  root.querySelector('#pt').addEventListener('click', periodicModal);
  root.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => { plab.results.push({ q, chosen: +b.dataset.i, correct: +b.dataset.i === q.answer }); plab.idx++; renderPassageRunner(); }));
  setView(root); window.scrollTo(0, 0); if (plab.timed) plabTick();
}
function finishPassage() {
  clearResume('plab');
  if (plab.timerId) clearInterval(plab.timerId);
  const p = plab.p, t = nowTs();
  plab.results.forEach(r => { QLOG.push({ qId: r.q.id, section: p.section, category: r.q.category, passage: p.id, correct: r.correct, conf: 'unsure', ts: t }); QHIST[r.q.id] = { n: (QHIST[r.q.id]?.n || 0) + 1, lastCorrect: r.correct, ts: t }; });
  saveQ(); if (typeof bumpStreak === 'function') bumpStreak();
  const correct = plab.results.filter(r => r.correct).length, total = plab.results.length;
  const root = el('<div></div>'); root.appendChild(topbar('mcat'));
  const main = el(`<main class="panel"><section class="summary" style="border:0;margin-top:8px">
    <span class="label">Passage complete &middot; ${esc(p.title)}</span>
    <div class="score">${String(correct).padStart(2, '0')}<span class="of">/${String(total).padStart(2, '0')}</span></div>
    <div class="drill-review" id="dr"></div>
    <div class="endbtns"><button class="btn btn-solid" id="next">Back to passages</button><button class="btn" id="home">&larr; MCAT</button></div>
  </section></main>`);
  main.querySelector('#dr').innerHTML = `<span class="label">Review</span>` + plab.results.map((r, i) => { const autopsy = (r.q.distractors || []).filter(d => d.i !== r.q.answer).map(d => `<div class="autopsy-row"><span class="ak">${'ABCD'[d.i]}</span><span>${esc(d.why)}</span></div>`).join(''); return `<details class="rev" ${r.correct ? '' : 'open'}><summary><span class="${r.correct ? 'ok' : 'no'}">${r.correct ? '&#10003;' : '&#10007;'}</span> Q${i + 1}</summary><div class="rev-body"><div class="rev-ans">You: ${'ABCD'[r.chosen]} &middot; Correct: <b>${'ABCD'[r.q.answer]}</b></div><p>${esc(r.q.explanation)}</p>${autopsy ? `<div class="autopsy">${autopsy}</div>` : ''}</div></details>`; }).join('');
  main.querySelector('#next').addEventListener('click', renderPassageHome);
  main.querySelector('#home').addEventListener('click', renderMCAT);
  root.appendChild(main); setView(root); window.scrollTo(0, 0);
}

/* ---------- Exam Simulator ---------- */
let sim = null, simTimerId = null;
const SIM_SECTIONS = {
  chemPhys: { abbr: 'C/P', min: 95 }, cars: { abbr: 'CARS', min: 90 }, bioBiochem: { abbr: 'B/B', min: 95 }, psychSoc: { abbr: 'P/S', min: 95 },
};
function renderSimHome() {
  if (!MCAT.outline) return renderMCAT();
  const root = el('<div></div>'); root.appendChild(topbar('mcat'));
  const main = el(`<main class="panel">
    <div class="hero"><h1>Exam Simulator.</h1><p class="sub">Train test-day conditions: a countdown, a question navigator with flags, no feedback until you submit. Builds stamina, not just knowledge.</p></div>
    <div class="statblock"><span class="label">Section simulators</span><div id="secs"></div></div>
    <div class="statblock"><span class="label">Stamina</span>
      <button class="bp-cat" id="full"><span class="bp-cat-id">FL</span><span class="bp-cat-title">Full-length (all four sections, with breaks)</span><span class="bp-cat-stat">~marathon</span></button></div>
    <div class="endbtns"><button class="btn" id="back">&larr; MCAT</button></div>
  </main>`);
  const secs = main.querySelector('#secs');
  ['chemPhys', 'cars', 'bioBiochem', 'psychSoc'].forEach(k => {
    const n = simPool(k).length;
    const row = el(`<button class="bp-cat" ${n ? '' : 'disabled'}><span class="bp-cat-id">${SIM_SECTIONS[k].abbr}</span><span class="bp-cat-title">${esc(MCAT.outline.sections[k].name)}</span><span class="bp-cat-stat">${n} q</span></button>`);
    if (n) row.addEventListener('click', () => startSim([k]));
    secs.appendChild(row);
  });
  main.querySelector('#full').addEventListener('click', () => startSim(['chemPhys', 'cars', 'bioBiochem', 'psychSoc']));
  main.querySelector('#back').addEventListener('click', renderMCAT);
  const rb = resumeBtn('sim', r => Object.keys(r.answers || {}).length + (r.idx || 0) + (r.si || 0), r => { const s = r.queue[r.si]; return r.onBreak ? `Break &middot; ${SIM_SECTIONS[s.key].abbr} next` : `${SIM_SECTIONS[s.key].abbr} Q ${(r.idx || 0) + 1}/${s.items.length}`; }, r => { sim = r; if (simTimerId) clearInterval(simTimerId); simTimerId = null; if (r.onBreak) { renderBreak(); return; } sim.deadline = nowTs() + (r._remain || 600000); simTimerId = setInterval(simTick, 500); renderSimQ(); });
  if (rb) { const sb = main.querySelector('.endbtns'); if (sb) sb.prepend(rb); }
  root.appendChild(main); setView(root);
}
function simPool(secKey) {
  if (secKey === 'cars') {
    const groups = MCAT.cars.map(p => p.questions.map(q => ({ q, passageText: p.text, passageTitle: p.title })));
    return shuffleArr(groups).flat();
  }
  // science: passage sets (kept together) first, then discretes — like a real section
  const groups = MCAT.sci.filter(p => p.section === secKey).map(p => p.questions.map(q => ({ q, passageText: p.text, passageTitle: p.title, table: p.table })));
  const passageItems = shuffleArr(groups).flat();
  const discretes = shuffleArr(MCAT.questions.filter(q => q.section === secKey)).slice(0, 15).map(q => ({ q }));
  return passageItems.concat(discretes);
}
function startSim(sectionKeys) {
  const queue = sectionKeys.map(k => ({ key: k, items: shuffleArr(simPool(k)).slice(0, k === 'cars' ? 30 : 40) }));
  sim = { queue, si: 0, idx: 0, answers: {}, flags: {}, deadline: 0, results: [] };
  beginSection();
}
function beginSection() {
  const s = sim.queue[sim.si];
  sim.onBreak = false;
  const minutes = Math.max(8, Math.round(SIM_SECTIONS[s.key].min * s.items.length / (s.key === 'cars' ? 53 : 59)));
  sim.deadline = nowTs() + minutes * 60000; sim.idx = 0;
  if (simTimerId) clearInterval(simTimerId); simTimerId = setInterval(simTick, 500);
  renderSimQ();
}
function simTick() { if (!sim) return; const left = (sim.deadline - nowTs()) / 1000; const t = document.getElementById('sim-timer'); if (t) { t.textContent = fmtTime(left); t.classList.toggle('warn', left <= 300 && left > 60); t.classList.toggle('crit', left <= 60); } if (left <= 0) { submitSection(); } }
function renderSimQ() {
  const s = sim.queue[sim.si], it = s.items[sim.idx], q = it.q;
  const key = sim.si + ':' + sim.idx;
  const chosen = sim.answers[key];
  saveResume('sim', sim);
  const root = el(`<div>
    ${mcatTaskHeader([SIM_SECTIONS[s.key].abbr, sim.queue.length > 1 ? `Sec ${sim.si + 1}/${sim.queue.length}` : '', `Q ${sim.idx + 1}/${s.items.length}`], `${s.key !== 'cars' ? '<button class="bookmark" id="pt" title="Periodic table" aria-label="Periodic table">PT</button>' : ''}<span class="timer" id="sim-timer"></span>`, '&larr; Quit')}
    <main class="case">
      ${it.passageText ? passageBody(it.passageTitle || 'Passage', it.passageText, it.table) : ''}
      <p class="q">${esc(q.stem)}</p>
      <div class="opts" id="opts">${q.options.map((o, i) => `<button class="opt ${chosen === i ? 'picked' : ''}" data-i="${i}"><span class="key">${'ABCD'[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>
      <div class="sim-bar">
        <button class="btn" id="flag">${sim.flags[key] ? '&#9873; Flagged' : '&#9872; Flag'}</button>
        <span style="flex:1"></span>
        <button class="btn" id="prev" ${sim.idx === 0 && sim.si === 0 ? 'disabled' : ''}>&larr; Prev</button>
        <button class="btn" id="nav">Navigator</button>
        <button class="btn btn-solid" id="next">${sim.idx + 1 >= s.items.length ? 'Review &amp; end' : 'Next &rarr;'}</button>
      </div>
      <div id="navwrap"></div>
    </main></div>`);
  wireRunHeader(root, () => confirmExit(sim && Object.keys(sim.answers).length > 0, () => { if (simTimerId) clearInterval(simTimerId); renderSimHome(); }));
  root.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => { sim.answers[key] = +b.dataset.i; root.querySelectorAll('.opt').forEach(x => x.classList.toggle('picked', x === b)); }));
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
  if (simTimerId) clearInterval(simTimerId);
  const s = sim.queue[sim.si], t = nowTs();
  let correct = 0;
  s.items.forEach((it, i) => {
    const chosen = sim.answers[s === sim.queue[sim.si] ? sim.si + ':' + i : ''];
    const c = chosen === it.q.answer; if (c) correct++;
    const cat = s.key === 'cars' ? 'CARS-' + it.q.skill.split('-')[1] : it.q.category;
    QLOG.push({ qId: it.q.id, section: s.key, category: cat, correct: c, conf: 'unsure', ts: t, sim: true });
    QHIST[it.q.id] = { n: (QHIST[it.q.id]?.n || 0) + 1, lastCorrect: c, ts: t };
  });
  saveQ();
  sim.results.push({ key: s.key, correct, total: s.items.length, items: s.items, answers: Object.assign({}, sim.answers) });
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
  clearResume('sim');
  const tot = sim.results.reduce((a, r) => a + r.total, 0), cor = sim.results.reduce((a, r) => a + r.correct, 0);
  const root = el('<div></div>'); root.appendChild(topbar('mcat'));
  const secRows = sim.results.map(r => `<div class="calib-row"><span class="cl">${SIM_SECTIONS[r.key].abbr}</span><span class="cbar"><i style="width:${Math.round(100 * r.correct / r.total)}%"></i></span><span class="cv">${r.correct}/${r.total}</span></div>`).join('');
  const main = el(`<main class="panel"><section class="summary" style="border:0;margin-top:8px">
    <span class="label">Exam complete</span>
    <div class="score">${Math.round(100 * cor / tot)}<span class="of">% &middot; ${cor}/${tot}</span></div>
    <div class="calib"><span class="label">By section</span>${secRows}</div>
    <div class="drill-review" id="dr"></div>
    <div class="endbtns"><button class="btn btn-solid" id="again">New sim</button><button class="btn" id="lab">Mistake Lab</button><button class="btn" id="home">&larr; MCAT</button></div>
  </section></main>`);
  const dr = main.querySelector('#dr'); dr.innerHTML = `<span class="label">Review</span>`;
  sim.results.forEach(r => r.items.forEach((it, i) => {
    const chosen = r.answers[sim.results.indexOf(r) + ':' + i];
    const c = chosen === it.q.answer;
    dr.innerHTML += `<details class="rev" ${c ? '' : 'open'}><summary><span class="${c ? 'ok' : 'no'}">${c ? '&#10003;' : '&#10007;'}</span> ${SIM_SECTIONS[r.key].abbr} Q${i + 1}. ${esc(it.q.stem.slice(0, 80))}&hellip;</summary><div class="rev-body"><div class="rev-ans">You: ${chosen != null ? 'ABCD'[chosen] : '—'} &middot; Correct: <b>${'ABCD'[it.q.answer]}</b></div><p>${esc(it.q.explanation)}</p></div></details>`;
  }));
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
function guidePlan() { return (typeof loadJSON === 'function') ? loadJSON('cs-mcat-plan', null) : null; }
const TRACKS = {
  '120': { label: '120-day standard', weeks: 17 }, '90': { label: '90-day aggressive', weeks: 13 },
  '60': { label: '60-day sprint', weeks: 9 }, 'cars': { label: 'CARS rescue', weeks: 8 }, 'final30': { label: 'Final 30 days', weeks: 4 },
};
function renderGuide() {
  const existing = guidePlan();
  const curTrack = (existing && existing.track) || '120';
  const root = el('<div></div>'); root.appendChild(topbar('mcat'));
  const main = el(`<main class="panel">
    <div class="hero"><h1>Guide Engine.</h1><p class="sub">A day-by-day campaign: new content blocked early, then interleaved review, with full-lengths and a taper at the end.</p></div>
    <div class="ctl"><span class="label">Track</span><div class="modes" id="track">
      ${Object.entries(TRACKS).map(([k, v]) => `<button class="mode ${k === curTrack ? 'active' : ''}" data-k="${k}">${v.label}</button>`).join('')}</div></div>
    <div class="endbtns" style="margin-top:18px"><button class="btn btn-solid" id="gen">Generate plan</button>${existing ? '<button class="btn" id="clear">Clear plan</button>' : ''}<button class="btn" id="back">&larr; MCAT</button></div>
    <div id="plan"></div>
  </main>`);
  let track = curTrack;
  main.querySelectorAll('#track .mode').forEach(b => b.addEventListener('click', () => { track = b.dataset.k; main.querySelectorAll('#track .mode').forEach(x => x.classList.toggle('active', x === b)); }));
  main.querySelector('#gen').addEventListener('click', () => { const plan = buildPlan(track); mset('cs-mcat-plan', JSON.stringify(plan)); renderGuide(); });
  if (main.querySelector('#clear')) main.querySelector('#clear').addEventListener('click', () => { if (confirm('Clear your saved study plan?')) { localStorage.removeItem('cs-mcat-plan'); renderGuide(); } });
  main.querySelector('#back').addEventListener('click', renderMCAT);
  if (existing) showPlan(main.querySelector('#plan'), existing);
  root.appendChild(main); setView(root);
}
function buildPlan(track) {
  const weeks = TRACKS[track].weeks;
  const cats = [];
  if (!MCAT.outline) return { track, label: TRACKS[track].label, weeks: [] };
  MCAT.outline.concepts.filter(c => c.section !== 'cars').forEach(c => c.categories.forEach(cat => cats.push(cat.id)));
  const flWeeks = Math.min(weeks <= 4 ? 4 : 3, weeks);    // last weeks = full-lengths + review
  const contentWeeks = Math.max(1, weeks - flWeeks);
  const perWeek = Math.ceil(cats.length / contentWeeks);
  const plan = { track, label: TRACKS[track].label, weeks: [] };
  for (let w = 0; w < weeks; w++) {
    if (w < contentWeeks) {
      const slice = cats.slice(w * perWeek, w * perWeek + perWeek);
      if (!slice.length) {
        // categories already exhausted — this is a review week, not an empty "Build" week
        plan.weeks.push({ n: w + 1, phase: 'Review', focus: [], note: `Interleave drills across all prior categories; daily CARS + flashcards (due). No new material this week.` });
      } else {
        plan.weeks.push({ n: w + 1, phase: 'Build', focus: slice, note: `Learn: ${slice.join(', ')}. Daily: ${track === 'cars' ? '2 CARS passages' : '1 CARS passage'} + flashcards (due) + a 10-q drill on the week's categories. Block new material, then interleave drills with prior weeks.` });
      }
    } else {
      const fl = weeks - w;
      plan.weeks.push({ n: w + 1, phase: fl === 1 ? 'Taper' : 'Exam prep', focus: [], note: fl === 1 ? 'Light review of Mistake Lab weak spots, sleep, logistics. No new material. One half-length max, then rest.' : 'One full-length this week + full review in Mistake Lab. Re-drill weakest categories. Daily CARS + flashcards.' });
    }
  }
  return plan;
}
function showPlan(host, plan) {
  host.innerHTML = `<div class="statblock"><span class="label">${esc(plan.label)} &middot; ${plan.weeks.length} weeks</span>` +
    plan.weeks.map(w => `<div class="week"><div class="week-head"><span class="wk">Week ${w.n}</span><span class="wphase">${w.phase}</span></div><div class="wnote">${esc(w.note)}</div></div>`).join('') + '</div>';
}

/* ---------- Course Mapper ---------- */
function mapperState() { return (typeof loadJSON === 'function') ? loadJSON('cs-mcat-coursework', {}) : {}; }
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
      row.querySelectorAll('.rb').forEach(b => b.addEventListener('click', () => { const s = mapperState(); s[b.dataset.cat] = (s[b.dataset.cat] === b.dataset.r) ? '' : b.dataset.r; localStorage.setItem('cs-mcat-coursework', JSON.stringify(s)); renderMapper(); }));
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
  if (flash && document.querySelector('.flash-stage')) {
    if (e.key === ' ' && document.querySelector('#flash-back')?.style.display === 'none') { e.preventDefault(); flash._reveal && flash._reveal(); return; }
    const map = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
    if (map[e.key] && document.querySelector('.ratebtn')) { document.querySelector(`.ratebtn.${map[e.key]}`)?.click(); }
    return;
  }
  // Drill: 1–4 or A–D selects an answer (Enter → Next is handled by the global handler in app.js)
  if (drill && document.getElementById('opts')) {
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

window.renderMCAT = renderMCAT;
