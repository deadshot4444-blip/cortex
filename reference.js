/* Cortex — Reference: Pharmacology, Microbiology, Lab values
   Browse + search + multiple-choice recall drill over fact-checked datasets. */

const REF = { pharm: null, micro: null, labs: null, loaded: false };
/* PHARM_UNIQUE_TOTAL lives in app.js (stats + hub share it) */
function safeProg(raw, defaults) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...defaults };
  return { ...defaults, ...raw };
}

function defaultPharmProg() {
  return { drill: { correct: 0, total: 0 }, byCat: {}, learned: {}, learnResume: {} };
}
function defaultMicroProg() {
  return { drill: { correct: 0, total: 0 }, byCat: {}, guidedSection: 0, guidedDone: false };
}
function defaultLabsProg() {
  return { drill: { correct: 0, total: 0 }, byPanel: {}, guidedSection: 0, guidedDone: false };
}
function defaultMedMeta() { return { last: null }; }

let PHARM_PROG = safeProg((typeof loadJSON === 'function') ? loadJSON('cs-pharm', {}) : null, defaultPharmProg());
let MICRO_PROG = safeProg((typeof loadJSON === 'function') ? loadJSON('cs-micro', {}) : null, defaultMicroProg());
let LABS_PROG = safeProg((typeof loadJSON === 'function') ? loadJSON('cs-labs', {}) : null, defaultLabsProg());
let MED_META = safeProg((typeof loadJSON === 'function') ? loadJSON('cs-medicine', {}) : null, defaultMedMeta());
PHARM_PROG.learnResume = (PHARM_PROG.learnResume && typeof PHARM_PROG.learnResume === 'object') ? PHARM_PROG.learnResume : {};
PHARM_PROG.drill = PHARM_PROG.drill && typeof PHARM_PROG.drill === 'object' ? PHARM_PROG.drill : { correct: 0, total: 0 };
MICRO_PROG.drill = MICRO_PROG.drill && typeof MICRO_PROG.drill === 'object' ? MICRO_PROG.drill : { correct: 0, total: 0 };
LABS_PROG.drill = LABS_PROG.drill && typeof LABS_PROG.drill === 'object' ? LABS_PROG.drill : { correct: 0, total: 0 };

function savePharmProg() {
  if (typeof safeSet === 'function') safeSet('cs-pharm', JSON.stringify(PHARM_PROG));
  else try { localStorage.setItem('cs-pharm', JSON.stringify(PHARM_PROG)); } catch {}
}
function saveMicroProg() {
  if (typeof safeSet === 'function') safeSet('cs-micro', JSON.stringify(MICRO_PROG));
  else try { localStorage.setItem('cs-micro', JSON.stringify(MICRO_PROG)); } catch {}
}
function saveLabsProg() {
  if (typeof safeSet === 'function') safeSet('cs-labs', JSON.stringify(LABS_PROG));
  else try { localStorage.setItem('cs-labs', JSON.stringify(LABS_PROG)); } catch {}
}
function saveMedMeta() {
  if (typeof safeSet === 'function') safeSet('cs-medicine', JSON.stringify(MED_META));
  else try { localStorage.setItem('cs-medicine', JSON.stringify(MED_META)); } catch {}
}
function touchMedicine(area, detail) {
  MED_META.last = { area, detail: detail || area, ts: Date.now() };
  saveMedMeta();
}

function pharmUniqueLearnedCount(data) {
  const names = new Set();
  Object.entries(PHARM_PROG.learned || {}).forEach(([k, v]) => {
    if (v?.name) names.add(v.name);
    else if (data) {
      const d = data.find(x => (x.id || x.name) === k);
      if (d) names.add(d.name);
    }
  });
  return names.size;
}
function pharmClassLearnedCount(cat, data) {
  return data.filter(d => d.cat === cat && PHARM_PROG.learned[d.id || d.name]).length;
}
function refStepDots(total, current, label) {
  const dots = Array.from({ length: total }, (_, i) =>
    `<span class="ped-dot ${i < current ? 'done' : i === current ? 'active' : ''}" aria-hidden="true"></span>`
  ).join('');
  return `<div class="ped-steps" aria-label="${esc(label)}"><span class="ped-steps-lab">${esc(label)}</span><span class="ped-steps-dots">${dots}</span><span class="ped-steps-num">${current + 1}/${total}</span></div>`;
}
function recordRefDrill(prog, save, catField, cat, correct) {
  prog.drill.total++; if (correct) prog.drill.correct++;
  const bucket = catField === 'panel' ? 'byPanel' : 'byCat';
  if (!prog[bucket][cat]) prog[bucket][cat] = { correct: 0, total: 0 };
  prog[bucket][cat].total++; if (correct) prog[bucket][cat].correct++;
  save();
}
function pharmCatStats(cat) {
  const b = PHARM_PROG.byCat[cat] || { correct: 0, total: 0 };
  return b.total ? Math.round(100 * b.correct / b.total) : null;
}
function recordPharmDrill(cat, correct) {
  PHARM_PROG.drill.total++; if (correct) PHARM_PROG.drill.correct++;
  if (!PHARM_PROG.byCat[cat]) PHARM_PROG.byCat[cat] = { correct: 0, total: 0 };
  PHARM_PROG.byCat[cat].total++; if (correct) PHARM_PROG.byCat[cat].correct++;
  savePharmProg();
}

