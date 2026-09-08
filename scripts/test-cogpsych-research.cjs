const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const api = require('../cogpsych-research.js');
const original = JSON.parse(fs.readFileSync('data/cogpsych-research.json'));
const [design, attention] = original.demos;
const source = fs.readFileSync('cogpsych-research.js', 'utf8');
const key = 'cs-cogpsych-research-v1';
assert.ok(original.demos.every(api.validDemo));
for (const method of ['confounded', 'balanced']) for (const effect of [0, 1, 2]) {
  const config = { design: method, effect }, rows = api.rowsFor(design, config);
  assert.equal(rows.length, 16);
  assert.deepEqual(rows, api.rowsFor(design, config), 'Model output must be reproducible');
  const summary = api.summarize(design, config, rows);
  assert.deepEqual(summary.map(row => row.minutes), method === 'confounded' ? [5, 10] : [7.5, 7.5]);
  assert.equal(summary[0].score, method === 'confounded' ? 5.5 : 6.5);
  assert.equal(summary[1].score - summary[0].score, effect + (method === 'confounded' ? 2 : 0));
}
const attentionRows = api.rowsFor(attention, { filter: 'correct' });
const correct = api.summarize(attention, { filter: 'correct' }, attentionRows);
const all = api.summarize(attention, { filter: 'all' }, attentionRows);
assert.deepEqual(correct.map(row => [row.correct, row.count, row.included, row.excluded, row.mean, row.median]), [[11, 12, 11, 1, 640, 640], [9, 12, 9, 3, 480, 480]]);
assert.deepEqual(all.map(row => [row.correct, row.included, row.excluded, row.median]), [[11, 12, 0, 630], [9, 12, 0, 450]]);
assert.equal(all[0].mean, 7340 / 12); assert.equal(all[1].mean, 4980 / 12);
assert.equal(api.median([]), null); assert.equal(api.median([10, 2, 4, 3]), 3.5);
const modelCopy = structuredClone(attention); modelCopy.model.policies[0].correct[0] = 'true';
assert.equal(api.validDemo(modelCopy), false);
assert.throws(() => api.rowsFor(design, { design: 'confounded', effect: 9 }));
const record = api.createRun(design, 'unit-run', 10);
assert.equal(api.reveal(record, 11), false, 'A prediction must precede results');
record.prediction = 'Unequal time could produce a difference even with no strategy effect.';
assert.equal(api.reveal(record, 12), true); assert.equal(api.reveal(record, 13), false);
record.note = 'A changed mean is not evidence that these assumed effects occur in people.';
assert.equal(api.complete(record, 14), false, 'A comparison requires a second setting');
record.config.design = 'balanced'; api.capture(record, 15); api.capture(record, 16);
assert.equal(record.views.length, 2); assert.equal(record.views[1].shownAt, 15);
assert.equal(api.complete(record, 17), true); api.complete(record, 18); assert.equal(record.completedAt, 17);
assert.equal(api.capture(record, 19), false);
assert.ok(api.validProgress({ version: 1, activeId: record.id, runs: [record] }));
const corrupt = structuredClone(record); corrupt.views[0].rows[0].score = 'not a number';
assert.equal(api.validProgress({ version: 1, activeId: null, runs: [corrupt] }), false);

