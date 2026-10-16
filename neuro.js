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
      ['data/neuro.json?v=9', 'data/neuro-milestones.json?v=5'].map(async file => {
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
/* Code editor: Tab indents, Shift+Tab outdents, Enter keeps indentation. Esc then Tab leaves the editor. */
function neuroEditorKeys(area) {
  let release = false;
  area.addEventListener('keydown', event => {
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

  const main = el(`<main class="neuro-page neuro-hub">
    <section class="neuro-hero">
      <video class="neuro-video" loop muted playsinline preload="none" poster="assets/neuro-bg-poster.jpg?v=1" aria-hidden="true">
        <source src="assets/neuro-bg.mp4?v=2" type="video/mp4">
      </video>
      <div class="neuro-veil"></div>
      <div class="neuro-hero-inner">
        <span class="neuro-eyebrow">Neuroengineering</span>
        <h1>Where the mind meets the machine.</h1>
        <p class="neuro-lede">${modules.length} modules &middot; ${pg.total} units &middot; ${codeN} Python exercises &middot; ${simN} decision labs</p>
        <p>Learn how a brain&ndash;computer interface turns measured neural activity into action by building each piece yourself in Python, right in the browser.</p>
        <p class="neuro-membership">
          <span class="free-pill free-pill--soft">Free</span>
          <span class="neuro-membership-txt">No account, no paywall</span>
        </p>
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
    <section class="neuro-body">
      <div class="neuro-section neuro-foundations">
        <span class="neuro-section-label">Start here &middot; no prerequisites</span>
        <div class="neuro-lablinks neuro-foundations-row">
          <button class="neuro-lablink" id="nf-why">1 &middot; Why BCIs? <span>scope and evidence</span></button>
          <button class="neuro-lablink" id="nf-sci">2 &middot; The science <span>neurons &rarr; signals</span></button>
          <button class="neuro-lablink" id="nf-code">3 &middot; Never coded? <span>Python in 5 minutes</span></button>
          <button class="neuro-lablink" id="nf-track">4 &middot; The Track <span>build the BCI</span></button>
        </div>
        ${NEURO.milestones ? '' : '<p>The optional project list could not load. Foundation lessons remain available.</p><button class="btn" id="neuro-project-retry">Retry project list</button>'}
      </div>
      ${
        path
          ? `<details class="neuro-track" id="ne-track" ${wide ? 'open' : ''}>
        <summary class="neuro-track-summary">
          <span class="neuro-track-head">
            <span class="label">The Track</span>
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
        <span class="neuro-section-label">Topic library &middot; ${subjects.length} subjects &middot; ${topicN} topics</span>
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
    track?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  root.appendChild(main);
  if (typeof siteFooter === 'function') root.appendChild(siteFooter());
  setView(root);

  const nv = root.querySelector('.neuro-video');
  if (nv) {
    nv.muted = true;
    nv.defaultMuted = true;
    nv.setAttribute('muted', '');
    // Decorative motion: skipped on phones, data saver and reduced-motion; the poster stands in.
    const quiet =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !window.matchMedia('(min-width: 768px)').matches ||
      navigator.connection?.saveData;
    if (!quiet) nv.play()?.catch(() => {});
  }
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
    <p>The course is written and maintained by Cortex Medical Academy. ${revised} of ${steps.length} units have been revised line by line against the sources they cite. The rest are first drafts being rewritten to the same standard. No independent subject-matter expert has reviewed the course yet. When one does, this page will say who and when.</p>
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
  return (
    series &&
    typeof series.title === 'string' &&
    typeof series.description === 'string' &&
    typeof series.unit === 'string' &&
    Number.isFinite(series.sampleRateHz) &&
    series.sampleRateHz > 0 &&
    Array.isArray(series.values) &&
    series.values.length > 0 &&
    series.values.length <= maxSamples &&
    series.values.every(Number.isFinite)
  );
}
function neuroSeriesMarkup(series, maxSamples = 128) {
  if (!neuroValidSeries(series, maxSamples)) return '';
  const values = series.values,
    lastTime = (values.length - 1) / series.sampleRateHz;
  const low = Math.min(...values),
    high = Math.max(...values),
    padding = (high - low || 2) * 0.15;
  const min = low - padding,
    max = high + padding;
  const x = i => 110 + (values.length > 1 ? i / (values.length - 1) : 0) * 415;
  const y = value => 190 - ((value - min) / (max - min)) * 150;
  const number = value => String(Number(value.toPrecision(5)));
  const markers = Array.isArray(series.markerIndices)
    ? series.markerIndices.filter(index => Number.isInteger(index) && index >= 0 && index < values.length)
    : [];
  const thresholdVisible = Number.isFinite(series.threshold) && series.threshold >= min && series.threshold <= max;
  return `<figure class="neuro-series"><figcaption><b>${esc(series.title)}</b> · synthetic data</figcaption>
    <div class="neuro-series-plot" role="region" tabindex="0" aria-label="${esc(series.title)} chart. Scroll horizontally to inspect the full plot."><svg viewBox="0 0 580 245" role="img" aria-label="${esc(series.title)}: time in seconds and amplitude in ${esc(series.unit)}">
      <title>${esc(series.title)}</title><desc>${esc(series.description)} Exact values follow in a table.</desc>
      <path d="M110 30V190H535" fill="none" stroke="currentColor"/>
      <g fill="currentColor" font-size="13"><text x="107" y="210">0</text><text x="525" y="210" text-anchor="end">${number(lastTime)}</text>
        <text x="100" y="${y(low) + 4}" text-anchor="end">${number(low)}</text>${high !== low ? `<text x="100" y="${y(high) + 4}" text-anchor="end">${number(high)}</text>` : ''}
        <text x="318" y="237" text-anchor="middle">Time (s)</text><text x="18" y="115" transform="rotate(-90 18 115)" text-anchor="middle">Amplitude (${esc(series.unit)})</text></g>
      <polyline points="${values.map((value, i) => `${x(i)},${y(value)}`).join(' ')}" fill="none" stroke="currentColor" stroke-width="2"/>
      ${values.map((value, i) => `<circle cx="${x(i)}" cy="${y(value)}" r="3" fill="currentColor"/>`).join('')}
      ${thresholdVisible ? `<path class="neuro-series-threshold" d="M110 ${y(series.threshold)}H535" fill="none" stroke-width="2" stroke-dasharray="6 4"/>` : ''}
      ${markers.map(index => `<circle class="neuro-series-marker" cx="${x(index)}" cy="${y(values[index])}" r="7" fill="none" stroke-width="3"><title>Candidate event at sample ${index}</title></circle>`).join('')}</svg></div>
    ${Number.isFinite(series.threshold) ? `<p>Threshold: ${number(series.threshold)} ${esc(series.unit)}${thresholdVisible ? ' · dashed amber line' : ' · outside the displayed range'}. ${markers.length} candidate events marked with outlined pink circles.</p>` : ''}
    <p>${esc(series.description)} Sampling rate: ${series.sampleRateHz} Hz. ${values.length} samples.</p>
    <details><summary>Exact sample values</summary><div style="overflow-x:auto"><table><thead><tr><th scope="col">Index</th><th scope="col">Time (s)</th><th scope="col">Amplitude (${esc(series.unit)})</th></tr></thead>
      <tbody>${values.map((value, i) => `<tr><th scope="row">${i}</th><td>${i / series.sampleRateHz}</td><td>${value}</td></tr>`).join('')}</tbody></table></div></details></figure>`;
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
  const body = `<span class="neuro-eyebrow">NeuroSim · ${esc(sim.difficulty || 'lab')}</span><h1>${esc(sim.title)}</h1>
    <p>Your first answer is saved. Read the model answer, then write one line on why.</p>
    <div class="neuro-block"><span class="label">Scenario</span><p>${esc(sim.scenario)}</p></div>
    <div class="neuro-block"><span class="label">Signal</span><p>${esc(sim.signalDescription)}</p></div>${neuroSeriesMarkup(sim.series)}
    <p class="q">${esc(sim.decisionQuestion)}</p><div class="opts">${answer.order.map((index, i) => `<button class="opt ${chosen === index ? (index === sim.bestAnswerIndex ? 'correct' : 'wrong') : ''}" data-sim-choice="${index}" ${chosen == null ? '' : 'disabled'}><span class="key">${LETTERS[i]}</span><span>${esc(sim.choices[index].label)}</span></button>`).join('')}</div>
    ${
      chosen == null
        ? ''
        : `<div class="explain"><b>${chosen === sim.bestAnswerIndex ? 'Correct first answer' : 'First answer needs review'}</b>${chosen === sim.bestAnswerIndex ? '' : `<p>${esc(sim.choices[chosen].rationale)}</p>`}<p>Model answer: ${esc(sim.choices[sim.bestAnswerIndex].label)}</p><p>${esc(sim.choices[sim.bestAnswerIndex].rationale)}</p></div>
      <p>${esc(sim.oneLineMaster)}</p><label for="sim-debrief">Explain the calculation or one limit of this conclusion.</label>
      <textarea class="socinput neuro-input" id="sim-debrief" rows="4" maxlength="12000" ${record.completedAt ? 'readonly' : ''}>${esc(record.debrief)}</textarea>
      ${record.completedAt ? `<p role="status">Saved.</p><button class="btn btn-solid" id="sim-back">${opts.mount ? 'Continue' : 'Back to NeuroSim'}</button>` : `<button class="btn btn-solid" id="sim-complete" ${record.debrief.trim() ? '' : 'disabled'}>Save and finish</button>`}`
    }
    ${sim.sources?.length ? `<details><summary>Sources</summary><ul>${sim.sources.map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)}</a></li>`).join('')}</ul></details>` : ''}`;
  const main = el(
    opts.mount
      ? `<section class="neuro-stage">${body}</section>`
      : `<main class="neuro-page neuro-inner"><section class="neuro-body"><button class="backbtn topback" id="neback">← Back to NeuroSim Lab</button>${body}</section></main>`
  );
  main.querySelector('#neback')?.addEventListener('click', () => renderNeuroSimLibrary());
  const redraw = () => {
    if (opts.mount) main.remove();
    renderNeuroSim(simId, opts);
  };
  main.querySelectorAll('[data-sim-choice]').forEach(
    button =>
      (button.onclick = () => {
        if (neuroChoose(record, question, Number(button.dataset.simChoice))) redraw();
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
        else redraw();
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
function mountNeuroCodeSandbox(lesson, codeId, opts, shell) {
  const entry = neuroCodeEntry(codeId);
  const work = opts.work || (entry.current ||= neuroNewCodeWork(lesson));
  lesson = work.content;
  const last = neuroCodeLastCheck(work);
  const reflection = !lesson.checks && !neuroCodeIsRunnablePython(lesson.solution);
  saveNeuroProg();
  const sandbox =
    el(`<div class="neuro-sandbox"><span class="label">${reflection ? 'Written practice' : 'Python practice'}</span>
    <p>${lesson.checks ? 'Check runs your function on several input cases. The example printout alone cannot pass.' : reflection ? 'Compare your response with the model; written explanations are not automatically graded.' : 'This draft exercise compares only the example output. It has no tests of other inputs yet.'}</p>
    <p class="neuro-prose">${esc(lesson.challengePrompt)}</p>
    <label for="neuro-code-editor">${reflection ? 'Your explanation' : 'Python editor <span class="neuro-editor-hint mono">Tab indents &middot; Esc then Tab leaves</span>'}</label><textarea id="neuro-code-editor" class="neuro-code-draft" rows="14" maxlength="40000" spellcheck="false">${esc(work.draft)}</textarea>
    <div class="neuro-sandbox-actions">${reflection ? '' : '<button class="btn btn-solid" data-run-code>Run</button><button class="btn" data-stop-code hidden>Stop Python</button>'}<button class="btn" data-check-code>${reflection ? 'Save and compare' : 'Check'}</button>
      <details class="neuro-sandbox-more"><summary class="btn">More</summary><div class="neuro-sandbox-more-inner">
        <button class="btn" data-reset-code>Reset editor</button><button class="btn" data-show-hint>Hint</button><button class="btn" data-show-sol>Reveal solution</button><button class="btn" data-load-sol>Load solution</button>
      </div></details></div>
    <p data-py-status role="status">${esc(last?.message || 'Draft saved in this browser.')}</p>
    <pre class="neuro-code" data-term-log>${esc(last?.stdout || '')}${last?.stderr ? '\n' + esc(last.stderr) : ''}</pre>
    <div data-check-results></div><div data-extra></div>
    ${lesson.checks ? '<div class="neuro-sandbox-actions"><button class="btn" data-trace-code>Trace without Python</button><button class="btn" data-export-code>Download current code</button></div><div data-manual-trace></div>' : ''}
    <p data-gate>${opts.requirePass ? 'Finish this exercise to continue. Results and help used remain in your saved work.' : 'Checks describe only this exercise.'}</p>
    <div class="continue-row" data-continue-row ${opts.requirePass && !neuroWorkComplete(work) ? 'hidden' : ''}><button class="btn btn-solid" data-code-done>Continue</button></div></div>`);
  const draft = sandbox.querySelector('#neuro-code-editor'),
    status = sandbox.querySelector('[data-py-status]');
  const log = sandbox.querySelector('[data-term-log]'),
    extra = sandbox.querySelector('[data-extra]');
  const continueRow = sandbox.querySelector('[data-continue-row]');
  let busy = false,
    continued = false,
    controller;
  const stop = sandbox.querySelector('[data-stop-code]');
  if (stop) stop.onclick = () => controller?.abort();
  const refreshGate = () => {
    continueRow.hidden = !!opts.requirePass && !neuroWorkComplete(work);
  };
  const saveDraft = () => {
    if (StudyStorage.paused || busy) return;
    work.draft = draft.value;
    saveNeuroProg();
    refreshGate();
  };
  draft.oninput = saveDraft;
  if (!reflection) neuroEditorKeys(draft);
  function showFeedback(feedback) {
    if (!feedback) return;
    status.textContent = feedback.message;
    log.textContent = [feedback.stdout, feedback.stderr].filter(Boolean).join('\n');
    sandbox.querySelector('[data-check-results]').innerHTML =
      `${feedback.explanation ? `<p>${esc(feedback.explanation)}</p>` : ''}${feedback.cases ? `<ol>${feedback.cases.map((item, i) => `<li>Case ${i + 1}: ${item.passed ? 'passed' : 'needs work'} · expected ${esc(item.expected)}, received ${esc(item.actual)}${item.argsPreserved === false ? ' · input was changed' : ''}</li>`).join('')}</ol>` : ''}`;
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
    if (StudyStorage.paused || busy) return;
    work.previousDraft = work.draft;
    draft.value = lesson.codeExample.trim();
    saveDraft();
    status.textContent = 'Starter restored. The preceding draft is retained in recovery data.';
  };
  sandbox.querySelector('[data-show-hint]').onclick = () => {
    if (StudyStorage.paused || busy) return;
    work.support.hintAt ||= Date.now();
    saveNeuroProg();
    showSupport();
  };
  sandbox.querySelector('[data-show-sol]').onclick = () => {
    if (StudyStorage.paused || busy) return;
    work.support.solutionAt ||= Date.now();
    saveNeuroProg();
    showSupport();
  };
  sandbox.querySelector('[data-load-sol]').onclick = () => {
    if (StudyStorage.paused || busy) return;
    work.previousDraft = work.draft;
    work.support.solutionAt ||= Date.now();
    draft.value = lesson.solution.trim();
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

  const conceptBlock = `<div class="neuro-block"><span class="label">Concept</span><p class="neuro-prose">${esc(lesson.explanation)}</p>
    <p class="neuro-mono">${esc(lesson.codingConcept)} &middot; ${esc(lesson.neuroengineeringConcept)}</p></div>${neuroSeriesMarkup(lesson.series)}
    ${lesson.checks ? '<details><summary>New to Python functions?</summary><p>A function starts with def, followed by its name and inputs in parentheses. Indented lines form its body. return sends a result back to the caller; print only displays a value. A list stores values in order, and its first index is 0. Replace the marked starter lines, run an example, then use Check to call your function with several inputs.</p><p><a href="/neuro?view=python" data-neuro-python>Never coded? Read Python in five minutes.</a></p></details>' : ''}
    ${lesson.sources?.length ? `<details><summary>Sources</summary><ul>${lesson.sources.map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)}</a></li>`).join('')}</ul></details>` : ''}`;

  if (opts.mount) {
    const mount = typeof opts.mount === 'string' ? document.querySelector(opts.mount) : opts.mount;
    if (!mount) {
      if (opts.onDone) opts.onDone(false);
      return;
    }
    const wrap = el(`<section class="neuro-stage neuro-embed">
      <span class="neuro-eyebrow">NeuroCode &middot; ${esc(lesson.codingConcept)}</span>
      <h2 class="neuro-h2">${esc(lesson.title)}</h2>
      ${conceptBlock}
    </section>`);
    mount.appendChild(wrap);
    neuroBindLinks(wrap);
    mountNeuroCodeSandbox(lesson, codeId, opts, wrap);
    return;
  }

  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner">
    <section class="neuro-body">
      <button class="backbtn topback" id="neback">&larr; Back to NeuroCode Lab</button>
      <span class="neuro-eyebrow">NeuroCode &middot; ${esc(lesson.codingConcept)}</span>
      <h1 class="neuro-h1">${esc(lesson.title)}</h1>
      ${conceptBlock}
      <p class="neuro-mono neuro-master">${esc(lesson.oneLineMaster)}</p>
    </section>
  </main>`);
  main.querySelector('#neback').addEventListener('click', renderNeuroCodeLab);
  neuroBindLinks(main);
  mountNeuroCodeSandbox(lesson, codeId, opts, main.querySelector('.neuro-body'));
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
  const sims = NEURO.data?.simulations || [];
  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  const main = el(`<main class="neuro-page neuro-inner">
    <section class="neuro-body">
      <button class="backbtn topback" id="neback">&larr; Back to Neuroengineering</button>
      <span class="neuro-eyebrow">NeuroSim Lab</span>
      <h1 class="neuro-h1">Decision labs.</h1>
      <p class="neuro-lede">${sims.length} short decision labs. Read the scenario, pick the best next step, then compare your answer with the model.</p>
      <div class="neuro-rows" id="nesimlib"></div>
    </section>
  </main>`);
  main.querySelector('#neback').addEventListener('click', renderNeuroEngineering);
  const rows = main.querySelector('#nesimlib');
  for (const sim of sims) {
    const prev = NEURO_PROG.simWork[sim.id];
    const row = el(`<button class="neuro-row">
      <span class="neuro-row-main"><span class="neuro-row-title">${esc(sim.title)}</span>
      <span class="neuro-row-sub">${esc(sim.difficulty || 'lab')} &middot; ${esc(
        (sim.scoringCategories || [])
          .map(label =>
            String(label)
              .replace(/([a-z])([A-Z])/g, '$1 $2')
              .toLowerCase()
          )
          .join(', ') || 'decision'
      )}</span></span>
      <span class="neuro-row-right">${prev ? `<span class="pill">${prev.completedAt ? 'done' : 'resume'}</span>` : NEURO_PROG.sims[sim.id] ? '<span class="pill">started</span>' : ''}</span>
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
    subject = neuroSubject(step.subjectId);
  const main = el(`<main class="neuro-page neuro-inner"><section class="neuro-body">
    <button class="backbtn topback" id="neback">&larr; Back to Neuroengineering</button>
    <span class="neuro-eyebrow">${module ? `Module ${module.index} &middot; ${esc(module.title)} &middot; ` : ''}Unit ${neuroUnitNumber(step)} / ${neuroPath().steps.length}</span>
    <h1 class="neuro-h1">${esc(record.content.step.title)}</h1>
    <p class="neuro-unit-sub">${esc(step.explanation || '')}</p>
    <p class="neuro-unit-meta mono">${esc(step.estimatedFocus || '')}${subject ? ` &middot; ${esc(subject.name)}` : ''}</p>
    <div class="neuro-runbar cornerframe"><div class="cs-runbar-meta"><span class="label">Unit progress</span><span id="neunitlab"></span></div><span class="bar"><i id="neunitfill"></i></span></div>
    <div id="neunitstages"></div>${neuroAboutLine()}</section></main>`);
  main.querySelector('#neback').onclick = () => renderNeuroEngineering();
  neuroBindLinks(main);
  root.appendChild(main);
  setView(root);
  neuroUnitAppend();
}
function neuroUnitProgress() {
  const record = neUnit.record,
    stages = neuroUnitStages();
  document.getElementById('neunitfill').style.width = `${Math.round((100 * record.stageIdx) / stages.length)}%`;
  document.getElementById('neunitlab').textContent = record.completedAt
    ? 'Complete'
    : `Stage ${record.stageIdx + 1} / ${stages.length} · ${UNIT_STAGE_LABELS[stages[record.stageIdx]]}`;
}
function neuroUnitAppend() {
  const record = neUnit.record,
    { step, unit, checks, code, sim } = record.content;
  const stage = neuroStageKeys(record.content)[record.stageIdx];
  neuroRoute(step.id, stage || 'complete');
  neuroUnitProgress();
  const container = document.getElementById('neunitstages');
  container.replaceChildren();
  if (record.completedAt) return neuroUnitFinish();
  const advance = () => {
    if (neuroUnitAdvance(record, stage)) neuroUnitAppend();
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
    const intro =
      stage === 'sim'
        ? `<h2>${esc(sim.title)}</h2><p>${esc(sim.scenario)}</p><p>${esc(sim.signalDescription)}</p>${neuroSeriesMarkup(sim.series)}`
        : '<p>Your first answer is saved. Read the explanation, then continue.</p>';
    const node = el(
      `<section class="neuro-stage"><span class="label">${UNIT_STAGE_LABELS[stage]}</span>${intro}<div id="neuro-unit-questions"></div><button class="btn btn-solid" id="neuro-unit-next" ${neuroUnitReady(record) ? '' : 'disabled'}>Continue after review</button></section>`
    );
    for (const question of questions) {
      const answer = neuroAnswerRecord(record, question),
        chosen = answer.chosen;
      const explanation = stage === 'sim' && chosen != null ? sim.choices[chosen].rationale : question.explanation;
      const item = el(
        `<div class="neuro-block"><p class="q">${esc(question.prompt)}</p><div class="opts">${answer.order.map((index, i) => `<button class="opt ${chosen === index ? (index === question.correctIndex ? 'correct' : 'wrong') : ''}" data-choice="${index}" ${chosen == null ? '' : 'disabled'}><span class="key">${LETTERS[i]}</span><span>${esc(question.choices[index])}</span></button>`).join('')}</div>${chosen == null ? '' : `<div class="explain"><b>${chosen === question.correctIndex ? 'Correct first answer' : 'First answer needs review'}</b><p>Model answer: ${esc(question.choices[question.correctIndex])}</p><p>${esc(explanation)}</p></div>`}</div>`
      );
      item.querySelectorAll('[data-choice]').forEach(
        button =>
          (button.onclick = () => {
            if (neuroChoose(record, question, Number(button.dataset.choice))) neuroUnitAppend();
          })
      );
      node.querySelector('#neuro-unit-questions').appendChild(item);
    }
    node.querySelector('#neuro-unit-next').onclick = advance;
    container.appendChild(node);
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
      saved = (record.recall[index] ||= { draft: '' });
    const node =
      el(`<section class="neuro-stage"><span class="label">Active recall ${index + 1}/${prompts.length}</span><p class="q">${esc(prompt.prompt)}</p>
      <label for="neuro-recall">Your explanation (optional)</label><textarea class="socinput neuro-input" id="neuro-recall" rows="4" maxlength="12000" ${saved.revealedAt ? 'readonly' : ''}>${esc(saved.draft)}</textarea>
      ${saved.revealedAt ? `<div class="explain"><b>Compare with the model</b><p>${esc(prompt.answer)}</p><p>Your writing is saved without automatic grading.</p></div><button class="btn btn-solid" id="neuro-recall-next">${index + 1 === prompts.length ? 'Continue' : 'Next prompt'}</button>` : `<button class="btn" id="neuro-recall-hint">Hint</button><button class="btn btn-solid" id="neuro-recall-reveal">Save and compare</button>`}
      ${saved.hintAt ? `<p class="sochint">${esc(prompt.hint)}</p>` : ''}</section>`);
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
        if (saveNeuroProg()) neuroUnitAppend();
      };
    const reveal = node.querySelector('#neuro-recall-reveal');
    if (reveal)
      reveal.onclick = () => {
        if (StudyStorage.paused) return;
        saved.revealedAt ||= Date.now();
        if (saveNeuroProg()) neuroUnitAppend();
      };
    const next = node.querySelector('#neuro-recall-next');
    if (next)
      next.onclick = () => {
        if (StudyStorage.paused || record.recallIdx !== index) return;
        record.recallIdx++;
        if (saveNeuroProg()) neuroUnitAppend();
      };
    container.appendChild(node);
    return;
  }
  const topic = stage === 'lesson' ? neuroTopic(step.topicId) : null;
  const body =
    stage === 'lesson'
      ? `<div class="neuro-kv"><span>Objective</span><span>${esc(step.stepObjective)}</span></div>
        ${
          unit
            ? `<h2>Why it matters</h2><p>${esc(unit.whyItMatters)}</p>
        <h2>The idea</h2><p>${esc(unit.shortLesson)}</p>
        ${unit.keyTerms?.length ? `<p class="neuro-terms">${unit.keyTerms.map(term => `<span>${esc(term)}</span>`).join('')}</p>` : ''}
        <h2>Mental model</h2><p>${esc(unit.mentalModel)}</p>
        <h2>Worked example</h2><p class="neuro-prose">${esc(unit.workedExample)}</p>
        ${unit.commonMistake ? `<h2>Common mistake</h2><p>${esc(unit.commonMistake)}</p>` : ''}`
            : `<p>${esc(step.explanation)}</p>`
        }
        ${topic ? `<div class="neuro-deeper"><span class="label">Go deeper</span><button class="neuro-deeper-link" type="button" id="neuro-unit-topic">${esc(topic.title)} <span>Reference lesson &middot; vocabulary &middot; ${topic.quizQuestions?.length || 0}-question quiz &middot; Socratic study</span></button></div>` : ''}`
      : `<p>${esc(step.reflectionQuestion || 'What changed in your understanding?')}</p><label for="neuro-debrief">Your debrief (optional)</label><textarea class="socinput neuro-input" rows="4" id="neuro-debrief" maxlength="12000">${esc(record.debrief)}</textarea>`;
  const sources =
    stage === 'lesson' && unit.sources?.length
      ? `<details><summary>Sources and scope</summary><ul>${unit.sources.map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)}</a></li>`).join('')}</ul></details>`
      : '';
  const node = el(
    `<section class="neuro-stage"><span class="label">${UNIT_STAGE_LABELS[stage]}</span>${body}${sources}<button class="btn btn-solid" id="neuro-unit-next">${stage === 'debrief' ? 'Complete unit' : 'Continue'}</button></section>`
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
  container.appendChild(node);
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
    el(`<section class="neuro-stage"><h2>Unit ${index + 1 || step.order} complete</h2><p>${correct}/${checks.length} quick checks correct on the first attempt. Your original responses remain saved.</p>
    <p>${esc(step.oneLineMaster)}</p><details><summary>Review saved writing and checks</summary>
    ${(unit?.activeRecallPrompts || []).map((prompt, i) => `<div class="neuro-block"><p><b>${esc(prompt.prompt)}</b></p><p>Your answer: ${esc(record.recall[i]?.draft || '(No written answer)')}</p><p>Model: ${esc(prompt.answer)}</p>${record.recall[i]?.hintAt ? '<p>Hint used</p>' : ''}</div>`).join('')}
    ${checks.map(q => `<div class="neuro-block"><p><b>${esc(q.prompt)}</b></p><p>First answer: ${esc(q.choices[record.answers[q.id]?.chosen] || '(No answer)')}</p><p>${esc(q.explanation)}</p></div>`).join('')}
    ${sim ? `<div class="neuro-block"><h3>${esc(sim.title)}</h3><p>${esc(sim.scenario)}</p><p>${esc(sim.signalDescription)}</p>${neuroSeriesMarkup(sim.series)}<p><b>${esc(sim.decisionQuestion)}</b></p><p>First answer: ${esc(sim.choices[record.answers.simulation?.chosen]?.label || '(No answer)')}</p><p>Model answer: ${esc(sim.choices[sim.bestAnswerIndex]?.label || '')}</p><p>${esc(sim.choices[record.answers.simulation?.chosen]?.rationale || '')}</p></div>` : ''}
    <p><b>Debrief:</b> ${esc(record.debrief || '(No written debrief)')}</p><p>Coding evidence: ${esc(record.codeWork ? neuroCodeEvidenceLabel(record.codeWork) : 'No code exercise in this unit')}${record.codeWork?.support?.solutionAt ? ' · solution consulted' : ''}</p></details>
    <div class="endbtns">${next ? `<button class="btn btn-solid" id="neuro-next-unit">${newModule ? `Next: Module ${nextModule.index} &middot; ${esc(nextModule.title)}` : 'Next unit'}</button>` : ''}<button class="btn" id="neuro-unit-hub">Course hub</button></div></section>`);
  const nextButton = node.querySelector('#neuro-next-unit');
  if (nextButton) nextButton.onclick = () => (newModule ? renderNeuroModule(nextModule.id) : renderNeuroUnit(next.id));
  node.querySelector('#neuro-unit-hub').onclick = () => renderNeuroEngineering();
  document.getElementById('neunitstages').appendChild(node);
}
window.addEventListener('study-storage-recovered', () => {
  if (location.pathname === new URL(sectionUrl('neuro'), location.origin).pathname)
    renderNeuroEngineering({ fromUrl: true });
});
