// Reviewer preview access (supabase/README.md "Reviewer preview access"). The gate block of
// app.js derives which closed courses open from the cached grant, but only for the account that
// owns the browser's saved work; auth.js reads the grant after sign-in, caches it, and reloads
// only when the courses open on the page would change, so a reload always settles.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Progress = require('../auth-progress.js');

const KEY = 'cortex-preview-access-v1';
const app = fs.readFileSync('app.js', 'utf8');
const GATES = app.slice(
  app.indexOf('// Availability follows the Academy catalog.'),
  app.indexOf('const SECTION_LABELS')
);

class Storage {
  constructor(data = {}) {
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
}
function tracks() {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync('academy.js', 'utf8'), context);
  return JSON.parse(JSON.stringify(context.window.CortexAcademy.tracks));
}
const TRACKS = tracks();
const owner = id => JSON.stringify({ id, token: 't-' + id });
const grant = (user, courses) => JSON.stringify({ v: 1, user, email: user + '@example.test', courses });

function gates(seed, { host = 'cortexmedical.academy', search = '' } = {}) {
  const context = vm.createContext({
    localStorage: new Storage(seed),
    location: { hostname: host, search },
    CortexAcademy: { tracks: TRACKS },
  });
  vm.runInContext(
    GATES +
      ';globalThis.out = { local: IS_LOCAL_PREVIEW, preview: [...PREVIEW_COURSES].sort(), closed: [...UNDER_CONSTRUCTION].sort(), tag: sectionMenuTag };',
    context
  );
  // Plain copies: arrays made inside the vm fail deepStrictEqual on their foreign prototype.
  const { tag, ...lists } = context.out;
  return Object.assign(JSON.parse(JSON.stringify(lists)), { tag });
}

test('the catalog closes the same four courses this plan was written against', () => {
  assert.deepEqual(
    TRACKS.filter(t => !t.available)
      .map(t => t.id)
      .sort(),
    ['anatomy', 'neuro', 'reference', 'socrates']
  );
});

test('a production visitor without a grant sees every closed course closed', () => {
  const g = gates({});
  assert.equal(g.local, false);
  assert.deepEqual(g.preview, []);
  assert.deepEqual(g.closed, ['anatomy', 'neuro', 'reference', 'socrates']);
  assert.match(g.tag('socrates'), /Under construction/);
});

test('a grant opens only its closed courses, for the account that owns the saved work', () => {
  const g = gates({
    [Progress.OWNER]: owner('u1'),
    [KEY]: grant('u1', ['socrates', 'mcat', 'nonsense', 7]),
  });
  assert.deepEqual(g.preview, ['socrates'], 'open or unknown ids never become previews');
  assert.deepEqual(g.closed, ['anatomy', 'neuro', 'reference']);
  assert.match(g.tag('socrates'), />Preview</);
  assert.match(g.tag('anatomy'), /Under construction/);
  assert.equal(g.tag('mcat'), '');
});

test('a guest, another account, or a damaged cache never inherits a grant', () => {
  const cases = {
    guest: { [Progress.OWNER]: owner('guest'), [KEY]: grant('u1', ['socrates']) },
    other: { [Progress.OWNER]: owner('u2'), [KEY]: grant('u1', ['socrates']) },
    noOwner: { [KEY]: grant('u1', ['socrates']) },
    badJson: { [Progress.OWNER]: owner('u1'), [KEY]: '{' },
    future: { [Progress.OWNER]: owner('u1'), [KEY]: JSON.stringify({ v: 2, user: 'u1', courses: ['socrates'] }) },
    notList: { [Progress.OWNER]: owner('u1'), [KEY]: JSON.stringify({ v: 1, user: 'u1', courses: 'socrates' }) },
  };
  for (const [name, seed] of Object.entries(cases)) {
    const g = gates(seed);
    assert.deepEqual(g.preview, [], name);
    assert.deepEqual(g.closed, ['anatomy', 'neuro', 'reference', 'socrates'], name);
  }
});

test('localhost previews everything; ?gates=prod on localhost honours a grant like production', () => {
  const seed = { [Progress.OWNER]: owner('u1'), [KEY]: grant('u1', ['socrates']) };
  const local = gates(seed, { host: 'localhost' });
  assert.equal(local.local, true);
  assert.deepEqual(local.preview, [], 'no Preview label where everything is already open');
  assert.deepEqual(local.closed, []);
  assert.match(local.tag('socrates'), /Local preview/);
  const prod = gates(seed, { host: '127.0.0.1', search: '?gates=prod' });
  assert.equal(prod.local, false);
  assert.deepEqual(prod.preview, ['socrates']);
  assert.deepEqual(prod.closed, ['anatomy', 'neuro', 'reference']);
});

