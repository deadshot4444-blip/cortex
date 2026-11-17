/* Cortex — Neuroengineering course */

const NEURO = { loaded: false, data: null, milestones: null, topicMap: {}, simMap: {}, codeMap: {} };
function neuroReadProgress() {
  const empty = {
    pathStarted: false,
    pathDone: [],
    topicQuiz: {},
    topicAtlas: {},
    sims: {},
    simWork: {},
    code: {},
    milestones: {},
    projects: {},
    units: {},
  };
  const saved = StudyStorage.read('cs-neuro', empty);
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  if (object(saved) && object(saved.units)) Object.values(saved.units).forEach(neuroMigrateUnit);
  if (
    !object(saved) ||
    !Array.isArray(saved.pathDone) ||
    !saved.pathDone.every(id => typeof id === 'string') ||
    ['topicQuiz', 'topicAtlas', 'sims', 'simWork', 'code', 'milestones', 'projects', 'units'].some(
      key => saved[key] != null && !object(saved[key])
    ) ||
    Object.values(saved.units || {}).some(record => !neuroValidUnit(record)) ||
    Object.values(saved.simWork || {}).some(record => !neuroValidSimWork(record)) ||
    Object.values(saved.code || {}).some(item => item?.current && !neuroValidCodeWork(item.current))
  ) {
    StudyStorage.sessionFailed();
    return empty;
  }
  try {
    if (Object.keys(saved.projects || {}).length) NeuroProjectCore.validateRecords(saved.projects);
  } catch {
    StudyStorage.sessionFailed();
    return empty;
  }
  return Object.assign(empty, saved);
}
const NEURO_PROG = neuroReadProgress();
StudyStorage.watch('cs-neuro', () => NEURO_PROG);
function saveNeuroProg() {
  return StudyStorage.write('cs-neuro', NEURO_PROG);
}
let neuroLoading = null;

async function loadNeuro() {
  if (NEURO.loaded) return;
  if (neuroLoading) return neuroLoading;
  neuroLoading = (async () => {
    const results = await Promise.allSettled(
      ['data/neuro.json?v=13', 'data/neuro-milestones.json?v=5'].map(async file => {
        const response = await fetch(file);
        if (!response.ok) throw new Error('Neuroengineering lessons did not download');
        return response.json();
      })
    );
    if (results[0].status === 'rejected') throw results[0].reason;
    const data = results[0].value;
    if (
      !data ||
      !['topics', 'simulations', 'neuroCodeLessons', 'subjects'].every(key => Array.isArray(data[key])) ||
      !Array.isArray(data.learningPaths?.[0]?.steps) ||
      !data.learningPaths[0].steps.length ||
      !data.simulations.every(neuroValidSimContent) ||
      data.neuroCodeLessons.some(lesson => lesson.series != null && !neuroValidSeries(lesson.series))
    )
      throw new Error('Neuroengineering lessons have an invalid structure');
    NEURO.data = data;
    NEURO.milestones =
      results[1].status === 'fulfilled' && Array.isArray(results[1].value?.milestones) ? results[1].value : null;
    NEURO.topicMap = Object.fromEntries(data.topics.map(t => [t.id, t]));
    NEURO.simMap = Object.fromEntries(data.simulations.map(s => [s.id, s]));
    NEURO.codeMap = Object.fromEntries(data.neuroCodeLessons.map(c => [c.id, c]));
    NEURO.loaded = true;
  })();
  try {
    return await neuroLoading;
  } finally {
    neuroLoading = null;
  }
}

function neuroPath() {
  return NEURO.data?.learningPaths?.[0] || null;
}
function neuroSubject(id) {
  return NEURO.data?.subjects?.find(s => s.id === id);
}
function neuroTopic(id) {
  return NEURO.topicMap[id];
}
function neuroSim(id) {
  return NEURO.simMap[id];
}
function neuroCode(id) {
  return NEURO.codeMap[id];
}
function neuroUnitLesson(order) {
  return NEURO.data?.unitLessons?.[String(order)];
}
/* A unit's number is its position in the path. `order` stays the stable key into unitLessons. */
function neuroUnitNumber(step) {
  const index = neuroPath()?.steps.findIndex(item => item.id === step?.id) ?? -1;
  return index >= 0 ? index + 1 : step?.order || 0;
}
function neuroModules() {
  const path = neuroPath();
  if (!path) return [];
  const byOrder = new Map(path.steps.map(step => [step.order, step]));
  const grouped = (Array.isArray(path.modules) ? path.modules : [])
    .map((module, i) => ({
      ...module,
      index: i + 1,
      steps: (module.unitOrders || []).map(order => byOrder.get(order)).filter(Boolean),
    }))
    .filter(module => module.steps.length);
  return grouped.length
    ? grouped
    : [{ id: 'track', title: path.title, lede: path.summary, index: 1, steps: path.steps }];
}
function neuroModuleOf(step) {
  return neuroModules().find(module => module.steps.some(item => item.id === step?.id)) || null;
}
function neuroModuleProgress(module) {
  const done = module.steps.filter(step => NEURO_PROG.pathDone.includes(step.id)).length;
  const next = module.steps.find(step => !NEURO_PROG.pathDone.includes(step.id)) || null;
  return { done, total: module.steps.length, next };
}
function neuroAboutLine() {
  return '<p class="neuro-about-line"><a href="/neuro?view=about" data-neuro-about>About this course</a> &middot; how it was written and reviewed</p>';
}
function neuroBindLinks(root) {
  root.querySelectorAll('[data-neuro-about]').forEach(link =>
    link.addEventListener('click', event => {
      event.preventDefault();
      renderNeuroAbout();
    })
  );
  root.querySelectorAll('[data-neuro-python]').forEach(link =>
    link.addEventListener('click', event => {
      event.preventDefault();
      renderNeuroPython();
    })
  );
}
/* Code editor: Tab indents, Shift+Tab outdents, Enter keeps indentation. Esc then Tab leaves the editor.
   Where the editor has a Run button, Ctrl+Enter (or Cmd+Enter) presses it. */
