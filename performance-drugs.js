/* Cortex — Performance enhancing drugs (structured study path) */

const PED = { data: null, loaded: false };
const PED_HORMONE_TABS = ['steroid', 'peptide', 'amine'];
const PED_HORM_LEARN = [
  { key: 'where', label: 'Where it acts', field: 'where', ask: 'Where does this agent act?' },
  { key: 'pathway', label: 'Pathway', field: 'pathway', ask: 'Which pathway or axis is it on?' },
  { key: 'pedNote', label: 'PED note', field: 'pedNote', ask: 'Why does this matter for performance abuse?' },
  { key: 'pearl', label: 'Pearl', field: 'pearl', ask: 'One board pearl?' },
];

let PED_PROG = (typeof loadJSON === 'function') ? loadJSON('cs-ped', null) : null;

function migratePedProg(raw) {
  const base = {
    hormones: { steroid: { learned: [] }, peptide: { learned: [] }, amine: { learned: [] } },
    pathways: {},
    modules: {},
    catalogDone: false,
    catalogSection: 0,
    clinicalDone: false,
    clinicalStep: 0,
  };
  if (!raw) return base;
  if (raw.hormones) base.hormones = raw.hormones;
  else if (raw.learned) base.hormones = raw.learned;
  if (raw.pathways) {
    Object.entries(raw.pathways).forEach(([id, v]) => {
      base.pathways[id] = { completed: !!(v.completed || (v.best >= 80)), best: v.best || 0, runs: v.runs || 0 };
    });
  }
  if (raw.modules) base.modules = raw.modules;
  base.catalogDone = !!raw.catalogDone;
  base.catalogSection = raw.catalogSection || 0;
  base.clinicalDone = !!raw.clinicalDone;
  base.clinicalStep = raw.clinicalStep || 0;
  return base;
}

function pedPhase(mod) {
  if (mod.order <= 3) return { id: 'hormones', label: 'Part I · Hormone classes', hint: 'Learn where each agent acts before the axes.' };
  if (mod.order <= 9) return { id: 'pathways', label: 'Part II · Axis pathways', hint: 'Build flowcharts, then checkpoint each axis.' };
  return { id: 'apply', label: 'Part III · Agents & clinical', hint: 'Catalog abuse categories, then labs & risks.' };
}

function pedModuleInProgress(mod) {
  const st = pedModuleStatus(mod);
  if (st.complete) return false;
  if (mod.type === 'hormone') return st.done > 0;
  if (mod.type === 'pathway') return (PED_PROG.pathways[mod.pathwayId]?.runs || 0) > 0;
  if (mod.type === 'catalog') return PED_PROG.catalogSection > 0;
  if (mod.type === 'clinical') return PED_PROG.clinicalStep > 0;
  return false;
}

function pedStepDots(total, current, label) {
  const dots = Array.from({ length: total }, (_, i) =>
    `<span class="ped-dot ${i < current ? 'done' : i === current ? 'active' : ''}" aria-hidden="true"></span>`
  ).join('');
  return `<div class="ped-steps" aria-label="${esc(label)}"><span class="ped-steps-lab">${esc(label)}</span><span class="ped-steps-dots">${dots}</span><span class="ped-steps-num">${current + 1}/${total}</span></div>`;
}

function pedProgressBand(pct, label, stat) {
  return `<div class="ped-pathband ped-pathband--slim">
    ${label ? `<div class="ped-pathband-head"><span class="label">${esc(label)}</span>${stat ? `<span class="ped-pathstat">${esc(stat)}</span>` : ''}</div>` : ''}
    <span class="bar"><i style="width:${pct}%"></i></span>
  </div>`;
}

PED_PROG = migratePedProg(PED_PROG);

function savePedProg() {
  if (typeof safeSet === 'function') safeSet('cs-ped', JSON.stringify(PED_PROG));
  else try { localStorage.setItem('cs-ped', JSON.stringify(PED_PROG)); } catch {}
}

function agentKey(a) { return a.id || a.name; }

async function loadPED() {
  if (PED.loaded) return;
  try {
    const r = await fetch('data/performance-drugs.json', { cache: 'no-store' });
    PED.data = r.ok ? await r.json() : null;
  } catch { PED.data = null; }
  PED.loaded = true;
}

function pedModules() {
  return (PED.data?.studyPath || []).slice().sort((a, b) => a.order - b.order);
}

function pedHormoneAgents(hormone) {
  return PED.data?.hormoneTabs?.[hormone]?.agents || [];
}

