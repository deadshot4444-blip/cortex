/* ============================================================================
   Cortex · Cognitive Psychology  —  the science of learning & the mind
   Password-gated, arcade-style mastery trainer built on science-of-learning
   principles: active recall (testing effect), spaced repetition (Leitner
   boxes), interleaving, and targeted practice on measured weaknesses.

   Self-contained: uses app.js globals (el, esc, setView, topbar, siteFooter).
   Progress lives in localStorage['cs-cogpsych'] — fully separate from
   clinical / MCAT / genetics progress. Bank accumulates by chapter.
   ========================================================================= */

const COG_DIAGRAMS = []; // reserved for inline-SVG diagram questions (bank uses the COG_FIGS registry)


/* ---------- generated + verified MCQ bank (from data/cogpsych-bank.json) ---------- */
let COG_GENERATED = [];   // loaded from data/cogpsych-bank.json

/* ---------- small helpers ---------- */
function cogRand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
const COG_GENERATORS = []; // no procedural generators — Cognitive Psychology uses the static bank


let COG_BANK = COG_DIAGRAMS.concat(COG_GENERATORS);   // COG_GENERATED merged in after cogLoadBank()

/* ---------- topic metadata (for weakness reporting) ----------
   Slugs are chXX-<slug>; the bank's `topic` field must match a key here or the
   item is dropped by cogValidBankItem. Add chapters by appending topics + COG_CH. */
const COG_TOPICS = {
  'ch2-mind-brain': { name: 'Mind & Brain', ch: 2, blurb: 'Mind-body problem, dualism, monism (physicalism, idealism, neutral monism), Descartes, pragmatic materialism.' },
  'ch2-brain-behavior': { name: 'Brain & Behavior', ch: 2, blurb: 'Why not just neuroscience: brain complexity, similar brains, nested levels/contexts (brain→body→environment).' },
  'ch2-structuralism': { name: 'Structuralism', ch: 2, blurb: 'Wundt, Titchener, introspection, elements of consciousness; replication, unconscious processing, blindsight.' },
  'ch2-behaviorism': { name: 'Behaviorism', ch: 2, blurb: 'Watson, stimulus-response, black box; Pavlov & classical conditioning, Little Albert, Skinner & operant conditioning; Chomsky & Tolman critiques.' },
  'ch2-cognitive-revolution': { name: 'Computers & the Cognitive Revolution', ch: 2, blurb: 'Functions, algorithms, Turing machine, binary, transistor; cognition as computation, information processing, flowcharts.' },
  'ch2-cognitive-approach': { name: 'The Cognitive Approach', ch: 2, blurb: 'Inferring mental processes from behavior; Donders & reaction time; hypothesis- vs phenomenon-driven research; Stroop, SDT.' },
  'ch2-methods': { name: 'Methods of Cognitive Psychology', ch: 2, blurb: 'IVs/DVs, correctness, thresholds, RT, speed-accuracy tradeoff, subjective & involuntary measures, variability, trials, between-subjects, individual differences.' },
  'ch2-neuroscience': { name: 'Complementary Neuroscience', ch: 2, blurb: 'Cognitive, behavioral, and computational neuroscience; microelectrodes, lesions, optogenetics/opsins.' },
};

const COG_CH = { 2: 'How to Study Cognition' };

/* ---------- state + persistence ---------- */
const COG_KEY = 'cs-cogpsych';
const COG_PASS = 'psychology';
// Bump ONLY on a hard content reset -> XP/rank/mastery reset fresh. Adding chapters keeps this stable
// (the bank just grows), so accumulated progress across chapters is preserved.
const COG_MODULE = 'cogpsych-v1';
function cogLoad() { try { return JSON.parse(localStorage.getItem(COG_KEY)) || {}; } catch { return {}; } }
let COG = Object.assign({
  unlocked: false, module: '', xp: 0, answered: 0, correct: 0,
  bestScore: 0, bestCombo: 0, bestExam: 0, plays: 0,
  streak: { current: 0, longest: 0, lastDate: '' },
  q: {},            // qid -> { box: 0..5, a, c, ts }
  ach: [], examReady: false, starred: {}, learned: {},
}, cogLoad());
// Module changed since last visit -> wipe progress so rank/XP/mastery reflect THIS module only (keep unlock).
if (COG.module !== COG_MODULE) {
  COG = {
    unlocked: COG.unlocked, module: COG_MODULE,
    xp: 0, answered: 0, correct: 0, bestScore: 0, bestCombo: 0, bestExam: 0, plays: 0,
    streak: { current: 0, longest: 0, lastDate: '' },
    q: {}, ach: [], examReady: false, starred: {}, learned: {},
  };
  try { localStorage.setItem(COG_KEY, JSON.stringify(COG)); } catch {}
}
function cogSave() { try { localStorage.setItem(COG_KEY, JSON.stringify(COG)); } catch {} }

/* ---------- anonymous usage analytics (research) ----------
   Write-only to Supabase `usage_events`. No names / PII — a random per-browser id
   only. Fire-and-forget; never blocks or breaks the UI if offline/unconfigured.   */
