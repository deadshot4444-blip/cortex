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

// Availability follows the Academy catalog. Public courses retain beta and
// draft review labels; localhost can also preview future unavailable tracks.
const IS_LOCAL_PREVIEW = typeof location !== 'undefined'
  && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)
  && !/[?&]gates=prod\b/.test(location.search);
const UNDER_CONSTRUCTION = new Set(IS_LOCAL_PREVIEW ? [] : CortexAcademy.tracks.filter(track => !track.available).map(track => track.id));
const COMING_SOON = new Set(UNDER_CONSTRUCTION);
function sectionMenuTag(key) {
  if (UNDER_CONSTRUCTION.has(key)) return '<span class="mi-soon">Under construction</span>';
  if (COMING_SOON.has(key)) return '<span class="mi-soon">Soon</span>';
  if (IS_LOCAL_PREVIEW && CortexAcademy.tracks.some(track => track.id === key && !track.available)) {
    return '<span class="mi-soon">Local preview</span>';
  }
  return '';
}
const SECTION_LABELS = { anatomy: 'Anatomy', reference: 'Medicine', socrates: 'Learn to Learn' };
const SECTION_INFO = {
  anatomy: {
    label: 'Anatomy',
    headline: 'Master the body, visually.',
    desc: 'Evidence-based, interactive anatomy. Click into every bone, muscle, and organ system and study it the way the science says you’ll actually retain it — active recall and spaced repetition over passive review.',
  },
  reference: {
    label: 'Medicine',
    badge: 'Under construction',
    headline: 'Medicine is under construction.',
    desc: 'This section is temporarily closed while its curriculum and learning flow are reviewed.',
  },
  socrates: {
    label: 'Learn to Learn',
    badge: 'Coming soon',
    headline: 'Learn to Learn is coming soon.',
    desc: 'A course on how to actually study — memory, retrieval, and spacing — is being built. It will open once its curriculum is ready.',
  },
  neuro: {
    label: 'Neuroengineering',
    badge: 'Under construction',
    headline: 'Neuroengineering is under construction.',
    desc: 'The BCI Builder track is temporarily closed while its units and learning flow are reviewed and polished. It will reopen soon.',
  },
};
// Public beta version; independent subject acceptance remains separate.
const APP_VERSION = '2.30.0-beta.1';
function cortexFreeNote(sectionPill, sectionName) {
  return `<p class="free-note"><span class="free-pill">MCAT always free</span><span class="free-pill free-pill--soft">${sectionPill} &middot; free</span><span class="free-note-txt">${sectionName} is free to use — no account, no paywall, no catch.</span></p>`;
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

// Raw copies of the shared clinical records exactly as this tab loaded them.
// study-storage.js adopts them when it loads, so a change made by another tab
// before the first save here is reported as a conflict instead of being overwritten.
const STUDY_CORE_KEYS = ['cs-progress', 'cs-cases', 'cs-history', 'cs-streak'];
const studyBootCopies = {};

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
    const raw = localStorage.getItem(key);
    if (STUDY_CORE_KEYS.includes(key)) studyBootCopies[key] = raw;
    const v = JSON.parse(raw);
    if (v == null) return fallback;
    // shape guard: a corrupted/legacy value of the wrong type would crash callers
    if (Array.isArray(fallback) !== Array.isArray(v)) return fallback;
    if (fallback && typeof fallback === 'object' && (typeof v !== 'object')) return fallback;
    return v;
  } catch { return fallback; }
}
// guarded write — storage can throw (quota full, Safari Private, disabled by policy);
// a failure should degrade to "not saved", never freeze the flow mid-action.
function safeSet(key, value) {
  if (typeof StudyStorage !== 'undefined' && STUDY_CORE_KEYS.includes(key)) return StudyStorage.writeRaw(key, value);
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}
function saveProgress() { safeSet('cs-progress', JSON.stringify(store.progress)); }
function saveCases() { safeSet('cs-cases', JSON.stringify(store.cases)); }
function saveHistory() { safeSet('cs-history', JSON.stringify(store.history.slice(0, 400))); }
function saveStreak() { safeSet('cs-streak', JSON.stringify(store.streak)); }

const SECTION_SCRIPTS = {
  academy: ['study-storage.js?v=4', 'academy-today.js?v=8', 'study-backup.js?v=10', 'academy-storage.js?v=4', 'academy-portfolio-core.js?v=2', 'academy-portfolio.js?v=3'],
  practice: ['study-storage.js?v=4', 'clinical-longitudinal-engine.js?v=2', 'clinical-longitudinal.js?v=3', 'clinical-shift.js?v=19'],
  mcat: ['study-storage.js?v=4', 'mcat-item-quality-core.js?v=1', 'mcat-item-quality.js?v=1', 'mcat-rehearsal-engine.js?v=2', 'mcat-rehearsal.js?v=8', 'mcat-repair-engine.js?v=3', 'mcat-repair.js?v=9', 'mcat-workflows.js?v=18', 'mcat-course-engine.js?v=7', 'mcat-course.js?v=22', 'mcat-coverage.js?v=2', 'mcat-v2-engine.js?v=10', 'mcat-v2.js?v=18', 'mcat.js?v=89'],
  anatomy: ['study-storage.js?v=4', 'academy-lessons.js?v=6', 'anatomy.js?v=43'],
  reference: ['study-storage.js?v=4', 'ecg-engine.js?v=2', 'academy-lessons.js?v=6', 'reference.js?v=59', 'performance-drugs.js?v=26', 'ekg.js?v=41'],
  socrates: ['study-storage.js?v=4', 'socrates.js?v=49'],
  neuro: ['study-storage.js?v=4', 'python-runtime.js?v=5', 'code-evaluator.js?v=7', 'neuro-project-engine.js?v=2', 'neuro-practitioner.js?v=11', 'neuro.js?v=39'],
};
const _scriptLoads = {};
function loadScript(src) {
  if (_scriptLoads[src]) return _scriptLoads[src];
  _scriptLoads[src] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => { s.remove(); delete _scriptLoads[src]; reject(new Error('load ' + src)); };
    document.head.appendChild(s);
  });
  return _scriptLoads[src];
}
async function ensureSection(key) {
  const files = SECTION_SCRIPTS[key];
  if (!files) return;
  for (const f of files) await loadScript(f);
}
// MCAT is lazy-loaded like every other section. Its entry is the saved daily
// plan (or plan setup on first use), with the complete tool library one level back.
function gotoMCAT() { return navigateSection('mcat'); }