function neuroEditorKeys(area, run) {
  let release = false;
  area.addEventListener('keydown', event => {
    if (run && event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      run();
      return;
    }
    if (area.readOnly || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape') {
      release = true;
      return;
    }
    const { value, selectionStart: start, selectionEnd: end } = area;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    if (event.key === 'Tab') {
      if (release) {
        release = false;
        return;
      }
      event.preventDefault();
      if (event.shiftKey || start !== end) {
        const lines = value.slice(lineStart, end).split('\n');
        const changed = lines.map(line => (event.shiftKey ? line.replace(/^ {1,4}/, '') : '    ' + line)).join('\n');
        area.setRangeText(changed, lineStart, end, start === end ? 'end' : 'select');
      } else area.setRangeText('    ', start, end, 'end');
      area.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    release = false;
    if (event.key === 'Enter' && !event.shiftKey) {
      const before = value.slice(lineStart, start);
      const indent = before.match(/^[ ]*/)[0] + (/:\s*$/.test(before) ? '    ' : '');
      if (!indent) return;
      event.preventDefault();
      area.setRangeText('\n' + indent, start, end, 'end');
      area.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
}

function pathProgress() {
  const path = neuroPath();
  if (!path) return { done: 0, total: 0, pct: 0, next: null };
  const done = path.steps.filter(step => NEURO_PROG.pathDone.includes(step.id)).length;
  const total = path.steps.length;
  const next = path.steps.find(s => !NEURO_PROG.pathDone.includes(s.id)) || null;
  return { done, total, pct: total ? Math.round((100 * done) / total) : 0, next };
}

function neuroPathStarted() {
  return NEURO_PROG.pathStarted === true || NEURO_PROG.pathDone.length > 0;
}

function topicQuizBest(id) {
  const r = NEURO_PROG.topicQuiz[id];
  return r ? `${r.c}/${r.t}` : null;
}

function neuroMilestoneUnlockedHub(ms, pg) {
  return neuroMilestoneUnlocked(ms, pg);
}

function neuroMilestonesPassed() {
  return Object.values(NEURO_PROG.projects || {}).filter(record => NeuroProjectCore.completed(record)).length;
}

/* ---------- hub figures ----------
   The landing page's line drawings are made at render from a seeded generator, so every visit
   shows the same pictures and nothing extra has to download. */
function neuroRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.gauss = (mean, sd) => mean + sd * Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  return next;
}
// A noisy baseline with sharp spikes: the SVG path and where each spike sits.
function neuroTracePath(width, y, amp, spikeCount, rand, step = 5) {
  const n = Math.floor(width / step);
  const spikes = new Set();
  while (spikes.size < spikeCount) spikes.add(6 + Math.floor(rand() * (n - 12)));
  const pts = [],
    xs = [];
  let v = 0;
  for (let k = 0; k <= n; k++) {
    const x = k * step;
    v = 0.55 * v + rand.gauss(0, amp * 0.11);
    if (spikes.has(k)) {
      pts.push([x, y + v], [x + 1.2, y - amp], [x + 2.5, y + amp * 0.42], [x + 3.6, y + v * 0.5]);
      xs.push(x + 1.2);
    } else pts.push([x, y + v]);
  }
  return { d: 'M' + pts.map(pt => `${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join(' L'), xs };
}
// One drawing per module, in order: a thresholded trace, features to a decision, a cursor
// settling on its target, and a loop with a break in it.
function neuroModuleArt(index) {
  const M = '#6ff0c2',
    W = '#ffffff',
    BG = '#05080c';
  const n = value => value.toFixed(1);
  let s = '';
  if (index === 1) {
    const trace = neuroTracePath(560, 130, 62, 7, neuroRng(3));
    s += `<line x1="0" y1="92" x2="560" y2="92" stroke="${W}" stroke-opacity=".6" stroke-dasharray="5 6"/>`;
    s += `<path d="${trace.d}" stroke="${M}" stroke-width="1.6"/>`;
    for (const x of trace.xs)
      s += `<circle cx="${n(x)}" cy="68" r="5" stroke="${W}" stroke-width="1.4"/><line x1="${n(x)}" y1="196" x2="${n(x)}" y2="210" stroke="${W}" stroke-width="1.6"/>`;
  } else if (index === 2) {
    const rand = neuroRng(9);
    [60, 118, 84, 150, 40, 102].forEach((height, i) => {
      s += `<rect x="${24 + i * 34}" y="${196 - height}" width="20" height="${height}" stroke="${M}" stroke-width="1.5"/>`;
    });
    s += `<line x1="14" y1="196" x2="236" y2="196" stroke="${W}" stroke-opacity=".6"/>`;
    s += `<path d="M252 110h36m-10-9l10 9l-10 9" stroke="${W}" stroke-opacity=".7" stroke-width="1.4"/>`;
    for (let i = 0; i < 20; i++)
      s += `<circle cx="${n(rand.gauss(370, 22))}" cy="${n(rand.gauss(150, 20))}" r="4.5" fill="${M}"/>`;
    for (let i = 0; i < 20; i++)
      s += `<circle cx="${n(rand.gauss(480, 22))}" cy="${n(rand.gauss(72, 20))}" r="4.5" stroke="${W}" stroke-width="1.4"/>`;
    s += `<line x1="330" y1="24" x2="540" y2="204" stroke="${W}" stroke-opacity=".75" stroke-width="1.2" stroke-dasharray="5 6"/>`;
  } else if (index === 3) {
    const rand = neuroRng(4),
      pts = [];
    for (const r of [16, 34, 52])
      s += `<circle cx="470" cy="70" r="${r}" stroke="${W}" stroke-opacity="${r === 16 ? 0.9 : 0.45}" stroke-width="1.3"/>`;
    s += `<line x1="60" y1="170" x2="470" y2="70" stroke="${W}" stroke-opacity=".4" stroke-dasharray="4 7"/>`;
    for (let k = 0; k <= 60; k++) {
      const t = k / 60;
      pts.push(
        `${n(60 + 410 * t)} ${n(170 - 100 * t + (1 - t) ** 1.3 * 42 * Math.sin(t * 13) + rand.gauss(0, 2.2 * (1 - t)))}`
      );
    }
    s += `<path d="M${pts.join(' L')}" stroke="${M}" stroke-width="1.8"/>`;
    s += `<circle cx="60" cy="170" r="6" fill="${M}"/><circle cx="470" cy="70" r="5" fill="${W}"/>`;
  } else {
    const cx = 280,
      cy = 110,
      r = 78;
    const at = (deg, radius = r) => [
      cx + radius * Math.cos((deg * Math.PI) / 180),
      cy + radius * Math.sin((deg * Math.PI) / 180),
    ];
    const arc = (from, to) => {
      const a = at(from),
        b = at(to);
      return `<path d="M${n(a[0])} ${n(a[1])} A${r} ${r} 0 0 1 ${n(b[0])} ${n(b[1])}" stroke="${M}" stroke-width="1.8"/>`;
    };
    s += arc(-70, 80) + arc(100, 170) + arc(190, 250);
    const gap = at(250),
      lifted = at(262, r + 26);
    s += `<line x1="${n(gap[0])}" y1="${n(gap[1])}" x2="${n(lifted[0])}" y2="${n(lifted[1])}" stroke="${W}" stroke-width="1.8"/>`;
    for (const deg of [250, 290]) {
      const pt = at(deg);
      s += `<circle cx="${n(pt[0])}" cy="${n(pt[1])}" r="5" fill="${BG}" stroke="${W}" stroke-width="1.6"/>`;
    }
    for (const deg of [0, 90, 180]) {
      const pt = at(deg);
      s += `<rect x="${n(pt[0] - 9)}" y="${n(pt[1] - 9)}" width="18" height="18" fill="${BG}" stroke="${M}" stroke-width="1.6"/>`;
    }
    for (const deg of [45, 135]) {
      const pt = at(deg),
        t = ((deg + 90) * Math.PI) / 180,
        ux = Math.cos(t),
        uy = Math.sin(t);
      s += `<path d="M${n(pt[0] - 7 * ux - 5 * uy)} ${n(pt[1] - 7 * uy + 5 * ux)} L${n(pt[0])} ${n(pt[1])} L${n(pt[0] - 7 * ux + 5 * uy)} ${n(pt[1] - 7 * uy - 5 * ux)}" stroke="${M}" stroke-width="1.6"/>`;
    }
    s += `<circle cx="${cx}" cy="${cy}" r="118" stroke="${W}" stroke-opacity=".25" stroke-dasharray="2 8"/>`;
  }
  return `<svg class="nx-art" aria-hidden="true" viewBox="0 0 560 220" fill="none" stroke-linecap="round" stroke-linejoin="round">${s}</svg>`;
}

/* The code in the landing page's editor window: the course in nineteen lines, from a recording to a
   moving cursor. Decoration, hidden from assistive technology. */
const NEURO_HERO_CODE = [
  'import numpy as np',
  '',
  'fs = 30_000                      # samples per second',
  'x  = load_recording("ch03")      # synthetic signal',
  '',
  '# 1 · threshold crossings',
  'sigma  = np.median(np.abs(x)) / 0.6745',
  'thr    = -4.5 * sigma',
  'cross  = (x[1:] < thr) & (x[:-1] >= thr)',
  'spikes = np.flatnonzero(cross)',
  '',
  '# 2 · firing rate in 50 ms bins',
  'bins      = np.arange(0, x.size / fs, 0.050)',
  'counts, _ = np.histogram(spikes / fs, bins)',
  'rate      = counts / 0.050',
  '',
  '# 3 · decode, then move the cursor',
  'velocity = rates[t] @ W + b      # rates: time × channels',
  'cursor  += velocity * dt',
];
// Comments, strings and numbers, and the three names a beginner meets first.
function neuroHeroCodeLine(line) {
  const hash = line.indexOf('#');
  const code = hash < 0 ? line : line.slice(0, hash);
  let out = '',
    pos = 0;
  for (const match of code.matchAll(/"[^"]*"|[A-Za-z_]\w*|-?\d[\d_]*(?:\.\d+)?/g)) {
    const token = match[0];
    const kind = /^(?:import|as|np)$/.test(token) ? 'nx-k' : /^[A-Za-z_]/.test(token) ? '' : 'nx-n';
    out += esc(code.slice(pos, match.index)) + (kind ? `<span class="${kind}">${esc(token)}</span>` : esc(token));
    pos = match.index + token.length;
  }
  return out + esc(code.slice(pos)) + (hash < 0 ? '' : `<span class="nx-c">${esc(line.slice(hash))}</span>`);
}
function neuroHeroArt() {
  const lines = NEURO_HERO_CODE.map(
    (line, i) =>
      `<span class="nx-ln" style="--i:${i}"><span class="nx-no">${i + 1}</span><span>${neuroHeroCodeLine(line) || ' '}</span></span>`
  ).join('');
  const last = NEURO_HERO_CODE.length;
  const trace = neuroTracePath(2400, 60, 34, 27, neuroRng(8));
  const dots = trace.xs
    .map(x => `<circle class="nx-dot" style="--x:${(x / 2400).toFixed(3)}" cx="${x.toFixed(1)}" cy="14" r="4"/>`)
    .join('');
  return `<div class="nx-editor" aria-hidden="true">
        <div class="nx-editor-bar"><i></i><i></i><i></i><span>bci_pipeline.py</span></div>
        <div class="nx-code">${lines}<span class="nx-ln" style="--i:${last}"><span class="nx-no">${last + 1}</span><span class="nx-caret"></span></span></div>
      </div>
      <svg class="nx-trace" aria-hidden="true" viewBox="0 0 2400 110" preserveAspectRatio="xMinYMid slice" fill="none">
        <path pathLength="1000" d="${trace.d}"/>${dots}
      </svg>`;
}
/* The editor types its lines in one after another, holds, clears and starts again. One class on the
   hero drives all of it (.nx-hero.is-typing / .is-clearing in styles.css). Under reduced motion the
   finished code simply rests there. A run starts only while the window is on screen in a visible
   tab, so nobody arrives to find it already finished. */
function neuroHeroPlay(hero) {
  const editor = hero?.querySelector('.nx-editor');
  if (!editor) return;
  if (typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hero.classList.add('is-static');
    return;
  }
  let inView = !('IntersectionObserver' in window),
    running = false,
    watcher = null;
  const stop = () => {
    watcher?.disconnect();
    document.removeEventListener('visibilitychange', wake);
  };
  const cycle = () => {
    if (!hero.isConnected) return stop();
    running = inView && !document.hidden;
    if (!running) return;
    hero.classList.add('is-typing');
    setTimeout(() => hero.classList.add('is-clearing'), 15600);
    setTimeout(() => {
      hero.classList.remove('is-typing', 'is-clearing');
      setTimeout(cycle, 700);
    }, 16800);
  };
  function wake() {
    if (!hero.isConnected) return stop();
    if (!running) cycle();
  }
  document.addEventListener('visibilitychange', wake);
  if (inView) return void setTimeout(cycle, 80);
  watcher = new IntersectionObserver(
    entries => {
      inView = entries[entries.length - 1].isIntersecting;
      if (inView) wake();
    },
    { threshold: 0.2 }
  );
  watcher.observe(editor);
}

/* ---------- hub ---------- */

/* Foundations primer — the philosophy on-ramp for absolute beginners.
   Static teach page; the science / coding / track cards on the hub route
   into existing content (subjects, NeuroCode, The Track). */
function renderNeuroPrimer() {
  if (typeof stopTimer === 'function') stopTimer();
  neuroRoute(null, null, null, 'primer');
  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner"><section class="neuro-body">
    <button class="backbtn topback" id="neback">&larr; Back to Neuroengineering</button>
    <span class="neuro-eyebrow">Foundations · Start here</span><h1>What does a BCI connect?</h1>
    <p>A brain–computer interface uses measured brain activity as an input to a device. This course begins with synthetic signals, simple calculations and the limits of what those calculations establish.</p>
    <ol><li>Describe the measurement, units and timing.</li><li>Inspect possible contamination.</li><li>Extract a feature with an explicit rule.</li><li>Test how the rule behaves when inputs change.</li><li>Explain what the result supports and what remains uncertain.</li></ol>
    <p>A threshold crossing is a numerical event. It does not, by itself, identify a neuron or reveal a thought. More complex applications depend on recording methods, training, evaluation and the people who will use the system.</p>
    <p>The four modules follow this workflow, from raw samples to a closed-loop toy BCI.</p>
    <button class="btn btn-solid" id="primer-next">Start the first foundation unit</button>
    <p><a href="https://pubmed.ncbi.nlm.nih.gov/26133797/" target="_blank" rel="noopener">Source: threshold crossings, single units and field signals</a></p>
    ${neuroAboutLine()}
  </section></main>`);
  neuroBindLinks(main);
  main.querySelector('#neback').onclick = () => renderNeuroEngineering();
  main.querySelector('#primer-next').onclick = () => renderNeuroUnit(neuroPath().steps[0].id);
  root.appendChild(main);
  setView(root);
}

/* The Track — the whole course as one visible spine, grouped into modules (a guide, not a gate:
   any unit is clickable; the current one is highlighted; done units show a check).
   Practitioner milestones appear inline after the unit that unlocks them. */
function neuroTrackUnitRow(step, pg) {
  const done = NEURO_PROG.pathDone.includes(step.id);
  const current = pg.next && pg.next.id === step.id;
  const subj = neuroSubject(step.subjectId);
  return `<button class="neuro-trackrow ${done ? 'done' : ''} ${current ? 'current' : ''}" type="button" data-unit="${step.id}">
      <span class="neuro-tracknum mono">${done ? '&#10003;' : String(neuroUnitNumber(step)).padStart(2, '0')}</span>
      <span class="neuro-trackcopy">
        <span class="neuro-tracktitle">${esc(step.title)}</span>
        <span class="neuro-trackmeta">${esc(step.estimatedFocus || '')}${subj ? ` &middot; ${esc(subj.name)}` : ''}</span>
      </span>
      <span class="neuro-trackgo mono">${current ? `${neuroPathStarted() ? 'Continue' : 'Start'} &rarr;` : done ? 'Review' : 'Open'}</span>
    </button>`;
}
function neuroTrackMilestoneRow(ms, pg) {
  const unlocked = neuroMilestoneUnlockedHub(ms, pg);
  const live = ms.status === 'live';
  const msDone = neuroMilestonePassed(ms.id);
  const clickable = unlocked && live;
  const tag = clickable ? 'button' : 'div';
  const sub = msDone
    ? 'Done'
    : NEURO_PROG.milestones?.[ms.id]?.passed
      ? 'Done (earlier version)'
      : clickable
        ? 'Open project &rarr;'
        : ms.status === 'planned'
          ? 'In development'
          : esc(neuroMilestoneRequirement(ms));
  return `<${tag} class="neuro-trackms ${msDone ? 'done' : ''} ${clickable ? 'open' : ''}"${clickable ? ` type="button" data-ms="${ms.id}"` : ''}>
        <span class="neuro-trackms-tag mono">Project</span>
        <span class="neuro-trackms-title">${esc(ms.title)}</span>
        <span class="neuro-trackms-sub mono">${sub}</span>
      </${tag}>`;
}
function neuroTrackRows(pg, modules = neuroModules(), headers = true) {
  const msByUnit = {};
  (NEURO.milestones?.milestones || []).forEach(ms => {
    msByUnit[ms.unlockUnit] = ms;
  });
  return modules
    .map(module => {
      const mp = neuroModuleProgress(module);
      const head = headers
        ? `<button class="neuro-trackmod" type="button" data-module="${esc(module.id)}">
        <span class="neuro-trackmod-num mono">Module ${module.index}</span>
        <span class="neuro-trackmod-title">${esc(module.title)}</span>
        <span class="neuro-trackmod-stat mono">${mp.done}/${mp.total} &rarr;</span>
      </button>`
        : '';
      return (
        head +
        module.steps
          .map(step => {
            const ms = msByUnit[neuroUnitNumber(step)];
            return neuroTrackUnitRow(step, pg) + (ms ? neuroTrackMilestoneRow(ms, pg) : '');
          })
          .join('')
      );
    })
    .join('');
}
function neuroBindTrack(root) {
  root
    .querySelectorAll('[data-unit]')
    .forEach(btn => btn.addEventListener('click', () => renderNeuroUnit(btn.dataset.unit)));
  root
    .querySelectorAll('[data-module]')
    .forEach(btn => btn.addEventListener('click', () => renderNeuroModule(btn.dataset.module)));
  root.querySelectorAll('[data-ms]').forEach(btn =>
    btn.addEventListener('click', () => {
      if (typeof renderNeuroMilestone === 'function') renderNeuroMilestone(btn.dataset.ms);
    })
  );
}

async function renderNeuroEngineering(options = {}) {
  if (typeof stopTimer === 'function') stopTimer();
  if (typeof session !== 'undefined') session = null;
  if (options.fromUrl && new URLSearchParams(location.search).has('project'))
    return renderNeuroMilestone(new URLSearchParams(location.search).get('project'));
  try {
    await loadNeuro();
  } catch {
    const root = el('<div></div>');
    root.appendChild(topbar('neuro'));
    const main = el(
      '<main class="neuro-page neuro-inner"><h1>Neuroengineering could not load.</h1><p>Your saved work has been kept. Retry when the connection is available.</p><button class="btn" id="neuro-retry">Retry lessons</button></main>'
    );
    main.querySelector('#neuro-retry').onclick = () => renderNeuroEngineering(options);
    root.appendChild(main);
    setView(root);
    return;
  }
  if (options.fromUrl) {
    const params = new URLSearchParams(location.search);
    if (params.has('unit')) return renderNeuroUnit(params.get('unit'));
    if (params.has('code')) return renderNeuroCode(params.get('code'));
    if (params.has('sim')) return renderNeuroSim(params.get('sim'));
    if (params.has('module')) return renderNeuroModule(params.get('module'));
    if (params.has('topic')) return renderNeuroTopic(params.get('topic'), { fromUnit: null });
    if (params.has('subject')) return renderNeuroSubject(params.get('subject'));
    if (params.get('view') === 'code') return renderNeuroCodeLab();
    if (params.get('view') === 'sims') return renderNeuroSimLibrary();
    if (params.get('view') === 'primer') return renderNeuroPrimer();
    if (params.get('view') === 'about') return renderNeuroAbout();
    if (params.get('view') === 'python') return renderNeuroPython();
  }
  neuroRoute();

  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const path = neuroPath();
  const pg = pathProgress();
  const modules = neuroModules();
  const subjects = NEURO.data?.subjects || [];
  const topicN = NEURO.data?.topics?.length || 0;
  const codeN = NEURO.data?.neuroCodeLessons?.length || 0;
  const simN = NEURO.data?.simulations?.length || 0;
  const nextModule = pg.next ? neuroModuleOf(pg.next) : null;
  const wide = window.matchMedia?.('(min-width: 900px)').matches;

  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  const course = (window.CortexAcademy?.tracks || [])
    .filter(track => track.available)
    .findIndex(track => track.id === 'neuro');
  const stats = [
    [modules.length, 'Modules'],
    [pg.total, 'Units'],
    [codeN, 'Python exercises'],
    [simN, 'Decision labs'],
  ];

  const main = el(`<main class="neuro-page neuro-hub nx-hub">
    <section class="neuro-hero nx-hero">
      ${neuroHeroArt()}
      <div class="neuro-hero-inner">
        <span class="neuro-eyebrow">Neuroengineering${course >= 0 ? ` &middot; Course ${numerals[course]}` : ''}</span>
        <h1>Where the mind meets <em>the machine.</em></h1>
        <p class="nx-lede">Learn how a brain&ndash;computer interface turns measured neural activity into action by building each piece yourself in Python, right in the browser.</p>
        ${
          path
            ? `<div class="neuro-cta">
          <button class="btn btn-solid neuro-btn" id="ne-path">${pg.next ? `${neuroPathStarted() ? 'Continue' : 'Start'} &middot; Unit ${neuroUnitNumber(pg.next)}` : 'Path complete'}</button>
          <button class="btn neuro-btn neuro-btn-ghost" id="ne-library">Practice &amp; projects</button>
        </div>
        ${pg.next ? `<p class="neuro-upnext mono">Up next &middot; ${nextModule ? `Module ${nextModule.index} ${esc(nextModule.title)} &middot; ` : ''}${esc(pg.next.title)}</p>` : ''}`
            : ''
        }
      </div>
    </section>
    <section class="nx-stats" aria-label="What is in the course" data-reveal>
      <dl class="nx-wrap">${stats.map(stat => `<div><dt>${stat[1]}</dt><dd data-countup="${stat[0]}">${stat[0]}</dd></div>`).join('')}</dl>
    </section>
    <section class="neuro-body nx-wrap">
      <div class="neuro-section neuro-foundations" data-reveal>
        <h2 class="neuro-section-label">Start here &middot; no prerequisites</h2>
        <div class="neuro-lablinks neuro-foundations-row">
          <button class="neuro-lablink" id="nf-why"><b>01</b><strong>Why BCIs?</strong><span>Scope and evidence</span></button>
          <button class="neuro-lablink" id="nf-sci"><b>02</b><strong>The science</strong><span>Neurons &rarr; signals</span></button>
          <button class="neuro-lablink" id="nf-code"><b>03</b><strong>Never coded?</strong><span>Python in 5 minutes</span></button>
          <button class="neuro-lablink" id="nf-track"><b>04</b><strong>The Track</strong><span>Build the BCI</span></button>
        </div>
        ${NEURO.milestones ? '' : '<p>The optional project list could not load. Foundation lessons remain available.</p><button class="btn" id="neuro-project-retry">Retry project list</button>'}
      </div>
      ${
        path
          ? `<div class="nx-track">
        <div class="nx-track-head" data-reveal>
          <span class="neuro-section-label">The track</span>
          <h2>From raw samples <em>to a closed loop.</em></h2>
          <p>${modules.length === 4 ? 'Four' : modules.length} modules follow one workflow, ending in a closed-loop toy BCI. No account, no paywall.</p>
        </div>
        <div class="nx-modules" data-reveal>${modules
          .map(module => {
            const mp = neuroModuleProgress(module);
            return `<button class="nx-module" type="button" data-module="${esc(module.id)}">
            ${neuroModuleArt(module.index)}
            <span class="nx-module-kicker">Module ${numerals[module.index - 1] || module.index} &middot; ${mp.total} units${mp.done ? ` &middot; ${mp.done} done` : ''}</span>
            <span class="nx-module-name">${esc(module.title)}</span>
            <span class="nx-module-lede">${esc(module.lede || '')}</span>
            <span class="nx-module-go">Open module <i aria-hidden="true">&rarr;</i></span>
          </button>`;
          })
          .join('')}</div>
      </div>
      <details class="neuro-track" id="ne-track" ${wide ? 'open' : ''}>
        <summary class="neuro-track-summary">
          <span class="neuro-track-head">
            <span class="label">Every unit</span>
            <span class="neuro-track-summary-meta">
              <span class="neuro-pathstat">${pg.done}/${pg.total} &middot; ${pg.pct}%</span>
              <span class="neuro-track-toggle" aria-hidden="true"><span class="neuro-track-toggle-show">Show units</span><span class="neuro-track-toggle-hide">Hide units</span><span class="neuro-track-toggle-arrow">&darr;</span></span>
            </span>
          </span>
          <span class="bar"><i style="width:${pg.pct}%"></i></span>
        </summary>
        <div class="neuro-tracklist">${neuroTrackRows(pg, modules)}</div>
      </details>`
          : ''
      }
      ${
        subjects.length
          ? `<div class="neuro-section neuro-topiclib" id="ne-topiclib">
        <h2 class="neuro-section-label">Topic library &middot; ${subjects.length} subjects &middot; ${topicN} topics</h2>
        <p class="neuro-pathsum">Short reference lessons with vocabulary, a quiz and Socratic prompts. Use them beside the Track or on their own.</p>
        <div class="neuro-libgrid">${subjects
          .map(
            s => `<div class="neuro-libcard" style="--ne-accent:#${esc(s.accentHex || '9a9aa2')}">
          <button class="neuro-libcard-name" type="button" data-subject="${esc(s.id)}">${esc(s.name)}</button>
          ${(s.topicIds || [])
            .map(neuroTopic)
            .filter(Boolean)
            .map(
              topic =>
                `<button class="neuro-libtopic" type="button" data-topic="${esc(topic.id)}"><span>${esc(topic.title)}</span>${topicQuizBest(topic.id) ? `<span class="mono">${topicQuizBest(topic.id)}</span>` : ''}</button>`
            )
            .join('')}
        </div>`
          )
          .join('')}</div>
      </div>`
          : ''
      }
      ${neuroAboutLine()}
    </section>
  </main>`);

  if (path) {
    const go = main.querySelector('#ne-path');
    if (pg.next) go.addEventListener('click', () => renderNeuroUnit(pg.next.id));
    else go.disabled = true;
    main.querySelector('#ne-library')?.addEventListener('click', renderNeuroLibrary);
  }
  neuroBindTrack(main);
  neuroBindLinks(main);
  main
    .querySelectorAll('[data-subject]')
    .forEach(btn => btn.addEventListener('click', () => renderNeuroSubject(btn.dataset.subject)));
  main
    .querySelectorAll('[data-topic]')
    .forEach(btn => btn.addEventListener('click', () => renderNeuroTopic(btn.dataset.topic, { fromUnit: null })));
  main.querySelector('#nf-why')?.addEventListener('click', renderNeuroPrimer);
  main.querySelector('#neuro-project-retry')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const response = await fetch('data/neuro-milestones.json?v=5');
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      if (!Array.isArray(data?.milestones)) throw new Error('Invalid project list');
      NEURO.milestones = data;
      if (button.isConnected) renderNeuroEngineering();
    } catch {
      button.textContent = 'Project list still unavailable. Retry';
      button.disabled = false;
    }
  });
  main
    .querySelector('#nf-sci')
    ?.addEventListener('click', () => renderNeuroTopic('ns-action-potential', { fromUnit: null }));
  main.querySelector('#nf-code')?.addEventListener('click', renderNeuroPython);
  main.querySelector('#nf-track')?.addEventListener('click', () => {
    const track = main.querySelector('#ne-track');
    if (track) track.open = true;
    (main.querySelector('.nx-track') || track)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  root.appendChild(main);
  if (typeof siteFooter === 'function') root.appendChild(siteFooter());
  setView(root);

  neuroHeroPlay(root.querySelector('.nx-hero'));
}

/* ---------- modules ---------- */

function renderNeuroModule(moduleId) {
  if (typeof stopTimer === 'function') stopTimer();
  const modules = neuroModules();
  const module = modules.find(item => item.id === moduleId);
  if (!module) return renderNeuroEngineering();
  neuroRoute(null, null, null, null, null, { module: module.id });
  const pg = pathProgress(),
    mp = neuroModuleProgress(module);
  const target = mp.next || module.steps[0];
  const numbers = module.steps.map(neuroUnitNumber);
  const projects = (NEURO.milestones?.milestones || []).filter(ms => numbers.includes(ms.unlockUnit));
  const prev = modules[module.index - 2],
    next = modules[module.index];
  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner neuro-module"><section class="neuro-body">
    <button class="backbtn topback" id="neback">&larr; Back to Neuroengineering</button>
    <span class="neuro-eyebrow">Module ${module.index} of ${modules.length}</span>
    <h1 class="neuro-h1">${esc(module.title)}.</h1>
    <p class="neuro-lede">${esc(module.lede || '')}</p>
    <p class="neuro-unit-meta mono">Units ${numbers[0]}&ndash;${numbers.at(-1)} &middot; ${mp.done}/${mp.total} done${projects.length ? ` &middot; ${projects.length === 1 ? 'Project' : 'Projects'}: ${projects.map(ms => esc(ms.title)).join(', ')}` : ''}</p>
    <div class="neuro-cta"><button class="btn btn-solid neuro-btn" id="ne-module-go">${mp.done === mp.total ? 'Review' : mp.done || neuroPathStarted() ? 'Continue' : 'Start'} &middot; Unit ${neuroUnitNumber(target)}</button></div>
    <div class="neuro-tracklist neuro-module-units">${neuroTrackRows(pg, [module], false)}</div>
    <div class="neuro-module-nav">${prev ? `<button class="btn neuro-btn" data-module="${esc(prev.id)}">&larr; Module ${prev.index} &middot; ${esc(prev.title)}</button>` : '<span></span>'}${next ? `<button class="btn neuro-btn" data-module="${esc(next.id)}">Module ${next.index} &middot; ${esc(next.title)} &rarr;</button>` : ''}</div>
    ${neuroAboutLine()}
  </section></main>`);
  main.querySelector('#neback').onclick = () => renderNeuroEngineering();
  main.querySelector('#ne-module-go').onclick = () => renderNeuroUnit(target.id);
  neuroBindTrack(main);
  neuroBindLinks(main);
  root.appendChild(main);
  setView(root);
}

/* ---------- about: the one home for authorship, review status and limits ---------- */

async function renderNeuroAbout() {
  if (typeof stopTimer === 'function') stopTimer();
  try {
    await loadNeuro();
  } catch {
    /* The page still explains the course without the unit list. */
  }
  neuroRoute(null, null, null, 'about');
  const modules = neuroModules();
  const steps = neuroPath()?.steps || [];
  const revised = steps.filter(step => neuroUnitLesson(step.order)?.revision).length;
  const sources = new Map();
  Object.values(NEURO.data?.unitLessons || {}).forEach(unit =>
    (unit.sources || []).forEach(source => {
      if (source?.url && !sources.has(source.url)) sources.set(source.url, source);
    })
  );
  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner neuro-about"><section class="neuro-body">
    <button class="backbtn topback" id="neback">&larr; Back to Neuroengineering</button>
    <span class="neuro-eyebrow">Neuroengineering &middot; About</span>
    <h1 class="neuro-h1">About this course.</h1>
    <p class="neuro-lede">A free introduction to how brain&ndash;computer interfaces work, built around one question: how does measured neural activity become an action?</p>
    <h2>How it works</h2>
    <p>${modules.length} modules, ${steps.length} units. Each unit pairs a short lesson with recall prompts, quick checks, a Python exercise and a decision lab. Six practitioner projects ask you to build one piece of the pipeline, check it against several inputs and write a short engineering memo.</p>
    <p>Python runs in your browser, in a separate worker, using Pyodide. The first run downloads the runtime. Only the Python standard library is available, so the exercises use plain lists and loops rather than NumPy.</p>
    <h2>Review status</h2>
    <p>The course is written and maintained by Cortex Medical Academy. ${revised} of ${steps.length} units have been revised line by line against the sources they cite.${revised < steps.length ? ' The rest are first drafts being rewritten to the same standard.' : ''} No independent subject-matter expert has reviewed the course yet. When one does, this page will say who and when.</p>
    ${modules
      .map(
        module =>
          `<h3>Module ${module.index} &middot; ${esc(module.title)}</h3><ul class="neuro-about-units">${module.steps
            .map(step => {
              const unit = neuroUnitLesson(step.order);
              return `<li><span>Unit ${neuroUnitNumber(step)} &middot; ${esc(step.title)}</span><span class="mono">${unit?.revision ? `Revised &middot; rev ${unit.revision}` : 'First draft'}</span></li>`;
            })
            .join('')}</ul>`
      )
      .join('')}
    <h2>Synthetic data</h2>
    <p>Every signal, trace and dataset here is invented for teaching. None comes from a patient or a real device, and nothing in the course controls hardware. A threshold crossing in an exercise is a numerical event, not a confirmed neuron or a thought.</p>
    <h2>What finishing means</h2>
    <p>Completing a unit or project records your practice on this device. It is not a grade, certificate or professional qualification. Your first answers, writing and code are kept so you can review them honestly later.</p>
    ${sources.size ? `<h2>Sources cited in the units</h2><ul>${[...sources.values()].map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)}</a></li>`).join('')}</ul>` : ''}
  </section></main>`);
  main.querySelector('#neback').onclick = () => renderNeuroEngineering();
  root.appendChild(main);
  setView(root);
}

/* ---------- Python in five minutes: a run-only primer for people who have never coded ---------- */

function renderNeuroPython() {
  if (typeof stopTimer === 'function') stopTimer();
  neuroRoute(null, null, null, 'python');
  const starter = `samples = [-70, -68, -45, -42, -70]
threshold = -50

def count_at_or_above(values, level):
    count = 0
    for value in values:
        if value >= level:
            count = count + 1
    return count

print(len(samples), "samples")
print(samples[0], "is the first sample")
print(count_at_or_above(samples, threshold), "samples at or above", threshold)
`;
  const block = (title, code, text) =>
    `<div class="neuro-block"><span class="label">${title}</span><pre class="neuro-code">${esc(code)}</pre><p>${text}</p></div>`;
  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner neuro-python"><section class="neuro-body">
    <button class="backbtn topback" id="neback">&larr; Back to Neuroengineering</button>
    <span class="neuro-eyebrow">Start here &middot; Never coded?</span>
    <h1 class="neuro-h1">Python in five minutes.</h1>
    <p class="neuro-lede">Every exercise in this course uses the same five ideas. Read them once, run the example, then start Unit 1.</p>
    ${block('1 · Names and values', 'resting_mv = -70', 'A name points at a value. Numbers can be negative or have decimals.')}
    ${block('2 · Lists', 'samples = [-70, -68, -45]\nsamples[0]     # -70, the first value\nlen(samples)   # 3', 'A list keeps values in order. Counting starts at 0, so <code>samples[0]</code> is the first sample.')}
    ${block('3 · Loops', 'for value in samples:\n    print(value)', 'The indented lines run once for each item in the list.')}
    ${block('4 · Decisions', 'if value >= -50:\n    print("at or above threshold")', 'The indented lines run only when the condition is true. Four spaces of indentation tell Python what belongs inside.')}
    ${block('5 · Functions', 'def double(x):\n    return x * 2\n\nprint(double(21))   # 42', '<code>def</code> names a function and its inputs. <code>return</code> hands a value back to whoever called it. <code>print</code> only shows a value on screen. The course checks call your function and look at what it returns.')}
    <div class="neuro-sandbox"><span class="label">Try it</span>
      <p>Edit anything and press Run. Nothing here is graded or saved.</p>
      <label for="neuro-python-editor">Python editor <span class="neuro-editor-hint mono">Tab indents &middot; Esc then Tab leaves</span></label>
      <textarea id="neuro-python-editor" class="neuro-code-draft" rows="14" maxlength="40000" spellcheck="false">${esc(starter)}</textarea>
      <div class="neuro-sandbox-actions"><button class="btn btn-solid" id="neuro-python-run">Run</button><button class="btn" id="neuro-python-stop" hidden>Stop Python</button><button class="btn" id="neuro-python-reset">Reset</button></div>
      <p id="neuro-python-status" role="status">Python downloads the first time you press Run.</p>
      <pre class="neuro-code" id="neuro-python-out"></pre>
    </div>
    <div class="neuro-cta"><button class="btn btn-solid neuro-btn" id="neuro-python-unit">Start Unit 1</button></div>
    ${neuroAboutLine()}
  </section></main>`);
  const area = main.querySelector('#neuro-python-editor'),
    run = main.querySelector('#neuro-python-run'),
    stop = main.querySelector('#neuro-python-stop'),
    status = main.querySelector('#neuro-python-status'),
    out = main.querySelector('#neuro-python-out');
  neuroEditorKeys(area);
  let controller = null;
  run.onclick = async () => {
    if (controller) return;
    controller = new AbortController();
    run.disabled = true;
    stop.hidden = false;
    out.textContent = '';
    try {
      const result = await runPythonCode(area.value, {
        signal: controller.signal,
        onStatus: text => (status.textContent = text),
        onOutput: output => (out.textContent = [output.stdout, output.stderr].filter(Boolean).join('\n')),
      });
      out.textContent = [result.stdout, result.stderr].filter(Boolean).join('\n');
      status.textContent = result.ok
        ? 'Run complete.'
        : result.reason === 'stopped'
          ? 'Python stopped.'
          : 'Python could not finish this run. Read the error above, fix it and run again.';
    } catch (error) {
      status.textContent = 'Python could not start. Retry when the connection is available.';
      out.textContent = error.message || String(error);
    } finally {
      controller = null;
      run.disabled = false;
      stop.hidden = true;
    }
  };
  stop.onclick = () => controller?.abort();
  main.querySelector('#neuro-python-reset').onclick = () => {
    if (controller) return;
    area.value = starter;
    out.textContent = '';
  };
  main.querySelector('#neback').onclick = () => renderNeuroEngineering();
  main.querySelector('#neuro-python-unit').onclick = async () => {
    try {
      await loadNeuro();
    } catch {
      return renderNeuroEngineering();
    }
    const first = neuroPath()?.steps[0];
    if (first) renderNeuroUnit(first.id);
    else renderNeuroEngineering();
  };
  neuroBindLinks(main);
  root.appendChild(main);
  setView(root);
}

