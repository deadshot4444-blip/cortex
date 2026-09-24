/* DAT Reading Comprehension (DAT-11): three-passage sets on a split screen — questions above,
   the numbered passage below on phones, side by side on desktop — under a 20-minute passage
   clock and a 60-minute set clock, with mark-and-review navigation, drag-to-highlight, the
   answer-key-free blind review forked from mcat-workflows.js:605-757, and a review page by
   reading skill with the evidence paragraph highlighted.

   Storage rule, non-negotiable (DESIGN §9 risk 5): study-backup.js refuses any value that
   contains markup, so nothing this module writes to cs-dat-r-rc or cs-dat-passage-reviews may
   carry HTML. Highlights are stored as { par, start, end } character offsets and the passage
   text is never copied into a saved record: ids go in, the text is read back from DAT.rc on
   render. Names are #dat-rc-*, .dat-rc-*, data-dat-* only; option letters come from LETTERS
   (app.js) over options.length, never a literal count. */
(function () {
  'use strict';
  const Core = window.DatDrillCore;
  const LOG_KEY = 'cs-dat-log',
    HIST_KEY = 'cs-dat-q',
    SRS_KEY = 'cs-dat-srs',
    RESUME_KEY = 'cs-dat-r-rc',
    REVIEW_KEY = 'cs-dat-passage-reviews',
    LOG_CAP = 2000,
    REPORT_CAP = 20,
    TICK_MS = 500;
  const CONF = { guess: 'Guess', unsure: 'Unsure', sure: 'Sure' };

  /* ---------- storage ---------- */
  // cs-dat-log, cs-dat-q and cs-dat-srs are written by this module AND by dat-practice.js and
  // dat-pat.js, which the shell loads into the same document. One cache serves all three, hung
  // on the DAT runtime object and built by whichever module reads first: a second private cache
  // would write a whole-array replacement and silently drop the rows the others added since it
  // read. resetDatState drops it through the reset() hooks at the foot of each module.
  function stores() {
    if (!DAT.attemptStores) {
      const log = StudyStorage.read(LOG_KEY, []),
        hist = StudyStorage.read(HIST_KEY, {}),
        srs = StudyStorage.read(SRS_KEY, {});
      const valid = {
        log: Core.validAttemptStore(log, 'log'),
        hist: Core.validAttemptStore(hist, 'hist'),
        srs: Core.validAttemptStore(srs, 'srs'),
      };
      // Keep the saved copy for recovery; never overwrite an invalid store with empty progress.
      if (!Object.values(valid).every(Boolean))
        StudyStorage.sessionFailed(
          Object.keys(valid)
            .filter(key => !valid[key])
            .map(key => ({ log: LOG_KEY, hist: HIST_KEY, srs: SRS_KEY })[key])
        );
      DAT.attemptStores = {
        log: valid.log ? log : [],
        hist: valid.hist ? hist : {},
        srs: valid.srs ? srs : {},
      };
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
    return 'dat-rc-' + now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function saveStatus(ok) {
    const node = document.querySelector('#dat-rc-save-status');
    if (!node) return;
    node.textContent = ok
      ? ''
      : 'Saving is paused. Your answers stay in this tab until the browser copy can be written again.';
  }

  /* ---------- data ---------- */
  function passages() {
    return Array.isArray(DAT.rc?.passages) ? DAT.rc.passages : [];
  }
  function sets() {
    return Array.isArray(DAT.rc?.sets) ? DAT.rc.sets : [];
  }
  function passageById(id) {
    return passages().find(p => p.id === id) || null;
  }
  function questionsOf(p) {
    return Array.isArray(p?.questions) ? p.questions : [];
  }
  function paragraphsOf(p) {
    return String(p?.text || '')
      .split(/\n\n+/)
      .map(par => par.trim())
      .filter(Boolean);
  }
  function outline() {
    return DAT.outline;
  }
  function skillTitle(id) {
    return outline()?.readingSkills?.find(s => s.id === id)?.title || id;
  }
  // The QLOG category is an outline category id: readingSkills rc-1..rc-3 mirror RC-1..RC-3.
  function categoryOf(q) {
    const n = String(q?.skill || '').split('-')[1];
    return n ? 'RC-' + n : 'RC';
  }
  function paceSeconds() {
    return Core.pace(outline(), 'rc');
  }
  // 60 minutes over three passages = 20 minutes each; both numbers come from the outline.
  function passageSeconds() {
    const rc = outline()?.sections?.rc,
      minutes = Number(rc?.minutes),
      count = Number(rc?.passages);
    return Number.isFinite(minutes) && Number.isFinite(count) && count > 0 ? (minutes * 60) / count : 20 * 60;
  }
  function params() {
    const p = new URLSearchParams(location.search);
    return { set: p.get('set') || '', passage: p.get('passage') || '' };
  }
  function fmtClock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  function pct(x) {
    return Math.round(x * 100) + '%';
  }
  // Display permutation for one question: authored displayOrder when the data carries a valid
  // one, otherwise the engine's seeded shuffle keyed on the question id, so a reload deals the
  // same order without the resume blob having to carry it.
  function orderFor(q) {
    const n = q?.options?.length || 0;
    if (Array.isArray(q?.displayOrder) && q.displayOrder.length === n) {
      const sorted = [...q.displayOrder].sort((a, b) => a - b);
      if (sorted.every((v, i) => v === i)) return q.displayOrder.slice();
    }
    return Core.orderOptions({ options: q?.options || [], id: q?.id }, q?.id);
  }

  /* ---------- highlight ranges (character offsets, never markup) ---------- */
  function normalizeRanges(list) {
    const out = [];
    for (const r of [...(list || [])].sort((a, b) => a.start - b.start)) {
      const last = out[out.length - 1];
      if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
      else out.push({ start: r.start, end: r.end });
    }
    return out;
  }
  function rangeHtml(text, ranges) {
    let html = '',
      cursor = 0;
    for (const r of normalizeRanges(ranges)) {
      const start = Math.max(cursor, Math.min(r.start, text.length)),
        end = Math.max(start, Math.min(r.end, text.length));
      if (end <= start) continue;
      html += `${esc(text.slice(cursor, start))}<mark class="dat-rc-mark" data-dat-at="${start}">${esc(text.slice(start, end))}</mark>`;
      cursor = end;
    }
    return html + esc(text.slice(cursor));
  }
  function parRanges(passageId, par) {
    return (run?.highlights?.[passageId] || []).filter(r => r.par === par);
  }
  function setParRanges(passageId, par, ranges) {
    const kept = (run.highlights[passageId] || []).filter(r => r.par !== par);
    run.highlights[passageId] = kept.concat(ranges.map(r => ({ par, start: r.start, end: r.end })));
    if (!run.highlights[passageId].length) delete run.highlights[passageId];
  }
  // Character offset of (node, offset) inside root's text, so a DOM selection becomes two numbers.
  function offsetIn(root, node, offset) {
    let total = 0,
      done = false;
    const walk = current => {
      if (done) return;
      if (current === node) {
        if (current.nodeType === 3) total += offset;
        else for (let i = 0; i < offset && i < current.childNodes.length; i++) walk(current.childNodes[i]);
        done = true;
        return;
      }
      if (current.nodeType === 3) {
        total += current.data.length;
        return;
      }
      for (const child of current.childNodes) {
        walk(child);
        if (done) return;
      }
    };
    walk(root);
    return total;
  }

  /* ---------- run state ---------- */
  // run = { setId, ids: [passageId], qs: [{ p, q }], idx, answers, marks, conf, qMs, passageMs,
  //         highlights: { passageId: [{ par, start, end }] }, attemptId, startedAt, phase,
  //         deadline, _remain, tickStart, reviews, reviewOrder, reviewIdx, logged }
  // Everything the learner produced is keyed by question or passage id, never by position, so a
  // retired passage under a saved blob costs that passage and nothing else.
  let run = null,
    ticker = null;

  function buildQs(ids) {
    return ids.flatMap(id => questionsOf(passageById(id)).map(q => ({ p: id, q: q.id })));
  }
  function startRun(ids, setId) {
    stores();
    const live = ids.filter(passageById);
    if (!live.length) return false;
    const qs = buildQs(live);
    if (!qs.length) return false;
    run = {
      setId: setId || null,
      ids: live,
      qs,
      idx: 0,
      answers: {},
      marks: {},
      conf: {},
      qMs: {},
      passageMs: {},
      highlights: {},
      attemptId: attemptId(),
      startedAt: now(),
      phase: 'attempt',
      deadline: now() + live.length * passageSeconds() * 1000,
      tickStart: null,
      reviews: {},
      reviewOrder: null,
      reviewIdx: 0,
      logged: false,
    };
    return true;
  }
  function resumeRun(blob) {
    stores();
    const live = (blob.ids || []).filter(passageById);
    if (!live.length) {
      clearResume();
      return false;
    }
    const qs = buildQs(live);
    if (!qs.length) {
      clearResume();
      return false;
    }
    run = {
      setId: blob.setId || null,
      ids: live,
      qs,
      idx: Math.min(Math.max(0, blob.idx | 0), qs.length - 1),
      answers: blob.answers || {},
      marks: blob.marks || {},
      conf: blob.conf || {},
      qMs: blob.qMs || {},
      passageMs: blob.passageMs || {},
      highlights: blob.highlights || {},
      attemptId: blob.attemptId || attemptId(),
      startedAt: blob.startedAt || now(),
      phase: blob.phase === 'blind' ? 'blind' : 'attempt',
      deadline: now() + Math.max(0, Number(blob._remain) || 0),
      tickStart: null,
      reviews: blob.reviews || {},
      reviewOrder: Array.isArray(blob.reviewOrder) ? blob.reviewOrder.filter(id => qs.some(r => r.q === id)) : null,
      reviewIdx: Math.max(0, blob.reviewIdx | 0),
      logged: false,
    };
    return true;
  }
  function saveResume() {
    if (!run || run.phase === 'done') return false;
    const ok = StudyStorage.write(RESUME_KEY, {
      setId: run.setId,
      ids: run.ids.slice(),
      idx: run.idx,
      answers: run.answers,
      marks: run.marks,
      conf: run.conf,
      qMs: run.qMs,
      passageMs: run.passageMs,
      highlights: run.highlights,
      attemptId: run.attemptId,
      startedAt: run.startedAt,
      phase: run.phase,
      reviews: run.reviews,
      reviewOrder: run.reviewOrder,
      reviewIdx: run.reviewIdx,
      _remain: remainMs(),
      _saved: now(),
    });
    saveStatus(ok);
    return ok;
  }
  function loadResume() {
    const blob = StudyStorage.read(RESUME_KEY, null);
    if (blob === null) return null;
    const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
    const count = value => Number.isInteger(value) && value >= 0;
    const maps = ['answers', 'marks', 'conf', 'qMs', 'passageMs', 'highlights', 'reviews'];
    const valid =
      record(blob) &&
      Array.isArray(blob.ids) &&
      blob.ids.length > 0 &&
      blob.ids.every(id => typeof id === 'string') &&
      new Set(blob.ids).size === blob.ids.length &&
      maps.every(key => record(blob[key])) &&
      count(blob.idx) &&
      count(blob.reviewIdx) &&
      ['attempt', 'blind'].includes(blob.phase) &&
      Number.isFinite(blob._remain) &&
      blob._remain >= 0 &&
      typeof blob.attemptId === 'string' &&
      blob.attemptId &&
      Number.isFinite(blob.startedAt) &&
      (blob.reviewOrder === null ||
        (Array.isArray(blob.reviewOrder) && blob.reviewOrder.every(id => typeof id === 'string'))) &&
      Object.values(blob.answers).every(value => value === null || count(value)) &&
      ['qMs', 'passageMs'].every(key =>
        Object.values(blob[key]).every(value => Number.isFinite(value) && value >= 0)
      ) &&
      Object.values(blob.highlights).every(
        list =>
          Array.isArray(list) &&
          list.every(r => record(r) && count(r.par) && count(r.start) && count(r.end) && r.end >= r.start)
      ) &&
      Object.values(blob.reviews).every(
        r =>
          record(r) &&
          (r.chosen === null || count(r.chosen)) &&
          Array.isArray(r.evidence) &&
          r.evidence.every(count) &&
          typeof r.rationale === 'string'
      );
    if (!valid) {
      StudyStorage.sessionFailed([RESUME_KEY]);
      return null;
    }
    return blob;
  }
  function clearResume() {
    return StudyStorage.remove(RESUME_KEY);
  }

  /* ---------- clocks ---------- */
  // The one reading of the section clock. While a deadline is running it counts down from that;
  // once pause() has banked the balance and dropped the deadline, the banked value is the answer.
  // Every caller goes through here, so a stretch the learner spent paused is never subtracted twice.
  function remainMs() {
    if (!run) return 0;
    return run.deadline ? Math.max(0, run.deadline - now()) : Math.max(0, Number(run._remain) || 0);
  }
  // One running timestamp: leaving a question folds the time it took into both the per-question
  // total (reviewed against the 72-second target) and the passage total (the 20-minute clock).
  function markTime() {
    if (!run || !run.tickStart) return;
    const spent = now() - run.tickStart,
      ref = run.qs[run.idx];
    run.tickStart = null;
    if (!ref) return;
    run.qMs[ref.q] = (run.qMs[ref.q] || 0) + spent;
    run.passageMs[ref.p] = (run.passageMs[ref.p] || 0) + spent;
  }
  function passageElapsed(passageId) {
    const live = run.tickStart && run.qs[run.idx]?.p === passageId ? now() - run.tickStart : 0;
    return (run.passageMs[passageId] || 0) + live;
  }
  function stopTicker() {
    if (ticker) clearInterval(ticker);
    ticker = null;
  }
  function tick() {
    if (!run) return stopTicker();
    const node = document.querySelector('#dat-rc-clock');
    if (!node) return stopTicker();
    const remain = remainMs();
    node.textContent = fmtClock(remain);
    node.classList.toggle('dat-rc-over', remain <= 60000);
    const passageNode = document.querySelector('#dat-rc-passage-clock'),
      ref = run.qs[run.idx];
    if (passageNode && ref) {
      const left = passageSeconds() * 1000 - passageElapsed(ref.p);
      passageNode.textContent = fmtClock(left);
      passageNode.classList.toggle('dat-rc-over', left <= 0);
    }
    if (remain <= 0) {
      stopTicker();
      finishAttempt(true);
    }
  }
  // countTime is false on the review screen: the section clock keeps running there, but the
  // seconds do not belong to whichever question the learner happened to leave open.
  function startTicker(countTime = true) {
    stopTicker();
    if (!run || run.phase !== 'attempt') return;
    if (countTime && !run.tickStart) run.tickStart = now();
    tick();
    ticker = setInterval(tick, TICK_MS);
  }
  // Registered in DAT.pausers: stops both clocks, banks the time spent on the open question and
  // hands the shell a resume hook so study-storage-recovered restarts them while RC is on screen.
  function pause() {
    stopTicker();
    if (!run) return undefined;
    markTime();
    run._remain = remainMs();
    run.deadline = null;
    return {
      selector: '#dat-rc-clock',
      resume() {
        if (!run || run.phase !== 'attempt') return;
        run.deadline = now() + (Number(run._remain) || 0);
        delete run._remain;
        startTicker();
      },
    };
  }

  /* ---------- shared chrome ---------- */
  function page(main) {
    datView(main);
  }
  function backLink(label) {
    return `<a class="btn" data-dat-go href="${esc(datUrl())}">${esc(label || 'Back to DAT')}</a>`;
  }
  function pickerLink(label) {
    return `<a class="btn" data-dat-go href="${esc(datUrl({ view: 'rc' }))}">${esc(label || 'All passages')}</a>`;
  }
  // The runner's own chrome is not a .panel, so it is wired for data-dat-go links by hand, the
  // way dat-practice.js wires its drill root.
  function stage(root) {
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
  }
  function optionButtons(q, selected, prefix) {
    const order = orderFor(q),
      letters = Core.letters(order.length);
    return order
      .map(
        (authored, pos) =>
          `<button class="opt dat-rc-opt${selected === authored ? ' picked' : ''}" id="${prefix}-${pos}" type="button" data-dat-i="${authored}" aria-pressed="${selected === authored}"><span class="key">${esc(letters[pos] ?? pos + 1)}</span><span>${esc(q.options[authored])}</span></button>`
      )
      .join('');
  }
  function confRow(value, name) {
    return `<div class="dat-rc-conf-row"><span class="label">Confidence</span><div class="modes" id="${name}">${Object.entries(
      CONF
    )
      .map(
        ([key, label]) =>
          `<button class="mode dat-rc-conf${key === value ? ' active' : ''}" type="button" data-dat-conf="${key}">${label}</button>`
      )
      .join('')}</div></div>`;
  }
  function passageHtml(p, options = {}) {
    const items = paragraphsOf(p)
      .map((text, i) => {
        const par = i + 1,
          body = rangeHtml(text, parRanges(p.id, par));
        if (options.pick)
          return `<li class="dat-rc-par" data-dat-par="${par}"><button class="dat-rc-evidence${options.picked?.includes(par) ? ' selected' : ''}" type="button" data-dat-par="${par}" aria-pressed="${!!options.picked?.includes(par)}">${body}</button></li>`;
        return `<li class="dat-rc-par" data-dat-par="${par}">${body}</li>`;
      })
      .join('');
    return `<section class="dat-rc-passage" id="dat-rc-passage" aria-labelledby="dat-rc-passage-title">
      <div class="dat-rc-passage-head"><span class="label" id="dat-rc-passage-title">${esc(p.title)}</span><span class="dat-rc-words">${esc(p.words || paragraphsOf(p).join(' ').split(/\s+/).length)} words · ${paragraphsOf(p).length} paragraphs</span></div>
      <p class="dat-rc-instruction">${esc(options.instruction || 'Drag across the text to highlight it. Click a highlight to remove it.')}</p>
      <ol class="dat-rc-text">${items}</ol>
    </section>`;
  }

  /* ---------- picker ---------- */
  function empty() {
    // The track's standard notice shape (dat.js datNotBuilt) with copy that is true of this
    // module: the runner shipped, the passages have not been written yet.
    const main = el(`<main class="panel dat-notice dat-rc-empty">
      <span class="label">DAT &middot; ${esc(CortexAcademy.status(datTrack()))}</span>
      <h1>The reading passages are not written yet.</h1>
      <p class="sub">Reading Comprehension sets open here as soon as the passages land. Nothing you saved has changed.</p>
      <div class="endbtns">${backLink()}</div>
    </main>`);
    datDataNotice(main);
    return page(main);
  }
  function savedReports() {
    const store = StudyStorage.read(REVIEW_KEY, {});
    if (!store || typeof store !== 'object' || Array.isArray(store)) return [];
    return Object.entries(store)
      .filter(([key]) => key.startsWith('rc:'))
      .map(([, report]) => report)
      .filter(report => report && typeof report === 'object')
      .sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));
  }
  function renderPicker(notice) {
    const saved = loadResume(),
      reports = savedReports();
    const setRows = sets()
      .map(s => {
        const list = (s.passages || []).map(passageById).filter(Boolean);
        const count = list.reduce((n, p) => n + questionsOf(p).length, 0);
        return `<article class="dat-rc-card"><div class="dat-rc-card-top"><span>${esc(s.id)}</span><span>${list.length} passages · ${count} questions</span></div>
          <h3><a data-dat-go href="${esc(datUrl({ view: 'rc', set: s.id }))}">${esc(s.title || s.id)}</a></h3>
          <p>${esc(list.map(p => p.title).join(' · '))}</p>
          <div class="dat-rc-card-bottom"><a class="btn btn-solid" data-dat-go href="${esc(datUrl({ view: 'rc', set: s.id }))}">Run the set</a><span class="hint">${Math.round((list.length * passageSeconds()) / 60)} minutes</span></div></article>`;
      })
      .join('');
    const passageRows = passages()
      .map(
        p =>
          `<tr><th scope="row"><a data-dat-go href="${esc(datUrl({ view: 'rc', passage: p.id }))}">${esc(p.title)}</a></th><td>${esc(p.domain || p.discipline || '')}</td><td>${questionsOf(p).length}</td><td>${esc(p.words || '—')}</td></tr>`
      )
      .join('');
    const main = el(`<main class="panel dat-rc-picker">
      <div class="hero"><span class="label">DAT &middot; Reading Comprehension</span><h1>Three passages, ${outline()?.sections?.rc?.questions || 50} questions, ${outline()?.sections?.rc?.minutes || 60} minutes.</h1>
      <p class="sub">Split screen: questions above, the numbered passage below (side by side on a wide screen). One ${Math.round(passageSeconds() / 60)}-minute clock per passage inside the section clock, marking and review, drag-to-highlight, then an untimed blind review before any answer is revealed. The pace target is ${paceSeconds()} seconds a question.</p></div>
      ${notice ? `<aside class="course-notice dat-rc-notice" role="status">${notice}</aside>` : ''}
      ${saved ? `<div class="dat-resume-row"><span>A reading set is in progress (${Object.keys(saved.answers || {}).length} answered${saved.phase === 'blind' ? ', in blind review' : ''}).</span><a class="btn btn-solid" id="dat-rc-resume" data-dat-go href="${esc(datUrl(saved.setId ? { view: 'rc', set: saved.setId } : { view: 'rc', passage: saved.ids[0] }))}">Resume reading</a></div>` : ''}
      ${setRows ? `<section class="dat-rc-sets" aria-labelledby="dat-rc-sets-title"><h2 id="dat-rc-sets-title">Timed sets</h2><div class="dat-rc-grid">${setRows}</div></section>` : ''}
      <section class="dat-rc-list" aria-labelledby="dat-rc-list-title"><h2 id="dat-rc-list-title">Single passages</h2>
        <table class="dat-rc-table"><thead><tr><th scope="col">Passage</th><th scope="col">Domain</th><th scope="col">Questions</th><th scope="col">Words</th></tr></thead><tbody>${passageRows}</tbody></table></section>
      ${
        reports.length
          ? `<section class="dat-rc-reports" aria-labelledby="dat-rc-reports-title"><h2 id="dat-rc-reports-title">Saved blind reviews</h2><ul>${reports
              .slice(0, 5)
              .map(
                r =>
                  `<li><span>${esc(new Date(r.finishedAt || 0).toISOString().slice(0, 10))}</span> ${esc((r.passageIds || []).map(id => passageById(id)?.title || id).join(' · '))} <small>${r.totals?.correct ?? 0}/${r.totals?.n ?? 0} first pass · ${r.totals?.revised ?? 0}/${r.totals?.n ?? 0} after review</small></li>`
              )
              .join('')}</ul></section>`
          : ''
      }
      <div class="endbtns">${backLink()}</div>
      <p class="dat-save-status" id="dat-rc-save-status" role="status"></p>
      <p class="course-caption">Original Cortex passages written for this track; no published passage is reproduced. Option count follows the outline's option policy (${esc(outline()?.optionPolicy?.rc?.status || 'unverified')}).</p>
    </main>`);
    datDataNotice(main);
    page(main);
  }

  /* ---------- attempt ---------- */
  function renderPhase() {
    if (!run) return renderPicker();
    if (run.phase === 'blind') return renderBlind();
    if (run.phase === 'done') return renderResult();
    return renderQuestion();
  }
  function currentRef() {
    return run.qs[run.idx];
  }
  function questionOf(ref) {
    return questionsOf(passageById(ref?.p)).find(q => q.id === ref?.q) || null;
  }
  function answeredCount() {
    return run.qs.filter(ref => run.answers[ref.q] != null).length;
  }
  function goTo(index) {
    markTime();
    run.idx = Math.min(Math.max(0, index), run.qs.length - 1);
    saveResume();
    renderQuestion();
  }
  function renderQuestion() {
    const ref = currentRef(),
      p = passageById(ref?.p),
      q = questionOf(ref);
    if (!p || !q) return finishAttempt(false);
    const passageIndex = run.ids.indexOf(p.id),
      inPassage = run.qs.filter(r => r.p === p.id),
      positionInPassage = inPassage.findIndex(r => r.q === q.id) + 1;
    saveResume();
    const root = el(`<div class="dat-rc" data-dat-phase="attempt">
      <header class="dat-rc-bar">
        <a class="dat-rc-exit" id="dat-rc-exit" data-dat-go href="${esc(datUrl({ view: 'rc' }))}">&larr; Exit</a>
        <nav class="dat-rc-crumb" aria-label="Reading position"><span>DAT</span><span>RC</span><span>Passage ${passageIndex + 1}/${run.ids.length}</span></nav>
        <div class="dat-rc-clocks">
          <span class="dat-rc-clock dat-rc-passage-clock" id="dat-rc-passage-clock" title="Time left on this passage" aria-label="Time left on this passage">${fmtClock(passageSeconds() * 1000 - passageElapsed(p.id))}</span>
          <span class="dat-rc-clock" id="dat-rc-clock" title="Time left in the section" aria-label="Time left in the section">${fmtClock(remainMs())}</span>
          <span class="dat-rc-count">Q ${run.idx + 1}/${run.qs.length}</span>
        </div>
      </header>
      <main class="dat-rc-stage">
        <section class="dat-rc-q">
          <p class="dat-rc-qmeta">Question ${positionInPassage} of ${inPassage.length} on this passage &middot; ${esc(skillTitle(q.skill))}</p>
          <p class="q dat-rc-stem">${esc(q.stem)}</p>
          ${confRow(run.conf[q.id] || 'unsure', 'dat-rc-conf')}
          <div class="opts dat-rc-opts" id="dat-rc-opts">${optionButtons(q, run.answers[q.id], 'dat-rc-opt')}</div>
          <div class="dat-rc-nav">
            <button class="btn" id="dat-rc-prev" type="button"${run.idx === 0 ? ' disabled' : ''}>&larr; Previous</button>
            <button class="btn dat-rc-flag${run.marks[q.id] ? ' active' : ''}" id="dat-rc-flag" type="button" aria-pressed="${!!run.marks[q.id]}">${run.marks[q.id] ? 'Marked' : 'Mark for review'}</button>
            <button class="btn" id="dat-rc-review" type="button">Review screen</button>
            <button class="btn btn-solid" id="dat-rc-next" type="button">${run.idx + 1 >= run.qs.length ? 'End section' : 'Next →'}</button>
          </div>
          <p class="dat-save-status" id="dat-rc-save-status" role="status"></p>
        </section>
        ${passageHtml(p)}
      </main>
      <button class="btn dat-rc-hl" id="dat-rc-highlight" type="button" hidden>Highlight</button>
    </div>`);
    root.querySelectorAll('#dat-rc-conf .mode').forEach(button =>
      button.addEventListener('click', () => {
        run.conf[q.id] = button.dataset.datConf;
        root
          .querySelectorAll('#dat-rc-conf .mode')
          .forEach(other => other.classList.toggle('active', other === button));
        saveResume();
      })
    );
    root.querySelectorAll('.dat-rc-opt').forEach(button =>
      button.addEventListener('click', () => {
        // A workspace reset nulls the run while this screen is still mounted (dat.js resetDatState).
        if (!run) return;
        const authored = +button.dataset.datI;
        run.answers[q.id] = run.answers[q.id] === authored ? null : authored;
        if (run.answers[q.id] == null) delete run.answers[q.id];
        root.querySelectorAll('.dat-rc-opt').forEach(other => {
          const on = +other.dataset.datI === run.answers[q.id];
          other.classList.toggle('picked', on);
          other.setAttribute('aria-pressed', String(on));
        });
        saveResume();
      })
    );
    root.querySelector('#dat-rc-prev').addEventListener('click', () => run && goTo(run.idx - 1));
    root.querySelector('#dat-rc-next').addEventListener('click', () => {
      if (!run) return;
      if (run.idx + 1 >= run.qs.length) return finishAttempt(false);
      goTo(run.idx + 1);
    });
    root.querySelector('#dat-rc-flag').addEventListener('click', () => {
      if (!run) return;
      if (run.marks[q.id]) delete run.marks[q.id];
      else run.marks[q.id] = true;
      saveResume();
      renderQuestion();
    });
    root.querySelector('#dat-rc-review').addEventListener('click', () => {
      markTime();
      saveResume();
      renderNavigator();
    });
    wireHighlighter(root, p);
    stage(root);
    startTicker();
  }
  // Drag-to-highlight: a selection inside one paragraph pops the Highlight button; clicking an
  // existing <mark> clears the range it belongs to. Only { par, start, end } numbers are stored.
  function wireHighlighter(root, p) {
    const passage = root.querySelector('#dat-rc-passage'),
      button = root.querySelector('#dat-rc-highlight');
    if (!passage || !button) return;
    let pending = null;
    const hide = () => {
      pending = null;
      button.hidden = true;
    };
    const repaint = () => {
      const list = root.querySelector('.dat-rc-text');
      if (!list) return;
      paragraphsOf(p).forEach((text, i) => {
        const node = list.querySelector(`[data-dat-par="${i + 1}"]`);
        if (node) node.innerHTML = rangeHtml(text, parRanges(p.id, i + 1));
      });
    };
    passage.addEventListener('mouseup', () => {
      const selection = typeof window.getSelection === 'function' ? window.getSelection() : null;
      if (!selection || !selection.rangeCount || selection.isCollapsed) return hide();
      const range = selection.getRangeAt(0);
      const host = range.startContainer.parentElement?.closest('[data-dat-par]');
      if (!host || host !== range.endContainer.parentElement?.closest('[data-dat-par]')) return hide();
      const start = offsetIn(host, range.startContainer, range.startOffset),
        end = offsetIn(host, range.endContainer, range.endOffset);
      if (end <= start) return hide();
      pending = { par: Number(host.dataset.datPar), start, end };
      button.hidden = false;
    });
    passage.addEventListener('click', event => {
      const mark = event.target.closest?.('.dat-rc-mark');
      if (!mark) return;
      const host = mark.closest('[data-dat-par]'),
        par = Number(host?.dataset.datPar),
        at = Number(mark.dataset.datAt);
      setParRanges(
        p.id,
        par,
        parRanges(p.id, par).filter(r => !(at >= r.start && at < r.end))
      );
      repaint();
      saveResume();
    });
    button.addEventListener('click', () => {
      if (!pending) return;
      setParRanges(p.id, pending.par, normalizeRanges([...parRanges(p.id, pending.par), pending]));
      hide();
      repaint();
      saveResume();
      window.getSelection?.()?.removeAllRanges?.();
    });
  }
  // The exam's review screen: every question with its Marked / Incomplete status, filterable,
  // each one a jump back into the section.
  function renderNavigator(filter = 'all') {
    const rows = run.qs
      .map((ref, i) => {
        const marked = !!run.marks[ref.q],
          answered = run.answers[ref.q] != null;
        return { ref, i, marked, answered };
      })
      .filter(row => (filter === 'marked' ? row.marked : filter === 'incomplete' ? !row.answered : true));
    const main = el(`<main class="panel dat-rc-nav-screen">
      <div class="hero"><span class="label">DAT &middot; Reading Comprehension</span><h1>Review screen</h1>
      <p class="sub">${answeredCount()}/${run.qs.length} answered &middot; ${Object.keys(run.marks).length} marked &middot; <span class="dat-rc-clock" id="dat-rc-clock">${fmtClock(remainMs())}</span> left in the section.</p></div>
      <div class="ctl"><span class="label">Show</span><div class="modes" id="dat-rc-nav-filter">${[
        ['all', 'All questions'],
        ['marked', 'Marked'],
        ['incomplete', 'Incomplete'],
      ]
        .map(
          ([key, label]) =>
            `<button class="mode${key === filter ? ' active' : ''}" type="button" data-dat-filter="${key}">${label}</button>`
        )
        .join('')}</div></div>
      <div class="dat-rc-nav-wrap"><table class="dat-rc-nav-table"><thead><tr><th scope="col">#</th><th scope="col">Passage</th><th scope="col">Status</th><th scope="col"></th></tr></thead>
      <tbody>${rows
        .map(
          row =>
            `<tr><th scope="row">${row.i + 1}</th><td>${esc(passageById(row.ref.p)?.title || row.ref.p)}</td><td>${row.marked ? 'Marked' : ''}${row.marked && !row.answered ? ' · ' : ''}${row.answered ? 'Answered' : 'Incomplete'}</td><td><button class="btn" type="button" data-dat-goto="${row.i}">Go</button></td></tr>`
        )
        .join('')}</tbody></table></div>
      <div class="endbtns"><button class="btn btn-solid" id="dat-rc-back-to-item" type="button">Back to question ${run.idx + 1}</button><button class="btn" id="dat-rc-end" type="button">End section</button></div>
      <p class="dat-save-status" id="dat-rc-save-status" role="status"></p>
    </main>`);
    main
      .querySelectorAll('[data-dat-filter]')
      .forEach(button => button.addEventListener('click', () => renderNavigator(button.dataset.datFilter)));
    main
      .querySelectorAll('[data-dat-goto]')
      .forEach(button => button.addEventListener('click', () => goTo(+button.dataset.datGoto)));
    main.querySelector('#dat-rc-back-to-item').addEventListener('click', () => goTo(run.idx));
    main.querySelector('#dat-rc-end').addEventListener('click', () => finishAttempt(false));
    page(main);
    startTicker(false);
  }
  function finishAttempt(forced) {
    if (!run) return renderPicker();
    stopTicker();
    markTime();
    run.forced = !!forced;
    run.phase = 'blind';
    run.attemptEndedAt = now();
    // Flagged and not-sure questions first, exactly as the CARS blind review orders them.
    if (!run.reviewOrder)
      run.reviewOrder = run.qs
        .map(ref => ref.q)
        .sort(
          (a, b) =>
            Number(!!run.marks[b] || (run.conf[b] || 'unsure') !== 'sure') -
            Number(!!run.marks[a] || (run.conf[a] || 'unsure') !== 'sure')
        );
    run.reviewIdx = Math.min(run.reviewIdx || 0, run.reviewOrder.length);
    saveResume();
    renderBlind();
  }

  /* ---------- blind review (fork of mcat-workflows.js:605-757) ---------- */
  function renderBlind() {
    // A workspace reset can null the run while this screen is still mounted.
    if (!run) return;
    const order = run.reviewOrder || [];
    if (run.reviewIdx >= order.length) {
      run.phase = 'done';
      return renderResult();
    }
    const qId = order[run.reviewIdx],
      ref = run.qs.find(r => r.q === qId),
      p = passageById(ref?.p),
      q = questionOf(ref);
    if (!p || !q) {
      run.reviewIdx++;
      return renderBlind();
    }
    const draft = (run.reviews[q.id] ||= { chosen: run.answers[q.id] ?? null, evidence: [], rationale: '' });
    const position = run.qs.findIndex(r => r.q === q.id);
    const root = el(`<div class="dat-rc" data-dat-phase="blind">
      <header class="dat-rc-bar">
        <a class="dat-rc-exit" data-dat-go href="${esc(datUrl({ view: 'rc' }))}">&larr; Exit</a>
        <nav class="dat-rc-crumb" aria-label="Blind review position"><span>DAT</span><span>RC</span><span>Blind review</span></nav>
        <div class="dat-rc-clocks"><span class="dat-rc-count">${run.reviewIdx + 1}/${order.length}</span></div>
      </header>
      <main class="dat-rc-stage">
        <section class="dat-rc-q">
          <span class="label">Untimed second pass &middot; answers hidden</span>
          <h1 class="dat-rc-blind-title">Revisit your reasoning.</h1>
          <p class="dat-rc-qmeta">Q${position + 1} &middot; ${esc(skillTitle(q.skill))} &middot; ${run.marks[q.id] ? 'Marked &middot; ' : ''}${run.answers[q.id] == null ? 'Unanswered in the first pass' : `first answer ${esc(Core.letters(q.options.length)[orderFor(q).indexOf(run.answers[q.id])] ?? '—')} · felt ${esc(CONF[run.conf[q.id] || 'unsure'])}`}</p>
          <p class="q dat-rc-stem">${esc(q.stem)}</p>
          <div class="opts dat-rc-opts" id="dat-rc-blind-opts">${optionButtons(q, draft.chosen, 'dat-rc-blind-opt')}</div>
          <label class="dat-rc-field">Why does the text support your answer?<textarea id="dat-rc-rationale" rows="3" maxlength="1800" placeholder="One or two sentences is enough.">${esc(draft.rationale)}</textarea></label>
          <p class="dat-rc-evidence-count" id="dat-rc-evidence-count" role="status">${draft.evidence.length} evidence paragraph${draft.evidence.length === 1 ? '' : 's'} selected.</p>
          <div class="dat-rc-nav">
            <button class="btn btn-solid" id="dat-rc-blind-next" type="button">${run.reviewIdx === order.length - 1 ? 'Save review & reveal answers' : 'Save review & continue'} →</button>
            <button class="btn" id="dat-rc-blind-skip" type="button">Keep the first answer; skip reflection</button>
          </div>
          <p class="dat-rc-fine">Your first-pass score stays unchanged. Reflections are saved for self-review.</p>
          <p class="dat-save-status" id="dat-rc-save-status" role="status"></p>
        </section>
        ${passageHtml(p, { pick: true, picked: draft.evidence, instruction: 'Select the paragraph or paragraphs that support your reasoning.' })}
      </main>
    </div>`);
    const next = root.querySelector('#dat-rc-blind-next');
    const update = () => {
      next.disabled = !Number.isInteger(draft.chosen) || !draft.evidence.length || !draft.rationale.trim();
      saveResume();
    };
    root.querySelectorAll('.dat-rc-opt').forEach(button =>
      button.addEventListener('click', () => {
        if (!run) return;
        draft.chosen = +button.dataset.datI;
        root.querySelectorAll('.dat-rc-opt').forEach(other => {
          const on = +other.dataset.datI === draft.chosen;
          other.classList.toggle('picked', on);
          other.setAttribute('aria-pressed', String(on));
        });
        update();
      })
    );
    root.querySelectorAll('.dat-rc-evidence').forEach(button =>
      button.addEventListener('click', () => {
        if (!run) return;
        const par = Number(button.dataset.datPar);
        draft.evidence = draft.evidence.includes(par)
          ? draft.evidence.filter(v => v !== par)
          : [...draft.evidence, par].sort((a, b) => a - b);
        button.classList.toggle('selected', draft.evidence.includes(par));
        button.setAttribute('aria-pressed', String(draft.evidence.includes(par)));
        root.querySelector('#dat-rc-evidence-count').textContent =
          `${draft.evidence.length} evidence paragraph${draft.evidence.length === 1 ? '' : 's'} selected.`;
        update();
      })
    );
    root.querySelector('#dat-rc-rationale').addEventListener('input', event => {
      if (!run) return;
      draft.rationale = event.target.value;
      update();
    });
    next.addEventListener('click', () => {
      if (!run) return;
      draft.reviewed = true;
      delete draft.skipped;
      run.reviewIdx++;
      saveResume();
      renderBlind();
    });
    root.querySelector('#dat-rc-blind-skip').addEventListener('click', () => {
      if (!run) return;
      draft.reviewed = false;
      draft.skipped = true;
      run.reviewIdx++;
      saveResume();
      renderBlind();
    });
    stage(root);
    update();
  }

  /* ---------- log, mistake log and the saved report ---------- */
  // One QLOG row per question of the first pass. section 'rc', category 'RC-n' from the reading
  // skill and the passage id, per DESIGN §4; the blind review never changes the recorded score.
  function logAll() {
    const store = stores(),
      ts = now();
    for (const ref of run.qs) {
      const p = passageById(ref.p),
        q = questionOf(ref);
      if (!p || !q) continue;
      const chosen = run.answers[q.id],
        correct = chosen === q.answer;
      const row = {
        qId: q.id,
        section: 'rc',
        category: categoryOf(q),
        topic: null,
        passage: p.id,
        correct,
        conf: run.conf[q.id] || null,
        ms: typeof run.qMs[q.id] === 'number' ? run.qMs[q.id] : null,
        ts,
        attemptId: run.attemptId,
        source: 'rc',
        unanswered: chosen == null,
      };
      if (!store.log.some(r => r.attemptId === row.attemptId && r.qId === row.qId)) {
        store.log.push(row);
        if (store.log.length > LOG_CAP) store.log.splice(0, store.log.length - LOG_CAP);
      }
      const h = store.hist[q.id] || { n: 0 };
      if (h.lastAttemptId !== run.attemptId) h.n = (h.n || 0) + 1;
      h.lastAttemptId = run.attemptId;
      h.lastCorrect = correct;
      h.conf = row.conf;
      h.ts = ts;
      store.hist[q.id] = h;
      // Misses enrol in the shared mistake log through the one scheduler in the drill engine.
      if (!correct) {
        const record = Core.enroll(store.srs, { id: q.id, section: 'rc', category: row.category, topic: null }, ts);
        record.passage = p.id;
      }
    }
    const logOK = StudyStorage.write(LOG_KEY, store.log);
    const histOK = StudyStorage.write(HIST_KEY, store.hist);
    const ok = StudyStorage.write(SRS_KEY, store.srs) && histOK && logOK;
    saveStatus(ok);
    return ok;
  }
  function buildReport() {
    return {
      kind: 'rc',
      attemptId: run.attemptId,
      setId: run.setId,
      passageIds: run.ids.slice(),
      startedAt: run.startedAt,
      finishedAt: run.attemptEndedAt || now(),
      forced: !!run.forced,
      paceSeconds: paceSeconds(),
      totals: totals(),
      questions: run.qs.map(ref => {
        const q = questionOf(ref),
          draft = run.reviews[ref.q] || null;
        return {
          qId: ref.q,
          passage: ref.p,
          skill: q?.skill || null,
          type: q?.type || null,
          chosen: run.answers[ref.q] ?? null,
          correct: !!q && run.answers[ref.q] === q.answer,
          conf: run.conf[ref.q] || null,
          marked: !!run.marks[ref.q],
          ms: typeof run.qMs[ref.q] === 'number' ? run.qMs[ref.q] : null,
          review: draft
            ? {
                chosen: draft.chosen ?? null,
                evidence: (draft.evidence || []).slice(),
                rationale: String(draft.rationale || ''),
                reviewed: !!draft.reviewed,
                skipped: !!draft.skipped,
              }
            : null,
        };
      }),
    };
  }
  // Keyed 'rc:<attemptId>' (DESIGN §4); the newest REPORT_CAP reports are kept so a term of
  // reading does not grow the workspace without a bound.
  function saveReport() {
    const stored = StudyStorage.read(REVIEW_KEY, {});
    const map = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    map['rc:' + run.attemptId] = buildReport();
    const rcKeys = Object.keys(map)
      .filter(key => key.startsWith('rc:'))
      .sort((a, b) => (map[b]?.finishedAt || 0) - (map[a]?.finishedAt || 0));
    for (const key of rcKeys.slice(REPORT_CAP)) delete map[key];
    const ok = StudyStorage.write(REVIEW_KEY, map);
    saveStatus(ok);
    return ok;
  }
  function totals() {
    const n = run.qs.length;
    let correct = 0,
      revised = 0,
      improved = 0,
      lost = 0,
      reviewed = 0;
    for (const ref of run.qs) {
      const q = questionOf(ref);
      if (!q) continue;
      const first = run.answers[ref.q] ?? null,
        draft = run.reviews[ref.q];
      const second = draft?.reviewed ? (draft.chosen ?? null) : first;
      if (first === q.answer) correct++;
      if (second === q.answer) revised++;
      if (draft?.reviewed) {
        reviewed++;
        if (first !== q.answer && second === q.answer) improved++;
        if (first === q.answer && second !== q.answer) lost++;
      }
    }
    return { n, correct, revised, improved, lost, reviewed };
  }

  /* ---------- result ---------- */
  function renderResult() {
    if (!run.logged) {
      logAll();
      saveReport();
      clearResume();
      run.logged = true;
    }
    const t = totals(),
      pace = paceSeconds();
    const bySkill = {};
    let timed = 0,
      totalMs = 0,
      overPace = 0;
    for (const ref of run.qs) {
      const q = questionOf(ref);
      if (!q) continue;
      const row = (bySkill[q.skill] ||= { n: 0, correct: 0, ms: 0, timed: 0 });
      row.n++;
      if (run.answers[ref.q] === q.answer) row.correct++;
      const ms = run.qMs[ref.q];
      if (typeof ms === 'number') {
        row.ms += ms;
        row.timed++;
        timed++;
        totalMs += ms;
        if (ms > pace * 1000) overPace++;
      }
    }
    const secs = timed ? (totalMs / timed / 1000).toFixed(1) : '—';
    const again = run.setId ? datUrl({ view: 'rc', set: run.setId }) : datUrl({ view: 'rc', passage: run.ids[0] });
    const main = el(`<main class="panel dat-rc-review">
      <section class="summary dat-rc-review-summary">
        <span class="label">Reading complete${run.forced ? ' &middot; the section clock ended the set' : ''}</span>
        <div class="score">${String(t.correct).padStart(2, '0')}<span class="of">/${String(t.n).padStart(2, '0')}</span></div>
        <div class="dat-rc-score-pair"><div><strong>${t.correct}/${t.n}</strong><span>First pass</span></div><div><strong>${t.revised}/${t.n}</strong><span>After blind review</span></div></div>
        <dl class="dat-rc-review-stats">
          <div><dt>Accuracy</dt><dd id="dat-rc-accuracy">${pct(t.n ? t.correct / t.n : 0)}</dd></div>
          <div><dt>Seconds per question</dt><dd id="dat-rc-pace">${secs} s <small>vs ${pace} s target</small></dd></div>
          <div><dt>Over pace</dt><dd>${overPace} of ${t.n}</dd></div>
          <div><dt>Reflected on</dt><dd>${t.reviewed} of ${t.n}</dd></div>
          <div><dt>Changed to correct</dt><dd id="dat-rc-improved">${t.improved}</dd></div>
          <div><dt>Changed away</dt><dd id="dat-rc-lost">${t.lost}</dd></div>
        </dl>
        <p class="dat-rc-fine">Only the first pass enters practice accuracy. A second-pass change does not by itself explain why a question was missed.</p>
      </section>
      <section class="dat-rc-skills" aria-labelledby="dat-rc-skills-title"><h2 id="dat-rc-skills-title">By reading skill</h2>
        <table class="dat-rc-skill-table"><thead><tr><th scope="col">Skill</th><th scope="col">Correct</th><th scope="col">Accuracy</th><th scope="col">Seconds</th></tr></thead>
        <tbody>${Object.entries(bySkill)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(
            ([skill, row]) =>
              `<tr><td>${esc(categoryOf({ skill }))} &middot; ${esc(skillTitle(skill))}</td><td>${row.correct}/${row.n}</td><td>${pct(row.correct / row.n)}</td><td>${row.timed ? (row.ms / row.timed / 1000).toFixed(0) + ' s' : '—'}</td></tr>`
          )
          .join('')}</tbody></table>
      </section>
      <section class="drill-review dat-rc-items"><span class="label">Question by question</span>
        ${run.qs
          .map((ref, i) => {
            const p = passageById(ref.p),
              q = questionOf(ref);
            if (!p || !q) return '';
            const chosen = run.answers[ref.q] ?? null,
              correct = chosen === q.answer,
              draft = run.reviews[ref.q],
              order = orderFor(q),
              letters = Core.letters(order.length),
              letterOf = authored => letters[order.indexOf(authored)] ?? '—';
            const ms = run.qMs[ref.q];
            const evidence = (q.evidenceParagraphs || []).filter(n => n >= 1);
            const paragraphs = paragraphsOf(p);
            return `<details class="rev dat-rc-rev"${correct ? '' : ' open'}>
              <summary><span class="${correct ? 'ok' : 'no'}">${correct ? '&#10003;' : '&#10007;'}</span> Q${i + 1} &middot; ${esc(skillTitle(q.skill))} &middot; ${esc(q.type || '')}</summary>
              <div class="rev-body">
                <div class="rev-ans">First pass: ${chosen == null ? 'Unanswered' : esc(letterOf(chosen))} &middot; Review: ${draft?.reviewed ? esc(letterOf(draft.chosen)) : 'Skipped'} &middot; Correct: <b>${esc(letterOf(q.answer))}</b>${typeof ms === 'number' ? ` &middot; ${(ms / 1000).toFixed(0)} s${ms > pace * 1000 ? ' (over pace)' : ''}` : ''}</div>
                <p class="dat-rc-stem">${esc(q.stem)}</p>
                <p>${esc(q.explanation)}</p>
                ${
                  evidence.length
                    ? `<div class="dat-rc-evidence-block"><span class="label">Evidence &middot; paragraph ${evidence.join(', ')}</span>${evidence
                        .map(n => `<p class="dat-rc-evidence-par">${esc(paragraphs[n - 1] || '')}</p>`)
                        .join('')}</div>`
                    : ''
                }
                ${draft?.reviewed ? `<blockquote class="dat-rc-rationale">${esc(draft.rationale)}</blockquote><p class="dat-rc-fine">You cited paragraph ${draft.evidence.join(', ') || '—'}.</p>` : ''}
              </div></details>`;
          })
          .join('')}
      </section>
      <div class="endbtns"><a class="btn btn-solid" id="dat-rc-again" data-dat-go href="${esc(again)}">Read it again</a>${pickerLink('Another passage')}<a class="btn" data-dat-go href="${esc(datUrl({ view: 'mistakes' }))}">Mistake log</a>${backLink()}</div>
      <p class="dat-save-status" id="dat-rc-save-status" role="status"></p>
    </main>`);
    page(main);
    saveStatus(!StudyStorage.paused);
  }

  /* ---------- entry ---------- */
  function sameRun(blob, ids, setId) {
    return (blob.setId || null) === (setId || null) && (blob.ids || []).join('|') === ids.join('|');
  }
  function render() {
    if (!passages().length) return empty();
    const p = params();
    if (!p.set && !p.passage) return renderPicker();
    const ids = p.set ? sets().find(s => s.id === p.set)?.passages || [] : [p.passage];
    if (!ids.length || !ids.some(passageById))
      return renderPicker(
        `<strong>That reading set is not available.</strong><p>${esc(p.set || p.passage)} is not in the loaded passages. Pick one below.</p>`
      );
    const saved = loadResume();
    if (saved && sameRun(saved, ids, p.set) && resumeRun(saved)) return renderPhase();
    if (
      saved &&
      !window.confirm(
        'Replace your unfinished Reading Comprehension session with this new session? Cancel keeps the saved session so you can resume it.'
      )
    ) {
      history.replaceState({ sec: 'dat' }, '', datUrl({ view: 'rc' }));
      return renderPicker();
    }
    if (!startRun(ids, p.set || null)) return renderPicker();
    return renderPhase();
  }
  // resetDatState calls this after it has forgotten the loaded data and cleared the resume blobs.
  function reset() {
    stopTicker();
    run = null;
    DAT.attemptStores = null;
  }

  DAT.pausers.push(pause);
  window.DatRc = { render, pause, reset };
})();