function cogRandId() {
  try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch {}
  return 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
const COGA_ANON = (() => { try { let a = localStorage.getItem('cs-anon-id'); if (!a) { a = cogRandId(); localStorage.setItem('cs-anon-id', a); } return a; } catch { return cogRandId(); } })();
const COGA_SESSION = cogRandId();
let COGA_sessionLogged = false;
function cogTrack(event, props) {
  try {
    const sb = window.__cortexSB;
    if (!sb || !sb.from) return;
    sb.from('usage_events').insert({
      anon_id: COGA_ANON,
      session_id: COGA_SESSION,
      app_version: (typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''),
      section: 'cogpsych',
      event,
      props: props || {},
    }).then(() => {}, () => {});   // fire-and-forget
  } catch {}
}

let cogTimer = null;
let cogKeyHandler = null;
function cogUnbindKey() { if (cogKeyHandler) { document.removeEventListener('keydown', cogKeyHandler); cogKeyHandler = null; } }
function cogBindKey(fn) { cogUnbindKey(); cogKeyHandler = fn; document.addEventListener('keydown', fn); }
// every view transition runs cogClearTimer() first, so this is the single chokepoint that
// also tears down the previous question's keydown handler (prevents stale-handler leaks).
function cogClearTimer() { if (cogTimer) { clearInterval(cogTimer); cogTimer = null; } cogUnbindKey(); }

/* ---------- spaced-repetition box model ---------- */
const COG_INTERVAL_H = [0, 0.3, 4, 24, 72, 168]; // Leitner review intervals (hours) by box
function cogQ(id) { return COG.q[id] || (COG.q[id] = { box: 0, a: 0, c: 0, ts: 0 }); }
function cogBox(id) { return (COG.q[id] && COG.q[id].box) || 0; }
function cogComp(list) { if (!list.length) return 0; return Math.round(list.reduce((s, q) => s + cogBox(q.id), 0) / (list.length * 5) * 100); }
function cogChapterQs(ch) { return COG_BANK.filter(q => q.chapter === ch); }
function cogTopicQs(t) { return COG_BANK.filter(q => q.topic === t); }
function cogMastery(ch) { return cogComp(cogChapterQs(ch)); }
function cogOverall() { return cogComp(COG_BANK); }
function cogAccuracy() { return COG.answered ? Math.round(COG.correct / COG.answered * 100) : 0; }

function cogStatus() {
  const c = cogOverall();
  if (c >= 90) return { c, label: 'EXAM READY', cls: 'ready' };
  if (c >= 75) return { c, label: 'Almost exam ready', cls: 'almost' };
  if (c >= 50) return { c, label: 'Solid progress', cls: 'building' };
  if (c > 0) return { c, label: 'Getting started', cls: 'start' };
  return { c, label: 'Not started', cls: 'none' };
}

/* weakest topics first (only count topics that exist in the bank) */
function cogWeakTopics() {
  return Object.keys(COG_TOPICS)
    .map(t => { const qs = cogTopicQs(t); return { topic: t, name: COG_TOPICS[t].name, ch: COG_TOPICS[t].ch, comp: cogComp(qs), n: qs.length, seen: qs.filter(q => { const r = COG.q[q.id]; return r && r.a > 0; }).length }; })
    .filter(x => x.n > 0)
    .sort((a, b) => a.comp - b.comp || b.n - a.n);
}

/* adaptive selection: weak + unseen + due-for-review, interleaved */
function cogSmartPool(n) {
  const now = Date.now();
  const scored = COG_BANK.map(q => {
    const r = COG.q[q.id], box = r ? r.box : 0, ts = r ? r.ts : 0;
    const ageH = ts ? (now - ts) / 3.6e6 : 1e6;
    const due = box === 0 || ageH >= COG_INTERVAL_H[box];
    const pr = (5 - box) * 12 + (box === 0 ? 40 : 0) + (due ? 8 : -40) + Math.random() * 6;
    return { q, pr };
  });
  scored.sort((a, b) => b.pr - a.pr);
  return cogShuffle(scored.slice(0, Math.max(n, 1)).map(s => s.q)); // interleave the chosen set
}

function cogShuffle(a) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

/* ---------- ranks ---------- */
const COG_RANKS = [
  { min: 0, name: 'Armchair Philosopher' }, { min: 150, name: 'Introspectionist' }, { min: 400, name: 'Behaviorist' },
  { min: 800, name: 'Cognitivist' }, { min: 1400, name: 'Experimentalist' }, { min: 2200, name: 'Psychophysicist' },
  { min: 3200, name: 'Cognitive Scientist' }, { min: 4500, name: 'Cognitive Neuroscientist' }, { min: 6200, name: 'Mind Theorist' },
  { min: 8500, name: 'Master of Cognition' },
];
function cogRank(xp) {
  let idx = 0; for (let i = 0; i < COG_RANKS.length; i++) if (xp >= COG_RANKS[i].min) idx = i;
  const cur = COG_RANKS[idx], next = COG_RANKS[idx + 1] || null;
  const span = next ? next.min - cur.min : 1, into = next ? xp - cur.min : 1;
  return { lvl: idx + 1, name: cur.name, pct: next ? Math.max(2, Math.round(into / span * 100)) : 100, toNext: next ? next.min - xp : 0, next: next ? next.min : null };
}

/* ---------- achievements ---------- */
const COG_ACH = [
  { id: 'first', name: 'First Insight', desc: 'Answer your first question' },
  { id: 'combo5', name: 'On a Roll', desc: 'Reach a 5× combo' },
  { id: 'combo10', name: 'Chain Reaction', desc: 'Reach a 10× combo' },
  { id: 'blitz500', name: 'Blitz Master', desc: 'Score 500+ in one Blitz' },
  { id: 'smart', name: 'Study Smart', desc: 'Finish a Smart Review session' },
  { id: 'perfect', name: 'Flawless', desc: 'Finish a run 100% correct (8+ Q)' },
  { id: 'mind', name: 'Mind Reader', desc: 'Reach 100% on Mind & Brain' },
  { id: 'behav', name: 'Conditioned Response', desc: 'Reach 100% on Behaviorism' },
  { id: 'method', name: 'Methodologist', desc: 'Reach 100% on Methods' },
  { id: 'exam', name: 'Exam Slayer', desc: 'Beat the Exam Boss (85%+)' },
  { id: 'ready', name: 'Exam Ready', desc: 'Hit 90% overall competency' },
  { id: 'cogscientist', name: 'Certified Cognitive Scientist', desc: 'Reach the Cognitive Neuroscientist level' },
];
function cogGrant(id) {
  if (COG.ach.includes(id)) return;
  COG.ach.push(id); cogSave();
  const a = COG_ACH.find(x => x.id === id);
  if (a) cogToast(`Achievement unlocked · ${a.name}`);
}
function cogToast(msg) {
  const t = el(`<div class="gen-toast">${esc(msg)}</div>`);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 350); }, 2300);
}
function cogCheckAch() {
  if (cogComp(cogTopicQs('ch2-mind-brain')) >= 100) cogGrant('mind');
  if (cogComp(cogTopicQs('ch2-behaviorism')) >= 100) cogGrant('behav');
  if (cogComp(cogTopicQs('ch2-methods')) >= 100) cogGrant('method');
  if (cogRank(COG.xp).lvl >= 8) cogGrant('cogscientist');
  if (cogOverall() >= 90) { cogGrant('ready'); if (!COG.examReady) { COG.examReady = true; cogSave(); cogTrack('milestone', { kind: 'exam_ready', competency: cogOverall() }); } }
}

function cogBumpStreak() {
  const d = new Date(), today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const s = COG.streak; if (s.lastDate === today) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  s.current = s.lastDate === `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}` ? s.current + 1 : 1;
  s.lastDate = today; if (s.current > s.longest) s.longest = s.current;
}

/* record an answered question; updates box + xp */
function cogRecord(qq, right) {
  COG.answered++; if (right) COG.correct++;
  const r = cogQ(qq.id); r.a++; r.ts = Date.now();
  if (right) { r.c++; r.box = Math.min(5, r.box + 1); r.lastWrong = false; } else { r.box = Math.max(0, r.box - 1); r.lastWrong = true; }
  const diff = qq.difficulty === 'hard' ? 6 : qq.difficulty === 'med' ? 3 : 0;
  const xp = right ? 10 + (qq.type === 'calc' ? 5 : qq.type === 'label' ? 3 : 0) + diff : 1;
  COG.xp += xp;
  if (!COG.ach.includes('first')) cogGrant('first');
  return xp;
}

/* ============================================================================
   ENTRY + PASSWORD GATE
   ========================================================================= */
