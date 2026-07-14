/* ============================================================================
   Cortex · CCMA — SOAP NOTES SIMULATOR  ("Clinic Sim")
   A simulated exam-room EHR workstation. You (the MA) room real patients,
   verify identity, take vitals, document the visit, and sort every finding
   into the right SOAP bucket — then sign & lock the chart.

   Built for active recall + retention: every step is a graded interaction
   with immediate teaching feedback, and completing a chart feeds the same
   XP / rank loop as the rest of the CCMA trainer. Scenarios rotate so you
   swap patients instead of grinding one (ADHD-friendly).

   Self-contained: uses ccma.js globals (el, esc, topbar, siteFooter, setView,
   CCMA, ccmaSave, ccmaClearTimer, ccmaTrack, renderCcmaHome, ccmaRank,
   ccmaGrant, ccmaBumpStreak, ccmaShuffle, ccmaRand, ccmaToast). Scenario data
   loads from data/ccma-soap.json. Progress lives under CCMA.soap.
   ========================================================================= */

/* ---------- data load ---------- */
let CCMA_SOAP_DATA = [];
let ccmaSoapReady = false, ccmaSoapFailed = false;

function ccmaSoapValid(s) {
  return s && typeof s === 'object'
    && typeof s.id === 'string' && s.id
    && s.patient && typeof s.patient === 'object'
    && Array.isArray(s.steps) && s.steps.length
    && s.soap && Array.isArray(s.soap.S) && Array.isArray(s.soap.O)
    && Array.isArray(s.soap.A) && Array.isArray(s.soap.P);
}
async function ccmaLoadSoap() {
  if (ccmaSoapReady) return;
  try {
    const r = await fetch('data/ccma-soap.json?v=2');
    if (!r.ok) throw new Error('http ' + r.status);
    const data = await r.json();
    const list = Array.isArray(data) ? data : (data.scenarios || []);
    CCMA_SOAP_DATA = list.filter(ccmaSoapValid);
    ccmaSoapReady = true; ccmaSoapFailed = false;
  } catch (e) { ccmaSoapFailed = true; }
}

/* ---------- progress ---------- */
function soapStore() {
  if (!CCMA.soap || typeof CCMA.soap !== 'object') CCMA.soap = { done: {}, charts: 0 };
  if (!CCMA.soap.done) CCMA.soap.done = {};
  if (typeof CCMA.soap.charts !== 'number') CCMA.soap.charts = 0;
  return CCMA.soap;
}
function soapBest(id) { const s = soapStore(); return (s.done[id] && s.done[id].best) || 0; }
function soapIsDone(id) { const s = soapStore(); return !!s.done[id]; }
function soapCompletedCount() { const s = soapStore(); return Object.keys(s.done).length; }

