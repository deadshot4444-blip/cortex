/* Cortex — Performance enhancing drugs (educational medicine module) */

const PED = { data: null, loaded: false };
const PED_PROG = (typeof loadJSON === 'function') ? loadJSON('cs-ped', { pathways: {}, total: 0, correct: 0 })
  : { pathways: {}, total: 0, correct: 0 };
const PED_HORMONE_TABS = ['steroid', 'peptide', 'amine'];

function savePedProg() {
  if (typeof safeSet === 'function') safeSet('cs-ped', JSON.stringify(PED_PROG));
  else try { localStorage.setItem('cs-ped', JSON.stringify(PED_PROG)); } catch {}
}

async function loadPED() {
  if (PED.loaded) return;
  try {
    const r = await fetch('data/performance-drugs.json', { cache: 'no-store' });
    PED.data = r.ok ? await r.json() : null;
  } catch { PED.data = null; }
  PED.loaded = true;
}

async function renderPerformanceDrugs(tab = 'hub', opts = {}) {
  if (typeof stopTimer === 'function') stopTimer();
  if (typeof session !== 'undefined') session = null;
  await loadPED();
  if (!PED.data) { renderReference(); return; }

  if (tab === 'hub') return renderPEDHub();
  if (tab === 'hormones') return renderPEDHormones(opts.hormone || 'steroid');
  if (tab === 'pathways') return renderPEDPathways(opts.pathwayId || null);
  if (tab === 'catalog') return renderPEDCatalog();
  if (tab === 'clinical') return renderPEDClinical();
  renderPEDHub();
}

function renderPEDHub() {
  const d = PED.data;
  const acc = PED_PROG.total ? Math.round(100 * PED_PROG.correct / PED_PROG.total) : null;
  const root = el('<div></div>');
  root.appendChild(topbar('reference'));
  const main = el(`<main class="panel ped-page">
    <button class="backbtn topback" id="pedback">&larr; Medicine</button>
    <div class="hero"><h1>${esc(d.title)}.</h1><p class="sub">${esc(d.tagline)}</p></div>
    <p class="ped-disclaimer">${esc(d.disclaimer)}</p>
    ${acc != null ? `<p class="ped-statline">Pathway game: ${PED_PROG.correct}/${PED_PROG.total} correct (${acc}%)</p>` : ''}
    <div class="ped-branchgrid"></div>
  </main>`);
  main.querySelector('#pedback').addEventListener('click', renderReference);
  const grid = main.querySelector('.ped-branchgrid');
  d.branches.forEach(b => {
    const card = el(`<button class="ped-branchcard" type="button">
      <span class="ped-branchtitle">${esc(b.title)}</span>
      <span class="ped-branchdesc">${esc(b.desc)}</span>
    </button>`);
    card.addEventListener('click', () => renderPerformanceDrugs(b.id));
    grid.appendChild(card);
  });
  root.appendChild(main);
  setView(root);
}

function renderPEDHormones(activeTab) {
  const d = PED.data;
  const root = el('<div></div>');
  root.appendChild(topbar('reference'));
  const tabs = PED_HORMONE_TABS.map(k => {
    const t = d.hormoneTabs[k];
    return `<button class="tab ${k === activeTab ? 'active' : ''}" data-horm="${k}">${esc(t.label)}</button>`;
  }).join('');
  const main = el(`<main class="panel ped-page">
    <button class="backbtn topback" id="pedback">&larr; Performance drugs</button>
    <div class="hero"><h1>Hormone map.</h1><p class="sub">Which agents are steroid, peptide, or amine — and where they act.</p></div>
    <div class="tabs ped-hormtabs">${tabs}<button class="ghostbtn refback" id="pedhub" style="margin-left:auto">&larr; PED hub</button></div>
    <div id="pedhormbody"></div>
  </main>`);
  main.querySelector('#pedback').addEventListener('click', renderReference);
  main.querySelector('#pedhub').addEventListener('click', () => renderPerformanceDrugs('hub'));
  main.querySelectorAll('[data-horm]').forEach(b => b.addEventListener('click', () => renderPEDHormones(b.dataset.horm)));
  const body = main.querySelector('#pedhormbody');
  const block = d.hormoneTabs[activeTab];
  body.appendChild(el(`<div class="ped-hormintro">
    <span class="label">${esc(block.label)}</span>
    <p class="sub">${esc(block.summary)}</p>
    <p class="ped-where"><strong>Where:</strong> ${esc(block.where)}</p>
  </div>`));
  const list = el(`<div class="ped-agentlist"></div>`);
  block.agents.forEach(a => {
    list.appendChild(el(`<article class="ped-agentcard">
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
    </article>`));
  });
  body.appendChild(list);
  root.appendChild(main);
  setView(root);
}

