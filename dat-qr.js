/* DAT Quantitative Reasoning (DAT-06): the fourth scored section as its own runner, because
   the QR bank is four authored shapes the science drill never deals — `standard`, `qc`
   (quantitative comparison, a FIXED four-option set), `ds` (data sufficiency, a FIXED
   five-option set) and `data` (a table shared by 2-4 sibling items) — and because the
   on-screen calculator belongs here and only here (outline.tools.calculator.sections).

   Non-negotiables, each one a bug that already bit this track:
   - cs-dat-log / cs-dat-q / cs-dat-srs go through the ONE cache on DAT.attemptStores that
     dat-practice.js, dat-pat.js and dat-rc.js share. A private cache here would write a
     whole-array replacement and silently drop the rows the other runners added since it read.
   - Nothing written to a cs-dat-* key may contain markup: study-backup.js refuses such a value
     and a learner's export breaks. The resume blob holds ids, indexes and numbers only.
   - Options render generically over options.length and LETTERS (app.js); qc and ds option sets
     are canonical and are never reordered, which DatDrillCore.orderOptions guarantees.
   - The calculator takes MOUSE CLICKS ONLY, exactly as on test day (RESEARCH §2.3). This file
     installs no keydown handler of any kind; buttons stay keyboard-reachable through the
     browser's own activation, which is not keyboard entry into the calculator.
   - Names are #dat-qr-*, .dat-qr-*, data-dat-qr-* only, so nothing collides with mcat*.js,
     dat-practice.js, dat-pat.js or dat-rc.js in a document that loads them all. In particular
     the root is .dat-qr-run, never .dat-drill, which gates dat-practice.js's keydown handler. */
