// Public availability contract: which Academy tracks are open on the live site, and how the
// catalog and the offline download list present the closed ones. Guards against a track being
// reopened (or a closed one advertised) by accident. Edit `available` in academy.js to change it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const OPEN = ['mcat', 'practice'];
const CLOSED = ['socrates', 'anatomy', 'reference', 'neuro'];

function harness(local) {
  const dom = new JSDOM('<!doctype html><div id="app"></div>', {
    url: 'https://cortex.example/academy',
    runScripts: 'outside-only',
  });
  const w = dom.window,
    context = dom.getInternalVMContext();
  Object.assign(w, {
    IS_LOCAL_PREVIEW: local,
    sectionUrl: id => '/' + id,
    stopTimer() {},
    el: html => {
      const t = w.document.createElement('template');
      t.innerHTML = html;
      return t.content.firstElementChild;
    },
    esc: value => String(value),
    setView: node => w.document.querySelector('#app').replaceChildren(node),
  });
  w.topbar = () => w.el('<header>Academy</header>');
  vm.runInContext(fs.readFileSync('academy.js', 'utf8'), context);
  return { w, dom };
}

test('only MCAT and Clinical Scenarios are open to the public', () => {
  const { w, dom } = harness(false);
  // Array.from re-creates the list in this realm; jsdom's arrays fail deepEqual on prototype.
  const tracks = Array.from(w.CortexAcademy.tracks);
  assert.equal(tracks.length, 6);
  assert.deepEqual(
    tracks.filter(t => t.available).map(t => t.id),
    OPEN
  );
  assert.deepEqual(
    tracks.filter(t => !t.available).map(t => t.id),
    CLOSED
  );
  for (const id of OPEN) assert.equal(w.CortexAcademy.status(tracks.find(t => t.id === id)), 'Beta');
  for (const id of CLOSED) assert.equal(w.CortexAcademy.status(tracks.find(t => t.id === id)), 'Under construction');
  dom.window.close();
});

test('the public catalog labels closed courses and points them at the course status page', () => {
  const { w, dom } = harness(false);
  w.CortexAcademy.renderCatalog();
  const statuses = [...w.document.querySelectorAll('.academy-status')].map(node => node.textContent);
  assert.deepEqual(statuses, [
    'Beta',
    'Under construction',
    'Beta',
    'Under construction',
    'Under construction',
    'Under construction',
  ]);
  const actions = [...w.document.querySelectorAll('.academy-course-bottom a')].map(a =>
    a.textContent.replace(/\s*→\s*$/, '').trim()
  );
  assert.deepEqual(actions, [
    'Open MCAT',
    'View course status',
    'Explore clinical cases',
    'View course status',
    'View course status',
    'View course status',
  ]);
  for (const id of CLOSED)
    assert.equal(w.document.querySelector(`h2 a[data-course="${id}"]`).getAttribute('href'), '/' + id);
  dom.window.close();
});

test('localhost previews still open the closed courses for development', () => {
  const { w, dom } = harness(true);
  for (const id of CLOSED)
    assert.equal(w.CortexAcademy.status(w.CortexAcademy.tracks.find(t => t.id === id)), 'Local preview');
  w.CortexAcademy.renderCatalog();
  assert.equal(w.document.body.textContent.includes('View course status'), false);
  dom.window.close();
});

test('the public offline download list skips closed courses but keeps open ones', () => {
  const source = fs.readFileSync('offline.js', 'utf8');
  const manifest = JSON.parse(fs.readFileSync('offline-manifest.json'));
  const closedCourse = source.match(/const closedCourse = [^;]+;/)?.[0];
  assert.ok(closedCourse, 'offline.js defines closedCourse');
  const evaluate = (local, tracks) => {
    const context = vm.createContext({ IS_LOCAL_PREVIEW: local, window: { CortexAcademy: { tracks } } });
    vm.runInContext(closedCourse + ' closedCourse;', context);
    return id => vm.runInContext(`closedCourse(${JSON.stringify(id)})`, context);
  };
  const catalog = harness(false).w.CortexAcademy.tracks;
  const publicCheck = evaluate(false, catalog);
  assert.deepEqual(
    manifest.packs.filter(pack => !publicCheck(pack.id)).map(pack => pack.id),
    OPEN
  );
  const localCheck = evaluate(true, catalog);
  assert.deepEqual(
    manifest.packs.filter(pack => !localCheck(pack.id)).map(pack => pack.id),
    manifest.packs.map(pack => pack.id)
  );
  const noCatalog = vm.createContext({ IS_LOCAL_PREVIEW: false, window: {} });
  vm.runInContext(closedCourse + ' closedCourse;', noCatalog);
  assert.equal(vm.runInContext('closedCourse("neuro")', noCatalog), false);
});