async function renderNeuroLibrary() {
  if (typeof stopTimer === 'function') stopTimer();
  if (typeof session !== 'undefined') session = null;
  await loadNeuro();

  const pg = pathProgress();
  const codeN = NEURO.data?.neuroCodeLessons?.length || 0;
  const simN = NEURO.data?.simulations?.length || 0;
  const m1 = NEURO.milestones?.milestones?.find(m => m.id === 'neural-signal-viewer');
  const m1Unlocked = m1 && neuroMilestoneUnlockedHub(m1, pg);
  const projectsDone = neuroMilestonesPassed();

  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner neuro-library">
    <section class="neuro-body">
      <button class="backbtn topback" id="neback">&larr; Back to Neuroengineering</button>
      <h1 class="neuro-h1">Practice &amp; projects.</h1>
      <p class="neuro-lede">Python exercises, decision labs and the practitioner projects, outside the main Track.</p>
      <div class="neuro-section">
        <span class="neuro-section-label">Practice</span>
        <div class="neuro-lablinks">
          <button class="neuro-lablink" id="ne-codelab">NeuroCode <span>${codeN} exercises</span></button>
          <button class="neuro-lablink" id="ne-simlib">NeuroSim <span>${simN} decision labs</span></button>
          ${
            m1
              ? `<button class="neuro-lablink neuro-lablink--practitioner ${m1Unlocked ? '' : 'neuro-lablink--locked'}" id="ne-practitioner" type="button" ${m1Unlocked ? '' : 'disabled'}>
            Projects <span>${projectsDone ? `${projectsDone}/${NEURO.milestones.milestones.length} done` : m1Unlocked ? 'Start projects' : `Unlocks after Unit ${m1.unlockUnit}`}</span>
          </button>`
              : ''
          }
        </div>
      </div>
      ${
        NEURO.milestones
          ? `<details class="neuro-practitioner-fold">
        <summary class="neuro-practitioner-sum">
          <span class="label">Practitioner projects</span>
          <span class="neuro-pathstat">${neuroMilestonesPassed() ? `${neuroMilestonesPassed()}/${NEURO.milestones.milestones.length} done` : m1Unlocked ? 'First project available' : `Unlocks after Unit ${m1?.unlockUnit || ''}`}</span>
        </summary>
        <p class="neuro-pathsum">Six projects, each one a piece of the pipeline you build in Python, check against several inputs and explain in a short memo.</p>
        <div class="neuro-milestones">${NEURO.milestones.milestones
          .map(ms => {
            const unlocked = neuroMilestoneUnlockedHub(ms, pg);
            const live = ms.status === 'live';
            const done = neuroMilestonePassed(ms.id);
            const clickable = unlocked && live;
            const tag = clickable ? 'button' : 'div';
            const sub = done
              ? 'Done'
              : NEURO_PROG.milestones?.[ms.id]?.passed
                ? 'Done (earlier version)'
                : clickable
                  ? 'Open project'
                  : unlocked && !live
                    ? 'Coming soon'
                    : esc(neuroMilestoneRequirement(ms));
            return `<${tag} class="neuro-ms ${unlocked ? 'unlocked' : 'locked'} ${clickable ? 'active' : ''} ${done ? 'done' : ''}" ${clickable ? `type="button" data-ms="${ms.id}"` : ''}>
            <span class="neuro-ms-title">${esc(ms.title)}</span>
            <span class="neuro-ms-sub">${sub}</span>
          </${tag}>`;
          })
          .join('')}</div>
      </details>`
          : ''
      }
      ${neuroAboutLine()}
    </section>
  </main>`);

  main.querySelector('#neback').addEventListener('click', renderNeuroEngineering);
  neuroBindLinks(main);
  main.querySelector('#ne-practitioner')?.addEventListener('click', () => {
    const projects = main.querySelector('.neuro-practitioner-fold');
    if (projects) {
      projects.open = true;
      projects.querySelector('summary')?.focus();
      projects.scrollIntoView({ block: 'start' });
    }
  });
  main.querySelector('#ne-codelab')?.addEventListener('click', renderNeuroCodeLab);
  main.querySelector('#ne-simlib')?.addEventListener('click', renderNeuroSimLibrary);
  main.querySelectorAll('[data-ms]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof renderNeuroMilestone === 'function') renderNeuroMilestone(btn.dataset.ms);
    });
  });
  root.appendChild(main);
  if (typeof siteFooter === 'function') root.appendChild(siteFooter());
  setView(root);
}

/* ---------- subjects ---------- */

function renderNeuroSubject(subjectId) {
  const sub = neuroSubject(subjectId);
  if (!sub) {
    renderNeuroEngineering();
    return;
  }
  neuroRoute(null, null, null, null, null, { subject: sub.id });
  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner">
    <section class="neuro-body">
      <button class="backbtn topback" id="neback">&larr; Back to Neuroengineering</button>
      <span class="neuro-eyebrow">${esc(sub.name).toUpperCase()}</span>
      <h1 class="neuro-h1">${esc(sub.name)}.</h1>
      <p class="neuro-lede">${esc(sub.summary)}</p>
      <div class="neuro-rows" id="nerows"></div>
    </section>
  </main>`);
  main.querySelector('#neback').addEventListener('click', renderNeuroEngineering);
  const rows = main.querySelector('#nerows');
  const trackByTopic = new Map();
  for (const step of neuroPath()?.steps || []) {
    if (step.topicId && !trackByTopic.has(step.topicId)) trackByTopic.set(step.topicId, step);
  }
  const orderedTopicIds = sub.topicIds
    .map((tid, index) => ({ tid, index, step: trackByTopic.get(tid) }))
    .sort((a, b) => {
      if (a.step && b.step) return neuroUnitNumber(a.step) - neuroUnitNumber(b.step);
      if (a.step) return -1;
      if (b.step) return 1;
      return a.index - b.index;
    })
    .map(item => item.tid);
  for (const tid of orderedTopicIds) {
    const t = neuroTopic(tid);
    if (!t) continue;
    const qb = topicQuizBest(tid);
    const trackStep = trackByTopic.get(tid);
    const row = el(`<button class="neuro-row">
      <span class="neuro-row-main"><span class="neuro-row-title">${esc(t.title)}</span><span class="neuro-row-sub">${trackStep ? `Track Unit ${neuroUnitNumber(trackStep)} &middot; ` : ''}${t.quizQuestions?.length || 0} questions</span></span>
      <span class="neuro-row-right">${qb ? `<span class="pill ok">${qb}</span>` : ''}</span>
    </button>`);
    row.addEventListener('click', () => renderNeuroTopic(tid, { fromUnit: null }));
    rows.appendChild(row);
  }
  root.appendChild(main);
  setView(root);
}

/* ---------- topic hub ---------- */

let neTopicReturnUnit = null;
function renderNeuroTopic(topicId, opts = {}) {
  const t = neuroTopic(topicId);
  if (!t) {
    renderNeuroEngineering();
    return;
  }
  if (opts.fromUnit !== undefined) neTopicReturnUnit = opts.fromUnit;
  const returnStep = neTopicReturnUnit && neuroPath()?.steps.find(step => step.id === neTopicReturnUnit);
  neuroRoute(null, null, null, null, null, { topic: t.id });
  const sub = neuroSubject(t.subjectId);
  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner">
    <section class="neuro-body">
      <button class="backbtn topback" id="neback">&larr; Back to ${returnStep ? `Unit ${neuroUnitNumber(returnStep)}` : esc(sub?.name || 'Subjects')}</button>
      <span class="neuro-eyebrow">${esc(sub?.name || '').toUpperCase()}</span>
      <h1 class="neuro-h1">${esc(t.title)}</h1>
      <p class="neuro-lede">${esc(t.oneLineMaster)}</p>
      <div class="neuro-block"><span class="label">Explanation</span><p class="neuro-prose">${esc(t.explanation)}</p></div>
      <div class="neuro-block"><span class="label">Clinical relevance</span><p class="neuro-prose">${esc(t.clinicalRelevance)}</p></div>
      ${t.vocabulary?.length ? `<div class="neuro-block"><span class="label">Vocabulary</span><div class="neuro-vocab">${t.vocabulary.map(v => `<div class="neuro-vterm"><span class="k">${esc(v.term)}</span><span>${esc(v.definition)}</span></div>`).join('')}</div></div>` : ''}
      <div class="neuro-actions">
        <button class="btn btn-solid neuro-btn" id="ne-atlas">Socratic study</button>
        <button class="btn neuro-btn" id="ne-quiz">Quiz &middot; ${t.quizQuestions?.length || 0}</button>
      </div>
    </section>
  </main>`);
  main
    .querySelector('#neback')
    .addEventListener('click', () => (returnStep ? renderNeuroUnit(returnStep.id) : renderNeuroSubject(t.subjectId)));
  main.querySelector('#ne-atlas').addEventListener('click', () => renderNeuroAtlas(topicId));
  main.querySelector('#ne-quiz').addEventListener('click', () => renderNeuroQuiz(topicId));
  root.appendChild(main);
  setView(root);
}

/* ---------- Socratic study ---------- */

let neAtlas = null;
function renderNeuroAtlas(topicId) {
  const t = neuroTopic(topicId);
  if (!t?.socraticPrompts?.length) {
    renderNeuroTopic(topicId);
    return;
  }
  neAtlas = { topicId, prompts: t.socraticPrompts, idx: 0 };
  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner">
    <section class="neuro-body">
      <button class="backbtn topback" id="neback">&larr; Back to ${esc(t.title)}</button>
      <span class="neuro-eyebrow">Socratic &middot; ${esc(t.title).toUpperCase()}</span>
      <h1 class="neuro-h1">Socratic study.</h1>
      <div class="neuro-dots" id="nedots"></div>
      <div id="nestages"></div>
    </section>
  </main>`);
  main.querySelector('#neback').addEventListener('click', () => renderNeuroTopic(topicId));
  root.appendChild(main);
  setView(root);
  neuroAtlasDots();
  neuroAtlasAppend();
}

function neuroAtlasDots() {
  const dots = document.getElementById('nedots');
  if (!dots || !neAtlas) return;
  dots.replaceChildren();
  neAtlas.prompts.forEach((_, i) =>
    dots.appendChild(el(`<span class="neuro-dot ${i < neAtlas.idx ? 'past' : i === neAtlas.idx ? 'now' : ''}"></span>`))
  );
}

