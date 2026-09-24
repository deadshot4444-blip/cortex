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
  // One cache of cs-dat-log / cs-dat-q / cs-dat-srs for every module in this document. Built
  // lazily by dat-practice.js or dat-pat.js, whichever reads first, so the two cannot overwrite
  // each other's rows; dropped again by resetDatState through their reset() hooks.
  attemptStores: null,
};
const DAT = window.DAT;

/* ---------- data ---------- */
// Every DAT data file, one line each: the outline, the 44 registered fragments and the five
// other singletons. A content session bumps only its own line with
// `python3 scripts/bump-cache.py <file>.json`; nothing else in this file changes after DAT-02.
// Fragment ROOTs are merged into the shapes the shared engines read (DESIGN §3a "Loader");
// scripts/dat-data.cjs is the Node twin of this merge. A file that fails to load is skipped,
// listed by datDataNotice, and retried on the next loadDAT() call.
const DAT_DATA_VERSIONS = [
  'dat-outline.json?v=1',
  'dat-course-bio-cell.json?v=1',
  'dat-course-bio-diversity.json?v=1',
  'dat-course-bio-systems.json?v=1',
  'dat-course-bio-genetics.json?v=1',
  'dat-course-gc-matter.json?v=1',
  'dat-course-gc-reactions.json?v=1',
  'dat-course-gc-structure.json?v=1',
  'dat-course-oc-structure.json?v=1',
  'dat-course-oc-acidbase.json?v=1',
  'dat-course-oc-mechanisms.json?v=2',
  'dat-course-oc-synthesis.json?v=1',
  'dat-course-qr-math.json?v=1',
  'dat-course-qr-applied.json?v=1',
  'dat-course-rc.json?v=2',
  'dat-course-pat-2d.json?v=2',
  'dat-course-pat-3d.json?v=1',
  'dat-cards-bio-cell.json?v=1',
  'dat-cards-bio-diversity.json?v=1',
  'dat-cards-bio-systems.json?v=1',
  'dat-cards-bio-genetics.json?v=1',
  'dat-cards-gc-matter.json?v=1',
  'dat-cards-gc-reactions.json?v=1',
  'dat-cards-gc-structure.json?v=1',
  'dat-cards-oc-structure.json?v=1',
  'dat-cards-oc-acidbase.json?v=1',
  'dat-cards-oc-mechanisms.json?v=2',
  'dat-cards-oc-synthesis.json?v=1',
  'dat-cards-qr-math.json?v=1',
  'dat-cards-qr-applied.json?v=1',
  'dat-cards-rc.json?v=2',
  'dat-cards-pat-2d.json?v=2',
  'dat-cards-pat-3d.json?v=1',
  'dat-questions-bio-1.json?v=2',
  'dat-questions-bio-2.json?v=1',
  'dat-questions-bio-3.json?v=1',
  'dat-questions-gchem-1.json?v=3',
  'dat-questions-gchem-2.json?v=1',
  'dat-questions-gchem-3.json?v=1',
  'dat-questions-ochem-1.json?v=1',
  'dat-questions-ochem-2.json?v=1',
  'dat-questions-ochem-3.json?v=1',
  'dat-questions-qr-1.json?v=4',
  'dat-questions-qr-2.json?v=1',
  'dat-questions-qr-3.json?v=1',
  'dat-rc.json?v=3',
  'dat-pat.json?v=4',
  'dat-repairs.json?v=1',
  'dat-rehearsals.json?v=1',
  'dat-score-tables.json?v=1',
];
// Singletons a later milestone creates: absent by design until then, so they neither block
// DAT.loaded nor appear in the notice. Each milestone removes its own name when its file lands.
const DAT_DATA_PENDING = new Set(['dat-score-tables']);
const DAT_DATA_LABELS = {
  'dat-outline': 'content outline',
  'dat-rc': 'reading passages',
  'dat-pat': 'perceptual-ability rules',
  'dat-repairs': 'concept sessions',
  'dat-rehearsals': 'rehearsal forms',
  'dat-score-tables': 'score tables',
};
const datFragments = { course: {}, cards: {}, questions: {} };
function datDataKey(file) {
  return file.split('?')[0].replace(/\.json$/, '');
}
function datDataKind(key) {
  const m = /^dat-(course|cards|questions)-/.exec(key);
  return m ? m[1] : key;
}
function datDataLabel(key) {
  return DAT_DATA_LABELS[key] || key.replace(/^dat-/, '').replace(/-/g, ' ');
}
function datDataPresent(key) {
  const kind = datDataKind(key);
  if (kind === 'course' || kind === 'cards' || kind === 'questions') return !!datFragments[kind][key];
  if (key === 'dat-outline') return Array.isArray(DAT.outline?.concepts) && DAT.outline.concepts.length > 0;
  if (key === 'dat-rc') return Array.isArray(DAT.rc?.passages);
  if (key === 'dat-pat') return Array.isArray(DAT.pat?.subtests);
  if (key === 'dat-repairs') return Array.isArray(DAT.repairs?.concepts);
  if (key === 'dat-rehearsals') return Array.isArray(DAT.rehearsals?.forms);
  if (key === 'dat-score-tables') return !!DAT.scoreTables?.concordance;
  return true;
}
function datDataAccept(key, data) {
  const kind = datDataKind(key);
  if (kind === 'course' && data?.format === 'dat-course' && Array.isArray(data.units) && data.chapter?.id)
    datFragments.course[key] = data;
  else if (kind === 'cards' && data?.format === 'dat-cards' && Array.isArray(data.cards))
    datFragments.cards[key] = data;
  else if (kind === 'questions' && data?.format === 'dat-bank' && Array.isArray(data.items))
    datFragments.questions[key] = data;
  else if (key === 'dat-outline' && Array.isArray(data?.concepts) && data.concepts.length > 0) DAT.outline = data;
  else if (key === 'dat-rc' && Array.isArray(data?.passages)) DAT.rc = data;
  else if (key === 'dat-pat' && Array.isArray(data?.subtests)) DAT.pat = data;
  else if (key === 'dat-repairs' && Array.isArray(data?.concepts)) DAT.repairs = data;
  else if (key === 'dat-rehearsals' && Array.isArray(data?.forms)) DAT.rehearsals = data;
  else if (key === 'dat-score-tables' && data?.concordance) DAT.scoreTables = data;
}
// Fragments merge in registry order (outline.files), so chapter order follows AUTHORING §2.2.
function datMerge() {
  const outline = DAT.outline;
  if (!outline) return;
  const ordered = (kind, list) => list.map(name => datFragments[kind][name]).filter(Boolean);
  const course = ordered('course', outline.files.course),
    units = course.flatMap(f => f.units);
  DAT.course = {
    version: 1,
    authoredOn: outline.authoredOn,
    status: 'DAT course merged from fragments; independent subject review pending.',
    outlineSource: outline.sourceUrl,
    categories: outline.concepts.flatMap(c =>
      c.categories.map(cat => ({ id: cat.id, title: cat.title, section: c.section }))
    ),
    chapters: course.map(f => ({
      ...f.chapter,
      units: units.filter(u => u.chapter === f.chapter.id).map(u => u.id),
    })),
    units,
  };
  DAT.questions = ordered('questions', outline.files.questions).flatMap(f => f.items);
  DAT.cards = ordered('cards', outline.files.cards).flatMap(f => f.cards);
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
        datDataAccept(key, await response.json());
      } catch {
        /* The workspace offers retry without replacing saved work. */
      }
    })
  );
  datMerge();
  DAT.loaded = DAT_DATA_VERSIONS.map(datDataKey).every(key => DAT_DATA_PENDING.has(key) || datDataPresent(key));
}
function datDataNotice(main) {
  const missing = DAT_DATA_VERSIONS.map(datDataKey)
    .filter(key => !DAT_DATA_PENDING.has(key) && !datDataPresent(key))
    .map(datDataLabel);
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
  window.DatPractice?.reset?.();
  window.DatPat?.reset?.();
  window.DatRc?.reset?.();
  window.DatQr?.reset?.();
  window.DatPlan?.reset?.();
  DAT.attemptStores = null;
  DAT.loaded = false;
  for (const kind of Object.keys(datFragments)) datFragments[kind] = {};
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
  ['mistakes', 'Mistake log'],
  ['plan', 'Schedule'],
];
const DAT_TOOL_SOON = [
  ['course', 'Lessons'],
  ['progress', 'Progress'],
  ['coverage', 'Coverage map'],
  ['rehearsal', 'Full-length rehearsal'],
];
function datRenderLanding() {
  const track = datTrack(),
    outline = DAT.outline;
  const lessons = DAT.course?.units?.length || 0,
    items = DAT.questions.length;
  // The headline number is merged bank items and only those (N1). Reading Comprehension ships
  // answerable questions that are not bank items, so they are counted from the loaded passages
  // and named on their own line rather than folded into that total.
  const rcQuestions = (DAT.rc?.passages || []).reduce((n, p) => n + (p.questions?.length || 0), 0);
  // The mistake log's due count, so the landing says when a review is waiting.
  const srs = DAT.attemptStores?.srs || StudyStorage.read('cs-dat-srs', {});
  const dueMistakes = window.DatDrillCore?.dueMistakes ? window.DatDrillCore.dueMistakes(srs || {}).length : 0;
  const main = el(`<main class="course-page dat-landing">
    <header class="course-hero"><div>
      <span class="course-eyebrow">CORTEX / DAT</span>
      <h1>${esc(track.name)} <span class="academy-status">${esc(CortexAcademy.status(track))}</span></h1>
      <p>${esc(track.description)}</p>
      <div class="course-actions"><a class="btn btn-solid" id="dat-start" data-dat-go href="${esc(datUrl({ view: 'drill', section: 'mixed', n: 15 }))}">Start a 15-minute drill →</a></div>
    </div>
      <div class="course-hero-index"><span>THE DAT TRACK</span><strong>${items}<span>practice items</span></strong><div>${lessons ? `${lessons} lesson units drafted · ` : ''}${outline ? Object.keys(outline.sections).length : 0} sections<br>${rcQuestions ? `${rcQuestions} reading-comprehension questions<br>` : ''}${window.DatPatCore ? window.DatPatCore.BUILT.length : 0} perceptual-ability generators<br>${outline ? outline.concepts.reduce((n, c) => n + c.categories.length, 0) : 0} outline categories</div></div></header>
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
    <nav class="dat-tools" aria-label="DAT tools"><span class="course-eyebrow">TOOLS</span>${DAT_TOOL_LINKS.map(([view, label]) => `<a data-dat-go href="${esc(datUrl({ view }))}">${esc(label)}${view === 'mistakes' && dueMistakes ? ` <small id="dat-mistakes-due">${dueMistakes} due</small>` : ''}</a>`).join('')}${DAT_TOOL_SOON.map(([, label]) => `<span class="dat-tool-soon">${esc(label)} <small>Soon</small></span>`).join('')}</nav>`
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
    case 'home':
      return datRenderLanding();
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