/* short, human category labels (keys match the `cat`/`panel` fields in the data) */
const PHARM_CATS = {
  'cholinergics': 'Cholinergics', 'anticholinergics': 'Anticholinergics',
  'adrenergic-agonists': 'Adrenergic agonists', 'adrenergic-antagonists': 'Adrenergic antagonists',
  'diuretics': 'Diuretics', 'ace-arb': 'ACE inhibitors & ARBs', 'beta-blockers': 'Beta blockers',
  'ccb': 'Ca-channel blockers', 'antiarrhythmics': 'Antiarrhythmics', 'antianginal': 'Antianginal & HF',
  'lipid': 'Lipid-lowering', 'anticoagulants': 'Anticoag & antiplatelet', 'penicillins': 'Penicillins',
  'cephalosporins': 'Cephalosporins & cell-wall', 'protein-synth': 'Protein-synthesis inhibitors',
  'quinolones-sulfa': 'Quinolones & sulfa', 'antifungal-antiviral': 'Antifungal & antiviral',
  'antitubercular': 'Anti-TB', 'antidepressants': 'Antidepressants', 'antipsychotics': 'Antipsychotics & mood',
  'sedatives': 'Sedative-hypnotics', 'antiepileptics': 'Antiepileptics', 'opioids': 'Opioids & analgesics',
  'nsaids': 'NSAIDs, gout & DMARDs', 'diabetes': 'Diabetes drugs', 'endocrine': 'Thyroid & steroids',
  'gi': 'GI drugs', 'respiratory': 'Respiratory drugs',
};
const MICRO_CATS = {
  'gram-pos-cocci': 'Gram + cocci', 'gram-pos-rods': 'Gram + rods', 'gram-neg-cocci': 'Gram − cocci',
  'enterics': 'Enteric rods', 'curved-gn': 'Curved gram −', 'zoonotic-gn': 'Zoonotic gram −',
  'atypicals': 'Atypicals', 'mycobacteria-spiro': 'Mycobacteria & spirochetes',
  'dna-viruses': 'DNA viruses', 'rna-viruses': 'RNA viruses', 'fungi': 'Fungi', 'parasites': 'Parasites',
};
const LAB_PANELS = {
  'cbc': 'CBC & differential', 'bmp': 'Metabolic panel', 'lft': 'Liver & pancreas',
  'lipids-cardiac': 'Lipids & cardiac', 'coags': 'Coagulation', 'abg': 'Blood gas / acid-base',
  'endocrine': 'Endocrine', 'urinalysis': 'Urinalysis', 'csf': 'CSF', 'iron-misc': 'Iron & inflammation',
};

/* per-dataset config: how to title, group, search, and quiz each card */
const REF_SETS = {
  pharm: {
    name: 'Pharmacology', noun: 'drugs', store: 'pharm', catMap: PHARM_CATS, catField: 'cat',
    title: d => d.name, sub: d => d.drug_class,
    fields: [['Mechanism', 'moa'], ['Indications', 'indications'], ['Adverse effects', 'side_effects'], ['Pearl', 'pearl']],
    search: d => `${d.name} ${d.drug_class} ${d.moa} ${d.indications}`.toLowerCase(),
    quizClue: d => `Mechanism: ${d.moa}\nUses: ${d.indications}`, quizAsk: 'Which drug fits?',
  },
  micro: {
    name: 'Microbiology', noun: 'organisms', store: 'micro', catMap: MICRO_CATS, catField: 'cat',
    title: d => d.name, sub: d => d.type,
    fields: [['Lab / morphology', 'morphology'], ['Diseases', 'diseases'], ['Treatment', 'treatment'], ['Pearl', 'pearl']],
    search: d => `${d.name} ${d.type} ${d.morphology} ${d.diseases}`.toLowerCase(),
    quizClue: d => `${d.morphology}\nCauses: ${d.diseases}`, quizAsk: 'Which organism?',
  },
  labs: {
    name: 'Lab values', noun: 'labs', store: 'labs', catMap: LAB_PANELS, catField: 'panel',
    title: d => d.test, sub: d => `${d.range}${d.units ? ' ' + d.units : ''}`,
    fields: [['Reference range', d => `${d.range}${d.units ? ' ' + d.units : ''}`], ['High suggests', 'high_means'], ['Low suggests', 'low_means'], ['Pearl', 'pearl']],
    search: d => `${d.test} ${d.high_means} ${d.low_means}`.toLowerCase(),
    quizClue: d => `High → ${d.high_means}\nLow → ${d.low_means}`, quizAsk: 'Which lab test?',
  },
};