(function () {
  'use strict';
  const Core = window.DatDrillCore;
  const LOG_KEY = 'cs-dat-log',
    HIST_KEY = 'cs-dat-q',
    SRS_KEY = 'cs-dat-srs',
    RESUME_KEY = 'cs-dat-r-qr',
    LOG_CAP = 2000;
  const SECTION = 'qr';
  const CONF = { guess: 'Guess', unsure: 'Unsure', sure: 'Sure' };
  const MODES = { paced: 'Paced', exam: 'Exam clock', untimed: 'Untimed' };
  const MODE_HINT = {
    paced: 'Paced: a soft per-item bar turns amber at the pace target; feedback after each item.',
    exam: 'Exam clock: one section clock of n × pace seconds that ends the set; feedback in the review.',
    untimed: 'Untimed: no clock; feedback after each item.',
  };
  const LENGTHS = [10, 15, 20, 40];
  // Filter labels for the four authored shapes. `standard` covers both the mathematical and the
  // applied word problems; the bank pins a shape per outline category (QR-1/QR-5 standard,
  // QR-2 ds, QR-3 qc, QR-4 data), so this is a shape filter, not a second category filter.
  const FORMATS = {
    standard: 'Standard',
    qc: 'Comparison',
    ds: 'Sufficiency',
    data: 'Data sets',
  };
  const TICK_MS = 250;

  /* ---------- storage ---------- */
  // The shared attempt cache (DESIGN §9 risk 5). Built by whichever DAT runner reads first and
  // dropped by resetDatState through the reset() hook at the foot of each module.
  function stores() {
    if (!DAT.attemptStores) {
      const log = StudyStorage.read(LOG_KEY, []),
        hist = StudyStorage.read(HIST_KEY, {}),
        srs = StudyStorage.read(SRS_KEY, {});
      DAT.attemptStores = {
        log: Array.isArray(log) ? log : [],
        hist: hist && typeof hist === 'object' ? hist : {},
        srs: srs && typeof srs === 'object' ? srs : {},
      };
      // The callbacks read back through stores(), so a reset between writes hands StudyStorage
      // the rebuilt cache rather than the dropped one.
      StudyStorage.watch(LOG_KEY, () => stores().log);
      StudyStorage.watch(HIST_KEY, () => stores().hist);
      StudyStorage.watch(SRS_KEY, () => stores().srs);
    }
    return DAT.attemptStores;
  }
  function now() {
    return Date.now();
  }
  function attemptId() {
    return 'dat-qr-' + now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function saveStatus(ok) {
    const node = document.querySelector('#dat-qr-save-status');
    if (!node) return;
    node.textContent = ok
      ? ''
      : 'Saving is paused. Your answers stay in this tab until the browser copy can be written again.';
  }
  // One cs-dat-log row per answered item (capped), the cs-dat-q history update and, when wrong,
  // enrolment in cs-dat-srs through the one scheduler in dat-drill-engine.js.
  function logAttempt(current, entry) {
    const store = stores();
    const ts = now();
    if (!store.log.some(row => row.attemptId === current.attemptId && row.qId === entry.id)) {
      store.log.push(Core.logRow(current, Object.assign({ ts }, entry), ts));
      if (store.log.length > LOG_CAP) store.log.splice(0, store.log.length - LOG_CAP);
    }
    const h = store.hist[entry.id] || { n: 0 };
    if (h.lastAttemptId !== current.attemptId) h.n = (h.n || 0) + 1;
    h.lastAttemptId = current.attemptId;
    h.lastCorrect = entry.correct;
    h.conf = entry.conf;
    h.ts = ts;
    store.hist[entry.id] = h;
    let ok = StudyStorage.write(LOG_KEY, store.log) && StudyStorage.write(HIST_KEY, store.hist);
    if (!entry.correct) {
      Core.enroll(store.srs, entry, ts);
      ok = StudyStorage.write(SRS_KEY, store.srs) && ok;
    }
    saveStatus(ok);
    return ok;
  }
  // Ids, indexes, numbers and the confidence tag only — never a stem, an option or a table.
  function saveResume() {
    if (!run) return false;
    const blob = Object.assign({}, run);
    delete blob.itemStart;
    if (blob.deadline) blob._remain = Math.max(0, blob.deadline - now());
    delete blob.deadline;
    blob._saved = now();
    const ok = StudyStorage.write(RESUME_KEY, blob);
    saveStatus(ok);
    return ok;
  }
  function loadResume() {
    const blob = StudyStorage.read(RESUME_KEY, null);
    return blob && Array.isArray(blob.qs) && blob.scope ? blob : null;
  }
  function clearResume() {
    return StudyStorage.remove(RESUME_KEY);
  }

  /* ---------- outline helpers ---------- */
  function outline() {
    return DAT.outline;
  }
  function paceSeconds() {
    return Core.pace(outline(), SECTION);
  }
  function sectionName() {
    return outline()?.sections?.[SECTION]?.name || SECTION;
  }
  function categories() {
    return (outline()?.concepts || []).filter(c => c.section === SECTION).flatMap(c => c.categories);
  }
  function categoryTitle(id) {
    return categories().find(c => c.id === id)?.title || id;
  }
  function calculatorAllowed() {
    const allowed = outline()?.tools?.calculator?.sections;
    return Array.isArray(allowed) ? allowed.includes(SECTION) : true;
  }
  function params() {
    const p = new URLSearchParams(location.search);
    const n = parseInt(p.get('n'), 10);
    return {
      started: p.has('n'),
      n: Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 15,
      category: p.get('category') || '',
      format: FORMATS[p.get('format')] ? p.get('format') : '',
      mode: MODES[p.get('mode')] ? p.get('mode') : 'paced',
    };
  }
  function scopeParams(scope, extra) {
    const out = Object.assign({ view: 'qr' }, extra);
    if (scope.category) out.category = scope.category;
    if (scope.format) out.format = scope.format;
    return out;
  }
  function sameScope(a, b) {
    return (a.category || '') === (b.category || '') && (a.format || '') === (b.format || '');
  }
  function byId() {
    const map = new Map();
    for (const q of DAT.questions) map.set(q.id, q);
    return map;
  }
  function fmtClock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  function pct(x) {
    return Math.round(x * 100) + '%';
  }
  function shapeOf(item) {
    return item?.format || 'standard';
  }

  /* ---------- pool ---------- */
  // Items sharing a setId read one table, so they are dealt as one unit. DatDrillCore.groupSets
  // pulls the mates of every drawn item to its position; this re-chunks that flat list into
  // groups so the cut to n can only ever drop a WHOLE set. (dat-practice.js cuts to n first,
  // which would split a set — harmless there because SECTION_CHOICES never reaches QR.)
  function setGroups(list) {
    const grouped = Core.groupSets(list),
      out = [],
      seen = new Set();
    for (const item of grouped) {
      if (seen.has(item.id)) continue;
      const mates = item.setId ? grouped.filter(other => other.setId === item.setId) : [item];
      for (const mate of mates) seen.add(mate.id);
      out.push(mates);
    }
    return out;
  }
  function takeWholeSets(list, n) {
    const out = [];
    for (const group of setGroups(list)) {
      if (out.length >= n) break;
      if (out.length + group.length <= n) out.push(...group);
    }
    return out;
  }
  function poolFor(scope) {
    const items = Core.pool(DAT.questions, outline(), { section: SECTION, category: scope.category });
    return scope.format ? items.filter(q => shapeOf(q) === scope.format) : items;
  }

  /* ---------- run state ---------- */
  // run = { scope, n, mode, qs: [id], orders: { id: [display -> authored] }, idx, results: [],
  //         attemptId, seed, paceSeconds, source, startedAt, itemStart, itemMs, deadline,
  //         _remain, shownSets }
  let run = null,
    ticker = null,
    lastRun = null,
    calc = null;

  function startRun(scope, n, mode) {
    const store = stores(),
      seed = now() % 2147483647;
    let items = Core.shuffle(poolFor(scope), seed);
    // Least-seen first, ties in shuffled order.
    items = items
      .map((q, i) => [q, store.hist[q.id]?.n || 0, i])
      .sort((a, b) => a[1] - b[1] || a[2] - b[2])
      .map(([q]) => q);
    items = takeWholeSets(items, n);
    if (!items.length) return false;
    const orders = {};
    items.forEach((q, i) => (orders[q.id] = Core.orderOptions(q, seed + i)));
    const pace = paceSeconds();
    run = {
      scope,
      n,
      mode,
      qs: items.map(q => q.id),
      orders,
      idx: 0,
      results: [],
      attemptId: attemptId(),
      seed,
      paceSeconds: pace,
      source: 'qr',
      startedAt: now(),
      itemStart: null,
      itemMs: 0,
      deadline: mode === 'exam' ? now() + items.length * pace * 1000 : null,
      shownSets: [],
    };
    return true;
  }
  // A deploy can retire a bank item under a saved blob. Dropping its id from qs shifts every
  // later position, so results and idx are re-indexed through the same keep list rather than
  // carried over: every answer stays attached to the question it was given for.
  function resumeRun(blob) {
    stores();
    const map = byId();
    const keep = blob.qs.map((id, i) => i).filter(i => map.has(blob.qs[i]));
    if (!keep.length) {
      clearResume();
      return false;
    }
    const qs = keep.map(i => blob.qs[i]);
    run = Object.assign({}, blob, {
      qs,
      itemStart: null,
      results: keep.map(i => (blob.results || [])[i] || null),
      shownSets: blob.shownSets || [],
      source: 'qr',
    });
    run.idx = Math.min(keep.filter(i => i < (blob.idx || 0)).length, qs.length);
    if (run.mode === 'exam') run.deadline = now() + (Number(blob._remain) || 0);
    delete run._remain;
    delete run._saved;
    return true;
  }
  function elapsedItemMs() {
    return (run.itemMs || 0) + (run.itemStart ? now() - run.itemStart : 0);
  }

  /* ---------- clock ---------- */
  function stopTicker() {
    if (ticker) clearInterval(ticker);
    ticker = null;
  }
  function tick() {
    if (!run) return stopTicker();
    const node = document.querySelector('#dat-qr-clock');
    if (!node) return stopTicker();
    if (run.mode === 'exam') {
      const remain = run.deadline - now();
      node.textContent = fmtClock(remain);
      node.classList.toggle('dat-qr-over', remain <= 60000);
      if (remain <= 0) {
        stopTicker();
        finishRun(true);
      }
    } else if (run.mode === 'paced') {
      const ms = elapsedItemMs(),
        target = run.paceSeconds * 1000;
      const fill = node.querySelector('.dat-qr-pace-fill'),
        label = node.querySelector('.dat-qr-pace-label');
      if (fill) fill.style.width = Math.min(100, (ms / target) * 100).toFixed(1) + '%';
      if (label) label.textContent = `${Math.floor(ms / 1000)} s / ${run.paceSeconds} s`;
      node.classList.toggle('dat-qr-over', ms > target);
      node.setAttribute('aria-valuenow', String(Math.min(100, Math.round((ms / target) * 100))));
    }
  }
  function startTicker() {
    stopTicker();
    if (!run || run.mode === 'untimed') return;
    if (run.idx < run.qs.length && !run.results[run.idx] && !run.itemStart) run.itemStart = now();
    if (run.mode === 'exam' && !run.deadline) run.deadline = now() + (Number(run._remain) || 0);
    tick();
    ticker = setInterval(tick, TICK_MS);
  }
  // Registered in DAT.pausers: stops the clock, freezes the item and section timers and hands
  // the shell a resume hook so saving-recovered can restart the clock while QR is on screen.
  function pause() {
    stopTicker();
    if (!run) return undefined;
    if (run.itemStart) {
      run.itemMs = elapsedItemMs();
      run.itemStart = null;
    }
    if (run.deadline) {
      run._remain = Math.max(0, run.deadline - now());
      run.deadline = null;
    }
    return {
      selector: '#dat-qr-clock',
      resume() {
        if (!run) return;
        if (run.mode === 'exam') run.deadline = now() + (Number(run._remain) || 0);
        delete run._remain;
        startTicker();
      },
    };
  }

  /* ---------- shared chrome ---------- */
  function page(main) {
    datView(main);
  }
  function backLink(label = 'Back to DAT') {
    return `<a class="btn" data-dat-go href="${esc(datUrl())}">${label}</a>`;
  }
  function wireLinks(root) {
    root.querySelectorAll('a[data-dat-go]').forEach(link =>
      link.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const target = new URL(link.getAttribute('href'), location.origin);
        datGo(Object.fromEntries(target.searchParams));
      })
    );
  }

  /* ---------- setup ---------- */
  function renderSetup(notice) {
    const p = params(),
      o = outline();
    if (!o) {
      const main = el(
        `<main class="panel dat-qr-setup"><h1>Quantitative Reasoning</h1><p class="sub">The content outline has not loaded.</p><div class="endbtns">${backLink()}</div></main>`
      );
      datDataNotice(main);
      return page(main);
    }
    const state = {
      n: LENGTHS.includes(p.n) ? p.n : 15,
      mode: MODES[p.mode] ? p.mode : 'paced',
      category: p.category,
      format: p.format,
    };
    const saved = loadResume();
    const main = el(`<main class="panel dat-qr-setup">
      <div class="hero"><span class="label">DAT &middot; ${esc(sectionName())}</span><h1>Quantitative Reasoning.</h1>
      <p class="sub">Forty items in ${o.sections[SECTION].minutes} minutes on test day — ${paceSeconds()} seconds each. Four shapes: standard problems, quantitative comparison, data sufficiency and data-table sets. The click-only calculator is one button away, and nowhere else in the track.</p></div>
      ${notice ? `<aside class="course-notice dat-qr-notice" role="status">${notice}</aside>` : ''}
      ${saved ? `<div class="dat-qr-resume"><span>A Quantitative Reasoning set is in progress (${(saved.results || []).filter(Boolean).length}/${saved.qs.length} answered).</span><a class="btn btn-solid" id="dat-qr-resume" data-dat-go href="${esc(datUrl(scopeParams(saved.scope, { n: saved.n, mode: saved.mode })))}">Resume set</a></div>` : ''}
      <div class="ctl"><span class="label">Length</span><div class="modes" id="dat-qr-setup-n">${LENGTHS.map(n => `<button class="mode${n === state.n ? ' active' : ''}" type="button" data-dat-qr-n="${n}">${n}</button>`).join('')}</div></div>
      <div class="ctl"><span class="label">Mode</span><div class="modes" id="dat-qr-setup-mode">${Object.entries(MODES)
        .map(
          ([k, label]) =>
            `<button class="mode${k === state.mode ? ' active' : ''}" type="button" data-dat-qr-mode="${k}">${label}</button>`
        )
        .join('')}</div><p class="dat-qr-hint" id="dat-qr-mode-hint">${MODE_HINT[state.mode]}</p></div>
      <div class="dat-qr-filters">
        <label class="ctl"><span class="label">Category</span><select id="dat-qr-setup-category"></select></label>
        <label class="ctl"><span class="label">Shape</span><select id="dat-qr-setup-format"></select></label>
      </div>
      <p class="dat-qr-pool" id="dat-qr-pool" role="status"></p>
      <div class="endbtns"><button class="btn btn-solid" id="dat-qr-start" type="button">Start set</button>${backLink()}</div>
      <p class="course-caption"><a data-dat-go href="${esc(datUrl({ view: 'mistakes' }))}">Mistake log</a> &middot; Standard and data items follow the outline's option policy (${esc(o.optionPolicy?.qr?.status || 'unverified')}); comparison and sufficiency use their fixed, corroborated option sets.</p>
    </main>`);
    const catSel = main.querySelector('#dat-qr-setup-category'),
      fmtSel = main.querySelector('#dat-qr-setup-format'),
      note = main.querySelector('#dat-qr-pool'),
      start = main.querySelector('#dat-qr-start');
    const fill = (select, options, value, placeholder) => {
      select.innerHTML =
        `<option value="">${placeholder}</option>` +
        options
          .map(([v, label]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(label)}</option>`)
          .join('');
    };
    const refresh = () => {
      const cats = categories();
      if (!cats.some(c => c.id === state.category)) state.category = '';
      fill(
        catSel,
        cats.map(c => [c.id, c.id + ' · ' + c.title]),
        state.category,
        'All categories'
      );
      fill(fmtSel, Object.entries(FORMATS), state.format, 'All shapes');
      const size = poolFor(state).length;
      start.disabled = size === 0;
      note.className = 'dat-qr-pool' + (size < state.n ? ' dat-qr-pool-short' : '');
      note.textContent =
        size === 0
          ? 'No items match this scope yet. Widen the scope or pick another shape.'
          : size < state.n
            ? `Only ${size} item${size === 1 ? '' : 's'} match this scope; the set will use all it can.`
            : `${size} items available.`;
      main.querySelector('#dat-qr-mode-hint').textContent = MODE_HINT[state.mode];
    };
    const segment = (selector, key, set) =>
      main.querySelectorAll(selector + ' .mode').forEach(b =>
        b.addEventListener('click', () => {
          set(b.dataset[key]);
          main.querySelectorAll(selector + ' .mode').forEach(x => x.classList.toggle('active', x === b));
          refresh();
        })
      );
    segment('#dat-qr-setup-n', 'datQrN', v => (state.n = +v));
    segment('#dat-qr-setup-mode', 'datQrMode', v => (state.mode = v));
    catSel.addEventListener('change', () => {
      state.category = catSel.value;
      refresh();
    });
    fmtSel.addEventListener('change', () => {
      state.format = fmtSel.value;
      refresh();
    });
    start.addEventListener('click', () => {
      if (saved && !sameScope(saved.scope, state)) clearResume();
      datGo(scopeParams(state, { n: state.n, mode: state.mode }));
    });
    refresh();
    datDataNotice(main);
    page(main);
  }

  /* ---------- item bodies ---------- */
  function optionButtons(item, order, letters) {
    return order
      .map(
        (authored, pos) =>
          `<button class="opt dat-qr-opt" type="button" id="dat-qr-opt-${pos}" data-dat-qr-i="${authored}" data-dat-qr-pos="${pos}"><span class="key">${esc(letters[pos] ?? pos + 1)}</span><span>${esc(item.options[authored])}</span></button>`
      )
      .join('');
  }
  // A real table with column headers and a caption, so the data set is readable by a screen
  // reader and not a picture of one.
  function tableHtml(table) {
    if (!table) return '';
    return `<table class="dat-data-table">${table.caption ? `<caption>${esc(table.caption)}</caption>` : ''}<thead><tr>${(table.headers || []).map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${(table.rows || []).map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function itemBody(item) {
    const parts = [];
    if (item.table) {
      // The set's table is drawn in full for the first item of the set and collapsed for its
      // mates, so a four-item set is not four screens of the same numbers.
      const again = item.setId && run && run.shownSets.includes(item.setId);
      parts.push(
        again
          ? `<details class="dat-data-again"><summary>Table for this set (shown once above)</summary>${tableHtml(item.table)}</details>`
          : `<div class="dat-data">${tableHtml(item.table)}</div>`
      );
    }
    if (shapeOf(item) === 'qc') {
      if (item.common) parts.push(`<p class="dat-qc-common">${esc(item.common)}</p>`);
      parts.push(
        `<div class="dat-qc"><div class="dat-qc-col"><span class="label">Quantity A</span><p>${esc(item.quantityA)}</p></div><div class="dat-qc-col"><span class="label">Quantity B</span><p>${esc(item.quantityB)}</p></div></div>`
      );
    }
    parts.push(`<p class="q dat-qr-stem">${esc(item.stem)}</p>`);
    if (shapeOf(item) === 'ds' && Array.isArray(item.statements))
      parts.push(
        `<ol class="dat-ds">${item.statements.map((s, i) => `<li><span class="label">Statement ${i + 1}</span><p>${esc(s)}</p></li>`).join('')}</ol>`
      );
    if (item.figure) parts.push(`<figure class="dat-figure">${item.figure}</figure>`);
    return parts.join('');
  }
  // The author's substituted values, shown with the explanation: the arithmetic a learner can
  // re-run on the calculator rather than take on trust.
  function workedHtml(item) {
    const values = item.worked?.values;
    if (!values || typeof values !== 'object') return '';
    const rows = Object.entries(values)
      .map(
        ([name, value]) =>
          `<div><dt>${esc(name)}</dt><dd>${esc(Array.isArray(value) ? value.join(', ') : value)}</dd></div>`
      )
      .join('');
    return rows
      ? `<dl class="dat-qr-worked"><div class="dat-qr-worked-head"><dt>Worked values</dt><dd></dd></div>${rows}</dl>`
      : '';
  }
  function autopsyHtml(item, order, chosen) {
    const letters = Core.letters(order.length),
      letterOf = authored => letters[order.indexOf(authored)] ?? '?';
    const rows = (item.distractors || [])
      .filter(d => d.i !== item.answer)
      .map(
        d =>
          `<div class="autopsy-row${d.i === chosen ? ' dat-qr-chosen' : ''}"><span class="ak">${esc(letterOf(d.i))}</span><span>${esc(d.why)}${d.i === chosen ? ' <em>(your choice)</em>' : ''}</span></div>`
      )
      .join('');
    return rows ? `<div class="autopsy dat-qr-autopsy"><span class="label">Distractor autopsy</span>${rows}</div>` : '';
  }

  /* ---------- the calculator (mouse only: no keydown handler anywhere in this file) ---------- */
  function calcModalHtml() {
    const Calc = window.DatCalcCore;
    const rows = Calc.KEYS.map(
      row =>
        `<div class="dat-qr-calc-row">${row
          .map(
            k =>
              `<button class="dat-qr-calc-key dat-qr-calc-${k.kind}" type="button" data-dat-qr-calc="${esc(k.key)}"${k.aria ? ` aria-label="${esc(k.aria)}"` : ''}>${esc(k.label)}</button>`
          )
          .join('')}</div>`
    ).join('');
    return `<div class="dat-modal dat-qr-calc-modal" id="dat-qr-calc" role="dialog" aria-modal="true" aria-labelledby="dat-qr-calc-title">
      <div class="dat-modal-box dat-qr-calc-box">
        <div class="dat-modal-head"><h2 id="dat-qr-calc-title">Calculator</h2><button class="btn" id="dat-qr-calc-close" type="button">Close</button></div>
        <div class="dat-qr-calc-screen">
          <span class="dat-qr-calc-flag" id="dat-qr-calc-memory"></span>
          <span class="dat-qr-calc-expr" id="dat-qr-calc-expr"></span>
          <output class="dat-qr-calc-display" id="dat-qr-calc-display" aria-live="polite" aria-atomic="true">0</output>
        </div>
        <div class="dat-qr-calc-pad" id="dat-qr-calc-pad">${rows}</div>
        <p class="course-caption">Mouse only, exactly as on test day: the exam's calculator accepts no keyboard entry. Basic four-function keys with memory, percent, square root and reciprocal; no exponent, trigonometry, logarithm or bracket keys.</p>
      </div>
    </div>`;
  }
  function paintCalc(modal) {
    const Calc = window.DatCalcCore;
    modal.querySelector('#dat-qr-calc-display').textContent = Calc.display(calc);
    modal.querySelector('#dat-qr-calc-expr').textContent = Calc.expression(calc);
    modal.querySelector('#dat-qr-calc-memory').textContent = Calc.memoryActive(calc) ? 'M' : '';
  }
  function openCalculator(root) {
    const Calc = window.DatCalcCore;
    if (!Calc || root.querySelector('#dat-qr-calc')) return;
    const opener = document.activeElement;
    const modal = el(calcModalHtml());
    if (!calc) calc = Calc.init();
    const close = () => {
      modal.remove();
      // Hand focus back to whatever opened the calculator, so the keyboard does not land on
      // <body> when a learner closes it.
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    };
    root.appendChild(modal);
    paintCalc(modal);
    // One scoped click delegate on the keypad. Clicks only — this is the whole point of the
    // module: the real calculator ignores the keyboard, so there is nothing to type into.
    modal.querySelector('#dat-qr-calc-pad').addEventListener('click', event => {
      const button = event.target.closest('[data-dat-qr-calc]');
      if (!button) return;
      calc = Calc.press(calc, button.getAttribute('data-dat-qr-calc'));
      paintCalc(modal);
    });
    modal.querySelector('#dat-qr-calc-close').addEventListener('click', close);
    modal.addEventListener('click', event => {
      if (event.target === modal) close();
    });
    modal.querySelector('#dat-qr-calc-close').focus();
  }

  /* ---------- runner ---------- */
  function renderItem() {
    if (!run) return renderSetup();
    if (run.idx >= run.qs.length) return finishRun(false);
    const item = byId().get(run.qs[run.idx]);
    if (!item) {
      run.idx++;
      return renderItem();
    }
    const order = run.orders[item.id] || Core.orderOptions(item, run.seed),
      letters = Core.letters(order.length),
      saved = run.results[run.idx],
      exit = datUrl({ view: 'qr' });
    if (!saved && item.setId && !run.shownSets.includes(item.setId)) {
      // Marked after this render, so THIS item shows the table in full and its mates collapse it.
      setTimeout(() => run && run.shownSets.push(item.setId), 0);
    }
    if (!saved) saveResume();
    const clock =
      run.mode === 'paced'
        ? `<div class="dat-qr-pace" id="dat-qr-clock" role="progressbar" aria-label="Time on this item against the pace target" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="dat-qr-pace-track"><div class="dat-qr-pace-fill"></div></div><span class="dat-qr-pace-label">0 s / ${run.paceSeconds} s</span></div>`
        : run.mode === 'exam'
          ? `<span class="dat-qr-clock" id="dat-qr-clock" aria-live="off">${fmtClock((run.deadline || now() + (run._remain || 0)) - now())}</span>`
          : '';
    const root = el(`<div class="dat-qr-run" data-dat-qr-mode="${run.mode}">
      <header class="dat-qr-bar">
        <a class="dat-qr-exit" id="dat-qr-exit" data-dat-go href="${esc(exit)}">&larr; Exit</a>
        <nav class="dat-qr-crumb" aria-label="Set position"><span>DAT</span><span>${esc(outline()?.sections?.[SECTION]?.abbr || 'QR')}</span><span>${esc(categoryTitle(item.category))}</span></nav>
        <div class="dat-qr-right">${clock}<span class="dat-qr-count">Q ${run.idx + 1}/${run.qs.length}</span></div>
      </header>
      <main class="case dat-qr-main">
        <div class="dat-qr-tools">${calculatorAllowed() ? '<button class="btn" id="dat-qr-calc-open" type="button">Calculator</button>' : ''}<span class="dat-qr-topic">${esc(FORMATS[shapeOf(item)] || '')}${item.topic ? ' · ' + esc(item.topic) : ''}</span></div>
        <div class="block dat-qr-item">${itemBody(item)}</div>
        <div class="dat-conf-row"><span class="label">Confidence</span><div class="modes" id="dat-qr-conf">${Object.entries(
          CONF
        )
          .map(
            ([k, label]) =>
              `<button class="mode dat-qr-conf${k === 'unsure' ? ' active' : ''}" type="button" data-dat-qr-conf="${k}">${label}</button>`
          )
          .join('')}</div></div>
        <div class="opts dat-qr-opts" id="dat-qr-opts">${optionButtons(item, order, letters)}</div>
        <div class="dat-qr-after" id="dat-qr-after"></div>
        <p class="dat-save-status" id="dat-qr-save-status" role="status"></p>
      </main>
    </div>`);
    let conf = saved?.conf || 'unsure';
    root.querySelectorAll('#dat-qr-conf .mode').forEach(b =>
      b.addEventListener('click', () => {
        if (!run) return;
        conf = b.dataset.datQrConf;
        root.querySelectorAll('#dat-qr-conf .mode').forEach(x => x.classList.toggle('active', x === b));
      })
    );
    root.querySelectorAll('.dat-qr-opt').forEach(b =>
      b.addEventListener('click', () => {
        if (!run) return;
        answer(root, item, +b.dataset.datQrI, conf);
      })
    );
    root.querySelector('#dat-qr-calc-open')?.addEventListener('click', () => openCalculator(root));
    const wrap = el('<div></div>');
    wrap.appendChild(topbar('dat'));
    wrap.appendChild(root);
    setView(wrap);
    wireLinks(root);
    if (saved) reveal(root, item, saved);
    else {
      run.itemMs = 0;
      run.itemStart = null;
      startTicker();
      if (run.mode === 'untimed') run.itemStart = now();
    }
  }

  function answer(root, item, authored, conf) {
    if (!run || run.results[run.idx]) return;
    const ms = elapsedItemMs();
    const entry = {
      id: item.id,
      section: item.section,
      category: item.category,
      topic: item.topic,
      chosen: authored,
      correct: authored === item.answer,
      conf,
      ms,
    };
    run.results[run.idx] = entry;
    run.itemStart = null;
    run.itemMs = 0;
    if (run.mode !== 'exam') stopTicker();
    logAttempt(run, entry);
    saveResume();
    reveal(root, item, entry);
  }

  function reveal(root, item, entry) {
    if (!run) return;
    const order = run.orders[item.id] || Core.orderOptions(item, run.seed),
      examMode = run.mode === 'exam';
    root.querySelectorAll('.dat-qr-opt').forEach(btn => {
      const i = +btn.dataset.datQrI;
      btn.disabled = true;
      if (examMode) {
        if (i === entry.chosen) btn.classList.add('picked');
      } else if (i === item.answer) btn.classList.add('correct');
      else if (i === entry.chosen) btn.classList.add('wrong');
      else btn.classList.add('dimmed');
    });
    root.querySelectorAll('#dat-qr-conf .mode').forEach(b => {
      b.disabled = true;
      b.classList.toggle('active', b.dataset.datQrConf === entry.conf);
    });
    const last = run.idx + 1 >= run.qs.length,
      after = root.querySelector('#dat-qr-after');
    const seconds = typeof entry.ms === 'number' ? (entry.ms / 1000).toFixed(0) : null;
    after.innerHTML = examMode
      ? `<div class="continue-row"><span class="hint">answer recorded${seconds ? ` &middot; ${seconds} s` : ''}</span><button class="btn btn-solid" id="dat-qr-next" type="button" data-next>${last ? 'Finish' : 'Next'}</button></div>`
      : `<div class="explain dat-qr-explain ${entry.correct ? 'good' : 'bad'}"><span class="verdict">${entry.correct ? 'CORRECT' : 'INCORRECT'}${seconds ? ` &middot; ${seconds} s${entry.ms > run.paceSeconds * 1000 ? ' (over pace)' : ''}` : ''}</span><p>${esc(item.explanation)}</p>${workedHtml(item)}${autopsyHtml(item, order, entry.chosen)}</div>
        <div class="continue-row"><span class="hint">ENTER &rarr;</span><button class="btn btn-solid" id="dat-qr-next" type="button" data-next>${last ? 'Results' : 'Next'}</button></div>`;
    after.querySelector('#dat-qr-next').addEventListener('click', () => {
      if (!run) return;
      run.idx++;
      if (run.idx >= run.qs.length) finishRun(false);
      else renderItem();
    });
  }

  function finishRun(forced) {
    if (!run) return renderSetup();
    stopTicker();
    const map = byId();
    run.qs.forEach((id, i) => {
      if (run.results[i]) return;
      const item = map.get(id);
      if (!item) return;
      const entry = {
        id,
        section: item.section,
        category: item.category,
        topic: item.topic,
        chosen: null,
        correct: false,
        conf: null,
        ms: null,
        unanswered: true,
      };
      run.results[i] = entry;
      if (forced) logAttempt(run, entry);
    });
    run.finishedAt = now();
    run.forced = !!forced;
    lastRun = run;
    run = null;
    calc = null;
    clearResume();
    renderReview(lastRun);
  }

  /* ---------- review ---------- */
  function renderReview(done) {
    const map = byId(),
      s = Core.summary(done);
    const secs = s.msPerItem ? (s.msPerItem / 1000).toFixed(1) : '—';
    const rows = Object.entries(s.byCategory).sort(
      (a, b) => a[1].correct / a[1].n - b[1].correct / b[1].n || b[1].n - a[1].n || a[0].localeCompare(b[0])
    );
    const again = datUrl(scopeParams(done.scope, { n: done.n, mode: done.mode }));
    const letterFor = (item, authored) => {
      const order = done.orders[item.id] || Core.orderOptions(item, done.seed);
      return Core.letters(order.length)[order.indexOf(authored)] ?? '—';
    };
    const main = el(`<main class="panel dat-qr-review">
      <section class="summary dat-qr-summary">
        <span class="label">Quantitative Reasoning complete${done.forced ? ' &middot; section clock ended the set' : ''}</span>
        <div class="score">${String(s.correct).padStart(2, '0')}<span class="of">/${String(s.n).padStart(2, '0')}</span></div>
        <dl class="dat-review-stats">
          <div><dt>Accuracy</dt><dd id="dat-qr-accuracy">${pct(s.accuracy)}</dd></div>
          <div><dt>Seconds per item</dt><dd id="dat-qr-pace">${secs} s <small>vs ${s.paceSeconds} s target</small></dd></div>
          <div><dt>Over pace</dt><dd id="dat-qr-over">${s.overPace} of ${s.n}</dd></div>
          <div><dt>Fast wrong</dt><dd id="dat-qr-fast-wrong">${s.fastWrong}</dd></div>
          <div><dt>Slow wrong</dt><dd id="dat-qr-slow-wrong">${s.slowWrong}</dd></div>
          ${s.unanswered ? `<div><dt>Unanswered</dt><dd>${s.unanswered}</dd></div>` : ''}
        </dl>
        <div class="ticks">${done.results.map((r, i) => `<span class="${r?.correct ? 'ok' : 'no'}">Q${i + 1} ${r?.correct ? '&#10003;' : '&#10007;'}</span>`).join('')}</div>
      </section>
      <section class="dat-qr-categories" aria-labelledby="dat-qr-categories-title"><h2 id="dat-qr-categories-title">By category</h2>
        <table class="dat-topic-table dat-qr-cat-table"><thead><tr><th scope="col">Category</th><th scope="col">Title</th><th scope="col">Correct</th><th scope="col">Accuracy</th></tr></thead>
        <tbody>${rows
          .map(
            ([id, row]) =>
              `<tr><td>${esc(id)}</td><td>${esc(categoryTitle(id))}</td><td>${row.correct}/${row.n}</td><td>${pct(row.correct / row.n)}</td></tr>`
          )
          .join('')}</tbody></table>
      </section>
      <section class="drill-review dat-qr-items"><span class="label">Review</span>
        ${done.qs
          .map((id, i) => {
            const item = map.get(id),
              r = done.results[i];
            if (!item || !r) return '';
            const order = done.orders[item.id] || Core.orderOptions(item, done.seed);
            return `<details class="rev dat-qr-rev"${r.correct ? '' : ' open'}>
              <summary><span class="${r.correct ? 'ok' : 'no'}">${r.correct ? '&#10003;' : '&#10007;'}</span> Q${i + 1}. ${esc(item.stem.slice(0, 90))}${item.stem.length > 90 ? '&hellip;' : ''}</summary>
              <div class="rev-body">
                <div class="rev-ans">You: ${r.chosen == null ? 'Unanswered' : esc(letterFor(item, r.chosen))} &middot; Correct: <b>${esc(letterFor(item, item.answer))}</b>${r.conf ? ` &middot; felt ${CONF[r.conf] || esc(r.conf)}` : ''}${typeof r.ms === 'number' ? ` &middot; ${(r.ms / 1000).toFixed(0)} s` : ''}</div>
                <p class="dat-qr-rev-topic">${esc(item.category)} &middot; ${esc(categoryTitle(item.category))}${item.topic ? ' &middot; ' + esc(item.topic) : ''} &middot; ${esc(FORMATS[shapeOf(item)] || shapeOf(item))}</p>
                <p>${esc(item.explanation)}</p>
                ${workedHtml(item)}
                ${autopsyHtml(item, order, r.chosen)}
              </div></details>`;
          })
          .join('')}
      </section>
      <div class="endbtns"><a class="btn btn-solid" id="dat-qr-again" data-dat-go href="${esc(again)}">Another set</a><a class="btn" data-dat-go href="${esc(datUrl({ view: 'qr' }))}">New set</a><a class="btn" data-dat-go href="${esc(datUrl({ view: 'mistakes' }))}">Mistake log</a>${backLink()}</div>
      <p class="dat-save-status" id="dat-qr-save-status" role="status"></p>
    </main>`);
    page(main);
    saveStatus(!StudyStorage.paused);
  }

  /* ---------- entry points ---------- */
  function render() {
    const p = params();
    if (!p.started) return renderSetup();
    const scope = { category: p.category, format: p.format };
    const saved = loadResume();
    if (saved && sameScope(saved.scope, scope) && resumeRun(saved)) return renderItem();
    if (!startRun(scope, p.n, p.mode))
      return renderSetup(
        `<strong>No items match that scope yet.</strong><p>${esc(sectionName())}${p.category ? ` · ${esc(p.category)}` : ''}${p.format ? ` · ${esc(FORMATS[p.format])}` : ''} has no practice items in the loaded banks. Pick another scope below.</p>`
      );
    renderItem();
  }
  // resetDatState calls this after it has forgotten the loaded data and cleared the resume
  // blobs: the cached stores, the in-flight set and the calculator have to go too, or the first
  // answer after a reset writes the previous workspace's whole log back over the cleared keys.
  function reset() {
    stopTicker();
    run = null;
    lastRun = null;
    calc = null;
    DAT.attemptStores = null;
  }

  DAT.pausers.push(pause);
  window.DatQr = { render, pause, reset };
})();
