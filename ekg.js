/* Cortex — ECG / rhythm trainer.
   Tracings are generated as SVG paths from a small waveform engine (no images),
   so they stay crisp at any size and match the telemetry aesthetic.
   Library (study each rhythm) + Drill (identify the rhythm). */

/* ---------- waveform engine ---------- */
function gauss(x, c, a, w) { return a * Math.exp(-((x - c) * (x - c)) / (2 * w * w)); }

/* a deterministic pseudo-random so a given rhythm always draws the same way */
function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647) / 2147483647; }

/* one PQRST complex centred on beat-start x0; returns deflection (up = +) at x */
function complexAt(x, x0, p) {
  let y = 0;
  if (p.pAmp) y += gauss(x, x0 + p.pAt, p.pAmp, p.pW);          // P
  y += gauss(x, x0 + p.qAt, -p.qAmp, p.qrsW);                    // Q
  y += gauss(x, x0 + p.rAt, p.rAmp, p.qrsW);                     // R
  y += gauss(x, x0 + p.sAt, -p.sAmp, p.qrsW * 1.2);              // S
  if (p.tAmp) y += gauss(x, x0 + p.tAt, p.tAmp, p.tW);          // T
  return y;
}

/* build a sampled trace (array of [x,y]) for a rhythm config */
function buildTrace(kind, W, H) {
  const mid = H * 0.52, step = 1.4, pts = [];
  const r = rng(({ sinus: 7, brady: 11, tachy: 13, afib: 17, flutter: 19, svt: 23, avb1: 29, mobitz1: 31, mobitz2: 37, chb: 41, vt: 43, vfib: 47, torsades: 53, pvc: 59, stemi: 61, asystole: 67, junctional: 71, wpw: 73, hyperk: 79, paced: 83 })[kind] || 7);

  // default complex shape (px); rAmp scales the whole QRS height
  const base = { pAmp: 7, pAt: 14, pW: 6, qAmp: 4, qAt: 33, rAmp: 52, rAt: 37, sAmp: 12, sAt: 42, qrsW: 2.4, tAmp: 15, tAt: 60, tW: 9 };

  // beat layout: list of {x0, p, stShift} OR special full-trace generators
  function regularBeats(rr, mod) {
    const beats = []; let x = 20 + rr * 0.2;
    let i = 0;
    while (x < W + rr) { const b = { x0: x, p: { ...base } }; if (mod) mod(b, i, beats.length); beats.push(b); x += rr; i++; }
    return beats;
  }
  function sampleBeats(beats, extra) {
    for (let x = 0; x <= W; x += step) {
      let y = 0;
      for (const b of beats) if (Math.abs(x - b.x0 - 37) < 90) y += complexAt(x, b.x0, b.p) + (b.stShift ? stOf(x, b) : 0);
      if (extra) y += extra(x);
      pts.push([x, mid - y]);
    }
  }
  function stOf(x, b) { // ST elevation plateau between S and T
    const a = b.x0 + b.p.sAt, c = b.x0 + b.p.tAt;
    if (x > a && x < c) return b.stShift; return 0;
  }

  if (kind === 'sinus') sampleBeats(regularBeats(118));
  else if (kind === 'brady') sampleBeats(regularBeats(210));
  else if (kind === 'tachy') sampleBeats(regularBeats(74));
  else if (kind === 'svt') sampleBeats(regularBeats(54, b => { b.p.pAmp = 0; b.p.tAmp = 9; }));
  else if (kind === 'junctional') sampleBeats(regularBeats(150, b => { b.p.pAmp = 0; }));
  else if (kind === 'avb1') sampleBeats(regularBeats(125, b => { b.p.pAt = -2; b.p.pW = 6; })); // long PR (P early/far from QRS)
  else if (kind === 'wpw') sampleBeats(regularBeats(120, b => { b.p.pAt = 22; b.p.qAmp = 0; b.p.rAt = 31; b.delta = 1; }), x => 0);
  else if (kind === 'hyperk') sampleBeats(regularBeats(125, b => { b.p.pAmp = 2; b.p.tAmp = 34; b.p.tW = 6; })); // peaked T
  else if (kind === 'stemi') sampleBeats(regularBeats(125, b => { b.stShift = 13; b.p.tAmp = 12; }));
  else if (kind === 'flutter') { // sawtooth F-waves (~300/min) with 2:1 conduction
    const vrr = 104, fw = vrr / 2;
    const beats = regularBeats(vrr, b => { b.p.pAmp = 0; });
    sampleBeats(beats, x => { const ph = (x % fw) / fw; return 9 - 18 * ph; }); // inverted sawtooth
  }
  else if (kind === 'afib') {
    const beats = []; let x = 25; const rr0 = 92;
    while (x < W + 60) { beats.push({ x0: x, p: { ...base, pAmp: 0 } }); x += rr0 * (0.6 + r() * 0.9); } // irregularly irregular
    sampleBeats(beats, xx => gauss(0, 0, 0, 1) + (r() - 0.5) * 5); // fine fibrillatory baseline
  }
  else if (kind === 'mobitz1') { // Wenckebach: PR lengthens then a P drops
    const beats = []; let x = 30; const rr = 130; let cyc = 0;
    while (x < W + rr) {
      if (cyc === 4) { beats.push({ x0: x, p: { ...base, pAmp: 7, pAt: 14, qAmp: 0, rAmp: 0, sAmp: 0, tAmp: 0 } }); cyc = 0; x += rr; continue; } // dropped QRS, lone P
      beats.push({ x0: x, p: { ...base, pAt: 14 - cyc * 6 } }); cyc++; x += rr;
    }
    sampleBeats(beats);
  }
  else if (kind === 'mobitz2') { // constant PR, intermittent dropped QRS (every 3rd)
    const beats = []; let x = 30; const rr = 120; let i = 0;
    while (x < W + rr) {
      if (i % 3 === 2) beats.push({ x0: x, p: { ...base, qAmp: 0, rAmp: 0, sAmp: 0, tAmp: 0 } });
      else beats.push({ x0: x, p: { ...base } });
      i++; x += rr;
    }
    sampleBeats(beats);
  }
  else if (kind === 'chb') { // AV dissociation: independent P (fast) and QRS (slow)
    const beats = regularBeats(190, b => { b.p.pAmp = 0; }); // ventricular escape, no related P
    const pRR = 78; const pwaves = []; let px = 24; while (px < W) { pwaves.push(px); px += pRR; }
    sampleBeats(beats, x => { let y = 0; for (const c of pwaves) y += gauss(x, c, 7, 6); return y; });
  }
  else if (kind === 'pvc') { // sinus with two wide bizarre premature beats
    const beats = []; let x = 25; const rr = 120; let i = 0;
    while (x < W + rr) {
      if (i === 3 || i === 7) beats.push({ x0: x - 28, p: { ...base, pAmp: 0, qAmp: 0, rAmp: -46, rAt: 37, sAmp: 0, tAmp: 22, tAt: 64, tW: 12, qrsW: 7 } });
      else beats.push({ x0: x, p: { ...base } });
      i++; x += rr;
    }
    sampleBeats(beats);
  }
  else if (kind === 'vt') { // wide, fast, monomorphic — sine-ish
    sampleBeats([], x => Math.sin(x / 11) * 42 * Math.sign(Math.sin(x / 11)) ** 0 + Math.sin(x / 11) * 6 || 0);
    pts.length = 0; for (let x = 0; x <= W; x += step) pts.push([x, mid - (Math.sin(x / 12) * 40 + Math.sin(x / 6) * 8)]);
  }
  else if (kind === 'torsades') { // VT with sinusoidal amplitude envelope ("twisting")
    pts.length = 0; for (let x = 0; x <= W; x += step) { const env = 14 + 30 * Math.abs(Math.sin(x / 95)); pts.push([x, mid - Math.sin(x / 9) * env]); }
  }
  else if (kind === 'vfib') { // chaotic
    pts.length = 0; let prev = 0; for (let x = 0; x <= W; x += step) { prev = prev * 0.6 + (r() - 0.5) * 60; pts.push([x, mid - prev]); }
  }
  else if (kind === 'asystole') { pts.length = 0; for (let x = 0; x <= W; x += step) pts.push([x, mid - (r() - 0.5) * 2.5]); }
  else if (kind === 'paced') { // pacing spikes before each QRS
    const beats = regularBeats(135, b => { b.p.pAmp = 0; b.spike = 1; b.p.qrsW = 4; b.p.rAmp = 40; });
    sampleBeats(beats, x => { let y = 0; for (const b of beats) { if (Math.abs(x - (b.x0 + 26)) < 1.2) y += 60; } return y; });
  }
  else sampleBeats(regularBeats(118));

  return pts;
}

