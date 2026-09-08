const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs
  .readFileSync('academy-today.js', 'utf8')
  .replace(
    'window.AcademyToday = Object.freeze({ render });',
    'window.AcademyToday = { render, state, validState, plan, start, finish, evidence, dateKey };'
  );
const ids = ['mcat', 'socrates', 'practice', 'anatomy', 'reference', 'neuro'];
function harness(saved = new Map(), local = true) {
  let invalid = 0,
    fail = false;
  const writes = [];
  const context = vm.createContext({
    console,
    Date,
    Math,
    Object,
    Array,
    Number,
    Set,
    URL,
    URLSearchParams,
    IS_LOCAL_PREVIEW: local,
    window: { addEventListener() {} },
    location: new URL('http://localhost/academy?view=today'),
    sectionUrl: id => '/' + (id === 'socrates' ? 'learn' : id === 'reference' ? 'medicine' : id),
    CortexAcademy: { tracks: ids.map(id => ({ id, name: id, available: ['mcat', 'practice'].includes(id) })) },
    StudyStorage: {
      paused: false,
      read: (key, fallback) => (saved.has(key) ? JSON.parse(saved.get(key)) : fallback),
      watch() {},
      sessionFailed() {
        invalid++;
        this.paused = true;
      },
      write(key, value) {
        writes.push(key);
        if (fail) return false;
        saved.set(key, JSON.stringify(value));
        return true;
      },
    },
  });
  vm.runInContext(source, context);
  return {
    api: context.window.AcademyToday,
    context,
    saved,
    writes,
    get invalid() {
      return invalid;
    },
    set fail(value) {
      fail = value;
    },
  };
}
const fixtures = {
  'cs-mcat-course-v1': {
    activeUnit: 'unit-a',
    units: { done: { completedAt: 1, dueAt: 2 }, later: { completedAt: 3, dueAt: Date.now() + 100000 } },
  },
  'cs-clinical-shift-v1': { completed: { case1: { attempts: 2 } }, active: { runId: 'case-run' } },
  'cs-ltl-progress-v1': {
    general: { lastLesson: 'remember', lastStep: 3, lessons: { complete: { completedAt: '2026-09-06' } } },
  },
  'cs-academy-anatomy-v1': { lessons: { arm: { index: 1, startedAt: 5, content: { title: 'Arm lesson' } } } },
  'cs-academy-reference-v1': { lessons: { flow: { completedAt: 5 } } },
  'cs-neuro': {
    pathDone: ['legacy', 'legacy'],
    units: { saved: { startedAt: 9, content: { step: { title: 'Time series' } } } },
  },
};
const saved = new Map(Object.entries(fixtures).map(([key, value]) => [key, JSON.stringify(value)]));
const original = new Map(saved),
  h = harness(saved),
  { api } = h,
  day = api.dateKey();