function renderPEDPathways(pathwayId) {
  const d = PED.data;
  const root = el('<div></div>');
  root.appendChild(topbar('reference'));
  if (!pathwayId) {
    const main = el(`<main class="panel ped-page">
      <button class="backbtn topback" id="pedback">&larr; Performance drugs</button>
      <div class="hero"><h1>Pathway flowchart.</h1><p class="sub">Pick an axis — fill in the missing step, then answer fork questions.</p></div>
      <div class="ped-pathgrid"></div>
    </main>`);
    main.querySelector('#pedback').addEventListener('click', () => renderPerformanceDrugs('hub'));
    const grid = main.querySelector('.ped-pathgrid');
    d.pathways.forEach(p => {
      const prog = PED_PROG.pathways[p.id];
      const card = el(`<button class="ped-pathcard" type="button">
        <span class="ped-pathname">${esc(p.title)}</span>
        <span class="ped-pathsub">${esc(p.subtitle)}</span>
        <span class="ped-pathmeta">${p.steps.length} steps · ${p.forkQuiz.length} questions${prog ? ` · best ${prog.best || 0}%` : ''}</span>
      </button>`);
      card.addEventListener('click', () => renderPEDPathways(p.id));
      grid.appendChild(card);
    });
    root.appendChild(main);
    setView(root);
    return;
  }

  const pathway = d.pathways.find(p => p.id === pathwayId);
  if (!pathway) { renderPEDPathways(null); return; }
  const main = el(`<main class="panel ped-page">
    <button class="backbtn topback" id="pedback">&larr; Pathways</button>
    <div class="hero"><h1>${esc(pathway.title)}.</h1><p class="sub">${esc(pathway.subtitle)}</p></div>
    <div id="pedgame"></div>
  </main>`);
  main.querySelector('#pedback').addEventListener('click', () => renderPEDPathways(null));
  root.appendChild(main);
  setView(root);
  startPathwayGame(pathway);
}

function startPathwayGame(pathway) {
  const mount = document.getElementById('pedgame');
  if (!mount) return;
  const steps = pathway.steps;
  const blankIdx = steps.length > 2
    ? 1 + Math.floor(Math.random() * (steps.length - 2))
    : Math.min(1, steps.length - 1);
  let qIdx = 0;
  let buildCorrect = 0;
  let quizCorrect = 0;

  function shuffle(a) {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[x[i], x[j]] = [x[j], x[i]]; }
    return x;
  }

  function renderFlow(filledThrough) {
    const flow = el(`<div class="ped-flow"></div>`);
    steps.forEach((s, i) => {
      const known = i !== blankIdx || filledThrough;
      flow.appendChild(el(`<div class="ped-node ${known ? 'filled' : 'blank'}">${known ? esc(s.label) : '?'}</div>`));
      if (i < steps.length - 1) flow.appendChild(el(`<div class="ped-arrow" aria-hidden="true">↓</div>`));
    });
    return flow;
  }

  function renderBuild() {
    const target = steps[blankIdx];
    const wrong = shuffle(steps.filter((_, i) => i !== blankIdx)).slice(0, 3).map(s => s.label);
    const opts = shuffle([target.label, ...wrong]);
    mount.replaceChildren();
    const card = el(`<section class="stage">
      <div class="stage-head"><span class="label">Step ${blankIdx + 1} of ${steps.length}</span><span class="rule"></span></div>
      <p class="q">Which molecule belongs in the <strong>?</strong> box?</p>
      <div class="ped-flowslot"></div>
      <p class="ped-hintline">${esc(target.hint)}</p>
      <div class="opts">${opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="key">${LETTERS[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>
      <div class="after"></div>
    </section>`);
    card.querySelector('.ped-flowslot').appendChild(renderFlow(false));
    const after = card.querySelector('.after');
    card.querySelectorAll('.opt').forEach(btn => btn.addEventListener('click', () => {
      const pick = opts[Number(btn.dataset.i)];
      const ok = pick === target.label;
      buildCorrect = ok ? 1 : 0;
      card.querySelectorAll('.opt').forEach(b2 => {
        b2.disabled = true;
        const o = opts[Number(b2.dataset.i)];
        if (o === target.label) b2.classList.add('correct');
        else if (b2 === btn) b2.classList.add('wrong');
        else b2.classList.add('dimmed');
      });
      after.appendChild(el(`<div class="explain ${ok ? 'good' : 'bad'}"><span class="verdict">${ok ? 'CORRECT' : 'INCORRECT'} · ${esc(target.label)}</span><p>${esc(target.hint)}</p></div>`));
      after.appendChild(renderFlow(true));
      const row = el(`<div class="continue-row"><button class="btn btn-solid" data-cont>${pathway.forkQuiz.length ? 'Fork questions' : 'Done'}</button></div>`);
      row.querySelector('[data-cont]').addEventListener('click', () => {
        if (pathway.forkQuiz.length) { qIdx = 0; quizCorrect = 0; renderQuiz(); }
        else finishGame(1, buildCorrect);
      });
      after.appendChild(row);
    }));
    mount.appendChild(card);
  }

  function renderQuiz() {
    if (qIdx >= pathway.forkQuiz.length) {
      finishGame(1 + pathway.forkQuiz.length, buildCorrect + quizCorrect);
      return;
    }
    const q = pathway.forkQuiz[qIdx];
    const opts = shuffle(q.options);
    mount.replaceChildren();
    const card = el(`<section class="stage">
      <div class="stage-head"><span class="label">Fork ${qIdx + 1} / ${pathway.forkQuiz.length}</span><span class="rule"></span></div>
      <div class="ped-flowslot"></div>
      <p class="q">${esc(q.prompt)}</p>
      <div class="opts">${opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="key">${LETTERS[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>
      <div class="after"></div>
    </section>`);
    card.querySelector('.ped-flowslot').appendChild(renderFlow(true));
    const after = card.querySelector('.after');
    card.querySelectorAll('.opt').forEach(btn => btn.addEventListener('click', () => {
      const pick = opts[Number(btn.dataset.i)];
      const ok = pick === q.answer;
      if (ok) quizCorrect++;
      card.querySelectorAll('.opt').forEach(b2 => {
        b2.disabled = true;
        const o = opts[Number(b2.dataset.i)];
        if (o === q.answer) b2.classList.add('correct');
        else if (b2 === btn) b2.classList.add('wrong');
        else b2.classList.add('dimmed');
      });
      after.appendChild(el(`<div class="explain ${ok ? 'good' : 'bad'}"><span class="verdict">${ok ? 'CORRECT' : 'INCORRECT'}</span><p>${esc(q.after)}</p></div>`));
      const row = el(`<div class="continue-row"><button class="btn btn-solid" data-cont>${qIdx < pathway.forkQuiz.length - 1 ? 'Next' : 'Finish'}</button></div>`);
      row.querySelector('[data-cont]').addEventListener('click', () => { qIdx++; renderQuiz(); });
      after.appendChild(row);
    }));
    mount.appendChild(card);
  }

  function finishGame(totalQ, buildScore) {
    const got = (buildScore || 0) + correct;
    const tot = totalQ;
    const pct = Math.round(100 * got / tot);
    PED_PROG.total += tot;
    PED_PROG.correct += got;
    if (!PED_PROG.pathways[pathway.id]) PED_PROG.pathways[pathway.id] = { best: 0, runs: 0 };
    PED_PROG.pathways[pathway.id].runs++;
    PED_PROG.pathways[pathway.id].best = Math.max(PED_PROG.pathways[pathway.id].best, pct);
    savePedProg();
    mount.replaceChildren(el(`<section class="stage">
      <span class="label">Pathway complete</span>
      <div class="neuro-score">${pct}%</div>
      <p class="sub">${got}/${tot} correct on ${esc(pathway.title)}</p>
      <div class="endbtns">
        <button class="btn btn-solid" id="pedretry">Play again</button>
        <button class="btn" id="pedpaths">All pathways</button>
      </div>
    </section>`));
    mount.querySelector('#pedretry').addEventListener('click', () => startPathwayGame(pathway));
    mount.querySelector('#pedpaths').addEventListener('click', () => renderPEDPathways(null));
  }

  renderBuild();
}