function neuroAtlasAppend() {
  if (!neAtlas || neAtlas.idx >= neAtlas.prompts.length) return neuroAtlasFinish();
  const s = neAtlas.prompts[neAtlas.idx];
  const isLast = neAtlas.idx === neAtlas.prompts.length - 1;
  const node = el(`<section class="neuro-stage">
    <div class="stage-head"><span class="label">Prompt ${neAtlas.idx + 1}</span><span class="rule"></span></div>
    <p class="q">${esc(s.question)}</p>
    <textarea class="socinput neuro-input" rows="3" placeholder="Reason it out first&hellip;"></textarea>
    <div class="socactions">
      ${s.hint ? '<button class="btn neuro-btn" data-hint>Hint</button>' : ''}
      <button class="btn btn-solid neuro-btn" data-submit-answer>Submit answer</button>
    </div>
    <div class="socafter"></div>
  </section>`);
  const after = node.querySelector('.socafter');
  const hintBtn = node.querySelector('[data-hint]');
  if (hintBtn)
    hintBtn.addEventListener('click', () => {
      hintBtn.disabled = true;
      after.appendChild(el(`<div class="sochint"><span class="label">Hint</span><p>${esc(s.hint)}</p></div>`));
    });
  node.querySelector('[data-submit-answer]').addEventListener('click', () => {
    node.querySelector('.socactions')?.remove();
    after.appendChild(
      el(
        `<div class="socans"><div class="socblock"><span class="label">Answer</span><p>${esc(s.answer)}</p></div></div>`
      )
    );
    const row = el(
      `<div class="continue-row"><button class="btn btn-solid neuro-btn" data-cont>${isLast ? 'Finish study' : 'Next'}</button></div>`
    );
    row.querySelector('[data-cont]').addEventListener('click', () => {
      row.remove();
      neAtlas.idx++;
      neuroAtlasDots();
      neuroAtlasAppend();
    });
    after.appendChild(row);
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  document.getElementById('nestages').appendChild(node);
  if (neAtlas.idx > 0) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function neuroAtlasFinish() {
  NEURO_PROG.topicAtlas[neAtlas.topicId] = true;
  saveNeuroProg();
  const t = neuroTopic(neAtlas.topicId);
  const node = el(`<section class="neuro-stage">
    <span class="label">Study complete</span>
    <div class="neuro-score">&#10003;</div>
    <p class="neuro-prose">${esc(t?.oneLineMaster || '')}</p>
    <div class="endbtns">
      <button class="btn btn-solid neuro-btn" id="neq">Take quiz</button>
      <button class="btn neuro-btn" id="net">Back to topic</button>
    </div>
  </section>`);
  node.querySelector('#neq').addEventListener('click', () => renderNeuroQuiz(neAtlas.topicId));
  node.querySelector('#net').addEventListener('click', () => renderNeuroTopic(neAtlas.topicId));
  document.getElementById('nestages').appendChild(node);
  node.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- quiz ---------- */

let neQuiz = null;
function renderNeuroQuiz(topicId, opts = {}) {
  const t = neuroTopic(topicId);
  if (!t?.quizQuestions?.length) {
    if (opts.onDone) opts.onDone(false);
    else renderNeuroTopic(topicId);
    return;
  }
  const qs = [...t.quizQuestions];
  if (opts.limit) qs.length = Math.min(opts.limit, qs.length);
  neQuiz = {
    topicId,
    qs,
    idx: 0,
    correct: 0,
    results: [],
    onDone: opts.onDone,
    limit: opts.limit || null,
    mount: null,
    wrap: null,
    dotsEl: null,
    stagesEl: null,
  };
  if (opts.mount) {
    const mount = typeof opts.mount === 'string' ? document.querySelector(opts.mount) : opts.mount;
    if (!mount) {
      if (opts.onDone) opts.onDone(false);
      return;
    }
    const wrap = el(
      `<div class="neuro-embed"><div class="neuro-dots" data-neuro-dots></div><div data-neuro-quiz-stages></div></div>`
    );
    mount.replaceChildren(wrap);
    neQuiz.mount = mount;
    neQuiz.wrap = wrap;
    neQuiz.dotsEl = wrap.querySelector('[data-neuro-dots]');
    neQuiz.stagesEl = wrap.querySelector('[data-neuro-quiz-stages]');
    neuroQuizDots();
    neuroQuizAppend();
    return;
  }
  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner">
    <section class="neuro-body">
      <button class="backbtn topback" id="neback">&larr; Back to ${esc(t.title)}</button>
      <span class="neuro-eyebrow">Quiz &middot; ${esc(t.title).toUpperCase()}</span>
      <div class="neuro-dots" id="nedots"></div>
      <div id="neqstages"></div>
    </section>
  </main>`);
  main.querySelector('#neback').addEventListener('click', () => renderNeuroTopic(topicId));
  root.appendChild(main);
  setView(root);
  neuroQuizDots();
  neuroQuizAppend();
}

function neuroQuizDots() {
  const dots = neQuiz?.dotsEl || document.getElementById('nedots');
  if (!dots || !neQuiz) return;
  dots.replaceChildren();
  neQuiz.qs.forEach((_, i) => {
    const r = neQuiz.results[i];
    const cls = r ? (r.correct ? 'ok' : 'no') : i === neQuiz.idx ? 'now' : '';
    dots.appendChild(el(`<span class="neuro-dot ${cls}"></span>`));
  });
}

function neuroQuizAppend() {
  if (!neQuiz) return;
  if (neQuiz.idx >= neQuiz.qs.length) return neuroQuizFinish();
  const q = neQuiz.qs[neQuiz.idx];
  const shuffled = q.choices.map((c, i) => ({ c, i })).sort(() => Math.random() - 0.5);
  const node = el(`<section class="neuro-stage">
    <div class="stage-head"><span class="label">Q${neQuiz.idx + 1} / ${neQuiz.qs.length}</span><span class="rule"></span></div>
    <p class="q">${esc(q.prompt)}</p>
    <div class="opts">${shuffled.map((o, n) => `<button class="opt" data-i="${o.i}"><span class="key">${LETTERS[n]}</span><span>${esc(o.c)}</span></button>`).join('')}</div>
    <div class="after"></div>
  </section>`);
  node.querySelectorAll('.opt').forEach(btn =>
    btn.addEventListener('click', () => {
      if (neQuiz.results[neQuiz.idx]) return;
      const choice = Number(btn.dataset.i);
      const correct = choice === q.correctIndex;
      neQuiz.results[neQuiz.idx] = { correct };
      if (correct) neQuiz.correct++;
      node.querySelectorAll('.opt').forEach(b => {
        const i = Number(b.dataset.i);
        b.disabled = true;
        if (i === q.correctIndex) b.classList.add('correct');
        else if (i === choice) b.classList.add('wrong');
        else b.classList.add('dimmed');
      });
      const after = node.querySelector('.after');
      after.appendChild(
        el(
          `<div class="explain ${correct ? 'good' : 'bad'}"><span class="verdict">${correct ? 'CORRECT' : 'INCORRECT'}</span><p>${esc(q.explanation)}</p>${q.wrongAnswerHint && !correct ? `<p class="neuro-hint">${esc(q.wrongAnswerHint)}</p>` : ''}</div>`
        )
      );
      const row = el(
        `<div class="continue-row"><button class="btn btn-solid neuro-btn" data-cont>${neQuiz.idx === neQuiz.qs.length - 1 ? 'Finish' : 'Next'}</button></div>`
      );
      const contBtn = row.querySelector('[data-cont]');
      contBtn.addEventListener('click', () => {
        if (!neQuiz || contBtn.disabled) return;
        contBtn.disabled = true;
        neQuiz.idx++;
        neuroQuizDots();
        neuroQuizAppend();
      });
      after.appendChild(row);
      neuroQuizDots();
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    })
  );
  const stagesEl = neQuiz.stagesEl || document.getElementById('neqstages');
  if (neQuiz.mount) stagesEl.replaceChildren(node);
  else stagesEl.appendChild(node);
  if (neQuiz.idx > 0) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function neuroQuizFinish() {
  if (!neQuiz) return;
  const state = neQuiz;
  const { topicId, correct, qs, onDone } = state;
  const prev = NEURO_PROG.topicQuiz[topicId];
  if (!prev || correct > prev.c) NEURO_PROG.topicQuiz[topicId] = { c: correct, t: qs.length, ts: Date.now() };
  saveNeuroProg();
  if (onDone) {
    const passed = correct === qs.length;
    const topic = neuroTopic(topicId);
    const node = el(`<section class="neuro-quiz-result ${passed ? 'passed' : 'retry'}" role="status" tabindex="-1">
      <span class="label">${passed ? 'Quick check passed' : 'Quick check incomplete'}</span>
      <div class="neuro-score">${String(correct).padStart(2, '0')}<span class="of">/${String(qs.length).padStart(2, '0')}</span></div>
      <p class="neuro-prose">${
        passed
          ? 'You passed this stage. Continue when you are ready.'
          : `This stage requires ${qs.length}/${qs.length}. Your unit progress is safe — review the supporting topic here, then retry.`
      }</p>
      <div class="endbtns">
        ${
          passed
            ? '<button class="btn btn-solid neuro-btn" data-quiz-continue>Continue to next stage</button>'
            : `<button class="btn btn-solid neuro-btn" data-quiz-retry>Retry quick check</button><button class="btn neuro-btn" data-quiz-review>Review ${esc(topic?.title || 'topic')}</button>`
        }
      </div>
    </section>`);
    state.stagesEl.replaceChildren(node);
    if (passed) {
      node.querySelector('[data-quiz-continue]').addEventListener('click', e => {
        e.currentTarget.disabled = true;
        neQuiz = null;
        onDone(true);
      });
    } else {
      node.querySelector('[data-quiz-retry]').addEventListener('click', () => {
        const { mount, limit } = state;
        neQuiz = null;
        renderNeuroQuiz(topicId, { limit: limit || qs.length, mount, onDone });
        mount?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      node.querySelector('[data-quiz-review]').addEventListener('click', () => {
        const review = state.mount?.closest('.neuro-quiz-gate')?.querySelector('.neuro-topic-review');
        if (!review) return;
        const inlineReview = review.cloneNode(true);
        inlineReview.open = true;
        node.querySelector('.endbtns')?.before(inlineReview);
        node.querySelector('[data-quiz-review]')?.remove();
        inlineReview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
    node.focus({ preventScroll: true });
    node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  const node = el(`<section class="neuro-stage">
    <span class="label">Quiz complete</span>
    <div class="neuro-score">${String(correct).padStart(2, '0')}<span class="of">/${String(qs.length).padStart(2, '0')}</span></div>
    <div class="endbtns">
      <button class="btn btn-solid neuro-btn" id="ner">Retry</button>
      <button class="btn neuro-btn" id="net">Back to topic</button>
    </div>
  </section>`);
  node.querySelector('#ner').addEventListener('click', () => renderNeuroQuiz(topicId));
  node.querySelector('#net').addEventListener('click', () => renderNeuroTopic(topicId));
  (neQuiz.stagesEl || document.getElementById('neqstages')).appendChild(node);
  node.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- NeuroSim ---------- */

function neuroValidSeries(series, maxSamples = 128) {
  const n = Array.isArray(series?.values) ? series.values.length : 0;
  return (
    !!series &&
    typeof series.title === 'string' &&
    typeof series.description === 'string' &&
    typeof series.unit === 'string' &&
    Number.isFinite(series.sampleRateHz) &&
    series.sampleRateHz > 0 &&
    n > 0 &&
    n <= maxSamples &&
    series.values.every(Number.isFinite) &&
    (series.xStart == null || Number.isFinite(series.xStart)) &&
    (series.compare == null ||
      (typeof series.compare.label === 'string' &&
        Array.isArray(series.compare.values) &&
        series.compare.values.length === n &&
        series.compare.values.every(value => value === null || Number.isFinite(value)))) &&
    (series.spans == null ||
      (Array.isArray(series.spans) &&
        series.spans.every(
          span =>
            Number.isInteger(span?.start) &&
            Number.isInteger(span?.end) &&
            span.start >= 0 &&
            span.end >= span.start &&
            span.end < n &&
            typeof span.label === 'string'
        )))
  );
}
const neuroNumber = value => String(Number(Number(value).toPrecision(5)));
function neuroFigureTable(head, rows) {
  return `<details><summary>Exact values</summary><div style="overflow-x:auto"><table><thead><tr>${head.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows
        .map(
          row =>
            `<tr><th scope="row">${esc(row[0])}</th>${row
              .slice(1)
              .map(cell => `<td>${esc(cell)}</td>`)
              .join('')}</tr>`
        )
        .join('')}</tbody></table></div></details>`;
}
function neuroFigureFrame(title, description, svg, notes, table) {
  return `<figure class="neuro-series"><figcaption><b>${esc(title)}</b> <span>· synthetic data</span></figcaption>
    <div class="neuro-series-plot" role="region" tabindex="0" aria-label="${esc(title)} chart. Scroll horizontally to inspect the full plot.">${svg}</div>
    ${notes}<p>${esc(description)}</p>${table}</figure>`;
}
function neuroSeriesMarkup(series, maxSamples = 128) {
  if (!neuroValidSeries(series, maxSamples)) return '';
  const values = series.values,
    rate = series.sampleRateHz,
    start = series.xStart || 0;
  const compare = series.compare?.values || [];
  const all = [...values, ...compare.filter(Number.isFinite)];
  const low = Math.min(...all),
    high = Math.max(...all),
    padding = (high - low || 2) * 0.15;
  const min = low - padding,
    max = high + padding;
  const step = values.length > 1 ? 415 / (values.length - 1) : 0;
  const x = i => 110 + i * step;
  const y = value => 190 - ((value - min) / (max - min)) * 150;
  const xLabel = series.xLabel || 'Time (s)';
  const yLabel = `${series.yLabel || 'Amplitude'} (${series.unit})`;
  const markers = Array.isArray(series.markerIndices)
    ? series.markerIndices.filter(index => Number.isInteger(index) && index >= 0 && index < values.length)
    : [];
  const thresholdVisible = Number.isFinite(series.threshold) && series.threshold >= min && series.threshold <= max;
  const segments = [];
  compare.forEach((value, i) => {
    if (value === null) return;
    if (i === 0 || compare[i - 1] === null) segments.push([]);
    segments.at(-1).push(`${x(i)},${y(value)}`);
  });
  const half = step / 2 || 8;
  const svg = `<svg viewBox="0 0 580 245" role="img" aria-label="${esc(series.title)}: ${esc(xLabel)} and ${esc(yLabel)}">
      <title>${esc(series.title)}</title><desc>${esc(series.description)} Exact values follow in a table.</desc>
      ${(series.spans || []).map(span => `<rect class="neuro-fig-band" x="${Math.max(110, x(span.start) - half)}" y="30" width="${Math.min(535, x(span.end) + half) - Math.max(110, x(span.start) - half)}" height="160"><title>${esc(span.label)}</title></rect>`).join('')}
      <path class="neuro-fig-grid" d="M110 70H535M110 110H535M110 150H535" fill="none" stroke="currentColor" opacity=".14"/>
      <path class="neuro-fig-axis" d="M110 30V190H535" fill="none" stroke="currentColor"/>
      <g class="neuro-fig-text" fill="currentColor" font-size="13"><text x="107" y="210">${neuroNumber(start)}</text><text x="525" y="210" text-anchor="end">${neuroNumber(start + (values.length - 1) / rate)}</text>
        <text x="100" y="${y(low) + 4}" text-anchor="end">${neuroNumber(low)}</text>${high !== low ? `<text x="100" y="${y(high) + 4}" text-anchor="end">${neuroNumber(high)}</text>` : ''}
        <text x="318" y="237" text-anchor="middle">${esc(xLabel)}</text><text x="18" y="115" transform="rotate(-90 18 115)" text-anchor="middle">${esc(yLabel)}</text></g>
      ${thresholdVisible ? `<path class="neuro-series-threshold" d="M110 ${y(series.threshold)}H535" fill="none" stroke-width="2" stroke-dasharray="6 4"/>` : ''}
      ${segments.map(points => `<polyline class="neuro-fig-compare" points="${points.join(' ')}" fill="none" stroke-width="2" stroke-dasharray="3 4"/>`).join('')}
      ${compare.map((value, i) => (value === null ? '' : `<rect class="neuro-fig-compare-dot" x="${x(i) - 3.5}" y="${y(value) - 3.5}" width="7" height="7"/>`)).join('')}
      <polyline class="neuro-fig-line" points="${values.map((value, i) => `${x(i)},${y(value)}`).join(' ')}" fill="none" stroke="currentColor" stroke-width="2"/>
      ${values.map((value, i) => `<circle class="neuro-fig-dot" cx="${x(i)}" cy="${y(value)}" r="3" fill="currentColor"/>`).join('')}
      ${markers.map(index => `<circle class="neuro-series-marker" cx="${x(index)}" cy="${y(values[index])}" r="7" fill="none" stroke-width="3"><title>Marked sample ${index}</title></circle>`).join('')}</svg>`;
  const notes = [
    series.compare
      ? `Solid line with dots: ${esc(series.primaryLabel || series.title)}. Dotted line with squares: ${esc(series.compare.label)}.`
      : '',
    Number.isFinite(series.threshold)
      ? `${esc(series.thresholdLabel || 'Threshold')}: ${neuroNumber(series.threshold)} ${esc(series.unit)}${thresholdVisible ? ' · dashed amber line' : ' · outside the displayed range'}.${series.thresholdLabel ? '' : ` ${markers.length} candidate events marked with white circles.`}`
      : '',
    markers.length && (series.thresholdLabel || series.markerLabel || !Number.isFinite(series.threshold))
      ? `Circled in white: ${esc(series.markerLabel || 'marked samples')}.`
      : '',
    (series.spans || []).length ? `Shaded: ${series.spans.map(span => esc(span.label)).join('; ')}.` : '',
  ].filter(Boolean);
  const head = ['Index', xLabel, yLabel, ...(series.compare ? [series.compare.label] : [])];
  const rows = values.map((value, i) => [
    i,
    neuroNumber(start + i / rate),
    value,
    ...(series.compare ? [compare[i] === null ? '—' : neuroNumber(compare[i])] : []),
  ]);
  return neuroFigureFrame(
    series.title,
    `${series.description} ${series.xLabel ? '' : `Sampling rate: ${rate} Hz. `}${values.length} ${!series.xLabel || /sample/i.test(series.xLabel) ? 'samples' : 'points'}.`,
    svg,
    notes.length ? `<p>${notes.join(' ')}</p>` : '',
    neuroFigureTable(head, rows)
  );
}
function neuroValidFigure(fig) {
  if (!fig || typeof fig !== 'object' || typeof fig.title !== 'string' || typeof fig.description !== 'string')
    return false;
  const finite = Number.isFinite;
  if (fig.kind === 'series') return neuroValidSeries(fig);
  if (fig.kind === 'bars')
    return (
      Array.isArray(fig.labels) &&
      Array.isArray(fig.values) &&
      fig.values.length > 0 &&
      fig.values.length <= 16 &&
      fig.labels.length === fig.values.length &&
      fig.labels.every(label => typeof label === 'string') &&
      fig.values.every(finite) &&
      typeof fig.unit === 'string' &&
      (fig.reference == null || finite(fig.reference)) &&
      (fig.band == null ||
        (Array.isArray(fig.band) && fig.band.length === 2 && fig.band.every(finite) && fig.band[0] < fig.band[1]))
    );
  if (fig.kind === 'scatter')
    return (
      Array.isArray(fig.groups) &&
      fig.groups.length === 2 &&
      Array.isArray(fig.points) &&
      fig.points.length > 0 &&
      fig.points.length <= 40 &&
      fig.points.every(p => finite(p?.x) && finite(p?.y) && (p.group === 0 || p.group === 1)) &&
      typeof fig.xLabel === 'string' &&
      typeof fig.yLabel === 'string' &&
      (fig.lines || []).every(
        line =>
          Array.isArray(line?.weights) &&
          line.weights.length === 2 &&
          line.weights.every(finite) &&
          line.weights[1] !== 0 &&
          finite(line.bias) &&
          typeof line.label === 'string'
      )
    );
  if (fig.kind === 'events')
    return (
      finite(fig.durationS) &&
      fig.durationS > 0 &&
      Array.isArray(fig.rows) &&
      fig.rows.length > 0 &&
      fig.rows.length <= 6 &&
      fig.rows.every(
        row =>
          typeof row?.label === 'string' &&
          (row.durationS == null || (finite(row.durationS) && row.durationS > 0 && row.durationS <= fig.durationS)) &&
          Array.isArray(row.times) &&
          row.times.every(time => finite(time) && time >= 0 && time <= (row.durationS || fig.durationS))
      )
    );
  return false;
}
function neuroBarsMarkup(fig) {
  const n = fig.values.length,
    rowH = 34,
    top = 20,
    height = top + n * rowH + 44;
  const domain = [0, ...fig.values, ...(Number.isFinite(fig.reference) ? [fig.reference] : []), ...(fig.band || [])];
  let lo = Math.min(...domain),
    hi = Math.max(...domain);
  const pad = (hi - lo || 1) * 0.12;
  if (lo < 0) lo -= pad;
  hi += pad;
  const x = value => 210 + ((value - lo) / (hi - lo)) * 320;
  const markers = new Set((fig.markerIndices || []).filter(i => Number.isInteger(i) && i >= 0 && i < n));
  const rowsSvg = fig.values
    .map((value, i) => {
      const yy = top + i * rowH,
        x0 = x(Math.min(0, value)),
        x1 = x(Math.max(0, value));
      return `<text class="neuro-fig-text" x="200" y="${yy + 21}" text-anchor="end" fill="currentColor" font-size="13">${esc(fig.labels[i])}</text>
        <rect class="neuro-fig-bar" x="${x0}" y="${yy + 8}" width="${Math.max(1.5, x1 - x0)}" height="18" fill="currentColor" opacity=".82"/>
        ${markers.has(i) ? `<rect class="neuro-series-marker" x="${x0 - 4}" y="${yy + 4}" width="${Math.max(1.5, x1 - x0) + 8}" height="26" fill="none" stroke-width="3"/>` : ''}
        <text class="neuro-fig-text" x="${value < 0 ? x0 - 6 : x1 + 6}" y="${yy + 21}" text-anchor="${value < 0 ? 'end' : 'start'}" fill="currentColor" font-size="12">${neuroNumber(value)}</text>`;
    })
    .join('');
  const bottom = top + n * rowH;
  const svg = `<svg viewBox="0 0 580 ${height}" role="img" aria-label="${esc(fig.title)}: bar chart in ${esc(fig.unit)}">
      <title>${esc(fig.title)}</title><desc>${esc(fig.description)} Exact values follow in a table.</desc>
      ${fig.band ? `<rect class="neuro-fig-band" x="${x(fig.band[0])}" y="${top}" width="${x(fig.band[1]) - x(fig.band[0])}" height="${n * rowH}"/>` : ''}
      <path class="neuro-fig-axis" d="M${x(0)} ${top}V${bottom}" stroke="currentColor" fill="none"/>
      ${Number.isFinite(fig.reference) ? `<path class="neuro-series-threshold" d="M${x(fig.reference)} ${top}V${bottom}" fill="none" stroke-width="2" stroke-dasharray="6 4"/>` : ''}
      ${rowsSvg}
      <text class="neuro-fig-text" x="370" y="${bottom + 32}" text-anchor="middle" fill="currentColor" font-size="13">${esc(fig.axisLabel || fig.unit)}</text></svg>`;
  const notes = [
    Number.isFinite(fig.reference)
      ? `Dashed amber line: ${esc(fig.referenceLabel || 'reference')} (${neuroNumber(fig.reference)} ${esc(fig.unit)}).`
      : '',
    fig.band
      ? `Shaded: ${esc(fig.bandLabel || 'band')} (${neuroNumber(fig.band[0])} to ${neuroNumber(fig.band[1])}).`
      : '',
    markers.size ? `Outlined in white: ${esc(fig.markerLabel || 'marked rows')}.` : '',
  ].filter(Boolean);
  return neuroFigureFrame(
    fig.title,
    fig.description,
    svg,
    notes.length ? `<p>${notes.join(' ')}</p>` : '',
    neuroFigureTable(
      ['Item', `Value (${fig.unit})`],
      fig.values.map((value, i) => [fig.labels[i], value])
    )
  );
}
let neuroFigureCount = 0;
function neuroScatterMarkup(fig) {
  const xs = fig.points.map(p => p.x),
    ys = fig.points.map(p => p.y);
  const span = (values, extra) => {
    const lo = Math.min(...values),
      hi = Math.max(...values),
      pad = (hi - lo || 2) * extra;
    // Whole-number axis ends once the range is wide enough to read them.
    return hi - lo >= 4 ? [Math.floor(lo - pad), Math.ceil(hi + pad)] : [lo - pad, hi + pad];
  };
  const [x0, x1] = span(xs, 0.2),
    [y0, y1] = span(ys, 0.2);
  const x = value => 110 + ((value - x0) / (x1 - x0)) * 415;
  const y = value => 190 - ((value - y0) / (y1 - y0)) * 160;
  const clip = `neuro-fig-clip-${++neuroFigureCount}`;
  const lines = (fig.lines || []).map((line, i) => {
    const [a, b] = line.weights,
      at = xv => -(a * xv + line.bias) / b;
    return `<line class="${i ? 'neuro-fig-compare' : 'neuro-series-threshold'}" x1="${x(x0)}" y1="${y(at(x0))}" x2="${x(x1)}" y2="${y(at(x1))}" stroke-width="2" ${i ? 'stroke-dasharray="3 4"' : 'stroke-dasharray="6 4"'}/>`;
  });
  const svg = `<svg viewBox="0 0 580 245" role="img" aria-label="${esc(fig.title)}: ${esc(fig.xLabel)} against ${esc(fig.yLabel)}">
      <title>${esc(fig.title)}</title><desc>${esc(fig.description)} Exact values follow in a table.</desc>
      <defs><clipPath id="${clip}"><rect x="110" y="30" width="425" height="160"/></clipPath></defs>
      <path class="neuro-fig-grid" d="M110 70H535M110 110H535M110 150H535" fill="none" stroke="currentColor" opacity=".14"/>
      <path class="neuro-fig-axis" d="M110 30V190H535" fill="none" stroke="currentColor"/>
      <g class="neuro-fig-text" fill="currentColor" font-size="13"><text x="110" y="210">${neuroNumber(x0)}</text><text x="535" y="210" text-anchor="end">${neuroNumber(x1)}</text>
        <text x="100" y="194" text-anchor="end">${neuroNumber(y0)}</text><text x="100" y="38" text-anchor="end">${neuroNumber(y1)}</text>
        <text x="318" y="237" text-anchor="middle">${esc(fig.xLabel)}</text><text x="18" y="110" transform="rotate(-90 18 110)" text-anchor="middle">${esc(fig.yLabel)}</text></g>
      <g clip-path="url(#${clip})">${lines.join('')}</g>
      ${fig.points.map(p => `<circle class="neuro-fig-pt neuro-fig-pt-${p.group ? 'b' : 'a'}" cx="${x(p.x)}" cy="${y(p.y)}" r="6" ${p.group ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2"'}><title>${esc(p.label || '')} (${neuroNumber(p.x)}, ${neuroNumber(p.y)}) · ${esc(fig.groups[p.group])}</title></circle>`).join('')}</svg>`;
  const notes = [
    `Hollow circles: ${esc(fig.groups[0])}. Filled circles: ${esc(fig.groups[1])}.`,
    ...(fig.lines || []).map((line, i) => `${i ? 'Dotted grey' : 'Dashed amber'} line: ${esc(line.label)}.`),
  ];
  return neuroFigureFrame(
    fig.title,
    fig.description,
    svg,
    `<p>${notes.join(' ')}</p>`,
    neuroFigureTable(
      ['Point', fig.xLabel, fig.yLabel, 'Group'],
      fig.points.map((p, i) => [p.label || String(i + 1), p.x, p.y, fig.groups[p.group]])
    )
  );
}
function neuroEventsMarkup(fig) {
  const rowH = 46,
    top = 16,
    height = top + fig.rows.length * rowH + 40;
  const x = time => 200 + (time / fig.durationS) * 330;
  const rows = fig.rows
    .map((row, i) => {
      const yy = top + i * rowH + 20,
        end = x(row.durationS || fig.durationS);
      return `<text class="neuro-fig-text" x="190" y="${yy + 5}" text-anchor="end" fill="currentColor" font-size="13">${esc(row.label)}</text>
        <path d="M200 ${yy}H${end}" stroke="currentColor" opacity=".35" fill="none"/><path d="M${end} ${yy - 8}V${yy + 8}" stroke="currentColor" opacity=".6"/>
        ${row.times.map(time => `<path class="neuro-fig-tick" d="M${x(time)} ${yy - 13}V${yy + 13}" stroke="currentColor" stroke-width="2.5"/>`).join('')}`;
    })
    .join('');
  const bottom = top + fig.rows.length * rowH;
  const svg = `<svg viewBox="0 0 580 ${height}" role="img" aria-label="${esc(fig.title)}: event times over ${neuroNumber(fig.durationS)} seconds">
      <title>${esc(fig.title)}</title><desc>${esc(fig.description)} Exact values follow in a table.</desc>
      ${rows}<path class="neuro-fig-axis" d="M200 ${bottom}H530" stroke="currentColor" fill="none"/>
      <g class="neuro-fig-text" fill="currentColor" font-size="13"><text x="200" y="${bottom + 16}">0</text><text x="530" y="${bottom + 16}" text-anchor="end">${neuroNumber(fig.durationS)}</text><text x="365" y="${bottom + 34}" text-anchor="middle">Time (s)</text></g></svg>`;
  return neuroFigureFrame(
    fig.title,
    fig.description,
    svg,
    `<p>Each vertical tick is one event${fig.rows.some(row => row.durationS) ? '; a short end bar marks where each recording stops' : ''}.</p>`,
    neuroFigureTable(
      ['Row', 'Events', 'Window (s)', 'Mean rate (Hz)', 'Event times (s)'],
      fig.rows.map(row => {
        const window = row.durationS || fig.durationS;
        return [row.label, row.times.length, window, neuroNumber(row.times.length / window), row.times.join(', ')];
      })
    )
  );
}
function neuroFigureMarkup(fig) {
  if (!neuroValidFigure(fig)) return '';
  if (fig.kind === 'series') return neuroSeriesMarkup(fig);
  if (fig.kind === 'bars') return neuroBarsMarkup(fig);
  if (fig.kind === 'scatter') return neuroScatterMarkup(fig);
  return neuroEventsMarkup(fig);
}
function neuroValidSimContent(sim) {
  return (
    sim &&
    ['id', 'title', 'scenario', 'signalDescription', 'decisionQuestion', 'oneLineMaster'].every(
      key => typeof sim[key] === 'string'
    ) &&
    Array.isArray(sim.choices) &&
    sim.choices.length >= 2 &&
    sim.choices.every(choice => typeof choice.label === 'string' && typeof choice.rationale === 'string') &&
    Number.isInteger(sim.bestAnswerIndex) &&
    sim.bestAnswerIndex >= 0 &&
    sim.bestAnswerIndex < sim.choices.length &&
    (sim.series == null || neuroValidSeries(sim.series))
  );
}
function neuroValidSimWork(record) {
  return (
    record &&
    neuroValidSimContent(record.content) &&
    Number.isFinite(record.startedAt) &&
    typeof record.debrief === 'string' &&
    neuroValidAnswers(record.answers, [{ id: 'simulation', choices: record.content.choices }]) &&
    (record.completedAt == null ||
      (Number.isFinite(record.completedAt) && record.answers.simulation?.chosen != null && !!record.debrief.trim()))
  );
}
function neuroSimRecord(simId) {
  if (NEURO_PROG.simWork[simId]) return NEURO_PROG.simWork[simId];
  const sim = neuroSim(simId);
  if (!neuroValidSimContent(sim)) return null;
  const record = { content: neuroClone(sim), answers: {}, debrief: '', startedAt: Date.now() };
  NEURO_PROG.simWork[simId] = record;
  saveNeuroProg();
  return record;
}
function neuroCompleteSim(record) {
  if (StudyStorage.paused || record.completedAt || record.answers.simulation?.chosen == null || !record.debrief.trim())
    return false;
  record.completedAt = Date.now();
  return saveNeuroProg();
}
// A lab's adjustable plot (neuro-instruments.js). Work saved before a lab had one borrows the current
// lab's settings, but only while the saved copy still describes the same signal.
function neuroLabInstrument(sim) {
  if (typeof neuroBenchValid !== 'function' || !sim) return null;
  let spec = sim.instrument;
  if (!spec) {
    const current =
      neuroSim(sim.id) ||
      Object.values(NEURO.data?.unitLessons || {})
        .map(unit => unit.simulation)
        .find(item => item?.id === sim.id);
    const same = key => JSON.stringify(current?.[key]) === JSON.stringify(sim[key]);
    if (current?.instrument && ['series', 'scenario', 'signalDescription'].every(same)) spec = current.instrument;
  }
  return spec && neuroBenchValid(spec, sim) ? spec : null;
}
// A lab's scenario and signal, with its plot beside them when the lab has one. The plot is adjustable
// when the lab carries an instrument; some instruments open only after the first answer.
function neuroLabBrief(sim, answered) {
  const spec = neuroLabInstrument(sim),
    live = !!spec && (answered || spec.gate === 'open');
  let plot = '';
  // The instrument is an extra. If it cannot draw, the lab still opens with its static plot.
  if (live)
    try {
      plot = neuroBenchMarkup(sim, spec, !!answered);
    } catch {
      plot = '';
    }
  plot ||= neuroSeriesMarkup(sim.series);
  const soon =
    spec && !live && plot
      ? '<p class="nx-live-soon">Answer first. This plot then becomes adjustable so you can test the rule yourself.</p>'
      : '';
  return `<div class="nx-lab-brief${plot ? ' has-plot' : ''}"><div class="nx-lab-text">
      <div class="neuro-block"><span class="label">Scenario</span><p>${esc(sim.scenario)}</p></div>
      <div class="neuro-block"><span class="label">Signal</span><p>${esc(sim.signalDescription)}</p></div>
    </div>${plot ? `<div class="nx-lab-plot">${plot}${soon}</div>` : ''}</div>`;
}
function neuroLabBenchMount(root, sim, answered) {
  const spec = neuroLabInstrument(sim);
  if (!spec || !(answered || spec.gate === 'open')) return;
  try {
    neuroBenchMount(root, sim, spec, !!answered);
  } catch {
    // Controls that failed to wire would look alive and do nothing. Show the static plot instead.
    const figure = root.querySelector('[data-bench]'),
      plain = neuroSeriesMarkup(sim.series);
    if (figure && plain) figure.replaceWith(el(plain));
    else if (figure) figure.remove();
  }
}
function renderNeuroSim(simId, opts = {}) {
  const record = neuroSimRecord(simId);
  if (!record) {
    if (opts.onDone) opts.onDone(false);
    else renderNeuroSimLibrary();
    return;
  }
  const sim = record.content,
    question = { id: 'simulation', choices: sim.choices };
  const answer = neuroAnswerRecord(record, question),
    chosen = answer.chosen;
  if (!opts.mount) neuroRoute(null, null, null, null, simId);
  const right = chosen === sim.bestAnswerIndex;
  const body = `<span class="neuro-eyebrow">NeuroSim · ${esc(sim.difficulty || 'lab')}</span><h1>${esc(sim.title)}</h1>
    <p class="nx-stage-note">${neuroLabInstrument(sim)?.gate === 'open' ? 'Work the plot, then choose. ' : ''}Your first answer is saved. Read the model answer, then write one line on why.</p>
    ${neuroLabBrief(sim, chosen != null)}
    <div class="neuro-block nx-q"><span class="nx-q-n">Decision</span><p class="q">${esc(sim.decisionQuestion)}</p><div class="opts">${answer.order.map((index, i) => `<button class="opt ${chosen === index ? (right ? 'correct' : 'wrong') : chosen != null && index === sim.bestAnswerIndex ? 'is-model' : ''}" data-sim-choice="${index}" ${chosen == null ? '' : 'disabled'}><span class="key">${LETTERS[i]}</span><span>${esc(sim.choices[index].label)}</span></button>`).join('')}</div>
    ${
      chosen == null
        ? ''
        : `<div class="explain ${right ? 'good' : 'bad'}"><b>${right ? 'Correct first answer' : 'First answer needs review'}</b>${right ? '' : `<p>${esc(sim.choices[chosen].rationale)}</p>`}<p>Model answer: ${esc(sim.choices[sim.bestAnswerIndex].label)}</p><p>${esc(sim.choices[sim.bestAnswerIndex].rationale)}</p></div>`
    }</div>
    ${
      chosen == null
        ? ''
        : `<div class="nx-lab-close"><p class="nx-done-take">${esc(sim.oneLineMaster)}</p>
      <div class="nx-field nx-field-ask"><label for="sim-debrief">Explain the calculation or one limit of this conclusion.</label>
      <textarea class="socinput neuro-input" id="sim-debrief" rows="4" maxlength="12000" ${record.completedAt ? 'readonly' : ''}>${esc(record.debrief)}</textarea></div>
      <div class="nx-stage-foot">${record.completedAt ? `<button class="btn btn-solid" id="sim-back">${opts.mount ? 'Continue' : 'Back to NeuroSim'}</button><p class="nx-stage-next" role="status">Saved.</p>` : `<button class="btn btn-solid" id="sim-complete" ${record.debrief.trim() ? '' : 'disabled'}>Save and finish</button><span class="nx-stage-next">One line is enough.</span>`}</div></div>`
    }
    ${sim.sources?.length ? `<details class="nx-sources"><summary>Sources</summary><ul>${sim.sources.map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)}</a></li>`).join('')}</ul></details>` : ''}`;
  const main = el(
    opts.mount
      ? `<section class="neuro-stage nx-stage nx-s-sim">${body}</section>`
      : `<main class="neuro-page neuro-inner nx-bench nx-labpage${opts.quiet ? ' is-quiet' : ''}"><section class="neuro-body"><button class="backbtn topback" id="neback">← Back to NeuroSim Lab</button>${body}</section></main>`
  );
  main.querySelector('#neback')?.addEventListener('click', () => renderNeuroSimLibrary());
  neuroLabBenchMount(main, sim, chosen != null);
  // A redraw after an answer keeps the reader where they were and moves focus to what just appeared.
  const redraw = focus => {
    const y = typeof scrollY === 'number' ? scrollY : 0;
    if (opts.mount) main.remove();
    renderNeuroSim(simId, { ...opts, quiet: true });
    if (opts.mount || typeof scrollTo !== 'function') return;
    scrollTo(0, y);
    const target = document.querySelector(`.nx-labpage ${focus}`);
    if (!target) return;
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  };
  main.querySelectorAll('[data-sim-choice]').forEach(
    button =>
      (button.onclick = () => {
        if (neuroChoose(record, question, Number(button.dataset.simChoice))) redraw('.explain');
      })
  );
  const input = main.querySelector('#sim-debrief'),
    complete = main.querySelector('#sim-complete');
  if (input && !record.completedAt)
    input.oninput = () => {
      if (StudyStorage.paused) return;
      record.debrief = input.value;
      saveNeuroProg();
      complete.disabled = !record.debrief.trim();
    };
  if (complete)
    complete.onclick = () => {
      if (neuroCompleteSim(record)) {
        if (opts.onDone) opts.onDone(true);
        else redraw('.nx-lab-close');
      }
    };
  const back = main.querySelector('#sim-back');
  if (back) back.onclick = () => (opts.onDone ? opts.onDone(true) : renderNeuroSimLibrary());
  if (opts.mount) {
    const mount = typeof opts.mount === 'string' ? document.querySelector(opts.mount) : opts.mount;
    mount?.appendChild(main);
  } else {
    const root = el('<div></div>');
    root.appendChild(topbar('neuro'));
    root.appendChild(main);
    setView(root);
  }
}

/* ---------- NeuroCode Lab (guided sandbox) ---------- */

function neuroCodeHasActivity(codeId) {
  const saved = NEURO_PROG.code[codeId];
  return (
    saved === true ||
    !!(saved?.legacyCompletion || saved?.passed || saved?.latest?.passed || neuroWorkComplete(saved?.current))
  );
}
function neuroNewCodeWork(lesson) {
  return {
    content: JSON.parse(JSON.stringify(lesson)),
    draft: lesson.codeExample.trim(),
    attempts: [],
    support: {},
    startedAt: Date.now(),
  };
}
function neuroCodeLastCheck(work) {
  return work?.attempts?.[work.attempts.length - 1];
}
function neuroValidCodeWork(work) {
  return (
    work &&
    typeof work === 'object' &&
    !Array.isArray(work) &&
    work.content &&
    typeof work.content.id === 'string' &&
    typeof work.content.codeExample === 'string' &&
    typeof work.content.solution === 'string' &&
    typeof work.draft === 'string' &&
    Array.isArray(work.attempts) &&
    work.attempts.every(item => item && typeof item.draft === 'string' && Number.isFinite(item.at)) &&
    work.support &&
    typeof work.support === 'object' &&
    !Array.isArray(work.support) &&
    (work.manualTrace == null || neuroValidTrace(work))
  );
}
function neuroValidTrace(work) {
  const trace = work.manualTrace,
    cases = work.content?.checks?.cases;
  return (
    trace &&
    Array.isArray(cases) &&
    cases.length > 0 &&
    Array.isArray(trace.predictions) &&
    trace.predictions.length === Math.min(2, cases.length) &&
    trace.predictions.every(value => typeof value === 'string') &&
    typeof trace.comparison === 'string' &&
    Number.isFinite(trace.openedAt) &&
    (trace.revealedAt == null ||
      (Number.isFinite(trace.revealedAt) && trace.predictions.every(value => value.trim()))) &&
    (trace.completedAt == null ||
      (Number.isFinite(trace.completedAt) && !!trace.revealedAt && !!trace.comparison.trim()))
  );
}
function neuroManualTraceComplete(work) {
  return !!(work?.manualTrace?.completedAt && neuroValidTrace(work));
}
function neuroWorkComplete(work) {
  const last = neuroCodeLastCheck(work);
  return !!(
    work &&
    ((last?.passed && last.draft === work.draft) ||
      (typeof work.selfReview?.draft === 'string' && work.selfReview.draft === work.draft) ||
      neuroManualTraceComplete(work))
  );
}
function neuroCodeEvidenceLabel(work) {
  const last = neuroCodeLastCheck(work);
  if (last?.passed && last.draft === work.draft) return last.message;
  if (neuroManualTraceComplete(work))
    return 'Manual trace completed. The current editor draft has not passed Python checks.';
  if (typeof work?.selfReview?.draft === 'string' && work.selfReview.draft === work.draft)
    return 'Written self-review completed; no automatic grade assigned.';
  return last?.message || 'No Python check recorded.';
}
function neuroCodeEntry(codeId) {
  const old = NEURO_PROG.code[codeId];
  if (!old || typeof old !== 'object') NEURO_PROG.code[codeId] = { legacyCompletion: old === true };
  return NEURO_PROG.code[codeId];
}
/* The exercise editor is a textarea with a painted copy of its text underneath. The copy carries
   the Python colors and the line numbers; the textarea, its own text transparent, carries the caret
   and the typing. The two have to wrap identically, so the painted mode is used only where that can
   be relied on (a mouse or trackpad, not iOS) and is dropped for good the moment the textarea needs
   more room than the copy gives it. Everywhere else the editor is the plain textarea. */
const NEURO_PY_WORDS =
  /^(?:def|return|if|elif|else|for|while|in|not|and|or|import|from|as|lambda|class|try|except|finally|raise|with|pass|break|continue|is|assert|global|nonlocal|yield|del|None|True|False)$/;
function neuroPyHighlight(code) {
  const token =
    /(#[^\n]*)|("""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|\b(\d[\d_]*(?:\.[\d_]+)?(?:[eE][+-]?\d+)?)\b|\b([A-Za-z_]\w*)\b/g;
  const lines = [''];
  const put = (text, kind) => {
    text.split('\n').forEach((part, i) => {
      if (i) lines.push('');
      if (part) lines[lines.length - 1] += kind ? `<span class="${kind}">${esc(part)}</span>` : esc(part);
    });
  };
  let at = 0,
    match;
  while ((match = token.exec(code))) {
    if (!match[0]) {
      token.lastIndex++;
      continue;
    }
    put(code.slice(at, match.index));
    put(
      match[0],
      match[1] ? 'nx-c' : match[2] ? 'nx-s' : match[3] ? 'nx-n' : NEURO_PY_WORDS.test(match[4]) ? 'nx-k' : ''
    );
    at = token.lastIndex;
  }
  put(code.slice(at));
  return lines.map(line => `<span class="nx-l">${line}</span>`).join('');
}
function neuroEditorRich(host, area, plain) {
  const layer = host?.querySelector('[data-highlight]');
  if (!layer || plain || typeof matchMedia !== 'function' || typeof CSS !== 'object') return () => {};
  if (
    !matchMedia('(pointer: fine)').matches ||
    matchMedia('(forced-colors: active)').matches ||
    CSS.supports('-webkit-touch-callout', 'none')
  )
    return () => {};
  let rich = true,
    queued = false;
  host.classList.add('is-rich');
  // The check below resizes the textarea for an instant; that must never be eased.
  area.style.setProperty('transition', 'none', 'important');
  // The textarea lies over the copy, so its own content height is read with its height set aside
  // for a moment; the two agree when the last painted line ends where the typed text ends.
  const verify = () => {
    queued = false;
    if (!rich || !host.isConnected || !host.offsetWidth) return;
    const held = area.style.height;
    area.style.height = '0';
    const typed = area.scrollHeight - parseFloat(getComputedStyle(area).paddingBottom);
    area.style.height = held;
    area.scrollTop = area.scrollLeft = 0;
    const last = layer.lastElementChild;
    if (last && Math.abs(typed - (last.offsetTop + last.offsetHeight)) <= 2) return;
    rich = false;
    host.classList.remove('is-rich');
    layer.textContent = '';
  };
  // Nothing scrolls inside the textarea in this mode; if a browser nudges it, put it back.
  area.addEventListener('scroll', () => {
    if (rich && (area.scrollTop || area.scrollLeft)) area.scrollTop = area.scrollLeft = 0;
  });
  const paint = () => {
    if (!rich) return;
    layer.innerHTML = neuroPyHighlight(area.value);
    if (queued || typeof requestAnimationFrame !== 'function') return;
    queued = true;
    requestAnimationFrame(verify);
  };
  paint();
  return paint;
}
// The tab on the editor window: the function the exercise asks for, as a file name.
function neuroCodeFile(lesson) {
  const name = lesson?.checks?.function;
  return typeof name === 'string' && /^[A-Za-z_]\w*$/.test(name) ? `${name}.py` : 'exercise.py';
}
function mountNeuroCodeSandbox(lesson, codeId, opts, shell) {
  const entry = neuroCodeEntry(codeId);
  const work = opts.work || (entry.current ||= neuroNewCodeWork(lesson));
  lesson = work.content;
  const last = neuroCodeLastCheck(work);
  const reflection = !lesson.checks && !neuroCodeIsRunnablePython(lesson.solution);
  saveNeuroProg();
  const sandbox = el(`<div class="neuro-sandbox nx-work${reflection ? ' is-written' : ''}">
    <div class="nx-win nx-editor-win">
      <div class="nx-win-bar"><i></i><i></i><i></i><span class="nx-win-tab">${esc(reflection ? 'response.txt' : neuroCodeFile(lesson))}</span>${reflection ? '' : '<span class="neuro-editor-hint mono">Tab indents &middot; Esc then Tab leaves</span>'}</div>
      <label class="nx-sr" for="neuro-code-editor">${reflection ? 'Your explanation' : 'Python editor'}</label>
      <div class="nx-edit" data-editor><pre class="nx-edit-hl" data-highlight aria-hidden="true"></pre><textarea id="neuro-code-editor" class="neuro-code-draft" rows="14" maxlength="40000" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off">${esc(work.draft)}</textarea></div>
      <div class="neuro-sandbox-actions nx-win-foot">${reflection ? '' : '<button class="btn btn-solid" data-run-code title="Run (Ctrl+Enter)" aria-keyshortcuts="Control+Enter Meta+Enter">Run</button><button class="btn" data-stop-code hidden>Stop Python</button>'}<button class="btn" data-check-code>${reflection ? 'Save and compare' : 'Check'}</button>
        <details class="neuro-sandbox-more"><summary class="btn">More</summary><div class="neuro-sandbox-more-inner">
          <button class="btn" data-show-hint>Hint</button><button class="btn" data-show-sol>Reveal solution</button><button class="btn" data-load-sol>Load solution</button><button class="btn" data-reset-code>Reset editor</button>
        </div></details>
        <p class="nx-status" data-py-status role="status">${esc(last?.message || 'Draft saved in this browser.')}</p></div>
    </div>
    <div class="nx-win nx-out-win"${reflection ? ' hidden' : ''}><div class="nx-win-bar"><span class="nx-win-tab">output</span></div><pre class="neuro-code" data-term-log>${esc(last?.stdout || '')}${last?.stderr ? '\n' + esc(last.stderr) : ''}</pre></div>
    <p class="nx-fine nx-how">${lesson.checks ? 'Check runs your function on several input cases. The example printout alone cannot pass.' : reflection ? 'Compare your response with the model; written explanations are not automatically graded.' : 'This draft exercise compares only the example output. It has no tests of other inputs yet.'}</p>
    <div data-check-results></div><div data-extra></div>
    ${lesson.checks ? '<div class="neuro-sandbox-actions nx-work-links"><button class="btn" data-trace-code>Trace without Python</button><button class="btn" data-export-code>Download current code</button></div><div data-manual-trace></div>' : ''}
    <p class="nx-fine" data-gate>${opts.requirePass ? 'Finish this exercise to continue. Results and help used remain in your saved work.' : 'Checks describe only this exercise.'}</p>
    <div class="continue-row" data-continue-row ${opts.requirePass && !neuroWorkComplete(work) ? 'hidden' : ''}><button class="btn btn-solid" data-code-done>Continue</button></div></div>`);
  const draft = sandbox.querySelector('#neuro-code-editor'),
    status = sandbox.querySelector('[data-py-status]');
  const log = sandbox.querySelector('[data-term-log]'),
    extra = sandbox.querySelector('[data-extra]');
  const continueRow = sandbox.querySelector('[data-continue-row]');
  // The More menu closes once something in it is chosen, on Escape, and when focus moves away.
  const more = sandbox.querySelector('.neuro-sandbox-more');
  const closeMore = () => {
    if (!more?.open) return;
    more.open = false;
    more.querySelector('summary').focus({ preventScroll: true });
  };
  if (more) {
    more.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !more.open) return;
      more.open = false;
      more.querySelector('summary').focus();
    });
    more.addEventListener('focusout', event => {
      if (!more.contains(event.relatedTarget)) more.open = false;
    });
  }
  let busy = false,
    continued = false,
    controller;
  const stop = sandbox.querySelector('[data-stop-code]');
  if (stop) stop.onclick = () => controller?.abort();
  const gate = sandbox.querySelector('[data-gate]');
  const refreshGate = () => {
    continueRow.hidden = !!opts.requirePass && !neuroWorkComplete(work);
    if (opts.requirePass) gate.hidden = !continueRow.hidden;
  };
  const saveDraft = () => {
    if (StudyStorage.paused || busy) return;
    work.draft = draft.value;
    saveNeuroProg();
    refreshGate();
  };
  const paint = neuroEditorRich(sandbox.querySelector('[data-editor]'), draft, reflection);
  draft.oninput = () => {
    paint();
    saveDraft();
  };
  if (!reflection) neuroEditorKeys(draft, () => execute(false));
  function showFeedback(feedback) {
    if (!feedback) return;
    status.textContent = feedback.message;
    log.textContent = [feedback.stdout, feedback.stderr].filter(Boolean).join('\n');
    sandbox.querySelector('[data-check-results]').innerHTML =
      `${feedback.explanation ? `<p>${esc(feedback.explanation)}</p>` : ''}${feedback.cases ? `<ol class="nx-cases">${feedback.cases.map((item, i) => `<li class="${item.passed ? 'ok' : 'no'}"><b>Case ${i + 1}: ${item.passed ? 'passed' : 'needs work'}</b> · expected <code>${esc(item.expected)}</code>, received <code>${esc(item.actual)}</code>${item.argsPreserved === false ? ' · input was changed' : ''}</li>`).join('')}</ol>` : ''}`;
  }
  function showSupport() {
    extra.innerHTML = `${work.support.hintAt ? `<p class="sochint">${esc(lesson.hint)}</p>` : ''}${work.support.solutionAt ? `<details open><summary>Authored solution · consulted</summary><pre class="neuro-code">${esc(lesson.solution)}</pre><p>Loading or reading the model is recorded as support used.</p></details>` : ''}`;
    if (work.comparedDraft != null && reflection) {
      const button = el('<button class="btn" type="button">I compared my explanation with the model</button>');
      button.onclick = () => {
        if (StudyStorage.paused || busy || work.draft !== work.comparedDraft) return;
        work.selfReview ||= { draft: work.draft, at: Date.now() };
        if (work.selfReview.draft !== work.draft) work.selfReview = { draft: work.draft, at: Date.now() };
        if (saveNeuroProg()) {
          status.textContent = 'Self-review recorded. No automatic grade was assigned.';
          refreshGate();
        }
      };
      extra.appendChild(button);
    }
  }
  function showTrace() {
    const trace = work.manualTrace,
      host = sandbox.querySelector('[data-manual-trace]');
    if (!trace || !host) return;
    const cases = lesson.checks.cases.slice(0, 2),
      revealed = !!trace.revealedAt,
      done = !!trace.completedAt;
    host.innerHTML = `<section class="neuro-block"><h3>Manual trace of the authored exercise</h3>
      <p>Predict the intended function result for each input, then compare with the reference cases. This activity works without Python. It records a manual comparison; it does not execute or pass your editor code.</p>
      ${cases
        .map(
          (
            item,
            i
          ) => `<label for="trace-prediction-${i}">Input ${i + 1}: <code>${esc(JSON.stringify(item.args))}</code></label><textarea class="neuro-code-draft" id="trace-prediction-${i}" data-trace-prediction="${i}" rows="2" maxlength="4000" ${revealed ? 'readonly' : ''}>${esc(trace.predictions[i])}</textarea>
        ${revealed ? `<p>Authored result: <code>${esc(item.raises ? item.raises : JSON.stringify(item.expected))}</code></p>` : ''}`
        )
        .join('')}
      ${
        revealed
          ? `<label for="trace-comparison">Explain one intermediate step or a difference between your prediction and the model.</label><textarea class="neuro-code-draft" id="trace-comparison" rows="4" maxlength="12000" ${done ? 'readonly' : ''}>${esc(trace.comparison)}</textarea>
        ${done ? '<p role="status">Manual comparison saved. Python pass remains separate.</p>' : '<button class="btn" id="trace-complete">Save manual comparison</button>'}`
          : '<button class="btn" id="trace-reveal">Save predictions and compare</button>'
      }</section>`;
    const reveal = host.querySelector('#trace-reveal');
    if (reveal) {
      reveal.disabled = !trace.predictions.every(value => value.trim());
      host.querySelectorAll('[data-trace-prediction]').forEach(
        input =>
          (input.oninput = () => {
            if (StudyStorage.paused || busy) return;
            trace.predictions[Number(input.dataset.tracePrediction)] = input.value;
            saveNeuroProg();
            reveal.disabled = !trace.predictions.every(value => value.trim());
          })
      );
      reveal.onclick = () => {
        if (StudyStorage.paused || busy || trace.revealedAt || !trace.predictions.every(value => value.trim())) return;
        trace.revealedAt = Date.now();
        if (saveNeuroProg()) showTrace();
      };
    }
    const comparison = host.querySelector('#trace-comparison'),
      complete = host.querySelector('#trace-complete');
    if (complete) {
      complete.disabled = !trace.comparison.trim();
      comparison.oninput = () => {
        if (StudyStorage.paused || busy) return;
        trace.comparison = comparison.value;
        saveNeuroProg();
        complete.disabled = !trace.comparison.trim();
      };
      complete.onclick = () => {
        if (StudyStorage.paused || busy || !trace.revealedAt || !trace.comparison.trim()) return;
        trace.completedAt ||= Date.now();
        if (saveNeuroProg()) {
          showTrace();
          refreshGate();
          status.textContent = neuroCodeEvidenceLabel(work);
        }
      };
    }
  }
  async function execute(check) {
    if (busy || StudyStorage.paused) return;
    busy = true;
    draft.readOnly = true;
    controller = new AbortController();
    sandbox.querySelectorAll('button').forEach(button => (button.disabled = true));
    sandbox.querySelectorAll('[data-manual-trace] textarea').forEach(input => (input.disabled = true));
    if (stop) {
      stop.hidden = false;
      stop.disabled = false;
    }
    const submitted = work.draft;
    status.textContent = check ? 'Checking…' : 'Running Python…';
    const runtimeOptions = {
      signal: controller.signal,
      onOutput: output => {
        log.textContent = [output.stdout, output.stderr].filter(Boolean).join('\n');
      },
    };
    try {
      if (check) {
        const feedback = await neuroCodeEvaluateOJT(
          submitted,
          lesson,
          text => (status.textContent = text),
          runtimeOptions
        );
        if (StudyStorage.paused) return;
        work.attempts.push({ ...feedback, draft: submitted, at: Date.now(), support: { ...work.support } });
        if (feedback.needsSelfReview) {
          work.comparedDraft = submitted;
          work.support.solutionAt ||= Date.now();
        }
        if (feedback.passed) {
          work.completedAt ||= Date.now();
          entry.latest = { passed: true, revision: lesson.revision || 1, mode: feedback.mode, at: work.completedAt };
        }
        saveNeuroProg();
        showFeedback(feedback);
        showSupport();
      } else {
        const result = await runPythonCode(submitted, {
          ...runtimeOptions,
          onStatus: text => (status.textContent = text),
        });
        if (StudyStorage.paused) return;
        work.lastRun = { ...result, draft: submitted, at: Date.now() };
        saveNeuroProg();
        status.textContent = result.ok
          ? 'Run complete. Use Check to test the exercise.'
          : result.reason === 'stopped'
            ? 'Python stopped. Your draft is retained.'
            : 'Python could not complete this run.';
        log.textContent = [result.stdout, result.stderr].filter(Boolean).join('\n');
      }
    } catch (error) {
      status.textContent = 'Python could not finish. Your draft is retained; retry when available.';
      log.textContent = error.message || String(error);
    } finally {
      busy = false;
      controller = null;
      draft.readOnly = false;
      sandbox.querySelectorAll('button').forEach(button => (button.disabled = false));
      if (stop) stop.hidden = true;
      showTrace();
      refreshGate();
      // The buttons were disabled while Python ran, which drops keyboard focus; hand it back.
      const starter = check ? sandbox.querySelector('[data-check-code]') : run;
      if (starter && (!document.activeElement || document.activeElement === document.body))
        starter.focus({ preventScroll: true });
      if (check)
        (continueRow.hidden ? sandbox.querySelector('[data-check-results]') : continueRow).scrollIntoView({
          behavior: 'auto',
          block: 'nearest',
        });
    }
  }
  const run = sandbox.querySelector('[data-run-code]');
  if (run) run.onclick = () => execute(false);
  const traceButton = sandbox.querySelector('[data-trace-code]');
  if (traceButton)
    traceButton.onclick = () => {
      if (StudyStorage.paused || busy) return;
      work.manualTrace ||= {
        predictions: lesson.checks.cases.slice(0, 2).map(() => ''),
        comparison: '',
        openedAt: Date.now(),
      };
      work.support.traceAt ||= Date.now();
      if (saveNeuroProg()) showTrace();
    };
  const exportCode = sandbox.querySelector('[data-export-code]');
  if (exportCode)
    exportCode.onclick = () => {
      const url = URL.createObjectURL(
        new Blob([`# ${lesson.title}\n# Synthetic Cortex exercise; no clinical device control.\n\n${work.draft}\n`], {
          type: 'text/x-python',
        })
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = lesson.id + '.py';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  sandbox.querySelector('[data-check-code]').onclick = () => execute(true);
  sandbox.querySelector('[data-reset-code]').onclick = () => {
    closeMore();
    if (StudyStorage.paused || busy) return;
    work.previousDraft = work.draft;
    draft.value = lesson.codeExample.trim();
    paint();
    saveDraft();
    status.textContent = 'Starter restored. The preceding draft is retained in recovery data.';
  };
  sandbox.querySelector('[data-show-hint]').onclick = () => {
    closeMore();
    if (StudyStorage.paused || busy) return;
    work.support.hintAt ||= Date.now();
    saveNeuroProg();
    showSupport();
  };
  sandbox.querySelector('[data-show-sol]').onclick = () => {
    closeMore();
    if (StudyStorage.paused || busy) return;
    work.support.solutionAt ||= Date.now();
    saveNeuroProg();
    showSupport();
  };
  sandbox.querySelector('[data-load-sol]').onclick = () => {
    closeMore();
    if (StudyStorage.paused || busy) return;
    work.previousDraft = work.draft;
    work.support.solutionAt ||= Date.now();
    draft.value = lesson.solution.trim();
    paint();
    saveDraft();
    showSupport();
  };
  sandbox.querySelector('[data-code-done]').onclick = () => {
    if (continued || busy || StudyStorage.paused || (opts.requirePass && !neuroWorkComplete(work))) return;
    continued = true;
    if (opts.onDone) opts.onDone(neuroWorkComplete(work));
    else if (!opts.mount) renderNeuroCodeLab();
  };
  showFeedback(last);
  showSupport();
  showTrace();
  refreshGate();
  shell.appendChild(sandbox);
}

function renderNeuroCode(codeId, opts = {}) {
  const lesson = opts.lesson || NEURO_PROG.code[codeId]?.current?.content || neuroCode(codeId);
  if (!opts.mount) neuroRoute(null, null, codeId);
  if (!lesson) {
    if (opts.onDone) opts.onDone(false);
    else renderNeuroEngineering();
    return;
  }

  const reflection =
    !lesson.checks && typeof neuroCodeIsRunnablePython === 'function' && !neuroCodeIsRunnablePython(lesson.solution);
  const heading = opts.mount ? ['h2', 'neuro-h2'] : ['h1', 'neuro-h1'];
  const brief = `<div class="nx-ex-brief">
      <span class="neuro-eyebrow">NeuroCode &middot; ${esc(lesson.codingConcept)}</span>
      <${heading[0]} class="${heading[1]}">${esc(lesson.title)}</${heading[0]}>
      <div class="neuro-block"><span class="label">Concept</span><p class="neuro-prose">${esc(lesson.explanation)}</p>
        <p class="nx-tags"><span>${esc(lesson.codingConcept)}</span><span>${esc(lesson.neuroengineeringConcept)}</span></p></div>
      ${neuroSeriesMarkup(lesson.series)}
      <div class="neuro-block nx-task"><span class="label">${reflection ? 'Your prompt' : 'Your task'}</span><p class="neuro-prose">${esc(lesson.challengePrompt)}</p></div>
      ${lesson.checks ? '<details><summary>New to Python functions?</summary><p>A function starts with def, followed by its name and inputs in parentheses. Indented lines form its body. return sends a result back to the caller; print only displays a value. A list stores values in order, and its first index is 0. Replace the marked starter lines, run an example, then use Check to call your function with several inputs.</p><p><a href="/neuro?view=python" data-neuro-python>Never coded? Read Python in five minutes.</a></p></details>' : ''}
      ${lesson.sources?.length ? `<details class="nx-sources"><summary>Sources</summary><ul>${lesson.sources.map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)}</a></li>`).join('')}</ul></details>` : ''}
      ${opts.mount ? '' : `<p class="neuro-master"><span class="label">In one line</span>${esc(lesson.oneLineMaster)}</p>`}
    </div>`;

  if (opts.mount) {
    const mount = typeof opts.mount === 'string' ? document.querySelector(opts.mount) : opts.mount;
    if (!mount) {
      if (opts.onDone) opts.onDone(false);
      return;
    }
    const wrap = el(`<section class="neuro-stage neuro-embed nx-stage nx-s-code nx-ex">${brief}</section>`);
    mount.appendChild(wrap);
    neuroBindLinks(wrap);
    mountNeuroCodeSandbox(lesson, codeId, opts, wrap);
    return;
  }

  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner nx-bench nx-codepage">
    <section class="neuro-body">
      <button class="backbtn topback" id="neback">&larr; Back to NeuroCode Lab</button>
      <div class="nx-ex">${brief}</div>
    </section>
  </main>`);
  main.querySelector('#neback').addEventListener('click', renderNeuroCodeLab);
  neuroBindLinks(main);
  mountNeuroCodeSandbox(lesson, codeId, opts, main.querySelector('.nx-ex'));
  root.appendChild(main);
  setView(root);
}