let cogBankReady = false, cogBankFailed = false;
function cogValidBankItem(q, seen) {
  return q && typeof q === 'object'
    && typeof q.id === 'string' && q.id && !seen.has(q.id)
    && typeof q.q === 'string' && q.q
    && typeof q.topic === 'string' && Object.prototype.hasOwnProperty.call(COG_TOPICS, q.topic)
    && Array.isArray(q.options) && q.options.length === 4 && q.options.every(o => typeof o === 'string' && o.length)
    && Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3
    && typeof q.explain === 'string' && typeof q.hint === 'string';
}
async function cogLoadBank() {
  try {
    const r = await fetch('data/cogpsych-bank.json?v=1');
    if (!r.ok) throw new Error('http ' + r.status);
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error('bad bank');   // an empty array is valid (no content yet)
    const seen = new Set(COG_DIAGRAMS.concat(COG_GENERATORS).map(q => q.id)), valid = [];
    for (const q of data) {
      if (!cogValidBankItem(q, seen)) continue;
      seen.add(q.id);
      if (q.type !== 'concept' && q.type !== 'calc' && q.type !== 'label') q.type = 'concept';
      if (q.difficulty !== 'easy' && q.difficulty !== 'med' && q.difficulty !== 'hard') q.difficulty = 'med';
      valid.push(q);
    }
    if (data.length && !valid.length) throw new Error('no valid bank items');   // non-empty but all malformed -> failure screen
    COG_GENERATED = valid;
    COG_BANK = COG_DIAGRAMS.concat(COG_GENERATED).concat(COG_GENERATORS);
    cogBankReady = true; cogBankFailed = false;
  } catch (e) { cogBankFailed = true; }
}
function cogLoadingScreen() {
  const root = el('<div></div>'); root.appendChild(topbar('cogpsych'));
  root.appendChild(el('<main class="panel gen-lock" id="main" tabindex="-1"><div class="gen-lock-box cornerframe"><span class="label">Cognitive Psychology</span><p class="gen-lock-sub">Loading questions…</p></div></main>'));
  root.appendChild(siteFooter()); setView(root);
}
function cogBankError() {
  const root = el('<div></div>'); root.appendChild(topbar('cogpsych'));
  const main = el('<main class="panel gen-lock" id="main" tabindex="-1"><div class="gen-lock-box cornerframe"><span class="label">Cognitive Psychology</span><p class="gen-lock-sub">Couldn\'t load the question bank — check your connection.</p><button class="btn btn-solid" id="gen-retry">Retry</button></div></main>');
  main.querySelector('#gen-retry').addEventListener('click', () => { cogBankFailed = false; renderCogPsych(); });
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}
function renderCogPsych() {
  cogClearTimer();
  if (!cogBankReady) {
    if (cogBankFailed) { cogBankError(); return; }
    cogLoadingScreen();
    cogLoadBank().then(renderCogPsych);
    return;
  }
  if (!COG_BANK.length) { renderCogEmpty(); return; }
  if (COG.unlocked) { renderCogHome(); return; }
  renderCogPassword();
}

function renderCogEmpty() {
  cogClearTimer();
  const root = el('<div></div>'); root.appendChild(topbar('cogpsych'));
  const main = el(`<main class="panel gen-lock" id="main" tabindex="-1"><div class="gen-lock-box cornerframe"><span class="label">Cognitive Psychology</span><h1 class="gen-lock-title">Coming soon</h1><p class="gen-lock-sub">Questions are being added. Check back shortly.</p></div></main>`);
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}
function renderCogPassword(errMsg) {
  const root = el('<div></div>');
  root.appendChild(topbar('cogpsych'));
  const main = el(`<main class="panel gen-lock" id="main" tabindex="-1">
    <div class="gen-lock-box cornerframe">
      <span class="label">Cognitive Psychology</span>
      <h1 class="gen-lock-title">Cognitive Psychology</h1>
      <p class="gen-lock-sub">The science of the mind — memory, attention, and how we study cognition. Mastery trainer, locked to a class passphrase.</p>
      <form id="gen-pass-form" class="gen-pass-form" autocomplete="off">
        <input type="password" id="gen-pass" class="gen-pass-input" placeholder="Enter passphrase" aria-label="Passphrase" />
        <button type="submit" class="btn btn-solid">Unlock</button>
      </form>
      ${errMsg ? `<p class="gen-pass-err">${esc(errMsg)}</p>` : ''}
      <p class="gen-priv">Anonymous usage data (how often modes are used and which questions are hardest — no names or personal info) is collected to improve this tool and support educational research.</p>
    </div>
  </main>`);
  main.querySelector('#gen-pass-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (main.querySelector('#gen-pass').value || '').trim().toLowerCase();
    if (val === COG_PASS) { COG.unlocked = true; cogSave(); cogTrack('unlock', {}); renderCogHome(); }
    else renderCogPassword('Incorrect passphrase. Try again.');
  });
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
  setTimeout(() => { const i = document.querySelector('#gen-pass'); if (i) i.focus(); }, 30);
}

/* ============================================================================
   HOME / DASHBOARD
   ========================================================================= */
