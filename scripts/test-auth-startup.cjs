const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Progress = require('../auth-progress.js');
function setup(seed = {}, sdk) {
  class Storage {
    constructor(data) {
      this.map = new Map(Object.entries(data));
    }
    get length() {
      return this.map.size;
    }
    key(i) {
      return [...this.map.keys()][i];
    }
    getItem(key) {
      return this.map.get(key) ?? null;
    }
    setItem(key, value) {
      this.map.set(key, String(value));
    }
    removeItem(key) {
      this.map.delete(key);
    }
    clear() {
      this.map.clear();
    }
  }
  let blocked = 0,
    reloads = 0;
  const blobs = [],
    timers = [],
    storage = new Storage(seed);
  const node = () => ({
    style: {},
    setAttribute() {},
    querySelector: () => ({ style: {} }),
    addEventListener() {},
    showModal() {
      blocked++;
    },
  });
  class TestURL extends URL {
    static createObjectURL(blob) {
      blobs.push(blob);
      return 'blob:test';
    }
    static revokeObjectURL() {}
  }
  const context = vm.createContext({
    window: { supabase: sdk, addEventListener() {} },
    Storage,
    localStorage: storage,
    CortexProgress: Progress,
    document: {
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: type => (type === 'a' ? { click() {} } : node()),
      body: { appendChild() {} },
      addEventListener() {},
    },
    location: {
      origin: 'http://localhost',
      reload() {
        reloads++;
      },
    },
    Blob,
    URL: TestURL,
    setTimeout(fn) {
      timers.push(fn);
    },
    console,
  });
  vm.runInContext(fs.readFileSync('auth.js', 'utf8'), context);
  return {
    storage,
    context,
    api: context.window.CortexAccount,
    get blocked() {
      return blocked;
    },
    get reloads() {
      return reloads;
    },
    blobs,
    async flush() {
      for (const fn of timers.splice(0)) await fn();
    },
  };
}
const guest = setup({ 'cs-mode': 'timed' });
assert.equal(guest.api.available, true);
assert.match(guest.api.label, /Guest/);
assert.deepEqual(guest.api.snapshot().data, { 'cs-mode': 'timed' });
guest.storage.setItem('cs-mode', 'untimed');
assert.ok(guest.storage.getItem('cs-sync-dirty'));
guest.api.restore(guest.api.prepareRestore({ 'cs-mode': 'timed' }));
assert.equal(guest.reloads, 1);
assert.equal(guest.storage.getItem('cs-mode'), 'timed');
console.log('PASS Guest progress and portable restoration work without the sign-in SDK');
const account = setup({ [Progress.OWNER]: '{"id":"account-A","token":"A"}', 'cs-mode': 'timed' });
assert.equal(account.blocked, 1);
assert.throws(() => account.storage.setItem('cs-mode', 'new'));
assert.throws(() => account.api.snapshot());
assert.equal(JSON.parse(account.storage.getItem(Progress.OWNER)).id, 'account-A');
assert.equal(account.storage.getItem('cs-mode'), 'timed');
console.log('PASS Missing sign-in support preserves and pauses a saved account instead of reassigning it');
for (const scenario of ['bad-owner', 'sdk-failure']) {
  const h = setup(
    { [Progress.OWNER]: scenario === 'bad-owner' ? '{' : '{"id":"guest","token":"g"}', 'cs-mode': 'timed' },
    scenario === 'sdk-failure'
      ? {
          createClient() {
            throw Error('SDK failed');
          },
        }
      : undefined
  );
  assert.equal(h.blocked, 1);
  assert.equal(h.api.available, false);
  assert.throws(() => h.storage.setItem('cs-mode', 'replacement'));
  assert.throws(() => h.storage.removeItem('cs-mode'));
  assert.equal(h.storage.getItem('cs-mode'), 'timed');
  h.storage.setItem('sb-auth-token', 'sdk can clear or update its own authentication');
}
console.log('PASS Startup storage and SDK failures block later study writes without blocking authentication keys');
const recovery = setup({ 'cs-mode': 'timed' });
vm.runInContext(
  'const StudyStorage = { recovery: () => ({ records: { latest: { thisTab: "unsaved draft" } } }) }; downloadProgress();',
  recovery.context
);
(async () => {
  const data = JSON.parse(await recovery.blobs[0].text());
  assert.equal(data.studyDrafts.records.latest.thisTab, 'unsaved draft');
  assert.equal(data.device.data['cs-mode'], 'timed');
  console.log('PASS Recovery download includes both saved work and unsaved tab drafts');
  let callback;
  const client = {
      auth: {
        onAuthStateChange(fn) {
          callback = fn;
        },
      },
    },
    h = setup(
      { 'cs-mode': 'timed' },
      {
        createClient() {
          return client;
        },
      }
    );
  h.storage.setItem('sb-session', 'SDK session');
  callback('SIGNED_IN', { user: { id: 'A', email: 'learner@example.test' } });
  assert.equal(JSON.parse(h.storage.getItem(Progress.OWNER)).id, 'guest');
  await h.flush();
  assert.equal(JSON.parse(h.storage.getItem(Progress.OWNER)).id, 'A');
  assert.equal(h.reloads, 1);
  assert.equal(h.storage.getItem('cs-mode'), null);
  assert.equal(JSON.parse(h.storage.getItem(Progress.archiveKey('guest'))).data['cs-mode'], 'timed');
  assert.equal(h.storage.getItem('sb-session'), 'SDK session');
  console.log('PASS A deferred SDK sign-in callback switches workspaces while preserving guest work and auth keys');
  console.log('5 account startup and recovery integration checks passed. No hosted service was contacted.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