function renderNeuroCodeLab() {
  neuroRoute(null, null, null, 'code');
  const lessons = NEURO.data?.neuroCodeLessons || [];
  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner">
    <section class="neuro-body">
      <button class="backbtn topback" id="neback">&larr; Back to Neuroengineering</button>
      <span class="neuro-eyebrow">NeuroCode Lab</span>
      <h1 class="neuro-h1">Guided code practice.</h1>
      <p class="neuro-lede">${lessons.length} short Python exercises. Each one runs in your browser and is checked against several inputs, not just the printed example. No Python available? Every exercise also has a trace-by-hand mode.</p>
      <div class="neuro-rows" id="necodelab"></div>
    </section>
  </main>`);
  main.querySelector('#neback').addEventListener('click', renderNeuroEngineering);
  const rows = main.querySelector('#necodelab');
  for (const lesson of lessons) {
    const done = neuroCodeHasActivity(lesson.id);
    const row = el(`<button class="neuro-row">
      <span class="neuro-row-main"><span class="neuro-row-title">${esc(lesson.title)}</span>
      <span class="neuro-row-sub">${esc(lesson.codingConcept)} &middot; ${esc(lesson.difficulty || 'beginner')}</span></span>
      <span class="neuro-row-right">${done ? '<span class="pill">started</span>' : ''}</span>
    </button>`);
    row.addEventListener('click', () => renderNeuroCode(lesson.id));
    rows.appendChild(row);
  }
  root.appendChild(main);
  setView(root);
}

function renderNeuroSimLibrary() {
  neuroRoute(null, null, null, 'sims');
  const sims = NEURO.data?.simulations || [],
    live = sims.filter(neuroLabInstrument).length;
  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner">
    <section class="neuro-body">
      <button class="backbtn topback" id="neback">&larr; Back to Neuroengineering</button>
      <span class="neuro-eyebrow">NeuroSim Lab</span>
      <h1 class="neuro-h1">Decision labs.</h1>
      <p class="neuro-lede">${sims.length} short decision labs. Read the scenario, pick the best next step, then compare your answer with the model.${live ? ` ${live} have a plot you can adjust.` : ''}</p>
      <div class="neuro-rows" id="nesimlib"></div>
    </section>
  </main>`);
  main.querySelector('#neback').addEventListener('click', renderNeuroEngineering);
  const rows = main.querySelector('#nesimlib');
  for (const sim of sims) {
    const prev = NEURO_PROG.simWork[sim.id];
    const row = el(`<button class="neuro-row">
      <span class="neuro-row-main"><span class="neuro-row-title">${esc(sim.title)}</span>
      <span class="neuro-row-sub neuro-row-sub--sentence">${esc(sim.oneLineMaster)}</span></span>
      <span class="neuro-row-right">${neuroLabInstrument(sim) ? '<span class="pill nx-live-pill">adjustable</span>' : ''}${prev ? `<span class="pill">${prev.completedAt ? 'done' : 'resume'}</span>` : NEURO_PROG.sims[sim.id] ? '<span class="pill">started</span>' : ''}</span>
    </button>`);
    row.addEventListener('click', () => renderNeuroSim(sim.id));
    rows.appendChild(row);
  }
  root.appendChild(main);
  setView(root);
}