function renderCogHome() {
  cogClearTimer();
  if (!COGA_sessionLogged) { COGA_sessionLogged = true; cogTrack('session_start', { competency: cogOverall(), mastered: COG_BANK.filter(q => cogBox(q.id) >= 5).length, total: COG_BANK.length, mobile: (window.innerWidth || 0) < 700 }); }
  const rank = cogRank(COG.xp), status = cogStatus();
  const missCount = cogMissPool().length, starredCount = cogStarredList().length;
  const weak = cogWeakTopics();
  const meter = (ch) => `<div class="gen-meter">
      <div class="gen-meter-top"><span>Ch ${ch} · ${COG_CH[ch]}</span><span class="mono">${cogMastery(ch)}%</span></div>
      <div class="gen-bar"><span style="width:${cogMastery(ch)}%"></span></div>
    </div>`;
  const weakItems = weak.slice(0, 3).map(w => `<button class="gen-weak-row" data-topic="${w.topic}">
      <span class="gen-weak-name">${esc(w.name)}</span>
      <span class="gen-weak-bar"><span style="width:${w.comp}%"></span></span>
      <span class="mono gen-weak-pct">${w.comp}%</span>
    </button>`).join('');

  const root = el('<div></div>');
  root.appendChild(topbar('cogpsych'));
  const main = el(`<main class="panel gen-home" id="main" tabindex="-1">
    ${status.cls === 'ready' ? `<div class="gen-ready-banner"><span class="gen-ready-pulse"></span>EXAM READY · ${status.c}% competency</div>` : ''}

    <header class="gen-hero cornerframe">
      <div class="gen-hero-l">
        <span class="label">Cognitive Psychology · The Science of the Mind</span>
        <h1>Cognitive Psychology</h1>
        <div class="gen-rank"><span class="gen-rank-lvl mono">LV ${rank.lvl}</span><span class="gen-rank-name">${esc(rank.name)}</span></div>
        <div class="gen-xpbar"><span style="width:${rank.pct}%"></span></div>
        <p class="gen-xp-note mono">${COG.xp.toLocaleString()} XP${rank.next ? ` · ${rank.toNext.toLocaleString()} to next level` : ' · MAX'}</p>
      </div>
      <div class="gen-hero-r">
        <div class="gen-comp-ring gen-comp-${status.cls}">
          <span class="gen-comp-num mono">${status.c}%</span><span class="gen-comp-lab">competency</span>
        </div>
        <span class="gen-comp-status gen-comp-${status.cls}">${status.label}</span>
      </div>
    </header>

    <div class="gen-statrow">
      <div class="gen-stat"><span class="gen-stat-n mono">${COG.streak.current}</span><span class="gen-stat-l">Day streak</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${cogAccuracy()}%</span><span class="gen-stat-l">Accuracy</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${COG.bestScore}</span><span class="gen-stat-l">Best blitz</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${COG.bestCombo}×</span><span class="gen-stat-l">Best combo</span></div>
    </div>

    <section class="gen-modes">
      <button class="gen-mode-card gen-mode-learn cornerframe" data-mode="learn">
        <span class="gen-mode-tag">guided · teaches you</span>
        <h2>Learn</h2>
        <p>New to a topic, or it just won't stick? Work through it the Socratic way — a question, your reasoning, then the idea — with interactive diagrams you build and step through.</p>
        <span class="gen-mode-go">Open lessons →</span>
      </button>
      <button class="gen-mode-card gen-mode-hero cornerframe" data-mode="smart">
        <span class="gen-mode-tag">recommended · endless</span>
        <h2>Smart Review</h2>
        <p>Endless adaptive loop — keeps feeding you your weakest questions (spaced repetition + interleaving) until every one is mastered. Just keep going.</p>
        <span class="gen-mode-go">Study →</span>
      </button>
      <button class="gen-mode-card cornerframe" data-mode="blitz">
        <span class="gen-mode-tag">90s · combo</span>
        <h2>Blitz</h2>
        <p>Rapid-fire across the whole chapter. Stack combos, chase your high score.</p>
        <span class="gen-mode-go">Start →</span>
      </button>
      <button class="gen-mode-card cornerframe" data-mode="chapter">
        <span class="gen-mode-tag">untimed · learn</span>
        <h2>Topic Drills</h2>
        <p>Pick one topic and work through it with full explanations until the meter fills.</p>
        <span class="gen-mode-go">Choose →</span>
      </button>
      <button class="gen-mode-card cornerframe" data-mode="exam">
        <span class="gen-mode-tag">20 Q · 3 lives</span>
        <h2>Exam Boss</h2>
        <p>Mixed gauntlet across every chapter. Beat 85% to slay the boss.${COG.bestExam ? ` Best: ${COG.bestExam}%.` : ''}</p>
        <span class="gen-mode-go">Fight →</span>
      </button>
      <button class="gen-mode-card cornerframe" data-mode="misses">
        <span class="gen-mode-tag">targeted</span>
        <h2>Review Misses</h2>
        <p>Drill only the questions you've gotten wrong, with hints, until they stick.${missCount ? ` ${missCount} waiting.` : ''}</p>
        <span class="gen-mode-go">Review →</span>
      </button>
    </section>

    <div class="gen-cols">
      <section class="gen-weak cornerframe">
        <span class="label">Your weak spots — focus here</span>
        ${weak.some(w => w.seen > 0) ? weakItems : '<p class="gen-weak-empty">Answer some questions and your weakest topics will surface here with a one-tap drill.</p>'}
        <button class="btn btn-solid gen-weak-cta" data-mode="smart">Drill my weak spots</button>
      </section>

      <section class="gen-mastery cornerframe">
        <span class="label">Chapter mastery</span>
        ${Object.keys(COG_CH).map(ch => meter(Number(ch))).join('')}
      </section>
    </div>

    <div class="gen-utils">
      <button class="ghostbtn" data-mode="stats">View stats →</button>
      <button class="ghostbtn" data-mode="starred">★ Starred (${starredCount})</button>
    </div>

    <section class="gen-method cornerframe">
      <span class="label">How to study this (science-backed) · exam soon?</span>
      <ol class="gen-method-list">
        <li><b>Test, don't reread.</b> Retrieval practice (answering) builds memory far better than review — this whole arcade is active recall.</li>
        <li><b>Run Smart Review daily.</b> Spaced repetition resurfaces each item right before you'd forget it; the box meter handles the timing.</li>
        <li><b>Interleave.</b> Blitz and Smart Review mix topics on purpose — switching topics beats blocking one at a time.</li>
        <li><b>Chase your weak spots,</b> not what you already know. Exam soon? Topic Drills on your weakest topics → Smart Review until 90% → Exam Boss to pressure-test.</li>
      </ol>
    </section>

    <section class="gen-trophy cornerframe">
      <span class="label">Achievements · ${COG.ach.length}/${COG_ACH.length}</span>
      <div class="gen-badges">
        ${COG_ACH.map(a => { const got = COG.ach.includes(a.id); return `<div class="gen-badge ${got ? 'got' : ''}" title="${esc(a.desc)}"><span class="gen-badge-name">${esc(a.name)}</span><span class="gen-badge-desc">${esc(a.desc)}</span></div>`; }).join('')}
      </div>
    </section>

    <p class="gen-foot-note">${COG_BANK.length} questions · Cognitive Psychology · ${Object.keys(COG_CH).map(ch => `Ch ${ch}: ${COG_CH[ch]}`).join(' · ')}. <button class="ghostbtn" id="gen-reset">Reset arcade progress</button></p>
  </main>`);

  main.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    const m = b.dataset.mode;
    if (m === 'learn') renderCogLearnHome();
    else if (m === 'smart') startCogSmart();
    else if (m === 'blitz') startCogBlitz();
    else if (m === 'chapter') renderCogChapterPick();
    else if (m === 'exam') startCogExam();
    else if (m === 'misses') startCogMisses();
    else if (m === 'stats') renderCogStats();
    else if (m === 'starred') startCogStarred();
  }));
  main.querySelectorAll('[data-topic]').forEach(b => b.addEventListener('click', () => startCogTopic(b.dataset.topic)));
  main.querySelector('#gen-reset').addEventListener('click', () => {
    if (!confirm('Reset all Cognitive Psychology progress (XP, mastery, achievements)? You stay unlocked.')) return;
    COG = Object.assign({ unlocked: true, xp: 0, answered: 0, correct: 0, bestScore: 0, bestCombo: 0, bestExam: 0, plays: 0, streak: { current: 0, longest: 0, lastDate: '' }, q: {}, starred: {}, learned: {}, ach: [], examReady: false });
    cogSave(); renderCogHome();
  });
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

/* ============================================================================
   CHAPTER PICKER
   ========================================================================= */