/* ---------- vital ranges (teaching-standard, age-banded) ---------- */
function soapAgeBand(age) { if (age >= 12) return 'adult'; if (age >= 6) return 'child'; if (age >= 1) return 'preschool'; return 'infant'; }
const SOAP_VRANGE = {
  adult:     { tempF: [97.0, 99.5], pulse: [60, 100],  resp: [12, 20], sys: [90, 120], dia: [60, 80], spo2: [95, 100] },
  child:     { tempF: [97.0, 99.5], pulse: [70, 110],  resp: [18, 25], sys: [90, 115], dia: [55, 82], spo2: [95, 100] },
  preschool: { tempF: [97.0, 99.5], pulse: [80, 120],  resp: [20, 30], sys: [90, 110], dia: [50, 80], spo2: [95, 100] },
  infant:    { tempF: [97.0, 99.5], pulse: [100, 160], resp: [30, 60], sys: [70, 100], dia: [45, 70], spo2: [95, 100] },
};
function soapVitalRows(scn) {
  const v = scn.vitals || {}, band = soapAgeBand(scn.patient.age || 18), R = SOAP_VRANGE[band];
  const inR = (x, r) => x >= r[0] && x <= r[1];
  const rows = [];
  if (v.tempF != null) rows.push({ key: 'tempF', label: 'Temp', value: Number(v.tempF).toFixed(1), unit: '°F', scored: true, abnormal: !inR(v.tempF, R.tempF), range: `${R.tempF[0].toFixed(1)}–${R.tempF[1].toFixed(1)} °F` });
  if (v.pulse != null) rows.push({ key: 'pulse', label: 'Pulse', value: String(v.pulse), unit: 'bpm', scored: true, abnormal: !inR(v.pulse, R.pulse), range: `${R.pulse[0]}–${R.pulse[1]} bpm` });
  if (v.resp != null) rows.push({ key: 'resp', label: 'Resp', value: String(v.resp), unit: '/min', scored: true, abnormal: !inR(v.resp, R.resp), range: `${R.resp[0]}–${R.resp[1]}/min` });
  if (v.systolic != null && v.diastolic != null) rows.push({ key: 'bp', label: 'Blood pressure', value: `${v.systolic}/${v.diastolic}`, unit: 'mmHg', scored: true, abnormal: !inR(v.systolic, R.sys) || !inR(v.diastolic, R.dia), range: `${R.sys[0]}–${R.sys[1]} / ${R.dia[0]}–${R.dia[1]}` });
  if (v.spo2 != null) rows.push({ key: 'spo2', label: 'SpO₂', value: String(v.spo2), unit: '%', scored: true, abnormal: !inR(v.spo2, R.spo2), range: `${R.spo2[0]}–${R.spo2[1]} %` });
  if (v.glucose != null) rows.push({ key: 'glucose', label: 'POC glucose', value: String(v.glucose), unit: 'mg/dL', scored: true, abnormal: (v.glucose < 70 || v.glucose >= 140), range: '70–139 mg/dL' });
  if (v.painScore != null) rows.push({ key: 'pain', label: 'Pain', value: String(v.painScore), unit: '/10', scored: false, range: '0–10 scale' });
  if (v.peakFlow != null) rows.push({ key: 'peakFlow', label: 'Peak flow', value: String(v.peakFlow), unit: 'L/min', scored: false, range: 'vs. personal best' });
  if (v.heightIn != null) { const ft = Math.floor(v.heightIn / 12), inch = Math.round(v.heightIn % 12); rows.push({ key: 'ht', label: 'Height', value: `${ft}′${inch}″`, unit: '', scored: false, range: '' }); }
  if (v.weightLb != null) rows.push({ key: 'wt', label: 'Weight', value: String(v.weightLb), unit: 'lb', scored: false, range: '' });
  if (v.heightIn != null && v.weightLb != null) { const bmi = 703 * v.weightLb / (v.heightIn * v.heightIn); rows.push({ key: 'bmi', label: 'BMI', value: bmi.toFixed(1), unit: '', scored: false, range: '703 × lb ÷ in²' }); }
  return rows;
}

/* ---------- EHR shell pieces ---------- */
const SOAP_BUCKETS = { S: 'Subjective', O: 'Objective', A: 'Assessment', P: 'Plan' };
const SOAP_OWNER = { S: 'MA documents', O: 'MA documents', A: 'Provider', P: 'Provider' };

