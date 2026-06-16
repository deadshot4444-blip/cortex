/* ============================================================
   Cortex — optional accounts + cross-device progress sync (Supabase)
   Accounts are OPTIONAL. The app works fully offline with localStorage;
   signing in just backs that up to the user's email and syncs it across devices.

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

const SUPABASE_URL = 'https://cgumxqqlyjwypdqgvstk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xsvIj1XPZGGqe09zgCewHQ_fj7W_dRp';  // publishable key — safe to expose; RLS protects data

const AUTH_ENABLED =
  /^https:\/\/.+\.supabase\.co/.test(SUPABASE_URL) &&
  SUPABASE_ANON_KEY.length > 30 &&
  typeof window.supabase !== 'undefined';

let sb = null;
let currentUser = null;
let pushTimer = null;
let syncState = 'idle';   // idle | syncing | synced | error
let syncedThisLoad = false;

const SYNC_KEYS = (k) => k.startsWith('cs-') && k !== 'cs-counted' && k !== 'cs-sync-meta';

/* ---------- progress blob helpers ---------- */
function gatherProgress() {
  const o = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (SYNC_KEYS(k)) o[k] = localStorage.getItem(k);
  }
  return o;
}
function applyProgress(obj) {
  if (!obj) return;
  Object.keys(obj).forEach(k => { if (SYNC_KEYS(k)) _setItem(k, obj[k]); });
}
function isEmptyBlob(obj) { return !obj || Object.keys(obj).length === 0; }
function getMeta() { try { return JSON.parse(localStorage.getItem('cs-sync-meta') || 'null'); } catch { return null; } }
function setMeta(m) { try { _setItem('cs-sync-meta', JSON.stringify(m)); } catch {} }

/* keep a raw reference so our own writes don't trigger a sync loop */
const _setItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function (k, v) {
  _setItem(k, v);
  if (currentUser && SYNC_KEYS(k)) schedulePush();
};

/* ---------- cloud read/write ---------- */
async function pullCloud(uid) {
  try {
    const { data, error } = await sb.from('progress').select('data, updated_at').eq('user_id', uid).maybeSingle();
    if (error) return null;
    return data;
  } catch { return null; }
}
async function pushCloud(uid) {
  if (!uid) return;
  setSyncState('syncing');
  try {
    const updated_at = new Date().toISOString();
    const { error } = await sb.from('progress').upsert({ user_id: uid, data: gatherProgress(), updated_at }, { onConflict: 'user_id' });
    if (error) { setSyncState('error'); return; }
    setMeta({ updatedAt: updated_at });
    setSyncState('synced');
  } catch { setSyncState('error'); }
}
function schedulePush() {
  if (!currentUser) return;
  setSyncState('syncing');
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushCloud(currentUser.id), 2500);
}

/* ---------- sync on login: last-write-wins at the blob level ---------- */
async function syncOnLogin(user) {
  if (syncedThisLoad) return;
  syncedThisLoad = true;
  currentUser = user;
  refreshAuthUI();
  const cloud = await pullCloud(user.id);
  const meta = getMeta();
  if (!cloud || isEmptyBlob(cloud.data)) {        // fresh account -> push what's on this device
    await pushCloud(user.id);
    return;
  }
  const cloudNewer = !meta || new Date(cloud.updated_at) > new Date(meta.updatedAt || 0);
  if (cloudNewer) {                               // adopt the saved (cloud) progress
    applyProgress(cloud.data);
    setMeta({ updatedAt: cloud.updated_at });
    setSyncState('synced');
    if (!sessionStorage.getItem('cs-sync-reloaded')) {
      sessionStorage.setItem('cs-sync-reloaded', '1');
      location.reload();                          // re-read localStorage cleanly
    } else {
      refreshAuthUI();
    }
  } else {                                        // this device is newer -> push up
    await pushCloud(user.id);
  }
}

/* ---------- auth actions ---------- */
async function sendMagicLink(email) {
  return sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
}
async function signOut() {
  try { await sb.auth.signOut(); } catch {}
  currentUser = null;
  setMeta(null);
  setSyncState('idle');
  refreshAuthUI();
}

/* ---------- UI ---------- */
function setSyncState(s) { syncState = s; refreshAuthUI(); }

function refreshAuthUI() {
  document.querySelectorAll('[data-acct]').forEach(btn => {
    if (!AUTH_ENABLED) { btn.hidden = true; return; }
    btn.hidden = false;
    if (currentUser) {
      const tip = { syncing: 'Saving…', synced: 'Saved ✓', error: 'Sync error', idle: '' }[syncState] || '';
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
  const signedIn = !!currentUser;
  const back = document.createElement('div');
  back.className = 'fbmodal-back';
  back.innerHTML = signedIn ? `
    <div class="fbmodal" role="dialog" aria-modal="true">
      <span class="label">Your account</span>
      <h3>Signed in</h3>
      <p class="fbmodal-sub">${escapeHTML(currentUser.email)}</p>
      <p class="acct-state acct-${syncState}">${{ syncing: 'Saving your progress…', synced: 'Your progress is backed up and syncing across your devices.', error: 'Couldn’t reach the server — your progress is still safe on this device.', idle: 'Connected.' }[syncState] || ''}</p>
      <div class="fbmodal-btns">
        <button class="btn" data-x>Close</button>
        <button class="btn btn-solid" data-signout>Sign out</button>
      </div>
    </div>` : `
    <div class="fbmodal" role="dialog" aria-modal="true">
      <span class="label">Optional account</span>
      <h3>Save your progress</h3>
      <p class="fbmodal-sub">Your progress already saves automatically on this device. Sign in with your email to back it up and sync it across your devices &mdash; no password, we just email you a one-tap sign-in link.</p>
      <input id="auth-email" type="email" placeholder="you@email.com" autocomplete="email">
      <div class="fbmodal-btns">
        <button class="btn" data-x>Cancel</button>
        <button class="btn btn-solid" data-send>Email me a link</button>
      </div>
      <div class="fbmodal-status" id="auth-status"></div>
      <p class="fbmodal-mail">100% optional. We only use your email to save your progress &mdash; nothing else.</p>
    </div>`;
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  back.addEventListener('click', e => { if (e.target === back) close(); });
  back.querySelector('[data-x]').addEventListener('click', close);
  document.addEventListener('keydown', onKey);

  if (signedIn) {
    back.querySelector('[data-signout]').addEventListener('click', async () => { await signOut(); close(); });
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
  setTimeout(() => back.querySelector('#auth-email')?.focus(), 30);
}

function escapeHTML(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
window.refreshAuthUI = refreshAuthUI;
window.openAuth = openAuth;

/* ---------- init ---------- */
function initAuth() {
  if (!AUTH_ENABLED) { refreshAuthUI(); return; }
  // singleton: never create more than one client in this context
  sb = window.__cortexSB || (window.__cortexSB = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
  sb.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        syncOnLogin(session.user);
      }
    } else if (event === 'SIGNED_OUT') {
      currentUser = null; refreshAuthUI();
    }
  });
  refreshAuthUI();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && currentUser) { clearTimeout(pushTimer); pushCloud(currentUser.id); }
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAuth);
else initAuth();