function pedModuleStatus(mod) {
  if (mod.type === 'hormone') {
    const total = pedHormoneAgents(mod.hormone).length;
    const learned = PED_PROG.hormones[mod.hormone]?.learned || [];
    const done = learned.length;
    return { done, total, pct: total ? Math.round(100 * done / total) : 0, complete: total > 0 && done >= total };
  }
  if (mod.type === 'pathway') {
    const p = PED_PROG.pathways[mod.pathwayId] || {};
    return { done: p.completed ? 1 : 0, total: 1, pct: p.completed ? 100 : (p.best || 0), complete: !!p.completed, best: p.best || 0, runs: p.runs || 0 };
  }
  if (mod.type === 'catalog') {
    const secs = PED.data?.catalogSections?.length || 1;
    const done = PED_PROG.catalogDone ? secs : PED_PROG.catalogSection;
    const pct = PED_PROG.catalogDone ? 100 : Math.round(100 * done / secs);
    return { done, total: secs, pct, complete: PED_PROG.catalogDone };
  }
  if (mod.type === 'clinical') {
    const steps = 3;
    const done = PED_PROG.clinicalDone ? steps : PED_PROG.clinicalStep;
    const pct = PED_PROG.clinicalDone ? 100 : Math.round(100 * done / steps);
    return { done, total: steps, pct, complete: PED_PROG.clinicalDone };
  }
  return { done: 0, total: 1, pct: 0, complete: false };
}

function pedOverallProgress() {
  const mods = pedModules();
  const complete = mods.filter(m => pedModuleStatus(m).complete).length;
  return { complete, total: mods.length, pct: mods.length ? Math.round(100 * complete / mods.length) : 0 };
}

function pedNextModule() {
  return pedModules().find(m => !pedModuleStatus(m).complete) || null;
}

function pedModuleUnlocked(mod, idx) {
  if (idx === 0) return true;
  const prev = pedModules()[idx - 1];
  return prev ? pedModuleStatus(prev).complete : true;
}

function markPedModuleComplete(modId) {
  PED_PROG.modules[modId] = { completed: true, ts: Date.now() };
  savePedProg();
}

function pedStatsSnapshot() {
  const o = pedOverallProgress();
  let agents = 0;
  PED_HORMONE_TABS.forEach(h => { agents += (PED_PROG.hormones[h]?.learned || []).length; });
  const pathwaysDone = Object.values(PED_PROG.pathways).filter(p => p.completed).length;
  return { ...o, agents, pathwaysDone, has: o.complete > 0 || agents > 0 || pathwaysDone > 0 };
}

async function renderPerformanceDrugs(tab = 'hub', opts = {}) {
  if (typeof stopTimer === 'function') stopTimer();
  if (typeof session !== 'undefined') session = null;
  await loadPED();
  if (!PED.data) { renderReference(); return; }

  if (tab === 'hub') return renderPEDHub();
  if (tab === 'module') return renderPEDModule(opts.moduleId);
  if (tab === 'hormones') return renderPEDHormones(opts.hormone || 'steroid', opts.mode || 'browse');
  if (tab === 'pathways') return renderPEDPathways(opts.pathwayId || null);
  if (tab === 'catalog') return renderPEDCatalog(true);
  if (tab === 'clinical') return renderPEDClinical(true);
  renderPEDHub();
}