function soapClock(main) {
  const t = main.querySelector('#soap-clock');
  const tick = () => {
    if (!document.body.contains(main)) { ccmaClearTimer(); return; }
    if (t) { const d = new Date(); let h = d.getHours(); const mm = String(d.getMinutes()).padStart(2, '0'); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; t.textContent = `${h}:${mm} ${ap}`; }
  };
  tick(); ccmaTimer = setInterval(tick, 15000);
}
function soapEhrBar(sim) {
  return `<div class="soap-ehrbar">
    <span class="soap-ehr-clinic mono">CORTEX CLINIC · ${esc((sim.scn.setting || 'Family Medicine').toUpperCase())}</span>
    <span class="soap-ehr-room mono">EXAM ${esc(sim.room)}</span>
    <span class="soap-ehr-clock mono" id="soap-clock">—</span>
    <span class="soap-ehr-user mono">MA: K. VIGIL</span>
    <button class="soap-ehr-exit" id="soap-exit">Sign out ✕</button>
  </div>`;
}
function soapBanner(sim) {
  const p = sim.scn.patient;
  const alg = (p.allergies && p.allergies.length ? p.allergies : ['NKDA']).join(', ');
  const noAlg = /^\s*(nkda|none|no known)/i.test(alg);
  return `<div class="soap-banner">
    <div class="soap-banner-id">
      <span class="soap-pt-name">${esc(p.name)}</span>
      <span class="soap-pt-demo mono">${p.age} ${esc(p.sex)} · DOB ${esc(p.dob)} · MRN ${esc(p.mrn)}</span>
    </div>
    <div class="soap-banner-meta">
      <span class="soap-alrt ${noAlg ? 'soap-alrt-none' : ''}">ALLERGIES: ${esc(alg)}</span>
      <span class="soap-pt-reason">Visit: ${esc(p.reason)}</span>
    </div>
  </div>`;
}
function soapStepLabel(step) {
  if (step.kind === 'vitals') return 'Vitals';
  if (step.kind === 'sort') return 'SOAP note';
  const t = (step.tag || '').toLowerCase();
  if (t.includes('id') || t.includes('ident')) return 'Verify ID';
  if (t.includes('scope')) return 'Scope';
  if (t.includes('chief') || t.includes('complaint') || t.includes('cc')) return 'Chief complaint';
  return step.tag || 'Document';
}
function soapStepper(sim) {
  const nodes = sim.steps.map((st, i) => {
    const cls = i < sim.idx ? 'done' : (i === sim.idx ? 'cur' : '');
    return `<span class="soap-step ${cls}"><span class="soap-step-dot mono">${i < sim.idx ? '✓' : i + 1}</span>${esc(soapStepLabel(st))}</span>`;
  });
  const signCls = sim.idx >= sim.steps.length ? 'cur' : '';
  nodes.push(`<span class="soap-step ${signCls}"><span class="soap-step-dot mono">✓</span>Sign &amp; lock</span>`);
  return `<div class="soap-stepper">${nodes.join('<span class="soap-step-sep">›</span>')}</div>`;
}

/* live chart panel that fills in as the visit progresses */
function soapFlowsheetHtml(scn, reveal) {
  const rows = soapVitalRows(scn).map(r => {
    const flag = reveal && r.scored && r.abnormal;
    return `<div class="soap-vrow ${flag ? 'abn' : ''}"><span class="soap-vlab">${esc(r.label)}</span><span class="soap-vval mono">${esc(r.value)}<span class="soap-vunit">${esc(r.unit)}</span></span>${flag ? '<span class="soap-vflag">ABNORMAL</span>' : ''}</div>`;
  }).join('');
  return `<div class="soap-flow">${rows}</div>`;
}
function soapNoteHtml(scn) {
  const sec = (k) => `<div class="soap-note-sec">
      <div class="soap-note-h"><span class="soap-note-k mono">${k}</span><span class="soap-note-t">${SOAP_BUCKETS[k]}</span><span class="soap-note-own">${SOAP_OWNER[k]}</span></div>
      <ul>${(scn.soap[k] || []).map(x => `<li>${esc(x)}</li>`).join('') || '<li class="soap-dim">—</li>'}</ul>
    </div>`;
  return `<div class="soap-note">${['S', 'O', 'A', 'P'].map(sec).join('')}</div>`;
}
function soapChartPanel(sim) {
  const scn = sim.scn;
  return `<aside class="soap-chart cornerframe">
    <span class="label">Live chart</span>
    <div class="soap-chart-cc"><span class="soap-chart-lab mono">CHIEF COMPLAINT</span><p>${esc(scn.patient.reason)}</p></div>
    <div class="soap-chart-blk"><span class="soap-chart-lab mono">VITALS</span>${sim.vitalsShown ? soapFlowsheetHtml(scn, true) : '<p class="soap-pending">Not yet recorded.</p>'}</div>
    <div class="soap-chart-blk"><span class="soap-chart-lab mono">SOAP NOTE</span>${sim.noteShown ? soapNoteHtml(scn) : '<p class="soap-pending">Documentation in progress…</p>'}</div>
  </aside>`;
}

