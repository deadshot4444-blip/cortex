/* Shared study persistence: retain drafts, refuse stale writes, and expose recovery. */
const StudyStorage = (() => {
  const stores = new Map();
  const damaged = new Set();
  const recoveryPrefix = 'cortex-dat-recovery-v1:';
  const datRecords = {
    'cs-dat-log': 'DAT attempt log',
    'cs-dat-q': 'DAT question history',
    'cs-dat-srs': 'DAT mistake-review schedule',
    'cs-dat-r-drill': 'Unfinished science drill',
    'cs-dat-r-review': 'Unfinished mistake review',
    'cs-dat-r-pat': 'Unfinished perceptual-ability set',
    'cs-dat-r-qr': 'Unfinished quantitative-reasoning set',
    'cs-dat-r-rc': 'Unfinished reading-comprehension set',
  };
  let problem = null,
    dialog = null,
    allowReload = false;
  const ownerKey = typeof CortexProgress !== 'undefined' ? CortexProgress.OWNER : null;
  let owner = null,
    ownerReadable = true;
  try {
    if (ownerKey) owner = localStorage.getItem(ownerKey);
  } catch {
    ownerReadable = false;
  }
  const parse = raw => {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  };
  const sameOwner = () => ownerReadable && (!ownerKey || localStorage.getItem(ownerKey) === owner);
  function recovery() {
    let currentOwner = null;
    try {
      if (ownerReadable) currentOwner = sameOwner();
    } catch {}
    const records = {};
    for (const [key, store] of stores) {
      let saved = store.last,
        readable = store.readable;
      if (currentOwner)
        try {
          saved = localStorage.getItem(key);
          readable = true;
        } catch {
          readable = false;
        }
      let thisTab;
      try {
        thisTab = JSON.parse(
          JSON.stringify(
            store.current
              ? store.current()
              : store.serialize
                ? parse(store.serialize())
                : parse(store.pending ? store.next : store.last)
          )
        );
      } catch {
        thisTab = { recoveryError: 'This draft could not be serialized. Copy important notes from the open page.' };
      }
      records[key] = {
        thisTab,
        saved: parse(saved),
        savedRaw: saved,
        savedReadable: readable,
        savedSource: currentOwner ? 'current browser copy' : 'last copy read by this tab',
      };
    }
    const datRecoveries = [];
    if (currentOwner)
      try {
        const id = parse(owner)?.id || 'guest';
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key?.startsWith(recoveryPrefix)) continue;
          const copy = parse(localStorage.getItem(key));
          if (copy?.owner === id) datRecoveries.push(copy);
        }
      } catch {
        // Current drafts remain exportable if older recovery copies cannot be read.
      }
    return {
      exportedAt: new Date().toISOString(),
      purpose: 'Cortex study save recovery',
      accountChanged: currentOwner === null ? null : !currentOwner,
      records,
      datRecoveries,
    };
  }
  function download() {
    const blob = new Blob([JSON.stringify(recovery(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = 'cortex-progress-copies.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function markDamaged(keys) {
    for (const key of Array.isArray(keys) ? keys : [keys])
      if (Object.hasOwn(datRecords, key) && stores.has(key) && stores.get(key).last !== null) damaged.add(key);
  }
  function recoverySnapshot() {
    if (!['session', 'read'].includes(problem) || !damaged.size || !sameOwner())
      throw Error('The saved workspace changed. Reload before recovering DAT records.');
    const snapshot = window.CortexAccount.snapshot();
    for (const [key, store] of stores) {
      if ((!store.readable && !damaged.has(key)) || (snapshot.data[key] ?? null) !== store.last)
        throw Error('Saved work changed or cannot be read. Download recovery copies and reload before trying again.');
    }
    return snapshot;
  }
  function previewDatRecovery() {
    const host = dialog.querySelector('#study-dat-recovery'),
      status = dialog.querySelector('#study-conflict-status');
    host.replaceChildren();
    host.hidden = false;
    try {
      const before = recoverySnapshot(),
        next = { ...before.data },
        keys = [...damaged].sort();
      for (const key of keys) delete next[key];
      const preview = window.CortexAccount.prepareRestore(next);
      host.innerHTML =
        '<h3>Restart only the affected DAT records</h3><ul></ul><p>A separate recovery copy will keep the original saved workspace and unwritten work from this tab. Other saved records stay in place. Reload continues from saved work; drafts remain in the recovery download available under Your study data.</p><label style="display:block;margin:12px 0"><input type="checkbox" id="study-dat-confirm"> I want to restart only the records listed above.</label><button class="btn" id="study-dat-apply" disabled>Keep recovery copy and restart</button><button class="btn" id="study-dat-cancel">Cancel</button>';
      for (const key of keys) {
        const row = document.createElement('li');
        row.textContent = datRecords[key];
        host.querySelector('ul').appendChild(row);
      }
      for (const button of host.querySelectorAll('button'))
        button.style.cssText =
          'color:#fff;border-color:#a5bac6;background:transparent;min-height:44px;white-space:normal';
      const checkbox = host.querySelector('#study-dat-confirm'),
        apply = host.querySelector('#study-dat-apply');
      checkbox.onchange = () => (apply.disabled = !checkbox.checked);
      host.querySelector('#study-dat-cancel').onclick = () => {
        host.replaceChildren();
        host.hidden = true;
        dialog.querySelector('#study-dat-recover').focus();
        status.textContent = 'Recovery canceled. Your saved work is unchanged.';
      };
      apply.onclick = () => {
        if (!checkbox.checked) return;
        apply.disabled = true;
        try {
          const snapshot = recoverySnapshot();
          if (
            Object.keys(snapshot.data).length !== Object.keys(before.data).length ||
            !Object.keys(before.data).every(key => snapshot.data[key] === before.data[key])
          )
            throw Error('Saved work changed after the preview. Review a fresh recovery preview.');
          const drafts = recovery().records;
          if (Object.values(drafts).some(record => record.thisTab?.recoveryError))
            throw Error('An unwritten draft could not be copied. Keep this tab open and copy it before restarting.');
          // Keep an immutable, account-labelled copy before the account transaction's
          // rolling archive is replaced. Include tab drafts as well as exact disk bytes.
          const copy = JSON.stringify({
            owner: snapshot.owner,
            exportedAt: new Date().toISOString(),
            purpose: 'Cortex DAT scoped recovery',
            affectedKeys: keys,
            savedWorkspace: snapshot.data,
            drafts,
          });
          let archiveKey;
          do {
            archiveKey = recoveryPrefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
          } while (localStorage.getItem(archiveKey) !== null);
          localStorage.setItem(archiveKey, copy);
          if (localStorage.getItem(archiveKey) !== copy) throw Error('The recovery copy could not be saved.');
          // The existing account transaction archives exact raw values, rejects stale
          // previews and rolls back interrupted writes before the next app boot.
          allowReload = true;
          window.CortexAccount.restore(preview);
        } catch (error) {
          allowReload = false;
          host.replaceChildren();
          host.hidden = true;
          status.textContent = error.message + ' The restart did not complete; keep this tab open.';
        }
      };
      checkbox.focus();
      status.textContent = 'Nothing has changed. Review the affected records before continuing.';
    } catch (error) {
      host.hidden = true;
      status.textContent = error.message;
    }
  }
  function showProblem(kind) {
    if (problem && problem !== 'write' && kind === 'write') return;
    if (['account', 'conflict'].includes(problem) && ['read', 'session'].includes(kind)) return;
    const first = !problem;
    problem = kind;
    if (first) {
      window.dispatchEvent(new Event('study-storage-paused'));
      if (kind === 'conflict') window.dispatchEvent(new Event('study-storage-conflict'));
    }
    if (!document.body) return;
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'study-save-conflict';
      dialog.setAttribute('aria-labelledby', 'study-conflict-title');
      dialog.setAttribute('aria-describedby', 'study-conflict-description');
      dialog.style.cssText =
        'box-sizing:border-box;position:fixed;inset:0;margin:auto;width:min(480px,calc(100vw - 32px));max-height:85vh;overflow:auto;padding:24px;border:1px solid #71828b;border-radius:16px;background:#102029;color:#fff;line-height:1.6';
      dialog.innerHTML =
        '<h2 id="study-conflict-title"></h2><p id="study-conflict-description"></p><p>Keep this tab open. Download the available copies before reloading if you have work to keep.</p><div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn" id="study-conflict-export">Download recovery copies</button><button class="btn" id="study-save-retry">Retry saving</button><button class="btn" id="study-conflict-reload">Reload saved work</button><button class="btn" id="study-dat-recover" hidden>Recover DAT records</button></div><section id="study-dat-recovery" hidden></section><p id="study-conflict-status" role="status"></p>';
      dialog.addEventListener('cancel', e => e.preventDefault());
      dialog.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
        }
      });
      for (const button of dialog.querySelectorAll('button'))
        button.style.cssText =
          'color:#fff;border-color:#a5bac6;background:transparent;min-height:44px;white-space:normal';
      dialog.querySelector('#study-conflict-export').onclick = () => {
        try {
          download();
          dialog.querySelector('#study-conflict-status').textContent =
            'Recovery download prepared. It includes drafts still held by this tab.';
        } catch {
          dialog.querySelector('#study-conflict-status').textContent =
            'Download could not be prepared. Keep this tab open and copy important notes.';
        }
      };
      dialog.querySelector('#study-conflict-reload').onclick = () => {
        allowReload = true;
        location.reload();
      };
      dialog.querySelector('#study-save-retry').onclick = retry;
      dialog.querySelector('#study-dat-recover').onclick = previewDatRecovery;
      document.body.appendChild(dialog);
      dialog.showModal();
    }
    dialog.querySelector('#study-conflict-title').textContent =
      kind === 'conflict'
        ? 'Newer study work was saved.'
        : kind === 'account'
          ? 'Your active workspace changed.'
          : kind === 'read'
            ? 'Saved work could not be read.'
            : kind === 'session'
              ? 'Your saved session could not open.'
              : 'Your latest work could not be saved.';
    dialog.querySelector('#study-conflict-description').textContent = {
      conflict:
        'Another tab or account sync changed your progress. Saving is paused here so it cannot replace the newer copy.',
      account:
        'Another tab replaced the saved workspace or changed the active account. This tab cannot overwrite that work. Its recovery download includes only copies already held here.',
      read: 'Saving is paused because the browser copy is unavailable or damaged. It has not been replaced with empty progress. Restore browser storage access, then reload.',
      session:
        'The saved session could not be restored. Its stored copy has been kept. Download it for recovery before reloading or seeking help.',
      write:
        'Your newest work is held in this tab, but saving to this browser failed. Free some browser storage, then retry. Closing or reloading now can lose unsaved work.',
    }[kind];
    const retryButton = dialog.querySelector('#study-save-retry');
    retryButton.hidden = kind !== 'write';
    retryButton.style.display = kind === 'write' ? '' : 'none';
    const recoverButton = dialog.querySelector('#study-dat-recover');
    recoverButton.hidden = !(['session', 'read'].includes(kind) && damaged.size && window.CortexAccount?.available);
    const preview = dialog.querySelector('#study-dat-recovery');
    preview.replaceChildren();
    preview.hidden = true;
  }
  function entry(key) {
    if (stores.has(key)) return stores.get(key);
    const store = { last: null, readable: true, pending: false, next: null, current: null, serialize: null };
    stores.set(key, store);
    try {
      if (!ownerReadable) {
        showProblem('read');
        store.readable = false;
      } else if (!sameOwner()) {
        showProblem('account');
        store.readable = false;
      } else store.last = localStorage.getItem(key);
    } catch {
      store.readable = false;
      showProblem('read');
    }
    return store;
  }
  function read(key, fallback) {
    const store = entry(key),
      raw = store.pending ? store.next : store.last;
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      store.readable = false;
      markDamaged(key);
      showProblem('read');
      return fallback;
    }
  }
  function unchanged(store, key) {
    if (!ownerReadable) {
      showProblem('read');
      return false;
    }
    if (!sameOwner()) {
      showProblem('account');
      return false;
    }
    if (!store.readable) {
      showProblem('read');
      return false;
    }
    if (localStorage.getItem(key) !== store.last) {
      showProblem('conflict');
      return false;
    }
    return true;
  }
  function flush(store, key) {
    if (!unchanged(store, key)) return false;
    if (store.next === null) localStorage.removeItem(key);
    else localStorage.setItem(key, store.next);
    store.last = store.next;
    store.pending = false;
    return true;
  }
  function writeRaw(key, value) {
    const store = entry(key);
    store.next = value === null ? null : String(value);
    store.pending = true;
    store.serialize = null;
    if (problem) return false;
    try {
      return flush(store, key);
    } catch {
      showProblem('write');
      return false;
    }
  }
  function write(key, value) {
    const store = entry(key);
    const serialize = () => {
      const raw = JSON.stringify(value);
      if (raw === undefined) throw new TypeError('Progress is not serializable');
      return raw;
    };
    try {
      return writeRaw(key, serialize());
    } catch {
      store.serialize = serialize;
      store.pending = true;
      showProblem('write');
      return false;
    }
  }
  function watch(key, current) {
    const store = entry(key);
    store.current = current;
    return { save: value => write(key, value) };
  }
  function retry() {
    if (problem !== 'write') return false;
    try {
      for (const [key, store] of stores) if (!unchanged(store, key)) return false;
      // A failed serialization must succeed before any queued write or deletion.
      for (const store of stores.values())
        if (store.pending && store.serialize) {
          store.next = store.serialize();
          store.serialize = null;
        }
      const pending = [...stores]
        .filter(([, s]) => s.pending)
        .sort((a, b) => Number(a[1].next === null) - Number(b[1].next === null));
      for (const [key, store] of pending) if (!flush(store, key)) return false;
      problem = null;
      if (dialog) {
        dialog.close();
        dialog.remove();
        dialog = null;
      }
      window.dispatchEvent(new Event('study-storage-recovered'));
      return true;
    } catch {
      showProblem('write');
      if (dialog)
        dialog.querySelector('#study-conflict-status').textContent =
          'Saving still failed. The pending copies remain in this tab.';
      return false;
    }
  }
  // app.js reads the shared clinical records before this module loads. Adopt the
  // raw copies that tab actually rendered so the storage listener and unchanged()
  // compare against them; a copy that already differs is a conflict, not a base.
  if (typeof studyBootCopies !== 'undefined' && studyBootCopies && typeof studyBootCopies === 'object') {
    for (const [key, raw] of Object.entries(studyBootCopies)) {
      const store = entry(key);
      if (store.readable && store.last !== raw) {
        store.last = raw;
        showProblem('conflict');
      }
    }
  }
  window.addEventListener('storage', event => {
    if (event.storageArea !== localStorage) return;
    try {
      if (!sameOwner()) {
        showProblem('account');
        return;
      }
      for (const [key, store] of stores)
        if ((event.key === null || event.key === key) && store.readable && localStorage.getItem(key) !== store.last) {
          showProblem('conflict');
          break;
        }
    } catch {
      showProblem('read');
    }
  });
  window.addEventListener('beforeunload', event => {
    if (problem && !allowReload) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  return {
    read,
    write,
    writeRaw,
    remove: key => writeRaw(key, null),
    watch,
    retry,
    recovery,
    workspaceChanged: () => showProblem('account'),
    sessionFailed: keys => {
      markDamaged(keys);
      showProblem('session');
    },
    get conflicted() {
      return problem === 'conflict' || problem === 'account';
    },
    get paused() {
      return !!problem;
    },
  };
})();
