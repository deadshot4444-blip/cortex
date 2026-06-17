/* ============================================================
   Cortex — Focus Timer (Pomodoro)
   Study in focused rounds with built-in breaks. The timer is
   timestamp-based, so it keeps running while you study elsewhere
   on the site (a floating pill + the tab title show the countdown)
   and resumes correctly after a reload. Rounds + total focused time
   accumulate across the whole session and persist in localStorage.
   ============================================================ */

const POMO_PRESETS = { focus: [25, 35, 50], break: [5, 10, 15] };
const POMO_DEFAULTS = { mode: 'focus', running: false, deadline: 0, remainMs: 25 * 60000, focusMin: 25, breakMin: 5, rounds: 0, totalFocusMs: 0, totalBreakMs: 0, startedTs: 0 };

let pomo = (function () {
  const d = (typeof loadJSON === 'function') ? loadJSON('cs-pomo', null) : null;
  return Object.assign({}, POMO_DEFAULTS, d && typeof d === 'object' ? d : {});
})();
let pomoTimerId = null;
let pomoBaseTitle = null;
let pomoAudioCtx = null;

function pomoSave() {
  const s = JSON.stringify(pomo);
  if (typeof safeSet === 'function') safeSet('cs-pomo', s);
  else { try { localStorage.setItem('cs-pomo', s); } catch {} }
}

/* ---------- time helpers ---------- */
function pomoPhaseTotalMs() { return (pomo.mode === 'focus' ? pomo.focusMin : pomo.breakMin) * 60000; }
function pomoRemainMs() { return pomo.running ? Math.max(0, pomo.deadline - Date.now()) : Math.max(0, pomo.remainMs); }
function fmtClock(ms) { const s = Math.max(0, Math.round(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
function fmtDur(ms) { const m = Math.round(ms / 60000); const h = Math.floor(m / 60); return h > 0 ? `${h}h ${m % 60}m` : `${m}m`; }

/* ---------- audio cue (no asset, WebAudio) ---------- */
function pomoUnlockAudio() { try { if (!pomoAudioCtx) pomoAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (pomoAudioCtx.state === 'suspended') pomoAudioCtx.resume(); } catch {} }
function pomoDing() {
  try {
    if (!pomoAudioCtx) return;
    const ctx = pomoAudioCtx, t0 = ctx.currentTime;
    [[0, 880], [0.18, 1175]].forEach(([t, f]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + t);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + t + 0.16);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + t); o.stop(t0 + t + 0.18);
    });
  } catch {}
}

/* ---------- state transitions ---------- */
function pomoStart() {
  if (pomo.running) return;
  pomoUnlockAudio();
  pomo.running = true;
  pomo.deadline = Date.now() + (pomo.remainMs > 0 ? pomo.remainMs : pomoPhaseTotalMs());
  if (!pomo.startedTs) pomo.startedTs = Date.now();
  pomoSave(); pomoEnsureTick(); pomoSync();
}
function pomoPause() {
  if (!pomo.running) return;
  pomo.remainMs = pomoRemainMs();
  pomo.running = false;
  pomoSave(); pomoStopTickIfIdle(); pomoSync();
}
function pomoReset() {            // reset the current phase to full; totals untouched
  pomo.running = false; pomo.deadline = 0; pomo.remainMs = pomoPhaseTotalMs();
  pomoSave(); pomoStopTickIfIdle(); pomoSync();
}
function pomoComplete(autostart) {   // current phase finished
  const full = pomoPhaseTotalMs();
  if (pomo.mode === 'focus') { pomo.rounds++; pomo.totalFocusMs += full; }
  else { pomo.totalBreakMs += full; }
  pomo.mode = pomo.mode === 'focus' ? 'break' : 'focus';
  pomo.remainMs = pomoPhaseTotalMs();
  if (autostart) { pomo.running = true; pomo.deadline = Date.now() + pomo.remainMs; pomoDing(); }
  else { pomo.running = false; pomo.deadline = 0; }
  pomoSave(); pomoSync(); if (!pomo.running) pomoStopTickIfIdle();
}
function pomoSkip() {                 // leave current phase early -> next phase, auto-start
  const used = Math.max(0, pomoPhaseTotalMs() - pomoRemainMs());   // count partial time toward totals
  if (pomo.mode === 'focus') pomo.totalFocusMs += used; else pomo.totalBreakMs += used;
  pomo.mode = pomo.mode === 'focus' ? 'break' : 'focus';
  pomo.remainMs = pomoPhaseTotalMs();
  pomo.running = true; pomo.deadline = Date.now() + pomo.remainMs;
  pomoSave(); pomoEnsureTick(); pomoSync();
}
function pomoEndSession() {
  const fm = pomo.focusMin, bm = pomo.breakMin;
  pomo = Object.assign({}, POMO_DEFAULTS, { focusMin: fm, breakMin: bm, mode: 'focus', remainMs: fm * 60000 });
  pomoSave(); pomoStopTickIfIdle(); pomoSync();
}
function pomoSetFocus(m) { pomo.focusMin = m; if (pomo.mode === 'focus' && !pomo.running) pomo.remainMs = m * 60000; pomoSave(); pomoSync(); }
function pomoSetBreak(m) { pomo.breakMin = m; if (pomo.mode === 'break' && !pomo.running) pomo.remainMs = m * 60000; pomoSave(); pomoSync(); }

