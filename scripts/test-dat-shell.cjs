// The DAT track shell (dat.js) in jsdom: router dispatch for every pre-registered view, the
// not-built notice for unbuilt or unknown views, the landing page, the outline loader with
// faulted responses, pauseDatTools / resetDatState, the saving-paused listener pair, the
// `dat` reset scope in app.js, and mcat.js + dat.js evaluating in one global scope.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const VIEWS = {
  drill: ['DatPractice', 'render'],
  mistakes: ['DatPractice', 'mistakes'],
  pat: ['DatPat', 'render'],
  qr: ['DatQr', 'render'],
  plan: ['DatPlan', 'render'],
  progress: ['DatProgress', 'render'],
  rc: ['DatRc', 'render'],
  coverage: ['DatCoverage', 'render'],
  rehearsal: ['DatRehearsal', 'entry'],
  quality: ['DatItemQuality', 'render'],
};
const OUTLINE = fs.readFileSync('data/dat-outline.json', 'utf8');

function harness({ url = 'http://localhost/dat', fault = null } = {}) {
  const dom = new JSDOM('<!doctype html><div id="app"></div>', { url, runScripts: 'outside-only' });
  const w = dom.window,
    context = dom.getInternalVMContext();
  const fetches = [],
    removed = [],
    store = new Map();
  let fetchFault = fault;
  Object.assign(w, {
    IS_LOCAL_PREVIEW: true,
    LETTERS: ['A', 'B', 'C', 'D', 'E', 'F'],
    sectionUrl: id => '/' + (id === 'socrates' ? 'learn' : id === 'reference' ? 'medicine' : id),
    stopTimer() {
      w.__timerStops = (w.__timerStops || 0) + 1;
    },
    el: html => {
      const t = w.document.createElement('template');
      t.innerHTML = html;
      return t.content.firstElementChild;
    },
    esc: value =>
      String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
    setView: node => w.document.querySelector('#app').replaceChildren(node),
    topbar: active => w.el(`<header data-active="${active}">Cortex</header>`),
    StudyStorage: {
      paused: false,
      read: (key, fallback) => (store.has(key) ? JSON.parse(store.get(key)) : fallback),
      watch() {},
      write(key, value) {
        store.set(key, JSON.stringify(value));
        return true;
      },
      remove(key) {
        removed.push(key);
        w.localStorage.removeItem(key);
      },
    },
    fetch: async file => {
      fetches.push(file);
      if (fetchFault === 'network') throw Error('Offline');
      if (fetchFault === '503') return { ok: false };
      return {
        ok: true,
        json: async () => {
          if (fetchFault === 'json') throw Error('Invalid JSON');
          if (fetchFault === 'shape') return { concepts: [] };
          return JSON.parse(OUTLINE);
        },
      };
    },
  });
  vm.runInContext(fs.readFileSync('academy.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('dat.js', 'utf8'), context);
  const run = code => vm.runInContext(code, context);
  return {
    w,
    dom,
    run,
    fetches,
    removed,
    find: selector => w.document.querySelector(selector),
    text: selector => w.document.querySelector(selector)?.textContent.trim(),
    set fault(value) {
      fetchFault = value;
    },
    go(query) {
      w.history.replaceState({}, '', '/dat' + (query ? '?' + query : ''));
      return w.renderDATEntry();
    },
    close: () => dom.window.close(),
  };
}

test('the landing renders from the outline with the availability tag, format table, six cards and one CTA', async () => {
  const h = harness();
  await h.go('');
  assert.equal(h.fetches.length, 1);
  assert.match(h.fetches[0], /^data\/dat-outline\.json\?v=\d+$/);
  assert.equal(h.run('DAT.loaded'), true);
  assert.equal(h.find('header').dataset.active, 'dat');
  assert.match(h.text('main.dat-landing h1'), /^DAT preparation/);
  assert.equal(h.text('main h1 .academy-status'), 'Local preview');
  assert.equal(h.w.document.querySelectorAll('.dat-format-table tbody tr').length, 5);
  assert.match(h.text('.dat-format-table'), /Survey of the Natural Sciences.*100.*90/s);
  const cards = [...h.w.document.querySelectorAll('.dat-section-card')].map(c => c.dataset.datSection);
  assert.deepEqual(cards, ['bio', 'gchem', 'ochem', 'pat', 'rc', 'qr']);
  assert.equal(h.w.document.querySelectorAll('.course-actions .btn').length, 1);
  assert.equal(h.find('#dat-start').getAttribute('href'), '/dat?view=drill&section=mixed&n=15');
  assert.match(h.text('.course-hero-index'), /0\s*practice items/);
  assert.match(h.text('.dat-tools'), /Lessons.*Schedule.*Mistake log.*Progress.*Coverage map.*Full-length rehearsal/s);
  assert.equal(h.find('#dat-data-retry'), null);
  // A second render uses the cached outline.
  await h.go('');
  assert.equal(h.fetches.length, 1);
  // Only DAT-prefixed names: no MCAT delegate targets leak into the shell.
  assert.equal(h.find('#opts, #conf, [data-course-view], [data-v2-go], .flash-stage'), null);
  h.close();
});

test('the CTA and section cards navigate inside the track and unbuilt views show the notice', async () => {
  const h = harness();
  await h.go('');
  h.find('#dat-start').click();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(h.w.location.pathname + h.w.location.search, '/dat?view=drill&section=mixed&n=15');
  assert.match(h.text('main.dat-notice h1'), /not built yet/);
  assert.match(h.text('main.dat-notice'), /drill/);
  assert.equal(h.text('main.dat-notice .label'), 'DAT · Local preview');
  h.find('#dat-back').click();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(h.w.location.pathname + h.w.location.search, '/dat');
  assert.ok(h.find('main.dat-landing'));
  h.close();
});

test('every registered view dispatches to its module when present and to the notice when absent', async () => {
  const h = harness();
  for (const [view, [module, method]] of Object.entries(VIEWS)) {
    await h.go('view=' + view);
    assert.match(h.text('main.dat-notice h1'), /not built yet/, view + ' without module');
    const calls = [];
    h.w[module] = { [method]: (...args) => calls.push(args) };
    await h.go('view=' + view + '&n=7');
    assert.equal(calls.length, 1, view + ' dispatched');
    assert.deepEqual(calls[0], [], view + ' receives no arguments; it reads location.search itself');
    delete h.w[module];
  }
  // The course view has three named targets.
  await h.go('view=course');
  assert.match(h.text('main.dat-notice h1'), /not built yet/);
  const course = [];
  h.w.renderDatCourseHome = () => course.push('home');
  h.w.renderDatCourseUnit = unit => course.push('unit:' + unit);
  h.w.renderDatCoursePlacement = () => course.push('placement');
  await h.go('view=course');
  await h.go('view=course&unit=protists-fungi');
  await h.go('view=course&unit=starting-check');
  assert.deepEqual(course, ['home', 'unit:protists-fungi', 'placement']);
  const repair = [];
  h.w.renderDatRepairHub = () => repair.push(1);
  await h.go('view=repair');
  assert.equal(repair.length, 1);
  // Unknown views render the notice without naming a module; the empty view is the landing.
  await h.go('view=nonsense');
  assert.match(h.text('main.dat-notice h1'), /not built yet/);
  assert.doesNotMatch(h.text('main.dat-notice'), /registered/);
  await h.go('view=');
  assert.ok(h.find('main.dat-landing'));
  h.close();
});

test('Today defers to DatPlan.today() only when it reports that it rendered', async () => {
  const h = harness();
  let rendered = false;
  h.w.DatPlan = { today: () => rendered };
  await h.go('view=today');
  assert.ok(h.find('main.dat-landing'), 'no plan → landing');
  rendered = true;
  h.w.setView(h.w.el('<div id="plan-view"></div>'));
  await h.go('');
  assert.equal(h.find('main.dat-landing'), null, 'a rendered Today card replaces the landing');
  h.close();
});

test('pauseDatTools runs every registered pauser, on navigation and on demand, and survives a throw', async () => {
  const h = harness();
  const log = [];
  h.run('DAT.pausers.push(() => log.push("drill"))');
  h.w.log = log;
  h.run('DAT.pausers.push(() => { throw Error("clock already stopped"); })');
  h.run('DAT.pausers.push(() => log.push("pat"))');
  h.w.pauseDatTools();
  assert.deepEqual(log, ['drill', 'pat']);
  await h.go('');
  assert.deepEqual(log, ['drill', 'pat', 'drill', 'pat'], 'renderDATEntry pauses before it renders');
  assert.equal(h.w.__timerStops, 1, 'the shared clinical timer is stopped too');
  h.close();
});

test('resetDatState pauses, forgets loaded data and clears only the cs-dat-r-* resume blobs', async () => {
  const h = harness();
  await h.go('');
  const log = [];
  h.w.log = log;
  h.run('DAT.pausers.push(() => log.push("paused"))');
  h.w.DatRehearsal = { reset: () => log.push('rehearsal reset') };
  for (const [key, value] of [
    ['cs-dat-r-drill', '{"idx":1}'],
    ['cs-dat-r-sim', '{}'],
    ['cs-dat-log', '[]'],
    ['cs-dat-course-v1', '{}'],
    ['cs-mcat-r-drill', '{}'],
  ])
    h.w.localStorage.setItem(key, value);
  h.run('DAT.questions = [{ id: "x" }]; DAT.course = { units: [] };');
  h.w.resetDatState();
  assert.deepEqual(log, ['paused', 'rehearsal reset']);
  assert.equal(h.run('DAT.loaded'), false);
  assert.equal(h.run('DAT.outline'), null);
  assert.equal(h.run('DAT.course'), null);
  assert.equal(h.run('DAT.questions.length'), 0);
  assert.deepEqual(h.removed.sort(), ['cs-dat-r-drill', 'cs-dat-r-sim']);
  assert.equal(h.w.localStorage.getItem('cs-dat-log'), '[]');
  assert.equal(h.w.localStorage.getItem('cs-mcat-r-drill'), '{}');
  // The next render fetches again.
  await h.go('');
  assert.equal(h.fetches.length, 2);
  assert.equal(h.run('DAT.loaded'), true);
  h.close();
});

test('a faulted outline stays retryable: the landing shows the notice and the retry button reloads', async () => {
  for (const fault of ['503', 'network', 'json', 'shape']) {
    const h = harness({ fault });
    await h.go('');
    assert.equal(h.run('DAT.loaded'), false, fault);
    assert.equal(h.run('DAT.outline'), null, fault);
    assert.ok(h.find('main.dat-landing'), fault + ' still renders the landing');
    assert.equal(h.find('.dat-format-table'), null, fault + ' no format table without an outline');
    assert.match(h.text('.course-notice') || '', /content outline/, fault);
    h.fault = null;
    h.find('#dat-data-retry').click();
    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));
    assert.equal(h.run('DAT.loaded'), true, fault + ' recovered');
    assert.ok(h.find('.dat-format-table'), fault + ' format table after retry');
    assert.equal(h.find('#dat-data-retry'), null, fault + ' notice gone');
    h.close();
  }
});

