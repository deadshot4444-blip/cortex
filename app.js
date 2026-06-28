/* Rounds — clinical case trainer */

const SPECIALTIES = [
  { key: 'emergency-medicine', name: 'Emergency Medicine' },
  { key: 'internal-medicine', name: 'Internal Medicine' },
  { key: 'neurology', name: 'Neurology' },
  { key: 'cardiology', name: 'Cardiology' },
  { key: 'pulmonology', name: 'Pulmonology' },
  { key: 'gastroenterology', name: 'Gastroenterology' },
  { key: 'psychiatry', name: 'Psychiatry' },
  { key: 'obgyn', name: 'OB/GYN' },
  { key: 'pediatrics', name: 'Pediatrics' },
  { key: 'infectious-disease', name: 'Infectious Disease' },
  { key: 'family-medicine', name: 'Family Medicine' },
  { key: 'neurosurgery', name: 'Neurosurgery' },
  { key: 'nephrology', name: 'Nephrology' },
  { key: 'endocrinology', name: 'Endocrinology' },
  { key: 'hematology-oncology', name: 'Hematology & Oncology' },
  { key: 'rheumatology', name: 'Rheumatology' },
  { key: 'general-surgery', name: 'General Surgery' },
  { key: 'orthopedics', name: 'Orthopedics' },
  { key: 'urology', name: 'Urology' },
  { key: 'dermatology', name: 'Dermatology' },
  { key: 'ophthalmology', name: 'Ophthalmology' },
  { key: 'otolaryngology', name: 'Otolaryngology (ENT)' },
  { key: 'pmr', name: 'Physical Medicine & Rehab' },
  { key: 'vascular-neurology', name: 'Vascular Neurology' },
  { key: 'neuro-oncology', name: 'Neuro-Oncology' },
  { key: 'pediatric-neurology', name: 'Pediatric Neurology' },
];
const NAME_BY_KEY = Object.fromEntries(SPECIALTIES.map(s => [s.key, s.name]));

// Sections gated as "Coming soon" for the public launch. Remove a key here to make it live.
const COMING_SOON = new Set(['anatomy', 'socrates', 'neuro']);
function sectionMenuTag(key) {
  if (COMING_SOON.has(key)) return '<span class="mi-soon">Soon</span>';
  if (key === 'reference') return '<span class="mi-tag">New</span>';
  return '';
}
const SECTION_LABELS = { anatomy: 'Anatomy', reference: 'Medicine', socrates: 'Learn how to learn' };
const SECTION_INFO = {
  anatomy: {
    label: 'Anatomy',
    headline: 'Master the body, visually.',
    desc: 'Evidence-based, interactive anatomy. Click into every bone, muscle, and organ system and study it the way the science says you’ll actually retain it — active recall and spaced repetition over passive review.',
  },
  reference: {
    label: 'Medicine',
    headline: 'Master pharmacology.',
    desc: 'One 81-step study path — pharmacology, performance drugs, micro, labs, ECG — plus browse and drill in every area.',
  },
  socrates: {
    label: 'Learn to Learn',
    headline: 'Learn how to learn.',
    desc: 'Guided, Socratic study sessions that train the skill beneath every other skill — how to question, reason, and remember. Metacognition and proven learning technique, applied directly to medicine.',
  },
  neuro: {
    label: 'Neuroengineering',
    badge: 'Under construction',
    headline: 'Temporarily under construction.',
    desc: 'The Neuroengineering division is offline while we refine the curriculum, labs, and Practitioner track to the same standard as the rest of Cortex. It will return soon — thank you for your patience.',
  },
};
const APP_VERSION = '1.16.2';
const MEMBERSHIP_START = 'August 1, 2026';
function cortexFreeNote(sectionPill, sectionName) {
  return `<p class="free-note"><span class="free-pill">MCAT always free</span><span class="free-pill free-pill--soft">${sectionPill} &middot; free for now</span><span class="free-note-txt">${sectionName} becomes optional membership ${MEMBERSHIP_START}. The full MCAT suite stays free forever.</span></p>`;
}
const X_HANDLE = 'kevin__vigil';
const X_URL = 'https://x.com/kevin__vigil';
const X_UPDATES_COPY = `Constant Cortex updates on X &middot; <strong>@${X_HANDLE}</strong>`;
const X_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
// Logo mark — matches the favicon (dark square + white cross) so the brand reads as one system.
const MARK_SVG = '<svg class="wm-glyph" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" fill="currentColor"/><path d="M14 8h4v6h6v4h-6v6h-4v-6H8v-4h6z" fill="#fff"/></svg>';

const SECONDS_PER_QUESTION = 90;
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const DIFFS = ['easy', 'medium', 'hard'];

const XP_PER_CORRECT = 10;
const XP_PERFECT = 25;
const XP_CASE_BONUS = { easy: 10, medium: 20, hard: 30 };
const TIMED_MULTIPLIER = 1.5;
const MAX_RANK = 100;
function xpToRank(r) { return 30 * (r - 1) + (r - 1) * (r - 1); }

function rankFor(xp) {
  let r = 1;
  while (r < MAX_RANK && xp >= xpToRank(r + 1)) r++;
  const floor = xpToRank(r);
  const nextAt = r < MAX_RANK ? xpToRank(r + 1) : null;
  return { rank: r, floor, nextAt, pct: nextAt ? Math.round(100 * (xp - floor) / (nextAt - floor)) : 100 };
}

const $app = document.getElementById('app');

const store = {
  manifest: {},
  index: null,                 // [{id,key,name,title,difficulty,diagnosis}]
  cache: {},                   // specialty key -> case data
  mode: localStorage.getItem('cs-mode') || 'untimed',
  diff: localStorage.getItem('cs-diff') || 'all',
  progress: loadJSON('cs-progress', {}),   // key -> {seen,answered,correct,xp}
  cases: loadJSON('cs-cases', {}),         // caseId -> {key,attempts,lastC,lastT,bestC,bookmarked,lastTs}
  history: loadJSON('cs-history', []),     // [{id,key,c,t,timed,ts}] newest first
  streak: loadJSON('cs-streak', { current: 0, longest: 0, lastDate: null }),
};

let session = null;

/* ---------- persistence ---------- */

function loadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    if (v == null) return fallback;
    // shape guard: a corrupted/legacy value of the wrong type would crash callers
    if (Array.isArray(fallback) !== Array.isArray(v)) return fallback;
    if (fallback && typeof fallback === 'object' && (typeof v !== 'object')) return fallback;
    return v;
  } catch { return fallback; }
}
// guarded write — storage can throw (quota full, Safari Private, disabled by policy);
// a failure should degrade to "not saved", never freeze the flow mid-action.
function safeSet(key, value) { try { localStorage.setItem(key, value); } catch {} }
function saveProgress() { safeSet('cs-progress', JSON.stringify(store.progress)); }
function saveCases() { safeSet('cs-cases', JSON.stringify(store.cases)); }
function saveHistory() { safeSet('cs-history', JSON.stringify(store.history.slice(0, 400))); }
function saveStreak() { safeSet('cs-streak', JSON.stringify(store.streak)); }

const SECTION_SCRIPTS = {
  mcat: ['mcat.js?v=54'],
  anatomy: ['anatomy.js?v=36'],
  reference: ['reference.js?v=48', 'performance-drugs.js?v=7', 'ekg.js?v=36'],
  socrates: ['socrates.js?v=40'],
  neuro: ['python-runtime.js?v=3', 'code-evaluator.js?v=2', 'neuro-practitioner.js?v=3', 'neuro.js?v=13'],
  genetics: ['genetics.js?v=18', 'genetics-learn.js?v=3'],
};
const _scriptLoads = {};
function loadScript(src) {
  if (_scriptLoads[src]) return _scriptLoads[src];
  _scriptLoads[src] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => { delete _scriptLoads[src]; reject(new Error('load ' + src)); };
    document.head.appendChild(s);
  });
  return _scriptLoads[src];
}
async function ensureSection(key) {
  const files = SECTION_SCRIPTS[key];
  if (!files) return;
  for (const f of files) await loadScript(f);
}
// MCAT is lazy-loaded like every other section; load it on demand then render.
function gotoMCAT() {
  ensureSection('mcat').then(gotoMCAT);
}

function clearClinicalProgress() {
  store.progress = {}; store.cases = {}; store.history = [];
  store.streak = { current: 0, longest: 0, lastDate: null };
  saveProgress(); saveCases(); saveHistory(); saveStreak();
}
function clearMcatProgress() {
  if (typeof window.resetMcatState === 'function') window.resetMcatState();
  else {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('cs-mcat')) keys.push(k);
    }
    keys.forEach(k => { try { localStorage.removeItem(k); } catch {} });
  }
}
function clearPomoProgress() {
  if (typeof window.resetPomoState === 'function') window.resetPomoState();
  else safeSet('cs-pomo', JSON.stringify({ mode: 'focus', running: false, deadline: 0, remainMs: 1500000, focusMin: 25, breakMin: 5, rounds: 0, totalFocusMs: 0, totalBreakMs: 0, startedTs: 0 }));
}
function clearMedicineProgress() {
  ['cs-pharm', 'cs-ped', 'cs-micro', 'cs-labs', 'cs-ekg', 'cs-medicine'].forEach(k => {
    try { localStorage.removeItem(k); } catch {}
  });
  if (store.progress && store.progress.medicine) { delete store.progress.medicine; saveProgress(); } // Medicine MCQ XP/answered/correct lives here too
  if (typeof window._resetMedicineMemory === 'function') window._resetMedicineMemory();
  if (typeof window._resetPedMemory === 'function') window._resetPedMemory();
  if (typeof window._resetEkgMemory === 'function') window._resetEkgMemory();
}