async function loadRef() {
  if (REF.loaded) return;
  try {
    const [p, m, l] = await Promise.all([
      fetch('data/pharm.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('data/micro.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('data/labs.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
    ]);
    REF.pharm = p || []; REF.micro = m || []; REF.labs = l || [];
  } catch { REF.pharm = REF.pharm || []; REF.micro = REF.micro || []; REF.labs = REF.labs || []; }
  REF.loaded = true;
}

function drillAcc(prog) {
  return prog?.drill?.total ? Math.round(100 * prog.drill.correct / prog.drill.total) : null;
}

function guidedTrackPct(prog, total) {
  if (!total) return 0;
  if (prog.guidedDone) return 100;
  return Math.round(100 * (prog.guidedSection || 0) / total);
}

function medicineHubSnapshot() {
  const pharmN = pharmUniqueLearnedCount(REF.pharm);
  const pharmPct = Math.round(100 * pharmN / PHARM_UNIQUE_TOTAL);
  const pharmHas = pharmN > 0 || PHARM_PROG.drill.total > 0;
  const microCats = Object.keys(MICRO_CATS).filter(c => (REF.micro || []).some(d => d.cat === c));
  const labsPanels = Object.keys(LAB_PANELS).filter(c => (REF.labs || []).some(d => d.panel === c));
  const microPct = guidedTrackPct(MICRO_PROG, microCats.length);
  const labsPct = guidedTrackPct(LABS_PROG, labsPanels.length);
  const microHas = microPct > 0 || MICRO_PROG.drill.total > 0;
  const labsHas = labsPct > 0 || LABS_PROG.drill.total > 0;
  const pd = typeof pedStatsSnapshot === 'function' ? pedStatsSnapshot() : { pct: 0, has: false };
  const ek = typeof ekgHubStats === 'function' ? ekgHubStats() : { pct: 0, has: false };
  const tracks = [
    { id: 'pharm', pct: pharmPct, has: pharmHas },
    { id: 'ped', pct: pd.pct || 0, has: !!pd.has },
    { id: 'micro', pct: microPct, has: microHas },
    { id: 'labs', pct: labsPct, has: labsHas },
    { id: 'ekg', pct: ek.pct || 0, has: !!ek.has },
  ];
  const overall = Math.round(tracks.reduce((a, t) => a + t.pct, 0) / tracks.length);
  const has = tracks.some(t => t.has);
  let continueLabel = 'Start · Pharmacology classes';
  const last = MED_META.last;
  if (last) {
    if (last.area === 'pharm') {
      continueLabel = last.detail?.startsWith('learn:')
        ? `Continue · ${PHARM_CATS[last.detail.slice(6)] || 'Pharm class'}`
        : last.detail === 'drill' ? 'Continue · Pharm drill' : 'Continue · Pharmacology';
    } else if (last.area === 'ped') continueLabel = 'Continue · Performance drugs';
    else if (last.area === 'micro') continueLabel = last.detail === 'drill' ? 'Continue · Micro drill' : 'Continue · Microbiology';
    else if (last.area === 'labs') continueLabel = last.detail === 'drill' ? 'Continue · Labs drill' : 'Continue · Lab values';
    else if (last.area === 'ekg') continueLabel = last.detail === 'drill' ? 'Continue · ECG drill' : 'Continue · ECG library';
  }
  return { overall, tracks, has, continueLabel, last, pharmN, pharmDrillAcc: drillAcc(PHARM_PROG) };
}

async function medicineContinue() {
  await loadRef();
  const last = MED_META.last;
  if (!last) { touchMedicine('pharm', 'classes'); return renderRefSet('pharm', 'classes'); }
  if (last.area === 'pharm') {
    if (last.detail?.startsWith('learn:')) return renderRefSet('pharm', 'learn', { cat: last.detail.slice(6) });
    if (last.detail === 'drill') return renderRefSet('pharm', 'quiz');
    return renderRefSet('pharm', 'classes');
  }
  if (last.area === 'ped' && typeof renderPerformanceDrugs === 'function') return renderPerformanceDrugs('hub');
  if (last.area === 'micro') return renderRefSet('micro', last.detail === 'drill' ? 'quiz' : 'learn');
  if (last.area === 'labs') return renderRefSet('labs', last.detail === 'drill' ? 'quiz' : 'learn');
  if (last.area === 'ekg' && typeof renderEKG === 'function') return renderEKG(last.detail === 'drill' ? 'drill' : 'library');
  renderRefSet('pharm', 'classes');
}

/* ---------- hub ---------- */
async function renderReference() {
  if (typeof stopTimer === 'function') stopTimer();
  if (typeof session !== 'undefined') session = null;
  try {
  await loadRef();

  const root = el('<div></div>');
  root.appendChild(topbar('reference'));
  const hub = medicineHubSnapshot();
  const freeNote = typeof cortexFreeNote === 'function'
    ? cortexFreeNote('Medicine free for now', 'Medicine reference')
    : '';
  const main = el(`<main class="panel med-hub">
    <div class="hero"><h1>Medicine.</h1><p class="sub">Recommended path: <strong>Pharmacology classes</strong> &rarr; <strong>Performance drugs course</strong> &rarr; Micro, labs &amp; ECG. Every area tracks progress.</p></div>
    ${freeNote}
    <div class="ped-pathband">
      <div class="ped-pathband-head">
        <span class="label">Medicine progress</span>
        <span class="ped-pathstat">${hub.overall}% across 5 areas</span>
      </div>
      <span class="bar"><i style="width:${hub.overall}%"></i></span>
    </div>
    <div class="ped-cta-row">
      <button class="btn btn-solid" id="medcontinue">${esc(hub.continueLabel)}</button>
    </div>
    <div class="mcat-mods"></div>
    <p class="anat-credit">Original study content, independently reviewed. For study, not a substitute for prescribing references or your clinical judgment.</p>
  </main>`);
  main.querySelector('#medcontinue').addEventListener('click', medicineContinue);

  const mc = main.querySelector('.mcat-mods');
  const uniquePharm = pharmUniqueLearnedCount(REF.pharm);
  const pharmDrill = PHARM_PROG.drill.total ? `${PHARM_PROG.drill.correct}/${PHARM_PROG.drill.total} drilled` : null;
  const pharmStat = uniquePharm
    ? `${uniquePharm}/${PHARM_UNIQUE_TOTAL} names${pharmDrill ? ` · ${pharmDrill}` : ''}`
    : `${(REF.pharm || []).length} drugs`;
  const microCats = Object.keys(MICRO_CATS).filter(c => (REF.micro || []).some(d => d.cat === c));
  const labsPanels = Object.keys(LAB_PANELS).filter(c => (REF.labs || []).some(d => d.panel === c));
  const microStat = MICRO_PROG.guidedDone ? 'Learn complete'
    : MICRO_PROG.guidedSection ? `${MICRO_PROG.guidedSection}/${microCats.length} groups`
    : MICRO_PROG.drill.total ? `${drillAcc(MICRO_PROG)}% drill` : `${(REF.micro || []).length} organisms`;
  const labsStat = LABS_PROG.guidedDone ? 'Learn complete'
    : LABS_PROG.guidedSection ? `${LABS_PROG.guidedSection}/${labsPanels.length} panels`
    : LABS_PROG.drill.total ? `${drillAcc(LABS_PROG)}% drill` : `${(REF.labs || []).length} labs`;

  [['pharm', 'Pharmacology', 'Class map · guided learn · MOA & pearl drill', pharmStat],
   ['micro', 'Microbiology', 'Guided groups · browse · bug ID drill', microStat],
   ['labs', 'Lab values', 'Panel-by-panel learn · ranges · pattern drill', labsStat]].forEach(([k, nm, desc, stat]) => {
    const n = (REF[k] || []).length;
    const card = el(`<button class="modcard" ${n ? '' : 'disabled'}>
      <span class="mod-name">${esc(nm)}</span>
      <span class="mod-desc">${esc(desc)}</span>
      <span class="mod-stat">${n ? esc(stat) : 'generating&hellip;'}</span>
    </button>`);
    if (n) card.addEventListener('click', () => {
      touchMedicine(k, k === 'pharm' ? 'classes' : 'learn');
      renderRefSet(k, k === 'pharm' ? 'classes' : 'learn');
    });
    mc.appendChild(card);
  });
  if (typeof renderPerformanceDrugs === 'function') {
    const pd = typeof pedStatsSnapshot === 'function' ? pedStatsSnapshot() : null;
    const pedStat = pd?.has ? `${pd.complete}/${pd.total} modules · ${pd.pct}%` : '11-module course';
    const ped = el(`<button class="modcard">
      <span class="mod-name">Performance drugs</span>
      <span class="mod-desc">3-part path — hormone classes, axis flowcharts, agents &amp; clinical</span>
      <span class="mod-stat">${pedStat}</span>
    </button>`);
    ped.addEventListener('click', () => { touchMedicine('ped', 'hub'); renderPerformanceDrugs('hub'); });
    mc.appendChild(ped);
  }
  if (typeof renderEKG === 'function') {
    const ek = typeof ekgHubStats === 'function' ? ekgHubStats() : null;
    const ekTotal = ek?.total || (typeof ekgHubStats === 'function' ? ekgHubStats().total : 20) || 20;
    const ekStat = ek?.has
      ? `${ek.reviewed}/${ekTotal} reviewed${ek.drillAcc != null ? ` · ${ek.drillAcc}% drill` : ''}`
      : `${ekTotal} rhythms`;
    const ekCard = el(`<button class="modcard">
      <span class="mod-name">ECG rhythms</span>
      <span class="mod-desc">Library with review tracking &mdash; category drill</span>
      <span class="mod-stat">${ekStat}</span>
    </button>`);
    ekCard.addEventListener('click', () => { touchMedicine('ekg', 'library'); renderEKG('library'); });
    mc.appendChild(ekCard);
  }

  root.appendChild(main);
  setView(root);
  } catch (err) {
    console.error('Medicine hub failed', err);
    const root = el('<div></div>');
    root.appendChild(topbar('reference'));
    const main = el(`<main class="panel">
      <div class="hero"><h1>Medicine.</h1><p class="sub">Something went wrong loading this section. Try a hard refresh; if it persists, reset Medicine progress from Practice.</p></div>
      <div class="ped-cta-row"><button class="btn btn-solid" id="medretry">Retry</button></div>
    </main>`);
    main.querySelector('#medretry').addEventListener('click', renderReference);
    root.appendChild(main);
    setView(root);
  }
}

/* ---------- a single dataset: browse / search / quiz ---------- */
function renderRefSet(key, tab = 'browse', opts = {}) {
  const cfg = REF_SETS[key];
  const data = REF[key] || [];
  const isPharm = key === 'pharm';
  const isMicro = key === 'micro';
  const isLabs = key === 'labs';
  const pharmDrillAcc = drillAcc(PHARM_PROG);
  const uniquePharm = pharmUniqueLearnedCount(data);
  touchMedicine(key, tab === 'quiz' ? 'drill' : (tab === 'learn' && opts.cat ? `learn:${opts.cat}` : tab));
  const root = el('<div></div>');
  root.appendChild(topbar('reference'));
  const sub = isPharm
    ? `${uniquePharm}/${PHARM_UNIQUE_TOTAL} unique names · ${Object.keys(cfg.catMap).length} classes${pharmDrillAcc != null ? ` · ${pharmDrillAcc}% drill` : ''}`
    : isMicro
      ? `${MICRO_PROG.guidedDone ? 'Learn complete · ' : ''}${data.length} ${cfg.noun}${drillAcc(MICRO_PROG) != null ? ` · ${drillAcc(MICRO_PROG)}% drill` : ''}`
      : isLabs
        ? `${LABS_PROG.guidedDone ? 'Learn complete · ' : ''}${data.length} ${cfg.noun}${drillAcc(LABS_PROG) != null ? ` · ${drillAcc(LABS_PROG)}% drill` : ''}`
        : `${data.length} ${cfg.noun} across ${Object.keys(cfg.catMap).length} groups.`;
  const tabs = isPharm
    ? `<button class="tab ${tab === 'classes' ? 'active' : ''}" data-tab="classes">Classes</button>
       <button class="tab ${tab === 'learn' ? 'active' : ''}" data-tab="learn">Learn</button>
       <button class="tab ${tab === 'browse' ? 'active' : ''}" data-tab="browse">Browse</button>
       <button class="tab ${tab === 'quiz' ? 'active' : ''}" data-tab="quiz">Drill</button>`
    : `<button class="tab ${tab === 'learn' ? 'active' : ''}" data-tab="learn">Learn</button>
       <button class="tab ${tab === 'browse' ? 'active' : ''}" data-tab="browse">Browse</button>
       <button class="tab ${tab === 'quiz' ? 'active' : ''}" data-tab="quiz">Drill</button>`;
  const main = el(`<main class="panel">
    <div class="hero"><h1>${esc(cfg.name)}.</h1><p class="sub">${sub}</p></div>
    <div class="tabs">${tabs}<button class="ghostbtn refback" id="refback" style="margin-left:auto">&larr; Medicine</button></div>
    <div id="refbody"></div>
  </main>`);
  main.querySelector('#refback').addEventListener('click', renderReference);
  main.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
    const t = b.dataset.tab;
    renderRefSet(key, t, (t === 'learn' || t === 'quiz') ? opts : {});
  }));
  const body = main.querySelector('#refbody');
  if (tab === 'classes' && isPharm) buildPharmClasses(body, cfg, data);
  else if (tab === 'learn' && isPharm) buildPharmLearn(body, cfg, data, opts.cat || null);
  else if (tab === 'learn' && (isMicro || isLabs)) buildGuidedLearn(body, cfg, data, isMicro ? MICRO_PROG : LABS_PROG, isMicro ? saveMicroProg : saveLabsProg, key);
  else if (tab === 'browse') buildBrowse(body, cfg, data);
  else buildQuiz(body, cfg, data, { ...opts, key });
  root.appendChild(main);
  setView(root);
}

