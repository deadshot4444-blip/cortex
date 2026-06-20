/* Cortex — Reference: Pharmacology, Microbiology, Lab values
   Browse + search + multiple-choice recall drill over fact-checked datasets. */

const REF = { pharm: null, micro: null, labs: null, loaded: false };
const PHARM_PROG = (typeof loadJSON === 'function') ? loadJSON('cs-pharm', { drill: { correct: 0, total: 0 }, byCat: {}, learned: {} })
  : { drill: { correct: 0, total: 0 }, byCat: {}, learned: {} };
function savePharmProg() {
  if (typeof safeSet === 'function') safeSet('cs-pharm', JSON.stringify(PHARM_PROG));
  else try { localStorage.setItem('cs-pharm', JSON.stringify(PHARM_PROG)); } catch {}
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

/* ---------- hub ---------- */
async function renderReference() {
  if (typeof stopTimer === 'function') stopTimer();
  if (typeof session !== 'undefined') session = null;
  await loadRef();

  const root = el('<div></div>');
  root.appendChild(topbar('reference'));
  const pharmN = (REF.pharm || []).length;
  const freeNote = typeof cortexFreeNote === 'function'
    ? cortexFreeNote('Medicine free for now', 'Medicine reference')
    : '';
  const main = el(`<main class="panel">
    <div class="hero"><h1>Medicine.</h1><p class="sub">High-yield, fact-checked reference decks — teach yourself mechanisms before you memorize names.</p></div>
    ${freeNote}
    <div class="mcat-mods"></div>
    <p class="anat-credit">Original study content, independently reviewed. For study, not a substitute for prescribing references or your clinical judgment.</p>
  </main>`);

  const mc = main.querySelector('.mcat-mods');
  [['pharm', 'Pharmacology', pharmN ? `${pharmN} drugs · class map, guided learn & drill` : 'MOA, uses, adverse effects & board pearls'],
   ['micro', 'Microbiology', 'Bug ID, diseases, treatment & buzzwords'],
   ['labs', 'Lab values', 'Reference ranges & how to read high vs low']].forEach(([k, nm, desc]) => {
    const n = (REF[k] || []).length;
    const card = el(`<button class="modcard" ${n ? '' : 'disabled'}>
      <span class="mod-name">${esc(nm)}</span>
      <span class="mod-desc">${esc(desc)}</span>
      <span class="mod-stat">${n ? `${n} ${REF_SETS[k].noun}` : 'generating&hellip;'}</span>
    </button>`);
    if (n) card.addEventListener('click', () => renderRefSet(k, k === 'pharm' ? 'classes' : 'browse'));
    mc.appendChild(card);
  });
  if (typeof renderPerformanceDrugs === 'function') {
    const ped = el(`<button class="modcard">
      <span class="mod-name">Performance drugs</span>
      <span class="mod-desc">Hormone map (steroid / peptide / amine), pathway flowchart game &amp; agent catalog</span>
      <span class="mod-stat">6 pathways · 30 agents</span>
    </button>`);
    ped.addEventListener('click', () => renderPerformanceDrugs('hub'));
    mc.appendChild(ped);
  }
  if (typeof renderEKG === 'function') {
    const ek = el(`<button class="modcard">
      <span class="mod-name">ECG rhythms</span>
      <span class="mod-desc">Read live tracings &mdash; library + identify-the-rhythm drill</span>
      <span class="mod-stat">${EKG_RHYTHMS.length} rhythms</span>
    </button>`);
    ek.addEventListener('click', () => renderEKG());
    mc.appendChild(ek);
  }

  root.appendChild(main);
  setView(root);
}

/* ---------- a single dataset: browse / search / quiz ---------- */
function renderRefSet(key, tab = 'browse', opts = {}) {
  const cfg = REF_SETS[key];
  const data = REF[key] || [];
  const isPharm = key === 'pharm';
  const drillAcc = PHARM_PROG.drill.total ? Math.round(100 * PHARM_PROG.drill.correct / PHARM_PROG.drill.total) : null;
  const root = el('<div></div>');
  root.appendChild(topbar('reference'));
  const sub = isPharm
    ? `${data.length} drugs · ${Object.keys(cfg.catMap).length} classes${drillAcc != null ? ` · ${PHARM_PROG.drill.correct}/${PHARM_PROG.drill.total} drilled` : ''}`
    : `${data.length} ${cfg.noun} across ${Object.keys(cfg.catMap).length} groups.`;
  const tabs = isPharm
    ? `<button class="tab ${tab === 'classes' ? 'active' : ''}" data-tab="classes">Classes</button>
       <button class="tab ${tab === 'learn' ? 'active' : ''}" data-tab="learn">Learn</button>
       <button class="tab ${tab === 'browse' ? 'active' : ''}" data-tab="browse">Browse</button>
       <button class="tab ${tab === 'quiz' ? 'active' : ''}" data-tab="quiz">Drill</button>`
    : `<button class="tab ${tab === 'browse' ? 'active' : ''}" data-tab="browse">Browse</button>
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
  else if (tab === 'browse') buildBrowse(body, cfg, data);
  else buildQuiz(body, cfg, data, isPharm ? opts : {});
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
    const acc = pharmCatStats(cat);
    const card = el(`<button class="pharm-classcard" type="button">
      <span class="pharm-classname">${esc(cfg.catMap[cat])}</span>
      <span class="pharm-classmeta">${n} drugs${acc != null ? ` · ${acc}% drilled` : ''}</span>
    </button>`);
    card.addEventListener('click', () => renderRefSet('pharm', 'learn', { cat }));
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
  let idx = 0;
  let step = 0;
  const wrap = el(`<div class="pharm-learn"></div>`);
  body.appendChild(wrap);

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
        <span class="label">${esc(cfg.catMap[cat])} · ${idx + 1}/${pool.length}</span>
        <span class="rule"></span>
        <span class="topstat">${esc(s.label)}</span>
      </div>
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
          PHARM_PROG.learned[drug.id || drug.name] = { ts: Date.now(), cat };
          savePharmProg();
          idx++; step = 0;
        } else step++;
        render();
      });
      after.appendChild(row);
    });
    wrap.replaceChildren(revealed);
    revealed.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  render();
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
  let activeCat = opts.cat || 'all';
  let mode = opts.mode || 'moa';
  const cats = isPharm ? Object.keys(cfg.catMap).filter(c => data.some(d => d[cfg.catField] === c)) : [];

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

  const wrap = el(`<div class="quizwrap"></div>`);
  body.appendChild(wrap);
  let scoreN = 0, scoreT = 0;

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