function openResetProgress(onDone) {
  const m = el(`<div class="modal" id="rst"><div class="modal-box">
    <div class="modal-head"><span class="label">Reset progress</span></div>
    <p class="cfx-msg">Choose what to clear on this device. Signed-in accounts will sync the reset. This cannot be undone.</p>
    <div class="endbtns cfx-btns rst-btns">
      <button class="btn" id="rst-clinical">Clinical scenarios</button>
      <button class="btn" id="rst-medicine">Medicine</button>
      <button class="btn" id="rst-mcat">MCAT prep</button>
      <button class="btn btn-solid" id="rst-all">Everything</button>
      <button class="btn" id="rst-cancel">Cancel</button>
    </div>
  </div></div>`);
  const close = () => { m.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  m.addEventListener('click', e => { if (e.target.id === 'rst') close(); });
  m.querySelector('#rst-cancel').addEventListener('click', close);
  m.querySelector('#rst-clinical').addEventListener('click', () => { clearClinicalProgress(); close(); onDone(); });
  m.querySelector('#rst-medicine').addEventListener('click', () => { clearMedicineProgress(); close(); onDone(); });
  m.querySelector('#rst-mcat').addEventListener('click', () => { clearMcatProgress(); close(); onDone(); });
  m.querySelector('#rst-all').addEventListener('click', () => { clearClinicalProgress(); clearMedicineProgress(); clearMcatProgress(); clearPomoProgress(); close(); onDone(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(m);
  trapModal(m);
}

function prog(key) {
  if (!store.progress[key]) store.progress[key] = { seen: [], answered: 0, correct: 0, xp: 0 };
  const p = store.progress[key];
  if (typeof p.xp !== 'number') p.xp = (p.correct || 0) * XP_PER_CORRECT;
  return p;
}
function caseRec(id, key) {
  if (!store.cases[id]) store.cases[id] = { key, attempts: 0, lastC: null, lastT: null, bestC: 0, bookmarked: false, lastTs: null };
  return store.cases[id];
}
function isBookmarked(id) { return !!store.cases[id]?.bookmarked; }
function bookmarkHtml(on, label = 'Save') {
  const txt = on ? 'Saved' : label;
  const ico = on ? '&#9733;' : '&#9734;';
  return `<span class="bm-ico">${ico}</span><span class="bm-txt">${txt}</span>`;
}
function toggleBookmark(id, key) {
  const rec = caseRec(id, key);
  rec.bookmarked = !rec.bookmarked;
  saveCases();
  return rec.bookmarked;
}

/* ---------- dates / streak ---------- */

function dayStr(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function todayStr() { return dayStr(new Date()); }
function activeDays() { return new Set(store.history.map(h => dayStr(new Date(h.ts)))); }

function bumpStreak() {
  const today = todayStr();
  const s = store.streak;
  if (s.lastDate === today) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  s.current = s.lastDate === dayStr(y) ? s.current + 1 : 1;
  s.lastDate = today;
  if (s.current > s.longest) s.longest = s.current;
  saveStreak();
}

/* ---------- helpers ---------- */

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function relTime(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const d = Math.floor(diff / 86400);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
/* count-up number animation (reduced-motion aware) */
function animateCount(elm, target, opts = {}) {
  const prefix = opts.prefix || '', suffix = opts.suffix || '';
  const fmt = n => prefix + Math.round(n).toLocaleString() + suffix;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !(target > 0)) { elm.textContent = fmt(target); return; }
  const dur = opts.dur || 950, t0 = performance.now();
  (function step(now) {
    const t = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - t, 3);            // easeOutCubic
    elm.textContent = fmt(target * e);
    if (t < 1) requestAnimationFrame(step); else elm.textContent = fmt(target);
  })(performance.now());
}
// Any [data-countup] element ticks up when it scrolls into view. Armed synchronously so the final value never flashes first.
function setupCountUps(scope) {
  const els = [...(scope || document).querySelectorAll('[data-countup]')];
  if (!els.length) return;
  const parsed = els.map(elm => {
    const m = String(elm.getAttribute('data-countup')).match(/^([^\d]*)([\d,]+)(.*)$/);
    if (!m) return null;                          // no number → leave the text as-is
    const prefix = m[1], suffix = m[3], num = parseInt(m[2].replace(/,/g, ''), 10);
    elm.textContent = prefix + '0' + suffix;
    return { elm, prefix, suffix, num };
  }).filter(Boolean);
  if (!parsed.length) return;
  const run = p => { if (p.elm.dataset.counted) return; p.elm.dataset.counted = '1'; animateCount(p.elm, p.num, { prefix: p.prefix, suffix: p.suffix }); };
  if (!('IntersectionObserver' in window)) { parsed.forEach(run); return; }
  const map = new Map(parsed.map(p => [p.elm, p]));
  const io = new IntersectionObserver(ents => ents.forEach(en => { if (en.isIntersecting) { run(map.get(en.target)); io.unobserve(en.target); } }), { threshold: .3 });
  parsed.forEach(p => io.observe(p.elm));
}

// Fade/cascade elements up as they scroll into view ([data-reveal] = block, [data-reveal-stagger] = its children cascade).
function revealOnScroll(scope) {
  const els = [...(scope || document).querySelectorAll('[data-reveal],[data-reveal-stagger]')];
  if (!els.length) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver(ents => ents.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .12, rootMargin: '0px 0px -8% 0px' });
  els.forEach(e => io.observe(e));
}

function totals() {
  let answered = 0, correct = 0, xp = 0;
  for (const k in store.progress) {
    answered += store.progress[k].answered || 0;
    correct += store.progress[k].correct || 0;
    xp += store.progress[k].xp || 0;
  }
  let casesDone = 0;
  for (const id in store.cases) if (store.cases[id].attempts > 0) casesDone++;
  return { answered, correct, xp, casesDone, acc: answered ? Math.round(100 * correct / answered) : null };
}
function clinicalBankTotal() {
  return Object.values(store.manifest).reduce((a, b) => a + b, 0);
}
function clinicalStatBand() {
  const t = totals();
  const bank = clinicalBankTotal();
  const acc = t.acc != null ? `${t.acc}%` : '&mdash;';
  return [
    [String(bank || '&mdash;'), 'Cases in the bank'],
    [String(SPECIALTIES.length), 'Specialties'],
    [String(t.casesDone), 'Cases completed'],
    [acc, 'Answer accuracy'],
    [`${store.streak.current}&#128293;`, 'Day streak'],
    [t.xp ? t.xp.toLocaleString() : '0', 'Total XP earned'],
  ];
}

/* ---------- data ---------- */

async function boot() {
  fetchVisits();
  try {
    store.manifest = await fetch('data/manifest.json').then(r => r.ok ? r.json() : {});
  } catch { /* case data unavailable; the mission page still renders, sections handle it */ }
  renderMission();
  if (hasUnseenUpdate()) setTimeout(showUpdateModal, 420);
}

async function loadSpecialty(key) {
  if (store.cache[key]) return store.cache[key];
  const r = await fetch(`data/${key}.json`);
  if (!r.ok) throw new Error(`no data for ${key}`);
  const data = await r.json();
  store.cache[key] = data;
  return data;
}

// index.json (~600KB) is only needed inside Practice (mixed cases + review/search), not on the
// landing page. Load it lazily off the critical path and memoize.
async function ensureIndex() {
  if (store.index) return store.index;
  try { store.index = await fetch('data/index.json').then(r => r.ok ? r.json() : null); }
  catch { store.index = null; }
  return store.index;
}

/* ---------- shared chrome ---------- */

function topbar(active) {
  const t = totals();
  const streak = store.streak.current > 0 ? `${store.streak.current}&#128293; &middot; ` : '';
  const stat = t.answered ? `${streak}${t.xp.toLocaleString()} XP` : '';
  const root = el(`<header class="topbar mainbar">
    <a class="skip-link" href="#main">Skip to content</a>
    <a class="wordmark" href="#">${MARK_SVG}<span class="wm-name">Cortex <span class="wm-sub">Medical Academy</span></span></a>
    <nav class="nav">
      <button class="navlink ${active === 'practice' ? 'active' : ''}" data-go="practice">Practice</button>
      <button class="navlink ${active === 'mcat' ? 'active' : ''}" data-go="mcat">MCAT</button>
      <button class="navlink ${active === 'stats' ? 'active' : ''}" data-go="stats">Stats</button>
      <div class="navmenu">
        <button class="navlink menubtn ${['anatomy', 'reference', 'socrates', 'utsa', 'pomodoro', 'genetics'].includes(active) ? 'active' : ''}" data-menu aria-expanded="false">Explore<span class="caret">&#9662;</span></button>
        <div class="menupanel" hidden>
          <span class="menu-head">Tools</span>
          <button class="menuitem" data-go="pomodoro"><span>Focus Timer</span><span class="mi-tag">New</span></button>
          <span class="menu-head">Sections</span>
          <button class="menuitem" data-go="anatomy"><span>Anatomy</span>${sectionMenuTag('anatomy')}</button>
          <button class="menuitem" data-go="reference"><span>Medicine</span>${sectionMenuTag('reference')}</button>
          <button class="menuitem" data-go="socrates"><span>Learn to Learn</span>${sectionMenuTag('socrates')}</button>
          <span class="menu-head">Access</span>
          <button class="menuitem" data-go="utsa"><span>UTSA &amp; UT Health</span><span class="mi-tag">Free</span></button>
          <button class="menuitem" data-go="genetics"><span>Genetics-2313-01E</span><span class="mi-tag">UTSA</span></button>
        </div>
      </div>
    </nav>
    <div class="bar-right">
      <button class="navlink special ${active === 'neuro' ? 'active' : ''}" data-go="neuro" title="Neuroengineering"><svg class="neuro-ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2L17 6V14L10 18L3 14V6Z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg><span class="neuro-label">Neuro<span class="nl-rest">engineering</span></span></button>
      ${stat ? `<span class="topstat">${stat}</span>` : ''}<a class="xlink" href="${X_URL}" target="_blank" rel="noopener" title="Constant Cortex updates on X · @${X_HANDLE}" aria-label="Constant Cortex updates on X · @${X_HANDLE}">${X_SVG}</a><button class="acctbtn" data-acct hidden>Sign in</button><button class="ver${hasUnseenUpdate() ? ' ver-hasnew' : ''}" data-go="updates" title="What's new">v${APP_VERSION}</button>
    </div>
  </header>`);
  root.querySelector('.wordmark').addEventListener('click', e => { e.preventDefault(); renderMission(); });
  root.querySelector('[data-go="practice"]').addEventListener('click', renderHome);
  root.querySelector('[data-go="anatomy"]').addEventListener('click', async () => {
    if (COMING_SOON.has('anatomy')) { renderComingSoon('anatomy'); return; }
    await ensureSection('anatomy');
    renderAnatomy();
  });
  root.querySelector('[data-go="reference"]').addEventListener('click', async () => {
    if (COMING_SOON.has('reference')) { renderComingSoon('reference'); return; }
    try {
      await ensureSection('reference');
      if (typeof renderReference === 'function') await renderReference();
    } catch (err) { console.error('Medicine load failed', err); }
  });
  root.querySelector('[data-go="socrates"]').addEventListener('click', async () => {
    if (COMING_SOON.has('socrates')) { renderComingSoon('socrates'); return; }
    await ensureSection('socrates');
    renderSocrates();
  });
  root.querySelector('[data-go="mcat"]').addEventListener('click', gotoMCAT);
  root.querySelector('[data-go="stats"]').addEventListener('click', renderStats);
  root.querySelector('[data-go="utsa"]').addEventListener('click', renderUTSA);
  root.querySelector('[data-go="pomodoro"]').addEventListener('click', () => { if (typeof renderPomodoro === 'function') renderPomodoro(); });
  root.querySelector('[data-go="neuro"]').addEventListener('click', () => renderNeuro());
  root.querySelector('[data-go="genetics"]')?.addEventListener('click', async () => {
    await ensureSection('genetics');
    if (typeof renderGenetics === 'function') renderGenetics();
  });
  root.querySelector('[data-go="updates"]').addEventListener('click', renderUpdates);
  const navmenu = root.querySelector('.navmenu');
  if (navmenu) {
    const mbtn = navmenu.querySelector('[data-menu]');
    const panel = navmenu.querySelector('.menupanel');
    const close = () => { panel.hidden = true; mbtn.classList.remove('open'); mbtn.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onEsc); };
    const onDoc = (e) => { if (!navmenu.contains(e.target)) close(); };
    const onEsc = (e) => { if (e.key === 'Escape') close(); };
    mbtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (panel.hidden) { panel.hidden = false; mbtn.classList.add('open'); mbtn.setAttribute('aria-expanded', 'true'); setTimeout(() => { document.addEventListener('click', onDoc); document.addEventListener('keydown', onEsc); }, 0); }
      else close();
    });
    panel.querySelectorAll('.menuitem').forEach(mi => mi.addEventListener('click', close));
  }
  if (window.refreshAuthUI) window.refreshAuthUI();
  return root;
}

