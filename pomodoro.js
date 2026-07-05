/* ============================================================
   Cortex — Focus Timer (Pomodoro)
   Study in focused rounds with built-in breaks. The timer is
   timestamp-based, so it keeps running while you study elsewhere
   on the site (a floating pill + the tab title show the countdown)
   and resumes correctly after a reload. Rounds + total focused time
   accumulate across the whole session and persist in localStorage.
   ============================================================ */

const POMO_PRESETS = { focus: [15, 25, 45], break: [5, 10, 15] };
const POMO_DEFAULTS = { mode: 'focus', running: false, deadline: 0, remainMs: 25 * 60000, focusMin: 25, breakMin: 5, rounds: 0, totalFocusMs: 0, totalBreakMs: 0, startedTs: 0, tasks: [], swapDue: false };

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
  if (pomo.mode === 'focus') pomo.swapDue = false;   // starting a fresh focus round clears the swap nudge
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
  const wasFocus = pomo.mode === 'focus';
  if (wasFocus) { pomo.rounds++; pomo.totalFocusMs += full; }
  else { pomo.totalBreakMs += full; }
  pomo.swapDue = wasFocus;            // a focus round just ended -> nudge to cross off + switch subjects
  pomo.mode = wasFocus ? 'break' : 'focus';
  pomo.remainMs = pomoPhaseTotalMs();
  if (autostart) { pomo.running = true; pomo.deadline = Date.now() + pomo.remainMs; pomoDing(); }
  else { pomo.running = false; pomo.deadline = 0; }
  pomoSave(); pomoSync(); if (!pomo.running) pomoStopTickIfIdle();
}
function pomoSkip() {                 // leave current phase early -> next phase, auto-start
  const used = Math.max(0, pomoPhaseTotalMs() - pomoRemainMs());   // count partial time toward totals
  if (pomo.mode === 'focus') pomo.totalFocusMs += used; else pomo.totalBreakMs += used;
  pomo.mode = pomo.mode === 'focus' ? 'break' : 'focus';
  if (pomo.mode === 'focus') pomo.swapDue = false;   // skipped into a new focus round
  pomo.remainMs = pomoPhaseTotalMs();
  pomo.running = true; pomo.deadline = Date.now() + pomo.remainMs;
  pomoSave(); pomoEnsureTick(); pomoSync();
}
function pomoEndSession() {
  const fm = pomo.focusMin, bm = pomo.breakMin, tasks = pomo.tasks;   // keep the study list; only round/time totals reset
  pomo = Object.assign({}, POMO_DEFAULTS, { focusMin: fm, breakMin: bm, mode: 'focus', remainMs: fm * 60000, tasks });
  pomoSave(); pomoStopTickIfIdle(); pomoSync();
}
function pomoSetFocus(m) { pomo.focusMin = m; if (pomo.mode === 'focus' && !pomo.running) pomo.remainMs = m * 60000; pomoSave(); pomoSync(); }
function pomoSetBreak(m) { pomo.breakMin = m; if (pomo.mode === 'break' && !pomo.running) pomo.remainMs = m * 60000; pomoSave(); pomoSync(); }

