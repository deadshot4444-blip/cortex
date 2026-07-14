/* ============================================================================
   Cortex · Medical Assistant  —  the CCMA exam mastery
   Password-gated, arcade-style mastery trainer built on science-of-learning
   principles: active recall (testing effect), spaced repetition (Leitner
   boxes), interleaving, and targeted practice on measured weaknesses.

   Self-contained: uses app.js globals (el, esc, setView, topbar, siteFooter).
   Progress lives in localStorage['cs-ccma'] — fully separate from
   clinical / MCAT / genetics progress. Bank accumulates by chapter.
   ========================================================================= */

const CCMA_DIAGRAMS = []; // reserved for inline-SVG diagram questions (bank uses the CCMA_FIGS registry)


/* ---------- generated + verified MCQ bank (from data/ccma-bank.json) ---------- */
let CCMA_GENERATED = [];   // loaded from data/ccma-bank.json

/* ---------- small helpers ---------- */
function ccmaRand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
const CCMA_GENERATORS = []; // no procedural generators — Medical Assistant uses the static bank


let CCMA_BANK = CCMA_DIAGRAMS.concat(CCMA_GENERATORS);   // CCMA_GENERATED merged in after ccmaLoadBank()

/* ---------- topic metadata (for weakness reporting) ----------
   Slugs are chXX-<slug>; the bank's `topic` field must match a key here or the
   item is dropped by ccmaValidBankItem. Add chapters by appending topics + CCMA_CH. */
const CCMA_TOPICS = {
  // NHA domains (chapter = domain number). Mock bank + study bank both map here.
  'd1-foundations': { name: 'Foundations & Basic Science', ch: 1, blurb: 'MA scope, credentials, care settings, payment models, medical terminology roots/prefixes/suffixes, Do Not Use list, body planes/cavities, homeostasis.' },
  'd1-terminology': { name: 'Medical Terminology', ch: 1, blurb: 'Word building, common abbreviations, TJC Do Not Use list, lay vs medical terms.' },
  'd2-anatomy': { name: 'Anatomy & Physiology', ch: 2, blurb: 'Organ systems overview, common diseases signs/symptoms, directional terms, body structure.' },
  'd3-intake-vitals': { name: 'Patient Intake & Vitals', ch: 3, blurb: 'Chief complaint, history, height/weight/BMI, temp/pulse/resp/BP/SpO2, pain scales, documentation.' },
  'd3-general-care': { name: 'General Patient Care', ch: 3, blurb: 'Exam prep, positions, specialty exams, procedures, patient education basics, assist provider.' },
  'd3-infection': { name: 'Infection Control & Safety', ch: 3, blurb: 'Chain of infection, hand hygiene, PPE, standard/transmission precautions, sterilization, sharps, SDS, OSHA.' },
  'd3-lab': { name: 'Point-of-Care & Lab', ch: 3, blurb: 'CLIA-waived tests, specimen collection/labeling, chain of custody, quality control, POL.' },
  'd3-phlebotomy': { name: 'Phlebotomy', ch: 3, blurb: 'Order of draw, tubes/additives, venipuncture, capillary, complications, ID, tourniquet timing.' },
  'd3-ekg': { name: 'EKG & Cardiovascular', ch: 3, blurb: 'Lead placement, waveforms, artifacts, rate calculation, patient prep, Holter.' },
  'd4-education': { name: 'Care Coordination & Education', ch: 4, blurb: 'Teaching plans, health literacy, referrals, community resources, care transitions.' },
  'd5-admin': { name: 'Administrative Assisting', ch: 5, blurb: 'Scheduling, medical records, coding/billing basics, insurance, claims, office finance.' },
  'd6-communication': { name: 'Communication & Customer Service', ch: 6, blurb: 'Therapeutic communication, defense mechanisms, telephone, written comms, difficult patients, cultural competence.' },
  'd7-law': { name: 'Medical Law & Ethics', ch: 7, blurb: 'HIPAA, consent, negligence, scope of practice, mandatory reporting, ethics, advance directives.' },
  'd3-pharm': { name: 'Pharmacology & Meds', ch: 3, blurb: 'Drug classes, rights of medication, routes, dosage calc, storage, controlled substances.' },
  'd3-emergency': { name: 'Emergencies & First Aid', ch: 3, blurb: 'Office emergencies, BLS basics, shock, bleeding, allergic reaction, mental health crisis.' },
  'mock-mixed': { name: 'Mock Exam Mixed', ch: 8, blurb: 'Cross-domain items drawn from your full CCMA mock final — real exam-simulation practice.' },
};

const CCMA_CH = {
  1: 'Foundational Knowledge & Basic Science',
  2: 'Anatomy & Physiology',
  3: 'Clinical Patient Care',
  4: 'Patient Care Coordination & Education',
  5: 'Administrative Assisting',
  6: 'Communication & Customer Service',
  7: 'Medical Law & Ethics',
  8: 'Mock Final Bank',
};

/* ---------- NHA CCMA test-plan blueprint ----------
   The 7 official knowledge domains (mapped to chapters 1-7) and their share of the
   scored items on the real exam. Drives the home blueprint panel + how the full Mock
   Exam and Exam Boss sample questions, so practice mirrors the actual test weighting.
   Weights are filled in from the verified NHA test plan below. */
// Weights = current NHA CCMA test plan (2022 job analysis): scored items per domain / 150.
// pct rounded for display; items = official scored-item count (sums to 150). Verified against
// nhanow.com/docs/default-source/test-plans/nha_ccma_test_plan_2022.pdf.
const CCMA_BLUEPRINT = [
  { ch: 1, name: 'Foundational Knowledge & Basic Science', pct: 10, items: 15, blurb: 'Health systems & MA scope, medical terminology, basic pharmacology, nutrition, psychology.' },
  { ch: 2, name: 'Anatomy & Physiology', pct: 5, items: 8, blurb: 'Body structures & organ systems, directional terms & planes, pathophysiology of common diseases.' },
  { ch: 3, name: 'Clinical Patient Care', pct: 56, items: 84, blurb: 'THE big one — intake & vitals, general patient care, infection control, POC/lab, phlebotomy, EKG.' },
  { ch: 4, name: 'Patient Care Coordination & Education', pct: 8, items: 12, blurb: 'Care transitions, preventive-screening tracking, referrals, patient education & teach-back.' },
  { ch: 5, name: 'Administrative Assisting', pct: 8, items: 12, blurb: 'Scheduling models, EHR/records, insurance & prior auth, ICD-10 vs CPT coding, billing.' },
  { ch: 6, name: 'Communication & Customer Service', pct: 8, items: 12, blurb: 'Therapeutic communication, active listening, cultural competence, de-escalation, professionalism.' },
  { ch: 7, name: 'Medical Law & Ethics', pct: 5, items: 7, blurb: 'HIPAA, consent, MA scope of practice, negligence/malpractice, advance directives, mandatory reporting.' },
];
// Real NHA CCMA exam facts (verified test plan) — shown in the Exam Day brief.
const CCMA_EXAM = { scored: 150, pretest: 30, total: 180, minutes: 180, passScaled: 390, scaleMin: 200, scaleMax: 500, passRawPct: 78 };
function ccmaBlueprintFor(ch) { return CCMA_BLUEPRINT.find(d => d.ch === ch) || null; }
// Build a blueprint-weighted question set: sample each domain proportional to its exam weight.
function ccmaBlueprintPool(total) {
  const seen = new Set(); let pool = [];
  CCMA_BLUEPRINT.forEach(d => {
    const want = Math.max(1, Math.round(total * d.pct / 100));
    ccmaShuffle(ccmaChapterQs(d.ch)).slice(0, want).forEach(q => { if (!seen.has(q.id)) { seen.add(q.id); pool.push(q); } });
  });
  if (pool.length < total) pool = pool.concat(ccmaShuffle(CCMA_BANK).filter(q => !seen.has(q.id)).slice(0, total - pool.length));
  return ccmaShuffle(pool).slice(0, total);
}


/* ---------- state + persistence ---------- */
const CCMA_KEY = 'cs-ccma';
const CCMA_PASS = '1234';
// Bump ONLY on a hard content reset -> XP/rank/mastery reset fresh. Adding chapters keeps this stable
// (the bank just grows), so accumulated progress across chapters is preserved.
const CCMA_MODULE = 'ccma-v1';
function ccmaLoad() { try { return JSON.parse(localStorage.getItem(CCMA_KEY)) || {}; } catch { return {}; } }
let CCMA = Object.assign({
  unlocked: false, module: '', xp: 0, answered: 0, correct: 0,
  bestScore: 0, bestCombo: 0, bestExam: 0, bestMock: 0, plays: 0,
  streak: { current: 0, longest: 0, lastDate: '' },
  q: {},            // qid -> { box: 0..5, a, c, ts }
  ach: [], examReady: false, starred: {}, learned: {},
}, ccmaLoad());
// Module changed since last visit -> wipe progress so rank/XP/mastery reflect THIS module only (keep unlock).
if (CCMA.module !== CCMA_MODULE) {
  CCMA = {
    unlocked: CCMA.unlocked, module: CCMA_MODULE,
    xp: 0, answered: 0, correct: 0, bestScore: 0, bestCombo: 0, bestExam: 0, bestMock: 0, plays: 0,
    streak: { current: 0, longest: 0, lastDate: '' },
    q: {}, ach: [], examReady: false, starred: {}, learned: {},
  };
  try { localStorage.setItem(CCMA_KEY, JSON.stringify(CCMA)); } catch {}
}
function ccmaSave() { try { localStorage.setItem(CCMA_KEY, JSON.stringify(CCMA)); } catch {} }