function buildPharmClasses(body, cfg, data, skipLede) {
  const cats = Object.keys(cfg.catMap).filter(c => data.some(d => d[cfg.catField] === c));
  if (!skipLede) body.appendChild(el(`<p class="pharm-lede">Pick a drug class. <strong>Learn</strong> walks MOA → uses → toxicities → pearl. <strong>Drill</strong> tests recall.</p>`));
  const grid = el(`<div class="pharm-classgrid"></div>`);
  body.appendChild(grid);
  cats.forEach(cat => {
    const n = data.filter(d => d[cfg.catField] === cat).length;
    const learned = pharmClassLearnedCount(cat, data);
    const acc = pharmCatStats(cat);
    const card = el(`<button class="pharm-classcard" type="button">
      <span class="pharm-classname">${esc(cfg.catMap[cat])}</span>
      <span class="pharm-classmeta">${learned ? `${learned}/${n} studied` : `${n} drugs`}${acc != null ? ` · ${acc}% drilled` : ''}</span>
      ${learned && learned < n ? `<span class="ped-modbar"><i style="width:${Math.round(100 * learned / n)}%"></i></span>` : ''}
    </button>`);
    card.addEventListener('click', () => { touchMedicine('pharm', `learn:${cat}`); renderRefSet('pharm', 'learn', { cat }); });
    grid.appendChild(card);
  });
}