function renderPEDHub() {
  const d = PED.data;
  const prog = pedOverallProgress();
  const next = pedNextModule();
  const mods = pedModules();
  const root = el('<div></div>');
  root.appendChild(topbar('reference'));
  const main = el(`<main class="panel ped-page">
    <button class="backbtn topback" id="pedback">&larr; Medicine</button>
    <div class="hero"><h1>${esc(d.title)}.</h1><p class="sub">Guided study path — hormones first, then axes, then agents &amp; clinical.</p></div>
    <p class="ped-disclaimer">${esc(d.disclaimer)}</p>
    <div class="ped-pathband">
      <div class="ped-pathband-head">
        <span class="label">Course progress</span>
        <span class="ped-pathstat">${prog.complete}/${prog.total} modules · ${prog.pct}%</span>
      </div>
      <span class="bar"><i style="width:${prog.pct}%"></i></span>
    </div>
    ${next ? `<div class="ped-cta-row">
      <button class="btn btn-solid" id="pedcontinue">Continue &middot; ${esc(next.title)}</button>
      <button class="btn" id="pedbrowse">Browse reference</button>
    </div>` : `<p class="ped-complete-msg">Path complete. Use reference tabs to review.</p>`}
    <span class="label ped-modulelabel">Study path</span>
    <div id="pedmodules"></div>
    <details class="ped-ref-fold">
      <summary class="ped-ref-sum"><span class="label">Quick reference</span></summary>
      <div class="ped-reflinks">
        <button class="btn" type="button" data-ref="hormones">Hormone map</button>
        <button class="btn" type="button" data-ref="catalog">Agent catalog</button>
        <button class="btn" type="button" data-ref="clinical">Clinical</button>
      </div>
    </details>
  </main>`);
  main.querySelector('#pedback').addEventListener('click', renderReference);
  if (next) {
    main.querySelector('#pedcontinue').addEventListener('click', () => renderPEDModule(next.id));
    main.querySelector('#pedbrowse')?.addEventListener('click', () => renderPEDHormones('steroid', 'browse'));
  }
  const list = main.querySelector('#pedmodules');
  let lastPhase = '';
  let phaseList = null;
  mods.forEach((mod, idx) => {
    const phase = pedPhase(mod);
    if (phase.id !== lastPhase) {
      lastPhase = phase.id;
      list.appendChild(el(`<div class="ped-phasehead">
        <span class="ped-phaselabel">${esc(phase.label)}</span>
        <span class="ped-phasehint">${esc(phase.hint)}</span>
      </div>`));
      phaseList = el('<div class="ped-modulelist"></div>');
      list.appendChild(phaseList);
    }
    const st = pedModuleStatus(mod);
    const unlocked = pedModuleUnlocked(mod, idx);
    const current = next && next.id === mod.id;
    const inProg = pedModuleInProgress(mod);
    let stat = 'Locked';
    if (st.complete) stat = 'Done';
    else if (mod.type === 'hormone') stat = `${st.done}/${st.total}`;
    else if (mod.type === 'pathway') stat = st.runs ? `Best ${st.best}%` : unlocked ? 'Start' : 'Locked';
    else if (mod.type === 'catalog' || mod.type === 'clinical') stat = inProg ? `${st.done}/${st.total}` : unlocked ? 'Start' : 'Locked';
    else if (unlocked) stat = 'Start';
    const tag = unlocked ? 'button' : 'div';
    const row = el(`<${tag} class="ped-modrow ${st.complete ? 'done' : ''} ${current ? 'current' : ''} ${inProg ? 'inprog' : ''} ${unlocked ? '' : 'locked'}" ${unlocked ? `type="button" data-mod="${mod.id}"` : ''}>
      <span class="ped-modnum">${mod.order}</span>
      <span class="ped-modmain">
        <span class="ped-modtitle">${esc(mod.title)}</span>
        <span class="ped-modsub">${esc(mod.subtitle)}</span>
        ${mod.type === 'hormone' && st.total && !st.complete ? `<span class="ped-modbar"><i style="width:${st.pct}%"></i></span>` : ''}
      </span>
      <span class="ped-modstat">${stat}</span>
    </${tag}>`);
    if (unlocked) row.addEventListener('click', () => renderPEDModule(mod.id));
    (phaseList || list).appendChild(row);
  });
  main.querySelectorAll('[data-ref]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.ref;
    if (k === 'hormones') renderPEDHormones('steroid', 'browse');
    else renderPerformanceDrugs(k);
  }));
  root.appendChild(main);
  setView(root);
}

function renderPEDModule(moduleId) {
  const mod = pedModules().find(m => m.id === moduleId);
  if (!mod) { renderPEDHub(); return; }
  if (mod.type === 'hormone') return renderPEDHormoneStudy(mod);
  if (mod.type === 'pathway') return renderPEDPathwayLesson(mod.pathwayId, mod.id);
  if (mod.type === 'catalog') return renderPEDCatalog(false, mod.id);
  if (mod.type === 'clinical') return renderPEDClinical(false, mod.id);
  renderPEDHub();
}

/* ---------- hormone module: guided learn ---------- */
function renderPEDHormoneStudy(mod) {
  const block = PED.data.hormoneTabs[mod.hormone];
  const agents = block.agents;
  const learned = PED_PROG.hormones[mod.hormone]?.learned || [];
  let idx = agents.findIndex(a => !learned.includes(agentKey(a)));
  if (idx < 0) idx = 0;

  const root = el('<div></div>');
  root.appendChild(topbar('reference'));
  const main = el(`<main class="panel ped-page">
    <button class="backbtn topback" id="pedback">&larr; Study path</button>
    <div class="hero"><h1>${esc(mod.title)}.</h1><p class="sub">Module ${mod.order} · ${learned.length}/${agents.length} agents studied</p></div>
    <div class="ped-pathband ped-pathband--slim">
      <span class="bar"><i style="width:${agents.length ? Math.round(100 * learned.length / agents.length) : 0}%"></i></span>
    </div>
    <div id="pedlearn"></div>
  </main>`);
  main.querySelector('#pedback').addEventListener('click', renderPEDHub);
  root.appendChild(main);
  setView(root);
  runHormoneLearn(mod, agents, learned, idx);
}

