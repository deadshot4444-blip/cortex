/* DAT drill engine (DAT-03, DAT-05 hooks). Pure UMD, no DOM: pool builder over the merged
   bank, seeded shuffle that never reorders qc/ds options, pace targets from the outline,
   run summary, QLOG row builder and the SM-2 schedule copied from mcat.js:35-59 with an
   injectable clock. Shared by dat-practice.js, dat-qr.js and the Node tests. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const SNS_SECTIONS = ['bio', 'gchem', 'ochem'];
  const FIXED_ORDER = new Set(['qc', 'ds', 'data']);

  /* ---------- randomness ---------- */
  function seedOf(seed) {
    if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
    let h = 2166136261;
    for (const ch of String(seed ?? 0)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return h >>> 0;
  }
  // mulberry32: small, fast, deterministic across engines.
  function rng(seed) {
    let a = seedOf(seed);
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(list, seed) {
    const out = Array.from(list || []),
      next = rng(seed);
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  // Display permutation for one item: display position -> authored option index.
  // qc/ds/data options keep their authored (canonical) order.
  function orderOptions(item, seed) {
    const n = item?.options?.length || 0,
      identity = Array.from({ length: n }, (_, i) => i);
    if (FIXED_ORDER.has(item?.format)) return identity;
    return shuffle(identity, seed ?? item?.id ?? 0);
  }

  /* ---------- pool ---------- */
  function mixedSections(outline) {
    const block = outline?.blocks?.find(b => b.id === 'sns');
    return Array.isArray(block?.sections) && block.sections.length ? block.sections : SNS_SECTIONS;
  }
  function excluded(exclude, id) {
    if (!exclude) return false;
    if (typeof exclude.has === 'function') return exclude.has(id);
    return Array.isArray(exclude) && exclude.includes(id);
  }
  function pool(questions, outline, scope = {}) {
    const { section, category, topic, exclude } = scope;
    const sections = section === 'mixed' ? mixedSections(outline) : section ? [section] : null;
    return (questions || []).filter(
      q =>
        q &&
        (!sections || sections.includes(q.section)) &&
        (!category || q.category === category) &&
        (!topic || q.topic === topic) &&
        !excluded(exclude, q.id)
    );
  }
  // Items sharing a setId (data tables) stay adjacent, at the position of the first one drawn.
  function groupSets(list) {
    const out = [],
      seen = new Set();
    for (const item of list || []) {
      if (!item || seen.has(item.id)) continue;
      out.push(item);
      seen.add(item.id);
      if (item.setId)
        for (const other of list) {
          if (other && other.setId === item.setId && !seen.has(other.id)) {
            out.push(other);
            seen.add(other.id);
          }
        }
    }
    return out;
  }

  /* ---------- outline lookups ---------- */
  function pace(outline, item) {
    const section = typeof item === 'string' ? item : item?.section;
    const seconds = Number(outline?.pacingSeconds?.[section]);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : 60;
  }
  function policyKey(outline, item) {
    if (item?.format === 'qc' || item?.format === 'ds') return item.format;
    return outline?.sections?.[item?.section]?.block === 'sns' ? 'sns' : item?.section;
  }
  function letters(n) {
    const shared = root.LETTERS;
    if (Array.isArray(shared) && shared.length >= n) return shared.slice(0, n);
    return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
  }

  /* ---------- run summary ---------- */
  function tally(map, key, correct, extra) {
    if (!key) return;
    const row = (map[key] ||= Object.assign({ n: 0, correct: 0 }, extra || {}));
    row.n++;
    if (correct) row.correct++;
  }
  // run = { results: [{ id, section, category, topic, correct, ms }], paceSeconds }
  // ms is null for an item the exam clock closed before an answer.
  function summary(run) {
    const results = (run?.results || []).filter(Boolean),
      paceSeconds = Number(run?.paceSeconds) || 0,
      paceMs = paceSeconds * 1000;
    const out = {
      n: results.length,
      correct: 0,
      accuracy: 0,
      msPerItem: 0,
      paceSeconds,
      overPace: 0,
      fastWrong: 0,
      slowWrong: 0,
      unanswered: 0,
      byCategory: {},
      byTopic: {},
    };
    let timed = 0,
      totalMs = 0;
    for (const r of results) {
      const answered = r.chosen != null || r.ms != null,
        hasMs = typeof r.ms === 'number' && Number.isFinite(r.ms);
      if (r.correct) out.correct++;
      if (!answered) out.unanswered++;
      if (hasMs) {
        timed++;
        totalMs += r.ms;
        if (paceMs && r.ms > paceMs) out.overPace++;
        if (!r.correct) {
          if (paceMs && r.ms > paceMs) out.slowWrong++;
          else out.fastWrong++;
        }
      } else if (!r.correct && !answered) out.slowWrong++;
      tally(out.byCategory, r.category, r.correct);
      tally(out.byTopic, r.topic, r.correct, { category: r.category });
    }
    out.accuracy = out.n ? out.correct / out.n : 0;
    out.msPerItem = timed ? Math.round(totalMs / timed) : 0;
    return out;
  }
  // One cs-dat-log row (DESIGN §4). `source` is 'drill' unless the run says otherwise.
  function logRow(run, entry, now) {
    return {
      qId: entry.id,
      section: entry.section,
      category: entry.category,
      topic: entry.topic,
      correct: !!entry.correct,
      conf: entry.conf ?? null,
      ms: typeof entry.ms === 'number' ? entry.ms : null,
      ts: entry.ts ?? now ?? Date.now(),
      attemptId: run?.attemptId ?? null,
      source: run?.source || 'drill',
    };
  }

  /* ---------- spaced review (SM-2, copied from mcat.js:35-59; clock injected) ---------- */
  function srsRec(srs, id) {
    if (!srs[id]) srs[id] = { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: 0, last: 0 };
    return srs[id];
  }
  function schedule(rec, rating, now = Date.now()) {
    if (rating === 'again') {
      rec.ease = Math.max(1.3, rec.ease - 0.2);
      rec.reps = 0;
      rec.interval = 0;
      rec.lapses++;
      rec.due = now + 60000;
    } else {
      if (rating === 'hard') rec.ease = Math.max(1.3, rec.ease - 0.15);
      if (rating === 'easy') rec.ease = rec.ease + 0.15;
      let i;
      if (rec.reps === 0) i = rating === 'easy' ? 3 : 1;
      else if (rec.reps === 1) i = rating === 'hard' ? 3 : rating === 'easy' ? 6 : 3;
      else i = rec.interval * (rating === 'hard' ? 1.2 : rating === 'easy' ? rec.ease * 1.3 : rec.ease);
      rec.interval = Math.max(1, Math.round(i));
      rec.reps++;
      rec.due = now + rec.interval * DAY;
    }
    rec.last = now;
    return rec;
  }
  function dueMistakes(srs, now = Date.now()) {
    return Object.entries(srs || {})
      .filter(([, rec]) => rec && Number.isFinite(rec.due) && rec.due <= now)
      .sort((a, b) => a[1].due - b[1].due)
      .map(([id, rec]) => Object.assign({ id }, rec));
  }
  // A missed item enters the log due in one minute; a repeat miss lapses the existing record.
  function enroll(srs, item, now = Date.now()) {
    const tags = { section: item.section, category: item.category, topic: item.topic };
    if (srs[item.id]) return Object.assign(schedule(srs[item.id], 'again', now), tags);
    srs[item.id] = Object.assign({ ease: 2.5, interval: 0, reps: 0, lapses: 0, due: now + 60000, last: now }, tags);
    return srs[item.id];
  }

  const api = {
    DAY,
    rng,
    shuffle,
    orderOptions,
    pool,
    groupSets,
    mixedSections,
    pace,
    policyKey,
    letters,
    summary,
    logRow,
    srsRec,
    schedule,
    dueMistakes,
    enroll,
  };
  root.DatDrillCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
