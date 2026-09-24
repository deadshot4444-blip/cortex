// The DAT timed drill runner (dat-practice.js, DAT-03) in jsdom, over the real merged bank:
// option keys rendered one per option with the count taken from the outline's option policy
// (never a literal A-E), the periodic-table control on an SNS drill and nowhere else, the pace
// bar and the exam clock built from the outline's pacing seconds, the cs-dat-log / cs-dat-q /
// cs-dat-srs writes, resume after a simulated reload, the review page's arithmetic, and the
// cross-module keyboard guard with mcat.js's keydown handler loaded in the same document.
//
// It also covers what only shows up when BOTH DAT runners live in one document (the shell loads
// them together): the single attempt cache on the DAT object that keeps dat-practice.js and
// dat-pat.js from overwriting each other's rows, the reset hooks resetDatState calls, the PAT
// review's "Another set", the re-indexed drill resume, and the landing's generator count.
//
// Harness style: scripts/test-dat-shell.cjs (jsdom + the shared el/esc/setView/topbar stubs),
// which itself follows scripts/test-mcat-navigation.cjs and scripts/test-academy-today.cjs.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { outline, questions } = require('./dat-data.cjs');

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const SNS_OPTIONS = outline.optionPolicy.sns.options;
const PACE = outline.pacingSeconds;
const PERIODIC_SECTIONS = outline.tools.periodicTable.sections;
const SOURCES = ['dat-drill-engine.js', 'dat-practice.js'];
// SECTION_SCRIPTS.dat (app.js) loads these four into one document, so `pat: true` reproduces the
// real page for the tests that need both runners at once.
const PAT_SOURCES = ['dat-pat-engine.js', 'dat-pat.js'];

// Every window this file opens, closed at the end so no drill ticker outlives the run.
const OPEN = [];
after(() => {
  for (const w of OPEN.splice(0))
    try {
      w.close();
    } catch {
      /* already closed by the test that opened it */
    }
});

// `store` is shared across harnesses to simulate a reload: the same browser, a fresh page.
function harness({ url = 'http://localhost/dat', store = new Map(), mcat = false, pat = false } = {}) {
  const dom = new JSDOM('<!doctype html><div id="app"></div>', { url, runScripts: 'outside-only' });
  OPEN.push(dom.window);
  const w = dom.window,
    context = dom.getInternalVMContext();
  const writes = [];
  // Every StudyStorage.watch registration, so a test can call the accessor the way the real
  // StudyStorage does when it checks a key for a conflict.
  const watchers = [];
  Object.assign(w, {
    IS_LOCAL_PREVIEW: true,
    LETTERS: [...LETTERS],
    sectionUrl: id => '/' + id,
    stopTimer() {},
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
      watch(key, current) {
        watchers.push({ key, current });
        return { save: value => this.write(key, value) };
      },
      write(key, value) {
        writes.push(key);
        store.set(key, JSON.stringify(value));
        return true;
      },
      remove(key) {
        store.delete(key);
        return true;
      },
    },
    fetch: async file => {
      const name = file.replace(/^data\//, '').split('?')[0];
      if (!fs.existsSync('data/' + name)) return { ok: false };
      return { ok: true, json: async () => JSON.parse(fs.readFileSync('data/' + name, 'utf8')) };
    },
  });
  for (const file of ['academy.js', 'dat.js', ...SOURCES, ...(pat ? PAT_SOURCES : [])])
    vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  if (mcat) vm.runInContext(fs.readFileSync('mcat.js', 'utf8'), context);
  const find = selector => w.document.querySelector(selector);
  const all = selector => [...w.document.querySelectorAll(selector)];
  return {
    w,
    store,
    writes,
    watchers,
    find,
    all,
    run: code => vm.runInContext(code, context),
    text: selector => find(selector)?.textContent.trim(),
    texts: selector => all(selector).map(n => n.textContent.trim()),
    saved: key => (store.has(key) ? JSON.parse(store.get(key)) : null),
    key(value) {
      w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
    },
    // The rendered item, resolved from the stem so no test depends on which item the deal drew.
    item() {
      const stem = find('.dat-stem').textContent;
      const item = questions.find(q => q.stem === stem);
      assert.ok(item, 'the rendered stem belongs to a bank item');
      return item;
    },
    go(query) {
      w.history.replaceState({}, '', '/dat' + (query ? '?' + query : ''));
      return w.renderDATEntry();
    },
    close: () => w.close(),
  };
}
// Answers the visible item; `how` is 'correct' or 'wrong'.
function answer(h, how = 'correct') {
  const item = h.item();
  const target = h
    .all('.dat-opt')
    .find(b => (how === 'correct' ? +b.dataset.datI === item.answer : +b.dataset.datI !== item.answer));
  target.click();
  return item;
}
// Answers the visible PAT item and continues. The key comes from DatPatCore.fromId over the id in
// the resume blob, so the test never has to guess which option the generator keyed.
function patAnswer(h, how = 'wrong') {
  const blob = h.saved('cs-dat-r-pat');
  assert.ok(blob, 'the PAT set writes its resume blob before the first answer');
  const id = blob.ids[blob.idx];
  const key = h.run(`window.DatPatCore.fromId(${JSON.stringify(id)}).answer`);
  const count = h.all('.dat-pat-opt').length;
  h.find('#dat-pat-opt-' + (how === 'correct' ? key : (key + 1) % count)).click();
  h.find('#dat-pat-next').click();
  return id;
}
// A StudyStorage.watch accessor returns objects built inside the jsdom realm, whose prototypes are
// not this realm's; the round trip compares the values the way StudyStorage would serialise them.
function live(accessor) {
  return JSON.parse(JSON.stringify(accessor()));
}

test('the runner registers itself the way the shell expects', () => {
  const h = harness();
  assert.equal(h.run('typeof DatDrillCore'), 'object', 'the engine is a global for the UI and the Node tests');
  assert.deepEqual(Object.keys(h.run('window.DatPractice')).sort(), ['mistakes', 'pause', 'render', 'reset']);
  assert.equal(h.run('DAT.pausers.length'), 1, 'the drill clock is registered with the shell pauser');
  h.close();
});

