/* DAT timed drills (DAT-03): setup, runner, review, cheat sheets and the mistake-log
   placeholder. Reads location.search for its own options (section, category, topic, n,
   mode, review), resumes from cs-dat-r-drill, logs every answer to cs-dat-log / cs-dat-q and
   enrols misses into cs-dat-srs through DatDrillCore. Names: #dat-*, .dat-*, data-dat-* only;
   option letters come from LETTERS (app.js) over options.length, never a literal count. */
(function () {
  'use strict';
  const Core = window.DatDrillCore;
  const LOG_KEY = 'cs-dat-log',
    HIST_KEY = 'cs-dat-q',
    SRS_KEY = 'cs-dat-srs',
    RESUME_KEY = 'cs-dat-r-drill',
    LOG_CAP = 2000;
  const CONF = { guess: 'Guess', unsure: 'Unsure', sure: 'Sure' };
  const MODES = { paced: 'Paced', exam: 'Exam clock', untimed: 'Untimed' };
  const MODE_HINT = {
    paced: 'Paced: a soft per-item bar turns amber at the pace target; feedback after each item.',
    exam: 'Exam clock: one section clock of n × pace seconds that ends the drill; feedback in the review.',
    untimed: 'Untimed: no clock; feedback after each item.',
  };
  const LENGTHS = [10, 15, 20, 30];
  const SECTION_CHOICES = ['bio', 'gchem', 'ochem', 'mixed'];
  const TICK_MS = 250;

  // 118 elements: symbol and standard atomic weight (bracketed = most stable isotope). Hand-written
  // data; the modal is drawn from this array, never from an image (DESIGN §9 risk 14).
  const ELEMENTS =
    'H 1.008,He 4.003,Li 6.94,Be 9.012,B 10.81,C 12.01,N 14.01,O 16.00,F 19.00,Ne 20.18,Na 22.99,Mg 24.31,Al 26.98,Si 28.09,P 30.97,S 32.06,Cl 35.45,Ar 39.95,K 39.10,Ca 40.08,Sc 44.96,Ti 47.87,V 50.94,Cr 52.00,Mn 54.94,Fe 55.85,Co 58.93,Ni 58.69,Cu 63.55,Zn 65.38,Ga 69.72,Ge 72.63,As 74.92,Se 78.97,Br 79.90,Kr 83.80,Rb 85.47,Sr 87.62,Y 88.91,Zr 91.22,Nb 92.91,Mo 95.95,Tc [98],Ru 101.07,Rh 102.91,Pd 106.42,Ag 107.87,Cd 112.41,In 114.82,Sn 118.71,Sb 121.76,Te 127.60,I 126.90,Xe 131.29,Cs 132.91,Ba 137.33,La 138.91,Ce 140.12,Pr 140.91,Nd 144.24,Pm [145],Sm 150.36,Eu 151.96,Gd 157.25,Tb 158.93,Dy 162.50,Ho 164.93,Er 167.26,Tm 168.93,Yb 173.05,Lu 174.97,Hf 178.49,Ta 180.95,W 183.84,Re 186.21,Os 190.23,Ir 192.22,Pt 195.08,Au 196.97,Hg 200.59,Tl 204.38,Pb 207.2,Bi 208.98,Po [209],At [210],Rn [222],Fr [223],Ra [226],Ac [227],Th 232.04,Pa 231.04,U 238.03,Np [237],Pu [244],Am [243],Cm [247],Bk [247],Cf [251],Es [252],Fm [257],Md [258],No [259],Lr [266],Rf [267],Db [268],Sg [269],Bh [270],Hs [269],Mt [278],Ds [281],Rg [282],Cn [285],Nh [286],Fl [289],Mc [290],Lv [293],Ts [294],Og [294]'
      .split(',')
      .map((pair, i) => {
        const [symbol, mass] = pair.split(' ');
        return { number: i + 1, symbol, mass };
      });
  // Grid position (row, column) on an 18-column table; lanthanides and actinides sit in rows 9-10.
  function elementCell(z) {
    if (z === 1) return [1, 1];
    if (z === 2) return [1, 18];
    if (z <= 18) {
      const period = z <= 10 ? 2 : 3,
        offset = z - (period === 2 ? 2 : 10);
      return [period, offset <= 2 ? offset : offset + 10];
    }
    if (z <= 54) {
      const period = z <= 36 ? 4 : 5;
      return [period, z - (period === 4 ? 18 : 36)];
    }
    if (z <= 56) return [6, z - 54];
    if (z <= 71) return [9, z - 54];
    if (z <= 86) return [6, z - 68];
    if (z <= 88) return [7, z - 86];
    if (z <= 103) return [10, z - 86];
    return [7, z - 100];
  }

  /* ---------- storage ---------- */
  // cs-dat-log, cs-dat-q and cs-dat-srs are written by this module AND by dat-pat.js, which the
  // shell loads into the same document. One cache serves both, hung on the DAT runtime object and
  // built by whichever module reads first: two private caches would each write a whole-array
  // replacement and silently drop the rows the other added since it read. resetDatState drops it
  // through the reset() hooks at the foot of each module.
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
      // The callbacks read back through stores(), so a reset between writes hands StudyStorage the
      // rebuilt cache rather than the dropped one.
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
    return 'dat-' + now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function saveStatus(ok) {
    const node = document.querySelector('#dat-save-status');
    if (!node) return;
    node.textContent = ok
      ? ''
      : 'Saving is paused. Your answers stay in this tab until the browser copy can be written again.';
  }
  // Every answer: one QLOG row (capped 2000), the QHIST update and, when wrong, SRS enrolment.
  function datLogAttempt(run, entry) {
    const store = stores();
    const ts = now();
    if (!store.log.some(row => row.attemptId === run.attemptId && row.qId === entry.id)) {
      store.log.push(Core.logRow(run, Object.assign({ ts }, entry), ts));
      if (store.log.length > LOG_CAP) store.log.splice(0, store.log.length - LOG_CAP);
    }
    const h = store.hist[entry.id] || { n: 0 };
    if (h.lastAttemptId !== run.attemptId) h.n = (h.n || 0) + 1;
    h.lastAttemptId = run.attemptId;
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
  function saveResume() {
    if (!drill) return false;
    const blob = Object.assign({}, drill);
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
  function sectionName(key) {
    if (key === 'mixed') return 'Mixed sciences';
    return outline()?.sections?.[key]?.name || key;
  }
  function sectionAbbr(key) {
    if (key === 'mixed') return 'SNS';
    return outline()?.sections?.[key]?.abbr || key;
  }
  function categories(section) {
    const o = outline();
    if (!o) return [];
    const keys = section === 'mixed' ? Core.mixedSections(o) : [section];
    return o.concepts.filter(c => keys.includes(c.section)).flatMap(c => c.categories);
  }
  function categoryTitle(id) {
    return (
      outline()
        ?.concepts.flatMap(c => c.categories)
        .find(c => c.id === id)?.title || id
    );
  }
  function periodicTableAllowed(section) {
    const allowed = outline()?.tools?.periodicTable?.sections;
    if (section === 'mixed') return true;
    return Array.isArray(allowed) ? allowed.includes(section) : ['bio', 'gchem', 'ochem'].includes(section);
  }
  function params() {
    const p = new URLSearchParams(location.search);
    const n = parseInt(p.get('n'), 10);
    return {
      section: p.get('section') || '',
      category: p.get('category') || '',
      topic: p.get('topic') || '',
      n: Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 15,
      mode: MODES[p.get('mode')] ? p.get('mode') : p.get('mode') === 'sheet' ? 'sheet' : 'paced',
      review: p.get('review') === '1',
    };
  }
  function scopeParams(scope, extra) {
    const out = Object.assign({ view: 'drill', section: scope.section }, extra);
    if (scope.category) out.category = scope.category;
    if (scope.topic) out.topic = scope.topic;
    return out;
  }
  function sameScope(a, b) {
    return a.section === b.section && (a.category || '') === (b.category || '') && (a.topic || '') === (b.topic || '');
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

  /* ---------- run state ---------- */
  // drill = { scope, n, mode, qs: [id], orders: { id: [display -> authored] }, idx, results: [],
  //           attemptId, seed, paceSeconds, startedAt, itemStart, itemMs, deadline, _remain, shownSets }
  let drill = null,
    ticker = null,
    lastRun = null;

  function startRun(scope, n, mode) {
    const store = stores();
    const o = outline(),
      seed = now() % 2147483647;
    let items = Core.shuffle(Core.pool(DAT.questions, o, scope), seed);
    // Least-seen first, ties in shuffled order.
    items = items
      .map((q, i) => [q, store.hist[q.id]?.n || 0, i])
      .sort((a, b) => a[1] - b[1] || a[2] - b[2])
      .map(([q]) => q);
    // DAT-06/DAT-13: the pool is cut to n BEFORE set-mates are grouped, so a multi-item data-table
    // set that straddles position n is split and the tail items lose their shared table. Harmless
    // today — the only setId groups in the banks are QR, and SECTION_CHOICES never reaches them —
    // so this stays as it is until the QR runner lands, which must draw n + the largest set size,
    // group, then cut to n. (The previous Math.max(n, ...) expression here was a no-op: both
    // branches of its ternary were n.)
    items = Core.groupSets(items.slice(0, n));
    if (!items.length) return false;
    const orders = {};
    items.forEach((q, i) => (orders[q.id] = Core.orderOptions(q, seed + i)));
    const paceSeconds = Core.pace(o, items[0]);
    drill = {
      scope,
      n,
      mode,
      qs: items.map(q => q.id),
      orders,
      idx: 0,
      results: [],
      attemptId: attemptId(),
      seed,
      paceSeconds,
      startedAt: now(),
      itemStart: null,
      itemMs: 0,
      deadline: mode === 'exam' ? now() + items.length * paceSeconds * 1000 : null,
      shownSets: [],
    };
    return true;
  }
  function resumeRun(blob) {
    stores();
    const map = byId();
    // A deploy can retire a bank item under a saved blob. Dropping its id from qs shifts every
    // later position, so results and idx are re-indexed through the same keep list rather than
    // carried over: the learner keeps every answer they gave, each still attached to the question
    // it was given for. (orders is keyed by id, so it needs no re-indexing.)
    const keep = blob.qs.map((id, i) => i).filter(i => map.has(blob.qs[i]));
    if (!keep.length) {
      clearResume();
      return false;
    }
    const qs = keep.map(i => blob.qs[i]);
    drill = Object.assign({}, blob, {
      qs,
      itemStart: null,
      results: keep.map(i => (blob.results || [])[i] || null),
      shownSets: blob.shownSets || [],
    });
    drill.idx = Math.min(keep.filter(i => i < (blob.idx || 0)).length, qs.length);
    if (drill.mode === 'exam') drill.deadline = now() + (Number(blob._remain) || 0);
    delete drill._remain;
    delete drill._saved;
    return true;
  }
  function elapsedItemMs() {
    return (drill.itemMs || 0) + (drill.itemStart ? now() - drill.itemStart : 0);
  }

  /* ---------- clock ---------- */
  function stopTicker() {
    if (ticker) clearInterval(ticker);
    ticker = null;
  }
  function tick() {
    if (!drill) return stopTicker();
    const node = document.querySelector('#dat-drill-clock');
    if (!node) return stopTicker();
    if (drill.mode === 'exam') {
      const remain = drill.deadline - now();
      node.textContent = fmtClock(remain);
      node.classList.toggle('dat-over', remain <= 60000);
      if (remain <= 0) {
        stopTicker();
        finishRun(true);
      }
    } else if (drill.mode === 'paced') {
      const ms = elapsedItemMs(),
        target = drill.paceSeconds * 1000;
      const fill = node.querySelector('.dat-pace-fill'),
        label = node.querySelector('.dat-pace-label');
      if (fill) fill.style.width = Math.min(100, (ms / target) * 100).toFixed(1) + '%';
      if (label) label.textContent = `${Math.floor(ms / 1000)} s / ${drill.paceSeconds} s`;
      node.classList.toggle('dat-over', ms > target);
      node.setAttribute('aria-valuenow', String(Math.min(100, Math.round((ms / target) * 100))));
    }
  }
  function startTicker() {
    stopTicker();
    if (!drill || drill.mode === 'untimed') return;
    if (drill.idx < drill.qs.length && !drill.results[drill.idx] && !drill.itemStart) drill.itemStart = now();
    if (drill.mode === 'exam' && !drill.deadline) drill.deadline = now() + (Number(drill._remain) || 0);
    tick();
    ticker = setInterval(tick, TICK_MS);
  }
  // Registered in DAT.pausers: stops the clock, freezes the item and section timers and hands the
  // shell a resume hook so saving-recovered can restart the clock while the drill is on screen.
  function pause() {
    stopTicker();
    if (!drill) return undefined;
    if (drill.itemStart) {
      drill.itemMs = elapsedItemMs();
      drill.itemStart = null;
    }
    if (drill.deadline) {
      drill._remain = Math.max(0, drill.deadline - now());
      drill.deadline = null;
    }
    return {
      selector: '#dat-drill-clock',
      resume() {
        if (!drill) return;
        if (drill.mode === 'exam') drill.deadline = now() + (Number(drill._remain) || 0);
        delete drill._remain;
        startTicker();
      },
    };
  }

  /* ---------- views ---------- */
  function page(main) {
    datView(main);
  }
  function backLink(label = 'Back to DAT') {
    return `<a class="btn" data-dat-go href="${esc(datUrl())}">${label}</a>`;
  }

  function renderSetup(notice) {
    const p = params(),
      o = outline();
    if (!o) {
      const main = el(
        `<main class="panel dat-drill-setup"><h1>Timed drills</h1><p class="sub">The content outline has not loaded.</p><div class="endbtns">${backLink()}</div></main>`
      );
      datDataNotice(main);
      return page(main);
    }
    const state = {
      section: SECTION_CHOICES.includes(p.section) ? p.section : 'mixed',
      n: LENGTHS.includes(p.n) ? p.n : 15,
      mode: MODES[p.mode] ? p.mode : 'paced',
      category: p.category,
      topic: p.topic,
    };
    const saved = loadResume();
    const main = el(`<main class="panel dat-drill-setup">
      <div class="hero"><span class="label">DAT &middot; Survey of the Natural Sciences</span><h1>Timed science drills.</h1>
      <p class="sub">One item at a time against the ${Core.pace(o, 'bio')}-second pace, with confidence tagging and a distractor autopsy. The periodic table is one click away on every drill.</p></div>
      ${notice ? `<aside class="course-notice dat-drill-notice" role="status">${notice}</aside>` : ''}
      ${saved ? `<div class="dat-resume-row"><span>A ${esc(sectionName(saved.scope.section))} drill is in progress (${(saved.results || []).filter(Boolean).length}/${saved.qs.length} answered).</span><a class="btn btn-solid" id="dat-resume" data-dat-go href="${esc(datUrl(scopeParams(saved.scope, { n: saved.n, mode: saved.mode })))}">Resume drill</a></div>` : ''}
      <div class="ctl"><span class="label">Section</span><div class="modes" id="dat-setup-section">${SECTION_CHOICES.map(s => `<button class="mode${s === state.section ? ' active' : ''}" data-dat-section="${s}">${esc(s === 'mixed' ? 'Mixed' : sectionAbbr(s))}</button>`).join('')}</div></div>
      <div class="ctl"><span class="label">Length</span><div class="modes" id="dat-setup-n">${LENGTHS.map(n => `<button class="mode${n === state.n ? ' active' : ''}" data-dat-n="${n}">${n}</button>`).join('')}</div></div>
      <div class="ctl"><span class="label">Mode</span><div class="modes" id="dat-setup-mode">${Object.entries(MODES)
        .map(
          ([k, label]) =>
            `<button class="mode${k === state.mode ? ' active' : ''}" data-dat-mode="${k}">${label}</button>`
        )
        .join('')}</div><p class="dat-mode-hint" id="dat-mode-hint">${MODE_HINT[state.mode]}</p></div>
      <div class="dat-filters">
        <label class="ctl"><span class="label">Category</span><select id="dat-setup-category"></select></label>
        <label class="ctl"><span class="label">Topic</span><select id="dat-setup-topic"></select></label>
      </div>
      <p class="dat-pool-note" id="dat-pool-note" role="status"></p>
      <div class="endbtns"><button class="btn btn-solid" id="dat-start">Start drill</button>${backLink()}</div>
      <section class="dat-sheet-links" aria-labelledby="dat-sheets-title"><h2 id="dat-sheets-title">Cheat sheets</h2><p class="sub">The high-yield cards for each science, on one page.</p><nav>${Core.mixedSections(
        o
      )
        .map(
          s =>
            `<a data-dat-go href="${esc(datUrl({ view: 'drill', section: s, mode: 'sheet' }))}">${esc(sectionName(s))}</a>`
        )
        .join('')}</nav></section>
      <p class="course-caption"><a data-dat-go href="${esc(datUrl({ view: 'mistakes' }))}">Mistake log</a> &middot; Option counts follow the outline's option policy (${esc(o.optionPolicy?.sns?.status || 'unverified')}).</p>
    </main>`);
    const catSel = main.querySelector('#dat-setup-category'),
      topicSel = main.querySelector('#dat-setup-topic'),
      note = main.querySelector('#dat-pool-note'),
      start = main.querySelector('#dat-start');
    const fill = (select, options, value, placeholder) => {
      select.innerHTML =
        `<option value="">${placeholder}</option>` +
        options
          .map(([v, label]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(label)}</option>`)
          .join('');
    };
    const refresh = () => {
      const cats = categories(state.section);
      if (!cats.some(c => c.id === state.category)) state.category = '';
      fill(
        catSel,
        cats.map(c => [c.id, c.id + ' · ' + c.title]),
        state.category,
        'All categories'
      );
      const topics = state.category ? cats.find(c => c.id === state.category).topics : [];
      if (!topics.includes(state.topic)) state.topic = '';
      fill(
        topicSel,
        topics.map(t => [t, t]),
        state.topic,
        state.category ? 'All topics' : 'Choose a category first'
      );
      topicSel.disabled = !state.category;
      const size = Core.pool(DAT.questions, o, state).length;
      start.disabled = size === 0;
      note.className = 'dat-pool-note' + (size < state.n ? ' dat-pool-short' : '');
      note.textContent =
        size === 0
          ? 'No items match this scope yet. Widen the scope or pick another section.'
          : size < state.n
            ? `Only ${size} item${size === 1 ? '' : 's'} match this scope; the drill will use all of them.`
            : `${size} items available.`;
      main.querySelector('#dat-mode-hint').textContent = MODE_HINT[state.mode];
    };
    const segment = (selector, key, set) =>
      main.querySelectorAll(selector + ' .mode').forEach(b =>
        b.addEventListener('click', () => {
          set(b.dataset[key]);
          main.querySelectorAll(selector + ' .mode').forEach(x => x.classList.toggle('active', x === b));
          refresh();
        })
      );
    segment('#dat-setup-section', 'datSection', v => (state.section = v));
    segment('#dat-setup-n', 'datN', v => (state.n = +v));
    segment('#dat-setup-mode', 'datMode', v => (state.mode = v));
    catSel.addEventListener('change', () => {
      state.category = catSel.value;
      state.topic = '';
      refresh();
    });
    topicSel.addEventListener('change', () => {
      state.topic = topicSel.value;
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

  function renderSheet(section) {
    const o = outline(),
      keys = section === 'mixed' ? Core.mixedSections(o) : [section];
    const cards = DAT.cards.filter(c => c.tag === 'cheat-sheet' && keys.includes(c.section));
    const groups = categories(section)
      .map(cat => [cat, cards.filter(c => c.category === cat.id)])
      .filter(([, list]) => list.length);
    const main = el(`<main class="panel dat-sheet">
      <div class="hero"><span class="label">DAT &middot; Cheat sheet</span><h1>${esc(sectionName(section))}</h1>
      <p class="sub">${cards.length ? `${cards.length} card${cards.length === 1 ? '' : 's'} tagged for the sheet, grouped by outline category.` : 'No cards are tagged for this sheet yet; the content sessions add them.'}</p></div>
      ${groups
        .map(
          ([cat, list]) =>
            `<section class="dat-sheet-group"><h2>${esc(cat.id)} &middot; ${esc(cat.title)}</h2><dl>${list.map(c => `<div class="dat-sheet-card"><dt>${esc(c.front)}</dt><dd>${esc(c.back)}<small>${esc(c.topic || '')}</small></dd></div>`).join('')}</dl></section>`
        )
        .join('')}
      <div class="endbtns"><a class="btn btn-solid" data-dat-go href="${esc(datUrl({ view: 'drill', section, n: 15 }))}">Drill ${esc(sectionAbbr(section))}</a>${backLink()}</div>
    </main>`);
    page(main);
  }

  function optionButtons(item, order, letters) {
    return order
      .map(
        (authored, pos) =>
          `<button class="opt dat-opt" id="dat-opt-${pos}" data-dat-i="${authored}" data-dat-pos="${pos}"><span class="key">${esc(letters[pos] ?? pos + 1)}</span><span>${esc(item.options[authored])}</span></button>`
      )
      .join('');
  }
  function tableHtml(table) {
    if (!table) return '';
    return `<table class="dat-data-table">${table.caption ? `<caption>${esc(table.caption)}</caption>` : ''}<thead><tr>${(table.headers || []).map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${(table.rows || []).map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function itemBody(item) {
    const parts = [];
    if (item.format === 'data' && item.table) {
      const again = item.setId && drill.shownSets.includes(item.setId);
      parts.push(
        again
          ? `<details class="dat-data-again"><summary>Table for this set (shown once above)</summary>${tableHtml(item.table)}</details>`
          : `<div class="dat-data">${tableHtml(item.table)}</div>`
      );
    }
    if (item.format === 'qc') {
      if (item.common) parts.push(`<p class="dat-qc-common">${esc(item.common)}</p>`);
      parts.push(
        `<div class="dat-qc"><div class="dat-qc-col"><span class="label">Quantity A</span><p>${esc(item.quantityA)}</p></div><div class="dat-qc-col"><span class="label">Quantity B</span><p>${esc(item.quantityB)}</p></div></div>`
      );
    }
    parts.push(`<p class="q dat-stem">${esc(item.stem)}</p>`);
    if (item.format === 'ds' && Array.isArray(item.statements))
      parts.push(
        `<ol class="dat-ds">${item.statements.map((s, i) => `<li><span class="label">Statement ${i + 1}</span><p>${esc(s)}</p></li>`).join('')}</ol>`
      );
    if (item.figure) parts.push(`<figure class="dat-figure">${item.figure}</figure>`);
    return parts.join('');
  }
  function periodicTableHtml() {
    const cells = ELEMENTS.map(e => {
      const [row, col] = elementCell(e.number);
      return `<div class="dat-pt-cell" style="grid-row:${row};grid-column:${col}" title="${e.number} ${esc(e.symbol)} · ${esc(e.mass)}"><span class="dat-pt-z">${e.number}</span><span class="dat-pt-sym">${esc(e.symbol)}</span><span class="dat-pt-mass">${esc(e.mass)}</span></div>`;
    });
    cells.push(
      '<div class="dat-pt-cell dat-pt-marker" style="grid-row:6;grid-column:3"><span class="dat-pt-sym">57–71</span></div>'
    );
    cells.push(
      '<div class="dat-pt-cell dat-pt-marker" style="grid-row:7;grid-column:3"><span class="dat-pt-sym">89–103</span></div>'
    );
    return `<div class="dat-modal" id="dat-periodic-modal" role="dialog" aria-modal="true" aria-labelledby="dat-periodic-title">
      <div class="dat-modal-box">
        <div class="dat-modal-head"><h2 id="dat-periodic-title">Periodic table</h2><button class="btn" id="dat-periodic-close">Close</button></div>
        <div class="dat-ptable">${cells.join('')}</div>
        <p class="course-caption">Atomic number, symbol and standard atomic weight; bracketed values are the most stable isotope. Drawn from element data, not the testing software.</p>
      </div>
    </div>`;
  }
  function openPeriodicTable(root) {
    if (root.querySelector('#dat-periodic-modal')) return;
    const opener = document.activeElement;
    const modal = el(periodicTableHtml());
    const close = () => {
      modal.remove();
      // Hand focus back to whatever opened the table, so the keyboard does not land on <body>.
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    };
    root.appendChild(modal);
    modal.querySelector('#dat-periodic-close').addEventListener('click', close);
    modal.addEventListener('click', e => {
      if (e.target === modal) close();
    });
    modal.querySelector('#dat-periodic-close').focus();
  }

  function renderItem() {
    if (!drill) return renderSetup();
    if (drill.idx >= drill.qs.length) return finishRun(false);
    const item = byId().get(drill.qs[drill.idx]);
    if (!item) {
      drill.idx++;
      return renderItem();
    }
    const o = outline(),
      order = drill.orders[item.id] || Core.orderOptions(item, drill.seed),
      letters = Core.letters(order.length),
      saved = drill.results[drill.idx],
      exit = datUrl({ view: 'drill' });
    if (!saved && item.setId && !drill.shownSets.includes(item.setId)) {
      // The set's table shows in full for this item and collapsed for the rest of the set.
      setTimeout(() => drill && drill.shownSets.push(item.setId), 0);
    }
    if (!saved) saveResume();
    const clock =
      drill.mode === 'paced'
        ? `<div class="dat-pace" id="dat-drill-clock" role="progressbar" aria-label="Time on this item against the pace target" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="dat-pace-track"><div class="dat-pace-fill"></div></div><span class="dat-pace-label">0 s / ${drill.paceSeconds} s</span></div>`
        : drill.mode === 'exam'
          ? `<span class="dat-exam-clock" id="dat-drill-clock" aria-live="off">${fmtClock((drill.deadline || now() + (drill._remain || 0)) - now())}</span>`
          : '';
    const root = el(`<div class="dat-drill" data-dat-mode="${drill.mode}">
      <header class="dat-drill-bar">
        <a class="dat-drill-exit" id="dat-drill-exit" data-dat-go href="${esc(exit)}">&larr; Exit</a>
        <nav class="dat-drill-crumb" aria-label="Drill position"><span>DAT</span><span>${esc(sectionAbbr(item.section))}</span><span>${esc(categoryTitle(item.category))}</span></nav>
        <div class="dat-drill-right">${clock}<span class="dat-drill-count">Q ${drill.idx + 1}/${drill.qs.length}</span></div>
      </header>
      <main class="case dat-drill-main">
        <div class="dat-drill-tools">${periodicTableAllowed(item.section) ? '<button class="btn" id="dat-periodic" type="button">Periodic table</button>' : ''}<span class="dat-drill-topic">${esc(item.topic || '')}</span></div>
        <div class="block dat-item">${itemBody(item)}</div>
        <div class="dat-conf-row"><span class="label">Confidence</span><div class="modes" id="dat-conf">${Object.entries(
          CONF
        )
          .map(
            ([k, label]) =>
              `<button class="mode dat-conf${k === 'unsure' ? ' active' : ''}" data-dat-conf="${k}" type="button">${label}</button>`
          )
          .join('')}</div></div>
        <div class="opts dat-opts" id="dat-opts">${optionButtons(item, order, letters)}</div>
        <div class="dat-after" id="dat-after"></div>
        <p class="dat-save-status" id="dat-save-status" role="status"></p>
      </main>
    </div>`);
    let conf = saved?.conf || 'unsure';
    root.querySelectorAll('#dat-conf .mode').forEach(b =>
      b.addEventListener('click', () => {
        conf = b.dataset.datConf;
        root.querySelectorAll('#dat-conf .mode').forEach(x => x.classList.toggle('active', x === b));
      })
    );
    root
      .querySelectorAll('.dat-opt')
      .forEach(b => b.addEventListener('click', () => answer(root, item, +b.dataset.datI, conf)));
    root.querySelector('#dat-periodic')?.addEventListener('click', () => openPeriodicTable(root));
    const wrap = el('<div></div>');
    wrap.appendChild(topbar('dat'));
    wrap.appendChild(root);
    setView(wrap);
    root.querySelectorAll('a[data-dat-go]').forEach(link =>
      link.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const target = new URL(link.getAttribute('href'), location.origin);
        datGo(Object.fromEntries(target.searchParams));
      })
    );
    if (saved) reveal(root, item, saved);
    else {
      drill.itemMs = 0;
      drill.itemStart = null;
      startTicker();
      if (drill.mode === 'untimed') drill.itemStart = now();
    }
    if (!o) saveStatus(true);
  }

  function answer(root, item, authored, conf) {
    if (!drill || drill.results[drill.idx]) return;
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
    drill.results[drill.idx] = entry;
    drill.itemStart = null;
    drill.itemMs = 0;
    if (drill.mode !== 'exam') stopTicker();
    datLogAttempt(drill, entry);
    saveResume();
    reveal(root, item, entry);
  }

  function autopsyHtml(item, order, chosen) {
    const letters = Core.letters(order.length),
      letterOf = authored => letters[order.indexOf(authored)] ?? '?';
    const rows = (item.distractors || [])
      .filter(d => d.i !== item.answer)
      .map(
        d =>
          `<div class="autopsy-row${d.i === chosen ? ' dat-chosen' : ''}"><span class="ak">${esc(letterOf(d.i))}</span><span>${esc(d.why)}${d.i === chosen ? ' <em>(your choice)</em>' : ''}</span></div>`
      )
      .join('');
    return rows ? `<div class="autopsy dat-autopsy"><span class="label">Distractor autopsy</span>${rows}</div>` : '';
  }
  function reveal(root, item, entry) {
    const order = drill.orders[item.id] || Core.orderOptions(item, drill.seed),
      examMode = drill.mode === 'exam';
    root.querySelectorAll('.dat-opt').forEach(btn => {
      const i = +btn.dataset.datI;
      btn.disabled = true;
      if (examMode) {
        if (i === entry.chosen) btn.classList.add('picked');
      } else if (i === item.answer) btn.classList.add('correct');
      else if (i === entry.chosen) btn.classList.add('wrong');
      else btn.classList.add('dimmed');
    });
    root.querySelectorAll('#dat-conf .mode').forEach(b => {
      b.disabled = true;
      b.classList.toggle('active', b.dataset.datConf === entry.conf);
    });
    const last = drill.idx + 1 >= drill.qs.length,
      after = root.querySelector('#dat-after');
    const seconds = typeof entry.ms === 'number' ? (entry.ms / 1000).toFixed(0) : null;
    after.innerHTML = examMode
      ? `<div class="continue-row"><span class="hint">answer recorded${seconds ? ` &middot; ${seconds} s` : ''}</span><button class="btn btn-solid" id="dat-next" data-next>${last ? 'Finish' : 'Next'}</button></div>`
      : `<div class="explain dat-explain ${entry.correct ? 'good' : 'bad'}"><span class="verdict">${entry.correct ? 'CORRECT' : 'INCORRECT'}${seconds ? ` &middot; ${seconds} s${entry.ms > drill.paceSeconds * 1000 ? ' (over pace)' : ''}` : ''}</span><p>${esc(item.explanation)}</p>${autopsyHtml(item, order, entry.chosen)}</div>
        <div class="continue-row"><span class="hint">ENTER &rarr;</span><button class="btn btn-solid" id="dat-next" data-next>${last ? 'Results' : 'Next'}</button></div>`;
    after.querySelector('#dat-next').addEventListener('click', () => {
      if (!drill) return;
      drill.idx++;
      if (drill.idx >= drill.qs.length) finishRun(false);
      else renderItem();
    });
  }

  function finishRun(forced) {
    if (!drill) return renderSetup();
    stopTicker();
    const map = byId();
    drill.qs.forEach((id, i) => {
      if (drill.results[i]) return;
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
      drill.results[i] = entry;
      if (forced) datLogAttempt(drill, entry);
    });
    drill.finishedAt = now();
    drill.forced = !!forced;
    lastRun = drill;
    drill = null;
    clearResume();
    renderReview(lastRun);
  }

  function renderReview(run) {
    const o = outline(),
      map = byId(),
      s = Core.summary(run);
    const secs = s.msPerItem ? (s.msPerItem / 1000).toFixed(1) : '—';
    const topics = Object.entries(s.byTopic).sort(
      (a, b) => a[1].correct / a[1].n - b[1].correct / b[1].n || b[1].n - a[1].n || a[0].localeCompare(b[0])
    );
    const again = datUrl(scopeParams(run.scope, { n: run.n, mode: run.mode }));
    const letterFor = (item, authored) => {
      const order = run.orders[item.id] || Core.orderOptions(item, run.seed);
      return Core.letters(order.length)[order.indexOf(authored)] ?? '—';
    };
    const main = el(`<main class="panel dat-review">
      <section class="summary dat-review-summary">
        <span class="label">Drill complete${run.forced ? ' &middot; section clock ended the drill' : ''}</span>
        <div class="score">${String(s.correct).padStart(2, '0')}<span class="of">/${String(s.n).padStart(2, '0')}</span></div>
        <dl class="dat-review-stats">
          <div><dt>Accuracy</dt><dd id="dat-review-accuracy">${pct(s.accuracy)}</dd></div>
          <div><dt>Seconds per item</dt><dd id="dat-review-pace">${secs} s <small>vs ${s.paceSeconds} s target</small></dd></div>
          <div><dt>Over pace</dt><dd>${s.overPace} of ${s.n}</dd></div>
          <div><dt>Fast wrong</dt><dd id="dat-review-fast-wrong">${s.fastWrong}</dd></div>
          <div><dt>Slow wrong</dt><dd id="dat-review-slow-wrong">${s.slowWrong}</dd></div>
          ${s.unanswered ? `<div><dt>Unanswered</dt><dd>${s.unanswered}</dd></div>` : ''}
        </dl>
        <div class="ticks">${run.results.map((r, i) => `<span class="${r?.correct ? 'ok' : 'no'}">Q${i + 1} ${r?.correct ? '&#10003;' : '&#10007;'}</span>`).join('')}</div>
      </section>
      <section class="dat-review-topics" aria-labelledby="dat-review-topics-title"><h2 id="dat-review-topics-title">By topic</h2>
        <table class="dat-topic-table"><thead><tr><th scope="col">Category</th><th scope="col">Topic</th><th scope="col">Correct</th><th scope="col">Accuracy</th></tr></thead>
        <tbody>${topics
          .map(
            ([topic, row]) =>
              `<tr><td>${esc(categoryTitle(row.category))}</td><td>${esc(topic)}</td><td>${row.correct}/${row.n}</td><td>${pct(row.correct / row.n)}</td></tr>`
          )
          .join('')}</tbody></table>
      </section>
      <section class="drill-review dat-review-items"><span class="label">Review</span>
        ${run.qs
          .map((id, i) => {
            const item = map.get(id),
              r = run.results[i];
            if (!item || !r) return '';
            const order = run.orders[item.id] || Core.orderOptions(item, run.seed);
            return `<details class="rev dat-rev"${r.correct ? '' : ' open'}>
              <summary><span class="${r.correct ? 'ok' : 'no'}">${r.correct ? '&#10003;' : '&#10007;'}</span> Q${i + 1}. ${esc(item.stem.slice(0, 90))}${item.stem.length > 90 ? '&hellip;' : ''}</summary>
              <div class="rev-body">
                <div class="rev-ans">You: ${r.chosen == null ? 'Unanswered' : esc(letterFor(item, r.chosen))} &middot; Correct: <b>${esc(letterFor(item, item.answer))}</b>${r.conf ? ` &middot; felt ${CONF[r.conf] || esc(r.conf)}` : ''}${typeof r.ms === 'number' ? ` &middot; ${(r.ms / 1000).toFixed(0)} s` : ''}</div>
                <p class="dat-rev-topic">${esc(categoryTitle(item.category))} &middot; ${esc(item.topic || '')}</p>
                <p>${esc(item.explanation)}</p>
                ${autopsyHtml(item, order, r.chosen)}
              </div></details>`;
          })
          .join('')}
      </section>
      <div class="endbtns"><a class="btn btn-solid" id="dat-again" data-dat-go href="${esc(again)}">Drill again</a><a class="btn" data-dat-go href="${esc(datUrl({ view: 'drill' }))}">New drill</a><a class="btn" data-dat-go href="${esc(datUrl({ view: 'mistakes' }))}">Mistake log</a>${backLink()}</div>
      <p class="dat-save-status" id="dat-save-status" role="status"></p>
      ${o?.optionPolicy?.sns?.status === 'unverified' ? `<p class="course-caption">Option count per item follows the outline's option policy (${esc(o.optionPolicy.sns.status)}).</p>` : ''}
    </main>`);
    page(main);
    saveStatus(!StudyStorage.paused);
  }

  /* ---------- entry points ---------- */
  function render() {
    const p = params();
    if (!p.section) return renderSetup();
    if (p.review) return mistakes();
    if (p.mode === 'sheet') return renderSheet(p.section);
    const scope = { section: p.section, category: p.category, topic: p.topic };
    const saved = loadResume();
    if (saved && sameScope(saved.scope, scope) && resumeRun(saved)) return renderItem();
    if (!startRun(scope, p.n, p.mode))
      return renderSetup(
        `<strong>No items match that scope yet.</strong><p>${esc(sectionName(p.section))}${p.category ? ` · ${esc(p.category)}` : ''}${p.topic ? ` · ${esc(p.topic)}` : ''} has no practice items in the loaded banks. Pick another scope below.</p>`
      );
    renderItem();
  }
  // DAT-05 builds the grouped log and the review drill; this lists what is due today.
  function mistakes() {
    const store = stores();
    const due = Core.dueMistakes(store.srs, now()),
      total = Object.keys(store.srs).length,
      map = byId();
    const groups = {};
    for (const rec of due) (groups[rec.section || 'other'] ||= []).push(rec);
    const main = el(`<main class="panel dat-mistakes">
      <div class="hero"><span class="label">DAT &middot; Mistake log</span><h1>Mistake log</h1>
      <p class="sub">${total ? `${total} missed item${total === 1 ? '' : 's'} enrolled; ${due.length} due now.` : 'Missed drill items are enrolled here automatically.'} Spaced review of these items (re-asking them and rating each answer) arrives in DAT-05.</p></div>
      ${Object.entries(groups)
        .map(
          ([section, list]) =>
            `<section class="dat-mistake-group"><h2>${esc(sectionName(section))} <small>${list.length} due</small></h2><ul>${list
              .map(rec => {
                const item = map.get(rec.id);
                return `<li><span class="dat-mistake-topic">${esc(categoryTitle(rec.category))}${rec.topic ? ' · ' + esc(rec.topic) : ''}</span>${item ? `<span class="dat-mistake-stem">${esc(item.stem.slice(0, 110))}${item.stem.length > 110 ? '…' : ''}</span>` : `<span class="dat-mistake-stem">${esc(rec.id)}</span>`}<small>${rec.lapses ? `missed ${rec.lapses + 1}×` : 'missed once'}</small></li>`;
              })
              .join('')}</ul></section>`
        )
        .join('')}
      <div class="endbtns"><a class="btn btn-solid" data-dat-go href="${esc(datUrl({ view: 'drill' }))}">Start a drill</a>${backLink()}</div>
    </main>`);
    page(main);
  }

  /* ---------- keyboard ---------- */
  // Letters and digits answer the visible item. Scoped to a .dat-drill root and #dat-opt-* ids so
  // the mcat.js handler (gated on #conf/#opts) and the app.js handler (.quizwrap .stage) never
  // see a second target; Enter is left to app.js, which clicks [data-next].
  document.addEventListener('keydown', e => {
    const root = document.querySelector('.dat-drill');
    if (!root) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT'))
      return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const modal = root.querySelector('.dat-modal');
    if (modal) {
      if (e.key === 'Escape') {
        e.preventDefault();
        modal.remove();
      }
      return;
    }
    if (e.key === 'p' || e.key === 'P') {
      const button = root.querySelector('#dat-periodic');
      if (button) {
        e.preventDefault();
        button.click();
      }
      return;
    }
    const letters = Core.letters(root.querySelectorAll('.dat-opt').length);
    let pos = -1;
    if (/^[0-9]$/.test(e.key)) pos = Number(e.key) - 1;
    else if (e.key.length === 1) pos = letters.indexOf(e.key.toUpperCase());
    if (pos < 0 || pos >= letters.length) return;
    const opt = root.querySelector('#dat-opt-' + pos);
    if (opt && !opt.disabled) {
      e.preventDefault();
      opt.click();
    }
  });

  // resetDatState calls this after it has forgotten the loaded data and cleared the resume blobs:
  // the cached stores and the in-flight run have to go too, or the first answer after a reset
  // writes the previous workspace's whole log back over the cleared keys.
  function reset() {
    stopTicker();
    drill = null;
    lastRun = null;
    DAT.attemptStores = null;
  }

  DAT.pausers.push(pause);
  window.DatPractice = { render, mistakes, pause, reset };
})();