function renderCogChapterPick() {
  cogClearTimer();
  const card = (key) => { const t = COG_TOPICS[key], qs = cogTopicQs(key); return `<button class="gen-ch-card cornerframe" data-topic="${key}">
    <span class="gen-ch-num mono">CH ${t.ch}</span><h2>${esc(t.name)}</h2><p>${esc(t.blurb)}</p>
    <div class="gen-meter"><div class="gen-bar"><span style="width:${cogComp(qs)}%"></span></div></div>
    <span class="mono gen-ch-pct">${cogComp(qs)}% · ${qs.length} Q</span></button>`; };
  const root = el('<div></div>');
  root.appendChild(topbar('cogpsych'));
  const main = el(`<main class="panel gen-pick" id="main" tabindex="-1">
    <div class="gen-pick-head"><button class="ghostbtn" id="gen-back">← Home</button><h1>Topic Drills</h1></div>
    <div class="gen-ch-grid">
      ${Object.keys(COG_TOPICS).map(card).join('')}
    </div>
  </main>`);
  main.querySelector('#gen-back').addEventListener('click', renderCogHome);
  main.querySelectorAll('[data-topic]').forEach(b => b.addEventListener('click', () => startCogTopic(b.dataset.topic)));
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

/* ============================================================================
   GAME RUNS
   ========================================================================= */
function startCogSmart() {
  cogBumpStreak(); COG.plays++; cogSave();
  // Endless adaptive loop: serve the single most-needed (weakest/due/unseen) question
  // each time, forever, until every question is fully mastered (box 5).
  cogTrack('mode_start', { mode: 'smart' });
  cogRunQuestion({ mode: 'smart', endless: true, pool: [], retryQ: [], idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false, lastId: null, lastTopic: null });
}
function startCogBlitz() {
  cogBumpStreak(); COG.plays++; cogSave();
  cogTrack('mode_start', { mode: 'blitz' });
  cogRunQuestion({ mode: 'blitz', pool: cogShuffle(COG_BANK), idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, timeLeft: 90, locked: false });
}
function startCogChapter(ch) {
  COG.plays++; cogSave();
  cogTrack('mode_start', { mode: 'chapter', chapter: ch });
  cogRunQuestion({ mode: 'chapter', chapter: ch, pool: cogShuffle(cogChapterQs(ch)), idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false });
}
function startCogTopic(t) {
  COG.plays++; cogSave();
  cogTrack('mode_start', { mode: 'topic', topic: t });
  cogRunQuestion({ mode: 'topic', topic: t, pool: cogShuffle(cogTopicQs(t)), idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false });
}
function startCogExam() {
  cogBumpStreak(); COG.plays++; cogSave();
  const chs = Object.keys(COG_CH).map(Number);
  const per = Math.ceil(20 / Math.max(1, chs.length));
  let pool = [];
  chs.forEach(ch => { pool = pool.concat(cogShuffle(cogChapterQs(ch)).slice(0, per)); });
  pool = cogShuffle(pool).slice(0, 20);
  if (pool.length < 20) { const have = new Set(pool.map(q => q.id)); pool = pool.concat(cogShuffle(COG_BANK).filter(q => !have.has(q.id)).slice(0, 20 - pool.length)); }
  cogTrack('mode_start', { mode: 'exam' });
  cogRunQuestion({ mode: 'exam', pool, idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, lives: 3, locked: false });
}
/* ---------- review misses, starred, stats ---------- */
function cogMissPool() { return COG_BANK.filter(q => { const r = COG.q[q.id]; return r && r.a > 0 && (r.lastWrong || r.box <= 2); }); }
function cogStarredList() { return COG_BANK.filter(q => COG.starred && COG.starred[q.id]); }
function cogToggleStar(id) { if (!COG.starred) COG.starred = {}; if (COG.starred[id]) delete COG.starred[id]; else COG.starred[id] = 1; cogSave(); return !!COG.starred[id]; }
function cogEmpty(title, msg) {
  cogClearTimer();
  const root = el('<div></div>'); root.appendChild(topbar('cogpsych'));
  const main = el(`<main class="panel gen-result" id="main" tabindex="-1"><div class="gen-res-box cornerframe"><span class="label">${esc(title)}</span><p class="gen-empty-msg">${esc(msg)}</p><div class="gen-res-btns"><button class="btn btn-solid" id="gen-homebtn">Back to home</button></div></div></main>`);
  main.querySelector('#gen-homebtn').addEventListener('click', renderCogHome);
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}
function startCogMisses() {
  const pool = cogShuffle(cogMissPool());
  if (!pool.length) { cogEmpty('Review misses', 'No misses to review right now — nice work. Play a mode to surface your weak spots, then come back.'); return; }
  COG.plays++; cogSave();
  cogRunQuestion({ mode: 'misses', pool, idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false });
}
function startCogStarred() {
  const pool = cogShuffle(cogStarredList());
  if (!pool.length) { cogEmpty('Starred questions', "You haven't starred any questions yet. Tap the star on any question to save it here for later."); return; }
  COG.plays++; cogSave();
  cogRunQuestion({ mode: 'starred', pool, idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false });
}
function renderCogStats() {
  cogClearTimer();
  const topicRows = Object.keys(COG_TOPICS).map(t => {
    const qs = cogTopicQs(t); if (!qs.length) return '';
    let a = 0, c = 0, m = 0; qs.forEach(q => { const r = COG.q[q.id]; if (r) { a += r.a; c += r.c; if (r.box >= 4) m++; } });
    const acc = a ? Math.round(c / a * 100) : 0;
    return `<div class="gen-srow"><span class="gen-srow-name">${esc(COG_TOPICS[t].name)}</span><span class="gen-srow-bar"><span style="width:${cogComp(qs)}%"></span></span><span class="mono gen-srow-vals">${cogComp(qs)}% · ${acc}% acc · ${m}/${qs.length}</span></div>`;
  }).join('');
  const maxed = COG_BANK.filter(q => COG.q[q.id] && COG.q[q.id].box >= 5).length;
  const root = el('<div></div>'); root.appendChild(topbar('cogpsych'));
  const main = el(`<main class="panel gen-pick" id="main" tabindex="-1">
    <div class="gen-pick-head"><button class="ghostbtn" id="gen-back">← Home</button><h1>Your stats</h1></div>
    <div class="gen-statrow">
      <div class="gen-stat"><span class="gen-stat-n mono">${cogOverall()}%</span><span class="gen-stat-l">Competency</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${cogAccuracy()}%</span><span class="gen-stat-l">Accuracy</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${COG.answered.toLocaleString()}</span><span class="gen-stat-l">Answered</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${maxed}/${COG_BANK.length}</span><span class="gen-stat-l">Maxed out</span></div>
    </div>
    <section class="gen-mastery cornerframe"><span class="label">By topic — competency · accuracy · strong</span>${topicRows}</section>
    <div class="gen-res-btns gen-stats-actions"><button class="btn" id="gen-misses2">Review my misses (${cogMissPool().length})</button><button class="btn" id="gen-starred2">★ Starred (${cogStarredList().length})</button></div>
  </main>`);
  main.querySelector('#gen-back').addEventListener('click', renderCogHome);
  main.querySelector('#gen-misses2').addEventListener('click', startCogMisses);
  main.querySelector('#gen-starred2').addEventListener('click', startCogStarred);
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

function cogComboMult(combo) { return Math.min(5, 1 + Math.floor(combo / 3)); }

// Endless Smart Review: pick the one most-needed question right now. Weakest box
// first, then due-for-review, lightly interleaved, never the same one twice in a row.
// Returns null once everything is fully mastered (box 5).
function cogNextSmart(run) {
  // In-session requeue (Quizlet-style): a missed question cycles back within 2-3 questions,
  // ahead of the normal adaptive pick, and reappears with its "think it through" hint.
  if (run.retryQ && run.retryQ.length) {
    const i = run.retryQ.findIndex(r => r.due <= run.answered);
    if (i >= 0) { const r = run.retryQ.splice(i, 1)[0]; run.lastId = r.q.id; run.lastTopic = r.q.topic; return r.q; }
  }
  const now = Date.now();
  const pool = COG_BANK.filter(q => cogBox(q.id) < 5);
  if (!pool.length) {
    // everything mastered but a retry is still pending -> serve it rather than ending
    if (run.retryQ && run.retryQ.length) { const r = run.retryQ.shift(); run.lastId = r.q.id; run.lastTopic = r.q.topic; return r.q; }
    return null;
  }
  let best = null, bestPr = -1e9;
  for (const q of pool) {
    const r = COG.q[q.id], box = r ? r.box : 0, ts = r ? r.ts : 0;
    const ageH = ts ? (now - ts) / 3.6e6 : 1e6;
    const due = box === 0 || ageH >= COG_INTERVAL_H[box];
    let pr = (5 - box) * 12 + (box === 0 ? 30 : 0) + (due ? 8 : -30) + Math.random() * 6;
    if (q.id === run.lastId) pr -= 100;                         // no immediate repeat
    if (run.lastTopic && q.topic === run.lastTopic) pr -= 4;    // light interleaving
    if (pr > bestPr) { bestPr = pr; best = q; }
  }
  run.lastId = best.id; run.lastTopic = best.topic;
  return best;
}

function cogSmartComplete(run) {
  cogClearTimer(); cogGrant('smart'); cogCheckAch(); cogSave();
  cogTrack('milestone', { kind: 'fully_mastered' });
  cogTrack('run_end', { mode: 'smart', answered: run.answered, correct: run.correct, maxCombo: run.maxCombo, competency: cogOverall() });
  const root = el('<div></div>');
  root.appendChild(topbar('cogpsych'));
  const main = el(`<main class="panel gen-result" id="main" tabindex="-1">
    <div class="gen-res-box cornerframe">
      <span class="label">Fully mastered</span>
      <h1 class="gen-res-sub">All ${COG_BANK.length} questions maxed</h1>
      <div class="gen-res-grid">
        <div><span class="mono">100%</span><span>competency</span></div>
        <div><span class="mono">${run.correct}/${run.answered}</span><span>this session</span></div>
        <div><span class="mono">${run.maxCombo}×</span><span>best streak</span></div>
        <div><span class="mono">${COG.xp.toLocaleString()}</span><span>total XP</span></div>
      </div>
      <p class="gen-res-ready">Every question is maxed out — you mastered the material. Run a maintenance pass anytime to stay sharp.</p>
      <div class="gen-res-btns">
        <button class="btn btn-solid" id="gen-maint">Maintenance pass</button>
        <button class="btn" id="gen-homebtn">Home</button>
      </div>
    </div>
  </main>`);
  main.querySelector('#gen-homebtn').addEventListener('click', renderCogHome);
  main.querySelector('#gen-maint').addEventListener('click', () => cogRunQuestion({ mode: 'smart', pool: cogShuffle(COG_BANK), idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false }));
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

/* ---------- calc tools: mini calculator + scratchpad (calc questions only) ---------- */
let cogToolsOpen = false;   // panel open-state persists across questions in a session
let cogScratch = '';        // scratchpad text persists across questions in a session
function cogToolsHtml() {
  const keys = ['C', '←', '(', ')', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+'];
  const dk = { 'C': 'clear', '←': 'back', '=': 'eq' };
  const cl = { 'C': 'gen-calc-fn', '←': 'gen-calc-fn', '=': 'gen-calc-eq', '÷': 'gen-calc-op', '×': 'gen-calc-op', '−': 'gen-calc-op', '+': 'gen-calc-op' };
  const grid = keys.map(k => `<button type="button" class="gen-calc-key ${cl[k] || ''}" data-k="${dk[k] || k}">${k}</button>`).join('');
  return `<div class="gen-tools">
      <button type="button" class="gen-tools-toggle" id="gen-tools-toggle">${cogToolsOpen ? '▾' : '▸'} Calculator &amp; scratchpad</button>
      <div class="gen-tools-panel" id="gen-tools-panel"${cogToolsOpen ? '' : ' hidden'}>
        <div class="gen-calc">
          <input type="text" class="gen-calc-disp" id="gen-calc-disp" inputmode="none" readonly aria-label="Calculator display" />
          <div class="gen-calc-keys">${grid}</div>
        </div>
        <div class="gen-pad"><textarea class="gen-pad-area" id="gen-pad-area" rows="6" placeholder="Scratchpad — work it out here…"></textarea></div>
      </div>
    </div>`;
}
function cogCalcEval(expr) {
  if (!/^[-−0-9+*/×÷().%\s]*$/.test(expr)) return 'Error';
  const clean = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/%/g, '/100');
  if (!clean.trim()) return '';
  try {
    const v = Function('"use strict";return (' + clean + ')')();
    if (typeof v !== 'number' || !isFinite(v)) return 'Error';
    return String(Math.round(v * 1e6) / 1e6);
  } catch { return 'Error'; }
}
function cogWireTools(main) {
  const toggle = main.querySelector('#gen-tools-toggle');
  if (!toggle) return;
  const panel = main.querySelector('#gen-tools-panel');
  const disp = main.querySelector('#gen-calc-disp');
  const pad = main.querySelector('#gen-pad-area');
  toggle.addEventListener('click', () => {
    cogToolsOpen = panel.hidden; panel.hidden = !cogToolsOpen;
    toggle.textContent = (cogToolsOpen ? '▾' : '▸') + ' Calculator & scratchpad';
  });
  if (pad) { pad.value = cogScratch; pad.addEventListener('input', () => { cogScratch = pad.value; }); }
  let evaluated = false;
  main.querySelectorAll('.gen-calc-key').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.k;
    if (k === 'clear') { disp.value = ''; evaluated = false; return; }
    if (k === 'back') { disp.value = disp.value.slice(0, -1); evaluated = false; return; }
    if (k === 'eq') { disp.value = cogCalcEval(disp.value); evaluated = true; return; }
    if (disp.value === 'Error') disp.value = '';
    if (evaluated) { if (/[0-9.(]/.test(k)) disp.value = ''; evaluated = false; }
    disp.value += k;
  }));
}

function cogRunQuestion(run) {
  cogClearTimer();
  run.locked = false;
  let qq;
  if (run.endless) {
    qq = cogNextSmart(run);
    if (!qq) { cogSmartComplete(run); return; }
  } else {
    if (!run.pool.length) { cogEndRun(run); return; }
    if (run.mode === 'blitz') { if (run.idx >= run.pool.length) { run.pool = cogShuffle(COG_BANK); run.idx = 0; } }
    else if (run.idx >= run.pool.length) { cogEndRun(run); return; }
    qq = run.pool[run.idx];
  }
  if (qq && qq.make) qq = Object.assign({}, qq, qq.make());
  const showHint = !!((qq._retry || (COG.q[qq.id] && COG.q[qq.id].lastWrong)) && qq.hint);
  const order = cogShuffle([0, 1, 2, 3]);
  const correctDisp = order.indexOf(qq.answer);

  const root = el('<div></div>');
  root.appendChild(topbar('cogpsych'));
  const main = el(`<main class="panel gen-game" id="main" tabindex="-1">
    ${cogHud(run)}
    <div class="gen-q cornerframe" data-qid="${qq.id}">
      <div class="gen-q-meta"><span class="mono">CH ${qq.chapter}</span><span class="gen-q-tag">${esc((COG_TOPICS[qq.topic] && COG_TOPICS[qq.topic].name) || 'Practice')}</span><span class="gen-q-diff gen-d-${qq.difficulty}">${qq.difficulty}</span>${qq.type === 'label' ? '<span class="gen-q-pic">diagram</span>' : ''}<button type="button" class="gen-star ${COG.starred && COG.starred[qq.id] ? 'on' : ''}" id="gen-star" aria-label="Star this question">${COG.starred && COG.starred[qq.id] ? '★' : '☆'}</button></div>
      ${qq.svg ? `<div class="gen-q-svg">${qq.svg}</div>` : ''}
      ${qq.fig && window.COG_FIGS && window.COG_FIGS[qq.fig] ? '<div class="gen-q-fig" id="gen-fig"></div>' : ''}
      <h2 class="gen-q-stem">${esc(qq.q)}</h2>
      ${showHint ? `<div class="gen-hint"><span class="gen-hint-lab">Think it through</span> ${esc(qq.hint)}</div>` : ''}
      <div class="gen-opts">
        ${order.map((origIdx, dispIdx) => `<button class="gen-opt" data-disp="${dispIdx}" data-ok="${dispIdx === correctDisp ? 1 : 0}"><span class="gen-opt-key mono">${String.fromCharCode(65 + dispIdx)}</span><span class="gen-opt-txt">${esc(qq.options[origIdx])}</span></button>`).join('')}
      </div>
      ${qq.type === 'calc' ? cogToolsHtml() : ''}
      <div class="gen-explain" id="gen-explain" hidden></div>
      <div class="gen-next-row" id="gen-next-row" hidden><button class="btn btn-solid" id="gen-next">Next →</button></div>
    </div>
  </main>`);

  const optsWrap = main.querySelector('.gen-opts');
  const explainBox = main.querySelector('#gen-explain');
  const nextRow = main.querySelector('#gen-next-row');

  const choose = (btn) => {
    if (run.locked) return;
    run.locked = true;
    const right = btn.dataset.ok === '1';
    const beforeBox = cogBox(qq.id);
    cogRecord(qq, right); run.answered++;
    if (right && run.mode !== 'blitz' && cogBox(qq.id) === 5 && beforeBox === 4) cogToast(`Mastered · ${qq.tag}`);
    cogTrack('answer', { mode: run.mode, qid: qq.id, chapter: qq.chapter, topic: qq.topic, type: qq.type, difficulty: qq.difficulty, correct: right ? 1 : 0 });
    [...optsWrap.querySelectorAll('.gen-opt')].forEach(o => { o.disabled = true; if (o.dataset.ok === '1') o.classList.add('correct'); else if (o === btn) o.classList.add('wrong'); });

    if (right) {
      run.correct++; run.combo++; if (run.combo > run.maxCombo) run.maxCombo = run.combo;
      if (run.combo > COG.bestCombo) COG.bestCombo = run.combo;
      if (run.combo === 5) cogGrant('combo5');
      if (run.combo === 10) cogGrant('combo10');
      const mult = cogComboMult(run.combo);
      const base = (qq.type === 'calc' ? 150 : qq.type === 'label' ? 130 : 100) + (qq.difficulty === 'hard' ? 50 : qq.difficulty === 'med' ? 25 : 0);
      run.score += base * mult;
      cogFlash(main, `+${base * mult}`, run.combo >= 3 ? `${mult}× COMBO` : '', true);
    } else {
      run.combo = 0; if (run.mode === 'exam') run.lives--;
      cogFlash(main, 'MISS', '', false);
      if (run.mode === 'chapter' || run.mode === 'topic' || run.mode === 'misses' || run.mode === 'starred') {
        const retry = Object.assign({}, qq); delete retry.make; retry._retry = true;
        run.pool.splice(Math.min(run.pool.length, run.idx + 1 + cogRand(1, 2)), 0, retry);
      } else if (run.endless) {
        // Smart Review: requeue the miss to reappear within 2-3 questions with its hint.
        const retry = Object.assign({}, qq); delete retry.make; retry._retry = true;
        (run.retryQ || (run.retryQ = [])).push({ q: retry, due: run.answered + cogRand(1, 2) });
      }
    }
    cogCheckAch(); cogSave();
    explainBox.innerHTML = `<span class="gen-ex-label">${right ? 'Correct' : 'Answer'}</span> ${esc(qq.explain)}`;
    explainBox.hidden = false;

    if (run.mode === 'exam' && run.lives <= 0) {
      nextRow.hidden = false; const nb = main.querySelector('#gen-next'); nb.textContent = 'See results →';
      nb.addEventListener('click', () => cogEndRun(run)); nb.focus(); return;
    }
    if (run.mode === 'blitz') {
      setTimeout(() => { run.idx++; if (run.timeLeft > 0) cogRunQuestion(run); }, right ? 650 : 1100);
    } else {
      nextRow.hidden = false; const nb = main.querySelector('#gen-next');
      if (!run.endless && run.idx + 1 >= run.pool.length) nb.textContent = 'Finish →';
      nb.addEventListener('click', () => { run.idx++; cogRunQuestion(run); }); nb.focus();
    }
  };

  optsWrap.querySelectorAll('.gen-opt').forEach(b => b.addEventListener('click', () => choose(b)));
  const onKey = (e) => {
    // self-guard: if this question's view is gone (e.g. navigated away), retire this handler
    if (!document.body.contains(main)) { document.removeEventListener('keydown', onKey); if (cogKeyHandler === onKey) cogKeyHandler = null; return; }
    const tg = e.target;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable)) return;
    if (run.locked) { if (e.key === 'Enter' && !nextRow.hidden) main.querySelector('#gen-next')?.click(); return; }
    let k = -1;
    if (/^[a-dA-D]$/.test(e.key)) k = e.key.toLowerCase().charCodeAt(0) - 97;
    else if (/^[1-4]$/.test(e.key)) k = +e.key - 1;
    if (k >= 0) { const b = optsWrap.querySelector(`.gen-opt[data-disp="${k}"]`); if (b) choose(b); }
  };
  cogWireTools(main);
  const starBtn = main.querySelector('#gen-star'); if (starBtn) starBtn.addEventListener('click', (e) => { const on = cogToggleStar(qq.id); e.currentTarget.textContent = on ? '★' : '☆'; e.currentTarget.classList.toggle('on', on); });
  cogBindKey(onKey);   // replaces any previous question's handler

  root.appendChild(main); root.appendChild(siteFooter()); setView(root);

  // mount the interactive figure (if this question has one) above the stem
  if (qq.fig && window.COG_FIGS && window.COG_FIGS[qq.fig]) {
    const figHost = main.querySelector('#gen-fig');
    if (figHost) { try { window.COG_FIGS[qq.fig](figHost); } catch (e) { figHost.remove(); } }
  }

  if (run.mode === 'blitz') {
    const tEl = main.querySelector('#gen-time');
    cogTimer = setInterval(() => {
      if (!document.body.contains(main)) { cogClearTimer(); return; }
      run.timeLeft--;
      if (tEl) { tEl.textContent = run.timeLeft; if (run.timeLeft <= 10) tEl.classList.add('low'); }
      if (run.timeLeft <= 0) { cogClearTimer(); cogEndRun(run); }
    }, 1000);
  }
}

