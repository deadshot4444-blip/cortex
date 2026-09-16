/* DAT preparation — track shell. Loads second in SECTION_SCRIPTS.dat (right after
   study-storage.js) so every later DAT module can push its pause function into
   DAT.pausers at load time. Owns: the DAT data registry, the outline loader, the
   ?view= router with every view pre-registered, the landing page, the "not built yet"
   notice, pauseDatTools, the saving-paused/recovered listeners and resetDatState.
   Naming contract: globals prefixed dat/Dat/DAT, ids #dat-*, attributes data-dat-*,
   classes .dat-*; option letters always come from LETTERS (app.js), never a literal. */

// Field names are pinned here and never renamed: DatDrillCore, DatCoverage, DatPlanCore,
// dat-course.js, dat-rc.js and dat-rehearsal.js read them.
window.DAT = {
  pausers: [],
  loaded: false,
  outline: null,
  course: null,
  questions: [],
  cards: [],
  rc: null,
  pat: null,
  repairs: null,
  rehearsals: null,
  scoreTables: null,
};
const DAT = window.DAT;

/* ---------- data ---------- */
// DAT-01 loads the outline only. DAT-02 completes this list with every fragment in
// outline.files plus the singletons and adds the merge; a content session then bumps
// only its own line with `python3 scripts/bump-cache.py <file>.json`.
const DAT_DATA_VERSIONS = ['dat-outline.json?v=1'];
const DAT_DATA_LABELS = { 'dat-outline': 'content outline' };
function datDataKey(file) {
  return file.split('?')[0].replace(/\.json$/, '');
}
function datDataPresent(key) {
  if (key === 'dat-outline') return Array.isArray(DAT.outline?.concepts) && DAT.outline.concepts.length > 0;
  return true;
}
async function loadDAT() {
  if (DAT.loaded) return;
  await Promise.all(
    DAT_DATA_VERSIONS.map(async file => {
      const key = datDataKey(file);
      if (datDataPresent(key)) return;
      try {
        const response = await fetch('data/' + file);
        if (!response.ok) return;
        const data = await response.json();
        if (key === 'dat-outline' && Array.isArray(data?.concepts) && data.concepts.length > 0) DAT.outline = data;
      } catch {
        /* The workspace offers retry without replacing saved work. */
      }
    })
  );
  DAT.loaded = DAT_DATA_VERSIONS.every(file => datDataPresent(datDataKey(file)));
}
function datDataNotice(main) {
  const missing = DAT_DATA_VERSIONS.map(datDataKey)
    .filter(key => !datDataPresent(key))
    .map(key => DAT_DATA_LABELS[key] || key);
  if (!missing.length) return;
  const notice = el(
    `<aside class="course-notice" role="status"><strong>Some study material could not load.</strong><p>Unavailable: ${esc(missing.join(', '))}. Your saved progress is unchanged. Loaded activities remain available.</p><button class="btn" id="dat-data-retry">Retry loading study material</button></aside>`
  );
  notice.querySelector('button').onclick = async e => {
    e.currentTarget.disabled = true;
    e.currentTarget.textContent = 'Loading…';
    await loadDAT();
    renderDATEntry();
  };
  main.prepend(notice);
}

/* ---------- navigation ---------- */
function datTrack() {
  return CortexAcademy.tracks.find(t => t.id === 'dat');
}
function datUrl(params = {}) {
  const url = new URL(sectionUrl('dat'), location.origin);
  for (const [key, value] of Object.entries(params)) if (value != null) url.searchParams.set(key, String(value));
  return url.pathname + url.search;
}
function datGo(params = {}) {
  const url = datUrl(params);
  if (location.pathname + location.search !== url) history.pushState({ sec: 'dat' }, '', url);
  return renderDATEntry();
}
function datView(main) {
  const root = el('<div></div>');
  root.appendChild(topbar('dat'));
  root.appendChild(main);
  setView(root);
  main.querySelectorAll('a[data-dat-go]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const target = new URL(link.getAttribute('href'), location.origin);
      datGo(Object.fromEntries(target.searchParams));
    });
  });
}