const PHARM_LEARN_STEPS = [
  { key: 'moa', label: 'Mechanism', field: 'moa', ask: 'How does this drug work?', hint: d => `Class: ${d.drug_class}. Think receptor, enzyme, or channel.` },
  { key: 'indications', label: 'Indications', field: 'indications', ask: 'What is it used for?', hint: d => `It's a ${d.drug_class.split('(')[0].trim()}.` },
  { key: 'side_effects', label: 'Adverse effects', field: 'side_effects', ask: 'Key toxicities or side effects?', hint: () => 'Board exams love class-wide effects and one drug-specific killer.' },
  { key: 'pearl', label: 'Pearl', field: 'pearl', ask: 'One board pearl?', hint: d => `Mnemonic or buzzword tied to ${d.name}.` },
];

function buildPharmLearn(body, cfg, data, cat) {
  if (!cat) {
    body.appendChild(el(`<p class="pharm-lede">Choose a class to start guided study.</p>`));
    buildPharmClasses(body, cfg, data, true);
    return;
  }
  const pool = data.filter(d => d[cfg.catField] === cat);
  const resume = PHARM_PROG.learnResume[cat] || { idx: 0, step: 0 };
  let idx = Math.min(resume.idx, Math.max(0, pool.length - 1));
  let step = Math.min(resume.step, PHARM_LEARN_STEPS.length - 1);
  const wrap = el(`<div class="pharm-learn"></div>`);
  body.appendChild(wrap);

  function saveResume() {
    PHARM_PROG.learnResume[cat] = { idx, step };
    savePharmProg();
  }

  function render() {
    if (idx >= pool.length) {
      wrap.replaceChildren(el(`<section class="stage">
        <span class="label">${esc(cfg.catMap[cat])} complete</span>
        <div class="neuro-score">&#10003;</div>
        <p class="sub">You walked every drug in this class.</p>
        <div class="endbtns">
          <button class="btn btn-solid" data-drill>Drill this class</button>
          <button class="btn" data-classes>All classes</button>
        </div>
      </section>`));
      wrap.querySelector('[data-drill]').addEventListener('click', () => renderRefSet('pharm', 'quiz', { cat, mode: 'moa' }));
      wrap.querySelector('[data-classes]').addEventListener('click', () => renderRefSet('pharm', 'classes'));
      return;
    }
    const drug = pool[idx];
    const s = PHARM_LEARN_STEPS[step];
    const revealed = el(`<section class="stage pharm-learn-stage">
      <div class="stage-head">
        <span class="label">${esc(cfg.catMap[cat])} · drug ${idx + 1}/${pool.length}</span>
        <span class="rule"></span>
        <span class="topstat">${pharmClassLearnedCount(cat, data)}/${pool.length} studied</span>
      </div>
      ${refStepDots(PHARM_LEARN_STEPS.length, step, s.label)}
      <h2 class="pharm-drugname">${esc(drug.name)}</h2>
      <p class="pharm-drugclass">${esc(drug.drug_class)}</p>
      <p class="q">${esc(s.ask)}</p>
      <div class="socactions">
        <button class="btn" data-hint>Hint</button>
        <button class="btn btn-solid" data-reveal>Reveal</button>
      </div>
      <div class="after"></div>
    </section>`);
    const after = revealed.querySelector('.after');
    revealed.querySelector('[data-hint]').addEventListener('click', e => {
      e.target.disabled = true;
      after.appendChild(el(`<div class="sochint"><span class="label">Hint</span><p>${esc(s.hint(drug))}</p></div>`));
    });
    revealed.querySelector('[data-reveal]').addEventListener('click', () => {
      revealed.querySelector('.socactions')?.remove();
      after.appendChild(el(`<div class="socans"><div class="socblock"><span class="label">${esc(s.label)}</span><p>${esc(drug[s.field])}</p></div></div>`));
      const isLastStep = step === PHARM_LEARN_STEPS.length - 1;
      const row = el(`<div class="continue-row"><button class="btn btn-solid" data-next>${isLastStep ? 'Next drug' : 'Continue'}</button></div>`);
      row.querySelector('[data-next]').addEventListener('click', () => {
        if (isLastStep) {
          PHARM_PROG.learned[drug.id || drug.name] = { ts: Date.now(), cat, name: drug.name };
          idx++; step = 0;
        } else step++;
        saveResume();
        savePharmProg();
        render();
      });
      after.appendChild(row);
    });
    wrap.replaceChildren(revealed);
    revealed.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  render();
}

function buildGuidedLearn(body, cfg, data, prog, saveProg, key) {
  const cats = Object.keys(cfg.catMap).filter(c => data.some(d => d[cfg.catField] === c));
  let idx = Math.min(prog.guidedSection || 0, Math.max(0, cats.length - 1));
  if (prog.guidedDone) idx = cats.length - 1;
  const unit = key === 'labs' ? 'panel' : 'group';

  function paint() {
    body.replaceChildren();
    if (prog.guidedDone) {
      body.appendChild(el(`<section class="stage">
        <span class="label">Learn complete</span>
        <div class="neuro-score">&#10003;</div>
        <p class="sub">All ${cats.length} ${unit}s reviewed. Hit Drill to test recall.</p>
        <div class="endbtns">
          <button class="btn btn-solid" data-drill>Drill</button>
          <button class="btn" data-hub>Medicine</button>
        </div>
      </section>`));
      body.querySelector('[data-drill]').addEventListener('click', () => renderRefSet(key, 'quiz'));
      body.querySelector('[data-hub]').addEventListener('click', renderReference);
      return;
    }
    const cat = cats[idx];
    const pool = data.filter(d => d[cfg.catField] === cat);
    const pct = Math.round(100 * idx / cats.length);
    body.appendChild(el(`<div class="ped-pathband ped-pathband--slim">
      <div class="ped-pathband-head"><span class="label">${unit} ${idx + 1} of ${cats.length}</span><span class="ped-pathstat">${esc(cfg.catMap[cat])}</span></div>
      <span class="bar"><i style="width:${pct}%"></i></span>
    </div>`));
    const list = el(`<div class="reflist"></div>`);
    pool.forEach(d => list.appendChild(refCard(cfg, d)));
    body.appendChild(el(`<section class="stage">
      <p class="ped-lead">Read each card in this ${unit}, then continue. Pattern: ${key === 'labs' ? 'range &rarr; high vs low' : 'morphology &rarr; disease &rarr; treatment'}.</p>
    </section>`));
    body.lastElementChild.appendChild(list);
    const nav = el(`<div class="ped-cta-row"><button class="btn btn-solid" id="guidednext">${idx < cats.length - 1 ? 'Next ' + unit + ' →' : 'Complete learn'}</button></div>`);
    body.appendChild(nav);
    nav.querySelector('#guidednext').addEventListener('click', () => {
      if (idx < cats.length - 1) {
        idx++;
        prog.guidedSection = idx;
        saveProg();
        paint();
      } else {
        prog.guidedDone = true;
        prog.guidedSection = cats.length;
        saveProg();
        paint();
      }
    });
  }
  paint();
}

function buildBrowse(body, cfg, data) {
  let activeCat = 'all', query = '';
  const cats = Object.keys(cfg.catMap).filter(c => data.some(d => d[cfg.catField] === c));
  body.appendChild(el(`<div class="searchbox"><input type="text" id="rq" placeholder="Search ${cfg.noun}&hellip;" autocomplete="off"></div>`));
  const chips = el(`<div class="refchips"></div>`);
  const mkChip = (c, label) => {
    const b = el(`<button class="refchip ${c === activeCat ? 'active' : ''}" data-c="${c}">${esc(label)}</button>`);
    b.addEventListener('click', () => { activeCat = c; chips.querySelectorAll('.refchip').forEach(x => x.classList.toggle('active', x === b)); render(); });
    return b;
  };
  chips.appendChild(mkChip('all', `All (${data.length})`));
  cats.forEach(c => chips.appendChild(mkChip(c, cfg.catMap[c])));
  body.appendChild(chips);

  const list = el(`<div class="reflist"></div>`);
  body.appendChild(list);

  function render() {
    list.replaceChildren();
    let pool = activeCat === 'all' ? data : data.filter(d => d[cfg.catField] === activeCat);
    if (query.length >= 2) pool = pool.filter(d => cfg.search(d).includes(query));
    if (!pool.length) { list.appendChild(el(`<div class="empty">No matches.</div>`)); return; }
    pool.forEach(d => list.appendChild(refCard(cfg, d)));
  }
  body.querySelector('#rq').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); render(); });
  render();
}

