/* Actual course controller and account/save rules in jsdom; not browser evidence. */
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm');
const { JSDOM } = require('jsdom'),
  Progress = require('../auth-progress.js'),
  Core = require('../mcat-course-engine.js');
const KEY = 'cs-mcat-course-v1',
  data = JSON.parse(fs.readFileSync('data/mcat-course.json', 'utf8')),
  clone = x => JSON.parse(JSON.stringify(x));
function harness(id = 'protein-structure', seed = null, content = clone(data)) {
  const unit = content.units.find(u => u.id === id),
    q = unit.questions.find(
      q => q.kind === 'check' && (!unit.authoredHelp || unit.authoredHelp.questionIds.includes(q.id))
    ),
    state = seed || Core.normalize({});
  if (!seed) Core.answer(state, unit, q, (q.answer + 1) % 4, 'sure', 100);
  const dom = new JSDOM('<!doctype html><body><section id="body"></section></body>', {
      url: 'http://localhost/mcat?view=course',
      runScripts: 'outside-only',
    }),
    w = dom.window,
    ctx = dom.getInternalVMContext();
  const get = w.Storage.prototype.getItem,
    set = w.Storage.prototype.setItem,
    remove = w.Storage.prototype.removeItem;
  set.call(w.localStorage, KEY, JSON.stringify(state));
  set.call(w.localStorage, 'sb-secret', 'PRIVATE_ACCOUNT');
  const storage = {
    get length() {
      return w.localStorage.length;
    },
    key: i => w.localStorage.key(i),
    getItem: k => get.call(w.localStorage, k),
    setItem: (k, v) => set.call(w.localStorage, k, v),
    removeItem: k => remove.call(w.localStorage, k),
  };
  const engine = Progress.create({ storage });
  let fail = false;
  w.CortexProgress = Progress;
  w.CortexAccount = { available: true, snapshot: () => engine.portableSnapshot() };
  w.Storage.prototype.setItem = function (k, v) {
    engine.beforeWrite(k);
    if (fail && k === KEY) throw Error('Quota fixture');
    set.call(this, k, v);
    engine.afterWrite(k);
  };
  w.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.esc = x => String(x).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  w.nowTs = () => 1000;
  w.v2Options = (options, chosen, name) =>
    options
      .map(
        (o, i) =>
          `<label><input type="radio" name="${name}" value="${i}" ${chosen === i ? 'checked' : ''}>${w.esc(o)}</label>`
      )
      .join('');
  const requests = [],
    errors = [];
  w.fetch = (...args) => {
    requests.push(args);
    throw Error('Help must not send learner data');
  };
  w.addEventListener('error', e => {
    errors.push(e.error);
    e.preventDefault();
  });
  const run = code => vm.runInContext(code, ctx);
  for (const file of ['study-storage.js', 'mcat-course-engine.js', 'mcat-course.js'])
    run(fs.readFileSync(file, 'utf8'));
  w.fixtureData = content;
  run('courseData=fixtureData');
  const find = s => w.document.querySelector(s),
    click = s => {
      const node = find(s);
      assert.ok(node, s);
      node.click();
      assert.deepEqual(errors, []);
    },
    input = (s, value) => {
      const node = find(s);
      assert.ok(node, s);
      node.value = value;
      node.dispatchEvent(new w.Event('input', { bubbles: true }));
      assert.deepEqual(errors, []);
    };
  return {
    w,
    run,
    find,
    click,
    input,
    requests,
    unit,
    q,
    render: () =>
      run(
        `courseQuestionHelp(document.querySelector('#body'),courseUnit('${id}'),courseRecord('${id}'),courseUnit('${id}').questions.find(q=>q.id==='${q.id}'),false)`
      ),
    raw: () => storage.getItem(KEY),
    state: () => JSON.parse(storage.getItem(KEY)),
    force: (k, v) => storage.setItem(k, v),
    set fail(v) {
      fail = v;
    },
    close() {
      engine.stop();
      dom.window.close();
    },
  };
}
test('all three authored guides use actual staged controls, preserve first answers and resume after reload', () => {
  for (const id of ['protein-structure', 'enzyme-rates', 'membrane-transport']) {
    const h = harness(id),
      before = JSON.stringify(h.state().units[id].attempts);
    h.render();
    assert.equal(h.find('#course-help-stages').children.length, 0);
    h.input('#course-help-note', 'The distinction I missed');
    h.click('#course-help-reveal');
    assert.equal(h.find('#course-help-note'), null);
    assert.equal(h.find('#course-help-stages').children.length, 1);
    h.input('#course-help-reflection', 'My updated account');
    const resumed = harness(id, h.state());
    resumed.render();
    assert.equal(resumed.find('#course-help-reflection').value, 'My updated account');
    resumed.click('#course-help-reveal');
    assert.equal(resumed.find('#course-help-stages').children.length, 2);
    assert.equal(resumed.find('#course-help-reveal'), null);
    resumed.click('[name="course-help-answer"][value="0"]');
    resumed.click('#course-help-check');
    assert.ok(resumed.state().units[id].help[h.q.id].answeredAt);
    assert.equal(JSON.stringify(resumed.state().units[id].attempts), before);
    assert.equal(resumed.requests.length, 0);
    assert.equal(h.requests.length, 0);
    resumed.close();
    h.close();
  }
});
test('future question wording and keys never enter the help DOM; source links and uncertainty are explicit', () => {
  const h = harness();
  h.render();
  h.click('#course-help-reveal');
  h.click('#course-help-reveal');
  const text = h.find('#body').textContent;
  for (const q of h.unit.questions.filter(q => q.kind === 'delayed')) assert.ok(!text.includes(q.stem));
  assert.equal(h.find('#course-help-result').textContent, '');
  assert.match(text, /Independent content review is pending/);
  assert.match(text, /not an assessment of your reasoning/);
  for (const a of h.w.document.querySelectorAll('#course-help-stages a')) {
    assert.equal(a.href, h.unit.source.url);
    assert.equal(a.rel, 'noopener noreferrer');
  }
  h.close();
});
test('osmosis help checks water direction; a saved older transport check is retained and labeled as related', () => {
  const h = harness('membrane-transport');
  h.render();
  assert.ok(h.find('#body').textContent.includes(h.unit.authoredHelp.checks[h.q.id].stem));
  assert.ok(!h.find('#body').textContent.includes(h.unit.questions[0].stem));
  assert.ok(h.find('#body').textContent.includes('Check this idea'));
  const saved = h.state(),
    legacy = { questionSnapshot: Core.snapshot(h.unit.questions[0]), chosen: 1, answeredAt: 150 };
  saved.units[h.unit.id].help[h.q.id] = { ...saved.units[h.unit.id].help[h.q.id], ...legacy };
  const old = harness(h.unit.id, saved);
  old.render();
  assert.ok(old.find('#body').textContent.includes('Related lesson check'));
  assert.ok(old.find('#body').textContent.includes('may cover a different distinction'));
  assert.ok(!old.find('#body').textContent.includes('Check this idea'));
  for (const key of Object.keys(legacy)) assert.deepEqual(old.state().units[h.unit.id].help[h.q.id][key], legacy[key]);
  assert.equal(old.find('#course-help-check').disabled, true);
  h.close();
  old.close();
});
test('save failure holds a draft and queues a reveal without showing an unsaved stage or changing accuracy', () => {
  const h = harness();
  h.render();
  const before = JSON.stringify(h.state().units[h.unit.id].attempts);
  h.fail = true;
  h.input('#course-help-note', 'Recover this note');
  assert.ok(h.find('#study-save-conflict'));
  assert.equal(h.state().units[h.unit.id].help[h.q.id].guide.draft, '');
  h.fail = false;
  h.run('StudyStorage.retry()');
  assert.equal(h.find('#course-help-note').value, 'Recover this note');
  const afterRetry = harness(h.unit.id, h.state());
  afterRetry.render();
  assert.equal(afterRetry.find('#course-help-note').value, 'Recover this note');
  afterRetry.close();
  // Fail the second write: the preflight succeeds but saving the reveal fails.
  h.w.failReveal = () => {
    h.fail = true;
  };
  h.run(
    'const revealOriginal=McatCourseCore.revealHelp;McatCourseCore.revealHelp=(...args)=>{const result=revealOriginal(...args);failReveal();return result;}'
  );
  h.click('#course-help-reveal');
  assert.equal(h.find('#course-help-stages').children.length, 0);
  assert.equal(h.state().units[h.unit.id].help[h.q.id].guide.reveals.length, 0);
  h.fail = false;
  h.run('StudyStorage.retry()');
  assert.equal(h.find('#course-help-stages').children.length, 1);
  assert.equal(JSON.stringify(h.state().units[h.unit.id].attempts), before);
  h.close();
});
test('failed reflection and answer-choice writes survive recovery and a new page, without resubmitting an answer', () => {
  const h = harness();
  h.render();
  h.click('#course-help-reveal');
  const before = JSON.stringify(h.state().units[h.unit.id].attempts);
  h.fail = true;
  h.input('#course-help-reflection', 'Keep my revised distinction');
  assert.match(h.find('#course-help-save').textContent, /held in this tab/);
  h.fail = false;
  h.run('StudyStorage.retry()');
  let resumed = harness(h.unit.id, h.state());
  resumed.render();
  assert.equal(resumed.find('#course-help-reflection').value, 'Keep my revised distinction');
  resumed.close();
  h.fail = true;
  h.click('[name="course-help-answer"][value="2"]');
  assert.ok(h.find('#study-save-conflict'));
  assert.equal(h.state().units[h.unit.id].help[h.q.id].chosen, null);
  h.fail = false;
  h.run('StudyStorage.retry()');
  resumed = harness(h.unit.id, h.state());
  resumed.render();
  assert.equal(resumed.find('[name="course-help-answer"][value="2"]').checked, true);
  assert.equal(resumed.state().units[h.unit.id].help[h.q.id].answeredAt, undefined);
  assert.equal(JSON.stringify(resumed.state().units[h.unit.id].attempts), before);
  resumed.close();
  h.close();
});
test('stale account, newer source state and detached handlers cannot save or reveal', () => {
  for (const mode of ['account', 'state', 'detached']) {
    const h = harness();
    h.render();
    const node = h.find('#course-help-reveal'),
      saved = h.raw();
    if (mode === 'account') h.force(Progress.OWNER, JSON.stringify({ id: 'new-owner', token: 'changed' }));
    if (mode === 'state') h.force(KEY, JSON.stringify({ ...h.state(), mode: 'mixed' }));
    if (mode === 'detached') h.find('#body').remove();
    const current = h.raw();
    node.click();
    assert.equal(h.raw(), current, mode);
    assert.equal(h.requests.length, 0);
    if (mode !== 'detached') assert.ok(h.find('#study-save-conflict'));
    else assert.equal(h.raw(), saved);
    h.close();
  }
});
test('imported markup remains inert and saved source revisions keep their original hint copy', () => {
  const h = harness();
  h.render();
  h.input('#course-help-note', '<img src=x onerror=bad> My note');
  h.click('#course-help-reveal');
  const saved = h.state(),
    content = clone(data),
    old = saved.units[h.unit.id].help[h.q.id].guide.content.stages[0].text;
  content.units[0].authoredHelp.stages[0].text = 'A new version';
  const resumed = harness(h.unit.id, saved, content);
  resumed.render();
  assert.equal(resumed.find('#body img'), null);
  assert.ok(resumed.find('#body').textContent.includes(old));
  assert.ok(!resumed.find('#body').textContent.includes('PRIVATE_ACCOUNT'));
  assert.equal(resumed.requests.length, 0);
  h.close();
  resumed.close();
});
test('malformed saved guidance stays recoverable without replacing stored work', () => {
  const h = harness();
  h.render();
  const state = h.state();
  state.units[h.unit.id].help[h.q.id].guide.content.source.url = 'javascript:alert(1)';
  const bad = harness(h.unit.id, state),
    before = bad.raw();
  bad.render();
  assert.equal(bad.raw(), before);
  assert.ok(bad.find('#study-save-conflict'));
  assert.equal(bad.find('#course-help-reveal'), null);
  h.close();
  bad.close();
});
test('the learning record reopens saved help without adding an attempt or losing its stage', () => {
  const h = harness();
  h.render();
  h.input('#course-help-note', 'Retain this');
  h.click('#course-help-reveal');
  h.w.QLOG = [];
  h.w.MCAT = { cards: [], cars: [], sci: [] };
  h.w.guidePlan = () => null;
  h.w.CONF = { sure: 'Sure' };
  h.w.loadResume = () => null;
  h.run(
    "courseLearningRecord(document.querySelector('#body'),courseUnit('protein-structure'),courseRecord('protein-structure'))"
  );
  let opened;
  h.w.renderCourseUnit = (id, stage) => {
    opened = { id, stage };
  };
  const before = h.state().units[h.unit.id].attempts.length;
  h.click('[data-course-saved-help]');
  assert.deepEqual(opened, { id: 'protein-structure', stage: 'check' });
  assert.equal(h.state().units[h.unit.id].helpOpen, h.q.id);
  h.render();
  assert.equal(h.find('#course-help-stages').children.length, 1);
  assert.ok(h.find('#body').textContent.includes('Retain this'));
  assert.equal(h.state().units[h.unit.id].attempts.length, before);
  h.close();
});