/* ---------- pause / reset ---------- */
// A pauser is a function pushed into DAT.pausers by the module that owns a clock. It stops
// the clock and may return { selector, resume } so the saving-paused listener below can
// restart it once saving recovers and that view is still on screen.
let datPausedTimers = [];
function pauseDatTools() {
  const stopped = [];
  for (const pause of DAT.pausers) {
    try {
      const result = pause();
      if (result && typeof result.resume === 'function') stopped.push(result);
    } catch {
      /* One broken clock must not block leaving the section. */
    }
  }
  return stopped;
}
function resetDatState() {
  pauseDatTools();
  datPausedTimers = [];
  window.DatRehearsal?.reset?.();
  window.resetDatCourseState?.();
  window.resetDatRepairState?.();
  DAT.loaded = false;
  DAT.outline = null;
  DAT.course = null;
  DAT.questions = [];
  DAT.cards = [];
  DAT.rc = null;
  DAT.pat = null;
  DAT.repairs = null;
  DAT.rehearsals = null;
  DAT.scoreTables = null;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('cs-dat-r-')) keys.push(k);
  }
  keys.forEach(k => StudyStorage.remove(k));
}
window.addEventListener('study-storage-paused', () => {
  datPausedTimers = pauseDatTools();
});
window.addEventListener('study-storage-recovered', () => {
  DAT.saveFailed = false;
  const status = document.querySelector('#dat-save-status');
  if (status) status.textContent = 'Your work is saved in this browser. Signed-in sync follows your account settings.';
  for (const timer of datPausedTimers) if (!timer.selector || document.querySelector(timer.selector)) timer.resume();
  datPausedTimers = [];
});

/* ---------- views ---------- */
function datNotBuilt(view) {
  const main = el(`<main class="panel dat-notice">
    <span class="label">DAT &middot; ${esc(CortexAcademy.status(datTrack()))}</span>
    <h1>This part of the DAT track is not built yet.</h1>
    <p class="sub">${view ? `The view <code>${esc(view)}</code> is registered but its module has not shipped.` : 'The requested page is not part of the DAT track.'} Nothing you saved has changed.</p>
    <div class="endbtns"><a class="btn btn-solid" id="dat-back" data-dat-go href="${esc(datUrl())}">Back to DAT preparation</a></div>
  </main>`);
  datView(main);
}
const DAT_SECTION_TARGETS = {
  bio: { view: 'drill', section: 'bio', n: 15 },
  gchem: { view: 'drill', section: 'gchem', n: 15 },
  ochem: { view: 'drill', section: 'ochem', n: 15 },
  pat: { view: 'pat' },
  rc: { view: 'rc' },
  qr: { view: 'qr' },
};
const DAT_TOOL_LINKS = [
  ['course', 'Lessons'],
  ['plan', 'Schedule'],
  ['mistakes', 'Mistake log'],
  ['progress', 'Progress'],
  ['coverage', 'Coverage map'],
  ['rehearsal', 'Full-length rehearsal'],
];
function datRenderLanding() {
  const track = datTrack(),
    outline = DAT.outline;
  const lessons = DAT.course?.units?.length || 0,
    items = DAT.questions.length;
  const main = el(`<main class="course-page dat-landing">
    <header class="course-hero"><div>
      <span class="course-eyebrow">CORTEX / DAT</span>
      <h1>${esc(track.name)} <span class="academy-status">${esc(CortexAcademy.status(track))}</span></h1>
      <p>${esc(track.description)}</p>
      <div class="course-actions"><a class="btn btn-solid" id="dat-start" data-dat-go href="${esc(datUrl({ view: 'drill', section: 'mixed', n: 15 }))}">Start a 15-minute drill →</a></div>
    </div>
    <div class="course-hero-index"><span>THE DAT TRACK</span><strong>${items}<span>practice items</span></strong><div>${lessons} lessons · ${outline ? Object.keys(outline.sections).length : 0} sections<br>${outline ? outline.patSubtests.length : 0} perceptual-ability generators<br>${outline ? outline.concepts.reduce((n, c) => n + c.categories.length, 0) : 0} outline categories</div></div></header>
    ${
      outline
        ? `<section class="dat-format" aria-labelledby="dat-format-title"><h2 id="dat-format-title">Test-day format</h2>
      <table class="dat-format-table"><thead><tr><th scope="col">Block</th><th scope="col">Questions</th><th scope="col">Minutes</th></tr></thead><tbody>${outline.blocks
        .map(
          b =>
            `<tr><th scope="row">${esc(b.name)}${b.sections ? `<small>${b.sections.map(s => esc(outline.sections[s].name) + ' ' + outline.sections[s].questions).join(' · ')}</small>` : ''}</th><td>${b.questions ?? '—'}</td><td>${b.minutes}</td></tr>`
        )
        .join('')}</tbody></table>
      <p class="course-caption">${esc(outline.scope)}</p></section>
    <section class="dat-sections" aria-labelledby="dat-sections-title"><h2 id="dat-sections-title">Six sections</h2><div class="academy-catalog">${Object.entries(
      outline.sections
    )
      .map(([key, s]) => {
        const concept = outline.concepts.find(c => c.section === key);
        return `<article class="academy-course dat-section-card" data-dat-section="${key}"><div class="academy-course-top"><span>${esc(s.abbr)}</span><span>${s.questions} questions${s.minutes ? ` · ${s.minutes} min` : ''}</span></div><h3><a data-dat-go href="${esc(datUrl(DAT_SECTION_TARGETS[key]))}">${esc(s.name)}</a></h3><p>${esc(concept?.summary || '')}</p><div class="academy-course-bottom"><span>${concept ? concept.categories.length + ' categories' : ''}</span><a data-dat-go href="${esc(datUrl(DAT_SECTION_TARGETS[key]))}">Open <span aria-hidden="true">→</span></a></div></article>`;
      })
      .join('')}</div>
      <p class="course-caption">${esc(outline.ochemGoLive)}</p></section>
    <nav class="dat-tools" aria-label="DAT tools"><span class="course-eyebrow">TOOLS</span>${DAT_TOOL_LINKS.map(([view, label]) => `<a data-dat-go href="${esc(datUrl({ view }))}">${esc(label)}</a>`).join('')}</nav>`
        : ''
    }
    <p class="course-caption">Original Cortex material keyed to a paraphrase of the ADA DAT outline. Not affiliated with or endorsed by the American Dental Association. Independent subject review is pending.</p>
  </main>`);
  datDataNotice(main);
  datView(main);
}

