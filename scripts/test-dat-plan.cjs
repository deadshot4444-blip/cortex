// DAT schedule (dat-plan-engine.js, dat-plan.js). Phase lengths, hour totals, days off,
// features that are not loaded, weak-section drills, the PAT level ramp, done marks kept
// across a rebuild, official scores with PAT included, and a damaged saved plan that is
// replaced with a notice instead of sessionFailed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const Core = require('../dat-plan-engine.js');

const BASE = {
  startDate: '2026-09-21',
  testDate: '2026-12-05',
  hoursPerWeek: 22,
  daysOff: ['Sun'],
  features: ['drill', 'pat', 'qr', 'rc'],
};

function minutes(plan) {
  return Object.values(plan.days).reduce((n, tasks) => n + tasks.reduce((m, t) => m + t.minutes, 0), 0);
}
function flat(plan) {
  return Object.entries(plan.days).flatMap(([date, tasks]) => tasks.map(t => Object.assign({ date }, t)));
}
function phaseOf(plan, date) {
  return plan.phases.find(p => date >= p.from && date <= p.to).id;
}
function sets(subtest, level, correct) {
  return [0, 1].flatMap(n =>
    Array.from({ length: 15 }, (_, i) => ({
      section: 'pat',
      subtest,
      level,
      attemptId: `${subtest}-${level}-${n}`,
      correct: i < correct,
      ms: 1000,
      qId: `${subtest}-${n}-${i}`,
    }))
  );
}

test('phases cover the span inside the reported ranges and the sample budget is proportional to its dates', () => {
  const plan = Core.build(BASE, {});
  assert.equal(plan.totalHours, 14143 / 60, '75 days at 22 hours per week, rounded once to minutes');
  assert.equal(Core.validPlan(plan), true);
  assert.equal(plan.phases[0].id, 'content');
  assert.equal(plan.phases[1].id, 'mixed');
  assert.equal(plan.phases[2].id, 'execution');
  assert.equal(plan.phases[0].from, '2026-09-21');
  assert.equal(plan.phases.at(-1).to, '2026-12-04');
  assert.equal(Core.addDays(plan.phases[0].to, 1), plan.phases[1].from);
  assert.equal(Core.addDays(plan.phases[1].to, 1), plan.phases[2].from);
  const span = Core.daysBetween(plan.startDate, plan.testDate);
  const counts = plan.phases.map(p => Core.daysBetween(p.from, p.to) + 1);
  assert.equal(
    counts.reduce((a, b) => a + b, 0),
    span
  );
  const ranges = [
    [0.55, 0.7],
    [0.2, 0.3],
    [0.15, 0.25],
  ];
  counts.forEach((n, i) => {
    const pct = n / span;
    assert.ok(pct >= ranges[i][0] - 1e-9 && pct <= ranges[i][1] + 1e-9, `${plan.phases[i].id} ${pct}`);
  });
  const target = plan.totalHours * 60;
  const got = minutes(plan);
  assert.ok(Math.abs(got - target) / target <= 0.05, `${got} vs ${target}`);
  assert.equal(plan.warnings, undefined);
});

test('days off get no tasks, and a feature that is not available is never scheduled', () => {
  const plan = Core.build(BASE, {});
  let sawSunday = false;
  for (let i = 0; i < Core.daysBetween(BASE.startDate, BASE.testDate); i++) {
    const date = Core.addDays(BASE.startDate, i);
    if (Core.weekday(date) !== 'Sun') continue;
    sawSunday = true;
    assert.equal(plan.days[date], undefined, date);
  }
  assert.equal(sawSunday, true);
  for (const date of Object.keys(plan.days)) assert.notEqual(Core.weekday(date), 'Sun');

  const drills = Core.build({ ...BASE, features: ['drill'] }, { units: [{ id: 'u1', title: 'Stoichiometry' }] });
  const types = new Set(flat(drills).map(t => t.type));
  assert.deepEqual([...types], ['drill']);

  const withCourse = Core.build(
    { ...BASE, features: ['drill', 'course', 'rehearsal', 'repair'] },
    { units: [{ id: 'u1', title: 'Stoichiometry' }] }
  );
  assert.ok(flat(withCourse).some(t => t.type === 'course' && t.unit === 'u1'));
  assert.ok(flat(withCourse).some(t => t.type === 'repair'));
  const rehearsals = flat(withCourse).filter(t => t.type === 'rehearsal');
  assert.ok(rehearsals.length > 0);
  assert.ok(rehearsals.every(t => phaseOf(withCourse, t.date) === 'execution'));
  assert.equal(Core.build({ ...BASE, accommodations: true }, {}).reminder.includes('60 days'), true);
});