function runHormoneLearn(mod, agents, learned, agentIdx, step = 0) {
  const mount = document.getElementById('pedlearn');
  if (!mount) return;
  const block = PED.data.hormoneTabs[mod.hormone];

  if (agentIdx >= agents.length) {
    markPedModuleComplete(mod.id);
    mount.replaceChildren(el(`<section class="stage">
      <span class="label">Module ${mod.order} complete</span>
      <div class="neuro-score">&#10003;</div>
      <p class="sub">All ${agents.length} agents in ${esc(block.label)} studied.</p>
      <div class="endbtns">
        <button class="btn btn-solid" id="pednext">Next module</button>
        <button class="btn" id="pedhub">Study path</button>
      </div>
    </section>`));
    const nxt = pedModules().find(m => m.order === mod.order + 1);
    mount.querySelector('#pednext')?.addEventListener('click', () => nxt ? renderPEDModule(nxt.id) : renderPEDHub());
    mount.querySelector('#pedhub').addEventListener('click', renderPEDHub);
    return;
  }

  const agent = agents[agentIdx];
  const s = PED_HORM_LEARN[step];
  const node = el(`<section class="stage">
    <div class="stage-head">
      <span class="label">${esc(block.label)} · agent ${agentIdx + 1}/${agents.length}</span>
      <span class="rule"></span>
      <span class="topstat">${learned.length}/${agents.length} studied</span>
    </div>
    ${pedStepDots(PED_HORM_LEARN.length, step, s.label)}
    <h2 class="ped-drugname">${esc(agent.name)}</h2>
    <p class="ped-drugclass">${esc(agent.role)}</p>
    <p class="q">${esc(s.ask)}</p>
    <div class="socactions">
      <button class="btn btn-solid" data-reveal>Reveal</button>
    </div>
    <div class="after"></div>
  </section>`);
  const after = node.querySelector('.after');
  node.querySelector('[data-reveal]').addEventListener('click', () => {
    node.querySelector('.socactions')?.remove();
    after.appendChild(el(`<div class="socans"><div class="socblock"><span class="label">${esc(s.label)}</span><p>${esc(agent[s.field])}</p></div></div>`));
    const isLast = step === PED_HORM_LEARN.length - 1;
    const row = el(`<div class="continue-row"><button class="btn btn-solid" data-next>${isLast ? 'Next agent' : 'Continue'}</button></div>`);
    row.querySelector('[data-next]').addEventListener('click', () => {
      if (isLast) {
        const key = agentKey(agent);
        if (!PED_PROG.hormones[mod.hormone]) PED_PROG.hormones[mod.hormone] = { learned: [] };
        if (!PED_PROG.hormones[mod.hormone].learned.includes(key)) {
          PED_PROG.hormones[mod.hormone].learned.push(key);
          savePedProg();
        }
        const fresh = PED_PROG.hormones[mod.hormone].learned;
        runHormoneLearn(mod, agents, fresh, agentIdx + 1, 0);
        const bar = document.querySelector('.ped-page .ped-pathband--slim .bar i');
        if (bar) bar.style.width = `${agents.length ? Math.round(100 * fresh.length / agents.length) : 0}%`;
        const sub = document.querySelector('.ped-page .hero .sub');
        if (sub) sub.textContent = `Module ${mod.order} · ${fresh.length}/${agents.length} agents studied`;
      } else runHormoneLearn(mod, agents, learned, agentIdx, step + 1);
    });
    after.appendChild(row);
  });
  mount.replaceChildren(node);
}

/* ---------- hormone browse (reference) ---------- */
function renderPEDHormones(activeTab, mode) {
  const d = PED.data;
  const root = el('<div></div>');
  root.appendChild(topbar('reference'));
  const tabs = PED_HORMONE_TABS.map(k => {
    const t = d.hormoneTabs[k];
    const n = (PED_PROG.hormones[k]?.learned || []).length;
    const tot = t.agents.length;
    return `<button class="tab ${k === activeTab ? 'active' : ''}" data-horm="${k}">${esc(t.label)} <span class="ped-tabstat">${n}/${tot}</span></button>`;
  }).join('');
  const main = el(`<main class="panel ped-page">
    <button class="backbtn topback" id="pedback">&larr; Performance drugs</button>
    <div class="hero"><h1>Hormone map.</h1><p class="sub">Reference browse — use the study path for guided order.</p></div>
    <div class="tabs ped-hormtabs">${tabs}<button class="ghostbtn refback" id="pedhub" style="margin-left:auto">&larr; Hub</button></div>
    <div id="pedhormbody"></div>
  </main>`);
  main.querySelector('#pedback').addEventListener('click', renderPEDHub);
  main.querySelector('#pedhub').addEventListener('click', renderPEDHub);
  main.querySelectorAll('[data-horm]').forEach(b => b.addEventListener('click', () => renderPEDHormones(b.dataset.horm, mode)));
  const body = main.querySelector('#pedhormbody');
  const block = d.hormoneTabs[activeTab];
  const learnedSet = new Set(PED_PROG.hormones[activeTab]?.learned || []);
  body.appendChild(el(`<div class="ped-hormintro">
    <span class="label">${esc(block.label)}</span>
    <p class="sub">${esc(block.summary)}</p>
    <p class="ped-where"><strong>Where:</strong> ${esc(block.where)}</p>
  </div>`));
  const list = el(`<div class="ped-agentlist"></div>`);
  block.agents.forEach(a => {
    const done = learnedSet.has(agentKey(a));
    const card = el(`<article class="ped-agentcard ${done ? 'studied' : ''}">
      <div class="ped-agenthead">
        <span class="ped-agentname">${esc(a.name)}</span>
        <span class="ped-agentrole">${esc(a.role)}</span>
      </div>
      <div class="ped-agentrows">
        <div class="refrow"><span class="label">Where it acts</span><p>${esc(a.where)}</p></div>
        <div class="refrow"><span class="label">Pathway</span><p>${esc(a.pathway)}</p></div>
        <div class="refrow"><span class="label">PED / clinical note</span><p>${esc(a.pedNote)}</p></div>
        <div class="refrow"><span class="label">Pearl</span><p>${esc(a.pearl)}</p></div>
      </div>
    </article>`);
    if (done) card.querySelector('.ped-agentrole').appendChild(el('<span class="pill ok">studied</span>'));
    list.appendChild(card);
  });
  body.appendChild(list);
  root.appendChild(main);
  setView(root);
}