/* ---------- BCI Builder: saved, authored unit work ---------- */
let neUnit = null;
const UNIT_STAGE_LABELS = {
  lesson: 'Lesson',
  recall: 'Active recall',
  quiz: 'Quick check',
  code: 'NeuroCode',
  sim: 'NeuroSim',
  debrief: 'Debrief',
};
const neuroClone = value => JSON.parse(JSON.stringify(value));

function neuroRoute(unit, stage, code, view, sim, extra = {}) {
  const url = new URL(sectionUrl('neuro'), location.origin);
  if (unit) {
    url.searchParams.set('unit', unit);
    url.searchParams.set('stage', stage);
  }
  if (code) url.searchParams.set('code', code);
  if (sim) url.searchParams.set('sim', sim);
  if (view) url.searchParams.set('view', view);
  for (const key of ['module', 'topic', 'subject']) if (extra[key]) url.searchParams.set(key, extra[key]);
  if (location.pathname + location.search === url.pathname + url.search) return;
  const previous = new URLSearchParams(location.search);
  const same = ['unit', 'code', 'sim', 'view', 'module', 'topic', 'subject'].every(
    key => previous.get(key) === url.searchParams.get(key)
  );
  history[same ? 'replaceState' : 'pushState']({}, '', url.pathname + url.search);
}
/* 2.37.0 merged orientation, short lesson, mental model and worked example into one Lesson stage.
   Older saved units move their stage index back by three once they are past those four stages. */