function seenVersion() { try { return localStorage.getItem('cs-seen-ver') || ''; } catch { return ''; } }
function markSeenVersion() { safeSet('cs-seen-ver', APP_VERSION); updateVerBadges(); }
function hasUnseenUpdate() { return seenVersion() !== APP_VERSION; }
function latestRelease() {
  return CHANGELOG.find(c => c.version === APP_VERSION)
    || CHANGELOG.find(c => c.version && c.tag !== 'SOON')
    || null;
}
function updateVerBadges() {
  document.querySelectorAll('button.ver').forEach(btn => {
    btn.classList.toggle('ver-hasnew', hasUnseenUpdate());
    btn.title = "What's new";
  });
}
function showUpdateModal() {
  if (!hasUnseenUpdate() || document.querySelector('.upd-modal-back')) return;
  const rel = latestRelease();
  if (!rel) return;
  const back = el(`<div class="fbmodal-back upd-modal-back">
    <div class="fbmodal upd-modal" role="dialog" aria-modal="true" aria-labelledby="upd-modal-title">
      <button type="button" class="upd-modal-x" aria-label="Close">&times;</button>
      <h3 id="upd-modal-title" class="label">What&rsquo;s new</h3>
      <p class="upd-modal-date">${esc(rel.date)}</p>
      <ul class="upd-modal-list">${rel.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      <a class="upd-xlink" href="${X_URL}" target="_blank" rel="noopener">${X_SVG}<span class="upd-xlink-txt">${X_UPDATES_COPY}</span></a>
      <div class="fbmodal-btns upd-modal-btns">
        <button type="button" class="btn" id="upd-log">Full changelog</button>
        <button type="button" class="btn btn-solid" id="upd-got">Got it</button>
      </div>
    </div>
  </div>`);
  const dismiss = (seen) => {
    back.remove();
    document.removeEventListener('keydown', onKey);
    if (seen) markSeenVersion();
  };
  const onKey = e => { if (e.key === 'Escape') dismiss(true); };
  back.querySelector('.upd-modal-x').addEventListener('click', () => dismiss(true));
  back.querySelector('#upd-got').addEventListener('click', () => dismiss(true));
  back.addEventListener('click', e => { if (e.target === back) dismiss(true); });
  back.querySelector('.upd-modal').addEventListener('click', e => e.stopPropagation());
  back.querySelector('#upd-log').addEventListener('click', () => { dismiss(true); renderUpdates(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
  trapModal(back);
}

function setView(node) {
  $app.replaceChildren(node);
  window.scrollTo(0, 0);
  const mainEl = node.querySelector('main');
  if (mainEl && !mainEl.id) mainEl.id = 'main';
  const ft = node.querySelector('h1') || mainEl || node;
  if (ft && ft.focus) { ft.setAttribute('tabindex', '-1'); ft.focus({ preventScroll: true }); }
  announceView(node);
  setupCountUps(node); revealOnScroll(node);
  if (window.refreshAuthUI) window.refreshAuthUI(); if (window.pomoSync) window.pomoSync(); updateVerBadges();
}
function announceView(node) {
  let live = document.getElementById('cs-live');
  if (!live) {
    live = document.createElement('div');
    live.id = 'cs-live';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;';
    document.body.appendChild(live);
  }
  const h = node.querySelector('h1');
  live.textContent = h ? h.textContent.trim() : '';
}

// Focus-trap a modal: cycle Tab within it, move focus in on open, restore to the opener on close.
function trapModal(back) {
  const prev = document.activeElement;
  const SEL = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
  const focusable = () => [...back.querySelectorAll(SEL)].filter(e => e.offsetParent !== null);
  back.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const f = focusable(); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  setTimeout(() => { if (!back.contains(document.activeElement)) { const f = focusable(); if (f.length) f[0].focus(); } }, 0);
  const obs = new MutationObserver(() => {
    if (!document.body.contains(back)) { obs.disconnect(); try { prev && prev.focus && prev.focus(); } catch (e) {} }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}
window.trapModal = trapModal;

function renderComingSoon(key) {
  stopTimer(); session = null;
  const info = SECTION_INFO[key] || { label: SECTION_LABELS[key] || key, headline: 'Coming soon.', desc: 'This part of Cortex is in the works.' };
  const root = el('<div></div>');
  root.appendChild(topbar(key));
  const main = el(`<main class="panel comingsoon">
    <div class="cs-box">
      <span class="label">${esc(info.label)} &middot; ${esc(info.badge || 'Coming soon')}</span>
      <h1>${esc(info.headline)}</h1>
      <p class="sub">${esc(info.desc)}</p>
      <div class="endbtns">
        <button class="btn btn-solid" id="cs-mcat">Start with MCAT prep</button>
        <button class="btn" id="cs-prac">Clinical scenarios</button>
      </div>
    </div>
  </main>`);
  main.querySelector('#cs-prac').addEventListener('click', renderHome);
  main.querySelector('#cs-mcat').addEventListener('click', gotoMCAT);
  root.appendChild(main);
  root.appendChild(siteFooter());
  setView(root);
}

/* ---------- UTSA & UT Health San Antonio access ---------- */
function renderUTSA() {
  stopTimer(); session = null;
  const cards = [
    ['Everything, unlocked', 'Whatever Cortex ever offers as part of a membership, students and trainees at UTSA and UT Health San Antonio receive in full — at no cost, for as long as they are there. The MCAT suite is free for everyone, always; this extends that promise to every section.'],
    ['How it will work', 'Verify a school email (@my.utsa.edu or @livemail.uthscsa.edu) once. Your account unlocks every part of the Academy automatically — no codes, no renewals, no catch.'],
    ['Why these two', 'These are home: the university that trains me and the medical school I am working toward. A mission to widen access to medicine should start where the founder is from.'],
  ];
  const root = el('<div></div>');
  root.appendChild(topbar('utsa'));
  const main = el(`<main class="panel utsa">
    <div class="updates-head">
      <span class="label">Access &middot; In development</span>
      <h1>Free, forever, for home.</h1>
      <p class="sub">Cortex Medical Academy is being built so that students at <b>The University of Texas at San Antonio</b> and <b>UT Health San Antonio</b> have full, permanent access to everything — no matter what the rest of the world is ever asked to pay.</p>
    </div>
    <div class="utsa-photos" data-reveal-stagger>
      <figure class="utsa-photo"><img src="assets/utsa.jpg?v=2" alt="The University of Texas at San Antonio campus" loading="lazy"><figcaption>The University of Texas at San Antonio</figcaption></figure>
      <figure class="utsa-photo"><img src="assets/uthealth.jpg?v=2" alt="UT Health San Antonio — Joe R. and Teresa Lozano Long Campus" loading="lazy"><figcaption>UT Health San Antonio</figcaption></figure>
    </div>
    <div class="utsa-grid" data-reveal-stagger>
      ${cards.map(c => `<div class="utsa-card"><span class="uc-name">${esc(c[0])}</span><p>${c[1]}</p></div>`).join('')}
    </div>
    <section class="mcat-closing" data-reveal>
      <h2>Opportunity should start at home.</h2>
      <p>This is a commitment in progress. Until verification is live, the entire MCAT suite is already free for every UTSA and UT Health student — same as it is for everyone.</p>
      <button class="btn btn-solid" id="utsa-mcat">Open MCAT prep</button>
    </section>
    <p class="utsa-note">Cortex Medical Academy is an independent project and is not affiliated with, endorsed by, or sponsored by The University of Texas at San Antonio or UT Health San Antonio. All trademarks and campus imagery are the property of their respective owners.</p>
  </main>`);
  main.querySelector('#utsa-mcat').addEventListener('click', gotoMCAT);
  root.appendChild(main);
  root.appendChild(siteFooter());
  setView(root);
}

/* ---------- Neuroengineering (special division) ---------- */
async function renderNeuro() {
  if (COMING_SOON.has('neuro')) { renderComingSoon('neuro'); return; }
  stopTimer(); session = null;
  await ensureSection('neuro');
  if (typeof renderNeuroEngineering === 'function') renderNeuroEngineering();
}

/* ---------- site footer (brand) ---------- */
function siteFooter() {
  const yr = new Date().getFullYear();
  const f = el(`<footer class="sitefoot">
    <div class="sf-top">
      <a class="sf-brand" href="#">${MARK_SVG}<span>Cortex <span class="wm-sub">Medical Academy</span></span></a>
      <nav class="sf-links">
        <a class="sf-link" href="https://x.com/kevin__vigil" target="_blank" rel="noopener">X &middot; @kevin__vigil</a>
        <button class="sf-link sf-utsa">UTSA Access</button>
        <button class="sf-link" data-go="updates">What&rsquo;s new</button>
        <button class="sf-link sf-suggest">Suggest a feature</button>
        <a class="sf-link" href="mailto:cortexmedical.academy.support@gmail.com">Contact</a>
      </nav>
    </div>
    <p class="sf-tag">Free, evidence-based medical study for everyone &mdash; our MCAT preparation is, and always will be, free.</p>
    <p class="sf-founder">Founded by Kevin Vigil</p>
    <p class="sf-legal">&copy; ${yr} Cortex Medical Academy &middot; v${APP_VERSION} &middot; Last updated ${CHANGELOG[0].date} &middot; Original study content, independently reviewed. Not a substitute for official AAMC materials or clinical judgment.</p>
  </footer>`);
  f.querySelector('.sf-brand').addEventListener('click', e => { e.preventDefault(); renderMission(); });
  f.querySelector('[data-go="updates"]').addEventListener('click', renderUpdates);
  f.querySelector('.sf-suggest').addEventListener('click', openFeedback);
  f.querySelector('.sf-utsa').addEventListener('click', renderUTSA);
  return f;
}

/* ---------- suggestion box (emails via Netlify Forms) ---------- */
function openFeedback() {
  const back = el(`<div class="fbmodal-back">
    <div class="fbmodal" role="dialog" aria-modal="true">
      <span class="label">Suggestion box</span>
      <h3>What would make Cortex better?</h3>
      <p class="fbmodal-sub">Ideas, bugs, requests &mdash; anything. It goes straight to the team.</p>
      <textarea id="fb-msg" rows="4" placeholder="Type your suggestion&hellip;"></textarea>
      <input id="fb-email" type="email" placeholder="Your email (optional &mdash; only if you want a reply)">
      <div class="fbmodal-btns">
        <button class="btn" id="fb-cancel">Cancel</button>
        <button class="btn btn-solid" id="fb-send">Send</button>
      </div>
      <div class="fbmodal-status" id="fb-status"></div>
      <p class="fbmodal-mail">Or email us: <a href="mailto:cortexmedical.academy.support@gmail.com">cortexmedical.academy.support@gmail.com</a></p>
    </div>
  </div>`);
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  back.addEventListener('click', e => { if (e.target === back) close(); });
  back.querySelector('#fb-cancel').addEventListener('click', close);
  back.querySelector('#fb-send').addEventListener('click', async () => {
    const msg = back.querySelector('#fb-msg').value.trim();
    const email = back.querySelector('#fb-email').value.trim();
    const status = back.querySelector('#fb-status');
    const sendBtn = back.querySelector('#fb-send');
    if (msg.length < 3) { status.textContent = 'Add a little more detail first.'; status.className = 'fbmodal-status err'; return; }
    sendBtn.disabled = true; status.textContent = 'Sending…'; status.className = 'fbmodal-status';
    try {
      const body = new URLSearchParams({ 'form-name': 'suggestions', message: msg, email, 'bot-field': '' }).toString();
      const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      if (!r.ok) throw new Error('status ' + r.status);
      status.textContent = 'Thanks — got it! 🙏'; status.className = 'fbmodal-status ok';
      setTimeout(close, 1500);
    } catch {
      status.textContent = 'Couldn’t send right now — try again in a moment.'; status.className = 'fbmodal-status err'; sendBtn.disabled = false;
    }
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
  trapModal(back);
  setTimeout(() => back.querySelector('#fb-msg').focus(), 30);
}

/* ---------- mission / front page ---------- */

let visitCount = null;
// Counts each browser once (not every refresh): increment on first-ever visit, read-only after.
async function fetchVisits() {
  try {
    const counted = localStorage.getItem('cs-counted');
    const action = counted ? 'get' : 'hit';
    const r = await fetch(`/cx-visits/${action}/cortexmedacademy/people`, { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json();
      if (typeof j.value === 'number') {
        visitCount = j.value;
        if (!counted) { try { localStorage.setItem('cs-counted', '1'); } catch {} }
        updateVisitUI();
      }
    }
  } catch { /* counter is best-effort; page works without it */ }
}
function updateVisitUI() {
  if (visitCount == null) return;
  document.querySelectorAll('.js-visits').forEach(e => {
    if (e.dataset.cnt === String(visitCount)) return;   // don't re-animate the same value
    e.dataset.cnt = String(visitCount);
    animateCount(e, visitCount);
  });
  const goal = 100000, pct = Math.max(1.5, Math.min(100, visitCount / goal * 100));
  document.querySelectorAll('.js-progressbar').forEach(e => e.style.width = pct.toFixed(2) + '%');
  document.querySelectorAll('.js-progresslab').forEach(e => e.textContent = `${visitCount.toLocaleString()} reached · goal: 100,000 future doctors`);
}

const FACTS = [
  'Quizzing yourself beats re-reading — and the gap only widens the longer you wait.',
  'Spacing your reviews can roughly double what you remember long-term, versus cramming.',
  'Explaining an idea in your own words predicts mastery better than reading it again.',
  'Mixing topics instead of studying them in blocks trains you to tell similar concepts apart.',
  'Recalling an answer strengthens the memory more than simply seeing it again.',
  'Small daily reps compound; marathon cram sessions fade fast.',
];
function startFactRotator(node) {
  let i = Math.floor(Math.random() * FACTS.length);
  node.textContent = FACTS[i];
  const tick = () => {
    if (!node.isConnected) return;            // self-cleans when the page changes
    i = (i + 1) % FACTS.length;
    node.style.opacity = '0';
    setTimeout(() => { node.textContent = FACTS[i]; node.style.opacity = '1'; }, 300);
    setTimeout(tick, 7000);
  };
  setTimeout(tick, 7000);
}

const PRINCIPLES = [
  ['First principles, not memorized dogma', 'We break medicine down to its mechanisms and rebuild it from the ground up — no curated highlight reels, no "just memorize this." Only what is actually true, and what actually works.'],
  ['Truth over comfort', 'The system shows you exactly where you stand — what you have mastered and what you have only touched. Honest feedback stings, and it is the only kind that makes you better.'],
  ['Abundance, by design', 'What decides who becomes a great physician should be effort, not money. Our MCAT preparation is free forever; anything we ever charge for exists only to sustain that promise and fund the mission.'],
  ['Long-term human flourishing', 'Better-trained doctors mean longer, healthier, stronger lives. Every concept you master strengthens the pipeline of people who will one day heal the rest of us.'],
  ['High agency compounds', 'Daily action beats heroic cramming. The people who treat this like a mission outrun everyone else — we just hand them the instrument.'],
];

/* ---------- what's new / changelog (newest first) ---------- */
const CHANGELOG = [
  {
    date: 'June 26, 2026', version: '1.16.2', tag: 'FIX',
    title: 'Genetics Learn - clearer answer feedback',
    items: [
      'Genetics Learn lessons now show a clear "Correct" / "Not quite" verdict the moment you answer a "Think it through" question, matching the quick-check steps.',
    ],
  },
  {
    date: 'June 26, 2026', version: '1.16.1', tag: 'NEW',
    title: 'Genetics - 190+ new Chapter 7-9 questions',
    items: [
      'Genetics study mode (UTSA): added 192 new exam-style multiple-choice questions spanning all of Module 3 - Chapter 7 (bacteria & culturing, conjugation/transformation/transduction, phages, retroviruses & flu, CRISPR-Cas defense), Chapter 8 (discovering the gene, DNA/RNA structure, supercoiling & chromatin, centromeres & telomeres), and Chapter 9 (semiconservative replication, replication enzymes, eukaryotic replication & recombination).',
      'The genetics bank now holds 350+ questions, each carrying a quick study mnemonic in its hint. Every new question was independently fact-checked for a single correct answer and accurate explanation.',
    ],
  },
  {
    date: 'June 24, 2026', version: '1.15.0', tag: 'NEW',
    title: 'Genetics - Module 3 (Ch 7-9) + new Learn mode',
    items: [
      'Genetics study mode (UTSA) now covers Module 3 - Chapter 7 (bacterial & viral genetics), Chapter 8 (DNA structure & chromatin), and Chapter 9 (replication & recombination) - with ~166 questions across 20 topics, plus auto-generated mapping problems.',
      'NEW Learn section: short, guided, Socratic lessons that teach each concept (a question, your reasoning, then the idea) with interactive diagrams you build and step through - base-pairing, the replication fork, the Meselson-Stahl experiment, CRISPR-Cas, and more. Tracks which lessons you have finished.',
    ],
  },
  {
    date: 'June 23, 2026', version: '1.14.4', tag: 'NEW',
    title: 'Class study tools - review, stats & polish',
    items: [
      'Genetics study mode (UTSA): added a Review Misses mode, question bookmarks (★), a per-topic stats view, and more interactive diagram questions.',
    ],
  },
  {
    date: 'June 23, 2026', version: '1.14.3', tag: 'NEW',
    title: 'Class study tools - bigger question bank',
    items: [
      'Genetics study mode (UTSA): added ~60 more questions on deeper Chapter 5-6 topics (coupling/repulsion, interference, chi-square, inversion & translocation products, Down syndrome types, polyploidy) plus auto-generated practice problems.',
    ],
  },
  {
    date: 'June 22, 2026', version: '1.14.2', tag: 'NEW',
    title: 'Class study tools - visuals & mobile',
    items: [
      'Genetics study mode (UTSA): added interactive diagram questions, an endless adaptive Smart Review that drills your weak spots until mastered, and a full mobile pass.',
    ],
  },
  {
    date: 'June 22, 2026', version: '1.14.1', tag: 'NEW',
    title: 'Class study tools',
    items: [
      'Added a focused, class-specific study mode (UTSA Genetics, Module 2) - passphrase-gated, with arcade-style practice and competency tracking.',
    ],
  },
  {
    date: 'June 22, 2026', version: '1.14.0', tag: 'NEW',
    title: 'Medicine - open access & guided practice',
    items: [
      'Every Medicine area - pharmacology, microbiology, lab values, and ECG - is unlocked to browse, drill, or learn anytime.',
      'Guided study is now multiple-choice with instant feedback and XP, replacing the old flashcards.',
      'Fixed guided lessons that could stall instead of advancing to the next step.',
      'Accuracy pass across hundreds of clinical and MCAT explanations, now written to read cleanly after answer choices shuffle.',
    ],
  },
  {
    date: 'June 20, 2026', version: '1.13.3', tag: 'FIX',
    title: 'Clinical fixes, accessibility & speed',
    items: [
      'Fixed answer highlighting after the shuffle update - the correct choice now lights up green every time, and explanations point to the right option.',
      'Restored full answer wording that was clipped in the previous update.',
      'Faster first load and snappier repeat visits.',
      'Full keyboard navigation, screen-reader announcements, and higher-contrast text.',
      'Accuracy tune-ups across pharmacology, microbiology, and lab references.',
    ],
  },
  {
    date: 'June 20, 2026', version: '1.13.2', tag: 'FIX',
    title: 'Clinical scenarios \u2014 fairer MCQs',
    items: [
      'Answer choices shuffle every time a question loads \u2014 no more \u201calways pick B\u201d position bias.',
      'Rebalanced 11k+ stored options so correct answers aren\u2019t the obvious longest choice.',
      'Future case generation enforces parallel option length and varied correct positions.',
    ],
  },
  {
    date: 'June 20, 2026', version: '1.13.1', tag: 'NEW',
    title: 'Medicine \u2014 unified study path',
    items: [
      'One 81-step path with a single progress bar: pharm classes \u2192 PED course \u2192 micro \u2192 labs \u2192 ECG rhythms.',
      'Continue always opens the next incomplete step; phase strip shows progress per area.',
      'Guided learn respects path order; browse and drill stay open anytime.',
      'Existing progress backfills automatically \u2014 no reset needed.',
    ],
  },
  {
    date: 'June 20, 2026', version: '1.13.0', tag: 'FIX',
    title: 'Medicine tab \u2014 script load fix',
    items: [
      'Fixed Medicine tab not opening: duplicate PHARM_UNIQUE_TOTAL declaration blocked reference.js from loading.',
    ],
  },
  {
    date: 'June 19, 2026', version: '1.13.0', tag: 'FIX',
    title: 'Medicine tab \u2014 load fix',
    items: [
      'Fixed Medicine hub crash when local progress data was corrupted (safe migration on cs-pharm / cs-micro / cs-labs / cs-ekg).',
      'Medicine section load is wrapped in error handling with retry; script cache bust for reference + EKG.',
    ],
  },
  {
    date: 'June 19, 2026', version: '1.13.0', tag: 'NEW',
    title: 'Medicine tab \u2014 unified progress & guided study',
    items: [
      'Medicine hub: overall progress bar, Continue CTA, recommended path, live stats on every card.',
      'Pharmacology: learn resume + step dots, per-class studied counts, unique-name tracking (355).',
      'Microbiology & lab values: guided panel/group learn, persistent drill stats, Stats page blocks.',
      'ECG: reviewed checkmarks, category drill filters, persistent scores, A\u2013E keyboard in all Medicine drills.',
      'Reset progress: new Medicine option clears pharm, PED, micro, labs & ECG.',
    ],
  },
  {
    date: 'June 19, 2026', version: '1.12.0', tag: 'NEW',
    title: 'Performance drugs \u2014 course polish',
    items: [
      'Hub split into 3 parts (hormones → pathways → clinical) with current-module highlight and per-row progress.',
      'Hormone learn: 4-step dots per agent; pathway lessons show orient/build/checkpoint progress bar.',
      'Catalog & clinical modules are guided section-by-section — no more wall-of-cards + mark complete.',
      'Medicine card shows live module progress on the PED tile.',
    ],
  },
  {
    date: 'June 19, 2026', version: '1.11.0', tag: 'NEW',
    title: 'Performance drugs \u2014 structured study path',
    items: [
      'PED rebuilt as 11-module guided course with progress bar and locked sequential unlock.',
      'Hormone modules: study agents in order (where \u2192 pathway \u2192 PED note \u2192 pearl) with per-class tracking.',
      'Pathway modules: orientation \u2192 build flowchart step-by-step \u2192 ordered checkpoint (70% to pass).',
      'Quick reference fold for browse-only hormone map, catalog, and clinical.',
    ],
  },
  {
    date: 'June 19, 2026', version: '1.10.0', tag: 'NEW',
    title: 'Neuroengineering \u2014 Practitioner Track',
    items: [
      'Practitioner Milestone 1: Neural Signal Viewer \u2014 graded OJT lab with waveform preview, Python grading, and project summary export.',
      'Real unlock at BCI Unit 7; Practitioner tile in Labs; celebration banner on unit completion.',
      'BCI path gaps filled: NeuroCode/Sim wired for units 4\u20136 and 11\u201312; new data-minimization ticket.',
      'Neuro stats on Stats page; leaner NeuroCode sandbox; depth rows without orphan arrows.',
    ],
  },
  {
    date: 'June 18, 2026', version: '1.9.4', tag: 'FIX',
    title: 'Neuroengineering \u2014 hub polish',
    items: [
      'Minimal neuro hub: leaner hero, slim BCI progress, collapsed Practitioner Track, clean subject cards.',
      'Brighter text on dark neuro pages; sharper social preview card (og-v4).',
      'MCAT free + Neuro free-for-now pills; video hero restored.',
    ],
  },
  {
    date: 'June 18, 2026', version: '1.9.3', tag: 'NEW',
    title: 'Membership date clarity',
    items: [
      'Clinical Scenarios and Neuroengineering now show the same free-for-now note \u2014 optional membership starts August 1, 2026.',
      'MCAT prep stays free forever.',
    ],
  },
  {
    date: 'June 18, 2026', version: '1.9.2', tag: 'FIX',
    title: 'Neuroengineering \u2014 mobile polish',
    items: [
      'Full mobile pass on the neuro hub, BCI path, quizzes, NeuroSim, and NeuroCode OJT sandbox.',
      'Safe-area padding, 44px touch targets, stacked CTAs, readable code editor + terminal on small screens.',
    ],
  },
  {
    date: 'June 18, 2026', version: '1.9.1', tag: 'NEW',
    title: 'Neuroengineering \u2014 Foundations live',
    items: [
      'Cortex Neuroengineering: 12 subjects, 24 topics, 120 quiz questions, 12 NeuroSim labs, 12 NeuroCode tickets.',
      'BCI Builder Path \u2014 20 guided units with active recall, gated mini-quizzes, sims & real Python OJT.',
      'NeuroCode Lab + NeuroSim browse hubs; real Python 3 runs in-browser (Run / Check).',
      'Socratic study mode, progress sync, social share card. Practitioner Track (expert milestones) next.',
    ],
  },
  {
    date: 'June 18, 2026', version: '1.9.0', tag: 'NEW',
    title: 'Neuroengineering \u2014 Foundations live',
    items: [
      'Neuroengineering course launched on Cortex Medical Academy.',
    ],
  },
  {
    date: 'June 18, 2026', version: '1.8.4', tag: 'FIX',
    title: 'Verification deploy',
    items: [
      'Re-opens the what\u2019s new popup so you can verify the mobile X updates link \u2014 no other changes from v1.8.3.',
    ],
  },
  {
    date: 'June 18, 2026', version: '1.8.3', tag: 'NEW',
    title: 'Clinical Scenarios \u2014 full polish pass',
    items: [
      'Practice landing rebuilt to match the MCAT console aesthetic \u2014 telemetry stat band, engineering hero, corner-frame panels.',
      'Specialty cards upgraded with rank telemetry, progress bars, and hover affordances.',
      'Active case view gets a live progress runbar, framed vitals panel, and tighter stage flow.',
      'Review hub matches the new visual system \u2014 bordered row list, stat band, unified typography.',
      'Constant Cortex updates on X \u2014 popup link copy + mobile wrap fix.',
    ],
  },
  {
    date: 'June 17, 2026', version: '1.8.2', tag: 'NEW',
    title: 'What\u2019s new popup',
    items: [
      'New releases now greet you with a one-time what\u2019s new window \u2014 dismiss it and it stays gone until the next version ships.',
      'The full changelog is still one tap away on the version number anytime.',
      'Follow @kevin__vigil on X for ship notes straight from the popup.',
    ],
  },
  {
    date: 'June 17, 2026', version: '1.8.1', tag: 'NEW',
    title: 'Smarter onboarding & clearer progress',
    items: [
      'MCAT "Enter the system" now resumes where you left off, sends new users to the Guide Engine, then drills.',
      'Hub resume chip on the MCAT landing — one tap back into any in-progress module.',
      'Stats covers MCAT prep, Focus Timer, and clinical scenarios in one place.',
      'Reset progress lets you clear clinical, MCAT, or everything — separately.',
      'XP & streak visible on mobile again; gated sections load on demand for a faster first paint.',
      'Mission page "Enter the Academy" routes to MCAT; clinical free-note clarifies MCAT stays free forever.',
    ],
  },
  {
    date: 'June 17, 2026', version: '1.8.0', tag: 'NEW',
    title: 'Focus Timer (Pomodoro)',
    items: [
      'New Pomodoro focus timer under Explore — preset focus/break lengths (25/35/50 and 5/10/15) plus fully custom times.',
      'It keeps running while you study elsewhere on the site, with a floating timer and a live countdown in your browser tab.',
      'Tracks rounds completed and your total focused time across the whole session.',
    ],
  },
  {
    date: 'June 17, 2026', version: '1.7.1', tag: 'FIX',
    title: 'Reliability & polish pass',
    items: [
      'Hardened progress saving so a full or private-mode browser can never freeze a question mid-answer.',
      'Cross-device sync now protects unsynced progress instead of overwriting it, and a reset syncs everywhere.',
      'MCAT fixes: keyboard answers in drills, smarter Mistake Lab targets, cleaner study plans, no dead ends.',
      'Sharper nav contrast, accurate labels, and dozens of small robustness fixes across the app.',
    ],
  },
  {
    date: 'June 16, 2026', version: '1.6.4', tag: 'NEW',
    title: 'Clinical Scenarios — free while we build',
    items: [
      'Clinical Scenarios will become an optional membership one day — for now, every case is completely free.',
      'MCAT prep stays free forever, no matter what.',
    ],
  },
  {
    date: 'June 16, 2026', version: '1.6.3', tag: 'FIX',
    title: 'No more privacy warning',
    items: [
      'The page no longer makes any third-party request on load, so mobile browsers stop showing the "reduce privacy protections" banner.',
      'The live visitor count now routes through our own domain — same number, fully private.',
    ],
  },
  {
    date: 'June 16, 2026', version: '1.6.2', tag: 'FIX',
    title: 'Mobile polish',
    items: [
      'Fixed the Explore menu running off-screen on phones.',
      'Clearer "Neuro" label on mobile instead of a bare icon.',
      'Self-hosted the sign-in library so the site now loads fully offline.',
    ],
  },
  {
    date: 'June 16, 2026', version: '1.6.1', tag: 'NEW',
    title: 'MCAT — easier to navigate',
    items: [
      'Every MCAT task now shows a breadcrumb of where you are, with one-tap back to the hub — and asks before you quit.',
      'Resume right where you left off: leaving a drill, passage set, or exam no longer loses your place.',
      'Clearer module pages — back buttons everywhere, color legends, honest empty states, and keyboard hints.',
    ],
  },
  {
    date: 'June 15, 2026', version: '1.6', tag: 'NEW',
    title: 'New sections & cleaner navigation',
    items: [
      'A reorganized top navigation that scales as the Academy grows.',
      'UTSA & UT Health San Antonio — our plan to give students from both full access, free, forever.',
      'Neuroengineering — a new division where neuroscience meets engineering.',
      'Clearer previews of what’s next: Anatomy, Medicine (master pharmacology), and Learn to Learn.',
    ],
  },
  {
    date: 'June 15, 2026', version: '1.5', tag: 'NEW',
    title: 'Optional accounts & sync',
    items: [
      'Save your progress to your email and sync it across all your devices — completely optional.',
      'No passwords: sign in with a one-tap link sent to your email.',
      'Signed out? Nothing changes — your progress still saves on your device, as always.',
    ],
  },
  {
    date: 'June 15, 2026', version: '1.4', tag: 'NEW',
    title: 'A note from the founder',
    items: [
      'Cortex is now openly founder-led — a short note on the mission behind the Academy, and a founder credit throughout.',
    ],
  },
  {
    date: 'June 15, 2026', version: '1.3', tag: 'NEW',
    title: 'Brand & identity',
    items: [
      'A refined logo mark in the header and a proper site footer across the Academy.',
      'A sticky, frosted navigation bar and a whisper-faint engineering grid behind the mission.',
      'A branded preview card when you share the link anywhere — plus considered, consistent detailing throughout.',
    ],
  },
  {
    date: 'June 15, 2026', version: '1.2', tag: 'NEW',
    title: 'Interface polish',
    items: [
      'Stats and counters now count up as the page loads, with crisp non-jittering numbers.',
      'Sections and cards glide in as you scroll, with gentle hover feedback throughout.',
      'A live activity indicator, blueprint detailing, and a refined reading experience — all kept deliberately minimal.',
    ],
  },
  {
    date: 'June 15, 2026', version: '1.1', tag: 'NEW',
    title: 'A "What’s New" page',
    items: [
      'Added this updates feed so you can see exactly what’s changing — Cortex is actively built and maintained.',
      'Click the version number in the top-right corner anytime to come back here.',
    ],
  },
  {
    date: 'June 15, 2026', version: '1.0', tag: 'NEW',
    title: 'The Academy, officially v1.0',
    items: [
      'A new mission home page that lays out what Cortex is and why it stays free.',
      'A live visitor counter and mission-progress tracker.',
      'A fully mobile-friendly layout, top to bottom.',
    ],
  },
  {
    date: 'June 14, 2026', version: '0.9', tag: 'NEW',
    title: 'MCAT prep suite — free forever',
    items: [
      '504 high-yield flashcards with built-in spaced repetition.',
      '263 practice questions with full explanations and answer-by-answer breakdowns.',
      'CARS Studio, a full-length Exam Simulator, AAMC-style science passages, and a study planner.',
    ],
  },
  {
    date: 'June 14, 2026', version: '0.9', tag: 'NEW',
    title: '2,599 clinical cases across 26 specialties',
    items: [
      'Interactive, step-by-step case scenarios from emergency medicine to neurosurgery.',
      'Bookmarks, missed-question review, full-text search, a stats dashboard, and a daily streak.',
    ],
  },
  {
    date: 'June 14, 2026', version: '0.9', tag: 'NEW',
    title: 'Live at cortexmedical.academy',
    items: [
      'The site went public — no account needed, and it works offline.',
      'Added a suggestion box so you can help shape what gets built next.',
    ],
  },
  {
    date: 'Coming soon', version: '', tag: 'SOON',
    title: 'In the works',
    items: [
      'Anatomy — interactive, clickable diagrams.',
      'Medicine — pharmacology, microbiology, lab values, and EKG reference.',
      'Learn to Learn — guided, Socratic study sessions.',
    ],
  },
];

function changelogEntry(c, featured) {
  return `<article class="upd ${featured ? 'upd-featured-item' : ''} ${c.tag === 'SOON' ? 'upd-soon' : ''}">
    <div class="upd-meta">
      <span class="upd-date">${esc(c.date)}</span>
      ${c.version ? `<span class="upd-ver">v${esc(c.version)}</span>` : ''}
      <span class="upd-tag tag-${c.tag.toLowerCase()}">${esc(c.tag)}</span>
    </div>
    <div class="upd-body">
      <h3>${esc(c.title)}</h3>
      <ul>${c.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
    </div>
  </article>`;
}

function renderUpdates() {
  stopTimer(); session = null;
  const root = el('<div></div>');
  root.appendChild(topbar('updates'));
  const latest = CHANGELOG[0];
  const showFeatured = latest && latest.version && latest.tag !== 'SOON';
  const history = showFeatured ? CHANGELOG.slice(1) : CHANGELOG;
  const featured = showFeatured ? `
    <section class="upd-featured cornerframe" id="whats-new">
      <div class="upd-featured-top">
        <span class="label">What&rsquo;s new</span>
        <span class="upd-tag tag-${latest.tag.toLowerCase()}">${esc(latest.tag)}</span>
      </div>
      <h2>${esc(latest.title)}</h2>
      <p class="upd-featured-date">${esc(latest.date)}</p>
      <ul class="upd-featured-list">${latest.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      <a class="upd-xlink" href="${X_URL}" target="_blank" rel="noopener">${X_SVG}<span class="upd-xlink-txt">${X_UPDATES_COPY}</span></a>
    </section>` : '';
  const historyBlock = history.length ? `
    <div class="updates-history">
      <span class="label">${showFeatured ? 'Earlier updates' : 'All updates'}</span>
      <div class="updates-list updates-list--instant">${history.map(c => changelogEntry(c, false)).join('')}</div>
    </div>` : '';
  const main = el(`<main class="panel updates">
    <div class="updates-head">
      <span class="label">Changelog</span>
      <h1>Updates.</h1>
      <p class="sub">Full release history &mdash; everything below loads with the page.</p>
    </div>
    ${featured}
    ${historyBlock}
    <div class="endbtns">
      <button class="btn btn-solid" id="up-mcat">MCAT prep</button>
      <button class="btn" id="up-cases">Clinical scenarios</button>
      <button class="btn" id="up-suggest">&#128161; Suggest a feature</button>
    </div>
  </main>`);
  main.querySelector('#up-mcat').addEventListener('click', gotoMCAT);
  main.querySelector('#up-cases').addEventListener('click', renderHome);
  main.querySelector('#up-suggest').addEventListener('click', openFeedback);
  root.appendChild(main);
  root.appendChild(siteFooter());
  setView(root);
  markSeenVersion();
}

function renderMission() {
  stopTimer(); session = null;
  const root = el('<div></div>');
  root.appendChild(topbar('mission'));
  const main = el(`<main class="panel mission">
    <section class="mission-hero">
      <span class="mcat-eyebrow">Cortex Medical Academy &middot; The mission</span>
      <h1>Master the human machine.</h1>
      <p class="mission-lede">Cortex Medical Academy exists to remove every barrier between a capable mind and real medical mastery. Built from first principles and grounded in how learning actually works. The future of medicine shouldn&rsquo;t belong to whoever can afford a $500 prep course &mdash; it should belong to whoever is willing to do the work. That&rsquo;s why our MCAT preparation is, and always will be, free for everyone.</p>
      <div class="mcat-cta">
        <button class="btn btn-solid" id="m-mcat">MCAT Prep</button>
        <button class="btn" id="m-cases">Clinical Scenarios</button>
      </div>
      <p class="mission-fact"><span class="label">Did you know</span><span class="js-fact"></span></p>
    </section>

    <div class="mission-meter cornerframe">
      <div class="mm-counter"><span class="mm-num js-visits">&middot;&middot;&middot;</span><span class="mm-lab">people have visited<span class="livetag"><i class="livedot"></i>live</span></span></div>
      <div class="mm-progress">
        <div class="mm-progress-head"><span class="label">Mission progress</span><span class="js-progresslab">on the way to 100,000 future doctors reached</span></div>
        <span class="bar"><i class="js-progressbar" style="width:0%"></i></span>
      </div>
    </div>

    <section class="mission-principles">
      <span class="label">How we think &middot; first principles</span>
      <h2>The principles behind everything.</h2>
      <div class="principle-grid" data-reveal-stagger>${PRINCIPLES.map(p => `<div class="principle"><span class="p-name">${p[0]}</span><p>${p[1]}</p></div>`).join('')}</div>
    </section>

    <section class="founder" data-reveal>
      <span class="label">From the founder</span>
      <div class="founder-note">
        <p>I started Cortex on a simple first-principles conviction: the path into medicine should never be decided by how much money you have.</p>
        <p>Human progress depends on extending healthy human lifespan and training the highest-agency minds possible. That is why everything here is built differently. The full MCAT suite is, and always will be, completely free. No barriers. No gatekeeping. Just rigorous, evidence-based mastery grounded in reality.</p>
        <p>Cortex exists to rip down every artificial limit and accelerate the development of the physicians and scientists who will push civilization forward at maximum velocity.</p>
      </div>
      <p class="founder-tagline">Master the Human Machine.</p>
      <p class="founder-sign">&mdash; Kevin Vigil, Founder</p>
    </section>

    <section class="mcat-closing" data-reveal>
      <h2>Talent is everywhere. Opportunity shouldn&rsquo;t be the bottleneck.</h2>
      <p>Start with the MCAT suite &mdash; rigorous, complete, and free forever &mdash; and grow from there. The only thing required is the discipline to begin.</p>
      <button class="btn btn-solid" id="m-enter">Enter the Academy &rarr;</button>
      <p class="mission-whatsnew"><button class="ghostbtn" id="m-updates">See what&rsquo;s new &rarr;</button></p>
    </section>
  </main>`);

  main.querySelector('#m-mcat').addEventListener('click', gotoMCAT);
  main.querySelector('#m-cases').addEventListener('click', renderHome);
  main.querySelector('#m-enter').addEventListener('click', gotoMCAT);
  main.querySelector('#m-updates').addEventListener('click', renderUpdates);
  root.appendChild(main);
  root.appendChild(siteFooter());
  setView(root);
  startFactRotator(main.querySelector('.js-fact'));
  updateVisitUI();
}

/* ---------- home / practice ---------- */

function renderHome() {
  stopTimer();
  session = null;
  ensureIndex();

  const root = el(`<div></div>`);
  root.appendChild(topbar('practice'));
  const stats = clinicalStatBand();
  const main = el(`<main class="home panel cs-landing">
    <section class="cs-hero mcat-hero">
      <span class="mcat-eyebrow">Clinical Scenarios &middot; Interactive cases &middot; Free for now</span>
      <h1>Think like a clinician.</h1>
      <p class="mcat-lede">Interactive cases across ${SPECIALTIES.length} specialties &mdash; history, vitals, staged decisions, and pearls. Pick a track or go mixed. A random unseen case begins immediately.</p>
      ${cortexFreeNote('Clinical', 'Clinical Scenarios')}
    </section>
    <div class="mcat-statband cs-statband cornerframe">${stats.map(s => `<div class="mcat-stat"><span class="ms-num" data-countup="${s[0]}">${s[0]}</span><span class="ms-lab">${s[1]}</span></div>`).join('')}</div>
    <div class="tabs scn-tabs">
      <button class="tab active" data-scn="practice">Practice</button>
      <button class="tab" data-scn="review">Review</button>
    </div>
    <div class="cs-config cornerframe">
      <span class="label">Session config</span>
      <div class="controls">
        <div class="ctl"><span class="label">Difficulty</span>
          <div class="modes">
            ${['all', ...DIFFS].map(d => `<button class="mode ${store.diff === d ? 'active' : ''}" data-diff="${d}">${d === 'all' ? 'All' : d[0].toUpperCase() + d.slice(1)}</button>`).join('')}
          </div>
        </div>
        <div class="ctl"><span class="label">Mode</span>
          <div class="modes">
            <button class="mode ${store.mode === 'untimed' ? 'active' : ''}" data-mode="untimed">No timer</button>
            <button class="mode ${store.mode === 'timed' ? 'active' : ''}" data-mode="timed">Timer</button>
          </div>
        </div>
      </div>
    </div>
    <button class="mixedbtn cs-mixed" id="mixed">
      <span class="mx-l">Mixed &mdash; random case from all ${SPECIALTIES.length} specialties</span>
      <span class="mx-r">START &rarr;</span>
    </button>
    <section class="cs-specialties">
      <div class="mcat-group-head">
        <span class="label">Specialties &middot; ${SPECIALTIES.length} tracks</span>
        <p>Pick a specialty &mdash; a random unseen case at your difficulty filter starts immediately.</p>
      </div>
      <div class="grid cs-grid" data-reveal-stagger></div>
    </section>
    <div class="homefoot">
      <span class="ghostbtn" style="cursor:default">Progress saved on this device</span>
      <button class="ghostbtn suggestbtn" id="suggest">&#128161; Suggest a feature</button>
      <button class="ghostbtn" id="reset">Reset progress</button>
    </div>
  </main>`);

  const grid = main.querySelector('.cs-grid');
  for (const sp of SPECIALTIES) {
    const count = store.manifest[sp.key] || 0;
    const p = store.progress[sp.key];
    const done = p ? Math.min((p.seen || []).length, count) : 0;
    const acc = p && p.answered ? Math.round(100 * p.correct / p.answered) : null;
    const xp = p?.xp || 0;
    const rank = rankFor(xp);
    const stat = !count ? 'Generating&hellip;' : xp > 0 ? `Rank ${rank.rank} &middot; ${xp.toLocaleString()} XP` : `${count} cases`;
    const foot = done ? `${done}/${count}${acc !== null ? ` &middot; ${acc}%` : ''}` : count ? `${count} cases` : '';
    const card = el(`<button class="card cs-card" ${count ? '' : 'disabled'}>
      <span class="cs-card-top">
        <span class="name">${esc(sp.name)}</span>
        <span class="mod-go" aria-hidden="true">&rarr;</span>
      </span>
      <span class="mod-stat">${stat}</span>
      <span class="cs-card-foot">
        <span class="done">${foot}</span>
        <span class="bar"><i style="width:${xp > 0 ? rank.pct : (done && count ? Math.round(100 * done / count) : 0)}%"></i></span>
      </span>
    </button>`);
    if (count) card.addEventListener('click', () => startRandomCase(sp));
    grid.appendChild(card);
  }

  main.querySelectorAll('.mode[data-diff]').forEach(b => b.addEventListener('click', () => {
    store.diff = b.dataset.diff;
    localStorage.setItem('cs-diff', store.diff);
    main.querySelectorAll('.mode[data-diff]').forEach(x => x.classList.toggle('active', x === b));
  }));
  main.querySelectorAll('.mode[data-mode]').forEach(b => b.addEventListener('click', () => {
    store.mode = b.dataset.mode;
    localStorage.setItem('cs-mode', store.mode);
    main.querySelectorAll('.mode[data-mode]').forEach(x => x.classList.toggle('active', x === b));
  }));
  main.querySelectorAll('[data-scn]').forEach(b => b.addEventListener('click', () => b.dataset.scn === 'review' ? renderReview() : null));
  main.querySelector('#suggest').addEventListener('click', openFeedback);
  main.querySelector('#mixed').addEventListener('click', startMixedCase);
  main.querySelector('#reset').addEventListener('click', () => openResetProgress(renderHome));

  root.appendChild(main);
  setView(root);
}

/* ---------- case selection ---------- */

function diffMatch(c) { return store.diff === 'all' || c.difficulty === store.diff; }

async function startRandomCase(sp) {
  let data;
  try { data = await loadSpecialty(sp.key); } catch { return; }
  const p = prog(sp.key);
  const eligible = data.cases.filter(diffMatch);
  if (!eligible.length) return;
  let pool = eligible.filter(c => !p.seen.includes(c.id));
  if (!pool.length) pool = eligible;          // all seen at this difficulty → allow repeats
  const c = pool[Math.floor(Math.random() * pool.length)];
  startCase(sp, c);
}

async function startMixedCase() {
  await ensureIndex();
  if (!store.index) return;
  const pool = store.index.filter(e => store.manifest[e.key] && (store.diff === 'all' || e.difficulty === store.diff));
  if (!pool.length) return;
  // prefer unseen across everything
  const seen = new Set();
  for (const k in store.progress) (store.progress[k].seen || []).forEach(id => seen.add(id));
  let fresh = pool.filter(e => !seen.has(e.id));
  const pick = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length ? fresh.length : pool.length))];
  startCaseById(pick.id, pick.key);
}

async function startCaseById(id, key) {
  const sp = { key, name: NAME_BY_KEY[key] || key };
  let data;
  try { data = await loadSpecialty(key); } catch { alert('Couldn’t load this case — check your connection and try again.'); return; }
  const c = data.cases.find(x => x.id === id);
  if (c) startCase(sp, c);
  else alert('This case is no longer available.');
}

function startCase(sp, c) {
  const qTotal = c.stages.filter(s => s.type === 'question').length;
  session = {
    sp, c, qTotal, idx: 0, results: [], correct: 0,
    timed: store.mode === 'timed', deadline: null, timerId: null, expired: false, finished: false,
  };
  renderCase();
}

/* ---------- case view ---------- */

function shuffleClinicalOpts(options) {
  const mapped = options.map((text, origIdx) => ({ text, origIdx }));
  for (let i = mapped.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mapped[i], mapped[j]] = [mapped[j], mapped[i]];
  }
  return mapped;
}

/* Remap "option X" letter tags inside an explanation to the shuffled display order,
   so the letters the explanation cites match the buttons the user now sees. Letters
   outside the current option range (legacy phantom refs like "option E" on a 4-option
   question) are left untouched. */
function remapOptionLetters(text, shuffled) {
  if (!text || !shuffled) return text;
  const pos = [];
  shuffled.forEach((o, i) => { pos[o.origIdx] = i; });
  const n = shuffled.length;
  return text.replace(/\boption\s+([A-Fa-f])\b/gi, (m, L) => {
    const origIdx = L.toUpperCase().charCodeAt(0) - 65;
    if (origIdx < 0 || origIdx >= n || pos[origIdx] == null) return m;
    const mapped = LETTERS[pos[origIdx]];
    const newL = (L === L.toLowerCase()) ? mapped.toLowerCase() : mapped;
    return m.slice(0, m.length - 1) + newL;
  });
}

function updateCaseRunbar() {
  if (!session) return;
  const total = session.c.stages.length;
  const idx = Math.min(session.idx, total);
  const pct = total ? Math.round(100 * idx / total) : 0;
  const fill = document.getElementById('cs-runfill');
  const lab = document.getElementById('cs-runlab');
  if (fill) fill.style.width = `${pct}%`;
  if (lab) lab.textContent = `Stage ${idx} / ${total}`;
}

function renderCase() {
  const { sp, c } = session;
  const marked = isBookmarked(c.id);
  const stageTotal = c.stages.length;

  const root = el(`<div>
    <header class="topbar casebar">
      <div class="side"><button class="backbtn" id="exit">&larr; Exit</button></div>
      <div class="center"><span class="topstat case-crumb">${esc(sp.name).toUpperCase()} &middot; ${esc(c.id || '').toUpperCase()}</span></div>
      <div class="side right">
        <button class="bookmark ${marked ? 'on' : ''}" id="bm" title="Bookmark (B)">${bookmarkHtml(marked)}</button>
        <span class="topstat" id="qprog">Q 0/${session.qTotal}</span>
        ${session.timed ? '<span class="timer" id="timer"></span>' : ''}
      </div>
    </header>
    <main class="case cs-case">
      <div class="cs-case-head">
        <span class="mcat-eyebrow">${esc(sp.name)} &middot; ${esc(c.id || 'case')}</span>
        <div class="case-meta cs-chips">
          <span class="cs-chip">${esc(c.setting)}</span>
          <span class="cs-chip">${esc(c.patient)}</span>
          <span class="cs-chip cs-chip--diff">${esc(c.difficulty)}</span>
        </div>
        <h2>${esc(c.title)}</h2>
        <div class="cs-runbar cornerframe" id="cs-run">
          <div class="cs-runbar-meta">
            <span class="label">Case progress</span>
            <span class="cs-runbar-lab" id="cs-runlab">Stage 0 / ${stageTotal}</span>
          </div>
          <span class="bar"><i id="cs-runfill" style="width:0%"></i></span>
        </div>
      </div>
      <div class="cs-chart cornerframe">
        <div class="block"><span class="label">Chief complaint</span><p class="prose">${esc(c.chiefComplaint)}</p></div>
        <div class="block"><span class="label">History</span><p class="prose">${esc(c.history)}</p></div>
        <div class="block"><span class="label">Vitals</span>
          <div class="vitals cs-vitals">${Object.entries(c.vitals).map(([k, v]) =>
            `<span class="vital"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></span>`).join('')}</div>
        </div>
        <div class="block"><span class="label">Examination</span><p class="prose">${esc(c.exam)}</p></div>
      </div>
      <div id="stages"></div>
    </main>
  </div>`);

  root.querySelector('#exit').addEventListener('click', renderHome);
  root.querySelector('#bm').addEventListener('click', () => refreshBookmarkBtn(root.querySelector('#bm')));
  setView(root);
  updateCaseRunbar();

  if (session.timed) {
    session.deadline = Date.now() + session.qTotal * SECONDS_PER_QUESTION * 1000;
    updateTimer();
    session.timerId = setInterval(updateTimer, 500);
  }
  appendStage();
}

function refreshBookmarkBtn(btn) {
  const on = toggleBookmark(session.c.id, session.sp.key);
  btn.classList.toggle('on', on);
  btn.innerHTML = bookmarkHtml(on);
}

function updateTimer() {
  if (!session || session.finished) return;
  const left = (session.deadline - Date.now()) / 1000;
  const elT = document.getElementById('timer');
  if (elT) {
    elT.textContent = fmtTime(left);
    elT.classList.toggle('warn', left <= 60 && left > 20);
    elT.classList.toggle('crit', left <= 20);
  }
  if (left <= 0) { session.expired = true; finishCase(); }
}
function stopTimer() { if (session?.timerId) { clearInterval(session.timerId); session.timerId = null; } }

function qNumber(stageIdx) {
  let n = 0;
  for (let i = 0; i <= stageIdx; i++) if (session.c.stages[i].type === 'question') n++;
  return n;
}

function appendStage() {
  const { c } = session;
  if (session.idx >= c.stages.length) { finishCase(); return; }
  const s = c.stages[session.idx];
  const container = document.getElementById('stages');
  const isLast = session.idx === c.stages.length - 1;
  const autoScroll = session.idx > 0;

  if (s.type === 'result') {
    const node = el(`<section class="stage">
      <div class="stage-head"><span class="label">${esc(s.label || 'Results')}</span><span class="rule"></span></div>
      <div class="result-block">${esc(s.content)}</div>
      <div class="continue-row"><span class="hint">ENTER &rarr;</span><button class="btn" data-continue>${isLast ? 'View summary' : 'Continue'}</button></div>
    </section>`);
    const row = node.querySelector('.continue-row');
    row.querySelector('[data-continue]').addEventListener('click', () => { row.remove(); advance(); });
    container.appendChild(node);
    if (autoScroll) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const qn = qNumber(session.idx);
  const shuffled = shuffleClinicalOpts(s.options);
  const node = el(`<section class="stage" data-question>
    <div class="stage-head"><span class="label">Q${qn} &middot; ${esc(s.label || 'Question')}</span><span class="rule"></span></div>
    <p class="q">${esc(s.question)}</p>
    <div class="opts">${shuffled.map((o, i) => `<button class="opt" data-i="${i}" data-orig="${o.origIdx}"><span class="key">${LETTERS[i]}</span><span>${esc(o.text)}</span></button>`).join('')}</div>
    <div class="after"></div>
  </section>`);
  node.querySelectorAll('.opt').forEach(btn => btn.addEventListener('click', () => answer(node, s, shuffled[Number(btn.dataset.i)].origIdx, isLast, shuffled)));
  container.appendChild(node);
  if (autoScroll) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function answer(node, s, choice, isLast, shuffled) {
  if (session.finished) return;
  const correct = choice === s.answer;
  node.querySelectorAll('.opt').forEach(btn => {
    const orig = Number(btn.dataset.orig);
    btn.disabled = true;
    if (orig === s.answer) btn.classList.add('correct');
    else if (orig === choice) btn.classList.add('wrong');
    else btn.classList.add('dimmed');
  });

  session.results.push({ label: s.label, correct });
  if (correct) session.correct++;
  const p = prog(session.sp.key);
  p.answered++; if (correct) p.correct++;
  saveProgress();

  const qp = document.getElementById('qprog');
  if (qp) qp.textContent = `Q ${session.results.length}/${session.qTotal}`;

  const after = node.querySelector('.after');
  after.appendChild(el(`<div class="explain ${correct ? 'good' : 'bad'}"><span class="verdict">${correct ? 'CORRECT' : 'INCORRECT'}</span><p>${esc(remapOptionLetters(s.explanation, shuffled))}</p></div>`));
  const row = el(`<div class="continue-row"><span class="hint">ENTER &rarr;</span><button class="btn" data-continue>${isLast ? 'View summary' : 'Continue'}</button></div>`);
  row.querySelector('[data-continue]').addEventListener('click', () => { row.remove(); advance(); });
  after.appendChild(row);
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function advance() { session.idx++; updateCaseRunbar(); appendStage(); }

function finishCase() {
  if (session.finished) return;
  session.finished = true;
  stopTimer();
  document.querySelectorAll('.opt:not(:disabled)').forEach(b => { b.disabled = true; b.classList.add('dimmed'); });
  document.querySelectorAll('.continue-row').forEach(r => r.remove());

  const { sp, c } = session;
  const p = prog(sp.key);
  if (!p.seen.includes(c.id)) p.seen.push(c.id);

  const completedAll = session.results.length === session.qTotal && !session.expired;
  const perfect = completedAll && session.correct === session.qTotal;

  // record per-case + history + streak
  const rec = caseRec(c.id, sp.key);
  const isFirst = rec.attempts === 0;
  rec.attempts++; rec.lastC = session.correct; rec.lastT = session.qTotal;
  rec.bestC = Math.max(rec.bestC || 0, session.correct); rec.lastTs = Date.now();
  saveCases();
  store.history.unshift({ id: c.id, key: sp.key, c: session.correct, t: session.qTotal, timed: session.timed, ts: rec.lastTs });
  saveHistory();
  bumpStreak();

  // XP (only first completion of a case awards XP, prevents farming replays)
  let gained = 0, correctXp = 0, caseBonus = 0, perfectXp = 0, timedBonus = 0, promoted = false;
  const rankBefore = rankFor(p.xp);
  if (isFirst) {
    correctXp = session.correct * XP_PER_CORRECT;
    caseBonus = completedAll ? (XP_CASE_BONUS[c.difficulty] ?? 15) : 0;
    perfectXp = perfect ? XP_PERFECT : 0;
    gained = correctXp + caseBonus + perfectXp;
    timedBonus = session.timed && completedAll ? Math.round(gained * (TIMED_MULTIPLIER - 1)) : 0;
    gained += timedBonus;
    p.xp += gained;
    promoted = rankFor(p.xp).rank > rankBefore.rank;
  }
  saveProgress();
  const rank = rankFor(p.xp);

  const xpRows = isFirst ? [
    `<div class="xprow"><span>Correct answers &middot; ${session.correct} &times; ${XP_PER_CORRECT}</span><span>+${correctXp}</span></div>`,
    caseBonus ? `<div class="xprow"><span>Case complete &middot; ${esc(c.difficulty)}</span><span>+${caseBonus}</span></div>` : '',
    perfectXp ? `<div class="xprow"><span>Perfect case</span><span>+${perfectXp}</span></div>` : '',
    timedBonus ? `<div class="xprow"><span>Timed &times;${TIMED_MULTIPLIER}</span><span>+${timedBonus}</span></div>` : '',
    `<div class="xprow total"><span>Total</span><span class="gain">+${gained} XP</span></div>`,
  ].join('') : `<div class="xprow total"><span>Replay &middot; attempt ${rec.attempts}</span><span>No XP</span></div>`;

  const ticks = [];
  for (let i = 0; i < session.qTotal; i++) {
    const r = session.results[i];
    if (!r) ticks.push(`<span class="skip">Q${i + 1} &mdash;</span>`);
    else ticks.push(`<span class="${r.correct ? 'ok' : 'no'}">Q${i + 1} ${r.correct ? '&#10003;' : '&#10007;'}</span>`);
  }

  const marked = isBookmarked(c.id);
  updateCaseRunbar();
  const node = el(`<section class="summary cs-summary">
    <div class="cs-scorebox cornerframe">
      <span class="label">Case complete</span>
      <div class="score">${String(session.correct).padStart(2, '0')}<span class="of">/${String(session.qTotal).padStart(2, '0')}</span></div>
      <div class="ticks">${ticks.join('')}</div>
      ${session.expired ? '<div class="expired-flag">TIME EXPIRED</div>' : ''}
    </div>
    <div class="xpblock">
      <span class="label">XP earned</span>
      ${xpRows}
      ${promoted ? `<div class="promoted">Rank up &rarr; ${rank.rank}</div>` : ''}
      <div class="rankline">
        <div class="who"><span>${esc(sp.name)} &middot; Rank ${rank.rank}</span><span>${p.xp.toLocaleString()} XP</span></div>
        <span class="bar"><i style="width:${rank.pct}%"></i></span>
        <div class="cap">${rank.nextAt ? `<span>Next: Rank ${rank.rank + 1}</span><span>${rank.nextAt.toLocaleString()} XP</span>` : '<span>Max rank</span><span></span>'}</div>
      </div>
    </div>
    <div class="dx"><span class="label">Final diagnosis</span><div class="val">${esc(c.diagnosis)}</div></div>
    <div class="pearls"><span class="label">Pearls</span>
      ${(c.pearls || []).map((pl, i) => `<div class="pearl"><span class="n">${String(i + 1).padStart(2, '0')}</span><span>${esc(pl)}</span></div>`).join('')}
    </div>
    <div class="endbtns">
      <button class="btn btn-solid" id="next">Next case</button>
      <button class="btn" id="bm2">${bookmarkHtml(marked, 'Save case')}</button>
      <button class="btn" id="home">Home</button>
    </div>
  </section>`);

  node.querySelector('#next').addEventListener('click', () => startRandomCase(sp));
  node.querySelector('#home').addEventListener('click', renderHome);
  node.querySelector('#bm2').addEventListener('click', (e) => {
    const on = toggleBookmark(c.id, sp.key);
    e.currentTarget.innerHTML = bookmarkHtml(on, 'Save case');
    const top = document.getElementById('bm');
    if (top) { top.classList.toggle('on', on); top.innerHTML = bookmarkHtml(on); }
  });

  document.getElementById('stages').appendChild(node);
  node.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- review ---------- */

function caseRow(entry) {
  // entry: {id, key, title, difficulty, rightHtml}
  const row = el(`<button class="row cs-row">
    <span class="row-main">
      <span class="row-spec">${esc(NAME_BY_KEY[entry.key] || entry.key)}</span>
      <span class="row-title">${esc(entry.title)}</span>
    </span>
    <span class="row-right">${entry.rightHtml || ''}<span class="mod-go" aria-hidden="true">&rarr;</span></span>
  </button>`);
  row.addEventListener('click', () => startCaseById(entry.id, entry.key));
  return row;
}
function scorePill(c, t) {
  if (c == null) return '';
  const cls = c === t ? 'ok' : c === 0 ? 'no' : 'mid';
  return `<span class="pill ${cls}">${c}/${t}</span>`;
}

async function renderReview(tab = 'history') {
  await ensureIndex();
  stopTimer(); session = null;
  const stats = clinicalStatBand().slice(2);
  const root = el(`<div></div>`);
  root.appendChild(topbar('practice'));
  const main = el(`<main class="panel cs-landing cs-review">
    <section class="cs-hero mcat-hero">
      <span class="mcat-eyebrow">Clinical Scenarios &middot; Review hub</span>
      <h1>Revisit your cases.</h1>
      <p class="mcat-lede">History, misses, bookmarks, and full-bank search &mdash; every case you&rsquo;ve touched, one telemetry console.</p>
    </section>
    <div class="mcat-statband cs-statband cs-statband--compact cornerframe">${stats.map(s => `<div class="mcat-stat"><span class="ms-num" data-countup="${s[0]}">${s[0]}</span><span class="ms-lab">${s[1]}</span></div>`).join('')}</div>
    <div class="tabs scn-tabs">
      <button class="tab" data-scn="practice">Practice</button>
      <button class="tab active" data-scn="review">Review</button>
    </div>
    <div class="cs-review-tabs cornerframe">
      <span class="label">Filter</span>
      <div class="tabs cs-subtabs">
        ${['history', 'missed', 'bookmarks', 'search'].map(x => `<button class="tab ${x === tab ? 'active' : ''}" data-tab="${x}">${x[0].toUpperCase() + x.slice(1)}</button>`).join('')}
      </div>
    </div>
    <div class="searchbox cs-searchbox" style="display:none"><input type="text" id="q" placeholder="Search by symptom, diagnosis, or specialty&hellip;" autocomplete="off"></div>
    <div class="rows cs-rows cornerframe" id="rows"></div>
  </main>`);

  main.querySelectorAll('.tab[data-tab]').forEach(b => b.addEventListener('click', () => renderReview(b.dataset.tab)));
  main.querySelectorAll('[data-scn]').forEach(b => b.addEventListener('click', () => b.dataset.scn === 'practice' ? renderHome() : null));
  const rows = main.querySelector('#rows');
  const sb = main.querySelector('.searchbox');

  if (tab === 'history') {
    if (!store.history.length) rows.appendChild(emptyMsg('No cases yet — go do some on Practice.'));
    else store.history.slice(0, 100).forEach(h => rows.appendChild(caseRow({
      id: h.id, key: h.key, title: titleFor(h.id), difficulty: '',
      rightHtml: `${scorePill(h.c, h.t)}<span class="row-when">${relTime(h.ts)}</span>`,
    })));
  } else if (tab === 'missed') {
    const missed = Object.entries(store.cases).filter(([, r]) => r.attempts > 0 && r.lastC != null && r.lastC < r.lastT);
    missed.sort((a, b) => (b[1].lastTs || 0) - (a[1].lastTs || 0));
    if (!missed.length) rows.appendChild(emptyMsg('No missed cases — either spotless or just getting started.'));
    else missed.forEach(([id, r]) => rows.appendChild(caseRow({
      id, key: r.key, title: titleFor(id), rightHtml: `${scorePill(r.lastC, r.lastT)}<span class="row-when">retry &rarr;</span>`,
    })));
  } else if (tab === 'bookmarks') {
    const bm = Object.entries(store.cases).filter(([, r]) => r.bookmarked);
    bm.sort((a, b) => (b[1].lastTs || 0) - (a[1].lastTs || 0));
    if (!bm.length) rows.appendChild(emptyMsg('No bookmarks yet — tap ☆ Save in any case.'));
    else bm.forEach(([id, r]) => rows.appendChild(caseRow({
      id, key: r.key, title: titleFor(id), rightHtml: r.lastC != null ? scorePill(r.lastC, r.lastT) : '<span class="row-when">open &rarr;</span>',
    })));
  } else if (tab === 'search') {
    sb.style.display = '';
    const input = sb.querySelector('#q');
    const run = () => {
      const q = input.value.trim().toLowerCase();
      rows.replaceChildren();
      if (!store.index) { rows.appendChild(emptyMsg('Search index not loaded.')); return; }
      if (q.length < 2) { rows.appendChild(emptyMsg('Type at least 2 characters.')); return; }
      const hits = store.index.filter(e =>
        e.title.toLowerCase().includes(q) || e.diagnosis.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
      ).slice(0, 60);
      if (!hits.length) { rows.appendChild(emptyMsg('No matches.')); return; }
      hits.forEach(e => rows.appendChild(caseRow({
        id: e.id, key: e.key, title: e.title,
        rightHtml: `<span class="pill tag">${esc(e.difficulty)}</span>`,
      })));
    };
    input.addEventListener('input', run);
    setTimeout(() => input.focus(), 30);
    run();
  }

  root.appendChild(main);
  setView(root);
}

function emptyMsg(t) { return el(`<div class="empty">${esc(t)}</div>`); }
function titleFor(id) {
  if (store.index) { const e = store.index.find(x => x.id === id); if (e) return e.title; }
  return id;
}

/* ---------- stats ---------- */

function fmtDurMs(ms) {
  const m = Math.round((ms || 0) / 60000);
  const h = Math.floor(m / 60);
  return m > 0 ? (h > 0 ? `${h}h ${m % 60}m` : `${m}m`) : '0m';
}
function mcatStatsSnapshot() {
  const log = loadJSON('cs-mcat-log', []);
  const srs = loadJSON('cs-mcat-srs', {});
  const answered = log.length;
  const correct = log.filter(x => x.correct).length;
  const acc = answered ? Math.round(100 * correct / answered) : null;
  const now = Date.now();
  const vals = Object.values(srs);
  const learned = vals.filter(r => r && r.reps > 0).length;
  const due = vals.filter(r => r && r.reps > 0 && r.due <= now).length;
  return { answered, correct, acc, learned, due, has: answered > 0 || learned > 0 };
}
function pomoStatsSnapshot() {
  const p = loadJSON('cs-pomo', null);
  if (!p || typeof p !== 'object') return { rounds: 0, focusLabel: '0m', has: false };
  const rounds = p.rounds || 0;
  const focusMs = p.totalFocusMs || 0;
  return { rounds, focusLabel: fmtDurMs(focusMs), has: rounds > 0 || focusMs > 0 };
}

const PHARM_UNIQUE_TOTAL = 355;

function pharmStatsSnapshot() {
  const prog = loadJSON('cs-pharm', { drill: { correct: 0, total: 0 }, byCat: {}, learned: {} });
  const drilled = prog.drill?.total || 0;
  const acc = drilled ? Math.round(100 * prog.drill.correct / drilled) : null;
  const names = new Set();
  Object.values(prog.learned || {}).forEach(v => { if (v?.name) names.add(v.name); });
  const learned = names.size || Object.keys(prog.learned || {}).length;
  const has = drilled > 0 || learned > 0;
  return { drilled, acc, learned, learnedTotal: PHARM_UNIQUE_TOTAL, has };
}

function microStatsSnapshot() {
  const prog = loadJSON('cs-micro', { drill: { correct: 0, total: 0 }, byCat: {}, guidedSection: 0, guidedDone: false });
  const drilled = prog.drill?.total || 0;
  const acc = drilled ? Math.round(100 * prog.drill.correct / drilled) : null;
  const guidedTotal = 12;
  const guided = prog.guidedDone ? guidedTotal : (prog.guidedSection || 0);
  const has = drilled > 0 || guided > 0 || prog.guidedDone;
  return { drilled, acc, guided, guidedTotal, has };
}

function labsStatsSnapshot() {
  const prog = loadJSON('cs-labs', { drill: { correct: 0, total: 0 }, byPanel: {}, guidedSection: 0, guidedDone: false });
  const drilled = prog.drill?.total || 0;
  const acc = drilled ? Math.round(100 * prog.drill.correct / drilled) : null;
  const guidedTotal = 10;
  const guided = prog.guidedDone ? guidedTotal : (prog.guidedSection || 0);
  const has = drilled > 0 || guided > 0 || prog.guidedDone;
  return { drilled, acc, guided, guidedTotal, has };
}

function ekgStatsSnapshot() {
  const prog = loadJSON('cs-ekg', { drill: { correct: 0, total: 0 }, byCat: {}, reviewed: [] });
  const reviewed = (prog.reviewed || []).length;
  const total = 20;
  const drilled = prog.drill?.total || 0;
  const acc = drilled ? Math.round(100 * prog.drill.correct / drilled) : null;
  const has = reviewed > 0 || drilled > 0;
  return { reviewed, total, drilled, acc, has };
}

function pedStatsSnapshot() {
  const raw = loadJSON('cs-ped', null);
  const mods = [
    { type: 'hormone', hormone: 'steroid' }, { type: 'hormone', hormone: 'peptide' }, { type: 'hormone', hormone: 'amine' },
    { type: 'pathway' }, { type: 'pathway' }, { type: 'pathway' }, { type: 'pathway' }, { type: 'pathway' }, { type: 'pathway' },
    { type: 'catalog' }, { type: 'clinical' },
  ];
  let complete = 0;
  let agents = 0;
  if (raw?.hormones) {
    ['steroid', 'peptide', 'amine'].forEach(h => {
      const n = (raw.hormones[h]?.learned || []).length;
      agents += n;
      const totals = { steroid: 11, peptide: 10, amine: 9 };
      if (n >= (totals[h] || 1)) complete++;
    });
  }
  const pathways = raw?.pathways ? Object.values(raw.pathways).filter(p => p.completed).length : 0;
  complete += pathways;
  if (raw?.catalogDone) complete++;
  if (raw?.clinicalDone) complete++;
  const total = 11;
  const pct = Math.round(100 * complete / total);
  return { complete, total, pct, agents, pathways, has: complete > 0 || agents > 0 || pathways > 0 };
}

function neuroStatsSnapshot() {
  const prog = loadJSON('cs-neuro', { pathDone: [], topicQuiz: {}, sims: {}, code: {}, milestones: {} });
  const pathDone = prog.pathDone?.length || 0;
  const pathTotal = 20;
  const msPassed = Object.values(prog.milestones || {}).filter(m => m?.passed).length;
  const codeDone = Object.values(prog.code || {}).filter(v => v === true || v?.passed).length;
  const simDone = Object.values(prog.sims || {}).filter(s => s?.ok).length;
  const quizDone = Object.keys(prog.topicQuiz || {}).length;
  const has = pathDone > 0 || quizDone > 0 || codeDone > 0 || simDone > 0 || msPassed > 0;
  return {
    pathDone, pathTotal, pathPct: pathTotal ? Math.round(100 * pathDone / pathTotal) : 0,
    msPassed, msTotal: 6, codeDone, codeTotal: 13, simDone, simTotal: 12, quizDone, has,
  };
}

function renderStats() {
  stopTimer(); session = null;
  const t = totals();
  const ms = mcatStatsSnapshot();
  const ps = pomoStatsSnapshot();
  const ns = neuroStatsSnapshot();
  const ph = pharmStatsSnapshot();
  const pd = pedStatsSnapshot();
  const mi = microStatsSnapshot();
  const la = labsStatsSnapshot();
  const ek = ekgStatsSnapshot();
  const mp = typeof medicinePathProgress === 'function' ? medicinePathProgress() : null;
  const totalCases = Object.values(store.manifest).reduce((a, b) => a + b, 0);

  // 21-day activity strip from history
  const active = activeDays();
  const days = [];
  for (let i = 20; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(active.has(dayStr(d))); }

  // per-specialty rows
  const specRows = SPECIALTIES.map(sp => {
    const p = store.progress[sp.key];
    const count = store.manifest[sp.key] || 0;
    const done = p ? Math.min((p.seen || []).length, count) : 0;
    const acc = p && p.answered ? Math.round(100 * p.correct / p.answered) : null;
    const xp = p?.xp || 0;
    return { sp, count, done, acc, xp, rank: rankFor(xp).rank, answered: p?.answered || 0 };
  });
  const ranked = specRows.filter(r => r.answered >= 5 && r.acc != null);
  const best = ranked.length ? ranked.reduce((a, b) => b.acc > a.acc ? b : a) : null;
  const worst = ranked.length ? ranked.reduce((a, b) => b.acc < a.acc ? b : a) : null;

  const root = el(`<div></div>`);
  root.appendChild(topbar('stats'));
  const main = el(`<main class="panel">
    <div class="hero"><h1>Stats.</h1><p class="sub">Your progress across MCAT prep and clinical scenarios.</p></div>

    <div class="statblock">
      <span class="label">MCAT prep</span>
      <div class="metrics">
        <div class="metric"><span class="m-num" data-countup="${ms.answered}">${ms.answered || '&mdash;'}</span><span class="m-lab">Questions done</span><span class="m-sub">drills, passages &amp; sim</span></div>
        <div class="metric"><span class="m-num" data-countup="${ms.acc != null ? ms.acc + '%' : ''}">${ms.acc != null ? ms.acc + '%' : '&mdash;'}</span><span class="m-lab">Accuracy</span><span class="m-sub">${ms.answered ? ms.correct + '/' + ms.answered : 'no data yet'}</span></div>
        <div class="metric"><span class="m-num" data-countup="${ms.learned}">${ms.learned || '&mdash;'}</span><span class="m-lab">Cards learned</span><span class="m-sub">in spaced rotation</span></div>
        <div class="metric"><span class="m-num" data-countup="${ms.due}">${ms.due || '&mdash;'}</span><span class="m-lab">Due now</span><span class="m-sub">flashcards ready</span></div>
      </div>
      ${ms.has ? '<div class="stat-cta"><button class="btn btn-solid" id="stats-mcat">Open MCAT &rarr;</button></div>' : '<p class="stat-empty">No MCAT activity yet &mdash; start with drills or flashcards.</p>'}
    </div>

    <div class="statblock">
      <span class="label">Medicine study path</span>
      <div class="metrics metrics-2">
        <div class="metric"><span class="m-num" data-countup="${mp ? mp.pct + '%' : ''}">${mp && mp.done ? mp.pct + '%' : '&mdash;'}</span><span class="m-lab">Path progress</span><span class="m-sub">${mp ? mp.done + '/' + mp.total + ' steps' : 'open Medicine once'}</span></div>
        <div class="metric"><span class="m-num" data-countup="${ph.learned}">${ph.learned || '&mdash;'}</span><span class="m-lab">Pharm names</span><span class="m-sub">of ${ph.learnedTotal} in guided learn</span></div>
      </div>
      <div class="stat-cta"><button class="btn btn-solid" id="stats-medpath">Open Medicine &rarr;</button></div>
    </div>

    <div class="statblock">
      <span class="label">Performance drugs</span>
      <div class="metrics metrics-2">
        <div class="metric"><span class="m-num" data-countup="${pd.pct}%">${pd.complete ? pd.pct + '%' : '&mdash;'}</span><span class="m-lab">Course progress</span><span class="m-sub">${pd.complete}/${pd.total} modules</span></div>
        <div class="metric"><span class="m-num" data-countup="${pd.agents}">${pd.agents || '&mdash;'}</span><span class="m-lab">Agents studied</span><span class="m-sub">${pd.pathways ? pd.pathways + ' pathways done' : 'hormone modules'}</span></div>
      </div>
      ${pd.has ? '<div class="stat-cta"><button class="btn btn-solid" id="stats-ped">Open PED course &rarr;</button></div>' : '<p class="stat-empty">No PED progress yet &mdash; start module 1.</p>'}
    </div>

    <div class="statblock">
      <span class="label">Pharmacology</span>
      <div class="metrics metrics-2">
        <div class="metric"><span class="m-num" data-countup="${ph.drilled}">${ph.drilled || '&mdash;'}</span><span class="m-lab">Drill questions</span><span class="m-sub">${ph.acc != null ? ph.acc + '% accuracy' : 'MOA or pearl mode'}</span></div>
        <div class="metric"><span class="m-num" data-countup="${ph.learned}">${ph.learned || '&mdash;'}</span><span class="m-lab">Unique names</span><span class="m-sub">of ${ph.learnedTotal} in guided learn</span></div>
      </div>
      ${ph.has ? '<div class="stat-cta"><button class="btn btn-solid" id="stats-pharm">Open Pharmacology &rarr;</button></div>' : '<p class="stat-empty">No pharm activity yet &mdash; start with a drug class.</p>'}
    </div>

    <div class="statblock">
      <span class="label">Microbiology</span>
      <div class="metrics metrics-2">
        <div class="metric"><span class="m-num" data-countup="${mi.guided}">${mi.guided || '&mdash;'}</span><span class="m-lab">Groups learned</span><span class="m-sub">of ${mi.guidedTotal} guided</span></div>
        <div class="metric"><span class="m-num" data-countup="${mi.drilled}">${mi.drilled || '&mdash;'}</span><span class="m-lab">Drill questions</span><span class="m-sub">${mi.acc != null ? mi.acc + '% accuracy' : 'bug ID recall'}</span></div>
      </div>
      ${mi.has ? '<div class="stat-cta"><button class="btn btn-solid" id="stats-micro">Open Microbiology &rarr;</button></div>' : '<p class="stat-empty">No micro activity yet &mdash; start guided learn.</p>'}
    </div>

    <div class="statblock">
      <span class="label">Lab values</span>
      <div class="metrics metrics-2">
        <div class="metric"><span class="m-num" data-countup="${la.guided}">${la.guided || '&mdash;'}</span><span class="m-lab">Panels learned</span><span class="m-sub">of ${la.guidedTotal} guided</span></div>
        <div class="metric"><span class="m-num" data-countup="${la.drilled}">${la.drilled || '&mdash;'}</span><span class="m-lab">Drill questions</span><span class="m-sub">${la.acc != null ? la.acc + '% accuracy' : 'pattern recall'}</span></div>
      </div>
      ${la.has ? '<div class="stat-cta"><button class="btn btn-solid" id="stats-labs">Open Lab values &rarr;</button></div>' : '<p class="stat-empty">No labs activity yet &mdash; start guided learn.</p>'}
    </div>

    <div class="statblock">
      <span class="label">ECG rhythms</span>
      <div class="metrics metrics-2">
        <div class="metric"><span class="m-num" data-countup="${ek.reviewed}">${ek.reviewed || '&mdash;'}</span><span class="m-lab">Reviewed</span><span class="m-sub">of ${ek.total} rhythms</span></div>
        <div class="metric"><span class="m-num" data-countup="${ek.drilled}">${ek.drilled || '&mdash;'}</span><span class="m-lab">Drill questions</span><span class="m-sub">${ek.acc != null ? ek.acc + '% accuracy' : 'identify on sight'}</span></div>
      </div>
      ${ek.has ? '<div class="stat-cta"><button class="btn btn-solid" id="stats-ekg">Open ECG &rarr;</button></div>' : '<p class="stat-empty">No ECG activity yet &mdash; review the library first.</p>'}
    </div>

    <div class="statblock">
      <span class="label">Neuroengineering</span>
      <div class="metrics">
        <div class="metric"><span class="m-num" data-countup="${ns.pathPct}%">${ns.pathDone ? ns.pathPct + '%' : '&mdash;'}</span><span class="m-lab">BCI path</span><span class="m-sub">${ns.pathDone}/${ns.pathTotal} units</span></div>
        <div class="metric"><span class="m-num" data-countup="${ns.msPassed}">${ns.msPassed || '&mdash;'}</span><span class="m-lab">Milestones</span><span class="m-sub">of ${ns.msTotal} practitioner</span></div>
        <div class="metric"><span class="m-num" data-countup="${ns.codeDone}">${ns.codeDone || '&mdash;'}</span><span class="m-lab">NeuroCode</span><span class="m-sub">of ${ns.codeTotal} passed</span></div>
        <div class="metric"><span class="m-num" data-countup="${ns.simDone}">${ns.simDone || '&mdash;'}</span><span class="m-lab">NeuroSim</span><span class="m-sub">of ${ns.simTotal} correct</span></div>
      </div>
      ${ns.has ? '<div class="stat-cta"><button class="btn btn-solid" id="stats-neuro">Open Neuroengineering &rarr;</button></div>' : '<p class="stat-empty">No neuro activity yet &mdash; start the BCI Builder path.</p>'}
    </div>

    <div class="statblock">
      <span class="label">Focus timer</span>
      <div class="metrics metrics-2">
        <div class="metric"><span class="m-num" data-countup="${ps.rounds}">${ps.rounds || '&mdash;'}</span><span class="m-lab">Rounds done</span><span class="m-sub">this session</span></div>
        <div class="metric"><span class="m-num">${esc(ps.focusLabel)}</span><span class="m-lab">Total focused</span><span class="m-sub">pomodoro time</span></div>
      </div>
      ${ps.has ? '<div class="stat-cta"><button class="btn" id="stats-pomo">Open Focus Timer &rarr;</button></div>' : '<p class="stat-empty">No focus sessions yet &mdash; start a round under Explore.</p>'}
    </div>

    <div class="statblock">
      <span class="label">Clinical scenarios</span>
      <div class="metrics">
        <div class="metric"><span class="m-num" data-countup="${t.casesDone}">${t.casesDone}</span><span class="m-lab">Cases done</span><span class="m-sub">of ${totalCases.toLocaleString()}</span></div>
        <div class="metric"><span class="m-num" data-countup="${t.acc != null ? t.acc + '%' : ''}">${t.acc != null ? t.acc + '%' : '&mdash;'}</span><span class="m-lab">Accuracy</span><span class="m-sub">${t.correct}/${t.answered} answers</span></div>
        <div class="metric"><span class="m-num" data-countup="${store.streak.current}&#128293;">${store.streak.current}&#128293;</span><span class="m-lab">Day streak</span><span class="m-sub">best ${store.streak.longest}</span></div>
        <div class="metric"><span class="m-num" data-countup="${t.xp}">${t.xp.toLocaleString()}</span><span class="m-lab">Total XP</span><span class="m-sub">across ${SPECIALTIES.length} specialties</span></div>
      </div>
    </div>

    <div class="statblock">
      <span class="label">Clinical &middot; last 21 days</span>
      <div class="daystrip">${days.map(a => `<span class="day ${a ? 'on' : ''}"></span>`).join('')}</div>
    </div>

    ${best && worst && best.sp.key !== worst.sp.key ? `<div class="statblock callouts">
      <div class="callout"><span class="label">Strongest</span><div class="co-name">${esc(best.sp.name)}</div><div class="co-val ok">${best.acc}%</div></div>
      <div class="callout"><span class="label">Needs work</span><div class="co-name">${esc(worst.sp.name)}</div><div class="co-val no">${worst.acc}%</div></div>
    </div>` : ''}

    <div class="statblock">
      <span class="label">By specialty</span>
      <div class="spectable"></div>
    </div>
  </main>`);

  const tbl = main.querySelector('.spectable');
  specRows.forEach(r => {
    const row = el(`<button class="srow">
      <span class="sr-name">${esc(r.sp.name)}</span>
      <span class="sr-rank">${r.xp > 0 ? 'R' + r.rank : '&mdash;'}</span>
      <span class="sr-done">${r.done}/${r.count}</span>
      <span class="sr-acc">${r.acc != null ? r.acc + '%' : '&mdash;'}</span>
      <span class="sr-bar"><i style="width:${r.count ? Math.round(100 * r.done / r.count) : 0}%"></i></span>
    </button>`);
    row.addEventListener('click', () => startRandomCase(r.sp));
    tbl.appendChild(row);
  });

  const mcatBtn = main.querySelector('#stats-mcat');
  if (mcatBtn) mcatBtn.addEventListener('click', gotoMCAT);
  const pomoBtn = main.querySelector('#stats-pomo');
  if (pomoBtn) pomoBtn.addEventListener('click', () => { if (typeof renderPomodoro === 'function') renderPomodoro(); });
  const neuroBtn = main.querySelector('#stats-neuro');
  if (neuroBtn) neuroBtn.addEventListener('click', () => { if (typeof renderNeuro === 'function') renderNeuro(); });
  const medPathBtn = main.querySelector('#stats-medpath');
  if (medPathBtn) medPathBtn.addEventListener('click', async () => {
    await ensureSection('reference');
    if (typeof renderReference === 'function') await renderReference();
  });
  const pharmBtn = main.querySelector('#stats-pharm');
  if (pharmBtn) pharmBtn.addEventListener('click', async () => {
    await ensureSection('reference');
    renderRefSet('pharm', 'classes');
  });
  const pedBtn = main.querySelector('#stats-ped');
  if (pedBtn) pedBtn.addEventListener('click', async () => {
    await ensureSection('reference');
    renderPerformanceDrugs('hub');
  });
  const microBtn = main.querySelector('#stats-micro');
  if (microBtn) microBtn.addEventListener('click', async () => {
    await ensureSection('reference');
    renderRefSet('micro', 'learn');
  });
  const labsBtn = main.querySelector('#stats-labs');
  if (labsBtn) labsBtn.addEventListener('click', async () => {
    await ensureSection('reference');
    renderRefSet('labs', 'learn');
  });
  const ekgBtn = main.querySelector('#stats-ekg');
  if (ekgBtn) ekgBtn.addEventListener('click', async () => {
    await ensureSection('reference');
    renderEKG('library');
  });

  root.appendChild(main);
  setView(root);
}

/* ---------- keyboard ---------- */

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
  if (typing) return;
  if (document.querySelector('.modal, .fbmodal-back')) return;   // don't drive the screen behind an open overlay

  // Enter advances explicit continue/next affordances, even on session-less screens (drills, Medicine, Learn-to-Learn).
  // Scoped to opt-in [data-continue]/[data-next] only — NOT a bare #next, which the timed Exam Simulator uses.
  if (e.key === 'Enter') {
    const btn = document.querySelector('[data-continue]') || document.querySelector('[data-next]');
    if (btn) { e.preventDefault(); btn.click(); return; }
  }

  if (!session) {
    const stage = document.querySelector('.quizwrap .stage');
    if (stage) {
      const btns = [...stage.querySelectorAll('.opt:not(:disabled)')];
      if (btns.length) {
        let i = -1;
        if (/^[a-eA-E]$/.test(e.key)) i = e.key.toLowerCase().charCodeAt(0) - 97;
        if (/^[1-5]$/.test(e.key)) i = Number(e.key) - 1;
        if (i >= 0 && i < btns.length) { e.preventDefault(); btns[i].click(); return; }
      }
    }
    return;
  }

  if (e.key === 'Escape') { renderHome(); return; }
  if (e.key === 'Enter') {   // in an active case, Enter also advances the summary's "Next case"
    const nb = document.getElementById('next');
    if (nb) { e.preventDefault(); nb.click(); }
    return;
  }
  if (e.key.toLowerCase() === 'b' && !session.finished) {
    const btn = document.getElementById('bm'); if (btn) { refreshBookmarkBtn(btn); return; }
  }
  const stages = document.querySelectorAll('[data-question]');
  const current = stages[stages.length - 1];
  if (!current || current.querySelector('.opt:disabled')) return;
  let i = -1;
  if (/^[a-eA-E]$/.test(e.key)) i = e.key.toLowerCase().charCodeAt(0) - 97;
  if (/^[1-5]$/.test(e.key)) i = Number(e.key) - 1;
  const btns = current.querySelectorAll('.opt');
  if (i >= 0 && i < btns.length) btns[i].click();
});

boot();