api.state.priority = ['mcat', 'practice'];
let plan = api.plan();
assert.equal(plan.planned, 30);
assert.equal(plan.items.length, 2);
assert.equal(plan.items[0].minutes, 15);
const beforeEvidence = api.evidence();
assert.equal(beforeEvidence.mcat.completed, 2);
assert.equal(beforeEvidence.mcat.due, 1);
assert.equal(beforeEvidence.practice.completed, 1);
assert.equal(beforeEvidence.neuro.completed, 1);
assert.match(beforeEvidence.mcat.url, /view=course&unit=unit-a/);
assert.match(beforeEvidence.socrates.url, /track=general&lesson=remember&step=4/);
assert.match(beforeEvidence.practice.url, /run=case-run/);
assert.match(beforeEvidence.neuro.url, /unit=saved/);
assert.equal(api.start(day, 'mcat', 15), true);
const startedAt = api.state.days[day].blocks.mcat.startedAt;
assert.equal(api.start(day, 'mcat', 15), true);
assert.equal(api.state.days[day].blocks.mcat.startedAt, startedAt);
api.state.budget = 0;
plan = api.plan();
assert.equal(plan.over, 15);
assert.equal(plan.items.length, 1);
assert.equal(api.start(day, 'practice', 15), false, 'A lower budget cannot start an unallocated block');
api.state.budget = 30;
api.state.paused = ['practice'];
assert.equal(api.plan().items.length, 1);
assert.equal(api.start(day, 'practice', 15), false, 'Paused courses do not receive time');
api.state.paused = [];
assert.equal(api.start(day, 'practice', 15), true);
assert.equal(api.finish(day, 'mcat', 0), false);
assert.equal(api.finish(day, 'mcat', 12.5), false);
h.fail = true;
assert.equal(api.finish(day, 'mcat', 12), false);
const completedAt = api.state.days[day].blocks.mcat.completedAt;
assert.ok(completedAt);
assert.equal(JSON.parse(saved.get('cs-academy-today-v1')).days[day].blocks.mcat.completedAt, undefined);
h.fail = false;
h.context.StudyStorage.write('cs-academy-today-v1', api.state);
assert.equal(api.finish(day, 'mcat', 12), false, 'Repeated completion cannot add time twice');
assert.equal(api.state.days[day].blocks.mcat.completedAt, completedAt);
assert.equal(api.plan().spent, 12);
assert.equal(api.plan().planned, 15);
assert.deepEqual(
  JSON.parse(JSON.stringify(api.evidence())),
  JSON.parse(JSON.stringify(beforeEvidence)),
  'Self-reported time cannot create learning credit'
);
for (const [key, value] of original) assert.equal(saved.get(key), value, 'Planner never rewrites ' + key);
assert.ok(h.writes.every(key => key === 'cs-academy-today-v1'));
const reload = harness(saved);
assert.equal(reload.api.plan().spent, 12);
assert.equal(reload.api.plan().items[0].id, 'practice');
assert.equal(reload.api.validState(reload.api.state), true);
reload.api.state.priority = [...ids];
reload.api.state.days = {};
reload.api.state.budget = 30;
assert.equal(reload.api.plan().items.length, 2);
assert.equal(reload.api.plan().deferred.length, ids.length - 2);
assert.equal(reload.api.plan().planned, 30);
for (let budget = 0; budget <= 240; budget += 15) {
  reload.api.state.budget = budget;
  assert.ok(reload.api.plan().planned <= budget, 'New allocation never exceeds the target');
}
assert.equal(api.plan('2099-01-01').spent, 0, 'New dates do not inherit completion credit');
assert.equal(api.start('2099-01-01', 'mcat', 15), false, 'A stale date cannot start a new current-day block');
const production = harness(new Map(), false);
production.api.state.priority = ['anatomy', 'mcat'];
assert.equal(production.api.plan().items.length, 1);
assert.equal(production.api.plan().items[0].id, 'mcat');
const damaged = new Map([['cs-academy-today-v1', JSON.stringify({ budget: -1 })]]),
  broken = harness(damaged);