test('one option key per option, counted from the outline policy and never from a literal A-E', async () => {
  const h = harness();
  await h.go('view=drill&section=bio&n=1&mode=untimed');
  const item = h.item();
  const keys = h.texts('.dat-opt .key');

  assert.equal(item.options.length, SNS_OPTIONS, 'the seed item carries the policy option count');
  assert.equal(h.all('.dat-opt').length, item.options.length, 'one button per authored option');
  assert.deepEqual(keys, LETTERS.slice(0, SNS_OPTIONS), 'keys run A..LETTERS[optionPolicy.sns.options - 1]');
  assert.deepEqual(
    h.texts('.dat-opt span:not(.key)').sort(),
    [...item.options].sort(),
    'every authored option is rendered exactly once'
  );
  // Each button carries the authored index, so a shuffled display still scores the right answer.
  assert.deepEqual(
    h
      .all('.dat-opt')
      .map(b => +b.dataset.datI)
      .sort((a, b) => a - b),
    item.options.map((_, i) => i)
  );
  h.close();
});

test('a four-option quantitative-comparison item renders four keys in canonical order', async () => {
  // Proves the runner counts options per item: an SNS drill shows five keys, this one shows four.
  const h = harness();
  await h.go('view=drill&section=qr&category=QR-3&n=1&mode=untimed');
  const item = h.item();
  assert.equal(item.format, 'qc');
  assert.equal(outline.optionPolicy.qc.options, 4);
  assert.notEqual(outline.optionPolicy.qc.options, SNS_OPTIONS, 'the two policies really differ');
  assert.deepEqual(h.texts('.dat-opt .key'), LETTERS.slice(0, outline.optionPolicy.qc.options));
  assert.deepEqual(
    h.texts('.dat-opt span:not(.key)'),
    outline.optionPolicy.qc.canonical,
    'qc options are never shuffled out of their canonical order'
  );
  assert.deepEqual(
    h.all('.dat-opt').map(b => +b.dataset.datI),
    [0, 1, 2, 3],
    'display position equals authored index for qc'
  );
  assert.equal(h.all('.dat-qc-col').length, 2, 'the two quantities are laid out side by side');
  h.close();
});