/* shared frame: EHR bar + banner + stepper + [work column | chart panel] */
function soapFrame(sim, workHtml) {
  const root = el('<div></div>');
  root.appendChild(topbar('ccma'));
  const main = el(`<main class="panel soap-ehr" id="main" tabindex="-1">
    ${soapEhrBar(sim)}
    ${soapBanner(sim)}
    ${soapStepper(sim)}
    <div class="soap-layout">
      <section class="soap-work">${workHtml}</section>
      ${soapChartPanel(sim)}
    </div>
  </main>`);
  main.querySelector('#soap-exit').addEventListener('click', () => {
    if (sim.idx < sim.steps.length && !confirm('Leave this chart? Progress on this visit won\'t be saved.')) return;
    renderCcmaSoapHome();
  });
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
  soapClock(main);
  return main;
}

/* ============================================================================
   SIM HOME  (waiting-room patient queue)
   ========================================================================= */
function renderCcmaSoapHome() {
  ccmaClearTimer();
  if (!ccmaSoapReady) {
    if (ccmaSoapFailed) {
      const root = el('<div></div>'); root.appendChild(topbar('ccma'));
      const m = el('<main class="panel gen-lock" id="main" tabindex="-1"><div class="gen-lock-box cornerframe"><span class="label">Clinic Sim</span><p class="gen-lock-sub">Couldn\'t load scenarios — check your connection.</p><button class="btn btn-solid" id="soap-retry">Retry</button></div></main>');
      m.querySelector('#soap-retry').addEventListener('click', () => { ccmaSoapFailed = false; renderCcmaSoapHome(); });
      root.appendChild(m); root.appendChild(siteFooter()); setView(root); return;
    }
    const root = el('<div></div>'); root.appendChild(topbar('ccma'));
    root.appendChild(el('<main class="panel gen-lock" id="main" tabindex="-1"><div class="gen-lock-box cornerframe"><span class="label">Clinic Sim</span><p class="gen-lock-sub">Booting the clinic workstation…</p></div></main>'));
    root.appendChild(siteFooter()); setView(root);
    ccmaLoadSoap().then(renderCcmaSoapHome); return;
  }
  ccmaTrack('soap_home', { done: soapCompletedCount(), total: CCMA_SOAP_DATA.length });
  const total = CCMA_SOAP_DATA.length, done = soapCompletedCount();
  const nextId = soapPickNext(null);

  const cards = CCMA_SOAP_DATA.map(scn => {
    const best = soapBest(scn.id), isDone = soapIsDone(scn.id);
    const p = scn.patient;
    return `<button class="soap-pcard cornerframe ${isDone ? 'done' : ''}" data-scn="${esc(scn.id)}">
      <div class="soap-pcard-top">
        <span class="soap-pcard-tag mono">${esc((scn.setting || '').toUpperCase())}</span>
        <span class="soap-pcard-diff gen-d-${esc(scn.difficulty || 'med')}">${esc(scn.difficulty || 'med')}</span>
      </div>
      <h3>${esc(p.name)} <span class="mono soap-pcard-age">${p.age}${esc(p.sex)}</span></h3>
      <p class="soap-pcard-cc">${esc(scn.chiefLine || p.reason)}</p>
      <div class="soap-pcard-foot">
        <span class="mono">${(scn.steps || []).length} steps · ~${scn.estMin || 6} min</span>
        <span class="soap-pcard-status mono">${isDone ? `✓ ${best}%` : 'Not charted'}</span>
      </div>
    </button>`;
  }).join('');

  const root = el('<div></div>');
  root.appendChild(topbar('ccma'));
  const main = el(`<main class="panel gen-pick soap-hub" id="main" tabindex="-1">
    <div class="gen-pick-head"><button class="ghostbtn" id="soap-back">← CCMA home</button><h1>Clinic Sim — SOAP notes</h1></div>

    <section class="soap-intro cornerframe">
      <div class="soap-intro-l">
        <span class="label">You are the medical assistant on shift</span>
        <p>Real patients hit your schedule. For each one you'll <b>verify their identity</b>, <b>take &amp; flag vitals</b>, <b>document the chief complaint</b>, and <b>sort every finding into the right SOAP bucket</b> — then sign &amp; lock the chart. Every step is graded with instant teaching, so you build the muscle memory a real clinic (and the CCMA exam) expects.</p>
        <ul class="soap-intro-facts">
          <li><b>S</b>ubjective &amp; <b>O</b>bjective = what <b>you</b> document.</li>
          <li><b>A</b>ssessment &amp; <b>P</b>lan = the <b>provider's</b> call — you learn to recognize them, not write them.</li>
          <li>Charts <b>rotate</b> — finish one, get sent a different patient. No hyperfocus grind.</li>
        </ul>
      </div>
      <div class="soap-intro-r">
        <div class="soap-intro-ring"><span class="mono">${done}/${total}</span><span>charts</span></div>
        <button class="btn btn-solid" id="soap-next">${done ? 'Next patient →' : 'Start first patient →'}</button>
      </div>
    </section>

    <span class="label" style="display:block;margin:.4rem 0 .6rem">Your patient queue — tap a chart to open the room</span>
    <div class="soap-queue">${cards}</div>
  </main>`);

  main.querySelector('#soap-back').addEventListener('click', renderCcmaHome);
  main.querySelector('#soap-next').addEventListener('click', () => { if (nextId) startCcmaSoap(nextId); });
  main.querySelectorAll('[data-scn]').forEach(b => b.addEventListener('click', () => startCcmaSoap(b.dataset.scn)));
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}