assert.equal(broken.invalid, 1);
assert.equal(damaged.get('cs-academy-today-v1'), JSON.stringify({ budget: -1 }));
const neuroLabData = {
  code: { code1: { current: { startedAt: 10, content: { title: 'Saved code' } } } },
  simWork: { sim1: { startedAt: 20, content: { title: 'Saved simulation' } } },
};
const neuroLabs = harness(new Map([['cs-neuro', JSON.stringify(neuroLabData)]]));
assert.match(neuroLabs.api.evidence().neuro.url, /sim=sim1/);
neuroLabData.simWork.sim1.completedAt = 25;
neuroLabs.saved.set('cs-neuro', JSON.stringify(neuroLabData));
assert.match(neuroLabs.api.evidence().neuro.url, /code=code1/);
neuroLabData.code.code1.current.manualTrace = { completedAt: 30 };
neuroLabs.saved.set('cs-neuro', JSON.stringify(neuroLabData));
assert.doesNotMatch(neuroLabs.api.evidence().neuro.url, /code=code1/);
delete neuroLabData.code.code1.current.manualTrace;
Object.assign(neuroLabData.code.code1.current, {
  completedAt: 40,
  draft: 'changed code',
  attempts: [{ passed: true, draft: 'earlier code' }],
});
neuroLabs.saved.set('cs-neuro', JSON.stringify(neuroLabData));
assert.match(
  neuroLabs.api.evidence().neuro.url,
  /code=code1/,
  'A modified draft is resumable even after a previous pass'
);
assert.equal(neuroLabs.api.evidence().neuro.completed, 0, 'Lab comparisons cannot create unit completion');
neuroLabData.projects = {
  'neural-signal-viewer': {
    current: { runId: 'saved-project', startedAt: 50, completedAt: null, content: { title: 'Saved signal project' } },
    history: [],
  },
};
neuroLabs.saved.set('cs-neuro', JSON.stringify(neuroLabData));
assert.match(neuroLabs.api.evidence().neuro.url, /project=neural-signal-viewer&run=saved-project/);
assert.equal(neuroLabs.api.evidence().neuro.completed, 0, 'Starting a project cannot create unit completion');
neuroLabData.projects['neural-signal-viewer'].current.completedAt = 60;
neuroLabs.saved.set('cs-neuro', JSON.stringify(neuroLabData));
assert.match(
  neuroLabs.api.evidence().neuro.url,
  /code=code1/,
  'A completed project no longer displaces unfinished code'
);
assert.equal(neuroLabs.writes.length, 0, 'Continuation discovery never writes engineering records');
console.log(
  'Academy Today: mixed-track budget limits, pause/priority behavior, exact resume links, separate learning evidence, immutable time records, failed-save retention, date boundaries and production gates passed.'
);
const timelineData = {
  active: { runId: 'timeline-run', startedAt: 20 },
  history: [
    { phase: 'complete', completedAt: 30, caseData: { id: 'timeline-chest' } },
    { phase: 'complete', completedAt: 40, caseData: { id: 'timeline-chest' } },
    { phase: 'compare', caseData: { id: 'timeline-potassium' } },
  ],
};
const timelineSaved = new Map([
  [
    'cs-clinical-shift-v1',
    JSON.stringify({ active: { runId: 'shift-run', startedAt: 10 }, completed: { cd1: { attempts: 1 } } }),
  ],
  ['cs-clinical-longitudinal-v1', JSON.stringify(timelineData)],
]);
const timelineToday = harness(timelineSaved);
assert.equal(
  timelineToday.api.evidence().practice.completed,
  2,
  'Repeated timelines count once and unfinished comparisons receive no credit'
);
assert.match(timelineToday.api.evidence().practice.url, /view=longitudinal&run=timeline-run/);
assert.equal(timelineToday.writes.length, 0, 'Reading continuation does not rewrite either clinical workspace');
timelineSaved.set('cs-clinical-shift-v1', JSON.stringify({ active: { runId: 'new-shift', startedAt: 30 } }));
assert.match(timelineToday.api.evidence().practice.url, /view=shift&run=new-shift/);
console.log('Academy Today longitudinal continuation and distinct-completion checks passed.');
/* Real DOM: each Today control re-renders the view, so focus and the viewport must come back to the control. */
const { JSDOM } = require('jsdom');
function domHarness(seed = {}) {
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', {
    url: 'http://localhost/academy?view=today',
    runScripts: 'outside-only',
  });
  const w = dom.window,
    ctx = dom.getInternalVMContext(),
    saved = new Map(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]));
  Object.assign(w, {
    IS_LOCAL_PREVIEW: true,
    openSection() {},
    sectionUrl: id => '/' + (id === 'socrates' ? 'learn' : id === 'reference' ? 'medicine' : id),
    CortexAcademy: { tracks: ids.map(id => ({ id, name: id, available: true })) },
    StudyStorage: {
      paused: false,
      read: (key, fallback) => (saved.has(key) ? JSON.parse(saved.get(key)) : fallback),
      watch() {},
      sessionFailed() {},
      write(key, value) {
        saved.set(key, JSON.stringify(value));
        return true;
      },
    },
    el: html => {
      const t = w.document.createElement('template');
      t.innerHTML = html;
      return t.content.firstElementChild;
    },
    esc: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
    topbar: () => w.el('<header data-section="academy"></header>'),
  });
  w.scrollTo = (x, y) => {
    w.scrollX = x;
    w.scrollY = y;
  };
  // Same contract as app.js setView: replace the view, scroll to the top and focus the page heading.
  w.setView = root => {
    w.document.querySelector('#app').replaceChildren(root);
    w.scrollTo(0, 0);
    const h1 = root.querySelector('h1');
    h1.setAttribute('tabindex', '-1');
    h1.focus({ preventScroll: true });
  };
  vm.runInContext(source, ctx);
  const find = s => w.document.querySelector(s),
    active = () => w.document.activeElement;
  const press = s => {
    const node = find(s);
    assert.ok(node, s);
    node.focus();
    node.click();
  };
  const submit = (formSelector, focusSelector) => {
    find(focusSelector).focus();
    find(formSelector).dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  };
  return { w, find, active, press, submit, api: w.AcademyToday, saved, close: () => w.close() };
}
{
  const h = domHarness();
  h.api.render();
  const today = h.api.dateKey();
  assert.equal(h.active(), h.find('h1'), 'Opening the page focuses the heading as before');
  h.w.scrollTo(0, 800);
  const box = h.find('[data-track="practice"]');
  box.focus();
  box.checked = true;
  box.dispatchEvent(new h.w.Event('change', { bubbles: true }));
  assert.equal(JSON.stringify(h.api.state.priority), '["mcat","practice"]');
  assert.notEqual(h.active(), h.find('h1'));
  assert.equal(
    h.active(),
    h.find('[data-track="practice"]'),
    'Focus returns to the toggled checkbox after the re-render'
  );
  assert.equal(h.w.scrollY, 800, 'The viewport stays where the learner was');
  h.press('[data-pause="practice"]');
  assert.equal(h.active(), h.find('[data-pause="practice"]'));
  assert.match(h.active().textContent, /Resume planning/);
  h.press('[data-priority="practice"]');
  assert.equal(h.api.state.priority[0], 'practice');
  assert.equal(h.find('[data-priority="practice"]').disabled, true);
  assert.equal(
    h.active(),
    h.find('[data-pause="practice"]'),
    'A control that becomes disabled hands focus to its neighbour, not the heading'
  );
  h.find('#academy-budget').value = '45';
  h.submit('#academy-time-settings', '#academy-budget');
  assert.equal(h.api.state.budget, 45);
  assert.equal(h.active(), h.find('#academy-budget'));
  h.find('#academy-budget').value = '60';
  h.submit('#academy-time-settings', '#academy-time-settings button');
  assert.equal(h.api.state.budget, 60);
  assert.equal(h.active(), h.find('#academy-time-settings button'));
  assert.equal(h.w.scrollY, 800);
  h.close();
  const started = domHarness({
    'cs-academy-today-v1': {
      version: 1,
      budget: 30,
      priority: ['mcat'],
      paused: [],
      days: { [today]: { blocks: { mcat: { planned: 15, startedAt: 1 } } } },
    },
  });
  started.api.render();
  started.w.scrollTo(0, 500);
  started.find('#minutes-mcat').value = '20';
  started.submit('[data-finish="mcat"]', '#minutes-mcat');
  assert.equal(started.api.state.days[today].blocks.mcat.minutes, 20);
  assert.equal(started.find('[data-finish="mcat"]'), null);
  assert.equal(
    started.active(),
    started.find('#academy-recorded'),
    'Recording time moves focus to the recorded-time heading, not the page top'
  );
  assert.equal(started.w.scrollY, 500);
  started.close();
  console.log('Academy Today controls keep focus and scroll position across re-renders.');
}