function cogHud(run) {
  const quit = `<button class="ghostbtn gen-quit" id="cog-quit">✕ ${run.mode === 'blitz' || run.mode === 'exam' ? 'Quit' : 'Exit'}</button>`;
  if (run.mode === 'blitz') return `<div class="gen-hud">${quit}
    <div class="gen-hud-time"><span class="mono" id="gen-time">${run.timeLeft}</span><span class="gen-hud-l">sec</span></div>
    <div class="gen-hud-score"><span class="mono">${run.score}</span><span class="gen-hud-l">score</span></div>
    <div class="gen-hud-combo ${run.combo >= 3 ? 'hot' : ''}"><span class="mono">${run.combo}×</span><span class="gen-hud-l">combo</span></div></div>`;
  if (run.mode === 'exam') return `<div class="gen-hud">${quit}
    <div class="gen-hud-q"><span class="mono">${run.idx + 1}/${run.pool.length}</span><span class="gen-hud-l">question</span></div>
    <div class="gen-hud-lives">${'◆'.repeat(Math.max(0, run.lives))}${'◇'.repeat(Math.max(0, 3 - run.lives))}</div>
    <div class="gen-hud-score"><span class="mono">${run.correct}</span><span class="gen-hud-l">correct</span></div></div>`;
  if (run.mode === 'smart' && run.endless) {
    const mastered = COG_BANK.filter(q => cogBox(q.id) >= 5).length;
    return `<div class="gen-hud">${quit}
    <div class="gen-hud-q"><span class="mono">${mastered}/${COG_BANK.length}</span><span class="gen-hud-l">mastered</span></div>
    <div class="gen-hud-q"><span class="mono">${cogOverall()}%</span><span class="gen-hud-l">competency</span></div>
    <div class="gen-hud-combo ${run.combo >= 3 ? 'hot' : ''}"><span class="mono">${run.combo}×</span><span class="gen-hud-l">streak</span></div>
    <div class="gen-hud-score"><span class="mono">${run.correct}/${run.answered}</span><span class="gen-hud-l">correct</span></div></div>`;
  }
  const label = run.mode === 'smart' ? 'Smart Review' : run.mode === 'misses' ? 'Review misses' : run.mode === 'starred' ? 'Starred' : run.mode === 'topic' ? (COG_TOPICS[run.topic] ? COG_TOPICS[run.topic].name : 'Drill') : `Ch ${run.chapter}`;
  return `<div class="gen-hud">${quit}
    <div class="gen-hud-q"><span class="mono">${run.idx + 1}/${run.pool.length}</span><span class="gen-hud-l">${esc(label)}</span></div>
    <div class="gen-hud-combo ${run.combo >= 3 ? 'hot' : ''}"><span class="mono">${run.combo}×</span><span class="gen-hud-l">streak</span></div>
    <div class="gen-hud-score"><span class="mono">${run.correct}/${run.answered}</span><span class="gen-hud-l">correct</span></div></div>`;
}