/* rotation: prefer an unseen chart, else the lowest-scored, never the current one */
function soapPickNext(currentId) {
  const pool = CCMA_SOAP_DATA.filter(s => s.id !== currentId);
  if (!pool.length) return currentId;
  const unseen = pool.filter(s => !soapIsDone(s.id));
  if (unseen.length) return ccmaShuffle(unseen)[0].id;
  const sorted = pool.slice().sort((a, b) => soapBest(a.id) - soapBest(b.id));
  return sorted[0].id;
}

/* ============================================================================
   RUN A VISIT
   ========================================================================= */
function startCcmaSoap(id) {
  const scn = CCMA_SOAP_DATA.find(s => s.id === id);
  if (!scn) { renderCcmaSoapHome(); return; }
  const sim = {
    scn, steps: scn.steps, idx: 0,
    room: String(ccmaRand(1, 8)),
    points: 0, total: 0,
    vitalsShown: false, noteShown: false,
    mistakes: [],
  };
  ccmaBumpStreak(); ccmaSave();
  ccmaTrack('soap_start', { id, difficulty: scn.difficulty });
  soapRenderStep(sim);
}

function soapRenderStep(sim) {
  ccmaClearTimer();
  if (sim.idx >= sim.steps.length) { ccmaSoapComplete(sim); return; }
  const step = sim.steps[sim.idx];
  if (step.kind === 'vitals') return soapStepVitals(sim, step);
  if (step.kind === 'sort') return soapStepSort(sim, step);
  return soapStepMcq(sim, step);
}
function soapAdvance(sim) { sim.idx++; soapRenderStep(sim); }

/* ---------- MCQ step (ID check, chief complaint, scope, terminology, POC) ---------- */
function soapStepMcq(sim, step) {
  const opts = (step.options || []).map((text, i) => ({ text, ok: i === step.answer }));
  const order = ccmaShuffle(opts);
  const work = `<div class="soap-task cornerframe">
    <span class="soap-task-tag mono">${esc(step.tag || 'Documentation')}</span>
    <h2 class="soap-task-q">${esc(step.stem || '')}</h2>
    <div class="gen-opts soap-mcq">
      ${order.map((o, i) => `<button class="gen-opt" data-i="${i}" data-ok="${o.ok ? 1 : 0}"><span class="gen-opt-key mono">${String.fromCharCode(65 + i)}</span><span class="gen-opt-txt">${esc(o.text)}</span></button>`).join('')}
    </div>
    <div class="gen-explain" id="soap-ex" hidden></div>
    <div class="gen-next-row" id="soap-nextrow" hidden><button class="btn btn-solid" id="soap-next-btn">Continue →</button></div>
  </div>`;
  const main = soapFrame(sim, work);
  const wrap = main.querySelector('.soap-mcq'), ex = main.querySelector('#soap-ex'), nr = main.querySelector('#soap-nextrow');
  let locked = false;
  wrap.querySelectorAll('.gen-opt').forEach(btn => btn.addEventListener('click', () => {
    if (locked) return; locked = true;
    const right = btn.dataset.ok === '1';
    sim.total++; if (right) sim.points++; else sim.mistakes.push(soapStepLabel(step));
    wrap.querySelectorAll('.gen-opt').forEach(o => { o.disabled = true; if (o.dataset.ok === '1') o.classList.add('correct'); else if (o === btn) o.classList.add('wrong'); });
    ex.innerHTML = `<span class="gen-ex-label">${right ? 'Correct' : 'Not quite'}</span> ${esc(step.explain || '')}`;
    ex.hidden = false; nr.hidden = false;
    const nb = main.querySelector('#soap-next-btn'); nb.addEventListener('click', () => soapAdvance(sim)); nb.focus();
    ccmaTrack('soap_step', { id: sim.scn.id, kind: 'mcq', tag: step.tag, correct: right ? 1 : 0 });
  }));
}