/* ---------- ticking + chrome (title, floating pill) ---------- */
function pomoEnsureTick() { if (pomo.running && !pomoTimerId) pomoTimerId = setInterval(pomoTick, 500); }
function pomoStopTickIfIdle() { if (!pomo.running && pomoTimerId) { clearInterval(pomoTimerId); pomoTimerId = null; } pomoSync(); }
function pomoTick() {
  if (!pomo.running) { pomoStopTickIfIdle(); return; }
  if (pomoRemainMs() <= 0) { pomoComplete(true); return; }
  pomoSync();
}
function pomoSync() {
  // tab title
  if (pomoBaseTitle === null) pomoBaseTitle = document.title;
  document.title = pomo.running ? `${fmtClock(pomoRemainMs())} · ${pomo.mode === 'focus' ? 'Focus' : 'Break'} — Cortex` : pomoBaseTitle;
  // floating pill (only when running and not already on the timer page)
  const onPage = !!document.querySelector('.pomo-page');
  let pill = document.getElementById('pomo-pill');
  if (pomo.running && !onPage) {
    if (!pill) {
      pill = document.createElement('button');
      pill.id = 'pomo-pill'; pill.className = 'pomo-pill';
      pill.title = 'Back to focus timer';
      pill.addEventListener('click', () => { if (typeof renderPomodoro === 'function') renderPomodoro(); });
      document.body.appendChild(pill);
    }
    pill.classList.toggle('is-break', pomo.mode === 'break');
    pill.innerHTML = `<i class="pp-dot"></i><span class="pp-mode">${pomo.mode === 'focus' ? 'Focus' : 'Break'}</span><span class="pp-time">${fmtClock(pomoRemainMs())}</span>`;
  } else if (pill) { pill.remove(); }
  pomoRefresh();
}
function pomoRefresh() {           // update the timer page in place (no full re-render)
  const page = document.querySelector('.pomo-page');
  if (!page) return;
  const remain = pomoRemainMs();
  const set = (sel, val) => { const e = page.querySelector(sel); if (e) e.textContent = val; };
  set('#pomo-clock', fmtClock(remain));
  set('#pomo-mode', pomo.mode === 'focus' ? 'Focus' : 'Break');
  set('#pomo-toggle', pomo.running ? 'Pause' : 'Start');
  set('#pomo-rounds', pomo.rounds);
  set('#pomo-totalfocus', fmtDur(pomo.totalFocusMs));
  set('#pomo-totalbreak', fmtDur(pomo.totalBreakMs));
  set('#pomo-totalsession', fmtDur(pomo.totalFocusMs + pomo.totalBreakMs));
  page.classList.toggle('is-break', pomo.mode === 'break');
  const bar = page.querySelector('#pomo-bar > i');
  if (bar) { const pct = 100 * (1 - remain / pomoPhaseTotalMs()); bar.style.width = Math.max(0, Math.min(100, pct)) + '%'; }
  page.querySelectorAll('[data-fpreset]').forEach(b => b.classList.toggle('active', +b.dataset.fpreset === pomo.focusMin));
  page.querySelectorAll('[data-bpreset]').forEach(b => b.classList.toggle('active', +b.dataset.bpreset === pomo.breakMin));
}