test('saving paused stops registered clocks and recovery restarts only the one still on screen', async () => {
  const h = harness();
  await h.go('');
  const log = [];
  h.w.log = log;
  h.run(`
    DAT.pausers.push(() => { log.push('drill stop'); return { selector: '#dat-drill-clock', resume: () => log.push('drill resume') }; });
    DAT.pausers.push(() => { log.push('pat stop'); return { selector: '#dat-pat-clock', resume: () => log.push('pat resume') }; });
    DAT.pausers.push(() => log.push('plain stop'));
  `);
  h.w.setView(h.w.el('<main><span id="dat-drill-clock">12:00</span><p id="dat-save-status">Saving failed.</p></main>'));
  h.w.dispatchEvent(new h.w.Event('study-storage-paused'));
  assert.deepEqual(log, ['drill stop', 'pat stop', 'plain stop']);
  h.w.dispatchEvent(new h.w.Event('study-storage-recovered'));
  assert.deepEqual(log, ['drill stop', 'pat stop', 'plain stop', 'drill resume']);
  assert.match(h.text('#dat-save-status'), /saved in this browser/);
  // A second recovery does nothing: the list was consumed.
  h.w.dispatchEvent(new h.w.Event('study-storage-recovered'));
  assert.equal(log.length, 4);
  h.close();
});