/* ---------- pathway: lesson → checkpoint (ordered) ---------- */
function renderPEDPathwayLesson(pathwayId, moduleId) {
  const pathway = PED.data.pathways.find(p => p.id === pathwayId);
  const mod = pedModules().find(m => m.id === moduleId);
  if (!pathway || !mod) { renderPEDHub(); return; }

  const root = el('<div></div>');
  root.appendChild(topbar('reference'));
  const p = PED_PROG.pathways[pathwayId] || {};
  const main = el(`<main class="panel ped-page">
    <button class="backbtn topback" id="pedback">&larr; Study path</button>
    <div class="hero"><h1>${esc(pathway.title)}.</h1><p class="sub">Module ${mod.order} · ${esc(pathway.subtitle)}${p.best ? ` · best ${p.best}%` : ''}</p></div>
    <div id="pedlessonbar"></div>
    <div id="pedlesson"></div>
  </main>`);
  main.querySelector('#pedback').addEventListener('click', renderPEDHub);
  root.appendChild(main);
  setView(root);
  startPathwayLesson(pathway, mod);
}

function pedRenderFlow(steps, revealedCount) {
  const flow = el(`<div class="ped-flow"></div>`);
  steps.forEach((s, i) => {
    const show = i < revealedCount;
    flow.appendChild(el(`<div class="ped-node ${show ? 'filled' : 'pending'}">${show ? esc(s.label) : '·'}</div>`));
    if (i < steps.length - 1) flow.appendChild(el(`<div class="ped-arrow" aria-hidden="true">↓</div>`));
  });
  return flow;
}