/* ---------- the page ---------- */
function renderPomodoro() {
  if (typeof stopTimer === 'function') stopTimer();
  if (typeof session !== 'undefined') session = null;
  const root = el('<div></div>');
  root.appendChild(topbar('pomodoro'));
  const main = el(`<main class="panel pomo-page ${pomo.mode === 'break' ? 'is-break' : ''}">
    <div class="hero"><h1>Focus timer.</h1><p class="sub">Study in focused rounds with built-in breaks. It keeps running while you study elsewhere on the site, and your total time adds up across the whole session.</p></div>

    <section class="pomo-timer">
      <span class="label" id="pomo-mode">${pomo.mode === 'focus' ? 'Focus' : 'Break'}</span>
      <div class="pomo-clock" id="pomo-clock">${fmtClock(pomoRemainMs())}</div>
      <div class="pomo-bar" id="pomo-bar"><i></i></div>
      <div class="pomo-controls">
        <button class="btn btn-solid" id="pomo-toggle">${pomo.running ? 'Pause' : 'Start'}</button>
        <button class="btn" id="pomo-reset">Reset</button>
        <button class="btn" id="pomo-skip">Skip &rarr;</button>
      </div>
    </section>

    <section class="pomo-set">
      <div class="ctl"><span class="label">Focus length</span>
        <div class="modes">
          ${POMO_PRESETS.focus.map(m => `<button class="mode" data-fpreset="${m}">${m} min</button>`).join('')}
          <span class="pomo-custom"><input type="number" id="pomo-fcustom" min="1" max="180" inputmode="numeric" placeholder="##" aria-label="Custom focus minutes"><span>min</span></span>
        </div>
      </div>
      <div class="ctl"><span class="label">Break length</span>
        <div class="modes">
          ${POMO_PRESETS.break.map(m => `<button class="mode" data-bpreset="${m}">${m} min</button>`).join('')}
          <span class="pomo-custom"><input type="number" id="pomo-bcustom" min="1" max="60" inputmode="numeric" placeholder="##" aria-label="Custom break minutes"><span>min</span></span>
        </div>
      </div>
    </section>

    <section class="pomo-stats statblock">
      <span class="label">This session</span>
      <div class="metrics">
        <div class="metric"><span class="m-num" id="pomo-rounds">${pomo.rounds}</span><span class="m-lab">Rounds done</span></div>
        <div class="metric"><span class="m-num" id="pomo-totalfocus">${fmtDur(pomo.totalFocusMs)}</span><span class="m-lab">Total focused</span></div>
        <div class="metric"><span class="m-num" id="pomo-totalbreak">${fmtDur(pomo.totalBreakMs)}</span><span class="m-lab">Total break</span></div>
        <div class="metric"><span class="m-num" id="pomo-totalsession">${fmtDur(pomo.totalFocusMs + pomo.totalBreakMs)}</span><span class="m-lab">Whole session</span></div>
      </div>
      <button class="btn" id="pomo-end" style="margin-top:16px">End session &amp; reset totals</button>
    </section>
  </main>`);

  main.querySelector('#pomo-toggle').addEventListener('click', () => pomo.running ? pomoPause() : pomoStart());
  main.querySelector('#pomo-reset').addEventListener('click', pomoReset);
  main.querySelector('#pomo-skip').addEventListener('click', pomoSkip);
  main.querySelector('#pomo-end').addEventListener('click', () => { if (confirm('End this focus session and reset your round + time totals?')) pomoEndSession(); });
  main.querySelectorAll('[data-fpreset]').forEach(b => b.addEventListener('click', () => pomoSetFocus(+b.dataset.fpreset)));
  main.querySelectorAll('[data-bpreset]').forEach(b => b.addEventListener('click', () => pomoSetBreak(+b.dataset.bpreset)));
  const fc = main.querySelector('#pomo-fcustom');
  fc.addEventListener('change', () => { const v = Math.max(1, Math.min(180, Math.round(+fc.value || 0))); if (v) pomoSetFocus(v); fc.value = ''; });
  const bc = main.querySelector('#pomo-bcustom');
  bc.addEventListener('change', () => { const v = Math.max(1, Math.min(60, Math.round(+bc.value || 0))); if (v) pomoSetBreak(v); bc.value = ''; });

  root.appendChild(main);
  setView(root);
  pomoEnsureTick(); pomoSync();
}
window.renderPomodoro = renderPomodoro;
window.pomoSync = pomoSync;

/* ---------- init: resume a session that was running ---------- */
(function pomoInit() {
  pomoBaseTitle = document.title;
  if (pomo.running) {
    if (pomoRemainMs() <= 0) pomoComplete(false);   // finished while away — credit once, leave the next phase paused
    else pomoEnsureTick();
  }
  pomoSync();
})();