test('extra drills aim at the weakest section, from background before 60 items and from the log after', () => {
  const early = Core.build(
    { ...BASE, background: { bio: 3, gchem: 3, ochem: 1, qr: 3, rc: 3, pat: 3 } },
    { log: Array.from({ length: 10 }, (_, i) => ({ section: 'bio', correct: true, qId: 'b' + i })) }
  );
  const earlyDrills = flat(early).filter(t => t.type === 'drill');
  assert.ok(earlyDrills.length > 3);
  assert.ok(earlyDrills.every(t => t.section === 'ochem'));

  const log = [
    ...Array.from({ length: 30 }, (_, i) => ({ section: 'bio', correct: false, qId: 'b' + i })),
    ...Array.from({ length: 15 }, (_, i) => ({ section: 'gchem', correct: true, qId: 'g' + i })),
    ...Array.from({ length: 15 }, (_, i) => ({ section: 'ochem', correct: true, qId: 'o' + i })),
  ];
  const later = Core.build({ ...BASE, background: { bio: 2, gchem: 2, ochem: 2, qr: 2, rc: 2, pat: 2 } }, { log });
  const laterDrills = flat(later).filter(t => t.type === 'drill');
  assert.ok(laterDrills.every(t => t.section === 'bio'));
});

test('PAT level follows the phase unless two strong sets under budget step it up', () => {
  const plain = Core.build(BASE, {});
  const contentAngles = flat(plain).filter(t => t.subtest === 'angles' && phaseOf(plain, t.date) === 'content');
  const executionAngles = flat(plain).filter(t => t.subtest === 'angles' && phaseOf(plain, t.date) === 'execution');
  assert.ok(contentAngles.length > 0 && contentAngles.every(t => t.level === 1));
  assert.ok(executionAngles.length > 0 && executionAngles.every(t => t.level === 3));

  const raised = Core.build(BASE, { log: sets('angles', 1, 14) });
  const bumped = flat(raised).filter(t => t.subtest === 'angles' && phaseOf(raised, t.date) === 'content');
  const untouched = flat(raised).filter(t => t.subtest === 'keyholes' && phaseOf(raised, t.date) === 'content');
  assert.ok(bumped.every(t => t.level === 2));
  assert.ok(untouched.every(t => t.level === 1));
  const stillHard = flat(raised).filter(t => t.subtest === 'angles' && phaseOf(raised, t.date) === 'execution');
  assert.ok(stillHard.every(t => t.level === 3));
});

test('done marks survive a rebuild and an unknown task type is rejected before it could be saved', () => {
  const plan = Core.build(BASE, {});
  const date = Object.keys(plan.days).sort()[0];
  const id = plan.days[date][0].id;
  const marked = Core.markDone(plan, date, id, 1789012345000);
  assert.equal(marked.done[`${date}:${id}`], 1789012345000);
  assert.equal(plan.done[`${date}:${id}`], undefined);
  assert.ok(!Core.todayTasks(marked, date).some(t => t.id === id));
  const again = Core.regenerate(marked, null, {});
  assert.equal(again.done[`${date}:${id}`], 1789012345000);
  assert.equal(
    again.days[date].some(t => t.id === id),
    true
  );
  assert.equal(Core.validPlan(JSON.parse(JSON.stringify(again))), true);

  const bad = JSON.parse(JSON.stringify(plan));
  bad.days[date].push({ id: 'x', type: 'wizard', minutes: 5 });
  assert.equal(Core.validPlan(bad), false);
  assert.equal(Core.validPlan(plan), true);
});

test('the lowest of the six scores leads, and perceptual ability is one of the six', () => {
  const chemistry = Core.build(BASE, {
    exams: [
      {
        id: 'e1',
        date: '2026-11-10',
        source: 'official-practice',
        scores: { bio: 410, gchem: 390, ochem: 420, pat: 450, rc: 430, qr: 400 },
      },
    ],
  });
  assert.equal(chemistry.focus, 'gchem');
  const dates = Object.keys(chemistry.days).sort();
  for (const date of [dates[0], dates[Math.min(10, dates.length - 1)]]) {
    assert.equal(chemistry.days[date][0].type, 'drill');
    assert.equal(chemistry.days[date][0].section, 'gchem');
  }

  const perceptual = Core.build(BASE, {
    exams: [
      {
        id: 'e2',
        date: '2026-11-10',
        source: 'official-practice',
        scores: { bio: 500, gchem: 500, ochem: 500, pat: 300, rc: 500, qr: 400 },
      },
    ],
  });
  assert.equal(perceptual.focus, 'pat');
  assert.equal(perceptual.days[Object.keys(perceptual.days).sort()[0]][0].type, 'pat');
});