/* ---------- anonymous usage analytics (research) ----------
   Write-only to Supabase `usage_events`. No names / PII — a random per-browser id
   only. Fire-and-forget; never blocks or breaks the UI if offline/unconfigured.   */
function ccmaRandId() {
  try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch {}
  return 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
const CCMAA_ANON = (() => { try { let a = localStorage.getItem('cs-anon-id'); if (!a) { a = ccmaRandId(); localStorage.setItem('cs-anon-id', a); } return a; } catch { return ccmaRandId(); } })();
const CCMAA_SESSION = ccmaRandId();
let CCMAA_sessionLogged = false;
function ccmaTrack(event, props) {
  try {
    const sb = window.__cortexSB;
    if (!sb || !sb.from) return;
    sb.from('usage_events').insert({
      anon_id: CCMAA_ANON,
      session_id: CCMAA_SESSION,
      app_version: (typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''),
      section: 'ccma',
      event,
      props: props || {},
    }).then(() => {}, () => {});   // fire-and-forget
  } catch {}
}

let ccmaTimer = null;
let ccmaKeyHandler = null;
function ccmaUnbindKey() { if (ccmaKeyHandler) { document.removeEventListener('keydown', ccmaKeyHandler); ccmaKeyHandler = null; } }
function ccmaBindKey(fn) { ccmaUnbindKey(); ccmaKeyHandler = fn; document.addEventListener('keydown', fn); }
// every view transition runs ccmaClearTimer() first, so this is the single chokepoint that
// also tears down the previous question's keydown handler (prevents stale-handler leaks).
function ccmaClearTimer() { if (ccmaTimer) { clearInterval(ccmaTimer); ccmaTimer = null; } ccmaUnbindKey(); }

/* ---------- spaced-repetition box model ---------- */
const CCMA_INTERVAL_H = [0, 0.3, 4, 24, 72, 168]; // Leitner review intervals (hours) by box
function ccmaQ(id) { return CCMA.q[id] || (CCMA.q[id] = { box: 0, a: 0, c: 0, ts: 0 }); }
function ccmaBox(id) { return (CCMA.q[id] && CCMA.q[id].box) || 0; }
function ccmaComp(list) { if (!list.length) return 0; return Math.round(list.reduce((s, q) => s + ccmaBox(q.id), 0) / (list.length * 5) * 100); }
function ccmaChapterQs(ch) { return CCMA_BANK.filter(q => q.chapter === ch); }
function ccmaTopicQs(t) { return CCMA_BANK.filter(q => q.topic === t); }
function ccmaMastery(ch) { return ccmaComp(ccmaChapterQs(ch)); }
function ccmaOverall() { return ccmaComp(CCMA_BANK); }
function ccmaAccuracy() { return CCMA.answered ? Math.round(CCMA.correct / CCMA.answered * 100) : 0; }

function ccmaStatus() {
  const c = ccmaOverall();
  if (c >= 90) return { c, label: 'EXAM READY', cls: 'ready' };
  if (c >= 75) return { c, label: 'Almost exam ready', cls: 'almost' };
  if (c >= 50) return { c, label: 'Solid progress', cls: 'building' };
  if (c > 0) return { c, label: 'Getting started', cls: 'start' };
  return { c, label: 'Not started', cls: 'none' };
}

/* weakest topics first (only count topics that exist in the bank) */
function ccmaWeakTopics() {
  return Object.keys(CCMA_TOPICS)
    .map(t => { const qs = ccmaTopicQs(t); return { topic: t, name: CCMA_TOPICS[t].name, ch: CCMA_TOPICS[t].ch, comp: ccmaComp(qs), n: qs.length, seen: qs.filter(q => { const r = CCMA.q[q.id]; return r && r.a > 0; }).length }; })
    .filter(x => x.n > 0)
    .sort((a, b) => a.comp - b.comp || b.n - a.n);
}

/* adaptive selection: weak + unseen + due-for-review, interleaved */
function ccmaSmartPool(n) {
  const now = Date.now();
  const scored = CCMA_BANK.map(q => {
    const r = CCMA.q[q.id], box = r ? r.box : 0, ts = r ? r.ts : 0;
    const ageH = ts ? (now - ts) / 3.6e6 : 1e6;
    const due = box === 0 || ageH >= CCMA_INTERVAL_H[box];
    const pr = (5 - box) * 12 + (box === 0 ? 40 : 0) + (due ? 8 : -40) + Math.random() * 6;
    return { q, pr };
  });
  scored.sort((a, b) => b.pr - a.pr);
  return ccmaShuffle(scored.slice(0, Math.max(n, 1)).map(s => s.q)); // interleave the chosen set
}

function ccmaShuffle(a) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

/* ---------- ranks ---------- */
const CCMA_RANKS = [
  { min: 0, name: 'Student' }, { min: 150, name: 'Trainee' }, { min: 400, name: 'Front Desk' },
  { min: 800, name: 'Office Pro' }, { min: 1400, name: 'Clinical Tech' }, { min: 2200, name: 'Procedural Pro' },
  { min: 3200, name: 'Clinical MA' }, { min: 4500, name: 'CCMA Expert' }, { min: 6200, name: 'Exam Destroyer' },
  { min: 8500, name: 'CCMA Master' },
];
function ccmaRank(xp) {
  let idx = 0; for (let i = 0; i < CCMA_RANKS.length; i++) if (xp >= CCMA_RANKS[i].min) idx = i;
  const cur = CCMA_RANKS[idx], next = CCMA_RANKS[idx + 1] || null;
  const span = next ? next.min - cur.min : 1, into = next ? xp - cur.min : 1;
  return { lvl: idx + 1, name: cur.name, pct: next ? Math.max(2, Math.round(into / span * 100)) : 100, toNext: next ? next.min - xp : 0, next: next ? next.min : null };
}

/* ---------- achievements ---------- */
const CCMA_ACH = [
  { id: 'first', name: 'First Stick', desc: 'Answer your first question' },
  { id: 'combo5', name: 'On a Roll', desc: 'Reach a 5× combo' },
  { id: 'combo10', name: 'Chain Reaction', desc: 'Reach a 10× combo' },
  { id: 'blitz500', name: 'Blitz Master', desc: 'Score 500+ in one Blitz' },
  { id: 'smart', name: 'Study Smart', desc: 'Finish a Smart Review session' },
  { id: 'perfect', name: 'Flawless', desc: 'Finish a run 100% correct (8+ Q)' },
  { id: 'vitals', name: 'Vitals Ace', desc: 'Reach 100% on Patient Intake & Vitals' },
  { id: 'asepsis', name: 'Asepsis Ace', desc: 'Reach 100% on Infection Control' },
  { id: 'phleb', name: 'Phlebotomy Pro', desc: 'Reach 100% on Phlebotomy' },
  { id: 'exam', name: 'Exam Slayer', desc: 'Beat the Exam Boss (85%+)' },
  { id: 'mock', name: 'Mock Final Killer', desc: 'Score 70%+ on the full Mock Final' },
  { id: 'ready', name: 'CCMA Ready', desc: 'Hit 90% overall competency' },
  { id: 'ccma', name: 'Certification Path', desc: 'Reach the CCMA Expert level' },
  { id: 'blueprint', name: 'Blueprint Balanced', desc: 'Reach 70%+ on all 7 exam domains' },
  { id: 'clinical', name: 'Clinical Crusher', desc: 'Reach 90% on Clinical Patient Care (the biggest domain)' },
  { id: 'mock80', name: 'Pass Line Cleared', desc: 'Score 80%+ on the full NHA Mock Exam' },
];
function ccmaGrant(id) {
  if (CCMA.ach.includes(id)) return;
  CCMA.ach.push(id); ccmaSave();
  const a = CCMA_ACH.find(x => x.id === id);
  if (a) ccmaToast(`Achievement unlocked · ${a.name}`);
}
function ccmaToast(msg) {
  const t = el(`<div class="gen-toast">${esc(msg)}</div>`);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 350); }, 2300);
}
function ccmaCheckAch() {
  if (ccmaComp(ccmaTopicQs('d3-intake-vitals')) >= 100) ccmaGrant('vitals');
  if (ccmaComp(ccmaTopicQs('d3-infection')) >= 100) ccmaGrant('asepsis');
  if (ccmaComp(ccmaTopicQs('d3-phlebotomy')) >= 100) ccmaGrant('phleb');
  if (ccmaRank(CCMA.xp).lvl >= 8) ccmaGrant('ccma');
  if (ccmaOverall() >= 90) { ccmaGrant('ready'); if (!CCMA.examReady) { CCMA.examReady = true; ccmaSave(); ccmaTrack('milestone', { kind: 'exam_ready', competency: ccmaOverall() }); } }
  if (CCMA_BLUEPRINT.every(d => ccmaMastery(d.ch) >= 70)) ccmaGrant('blueprint');
  if (ccmaMastery(3) >= 90) ccmaGrant('clinical');
}