function fieldVal(d, src) { return typeof src === 'function' ? src(d) : d[src]; }

function refCard(cfg, d) {
  const card = el(`<div class="refitem">
    <button class="refhead">
      <span class="refttl">${esc(cfg.title(d))}</span>
      <span class="refsub">${esc(cfg.sub(d))}</span>
    </button>
    <div class="refdetail" hidden>
      ${cfg.fields.map(([lab, src]) => { const v = fieldVal(d, src); return v && v !== '—' ? `<div class="refrow"><span class="label">${esc(lab)}</span><p>${esc(v)}</p></div>` : ''; }).join('')}
    </div>
  </div>`);
  const detail = card.querySelector('.refdetail');
  card.querySelector('.refhead').addEventListener('click', () => {
    const open = detail.hidden; detail.hidden = !open;
    card.classList.toggle('open', open);
  });
  return card;
}

/* ---------- recall drill (multiple choice) ---------- */
function buildQuiz(body, cfg, data, opts = {}) {
  const isPharm = cfg.store === 'pharm';
  const isMicro = opts.key === 'micro';
  const isLabs = opts.key === 'labs';
  const refProg = isMicro ? MICRO_PROG : isLabs ? LABS_PROG : null;
  const saveRefProg = isMicro ? saveMicroProg : isLabs ? saveLabsProg : null;
  let activeCat = opts.cat || 'all';
  let mode = opts.mode || 'moa';
  const cats = (isPharm || isMicro || isLabs) ? Object.keys(cfg.catMap).filter(c => data.some(d => d[cfg.catField] === c)) : [];

  if (isPharm) {
    const controls = el(`<div class="pharm-drill-controls"></div>`);
    const modeRow = el(`<div class="pharm-drill-modes">
      <button class="refchip ${mode === 'moa' ? 'active' : ''}" data-mode="moa">MOA &rarr; drug</button>
      <button class="refchip ${mode === 'pearl' ? 'active' : ''}" data-mode="pearl">Pearl &rarr; drug</button>
    </div>`);
    modeRow.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      renderRefSet('pharm', 'quiz', { cat: activeCat, mode: b.dataset.mode });
    }));
    controls.appendChild(modeRow);
    const chips = el(`<div class="refchips"></div>`);
    const mkChip = (c, label) => {
      const b = el(`<button class="refchip ${c === activeCat ? 'active' : ''}" data-c="${c}">${esc(label)}</button>`);
      b.addEventListener('click', () => renderRefSet('pharm', 'quiz', { cat: c, mode }));
      return b;
    };
    chips.appendChild(mkChip('all', `All (${data.length})`));
    cats.forEach(c => {
      const n = data.filter(d => d[cfg.catField] === c).length;
      const acc = pharmCatStats(c);
      chips.appendChild(mkChip(c, `${cfg.catMap[c]} (${n}${acc != null ? ` · ${acc}%` : ''})`));
    });
    controls.appendChild(chips);
    body.appendChild(controls);
  }

  if (isMicro || isLabs) {
    const controls = el(`<div class="pharm-drill-controls"></div>`);
    const chips = el(`<div class="refchips"></div>`);
    const bucket = isLabs ? 'byPanel' : 'byCat';
    const mkChip = (c, label) => {
      const b = el(`<button class="refchip ${c === activeCat ? 'active' : ''}" data-c="${c}">${esc(label)}</button>`);
      b.addEventListener('click', () => renderRefSet(opts.key, 'quiz', { cat: c }));
      return b;
    };
    chips.appendChild(mkChip('all', `All (${data.length})`));
    cats.forEach(c => {
      const n = data.filter(d => d[cfg.catField] === c).length;
      const b = refProg[bucket][c];
      const acc = b?.total ? Math.round(100 * b.correct / b.total) : null;
      chips.appendChild(mkChip(c, `${cfg.catMap[c]} (${n}${acc != null ? ` · ${acc}%` : ''})`));
    });
    controls.appendChild(chips);
    body.appendChild(controls);
  }

  const wrap = el(`<div class="quizwrap"></div>`);
  body.appendChild(wrap);
  let scoreN = isPharm ? (PHARM_PROG.drill.correct || 0) : (refProg?.drill?.correct || 0);
  let scoreT = isPharm ? (PHARM_PROG.drill.total || 0) : (refProg?.drill?.total || 0);

  function pool() {
    let p = activeCat === 'all' ? data : data.filter(d => d[cfg.catField] === activeCat);
    return p.length ? p : data;
  }

  function shuffle(a) { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[x[i], x[j]] = [x[j], x[i]]; } return x; }

  function quizClue(item) {
    if (isPharm && mode === 'pearl') return `Pearl: ${item.pearl}`;
    return cfg.quizClue(item);
  }

  function nextQ() {
    const source = pool();
    const item = source[Math.floor(Math.random() * source.length)];
    let same = source.filter(d => d[cfg.catField] === item[cfg.catField] && cfg.title(d) !== cfg.title(item));
    if (same.length < 3) same = source.filter(d => cfg.title(d) !== cfg.title(item));
    const distractors = shuffle(same).slice(0, 3);
    const optsList = shuffle([item, ...distractors]);
    const ask = isPharm && mode === 'pearl' ? 'Which drug matches this pearl?' : cfg.quizAsk;

    wrap.replaceChildren();
    const card = el(`<section class="stage">
      <div class="stage-head"><span class="label">${esc(ask)}</span><span class="rule"></span>
        <span class="topstat quizscore">${scoreT ? `${scoreN}/${scoreT} &middot; ${Math.round(100 * scoreN / scoreT)}%` : ''}</span></div>
      <p class="q quizclue">${esc(quizClue(item)).replace(/\n/g, '<br>')}</p>
      <div class="opts">${optsList.map((o, i) => `<button class="opt" data-i="${i}"><span class="key">${LETTERS[i]}</span><span>${esc(cfg.title(o))}</span></button>`).join('')}</div>
      <div class="after"></div>
    </section>`);
    const after = card.querySelector('.after');
    card.querySelectorAll('.opt').forEach(btn => btn.addEventListener('click', () => {
      const pick = optsList[Number(btn.dataset.i)];
      const correct = cfg.title(pick) === cfg.title(item);
      scoreT++; if (correct) scoreN++;
      if (isPharm) recordPharmDrill(item[cfg.catField], correct);
      else if (refProg && saveRefProg) recordRefDrill(refProg, saveRefProg, cfg.catField, item[cfg.catField], correct);
      card.querySelectorAll('.opt').forEach(b2 => {
        const o = optsList[Number(b2.dataset.i)]; b2.disabled = true;
        if (cfg.title(o) === cfg.title(item)) b2.classList.add('correct');
        else if (b2 === btn) b2.classList.add('wrong'); else b2.classList.add('dimmed');
      });
      after.appendChild(el(`<div class="explain ${correct ? 'good' : 'bad'}">
        <span class="verdict">${correct ? 'CORRECT' : 'INCORRECT'} &middot; ${esc(cfg.title(item))}</span>
        ${cfg.fields.map(([lab, src]) => { const v = fieldVal(item, src); return v && v !== '—' ? `<p><b>${esc(lab)}:</b> ${esc(v)}</p>` : ''; }).join('')}
      </div>`));
      const row = el(`<div class="continue-row"><button class="btn btn-solid" data-continue>Next</button></div>`);
      row.querySelector('[data-continue]').addEventListener('click', nextQ);
      after.appendChild(row);
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }));
    wrap.appendChild(card);
  }
  nextQ();
}

window.medicineHubSnapshot = medicineHubSnapshot;
window._resetMedicineMemory = function () {
  PHARM_PROG = defaultPharmProg();
  MICRO_PROG = defaultMicroProg();
  LABS_PROG = defaultLabsProg();
  MED_META = defaultMedMeta();
};