function startPathwayLesson(pathway, mod) {
  const mount = document.getElementById('pedlesson');
  const barMount = document.getElementById('pedlessonbar');
  if (!mount) return;
  const steps = pathway.steps;
  const quizzes = pathway.forkQuiz || [];
  let phase = 'orient';
  let stepIdx = 0;
  let qIdx = 0;
  let checkpointCorrect = 0;

  function updateBar() {
    if (!barMount) return;
    let pct = 0;
    let label = 'Orientation';
    let stat = '';
    if (phase === 'orient') { pct = 5; label = 'Orientation'; }
    else if (phase === 'build') {
      pct = 10 + Math.round(55 * stepIdx / Math.max(steps.length, 1));
      label = 'Build pathway';
      stat = `Step ${Math.min(stepIdx + 1, steps.length)}/${steps.length}`;
    } else {
      pct = 65 + Math.round(35 * qIdx / Math.max(quizzes.length, 1));
      label = 'Checkpoint';
      stat = quizzes.length ? `Q ${Math.min(qIdx + 1, quizzes.length)}/${quizzes.length}` : '';
    }
    barMount.replaceChildren(el(pedProgressBand(pct, label, stat)));
  }

  function shuffle(a) {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[x[i], x[j]] = [x[j], x[i]]; }
    return x;
  }

  function render() {
    updateBar();
    if (phase === 'orient') {
      mount.replaceChildren(el(`<section class="stage">
        <span class="label">Orientation</span>
        <p class="sub">${esc(pathway.orientation || pathway.subtitle)}</p>
        <p class="ped-lead">Three beats: orient → build the flowchart step-by-step → checkpoint MCQs in order (70% to pass).</p>
        <div class="continue-row"><button class="btn btn-solid" data-go>Build pathway</button></div>
      </section>`));
      mount.querySelector('[data-go]').addEventListener('click', () => { phase = 'build'; render(); });
      return;
    }

    if (phase === 'build') {
      if (stepIdx >= steps.length) { phase = 'checkpoint'; qIdx = 0; checkpointCorrect = 0; render(); return; }
      const s = steps[stepIdx];
      const card = el(`<section class="stage">
        <div class="stage-head"><span class="label">Step ${stepIdx + 1} of ${steps.length}</span><span class="rule"></span></div>
        <div class="ped-flowslot"></div>
        <div class="socans"><div class="socblock"><span class="label">${esc(s.label)}</span><p>${esc(s.hint)}</p></div></div>
        <div class="continue-row"><button class="btn btn-solid" data-go>${stepIdx < steps.length - 1 ? 'Add to pathway' : 'Start checkpoint'}</button></div>
      </section>`);
      card.querySelector('.ped-flowslot').appendChild(pedRenderFlow(steps, stepIdx + 1));
      card.querySelector('[data-go]').addEventListener('click', () => { stepIdx++; render(); });
      mount.replaceChildren(card);
      return;
    }

    if (phase === 'checkpoint') {
      if (qIdx >= quizzes.length) { finishPathway(); return; }
      const q = quizzes[qIdx];
      const opts = shuffle(q.options);
      const card = el(`<section class="stage">
        <div class="stage-head"><span class="label">Checkpoint ${qIdx + 1} / ${quizzes.length}</span><span class="rule"></span></div>
        <div class="ped-flowslot"></div>
        <p class="q">${esc(q.prompt)}</p>
        <div class="opts">${opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="key">${LETTERS[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>
        <div class="after"></div>
      </section>`);
      card.querySelector('.ped-flowslot').appendChild(pedRenderFlow(steps, steps.length));
      const after = card.querySelector('.after');
      card.querySelectorAll('.opt').forEach(btn => btn.addEventListener('click', () => {
        const pick = opts[Number(btn.dataset.i)];
        const ok = pick === q.answer;
        if (ok) checkpointCorrect++;
        card.querySelectorAll('.opt').forEach(b2 => {
          b2.disabled = true;
          const o = opts[Number(b2.dataset.i)];
          if (o === q.answer) b2.classList.add('correct');
          else if (b2 === btn) b2.classList.add('wrong');
          else b2.classList.add('dimmed');
        });
        after.appendChild(el(`<div class="explain ${ok ? 'good' : 'bad'}"><span class="verdict">${ok ? 'CORRECT' : 'INCORRECT'}</span><p>${esc(q.after)}</p></div>`));
        const row = el(`<div class="continue-row"><button class="btn btn-solid" data-go>${qIdx < quizzes.length - 1 ? 'Next' : 'Finish module'}</button></div>`);
        row.querySelector('[data-go]').addEventListener('click', () => { qIdx++; render(); });
        after.appendChild(row);
      }));
      mount.replaceChildren(card);
      return;
    }
  }

  function finishPathway() {
    const pct = quizzes.length ? Math.round(100 * checkpointCorrect / quizzes.length) : 100;
    const passed = pct >= 70;
    if (!PED_PROG.pathways[pathway.id]) PED_PROG.pathways[pathway.id] = { completed: false, best: 0, runs: 0 };
    PED_PROG.pathways[pathway.id].runs++;
    PED_PROG.pathways[pathway.id].best = Math.max(PED_PROG.pathways[pathway.id].best, pct);
    if (passed) {
      PED_PROG.pathways[pathway.id].completed = true;
      markPedModuleComplete(mod.id);
    }
    savePedProg();
    mount.replaceChildren(el(`<section class="stage">
      <span class="label">${passed ? 'Module complete' : 'Checkpoint — retry'}</span>
      <div class="neuro-score">${pct}%</div>
      <p class="sub">${checkpointCorrect}/${quizzes.length} checkpoint questions correct${passed ? '' : ' · need 70% to complete'}</p>
      <div class="endbtns">
        ${passed ? '<button class="btn btn-solid" id="pednext">Next module</button>' : '<button class="btn btn-solid" id="pedretry">Retry checkpoint</button>'}
        <button class="btn" id="pedhub">Study path</button>
      </div>
    </section>`));
    if (passed) {
      const nxt = pedModules().find(m => m.order === mod.order + 1);
      mount.querySelector('#pednext')?.addEventListener('click', () => nxt ? renderPEDModule(nxt.id) : renderPEDHub());
    } else {
      mount.querySelector('#pedretry')?.addEventListener('click', () => {
        phase = 'checkpoint'; qIdx = 0; checkpointCorrect = 0; render();
      });
    }
    mount.querySelector('#pedhub').addEventListener('click', renderPEDHub);
  }

  updateBar();
  render();
}

function renderPEDPathways(pathwayId) {
  renderPEDHub();
}