function ccmaBumpStreak() {
  const d = new Date(), today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const s = CCMA.streak; if (s.lastDate === today) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  s.current = s.lastDate === `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}` ? s.current + 1 : 1;
  s.lastDate = today; if (s.current > s.longest) s.longest = s.current;
}

/* record an answered question; updates box + xp */
function ccmaRecord(qq, right) {
  CCMA.answered++; if (right) CCMA.correct++;
  const r = ccmaQ(qq.id); r.a++; r.ts = Date.now();
  if (right) { r.c++; r.box = Math.min(5, r.box + 1); r.lastWrong = false; } else { r.box = Math.max(0, r.box - 1); r.lastWrong = true; }
  const diff = qq.difficulty === 'hard' ? 6 : qq.difficulty === 'med' ? 3 : 0;
  const xp = right ? 10 + (qq.type === 'calc' ? 5 : qq.type === 'label' ? 3 : 0) + diff : 1;
  CCMA.xp += xp;
  if (!CCMA.ach.includes('first')) ccmaGrant('first');
  return xp;
}

/* ============================================================================
   ENTRY + PASSWORD GATE
   ========================================================================= */
let ccmaBankReady = false, ccmaBankFailed = false;
function ccmaValidBankItem(q, seen) {
  return q && typeof q === 'object'
    && typeof q.id === 'string' && q.id && !seen.has(q.id)
    && typeof q.q === 'string' && q.q
    && typeof q.topic === 'string' && Object.prototype.hasOwnProperty.call(CCMA_TOPICS, q.topic)
    && Array.isArray(q.options) && q.options.length === 4 && q.options.every(o => typeof o === 'string' && o.length)
    && Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3
    && typeof q.explain === 'string' && typeof q.hint === 'string';
}
async function ccmaLoadBank() {
  try {
    const r = await fetch('data/ccma-bank.json?v=4');
    if (!r.ok) throw new Error('http ' + r.status);
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error('bad bank');
    const seen = new Set(CCMA_DIAGRAMS.concat(CCMA_GENERATORS).map(q => q.id)), valid = [];
    for (const q of data) {
      if (!ccmaValidBankItem(q, seen)) continue;
      seen.add(q.id);
      if (q.type !== 'concept' && q.type !== 'calc' && q.type !== 'label') q.type = 'concept';
      if (q.difficulty !== 'easy' && q.difficulty !== 'med' && q.difficulty !== 'hard') q.difficulty = 'med';
      valid.push(q);
    }
    if (data.length && !valid.length) throw new Error('no valid bank items');
    CCMA_GENERATED = valid;
    CCMA_BANK = CCMA_DIAGRAMS.concat(CCMA_GENERATED).concat(CCMA_GENERATORS);
    try {
      const lr = await fetch('data/ccma-lessons.json?v=1');
      if (lr.ok) {
        const L = await lr.json();
        window.CCMA_LESSONS = L.lessons || [];
        window.CCMA_LESSON_TOPIC = {};
        (L.lessons || []).forEach(x => { window.CCMA_LESSON_TOPIC[x.n] = x.topic; });
        if (L.lessonTopic) {
          Object.keys(L.lessonTopic).forEach(k => { window.CCMA_LESSON_TOPIC[+k] = L.lessonTopic[k]; });
        }
      }
    } catch {}
    ccmaBankReady = true; ccmaBankFailed = false;
  } catch (e) { ccmaBankFailed = true; }
}
function ccmaLoadingScreen() {
  const root = el('<div></div>'); root.appendChild(topbar('ccma'));
  root.appendChild(el('<main class="panel gen-lock" id="main" tabindex="-1"><div class="gen-lock-box cornerframe"><span class="label">Medical Assistant</span><p class="gen-lock-sub">Loading questions…</p></div></main>'));
  root.appendChild(siteFooter()); setView(root);
}
function ccmaBankError() {
  const root = el('<div></div>'); root.appendChild(topbar('ccma'));
  const main = el('<main class="panel gen-lock" id="main" tabindex="-1"><div class="gen-lock-box cornerframe"><span class="label">Medical Assistant</span><p class="gen-lock-sub">Couldn\'t load the question bank — check your connection.</p><button class="btn btn-solid" id="gen-retry">Retry</button></div></main>');
  main.querySelector('#gen-retry').addEventListener('click', () => { ccmaBankFailed = false; renderCCMA(); });
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}
function renderCCMA() {
  ccmaClearTimer();
  if (!ccmaBankReady) {
    if (ccmaBankFailed) { ccmaBankError(); return; }
    ccmaLoadingScreen();
    ccmaLoadBank().then(renderCCMA);
    return;
  }
  if (!CCMA_BANK.length) { renderCcmaEmpty(); return; }
  if (CCMA.unlocked) { renderCcmaHome(); return; }
  renderCcmaPassword();
}

