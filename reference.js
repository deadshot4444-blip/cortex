/* Cortex — Reference: Pharmacology, Microbiology, Lab values
   Browse + search + multiple-choice recall drill over fact-checked datasets. */

const REF = { pharm: null, micro: null, labs: null, loaded: false };

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
  const main = el(`<main class="panel">
    <div class="hero"><h1>Medicine.</h1><p class="sub">High-yield, fact-checked decks — pharmacology, microbiology and lab interpretation. Browse, search, or drill.</p></div>
    <div class="mcat-mods"></div>
    <p class="anat-credit">Original study content, AI-generated and fact-checked. For study, not a substitute for prescribing references or your clinical judgment.</p>
  </main>`);

  const mc = main.querySelector('.mcat-mods');
  [['pharm', 'Pharmacology', 'MOA, uses, adverse effects & board pearls'],
   ['micro', 'Microbiology', 'Bug ID, diseases, treatment & buzzwords'],
   ['labs', 'Lab values', 'Reference ranges & how to read high vs low']].forEach(([k, nm, desc]) => {
    const n = (REF[k] || []).length;
    const card = el(`<button class="modcard" ${n ? '' : 'disabled'}>
      <span class="mod-name">${esc(nm)}</span>
      <span class="mod-desc">${esc(desc)}</span>
      <span class="mod-stat">${n ? `${n} ${REF_SETS[k].noun}` : 'generating&hellip;'}</span>
    </button>`);
    if (n) card.addEventListener('click', () => renderRefSet(k));
    mc.appendChild(card);
  });
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
function renderRefSet(key, tab = 'browse') {
  const cfg = REF_SETS[key];
  const data = REF[key] || [];
  const root = el('<div></div>');
  root.appendChild(topbar('reference'));
  const main = el(`<main class="panel">
    <div class="hero"><h1>${esc(cfg.name)}.</h1><p class="sub">${data.length} ${cfg.noun} across ${Object.keys(cfg.catMap).length} groups.</p></div>
    <div class="tabs">
      <button class="tab ${tab === 'browse' ? 'active' : ''}" data-tab="browse">Browse</button>
      <button class="tab ${tab === 'quiz' ? 'active' : ''}" data-tab="quiz">Drill</button>
      <button class="ghostbtn refback" id="refback" style="margin-left:auto">&larr; Medicine</button>
    </div>
    <div id="refbody"></div>
  </main>`);
  main.querySelector('#refback').addEventListener('click', renderReference);
  main.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => renderRefSet(key, b.dataset.tab)));
  const body = main.querySelector('#refbody');
  if (tab === 'browse') buildBrowse(body, cfg, data);
  else buildQuiz(body, cfg, data);
  root.appendChild(main);
  setView(root);
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
function buildQuiz(body, cfg, data) {
  const wrap = el(`<div class="quizwrap"></div>`);
  body.appendChild(wrap);
  let scoreN = 0, scoreT = 0;

  function shuffle(a) { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[x[i], x[j]] = [x[j], x[i]]; } return x; }

  function nextQ() {
    const item = data[Math.floor(Math.random() * data.length)];
    let same = data.filter(d => d[cfg.catField] === item[cfg.catField] && cfg.title(d) !== cfg.title(item));
    if (same.length < 3) same = data.filter(d => cfg.title(d) !== cfg.title(item));
    const distractors = shuffle(same).slice(0, 3);
    const opts = shuffle([item, ...distractors]);

    wrap.replaceChildren();
    const card = el(`<section class="stage">
      <div class="stage-head"><span class="label">${esc(cfg.quizAsk)}</span><span class="rule"></span>
        <span class="topstat quizscore">${scoreT ? `${scoreN}/${scoreT} &middot; ${Math.round(100 * scoreN / scoreT)}%` : ''}</span></div>
      <p class="q quizclue">${esc(cfg.quizClue(item)).replace(/\n/g, '<br>')}</p>
      <div class="opts">${opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="key">${LETTERS[i]}</span><span>${esc(cfg.title(o))}</span></button>`).join('')}</div>
      <div class="after"></div>
    </section>`);
    const after = card.querySelector('.after');
    card.querySelectorAll('.opt').forEach(btn => btn.addEventListener('click', () => {
      const pick = opts[Number(btn.dataset.i)];
      const correct = cfg.title(pick) === cfg.title(item);
      scoreT++; if (correct) scoreN++;
      card.querySelectorAll('.opt').forEach(b2 => {
        const o = opts[Number(b2.dataset.i)]; b2.disabled = true;
        if (cfg.title(o) === cfg.title(item)) b2.classList.add('correct');
        else if (b2 === btn) b2.classList.add('wrong'); else b2.classList.add('dimmed');
      });
      after.appendChild(el(`<div class="explain ${correct ? 'good' : 'bad'}">
        <span class="verdict">${correct ? 'CORRECT' : 'INCORRECT'} &middot; ${esc(cfg.title(item))}</span>
        ${cfg.fields.map(([lab, src]) => { const v = fieldVal(item, src); return v && v !== '—' ? `<p><b>${esc(lab)}:</b> ${esc(v)}</p>` : ''; }).join('')}
      </div>`));
      const row = el(`<div class="continue-row"><span class="hint">ENTER &rarr;</span><button class="btn btn-solid" data-continue>Next</button></div>`);
      row.querySelector('[data-continue]').addEventListener('click', nextQ);
      after.appendChild(row);
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }));
    wrap.appendChild(card);
  }
  nextQ();
}