/* ---------- router ---------- */
// Every ?view= is registered here once; later milestones ship the module, not a router
// edit. Each view re-reads location.search for its own options (section, n, mode, level,
// set, …), which is why those keys are in academy-curriculum.js queryKeys. A missing
// module renders the not-built notice so the landing never breaks between milestones.
// DatPlan.today() returns true when it rendered a Today card; otherwise the landing shows.
async function renderDATEntry() {
  pauseDatTools();
  if (typeof stopTimer === 'function') stopTimer();
  await loadDAT();
  const params = new URLSearchParams(location.search),
    view = params.get('view') || 'today',
    unit = params.get('unit');
  const built = fn => (typeof fn === 'function' ? fn : null);
  switch (view) {
    case 'today': {
      const today = built(window.DatPlan?.today);
      if (today && (await today())) return;
      return datRenderLanding();
    }
    case 'drill':
      return (built(window.DatPractice?.render) || (() => datNotBuilt(view)))();
    case 'mistakes':
      return (built(window.DatPractice?.mistakes) || (() => datNotBuilt(view)))();
    case 'pat':
      return (built(window.DatPat?.render) || (() => datNotBuilt(view)))();
    case 'qr':
      return (built(window.DatQr?.render) || (() => datNotBuilt(view)))();
    case 'plan':
      return (built(window.DatPlan?.render) || (() => datNotBuilt(view)))();
    case 'progress':
      return (built(window.DatProgress?.render) || (() => datNotBuilt(view)))();
    case 'rc':
      return (built(window.DatRc?.render) || (() => datNotBuilt(view)))();
    case 'course': {
      if (unit === 'starting-check') return (built(window.renderDatCoursePlacement) || (() => datNotBuilt(view)))();
      if (unit) return (built(window.renderDatCourseUnit) || (() => datNotBuilt(view)))(unit);
      return (built(window.renderDatCourseHome) || (() => datNotBuilt(view)))();
    }
    case 'coverage':
      return (built(window.DatCoverage?.render) || (() => datNotBuilt(view)))();
    case 'rehearsal':
      return (built(window.DatRehearsal?.entry) || (() => datNotBuilt(view)))();
    case 'repair':
      return (built(window.renderDatRepairHub) || (() => datNotBuilt(view)))();
    case 'quality':
      return (built(window.DatItemQuality?.render) || (() => datNotBuilt(view)))();
    default:
      return datNotBuilt(null);
  }
}

window.renderDATEntry = renderDATEntry;
window.pauseDatTools = pauseDatTools;
window.resetDatState = resetDatState;
window.loadDAT = loadDAT;