function renderCcmaEmpty() {
  ccmaClearTimer();
  const root = el('<div></div>'); root.appendChild(topbar('ccma'));
  const main = el(`<main class="panel gen-lock" id="main" tabindex="-1"><div class="gen-lock-box cornerframe"><span class="label">Medical Assistant</span><h1 class="gen-lock-title">Coming soon</h1><p class="gen-lock-sub">Questions are being added. Check back shortly.</p></div></main>`);
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}
function renderCcmaPassword(errMsg) {
  const root = el('<div></div>');
  root.appendChild(topbar('ccma'));
  const main = el(`<main class="panel gen-lock" id="main" tabindex="-1">
    <div class="gen-lock-box cornerframe">
      <span class="label">Medical Assistant</span>
      <h1 class="gen-lock-title">CCMA Study System</h1>
      <p class="gen-lock-sub">Your private CCMA study system — all domains, mock final, spaced-repetition drills. Password locked to you only.</p>
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
    if (val === CCMA_PASS) { CCMA.unlocked = true; ccmaSave(); ccmaTrack('unlock', {}); renderCcmaHome(); }
    else renderCcmaPassword('Incorrect passphrase. Try again.');
  });
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
  setTimeout(() => { const i = document.querySelector('#gen-pass'); if (i) i.focus(); }, 30);
}

/* ============================================================================
   HOME / DASHBOARD
   ========================================================================= */
function renderCcmaHome() {
  ccmaClearTimer();
  CCMA_POOL_FILTER = null;
  if (!CCMAA_sessionLogged) { CCMAA_sessionLogged = true; ccmaTrack('session_start', { competency: ccmaOverall(), mastered: CCMA_BANK.filter(q => ccmaBox(q.id) >= 5).length, total: CCMA_BANK.length, mobile: (window.innerWidth || 0) < 700 }); }
  const rank = ccmaRank(CCMA.xp), status = ccmaStatus();
  const missCount = ccmaMissPool().length, starredCount = ccmaStarredList().length;
  const mastered = CCMA_BANK.filter(q => ccmaBox(q.id) >= 5).length;
  const weak = ccmaWeakTopics();
  // Blueprint row: domain name + its exam weight, with YOUR mastery bar/percent.
  const bpMeter = (d) => { const m = ccmaMastery(d.ch); return `<div class="gen-meter">
      <div class="gen-meter-top"><span>${esc(d.name)} <span class="ccma-wt mono">${d.pct}% of exam</span></span><span class="mono">${m}%</span></div>
      <div class="gen-bar"><span style="width:${m}%"></span></div>
    </div>`; };
  const weakItems = weak.slice(0, 3).map(w => `<button class="gen-weak-row" data-topic="${w.topic}">
      <span class="gen-weak-name">${esc(w.name)}</span>
      <span class="gen-weak-bar"><span style="width:${w.comp}%"></span></span>
      <span class="mono gen-weak-pct">${w.comp}%</span>
    </button>`).join('');

  const root = el('<div></div>');
  root.appendChild(topbar('ccma'));
  const main = el(`<main class="panel gen-home" id="main" tabindex="-1">
    ${status.cls === 'ready' ? `<div class="gen-ready-banner"><span class="gen-ready-pulse"></span>EXAM READY · ${status.c}% competency — go destroy it</div>` : ''}

    <header class="gen-hero cornerframe">
      <div class="gen-hero-l">
        <span class="label">NHA CCMA · exam prep</span>
        <h1>Destroy the CCMA</h1>
        <div class="gen-rank"><span class="gen-rank-lvl mono">LV ${rank.lvl}</span><span class="gen-rank-name">${esc(rank.name)}</span></div>
        <div class="gen-xpbar"><span style="width:${rank.pct}%"></span></div>
        <p class="gen-xp-note mono">${CCMA.xp.toLocaleString()} XP${rank.next ? ` · ${rank.toNext.toLocaleString()} to next level` : ' · MAX'}</p>
      </div>
      <div class="gen-hero-r">
        <div class="gen-comp-ring gen-comp-${status.cls}">
          <span class="gen-comp-num mono">${status.c}%</span><span class="gen-comp-lab">exam ready</span>
        </div>
        <span class="gen-comp-status gen-comp-${status.cls}">${status.label}</span>
      </div>
    </header>

    <div class="gen-statrow">
      <div class="gen-stat"><span class="gen-stat-n mono">${CCMA.streak.current}</span><span class="gen-stat-l">Day streak</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${ccmaAccuracy()}%</span><span class="gen-stat-l">Accuracy</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${CCMA.bestMock || 0}%</span><span class="gen-stat-l">Best mock</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${mastered}/${CCMA_BANK.length}</span><span class="gen-stat-l">Mastered</span></div>
    </div>

    <section class="gen-modes">
      <button class="gen-mode-card gen-mode-learn cornerframe" data-mode="learn">
        <span class="gen-mode-tag">guided · teaches you</span>
        <h2>Learn</h2>
        <p>Walk the full 38-lesson CCMA path across all 7 exam domains. Cross off lessons as you master them — built for rotation study, not hyperfocus grind.</p>
        <span class="gen-mode-go">Lesson path →</span>
      </button>
      <button class="gen-mode-card gen-mode-hero cornerframe" data-mode="smart">
        <span class="gen-mode-tag">recommended · daily · endless</span>
        <h2>Smart Review</h2>
        <p>Endless adaptive loop — keeps feeding you your weakest questions (spaced repetition + interleaving) until every one is mastered. Your daily driver.</p>
        <span class="gen-mode-go">Study →</span>
      </button>
      <button class="gen-mode-card gen-mode-hero cornerframe" data-mode="mock">
        <span class="gen-mode-tag">full mock · blueprint-weighted</span>
        <h2>NHA Mock Exam</h2>
        <p>A ${CCMA_EXAM.scored}-question mock drawn to the real NHA blueprint, on a ${Math.round(CCMA_EXAM.minutes / 60)}-hour clock. Beat the ${CCMA_EXAM.passRawPct}% pass bar under real conditions.${CCMA.bestMock ? ` Best: ${CCMA.bestMock}%.` : ''}</p>
        <span class="gen-mode-go">Take mock →</span>
      </button>
      <button class="gen-mode-card cornerframe" data-mode="chapter">
        <span class="gen-mode-tag">untimed · by domain</span>
        <h2>Topic Drills</h2>
        <p>Pick one NHA domain (vitals, phlebotomy, infection control, EKG, lab…) and drill until the meter fills.</p>
        <span class="gen-mode-go">Choose →</span>
      </button>
      <button class="gen-mode-card cornerframe" data-mode="exam">
        <span class="gen-mode-tag">20 Q · 3 lives · pressure</span>
        <h2>Exam Boss</h2>
        <p>Blueprint-weighted gauntlet across every domain. Beat 85% to slay the boss.${CCMA.bestExam ? ` Best: ${CCMA.bestExam}%.` : ''}</p>
        <span class="gen-mode-go">Fight →</span>
      </button>
      <button class="gen-mode-card cornerframe" data-mode="blitz">
        <span class="gen-mode-tag">90s · combo · speed</span>
        <h2>Blitz</h2>
        <p>Rapid-fire across the whole bank. Build automatic recall and chase your high score.</p>
        <span class="gen-mode-go">Start →</span>
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
        <span class="label">NHA blueprint — study to the weighting</span>
        ${CCMA_BLUEPRINT.map(bpMeter).join('')}
        <p class="gen-xp-note" style="margin-top:.6rem">Bars show YOUR mastery; the chip is that domain's share of the real exam. Clinical Patient Care is <b>${CCMA_BLUEPRINT[2].pct}%</b> of it — spend your time proportionally.</p>
      </section>
    </div>

    <div class="gen-utils">
      <button class="ghostbtn" data-mode="stats">View stats →</button>
      <button class="ghostbtn" data-mode="starred">★ Starred (${starredCount})</button>
    </div>

    <section class="gen-method cornerframe">
      <span class="label">The plan to destroy it (science-backed)</span>
      <ol class="gen-method-list">
        <li><b>Test, don't reread.</b> Retrieval practice (answering) builds memory far better than review — this whole system is active recall.</li>
        <li><b>Run Smart Review daily.</b> Spaced repetition resurfaces each item right before you'd forget it; the box meter handles the timing.</li>
        <li><b>Study to the blueprint.</b> Clinical Patient Care is 56% of the exam — weight your reps there, then shore up weak domains.</li>
        <li><b>Simulate.</b> Lesson path → Smart Review daily → Topic Drills on weak domains → NHA Mock Exam (timed) until you clear ${CCMA_EXAM.passRawPct}% consistently → Exam Boss for pressure.</li>
      </ol>
    </section>

    <section class="gen-method cornerframe">
      <span class="label">Exam day brief — know before you go</span>
      <div class="ccma-brief">
        <div class="ccma-brief-item"><span class="mono">${CCMA_EXAM.total} Q · ${Math.round(CCMA_EXAM.minutes / 60)} hr</span><span>${CCMA_EXAM.scored} scored + ${CCMA_EXAM.pretest} unscored pilot. ~60 sec/question.</span></div>
        <div class="ccma-brief-item"><span class="mono">Pass ${CCMA_EXAM.passScaled}/${CCMA_EXAM.scaleMax}</span><span>Scaled score (≈${CCMA_EXAM.passRawPct}% raw). Per-domain diagnostic posts within 48 hrs.</span></div>
        <div class="ccma-brief-item"><span class="mono">Bring ID</span><span>Gov't photo ID with photo + signature; name must match your registration exactly.</span></div>
        <div class="ccma-brief-item"><span class="mono">Format</span><span>PSI test center, at-home remote proctor, or approved school site. No calculators / phones / notes.</span></div>
        <div class="ccma-brief-item"><span class="mono">Retake</span><span>Up to 3 attempts, 30-day wait between; full fee each time (~$155–165).</span></div>
        <div class="ccma-brief-item"><span class="mono">Recert</span><span>Renew every 2 years with 10 NHA CE credits.</span></div>
      </div>
      <ol class="gen-method-list">
        <li><b>Answer everything.</b> No penalty for guessing — never leave a question blank.</li>
        <li><b>Flag &amp; move on.</b> Don't stall on a hard one; mark it, keep pace, return with leftover time.</li>
        <li><b>Treat every question as scored</b> — the 30 pilot items are unmarked, so you can't tell them apart.</li>
        <li><b>Confirm your ID name matches your registration</b> before test day, and arrive ~30 min early (or log in early for remote).</li>
      </ol>
    </section>

    <section class="gen-trophy cornerframe">
      <span class="label">Achievements · ${CCMA.ach.length}/${CCMA_ACH.length}</span>
      <div class="gen-badges">
        ${CCMA_ACH.map(a => { const got = CCMA.ach.includes(a.id); return `<div class="gen-badge ${got ? 'got' : ''}" title="${esc(a.desc)}"><span class="gen-badge-name">${esc(a.name)}</span><span class="gen-badge-desc">${esc(a.desc)}</span></div>`; }).join('')}
      </div>
    </section>

    <p class="gen-foot-note">${CCMA_BANK.length} NHA CCMA questions · all 7 exam domains · private. <button class="ghostbtn" id="gen-reset">Reset progress</button></p>
  </main>`);

  main.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    const m = b.dataset.mode;
    if (m === 'learn') renderCcmaLearnHome();
    else if (m === 'smart') startCcmaSmart();
    else if (m === 'blitz') startCcmaBlitz();
    else if (m === 'chapter') renderCcmaChapterPick();
    else if (m === 'mock') renderCcmaMockIntro();
    else if (m === 'exam') startCcmaExam();
    else if (m === 'misses') startCcmaMisses();
    else if (m === 'stats') renderCcmaStats();
    else if (m === 'starred') startCcmaStarred();
  }));
  main.querySelectorAll('[data-topic]').forEach(b => b.addEventListener('click', () => startCcmaTopic(b.dataset.topic)));
  main.querySelector('#gen-reset').addEventListener('click', () => {
    if (!confirm('Reset all Medical Assistant progress (XP, mastery, achievements)? You stay unlocked.')) return;
    CCMA = Object.assign({ unlocked: true, xp: 0, answered: 0, correct: 0, bestScore: 0, bestCombo: 0, bestExam: 0, bestMock: 0, plays: 0, streak: { current: 0, longest: 0, lastDate: '' }, q: {}, starred: {}, learned: {}, ach: [], examReady: false });
    ccmaSave(); renderCcmaHome();
  });
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

/* ============================================================================
   CHAPTER PICKER
   ========================================================================= */
function renderCcmaChapterPick() {
  ccmaClearTimer();
  const card = (key) => { const t = CCMA_TOPICS[key], qs = ccmaTopicQs(key); return `<button class="gen-ch-card cornerframe" data-topic="${key}">
    <span class="gen-ch-num mono">CH ${t.ch}</span><h2>${esc(t.name)}</h2><p>${esc(t.blurb)}</p>
    <div class="gen-meter"><div class="gen-bar"><span style="width:${ccmaComp(qs)}%"></span></div></div>
    <span class="mono gen-ch-pct">${ccmaComp(qs)}% · ${qs.length} Q</span></button>`; };
  const root = el('<div></div>');
  root.appendChild(topbar('ccma'));
  const main = el(`<main class="panel gen-pick" id="main" tabindex="-1">
    <div class="gen-pick-head"><button class="ghostbtn" id="gen-back">← Home</button><h1>Topic Drills</h1></div>
    <div class="gen-ch-grid">
      ${Object.keys(CCMA_TOPICS).map(card).join('')}
    </div>
  </main>`);
  main.querySelector('#gen-back').addEventListener('click', renderCcmaHome);
  main.querySelectorAll('[data-topic]').forEach(b => b.addEventListener('click', () => startCcmaTopic(b.dataset.topic)));
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

/* ============================================================================
   GAME RUNS
   ========================================================================= */
function startCcmaSmart() {
  ccmaBumpStreak(); CCMA.plays++; ccmaSave();
  // Endless adaptive loop: serve the single most-needed (weakest/due/unseen) question
  // each time, forever, until every question is fully mastered (box 5).
  ccmaTrack('mode_start', { mode: 'smart' });
  ccmaRunQuestion({ mode: 'smart', endless: true, pool: [], retryQ: [], idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false, lastId: null, lastTopic: null });
}
function startCcmaBlitz() {
  ccmaBumpStreak(); CCMA.plays++; ccmaSave();
  ccmaTrack('mode_start', { mode: 'blitz' });
  ccmaRunQuestion({ mode: 'blitz', pool: ccmaShuffle(CCMA_BANK), idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, timeLeft: 90, locked: false });
}
function startCcmaChapter(ch) {
  CCMA.plays++; ccmaSave();
  ccmaTrack('mode_start', { mode: 'chapter', chapter: ch });
  ccmaRunQuestion({ mode: 'chapter', chapter: ch, pool: ccmaShuffle(ccmaChapterQs(ch)), idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false });
}
function startCcmaTopic(t) {
  CCMA.plays++; ccmaSave();
  ccmaTrack('mode_start', { mode: 'topic', topic: t });
  ccmaRunQuestion({ mode: 'topic', topic: t, pool: ccmaShuffle(ccmaTopicQs(t)), idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false });
}

/* ---------- Full NHA-style Mock Exam (blueprint-weighted) ---------- */
// Intro screen: shows the real exam facts + blueprint, then a timed full mock or a shorter untimed run.
function renderCcmaMockIntro() {
  ccmaClearTimer();
  const bpRows = CCMA_BLUEPRINT.map(d => `<div class="gen-meter">
      <div class="gen-meter-top"><span>${esc(d.name)}</span><span class="mono">${d.pct}% · ${d.items} Q</span></div>
      <div class="gen-bar gen-bar-plan"><span style="width:${d.pct}%"></span></div>
    </div>`).join('');
  const root = el('<div></div>');
  root.appendChild(topbar('ccma'));
  const main = el(`<main class="panel gen-pick" id="main" tabindex="-1">
    <div class="gen-pick-head"><button class="ghostbtn" id="gen-back">← Home</button><h1>NHA Mock Exam</h1></div>
    <section class="gen-method cornerframe" style="margin-bottom:1rem">
      <span class="label">The real exam — what you're training for</span>
      <div class="gen-statrow" style="margin:.5rem 0 .25rem">
        <div class="gen-stat"><span class="gen-stat-n mono">${CCMA_EXAM.scored}</span><span class="gen-stat-l">scored Q (+${CCMA_EXAM.pretest} pilot)</span></div>
        <div class="gen-stat"><span class="gen-stat-n mono">${Math.round(CCMA_EXAM.minutes / 60)} hr</span><span class="gen-stat-l">time limit</span></div>
        <div class="gen-stat"><span class="gen-stat-n mono">${CCMA_EXAM.passScaled}</span><span class="gen-stat-l">pass (of ${CCMA_EXAM.scaleMax})</span></div>
        <div class="gen-stat"><span class="gen-stat-n mono">~${CCMA_EXAM.passRawPct}%</span><span class="gen-stat-l">≈ raw to pass</span></div>
      </div>
      <p class="gen-xp-note">This mock is drawn to the <b>real NHA blueprint weighting</b> below, so what you practice mirrors what you'll be tested on. Beat ${CCMA_EXAM.passRawPct}% here and you're on track to destroy the real thing.</p>
    </section>
    <section class="gen-mastery cornerframe" style="margin-bottom:1rem">
      <span class="label">Exam blueprint — question mix</span>
      ${bpRows}
    </section>
    <section class="gen-modes">
      <button class="gen-mode-card gen-mode-hero cornerframe" id="mock-full">
        <span class="gen-mode-tag">full length · timed</span>
        <h2>Full Timed Mock</h2>
        <p>${CCMA_EXAM.scored} blueprint-weighted questions on a ${Math.round(CCMA_EXAM.minutes / 60)}-hour countdown — the closest thing to test day. Pass bar at ${CCMA_EXAM.passRawPct}%.</p>
        <span class="gen-mode-go">Start timed →</span>
      </button>
      <button class="gen-mode-card cornerframe" id="mock-half">
        <span class="gen-mode-tag">75 Q · untimed</span>
        <h2>Half Mock</h2>
        <p>A shorter blueprint-weighted set with no clock — good for a focused session or a warm-up before the full timed run.</p>
        <span class="gen-mode-go">Start →</span>
      </button>
    </section>
  </main>`);
  main.querySelector('#gen-back').addEventListener('click', renderCcmaHome);
  main.querySelector('#mock-full').addEventListener('click', () => startCcmaMock({ n: CCMA_EXAM.scored, timed: true }));
  main.querySelector('#mock-half').addEventListener('click', () => startCcmaMock({ n: 75, timed: false }));
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
  ccmaTrack('mock_intro', {});
}
function startCcmaMock(opts) {
  opts = opts || {};
  ccmaBumpStreak(); CCMA.plays++; ccmaSave();
  const n = opts.n || CCMA_EXAM.scored;
  const pool = ccmaBlueprintPool(n);
  ccmaTrack('mode_start', { mode: 'mock', n: pool.length, timed: !!opts.timed });
  ccmaRunQuestion({
    mode: 'exam', pool, idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0,
    lives: 999, locked: false, isMock: true,
    examCountdown: opts.timed ? Math.round(pool.length / CCMA_EXAM.scored * CCMA_EXAM.minutes * 60) : 0,
  });
}

// Exam Boss — 20-question blueprint-weighted gauntlet, 3 lives.
function startCcmaExam() {
  ccmaBumpStreak(); CCMA.plays++; ccmaSave();
  const pool = ccmaBlueprintPool(20);
  ccmaTrack('mode_start', { mode: 'exam' });
  ccmaRunQuestion({ mode: 'exam', pool, idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, lives: 3, locked: false });
}
/* ---------- review misses, starred, stats ---------- */
function ccmaMissPool() { return CCMA_BANK.filter(q => { const r = CCMA.q[q.id]; return r && r.a > 0 && (r.lastWrong || r.box <= 2); }); }
function ccmaStarredList() { return CCMA_BANK.filter(q => CCMA.starred && CCMA.starred[q.id]); }
function ccmaToggleStar(id) { if (!CCMA.starred) CCMA.starred = {}; if (CCMA.starred[id]) delete CCMA.starred[id]; else CCMA.starred[id] = 1; ccmaSave(); return !!CCMA.starred[id]; }
function ccmaEmpty(title, msg) {
  ccmaClearTimer();
  const root = el('<div></div>'); root.appendChild(topbar('ccma'));
  const main = el(`<main class="panel gen-result" id="main" tabindex="-1"><div class="gen-res-box cornerframe"><span class="label">${esc(title)}</span><p class="gen-empty-msg">${esc(msg)}</p><div class="gen-res-btns"><button class="btn btn-solid" id="gen-homebtn">Back to home</button></div></div></main>`);
  main.querySelector('#gen-homebtn').addEventListener('click', renderCcmaHome);
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}
function startCcmaMisses() {
  const pool = ccmaShuffle(ccmaMissPool());
  if (!pool.length) { ccmaEmpty('Review misses', 'No misses to review right now — nice work. Play a mode to surface your weak spots, then come back.'); return; }
  CCMA.plays++; ccmaSave();
  ccmaRunQuestion({ mode: 'misses', pool, idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false });
}
function startCcmaStarred() {
  const pool = ccmaShuffle(ccmaStarredList());
  if (!pool.length) { ccmaEmpty('Starred questions', "You haven't starred any questions yet. Tap the star on any question to save it here for later."); return; }
  CCMA.plays++; ccmaSave();
  ccmaRunQuestion({ mode: 'starred', pool, idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false });
}
function renderCcmaStats() {
  ccmaClearTimer();
  const topicRows = Object.keys(CCMA_TOPICS).map(t => {
    const qs = ccmaTopicQs(t); if (!qs.length) return '';
    let a = 0, c = 0, m = 0; qs.forEach(q => { const r = CCMA.q[q.id]; if (r) { a += r.a; c += r.c; if (r.box >= 4) m++; } });
    const acc = a ? Math.round(c / a * 100) : 0;
    return `<div class="gen-srow"><span class="gen-srow-name">${esc(CCMA_TOPICS[t].name)}</span><span class="gen-srow-bar"><span style="width:${ccmaComp(qs)}%"></span></span><span class="mono gen-srow-vals">${ccmaComp(qs)}% · ${acc}% acc · ${m}/${qs.length}</span></div>`;
  }).join('');
  const maxed = CCMA_BANK.filter(q => CCMA.q[q.id] && CCMA.q[q.id].box >= 5).length;
  const root = el('<div></div>'); root.appendChild(topbar('ccma'));
  const main = el(`<main class="panel gen-pick" id="main" tabindex="-1">
    <div class="gen-pick-head"><button class="ghostbtn" id="gen-back">← Home</button><h1>Your stats</h1></div>
    <div class="gen-statrow">
      <div class="gen-stat"><span class="gen-stat-n mono">${ccmaOverall()}%</span><span class="gen-stat-l">Competency</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${ccmaAccuracy()}%</span><span class="gen-stat-l">Accuracy</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${CCMA.answered.toLocaleString()}</span><span class="gen-stat-l">Answered</span></div>
      <div class="gen-stat"><span class="gen-stat-n mono">${maxed}/${CCMA_BANK.length}</span><span class="gen-stat-l">Maxed out</span></div>
    </div>
    <section class="gen-mastery cornerframe"><span class="label">By topic — competency · accuracy · strong</span>${topicRows}</section>
    <div class="gen-res-btns gen-stats-actions"><button class="btn" id="gen-misses2">Review my misses (${ccmaMissPool().length})</button><button class="btn" id="gen-starred2">★ Starred (${ccmaStarredList().length})</button></div>
  </main>`);
  main.querySelector('#gen-back').addEventListener('click', renderCcmaHome);
  main.querySelector('#gen-misses2').addEventListener('click', startCcmaMisses);
  main.querySelector('#gen-starred2').addEventListener('click', startCcmaStarred);
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

function ccmaComboMult(combo) { return Math.min(5, 1 + Math.floor(combo / 3)); }

// Endless Smart Review: pick the one most-needed question right now. Weakest box
// first, then due-for-review, lightly interleaved, never the same one twice in a row.
// Returns null once everything is fully mastered (box 5).
function ccmaNextSmart(run) {
  // In-session requeue (Quizlet-style): a missed question cycles back within 2-3 questions,
  // ahead of the normal adaptive pick, and reappears with its "think it through" hint.
  if (run.retryQ && run.retryQ.length) {
    const i = run.retryQ.findIndex(r => r.due <= run.answered);
    if (i >= 0) { const r = run.retryQ.splice(i, 1)[0]; run.lastId = r.q.id; run.lastTopic = r.q.topic; return r.q; }
  }
  const now = Date.now();
  const bank = (typeof ccmaActiveBank === 'function' ? ccmaActiveBank() : CCMA_BANK);
  const pool = bank.filter(q => ccmaBox(q.id) < 5);
  if (!pool.length) {
    // everything mastered but a retry is still pending -> serve it rather than ending
    if (run.retryQ && run.retryQ.length) { const r = run.retryQ.shift(); run.lastId = r.q.id; run.lastTopic = r.q.topic; return r.q; }
    return null;
  }
  let best = null, bestPr = -1e9;
  for (const q of pool) {
    const r = CCMA.q[q.id], box = r ? r.box : 0, ts = r ? r.ts : 0;
    const ageH = ts ? (now - ts) / 3.6e6 : 1e6;
    const due = box === 0 || ageH >= CCMA_INTERVAL_H[box];
    let pr = (5 - box) * 12 + (box === 0 ? 30 : 0) + (due ? 8 : -30) + Math.random() * 6;
    if (q.id === run.lastId) pr -= 100;                         // no immediate repeat
    if (run.lastTopic && q.topic === run.lastTopic) pr -= 4;    // light interleaving
    if (pr > bestPr) { bestPr = pr; best = q; }
  }
  run.lastId = best.id; run.lastTopic = best.topic;
  return best;
}

function ccmaSmartComplete(run) {
  ccmaClearTimer(); ccmaGrant('smart'); ccmaCheckAch(); ccmaSave();
  const _finBank = (typeof ccmaActiveBank === 'function' ? ccmaActiveBank() : CCMA_BANK);
  CCMA_POOL_FILTER = null;
  ccmaTrack('milestone', { kind: 'fully_mastered' });
  ccmaTrack('run_end', { mode: 'smart', answered: run.answered, correct: run.correct, maxCombo: run.maxCombo, competency: ccmaOverall() });
  const root = el('<div></div>');
  root.appendChild(topbar('ccma'));
  const main = el(`<main class="panel gen-result" id="main" tabindex="-1">
    <div class="gen-res-box cornerframe">
      <span class="label">Fully mastered</span>
      <h1 class="gen-res-sub">All ${(typeof ccmaActiveBank === 'function' ? ccmaActiveBank() : CCMA_BANK).length} questions maxed</h1>
      <div class="gen-res-grid">
        <div><span class="mono">100%</span><span>competency</span></div>
        <div><span class="mono">${run.correct}/${run.answered}</span><span>this session</span></div>
        <div><span class="mono">${run.maxCombo}×</span><span>best streak</span></div>
        <div><span class="mono">${CCMA.xp.toLocaleString()}</span><span>total XP</span></div>
      </div>
      <p class="gen-res-ready">Every question is maxed out — you mastered the material. Run a maintenance pass anytime to stay sharp.</p>
      <div class="gen-res-btns">
        <button class="btn btn-solid" id="gen-maint">Maintenance pass</button>
        <button class="btn" id="gen-homebtn">Home</button>
      </div>
    </div>
  </main>`);
  main.querySelector('#gen-homebtn').addEventListener('click', renderCcmaHome);
  main.querySelector('#gen-maint').addEventListener('click', () => ccmaRunQuestion({ mode: 'smart', pool: ccmaShuffle(CCMA_BANK), idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, locked: false }));
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

/* ---------- calc tools: mini calculator + scratchpad (calc questions only) ---------- */
let ccmaToolsOpen = false;   // panel open-state persists across questions in a session
let ccmaScratch = '';        // scratchpad text persists across questions in a session
function ccmaToolsHtml() {
  const keys = ['C', '←', '(', ')', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+'];
  const dk = { 'C': 'clear', '←': 'back', '=': 'eq' };
  const cl = { 'C': 'gen-calc-fn', '←': 'gen-calc-fn', '=': 'gen-calc-eq', '÷': 'gen-calc-op', '×': 'gen-calc-op', '−': 'gen-calc-op', '+': 'gen-calc-op' };
  const grid = keys.map(k => `<button type="button" class="gen-calc-key ${cl[k] || ''}" data-k="${dk[k] || k}">${k}</button>`).join('');
  return `<div class="gen-tools">
      <button type="button" class="gen-tools-toggle" id="gen-tools-toggle">${ccmaToolsOpen ? '▾' : '▸'} Calculator &amp; scratchpad</button>
      <div class="gen-tools-panel" id="gen-tools-panel"${ccmaToolsOpen ? '' : ' hidden'}>
        <div class="gen-calc">
          <input type="text" class="gen-calc-disp" id="gen-calc-disp" inputmode="none" readonly aria-label="Calculator display" />
          <div class="gen-calc-keys">${grid}</div>
        </div>
        <div class="gen-pad"><textarea class="gen-pad-area" id="gen-pad-area" rows="6" placeholder="Scratchpad — work it out here…"></textarea></div>
      </div>
    </div>`;
}
function ccmaCalcEval(expr) {
  if (!/^[-−0-9+*/×÷().%\s]*$/.test(expr)) return 'Error';
  const clean = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/%/g, '/100');
  if (!clean.trim()) return '';
  try {
    const v = Function('"use strict";return (' + clean + ')')();
    if (typeof v !== 'number' || !isFinite(v)) return 'Error';
    return String(Math.round(v * 1e6) / 1e6);
  } catch { return 'Error'; }
}
function ccmaWireTools(main) {
  const toggle = main.querySelector('#gen-tools-toggle');
  if (!toggle) return;
  const panel = main.querySelector('#gen-tools-panel');
  const disp = main.querySelector('#gen-calc-disp');
  const pad = main.querySelector('#gen-pad-area');
  toggle.addEventListener('click', () => {
    ccmaToolsOpen = panel.hidden; panel.hidden = !ccmaToolsOpen;
    toggle.textContent = (ccmaToolsOpen ? '▾' : '▸') + ' Calculator & scratchpad';
  });
  if (pad) { pad.value = ccmaScratch; pad.addEventListener('input', () => { ccmaScratch = pad.value; }); }
  let evaluated = false;
  main.querySelectorAll('.gen-calc-key').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.k;
    if (k === 'clear') { disp.value = ''; evaluated = false; return; }
    if (k === 'back') { disp.value = disp.value.slice(0, -1); evaluated = false; return; }
    if (k === 'eq') { disp.value = ccmaCalcEval(disp.value); evaluated = true; return; }
    if (disp.value === 'Error') disp.value = '';
    if (evaluated) { if (/[0-9.(]/.test(k)) disp.value = ''; evaluated = false; }
    disp.value += k;
  }));
}

function ccmaRunQuestion(run) {
  ccmaClearTimer();
  run.locked = false;
  let qq;
  if (run.endless) {
    qq = ccmaNextSmart(run);
    if (!qq) { ccmaSmartComplete(run); return; }
  } else {
    if (!run.pool.length) { ccmaEndRun(run); return; }
    if (run.mode === 'blitz') { if (run.idx >= run.pool.length) { run.pool = ccmaShuffle(CCMA_BANK); run.idx = 0; } }
    else if (run.idx >= run.pool.length) { ccmaEndRun(run); return; }
    qq = run.pool[run.idx];
  }
  if (qq && qq.make) qq = Object.assign({}, qq, qq.make());
  const showHint = !!((qq._retry || (CCMA.q[qq.id] && CCMA.q[qq.id].lastWrong)) && qq.hint);
  const order = ccmaShuffle([0, 1, 2, 3]);
  const correctDisp = order.indexOf(qq.answer);

  const root = el('<div></div>');
  root.appendChild(topbar('ccma'));
  const main = el(`<main class="panel gen-game" id="main" tabindex="-1">
    ${ccmaHud(run)}
    <div class="gen-q cornerframe" data-qid="${qq.id}">
      <div class="gen-q-meta"><span class="mono">CH ${qq.chapter}</span><span class="gen-q-tag">${esc((CCMA_TOPICS[qq.topic] && CCMA_TOPICS[qq.topic].name) || 'Practice')}</span><span class="gen-q-diff gen-d-${qq.difficulty}">${qq.difficulty}</span>${qq.type === 'label' ? '<span class="gen-q-pic">diagram</span>' : ''}<button type="button" class="gen-star ${CCMA.starred && CCMA.starred[qq.id] ? 'on' : ''}" id="gen-star" aria-label="Star this question">${CCMA.starred && CCMA.starred[qq.id] ? '★' : '☆'}</button></div>
      ${qq.svg ? `<div class="gen-q-svg">${qq.svg}</div>` : ''}
      ${qq.fig && window.CCMA_FIGS && window.CCMA_FIGS[qq.fig] ? '<div class="gen-q-fig" id="gen-fig"></div>' : ''}
      <h2 class="gen-q-stem">${esc(qq.q)}</h2>
      ${showHint ? `<div class="gen-hint"><span class="gen-hint-lab">Think it through</span> ${esc(qq.hint)}</div>` : ''}
      <div class="gen-opts">
        ${order.map((origIdx, dispIdx) => `<button class="gen-opt" data-disp="${dispIdx}" data-ok="${dispIdx === correctDisp ? 1 : 0}"><span class="gen-opt-key mono">${String.fromCharCode(65 + dispIdx)}</span><span class="gen-opt-txt">${esc(qq.options[origIdx])}</span></button>`).join('')}
      </div>
      ${qq.type === 'calc' ? ccmaToolsHtml() : ''}
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
    const beforeBox = ccmaBox(qq.id);
    ccmaRecord(qq, right); run.answered++;
    if (right && run.mode !== 'blitz' && ccmaBox(qq.id) === 5 && beforeBox === 4) ccmaToast(`Mastered · ${qq.tag}`);
    ccmaTrack('answer', { mode: run.mode, qid: qq.id, chapter: qq.chapter, topic: qq.topic, type: qq.type, difficulty: qq.difficulty, correct: right ? 1 : 0 });
    [...optsWrap.querySelectorAll('.gen-opt')].forEach(o => { o.disabled = true; if (o.dataset.ok === '1') o.classList.add('correct'); else if (o === btn) o.classList.add('wrong'); });

    if (right) {
      run.correct++; run.combo++; if (run.combo > run.maxCombo) run.maxCombo = run.combo;
      if (run.combo > CCMA.bestCombo) CCMA.bestCombo = run.combo;
      if (run.combo === 5) ccmaGrant('combo5');
      if (run.combo === 10) ccmaGrant('combo10');
      const mult = ccmaComboMult(run.combo);
      const base = (qq.type === 'calc' ? 150 : qq.type === 'label' ? 130 : 100) + (qq.difficulty === 'hard' ? 50 : qq.difficulty === 'med' ? 25 : 0);
      run.score += base * mult;
      ccmaFlash(main, `+${base * mult}`, run.combo >= 3 ? `${mult}× COMBO` : '', true);
    } else {
      run.combo = 0; if (run.mode === 'exam') run.lives--;
      ccmaFlash(main, 'MISS', '', false);
      if (run.mode === 'chapter' || run.mode === 'topic' || run.mode === 'misses' || run.mode === 'starred') {
        const retry = Object.assign({}, qq); delete retry.make; retry._retry = true;
        run.pool.splice(Math.min(run.pool.length, run.idx + 1 + ccmaRand(1, 2)), 0, retry);
      } else if (run.endless) {
        // Smart Review: requeue the miss to reappear within 2-3 questions with its hint.
        const retry = Object.assign({}, qq); delete retry.make; retry._retry = true;
        (run.retryQ || (run.retryQ = [])).push({ q: retry, due: run.answered + ccmaRand(1, 2) });
      }
    }
    ccmaCheckAch(); ccmaSave();
    explainBox.innerHTML = `<span class="gen-ex-label">${right ? 'Correct' : 'Answer'}</span> ${esc(qq.explain)}`;
    explainBox.hidden = false;

    if (run.mode === 'exam' && run.lives <= 0) {
      nextRow.hidden = false; const nb = main.querySelector('#gen-next'); nb.textContent = 'See results →';
      nb.addEventListener('click', () => ccmaEndRun(run)); nb.focus(); return;
    }
    if (run.mode === 'blitz') {
      setTimeout(() => { run.idx++; if (run.timeLeft > 0) ccmaRunQuestion(run); }, right ? 650 : 1100);
    } else {
      nextRow.hidden = false; const nb = main.querySelector('#gen-next');
      if (!run.endless && run.idx + 1 >= run.pool.length) nb.textContent = 'Finish →';
      nb.addEventListener('click', () => { run.idx++; ccmaRunQuestion(run); }); nb.focus();
    }
  };

  optsWrap.querySelectorAll('.gen-opt').forEach(b => b.addEventListener('click', () => choose(b)));
  const onKey = (e) => {
    // self-guard: if this question's view is gone (e.g. navigated away), retire this handler
    if (!document.body.contains(main)) { document.removeEventListener('keydown', onKey); if (ccmaKeyHandler === onKey) ccmaKeyHandler = null; return; }
    const tg = e.target;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable)) return;
    if (run.locked) { if (e.key === 'Enter' && !nextRow.hidden) main.querySelector('#gen-next')?.click(); return; }
    let k = -1;
    if (/^[a-dA-D]$/.test(e.key)) k = e.key.toLowerCase().charCodeAt(0) - 97;
    else if (/^[1-4]$/.test(e.key)) k = +e.key - 1;
    if (k >= 0) { const b = optsWrap.querySelector(`.gen-opt[data-disp="${k}"]`); if (b) choose(b); }
  };
  ccmaWireTools(main);
  const starBtn = main.querySelector('#gen-star'); if (starBtn) starBtn.addEventListener('click', (e) => { const on = ccmaToggleStar(qq.id); e.currentTarget.textContent = on ? '★' : '☆'; e.currentTarget.classList.toggle('on', on); });
  ccmaBindKey(onKey);   // replaces any previous question's handler

  root.appendChild(main); root.appendChild(siteFooter()); setView(root);

  // mount the interactive figure (if this question has one) above the stem
  if (qq.fig && window.CCMA_FIGS && window.CCMA_FIGS[qq.fig]) {
    const figHost = main.querySelector('#gen-fig');
    if (figHost) { try { window.CCMA_FIGS[qq.fig](figHost); } catch (e) { figHost.remove(); } }
  }

  if (run.mode === 'blitz') {
    const tEl = main.querySelector('#gen-time');
    ccmaTimer = setInterval(() => {
      if (!document.body.contains(main)) { ccmaClearTimer(); return; }
      run.timeLeft--;
      if (tEl) { tEl.textContent = run.timeLeft; if (run.timeLeft <= 10) tEl.classList.add('low'); }
      if (run.timeLeft <= 0) { ccmaClearTimer(); ccmaEndRun(run); }
    }, 1000);
  } else if (run.examCountdown) {
    const tEl = main.querySelector('#gen-time');
    ccmaTimer = setInterval(() => {
      if (!document.body.contains(main)) { ccmaClearTimer(); return; }
      run.examCountdown--;
      if (tEl) { tEl.textContent = ccmaClock(run.examCountdown); if (run.examCountdown <= 300) tEl.classList.add('low'); }
      if (run.examCountdown <= 0) { ccmaClearTimer(); ccmaEndRun(run); }
    }, 1000);
  }
}