function renderPEDCatalog(fromRef, moduleId) {
  const d = PED.data;
  const mod = moduleId ? pedModules().find(m => m.id === moduleId) : null;
  const guided = !!mod && !fromRef;
  const root = el('<div></div>');
  root.appendChild(topbar('reference'));
  const main = el(`<main class="panel ped-page">
    <button class="backbtn topback" id="pedback">&larr; ${mod ? 'Study path' : 'Performance drugs'}</button>
    <div class="hero"><h1>Agent catalog.</h1><p class="sub">${guided ? 'Module 10 · one abuse category at a time' : 'Reference browse — all categories'}</p></div>
    ${guided ? '<div id="pedcatbar"></div>' : ''}
    <div id="pedcatalog"></div>
    ${guided ? '<div class="ped-cta-row" id="pedcatnav"></div>' : ''}
  </main>`);
  main.querySelector('#pedback').addEventListener('click', renderPEDHub);

  if (guided) {
    const secs = d.catalogSections;
    let idx = Math.min(PED_PROG.catalogSection, secs.length - 1);
    if (PED_PROG.catalogDone) idx = secs.length - 1;

    function paint() {
      const sec = secs[idx];
      const pct = Math.round(100 * idx / secs.length);
      main.querySelector('#pedcatbar')?.replaceChildren(el(pedProgressBand(pct, 'Catalog sections', `${idx + 1}/${secs.length}`)));
      const wrap = main.querySelector('#pedcatalog');
      wrap.replaceChildren(el(`<section class="stage">
        <span class="label">Section ${idx + 1} · ${esc(sec.title)}</span>
        <p class="ped-lead">High-yield agents in this abuse bucket — mechanism first, then risks.</p>
        <div class="ped-agentlist"></div>
      </section>`));
      const list = wrap.querySelector('.ped-agentlist');
      sec.items.forEach(item => {
        list.appendChild(el(`<article class="ped-agentcard ped-agentcard--compact">
          <div class="ped-agenthead"><span class="ped-agentname">${esc(item.name)}</span><span class="ped-agentrole">${esc(item.class)}</span></div>
          <div class="ped-agentrows">
            <div class="refrow"><span class="label">Mechanism</span><p>${esc(item.moa)}</p></div>
            <div class="refrow"><span class="label">Risks</span><p>${esc(item.risk)}</p></div>
          </div>
        </article>`));
      });
      const nav = main.querySelector('#pedcatnav');
      const last = idx >= secs.length - 1;
      nav.replaceChildren(el(`<button class="btn btn-solid" id="pedcatnext">${last ? 'Complete module' : 'Next section →'}</button>`));
      nav.querySelector('#pedcatnext').addEventListener('click', () => {
        if (!last) {
          idx++;
          PED_PROG.catalogSection = idx;
          savePedProg();
          paint();
        } else {
          PED_PROG.catalogDone = true;
          markPedModuleComplete(mod.id);
          savePedProg();
          mountCatalogComplete(mod);
        }
      });
    }

    function mountCatalogComplete(mod) {
      const wrap = main.querySelector('#pedcatalog');
      main.querySelector('#pedcatbar')?.replaceChildren(el(pedProgressBand(100, 'Catalog sections', 'Done')));
      main.querySelector('#pedcatnav')?.remove();
      const nxt = pedModules().find(m => m.order === mod.order + 1);
      wrap.replaceChildren(el(`<section class="stage">
        <span class="label">Module complete</span>
        <div class="neuro-score">&#10003;</div>
        <p class="sub">All ${secs.length} catalog sections reviewed.</p>
        <div class="endbtns">
          <button class="btn btn-solid" id="pednext">Next module</button>
          <button class="btn" id="pedhub">Study path</button>
        </div>
      </section>`));
      wrap.querySelector('#pednext')?.addEventListener('click', () => nxt ? renderPEDModule(nxt.id) : renderPEDHub());
      wrap.querySelector('#pedhub')?.addEventListener('click', renderPEDHub);
    }

    if (PED_PROG.catalogDone) mountCatalogComplete(mod);
    else paint();
  } else {
    const wrap = main.querySelector('#pedcatalog');
    d.catalogSections.forEach(sec => {
      wrap.appendChild(el(`<div class="ped-catsec"><span class="label">${esc(sec.title)}</span></div>`));
      sec.items.forEach(item => {
        wrap.appendChild(el(`<article class="ped-agentcard ped-agentcard--compact">
          <div class="ped-agenthead"><span class="ped-agentname">${esc(item.name)}</span><span class="ped-agentrole">${esc(item.class)}</span></div>
          <div class="ped-agentrows">
            <div class="refrow"><span class="label">Mechanism</span><p>${esc(item.moa)}</p></div>
            <div class="refrow"><span class="label">Risks</span><p>${esc(item.risk)}</p></div>
          </div>
        </article>`));
      });
    });
  }

  root.appendChild(main);
  setView(root);
}