/* ---------- Vitals step (take readings; flag every abnormal one) ---------- */
function soapStepVitals(sim, step) {
  const rows = soapVitalRows(sim.scn);
  const scored = rows.filter(r => r.scored);
  const flagged = new Set();
  const rowHtml = rows.map((r, i) => {
    if (!r.scored) return `<div class="soap-vrow soap-vrow-info"><span class="soap-vlab">${esc(r.label)}</span><span class="soap-vval mono">${esc(r.value)}<span class="soap-vunit">${esc(r.unit)}</span></span><span class="soap-vinfo mono">info</span></div>`;
    return `<button type="button" class="soap-vrow soap-vrow-btn" data-k="${esc(r.key)}"><span class="soap-vlab">${esc(r.label)}</span><span class="soap-vval mono">${esc(r.value)}<span class="soap-vunit">${esc(r.unit)}</span></span><span class="soap-vtap mono">tap if abnormal</span></button>`;
  }).join('');
  const work = `<div class="soap-task cornerframe">
    <span class="soap-task-tag mono">Vitals station</span>
    <h2 class="soap-task-q">Record the vitals, then flag <b>every</b> reading outside the normal range for this patient.</h2>
    <p class="soap-task-hint">Ranges are age-adjusted — a ${sim.scn.patient.age}-year-old isn't held to adult numbers. Tap the abnormal ones, then check.</p>
    <div class="soap-flow soap-flow-live">${rowHtml}</div>
    <div class="gen-explain" id="soap-ex" hidden></div>
    <div class="gen-next-row"><button class="btn btn-solid" id="soap-check">Check vitals</button></div>
  </div>`;
  const main = soapFrame(sim, work);
  const ex = main.querySelector('#soap-ex');
  main.querySelectorAll('.soap-vrow-btn').forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.locked) return;
    const k = btn.dataset.k;
    if (flagged.has(k)) { flagged.delete(k); btn.classList.remove('sel'); } else { flagged.add(k); btn.classList.add('sel'); }
  }));
  const checkBtn = main.querySelector('#soap-check');
  checkBtn.addEventListener('click', () => {
    if (checkBtn.dataset.done) { soapAdvance(sim); return; }
    checkBtn.dataset.done = '1';
    let correct = 0;
    scored.forEach(r => {
      const btn = main.querySelector(`.soap-vrow-btn[data-k="${r.key}"]`);
      if (btn) btn.dataset.locked = '1';
      const userFlag = flagged.has(r.key);
      if (userFlag === r.abnormal) correct++;
      if (btn) {
        btn.classList.remove('sel');
        const tap = btn.querySelector('.soap-vtap');
        if (r.abnormal) { btn.classList.add('abn'); if (tap) tap.textContent = userFlag ? '✓ abnormal — you caught it' : '✗ missed — ABNORMAL'; }
        else { btn.classList.add(userFlag ? 'wrong' : 'ok'); if (tap) tap.textContent = userFlag ? '✗ this one is normal' : '✓ normal'; }
        if (tap) tap.classList.add('soap-vtap-res');
        btn.insertAdjacentHTML('beforeend', `<span class="soap-vrange mono">normal ${esc(r.range)}</span>`);
      }
    });
    const frac = scored.length ? correct / scored.length : 1;
    sim.points += frac; sim.total += 1; sim.vitalsShown = true;
    if (frac < 1) sim.mistakes.push('Vitals');
    ex.innerHTML = `<span class="gen-ex-label">${correct}/${scored.length} correct</span> ${esc(step.explain || 'Compare each reading to the age-appropriate range. Anything outside gets flagged and reported to the provider.')}`;
    ex.hidden = false;
    checkBtn.textContent = 'Continue →'; checkBtn.focus();
    ccmaTrack('soap_step', { id: sim.scn.id, kind: 'vitals', correct, of: scored.length });
  });
}

