/* DAT Perceptual Ability sets (DAT-04, extended in DAT-10): subtest picker, level dial, timed
   15-item sets with a per-item pace bar, the mixed ninety-item form under one sixty-minute
   clock, review that regenerates every figure from its id, and "add to mistake log".
   Names are #dat-pat-*, .dat-pat-*, data-dat-* only; option letters come from LETTERS (app.js)
   over options.length, never a literal count.

   Storage rule, non-negotiable (DESIGN §9 risk 5): study-backup.js refuses any value that
   contains markup, so no SVG string ever reaches cs-dat-log, cs-dat-srs or cs-dat-r-pat. Only
   the regeneration triple (subtest, seed, level) plus ids, answers and timings are written;
   DatPatCore.fromId rebuilds the figure on render. */
(function () {
  const Core = window.DatPatCore;
  const LOG_KEY = 'cs-dat-log',
    HIST_KEY = 'cs-dat-q',
    SRS_KEY = 'cs-dat-srs',
    RESUME_KEY = 'cs-dat-r-pat',
    LOG_CAP = 2000,
    SET_SIZE = 15,
    FORM_PER = 15,
    FORM_SECONDS = 3600,
    RAISE_SCORE = 13,
    DEFAULT_LEVEL = 2,
    TICK_MS = 250;
  const CONF = { guess: 'Guess', unsure: 'Unsure', sure: 'Sure' };

  /* ---------- storage ---------- */
  // cs-dat-log, cs-dat-q and cs-dat-srs are written by this module AND by dat-practice.js, which
  // the shell loads into the same document. One cache serves both, hung on the DAT runtime object
  // and built by whichever module reads first: two private caches would each write a whole-array
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
    return 'dat-pat-' + now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function saveStatus(ok) {
    const node = document.querySelector('#dat-pat-save-status');
    if (!node) return;
    node.textContent = ok
      ? ''
      : 'Saving is paused. Your answers stay in this tab until the browser copy can be written again.';
  }
  // One QLOG row per answered item. The triple travels with the row so the mistake log and the
  // progress page can regenerate the figure without storing it.
  function logRow(entry) {
    return {
      qId: entry.id,
      section: 'pat',
      category: entry.category,
      topic: null,
      subtest: entry.subtest,
      seed: entry.seed,
      level: entry.level,
      correct: !!entry.correct,
      conf: entry.conf || null,
      ms: typeof entry.ms === 'number' ? entry.ms : null,
      ts: entry.ts,
      attemptId: entry.attemptId,
      source: 'pat',
    };
  }
  function logAttempt(entry) {
    const store = stores();
    const ts = now();
    const row = logRow(Object.assign({ ts }, entry));
    if (!store.log.some(r => r.attemptId === row.attemptId && r.qId === row.qId)) {
      store.log.push(row);
      if (store.log.length > LOG_CAP) store.log.splice(0, store.log.length - LOG_CAP);
    }
    const h = store.hist[row.qId] || { n: 0 };
    if (h.lastAttemptId !== row.attemptId) h.n = (h.n || 0) + 1;
    h.lastAttemptId = row.attemptId;
    h.lastCorrect = row.correct;
    h.conf = row.conf;
    h.ts = ts;
    store.hist[row.qId] = h;
    const ok = StudyStorage.write(LOG_KEY, store.log) && StudyStorage.write(HIST_KEY, store.hist);
    saveStatus(ok);
    return ok;
  }
  // The mistake-log record carries the triple, never the figure. DAT-05 re-asks it through
  // DatPatCore.fromId. cs-dat-srs is one store shared with the science drills, so the record is
  // created and aged by dat-drill-engine.js's scheduler and never by a second rule written here:
  // a repeat PAT miss decays ease and zeroes reps exactly as a repeat drill miss does.
  function enrol(item) {
    const store = stores();
    const ts = now();
    const record = window.DatDrillCore.enroll(
      store.srs,
      { id: item.id, section: 'pat', category: item.category, topic: null },
      ts
    );
    Object.assign(record, { subtest: item.subtest, seed: item.seed, level: item.level });
    const ok = StudyStorage.write(SRS_KEY, store.srs);
    saveStatus(ok);
    return ok;
  }
  function enrolled(id) {
    return !!stores().srs[id];
  }
  // Resume blob: ids and answers only. Asserted markup-free by scripts/test-dat-storage.cjs.
  function saveResume() {
    if (!run || run.done) return false;
    const blob = {
      form: !!run.form,
      subtest: run.subtest,
      level: run.level,
      ids: run.ids.slice(),
      idx: run.idx,
      results: run.results.map(r => (r ? { picked: r.picked, correct: r.correct, ms: r.ms, conf: r.conf } : null)),
      attemptId: run.attemptId,
      startedAt: run.startedAt,
      // A form is timed as a whole, so what has to survive a reload is the section clock, not
      // the time on the item in front of you.
      _remain: run.form
        ? Math.max(0, run.formMs * 1000 - formElapsed())
        : Math.max(0, run.paceSeconds * 1000 - elapsed()),
      _saved: now(),
    };
    const ok = StudyStorage.write(RESUME_KEY, blob);
    saveStatus(ok);
    return ok;
  }
  function loadResume() {
    const blob = StudyStorage.read(RESUME_KEY, null);
    if (!blob || !Array.isArray(blob.ids) || !blob.ids.length) return null;
    if (!Core) return null;
    if (!blob.form && !Core.isBuilt(blob.subtest)) return null;
    return blob;
  }
  function clearResume() {
    return StudyStorage.remove(RESUME_KEY);
  }

  /* ---------- outline and data helpers ---------- */
  function outline() {
    return DAT.outline;
  }
  function subtests() {
    return outline()?.patSubtests || [];
  }
  function subtestInfo(id) {
    return subtests().find(s => s.id === id) || null;
  }
  function paceFor(id) {
    return subtestInfo(id)?.seconds || outline()?.pacingSeconds?.pat || 40;
  }
  function rulesFor(id) {
    return (DAT.pat?.subtests || []).find(s => s.id === id) || null;
  }
  function levelLabel(level) {
    return (Core && Core.LEVELS[level]) || 'Test-like';
  }
  function levelNote(id, level) {
    return rulesFor(id)?.levels?.[String(level)]?.note || '';
  }
  function letters(count) {
    return Array.from({ length: count }, (_, i) => LETTERS[i] || String(i + 1));
  }
  /* The level ramp, surfaced rather than applied (DESIGN §6): a subtest is ready for the next
     level once the last two full sets at this level came in at 13 of 15 or better AND inside the
     pace budget. The picker only says so; the learner still turns the dial, and nothing here
     writes to storage. */
  function completedSets(subtest, level) {
    const byAttempt = new Map();
    for (const row of stores().log) {
      if (!row || row.section !== 'pat' || row.subtest !== subtest || row.level !== level) continue;
      const at = byAttempt.get(row.attemptId) || { n: 0, correct: 0, ms: 0, ts: 0 };
      at.n++;
      if (row.correct) at.correct++;
      at.ms += Number(row.ms) || 0;
      at.ts = Math.max(at.ts, Number(row.ts) || 0);
      byAttempt.set(row.attemptId, at);
    }
    return [...byAttempt.values()].filter(a => a.n >= SET_SIZE).sort((a, b) => b.ts - a.ts);
  }
  function readyToRaise(subtest, level) {
    if (level >= 3) return false;
    const recent = completedSets(subtest, level).slice(0, 2);
    if (recent.length < 2) return false;
    const budget = paceFor(subtest) * 1000;
    return recent.every(set => set.correct >= RAISE_SCORE && set.ms <= budget * set.n);
  }
  function params() {
    const p = new URLSearchParams(location.search);
    const n = parseInt(p.get('n'), 10);
    return {
      subtest: p.get('subtest') || '',
      // Core is absent on the did-not-load path, which renderPicker() renders through params().
      level: Core ? Core.levelOf(p.get('level')) : DEFAULT_LEVEL,
      set: p.get('set') || '',
      n: Number.isFinite(n) && n > 0 ? Math.min(n, 90) : SET_SIZE,
    };
  }

  /* ---------- run state ---------- */
  // run = { subtest, level, ids, items, idx, results, attemptId, startedAt, itemStart, itemMs,
  //         paceSeconds, done }. items[] are regenerated records and never persisted.
  let run = null,
    ticker = null,
    lastRun = null,
    lastNotice = '';

  function hydrate(ids) {
    return ids.map(id => Core.fromId(id)).filter(Boolean);
  }
  function makeRun(fields) {
    return Object.assign(
      {
        form: false,
        subtest: '',
        level: DEFAULT_LEVEL,
        ids: [],
        items: [],
        idx: 0,
        results: [],
        attemptId: attemptId(),
        startedAt: now(),
        itemStart: null,
        itemMs: 0,
        formMs: FORM_SECONDS,
        formUsed: 0,
        formStart: null,
        paceSeconds: 40,
        done: false,
      },
      fields
    );
  }
  function startRun(subtest, level, n) {
    const seedBase = 1 + (now() % 900000);
    const items = Core.set(subtest, seedBase, level, n);
    if (!items.length) return false;
    run = makeRun({
      subtest,
      level,
      ids: items.map(i => i.id),
      items,
      results: new Array(items.length).fill(null),
      paceSeconds: paceFor(subtest),
    });
    return true;
  }
  /* The mixed form: fifteen of every subtest in the order the exam asks them, under one clock.
     formItems() owns the order, so the page never hard-codes a subtest list of its own. */
  function startForm(level) {
    const seedBase = 1 + (now() % 900000);
    const items = Core.formItems({ seedBase, level, per: FORM_PER });
    if (items.length < FORM_PER) return false;
    run = makeRun({
      form: true,
      subtest: 'full',
      level,
      ids: items.map(i => i.id),
      items,
      results: new Array(items.length).fill(null),
      paceSeconds: paceFor(items[0].subtest),
    });
    return true;
  }
  function resumeRun(blob) {
    const items = hydrate(blob.ids);
    if (items.length !== blob.ids.length) return false;
    const idx = Math.min(Math.max(0, blob.idx | 0), items.length - 1);
    const remain = Number(blob._remain) || 0;
    run = makeRun({
      form: !!blob.form,
      subtest: blob.subtest,
      level: blob.level,
      ids: blob.ids.slice(),
      items,
      idx,
      results: items.map((_, i) => (blob.results && blob.results[i]) || null),
      attemptId: blob.attemptId || attemptId(),
      startedAt: blob.startedAt || now(),
      itemMs: blob.form ? 0 : Math.max(0, paceFor(blob.subtest) * 1000 - remain),
      formUsed: blob.form ? Math.max(0, FORM_SECONDS * 1000 - remain) : 0,
      paceSeconds: paceFor(blob.form ? items[idx].subtest : blob.subtest),
    });
    return true;
  }
  function elapsed() {
    if (!run) return 0;
    return (run.itemMs || 0) + (run.itemStart ? now() - run.itemStart : 0);
  }
  function formElapsed() {
    if (!run) return 0;
    return (run.formUsed || 0) + (run.formStart ? now() - run.formStart : 0);
  }
  function formRemain() {
    return Math.max(0, run.formMs * 1000 - formElapsed());
  }
  function clockText(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
  }

  /* ---------- clock ---------- */
  function stopTicker() {
    if (ticker) clearInterval(ticker);
    ticker = null;
  }
  function tick() {
    if (!run) return stopTicker();
    const node = document.querySelector('#dat-pat-clock');
    if (!node) return stopTicker();
    // A single set is paced item by item; the mixed form runs the whole thing against one
    // sixty-minute section clock, the way the exam does, and finishes itself when it runs out.
    const ms = run.form ? formElapsed() : elapsed(),
      target = (run.form ? run.formMs : run.paceSeconds) * 1000;
    const fill = node.querySelector('.dat-pat-pace-fill'),
      label = node.querySelector('.dat-pat-pace-label');
    if (fill) fill.style.width = Math.min(100, (ms / target) * 100).toFixed(1) + '%';
    if (label)
      label.textContent = run.form
        ? clockText(formRemain()) + ' left of ' + Math.round(run.formMs / 60) + ' min'
        : Math.floor(ms / 1000) + ' s / ' + run.paceSeconds + ' s';
    node.classList.toggle('dat-pat-over', run.form ? formRemain() <= 60000 : ms > target);
    node.setAttribute('aria-valuenow', String(Math.min(100, Math.round((ms / target) * 100))));
    if (run.form && formRemain() <= 0) return finish('Time is up. The form stopped where you were.');
  }
  function startTicker() {
    stopTicker();
    if (!run || run.done) return;
    if (!run.results[run.idx] && !run.itemStart) run.itemStart = now();
    if (run.form && !run.formStart) run.formStart = now();
    tick();
    ticker = setInterval(tick, TICK_MS);
  }
  // Registered in DAT.pausers: stops the pace bar, freezes the item timer and hands the shell a
  // resume hook so study-storage-recovered can restart it while this view is still on screen.
  function pause() {
    stopTicker();
    if (!run) return undefined;
    if (run.itemStart) {
      run.itemMs = elapsed();
      run.itemStart = null;
    }
    if (run.formStart) {
      run.formUsed = formElapsed();
      run.formStart = null;
    }
    return {
      selector: '#dat-pat-clock',
      resume() {
        if (run && !run.done) startTicker();
      },
    };
  }

  /* ---------- shared chrome ---------- */
  function page(main) {
    datView(main);
  }
  function backLink(label) {
    return '<a class="btn" data-dat-go href="' + esc(datUrl()) + '">' + esc(label || 'Back to DAT') + '</a>';
  }
  function pickerLink(label) {
    return (
      '<a class="btn" data-dat-go href="' + esc(datUrl({ view: 'pat' })) + '">' + esc(label || 'All subtests') + '</a>'
    );
  }
  function dataless() {
    const main = el(
      '<main class="panel dat-pat dat-pat-picker"><h1>Perceptual Ability</h1><p class="sub">The content outline has not loaded, so the subtest rules are unavailable.</p><div class="endbtns">' +
        backLink() +
        '</div></main>'
    );
    datDataNotice(main);
    return page(main);
  }

  /* ---------- picker ---------- */
  function renderPicker(notice) {
    stopTicker();
    run = null;
    const p = params();
    const saved = loadResume();
    const cards = subtests()
      .map(s => {
        const built = Core && Core.isBuilt(s.id);
        const rules = rulesFor(s.id);
        const href = datUrl({ view: 'pat', subtest: s.id, level: p.level });
        return (
          '<article class="dat-pat-card' +
          (built ? '' : ' dat-pat-card-soon') +
          '" data-dat-subtest="' +
          esc(s.id) +
          '">' +
          '<div class="dat-pat-card-top"><span>' +
          esc(s.adaName) +
          '</span><span>' +
          s.questions +
          ' items · ' +
          s.seconds +
          ' s</span></div>' +
          '<h3>' +
          (built ? '<a data-dat-go href="' + esc(href) + '">' + esc(s.alias) + '</a>' : esc(s.alias)) +
          '</h3>' +
          '<p>' +
          esc(rules?.summary || 'Generated sets for this subtest arrive in a later PAT wave.') +
          '</p>' +
          '<div class="dat-pat-card-bottom">' +
          (built
            ? '<a class="btn btn-solid" data-dat-go href="' + esc(href) + '">Start 15 items</a>'
            : '<span class="hint">Not generated yet</span>') +
          (built && readyToRaise(s.id, p.level)
            ? '<a class="hint dat-pat-raise" data-dat-go href="' +
              esc(datUrl({ view: 'pat', subtest: s.id, level: p.level + 1 })) +
              '">Two sets at ' +
              RAISE_SCORE +
              '/15 or better inside the clock — try level ' +
              (p.level + 1) +
              '</a>'
            : '') +
          '</div></article>'
        );
      })
      .join('');
    const dial = [1, 2, 3]
      .map(
        lvl =>
          '<a class="mode dat-pat-level' +
          (lvl === p.level ? ' active' : '') +
          '" data-dat-go data-dat-level="' +
          lvl +
          '" href="' +
          esc(datUrl({ view: 'pat', level: lvl })) +
          '">' +
          esc(lvl + '. ' + levelLabel(lvl)) +
          '</a>'
      )
      .join('');
    const main = el(
      '<main class="panel dat-pat dat-pat-picker">' +
        '<h1>Perceptual Ability</h1>' +
        '<p class="sub">Ninety items in sixty minutes across six subtests. Every figure below is generated here from a seed, so no set repeats and each one can be rebuilt exactly for review.</p>' +
        (notice ? '<aside class="course-notice" role="status"><p>' + esc(notice) + '</p></aside>' : '') +
        (saved
          ? '<aside class="course-notice" role="status"><p>You have an unfinished ' +
            esc(saved.form ? 'ninety-item form' : subtestInfo(saved.subtest)?.alias || saved.subtest) +
            (saved.form ? '.' : ' set.') +
            '</p><a class="btn" data-dat-go href="' +
            esc(
              saved.form
                ? datUrl({ view: 'pat', set: 'full', level: saved.level })
                : datUrl({ view: 'pat', subtest: saved.subtest, level: saved.level })
            ) +
            '">Resume it</a> <button class="btn" id="dat-pat-discard" type="button">Discard it</button></aside>'
          : '') +
        '<section class="dat-pat-dial"><span class="label">Difficulty</span><div class="modes">' +
        dial +
        '</div><p class="hint">' +
        esc(
          levelLabel(p.level) +
            '. ' +
            (levelNote(p.subtest || 'angles', p.level) ||
              'Level 2 matches the difficulty range test-takers describe; level 3 is deliberately harder than the test.')
        ) +
        '</p></section>' +
        '<section class="dat-pat-grid-cards">' +
        cards +
        '</section>' +
        '<section class="dat-pat-form-card"><h2>The whole section at once</h2><p>Fifteen items of every subtest, in the order the exam asks them, under one sixty-minute clock. No feedback until the end, then a result for each subtest.</p><a class="btn btn-solid" data-dat-go href="' +
        esc(datUrl({ view: 'pat', set: 'full', level: p.level })) +
        '">Start the 90-item form</a></section>' +
        '<div class="endbtns">' +
        backLink() +
        '</div></main>'
    );
    const discard = main.querySelector('#dat-pat-discard');
    if (discard)
      discard.onclick = () => {
        clearResume();
        renderPicker('Saved set discarded.');
      };
    datDataNotice(main);
    return page(main);
  }

  /* ---------- runner ---------- */
  function optionButtons(item) {
    const keys = letters(item.options.length);
    const rendered = Core.render(item);
    return rendered.options
      .map(
        (opt, i) =>
          '<button class="opt dat-pat-opt' +
          (rendered.optionKind === 'svg' ? ' dat-pat-opt-svg' : '') +
          '" id="dat-pat-opt-' +
          i +
          '" data-dat-pos="' +
          i +
          '" type="button"><span class="key">' +
          esc(keys[i]) +
          '</span><span class="dat-pat-opt-body">' +
          (rendered.optionKind === 'svg' ? opt : esc(opt)) +
          '</span></button>'
      )
      .join('');
  }
  function renderRun() {
    const item = run.items[run.idx];
    const rendered = Core.render(item);
    const info = subtestInfo(run.form ? item.subtest : run.subtest);
    const answered = run.results[run.idx];
    const last = run.idx === run.items.length - 1;
    // One name per subtest across a sitting: the alias the results table, the review heading and
    // the picker's card title already use. The ADA name is taught on the picker card, which pairs
    // the two, so a learner never has to map "Apertures" onto a "Keyholes" row after the fact.
    const eyebrow = run.form
      ? (info?.alias || item.subtest) + ' · mixed form · ' + levelLabel(run.level)
      : (info?.alias || run.subtest) + ' · ' + levelLabel(run.level);
    const clockLabel = run.form ? 'Time left in the sixty-minute form' : 'Time on this item against the pace target';
    const main = el(
      '<main class="panel dat-pat dat-pat-run">' +
        '<div class="dat-pat-head">' +
        '<span class="dat-pat-eyebrow">' +
        esc(eyebrow) +
        '</span>' +
        '<span class="dat-pat-count">Item ' +
        (run.idx + 1) +
        ' of ' +
        run.items.length +
        '</span>' +
        '<div class="dat-pat-pace" id="dat-pat-clock" role="progressbar" aria-label="' +
        esc(clockLabel) +
        '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="dat-pat-pace-track"><div class="dat-pat-pace-fill"></div></div><span class="dat-pat-pace-label">' +
        esc(run.form ? clockText(formRemain()) + ' left of 60 min' : '0 s / ' + run.paceSeconds + ' s') +
        '</span></div>' +
        '</div>' +
        '<p class="dat-pat-stem">' +
        esc(item.stem) +
        '</p>' +
        '<div class="dat-pat-figure">' +
        rendered.figure +
        '</div>' +
        '<div class="dat-conf-row"><span class="label">Confidence</span><div class="modes" id="dat-pat-conf">' +
        Object.entries(CONF)
          .map(
            ([k, label]) =>
              '<button class="mode dat-pat-conf' +
              (k === 'unsure' ? ' active' : '') +
              '" data-dat-conf="' +
              k +
              '" type="button">' +
              esc(label) +
              '</button>'
          )
          .join('') +
        '</div></div>' +
        '<div class="opts dat-pat-opts' +
        (rendered.optionKind === 'svg' ? ' dat-pat-opts-svg' : '') +
        '" id="dat-pat-opts">' +
        optionButtons(item) +
        '</div>' +
        '<div class="dat-pat-after" id="dat-pat-after"></div>' +
        '<p class="hint" id="dat-pat-save-status"></p>' +
        '<div class="endbtns">' +
        pickerLink(run.form ? 'Leave this form' : 'Leave this set') +
        '</div>' +
        '</main>'
    );
    let conf = (answered && answered.conf) || 'unsure';
    main.querySelectorAll('#dat-pat-conf .mode').forEach(button => {
      button.onclick = () => {
        conf = button.getAttribute('data-dat-conf');
        main
          .querySelectorAll('#dat-pat-conf .mode')
          .forEach(other => other.classList.toggle('active', other === button));
      };
      if (answered) button.disabled = true;
    });
    main.querySelectorAll('.dat-pat-opt').forEach(button => {
      button.onclick = () => answer(Number(button.getAttribute('data-dat-pos')), conf);
      if (answered) button.disabled = true;
    });
    if (answered) showFeedback(main, item, answered, last);
    page(main);
    if (!answered) startTicker();
    return main;
  }
  function showFeedback(root, item, result, last) {
    root.querySelectorAll('.dat-pat-opt').forEach((button, i) => {
      button.disabled = true;
      // .correct / .wrong are the shared option states in styles.css:269-272.
      if (i === item.answer) button.classList.add('correct');
      else if (i === result.picked) button.classList.add('wrong');
      else button.classList.add('dimmed');
    });
    const after = root.querySelector('#dat-pat-after');
    if (!after) return;
    after.innerHTML =
      '<div class="continue-row"><span class="hint">' +
      (result.correct ? 'Correct' : 'Not this one') +
      ' &middot; ' +
      Math.round((result.ms || 0) / 1000) +
      ' s of ' +
      run.paceSeconds +
      ' s</span><button class="btn btn-solid" id="dat-pat-next" data-next type="button">' +
      (last ? 'Results' : 'Next') +
      '</button></div>' +
      '<p class="dat-pat-explanation">' +
      esc(item.explanation) +
      '</p>';
    const next = after.querySelector('#dat-pat-next');
    if (next) next.onclick = () => advance();
  }
  function answer(picked, conf) {
    if (!run || run.results[run.idx]) return;
    const item = run.items[run.idx];
    const ms = elapsed();
    stopTicker();
    run.itemStart = null;
    const result = { picked, correct: picked === item.answer, ms, conf };
    run.results[run.idx] = result;
    logAttempt({
      id: item.id,
      category: item.category,
      subtest: item.subtest,
      seed: item.seed,
      level: item.level,
      correct: result.correct,
      conf,
      ms,
      attemptId: run.attemptId,
    });
    if (!result.correct) enrol(item);
    saveResume();
    // A single set answers and explains item by item. The form does not: it is a ninety-item
    // sitting against one clock, so it moves straight on and everything is reviewed at the end.
    if (run.form) return advance();
    renderRun();
  }
  function advance() {
    if (!run) return;
    if (run.idx < run.items.length - 1) {
      run.idx++;
      run.itemMs = 0;
      run.itemStart = null;
      if (run.form) run.paceSeconds = paceFor(run.items[run.idx].subtest);
      saveResume();
      return renderRun();
    }
    return finish();
  }
  function finish(notice) {
    if (!run) return undefined;
    run.done = true;
    stopTicker();
    if (run.formStart) {
      run.formUsed = formElapsed();
      run.formStart = null;
    }
    clearResume();
    lastRun = run;
    lastNotice = notice || '';
    return renderReview();
  }

  /* ---------- review ---------- */
  function reviewCard(item, result, index) {
    const rendered = Core.render(item);
    const keys = letters(item.options.length);
    const steps = Core.explain(item)
      .map(
        step =>
          '<li><strong>' +
          esc(step.title) +
          '</strong><p>' +
          esc(step.text) +
          '</p>' +
          (step.svg ? '<div class="dat-pat-figure dat-pat-figure-step">' + step.svg + '</div>' : '') +
          '</li>'
      )
      .join('');
    const picked = result && Number.isInteger(result.picked) ? keys[result.picked] : '—';
    return (
      '<article class="dat-pat-review-card' +
      (result && result.correct ? ' is-correct' : ' is-wrong') +
      '" data-dat-item="' +
      esc(item.id) +
      '">' +
      '<header><span class="dat-pat-count">Item ' +
      (index + 1) +
      '</span><span class="hint">' +
      (result && result.correct ? 'Correct' : 'Missed') +
      ' · your answer ' +
      esc(picked) +
      ' · key ' +
      esc(keys[item.answer]) +
      ' · ' +
      Math.round(((result && result.ms) || 0) / 1000) +
      ' s</span></header>' +
      '<p class="dat-pat-stem">' +
      esc(item.stem) +
      '</p>' +
      '<div class="dat-pat-figure">' +
      rendered.figure +
      '</div>' +
      '<details class="dat-pat-steps"><summary>How the figure works</summary><ol>' +
      steps +
      '</ol></details>' +
      '<div class="dat-pat-review-actions"><button class="btn" data-dat-enrol="' +
      esc(item.id) +
      '" type="button">' +
      (enrolled(item.id) ? 'In your mistake log' : 'Add to mistake log') +
      '</button><span class="hint dat-pat-seed">seed ' +
      item.seed +
      ' · level ' +
      item.level +
      '</span></div>' +
      '</article>'
    );
  }
  /* Per-subtest results for the mixed form. The raw count is always shown. A scaled 200-600
     estimate is shown only when the score layer (DAT-08) has actually been loaded into the page:
     no conversion is invented here, and with the layer absent the learner sees exactly what was
     measured and nothing dressed up as a prediction. */
  function formRows(finished) {
    return subtests()
      .map(info => {
        const seats = finished.items.map((item, i) => (item.subtest === info.id ? i : -1)).filter(i => i >= 0);
        const results = seats.map(i => finished.results[i]).filter(Boolean);
        if (!seats.length) return null;
        const correct = results.filter(r => r.correct).length;
        const ms = results.reduce((sum, r) => sum + (r.ms || 0), 0);
        return {
          info,
          asked: seats.length,
          answered: results.length,
          correct,
          perItem: results.length ? Math.round(ms / results.length / 100) / 10 : 0,
        };
      })
      .filter(Boolean);
  }
  function estimateLine(correct, total) {
    const Score = window.DatScoreCore;
    if (!Score || typeof Score.estimate !== 'function') return '';
    let est;
    try {
      est = Score.estimate('pat', correct, total);
    } catch (err) {
      return '';
    }
    if (!est || !Number.isFinite(Number(est.scaled))) return '';
    const band = Array.isArray(est.band) ? ' (band ' + est.band[0] + '–' + est.band[1] + ')' : '';
    const pct = Number.isFinite(Number(est.percentile)) ? ' · about the ' + est.percentile + 'th percentile' : '';
    const old = Number.isFinite(Number(est.old)) ? ' · ≈ ' + est.old + ' on the pre-2025 scale' : '';
    return (
      '<p class="dat-pat-estimate">PAT ' +
      correct +
      '/' +
      total +
      ' · est. ' +
      est.scaled +
      band +
      pct +
      old +
      '</p><p class="hint">' +
      esc(
        typeof Score.DISCLAIMER === 'string'
          ? Score.DISCLAIMER
          : 'An estimate from practice items, not a predicted score.'
      ) +
      '</p>'
    );
  }
  function formPanel(finished, correct) {
    const rows = formRows(finished);
    return (
      '<section class="dat-pat-form-results"><h2>By subtest</h2><table class="dat-pat-form-table"><thead><tr><th scope="col">Subtest</th><th scope="col">Correct</th><th scope="col">Seconds per item</th><th scope="col">Target</th></tr></thead><tbody>' +
      rows
        .map(
          row =>
            '<tr><th scope="row">' +
            esc(row.info.alias) +
            '</th><td>' +
            row.correct +
            ' of ' +
            row.asked +
            (row.answered < row.asked
              ? ' <span class="hint">(' + (row.asked - row.answered) + ' unanswered)</span>'
              : '') +
            '</td><td>' +
            row.perItem +
            ' s</td><td>' +
            row.info.seconds +
            ' s</td></tr>'
        )
        .join('') +
      '</tbody></table>' +
      (estimateLine(correct, finished.items.length) ||
        '<p class="hint">Scaled 200–600 estimates arrive with the score layer. Until then this page reports the raw count per subtest and nothing else, because there is no published raw-to-scaled table to convert it with.</p>') +
      '</section>'
    );
  }
  function renderReview() {
    stopTicker();
    const finished = run && run.done ? run : lastRun;
    if (!finished) return renderPicker('That set has already been closed.');
    const answered = finished.results.filter(Boolean);
    const correct = answered.filter(r => r.correct).length;
    const totalMs = answered.reduce((s, r) => s + (r.ms || 0), 0);
    const perItem = answered.length ? Math.round(totalMs / answered.length / 100) / 10 : 0;
    const info = subtestInfo(finished.subtest);
    const rules = rulesFor(finished.subtest);
    const notice = lastNotice;
    lastNotice = '';
    const main = el(
      '<main class="panel dat-pat dat-pat-review">' +
        '<h1>' +
        esc(finished.form ? 'Mixed form · results' : (info?.alias || finished.subtest) + ' · results') +
        '</h1>' +
        '<p class="sub">' +
        correct +
        ' of ' +
        finished.items.length +
        ' correct · ' +
        (finished.form
          ? clockText(finished.formUsed) + ' of the 60-minute clock used'
          : perItem + ' s per item against a ' + finished.paceSeconds + ' s target') +
        ' · ' +
        esc(levelLabel(finished.level)) +
        '</p>' +
        (notice ? '<aside class="course-notice" role="status"><p>' + esc(notice) + '</p></aside>' : '') +
        (finished.form ? formPanel(finished, correct) : '') +
        (rules && rules.pitfalls
          ? '<section class="dat-pat-pitfalls"><h2>What usually goes wrong here</h2><ul>' +
            rules.pitfalls.map(p => '<li>' + esc(p) + '</li>').join('') +
            '</ul></section>'
          : '') +
        '<section class="dat-pat-review-list">' +
        finished.items.map((item, i) => reviewCard(item, finished.results[i], i)).join('') +
        '</section>' +
        '<p class="hint" id="dat-pat-save-status"></p>' +
        '<div class="endbtns"><a class="btn btn-solid" data-dat-go href="' +
        esc(
          finished.form
            ? datUrl({ view: 'pat', set: 'full', level: finished.level })
            : datUrl({ view: 'pat', subtest: finished.subtest, level: finished.level })
        ) +
        '">' +
        (finished.form ? 'Another form' : 'Another set') +
        '</a>' +
        pickerLink() +
        backLink() +
        '</div></main>'
    );
    main.querySelectorAll('[data-dat-enrol]').forEach(button => {
      button.onclick = () => {
        const item = finished.items.find(i => i.id === button.getAttribute('data-dat-enrol'));
        if (!item) return;
        enrol(item);
        button.textContent = 'In your mistake log';
        button.disabled = true;
      };
    });
    return page(main);
  }

  /* ---------- entry ---------- */
  function render() {
    if (!Core) return renderPicker('The perceptual-ability generators did not load.');
    if (!outline()) return dataless();
    const p = params();
    if (p.set === 'full') return renderForm(p);
    if (!p.subtest) return renderPicker();
    if (!Core.isBuilt(p.subtest)) return renderPicker('That subtest is not generated yet.');
    // A finished run is one-shot: the review page is reached through advance(), which renders it
    // from lastRun, so a fresh request for this URL is the "Another set" button asking for a new
    // set rather than the finished one again.
    if (run && run.subtest === p.subtest && run.level === p.level) {
      if (!run.done) return renderRun();
      run = null;
    }
    const saved = loadResume();
    if (saved && saved.subtest === p.subtest && saved.level === p.level && resumeRun(saved)) return renderRun();
    if (!startRun(p.subtest, p.level, p.n)) return renderPicker('No items could be generated for that subtest.');
    saveResume();
    return renderRun();
  }
  function renderForm(p) {
    if (run && run.form && run.level === p.level) {
      if (!run.done) return renderRun();
      run = null;
    }
    const saved = loadResume();
    if (saved && saved.form && saved.level === p.level && resumeRun(saved)) return renderRun();
    if (!startForm(p.level)) return renderPicker('The mixed form could not be built.');
    saveResume();
    return renderRun();
  }

  // Letters and digits answer the visible item. Scoped to .dat-pat-run and #dat-pat-opt-* so the
  // mcat.js handler (gated on #conf/#opts) and the dat-practice.js handler (gated on .dat-drill)
  // never see a second target; Enter is left to app.js, which clicks [data-next].
  document.addEventListener('keydown', event => {
    const root = document.querySelector('.dat-pat-run');
    if (!root) return;
    if (event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const count = root.querySelectorAll('.dat-pat-opt').length;
    if (!count) return;
    const keys = letters(count);
    let pos = -1;
    if (/^[0-9]$/.test(event.key)) pos = Number(event.key) - 1;
    else if (event.key.length === 1) pos = keys.indexOf(event.key.toUpperCase());
    if (pos < 0 || pos >= count) return;
    const option = root.querySelector('#dat-pat-opt-' + pos);
    if (option && !option.disabled) {
      event.preventDefault();
      option.click();
    }
  });

  // resetDatState calls this after it has forgotten the loaded data and cleared the resume blobs:
  // the cached stores and the in-flight set have to go too, or the first answer after a reset
  // writes the previous workspace's whole log back over the cleared keys.
  function reset() {
    stopTicker();
    run = null;
    lastRun = null;
    lastNotice = '';
    DAT.attemptStores = null;
  }

  DAT.pausers.push(pause);
  window.DatPat = { render, pause, reset };
})();
