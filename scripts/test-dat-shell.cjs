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
const DATA_FILES = [...fs.readFileSync('dat.js', 'utf8').matchAll(/'(dat-[a-z0-9-]+\.json)\?v=\d+'/g)].map(m => m[1]);
const PENDING = new Set(
  (fs.readFileSync('dat.js', 'utf8').match(/DAT_DATA_PENDING = new Set\(\[([^\]]*)\]\)/) || ['', ''])[1]
    .split(',')
    .map(s => s.trim().replace(/^'|'$/g, ''))
    .filter(Boolean)
);
const onDisk = name => fs.existsSync('data/' + name);

// `modules` loads further track scripts into the same realm after dat.js, so a test can drive a
// view through the real router instead of a second hand-built page harness.
function harness({ url = 'http://localhost/dat', fault = null, modules = [], now = null } = {}) {
  const dom = new JSDOM('<!doctype html><div id="app"></div>', { url, runScripts: 'outside-only' });
  const w = dom.window,
    context = dom.getInternalVMContext();
  if (now) {
    const NativeDate = w.Date;
    w.Date = class extends NativeDate {
      constructor(...args) {
        super(...(args.length ? args : [now]));
      }
      static now() {
        return new NativeDate(now).getTime();
      }
    };
  }
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
    // Serves the real data/ files; faults apply to the outline only (the other files load).
    fetch: async file => {
      fetches.push(file);
      const name = file.replace(/^data\//, '').split('?')[0],
        faulted = fetchFault && name === 'dat-outline.json';
      if (faulted && fetchFault === 'network') throw Error('Offline');
      if ((faulted && fetchFault === '503') || !onDisk(name)) return { ok: false };
      return {
        ok: true,
        json: async () => {
          if (faulted && fetchFault === 'json') throw Error('Invalid JSON');
          if (faulted && fetchFault === 'shape') return { concepts: [] };
          return JSON.parse(fs.readFileSync('data/' + name, 'utf8'));
        },
      };
    },
  });
  vm.runInContext(fs.readFileSync('academy.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('dat.js', 'utf8'), context);
  if (modules.length) {
    // Production loads the shared storage guards and scheduler before any DAT runner.
    vm.runInContext(fs.readFileSync('dat-drill-engine.js', 'utf8'), context);
    for (const file of modules) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  }
  const run = code => vm.runInContext(code, context);
  return {
    w,
    dom,
    run,
    fetches,
    removed,
    store,
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
  // One fetch per registered data file, the outline included; nothing outside data/dat-*.
  assert.equal(h.fetches.length, DATA_FILES.length);
  assert.ok(h.fetches.every(f => /^data\/dat-[a-z0-9-]+\.json\?v=\d+$/.test(f)));
  assert.ok(h.fetches.some(f => f.startsWith('data/dat-outline.json?v=')));
  const absent = DATA_FILES.filter(f => !onDisk(f)).map(f => f.replace(/\.json$/, ''));
  assert.deepEqual(
    absent.filter(k => !PENDING.has(k)),
    [],
    'every registered non-pending data file exists on disk'
  );
  assert.equal(h.run('DAT.loaded'), true);
  assert.equal(h.run('DAT.course.units.length'), 6, 'six seed units merged');
  assert.ok(h.run('DAT.questions.length') >= 20, 'at least the twenty seed items merged');
  assert.equal(h.run('DAT.course.chapters.length'), 16);
  assert.ok(h.run('DAT.cards.length') >= 12, 'at least the seed cards merged');
  assert.equal(h.find('header').dataset.active, 'dat');
  assert.match(h.text('main.dat-landing h1'), /^DAT preparation/);
  assert.equal(h.text('main h1 .academy-status'), 'Beta');
  assert.equal(h.w.document.querySelectorAll('.dat-format-table tbody tr').length, 5);
  assert.match(h.text('.dat-format-table'), /Survey of the Natural Sciences.*100.*90/s);
  const cards = [...h.w.document.querySelectorAll('.dat-section-card')].map(c => c.dataset.datSection);
  assert.deepEqual(cards, ['bio', 'gchem', 'ochem', 'pat', 'rc', 'qr']);
  assert.match(
    h.text('.course-hero-index'),
    new RegExp(h.run('DAT.questions.length') + '\\s*practice items'),
    'the landing counts the merged bank, not a fixed seed total'
  );
  assert.match(h.text('.course-hero-index'), /6 lesson units drafted/);
  assert.match(h.text('.dat-tools'), /Mistake log/);
  assert.match(
    h.text('.dat-tools'),
    /Lessons\s+Soon.*Progress\s+Soon.*Coverage map\s+Soon.*Full-length rehearsal\s+Soon/s
  );
  assert.ok(h.find('.dat-tools a[href*="view=plan"]'), 'the schedule is a link once the planner exists');
  assert.equal(h.find('.dat-tools a[href*="view=course"]'), null, 'unbuilt tools are not links');
  assert.equal(h.find('#dat-data-retry'), null);
  // A second render uses the cached data.
  const fetched = h.fetches.length;
  await h.go('');
  assert.equal(h.fetches.length, fetched);
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
  assert.equal(h.text('main.dat-notice .label'), 'DAT · Beta');
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

test('a saved plan keeps Today as default while active, day-off and ended views link to the DAT overview', async () => {
  for (const [now, heading] of [
    ['2026-09-23T12:00:00', 'Today'],
    ['2026-09-27T12:00:00', 'Next study day'],
    ['2026-12-06T12:00:00', 'This schedule has ended.'],
  ]) {
    const h = harness({ now, modules: ['dat-plan-engine.js', 'dat-plan.js'] });
    // Use the real shared URL helper so this tests production gate/offline preservation.
    h.run("const SEC_PATHS = { dat: 'dat' }");
    const app = fs.readFileSync('app.js', 'utf8');
    h.run(app.slice(app.indexOf('function sectionUrl('), app.indexOf('function navigateSection(')));
    const plan = h.w.DatPlanCore.build({
      startDate: '2026-09-21',
      testDate: '2026-12-05',
      hoursPerWeek: 22,
      daysOff: ['Sun'],
      features: ['drill', 'pat', 'qr', 'rc'],
    });
    assert.ok(h.w.DatPlanCore.validPlan(plan));
    h.store.set('cs-dat-plan', JSON.stringify(plan));
    h.store.set('cs-dat-log', '[]');
    const saved = [...h.store];
    const click = async selector => {
      h.find(selector).click();
      await new Promise(resolve => setTimeout(resolve, 0));
    };
    const expectOverview = async () => {
      const link = h.find('.dat-plan-back a[href*="view=home"]');
      assert.ok(link, `${heading}: overview link is available`);
      assert.equal(link.textContent, 'DAT overview');
      assert.equal(link.getAttribute('href'), '/dat?gates=prod&offline=1&view=home');
      await click('.dat-plan-back a[href*="view=home"]');
      assert.equal(h.w.location.search, '?gates=prod&offline=1&view=home');
      assert.ok(h.find('main.dat-landing'));
      assert.equal(h.w.document.querySelectorAll('.dat-section-card').length, 6);
      assert.equal(
        h.find('.dat-tools a[href*="view=mistakes"]').getAttribute('href'),
        '/dat?gates=prod&offline=1&view=mistakes'
      );
    };
    await h.go('gates=prod&offline=1');
    assert.equal(h.text('main h1'), heading, 'the saved plan remains the default');
    await expectOverview();
    await click('.dat-tools a[href*="view=plan"]');
    assert.ok(h.find('main.dat-plan'), 'the existing overview can reopen the full schedule');
    await expectOverview();
    await h.go('gates=prod&offline=1&view=today');
    assert.equal(h.text('main h1'), heading);
    await click('.dat-plan-back a[href*="view=plan"]');
    assert.ok(h.find('main.dat-plan'));
    await click('.dat-plan-back a:not([href*="view=home"])');
    assert.equal(h.text('main h1'), heading, 'Back to today still opens the saved plan');
    assert.deepEqual([...h.store], saved, 'navigation must not alter the plan or other saved DAT data');
    h.close();
  }
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
  // The next render fetches everything again.
  const fetched = h.fetches.length;
  await h.go('');
  assert.equal(h.fetches.length, fetched * 2);
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
  // Later milestones append their own modules; DAT-01 only fixes the first two and their order.
  assert.match(app, /dat: \[\s*'study-storage\.js\?v=\d+',\s*'dat\.js\?v=\d+',?[\s\]]/, 'SECTION_SCRIPTS.dat');
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
  assert.doesNotMatch(gates, /dat: \{ path: 'dat'/, 'the DAT is open, so the gate smoke must not treat it as closed');
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
  assert.match(backup, /dat-r-\(\?:drill\|review\|pat\|qr\|rc\|sim\)/, 'backup resume regex');
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
  assert.match(index, /<link rel="stylesheet" href="\/dat\.css\?v=\d+">/, 'stylesheet');
});

test('the app.js keydown guard bails out for the DAT periodic-table overlay', () => {
  const app = fs.readFileSync('app.js', 'utf8');
  const guard = app.match(/if \(document\.querySelector\('([^']+)'\)\) return;[^\n]*open overlay/);
  assert.ok(guard, 'app.js global keydown overlay guard');
  const selectors = guard[1].split(',').map(s => s.trim());
  // dat-practice.js opens the periodic table as its own overlay class, not .modal or <dialog>,
  // so Enter would otherwise reach the [data-next] button behind it.
  const markup = fs.readFileSync('dat-practice.js', 'utf8').match(/<div class="([^"]+)" id="dat-periodic-modal"/);
  assert.ok(markup, 'dat-practice.js periodic-table overlay markup');
  assert.ok(
    markup[1].split(/\s+/).some(cls => selectors.includes('.' + cls)),
    'the shell keydown guard covers the periodic-table overlay class (' + markup[1] + ')'
  );
});

test('dat.css re-shows the landing count block at the width mcat-course.css hides it', () => {
  // The bank counts are DAT-01 acceptance criteria, so they have to survive on phones even
  // though the shared .course-hero-index rule hides itself there for the MCAT course hero.
  const hide = fs
    .readFileSync('mcat-course.css', 'utf8')
    .match(/@media\s*\(max-width:\s*(\d+)px\)\s*\{[^@]*?\.course-hero-index\s*\{\s*display:\s*none/);
  assert.ok(hide, 'mcat-course.css phone rule hiding .course-hero-index');
  const blocks = [
    ...fs.readFileSync('dat.css', 'utf8').matchAll(/@media\s*\(max-width:\s*(\d+)px\)\s*\{([\s\S]*?)\n\}/g),
  ];
  assert.ok(
    blocks.some(
      b => Number(b[1]) >= Number(hide[1]) && /\.dat-landing\s+\.course-hero-index\s*\{[^}]*display:\s*block/.test(b[2])
    ),
    'dat.css shows .dat-landing .course-hero-index at or below ' + hide[1] + 'px'
  );
});

test('resetDatState drops the in-flight run of every runner on the page, Reading Comprehension included', async () => {
  // resetDatState only resets state: it does not replace the view, so a runner it forgets to
  // call keeps its still-mounted screen wired to the workspace that has just been thrown away
  // and writes that run's report into the next one.
  const h = harness();
  await h.go('');
  const log = [];
  h.w.log = log;
  h.w.DatRehearsal = { reset: () => log.push('rehearsal') };
  h.w.DatPractice = { reset: () => log.push('practice') };
  h.w.DatPat = { reset: () => log.push('pat') };
  h.w.DatRc = { reset: () => log.push('rc') };
  h.w.resetDatState();
  assert.deepEqual(log, ['rehearsal', 'practice', 'pat', 'rc'], 'every runner module is reset');
  // The hooks run while the caches they clear are still there to clear.
  assert.equal(h.run('DAT.attemptStores'), null);
  assert.equal(h.run('DAT.rc'), null);
  // A module that has not shipped yet is skipped, not thrown over.
  h.w.DatRc = {};
  h.w.DatPat = undefined;
  assert.doesNotThrow(() => h.w.resetDatState());
  h.close();
});

test('the landing counts the reading questions on their own line, from the passages it loaded', async () => {
  const h = harness();
  await h.go('');
  const index = h.text('.course-hero-index');
  const rc = h.run('DAT.rc.passages.reduce((n, p) => n + (p.questions ? p.questions.length : 0), 0)');
  assert.ok(rc > 0, 'the passages carry questions');
  // Not folded into the headline number: "practice items" stays merged bank items only (N1).
  assert.match(index, new RegExp(h.run('DAT.questions.length') + '\\s*practice items'));
  assert.match(index, new RegExp(rc + ' reading-comprehension questions'));
  assert.doesNotMatch(index, new RegExp(h.run('DAT.questions.length') + ' \\+ ' + rc), 'no merged total');
  // Driven by the data: with the passages unavailable the line is absent rather than wrong.
  h.run('DAT.rc = null');
  h.run('renderDATEntry()');
  await new Promise(r => setTimeout(r, 0));
  assert.doesNotMatch(h.text('.course-hero-index'), /reading-comprehension questions/);
  h.close();
});

// Reads dat.css as rules: [{ media, selector, body }]. The file has no nested rules outside
// @media, which is all this needs to understand.
function cssRules(css) {
  const out = [];
  const scan = (text, media) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) return;
      const head = text.slice(i, open).trim();
      if (head.startsWith('@media')) {
        let depth = 1,
          j = open + 1;
        while (j < text.length && depth) {
          if (text[j] === '{') depth++;
          else if (text[j] === '}') depth--;
          j++;
        }
        scan(text.slice(open + 1, j - 1), head.replace(/^@media\s*/, ''));
        i = j;
      } else {
        const close = text.indexOf('}', open);
        out.push({ media, selector: head, body: text.slice(open + 1, close).trim() });
        i = close + 1;
      }
    }
  };
  scan(css.replace(/\/\*[\s\S]*?\*\//g, ''), null);
  return out;
}
const decl = (rule, name) => (new RegExp('(?:^|;)\\s*' + name + '\\s*:([^;]+)').exec(rule.body) || [])[1]?.trim();
const numbers = value => [...String(value).matchAll(/-?[\d.]+/g)].map(m => Number(m[0]));

test('dat.css draws a keyhole opening at the scale of the object figure, not at a cap of its own', () => {
  // Apertures is the one subtest whose stem promises both are drawn to one scale, and a
  // wrong-size opening is a keyed distractor, so the openings have to be measured from the width
  // the object figure actually gets rather than from a second constant that only agrees with it
  // at full size.
  const Core = require('../dat-pat-engine.js');
  const rendered = Core.render(Core.generate('keyholes', 7, 2));
  const canvas = svg => Number(/viewBox="0 0 ([\d.]+)/.exec(svg)[1]);
  const objectUnits = canvas(rendered.figure),
    openingUnits = canvas(rendered.options[0]);
  const rules = cssRules(fs.readFileSync('dat.css', 'utf8'));
  const frameInset = media => {
    const frame = rules.filter(r => r.selector === '.dat-pat-figure' && (media ? r.media === media : !r.media));
    const padding = frame
      .map(r => decl(r, 'padding'))
      .filter(Boolean)
      .pop();
    const border = rules
      .filter(r => r.selector === '.dat-pat-figure' && !r.media)
      .map(r => decl(r, 'border'))
      .filter(Boolean)
      .pop();
    return 2 * numbers(padding)[1] + 2 * numbers(border)[0];
  };
  const figure = rules.find(r => !r.media && /\.dat-pat-opts-svg:has\(\.dat-pat-aperture\)$/.test(r.selector));
  assert.ok(figure, 'dat.css sizes the keyhole openings from their own rule');
  assert.deepEqual(
    numbers(decl(figure, '--dat-key-fig')),
    [objectUnits, 100, frameInset(null)],
    'the object width the openings are measured from is the figure canvas inside its frame'
  );
  assert.deepEqual(
    numbers(decl(figure, '--dat-key-open')),
    [openingUnits, objectUnits],
    'an opening is its own canvas as a fraction of the object canvas'
  );
  // cqw only resolves against a query container, so the runner has to be one.
  const container = rules.find(r => !r.media && r.selector === '.dat-pat-run');
  assert.equal(decl(container, 'container-type'), 'inline-size');
  // No independent pixel cap may survive on an aperture, or the two scales part again.
  const option = rules.find(r => !r.media && /:has\(\.dat-pat-aperture\)[^,]*svg$/.test(r.selector));
  assert.equal(decl(option, 'width'), 'var(--dat-key-open)');
  assert.equal(decl(option, 'max-width'), '100%');
  // A grid column can squeeze an option below its width; the track is at least one opening wide.
  assert.match(decl(figure, 'grid-template-columns'), /var\(--dat-key-open\)/);
  // The frame loses padding on phones, so the width the openings are measured from follows it.
  const phone = rules.filter(r => r.media && /\.dat-pat-opts-svg:has\(\.dat-pat-aperture\)$/.test(r.selector));
  assert.equal(phone.length, 1, 'one phone override');
  assert.deepEqual(numbers(decl(phone[0], '--dat-key-fig')), [objectUnits, 100, frameInset(phone[0].media)]);
});

test('dat.css gives View Recognition candidates room to show a dashed line on a phone', () => {
  // The dashed-versus-solid interior lines are the whole discrimination in that subtest, and four
  // candidates sharing a 320 px row cannot draw them.
  const rules = cssRules(fs.readFileSync('dat.css', 'utf8'));
  const base = rules.find(r => !r.media && r.selector === '.dat-pat-opt-svg svg');
  const cap = numbers(decl(base, 'max-width'))[0];
  const grid = rules.find(r => r.media && /\.dat-pat-opts-svg:has\(\.dat-pat-view\)$/.test(r.selector));
  assert.ok(grid, 'a phone rule for the candidate grid');
  assert.match(decl(grid, 'grid-template-columns'), /repeat\(2,/, 'two columns, not four squeezed ones');
  const option = rules.find(r => r.media && /:has\(\.dat-pat-view\)[^,]*svg$/.test(r.selector));
  assert.ok(numbers(decl(option, 'max-width'))[0] >= 1.5 * cap, 'and half again the desktop cap to fill them');
});

test('the mixed form calls every subtest by one name, from the first item to the results table', async () => {
  const h = harness({ modules: ['dat-pat-engine.js', 'dat-pat.js'] });
  await h.go('view=pat&set=full&level=2');
  assert.equal(h.text('.dat-pat-count'), 'Item 1 of 90');
  const seen = [];
  for (let i = 0; i < 90; i++) {
    const name = h.text('.dat-pat-eyebrow').split('·')[0].trim();
    if (!seen.includes(name)) seen.push(name);
    const option = h.find('#dat-pat-opt-0');
    assert.ok(option && !option.disabled, 'item ' + (i + 1) + ' is answerable');
    option.click();
  }
  const rows = [...h.w.document.querySelectorAll('.dat-pat-form-table tbody th')].map(th => th.textContent.trim());
  assert.equal(rows.length, 6, 'a result row per subtest');
  // The name a learner answered under is the name they look up afterwards.
  assert.deepEqual(seen, rows, 'the runner and the results table use one vocabulary');
  assert.deepEqual(
    seen,
    JSON.parse(h.run('JSON.stringify(DAT.outline.patSubtests.map(s => s.alias))')),
    'and it is the outline vocabulary, not a third one invented in the page'
  );
  h.close();
});