test('neither DAT module pins an option count or an A-E letter run of its own', () => {
  for (const file of SOURCES) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /'ABCD/, file + ' has no ABCD literal (DESIGN §2c)');
    assert.doesNotMatch(source, /\[\s*'A'\s*,\s*'B'\s*,/, file + ' builds no letter array of its own');
    assert.doesNotMatch(source, /a-eA-E|\[1-5\]/, file + ' hard-codes no five-option key range');
  }
  assert.match(fs.readFileSync('dat-practice.js', 'utf8'), /Core\.letters\(/, 'letters come from the engine');
});

test('the periodic table is offered on an SNS drill, opens, closes, and is absent where the outline forbids it', async () => {
  const h = harness();
  h.w.confirm = () => true; // Explicitly replace each unfinished fixture while checking its section's tools.
  for (const section of PERIODIC_SECTIONS) {
    await h.go(`view=drill&section=${section}&n=1&mode=untimed`);
    assert.ok(h.find('#dat-periodic'), section + ' offers the periodic table');
  }
  await h.go('view=drill&section=bio&n=1&mode=untimed');
  assert.equal(h.find('#dat-periodic-modal'), null, 'the modal is closed until asked for');
  h.find('#dat-periodic').click();
  const modal = h.find('#dat-periodic-modal');
  assert.ok(modal, 'the modal opens');
  assert.equal(modal.getAttribute('role'), 'dialog');
  assert.equal(modal.getAttribute('aria-modal'), 'true');
  assert.equal(h.all('.dat-pt-cell:not(.dat-pt-marker)').length, 118, 'all 118 elements are drawn from element data');
  assert.equal(h.text('.dat-pt-cell .dat-pt-sym'), 'H');
  assert.equal(h.find('.dat-ptable img'), null, 'the table is drawn, never an image of the testing software');
  h.find('#dat-periodic').click();
  assert.equal(h.all('#dat-periodic-modal').length, 1, 'a second click does not stack a second modal');
  h.key('Escape');
  assert.equal(h.find('#dat-periodic-modal'), null, 'Escape closes it');
  assert.equal(h.saved('cs-dat-log'), null, 'closing the modal answered nothing');

  // QR is not in outline.tools.periodicTable.sections.
  assert.ok(!PERIODIC_SECTIONS.includes('qr'));
  await h.go('view=drill&section=qr&category=QR-3&n=1&mode=untimed');
  assert.equal(h.find('#dat-periodic'), null, 'no periodic table outside the sections the outline names');
  h.close();
});

test('the periodic table is a real modal: the shell traps it, Escape closes it and focus goes back to its button', async () => {
  const h = harness();
  let disconnected = 0;
  h.w.MutationObserver = class extends h.w.MutationObserver {
    disconnect() {
      disconnected++;
      super.disconnect();
    }
  };
  // The shell's own trapModal, verbatim from app.js, so the test exercises what production runs.
  const trap = fs.readFileSync('app.js', 'utf8').match(/\nfunction trapModal\([\s\S]*?\n}\n/);
  assert.ok(trap, 'app.js trapModal');
  h.run(trap[0] + 'window.trapModal = trapModal;');
  await h.go('view=drill&section=bio&n=1&mode=untimed');
  const opener = h.find('#dat-periodic');
  opener.focus();
  opener.click();
  const close = h.find('#dat-periodic-close');
  assert.equal(h.w.document.activeElement, close, 'focus moves into the table');
  close.dispatchEvent(new h.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(h.find('#dat-periodic-modal'), null, 'Escape inside the table closes it');
  assert.equal(h.w.document.activeElement, opener, 'focus returns to the button that opened it');
  assert.equal(h.saved('cs-dat-log'), null, 'closing the table answered nothing');
  // Let the real removal observer clean up before jsdom destroys its document.
  await Promise.resolve();
  assert.equal(disconnected, 1, 'the modal observer disconnects after the overlay is removed');
  h.close();
});

test('answering writes one cs-dat-log row of the documented shape, plus history and a mistake record', async () => {
  const h = harness();
  await h.go('view=drill&section=bio&n=2&mode=untimed');
  const first = answer(h, 'correct');

  const log = h.saved('cs-dat-log');
  assert.equal(log.length, 1, 'one row per answered item');
  const row = log[0];
  assert.deepEqual(Object.keys(row).sort(), [
    'attemptId',
    'category',
    'conf',
    'correct',
    'ms',
    'qId',
    'section',
    'source',
    'topic',
    'ts',
  ]);
  assert.equal(row.qId, first.id);
  assert.equal(row.section, first.section);
  assert.equal(row.category, first.category);
  assert.equal(row.topic, first.topic, 'the row carries the outline topic, not just the category');
  assert.equal(row.correct, true);
  assert.equal(row.conf, 'unsure', 'the default confidence is recorded');
  assert.equal(typeof row.ms, 'number', 'per-item timing is recorded');
  assert.ok(row.ms >= 0);
  assert.ok(row.ts > 0);
  assert.match(row.attemptId, /^dat-/);
  assert.equal(row.source, 'drill');

  const hist = h.saved('cs-dat-q');
  assert.deepEqual(Object.keys(hist), [first.id]);
  assert.equal(hist[first.id].n, 1);
  assert.equal(hist[first.id].lastCorrect, true);
  assert.equal(hist[first.id].lastAttemptId, row.attemptId);
  assert.equal(h.saved('cs-dat-srs'), null, 'a correct answer enrols nothing in the mistake log');

  // A miss enrols the item, due in a minute, tagged with its section/category/topic.
  h.find('#dat-next').click();
  const second = answer(h, 'wrong');
  const srs = h.saved('cs-dat-srs');
  assert.deepEqual(Object.keys(srs), [second.id]);
  assert.equal(srs[second.id].section, second.section);
  assert.equal(srs[second.id].category, second.category);
  assert.equal(srs[second.id].topic, second.topic);
  assert.ok(srs[second.id].due > Date.now());
  const log2 = h.saved('cs-dat-log');
  assert.equal(log2.length, 2, 'the log grew by exactly the answered count');
  assert.equal(log2[1].correct, false);
  assert.equal(log2[0].attemptId, log2[1].attemptId, 'one attempt id for the run');

  // The mistake log lists the enrolment, due a minute from now and not yet reviewable.
  await h.go('view=mistakes');
  assert.ok(h.find('main.dat-mistakes'));
  assert.match(h.text('.dat-mistakes .sub'), /1 missed item enrolled; 0 due now\./);
  assert.equal(h.all('.dat-mistake-group li').length, 1, 'every enrolled item is listed');
  assert.equal(h.all('.dat-mistake-group li.dat-mistake-due').length, 0, 'nothing is due in the first minute');
  assert.equal(h.find('#dat-review-start'), null, 'no review is offered before anything is due');
  assert.match(h.text('#dat-review-next'), /Next item due in 1 min\./);
  // Wind the record back a minute: the log then lists it under its section with its topic.
  const back = h.saved('cs-dat-srs');
  back[second.id].due = Date.now() - 1000;
  h.store.set('cs-dat-srs', JSON.stringify(back));
  const later = harness({ store: h.store });
  await later.go('view=mistakes');
  assert.equal(later.all('.dat-mistake-group li').length, 1);
  assert.match(later.text('.dat-mistake-group h2'), new RegExp(outline.sections[second.section].name));
  assert.equal(later.text('.dat-mistake-topic').split(' · ').pop(), second.topic);
  later.close();
});

test('confidence is taggable and travels into the log row', async () => {
  const h = harness();
  await h.go('view=drill&section=bio&n=1&mode=untimed');
  assert.deepEqual(h.texts('#dat-conf .mode'), ['Guess', 'Unsure', 'Sure']);
  assert.equal(h.find('#dat-conf .mode.active').dataset.datConf, 'unsure');
  h.all('#dat-conf .mode')
    .find(b => b.dataset.datConf === 'sure')
    .click();
  answer(h, 'correct');
  assert.equal(h.saved('cs-dat-log')[0].conf, 'sure');
  assert.equal(h.saved('cs-dat-q')[h.saved('cs-dat-log')[0].qId].conf, 'sure');
  h.close();
});

test('the pace bar is built from the outline pacing, not from a literal 54', async () => {
  const h = harness();
  await h.go('view=drill&section=bio&n=3&mode=paced');
  const bar = h.find('#dat-drill-clock');
  assert.ok(bar.classList.contains('dat-pace'));
  assert.equal(bar.getAttribute('role'), 'progressbar');
  assert.equal(bar.getAttribute('aria-valuemin'), '0');
  assert.equal(bar.getAttribute('aria-valuemax'), '100');
  assert.ok(h.find('.dat-pace-fill'), 'the bar has a fill to amber out at the target');
  assert.match(h.text('.dat-pace-label'), new RegExp(`/ ${PACE.bio} s$`), 'the target is the outline bio pace');
  assert.equal(h.text('.dat-drill-count'), 'Q 1/3');
  h.run('pauseDatTools()'); // stop the 250 ms ticker before leaving the page

  // A QR scope paces at the QR target, so the pace is per item, not one constant per runner.
  assert.notEqual(PACE.qr, PACE.bio);
  const qr = harness();
  await qr.go('view=drill&section=qr&category=QR-3&n=1&mode=paced');
  assert.match(qr.text('.dat-pace-label'), new RegExp(`/ ${PACE.qr} s$`));
  qr.run('pauseDatTools()');
  qr.close();
});

test('a drill URL with section=qr hands off to the QR runner when it is loaded', async () => {
  const h = harness();
  let called = 0;
  h.w.DatQr = {
    render() {
      called += 1;
      h.w.setView(h.w.el('<main class="panel dat-qr-setup"><h1>Quantitative Reasoning.</h1></main>'));
    },
  };
  await h.go('view=drill&section=qr&n=10&mode=paced');
  assert.equal(called, 1, 'the QR runner owns the page');
  assert.match(h.w.location.search, /view=qr/);
  assert.doesNotMatch(h.w.location.search, /view=drill/);
  assert.equal(h.find('.dat-drill-main, .dat-drill-setup'), null);
  assert.match(h.text('h1'), /Quantitative Reasoning/);
  h.close();
});

test('the exam clock is one section clock of n x the outline pace', async () => {
  const h = harness();
  await h.go('view=drill&section=bio&n=2&mode=exam');
  assert.equal(h.find('.dat-pace'), null, 'no per-item bar under the section clock');
  const seconds = 2 * PACE.bio;
  assert.equal(
    h.text('#dat-drill-clock'),
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  );
  h.run('pauseDatTools()');
});

test('a drill resumes after a simulated reload with its answers, its attempt id and its position', async () => {
  const store = new Map();
  const query = 'view=drill&section=bio&n=3&mode=untimed';
  const first = harness({ store });
  await first.go(query);
  const answered = answer(first, 'correct');
  first.find('#dat-next').click();
  assert.equal(first.text('.dat-drill-count'), 'Q 2/3');
  const blob = first.saved('cs-dat-r-drill');
  assert.ok(blob, 'the run is written to cs-dat-r-drill');
  assert.deepEqual(blob.scope, { section: 'bio', category: '', topic: '' });
  assert.equal(blob.qs.length, 3);
  assert.equal(blob.deadline, undefined, 'the absolute deadline never reaches storage');
  const attemptId = first.saved('cs-dat-log')[0].attemptId;
  first.close();

  // Reload: a brand-new document over the same browser storage.
  const second = harness({ store });
  await second.go(query);
  assert.equal(second.text('.dat-drill-count'), 'Q 2/3', 'the reload lands back on the unanswered item');
  assert.notEqual(second.item().id, answered.id, 'the answered item is not re-asked');
  answer(second, 'correct');
  second.find('#dat-next').click();
  answer(second, 'wrong');
  second.find('#dat-next').click();

  const log = second.saved('cs-dat-log');
  assert.equal(log.length, 3, 'three answers across the reload');
  assert.ok(
    log.every(r => r.attemptId === attemptId),
    'the resumed run keeps one attempt id'
  );
  assert.deepEqual(log.map(r => r.qId).sort(), [...new Set(log.map(r => r.qId))].sort(), 'no item logged twice');
  assert.ok(second.find('main.dat-review'), 'the run ends on the review page');
  assert.equal(second.saved('cs-dat-r-drill'), null, 'finishing clears the resume blob');
  second.close();

  // A third page load starts fresh rather than resuming a finished run.
  const third = harness({ store });
  await third.go(query);
  assert.equal(third.text('.dat-drill-count'), 'Q 1/3');
  third.close();
});

test('a different scope starts only after confirming replacement of the unfinished run', async () => {
  const store = new Map();
  const h = harness({ store });
  await h.go('view=drill&section=bio&n=3&mode=untimed');
  answer(h, 'correct');
  assert.ok(h.saved('cs-dat-r-drill'));
  let confirmations = 0;
  h.w.confirm = message => {
    assert.match(message, /Replace your unfinished science drill/);
    confirmations++;
    return true;
  };
  await h.go('view=drill&section=gchem&n=3&mode=untimed');
  assert.equal(confirmations, 1);
  assert.equal(h.item().section, 'gchem', 'a gchem drill never resumes the bio blob');
  assert.equal(h.text('.dat-drill-count'), 'Q 1/3');
  h.close();
});

test('the review page reports accuracy, seconds per item against the target and the by-topic table', async () => {
  const h = harness();
  await h.go('view=drill&section=bio&n=2&mode=untimed');
  answer(h, 'correct');
  h.find('#dat-next').click();
  const missed = answer(h, 'wrong');
  h.find('#dat-next').click();

  assert.ok(h.find('main.dat-review'));
  assert.equal(h.text('#dat-review-accuracy'), '50%');
  assert.match(h.text('#dat-review-pace'), new RegExp(`vs ${PACE.bio} s target`), 'compared against the outline pace');
  assert.equal(h.text('#dat-review-fast-wrong'), '1', 'an instant miss is a fast wrong');
  assert.equal(h.text('#dat-review-slow-wrong'), '0');
  const topics = h.all('.dat-topic-table tbody tr').map(tr => tr.children[1].textContent);
  assert.ok(topics.length > 0, 'the by-topic table has a row per topic drilled');
  assert.ok(topics.includes(missed.topic), 'the missed item names its outline topic');
  assert.ok(
    topics.every(t => questions.some(q => q.topic === t)),
    'every topic row is an outline topic carried by a bank item'
  );
  assert.equal(h.all('.dat-rev').length, 2, 'both items are reviewable');
  assert.equal(h.all('.ticks span').length, 2);
  h.close();
});

test('an exam-clock run that is forced to finish logs its unanswered items', async () => {
  const h = harness();
  await h.go('view=drill&section=bio&n=2&mode=exam');
  answer(h, 'correct');
  assert.equal(h.saved('cs-dat-log').length, 1, 'no feedback, but the answer is logged');
  assert.equal(h.find('.dat-explain'), null, 'exam mode withholds the explanation until the review');
  h.run('pauseDatTools()');
  h.run('DatPractice.pause()');
  // The section clock running out finishes the run for the candidate.
  h.find('#dat-next').click();
  answer(h, 'wrong');
  h.find('#dat-next').click();
  const log = h.saved('cs-dat-log');
  assert.equal(log.length, 2);
  assert.ok(h.find('main.dat-review'));
  h.close();
});

test('a keypress answers exactly once with mcat.js keydown handler loaded in the same document', async () => {
  const h = harness({ mcat: true });
  assert.equal(h.run('typeof renderMCATEntry'), 'function', 'the MCAT track really is loaded');
  h.run('drill = { phase: "attempt" };'); // arm the mcat.js drill handler
  await h.go('view=drill&section=bio&n=2&mode=untimed');
  // The premise of the guard: the DAT runner uses none of the ids mcat.js/app.js delegate on.
  assert.equal(h.find('#opts, #conf, .flash-stage, .quizwrap .stage, [data-course-view]'), null);

  let clicks = 0;
  const target = h.find('#dat-opt-0');
  target.addEventListener('click', () => clicks++);
  h.key('A');
  assert.equal(clicks, 1, 'one keypress, one click');
  assert.equal(h.saved('cs-dat-log').length, 1, 'one keypress, one logged answer');
  assert.ok(target.disabled, 'the answered item is locked');
  h.key('A');
  assert.equal(clicks, 1, 'a second press on a revealed item does nothing');
  assert.equal(h.saved('cs-dat-log').length, 1);

  // Digits address the same positions, and a key past the option count is ignored.
  h.find('#dat-next').click();
  let digitClicks = 0;
  h.find('#dat-opt-1').addEventListener('click', () => digitClicks++);
  h.key('F'); // LETTERS[5], beyond this item's option count
  h.key('0');
  assert.equal(h.saved('cs-dat-log').length, 1, 'out-of-range keys answer nothing');
  h.key('2');
  assert.equal(digitClicks, 1);
  assert.equal(h.saved('cs-dat-log').length, 2);
  h.close();
});

test('the periodic table opens on P and swallows answer keys while it is open', async () => {
  const h = harness();
  await h.go('view=drill&section=gchem&n=1&mode=untimed');
  h.key('p');
  assert.ok(h.find('#dat-periodic-modal'), 'P opens the table');
  h.key('A');
  assert.equal(h.saved('cs-dat-log'), null, 'keys behind the modal answer nothing');
  h.key('Escape');
  h.key('A');
  assert.equal(h.saved('cs-dat-log').length, 1, 'the key works again once the modal is closed');
  h.close();
});

test('the setup page is data-driven and refuses a scope the banks cannot fill', async () => {
  const h = harness();
  await h.go('view=drill');
  assert.ok(h.find('main.dat-drill-setup'));
  assert.deepEqual(
    h.all('#dat-setup-section .mode').map(b => b.dataset.datSection),
    ['bio', 'gchem', 'ochem', 'mixed']
  );
  assert.deepEqual(
    h.all('#dat-setup-mode .mode').map(b => b.dataset.datMode),
    ['paced', 'exam', 'untimed']
  );
  assert.match(h.text('.dat-drill-setup .sub'), new RegExp(`${PACE.bio}-second pace`), 'pace copy from the outline');
  const cats = h
    .all('#dat-setup-category option')
    .map(o => o.value)
    .filter(Boolean);
  const sns = outline.concepts
    .filter(c => outline.blocks.find(b => b.id === 'sns').sections.includes(c.section))
    .flatMap(c => c.categories.map(x => x.id));
  assert.deepEqual(cats, sns, 'the category list is the outline SNS categories');
  assert.match(h.text('#dat-pool-note'), /\d+ items available/);
  assert.equal(h.find('#dat-start').disabled, false);

  // A scope with no items refuses to start and says so rather than opening an empty runner.
  const empty = outline.concepts.flatMap(c => c.categories).find(c => !questions.some(q => q.category === c.id));
  if (empty) {
    await h.go('view=drill&section=gchem&category=' + empty.id + '&n=5');
    assert.ok(h.find('main.dat-drill-setup'), 'an unfillable scope lands back on setup');
    assert.match(h.text('.dat-drill-notice'), /No items match that scope yet/);
  }
  h.close();
});

test('the cheat-sheet view lists the cards tagged for the sheet', async () => {
  const h = harness();
  await h.go('view=drill&section=bio&mode=sheet');
  assert.ok(h.find('main.dat-sheet'));
  assert.match(h.text('.dat-sheet h1'), /Biology/);
  h.close();
});

test('pause freezes the clock and hands the shell a resume hook for the drill clock', async () => {
  const h = harness();
  await h.go('view=drill&section=bio&n=2&mode=exam');
  const hook = h.run('DatPractice.pause()');
  assert.equal(hook.selector, '#dat-drill-clock');
  assert.equal(typeof hook.resume, 'function');
  // Saving paused, then recovered, restarts the clock only because that view is still on screen.
  h.w.dispatchEvent(new h.w.Event('study-storage-paused'));
  h.w.dispatchEvent(new h.w.Event('study-storage-recovered'));
  assert.ok(h.find('#dat-drill-clock'), 'the clock survived the round trip');
  h.run('DatPractice.pause()');
  h.close();
});

/* ---------- both runners in one document (the shell always loads both) ---------- */

test('the two runners share one attempt cache, so neither silently overwrites the other rows', async () => {
  const h = harness({ pat: true });
  const drillQuery = 'view=drill&section=bio&n=2&mode=untimed';
  await h.go(drillQuery);
  const firstDrill = answer(h, 'wrong');
  h.find('#dat-next').click();

  // Leave the drill mid-run for a PAT set, then come back and answer the item still waiting.
  await h.go('view=pat&subtest=angles&level=2&n=3');
  const patIds = [patAnswer(h), patAnswer(h), patAnswer(h)];
  await h.go(drillQuery);
  const secondDrill = answer(h, 'wrong');

  const log = h.saved('cs-dat-log');
  assert.deepEqual(
    log.map(row => row.source),
    ['drill', 'pat', 'pat', 'pat', 'drill'],
    'every row written in this session survives, in the order it was answered'
  );
  assert.deepEqual(
    log.map(row => row.qId),
    [firstDrill.id, ...patIds, secondDrill.id]
  );
  assert.deepEqual(
    Object.keys(h.saved('cs-dat-q')).sort(),
    [firstDrill.id, ...patIds, secondDrill.id].sort(),
    'cs-dat-q keeps the history of both runners'
  );
  assert.deepEqual(
    Object.keys(h.saved('cs-dat-srs')).sort(),
    [firstDrill.id, ...patIds, secondDrill.id].sort(),
    'every miss stays enrolled in the mistake log'
  );

  // One cache, built once, and every watch accessor reports the live shared value.
  assert.deepEqual(
    h.watchers.map(entry => entry.key).sort(),
    ['cs-dat-log', 'cs-dat-q', 'cs-dat-srs'],
    'the shared cache registers one watcher per key, whichever module built it'
  );
  for (const { key, current } of h.watchers) assert.deepEqual(live(current), h.saved(key), key + ' watcher is live');
  h.close();
});

test('the shared attempt cache is the same one whichever runner reads first', async () => {
  const h = harness({ pat: true });
  await h.go('view=pat&subtest=angles&level=2&n=2');
  const patIds = [patAnswer(h), patAnswer(h)];
  await h.go('view=drill&section=bio&n=1&mode=untimed');
  const drilled = answer(h, 'wrong');

  assert.deepEqual(
    h.saved('cs-dat-log').map(row => row.qId),
    [...patIds, drilled.id]
  );
  assert.deepEqual(Object.keys(h.saved('cs-dat-srs')).sort(), [...patIds, drilled.id].sort());
  assert.equal(h.watchers.length, 3, 'the second module reuses the cache rather than registering its own');
  h.close();
});

test('"Another set" deals a new PAT set instead of reopening the finished one', async () => {
  const h = harness({ pat: true });
  const query = 'view=pat&subtest=angles&level=2&n=2';
  await h.go(query);
  const done = h.saved('cs-dat-r-pat').ids.slice();
  patAnswer(h);
  patAnswer(h);
  assert.ok(h.find('.dat-pat-review'), 'the set ends on the review page');

  const another = h.all('.dat-pat-review .endbtns a').find(a => a.textContent.includes('Another set'));
  assert.ok(another, 'the review offers Another set');
  assert.equal(another.getAttribute('href'), '/dat?view=pat&subtest=angles&level=2', 'it points at the subtest URL');

  await h.go(another.getAttribute('href').split('?')[1]);
  assert.ok(h.find('.dat-pat-run'), 'Another set opens a runner, not the review it was clicked from');
  assert.equal(h.text('.dat-pat-run .dat-pat-count'), 'Item 1 of 15', 'a fresh set at its first item');
  assert.equal(h.saved('cs-dat-r-pat').idx, 0);
  assert.equal(h.saved('cs-dat-log').length, 2, 'the finished set is not re-logged');
  assert.ok(done.length === 2, 'the finished set had its own two items');
  h.close();
});

test('a resume whose bank item was retired keeps every answer on the question it was given for', async () => {
  const store = new Map();
  const query = 'view=drill&section=bio&n=4&mode=untimed';
  const first = harness({ store });
  await first.go(query);
  answer(first, 'correct');
  first.find('#dat-next').click();
  answer(first, 'wrong');
  first.find('#dat-next').click();
  const qs = first.saved('cs-dat-r-drill').qs.slice();
  assert.equal(first.text('.dat-drill-count'), 'Q 3/4');
  first.close();

  // A deploy retires the first item of the saved run.
  const second = harness({ store });
  await second.go('');
  second.run(`DAT.questions = DAT.questions.filter(q => q.id !== ${JSON.stringify(qs[0])})`);
  await second.go(query);
  assert.equal(second.text('.dat-drill-count'), 'Q 2/3', 'one answer went with the retired item, one remains');
  assert.equal(second.item().id, qs[2], 'the runner lands on the first question that has no answer yet');
  answer(second, 'wrong');
  second.find('#dat-next').click();
  assert.equal(second.item().id, qs[3]);
  answer(second, 'correct');
  second.find('#dat-next').click();

  assert.deepEqual(
    second.saved('cs-dat-log').map(row => [row.qId, row.correct]),
    [
      [qs[0], true],
      [qs[1], false],
      [qs[2], false],
      [qs[3], true],
    ],
    'each logged answer belongs to the question it was given for'
  );
  second.close();

  // Nothing left to resume: the stale blob is dropped rather than advertised again.
  const third = harness({ store });
  await third.go(query);
  const stale = third.saved('cs-dat-r-drill');
  assert.ok(stale, 'a fresh run was dealt');
  third.run('DAT.questions = DAT.questions.filter(q => q.section !== "bio")');
  await third.go(query);
  assert.ok(third.find('main.dat-drill-setup'), 'an unresumable blob falls back to setup');
  assert.equal(third.saved('cs-dat-r-drill'), null, 'the stale blob is cleared');
  third.close();
});

test('a repeated PAT miss ages through the shared scheduler, exactly as a repeated drill miss does', async () => {
  const h = harness({ pat: true });
  await h.go('view=pat&subtest=angles&level=2&n=2');
  const ids = h.saved('cs-dat-r-pat').ids.slice();
  patAnswer(h, 'wrong');
  patAnswer(h, 'correct');

  const first = h.saved('cs-dat-srs')[ids[0]];
  assert.ok(first, 'the miss is enrolled');
  assert.equal(first.section, 'pat');
  assert.equal(first.subtest, 'angles', 'the regeneration triple travels with the record');
  assert.equal(first.level, 2);
  assert.equal(typeof first.seed, 'number');
  assert.deepEqual(
    { ease: first.ease, reps: first.reps, interval: first.interval, lapses: first.lapses },
    { ease: 2.5, reps: 0, interval: 0, lapses: 0 },
    'a first miss starts the SM-2 record the way DatDrillCore starts one'
  );

  // The review's add-to-mistake-log on an already-enrolled item is a second miss.
  const button = h.all('[data-dat-enrol]').find(b => b.getAttribute('data-dat-enrol') === ids[0]);
  assert.equal(button.textContent, 'In your mistake log', 'the button reports the existing enrolment');
  button.click();
  const again = h.saved('cs-dat-srs')[ids[0]];
  const mirror = h.run(
    `(() => { const srs = { x: { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: 0, last: 0 } };
       DatDrillCore.enroll(srs, { id: 'x', section: 'pat', category: 'c', topic: null }, Date.now());
       return srs.x; })()`
  );
  assert.deepEqual(
    { ease: again.ease, reps: again.reps, interval: again.interval, lapses: again.lapses },
    { ease: mirror.ease, reps: mirror.reps, interval: mirror.interval, lapses: mirror.lapses },
    'PAT and drill misses age by one rule'
  );
  assert.ok(again.ease < first.ease, 'ease decays on a repeat miss instead of only lapses rising');
  assert.equal(again.subtest, 'angles', 'the triple survives the re-enrolment');
  h.close();
});

test('resetDatState drops the cached stores, so the first answer after a reset writes one row', async () => {
  const h = harness({ pat: true });
  const query = 'view=drill&section=bio&n=2&mode=untimed';
  await h.go(query);
  answer(h, 'wrong');
  await h.go('view=pat&subtest=angles&level=2&n=2');
  patAnswer(h);
  assert.equal(h.saved('cs-dat-log').length, 2, 'two rows before the reset');

  // A workspace replacement: the shell resets, and the browser copy is replaced wholesale. (The
  // cs-dat-r-* blobs are dropped here by hand: resetDatState sweeps them out of localStorage, which
  // this harness's store stands apart from; scripts/test-dat-shell.cjs covers that sweep.)
  h.run('resetDatState()');
  assert.equal(h.run('DAT.attemptStores'), null, 'the shared cache is dropped');
  for (const key of [...h.store.keys()]) if (key.startsWith('cs-dat-')) h.store.delete(key);

  await h.go(query);
  const fresh = answer(h, 'wrong');
  const log = h.saved('cs-dat-log');
  assert.equal(log.length, 1, 'the cleared log is not rewritten from the pre-reset cache');
  assert.equal(log[0].qId, fresh.id);
  assert.deepEqual(Object.keys(h.saved('cs-dat-q')), [fresh.id]);
  assert.deepEqual(Object.keys(h.saved('cs-dat-srs')), [fresh.id]);
  for (const { key, current } of h.watchers.slice(-3))
    assert.deepEqual(live(current), h.saved(key), key + ' watcher reads the rebuilt cache');
  h.close();
});

test('the landing counts the PAT generators that exist, not the subtests the outline plans', async () => {
  const h = harness({ pat: true });
  await h.go('');
  const built = h.run('window.DatPatCore.BUILT.length');
  assert.ok(built > 0 && built <= outline.patSubtests.length, 'some generators are built');
  const index = h.text('.course-hero-index');
  assert.match(index, new RegExp(built + ' perceptual-ability generators'));
  if (built < outline.patSubtests.length)
    assert.doesNotMatch(
      index,
      new RegExp(outline.patSubtests.length + ' perceptual-ability generators'),
      'the planned subtest count is not advertised as a generator count'
    );
  assert.doesNotMatch(
    fs.readFileSync('dat.js', 'utf8'),
    /\d+ perceptual-ability generators/,
    'the count is read from the data, never written as a literal'
  );
  h.close();
});

/* ---------- DAT-05: the mistake log and its spaced review ---------- */
// The key of the visible review item, read in the page's own realm from the id in the resume blob:
// a bank item, a reading question, or a PAT item regenerated from its id.
function reviewKey(h) {
  const blob = h.saved('cs-dat-r-review');
  assert.ok(blob, 'a review writes its own resume blob');
  const id = blob.qs[blob.idx];
  const key = h.run(`(() => {
    const id = ${JSON.stringify(id)};
    const bank = DAT.questions.find(q => q.id === id);
    if (bank) return bank.answer;
    const rc = (DAT.rc?.passages || []).flatMap(p => p.questions).find(q => q.id === id);
    if (rc) return rc.answer;
    return window.DatPatCore.fromId(id).answer;
  })()`);
  return { id, key };
}
function reviewAnswer(h, how = 'correct', conf) {
  const { id, key } = reviewKey(h);
  if (conf) h.find(`#dat-conf .mode[data-dat-conf="${conf}"]`).click();
  h.all('.dat-opt')
    .find(b => (how === 'correct' ? +b.dataset.datI === key : +b.dataset.datI !== key))
    .click();
  return id;
}
function dueRecord(extra) {
  return Object.assign({ ease: 2.5, interval: 0, reps: 0, lapses: 0, due: Date.now() - 1000, last: 0 }, extra);
}

test('a review re-asks what is due, rates each answer from its confidence and never touches the drill in progress', async () => {
  const h = harness();
  await h.go('view=drill&section=bio&n=4&mode=untimed');
  const missed = [answer(h, 'wrong').id];
  h.find('#dat-next').click();
  missed.push(answer(h, 'wrong').id);
  h.find('#dat-next').click();
  answer(h, 'correct');
  const drillBlob = h.store.get('cs-dat-r-drill');
  assert.ok(drillBlob, 'a drill is in progress');

  // A minute later both misses are due.
  const srs = h.saved('cs-dat-srs');
  for (const id of Object.keys(srs)) srs[id].due = Date.now() - 1000;
  h.store.set('cs-dat-srs', JSON.stringify(srs));
  const later = harness({ store: h.store });
  await later.go('view=mistakes');
  assert.equal(later.all('.dat-mistake-group li.dat-mistake-due').length, 2, 'both misses are listed as due now');
  assert.equal(later.text('#dat-review-start'), 'Review 2 due now');
  assert.match(later.find('#dat-review-start').getAttribute('href'), /view=drill&review=1/);

  await later.go('view=drill&review=1');
  assert.ok(later.find('.dat-drill'), 'the review runs in the drill runner');
  assert.equal(later.text('.dat-drill-crumb span'), 'Review');
  assert.deepEqual(later.saved('cs-dat-r-review').qs.slice().sort(), missed.slice().sort(), 'exactly the due items');

  // Right and sure: rated easy, so the first repetition comes back in three days.
  const first = reviewAnswer(later, 'correct', 'sure');
  const rec = later.saved('cs-dat-srs')[first];
  assert.equal(rec.reps, 1);
  assert.equal(rec.interval, 3);
  assert.ok(rec.due > Date.now() + 2.9 * 86400000, 'the due date moved three days out');
  assert.equal(rec.section, 'bio', 'the record keeps its tags');
  assert.match(later.text('.dat-review-next'), /Marked Sure, so this counts as easy: due in 3 days\./);
  const row = later.saved('cs-dat-log').at(-1);
  assert.equal(row.qId, first);
  assert.equal(row.source, 'review', 'review answers are logged as reviews');

  // Wrong again: a lapse, back in a minute.
  later.find('#dat-next').click();
  const second = reviewAnswer(later, 'wrong');
  const lapsed = later.saved('cs-dat-srs')[second];
  assert.equal(lapsed.lapses, 1, 'the first miss enrolled the item; missing it again in review is its first lapse');
  assert.equal(lapsed.reps, 0);
  assert.ok(lapsed.due <= Date.now() + 60000);
  assert.match(later.text('.dat-review-next'), /due again in a minute/);

  later.find('#dat-next').click();
  assert.match(later.text('.dat-review-summary .label'), /^Review complete/);
  assert.match(later.find('#dat-again').getAttribute('href'), /view=mistakes/);
  assert.equal(later.saved('cs-dat-r-review'), null, 'the finished review clears its resume blob');
  assert.equal(later.store.get('cs-dat-r-drill'), drillBlob, 'the drill in progress is untouched');

  await later.go('view=mistakes');
  assert.equal(later.all('.dat-mistake-group li.dat-mistake-due').length, 0);
  assert.equal(later.text('#dat-review-next'), 'Next item due in 1 min.');
  h.close();
  later.close();
});

test('a review in progress resumes after a reload, and asking with nothing due explains itself', async () => {
  const store = new Map();
  const ids = questions.filter(q => q.section === 'gchem').slice(0, 2);
  store.set(
    'cs-dat-srs',
    JSON.stringify(
      Object.fromEntries(ids.map(q => [q.id, dueRecord({ section: 'gchem', category: q.category, topic: q.topic })]))
    )
  );
  const h = harness({ store });
  await h.go('view=drill&review=1');
  reviewAnswer(h, 'correct');
  const reload = harness({ store });
  await reload.go('view=mistakes');
  assert.match(reload.text('.dat-resume-row'), /A review is in progress \(1\/2 answered\)/);
  await reload.go('view=drill&review=1');
  assert.equal(reload.text('.dat-drill-count'), 'Q 1/2', 'the review resumes where it was left');
  assert.ok(reload.find('.dat-explain'), 'with the answered item still showing its feedback');
  reload.find('#dat-next').click();
  assert.equal(reload.text('.dat-drill-count'), 'Q 2/2');
  reviewAnswer(reload, 'correct');
  reload.find('#dat-next').click();

  await reload.go('view=drill&review=1');
  assert.ok(reload.find('main.dat-mistakes'), 'nothing due falls back to the log');
  assert.equal(reload.text('.dat-drill-notice'), 'Nothing in your mistake log is due right now.');
  h.close();
  reload.close();
});

test('a missed PAT item is re-asked from its triple, and waits in the log when the engine is absent', async () => {
  const probe = harness({ pat: true });
  const item = probe.run(
    '(() => { const i = DatPatCore.set("holes", 7, 2, 1)[0]; return { id: i.id, category: i.category, seed: i.seed }; })()'
  );
  probe.close();
  const store = new Map([
    [
      'cs-dat-srs',
      JSON.stringify({
        [item.id]: dueRecord({
          section: 'pat',
          category: item.category,
          topic: null,
          subtest: 'holes',
          seed: item.seed,
          level: 2,
        }),
      }),
    ],
  ]);
  const h = harness({ store, pat: true });
  await h.go('view=drill&review=1');
  assert.ok(h.find('.dat-review-pat .dat-pat-figure svg'), 'the figure is regenerated, not stored');
  assert.equal(h.all('.dat-opt.dat-pat-opt-svg svg').length, 5, 'the five hole patterns are drawn as options');
  assert.deepEqual(h.texts('.dat-opt .key'), LETTERS.slice(0, 5));
  reviewAnswer(h, 'correct');
  assert.ok(h.find('.dat-pat-steps'), 'the worked steps come back with the figure');
  const row = h.saved('cs-dat-log').at(-1);
  assert.deepEqual(
    { qId: row.qId, section: row.section, subtest: row.subtest, seed: row.seed, level: row.level, source: row.source },
    { qId: item.id, section: 'pat', subtest: 'holes', seed: item.seed, level: 2, source: 'review' }
  );
  const rec = h.saved('cs-dat-srs')[item.id];
  assert.deepEqual([rec.subtest, rec.seed, rec.level, rec.reps, rec.interval], ['holes', item.seed, 2, 1, 1]);
  assert.doesNotMatch(h.store.get('cs-dat-r-review') || '', /<svg/, 'no figure reaches the resume blob');
  h.close();

  // Without the PAT engine the record is listed but not offered.
  const bare = harness({ store: new Map([['cs-dat-srs', store.get('cs-dat-srs')]]) });
  await bare.go('view=mistakes');
  assert.equal(bare.all('.dat-mistake-group li.dat-mistake-gone').length, 1);
  assert.match(bare.text('.dat-mistake-gone small'), /not available here/);
  assert.equal(bare.find('#dat-review-start'), null);
  bare.close();
});

test('a reading question is re-asked with its passage and marks its evidence paragraph after the answer', async () => {
  const rc = JSON.parse(fs.readFileSync('data/dat-rc.json', 'utf8'));
  const passage = rc.passages[0],
    q = passage.questions[0];
  const store = new Map([
    [
      'cs-dat-srs',
      JSON.stringify({ [q.id]: dueRecord({ section: 'rc', category: 'RC-1', topic: null, passage: passage.id }) }),
    ],
  ]);
  const h = harness({ store });
  await h.go('view=drill&review=1');
  const paragraphs = passage.text.split(/\n\n+/).filter(p => p.trim());
  assert.equal(h.all('.dat-review-passage-text p').length, paragraphs.length, 'the whole passage, numbered');
  assert.equal(h.all('.dat-review-evidence').length, 0, 'no evidence is marked before the answer');
  reviewAnswer(h, 'wrong');
  assert.deepEqual(
    h.all('.dat-review-evidence').map(p => +p.dataset.datPar),
    q.evidenceParagraphs,
    'the evidence paragraph is marked after the answer'
  );
  const row = h.saved('cs-dat-log').at(-1);
  assert.deepEqual([row.section, row.category, row.passage, row.source], ['rc', 'RC-1', passage.id, 'review']);
  assert.equal(h.saved('cs-dat-srs')[q.id].passage, passage.id, 'the record keeps its passage');
  h.close();
});

test('a review limited to one section stays in the drill runner and offers the QR calculator', async () => {
  const qr = questions.find(q => q.section === 'qr' && q.format === 'standard'),
    bio = questions.find(q => q.section === 'bio');
  const store = new Map([
    [
      'cs-dat-srs',
      JSON.stringify({
        [qr.id]: dueRecord({ section: 'qr', category: qr.category, topic: qr.topic }),
        [bio.id]: dueRecord({ section: 'bio', category: bio.category, topic: bio.topic }),
      }),
    ],
  ]);
  const h = harness({ store });
  for (const file of ['dat-calc-engine.js', 'dat-qr.js']) h.run(fs.readFileSync(file, 'utf8'));
  await h.go('view=mistakes');
  const link = h.all('.dat-mistake-review').find(a => /section=qr/.test(a.getAttribute('href')));
  assert.ok(link, 'each section with due items offers its own review');
  await h.go('view=drill&review=1&section=qr');
  assert.ok(h.find('.dat-drill'), 'a QR review is not handed off to the QR set runner');
  assert.deepEqual(h.saved('cs-dat-r-review').qs, [qr.id], 'only the QR item is dealt');
  assert.equal(h.find('#dat-periodic'), null, 'no periodic table in QR');
  h.find('#dat-review-calc').click();
  assert.ok(h.find('#dat-qr-calc'), 'the exam calculator opens over the re-asked item');
  h.close();
});
