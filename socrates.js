/* Cortex — Socrates: guided Socratic dialogues.
   Each topic is a chain of steps: a probing question → optional hint → your attempt → model answer + why.
   The last step is always a teach-back ("explain it in your own words"). */

const SOC = { dialogues: [], loaded: false, byDisc: {} };
const SOC_DONE = (typeof loadJSON === 'function') ? loadJSON('cs-socrates', {}) : {};
function saveSocDone() { localStorage.setItem('cs-socrates', JSON.stringify(SOC_DONE)); }

async function loadSocrates() {
  if (SOC.loaded) return;
  try {
    const d = await fetch('data/socrates.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []);
    SOC.dialogues = d || [];
  } catch { SOC.dialogues = SOC.dialogues || []; }
  SOC.byDisc = {};
  for (const dlg of SOC.dialogues) (SOC.byDisc[dlg.discipline] = SOC.byDisc[dlg.discipline] || []).push(dlg);
  SOC.loaded = true;
}
function discName(key) { return (SOC.byDisc[key] && SOC.byDisc[key][0]?.disciplineName) || key; }

/* ---------- hub ---------- */
async function renderSocrates() {
  if (typeof stopTimer === 'function') stopTimer();
  if (typeof session !== 'undefined') session = null;
  await loadSocrates();

  const root = el('<div></div>');
  root.appendChild(topbar('socrates'));
  const total = SOC.dialogues.length;
  const done = SOC.dialogues.filter(d => SOC_DONE[d.id]).length;
  const main = el(`<main class="panel">
    <div class="hero"><h1>Socrates.</h1><p class="sub">Don&rsquo;t memorize &mdash; reason. Every topic is a chain of questions that builds understanding before it hands you the answer.</p></div>
    ${total ? `<div class="socbar"><span class="label">Progress</span><span class="bar"><i style="width:${total ? Math.round(100 * done / total) : 0}%"></i></span><span class="topstat">${done}/${total} dialogues</span></div>` : ''}
    <div class="mcat-mods"></div>
    <p class="anat-credit">Original Socratic dialogues, AI-generated and fact-checked. Attempt each question before revealing the answer &mdash; the struggle is the point.</p>
  </main>`);

  const mc = main.querySelector('.mcat-mods');
  const discs = Object.keys(SOC.byDisc);
  if (!discs.length) mc.appendChild(el(`<div class="empty">Dialogues are generating&hellip; check back in a moment.</div>`));
  discs.forEach(k => {
    const list = SOC.byDisc[k];
    const dn = list.filter(d => SOC_DONE[d.id]).length;
    const card = el(`<button class="modcard">
      <span class="mod-name">${esc(discName(k))}</span>
      <span class="mod-desc">${list.length} topics &middot; question-led mastery</span>
      <span class="mod-stat">${dn ? `${dn}/${list.length} done` : `${list.length} to explore`}</span>
    </button>`);
    card.addEventListener('click', () => renderSocDiscipline(k));
    mc.appendChild(card);
  });

  root.appendChild(main);
  setView(root);
}

/* ---------- topic list for a discipline ---------- */
function renderSocDiscipline(key) {
  const list = SOC.byDisc[key] || [];
  const root = el('<div></div>');
  root.appendChild(topbar('socrates'));
  const main = el(`<main class="panel">
    <div class="hero"><h1>${esc(discName(key))}.</h1><p class="sub">${list.length} topics. Pick one and reason it out step by step.</p></div>
    <div class="tabs"><button class="ghostbtn" id="socback" style="margin-left:auto">&larr; Socrates</button></div>
    <div class="rows" id="socrows"></div>
  </main>`);
  main.querySelector('#socback').addEventListener('click', renderSocrates);
  const rows = main.querySelector('#socrows');
  list.forEach(dlg => {
    const done = !!SOC_DONE[dlg.id];
    const row = el(`<button class="row">
      <span class="row-main">
        <span class="row-spec">${dlg.steps.length} steps</span>
        <span class="row-title">${esc(dlg.topic)}</span>
      </span>
      <span class="row-right">${done ? '<span class="pill ok">done</span>' : '<span class="row-when">start &rarr;</span>'}</span>
    </button>`);
    row.addEventListener('click', () => renderSocPlayer(key, dlg.id));
    rows.appendChild(row);
  });
  root.appendChild(main);
  setView(root);
}

/* ---------- step-through player ---------- */
let soc = null;
function renderSocPlayer(key, id) {
  const dlg = (SOC.byDisc[key] || []).find(d => d.id === id);
  if (!dlg) { renderSocDiscipline(key); return; }
  soc = { key, dlg, idx: 0 };
  const root = el('<div></div>');
  root.appendChild(el(`<header class="topbar">
    <div class="side"><button class="backbtn" id="socexit">&larr; ${esc(discName(key)).toUpperCase()}</button></div>
    <div class="center"><span class="topstat">${esc(discName(key)).toUpperCase()}</span></div>
    <div class="side right"><span class="topstat" id="socprog"></span></div>
  </header>`));
  root.querySelector('#socexit').addEventListener('click', () => renderSocDiscipline(key));
  const main = el(`<main class="case socplay">
    <div class="case-meta"><span>Socratic dialogue</span><span class="sep">/</span><span>${esc(discName(key))}</span></div>
    <h2>${esc(dlg.topic)}</h2>
    <div class="socdots" id="socdots"></div>
    <div id="socsteps"></div>
  </main>`);
  root.appendChild(main);
  setView(root);
  renderSocDots();
  appendSocStep();
}

function renderSocDots() {
  const dots = document.getElementById('socdots');
  if (!dots) return;
  dots.replaceChildren();
  soc.dlg.steps.forEach((_, i) => dots.appendChild(el(`<span class="socdot ${i < soc.idx ? 'past' : i === soc.idx ? 'now' : ''}"></span>`)));
  const p = document.getElementById('socprog');
  if (p) p.textContent = `Step ${Math.min(soc.idx + 1, soc.dlg.steps.length)}/${soc.dlg.steps.length}`;
}

function appendSocStep() {
  const { dlg } = soc;
  if (soc.idx >= dlg.steps.length) return finishSoc();
  const s = dlg.steps[soc.idx];
  const isLast = soc.idx === dlg.steps.length - 1;
  const container = document.getElementById('socsteps');

  const node = el(`<section class="stage socstep">
    <div class="stage-head"><span class="label">${isLast ? 'Teach it back' : 'Question ' + (soc.idx + 1)}</span><span class="rule"></span></div>
    <p class="q">${esc(s.question)}</p>
    <textarea class="socinput" rows="3" placeholder="Reason it out first&hellip; (your notes stay on this device)"></textarea>
    <div class="socactions">
      ${s.hint ? '<button class="btn" data-hint>Need a hint</button>' : ''}
      <button class="btn btn-solid" data-reveal>Reveal answer</button>
    </div>
    <div class="socafter"></div>
  </section>`);
  const after = node.querySelector('.socafter');
  const hintBtn = node.querySelector('[data-hint]');
  if (hintBtn) hintBtn.addEventListener('click', () => {
    hintBtn.disabled = true;
    after.appendChild(el(`<div class="sochint"><span class="label">Hint</span><p>${esc(s.hint)}</p></div>`));
  });
  node.querySelector('[data-reveal]').addEventListener('click', () => {
    node.querySelector('.socactions').remove();
    after.appendChild(el(`<div class="socans">
      <div class="socblock"><span class="label">Answer</span><p>${esc(s.answer)}</p></div>
      ${s.why ? `<div class="socblock why"><span class="label">Why it matters</span><p>${esc(s.why)}</p></div>` : ''}
    </div>`));
    const row = el(`<div class="continue-row"><span class="hint">ENTER &rarr;</span><button class="btn btn-solid" data-continue>${isLast ? 'Finish' : 'Next question'}</button></div>`);
    row.querySelector('[data-continue]').addEventListener('click', () => { soc.idx++; renderSocDots(); appendSocStep(); });
    after.appendChild(row);
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  container.appendChild(node);
  if (soc.idx > 0) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function finishSoc() {
  const { dlg, key } = soc;
  SOC_DONE[dlg.id] = { done: true, ts: Date.now() };
  saveSocDone();
  const idx = (SOC.byDisc[key] || []).findIndex(d => d.id === dlg.id);
  const next = (SOC.byDisc[key] || [])[idx + 1];
  const node = el(`<section class="summary">
    <span class="label">Dialogue complete</span>
    <div class="score">&#10003;</div>
    <p class="socdone-ttl">${esc(dlg.topic)}</p>
    <p class="sub" style="text-align:center;margin-top:6px">You reasoned through all ${dlg.steps.length} steps. If you couldn&rsquo;t teach the last one cleanly, run it again &mdash; that gap is exactly what to study.</p>
    <div class="endbtns">
      ${next ? '<button class="btn btn-solid" id="socnext">Next topic</button>' : ''}
      <button class="btn" id="socredo">Run it again</button>
      <button class="btn" id="socdisc">All topics</button>
    </div>
  </section>`);
  if (next) node.querySelector('#socnext').addEventListener('click', () => renderSocPlayer(key, next.id));
  node.querySelector('#socredo').addEventListener('click', () => renderSocPlayer(key, dlg.id));
  node.querySelector('#socdisc').addEventListener('click', () => renderSocDiscipline(key));
  document.getElementById('socsteps').appendChild(node);
  renderSocDots();
  node.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
