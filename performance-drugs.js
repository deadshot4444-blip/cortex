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
    hormones: {
      steroid: { learned: [], aspects: {} },
      peptide: { learned: [], aspects: {} },
      amine: { learned: [], aspects: {} },
    },
    pathways: {},
    modules: {},
    misses: [],
    catalogDone: false,
    catalogSection: 0,
    clinicalDone: false,
    clinicalStep: 0,
  };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  if (raw.hormones) base.hormones = raw.hormones;
  else if (raw.learned) base.hormones = raw.learned;
  // Normalize each hormone tab and grandfather pre-recall progress: an agent marked learned
  // under the old click-through flow counts as having mastered every aspect, so nobody loses work.
  PED_HORMONE_TABS.forEach(t => {
    const rec = base.hormones[t] && typeof base.hormones[t] === 'object' ? base.hormones[t] : {};
    if (!Array.isArray(rec.learned)) rec.learned = [];
    if (!rec.aspects || typeof rec.aspects !== 'object' || Array.isArray(rec.aspects)) rec.aspects = {};
    rec.learned.forEach(key => {
      if (!Array.isArray(rec.aspects[key]) || !rec.aspects[key].length) {
        rec.aspects[key] = PED_HORM_LEARN.map(s => s.key);
      }
    });
    // The module quiz gates completion now. Anyone who already had agents learned finished
    // under the old rules, so credit the quiz rather than reopening a module they completed.
    if (typeof rec.quizBest !== 'number') rec.quizBest = rec.learned.length ? 100 : 0;
    base.hormones[t] = rec;
  });
  if (Array.isArray(raw.misses)) {
    base.misses = raw.misses.filter(m => m && m.tab && m.agent && m.aspect)
      .map(m => ({ tab: m.tab, agent: m.agent, aspect: m.aspect }));
  }
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

/* ---------- recall: per-aspect mastery, misses pool, distractors ---------- */
const PED_REQUEUE_GAP = 3;   // a missed item returns this many items later, with a hint

function pedTabRec(tab) {
  if (!PED_PROG.hormones[tab]) PED_PROG.hormones[tab] = { learned: [], aspects: {} };
  const rec = PED_PROG.hormones[tab];
  if (!Array.isArray(rec.learned)) rec.learned = [];
  if (!rec.aspects || typeof rec.aspects !== 'object' || Array.isArray(rec.aspects)) rec.aspects = {};
  return rec;
}
function pedAspectsDone(tab, key) {
  const v = pedTabRec(tab).aspects[key];
  return Array.isArray(v) ? v : [];
}
// An agent counts as learned only once every aspect has been recalled correctly.
function pedMarkAspect(tab, key, aspect) {
  const rec = pedTabRec(tab);
  const done = pedAspectsDone(tab, key);
  if (!done.includes(aspect)) done.push(aspect);
  rec.aspects[key] = done;
  const full = done.length >= PED_HORM_LEARN.length;
  if (full && !rec.learned.includes(key)) rec.learned.push(key);
  savePedProg();
  return full;
}
function pedMisses() {
  if (!Array.isArray(PED_PROG.misses)) PED_PROG.misses = [];
  return PED_PROG.misses;
}
function pedRecordMiss(tab, key, aspect) {
  const list = pedMisses();
  if (!list.some(m => m.tab === tab && m.agent === key && m.aspect === aspect)) {
    list.push({ tab, agent: key, aspect });
    savePedProg();
  }
}
function pedClearMiss(tab, key, aspect) {
  const list = pedMisses();
  const next = list.filter(m => !(m.tab === tab && m.agent === key && m.aspect === aspect));
  if (next.length !== list.length) { PED_PROG.misses = next; savePedProg(); }
}
function pedShuffle(a) {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}
// Distractors are the same field taken from OTHER agents — same hormone class first, so the
// choice is a real discrimination between plausible agents rather than a giveaway. Deduped by
// text, which also covers agents that legitimately share a value (e.g. pathway "Exogenous").
function pedDistractors(tab, field, answer, n = 3) {
  const same = [], other = [];
  PED_HORMONE_TABS.forEach(t => {
    (PED.data?.hormoneTabs?.[t]?.agents || []).forEach(a => {
      const v = a[field];
      if (!v || v === answer) return;
      (t === tab ? same : other).push(v);
    });
  });
  const seen = new Set([answer]);
  const out = [];
  pedShuffle(same).concat(pedShuffle(other)).forEach(v => {
    if (out.length >= n || seen.has(v)) return;
    seen.add(v); out.push(v);
  });
  return out;
}
function pedAwardXP(correct) {
  if (typeof medAwardXP === 'function') { medAwardXP(correct); return; }
  if (typeof prog !== 'function') return;
  const p = prog('medicine');
  p.answered = (p.answered || 0) + 1;
  if (correct) { p.correct = (p.correct || 0) + 1; p.xp = (p.xp || 0) + (typeof XP_PER_CORRECT === 'number' ? XP_PER_CORRECT : 10); }
  if (typeof saveProgress === 'function') saveProgress();
}