test('the app.js reset scope `dat` removes cs-dat-* only', () => {
  const app = fs.readFileSync('app.js', 'utf8');
  const code =
    app.slice(app.indexOf('const SPECIALTIES = ['), app.indexOf('const NAME_BY_KEY')) +
    app.slice(app.indexOf('function studyResetData('), app.indexOf('function openResetProgress('));
  const context = vm.createContext({});
  vm.runInContext(code, context);
  const data = {
    'cs-dat-log': '[]',
    'cs-dat-course-v1': '{}',
    'cs-dat-r-pat': '{}',
    'cs-mcat-course-v1': '{}',
    'cs-mcat-log': '[]',
    'cs-progress': '{"cardiology":{"xp":1}}',
    'cs-mode': 'timed',
    'cs-academy-today-v1': '{}',
  };
  context.data = data;
  const result = vm.runInContext('studyResetData(data, "dat")', context);
  assert.deepEqual(Object.keys(result).sort(), [
    'cs-academy-today-v1',
    'cs-mcat-course-v1',
    'cs-mcat-log',
    'cs-mode',
    'cs-progress',
  ]);
  const mcat = vm.runInContext('studyResetData(data, "mcat")', context);
  assert.ok(Object.keys(mcat).includes('cs-dat-log'), 'the MCAT scope never touches DAT records');
  assert.throws(() => vm.runInContext('studyResetData(data, "dental")', context), /supported reset scope/);
});