function ekgSvg(kind, W, H, accent) {
  const pts = buildTrace(kind, W, H);
  const d = 'M' + pts.map(p => `${p[0].toFixed(1)} ${Math.max(2, Math.min(H - 2, p[1])).toFixed(1)}`).join(' L');
  const gid = 'g' + kind;
  return `<svg class="ekgsvg" role="img" aria-label="ECG rhythm tracing" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="${gid}m" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0H0V8" fill="none" stroke="#f0dada" stroke-width="0.6"/></pattern>
      <pattern id="${gid}M" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="url(#${gid}m)"/><path d="M40 0H0V40" fill="none" stroke="#e6bcbc" stroke-width="1"/></pattern>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#${gid}M)"/>
    <path d="${d}" fill="none" stroke="${accent || '#111113'}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

/* ---------- rhythm data ---------- */
const EKG_RHYTHMS = [
  { id: 'sinus', name: 'Normal sinus rhythm', cat: 'Baseline', rate: '60–100', clue: 'Upright P before every QRS, regular, narrow QRS, normal PR.', mgmt: 'None — this is normal.' },
  { id: 'brady', name: 'Sinus bradycardia', cat: 'Sinus', rate: '<60', clue: 'Normal sinus morphology, just slow. P before every QRS.', mgmt: 'Treat only if symptomatic: atropine; pacing if unstable. Look for meds (β-blockers), hypothyroid, athletic heart.' },
  { id: 'tachy', name: 'Sinus tachycardia', cat: 'Sinus', rate: '>100', clue: 'Normal morphology, fast, P before every QRS (may bury in prior T).', mgmt: 'Treat the cause (pain, fever, hypovolemia, anemia, PE, hyperthyroid) — not the rate itself.' },
  { id: 'afib', name: 'Atrial fibrillation', cat: 'Atrial', rate: 'variable', clue: 'Irregularly irregular, NO discernible P waves, fibrillatory baseline.', mgmt: 'Rate control (β-blocker/CCB), anticoagulate by CHA₂DS₂-VASc, rhythm control/cardiovert (if <48 h or TEE-clear).' },
  { id: 'flutter', name: 'Atrial flutter', cat: 'Atrial', rate: '~150 (vent)', clue: 'Sawtooth flutter waves (~300/min), often 2:1 block → ventricular ~150.', mgmt: 'Rate control, anticoagulation, definitive cure with CTI ablation.' },
  { id: 'svt', name: 'SVT (AVNRT)', cat: 'Atrial', rate: '150–250', clue: 'Fast, regular, narrow QRS, P waves absent or buried.', mgmt: 'Vagal maneuvers → adenosine; cardiovert if unstable.' },
  { id: 'junctional', name: 'Junctional rhythm', cat: 'Atrial', rate: '40–60', clue: 'Narrow QRS, no preceding P (or inverted/retrograde P).', mgmt: 'Treat cause; atropine/pacing if symptomatic bradycardia.' },
  { id: 'avb1', name: '1st-degree AV block', cat: 'Blocks', rate: 'normal', clue: 'Constant, prolonged PR interval (>200 ms). Every P conducts.', mgmt: 'Usually benign — observe; review AV-nodal drugs.' },
  { id: 'mobitz1', name: 'Mobitz I (Wenckebach)', cat: 'Blocks', rate: 'normal/slow', clue: 'PR progressively lengthens until a QRS is dropped, then resets.', mgmt: 'Usually benign; treat if symptomatic (atropine). Often AV-nodal.' },
  { id: 'mobitz2', name: 'Mobitz II', cat: 'Blocks', rate: 'normal/slow', clue: 'Constant PR with sudden dropped QRS (no warning). Often wide QRS.', mgmt: 'Risk of progression to complete block → pacemaker.' },
  { id: 'chb', name: 'Complete (3rd-degree) block', cat: 'Blocks', rate: '30–45', clue: 'AV dissociation — P waves and QRS march independently.', mgmt: 'Pacemaker. Atropine usually ineffective; transcutaneous pacing if unstable.' },
  { id: 'pvc', name: 'PVCs', cat: 'Ventricular', rate: 'varies', clue: 'Early, wide, bizarre QRS with no preceding P; T opposite to QRS.', mgmt: 'Usually benign; evaluate if frequent/symptomatic or structural disease.' },
  { id: 'vt', name: 'Ventricular tachycardia', cat: 'Ventricular', rate: '100–250', clue: 'Wide, regular, fast, monomorphic QRS; AV dissociation may be seen.', mgmt: 'Unstable → synchronized cardioversion. Stable → amiodarone. Pulseless → defibrillate + ACLS.' },
  { id: 'torsades', name: 'Torsades de pointes', cat: 'Ventricular', rate: '200–250', clue: 'Polymorphic VT with QRS amplitude "twisting" around the baseline.', mgmt: 'IV magnesium; correct QT triggers; defibrillate if pulseless.' },
  { id: 'vfib', name: 'Ventricular fibrillation', cat: 'Ventricular', rate: 'chaotic', clue: 'Chaotic, irregular deflections; no organized QRS. Pulseless.', mgmt: 'Immediate defibrillation + CPR (ACLS). This is an arrest rhythm.' },
  { id: 'asystole', name: 'Asystole', cat: 'Arrest', rate: '0', clue: 'Flat line (confirm in 2 leads). No electrical activity.', mgmt: 'CPR + epinephrine; NOT shockable. Find reversible causes (H’s & T’s).' },
  { id: 'stemi', name: 'STEMI (ST elevation)', cat: 'Ischemia', rate: 'normal', clue: 'ST-segment elevation; in true MI it is regional with reciprocal change.', mgmt: 'Activate cath lab — PCI (or fibrinolysis); aspirin, anticoagulation, antianginals.' },
  { id: 'hyperk', name: 'Hyperkalemia', cat: 'Metabolic', rate: 'normal', clue: 'Tall, narrow, peaked T waves → later flat P, wide QRS, sine wave.', mgmt: 'Calcium gluconate (membrane), insulin+glucose/albuterol (shift), then remove K⁺.' },
  { id: 'wpw', name: 'WPW (pre-excitation)', cat: 'Conduction', rate: 'normal', clue: 'Short PR + slurred QRS upstroke (delta wave) from an accessory pathway.', mgmt: 'Avoid AV-nodal blockers if AF; procainamide; ablation of the pathway.' },
  { id: 'paced', name: 'Ventricular paced', cat: 'Conduction', rate: 'set', clue: 'Pacing spike precedes each wide QRS.', mgmt: 'Confirm capture; this is expected with a pacemaker.' },
];

const EKG_CATS = [...new Set(EKG_RHYTHMS.map(r => r.cat))];

function defaultEkgProg() {
  return { drill: { correct: 0, total: 0 }, byCat: {}, reviewed: [] };
}
function safeEkgProg(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultEkgProg();
  const base = { ...defaultEkgProg(), ...raw };
  base.drill = base.drill && typeof base.drill === 'object' ? base.drill : { correct: 0, total: 0 };
  base.reviewed = Array.isArray(base.reviewed) ? base.reviewed : [];
  base.byCat = base.byCat && typeof base.byCat === 'object' ? base.byCat : {};
  return base;
}
let EKG_PROG = safeEkgProg((typeof loadJSON === 'function') ? loadJSON('cs-ekg', {}) : null);
function saveEkgProg() {
  if (typeof safeSet === 'function') safeSet('cs-ekg', JSON.stringify(EKG_PROG));
  else try { localStorage.setItem('cs-ekg', JSON.stringify(EKG_PROG)); } catch {}
}
function ekgReviewedSet() { return new Set(EKG_PROG.reviewed || []); }
function markEkgReviewed(id) {
  if (!EKG_PROG.reviewed.includes(id)) {
    EKG_PROG.reviewed.push(id);
    saveEkgProg();
  }
}
function recordEkgDrill(cat, correct) {
  EKG_PROG.drill.total++; if (correct) EKG_PROG.drill.correct++;
  if (!EKG_PROG.byCat[cat]) EKG_PROG.byCat[cat] = { correct: 0, total: 0 };
  EKG_PROG.byCat[cat].total++; if (correct) EKG_PROG.byCat[cat].correct++;
  saveEkgProg();
}
function ekgHubStats() {
  const reviewed = (EKG_PROG.reviewed || []).length;
  const total = EKG_RHYTHMS.length;
  const drillAcc = EKG_PROG.drill.total ? Math.round(100 * EKG_PROG.drill.correct / EKG_PROG.drill.total) : null;
  const pct = Math.round(100 * reviewed / total);
  const has = reviewed > 0 || EKG_PROG.drill.total > 0;
  return { reviewed, total, pct, drillAcc, has };
}
window.ekgHubStats = ekgHubStats;

/* ---------- views ---------- */
async function renderEKG(tab = 'library', opts = {}) {
  if (typeof stopTimer === 'function') stopTimer();
  if (typeof session !== 'undefined') session = null;
  if (typeof touchMedicine === 'function') {
    touchMedicine('ekg', tab === 'drill' ? 'drill' : (opts.focus ? `rhythm:${opts.focus}` : 'library'));
  }
  const stats = ekgHubStats();
  const root = el('<div></div>');
  root.appendChild(topbar('reference'));
  const main = el(`<main class="panel">
    <div class="hero"><h1>ECG rhythms.</h1><p class="sub">${stats.reviewed}/${stats.total} reviewed${stats.drillAcc != null ? ` · ${stats.drillAcc}% drill` : ''} — live tracings, category filters, A–E keys.</p></div>
    <div class="tabs">
      <button class="tab ${tab === 'library' ? 'active' : ''}" data-tab="library">Library</button>
      <button class="tab ${tab === 'drill' ? 'active' : ''}" data-tab="drill">Drill</button>
      <button class="ghostbtn" id="ekgback" style="margin-left:auto">&larr; Medicine</button>
    </div>
    <div id="ekgbody"></div>
  </main>`);
  main.querySelector('#ekgback').addEventListener('click', renderReference);
  main.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => renderEKG(b.dataset.tab)));
  const body = main.querySelector('#ekgbody');
  if (tab === 'library') buildEkgLibrary(body, opts.focus || null); else buildEkgDrill(body);
  root.appendChild(main);
  setView(root);
  if (opts.focus && tab === 'library') {
    requestAnimationFrame(() => {
      const target = body.querySelector(`#ekg-${opts.focus}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const det = target.querySelector('.ekgdetail');
        const head = target.querySelector('.ekghead');
        if (det && head) { det.hidden = false; target.classList.add('open'); }
      }
    });
  }
}

