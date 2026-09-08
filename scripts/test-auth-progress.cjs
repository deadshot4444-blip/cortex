const assert = require('node:assert/strict');
const { create, OWNER, JOURNAL, archiveKey } = require('../auth-progress.js');
class MemoryStorage {
  constructor(seed = {}) {
    this.map = new Map(Object.entries(seed));
    this.failKey = null;
  }
  get length() {
    return this.map.size;
  }
  key(i) {
    return [...this.map.keys()][i];
  }
  getItem(k) {
    return this.map.get(k) ?? null;
  }
  setItem(k, v) {
    if (k === this.failKey) throw Error('Quota exceeded');
    this.map.set(k, String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
}
const revision = '2026-09-06T00:00:00.000Z';
const row = (data, updated_at = revision) => ({ data, updated_at });
function backend(seed = {}) {
  const rows = new Map(Object.entries(seed)),
    calls = [];
  const api = {
    rows,
    calls,
    error: null,
    before: null,
    from() {
      let op = 'read',
        value,
        uid,
        base;
      const q = {
        select() {
          return q;
        },
        eq(k, v) {
          if (k === 'user_id') uid = v;
          else base = v;
          return q;
        },
        update(v) {
          op = 'update';
          value = v;
          return q;
        },
        insert(v) {
          op = 'insert';
          value = v;
          uid = v.user_id;
          return q;
        },
        async maybeSingle() {
          calls.push({ op, uid, base, value });
          if (api.before) await api.before(op, uid);
          if (api.error) return { data: null, error: api.error };
          const old = rows.get(uid);
          if (op === 'read') return { data: old ? structuredClone(old) : null, error: null };
          if (op === 'insert' && old) return { data: null, error: { code: '23505' } };
          if (op === 'update' && old?.updated_at !== base) return { data: null, error: null };
          rows.set(uid, row(structuredClone(value.data), value.updated_at));
          return { data: { updated_at: value.updated_at }, error: null };
        },
      };
      return q;
    },
  };
  return api;
}
const owned = (id, data = {}, base = revision, dirty = '') => ({
  [OWNER]: JSON.stringify({ id, token: 'owner-' + id }),
  ...data,
  'cs-sync-meta': JSON.stringify({ owner: id, known: true, revision: base }),
  ...(dirty ? { 'cs-sync-dirty': dirty } : {}),
});
const engines = [];
function engine(storage, client) {
  let reloads = 0,
    blocked = [];
  const e = create({
    storage,
    client,
    onReload() {
      reloads++;
    },
    onBlocked(m) {
      blocked.push(m);
    },
  });
  engines.push(e);
  return {
    e,
    get reloads() {
      return reloads;
    },
    blocked,
  };
}
function write(e, s, k, v) {
  e.beforeWrite(k);
  s.setItem(k, v);
  e.afterWrite(k);
}
let checks = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log('PASS', name);
    checks++;
  } finally {
    engines.splice(0).forEach(e => e.stop());
  }
}
(async () => {
  await test('Unattributed upgrade work is preserved as guest work, never auto-uploaded', async () => {
    const s = new MemoryStorage({ 'cs-mcat-plan': 'legacy', 'cs-sync-meta': '{"updatedAt":"2099-01-01"}' }),
      b = backend();
    const a = engine(s, b);
    await a.e.setUser({ id: 'A' });
    assert.equal(a.reloads, 1);
    assert.equal(s.getItem('cs-mcat-plan'), null);
    assert.equal(JSON.parse(s.getItem(archiveKey('guest'))).data['cs-mcat-plan'], 'legacy');
    assert.equal(b.calls.length, 0);
    const active = engine(s, b);
    await active.e.setUser({ id: 'A' });
    assert.equal(b.rows.size, 0);
    assert.equal(active.e.state, 'synced');
    assert.equal(active.e.hasGuest, true);
    assert.equal(active.e.useGuest(), true);
    assert.equal(s.getItem('cs-mcat-plan'), 'legacy');
    const imported = engine(s, b);
    await imported.e.setUser({ id: 'A' });
    assert.equal(b.rows.get('A').data['cs-mcat-plan'], 'legacy');
  });
  await test('A to B to guest switches retain separate recovery copies and scoped metadata', async () => {
    const s = new MemoryStorage(owned('A', { 'cs-mcat-v2': 'A work' })),
      b = backend({ A: row({ 'cs-mcat-v2': 'A work' }), B: row({ 'cs-mcat-v2': 'B work' }) });
    const a = engine(s, b);
    await a.e.setUser({ id: 'A' });
    await a.e.setUser({ id: 'B' });
    assert.equal(s.getItem('cs-mcat-v2'), null);
    const bb = engine(s, b);
    await bb.e.setUser({ id: 'B' });
    assert.equal(s.getItem('cs-mcat-v2'), 'B work');
    const b2 = engine(s, b);
    await b2.e.setUser({ id: 'B' });
    await b2.e.setUser(null);
    assert.equal(s.getItem('cs-mcat-v2'), null);
    const guest = engine(s, b);
    await guest.e.setUser(null);
    await guest.e.setUser({ id: 'A' });
    assert.equal(s.getItem('cs-mcat-v2'), 'A work');
    assert.equal(b.calls.filter(c => c.op !== 'read').length, 0);
  });
  await test('Expired session on boot leaves the previous account workspace', async () => {
    const s = new MemoryStorage(owned('A', { 'cs-mcat-v2': 'private A' })),
      a = engine(s, backend());
    await a.e.setUser(null);
    assert.equal(s.getItem('cs-mcat-v2'), null);
    assert.equal(a.reloads, 1);
  });
  await test('Failed cloud reads never create or overwrite a remote row, and retry preserves work', async () => {
    const s = new MemoryStorage(owned('A', { 'cs-mcat-v2': 'pending' }, revision, 'dirty')),
      b = backend({ A: row({ 'cs-mcat-v2': 'old' }) });
    b.error = { message: 'offline' };
    const { e } = engine(s, b);
    await e.setUser({ id: 'A' });
    assert.equal(e.state, 'error');
    assert.ok(s.getItem('cs-sync-dirty'));
    assert.equal(b.calls.filter(c => c.op !== 'read').length, 0);
    b.error = null;
    await e.sync();
    assert.equal(b.rows.get('A').data['cs-mcat-v2'], 'pending');
    assert.equal(s.getItem('cs-sync-dirty'), null);
  });
  await test('Remote changes and local changes pause for an explicit choice', async () => {
    const s = new MemoryStorage(owned('A', { 'cs-mcat-v2': 'local' }, revision, 'dirty')),
      b = backend({ A: row({ 'cs-mcat-v2': 'remote' }, '2026-09-06T00:00:01.000Z') }),
      { e } = engine(s, b);
    await e.setUser({ id: 'A' });
    assert.equal(e.state, 'conflict');
    assert.equal(s.getItem('cs-mcat-v2'), 'local');
    assert.equal(b.calls.length, 1);
    assert.equal(e.recovery().cloud.data['cs-mcat-v2'], 'remote');
    e.resolve('cloud');
    assert.equal(s.getItem('cs-mcat-v2'), 'remote');
    assert.equal(JSON.parse(s.getItem(archiveKey('A'))).data['cs-mcat-v2'], 'local');
  });
  await test('Keeping the device copy still checks the selected cloud revision before writing', async () => {
    const s = new MemoryStorage(owned('A', { 'cs-mcat-v2': 'local' }, revision, 'dirty')),
      b = backend({ A: row({ 'cs-mcat-v2': 'remote' }, '2026-09-06T00:00:01.000Z') }),
      { e } = engine(s, b);
    await e.setUser({ id: 'A' });
    e.resolve('device');
    assert.equal(e.recovery().previousCloudCopy.data['cs-mcat-v2'], 'remote');
    b.rows.set('A', row({ 'cs-mcat-v2': 'newer remote' }, '2026-09-06T00:00:02.000Z'));
    await e.sync();
    assert.equal(e.state, 'conflict');
    assert.equal(b.rows.get('A').data['cs-mcat-v2'], 'newer remote');
  });
  await test('A compare-and-swap race does not overwrite another device', async () => {
    const s = new MemoryStorage(owned('A', { 'cs-mcat-v2': 'local' }, revision, 'dirty')),
      b = backend({ A: row({ 'cs-mcat-v2': 'old' }) }),
      { e } = engine(s, b);
    b.before = async op => {
      if (op === 'update') {
        b.rows.set('A', row({ 'cs-mcat-v2': 'concurrent' }, '2026-09-06T00:00:03.000Z'));
        b.before = null;
      }
    };
    await e.setUser({ id: 'A' });
    assert.equal(e.state, 'conflict');
    assert.equal(b.rows.get('A').data['cs-mcat-v2'], 'concurrent');
    assert.ok(s.getItem('cs-sync-dirty'));
  });
  await test('Simultaneous first inserts do not become unconditional upserts', async () => {
    const s = new MemoryStorage(owned('A', { 'cs-mcat-v2': 'local' }, null, 'dirty')),
      b = backend(),
      { e } = engine(s, b);
    b.before = async op => {
      if (op === 'insert') {
        b.rows.set('A', row({ 'cs-mcat-v2': 'concurrent' }));
        b.before = null;
      }
    };
    await e.setUser({ id: 'A' });
    assert.equal(e.state, 'conflict');
    assert.equal(b.rows.get('A').data['cs-mcat-v2'], 'concurrent');
  });
  await test('Cloud deletion of a key removes it locally and preserves the previous copy', async () => {
    const s = new MemoryStorage(owned('A', { 'cs-mcat-v2': 'same', 'cs-mcat-plan': 'deleted remotely' })),
      b = backend({ A: row({ 'cs-mcat-v2': 'same' }, '2026-09-06T00:00:04.000Z') }),
      a = engine(s, b);
    await a.e.setUser({ id: 'A' });
    assert.equal(s.getItem('cs-mcat-plan'), null);
    assert.equal(a.reloads, 1);
    assert.equal(JSON.parse(s.getItem(archiveKey('A'))).data['cs-mcat-plan'], 'deleted remotely');
  });
  await test('A removed remote row does not silently erase local work or recreate the row', async () => {
    const s = new MemoryStorage(owned('A', { 'cs-mcat-v2': 'keep' })),
      b = backend(),
      { e } = engine(s, b);
    await e.setUser({ id: 'A' });
    assert.equal(e.state, 'conflict');
    assert.equal(s.getItem('cs-mcat-v2'), 'keep');
    assert.equal(b.rows.size, 0);
  });
  await test('An old tab cannot write into a newly selected account', async () => {
    const s = new MemoryStorage(owned('A', { 'cs-mcat-v2': 'A' })),
      b = backend({ A: row({ 'cs-mcat-v2': 'A' }) }),
      a = engine(s, b),
      other = engine(s, b);
    await a.e.setUser({ id: 'A' });
    await other.e.setUser({ id: 'B' });
    assert.throws(() => write(a.e, s, 'cs-mcat-v2', 'stale A'));
    assert.equal(s.getItem('cs-mcat-v2'), null);
    assert.equal(a.e.paused, true);
  });
  await test('An old pending read cannot be applied after an account change', async () => {
    const s = new MemoryStorage(owned('A')),
      b = backend({ A: row({ 'cs-mcat-v2': 'remote A' }) }),
      a = engine(s, b);
    let release;
    b.before = () =>
      new Promise(r => {
        release = r;
      });
    const pending = a.e.setUser({ id: 'A' });
    await a.e.setUser({ id: 'B' });
    release();
    await pending;
    assert.equal(s.getItem('cs-mcat-v2'), null);
    assert.equal(JSON.parse(s.getItem(OWNER)).id, 'B');
  });
  await test('A late push response does not write A metadata into B workspace', async () => {
    const s = new MemoryStorage(owned('A', { 'cs-mcat-v2': 'A pending' }, revision, 'dirty')),
      b = backend({ A: row({}) }),
      a = engine(s, b);
    let release;
    b.before = op =>
      op === 'update'
        ? new Promise(r => {
            release = r;
          })
        : undefined;
    const pending = a.e.setUser({ id: 'A' });
    while (!release) await new Promise(r => setImmediate(r));
    await a.e.setUser({ id: 'B' });
    release();
    await pending;
    assert.equal(s.getItem('cs-sync-meta'), 'null');
    assert.equal(s.getItem('cs-mcat-v2'), null);
  });
  await test('Edits during an upload stay dirty until a later successful write', async () => {
    const s = new MemoryStorage(owned('A', { 'cs-mcat-v2': 'first' }, revision, 'dirty')),
      b = backend({ A: row({}) }),
      { e } = engine(s, b);
    let release;
    b.before = op =>
      op === 'update'
        ? new Promise(r => {
            release = r;
          })
        : undefined;
    const pending = e.setUser({ id: 'A' });
    while (!release) await new Promise(r => setImmediate(r));
    write(e, s, 'cs-mcat-v2', 'second');
    b.before = null;
    release();
    await pending;
    assert.ok(s.getItem('cs-sync-dirty'));
    assert.equal(b.rows.get('A').data['cs-mcat-v2'], 'first');
    await e.sync();
    assert.equal(b.rows.get('A').data['cs-mcat-v2'], 'second');
    assert.equal(s.getItem('cs-sync-dirty'), null);
  });
  await test('Quota failure before switching leaves active work intact', async () => {
    const s = new MemoryStorage(owned('A', { 'cs-mcat-v2': 'A' })),
      a = engine(s, backend());
    s.failKey = archiveKey('A');
    await a.e.setUser({ id: 'B' });
    assert.equal(s.getItem('cs-mcat-v2'), 'A');
    assert.equal(JSON.parse(s.getItem(OWNER)).id, 'A');
    assert.equal(a.reloads, 0);
    assert.equal(a.e.paused, true);
  });
  await test('An interrupted account transaction recovers before app startup', async () => {
    const before = { id: 'A', token: 'A-token' },
      backupKey = archiveKey('A');
    const s = new MemoryStorage({
      [OWNER]: JSON.stringify({ ...before, transition: true }),
      [JOURNAL]: JSON.stringify({ before, backupKey }),
      [backupKey]: JSON.stringify({
        data: { 'cs-mcat-v2': 'A saved' },
        meta: { owner: 'A', known: true, revision },
        dirty: 'pending',
      }),
      'cs-mcat-v2': 'partial B',
      'cs-mcat-plan': 'partial',
    });
    const a = engine(s, backend());
    assert.equal(s.getItem('cs-mcat-v2'), 'A saved');
    assert.equal(s.getItem('cs-mcat-plan'), null);
    assert.equal(a.e.owner, 'A');
    assert.equal(s.getItem(JOURNAL), null);
    assert.equal(s.getItem('cs-sync-dirty'), 'pending');
  });
  await test('Malformed cloud documents fail without touching local work', async () => {
    const s = new MemoryStorage(owned('A', { 'cs-mcat-v2': 'keep' })),
      b = backend({ A: row({ 'cs-mcat-v2': { bad: true } }) }),
      { e } = engine(s, b);
    await e.setUser({ id: 'A' });
    assert.equal(e.state, 'error');
    assert.equal(s.getItem('cs-mcat-v2'), 'keep');
    assert.equal(b.calls.length, 1);
  });
  await test('A stale tab recovery download does not contain the new account workspace', async () => {
    const s = new MemoryStorage(owned('A', { 'cs-mcat-v2': 'A saved' })),
      b = backend({ A: row({ 'cs-mcat-v2': 'A saved' }) }),
      old = engine(s, b),
      other = engine(s, b);
    await old.e.setUser({ id: 'A' });
    await other.e.setUser({ id: 'B' });
    s.setItem('cs-mcat-v2', 'B private');
    assert.equal(old.e.recovery().device.data['cs-mcat-v2'], 'A saved');
  });
  await test('A dirty-marker quota failure prevents an unprotected study write', async () => {
    const s = new MemoryStorage(owned('A', { 'cs-mcat-v2': 'saved' })),
      { e } = engine(s, backend());
    s.failKey = 'cs-sync-dirty';
    assert.throws(() => write(e, s, 'cs-mcat-v2', 'new'));
    assert.equal(s.getItem('cs-mcat-v2'), 'saved');
  });
  await test('The exact timestamp returned by Postgres is retained for subsequent syncs', async () => {
    const canonical = revision.replace('Z', '+00:00');
    const s = new MemoryStorage(owned('A', { 'cs-mcat-v2': 'first' }, canonical, 'dirty')),
      b = backend({ A: row({}, canonical) });
    const original = b.from;
    b.from = function () {
      const q = original();
      const run = q.maybeSingle;
      q.maybeSingle = async () => {
        const out = await run();
        if (out.data?.updated_at) {
          out.data.updated_at = out.data.updated_at.replace('Z', '+00:00');
          const r = b.rows.get('A');
          if (r) r.updated_at = r.updated_at.replace('Z', '+00:00');
        }
        return out;
      };
      return q;
    };
    const { e } = engine(s, b);
    await e.setUser({ id: 'A' });
    assert.match(JSON.parse(s.getItem('cs-sync-meta')).revision, /\+00:00$/);
    write(e, s, 'cs-mcat-v2', 'second');
    await e.sync();
    assert.equal(e.state, 'synced');
    assert.equal(b.rows.get('A').data['cs-mcat-v2'], 'second');
  });
  await test('A portable restore replaces exactly the reviewed guest workspace and keeps the previous copy', async () => {
    const s = new MemoryStorage({ 'cs-mcat-q': '{"a":1}', 'cs-mode': 'timed', 'sb-session': 'private' }),
      a = engine(s, backend());
    const data = { 'cs-mcat-q': '{"b":2}' },
      p = a.e.prepareRestore(data);
    data['cs-mcat-q'] = 'changed after preview';
    assert.deepEqual(
      p.changes.map(c => c.action),
      ['replace', 'remove']
    );
    assert.equal(s.getItem('cs-mcat-q'), '{"a":1}');
    assert.equal(a.e.restore(p), true);
    assert.equal(s.getItem('cs-mcat-q'), '{"b":2}');
    assert.equal(s.getItem('cs-mode'), null);
    assert.equal(s.getItem('sb-session'), 'private');
    assert.equal(a.reloads, 1);
    assert.equal(JSON.parse(s.getItem(archiveKey('guest'))).data['cs-mode'], 'timed');
    assert.ok(s.getItem('cs-sync-dirty'));
  });
  await test('A restore preview is invalidated by newer work or another account', async () => {
    const s = new MemoryStorage({ 'cs-mode': 'timed' }),
      a = engine(s, backend()),
      p = a.e.prepareRestore({ 'cs-mode': 'untimed' });
    write(a.e, s, 'cs-mode', 'changed');
    assert.throws(() => a.e.restore(p), /changed after/);
    assert.equal(s.getItem('cs-mode'), 'changed');
    const p2 = a.e.prepareRestore({ 'cs-mode': 'untimed' });
    s.setItem(OWNER, JSON.stringify({ id: 'B', token: 'new' }));
    assert.throws(() => a.e.restore(p2));
    assert.throws(() => a.e.portableSnapshot());
  });
  await test('Portable snapshots exclude authentication, sync metadata and other account archives', async () => {
    const s = new MemoryStorage({
        'cs-mode': 'timed',
        'sb-session': 'private',
        [archiveKey('other')]: JSON.stringify({ data: { 'cs-mode': 'other private' } }),
      }),
      { e } = engine(s, backend());
    assert.deepEqual(e.portableSnapshot().data, { 'cs-mode': 'timed' });
    assert.throws(() => e.prepareRestore({ 'sb-session': 'evil' }));
    assert.throws(() => e.restore({}));
  });
  await test('Restores wait for account initialization and unresolved cloud operations', async () => {
    const s = new MemoryStorage(owned('A', { 'cs-mode': 'timed' })),
      b = backend({ A: row({ 'cs-mode': 'timed' }) }),
      { e } = engine(s, b);
    assert.throws(() => e.prepareRestore({ 'cs-mode': 'untimed' }), /Finish signing/);
    let release;
    b.before = () =>
      new Promise(r => {
        release = r;
      });
    const syncing = e.setUser({ id: 'A' });
    assert.throws(() => e.prepareRestore({ 'cs-mode': 'untimed' }));
    release();
    await syncing;
    const p = e.prepareRestore({ 'cs-mode': 'untimed' });
    b.before = null;
    write(e, s, 'cs-mode', 'device');
    b.rows.set('A', row({ 'cs-mode': 'cloud' }, '2026-09-06T00:00:09Z'));
    await e.sync();
    assert.equal(e.state, 'conflict');
    assert.throws(() => e.restore(p));
  });
  await test('Restored account work checks the retained cloud revision before upload', async () => {
    const s = new MemoryStorage(owned('A', { 'cs-mode': 'timed' })),
      b = backend({ A: row({ 'cs-mode': 'timed' }) }),
      a = engine(s, b);
    await a.e.setUser({ id: 'A' });
    a.e.restore(a.e.prepareRestore({ 'cs-mode': 'untimed' }));
    assert.equal(JSON.parse(s.getItem('cs-sync-meta')).revision, revision);
    b.rows.set('A', row({ 'cs-mode': 'newer cloud' }, '2026-09-06T00:00:12Z'));
    const after = engine(s, b);
    await after.e.setUser({ id: 'A' });
    assert.equal(after.e.state, 'conflict');
    assert.equal(s.getItem('cs-mode'), 'untimed');
    assert.equal(b.rows.get('A').data['cs-mode'], 'newer cloud');
  });
  await test('Quota failure before a restore does not remove or replace active records', async () => {
    const s = new MemoryStorage({ 'cs-mode': 'timed' }),
      a = engine(s, backend()),
      p = a.e.prepareRestore({ 'cs-mode': 'untimed' });
    s.failKey = archiveKey('guest');
    assert.throws(() => a.e.restore(p));
    assert.equal(s.getItem('cs-mode'), 'timed');
    assert.equal(s.getItem(JOURNAL), null);
    assert.equal(a.reloads, 0);
  });
  await test('A failed multi-key restore rolls back its earlier writes', async () => {
    const s = new MemoryStorage({ 'cs-mode': 'timed', 'cs-diff': 'all' }),
      a = engine(s, backend()),
      p = a.e.prepareRestore({ 'cs-mode': 'untimed', 'cs-diff': 'hard' });
    const original = s.setItem.bind(s);
    let failed = false;
    s.setItem = (k, v) => {
      if (k === 'cs-diff' && v === 'hard' && !failed) {
        failed = true;
        throw Error('Quota');
      }
      original(k, v);
    };
    assert.throws(() => a.e.restore(p));
    assert.equal(s.getItem('cs-mode'), 'timed');
    assert.equal(s.getItem('cs-diff'), 'all');
    assert.equal(s.getItem(JOURNAL), null);
    assert.equal(a.reloads, 0);
  });
  await test('An interrupted restore with failed rollback recovers from its journal on restart', async () => {
    const s = new MemoryStorage({ 'cs-mode': 'timed', 'cs-diff': 'all' }),
      a = engine(s, backend()),
      p = a.e.prepareRestore({ 'cs-mode': 'untimed', 'cs-diff': 'hard' });
    s.failKey = 'cs-diff';
    assert.throws(() => a.e.restore(p));
    assert.ok(s.getItem(JOURNAL));
    assert.equal(a.e.state, 'paused');
    assert.match(a.blocked.at(-1), /reload to recover the previous workspace/);
    s.failKey = null;
    const next = engine(s, backend());
    assert.equal(next.e.owner, 'guest');
    assert.equal(s.getItem('cs-mode'), 'timed');
    assert.equal(s.getItem('cs-diff'), 'all');
    assert.equal(s.getItem(JOURNAL), null);
  });
  console.log(`${checks} account, restoration and sync checks passed.`);
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