/* ---------- study list (add subjects, cross off after each round to force a swap) ---------- */
function pomoTaskId() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function pomoCurrentTask() { return pomo.tasks.find(t => !t.done) || null; }   // topmost unfinished = "studying now"
function pomoAddTask(text) {
  text = (text || '').trim(); if (!text) return;
  pomo.tasks.push({ id: pomoTaskId(), text: text.slice(0, 120), done: false });
  pomoSave(); pomoRenderList();
}
function pomoToggleTask(id) {
  const t = pomo.tasks.find(x => x.id === id); if (!t) return;
  t.done = !t.done;
  if (t.done) pomo.swapDue = false;   // acting on the nudge clears it
  pomoSave(); pomoRenderList();
}
function pomoDelTask(id) { pomo.tasks = pomo.tasks.filter(x => x.id !== id); pomoSave(); pomoRenderList(); }
function pomoClearDone() { pomo.tasks = pomo.tasks.filter(x => !x.done); pomoSave(); pomoRenderList(); }
function pomoRenderList() {
  const listEl = document.getElementById('pomo-tasks'); if (!listEl) return;
  const cur = pomoCurrentTask();
  if (!pomo.tasks.length) {
    listEl.innerHTML = '<li class="pomo-empty">No subjects yet. Add what you need to study, then cross each off as you finish a round — it keeps you moving instead of stuck on one thing.</li>';
  } else {
    listEl.innerHTML = pomo.tasks.map(t =>
      `<li class="pomo-task${t.done ? ' done' : ''}${cur && t.id === cur.id ? ' current' : ''}" data-id="${t.id}">`
      + `<button class="pt-check" type="button" aria-label="${t.done ? 'Uncross' : 'Cross off'}"><i></i></button>`
      + `<span class="pt-text">${esc(t.text)}</span>`
      + `<button class="pt-del" type="button" aria-label="Delete">&times;</button></li>`
    ).join('');
  }
  const done = pomo.tasks.filter(t => t.done).length;
  const foot = document.getElementById('pomo-list-foot');
  if (foot) foot.hidden = pomo.tasks.length === 0;
  const cnt = document.getElementById('pomo-list-count');
  if (cnt) cnt.textContent = pomo.tasks.length ? `${pomo.tasks.length - done} left · ${done} done` : '';
  const clr = document.getElementById('pomo-clear-done');
  if (clr) clr.hidden = done === 0;
  pomoUpdateSwapBanner();
}

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
  // custom cells: highlight + fill when the length isn't one of the presets (don't clobber typing)
  const syncCustom = (cellSel, inputSel, presets, cur) => {
    const cell = page.querySelector(cellSel), input = page.querySelector(inputSel);
    if (!cell || !input) return;
    const isCustom = !presets.includes(cur);
    cell.classList.toggle('active', isCustom);
    if (document.activeElement !== input) input.value = isCustom ? cur : '';
  };
  syncCustom('#pomo-fcustom-cell', '#pomo-fcustom', POMO_PRESETS.focus, pomo.focusMin);
  syncCustom('#pomo-bcustom-cell', '#pomo-bcustom', POMO_PRESETS.break, pomo.breakMin);
  pomoUpdateSwapBanner();
}
function pomoUpdateSwapBanner() {   // nudge only when a focus round just ended AND there's a subject to cross off
  const swap = document.getElementById('pomo-swap');
  if (swap) swap.hidden = !(pomo.swapDue && pomoCurrentTask());
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

    <section class="pomo-tasks-sec">
      <div class="pomo-tasks-head">
        <span class="label">Study list</span>
        <span class="pomo-swap" id="pomo-swap" hidden>Round done — cross it off &amp; switch it up &#8635;</span>
      </div>
      <form class="pomo-add" id="pomo-add">
        <input type="text" id="pomo-add-input" maxlength="120" placeholder="Add a subject to study…" aria-label="Add a study subject" autocomplete="off">
        <button class="btn" type="submit" id="pomo-add-btn">Add</button>
      </form>
      <ul class="pomo-list" id="pomo-tasks"></ul>
      <div class="pomo-list-foot" id="pomo-list-foot" hidden>
        <span id="pomo-list-count"></span>
        <button class="pomo-clear" id="pomo-clear-done" type="button" hidden>Clear finished</button>
      </div>
    </section>

    <section class="pomo-set">
      <div class="ctl"><span class="label">Focus length</span>
        <div class="modes">
          ${POMO_PRESETS.focus.map(m => `<button class="mode" data-fpreset="${m}">${m} min</button>`).join('')}
          <label class="pomo-custom" id="pomo-fcustom-cell" for="pomo-fcustom"><span class="pc-tag">Custom</span><input type="number" id="pomo-fcustom" min="1" max="180" inputmode="numeric" placeholder="0" aria-label="Custom focus minutes"><span class="pc-unit">min</span></label>
        </div>
      </div>
      <div class="ctl"><span class="label">Break length</span>
        <div class="modes">
          ${POMO_PRESETS.break.map(m => `<button class="mode" data-bpreset="${m}">${m} min</button>`).join('')}
          <label class="pomo-custom" id="pomo-bcustom-cell" for="pomo-bcustom"><span class="pc-tag">Custom</span><input type="number" id="pomo-bcustom" min="1" max="60" inputmode="numeric" placeholder="0" aria-label="Custom break minutes"><span class="pc-unit">min</span></label>
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
  fc.addEventListener('change', () => { const v = Math.max(1, Math.min(180, Math.round(+fc.value || 0))); if (v) pomoSetFocus(v); else pomoSync(); });
  const bc = main.querySelector('#pomo-bcustom');
  bc.addEventListener('change', () => { const v = Math.max(1, Math.min(60, Math.round(+bc.value || 0))); if (v) pomoSetBreak(v); else pomoSync(); });

  // study list
  const addForm = main.querySelector('#pomo-add');
  addForm.addEventListener('submit', (e) => { e.preventDefault(); const inp = main.querySelector('#pomo-add-input'); pomoAddTask(inp.value); inp.value = ''; inp.focus(); });
  main.querySelector('#pomo-tasks').addEventListener('click', (e) => {
    const li = e.target.closest('.pomo-task'); if (!li) return;
    if (e.target.closest('.pt-del')) pomoDelTask(li.dataset.id);
    else pomoToggleTask(li.dataset.id);
  });
  main.querySelector('#pomo-clear-done').addEventListener('click', pomoClearDone);

  root.appendChild(main);
  setView(root);
  pomoRenderList();
  pomoEnsureTick(); pomoSync();
}
function resetPomoState() {
  if (pomoTimerId) clearInterval(pomoTimerId);
  pomoTimerId = null;
  Object.assign(pomo, POMO_DEFAULTS);
  pomoSave();
  pomoSync();
}
window.renderPomodoro = renderPomodoro;
window.pomoSync = pomoSync;
window.resetPomoState = resetPomoState;

/* ---------- init: resume a session that was running ---------- */
(function pomoInit() {
  pomoBaseTitle = document.title;
  if (pomo.running) {
    if (pomoRemainMs() <= 0) pomoComplete(false);   // finished while away — credit once, leave the next phase paused
    else pomoEnsureTick();
  }
  pomoSync();
})();