function buildEkgLibrary(body, focusId) {
  const reviewed = ekgReviewedSet();
  const list = el('<div class="ekglist"></div>');
  EKG_RHYTHMS.forEach(rh => {
    const done = reviewed.has(rh.id);
    const item = el(`<div class="ekgitem ${done ? 'studied' : ''}" id="ekg-${rh.id}">
      <div class="ekgstrip">${ekgSvg(rh.id, 520, 110)}</div>
      <button class="ekghead">
        <span><span class="ekgname">${esc(rh.name)}</span> <span class="ekgcat">${esc(rh.cat)}</span>${done ? ' <span class="pill ok">reviewed</span>' : ''}</span>
        <span class="ekgrate">${esc(rh.rate)} bpm</span>
      </button>
      <div class="ekgdetail" hidden>
        <div class="refrow"><span class="label">How to spot it</span><p>${esc(rh.clue)}</p></div>
        <div class="refrow"><span class="label">Management</span><p>${esc(rh.mgmt)}</p></div>
        ${done ? '' : '<div class="continue-row"><button class="btn btn-solid" data-review>Mark reviewed</button></div>'}
      </div>
    </div>`);
    const det = item.querySelector('.ekgdetail');
    item.querySelector('.ekghead').addEventListener('click', () => { det.hidden = !det.hidden; item.classList.toggle('open', !det.hidden); });
    det.querySelector('[data-review]')?.addEventListener('click', () => {
      markEkgReviewed(rh.id);
      renderEKG('library');
    });
    list.appendChild(item);
  });
  body.appendChild(list);
}