// auth.js in a vm with a fake Supabase client. `app` stands in for the gate globals app.js
// leaves behind (auth.js reads them through typeof guards, as it does on the real page).
function account({ seed = {}, row = null, fail = false, app: gatesNow = { local: false, open: [] } } = {}) {
  let callback,
    reloads = 0,
    asked = 0;
  const timers = [],
    storage = new Storage(seed);
  const client = {
    auth: {
      onAuthStateChange(fn) {
        callback = fn;
      },
    },
    from(table) {
      assert.equal(table, 'preview_access');
      const q = {
        select() {
          return q;
        },
        async maybeSingle() {
          asked++;
          if (fail) throw Error('offline');
          return { data: row, error: null };
        },
      };
      return q;
    },
  };
  const node = () => ({ style: {}, setAttribute() {}, querySelector: () => ({ style: {} }), addEventListener() {} });
  const context = vm.createContext({
    window: { supabase: { createClient: () => client }, addEventListener() {} },
    Storage,
    localStorage: storage,
    CortexProgress: Progress,
    IS_LOCAL_PREVIEW: gatesNow.local,
    CLOSED_COURSES: ['socrates', 'anatomy', 'reference', 'neuro'],
    PREVIEW_COURSES: new Set(gatesNow.open),
    document: {
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: node,
      body: { appendChild() {} },
      addEventListener() {},
    },
    location: {
      origin: 'https://cortexmedical.academy',
      reload() {
        reloads++;
      },
    },
    setTimeout(fn) {
      timers.push(fn);
    },
    console,
  });
  vm.runInContext(fs.readFileSync('auth.js', 'utf8'), context);
  return {
    storage,
    async event(name, user) {
      callback(name, user ? { user: { id: user, email: user.toUpperCase() + '@Example.test' } } : null);
      for (const fn of timers.splice(0)) await fn();
    },
    get reloads() {
      return reloads;
    },
    get asked() {
      return asked;
    },
  };
}

test('an invited reviewer signing in caches the grant and reloads once; the next load settles', async () => {
  const first = account({ seed: { [Progress.OWNER]: owner('u1') }, row: { courses: ['socrates'] } });
  await first.event('INITIAL_SESSION', 'u1');
  const cached = JSON.parse(first.storage.getItem(KEY));
  assert.deepEqual(cached, { v: 1, user: 'u1', email: 'u1@example.test', courses: ['socrates'] });
  assert.equal(first.reloads, 1);
  // The reloaded page derived socrates from the cache, so asking again changes nothing.
  const again = account({
    seed: { [Progress.OWNER]: owner('u1'), [KEY]: first.storage.getItem(KEY) },
    row: { courses: ['socrates'] },
    app: { local: false, open: ['socrates'] },
  });
  await again.event('INITIAL_SESSION', 'u1');
  assert.equal(again.reloads, 0);
  assert.equal(again.storage.getItem(KEY), first.storage.getItem(KEY));
});

test('no row, or a row naming only open courses, never reloads', async () => {
  const none = account({ seed: { [Progress.OWNER]: owner('u1') }, row: null });
  await none.event('INITIAL_SESSION', 'u1');
  assert.equal(none.storage.getItem(KEY), null);
  assert.equal(none.reloads, 0);
  const open = account({ seed: { [Progress.OWNER]: owner('u1') }, row: { courses: ['mcat'] } });
  await open.event('INITIAL_SESSION', 'u1');
  assert.equal(open.reloads, 0, 'caching an ineffective grant does not reload');
});

test('a revoked grant clears the cache and closes the course with one reload', async () => {
  const h = account({
    seed: { [Progress.OWNER]: owner('u1'), [KEY]: grant('u1', ['socrates']) },
    row: null,
    app: { local: false, open: ['socrates'] },
  });
  await h.event('INITIAL_SESSION', 'u1');
  assert.equal(h.storage.getItem(KEY), null);
  assert.equal(h.reloads, 1);
});

test('signing out drops the grant with a single reload, not two', async () => {
  const h = account({
    seed: { [Progress.OWNER]: owner('u1'), [KEY]: grant('u1', ['socrates']) },
    app: { local: false, open: ['socrates'] },
  });
  await h.event('SIGNED_OUT', null);
  assert.equal(h.storage.getItem(KEY), null);
  assert.equal(h.asked, 0, 'a signed-out page never asks the table');
  assert.equal(h.reloads, 1, 'the workspace switch reloads; the grant does not add a second');
});

test('an outage keeps this account’s cached grant and drops another account’s', async () => {
  const mine = account({
    seed: { [Progress.OWNER]: owner('u1'), [KEY]: grant('u1', ['socrates']) },
    fail: true,
    app: { local: false, open: ['socrates'] },
  });
  await mine.event('INITIAL_SESSION', 'u1');
  assert.equal(JSON.parse(mine.storage.getItem(KEY)).user, 'u1');
  assert.equal(mine.reloads, 0);
  const theirs = account({ seed: { [Progress.OWNER]: owner('u1'), [KEY]: grant('u2', ['socrates']) }, fail: true });
  await theirs.event('INITIAL_SESSION', 'u1');
  assert.equal(theirs.storage.getItem(KEY), null);
  assert.equal(theirs.reloads, 0, 'nothing was open, so nothing reloads');
});

test('localhost caches a grant without ever reloading, and token refreshes do not ask', async () => {
  const local = account({
    seed: { [Progress.OWNER]: owner('u1') },
    row: { courses: ['socrates'] },
    app: { local: true, open: [] },
  });
  await local.event('INITIAL_SESSION', 'u1');
  assert.equal(JSON.parse(local.storage.getItem(KEY)).user, 'u1');
  assert.equal(local.reloads, 0);
  await local.event('TOKEN_REFRESHED', 'u1');
  assert.equal(local.asked, 1);
});

test('the grant key stays out of synced progress and study backups', () => {
  assert.equal(Progress.syncKey(KEY), false);
  assert.doesNotMatch(KEY, /^cs-/);
});
