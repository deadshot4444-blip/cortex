const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Course = require('../mcat-course-engine.js');

function setup() {
  const events = [];
  const context = vm.createContext({
    console,
    URLSearchParams,
    location: { search: '' },
    McatCourseCore: Course,
    StudyStorage: { read: (_, fallback) => fallback, watch: () => ({ save: () => true }) },
    document: { addEventListener() {} },
    addEventListener() {},
    CortexAcademy: { renderCatalog: () => events.push('catalog') },
    v2PauseActivity: () => events.push('activity paused'),
    studyPausePassage: key => events.push(key + ' paused'),
    McatRehearsal: { pause: () => events.push('rehearsal paused') },
  });
  context.window = context;
  const run = code => vm.runInContext(code, context);
  run(fs.readFileSync('mcat-course.js', 'utf8'));
  const app = fs.readFileSync('app.js', 'utf8');
  run('let _sectionRequest = 0; const COMING_SOON = new Set(); const SECTION_SCRIPTS = {};');
  run(app.slice(app.indexOf('async function openSection(key)'), app.indexOf('function sectionFromPath()')));
  return { run, events };
}

test('Back to the Academy during partial MCAT loading still renders the catalog', async () => {
  const h = setup();
  assert.equal(h.run('typeof MCAT'), 'undefined');
  assert.equal(await h.run('openSection("academy")'), true);
  assert.deepEqual(h.events, ['catalog']);
});

test('leaving a fully loaded MCAT still pauses active passage and rehearsal timers', async () => {
  const h = setup();
  h.run(fs.readFileSync('mcat.js', 'utf8'));
  h.run('cars = {phase:"attempt", timerId:1}; plab = {phase:"attempt", timerId:2}; sim = {rehearsalVersion:1};');
  assert.equal(await h.run('openSection("academy")'), true);
  assert.deepEqual(h.events, ['activity paused', 'cars paused', 'plab paused', 'rehearsal paused', 'catalog']);
});