test('mcat.js and dat.js evaluate in one global scope with both entries intact', () => {
  const h = harness();
  const context = h.dom.getInternalVMContext();
  h.w.location.hash = '';
  vm.runInContext(fs.readFileSync('mcat.js', 'utf8'), context);
  assert.equal(typeof h.w.renderMCATEntry, 'function');
  assert.equal(typeof h.w.renderDATEntry, 'function');
  assert.equal(typeof h.w.resetMcatState, 'function');
  assert.equal(typeof h.w.resetDatState, 'function');
  assert.equal(typeof h.w.pauseDatTools, 'function');
  assert.equal(h.run('typeof MCAT'), 'object');
  assert.equal(h.run('typeof DAT'), 'object');
  assert.notEqual(h.run('MCAT'), h.run('DAT'));
  h.close();
});

test('the shared shell registers the track everywhere DAT-01 promises', () => {
  const app = fs.readFileSync('app.js', 'utf8'),
    academy = fs.readFileSync('academy.js', 'utf8'),
    backup = fs.readFileSync('study-backup.js', 'utf8'),
    today = fs.readFileSync('academy-today.js', 'utf8'),
    curriculum = fs.readFileSync('academy-curriculum.js', 'utf8'),
    portfolio = fs.readFileSync('academy-portfolio-core.js', 'utf8'),
    index = fs.readFileSync('index.html', 'utf8');
  assert.match(app, /dat: \['study-storage\.js\?v=\d+', 'dat\.js\?v=\d+'\]/, 'SECTION_SCRIPTS.dat');
  assert.match(app, /case 'dat':\s*await window\.renderDATEntry\(\);/, 'openSection case');
  assert.match(app, /if \(key !== 'dat'\) window\.pauseDatTools\?\.\(\);/, 'navigation pauser');
  assert.match(academy, /window\.pauseDatTools\?\.\(\);/, 'catalog pauser');
  assert.match(app, /data-go="dat"[^>]*>\s*<span class="mi-copy"><span class="mi-name">DAT Prep<\/span>/, 'menu item');
  assert.match(app, /\['mcat', 'stats', 'dat'\]\.includes\(active\)/, 'menu active state');
  assert.match(app, /\['clinical', 'medicine', 'mcat', 'dat', 'all'\]/, 'reset scopes');
  const info = app.match(/dat: \{\s*label: '([^']+)',\s*badge: '([^']+)'/);
  assert.ok(info, 'SECTION_INFO.dat');
  assert.equal(info[1], 'DAT');
  assert.equal(info[2], 'Under construction');
  const gates = fs.readFileSync('scripts/smoke-public-gates.mjs', 'utf8');
  assert.match(gates, /dat: \{ path: 'dat', label: 'DAT'/, 'smoke CLOSED.dat label equals SECTION_INFO.dat.label');
  for (const key of [
    'cs-dat-log',
    'cs-dat-exam-reviews',
    'cs-dat-course-v1',
    'cs-dat-q',
    'cs-dat-srs',
    'cs-dat-plan',
    'cs-dat-rehearsal-v1',
    'cs-dat-repairs-v1',
    'cs-dat-passage-reviews',
    'cs-dat-item-reports-v1',
  ])
    assert.ok(backup.includes(`'${key}'`), 'backup registers ' + key);
  assert.match(backup, /dat-r-\(\?:drill\|pat\|qr\|rc\|sim\)/, 'backup resume regex');
  assert.match(today, /read\('cs-dat-course-v1'\)/, 'Today reader');
  assert.match(curriculum, /dat: '\/dat'/, 'curriculum path');
  assert.match(curriculum, /return 'dat:' \+ p\.get\('unit'\)/, 'curriculum contextKey');
  for (const key of ['subtest', 'set', 'n', 'topic', 'review', 'd'])
    assert.ok(
      new RegExp(`\\b${key}\\b`).test(curriculum.match(/queryKeys = new Set\(\s*'([^']+)'/)[1]),
      'queryKey ' + key
    );
  assert.match(portfolio, /'cs-dat-course-v1'/, 'portfolio source');
  assert.match(portfolio, /'DAT lesson record'/, 'portfolio label');
  assert.match(index, /<link rel="stylesheet" href="dat\.css\?v=\d+">/, 'stylesheet');
});
