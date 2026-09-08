/* Account-scoped browser work and optimistic whole-document cloud sync. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CortexProgress = api;
})(typeof window === 'undefined' ? globalThis : window, () => {
  const OWNER = 'cortex-progress-owner-v1', JOURNAL = 'cortex-progress-transaction-v1';
  const META = 'cs-sync-meta', DIRTY = 'cs-sync-dirty';
  const syncKey = k => typeof k === 'string' && k.startsWith('cs-') && !['cs-counted', META, DIRTY].includes(k);
  const archiveKey = owner => 'cortex-progress-copy-v1:' + owner;
  function create({ storage, client, onState = () => {}, onReload = () => {}, onBlocked = () => {} }) {
    // storage methods are raw bindings, so internal transactions bypass the app's write observer.
    const read = k => JSON.parse(storage.getItem(k) || 'null');
    const put = (k, v) => storage.setItem(k, JSON.stringify(v));
    const token = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const gather = () => {
      const data = {};
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (syncKey(k)) data[k] = storage.getItem(k);
      }
      return data;
    };
    function validData(data) {
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Invalid progress document');
      const clean = {};
      for (const [k, v] of Object.entries(data)) {
        if (syncKey(k)) {
          if (typeof v !== 'string') throw Error('Invalid progress value');
          clean[k] = v;
        }
      }
      return clean;
    }
    function replace(snapshot) {
      const data = validData(snapshot.data);
      for (const k of Object.keys(gather())) if (!(k in data)) storage.removeItem(k);
      for (const [k, v] of Object.entries(data)) storage.setItem(k, v);
      put(META, snapshot.meta || null);
      if (snapshot.dirty) storage.setItem(DIRTY, snapshot.dirty); else storage.removeItem(DIRTY);
    }
    // Recover an interrupted account switch before application modules read saved state.
    const journal = read(JOURNAL);
    if (journal) {
      const backup = read(journal.backupKey);
      if (!backup) throw Error('Recovery copy missing');
      replace(backup); put(OWNER, journal.before); storage.removeItem(JOURNAL);
    }
    let owner = read(OWNER);
    if (!owner) {
      owner = { id: 'guest', token: token() };
      put(OWNER, owner);
      // Old releases never recorded ownership. Preserve their work as guest work;
      // it must be explicitly selected before it can be uploaded to an account.
      put(META, null);
      if (Object.keys(gather()).length) storage.setItem(DIRTY, token());
    }
    if (owner.transition) throw Error('Account transition needs recovery');
    let user = null, epoch = 0, paused = false, state = 'idle', timer = null, running = null, conflict = null;
    const dirty = () => storage.getItem(DIRTY) || '';
    const meta = () => { const m = read(META); return m?.owner === owner.id ? m : null; };
    const snapshot = () => ({ data: gather(), meta: meta(), dirty: dirty(), savedAt: new Date().toISOString() });
    const setState = value => { state = value; onState(value); };
    function owns() {
      const saved = read(OWNER);
      return !paused && !saved?.transition && saved?.token === owner.token;
    }
    function block(message, kind = 'storage') { paused = true; clearTimeout(timer); setState('paused'); onBlocked(message, kind); }
    function beforeWrite(k) {
      if (syncKey(k) && !owns()) {
        block('The active workspace changed in another tab. Reload before continuing.', 'workspace');
        throw Error('Account workspace changed');
      }
      // Persist the intent first. A quota failure must not leave a new study
      // value behind without the marker that protects it from a cloud pull.
      if (syncKey(k)) storage.setItem(DIRTY, token());
    }
    function afterWrite(k) {
      if (!syncKey(k)) return;
      if (user && state !== 'conflict') schedule();
    }
    function transition(id, next) {
      if (!owns()) throw Error('Account workspace changed');
      // Save the old copy before touching any live key. Quota failures stop here.
      const backupKey = archiveKey(owner.id);
      put(backupKey, snapshot());
      put(JOURNAL, { before: owner, backupKey });
      const nextOwner = { id, token: token() };
      paused = true; clearTimeout(timer);
      try {
        put(OWNER, { ...owner, transition: true });
        replace(next);
        put(OWNER, nextOwner);
        storage.removeItem(JOURNAL);
        owner = nextOwner;
      } catch (error) {
        // The journal remains available if rollback itself fails or the tab closes.
        try { replace(read(backupKey)); put(OWNER, owner); storage.removeItem(JOURNAL); } catch {}
        block('Could not replace saved work. Download a recovery copy, restore browser storage access, then reload to recover the previous workspace.');
        throw error;
      }
      onReload();
    }
    const alive = (id, generation) => owns() && user?.id === id && epoch === generation;
    async function pull(id) {
      const { data, error } = await client.from('progress').select('data, updated_at').eq('user_id', id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      if (typeof data.updated_at !== 'string' || !Number.isFinite(Date.parse(data.updated_at))) throw Error('Invalid cloud revision');
      return { data: validData(data.data), updated_at: data.updated_at };
    }
    function saveBase(row) { put(META, { owner: owner.id, known: true, revision: row?.updated_at || null }); }
    function sameData(a, b) {
      const keys = Object.keys(a); return keys.length === Object.keys(b).length && keys.every(k => a[k] === b[k]);
    }
    function detectConflict(row) { conflict = row; setState('conflict'); }
    async function reconcile(id, generation) {
      const row = await pull(id);
      if (!alive(id, generation)) return;
      const base = meta();
      if (dirty()) {
        if ((base?.known && base.revision === (row?.updated_at || null)) || (!base?.known && !row)) {
          saveBase(row); await push(id, generation);
        } else if (row && sameData(gather(), row.data)) {
          saveBase(row); storage.removeItem(DIRTY); setState('synced');
        } else detectConflict(row);
      } else if (row && !sameData(gather(), row.data)) {
        transition(owner.id, { data: row.data, meta: { owner: owner.id, known: true, revision: row.updated_at } });
      } else if (!row && Object.keys(gather()).length) {
        // A removed remote row is also a conflict, not permission to recreate it.
        detectConflict(null);
      } else { saveBase(row); setState('synced'); }
    }
    async function push(id, generation) {
      if (!alive(id, generation) || !dirty()) return;
      const base = meta();
      if (!base?.known) throw Error('Cloud must be read before uploading');
      const dirtyAtStart = dirty(), data = gather();
      const updated_at = new Date(Math.max(Date.now(), (Date.parse(base.revision) || 0) + 1)).toISOString();
      let result;
      if (base.revision) {
        result = await client.from('progress').update({ data, updated_at }).eq('user_id', id).eq('updated_at', base.revision).select('updated_at').maybeSingle();
      } else {
        result = await client.from('progress').insert({ user_id: id, data, updated_at }).select('updated_at').maybeSingle();
      }
      if (!alive(id, generation)) return;
      if (result.error?.code === '23505' || (!result.error && !result.data)) {
        const row = await pull(id);
        if (alive(id, generation)) detectConflict(row);
        return;
      }
      if (result.error) throw result.error;
      // Postgres returns its own timestamp representation (often +00:00 rather
      // than Z). Keep that exact revision for the next read and conditional write.
      if (typeof result.data?.updated_at !== 'string' || !Number.isFinite(Date.parse(result.data.updated_at))) throw Error('Missing saved revision');
      saveBase(result.data);
      if (dirty() === dirtyAtStart) storage.removeItem(DIRTY);
      setState('synced');
      if (dirty()) schedule();
    }
    function schedule() {
      clearTimeout(timer);
      if (!user || paused || state === 'conflict') return;
      setState('syncing'); timer = setTimeout(() => sync(), 2500);
    }
    async function sync() {
      if (!user || !owns() || state === 'conflict') return;
      if (running) return running;
      const id = user.id, generation = epoch;
      setState('syncing');
      const operation = (async () => {
        try { await reconcile(id, generation); }
        catch { if (alive(id, generation)) setState('error'); }
      })();
      running = operation;
      try { await operation; }
      finally { if (running === operation) running = null; }
    }
    async function setUser(next) {
      if (next?.id === user?.id && owner.id === (next?.id || 'guest') && owns()) return;
      user = next; epoch++; clearTimeout(timer); running = null; conflict = null;
      const id = next?.id || 'guest';
      if (!owns()) return;
      if (owner.id !== id) {
        try { transition(id, read(archiveKey(id)) || { data: {}, meta: null }); }
        catch { block('Saved work could not be switched. Download a recovery copy before reloading.'); }
        return;
      }
      if (user) await sync(); else setState('idle');
    }
    function recovery() {
      const active = read(OWNER);
      // A stale tab must not export the newly selected account's active data.
      const device = active?.token === owner.token && !active.transition ? snapshot() : read(archiveKey(owner.id));
      return { exportedAt: new Date().toISOString(), owner: owner.id, device, cloud: conflict,
        previousDeviceCopy: read(archiveKey(owner.id)), previousCloudCopy: read('cortex-progress-cloud-copy-v1:' + owner.id), guest: read(archiveKey('guest')) };
    }
    function resolve(choice) {
      if (!owns() || !user || state !== 'conflict') return;
      // Both choices retain a browser recovery copy before replacing anything.
      put(archiveKey(owner.id), snapshot());
      put('cortex-progress-cloud-copy-v1:' + owner.id, conflict);
      if (choice === 'cloud') {
        transition(owner.id, { data: conflict?.data || {}, meta: { owner: owner.id, known: true, revision: conflict?.updated_at || null } });
      } else if (choice === 'device') {
        saveBase(conflict); conflict = null; setState('idle'); schedule();
      }
    }
    function useGuest() {
      const guest = read(archiveKey('guest'));
      if (!owns() || !user || !guest || !meta()?.known || ['conflict', 'syncing', 'error'].includes(state)) return false;
      transition(owner.id, { data: guest.data, meta: meta(), dirty: token() }); return true;
    }
    const restores = new WeakMap();
    function portableSnapshot() {
      if (!owns()) throw Error('The active workspace changed. Reload before preparing a backup.');
      return { owner: owner.id, data: gather() };
    }
    function prepareRestore(data) {
      // Both the restore and reset dialogs print this message, so keep it flow-neutral.
      if (!owns() || (owner.id !== 'guest' && !user)) throw Error('Finish signing in before replacing saved work.');
      if (state === 'conflict') throw Error('Resolve the saved-copy conflict before replacing saved work.');
      if (running || state === 'syncing') throw Error('Saving to your account is still in progress. Try again in a moment.');
      const next = validData(data);
      if (Object.keys(next).length !== Object.keys(data).length) throw Error('The backup contains unsupported storage keys.');
      const before = gather(), keys = [...new Set([...Object.keys(before), ...Object.keys(next)])].sort();
      const preview = Object.freeze({ owner: owner.id, changes: Object.freeze(keys.map(key => Object.freeze({ key,
        action: !(key in next) ? 'remove' : !(key in before) ? 'add' : before[key] === next[key] ? 'keep' : 'replace' }))) });
      restores.set(preview, { next, before, token: owner.token });
      return preview;
    }
    function restore(preview) {
      const saved = restores.get(preview);
      if (!saved || saved.token !== owner.token || !owns() || running || ['syncing', 'conflict'].includes(state) || !sameData(saved.before, gather())) {
        throw Error('Saved work changed after the preview. Choose the backup again before restoring.');
      }
      // Use the account transaction, including its journal and startup rollback.
      // Retain the known cloud revision; the next sync still has to compare it.
      restores.delete(preview);
      epoch++;
      transition(owner.id, { data: saved.next, meta: meta(), dirty: token() });
      return true;
    }
    return { beforeWrite, afterWrite, setUser, sync, resolve, useGuest, recovery, gather, portableSnapshot, prepareRestore, restore,
      checkOwner() { if (!owns()) block('The active workspace changed in another tab. Reload before continuing.', 'workspace'); },
      get state() { return state; }, get owner() { return owner.id; }, get paused() { return paused; },
      get hasGuest() { return !!read(archiveKey('guest')) && Object.keys(read(archiveKey('guest')).data).length > 0; },
      stop() { clearTimeout(timer); epoch++; paused = true; }
    };
  }
  return { create, syncKey, OWNER, JOURNAL, archiveKey };
});
