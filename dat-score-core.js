/* DAT score layer (DAT-08). Pure UMD, no DOM. The ADA scores each form with a 3-parameter
   IRT model and publishes no raw-to-scale table (RESEARCH §6.8), so nothing here reproduces
   an official score: percent correct is mapped through Cortex's own anchors onto the 2025
   national mean and SD for the section, rounded to the 10-point grid, and shown with a
   ±1 SEM band. Percentiles and the 1-30 comparison come from ADA Tables 1-2. Only raw
   counts are ever stored; every estimate is recomputed on render from
   data/dat-score-tables.json, so a table fix applies to old work. Node tests require() this. */
(function (root) {
  'use strict';
  const SECTIONS = ['bio', 'gchem', 'ochem', 'pat', 'rc', 'qr'];
  const AA_PARTS = ['qr', 'rc', 'bio', 'gchem', 'ochem'];
  const TS_PARTS = ['bio', 'gchem', 'ochem'];
  const ROLLING = 60;
  const DISCLAIMER =
    'Estimated from percent correct on an uncalibrated Cortex form, anchored to the 2025 national mean and spread for each section. This is not an official ADA score and cannot predict one; the ADA scores each form with a 3-parameter IRT model. Use the band, not the point. Official results arrive 3-4 weeks after testing.';
  let T = null;

  function load(tables) {
    T = tables && tables.concordance && tables.norms ? tables : null;
    return !!T;
  }
  function loaded() {
    return !!T;
  }
  // A page that only estimates (the PAT form) never calls load(); pick the tables up from DAT.
  function ensure() {
    if (!T && root.DAT?.scoreTables) load(root.DAT.scoreTables);
    return !!T;
  }
  function round10(x) {
    return Math.round(x / 10) * 10;
  }
  function clamp(x) {
    return Math.min(T.scale.max, Math.max(T.scale.min, x));
  }
  function piecewise(anchors, p) {
    if (p <= anchors[0][0]) return anchors[0][1];
    for (let i = 1; i < anchors.length; i++) {
      const [x1, y1] = anchors[i];
      if (p <= x1) {
        const [x0, y0] = anchors[i - 1];
        return y0 + ((p - x0) / (x1 - x0)) * (y1 - y0);
      }
    }
    return anchors[anchors.length - 1][1];
  }
  // Percent of the ADA norm sample at or below the score: the row at or below it.
  function percentile(kind, scaled) {
    const col = T?.percentiles[kind];
    if (!col || scaled == null) return null;
    let best = null,
      bestAt = -Infinity;
    for (const [score, pct] of Object.entries(col)) {
      const s = Number(score);
      if (s <= scaled && s > bestAt) {
        bestAt = s;
        best = pct;
      }
    }
    return best;
  }
  // Largest old 1-30 score whose new-scale value is at or below this one; null below the table.
  function oldScale(kind, scaled) {
    const col = T?.concordance[kind];
    if (!col || scaled == null) return null;
    let best = null;
    T.concordance.old.forEach((old, i) => {
      if (col[i] <= scaled) best = old;
    });
    if (best == null && kind === 'aa')
      for (const [old, value] of Object.entries(T.concordance.aaLow || {}))
        if (value <= scaled && (best == null || Number(old) > best)) best = Number(old);
    return best;
  }
  // `band` and `old` repeat low/high and oldScale in the shape dat-pat.js already reads.
  function withBand(kind, scaled) {
    const low = clamp(scaled - T.bands[kind]),
      high = clamp(scaled + T.bands[kind]),
      old = oldScale(kind, scaled);
    return { scaled, low, high, band: [low, high], percentile: percentile(kind, scaled), oldScale: old, old };
  }
  function estimate(section, correct, total) {
    const base = { section, correct, total, percent: total ? correct / total : null, estimate: true };
    if (!ensure() || !T.norms[section])
      return Object.assign(base, { scaled: null, note: 'Score tables are not loaded.' });
    if (!(total >= T.minItems[section]))
      return Object.assign(base, { scaled: null, note: 'Too few items for an estimate.' });
    const z = piecewise(T.rawAnchors, correct / total);
    const norm = T.norms[section];
    return Object.assign(base, withBand(section, round10(clamp(norm.mean + norm.sd * z))), {
      note: 'Estimate from raw counts.',
    });
  }
  function meanOf(scores, parts) {
    const values = parts.map(s => (scores || {})[s]);
    if (!values.every(v => typeof v === 'number' && Number.isFinite(v))) return null;
    return round10(values.reduce((a, b) => a + b, 0) / values.length);
  }
  // PAT is never part of the Academic Average (RESEARCH §6.2).
  function academicAverage(scores) {
    return meanOf(scores, AA_PARTS);
  }
  function totalScience(scores) {
    return meanOf(scores, TS_PARTS);
  }
  function composite(kind, scaled) {
    if (!ensure() || scaled == null) return null;
    return withBand(kind, scaled);
  }
  // The last `limit` counted rows per section. Review re-asks of known misses are left out:
  // they are not a fresh sample of the section.
  function rolling(log, limit = ROLLING) {
    const out = {};
    for (const s of SECTIONS) out[s] = { correct: 0, total: 0, ms: 0, timed: 0 };
    const rows = Array.isArray(log) ? log : [];
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      if (!row || row.source === 'review' || !out[row.section] || typeof row.correct !== 'boolean') continue;
      const acc = out[row.section];
      if (acc.total >= limit) continue;
      acc.total++;
      if (row.correct) acc.correct++;
      if (typeof row.ms === 'number' && row.ms > 0) {
        acc.ms += row.ms;
        acc.timed++;
      }
    }
    return out;
  }
  function ordinal(n) {
    const tail = n % 100;
    if (tail >= 11 && tail <= 13) return n + 'th';
    return n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  }
  // One display line: "PAT 61/90 · est. 420 (band 400–440) · about the 65th percentile (…) · ≈ 19 on …".
  function describe(label, est) {
    const head = est.total != null ? `${label} ${est.correct}/${est.total}` : label;
    if (est.scaled == null) return `${head} · ${est.note || 'No estimate.'}`;
    const bits = [head, `est. ${est.scaled} (band ${est.low}–${est.high})`];
    if (est.percentile != null)
      bits.push(
        `about the ${ordinal(est.percentile)} percentile (ADA Table 2, Jan 2025; the 2025 cohort ran 5–7 points lower)`
      );
    if (est.oldScale != null) bits.push(`≈ ${est.oldScale} on the pre-2025 1–30 scale (ADA concordance)`);
    return bits.join(' · ');
  }

  const api = {
    SECTIONS,
    AA_PARTS,
    TS_PARTS,
    ROLLING,
    DISCLAIMER,
    load,
    loaded,
    round10,
    estimate,
    percentile,
    oldScale,
    academicAverage,
    totalScience,
    composite,
    rolling,
    ordinal,
    describe,
  };
  root.DatScoreCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