async function loadPED() {
  if (PED.loaded) return;
  try {
    // Versioned like every other data file — without it an edited JSON never reaches a
    // returning browser. Bump this whenever data/performance-drugs.json changes.
    const r = await fetch('data/performance-drugs.json?v=15');
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
    const rec = PED_PROG.hormones[mod.hormone] || {};
    const done = (rec.learned || []).length;
    // Progress still reads as agents mastered, but the module quiz is the actual gate —
    // mastering every agent without passing the quiz leaves the module open.
    const quizOk = (rec.quizBest || 0) >= PED_QUIZ_PASS;
    return {
      done, total,
      pct: total ? Math.round(100 * done / total) : 0,
      complete: total > 0 && done >= total && quizOk,
      quizBest: rec.quizBest || 0,
    };
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

function pedModuleCompleteById(moduleId) {
  const mod = pedModules().find(m => m.id === moduleId);
  return mod ? pedModuleStatus(mod).complete : false;
}

window.pedModuleCompleteById = pedModuleCompleteById;

async function renderPerformanceDrugs(tab = 'hub', opts = {}) {
  if (typeof stopTimer === 'function') stopTimer();
  if (typeof session !== 'undefined') session = null;
  await loadPED();
  if (!PED.data) { renderReference(); return; }

  if (tab === 'hub') {
    if (typeof touchMedicine === 'function') touchMedicine('ped', 'hub');
    return renderPEDHub();
  }
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
  const missCount = pedMisses().length;
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
      ${missCount ? `<button class="btn" id="pedreview">Smart review &middot; ${missCount}</button>` : ''}
      <button class="btn" id="pedbrowse">Browse reference</button>
    </div>` : `<div class="ped-cta-row">
      ${missCount ? `<button class="btn btn-solid" id="pedreview">Smart review &middot; ${missCount}</button>` : ''}
      <button class="btn" id="pedbrowse">Browse reference</button>
    </div>
    <p class="ped-complete-msg">Path complete. Use reference tabs to review.</p>`}
    <span class="label ped-modulelabel">Study path</span>
    <div id="pedmodules"></div>
    <details class="ped-ref-fold">
      <summary class="ped-ref-sum"><span class="label">Quick reference</span><span class="ped-refnote">browse only — does not complete course modules</span></summary>
      <div class="ped-reflinks">
        <button class="btn" type="button" data-ref="hormones">Hormone map</button>
        <button class="btn" type="button" data-ref="catalog">Agent catalog</button>
        <button class="btn" type="button" data-ref="clinical">Clinical</button>
      </div>
    </details>
  </main>`);
  main.querySelector('#pedback').addEventListener('click', renderReference);
  if (next) main.querySelector('#pedcontinue').addEventListener('click', () => renderPEDModule(next.id));
  main.querySelector('#pedbrowse')?.addEventListener('click', () => renderPEDHormones('steroid', 'browse'));
  main.querySelector('#pedreview')?.addEventListener('click', startPedSmartReview);
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
function renderPEDHormoneStudy(mod, opts = {}) {
  const block = PED.data.hormoneTabs[mod.hormone];
  const agents = block.agents;
  const learned = pedTabRec(mod.hormone).learned;

  const root = el('<div></div>');
  root.appendChild(topbar('reference'));
  const main = el(`<main class="panel ped-page">
    <button class="backbtn topback" id="pedback">&larr; Study path</button>
    <div class="hero"><h1>${esc(mod.title)}.</h1><p class="sub">Module ${mod.order} · ${learned.length}/${agents.length} agents mastered</p></div>
    <div class="ped-pathband ped-pathband--slim">
      <span class="bar"><i style="width:${agents.length ? Math.round(100 * learned.length / agents.length) : 0}%"></i></span>
    </div>
    <div id="pedlearn"></div>
  </main>`);
  main.querySelector('#pedback').addEventListener('click', renderPEDHub);
  root.appendChild(main);
  setView(root);
  runHormoneModule(mod, agents, opts);
}

// One graded recall question. Shared by the guided modules and Smart review so the two can't
// drift apart; the caller owns queueing, scoring chrome, and what "next" means.
function pedRecallCard(cfg) {
  const { tab, agent, aspect, again, label, stat, nextLabel } = cfg;
  const LTRS = (typeof LETTERS !== 'undefined' && LETTERS) ? LETTERS : ['A', 'B', 'C', 'D'];
  const s = PED_HORM_LEARN.find(x => x.key === aspect);
  const key = agentKey(agent);
  const answer = agent[s.field];
  const opts = pedShuffle([answer].concat(pedDistractors(tab, s.field, answer)));
  const stepNo = PED_HORM_LEARN.findIndex(x => x.key === aspect);

  const node = el(`<section class="stage">
    <div class="stage-head">
      <span class="label">${esc(label)}</span>
      <span class="rule"></span>
      <span class="topstat">${esc(stat)}</span>
    </div>
    ${pedStepDots(PED_HORM_LEARN.length, stepNo, s.label)}
    <h2 class="ped-drugname">${esc(agent.name)}</h2>
    <p class="ped-drugclass">${esc(agent.role)}</p>
    <p class="q">${esc(s.ask)}</p>
    ${again ? `<p class="hint">Hint &middot; ${esc(agent.role)}</p>` : ''}
    <div class="opts">${opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="key">${LTRS[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>
    <div class="after"></div>
  </section>`);

  const after = node.querySelector('.after');
  node.querySelectorAll('.opt').forEach(btn => btn.addEventListener('click', () => {
    const correct = opts[Number(btn.dataset.i)] === answer;
    node.querySelectorAll('.opt').forEach(b => {
      b.disabled = true;
      if (opts[Number(b.dataset.i)] === answer) b.classList.add('correct');
      else if (b === btn) b.classList.add('wrong');
      else b.classList.add('dimmed');
    });

    let justMastered = false;
    if (correct) {
      justMastered = pedMarkAspect(tab, key, aspect);
      pedClearMiss(tab, key, aspect);
    } else {
      pedRecordMiss(tab, key, aspect);
    }
    cfg.onAnswer?.(correct, justMastered);

    after.appendChild(el(`<div class="explain ${correct ? 'good' : 'bad'}">
      <span class="verdict">${correct ? 'CORRECT' : 'INCORRECT'}</span>
      <p><strong>${esc(s.label)}:</strong> ${esc(answer)}</p>
      ${correct ? '' : '<p class="hint">Queued to come back around.</p>'}
      ${justMastered ? `<p class="hint">${esc(agent.name)} mastered &mdash; all four recalled.</p>` : ''}
    </div>`));

    const row = el(`<div class="continue-row"><span class="hint">ENTER &rarr;</span><button class="btn btn-solid" data-next>${esc(nextLabel || 'Continue')}</button></div>`);
    row.querySelector('[data-next]').addEventListener('click', () => cfg.onNext?.());
    after.appendChild(row);
    row.querySelector('[data-next]').focus();
  }));

  return node;
}

// Build the module's recall queue in agent order, skipping aspects already mastered so a
// returning learner is only asked what they still owe.
function pedBuildQueue(tab, agents) {
  const q = [];
  agents.forEach(agent => {
    const done = pedAspectsDone(tab, agentKey(agent));
    PED_HORM_LEARN.forEach(s => { if (!done.includes(s.key)) q.push({ agent, aspect: s.key }); });
  });
  return q;
}

function pedLessonsFor(tab) { return PED.data?.hormoneLessons?.[tab] || []; }
function pedLessonsRead(tab) {
  const rec = pedTabRec(tab);
  if (!Array.isArray(rec.lessons)) rec.lessons = [];
  return rec.lessons;
}
function pedMarkLessonRead(tab, id) {
  const list = pedLessonsRead(tab);
  if (!list.includes(id)) { list.push(id); savePedProg(); }
}
const PED_QUIZ_LEN = 8;
const PED_QUIZ_PASS = 70;

// The module is a teach → test rhythm: a short lesson on a small group of related agents,
// then recall on just that group, repeated, then one mixed quiz over the whole module.
// Sections already finished are skipped so returning here resumes rather than restarts.
function pedModulePlan(tab, agents) {
  const plan = [];
  const lessons = pedLessonsFor(tab);
  const read = pedLessonsRead(tab);
  const owes = a => pedAspectsDone(tab, agentKey(a)).length < PED_HORM_LEARN.length;

  lessons.forEach((L, i) => {
    const grp = L.agents.map(n => agents.find(a => a.name === n)).filter(Boolean);
    if (!grp.length) return;
    if (!read.includes(L.id)) plan.push({ type: 'teach', lesson: L, agents: grp, n: i + 1, of: lessons.length });
    if (grp.some(owes)) plan.push({ type: 'recall', agents: grp, label: L.title });
  });

  // Agents no lesson covers (peptide/amine today) still get recalled.
  const covered = new Set(lessons.flatMap(L => L.agents));
  const rest = agents.filter(a => !covered.has(a.name) && owes(a));
  if (rest.length) plan.push({ type: 'recall', agents: rest, label: lessons.length ? 'Remaining agents' : 'Recall' });

  plan.push({ type: 'quiz', agents });
  return plan;
}

function runHormoneModule(mod, agents, opts = {}) {
  const mount = document.getElementById('pedlearn');
  if (!mount) return;
  const tab = mod.hormone;
  const block = PED.data.hormoneTabs[tab];
  const plan = pedModulePlan(tab, agents);
  let stage = 0;

  function chrome() {
    const fresh = pedTabRec(tab).learned;
    const bar = document.querySelector('.ped-page .ped-pathband--slim .bar i');
    if (bar) bar.style.width = `${agents.length ? Math.round(100 * fresh.length / agents.length) : 0}%`;
    const sub = document.querySelector('.ped-page .hero .sub');
    if (sub) sub.textContent = `Module ${mod.order} · ${fresh.length}/${agents.length} agents mastered`;
  }

  function advance() { stage++; runStage(); }

  /* --- mini lesson --- */
  function renderTeach(sec) {
    const L = sec.lesson;
    let i = 0;
    function paint() {
      const step = L.teach[i];
      const last = i === L.teach.length - 1;
      const node = el(`<section class="stage ped-lesson">
        <div class="stage-head">
          <span class="label">Lesson ${sec.n} of ${sec.of} &middot; ${esc(L.title)}</span>
          <span class="rule"></span>
          <span class="topstat">${i + 1}/${L.teach.length}</span>
        </div>
        ${pedStepDots(L.teach.length, i, step.h)}
        ${i === 0 && L.blurb ? `<p class="ped-lead">${esc(L.blurb)}</p>` : ''}
        <h2 class="ped-lesson-h">${step.h}</h2>
        <div class="ped-lesson-body"><p>${step.p}</p></div>
        <div class="continue-row">
          <span class="hint">${esc(L.agents.join(' · '))}</span>
          <button class="btn btn-solid" data-next>${last ? 'Check yourself' : 'Continue'}</button>
        </div>
      </section>`);
      node.querySelector('[data-next]').addEventListener('click', () => {
        if (last) { pedMarkLessonRead(tab, L.id); advance(); }
        else { i++; paint(); }
      });
      mount.replaceChildren(node);
      node.querySelector('[data-next]').focus();
    }
    paint();
  }

  /* --- recall on the group just taught --- */
  function renderRecall(sec) {
    const queue = pedBuildQueue(tab, sec.agents);
    if (!queue.length) { advance(); return; }
    let pos = 0;
    const run = { asked: 0, right: 0 };
    function paint() {
      if (pos >= queue.length) {
        const acc = run.asked ? Math.round(100 * run.right / run.asked) : 100;
        const node = el(`<section class="stage">
          <span class="label">${esc(sec.label)} &middot; checked</span>
          <div class="neuro-score">${acc}%</div>
          <p class="sub">${run.right}/${run.asked} first try.</p>
          <div class="endbtns"><button class="btn btn-solid" data-advance>Continue</button></div>
        </section>`);
        // NOT data-go — that attribute is the global section router (app.js), which would
        // hijack the click and navigate away instead of advancing the module.
        node.querySelector('[data-advance]').addEventListener('click', advance);
        mount.replaceChildren(node);
        node.querySelector('[data-advance]').focus();
        return;
      }
      const item = queue[pos];
      mount.replaceChildren(pedRecallCard({
        tab,
        agent: item.agent,
        aspect: item.aspect,
        again: item.again,
        label: `${sec.label} · ${item.again ? 'second look' : `${pos + 1}/${queue.length}`}`,
        stat: `${pedTabRec(tab).learned.length}/${agents.length} mastered`,
        nextLabel: pos >= queue.length - 1 ? 'Done' : 'Continue',
        onAnswer: correct => {
          run.asked++;
          if (correct) run.right++;
          // XP only on a first-pass answer, so requeued retries can't farm the pool.
          if (!item.again) pedAwardXP(correct);
          if (!correct) queue.splice(Math.min(pos + PED_REQUEUE_GAP, queue.length), 0, { agent: item.agent, aspect: item.aspect, again: true });
          chrome();
        },
        onNext: () => { pos++; paint(); },
      }));
    }
    paint();
  }

  /* --- module quiz: mixed, graded, gates completion --- */
  function renderQuiz(sec) {
    const pool = [];
    sec.agents.forEach(agent => PED_HORM_LEARN.forEach(s => pool.push({ agent, aspect: s.key })));
    const items = pedShuffle(pool).slice(0, Math.min(PED_QUIZ_LEN, pool.length));
    let pos = 0, right = 0;

    function result() {
      const pct = items.length ? Math.round(100 * right / items.length) : 0;
      const passed = pct >= PED_QUIZ_PASS;
      const rec = pedTabRec(tab);
      rec.quizBest = Math.max(rec.quizBest || 0, pct);
      savePedProg();
      if (passed) markPedModuleComplete(mod.id);
      const nxt = pedModules().find(m => m.order === mod.order + 1);
      const node = el(`<section class="stage">
        <span class="label">${passed ? `Module ${mod.order} complete` : 'Quiz — not yet'}</span>
        <div class="neuro-score">${pct}%</div>
        <p class="sub">${right}/${items.length} correct${passed ? ` &middot; ${esc(block.label)} signed off.` : ` &middot; ${PED_QUIZ_PASS}% needed to complete the module.`}</p>
        <div class="endbtns">
          ${passed
            ? '<button class="btn btn-solid" data-next>Next module</button>'
            : '<button class="btn btn-solid" data-retry>Retake quiz</button>'}
          <button class="btn" data-hub>Study path</button>
        </div>
      </section>`);
      node.querySelector('[data-next]')?.addEventListener('click', () => nxt ? renderPEDModule(nxt.id) : renderPEDHub());
      node.querySelector('[data-retry]')?.addEventListener('click', () => { pos = 0; right = 0; renderQuiz(sec); });
      node.querySelector('[data-hub]').addEventListener('click', renderPEDHub);
      mount.replaceChildren(node);
    }

    function paint() {
      if (pos >= items.length) { result(); return; }
      const item = items[pos];
      mount.replaceChildren(pedRecallCard({
        tab,
        agent: item.agent,
        aspect: item.aspect,
        label: `Module quiz · ${pos + 1}/${items.length}`,
        stat: `${right}/${pos} correct`,
        nextLabel: pos >= items.length - 1 ? 'See score' : 'Continue',
        onAnswer: correct => { if (correct) right++; pedAwardXP(correct); chrome(); },
        onNext: () => { pos++; paint(); },
      }));
    }
    paint();
  }

  function runStage() {
    if (stage >= plan.length) { renderPEDHub(); return; }
    const sec = plan[stage];
    if (sec.type === 'teach') return renderTeach(sec);
    if (sec.type === 'recall') return renderRecall(sec);
    return renderQuiz(sec);
  }

  runStage();
}

/* ---------- smart review: everything missed, across all three hormone classes ---------- */
function pedAgentByKey(tab, key) {
  return (PED.data?.hormoneTabs?.[tab]?.agents || []).find(a => agentKey(a) === key) || null;
}

function startPedSmartReview() {
  const queue = pedShuffle(
    pedMisses()
      .map(m => ({ tab: m.tab, agent: pedAgentByKey(m.tab, m.agent), aspect: m.aspect }))
      .filter(x => x.agent && PED_HORM_LEARN.some(s => s.key === x.aspect))
  );

  const root = el('<div></div>');
  root.appendChild(topbar('reference'));
  const main = el(`<main class="panel ped-page">
    <button class="backbtn topback" id="pedback">&larr; Study path</button>
    <div class="hero"><h1>Smart review.</h1><p class="sub">Every detail you have missed &mdash; drilled until it sticks.</p></div>
    <div class="ped-pathband ped-pathband--slim"><span class="bar"><i style="width:0%"></i></span></div>
    <div id="pedlearn"></div>
  </main>`);
  main.querySelector('#pedback').addEventListener('click', renderPEDHub);
  root.appendChild(main);
  setView(root);

  const mount = main.querySelector('#pedlearn');
  const bar = main.querySelector('.ped-pathband--slim .bar i');
  let pos = 0;
  const run = { asked: 0, right: 0 };

  function finish() {
    const left = pedMisses().length;
    const acc = run.asked ? Math.round(100 * run.right / run.asked) : 100;
    mount.replaceChildren(el(`<section class="stage">
      <span class="label">${left ? 'Review round done' : 'Review cleared'}</span>
      <div class="neuro-score">${left ? `${acc}%` : '&#10003;'}</div>
      <p class="sub">${run.right}/${run.asked} correct &middot; ${left ? `${left} still in the review pool` : 'nothing left to review'}.</p>
      <div class="endbtns">
        ${left ? '<button class="btn btn-solid" id="pedagain">Review again</button>' : ''}
        <button class="btn" id="pedhub">Study path</button>
      </div>
    </section>`));
    mount.querySelector('#pedagain')?.addEventListener('click', startPedSmartReview);
    mount.querySelector('#pedhub').addEventListener('click', renderPEDHub);
  }

  function render() {
    if (!queue.length) { finish(); return; }
    if (pos >= queue.length) { finish(); return; }
    const item = queue[pos];
    if (bar) bar.style.width = `${Math.round(100 * pos / queue.length)}%`;
    mount.replaceChildren(pedRecallCard({
      tab: item.tab,
      agent: item.agent,
      aspect: item.aspect,
      again: true,
      label: `Review · ${pos + 1}/${queue.length}`,
      stat: `${pedMisses().length} in pool`,
      nextLabel: pos >= queue.length - 1 ? 'Finish review' : 'Continue',
      onAnswer: correct => {
        run.asked++;
        if (correct) run.right++;
        // Still missed: send it back through this round as well as leaving it in the pool.
        else queue.splice(Math.min(pos + PED_REQUEUE_GAP, queue.length), 0, item);
      },
      onNext: () => { pos++; render(); },
    }));
  }

  render();
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
        <p class="ped-lead">Three beats: orient &rarr; build the flowchart step-by-step &rarr; checkpoint MCQs in order (${quizzes.length} question${quizzes.length === 1 ? '' : 's'}; ${Math.ceil(PED_QUIZ_PASS / 100 * quizzes.length)} correct to pass).</p>
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
    const passed = pct >= PED_QUIZ_PASS;
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
      <p class="sub">${checkpointCorrect}/${quizzes.length} checkpoint questions correct${passed ? '' : ` &middot; need ${Math.ceil(PED_QUIZ_PASS / 100 * quizzes.length)}/${quizzes.length} to complete`}</p>
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

window._resetPedMemory = function () {
  PED_PROG = migratePedProg(null);
};