function buildEkgDrill(body) {
  let activeCat = 'all';
  const controls = el(`<div class="pharm-drill-controls"><div class="refchips"></div></div>`);
  const chips = controls.querySelector('.refchips');
  const mkChip = (c, label) => {
    const b = el(`<button type="button" class="refchip ${c === activeCat ? 'active' : ''}" data-cat="${esc(c)}">${esc(label)}</button>`);
    b.addEventListener('click', () => {
      activeCat = c;
      chips.querySelectorAll('.refchip').forEach(x => x.classList.toggle('active', x.dataset.cat === c));
      next();
    });
    return b;
  };
  chips.appendChild(mkChip('all', `All (${EKG_RHYTHMS.length})`));
  EKG_CATS.forEach(c => {
    const n = EKG_RHYTHMS.filter(r => r.cat === c).length;
    const b = EKG_PROG.byCat[c];
    const acc = b?.total ? Math.round(100 * b.correct / b.total) : null;
    chips.appendChild(mkChip(c, `${c} (${n}${acc != null ? ` · ${acc}%` : ''})`));
  });
  body.appendChild(controls);

  const wrap = el('<div class="quizwrap"></div>'); body.appendChild(wrap);
  const shuffle = a => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[x[i], x[j]] = [x[j], x[i]]; } return x; };

  function pool() {
    return activeCat === 'all' ? EKG_RHYTHMS : EKG_RHYTHMS.filter(r => r.cat === activeCat);
  }

  function next() {
    const source = pool();
    const item = source[Math.floor(Math.random() * source.length)];
    const opts = shuffle([item, ...shuffle(EKG_RHYTHMS.filter(r => r.id !== item.id)).slice(0, 3)]);
    const acc = EKG_PROG.drill.total ? Math.round(100 * EKG_PROG.drill.correct / EKG_PROG.drill.total) : null;
    wrap.replaceChildren();
    const card = el(`<section class="stage">
      <div class="stage-head"><span class="label">Identify the rhythm</span><span class="rule"></span><span class="topstat quizscore">${EKG_PROG.drill.total ? `${EKG_PROG.drill.correct}/${EKG_PROG.drill.total}${acc != null ? ` · ${acc}%` : ''}` : ''}</span></div>
      <div class="ekgstrip drill">${ekgSvg(item.id, 640, 130)}</div>
      <div class="opts">${opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="key">${LETTERS[i]}</span><span>${esc(o.name)}</span></button>`).join('')}</div>
      <div class="after"></div>
    </section>`);
    const after = card.querySelector('.after');
    card.querySelectorAll('.opt').forEach(btn => btn.addEventListener('click', () => {
      const pick = opts[Number(btn.dataset.i)], correct = pick.id === item.id;
      recordEkgDrill(item.cat, correct);
      card.querySelectorAll('.opt').forEach(b2 => { const o = opts[Number(b2.dataset.i)]; b2.disabled = true; if (o.id === item.id) b2.classList.add('correct'); else if (b2 === btn) b2.classList.add('wrong'); else b2.classList.add('dimmed'); });
      after.appendChild(el(`<div class="explain ${correct ? 'good' : 'bad'}"><span class="verdict">${correct ? 'CORRECT' : 'INCORRECT'} &middot; ${esc(item.name)}</span><p><b>Spot it:</b> ${esc(item.clue)}</p><p><b>Manage:</b> ${esc(item.mgmt)}</p></div>`));
      const row = el(`<div class="continue-row"><span class="hint">A–E or ENTER &rarr;</span><button class="btn btn-solid" data-continue>Next</button></div>`);
      row.querySelector('[data-continue]').addEventListener('click', next); after.appendChild(row);
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }));
    wrap.appendChild(card);
  }
  next();
}

window._resetEkgMemory = function () {
  EKG_PROG = defaultEkgProg();
};
window.EKG_RHYTHM_TOTAL = EKG_RHYTHMS.length;