function neuroMigrateUnit(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record) || record.layout === 2) return;
  if (record.content?.unit && Number.isInteger(record.stageIdx))
    record.stageIdx = record.stageIdx >= 4 ? record.stageIdx - 3 : 0;
  record.layout = 2;
}
function neuroStageKeys(content) {
  return [
    'lesson',
    ...(content.unit ? ['recall'] : []),
    ...(content.checks.length ? ['quiz'] : []),
    ...(content.code ? ['code'] : []),
    ...(content.sim ? ['sim'] : []),
    'debrief',
  ];
}
function neuroValidUnit(record) {
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  if (
    !object(record) ||
    !object(record.content) ||
    !object(record.content.step) ||
    !Array.isArray(record.content.checks) ||
    !Array.isArray(record.recall) ||
    !object(record.answers) ||
    !Number.isInteger(record.stageIdx) ||
    record.stageIdx < 0 ||
    record.stageIdx > neuroStageKeys(record.content).length ||
    !Number.isInteger(record.recallIdx) ||
    record.recallIdx < 0 ||
    record.recallIdx > (record.content.unit?.activeRecallPrompts?.length || 0) ||
    !Number.isFinite(record.startedAt) ||
    (record.codeWork != null && !neuroValidCodeWork(record.codeWork)) ||
    (record.debrief != null && typeof record.debrief !== 'string') ||
    (record.completedAt != null &&
      (!Number.isFinite(record.completedAt) || record.stageIdx !== neuroStageKeys(record.content).length))
  )
    return false;
  if (record.recall.some(item => !object(item) || (item.draft != null && typeof item.draft !== 'string'))) return false;
  const choices = [
    ...record.content.checks,
    ...(record.content.sim ? [{ id: 'simulation', choices: record.content.sim.choices }] : []),
  ];
  return neuroValidAnswers(record.answers, choices);
}
function neuroValidAnswers(answers, choices) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return false;
  return Object.entries(answers).every(([id, answer]) => {
    const question = choices.find(item => item.id === id);
    return (
      question &&
      answer &&
      typeof answer === 'object' &&
      !Array.isArray(answer) &&
      Array.isArray(answer.order) &&
      answer.order.length === question.choices.length &&
      new Set(answer.order).size === answer.order.length &&
      answer.order.every(i => Number.isInteger(i) && i >= 0 && i < question.choices.length) &&
      (answer.chosen == null || (Number.isInteger(answer.chosen) && answer.order.includes(answer.chosen)))
    );
  });
}
function neuroUnitRecord(step) {
  if (NEURO_PROG.units[step.id]) return NEURO_PROG.units[step.id];
  const topic = neuroTopic(step.topicId),
    unit = neuroUnitLesson(step.order);
  const content = neuroClone({
    step,
    unit: unit || null,
    topic: topic || null,
    checks: unit?.checks || topic?.quizQuestions?.slice(0, 2) || [],
    code: neuroCode(step.neuroCodeLessonId) || null,
    sim: unit?.simulation || neuroSim(step.simulationId) || null,
  });
  const record = {
    layout: 2,
    content,
    stageIdx: 0,
    recallIdx: 0,
    recall: [],
    answers: {},
    debrief: '',
    startedAt: Date.now(),
  };
  NEURO_PROG.units[step.id] = record;
  NEURO_PROG.pathStarted = true;
  saveNeuroProg();
  return record;
}
function neuroAnswerRecord(record, question) {
  if (!record.answers[question.id]) {
    const order = question.choices.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    record.answers[question.id] = { order };
    saveNeuroProg();
  }
  return record.answers[question.id];
}
function neuroChoose(record, question, choice) {
  if (StudyStorage.paused || record.completedAt) return false;
  const answer = neuroAnswerRecord(record, question);
  if (answer.chosen != null || !answer.order.includes(choice)) return false;
  answer.chosen = choice;
  answer.answeredAt = Date.now();
  return saveNeuroProg();
}
function neuroUnitReady(record) {
  const stage = neuroStageKeys(record.content)[record.stageIdx];
  if (stage === 'recall')
    return (record.content.unit?.activeRecallPrompts || []).every((_, i) => record.recall[i]?.revealedAt);
  if (stage === 'quiz') return record.content.checks.every(q => record.answers[q.id]?.chosen != null);
  if (stage === 'sim') return record.answers.simulation?.chosen != null;
  if (stage === 'code') return neuroWorkComplete(record.codeWork);
  return true;
}
function neuroUnitAdvance(record, expectedStage) {
  if (
    StudyStorage.paused ||
    record.completedAt ||
    neuroStageKeys(record.content)[record.stageIdx] !== expectedStage ||
    !neuroUnitReady(record)
  )
    return false;
  record.stageIdx++;
  if (record.stageIdx === neuroStageKeys(record.content).length) {
    record.completedAt ||= Date.now();
    if (!NEURO_PROG.pathDone.includes(record.content.step.id)) NEURO_PROG.pathDone.push(record.content.step.id);
  }
  return saveNeuroProg();
}
function neuroUnitStages() {
  return neUnit ? neuroStageKeys(neUnit.record.content) : [];
}
/* The unit's progress rail is a synthetic trace with one spike per stage. The spikes sit at the
   centre of each stage's column, so the markers drawn above them in HTML line up at any width. */
