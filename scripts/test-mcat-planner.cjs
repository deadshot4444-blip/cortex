/* Pure planning rules plus application handlers. Actual browser testing is separate. */
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm');
const core = require('../mcat-v2-engine.js'),
  course = require('../mcat-course-engine.js');
const data = JSON.parse(fs.readFileSync('data/mcat-course.json'));
const coaches = JSON.parse(fs.readFileSync('data/mcat-v2.json')).coaches;
const source = fs.readFileSync('mcat-v2.js', 'utf8');
const now = new Date(2026, 8, 7, 12).getTime(),
  date = '2026-09-07';
const plain = value => JSON.parse(JSON.stringify(value));
function state() {
  const s = core.normalize({});
  s.weekly.availability = Array(7).fill(60);
  return s;
}
function input() {
  return {
    start: date,
    now,
    units: [
      { id: 'c', title: 'Third idea', section: 'bioBiochem', prerequisites: ['b'] },
      { id: 'b', title: 'Second idea', section: 'bioBiochem', prerequisites: ['a'] },
      { id: 'a', title: 'First idea', section: 'bioBiochem', prerequisites: [] },
    ],
    records: {},
    coaches: [{ id: 'passage', unitId: 'b', title: 'Apply the second idea' }],
    preferredUnit: 'c',
  };
}
let checks = 0;
const test = (name, fn) => {
  fn();
  checks++;
  console.log('PASS', name);
};
test('Unsorted prerequisite chains precede the requested focus without creating learning credit', () => {
  const s = state(),
    i = input(),
    before = JSON.stringify(i),
    days = core.week(s, i);
  assert.deepEqual(
    days[0].tasks.map(t => t.key),
    ['a', 'b', 'c']
  );
  assert.match(days[0].tasks[2].prerequisiteNote, /Second idea/);
  assert.equal(JSON.stringify(i), before);
  assert.deepEqual(core.taskPrerequisites(i, days[0].tasks[2]), ['b']);
  assert.deepEqual(core.taskPrerequisites(i, { ...days[0].tasks[2], manualPrerequisites: true }), []);
  assert.deepEqual(i.records, {});
  i.activeUnit = 'c';
  assert.deepEqual(core.taskPrerequisites(i, days[0].tasks[2]), [], 'An already started lesson remains resumable');
  const chain = new Set();
  for (const day of days)
    for (const task of day.tasks) {
      for (const id of core.taskPrerequisites(input(), task)) assert.ok(chain.has(id));
      if (task.type === 'course') chain.add(task.key);
    }
});
test('Missing and cyclic prerequisites do not become automatically ready', () => {
  const i = input();
  i.units[2].prerequisites = ['missing'];
  const missing = core.week(state(), i);
  assert.ok(!missing.flatMap(d => d.tasks).some(t => t.type === 'course' || t.type === 'coach'));
  i.units[2].prerequisites = ['c'];
  const cyclic = core.week(state(), i);
  assert.ok(!cyclic.flatMap(d => d.tasks).some(t => t.type === 'course' || t.type === 'coach'));
});
test('Saved choices freeze reasons and estimates through new evidence, rest days and reduced budgets', () => {
  const s = state(),
    i = input(),
    tasks = core.week(s, i)[0].tasks.slice(0, 2);
  assert.equal(core.keepDay(s, date, tasks, now), true);
  const kept = JSON.stringify(s.weekly.planDays[date]);
  i.preferredUnit = 'a';
  s.durations = [{ type: 'course', ms: 50 * 60000 }];
  s.weekly.availability = Array(7).fill(10);
  let day = core.week(s, i)[0];
  assert.equal(day.tasks.length, 0);
  assert.equal(day.held.length, 2);
  assert.equal(day.kept, true);
  assert.equal(JSON.stringify(s.weekly.planDays[date]), kept);
  s.weekly.availability = Array(7).fill(0);
  day = core.week(s, i)[0];
  assert.equal(day.held.length, 2);
  assert.equal(day.tasks.length, 0);
  assert.equal(day.alternatives.length, 0);
  s.weekly.availability = Array(7).fill(60);
  day = core.week(s, i)[0];
  assert.deepEqual(
    day.tasks.map(t => t.key),
    ['a', 'b']
  );
  assert.equal(day.tasks[0].minutes, 15);
  assert.equal(day.tasks[0].reason, tasks[0].reason);
  assert.equal(JSON.stringify(s.weekly.planDays[date]), kept);
  assert.ok(day.alternatives.every(task => task.minutes <= day.unallocated));
});
test('Long eligible study durations are not silently truncated to an hour', () => {
  const s = state(),
    i = input();
  s.durations = [
    { type: 'course', ms: 90 * 60000 },
    { type: 'course', ms: 100 * 60000 },
  ];
  assert.equal(core.duration(s, 'course', 15), 95);
  assert.ok(
    !core
      .week(s, i)
      .flatMap(day => day.tasks)
      .some(task => task.type === 'course')
  );
  s.weekly.availability = Array(7).fill(120);
  assert.equal(core.week(s, i)[0].tasks.find(task => task.type === 'course').minutes, 95);
});
test('Edits retain an undo snapshot; releasing choices restores suggestions; stale controls cannot edit past days', () => {
  const s = state(),
    i = input(),
    tasks = core.week(s, i)[0].tasks;
  assert.ok(core.keepDay(s, date, tasks, now));
  assert.ok(core.keepDay(s, date, tasks.slice(1), now + 1));
  assert.deepEqual(
    s.weekly.planDays[date].previous.tasks.map(t => t.id),
    tasks.map(t => t.id)
  );
  assert.ok(core.keepDay(s, date, [], now + 2, true));
  assert.equal(core.week(s, i)[0].kept, false);
  assert.equal(core.keepDay(s, '2026-09-06', tasks, now), false);
  assert.equal(core.keepDay(s, '2026-02-30', tasks, now), false);
  assert.ok(core.validPlanDays(s.weekly.planDays));
  assert.equal(
    core.validPlanDays({ ...s.weekly.planDays, [date]: { tasks: [], savedAt: now, released: 'false' } }),
    false
  );
  assert.equal(
    core.validPlanDays({ ...s.weekly.planDays, [date]: { tasks: [{ ...tasks[0], minutes: Infinity }], savedAt: now } }),
    false
  );
});
test('Future reservations cannot be consumed by earlier automatic suggestions or duplicated in another chosen day', () => {
  const s = state(),
    i = input(),
    task = core.week(s, i)[0].tasks[0];
  assert.ok(core.keepDay(s, '2026-09-09', [task], now));
  assert.equal(core.keepDay(s, date, [task], now), false);
  const days = core.week(s, i);
  assert.ok(
    !days
      .slice(0, 2)
      .flatMap(d => d.tasks)
      .some(t => t.id === task.id)
  );
  assert.ok(days[2].tasks.some(t => t.id === task.id));
});
test('Due checks use exact times and oldest due first; keeping one does not bypass spacing', () => {
  const s = state(),
    i = input();
  i.preferredUnit = null;
  i.records = {
    a: { completedAt: now - 86400000, dueAt: now + 1000 },
    b: { completedAt: now - 86400000, dueAt: now - 4000 },
    c: { completedAt: now - 86400000, dueAt: now - 8000 },
  };
  let days = core.week(s, i);
  assert.deepEqual(
    days[0].tasks.filter(t => t.kind === 'delayed').map(t => t.key),
    ['c', 'b']
  );
  const later = days.flatMap(d => d.tasks).find(t => t.key === 'a' && t.kind === 'delayed');
  assert.ok(later);
  assert.equal(later.day, '2026-09-08');
  assert.ok(core.keepDay(s, date, [later], now));
  assert.match(core.week(s, i)[0].held[0].hold, /spacing/);
  i.now = now + 1001;
  assert.equal(core.week(s, i)[0].tasks[0].key, 'a');
  i.records.a.attempts = [{ kind: 'delayed', correct: false, ts: now + 1001 }];
  i.records.a.dueAt = now + 86400000;
  assert.equal(core.week(s, i)[0].held.length, 0);
  assert.equal(
    core.week(s, i)[0].tasks.filter(t => !t.done).length,
    0,
    'The old check does not become a second attempt'
  );
});
test('Missed days do not stack; completed work and explicit exam time remain visible without new overload', () => {
  const s = state(),
    i = input(),
    tasks = core.week(s, i)[0].tasks;
  core.keepDay(s, date, tasks, now);
  s.weekly.availability = Array(7).fill(20);
  i.start = '2026-09-10';
  i.now = now + 3 * 86400000;
  const prior = JSON.stringify(s.weekly.planDays);
  let days = core.week(s, i);
  assert.equal(JSON.stringify(s.weekly.planDays), prior);
  for (const day of days) assert.ok(day.tasks.reduce((n, t) => n + t.minutes, 0) <= day.budget);
  s.weekly.exams = [{ id: 'exam', name: 'Entered exam', date: i.start, minutes: 120 }];
  days = core.week(s, i);
  assert.equal(days[0].tasks.length, 1);
  assert.equal(days[0].tasks[0].type, 'externalExam');
  assert.equal(days[0].unallocated, 0);
  assert.equal(days[1].tasks[0].type, 'externalReview');
});
test('Evidence labels distinguish assisted, repeated and unknown conditions without treating one correct answer as mastery', () => {
  const s = state(),
    i = input();
  s.math.history = [
    { id: '1', skill: 'units', qId: 'units-1', correct: true, assisted: true, startedAt: 1, completedAt: 2 },
    { id: '2', skill: 'units', qId: 'units-2', correct: true, assisted: false, startedAt: 3, completedAt: 4 },
    { id: '3', skill: 'units', qId: 'units-2', correct: true, assisted: false, startedAt: 5, completedAt: 6 },
    { id: '4', skill: 'units', qId: 'units-4', correct: true, startedAt: 7, completedAt: 8 },
  ];
  const text = core.plannerEvidence(s, i, { type: 'math', key: 'units' });
  assert.match(text, /1 first answers/);
  assert.match(text, /1 assisted/);
  assert.match(text, /1 repeated/);
  assert.match(text, /1 with support conditions unrecorded/);
  assert.match(core.plannerEvidence(s, i, { type: 'course', key: 'a' }), /No completed/);
  i.records.a = { attempts: [{ kind: 'check', qId: 'a1', correct: true }], help: { a1: { answeredAt: 12 } } };
  assert.match(core.plannerEvidence(s, i, { type: 'course', key: 'a' }), /1\/1 first lesson/);
  assert.match(core.plannerEvidence(s, i, { type: 'course', key: 'a' }), /do not establish/);
});
test('An interrupted activity consumes time on its actual completion day while the chosen day is retained', () => {
  const s = state(),
    i = input();
  s.weekly.done.older = {
    id: 'math:units',
    type: 'math',
    key: 'units',
    title: 'Units',
    reason: 'Saved',
    minutes: 5,
    day: '2026-09-06',
    ts: now,
  };
  s.math.history = [{ id: 'run', skill: 'units', qId: 'units-1', assisted: false, completedAt: now }];
  const original = JSON.stringify(s.weekly.done);
  const tasks = core.week(s, i)[0].tasks.filter(task => task.done && task.type === 'math');
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].day, date);
  assert.equal(tasks[0].plannedDay, '2026-09-06');
  assert.equal(JSON.stringify(s.weekly.done), original);
});

