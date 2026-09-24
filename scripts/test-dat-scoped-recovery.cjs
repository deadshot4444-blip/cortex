/* Scoped recovery uses the real account transaction and preserves unrelated raw values. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const Progress = require('../auth-progress.js');
function harness(seed = {}) {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/dat', runScripts: 'outside-only' });
  const w = dom.window;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  for (const [key, raw] of Object.entries(seed)) w.localStorage.setItem(key, raw);
  let fail = null,
    reloads = 0;
  const raw = {
    get length() {
      return w.localStorage.length;
    },
    key: i => w.localStorage.key(i),
    getItem: key => w.localStorage.getItem(key),
    setItem: (key, value) => {
      if (fail === key) throw Error('Quota exceeded');
      w.localStorage.setItem(key, value);
    },
    removeItem: key => {
      if (fail === key) throw Error('Removal failed');
      w.localStorage.removeItem(key);
    },
  };
  const account = Progress.create({ storage: raw, client: null, onReload: () => reloads++ });
  w.CortexProgress = Progress;
  w.CortexAccount = {
    available: true,
    snapshot: account.portableSnapshot,
    prepareRestore: account.prepareRestore,
    restore: account.restore,
  };
  vm.runInContext(fs.readFileSync('study-storage.js', 'utf8'), dom.getInternalVMContext());
  const S = vm.runInContext('StudyStorage', dom.getInternalVMContext());
  const find = selector => w.document.querySelector(selector);
  return {
    w,
    S,
    account,
    find,
    raw,
    get reloads() {
      return reloads;
    },
    set fail(key) {
      fail = key;
    },
    preview() {
      find('#study-dat-recover').click();
    },
    apply() {
      const box = find('#study-dat-confirm');
      box.checked = true;
      box.dispatchEvent(new w.Event('change'));
      find('#study-dat-apply').click();
    },
    close() {
      account.stop();
      w.close();
    },
  };
}
const other = {
  'cs-dat-q': '{ "valid": {"n":2} }',
  'cs-dat-plan': '{ "retained": true }',
  'cs-mcat-note': '{"text":"keep exactly"}',
  'device-setting': 'keep device',
};

test('scoped DAT restart requires confirmation, archives exact bytes and preserves every unrelated value', () => {
  const bad = ' [ null ] \n';
  const h = harness({ ...other, 'cs-dat-log': bad });
  try {
    h.S.read('cs-dat-log', []);
    h.S.sessionFailed('cs-dat-log');
    assert.equal(h.find('#study-dat-recover').hidden, false);
    h.preview();
    assert.equal(h.find('#study-dat-apply').disabled, true);
    assert.match(h.find('#study-dat-recovery').textContent, /DAT attempt log/);
    assert.equal(h.raw.getItem('cs-dat-log'), bad);
    h.find('#study-dat-cancel').click();
    assert.equal(h.reloads, 0);
    assert.equal(h.raw.getItem('cs-dat-log'), bad);
    h.preview();
    h.apply();
    assert.equal(h.reloads, 1);
    assert.equal(h.raw.getItem('cs-dat-log'), null);
    for (const [key, value] of Object.entries(other)) assert.equal(h.raw.getItem(key), value);
    const archive = JSON.parse(h.raw.getItem(Progress.archiveKey('guest')));
    assert.equal(archive.data['cs-dat-log'], bad);
    assert.equal(archive.data['cs-mcat-note'], other['cs-mcat-note']);
    assert.equal(h.raw.getItem(Progress.JOURNAL), null);
    assert.equal(h.S.write('cs-dat-log', ['stale tab']), false, 'the old owner cannot write after replacement');
    assert.equal(h.raw.getItem('cs-dat-log'), null);
  } finally {
    h.close();
  }
});

test('invalid JSON and every supported DAT session key have a scoped recovery path with raw exports', () => {
  for (const key of [
    'cs-dat-log',
    'cs-dat-q',
    'cs-dat-srs',
    'cs-dat-r-drill',
    'cs-dat-r-review',
    'cs-dat-r-pat',
    'cs-dat-r-qr',
    'cs-dat-r-rc',
  ]) {
    const bad = '{ broken json \n';
    const h = harness({ 'cs-mcat-note': '"untouched"', [key]: bad });
    try {
      h.S.read(key, null);
      assert.equal(h.S.recovery().records[key].savedRaw, bad);
      assert.equal(h.find('#study-dat-recover').hidden, false, key);
      h.preview();
      h.apply();
      assert.equal(h.reloads, 1, key);
      assert.equal(h.raw.getItem(key), null);
      assert.equal(h.raw.getItem('cs-mcat-note'), '"untouched"');
      assert.equal(JSON.parse(h.raw.getItem(Progress.archiveKey('guest'))).data[key], bad);
    } finally {
      h.close();
    }
  }
});

test('recovery never removes unnamed or unrelated records and declines stale previews or account switches', () => {
  for (const change of ['same-key', 'unrelated-key', 'owner']) {
    const h = harness({ 'cs-dat-log': '[null]', 'cs-mcat-note': '"original"' });
    try {
      h.S.read('cs-dat-log', []);
      h.S.sessionFailed(['cs-dat-log', 'cs-mcat-note', 'cs-dat-unread']);
      h.preview();
      assert.equal(h.find('#study-dat-recovery li').textContent, 'DAT attempt log');
      if (change === 'same-key') h.raw.setItem('cs-dat-log', '[]');
      if (change === 'unrelated-key') h.raw.setItem('cs-mcat-note', '"newer"');
      if (change === 'owner') h.raw.setItem(Progress.OWNER, '{"id":"account-B","token":"new"}');
      const before = Object.fromEntries(Object.keys(h.w.localStorage).map(k => [k, h.raw.getItem(k)]));
      h.apply();
      assert.equal(h.reloads, 0);
      assert.deepEqual(Object.fromEntries(Object.keys(h.w.localStorage).map(k => [k, h.raw.getItem(k)])), before);
      assert.match(h.find('#study-conflict-status').textContent, /changed/);
    } finally {
      h.close();
    }
  }
});

test('quota failure before archival and failed replacement preserve the original work', () => {
  for (const key of [Progress.archiveKey('guest'), 'cs-dat-log']) {
    const h = harness({ 'cs-dat-log': '[null]', 'cs-mcat-note': '"keep"' });
    try {
      h.S.read('cs-dat-log', []);
      h.S.sessionFailed('cs-dat-log');
      h.preview();
      h.fail = key;
      h.apply();
      assert.equal(h.reloads, 0);
      assert.equal(h.raw.getItem('cs-dat-log'), '[null]');
      assert.equal(h.raw.getItem('cs-mcat-note'), '"keep"');
      assert.match(h.find('#study-conflict-status').textContent, /did not complete/);
    } finally {
      h.close();
    }
  }
});

test('non-DAT failures and stale-tab conflicts do not offer scoped DAT recovery', () => {
  const h = harness({ 'cs-note': '{bad', 'cs-dat-log': '[null]' });
  try {
    h.S.read('cs-note', null);
    assert.equal(h.find('#study-dat-recover').hidden, true);
    h.S.read('cs-dat-log', []);
    h.S.sessionFailed('cs-dat-log');
    h.S.workspaceChanged();
    h.S.sessionFailed('cs-dat-log');
    assert.equal(h.S.conflicted, true);
    assert.equal(h.find('#study-dat-recover').hidden, true);
    assert.match(h.find('#study-conflict-title').textContent, /workspace changed/);
  } finally {
    h.close();
  }
});

test('unwritten unrelated drafts and every earlier scoped recovery survive sequential restarts', () => {
  let snapshot;
  const h = harness({ 'cs-dat-log': '[null]', 'cs-dat-r-drill': '{broken', 'cs-mcat-note': '"saved note"' });
  try {
    h.S.read('cs-dat-log', []);
    h.S.sessionFailed('cs-dat-log');
    h.S.write('cs-mcat-note', { text: 'unwritten note' });
    h.preview();
    h.apply();
    const keys = Object.keys(h.w.localStorage).filter(k => k.startsWith('cortex-dat-recovery-v1:'));
    assert.equal(keys.length, 1);
    const copy = JSON.parse(h.raw.getItem(keys[0]));
    assert.equal(copy.savedWorkspace['cs-dat-log'], '[null]');
    assert.deepEqual(copy.drafts['cs-mcat-note'].thisTab, { text: 'unwritten note' });
    snapshot = Object.fromEntries(Object.keys(h.w.localStorage).map(k => [k, h.raw.getItem(k)]));
  } finally {
    h.close();
  }
  const next = harness(snapshot);
  try {
    assert.equal(next.S.recovery().datRecoveries.length, 1, 'the reloaded tab can export the old copy');
    next.S.read('cs-dat-r-drill', null);
    next.preview();
    next.apply();
    const keys = Object.keys(next.w.localStorage).filter(k => k.startsWith('cortex-dat-recovery-v1:'));
    assert.equal(keys.length, 2, 'a second restart never replaces the first immutable copy');
    const first = keys.map(k => JSON.parse(next.raw.getItem(k))).find(copy => copy.affectedKeys.includes('cs-dat-log'));
    assert.equal(first.savedWorkspace['cs-dat-log'], '[null]');
    assert.deepEqual(first.drafts['cs-mcat-note'].thisTab, { text: 'unwritten note' });
    snapshot = Object.fromEntries(Object.keys(next.w.localStorage).map(k => [k, next.raw.getItem(k)]));
  } finally {
    next.close();
  }
  const reloaded = harness(snapshot);
  try {
    assert.equal(reloaded.S.recovery().datRecoveries.length, 2);
    reloaded.raw.setItem(Progress.OWNER, '{"id":"other-account","token":"new"}');
    assert.equal(reloaded.S.recovery().datRecoveries.length, 0, 'stale tabs never scan the new account archives');
  } finally {
    reloaded.close();
  }
});

test('an unserializable pending draft prevents restart instead of disappearing into an error-only archive', () => {
  const h = harness({ 'cs-dat-log': '[null]', 'cs-note': '"saved"' });
  try {
    h.S.read('cs-dat-log', []);
    h.S.sessionFailed('cs-dat-log');
    h.S.watch('cs-note', () => {
      throw Error('Draft serialization failed');
    });
    h.preview();
    h.apply();
    assert.equal(h.reloads, 0);
    assert.equal(h.raw.getItem('cs-dat-log'), '[null]');
    assert.equal(h.raw.getItem('cs-note'), '"saved"');
    assert.equal(Object.keys(h.w.localStorage).filter(k => k.startsWith('cortex-dat-recovery-v1:')).length, 0);
    assert.match(h.find('#study-conflict-status').textContent, /draft could not be copied/);
  } finally {
    h.close();
  }
});
