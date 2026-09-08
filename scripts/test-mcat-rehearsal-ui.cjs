/* Runs product handlers in jsdom with isolated storage and controlled clocks.
 * This is a DOM test, not a real-browser or visual acceptance walkthrough.
 * Provide jsdom as a development dependency or through NODE_PATH.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const crypto = require('node:crypto').webcrypto;
const Core = require('../mcat-rehearsal-engine.js');
const manifest = JSON.parse(fs.readFileSync('data/mcat-rehearsals.json'));
const KEY = 'cs-mcat-rehearsal-v1',
  RESUME = 'cs-mcat-r-sim';
const START = 1800000000000;
function harness(seed = new Map(), start = START, path = '/mcat?view=rehearsal') {
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: 'http://localhost' + path,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    storageQuota: 20000000,
  });
  const w = dom.window,
    context = dom.getInternalVMContext(),
    timers = new Map(),
    errors = [];
  let clock = start,
    sequence = 0,
    timerId = 0,
    failure = null,
    fetchFailure = false,
    gate = null,
    renders = 0;
  const NativeDate = w.Date;
  w.Date = class extends NativeDate {
    constructor(...args) {
      super(...(args.length ? args : [clock]));
    }
    static now() {
      return clock;
    }
  };
  w.addEventListener('error', event => {
    errors.push(event.error);
    event.preventDefault();
  });
  w.setInterval = fn => {
    timers.set(++timerId, fn);
    return timerId;
  };
  w.clearInterval = id => timers.delete(id);
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  if (!w.HTMLDialogElement.prototype.showModal)
    w.HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
  if (!w.HTMLDialogElement.prototype.close)
    w.HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
  w.TextEncoder = TextEncoder;
  Object.defineProperty(w, 'crypto', { value: crypto });
  for (const [key, value] of seed) w.localStorage.setItem(key, value);
  const originalSet = w.Storage.prototype.setItem,
    originalRemove = w.Storage.prototype.removeItem;
  w.Storage.prototype.setItem = function (key, value) {
    if (failure?.(key)) throw new w.DOMException('Test quota failure', 'QuotaExceededError');
    return originalSet.call(this, key, value);
  };
  w.Storage.prototype.removeItem = function (key) {
    if (failure?.(key)) throw new w.DOMException('Test removal failure', 'QuotaExceededError');
    return originalRemove.call(this, key);
  };
  w.CortexProgress = { OWNER: 'test-owner' };
  w.el = html => {
    const template = w.document.createElement('template');
    template.innerHTML = html;
    return template.content.firstElementChild;
  };
  w.esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  w.topbar = () => w.el('<header><button id="test-home">MCAT</button></header>');
  w.sectionUrl = () => {
    const q = new w.URLSearchParams();
    for (const key of ['gates', 'offline', 'returnTo'])
      if (new w.URLSearchParams(w.location.search).get(key))
        q.set(key, new w.URLSearchParams(w.location.search).get(key));
    return '/mcat' + (q.size ? '?' + q : '');
  };
  w.setView = root => {
    renders++;
    w.document.getElementById('app').replaceChildren(root);
    w.McatRehearsal?.recordDisplay(root);
  };
  w.studySetView = w.setView;
  w.siteFooter = () => w.el('<footer></footer>');
  w.fmtTime = seconds => {
    const value = Math.max(0, Math.ceil(seconds));
    return Math.floor(value / 60) + ':' + String(value % 60).padStart(2, '0');
  };
  w.studyAttemptId = () => 'test-attempt-' + ++sequence;
  w.catTitle = key => key || 'Practice';
  w.loadJSON = (key, fallback) => {
    const value = w.localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  };
  w.fetch = async url => {
    if (gate) await gate;
    const file = String(url).split('?')[0];
    return { ok: !fetchFailure, json: async () => JSON.parse(fs.readFileSync(file)) };
  };
  const run = code => vm.runInContext(code, context);
  for (const name of [
    'study-storage.js',
    'mcat-course-engine.js',
    'mcat-v2-engine.js',
    'mcat-rehearsal-engine.js',
    'mcat.js',
    'mcat-course.js',
    'mcat-workflows.js',
    'mcat-rehearsal.js',
  ])
    run(fs.readFileSync(name, 'utf8'));
  for (const [key, file] of [
    ['questions', 'mcat-questions'],
    ['cars', 'mcat-cars'],
    ['sci', 'mcat-science-passages'],
    ['outline', 'mcat-outline'],
  ])
    run(`MCAT.${key} = ${fs.readFileSync('data/' + file + '.json', 'utf8')}`);
  run(
    'renderMCAT=()=>{coursePauseTools();sim=null;setView(el("<main><h1>MCAT home</h1></main>"));};renderLegacySimHome=()=>setView(el("<main><h1>Short sets</h1></main>"));loadMCAT=async()=>{};experimentModel=()=>null;'
  );
  const find = selector => w.document.querySelector(selector);
  const click = selector => {
    const node = find(selector);
    assert.ok(node, 'Missing ' + selector + ': ' + w.document.getElementById('app').textContent.slice(0, 250));
    node.click();
    assert.equal(errors.length, 0, errors[0]?.stack);
  };
  return {
    dom,
    w,
    run,
    find,
    click,
    errors,
    timers,
    home: selected => w.McatRehearsal.home(selected),
    snapshot: () =>
      new Map(
        Array.from({ length: w.localStorage.length }, (_, i) => {
          const key = w.localStorage.key(i);
          return [key, w.localStorage.getItem(key)];
        })
      ),
    force: (key, value) => originalSet.call(w.localStorage, key, value),
    raw: key => w.localStorage.getItem(key),
    state: () => JSON.parse(run('JSON.stringify(sim)')),
    advance(ms, tick = false) {
      clock += ms;
      if (tick) for (const callback of [...timers.values()]) callback();
      assert.equal(errors.length, 0, errors[0]?.stack);
    },
    get renders() {
      return renders;
    },
    get clock() {
      return clock;
    },
    set fail(fn) {
      failure = fn;
    },
    set fetchFail(value) {
      fetchFailure = value;
    },
    set fetchGate(value) {
      gate = value;
    },
    start(sections, mode = 'continuous', repeat = false) {
      for (const input of w.document.querySelectorAll('[name="form"]'))
        input.checked = sections.includes(manifest.forms.find(f => f.id === input.value).section);
      find(`[name="timing"][value="${mode}"]`).checked = true;
      find('[name="repeat"]').checked = repeat;
      find('#rehearsal-setup').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
      assert.equal(errors.length, 0, errors[0]?.stack);
    },
    close() {
      dom.window.close();
    },
  };
}

test('home is read-only until a learner starts/reserves; recorded exposure needs explicit repeated-practice choice', async () => {
  const seed = new Map([['cs-mcat-q', JSON.stringify({ [manifest.forms[0].discretes[0]]: { n: 1 } })]]),
    h = harness(seed);
  await h.home();
  assert.equal(h.raw(RESUME), null);
  assert.equal(h.raw(KEY), null);
  h.start(['chemPhys']);
  assert.equal(h.raw(RESUME), null);
  assert.match(h.find('#rehearsal-setup-status').textContent, /recorded or reported/);
  h.start(['chemPhys'], 'continuous', true);
  assert.ok(h.raw(RESUME));
  assert.equal(h.state().preflight.repeatAcknowledged, true);
  h.close();
});
test('all 230 question handlers preserve first/final answers and produce a compact full review without scaled scores', async () => {
  const h = harness();
  await h.home();
  h.start(Core.ORDER);
  for (let si = 0; si < 4; si++) {
    const count = Core.FORMAT[Core.ORDER[si]].questions;
    for (let index = 0; index < count; index++) {
      const answer = h.run('sim.queue[sim.si].items[sim.idx].q.answer'),
        renders = h.renders;
      if (si === 1) {
        const order = h.run('JSON.stringify(sim.queue[sim.si].items[sim.idx].q.displayOrder)');
        assert.deepEqual(
          [...h.w.document.querySelectorAll('[data-rehearsal-answer]')].map(b => Number(b.dataset.rehearsalAnswer)),
          JSON.parse(order)
        );
        assert.deepEqual(
          [...h.w.document.querySelectorAll('[data-rehearsal-answer] .key')].map(b => b.textContent),
          ['A', 'B', 'C', 'D']
        );
      }
      h.advance(1000);
      if (si === 0 && index === 0) h.click(`[data-rehearsal-answer="${(answer + 1) % 4}"]`);
      h.click(`[data-rehearsal-answer="${answer}"]`);
      assert.equal(h.renders, renders, 'Selecting an answer must not rebuild/scroll the question');
      h.click('#rehearsal-next');
    }
    h.click('#rehearsal-submit');
    if (si < 3) h.click('#rehearsal-continue');
  }
  const archived = JSON.parse(h.raw('cs-mcat-exam-reviews'))[0],
    restored = Core.unpack(archived);
  assert.equal(h.raw(RESUME), null);
  assert.equal(archived.compact, 1);
  assert.equal(
    restored.results.reduce((n, r) => n + r.correct, 0),
    230
  );
  assert.notEqual(restored.firstAnswers['0:0'].chosen, restored.answers['0:0']);
  assert.match(h.find('main').textContent, /230\/230 correct/);
  assert.match(h.find('main').textContent, /not a scaled MCAT score/);
  assert.equal(Object.keys(JSON.parse(h.raw(KEY)).questions).length, 230);
  assert.equal(JSON.parse(h.raw('cs-mcat-log')).length, 230);
  const carsQuestion = restored.queue[1].items[0].q,
    carsLabel = 'ABCD'[carsQuestion.displayOrder.indexOf(carsQuestion.answer)];
  assert.ok(
    h
      .find('[data-rehearsal-reveal="1:0"]')
      .textContent.includes('First: ' + carsLabel + ' · Final: ' + carsLabel + ' · Answer: ' + carsLabel)
  );
  const Backup = require('../study-backup.js'),
    records = { [KEY]: h.raw(KEY), 'cs-mcat-exam-reviews': h.raw('cs-mcat-exam-reviews') };
  const backup = await Backup.create(records, 'test', { crypto });
  assert.deepEqual((await Backup.parse(backup, { crypto })).data, records);
  const before = JSON.stringify(restored.results);
  h.find('#exam-reflection').value = 'Budget more time for the graph before calculating.';
  h.find('#exam-reflection').dispatchEvent(new h.w.Event('input'));
  h.click('#exam-reviewed');
  assert.equal(JSON.stringify(Core.unpack(JSON.parse(h.raw('cs-mcat-exam-reviews'))[0]).results), before);
  assert.ok(h.run('courseState.examReviews[sim.attemptId].reviewedAt'));
  h.close();
});
test('continuous reload and flexible hide/resume follow their distinct timing contracts', async () => {
  const h = harness();
  await h.home();
  h.start(['cars']);
  h.advance(5000);
  h.click('[data-rehearsal-answer="1"]');
  h.click('#rehearsal-nav');
  const saved = h.state(),
    next = harness(h.snapshot(), h.clock + 600000, '/mcat?view=rehearsal&run=' + saved.attemptId);
  next.w.McatRehearsal.entry();
  assert.equal(next.state().deadline, saved.deadline);
  assert.ok(next.find('#rehearsal-submit'));
  assert.equal(next.state().answers['0:0'], 1);
  h.close();
  next.close();
  const flexible = harness();
  await flexible.home();
  flexible.start(['cars'], 'flexible');
  flexible.advance(60000);
  Object.defineProperty(flexible.w.document, 'hidden', { configurable: true, value: true });
  flexible.w.document.dispatchEvent(new flexible.w.Event('visibilitychange'));
  const remaining = flexible.state()._remain;
  flexible.advance(3600000);
  Object.defineProperty(flexible.w.document, 'hidden', { configurable: true, value: false });
  flexible.w.document.dispatchEvent(new flexible.w.Event('visibilitychange'));
  assert.equal(flexible.state().deadline, flexible.clock + remaining);
  assert.equal(flexible.state().timing.interruptions[0].reason, 'hidden-tab');
  flexible.close();
});
test('a failed answer save retains the newest selection and does not grant continuous time on recovery', async () => {
  const h = harness();
  await h.home();
  h.start(['cars']);
  const deadline = h.state().deadline;
  h.fail = key => key === RESUME;
  h.click('[data-rehearsal-answer="2"]');
  assert.equal(h.run('StudyStorage.paused'), true);
  assert.equal(h.state().answers['0:0'], 2);
  assert.equal(Core.unpack(JSON.parse(h.raw(RESUME))).answers['0:0'], undefined);
  h.advance(300000);
  h.fail = null;
  assert.equal(h.run('StudyStorage.retry()'), true);
  assert.equal(h.state().deadline, deadline);
  assert.equal(Core.unpack(JSON.parse(h.raw(RESUME))).answers['0:0'], 2);
  assert.ok(h.find('[data-rehearsal-answer="2"]').classList.contains('picked'));
  h.close();
});
test('archive failure preserves the completed resume and retry does not double-count submitted work', async () => {
  const h = harness();
  await h.home();
  h.start(['chemPhys']);
  h.click('[data-rehearsal-answer="1"]');
  h.click('#rehearsal-nav');
  h.fail = key => key === 'cs-mcat-exam-reviews';
  h.click('#rehearsal-submit');
  assert.ok(h.raw(RESUME));
  assert.equal(h.raw('cs-mcat-exam-reviews'), null);
  assert.equal(h.state().phase, 'finished');
  h.fail = null;
  assert.equal(h.run('StudyStorage.retry()'), true);
  assert.equal(h.raw(RESUME), null);
  assert.equal(JSON.parse(h.raw('cs-mcat-exam-reviews')).length, 1);
  assert.equal(JSON.parse(h.raw('cs-mcat-log')).length, 1);
  assert.equal(Object.values(JSON.parse(h.raw('cs-mcat-q')))[0].n, 1);
  h.close();
});
test('a completed resume awaiting archival cannot be overwritten from the home screen', async () => {
  const h = harness();
  await h.home();
  h.start(['cars']);
  h.click('#rehearsal-nav');
  h.fail = key => key === 'cs-mcat-exam-reviews';
  h.click('#rehearsal-submit');
  const next = harness(h.snapshot());
  await next.home();
  assert.ok(next.find('#rehearsal-resume'));
  next.start(['chemPhys']);
  assert.equal(Core.unpack(JSON.parse(next.raw(RESUME))).queue[0].key, 'cars');
  next.run("startSim(['chemPhys'])");
  assert.equal(next.state().queue[0].key, 'cars');
  assert.equal(next.raw(RESUME), null);
  h.close();
  next.close();
});
test('failed review-note saving retains the draft without allowing a false completion', async () => {
  const h = harness();
  await h.home();
  h.start(['cars']);
  h.click('#rehearsal-nav');
  h.click('#rehearsal-submit');
  const id = h.state().attemptId;
  h.fail = key => key === 'cs-mcat-course-v1';
  h.find('#exam-reflection').value = 'Compare the author’s claim with the limiting example.';
  h.find('#exam-reflection').dispatchEvent(new h.w.Event('input'));
  assert.equal(h.run('StudyStorage.paused'), true);
  h.find('#exam-reviewed').onclick();
  assert.equal(h.run(`courseState.examReviews[${JSON.stringify(id)}].reviewedAt`), undefined);
  assert.match(
    h.run("StudyStorage.recovery().records['cs-mcat-course-v1'].thisTab.examReviews[sim.attemptId].note"),
    /limiting example/
  );
  h.fail = null;
  assert.equal(h.run('StudyStorage.retry()'), true);
  h.click('#exam-reviewed');
  assert.ok(h.run(`courseState.examReviews[${JSON.stringify(id)}].reviewedAt`));
  h.close();
});
test('a reservation prevents passage disclosure before display and survives a missing catalog', async () => {
  const ledger = Core.emptyExposure(),
    bank = {
      cars: JSON.parse(fs.readFileSync('data/mcat-cars.json')),
      sci: JSON.parse(fs.readFileSync('data/mcat-science-passages.json')),
      questions: JSON.parse(fs.readFileSync('data/mcat-questions.json')),
    };
  Core.reserve(ledger, Core.assemble(manifest.forms[0], bank), true);
  const h = harness(new Map([[KEY, JSON.stringify(ledger)]]));
  h.fetchFail = true;
  const id = manifest.forms[0].passages[0].id;
  h.run(`startPassage(MCAT.sci.find(p=>p.id===${JSON.stringify(id)}),true)`);
  assert.match(h.find('main').textContent, /material is reserved/);
  assert.doesNotMatch(h.find('main').textContent, /Titrating an Unknown/);
  assert.equal(Object.keys(JSON.parse(h.raw(KEY)).passages).length, 0);
  assert.equal(h.raw('cs-mcat-r-plab'), null);
  h.click('#rehearsal-other');
  assert.ok(h.find('#plist button:not(:disabled)'), 'An unopened reservation must not lock the passage catalog');
  h.close();
});
test('existing reserved drills and passages stay resumable before the first question, including save failures', async () => {
  const bank = {
      cars: JSON.parse(fs.readFileSync('data/mcat-cars.json')),
      sci: JSON.parse(fs.readFileSync('data/mcat-science-passages.json')),
      questions: JSON.parse(fs.readFileSync('data/mcat-questions.json')),
    },
    ledger = Core.emptyExposure();
  Core.reserve(ledger, Core.assemble(manifest.forms[0], bank), true);
  const seed = () => new Map([[KEY, JSON.stringify(ledger)]]),
    h = harness(seed()),
    id = manifest.forms[0].discretes[0];
  h.run(
    `drill={qs:MCAT.questions.filter(q=>q.id===${JSON.stringify(id)}),idx:0,mode:'blind',results:[]};renderDrillQ()`
  );
  assert.ok(h.raw('cs-mcat-r-drill'));
  assert.equal(h.run("RESUME_SPECS.find(s=>s.key==='drill').progressOf(loadResume('drill'))"), 1);
  assert.match(h.find('main').textContent, /material is reserved/);
  assert.equal(Object.keys(JSON.parse(h.raw(KEY)).questions).length, 0);
  h.close();
  for (const fails of [false, true]) {
    const p = harness(seed());
    if (fails) p.fail = key => key === 'cs-mcat-r-plab';
    p.run(
      `plab={p:MCAT.sci.find(p=>p.id===${JSON.stringify(manifest.forms[0].passages[0].id)}),phase:'attempt',attemptId:'existing-passage',idx:0,results:[],timed:false,deadline:0};renderPassageRunner()`
    );
    if (fails) {
      assert.equal(p.run('StudyStorage.paused'), true);
      assert.equal(p.raw('cs-mcat-r-plab'), null);
      assert.ok(p.run("StudyStorage.recovery().records['cs-mcat-r-plab'].thisTab.p.id"));
    } else {
      assert.ok(p.raw('cs-mcat-r-plab'));
      assert.match(p.find('main').textContent, /material is reserved/);
    }
    assert.equal(Object.keys(JSON.parse(p.raw(KEY)).passages).length, 0);
    p.close();
  }
});
test('declining a new reserved CARS passage leaves other passages available; release starts it', () => {
  const ledger = Core.emptyExposure(),
    bank = {
      cars: JSON.parse(fs.readFileSync('data/mcat-cars.json')),
      sci: JSON.parse(fs.readFileSync('data/mcat-science-passages.json')),
      questions: JSON.parse(fs.readFileSync('data/mcat-questions.json')),
    };
  const form = manifest.forms.find(form => form.section === 'cars');
  Core.reserve(ledger, Core.assemble(form, bank), true);
  const h = harness(new Map([[KEY, JSON.stringify(ledger)]]));
  const start = () => h.run(`startCars(MCAT.cars.find(p=>p.id===${JSON.stringify(form.passages[0].id)}),false)`);
  start();
  assert.equal(h.raw('cs-mcat-r-cars'), null);
  assert.equal(h.find('[data-release]').textContent, 'Release CARS A');
  h.click('#rehearsal-other');
  assert.ok(h.find('#plist button:not(:disabled)'));
  assert.ok(JSON.parse(h.raw(KEY)).reserved[form.id]);
  start();
  h.click('[data-release]');
  assert.ok(h.raw('cs-mcat-r-cars'));
  assert.equal(JSON.parse(h.raw(KEY)).reserved[form.id], undefined);
  assert.ok(h.find('.cars-passage'));
  h.close();
});
test('an eight-hour continuous reload ends every expired section without inventing displays or answered items', async () => {
  const h = harness();
  await h.home();
  h.start(Core.ORDER);
  h.click('[data-rehearsal-answer="1"]');
  const saved = h.state();
  const next = harness(h.snapshot(), START + 8 * 3600000, '/mcat?view=rehearsal&run=' + saved.attemptId);
  next.w.McatRehearsal.entry();
  const report = Core.unpack(JSON.parse(next.raw('cs-mcat-exam-reviews'))[0]);
  assert.equal(report.results.length, 4);
  assert.equal(
    report.results.reduce((n, r) => n + r.total, 0),
    230
  );
  assert.equal(
    report.results.reduce((n, r) => n + r.unanswered, 0),
    229
  );
  assert.equal(
    report.results.reduce((n, r) => n + r.seen.length, 0),
    1
  );
  assert.equal(JSON.parse(next.raw('cs-mcat-log')).length, 1);
  assert.equal(Object.keys(JSON.parse(next.raw(KEY)).questions).length, 1);
  assert.ok(report.timing.unobservedInterval);
  assert.equal(next.raw(RESUME), null);
  h.close();
  next.close();
});
test('newer storage from another tab pauses the new controller before any overwrite', async () => {
  const h = harness();
  await h.home();
  h.start(['cars']);
  const prior = h.state().answers;
  h.force(
    KEY,
    JSON.stringify({
      ...Core.emptyExposure(),
      questions: { newer: { firstAt: START, lastAt: START, contexts: ['other-tab'] } },
    })
  );
  h.w.dispatchEvent(new h.w.StorageEvent('storage', { key: KEY, storageArea: h.w.localStorage }));
  assert.equal(h.run('StudyStorage.paused'), true);
  h.click('[data-rehearsal-answer="1"]');
  assert.deepEqual(h.state().answers, prior);
  assert.ok(JSON.parse(h.raw(KEY)).questions.newer);
  h.close();
});
test('catalog failures and late resolution cannot clear saved work or replace a later route', async () => {
  const h = harness();
  h.fetchFail = true;
  await h.home();
  assert.match(h.find('main').textContent, /could not load/);
  assert.equal(h.raw(RESUME), null);
  h.close();
  const delayed = harness();
  let release;
  delayed.fetchGate = new Promise(resolve => (release = resolve));
  const pending = delayed.home();
  delayed.w.history.pushState({}, '', '/mcat?view=today');
  release();
  await pending;
  assert.equal(delayed.find('#rehearsal-setup'), null);
  assert.equal(delayed.raw(RESUME), null);
  delayed.close();
});
test('ordinary passage reviews retain their saved wording when current bank content changes, and identify older unsnapshotted reports', () => {
  for (const legacy of [false, true]) {
    const h = harness();
    h.run(
      "const p=JSON.parse(JSON.stringify(MCAT.cars.find(p=>p.id==='h7')));p.questions[3].stem='Earlier wording saved with this attempt';const r={p,phase:'done',attemptId:'wording-test',attemptEndedAt:Date.now(),results:p.questions.map(q=>({q,chosen:q.answer,correct:true}))};studySaveReport('cars',r);MCAT.cars.find(p=>p.id==='h7').questions[3].stem='Later bank wording';"
    );
    if (legacy)
      h.run(
        "const saved=StudyStorage.read('cs-mcat-passage-reviews',{});delete saved['cars:h7'].content;StudyStorage.write('cs-mcat-passage-reviews',saved);"
      );
    h.run(
      "courseRelatedLinks=()=>'';const main=el('<main><div class=\"endbtns\"></div></main>');studyReportButton('cars',main);setView(main);"
    );
    h.click('.endbtns button');
    assert.ok(
      h.find('main').textContent.includes(legacy ? 'Later bank wording' : 'Earlier wording saved with this attempt')
    );
    assert.equal(h.find('main').textContent.includes('Current wording is shown and may have changed'), legacy);
    assert.equal(h.run('cars.results.filter(r=>r.correct).length'), 6);
    h.close();
  }
});