// mm:ss (or h:mm:ss) clock for the timed mock countdown.
function ccmaClock(s) {
  s = Math.max(0, s | 0);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(2, '0'), ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function ccmaHud(run) {
  const quit = `<button class="ghostbtn gen-quit" id="ccma-quit">✕ ${run.mode === 'blitz' || run.mode === 'exam' ? 'Quit' : 'Exit'}</button>`;
  if (run.mode === 'blitz') return `<div class="gen-hud">${quit}
    <div class="gen-hud-time"><span class="mono" id="gen-time">${run.timeLeft}</span><span class="gen-hud-l">sec</span></div>
    <div class="gen-hud-score"><span class="mono">${run.score}</span><span class="gen-hud-l">score</span></div>
    <div class="gen-hud-combo ${run.combo >= 3 ? 'hot' : ''}"><span class="mono">${run.combo}×</span><span class="gen-hud-l">combo</span></div></div>`;
  if (run.mode === 'exam') return `<div class="gen-hud">${quit}
    <div class="gen-hud-q"><span class="mono">${run.idx + 1}/${run.pool.length}</span><span class="gen-hud-l">question</span></div>
    ${run.examCountdown ? `<div class="gen-hud-time"><span class="mono" id="gen-time">${ccmaClock(run.examCountdown)}</span><span class="gen-hud-l">left</span></div>` : ''}
    ${run.isMock || run.lives > 10 ? '' : `<div class="gen-hud-lives">${'◆'.repeat(Math.max(0, run.lives))}${'◇'.repeat(Math.max(0, 3 - run.lives))}</div>`}
    <div class="gen-hud-score"><span class="mono">${run.correct}</span><span class="gen-hud-l">correct</span></div>
    ${run.isMock ? `<div class="gen-hud-score"><span class="mono">${run.answered ? Math.round(run.correct / run.answered * 100) : 0}%</span><span class="gen-hud-l">score</span></div>` : ''}</div>`;
  if (run.mode === 'smart' && run.endless) {
    const bank = (typeof ccmaActiveBank === 'function' ? ccmaActiveBank() : CCMA_BANK);
    const mastered = bank.filter(q => ccmaBox(q.id) >= 5).length;
    return `<div class="gen-hud">${quit}
    <div class="gen-hud-q"><span class="mono">${mastered}/${bank.length}</span><span class="gen-hud-l">mastered</span></div>
    <div class="gen-hud-q"><span class="mono">${ccmaOverall()}%</span><span class="gen-hud-l">competency</span></div>
    <div class="gen-hud-combo ${run.combo >= 3 ? 'hot' : ''}"><span class="mono">${run.combo}×</span><span class="gen-hud-l">streak</span></div>
    <div class="gen-hud-score"><span class="mono">${run.correct}/${run.answered}</span><span class="gen-hud-l">correct</span></div></div>`;
  }
  const label = run.mode === 'smart' ? 'Smart Review' : run.mode === 'misses' ? 'Review misses' : run.mode === 'starred' ? 'Starred' : run.mode === 'topic' ? (CCMA_TOPICS[run.topic] ? CCMA_TOPICS[run.topic].name : 'Drill') : `Ch ${run.chapter}`;
  return `<div class="gen-hud">${quit}
    <div class="gen-hud-q"><span class="mono">${run.idx + 1}/${run.pool.length}</span><span class="gen-hud-l">${esc(label)}</span></div>
    <div class="gen-hud-combo ${run.combo >= 3 ? 'hot' : ''}"><span class="mono">${run.combo}×</span><span class="gen-hud-l">streak</span></div>
    <div class="gen-hud-score"><span class="mono">${run.correct}/${run.answered}</span><span class="gen-hud-l">correct</span></div></div>`;
}

function ccmaFlash(scope, big, small, good) {
  const f = el(`<div class="gen-flash ${good ? 'good' : 'bad'}"><span class="gen-flash-big">${esc(big)}</span>${small ? `<span class="gen-flash-small">${esc(small)}</span>` : ''}</div>`);
  scope.appendChild(f); requestAnimationFrame(() => f.classList.add('in'));
  setTimeout(() => { f.classList.remove('in'); setTimeout(() => f.remove(), 300); }, 700);
}
document.addEventListener('click', (e) => { if (e.target && e.target.id === 'ccma-quit') { ccmaClearTimer(); CCMA_POOL_FILTER = null; renderCcmaHome(); } });

/* ============================================================================
   RESULTS
   ========================================================================= */
function ccmaEndRun(run) {
  ccmaClearTimer();
  const acc = run.answered ? Math.round(run.correct / run.answered * 100) : 0;
  let headline = '', sub = '', extra = '';
  const grid = (cells) => `<div class="gen-res-grid">${cells.map(c => `<div><span class="mono">${c[0]}</span><span>${c[1]}</span></div>`).join('')}</div>`;

  if (run.mode === 'blitz') {
    const best = run.score > CCMA.bestScore; if (best) CCMA.bestScore = run.score;
    if (run.score >= 500) ccmaGrant('blitz500');
    if (acc === 100 && run.answered >= 8) ccmaGrant('perfect');
    headline = best ? 'NEW HIGH SCORE' : 'Time!'; sub = `${run.score} points`;
    extra = grid([[`${run.correct}/${run.answered}`, 'answered'], [`${acc}%`, 'accuracy'], [`${run.maxCombo}×`, 'best combo'], [`${CCMA.bestScore}`, 'all-time best']]);
  } else if (run.mode === 'exam' && run.isMock) {
    if (acc > (CCMA.bestMock || 0)) CCMA.bestMock = acc;
    if (acc >= 70) ccmaGrant('mock'); if (acc >= 80) ccmaGrant('mock80');
    const pass = acc >= CCMA_EXAM.passRawPct;
    headline = pass ? 'PASS LINE CLEARED' : 'Below pass line'; sub = `${acc}% · ${run.correct}/${run.answered}`;
    extra = grid([[`${acc}%`, 'your score'], [`${CCMA_EXAM.passRawPct}%`, 'pass bar'], [`${run.answered}`, 'questions'], [`${CCMA.bestMock || 0}%`, 'best mock']]);
  } else if (run.mode === 'exam') {
    const beat = acc >= 85 && run.lives > 0; if (acc > CCMA.bestExam) CCMA.bestExam = acc; if (beat) ccmaGrant('exam');
    headline = run.lives <= 0 ? 'BOSS WINS' : (beat ? 'BOSS DEFEATED' : 'Boss survives'); sub = `${acc}% · ${run.correct}/${run.answered}`;
    extra = grid([[`${acc}%`, 'score'], [`${run.maxCombo}×`, 'best combo'], [`${run.lives}`, 'lives left'], [`${CCMA.bestExam}%`, 'best ever']]);
  } else if (run.mode === 'smart') {
    ccmaGrant('smart'); if (acc === 100 && run.answered >= 8) ccmaGrant('perfect');
    headline = 'Smart Review done'; sub = `${ccmaOverall()}% overall competency`;
    extra = grid([[`${run.correct}/${run.answered}`, 'correct'], [`${acc}%`, 'accuracy'], [`+${run.maxCombo}`, 'best streak'], [`${ccmaOverall()}%`, 'competency']]);
  } else if (run.mode === 'topic') {
    headline = 'Drill complete'; sub = `${CCMA_TOPICS[run.topic] ? CCMA_TOPICS[run.topic].name : ''} · ${ccmaComp(ccmaTopicQs(run.topic))}%`;
    extra = grid([[`${run.correct}/${run.answered}`, 'correct'], [`${acc}%`, 'accuracy'], [`${ccmaComp(ccmaTopicQs(run.topic))}%`, 'topic competency'], [`${ccmaOverall()}%`, 'overall']]);
  } else if (run.mode === 'misses' || run.mode === 'starred') {
    if (acc === 100 && run.answered >= 8) ccmaGrant('perfect');
    headline = run.mode === 'misses' ? 'Misses reviewed' : 'Starred reviewed'; sub = `${run.correct}/${run.answered} correct`;
    extra = grid([[`${run.correct}/${run.answered}`, 'correct'], [`${acc}%`, 'accuracy'], [`${ccmaMissPool().length}`, 'misses left'], [`${ccmaOverall()}%`, 'competency']]);
  } else {
    if (acc === 100 && run.answered >= 8) ccmaGrant('perfect');
    headline = 'Chapter complete'; sub = `Ch ${run.chapter} · ${ccmaMastery(run.chapter)}% mastered`;
    extra = grid([[`${run.correct}/${run.answered}`, 'correct'], [`${acc}%`, 'accuracy'], [`${run.maxCombo}×`, 'best streak'], [`${ccmaMastery(run.chapter)}%`, 'mastery']]);
  }
  ccmaCheckAch(); ccmaSave();
  ccmaTrack('run_end', { mode: run.mode, answered: run.answered, correct: run.correct, accuracy: acc, score: run.score, maxCombo: run.maxCombo, competency: ccmaOverall() });
  const status = ccmaStatus();

  const root = el('<div></div>');
  root.appendChild(topbar('ccma'));
  const main = el(`<main class="panel gen-result" id="main" tabindex="-1">
    <div class="gen-res-box cornerframe">
      <span class="label">${esc(headline)}</span>
      <h1 class="gen-res-sub">${esc(sub)}</h1>
      ${extra}
      ${status.cls === 'ready' ? '<p class="gen-res-ready">EXAM READY — 90%+ competency. Keep Smart Review warm.</p>' : ''}
      <p class="gen-res-xp mono">${CCMA.xp.toLocaleString()} XP total · LV ${ccmaRank(CCMA.xp).lvl} ${esc(ccmaRank(CCMA.xp).name)}</p>
      <div class="gen-res-btns">
        <button class="btn btn-solid" id="gen-again">${run.mode === 'blitz' ? 'Run it back' : run.isMock ? 'New mock' : run.mode === 'exam' ? 'Rematch' : run.mode === 'smart' ? 'Another set' : 'Again'}</button>
        <button class="btn" id="gen-homebtn">Home</button>
      </div>
    </div>
  </main>`);
  main.querySelector('#gen-homebtn').addEventListener('click', renderCcmaHome);
  main.querySelector('#gen-again').addEventListener('click', () => {
    if (run.mode === 'blitz') startCcmaBlitz();
    else if (run.isMock) renderCcmaMockIntro();
    else if (run.mode === 'exam') startCcmaExam();
    else if (run.mode === 'smart') startCcmaSmart();
    else if (run.mode === 'misses') startCcmaMisses();
    else if (run.mode === 'starred') startCcmaStarred();
    else if (run.mode === 'topic') startCcmaTopic(run.topic);
    else startCcmaChapter(run.chapter);
  });
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

/* ============================================================================
   ACTIVE-POOL FILTER  (lets a mode scope Smart Review to a subset; null = full bank)
   ========================================================================= */
let CCMA_POOL_FILTER = null;
function ccmaActiveBank() { return CCMA_POOL_FILTER || CCMA_BANK; }