function harness(saved = new Map(), dataset = original) {
  let main, invalid = 0, fail = false, download = true, nextId = 0;
  const nodes = new Map(), writes = [], events = new Map();
  const location = new URL('http://localhost/cogpsych?gates=prod&view=research');
  function node(html = '') {
    const children = [], own = new Map();
    for (const match of html.matchAll(/<(textarea|select|button)[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g)) {
      const value = match[1] === 'textarea' ? match[3] : match[1] === 'select'
        ? ([...match[3].matchAll(/<option value="([^"]+)"([^>]*)>/g)].find(item => item[2].includes('selected')) || [])[1] || '' : '';
      const item = { value, disabled: false }; own.set('#' + match[2], item); nodes.set('#' + match[2], item);
    }
    return { html, append(...items) { children.push(...items); }, appendChild(item) { children.push(item); },
      querySelector(selector) { return own.get(selector) || null; },
      querySelectorAll(selector) {
        const attribute = selector.slice(1, -1);
        return [...html.matchAll(new RegExp(attribute + '="([^"]+)"', 'g'))].map(match => {
          const item = { dataset: { [attribute.slice(5)]: match[1] } }; nodes.set(attribute + '-' + match[1], item); return item;
        });
      } };
  }
  const storage = { paused: false, read: (k, fallback) => saved.has(k) ? JSON.parse(saved.get(k)) : fallback,
    watch(k, getter) { this.getter = getter; }, sessionFailed() { invalid++; this.paused = true; },
    write(k, value) { writes.push(k); if (fail) { this.paused = true; return false; } saved.set(k, JSON.stringify(value)); return true; } };
  const context = vm.createContext({ console, Date, URL, URLSearchParams, location, window: {addEventListener:(name,handler)=>events.set(name,handler)}, crypto: { randomUUID: () => 'research-' + ++nextId },
    StudyStorage: storage, sectionUrl: section => '/' + section + '?gates=prod', esc: String,
    fetch: async () => ({ ok: download, json: async () => structuredClone(dataset) }),
    history: { pushState(_, __, url) { location.href = new URL(url, location).href; } },
    el: html => { const result = node(html); if (html.includes('<main')) main = result; return result; }, topbar: () => node(), siteFooter: () => node(), setView() {} });
  vm.runInContext(source, context);
  return { api: context.window.CogResearch, nodes, saved, writes, storage, location,
    get html() { return main?.html; }, get invalid() { return invalid; }, get progress() { return JSON.parse(saved.get(key)); },
    set fail(value) { fail = value; }, set download(value) { download = value; },
    async recover() { fail = false; storage.paused = false; storage.write(key, storage.getter()); await events.get('study-storage-recovered')?.(); } };
}
(async () => {
  const h = harness(); h.download = false; await h.api.open();
  assert.match(h.html, /could not open/); assert.equal(h.writes.length, 0);
  h.download = true; await h.nodes.get('#research-retry').onclick(); assert.match(h.html, /Prediction, data, interpretation/);
  h.nodes.get('data-demo-design').onclick(); assert.match(h.location.search, /gates=prod&view=research&demo=design&run=/);
  assert.doesNotMatch(h.html, /Synthetic summary/);
  h.nodes.get('#research-reveal').onclick(); assert.equal(h.progress.runs[0].views.length, 0);
  const input = h.nodes.get('#research-prediction'); input.value = 'Longer study time could increase the modeled score.'; input.oninput();
  const reload = harness(h.saved); reload.location.href = h.location.href; await reload.api.open();
  assert.match(reload.html, /Longer study time/); assert.doesNotMatch(reload.html, /Synthetic summary/);
  reload.fail = true; reload.nodes.get('#research-reveal').onclick();
  assert.equal(reload.progress.runs[0].views.length, 0); assert.doesNotMatch(reload.html, /Synthetic summary/);
  reload.nodes.get('#research-reveal').onclick(); await reload.recover();
  const first = reload.progress.runs[0]; assert.equal(first.views.length, 1); assert.match(reload.html, /Synthetic summary/);
  assert.match(reload.html, /readonly/); assert.equal(reload.nodes.get('#research-complete').disabled, true);
  reload.nodes.get('#research-design').value = 'balanced'; reload.nodes.get('#research-effect').value = '0'; reload.nodes.get('#research-apply').onclick();
  assert.equal(reload.progress.runs[0].views.length, 2);
  const note = reload.nodes.get('#research-note'); note.value = 'Balancing time removed the modeled difference; this does not measure a population effect.'; note.oninput();
  reload.fail = true; reload.nodes.get('#research-complete').onclick(); assert.equal(reload.progress.runs[0].completedAt, undefined);
  await reload.recover();
  const completed = reload.progress.runs[0]; assert.ok(completed.completedAt); assert.equal(reload.progress.activeId, null);
  assert.match(reload.html, /Authored comparison/); assert.equal(completed.prediction, first.prediction); assert.equal(completed.predictionSavedAt, first.predictionSavedAt);
  const frozen = structuredClone(original); frozen.demos[0].model.pointsPerMinute = 0; frozen.demos[0].title = 'Later revision';
  const updated = harness(reload.saved, frozen); updated.location.href = reload.location.href; await updated.api.open();
  assert.doesNotMatch(updated.html, /Later revision/); assert.match(updated.html, /Untangle strategy/);
  assert.equal(updated.progress.runs[0].views[0].rows[8].score, 6, 'Saved results use the original model');
  updated.nodes.get('#research-home').onclick(); updated.nodes.get('data-demo-attention').onclick();
  updated.nodes.get('#research-prediction').value = 'Faster responses may come with more errors.'; updated.nodes.get('#research-prediction').oninput(); updated.nodes.get('#research-reveal').onclick();
  assert.match(updated.html, /11\/12/); assert.match(updated.html, /9\/12/);
  updated.nodes.get('#research-filter').value = 'all'; updated.nodes.get('#research-apply').onclick();
  assert.equal(updated.progress.runs.length, 2); assert.equal(updated.progress.runs[1].views.length, 2);
  assert.equal(updated.progress.runs[0].completedAt, completed.completedAt);
  assert.ok([...h.writes, ...reload.writes, ...updated.writes].every(k => k === key), 'Research participation never rewrites lesson completion or other course credit');
  const badSaved = new Map([[key, JSON.stringify({ version: 1, activeId: null, runs: [corrupt] })]]), bad = harness(badSaved);
  await bad.api.open(); assert.equal(bad.invalid, 1); assert.equal(bad.writes.length, 0);
  const moved = harness(); moved.location.href = 'http://localhost/academy'; await moved.api.open(); assert.equal(moved.html, undefined);
  console.log('Research: six design settings, two latency summaries, prediction gating, immutable evidence, reload, frozen models, failed save recovery, comparison requirement, separate credit, corrupt-record preservation and download retry passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