test('a plan outside 150 to 400 hours carries a warning and still conserves its hours', () => {
  const low = Core.build({ ...BASE, hoursPerWeek: 2, features: ['drill'] }, {});
  assert.ok(low.totalHours < 150);
  assert.match(low.warnings.join(' '), /150/);
  const target = low.totalHours * 60;
  const got = minutes(low);
  assert.ok(Math.abs(got - target) / target <= 0.05, `${got} vs ${target}`);
});

function ui(now = '2026-09-23T12:00:00') {
  const dom = new JSDOM('<!doctype html><div id="app"></div>', {
    url: 'http://localhost/dat?view=plan',
    runScripts: 'outside-only',
  });
  const w = dom.window;
  const NativeDate = w.Date;
  w.Date = class extends NativeDate {
    constructor(...args) {
      super(...(args.length ? args : [now]));
    }
    static now() {
      return new NativeDate(now).getTime();
    }
  };
  const context = dom.getInternalVMContext();
  const store = new Map();
  let failed = 0;
  Object.assign(w, {
    DAT: {
      attemptStores: null,
      outline: {
        pacingSeconds: { bio: 54, qr: 67 },
        patSubtests: [
          { id: 'angles', seconds: 22 },
          { id: 'holes', seconds: 25 },
        ],
      },
      rc: { passages: [{ id: 'rc-1' }, { id: 'rc-2' }] },
      course: { units: [] },
    },
    DatPractice: {},
    DatPat: {},
    DatPatCore: { BUILT: ['keyholes', 'tfe', 'angles', 'holes', 'cubes', 'patterns'] },
    DatQr: {},
    DatRc: {},
    StudyStorage: {
      read: (key, fallback) => (store.has(key) ? JSON.parse(store.get(key)) : fallback),
      write(key, value) {
        if (value === null) store.delete(key);
        else store.set(key, JSON.stringify(value));
        return true;
      },
      sessionFailed() {
        failed += 1;
      },
    },
    el(html) {
      const node = w.document.createElement('template');
      node.innerHTML = html.trim();
      return node.content.firstElementChild;
    },
    esc: value =>
      String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;'),
    datUrl(params = {}) {
      const url = new w.URLSearchParams();
      for (const [key, value] of Object.entries(params)) if (value != null) url.set(key, String(value));
      const query = url.toString();
      return '/dat' + (query ? '?' + query : '');
    },
    datView(main) {
      w.document.querySelector('#app').replaceChildren(main);
    },
  });
  vm.runInContext(fs.readFileSync('dat-plan-engine.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('dat-plan.js', 'utf8'), context);
  return {
    w,
    store,
    failed: () => failed,
    close: () => dom.window.close(),
  };
}

test('the schedule page builds a week grid, Today launches three runners, and a damaged plan is cleared', () => {
  const src = fs.readFileSync('dat-plan.js', 'utf8');
  assert.equal(src.includes('sessionFailed'), false);
  const persist = src.slice(src.indexOf('function persist'));
  assert.match(persist.slice(0, persist.indexOf('StudyStorage.write')), /validPlan\(plan\)/);

  const page = ui();
  page.store.set(
    'cs-dat-plan',
    JSON.stringify({ version: 1, days: { '2026-09-21': [{ id: 'x', type: 'wizard', minutes: 5 }] } })
  );
  assert.equal(page.w.DatPlan.today(), true);
  assert.match(page.w.document.body.textContent, /could not be read/);
  assert.equal(page.failed(), 0);
  assert.equal(page.store.has('cs-dat-plan'), false);

  page.w.DatPlan.render();
  page.w.document.querySelector('#dat-plan-start').value = '2026-09-21';
  page.w.document.querySelector('#dat-plan-date').value = '2026-12-02';
  page.w.document.querySelector('#dat-plan-hours').value = '22';
  page.w.document
    .querySelector('#dat-plan-form')
    .dispatchEvent(new page.w.Event('submit', { bubbles: true, cancelable: true }));
  assert.ok(page.w.document.querySelector('.dat-plan-week'));
  assert.match(page.w.document.body.textContent, /Content/);
  assert.match(page.w.document.body.textContent, /Mixed practice/);
  assert.match(page.w.document.body.textContent, /Exam execution/);

  assert.equal(page.w.DatPlan.today(), true);
  const links = [...page.w.document.querySelectorAll('.dat-today-task a')].map(a => a.getAttribute('href'));
  assert.equal(links.length, 3);
  assert.match(links[0], /view=pat&subtest=[a-z]+&level=\d/);
  assert.match(links[1], /view=drill&section=(bio|gchem|ochem)&n=\d+/);
  assert.match(links[2], /view=(qr&n=\d+|rc&passage=rc-)/);

  page.w.DatPlan.render();
  const scores = { bio: 410, gchem: 390, ochem: 420, pat: 450, rc: 430, qr: 400 };
  for (const [section, value] of Object.entries(scores))
    page.w.document.querySelector('#dat-plan-score-' + section).value = String(value);
  page.w.document
    .querySelector('#dat-plan-scores')
    .dispatchEvent(new page.w.Event('submit', { bubbles: true, cancelable: true }));
  const saved = JSON.parse(page.store.get('cs-dat-plan'));
  assert.equal(saved.focus, 'gchem');
  const first = saved.days[Object.keys(saved.days).sort()[0]][0];
  assert.equal(first.type, 'drill');
  assert.equal(first.section, 'gchem');
  assert.equal(page.w.document.querySelector('#dat-plan-focus').dataset.datFocus, 'gchem');
  assert.match(page.w.document.querySelector('#dat-plan-focus').textContent, /General chemistry leads/);
  assert.equal(page.failed(), 0);
  page.close();
});

test('alternating reading days visit every available passage before repeating', () => {
  const passages = Array.from({ length: 6 }, (_, i) => 'rc-' + (i + 1));
  const plan = Core.build(BASE, { passages });
  const scheduled = flat(plan)
    .filter(t => t.type === 'rc')
    .map(t => t.passage);
  assert.deepEqual(scheduled.slice(0, 6), passages);
  assert.deepEqual(scheduled.slice(6, 12), passages);
});

test('PAT ramp uses accuracy rather than 13 correct answers in an arbitrarily long set', () => {
  const log = [0, 1].flatMap(attempt =>
    Array.from({ length: 30 }, (_, i) => ({
      section: 'pat',
      subtest: 'angles',
      level: 1,
      attemptId: 'long-' + attempt,
      correct: i < 13,
      ms: 1000,
    }))
  );
  const plan = Core.build(BASE, { log });
  assert.ok(
    flat(plan)
      .filter(t => t.subtest === 'angles' && phaseOf(plan, t.date) === 'content')
      .every(t => t.level === 1)
  );
});

test('corrupted plan collections, task routes, and dates are rejected without throwing', () => {
  const good = Core.build(BASE);
  const date = Object.keys(good.days)[0];
  const mutate = [
    p => {
      p.phases = [null];
    },
    p => {
      p.warnings = {};
    },
    p => {
      p.phases[0].from = '2026-09-20';
    },
    p => {
      p.phases[1].id = 'content';
    },
    p => {
      p.days[date][0] = null;
    },
    p => {
      p.days[date][0].params = { view: 'course', unit: 'missing' };
    },
    p => {
      p.days[date][0].n = -1;
    },
    p => {
      p.days[date].push(p.days[date][0]);
    },
    p => {
      p.days['2026-12-25'] = p.days[date];
    },
    p => {
      p.days['2026-09-27'] = p.days[date];
    },
    p => {
      p.days = {};
    },
    p => {
      delete p.days[date];
    },
    p => {
      p.exams = [null];
    },
  ];
  for (const change of mutate) {
    const bad = structuredClone(good);
    change(bad);
    assert.equal(Core.validPlan(bad), false);
    const page = ui();
    page.store.set('cs-dat-plan', JSON.stringify(bad));
    assert.doesNotThrow(() => page.w.DatPlan.render());
    assert.match(page.w.document.body.textContent, /could not be read/);
    assert.equal(page.store.has('cs-dat-plan'), false);
    page.close();
  }
  assert.equal(Core.validPlan(good), true);
});

test('invalid schedule rebuild reports the error without pretending the old plan was rebuilt', () => {
  const original = Core.build(BASE);
  assert.equal(Core.regenerate(original, { testDate: BASE.startDate }), null);
  const page = ui();
  const saved = JSON.stringify(original);
  page.store.set('cs-dat-plan', saved);
  page.w.DatPlan.render();
  page.w.document.querySelector('#dat-plan-date').value = BASE.startDate;
  page.w.document
    .querySelector('#dat-plan-form')
    .dispatchEvent(new page.w.Event('submit', { bubbles: true, cancelable: true }));
  assert.match(page.w.document.querySelector('#dat-plan-error').textContent, /test date after the start/);
  assert.equal(page.store.get('cs-dat-plan'), saved);
  page.close();
});

test('Today handles rest days, future starts, and the test date without wrapping into the past', () => {
  const plan = Core.build(BASE);
  assert.equal(Core.anchorDate(plan, '2026-09-01'), BASE.startDate);
  assert.equal(Core.anchorDate(plan, '2026-09-27'), '2026-09-28');
  assert.equal(Core.anchorDate(plan, BASE.testDate), null);
  assert.equal(Core.anchorDate(plan, '2027-01-01'), null);
  const page = ui('2027-01-01T12:00:00');
  page.store.set('cs-dat-plan', JSON.stringify(plan));
  assert.equal(page.w.DatPlan.today(), true);
  assert.match(page.w.document.querySelector('h1').textContent, /schedule has ended/);
  assert.equal(page.w.document.querySelectorAll('.dat-today-task').length, 0);
  assert.match(page.w.document.querySelector('.dat-plan-back a').href, /view=plan/);
  page.close();
});

test('every scheduled extra drill can be launched and marked done from the full schedule', () => {
  const plan = Core.build(BASE);
  const page = ui();
  page.store.set('cs-dat-plan', JSON.stringify(plan));
  page.w.DatPlan.render();
  const extra = page.w.document.querySelector('details.dat-plan-more');
  assert.ok(extra);
  const link = extra.querySelector('a');
  assert.match(link.href, /view=drill&section=(bio|gchem|ochem)&n=\d+&mode=paced/);
  const mark = extra.querySelector('[data-dat-plan-done]');
  const key = mark.getAttribute('data-dat-plan-done');
  mark.click();
  assert.ok(JSON.parse(page.store.get('cs-dat-plan')).done[key]);
  assert.ok(page.w.document.querySelector('details.dat-plan-more .is-done'));
  page.close();
});

test('calendar arithmetic remains stable across leap day and US DST changes in multiple time zones', () => {
  const { execFileSync } = require('node:child_process');
  const program = `const c = require('./dat-plan-engine'); console.log(JSON.stringify([
    c.addDays('2028-02-28',1),c.addDays('2028-02-29',1),
    c.daysBetween('2026-03-07','2026-03-10'),c.daysBetween('2026-10-31','2026-11-03'),
    c.weekday('2026-11-01'),c.build(${JSON.stringify(BASE)}).phases
  ]));`;
  const results = ['UTC', 'America/Chicago', 'Pacific/Auckland'].map(TZ =>
    execFileSync(process.execPath, ['-e', program], {
      cwd: process.cwd(),
      env: { ...process.env, TZ },
      encoding: 'utf8',
    })
  );
  assert.equal(results[0], results[1]);
  assert.equal(results[0], results[2]);
  assert.deepEqual(JSON.parse(results[0]).slice(0, 5), ['2028-02-29', '2028-03-01', 3, 3, 'Sun']);
});

test('short plans keep a positive minute budget and small schedules distribute it across study days', () => {
  for (const hoursPerWeek of [1, 2]) {
    const plan = Core.build({ ...BASE, testDate: Core.addDays(BASE.startDate, 1), hoursPerWeek });
    assert.equal(Core.validPlan(plan), true);
    assert.ok(plan.totalHours > 0 && plan.totalHours < 1);
    assert.ok(Math.abs(minutes(plan) - plan.totalHours * 60) <= 1);
  }
  const plan = Core.build({ ...BASE, testDate: Core.addDays(BASE.startDate, 70), hoursPerWeek: 1 });
  const totals = Object.values(plan.days).map(tasks => tasks.reduce((sum, t) => sum + t.minutes, 0));
  assert.ok(Math.max(...totals) - Math.min(...totals) <= 1);
  assert.ok(Math.abs(minutes(plan) - plan.totalHours * 60) / (plan.totalHours * 60) <= 0.05);
});

test('short low-hour plans allocate the requested calendar budget instead of rounding to whole hours', () => {
  for (const [span, expectedMinutes] of [
    [1, 9],
    [2, 17],
    [3, 26],
    [4, 34],
    [5, 43],
    [6, 51],
    [8, 69],
    [10, 86],
    [11, 94],
  ]) {
    const plan = Core.build({ ...BASE, testDate: Core.addDays(BASE.startDate, span), hoursPerWeek: 1 });
    assert.ok(Core.validPlan(plan));
    assert.equal(plan.totalHours, expectedMinutes / 60, `${span} days: retain minute precision`);
    assert.equal(minutes(plan), expectedMinutes, `${span} days: scheduled blocks fill the real budget`);
    assert.ok(Math.abs(minutes(plan) - (span * 60) / 7) <= 0.5, 'rounding error is at most half a minute');
  }
  const usual = Core.build({ ...BASE, testDate: Core.addDays(BASE.startDate, 70) });
  assert.equal(usual.totalHours, 220, 'ten whole weeks still budget exactly 220 hours');
});

test('whole-hour version-1 budgets remain readable without silently rebuilding saved plans', () => {
  for (const [span, previousHours] of [
    [4, 1],
    [10, 1],
    [70, 220],
    [103, 324],
  ]) {
    const plan = Core.build({
      ...BASE,
      testDate: Core.addDays(BASE.startDate, span),
      hoursPerWeek: span < 70 ? 1 : 22,
    });
    plan.totalHours = previousHours;
    const date = Object.keys(plan.days)[0];
    plan.done[`${date}:${plan.days[date][0].id}`] = 1790160000000;
    assert.ok(Core.validPlan(plan), `${previousHours}-hour legacy budget remains valid`);
    const page = ui();
    const saved = JSON.stringify(plan);
    page.store.set('cs-dat-plan', saved);
    page.w.DatPlan.render();
    assert.ok(page.w.document.querySelector('.dat-plan-week'));
    assert.equal(page.w.document.querySelector('#dat-plan-cleared'), null);
    assert.equal(page.store.get('cs-dat-plan'), saved, 'viewing a legacy schedule must not rewrite it');
    page.close();
    const rebuilt = Core.regenerate(plan);
    assert.equal(rebuilt.totalHours, Math.round((span * plan.hoursPerWeek * 60) / 7) / 60);
    assert.deepEqual(rebuilt.done, plan.done, 'an explicit rebuild retains completed work');
  }
});

test('small budgets preserve all six possible focus sections and disclose indivisible reading blocks', () => {
  for (const focus of Core.SECTIONS) {
    const scores = Object.fromEntries(Core.SECTIONS.map(s => [s, s === focus ? 200 : 500]));
    const plan = Core.build(
      { ...BASE, testDate: Core.addDays(BASE.startDate, 70), hoursPerWeek: 1 },
      { exams: [{ scores }] }
    );
    assert.equal(Core.validPlan(plan), true);
    for (const tasks of Object.values(plan.days)) {
      const lead = tasks[0];
      assert.equal(lead.type === 'drill' ? lead.section : lead.type, focus);
    }
    if (focus === 'rc') {
      assert.ok(minutes(plan) > plan.totalHours * 60);
      assert.match(plan.warnings.join(' '), /shortest available blocks.*above your/);
    } else {
      assert.ok(Math.abs(minutes(plan) - plan.totalHours * 60) / (plan.totalHours * 60) <= 0.05, focus);
    }
  }
});

test('setup bounds reject zero-day spans, unavailable study dates, and more than 60 weekly hours', () => {
  assert.equal(Core.build({ ...BASE, testDate: BASE.startDate }), null);
  assert.equal(Core.build({ ...BASE, testDate: '2026-02-30' }), null);
  assert.equal(Core.build({ ...BASE, hoursPerWeek: 61 }), null);
  assert.equal(Core.build({ ...BASE, daysOff: Core.WEEKDAYS }), null);
  assert.equal(Core.build({ ...BASE, testDate: Core.addDays(BASE.startDate, 1), daysOff: ['Mon'] }), null);
  const over = Core.build(BASE);
  over.hoursPerWeek = 61;
  assert.equal(Core.validPlan(over), false);
});