/* ---------- SOAP sort step (classify findings into S / O / A / P) ---------- */
function soapStepSort(sim, step) {
  const items = ccmaShuffle((step.items || []).map((it, i) => ({ text: it.text, bucket: it.bucket, i })));
  const picks = {}; // idx -> chosen bucket
  const rowHtml = items.map((it, i) => `<div class="soap-sitem" data-i="${i}">
      <p class="soap-sitem-t">${esc(it.text)}</p>
      <div class="soap-bkrow">${['S', 'O', 'A', 'P'].map(k => `<button type="button" class="soap-bk" data-i="${i}" data-k="${k}" title="${SOAP_BUCKETS[k]}">${k}</button>`).join('')}</div>
    </div>`).join('');
  const work = `<div class="soap-task cornerframe">
    <span class="soap-task-tag mono">Build the note</span>
    <h2 class="soap-task-q">${esc(step.intro || 'Sort every finding into the correct SOAP section.')}</h2>
    <p class="soap-task-hint"><b class="mono">S</b> patient says · <b class="mono">O</b> you measure/observe · <b class="mono">A</b> provider's diagnosis · <b class="mono">P</b> provider's plan</p>
    <div class="soap-sort">${rowHtml}</div>
    <div class="gen-explain" id="soap-ex" hidden></div>
    <div class="gen-next-row"><button class="btn btn-solid" id="soap-check">Check note</button></div>
  </div>`;
  const main = soapFrame(sim, work);
  const ex = main.querySelector('#soap-ex');
  main.querySelectorAll('.soap-bk').forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.locked) return;
    const i = btn.dataset.i, k = btn.dataset.k;
    picks[i] = k;
    main.querySelectorAll(`.soap-bk[data-i="${i}"]`).forEach(b => b.classList.toggle('sel', b.dataset.k === k));
  }));
  const checkBtn = main.querySelector('#soap-check');
  checkBtn.addEventListener('click', () => {
    if (checkBtn.dataset.done) { soapAdvance(sim); return; }
    checkBtn.dataset.done = '1';
    let correct = 0;
    items.forEach((it, i) => {
      const chosen = picks[i];
      const rowBtns = main.querySelectorAll(`.soap-bk[data-i="${i}"]`);
      rowBtns.forEach(b => { b.dataset.locked = '1'; b.disabled = true; });
      const right = chosen === it.bucket;
      if (right) correct++;
      rowBtns.forEach(b => {
        if (b.dataset.k === it.bucket) b.classList.add('correct');
        else if (b.dataset.k === chosen) b.classList.add('wrong');
        b.classList.remove('sel');
      });
      const row = main.querySelector(`.soap-sitem[data-i="${i}"]`);
      if (row) row.insertAdjacentHTML('beforeend', `<span class="soap-sitem-key mono ${right ? 'ok' : 'no'}">${right ? '✓' : '✗'} ${it.bucket} · ${SOAP_BUCKETS[it.bucket]} <em>(${SOAP_OWNER[it.bucket]})</em></span>`);
    });
    const frac = items.length ? correct / items.length : 1;
    sim.points += frac; sim.total += 1; sim.noteShown = true;
    if (frac < 1) sim.mistakes.push('SOAP sorting');
    ex.innerHTML = `<span class="gen-ex-label">${correct}/${items.length} placed right</span> Subjective &amp; Objective are yours to document; Assessment &amp; Plan belong to the provider. Your finished note is now in the chart →`;
    ex.hidden = false;
    checkBtn.textContent = 'Continue →'; checkBtn.focus();
    ccmaTrack('soap_step', { id: sim.scn.id, kind: 'sort', correct, of: items.length });
  });
}