function neuroRailPath(count, seed) {
  const width = 1200,
    y = 42,
    amp = 28,
    step = 6,
    rand = neuroRng(seed);
  const spikes = Array.from({ length: count }, (_, i) => ((i + 0.5) * width) / count);
  const pts = [];
  let v = 0,
    next = 0;
  for (let x = 0; x <= width; x += step) {
    v = 0.55 * v + rand.gauss(0, amp * 0.09);
    while (next < spikes.length && spikes[next] <= x) {
      const at = spikes[next++],
        last = pts.length ? pts[pts.length - 1][0] : -1;
      pts.push(
        [Math.max(at - 1.6, last + 0.2), y + v],
        [at, y - amp],
        [at + 1.8, y + amp * 0.4],
        [at + 3.4, y + v * 0.5]
      );
    }
    if (!pts.length || pts[pts.length - 1][0] < x) pts.push([x, y + v]);
  }
  return 'M' + pts.map(pt => `${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join(' L');
}
function neuroRailMarkup(stages, seed) {
  const d = neuroRailPath(stages.length, seed);
  const trace = name =>
    `<svg class="nx-rail-trace ${name}" viewBox="0 0 1200 64" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="${d}" fill="none" vector-effect="non-scaling-stroke"/></svg>`;
  return `<div class="nx-rail" id="neunitrail" style="--nx-stages:${stages.length}">
      <div class="nx-rail-head"><span class="nx-rail-title">Unit progress</span><span class="nx-rail-now" id="neunitlab" role="status"></span></div>
      <div class="nx-rail-track">${trace('nx-rail-base')}${trace('nx-rail-live')}
        <ol class="nx-rail-steps" aria-label="Stages in this unit">${stages
          .map(
            (key, i) =>
              `<li data-rail-step><span class="nx-rail-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="nx-rail-name">${esc(UNIT_STAGE_LABELS[key])}</span><span class="nx-sr"></span></li>`
          )
          .join('')}</ol>
      </div></div>`;
}
function renderNeuroUnit(stepId) {
  const step = neuroPath()?.steps.find(item => item.id === stepId);
  if (!step) return renderNeuroEngineering();
  const record = neuroUnitRecord(step);
  neUnit = { record, step: record.content.step };
  const stage = neuroStageKeys(record.content)[record.stageIdx] || 'complete';
  neuroRoute(step.id, stage);
  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const module = neuroModuleOf(step),
    subject = neuroSubject(step.subjectId),
    number = neuroUnitNumber(step);
  const main = el(`<main class="neuro-page neuro-inner nx-bench nx-unit"><section class="neuro-body">
    <header class="nx-unit-head">
      <button class="backbtn topback" id="neback">&larr; Back to Neuroengineering</button>
      <span class="neuro-eyebrow">${module ? `Module ${module.index} &middot; ${esc(module.title)} &middot; ` : ''}Unit ${number} / ${neuroPath().steps.length}</span>
      <h1 class="neuro-h1">${esc(record.content.step.title)}</h1>
      <p class="neuro-unit-sub">${esc(step.explanation || '')}</p>
      <p class="neuro-unit-meta mono">${esc(step.estimatedFocus || '')}${subject ? ` &middot; ${esc(subject.name)}` : ''}</p>
      ${module ? `<div class="nx-unit-art">${neuroModuleArt(module.index)}</div>` : ''}
    </header>
    ${neuroRailMarkup(neuroStageKeys(record.content), 4100 + number)}
    <div id="neunitstages" tabindex="-1"></div>${neuroAboutLine()}</section></main>`);
  main.querySelector('#neback').onclick = () => renderNeuroEngineering();
  neuroBindLinks(main);
  root.appendChild(main);
  setView(root);
  neuroUnitAppend();
}
function neuroUnitProgress() {
  const record = neUnit.record,
    stages = neuroUnitStages(),
    done = !!record.completedAt;
  const rail = document.getElementById('neunitrail');
  // The lit part of the trace runs to the spike of the stage in progress.
  rail.style.setProperty(
    '--nx-progress',
    `${(100 * (done ? 1 : (record.stageIdx + 0.5) / stages.length)).toFixed(2)}%`
  );
  rail.classList.toggle('is-complete', done);
  rail.querySelectorAll('[data-rail-step]').forEach((item, i) => {
    const state = done || i < record.stageIdx ? 'done' : i === record.stageIdx ? 'now' : 'next';
    item.dataset.state = state;
    if (state === 'now') item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
    item.querySelector('.nx-sr').textContent = state === 'done' ? ' (done)' : state === 'now' ? ' (in progress)' : '';
  });
  rail.closest('main').dataset.stage = done ? 'complete' : stages[record.stageIdx];
  document.getElementById('neunitlab').textContent = done
    ? 'Complete'
    : `Stage ${record.stageIdx + 1} / ${stages.length} · ${UNIT_STAGE_LABELS[stages[record.stageIdx]]}`;
}
/* Where a stage is shown for the first time it comes in from below, the page jumps to the rail
   (the stage before it may have been several screens long) and keyboard focus moves to the stage.
   A redraw of the same stage (an answer chosen, a hint opened) keeps the page where it is and puts
   focus on what just appeared. */
function neuroUnitArrive(node, key, focus) {
  const container = document.getElementById('neunitstages');
  const first = neUnit.shown == null,
    changed = neUnit.shown !== key;
  neUnit.shown = key;
  if (first) return;
  if (changed) {
    node.classList.add('is-entering');
    const rail = document.getElementById('neunitrail'),
      top = rail.getBoundingClientRect().top;
    if (top < 76 || top > innerHeight * 0.4) rail.scrollIntoView({ behavior: 'auto', block: 'start' });
    container.focus({ preventScroll: true });
    return;
  }
  const target = focus && node.querySelector(focus);
  if (target) {
    if (!target.matches('button, textarea, input, a[href], summary')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
}
// Prose from the course file: a blank line starts a new paragraph.
function neuroParas(text, cls = '') {
  return String(text || '')
    .split(/\n\s*\n/)
    .filter(part => part.trim())
    .map(part => `<p${cls ? ` class="${cls}"` : ''}>${esc(part.trim())}</p>`)
    .join('');
}
// A worked example is a chain of short statements, so it is set as numbered steps when it has several.
function neuroSentences(text) {
  const source = String(text || '').trim(),
    boundary = /[.!?]\s+(?=[A-Z[("“])/g,
    out = [];
  let from = 0,
    match;
  while ((match = boundary.exec(source))) {
    out.push(source.slice(from, match.index + 1));
    from = boundary.lastIndex;
  }
  if (from < source.length) out.push(source.slice(from));
  return out;
}
function neuroStepsMarkup(text) {
  const parts = neuroSentences(text);
  return parts.length < 3
    ? `<p class="neuro-prose">${esc(text)}</p>`
    : `<ol class="nx-steps">${parts.map(part => `<li>${esc(part)}</li>`).join('')}</ol>`;
}
function neuroUnitAppend(focus) {
  const record = neUnit.record,
    { step, unit, checks, code, sim } = record.content;
  const stages = neuroStageKeys(record.content),
    stage = stages[record.stageIdx];
  neuroRoute(step.id, stage || 'complete');
  neuroUnitProgress();
  const container = document.getElementById('neunitstages');
  container.replaceChildren();
  if (record.completedAt) return neuroUnitFinish();
  const advance = () => {
    if (neuroUnitAdvance(record, stage)) neuroUnitAppend();
  };
  const upNext = stages[record.stageIdx + 1],
    nextNote = upNext ? `Next &middot; ${esc(UNIT_STAGE_LABELS[upNext])}` : '';
  const show = (node, key = stage) => {
    container.appendChild(node);
    neuroUnitArrive(node, key, focus);
  };
  if (stage === 'code') {
    record.codeWork ||= neuroNewCodeWork(code);
    saveNeuroProg();
    renderNeuroCode(code.id, {
      lesson: code,
      work: record.codeWork,
      mount: container,
      requirePass: true,
      onDone: advance,
    });
    if (container.firstElementChild) neuroUnitArrive(container.firstElementChild, stage, focus);
    return;
  }
  if (stage === 'quiz' || stage === 'sim') {
    const questions =
      stage === 'quiz'
        ? checks
        : [
            {
              id: 'simulation',
              prompt: sim.decisionQuestion,
              choices: sim.choices.map(c => c.label),
              correctIndex: sim.bestAnswerIndex,
            },
          ];
    const ready = neuroUnitReady(record);
    const intro =
      stage === 'sim'
        ? `<h2 class="nx-lab-title">${esc(sim.title)}</h2>${neuroLabBrief(sim, record.answers.simulation?.chosen != null)}`
        : '<p class="nx-stage-note">Your first answer is saved. Read the explanation, then continue.</p>';
    const waiting =
      stage === 'sim' || questions.length === 1 ? 'Choose an answer to continue.' : 'Answer each question to continue.';
    const node = el(
      `<section class="neuro-stage nx-stage nx-s-${stage}"><span class="label">${UNIT_STAGE_LABELS[stage]}</span>${intro}<div id="neuro-unit-questions"></div>
      <div class="nx-stage-foot"><button class="btn btn-solid" id="neuro-unit-next" ${ready ? '' : 'disabled'}>Continue after review</button><span class="nx-stage-next">${ready ? nextNote : waiting}</span></div></section>`
    );
    questions.forEach((question, n) => {
      const answer = neuroAnswerRecord(record, question),
        chosen = answer.chosen,
        right = chosen === question.correctIndex;
      const explanation = stage === 'sim' && chosen != null ? sim.choices[chosen].rationale : question.explanation;
      const item = el(
        `<div class="neuro-block nx-q" data-q="${n}"><span class="nx-q-n">${stage === 'sim' ? 'Decision' : `Question ${n + 1} of ${questions.length}`}</span><p class="q">${esc(question.prompt)}</p><div class="opts">${answer.order.map((index, i) => `<button class="opt ${chosen === index ? (right ? 'correct' : 'wrong') : chosen != null && index === question.correctIndex ? 'is-model' : ''}" data-choice="${index}" ${chosen == null ? '' : 'disabled'}><span class="key">${LETTERS[i]}</span><span>${esc(question.choices[index])}</span></button>`).join('')}</div>${chosen == null ? '' : `<div class="explain ${right ? 'good' : 'bad'}"><b>${right ? 'Correct first answer' : 'First answer needs review'}</b><p>Model answer: ${esc(question.choices[question.correctIndex])}</p><p>${esc(explanation)}</p></div>`}</div>`
      );
      item.querySelectorAll('[data-choice]').forEach(
        button =>
          (button.onclick = () => {
            if (neuroChoose(record, question, Number(button.dataset.choice)))
              neuroUnitAppend(`[data-q="${n}"] .explain`);
          })
      );
      node.querySelector('#neuro-unit-questions').appendChild(item);
    });
    node.querySelector('#neuro-unit-next').onclick = advance;
    if (stage === 'sim') neuroLabBenchMount(node, sim, record.answers.simulation?.chosen != null);
    show(node);
    return;
  }
  if (stage === 'recall') {
    const prompts = unit.activeRecallPrompts || [];
    if (record.recallIdx >= prompts.length) {
      advance();
      return;
    }
    const index = record.recallIdx,
      prompt = prompts[index],
      saved = (record.recall[index] ||= { draft: '' }),
      last = index + 1 === prompts.length;
    const node =
      el(`<section class="neuro-stage nx-stage nx-s-recall${saved.revealedAt ? ' is-revealed' : ''}"><span class="label">Active recall ${index + 1}/${prompts.length}</span>
      <p class="nx-stage-note">Answer from memory before you compare. Writing is optional and is never graded.</p>
      <p class="q">${esc(prompt.prompt)}</p>
      <div class="nx-recall-grid">
        <div class="nx-field"><label for="neuro-recall">Your explanation (optional)</label><textarea class="socinput neuro-input" id="neuro-recall" rows="5" maxlength="12000" ${saved.revealedAt ? 'readonly' : ''}>${esc(saved.draft)}</textarea></div>
        ${saved.revealedAt ? `<div class="explain nx-model"><b>Compare with the model</b><p>${esc(prompt.answer)}</p><p class="nx-fine">Your writing is saved without automatic grading.</p></div>` : ''}
      </div>
      ${saved.hintAt && !saved.revealedAt ? `<p class="sochint">${esc(prompt.hint)}</p>` : ''}
      <div class="nx-stage-foot">${
        saved.revealedAt
          ? `<button class="btn btn-solid" id="neuro-recall-next">${last ? 'Continue' : 'Next prompt'}</button><span class="nx-stage-next">${last ? nextNote : `Next &middot; prompt ${index + 2} of ${prompts.length}`}</span>`
          : `<button class="btn btn-solid" id="neuro-recall-reveal">Save and compare</button>${saved.hintAt ? '' : '<button class="btn" id="neuro-recall-hint">Hint</button>'}`
      }</div></section>`);
    node.querySelector('#neuro-recall').oninput = event => {
      if (saved.revealedAt || StudyStorage.paused) return;
      saved.draft = event.target.value;
      saveNeuroProg();
    };
    const hint = node.querySelector('#neuro-recall-hint');
    if (hint)
      hint.onclick = () => {
        if (StudyStorage.paused) return;
        saved.hintAt ||= Date.now();
        if (saveNeuroProg()) neuroUnitAppend('.sochint');
      };
    const reveal = node.querySelector('#neuro-recall-reveal');
    if (reveal)
      reveal.onclick = () => {
        if (StudyStorage.paused) return;
        saved.revealedAt ||= Date.now();
        if (saveNeuroProg()) neuroUnitAppend('.nx-model');
      };
    const next = node.querySelector('#neuro-recall-next');
    if (next)
      next.onclick = () => {
        if (StudyStorage.paused || record.recallIdx !== index) return;
        record.recallIdx++;
        if (saveNeuroProg()) neuroUnitAppend();
      };
    show(node, `recall:${index}`);
    return;
  }
  const topic = stage === 'lesson' ? neuroTopic(step.topicId) : null;
  let body;
  if (stage === 'lesson') {
    const terms = unit?.keyTerms?.length
      ? `<div class="nx-aside-block"><span class="nx-aside-label">Key terms</span><p class="neuro-terms">${unit.keyTerms.map(term => `<span>${esc(term)}</span>`).join('')}</p></div>`
      : '';
    const deeper = topic
      ? `<div class="neuro-deeper nx-aside-block"><span class="label nx-aside-label">Go deeper</span><button class="neuro-deeper-link" type="button" id="neuro-unit-topic">${esc(topic.title)} <span>Reference lesson &middot; vocabulary &middot; ${topic.quizQuestions?.length || 0}-question quiz &middot; Socratic study</span></button></div>`
      : '';
    const sources = unit?.sources?.length
      ? `<details class="nx-aside-block nx-sources"><summary>Sources and scope</summary><ul>${unit.sources.map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)}</a></li>`).join('')}</ul></details>`
      : '';
    body = `<div class="neuro-kv"><span>Objective</span><span>${esc(step.stepObjective)}</span></div>
      <div class="nx-lesson-grid"><div class="nx-lesson-main">${
        unit
          ? `<section class="nx-sec"><h2>Why it matters</h2>${neuroParas(unit.whyItMatters)}</section>
        <section class="nx-sec"><h2>The idea</h2>${neuroParas(unit.shortLesson)}</section>
        <section class="nx-sec nx-sec-model"><h2>Mental model</h2>${neuroParas(unit.mentalModel)}</section>
        <section class="nx-sec nx-sec-worked"><h2>Worked example</h2>${neuroStepsMarkup(unit.workedExample)}
        ${neuroFigureMarkup(unit.figure || neuroUnitLesson(step.order)?.figure)}</section>
        ${unit.commonMistake ? `<section class="nx-sec nx-sec-mistake"><h2>Common mistake</h2>${neuroParas(unit.commonMistake)}</section>` : ''}`
          : `<p>${esc(step.explanation)}</p>`
      }</div>${terms || deeper || sources ? `<aside class="nx-lesson-aside" aria-label="Lesson reference">${terms}${deeper}${sources}</aside>` : ''}</div>`;
  } else
    body = `<p class="q">${esc(step.reflectionQuestion || 'What changed in your understanding?')}</p>
      <div class="nx-field"><label for="neuro-debrief">Your debrief (optional)</label><textarea class="socinput neuro-input" rows="5" id="neuro-debrief" maxlength="12000">${esc(record.debrief)}</textarea></div>`;
  const node = el(
    `<section class="neuro-stage nx-stage nx-s-${stage}"><span class="label">${UNIT_STAGE_LABELS[stage]}</span>${body}
      <div class="nx-stage-foot"><button class="btn btn-solid" id="neuro-unit-next">${stage === 'debrief' ? 'Complete unit' : 'Continue'}</button>${nextNote ? `<span class="nx-stage-next">${nextNote}</span>` : ''}</div></section>`
  );
  const input = node.querySelector('#neuro-debrief');
  if (input)
    input.oninput = event => {
      if (StudyStorage.paused) return;
      record.debrief = event.target.value;
      saveNeuroProg();
    };
  node.querySelector('#neuro-unit-next').onclick = advance;
  node
    .querySelector('#neuro-unit-topic')
    ?.addEventListener('click', () => renderNeuroTopic(step.topicId, { fromUnit: step.id }));
  show(node);
}
function neuroUnitFinish() {
  const record = neUnit.record,
    { step, unit, checks, sim } = record.content;
  if (!record.completedAt) return;
  const correct = checks.filter(q => record.answers[q.id]?.chosen === q.correctIndex).length;
  const steps = neuroPath()?.steps || [],
    index = steps.findIndex(item => item.id === step.id);
  const next = index >= 0 ? steps[index + 1] : null;
  const nextModule = next ? neuroModuleOf(next) : null;
  const newModule = !!nextModule && nextModule.id !== neuroModuleOf(step)?.id;
  const node =
    el(`<section class="neuro-stage nx-stage nx-s-done"><span class="nx-done-mark" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="22.5"/><path d="M14.5 24.5l6.5 6.5 12.5-13.5"/></svg></span>
    <h2>Unit ${index + 1 || step.order} complete</h2>
    <p class="nx-done-take">${esc(step.oneLineMaster)}</p>
    <p class="nx-done-score">${correct}/${checks.length} quick checks correct on the first attempt. Your original responses remain saved.</p>
    <details class="nx-review"><summary>Review saved writing and checks</summary>
    ${(unit?.activeRecallPrompts || []).map((prompt, i) => `<div class="neuro-block"><p><b>${esc(prompt.prompt)}</b></p><p>Your answer: ${esc(record.recall[i]?.draft || '(No written answer)')}</p><p>Model: ${esc(prompt.answer)}</p>${record.recall[i]?.hintAt ? '<p>Hint used</p>' : ''}</div>`).join('')}
    ${checks.map(q => `<div class="neuro-block"><p><b>${esc(q.prompt)}</b></p><p>First answer: ${esc(q.choices[record.answers[q.id]?.chosen] || '(No answer)')}</p><p>${esc(q.explanation)}</p></div>`).join('')}
    ${sim ? `<div class="neuro-block"><h3>${esc(sim.title)}</h3><p>${esc(sim.scenario)}</p><p>${esc(sim.signalDescription)}</p>${neuroSeriesMarkup(sim.series)}<p><b>${esc(sim.decisionQuestion)}</b></p><p>First answer: ${esc(sim.choices[record.answers.simulation?.chosen]?.label || '(No answer)')}</p><p>Model answer: ${esc(sim.choices[sim.bestAnswerIndex]?.label || '')}</p><p>${esc(sim.choices[record.answers.simulation?.chosen]?.rationale || '')}</p></div>` : ''}
    <div class="neuro-block"><p><b>Debrief:</b> ${esc(record.debrief || '(No written debrief)')}</p><p>Coding evidence: ${esc(record.codeWork ? neuroCodeEvidenceLabel(record.codeWork) : 'No code exercise in this unit')}${record.codeWork?.support?.solutionAt ? ' · solution consulted' : ''}</p></div></details>
    <div class="endbtns">${next ? `<button class="btn btn-solid" id="neuro-next-unit">${newModule ? `Next: Module ${nextModule.index} &middot; ${esc(nextModule.title)}` : 'Next unit'}</button>` : ''}<button class="btn" id="neuro-unit-hub">Course hub</button></div></section>`);
  const nextButton = node.querySelector('#neuro-next-unit');
  if (nextButton) nextButton.onclick = () => (newModule ? renderNeuroModule(nextModule.id) : renderNeuroUnit(next.id));
  node.querySelector('#neuro-unit-hub').onclick = () => renderNeuroEngineering();
  document.getElementById('neunitstages').appendChild(node);
  neuroUnitArrive(node, 'complete');
}
window.addEventListener('study-storage-recovered', () => {
  if (location.pathname === new URL(sectionUrl('neuro'), location.origin).pathname)
    renderNeuroEngineering({ fromUrl: true });
});