function cogFlash(scope, big, small, good) {
  const f = el(`<div class="gen-flash ${good ? 'good' : 'bad'}"><span class="gen-flash-big">${esc(big)}</span>${small ? `<span class="gen-flash-small">${esc(small)}</span>` : ''}</div>`);
  scope.appendChild(f); requestAnimationFrame(() => f.classList.add('in'));
  setTimeout(() => { f.classList.remove('in'); setTimeout(() => f.remove(), 300); }, 700);
}
document.addEventListener('click', (e) => { if (e.target && e.target.id === 'cog-quit') { cogClearTimer(); renderCogHome(); } });

/* ============================================================================
   RESULTS
   ========================================================================= */
function cogEndRun(run) {
  cogClearTimer();
  const acc = run.answered ? Math.round(run.correct / run.answered * 100) : 0;
  let headline = '', sub = '', extra = '';
  const grid = (cells) => `<div class="gen-res-grid">${cells.map(c => `<div><span class="mono">${c[0]}</span><span>${c[1]}</span></div>`).join('')}</div>`;

  if (run.mode === 'blitz') {
    const best = run.score > COG.bestScore; if (best) COG.bestScore = run.score;
    if (run.score >= 500) cogGrant('blitz500');
    if (acc === 100 && run.answered >= 8) cogGrant('perfect');
    headline = best ? 'NEW HIGH SCORE' : 'Time!'; sub = `${run.score} points`;
    extra = grid([[`${run.correct}/${run.answered}`, 'answered'], [`${acc}%`, 'accuracy'], [`${run.maxCombo}×`, 'best combo'], [`${COG.bestScore}`, 'all-time best']]);
  } else if (run.mode === 'exam') {
    const beat = acc >= 85 && run.lives > 0; if (acc > COG.bestExam) COG.bestExam = acc; if (beat) cogGrant('exam');
    headline = run.lives <= 0 ? 'BOSS WINS' : (beat ? 'BOSS DEFEATED' : 'Boss survives'); sub = `${acc}% · ${run.correct}/${run.answered}`;
    extra = grid([[`${acc}%`, 'score'], [`${run.maxCombo}×`, 'best combo'], [`${run.lives}`, 'lives left'], [`${COG.bestExam}%`, 'best ever']]);
  } else if (run.mode === 'smart') {
    cogGrant('smart'); if (acc === 100 && run.answered >= 8) cogGrant('perfect');
    headline = 'Smart Review done'; sub = `${cogOverall()}% overall competency`;
    extra = grid([[`${run.correct}/${run.answered}`, 'correct'], [`${acc}%`, 'accuracy'], [`+${run.maxCombo}`, 'best streak'], [`${cogOverall()}%`, 'competency']]);
  } else if (run.mode === 'topic') {
    headline = 'Drill complete'; sub = `${COG_TOPICS[run.topic] ? COG_TOPICS[run.topic].name : ''} · ${cogComp(cogTopicQs(run.topic))}%`;
    extra = grid([[`${run.correct}/${run.answered}`, 'correct'], [`${acc}%`, 'accuracy'], [`${cogComp(cogTopicQs(run.topic))}%`, 'topic competency'], [`${cogOverall()}%`, 'overall']]);
  } else if (run.mode === 'misses' || run.mode === 'starred') {
    if (acc === 100 && run.answered >= 8) cogGrant('perfect');
    headline = run.mode === 'misses' ? 'Misses reviewed' : 'Starred reviewed'; sub = `${run.correct}/${run.answered} correct`;
    extra = grid([[`${run.correct}/${run.answered}`, 'correct'], [`${acc}%`, 'accuracy'], [`${cogMissPool().length}`, 'misses left'], [`${cogOverall()}%`, 'competency']]);
  } else {
    if (acc === 100 && run.answered >= 8) cogGrant('perfect');
    headline = 'Chapter complete'; sub = `Ch ${run.chapter} · ${cogMastery(run.chapter)}% mastered`;
    extra = grid([[`${run.correct}/${run.answered}`, 'correct'], [`${acc}%`, 'accuracy'], [`${run.maxCombo}×`, 'best streak'], [`${cogMastery(run.chapter)}%`, 'mastery']]);
  }
  cogCheckAch(); cogSave();
  cogTrack('run_end', { mode: run.mode, answered: run.answered, correct: run.correct, accuracy: acc, score: run.score, maxCombo: run.maxCombo, competency: cogOverall() });
  const status = cogStatus();

  const root = el('<div></div>');
  root.appendChild(topbar('cogpsych'));
  const main = el(`<main class="panel gen-result" id="main" tabindex="-1">
    <div class="gen-res-box cornerframe">
      <span class="label">${esc(headline)}</span>
      <h1 class="gen-res-sub">${esc(sub)}</h1>
      ${extra}
      ${status.cls === 'ready' ? '<p class="gen-res-ready">EXAM READY — 90%+ competency. Keep Smart Review warm.</p>' : ''}
      <p class="gen-res-xp mono">${COG.xp.toLocaleString()} XP total · LV ${cogRank(COG.xp).lvl} ${esc(cogRank(COG.xp).name)}</p>
      <div class="gen-res-btns">
        <button class="btn btn-solid" id="gen-again">${run.mode === 'blitz' ? 'Run it back' : run.mode === 'exam' ? 'Rematch' : run.mode === 'smart' ? 'Another set' : 'Again'}</button>
        <button class="btn" id="gen-homebtn">Home</button>
      </div>
    </div>
  </main>`);
  main.querySelector('#gen-homebtn').addEventListener('click', renderCogHome);
  main.querySelector('#gen-again').addEventListener('click', () => {
    if (run.mode === 'blitz') startCogBlitz();
    else if (run.mode === 'exam') startCogExam();
    else if (run.mode === 'smart') startCogSmart();
    else if (run.mode === 'misses') startCogMisses();
    else if (run.mode === 'starred') startCogStarred();
    else if (run.mode === 'topic') startCogTopic(run.topic);
    else startCogChapter(run.chapter);
  });
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}
