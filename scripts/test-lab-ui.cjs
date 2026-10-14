// Lab section shell (lab.js) in jsdom: state round-trip through a StudyStorage stub (written through
// SilverLab.serialize, refused when it carries the reserved label), renderLabEntry rendering one h1
// and the safety gate, ?view= routing, the bench gate -> run -> full protocol -> resolve -> replay
// flow, module done logic, and pairing that changes exactly one parameter group. Review round
// SHELL-7 adds: the render generation (leaving mid-load paints nothing), the designer's post-reveal
// save lock, the module gate before default runs, slug-keyed module runs that a portable backup
// accepts, ?exp=new, run locking, accessible names and focus management, and the study-backup
// plainText clause for cs-lab-state-v1. SHELL-9 (clip review round) adds: a run in progress tells
// the director's story on the S6 and structure cards, the loaded chip follows clipState().loaded,
// focus survives the S6 card rebuild, the documented keys never scroll the page, the aria-live
// caption node persists across re-renders, and getSpecimen() without a run. UX-A (student-friendly
// cleanup, contract §8) adds: CortexLab.words / badge / badgeForOutcome / level / summarize, the new
// home (three cards, My report, the progress strip, one honesty line), ?view=about, the compact
// safety gate and its one-line acknowledged state, the activities card grid, and badges in place of
// the long label banners. UX-B (the bench in three parts, contract §8.3) adds: the header (specimen chip,
// run name, History, Safety notes, the 3D / List segmented control), 1. Set up (four specimen cards,
// #lab-change-what mapping every option onto its exact engine param through one set-params event, All
// settings), 2. Do the steps (#lab-do-step in procedure order, Run all / Run the rest, Pick a different
// step out of order, the side sheet), 3. Result (one card: badge, summary, Why?, Compare, Look into the
// tissue), the comparison, History, the run lock, and the clip block shown only while a clip plays.
// UX-E (the activities stepper) adds: one step per screen with Back / Next swapping the screen in place,
// M6's three predictions on one screen, "required" in words, the persistent checklist status, at most
// three read-first facts with the rest under Sources, no engine identifier in view on any activity
// screen, plain curves, and the thin microscope / report / designer host headers. UX-R2 (re-walk round 2)
// adds: the header's Run menu (New run, History, Safety notes) and ONE view toggle, "Do a different step"
// inside the Explain sheet, the "3D options" disclosure under the stage, Play the intro hidden while the
// intro plays, Look into the tissue beside the result placeholder, the first view's control budget,
// and the bench's transient stage hint (api.onHint). UX-SMALL adds: the microscope's way back to the
// designer (from=designer), "3D options" closing when a run finishes or starts, the phone's sticky
// "Do this step" in list mode only (a covered control lifted above it on focus), and the export names
// (CortexLab.runHeading / paramText / stepTitle) with plainRule / plainCaveat. UX-POLISH adds: sealed runs
// ("Make the runs for me" and every outcome surface), the finished run's jars, Redo asking first, the
// stage back in view after a step, History in the export's words and the microscope's anchor (at=).
// UX-LAST adds: CortexLab.changeOptions / matchChange, "Make the runs for me" making exactly the planned
// change or nothing (the refusal), the seen baseline kept open, twin sealing, the microscope's open run
// beside a sealed card, the camera at S6 after the last step, and the small fixes (badge colon, ?run=
// on a History switch, the designer anchor on Back, room for the select chevron). TONING (ENGINE-14) adds:
// a run that skips gold toning or thiosulfate never offers, does or logs that step (Do this step, Run all,
// the pick list, a jar double click, Make the runs for me), counts only the steps it needs and comes back
// a drawn picture with the course procedure's caveat (§11.5); the skip options carry no "(not modeled)" tag; the twin key reads toning / thiosulfate (old seals
// dropped on load); run names say a change as paramText does.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const SRC = { core: read('silver-lab-core.js'), lab: read('lab.js'), notebook: read('lab-notebook.js') };
const STATE_KEY = 'cs-lab-state-v1';

// `files` overrides what fetch answers for a data path (without the query): null -> 404, an object ->
// that JSON. `benchModule` is installed as LAB.benchModule (a dynamic import() cannot run in a vm
// context), and `webgl2` makes the capability probe answer true.
function harness({
  url = 'http://localhost/lab?view=home',
  store = new Map(),
  writeOk = true,
  notebook = false,
  files = {},
  benchModule = null,
  webgl2 = false,
  flags = { activities: true, designer: true, report: true }, // BENCH-1: the tests keep the hidden pages covered
  // 3D is the bench's default since 2026-10-13; the tests written for the list start keep it as a saved
  // choice unless they pass startMode: null (a fresh visitor) or seed the store themselves.
  startMode = 'list',
} = {}) {
  if (startMode && !store.has(STATE_KEY))
    store.set(STATE_KEY, JSON.stringify({ v: 1, mode: startMode, modeChosen: true, runs: {}, runOrder: [] }));
  const dom = new JSDOM('<!doctype html><div id="app"></div>', {
    url,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window,
    context = dom.getInternalVMContext();
  const failed = [];
  Object.assign(w, {
    IS_LOCAL_PREVIEW: true,
    LAB_FLAGS: flags,
    LETTERS: ['A', 'B', 'C', 'D', 'E', 'F'],
    CortexAcademy: {
      tracks: [{ id: 'lab', name: "Alzheimer's Histology Lab", available: false }],
      status: () => 'Local preview',
    },
    sectionUrl: id => '/' + id,
    stopTimer() {},
    el: html => {
      const t = w.document.createElement('template');
      t.innerHTML = html.trim();
      return t.content.firstElementChild;
    },
    esc: value =>
      String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;'),
    setView: node => w.document.querySelector('#app').replaceChildren(node),
    topbar: active => w.el(`<header data-section="${active}">Cortex</header>`),
    StudyStorage: {
      paused: false,
      read: (key, fallback) => (store.has(key) ? JSON.parse(store.get(key)) : fallback),
      watch: () => ({ save: () => writeOk }),
      write(key, value) {
        if (!writeOk) return false;
        store.set(key, JSON.stringify(value));
        return true;
      },
      writeRaw(key, value) {
        if (!writeOk) return false;
        if (value === null) store.delete(key);
        else store.set(key, String(value));
        return true;
      },
      remove: key => store.delete(key),
      sessionFailed: keys => failed.push(keys),
    },
    fetch: async file => {
      const name = String(file).replace(/^\//, '').split('?')[0];
      if (Object.prototype.hasOwnProperty.call(files, name)) {
        const value = files[name];
        if (value === null) return { ok: false, status: 404 };
        return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(value)) };
      }
      const full = path.join(ROOT, name);
      if (!fs.existsSync(full)) return { ok: false, status: 404 };
      return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(full, 'utf8')) };
    },
  });
  vm.runInContext(SRC.core, context);
  vm.runInContext(SRC.lab, context);
  if (notebook) vm.runInContext(SRC.notebook, context);
  const run = code => vm.runInContext(code, context);
  if (benchModule) w.LAB.benchModule = benchModule;
  if (webgl2) run('labWebgl2Cache = true');
  return { w, dom, store, failed, run, close: () => w.close() };
}
// Waits for the asynchronous bench mount (labStartBench awaits the module and mountBench).
const settled = async (w, check, tries = 100) => {
  for (let i = 0; i < tries && !check(); i++) await new Promise(r => setTimeout(r, 5));
  return check();
};
const $ = (w, sel) => w.document.querySelector(sel);
const $$ = (w, sel) => [...w.document.querySelectorAll(sel)];
// MODE §11.2: the station row's buttons replace the Go to station select: the current station's button
// carries aria-current; a press flies there.
const stationNamed = w => {
  const current = w.document.querySelector('#lab-stations .lab-station-btn[aria-current="true"]');
  return current ? current.dataset.labStation : '';
};
const stationGo = (w, id) => w.document.querySelector(`#lab-stations [data-lab-station="${id}"]`).click();
const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : '');
const submit = w => new w.Event('submit', { cancelable: true, bubbles: true });
const ACK = '2026-10-11T00:00:00.000Z';

const MODULE_IDS = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'];
const viewOf = a => new URL(a.getAttribute('href'), 'http://localhost').searchParams.get('view');
// The intro is every clip scene before 'dive'; the home card rounds its durationMs hints to five
// seconds (UX-FIX-lab.js: 27 s reads "25-second", not "30-second").
function introSeconds() {
  const items = JSON.parse(read('data/lab/clip.json')).items;
  const intro = items.slice(
    0,
    items.findIndex(scene => scene.id === 'dive')
  );
  return Math.round(intro.reduce((sum, scene) => sum + scene.durationMs, 0) / 5000) * 5;
}
// Engine identifiers and contract vocabulary a student never reads on home, about or the activities list.
const ENGINE_TOKENS =
  /\b(R|C|S|SPEC|H)-[A-Za-z0-9]|\brun-\d|\bM\d\b|sop-default|ordinal|PENDING-EHS|illustrative-synthetic|no-basis/;

test('FREE-1 home: one h1, a two-sentence lede (the modes; real slides, REF-shell), two short paragraphs, one Enter the lab button and one honesty line; cards, links, strip and gate are gone', async () => {
  const h = harness({ webgl2: true });
  await h.w.renderLabEntry();
  const { w } = h;
  assert.equal($$(w, 'h1').length, 1);
  assert.equal(text($(w, 'h1')), "Alzheimer's Histology Lab");
  assert.ok($(w, 'main.panel.lab-page.lab-view-home'));
  assert.equal($(w, 'header').dataset.section, 'lab');
  assert.equal(
    text($(w, '.lab-lede')),
    'Practice the modified Bielschowsky silver stain step by step, or take the free bench and mix anything to see what happens. Finished runs can be compared with real slides from open-access studies.'
  );
  assert.doesNotMatch(text($(w, 'main')), /UTSA|NDRB/, 'no course name on the first page');
  assert.equal($$(w, '.lab-home-intro p').length, 2, 'a light explanation');
  const enter = $(w, '#lab-enter');
  assert.equal(text(enter), 'Enter the lab');
  assert.equal(enter.getAttribute('href'), '/lab?view=bench');
  assert.ok(enter.classList.contains('btn-solid'));
  assert.equal($$(w, 'main a, main button').length, 2, 'Enter the lab and the honesty link only');
  assert.equal(w.document.title, "Alzheimer's Histology Lab | Cortex Medical Academy", 'home keeps the lab name');
  // one honesty line, linking to How this lab works
  const honesty = $$(w, '.lab-honesty');
  assert.equal(honesty.length, 1);
  assert.equal(text(honesty[0]), 'Everything here is a simulation. How this lab works');
  assert.equal(viewOf(honesty[0].querySelector('a')), 'about');
  // what moved off home
  for (const sel of [
    '.lab-home-cards',
    '[data-lab-home-card]',
    '.lab-home-links',
    '#lab-progress-strip',
    '[data-lab-safety]',
    '#lab-safety-ack',
    '.lab-legend',
    '[data-lab-mode]',
    '.lab-safety-notes',
    '.lab-banner',
  ])
    assert.equal($(w, sel), null, sel);
  assert.doesNotMatch(text($(w, 'main')), ENGINE_TOKENS);
  assert.doesNotMatch(text($(w, 'main')), /Illustrative simulation \(synthetic/);
  assert.ok($$(w, 'link[rel="stylesheet"]').some(l => l.href.includes('/lab-microscope.css?v=3')));
  assert.ok($$(w, 'link[rel="stylesheet"]').some(l => l.href.includes('/lab-notebook.css?v=3')));
  h.close();
  // the progress strip now opens the activities page: seven links and the count in words
  const m = harness({ url: 'http://localhost/lab?view=modules' });
  await m.w.renderLabEntry();
  const title = id => m.w.LAB.lab.getModule(id).title;
  const strip = $(m.w, '#lab-progress-strip');
  assert.equal(text(strip.querySelector('.lab-progress-text')), '0 of 7 activities done');
  const segs = [...strip.querySelectorAll('a.lab-progress-seg')];
  assert.deepEqual(
    segs.map(viewOf),
    MODULE_IDS.map(id => `module:${id}`)
  );
  assert.equal(segs[0].getAttribute('aria-label'), `Activity 1: ${title('M1')}, not done yet`);
  assert.equal(segs[0].getAttribute('aria-current'), 'step');
  assert.equal(strip.querySelectorAll('[aria-current]').length, 1);
  const state = m.w.CortexLab.getState();
  for (const id of ['M1', 'M2', 'M3']) state.moduleProgress[id] = { fields: {}, done: true };
  await m.w.renderLabEntry();
  assert.equal(text($(m.w, '.lab-progress-text')), '3 of 7 activities done');
  assert.equal($$(m.w, '.lab-progress-done').length, 3);
  assert.match($$(m.w, '.lab-progress-seg')[2].getAttribute('aria-label'), /, checklist complete$/);
  assert.equal($$(m.w, '.lab-progress-seg')[3].getAttribute('aria-current'), 'step');
  for (const id of MODULE_IDS) state.moduleProgress[id] = { fields: {}, done: true };
  await m.w.renderLabEntry();
  assert.equal($(m.w, '#lab-progress-strip [aria-current]'), null);
  m.close();
});

test('FREE-1 bench nav: the intro (or the text intro), Activities, Design an experiment, My report and How this lab works sit on one line under the bench title', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench', webgl2: true });
  await h.w.renderLabEntry();
  const { w } = h;
  const nav = $(w, 'main.lab-view-bench .lab-nav');
  assert.equal(nav.getAttribute('aria-label'), 'Lab pages');
  assert.deepEqual(
    [...nav.querySelectorAll('a')].map(a => [a.id || null, text(a), a.getAttribute('href')]),
    [
      ['lab-clip-watch', `Watch the ${introSeconds()}-second intro`, '/lab?view=bench&mode=3d&intro=1'],
      [null, 'Activities', '/lab?view=modules'],
      ['lab-home-designer', 'Design an experiment', '/lab?view=designer'],
      [null, 'My report', '/lab?view=notebook'],
      [null, 'How this lab works', '/lab?view=about'],
    ]
  );
  assert.ok($(w, '#lab-bench-body [data-lab-safety="open"]'), 'the nav shows above the gate');
  h.close();
  const flat = harness({ url: 'http://localhost/lab?view=bench' });
  await flat.w.renderLabEntry();
  const read = $(flat.w, '.lab-nav #lab-intro-text');
  assert.equal(text(read), 'Read the intro');
  assert.equal(read.getAttribute('href'), '/lab?view=intro');
  assert.equal($(flat.w, '#lab-clip-watch'), null);
  flat.close();
});

test('FREE-2 notepad: a Notes toggle in the bench header opens an aside whose textarea saves after a pause, stays across redraws and reaches the report through CortexLab.getNotepad', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  const toggle = () => $(w, '#lab-notes-toggle');
  const aside = () => $(w, '#lab-notepad');
  assert.equal(text(toggle()), 'Notes');
  assert.equal(toggle().getAttribute('aria-controls'), 'lab-notepad');
  assert.equal(aside().hidden, false, 'open by default: the notepad lives beside the simulation (BENCH-4)');
  assert.equal(toggle().getAttribute('aria-expanded'), 'true');
  assert.equal(aside().parentElement, $(w, 'main.lab-view-bench'), 'a sibling of the bench body, not inside it');
  assert.equal(text($(w, '#lab-notepad-download')), 'Download my notes (.txt)');
  toggle().click();
  assert.equal(aside().hidden, true);
  assert.equal(w.CortexLab.getState().settings.notesOpen, false, 'remembered');
  toggle().click();
  assert.equal(aside().hidden, false);
  assert.equal(toggle().getAttribute('aria-expanded'), 'true');
  assert.ok($(w, 'main.lab-view-bench').classList.contains('lab-notes-open'));
  assert.equal(w.document.activeElement.id, 'lab-notepad-text', 'opening lands in the textarea');
  assert.equal(w.CortexLab.getState().settings.notesOpen, true, 'remembered');
  const area = $(w, '#lab-notepad-text');
  area.value = 'The plaques went black before the background.';
  area.dispatchEvent(new w.Event('input', { bubbles: true }));
  assert.equal(w.CortexLab.getNotepad(), '', 'not saved per key');
  await new Promise(resolve => setTimeout(resolve, 500));
  assert.equal(w.CortexLab.getNotepad(), 'The plaques went black before the background.');
  assert.equal(JSON.parse(h.store.get(STATE_KEY)).notepad, 'The plaques went black before the background.');
  assert.equal(text($(w, '#lab-notepad-status')), 'Saved.');
  // a redraw of the bench keeps the aside and its text
  startRun(w);
  assert.equal(aside().hidden, false);
  assert.equal($(w, '#lab-notepad-text').value, 'The plaques went black before the background.');
  // Close returns to the toggle
  $(w, '#lab-notepad-close').click();
  assert.equal(aside().hidden, true);
  assert.equal(toggle().getAttribute('aria-expanded'), 'false');
  assert.equal(w.document.activeElement, toggle());
  assert.equal(w.CortexLab.getState().settings.notesOpen, false);
  // the API writes too
  w.CortexLab.setNotepad('From the report.');
  assert.equal(w.CortexLab.getNotepad(), 'From the report.');
  assert.equal(JSON.parse(h.store.get(STATE_KEY)).notepad, 'From the report.');
  h.close();
  // a saved notepad that is not a string is refused with the rest of the state
  const bad = harness({
    url: 'http://localhost/lab?view=bench',
    store: new Map([[STATE_KEY, JSON.stringify({ v: 1, runs: {}, runOrder: [], notepad: 7 })]]),
  });
  await bad.w.renderLabEntry();
  assert.ok(bad.w.LAB.stateError, 'refused');
  assert.equal(bad.w.CortexLab.getNotepad(), '', 'an empty workspace');
  bad.close();
});

test('BENCH-1 defaults: without LAB_FLAGS the activities, designer and report pages are off; the nav holds the intro and How this lab works; the result card and the bench objects do not point at them', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench', flags: null, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  assert.deepEqual(
    [...$$(w, '.lab-nav a')].map(a => text(a)),
    [`Watch the ${introSeconds()}-second intro`, 'How this lab works']
  );
  startRun(w);
  $(w, '#lab-run-all').click();
  assert.equal($(w, '#lab-result-design'), null, 'no designer link on the result');
  // MODE-FIX-integrate-3: Run all steps announces the run's final by-eye line before the result line
  if (w.SilverLab.LOOKS)
    assert.equal(
      text($(w, '#lab-live')),
      `All 9 steps done. ${w.SilverLab.LOOKS['gray-black'].text} The result is ready below.`
    );
  assert.deepEqual(
    [...$$(w, '.lab-result-links > .lab-disclosure > .lab-drawer-btn, .lab-result-links > button')].map(text),
    ['Why?', 'Compare with another run', 'Try it on the free bench', 'Look into the tissue']
  );
  h.close();
  for (const view of ['modules', 'module:M1', 'designer', 'notebook']) {
    const off = harness({ url: `http://localhost/lab?view=${view}`, flags: null });
    await off.w.renderLabEntry();
    assert.ok($(off.w, 'main.lab-view-notice'), `${view}: not available`);
    assert.equal($$(off.w, 'h1').length, 1);
    off.close();
  }
  // turned on, the pages render (the rest of this file relies on that)
  const on = harness({ url: 'http://localhost/lab?view=modules', flags: { activities: true } });
  await on.w.renderLabEntry();
  assert.ok($(on.w, 'main.lab-view-modules'));
  on.close();
});

test('BENCH-2 guess: the set-up asks what the student thinks will happen (optional); the words sit on the run and beside its result, and never reach the model', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  // MODE (§11.1): the guess field belongs to the free bench; the practice set-up has none
  assert.equal($(w, '#lab-newrun-guess'), null, 'no guess in practice');
  change(w, $(w, '#lab-bench-mode input[value="free"]'), true);
  const guess = $(w, '#lab-newrun-guess');
  assert.equal(guess.tagName, 'TEXTAREA');
  assert.match(text(guess.closest('label')), /What do you think will happen\?.*optional/);
  guess.value = '  The plaques go black first.  ';
  guess.dispatchEvent(new w.Event('input', { bubbles: true }));
  const run = startRun(w, { mode: 'free' });
  assert.equal(run.guess, 'The plaques go black first.');
  assert.equal(JSON.parse(h.store.get(STATE_KEY)).runs[run.id].guess, 'The plaques go black first.');
  assert.equal(run.events.filter(e => e.type === 'set-params').length, 0, 'a guess changes no setting');
  assert.equal(text($(w, '#lab-slide-now .lab-result-guess')), 'Your guess: The plaques go black first.');
  assert.equal($(w, '.lab-slide-summary'), null, 'a fresh slide: the look line alone (MODE-FIX-shell-25)');
  assert.ok(
    $(w, '.lab-result-guess').compareDocumentPosition($(w, '#lab-slide-now .lab-result-links')) & 4,
    'the guess sits above the card’s links'
  );
  change(w, $(w, '#lab-free-step'), 'deparaffinize-rehydrate');
  $(w, '#lab-free-dip').click();
  assert.ok($(w, '.lab-slide-summary'), 'the model summary once the slide has a step');
  assert.ok(
    $(w, '.lab-result-guess').compareDocumentPosition($(w, '.lab-slide-summary')) & 4,
    'the guess sits above the model summary'
  );
  // a run without a guess shows no line; a blank guess is not stored
  $(w, '#lab-setup-toggle').click();
  const second = startRun(w, { mode: 'free' });
  assert.equal(second.guess, undefined);
  assert.equal($(w, '.lab-result-guess'), null);
  h.close();
});

test('BENCH-3 read aloud: a checkbox in the 3D options speaks each clip caption once through speechSynthesis while on, stops when off or on leaving; disabled where no voice exists', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  const { w } = h;
  const spoken = [];
  let cancels = 0;
  w.SpeechSynthesisUtterance = function (text) {
    this.text = text;
  };
  w.speechSynthesis = { speak: u => spoken.push([u.text, u.lang]), cancel: () => cancels++ };
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  $(w, '[data-lab-drawer="3d-options"] .lab-drawer-btn').click();
  const box = $(w, '#lab-3d-read-aloud');
  assert.equal(box.checked, false);
  assert.equal(box.disabled, false);
  assert.match(text(box.closest('label')), /^Read the captions aloud$/);
  // off: a caption paints silently
  fake.api().onScene('brain-overview', 'A cartoon brain sits on the tray.', 0);
  assert.deepEqual(spoken, []);
  box.checked = true;
  box.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal(w.CortexLab.getState().settings.readAloud, true);
  assert.deepEqual(spoken, [['A cartoon brain sits on the tray.', 'en-US']], 'turning it on reads the current caption');
  fake.api().onScene('brain-overview', 'A cartoon brain sits on the tray.', 0);
  assert.equal(spoken.length, 1, 'a repaint of the same caption stays silent');
  fake.api().onScene('region', 'A patch of cortex lights up.', 1);
  assert.equal(spoken.length, 2);
  assert.equal(spoken[1][0], 'A patch of cortex lights up.');
  const before = cancels;
  box.checked = false;
  box.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal(w.CortexLab.getState().settings.readAloud, false);
  assert.ok(cancels > before, 'turning it off stops the voice');
  box.checked = true;
  box.dispatchEvent(new w.Event('change', { bubbles: true }));
  const leaving = cancels;
  w.pauseLabTools();
  assert.ok(cancels > leaving, 'leaving the lab stops the voice');
  await flush();
  h.close();
  // no voice on the device: the box is disabled and says so
  const mute = harness({
    url: 'http://localhost/lab?view=bench&mode=3d',
    benchModule: fakeBench().module,
    webgl2: true,
  });
  mute.w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await mute.w.renderLabEntry();
  $(mute.w, '[data-lab-drawer="3d-options"] .lab-drawer-btn').click();
  const off = $(mute.w, '#lab-3d-read-aloud');
  assert.equal(off.disabled, true);
  assert.match(text(off.closest('label')), /no voice on this device/);
  await flush();
  mute.close();
  // the text intro offers the same reading where a voice exists, and none without one
  const flat = harness({ url: 'http://localhost/lab?view=intro' });
  await flat.w.renderLabEntry();
  assert.equal($(flat.w, '#lab-intro-read'), null);
  flat.close();
  const intro = harness({ url: 'http://localhost/lab?view=intro' });
  const said = [];
  intro.w.SpeechSynthesisUtterance = function (text) {
    this.text = text;
  };
  intro.w.speechSynthesis = { speak: u => said.push(u.text), cancel: () => {} };
  await intro.w.renderLabEntry();
  const read = $(intro.w, '#lab-intro-read');
  assert.equal(text(read), 'Read it aloud');
  read.click();
  assert.equal(said.length, 1);
  assert.ok(said[0].length > 100, 'the whole intro in one reading');
  assert.equal(text(read), 'Stop reading');
  assert.equal(intro.w.CortexLab.getState().settings.readAloud, false, 'the bench setting is untouched');
  read.click();
  assert.equal(text(read), 'Read it aloud');
  intro.close();
});

test('MODE-1 Your slide: two mode cards (practice checked by default, remembered); the free bench shows the guess (SHELF: the Mix panel left it, its settings are the jars); a free run starts with the procedure’s settings; Try it on the free bench opens a free set-up on the run’s specimen', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  const fieldset = $(w, '#lab-bench-mode');
  assert.equal(text(fieldset.querySelector('legend')), 'How do you want to work?');
  const cards = $$(w, '#lab-bench-mode label.lab-mode-card');
  assert.deepEqual(
    cards.map(c => [
      c.querySelector('input').value,
      c.querySelector('input').checked,
      text(c.querySelector('strong')),
      text(c.querySelector('.lab-mode-text > span')),
    ]),
    [
      ['practice', true, 'Practice the procedure', 'Step by step, with the standard settings.'],
      ['free', false, 'Free bench', 'Any jar, any order, any mix. See what happens, even when nothing does.'],
    ]
  );
  assert.ok(fieldset.compareDocumentPosition($(w, '#lab-newrun-specimen')) & 4, 'the mode cards come first');
  assert.equal($(w, '#lab-mix'), null, 'practice: no settings UI');
  assert.equal($(w, '#lab-newrun-guess'), null);
  assert.equal($(w, '#lab-setup-mode'), null, 'the old Change one thing / Mix it up picker is gone');
  assert.equal($(w, '#lab-change-what'), null);
  assert.equal($(w, '[data-lab-drawer="all-settings"]'), null);
  assert.equal(w.CortexLab.getState().settings.benchMode, 'practice');
  change(w, cards[1].querySelector('input'), true);
  assert.equal(w.CortexLab.getState().settings.benchMode, 'free', 'the choice is remembered');
  assert.equal(JSON.parse(h.store.get(STATE_KEY)).settings.benchMode, 'free');
  // SHELF (§13.3): the Mix panel left the free bench (its settings are the jars' fields); the guess stays
  assert.equal($(w, '#lab-mix'), null, 'no Mix panel on the free bench');
  assert.equal($(w, '#lab-params'), null);
  assert.ok($(w, '#lab-newrun-guess'), 'the guess field, free bench only');
  assert.equal($(w, '#lab-param-pretreatment'), null, 'the pretreatment option left every settings UI (§11.7)');
  $(w, '#lab-newrun').dispatchEvent(submit(w));
  const state = w.CortexLab.getState();
  const run = state.runs[state.runOrder[0]];
  assert.equal(run.mode, 'free');
  assert.equal(run.events.filter(e => e.type === 'set-params').length, 0, 'no setting: the jars hold the mix');
  assert.equal($(w, '#lab-newrun'), null, 'the set-up collapses');
  assert.equal(text($(w, '.lab-setup-line')), 'Practice specimen A · high burden · Free bench · the procedure’s jars');
  assert.equal(text($(w, '#lab-do-h')), 'The bench');
  assert.equal(text($(w, '#lab-result-h')), 'Slide now');
  assert.ok($(w, '#lab-slide-now'), 'the Slide now card from the start');
  // a reload remembers the mode and reads the run's mode back; an older save without benchMode is practice
  const { store } = h;
  h.close();
  const again = harness({ url: 'http://localhost/lab?view=bench', store });
  await again.w.renderLabEntry();
  assert.equal(again.w.CortexLab.getState().settings.benchMode, 'free');
  assert.equal(again.w.CortexLab.getState().runs[run.id].mode, 'free');
  $(again.w, '#lab-setup-toggle').click();
  assert.equal($(again.w, '#lab-bench-mode input:checked').value, 'free', 'the card follows the remembered mode');
  again.close();
  const old = harness({
    url: 'http://localhost/lab?view=bench',
    store: new Map([[STATE_KEY, JSON.stringify({ v: 1, runs: {}, runOrder: [], settings: { hints: true } })]]),
  });
  assert.equal(old.w.CortexLab.getState().settings.benchMode, 'practice', 'an old save merges to practice');
  old.close();
  // Try it on the free bench (a practice result): a free set-up on the run's specimen, nothing else carried
  const p = harness({ url: 'http://localhost/lab?view=bench' });
  p.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await p.w.renderLabEntry();
  const first = startRun(p.w, { specimen: 'SPEC-SYN-NEG-01' });
  $(p.w, '#lab-run-all').click();
  const link = $(p.w, '#lab-mix-again');
  assert.equal(text(link), 'Try it on the free bench');
  link.click();
  assert.equal($(p.w, '#lab-bench-mode input[value="free"]').checked, true);
  assert.equal($(p.w, '[name="specimen"]:checked').value, 'SPEC-SYN-NEG-01');
  assert.equal($(p.w, '#lab-mix'), null);
  assert.equal(p.w.CortexLab.getState().settings.benchMode, 'free');
  assert.notEqual(first.mode, 'free');
  p.close();
});

test('UX-A safety gate: one compact card (three lines, notes behind a disclosure, one button); acknowledging stores an ISO timestamp, the card shrinks to one line, focus never drops (A1)', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  await w.renderLabEntry();
  const gate = $(w, '#lab-bench-body [data-lab-safety="open"]');
  assert.ok(gate, 'the bench opens with the gate');
  assert.equal($$(w, '[data-lab-safety]').length, 1, 'one card');
  assert.equal(text(gate.querySelector('h2')), 'Before you start');
  const lines = [...gate.querySelectorAll('.lab-safety-lines > li')].map(text);
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^Educational software, not qualification to perform hazardous procedures independently\.$/);
  assert.match(
    lines[1],
    /follow the course procedure\. Waste goes to the silver waste container the lab's EHS procedure names/
  );
  assert.doesNotMatch(text(gate), /pending|SOP\b|instructor/i, 'nothing waits on anyone (§11.7)');
  // each acronym is spelled out once on the gate (F11)
  assert.match(lines[1], /personal protective equipment \(PPE\).*safety data sheet \(SDS\)/);
  assert.match(lines[2], /the lab's own rules govern\.$/);
  assert.doesNotMatch(text(gate), /PENDING-EHS|\bS[1-8]\b/, 'no engine token or station id');
  assert.equal(gate.querySelectorAll('button').length, 2, 'the notes toggle and one action');
  const ack = $(w, '#lab-safety-ack');
  assert.equal(text(ack), 'I understand, open the bench');
  assert.ok(ack.classList.contains('btn-solid'));
  const all = w.LAB.lab.content.safety.items.filter(x => x.kind !== 'disclaimer');
  const toggle = gate.querySelector('.lab-drawer-btn');
  assert.equal(text(toggle), `Safety notes (${all.length})`);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  // every note keeps its full sentence; none carries a badge (§11.7: nothing is pending)
  const notes = [...gate.querySelectorAll('.lab-safety-notes > li')].map(li => [
    text(li),
    !!li.querySelector('.lab-badge'),
  ]);
  assert.deepEqual(
    notes,
    Array.from(all, x => [`${x.title}. ${x.text}`, false]),
    'every note keeps its full sentence; no badge'
  );
  ack.click();
  const state = w.CortexLab.getState();
  assert.match(state.safetyAcknowledgedAt, /^\d{4}-\d{2}-\d{2}T/);
  const saved = JSON.parse(h.store.get(STATE_KEY));
  assert.equal(saved.safetyAcknowledgedAt, state.safetyAcknowledgedAt);
  assert.equal(saved.v, 1);
  assert.equal(
    w.document.activeElement,
    $(w, '#lab-setup [name="specimen"]:checked'),
    'focus lands on the set-up (the chosen specimen)'
  );
  assert.match(text($(w, '#lab-live')), /Safety notes acknowledged/);
  const line = $(w, '[data-lab-safety="acknowledged"]');
  assert.ok(line, 'one "Safety notes" link stays on the bench');
  assert.ok(line.closest('#lab-bench-head .lab-bench-head'), 'in the bench header (UX-B)');
  const again = line.querySelector('.lab-drawer-btn');
  assert.equal(text(again), 'Safety notes');
  assert.equal(line.querySelector('.lab-ack'), null, 'the date and the notes wait behind the link');
  again.click();
  assert.match(text(line.querySelector('.lab-ack')), /^Safety notes acknowledged on .+\.$/);
  assert.equal(line.querySelectorAll('.lab-safety-notes > li').length, all.length);
  const reset = $(w, '#lab-safety-reset');
  assert.equal(text(reset), 'Review again');
  reset.focus();
  reset.click();
  assert.equal(w.CortexLab.getState().safetyAcknowledgedAt, null);
  assert.equal(JSON.parse(h.store.get(STATE_KEY)).safetyAcknowledgedAt, null);
  assert.ok($(w, '[data-lab-safety="open"]'), 'the card is back');
  assert.equal(w.document.activeElement.id, 'lab-safety-ack', 'and focus is on its button');
  h.close();
  // inside an activity the same card continues the activity instead of naming the bench
  const m = harness({ url: 'http://localhost/lab?view=module:M2' });
  await m.w.renderLabEntry();
  assert.equal(text($(m.w, '#lab-safety-ack')), 'I understand, continue');
  m.close();
});

const WORDS = {
  standard: 'standard (per procedure)',
  changed: 'changed',
  notSet: 'not set',
  simulated: 'Simulated · not a measurement',
  simulatedLong: 'Illustrative simulation from a teaching model, not a measurement.',
  notModeled: 'Not modeled',
  notModeledLong: 'The model has no rule for this change, so it shows no picture.',
  referenceNone: 'Real slide', // §12.4 (REF-shell): the badge kind keeps its name; its words are the real photo's
  inProgress: 'Steps still to do',
  modelScale: 'model scale',
  scaleLegend: 'Model scale: none · trace · low · moderate · high (positions, not amounts)',
  keepInMind: 'Keep in mind',
  why: 'Why?',
  sources: 'Sources',
  boundSilver: 'bound silver',
  nuclei: 'silver nuclei',
  visibleSilver: 'visible silver',
  practiceSpecimen: 'practice specimen (not real tissue)',
  outOfOrder: 'Done out of order',
  howItWorks: 'How this lab works',
};
const BADGE_KINDS = ['simulated', 'not-modeled', 'reference-none', 'in-progress'];
// Resolves a run of `method` on `specimenId` with `steps` performed in procedure order (all nine by default).
function resolveRun(w, specimenId, { params = {}, method = 'bielschowsky-modified', steps = null } = {}) {
  const lab = w.LAB.lab;
  let run = lab.createRun({ id: 'run-t', specimenId, method, params });
  if (method === 'bielschowsky-modified')
    (steps || Array.from(w.SilverLab.STEPS)).forEach((step, i) => {
      run = lab.applyEvent(run, { seq: i + 1, type: 'step', step });
    });
  return lab.resolve(run);
}

test('UX-A CortexLab.words / badge / badgeForOutcome / level: exact strings, one markup, the engine label kept', async () => {
  const h = harness();
  await h.w.renderLabEntry();
  const { w } = h;
  const C = w.CortexLab;
  assert.deepEqual({ ...C.words }, WORDS);
  assert.ok(Object.isFrozen(C.words));
  const short = {
    simulated: WORDS.simulated,
    'not-modeled': WORDS.notModeled,
    'reference-none': WORDS.referenceNone,
    'in-progress': WORDS.inProgress,
  };
  for (const kind of BADGE_KINDS) {
    const node = w.el(C.badge(kind));
    assert.equal(node.tagName, 'SPAN');
    assert.equal(node.className, `lab-badge lab-badge-${kind}`);
    assert.equal(node.dataset.labBadge, kind);
    assert.equal(node.hasAttribute('data-lab-label'), false, 'no engine label unless one is passed');
    assert.equal(text(node.querySelector('.lab-badge-text')), short[kind], 'short visible text');
    const long = node.querySelector('.lab-sr-only');
    assert.ok(long && long.textContent.startsWith(' ') && text(long).length > short[kind].length, 'long text for AT');
  }
  assert.equal(text(w.el(C.badge('simulated')).querySelector('.lab-sr-only')), WORDS.simulatedLong);
  assert.equal(text(w.el(C.badge('not-modeled')).querySelector('.lab-sr-only')), WORDS.notModeledLong);
  assert.equal(
    text(w.el(C.badge('reference-none')).querySelector('.lab-sr-only')),
    'A real photomicrograph from an open-access study, shown when one matches the run; credited under the picture.',
    'REF-shell: the Real slide badge; MODE-FIX-docs-1: never "in this build"'
  );
  assert.equal(
    w.el(C.badge('simulated', { label: 'illustrative-synthetic' })).dataset.labLabel,
    'illustrative-synthetic'
  );
  const hostile = w.el(`<div>${C.badge('simulated', { label: '"><img src=x>' })}</div>`);
  assert.equal(hostile.querySelector('img'), null, 'the label is escaped');
  assert.equal(hostile.firstElementChild.dataset.labLabel, '"><img src=x>');
  assert.throws(() => C.badge('validated'), /Unknown lab badge kind/);
  // badgeForOutcome: Simulated for an outcome, Steps still to do for a run missing steps, Not modeled otherwise
  const outcome = w.el(C.badgeForOutcome(resolveRun(w, 'SPEC-SYN-AD-01')));
  assert.deepEqual([outcome.dataset.labBadge, outcome.dataset.labLabel], ['simulated', 'illustrative-synthetic']);
  const progress = w.el(C.badgeForOutcome(resolveRun(w, 'SPEC-SYN-AD-01', { steps: ['deparaffinize-rehydrate'] })));
  assert.deepEqual([progress.dataset.labBadge, progress.dataset.labLabel], ['in-progress', 'no-basis']);
  const uncovered = w.el(
    C.badgeForOutcome(resolveRun(w, 'SPEC-SYN-AD-01', { params: { washes: { condition: 'deviated' } } }))
  );
  assert.deepEqual([uncovered.dataset.labBadge, uncovered.dataset.labLabel], ['not-modeled', 'no-basis']);
  // level: the ordinal word, never a bare digit
  assert.deepEqual([0, 1, 2, 3, 4].map(C.level), Array.from(w.SilverLab.ORDINAL_TEXT));
  assert.equal(C.level(null), 'not modeled');
  assert.equal(C.level(2.6), 'moderate');
  assert.equal(C.level(9), 'high');
  assert.equal(C.level(-1), 'none');
  h.close();
});

test('UX-A CortexLab.summarize: plain ordinal words only (the contract example), a run in progress, uncovered changes, no forbidden word anywhere', async () => {
  const h = harness();
  await h.w.renderLabEntry();
  const { w } = h;
  const sum = (result, specimenId = result.specimenId) =>
    w.CortexLab.summarize(result, w.LAB.lab.getSpecimen(specimenId));
  // HON-4 / KB-04: "is at" and a semicolon; never "stays at ..., so contrast is" (no cause, no "stays")
  assert.equal(
    sum(resolveRun(w, 'SPEC-SYN-AD-01')),
    'Plaque cores, plaque neurites, tangles and axons show moderate visible silver; neuropil threads show low. The background is at trace; contrast is low.'
  );
  assert.equal(
    sum(resolveRun(w, 'SPEC-SYN-NEG-01')),
    'Axons show moderate visible silver; plaque cores, plaque neurites, tangles and neuropil threads show none. The background is at trace; contrast is low.'
  );
  assert.equal(
    sum(resolveRun(w, 'SPEC-SYN-LOWCHEM-01')),
    'Plaque cores, plaque neurites, tangles, axons and neuropil threads show trace visible silver. The background is at trace; contrast is none.'
  );
  // F3 / KB-05: a background the assumption rule raised (R-model-04, no source for this stain) says so
  // in the first view; CortexLab.assumptionNote gives the same clause to the report and designer cards
  for (const params of [{ development: { endpoint: 'extended' } }, { development: { strength: 'strong' } }]) {
    const raised = resolveRun(w, 'SPEC-SYN-AD-01', { params });
    assert.match(
      sum(raised),
      /\. The background is at low \(raised by a model assumption with no source for this stain\); contrast is [a-z]+\.$/
    );
    assert.equal(w.CortexLab.assumptionNote(raised), 'raised by a model assumption with no source for this stain');
  }
  assert.equal(w.CortexLab.assumptionNote(resolveRun(w, 'SPEC-SYN-AD-01')), '', 'the base background carries none');
  assert.equal(w.CortexLab.assumptionNote(resolveRun(w, 'SPEC-SYN-AD-01', { method: 'cps-i' })), '');
  // an all-none outcome reads "no visible silver", never "none visible silver"
  const blank = { label: 'illustrative-synthetic', perSite: {}, background: 0, contrast: 0 };
  for (const site of w.SilverLab.SITE_CLASSES) blank.perSite[site] = { visibility: 0 };
  assert.match(w.CortexLab.summarize(blank), /^Plaque cores, .* show no visible silver\. /);
  // HON-5 / K4: list mode and the microscope draw no picture for an unfinished run
  assert.equal(
    sum(resolveRun(w, 'SPEC-SYN-AD-01', { steps: ['deparaffinize-rehydrate', 'silver-impregnation'] })),
    'Steps still to do: 2 of 9 done. The picture comes once every step is done.'
  );
  assert.equal(
    sum(resolveRun(w, 'SPEC-SYN-AD-01', { steps: [] })),
    'Steps still to do: 0 of 9 done. The picture comes once every step is done.'
  );
  // CC-14: a damaged save never shows the raw specimen or method id
  assert.equal(
    sum(resolveRun(w, 'SPEC-GONE-99')),
    "Not modeled: this run's specimen is not in the lab any more, so the model has nothing to stain."
  );
  assert.equal(
    sum(resolveRun(w, 'SPEC-SYN-AD-01', { method: 'no-such-method' })),
    'Not modeled: this run names a method the lab does not know, so the model has no rules for it.'
  );
  const uncovered = resolveRun(w, 'SPEC-SYN-AD-01', { params: { washes: { condition: 'deviated' } } });
  // UX-B: the card's first sentence with the parameter in plain words, never the engine path or value
  assert.equal(
    sum(uncovered),
    'Not modeled: No sourced rule covers this change (washes: changed); the model cannot say what this change does.'
  );
  for (const params of [
    { development: { strength: 'unspecified' } },
    { ammoniacal: { endpoint: 'early' } },
    { impregnation: { condition: 'deviated' } },
  ]) {
    const line = sum(resolveRun(w, 'SPEC-SYN-AD-01', { params }));
    assert.match(
      line,
      /^Not modeled: No sourced rule covers this change \([a-z ,]+: (shorter|changed|not set)\); /,
      line
    );
    assert.doesNotMatch(line, /\b[a-z]+\.[a-z]+\b|deviated|unspecified|sop-default/, line);
  }
  // the hypothesis-unencoded card says "predicts": the summary falls back to the plain long form
  const probe = resolveRun(w, 'SPEC-SYN-AD-01', { params: { pretreatment: 'probe-placeholder-1' } });
  assert.equal(probe.code, 'hypothesis-unencoded');
  assert.equal(sum(probe), `Not modeled: ${WORDS.notModeledLong}`);
  // every specimen, every method, every card: no forbidden word, no hypothesis, no digit outside a step count
  const all = [uncovered, probe];
  for (const specimen of w.LAB.lab.listSpecimens())
    for (const method of ['bielschowsky-modified', 'cps-i', 'cps-ii']) all.push(resolveRun(w, specimen.id, { method }));
  for (const result of all) {
    const line = sum(result);
    assert.ok(line.length > 20, line);
    assert.doesNotMatch(line, /\b(results?|data|measured|predicts?)\b/i, line);
    assert.doesNotMatch(line, /Hypothesis|H-[a-z]/, line);
    if (result.label === 'illustrative-synthetic') {
      assert.doesNotMatch(line, /\d/, line);
      assert.equal(line.split('. ').length, 2, `two sentences: ${line}`);
    }
  }
  assert.equal(w.CortexLab.summarize(null), '');
  h.close();
});

test('UX-A ?view=about: How this lab works in four short sections (at most 350 words), every badge once, the reserved label only here, every safety note pending', async () => {
  const h = harness({ url: 'http://localhost/lab?view=about' });
  await h.w.renderLabEntry();
  const { w } = h;
  assert.equal($$(w, 'h1').length, 1);
  assert.equal(text($(w, 'h1')), 'How this lab works');
  assert.deepEqual($$(w, 'main h2').map(text), ['What this is', 'What the labels mean', 'Safety notes']);
  assert.doesNotMatch(text($(w, 'main')), /pending|instructor|SOP\b/i, 'nothing waits on anyone (§11.7)');
  // MODE-FIX-docs-1 / MODE-FIX-integrate-5: release-note words stay out of the student's sentences
  assert.doesNotMatch(text($(w, 'main')), / card |in this build/, 'no "card" or "build" (§11.8)');
  assert.match(text($(w, '.lab-about-labels')), /The note says what would be needed\./);
  // REF-shell (§12.4): the Real slide row says where the photos come from, when they show and whose they are
  assert.match(
    text($(w, '.lab-about-labels')),
    /Real slide .*Real slides from open-access studies appear in the microscope when one matches the run, credited under each; it is never your run\./
  );
  assert.doesNotMatch(text($(w, 'main')), /rights-cleared|none yet|Reference image/);
  assert.match(
    text($(w, '#lab-about-what-h + p')),
    /Finished runs can be compared with real slides from open-access studies, credited under each\./
  );
  assert.doesNotMatch(text($(w, 'main')), /\bv1\b|schematic|then\b|pending/i);
  // visible words: visually hidden text and closed <details> bodies do not count
  const clone = $(w, 'main').cloneNode(true);
  clone.querySelectorAll('.lab-sr-only').forEach(node => node.remove());
  clone
    .querySelectorAll('details')
    .forEach(d => [...d.children].filter(c => c.tagName !== 'SUMMARY').forEach(c => c.remove()));
  const words = clone.textContent.split(/\s+/).filter(word => /[A-Za-z0-9]/.test(word)).length;
  assert.ok(words <= 350, `${words} visible words`);
  const labels = $(w, '.lab-about-labels');
  assert.deepEqual(
    [...labels.querySelectorAll('dt [data-lab-badge]')].map(b => b.dataset.labBadge),
    ['simulated', 'not-modeled', 'in-progress', 'reference-none']
  );
  const reserved = $$(w, '[data-lab-label="validated-prediction"]');
  assert.equal(reserved.length, 1);
  assert.equal(text(reserved[0]), w.SilverLab.LABEL_TEXT['validated-prediction']);
  const dd = text(reserved[0].closest('div').querySelector('dd'));
  assert.match(dd, /no output has earned it/);
  assert.match(dd, /held-out validation by specimen or run/);
  assert.match(text($(w, 'main')), /Darker does not mean more protein, more pathology or a better method\./);
  // safety notes: the disclaimer line, then every note as a title that opens its full sentence
  const safety = $(w, '#lab-about-safety');
  const all = w.LAB.lab.content.safety.items.filter(x => x.kind !== 'disclaimer');
  assert.match(
    text(safety),
    new RegExp(
      `The ${all.length} notes below follow the course procedure; waste goes to the silver waste container the lab's EHS procedure names, and every reagent's safety data sheet is read before the first run\\.`
    )
  );
  assert.match(text(safety), /^Safety notes Educational software, not qualification/);
  const items = [...safety.querySelectorAll('.lab-safety-notes details')];
  assert.deepEqual(
    items.map(d => [text(d.querySelector('summary')), !!d.querySelector('.lab-badge')]),
    Array.from(all, x => [x.title, false]),
    'every note behind its title; no badge'
  );
  assert.deepEqual(
    items.map(d => text(d.querySelector('p'))),
    Array.from(all, x => x.text)
  );
  assert.doesNotMatch(text($(w, 'main')), ENGINE_TOKENS);
  assert.equal(viewOf($(w, '.lab-endbtns a')), null, 'back to the lab home');
  h.close();
});

test('UX-A ?view=modules: a grid of seven activity cards ("Activity N", one link each), checklist wording, one honesty line', async () => {
  const h = harness({ url: 'http://localhost/lab?view=modules' });
  const { w } = h;
  w.CortexLab.getState().moduleProgress.M2 = { fields: { reflection: 'written' }, done: true };
  await w.renderLabEntry();
  assert.equal(text($(w, 'h1')), 'Weekly activities');
  const cards = $$(w, '.lab-module-grid > li.lab-module-card');
  assert.equal(cards.length, 7);
  assert.deepEqual(
    cards.map(c => text(c.querySelector('.label'))),
    MODULE_IDS.map((id, i) => `Activity ${i + 1}`)
  );
  cards.forEach((card, i) => {
    const links = card.querySelectorAll('a');
    assert.equal(links.length, 1);
    assert.equal(links[0].closest('h2'), card.querySelector('h2'), 'the title is the link');
    assert.equal(text(links[0]), w.LAB.lab.getModule(MODULE_IDS[i]).title);
    assert.equal(viewOf(links[0]), `module:${MODULE_IDS[i]}`);
    assert.equal(
      card.hasAttribute('aria-label') || links[0].hasAttribute('aria-label'),
      false,
      'visible text names it'
    );
  });
  assert.equal(text(cards[0].querySelector('.lab-module-status')), '0 of 1 required answer written');
  assert.ok(cards[1].classList.contains('lab-module-done'));
  assert.equal(text(cards[1].querySelector('.lab-module-status')), '✓ Checklist complete (not graded)');
  assert.equal($$(w, '.lab-honesty').length, 1);
  assert.doesNotMatch(text($(w, 'main')), ENGINE_TOKENS);
  h.close();
});

test('?view= routes every registered view to one main with one h1; unknown views get the notice', async () => {
  const cases = [
    ['home', 'lab-view-home', /Alzheimer's Histology Lab/],
    ['about', 'lab-view-about', /^How this lab works$/],
    ['bench', 'lab-view-bench', /^Bench$/],
    ['modules', 'lab-view-modules', /^Weekly activities$/],
    ['module:M3', 'lab-view-module', /^Time courses$/],
    ['microscope', 'lab-view-microscope', /^Microscope$/],
    ['notebook', 'lab-view-notebook', /^My report$/],
    ['designer', 'lab-view-designer', /^Design your experiment$/],
    ['nonsense', 'lab-view-notice', /not available/],
  ];
  for (const [view, cls, heading] of cases) {
    const h = harness({ url: `http://localhost/lab?view=${encodeURIComponent(view)}` });
    await h.w.renderLabEntry();
    assert.equal($$(h.w, 'h1').length, 1, view);
    assert.ok($(h.w, `main.${cls}`), `${view} -> ${cls}`);
    assert.match(text($(h.w, 'h1')), heading, view);
    h.close();
  }
  const alt = harness({ url: 'http://localhost/lab?view=module&unit=M5' });
  await alt.w.renderLabEntry();
  assert.match(text($(alt.w, 'h1')), /^Controls$/);
  assert.match(text($(alt.w, 'main > .label')), /Activity 5 of 7$/, 'F10: activity, not week; no module id');
  alt.close();
});

test('M1: leaving the section while the content downloads (or being elsewhere) paints nothing', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const pending = h.w.renderLabEntry(); // awaits the data fetch
  h.w.pauseLabTools(); // openSection('mcat') does this on the way out
  await pending;
  assert.equal($(h.w, 'main.lab-page'), null, 'the cancelled render painted nothing');
  assert.ok(h.w.LAB.loaded, 'the download itself still completed and is cached');
  h.w.sectionFromPath = () => 'mcat';
  await h.w.renderLabEntry();
  assert.equal($(h.w, 'main.lab-page'), null, 'another section owns the page');
  h.w.sectionFromPath = () => 'lab';
  await h.w.renderLabEntry();
  assert.ok($(h.w, 'main.lab-view-bench'), 'back on /lab the view renders');
  h.close();
});

// UX-B (contract §8.3; PLAN-ALZ-LAB-SIMPLIFY §3.3): the bench in three parts.
const CHANGE_OPTIONS = [
  'Nothing (standard, per procedure)',
  'Impregnation time',
  'Impregnation temperature',
  'Development time',
  'Developer strength',
  'Washes',
  'Toning and thiosulfate',
];
// Engine words a student never reads on the bench outside Why? / Sources / History / All settings.
const BENCH_TOKENS = new RegExp(
  `${ENGINE_TOKENS.source}|\\b(?:impregnation|development|washes|ammoniacal)\\.[a-z]+|\\bdeviated\\b|\\bunspecified\\b|step-skipped|param-uncovered|\\bordinal`
);
// The visible bench text without the parts that may show engine words.
function benchText(w) {
  const clone = $(w, 'main').cloneNode(true);
  clone
    .querySelectorAll(
      '[data-lab-why], #lab-history, .lab-all-settings, .lab-sources-disclosure, #lab-sheet, .lab-sr-only'
    )
    .forEach(node => node.remove());
  return text(clone);
}
const change = (w, node, value) => {
  if (node.type === 'radio' || node.type === 'checkbox') node.checked = value;
  else node.value = value;
  node.dispatchEvent(new w.Event('change', { bubbles: true }));
};
// Starts a practice run from an open set-up (MODE §11.1: the practice card, the specimen, Start). `what` /
// `value` name a change the way the old one-change picker did; the practice set-up has no settings UI,
// so the change is applied as the one set-params event that picker used to send (the engine and every
// downstream surface see the same run). `mode: 'free'` starts a free run instead (the same way: SHELF, the
// Mix panel left the free bench).
const CHANGE_PATHS = {
  'impregnation-time': ['impregnation.endpoint', 'early'],
  'impregnation-temperature': ['impregnation.temperature', 'deviated'],
  'development-time': ['development.endpoint', 'early'],
  'developer-strength': ['development.strength', 'weak'],
  washes: ['washes.condition', 'deviated'],
};
function changePatch(what, value) {
  if (what === 'toning-thiosulfate') return value && value !== 'none' ? { [value]: false } : {};
  const [path, first] = CHANGE_PATHS[what];
  const v = value === null ? first : value;
  const patch = {};
  const [group, leaf] = path.split('.');
  patch[group] = { [leaf]: v };
  return patch;
}
function startRun(w, { specimen = null, what = null, value = null, mode = 'practice', guess = null } = {}) {
  if (!$(w, '#lab-newrun')) $(w, '#lab-setup-toggle').click();
  if ($(w, '#lab-bench-mode input:checked').value !== mode)
    change(w, $(w, `#lab-bench-mode input[value="${mode}"]`), true);
  if (specimen) change(w, $(w, `[data-lab-specimen="${specimen}"]`), true);
  if (guess !== null) {
    $(w, '#lab-newrun-guess').value = guess;
    $(w, '#lab-newrun-guess').dispatchEvent(new w.Event('input', { bubbles: true }));
  }
  $(w, '#lab-newrun').dispatchEvent(submit(w));
  const state = w.CortexLab.getState();
  const id = state.runOrder[state.runOrder.length - 1];
  // SHELF (§13.3): neither set-up has a settings UI now (the free bench's Mix panel left it), so a change is
  // the one set-params event the old pickers sent, in either mode.
  if (what) {
    const patch = changePatch(what, value);
    if (Object.keys(patch).length) {
      w.CortexLab.applyEvent(id, { type: 'set-params', params: patch });
      // UX-LAST: a run that matches a sealed run is sealed with it (and one sealed at Start, before the
      // change, only while it still matches)
      delete w.CortexLab.getState().sealed[id];
      w.labSealTwin(id);
      w.CortexLab.save();
      // the bench redraws from the run: History's run select (always in the DOM) asks for a refresh
      change(w, $(w, '#lab-run-select'), id);
    }
  }
  return w.CortexLab.getState().runs[id];
}

test('UX-B bench: gate, then 1. Set up (four specimen cards, one change), 2. Do this step in procedure order, 3. one result card', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  await w.renderLabEntry();
  assert.ok($(w, '#lab-bench-body [data-lab-safety="open"]'), 'the bench opens with the gate');
  assert.equal($(w, '#lab-setup'), null, 'nothing else before the gate');
  assert.equal($(w, '#lab-bench-head').children.length, 0);
  $(w, '#lab-safety-ack').click();
  // header: specimen chip, the Run menu (Safety notes; New run and History once a run exists) and ONE
  // view toggle naming the view it switches to (UX-R2)
  assert.equal(text($(w, '#lab-specimen-chip')), 'Practice specimen A · high burden');
  assert.equal($(w, '#lab-run-name'), null);
  assert.equal($(w, '#lab-history-toggle'), null, 'no History before the first run');
  assert.ok($(w, '#lab-bench-head #lab-run-menu [data-lab-safety="acknowledged"]'));
  assert.equal($(w, '#lab-run-menu-btn').getAttribute('aria-expanded'), 'false');
  assert.ok($(w, '#lab-run-menu').hidden, 'the Run menu starts closed');
  assert.deepEqual(
    $$(w, '#lab-bench-head [data-lab-mode]').map(b => [
      b.id,
      b.dataset.labMode,
      text(b),
      b.getAttribute('aria-pressed'),
    ]),
    [['lab-mode-toggle', '3d', 'Switch to 3D', null]]
  );
  // Your slide is open: the mode cards, four specimen cards from studentLabel / studentNote, Start
  assert.equal($(w, '#lab-setup').dataset.labSetup, 'open');
  assert.equal(text($(w, '#lab-setup-h')), 'Your slide');
  const specimens = w.LAB.lab.listSpecimens();
  const cards = $$(w, '#lab-newrun-specimen .lab-specimen-card');
  assert.equal(cards.length, 4);
  cards.forEach((card, i) => {
    assert.equal(text(card.querySelector('strong')), specimens[i].studentLabel);
    assert.equal(text(card.querySelector('.lab-specimen-text > span')), specimens[i].studentNote);
    const radio = card.querySelector('input[type="radio"]');
    assert.equal(radio.dataset.labSpecimen, specimens[i].id);
    assert.equal(radio.checked, i === 0);
  });
  // §11.7: the specimen cards say what they are; nothing on the bench claims the real slide's facts
  assert.equal($(w, '#lab-specimen-pending'), null);
  assert.doesNotMatch(text($(w, '#lab-setup')), /pending|instructor/i);
  assert.equal($(w, '#lab-bench-mode input:checked').value, 'practice');
  assert.equal($(w, '#lab-mix'), null, 'practice: no settings UI');
  assert.equal(text($(w, '#lab-newrun-create')), 'Start the run');
  // The procedure and Result before a run: the nine steps in list mode, no primary action, the result waits
  assert.equal(text($(w, '#lab-do-h')), 'The procedure');
  assert.deepEqual(
    $$(w, '.lab-step').map(s => s.dataset.labStep),
    Array.from(w.SilverLab.STEPS)
  );
  assert.equal($(w, '#lab-do-step'), null);
  assert.ok($(w, '#lab-3d-norun'));
  assert.equal(text($(w, '#lab-result-h')), 'Result');
  assert.match(text($(w, '#lab-resolve-out')), /Your result appears here/);
  assert.doesNotMatch(benchText(w), BENCH_TOKENS, 'no engine word on the first view');
  // a run on specimen B: the chip follows the card; standard needs no set-params event
  change(w, $(w, '[data-lab-specimen="SPEC-SYN-AD-02"]'), true);
  assert.equal(text($(w, '#lab-specimen-chip')), 'Practice specimen B · low burden');
  $(w, '#lab-newrun').dispatchEvent(submit(w));
  const state = w.CortexLab.getState();
  assert.deepEqual(Array.from(state.runOrder), ['run-1']);
  const run = () => state.runs['run-1'];
  assert.equal(run().specimenId, 'SPEC-SYN-AD-02');
  assert.equal(run().events.length, 0, 'the standard protocol records no set-params event');
  assert.equal(w.document.activeElement.id, 'lab-do-step', 'focus lands on the primary action');
  assert.match(
    text($(w, '#lab-live')),
    /^Run 1 started on Practice specimen B · low burden: Practice the procedure\.$/
  );
  assert.equal($(w, '#lab-setup').dataset.labSetup, 'collapsed');
  assert.equal($(w, '#lab-newrun'), null, 'set-up collapses to one line');
  assert.equal(text($(w, '.lab-setup-line')), 'Practice specimen B · low burden · Practice the procedure');
  assert.equal(text($(w, '#lab-setup-toggle')), 'New run');
  assert.equal(text($(w, '#lab-run-name')), 'Run 1');
  assert.ok($(w, '#lab-history-toggle'), 'History once a run exists');
  // GAME-shell: "Show hints" (label#lab-hints-row around input#lab-hints-toggle) is the menu's last item
  assert.deepEqual(
    [...$(w, '#lab-run-menu').children].map(n => n.id || n.dataset.labSafety),
    ['lab-setup-toggle', 'lab-history-toggle', 'acknowledged', 'lab-hints-row'],
    'New run, History, Safety notes and Show hints sit in the Run menu'
  );
  assert.equal($(w, '#lab-setup .lab-part-head #lab-setup-toggle'), null, 'not on the set-up line');
  // Do this step: always the first step not yet done, in procedure order, one event each
  const steps = [...w.LAB.lab.getMethod('bielschowsky-modified').steps].sort((a, b) => a.order - b.order);
  steps.forEach((step, i) => {
    assert.equal(text($(w, '#lab-do-count')), `${i} of 9 done`);
    assert.equal($(w, '#lab-do-progress').getAttribute('value'), String(i));
    assert.equal(text($(w, '#lab-do-step')), `Do this step: ${step.studentTitle}`);
    assert.equal(text($(w, '#lab-run-all')), i ? 'Run the rest' : 'Run all steps');
    assert.equal($(w, '.lab-step[aria-current="step"]').dataset.labStep, step.id);
    if (i < 8) {
      $(w, '#lab-do-step').click();
      assert.equal(run().events.at(-1).step, step.id);
      assert.equal(run().events.at(-1).seq, i + 1);
      assert.equal(w.document.activeElement.id, 'lab-do-step', 'focus stays on the primary action');
      assert.ok($(w, `.lab-step[data-lab-step="${step.id}"]`).classList.contains('lab-step-done'));
    }
    if (i === 3)
      assert.match(
        text($(w, '#lab-live')),
        /^Ammoniacal silver bath done\.( [^.]+\.)* 4 of 9 steps done\. Next: Ammonia rinse\.$/
      );
    // a run in progress shows its in-progress card (no Compare yet)
    if (i === 4) {
      const card = $(w, '#lab-resolve-out .lab-result-card');
      assert.equal(card.dataset.labCard, 'step-skipped');
      assert.equal(card.querySelector('.lab-badge').dataset.labBadge, 'in-progress');
      assert.equal(
        text(card.querySelector('.lab-result-summary')),
        'Steps still to do: 5 of 9 done. The picture comes once every step is done.'
      );
      assert.equal($(w, '#lab-compare-open'), null);
      assert.equal($(w, '#lab-scope-btn'), null, 'no picture for a run in progress');
      assert.equal(card.querySelector('.lab-look'), null, 'no by-eye line on a card with no picture');
    }
  });
  $(w, '#lab-do-step').click();
  assert.deepEqual(
    Array.from(run().events.map(e => e.step)),
    steps.map(s => s.id)
  );
  assert.deepEqual(Array.from(run().deviations), []);
  assert.equal($(w, '#lab-do-step'), null, 'the primary action leaves once every step is done');
  assert.equal($(w, '#lab-run-all'), null);
  assert.equal(text($(w, '#lab-do-count')), '9 of 9 done');
  assert.match(text($(w, '#lab-do-status')), /All steps done: the result is below\./);
  assert.match(text($(w, '#lab-live')), /The result is ready below\.$/);
  // 3. Result: one card, its badge (engine label kept), the summary, three links; focus on its badge
  const card = $(w, '#lab-resolve-out .lab-result-card');
  assert.equal(w.document.activeElement, card.querySelector('.lab-banner'));
  const result = w.LAB.lab.resolve(run());
  assert.equal(card.dataset.labResult, 'illustrative-synthetic');
  assert.equal(card.dataset.labOutcome, 'run-1');
  const badge = card.querySelector('.lab-banner .lab-badge');
  assert.deepEqual([badge.dataset.labBadge, badge.dataset.labLabel], ['simulated', 'illustrative-synthetic']);
  assert.equal($$(w, '#lab-resolve-out .lab-badge[data-lab-label]').length, 1, 'one labeled badge on the output');
  assert.equal(text(card.querySelector('.lab-result-summary')), w.CortexLab.summarize(result));
  assert.equal(
    text(card.querySelector('.lab-result-summary')),
    'Axons show moderate visible silver; plaque cores, plaque neurites and tangles show low; neuropil threads show trace. The background is at trace; contrast is low.'
  );
  // MODE-FIX-integrate-2: the procedure's by-eye line sits under the summary (gray-black: gold toned)
  if (w.SilverLab.LOOKS) {
    const lookP = card.querySelector('.lab-result-text .lab-look');
    assert.ok(lookP, 'the by-eye line on the result card');
    assert.equal(text(lookP.querySelector('.lab-look-text')), `By eye: ${w.SilverLab.LOOKS['gray-black'].text}`);
    assert.equal(lookP.querySelector('.lab-look-swatch').dataset.labLook, 'gray-black');
    assert.equal(lookP.querySelector('.lab-look-swatch').style.background.length > 0, true, 'the swatch is painted');
    assert.ok(
      card.querySelector('.lab-result-summary').compareDocumentPosition(lookP) & 4,
      'the look line follows the summary'
    );
  }
  // the thumbnail is a disclosure of the inline microscope (A11Y-15): aria-expanded, never aria-pressed
  const thumbBtn = $(w, '#lab-scope-btn');
  assert.equal(text(thumbBtn), 'Open in the microscope');
  assert.deepEqual(
    [
      thumbBtn.getAttribute('aria-expanded'),
      thumbBtn.getAttribute('aria-controls'),
      thumbBtn.hasAttribute('aria-pressed'),
    ],
    ['false', 'lab-scope-inline', false]
  );
  assert.deepEqual(
    [...card.querySelectorAll('.lab-result-links > .lab-disclosure > .lab-drawer-btn, .lab-result-links > button')].map(
      text
    ),
    ['Why?', 'Compare with another run', 'Try it on the free bench', 'Look into the tissue']
  );
  // the designer is one link away from a result (F4, KB-06)
  const design = card.querySelector('.lab-result-links > a#lab-result-design');
  assert.equal(text(design), 'Design your experiment');
  assert.equal(viewOf(design), 'designer');
  assert.ok(card.querySelector('[data-lab-why="result"]'));
  assert.equal($(w, '#lab-resolve-out').getAttribute('role'), 'region');
  assert.equal($(w, '#lab-resolve-out').hasAttribute('aria-live'), false, 'the long output is not live');
  // Why?: the per-site table in words with the scale legend, the rules by plain title, Keep in mind, Sources
  card.querySelector('[data-lab-why="result"] .lab-drawer-btn').click();
  const why = card.querySelector('[data-lab-why="result"] .lab-why-body');
  assert.equal(text(why.querySelector('.lab-scale')), w.CortexLab.words.scaleLegend);
  const head = [...why.querySelectorAll('thead th')].map(text);
  assert.deepEqual(head, ['Structure', 'Visible silver visibility', 'Bound silver ionicBound', 'Silver nuclei nuclei']);
  const rows = [...why.querySelectorAll('tbody tr')];
  assert.equal(rows.length, 6, 'five structures and the background');
  for (const row of rows)
    for (const cell of row.querySelectorAll('td')) assert.ok(w.SilverLab.ORDINAL_TEXT.includes(text(cell)), text(cell));
  const headings = [...why.querySelectorAll('h3')].map(text);
  assert.deepEqual(headings, ['Why the model did this', 'Keep in mind']);
  const rules = [...why.querySelectorAll('.lab-why-rules li')].map(text);
  assert.equal(rules.length, result.rulesApplied.length);
  assert.ok(
    rules.includes(
      'What you see: what is visible is built-up silver, never the amount of target and never bound silver'
    )
  );
  for (const rule of rules) assert.doesNotMatch(rule, /\bR-|ordinal|\.endpoint/, rule);
  // F15: the binding rule in plain words, naming the step it is read at
  assert.ok(
    rules.includes(
      'Bound silver: the impregnation time sets how much silver binds; the model reads it at the ammoniacal silver bath (step 4)'
    ),
    rules.join(' | ')
  );
  // F9 / KB-04: no unexplained "Confidence: normal" next to a simulated picture
  assert.match(text(why), /Contrast: low \(model scale\)/);
  // F6: what contrast means, in the engine's own step terms
  assert.match(
    text(why),
    /how many steps the darkest structure sits above the background \(0 none … 4 high\); not an amount of protein/
  );
  assert.doesNotMatch(text(why), /Confidence/);
  // F16: Keep in mind in plain words; the engine's own caveat text only under Sources
  const kept = [...why.querySelectorAll('.lab-caveats:not(.lab-caveats-engine) li')].map(text);
  assert.equal(kept.length, result.caveats.length);
  for (const line of kept) assert.doesNotMatch(line, /sop-default|registry|\bv1\b|schematic/, line);
  assert.ok(
    kept.includes(
      "Shorter, standard and longer are ordered places on the model's scale, not times. No one knows where the course's real times fall on a binding or build-up curve."
    ),
    kept.join(' | ')
  );
  assert.equal(why.querySelector('.lab-caveats-engine'), null, 'the engine wording waits under Sources');
  const sources = why.querySelector('.lab-sources-disclosure .lab-drawer-btn');
  assert.equal(text(sources), 'Sources');
  sources.click();
  assert.ok(
    [...why.querySelectorAll('.lab-chip-rule')].some(chip => text(chip) === 'R-model-01'),
    'rule ids only under Sources'
  );
  assert.deepEqual([...why.querySelectorAll('.lab-caveats-engine li')].map(text), Array.from(result.caveats));
  // list mode: Look into the tissue opens the clip as text
  card.querySelector('[data-lab-drawer="tissue-text"] .lab-drawer-btn').click();
  assert.deepEqual(
    [...card.querySelectorAll('.lab-clip-text li')].map(li => li.dataset.labScene),
    Array.from(w.SilverLab.CLIP_SCENES)
  );
  // Why? and the tissue text survive a refresh (a note in History re-renders the bench)
  $(w, '#lab-history-toggle').click();
  $(w, '#lab-note-text').value = 'looked';
  $(w, '#lab-note-form').dispatchEvent(submit(w));
  assert.equal(run().events.at(-1).type, 'note');
  assert.equal($(w, '[data-lab-why="result"] .lab-drawer-btn').getAttribute('aria-expanded'), 'true');
  assert.doesNotMatch(benchText(w), BENCH_TOKENS, 'no engine word outside Why? / Sources / History');
  // persisted through the stub
  const saved = JSON.parse(h.store.get(STATE_KEY));
  assert.equal(saved.runs['run-1'].events.length, 10);
  h.close();
});

// A dip names its jar (SHELF §13.2); a step event its step: the jar an event dipped the slide in.
const jarOf = e => (e && e.type === 'dip' ? e.jarId : e && e.type === 'step' ? e.step : null);
test('MODE-2 (SHELF) an older free run that changed settings keeps its settings sentence on the set-up line; the record-only flags; a compare-only free run has no jars; a practice run never carries a mix', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  // [the older run's set-params patch, the set-up line's words] (no settings UI on either set-up now)
  const CASES = [
    [{ impregnation: { endpoint: 'early' } }, 'Impregnation time: shorter'],
    [{ ammoniacal: { ammonia: 'cloudy' } }, 'Ammonia in the ammoniacal silver: left cloudy, not filtered'],
    [{ development: { strength: 'strong' } }, 'Developer strength: stronger'],
    [{ washes: { condition: 'deviated' } }, 'Washes: changed'],
  ];
  for (const [patch, words] of CASES) {
    const run = startRun(w, { mode: 'free' });
    w.CortexLab.applyEvent(run.id, { type: 'set-params', params: patch });
    change(w, $(w, '#lab-run-select'), run.id);
    assert.equal(
      text($(w, '.lab-setup-line')),
      `Practice specimen A · high burden · Free bench · ${words}`,
      'the collapsed line is plain'
    );
    assert.doesNotMatch(text($(w, '.lab-setup-line')), BENCH_TOKENS);
    // KB-24: while the set-up is open, the current run's line steps aside and the toggle names itself
    $(w, '#lab-setup-toggle').click();
    assert.equal($(w, '.lab-setup-line'), null, 'no current-run line beside the new-run form');
    assert.equal(text($(w, '#lab-setup-toggle')), 'Close the set-up');
    assert.equal($(w, '#lab-mix'), null, 'no Mix panel (§13.3)');
    $(w, '#lab-setup-toggle').click();
  }
  // MODE-FIX-shell-2: toning and thiosulfate are jars on the free bench (§11.3), not settings: an older free
  // save carrying the flag never says "skipped" (the set-up line, the settings lines read the slide: done /
  // not done); a free run skips no step
  const jars = startRun(w, { mode: 'free' });
  w.CortexLab.applyEvent(jars.id, { type: 'set-params', params: { toning: false, thiosulfate: false } });
  change(w, $(w, '#lab-run-select'), jars.id);
  const jarsRun = () => w.CortexLab.getState().runs[jars.id];
  assert.equal(jarsRun().params.toning, false, 'the flag is on the run');
  assert.equal(
    text($(w, '.lab-setup-line')),
    'Practice specimen A · high burden · Free bench · the procedure’s jars',
    'flags are no settings: the line names the jars'
  );
  assert.doesNotMatch(benchText(w), /skipped/i, 'nothing on the bench calls a jar skipped');
  assert.equal(w.labSkippedSteps(jarsRun()).size, 0, 'a free run skips nothing');
  assert.deepEqual(Array.from(w.labSettingsLines(jarsRun())), [
    'Settings: all standard (per procedure)',
    `Gold toning: not done (${w.SilverLab.TONING_TEXT.skipped})`,
    `Thiosulfate: not done (${w.SilverLab.THIOSULFATE_TEXT.skipped})`,
  ]);
  change(w, $(w, '#lab-free-step'), 'gold-toning');
  $(w, '#lab-free-dip').click();
  assert.equal(
    [...$(w, '#lab-free-step').options].some(o => o.value === 'gold-toning'),
    true,
    'the gold jar stays offered whatever the flag'
  );
  $(w, '#lab-run-all').click();
  assert.equal(jarsRun().events.filter(e => jarOf(e) === 'sodium-thiosulfate').length, 1);
  assert.deepEqual(Array.from(w.labSettingsLines(jarsRun())), [
    'Settings: all standard (per procedure)',
    `Gold toning: done (${w.SilverLab.TONING_TEXT.performed})`,
    `Thiosulfate: done (${w.SilverLab.THIOSULFATE_TEXT.performed})`,
  ]);
  // MODE-FIX-shell-12: a compare-only method has no jars: no Jar select, no Dip that does nothing, no jar
  // tools or hands, no slide flags and no "No dip yet" line; the status line says it is compare only
  const cps = w.CortexLab.newRun({ method: 'cps-i', mode: 'free' });
  await w.renderLabEntry(); // the run select now lists it
  change(w, $(w, '#lab-run-select'), cps.id);
  assert.equal(cps.method, 'cps-i');
  assert.equal($(w, '#lab-free-step'), null);
  assert.equal($(w, '#lab-free-dip'), null);
  assert.equal($(w, '#lab-add-jar'), null);
  assert.equal($(w, '#lab-hands'), null);
  assert.equal($(w, '#lab-reactions-empty'), null);
  assert.equal($(w, '#lab-slide-now .lab-slide-flags'), null);
  assert.match(text($(w, '#lab-do .lab-do-status')), /is compare only: it has no bench steps/);
  // a practice run never carries the mix: its set-up has no settings UI, and its line names the mode
  $(w, '#lab-setup-toggle').click();
  change(w, $(w, '#lab-bench-mode input[value="practice"]'), true);
  assert.equal($(w, '#lab-mix'), null);
  const plain = startRun(w);
  assert.equal(plain.events.length, 0);
  assert.equal(plain.mode, 'practice');
  assert.equal(text($(w, '.lab-setup-line')), 'Practice specimen A · high burden · Practice the procedure');
  h.close();
});

test('MODE-3 practice refuses any jar but the next (the row note, the status line and the live region say which step is next; nothing recorded); the free bench takes any jar in any order, logs one reaction per dip and never marks a step next; Do the whole procedure dips the rest in order and seals the slide', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  const run = startRun(w);
  const get = () => w.CortexLab.getState().runs[run.id];
  // practice: no pick list anywhere, Explain this step only
  assert.equal($(w, '[data-lab-drawer="pick-step"]'), null, 'nothing to pick under the steps');
  assert.deepEqual($$(w, '#lab-do .lab-do-more > *').map(text), ['Explain this step']);
  $(w, '#lab-explain-open').click();
  assert.equal($(w, '#lab-sheet [data-lab-drawer="pick-step"]'), null, 'no Do a different step in the sheet');
  assert.equal($(w, '[data-lab-perform]'), null);
  press(w, $(w, '#lab-sheet-h'), 'Escape');
  // a slide dropped on the wrong jar: refused on that row, in the status line and the live region
  assert.equal(
    w.labDropHint(w.LAB.lab, { runId: run.id }, 'development'),
    'Next in the procedure: Remove the wax and rehydrate'
  );
  dragSlide(w, $(w, '.lab-step[data-lab-step="development"]'));
  assert.deepEqual(Array.from(get().events), [], 'nothing recorded');
  const row = $(w, '.lab-step[data-lab-step="development"]');
  assert.equal(text(row.querySelector('.lab-step-note')), 'Next in the procedure: Remove the wax and rehydrate');
  assert.equal(text($(w, '#lab-drop-note')), 'Develop the silver: Next in the procedure: Remove the wax and rehydrate');
  assert.equal(row.classList.contains('lab-step-done'), false);
  assert.equal(
    $(w, '.lab-step[aria-current="step"]').dataset.labStep,
    'deparaffinize-rehydrate',
    'the next row stays next'
  );
  // the next jar takes the slide; after it the step's by-eye line (when the engine gives one) and the count
  dragSlide(w, $(w, '.lab-step[data-lab-step="deparaffinize-rehydrate"]'));
  assert.deepEqual(Array.from(get().events.map(e => e.step)), ['deparaffinize-rehydrate']);
  assert.match(
    text($(w, '#lab-live')),
    /^Remove the wax and rehydrate done\.( [^.]+\.)* 1 of 9 steps done\. Next: First silver bath\.$/
  );
  // a step already done: "Done. Next: …"
  dragSlide(w, $(w, '.lab-step[data-lab-step="deparaffinize-rehydrate"]'));
  assert.equal(get().events.length, 1);
  assert.equal(
    text($(w, '.lab-step[data-lab-step="deparaffinize-rehydrate"] .lab-step-note')),
    'Done. Next: First silver bath'
  );
  assert.deepEqual(Array.from(get().deviations), [], 'the engine sees no deviation: nothing out of order was recorded');
  assert.equal(text($(w, '#lab-do-step')), 'Do this step: First silver bath', 'the primary stays in procedure order');
  // the free bench: any jar, in any order, any number of times; nothing is next
  $(w, '#lab-setup-toggle').click();
  const free = startRun(w, { mode: 'free' });
  const fget = () => w.CortexLab.getState().runs[free.id];
  assert.equal(text($(w, '#lab-do-h')), 'The bench');
  assert.equal($(w, '#lab-do-step'), null, 'no primary step');
  assert.equal($(w, '#lab-do-count'), null, 'no count');
  assert.equal($(w, '#lab-do-progress'), null, 'no progress element');
  assert.equal($(w, '.lab-step[aria-current="step"]'), null, 'no row is next');
  assert.equal($(w, '.lab-step-next'), null);
  assert.equal(w.document.activeElement.id, 'lab-free-dip', 'Start lands on Dip the slide');
  const jar = $(w, '#lab-free-step');
  const steps = [...w.LAB.lab.getMethod('bielschowsky-modified').steps].sort((a, b) => a.order - b.order);
  // SHELF (§13.3): every jar by its contents, the jar's name after it
  const procedureJars = w.LAB.lab.procedureJars();
  assert.deepEqual(
    [...jar.options].map(o => [o.value, o.textContent]),
    steps.map(s => [s.id, `${w.LAB.lab.solutionText(procedureJars[s.id])} (${s.studentTitle})`])
  );
  assert.equal(text($(w, '#lab-free-dip')), 'Dip the slide');
  assert.equal(text($(w, '#lab-run-all')), 'Do the whole procedure');
  assert.equal(text($(w, '#lab-new-slide')), 'New slide');
  assert.deepEqual($$(w, '#lab-do .lab-do-more > button').map(text), ['Explain a step']);
  assert.ok($(w, '#lab-reactions-empty'), 'the log says no dip yet');
  // develop before any silver: the dip is taken and one reaction is logged
  change(w, jar, 'development');
  $(w, '#lab-free-dip').click();
  assert.deepEqual(Array.from(fget().events.map(jarOf)), ['development']);
  assert.equal(fget().events[0].type, 'dip', 'SHELF: a free dip is a dip event');
  assert.equal(w.document.activeElement.id, 'lab-free-dip', 'focus stays on the button');
  const reactions = Array.isArray(fget().reactions) ? fget().reactions : [];
  const said = reactions.length ? reactions.at(-1).text : 'Develop the silver done.';
  assert.equal(text($(w, '#lab-live')), `Develop the silver: ${said}`);
  assert.equal(text($(w, '.lab-step[data-lab-step="development"] .lab-step-note')), said, 'the reaction on that row');
  assert.ok($(w, '.lab-step[data-lab-step="development"]').classList.contains('lab-step-done'));
  assert.equal(text($(w, '.lab-step[data-lab-step="development"] .lab-step-state')), '✓ done');
  if (reactions.length) {
    const items = $$(w, '#lab-reactions > li.lab-reaction');
    assert.equal(items.length, 1);
    assert.ok(items[0].classList.contains('lab-reaction-latest'));
    assert.equal(text(items[0].querySelector('.lab-reaction-step')), 'Develop the silver');
    assert.equal(text(items[0].querySelector('.lab-reaction-text')), said);
    assert.equal(items[0].dataset.labReaction, reactions.at(-1).kind);
    assert.equal(text(items[0].querySelector('.lab-drawer-btn')), 'Why?');
  }
  assert.deepEqual(
    Array.from(fget().deviations.filter(d => d.kind === 'out-of-order')),
    [],
    'order is the point: never out of order'
  );
  // the same jar again: done ×2
  $(w, '#lab-free-dip').click();
  assert.equal(fget().events.filter(jarOf).length, 2);
  assert.equal(text($(w, '.lab-step[data-lab-step="development"] .lab-step-state')), '✓ done ×2 2 times');
  assert.equal(
    $(w, '.lab-step[data-lab-step="development"] .lab-step-how > [aria-hidden="true"]').textContent,
    ' ×2',
    'the glyph is seen, not read (MODE-FIX-shell-21)'
  );
  assert.equal(text($(w, '.lab-step[data-lab-step="development"] .lab-step-how > .lab-sr-only')), '2 times');
  assert.match(
    text($(w, '#lab-live')),
    /^Develop the silver again: /,
    'a repeat is a new announcement (MODE-FIX-shell-14)'
  );
  // MODE-FIX-shell-28: free rows carry a jar glyph, no ordinal; practice rows (above) keep their numbers
  for (const li of $$(w, 'li.lab-step')) {
    assert.ok(li.querySelector('.lab-step-order').classList.contains('lab-step-jar'), li.dataset.labStep);
    assert.equal(li.querySelector('.lab-step-order').textContent, '');
  }
  // Do the whole procedure: from where the slide is, in order (MODE-integrate-3: a dip that reacted
  // counts as done; the two fruitless develops do not, so the developer comes again in its turn and the
  // whole procedure runs); mounting seals the slide
  $(w, '#lab-run-all').click();
  assert.deepEqual(Array.from(fget().events.filter(jarOf).map(jarOf)), [
    'development',
    'development',
    ...steps.map(s => s.id),
  ]);
  assert.ok(
    fget().events.every(e => e.type === 'dip'),
    'SHELF: each procedure jar dipped with what is in it'
  );
  if (fget().slide) {
    assert.equal(fget().slide.coverslipped, true, 'sealed');
    if (w.SilverLab.LOOKS) {
      const out = w.LAB.lab.resolve(fget());
      assert.equal(out.look && out.look.key, 'gray-black', 'the full procedure on this slide: gold toned');
      assert.equal($(w, '#lab-slide-now .lab-look-swatch').dataset.labLook, 'gray-black');
    }
    assert.equal($(w, '#lab-free-dip').disabled, true);
    assert.equal($(w, '#lab-run-all').disabled, true);
    assert.equal(text($(w, '#lab-do-sealed')), 'Sealed under a coverslip: start a new slide.');
    assert.equal(
      w.labDropHint(w.LAB.lab, { runId: free.id }, 'development'),
      'Sealed under a coverslip: start a new slide'
    );
  }
  // New slide: another free run, the same specimen (the jars carry over by themselves)
  $(w, '#lab-new-slide').click();
  const state = w.CortexLab.getState();
  const next = state.runs[state.runOrder.at(-1)];
  assert.notEqual(next.id, free.id);
  assert.equal(next.mode, 'free');
  assert.equal(next.specimenId, free.specimenId);
  assert.equal(next.events.length, 0);
  assert.equal($(w, '#lab-free-dip').disabled, false);
  // the practice rows keep their numbers (MODE-FIX-shell-28)
  $(w, '#lab-setup-toggle').click();
  startRun(w);
  assert.deepEqual(
    $$(w, 'li.lab-step .lab-step-order').map(n => [n.classList.contains('lab-step-jar'), n.textContent]),
    steps.map(s => [false, String(s.order)])
  );
  // a sealing dip from the Dip control (MODE-FIX-shell-13): focus lands on New slide, never on the body
  $(w, '#lab-setup-toggle').click();
  const seal = startRun(w, { mode: 'free' });
  change(w, $(w, '#lab-free-step'), 'final-wash-dehydrate-clear-mount');
  $(w, '#lab-free-dip').click();
  assert.equal(w.CortexLab.getState().runs[seal.id].slide.coverslipped, true);
  assert.equal($(w, '#lab-free-dip').disabled, true);
  assert.equal(w.document.activeElement.id, 'lab-new-slide');
  // MODE-FIX-shell-3: a free run's sheet describes the free bench (the engine's third argument); the
  // "Nothing" line stays only while the engine has no free-bench answer
  $(w, '.lab-step[data-lab-step="final-wash-dehydrate-clear-mount"]').click();
  const freeInfo = w.LAB.lab.explainStep('final-wash-dehydrate-clear-mount', 'bielschowsky-modified', 'free');
  if (/R-react-seal/.test(String(freeInfo && freeInfo.modelEffect)))
    assert.match(text($(w, '#lab-sheet')), /R-react-seal|sealed/i, 'the sheet names the seal rule on the free bench');
  else assert.match(text($(w, '#lab-sheet')), /What the model does/);
  press(w, $(w, '#lab-sheet-h'), 'Escape');
  h.close();
});

test('MODE-FIX-shell-4 list mode: a dip from the Dip control brings the row its reaction landed on into view (just enough, focus kept on the button); a drop’s row is left where it is', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w, { mode: 'free' });
  const scrolled = [];
  w.Element.prototype.scrollIntoView = function (opts) {
    scrolled.push([this.dataset.labStep || this.id, opts && opts.block, opts && opts.behavior]);
  };
  const far = { top: 2000, bottom: 2052, left: 0, right: 300, width: 300, height: 52 };
  const none = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
  w.Element.prototype.getBoundingClientRect = function () {
    return this.matches('li.lab-step') ? far : none;
  };
  change(w, $(w, '#lab-free-step'), 'development');
  $(w, '#lab-free-dip').click();
  assert.deepEqual(
    scrolled.filter(x => x[0] === 'development'),
    [['development', 'nearest', 'instant']],
    'the row below the fold comes up, just enough'
  );
  assert.equal(w.document.activeElement.id, 'lab-free-dip', 'focus stays on the button (§11.1)');
  scrolled.length = 0;
  dragSlide(w, $(w, '.lab-step[data-lab-step="water-wash"]'));
  assert.deepEqual(
    scrolled.filter(x => x[0] === 'water-wash'),
    [],
    'a drop’s row is already under the finger'
  );
  h.close();
});

test('UX-B Explain this step: a side sheet with purpose, plain model effect, pending hazards and Sources; Esc and Close return focus', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  const sheet = $(w, '#lab-sheet');
  assert.equal(sheet.hidden, true);
  const open = $(w, '#lab-explain-open');
  assert.equal(open.getAttribute('aria-expanded'), 'false');
  open.focus();
  open.click();
  assert.equal($(w, '#lab-sheet').hidden, false);
  assert.equal(w.document.activeElement.id, 'lab-sheet-h');
  assert.equal(text($(w, '#lab-sheet-h')), 'Remove the wax and rehydrate');
  assert.equal($(w, '#lab-explain-open').getAttribute('aria-expanded'), 'true');
  const body = () => text($(w, '#lab-sheet'));
  assert.match(body(), /Step 1 of 9 · procedure name: Dewax and rehydrate/);
  assert.match(body(), /What it is for Remove the wax and bring the section to water: xylene twice/);
  assert.match(body(), /What the model does Nothing: no sourced rule gives this step an effect/);
  // the procedure's quantities as a definition list (SOP-3), the hood flag last
  const quant = [...$$(w, '#lab-sheet dl.lab-sheet-quant div')].map(d => [
    text(d.querySelector('dt')),
    text(d.querySelector('dd')),
  ]);
  assert.deepEqual(
    quant.map(([k]) => k),
    ['Reagent', 'Strength', 'Time', 'Temperature', 'Fume hood']
  );
  assert.equal(quant[2][1], 'xylene 5 + 5 min; ethanol 3 + 3 + 3 + 3 min; distilled water 3 changes of 1 min');
  assert.equal(quant[4][1], 'yes');
  assert.doesNotMatch(body(), /pending|instructor|SOP\b/i, 'nothing on this step waits on anyone (§11.7)');
  assert.ok($(w, '#lab-sheet .lab-hazards li'), 'the procedure hazard is listed');
  assert.equal($(w, '#lab-sheet .lab-hazards .lab-badge'), null, 'no badge on a hazard');
  assert.doesNotMatch(text($(w, '#lab-sheet .lab-sheet-body')), /PENDING-EHS/);
  // follow: performing the step moves the sheet to the next one
  $(w, '#lab-do-step').click();
  assert.equal(text($(w, '#lab-sheet-h')), 'First silver bath');
  // the development step: model effect in plain words, rule ids only under Sources
  change(w, $(w, '#lab-sheet-step'), 'development');
  assert.equal(text($(w, '#lab-sheet-h')), 'Develop the silver');
  const effects = $$(w, '.lab-sheet-effects li').map(text);
  assert.deepEqual(effects, [
    'Silver nuclei: silver nuclei are limited by bound silver and by reduction sites',
    'Visible silver: the developer grows visible silver on the nuclei; development time and strength shift it',
    'Background (an assumption of the model, with no source for this stain): a strong developer or extended development raises the background by one step on the model scale',
    'What you see: what is visible is built-up silver, never the amount of target and never bound silver',
    "Timing: where the development time sits on the model's scale compared with the procedure's (before, at or after it)",
  ]);
  assert.doesNotMatch(
    text($(w, '#lab-sheet .lab-sheet-body')).replace(/Sources.*$/, ''),
    /\bR-model|\.endpoint|ordinal/
  );
  $(w, '#lab-sheet [data-lab-drawer="sheet-sources"] .lab-drawer-btn').click();
  assert.ok($$(w, '#lab-sheet .lab-chip-rule').some(c => text(c) === 'R-model-03'));
  assert.ok($(w, '#lab-sheet .lab-sources li'), 'the procedure source is listed');
  // every step's hazards come from the course procedure (§11.7): no badge, no pending words
  change(w, $(w, '#lab-sheet-step'), 'gold-toning');
  assert.equal($(w, '#lab-sheet .lab-hazards .lab-badge'), null);
  assert.doesNotMatch(body(), /pending|instructor/i);
  const hood = [...$$(w, '#lab-sheet dl.lab-sheet-quant div')].find(d => text(d.querySelector('dt')) === 'Fume hood');
  assert.equal(text(hood.querySelector('dd')), 'not needed');
  // Esc closes and returns focus to the opener
  $(w, '#lab-sheet-h').focus();
  press(w, $(w, '#lab-sheet-h'), 'Escape');
  assert.equal($(w, '#lab-sheet').hidden, true);
  assert.equal(w.document.activeElement.id, 'lab-explain-open');
  $(w, '#lab-explain-open').click();
  $(w, '#lab-sheet-close').click();
  assert.equal($(w, '#lab-sheet').hidden, true);
  assert.equal(w.document.activeElement.id, 'lab-explain-open');
  h.close();
});

test('UX-B History: a drawer with the run picker, the full log, the replay and notes; it switches the current run', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  $(w, '#lab-run-all').click();
  startRun(w, { specimen: 'SPEC-SYN-NEG-01' });
  const history = $(w, '#lab-history');
  assert.equal(history.hidden, true, 'out of the main view');
  const toggle = $(w, '#lab-history-toggle');
  assert.ok(toggle.closest('#lab-run-menu'), 'History is in the Run menu (UX-R2)');
  assert.deepEqual(
    [toggle.getAttribute('aria-expanded'), toggle.getAttribute('aria-controls')],
    ['false', 'lab-history']
  );
  $(w, '#lab-run-menu-btn').click();
  toggle.click();
  assert.equal($(w, '#lab-history').hidden, false);
  assert.equal(w.document.activeElement.id, 'lab-history-h');
  assert.equal($(w, '#lab-history-toggle').getAttribute('aria-expanded'), 'true');
  assert.ok($(w, '#lab-run-menu').hidden, 'choosing an item closes the menu');
  const select = $(w, '#lab-run-select');
  assert.equal(text(select.closest('label').querySelector('span')), 'Your runs');
  assert.deepEqual(
    [...select.options].map(o => [o.value, o.textContent]),
    [
      ['run-1', 'Run 1 · Practice specimen A · high burden · 9 of 9 steps done'],
      ['run-2', 'Run 2 · Negative comparison · no plaques or tangles · 0 of 9 steps done'],
    ]
  );
  assert.equal(select.value, 'run-2');
  assert.match(text($(w, '#lab-log-h')), /Run log/);
  assert.match(text($(w, '.lab-log')), /no events yet/);
  // switch to run 1: the header, the steps and the result follow; History stays open
  change(w, select, 'run-1');
  assert.equal(text($(w, '#lab-run-name')), 'Run 1');
  assert.equal($(w, '#lab-history').hidden, false);
  assert.equal(w.document.activeElement.id, 'lab-run-select');
  assert.equal($$(w, '.lab-log-table tbody tr').length, 9);
  assert.match(text($(w, '.lab-log')), /run-1 · SPEC-SYN-AD-01 · bielschowsky-modified/, 'engine names live here');
  assert.ok($(w, '#lab-resolve-out .lab-result-card'));
  // the replay: one frame per event, the simulated badge
  assert.equal($(w, '.lab-replay .lab-banner .lab-badge').dataset.labLabel, 'illustrative-synthetic');
  assert.equal($(w, '#lab-replay-range').max, '8');
  $(w, '#lab-replay-next').click();
  assert.match(text($(w, '#lab-replay-frame')), /Frame 2 of 9/);
  // a note goes into the log
  $(w, '#lab-note-text').value = 'compare later';
  $(w, '#lab-note-form').dispatchEvent(submit(w));
  assert.equal(w.CortexLab.getState().runs['run-1'].events.at(-1).text, 'compare later');
  assert.equal($$(w, '.lab-log-table tbody tr').length, 10);
  assert.equal($(w, '#lab-3d-replay'), null, 'the 3D replay only in 3D mode');
  $(w, '#lab-history-close').click();
  assert.equal($(w, '#lab-history').hidden, true);
  assert.equal(w.document.activeElement.id, 'lab-run-menu-btn', 'focus back on the menu that holds History');
  h.close();
});
test('UX-INT: a finished practice run keeps Explain in History, not under the steps, and offers no Redo a step (MODE §11.1); CortexLab.plain words engine sentences', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  assert.ok($(w, '#lab-do #lab-explain-open'), 'while steps remain, Explain sits under the steps');
  $(w, '#lab-do #lab-explain-open').click();
  assert.equal($(w, '#lab-sheet [data-lab-drawer="pick-step"]'), null, 'no Do a different step');
  $(w, '#lab-run-all').click();
  assert.equal($(w, '#lab-sheet').hidden, true, 'the finished run closes the step sheet');
  assert.equal($(w, '#lab-do .lab-do-more'), null, 'a finished run: nothing under the status line');
  assert.equal($(w, '#lab-do #lab-explain-open'), null);
  assert.equal(text($(w, '#lab-history #lab-explain-open')), 'Explain a step');
  assert.equal($(w, '#lab-history [data-lab-drawer="pick-step"]'), null);
  assert.equal($(w, '#lab-history [data-lab-drawer="redo-step"]'), null, 'no Redo a step (§11.1)');
  assert.equal($(w, '[data-lab-perform]'), null, 'no pick list anywhere');
  $(w, '#lab-history-toggle').click();
  $(w, '#lab-history #lab-explain-open').click();
  assert.equal($(w, '#lab-sheet').hidden, false);
  assert.equal(text($(w, '#lab-sheet-h')), 'Rinse, dehydrate, clear and mount', 'the last step');
  assert.equal(text($(w, '#lab-sheet .lab-sheet-finished')), FINISHED, 'where the next run starts');
  press(w, $(w, '#lab-sheet-h'), 'Escape');
  assert.equal(w.document.activeElement.id, 'lab-explain-open', 'focus back on the opener in History');
  assert.equal(
    w.CortexLab.plain('No sourced rule covers washes.condition = deviated; the model cannot say.'),
    'No sourced rule covers this change (washes: changed); the model cannot say.'
  );
  assert.equal(w.CortexLab.plain('plain words stay'), 'plain words stay');
  h.close();
});
test('state round-trips: a second harness reads the saved runs back and rehydrates them from events', async () => {
  const a = harness();
  await a.w.renderLabEntry();
  a.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  const run = a.w.CortexLab.newRun({ specimenId: 'SPEC-SYN-AD-02', label: 'kept' });
  a.w.CortexLab.applyEvent(run.id, { type: 'set-params', params: { development: { endpoint: 'extended' } } });
  a.w.CortexLab.applyEvent(run.id, { type: 'step', step: 'deparaffinize-rehydrate' });
  a.w.CortexLab.applyEvent(run.id, { type: 'note', text: 'hello' });
  const raw = a.store.get(STATE_KEY);
  assert.equal(raw, a.w.SilverLab.serialize(a.w.CortexLab.getState()), 'written through SilverLab.serialize');
  a.close();
  const b = harness({ url: 'http://localhost/lab?view=bench', store: new Map([[STATE_KEY, raw]]) });
  const state = b.w.CortexLab.getState();
  assert.equal(state.safetyAcknowledgedAt, ACK);
  assert.deepEqual(Array.from(state.runOrder), ['run-1']);
  await b.w.renderLabEntry();
  const kept = b.w.CortexLab.getState().runs['run-1'];
  assert.equal(kept.label, 'kept');
  assert.equal(kept.params.development.endpoint, 'extended');
  assert.deepEqual(Array.from(kept.stepsDone), ['deparaffinize-rehydrate']);
  assert.equal(kept.events.map(e => e.seq).join(','), '1,2,3');
  assert.equal($(b.w, '#lab-run-select').value, 'run-1');
  assert.equal(text($(b.w, '#lab-run-name')), 'Run 1 · kept');
  assert.equal(kept.mode, 'practice', 'a stored run without the field is practice (§11.1)');
  assert.equal(text($(b.w, '.lab-setup-line')), 'Practice specimen B · low burden · Practice the procedure');
  assert.deepEqual(b.failed, []);
  b.close();
});

test('saved state carrying the reserved label, a broken shape or a non-object event is refused (m8)', async () => {
  const poisoned = JSON.stringify({
    v: 1,
    runs: {},
    runOrder: [],
    notebook: { v: 1, entries: [{ id: 'entry-1', type: 'simulated', label: 'validated-prediction' }] },
  });
  const h = harness({ store: new Map([[STATE_KEY, poisoned]]) });
  assert.deepEqual(
    h.failed.map(k => Array.from(k)),
    [[STATE_KEY]]
  );
  assert.equal(h.w.CortexLab.getState().notebook.entries.length, 0);
  await h.w.renderLabEntry();
  assert.match(text($(h.w, '.course-notice')), /refused/);
  const broken = harness({ store: new Map([[STATE_KEY, JSON.stringify({ v: 1, runs: [], runOrder: 'x' })]]) });
  assert.deepEqual(
    broken.failed.map(k => Array.from(k)),
    [[STATE_KEY]]
  );
  assert.equal(broken.w.CortexLab.getState().runOrder.length, 0);
  broken.close();
  for (const events of [[null], ['step'], [{ seq: 1, type: 'step', step: 'water-wash' }, 7]]) {
    const run = { id: 'run-1', specimenId: 'SPEC-SYN-AD-01', method: 'bielschowsky-modified', params: {}, events };
    const bad = harness({
      store: new Map([[STATE_KEY, JSON.stringify({ v: 1, runs: { 'run-1': run }, runOrder: ['run-1'] })]]),
    });
    assert.deepEqual(
      bad.failed.map(k => Array.from(k)),
      [[STATE_KEY]],
      `events ${JSON.stringify(events)} refused`
    );
    assert.equal(bad.w.CortexLab.getState().runOrder.length, 0);
    bad.close();
  }
  h.close();
});

test('m8: a bench refresh that throws leaves a readable notice instead of a frozen page', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  $(w, '#lab-newrun').dispatchEvent(submit(w));
  assert.ok($(w, '#lab-do-step'));
  w.CortexLab.getState().runs['run-1'].events = null; // stale / damaged in-tab copy
  $(w, '#lab-run-select').dispatchEvent(new w.Event('change', { bubbles: true }));
  const notice = $(w, '#lab-bench-body .course-notice[role="alert"]');
  assert.ok(notice, 'notice rendered');
  assert.match(text(notice), /could not redraw/);
  assert.match(text(notice), /saved work is kept/);
  h.close();
});

test('a refused write shows the saving-paused notice and keeps the draft in the tab', async () => {
  const h = harness({ writeOk: false, startMode: null }); // nothing saved before: the store stays empty
  await h.w.renderLabEntry();
  assert.equal(h.w.CortexLab.save(), false);
  assert.match(text($(h.w, '#lab-save-status')), /Saving is paused/);
  const run = h.w.CortexLab.newRun({ specimenId: 'SPEC-SYN-AD-01' });
  assert.ok(h.w.CortexLab.getState().runs[run.id], 'draft kept in the tab');
  assert.equal(h.store.has(STATE_KEY), false);
  h.close();
});

// UX-E (contract §8.3; PLAN-ALZ-LAB-SIMPLIFY §3.5): each activity is a stepper, one step per screen at
// ?view=module:M3&step=N (1-based). Screen counts follow the data: consecutive predict steps share one
// screen (M6: three boxes, then the interpretation), every other step is its own screen.
const MODULES_JSON = JSON.parse(read('data/lab/modules.json')).items;
function screenCount(mod) {
  let n = 0;
  mod.steps.forEach((s, i) => {
    if (!(s.kind === 'predict' && i > 0 && mod.steps[i - 1].kind === 'predict')) n++;
  });
  return n;
}
// What a student reads on the page: closed <details> bodies and anything hidden are dropped (the Why? /
// Sources / History drawers are hidden until opened); visually hidden text stays (screen readers read it).
function visibleText(w, root = $(w, 'main')) {
  const clone = root.cloneNode(true);
  clone.querySelectorAll('[hidden]').forEach(node => node.remove());
  clone
    .querySelectorAll('details:not([open])')
    .forEach(d => [...d.children].forEach(c => c.tagName !== 'SUMMARY' && c.remove()));
  return text(clone);
}

test('UX-E stepper: one step per screen with "Step n of N", a title, the prompt and Back / Next; Next swaps the screen in place, keeps the URL and focuses the new heading; Finish returns to the list', async () => {
  const h = harness({ url: 'http://localhost/lab?view=module:M1' });
  const { w } = h;
  await w.renderLabEntry();
  const total = screenCount(MODULES_JSON.find(m => m.id === 'M1'));
  assert.equal(total, 5);
  assert.equal($$(w, 'h1').length, 1);
  assert.equal(text($(w, 'h1')), 'Observation to explanation', 'the activity title, no module id');
  assert.equal(text($(w, 'main > .label')), "Alzheimer's Histology Lab · Activity 1 of 7");
  assert.equal(viewOf($(w, '.lab-backlink a')), 'modules', 'a back link to all activities');
  assert.equal($$(w, '.lab-mstep').length, 1, 'one step on screen');
  assert.equal($$(w, '.lab-mstep-dots li').length, total);
  assert.equal(
    $(w, '.lab-mstep-dots').getAttribute('aria-hidden'),
    'true',
    'the dots are decoration; the heading says it'
  );
  const heading = $(w, '.lab-mstep h2');
  assert.equal(text(heading.querySelector('.label')), `Step 1 of ${total}`);
  assert.equal(text(heading), `Step 1 of ${total} Watch the clip`);
  assert.equal(text($(w, '.lab-mstep-prompt')), MODULES_JSON[0].steps[0].prompt);
  assert.equal($(w, '#lab-module-prev'), null, 'no Back on the first step');
  const next = $(w, '#lab-module-next');
  assert.equal(next.tagName, 'A', 'a real link: keyboard reachable, works without script');
  assert.equal(next.getAttribute('href'), '/lab?view=module%3AM1&step=2');
  assert.equal(text(next), 'Next: Find the structures');
  assert.equal(next.classList.contains('btn-solid'), true, 'the one primary action');
  const mainNode = $(w, 'main');
  next.focus();
  next.click();
  assert.equal($(w, 'main'), mainNode, 'the screen swaps in place (no full re-render)');
  assert.equal(w.location.search, '?view=module%3AM1&step=2');
  assert.equal(w.document.activeElement, $(w, '.lab-mstep h2'), 'focus lands on the new step heading, never body');
  assert.equal(text($(w, '.lab-mstep h2 .label')), `Step 2 of ${total}`);
  assert.equal(text($(w, '#lab-module-prev')), 'Back: step 1, Watch the clip');
  // walk to the end with Next, then Back once
  for (let n = 2; n < total; n++) $(w, '#lab-module-next').click();
  assert.equal(text($(w, '.lab-mstep h2 .label')), `Step ${total} of ${total}`);
  const finish = $(w, '#lab-module-next');
  assert.equal(text(finish), 'Finish: back to all activities');
  assert.equal(viewOf(finish), 'modules');
  $(w, '#lab-module-prev').click();
  assert.equal(text($(w, '.lab-mstep h2 .label')), `Step ${total - 1} of ${total}`);
  assert.equal(new URLSearchParams(w.location.search).get('step'), String(total - 1));
  // Finish goes through the shell's in-app navigation to the activities list
  for (let n = total - 1; n < total; n++) $(w, '#lab-module-next').click();
  $(w, '#lab-module-next').dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  for (let i = 0; i < 50 && !$(w, 'main.lab-view-modules'); i++) await new Promise(r => setTimeout(r, 10));
  assert.ok($(w, 'main.lab-view-modules'), 'Finish opens the activities list');
  h.close();
  // a deep link opens that step; out-of-range steps clamp; a modifier click is left to the browser
  const deep = harness({ url: 'http://localhost/lab?view=module:M3&step=4' });
  await deep.w.renderLabEntry();
  assert.equal(text($(deep.w, '.lab-mstep h2 .label')), 'Step 4 of 4');
  assert.ok($(deep.w, '.lab-mstep [aria-required="true"]'), 'M3 step 4 is the required reflection');
  const back = $(deep.w, '#lab-module-prev');
  const modified = new deep.w.MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
  back.dispatchEvent(modified);
  assert.equal(modified.defaultPrevented, false);
  assert.equal(text($(deep.w, '.lab-mstep h2 .label')), 'Step 4 of 4', 'a new-tab click does not swap the screen');
  deep.close();
  for (const [step, expected] of [
    ['0', 1],
    ['99', 4],
    ['two', 1],
  ]) {
    const c = harness({ url: `http://localhost/lab?view=module:M3&step=${step}` });
    await c.w.renderLabEntry();
    assert.equal(text($(c.w, '.lab-mstep h2 .label')), `Step ${expected} of 4`, `step=${step}`);
    c.close();
  }
});

test('UX-E every activity: screen counts, a title on each screen, at most three read-first facts (claim chips and the rest under Sources), one honesty note, no engine identifier in view', async () => {
  for (const mod of MODULES_JSON) {
    const total = screenCount(mod);
    for (let n = 1; n <= total; n++) {
      const h = harness({ url: `http://localhost/lab?view=module:${mod.id}&step=${n}` });
      const { w } = h;
      w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
      await w.renderLabEntry();
      const where = `${mod.id} step ${n}`;
      assert.equal($$(w, 'h1').length, 1, where);
      assert.match(text($(w, '.lab-mstep h2')), new RegExp(`^Step ${n} of ${total} \\S`), where);
      const facts = $$(w, '.lab-readfirst-list > li');
      assert.ok(facts.length > 0 && facts.length <= 3, `${where}: read first holds 1-3 facts`);
      assert.deepEqual(
        facts.map(li => text(li)),
        mod.facts.slice(0, 3).map(f => f.text),
        `${where}: the first three facts, in data order`
      );
      assert.equal($(w, '.lab-readfirst .lab-chip'), null, `${where}: no claim chip before Sources opens`);
      const sources = $(w, '.lab-readfirst [data-lab-drawer="module-sources"] .lab-drawer-btn');
      assert.equal(text(sources), 'Sources');
      sources.click();
      assert.equal(
        $$(w, '.lab-module-sources .lab-fact-refs > li').length,
        Math.min(3, mod.facts.length),
        `${where}: one chip row per read-first fact`
      );
      assert.equal(
        $$(w, '.lab-module-sources .lab-fact-list:not(.lab-fact-refs) > li').length,
        Math.max(0, mod.facts.length - 3),
        `${where}: every other fact under Sources`
      );
      sources.click();
      // one honesty note per screen: the shell line, unless a read-first fact already says it
      const page = visibleText(w);
      const darker = page.match(/Darker (staining )?does not mean more protein/g) || [];
      assert.equal(darker.length, 1, `${where}: the darker-is-not-better note once (${darker.length})`);
      assert.doesNotMatch(page, ENGINE_TOKENS, `${where}: ${(page.match(ENGINE_TOKENS) || [])[0]}`);
      assert.doesNotMatch(
        page,
        /\b(schematic|ordinal|stand-in|caveats?|deviations?|ionic|no basis|uncertainty card)\b/i,
        where
      );
      h.close();
    }
  }
});

test('UX-E M6: the three predictions share one screen (three labeled, required boxes with their prompts as hints), the interpretation is the second and last screen', async () => {
  const mod = MODULES_JSON.find(m => m.id === 'M6');
  const h = harness({ url: 'http://localhost/lab?view=module:M6' });
  const { w } = h;
  await w.renderLabEntry();
  assert.equal(screenCount(mod), 2);
  assert.equal(text($(w, '.lab-mstep h2')), 'Step 1 of 2 Predict the outcomes');
  assert.equal(text($(w, '.lab-mstep-prompt')), 'Answer each box before any run is revealed.');
  const boxes = $$(w, '.lab-answers-grouped .lab-answer');
  assert.deepEqual(
    boxes.map(b => b.dataset.labAnswer),
    ['expected', 'negligible', 'opposite']
  );
  const predicts = mod.steps.filter(s => s.kind === 'predict');
  boxes.forEach((box, i) => {
    const area = box.querySelector('textarea');
    const label = box.querySelector(`label[for="${area.id}"]`);
    assert.equal(text(label), `${['Expected outcome', 'Negligible change', 'Opposite outcome'][i]} (required)`);
    assert.equal(area.getAttribute('aria-required'), 'true');
    assert.ok(area.required);
    const hint = $(w, `#${area.getAttribute('aria-describedby')}`);
    assert.equal(text(hint), predicts[i].prompt, 'the step prompt is the box hint');
  });
  // the designer link opens the Predict step of the wizard; one primary button named like the
  // designer's h1, a text link for a second design (F4, KB-06), and the checklist note (F20)
  assert.deepEqual(
    $$(w, '.lab-mstep-tool a').map(a => [text(a), a.getAttribute('href'), a.classList.contains('btn')]),
    [
      ['Open the predict and reveal screen', '/lab?view=designer&step=2', true],
      ['Start a new design', '/lab?view=designer&exp=new', false],
    ]
  );
  assert.match(text($(w, '.lab-mstep-tool .lab-designer-checklist')), /checklist counts only the answer boxes/);
  assert.doesNotMatch(text($(w, '.lab-mstep-tool')), /proposal/i);
  assert.match(
    w.document.title,
    /^Step 1 of 2 · Alternative outcomes · Alzheimer's Histology Lab \| Cortex Medical Academy$/
  );
  $(w, '#lab-module-next').click();
  assert.match(w.document.title, /^Step 2 of 2 · /, 'the title follows the step (A11Y-17)');
  assert.equal(text($(w, '.lab-mstep h2')), 'Step 2 of 2 Interpret the reveal');
  assert.equal($$(w, '.lab-mstep textarea').length, 1);
  assert.equal($(w, '.lab-mstep textarea').dataset.labField, 'interpretation');
  assert.deepEqual(
    $$(w, '.lab-mstep-tool a').map(a => [text(a), a.getAttribute('href')]),
    [['Open the predict and reveal screen', '/lab?view=designer&step=2']]
  );
  assert.equal(text($(w, '#lab-module-next')), 'Finish: back to all activities');
  h.close();
});

test('module done logic: done only when every required answer is written ("required" in words, aria-required); the status is one persistent live region reading "Checklist complete (not graded)"', async () => {
  const h = harness({ url: 'http://localhost/lab?view=module:M1&step=2' });
  const { w } = h;
  await w.renderLabEntry();
  const status = $(w, '#lab-module-status');
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(text(status), '0 of 1 required answer written');
  const optional = $(w, 'textarea[data-lab-field="observations"]');
  assert.equal(optional.required, false);
  assert.equal(optional.hasAttribute('aria-required'), false);
  assert.equal(text($(w, `label[for="${optional.id}"]`)), 'Your answer', 'optional answers carry no mark');
  assert.equal(optional.getAttribute('aria-describedby'), $(w, '.lab-mstep-prompt').id, 'the prompt describes the box');
  optional.value = 'I see shapes';
  optional.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal(w.CortexLab.getState().moduleProgress.M1.done, false);
  assert.equal(w.CortexLab.getState().moduleProgress.M1.fields.observations, 'I see shapes');
  assert.equal(text(optional.parentElement.querySelector('.lab-field-status')), 'Saved in this browser.');
  for (let n = 2; n < 5; n++) $(w, '#lab-module-next').click();
  const required = $$(w, 'textarea').filter(t => t.getAttribute('aria-required') === 'true');
  assert.equal(required.length, 1);
  assert.ok(required[0].required, 'B9');
  assert.equal(text($(w, `label[for="${required[0].id}"]`)), 'Your answer (required)');
  required[0].value = 'If I change X, Y changes.';
  required[0].dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal(w.CortexLab.getState().moduleProgress.M1.done, true);
  assert.equal($(w, '#lab-module-status'), status, 'the live region is updated in place, never replaced');
  assert.equal(text(status), 'Checklist complete (not graded)');
  assert.ok(status.classList.contains('ok'));
  required[0].value = '   ';
  required[0].dispatchEvent(new w.Event('blur'));
  assert.equal(w.CortexLab.getState().moduleProgress.M1.done, false);
  assert.equal(text(status), '0 of 1 required answer written');
  // answers survive moving between screens (moduleProgress is the store)
  $(w, '#lab-module-prev').click();
  $(w, '#lab-module-prev').click();
  $(w, '#lab-module-prev').click();
  assert.equal($(w, 'textarea[data-lab-field="observations"]').value, 'I see shapes');
  // claim chips under Sources; the external course link says it opens a new tab
  $(w, '[data-lab-drawer="module-sources"] .lab-drawer-btn').click();
  const chip = $(w, '.lab-fact-list .lab-chip[aria-expanded]');
  chip.click();
  assert.equal(chip.getAttribute('aria-expanded'), 'true');
  assert.match(text($(w, '.lab-fact-list .lab-chip-detail')), /S-/);
  const external = $(w, '.lab-module-meta a[target="_blank"]');
  assert.match(text(external), /\(opens in a new tab\)$/);
  h.close();
});

test('m2 / M3: module runs wait for the safety gate on each step that prepares runs; default runs are keyed by slug and old label keys migrate', async () => {
  const h = harness({ url: 'http://localhost/lab?view=module:M2' });
  const { w } = h;
  await w.renderLabEntry();
  assert.equal($$(w, '.lab-mstep [data-lab-safety="open"]').length, 1, 'the gate card on the run step');
  assert.equal(text($(w, '#lab-safety-ack')), 'I understand, continue');
  $(w, '#lab-module-next').click();
  assert.equal($$(w, '.lab-mstep [data-lab-safety="open"]').length, 1, 'and on the compare step');
  assert.equal($(w, '[data-lab-module-action="prepare"]'), null, 'no Prepare button before the gate');
  assert.equal(w.CortexLab.getState().runOrder.length, 0, 'no run was created by rendering');
  $(w, '#lab-module-prev').click();
  $(w, '#lab-safety-ack').click();
  assert.equal($(w, '[data-lab-safety]'), null, 'the gate leaves once acknowledged');
  const prepare = $(w, '[data-lab-module-action="prepare"]');
  assert.equal(text(prepare), 'Prepare the runs');
  assert.equal(w.document.activeElement, prepare, 'A1: focus lands on the replacement control');
  prepare.click();
  const progress = w.CortexLab.getState().moduleProgress.M2;
  assert.deepEqual(Object.keys(progress.runs), [
    'baseline-sop-defaults',
    'strong-developer',
    'weak-developer',
    'cps-i-schematic-compare-only',
    'cps-ii-schematic-compare-only',
  ]);
  assert.equal(w.CortexLab.getState().runOrder.length, 5);
  // the run step now lists each run on the bench, in plain names; focus moved to the first link
  const links = $$(w, '.lab-module-runs a');
  assert.equal(links.length, 5);
  assert.equal(w.document.activeElement, links[0]);
  assert.deepEqual(
    links.map(a => text(a)),
    [
      'Run 1 · Baseline, standard',
      'Run 2 · Strong developer',
      'Run 3 · Weak developer',
      'Run 4 · CPS-I picture (compare only)',
      'Run 5 · CPS-II picture (compare only)',
    ]
  );
  assert.equal(viewOf(links[0]), 'bench');
  // the compare step offers the two-run form with the same names
  $(w, '#lab-module-next').click();
  const form = $(w, '.lab-module-compare');
  assert.ok(form);
  assert.deepEqual(
    [...form.querySelectorAll('select')].map(s => s.value),
    ['run-1', 'run-2']
  );
  assert.equal(h.run(`labSlug('Strong & "weak" <dev\\'s> probe')`), 'strong-weak-dev-s-probe');
  // an older save keyed by label (plus a key a portable backup would refuse) migrates on read
  const saved = JSON.parse(h.store.get(STATE_KEY));
  saved.moduleProgress.M2.runs = {
    'Baseline, SOP defaults': saved.moduleProgress.M2.runs['baseline-sop-defaults'],
    'strong-developer': saved.moduleProgress.M2.runs['strong-developer'],
    'weak-developer': saved.moduleProgress.M2.runs['weak-developer'],
    'cps-i-schematic-compare-only': saved.moduleProgress.M2.runs['cps-i-schematic-compare-only'],
    'cps-ii-schematic-compare-only': saved.moduleProgress.M2.runs['cps-ii-schematic-compare-only'],
    'Removed & "odd" <label>': 'run-9',
  };
  h.close();
  const b = harness({
    url: 'http://localhost/lab?view=module:M2',
    store: new Map([[STATE_KEY, JSON.stringify(saved)]]),
  });
  await b.w.renderLabEntry();
  const migrated = b.w.CortexLab.getState().moduleProgress.M2.runs;
  assert.equal(migrated['baseline-sop-defaults'], 'run-1');
  assert.equal('Baseline, SOP defaults' in migrated, false);
  assert.equal(
    Object.keys(migrated).some(k => /[<>"'`&]/.test(k)),
    false,
    'no backup-unsafe key survives'
  );
  assert.ok(JSON.parse(b.store.get(STATE_KEY)).moduleProgress.M2.runs['baseline-sop-defaults'], 'migration saved');
  assert.equal(
    $(b.w, '[data-lab-module-action="prepare"]'),
    null,
    'the prepared runs are recognised under the new keys'
  );
  assert.equal($$(b.w, '.lab-module-runs a').length, 5);
  assert.equal(b.w.CortexLab.getState().runOrder.length, 5, 'nothing re-created');
  b.close();
});

test('M3 curves: inline SVG with three polylines, model-scale ticks, a badge, plain axis and legend words, Why? holding the engine notes, a table alternative', async () => {
  const h = harness({ url: 'http://localhost/lab?view=module:M3' });
  const { w } = h;
  await w.renderLabEntry();
  const figure = $(w, '.lab-curves');
  assert.ok(figure);
  assert.equal(figure.querySelectorAll('polyline').length, 3);
  assert.ok(figure.querySelector('.lab-banner [data-lab-badge="simulated"][data-lab-label="illustrative-synthetic"]'));
  const ticks = [...figure.querySelectorAll('.lab-curve-tick')].map(t => t.textContent);
  assert.deepEqual(ticks, Array.from(w.SilverLab.ORDINAL_TEXT));
  assert.ok(figure.querySelector('.lab-curve-marker'), 'marker at the standard development time');
  assert.deepEqual(
    [...figure.querySelectorAll('.lab-curve-axis')].map(t => t.textContent),
    ['earlier to later (no time units)', 'model scale']
  );
  const svg = figure.querySelector('svg');
  assert.ok($(w, '#' + svg.getAttribute('aria-describedby')), 'aria-describedby table exists');
  assert.equal(figure.querySelectorAll('tbody tr').length, 11);
  assert.doesNotMatch(svg.textContent, /\d+\s?(s|min|°|mm|µ)/, 'no units');
  // G3 + B8: the badge words are in the SVG title/desc, the legend is exposed, plain words only
  assert.match(svg.querySelector('title').textContent, /Simulated · not a measurement/);
  assert.match(
    svg.querySelector('desc').textContent,
    /Solid line: bound silver; dashed: built-up silver; dotted: how fast silver builds up/
  );
  assert.equal(figure.querySelector('.lab-curve-legend').hasAttribute('aria-hidden'), false);
  const select = $(w, '.lab-mstep select[name="endpoint"]');
  assert.deepEqual(
    [...select.options].map(o => [o.value, o.textContent]),
    [
      ['early', 'shorter'],
      ['sop-default', 'standard'],
      ['extended', 'longer'],
      ['unspecified', 'not set'],
    ]
  );
  assert.doesNotMatch(
    visibleText(w, figure),
    /ordinal|schematic|ionic|caveat|sop-default|R-|C-/i,
    'engine words stay under Why?'
  );
  const why = figure.querySelector('[data-lab-why="curves"] .lab-drawer-btn');
  assert.equal(text(why), 'Why?');
  why.click();
  assert.ok(figure.querySelector('.lab-why-body .lab-caveats li'), 'Keep in mind lists the caveats');
  figure.querySelector('.lab-why-body [data-lab-drawer] .lab-drawer-btn').click();
  assert.ok(figure.querySelectorAll('.lab-chips-host .lab-chip').length >= 2, 'claims and rules under Sources');
  assert.match($(w, '.lab-curves-plot').getAttribute('aria-label'), /for step 1/);
  select.value = 'unspecified';
  select.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal($(w, '.lab-curves .lab-curve-marker'), null, 'no marker when not set');
  $(w, '#lab-module-next').click();
  assert.equal($$(w, '.lab-curves').length, 1, 'the second curves step is its own screen');
  assert.match($(w, '.lab-curves-plot').getAttribute('aria-label'), /for step 2/, 'its own accessible name');
  assert.ok($(w, '.lab-curve-marker'), 'with its own marker');
  h.close();
});

test('UX-B compare: a copy that changes one thing (the same #lab-change-what), both run in full, one badge + plain sentence + Why? with deltas in words', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  $(w, '#lab-run-all').click();
  assert.equal($(w, '#lab-pair'), null, 'closed until asked');
  // Run 1's own microscope and Why? are open...
  $(w, '[data-lab-why="result"] .lab-drawer-btn').click();
  $(w, '#lab-scope-btn').click();
  assert.equal($(w, '#lab-scope-btn').getAttribute('aria-expanded'), 'true');
  assert.equal(text($(w, '#lab-scope-title')), 'In the microscope: Run 1', 'the inline microscope names its run (F1)');
  assert.equal(text($(w, '#lab-scope-btn')), 'Close the microscope');
  const open = $(w, '#lab-compare-open');
  assert.equal(open.getAttribute('aria-expanded'), 'false');
  open.click();
  // ...and close when the pair form opens, so Run 1's picture is never taken for the copy (F1)
  assert.equal($(w, '#lab-scope-btn').getAttribute('aria-expanded'), 'false');
  assert.equal($(w, '#lab-scope-title'), null);
  assert.equal($(w, '[data-lab-why="result"] .lab-drawer-btn').getAttribute('aria-expanded'), 'false');
  assert.equal($(w, '#lab-compare-open').getAttribute('aria-expanded'), 'true');
  assert.equal($(w, '#lab-compare-open').getAttribute('aria-controls'), 'lab-pair');
  assert.equal(w.document.activeElement.id, 'lab-change-what', 'focus lands on the one select');
  assert.equal($$(w, '#lab-change-what').length, 1, 'one "What do you want to change?" on the page');
  assert.equal($(w, '#lab-newrun'), null, 'the set-up stays collapsed');
  assert.deepEqual($$(w, '#lab-change-what option').map(text), CHANGE_OPTIONS.slice(1), 'no "Nothing" for a copy');
  // the default copy: longer development; this run's own value cannot be picked
  assert.equal($(w, '#lab-change-what').value, 'development-time');
  assert.equal($(w, '#lab-change-control input:checked').value, 'extended');
  const same = $(w, '[data-lab-change-value="sop-default"]');
  assert.ok(same.disabled);
  assert.equal(text(same.closest('label')), 'standard (same as this run)');
  assert.equal(text($(w, '#lab-change-summary')), 'The copy changes the development time to longer.');
  change(w, $(w, '#lab-change-what'), 'developer-strength');
  assert.equal($(w, '#lab-change-control input:checked').value, 'strong', 'the next value is preselected');
  assert.equal(text($(w, '#lab-pair-btn')), 'Run both and compare');
  $(w, '#lab-pair-form').dispatchEvent(submit(w));
  const state = w.CortexLab.getState();
  assert.deepEqual(Array.from(state.runOrder), ['run-1', 'run-2']);
  // F1: a second press shows the same comparison again instead of making a duplicate run
  assert.equal(text($(w, '#lab-pair-btn')), 'Compared: see below');
  $(w, '#lab-pair-form').dispatchEvent(submit(w));
  assert.deepEqual(Array.from(state.runOrder), ['run-1', 'run-2'], 'no duplicate copy');
  assert.match(text($(w, '#lab-live')), /^Already compared/);
  change(w, $(w, '[data-lab-change-value="weak"]'), true);
  assert.equal(text($(w, '#lab-pair-btn')), 'Run both and compare', 'a new value is a new comparison');
  change(w, $(w, '[data-lab-change-value="strong"]'), true);
  assert.equal(text($(w, '#lab-pair-btn')), 'Compared: see below');
  const [a, b] = [state.runs['run-1'], state.runs['run-2']];
  assert.equal(b.events.length, 9, 'the copy runs in full');
  assert.equal(b.specimenId, a.specimenId);
  assert.equal(b.label, 'copy of Run 1 · Developer strength: stronger');
  assert.deepEqual(Array.from(w.LAB.lab.compare(a, b).changedParams), ['development.strength']);
  assert.equal(text($(w, '#lab-run-name')), 'Run 1', 'the bench stays on the baseline');
  // one card: badge (engine label kept), a plain sentence, Why?, the microscope compare
  const card = $(w, '#lab-compare-out .lab-compare');
  assert.equal(card.dataset.labCompare, 'illustrative-synthetic');
  const badge = card.querySelector(':scope > .lab-banner .lab-badge');
  assert.deepEqual([badge.dataset.labBadge, badge.dataset.labLabel], ['simulated', 'illustrative-synthetic']);
  assert.equal(w.document.activeElement, card.querySelector('.lab-banner'), 'focus on the comparison');
  // F3 / KB-05: the background rise comes from the model's unsourced assumption, said in the first view
  assert.equal(
    text(card.querySelector('.lab-result-summary')),
    'Run 2 differs from Run 1 in developer strength: stronger. Plaque cores, plaque neurites, tangles, axons and neuropil threads show no change. The background goes from trace to low (the background change is a model assumption with no source for this stain); contrast goes from low to trace.'
  );
  assert.equal(
    w.CortexLab.assumptionNote(w.LAB.lab.compare(a, b)),
    'the background change is a model assumption with no source for this stain'
  );
  // Look at both: a disclosure of the side-by-side view, named above it (A11Y-15, F1)
  const both = card.querySelector('#lab-compare-scope');
  assert.deepEqual(
    [both.getAttribute('aria-expanded'), both.getAttribute('aria-controls'), both.hasAttribute('aria-pressed')],
    ['false', 'lab-scope-compare', false]
  );
  both.click();
  assert.equal($(w, '#lab-compare-scope').getAttribute('aria-expanded'), 'true');
  assert.equal(
    text($(w, '#lab-scope-compare-title')),
    'In the microscope: Run 1 and Run 2 · copy of Run 1 · Developer strength: stronger'
  );
  $(w, '#lab-compare-scope').click();
  assert.equal($(w, '#lab-scope-compare-title'), null);
  assert.doesNotMatch(
    text(card.querySelector('.lab-result-summary')),
    /\b(results?|data|measured|predicts?|better)\b/i
  );
  assert.equal($(w, '#lab-compare-out').hasAttribute('aria-live'), false);
  card.querySelector('[data-lab-why="compare"] .lab-drawer-btn').click();
  const why = card.querySelector('[data-lab-why="compare"] .lab-why-body');
  assert.equal(text(why.querySelector('.lab-scale')), w.CortexLab.words.scaleLegend);
  assert.deepEqual([...why.querySelectorAll('thead th')].map(text), ['Structure', 'Run 1', 'Run 2', 'Change']);
  assert.deepEqual(
    [...why.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(text)),
    [
      ['Plaque core', 'moderate', 'moderate', 'no change'],
      ['Plaque neurite', 'moderate', 'moderate', 'no change'],
      ['Tangle', 'moderate', 'moderate', 'no change'],
      ['Axon', 'moderate', 'moderate', 'no change'],
      ['Neuropil thread', 'low', 'low', 'no change'],
      ['Background', 'trace', 'low', 'one step darker'],
    ]
  );
  assert.ok(
    [...why.querySelectorAll('.lab-why-rules li')].some(li =>
      /^Background \(an assumption of the model, with no source for this stain\)/.test(text(li))
    )
  );
  why.querySelector('.lab-sources-disclosure .lab-drawer-btn').click();
  assert.ok([...why.querySelectorAll('.lab-chip-rule')].some(c => text(c) === 'R-model-04'));
  // UX-POLISH: the changed settings in the export's words (CortexLab.paramText), under Sources
  assert.match(text(why), /Changed settings: Developer strength: stronger/);
  // F16: Keep in mind in plain words, the engine caveats only under Sources
  for (const li of why.querySelectorAll('.lab-caveats:not(.lab-caveats-engine) li'))
    assert.doesNotMatch(text(li), /sop-default|registry|\bv1\b|schematic/, text(li));
  assert.ok(why.querySelectorAll('.lab-sources-disclosure .lab-caveats-engine li').length > 0);
  assert.doesNotMatch(benchText(w), BENCH_TOKENS);
  // §11.7: no pretreatment option in the copy's picker either
  assert.ok(![...$(w, '#lab-change-what').options].some(o => o.value === 'pretreatment'));
  // two runs you already have
  $(w, '[data-lab-drawer="compare-existing"] .lab-drawer-btn').click();
  $(w, '#lab-compare-a').value = 'run-2';
  $(w, '#lab-compare-b').value = 'run-1';
  $(w, '#lab-compare-form').dispatchEvent(submit(w));
  assert.match(
    text($(w, '#lab-compare-out .lab-result-summary')),
    /^Run 1 differs from Run 2 in developer strength: standard\./
  );
  // closing the comparison removes it
  $(w, '#lab-compare-open').click();
  assert.equal($(w, '#lab-pair'), null);
  assert.equal($(w, '#lab-compare-open').getAttribute('aria-expanded'), 'false');
  assert.equal($(w, '#lab-compare-open').hasAttribute('aria-controls'), false);
  h.close();
  // a module's ?run=&pair= opens the comparison directly
  const m = harness({
    url: 'http://localhost/lab?view=bench&run=run-1&pair=run-2',
    store: new Map([[STATE_KEY, h.store.get(STATE_KEY)]]),
  });
  await m.w.renderLabEntry();
  assert.ok($(m.w, '#lab-pair-form'), 'the comparison panel is open');
  assert.match(
    text($(m.w, '#lab-compare-out .lab-result-summary')),
    /^Run 2 differs from Run 1 in developer strength: stronger\./
  );
  m.close();
});

test('UX-B run lock: a run cited by a report entry, a measurement or a revealed proposal keeps its log; the copy still works', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  $(w, '#lab-do-step').click();
  $(w, '#lab-do-step').click();
  const state = w.CortexLab.getState();
  assert.equal(state.runs['run-1'].events.length, 2);
  assert.equal($(w, '#lab-run-locked'), null);
  const cite = async entry => {
    state.notebook.entries.length = 0;
    state.measurementOrder.length = 0;
    for (const id of Object.keys(state.measurements)) delete state.measurements[id];
    for (const id of Object.keys(state.experiments)) delete state.experiments[id];
    state.experimentOrder.length = 0;
    entry();
    await w.renderLabEntry();
    return $(w, '#lab-run-locked');
  };
  let notice = await cite(() =>
    state.notebook.entries.push({
      id: 'entry-1',
      type: 'simulated',
      section: 'methods',
      runId: 'run-1',
      label: 'no-basis',
      text: 'noted',
    })
  );
  assert.match(text(notice), /cited by report entry 1, so its log cannot change/);
  assert.ok($(w, '#lab-do-step').disabled, 'Do this step disabled');
  assert.ok($(w, '#lab-run-all').disabled, 'Run all disabled');
  assert.equal(w.labDropHint(w.LAB.lab, { runId: 'run-1' }, 'silver-impregnation'), 'This run is locked');
  $(w, '#lab-history-toggle').click();
  assert.ok($(w, '#lab-note-add').disabled && $(w, '#lab-note-text').disabled, 'Add note disabled');
  $(w, '#lab-note-text').value = 'late';
  $(w, '#lab-note-form').dispatchEvent(submit(w));
  assert.equal(state.runs['run-1'].events.length, 2, 'no event was appended');
  assert.ok($(w, '#lab-resolve-out .lab-result-card'), 'the result still shows');
  notice = await cite(() => {
    state.measurements['measurement-1'] = { id: 'measurement-1', runId: 'run-1', measurementId: 'contrast-ordinal' };
    state.measurementOrder.push('measurement-1');
  });
  assert.match(text(notice), /measurement 1/);
  notice = await cite(() => w.CortexLab.newExperiment({ baselineRunId: 'run-1', experimentalRunId: 'run-1' }));
  assert.equal(notice, null, 'a draft proposal does not lock its runs');
  assert.equal($(w, '#lab-do-step').disabled, false);
  state.experiments[state.experimentOrder[0]].status = 'revealed';
  await w.renderLabEntry();
  assert.match(text($(w, '#lab-run-locked')), /experiment 1 \(revealed\)/);
  assert.doesNotMatch(
    text($(w, '#lab-run-locked')),
    /entry-|exp-|measurement-|proposal/,
    'plain names for what cites it'
  );
  // KB-24: a titled experiment is named by its title
  state.experiments[state.experimentOrder[0]].title = 'Developer strength test';
  await w.renderLabEntry();
  assert.match(text($(w, '#lab-run-locked')), /your experiment “Developer strength test” \(revealed\)/);
  // CC-1: a revealed proposal's bench link (?exp=) does not open its pairing, and its runs never move
  const lockedExp = state.experimentOrder[0];
  const before = JSON.stringify(state.experiments[lockedExp]);
  h.run(`labAttachRunsToExperiment(${JSON.stringify(lockedExp)}, 'run-9', 'run-8')`);
  assert.equal(JSON.stringify(state.experiments[lockedExp]), before, 'a revealed design keeps its runs');
  w.history.pushState({}, '', `/lab?view=bench&run=run-1&exp=${lockedExp}`);
  await w.renderLabEntry();
  assert.equal($(w, '#lab-pair'), null, 'no pairing panel for a revealed proposal');
  assert.match(text($(w, '#lab-live')), /This proposal is revealed; its runs are locked\./);
  // a proposal pairing on a locked step-less baseline compares it as it is
  const bare = w.CortexLab.newRun({ specimenId: 'SPEC-SYN-AD-01', label: 'bare' });
  state.notebook.entries.push({
    id: 'entry-2',
    type: 'simulated',
    section: 'methods',
    runId: bare.id,
    label: 'no-basis',
  });
  // UX-POLISH: "Make the runs for me" (?exp= on a draft without its runs) makes the pair itself, sealed; a
  // locked, step-less run it names is not used as the baseline (a new standard run is), and no pairing
  // panel opens
  const exp = w.CortexLab.newExperiment({
    baselineRunId: bare.id,
    independentVariable: 'Developer strength: stronger', // UX-LAST: the bench's words, read exactly
  });
  h.close();
  const p = harness({
    url: `http://localhost/lab?view=bench&run=${bare.id}&exp=${exp.id}`,
    store: new Map([[STATE_KEY, h.store.get(STATE_KEY)]]),
  });
  await p.w.renderLabEntry();
  const s2 = p.w.CortexLab.getState();
  assert.equal(s2.runs[bare.id].events.length, 0, 'the locked run kept its empty log');
  const [base, copy] = s2.runOrder.slice(-2);
  assert.notEqual(base, bare.id);
  assert.deepEqual([s2.experiments[exp.id].baselineRunId, s2.experiments[exp.id].experimentalRunId], [base, copy]);
  assert.deepEqual([s2.runs[base].events.length, s2.runs[copy].events.length], [9, 9], 'both run in full');
  assert.equal(s2.runs[copy].params.development.strength, 'strong', 'the change the experiment names');
  assert.deepEqual({ ...s2.sealed }, { [base]: exp.id, [copy]: exp.id });
  assert.equal($(p.w, '#lab-pair'), null, 'no pairing panel');
  assert.equal(p.w.document.activeElement.id, 'lab-sealed-ready');
  p.close();
});
test('M2: after a reveal onSave keeps the design fields and takes only interpretation, status, title, limitations', async () => {
  const h = harness({ url: 'http://localhost/lab?view=designer&exp=exp-1' });
  const { w } = h;
  let captured = null;
  w.CortexLabNotebook = {
    mountDesigner(host, opts) {
      captured = opts;
      return { destroy() {} };
    },
  };
  const revealed = w.CortexLab.newExperiment({
    status: 'revealed',
    question: 'Q?',
    hypothesis: 'H',
    predictions: { expected: 'e', negligible: 'n', opposite: 'o' },
    baselineRunId: 'run-1',
    experimentalRunId: 'run-2',
  });
  await w.renderLabEntry();
  assert.equal(captured.experimentId, 'exp-1');
  assert.equal(captured.state, w.CortexLab.getState(), 'an existing experiment gets the shared state');
  const result = captured.onSave({
    ...revealed,
    question: 'rewritten after seeing the outcome',
    hypothesis: 'rewritten',
    predictions: { expected: 'changed', negligible: 'n', opposite: 'o' },
    baselineRunId: 'run-9',
    title: 'Titled',
    limitations: 'Synthetic specimens only.',
    interpretation: { supports: 's', failsToEstablish: 'f', next: '' },
    status: 'revealed',
  });
  const stored = w.CortexLab.getState().experiments['exp-1'];
  assert.equal(stored.question, 'Q?');
  assert.equal(stored.hypothesis, 'H');
  assert.equal(stored.predictions.expected, 'e');
  assert.equal(stored.baselineRunId, 'run-1');
  assert.equal(stored.title, 'Titled');
  assert.equal(stored.limitations, 'Synthetic specimens only.');
  assert.deepEqual(stored.interpretation, { supports: 's', failsToEstablish: 'f', next: '' });
  assert.equal(stored.status, 'revealed');
  assert.match(result.message, /only the title, limitations and interpretation can change/);
  assert.equal(JSON.parse(h.store.get(STATE_KEY)).experiments['exp-1'].question, 'Q?', 'persisted copy untouched');
  captured.onSave({ ...stored, status: 'draft' });
  assert.equal(stored.status, 'revealed', 'never back to draft');
  const done = captured.onSave({ ...stored, interpretation: { supports: 's', failsToEstablish: 'f', next: 'n' } });
  assert.equal(stored.status, 'done', 'a complete interpretation promotes to done');
  assert.equal(done.message, undefined, 'nothing was refused');
  captured.onSave({
    ...stored,
    status: 'revealed',
    interpretation: { supports: 's', failsToEstablish: '', next: 'n' },
  });
  assert.equal(stored.status, 'revealed', 'clearing an answer demotes to revealed');
  // a draft still takes every field, and a save without an id allocates one
  const draft = w.CortexLab.newExperiment({ question: 'draft q' });
  captured.onSave({ ...draft, question: 'edited', hypothesis: 'new h' });
  assert.equal(w.CortexLab.getState().experiments[draft.id].question, 'edited');
  const fresh = captured.onSave({ id: null, status: 'draft', question: 'third' });
  assert.equal(fresh.id, 'exp-3');
  assert.deepEqual(Array.from(w.CortexLab.getState().experimentOrder), ['exp-1', 'exp-2', 'exp-3']);
  h.close();
});

test('m4: ?exp=new mounts a blank draft beside saved proposals; its first edit allocates a new id', async () => {
  const h = harness({ url: 'http://localhost/lab?view=designer&exp=new', notebook: true });
  const { w } = h;
  w.CortexLab.newExperiment({ question: 'existing question' }); // exp-1, the newest
  await w.renderLabEntry();
  const link = $(w, '#lab-designer-new');
  assert.ok(link, 'Start a new design in the designer header');
  assert.equal(text(link), 'Start a new design');
  assert.equal(new URL(link.href).searchParams.get('exp'), 'new');
  assert.equal(w.CortexLab.url({ view: 'designer', exp: 'new' }), '/lab?view=designer&exp=new');
  assert.ok(link.closest('.lab-backlink'), 'a text link beside the back link');
  assert.ok($(w, '#lab-designer-host .labn-designer'), 'the real designer mounted');
  const question = $(w, '[data-labn-field="question"]');
  assert.equal(question.value, '', 'blank draft, not exp-1');
  question.value = 'second question';
  question.dispatchEvent(new w.Event('input', { bubbles: true }));
  w.pauseLabTools(); // destroys the handle, which flushes the debounced save
  const state = w.CortexLab.getState();
  assert.deepEqual(Array.from(state.experimentOrder), ['exp-1', 'exp-2']);
  // CC-3: the first save gives ?exp=new the design's own id, so a reload or Back finds it again
  assert.equal(new URLSearchParams(w.location.search).get('exp'), 'exp-2');
  assert.equal(new URLSearchParams(w.location.search).get('view'), 'designer');
  assert.equal(state.experiments['exp-2'].question, 'second question');
  assert.equal(state.experiments['exp-2'].status, 'draft');
  assert.equal(state.experiments['exp-1'].question, 'existing question', 'the saved proposal is untouched');
  h.close();
  // without ?exp the designer still opens the newest proposal
  const again = harness({ url: 'http://localhost/lab?view=designer', notebook: true });
  again.w.CortexLab.newExperiment({ question: 'only one' });
  await again.w.renderLabEntry();
  assert.equal($(again.w, '[data-labn-field="question"]').value, 'only one');
  again.close();
  // M5 (design) and M6 (predictions) offer the way into a second proposal, one link per step screen,
  // beside the designer at the wizard step the activity step writes
  // SIMPLE: the designer has two screens; M5 lands on Plan (1), M6 on Predict and reveal (2)
  for (const [id, steps, wizard] of [
    ['M5', [1, 2, 3], '1'],
    ['M6', [1], '2'],
  ]) {
    for (const n of steps) {
      const m = harness({ url: `http://localhost/lab?view=module:${id}&step=${n}` });
      await m.w.renderLabEntry();
      const links = $$(m.w, '.lab-mstep-tool a');
      assert.equal(
        links.filter(a => text(a) === 'Start a new design').length,
        1,
        `${id} step ${n}: one Start a new design link`
      );
      const open = links.find(a => a.classList.contains('btn'));
      assert.equal(new URL(open.href).searchParams.get('step'), wizard, `${id} step ${n}: wizard step ${wizard}`);
      m.close();
    }
  }
  // the designer view passes ?step= to the wizard (1-4 only)
  for (const [step, expected] of [
    ['3', 3],
    ['9', undefined],
  ]) {
    const d = harness({ url: `http://localhost/lab?view=designer&step=${step}` });
    let opts = null;
    d.w.CortexLabNotebook = {
      mountDesigner(host, o) {
        opts = o;
        return { destroy() {} };
      },
    };
    await d.w.renderLabEntry();
    assert.equal(opts.step, expected, `?step=${step}`);
    d.close();
  }
});

test('UX-E host views: microscope, report and designer show a back link, one h1 and a one-sentence lede, then the module; the microscope keeps its run picker behind a link and, without the viewer, a badge + summary card per run', async () => {
  const seed = harness({ url: 'http://localhost/lab?view=bench' });
  seed.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await seed.w.renderLabEntry();
  $(seed.w, '#lab-newrun').dispatchEvent(submit(seed.w));
  $(seed.w, '#lab-run-all').click();
  const store = seed.store.get(STATE_KEY);
  seed.close();
  for (const [view, h1, back] of [
    ['microscope&run=run-1', 'Microscope', 'bench'],
    ['notebook', 'My report', 'home'],
    ['designer', 'Design your experiment', 'home'],
  ]) {
    const h = harness({ url: `http://localhost/lab?view=${view}`, store: new Map([[STATE_KEY, store]]) });
    const { w } = h;
    await w.renderLabEntry();
    assert.equal(text($(w, 'h1')), h1);
    const lede = text($(w, '.lab-lede'));
    assert.equal(lede.split(/(?<=[.!?])\s/).length, 1, `${view}: one sentence (${lede})`);
    assert.equal(viewOf($(w, '.lab-backlink a')) || 'home', back, `${view}: back link`);
    assert.equal($(w, '.lab-endbtns'), null, `${view}: no second set of buttons`);
    assert.doesNotMatch(visibleText(w), ENGINE_TOKENS, view);
    h.close();
  }
  // the microscope lede carries the darker-is-not-better note the viewer relies on (UX-C-4)
  const scope = harness({
    url: 'http://localhost/lab?view=microscope&run=run-1',
    store: new Map([[STATE_KEY, store]]),
  });
  await scope.w.renderLabEntry();
  assert.match(text($(scope.w, '.lab-lede')), /darker does not mean more protein, more pathology or a better method/);
  assert.equal($(scope.w, '#lab-scope-pick'), null, 'the picker waits behind its link');
  $(scope.w, '[data-lab-drawer="scope-pick"] .lab-drawer-btn').click();
  assert.equal($(scope.w, '#lab-scope-a').value, 'run-1');
  // no viewer loaded: one result card per run (badge with the engine label, plain summary, Why?)
  const card = $(scope.w, '#lab-scope-host .lab-result-card');
  assert.ok(card.querySelector('.lab-banner .lab-badge[data-lab-label="illustrative-synthetic"]'));
  assert.match(text(card.querySelector('.lab-result-summary')), /visible silver/);
  assert.ok(card.querySelector('[data-lab-why="result"]'));
  assert.equal($(scope.w, '.lab-outcome'), null, 'the engine table view is gone');
  scope.close();
  // no run picked: the picker is open
  const none = harness({ url: 'http://localhost/lab?view=microscope', store: new Map([[STATE_KEY, store]]) });
  await none.w.renderLabEntry();
  assert.ok($(none.w, '#lab-scope-pick'));
  none.close();
});

test('m3: data-lab-go links added after the view rendered still navigate in-app (one delegated listener)', async () => {
  const h = harness();
  const { w } = h;
  await w.renderLabEntry();
  const late = w.el('<a data-lab-go href="/lab?view=modules">late link</a>');
  $(w, 'main').appendChild(late);
  const click = new w.MouseEvent('click', { bubbles: true, cancelable: true });
  late.dispatchEvent(click);
  assert.ok(click.defaultPrevented, 'the full page load is prevented');
  assert.equal(w.location.search, '?view=modules');
  for (let i = 0; i < 50 && !$(w, 'main.lab-view-modules'); i++) await new Promise(r => setTimeout(r, 10));
  assert.ok($(w, 'main.lab-view-modules'), 'the modules view rendered in place');
  const modified = new w.MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
  $(w, 'a[data-lab-go]').dispatchEvent(modified);
  assert.equal(modified.defaultPrevented, false, 'modifier clicks are left to the browser');
  h.close();
});

test('microscope hosts: onClose and headingLevel are passed everywhere the viewer mounts', async () => {
  const mounts = [];
  const thumbs = [];
  const stub = w => {
    w.CortexLabMicroscope = {
      mount(host, opts) {
        mounts.push({ host: host.id || host.dataset.labSlot || host.className, opts });
        host.innerHTML = '<div class="labm"></div>';
        return { destroy() {} };
      },
      renderSynthetic(canvas, opts) {
        thumbs.push({ canvas, opts });
        return { width: opts.width, height: opts.height };
      },
    };
  };
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  stub(w);
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  $(w, '#lab-newrun').dispatchEvent(submit(w));
  $(w, '#lab-run-all').click();
  // UX-B: the result card's thumbnail is the microscope's own renderer (its label plate kept)
  const thumb = thumbs.at(-1);
  assert.ok(thumb, 'the thumbnail was painted');
  assert.ok(thumb.canvas.closest('#lab-scope-btn .lab-result-pic'));
  assert.equal(thumb.opts.outcome.label, 'illustrative-synthetic');
  assert.equal(thumb.opts.specimen.id, 'SPEC-SYN-AD-01');
  assert.equal(thumb.opts.tag, false);
  assert.notEqual(thumb.opts.banner, false, 'the in-canvas label plate stays');
  assert.equal(thumb.canvas.getAttribute('aria-hidden'), null);
  assert.equal($(w, '#lab-scope-btn .lab-result-pic').getAttribute('aria-hidden'), 'true');
  assert.equal(text($(w, '#lab-scope-btn')), 'Open in the microscope');
  $(w, '#lab-scope-btn').click();
  const inline = mounts.find(m => m.host === 'lab-scope-inline');
  assert.ok(inline, 'inline mount');
  assert.equal(inline.opts.headingLevel, 3);
  assert.equal(typeof inline.opts.onClose, 'function');
  assert.equal($(w, '#lab-scope-inline').getAttribute('aria-label'), 'Microscope on Run 1', 'B8');
  assert.equal(viewOf($(w, '.lab-scope-full a')), 'microscope');
  assert.equal(text($(w, '#lab-scope-btn')), 'Close the microscope');
  assert.equal($(w, '#lab-scope-btn').getAttribute('aria-expanded'), 'true');
  inline.opts.onClose(); // Esc inside the viewer
  assert.equal($(w, '#lab-scope-btn').getAttribute('aria-expanded'), 'false', 'the inline viewer closed');
  assert.equal(w.document.activeElement.id, 'lab-scope-btn', 'focus returns to the toggle');
  assert.equal($(w, '#lab-scope-inline .labm'), null);
  $(w, '#lab-compare-open').click();
  $(w, '#lab-pair-form').dispatchEvent(submit(w));
  $(w, '#lab-compare-scope').click();
  const compare = mounts.find(m => m.host === 'lab-scope-compare');
  assert.ok(compare, 'compare mount');
  assert.equal(compare.opts.headingLevel, 3);
  assert.equal(compare.opts.runs.length, 2);
  assert.equal(
    $(w, '#lab-scope-compare').getAttribute('aria-label'),
    'Microscope compare: Run 1 and Run 2 · copy of Run 1 · Development time: longer'
  );
  compare.opts.onClose();
  assert.equal($(w, '#lab-compare-scope').getAttribute('aria-expanded'), 'false');
  assert.equal(w.document.activeElement.id, 'lab-compare-scope');
  h.close();
  const full = harness({
    url: 'http://localhost/lab?view=microscope&run=run-1&tab=layers',
    store: new Map([[STATE_KEY, h.store.get(STATE_KEY)]]),
  });
  stub(full.w);
  await full.w.renderLabEntry();
  const view = mounts.find(m => m.host === 'lab-scope-host');
  assert.ok(view, 'full view mount');
  assert.equal(view.opts.headingLevel, 2);
  assert.equal(view.opts.tab, 'layers');
  view.opts.onClose();
  for (let i = 0; i < 50 && !$(full.w, 'main.lab-view-bench'); i++) await new Promise(r => setTimeout(r, 10));
  assert.ok($(full.w, 'main.lab-view-bench'), 'Esc on the full view returns to the bench');
  assert.equal(new URLSearchParams(full.w.location.search).get('run'), 'run-1');
  full.close();
});

test('pauseLabTools runs registered pausers, removes a stray print view, and the 3D mode falls back without WebGL2', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  let paused = 0;
  w.LAB.pausers.push(() => paused++);
  await w.renderLabEntry();
  w.document.body.appendChild(w.el('<section class="labn labn-print-view" role="dialog">print</section>'));
  w.document.body.classList.add('labn-printing');
  w.pauseLabTools();
  assert.equal(paused, 2, 'entry pauses once, explicit call pauses again');
  assert.equal($(w, '.labn-print-view'), null, 'm5: the print view does not survive navigation');
  assert.equal(w.document.body.classList.contains('labn-printing'), false);
  $(w, '#lab-safety-ack').click();
  $(w, '#lab-newrun').dispatchEvent(submit(w));
  assert.match(text($(w, '.lab-mode-reason')), /cannot run the 3D bench/);
  assert.ok($(w, '[data-lab-mode="3d"]').disabled);
  assert.equal($(w, 'main').dataset.mode, 'list');
  assert.equal(w.CortexLab.getState().mode, 'list');
  h.close();
});

test('study-backup: lab free text with angle-bracket shorthand exports and restores; keys and other fields stay strict', async () => {
  const Backup = require('../study-backup.js');
  const doc = new JSDOM('').window.document;
  const o = {
    crypto: require('node:crypto').webcrypto,
    now: ACK,
    checkMarkup: value => Backup.safeMarkup(value, doc),
  };
  assert.equal(Backup.safeMarkup('Na<K and K>Cl', doc), false, 'the HTML parser reads <K and K> as a tag');
  const state = {
    v: 1,
    mode: 'list',
    safetyAcknowledgedAt: ACK,
    activeSpecimenId: 'SPEC-SYN-AD-01',
    runs: {
      'run-1': {
        id: 'run-1',
        specimenId: 'SPEC-SYN-AD-01',
        method: 'bielschowsky-modified',
        label: 'pair of run-1: development.endpoint=extended',
        params: { development: { endpoint: 'extended' }, toning: false },
        events: [
          { seq: 1, type: 'set-params', params: { development: { endpoint: 'extended' } } },
          { seq: 2, type: 'note', text: 'Na<K in the bath; K>Cl after' },
        ],
      },
    },
    runOrder: ['run-1'],
    experiments: {
      'exp-1': { id: 'exp-1', status: 'draft', hypothesis: 'if t<5 then <no change', baselineRunId: 'run-1' },
    },
    experimentOrder: ['exp-1'],
    notebook: { v: 1, entries: [{ id: 'entry-1', type: 'reflection', section: 'methods', text: 'Na<K and K>Cl' }] },
    measurements: { 'measurement-1': { id: 'measurement-1', runId: 'run-1', note: 'contrast <2 steps', value: 1 } },
    measurementOrder: ['measurement-1'],
    moduleProgress: {
      M1: { fields: { statement: 'If x<y then z' }, done: false, runs: { 'ad-like-section-sop-defaults': 'run-1' } },
    },
    counters: { run: 1, exp: 1, entry: 1, measurement: 1 },
    settings: { reducedMotion: 'auto', highContrast: false, objective: 10 },
  };
  const data = { [STATE_KEY]: JSON.stringify(state) };
  const file = await Backup.create(data, 'test', o);
  assert.deepEqual((await Backup.parse(file, o)).data, data, 'exports verbatim and restores');
  await Backup.create(data, 'test', { crypto: o.crypto, now: o.now }); // no markup validator at all
  // outside the five free-text subtrees the record is as strict as before
  await assert.rejects(
    Backup.create(
      { [STATE_KEY]: JSON.stringify({ v: 1, settings: { skin: '<script>alert(1)</script>' } }) },
      'test',
      o
    ),
    /HTML/
  );
  // which is why module runs are keyed by slug: a label key would make the whole backup unrestorable
  await assert.rejects(
    Backup.create(
      { [STATE_KEY]: JSON.stringify({ v: 1, moduleProgress: { M2: { runs: { 'Bad & "key"': 'run-1' } } } }) },
      'test',
      o
    ),
    /unsafe record key/
  );
  await assert.rejects(
    Backup.create({ [STATE_KEY]: JSON.stringify({ v: 1, runs: { 'run-1': { id: 'x" onfocus=bad' } } }) }, 'test', o),
    /identifier/
  );
});

test('lab.css: link colour scoped away from buttons, solid buttons white, chip source contrast, focus and tap-target rules', () => {
  const css = read('lab.css');
  assert.ok(css.includes('.lab-page a:not(.btn) { color: var(--blue);'), 'C1: links only');
  assert.doesNotMatch(css, /\.lab-page a \{/, 'C1: no bare anchor rule');
  assert.ok(css.includes('.lab-page .btn-solid { color: #fff; }'), 'C1: solid CTAs are white on dark');
  // CC-12: rules for classes nothing renders any more are gone
  assert.doesNotMatch(
    css,
    /\.lab-chip-src|\.lab-chip-code|\.lab-chip-pending|\.lab-quantities|\.lab-change-none|\.lab-field\.lab-textarea|\.lab-station-n|\.lab-station-pick|\.lab-perform|\.lab-pick-|\.lab-redo-|\.lab-badge-pending|\.lab-setup-mode/
  );
  assert.ok(
    css.includes('.lab-page summary:focus-visible { outline: 2px solid var(--blue); outline-offset: 3px; }'),
    'A10'
  );
  assert.match(
    css,
    /@media \(forced-colors: active\) \{\s*\.lab-chip\[aria-expanded="true"\] \{ outline: 2px solid Highlight;/,
    'C4'
  );
  const touch = css.slice(css.indexOf('@media (max-width: 768px)'));
  assert.match(touch, /\.lab-chip:not\(\.lab-chip-static\) \{ min-height: 44px;/, 'E1 chips');
  assert.match(touch, /\.lab-drawer-btn \{ min-height: 44px; \}/, 'E1 buttons');
  assert.match(touch, /\.lab-page summary \{ min-height: 44px;/, 'E1 summary');
  assert.match(touch, /\.lab-check \{ min-height: 44px; \}/, 'E1 checkbox label');
  const phone = css.slice(css.indexOf('@media (max-width: 560px)'), css.indexOf('@media (max-width: 380px)'));
  assert.match(
    phone,
    /\.lab-field select, \.lab-field input\[type="text"\], \.lab-field textarea \{ font-size: 16px; \}/,
    'E2'
  );
});

test('UX-A lab.css: five badge styles (never colour alone), one card style, 44px progress and link targets on touch widths, forced colors', () => {
  const css = read('lab.css');
  const ux = css.slice(css.indexOf('/* ---------- UX-A:'));
  assert.ok(ux.length > 100, 'the UX-A block exists');
  for (const kind of BADGE_KINDS) assert.match(ux, new RegExp(`\\.lab-badge-${kind} \\{`), kind);
  assert.match(ux, /\.lab-badge-simulated \{ border-color: var\(--amber\); color: var\(--amber\); \}/, 'amber outline');
  assert.match(ux, /\.lab-badge-not-modeled \{[^}]*background: var\(--line\)/, 'gray fill');
  const card = ux.match(/\.lab-card \{([^}]*)\}/)[1];
  for (const rule of ['padding: 20px', 'border: 1px solid var(--line)', 'border-radius: var(--radius-sm)'])
    assert.ok(card.includes(rule), `one card style: ${rule}`);
  const touch = ux.slice(ux.indexOf('@media (max-width: 768px)'));
  assert.match(touch, /\.lab-progress-seg \{ min-height: 44px; \}/);
  assert.match(touch, /\.lab-home-links a, \.lab-honesty a \{[^}]*min-height: 44px; \}/);
  assert.match(
    touch,
    /\.lab-safety \.lab-drawer-btn, \.lab-linkbtn, \.lab-safety-notes-details summary \{ min-height: 44px; \}/
  );
  assert.match(ux, /@media \(forced-colors: active\) \{\s*\.lab-badge \{ border-color: CanvasText; \}/);
  assert.doesNotMatch(
    css,
    /\.lab-legend \{|\.lab-hazard-list|\.lab-clip-cta/,
    'rules for removed home pieces are gone'
  );
});

test('UX-B lab.css: hidden means hidden, 44px bench targets on touch widths, a fixed side sheet (bottom sheet on phones), forced colors, no dead overlay rules', () => {
  const css = read('lab.css');
  const ux = css.slice(css.indexOf('/* ---------- UX-B:'));
  assert.ok(ux.length > 100, 'the UX-B block exists');
  assert.match(ux, /\.lab-page \[hidden\] \{ display: none !important; \}/, 'a hidden clip row or drawer never shows');
  // A11Y-02: the sheet starts under the top bar; room is kept for it at 900px and up; below that it is
  // a full-width modal under the top bar
  assert.match(ux, /\.lab-sheet \{ position: fixed; z-index: 45; top: var\(--lab-topbar-h, 64px\);/);
  assert.match(
    ux,
    /@media \(min-width: 900px\) \{\s*#app main\.lab-view-bench\.lab-sheet-side \{ padding-right: max\(28px, calc\(444px - max\(0px, \(100vw - 1120px\) \/ 2\)\)\); \}/
  );
  assert.match(
    ux,
    /@media \(max-width: 899\.98px\) \{\s*\.lab-sheet \{ left: 0; width: auto;/,
    'full width on narrow screens'
  );
  assert.match(ux, /\.lab-sheet\[aria-modal="true"\] \{ left: 0; width: auto;/);
  // KB-01 / A11Y-04: scrolling clears the measured top bar; no fixed 72px guess remains
  assert.match(css, /html:has\(\.lab-page\) \{ scroll-padding-top: calc\(var\(--lab-topbar-h, 64px\) \+ 8px\); \}/);
  assert.doesNotMatch(css, /scroll-margin-top: 72px|top: 72px/);
  // A11Y-03: the sticky bars only on a tall enough phone screen, with room kept under them
  const tall = css.slice(css.indexOf('@media (max-width: 560px) and (min-height: 520px)'));
  // UX-SMALL: only in list mode (in 3D it stays in the flow under the stage, which nothing covers), with
  // room under a focused control for a bar that wraps to three lines
  assert.match(
    tall,
    /#lab-do:not\(\.lab-bench-3d\) #lab-do-step \{ position: sticky; bottom: calc\(10px \+ env\(safe-area-inset-bottom\)\); z-index: 4; \}\s*html:has\(#lab-do:not\(\.lab-bench-3d\) #lab-do-step\) \{ scroll-padding-bottom: calc\(112px \+ env\(safe-area-inset-bottom\)\); \}/
  );
  assert.doesNotMatch(css, /(^|[\n{,]\s*)#lab-do-step \{ position: sticky/, 'never sticky over the 3D stage');
  assert.doesNotMatch(css, /html:has\(\.lab-view-bench\) \{ scroll-padding-bottom/);
  assert.match(
    css,
    /@media \(max-width: 560px\) and \(min-height: 520px\) \{\s*\.lab-mstep-nav \{ position: sticky; bottom: 0; z-index: 4; \}\s*html:has\(\.lab-view-module\) \{ scroll-padding-bottom: 88px; \}/
  );
  assert.doesNotMatch(css, /scroll-margin-bottom: 96px/);
  // A11Y-05: a drawer in a flex row may shrink, so its table scrolls inside instead of widening the page
  assert.match(
    css,
    /\.lab-do-more \.lab-drawer, \.lab-result-links \.lab-drawer \{ flex: 1 0 100%; order: 10; min-width: 0;/
  );
  // A11Y-09: forced colors keep link-styled buttons as links. (A11Y-10's filled 3D | List segment is gone
  // with the segmented control: the one view toggle names its target, UX-R2.)
  const forced = ux.slice(ux.lastIndexOf('@media (forced-colors: active)', ux.indexOf('/* UX-B polish')));
  assert.doesNotMatch(css, /\.lab-segmented/, 'no rule for the removed segmented control');
  assert.match(
    forced,
    /\.lab-linkbtn, \.lab-result-links \.lab-drawer-btn, .*\.lab-result-thumb-text \{ color: LinkText; text-decoration: underline; \}/
  );
  // KB-03: the focused result or comparison badge shows a ring for keyboard users
  assert.match(css, /\.lab-result-card > \.lab-banner:focus-visible \{ outline: 2px solid var\(--blue\);/);
  // A11Y-08: a 44px replay slider on touch widths
  assert.match(css, /#lab-replay-range \{ height: 44px; \}/);
  assert.match(
    ux,
    /#app main\.lab-view-bench \{ animation-fill-mode: backwards; \}/,
    'no lingering transform traps the fixed sheet'
  );
  const touch = ux.slice(ux.indexOf('@media (max-width: 768px)'));
  assert.match(
    touch,
    /\.lab-page \.btn, \.lab-head-btn, \.lab-seg-option span, \.lab-result-thumb, \.lab-do-reduced \{ min-height: 44px; \}/
  );
  assert.match(
    touch,
    /\.lab-do-more \.lab-drawer-btn, \.lab-result-links \.lab-drawer-btn, \.lab-page \.lab-result-links > a\.lab-result-design \{ min-height: 44px; \}/
  );
  assert.match(
    ux,
    /\.lab-seg-option input:checked \+ span::before \{ content: "\\2713";/,
    'the chosen value carries a check, not only a fill'
  );
  assert.match(
    ux,
    /\.lab-seg-option input:focus-visible \+ span \{ outline: 2px solid var\(--blue\); outline-offset: 3px; \}/
  );
  assert.match(
    ux,
    /@media \(forced-colors: active\) \{\s*\.lab-seg-option input:checked \+ span, \.lab-step-next, \.lab-specimen-card:has\(input:checked\) \{ outline: 2px solid Highlight;/
  );
  assert.match(css, /#lab-do-step \{ position: sticky; bottom:/, 'the primary action stays in reach on phones');
  assert.doesNotMatch(
    css,
    /\.lab-overlay-card|\.lab-overlay-log|\.lab-perform-3d|\.lab-bench-grid|\.lab-compare-grid|\.lab-safety-row/,
    'rules for removed bench pieces are gone'
  );
});

/* ---------- SHELL-8: the tissue clip inside the 3D bench (contract §7.1) ---------- */
const CLIP = JSON.parse(read('data/lab/clip.json'));
// A bench module whose handle records every call; `clip: false` builds one without the §7.1 methods.
function fakeBench({ clip = true } = {}) {
  const calls = [];
  let api = null;
  let state = { phase: 'bench', scene: null, index: -1, playing: false, ended: false, loaded: false };
  const handle = {
    ok: true,
    element: null,
    destroy: () => calls.push(['destroy']),
    goToStation: id => {
      calls.push(['goToStation', id]);
      return Promise.resolve(true);
    },
    replay: () => Promise.resolve(true),
    setReducedMotion: v => calls.push(['setReducedMotion', v]),
    setRun: run => calls.push(['setRun', run ? run.id : null]),
    hotspots: () => [],
    stations: () => [],
    // G1 (FIX3): whether the rack is on the canvas; tests turn it off with handle.rackShown = false
    rackShown: true,
    rackOnScreen: () => handle.rackShown,
    debug: {},
  };
  if (clip)
    Object.assign(handle, {
      intro() {
        calls.push(['intro']);
        state = { phase: 'intro', scene: 'brain-overview', index: 0, playing: true, ended: false, loaded: false };
        api.onScene('brain-overview', 'Caption one.', 0);
        return Promise.resolve(true);
      },
      dive(run, outcome, frames) {
        calls.push(['dive', run, outcome, frames]);
        state = { phase: 'dive', scene: 'dive', index: 0, playing: true, ended: false };
        api.onScene('dive', 'Descending.', 0);
        return Promise.resolve(true);
      },
      play() {
        calls.push(['play']);
        state.playing = true;
      },
      pause() {
        calls.push(['pause']);
        state.playing = false;
      },
      seek(id) {
        calls.push(['seek', id]);
        state.scene = id;
        api.onScene(id, `Scene ${id}.`, 0);
      },
      skip() {
        calls.push(['skip']);
        const which = state.phase;
        state.playing = false;
        state.ended = true;
        // Like the real handle, an ended intro returns to the bench with the section on the slide.
        if (which === 'intro') Object.assign(state, { phase: 'bench', loaded: true });
        api.onEnd(which);
      },
      explore() {
        calls.push(['explore']);
        state.phase = 'explore';
      },
      leaveExplore() {
        calls.push(['leaveExplore']);
        state.phase = 'dive';
      },
      surface() {
        calls.push(['surface']);
        state = { phase: 'bench', scene: null, index: -1, playing: false, ended: false, loaded: state.loaded };
      },
      clipState: () => ({ ...state }),
    });
  const module = {
    STATIONS: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'],
    async mountBench(container, options) {
      api = options;
      handle.element = container.ownerDocument.createElement('canvas');
      container.appendChild(handle.element);
      return handle;
    },
  };
  return { module, handle, calls, api: () => api, last: () => calls[calls.length - 1] };
}
const press = (w, node, key) =>
  node.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const mounted3d = (h, fake) => settled(h.w, () => h.w.LAB.bench === fake.handle);
// Lets the handle's settled promises run their re-sync before the window closes.
const flush = () => new Promise(r => setTimeout(r, 0));
// A jar's, the microscope's and the brain tray's click opens its sheet after LAB_JAR_SHEET_DELAY_MS (300).
const sheetDelay = () => new Promise(r => setTimeout(r, 340));

test('SHELL-8 / UX-B: ?view=bench&mode=3d&intro=1 switches to 3D, consumes the keys and auto-plays the intro; the clip block shows only while it plays', async () => {
  const fake = fakeBench();
  const h = harness({
    url: 'http://localhost/lab?view=bench&mode=3d&intro=1',
    benchModule: fake.module,
    webgl2: true,
  });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake), 'the fake bench mounted');
  assert.equal(w.CortexLab.getState().mode, '3d');
  assert.equal(JSON.parse(h.store.get(STATE_KEY)).mode, '3d', 'the mode is persisted like the switch');
  assert.equal(w.location.search, '?view=bench', 'mode and intro are consumed from the URL');
  assert.equal($(w, 'main').dataset.mode, '3d');
  assert.deepEqual(
    $$(w, '[data-lab-mode]').map(b => [b.id, b.dataset.labMode, text(b)]),
    [['lab-mode-toggle', 'list', 'Switch to list']],
    'in 3D the one toggle offers the list (UX-R2)'
  );
  assert.ok($(w, '#lab-bench-3d'), 'the stage renders without a run');
  assert.equal($$(w, 'h1').length, 1);
  assert.ok($(w, '#lab-3d-norun'), 'the steps wait for a run');
  assert.equal($(w, '#lab-do-step'), null);
  assert.equal(fake.handle.element.getAttribute('aria-hidden'), 'true');
  // "2. Do the steps" is the 3D section: stage full width, the clip block, the stations
  const section = $(w, '.lab-bench-3d');
  assert.equal(section.id, 'lab-do');
  assert.equal(section.parentElement.id, 'lab-bench-body');
  assert.equal(text(section.querySelector('h2')), 'The procedure');
  const wrap = $(w, '#lab-clip-stage');
  assert.equal(wrap.getAttribute('role'), 'group');
  assert.equal(wrap.getAttribute('aria-label'), 'Tissue clip stage', 'the wrapper is not named like the button row');
  assert.match(text($(w, '#lab-clip-keys')), /Escape skips the intro/);
  assert.ok(wrap.contains($(w, '#lab-bench-3d')), 'the wrapper holds the stage');
  assert.equal($(w, '#lab-clip-caption').getAttribute('aria-live'), 'polite');
  assert.equal($(w, '#lab-clip-transcript').tagName, 'DETAILS');
  assert.equal(text($(w, '#lab-clip-transcript summary')), 'Transcript');
  assert.deepEqual(
    $$(w, '#lab-clip-transcript li').map(li => li.dataset.labScene),
    Array.from(w.SilverLab.CLIP_SCENES)
  );
  assert.ok($$(w, '#lab-clip-transcript li p').length >= CLIP.items.length + 5, 'captions and sub-captions listed');
  assert.match(text($(w, '#lab-clip-transcript li[data-lab-scene="structures"]')), /Plaque core: /);
  // §11.2: the station row directly under the stage (above the HUD): one button per station in bench
  // order plus Whole bench, student titles without step numbers; aria-current on the current one
  const nav = $(w, '#lab-stations');
  assert.equal(nav.tagName, 'NAV');
  assert.equal(nav.getAttribute('aria-label'), 'Bench stations');
  assert.ok(
    nav.previousElementSibling.matches('.lab-clip-layout'),
    'directly under the stage’s layout (MODE-FIX-shell-16)'
  );
  assert.ok(!nav.closest('[role="group"]'), 'outside the clip stage’s group: its name and keys never describe the row');
  assert.ok(nav.nextElementSibling.matches('[data-lab-hud]'), 'above the HUD');
  assert.equal($(w, '#lab-station-select'), null);
  assert.equal($(w, '#lab-overlay'), null);
  assert.deepEqual(
    $$(w, '#lab-stations .lab-station-btn').map(b => [b.dataset.labStation, text(b)]),
    [
      ['S1', 'Remove the wax'],
      ['S2', 'First silver bath'],
      ['S3', 'Ammoniacal silver and develop'],
      ['S4', 'Gold and thiosulfate'],
      ['S5', 'Dehydrate and mount'],
      ['S6', 'Microscope'],
      ['S7', 'Waste and safety'],
      ['S8', 'Notebook'],
      ['overview', 'Whole bench'],
    ]
  );
  assert.ok(
    $$(w, '#lab-stations .lab-station-btn').every(b => !/[+/]|\bstep/.test(text(b))),
    'no shorthand, no step numbers'
  );
  assert.equal(nav.hidden, true, 'hidden while the intro plays (it shows in the bench phase, like the HUD)');
  // UX-R2 / §11.2: Play the intro and Reduce motion (and Read aloud) sit in ONE closed "3D options"
  // disclosure; the station picker left it; the tip stays in view
  const options = $(w, '.lab-stage-extras [data-lab-drawer="3d-options"]');
  const optionsBtn = options.querySelector('.lab-drawer-btn');
  assert.equal(text(optionsBtn), '3D options');
  assert.equal(optionsBtn.getAttribute('aria-expanded'), 'false');
  const optionsBody = $(w, `#${optionsBtn.getAttribute('aria-controls')}`);
  assert.equal(optionsBody.hidden, true);
  for (const sel of ['#lab-clip-intro', '#lab-3d-reduced', '#lab-3d-read-aloud'])
    assert.ok(optionsBody.querySelector(sel), `${sel} inside 3D options`);
  assert.equal(optionsBody.querySelector('select, .lab-station-btn'), null, 'nothing else in 3D options');
  assert.equal($(w, '.lab-stage-extras > .lab-stage-tip').closest('[hidden]'), null, 'the canvas tip stays shown');
  assert.equal(stationNamed(w), '', 'nothing is the current station yet');
  stationGo(w, 'S3');
  assert.deepEqual(fake.last(), ['goToStation', 'S3']);
  assert.deepEqual(fake.last(), ['goToStation', 'S3']);
  fake.api().onStation('S2');
  assert.equal(stationNamed(w), 'S2', 'the select follows the camera');
  assert.match(text($(w, '.lab-stage-tip')), /^Click a jar to read about its step; double-click it to do the step\./);
  assert.equal(
    $$(w, '#lab-hazard-card, #lab-inspect-card, #lab-3d-log').length,
    0,
    'the overlay cards and log strip are gone'
  );
  // the intro auto-played: caption, transcript marker, controls, label, no-run note, a focusable stage
  assert.equal(fake.calls.filter(c => c[0] === 'intro').length, 1);
  assert.equal(text($(w, '#lab-clip-caption')), 'Caption one.');
  assert.equal($(w, '#lab-clip-transcript li[aria-current="step"]').dataset.labScene, 'brain-overview');
  assert.equal(section.dataset.labClipPhase, 'intro');
  const controls = $(w, '#lab-clip-controls');
  assert.equal(controls.hidden, false);
  assert.equal(controls.getAttribute('role'), 'group');
  for (const id of ['lab-clip-play', 'lab-clip-prev', 'lab-clip-next', 'lab-clip-skip'])
    assert.equal($(w, `#${id}`).tagName, 'BUTTON', id);
  assert.ok($(w, '#lab-clip-explore').hidden && $(w, '#lab-clip-surface').hidden, 'tissue buttons only in the tissue');
  for (const sel of ['#lab-clip-transcript', '.lab-clip-banner'])
    assert.equal($(w, sel).hidden, false, `${sel} shows while the intro plays`);
  assert.equal(text($(w, '.lab-clip-banner')), CLIP.label, 'the label comes from clip.json');
  // K3: the clip label alone; the screen's one honesty line says that darker does not mean more
  assert.doesNotMatch(text($(w, '.lab-clip-banner')), /Darker does not mean/);
  assert.equal(wrap.getAttribute('tabindex'), '0', 'the stage is a tab stop while a clip plays');
  assert.equal($(w, '#lab-clip-intro').hidden, true, 'Play the intro is not offered while the intro plays (UX-R2)');
  // KB-02 / A11Y-07: the requested intro has the keyboard on its stage, not on the 3D toggle above
  assert.equal(w.document.activeElement, wrap, 'focus on the playing stage');
  const play = $(w, '#lab-clip-play');
  assert.equal(text(play), 'Pause');
  assert.equal(play.hasAttribute('aria-pressed'), false, 'F22: the Play/Pause label is the state');
  // F12: the no-run note is about the staining scenes, which the intro never shows
  assert.equal($(w, '#lab-clip-note').hidden, true, 'no staining-scenes note during the intro');
  assert.equal(text($(w, '#lab-clip-note')), CLIP.noRunCaption, 'no run: the dive says so');
  // keyboard on the stage wrapper
  press(w, wrap, ' ');
  assert.deepEqual(fake.last(), ['pause']);
  assert.equal(text(play), 'Play');
  press(w, wrap, ' ');
  assert.deepEqual(fake.last(), ['play']);
  press(w, wrap, 'ArrowRight');
  assert.deepEqual(fake.last(), ['seek', 'region']);
  assert.equal($(w, '#lab-clip-transcript li[aria-current="step"]').dataset.labScene, 'region');
  assert.equal(text($(w, '#lab-clip-caption')), 'Scene region.');
  press(w, wrap, 'ArrowLeft');
  assert.deepEqual(fake.last(), ['seek', 'brain-overview']);
  press(w, wrap, 'ArrowLeft');
  assert.deepEqual(fake.last(), ['seek', 'brain-overview'], 'clamped at the first intro scene');
  assert.equal($(w, '#lab-clip-ended').hidden, true, 'no "finished" line while it plays');
  const before = fake.calls.length;
  press(w, wrap, 'e');
  assert.equal(fake.calls.length, before, 'E does nothing during the intro');
  press(w, play, ' ');
  assert.equal(fake.calls.length, before, 'keys elsewhere do not drive the clip');
  // Skip ends the intro: back to the bench, the clip block leaves, the section-on-slide line shows
  play.focus();
  press(w, wrap, 's');
  assert.deepEqual(fake.last(), ['skip']);
  assert.equal(section.dataset.labClipPhase, 'bench');
  assert.equal(controls.hidden, true, 'controls only while the intro or the dive plays');
  for (const sel of ['.lab-clip-banner', '#lab-clip-note']) assert.equal($(w, sel).hidden, true, sel);
  // KB-14: the transcript stays reachable after the clip ends
  assert.equal($(w, '#lab-clip-transcript').hidden, false, 'the transcript stays once a clip has played');
  assert.ok($(w, '#lab-clip-caption').classList.contains('lab-sr-only'), 'the live caption stays, out of sight');
  assert.equal(wrap.getAttribute('tabindex'), '-1');
  assert.notEqual(w.document.activeElement, w.document.body, 'focus never drops to body when the row hides');
  assert.equal($(w, '#lab-clip-loaded').hidden, false, 'onEnd(intro) shows where the section is');
  assert.equal(text($(w, '#lab-clip-loaded')), 'Slide rack: Section on slide 1 (a drawing)', 'labeled (F8)');
  // F12: a visible line says the intro ended and what the bench waits for (never an order, D5 / FIX2)
  assert.equal($(w, '#lab-clip-ended').hidden, false);
  assert.equal(text($(w, '#lab-clip-ended')), 'Intro finished. No run yet: Start the run is under Your slide, above.');
  assert.match(text($(w, '#lab-live')), /^Intro finished\. No run yet: Start the run is under Your slide, above\./);
  press(w, wrap, 'ArrowRight');
  assert.deepEqual(fake.last(), ['seek', 'region'], 'an ended intro can still be stepped from the stage');
  // Play the intro sits under the stations; the specimen tray opens the side sheet with it too
  assert.equal(text($(w, '#lab-clip-intro')), 'Play the intro');
  assert.equal($(w, '#lab-clip-intro').hidden, false, 'offered again once the intro ended');
  $(w, '#lab-clip-intro').click();
  assert.deepEqual(fake.last(), ['intro']);
  assert.equal($(w, '#lab-clip-intro').hidden, true);
  assert.equal(w.document.activeElement, wrap, 'a started clip takes the keyboard to the stage');
  assert.equal($(w, '#lab-clip-ended').hidden, true, 'a replay hides the finished line');
  // A11Y-16: Escape skips the intro, as the key help says
  press(w, wrap, 'Escape');
  assert.deepEqual(fake.last(), ['skip']);
  assert.equal(section.dataset.labClipPhase, 'bench');
  $(w, '#lab-clip-intro').click();
  fake.api().onInspect('specimen');
  await sheetDelay(); // the tray's sheet waits for a double click, as a jar's does (D2)
  assert.equal($(w, '#lab-sheet').hidden, false);
  assert.equal(text($(w, '#lab-sheet-h')), 'Specimen tray');
  assert.equal(w.document.activeElement.id, 'lab-sheet-h');
  const tray = $(w, '#lab-sheet [data-lab-clip-intro]');
  assert.equal(text(tray), 'Play the intro');
  assert.equal(tray.hidden, true, 'the tray does not offer the intro while it plays');
  press(w, wrap, 'Escape');
  assert.equal(tray.hidden, false, 'offered once it ends');
  tray.click();
  assert.equal(fake.calls.filter(c => c[0] === 'intro').length, 4);
  // other bench objects open their own sheet; the safety objects list the station's notes (no badge, §11.7)
  fake.api().onInspect('waste-silver');
  assert.equal(text($(w, '#lab-sheet-h')), 'Silver waste');
  assert.ok($(w, '#lab-sheet .lab-hazards li'));
  assert.equal($(w, '#lab-sheet .lab-hazards .lab-badge'), null);
  assert.doesNotMatch(text($(w, '#lab-sheet')), /pending|instructor/i);
  // the reduced-motion checkbox persists the setting and reaches the handle
  const reduced = $(w, '#lab-3d-reduced');
  reduced.checked = true;
  reduced.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal(w.CortexLab.getState().settings.reducedMotion, 'on');
  assert.deepEqual(fake.last(), ['setReducedMotion', true]);
  await flush();
  h.close();
});
test('SHELL-8 / UX-B: Look into the tissue dives on the transient default run when there is no run (never saved); Explore / Back in the clip row; the structure card on inspect', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  assert.equal(
    fake.calls.some(c => c[0] === 'intro'),
    false,
    'no intro without ?intro=1'
  );
  stationGo(w, 'S6');
  assert.deepEqual(fake.last(), ['goToStation', 'S6']);
  assert.equal(stationNamed(w), 'S6');
  const dive = $(w, '#lab-clip-dive');
  assert.equal(text(dive), 'Look into the tissue');
  assert.ok(
    dive.closest('#lab-resolve-out .lab-empty-links'),
    'before a result card exists it waits with the result placeholder (UX-R2), not with the step links'
  );
  assert.deepEqual(
    $$(w, '#lab-do .lab-do-more button').map(b => b.id),
    ['lab-explain-open'],
    'with the step links only Explain a step (GAME-FIX: the keyboard way to the step sheets before a run)'
  );
  assert.ok($(w, '#lab-clip-explore').disabled && $(w, '#lab-clip-surface').disabled);
  assert.equal(text($(w, '#lab-clip-note')), CLIP.noRunCaption);
  dive.click();
  const [name, run, outcome, frames] = fake.last();
  assert.equal(name, 'dive');
  assert.equal(run.id, 'clip-preview');
  assert.equal(run.events.length, 9);
  assert.equal(run.specimenId, w.LAB.lab.listSpecimens()[0].id);
  assert.equal(outcome.label, 'illustrative-synthetic');
  assert.equal(frames.length, 9);
  assert.equal(fake.api().getFrames().length, 9);
  assert.equal(fake.api().getOutcome().runId, 'clip-preview');
  assert.equal(fake.api().getRun(), null, 'the bench itself has no run');
  assert.deepEqual(Array.from(w.CortexLab.getState().runOrder), [], 'the transient run is not in state');
  assert.equal(w.CortexLab.getState().runs['clip-preview'], undefined);
  assert.equal(w.CortexLab.getState().counters.run, 0, 'no counter was spent');
  assert.equal((h.store.get(STATE_KEY) || '').includes('clip-preview'), false, 'never written');
  assert.equal(text($(w, '#lab-clip-caption')), 'Descending.');
  assert.equal($(w, '.lab-bench-3d').dataset.labClipPhase, 'dive');
  const wrap = $(w, '#lab-clip-stage');
  assert.equal(w.document.activeElement, wrap, 'the dive takes the keyboard to the stage');
  assert.equal($(w, '#lab-clip-controls').hidden, false);
  const surface = $(w, '#lab-clip-surface');
  assert.ok(!surface.hidden && !surface.disabled, 'Back to the bench during the dive');
  assert.ok(!$(w, '#lab-clip-explore').hidden && $(w, '#lab-clip-explore').disabled, 'Explore waits for the end');
  press(w, wrap, 'ArrowRight');
  assert.deepEqual(fake.last(), ['seek', 'structures'], 'arrows move within the dive scenes');
  fake.api().onEnd('dive');
  assert.equal($(w, '#lab-clip-explore').disabled, false);
  assert.match(text($(w, '#lab-live')), /Tissue view finished/);
  press(w, wrap, 'e');
  assert.deepEqual(fake.last(), ['explore']);
  const explore = $(w, '#lab-clip-explore');
  assert.equal(explore.getAttribute('aria-pressed'), 'true');
  assert.equal(text(explore), 'Leave explore');
  assert.equal($(w, '.lab-bench-3d').dataset.labClipPhase, 'explore');
  // the structure card beside the stage: plain level names, the outcome's badge, the clip label
  fake.api().onInspect('plaque-core');
  const structure = $(w, '#lab-clip-card');
  assert.equal(structure.hidden, false);
  assert.equal(text(structure.querySelector('h3')), 'Structure: Plaque core');
  assert.equal($(w, '.lab-clip-layout').dataset.labClipCard, 'open');
  assert.deepEqual([...structure.querySelectorAll('dt')].map(text), [
    'bound silver',
    'silver nuclei',
    'visible silver',
  ]);
  const words = [...structure.querySelectorAll('dd')].map(text);
  assert.equal(words.length, 3);
  for (const word of words) assert.ok(w.SilverLab.ORDINAL_TEXT.includes(word), word);
  assert.ok(structure.querySelector('[data-lab-badge="simulated"][data-lab-label="illustrative-synthetic"]'));
  const labels = text(structure.querySelector('.lab-clip-card-labels'));
  assert.ok(labels.includes(CLIP.label), labels);
  assert.match(labels, /not saved/);
  fake.api().onInspect('soma');
  assert.equal(text($(w, '#lab-clip-card h3')), 'Structure: Neuron cell body (drawing)');
  assert.deepEqual([...$(w, '#lab-clip-card').querySelectorAll('dd')].map(text), [
    'not modeled',
    'not modeled',
    'not modeled',
  ]);
  $(w, '#lab-clip-card-close').click();
  assert.equal($(w, '#lab-clip-card').hidden, true);
  assert.equal($(w, '.lab-clip-layout').dataset.labClipCard, 'closed');
  assert.equal(w.document.activeElement, wrap, 'focus returns to the stage');
  // a jar opens its step in the side sheet, not the structure card (after the double-click wait, UX-POLISH)
  fake.api().onInspect('ammoniacal-silver');
  await new Promise(r => setTimeout(r, 320));
  assert.equal(text($(w, '#lab-sheet-h')), 'Ammoniacal silver bath');
  assert.equal($(w, '#lab-clip-card').hidden, true);
  wrap.focus();
  press(w, wrap, 'Escape');
  assert.deepEqual(fake.last(), ['leaveExplore']);
  assert.equal(explore.getAttribute('aria-pressed'), 'false');
  press(w, wrap, 'Escape');
  assert.deepEqual(fake.last(), ['surface']);
  assert.equal($(w, '.lab-bench-3d').dataset.labClipPhase, 'bench');
  assert.ok($(w, '#lab-clip-surface').disabled && $(w, '#lab-clip-surface').hidden);
  // with a real run the dive reads that run and the no-run note leaves
  startRun(w);
  assert.equal($(w, '#lab-clip-note'), null);
  assert.equal($(w, '#lab-do-step').disabled, false, 'the steps open with a run');
  $(w, '#lab-clip-dive').click();
  assert.equal(fake.last()[1].id, 'run-1');
  assert.equal(fake.api().getRun().id, 'run-1');
  assert.equal(fake.api().getOutcome().runId, 'run-1');
  assert.deepEqual(Array.from(w.CortexLab.getState().runOrder), ['run-1']);
  // Do this step moves the camera to the step's station on the bench, never during a clip
  fake.handle.surface();
  const flights = () => fake.calls.filter(c => c[0] === 'goToStation').length;
  const n = flights();
  $(w, '#lab-do-step').click();
  assert.deepEqual(fake.calls.filter(c => c[0] === 'goToStation').at(-1), ['goToStation', 'S1']);
  assert.equal(flights(), n + 1);
  assert.equal(stationNamed(w), 'S1', 'the station select follows the camera');
  fake.handle.dive();
  $(w, '#lab-do-step').click();
  assert.equal(flights(), n + 1, 'no flight while the dive plays');
  // a double click on a jar does that step through the same path (the next step, in practice)
  fake.handle.surface();
  fake.api().onEvent({ type: 'step', step: 'water-wash' });
  assert.equal(w.CortexLab.getState().runs['run-1'].events.at(-1).step, 'water-wash');
  assert.match(text($(w, '#lab-live')), /^Rinse in water done\./);
  // F8 with UX-LAST: once every step is done no step's station is current; the camera flies to the
  // microscope (S6), and the select names where it is
  $(w, '#lab-run-all').click();
  assert.deepEqual(fake.calls.filter(c => c[0] === 'goToStation').at(-1), ['goToStation', 'S6']);
  assert.equal(stationNamed(w), 'S6', 'a finished run: the camera at the microscope');
  // K1 / PLAN §8.3 with UX-R2: the secondary row is one "3D options" disclosure, so it stays under the
  // stage once no step is left (the first view keeps five controls without moving it after the result)
  assert.ok($(w, '#lab-do > .lab-stage-extras [data-lab-drawer="3d-options"] #lab-clip-intro'));
  assert.ok($(w, '#lab-do #lab-stations') && !$(w, '#lab-stations').hidden, 'the station row stays under the stage');
  assert.equal($(w, '#lab-result + .lab-stage-extras'), null);
  // F8 / KB-10 / CC-6: a Not modeled dive caption is one plain line: no engine path, no "stays unstained"
  const washes = startRun(w, { what: 'washes' });
  $(w, '#lab-run-all').click();
  assert.equal(w.LAB.lab.resolve(w.CortexLab.getState().runs[washes.id]).code, 'param-uncovered');
  $(w, '#lab-clip-dive').click();
  const filled = CLIP.noBasisCaption.replace(
    '{explanation}',
    'No sourced rule covers washes.condition = deviated; the model cannot say what this change does'
  );
  fake.api().onScene('impregnation', filled, 6);
  const caption = text($(w, '#lab-clip-caption'));
  assert.equal(
    caption,
    'Not modeled: the model has no rule for this change (washes: changed), so no stain is drawn here.'
  );
  assert.ok(caption.split(/\s+/).length <= 25, 'a caption of at most 25 words');
  assert.doesNotMatch(caption, /\.condition|deviated|stays unstained/);
  fake.api().onScene('dive', 'A plain washes.condition = deviated caption.', 4);
  assert.equal(text($(w, '#lab-clip-caption')), 'A plain this change (washes: changed) caption.');
  await flush();
  h.close();
});
test('SHELL-8: an older bench without the clip methods hides the controls and drops the queued intro with a notice', async () => {
  const fake = fakeBench({ clip: false });
  const h = harness({
    url: 'http://localhost/lab?view=bench&mode=3d&intro=1',
    benchModule: fake.module,
    webgl2: true,
  });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  assert.equal($(w, '#lab-clip-controls').hidden, true);
  assert.match(text($(w, '#lab-live')), /no tissue clip yet/);
  stationGo(w, 'S6');
  assert.equal($(w, '#lab-clip-dive'), null, 'no dive without the clip');
  assert.equal($(w, '#lab-clip-intro'), null, 'no intro without the clip');
  assert.ok($(w, '#lab-clip-transcript li'), 'the transcript is still there');
  fake.api().onInspect('specimen');
  await sheetDelay();
  assert.match(text($(w, '#lab-sheet')), /no tissue clip yet/);
  // its double click (D2) cannot play an intro this bench lacks: the sheet says why
  $(w, '#lab-sheet-close').click();
  fake.api().onAction('specimen');
  assert.match(text($(w, '#lab-sheet')), /no tissue clip yet/);
  assert.equal(fake.calls.filter(c => c[0] === 'intro').length, 0);
  press(w, $(w, '#lab-clip-stage'), ' ');
  assert.equal(
    fake.calls.some(c => ['play', 'pause', 'intro'].includes(c[0])),
    false
  );
  h.close();
});
test('SHELL-8 / UX-B: without WebGL2 mode=3d stays list; home and M1 link to the bench; list mode and M1 print the transcript; a missing or refused clip.json is tolerated', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d&intro=1' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  assert.equal($(w, 'main').dataset.mode, 'list');
  assert.equal(w.CortexLab.getState().mode, 'list');
  assert.match(text($(w, '.lab-mode-reason')), /no WebGL2/);
  assert.ok($(w, '[data-lab-mode="3d"]').disabled);
  assert.equal($(w, '#lab-bench-3d'), null);
  startRun(w);
  // list mode: "Look into the tissue" opens the clip as text (before the result card, with the result's
  // placeholder, UX-R2)
  const tissue = $(w, '#lab-resolve-out .lab-empty-links [data-lab-drawer="tissue-text"] .lab-drawer-btn');
  assert.equal(text(tissue), 'Look into the tissue');
  tissue.click();
  const block = $(w, '#lab-resolve-out .lab-empty-links .lab-clip-text');
  assert.ok(block, 'the clip as text in list mode');
  assert.equal(text(block.querySelector('h3')), 'What the tissue view shows');
  assert.deepEqual(
    [...block.querySelectorAll('li')].map(li => li.dataset.labScene),
    Array.from(w.SilverLab.CLIP_SCENES)
  );
  assert.equal(block.querySelector('[aria-current]'), null);
  assert.equal(w.LAB.clipData.label, CLIP.label);
  assert.equal(w.LAB.lab.getClip().label, CLIP.label, 'the engine received the clip');
  h.close();
  // the bench nav with WebGL2: the intro link opens the bench with mode=3d&intro=1 (FREE-1: it moved off home)
  const home = harness({ url: 'http://localhost/lab?view=bench', webgl2: true });
  await home.w.renderLabEntry();
  const watch = $(home.w, '#lab-clip-watch');
  assert.equal(text(watch), `Watch the ${introSeconds()}-second intro`);
  assert.equal(watch.getAttribute('href'), '/lab?view=bench&mode=3d&intro=1');
  assert.equal($(home.w, '.lab-nav a'), watch, 'the first nav link');
  home.close();
  // without WebGL2 (phone re-walk blocker): the first nav link is the text intro, never a dead end
  const flat = harness({ url: 'http://localhost/lab?view=bench' });
  await flat.w.renderLabEntry();
  assert.equal($(flat.w, '#lab-clip-watch'), null);
  const read = $(flat.w, '#lab-intro-text');
  assert.equal(text(read), 'Read the intro');
  assert.equal(read.getAttribute('href'), '/lab?view=intro');
  assert.equal($(flat.w, '.lab-nav a'), read, 'the first nav link');
  flat.close();
  // ?view=intro: one h1, the scenes as text, a way on to the bench
  const introPage = harness({ url: 'http://localhost/lab?view=intro' });
  await introPage.w.renderLabEntry();
  assert.equal($$(introPage.w, 'h1').length, 1);
  assert.equal(text($(introPage.w, 'h1')), 'The intro, as text');
  assert.deepEqual(
    [...$$(introPage.w, '.lab-view-intro .lab-clip-text li')].map(li => li.dataset.labScene),
    Array.from(introPage.w.SilverLab.CLIP_SCENES)
  );
  assert.ok([...$$(introPage.w, 'a[data-lab-go]')].some(a => a.getAttribute('href') === '/lab?view=bench'));
  introPage.close();
  // an old intro link opened where 3D cannot run points at the text intro
  const blocked = harness({ url: 'http://localhost/lab?view=bench&mode=3d&intro=1' });
  await blocked.w.renderLabEntry();
  const note = $(blocked.w, '.lab-intro-blocked');
  assert.ok(note, 'the blocked-intro notice');
  assert.equal(note.querySelector('a').getAttribute('href'), '/lab?view=intro');
  blocked.close();
  // M1: the first step is the clip step (a link, no field) with the transcript text behind "Read the
  // clip as text"; it needs no gate, the view step (step 2) shows it once
  const m1 = harness({ url: 'http://localhost/lab?view=module:M1' });
  await m1.w.renderLabEntry();
  const step = $(m1.w, '.lab-mstep-clip');
  assert.ok(step, 'M1 renders the clip step');
  assert.match(text(step.querySelector('h2 .label')), /^Step 1 of 5$/);
  assert.equal(step.querySelector('textarea'), null);
  const link = [...step.querySelectorAll('a[data-lab-go]')].find(a => text(a) === 'Open the tissue clip');
  assert.equal(link.getAttribute('href'), '/lab?view=bench&mode=3d&intro=1');
  assert.equal(step.querySelector('.lab-clip-text'), null, 'the transcript waits behind its link');
  const asText = step.querySelector('[data-lab-drawer="clip-text"] .lab-drawer-btn');
  assert.equal(text(asText), 'Read the clip as text');
  asText.click();
  assert.ok(step.querySelector('.lab-clip-text li[data-lab-scene="structures"]'));
  assert.equal(step.querySelector('[data-lab-safety]'), null, 'the clip step needs no safety gate');
  $(m1.w, '#lab-module-next').click();
  assert.equal($$(m1.w, '.lab-mstep [data-lab-safety]').length, 1, 'the view step shows it once');
  m1.close();
  // missing clip.json: the lab loads, the engine has no clip, the text says so
  const none = harness({ url: 'http://localhost/lab?view=bench', files: { 'data/lab/clip.json': null } });
  none.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await none.w.renderLabEntry();
  assert.equal(none.w.LAB.loaded, true);
  assert.equal(none.w.LAB.clipData, null);
  assert.match(none.w.LAB.clipError, /404/);
  assert.equal(none.w.LAB.lab.getClip(), null);
  startRun(none.w);
  $(none.w, '[data-lab-drawer="tissue-text"] .lab-drawer-btn').click();
  assert.match(text($(none.w, '.lab-clip-text')), /Clip captions are not available/);
  assert.equal($$(none.w, 'h1').length, 1);
  none.close();
  // a clip the engine's lint refuses is dropped with its problems; the lab still loads
  const bad = harness({ files: { 'data/lab/clip.json': { ...CLIP, items: CLIP.items.slice(1) } } });
  await bad.w.renderLabEntry();
  assert.equal(bad.w.LAB.loaded, true);
  assert.equal(bad.w.LAB.clipData, null);
  assert.match(bad.w.LAB.clipError, /clip-scene-unknown/);
  assert.equal(bad.w.LAB.lab.getClip(), null);
  assert.ok($(bad.w, 'main.lab-view-home'));
  bad.close();
});
test("SHELL-9 / UX-B: a run in progress tells the director's story on the result and structure cards; the loaded chip, keys, focus, live caption and specimen follow the handle", async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  // one no-run sentence, directly under the caption (not in the controls row)
  assert.equal(h.run('LAB_CLIP_NO_RUN'), CLIP.noRunCaption);
  assert.doesNotMatch(CLIP.noRunCaption, /sop-default/, 'no engine token for students');
  const note = $(w, '#lab-clip-note');
  assert.equal(note.previousElementSibling, $(w, '#lab-clip-caption'), 'the note sits under the caption');
  assert.equal(note.closest('#lab-clip-controls'), null);
  assert.equal(text(note), CLIP.noRunCaption);
  // the director receives the clip as the engine holds it (items), with no scenes alias
  assert.ok(Array.isArray(fake.api().clip.items));
  assert.equal(fake.api().clip.scenes, undefined);
  // the tissue is built for the transient run's specimen while getRun() stays null
  assert.equal(fake.api().getRun(), null);
  assert.equal(fake.api().getSpecimen().id, w.LAB.lab.listSpecimens()[0].id);
  // K3: the darker-is-not-better line is said once per screen (the bench honesty line), not by the label
  assert.doesNotMatch(text($(w, '.lab-clip-banner')), /Darker does not mean/);
  assert.equal(
    $$(w, 'main .lab-bench-honesty').filter(p => /Darker does not mean more protein/.test(text(p))).length,
    1
  );
  // on the idle stage the documented keys are consumed (Space would scroll the page), nothing runs
  const wrap = $(w, '#lab-clip-stage');
  const before = fake.calls.length;
  for (const key of [' ', 'ArrowRight', 'ArrowLeft', 's', 'e', 'Escape'])
    assert.equal(press(w, wrap, key), false, `${JSON.stringify(key)} is consumed on the idle stage`);
  assert.equal(fake.calls.length, before, 'nothing applied');
  assert.equal(press(w, wrap, 'a'), true, 'an undocumented key passes through');
  // the impregnation caption says no run while the transient run is in use
  fake.api().onScene('impregnation', 'Glints appear.', 6);
  assert.equal(text($(w, '#lab-clip-caption')), `${CLIP.noRunCaption} Glints appear.`);
  fake.api().onScene('development', 'Dots appear.', 7);
  assert.equal(text($(w, '#lab-clip-caption')), 'Dots appear.');
  // the loaded chip follows clipState().loaded, not a sticky flag
  const chip = $(w, '#lab-clip-loaded');
  assert.equal(chip.hidden, true);
  $(w, '#lab-clip-intro').click();
  assert.equal(chip.hidden, true, 'the slab is off the slide during the intro');
  $(w, '#lab-clip-skip').click();
  assert.equal(fake.handle.clipState().loaded, true);
  assert.equal(chip.hidden, false, 'shown once the handle reports the section loaded');
  $(w, '#lab-clip-intro').click();
  assert.equal(chip.hidden, true, 'a replayed intro lifts the section again');
  $(w, '#lab-clip-skip').click();
  assert.equal(chip.hidden, false);
  // a half-performed run (four steps up to the ammoniacal silver bath) is a run in progress
  startRun(w);
  assert.equal($(w, '#lab-clip-note'), null, 'the note leaves with a run');
  const caption = $(w, '#lab-clip-caption');
  const transcript = $(w, '#lab-clip-transcript');
  for (let i = 0; i < 4; i++) $(w, '#lab-do-step').click();
  const run = w.CortexLab.getState().runs['run-1'];
  assert.deepEqual(Array.from(run.events.map(e => e.step)), [
    'deparaffinize-rehydrate',
    'silver-impregnation',
    'water-wash',
    'ammoniacal-silver',
  ]);
  assert.equal(w.LAB.lab.resolve(run).code, 'step-skipped');
  const card = $(w, '#lab-resolve-out .lab-result-card');
  assert.equal(card.querySelector('.lab-badge').dataset.labBadge, 'in-progress');
  assert.equal(
    text(card.querySelector('.lab-result-summary')),
    'Steps still to do: 4 of 9 done. The picture comes once every step is done.'
  );
  assert.doesNotMatch(benchText(w), /uncertainty card|no basis/i);
  const dive = card.querySelector('#lab-clip-dive');
  assert.ok(dive, 'Look into the tissue sits on the result card once there is one');
  assert.equal($$(w, '#lab-clip-dive').length, 1);
  dive.click();
  assert.equal(fake.last()[0], 'dive');
  assert.equal(fake.last()[1].id, 'run-1');
  // a step performed mid-dive re-renders the bench; the aria-live caption node and the transcript are
  // the same nodes, still connected, with the caption they held
  fake.api().onScene('structures', 'Shapes.', 5);
  $(w, '#lab-do-step').click();
  assert.equal(run.events.length, 4, 'the run object in hand is the old copy');
  assert.equal(w.CortexLab.getState().runs['run-1'].events.at(-1).step, 'ammonium-hydroxide-wash');
  assert.equal($(w, '#lab-clip-caption'), caption, 'the same caption node');
  assert.equal($(w, '#lab-clip-transcript'), transcript, 'the same transcript node');
  assert.ok(caption.isConnected && transcript.isConnected);
  assert.equal(text(caption), 'Shapes.');
  assert.equal(transcript.querySelector('[aria-current="step"]').dataset.labScene, 'structures');
  assert.equal(caption.getAttribute('aria-live'), 'polite');
  // the structure card shows the levels of the last replay frame, labelled as an incomplete run
  fake.api().onInspect('plaque-core');
  const frames = w.LAB.lab.replay(w.CortexLab.getState().runs['run-1']);
  const last = frames[frames.length - 1].state['plaque-core'];
  const words = [...$(w, '#lab-clip-card').querySelectorAll('dd')].map(text);
  assert.deepEqual(
    words,
    [last.ionicBound, last.nuclei, last.deposit].map(n => w.SilverLab.ORDINAL_TEXT[n])
  );
  assert.notEqual(words[0], 'none', 'the ammoniacal silver bath bound silver in the model');
  assert.ok($(w, '#lab-clip-card [data-lab-badge="in-progress"][data-lab-label="no-basis"]'));
  const labels = text($(w, '.lab-clip-card-labels'));
  assert.match(labels, /Run incomplete: drawn from the steps done so far/);
  assert.ok(labels.includes(CLIP.label), labels);
  assert.doesNotMatch(labels, /not saved/);
  assert.equal($(w, '#lab-clip-card .lab-explanation'), null);
  // keyboard "Back to the bench" (Enter activates the button): the row hides, focus moves to the live
  // tissue link, never to body
  const surface = $(w, '#lab-clip-surface');
  assert.equal(surface.disabled, false);
  surface.focus();
  assert.equal(w.document.activeElement, surface);
  surface.click();
  assert.deepEqual(fake.last(), ['surface']);
  fake.api().onStation('S6');
  const active = w.document.activeElement;
  // I8 (FIX5): nothing in view can be measured here (no layout): the stage, where the clip played, never a
  // link that may sit far below the fold (was Look into the tissue)
  assert.equal(active.id, 'lab-clip-stage', 'Back to the bench hands focus to the stage, never to body');
  assert.equal($(w, '#lab-clip-controls').hidden, true);
  // the true Not modeled story: an uncovered parameter, in plain words on the result and structure cards
  startRun(w, { what: 'washes', value: 'deviated' });
  $(w, '#lab-run-all').click();
  const uncovered = w.LAB.lab.resolve(w.CortexLab.getState().runs['run-2']);
  assert.equal(uncovered.code, 'param-uncovered');
  const result = $(w, '#lab-resolve-out .lab-result-card');
  assert.equal(result.dataset.labCard, 'param-uncovered');
  assert.ok(result.querySelector('.lab-banner [data-lab-badge="not-modeled"][data-lab-label="no-basis"]'));
  assert.equal(
    text(result.querySelector('.lab-result-summary')),
    'Not modeled: No sourced rule covers this change (washes: changed); the model cannot say what this change does.'
  );
  assert.equal(
    text(result.querySelector('.lab-result-needs')),
    'What the model would need: a sourced rule for this change (washes: changed).'
  );
  assert.equal(result.querySelector('#lab-scope-btn'), null, 'no picture for a Not modeled run');
  fake.api().onInspect('tangle');
  assert.deepEqual([...$(w, '#lab-clip-card').querySelectorAll('dd')].map(text), [
    'not modeled',
    'not modeled',
    'not modeled',
  ]);
  assert.ok($(w, '#lab-clip-card [data-lab-badge="not-modeled"][data-lab-label="no-basis"]'));
  assert.match(text($(w, '#lab-clip-card .lab-explanation')), /No sourced rule covers this change \(washes: changed\)/);
  assert.doesNotMatch(benchText(w), BENCH_TOKENS);
  await flush();
  h.close();
});

/* ---------- UX-FIX-lab.js (the student and review round, 2026-10-11): one test per behaviour change ---------- */
// window.matchMedia for jsdom: `on` lists the exact queries that match.
const media = on => query => ({
  matches: !!on[query],
  media: query,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
});

test('UX-FIX: the home intro plays before the safety gate, which still guards every step; a phone borrows 3D for it; reduced motion starts it paused', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d&intro=1', benchModule: fake.module, webgl2: true });
  const { w } = h;
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake), 'the bench mounts for the intro before the acknowledgement');
  assert.equal(w.CortexLab.getState().safetyAcknowledgedAt, null);
  assert.equal(fake.calls.filter(c => c[0] === 'intro').length, 1, 'the intro plays (PLAN §3.1, CC-7, KB-12)');
  const intro = $(w, '#lab-intro.lab-bench-3d');
  assert.ok(intro, 'an Intro part above the gate');
  assert.equal(text(intro.querySelector('h2')), 'Intro');
  assert.equal($$(w, 'h1').length, 1);
  const gate = $(w, '#lab-bench-body [data-lab-safety="open"]');
  assert.ok(gate, 'the gate is still there');
  assert.ok(intro.compareDocumentPosition(gate) & w.Node.DOCUMENT_POSITION_FOLLOWING, 'the gate follows the intro');
  for (const sel of [
    '#lab-setup',
    '#lab-do-step',
    '#lab-run-all',
    '#lab-station-select',
    '#lab-result',
    '#lab-history',
    '[data-lab-mode]',
    '#lab-sheet',
  ])
    assert.equal($(w, sel), null, `${sel} waits for the gate`);
  assert.equal(w.document.activeElement, $(w, '#lab-clip-stage'), 'the keyboard is on the playing intro');
  // UX-R2: before the gate the intro's row stays plain (Play the intro, Reduce motion), and Play the
  // intro is not offered while the intro plays
  assert.equal($(w, '#lab-intro [data-lab-drawer="3d-options"]'), null);
  assert.equal($(w, '#lab-intro .lab-stage-extras').getAttribute('aria-label'), '3D bench options');
  assert.equal($(w, '#lab-intro #lab-clip-intro').hidden, true);
  assert.ok($(w, '#lab-intro #lab-3d-reduced'));
  // nothing performs a step before the acknowledgement, not even a jar on the 3D bench
  fake.api().onEvent({ type: 'step', step: 'deparaffinize-rehydrate' });
  assert.match(text($(w, '#lab-live')), /^Steps wait for the safety notes; nothing was recorded\.$/);
  assert.deepEqual(Array.from(w.CortexLab.getState().runOrder), []);
  fake.api().onInspect('ammoniacal-silver');
  assert.equal($(w, '#lab-sheet'), null, 'no step sheet before the gate');
  // the intro ends: one visible line points at the safety notes (F12); the transcript stays (KB-14)
  press(w, $(w, '#lab-clip-stage'), 's');
  assert.equal($(w, '#lab-clip-ended').hidden, false);
  assert.equal(text($(w, '#lab-clip-ended')), 'Intro finished. The safety notes below open the bench.');
  assert.equal($(w, '#lab-clip-transcript').hidden, false);
  assert.equal($(w, '#lab-intro #lab-clip-intro').hidden, false, 'Play the intro is back once it ends');
  assert.notEqual(w.document.activeElement, w.document.body);
  // acknowledging opens the bench around the same stage and handle: no remount, no second intro
  $(w, '#lab-safety-ack').click();
  assert.ok($(w, '#lab-do.lab-bench-3d'), 'the 3D steps part');
  assert.equal($(w, '#lab-intro'), null);
  assert.equal(w.LAB.bench, fake.handle, 'the same handle');
  assert.ok($(w, '#lab-do #lab-bench-3d'), 'the stage moved into part 2');
  assert.equal(fake.calls.filter(c => c[0] === 'intro').length, 1);
  assert.equal(fake.calls.filter(c => c[0] === 'destroy').length, 0);
  assert.ok($(w, '#lab-setup') && $(w, '#lab-stations'));
  assert.equal(text($(w, '#lab-clip-ended')), 'Intro finished. No run yet: Start the run is under Your slide, above.');
  await flush();
  h.close();

  // a phone: the intro borrows 3D for the visit, saves nothing, and List comes back when it ends (F7)
  const phone = fakeBench();
  const p = harness({
    url: 'http://localhost/lab?view=bench&mode=3d&intro=1',
    benchModule: phone.module,
    webgl2: true,
  });
  p.w.matchMedia = media({ '(max-width: 560px)': true });
  p.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await p.w.renderLabEntry();
  assert.ok(await mounted3d(p, phone));
  assert.equal($(p.w, 'main').dataset.mode, '3d');
  assert.equal(text($(p.w, '#lab-mode-toggle[data-lab-mode="list"]')), 'Switch to list');
  assert.equal(p.w.CortexLab.getState().mode, 'list', 'the saved mode stays List');
  assert.doesNotMatch(p.store.get(STATE_KEY) || '', /"mode":"3d"/, 'never written');
  press(p.w, $(p.w, '#lab-clip-stage'), 's');
  assert.ok(await settled(p.w, () => $(p.w, 'main').dataset.mode === 'list'), 'List is back once the intro ends');
  assert.ok(
    phone.calls.some(c => c[0] === 'destroy'),
    'the borrowed 3D bench is released'
  );
  assert.equal(text($(p.w, '#lab-mode-toggle[data-lab-mode="3d"]')), 'Switch to 3D');
  assert.equal(p.w.document.activeElement.id, 'lab-do-h', 'focus moves to the steps, never to body');
  p.close();

  // reduced motion: the intro waits on its first still for Play or Next (KB-14); the motion box says
  // the system already asks for it (KB-13)
  const slow = fakeBench();
  const r = harness({ url: 'http://localhost/lab?view=bench&mode=3d&intro=1', benchModule: slow.module, webgl2: true });
  r.w.matchMedia = media({ '(prefers-reduced-motion: reduce)': true });
  r.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await r.w.renderLabEntry();
  assert.ok(await mounted3d(r, slow));
  assert.deepEqual(
    slow.calls.filter(c => ['intro', 'pause', 'play'].includes(c[0])).map(c => c[0]),
    ['intro', 'pause']
  );
  assert.equal(text($(r.w, '#lab-clip-play')), 'Play');
  const box = $(r.w, '#lab-3d-reduced');
  assert.ok(box.checked && box.disabled, 'checked and fixed by the system setting');
  assert.equal(text(box.closest('label')), 'Reduce motion (on: your system setting)');
  await flush();
  r.close();
});

test('UX-FIX: a 3D mount keeps focus where it was, and only the 3D button that asked for it gets it back (CC-8, A11Y-07)', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.CortexLab.load();
  w.CortexLab.newRun({ specimenId: 'SPEC-SYN-AD-01' });
  await w.renderLabEntry();
  $(w, '#lab-explain-open').focus();
  assert.ok(await mounted3d(h, fake));
  assert.equal(w.document.activeElement.id, 'lab-explain-open', 'the mount did not steal focus');
  h.close();
  const fake2 = fakeBench();
  const k = harness({ url: 'http://localhost/lab?view=bench', benchModule: fake2.module, webgl2: true });
  k.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await k.w.renderLabEntry();
  $(k.w, '[data-lab-mode="3d"]').click();
  assert.ok(await mounted3d(k, fake2));
  // MODE-FIX-shell-1 (amending CC-8): the switch to 3D lands on the steps heading, the stage revealed under
  // the top bar with its station row and the primary action, and the mount keeps it there; the toggle now
  // offers the list (UX-R2)
  assert.equal(k.w.document.activeElement.id, 'lab-do-h', 'the heading of the part that came up');
  assert.equal($(k.w, '#lab-mode-toggle').dataset.labMode, 'list');
  await flush();
  k.close();
});

test('UX-FIX: the side sheet closes when the run finishes, Close never drops focus, and below 900px it is a modal dialog over an inert page (F10, F13, A11Y-01, A11Y-02, CC-5)', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.document.body.insertAdjacentHTML(
    'afterbegin',
    '<a class="skip-link" href="#main">Skip</a><div id="cs-live" aria-live="polite"></div>'
  );
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  $(w, '#lab-explain-open').click();
  assert.equal($(w, '#lab-sheet').hidden, false);
  $(w, '#lab-run-all').click();
  assert.equal($(w, '#lab-sheet').hidden, true, 'no stale step sheet over the result');
  assert.equal(w.document.activeElement, $(w, '#lab-resolve-out .lab-banner'));
  // the opener now sits in the closed History: Close lands on the result badge, never on <body>
  $(w, '#lab-history #lab-explain-open').click();
  assert.equal($(w, '#lab-sheet').hidden, false);
  $(w, '#lab-sheet-close').click();
  assert.equal($(w, '#lab-sheet').hidden, true);
  assert.equal(w.document.activeElement, $(w, '#lab-resolve-out .lab-banner'));
  $(w, '#lab-history #lab-explain-open').click();
  press(w, $(w, '#lab-sheet-h'), 'Escape');
  assert.equal(w.document.activeElement, $(w, '#lab-resolve-out .lab-banner'), 'Esc does the same');
  // below 900px: role=dialog, aria-modal, everything else inert except the live regions
  w.matchMedia = media({ '(max-width: 899.98px)': true });
  $(w, '#lab-history #lab-explain-open').click();
  const sheet = $(w, '#lab-sheet');
  assert.equal(sheet.getAttribute('role'), 'dialog');
  assert.equal(sheet.getAttribute('aria-modal'), 'true');
  for (const sel of ['header', '.lab-titlebar', '#lab-result', '#lab-setup', '.skip-link'])
    assert.ok($(w, sel).hasAttribute('inert'), `${sel} is inert`);
  for (const sel of ['#cs-live', '#lab-live', '#lab-save-status'])
    assert.equal($(w, sel).closest('[inert]'), null, `${sel} still speaks`);
  assert.equal(sheet.closest('[inert]'), null, 'the sheet itself stays usable');
  assert.equal($(w, 'main').classList.contains('lab-sheet-side'), false);
  const items = [...sheet.querySelectorAll('button:not([disabled]), select, a[href]')].filter(
    n => !n.closest('[hidden]')
  );
  items.at(-1).focus();
  press(w, items.at(-1), 'Tab');
  assert.equal(w.document.activeElement, items[0], 'Tab wraps inside the dialog');
  press(w, sheet, 'Escape');
  assert.equal($(w, '#lab-sheet').hidden, true);
  assert.equal($$(w, '[inert]').length, 0, 'nothing stays inert after the dialog');
  assert.equal($(w, '#lab-sheet').hasAttribute('aria-modal'), false);
  // 900px and up: a complementary panel beside the bench, which keeps room for it
  w.matchMedia = media({});
  $(w, '#lab-history #lab-explain-open').click();
  assert.equal($(w, '#lab-sheet').hasAttribute('aria-modal'), false);
  assert.ok($(w, 'main').classList.contains('lab-sheet-side'));
  assert.equal($$(w, '[inert]').length, 0);
  $(w, '#lab-sheet-close').click();
  assert.equal($(w, 'main').classList.contains('lab-sheet-side'), false);
  // leaving the view clears any inert mark, even outside #app
  w.matchMedia = media({ '(max-width: 899.98px)': true });
  $(w, '#lab-history #lab-explain-open').click();
  assert.ok($(w, '.skip-link').hasAttribute('inert'));
  w.pauseLabTools();
  assert.equal($(w, '.skip-link').hasAttribute('inert'), false);
  h.close();
});

test('UX-FIX: History closes on Esc; the replay announces one short line per frame (A11Y-12, A11Y-08)', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  $(w, '#lab-run-all').click();
  $(w, '#lab-history-toggle').click();
  assert.equal($(w, '#lab-history').hidden, false);
  press(w, $(w, '#lab-history-h'), 'Escape');
  assert.equal($(w, '#lab-history').hidden, true);
  assert.equal(w.document.activeElement.id, 'lab-run-menu-btn', 'back on the Run menu that holds History');
  $(w, '#lab-history-toggle').click();
  const live = $(w, '#lab-replay-live');
  assert.equal(live.getAttribute('aria-live'), 'polite');
  assert.equal($(w, '#lab-replay-frame').hasAttribute('aria-live'), false, 'the table is not re-read on each key');
  assert.equal(text(live), 'Frame 1 of 9: Remove the wax and rehydrate, 1 of 9 steps');
  $(w, '#lab-replay-next').click();
  assert.equal(text($(w, '#lab-replay-live')), 'Frame 2 of 9: First silver bath, 2 of 9 steps');
  assert.ok($(w, '#lab-replay-frame table'), 'the frame table stays, outside the live region');
  h.close();
});

test('UX-FIX: the comparison and the inline microscopes scroll into view after they render (F1, F14, KB-03)', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  const scrolled = [];
  w.Element.prototype.scrollIntoView = function (opts) {
    scrolled.push([this.id || this.className, opts && opts.block]);
  };
  const frame = () => new Promise(r => setTimeout(r, 40));
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  $(w, '#lab-run-all').click();
  scrolled.length = 0;
  $(w, '#lab-scope-btn').click();
  await frame();
  assert.deepEqual(scrolled.at(-1), ['lab-scope-title', 'start'], 'the inline microscope comes up (F14)');
  $(w, '#lab-compare-open').click();
  await frame();
  scrolled.length = 0;
  $(w, '#lab-pair-form').dispatchEvent(submit(w));
  await frame();
  assert.deepEqual(
    scrolled.at(-1),
    ['lab-result-card lab-compare', 'start'],
    'the comparison card comes to the top, not Run 1 above it'
  );
  assert.equal(w.document.activeElement, $(w, '#lab-compare-out .lab-banner'));
  scrolled.length = 0;
  $(w, '#lab-compare-scope').click();
  await frame();
  assert.deepEqual(scrolled.at(-1), ['lab-scope-compare-title', 'start'], 'the side-by-side view comes up (F1)');
  h.close();
});

test('UX-FIX: plain words for the model basis, pending tissue facts, All settings, a damaged save; strict routes; the report announces once', async () => {
  // HON-1 / F3 / HON-3: How this lab works
  const a = harness({ url: 'http://localhost/lab?view=about' });
  await a.w.renderLabEntry();
  const about = text($(a.w, 'main'));
  assert.doesNotMatch(about, /every effect comes from a rule with a cited source/);
  assert.match(
    about,
    /Each effect comes from a written rule that lists the claims it leans on\. Several rules are assumptions of the model \(the background rule has no source for this stain\), and no step size comes from data\./
  );
  assert.doesNotMatch(about, /pending|instructor/i, '§11.7');
  assert.equal(a.w.document.title, "How this lab works · Alzheimer's Histology Lab | Cortex Medical Academy");
  a.close();
  // CC-14: an unknown specimen in words (HON-10's All settings left with the Mix panel, SHELF §13.3)
  const b = harness({ url: 'http://localhost/lab?view=bench' });
  b.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await b.w.renderLabEntry();
  const gone = b.w.CortexLab.newRun({ specimenId: 'SPEC-GONE-99' });
  b.w.CortexLab.applyEvent(gone.id, { type: 'step', step: 'deparaffinize-rehydrate' });
  await b.w.renderLabEntry();
  assert.equal(text($(b.w, '#lab-specimen-chip')), 'Unknown specimen');
  assert.match(text($(b.w, '.lab-setup-line')), /^unknown specimen · /);
  b.w.CortexLab.getState().runs[gone.id] = b.w.LAB.lab.createRun({ id: gone.id, specimenId: 'SPEC-GONE-99' });
  for (const step of b.w.SilverLab.STEPS) b.w.CortexLab.applyEvent(gone.id, { type: 'step', step });
  await b.w.renderLabEntry();
  const card = $(b.w, '#lab-resolve-out .lab-result-card');
  assert.equal(card.dataset.labCard, 'specimen-unknown');
  assert.doesNotMatch(text(card.querySelector('.lab-result-body')), /SPEC-/);
  assert.match(text(card.querySelector('.lab-result-needs')), /a practice specimen the lab knows/);
  b.close();
  // CC-9: a step number is digits only; one argument, on the activity views only
  for (const [step, n] of [
    ['2abc', 1],
    ['1.9', 1],
    ['2', 2],
  ]) {
    const m = harness({ url: `http://localhost/lab?view=module:M3&step=${step}` });
    await m.w.renderLabEntry();
    assert.match(text($(m.w, '.lab-mstep h2 .label')), new RegExp(`^Step ${n} of`), `step=${step}`);
    m.close();
  }
  for (const view of ['module:M3:extra', 'about:x', 'bench:x', 'home:1']) {
    const v = harness({ url: `http://localhost/lab?view=${encodeURIComponent(view)}` });
    await v.w.renderLabEntry();
    assert.ok($(v.w, 'main.lab-view-notice'), `${view} is not a page of the lab`);
    v.close();
  }
  // A11Y-18: adding a report entry is announced once, by the notebook's own status line
  const n = harness({ url: 'http://localhost/lab?view=notebook' });
  let opts = null;
  n.w.CortexLabNotebook = {
    mountNotebook(host, o) {
      opts = o;
      return { destroy() {} };
    },
  };
  await n.w.renderLabEntry();
  $(n.w, '#lab-live').textContent = '';
  opts.onAdd({ type: 'reflection', section: 'learning-reflection', text: 'A thought.' });
  assert.equal(text($(n.w, '#lab-live')), '', 'the shell stays quiet');
  assert.equal(n.w.CortexLab.getState().notebook.entries.length, 1);
  // UX-FIX-notebook-8: the report reads the bench's value words and flag lines from the shell
  const C = n.w.CortexLab;
  assert.equal(C.valueText('development.endpoint', 'extended'), 'longer');
  assert.match(C.valueText('pretreatment', 'probe-placeholder-1'), /^probe /);
  let skew = n.w.LAB.lab.createRun({
    id: 'run-9',
    specimenId: 'SPEC-SYN-AD-01',
    params: { impregnation: { temperature: 'deviated' } },
  });
  ['silver-impregnation', ...n.w.SilverLab.STEPS].forEach((step, i) => {
    skew = n.w.LAB.lab.applyEvent(skew, { seq: i + 1, type: 'step', step });
  });
  assert.deepEqual(Array.from(C.flags(skew, n.w.LAB.lab.resolve(skew))), [
    'Low confidence: the impregnation temperature changed, and the model has no direction for that change. It is a flag in the model, not a probability.',
    'Done out of order: First silver bath; Done twice: First silver bath.',
  ]);
  assert.deepEqual(Array.from(C.flags(null, null)), []);
  n.close();
});

/* ---------- UX-R2 (re-walk round 2): the bench's control budget while steps remain ---------- */
// The first view's controls in the DOM: the header, the set-up line and part 2, outside any hidden
// part (a closed menu, drawer or disclosure), enabled. jsdom has no layout, so this counts the parts
// that sit above the fold at 1280x800 (the Playwright probe measures the fold itself).
const firstViewControls = w =>
  $$(w, '#lab-bench-head, #lab-setup, #lab-do')
    .flatMap(part => [...part.querySelectorAll('button, a[href], select, input, textarea')])
    .filter(n => !n.disabled && !n.closest('[hidden]'))
    .map(n => n.id || text(n));

test('UX-R2 Run menu: one disclosure holds New run, History and Safety notes; Esc, a click or focus outside close it; an item closes it; it stays open across a redraw', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  // before a run the menu holds the Safety notes and Show hints (GAME-shell) alone
  const btn = () => $(w, '#lab-run-menu-btn');
  const panel = () => $(w, '#lab-run-menu');
  assert.equal(text(btn()), 'Run');
  assert.deepEqual(
    ['aria-expanded', 'aria-controls'].map(a => btn().getAttribute(a)),
    ['false', 'lab-run-menu']
  );
  assert.equal(panel().getAttribute('role'), 'group');
  assert.equal(panel().getAttribute('aria-labelledby'), 'lab-run-menu-btn');
  assert.equal(panel().hidden, true);
  assert.deepEqual(
    [...panel().children].map(n => n.dataset.labSafety || n.id),
    ['acknowledged', 'lab-hints-row']
  );
  assert.equal($(w, '.lab-menu-caret').getAttribute('aria-hidden'), 'true');
  startRun(w);
  assert.deepEqual(
    [...panel().children].map(n => n.dataset.labSafety || n.id),
    ['lab-setup-toggle', 'lab-history-toggle', 'acknowledged', 'lab-hints-row']
  );
  // open, then Esc from inside closes it and focus returns to the button
  btn().click();
  assert.equal(btn().getAttribute('aria-expanded'), 'true');
  assert.equal(panel().hidden, false);
  $(w, '#lab-history-toggle').focus();
  press(w, $(w, '#lab-history-toggle'), 'Escape');
  assert.equal(panel().hidden, true);
  assert.equal(btn().getAttribute('aria-expanded'), 'false');
  assert.equal(w.document.activeElement, btn(), 'Esc returns focus to the menu button');
  // a pointer press outside closes it (focus stays where the student put it)
  btn().click();
  $(w, '#lab-do-h').dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
  assert.equal(panel().hidden, true, 'a click outside closes the menu');
  // Tab (focus) leaving the menu closes it; focus moving inside keeps it open
  btn().click();
  $(w, '#lab-setup-toggle').focus();
  assert.equal(panel().hidden, false, 'focus inside keeps it open');
  $(w, '#lab-do-step').focus();
  assert.equal(panel().hidden, true, 'focus outside closes it');
  // the Safety notes disclosure opens inside the menu; Review again still brings the gate back
  btn().click();
  const safety = $(w, '#lab-run-menu [data-lab-drawer="safety-notes"] .lab-drawer-btn');
  assert.equal(text(safety), 'Safety notes');
  safety.click();
  assert.match(text($(w, '#lab-run-menu .lab-safety-drawer')), /^Safety notes acknowledged on /);
  assert.equal(panel().hidden, false, 'a disclosure inside the menu leaves it open');
  // New run: the menu closes, the set-up opens with "Close the set-up" in its own head
  $(w, '#lab-setup-toggle').click();
  assert.equal(panel().hidden, true, 'an item that redraws the bench closes the menu');
  assert.equal($(w, '#lab-setup').dataset.labSetup, 'open');
  assert.equal(w.document.activeElement.name, 'specimen');
  assert.equal(text($(w, '#lab-setup .lab-part-head #lab-setup-toggle')), 'Close the set-up');
  assert.equal($(w, '#lab-run-menu #lab-setup-toggle'), null, 'one #lab-setup-toggle on the page');
  assert.deepEqual(
    [...panel().children].map(n => n.dataset.labSafety || n.id),
    ['lab-history-toggle', 'acknowledged', 'lab-hints-row']
  );
  $(w, '#lab-setup-toggle').click();
  assert.equal($(w, '#lab-setup').dataset.labSetup, 'collapsed');
  assert.equal(w.document.activeElement, btn(), 'closing the set-up lands on the menu that holds New run');
  // Review again (inside the menu) brings the gate back; after it the menu comes back closed
  btn().click();
  $(w, '#lab-run-menu [data-lab-drawer="safety-notes"] .lab-drawer-btn[aria-expanded="false"]')?.click();
  $(w, '#lab-safety-reset').click();
  assert.ok($(w, '#lab-bench-body [data-lab-safety="open"]'), 'Review again brings the gate back');
  $(w, '#lab-safety-ack').click();
  assert.equal(panel().hidden, true, 'the menu comes back closed');
  await flush();
  h.close();
  // a redraw while the menu is open (here the 3D mount on a page load) keeps it open, focus inside
  const fake3d = fakeBench();
  const k = harness({ url: 'http://localhost/lab?view=bench', benchModule: fake3d.module, webgl2: true });
  k.w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await k.w.CortexLab.load();
  k.w.CortexLab.newRun({ specimenId: 'SPEC-SYN-AD-01' });
  await k.w.renderLabEntry();
  $(k.w, '#lab-run-menu-btn').click();
  $(k.w, '#lab-history-toggle').focus();
  assert.ok(await mounted3d(k, fake3d));
  assert.equal($(k.w, '#lab-run-menu').hidden, false, 'still open after the mount redrew the bench');
  assert.equal(k.w.document.activeElement.id, 'lab-history-toggle');
  await flush();
  k.close();
});

test('UX-R2 view toggle: ONE button names the view it switches to; data-lab-mode is the target; the choice is stored', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  const toggle = () => $(w, '#lab-mode-toggle');
  assert.equal($$(w, '[data-lab-mode]').length, 1, 'one control, not a segmented pair');
  assert.deepEqual(
    [toggle().dataset.labMode, text(toggle()), toggle().hasAttribute('aria-pressed')],
    ['3d', 'Switch to 3D', false]
  );
  toggle().click();
  assert.equal(w.CortexLab.getState().mode, '3d');
  assert.equal(JSON.parse(h.store.get(STATE_KEY)).mode, '3d', 'stored like before');
  assert.ok(await mounted3d(h, fake));
  assert.equal($(w, 'main').dataset.mode, '3d');
  assert.deepEqual([toggle().dataset.labMode, text(toggle())], ['list', 'Switch to list']);
  assert.equal(w.document.activeElement.id, 'lab-do-h', 'the 3D part’s heading takes focus (MODE-FIX-shell-1)');
  toggle().click();
  assert.equal(w.CortexLab.getState().mode, 'list');
  assert.equal($(w, 'main').dataset.mode, 'list');
  assert.equal(w.LAB.bench, null, 'list mode releases the bench');
  assert.deepEqual([toggle().dataset.labMode, text(toggle())], ['3d', 'Switch to 3D']);
  assert.equal(w.document.activeElement, toggle());
  await flush();
  h.close();
  // without WebGL2 the toggle offers 3D, disabled, with the reason beside it
  const n = harness({ url: 'http://localhost/lab?view=bench' });
  n.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await n.w.renderLabEntry();
  const off = $(n.w, '#lab-mode-toggle');
  assert.deepEqual([off.dataset.labMode, text(off), off.disabled], ['3d', 'Switch to 3D', true]);
  assert.match(text($(n.w, '.lab-mode-reason')), /no WebGL2/);
  n.close();
});

test('UX-R2 budget: while steps remain the first view holds the Run menu, the toggle, Do this step, Run all and Explain (+ 3D options in 3D); finished, two and New slide (SHELF) (+ 3D options)', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  const mid = [
    'lab-run-menu-btn',
    'lab-mode-toggle',
    'lab-notes-toggle',
    'lab-do-step',
    'lab-run-all',
    'lab-explain-open',
  ];
  assert.deepEqual(firstViewControls(w), mid, 'list, a fresh run');
  $(w, '#lab-do-step').click();
  assert.deepEqual(firstViewControls(w), mid, 'list, mid-run');
  $(w, '#lab-mode-toggle').click();
  assert.ok(await mounted3d(h, fake));
  // §11.2: the station row's nine buttons sit under the stage, before the controls below it
  const STATIONS = [
    'Remove the wax',
    'First silver bath',
    'Ammoniacal silver and develop',
    'Gold and thiosulfate',
    'Dehydrate and mount',
    'Microscope',
    'Waste and safety',
    'Notebook',
    'Whole bench',
  ];
  const head = mid.slice(0, 3),
    steps = mid.slice(3);
  assert.deepEqual(firstViewControls(w), [...head, ...STATIONS, ...steps, '3D options'], '3D, mid-run');
  $(w, '[data-lab-drawer="3d-options"] .lab-drawer-btn').click();
  assert.deepEqual(
    firstViewControls(w).slice(head.length + STATIONS.length + steps.length),
    ['3D options', 'lab-clip-intro', 'lab-3d-reduced'],
    'opened, the 3D options show the intro and Reduce motion (Read aloud is disabled here: no voice)'
  );
  $(w, '[data-lab-drawer="3d-options"] .lab-drawer-btn').click();
  $(w, '#lab-run-all').click();
  // SHELF (§13.3): a finished practice run offers New slide beside Run complete
  assert.deepEqual(
    firstViewControls(w),
    ['lab-run-menu-btn', 'lab-mode-toggle', 'lab-notes-toggle', ...STATIONS, 'lab-new-slide', '3D options'],
    '3D, finished'
  );
  $(w, '#lab-mode-toggle').click();
  assert.deepEqual(
    firstViewControls(w),
    ['lab-run-menu-btn', 'lab-mode-toggle', 'lab-notes-toggle', 'lab-new-slide'],
    'list, finished'
  );
  await flush();
  h.close();
});

test("UX-R2 stage hint: api.onHint(text) shows one short status line over the stage, onHint('') takes it away, a fallback timer hides it; a repeat only keeps it up", async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  const hint = () => $(w, '#lab-stage-hint');
  const on = () => hint().classList.contains('lab-stage-hint-on');
  const HINT = 'Hold Ctrl (⌘ on Mac) and scroll to zoom';
  assert.equal(typeof fake.api().onHint, 'function', 'the bench api carries onHint');
  assert.equal(hint().getAttribute('role'), 'status');
  assert.ok(hint().parentElement.classList.contains('lab-stage-box'), 'over the stage, outside the canvas container');
  assert.equal(hint().previousElementSibling, $(w, '#lab-bench-3d'));
  assert.equal(hint().closest('.lab-clip-stage-wrap').id, 'lab-clip-stage');
  assert.equal(text(hint()), '', 'nothing until the bench asks (a bench without hints never does)');
  assert.equal(on(), false);
  // RC-2: the desktop canvas tip names the zoom keys the hint repeats
  assert.match(
    text($(w, '.lab-stage-tip')),
    /double-click it to do the step\. Hold Ctrl \(⌘ on Mac\) and scroll to zoom\./
  );
  const timers = [];
  const { setTimeout: realSet, clearTimeout: realClear } = w;
  w.setTimeout = (fn, ms) => timers.push({ fn, ms, live: true });
  w.clearTimeout = id => {
    if (timers[id - 1]) timers[id - 1].live = false;
  };
  // the stage hint's own timers (FIX5: a redraw's framing also asks the HUD for a re-read, an 80 ms timer)
  const live = () => timers.filter(t => t.live && t.ms !== 80);
  const fire = t => {
    t.live = false;
    t.fn();
  };
  try {
    fake.api().onHint(HINT);
    assert.equal(text(hint()), HINT);
    assert.ok(on());
    const node = hint().firstChild;
    fake.api().onHint({ text: HINT });
    assert.equal(hint().firstChild, node, 'the same hint is not written (and announced) again');
    assert.equal(live().length, 1, 'one timer: the repeat restarted it');
    // a refresh keeps the same node (and its message) over the stage
    const before = hint();
    startRun(w);
    assert.ok($(w, '#lab-do-step'), 'the bench redrew with a run');
    assert.equal(hint(), before, 'the same live node, re-attached');
    assert.equal(text(hint()), HINT);
    // the bench takes it away (the wheel went still): it fades now, then the text clears
    fake.api().onHint('');
    assert.equal(on(), false, "onHint('') hides it at once");
    assert.equal(live().length, 1);
    fire(live()[0]);
    assert.equal(text(hint()), '', 'then clears, so the next hint is announced');
    // a bench that never says '' still sees it go: the fallback timer
    fake.api().onHint(HINT);
    assert.ok(on());
    const fallback = live()[0];
    assert.equal(fallback.ms, 6000);
    fire(fallback);
    assert.equal(on(), false, 'the fallback hides it');
    fire(live()[0]);
    assert.equal(text(hint()), '');
  } finally {
    w.setTimeout = realSet;
    w.clearTimeout = realClear;
  }
  await flush();
  h.close();
  // on a touch screen the tip names the touch gestures instead (UX-R2-lab-3d-1)
  const touch = fakeBench();
  const t = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: touch.module, webgl2: true });
  t.w.matchMedia = media({ '(pointer: coarse)': true });
  t.w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await t.w.renderLabEntry();
  assert.ok(await mounted3d(t, touch));
  assert.equal(touch.api().mode, 'touch');
  assert.equal(
    text($(t.w, '.lab-stage-tip')),
    "Tap a jar to read about its step; double-tap it to do the step. Drag sideways to turn the view; pinch with two fingers to zoom. The slide's tint follows the procedure's by-eye column; it is a drawing, not a stain image."
  );
  await flush();
  t.close();
});

test('UX-R2 lab.css: the Run menu panel stays on screen, 44px targets on touch widths, the hint never takes a click, reduced motion and forced colors', () => {
  const css = read('lab.css');
  const r2 = css.slice(css.indexOf('/* ---------- UX-R2:'));
  assert.ok(r2.length > 100, 'the UX-R2 block exists');
  assert.match(
    r2,
    /\.lab-menu \{ position: relative; margin-left: auto; \}/,
    'the menu sits at the right on every line'
  );
  assert.match(r2, /\.lab-menu-panel \{ position: absolute; z-index: 30; top: calc\(100% \+ 6px\); right: 0;/);
  assert.match(
    r2,
    /max-width: min\(400px, calc\(100vw - 32px\)\); max-height: calc\(100vh - var\(--lab-topbar-h, 64px\) - 140px\); overflow-y: auto;/
  );
  assert.match(
    r2,
    /@media \(max-width: 640px\) \{\s*\.lab-bench-head \{ position: relative; \}\s*\.lab-menu \{ position: static; \}\s*\.lab-menu-panel \{ left: 0; right: 0; width: auto; max-width: none; \}/,
    'a narrow screen spans the header'
  );
  assert.match(
    r2,
    /@media \(max-width: 768px\) \{\s*\.lab-3d-options > \.lab-drawer-btn, \.lab-menu-panel > \.lab-linkbtn, \.lab-menu-panel \.lab-safety \.lab-drawer-btn \{ min-height: 44px; \}/
  );
  assert.match(css, /\.lab-page \.btn, \.lab-head-btn, .*\{ min-height: 44px; \}/, 'the header buttons too');
  assert.match(r2, /\.lab-stage-hint \{ position: absolute;.*pointer-events: none; opacity: 0;/);
  assert.match(r2, /@media \(prefers-reduced-motion: reduce\) \{ \.lab-stage-hint \{ transition: none; \} \}/);
  const forced = r2.slice(r2.indexOf('@media (forced-colors: active)'));
  assert.match(forced, /\.lab-3d-options > \.lab-drawer-btn \{ color: LinkText; text-decoration: underline; \}/);
  assert.match(forced, /\.lab-stage-hint \{ border: 1px solid CanvasText; background: Canvas; color: CanvasText; \}/);
});

// UX-SMALL (the open minors after the student-friendly cleanup): the microscope's way back to the
// designer, "3D options" closing when a run finishes or starts, the phone's sticky "Do this step" only
// in list mode (focus lifted above it), and the bench's plain names for the report export.
const until = async (w, sel) => {
  for (let i = 0; i < 50 && !$(w, sel); i++) await new Promise(r => setTimeout(r, 10));
  return $(w, sel);
};
test('UX-SMALL microscope from the designer: "Back to your experiment" and Esc return to the designer step; the run picker and openMicroscope keep the way back; without from, the bench as before', async () => {
  const mounts = [];
  const stub = w => {
    w.CortexLabMicroscope = {
      mount(host, opts) {
        mounts.push(opts);
        return { destroy() {} };
      },
      renderSynthetic: (canvas, opts) => ({ width: opts.width, height: opts.height }),
    };
  };
  const seed = harness({ url: 'http://localhost/lab?view=bench' });
  seed.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await seed.w.renderLabEntry();
  startRun(seed.w);
  $(seed.w, '#lab-run-all').click();
  startRun(seed.w, { what: 'development-time', value: 'extended' });
  $(seed.w, '#lab-run-all').click();
  const exp = seed.w.CortexLab.newExperiment({ title: 'Development time' });
  assert.equal(exp.id, 'exp-1');
  const store = seed.store.get(STATE_KEY);
  seed.close();
  const open = async url => {
    const h = harness({ url, store: new Map([[STATE_KEY, store]]) });
    stub(h.w);
    await h.w.renderLabEntry();
    return h;
  };
  const query = w => Object.fromEntries(new URLSearchParams(w.location.search));

  // from=designer: the back link names the experiment and goes to its wizard step
  const h = await open('http://localhost/lab?view=microscope&run=run-1,run-2&from=designer&exp=exp-1&step=4');
  let { w } = h;
  const back = $(w, '.lab-backlink a');
  assert.equal(text(back), '←Back to your experiment');
  assert.deepEqual(Object.fromEntries(new URL(back.getAttribute('href'), 'http://localhost').searchParams), {
    view: 'designer',
    exp: 'exp-1',
    step: '4',
  });
  assert.equal(mounts.at(-1).runs.length, 2);
  // Choose other runs keeps the way back
  $(w, '[data-lab-drawer="scope-pick"] .lab-drawer-btn').click();
  $(w, '#lab-scope-b').value = '';
  $(w, '#lab-scope-pick').dispatchEvent(submit(w));
  await until(w, 'main.lab-view-microscope');
  assert.deepEqual(query(w), { view: 'microscope', run: 'run-1', from: 'designer', exp: 'exp-1', step: '4' });
  assert.equal(text($(w, '.lab-backlink a')), '←Back to your experiment');
  // Esc in the viewer (onClose) goes back to the designer, not the bench
  mounts.at(-1).onClose();
  assert.ok(await until(w, 'main.lab-view-designer'), 'Esc returns to the designer');
  assert.deepEqual(query(w), { view: 'designer', exp: 'exp-1', step: '4' });
  // CortexLab.openMicroscope carries the keys; an unknown experiment and a bad step are dropped
  w.CortexLab.openMicroscope({ runIds: ['run-2'], from: 'designer', exp: 'exp-1', step: 2 });
  await until(w, 'main.lab-view-microscope');
  assert.deepEqual(query(w), { view: 'microscope', run: 'run-2', from: 'designer', exp: 'exp-1', step: '2' });
  w.CortexLab.openMicroscope({ runIds: ['run-1'], from: 'designer', exp: 'exp-9', step: 7 });
  await until(w, 'main.lab-view-microscope');
  assert.deepEqual(query(w), { view: 'microscope', run: 'run-1', from: 'designer' });
  assert.deepEqual(
    Object.fromEntries(new URL($(w, '.lab-backlink a').getAttribute('href'), 'http://localhost').searchParams),
    { view: 'designer' }
  );
  // anything but from=designer is the bench, as before (and the designer keys are not carried)
  w.CortexLab.openMicroscope({ runIds: ['run-1'], from: 'bench', exp: 'exp-1', step: 4 });
  await until(w, 'main.lab-view-microscope');
  assert.deepEqual(query(w), { view: 'microscope', run: 'run-1' });
  assert.equal(text($(w, '.lab-backlink a')), '←Back to the bench');
  assert.equal(viewOf($(w, '.lab-backlink a')), 'bench');
  h.close();
  const plain = await open('http://localhost/lab?view=microscope&run=run-2');
  ({ w } = plain);
  assert.equal(text($(w, '.lab-backlink a')), '←Back to the bench');
  mounts.at(-1).onClose();
  assert.ok(await until(w, 'main.lab-view-bench'), 'Esc without from returns to the bench');
  assert.deepEqual(query(w), { view: 'bench', run: 'run-2' });
  plain.close();
});

test('UX-SMALL 3D options: open across ordinary redraws, closed when the run finishes (a step, Run the rest) and when a new run starts', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  $(w, '#lab-mode-toggle').click();
  assert.ok(await mounted3d(h, fake));
  const toggle = () => $(w, '[data-lab-drawer="3d-options"] > .lab-drawer-btn');
  const isOpen = () => toggle().getAttribute('aria-expanded') === 'true' && !$(w, '.lab-3d-options-body').hidden;
  assert.equal(isOpen(), false);
  toggle().click();
  assert.equal(isOpen(), true);
  // ordinary redraws keep it open: steps, Explain, a station
  for (let i = 0; i < 7; i++) $(w, '#lab-do-step').click();
  assert.equal(isOpen(), true, 'open while the student is using it');
  $(w, '#lab-explain-open').click();
  $(w, '#lab-sheet-close').click();
  assert.equal(isOpen(), true);
  // the step that finishes the run closes it
  $(w, '#lab-do-step').click();
  assert.equal(isOpen(), true, 'still one step to do');
  $(w, '#lab-do-step').click();
  assert.equal($(w, '#lab-do-step'), null, 'finished');
  assert.equal(isOpen(), false, 'a finished run starts with 3D options closed');
  assert.equal(w.document.activeElement, $(w, '#lab-resolve-out .lab-banner'));
  // opened again on the finished run, it stays open across a redraw (History)
  toggle().click();
  $(w, '#lab-run-menu-btn').click();
  $(w, '#lab-history-toggle').click();
  assert.equal(isOpen(), true);
  $(w, '#lab-history-close').click();
  // a new run closes it
  startRun(w);
  assert.equal(isOpen(), false, 'a new run starts with 3D options closed');
  toggle().click();
  $(w, '#lab-do-step').click();
  assert.equal(isOpen(), true);
  // Run the rest finishes the run and closes it too
  $(w, '#lab-run-all').click();
  assert.equal(isOpen(), false, 'Run the rest closes it');
  await flush();
  h.close();
});

test('UX-SMALL list mode on a phone: a control the sticky "Do this step" covers is lifted above it when it takes focus; the bar itself, the side sheet and a 3D bench are left alone', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  const bar = $(w, '#lab-do-step');
  const rect = (top, bottom) => () => ({ top, bottom, left: 16, right: 374, width: 358, height: bottom - top });
  bar.getBoundingClientRect = rect(764, 834); // stuck 10px above the bottom of an 844px screen
  w.innerHeight = 844;
  const sticky = { position: 'sticky' };
  const realStyle = w.getComputedStyle;
  w.getComputedStyle = node => (node === bar ? sticky : realStyle(node));
  const scrolled = [];
  const heading = $(w, '#lab-do-h');
  heading.getBoundingClientRect = rect(780, 810);
  heading.scrollIntoView = opts => scrolled.push(['heading', { ...opts }]);
  heading.focus();
  assert.deepEqual(scrolled, [['heading', { block: 'nearest', behavior: 'instant' }]], 'lifted above the bar');
  // the bar itself, a control clear of it and a control in the side sheet are not moved
  bar.scrollIntoView = () => scrolled.push(['bar']);
  bar.focus();
  const runAll = $(w, '#lab-run-all');
  runAll.getBoundingClientRect = rect(500, 546);
  runAll.scrollIntoView = () => scrolled.push(['run-all']);
  runAll.focus();
  $(w, '#lab-explain-open').click();
  const close = $(w, '#lab-sheet-close');
  close.getBoundingClientRect = rect(770, 814);
  close.scrollIntoView = () => scrolled.push(['sheet']);
  close.focus();
  assert.equal(scrolled.length, 1, 'only the covered control moved');
  // not sticky (3D, a wide or short screen): nothing moves
  sticky.position = 'static';
  heading.focus();
  assert.equal(scrolled.length, 1);
  h.close();
});

test('UX-SMALL CortexLab names for the report export: runHeading, paramText, stepTitle; plainRule / plainCaveat are the bench words', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  const first = startRun(w);
  $(w, '#lab-run-all').click();
  const longer = startRun(w, { what: 'development-time', value: 'extended' });
  $(w, '#lab-run-all').click();
  $(w, '#lab-compare-open').click();
  $(w, '#lab-pair-form').dispatchEvent(submit(w));
  const state = w.CortexLab.getState();
  const copy = state.runs[state.runOrder.at(-1)];
  const L = w.CortexLab;
  // runTitle stays the short name the microscope and the report's run lines build on
  assert.equal(L.runTitle(first), 'Run 1');
  assert.equal(L.runHeading(first), 'Run 1 · Practice specimen A · high burden · standard (per procedure)');
  assert.equal(L.runHeading(longer), 'Run 2 · Practice specimen A · high burden · Development time: longer');
  // a copy's name already says its change; it is not said twice
  assert.match(L.runTitle(copy), /^Run 3 · copy of Run 2 · /);
  assert.equal(L.runHeading(copy), `${L.runTitle(copy)} · Practice specimen A · high burden`);
  assert.equal(
    L.runHeading({ ...first, specimenId: 'SPEC-GONE', method: 'no-such-method' }),
    'Run 1 · unknown specimen · unknown method'
  );
  assert.equal(L.runHeading(null), '');
  // History names the same run the same way up to its progress
  assert.ok(L.runHeading(first).startsWith(w.labRunLabel(first).replace(/ · \d+ of \d+ steps done$/, '')));
  for (const [path, value, words] of [
    ['development.endpoint', 'extended', 'Development time: longer'],
    ['development.strength', 'weak', 'Developer strength: weaker'],
    ['impregnation.endpoint', 'sop-default', 'Impregnation time: standard'],
    ['washes.condition', 'deviated', 'Washes: changed'],
    ['ammoniacal.condition', 'unspecified', 'Ammoniacal silver bath, other conditions: not set'],
    ['pretreatment', 'none', 'Pretreatment: none'],
    ['toning', true, 'Gold toning: performed'],
    ['thiosulfate', false, 'Thiosulfate: skipped'],
    ['not.a.param', 'x', 'not.a.param = x'],
    ['specimenId', 'SPEC-SYN-AD-01', 'specimenId = SPEC-SYN-AD-01'],
  ])
    assert.equal(L.paramText(path, value), words, path);
  assert.equal(L.stepTitle('deparaffinize-rehydrate'), 'Remove the wax and rehydrate');
  assert.equal(L.stepTitle('development'), 'Develop the silver');
  assert.equal(L.stepTitle('no-such-step'), 'no-such-step');
  assert.equal(L.stepTitle(''), '');
  assert.equal(
    L.plainRule(
      'Binding (schematic): the model fixes the bound-ionic-silver ordinal at the ammoniacal-silver step from impregnation.endpoint'
    ),
    'Bound silver: the impregnation time sets how much silver binds; the model reads it at the ammoniacal silver bath (step 4)'
  );
  assert.equal(
    L.plainCaveat('Endpoint positions early / sop-default / extended are ordered schematic positions.'),
    "Shorter, standard and longer are ordered places on the model's scale, not times."
  );
  h.close();
});

// UX-POLISH (the final student check): sealed runs, the finished run on the 3D bench, Redo asking first,
// the stage brought into view, History in the export's words, Go to station wrapping, the microscope's
// way back carrying the designer's anchor.
const SEAL_NOTE = /^Sealed until you reveal “Development time test”\. Write your predictions first\.$/;
const FINISHED = 'This run is finished. New run (in the Run menu) starts another.';
async function sealedBench({ benchModule = null, url = 'http://localhost/lab?view=bench&exp=exp-1' } = {}) {
  const seed = harness({ url: 'http://localhost/lab?view=home' });
  seed.w.CortexLab.newExperiment({
    title: 'Development time test',
    independentVariable: 'Development time',
    changed: ['Development time: longer'], // UX-LAST: a bench change, in the bench's words
  });
  const store = seed.store.get(STATE_KEY);
  seed.close();
  const h = harness({ url, store: new Map([[STATE_KEY, store]]), benchModule, webgl2: !!benchModule });
  const scrolled = [];
  h.w.Element.prototype.scrollIntoView = function (opts) {
    scrolled.push([this.id || this.className, opts && opts.block]);
  };
  return { h, w: h.w, scrolled };
}
test('UX-POLISH sealing: "Make the runs for me" makes the pair after the safety notes, sealed, and lands on its message; no surface shows a sealed outcome; the reveal, a run switch or a deleted experiment unseals', async () => {
  const { h, w, scrolled } = await sealedBench();
  await w.renderLabEntry();
  // nothing is made before the safety notes (making the pair performs every step)
  assert.ok($(w, '#lab-safety-ack'));
  assert.deepEqual(Array.from(w.CortexLab.getState().runOrder), []);
  $(w, '#lab-safety-ack').click();
  const state = w.CortexLab.getState();
  assert.deepEqual(Array.from(state.runOrder), ['run-1', 'run-2']);
  const exp = state.experiments['exp-1'];
  assert.deepEqual([exp.baselineRunId, exp.experimentalRunId], ['run-1', 'run-2']);
  assert.deepEqual([state.runs['run-1'].events.length, state.runs['run-2'].events.length], [9, 9]);
  assert.equal(state.runs['run-2'].params.development.endpoint, 'extended', 'the change the experiment names');
  assert.deepEqual({ ...state.sealed }, { 'run-1': 'exp-1', 'run-2': 'exp-1' });
  assert.equal(JSON.parse(h.store.get(STATE_KEY)).sealed['run-2'], 'exp-1', 'saved (ids only)');
  assert.ok(w.CortexLab.isSealed('run-1') && w.CortexLab.isSealed('run-2'));
  // the message: focused and brought to the top of the view, with the way to the predictions
  const ready = $(w, '#lab-sealed-ready');
  assert.equal(w.document.activeElement, ready);
  assert.deepEqual(scrolled.at(-1), ['lab-sealed-ready', 'start']);
  assert.match(
    text(ready),
    /^Your two runs are ready and sealed\. Go back to your experiment to write your predictions\./
  );
  const link = ready.querySelector('a[data-lab-go]');
  assert.deepEqual(Object.fromEntries(new URL(link.getAttribute('href'), 'http://localhost').searchParams), {
    view: 'designer',
    exp: 'exp-1',
    step: '2',
  });
  assert.match(text(ready), /Baseline: Run 1 · standard \(per procedure\)/);
  assert.match(text(ready), /With your change: Run 2 · copy of Run 1 · Development time: longer/);
  assert.equal(new URLSearchParams(w.location.search).get('run'), 'run-2', 'a reload shows the same pair');
  // bench: no card, badge, thumbnail, comparison or tissue link; the status line says sealed
  const outcomeFree = () => {
    assert.equal($$(w, '#lab-result .lab-result-card, #lab-result [data-lab-label], #lab-scope-btn').length, 0);
    assert.equal($$(w, '#lab-compare-open, #lab-clip-dive, [data-lab-drawer="tissue-text"]').length, 0);
  };
  outcomeFree();
  assert.match(text($(w, '#lab-do-status')), /All steps done: sealed until you reveal “Development time test”\./);
  assert.equal($(w, '#lab-pair'), null, 'no pairing panel');
  // History: the log in plain words, the replay is only the note (its state tables would show the outcome)
  $(w, '#lab-run-menu-btn').click();
  $(w, '#lab-history-toggle').click();
  assert.match(text($(w, '#lab-history .lab-replay [data-lab-sealed]')), SEAL_NOTE);
  assert.equal($$(w, '#lab-replay-range, #lab-replay-frame, .lab-replay .lab-badge').length, 0);
  // the other run of the pair: the same message; a third, unsealed run keeps its card (a stronger
  // developer: a standard run would match the sealed baseline, UX-LAST twin sealing)
  change(w, $(w, '#lab-run-select'), 'run-1');
  assert.ok($(w, '#lab-sealed-ready'));
  outcomeFree();
  startRun(w, { what: 'developer-strength' });
  $(w, '#lab-run-all').click();
  assert.ok($(w, '#lab-resolve-out .lab-result-card'), 'an unsealed run keeps its result');
  // a comparison with a sealed run shows the note for that run, not a difference
  w.history.pushState({}, '', '/lab?view=bench&run=run-3&pair=run-2');
  await w.renderLabEntry();
  assert.equal($$(w, '#lab-compare-out .lab-compare, #lab-compare-out [data-lab-label]').length, 0);
  assert.match(
    text($(w, '#lab-compare-out .lab-sealed-card')),
    /^Run 2 · copy of Run 1 · Development time: longer ?Sealed until/
  );
  // the microscope: without the viewer module, and with it (the host never mounts a sealed run)
  w.history.pushState({}, '', '/lab?view=microscope&run=run-1,run-2');
  await w.renderLabEntry();
  assert.equal($$(w, '#lab-scope-host .lab-sealed-card').length, 2);
  assert.equal($$(w, '#lab-scope-host .lab-result-card, #lab-scope-host [data-lab-label]').length, 0);
  const mounts = [];
  w.CortexLabMicroscope = { mount: (host, opts) => mounts.push(opts) && { destroy() {} }, renderSynthetic() {} };
  await w.renderLabEntry();
  assert.equal(mounts.length, 0, 'the viewer is never mounted on a sealed run');
  assert.match(text($(w, '#lab-scope-host .lab-sealed')), SEAL_NOTE);
  w.history.pushState({}, '', '/lab?view=microscope&run=run-3');
  await w.renderLabEntry();
  assert.equal(mounts.length, 1, 'an unsealed run still opens');
  // switching the experiment's experimental run unseals the old one; the reveal unseals the rest
  exp.experimentalRunId = 'run-3';
  assert.equal(w.CortexLab.isSealed('run-2'), false);
  assert.equal(w.CortexLab.isSealed('run-1'), true);
  exp.experimentalRunId = 'run-2';
  exp.status = 'revealed';
  assert.equal(w.CortexLab.isSealed('run-1'), false);
  w.history.pushState({}, '', '/lab?view=bench&run=run-2');
  await w.renderLabEntry();
  assert.ok($(w, '#lab-resolve-out .lab-result-card [data-lab-label="illustrative-synthetic"]'), 'revealed: shown');
  // a deleted experiment unseals too, and the saved record drops seals that no longer hold
  exp.status = 'draft';
  assert.equal(w.CortexLab.isSealed('run-2'), true);
  delete state.experiments['exp-1'];
  assert.equal(w.CortexLab.isSealed('run-2'), false);
  assert.deepEqual({ ...w.labSealPruned(state) }, {});
  h.close();
});
test('UX-POLISH sealing on the 3D bench: the slide gets the run without its state, the dive has no frames, and an unsealed run is drawn as before', async () => {
  const fake = fakeBench();
  const runs = [];
  const setRun = fake.handle.setRun;
  fake.handle.setRun = run => {
    runs.push(run);
    return setRun(run);
  };
  const { h, w } = await sealedBench({ benchModule: fake.module });
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  assert.ok(w.CortexLab.isSealed('run-2'));
  assert.equal(fake.api().getRun().id, 'run-2');
  assert.equal(fake.api().getRun().state, null, 'the bench never gets a sealed run’s state');
  assert.ok(runs.length > 0 && runs.every(run => run.id !== 'run-2' || run.state === null));
  assert.equal(w.CortexLab.getState().runs['run-2'].state !== null, true, 'the saved run keeps its state');
  assert.deepEqual(Array.from(fake.api().getFrames()), []);
  assert.equal(fake.api().getOutcome(), null);
  assert.equal($(w, '#lab-clip-dive'), null, 'no way into the tissue');
  assert.match(text($(w, '#lab-do-status')), /Run complete: sealed until you reveal/);
  assert.equal($(w, '#lab-3d-replay'), null, 'no replay on the bench (it tints the slide)');
  w.CortexLab.getState().experiments['exp-1'].status = 'revealed';
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  assert.ok(fake.api().getRun().state, 'revealed: the run is drawn');
  assert.ok(fake.api().getFrames().length > 0);
  assert.ok($(w, '#lab-3d-replay') && $(w, '#lab-clip-dive'), 'the replay and the dive are back');
  await flush();
  h.close();
});
test('UX-POLISH finished run on the 3D bench: a jar double click changes nothing (its sheet says how to redo), the tip says so, the camera goes to the microscope (UX-LAST); a jar click waits for a double click; the sheet lies over the stage', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench', benchModule: fake.module, webgl2: true });
  const { w } = h;
  const scrolled = [];
  w.Element.prototype.scrollIntoView = function (opts) {
    scrolled.push([this.id || this.className, opts && opts.block]);
  };
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  const run = () => w.CortexLab.getState().runs['run-1'];
  // Start the run: the stage comes to the top of the view, focus on Do this step
  startRun(w);
  assert.equal(w.document.activeElement.id, 'lab-do-step');
  assert.deepEqual(scrolled.at(-1), ['lab-do', 'start']);
  // a jar click opens its sheet only after the double-click wait; a double click cancels it
  fake.api().onInspect('deparaffinize-rehydrate');
  assert.equal($(w, '#lab-sheet').hidden, true, 'not at once');
  fake.api().onEvent({ type: 'step', step: 'deparaffinize-rehydrate' });
  assert.equal(run().events.length, 1);
  await new Promise(r => setTimeout(r, 340));
  assert.equal($(w, '#lab-sheet').hidden, true, 'the double click cancelled the sheet');
  assert.deepEqual(scrolled.at(-1), ['lab-do', 'start'], 'the stage back in view after the step');
  fake.api().onInspect('water-wash');
  await new Promise(r => setTimeout(r, 340));
  assert.equal($(w, '#lab-sheet').hidden, false);
  assert.equal($(w, 'main').classList.contains('lab-sheet-side'), false, 'the stage keeps its width in 3D');
  $(w, '#lab-sheet-close').click();
  // the tip while steps remain
  assert.match(text($(w, '.lab-stage-tip')), /double-click it to do the step/);
  const before = fake.calls.length;
  $(w, '#lab-run-all').click();
  assert.equal(run().events.length, 9);
  assert.deepEqual(
    fake.calls.slice(before).filter(c => c[0] === 'goToStation'),
    [['goToStation', 'S6']],
    'the camera flies to the microscope (UX-LAST; was the whole bench)'
  );
  assert.equal(text($(w, '.lab-do-finished')), 'Run complete: the result is below.');
  assert.equal(
    text($(w, '.lab-stage-tip')),
    `${FINISHED} The slide's tint follows the procedure's by-eye column; it is a drawing, not a stain image.`
  );
  // finished: a jar double click records nothing; its step sheet says how to redo one on purpose
  fake.api().onInspect('water-wash');
  fake.api().onEvent({ type: 'step', step: 'water-wash' });
  assert.equal(run().events.length, 9, 'no new event');
  assert.equal(text($(w, '#lab-live')), FINISHED);
  assert.equal($(w, '#lab-sheet').hidden, false);
  assert.equal(text($(w, '#lab-sheet-h')), 'Rinse in water');
  assert.equal(text($(w, '#lab-sheet .lab-sheet-finished')), FINISHED);
  await new Promise(r => setTimeout(r, 340));
  assert.equal(run().events.length, 9);
  assert.ok(!run().deviations.some(d => d.kind === 'repeated'), 'never "Done twice" from the bench');
  await flush();
  h.close();
});
test('MODE-4 the Slide now card (free bench): the by-eye look with its swatch from LOOK_COLORS, the flags in plain words, Look at your slide, Not in the model, Why / sources; the What happened log with Why per dip; no Mix panel mid-run (SHELF)', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  const run = startRun(w, { mode: 'free', what: 'washes', value: 'deviated' });
  const get = () => w.CortexLab.getState().runs[run.id];
  const lab = w.LAB.lab;
  const card = () => $(w, '#lab-slide-now');
  // before any dip: an unstained section is a real thing to see
  assert.ok(card().hasAttribute('data-lab-slide-fresh'));
  assert.equal(card().dataset.labOutcome, run.id);
  assert.equal(card().querySelector('.lab-banner .lab-badge').dataset.labLabel, 'illustrative-synthetic');
  assert.equal(w.labLookReason(lab, { runId: run.id }), '', 'canLook from the start');
  assert.equal(text($(w, '#lab-look-slide')), 'Look at your slide');
  const look = lab.resolve(get()).look;
  assert.equal(look.key, 'unstained');
  assert.equal(text($(w, '#lab-look-text')), look.text);
  const swatch = card().querySelector('.lab-look-swatch');
  assert.equal(swatch.dataset.labLook, 'unstained');
  assert.equal(swatch.getAttribute('aria-hidden'), 'true');
  const hex = w.SilverLab.LOOK_COLORS.unstained;
  const rgb = `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
  assert.ok([hex, rgb].includes(swatch.style.background.trim()), swatch.style.background);
  assert.equal(text(card().querySelector('.lab-slide-flags')), 'wax still on');
  assert.match(
    text(card().querySelector('.lab-slide-gaps')),
    /^Not in the model\s*No rule for “Washes: changed”: the picture leaves it out\.$/
  );
  assert.equal(text(card().querySelector('[data-lab-why="result"] .lab-drawer-btn')), 'Why?');
  assert.equal(
    card().querySelector('[data-lab-why="result"] .lab-drawer-btn').getAttribute('aria-label'),
    'Why? Slide now',
    'one name per Why (MODE-FIX-shell-15)'
  );
  card().querySelector('[data-lab-why="result"] .lab-drawer-btn').click();
  assert.ok(card().querySelector('.lab-why-body .lab-sources-disclosure'), 'the same Why / sources rendering');
  assert.doesNotMatch(benchText(w), BENCH_TOKENS, 'no engine word on the card face');
  // a dip: the reaction in the log with its Why (the chemistry, the rules, the claims)
  change(w, $(w, '#lab-free-step'), 'development');
  $(w, '#lab-free-dip').click();
  const reaction = get().reactions.at(-1);
  assert.equal(reaction.kind, 'no-reaction');
  const item = $(w, '#lab-reactions > li.lab-reaction-latest');
  assert.equal(text(item.querySelector('.lab-reaction-text')), reaction.text);
  assert.equal(text(item.querySelector('.lab-drawer-btn')), 'Why?');
  assert.equal(item.querySelector('.lab-drawer-btn').getAttribute('aria-label'), 'Why? Develop the silver');
  item.querySelector('.lab-drawer-btn').click();
  assert.equal(text(item.querySelector('.lab-reaction-why > p')), reaction.why);
  assert.ok([...item.querySelectorAll('.lab-chip-rule')].some(c => text(c) === reaction.rules[0]));
  assert.ok(
    [...item.querySelectorAll('.lab-chips[aria-label="Claims"] .lab-chip')].some(c => text(c) === reaction.claims[0])
  );
  assert.equal(card().hasAttribute('data-lab-slide-fresh'), false);
  // SHELF (§13.3): no Mix panel mid-run (its settings are the jars' fields); an older run's setting keeps its
  // "Not in the model" line, and the set-up line names it
  assert.equal($(w, '[data-lab-drawer="mix-run"]'), null);
  assert.equal($(w, '#lab-params-run'), null);
  assert.match(text(card().querySelector('.lab-slide-gaps')), /Washes: changed/);
  assert.match(text($(w, '.lab-setup-line')), /Free bench · Washes: changed$/);
  // Do the whole procedure from here: the first bath binds silver, develop reduces it, mounting seals
  $(w, '#lab-run-all').click();
  const after = lab.resolve(get());
  assert.equal(after.slide.coverslipped, true);
  assert.equal(text($(w, '#lab-look-text')), after.look.text);
  assert.equal(card().querySelector('.lab-look-swatch').dataset.labLook, after.look.key);
  assert.match(text(card().querySelector('.lab-slide-flags')), /sealed under a coverslip/);
  assert.equal($$(w, '#lab-reactions > li').length, get().reactions.length);
  assert.equal($$(w, '#lab-reactions > li.lab-reaction-latest').length, 1);
  assert.equal($(w, '#lab-free-dip').disabled, true);
  assert.equal(
    $(w, '.lab-result-card.lab-slide-now .lab-badge[data-lab-label]').dataset.labLabel,
    'illustrative-synthetic'
  );
  h.close();
});
test('UX-POLISH History and Why? in the export’s words: event lines, the settings, deviations and the replay frame', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w, { what: 'developer-strength', value: 'strong' });
  $(w, '#lab-do-step').click();
  $(w, '#lab-run-all').click();
  $(w, '#lab-run-menu-btn').click();
  $(w, '#lab-history-toggle').click();
  $(w, '#lab-note-text').value = 'compare later';
  $(w, '#lab-note-form').dispatchEvent(submit(w));
  const rows = $$(w, '#lab-history .lab-log-table tbody tr').map(tr => [...tr.cells].map(text));
  assert.deepEqual(rows.slice(0, 3), [
    ['1.', 'Changed setting: Developer strength: stronger'],
    ['2.', 'Remove the wax and rehydrate'],
    ['3.', 'First silver bath'],
  ]);
  assert.deepEqual(rows.at(-1), ['11.', 'Note: compare later']);
  assert.equal($$(w, '#lab-history .lab-log-table code').length, 0, 'no engine ids in the event lines');
  assert.deepEqual($$(w, '#lab-history .lab-log-settings').map(text), [
    'Settings changed from standard: Developer strength: stronger',
    `Toning and thiosulfate: performed (${w.SilverLab.TONING_TEXT.performed}; ${w.SilverLab.THIOSULFATE_TEXT.performed})`,
  ]);
  assert.match(text($(w, '#lab-history .lab-log')), /Deviations: none recorded/);
  assert.equal(
    text($(w, '#lab-replay-frame .lab-frame-head')),
    'Frame 1 of 11 · 1. Changed setting: Developer strength: stronger'
  );
  assert.match(
    text($(w, '#lab-replay-live')),
    /^Frame 1 of 11: Changed setting: Developer strength: stronger, 0 of 9 steps$/
  );
  // a run that skips gold toning: the course procedure's words for what that leaves (§11.5)
  const skip = startRun(w, { what: 'toning-thiosulfate', value: 'toning' });
  assert.deepEqual(Array.from(w.labSettingsLines(skip)), [
    'Settings: all standard (per procedure) except gold toning',
    `Gold toning: skipped (${w.SilverLab.TONING_TEXT.skipped})`,
    `Thiosulfate: performed (${w.SilverLab.THIOSULFATE_TEXT.performed})`,
  ]);
  h.close();
});
test('UX-POLISH lab.css: Go to station wraps under its label, so an open "3D options" never scrolls the page sideways (320–390 px)', () => {
  const css = read('lab.css');
  assert.doesNotMatch(css, /lab-station-pick|lab-redo-confirm/, 'the select and the redo box are gone (§11.1, §11.2)');
  assert.match(css, /\.lab-sealed-card, \.lab-sealed-ready \{[^}]*border: 1px dashed/);
  assert.match(
    css,
    /@media \(forced-colors: active\) \{\n {2}\.lab-sealed-card, \.lab-sealed-ready \{ border-color: CanvasText; \}/
  );
});
test('UX-POLISH the microscope’s way back carries the designer’s anchor (at=) and a second back link sits under the viewer', async () => {
  const seed = harness({ url: 'http://localhost/lab?view=bench' });
  seed.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await seed.w.renderLabEntry();
  startRun(seed.w);
  $(seed.w, '#lab-run-all').click();
  seed.w.CortexLab.newExperiment({ title: 'T' });
  const store = seed.store.get(STATE_KEY);
  seed.close();
  const mounts = [];
  const h = harness({
    url: 'http://localhost/lab?view=microscope&run=run-1&from=designer&exp=exp-1&step=4&at=labn-measures-out',
    store: new Map([[STATE_KEY, store]]),
  });
  const { w } = h;
  w.CortexLabMicroscope = { mount: (host, opts) => mounts.push(opts) && { destroy() {} }, renderSynthetic() {} };
  await w.renderLabEntry();
  const params = a => Object.fromEntries(new URL(a.getAttribute('href'), 'http://localhost').searchParams);
  const want = { view: 'designer', exp: 'exp-1', step: '4', at: 'labn-measures-out' };
  const links = [$(w, '.lab-backlink a'), $(w, '#lab-scope-back-end a')];
  assert.equal($$(w, '.lab-backlink a').length, 1, 'the bottom link is its own class (one .lab-backlink per view)');
  for (const a of links) {
    assert.equal(text(a), '←Back to your experiment');
    assert.deepEqual(params(a), want);
  }
  // the bottom link comes after the viewer
  assert.ok($(w, '#lab-scope-host').compareDocumentPosition(links[1]) & w.Node.DOCUMENT_POSITION_FOLLOWING);
  // Esc in the viewer goes back to the anchor too; openMicroscope carries it; a damaged anchor is dropped
  mounts.at(-1).onClose();
  assert.ok(await until(w, 'main.lab-view-designer'));
  assert.deepEqual(Object.fromEntries(new URLSearchParams(w.location.search)), want);
  w.CortexLab.openMicroscope({ runIds: ['run-1'], from: 'designer', exp: 'exp-1', step: 3, at: 'x"><b' });
  await until(w, 'main.lab-view-microscope');
  assert.equal(new URLSearchParams(w.location.search).get('at'), null);
  w.CortexLab.openMicroscope({ runIds: ['run-1'], from: 'designer', exp: 'exp-1', step: 3, at: 'labn-scope-1' });
  await until(w, 'main.lab-view-microscope');
  assert.equal(new URLSearchParams(w.location.search).get('at'), 'labn-scope-1');
  // without from=designer the anchor is not carried, and the bottom link leads to the bench
  w.history.pushState({}, '', '/lab?view=microscope&run=run-1&at=labn-scope-1');
  await w.renderLabEntry();
  assert.deepEqual(params($(w, '#lab-scope-back-end a')), { view: 'bench', run: 'run-1' });
  h.close();
});
// UX-LAST: the designer's planned change is read with CortexLab.matchChange only (the laptop check:
// "Make the runs for me" silently changed development time for 6 of 14 designer suggestions).
// The designer's suggestions before this round (lab-notebook.js PARAM_TEXT), each with what the bench
// now does with it: a { path: value } change, or null (refused, nothing made).
const LAB_OLD_SUGGESTIONS = [
  ['Impregnation time', null], // shorter or longer: not said
  ['Impregnation temperature', { 'impregnation.temperature': 'deviated' }],
  ['Impregnation bath condition', null],
  ['Ammoniacal silver time', null],
  ['Ammoniacal silver condition', null],
  ['Development time', null],
  ['Developer strength', null],
  ['Developer condition', null],
  ['Washes', { 'washes.condition': 'deviated' }],
  ['Pretreatment', null], // the bench's option is "Pretreatment (pending instructor)"
  ['Gold toning', null],
  ['Thiosulfate', null],
  ['Specimen', null],
  ['Staining method', null],
];
const leavesOf = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? leavesOf(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]
  );
test('UX-LAST shared API: changeOptions() is the set-up select (order, words, values); matchChange reads those labels exactly, never a guess', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  const options = w.CortexLab.changeOptions();
  assert.deepEqual(
    JSON.parse(JSON.stringify(options.map(o => [o.id, o.label]))),
    [
      ['standard', 'Nothing (standard, per procedure)'],
      ['impregnation-time', 'Impregnation time'],
      ['impregnation-temperature', 'Impregnation temperature'],
      ['development-time', 'Development time'],
      ['developer-strength', 'Developer strength'],
      ['washes', 'Washes'],
      ['toning-thiosulfate', 'Toning and thiosulfate'],
    ],
    'the copy picker, in its order and words (no pretreatment, §11.7)'
  );
  // the compare panel keeps the one-change picker (a copy); its controls carry the same values
  startRun(w);
  $(w, '#lab-run-all').click();
  $(w, '#lab-compare-open').click();
  assert.deepEqual(
    [...$(w, '#lab-change-what').options].map(o => [o.value, o.text]),
    JSON.parse(JSON.stringify(options.slice(1).map(o => [o.id, o.label])))
  );
  for (const o of options.slice(1).filter(x => x.id !== 'toning-thiosulfate')) {
    change(w, $(w, '#lab-change-what'), o.id);
    const radios = $$(w, '#lab-change-control [data-lab-change-value]').map(input => ({
      value: input.value,
      label: text(input.closest('label')).replace(' (same as this run)', ''),
    }));
    assert.deepEqual(JSON.parse(JSON.stringify(o.values)), radios, `${o.id}: the control's values`);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(options.find(o => o.id === 'toning-thiosulfate').values)), [
    { value: 'none', label: 'both done (standard)' },
    { value: 'toning', label: 'skip gold toning' },
    { value: 'thiosulfate', label: 'skip thiosulfate' },
  ]);
  options[0].label = 'changed by a caller';
  assert.equal(w.CortexLab.changeOptions()[0].label, 'Nothing (standard, per procedure)', 'fresh copies');
  const match = t => JSON.parse(JSON.stringify(w.CortexLab.matchChange(t)));
  for (const [said, want] of [
    ['Development time: longer', { id: 'development-time', value: 'extended' }],
    ['  development   time :LONGER. ', { id: 'development-time', value: 'extended' }],
    ['Development time (shorter)', { id: 'development-time', value: 'early' }],
    ['Development time: standard', { id: 'development-time', value: 'sop-default' }],
    ['Developer strength: weaker', { id: 'developer-strength', value: 'weak' }],
    ['Impregnation time: longer', { id: 'impregnation-time', value: 'extended' }],
    ['Impregnation temperature: changed (low confidence)', { id: 'impregnation-temperature', value: 'deviated' }],
    ['Washes: changed (not modeled)', { id: 'washes', value: 'deviated' }],
    ['Toning and thiosulfate: skip thiosulfate', { id: 'toning-thiosulfate', value: 'thiosulfate' }],
    ['Development time', { id: 'development-time', value: null }],
    ['Toning and thiosulfate', { id: 'toning-thiosulfate', value: null }],
    ['Washes', { id: 'washes', value: 'deviated' }],
    ['Nothing (standard, per procedure)', { id: 'standard', value: null }],
  ])
    assert.deepEqual(match(said), want, said);
  for (const said of [
    '',
    '   ',
    null,
    undefined,
    'longer',
    'weaker',
    'skip gold toning',
    // the words before §11.5 carried the washes' warning: not this option's label any more
    'Toning and thiosulfate: skip gold toning (not modeled)',
    'Development time: much longer',
    'Longer development time',
    'Development time longer',
    'Gold toning',
    'Specimen',
    'Staining method',
    'Ammoniacal silver time',
    'Developer condition',
    'Developer strength and development time',
    'Pretreatment (pending instructor): probe 2 (pending instructor)',
    'Pretreatment (pending instructor)',
    'Pretreatment',
  ])
    assert.equal(w.CortexLab.matchChange(said), null, String(said));
  h.close();
});
test('UX-LAST the planned change: every "What you change" item a bench change, one option and one value that differs from the baseline; else nothing (no default change)', async () => {
  const h = harness({ url: 'http://localhost/lab?view=home' });
  const { w } = h;
  await w.renderLabEntry();
  const base = JSON.parse(JSON.stringify(w.SilverLab.DEFAULT_PARAMS));
  const changeOf = (exp, from = base) => {
    const got = w.labChangeForExperiment(w.LAB.lab, exp, from);
    return got
      ? Object.fromEntries(leavesOf(JSON.parse(JSON.stringify(w.labParamDiff(from, got.params).patch))))
      : null;
  };
  for (const [exp, want] of [
    [{ changed: ['Development time: longer'] }, { 'development.endpoint': 'extended' }],
    [{ changed: ['Development time (shorter)'] }, { 'development.endpoint': 'early' }],
    [{ independentVariable: 'Developer strength: weaker' }, { 'development.strength': 'weak' }],
    // the main variable gives the value the change item leaves open; free words there are the student's own
    [
      { changed: ['Developer strength'], independentVariable: 'Developer strength: weaker' },
      { 'development.strength': 'weak' },
    ],
    [
      { changed: ['Developer strength: weaker'], independentVariable: 'how strong the developer is' },
      { 'development.strength': 'weak' },
    ],
    [{ changed: ['Washes'] }, { 'washes.condition': 'deviated' }],
    [{ changed: ['Toning and thiosulfate: skip gold toning'] }, { toning: false }],
    [{ changed: ['Toning and thiosulfate: skip thiosulfate'] }, { thiosulfate: false }],
    [{ changed: ['Pretreatment (pending instructor): probe 1 (pending instructor)'] }, null], // §11.7: gone
    // the title is never read; a direction is never guessed; one change at a time
    [{ title: 'Weaker developer and background', changed: ['Developer strength'] }, null],
    [{ title: 'Development time test' }, null],
    [{ changed: ['Development time'] }, null],
    [{ changed: ['Development time: longer', 'Staining method'] }, null],
    [{ changed: ['Development time: longer', 'Developer strength: weaker'] }, null],
    [{ changed: ['Development time: longer', 'Development time: shorter'] }, null],
    [{ changed: ['Development time: longer'], independentVariable: 'Developer strength: weaker' }, null],
    [{ changed: ['Development time: standard'] }, null],
    [{ changed: ['Nothing (standard, per procedure)'] }, null],
    [{ changed: ['Toning and thiosulfate: both done (standard)'] }, null],
    [{ independentVariable: 'Something else' }, null],
    [{}, null],
  ])
    assert.deepEqual(changeOf(exp), want, JSON.stringify(exp));
  // against the baseline's own settings: the same value is no change
  const longer = JSON.parse(JSON.stringify(base));
  longer.development.endpoint = 'extended';
  assert.equal(changeOf({ changed: ['Development time: longer'] }, longer), null);
  assert.deepEqual(changeOf({ changed: ['Development time: shorter'] }, longer), { 'development.endpoint': 'early' });
  // the 14 suggestions the designer offered before this round
  for (const [said, want] of LAB_OLD_SUGGESTIONS) assert.deepEqual(changeOf({ changed: [said] }), want, said);
  h.close();
});
// A draft whose plan is `changed`, opened on the bench by "Make the runs for me" (?exp=).
async function planBench(changed, { prepare = null } = {}) {
  const seed = harness({ url: 'http://localhost/lab?view=bench' });
  seed.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  if (prepare) await prepare(seed.w);
  const exp = seed.w.CortexLab.newExperiment({ title: 'Plan', changed });
  const store = seed.store.get(STATE_KEY);
  seed.close();
  const h = harness({ url: `http://localhost/lab?view=bench&exp=${exp.id}`, store: new Map([[STATE_KEY, store]]) });
  const scrolled = [];
  h.w.Element.prototype.scrollIntoView = function (opts) {
    scrolled.push([this.id || this.className, opts && opts.block]);
  };
  await h.w.renderLabEntry();
  return { h, w: h.w, expId: exp.id, scrolled };
}
const REFUSED =
  "The bench can't make this change for you. Pick your two runs yourself on the plan screen, or choose a change the bench offers.";
test('UX-LAST "Make the runs for me" makes exactly the planned change, or nothing: the refusal is focused, in view, and leads back to step 2', async () => {
  // each designer suggestion (old and new words) either makes the matching pair or is refused
  const t = harness({ url: 'http://localhost/lab?view=home' });
  await t.w.renderLabEntry();
  const options = JSON.parse(JSON.stringify(t.w.CortexLab.changeOptions()));
  t.close();
  // every "<option>: <value>" the bench offers: a standard value is no change, so nothing is made
  const offered = options.flatMap(o =>
    o.values.map(v => [`${o.label}: ${v.label}`, ['none', 'sop-default'].includes(v.value) ? null : 'made'])
  );
  assert.equal(offered.length, 16); // 10 of them changes (§11.7: no pretreatment probes)
  const plans = [...LAB_OLD_SUGGESTIONS, ...offered];
  for (const [said, want] of plans) {
    const { h, w, expId, scrolled } = await planBench([said]);
    const state = w.CortexLab.getState();
    const exp = state.experiments[expId];
    if (want === null) {
      assert.deepEqual(Array.from(state.runOrder), [], `${said}: nothing made`);
      assert.deepEqual({ ...state.sealed }, {}, `${said}: nothing sealed`);
      assert.deepEqual([exp.baselineRunId, exp.experimentalRunId], [null, null]);
      const note = $(w, '#lab-make-refused');
      assert.equal(text(note), REFUSED, said);
      assert.equal(w.document.activeElement, note, `${said}: focused`);
      assert.deepEqual(scrolled.at(-1), ['lab-make-refused', 'start']);
      assert.deepEqual(
        Object.fromEntries(
          new URL(note.querySelector('a[data-lab-go]').getAttribute('href'), 'http://localhost').searchParams
        ),
        { view: 'designer', exp: expId, step: '1' } // SIMPLE: the runs sit on the plan screen
      );
      assert.equal($(w, '#lab-sealed-ready'), null);
    } else {
      assert.equal(state.runOrder.length, 2, `${said}: a pair`);
      const [b, c] = state.runOrder.map(id => state.runs[id]);
      const diff = Object.fromEntries(leavesOf(JSON.parse(JSON.stringify(w.labParamDiff(b.params, c.params).patch))));
      const m = w.CortexLab.matchChange(said);
      const option = w.CortexLab.changeOptions().find(o => o.id === m.id);
      assert.equal(Object.keys(diff).length, 1, `${said}: one change`);
      if (want !== 'made') assert.deepEqual(diff, want, said);
      else if (option.id === 'toning-thiosulfate') assert.deepEqual(diff, { [m.value]: false }, said);
      else assert.deepEqual(Object.values(diff), [m.value], said);
      assert.equal($(w, '#lab-make-refused'), null);
      assert.equal(w.document.activeElement.id, 'lab-sealed-ready');
    }
    h.close();
  }
  // a refusal persists through a reload of the same address, and leaves once a run is started here
  const { h, w } = await planBench(['Staining method']);
  await w.renderLabEntry();
  assert.equal(text($(w, '#lab-make-refused')), REFUSED);
  startRun(w);
  assert.equal($(w, '#lab-make-refused'), null, 'gone once the student starts a run');
  assert.equal(w.CortexLab.getState().runOrder.length, 1);
  h.close();
  // before the safety notes nothing is decided or made; the refusal comes after the acknowledgement
  const seed = harness({ url: 'http://localhost/lab?view=home' });
  const e = seed.w.CortexLab.newExperiment({ changed: ['Specimen'] });
  const store = seed.store.get(STATE_KEY);
  seed.close();
  const g = harness({ url: `http://localhost/lab?view=bench&exp=${e.id}`, store: new Map([[STATE_KEY, store]]) });
  await g.w.renderLabEntry();
  assert.equal($(g.w, '#lab-make-refused'), null);
  $(g.w, '#lab-safety-ack').click();
  assert.equal(text($(g.w, '#lab-make-refused')), REFUSED);
  assert.deepEqual(Array.from(g.w.CortexLab.getState().runOrder), []);
  g.close();
});
test('UX-LAST baseline reuse: a finished, unsealed, all-standard run on the specimen is the baseline (left open); only the changed run is made and sealed', async () => {
  const finishedStandard = async w => {
    await w.renderLabEntry();
    startRun(w);
    $(w, '#lab-run-all').click();
  };
  const { h, w, expId } = await planBench(['Development time: longer'], { prepare: finishedStandard });
  const state = w.CortexLab.getState();
  assert.deepEqual(Array.from(state.runOrder), ['run-1', 'run-2'], 'one new run');
  const exp = state.experiments[expId];
  assert.deepEqual([exp.baselineRunId, exp.experimentalRunId], ['run-1', 'run-2']);
  assert.deepEqual({ ...state.sealed }, { 'run-2': expId }, 'the seen baseline stays open');
  assert.equal(state.runs['run-1'].events.length, 9, 'the baseline is used as it is');
  assert.equal(state.runs['run-2'].params.development.endpoint, 'extended');
  const ready = $(w, '#lab-sealed-ready');
  assert.equal(w.document.activeElement, ready);
  assert.match(
    text(ready),
    /^Your two runs are ready; the run with your change is sealed\. Go back to your experiment to write your predictions\./
  );
  assert.deepEqual($$(w, '#lab-sealed-ready li').map(text), [
    'Baseline (already seen): Run 1',
    'With your change: Run 2 · copy of Run 1 · Development time: longer',
  ]);
  assert.equal(
    text($(w, '#lab-sealed-ready .lab-dim')),
    'Both runs did every step. You have already seen the baseline, so it stays open; the run with your change stays hidden until you reveal “Plan”.'
  );
  change(w, $(w, '#lab-run-select'), 'run-1');
  assert.ok($(w, '#lab-resolve-out .lab-result-card [data-lab-label]'), 'the baseline keeps its result');
  h.close();
  // not reused: out of order, another specimen, a changed setting, unfinished: a new sealed baseline
  for (const prepare of [
    async x => {
      await x.renderLabEntry();
      startRun(x);
      x.run(`labApplyEvent('run-1', { type: 'step', step: 'water-wash' })`);
      $(x, '#lab-run-all').click();
    },
    async x => {
      await x.renderLabEntry();
      startRun(x, { specimen: 'SPEC-SYN-AD-02' });
      $(x, '#lab-run-all').click();
      x.CortexLab.getState().activeSpecimenId = 'SPEC-SYN-AD-01';
    },
    async x => {
      await x.renderLabEntry();
      startRun(x, { what: 'washes' });
      $(x, '#lab-run-all').click();
    },
    async x => {
      await x.renderLabEntry();
      startRun(x);
      $(x, '#lab-do-step').click();
    },
  ]) {
    const seed = harness({ url: 'http://localhost/lab?view=bench' });
    seed.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
    seed.w.run = seed.run;
    await prepare(seed.w);
    const e = seed.w.CortexLab.newExperiment({ title: 'Plan', changed: ['Development time: longer'] });
    const store = seed.store.get(STATE_KEY);
    seed.close();
    const p = harness({ url: `http://localhost/lab?view=bench&exp=${e.id}`, store: new Map([[STATE_KEY, store]]) });
    await p.w.renderLabEntry();
    const s = p.w.CortexLab.getState();
    assert.deepEqual(Array.from(s.runOrder), ['run-1', 'run-2', 'run-3']);
    assert.deepEqual({ ...s.sealed }, { 'run-2': e.id, 'run-3': e.id }, 'a new baseline, sealed');
    assert.match(text($(p.w, '#lab-sealed-ready')), /^Your two runs are ready and sealed\./);
    p.close();
  }
});
test('UX-LAST twin sealing: a new run that matches a sealed run is sealed to the same experiment and says why; it opens with the reveal or when it no longer matches', async () => {
  const { h, w } = await sealedBench();
  await w.renderLabEntry();
  $(w, '#lab-safety-ack').click();
  const state = w.CortexLab.getState();
  assert.deepEqual({ ...state.sealed }, { 'run-1': 'exp-1', 'run-2': 'exp-1' });
  const TWIN = 'This run matches a sealed run, so it stays sealed until you reveal “Development time test”.';
  // the same specimen, method and settings as the sealed copy: sealed, and the student is told
  const twin = startRun(w, { what: 'development-time', value: 'extended' });
  assert.equal(twin.id, 'run-3');
  assert.equal(state.sealed['run-3'], 'exp-1');
  assert.ok(w.CortexLab.isSealed('run-3'));
  $(w, '#lab-run-all').click();
  assert.equal($$(w, '#lab-result .lab-result-card, #lab-result [data-lab-label]').length, 0, 'no outcome');
  assert.equal(text($(w, '#lab-result [data-lab-sealed]')), `${TWIN} Write your predictions first.`);
  assert.match(text($(w, '#lab-do-status')), /All steps done: sealed until you reveal “Development time test”\./);
  assert.equal(JSON.parse(h.store.get(STATE_KEY)).sealed['run-3'], 'exp-1', 'saved');
  // a standard run on the specimen matches the sealed baseline; skipping gold toning does not (it is
  // Not modeled, ENGINE-14 / TONING), nor does another specimen or another setting
  startRun(w);
  assert.equal(state.sealed['run-4'], 'exp-1');
  startRun(w, { what: 'toning-thiosulfate', value: 'toning' });
  assert.equal(state.sealed['run-5'], undefined);
  startRun(w, { specimen: 'SPEC-SYN-AD-02', what: 'development-time', value: 'extended' });
  startRun(w, { specimen: 'SPEC-SYN-AD-01', what: 'development-time', value: 'early' });
  assert.deepEqual(Object.keys(state.sealed).sort(), ['run-1', 'run-2', 'run-3', 'run-4']);
  assert.equal(w.CortexLab.isSealed('run-7'), false);
  // the module's default runs follow the same rule (their cards say why)
  const m3 = w.LAB.lab.content.modules.items.find(m => m.id === 'M3');
  const ids = w.labPrepareModuleRuns(w.LAB.lab, m3);
  const sealedIds = ids.filter(id => w.CortexLab.isSealed(id));
  assert.deepEqual(JSON.parse(JSON.stringify(sealedIds.map(id => w.labRunTitle(state.runs[id])))), [
    'Run 8 · Activity 3: Baseline, standard',
    'Run 11 · Activity 3: Longer development time',
  ]);
  // the twin's seal holds while it matches a run the experiment names and that run is sealed
  const exp = state.experiments['exp-1'];
  exp.experimentalRunId = 'run-7'; // development time shorter, unsealed
  assert.equal(w.CortexLab.isSealed('run-3'), false, 'the copy it matched is no longer named');
  assert.equal(w.CortexLab.isSealed('run-4'), true, 'the baseline it matches still is');
  exp.experimentalRunId = 'run-2';
  assert.equal(w.CortexLab.isSealed('run-3'), true);
  assert.deepEqual(Object.keys(w.labSealPruned(state)).sort(), Object.keys(state.sealed).sort());
  exp.status = 'revealed';
  for (const id of ['run-3', 'run-4', 'run-5']) assert.equal(w.CortexLab.isSealed(id), false, id);
  assert.deepEqual({ ...w.labSealPruned(state) }, {});
  h.close();
});
test('UX-LAST microscope, one run sealed and one open: the open run in the viewer beside the sealed card, in the order chosen', async () => {
  const { h, w } = await sealedBench();
  await w.renderLabEntry();
  $(w, '#lab-safety-ack').click();
  startRun(w, { what: 'developer-strength' });
  $(w, '#lab-run-all').click();
  const mounts = [];
  w.CortexLabMicroscope = {
    mount: (host, opts) => mounts.push({ host, opts }) && { destroy() {} },
    renderSynthetic() {},
  };
  for (const [order, kinds] of [
    ['run-3,run-2', ['open', 'sealed']],
    ['run-2,run-3', ['sealed', 'open']],
  ]) {
    w.history.pushState({}, '', `/lab?view=microscope&run=${order}`);
    await w.renderLabEntry();
    const split = $(w, '#lab-scope-host > .lab-scope-split');
    assert.ok(split, order);
    assert.deepEqual(
      [...split.children].map(n =>
        n.matches('.lab-sealed-card') ? 'sealed' : n.matches('.lab-scope-split-open') ? 'open' : '?'
      ),
      kinds
    );
    assert.equal(text(split.querySelector('.lab-scope-split-open .lab-scope-title')), 'In the microscope: Run 3');
    const { host, opts } = mounts.at(-1);
    assert.equal(host, $(w, '[data-lab-scope-open]'), 'the viewer mounts in the open slot');
    assert.deepEqual(JSON.parse(JSON.stringify(opts.runs.map(r => r.id))), ['run-3'], 'on the open run alone');
    assert.equal(opts.outcomes.length, 1);
    assert.match(
      text(split.querySelector('.lab-sealed-card')),
      /^Run 2 · copy of Run 1 · Development time: longer ?Sealed until/
    );
    assert.match($(w, '#lab-scope-host').getAttribute('aria-label'), /^Microscope compare: /);
  }
  // both sealed: the cards only, no viewer
  const before = mounts.length;
  w.history.pushState({}, '', '/lab?view=microscope&run=run-1,run-2');
  await w.renderLabEntry();
  assert.equal(mounts.length, before);
  assert.equal($(w, '.lab-scope-split'), null);
  assert.equal($$(w, '#lab-scope-host > .lab-sealed-card').length, 2);
  h.close();
});
test('UX-LAST finished run in 3D: the camera flies to the microscope (S6) and the line under the stage stops saying "Do the steps below"', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d&intro=1', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  await settled(w, () => fake.calls.some(c => c[0] === 'intro'));
  startRun(w);
  press(w, $(w, '#lab-clip-stage'), 's');
  assert.equal(text($(w, '#lab-clip-ended')), 'Intro finished.', 'no order (D5, FIX2)');
  $(w, '#lab-do-step').click();
  assert.equal(text($(w, '#lab-clip-ended')), 'Intro finished.', 'still steps to do');
  const before = fake.calls.length;
  $(w, '#lab-run-all').click();
  assert.deepEqual(
    fake.calls.slice(before).filter(c => c[0] === 'goToStation'),
    [['goToStation', 'S6']]
  );
  assert.equal(stationNamed(w), 'S6');
  // H9 (FIX4): "Run complete" is said once, by the progress row; the intro's end stays "Intro finished."
  assert.equal(text($(w, '#lab-clip-ended')), 'Intro finished.');
  assert.equal(text($(w, '.lab-do-finished')), 'Run complete: the result is below.');
  await flush();
  h.close();
});
test('UX-LAST small fixes: the safety badge keeps its colon; History run switch names the run in the address; Back from the microscope restores the designer anchor; lab.css selects leave room for the chevron', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  await w.renderLabEntry();
  assert.equal($(w, '#lab-bench-body .lab-badge'), null, 'no badge on the safety card (§11.7)');
  // History: switching runs updates ?run= in place (replaceState: no new history entry)
  $(w, '#lab-safety-ack').click();
  startRun(w);
  startRun(w, { what: 'washes' });
  w.history.replaceState({}, '', '/lab?view=bench&run=run-2&pair=run-1');
  const length = w.history.length;
  $(w, '#lab-run-menu-btn').click();
  $(w, '#lab-history-toggle').click();
  change(w, $(w, '#lab-run-select'), 'run-1');
  assert.equal(w.location.search, '?view=bench&run=run-1');
  assert.equal(w.history.length, length);
  assert.match(text($(w, '#lab-run-name')), /Run 1/);
  h.close();
  // the designer's own history entry gets the anchor, so browser Back lands on it as the back link does
  const d = harness({ url: 'http://localhost/lab?view=designer&exp=exp-1&step=4' });
  d.w.CortexLab.newExperiment({ title: 'T' });
  const designerMounts = [];
  d.w.CortexLabNotebook = { mountDesigner: (host, opts) => designerMounts.push(opts) && { destroy() {} } };
  await d.w.renderLabEntry();
  assert.equal(designerMounts.at(-1).at, undefined);
  d.w.CortexLab.openMicroscope({ runIds: [], from: 'designer', exp: 'exp-1', step: 4, at: 'measures' });
  await until(d.w, 'main.lab-view-microscope');
  const popped = new Promise(r => d.w.addEventListener('popstate', r, { once: true }));
  d.w.history.back();
  await popped;
  assert.deepEqual(Object.fromEntries(new URLSearchParams(d.w.location.search)), {
    view: 'designer',
    exp: 'exp-1',
    step: '4',
    at: 'measures',
  });
  await d.w.renderLabEntry(); // app.js re-renders the section on popstate
  assert.equal(designerMounts.at(-1).at, 'measures', 'the designer gets the anchor on the Back render');
  // a microscope link without an anchor, or from another view, leaves the entry alone
  d.w.history.replaceState({}, '', '/lab?view=designer&exp=exp-1&step=2');
  d.w.CortexLab.openMicroscope({ runIds: [], from: 'designer', exp: 'exp-1', step: 2 });
  await until(d.w, 'main.lab-view-microscope');
  d.w.history.back();
  await new Promise(r => d.w.addEventListener('popstate', r, { once: true }));
  assert.equal(new URLSearchParams(d.w.location.search).get('at'), null);
  d.close();
  // lab.css: the badge's line, room for the chevron, the split and the refusal
  const css = read('lab.css');
  assert.match(css, /\.lab-page select:not\(\[multiple\]\) \{ padding-right: 36px; text-overflow: ellipsis; \}/);
  assert.match(css, /\.lab-scope-split \{ display: flex; flex-wrap: wrap;/);
  assert.match(css, /\.lab-make-refused:focus-visible \{ outline: 2px solid var\(--blue\)/);
});

// TONING (ENGINE-14): a run whose settings skip gold toning or thiosulfate. The bench never offers,
// does or logs that step, counts only the steps the run needs, labels the skip "not modeled" like the
// washes, shows the engine's Not modeled card, and the twin key tells such a run from a standard one.
const TONING_STEPS = { toning: 'gold-toning', thiosulfate: 'sodium-thiosulfate' };
const TONING_WORDS = { toning: 'gold toning', thiosulfate: 'sodium thiosulfate' };
const SKIPPED_WORDS = 'Skipped (your setting)';
const SKIPPED_SHEET = 'Skipped by this run’s setting';
test('TONING set-up: a run that skips gold toning or thiosulfate never offers, does or logs that step; N of M counts the steps it needs; the result is Not modeled', async () => {
  for (const [flag, stepId] of Object.entries(TONING_STEPS)) {
    const h = harness({ url: 'http://localhost/lab?view=bench' });
    const { w } = h;
    w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
    await w.renderLabEntry();
    // the free Mix panel has no toning / thiosulfate checkbox (MODE-FIX-shell-2: jars, not settings); a
    // practice run that skips a step gets the flag from the designer's own copy (applyEvent here)
    change(w, $(w, '#lab-bench-mode input[value="free"]'), true);
    assert.deepEqual(
      ['toning', 'thiosulfate'].map(f => $(w, `#lab-param-${f}`)),
      [null, null]
    );
    change(w, $(w, '#lab-bench-mode input[value="practice"]'), true);
    const run = startRun(w, { what: 'toning-thiosulfate', value: flag });
    assert.equal(run.params[flag], false);
    const name = w.CortexLab.stepTitle(stepId);
    const order = w.LAB.lab.getMethod('bielschowsky-modified').steps.find(s => s.id === stepId).order;
    const row = () => $(w, `.lab-step[data-lab-step="${stepId}"]`);
    const checkRow = () => {
      assert.equal(text(row().querySelector('.lab-step-state')), SKIPPED_WORDS);
      assert.ok(row().hasAttribute('data-lab-step-skipped'));
      assert.ok(!row().matches('.lab-step-done, .lab-step-next'), 'never next, never done');
      assert.equal(row().getAttribute('aria-current'), null);
    };
    checkRow();
    assert.equal(text($(w, '#lab-do-count')), '0 of 8 done');
    assert.equal(text($(w, '#lab-run-all')), 'Run all steps');
    // its sheet says it is skipped and what the course procedure says that leaves
    $(w, '#lab-explain-open').click();
    change(w, $(w, '#lab-sheet-step'), stepId);
    assert.match(text($(w, `[data-lab-sheet-skipped="${stepId}"]`)), new RegExp(`^${SKIPPED_SHEET}\\. This run skips`));
    assert.equal(w.labDropHint(w.LAB.lab, { runId: run.id }, stepId), 'Your settings skip this step');
    assert.ok(order > 0);
    $(w, '#lab-sheet-close').click();
    const live = () => w.CortexLab.getState().runs[run.id];
    if (flag === 'toning') {
      // Do this step walks the steps the run needs; it never names the skipped one
      const asked = [];
      while ($(w, '#lab-do-step')) {
        asked.push(text($(w, '#lab-do-step')));
        if (asked.length === 3)
          assert.equal(
            text($(w, '#lab-resolve-out .lab-result-summary')),
            'Steps still to do: 2 of 8 done. The picture comes once every step is done.'
          );
        $(w, '#lab-do-step').click();
      }
      assert.equal(asked.length, 8);
      assert.ok(!asked.includes(`Do this step: ${name}`), asked.join(' | '));
      assert.match(text($(w, '#lab-live')), / done\.( [^.]+\.)* 8 of 8 steps done\. The result is ready below\.$/);
    } else {
      $(w, '#lab-run-all').click();
      assert.match(text($(w, '#lab-live')), /^All 8 steps done\./);
    }
    assert.equal(live().events.filter(e => e.type === 'step').length, 8);
    assert.ok(!live().events.some(e => e.step === stepId), 'never performed or logged');
    assert.ok(!live().stepsDone.includes(stepId));
    assert.deepEqual(Array.from(live().deviations), [], 'no deviation: the order is the run’s own');
    assert.match(text($(w, '#lab-do-status')), /^8 of 8 done/);
    checkRow();
    // the result (§11.5, R-model-10): a picture, with the course procedure's words for what the skip leaves
    const card = $(w, '#lab-resolve-out .lab-result-card');
    assert.equal(card.dataset.labResult, 'illustrative-synthetic');
    assert.equal(card.querySelector('[data-lab-badge]').dataset.labBadge, 'simulated');
    const out = w.LAB.lab.resolve(live());
    assert.ok(
      out.caveats.some(c => /gold toning|thiosulfate/i.test(c)),
      out.caveats.join(' | ')
    );
    assert.ok($(w, '#lab-scope-btn'), 'a thumbnail: the picture exists');
    assert.ok(TONING_WORDS[flag]);
    assert.equal($$(w, '.lab-result-flag').length, 0);
    // History: the log has no such step; the settings in the export's words
    const settings = flag === 'toning' ? 'Gold toning: skipped' : 'Thiosulfate: skipped';
    const logRows = $$(w, '#lab-history .lab-log-table tbody tr').map(tr => text(tr.cells[1]));
    assert.equal(logRows.length, 9);
    assert.equal(logRows[0], `Changed setting: ${settings}`);
    assert.ok(!logRows.includes(name), 'no step line for it');
    const T = w.SilverLab.TONING_TEXT,
      X = w.SilverLab.THIOSULFATE_TEXT;
    assert.deepEqual(
      $$(w, '#lab-history .lab-log-settings').map(text),
      flag === 'toning'
        ? [
            'Settings: all standard (per procedure) except gold toning',
            `Gold toning: skipped (${T.skipped})`,
            `Thiosulfate: performed (${X.performed})`,
          ]
        : [
            'Settings: all standard (per procedure) except thiosulfate',
            `Gold toning: performed (${T.performed})`,
            `Thiosulfate: skipped (${X.skipped})`,
          ]
    );
    assert.equal(w.CortexLab.runHeading(live()), `Run 1 · Practice specimen A · high burden · ${settings}`);
    assert.equal(w.labRunLabel(live()), 'Run 1 · Practice specimen A · high burden · 8 of 8 steps done');
    // a step done anyway (an older save) is recorded by the engine and shown, never counted
    w.CortexLab.applyEvent(run.id, { type: 'step', step: stepId });
    assert.deepEqual(JSON.parse(JSON.stringify(live().deviations.map(d => [d.kind, d.step]))), [
      ['not-planned', stepId],
    ]);
    assert.deepEqual(Array.from(w.labResultFlags(live(), w.LAB.lab.resolve(live()))), [
      `Done though your setting skips it: ${name}.`,
    ]);
    assert.equal(w.labStepProgress(w.LAB.lab, live()).count, 8);
    h.close();
  }
});
test('TONING 3D: a double click on a skipped step’s jar does nothing but show its sheet ("Skipped by this run’s setting"); Run all leaves it out; the jar stays skipped after the run', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  const run = startRun(w, { what: 'toning-thiosulfate', value: 'toning' });
  const live = () => w.CortexLab.getState().runs[run.id];
  assert.equal(text($(w, '#lab-do-count')), '0 of 8 done');
  const sheetSays = () => {
    assert.equal($(w, '#lab-sheet').hidden, false);
    assert.equal(text($(w, '#lab-sheet-h')), 'Gold toning');
    assert.match(text($(w, '#lab-sheet .lab-sheet-kicker')), /^Step 7 of 9 · skipped by this run’s setting · /);
    assert.equal(
      text($(w, '#lab-sheet [data-lab-sheet-skipped="gold-toning"]')),
      `${SKIPPED_SHEET}. This run skips gold toning, so the bench does not do this step. The course procedure says what that leaves: ${w.SilverLab.TONING_TEXT.skipped}.`
    );
    assert.equal($(w, '#lab-sheet .lab-sheet-finished'), null);
  };
  // a jar double click: no event, the sheet opens at once (no wait for a second click)
  fake.api().onInspect('gold-toning');
  fake.api().onEvent({ type: 'step', step: 'gold-toning' });
  assert.equal(live().events.length, 1, 'only the set-params event');
  assert.equal(text($(w, '#lab-live')), `${SKIPPED_SHEET}: Gold toning.`);
  sheetSays();
  await new Promise(r => setTimeout(r, 340));
  assert.equal(live().events.length, 1);
  $(w, '#lab-sheet-close').click();
  // a single click opens the same sheet after the double-click wait
  fake.api().onInspect('gold-toning');
  await new Promise(r => setTimeout(r, 340));
  sheetSays();
  $(w, '#lab-sheet-close').click();
  // the overlay's Do this step jumps over it; Run the rest leaves it out
  for (let i = 0; i < 6; i++) $(w, '#lab-do-step').click();
  assert.equal(text($(w, '#lab-do-step')), `Do this step: ${w.CortexLab.stepTitle('sodium-thiosulfate')}`);
  assert.equal(text($(w, '#lab-do-count')), '6 of 8 done');
  const before = fake.calls.length;
  $(w, '#lab-run-all').click();
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        live()
          .events.filter(e => e.type === 'step')
          .map(e => e.step)
      )
    ),
    JSON.parse(JSON.stringify(w.SilverLab.STEPS.filter(s => s !== 'gold-toning')))
  );
  assert.deepEqual(
    fake.calls.slice(before).filter(c => c[0] === 'goToStation'),
    [['goToStation', 'S6']],
    'finished: the camera at the microscope'
  );
  assert.equal(text($(w, '.lab-do-finished')), 'Run complete: the result is below.');
  assert.equal(
    $(w, '#lab-resolve-out .lab-result-card').dataset.labResult,
    'illustrative-synthetic',
    '§11.5: skipping is modeled'
  );
  // finished: the skipped jar still shows its own sheet, never the redo note, and records nothing
  fake.api().onEvent({ type: 'step', step: 'gold-toning' });
  assert.equal(live().events.length, 9);
  sheetSays();
  $(w, '#lab-sheet-close').click();
  // the dive reads the run's picture (a tone of silver: no gold toning)
  $(w, '#lab-clip-dive').click();
  assert.equal(fake.api().getOutcome().tone, 'silver');
  await flush();
  h.close();
});
test('TONING "Make the runs for me": a skip makes the copy without that step (the baseline does every step), sealed; a later standard run is not its twin; the reveal is a drawn picture (§11.5)', async () => {
  for (const [flag, stepId] of Object.entries(TONING_STEPS)) {
    const said = `Toning and thiosulfate: skip ${flag === 'toning' ? 'gold toning' : 'thiosulfate'}`;
    // a new standard baseline: both made in full, each with the steps its own settings need
    {
      const { h, w, expId } = await planBench([said]);
      const state = w.CortexLab.getState();
      assert.deepEqual(Array.from(state.runOrder), ['run-1', 'run-2']);
      const [base, copy] = ['run-1', 'run-2'].map(id => state.runs[id]);
      assert.equal(base.events.length, 9, 'the standard baseline does every step');
      assert.equal(copy.events.length, 8, 'the copy does the steps it needs');
      assert.ok(!copy.events.some(e => e.step === stepId));
      assert.equal(copy.params[flag], false);
      assert.deepEqual({ ...state.sealed }, { 'run-1': expId, 'run-2': expId });
      assert.equal(
        text($(w, '#lab-sealed-ready .lab-dim')),
        'Both runs did every step their settings call for. What they show stays hidden until you reveal “Plan”.'
      );
      assert.equal(
        w.labRunTitle(copy),
        `Run 2 · copy of Run 1 · ${flag === 'toning' ? 'Gold toning' : 'Thiosulfate'}: skipped`
      );
      h.close();
    }
    // the seen baseline: kept open, the copy sealed; then an ordinary standard run is NOT sealed behind
    // the skip (the twin key reads toning / thiosulfate), while another run that skips is its twin
    const finishedStandard = async x => {
      await x.renderLabEntry();
      startRun(x);
      $(x, '#lab-run-all').click();
    };
    const { h, w, expId } = await planBench([said], { prepare: finishedStandard });
    const state = w.CortexLab.getState();
    assert.deepEqual({ ...state.sealed }, { 'run-2': expId });
    assert.equal(state.runs['run-2'].events.length, 8);
    const standard = startRun(w);
    $(w, '#lab-run-all').click();
    assert.equal(state.sealed[standard.id], undefined, 'a standard run is not a twin of the skip');
    assert.equal(w.CortexLab.isSealed(standard.id), false);
    assert.doesNotMatch(text($(w, '#lab-live')), /matches a sealed run/);
    const card = $(w, '#lab-resolve-out .lab-result-card');
    assert.deepEqual(
      [card.dataset.labResult, card.querySelector('[data-lab-badge]').dataset.labBadge],
      ['illustrative-synthetic', 'simulated']
    );
    const twin = startRun(w, { what: 'toning-thiosulfate', value: flag });
    assert.equal(state.sealed[twin.id], expId, 'a run that skips the same step is the twin');
    // the reveal: the copy is Not modeled, so is the comparison
    const exp = state.experiments[expId];
    exp.status = 'revealed';
    const copy = state.runs['run-2'];
    const out = w.LAB.lab.resolve(copy);
    assert.equal(out.label, 'illustrative-synthetic', '§11.5: the skip is modeled (R-model-10)');
    assert.equal(copy.params[flag], false);
    change(w, $(w, '#lab-run-select'), 'run-2');
    const revealed = $(w, '#lab-resolve-out .lab-result-card');
    assert.equal(revealed.dataset.labResult, 'illustrative-synthetic');
    assert.equal(revealed.querySelector('[data-lab-badge]').dataset.labBadge, 'simulated');
    h.close();
  }
});
test('TONING load: a twin seal written before the fix (a standard run sealed behind a skip) is dropped; a true twin keeps its seal', async () => {
  const seed = harness({ url: 'http://localhost/lab?view=bench' });
  seed.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await seed.w.renderLabEntry();
  startRun(seed.w);
  $(seed.w, '#lab-run-all').click(); // run-1, standard, seen
  const exp = seed.w.CortexLab.newExperiment({
    title: 'Plan',
    changed: ['Toning and thiosulfate: skip gold toning'],
  });
  const made = seed.w.labMakeSealedPair(seed.w.LAB.lab, exp.id); // run-2: the skip copy, sealed
  assert.equal(made.experimental.id, 'run-2');
  startRun(seed.w); // run-3: standard (not a twin under the new key)
  startRun(seed.w, { what: 'toning-thiosulfate', value: 'toning' }); // run-4: a true twin
  const state = seed.w.CortexLab.getState();
  assert.deepEqual({ ...state.sealed }, { 'run-2': exp.id, 'run-4': exp.id });
  // what the old key had written: the standard run sealed as a twin of the skip copy
  state.sealed['run-3'] = exp.id;
  assert.ok(seed.w.CortexLab.save());
  const store = seed.store.get(STATE_KEY);
  assert.equal(JSON.parse(store).sealed['run-3'], exp.id);
  seed.close();
  const h = harness({ url: 'http://localhost/lab?view=bench&run=run-3', store: new Map([[STATE_KEY, store]]) });
  const { w } = h;
  assert.deepEqual({ ...w.CortexLab.getState().sealed }, { 'run-2': exp.id, 'run-4': exp.id }, 'dropped on load');
  await w.renderLabEntry();
  assert.equal(w.CortexLab.isSealed('run-3'), false);
  assert.equal(w.CortexLab.isSealed('run-4'), true);
  $(w, '#lab-run-all').click();
  assert.equal($(w, '#lab-resolve-out .lab-result-card').dataset.labResult, 'illustrative-synthetic');
  // the next save writes the pruned seals
  assert.deepEqual(Object.keys(JSON.parse(h.store.get(STATE_KEY)).sealed).sort(), ['run-2', 'run-4']);
  h.close();
});
test('TONING run names: set-up runs, copies and older copies say a change the same way ("Developer strength: weaker", CortexLab.paramText)', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  const L = w.CortexLab;
  const words = L.paramText('development.strength', 'weak');
  assert.equal(words, 'Developer strength: weaker');
  const setUp = startRun(w, { what: 'developer-strength', value: 'weak' });
  assert.equal(text($(w, '.lab-setup-line')), 'Practice specimen A · high burden · Practice the procedure');
  assert.equal(L.runHeading(setUp), `Run 1 · Practice specimen A · high burden · ${words}`);
  $(w, '#lab-setup-toggle').click();
  // SHELF (§13.3): a free run starts on the jars ("the procedure's jars"); an older one that changed a
  // setting says it the same way
  const mixed = startRun(w, { mode: 'free', what: 'developer-strength', value: 'weak' });
  assert.match(
    text($(w, '#lab-live')),
    /started on Practice specimen A · high burden: Free bench, the procedure’s jars\.$/
  );
  assert.equal(text($(w, '.lab-setup-line')), `Practice specimen A · high burden · Free bench · ${words}`);
  assert.equal(L.runHeading(mixed), `Run 2 · Practice specimen A · high burden · ${words}`);
  const standard = startRun(w);
  $(w, '#lab-run-all').click();
  $(w, '#lab-compare-open').click();
  change(w, $(w, '#lab-change-what'), 'developer-strength');
  change(w, $(w, '[data-lab-change-value="weak"]'), true);
  $(w, '#lab-pair-form').dispatchEvent(submit(w));
  const state = L.getState();
  const copy = state.runs[state.runOrder.at(-1)];
  assert.equal(copy.label, `copy of Run ${standard.id.split('-')[1]} · ${words}`);
  assert.equal(mixed.mode, 'free');
  assert.equal(L.runHeading(copy), `${L.runTitle(copy)} · Practice specimen A · high burden`);
  // older saves: a lower-case copy name and the first pair label read the same way
  assert.equal(
    w.labRunTitle({ id: 'run-7', label: 'copy of Run 3 · developer strength: weaker; washes: changed' }),
    `Run 7 · copy of Run 3 · ${words}; Washes: changed`
  );
  assert.equal(
    w.labRunTitle({ id: 'run-8', label: 'pair of run-3: development.strength=weak' }),
    `Run 8 · copy of Run 3 · ${words}`
  );
  assert.equal(w.labRunTitle({ id: 'run-9', label: 'my own name' }), 'Run 9 · my own name');
  h.close();
});
test('TONING lab.css: a skipped step looks unlike done or next (dashed number), in the list, the pick list and the sheet', () => {
  const css = read('lab.css');
  assert.match(css, /\.lab-step-skipped \.lab-step-order \{ border-style: dashed; \}/);
  assert.doesNotMatch(css, /lab-pick-skipped|lab-pick-n/, 'no pick list any more (§11.1)');
  assert.match(css, /\.lab-sheet-skipped \{[^}]*border-left: 3px dashed/);
  assert.match(css, /@media \(forced-colors: active\) \{ \.lab-sheet-skipped \{ border-left-color: CanvasText; \}/);
});

/* ---------- GAME-shell (contract §10): hints that say what a control does, the 3D HUD, the slide chip ---------- */
// Kevin: "options like click this, drag this here, click this to do that. Like a game, but don't force
// it". jsdom has no layout: the tests stub document.elementFromPoint to say what lies under the pointer.
const pointer = (w, node, type, x, y) =>
  node.dispatchEvent(
    new w.PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerId: 7,
      isPrimary: true,
      button: type === 'pointermove' ? -1 : 0,
    })
  );
// Drags the list's slide chip from (10, 10) to (200, 300) over `target`, and lets go there unless told not to.
function dragSlide(w, target, { drop = true } = {}) {
  w.document.elementFromPoint = () => target;
  const chip = $(w, '[data-lab-slide-chip]');
  pointer(w, chip, 'pointerdown', 10, 10);
  pointer(w, chip, 'pointermove', 200, 300);
  if (drop) pointer(w, chip, 'pointerup', 200, 300);
}
const hudChips = w => $$(w, '[data-lab-hud] .lab-hint').map(n => [n.dataset.labHudHint, text(n)]);

test('GAME-1 Show hints: on by default (older saves merge to on); a Run menu checkbox saves it, keeps html.lab-hints-off in sync and emits hints; setHints refuses a non-boolean; a saved non-boolean is refused', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  const off = () => w.document.documentElement.classList.contains('lab-hints-off');
  assert.equal(w.CortexLab.hintsOn(), true, 'on by default');
  assert.equal(w.CortexLab.getState().settings.hints, true);
  assert.equal(off(), false);
  assert.equal(w.CortexLab.touch(), false, 'a fine pointer');
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  const box = $(w, '#lab-hints-toggle');
  assert.equal(box.type, 'checkbox');
  assert.equal(box.checked, true);
  assert.equal(text(box.closest('label')), 'Show hints');
  assert.equal(box.closest('label').id, 'lab-hints-row');
  assert.ok(box.closest('#lab-run-menu'), 'in the Run menu');
  assert.equal($(w, '#lab-run-menu').hidden, true, 'inside the closed menu: not a first-view control');
  const seen = [];
  w.CortexLab.events.on('hints', on => seen.push(on));
  $(w, '#lab-run-menu-btn').click();
  box.focus();
  change(w, box, false);
  assert.equal(w.CortexLab.hintsOn(), false);
  assert.equal(off(), true, 'html.lab-hints-off');
  assert.equal(JSON.parse(h.store.get(STATE_KEY)).settings.hints, false, 'saved');
  assert.deepEqual(seen, [false], "one 'hints' event");
  assert.equal($(w, '#lab-run-menu').hidden, false, 'the menu stays open');
  assert.equal(w.document.activeElement, box, 'focus stays on the box');
  // the API: a non-boolean changes nothing; true turns the hints back on and ticks the box
  assert.equal(w.CortexLab.setHints('yes'), false);
  assert.equal(w.CortexLab.hintsOn(), false);
  assert.deepEqual(seen, [false]);
  assert.equal(w.CortexLab.setHints(true), true);
  assert.equal(off(), false);
  assert.equal(box.checked, true);
  assert.deepEqual(seen, [false, true]);
  w.CortexLab.setHints(false);
  const { store } = h;
  h.close();
  // a reload reads it back and sets the class at load, before any view renders
  const again = harness({ url: 'http://localhost/lab?view=bench', store });
  assert.equal(again.w.CortexLab.hintsOn(), false);
  assert.ok(again.w.document.documentElement.classList.contains('lab-hints-off'));
  await again.w.renderLabEntry();
  assert.equal($(again.w, '#lab-hints-toggle').checked, false);
  again.close();
  // a save from before the setting merges to on; a non-boolean is refused with the rest of the state
  const saved = settings => new Map([[STATE_KEY, JSON.stringify({ v: 1, runs: {}, runOrder: [], settings })]]);
  const old = harness({ store: saved({ readAloud: true }) });
  assert.equal(old.w.LAB.stateError, null);
  assert.equal(old.w.CortexLab.hintsOn(), true);
  assert.equal(old.w.CortexLab.getState().settings.readAloud, true);
  old.close();
  const bad = harness({ store: saved({ hints: 'off' }) });
  assert.ok(bad.w.LAB.stateError, 'refused');
  assert.equal(bad.w.CortexLab.hintsOn(), true, 'an empty workspace');
  bad.close();
});

test('GAME-2 list mode: the slide chip drags onto any step (the path of "Do a different step"); a still press, Escape, pointercancel and a drop outside change nothing; rows click to explain and always say so; the chip and the drop hints only while a step is left', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  const row = id => $(w, `.lab-step[data-lab-step="${id}"]`);
  const title = id => w.CortexLab.stepTitle(id);
  // before a run: no chip and no drop hint; a row still explains its step, and says so (GAME-FIX:
  // the hint line above the list, the row's Click verb)
  assert.equal($(w, '[data-lab-slide-chip]'), null);
  assert.equal($(w, '#lab-drop-note'), null);
  assert.equal(text($(w, '.lab-list-hints')), 'Click a step: what it does');
  assert.equal($(w, '.lab-list-hints').getAttribute('aria-hidden'), 'true');
  assert.ok($(w, '.lab-list-hints').nextElementSibling.matches('.lab-step-list'), 'right above the list');
  assert.deepEqual(
    [...new Set($$(w, '.lab-step .lab-step-verbs').map(text))],
    ['Click: what it does'],
    'every row: what a click does, no drop'
  );
  row('development').querySelector('.lab-step-title').click();
  assert.equal(text($(w, '#lab-sheet-h')), title('development'));
  assert.equal(w.document.activeElement.id, 'lab-sheet-h');
  $(w, '#lab-sheet-close').click();
  assert.equal($(w, '#lab-sheet').hidden, true);
  const run = startRun(w);
  const get = () => w.CortexLab.getState().runs[run.id];
  const chip = () => $(w, '[data-lab-slide-chip]');
  assert.equal(chip().tagName, 'DIV', 'a div, not a control');
  assert.equal(chip().getAttribute('aria-hidden'), 'true');
  assert.equal(text(chip()), 'Your slide');
  assert.ok(chip().closest('#lab-do'), 'in 2. Do the steps');
  assert.ok(chip().compareDocumentPosition($(w, '.lab-step-list')) & 4, 'above the list');
  assert.equal($(w, '.lab-list-hints'), null, 'the play bar carries the click hint while a drop is possible');
  assert.deepEqual($$(w, '.lab-play .lab-hint').map(text), [
    'Drag the slide onto a step: dip it',
    'Click a step: what it does',
  ]);
  assert.equal($(w, '.lab-play .lab-hints').getAttribute('aria-hidden'), 'true');
  const note = () => $(w, '#lab-drop-note');
  assert.equal(note().getAttribute('role'), 'status');
  assert.equal(text(note()), '');
  // every row says what a click and a drop do (lab.css shows it on hover); nothing new to tab to
  const verbs = $$(w, '.lab-step .lab-step-verbs');
  assert.equal(verbs.length, 9);
  for (const node of verbs) {
    assert.equal(node.getAttribute('aria-hidden'), 'true');
    assert.equal(text(node), 'Click: what it does Drop the slide: dip');
  }
  assert.equal($$(w, '.lab-step[tabindex], .lab-step button').length, 0, 'rows stay plain list items');
  // the UX-R2 budget, unchanged (no WebGL2 in this harness, so the 3D toggle is disabled and not counted)
  assert.deepEqual(firstViewControls(w), [
    'lab-run-menu-btn',
    'lab-notes-toggle',
    'lab-do-step',
    'lab-run-all',
    'lab-explain-open',
  ]);
  // a press that does not move is no drag
  w.document.elementFromPoint = () => row('development');
  pointer(w, chip(), 'pointerdown', 10, 10);
  pointer(w, chip(), 'pointermove', 12, 11);
  assert.equal($(w, '.lab-slide-ghost'), null, 'below the drag threshold');
  pointer(w, chip(), 'pointerup', 12, 11);
  assert.equal(get().events.length, 0);
  // a drag: a ghost follows the pointer, the row under it lights up, the ghost says what a drop does
  // (MODE §11.1: in practice only the next jar takes the slide; another row says which step is next)
  dragSlide(w, row('development').querySelector('.lab-step-title'), { drop: false });
  const ghost = $(w, '.lab-slide-ghost');
  assert.ok(ghost, 'a ghost follows the pointer');
  assert.equal(ghost.getAttribute('aria-hidden'), 'true');
  assert.deepEqual([ghost.style.left, ghost.style.top], ['200px', '300px']);
  assert.equal(text(ghost), `Next in the procedure: ${title('deparaffinize-rehydrate')}`);
  assert.ok(row('development').classList.contains('lab-step-over'));
  assert.ok(row('development').classList.contains('lab-step-drop-no'), 'dashed: the drop would do nothing');
  press(w, w.document.body, 'Escape');
  dragSlide(w, row('deparaffinize-rehydrate'), { drop: false });
  assert.equal(text($(w, '.lab-slide-ghost')), `Drop here: ${title('deparaffinize-rehydrate')}`);
  assert.ok(!row('deparaffinize-rehydrate').classList.contains('lab-step-drop-no'));
  assert.ok(chip().classList.contains('lab-dragging'));
  assert.ok($(w, '#lab-do').classList.contains('lab-slide-dragging'), 'lab.css hides the sticky bar meanwhile');
  // Escape cancels: the ghost and the highlight go, nothing is recorded, a later release does nothing
  press(w, w.document.body, 'Escape');
  assert.equal($(w, '.lab-slide-ghost'), null);
  assert.equal($$(w, '.lab-step-over').length, 0);
  assert.ok(!chip().classList.contains('lab-dragging'));
  assert.ok(!$(w, '#lab-do').classList.contains('lab-slide-dragging'));
  pointer(w, chip(), 'pointerup', 200, 300);
  assert.equal(get().events.length, 0, 'Escape cancelled the drag');
  // pointercancel cancels too
  dragSlide(w, row('development'), { drop: false });
  pointer(w, chip(), 'pointercancel', 200, 300);
  assert.equal($(w, '.lab-slide-ghost'), null);
  pointer(w, chip(), 'pointerup', 200, 300);
  assert.equal(get().events.length, 0);
  // a drop outside the rows does nothing and says nothing
  dragSlide(w, $(w, '#lab-do-h'));
  assert.equal(get().events.length, 0);
  assert.equal($(w, '.lab-slide-ghost'), null);
  assert.equal(text(note()), '');
  // a drop on another jar: refused on that row, nothing recorded; the next jar takes the slide
  dragSlide(w, row('development'));
  assert.equal(get().events.length, 0);
  assert.equal(text(note()), `${title('development')}: Next in the procedure: ${title('deparaffinize-rehydrate')}`);
  dragSlide(w, row('deparaffinize-rehydrate'));
  assert.deepEqual(Array.from(get().events.map(e => e.step)), ['deparaffinize-rehydrate']);
  assert.match(
    text($(w, '#lab-live')),
    /^Remove the wax and rehydrate done\.( [^.]+\.)* 1 of 9 steps done\. Next: First silver bath\.$/
  );
  assert.equal($(w, '.lab-slide-ghost'), null);
  assert.ok(row('deparaffinize-rehydrate').classList.contains('lab-step-done'));
  assert.equal(w.document.activeElement.id, 'lab-do-step');
  // a row's click opens its own step's sheet (it does not follow the next step)
  row('water-wash').click();
  assert.equal(text($(w, '#lab-sheet-h')), title('water-wash'));
  assert.equal($(w, '#lab-explain-open').getAttribute('aria-expanded'), 'false');
  assert.equal(get().events.length, 1, 'a click explains, it never does the step');
  $(w, '#lab-sheet-close').click();
  // finished: no chip and no drop hints; the rows still explain, and say so
  $(w, '#lab-run-all').click();
  assert.equal(chip(), null);
  assert.equal($(w, '.lab-play'), null);
  assert.equal(text($(w, '.lab-list-hints')), 'Click a step: what it does');
  assert.deepEqual([...new Set($$(w, '.lab-step .lab-step-verbs').map(text))], ['Click: what it does']);
  assert.equal($(w, '#lab-drop-note'), null);
  row('water-wash').click();
  assert.equal(text($(w, '#lab-sheet-h')), title('water-wash'));
  assert.match(text($(w, '#lab-sheet')), /This run is finished/);
  h.close();
});

test('GAME-3 refused drops say why and change nothing: safety notes not read, a step the settings skip, a finished run, a locked run (labDropHint; api.dropHint gives the same words)', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  const lab = w.LAB.lab;
  const state = w.CortexLab.getState();
  const row = id => $(w, `.lab-step[data-lab-step="${id}"]`);
  const note = () => text($(w, '#lab-drop-note'));
  assert.equal(
    w.labDropHint(lab, { runId: null }, 'development'),
    'No run yet: Start the run is under Your slide, above'
  );
  assert.equal(w.labStepState(lab, { runId: null }, 'development'), null);
  // a step the run's settings skip: its row offers no drop, the drop is refused
  const skip = startRun(w, { what: 'toning-thiosulfate', value: 'toning' });
  const events = () => state.runs[skip.id].events.length;
  const before = events();
  assert.equal(text(row('gold-toning').querySelector('.lab-step-verbs')), 'Click: what it does');
  dragSlide(w, row('gold-toning'), { drop: false });
  assert.ok(row('gold-toning').classList.contains('lab-step-drop-no'), 'a dashed highlight');
  assert.equal(text($(w, '.lab-slide-ghost')), 'Your settings skip this step');
  pointer(w, $(w, '[data-lab-slide-chip]'), 'pointerup', 200, 300);
  const gold = w.CortexLab.stepTitle('gold-toning');
  assert.equal(note(), `${gold}: Your settings skip this step`, 'the note names the step');
  assert.equal(events(), before);
  assert.equal(w.labStepState(lab, { runId: skip.id }, 'gold-toning'), 'skipped');
  // the safety notes reset elsewhere (the list still shows the chip): refused before anything else
  state.safetyAcknowledgedAt = null;
  dragSlide(w, row('development'));
  const develop = w.CortexLab.stepTitle('development');
  assert.equal(note(), `${develop}: The safety notes below open the bench`);
  assert.equal(events(), before);
  state.safetyAcknowledgedAt = ACK;
  // the note stays through a new drag, a cancel and a drop off the rows: the rows never jump under the
  // pointer (GAME-FIX); a drop that is taken clears it
  dragSlide(w, row('development'), { drop: false });
  assert.equal(note(), `${develop}: The safety notes below open the bench`);
  press(w, w.document.body, 'Escape');
  dragSlide(w, $(w, '#lab-do-h'));
  assert.equal(note(), `${develop}: The safety notes below open the bench`);
  dragSlide(w, row('deparaffinize-rehydrate'));
  assert.equal(events(), before + 1);
  assert.equal(note(), '', 'a taken drop clears the note');
  // finished elsewhere: refused (no redo from a drop)
  const p = w.labStepProgress(lab, state.runs[skip.id]);
  for (const step of p.needed) w.CortexLab.applyEvent(skip.id, { type: 'step', step: step.id });
  const done = events();
  dragSlide(w, row('development'));
  assert.equal(note(), `${develop}: This run is finished`);
  assert.equal(events(), done);
  // a run cited by a report entry is locked
  $(w, '#lab-setup-toggle').click();
  const locked = startRun(w);
  state.notebook.entries.push({
    id: 'entry-1',
    type: 'simulated',
    section: 'methods',
    runId: locked.id,
    label: 'no-basis',
    text: 'noted',
  });
  dragSlide(w, row('development'));
  assert.equal(note(), `${develop}: This run is locked`);
  assert.equal(state.runs[locked.id].events.length, 0);
  // the other reasons, from the pure helper
  assert.equal(w.labDropHint(lab, { runId: locked.id }, 'nope'), 'That is not one of this run’s steps');
  const cps = w.CortexLab.newRun({ specimenId: 'SPEC-SYN-AD-01', method: 'cps-i' });
  assert.equal(w.labDropHint(lab, { runId: cps.id }, 'development'), 'This run has no bench steps');
  assert.equal(w.labStepState(lab, { runId: cps.id }, 'development'), null, 'a compare-only run');
  h.close();
});

test('GAME-4 3D HUD under the stage: the bench phase only, the bench’s rules (FIX2 E3; the rack’s drag chip while a drop would do a step), hidden while the intro or the dive plays, the explore chip inside the tissue; api.stepState / dropHint / hintsOn / canLook', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  const hud = () => $(w, '[data-lab-hud]');
  assert.ok(hud().classList.contains('lab-hud'));
  assert.equal(hud().tagName, 'DIV');
  assert.equal(hud().getAttribute('aria-hidden'), 'true');
  assert.ok(!hud().closest('#lab-clip-stage, .lab-clip-layout'), 'outside the clip stage’s group (MODE-FIX-shell-16)');
  assert.ok(
    hud().previousElementSibling.matches('#lab-stations'),
    'under the station row (§11.2), in the flow (GAME-FIX, D1)'
  );
  assert.ok(
    hud().previousElementSibling.previousElementSibling.matches('.lab-clip-layout'),
    'the row sits directly under the stage (its layout, MODE-FIX-shell-16)'
  );
  assert.ok(hud().previousElementSibling.previousElementSibling.contains($(w, '#lab-bench-3d')));
  assert.equal(hud().closest('#lab-bench-3d'), null, 'outside the container the bench clears');
  assert.equal(hud().hidden, false);
  assert.equal(hud().dataset.labHud, 'bench');
  assert.deepEqual(
    hudChips(w),
    [
      ['turn', 'Drag: turn the bench'],
      ['zoom', 'Ctrl/⌘ + scroll: zoom'],
      ['click', 'Click anything: what it is'],
      ['double', 'Double-click: do it'],
      ['sign', 'Click a sign: go to that station'],
    ],
    'no run: the rules, no rack drag (nothing to dip)'
  );
  const api = fake.api();
  assert.equal(api.canLook(), false);
  assert.equal(api.stepState('development'), null);
  assert.equal(api.dropHint('development'), 'No run yet: Start the run is under Your slide, above');
  assert.equal(api.hintsOn(), true);
  startRun(w);
  assert.deepEqual(
    hudChips(w).map(c => c[0]),
    ['turn', 'zoom', 'click', 'double', 'drop', 'sign'],
    'mid-run: the rack’s drag joins the rules'
  );
  assert.equal(hudChips(w)[4][1], 'Drag the rack onto a jar: dip');
  assert.equal(api.canLook(), false);
  assert.equal($$(w, '[data-lab-hud]').length, 1, 'one HUD across redraws');
  assert.equal(api.stepState('deparaffinize-rehydrate'), 'next');
  assert.equal(api.stepState('development'), 'todo');
  assert.equal(api.stepState('nope'), null);
  assert.equal(api.dropHint('deparaffinize-rehydrate'), '');
  assert.equal(
    api.dropHint('development'),
    'Next in the procedure: Remove the wax and rehydrate',
    '§11.1: only the next jar'
  );
  api.onEvent({ type: 'step', step: 'deparaffinize-rehydrate' }); // a drop sends what a double click sends
  assert.equal(api.stepState('deparaffinize-rehydrate'), 'done');
  assert.equal(
    api.dropHint('deparaffinize-rehydrate'),
    'Done. Next: First silver bath',
    'a done step is not done again in practice'
  );
  assert.equal(api.stepState('silver-impregnation'), 'next');
  assert.deepEqual(
    [api.stepCount('deparaffinize-rehydrate'), api.stepCount('development'), api.stepCount('nope')],
    [1, 0, 0],
    'MODE-bench3d-2: the count behind "done ×N"'
  );
  // the intro hides the HUD; it comes back on the bench
  $(w, '#lab-clip-intro').click();
  assert.equal(hud().hidden, true);
  assert.equal(hud().dataset.labHud, '');
  fake.handle.skip();
  assert.equal(hud().hidden, false);
  assert.equal(hud().dataset.labHud, 'bench');
  // the dive hides it; inside the tissue, Explore shows its own chip only
  $(w, '#lab-clip-dive').click();
  assert.equal(hud().hidden, true);
  api.onEnd('dive');
  press(w, $(w, '#lab-clip-stage'), 'e');
  assert.equal(hud().dataset.labHud, 'explore');
  assert.deepEqual(hudChips(w), [['explore', 'Click a structure: what it is']]);
  $(w, '#lab-clip-surface').click();
  assert.equal(hud().dataset.labHud, 'bench');
  // a finished run: nothing to dip (no rack chip), and the drop says why; its picture can be looked at
  $(w, '#lab-run-all').click();
  assert.deepEqual(
    hudChips(w).map(c => c[0]),
    ['turn', 'zoom', 'click', 'double', 'sign']
  );
  assert.ok(
    hudChips(w).every(([, words]) => !/\b(jar|microscope|tray)\b/.test(words) || words.startsWith('Drag the rack')),
    'no chip names an object that may be off screen (E3)'
  );
  assert.equal(api.canLook(), true);
  // no chip is longer than eight words, and none orders a sequence (D5)
  for (const [, words] of hudChips(w)) {
    assert.ok(words.split(/\s+/).length <= 8, words);
    assert.doesNotMatch(words, /\bthen\b/i, words);
  }
  assert.equal(api.dropHint('development'), 'This run is finished');
  assert.equal(api.stepState('development'), 'done');
  // hints off: html.lab-hints-off hides the HUD (lab.css); the bench reads it for its tags
  w.CortexLab.setHints(false);
  assert.equal(api.hintsOn(), false);
  await flush();
  h.close();
  // the intro before the safety notes: no HUD, nothing on the bench works yet
  const gated = fakeBench();
  const g = harness({
    url: 'http://localhost/lab?view=bench&mode=3d&intro=1',
    benchModule: gated.module,
    webgl2: true,
  });
  await g.w.renderLabEntry();
  assert.ok(await mounted3d(g, gated));
  assert.equal($(g.w, '[data-lab-hud]').hidden, true, 'hidden while the intro plays');
  gated.handle.skip();
  assert.equal($(g.w, '[data-lab-hud]').hidden, true, 'and on the bench before the safety notes');
  assert.equal(gated.api().dropHint('development'), 'The safety notes below open the bench');
  await flush();
  g.close();
});

test('GAME-5 touch wording (Tap, Double-tap, Pinch); the hint by the result thumbnail; no Mix it up hint (SHELF)', async () => {
  const fake = fakeBench();
  const t = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  t.w.matchMedia = media({ '(pointer: coarse)': true });
  t.w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await t.w.renderLabEntry();
  assert.ok(await mounted3d(t, fake));
  assert.equal(t.w.CortexLab.touch(), true);
  startRun(t.w);
  assert.deepEqual(
    hudChips(t.w).map(c => c[1]),
    [
      'Drag sideways: turn the bench',
      'Pinch: zoom',
      'Tap anything: what it is',
      'Double-tap: do it',
      'Drag the rack onto a jar: dip',
      'Tap a sign: go to that station',
    ],
    'a vertical drag scrolls the page on touch, so the turn chip says sideways'
  );
  $(t.w, '#lab-run-all').click();
  assert.ok(!hudChips(t.w).some(c => c[0] === 'drop'), 'finished: no rack drag');
  startRun(t.w); // a new run: the slide chip again in list mode
  $(t.w, '#lab-mode-toggle').click();
  assert.deepEqual($$(t.w, '.lab-play .lab-hint').map(text), [
    'Drag the slide onto a step: dip it',
    'Tap a step: what it does',
  ]);
  $(t.w, '#lab-run-all').click();
  assert.equal(text($(t.w, '.lab-thumb-hints')), 'Tap the slide: open the microscope');
  await flush();
  t.close();
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  // SHELF (§13.3): the free bench's Mix panel (and its hint) left with its settings, which are the jars now
  change(w, $(w, '#lab-bench-mode input[value="free"]'), true);
  assert.equal($(w, '.lab-mix-hints'), null);
  change(w, $(w, '#lab-bench-mode input[value="practice"]'), true);
  $(w, '#lab-newrun').dispatchEvent(submit(w));
  $(w, '#lab-run-all').click();
  // the result: a hint under the thumbnail, outside the button (its name stays), gone while it is open
  const hint = $(w, '.lab-result-thumbwrap .lab-thumb-hints');
  assert.equal(text(hint), 'Click the slide: open the microscope');
  assert.equal(hint.getAttribute('aria-hidden'), 'true');
  assert.equal(hint.previousElementSibling, $(w, '#lab-scope-btn'));
  assert.equal(text($(w, '#lab-scope-btn')), 'Open in the microscope');
  $(w, '#lab-scope-btn').click();
  assert.equal($(w, '.lab-thumb-hints'), null);
  $(w, '#lab-mix-again').click();
  assert.equal($(w, '.lab-mix-hints'), null);
  h.close();
});

test('GAME lab.css: html.lab-hints-off hides every hint and the HUD; hints are caption text (no pill); the HUD is a row under the stage and never takes a click; row verbs only where the list has room; the sticky bar hides during a drag; the chip takes the touch drag; nothing animates; 44px on touch widths; forced colors; print', () => {
  const css = read('lab.css');
  const fix2 = css.indexOf('/* ---------- FIX2:');
  const game = css.slice(css.indexOf('/* ---------- GAME:'), fix2 > 0 ? fix2 : undefined);
  assert.ok(game.length > 100, 'the GAME block exists');
  assert.match(
    game,
    /html\.lab-hints-off \.lab-hint, html\.lab-hints-off \.lab-hints, html\.lab-hints-off \.lab-hud \{ display: none !important; \}/
  );
  assert.match(game, /\.lab-hud \{ position: static;[^}]*margin: 8px 0 0; pointer-events: none; \}/);
  assert.doesNotMatch(game, /\.lab-hud \{[^}]*(top|left|max-width):/, 'nothing pins the HUD over the scene');
  const hint = /\.lab-hint \{([^}]*)\}/.exec(game)[1];
  assert.match(hint, /display: inline;/);
  assert.doesNotMatch(hint, /border|background|padding|radius/, 'a hint is text, never a button look-alike');
  assert.doesNotMatch(game, /\.lab-hint[^{,]*\{[^}]*(border|border-radius|background):/, 'no hint rule draws a pill');
  assert.match(read('lab.css'), /\.lab-stage-box \{ position: relative; \}/, 'the stage hint stays over the stage');
  // the sticky bar hides during a drag only where it sticks (FIX2: a phone, list mode), next to the sticky rule
  assert.doesNotMatch(game, /#lab-do\.lab-slide-dragging #lab-do-step/);
  assert.match(
    read('lab.css'),
    /@media \(max-width: 560px\) and \(min-height: 520px\) \{\s*#lab-do:not\(\.lab-bench-3d\) #lab-do-step \{ position: sticky;[^}]*\}\s*html:has\([^}]*\}\s*#lab-do\.lab-slide-dragging #lab-do-step \{ visibility: hidden; \}\s*\}/
  );
  assert.match(game, /\.lab-slide-chip \{[^}]*cursor: grab; touch-action: none;/);
  assert.match(game, /\.lab-slide-ghost \{ position: fixed;[^}]*pointer-events: none;/);
  assert.doesNotMatch(game, /transition|animation/, 'nothing moves on its own (reduced motion)');
  assert.match(game, /\.lab-step-list-click \{ container-type: inline-size; \}/);
  assert.match(
    game,
    /@media \(hover: hover\) \{ @container \(min-width: 640px\) \{ \.lab-step-list-click \.lab-step:hover \.lab-step-verbs \{ display: block; \} \} \}/
  );
  assert.match(
    game,
    /\.lab-step-verbs \{ display: none; flex: 0 1000 auto; min-width: 0; overflow: hidden; white-space: nowrap;/,
    'the verbs give way before the title, on one line'
  );
  assert.match(
    game,
    /@media \(max-width: 768px\) \{\s*\.lab-slide-chip, \.lab-menu-panel > \.lab-menu-check \{ min-height: 44px; \}/
  );
  const forced = game.slice(game.indexOf('@media (forced-colors: active)'));
  assert.match(forced, /\.lab-slide-chip, \.lab-slide-ghost \{ border-color: CanvasText; \}/);
  assert.match(
    game,
    /@media print \{ \.lab-hints, \.lab-hud, \.lab-play, \.lab-drop-note, \.lab-step-verbs, \.lab-slide-ghost \{ display: none !important; \} \}/
  );
});

/* ---------- GAME-FIX-shell: the review round (contract §10 D1-D5) ---------- */
test('GAME-FIX-1 D2/D3 on the 3D bench: a click on the microscope or the brain tray shows its sheet after the jar delay, a double click (api.onAction) does it; the microscope opens only with a picture to look at (api.canLook), else its sheet says why in view', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  const api = fake.api();
  const sheet = () => $(w, '#lab-sheet');
  const reason = () => text($(w, '#lab-sheet [data-lab-look-reason]'));
  assert.equal(typeof api.onAction, 'function');
  assert.equal(typeof api.canLook, 'function');
  // a click: the sheet waits (a double click would cancel it), then opens
  api.onInspect('microscope');
  assert.equal(sheet().hidden, true, 'not at once');
  await sheetDelay();
  assert.equal(text($(w, '#lab-sheet-h')), 'Microscope');
  assert.equal(reason(), 'No run on the bench yet, so there is no picture to look at.', 'in view, not only spoken');
  $(w, '#lab-sheet-close').click();
  // a double click on the microscope with nothing to show: no pending sheet flashes, its sheet says why
  api.onInspect('microscope');
  api.onAction('microscope');
  assert.equal(sheet().hidden, false);
  assert.equal(reason(), 'No run on the bench yet, so there is no picture to look at.');
  assert.equal(text($(w, '#lab-live')), 'No run on the bench yet, so there is no picture to look at.');
  assert.match(w.location.search, /view=bench/, 'it stays on the bench');
  $(w, '#lab-sheet-close').click();
  const run = startRun(w);
  assert.equal(api.canLook(), false);
  api.onAction('microscope');
  assert.equal(reason(), 'Steps still to do: the picture comes once every step is done.');
  $(w, '#lab-sheet-close').click();
  // a double click on the tray plays the intro; the click's sheet never opens
  api.onInspect('specimen');
  api.onAction('specimen');
  assert.deepEqual(fake.last(), ['intro']);
  await sheetDelay();
  assert.equal(sheet().hidden, true, 'the double click cancelled the tray’s sheet');
  api.onAction('specimen');
  assert.equal(fake.calls.filter(c => c[0] === 'intro').length, 1, 'not again while it plays');
  fake.handle.skip();
  // other ids and the jars are not actions: nothing happens
  api.onAction('rack');
  api.onAction('development');
  assert.equal(sheet().hidden, true);
  assert.equal(w.CortexLab.getState().runs[run.id].events.length, 0);
  // a finished run with a picture: the double click opens the microscope on that run
  $(w, '#lab-run-all').click();
  assert.equal(api.canLook(), true);
  api.onInspect('microscope');
  w.CortexLabMicroscope = { mount: () => ({ destroy() {} }), renderSynthetic() {} };
  api.onAction('microscope');
  assert.ok(await until(w, 'main.lab-view-microscope'));
  assert.equal(new URLSearchParams(w.location.search).get('run'), run.id);
  await sheetDelay();
  await flush();
  h.close();
  // Not modeled (the run changes the washes; §11.5: skipping gold toning is modeled now): no picture
  const nm = fakeBench();
  const n = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: nm.module, webgl2: true });
  n.w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await n.w.renderLabEntry();
  assert.ok(await mounted3d(n, nm));
  startRun(n.w, { what: 'washes', value: 'deviated' });
  $(n.w, '#lab-run-all').click();
  assert.equal(nm.api().canLook(), false);
  assert.ok(!hudChips(n.w).some(c => /microscope/.test(c[1])), 'no chip promises a picture');
  nm.api().onAction('microscope');
  assert.equal(text($(n.w, '#lab-sheet [data-lab-look-reason]')), 'Not modeled: this run has no picture to look at.');
  await flush();
  n.close();
  // sealed until the experiment is revealed
  const fs3 = fakeBench();
  const { h: sh, w: sw } = await sealedBench({ benchModule: fs3.module });
  sw.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await sw.renderLabEntry();
  assert.ok(await mounted3d(sh, fs3));
  assert.equal(fs3.api().canLook(), false);
  fs3.api().onAction('microscope');
  assert.match(text($(sw, '#lab-sheet [data-lab-look-reason]')), /^Sealed until you reveal /);
  await flush();
  sh.close();
});

test('GAME-FIX-2 a step done on the 3D stage (a jar double click or a slide drop) leaves the page where it is; the buttons still bring the stage back into view', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  const { w } = h;
  const scrolled = [];
  w.Element.prototype.scrollIntoView = function (opts) {
    scrolled.push([this.id || this.className, opts && opts.block]);
  };
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  const run = startRun(w);
  scrolled.length = 0;
  fake.api().onEvent({ type: 'step', step: 'deparaffinize-rehydrate' });
  assert.equal(w.CortexLab.getState().runs[run.id].events.length, 1);
  assert.deepEqual(scrolled, [], 'no scroll from the stage');
  assert.equal(w.document.activeElement.id, 'lab-clip-stage', 'focus stays on the stage (MODE-FIX-shell-18)');
  $(w, '#lab-do-step').click();
  assert.deepEqual(scrolled, [['lab-do', 'start']], 'Do this step brings the stage back (UX-POLISH)');
  // the last step from the stage: the run finishes, the page stays put
  scrolled.length = 0;
  const p = w.labStepProgress(w.LAB.lab, w.CortexLab.getState().runs[run.id]);
  for (const step of p.needed.filter(s => !p.done.has(s.id))) fake.api().onEvent({ type: 'step', step: step.id });
  assert.equal(w.labStepProgress(w.LAB.lab, w.CortexLab.getState().runs[run.id]).next, null);
  assert.deepEqual(scrolled, []);
  await flush();
  h.close();
});

test('GAME-FIX-3 a deviation line names each deviation once (two drops out of order on the same step): result card, Why?, History, CortexLab.flags', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  const run = startRun(w);
  // MODE §11.1: the bench refuses an out-of-order step in practice; an older save (or the API) can still
  // carry such events, and the lines name each deviation once
  for (let i = 0; i < 3; i++) w.CortexLab.applyEvent(run.id, { type: 'step', step: 'ammonium-hydroxide-wash' });
  change(w, $(w, '#lab-run-select'), run.id);
  const saved = w.CortexLab.getState().runs[run.id];
  assert.ok(saved.deviations.filter(d => d.kind === 'out-of-order').length >= 2, 'the log keeps every one');
  $(w, '#lab-run-all').click();
  const name = w.CortexLab.stepTitle('ammonium-hydroxide-wash');
  const line = `Done out of order: ${name}; Done twice: ${name}.`;
  assert.equal(text($(w, '.lab-result-flag')), line);
  assert.deepEqual(Array.from(w.CortexLab.flags(saved, w.LAB.lab.resolve(saved))), [line]);
  $(w, '[data-lab-why="result"] .lab-drawer-btn').click();
  assert.ok(text($(w, '[data-lab-why="result"]')).includes(line));
  $(w, '#lab-run-menu-btn').click();
  $(w, '#lab-history-toggle').click();
  assert.match(
    text($(w, '#lab-history .lab-log')),
    new RegExp(`Deviations: ${line.slice(0, -1).replace(/[()]/g, '\\$&')}`)
  );
  h.close();
});

test('GAME-FIX-4 list mode on a phone: the dragged slide scrolls the page near the top bar or the window bottom (labDragScrollDelta), re-reads the row under the still finger and stops on the drop', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  // a 640 px window under a 100 px top bar
  const d = (y, armed) => w.labDragScrollDelta(y, 100, 640, armed);
  // the pure step: 0 between the bands, faster nearer an edge, at most 4 px a frame (MODE-FIX-shell-7: about
  // a row every 200 ms, so the tip under a resting finger reads before the lift), only armed edges
  assert.equal(d(300), 0);
  assert.equal(d(592), 0, 'the band starts 48 px from the bottom');
  assert.ok(d(600) > 0 && d(600) < d(630));
  assert.equal(d(640), 4);
  assert.equal(d(900), 4, 'past the edge: full speed');
  assert.ok(d(140) < 0 && d(140) > d(110));
  assert.equal(d(100), -4);
  assert.equal(d(20), -4, 'over the top bar: full speed up');
  assert.equal(d(630, { up: true, down: false }), 0, 'an edge the drag started in waits');
  assert.equal(d(110, { up: false, down: true }), 0);
  assert.equal(w.labDragScrollDelta(300, 0, 80), 0, 'a window too short for two bands');
  assert.equal(w.labDragScrollDelta(NaN, 0, 640), 0);
  // the drag: a frame loop scrolls while the finger rests in the bottom band
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  const run = startRun(w, { mode: 'free' }); // any row takes the slide (§11.1)
  const row = id => $(w, `.lab-step[data-lab-step="${id}"]`);
  const frames = [];
  let cancelled = 0;
  w.requestAnimationFrame = fn => frames.push(fn);
  w.cancelAnimationFrame = () => cancelled++;
  let y = 0;
  const steps = [];
  Object.defineProperty(w, 'scrollY', { configurable: true, get: () => y });
  w.scrollBy = ({ top, behavior }) => {
    assert.equal(behavior, 'instant', 'no smooth scroll under a finger');
    steps.push(top);
    y += top;
  };
  const chip = $(w, '[data-lab-slide-chip]');
  const bottom = w.innerHeight - 4;
  let clock = 1000; // the drag's clock (performance.now)
  Object.defineProperty(w.performance, 'now', { configurable: true, value: () => clock });
  w.document.elementFromPoint = () => row('water-wash');
  pointer(w, chip, 'pointerdown', 10, 10);
  pointer(w, chip, 'pointermove', 40, bottom);
  assert.equal(frames.length, 1, 'one frame asked for');
  assert.equal(text($(w, '.lab-slide-ghost')), `Drop here: ${w.CortexLab.stepTitle('water-wash')}`);
  pointer(w, chip, 'pointermove', 41, bottom);
  assert.equal(frames.length, 1, 'never a second loop');
  // MODE-FIX-shell-7: the dwell. While the finger has rested in the band for less than 350 ms the rows hold
  // still (a drop now lands on the row the tip names); then the page scrolls and the row now under the
  // still finger is the one that lights up and takes the drop
  clock += 200;
  frames.shift()();
  assert.deepEqual(steps, [], 'no scroll within the dwell');
  assert.equal(frames.length, 1, 'the loop waits');
  assert.ok(row('water-wash').classList.contains('lab-step-over'), 'the tip still names the row under the finger');
  clock += 200;
  w.document.elementFromPoint = () => row('sodium-thiosulfate');
  frames.shift()();
  assert.ok(steps.length === 1 && steps[0] > 0 && steps[0] <= 4, 'scrolled down, at most 4 px a frame');
  assert.ok(row('sodium-thiosulfate').classList.contains('lab-step-over'));
  assert.ok(!row('water-wash').classList.contains('lab-step-over'));
  assert.equal(frames.length, 1, 'the loop goes on while the finger stays');
  pointer(w, chip, 'pointerup', 41, bottom);
  assert.equal(cancelled, 1, 'the drop stops the loop');
  assert.deepEqual(Array.from(w.CortexLab.getState().runs[run.id].events.map(jarOf)), ['sodium-thiosulfate']);
  // a drag that starts in the bottom band does not scroll until the finger has left it once
  frames.length = 0;
  steps.length = 0;
  const chip2 = $(w, '[data-lab-slide-chip]');
  pointer(w, chip2, 'pointerdown', 10, bottom - 10);
  pointer(w, chip2, 'pointermove', 30, bottom - 2);
  assert.equal(frames.length, 0);
  pointer(w, chip2, 'pointermove', 30, 300);
  pointer(w, chip2, 'pointermove', 30, bottom);
  assert.equal(frames.length, 1);
  press(w, w.document.body, 'Escape');
  assert.equal(cancelled, 2, 'Escape stops it too');
  // at the page's end the loop stops by itself
  frames.length = 0; // (a cancelled frame never runs)
  w.scrollBy = () => {};
  pointer(w, chip2, 'pointerdown', 10, 10);
  pointer(w, chip2, 'pointermove', 30, bottom);
  clock += 400;
  frames.shift()();
  assert.equal(frames.length, 0);
  press(w, w.document.body, 'Escape');
  // MODE-FIX-shell-6: the ghost stays inside the window (a 16 px gutter): centred on the pointer only where
  // its half width fits; measured after the tip is set (the width can change with it)
  Object.defineProperty(w, 'innerWidth', { configurable: true, value: 390 });
  Object.defineProperty(w.HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 312 });
  const chip3 = $(w, '[data-lab-slide-chip]');
  pointer(w, chip3, 'pointerdown', 10, 300);
  pointer(w, chip3, 'pointermove', 40, 400);
  assert.equal($(w, '.lab-slide-ghost').style.left, '172px', 'clamped to the left gutter');
  pointer(w, chip3, 'pointermove', 380, 400);
  assert.equal($(w, '.lab-slide-ghost').style.left, '218px', 'clamped to the right gutter');
  pointer(w, chip3, 'pointermove', 200, 400);
  assert.equal($(w, '.lab-slide-ghost').style.left, '200px', 'centred where it fits');
  delete w.HTMLElement.prototype.offsetWidth;
  press(w, w.document.body, 'Escape');
  h.close();
});

test('GAME-FIX-5 before a run the keyboard reaches every step sheet (Explain a step, then the sheet’s step select); the rack’s sheet names its drag while a drop would do a step', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  const explain = $(w, '#lab-do #lab-explain-open');
  assert.equal(text(explain), 'Explain a step');
  assert.equal(explain.tagName, 'BUTTON');
  assert.equal(explain.getAttribute('aria-controls'), 'lab-sheet');
  assert.equal(explain.getAttribute('aria-expanded'), 'false');
  assert.equal($$(w, '.lab-step[tabindex], .lab-step button').length, 0, 'still no tab stop per row');
  explain.click();
  assert.equal($(w, '#lab-sheet').hidden, false);
  assert.equal(text($(w, '#lab-sheet-h')), w.CortexLab.stepTitle('deparaffinize-rehydrate'));
  assert.equal($(w, '#lab-explain-open').getAttribute('aria-expanded'), 'true');
  const pick = $(w, '#lab-sheet-step');
  assert.ok(pick, 'the sheet’s step select reaches the others');
  change(w, pick, 'gold-toning');
  assert.equal(text($(w, '#lab-sheet-h')), w.CortexLab.stepTitle('gold-toning'));
  $(w, '#lab-sheet-close').click();
  assert.equal(w.document.activeElement.id, 'lab-explain-open', 'focus back on the opener');
  h.close();
  // the rack (3D): its sheet carries the drag while a drop would do a step, hidden with the hints
  const fake = fakeBench();
  const b = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  b.w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await b.w.renderLabEntry();
  assert.ok(await mounted3d(b, fake));
  fake.api().onInspect('rack');
  assert.equal(text($(b.w, '#lab-sheet-h')), 'Slide rack');
  assert.equal($(b.w, '#lab-sheet .lab-hint'), null, 'no run: no drag to promise');
  startRun(b.w);
  fake.api().onInspect('rack');
  const hint = $(b.w, '#lab-sheet .lab-sheet-hints');
  assert.equal(text(hint), 'Drag the rack onto a jar: dip the slide');
  assert.equal(hint.getAttribute('aria-hidden'), 'true');
  $(b.w, '#lab-run-all').click();
  fake.api().onInspect('rack');
  assert.equal($(b.w, '#lab-sheet .lab-hint'), null, 'finished: nothing to dip');
  await flush();
  b.close();
});

/* ---------- FIX2-shell: the second game re-walk (shared decisions E1-E6) ---------- */
// window.matchMedia for jsdom whose answers can change: `on` lists the queries that match now, and
// change(query, matches) tells that query's listeners (as a browser does when the window is resized).
function liveMedia(on = {}) {
  const listeners = new Map();
  const matchMedia = query => ({
    get matches() {
      return !!on[query];
    },
    media: query,
    addEventListener: (type, fn) => listeners.set(fn, query),
    removeEventListener: (type, fn) => listeners.delete(fn),
    addListener() {},
    removeListener() {},
  });
  matchMedia.change = (query, matches) => {
    on[query] = matches;
    for (const [fn, q] of [...listeners]) if (q === query) fn({ matches, media: query });
  };
  matchMedia.count = () => listeners.size;
  return matchMedia;
}
const NARROW_NOTES = '(max-width: 899.98px)'; // FIX3 G7 (was 1099.98px in FIX2)

test('FIX2-shell-1 E1: after a step the camera frames the rack’s station and the next step’s jar (frameStations, the select names the second); same station or an older bench: goToStation as before; never during a clip', async () => {
  const fake = fakeBench();
  const framed = [];
  fake.handle.frameStations = ids => {
    framed.push([...ids]);
    fake.calls.push(['frameStations', [...ids]]);
    return Promise.resolve(true);
  };
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  startRun(w);
  const flights = () => fake.calls.filter(c => c[0] === 'goToStation' || c[0] === 'frameStations');
  let n = flights().length;
  // step 1 (S1) done on the stage: the next jar (step 2) stands at S2
  fake.api().onEvent({ type: 'step', step: 'deparaffinize-rehydrate' });
  assert.deepEqual(flights().slice(n), [['frameStations', ['S1', 'S2']]]);
  assert.equal(stationNamed(w), 'S2', 'the select names the last framed station');
  // step 2 (S2): step 3 is at the same station, a plain flight there
  n = flights().length;
  $(w, '#lab-do-step').click();
  assert.deepEqual(flights().slice(n), [['goToStation', 'S2']]);
  // step 3 (S2) -> step 4 (S3)
  n = flights().length;
  fake.api().onEvent({ type: 'step', step: 'water-wash' });
  assert.deepEqual(flights().slice(n), [['frameStations', ['S2', 'S3']]]);
  // another jar (step 9 at S5 while step 4 is next): refused in practice, no flight (§11.1)
  n = flights().length;
  fake.api().onEvent({ type: 'step', step: 'final-wash-dehydrate-clear-mount' });
  assert.deepEqual(flights().slice(n), []);
  assert.equal(text($(w, '#lab-stage-hint')), 'Next in the procedure: Ammoniacal silver bath');
  // no camera move while a clip holds it
  fake.handle.dive();
  n = flights().length;
  $(w, '#lab-do-step').click();
  assert.equal(flights().length, n, 'no flight while the dive plays');
  fake.handle.surface();
  // the last step: the microscope station, as before (UX-LAST)
  n = flights().length;
  $(w, '#lab-run-all').click();
  assert.deepEqual(flights().slice(n), [['goToStation', 'S6']]);
  await flush();
  h.close();
  // an older bench without frameStations flies to the rack's station (the step just done)
  const old = fakeBench();
  const o = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: old.module, webgl2: true });
  o.w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await o.w.renderLabEntry();
  assert.ok(await mounted3d(o, old));
  startRun(o.w);
  old.api().onEvent({ type: 'step', step: 'deparaffinize-rehydrate' });
  assert.deepEqual(old.calls.filter(c => c[0] === 'goToStation').at(-1), ['goToStation', 'S1']);
  assert.equal(stationNamed(o.w), 'S1');
  await flush();
  o.close();
});

test('FIX2-shell-2 E3: the 3D HUD states the bench’s rules (Click anything, Double-click, a sign), never an object that may be off screen; the rack’s drag only while a drop would do a step; touch words; at most 8 words, no order', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  const words = () => hudChips(w).map(c => c[1]);
  const rules = [
    'Drag: turn the bench',
    'Ctrl/⌘ + scroll: zoom',
    'Click anything: what it is',
    'Double-click: do it',
    'Click a sign: go to that station',
  ];
  assert.deepEqual(words(), rules, 'no run: the rules alone');
  startRun(w);
  assert.deepEqual(words(), [...rules.slice(0, 4), 'Drag the rack onto a jar: dip', rules[4]]);
  // the rules hold at every station; the rack's chip follows the rack on screen (FIX3 G1, FIX3-shell-1)
  fake.api().onStation('S6');
  assert.deepEqual(words(), [...rules.slice(0, 4), 'Drag the rack onto a jar: dip', rules[4]]);
  for (const chip of words()) {
    assert.ok(chip.split(/\s+/).length <= 8, chip);
    assert.doesNotMatch(chip, /\bthen\b|\bfirst\b|\bnext\b/i, chip);
    assert.doesNotMatch(chip, /\b(microscope|tray|brain)\b/i, chip);
  }
  $(w, '#lab-run-all').click();
  assert.deepEqual(words(), rules, 'finished: nothing to dip, so no rack drag');
  await flush();
  h.close();
  const tf = fakeBench();
  const t = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: tf.module, webgl2: true });
  t.w.matchMedia = media({ '(pointer: coarse)': true });
  t.w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await t.w.renderLabEntry();
  assert.ok(await mounted3d(t, tf));
  startRun(t.w);
  assert.deepEqual(
    hudChips(t.w).map(c => c[1]),
    [
      'Drag sideways: turn the bench',
      'Pinch: zoom',
      'Tap anything: what it is',
      'Double-tap: do it',
      'Drag the rack onto a jar: dip',
      'Tap a sign: go to that station',
    ]
  );
  await flush();
  t.close();
});

test('FIX2-shell-3 list rows hold still: a click opens its sheet and keeps the row where it was (the column change is scrolled back), a double click’s second click opens nothing and keeps focus, the row whose sheet is open is marked', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  const row = id => $(w, `.lab-step[data-lab-step="${id}"]`);
  const viewing = () => $$(w, '.lab-step-viewing').map(n => n.dataset.labStep);
  // the sheet's column change moves the row 120 px down; the page scrolls by as much
  const scrolls = [];
  w.scrollBy = opts => scrolls.push([opts.top, opts.behavior]);
  // the row sits 120 px lower while the side sheet is open (the list's column is narrower)
  const box = () => {
    const top = $(w, '#lab-sheet').hidden ? 331 : 451;
    return { top, bottom: top + 44, left: 0, right: 300, width: 300, height: 44 };
  };
  const target = row('ammoniacal-silver');
  target.getBoundingClientRect = box;
  target.querySelector('.lab-step-title').dispatchEvent(new w.MouseEvent('click', { bubbles: true, detail: 1 }));
  assert.equal(text($(w, '#lab-sheet-h')), w.CortexLab.stepTitle('ammoniacal-silver'));
  assert.deepEqual(scrolls, [[120, 'instant']], 'the row keeps its height on screen');
  assert.deepEqual(viewing(), ['ammoniacal-silver']);
  assert.equal(w.document.activeElement.id, 'lab-sheet-h');
  // the second click of a double click on another row: no other sheet, no blur, no word selected
  const down = new w.MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 2 });
  row('gold-toning').dispatchEvent(down);
  assert.equal(down.defaultPrevented, true, 'focus stays in the sheet');
  row('gold-toning').dispatchEvent(new w.MouseEvent('click', { bubbles: true, detail: 2 }));
  assert.equal(text($(w, '#lab-sheet-h')), w.CortexLab.stepTitle('ammoniacal-silver'), 'only the first click counts');
  const single = new w.MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 1 });
  row('gold-toning').dispatchEvent(single);
  assert.equal(single.defaultPrevented, false, 'a single press is left alone');
  // the sheet's step select moves the mark; a redraw keeps it; Close clears it and scrolls the row back
  change(w, $(w, '#lab-sheet-step'), 'gold-toning');
  assert.deepEqual(viewing(), ['gold-toning']);
  $(w, '#lab-do-step').click();
  assert.deepEqual(viewing(), ['gold-toning'], 'kept across a redraw');
  scrolls.length = 0;
  row('gold-toning').getBoundingClientRect = box;
  $(w, '#lab-sheet-close').click();
  assert.deepEqual(viewing(), []);
  assert.deepEqual(scrolls, [[-120, 'instant']]);
  h.close();
});

test("FIX2-shell-4 E5 / MODE §11.1: after a step the bench says what happened where the student acted (the row in list mode, the stage hint in 3D), quiet for screen readers: in practice the stage's by-eye line, on the free bench the reaction; a done row says how many times; the next step clears the row note", async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  const lab = w.LAB.lab;
  const run = startRun(w);
  const row = id => $(w, `.lab-step[data-lab-step="${id}"]`);
  const state = id => text(row(id).querySelector('.lab-step-state'));
  const note = id => row(id).querySelector('.lab-step-note');
  // practice: the next jar takes the slide; the row shows the procedure's by-eye line for that stage
  dragSlide(w, row('deparaffinize-rehydrate'));
  const look = w.labRunLook(lab, w.CortexLab.getState().runs[run.id]);
  assert.ok(look && look.text, 'the engine gives a look after the first step');
  assert.equal(text(note('deparaffinize-rehydrate')), look.text);
  assert.equal(note('deparaffinize-rehydrate').getAttribute('aria-hidden'), 'true', 'the live region says it');
  assert.ok(text($(w, '#lab-live')).includes(look.text));
  assert.equal(state('deparaffinize-rehydrate'), '✓ done');
  assert.equal(row('deparaffinize-rehydrate').querySelector('.lab-step-verbs'), null, 'the note in place of the verbs');
  assert.equal($$(w, '.lab-step-note').length, 1);
  // a refused drop on another row: its reason there; the earlier note stays until a step is done
  dragSlide(w, row('ammonium-hydroxide-wash'));
  assert.equal(text(note('ammonium-hydroxide-wash')), 'Next in the procedure: First silver bath');
  // the next step in order: the earlier notes go; the state stays
  $(w, '#lab-do-step').click();
  assert.equal(note('ammonium-hydroxide-wash'), null);
  assert.equal(text(note('silver-impregnation')), w.labRunLook(lab, w.CortexLab.getState().runs[run.id]).text);
  assert.equal(state('deparaffinize-rehydrate'), '✓ done');
  // the free bench: the reaction on the row; done twice reads "done ×2"; no deviation line
  $(w, '#lab-setup-toggle').click();
  const free = startRun(w, { mode: 'free' });
  dragSlide(w, row('ammonium-hydroxide-wash'));
  const first = w.CortexLab.getState().runs[free.id].reactions.at(-1);
  assert.equal(text(note('ammonium-hydroxide-wash')), first.text);
  assert.equal(state('ammonium-hydroxide-wash'), '✓ done');
  assert.equal(text($(w, '#lab-live')), `Ammonia rinse: ${first.text}`);
  dragSlide(w, row('ammonium-hydroxide-wash'));
  assert.equal(state('ammonium-hydroxide-wash'), '✓ done ×2 2 times');
  assert.equal($$(w, '#lab-reactions > li').length, 2);
  assert.equal($(w, '.lab-result-flag'), null, 'no deviation line on the free bench');
  h.close();
});

test('FIX2-shell-5 D5: the no-run line and the intro’s end describe, never order (no "then")', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  assert.equal(text($(w, '#lab-3d-norun')), 'No run yet: Start the run is under Your slide, above.');
  for (const line of $$(w, '#lab-do p, #lab-do .lab-hint')) assert.doesNotMatch(text(line), /\bthen\b/i, text(line));
  h.close();
  const src = SRC.lab;
  assert.doesNotMatch(src, /then do its steps here|Do the steps below\./);
});

test('FIX2-shell-6 a sheet a pointer opened (a jar or object on the stage, a step row) closes without a scroll; one opened from a button still brings its button back into view', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  const { w } = h;
  const scrolled = [];
  w.Element.prototype.scrollIntoView = function (opts) {
    scrolled.push([this.id || this.className, opts && opts.block]);
  };
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  startRun(w);
  const below = () => {
    $(w, '#lab-do-step').getBoundingClientRect = () => ({
      top: 900,
      bottom: 970,
      left: 0,
      right: 300,
      width: 300,
      height: 70,
    });
    $(w, '#lab-explain-open').getBoundingClientRect = () => ({
      top: 990,
      bottom: 1020,
      left: 0,
      right: 200,
      width: 200,
      height: 30,
    });
  };
  fake.api().onInspect('deparaffinize-rehydrate');
  await sheetDelay();
  assert.equal($(w, '#lab-sheet').hidden, false);
  below();
  scrolled.length = 0;
  press(w, $(w, '#lab-sheet'), 'Escape');
  assert.equal($(w, '#lab-sheet').hidden, true);
  assert.equal(w.document.activeElement.id, 'lab-do-step', 'focus on Do this step');
  assert.deepEqual(scrolled, [], 'the page and the stage stay where they were');
  fake.api().onInspect('rack');
  below();
  $(w, '#lab-sheet-close').click();
  assert.deepEqual(scrolled, []);
  // Explain this step (a button): Close brings the button back into view
  $(w, '#lab-explain-open').click();
  below();
  scrolled.length = 0;
  $(w, '#lab-sheet-close').click();
  assert.equal(w.document.activeElement.id, 'lab-explain-open');
  assert.deepEqual(scrolled, [['lab-explain-open', 'nearest']]);
  await flush();
  h.close();
});

test('FIX2-shell-7 E4 notes below 900 px (FIX3 G7; was 1100): a bottom drawer, closed by default and remembered on its own; Notes opens it with focus in the textarea, Escape or Close closes it with focus back on Notes; crossing 900 px swaps to the column’s own state', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  const mm = liveMedia({ [NARROW_NOTES]: true });
  w.matchMedia = mm;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  const aside = () => $(w, '#lab-notepad');
  const toggle = () => $(w, '#lab-notes-toggle');
  const main = () => $(w, 'main.lab-view-bench');
  assert.ok(main().classList.contains('lab-notes-host'));
  assert.equal(aside().hidden, true, 'closed by default on a narrow screen');
  assert.equal(toggle().getAttribute('aria-expanded'), 'false');
  assert.equal(main().classList.contains('lab-notes-open'), false);
  assert.equal(w.CortexLab.getState().settings.notesOpen, true, 'the wide column keeps its own default');
  assert.equal(w.CortexLab.getState().settings.notesOpenNarrow, false);
  toggle().click();
  assert.equal(aside().hidden, false);
  assert.equal(toggle().getAttribute('aria-expanded'), 'true');
  assert.equal(w.document.activeElement.id, 'lab-notepad-text', 'focus moves into the textarea');
  assert.equal(w.CortexLab.getState().settings.notesOpenNarrow, true, 'remembered');
  assert.equal(w.CortexLab.getState().settings.notesOpen, true);
  // a redraw keeps it open
  startRun(w);
  assert.equal(aside().hidden, false);
  // Escape inside the drawer closes it and returns to Notes
  const esc = new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  $(w, '#lab-notepad-text').dispatchEvent(esc);
  assert.equal(esc.defaultPrevented, true);
  assert.equal(aside().hidden, true);
  assert.equal(w.document.activeElement, toggle(), 'focus back on Notes');
  assert.equal(w.CortexLab.getState().settings.notesOpenNarrow, false);
  // Close too
  toggle().click();
  $(w, '#lab-notepad-close').click();
  assert.equal(aside().hidden, true);
  assert.equal(w.document.activeElement, toggle());
  // 900 px and wider: the column, open by its own setting; Escape leaves it alone
  assert.ok(mm.count() >= 1, 'listens for the 900 px boundary');
  mm.change(NARROW_NOTES, false);
  assert.equal(aside().hidden, false, 'the column is open (its own setting)');
  assert.ok(main().classList.contains('lab-notes-open'));
  assert.equal(toggle().getAttribute('aria-expanded'), 'true');
  const esc2 = new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  $(w, '#lab-notepad-text').dispatchEvent(esc2);
  assert.equal(esc2.defaultPrevented, false);
  assert.equal(aside().hidden, false, 'Escape closes only the drawer');
  mm.change(NARROW_NOTES, true);
  assert.equal(aside().hidden, true, 'back to the drawer’s own (closed) state');
  // the sticky-bar focus lift never moves the page for the drawer's textarea
  assert.match(SRC.lab, /target\.closest\('#lab-sheet, #lab-notepad'\)/);
  w.pauseLabTools();
  assert.equal(mm.count(), 0, 'the listener goes with the view');
  h.close();
  // a save from before the drawer (no notesOpenNarrow) merges to closed
  const old = harness({
    url: 'http://localhost/lab?view=bench',
    store: new Map([[STATE_KEY, JSON.stringify({ v: 1, runs: {}, runOrder: [], settings: { notesOpen: true } })]]),
  });
  old.w.matchMedia = liveMedia({ [NARROW_NOTES]: true });
  await old.w.renderLabEntry();
  assert.equal(old.w.CortexLab.getState().settings.notesOpenNarrow, false);
  assert.equal($(old.w, '#lab-notepad').hidden, true);
  old.close();
});

test('FIX2-shell-8 E4 the full microscope view carries the same Notes button and notepad (same text, same save, the same open state per layout)', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  w.CortexLab.setNotepad('Plaques went black first.');
  await w.renderLabEntry();
  const run = startRun(w);
  $(w, '#lab-run-all').click();
  w.CortexLabMicroscope = { mount: () => ({ destroy() {} }), renderSynthetic() {} };
  w.CortexLab.openMicroscope({ runIds: [run.id] });
  assert.ok(await until(w, 'main.lab-view-microscope'));
  const main = $(w, 'main.lab-view-microscope');
  assert.ok(main.classList.contains('lab-notes-host'));
  const toggle = $(w, '#lab-notes-toggle');
  assert.equal(text(toggle), 'Notes');
  assert.equal(toggle.getAttribute('aria-controls'), 'lab-notepad');
  assert.ok(toggle.closest('.lab-backlink'), 'in the back-link row');
  assert.equal($(w, '#lab-notepad').parentElement, main);
  assert.equal($(w, '#lab-notepad-text').value, 'Plaques went black first.');
  assert.equal($(w, '#lab-notepad').hidden, false, 'wide: open, as beside the bench');
  toggle.click();
  assert.equal($(w, '#lab-notepad').hidden, true);
  assert.equal(w.CortexLab.getState().settings.notesOpen, false, 'the same setting as the bench');
  toggle.click();
  const area = $(w, '#lab-notepad-text');
  assert.equal(w.document.activeElement, area);
  area.value = 'Plaques went black first. Tangles too.';
  area.dispatchEvent(new w.Event('input', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 500));
  assert.equal(w.CortexLab.getNotepad(), 'Plaques went black first. Tangles too.', 'the same save path');
  h.close();
  // without a run the view still has the notepad
  const e = harness({ url: 'http://localhost/lab?view=microscope' });
  await e.w.renderLabEntry();
  assert.ok($(e.w, '#lab-notes-toggle') && $(e.w, '#lab-notepad'));
  e.close();
});

test('FIX2-shell-9 phone list mode: Start the run brings "2. Do the steps" to the top (the slide chip, its hints and row 1, the sticky Do this step below); FIX3: wider screens too when the part fits', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.matchMedia = media({ '(max-width: 560px)': true, [NARROW_NOTES]: true });
  const scrolled = [];
  w.Element.prototype.scrollIntoView = function (opts) {
    scrolled.push([this.id || this.className, opts && opts.block]);
  };
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  scrolled.length = 0;
  startRun(w);
  assert.deepEqual(scrolled.at(-1), ['lab-do', 'start']);
  assert.equal(w.document.activeElement.id, 'lab-do-step', 'focus still on Do this step');
  assert.ok($(w, '#lab-do [data-lab-slide-chip]'));
  h.close();
  // FIX3 (G6, d3-3): wider screens bring the steps part up too when it fits under the top bar; a part
  // taller than the window keeps the focus reveal (Do this step in view)
  for (const [height, brought] of [
    [580, true],
    [900, false],
  ]) {
    const d = harness({ url: 'http://localhost/lab?view=bench' });
    const scrolledWide = [];
    d.w.Element.prototype.scrollIntoView = function (opts) {
      scrolledWide.push([this.id || this.className, opts && opts.block]);
    };
    const box = d.w.Element.prototype.getBoundingClientRect;
    d.w.Element.prototype.getBoundingClientRect = function () {
      if (this.id === 'lab-do-step')
        return { top: 400 + height - 80, bottom: 400 + height - 34, left: 0, right: 500, width: 500, height: 46 };
      if (this.id !== 'lab-do') return box.call(this);
      return { top: 400, bottom: 400 + height, left: 0, right: 700, width: 700, height };
    };
    d.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
    await d.w.renderLabEntry();
    scrolledWide.length = 0;
    startRun(d.w);
    assert.equal(
      scrolledWide.some(s => s[0] === 'lab-do' && s[1] === 'start'),
      brought,
      `a ${height} px steps part in a ${d.w.innerHeight} px window`
    );
    assert.equal(d.w.document.activeElement.id, 'lab-do-step');
    d.close();
  }
});

test('FIX2-shell-10 a jar’s sheet opened from the stage carries the jar’s dip line (aria-hidden, Show hints hides it) while a drop would do that step; not from a row, Explain, a finished run or a skipped step', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  const line = () => $(w, '#lab-sheet .lab-sheet-hints');
  fake.api().onInspect('silver-impregnation');
  await sheetDelay();
  assert.equal(line(), null, 'no run: nothing to dip');
  $(w, '#lab-sheet-close').click();
  startRun(w);
  fake.api().onInspect('deparaffinize-rehydrate');
  await sheetDelay();
  assert.equal(text(line()), 'Double-click the jar or drop the slide: dip');
  assert.equal(line().getAttribute('aria-hidden'), 'true');
  assert.ok(line().classList.contains('lab-hints'), 'hidden with Show hints off (html.lab-hints-off .lab-hints)');
  assert.equal(line().previousElementSibling, $(w, '#lab-sheet .lab-sheet-kicker'), 'at the top of the sheet');
  $(w, '#lab-sheet-close').click();
  // Explain this step (keyboard) has none
  $(w, '#lab-explain-open').click();
  assert.equal(line(), null);
  $(w, '#lab-sheet-close').click();
  // a finished run: the drop would do nothing
  $(w, '#lab-run-all').click();
  fake.api().onInspect('silver-impregnation');
  await sheetDelay();
  assert.equal(line(), null);
  await flush();
  h.close();
  // touch words; a skipped step's jar has none
  const tf = fakeBench();
  const t = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: tf.module, webgl2: true });
  t.w.matchMedia = media({ '(pointer: coarse)': true });
  t.w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await t.w.renderLabEntry();
  assert.ok(await mounted3d(t, tf));
  startRun(t.w, { what: 'toning-thiosulfate', value: 'toning' });
  tf.api().onInspect('deparaffinize-rehydrate');
  await sheetDelay();
  assert.equal(text($(t.w, '#lab-sheet .lab-sheet-hints')), 'Double-tap the jar or drop the slide: dip');
  $(t.w, '#lab-sheet-close').click();
  tf.api().onInspect('silver-impregnation');
  await sheetDelay();
  assert.equal($(t.w, '#lab-sheet .lab-sheet-hints'), null, 'not the next step (§11.1)');
  $(t.w, '#lab-sheet-close').click();
  tf.api().onInspect('gold-toning');
  await sheetDelay();
  assert.equal($(t.w, '#lab-sheet .lab-sheet-hints'), null, 'a step the settings skip');
  await flush();
  t.close();
  // list mode: a row's sheet has none (the row's own verbs say it)
  const l = harness({ url: 'http://localhost/lab?view=bench' });
  l.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await l.w.renderLabEntry();
  startRun(l.w);
  $(l.w, '.lab-step[data-lab-step="water-wash"]').click();
  assert.equal(text($(l.w, '#lab-sheet-h')), l.w.CortexLab.stepTitle('water-wash'));
  assert.equal($(l.w, '#lab-sheet .lab-sheet-hints'), null);
  l.close();
});

test('FIX2 lab.css: the notes drawer below 900 px (FIX3 G7: fixed, 45vh, own scroll, safe area, over the sticky bar and under the sheet), the column for every notes host, no lingering transform; the sticky bar hides during a drag only where it sticks; the viewed row and the row note', () => {
  const css = read('lab.css');
  const fix = css.slice(css.indexOf('/* ---------- FIX2:'));
  assert.ok(fix.length > 100, 'the FIX2 block exists');
  const drawer = /@media screen and \(max-width: 899\.98px\) \{\s*\.lab-notepad \{([^}]*)\}/.exec(fix);
  assert.ok(drawer, 'the drawer rule');
  for (const decl of [
    'position: fixed;',
    'bottom: 0;',
    'max-height: 45vh;',
    'overflow-y: auto;',
    'env(safe-area-inset-bottom)',
    'overscroll-behavior: contain;',
  ])
    assert.ok(drawer[1].includes(decl), decl);
  const z = Number(/z-index: (\d+);/.exec(drawer[1])[1]);
  assert.ok(z > 4 && z < 45, 'over the sticky Do this step (4), under the side sheet (45)');
  assert.match(fix, /main\.lab-notes-host\.lab-notes-open \{ padding-bottom: calc\(45vh \+ 24px\); \}/);
  assert.match(fix, /#app main\.lab-notes-host \{ animation-fill-mode: backwards; \}/);
  // FIX3 G7: below 900 px the side sheet is a modal over the drawer, so the 900-1099 px side-by-side rule went
  // FIX4 H4: the one 900-1099 px rule left lays every step sheet over the page while the Notes column is open
  assert.deepEqual(
    css.split('\n').filter(line => line.includes('1099.98px')),
    [
      '@media (min-width: 900px) and (max-width: 1099.98px) { #app main.lab-view-bench.lab-sheet-side.lab-notes-open { padding-right: 28px; } }',
    ],
    'no other layout keys on 1100 px'
  );
  assert.match(
    css,
    /@media \(min-width: 900px\) \{\s*main\.lab-notes-host\.lab-notes-open \{ display: grid; grid-template-columns: minmax\(0, 1fr\) clamp\(280px, 26vw, 320px\);/
  );
  assert.doesNotMatch(css, /main\.lab-view-bench\.lab-notes-open/, 'the column applies to every notes host');
  assert.match(fix, /\.lab-step\.lab-step-viewing \{ box-shadow: inset 4px 0 0 var\(--blue\); \}/);
  assert.match(fix, /\.lab-step-note \{ display: block;/);
  assert.match(css, /\.lab-stage-hint \{ position: absolute;[^}]*width: max-content; max-width: calc\(100% - 32px\);/);
  assert.doesNotMatch(fix, /transition|animation:/, 'nothing moves on its own');
});

/* ---------- FIX3-shell: the third game re-walk (shared decisions G1-G9) ---------- */
const hudSettle = () => new Promise(r => setTimeout(r, 120)); // LAB_HUD_SETTLE_MS (80) and a margin

test('FIX3-shell-1 G1: the rack’s drag chip shows only while a drop would do a step AND the bench says the rack is on screen; api.onViewChange re-reads it (debounced); a bench without rackOnScreen never shows it', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  const keys = () => hudChips(w).map(c => c[0]);
  startRun(w);
  assert.deepEqual(keys(), ['turn', 'zoom', 'click', 'double', 'drop', 'sign'], 'the rack on screen, a step to do');
  // the camera flies to S6: the rack leaves the canvas; the bench reports the view change once it lands
  fake.handle.rackShown = false;
  fake.api().onStation('S6');
  for (let i = 0; i < 5; i++) fake.api().onViewChange(); // a burst of reports: one sync
  assert.ok(keys().includes('drop'), 'not before the reports settle');
  await hudSettle();
  assert.deepEqual(
    keys(),
    ['turn', 'zoom', 'click', 'double', 'sign'],
    'no chip names the rack while it is off screen'
  );
  fake.handle.rackShown = true;
  fake.api().onViewChange();
  await hudSettle();
  assert.ok(keys().includes('drop'), 'back with the rack');
  // a redraw (a step done) reads it at once too
  fake.handle.rackShown = false;
  $(w, '#lab-do-step').click();
  assert.ok(!keys().includes('drop'));
  fake.handle.rackShown = true;
  // a throwing bench reads as off screen
  fake.handle.rackOnScreen = () => {
    throw new Error('gone');
  };
  fake.api().onViewChange();
  await hudSettle();
  assert.ok(!keys().includes('drop'));
  await flush();
  h.close();
  // an older bench without rackOnScreen cannot say where the rack is: no rack chip (E3)
  const old = fakeBench();
  delete old.handle.rackOnScreen;
  const o = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: old.module, webgl2: true });
  o.w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await o.w.renderLabEntry();
  assert.ok(await mounted3d(o, old));
  startRun(o.w);
  assert.deepEqual(
    hudChips(o.w).map(c => c[0]),
    ['turn', 'zoom', 'click', 'double', 'sign']
  );
  assert.equal(typeof old.api().onViewChange, 'function');
  await flush();
  o.close();
});

test('FIX3-shell-2 G3 / G9: the 3D bench opens on the view a step leaves (mid-run: the rack’s station and the next jar’s; finished: S6; no run or a fresh run: S1) and the station picker names it; a new run in 3D names S1 even when the camera is already there; nothing while the intro waits', async () => {
  const fake = fakeBench();
  fake.handle.frameStations = ids => {
    fake.calls.push(['frameStations', [...ids]]);
    return Promise.resolve(true);
  };
  const h = harness({ url: 'http://localhost/lab?view=bench', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  for (let i = 0; i < 3; i++) $(w, '#lab-do-step').click(); // steps 1-3: the rack at S2, step 4 at S3
  const flights = () => fake.calls.filter(c => c[0] === 'goToStation' || c[0] === 'frameStations');
  $(w, '#lab-mode-toggle').click();
  assert.ok(await mounted3d(h, fake));
  assert.deepEqual(flights(), [['frameStations', ['S2', 'S3']]], 'Switch to 3D mid-run: the follow framing');
  assert.equal(stationNamed(w), 'S3', 'the picker names the last framed station');
  // a new run in 3D: the rack and the first jar at S1, the picker reads S1 (the bench may not fly)
  let n = flights().length;
  startRun(w);
  assert.deepEqual(flights().slice(n), [['goToStation', 'S1']]);
  assert.equal(stationNamed(w), 'S1');
  n = flights().length;
  startRun(w); // again, with the camera resting at S1
  assert.deepEqual(flights().slice(n), [['goToStation', 'S1']]);
  assert.equal(stationNamed(w), 'S1');
  // a finished run: back to the list and into 3D again opens at the microscope (S6)
  $(w, '#lab-run-all').click();
  $(w, '#lab-mode-toggle').click();
  assert.equal(w.LAB.bench, null);
  $(w, '#lab-mode-toggle').click();
  assert.ok(await mounted3d(h, fake));
  assert.deepEqual(flights().at(-1), ['goToStation', 'S6']);
  assert.equal(stationNamed(w), 'S6');
  await flush();
  h.close();
  // a reload with no run: S1, named
  const empty = fakeBench();
  const e = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: empty.module, webgl2: true });
  e.w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await e.w.renderLabEntry();
  assert.ok(await mounted3d(e, empty));
  assert.deepEqual(
    empty.calls.filter(c => c[0] === 'goToStation'),
    [['goToStation', 'S1']]
  );
  assert.equal(stationNamed(e.w), 'S1');
  await flush();
  e.close();
  // the intro asked for (?intro=1): the clip takes the camera, the bench is not framed first
  const intro = fakeBench();
  const i = harness({
    url: 'http://localhost/lab?view=bench&mode=3d&intro=1',
    benchModule: intro.module,
    webgl2: true,
  });
  i.w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await i.w.renderLabEntry();
  assert.ok(await mounted3d(i, intro));
  assert.equal(intro.calls.filter(c => c[0] === 'goToStation').length, 0);
  assert.ok(intro.calls.some(c => c[0] === 'intro'));
  await flush();
  i.close();
});

test('FIX3-shell-3 desktop-3: a row click opens its sheet over the page (the list keeps its width: no lab-sheet-side), a sheet already open keeps its layout, Explain still opens beside the list; the presses that finish a double click do nothing wherever they land', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  const main = () => $(w, 'main.lab-view-bench');
  const row = id => $(w, `.lab-step[data-lab-step="${id}"]`);
  const click = (node, detail = 1) => {
    const event = new w.MouseEvent('click', { bubbles: true, cancelable: true, detail });
    node.dispatchEvent(event);
    return event;
  };
  click(row('ammoniacal-silver').querySelector('.lab-step-title'));
  assert.equal(text($(w, '#lab-sheet-h')), w.CortexLab.stepTitle('ammoniacal-silver'));
  assert.equal(main().classList.contains('lab-sheet-side'), false, 'over the page: the list does not narrow');
  // the second press and click of that double click land on the sheet: prevented, the sheet stays
  const down = new w.MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 2 });
  $(w, '#lab-sheet-close').dispatchEvent(down);
  assert.equal(down.defaultPrevented, true, 'no focus move, no word selected');
  const second = click($(w, '#lab-sheet-close'), 2);
  assert.equal(second.defaultPrevented, true);
  assert.equal($(w, '#lab-sheet').hidden, false, 'Close was not pressed by the double click');
  // a plain later click works as always
  click($(w, '#lab-sheet-close'));
  assert.equal($(w, '#lab-sheet').hidden, true);
  // Explain this step (a button, no pointer on a row): beside the list as before; a row click while it is
  // open keeps that layout, so the row does not move
  $(w, '#lab-explain-open').click();
  assert.equal(main().classList.contains('lab-sheet-side'), true);
  click(row('water-wash'));
  assert.equal(text($(w, '#lab-sheet-h')), w.CortexLab.stepTitle('water-wash'));
  assert.equal(main().classList.contains('lab-sheet-side'), true, 'kept');
  $(w, '#lab-sheet-close').click();
  // a row sheet switched with the sheet's own select stays over the page
  click(row('development'));
  change(w, $(w, '#lab-sheet-step'), 'gold-toning');
  assert.equal(main().classList.contains('lab-sheet-side'), false);
  // long after a row click, a double click elsewhere is left alone
  w.CortexLab.getState(); // (no clock stub: the guard reads Date.now())
  const realNow = Date.now;
  w.Date.now = () => realNow() + 5000;
  const later = new w.MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 2 });
  $(w, '#lab-sheet-h').dispatchEvent(later);
  assert.equal(later.defaultPrevented, false);
  w.Date.now = realNow;
  // the guard goes with the view
  w.pauseLabTools();
  const after = new w.MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 2 });
  w.document.body.dispatchEvent(after);
  assert.equal(after.defaultPrevented, false);
  h.close();
});

test('FIX3-shell-4 G6 list drops: a taken drop leaves the page where it is (no reveal; focus on Do this step), the dropped row keeps its place across the redraw and clears a phone’s sticky Do this step; a refused drop says why on its row (nothing above it moves; the status line is for screen readers)', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w, { what: 'toning-thiosulfate', value: 'toning' });
  for (let i = 0; i < 4; i++) $(w, '#lab-do-step').click(); // the fifth step (the ammonia rinse) is next
  const row = id => $(w, `.lab-step[data-lab-step="${id}"]`);
  const scrolled = [];
  w.Element.prototype.scrollIntoView = function (opts) {
    scrolled.push([this.id || this.className, opts && opts.block]);
  };
  const scrolls = [];
  w.scrollBy = opts => scrolls.push(opts.top);
  // the dropped row sits at 500 before the drop and at 470 after the redraw (the list moved up 30 px)
  const target = row('ammonium-hydroxide-wash');
  const box = w.Element.prototype.getBoundingClientRect;
  w.Element.prototype.getBoundingClientRect = function () {
    if (this.matches && this.matches('li.lab-step[data-lab-step="ammonium-hydroxide-wash"]')) {
      const top = this === target ? 500 : 470;
      return { top, bottom: top + 44, left: 0, right: 300, width: 300, height: 44 };
    }
    return box.call(this);
  };
  const doStep = $(w, '#lab-do-step');
  w.document.elementFromPoint = () => target;
  const chip = $(w, '[data-lab-slide-chip]');
  pointer(w, chip, 'pointerdown', 10, 10);
  pointer(w, chip, 'pointermove', 200, 300);
  pointer(w, chip, 'pointerup', 200, 300);
  assert.notEqual($(w, '#lab-do-step'), doStep, 'redrawn');
  const last = w.CortexLab.getState().runs['run-1'].events.at(-1);
  assert.deepEqual([last.type, last.step], ['step', 'ammonium-hydroxide-wash'], 'the drop recorded the step');
  assert.equal(w.document.activeElement.id, 'lab-do-step');
  assert.deepEqual(scrolled, [], 'no reveal: the rows stay under the pointer');
  assert.deepEqual(scrolls, [-30], 'the row is scrolled back to where it was dropped');
  // a phone's sticky Do this step over the row's note: the page scrolls just enough to clear it (H5, FIX4:
  // only while the bar is stuck to the window's bottom, its sticky offset 10 px; the bar alone counts)
  scrolls.length = 0;
  const realStyle = w.getComputedStyle;
  const height = w.innerHeight;
  Object.defineProperty(w, 'innerHeight', { value: 640, configurable: true });
  w.getComputedStyle = node =>
    node && node.id === 'lab-do-step'
      ? { position: 'sticky', bottom: '10px', visibility: 'visible' }
      : realStyle.call(w, node);
  let barBox = { top: 560, bottom: 630, left: 16, right: 304, width: 288, height: 70 };
  w.Element.prototype.getBoundingClientRect = function () {
    if (this.matches && this.matches('li.lab-step[data-lab-step="ammonium-hydroxide-wash"]'))
      return { top: 500, bottom: 580, left: 0, right: 300, width: 300, height: 80 };
    if (this.id === 'lab-do-step') return barBox;
    return box.call(this);
  };
  const clear = () =>
    h.run('labClearStickyBar(document.querySelector(\'li.lab-step[data-lab-step="ammonium-hydroxide-wash"]\'))');
  clear();
  assert.deepEqual(scrolls, [28], '580 + 8 - 560');
  // the bar in the flow (not stuck: it sits under the list) covers no row: no scroll
  scrolls.length = 0;
  barBox = { top: 590, bottom: 600, left: 16, right: 304, width: 288, height: 10 };
  clear();
  assert.deepEqual(scrolls, [], 'a bar in the flow is not over the row');
  Object.defineProperty(w, 'innerHeight', { value: height, configurable: true });
  w.getComputedStyle = realStyle;
  w.Element.prototype.getBoundingClientRect = box;
  // a refused drop: the reason on the row, under its title; no row moves above it; nothing recorded
  scrolls.length = 0;
  const before = w.CortexLab.getState().runs['run-1'].events.length;
  dragSlide(w, row('gold-toning'));
  assert.equal(w.CortexLab.getState().runs['run-1'].events.length, before, 'nothing recorded');
  const note = row('gold-toning').querySelector('.lab-step-line .lab-step-note.lab-step-refused');
  assert.equal(text(note), 'Your settings skip this step');
  assert.equal(note.getAttribute('aria-hidden'), 'true');
  assert.equal(row('gold-toning').querySelector('.lab-step-verbs'), null, 'the reason in place of the verbs');
  assert.equal(
    text($(w, '#lab-drop-note')),
    'Gold toning: Your settings skip this step',
    'the status line names the step'
  );
  assert.ok($(w, '#lab-drop-note').classList.contains('lab-sr-only'), 'out of view: it never pushes the list');
  assert.equal($(w, '#lab-drop-note').getAttribute('role'), 'status');
  // a second refusal on the same row keeps one line; a later drag leaves it (the rows never jump)
  dragSlide(w, row('gold-toning'));
  assert.equal(row('gold-toning').querySelectorAll('.lab-step-refused').length, 1);
  dragSlide(w, row('gold-toning'), { drop: false });
  assert.ok(row('gold-toning').querySelector('.lab-step-refused'));
  pointer(w, $(w, '[data-lab-slide-chip]'), 'pointercancel', 0, 0);
  // a drop that is taken redraws the list: the reason goes
  dragSlide(w, row('development'));
  assert.equal($(w, '.lab-step-refused'), null);
  assert.equal(text($(w, '#lab-drop-note')), '');
  h.close();
});

test('FIX3-shell-5 G6 phone: Switch to 3D (or back to the list) brings the steps part up under the top bar with focus on its heading; wider screens do the same for 3D (MODE-FIX-shell-1) and keep focus on the switch back to the list', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.matchMedia = media({ '(max-width: 560px)': true, [NARROW_NOTES]: true });
  const scrolled = [];
  w.Element.prototype.scrollIntoView = function (opts) {
    scrolled.push([this.id || this.className, opts && opts.block]);
  };
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  scrolled.length = 0;
  $(w, '#lab-mode-toggle').click();
  assert.deepEqual(scrolled.at(-1), ['lab-do', 'start'], 'the stage comes up');
  assert.ok($(w, '#lab-do.lab-bench-3d'));
  assert.equal(w.document.activeElement.id, 'lab-do-h');
  assert.ok(await mounted3d(h, fake));
  assert.equal(w.document.activeElement.id, 'lab-do-h', 'the mount keeps it there');
  scrolled.length = 0;
  $(w, '#lab-mode-toggle').click();
  assert.deepEqual(scrolled.at(-1), ['lab-do', 'start'], 'the list with its slide chip comes up');
  assert.ok($(w, '#lab-do [data-lab-slide-chip]'));
  assert.equal(w.document.activeElement.id, 'lab-do-h');
  await flush();
  h.close();
  const wide = fakeBench();
  const d = harness({ url: 'http://localhost/lab?view=bench', benchModule: wide.module, webgl2: true });
  const scrolledWide = [];
  d.w.Element.prototype.scrollIntoView = function (opts) {
    scrolledWide.push([this.id || this.className, opts && opts.block]);
  };
  d.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await d.w.renderLabEntry();
  startRun(d.w);
  scrolledWide.length = 0;
  $(d.w, '#lab-mode-toggle').click();
  assert.deepEqual(scrolledWide.at(-1), ['lab-do', 'start'], 'the stage comes up wide too (MODE-FIX-shell-1)');
  assert.ok(await mounted3d(d, wide));
  assert.equal(d.w.document.activeElement.id, 'lab-do-h', 'the heading, in view with the station row and Do this step');
  scrolledWide.length = 0;
  $(d.w, '#lab-mode-toggle').click();
  assert.equal(d.w.document.activeElement.id, 'lab-mode-toggle', 'back to the list: CC-8 as before');
  assert.ok(!scrolledWide.some(x => x[0] === 'lab-do'));
  await flush();
  d.close();
});

test('FIX3-shell-6 G7 notes: the column from 900 px, the drawer below; a floating Notes button (aria-controls the notepad) shows while the header’s Notes is out of view, never over the 3D stage or the picture; it opens the drawer, and Close returns focus to whichever Notes button is in view', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench', benchModule: fake.module, webgl2: true });
  const { w } = h;
  const mm = liveMedia({ [NARROW_NOTES]: true });
  w.matchMedia = mm;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  assert.match(SRC.lab, /const LAB_NOTES_NARROW = '\(max-width: 899\.98px\)';/);
  const float = () => $(w, '#lab-notes-float');
  assert.equal(float().tagName, 'BUTTON');
  assert.equal(text(float()), 'Notes');
  assert.equal(float().getAttribute('aria-controls'), 'lab-notepad');
  assert.equal(float().parentElement, $(w, 'main.lab-notes-host'));
  assert.equal(float().hidden, true, 'not laid out (jsdom): hidden');
  // the header's Notes scrolled under the top bar
  let headTop = -200;
  const box = w.Element.prototype.getBoundingClientRect;
  let canvasBox = null;
  w.Element.prototype.getBoundingClientRect = function () {
    if (this.id === 'lab-notes-toggle')
      return { top: headTop, bottom: headTop + 44, left: 300, right: 370, width: 70, height: 44 };
    if (this.id === 'lab-notes-float') return { top: 780, bottom: 824, left: 290, right: 374, width: 84, height: 44 };
    if (canvasBox && this.tagName === 'CANVAS') return canvasBox;
    return box.call(this);
  };
  const sync = () => h.run('labNotesFloatSync()');
  sync();
  assert.equal(float().hidden, false, 'shown while the header’s Notes is out of view');
  headTop = 300;
  sync();
  assert.equal(float().hidden, true, 'hidden while the header’s is in view');
  headTop = 900; // below the window
  sync();
  assert.equal(float().hidden, false);
  // never over the 3D stage (D1)
  $(w, '#lab-mode-toggle').click();
  assert.ok(await mounted3d(h, fake));
  canvasBox = { top: 500, bottom: 800, left: 16, right: 374, width: 358, height: 300 };
  sync();
  assert.equal(float().hidden, true, 'over the stage: it waits');
  canvasBox = { top: 100, bottom: 400, left: 16, right: 374, width: 358, height: 300 };
  sync();
  assert.equal(float().hidden, false);
  // the float opens the drawer (focus in the textarea; the float hides), Close returns to the float
  float().click();
  assert.equal($(w, '#lab-notepad').hidden, false);
  assert.equal(w.document.activeElement.id, 'lab-notepad-text');
  assert.equal(float().hidden, true);
  assert.equal($(w, '#lab-notes-toggle').getAttribute('aria-expanded'), 'true');
  $(w, '#lab-notepad-close').click();
  assert.equal($(w, '#lab-notepad').hidden, true);
  assert.equal(float().hidden, false);
  assert.equal(w.document.activeElement, float(), 'the Notes button in view');
  assert.equal(float().getAttribute('aria-expanded'), 'false');
  // with the header's Notes in view, Close returns there
  headTop = 300;
  float().click();
  $(w, '#lab-notepad-close').click();
  assert.equal(w.document.activeElement.id, 'lab-notes-toggle');
  // 900 px and wider: the column; the float never shows
  mm.change(NARROW_NOTES, false);
  headTop = -200;
  sync();
  assert.equal(float().hidden, true);
  w.Element.prototype.getBoundingClientRect = box;
  await flush();
  h.close();
  // the microscope view carries it too
  const m = harness({ url: 'http://localhost/lab?view=microscope' });
  await m.w.renderLabEntry();
  assert.ok($(m.w, 'main.lab-view-microscope #lab-notes-float[aria-controls="lab-notepad"]'));
  m.close();
});

test('FIX3-shell-7 G7 lab.css: the drawer below 900 px at most 45vh (40vh under 700 px tall, smaller textarea, no hint line), a slim bar while the slide is dragged, the column from 900 px (280-320 px), the floating Notes button (fixed bottom right, 44 px, safe area, above a phone’s sticky Do this step, gone from 900 px, during a drag and in print)', () => {
  const css = read('lab.css');
  const fix3 = css.slice(css.indexOf('/* ---------- FIX3:'));
  assert.ok(fix3.length > 100, 'the FIX3 block exists');
  assert.match(
    css,
    /@media screen and \(max-width: 899\.98px\) and \(max-height: 699\.98px\) \{\s*\.lab-notepad \{ max-height: 40vh; \}\s*\.lab-notepad textarea \{ height: 16vh; min-height: 88px; \}\s*\.lab-notepad-hint \{ display: none; \}\s*main\.lab-notes-host\.lab-notes-open \{ padding-bottom: calc\(40vh \+ 24px\); \}\s*\}/
  );
  assert.match(
    fix3,
    /@media screen and \(max-width: 899\.98px\) \{ main\.lab-notes-host:has\(\.lab-slide-dragging\) \.lab-notepad \{ max-height: calc\(58px \+ env\(safe-area-inset-bottom\)\); overflow: hidden; \} \}/
  );
  const float = /\.lab-notes-float \{([^}]*)\}/.exec(fix3)[1];
  for (const decl of [
    'position: fixed;',
    'right: calc(16px + env(safe-area-inset-right));',
    'bottom: calc(16px + env(safe-area-inset-bottom));',
    'min-width: 44px;',
    'min-height: 44px;',
  ])
    assert.ok(float.includes(decl), decl);
  const z = Number(/z-index: (\d+);/.exec(float)[1]);
  assert.ok(z > 4 && z < 44, 'over the sticky Do this step (4), under the drawer (44) and the sheet (45)');
  assert.match(fix3, /@media \(min-width: 900px\) \{ \.lab-notes-float \{ display: none !important; \} \}/);
  // H5 (FIX4): the float's place above a stuck Do this step comes from the bar's real top (labNotesFloatSync), not
  // a fixed 112 px rule that assumed the bar was stuck
  assert.doesNotMatch(css, /\.lab-notes-float \{ bottom: calc\(112px/);
  assert.match(fix3, /main\.lab-notes-host:has\(\.lab-slide-dragging\) \.lab-notes-float \{ display: none; \}/);
  assert.match(fix3, /@media print \{ \.lab-notes-float \{ display: none !important; \} \}/);
  assert.doesNotMatch(fix3, /transition|animation:/);
  // one rule per line in the block
  for (const line of fix3.split('\n').filter(l => l.includes('{') && !l.startsWith('/*') && !l.startsWith('@media')))
    assert.equal((line.match(/\{/g) || []).length, 1, line);
});

test('FIX3-shell-8 G8 api.topInset: the site’s sticky top bar’s bottom in the viewport (0 when there is no fixed or sticky bar); the drag’s bottom band ends at an open drawer’s top', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  const api = fake.api();
  assert.equal(typeof api.topInset, 'function');
  assert.equal(api.topInset(), 0, 'jsdom: a header in the flow with no box');
  const header = $(w, '#app header');
  const realStyle = w.getComputedStyle;
  w.getComputedStyle = node => (node === header ? { position: 'sticky' } : realStyle.call(w, node));
  header.getBoundingClientRect = () => ({ top: 0, bottom: 121, left: 0, right: 390, width: 390, height: 121 });
  assert.equal(api.topInset(), 121);
  header.getBoundingClientRect = () => ({ top: -121, bottom: 0, left: 0, right: 390, width: 390, height: 121 });
  assert.equal(api.topInset(), 0, 'scrolled away');
  w.getComputedStyle = node => (node === header ? { position: 'static' } : realStyle.call(w, node));
  header.getBoundingClientRect = () => ({ top: 0, bottom: 121, left: 0, right: 390, width: 390, height: 121 });
  assert.equal(api.topInset(), 0, 'a bar in the flow covers nothing');
  // the drag's bottom band (labDragBottom): the window's bottom, or an open fixed drawer's top
  const pad = $(w, '#lab-notepad');
  pad.hidden = false;
  w.getComputedStyle = node => (node === pad ? { position: 'fixed' } : realStyle.call(w, node));
  pad.getBoundingClientRect = () => ({ top: 582, bottom: 640, left: 0, right: 320, width: 320, height: 58 });
  assert.equal(h.run('labDragBottom(document, window)'), 582);
  w.getComputedStyle = node => (node === pad ? { position: 'static' } : realStyle.call(w, node));
  assert.equal(h.run('labDragBottom(document, window)'), w.innerHeight, 'the column: the window');
  w.getComputedStyle = realStyle;
  await flush();
  h.close();
});

test('FIX3-shell-9 G9: before any run the list shows no next or to-do state; the bench’s lines describe, never order (the result card mid-run, the intro’s end before the safety notes, a no-run double click, no "then"); a no-run double click opens no sheet and says why on the stage', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  assert.equal($(w, '.lab-step-next'), null);
  assert.equal($(w, '[aria-current="step"]'), null);
  assert.deepEqual($$(w, '.lab-step .lab-step-state').map(text), Array(9).fill(''), 'no "to do" before a run');
  startRun(w);
  assert.equal($$(w, '.lab-step-next').length, 1, 'a run has a next step');
  assert.equal(text($$(w, '.lab-step')[1].querySelector('.lab-step-state')), 'to do');
  $(w, '#lab-do-step').click();
  $(w, '#lab-do-step').click();
  assert.equal(
    text($(w, '.lab-result-summary')),
    'Steps still to do: 2 of 9 done. The picture comes once every step is done.'
  );
  h.close();
  // the intro's end before the safety notes, and the bench's announcements
  assert.match(SRC.lab, /'Intro finished\. The safety notes below open the bench\.'/);
  assert.doesNotMatch(SRC.lab, /Read the safety notes below before you start a run|Finish the steps to see/);
  assert.doesNotMatch(SRC.lab, /Start a run in part 1 to do steps|acknowledge them before doing a step/);
  // no "then" anywhere in lab.js outside comments and promise calls (every string the lab shows)
  const code = SRC.lab
    .split('\n')
    .filter(line => !/^\s*\/\//.test(line))
    .map(line => line.replace(/\s\/\/ .*$/, '').replace(/\.then\(|\.then ===/g, ''));
  assert.deepEqual(
    code.filter(line => /\bthen\b/i.test(line)),
    []
  );
  // a no-run double click on a jar: no sheet (its first click's is cancelled), the reason on the stage
  const fake = fakeBench();
  const b = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  b.w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await b.w.renderLabEntry();
  assert.ok(await mounted3d(b, fake));
  fake.api().onInspect('silver-impregnation');
  fake.api().onEvent({ type: 'step', step: 'silver-impregnation' });
  await sheetDelay();
  assert.equal($(b.w, '#lab-sheet').hidden, true, 'the double click opens no sheet');
  assert.equal($(b.w, '#lab-stage-hint').textContent, 'No run yet: Start the run is under Your slide, above.');
  assert.equal($(b.w, '#lab-stage-hint').getAttribute('aria-hidden'), 'true', 'the live region says it');
  assert.match(text($(b.w, '#lab-live')), /^No run yet: Start the run is under Your slide, above\./);
  await flush();
  b.close();
});

test('FIX3-shell-10 G4: CortexLab.featureOn names the parts LAB_FLAGS turns on; the notebook and whiteboard never point at a part that is off; a locked finished run says it is locked where the redo tip was', async () => {
  const off = harness({ url: 'http://localhost/lab?view=bench', flags: null });
  assert.deepEqual(
    ['activities', 'designer', 'report', 'nope', 7, null].map(name => off.w.CortexLab.featureOn(name)),
    [false, false, false, false, false, false]
  );
  off.close();
  const on = harness({ url: 'http://localhost/lab?view=bench', flags: { report: true } });
  assert.deepEqual(
    ['activities', 'designer', 'report'].map(name => on.w.CortexLab.featureOn(name)),
    [false, false, true]
  );
  on.close();
  // the bench objects with the flags off
  const fake = fakeBench();
  const h = harness({
    url: 'http://localhost/lab?view=bench&mode=3d',
    benchModule: fake.module,
    webgl2: true,
    flags: null,
  });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  for (const id of ['notebook', 'whiteboard']) {
    fake.api().onInspect(id);
    const sheet = text($(w, '#lab-sheet'));
    assert.doesNotMatch(sheet, /report|designer|Plan an experiment/i, `${id}: ${sheet}`);
    assert.equal($(w, '#lab-sheet .btn'), null, `${id}: no button to a page that is off`);
    $(w, '#lab-sheet-close').click();
  }
  // a finished run cited by a measurement: locked; the stage tip and the step sheet say so (no redo tip). A
  // measurement locks only while the report is on (H2, FIX4: FIX4-shell-1 covers it off)
  w.LAB_FLAGS = { report: true };
  const run = startRun(w);
  $(w, '#lab-run-all').click();
  w.CortexLab.setState({
    measurements: { 'measurement-1': { id: 'measurement-1', runId: run.id, kind: 'count', createdAt: ACK } },
    measurementOrder: ['measurement-1'],
  });
  // a redraw (the History toggle) shows the lock notice and the locked tip under the stage
  $(w, '#lab-run-menu-btn').click();
  $(w, '#lab-history-toggle').click();
  // a jar's double click on the locked finished run: its sheet says it is locked (no redo tip)
  fake.api().onEvent({ type: 'step', step: 'development' });
  assert.match(text($(w, '#lab-live')), /^This run is locked: its log stays as it is, so no step is added to it\.$/);
  assert.equal(
    text($(w, '#lab-sheet .lab-sheet-finished')),
    'This run is locked: its log stays as it is, so no step is added to it.'
  );
  $(w, '#lab-sheet-close').click();
  assert.ok($(w, '#lab-run-locked'), 'the lock notice');
  const tip = text($(w, '.lab-stage-tip'));
  assert.match(tip, /^This run is locked: its log stays as it is, so no step is added to it\./);
  assert.doesNotMatch(text($(w, 'main')), /To redo a step, use Run menu/);
  await flush();
  h.close();
});

/* ---------- FIX4-shell: the fourth game re-walk (shared decisions H1-H13) ---------- */
const rowClick = (w, node) =>
  node.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));

test('FIX4-shell-1 H2: while the report is off a recorded measurement does not lock its run (labRunReferences leaves it out; steps and drops still go through); with the report on it locks as before', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench', flags: null });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  const run = startRun(w);
  $(w, '#lab-do-step').click();
  w.CortexLab.setState({
    measurements: { 'measurement-1': { id: 'measurement-1', runId: run.id, kind: 'count', createdAt: ACK } },
    measurementOrder: ['measurement-1'],
  });
  assert.equal(w.CortexLab.featureOn('report'), false);
  assert.equal(h.run(`labRunReferences('${run.id}').length`), 0, 'a measurement the student cannot open cites nothing');
  assert.equal(h.run(`labRunLocked('${run.id}')`), false);
  assert.equal(w.labDropHint(w.LAB.lab, { runId: run.id }, 'silver-impregnation'), '', 'a drop still does the step');
  $(w, '#lab-do-step').click();
  assert.equal(w.CortexLab.getState().runs[run.id].events.filter(e => e.type === 'step').length, 2, 'not locked');
  assert.equal($(w, '#lab-run-locked'), null, 'no lock notice');
  // the report on: the same measurement cites the run, as before (G4)
  w.LAB_FLAGS = { report: true };
  assert.equal(h.run(`labRunReferences('${run.id}').join('|')`), 'measurement 1');
  assert.equal(w.labDropHint(w.LAB.lab, { runId: run.id }, 'ammoniacal-silver'), 'This run is locked');
  $(w, '#lab-run-menu-btn').click();
  $(w, '#lab-history-toggle').click(); // a redraw
  assert.ok($(w, '#lab-run-locked'), 'the lock notice');
  assert.equal($(w, '#lab-do-step').disabled, true);
  h.close();
});

test('FIX4-shell-2 H13 / d4-6: a row’s state sits on a line of its own under the title; the lab’s reaction and a refused drop take that line in place of the state (one per row; the state stays for screen readers), never a line of their own, so no row changes height; the verbs step aside while a sheet is open', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  // before a run: the rows' state is empty (lab.css hides the empty line)
  for (const li of $$(w, 'li.lab-step'))
    assert.equal(li.querySelector('.lab-step-line > .lab-step-state').innerHTML, '');
  startRun(w, { what: 'toning-thiosulfate', value: 'toning' });
  const row = id => $(w, `.lab-step[data-lab-step="${id}"]`);
  for (const li of $$(w, 'li.lab-step')) {
    assert.deepEqual(
      [...li.children].map(c => c.className),
      ['lab-step-order', 'lab-step-main', 'lab-step-verbs'],
      li.dataset.labStep
    );
    assert.deepEqual(
      [...li.querySelector('.lab-step-main').children].map(c => c.className),
      ['lab-step-title', 'lab-step-line']
    );
    assert.equal(li.querySelector('.lab-step-title').children.length, 0, 'the title holds only its words');
    assert.equal(li.querySelector('.lab-step-line').children[0].className, 'lab-step-state');
  }
  assert.equal(text(row('silver-impregnation').querySelector('.lab-step-state')), 'to do');
  // a step done: the bench's line (the stage's by-eye look) takes the state's line; the state is still
  // there (read, not shown)
  dragSlide(w, row('deparaffinize-rehydrate'));
  let r1 = row('deparaffinize-rehydrate');
  assert.ok(r1.classList.contains('lab-step-noted'));
  const look = w.labRunLook(w.LAB.lab, w.CortexLab.getState().runs['run-1']);
  assert.deepEqual(
    [...r1.querySelector('.lab-step-line').children].map(c => [c.className, text(c)]),
    [
      ['lab-step-state', '✓ done'],
      ['lab-step-note', look.text],
    ]
  );
  assert.equal(r1.querySelector('.lab-step-title .lab-step-note'), null, 'never a line of its own under the title');
  // a refused drop: the reason takes that row's line (one note per row), the verbs go
  dragSlide(w, row('gold-toning'));
  const gold = row('gold-toning');
  assert.ok(gold.classList.contains('lab-step-noted'));
  assert.deepEqual(
    [...gold.querySelector('.lab-step-line').children].map(c => [c.className, text(c)]),
    [
      ['lab-step-state', 'Skipped (your setting)'],
      ['lab-step-note lab-step-refused', 'Your settings skip this step'],
    ]
  );
  assert.equal(gold.querySelector('.lab-step-verbs'), null);
  // the next drop that is taken: the reaction moves on (or goes), the refusal goes with the redraw
  dragSlide(w, row('silver-impregnation'));
  r1 = row('deparaffinize-rehydrate');
  assert.equal(r1.classList.contains('lab-step-noted'), false);
  assert.equal(r1.querySelector('.lab-step-note'), null);
  assert.equal($(w, '.lab-step-refused'), null);
  // lab.css: the line is kept (one line, 18 px) while a run exists, the note sits in the state's place
  const css = read('lab.css');
  const fix4 = css.slice(css.indexOf('/* ---------- FIX4:'));
  assert.match(fix4, /\.lab-step-line \{ display: grid; min-height: 18px; \}/);
  assert.match(fix4, /\.lab-step-line > \* \{ grid-area: 1 \/ 1; \}/);
  assert.match(fix4, /\.lab-step-line:has\(> \.lab-step-state:empty:last-child\) \{ display: none; \}/);
  assert.match(fix4, /\.lab-step-noted \.lab-step-state \{ opacity: 0; \}/, 'out of sight, still read');
  assert.match(fix4, /main:has\(#lab-sheet:not\(\[hidden\]\)\) \.lab-step-verbs \{ display: none !important; \}/);
  // MODE-FIX-shell-5: the state keeps one line; the note (a §11.3 reaction, "Next in the procedure: <step>")
  // wraps so it reads in full where the student acted, never cut mid-sentence
  for (const [sel, decls] of [
    ['.lab-step-state', ['white-space: nowrap;', 'text-overflow: ellipsis;']],
    ['.lab-step-note', ['white-space: normal;', 'overflow-wrap: anywhere;']],
  ]) {
    const rule = new RegExp(`\\n${sel.replace('.', '\\.')} \\{([^}]*)\\}`).exec(css)[1];
    for (const decl of ['font-size: 13px;', 'line-height: 18px;', ...decls])
      assert.ok(rule.includes(decl), `${sel} ${decl}`);
    assert.ok(!(sel === '.lab-step-note' && /nowrap|ellipsis/.test(rule)), 'the note is never truncated');
  }
  assert.doesNotMatch(css, /\.lab-step-how \{ display: block/, 'the state keeps one line at every width');
  h.close();
});

test('FIX4-shell-3 H5: the floating Notes button stands 8 px above a stuck Do this step (its real top), else at its CSS place; it hides wherever it would lie over a button, a link, a field, the canvases or a row’s note', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.matchMedia = liveMedia({ [NARROW_NOTES]: true });
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  const float = () => $(w, '#lab-notes-float');
  const H = w.innerHeight;
  let bar = { top: H - 80, bottom: H - 10, left: 16, right: 374, width: 358, height: 70 };
  let under = null; // [selector, box] lying where the float would be
  const box = w.Element.prototype.getBoundingClientRect;
  w.Element.prototype.getBoundingClientRect = function () {
    if (this.id === 'lab-notes-toggle')
      return { top: -200, bottom: -156, left: 300, right: 370, width: 70, height: 44 };
    if (this.id === 'lab-notes-float') {
      const bottom = H - (parseFloat(this.style.bottom) || 16);
      return { top: bottom - 44, bottom, left: 290, right: 374, width: 84, height: 44 };
    }
    if (this.id === 'lab-do-step') return bar;
    if (under && this.matches(under[0])) return under[1];
    return box.call(this);
  };
  const realStyle = w.getComputedStyle;
  w.getComputedStyle = node =>
    node && node.id === 'lab-do-step'
      ? { position: 'sticky', bottom: '10px', visibility: 'visible' }
      : realStyle.call(w, node);
  const sync = () => h.run('labNotesFloatSync()');
  sync();
  assert.equal(float().style.bottom, '88px', 'the bar’s top (80 px up) + 8');
  assert.equal(float().hidden, false);
  // the bar in the flow (not stuck): the CSS place (16 px + safe area)
  bar = { top: H - 300, bottom: H - 230, left: 16, right: 374, width: 358, height: 70 };
  sync();
  assert.equal(float().style.bottom, '');
  assert.equal(float().hidden, false);
  // a control under that place: hidden
  const spot = { top: H - 60, bottom: H - 16, left: 280, right: 380, width: 100, height: 44 };
  for (const sel of ['#lab-run-all', '.lab-endbtns a', '#lab-explain-open']) {
    under = [sel, spot];
    sync();
    assert.equal(float().hidden, true, sel);
  }
  under = ['#lab-run-all', { top: H - 140, bottom: H - 96, left: 16, right: 374, width: 358, height: 44 }];
  sync();
  assert.equal(float().hidden, false, 'clear of it again');
  // a row's note: measured by its words (jsdom has no range boxes, so its words count as clear)
  // I5 (FIX5): a label's words too (a specimen card's name)
  assert.match(
    SRC.lab,
    /const LAB_FLOAT_TEXT =\n {2}'li\.lab-step \.lab-step-note, li\.lab-step \.lab-step-title, label, \.lab-hud, \.labm-hud, \.labm-tally, \.labm-caption, \.labm-textalt, #lab-reactions \.lab-reaction-text, #lab-reactions \.lab-reaction-step, \.lab-empty-line';/
  );
  w.Element.prototype.getBoundingClientRect = box;
  w.getComputedStyle = realStyle;
  // lab.css: no fixed 112 px lift any more
  assert.doesNotMatch(read('lab.css'), /\.lab-notes-float \{ bottom: calc\(112px/);
  h.close();
});

test('FIX4-shell-4 H7: a drop or a jar’s double click with a sheet open keeps focus in the sheet (Escape closes it); focus never lands under the open notes drawer (the steps heading takes it, brought into view; a focus left in the drawer stays); the safety notes’ ack lands on "1. Set up"', async () => {
  // (a) list: a row's sheet open, a drop on row 1
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  const row = id => $(w, `.lab-step[data-lab-step="${id}"]`);
  rowClick(w, row('water-wash').querySelector('.lab-step-title'));
  assert.equal(text($(w, '#lab-sheet-h')), w.CortexLab.stepTitle('water-wash'));
  dragSlide(w, row('deparaffinize-rehydrate'));
  assert.equal(w.CortexLab.getState().runs['run-1'].events.at(-1).step, 'deparaffinize-rehydrate');
  assert.equal(w.document.activeElement.id, 'lab-sheet-h', 'focus stays in the sheet');
  press(w, w.document.activeElement, 'Escape');
  assert.equal($(w, '#lab-sheet').hidden, true, 'Escape still closes it');
  h.close();
  // (b) 3D: a jar's sheet open, the jar's double click (or the rack dropped on it)
  const fake = fakeBench();
  const b = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  b.w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await b.w.renderLabEntry();
  assert.ok(await mounted3d(b, fake));
  startRun(b.w);
  fake.api().onInspect('deparaffinize-rehydrate');
  await sheetDelay();
  assert.equal(b.w.document.querySelector('#lab-sheet').hidden, false);
  fake.api().onEvent({ type: 'step', step: 'deparaffinize-rehydrate' });
  assert.equal(b.w.document.activeElement.id, 'lab-sheet-h');
  press(b.w, b.w.document.activeElement, 'Escape');
  assert.equal(b.w.document.querySelector('#lab-sheet').hidden, true);
  // no sheet: focus stays on the stage (MODE-FIX-shell-18), never on a button below the fold
  fake.api().onEvent({ type: 'step', step: 'silver-impregnation' });
  assert.equal(b.w.document.activeElement.id, 'lab-clip-stage');
  await flush();
  b.close();
  // (c) the open notes drawer over a phone's Do this step
  const n = harness({ url: 'http://localhost/lab?view=bench' });
  const nw = n.w;
  nw.matchMedia = liveMedia({ [NARROW_NOTES]: true });
  nw.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await nw.renderLabEntry();
  startRun(nw);
  $(nw, '#lab-notes-toggle').click();
  assert.equal($(nw, '#lab-notepad').hidden, false);
  const H = nw.innerHeight;
  let headingTop = 150;
  const box = nw.Element.prototype.getBoundingClientRect;
  nw.Element.prototype.getBoundingClientRect = function () {
    if (this.id === 'lab-notepad') return { top: H - 340, bottom: H, left: 0, right: 390, width: 390, height: 340 };
    if (this.id === 'lab-do-step') return { top: H - 80, bottom: H - 10, left: 16, right: 374, width: 358, height: 70 };
    if (this.id === 'lab-do-h')
      return { top: headingTop, bottom: headingTop + 30, left: 16, right: 374, width: 358, height: 30 };
    return box.call(this);
  };
  const realStyle = nw.getComputedStyle;
  nw.getComputedStyle = node => (node && node.id === 'lab-notepad' ? { position: 'fixed' } : realStyle.call(nw, node));
  const scrolls = [];
  nw.scrollBy = opts => scrolls.push(opts.top);
  assert.deepEqual(JSON.parse(JSON.stringify(nw.CortexLab.viewportInsets())), { top: 0, bottom: 340 });
  // I5 (FIX5, amends H7 here): a sheet closed with the drawer open puts focus in the drawer's textarea, with
  // no scroll, wherever the heading is
  rowClick(nw, $(nw, '.lab-step[data-lab-step="water-wash"] .lab-step-title'));
  $(nw, '#lab-sheet-close').click();
  assert.equal(nw.document.activeElement.id, 'lab-notepad-text', 'not Do this step: the drawer covers it');
  assert.deepEqual(scrolls, [], 'no scroll');
  headingTop = -60;
  rowClick(nw, $(nw, '.lab-step[data-lab-step="water-wash"] .lab-step-title'));
  $(nw, '#lab-sheet-close').click();
  assert.equal(nw.document.activeElement.id, 'lab-notepad-text');
  assert.deepEqual(scrolls, [], 'the heading out of view: still no scroll');
  // a focus move that is not a sheet's close still never lands under the drawer: the heading, brought into
  // the band above it (never under it)
  nw.document.body.focus();
  n.run('labFocusUncovered(document, document.querySelector("#lab-do-step"))');
  assert.equal(nw.document.activeElement.id, 'lab-do-h');
  assert.deepEqual(scrolls, [-68], 'its top 8 px under the top bar');
  // a drop while the student types in the drawer (LEAD-1): the drag closes the drawer, so focus goes where
  // it goes with the drawer closed (Do this step), never into a hidden textarea
  headingTop = 150;
  $(nw, '#lab-notepad-text').focus();
  dragSlide(nw, $(nw, '.lab-step[data-lab-step="deparaffinize-rehydrate"]'));
  assert.equal(nw.CortexLab.getState().runs['run-1'].events.at(-1).step, 'deparaffinize-rehydrate');
  assert.equal($(nw, '#lab-notepad').hidden, true, 'the drag closed the drawer');
  assert.equal(nw.document.activeElement.id, 'lab-do-step');
  // the drawer closed: Do this step as before
  dragSlide(nw, $(nw, '.lab-step[data-lab-step="silver-impregnation"]'));
  assert.equal(nw.document.activeElement.id, 'lab-do-step');
  nw.Element.prototype.getBoundingClientRect = box;
  nw.getComputedStyle = realStyle;
  n.close();
  // (d) "I understand, open the bench": the bench's first piece brought to the top (under the top bar: the
  // page's scroll-padding; SHELF §13.3: the mode switch, right above Your slide), focus on the specimen choice
  // with no scroll of its own
  const g = harness({ url: 'http://localhost/lab?view=bench' });
  await g.w.renderLabEntry();
  const revealed = [];
  g.w.Element.prototype.scrollIntoView = function (opts) {
    revealed.push([this.id, opts && opts.block]);
  };
  $(g.w, '#lab-safety-ack').click();
  assert.deepEqual(revealed, [['lab-mode-switch', 'start']]);
  assert.equal($(g.w, '#lab-mode-switch').nextElementSibling, $(g.w, '#lab-setup'));
  assert.equal(g.w.document.activeElement.name, 'specimen');
  assert.match(
    read('lab.css'),
    /html:has\(\.lab-page\) \{ scroll-padding-top: calc\(var\(--lab-topbar-h, 64px\) \+ 8px\); \}/
  );
  g.close();
});

test('FIX4-shell-5 H8: the drop reasons describe, never order; with no run one wording everywhere ("No run yet: Start the run is under Your slide, above"); before the safety notes a jar’s double click says why on the stage, quietly', async () => {
  const words = JSON.parse(
    JSON.stringify(read('lab.js').match(/const LAB_DROP_HINTS = Object\.freeze\(\{([\s\S]*?)\}\);/)[1])
  );
  for (const banned of [/first/i, /start a/i, /\bread the\b/i, /then/i]) assert.doesNotMatch(words, banned);
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d&intro=1', benchModule: fake.module, webgl2: true });
  const { w } = h;
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  const api = fake.api();
  assert.equal(api.dropHint('development'), 'The safety notes below open the bench');
  fake.handle.skip();
  api.onEvent({ type: 'step', step: 'deparaffinize-rehydrate' });
  const hint = $(w, '#lab-stage-hint');
  assert.equal(text(hint), 'The safety notes below open the bench.');
  assert.ok(hint.classList.contains('lab-stage-hint-on'), 'in view');
  assert.equal(hint.getAttribute('aria-hidden'), 'true', 'quiet: the live region says it');
  assert.equal(text($(w, '#lab-live')), 'Steps wait for the safety notes; nothing was recorded.');
  // acknowledged, no run: the tag's reason, the stage hint and the status line read the same
  $(w, '#lab-safety-ack').click();
  assert.ok(await mounted3d(h, fake));
  const live = fake.api();
  assert.equal(live.dropHint('development'), 'No run yet: Start the run is under Your slide, above');
  live.onEvent({ type: 'step', step: 'development' });
  assert.equal(text($(w, '#lab-stage-hint')), `${live.dropHint('development')}.`);
  assert.equal(text($(w, '#lab-3d-norun')), `${live.dropHint('development')}.`);
  // a finished run: no order either
  startRun(w);
  $(w, '#lab-run-all').click();
  assert.equal(live.dropHint('development'), 'This run is finished');
  // MODE-FIX-integrate-3: the stage hint carries the run's final by-eye line, not a stale earlier one
  if (w.SilverLab.LOOKS) assert.equal(text($(w, '#lab-stage-hint')), w.SilverLab.LOOKS['gray-black'].text);
  assert.ok($(w, '#lab-stage-hint').classList.contains('lab-stage-hint-on'));
  // MODE-FIX-integrate-7: a new run starts with no line over its stage (the last run's look is gone)
  startRun(w);
  assert.equal($(w, '#lab-stage-hint').classList.contains('lab-stage-hint-on'), false, 'no stale hint on a new run');
  await flush();
  h.close();
});

test('FIX4-shell-6 H9: the intro played on a finished run ends with the camera back at the microscope (S6) and the picker naming it; "Run complete" is said once (the progress row); after the clip focus goes to what the student can see', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  startRun(w);
  $(w, '#lab-run-all').click();
  // the student flies to S1 and double-clicks the brain tray: the intro plays
  stationGo(w, 'S1');
  fake.api().onAction('specimen');
  assert.equal(fake.handle.clipState().phase, 'intro');
  // the skip button had focus; the tissue link is far below the stage, the stage in view
  const box = w.Element.prototype.getBoundingClientRect;
  w.Element.prototype.getBoundingClientRect = function () {
    if (this.id === 'lab-clip-dive') return { top: 1100, bottom: 1140, left: 16, right: 300, width: 284, height: 40 };
    if (this.id === 'lab-clip-stage') return { top: 120, bottom: 520, left: 16, right: 700, width: 684, height: 400 };
    return box.call(this);
  };
  $(w, '#lab-clip-skip').focus();
  const n = fake.calls.length;
  fake.handle.skip();
  assert.equal(w.document.activeElement.id, 'lab-clip-stage', 'what the student can see, not the link below');
  await flush();
  assert.deepEqual(
    fake.calls.slice(n).filter(c => c[0] === 'goToStation'),
    [['goToStation', 'S6']]
  );
  assert.equal(stationNamed(w), 'S6');
  assert.equal(text($(w, '#lab-clip-ended')), 'Intro finished.');
  assert.equal(text($(w, 'main')).split('Run complete').length - 1, 1, '"Run complete" once');
  w.Element.prototype.getBoundingClientRect = box;
  // I3 (FIX5): mid-run the intro's end brings the camera back to the follow view too (a fresh run: the rack's
  // station, S1), and the picker names it
  startRun(w);
  fake.api().onAction('specimen');
  const m = fake.calls.length;
  fake.handle.skip();
  await flush();
  assert.deepEqual(
    fake.calls.slice(m).filter(c => c[0] === 'goToStation' || c[0] === 'frameStations'),
    [['goToStation', 'S1']]
  );
  assert.equal(stationNamed(w), 'S1');
  await flush();
  h.close();
});

test('FIX4-shell-7 H10: CortexLab.viewportInsets() names the sticky top bar and an open notes drawer (api.viewportInsets the same); a rack drag (api.onDragState) slims the drawer like a list drag and ends with the drag or the bench', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.matchMedia = liveMedia({ [NARROW_NOTES]: true });
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  const plain = obj => JSON.parse(JSON.stringify(obj));
  assert.deepEqual(plain(w.CortexLab.viewportInsets()), { top: 0, bottom: 0 }, 'no fixed top bar, drawer closed');
  $(w, '#lab-notes-toggle').click();
  const box = w.Element.prototype.getBoundingClientRect;
  w.Element.prototype.getBoundingClientRect = function () {
    if (this.id === 'lab-notepad') return { top: w.innerHeight - 300, bottom: w.innerHeight, width: 390, height: 300 };
    if (this.matches && this.matches('header')) return { top: 0, bottom: 121, width: 390, height: 121 };
    return box.call(this);
  };
  const realStyle = w.getComputedStyle;
  w.getComputedStyle = node =>
    node && node.id === 'lab-notepad'
      ? { position: 'fixed' }
      : node && node.matches && node.matches('header')
        ? { position: 'sticky' }
        : realStyle.call(w, node);
  assert.deepEqual(plain(w.CortexLab.viewportInsets()), { top: 121, bottom: 300 });
  assert.deepEqual(plain(fake.api().viewportInsets()), { top: 121, bottom: 300 });
  w.Element.prototype.getBoundingClientRect = box;
  w.getComputedStyle = realStyle;
  // a rack drag: the page is marked while it lasts (lab.css slims the drawer and steps the float aside)
  const main = $(w, 'main.lab-notes-host');
  fake.api().onDragState(true);
  assert.ok(main.classList.contains('lab-rack-dragging'));
  fake.api().onDragState(false);
  assert.equal(main.classList.contains('lab-rack-dragging'), false);
  fake.api().onDragState(true);
  fake.api().onDragState('yes'); // anything but true ends it
  assert.equal(main.classList.contains('lab-rack-dragging'), false);
  fake.api().onDragState(true);
  $(w, '#lab-mode-toggle').click(); // the bench goes mid-drag
  assert.equal(main.classList.contains('lab-rack-dragging'), false);
  const css = read('lab.css');
  assert.match(
    css,
    /@media screen and \(max-width: 899\.98px\) \{ main\.lab-notes-host\.lab-rack-dragging \.lab-notepad \{ max-height: calc\(58px \+ env\(safe-area-inset-bottom\)\); overflow: hidden; \} \}/
  );
  assert.match(css, /main\.lab-notes-host\.lab-rack-dragging \.lab-notes-float \{ display: none; \}/);
  assert.match(
    css,
    /@media screen and \(max-width: 899\.98px\) \{ html:has\(#lab-notepad#lab-notepad:not\(\[hidden\]\)\) \{ scroll-padding-bottom: calc\(45vh \+ 8px\); \} \}/
  );
  await flush();
  h.close();
});

test('FIX4-shell-8 r3-left-shell-8 / -9 / H6: the sign chip shows only while a sign other than the current station’s is on the canvas (the bench’s visibleSigns); the station the bench really framed (its later onStation) names the picker', async () => {
  const fake = fakeBench();
  let signs = ['S1'];
  fake.handle.visibleSigns = () => {
    if (signs === 'throw') throw new Error('gone');
    return signs;
  };
  fake.handle.frameStations = ids => {
    fake.calls.push(['frameStations', [...ids]]);
    // H6: a far pair is framed at the rack's station alone; the bench names it one microtask later
    if (ids.length === 2 && ids[0] === 'S5') queueMicrotask(() => fake.api().onStation('S5'));
    return Promise.resolve(true);
  };
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  startRun(w);
  const chips = () => hudChips(w).map(c => c[0]);
  const settle = async () => {
    fake.api().onViewChange();
    await hudSettle();
  };
  await settle();
  assert.equal(stationNamed(w), 'S1');
  assert.equal(chips().includes('sign'), false, 'only the current sign on screen ("you are here" goes nowhere)');
  signs = ['S1', 'S2'];
  await settle();
  assert.ok(chips().includes('sign'));
  signs = [];
  await settle();
  assert.equal(chips().includes('sign'), false);
  signs = 'throw';
  await settle();
  assert.equal(chips().includes('sign'), false);
  delete fake.handle.visibleSigns;
  await settle();
  assert.ok(chips().includes('sign'), 'a bench that cannot say keeps the chip');
  // H6 / §11.1: a far jar is refused in practice (no flight); on the free bench the camera follows the rack
  // to that station alone (nothing is next), and the row names it
  const framed = fake.calls.filter(c => c[0] === 'frameStations').length;
  fake.api().onEvent({ type: 'step', step: 'final-wash-dehydrate-clear-mount' });
  assert.equal(fake.calls.filter(c => c[0] === 'frameStations').length, framed, 'refused: no flight');
  $(w, '#lab-setup-toggle').click();
  startRun(w, { mode: 'free' });
  // MODE-FIX-integrate-4: in 3D the jar select, Dip, Do the whole procedure and New slide are one row
  {
    const row = $(w, '#lab-do .lab-free-row');
    assert.ok(row, 'the free row in 3D');
    assert.deepEqual(
      [...row.querySelectorAll('select, button')].map(n => n.id),
      ['lab-free-step', 'lab-free-dip', 'lab-run-all', 'lab-new-slide']
    );
    assert.equal($(w, '#lab-do .lab-free-actions'), null, 'no second block of buttons in 3D');
  }
  fake.api().onEvent({ type: 'step', step: 'final-wash-dehydrate-clear-mount' });
  assert.deepEqual(
    fake.calls.filter(c => c[0] === 'goToStation').at(-1),
    ['goToStation', 'S6'],
    'sealed: the microscope, where the slide goes next'
  );
  await flush();
  assert.equal(stationNamed(w), 'S6');
  change(w, $(w, '#lab-run-select'), 'run-1');
  // the mount's framing (labFrameRun) the same: named before the flight, the bench's report wins
  h.run('labFrameRun(LAB.lab, { clip: { pending: false }, runId: "run-1", station: null })');
  await flush();
  assert.equal(stationNamed(w), 'S1', 'run-1 has no step done: its rack stands at S1');
  await flush();
  h.close();
});

test('FIX4 lab.css: 900-1099 px with the Notes column open every step sheet lies over the page; the column clears the real top bar; one rule per line', () => {
  const css = read('lab.css');
  const fix4 = css.slice(css.indexOf('/* ---------- FIX4:'));
  assert.ok(fix4.length > 100, 'the FIX4 block exists');
  assert.match(
    fix4,
    /@media \(min-width: 900px\) and \(max-width: 1099\.98px\) \{ #app main\.lab-view-bench\.lab-sheet-side\.lab-notes-open \{ padding-right: 28px; \} \}/
  );
  assert.match(
    css,
    /> \.lab-notepad \{ grid-column: 2; grid-row: 1 \/ span 40; position: sticky; top: calc\(var\(--lab-topbar-h, 64px\) \+ 12px\); margin: 0; \}/
  );
  assert.doesNotMatch(fix4, /transition|animation:/);
  for (const line of fix4.split('\n').filter(l => l.includes('{') && !l.startsWith('/*') && !l.startsWith('@media')))
    assert.equal((line.match(/\{/g) || []).length, 1, line);
});

/* ---------- FIX5 (round 5, the last fix loop): shared decisions I1-I8, shell side ---------- */
// A layout for the floating Notes button: its box follows its inline bottom / left (84 x 44, 16 px from the
// window's right edge by default); any other node takes the box set for it in `boxes`.
function fix5FloatLayout(w, boxes) {
  const H = w.innerHeight,
    W = w.innerWidth;
  const real = w.Element.prototype.getBoundingClientRect;
  w.Element.prototype.getBoundingClientRect = function () {
    if (this.id === 'lab-notes-toggle')
      return { top: -200, bottom: -156, left: 300, right: 370, width: 70, height: 44 };
    if (this.id === 'lab-notes-float') {
      const bottom = H - (parseFloat(this.style.bottom) || 16);
      const left = this.style.left ? parseFloat(this.style.left) : W - 16 - 84;
      return { top: bottom - 44, bottom, left, right: left + 84, width: 84, height: 44 };
    }
    if (boxes.has(this)) return boxes.get(this);
    return real.call(this);
  };
  return () => {
    w.Element.prototype.getBoundingClientRect = real;
  };
}
const fix5Box = (top, bottom, left, right) => ({ top, bottom, left, right, width: right - left, height: bottom - top });

test('FIX5-shell-1 I5: one function places the floating Notes button: nodes that are not drawn (inside a closed <details>, hidden) never hide it, a label’s words do; it runs again after a redraw (MutationObserver), a size change (ResizeObserver on main) and a drag’s end', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  const observed = [];
  let resized = null;
  w.ResizeObserver = class {
    constructor(fn) {
      resized = fn;
    }
    observe(node) {
      observed.push(node);
    }
    disconnect() {}
  };
  w.matchMedia = liveMedia({ [NARROW_NOTES]: true });
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  const main = $(w, 'main.lab-notes-host');
  assert.deepEqual(observed, [main], 'a ResizeObserver watches main');
  const float = () => $(w, '#lab-notes-float');
  const H = w.innerHeight,
    W = w.innerWidth;
  const spot = fix5Box(H - 60, H - 16, W - 100, W - 16);
  const boxes = new Map();
  const restore = fix5FloatLayout(w, boxes);
  const sync = () => h.run('labNotesFloatSync()');
  sync();
  assert.equal(float().hidden, false, 'nothing under it');
  // a button inside a closed <details> is not drawn: it does not count; opened, it does
  main.insertAdjacentHTML(
    'beforeend',
    '<details id="t5-more"><summary id="t5-sum">More</summary><button type="button" id="t5-inside">In</button></details>'
  );
  boxes.set($(w, '#t5-inside'), spot);
  sync();
  assert.equal(float().hidden, false, 'a button in a closed <details>');
  $(w, '#t5-more').open = true;
  sync();
  assert.equal(float().hidden, true, 'opened: drawn, so it hides');
  $(w, '#t5-more').open = false;
  boxes.set($(w, '#t5-sum'), spot);
  sync();
  assert.equal(float().hidden, true, 'the closed <details>’ summary is drawn');
  boxes.delete($(w, '#t5-sum'));
  $(w, '#t5-inside').closest('details').hidden = true;
  $(w, '#t5-more').open = true;
  sync();
  assert.equal(float().hidden, false, 'a hidden part is not drawn');
  // a label's words (a specimen card's name) hide it; its box alone does not
  main.insertAdjacentHTML(
    'beforeend',
    '<label id="t5-label"><strong>Negative comparison · no plaques</strong></label>'
  );
  const label = $(w, '#t5-label');
  boxes.set(label, fix5Box(H - 90, H - 10, 16, W - 16));
  let words = [fix5Box(H - 50, H - 30, 40, 200)];
  w.Range.prototype.getClientRects = function () {
    return this.startContainer === label ? words : [];
  };
  sync();
  assert.equal(float().hidden, false, 'the label’s box is under it, its words are not');
  words = [fix5Box(H - 50, H - 30, 40, W - 40)];
  sync();
  assert.equal(float().hidden, true, 'its words are');
  assert.match(
    SRC.lab,
    /const LAB_FLOAT_TEXT =\n {2}'li\.lab-step \.lab-step-note, li\.lab-step \.lab-step-title, label, \.lab-hud, \.labm-hud, \.labm-tally, \.labm-caption, \.labm-textalt, #lab-reactions \.lab-reaction-text, #lab-reactions \.lab-reaction-step, \.lab-empty-line';/
  );
  words = [];
  sync();
  assert.equal(float().hidden, false);
  // it runs again by itself: a redraw (a node shown or hidden in main), main's size, a drag's end
  h.run(
    'window.__fix5Syncs = 0; labNotesFloatSync = (real => () => { window.__fix5Syncs++; real(); })(labNotesFloatSync)'
  );
  const frame = () => new Promise(r => setTimeout(r, 40));
  await frame();
  w.__fix5Syncs = 0;
  $(w, '#t5-label').hidden = true;
  await frame();
  assert.ok(w.__fix5Syncs >= 1, 'a redraw');
  w.__fix5Syncs = 0;
  resized([]);
  await frame();
  assert.equal(w.__fix5Syncs, 1, 'a size change of main');
  w.__fix5Syncs = 0;
  dragSlide(w, main, { drop: false });
  pointer(w, $(w, '[data-lab-slide-chip]'), 'pointerup', 200, 300);
  assert.ok(w.__fix5Syncs >= 1, 'the drag’s end (r4-r3-p3-6: an auto-scroll may end with no scroll event)');
  restore();
  delete w.Range.prototype.getClientRects;
  await frame();
  h.close();
});

test('FIX5-shell-2 I5: while a microscope picture is on screen the floating Notes button moves to the nearest free place (up the right edge, else up the left edge) instead of hiding, never over the picture or its chips’ words; Close with no Notes button in view focuses a control in view, never the off-screen header; opening Notes there brings the picture above the drawer', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.matchMedia = liveMedia({ [NARROW_NOTES]: true });
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  const main = $(w, 'main.lab-notes-host');
  // the inline microscope on the result card (the microscope view's picture is placed the same way)
  main.insertAdjacentHTML(
    'beforeend',
    '<div class="labm-stage" id="t5-stage"><canvas id="t5-canvas"></canvas><div class="labm-hud" id="t5-hud">Tap a structure: what it is</div></div><button type="button" id="t5-under">Under</button><button type="button" id="t5-tall">Tall</button><button type="button" id="t5-left">Left</button>'
  );
  const float = () => $(w, '#lab-notes-float');
  const H = w.innerHeight,
    W = w.innerWidth;
  const boxes = new Map();
  const restore = fix5FloatLayout(w, boxes);
  const sync = () => h.run('labNotesFloatSync()');
  boxes.set($(w, '#t5-stage'), fix5Box(90, 420, 16, W - 16));
  boxes.set($(w, '#t5-canvas'), fix5Box(100, 400, 24, W - 24));
  boxes.set($(w, '#t5-under'), fix5Box(H - 78, H - 8, 16, W - 16)); // under its own place (H-60..H-16)
  sync();
  assert.equal(float().hidden, false, 'not hidden: moved');
  assert.equal(float().style.bottom, '80px', 'lifted to the nearest free place (4 px steps) above the button');
  assert.equal(float().style.left, '');
  // the whole right edge taken: the left edge
  boxes.set($(w, '#t5-tall'), fix5Box(0, H, W - 120, W));
  sync();
  assert.equal(float().hidden, false);
  assert.equal(float().style.left, '16px', 'the same gap from the left side');
  assert.equal(float().style.right, 'auto');
  // both edges taken: hidden, back at its own place
  boxes.set($(w, '#t5-left'), fix5Box(0, H, 0, 120));
  sync();
  assert.equal(float().hidden, true);
  assert.deepEqual([float().style.left, float().style.right], ['', '']);
  // never over the picture or its chips' words, the canvas the same
  boxes.delete($(w, '#t5-left'));
  boxes.delete($(w, '#t5-tall'));
  const hud = $(w, '#t5-hud');
  boxes.set(hud, fix5Box(400, 420, 24, W - 24));
  w.Range.prototype.getClientRects = function () {
    return this.startContainer === hud ? [fix5Box(H - 140, H - 100, 24, W - 24)] : [];
  };
  sync();
  const lifted = H - parseFloat(float().style.bottom);
  assert.ok(lifted <= H - 140 || lifted - 44 >= H - 100, `clear of the chips' words (bottom at ${lifted})`);
  delete w.Range.prototype.getClientRects;
  // the picture off screen: the rule of the bench (hidden over a control)
  boxes.set($(w, '#t5-canvas'), fix5Box(-600, -300, 24, W - 24));
  boxes.set($(w, '#t5-stage'), fix5Box(-610, -280, 16, W - 16));
  sync();
  assert.equal(float().hidden, true, 'no picture on screen: it hides');
  // Close with the drawer open, no Notes button in view (the float hidden, the header off screen): focus goes to
  // the first heading or control in view
  $(w, '#lab-notes-toggle').click();
  assert.equal($(w, '#lab-notepad').hidden, false);
  boxes.set($(w, '#lab-do-h'), fix5Box(200, 230, 16, W - 16));
  $(w, '#lab-notepad-close').click();
  assert.equal(float().hidden, true);
  assert.equal(w.document.activeElement.id, 'lab-do-h', 'in view, not the header above the window');
  // opening Notes while the picture is on screen brings it (with its chips) into the band above the drawer
  boxes.set($(w, '#t5-canvas'), fix5Box(400, 700, 24, W - 24));
  boxes.set($(w, '#t5-stage'), fix5Box(390, 720, 16, W - 16));
  const pad = $(w, '#lab-notepad');
  boxes.set(pad, fix5Box(H - 340, H, 0, W));
  const realStyle = w.getComputedStyle;
  w.getComputedStyle = node => (node && node.id === 'lab-notepad' ? { position: 'fixed' } : realStyle.call(w, node));
  const scrolls = [];
  w.scrollBy = opts => scrolls.push(opts.top);
  $(w, '#lab-notes-toggle').click();
  assert.deepEqual(scrolls, [720 - (H - 340) + 8], 'the stage’s bottom 8 px above the drawer');
  assert.equal(w.document.activeElement.id, 'lab-notepad-text');
  w.getComputedStyle = realStyle;
  restore();
  await flush();
  h.close();
});

test('FIX5-shell-3 I5 + LEAD-1: on a narrow screen a drag on the bench (the list’s slide, the 3D rack) closes an open drawer (no slim bar); Notes opens it again with the caret at the end; a sheet closed with the drawer open puts focus in it with no scroll; the row that reacted clears the drawer', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  w.matchMedia = liveMedia({ [NARROW_NOTES]: true });
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  const main = $(w, 'main.lab-notes-host');
  const open = () => !$(w, '#lab-notepad').hidden;
  const row = id => $(w, `.lab-step[data-lab-step="${id}"]`);
  assert.equal($(w, '#lab-notepad-more').hidden, true, 'the old Open button never shows');
  // the drawer closed: a drop changes nothing about it
  dragSlide(w, row('deparaffinize-rehydrate'));
  assert.equal(open(), false);
  // open, type, drop: the drawer closes (its text kept), never slim
  $(w, '#lab-notes-toggle').click();
  assert.ok(open());
  const area = $(w, '#lab-notepad-text');
  area.value = 'first note';
  area.dispatchEvent(new w.Event('input', { bubbles: true }));
  dragSlide(w, row('silver-impregnation'));
  assert.equal(w.CortexLab.getState().runs['run-1'].events.at(-1).step, 'silver-impregnation');
  assert.equal(open(), false, 'closed after the drop');
  assert.equal(main.classList.contains('lab-notes-slim'), false, 'never slim');
  assert.equal(w.CortexLab.getState().settings.notesOpenNarrow, false);
  assert.notEqual(w.document.activeElement.id, 'lab-notepad-text', 'focus never left in a hidden drawer');
  // Notes opens it again, the caret after the old text
  $(w, '#lab-notes-toggle').click();
  assert.ok(open());
  assert.equal(w.document.activeElement.id, 'lab-notepad-text');
  assert.equal(area.selectionStart, area.value.length, 'the caret at the end');
  // a sheet closed with the drawer open: focus in the drawer, no scroll
  const scrolls = [];
  w.scrollBy = opts => scrolls.push(opts.top);
  rowClick(w, $(w, '.lab-step[data-lab-step="development"] .lab-step-title'));
  $(w, '#lab-sheet-close').click();
  assert.equal(w.document.activeElement.id, 'lab-notepad-text');
  assert.deepEqual(scrolls, []);
  // Close closes it
  $(w, '#lab-notepad-close').click();
  assert.equal(open(), false);
  // the row that reacted clears the open drawer's top (as it clears a stuck Do this step)
  $(w, '#lab-notes-toggle').click();
  const H = w.innerHeight;
  const target = row('gold-toning');
  const boxes = new Map([
    [$(w, '#lab-notepad'), fix5Box(H - 66, H, 0, 390)],
    [target, fix5Box(H - 90, H - 38, 16, 374)],
  ]);
  const restore = fix5FloatLayout(w, boxes);
  const realStyle = w.getComputedStyle;
  w.getComputedStyle = node => (node && node.id === 'lab-notepad' ? { position: 'fixed' } : realStyle.call(w, node));
  scrolls.length = 0;
  h.run('labClearStickyBar(document.querySelector(\'.lab-step[data-lab-step="gold-toning"]\'))');
  assert.deepEqual(scrolls, [H - 38 + 8 - (H - 66)], 'the row’s bottom 8 px above the drawer’s top');
  w.getComputedStyle = realStyle;
  restore();
  h.close();
  // 3D: a rack drag that ends closes the drawer; Escape during the drag is the drag's, not the drawer's
  const fake = fakeBench();
  const b = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  b.w.matchMedia = liveMedia({ [NARROW_NOTES]: true });
  b.w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await b.w.renderLabEntry();
  assert.ok(await mounted3d(b, fake));
  startRun(b.w);
  $(b.w, '#lab-notes-toggle').click();
  const bmain = $(b.w, 'main.lab-notes-host');
  fake.api().onDragState(true);
  press(b.w, $(b.w, '#lab-notepad-text'), 'Escape');
  assert.equal($(b.w, '#lab-notepad').hidden, false, 'Escape during a rack drag leaves the drawer to the drag');
  fake.api().onDragState(false);
  fake.api().onEvent({ type: 'step', step: 'deparaffinize-rehydrate' });
  assert.equal($(b.w, '#lab-notepad').hidden, true, 'the stage that reacted is uncovered: the drawer closed');
  assert.equal(bmain.classList.contains('lab-notes-slim'), false);
  assert.equal(bmain.classList.contains('lab-rack-dragging'), false);
  await flush();
  b.close();
});

test('FIX5-shell-4 I2: "Back to my station" (button#lab-recenter) over the stage’s corner shows while the bench says the camera is away (isAway, re-read on api.onViewChange), in the bench phase only; a press calls recenter() and hides it (focus on the stage); a bench without isAway / recenter never shows it; the budget grows by one only while it shows', async () => {
  const fake = fakeBench();
  let away = false;
  const asked = [];
  Object.assign(fake.handle, {
    isAway: () => away,
    recenter: () => {
      asked.push('recenter');
      return Promise.resolve(true);
    },
  });
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  startRun(w);
  const button = () => $(w, '#lab-recenter');
  assert.equal(button().tagName, 'BUTTON');
  assert.equal(text(button()), 'Back to my station');
  assert.equal(button().parentElement, $(w, '.lab-stage-box'), 'over the stage');
  assert.equal(button().hidden, true);
  const before = firstViewControls(w);
  away = true;
  fake.api().onViewChange();
  await hudSettle();
  assert.equal(button().hidden, false, 'the camera is away');
  assert.ok(firstViewControls(w).includes('lab-recenter'));
  assert.equal(firstViewControls(w).length, before.length + 1, 'one more control while it shows');
  button().focus();
  button().click();
  assert.deepEqual(asked, ['recenter']);
  assert.equal(button().hidden, true);
  assert.equal(w.document.activeElement.id, 'lab-clip-stage', 'focus stays by the stage');
  away = false;
  fake.api().onViewChange();
  await hudSettle();
  assert.equal(button().hidden, true);
  assert.deepEqual(firstViewControls(w), before);
  // during the intro (the clip holds the camera) it never shows
  away = true;
  fake.api().onAction('specimen');
  fake.api().onViewChange();
  await hudSettle();
  assert.equal(button().hidden, true, 'not while the intro plays');
  fake.handle.skip();
  fake.api().onViewChange();
  await hudSettle();
  assert.equal(button().hidden, false, 'back on the bench');
  // a bench without the pair of functions: never
  delete fake.handle.recenter;
  fake.api().onViewChange();
  await hudSettle();
  assert.equal(button().hidden, true);
  const css = read('lab.css');
  assert.match(css, /\.lab-recenter \{ position: absolute; z-index: 3; right: 10px; bottom: 10px; min-height: 36px;/);
  assert.match(css, /@media \(pointer: coarse\) \{ \.lab-recenter \{ min-height: 44px; \} \}/);
  assert.match(css, /\.lab-recenter\[hidden\] \{ display: none; \}/);
  await flush();
  h.close();
});

test('FIX5-shell-5 I3: the structure card opens on the side of the stage away from the pointer’s press and the canvas keeps its size; Escape with the card open closes only the card (focus on the stage), Escape again leaves explore; leaving explore closes the card; while the dive plays a greyed-out Explore says why, in view', async () => {
  const fake = fakeBench();
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  const explore = () => $(w, '#lab-clip-explore');
  const why = () => $(w, '#lab-clip-explore-why');
  assert.equal(text(why()), 'Explore opens when the dive ends.');
  assert.equal(explore().getAttribute('aria-describedby'), 'lab-clip-explore-why');
  assert.equal(why().hidden, true, 'nothing to say on the bench');
  $(w, '#lab-clip-dive').click();
  assert.ok(!explore().hidden && explore().disabled);
  assert.equal(why().hidden, false, 'the dive plays: the reason shows under the buttons');
  assert.ok(why().closest('#lab-clip-controls'));
  fake.api().onEnd('dive');
  assert.equal(explore().disabled, false);
  assert.equal(why().hidden, true, 'gone once Explore opens');
  const wrap = $(w, '#lab-clip-stage');
  press(w, wrap, 'e');
  assert.equal($(w, '.lab-bench-3d').dataset.labClipPhase, 'explore');
  // the press point decides the side: a press on the right half puts the card on the left, and the other way
  const real = w.Element.prototype.getBoundingClientRect;
  w.Element.prototype.getBoundingClientRect = function () {
    return this.id === 'lab-clip-stage' ? fix5Box(100, 480, 100, 800) : real.call(this);
  };
  pointer(w, wrap, 'pointerdown', 700, 300);
  fake.api().onInspect('plaque-core');
  const layout = $(w, '.lab-clip-layout');
  assert.equal(layout.dataset.labClipCard, 'open');
  assert.equal(layout.dataset.labClipSide, 'left');
  pointer(w, wrap, 'pointerdown', 200, 300);
  fake.api().onInspect('soma');
  assert.equal(layout.dataset.labClipSide, 'right');
  w.Element.prototype.getBoundingClientRect = real;
  // Escape: the card first, and only it
  const n = fake.calls.length;
  wrap.focus();
  press(w, wrap, 'Escape');
  assert.equal($(w, '#lab-clip-card').hidden, true);
  assert.equal(layout.dataset.labClipCard, 'closed');
  assert.equal(fake.calls.length, n, 'explore stays');
  assert.equal(w.document.activeElement, wrap);
  press(w, wrap, 'Escape');
  assert.deepEqual(fake.last(), ['leaveExplore'], 'no card: Escape leaves explore as before');
  // Escape inside the card closes it too
  press(w, wrap, 'e');
  fake.api().onInspect('plaque-core');
  $(w, '#lab-clip-card-close').focus();
  press(w, $(w, '#lab-clip-card-close'), 'Escape');
  assert.equal($(w, '#lab-clip-card').hidden, true);
  assert.equal(w.document.activeElement, wrap);
  // leaving explore (the button) closes an open card
  fake.api().onInspect('plaque-core');
  assert.equal($(w, '#lab-clip-card').hidden, false);
  explore().click();
  assert.deepEqual(fake.last(), ['leaveExplore']);
  assert.equal($(w, '#lab-clip-card').hidden, true, 'the card belongs to explore');
  // lab.css: the card lies over the stage from 900 px (no column that narrows the canvas), on the side the
  // shell names; its values fit their boxes
  const css = read('lab.css');
  assert.doesNotMatch(css, /\.lab-clip-layout\[data-lab-clip-card="open"\] \{ grid-template-columns/);
  assert.match(
    css,
    /@media \(min-width: 900px\) \{ \.lab-clip-layout > \.lab-clip-card \{ position: absolute; z-index: 3; top: 8px; right: 8px;/
  );
  assert.match(
    css,
    /@media \(min-width: 900px\) \{ \.lab-clip-layout\[data-lab-clip-side="left"\] > \.lab-clip-card \{ right: auto; left: 8px; \} \}/
  );
  assert.match(css, /\.lab-clip-card \.lab-clip-kv > div \{ flex: 1 1 auto; min-width: max-content; \}/);
  await flush();
  h.close();
});

test('FIX5-shell-6 I6 / I7 / I8: Record is announced once (the microscope’s status; the shell says nothing, never "saved"); Show hints off hides the 3D tip’s jar and zoom sentence and the bench’s zoom hint; the section-on-slide line only right after the intro and before the run’s first step; the bench’s own station report re-reads the HUD; after a clip focus goes to a target at least partly in view, else the stage', async () => {
  // I6: the shell's onMeasurement records and announces nothing
  const s = harness({ url: 'http://localhost/lab?view=bench' });
  s.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await s.w.renderLabEntry();
  const run = startRun(s.w);
  $(s.w, '#lab-run-all').click();
  $(s.w, '#lab-live').textContent = '';
  s.w.__fix5Run = run.id;
  const record = s.run(
    'labScopeOptions(LAB.lab, [LAB_STATE.runs[window.__fix5Run]]).onMeasurement({ measurementId: "roi-lesion-count", runId: window.__fix5Run, label: "illustrative-synthetic", value: 2, unit: "count", manual: false })'
  );
  assert.equal(record.value, 2);
  assert.equal(Object.keys(s.w.CortexLab.getState().measurements).length, 1, 'recorded');
  assert.equal(text($(s.w, '#lab-live')), '', 'no second announcement');
  assert.doesNotMatch(SRC.lab, /Measurement saved/);
  s.close();
  // I7: Show hints off
  const fake = fakeBench();
  let signs = ['S1'];
  fake.handle.visibleSigns = () => signs;
  const h = harness({ url: 'http://localhost/lab?view=bench&mode=3d', benchModule: fake.module, webgl2: true });
  const { w } = h;
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK, mode: '3d' });
  await w.renderLabEntry();
  assert.ok(await mounted3d(h, fake));
  const verbs = $(w, '.lab-stage-tip .lab-tip-verbs');
  assert.match(text(verbs), /^Click a jar to read about its step; double-click it to do the step\./);
  assert.match(
    text($(w, '.lab-stage-tip')),
    /The slide's tint follows the procedure's by-eye column; it is a drawing, not a stain image\.$/
  );
  assert.match(read('lab.css'), /html\.lab-hints-off \.lab-tip-verbs \{ display: none; \}/);
  w.CortexLab.setHints(false);
  fake.api().onHint('Hold Ctrl (⌘ on Mac) and scroll to zoom');
  assert.equal(text($(w, '#lab-stage-hint')), '', 'the zoom hint is a verb line: off');
  w.CortexLab.setHints(true);
  fake.api().onHint('Hold Ctrl (⌘ on Mac) and scroll to zoom');
  assert.equal(text($(w, '#lab-stage-hint')), 'Hold Ctrl (⌘ on Mac) and scroll to zoom');
  // the section-on-slide line: after the intro, before the first step only
  startRun(w);
  fake.api().onAction('specimen');
  fake.handle.skip();
  assert.equal($(w, '#lab-clip-loaded').hidden, false, 'right after the intro, no step yet');
  assert.match(text($(w, '#lab-live')), /The section is on the first slide \(a drawing\); Play the intro/);
  $(w, '#lab-do-step').click();
  assert.equal($(w, '#lab-clip-loaded').hidden, true, 'past step 1 it would read as stale');
  fake.api().onAction('specimen');
  fake.handle.skip();
  assert.equal($(w, '#lab-clip-loaded').hidden, true);
  assert.equal(text($(w, '#lab-live')), 'Intro finished. Play the intro (under 3D options) replays it.');
  await flush();
  // p5-5: the bench's own station report (a far pair framed at the rack's station alone) re-reads the HUD
  signs = ['S5'];
  fake.api().onViewChange();
  await hudSettle();
  const chips = () => hudChips(w).map(c => c[0]);
  signs = ['S5'];
  fake.api().onStation('S1');
  await hudSettle();
  assert.ok(chips().includes('sign'), 'the guess S1: S5 counts as another sign');
  fake.api().onStation('S5');
  await hudSettle();
  assert.equal(chips().includes('sign'), false, 'the bench names S5: no stale sign chip, with no view change');
  // I8: after a clip, a target partly in view is preferred to one far below; none: the stage
  const real = w.Element.prototype.getBoundingClientRect;
  const H = w.innerHeight;
  w.Element.prototype.getBoundingClientRect = function () {
    if (this.id === 'lab-do-h') return fix5Box(H - 10, H + 15, 16, 300); // partly in view
    if (this.id === 'lab-clip-stage') return fix5Box(-300, 20, 16, 700); // partly in view, later in the list
    if (this.id === 'lab-clip-dive' || this.id === 'lab-do-step') return fix5Box(H + 500, H + 540, 16, 300);
    return real.call(this);
  };
  fake.api().onAction('specimen');
  $(w, '#lab-clip-skip').focus();
  fake.handle.skip();
  assert.equal(w.document.activeElement.id, 'lab-do-h', 'the first target at least partly in view');
  w.Element.prototype.getBoundingClientRect = function () {
    if (/^lab-(clip-stage|clip-dive|do-step|do-h)$/.test(this.id)) return fix5Box(H + 500, H + 540, 16, 300);
    return real.call(this);
  };
  fake.api().onAction('specimen');
  $(w, '#lab-clip-skip').focus();
  fake.handle.skip();
  assert.equal(w.document.activeElement.id, 'lab-clip-stage', 'none in view: the stage, never one far below');
  w.Element.prototype.getBoundingClientRect = real;
  await flush();
  h.close();
});

test('FIX5 lab.css: the slim drawer after a drag (its Open button), the way back in 3D, the structure card over the stage, the Explore reason, the hints-off verb sentence; one rule per line', () => {
  const css = read('lab.css');
  const fix5 = css.slice(css.indexOf('/* ---------- FIX5:'));
  assert.ok(fix5.length > 100, 'the FIX5 block exists');
  assert.match(
    fix5,
    /@media screen and \(max-width: 899\.98px\) \{ main\.lab-notes-host\.lab-notes-slim \.lab-notepad \{ max-height: calc\(58px \+ env\(safe-area-inset-bottom\)\); overflow: hidden; \} \}/
  );
  assert.match(fix5, /#lab-notepad-more\[hidden\] \{ display: none; \}/);
  assert.match(
    fix5,
    /\.lab-stage-box:has\(> \.lab-recenter:not\(\[hidden\]\)\) > \.lab-stage-hint \{ bottom: 64px; \}/
  );
  assert.match(fix5, /\.lab-clip-explore-why \{ flex: 1 0 100%;/);
  assert.match(fix5, /@media print \{ \.lab-recenter \{ display: none !important; \} \}/);
  assert.doesNotMatch(fix5, /transition|animation:/);
  for (const line of fix5.split('\n').filter(l => l.includes('{') && !l.startsWith('/*') && !l.startsWith('@media')))
    assert.equal((line.match(/\{/g) || []).length, 1, line);
});

// REF-shell (2026-10-13, contract §12.4 and the shell half of §12.3): CortexLab.getSetting / setSetting
// (settings.microscopeView, default 'real', saved through labSave, the 'setting' event), the result card's
// and the Slide now card's thumbnail switching to the first real photo the microscope's referenceSlides
// offers (img + the Real slide badge; the drawing for an empty list, a missing function or one that
// throws), the About page's Real slide row and sentence, the home and intro ledes, and the badge legend.
const REF_ASSET = JSON.parse(read('data/lab/assets.json')).items[0];
const scopeStub = (w, { slides = null, thumbs = [], mounts = [], calls = [] } = {}) => {
  w.CortexLabMicroscope = {
    mount(host, opts) {
      mounts.push({ host: host.id || host.dataset.labSlot || host.className, opts });
      host.innerHTML = '<div class="labm"></div>';
      return { destroy() {} };
    },
    renderSynthetic(canvas, opts) {
      thumbs.push({ canvas, opts });
      return { width: opts.width, height: opts.height };
    },
    ...(slides === null
      ? {}
      : {
          referenceSlides(lab, outcome, specimen) {
            calls.push({ lab, outcome, specimen });
            if (typeof slides === 'function') return slides(lab, outcome, specimen);
            return slides;
          },
        }),
  };
  return { thumbs, mounts, calls };
};

test('REF-shell-1 CortexLab.getSetting / setSetting: microscopeView reads real without the key (an older save), a set value is saved and read back by a second harness, the setting event carries { name, value }, a bad name or an unknown stored value falls back', async () => {
  const h = harness({ url: 'http://localhost/lab?view=home' });
  await h.w.renderLabEntry();
  const { w } = h;
  const C = w.CortexLab;
  assert.equal(typeof C.getSetting, 'function');
  assert.equal(typeof C.setSetting, 'function');
  assert.equal(C.getSetting('microscopeView'), 'real', 'the default');
  assert.equal(C.getState().settings.microscopeView, 'real', 'merged into a fresh state');
  assert.equal(C.getSetting('hints'), true, 'any settings key reads through');
  assert.equal(C.getSetting('nothing-here'), undefined);
  const events = [];
  const off = C.events.on('setting', e => events.push(e));
  assert.equal(C.setSetting('microscopeView', 'drawing'), true, 'written');
  assert.equal(JSON.stringify(events), JSON.stringify([{ name: 'microscopeView', value: 'drawing' }]));
  assert.equal(C.getSetting('microscopeView'), 'drawing');
  assert.equal(JSON.parse(h.store.get(STATE_KEY)).settings.microscopeView, 'drawing', 'saved through labSave');
  assert.equal(C.setSetting('', 'x'), false, 'a bad name is refused');
  assert.equal(C.setSetting(7, 'x'), false);
  assert.equal(events.length, 1, 'no event for a refused name');
  off();
  // the microscope mount reads the same settings object the shell saves
  const { mounts } = scopeStub(w);
  C.setState({ safetyAcknowledgedAt: ACK });
  w.history.replaceState(null, '', '/lab?view=bench');
  await w.renderLabEntry();
  startRun(w);
  $(w, '#lab-run-all').click();
  $(w, '#lab-scope-btn').click();
  const inline = mounts.find(m => m.host === 'lab-scope-inline');
  assert.ok(inline, 'inline mount');
  assert.equal(inline.opts.settings.microscopeView, 'drawing', 'the mount sees the saved view');
  const saved = h.store.get(STATE_KEY);
  h.close();
  // a second harness reads it back; an older save without the key (or with a stray value) reads real
  const again = harness({ url: 'http://localhost/lab?view=home', store: new Map([[STATE_KEY, saved]]) });
  await again.w.renderLabEntry();
  assert.equal(again.w.CortexLab.getSetting('microscopeView'), 'drawing', 'survives a reload');
  again.close();
  const older = JSON.parse(saved);
  delete older.settings.microscopeView;
  const old = harness({ url: 'http://localhost/lab?view=home', store: new Map([[STATE_KEY, JSON.stringify(older)]]) });
  await old.w.renderLabEntry();
  assert.equal(old.w.CortexLab.getSetting('microscopeView'), 'real', 'an older save loads with the default');
  assert.equal(old.w.CortexLab.getState().runOrder.length, 1, 'and nothing else changed');
  old.close();
  older.settings.microscopeView = 'photo';
  const stray = harness({
    url: 'http://localhost/lab?view=home',
    store: new Map([[STATE_KEY, JSON.stringify(older)]]),
  });
  await stray.w.renderLabEntry();
  assert.equal(stray.w.CortexLab.getSetting('microscopeView'), 'real', 'an unknown stored view reads real');
  stray.close();
});

test('REF-shell-2 result card: with referenceSlides offering photos the thumbnail is the first photo (img src / alt from the asset, the same box) under a Real slide badge; the hint and the click still open the microscope; the drawing is not painted', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  const second = { ...REF_ASSET, id: 'A-second', src: '/assets/lab/reference/second.jpg?v=1' };
  const { thumbs, mounts, calls } = scopeStub(w, { slides: [REF_ASSET, second] });
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  startRun(w);
  $(w, '#lab-run-all').click();
  const card = $(w, '#lab-resolve-out .lab-result-card');
  assert.ok(card, 'the result card');
  assert.ok(calls.length >= 1, 'referenceSlides was asked');
  const call = calls.at(-1);
  assert.equal(call.lab, w.LAB.lab, 'the lab object');
  assert.equal(call.outcome.label, 'illustrative-synthetic', 'the resolved outcome');
  assert.equal(call.specimen.id, 'SPEC-SYN-AD-01', 'the specimen');
  const pic = card.querySelector('#lab-scope-btn .lab-result-pic');
  assert.ok(pic.classList.contains('lab-result-pic-real'), 'the photo box is the drawing box');
  assert.equal(pic.dataset.labRealSlide, REF_ASSET.id);
  assert.equal(pic.getAttribute('aria-hidden'), 'true', 'the button names it');
  const img = pic.querySelector('img.lab-result-photo');
  assert.ok(img, 'an img');
  assert.equal(img.getAttribute('src'), REF_ASSET.src, 'the first photo');
  assert.equal(img.getAttribute('alt'), REF_ASSET.description);
  assert.equal(img.getAttribute('width'), String(REF_ASSET.width));
  assert.equal(pic.querySelector('canvas'), null, 'no drawing in the box');
  assert.equal(thumbs.length, 0, 'the drawing thumbnail was not painted');
  const badge = card.querySelector('.lab-thumb-real [data-lab-badge="reference-none"]');
  assert.ok(badge, 'the Real slide badge');
  assert.equal(text(badge.querySelector('.lab-badge-text')), 'Real slide');
  assert.equal(badge.dataset.labLabel, 'observed-reference', 'the brief label on a real photo');
  assert.equal(
    text(badge.querySelector('.lab-sr-only')),
    'A real slide from a published study, not your run; the microscope shows its credit.'
  );
  assert.ok(
    card.querySelector('.lab-thumb-real').compareDocumentPosition(pic) & w.Node.DOCUMENT_POSITION_FOLLOWING,
    'the badge sits above the picture, covering nothing'
  );
  assert.equal(text($(w, '#lab-scope-btn')), 'Open in the microscope', 'the button text is unchanged');
  assert.equal(text(card.querySelector('.lab-thumb-hints')), 'Click the slide: open the microscope');
  assert.doesNotMatch(text(card), /pending|\bthen\b|\bv1\b|schematic|ordinal|\bSOP\b|\bparam\b/i);
  $(w, '#lab-scope-btn').click();
  const inline = mounts.find(m => m.host === 'lab-scope-inline');
  assert.ok(inline, 'the click opens the microscope on the run');
  assert.equal(inline.opts.runs[0].id, 'run-1');
  assert.equal(text($(w, '#lab-scope-btn')), 'Close the microscope');
  assert.ok($(w, '#lab-scope-btn .lab-result-pic-real img'), 'the photo stays while the viewer is open');
  h.close();
});

test('REF-shell-3 result card: an empty list, a missing referenceSlides or one that throws keeps the drawing thumbnail (no img, no badge, renderSynthetic painted); a card with no picture asks for no photo', async () => {
  for (const slides of [
    [],
    null,
    () => {
      throw new Error('no rule');
    },
    'not a list',
  ]) {
    const h = harness({ url: 'http://localhost/lab?view=bench' });
    const { w } = h;
    const { thumbs, calls } = scopeStub(w, { slides });
    w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
    await w.renderLabEntry();
    startRun(w);
    $(w, '#lab-run-all').click();
    const card = $(w, '#lab-resolve-out .lab-result-card');
    const label = slides === null ? 'missing' : typeof slides === 'function' ? 'throwing' : JSON.stringify(slides);
    assert.equal(card.querySelector('.lab-result-pic-real'), null, `${label}: no photo box`);
    assert.equal(card.querySelector('img'), null, `${label}: no img`);
    assert.equal(card.querySelector('.lab-thumb-real, [data-lab-badge="reference-none"]'), null, `${label}: no badge`);
    assert.equal(thumbs.length, 1, `${label}: the drawing thumbnail painted once`);
    assert.ok(thumbs[0].canvas.closest('#lab-scope-btn .lab-result-pic'), `${label}: in the box`);
    assert.equal(calls.length, slides === null ? 0 : 1, `${label}: asked once when the function exists`);
    h.close();
  }
  // a run still in progress has no thumbnail and asks for no photo
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { calls } = scopeStub(h.w, { slides: [REF_ASSET] });
  h.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await h.w.renderLabEntry();
  startRun(h.w);
  $(h.w, '#lab-do-step').click();
  assert.ok($(h.w, '#lab-resolve-out .lab-result-card[data-lab-card="step-skipped"]'), 'in progress');
  assert.equal($(h.w, '#lab-resolve-out img'), null);
  assert.equal(calls.length, 0, 'no photo asked for a card with no picture');
  h.close();
});

test('REF-shell-4 Slide now card (free bench): the first photo as its thumbnail with the Real slide badge and the hint; the click opens the microscope on the run; an empty list leaves the card as it was', async () => {
  const h = harness({ url: 'http://localhost/lab?view=bench' });
  const { w } = h;
  const { mounts, calls } = scopeStub(w, { slides: [REF_ASSET] });
  w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await w.renderLabEntry();
  const run = startRun(w, { mode: 'free' });
  const card = $(w, '#lab-slide-now');
  assert.ok(card, 'the Slide now card');
  assert.equal(calls.at(-1).outcome.label, 'illustrative-synthetic');
  assert.equal(calls.at(-1).specimen.id, run.specimenId);
  const wrap = card.querySelector('.lab-slide-now-thumbwrap');
  assert.ok(wrap, 'the thumbnail block');
  const img = wrap.querySelector('#lab-slide-now-scope .lab-result-pic-real img');
  assert.ok(img, 'the photo in the drawing box');
  assert.equal(img.getAttribute('src'), REF_ASSET.src);
  assert.equal(img.getAttribute('alt'), REF_ASSET.description);
  assert.equal(text(wrap.querySelector('.lab-thumb-real .lab-badge-text')), 'Real slide');
  assert.equal(text(wrap.querySelector('.lab-thumb-hints')), 'Click the slide: open the microscope');
  assert.equal(text(wrap.querySelector('#lab-slide-now-scope')), 'Open in the microscope');
  assert.equal(text($(w, '#lab-look-slide')), 'Look at your slide', 'Look at your slide stays');
  assert.equal($$(w, '#lab-slide-now [data-lab-badge="reference-none"]').length, 1, 'one badge');
  $(w, '#lab-slide-now-scope').click();
  const full = await until(w, '#lab-scope-host .labm');
  assert.ok(full, 'the click opens the microscope view');
  const mount = mounts.find(m => m.host === 'lab-scope-host');
  assert.equal(mount.opts.runs[0].id, run.id, 'on this run');
  assert.equal(new URLSearchParams(w.location.search).get('run'), run.id);
  h.close();
  // an empty list: the card as before (no thumbnail block at all)
  const e = harness({ url: 'http://localhost/lab?view=bench' });
  scopeStub(e.w, { slides: [] });
  e.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await e.w.renderLabEntry();
  startRun(e.w, { mode: 'free' });
  assert.ok($(e.w, '#lab-slide-now'));
  assert.equal(
    $(e.w, '#lab-slide-now .lab-slide-now-thumbwrap, #lab-slide-now img, #lab-slide-now .lab-thumb-real'),
    null
  );
  assert.equal(text($(e.w, '#lab-look-slide')), 'Look at your slide');
  e.close();
});

test('REF-shell-5 How this lab works: the Real slide badge row (short "Real slide", the hidden long words), the reference sentence, and no "none yet" / rights-cleared / release words anywhere', async () => {
  const h = harness({ url: 'http://localhost/lab?view=about' });
  await h.w.renderLabEntry();
  const { w } = h;
  const row = $(w, '.lab-about-labels dt [data-lab-badge="reference-none"]').closest('div');
  assert.equal(text(row.querySelector('.lab-badge-text')), 'Real slide');
  assert.equal(
    text(row.querySelector('.lab-sr-only')),
    'A real photomicrograph from an open-access study, shown when one matches the run; credited under the picture.'
  );
  assert.equal(
    text(row.querySelector('dd')),
    'A real photomicrograph of a published slide. Real slides from open-access studies appear in the microscope when one matches the run, credited under each; it is never your run.'
  );
  const main = text($(w, 'main'));
  assert.match(main, /Finished runs can be compared with real slides from open-access studies, credited under each\./);
  assert.match(main, /Darker does not mean more protein, more pathology or a better method\./);
  assert.doesNotMatch(
    main,
    /none yet|rights-cleared|Reference image|pending|\bthen\b|\bv1\b|schematic|ordinal|\bSOP\b|\bparam\b|\bcard\b|in this build/i
  );
  assert.deepEqual($$(w, 'main h2').map(text), ['What this is', 'What the labels mean', 'Safety notes']);
  h.close();
});

test('REF-shell-6 the home and intro ledes gain the one real-slides sentence; the words / badge kinds keep their keys; no real-slide string in lab.js says pending, then, v1 or schematic', async () => {
  const home = harness({ url: 'http://localhost/lab?view=home' });
  await home.w.renderLabEntry();
  assert.equal(
    text($(home.w, '.lab-lede')),
    'Practice the modified Bielschowsky silver stain step by step, or take the free bench and mix anything to see what happens. Finished runs can be compared with real slides from open-access studies.'
  );
  assert.equal($$(home.w, 'main a, main button').length, 2, 'the sentence adds no control');
  assert.equal(home.w.CortexLab.words.referenceNone, 'Real slide');
  assert.equal(home.run('Object.keys(LAB_BADGE_TEXT).join()'), 'simulated,not-modeled,reference-none,in-progress');
  home.close();
  const intro = harness({ url: 'http://localhost/lab?view=intro' });
  await intro.w.renderLabEntry();
  assert.equal(
    text($(intro.w, '.lab-lede')),
    'The same scenes the 3D clip shows, written out. Everything in them is a drawing, not real tissue. Finished runs can be compared with real slides from open-access studies.'
  );
  intro.close();
  // the strings this round added, read from the source
  const added = [...SRC.lab.matchAll(/real slide[^'`]*|Real slide[^'`]*/g)].map(m => m[0]);
  assert.ok(added.length >= 4, `the real-slide strings: ${added.length}`);
  for (const s of added) assert.doesNotMatch(s, /pending|\bthen\b|\bv1\b|schematic|ordinal|\bSOP\b|\bparam\b/i, s);
});

// ---------- SHELF-shell (contract §13.3): the open free bench ----------
// The mode switch, the jars (rows, the editor, Add a jar, Remove jar, Reset every jar), Your hands, the dip
// event, "Currently unknown reaction" in the log and on Slide now, the S9 station button and the bench api.
const SHELF = async (url = 'http://localhost/lab?view=bench', opts = {}) => {
  const h = harness({ url, ...opts });
  h.w.CortexLab.setState({ safetyAcknowledgedAt: ACK });
  await h.w.renderLabEntry();
  return h;
};
// The bench's run, its jar row, and a jar's sheet (a row click; the editor sits in it).
const shelfRun = w => w.CortexLab.getState().runs[w.CortexLab.getState().runOrder.at(-1)];
const jarRow = (w, id) => $(w, `#lab-do li.lab-step[data-lab-jar="${id}"]`);
const openJar = (w, id) => jarRow(w, id).querySelector('.lab-step-title').click();
const optionTexts = select => [...select.options].map(o => o.textContent);
// Values made in the page's realm compare by structure only after a round trip (deepStrictEqual checks prototypes).
const plain = x => JSON.parse(JSON.stringify(x));
// A chip's words without its "?" mark (aria-hidden, drawn apart by the CSS gap).
const chipWords = chip => text(chip).replace(/^\?/, '');

test('SHELF-1 the mode switch: at the top of the bench body, a named group of two pressed-state buttons; with no run it sets the mode the next run starts in (the cards follow, remembered, announced); the pressed mode does nothing', async () => {
  const h = await SHELF();
  const { w } = h;
  const sw = $(w, '#lab-mode-switch');
  assert.equal(sw.parentElement.id, 'lab-bench-body');
  assert.equal(sw, $(w, '#lab-bench-body').firstElementChild, 'the first thing in the bench body');
  assert.equal(sw.getAttribute('role'), 'group');
  assert.equal(sw.getAttribute('aria-label'), 'How you work');
  const buttons = () => $$(w, '#lab-mode-switch button[data-lab-benchmode]');
  assert.deepEqual(
    buttons().map(b => [b.dataset.labBenchmode, text(b), b.getAttribute('aria-pressed'), b.type]),
    [
      ['practice', 'Practice the procedure', 'true', 'button'],
      ['free', 'Free bench', 'false', 'button'],
    ]
  );
  buttons()[1].focus();
  buttons()[1].click();
  assert.deepEqual(
    buttons().map(b => b.getAttribute('aria-pressed')),
    ['false', 'true']
  );
  assert.equal($(w, '#lab-bench-mode input:checked').value, 'free', 'the set-up card follows');
  assert.ok($(w, '#lab-newrun-guess'), 'the free set-up (the guess field)');
  assert.equal(w.CortexLab.getState().runOrder.length, 0, 'no run is made');
  assert.equal(JSON.parse(h.store.get(STATE_KEY)).settings.benchMode, 'free', 'remembered');
  assert.equal(text($(w, '#lab-live')), 'Free bench: the next run starts in this mode.');
  assert.equal(w.document.activeElement.dataset.labBenchmode, 'free', 'focus stays on the switch');
  // the card changes the switch too, and the pressed one does nothing
  change(w, $(w, '#lab-bench-mode input[value="practice"]'), true);
  assert.equal($(w, '#lab-mode-switch [aria-pressed="true"]').dataset.labBenchmode, 'practice');
  $(w, '#lab-live').textContent = '';
  $(w, '#lab-mode-switch [data-lab-benchmode="practice"]').click();
  assert.equal(text($(w, '#lab-live')), '', 'nothing to say');
  assert.equal(w.CortexLab.getState().runOrder.length, 0);
  h.close();
});

test('SHELF-2 the mode switch with a run: the other mode starts a new slide in it at once on the same specimen (the old run stays in History), both directions, "New slide: <mode>."; focus stays on the switch', async () => {
  const h = await SHELF();
  const { w } = h;
  const first = startRun(w, { specimen: 'SPEC-SYN-AD-02' });
  $(w, '#lab-do-step').click();
  $(w, '#lab-mode-switch [data-lab-benchmode="free"]').click();
  const state = w.CortexLab.getState();
  assert.equal(state.runOrder.length, 2, 'a new run, the old one kept');
  const free = shelfRun(w);
  assert.equal(free.mode, 'free');
  assert.equal(free.specimenId, 'SPEC-SYN-AD-02');
  assert.equal(free.events.length, 0);
  assert.equal(state.runs[first.id].events.length, 1, 'the old run is untouched');
  assert.equal(text($(w, '#lab-live')), 'New slide: Free bench.');
  assert.equal($(w, '#lab-mode-switch [aria-pressed="true"]').dataset.labBenchmode, 'free');
  assert.equal(w.document.activeElement.dataset.labBenchmode, 'free');
  assert.equal(text($(w, '#lab-do-h')), 'The bench');
  assert.ok(
    [...$(w, '#lab-run-select').options].some(o => o.value === first.id),
    'History keeps the old run'
  );
  assert.equal(state.settings.benchMode, 'free');
  $(w, '#lab-mode-switch [data-lab-benchmode="practice"]').click();
  const practice = shelfRun(w);
  assert.equal(w.CortexLab.getState().runOrder.length, 3);
  assert.equal(practice.mode, 'practice');
  assert.equal(practice.specimenId, 'SPEC-SYN-AD-02');
  assert.equal(text($(w, '#lab-live')), 'New slide: Practice the procedure.');
  assert.equal(text($(w, '#lab-do-step')), 'Do this step: Remove the wax and rehydrate');
  assert.equal(w.CortexLab.getState().settings.benchMode, 'practice');
  h.close();
});

test('SHELF-3 a finished practice run shows "New slide" beside "Run complete" (list: "All steps done"): another practice run on the same specimen', async () => {
  const h = await SHELF();
  const { w } = h;
  const run = startRun(w, { specimen: 'SPEC-SYN-NEG-01' });
  assert.equal($(w, '#lab-new-slide'), null, 'not while steps remain');
  $(w, '#lab-run-all').click();
  const button = $(w, '#lab-do-status #lab-new-slide');
  assert.ok(button, 'in the status row');
  assert.equal(text(button), 'New slide');
  assert.equal(button.previousElementSibling, $(w, '#lab-do-status .lab-do-finished'), 'beside the finished line');
  button.click();
  const next = shelfRun(w);
  assert.notEqual(next.id, run.id);
  assert.equal(next.mode, 'practice');
  assert.equal(next.specimenId, 'SPEC-SYN-NEG-01');
  assert.equal(text($(w, '#lab-live')), 'New slide: Practice the procedure.');
  assert.equal(w.document.activeElement.id, 'lab-do-step');
  h.close();
});

test('SHELF-4 jar rows: the nine procedure jars by their contents (line 2, the engine’s words), "(changed)" once a jar is not the procedure’s; the list and its hints say jar', async () => {
  const h = await SHELF();
  const { w } = h;
  startRun(w, { mode: 'free' });
  const lab = w.LAB.lab;
  const jars = lab.procedureJars();
  const steps = [...lab.getMethod('bielschowsky-modified').steps].sort((a, b) => a.order - b.order);
  const rows = $$(w, '#lab-do li.lab-step');
  assert.deepEqual(
    rows.map(r => [
      r.dataset.labJar,
      r.dataset.labStep,
      text(r.querySelector('.lab-step-title')),
      text(r.querySelector('.lab-step-contents')),
    ]),
    steps.map(s => [s.id, s.id, s.studentTitle, lab.solutionText(jars[s.id])])
  );
  assert.equal($(w, '#lab-do .lab-jar-changed'), null, 'nothing changed yet');
  assert.equal($(w, '#lab-do ol.lab-step-list').getAttribute('aria-label'), 'Jars on the bench');
  assert.match(
    text($(w, '#lab-do .lab-play .lab-hints')),
    /^Drag the slide onto a jar: dip it Click a jar: what it does$/
  );
  // the contents line sits between the title and the state line (H13: the state keeps its own line)
  const main = rows[1].querySelector('.lab-step-main');
  assert.deepEqual(
    [...main.children].map(n => n.className),
    ['lab-step-title', 'lab-step-contents', 'lab-step-line']
  );
  openJar(w, 'silver-impregnation');
  change(w, $(w, '#lab-jar-tempC'), '37');
  const row = jarRow(w, 'silver-impregnation');
  assert.equal(
    text(row.querySelector('.lab-step-contents')),
    `${lab.solutionText({ ...jars['silver-impregnation'], tempC: 37 })} (changed)`
  );
  assert.ok(row.classList.contains('lab-step-changed'));
  assert.equal($$(w, '#lab-do .lab-jar-changed').length, 1, 'only that jar');
  assert.equal(text($(w, '.lab-setup-line')), 'Practice specimen A · high burden · Free bench · 1 jar changed');
  // the Jar select names it by its contents too
  assert.equal(
    [...$(w, '#lab-free-step').options].find(o => o.value === 'silver-impregnation').textContent,
    `${lab.solutionText({ ...jars['silver-impregnation'], tempC: 37 })} (First silver bath)`
  );
  // practice keeps the plain procedure rows
  $(w, '#lab-mode-switch [data-lab-benchmode="practice"]').click();
  assert.equal($(w, '#lab-do li[data-lab-jar]'), null);
  assert.equal($(w, '#lab-do .lab-step-contents'), null);
  assert.equal($(w, '#lab-do ol.lab-step-list').getAttribute('aria-label'), 'Steps in procedure order');
  h.close();
});

test('SHELF-5 the Edit jar form: Bottle grouped Procedure / Pretreatment / Other, one select per field of that bottle (labels above, the procedure’s value marked), a one-value field shown not offered; a new bottle starts at its defaults; Back to the procedure’s contents', async () => {
  const h = await SHELF();
  const { w } = h;
  startRun(w, { mode: 'free' });
  const lab = w.LAB.lab;
  openJar(w, 'silver-impregnation');
  const form = $(w, '#lab-sheet form#lab-jar-edit');
  assert.ok(form, 'the editor sits in the jar’s sheet');
  assert.equal(text($(w, '#lab-jar-h')), 'Edit jar');
  assert.equal(form.getAttribute('aria-labelledby'), 'lab-jar-h');
  assert.ok(
    $(w, '#lab-sheet .lab-jar-box').compareDocumentPosition($(w, '#lab-sheet .lab-sheet-purpose-h')) & 4,
    'first in the sheet'
  );
  assert.equal(text($(w, '#lab-jar-now strong')), lab.solutionText(lab.procedureJars()['silver-impregnation']));
  const bottle = $(w, '#lab-jar-bottle');
  assert.deepEqual(
    [...bottle.querySelectorAll('optgroup')].map(g => g.label),
    ['Procedure', 'Pretreatment', 'Other']
  );
  assert.deepEqual(
    [...bottle.querySelectorAll('optgroup')].map(g => [...g.children].map(o => o.value)),
    ['procedure', 'pretreatment', 'other'].map(group =>
      plain(lab.listReagents())
        .filter(r => r.group === group)
        .map(r => r.id)
    )
  );
  assert.equal(bottle.selectedOptions[0].textContent, 'Silver nitrate (procedure)');
  assert.equal(text(bottle.closest('label').querySelector('span')), 'Bottle', 'the label above');
  const fields = () =>
    $$(w, '#lab-jar-edit select[data-lab-jar-field]').map(s => [s.id, text(s.closest('label').querySelector('span'))]);
  assert.deepEqual(fields(), [
    ['lab-jar-strength', 'Strength'],
    ['lab-jar-minutes', 'Time'],
    ['lab-jar-tempC', 'Temperature'],
    ['lab-jar-dark', 'Light'],
    ['lab-jar-fresh', 'Freshness'],
  ]);
  assert.deepEqual(optionTexts($(w, '#lab-jar-tempC')), ['5 °C', 'room temperature (procedure)', '37 °C', '60 °C']);
  assert.deepEqual(optionTexts($(w, '#lab-jar-strength')), ['10%', '20% (procedure)']);
  assert.equal($(w, '#lab-jar-reset'), null, 'nothing to go back to yet');
  assert.equal($(w, '#lab-jar-remove'), null, 'a procedure jar stays');
  // a field: saved at once, the sheet stays on the jar with focus on that field
  change(w, $(w, '#lab-jar-minutes'), '30');
  assert.equal(w.document.activeElement.id, 'lab-jar-minutes');
  assert.equal(w.CortexLab.getState().freeJars.jars['silver-impregnation'].minutes, 30);
  assert.match(text($(w, '#lab-live')), /^First silver bath now holds 20% silver nitrate · 30 min/);
  assert.equal(text($(w, '#lab-jar-now .lab-jar-changed')), '(changed)');
  // a new bottle starts at its own defaults (the developer's fields)
  change(w, $(w, '#lab-jar-bottle'), 'developer');
  const dev = lab.getReagent('developer');
  const defaults = Object.fromEntries(Object.entries(dev.fields).map(([f, d]) => [f, d.default]));
  assert.deepEqual(
    plain(w.CortexLab.getState().freeJars.jars['silver-impregnation']),
    plain({ reagent: 'developer', ...defaults })
  );
  assert.deepEqual(
    fields().map(f => f[0]),
    Object.keys(dev.fields).map(f => `lab-jar-${f}`)
  );
  assert.equal(w.document.activeElement.id, 'lab-jar-bottle');
  // the developer's own procedure value is still "(procedure)" (its bottle's default)
  assert.deepEqual(optionTexts($(w, '#lab-jar-into')), [
    'added to the ammoniacal silver jar (procedure)',
    'in a fresh jar with no silver',
  ]);
  // the procedure's bottle back in its own jar: the procedure's contents, not changed
  change(w, $(w, '#lab-jar-bottle'), 'silver-nitrate');
  assert.equal(jarRow(w, 'silver-impregnation').querySelector('.lab-jar-changed'), null);
  change(w, $(w, '#lab-jar-dark'), 'false');
  assert.equal(w.CortexLab.getState().freeJars.jars['silver-impregnation'].dark, false, 'a boolean stays a boolean');
  $(w, '#lab-jar-reset').click();
  assert.deepEqual(
    plain(w.CortexLab.getState().freeJars.jars['silver-impregnation']),
    plain(lab.procedureJars()['silver-impregnation'])
  );
  assert.equal($(w, '#lab-jar-reset'), null);
  assert.equal(w.document.activeElement.id, 'lab-jar-bottle');
  // a bottle with one value per field: shown, not offered
  change(w, $(w, '#lab-jar-bottle'), 'permanganate');
  assert.equal($(w, '#lab-jar-minutes'), null);
  const fixed = $(w, '#lab-jar-edit .lab-jar-fixed[data-lab-jar-field="minutes"]');
  assert.equal(text(fixed.querySelector('span')), 'Time');
  assert.equal(text(fixed.querySelector('p')), '2 min (procedure)', 'the course procedure’s pretreatment time');
  h.close();
});

test('SHELF-6 Add a jar (up to four: x1..x4, potassium permanganate, its editor open with focus on the bottle) and Remove jar (focus back on Add a jar; the place is free again); every jar’s editor has a keyboard path', async () => {
  const h = await SHELF();
  const { w } = h;
  startRun(w, { mode: 'free' });
  const lab = w.LAB.lab;
  const add = () => $(w, '#lab-add-jar');
  assert.equal(text(add()), 'Add a jar');
  assert.ok($(w, '#lab-do ol.lab-step-list').compareDocumentPosition(add()) & 4, 'under the list');
  add().click();
  assert.deepEqual(Array.from(w.CortexLab.getState().freeJars.extra.map(x => x.id)), ['x1']);
  assert.equal(w.CortexLab.getState().freeJars.extra[0].solution.reagent, 'permanganate');
  assert.equal(text($(w, '#lab-sheet-h')), 'Your jar 1');
  assert.equal(w.document.activeElement.id, 'lab-jar-bottle', 'the editor, on the bottle');
  assert.equal(text($(w, '#lab-jar-remove')), 'Remove jar');
  assert.equal($(w, '#lab-jar-reset'), null);
  assert.match(text($(w, '#lab-live')), /^Your jar 1 added: /);
  const row = jarRow(w, 'x1');
  assert.ok(row.classList.contains('lab-step-extra'));
  assert.equal(row.dataset.labStep, undefined, 'an extra jar runs no step');
  assert.equal(text(row.querySelector('.lab-step-title')), 'Your jar 1');
  assert.equal(
    text(row.querySelector('.lab-step-contents')),
    lab.solutionText({ reagent: 'permanganate', minutes: 2 })
  );
  assert.ok(row.classList.contains('lab-step-viewing'), 'its row is the one the sheet explains');
  for (let i = 0; i < 3; i++) add().click();
  assert.deepEqual(
    $$(w, '#lab-do li.lab-step-extra').map(r => r.dataset.labJar),
    ['x1', 'x2', 'x3', 'x4']
  );
  assert.equal(add().disabled, true, 'four is the most');
  assert.equal(add().getAttribute('aria-describedby'), 'lab-add-jar-full');
  assert.match(text($(w, '#lab-add-jar-full')), /Remove jar, in a jar’s sheet, frees a place/);
  add().click();
  assert.equal(w.CortexLab.getState().freeJars.extra.length, 4);
  // remove the second
  openJar(w, 'x2');
  $(w, '#lab-jar-remove').click();
  assert.deepEqual(
    $$(w, '#lab-do li.lab-step-extra').map(r => r.dataset.labJar),
    ['x1', 'x3', 'x4']
  );
  assert.equal($(w, '#lab-sheet').hidden, true, 'its sheet closed');
  assert.equal(w.document.activeElement.id, 'lab-add-jar');
  assert.equal(text($(w, '#lab-live')), 'Your jar 2 removed.');
  add().click();
  assert.equal(text($(w, '#lab-sheet-h')), 'Your jar 2', 'the free place is used again');
  // the keyboard's way to an extra jar's editor: the Jar select and Explain a step, and the sheet's own select
  press(w, $(w, '#lab-sheet-h'), 'Escape');
  change(w, $(w, '#lab-free-step'), 'x3');
  $(w, '#lab-explain-open').click();
  assert.equal(text($(w, '#lab-sheet-h')), 'Your jar 3');
  assert.ok($(w, '#lab-sheet #lab-jar-edit'));
  const pick = $(w, '#lab-sheet-step');
  assert.equal(text(pick.closest('label').querySelector('span')), 'Explain another jar');
  assert.deepEqual(
    [...pick.options].slice(-4).map(o => [o.value, o.textContent]),
    [
      ['x1', 'Your jar 1'],
      ['x2', 'Your jar 2'],
      ['x3', 'Your jar 3'],
      ['x4', 'Your jar 4'],
    ]
  );
  change(w, pick, 'development');
  assert.equal(text($(w, '#lab-sheet-h')), 'Develop the silver');
  assert.ok($(w, '#lab-sheet #lab-jar-edit'), 'a procedure jar’s editor too');
  change(w, $(w, '#lab-sheet-step'), 'x1');
  assert.equal(text($(w, '#lab-sheet-h')), 'Your jar 1');
  assert.equal(w.document.activeElement.id, 'lab-sheet-step');
  h.close();
});

test('SHELF-7 Reset every jar: shown once a jar differs from the procedure; the nine jars get the procedure’s contents back and the extra jars go (Your hands keep theirs)', async () => {
  const h = await SHELF();
  const { w } = h;
  startRun(w, { mode: 'free' });
  const lab = w.LAB.lab;
  assert.equal($(w, '#lab-jars-reset'), null, 'nothing to reset');
  openJar(w, 'development');
  change(w, $(w, '#lab-jar-drops'), '9');
  press(w, $(w, '#lab-sheet-h'), 'Escape');
  $(w, '#lab-add-jar').click();
  change(w, $(w, '#lab-jar-bottle'), 'tap-water');
  press(w, $(w, '#lab-sheet-h'), 'Escape');
  change(w, $(w, '#lab-hand-forceps-metal'), true);
  assert.equal(
    text($(w, '.lab-setup-line')),
    'Practice specimen A · high burden · Free bench · 1 jar changed · 1 extra jar'
  );
  const reset = $(w, '#lab-jars-reset');
  assert.equal(text(reset), 'Reset every jar');
  reset.click();
  const saved = w.CortexLab.getState().freeJars;
  assert.deepEqual(plain(saved.jars), plain(lab.procedureJars()));
  assert.deepEqual(Array.from(saved.extra), []);
  assert.equal(saved.handling.forceps, 'metal', 'the hands are not jars');
  assert.equal($(w, '#lab-jars-reset'), null);
  assert.equal($(w, '#lab-do li.lab-step-extra'), null);
  assert.equal(text($(w, '#lab-live')), 'Every jar holds the procedure’s contents again; no extra jar is left.');
  assert.equal(w.document.activeElement.id, 'lab-add-jar');
  h.close();
});

test('SHELF-8 the jars persist in LAB_STATE.freeJars (saved through StudyStorage, kept across a reload); an older save without them, and a damaged one, merge to the procedure’s jars', async () => {
  const h = await SHELF();
  const { w } = h;
  startRun(w, { mode: 'free' });
  openJar(w, 'water-wash');
  change(w, $(w, '#lab-jar-minutes'), '10');
  $(w, '#lab-add-jar').click();
  change(w, $(w, '#lab-jar-bottle'), 'formic-acid');
  const stored = JSON.parse(h.store.get(STATE_KEY)).freeJars;
  assert.equal(stored.jars['water-wash'].minutes, 10);
  assert.deepEqual(stored.extra, [{ id: 'x1', solution: { reagent: 'formic-acid', minutes: 5 } }]);
  const store = h.store;
  h.close();
  const again = harness({ url: 'http://localhost/lab?view=bench', store });
  await again.w.renderLabEntry();
  assert.match(text(jarRow(again.w, 'water-wash').querySelector('.lab-step-contents')), /10 min \(changed\)$/);
  assert.equal(text(jarRow(again.w, 'x1').querySelector('.lab-step-title')), 'Your jar 1');
  again.close();
  // an older save (no freeJars) reads the procedure's jars
  const old = harness({
    url: 'http://localhost/lab?view=bench',
    store: new Map([[STATE_KEY, JSON.stringify({ v: 1, runs: {}, runOrder: [], settings: { hints: true } })]]),
  });
  await old.w.renderLabEntry();
  assert.equal(old.w.CortexLab.getState().freeJars, null);
  const merged = old.run('labFreeJars(LAB.lab)');
  assert.deepEqual(plain(merged.jars), plain(old.w.LAB.lab.procedureJars()));
  assert.deepEqual(plain(merged.extra), []);
  assert.deepEqual(plain(merged.handling), {
    forceps: 'plastic',
    glass: 'acid-cleaned',
    between: 'kept-wet',
    fill: 'full',
  });
  old.close();
  // a damaged one: an unknown bottle, a value the bottle does not offer, a stray id, a fifth extra jar
  const damaged = harness({
    url: 'http://localhost/lab?view=bench',
    store: new Map([
      [
        STATE_KEY,
        JSON.stringify({
          v: 1,
          runs: {},
          runOrder: [],
          freeJars: {
            jars: {
              'water-wash': { reagent: 'vinegar' },
              development: { reagent: 'developer', drops: 7, minutes: 10 },
            },
            extra: [
              { id: 'x9', solution: { reagent: 'tap-water' } },
              { id: 'x2', solution: { reagent: 'tap-water', minutes: 10 } },
              { id: 'x2', solution: { reagent: 'formic-acid' } },
              { id: 'x1', solution: { reagent: 'nothing' } },
            ],
            handling: { forceps: 'gold', fill: 'half' },
          },
        }),
      ],
    ]),
  });
  await damaged.w.renderLabEntry();
  const d = damaged.run('labFreeJars(LAB.lab)');
  const proc = plain(damaged.w.LAB.lab.procedureJars());
  assert.deepEqual(plain(d.jars['water-wash']), proc['water-wash'], 'an unknown bottle: the procedure’s');
  assert.deepEqual(plain(d.jars.development), { ...proc.development, minutes: 10 }, 'a value not offered: the default');
  assert.deepEqual(plain(d.extra), [{ id: 'x2', solution: { reagent: 'tap-water', minutes: 10 } }]);
  assert.deepEqual(plain(d.handling), { forceps: 'plastic', glass: 'acid-cleaned', between: 'kept-wet', fill: 'half' });
  damaged.close();
});

test('SHELF-9 Your hands: four small segmented controls (a named radio group each, the procedure’s choice first and marked); a change is saved, announced and carried by the next dip', async () => {
  const h = await SHELF();
  const { w } = h;
  startRun(w, { mode: 'free' });
  const hands = $(w, 'fieldset#lab-hands');
  assert.equal(text(hands.querySelector('legend')), 'Your hands');
  const groups = $$(w, '#lab-hands [role="radiogroup"]');
  assert.deepEqual(
    groups.map(g => [
      text(w.document.getElementById(g.getAttribute('aria-labelledby'))),
      [...g.querySelectorAll('input')].map(i => [i.value, i.checked, text(i.closest('label'))]),
    ]),
    plain(w.LAB.lab.handlingChoices()).map(c => [
      c.label,
      [...c.values]
        .sort((a, b) => (a.id === c.default ? -1 : b.id === c.default ? 1 : 0))
        .map(v => [v.id, v.id === c.default, v.words]),
    ])
  );
  assert.ok(
    groups.every(
      g =>
        g.querySelector('input').value ===
        w.LAB.lab
          .handlingChoices()
          .find(c => text(w.document.getElementById(g.getAttribute('aria-labelledby'))) === c.label).default
    ),
    'the procedure’s first'
  );
  assert.ok($$(w, '#lab-hands .lab-proc').every(n => text(n) === '(procedure)'));
  assert.equal($$(w, '#lab-hands .lab-proc').length, 4);
  const metal = $(w, '#lab-hand-forceps-metal');
  metal.focus();
  change(w, metal, true);
  assert.equal(w.CortexLab.getState().freeJars.handling.forceps, 'metal');
  assert.equal(JSON.parse(h.store.get(STATE_KEY)).freeJars.handling.forceps, 'metal');
  assert.equal(text($(w, '#lab-live')), 'Forceps: metal forceps. It applies from the next dip on.');
  assert.equal(w.document.activeElement, metal, 'no redraw: focus stays');
  change(w, $(w, '#lab-free-step'), 'silver-impregnation');
  $(w, '#lab-free-dip').click();
  const dip = shelfRun(w).events.at(-1);
  assert.deepEqual(plain(dip.handling), { forceps: 'metal', glass: 'acid-cleaned', between: 'kept-wet', fill: 'full' });
  // History's log line names the hand that is not the procedure's
  assert.match(w.labEventText(dip), /^First silver bath: 20% silver nitrate .* \(Forceps: metal forceps\)$/);
  const store = h.store;
  h.close();
  const again = harness({ url: 'http://localhost/lab?view=bench', store });
  await again.w.renderLabEntry();
  assert.equal($(again.w, '#lab-hand-forceps-metal').checked, true, 'kept across a reload');
  again.close();
});

test('SHELF-10 every free dip is one dip event { type, jarId, solution, handling } with the jar’s contents now: the Dip button and a slide dropped on a row (an extra jar too)', async () => {
  const h = await SHELF();
  const { w } = h;
  startRun(w, { mode: 'free' });
  openJar(w, 'silver-impregnation');
  change(w, $(w, '#lab-jar-tempC'), '37');
  press(w, $(w, '#lab-sheet-h'), 'Escape');
  change(w, $(w, '#lab-free-step'), 'silver-impregnation');
  $(w, '#lab-free-dip').click();
  const procedureHands = { forceps: 'plastic', glass: 'acid-cleaned', between: 'kept-wet', fill: 'full' };
  let ev = plain(shelfRun(w).events.at(-1));
  assert.deepEqual(ev, {
    seq: 1,
    type: 'dip',
    jarId: 'silver-impregnation',
    solution: { ...plain(w.LAB.lab.procedureJars()['silver-impregnation']), tempC: 37 },
    handling: procedureHands,
  });
  assert.equal(w.document.activeElement.id, 'lab-free-dip');
  // a drop on an extra jar's row
  $(w, '#lab-add-jar').click();
  change(w, $(w, '#lab-jar-bottle'), 'tap-water');
  press(w, $(w, '#lab-sheet-h'), 'Escape');
  dragSlide(w, jarRow(w, 'x1'));
  ev = plain(shelfRun(w).events.at(-1));
  assert.deepEqual(ev, {
    seq: 2,
    type: 'dip',
    jarId: 'x1',
    solution: { reagent: 'tap-water', minutes: 3 },
    handling: procedureHands,
  });
  assert.equal(text(jarRow(w, 'x1').querySelector('.lab-step-state')), '✓ done');
  // and a drop on a procedure jar's row
  dragSlide(w, jarRow(w, 'water-wash'));
  assert.deepEqual(plain(shelfRun(w).events.at(-1).solution), plain(w.LAB.lab.procedureJars()['water-wash']));
  assert.equal(shelfRun(w).events.filter(e => e.type === 'step').length, 0, 'no step event on the free bench');
  h.close();
});

test('SHELF-11 "Currently unknown reaction" in the log (the chip with a "?" mark, the neutral tone, Why: the reason and the real lab), "Partly unknown" with its sentences under the known text; the row and the live region say the reaction; Slide now lists both', async () => {
  const h = await SHELF();
  const { w } = h;
  startRun(w, { mode: 'free' });
  const lab = w.LAB.lab;
  // partly unknown: 37 °C silver nitrate
  openJar(w, 'silver-impregnation');
  change(w, $(w, '#lab-jar-tempC'), '37');
  press(w, $(w, '#lab-sheet-h'), 'Escape');
  change(w, $(w, '#lab-free-step'), 'silver-impregnation');
  $(w, '#lab-free-dip').click();
  const partly = shelfRun(w).reactions.at(-1);
  assert.equal(partly.kind, 'reaction');
  assert.ok(partly.unknown.length >= 1);
  const sentence = partly.unknown[0].text;
  assert.match(sentence, /^Currently unknown: /);
  let item = $(w, '#lab-reactions > li.lab-reaction-latest');
  assert.equal(item.dataset.labReactionKind, 'reaction');
  assert.ok(item.hasAttribute('data-lab-reaction-partly'));
  assert.equal(chipWords(item.querySelector('.lab-reaction-chip')), 'Partly unknown');
  assert.equal(item.querySelector('.lab-reaction-chip').dataset.labChip, 'partly');
  assert.equal(
    text(item.querySelector('.lab-reaction-text')),
    partly.text.replace(sentence, '').replace(/\s+/g, ' ').trim()
  );
  assert.deepEqual($$(w, '#lab-reactions > li.lab-reaction-latest .lab-reaction-unknown > li').map(text), [sentence]);
  assert.equal(text(item.querySelector('.lab-reaction-jar')), lab.solutionText(shelfRun(w).events.at(-1).solution));
  assert.equal(text($(w, '#lab-live')), `First silver bath: ${partly.text}`);
  // currently unknown: tap water in an extra jar
  $(w, '#lab-add-jar').click();
  change(w, $(w, '#lab-jar-bottle'), 'tap-water');
  press(w, $(w, '#lab-sheet-h'), 'Escape');
  change(w, $(w, '#lab-free-step'), 'x1');
  $(w, '#lab-free-dip').click();
  const unknown = shelfRun(w).reactions.at(-1);
  assert.equal(unknown.kind, 'unknown');
  item = $(w, '#lab-reactions > li.lab-reaction-latest');
  assert.equal(item.dataset.labReactionKind, 'unknown');
  assert.equal(item.dataset.labReaction, 'unknown');
  assert.equal(text(item.querySelector('.lab-reaction-step')), 'Your jar 1');
  const chip = item.querySelector('.lab-reaction-chip');
  assert.equal(chip.dataset.labChip, 'unknown');
  assert.equal(chipWords(chip), 'Currently unknown reaction');
  assert.equal(chip.querySelector('.lab-unknown-mark').textContent, '?');
  assert.equal(chip.querySelector('.lab-unknown-mark').getAttribute('aria-hidden'), 'true');
  assert.equal(text(item.querySelector('.lab-reaction-text')), unknown.text);
  assert.match(unknown.text, /^Currently unknown reaction: /);
  assert.equal(item.querySelector('.lab-reaction-unknown'), null);
  assert.equal(item.querySelector('.lab-drawer-btn').getAttribute('aria-label'), 'Why? Your jar 1');
  item.querySelector('.lab-drawer-btn').click();
  const why = text(item.querySelector('.lab-reaction-why'));
  assert.ok(why.startsWith(lab.getReagent('tap-water').unknownWhy), why);
  assert.match(why, /The real lab is how to find out\.$/);
  assert.equal(item.querySelector('.lab-chip-rule'), null, 'no rule to cite');
  assert.equal(text(jarRow(w, 'x1').querySelector('.lab-step-note')), unknown.text, 'on the row');
  assert.equal(text($(w, '#lab-live')), `Your jar 1: ${unknown.text}`);
  assert.doesNotMatch(text($(w, '#lab-reactions')), /\berror\b|invalid|not allowed/i, '§13.6');
  // the house's neutral tone: no red, a "?" mark
  const css = read('lab.css');
  const rule = css.match(/\.lab-reaction-chip \{[^}]*\}/)[0];
  assert.doesNotMatch(rule, /--red|--amber/);
  // Slide now: the dip left out of the drawing, the partly unknown field
  const box = $(w, '#lab-slide-now #lab-slide-unknown');
  assert.equal(
    chipWords(box.querySelector('.lab-slide-unknown-head')),
    'Currently unknown: 1 dip, left out of the drawing'
  );
  assert.deepEqual($$(w, '#lab-slide-unknown .lab-slide-unknown-dips > li').map(text), [
    `Your jar 1: ${lab.solutionText({ reagent: 'tap-water', minutes: 3 })}`,
  ]);
  assert.deepEqual($$(w, '#lab-slide-unknown .lab-slide-partly > li').map(text), [
    `Partly unknown (First silver bath): ${sentence.replace(/^Currently unknown: /, '')}`,
  ]);
  // two unknown dips: the count says so
  $(w, '#lab-free-dip').click();
  assert.equal(
    chipWords($(w, '#lab-slide-unknown .lab-slide-unknown-head')),
    'Currently unknown: 2 dips, left out of the drawing'
  );
  h.close();
});

test('SHELF-12 the bench api: extraJars (free bench only), jarLabel (an extra jar always, a procedure jar once changed), dropHint("jar:x1"), the S9 "Your jars" station button only while extra jars exist, a tray jar’s click (its sheet) and double click (a dip), a procedure jar’s double click is a dip; refreshJars after a redraw', async () => {
  const fake = fakeBench();
  let refreshed = 0;
  fake.handle.refreshJars = () => ++refreshed;
  const h = await SHELF('http://localhost/lab?view=bench', { benchModule: fake.module, webgl2: true });
  const { w } = h;
  startRun(w, { mode: 'free' });
  $(w, '#lab-mode-toggle').click();
  assert.ok(await mounted3d(h, fake));
  const api = fake.api();
  const stations = () => $$(w, '#lab-stations .lab-station-btn').map(b => b.dataset.labStation);
  assert.deepEqual(Array.from(api.extraJars()), []);
  assert.equal(stations().includes('S9'), false, 'no Your jars without extra jars');
  assert.equal(api.jarLabel('silver-impregnation'), null, 'an unchanged jar says nothing more');
  assert.equal(api.dropHint('jar:x1'), 'That jar is not on this bench');
  assert.equal(api.dropHint('jar:silver-impregnation'), '', 'a procedure jar by its jar name');
  // a jar added in 3D (under the stage's row): the tray, the S9 button, the label
  const before = refreshed;
  $(w, '#lab-add-jar').click();
  assert.ok(refreshed > before, 'the bench re-reads its jars');
  change(w, $(w, '#lab-jar-bottle'), 'tap-water');
  const tap = w.LAB.lab.solutionText({ reagent: 'tap-water', minutes: 3 });
  assert.deepEqual(plain(api.extraJars()), [{ id: 'x1', label: tap, title: 'Your jar 1' }]);
  assert.equal(api.jarLabel('x1'), tap);
  assert.equal(api.jarLabel('jar:x1'), tap);
  assert.equal(api.dropHint('jar:x1'), '');
  assert.equal(api.stepState('jar:x1'), 'todo');
  assert.ok(stations().includes('S9'));
  assert.equal(text($(w, '#lab-stations [data-lab-station="S9"]')), 'Your jars');
  press(w, $(w, '#lab-sheet-h'), 'Escape');
  // a tray jar: click = its sheet (after the jar wait), double click = a dip in it
  api.onInspect({ kind: 'jar', id: 'x1' });
  await sheetDelay();
  assert.equal(text($(w, '#lab-sheet-h')), 'Your jar 1');
  assert.ok($(w, '#lab-sheet #lab-jar-edit'));
  assert.match(text($(w, '#lab-sheet .lab-sheet-hints')), /drop the slide: dip/);
  press(w, $(w, '#lab-sheet-h'), 'Escape');
  api.onEvent({ type: 'jar', jarId: 'x1' });
  const run = shelfRun(w);
  assert.deepEqual(
    [run.events.at(-1).type, run.events.at(-1).jarId, run.events.at(-1).solution.reagent],
    ['dip', 'x1', 'tap-water']
  );
  assert.equal(text($(w, '#lab-stage-hint')), run.reactions.at(-1).text, 'the stage says the reaction');
  assert.ok(
    fake.calls.some(c => c[0] === 'goToStation' && c[1] === 'S9'),
    'the camera follows to Your jars'
  );
  assert.equal(api.stepState('x1'), 'done');
  assert.equal(api.stepCount('x1'), 1);
  // a procedure jar's double click on the free bench is a dip with what is in it
  api.onEvent({ type: 'step', step: 'water-wash' });
  assert.deepEqual(plain(shelfRun(w).events.at(-1)), {
    seq: 2,
    type: 'dip',
    jarId: 'water-wash',
    solution: plain(w.LAB.lab.procedureJars()['water-wash']),
    handling: { forceps: 'plastic', glass: 'acid-cleaned', between: 'kept-wet', fill: 'full' },
  });
  // a changed procedure jar labels its tag
  api.onInspect('silver-impregnation');
  await sheetDelay();
  change(w, $(w, '#lab-jar-strength'), '10');
  assert.equal(
    api.jarLabel('silver-impregnation'),
    w.LAB.lab.solutionText({ ...w.LAB.lab.procedureJars()['silver-impregnation'], strength: 10 })
  );
  // practice: no tray, no S9, no labels; a dip on a tray jar is refused
  $(w, '#lab-mode-switch [data-lab-benchmode="practice"]').click();
  assert.deepEqual(Array.from(api.extraJars()), []);
  assert.equal(stations().includes('S9'), false);
  assert.equal(api.jarLabel('x1'), null);
  assert.equal(api.jarLabel('silver-impregnation'), null);
  assert.equal(api.dropHint('jar:x1'), 'That jar is not on this bench');
  const events = shelfRun(w).events.length;
  api.onEvent({ type: 'jar', jarId: 'x1' });
  assert.equal(shelfRun(w).events.length, events, 'nothing recorded');
  await flush();
  h.close();
});

test('3D is the default bench: a fresh visitor and an older save open in 3D, a chosen list stays, no WebGL2 falls back to list', async () => {
  const fresh = harness({ url: 'http://localhost/lab?view=bench', startMode: null, webgl2: true });
  assert.equal(fresh.run('labCurrentMode()'), '3d', 'fresh visitor');
  assert.equal(fresh.run('LAB_STATE.modeChosen'), false);
  fresh.close();
  const older = new Map([[STATE_KEY, JSON.stringify({ v: 1, mode: 'list', runs: {}, runOrder: [] })]]);
  const old = harness({ store: older, startMode: null, webgl2: true });
  assert.equal(old.run('LAB_STATE.mode'), '3d', 'an older save with no choice opens in 3D');
  old.close();
  const chosen = harness({ webgl2: true });
  assert.equal(chosen.run('labCurrentMode()'), 'list', 'a chosen list stays');
  chosen.close();
  const noGl = harness({ startMode: null, webgl2: false });
  assert.equal(noGl.run('labCurrentMode()'), 'list', 'no WebGL2: list');
  noGl.close();
});
