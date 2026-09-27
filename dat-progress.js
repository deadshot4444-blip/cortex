/* DAT progress page (DAT-08), /dat?view=progress. Reads cs-dat-log and cs-dat-srs through the
   shared attempt cache when a runner built it, else straight from storage; writes nothing.
   Per section: the last 60 counted items (review re-asks left out), accuracy, pace against
   the outline, and a DatScoreCore estimate with its band, percentile and 1-30 comparison.
   AA and TS appear once all five / all three parts have an estimate. PAT adds accuracy per
   subtest and level over the whole log. Every number is recomputed here; none is stored. */
(function () {
  'use strict';
  const Score = window.DatScoreCore;
  const AA_LABEL = { aa: 'Academic average', ts: 'Total science' };

  function outline() {
    return window.DAT?.outline || null;
  }
  function sectionName(key) {
    return outline()?.sections?.[key]?.name || key;
  }
  function sectionAbbr(key) {
    return outline()?.sections?.[key]?.abbr || key.toUpperCase();
  }
  function readLog() {
    const log = window.DAT?.attemptStores?.log || StudyStorage.read('cs-dat-log', []);
    return Array.isArray(log) ? log : [];
  }
  function readSrs() {
    const srs = window.DAT?.attemptStores?.srs || StudyStorage.read('cs-dat-srs', {});
    return srs && typeof srs === 'object' ? srs : {};
  }
  function pct(correct, total) {
    return total ? Math.round((correct / total) * 100) + '%' : '—';
  }
  function band(est) {
    return `${est.scaled} <small>${est.low}–${est.high}</small>`;
  }
  function sectionRow(key, counts, est, pace) {
    const seconds = counts.timed ? Math.round(counts.ms / counts.timed / 1000) : null;
    const paceCell = seconds == null ? '—' : `${seconds} s${pace ? ` <small>of ${pace}</small>` : ''}`;
    const scored = est && est.scaled != null;
    const estimateCell = !counts.total
      ? '<span class="dat-progress-few">no items yet</span>'
      : scored
        ? band(est)
        : `<span class="dat-progress-few">${est ? 'too few items' : 'tables not loaded'}${est && est.note === 'Too few items for an estimate.' ? ` (${counts.total}/${est.min})` : ''}</span>`;
    return `<tr data-dat-section="${esc(key)}"><th scope="row">${esc(sectionName(key))}</th><td>${estimateCell}</td><td>${scored && est.percentile != null ? esc(Score.ordinal(est.percentile)) : '—'}</td><td>${scored && est.oldScale != null ? '≈ ' + est.oldScale : '—'}</td><td>${counts.total}</td><td>${pct(counts.correct, counts.total)}</td><td>${paceCell}</td></tr>`;
  }
  function compositeCard(kind, parts, estimates) {
    const missing = parts.filter(s => estimates[s]?.scaled == null);
    if (missing.length)
      return `<div class="dat-progress-composite is-pending" data-dat-composite="${kind}"><dt>${AA_LABEL[kind]}</dt><dd>—<small>Needs an estimate in ${esc(missing.map(sectionAbbr).join(', '))}.</small></dd></div>`;
    const scores = Object.fromEntries(parts.map(s => [s, estimates[s].scaled]));
    const value = kind === 'aa' ? Score.academicAverage(scores) : Score.totalScience(scores);
    const c = Score.composite(kind, value);
    const extra = [
      c.percentile != null ? `about the ${Score.ordinal(c.percentile)} percentile` : '',
      c.oldScale != null ? `≈ ${c.oldScale} on the pre-2025 scale` : '',
    ].filter(Boolean);
    return `<div class="dat-progress-composite" data-dat-composite="${kind}"><dt>${AA_LABEL[kind]}</dt><dd><span id="dat-progress-${kind}">${c.scaled}</span><small>band ${c.low}–${c.high}${extra.length ? ' · ' + esc(extra.join(' · ')) : ''}</small></dd></div>`;
  }
  function patTable(log) {
    const subtests = window.DAT?.pat?.subtests || [];
    const tally = {};
    for (const row of log) {
      if (!row || row.section !== 'pat' || !row.subtest || row.source === 'review' || typeof row.correct !== 'boolean')
        continue;
      const level = Number(row.level) || 1;
      const cell = ((tally[row.subtest] ||= {})[level] ||= { correct: 0, total: 0 });
      cell.total++;
      if (row.correct) cell.correct++;
    }
    const ids = Object.keys(tally);
    if (!ids.length) return '';
    const levels = [...new Set(ids.flatMap(id => Object.keys(tally[id]).map(Number)))].sort((a, b) => a - b);
    const order = subtests.map(s => s.id).filter(id => tally[id]);
    for (const id of ids) if (!order.includes(id)) order.push(id);
    const alias = id => subtests.find(s => s.id === id)?.alias || id;
    return `<section class="dat-progress-pat" aria-labelledby="dat-progress-pat-title"><h2 id="dat-progress-pat-title">Perceptual ability by subtest</h2>
      <div class="dat-progress-scroll"><table class="dat-topic-table"><thead><tr><th scope="col">Subtest</th>${levels.map(l => `<th scope="col">Level ${l}</th>`).join('')}</tr></thead><tbody>${order
        .map(
          id =>
            `<tr data-dat-subtest="${esc(id)}"><th scope="row">${esc(alias(id))}</th>${levels
              .map(l => {
                const cell = tally[id][l];
                return `<td>${cell ? `${pct(cell.correct, cell.total)} <small>${cell.correct}/${cell.total}</small>` : '—'}</td>`;
              })
              .join('')}</tr>`
        )
        .join('')}</tbody></table></div></section>`;
  }

  function render() {
    const ready = !!Score && Score.load(window.DAT?.scoreTables);
    const log = readLog(),
      srs = readSrs();
    const order = Object.keys(outline()?.sections || {}).filter(s => Score?.SECTIONS.includes(s));
    const sections = order.length ? order : Score ? Score.SECTIONS : [];
    const counts = Score ? Score.rolling(log) : {};
    const estimates = {};
    for (const s of sections) {
      const c = counts[s] || { correct: 0, total: 0 };
      if (ready)
        estimates[s] = Object.assign(Score.estimate(s, c.correct, c.total), {
          min: window.DAT.scoreTables.minItems[s],
        });
    }
    const pace = outline()?.pacingSeconds || {};
    const records = Object.values(srs).filter(rec => rec && typeof rec === 'object' && Number.isFinite(rec.due));
    const due = window.DatDrillCore?.dueMistakes
      ? window.DatDrillCore.dueMistakes(srs).length
      : records.filter(r => r.due <= Date.now()).length;
    const logged = log.filter(r => r && r.source !== 'review').length;
    const main = el(`<main class="panel dat-progress">
      <div class="hero"><span class="label">DAT &middot; Progress</span><h1>Where your practice stands.</h1>
      <p class="sub">${logged ? `Each section uses its last ${Score?.ROLLING || 60} answered items; mistake-log reviews are left out. Estimates need ${ready ? window.DAT.scoreTables.minItems.bio : 15} items in a section.` : 'Nothing logged yet. Drills, perceptual-ability sets, reading passages and quantitative sets all count here as soon as you answer.'}</p></div>
      ${
        ready
          ? `<dl class="dat-progress-composites">${compositeCard('aa', Score.AA_PARTS, estimates)}${compositeCard('ts', Score.TS_PARTS, estimates)}</dl>`
          : '<aside class="course-notice" role="status"><strong>Score estimates are unavailable.</strong><p>The score tables did not load, so accuracy and pace are shown without estimates.</p></aside>'
      }
      <section class="dat-progress-sections" aria-labelledby="dat-progress-sections-title"><h2 id="dat-progress-sections-title">By section <small>rolling drill estimate</small></h2>
      <div class="dat-progress-scroll"><table class="dat-topic-table dat-progress-table"><thead><tr><th scope="col">Section</th><th scope="col">Estimate</th><th scope="col">Percentile</th><th scope="col">1–30</th><th scope="col">Items</th><th scope="col">Correct</th><th scope="col">Pace</th></tr></thead><tbody>${sections
        .map(s => sectionRow(s, counts[s] || { correct: 0, total: 0, ms: 0, timed: 0 }, estimates[s], pace[s]))
        .join('')}</tbody></table></div></section>
      ${patTable(log)}
      <section class="dat-progress-log" aria-labelledby="dat-progress-log-title"><h2 id="dat-progress-log-title">Mistake log</h2>
      <p><span id="dat-progress-due">${due}</span> due now · ${records.length} in the log. <a data-dat-go href="${esc(datUrl({ view: 'mistakes' }))}">Open the mistake log</a></p></section>
      <div class="dat-progress-notes">
        <p>Estimates show the point and a band of about one standard error of measurement. Percentiles are ADA Table 2 (January 2025, percent of the national sample at or below the score); the 2025 cohort ran 5–7 percentile points lower at the same score. The 1–30 column is the ADA concordance to the pre-2025 scale, for comparison only.</p>
        <p class="dat-progress-disclaimer">${esc(Score ? Score.DISCLAIMER : '')}</p>
      </div>
      <div class="endbtns"><a class="btn btn-solid" data-dat-go href="${esc(datUrl({ view: 'drill' }))}">Start a drill</a><a class="btn" data-dat-go href="${esc(datUrl())}">Back to DAT</a></div>
    </main>`);
    datDataNotice(main);
    datView(main);
  }

  window.DatProgress = { render };
})();
