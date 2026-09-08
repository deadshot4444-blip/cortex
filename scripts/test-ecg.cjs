const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ECGTrace = require('../ecg-engine.js');
const catalog = JSON.parse(fs.readFileSync('data/ecg-patterns.json'));
const source = fs.readFileSync('ekg.js', 'utf8');
const close = (actual, expected, epsilon = 0.0002) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} should be close to ${expected}`);
const plain = value => JSON.parse(JSON.stringify(value));
function harness(saved = new Map(), data = structuredClone(catalog)) {
  let failed = false,
    invalid = 0,
    writes = 0,
    screen,
    fetchOK = true,
    fetchGate;
  const location = new URL('http://localhost/medicine?gates=prod');
  const listeners = new Map(),
    watched = new Map();
  function node(html = '') {
    const elements = new Map();
    const result = {
      html,
      children: [],
      disabled: false,
      value: '',
      dataset: {},
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
      },
      querySelectorAll(selector) {
        if (elements.has(selector)) return elements.get(selector);
        const attr = selector.startsWith('#') ? 'id' : selector.slice(1, -1);
        const matches = [...html.matchAll(new RegExp(`<[^>]+\\b${attr}="([^"]+)"[^>]*>`, 'g'))].filter(
          match => !selector.startsWith('#') || match[1] === selector.slice(1)
        );
        const found = matches.map(match => {
          const child = node('');
          if (attr.startsWith('data-'))
            child.dataset[attr.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = match[1];
          child.disabled = /\bdisabled\b/.test(match[0]);
          return child;
        });
        elements.set(selector, found);
        return found;
      },
      find(selector) {
        return (
          this.querySelector(selector) ||
          this.children.map(child => child.find?.(selector)).find(Boolean) ||
          [...elements.values()]
            .flat()
            .map(child => child.find(selector))
            .find(Boolean)
        );
      },
    };
    return result;
  }
  const storage = {
    paused: false,
    read: (key, fallback) => (saved.has(key) ? JSON.parse(saved.get(key)) : fallback),
    watch: (key, current) => watched.set(key, current),
    sessionFailed() {
      invalid++;
      storage.paused = true;
    },
    write(key, value) {
      writes++;
      if (failed) {
        storage.paused = true;
        return false;
      }
      if (storage.paused) return false;
      saved.set(key, JSON.stringify(value));
      return true;
    },
  };
  const context = vm.createContext({
    console,
    JSON,
    Date,
    Math,
    Set,
    URL,
    URLSearchParams,
    ECGTrace,
    StudyStorage: storage,
    location,
    MED_VIEW: 0,
    window: {
      addEventListener(name, listener) {
        listeners.set(name, listener);
      },
    },
    history: {
      replaceState(_, __, path) {
        location.href = new URL(path, location).href;
      },
    },
    sectionUrl: () => '/medicine?gates=prod',
    medicineHome() {},
    fetch: async () => {
      if (fetchGate) await fetchGate;
      return { ok: fetchOK, json: async () => data };
    },
    el: node,
    esc: value => String(value).replaceAll('<', '&lt;'),
    topbar: () => node(),
    setView: value => {
      screen = value;
    },
  });
  vm.runInContext(source, context);
  return {
    context,
    run: code => vm.runInContext(code, context),
    saved,
    storage,
    watched,
    listeners,
    location,
    get screen() {
      return screen;
    },
    get invalid() {
      return invalid;
    },
    get writes() {
      return writes;
    },
    set fail(value) {
      failed = value;
    },
    set fetchOK(value) {
      fetchOK = value;
    },
    set fetchGate(value) {
      fetchGate = value;
    },
  };
}