function renderPEDCatalog() {
  const d = PED.data;
  const root = el('<div></div>');
  root.appendChild(topbar('reference'));
  const main = el(`<main class="panel ped-page">
    <button class="backbtn topback" id="pedback">&larr; Performance drugs</button>
    <div class="hero"><h1>Agent catalog.</h1><p class="sub">Grouped by how they're abused — mechanisms and risks at a glance.</p></div>
    <div id="pedcatalog"></div>
  </main>`);
  main.querySelector('#pedback').addEventListener('click', () => renderPerformanceDrugs('hub'));
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
  root.appendChild(main);
  setView(root);
}

function renderPEDClinical() {
  const d = PED.data;
  const root = el('<div></div>');
  root.appendChild(topbar('reference'));
  const main = el(`<main class="panel ped-page">
    <button class="backbtn topback" id="pedback">&larr; Performance drugs</button>
    <div class="hero"><h1>Clinical &amp; detection.</h1><p class="sub">What shows up on labs and what harms to counsel.</p></div>
    <span class="label">Key labs</span>
    <div class="ped-agentlist"></div>
    <span class="label" style="display:block;margin-top:28px">Systemic risks</span>
    <ul class="ped-risklist">${d.clinical.risks.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
  </main>`);
  main.querySelector('#pedback').addEventListener('click', () => renderPerformanceDrugs('hub'));
  const list = main.querySelector('.ped-agentlist');
  d.clinical.labs.forEach(l => {
    list.appendChild(el(`<article class="ped-agentcard ped-agentcard--compact">
      <div class="ped-agenthead"><span class="ped-agentname">${esc(l.test)}</span></div>
      <div class="ped-agentrows">
        <div class="refrow"><span class="label">High suggests</span><p>${esc(l.high)}</p></div>
        <div class="refrow"><span class="label">Low suggests</span><p>${esc(l.low)}</p></div>
      </div>
    </article>`));
  });
  root.appendChild(main);
  setView(root);
}