function node(html = '') {
  let content = html;
  const elements = new Map();
  const result = {
    value: '',
    checked: false,
    disabled: false,
    dataset: {},
    children: [],
    classList: { add() {} },
    get html() {
      return content;
    },
    get innerHTML() {
      return content;
    },
    set innerHTML(text) {
      content = text;
      elements.clear();
    },
    appendChild(child) {
      this.children.push(child);
    },
    addEventListener(name, callback) {
      this['on' + name] = callback;
    },
    scrollIntoView() {},
    focus() {},
    querySelector(selector) {
      return (
        this.querySelectorAll(selector)[0] || elements.get(selector) || elements.set(selector, node()).get(selector)
      );
    },
    querySelectorAll(selector) {
      const out = [];
      for (const match of content.matchAll(/<([a-z]+)\b([^>]*)>/g)) {
        const [, tag, attrs] = match,
          id = attrs.match(/\bid="([^"]*)"/)?.[1];
        const attribute = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
        const selected =
          selector === '#' + id ||
          selector === tag ||
          (attribute &&
            (attribute[2] != null
              ? attrs.includes(attribute[1] + '="' + attribute[2] + '"')
              : new RegExp('\\b' + attribute[1] + '(?:=|\\s|$)').test(attrs)));
        if (!selected) continue;
        const key = id ? '#' + id : String(match.index);
        if (!elements.has(key)) {
          const child = node();
          child.value = attrs.match(/\bvalue="([^"]*)"/)?.[1] || '';
          child.disabled = /\bdisabled\b/.test(attrs);
          child.checked = /\bchecked\b/.test(attrs);
          for (const entry of attrs.matchAll(/data-([a-z-]+)="([^"]*)"/g))
            child.dataset[entry[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = entry[2];
          elements.set(key, child);
        }
        out.push(elements.get(key));
      }
      return out;
    },
  };
  return result;
}
function harness(seed) {
  let saved = seed || null,
    fail = false,
    lastMain,
    renders = 0,
    navigated = [],
    invalid = 0;
  const events = new Map(),
    location = new URL('http://localhost/mcat?view=today');
  class Clock extends Date {
    static now() {
      return now;
    }
    constructor(...args) {
      super(...(args.length ? args : [now]));
    }
  }
  const storage = {
    paused: false,
    read: (_, fallback) => (saved ? JSON.parse(saved) : fallback),
    sessionFailed() {
      this.paused = true;
      invalid++;
    },
    watch() {
      return {
        save: value => {
          if (fail) {
            storage.paused = true;
            return false;
          }
          saved = JSON.stringify(value);
          return true;
        },
      };
    },
  };
  const courseState = course.normalize({});
  const context = vm.createContext({
    console,
    Date: Clock,
    Math,
    URL,
    URLSearchParams,
    Set,
    Map,
    Blob,
    location,
    McatV2Core: core,
    McatCourseCore: course,
    StudyStorage: storage,
    courseData: structuredClone(data),
    courseState,
    SEC_ABBR: { chemPhys: 'C/P', bioBiochem: 'B/B', psychSoc: 'P/S', cars: 'CARS' },
    window: { addEventListener: (event, callback) => events.set(event, callback), scrollTo() {} },
    document: {
      addEventListener() {},
      querySelector() {
        return null;
      },
    },
    setInterval() {},
    setTimeout() {},
    loadJSON: (_, fallback) => fallback,
    guideDateKey: () => date,
    guidePlan: () => null,
    studyCompletedActivities: () => [],
    esc: value => String(value ?? ''),
    el: node,
    courseUnit: id => data.units.find(unit => unit.id === id),
    courseRecord: id => course.record(courseState, id),
    renderCourseUnit: id => navigated.push(id),
    renderCourseHome() {},
    renderMCAT() {},
    renderCourseProgress() {},
    coursePauseTools() {},
  });
  vm.runInContext(source, context);
  vm.runInContext('v2Data=' + JSON.stringify({ coaches }) + ';v2Shell=(main,view)=>capture(main,view);', context);
  context.capture = (main, view) => {
    lastMain = main;
    renders++;
    location.search = '?view=' + view;
  };
  const run = code => vm.runInContext(code, context);
  run('v2State.weekly.availability=Array(7).fill(30)');
  return {
    context,
    run,
    events,
    courseState,
    storage,
    get main() {
      return lastMain;
    },
    get renders() {
      return renders;
    },
    get saved() {
      return saved;
    },
    get invalid() {
      return invalid;
    },
    get navigated() {
      return navigated;
    },
    set fail(value) {
      fail = value;
    },
  };
}
test('Today handlers keep, defer and undo choices; lowered availability leaves them visible', () => {
  const h = harness();
  h.context.renderV2Today();
  const tasks = plain(h.run('v2WeekDays()[0].tasks.filter(task=>!task.done)'));
  h.main.querySelectorAll('[data-plan-keep]')[0].onclick();
  assert.match(h.main.html, /Your saved choices/);
  const saved = JSON.parse(h.saved).weekly.planDays[date];
  assert.deepEqual(
    saved.tasks.map(t => t.id),
    tasks.map(t => t.id)
  );
  h.run('v2State.weekly.availability=Array(7).fill(0)');
  h.context.renderV2Today();
  assert.match(h.main.html, /Saved choices waiting/);
  assert.ok(!h.main.html.includes('Your planned activities are complete'));
  h.run('v2State.weekly.availability=Array(7).fill(30)');
  h.context.renderV2Today();
  h.main.querySelectorAll('[data-plan-remove]')[0].onclick();
  assert.equal(h.run('v2State.weekly.planDays["' + date + '"].tasks.length'), tasks.length - 1);
  h.main.querySelectorAll('[data-plan-undo]')[0].onclick();
  assert.deepEqual(
    plain(h.run('v2State.weekly.planDays["' + date + '"].tasks.map(task=>task.id)')),
    tasks.map(t => t.id)
  );
  assert.ok(
    Object.values(h.courseState.units).every(record => !record.completedAt),
    'Changing plans creates no course completion'
  );
});
test('Weekly availability controls retain chosen tasks and wait for successful saving before redraw', () => {
  const h = harness();
  h.context.renderV2Today();
  h.main.querySelectorAll('[data-plan-keep]')[0].onclick();
  const choices = JSON.stringify(h.run('v2State.weekly.planDays["' + date + '"]'));
  h.context.renderV2Week();
  const fields = h.main.querySelectorAll('[data-week-day]');
  assert.equal(fields.length, 7);
  fields.forEach(input => (input.value = '15'));
  h.main.querySelector('#week-settings').onsubmit({ preventDefault() {} });
  assert.deepEqual(plain(h.run('v2State.weekly.availability')), Array(7).fill(15));
  assert.equal(JSON.stringify(h.run('v2State.weekly.planDays["' + date + '"]')), choices);
  const count = h.renders;
  h.fail = true;
  h.main.querySelectorAll('[data-week-day]').forEach(input => (input.value = '0'));
  h.main.querySelector('#week-settings').onsubmit({ preventDefault() {} });
  assert.equal(h.renders, count);
  assert.deepEqual(JSON.parse(h.saved).weekly.availability, Array(7).fill(15));
  h.fail = false;
  h.storage.paused = false;
  h.context.v2Save();
  h.events.get('study-storage-recovered')();
  assert.ok(h.renders > count);
  assert.match(h.main.html, /Rest day/);
});
test('An alternative must fit and an unmet prerequisite requires the explicit background choice', () => {
  const h = harness();
  h.context.v2SaveDay(date, []);
  h.context.renderV2Today();
  const alternative = h.run('v2WeekDays()[0].alternatives.find(task=>task.prerequisites.length&&task.minutes<=30)');
  assert.ok(alternative);
  const select = h.main.querySelectorAll('[data-plan-select]')[0];
  select.value = alternative.id;
  select.onchange();
  let add = h.main.querySelectorAll('[data-plan-add]')[0];
  assert.equal(add.disabled, true);
  add.onclick();
  assert.equal(h.run('v2State.weekly.planDays["' + date + '"].tasks.length'), 0);
  const background = h.main.querySelector('#plan-background-' + date);
  background.checked = true;
  background.onchange();
  assert.equal(add.disabled, false);
  add.onclick();
  const chosen = h.run('v2State.weekly.planDays["' + date + '"].tasks[0]');
  assert.equal(chosen.id, alternative.id);
  assert.equal(chosen.manualPrerequisites, true);
  assert.match(h.main.html, /prior background/);
  assert.ok(Object.values(h.courseState.units).every(record => !record.completedAt));
});
test('A failed choice save blocks redraw, retains the previous disk copy and refreshes after recovery', () => {
  const h = harness();
  h.context.renderV2Today();
  h.main.querySelectorAll('[data-plan-keep]')[0].onclick();
  const disk = h.saved,
    count = h.renders;
  h.fail = true;
  h.main.querySelectorAll('[data-plan-remove]')[0].onclick();
  assert.equal(h.storage.paused, true);
  assert.equal(h.saved, disk);
  assert.equal(h.renders, count);
  const pending = plain(h.run('v2State.weekly.planDays["' + date + '"].tasks'));
  h.fail = false;
  h.storage.paused = false;
  h.context.v2Save();
  h.events.get('study-storage-recovered')();
  assert.ok(h.renders > count);
  assert.deepEqual(JSON.parse(h.saved).weekly.planDays[date].tasks, pending);
  const malformed = JSON.parse(h.saved);
  malformed.weekly.planDays[date].tasks[0].minutes = -1;
  const bad = harness(JSON.stringify(malformed));
  assert.equal(bad.invalid, 1);
  assert.equal(bad.saved, JSON.stringify(malformed));
  malformed.weekly.planDays = null;
  const nullPlan = harness(JSON.stringify(malformed));
  assert.equal(nullPlan.invalid, 1);
  assert.equal(nullPlan.saved, JSON.stringify(malformed));
});
test('Launch checks current prerequisites, stale dates, future retrieval and failed saves before navigation', () => {
  const h = harness(),
    task = {
      id: 'course:enzyme-rates',
      type: 'course',
      key: 'enzyme-rates',
      title: 'Enzymes',
      minutes: 15,
      reason: 'Chosen',
      day: date,
    };
  h.context.v2LaunchWeekTask(task);
  assert.equal(h.navigated.length, 0);
  assert.match(h.main.html, /Check the foundation/);
  h.main.querySelector('#plan-use-background').onclick();
  assert.deepEqual(h.navigated, ['enzyme-rates']);
  assert.equal(h.run('v2State.weekly.active.manualPrerequisites'), true);
  h.context.v2LaunchWeekTask({ ...task, day: '2026-09-08' });
  h.context.v2LaunchWeekTask({ ...task, dueAt: now + 1000 });
  assert.equal(h.navigated.length, 1);
  h.fail = true;
  h.context.v2LaunchWeekTask({ ...task, key: 'buffer-balance', id: 'course:buffer-balance' });
  assert.equal(h.navigated.length, 1);
});
test('Completion handler records today and preserves the original planned day', () => {
  const h = harness();
  h.run(
    'v2State.weekly.active={id:"math:units",type:"math",key:"units",title:"Units",minutes:5,reason:"Saved",day:"2026-09-06"}'
  );
  h.context.v2CompleteActivity('math', 'units');
  const done = h.run('Object.values(v2State.weekly.done)[0]');
  assert.equal(done.day, date);
  assert.equal(done.plannedDay, '2026-09-06');
  assert.equal(done.ts, now);
  h.context.v2CompleteActivity('math', 'units');
  assert.equal(h.run('Object.keys(v2State.weekly.done).length'), 1);
});
test('Missed chosen work is carried explicitly and is not silently stacked onto today', () => {
  const h = harness();
  h.run(
    'v2State.weekly.planDays["2026-09-06"]={savedAt:Date.now()-86400000,tasks:[{id:"math:units",type:"math",key:"units",title:"Units",minutes:5,reason:"Chosen yesterday",selectedAt:Date.now()-86400000}]}'
  );
  h.context.v2SaveDay(date, []);
  h.context.renderV2Today();
  assert.match(h.main.html, /Unfinished choices from earlier days/);
  const prior = JSON.stringify(h.run('v2State.weekly.planDays["2026-09-06"]'));
  h.main.querySelectorAll('[data-plan-carry]')[0].onclick();
  assert.equal(h.run('v2State.weekly.planDays["' + date + '"].tasks[0].key'), 'units');
  assert.equal(JSON.stringify(h.run('v2State.weekly.planDays["2026-09-06"]')), prior);
  assert.equal(h.context.v2PastChoices().length, 0);
  assert.equal(h.run('v2State.math.history.length'), 0);
});
console.log(
  `${checks} planner rule/handler checks passed. No browser, real learner outcome or professional review is implied.`
);
