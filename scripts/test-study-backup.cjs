const assert = require('node:assert/strict');
const fs = require('node:fs');
const Backup = require('../study-backup.js');
const crypto = require('node:crypto').webcrypto;
let checks = 0;
async function test(name, fn) { await fn(); console.log('PASS', name); checks++; }
const options = { crypto, now: '2026-09-07T12:00:00.000Z' };
(async () => {
  await test('Raw study records, Unicode notes and legacy preferences round-trip without rewriting', async () => {
    const data = { 'cs-neuro': '{ "code": {"x": {"draft": "def f(x):\\n    return x < 2"}}, "note": "α → β" }', 'cs-mcat-log': '[{"correct":false}]', 'cs-mode': 'timed', 'cs-seen-ver': '2.4.0-local.1' };
    const text = await Backup.create(data, '2.4.0-local.1', options), file = await Backup.parse(text, options);
    assert.deepEqual(file.data, data); assert.equal(file.createdAt, options.now); assert.equal(file.scope, 'active-workspace');
    assert.deepEqual(Object.keys(JSON.parse(text)).sort(), ['appVersion','createdAt','data','format','scope','sha256','version']);
  });
  await test('Integrity covers metadata and raw data, independent of record ordering', async () => {
    const text = await Backup.create({ 'cs-mode': 'timed', 'cs-diff': 'all' }, 'test', options), file = JSON.parse(text);
    file.data = Object.fromEntries(Object.entries(file.data).reverse()); await Backup.parse(JSON.stringify(file), options);
    file.data['cs-mode'] = 'untimed'; await assert.rejects(Backup.parse(JSON.stringify(file), options), /integrity/i);
    const metadata = JSON.parse(text); metadata.appVersion = 'changed'; await assert.rejects(Backup.parse(JSON.stringify(metadata), options), /integrity/i);
  });
  await test('Future formats, recovery files, truncated JSON and oversized files are rejected', async () => {
    const file = JSON.parse(await Backup.create({}, 'test', options)); file.version = 2;
    await assert.rejects(Backup.parse(JSON.stringify(file), options), /supported/);
    await assert.rejects(Backup.parse('{"owner":"guest","device":{}}', options), /supported/);
    await assert.rejects(Backup.parse('{', options), /JSON/);
    await assert.rejects(Backup.parse(' '.repeat(Backup.MAX_BYTES + 1), options), /16 MB/);
  });
  await test('Unknown records, tokens, malformed JSON, wrong root shapes and prototype keys are rejected', async () => {
    for (const data of [{ 'sb-session': 'secret' }, { 'cs-sync-meta': '{}' }, { 'cs-future-data': '{}' }, { 'cs-mcat-v2': '{' }, { 'cs-neuro': '[]' }, { 'cs-mcat-log': '{}' }, { 'cs-neuro': '{"__proto__":{"pwned":true}}' }, { 'cs-neuro': '{"x":{"constructor":{}}}' }]) await assert.rejects(Backup.create(data, 'test', options));
    assert.equal({}.pwned, undefined);
  });
  await test('Unsafe source protocols, injected IDs, nonfinite values and excessive nesting are rejected', async () => {
    for (const value of ['{"url":"javascript:alert(1)"}', '{"href":"data:text/html,test"}', '{"url":"https://example.org/\\" onclick=bad"}', '{"id":"x\\" onfocus=bad"}', '{"x":1e999}']) await assert.rejects(Backup.create({ 'cs-neuro': value }, 'test', options));
    let deep = {}; for (let i = 0; i < 70; i++) deep = { child: deep }; await assert.rejects(Backup.create({ 'cs-neuro': JSON.stringify(deep) }, 'test', options), /complex/);
    await Backup.create({ 'cs-neuro': '{"url":"https://example.org/paper","draft":"return x < 2"}' }, 'test', options);
  });
  await test('HTML requires the inert formatting validator and never silently changes stored wording', async () => {
    const data = { 'cs-cogpsych': '{"lesson":{"html":"<p>First <b>answer</b>.</p>"}}' };
    await assert.rejects(Backup.create(data, 'test', options), /HTML/);
    const o = { ...options, checkMarkup: value => value === '<p>First <b>answer</b>.</p>' };
    assert.deepEqual((await Backup.parse(await Backup.create(data, 'test', o), o)).data, data);
    await assert.rejects(Backup.create({ 'cs-cogpsych': '{"html":"<script>alert(1)</script>"}' }, 'test', o), /HTML/);
    const document = { createElement: () => ({ set innerHTML(value) { this.value = value; }, content: { querySelectorAll: () => [{ tagName: 'P', attributes: [] }, { tagName: 'B', attributes: [{ name: 'onclick' }] }] } }) };
    assert.equal(Backup.safeMarkup('<p><b onclick="x">unsafe</b></p>', document), false);
  });
  await test('Learner free text with angle-bracket shorthand exports verbatim and restores', async () => {
    const { JSDOM } = require('jsdom'), doc = new JSDOM('').window.document, o = { ...options, checkMarkup: value => Backup.safeMarkup(value, doc) };
    assert.equal(Backup.safeMarkup('Na<K and K>Cl', doc), false, 'the HTML parser reads <K and K> as a start tag, so this is why learner text is exempt');
    const data = {
      'cs-clinical-shift-v1': '{"version":1,"active":{"note":{"assessment":"Na<K and K>Cl in this patient","plan":"Replete K<3.5 first"},"drafts":{},"differential":{"rationale":"<3 hours of symptoms"}},"history":[{"encounter":{"note":{"assessment":"HCO3<18"}}}]}',
      'cs-mcat-course-v1': '{"units":{"u1":{"notes":"Km<Ka means higher affinity"}}}',
      'cs-cogpsych': '{"lessons":{"l1":{"steps":{"0":{"draft":"RT<200 ms is implausible","content":{"body":"<p>Authored</p>"}}}}}}',
      'cs-clinical-longitudinal-v1': '{"runs":[{"fields":{"hypothesis":"Cr<1 excludes AKI","uncertainty":"pH<7.3?"}}]}',
      'cs-mcat-v2': '{"coach":{"active":{"notes":["p<0.05 only tells us","<not> the effect size"]}}}',
      'cs-mcat-passage-reviews': '{"cars:1":{"draft":{"rationale":"Author claims x<y"}}}',
      'cs-academy-anatomy-v1': '{"lessons":{"a":{"draft":"<2 cm nodes","firstDraft":"<2 cm","comparison":"I said <2 cm"}}}',
      'cs-ekg': '{"records":{"e1":{"draft":"PR<120 ms","comparison":"QRS<100 ms"}}}',
      'cs-neuro': '{"sims":{"s1":{"debrief":"threshold<-55 mV"}}}',
      'cs-cogpsych-research-v1': '{"runs":[{"prediction":"d<0.2","note":"n<30"}]}',
    };
    const text = await Backup.create(data, 'test', o); assert.deepEqual((await Backup.parse(text, o)).data, data);
    // The same shorthand without any markup validator is also fine: nothing is parsed as HTML.
    await Backup.create({ 'cs-clinical-shift-v1': data['cs-clinical-shift-v1'] }, 'test', options);
  });
  await test('Authored snapshot fields still reject script, image and event-handler markup on export and on restore', async () => {
    const { JSDOM } = require('jsdom'), doc = new JSDOM('').window.document, o = { ...options, checkMarkup: value => Backup.safeMarkup(value, doc) };
    for (const html of ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '<p onclick="x">hi</p>', '<a href="javascript:alert(1)">x</a>', '<b id="steal">x</b>']) {
      const data = { 'cs-cogpsych': JSON.stringify({ lessons: { l1: { steps: { 0: { content: { body: html }, draft: 'ok' } } } } }) };
      await assert.rejects(Backup.create(data, 'test', o), error => /no backup was prepared/.test(error.message) && /cs-cogpsych/.test(error.message) && !/restored/.test(error.message));
      // A hand-built file that skipped the export check is still refused when restoring.
      const forged = JSON.parse(await Backup.create(data, 'test', { ...options, checkMarkup: () => true }));
      await assert.rejects(Backup.parse(JSON.stringify(forged), o), /unsupported HTML.*not been restored/);
    }
    assert.equal(Backup.safeMarkup('<p>First <b>answer</b>.</p>', doc), true);
    const inert = { 'cs-cogpsych': '{"lessons":{"l1":{"steps":{"0":{"content":{"body":"<p>First <b>answer</b>.</p>"}}}}}}' };
    assert.deepEqual((await Backup.parse(await Backup.create(inert, 'test', o), o)).data, inert);
  });
  await test('All five existing MCAT resume kinds remain portable', async () => {
    const data = Object.fromEntries(['flash','drill','cars','plab','sim'].map(k => ['cs-mcat-r-' + k, '{"idx":1,"results":[]}']));
    assert.deepEqual((await Backup.parse(await Backup.create(data, 'test', options), options)).data, data);
  });
  await test('Current authored full-content snapshots fit portable structural checks', async () => {
    for (const name of ['mcat-course','neuro','anatomy-foundations','medicine-foundations']) {
      const data = { 'cs-neuro': JSON.stringify({ snapshot: JSON.parse(fs.readFileSync('data/' + name + '.json')) }) };
      await Backup.create(data, 'test', options);
    }
  });
  console.log(`${checks} portable backup checks passed. DOM parsing and browser file dialogs remain browser-test work.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
