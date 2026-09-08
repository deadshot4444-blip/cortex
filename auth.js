/* ============================================================
   Cortex — optional accounts + cross-device progress sync (Supabase)
   Accounts are OPTIONAL. Study progress is stored locally;
   each account has separate saved work. Guest work can be explicitly copied into
   an account. Conflicting device edits pause for a choice instead of overwriting.

   SETUP (one time):
   1. Create a free project at supabase.com
   2. Settings -> API: copy the Project URL + the "anon public" key into the two
      constants below.
   3. SQL editor: run the snippet in SUPABASE_SCHEMA.sql (provided separately).
   4. Authentication -> URL Configuration: set Site URL to https://cortexmedical.academy
      (add http://localhost:4173 to "Redirect URLs" for local testing).
   Until the two constants are filled in, the account button stays hidden and the
   app behaves exactly as before.
   ============================================================ */

const SUPABASE_URL = 'https://fpsqsntbhilrdtlemoos.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wDu3ys37LZE7SPXz32SsQQ_wbRel6K8';  // publishable key — safe to expose; RLS protects data

const AUTH_ENABLED =
  /^https:\/\/.+\.supabase\.co/.test(SUPABASE_URL) &&
  SUPABASE_ANON_KEY.length > 30 &&
  typeof window.supabase !== 'undefined';

let sb = null;
let currentUser = null;
let syncState = 'idle';
let progress = null;
let authFailure = false;