function studyResetData(data,scope) {
  if(!['clinical','medicine','mcat','all'].includes(scope))throw Error('Choose a supported reset scope.');
  const next={...data},preferences=new Set(['cs-mode','cs-diff','cs-seen-ver','cs-anon-id']);
  const clinical=new Set(['cs-cases','cs-history','cs-streak','cs-clinical-shift-v1','cs-clinical-longitudinal-v1']);
  const medicine=new Set(['cs-pharm','cs-ped','cs-micro','cs-labs','cs-ekg','cs-medicine','cs-academy-reference-v1']);
  for(const key of Object.keys(next))if(scope==='all'&&!preferences.has(key)||scope==='mcat'&&key.startsWith('cs-mcat')||scope==='clinical'&&clinical.has(key)||scope==='medicine'&&medicine.has(key))delete next[key];
  if(['clinical','medicine'].includes(scope)&&next['cs-progress']){
    let progress=null;try{progress=JSON.parse(next['cs-progress']);}catch{}
    if(!progress||typeof progress!=='object'||Array.isArray(progress))throw Error('Shared progress could not be read. Keep a recovery copy before resetting.');
    const keys=scope==='medicine'?['medicine']:SPECIALTIES.map(s=>s.key);
    let changed=false;for(const key of keys)if(Object.hasOwn(progress,key)){delete progress[key];changed=true;}
    if(changed)next['cs-progress']=JSON.stringify(progress);
  }
  return next;
}
function openResetProgress() {
  const labels={clinical:'Clinical scenarios',medicine:'Medicine',mcat:'MCAT prep',all:'All study records'};
  const descriptions={clinical:'Clinical cases, timelines, answers and clinical counters, including the day streak that MCAT practice also builds.',medicine:'Medicine lessons, pharmacology, labs, ECGs and Medicine counters.',mcat:'MCAT lessons, plans, practice, reviews, help notes and item concerns.',all:'All seven courses, Academy plans, retrieval practice, private portfolio, notes, concerns and focus history.'};
  const m=el(`<div class="modal" id="rst"><div class="modal-box">
    <div class="modal-head"><span class="label">Reset progress</span></div>
    <p class="cfx-msg">Choose the work to reset in your active workspace. You will review the scope before anything changes. Signed-in changes sync after any cloud conflict is resolved.</p>
    <div class="endbtns cfx-btns rst-btns">${Object.entries(labels).map(([id,label])=>`<button class="btn" id="rst-${id}" data-reset-scope="${id}">${label}</button>`).join('')}<button class="btn" id="rst-cancel">Cancel</button></div>
    <div id="rst-preview"></div><p id="rst-status" role="status"></p>
    <button class="ghostbtn" id="rst-recovery">Download recovery copies</button>
    </div></div>`);
  let selection=0;
  const close=()=>{selection++;m.remove();document.removeEventListener('keydown',onKey);};
  const onKey=e=>{if(e.key==='Escape')close();};
  const status=text=>{if(m.isConnected)m.querySelector('#rst-status').textContent=text;};
  const requireSaved=()=>{
    if(!window.CortexAccount?.available)throw Error('Account storage is unavailable. Reload before resetting.');
    if(typeof StudyStorage!=='undefined'&&StudyStorage.paused)throw Error('Saving is paused. Download recovery copies and resolve the save problem first.');
    return CortexAccount.snapshot();
  };
  m.addEventListener('click',e=>{if(e.target.id==='rst')close();});
  m.querySelector('#rst-cancel').onclick=close;
  m.querySelector('#rst-recovery').onclick=()=>{if(!m.isConnected)return;try{CortexAccount.downloadRecovery();status('Recovery download prepared. Check that the file reached your Downloads folder.');}catch{status('The recovery download failed. Keep this tab open and copy important work.');}};
  m.querySelectorAll('[data-reset-scope]').forEach(button=>button.onclick=()=>{
    if(!m.isConnected)return;const current=++selection,scope=button.dataset.resetScope,host=m.querySelector('#rst-preview');host.replaceChildren();
    try{
      const snapshot=requireSaved(),preview=CortexAccount.prepareRestore(studyResetData(snapshot.data,scope)),changed=preview.changes.filter(c=>c.action!=='keep').length;
      if(!changed){status('There is no saved work to reset in this scope.');return;}
      host.innerHTML=`<h2>Reset ${esc(labels[scope])}?</h2><p>${esc(descriptions[scope])}</p><p>${changed} saved ${changed===1?'record changes':'records change'}. ${scope==='all'?'Study preferences are kept.':'Other courses, shared Academy plans and saved portfolio copies are kept.'} Sign-in details, downloaded courses and recovery copies are kept.</p><p>The previous workspace will be retained in this browser's recovery copy before the reset.</p><button class="btn btn-solid" id="rst-confirm">Reset ${esc(labels[scope])}</button><button class="btn" id="rst-back">Keep my work</button>`;
      host.querySelector('#rst-back').onclick=()=>{selection++;host.replaceChildren();status('Reset canceled. Your saved work is unchanged.');};
      host.querySelector('#rst-confirm').onclick=event=>{
        if(!m.isConnected||current!==selection)return;event.currentTarget.disabled=true;
        try{requireSaved();CortexAccount.restore(preview);status('Reset saved. Reloading the workspace…');}
        catch(error){selection++;host.replaceChildren();status(error.message+' Review a fresh reset preview after resolving the problem.');}
      };
      status('Nothing has been reset. Review the scope, or keep your work.');
    }catch(error){status(error.message);}
  });
  document.addEventListener('keydown',onKey);document.body.appendChild(m);trapModal(m);
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

function recordClinicalShiftCompletion({ id, key, difficulty, correct, total, ts }) {
  if (store.history.some(record => record.shift && record.id === id && record.ts === ts)) return;
  const safeTotal = Math.max(1, Number(total) || 1);
  const safeCorrect = Math.max(0, Math.min(safeTotal, Number(correct) || 0));
  const completedAt = Number(ts) || Date.now();
  const p = prog(key);
  if (!p.seen.includes(id)) p.seen.push(id);
  p.answered += safeTotal;
  p.correct += safeCorrect;

  const rec = caseRec(id, key);
  const isFirst = rec.attempts === 0;
  rec.attempts++;
  rec.lastC = safeCorrect;
  rec.lastT = safeTotal;
  rec.bestC = Math.max(rec.bestC || 0, safeCorrect);
  rec.lastTs = completedAt;
  store.history.unshift({ id, key, c: safeCorrect, t: safeTotal, timed: false, shift: true, ts: completedAt });

  if (isFirst) {
    p.xp += safeCorrect * XP_PER_CORRECT;
    p.xp += XP_CASE_BONUS[difficulty] ?? 15;
    if (safeCorrect === safeTotal) p.xp += XP_PERFECT;
  }
  saveProgress(); saveCases(); saveHistory(); bumpStreak();
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
  initRouter();
  fetchVisits();
  try {
    store.manifest = await fetch('data/manifest.json').then(r => r.ok ? r.json() : {});
  } catch { /* case data unavailable; the mission page still renders, sections handle it */ }
  const routed = await routeFromUrl();   // deep-link straight into a section (e.g. /medicine)
  if (!routed) renderMission();
  // First visits begin with learning; only returning visitors see release announcements.
  const priorVersion = seenVersion();
  if (!priorVersion) markSeenVersion();
  else if (hasUnseenUpdate()) setTimeout(showUpdateModal, 420);
}

/* ---------- URL routing — shareable section deep-links (e.g. /medicine) ----------
   The app is a single page; this lets an inbound URL open the right section and keeps
   the address bar in sync as you navigate, so any section link is copy-able. Needs the
   `/* /index.html 200` SPA fallback in _redirects so Netlify serves the app for these paths. */
const SEC_PATHS = Object.freeze({
  ...Object.fromEntries(CortexAcademy.tracks.map(track => [track.id, track.path])),
  academy: 'academy', stats: 'stats', utsa: 'utsa', pomodoro: 'focus', updates: 'updates',
});
const PATH_SEC = Object.fromEntries(Object.entries(SEC_PATHS).map(([key, path]) => [path, key]));
const RETIRED_PATHS = new Set(['genetics', 'ccma']);
let _sectionRequest = 0;

function sectionUrl(key) {
  const path = SEC_PATHS[key] ? '/' + SEC_PATHS[key] : '/';
  const current = new URLSearchParams(location.search), params = new URLSearchParams();
  for (const key of ['gates', 'offline']) if (current.get(key)) params.set(key, current.get(key));
  const returnTo = window.AcademyCurriculum?.safeReturn(current.get('returnTo'));
  if (returnTo) params.set('returnTo', returnTo);
  return path + (params.size ? '?' + params : '');
}
function navigateSection(key) {
  if (key === 'cogpsych') key = 'academy';
  if (!SEC_PATHS[key]) return Promise.resolve(false);
  const url = sectionUrl(key);
  if (location.pathname + location.search !== url) history.pushState({ sec: key }, '', url);
  return openSection(key);
}

function renderSectionError(key) {
  const name = CortexAcademy.tracks.find(track => track.id === key)?.name || 'This section';
  const root = el('<div></div>');
  root.appendChild(topbar(key));
  const main = el(`<main class="panel section-load-error">
    <span class="label">Connection interrupted</span>
    <h1>${esc(name)} could not load.</h1>
    <p>Your saved work has not been cleared. Check your connection, then try again.</p>
    <div class="endbtns"><button class="btn btn-solid" id="section-retry">Try again</button><button class="btn" id="section-catalog">Browse the Academy</button></div>
  </main>`);
  main.querySelector('#section-retry').addEventListener('click', () => openSection(key));
  main.querySelector('#section-catalog').addEventListener('click', () => navigateSection('academy'));
  root.appendChild(main);
  setView(root);
}

async function openSection(key) {
  if (key === 'cogpsych') return navigateSection('academy');
  const request = ++_sectionRequest;
  if (key !== 'mcat') window.pauseMcatTools?.();
  if (COMING_SOON.has(key)) { renderComingSoon(key); return true; }
  try {
    if (window.CortexOffline?.selected() && !await CortexOffline.canOpen(new URL(sectionUrl(key), location.origin).pathname)) {
      if (request === _sectionRequest) CortexOffline.unavailable();
      return true;
    }
    if (SECTION_SCRIPTS[key]) await ensureSection(key);
    if (request !== _sectionRequest) return true;
    switch (key) {
      case 'academy':
        if (new URLSearchParams(location.search).get('view') === 'today') AcademyToday.render();
        else if (new URLSearchParams(location.search).get('view') === 'storage') AcademyStorage.render();
        else if (new URLSearchParams(location.search).get('view') === 'portfolio') AcademyPortfolio.render();
        else if (['curriculum', 'queue'].includes(new URLSearchParams(location.search).get('view'))) await AcademyConnect.render();
        else CortexAcademy.renderCatalog();
        break;
      case 'practice': renderHome(); break;
      case 'mcat':
        if (typeof window.renderMCATEntry === 'function') await window.renderMCATEntry();
        else await window.renderMCAT();
        break;
      case 'stats': await renderStats(); break;
      case 'utsa': renderUTSA(); break;
      case 'neuro': await renderNeuro(); break;
      case 'reference': await renderReference(); break;
      case 'socrates': await openLearnToLearn(); break;
      case 'anatomy': await renderAnatomy(); break;
      case 'pomodoro': renderPomodoro(); break;
      case 'updates': renderUpdates(); break;
      default: return false;
    }
  } catch (error) {
    console.error('Section load failed', key, error);
    if (request === _sectionRequest) renderSectionError(key);
  }
  return true;
}

function sectionFromPath() {
  let segment;
  try { segment = decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] || '').toLowerCase(); }
  catch { return undefined; }
  if (segment === 'cogpsych') {
    history.replaceState({ sec: 'academy' }, '', '/academy');
    return 'academy';
  }
  if (RETIRED_PATHS.has(segment)) {
    history.replaceState({ sec: 'mission' }, '', '/');
    return undefined;
  }
  return PATH_SEC[segment];
}
async function routeFromUrl() {
  const key = sectionFromPath();
  return key ? openSection(key) : false;
}