test('all twenty traces are deterministic, bounded, explicitly calibrated and independently described', () => {
  assert.deepEqual(catalog.patterns.map(item => item.id).sort(), [...ECGTrace.kinds].sort());
  for (const kind of ECGTrace.kinds) {
    const t = ECGTrace.create(kind);
    assert.ok(ECGTrace.valid(t));
    assert.deepEqual(t, ECGTrace.create(kind));
    assert.equal(t.values.length, 1501);
    const markup = ECGTrace.markup(t);
    assert.match(markup, /0.04 s × 0.1 mV/);
    assert.match(markup, /Time \(s\)/);
    assert.match(markup, /Voltage \(mV\)/);
    assert.doesNotMatch(markup, /preserveAspectRatio="none"/);
    assert.match(markup, /Synthetic ECG/);
  }
  const a = ECGTrace.markup(ECGTrace.create('sinus')),
    b = ECGTrace.markup(ECGTrace.create('sinus'));
  assert.notEqual(a.match(/pattern id="([^"]+)"/)[1], b.match(/pattern id="([^"]+)"/)[1]);
});
test('timing gives the authored regular rates and durations', () => {
  for (const [kind, rr] of [
    ['sinus', 0.8],
    ['brady', 1.25],
    ['tachy', 0.48],
    ['svt', 1 / 3],
    ['junctional', 1.2],
    ['vt', 0.36],
    ['paced', 1],
  ]) {
    const q = ECGTrace.create(kind).qrs;
    close(q[1].peak - q[0].peak, rr);
  }
  const q = ECGTrace.create('sinus').qrs[0];
  close(q.start - q.p, 0.16);
  close(q.end - q.start, 0.08);
  close(ECGTrace.create('avb1').qrs[0].start - ECGTrace.create('avb1').qrs[0].p, 0.26);
});
test('AV block models retain regular atrial timing, dropped conduction and separate clocks', () => {
  const one = ECGTrace.create('mobitz1'),
    two = ECGTrace.create('mobitz2'),
    complete = ECGTrace.create('chb');
  for (let i = 1; i < one.atrial.length; i++) close(one.atrial[i] - one.atrial[i - 1], 0.8);
  one.qrs.slice(0, 3).forEach((q, i) => close(q.start - q.p, [0.16, 0.2, 0.24][i]));
  assert.ok(!one.qrs.some(q => q.p === one.atrial[3]));
  assert.ok(one.atrial.length > one.qrs.length);
  two.qrs.forEach(q => close(q.start - q.p, 0.16));
  assert.ok(!two.qrs.some(q => q.p === two.atrial[2]));
  assert.ok(complete.qrs.every(q => q.p === null));
  close(complete.qrs[1].start - complete.qrs[0].start, 1.45);
  assert.ok(Math.abs(1.45 / 0.8 - 2) > 0.1, 'the escape period must not approximate 2:1 conduction');
  const gaps = complete.qrs.map(q => q.start - complete.atrial.filter(p => p < q.start).at(-1));
  assert.ok(
    Math.max(...gaps) - Math.min(...gaps) > 0.3,
    `P-to-QRS intervals must march through, got ${gaps.map(g => g.toFixed(2))}`
  );
  const overlaps = complete.atrial.filter(p => complete.qrs.some(q => p < q.end + 0.06 + 0.24 && p + 0.08 > q.start));
  assert.deepEqual(overlaps, [3.34, 4.94]);
  assert.match(complete.description, /3\.34 s and 4\.94 s/);
});
test('narrow-complex traces model an adult-range QT that ends before the next P wave', () => {
  for (const [kind, low, high] of [
    ['sinus', 0.36, 0.4],
    ['brady', 0.4, 0.44],
    ['junctional', 0.4, 0.44],
    ['avb1', 0.36, 0.4],
    ['stemi', 0.36, 0.4],
    ['hyperk', 0.32, 0.36],
  ]) {
    const t = ECGTrace.create(kind),
      q = t.qrs[0],
      limit = Math.min(t.atrial.find(p => p > q.end) ?? 6, t.qrs[1].start);
    let last = q.end;
    for (let i = Math.round(q.end * t.sampleRate) + 1; i < Math.round(limit * t.sampleRate); i++)
      if (Math.abs(t.values[i]) > 1e-6) last = i / t.sampleRate;
    assert.ok(last - q.start >= low && last - q.start <= high, `${kind} QT ${(last - q.start).toFixed(3)} s`);
    assert.ok(last < limit - 0.05, `${kind} T wave must end before the next event`);
  }
});
test('pre-excitation contains a measurable initial slur; ST signal is continuous at QRS end', () => {
  const wpw = ECGTrace.create('wpw'),
    q = wpw.qrs[0];
  close(q.start - q.p, 0.1);
  close(q.end - q.start, 0.14);
  const at = (t, time) => t.values[Math.round(time * t.sampleRate)];
  close(at(wpw, q.start + 0.02), 0.11, 0.002);
  close(at(wpw, q.start + 0.04), 0.22, 0.002);
  const st = ECGTrace.create('stemi'),
    end = st.qrs[0].end;
  close(at(st, end), 0.2);
  close(at(st, end + 0.004), 0.2);
});
test('polymorphic trace changes polarity, ectopy has expected onset timing and AF is irregular', () => {
  const t = ECGTrace.create('torsades');
  assert.ok(t.values.some(v => v > 1));
  assert.ok(t.values.some(v => v < -1));
  const peaks = t.qrs.map(q =>
    Math.max(...t.values.slice(Math.round(q.start * t.sampleRate), Math.round(q.end * t.sampleRate) + 1).map(Math.abs))
  );
  assert.ok(
    peaks.every(peak => peak >= 0.4),
    `every torsades complex stays visible, smallest ${Math.min(...peaks).toFixed(3)} mV`
  );
  assert.ok(peaks.length === 22 && t.qrs.every((q, i) => !i || Math.abs(q.start - t.qrs[i - 1].start - 0.27) < 0.001));
  assert.match(t.context, /preceding ECG.*prolonged QT/);
  assert.match(t.description, /no measurable.*QT/);
  const pvc = ECGTrace.create('pvc').qrs;
  close(pvc[3].start - pvc[2].start, 0.52);
  close(pvc[4].start - pvc[3].start, 1.08);
  const table = ECGTrace.markup(ECGTrace.create('pvc'));
  assert.match(table, /QRS onset to onset/);
  assert.match(table, /<td>0\.520<\/td>/);
  assert.match(table, /<td>1\.080<\/td>/);
  const af = ECGTrace.create('afib').qrs;
  assert.ok(new Set(af.slice(1).map((q, i) => (q.start - af[i].start).toFixed(2))).size > 4);
});
test('damaged traces are rejected and text alternatives escape imported markup', () => {
  const t = ECGTrace.create('sinus');
  t.values[1] = NaN;
  assert.equal(ECGTrace.valid(t), false);
  t.values[1] = 4;
  assert.equal(ECGTrace.valid(t), false);
  const text = ECGTrace.create('sinus');
  text.description = '<script>bad()</script>';
  assert.doesNotMatch(ECGTrace.markup(text), /<script>/);
  assert.match(ECGTrace.markup(text), /&lt;script&gt;/);
});
test('legacy counts and review marks are retained without invented explanation history', async () => {
  const legacy = {
    drill: { correct: 4, total: 7 },
    byCat: { Sinus: { correct: 2, total: 3 } },
    reviewed: ['sinus', 'afib'],
  };
  const h = harness(new Map([['cs-ekg', JSON.stringify(legacy)]]));
  assert.equal(h.invalid, 0);
  assert.deepEqual(plain(h.run('EKG_PROG.drill')), legacy.drill);
  assert.equal(h.run('Object.keys(EKG_PROG.records).length'), 0);
  assert.equal(h.run('ekgHubStats().reviewed'), 2);
  await h.run('loadEkg()');
  assert.ok(h.run('EKG_DATA.patterns.every(validEkgPattern)'));
  assert.match(
    h.run("ekgSources(EKG_DATA.patterns.find(item => item.id === 'sinus'))"),
    /MSD Manual: Electrocardiography<\/a> · accessed 2026-09-07/
  );
  assert.doesNotMatch(h.run("ekgSources({ sources: [{ title: 'Undated', url: 'https://example.org' }] })"), /accessed/);
  assert.match(h.run("EKG_DATA.patterns.find(item => item.id === 'chb').rate"), /About 41/);
  for (const id of ['avb1', 'wpw'])
    assert.match(h.run(`EKG_DATA.patterns.find(item => item.id === '${id}').clue`), /120–200 ms/);
  for (const id of ['wpw', 'mobitz2', 'svt', 'vt'])
    assert.match(h.run(`EKG_DATA.patterns.find(item => item.id === '${id}').clue`), /120 ms/);
});
test('explanations gate first choice, answer is immutable, comparison gates completion', async () => {
  const h = harness();
  await h.run("renderEKG('drill')");
  const record = h.run('EKG_PROG.records[EKG_PROG.active]');
  const id = record.id;
  assert.match(h.location.search, /record=ecg-/);
  assert.match(h.location.search, /gates=prod/);
  const reason = h.screen.find('#ekgreason');
  assert.ok(reason);
  assert.equal(
    h.run('answerEkg(EKG_PROG.records[EKG_PROG.active], EKG_PROG.records[EKG_PROG.active].content.id)'),
    false
  );
  reason.value = 'QRS timing and width support my choice; pulse and other leads are missing.';
  reason.oninput();
  const pick = h.screen.find('[data-pick]');
  const first = pick.dataset.pick;
  pick.onclick();
  await new Promise(setImmediate);
  assert.equal(record.selected, first);
  assert.equal(record.firstExplanation, reason.value);
  assert.equal(h.run('EKG_PROG.drill.total'), 1);
  h.run('answerEkg(EKG_PROG.records[EKG_PROG.active], EKG_PROG.records[EKG_PROG.active].content.id)');
  assert.equal(record.selected, first);
  assert.equal(h.run('completeEkg(EKG_PROG.records[EKG_PROG.active])'), false);
  const comparison = h.screen.find('#ekgcomparison');
  comparison.value = 'I agree with the measured pattern but cannot prove its cause from this strip.';
  comparison.oninput();
  h.screen.find('#ekgfinish').onclick();
  await new Promise(setImmediate);
  assert.ok(record.completedAt);
  const time = record.completedAt;
  h.run('completeEkg(EKG_PROG.records[EKG_PROG.active])');
  assert.equal(record.completedAt, time);
  assert.equal(JSON.parse(h.saved.get('cs-ekg')).records[id].firstExplanation, reason.value);
});
test('failed answer save stays recoverable and cannot double-count on retry', async () => {
  const h = harness();
  await h.run("renderEKG('drill')");
  h.run("EKG_PROG.records[EKG_PROG.active].draft='A measured description before feedback.'; saveEkgProg()");
  const before = h.saved.get('cs-ekg');
  h.fail = true;
  assert.equal(
    h.run('answerEkg(EKG_PROG.records[EKG_PROG.active], EKG_PROG.records[EKG_PROG.active].content.id)'),
    false
  );
  assert.equal(h.saved.get('cs-ekg'), before);
  assert.equal(h.watched.get('cs-ekg')().drill.total, 1);
  assert.equal(
    h.run('answerEkg(EKG_PROG.records[EKG_PROG.active], EKG_PROG.records[EKG_PROG.active].content.id)'),
    false
  );
  h.fail = false;
  h.storage.paused = false;
  h.run('saveEkgProg()');
  await h.run("renderEKG('drill')");
  assert.equal(h.run('EKG_PROG.drill.total'), 1);
  assert.ok(h.screen.find('#ekgcomparison'));
});
test('reload preserves exact content, trace, options and writing after a catalog revision', async () => {
  const h = harness();
  await h.run("renderEKG('drill')");
  h.run("EKG_PROG.records[EKG_PROG.active].draft='My saved explanation.'; saveEkgProg()");
  const before = plain(h.run('EKG_PROG.records[EKG_PROG.active]'));
  const changed = structuredClone(catalog);
  changed.patterns.forEach(item => {
    item.name = 'Revised name';
    item.clue = 'Revised explanation';
  });
  const next = harness(h.saved, changed);
  await next.run("renderEKG('drill')");
  assert.deepEqual(plain(next.run('EKG_PROG.records[EKG_PROG.active]')), before);
});
test('category changes and repeated start cannot discard an unfinished exercise', async () => {
  const h = harness();
  await h.run('loadEkg()');
  h.run('newEkgRecord()');
  const id = h.run('EKG_PROG.active');
  h.run("EKG_PROG.category='Blocks'; newEkgRecord()");
  assert.equal(h.run('EKG_PROG.active'), id);
  assert.equal(h.run('Object.keys(EKG_PROG.records).length'), 1);
});
test('failed new-exercise save leaves its recovery route on the pending record', async () => {
  const h = harness();
  await h.run('loadEkg()');
  h.fail = true;
  assert.equal(h.run('newEkgRecord()'), null);
  assert.equal(new URLSearchParams(h.location.search).get('record'), h.run('EKG_PROG.active'));
  assert.equal(h.watched.get('cs-ekg')().active, h.run('EKG_PROG.active'));
  assert.equal(h.saved.size, 0);
});
test('malformed saved sessions pause without writes; failed downloads retry; late downloads do not replace another route', async () => {
  const bad = harness(new Map([['cs-ekg', JSON.stringify({ drill: { correct: 3, total: 1 } })]]));
  assert.equal(bad.invalid, 1);
  assert.equal(bad.writes, 0);
  const h = harness();
  h.fetchOK = false;
  await assert.rejects(h.run('loadEkg()'), /did not download/);
  h.fetchOK = true;
  await h.run('loadEkg()');
  const slow = harness();
  let finish;
  slow.fetchGate = new Promise(resolve => {
    finish = resolve;
  });
  const render = slow.run("renderEKG('drill')");
  slow.location.pathname = '/neuro';
  finish();
  await render;
  assert.equal(slow.screen, undefined);
  assert.equal(slow.writes, 0);
  const sameRoute = harness();
  let finishSecond;
  sameRoute.fetchGate = new Promise(resolve => {
    finishSecond = resolve;
  });
  const pending = sameRoute.run("renderEKG('drill')");
  sameRoute.run('MED_VIEW++');
  finishSecond();
  await pending;
  assert.equal(
    sameRoute.screen,
    undefined,
    'A late ECG download cannot replace another Medicine tool on the same route'
  );
  assert.equal(sameRoute.writes, 0);
});