function renderPEDClinical(fromRef, moduleId) {
  const d = PED.data;
  const mod = moduleId ? pedModules().find(m => m.id === moduleId) : null;
  const guided = !!mod && !fromRef;
  const root = el('<div></div>');
  root.appendChild(topbar('reference'));
  const main = el(`<main class="panel ped-page">
    <button class="backbtn topback" id="pedback">&larr; ${mod ? 'Study path' : 'Performance drugs'}</button>
    <div class="hero"><h1>Clinical &amp; detection.</h1><p class="sub">${guided ? 'Module 11 · labs → risks → capstone' : 'Reference — labs & systemic risks'}</p></div>
    ${guided ? '<div id="pedclinbar"></div>' : ''}
    <div id="pedclinical"></div>
    ${guided ? '<div class="ped-cta-row" id="pedclinnav"></div>' : ''}
  </main>`);
  main.querySelector('#pedback').addEventListener('click', renderPEDHub);

  if (guided) {
    const STEPS = ['orient', 'labs', 'risks'];
    let step = Math.min(PED_PROG.clinicalStep, STEPS.length - 1);
    if (PED_PROG.clinicalDone) step = STEPS.length - 1;

    function mountComplete() {
      main.querySelector('#pedclinbar')?.replaceChildren(el(pedProgressBand(100, 'Clinical module', 'Done')));
      main.querySelector('#pedclinnav')?.remove();
      const wrap = main.querySelector('#pedclinical');
      wrap.replaceChildren(el(`<section class="stage">
        <span class="label">Course complete</span>
        <div class="neuro-score">&#10003;</div>
        <p class="sub">All 11 modules finished — use quick reference to review.</p>
        <div class="endbtns"><button class="btn btn-solid" id="pedhub">Study path</button></div>
      </section>`));
      wrap.querySelector('#pedhub')?.addEventListener('click', renderPEDHub);
    }

    function paint() {
      const key = STEPS[step];
      const pct = Math.round(100 * step / STEPS.length);
      main.querySelector('#pedclinbar')?.replaceChildren(el(pedProgressBand(pct, 'Clinical module', `${step + 1}/${STEPS.length}`)));
      const wrap = main.querySelector('#pedclinical');
      const nav = main.querySelector('#pedclinnav');

      if (key === 'orient') {
        wrap.replaceChildren(el(`<section class="stage">
          <span class="label">Orientation</span>
          <p class="sub">Capstone ties hormone + pathway work to what you order and what you see on panels.</p>
          <p class="ped-lead">Next: high/low patterns on key labs, then systemic risk categories.</p>
        </section>`));
        nav.replaceChildren(el(`<button class="btn btn-solid" id="pedclinnext">Review labs →</button>`));
      } else if (key === 'labs') {
        const list = el(`<div class="ped-agentlist"></div>`);
        d.clinical.labs.forEach(l => {
          list.appendChild(el(`<article class="ped-agentcard ped-agentcard--compact">
            <div class="ped-agenthead"><span class="ped-agentname">${esc(l.test)}</span></div>
            <div class="ped-agentrows">
              <div class="refrow"><span class="label">High suggests</span><p>${esc(l.high)}</p></div>
              <div class="refrow"><span class="label">Low suggests</span><p>${esc(l.low)}</p></div>
            </div>
          </article>`));
        });
        wrap.replaceChildren(el(`<section class="stage">
          <span class="label">Key labs</span>
          <p class="ped-lead">Pattern-match panels — not random trivia.</p>
        </section>`));
        wrap.querySelector('.stage').appendChild(list);
        nav.replaceChildren(el(`<button class="btn btn-solid" id="pedclinnext">Systemic risks →</button>`));
      } else {
        wrap.replaceChildren(el(`<section class="stage">
          <span class="label">Systemic risks</span>
          <p class="ped-lead">Organ-system buckets — what breaks when abuse is chronic.</p>
          <ul class="ped-risklist">${d.clinical.risks.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
        </section>`));
        nav.replaceChildren(el(`<button class="btn btn-solid" id="pedclinnext">Complete course</button>`));
      }

      nav.querySelector('#pedclinnext').addEventListener('click', () => {
        if (step < STEPS.length - 1) {
          step++;
          PED_PROG.clinicalStep = step;
          savePedProg();
          paint();
        } else {
          PED_PROG.clinicalDone = true;
          markPedModuleComplete(mod.id);
          savePedProg();
          mountComplete();
        }
      });
    }

    if (PED_PROG.clinicalDone) mountComplete();
    else paint();
  } else {
    const wrap = main.querySelector('#pedclinical');
    wrap.appendChild(el(`<span class="label">Key labs</span>`));
    const list = el(`<div class="ped-agentlist"></div>`);
    d.clinical.labs.forEach(l => {
      list.appendChild(el(`<article class="ped-agentcard ped-agentcard--compact">
        <div class="ped-agenthead"><span class="ped-agentname">${esc(l.test)}</span></div>
        <div class="ped-agentrows">
          <div class="refrow"><span class="label">High suggests</span><p>${esc(l.high)}</p></div>
          <div class="refrow"><span class="label">Low suggests</span><p>${esc(l.low)}</p></div>
        </div>
      </article>`));
    });
    wrap.appendChild(list);
    wrap.appendChild(el(`<span class="label ped-catsec">Systemic risks</span>`));
    wrap.appendChild(el(`<ul class="ped-risklist">${d.clinical.risks.map(r => `<li>${esc(r)}</li>`).join('')}</ul>`));
  }

  root.appendChild(main);
  setView(root);
}