let _routerReady = false;
function initRouter() {
  if (_routerReady) return;
  _routerReady = true;
  window.addEventListener('popstate', async () => {
    if (!(await routeFromUrl())) renderMission();
  });
}

async function loadSpecialty(key) {
  if (store.cache[key]) return store.cache[key];
  const r = await fetch(`data/${key}.json${['cardiology','emergency-medicine','neurology'].includes(key)?'?v=4':''}`);
  if (!r.ok) throw new Error(`no data for ${key}`);
  const data = await r.json();
  store.cache[key] = data;
  return data;
}

// index.json (~600KB) is only needed inside Practice (mixed cases + review/search), not on the
// landing page. Load it lazily off the critical path and memoize.
async function ensureIndex() {
  if (store.index) return store.index;
  try { store.index = await fetch('data/index.json?v=2').then(r => r.ok ? r.json() : null); }
  catch { store.index = null; }
  return store.index;
}

/* ---------- shared chrome ---------- */

function topbar(active) {
  const t = totals();
  const streak = store.streak.current > 0 ? `${store.streak.current}&#128293; &middot; ` : '';
  const stat = t.answered ? `${streak}${t.xp.toLocaleString()} XP` : '';
  const menuActive = key => active === key ? ' active' : '';
  const menuCurrent = key => active === key ? ' aria-current="page"' : '';
  const root = el(`<header class="topbar mainbar">
    <a class="skip-link" href="#main">Skip to content</a>
    <a class="wordmark" href="#">${MARK_SVG}<span class="wm-name">Cortex <span class="wm-sub">Medical Academy</span></span></a>
    <nav class="nav">
      <div class="navmenu">
        <button class="navlink menubtn ${['mcat', 'stats'].includes(active) ? 'active' : ''}" data-menu="mcat" data-nav-menu aria-label="MCAT" aria-expanded="false" aria-controls="mcat-panel">MCAT<span class="caret">&#9662;</span></button>
        <div class="menupanel mcat-menupanel" id="mcat-panel" aria-label="MCAT navigation" hidden>
          <div class="menu-grid">
            <section class="menu-group" aria-labelledby="mcat-menu-title">
              <span class="menu-head" id="mcat-menu-title">MCAT</span>
              <button class="menuitem${menuActive('mcat')}" data-go="mcat"${menuCurrent('mcat')}>
                <span class="mi-copy"><span class="mi-name">MCAT Prep</span><span class="mi-desc">Forever-free study suite</span></span>
              </button>
              <button class="menuitem${menuActive('stats')}" data-go="stats"${menuCurrent('stats')}>
                <span class="mi-copy"><span class="mi-name">Progress</span><span class="mi-desc">Lessons, practice &amp; saved work</span></span>
              </button>
            </section>
          </div>
        </div>
      </div>
      <button class="navlink ${active === 'practice' ? 'active' : ''}" data-go="practice" aria-label="Clinical Scenarios"><span class="clinical-nav-full" aria-hidden="true">Clinical Scenarios</span><span class="clinical-nav-short" aria-hidden="true">Clinical</span></button>
      <button class="navlink ${active === 'socrates' ? 'active' : ''}" data-go="socrates" aria-label="Learn to Learn" aria-description="${COMING_SOON.has('socrates') ? 'Coming soon' : 'Learning course'}"><span class="learn-nav-full" aria-hidden="true">Learn to Learn</span><span class="learn-nav-short" aria-hidden="true">Learn</span>${COMING_SOON.has('socrates') ? '<span class="nav-availability">Coming soon</span>' : ''}</button>
      <div class="navmenu">
        <button class="navlink menubtn ${['academy', 'anatomy', 'reference', 'utsa', 'pomodoro'].includes(active) ? 'active' : ''}" data-menu="explore" data-nav-menu aria-label="Explore" aria-expanded="false" aria-controls="explore-panel">Explore<span class="caret">&#9662;</span></button>
        <div class="menupanel" id="explore-panel" aria-label="Explore Cortex" hidden>
          <div class="menu-intro">
            <span class="menu-title">Explore Cortex</span>
            <span class="menu-desc">Choose a learning path or open a study tool.</span>
          </div>
          <div class="menu-grid">
            <section class="menu-group" aria-labelledby="menu-study-title">
              <span class="menu-head" id="menu-study-title">Learning paths</span>
              <button class="menuitem${menuActive('academy')}" data-go="academy"${menuCurrent('academy')}>
                <span class="mi-copy"><span class="mi-name">All courses</span><span class="mi-desc">Find your path through the Academy</span></span>
              </button>
              <button class="menuitem${menuActive('anatomy')}" data-go="anatomy"${menuCurrent('anatomy')}>
                <span class="mi-copy"><span class="mi-name">Anatomy</span><span class="mi-desc">Visual recall lab</span></span>
                ${sectionMenuTag('anatomy')}
              </button>
              <button class="menuitem${menuActive('reference')}" data-go="reference"${menuCurrent('reference')}>
                <span class="mi-copy"><span class="mi-name">Medicine</span><span class="mi-desc">Pharm, micro, labs &amp; ECG</span></span>
                ${sectionMenuTag('reference')}
              </button>
            </section>
          </div>
          <div class="menu-quick" aria-label="Tools and access">
            <button class="menuquick" data-academy-view="today">Academy Today</button>
            <button class="menuquick" data-academy-view="portfolio">My private portfolio</button>
            <button class="menuquick${menuActive('pomodoro')}" data-go="pomodoro"${menuCurrent('pomodoro')}>Focus timer</button>
            <button class="menuquick${menuActive('utsa')}" data-go="utsa"${menuCurrent('utsa')}>UTSA &amp; UT Health</button>
          </div>
        </div>
      </div>
    </nav>
    <div class="bar-right">
      <button class="navlink special ${active === 'neuro' ? 'active' : ''}" data-go="neuro" title="${COMING_SOON.has('neuro') ? 'Neuroengineering · Under construction' : 'Neuroengineering'}"><svg class="neuro-ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2L17 6V14L10 18L3 14V6Z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg><span class="neuro-label">Neuro<span class="nl-rest">engineering</span>${COMING_SOON.has('neuro') ? '<span class="nav-availability">In review</span>' : ''}</span></button>
      ${stat ? `<span class="topstat">${stat}</span>` : ''}<a class="xlink" href="${X_URL}" target="_blank" rel="noopener" title="Constant Cortex updates on X · @${X_HANDLE}" aria-label="Constant Cortex updates on X · @${X_HANDLE}">${X_SVG}</a><button class="acctbtn" data-acct hidden>Sign in</button><button class="ver${hasUnseenUpdate() ? ' ver-hasnew' : ''}" data-go="updates" title="What’s new">v${APP_VERSION}</button>
    </div>
  </header>`);
  root.dataset.section = active;
  root.querySelector('.wordmark').addEventListener('click', e => { e.preventDefault(); renderMission(); });
  root.querySelectorAll('[data-go]').forEach(button => {
    button.addEventListener('click', () => navigateSection(button.dataset.go));
  });
  root.querySelectorAll('[data-academy-view]').forEach(button => {
    button.addEventListener('click', () => {
      const url = new URL(sectionUrl('academy'), location.origin);
      url.searchParams.set('view', button.dataset.academyView);
      history.pushState({ sec: 'academy' }, '', url.pathname + url.search);
      openSection('academy');
    });
  });
  const navmenus = [...root.querySelectorAll('.navmenu')];
  navmenus.forEach(navmenu => {
    const mbtn = navmenu.querySelector('[data-nav-menu]');
    const panel = navmenu.querySelector('.menupanel');
    const close = () => { panel.hidden = true; mbtn.classList.remove('open'); mbtn.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onEsc); };
    const onDoc = (e) => { if (!navmenu.contains(e.target)) close(); };
    const onEsc = (e) => { if (e.key === 'Escape') { close(); mbtn.focus(); } };
    navmenu.closeMenu = close;
    mbtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (panel.hidden) {
        navmenus.forEach(other => { if (other !== navmenu) other.closeMenu?.(); });
        panel.hidden = false;
        mbtn.classList.add('open');
        mbtn.setAttribute('aria-expanded', 'true');
        document.addEventListener('click', onDoc);
        document.addEventListener('keydown', onEsc);
      }
      else close();
    });
    panel.querySelectorAll('.menuitem, .menuquick').forEach(mi => mi.addEventListener('click', close));
  });
  if (window.refreshAuthUI) window.refreshAuthUI();
  return root;
}