function downloadProgress() {
  let copies;
  try { copies = progress?.recovery() || { recoveryError: 'Account storage is unavailable.' }; }
  catch { copies = { recoveryError: 'Account copies could not be read. Keep this tab open.' }; }
  if (typeof StudyStorage !== 'undefined') copies.studyDrafts = StudyStorage.recovery();
  const blob = new Blob([JSON.stringify(copies, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = 'cortex-progress-recovery.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function accountBlocked(message, kind) {
  if (kind === 'workspace' && typeof StudyStorage !== 'undefined') {
    StudyStorage.workspaceChanged();
    return;
  }
  if (document.getElementById('account-work-paused')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'account-work-paused';
  dialog.setAttribute('aria-labelledby', 'account-paused-title');
  dialog.style.cssText = 'max-width:480px;width:calc(100% - 32px);box-sizing:border-box;padding:24px;border-radius:16px;line-height:1.6';
  dialog.innerHTML = '<h2 id="account-paused-title">Saving is paused</h2><p></p><div class="fbmodal-btns"><button class="btn" data-download>Download recovery copy</button><button class="btn btn-solid" data-reload>Reload</button></div><p role="status"></p>';
  dialog.querySelector('p').textContent = message;
  dialog.querySelector('[data-reload]').onclick = () => location.reload();
  dialog.querySelector('[data-download]').onclick = () => {
    try { downloadProgress(); } catch { dialog.querySelector('[role="status"]').textContent = 'Could not prepare a download. Keep this tab open.'; }
  };
  dialog.addEventListener('cancel', e => e.preventDefault());
  document.body.appendChild(dialog); dialog.showModal();
}

/* ---------- auth actions ---------- */
async function sendMagicLink(email) {
  try { return await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + '/' } }); }
  catch (error) { return { error }; }
}
async function signOut() {
  try {
    // A failed SDK sign-out must not be reported as success.
    const { error } = await sb.auth.signOut({ scope: 'local' });
    if (error) return { error };
    currentUser = null;
    await progress.setUser(null);
    refreshAuthUI();
    return {};
  } catch (error) { return { error }; }
}

/* ---------- UI ---------- */
function setSyncState(s) { syncState = s; refreshAuthUI(); }

function refreshAuthUI() {
  document.querySelectorAll('[data-acct]').forEach(btn => {
    if (!AUTH_ENABLED) { btn.hidden = true; return; }
    btn.hidden = false;
    if (currentUser) {
      const tip = { syncing: 'Saving…', synced: 'Saved ✓', error: 'Sync error', conflict: 'Choose a saved copy', paused: 'Saving paused', idle: '' }[syncState] || '';
      btn.innerHTML = `<i class="acct-dot ${syncState}"></i>Account`;
      btn.title = `${currentUser.email}${tip ? ' · ' + tip : ''}`;
    } else {
      btn.innerHTML = 'Sign in';
      btn.title = 'Optional — save your progress to your email';
    }
    if (!btn.dataset.wired) { btn.dataset.wired = '1'; btn.addEventListener('click', openAuth); }
  });
}

function openAuth() {
  if (authFailure) { accountBlocked('Account storage is unavailable. Saving cannot be confirmed. Free browser storage and reload.'); return; }
  const signedIn = !!currentUser;
  const back = document.createElement('div');
  back.className = 'fbmodal-back';
  back.innerHTML = signedIn ? `
    <div class="fbmodal" role="dialog" aria-modal="true">
      <span class="label">Your account</span>
      <h3>Signed in</h3>
      <p class="fbmodal-sub">${escapeHTML(currentUser.email)}</p>
      <p class="acct-state acct-${syncState}">${{ syncing: 'Checking and saving your progress…', synced: 'Your latest saved copy is synced. This device checks for changes when you return or save.', error: 'Sync could not finish. Your local changes remain on this device. Retry before relying on another device.', conflict: 'This device and the cloud have different saved work. Sync is paused. Download both copies before choosing which one to continue with.', paused: 'Saving is paused. Reload to continue with the active account.', idle: 'Connected.' }[syncState] || ''}</p>
      ${syncState === 'conflict' ? '<p>Loading cloud work replaces the active device copy. Keeping device work replaces the cloud copy if it has not changed again. A recovery copy stays in this browser.</p><div class="fbmodal-btns"><button class="btn" data-cloud>Load cloud work</button><button class="btn" data-device>Keep device work</button></div>' : ''}
      ${progress?.hasGuest ? '<details><summary>Guest work saved in this browser</summary><p>Guest progress stays separate from this account. Copying it here replaces this account’s active progress and syncs that copy. Download your recovery copies first.</p><button class="btn" data-guest>Use guest work in this account</button></details>' : ''}
      <div class="fbmodal-btns">
        <button class="btn" data-download>Download recovery copies</button>
        ${syncState === 'error' ? '<button class="btn" data-retry>Retry sync</button>' : ''}
        <button class="btn" data-x>Close</button>
        <button class="btn btn-solid" data-signout>Sign out</button>
      </div>
      <p class="fbmodal-status" role="status"></p>
    </div>` : `
    <div class="fbmodal" role="dialog" aria-modal="true">
      <span class="label">Optional account</span>
      <h3>Save your progress</h3>
      <p class="fbmodal-sub">Your progress saves on this device. Sign in to open your account’s saved work and sync it across devices. Guest work stays separate; you can choose to copy it into your account afterward. We email you a one-tap sign-in link.</p>
      <input id="auth-email" type="email" placeholder="you@email.com" autocomplete="email">
      <div class="fbmodal-btns">
        <button class="btn" data-x>Cancel</button>
        <button class="btn btn-solid" data-send>Email me a link</button>
      </div>
      <div class="fbmodal-status" id="auth-status"></div>
      <p class="fbmodal-mail">100% optional. We only use your email to save your progress &mdash; nothing else.</p>
    </div>`;
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const modal = back.querySelector('.fbmodal');
  modal.style.maxHeight = 'calc(100dvh - 32px)'; modal.style.overflowY = 'auto';
  modal.setAttribute('aria-labelledby', 'auth-dialog-title');
  modal.querySelector('h3').id = 'auth-dialog-title';
  back.querySelectorAll('.fbmodal-btns').forEach(row => {
    row.style.flexWrap = 'wrap';
    row.querySelectorAll('button').forEach(button => { button.style.flex = '1 1 110px'; });
  });
  const onKey = e => { if (e.key === 'Escape') close(); };
  back.addEventListener('click', e => { if (e.target === back) close(); });
  back.querySelector('[data-x]').addEventListener('click', close);
  document.addEventListener('keydown', onKey);

  if (signedIn) {
    const status = back.querySelector('[role="status"]');
    back.querySelector('[data-signout]').addEventListener('click', async e => {
      e.currentTarget.disabled = true;
      const { error } = await signOut();
      if (error) { status.textContent = 'Sign-out could not finish. Try again; this account is still active.'; back.querySelector('[data-signout]').disabled = false; }
      else close();
    });
    back.querySelector('[data-download]').onclick = () => {
      try { downloadProgress(); status.textContent = 'Recovery download prepared.'; }
      catch { status.textContent = 'Could not prepare the download. Keep this tab open.'; }
    };
    back.querySelector('[data-retry]')?.addEventListener('click', async () => { await progress.sync(); close(); openAuth(); });
    for (const choice of ['cloud', 'device']) back.querySelector('[data-' + choice + ']')?.addEventListener('click', () => {
      try { progress.resolve(choice); close(); }
      catch { status.textContent = 'Could not save a recovery copy. Your active progress has not been replaced.'; }
    });
    back.querySelector('[data-guest]')?.addEventListener('click', () => {
      try { if (!progress.useGuest()) status.textContent = 'Finish syncing or resolve the saved-copy conflict first.'; }
      catch { status.textContent = 'Could not save a recovery copy. Your active progress has not been replaced.'; }
    });
  } else {
    const send = back.querySelector('[data-send]');
    send.addEventListener('click', async () => {
      const email = back.querySelector('#auth-email').value.trim();
      const status = back.querySelector('#auth-status');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { status.textContent = 'Enter a valid email.'; status.className = 'fbmodal-status err'; return; }
      send.disabled = true; status.textContent = 'Sending…'; status.className = 'fbmodal-status';
      const { error } = await sendMagicLink(email);
      if (error) { status.textContent = 'Couldn’t send right now — try again in a moment.'; status.className = 'fbmodal-status err'; send.disabled = false; }
      else { status.textContent = 'Check your email for a one-tap sign-in link. 📧'; status.className = 'fbmodal-status ok'; }
    });
  }
  document.body.appendChild(back);
  if (window.trapModal) window.trapModal(back);
  setTimeout(() => back.querySelector('#auth-email')?.focus(), 30);
}

function escapeHTML(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
window.refreshAuthUI = refreshAuthUI;
window.openAuth = openAuth;
window.CortexAccount = Object.freeze({
  get available() { return !!progress && !authFailure; },
  get label() { return progress?.owner === 'guest' ? 'Guest workspace on this device' : currentUser?.email || 'Saved account workspace'; },
  get state() { return progress?.state || 'unavailable'; },
  snapshot() { if (!progress) throw Error('Saved-work storage is unavailable. Reload to retry.'); return progress.portableSnapshot(); },
  prepareRestore(data) { if (!progress) throw Error('Saved-work storage is unavailable.'); return progress.prepareRestore(data); },
  restore(preview) { return progress.restore(preview); },
  downloadRecovery: downloadProgress,
});

/* ---------- init ---------- */
function initAuth() {
  try {
    const rawSet = Storage.prototype.setItem, rawRemove = Storage.prototype.removeItem, rawClear = Storage.prototype.clear;
    const raw = {
      get length() { return localStorage.length; }, key: i => localStorage.key(i),
      getItem: k => localStorage.getItem(k),
      setItem: (k, v) => rawSet.call(localStorage, k, v), removeItem: k => rawRemove.call(localStorage, k)
    };
    // Patch the prototype: assigning methods on a Storage instance can create
    // named storage entries instead of observing writes in some browsers.
    Storage.prototype.setItem = function (key, value) {
      key = String(key);
      if (this === localStorage && CortexProgress.syncKey(key)) {
        if (!progress || authFailure) throw Error('Saved-work storage is unavailable');
        progress.beforeWrite(key);
      }
      rawSet.call(this, key, value);
      if (this === localStorage) progress?.afterWrite(key);
    };
    Storage.prototype.removeItem = function (key) {
      key = String(key); const existed = this.getItem(key) !== null;
      if (this === localStorage && CortexProgress.syncKey(key)) {
        if (!progress || authFailure) throw Error('Saved-work storage is unavailable');
        progress.beforeWrite(key);
      }
      rawRemove.call(this, key);
      if (this === localStorage && existed) progress?.afterWrite(key);
    };
    Storage.prototype.clear = function () {
      if (this !== localStorage) return rawClear.call(this);
      // App resets clear study keys, preserving account ownership and recovery copies.
      const keys = Object.keys(progress.gather());
      for (const key of keys) this.removeItem(key);
    };
    if (AUTH_ENABLED) sb = window.__cortexSB || (window.__cortexSB = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
    progress = CortexProgress.create({ storage: raw, client: sb, onState: setSyncState,
      onReload: () => location.reload(), onBlocked: accountBlocked });
    window.addEventListener('storage', e => {
      if (e.storageArea === localStorage && (e.key === null || e.key === CortexProgress.OWNER)) progress.checkOwner();
    });
  } catch {
    authFailure = true; syncState = 'error'; refreshAuthUI();
    accountBlocked('Browser storage could not be opened safely. Keep this tab open and free some browser storage before reloading.');
    return;
  }
  if (!AUTH_ENABLED) {
    // Guest backups and transaction recovery do not require an account SDK.
    // A missing SDK is not evidence that a saved account became a guest.
    if (progress.owner !== 'guest') {
      progress.stop();
      accountBlocked('Sign-in support could not load. Your saved account workspace is retained. Reload with a connection before changing it.');
    }
    refreshAuthUI(); return;
  }
  // Keep SDK callbacks synchronous; start database requests after the auth event returns.
  sb.auth.onAuthStateChange((event, session) => {
    if (!['SIGNED_IN', 'INITIAL_SESSION', 'TOKEN_REFRESHED', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) return;
    setTimeout(async () => {
      currentUser = session?.user || null;
      await progress.setUser(currentUser);
      refreshAuthUI();
    }, 0);
  });
  refreshAuthUI();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') progress.sync(); });
  window.addEventListener('online', () => progress.sync());
}
// This script runs before app.js so interrupted storage transactions recover first.
initAuth();
