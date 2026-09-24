/* Synthetic storage faults against the real DAT runners and StudyStorage. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

function harness(records = {}) {
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', {
    url: 'http://localhost/dat',
    runScripts: 'outside-only',
  });
  const w = dom.window,
    ctx = dom.getInternalVMContext();
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  for (const [key, raw] of Object.entries(records)) w.localStorage.setItem(key, raw);
  Object.assign(w, {
    LETTERS: ['A', 'B', 'C', 'D', 'E', 'F'],
    IS_LOCAL_PREVIEW: true,
    confirm: () => false,
    sectionUrl: key => '/' + key,
    stopTimer() {},
    esc: value =>
      String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
    el: html => {
      const t = w.document.createElement('template');
      t.innerHTML = html;
      return t.content.firstElementChild;
    },
    setView: node => w.document.querySelector('#app').replaceChildren(node),
    topbar: () => w.el('<header>Cortex</header>'),
    fetch: async file => {
      const p = file.split('?')[0];
      return fs.existsSync(p) ? { ok: true, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) } : { ok: false };
    },
  });
  for (const file of [
    'academy.js',
    'study-storage.js',
    'dat.js',
    'dat-drill-engine.js',
    'dat-practice.js',
    'dat-pat-engine.js',
    'dat-pat.js',
    'dat-rc.js',
    'dat-calc-engine.js',
    'dat-qr.js',
  ])
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
  return {
    w,
    S: vm.runInContext('StudyStorage', ctx),
    go(query) {
      w.history.replaceState({}, '', '/dat?' + query);
      return w.renderDATEntry();
    },
    find: sel => w.document.querySelector(sel),
    raw: key => w.localStorage.getItem(key),
    snapshot: () => Object.fromEntries(Object.keys(w.localStorage).map(key => [key, w.localStorage.getItem(key)])),
    close: () => w.close(),
  };
}
const routes = [
  ['drill', 'view=drill&section=bio&n=2&mode=untimed', '.dat-opt'],
  ['pat', 'view=pat&subtest=holes&level=2', '.dat-pat-opt'],
  ['qr', 'view=qr&n=2&mode=untimed', '.dat-qr-opt'],
  ['rc', 'view=rc&passage=dat-rc-salivary', '.dat-rc-opt'],
];
// Use the actual first passage id, so the test survives content additions.
routes[3][1] = 'view=rc&passage=' + JSON.parse(fs.readFileSync('data/dat-rc.json')).passages[0].id;
const qrItems = new Map(
  [1, 2, 3].flatMap(layer =>
    JSON.parse(fs.readFileSync(`data/dat-questions-qr-${layer}.json`)).items.map(item => [item.id, item])
  )
);

for (const [kind, query, selector] of routes) {
  test(`${kind} healthy saved answers survive a fresh runner without a replacement prompt`, async () => {
    const source = harness();
    let snapshot;
    try {
      await source.go(query);
      source.find(selector).click();
      snapshot = source.snapshot();
    } finally {
      source.close();
    }
    const restored = harness(snapshot),
      key = 'cs-dat-r-' + kind,
      before = JSON.parse(snapshot[key]);
    try {
      restored.w.confirm = () => assert.fail('matching saved work must resume without replacement');
      await restored.go(query);
      const after = JSON.parse(restored.raw(key));
      assert.equal(restored.S.paused, false);
      assert.equal(restored.find('#study-save-conflict'), null);
      assert.ok(restored.find(selector));
      for (const field of ['attemptId', 'startedAt', 'idx', 'ids', 'qs', 'orders', 'answers', 'results'])
        assert.deepEqual(after[field], before[field], field + ' survives reload');
      if (kind !== 'rc') assert.equal(restored.find(selector).disabled, true, 'saved answer is revealed');
      if (kind === 'pat') assert.ok(restored.find('.dat-pat-explanation'), 'seeded PAT feedback is restored');
    } finally {
      restored.close();
    }
  });
}

const rcBank = JSON.parse(fs.readFileSync('data/dat-rc.json'));
const replacements = [
  [
    'science section',
    'drill',
    routes[0][1],
    'view=drill&section=gchem&n=2&mode=untimed',
    '.dat-opt',
    '.dat-drill-setup',
    'drill',
  ],
  [
    'QR shape',
    'qr',
    'view=qr&n=4&mode=untimed&format=standard',
    'view=qr&n=4&mode=untimed&format=qc',
    '.dat-qr-opt',
    '.dat-qr-setup',
    'qr',
  ],
  ['PAT subtest', 'pat', routes[1][1], 'view=pat&subtest=angles&level=2', '.dat-pat-opt', '.dat-pat-picker', 'pat'],
  ['PAT level', 'pat', routes[1][1], 'view=pat&subtest=holes&level=3', '.dat-pat-opt', '.dat-pat-picker', 'pat'],
  ['PAT full form', 'pat', routes[1][1], 'view=pat&set=full&level=2', '.dat-pat-opt', '.dat-pat-picker', 'pat'],
  ['PAT full to single', 'pat', 'view=pat&set=full&level=2', routes[1][1], '.dat-pat-opt', '.dat-pat-picker', 'pat'],
  ['RC passage', 'rc', routes[3][1], 'view=rc&passage=' + rcBank.passages[1].id, '.dat-rc-opt', '.dat-rc-picker', 'rc'],
  ['RC set', 'rc', routes[3][1], 'view=rc&set=' + rcBank.sets[0].id, '.dat-rc-opt', '.dat-rc-picker', 'rc'],
];
for (const [label, kind, original, target, selector, picker, safeView] of replacements) {
  test(`${label} replacement requires consent and cancellation preserves the exact unfinished save`, async () => {
    const source = harness();
    let snapshot;
    try {
      await source.go(original);
      source.find(selector).click();
      snapshot = source.snapshot();
    } finally {
      source.close();
    }
    const key = 'cs-dat-r-' + kind,
      originalId = JSON.parse(snapshot[key]).attemptId;
    for (const accept of [false, true]) {
      const h = harness(snapshot),
        prompts = [];
      try {
        h.w.confirm = message => {
          prompts.push(message);
          return accept;
        };
        await h.go(target);
        assert.equal(prompts.length, 1);
        assert.match(prompts[0], /Replace your unfinished/);
        assert.equal(h.S.paused, false);
        if (accept) {
          assert.ok(h.find(selector));
          assert.notEqual(JSON.parse(h.raw(key)).attemptId, originalId);
          assert.equal(
            h.raw('cs-dat-log'),
            snapshot['cs-dat-log'] ?? null,
            'replacing a session retains recorded answers'
          );
        } else {
          assert.equal(h.raw(key), snapshot[key]);
          assert.ok(h.find(picker));
          assert.equal(h.w.location.search, '?view=' + safeView);
          assert.equal(h.find(selector), null, 'cancellation does not expose a new runner');
          await h.go(original);
          assert.equal(prompts.length, 1, 'the old session resumes without another prompt');
          assert.equal(JSON.parse(h.raw(key)).attemptId, originalId);
          assert.ok(h.find(selector));
        }
      } finally {
        h.close();
      }
    }
  });
}

test('switching review filters requires consent and never replaces a regular drill', async () => {
  const source = harness();
  let snapshot;
  try {
    await source.go(routes[0][1]);
    source.find('.dat-opt').click();
    snapshot = source.snapshot();
    const srs = JSON.parse(snapshot['cs-dat-srs'] || '{}'),
      questions = source.w.eval('DAT.questions');
    for (const section of ['bio', 'qr'])
      source.w.DatDrillCore.enroll(
        srs,
        questions.find(q => q.section === section),
        0
      );
    snapshot['cs-dat-srs'] = JSON.stringify(srs);
  } finally {
    source.close();
  }
  const first = harness(snapshot);
  try {
    await first.go('view=drill&review=1&section=bio');
    first.find('.dat-opt').click();
    snapshot = first.snapshot();
  } finally {
    first.close();
  }
  for (const accept of [false, true]) {
    const h = harness(snapshot);
    let prompts = 0;
    try {
      h.w.confirm = () => {
        prompts++;
        return accept;
      };
      await h.go('view=drill&review=1&section=qr');
      assert.equal(prompts, 1);
      assert.equal(h.raw('cs-dat-r-drill'), snapshot['cs-dat-r-drill']);
      assert.equal(h.raw('cs-dat-log'), snapshot['cs-dat-log']);
      if (accept) {
        const review = JSON.parse(h.raw('cs-dat-r-review'));
        assert.equal(review.filter, 'qr');
        assert.equal(review.source, 'review');
        assert.ok(h.find('.dat-opt'));
      } else {
        assert.equal(h.raw('cs-dat-r-review'), snapshot['cs-dat-r-review']);
        assert.equal(h.w.location.search, '?view=mistakes');
        assert.ok(h.find('#dat-review-resume'));
        await h.go('view=drill&review=1&section=bio');
        assert.equal(prompts, 1);
        assert.ok(h.find('#dat-next'));
      }
    } finally {
      h.close();
    }
  }
});

for (const kind of ['drill', 'qr']) {
  test(`${kind} setup preserves the saved session until replacement is confirmed`, async () => {
    const h = harness(),
      key = 'cs-dat-r-' + kind;
    try {
      await h.go(kind === 'drill' ? routes[0][1] : 'view=qr&n=4&mode=untimed&format=standard');
      h.find(kind === 'drill' ? '.dat-opt' : '.dat-qr-opt').click();
      const saved = h.raw(key);
      await h.go('view=' + kind);
      if (kind === 'drill') h.find('[data-dat-section="gchem"]').click();
      else {
        const format = h.find('#dat-qr-setup-format');
        format.value = 'qc';
        format.dispatchEvent(new h.w.Event('change'));
      }
      let confirmations = 0;
      h.w.confirm = () => {
        confirmations++;
        assert.equal(h.raw(key), saved, 'setup must not clear before asking');
        return false;
      };
      h.find(kind === 'drill' ? '#dat-start' : '#dat-qr-start').click();
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(confirmations, 1);
      assert.equal(h.raw(key), saved);
      assert.equal(h.w.location.search, '?view=' + kind);
    } finally {
      h.close();
    }
  });
}

test('all DAT entry runners preserve damaged attempt stores and expose recovery instead of replacing them', async () => {
  for (const [, query, selector] of routes) {
    for (const [key, raw] of [
      ['cs-dat-log', '[null]'],
      ['cs-dat-q', '[]'],
      ['cs-dat-srs', '{"old":{"due":0}}'],
    ]) {
      const h = harness({ [key]: raw });
      try {
        await h.go(query);
        if (!h.S.paused && h.find(selector)) h.find(selector).click();
        assert.equal(h.S.paused, true, query + ' must pause on ' + key);
        assert.equal(h.raw(key), raw, 'the original damaged record remains recoverable');
        assert.ok(h.find('#study-save-conflict'), 'the recovery dialog is visible');
      } finally {
        h.close();
      }
    }
  }
});

test('damaged science and review resume shapes preserve the stored copy and open recovery', async () => {
  const source = harness();
  await source.go(routes[0][1]);
  const good = JSON.parse(source.raw('cs-dat-r-drill'));
  source.close();
  for (const review of [false, true]) {
    for (const mutate of [
      b => {
        delete b.orders;
      },
      b => {
        b.results = {};
      },
      b => {
        b.shownSets = {};
      },
      b => {
        b.orders[b.qs[0]] = [0, 0];
      },
    ]) {
      const blob = structuredClone(good);
      if (review) Object.assign(blob, { review: true, mode: 'untimed', scope: { section: 'review' }, filter: '' });
      mutate(blob);
      const key = review ? 'cs-dat-r-review' : 'cs-dat-r-drill',
        raw = JSON.stringify(blob);
      const h = harness({ [key]: raw });
      try {
        await h.go(review ? 'view=drill&review=1' : routes[0][1]);
        assert.equal(h.S.paused, true, 'damaged resume must pause');
        assert.equal(h.raw(key), raw, 'do not overwrite a damaged saved session with a new one');
      } finally {
        h.close();
      }
    }
  }
});

test('a quota failure on the log queues history too, so retry persists the complete answer', async () => {
  for (const [kind, query, selector] of routes) {
    const h = harness();
    try {
      await h.go(query);
      const proto = h.w.Storage.prototype,
        original = proto.setItem;
      let fail = true;
      proto.setItem = function (key, value) {
        if (fail && key === 'cs-dat-log') throw new h.w.DOMException('Quota full', 'QuotaExceededError');
        return original.call(this, key, value);
      };
      assert.ok(h.find(selector), query + ' presents an option');
      h.find(selector).click();
      if (kind === 'rc') {
        h.find('#dat-rc-review').click();
        h.find('#dat-rc-end').click();
        for (let i = 0; i < 100 && h.find('#dat-rc-blind-skip'); i++) h.find('#dat-rc-blind-skip').click();
      }
      assert.equal(h.S.paused, true, 'saving pauses on quota failure');
      fail = false;
      assert.equal(h.S.retry(), true);
      const log = JSON.parse(h.raw('cs-dat-log'));
      const hist = JSON.parse(h.raw('cs-dat-q'));
      assert.ok(hist && hist[log[0].qId], query + ' retains history on retry');
      assert.equal(hist[log[0].qId].n, 1);
      if (kind === 'rc') {
        const srs = JSON.parse(h.raw('cs-dat-srs'));
        for (const row of log.filter(row => !row.correct)) assert.ok(srs[row.qId], 'retry preserves every RC miss');
      }
    } finally {
      h.close();
    }
  }
});

for (const mode of ['untimed', 'paced', 'exam']) {
  for (const format of ['', 'standard', 'qc', 'ds', 'data']) {
    test(`QR ${mode}/${format || 'mixed'} resumes real unanswered and answered saves, including published scopes`, async () => {
      const query = `view=qr&n=4&mode=${mode}&format=${format}`;
      const source = harness();
      let snapshots;
      try {
        await source.go(query);
        const initial = JSON.parse(source.raw('cs-dat-r-qr'));
        assert.equal(initial.scope.section, 'qr');
        assert.equal(initial.scope.format, format);
        if (format) assert.ok(initial.qs.every(id => (qrItems.get(id).format || 'standard') === format));
        assert.ok(source.w.DatDrillCore.validDrillResume(initial), 'new QR saves satisfy the shared guard');
        const unanswered = source.snapshot();
        source.find('[data-dat-qr-conf="sure"]').click();
        source.find('.dat-qr-opt').click();
        const answered = source.snapshot();
        assert.equal(JSON.parse(answered['cs-dat-r-qr']).results[0].conf, 'sure');
        snapshots = [unanswered, answered];
      } finally {
        source.close();
      }
      for (const snapshot of snapshots) {
        for (const legacy of [false, true]) {
          const saved = JSON.parse(snapshot['cs-dat-r-qr']);
          // c935a33 writes source:'qr' and scope:{category,format}; it has no section.
          if (legacy) delete saved.scope.section;
          const raw = JSON.stringify(saved),
            restored = harness({ ...snapshot, 'cs-dat-r-qr': raw });
          try {
            if (legacy) {
              await restored.go('view=qr');
              assert.equal(restored.S.paused, false);
              assert.ok(restored.find('#dat-qr-resume'), 'the setup page offers the published session');
              assert.equal(restored.raw('cs-dat-r-qr'), raw, 'setup preserves the original legacy record');
            }
            await restored.go(query);
            assert.equal(restored.S.paused, false, 'healthy saved work must not open recovery');
            assert.equal(restored.find('#study-save-conflict'), null);
            const after = JSON.parse(restored.raw('cs-dat-r-qr'));
            for (const field of ['attemptId', 'qs', 'orders', 'idx', 'mode', 'seed', 'paceSeconds', 'startedAt'])
              assert.deepEqual(after[field], saved[field], field + ' survives a fresh runner');
            assert.deepEqual(
              after.qs.map((id, i) => after.results[i] || null),
              saved.qs.map((id, i) => saved.results[i] || null),
              'answers stay attached to their original questions'
            );
            const answered = !!saved.results[0];
            assert.equal(restored.find('.dat-qr-opt').disabled, answered);
            assert.equal(!!restored.find('#dat-qr-next'), answered);
            if (format === 'data') assert.ok(restored.find('.dat-qr-item .dat-data-table'));
            if (answered) assert.ok(restored.find('[data-dat-qr-conf="sure"].active'));
            if (mode === 'exam') {
              assert.ok(after._remain > 0 && after._remain <= saved._remain, 'resume preserves the remaining clock');
            }
            if (answered) {
              assert.equal(restored.raw('cs-dat-r-qr'), raw, 'reading an answered legacy save does not rewrite it');
              restored.find('#dat-qr-next').click();
              const next = JSON.parse(restored.raw('cs-dat-r-qr'));
              assert.equal(next.scope.section, 'qr', 'the next normal write uses the canonical scope');
              assert.equal(next.idx, 1);
              assert.deepEqual(next.results[0], saved.results[0]);
            }
          } finally {
            restored.close();
          }
        }
      }
    });
  }
}

test('QR rejects malformed and foreign scopes without rewriting the original resume', async () => {
  const source = harness();
  await source.go('view=qr&n=4&mode=untimed');
  const good = JSON.parse(source.raw('cs-dat-r-qr'));
  source.close();
  for (const mutate of [
    b => delete b.source,
    b => (b.source = 'review'),
    b => (b.source = 'drill'),
    b => (b.scope = []),
    b => (b.scope = null),
    b => (b.scope.section = 'bio'),
    b => (b.scope.section = null),
    b => delete b.scope.category,
    b => (b.scope.category = []),
    b => delete b.scope.format,
    b => (b.scope.format = {}),
    b => (b.scope.format = 'constructor'),
    b => (b.orders = null),
  ]) {
    for (const legacy of [false, true]) {
      const blob = structuredClone(good);
      if (legacy) delete blob.scope.section;
      mutate(blob);
      const raw = JSON.stringify(blob),
        h = harness({ 'cs-dat-r-qr': raw });
      try {
        await h.go('view=qr&n=4&mode=untimed');
        assert.equal(h.S.paused, true);
        assert.ok(h.find('#study-save-conflict'));
        assert.equal(h.raw('cs-dat-r-qr'), raw, 'keep the malformed record for recovery');
      } finally {
        h.close();
      }
    }
  }
});

test('resuming a published QR save and reviewing its missed item preserve the other runner sessions', async () => {
  const source = harness(),
    otherSessions = {};
  let snapshot;
  try {
    for (const [kind, query, selector] of routes.filter(([kind]) => kind !== 'qr')) {
      await source.go(query);
      source.find(selector).click();
      const key = 'cs-dat-r-' + kind;
      otherSessions[key] = source.raw(key);
      assert.ok(otherSessions[key]);
    }
    await source.go('view=qr&n=4&mode=untimed&format=standard');
    const qr = JSON.parse(source.raw('cs-dat-r-qr')),
      item = qrItems.get(qr.qs[0]),
      wrong = (item.answer + 1) % item.options.length;
    source.find(`[data-dat-qr-i="${wrong}"]`).click();
    snapshot = source.snapshot();
    const legacy = JSON.parse(snapshot['cs-dat-r-qr']);
    delete legacy.scope.section;
    snapshot['cs-dat-r-qr'] = JSON.stringify(legacy);
    const srs = JSON.parse(snapshot['cs-dat-srs']);
    srs[item.id].due = 0;
    snapshot['cs-dat-srs'] = JSON.stringify(srs);
  } finally {
    source.close();
  }
  const restored = harness(snapshot);
  try {
    await restored.go('view=qr&n=4&mode=untimed&format=standard');
    assert.equal(restored.S.paused, false);
    assert.ok(restored.find('#dat-qr-next'));
    const qrRaw = restored.raw('cs-dat-r-qr'),
      previousLog = JSON.parse(restored.raw('cs-dat-log'));
    await restored.go('view=drill&review=1&section=qr');
    assert.ok(restored.find('.dat-opt'));
    restored.find('.dat-opt').click();
    restored.find('#dat-next').click();
    assert.ok(restored.find('.dat-review-summary'));
    assert.equal(restored.raw('cs-dat-r-qr'), qrRaw, 'review keeps the unfinished legacy QR session');
    for (const [key, raw] of Object.entries(otherSessions)) assert.equal(restored.raw(key), raw, key);
    const reviewedLog = JSON.parse(restored.raw('cs-dat-log'));
    assert.deepEqual(reviewedLog.slice(0, previousLog.length), previousLog);
    assert.equal(reviewedLog.at(-1).source, 'review');
    await restored.go('view=qr&n=4&mode=untimed&format=standard');
    restored.find('#dat-qr-next').click();
    restored.find('.dat-qr-opt').click();
    const next = JSON.parse(restored.raw('cs-dat-r-qr'));
    assert.equal(next.scope.section, 'qr');
    assert.equal(next.results.filter(Boolean).length, 2);
    assert.equal(restored.S.paused, false);
    for (const [key, raw] of Object.entries(otherSessions)) assert.equal(restored.raw(key), raw, key);
    assert.deepEqual(JSON.parse(restored.raw('cs-dat-log')).slice(0, reviewedLog.length), reviewedLog);
  } finally {
    restored.close();
  }
});

test('QR, PAT and reading damaged resume structures retain recovery copies', async () => {
  for (const [kind, query] of routes.slice(1)) {
    const source = harness();
    await source.go(query);
    const key = 'cs-dat-r-' + kind;
    const good = JSON.parse(source.raw(key));
    source.close();
    assert.ok(good, kind + ' writes a resumable session');
    const blob = structuredClone(good);
    if (kind === 'qr') blob.orders = null;
    if (kind === 'pat') blob.results = { 0: 'broken' };
    if (kind === 'rc') blob.highlights = { [blob.ids[0]]: {} };
    const raw = JSON.stringify(blob),
      h = harness({ [key]: raw });
    try {
      await h.go(query);
      assert.equal(h.S.paused, true, kind + ' malformed resume pauses');
      assert.equal(h.raw(key), raw, kind + ' keeps original copy');
    } finally {
      h.close();
    }
  }
});

test('the mistake-store key identifies the review item even when an old record carries a stale id', () => {
  const Core = require('../dat-drill-engine.js');
  assert.equal(Core.dueMistakes({ 'bio-real': { id: 'bio-stale', due: 1 } }, 2)[0].id, 'bio-real');
});