function seenVersion() { try { return localStorage.getItem('cs-seen-ver') || ''; } catch { return ''; } }
function markSeenVersion() { safeSet('cs-seen-ver', APP_VERSION); updateVerBadges(); }
function hasUnseenUpdate() { return seenVersion() !== APP_VERSION; }
function latestRelease() {
  return PUBLIC_CHANGELOG.find(c => c.version === APP_VERSION)
    || PUBLIC_CHANGELOG.find(c => c.version && c.tag !== 'SOON')
    || null;
}
function updateVerBadges() {
  document.querySelectorAll('button.ver').forEach(btn => {
    btn.classList.toggle('ver-hasnew', hasUnseenUpdate());
    btn.title = "What’s new";
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
  if (typeof stopPythonCode === 'function') stopPythonCode();
  window.AcademyConnect?.attach(node);
  // Every full view gets the site footer; skip if the view already appended one.
  if (typeof siteFooter === 'function' && !node.querySelector('.sitefoot')) node.appendChild(siteFooter());
  $app.replaceChildren(node);
  window.scrollTo(0, 0);
  const mainEl = node.querySelector('main');
  if (mainEl && !mainEl.id) mainEl.id = 'main';
  const section = node.querySelector('header')?.dataset.section;
  const title = CortexAcademy.tracks.find(track => track.id === section)?.name
    || node.querySelector('h1')?.textContent.trim() || 'Study';
  document.title = title + ' | Cortex Medical Academy';
  const ft = node.querySelector('h1') || mainEl || node;
  if (ft && ft.focus) { ft.setAttribute('tabindex', '-1'); ft.focus({ preventScroll: true }); }
  announceView(node);
  setupCountUps(node); revealOnScroll(node);
  if (window.refreshAuthUI) window.refreshAuthUI(); if (window.pomoSync) window.pomoSync(document.title); updateVerBadges();
  window.McatRehearsal?.recordDisplay(node);
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
    ['Everything, unlocked', 'Every part of Cortex is open to students and trainees at UTSA and UT Health San Antonio in full, at no cost, for as long as they are there. The Academy is free for everyone right now; this is a standing promise that it stays that way for the two schools closest to home.'],
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
  if (typeof renderNeuroEngineering === 'function') return renderNeuroEngineering({ fromUrl: true });
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
    <p class="sf-legal">&copy; ${yr} Cortex Medical Academy &middot; v${APP_VERSION} &middot; Last updated ${PUBLIC_CHANGELOG[0].date} &middot; Original study content with guided self-review. Not a substitute for official AAMC materials or clinical judgment.</p>
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
  document.querySelectorAll('[data-visit-summary]').forEach(e => e.hidden = false);
  document.querySelectorAll('.js-visits').forEach(e => {
    if (e.dataset.cnt === String(visitCount)) return;   // don't re-animate the same value
    e.dataset.cnt = String(visitCount);
    animateCount(e, visitCount);
  });

}

const PRINCIPLES = [
  ['Understand the idea', 'Start with mechanisms, clear explanations, and worked examples.'],
  ['Use what you learn', 'Make a prediction, reason through a passage, or work a clinical case.'],
  ['Return and build', 'Review your reasoning, revisit difficult concepts, and resume saved work.'],
];

/* CHANGELOG lives in changelog.js (loaded by index.html before this file). */
// What's New lists shipped releases only; LOCAL-tagged entries are unshipped work.
const PUBLIC_CHANGELOG = CHANGELOG.filter(release => release.tag !== 'LOCAL');

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
  const latest = PUBLIC_CHANGELOG[0];
  const showFeatured = latest && latest.version && latest.tag !== 'SOON';
  const history = showFeatured ? PUBLIC_CHANGELOG.slice(1) : PUBLIC_CHANGELOG;
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
      <p class="sub">Public release history &mdash; everything below loads with the page.</p>
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
  ++_sectionRequest;
  stopTimer(); session = null;
  const gates = new URLSearchParams(location.search).get('gates') === 'prod';
  const homePath = '/' + (gates ? '?gates=prod' : '');
  if (location.pathname !== '/') history.pushState({ sec:'mission' }, '', homePath);
  const previewQuery = gates ? '&gates=prod' : '';
  const root = el('<div></div>');
  root.appendChild(topbar('mission'));
  const main = el(`<main class="panel mission academy-home">
    <section class="mission-hero">
      <div class="mission-hero-grid">
        <div class="mission-hero-copy">
          <span class="mcat-eyebrow">Cortex Medical Academy</span>
          <h1>Master the<br> human machine.</h1>
          <p class="mission-lede">Understand the science. Put it into practice. Free MCAT preparation and clinical case learning for the work ahead.</p>
          <div class="mcat-cta">
            <button class="btn btn-solid" id="m-mcat">Open MCAT prep →</button>
            <button class="btn" id="m-quick">Try a 5-minute session</button>
          </div>
          <p class="academy-promise">MCAT is free forever. Start without an account.</p>
        </div>
        <aside class="academy-workspace" aria-labelledby="academy-workspace-title">
          <div class="academy-workspace-head"><span class="label">Inside MCAT 2.0</span><span class="academy-edition">BETA</span></div>
          <h2 id="academy-workspace-title">Your MCAT workspace.</h2>
          <p>From your first lesson to your next practice session.</p>
          <div class="academy-workspace-links">
            <a href="/mcat?view=course${previewQuery}"><span><strong>Build your foundation</strong><small>45 lessons across 15 chapters</small></span><span aria-hidden="true">↗</span></a>
            <a href="/mcat?view=practice${previewQuery}"><span><strong>Practice your reasoning</strong><small>Science, CARS, and quantitative skills</small></span><span aria-hidden="true">↗</span></a>
            <a href="/mcat?view=weekly${previewQuery}"><span><strong>Make time for progress</strong><small>A weekly plan around your availability</small></span><span aria-hidden="true">↗</span></a>
          </div>
        </aside>
      </div>
    </section>

    <section class="academy-clinical" aria-labelledby="academy-clinical-title">
      <div class="academy-clinical-copy">
        <span class="label">Clinical Scenarios</span>
        <h2 id="academy-clinical-title">Put your reasoning<br> to work.</h2>
        <p>Meet a patient, gather the findings, and decide what comes next. Compare your decisions and written note with a model response.</p>
        <button class="btn" id="m-cases" data-go="practice">Explore clinical cases →</button>
      </div>
      <ol class="academy-case-steps" aria-label="Inside a Clinical Shift">
        <li><span class="academy-step-index" aria-hidden="true">01</span><div><h3>Gather the story</h3><p>Choose interview questions and focused examinations.</p></div></li>
        <li><span class="academy-step-index" aria-hidden="true">02</span><div><h3>Make the call</h3><p>Weigh the findings, rank a differential, and write your note.</p></div></li>
        <li><span class="academy-step-index" aria-hidden="true">03</span><div><h3>Review your reasoning</h3><p>Compare with a model and work through the debrief.</p></div></li>
      </ol>
    </section>

    <section class="academy-method" aria-labelledby="academy-method-title">
      <div class="academy-section-heading"><span class="label">How learning works here</span><h2 id="academy-method-title">Build understanding.<br> Then build on it.</h2></div>
      <div class="academy-principles">${PRINCIPLES.map((p,i) => `<article><span class="label">0${i+1}</span><h3>${p[0]}</h3><p>${p[1]}</p></article>`).join('')}</div>
    </section>

    <section class="academy-mission" aria-labelledby="academy-mission-title">
      <div><span class="label">Why Cortex exists</span><h2 id="academy-mission-title">Opportunity should<br> stay open.</h2></div>
      <div class="academy-founder-copy"><p>I started Cortex on a simple first-principles conviction: the path into medicine should never be decided by how much money you have.</p><p class="academy-founder-sign">Kevin Vigil<span>Founder, Cortex Medical Academy</span></p><div class="academy-reach" data-visit-summary hidden><span class="js-visits"></span><span>visits to Cortex</span></div></div>
    </section>

    <section class="mcat-closing academy-closing">
      <div><span class="label">Start where you are</span><h2>Your next step starts here.</h2><p>Choose a lesson, plan a session, or pick up your saved work.</p></div>
      <div class="academy-closing-actions"><button class="btn btn-solid" id="m-enter">Open MCAT prep →</button><button class="ghostbtn" id="m-updates">See what’s new ↗</button></div>
    </section>
  </main>`);

  main.querySelector('#m-quick').addEventListener('click', async () => {
    const button = main.querySelector('#m-quick');
    button.disabled = true; button.textContent = 'Opening session…';
    try { await ensureSection('mcat'); await startMcatQuickSession(); }
    catch { button.disabled = false; button.textContent = 'Retry 5-minute session'; }
  });
  main.querySelector('#m-mcat').addEventListener('click', gotoMCAT);
  main.querySelector('#m-cases').addEventListener('click', renderHome);
  main.querySelector('#m-enter').addEventListener('click', gotoMCAT);
  main.querySelector('#m-updates').addEventListener('click', renderUpdates);
  root.appendChild(main);
  root.appendChild(siteFooter());
  setView(root);
  updateVisitUI();
}

/* ---------- home / practice ---------- */

function renderHome() {
  stopTimer();
  session = null;
  ensureSection('practice').then(() => {
    if (typeof window.renderClinicalShift === 'function') window.renderClinicalShift();
    else renderClinicalCaseBank();
  }).catch(error => {
    console.error('Clinical Shift load failed', error);
    renderClinicalCaseBank();
  });
}

function renderClinicalCaseBank() {
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
  main.querySelector('#reset').addEventListener('click', () => openResetProgress());

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
        ${c.sources?.length?`<details class="block"><summary>Sources and review status</summary><p class="prose">Authored version ${esc(c.revision||1)}. Independent clinician review is pending. Prior case totals can include earlier wording.</p><ul>${c.sources.filter(source=>/^https:\/\//.test(source.url)).map(source=>`<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a></li>`).join('')}</ul></details>`:''}
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
  row.addEventListener('click', entry.onOpen || (() => startCaseById(entry.id, entry.key)));
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
      <p class="mcat-lede">Open a saved Clinical Shift or practice a case again. Search by symptom, diagnosis, or specialty.</p>
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
    <div class="searchbox cs-searchbox" style="display:none"><input type="text" id="q" aria-label="Search clinical cases" placeholder="Search by symptom, diagnosis, or specialty&hellip;" autocomplete="off"></div>
    <div class="rows cs-rows cornerframe" id="rows"></div>
  </main>`);

  main.querySelectorAll('.tab[data-tab]').forEach(b => b.addEventListener('click', () => renderReview(b.dataset.tab)));
  main.querySelectorAll('[data-scn]').forEach(b => b.addEventListener('click', () => b.dataset.scn === 'practice' ? renderHome() : null));
  const rows = main.querySelector('#rows');
  const sb = main.querySelector('.searchbox');

  if (tab === 'history') {
    if (!store.history.length) rows.appendChild(emptyMsg('No cases yet — start a Clinical Scenario.'));
    else store.history.slice(0, 100).forEach(h => rows.appendChild(caseRow({
      id: h.id, key: h.key, title: titleFor(h.id), difficulty: '',
      rightHtml: `${scorePill(h.c, h.t)}<span class="row-when">${relTime(h.ts)} · ${h.shift ? 'Saved shift' : 'Practice again'}</span>`,
      onOpen: h.shift && typeof window.openClinicalShiftHistory === 'function' ? () => window.openClinicalShiftHistory({ caseId: h.id, ts: h.ts }) : undefined,
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

// Stats-page reader for the Performance Drugs course. Reads saved progress directly because
// performance-drugs.js (which owns pedStatsSnapshot) is only loaded inside the Medicine section.
function pedStatsFromStorage() {
  const raw = loadJSON('cs-ped', null);
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
  const knownProjects = ['neural-signal-viewer', 'spike-detector', 'noise-smoother', 'leftright-decoder', 'cursor-simulator', 'closed-loop-capstone'];
  const msPassed = knownProjects.filter(id => { const item = prog.projects?.[id]; return [...(Array.isArray(item?.history) ? item.history : []), item?.current].some(work => Number.isFinite(work?.completedAt)); }).length;
  const msLegacy = knownProjects.filter(id => prog.milestones?.[id]?.passed).length;
  const codeDone = Object.values(prog.code || {}).filter(v => v === true || v?.passed).length;
  const simDone = new Set([...Object.keys(prog.sims || {}).filter(id => prog.sims[id]?.ok), ...Object.keys(prog.simWork || {}).filter(id => prog.simWork[id]?.completedAt)]).size;
  const quizDone = Object.keys(prog.topicQuiz || {}).length;
  const has = pathDone > 0 || quizDone > 0 || codeDone > 0 || simDone > 0 || msPassed > 0 || msLegacy > 0;
  return {
    pathDone, pathTotal, pathPct: pathTotal ? Math.round(100 * pathDone / pathTotal) : 0,
    msPassed, msLegacy, msTotal: 6, codeDone, codeTotal: 13, simDone, simTotal: 15, quizDone, has,
  };
}

async function renderStats() {
  stopTimer(); session = null;
  await ensureSection('mcat');
  await loadMCAT();
  courseGo('progress');
}

function renderAcademyStats() {
  stopTimer(); session = null;
  const t = totals();
  const ps = pomoStatsSnapshot();
  const ns = neuroStatsSnapshot();
  const ph = pharmStatsSnapshot();
  const pd = pedStatsFromStorage();
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
    <div class="hero"><h1>Academy activity.</h1><p class="sub">Clinical scenarios and other study tools.</p></div>

    <div class="statblock">
      <span class="label">MCAT learning record</span>
      <p>Lessons, practice, math and unfinished sessions share one progress page.</p>
      <button class="btn btn-solid" id="stats-mcat">Open MCAT progress →</button>
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
        <div class="metric"><span class="m-num" data-countup="${ns.msPassed}">${ns.msPassed || '&mdash;'}</span><span class="m-lab">Project comparisons</span><span class="m-sub">of ${ns.msTotal} · ${ns.msLegacy} earlier output checks kept</span></div>
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
  if (mcatBtn) mcatBtn.addEventListener('click', renderStats);
  const pomoBtn = main.querySelector('#stats-pomo');
  if (pomoBtn) pomoBtn.addEventListener('click', () => { if (typeof renderPomodoro === 'function') renderPomodoro(); });
  const neuroBtn = main.querySelector('#stats-neuro');
  if (neuroBtn) neuroBtn.addEventListener('click', () => { if (typeof renderNeuro === 'function') renderNeuro(); });
  const openMedicineTool = async (open) => {
    if (COMING_SOON.has('reference')) { renderComingSoon('reference'); return; }
    await ensureSection('reference');
    await open();
  };
  const medPathBtn = main.querySelector('#stats-medpath');
  if (medPathBtn) medPathBtn.addEventListener('click', () => openMedicineTool(async () => {
    if (typeof renderReference === 'function') await renderReference();
  }));
  const pharmBtn = main.querySelector('#stats-pharm');
  if (pharmBtn) pharmBtn.addEventListener('click', () => openMedicineTool(() => {
    renderRefSet('pharm', 'classes');
  }));
  const pedBtn = main.querySelector('#stats-ped');
  if (pedBtn) pedBtn.addEventListener('click', () => openMedicineTool(() => {
    renderPerformanceDrugs('hub');
  }));
  const microBtn = main.querySelector('#stats-micro');
  if (microBtn) microBtn.addEventListener('click', () => openMedicineTool(() => {
    renderRefSet('micro', 'learn');
  }));
  const labsBtn = main.querySelector('#stats-labs');
  if (labsBtn) labsBtn.addEventListener('click', () => openMedicineTool(() => {
    renderRefSet('labs', 'learn');
  }));
  const ekgBtn = main.querySelector('#stats-ekg');
  if (ekgBtn) ekgBtn.addEventListener('click', () => openMedicineTool(() => {
    renderEKG('library');
  }));

  root.appendChild(main);
  setView(root);
}

/* ---------- keyboard ---------- */

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
  if (typing) return;
  if (document.querySelector('.modal, .fbmodal-back, dialog[open]')) return;   // don't drive the screen behind an open overlay

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
