/* Runs the real Clinical Shift screens in jsdom with the real StudyStorage, for tests that play a shift
   tap by tap (scripts/test-clinical-reactions.cjs, scripts/test-clinical-taps.cjs). */
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  vm = require('node:vm'),
  { JSDOM } = require('jsdom');
const KEY = 'cs-clinical-shift-v1',
  pause = () => new Promise(resolve => setImmediate(resolve));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const pilot = read('data/clinical-shift-pilot.json');
const banks = Object.fromEntries(pilot.rotations.map(rotation => [rotation.key, read(`data/${rotation.key}.json`)]));
/* Every registered encounter, with whether a reaction layer has been written for it. */
const encounters = pilot.rotations.flatMap(rotation =>
  rotation.caseIds.map(id => ({
    id,
    rotation,
    caseData: banks[rotation.key].cases.find(c => c.id === id),
    reaction: pilot.reactions?.[id] || null,
  }))
);
const HOLD = /const SHIFT_TAP_HOLD_MS = (\d+);/,
  EXPORT = 'window.renderClinicalShift = renderClinicalShift;';

/* A person cannot tap twice inside the hold; a test can. It is switched off unless the test is about it. */
function shiftSource(hold) {
  const source = fs.readFileSync('clinical-shift.js', 'utf8');
  assert.match(source, HOLD);
  assert.ok(source.includes(EXPORT));
  return (hold ? source : source.replace(HOLD, 'const SHIFT_TAP_HOLD_MS = 0;')).replace(
    EXPORT,
    `window.testShift={reactionUsable,caseIsCompatible,activeIsCompatible,newActiveShift,shiftTimeline,applyDecisionOutcome,applyResidentFix,setManifest:value=>shiftManifest=value,setSession:value=>shiftSession=value}; ${EXPORT}`
  );
}
const holdMs = Number(fs.readFileSync('clinical-shift.js', 'utf8').match(HOLD)?.[1]);

function harness({ manifest = pilot, seed = null, hold = false } = {}) {
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', {
    url: 'http://localhost/practice',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window,
    ctx = dom.getInternalVMContext(),
    errors = [];
  if (seed) w.localStorage.setItem(KEY, seed);
  w.addEventListener('error', event => {
    errors.push(event.error);
    event.preventDefault();
  });
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  w.el = html => {
    const template = w.document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  };
  w.esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  w.topbar = () => w.el('<header>Clinical Scenarios</header>');
  w.setView = root => w.document.querySelector('#app').replaceChildren(root);
  w.store = { progress: {}, cases: {}, history: [], streak: {} };
  w.stopTimer = () => {};
  w.session = null;
  w.LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  w.NAME_BY_KEY = Object.fromEntries(pilot.rotations.map(rotation => [rotation.key, rotation.name]));
  w.renderClinicalCaseBank = () => {};
  w.renderReview = () => {};
  w.ClinicalLongitudinal = { entry: async () => {}, open() {} };
  w.CortexProgress = { OWNER: 'test-owner' };
  w.sectionUrl = key => '/' + key;
  w.fetch = async () => ({ ok: true, json: async () => structuredClone(manifest) });
  w.loadSpecialty = async key => structuredClone(banks[key]);
  vm.runInContext(fs.readFileSync('study-storage.js', 'utf8'), ctx);
  vm.runInContext(shiftSource(hold), ctx);
  const find = selector => w.document.querySelector(selector),
    all = selector => [...w.document.querySelectorAll(selector)];
  const text = selector => {
    const node = find(selector);
    assert.ok(node, 'Missing ' + selector);
    return node.textContent.replace(/\s+/g, ' ').trim();
  };
  return {
    w,
    find,
    all,
    text,
    errors,
    click(selector) {
      const node = find(selector);
      assert.ok(node, 'Missing ' + selector);
      assert.equal(node.disabled, false, selector + ' is disabled');
      node.click();
      assert.equal(errors.length, 0, errors[0]?.stack);
    },
    type(selector, value) {
      const node = find(selector);
      assert.ok(node, 'Missing ' + selector);
      node.value = value;
      node.dispatchEvent(new w.Event('input', { bubbles: true }));
      assert.equal(errors.length, 0, errors[0]?.stack);
    },
    /* Opens or closes the notepad the way a click on its title bar does. */
    notepad(open) {
      const pad = find('.cshift-notepad');
      assert.ok(pad, 'Missing the notepad');
      pad.open = open;
      pad.dispatchEvent(new w.Event('toggle'));
    },
    clock: () => Number(find('#cshift-clock').dataset.minutes),
    state: () => JSON.parse(w.localStorage.getItem(KEY)),
    raw: () => w.localStorage.getItem(KEY),
    close: () => w.close(),
  };
}

/* The one text box a shift may show is the optional notepad; no step asks for typing or a second tap. */
function assertTapOnly(h, label) {
  assert.equal(h.find('.cshift-task textarea, .cshift-task input'), null, `${label} asks for typed text`);
  assert.deepEqual(
    h.all('textarea, input').map(node => node.id),
    h.find('.cshift-side') ? ['cshift-notes'] : [],
    `${label}: the only text box is the optional notepad`
  );
  assert.equal(
    h.find('#cshift-lock-decision, #cshift-lock-differential, .cshift-locked, .cshift-option[aria-pressed]'),
    null,
    `${label} has a second step to confirm an answer`
  );
  assert.deepEqual(
    h.all('.cshift-stepper strong').map(node => node.textContent),
    ['Handoff', 'Investigate', 'Decide', 'Debrief']
  );
}

const flat = value => String(value).replace(/\s+/g, ' ').trim();

module.exports = { KEY, pause, pilot, banks, encounters, harness, holdMs, assertTapOnly, flat };