/* ============================================================================
   SIGN & LOCK  (results)
   ========================================================================= */
function ccmaSoapComplete(sim) {
  ccmaClearTimer();
  const scn = sim.scn;
  const acc = sim.total ? Math.round(sim.points / sim.total * 100) : 0;
  const diffBonus = scn.difficulty === 'hard' ? 15 : scn.difficulty === 'med' ? 8 : 3;
  const xp = Math.round(sim.points * 10) + 20 + diffBonus;
  CCMA.xp += xp;

  const store = soapStore();
  const prevBest = soapBest(scn.id);
  const first = !soapIsDone(scn.id);
  store.done[scn.id] = { best: Math.max(prevBest, acc), plays: ((store.done[scn.id] && store.done[scn.id].plays) || 0) + 1, ts: Date.now() };
  store.charts++;
  ccmaSave();

  ccmaGrant('soap-first');
  if (acc === 100) ccmaGrant('soap-perfect');
  if (soapCompletedCount() >= CCMA_SOAP_DATA.length && CCMA_SOAP_DATA.length) ccmaGrant('soap-all');
  ccmaToast('Chart saved & locked');
  ccmaTrack('soap_done', { id: scn.id, acc, xp, first });

  const nextId = soapPickNext(scn.id);
  const teach = (scn.teaching || []).map(t => `<li>${esc(t)}</li>`).join('');

  const root = el('<div></div>');
  root.appendChild(topbar('ccma'));
  const main = el(`<main class="panel soap-ehr" id="main" tabindex="-1">
    ${soapEhrBar(sim)}
    ${soapBanner(sim)}
    <div class="soap-signed cornerframe">
      <div class="soap-signed-head">
        <span class="soap-lock mono">CHART SIGNED &amp; LOCKED</span>
        <span class="soap-signed-acc mono">${acc}%</span>
      </div>
      <div class="gen-res-grid">
        <div><span class="mono">${acc}%</span><span>accuracy</span></div>
        <div><span class="mono">${Math.round(sim.points * 10) / 10}/${sim.total}</span><span>graded steps</span></div>
        <div><span class="mono">+${xp}</span><span>XP earned</span></div>
        <div><span class="mono">${acc > prevBest && !first ? 'NEW BEST' : first ? '1st chart' : `best ${store.done[scn.id].best}%`}</span><span>this patient</span></div>
      </div>
      ${sim.mistakes.length ? `<p class="soap-signed-miss">Shore up: ${esc([...new Set(sim.mistakes)].join(', '))}.</p>` : '<p class="soap-signed-clean">Clean chart — nothing to fix. That\'s exactly the standard.</p>'}
    </div>

    <div class="soap-layout soap-layout-final">
      <section class="soap-work">
        <div class="soap-finalnote cornerframe">
          <span class="label">The signed note</span>
          ${soapNoteHtml(scn)}
          <p class="soap-scope"><span class="mono">SCOPE</span> ${esc(scn.scopeNote || 'You document S and O; the provider owns A and P.')}</p>
        </div>
      </section>
      <aside class="soap-chart cornerframe">
        <span class="label">Retain this</span>
        <ul class="soap-teach">${teach || '<li>Great work — keep rotating charts.</li>'}</ul>
        <div class="soap-vitalrecap"><span class="soap-chart-lab mono">VITALS ON RECORD</span>${soapFlowsheetHtml(scn, true)}</div>
      </aside>
    </div>

    <div class="gen-res-btns soap-final-btns">
      <button class="btn btn-solid" id="soap-nextpt">Next patient →</button>
      <button class="btn" id="soap-redo">Redo this chart</button>
      <button class="btn" id="soap-hub">Patient queue</button>
    </div>
  </main>`);
  main.querySelector('#soap-exit').addEventListener('click', renderCcmaSoapHome);
  main.querySelector('#soap-nextpt').addEventListener('click', () => { if (nextId) startCcmaSoap(nextId); else renderCcmaSoapHome(); });
  main.querySelector('#soap-redo').addEventListener('click', () => startCcmaSoap(scn.id));
  main.querySelector('#soap-hub').addEventListener('click', renderCcmaSoapHome);
  root.appendChild(main); root.appendChild(siteFooter()); setView(root);
}
