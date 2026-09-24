/* DAT schedule (DAT-07). Pure UMD, no DOM: a date-driven plan from a test date and weekly
   hours. Phases are 60/25/15 of the span, clamped to the reported 55–70 / 20–30 / 15–25
   ranges (RESEARCH §8.2). Study days get a PAT set, one science drill and an alternating
   quantitative or reading block; anything not in `features` is left out. Extra drills fill
   the hours and, once there is a signal, aim at the weakest section. Official scores
   (200–600, PAT included) lead the next study day. Node tests require() this file. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const SECTIONS = ['bio', 'gchem', 'ochem', 'pat', 'rc', 'qr'];
  const SNS = ['bio', 'gchem', 'ochem'];
  const TASK_TYPES = ['drill', 'pat', 'qr', 'rc', 'course', 'rehearsal', 'repair'];
  const PHASES = [
    { id: 'content', frac: 0.6, min: 0.55, max: 0.7 },
    { id: 'mixed', frac: 0.25, min: 0.2, max: 0.3 },
    { id: 'execution', frac: 0.15, min: 0.15, max: 0.25 },
  ];
  const PHASE_LEVEL = { content: 1, mixed: 2, execution: 3 };
  const SECTION_NAME = {
    bio: 'Biology',
    gchem: 'General chemistry',
    ochem: 'Organic chemistry',
    pat: 'Perceptual ability',
    rc: 'Reading comprehension',
    qr: 'Quantitative reasoning',
  };
  const PAT_NAME = {
    keyholes: 'Apertures',
    tfe: 'View recognition',
    angles: 'Angle ranking',
    holes: 'Paper folding',
    cubes: 'Cube counting',
    patterns: 'Pattern folding',
  };
  const PAT_ORDER = ['keyholes', 'tfe', 'angles', 'holes', 'cubes', 'patterns'];
  const PAT_SECONDS = { keyholes: 45, tfe: 45, angles: 22, holes: 25, cubes: 40, patterns: 60 };
  const SNS_PACE = 54;
  const QR_PACE = 67;

  function parseISO(iso) {
    const [y, m, d] = String(iso || '')
      .split('-')
      .map(Number);
    if (!y || !m || !d) return NaN;
    return Date.UTC(y, m - 1, d);
  }
  function fmt(ms) {
    return new Date(ms).toISOString().slice(0, 10);
  }
  function addDays(iso, n) {
    return fmt(parseISO(iso) + n * DAY);
  }
  function daysBetween(a, b) {
    return Math.round((parseISO(b) - parseISO(a)) / DAY);
  }
  function isISO(iso) {
    return (
      typeof iso === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(iso) &&
      Number.isFinite(parseISO(iso)) &&
      fmt(parseISO(iso)) === iso
    );
  }
  function weekday(iso) {
    return WEEKDAYS[new Date(parseISO(iso)).getUTCDay()];
  }
  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }
  function minutesOf(tasks) {
    return (tasks || []).reduce((n, t) => n + (t.minutes || 0), 0);
  }
  function sumDays(days, dates) {
    return dates.reduce((n, d) => n + minutesOf(days[d]), 0);
  }

  /* Calendar lengths for the three phases. Defaults are 60/25/15; each phase is then
     pulled inside its reported range when the span is long enough for all three floors
     to fit. A span too short for that keeps the rounded split so the days still add up. */
  function phaseLengths(span) {
    if (span < 1) return [0, 0, 0];
    const mins = PHASES.map(p => Math.ceil(span * p.min - 1e-9));
    const maxs = PHASES.map(p => Math.floor(span * p.max + 1e-9));
    const clampable = mins.every((m, i) => m <= maxs[i]) && mins.reduce((a, b) => a + b, 0) <= span;
    let days = PHASES.map((p, i) => {
      const target = Math.round(span * p.frac);
      return clampable ? clamp(target, mins[i], maxs[i]) : target;
    });
    for (let guard = 0; guard < span + 5; guard++) {
      const sum = days.reduce((a, b) => a + b, 0);
      if (sum === span) return days;
      if (sum > span) {
        let idx = -1,
          best = -Infinity;
        days.forEach((d, i) => {
          if (clampable && d <= mins[i]) return;
          const over = d - span * PHASES[i].frac;
          if (over > best && d > 0) {
            best = over;
            idx = i;
          }
        });
        if (idx < 0) break;
        days[idx]--;
      } else {
        let idx = -1,
          best = -Infinity;
        days.forEach((d, i) => {
          if (clampable && d >= maxs[i]) return;
          const under = span * PHASES[i].frac - d;
          if (under > best) {
            best = under;
            idx = i;
          }
        });
        if (idx < 0) break;
        days[idx]++;
      }
    }
    days = PHASES.map(p => Math.round(span * p.frac));
    days[2] = span - days[0] - days[1];
    if (days[2] < 0) {
      days[0] = Math.max(0, days[0] + days[2]);
      days[2] = 0;
    }
    return days;
  }

  function phasesFor(start, lengths) {
    const phases = [];
    let cursor = 0;
    lengths.forEach((n, i) => {
      if (n <= 0) return;
      phases.push({ id: PHASES[i].id, from: addDays(start, cursor), to: addDays(start, cursor + n - 1) });
      cursor += n;
    });
    return phases;
  }
  function phaseOn(phases, iso) {
    return (phases.find(p => iso >= p.from && iso <= p.to) || phases[0]).id;
  }
  function weekMonday(iso) {
    const idx = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday(iso));
    return addDays(iso, -idx);
  }
  function validScores(scores) {
    return (
      !!scores &&
      typeof scores === 'object' &&
      SECTIONS.every(s => Number.isInteger(scores[s]) && scores[s] >= 200 && scores[s] <= 600 && scores[s] % 10 === 0)
    );
  }
  function latestExam(evidence) {
    const exams = evidence?.exams || [];
    for (let i = exams.length - 1; i >= 0; i--) if (validScores(exams[i]?.scores)) return exams[i];
    return null;
  }
  function lowest(keys, scoreOf) {
    let best = null,
      bestScore = Infinity;
    for (const key of keys) {
      const score = scoreOf(key);
      if (score == null || !Number.isFinite(score)) continue;
      if (score < bestScore) {
        best = key;
        bestScore = score;
      }
    }
    return best;
  }
  function spread(keys, scoreOf) {
    const scores = keys.map(scoreOf).filter(n => n != null && Number.isFinite(n));
    return scores.length >= 2 && Math.min(...scores) !== Math.max(...scores);
  }
  /* Official scores lead the day. PAT is one of the six, same as the sciences. */
  function focusSection(inputs, evidence) {
    const exam = latestExam(evidence);
    if (!exam) return null;
    return lowest(SECTIONS, s => exam.scores[s]);
  }
  function logRows(evidence) {
    return Array.isArray(evidence?.log) ? evidence.log : [];
  }
  function accuracy(log, section) {
    const rows = log.filter(r => r && r.section === section && !r.unanswered);
    if (!rows.length) return null;
    return rows.filter(r => r.correct).length / rows.length;
  }
  /* Which science the drills should hammer. Exam scores win, then rolling accuracy
     once 60 items are logged, then a background rating that is not flat. */
  function drillSignal(inputs, evidence) {
    const exam = latestExam(evidence);
    if (exam && spread(SNS, s => exam.scores[s])) return lowest(SNS, s => exam.scores[s]);
    if (exam) {
      const only = lowest(SNS, s => exam.scores[s]);
      if (only && SNS.filter(s => exam.scores[s] === exam.scores[only]).length === 1) return only;
    }
    const log = logRows(evidence);
    if (log.length >= 60 && spread(SNS, s => accuracy(log, s))) return lowest(SNS, s => accuracy(log, s));
    const bg = inputs?.background || {};
    if (spread(SNS, s => (Number.isFinite(bg[s]) ? bg[s] : null))) return lowest(SNS, s => bg[s]);
    return null;
  }
  function patSets(log) {
    const groups = new Map();
    for (const row of log) {
      if (!row || row.section !== 'pat' || !row.subtest || !row.attemptId) continue;
      if (!groups.has(row.attemptId)) groups.set(row.attemptId, []);
      groups.get(row.attemptId).push(row);
    }
    return [...groups.values()].map(rows => ({
      subtest: rows[0].subtest,
      level: Number(rows[0].level) || 1,
      n: rows.length,
      correct: rows.filter(r => r.correct).length,
      ms: rows.reduce((n, r) => n + (Number(r.ms) || 0), 0),
      timed: rows.every(r => Number.isFinite(r.ms)),
    }));
  }
  /* Level is the phase (1 / 2 / 3) unless two finished sets at the current level were
     both at least 13/15 and inside the subtest's time budget — then it steps up. */
  function rampLevel(subtest, log, seconds) {
    let level = 1;
    const sets = patSets(log).filter(s => s.subtest === subtest && s.n >= 15 && s.timed);
    for (const L of [1, 2]) {
      const good = sets.filter(s => s.level === L && s.correct / s.n >= 13 / 15 && s.ms <= seconds * s.n * 1000);
      if (good.length >= 2) level = L + 1;
    }
    return level;
  }
  function patSecondsOf(evidence, subtest) {
    const from = evidence?.patSeconds?.[subtest];
    return Number.isFinite(from) && from > 0 ? from : PAT_SECONDS[subtest] || 40;
  }
  function task(fields) {
    const row = Object.assign({ minutes: 1 }, fields);
    if (row.type === 'drill') row.label = `${SECTION_NAME[row.section] || row.section} drill · ${row.n} items`;
    else if (row.type === 'pat') row.label = `${PAT_NAME[row.subtest] || row.subtest} · level ${row.level}`;
    else if (row.type === 'qr') row.label = `Quantitative reasoning · ${row.n} items`;
    else if (row.type === 'rc') row.label = 'Reading passage';
    else if (row.type === 'course') row.label = row.title || 'Lesson';
    else if (row.type === 'rehearsal') row.label = 'Full-length rehearsal';
    else if (row.type === 'repair') row.label = 'Concept repair';
    if (row.type === 'drill') row.params = { view: 'drill', section: row.section, n: row.n, mode: 'paced' };
    else if (row.type === 'pat') row.params = { view: 'pat', subtest: row.subtest, level: row.level, n: row.n };
    else if (row.type === 'qr') row.params = { view: 'qr', n: row.n, mode: 'paced' };
    else if (row.type === 'rc') row.params = row.passage ? { view: 'rc', passage: row.passage } : { view: 'rc' };
    else if (row.type === 'course') row.params = { view: 'course', unit: row.unit };
    else if (row.type === 'rehearsal') row.params = { view: 'rehearsal' };
    else if (row.type === 'repair') row.params = { view: 'repair' };
    return row;
  }
  function syncDrill(row) {
    row.n = Math.max(1, Math.round((row.minutes * 60) / SNS_PACE));
    row.label = `${SECTION_NAME[row.section] || row.section} drill · ${row.n} items`;
    if (row.params) row.params.n = row.n;
  }
  function drillTask(section, minutes, id) {
    const mins = Math.max(1, Math.round(minutes));
    const n = Math.max(1, Math.round((mins * 60) / SNS_PACE));
    return task({ id, type: 'drill', section, n, minutes: mins });
  }
  function isLead(row, focus) {
    if (!focus) return false;
    if (row.type === 'drill' && row.section === focus) return true;
    if (row.type === 'pat' && focus === 'pat') return true;
    if (row.type === 'qr' && focus === 'qr') return true;
    if (row.type === 'rc' && focus === 'rc') return true;
    return false;
  }
  function orderFocus(rows, focus) {
    if (!focus) return rows;
    return rows.filter(r => isLead(r, focus)).concat(rows.filter(r => !isLead(r, focus)));
  }

  function balance(days, dates, target, sectionFor, allowDrill, focus, extraCounter) {
    if (!dates.length || target <= 0) return;
    const sum = () => sumDays(days, dates);
    const droppable = ['repair', 'rehearsal', 'course', 'rc', 'qr', 'pat', 'drill'];
    for (const type of droppable) {
      if (sum() <= target * 1.05) break;
      for (const date of dates) {
        const list = days[date];
        for (let i = list.length - 1; i >= 0 && sum() > target * 1.05; i--) {
          if (list[i].type === type && list.length > 1 && !isLead(list[i], focus)) list.splice(i, 1);
        }
      }
    }
    if (sum() > target * 1.05) {
      for (const date of dates) {
        for (const row of days[date]) {
          if (!['drill', 'pat', 'qr'].includes(row.type)) continue;
          const pace = (row.minutes * 60) / row.n;
          while (row.minutes > 1 && sum() > target * 1.05) {
            row.minutes -= 1;
            if (row.type === 'drill') syncDrill(row);
            else {
              row.n = Math.max(1, Math.round((row.minutes * 60) / pace));
              Object.assign(row, task(row));
            }
          }
        }
      }
    }
    if (!allowDrill) return;
    let guard = 0;
    while (sum() < target * 0.95 && guard++ < dates.length * 80 + target) {
      let progressed = false;
      for (let i = 0; i < dates.length && sum() < target * 0.95; i++) {
        const date = dates[i];
        const have = sum();
        const room = Math.floor(target * 1.05) - have;
        if (room < 1) return;
        const share = target / dates.length;
        const daySum = minutesOf(days[date]);
        if (daySum + 18 <= share + 18 && target - have >= 18 && room >= 18) {
          extraCounter.n += 1;
          days[date].push(drillTask(sectionFor(date), 18, `drill-${sectionFor(date)}-x${extraCounter.n}`));
          progressed = true;
          continue;
        }
        const drills = days[date].filter(r => r.type === 'drill');
        const last = drills[drills.length - 1];
        if (last) {
          last.minutes += 1;
          syncDrill(last);
          progressed = true;
        } else if (room >= 1) {
          extraCounter.n += 1;
          days[date].push(
            drillTask(sectionFor(date), Math.min(18, room), `drill-${sectionFor(date)}-x${extraCounter.n}`)
          );
          progressed = true;
        }
      }
      if (!progressed) break;
    }
  }

  function normalize(inputs) {
    const src = inputs || {};
    const startDate = src.startDate;
    const testDate = src.testDate;
    const hoursPerWeek = Math.round(Number(src.hoursPerWeek));
    const daysOff = [...new Set((src.daysOff || ['Sun']).filter(d => WEEKDAYS.includes(d)))];
    const features = [...new Set((src.features || []).filter(f => TASK_TYPES.includes(f)))];
    const background = {};
    for (const s of SECTIONS) {
      const n = Number(src.background?.[s]);
      background[s] = Number.isFinite(n) ? clamp(Math.round(n), 1, 3) : 2;
    }
    return {
      startDate,
      testDate,
      hoursPerWeek,
      daysOff,
      features,
      background,
      accommodations: !!src.accommodations,
    };
  }

  function build(inputs, evidence) {
    const ev = evidence || {};
    const spec = normalize(inputs);
    if (!isISO(spec.startDate) || !isISO(spec.testDate)) return null;
    const span = daysBetween(spec.startDate, spec.testDate);
    if (span < 1 || !Number.isInteger(spec.hoursPerWeek) || spec.hoursPerWeek < 1 || spec.hoursPerWeek > 60)
      return null;
    if (spec.daysOff.length >= 7) return null;
    const lengths = phaseLengths(span);
    const phases = phasesFor(spec.startDate, lengths);
    const dates = Array.from({ length: span }, (_, i) => addDays(spec.startDate, i));
    const study = dates.filter(d => !spec.daysOff.includes(weekday(d)));
    if (!study.length) return null;
    const features = new Set(spec.features);
    const focus = features.size ? focusSection(spec, ev) : null;
    const signal = drillSignal(spec, ev);
    const log = logRows(ev);
    const subtests = (ev.patSubtests || PAT_ORDER).filter(id => PAT_ORDER.includes(id));
    const passages = (ev.passages || []).filter(id => typeof id === 'string' && id);
    const units = (ev.units || []).filter(u => u && u.id);
    const qrPace = Number(ev.pace?.qr) > 0 ? ev.pace.qr : QR_PACE;
    const days = {};
    const sectionFor = {};
    const repairWeeks = new Set();
    const rehearsalWeeks = new Set();
    let unitCursor = 0;
    let passageCursor = 0;
    study.forEach((date, index) => {
      const phase = phaseOn(phases, date);
      const section = signal || SNS[index % SNS.length];
      sectionFor[date] = section;
      const rows = [];
      if (features.has('pat') && subtests.length) {
        const sub = subtests[index % subtests.length];
        const seconds = patSecondsOf(ev, sub);
        const level = clamp(Math.max(PHASE_LEVEL[phase] || 1, rampLevel(sub, log, seconds)), 1, 3);
        const mins = Math.max(5, Math.round((15 * seconds) / 60));
        rows.push(task({ id: `pat-${sub}`, type: 'pat', subtest: sub, level, n: 15, minutes: mins }));
      }
      if (features.has('drill')) rows.push(drillTask(section, 18, `drill-${section}`));
      const wantQr = focus === 'qr' || (focus !== 'rc' && index % 2 === 0);
      const wantRc = focus === 'rc' || (focus !== 'qr' && index % 2 === 1);
      if (features.has('qr') && wantQr) {
        const n = 15;
        rows.push(task({ id: 'qr-mixed', type: 'qr', n, minutes: Math.max(5, Math.round((n * qrPace) / 60)) }));
      } else if (features.has('rc') && wantRc) {
        const passage = passages.length ? passages[passageCursor++ % passages.length] : '';
        rows.push(task({ id: passage ? `rc-${passage}` : 'rc-block', type: 'rc', passage, minutes: 20 }));
      } else if (features.has('qr')) {
        const n = 15;
        rows.push(task({ id: 'qr-mixed', type: 'qr', n, minutes: Math.max(5, Math.round((n * qrPace) / 60)) }));
      } else if (features.has('rc')) {
        const passage = passages.length ? passages[passageCursor++ % passages.length] : '';
        rows.push(task({ id: passage ? `rc-${passage}` : 'rc-block', type: 'rc', passage, minutes: 20 }));
      }
      const ordered = orderFocus(rows, focus);
      if (features.has('course') && unitCursor < units.length) {
        const unit = units[unitCursor++];
        ordered.push(task({ id: `course-${unit.id}`, type: 'course', unit: unit.id, title: unit.title, minutes: 25 }));
      }
      const week = weekMonday(date);
      if (features.has('repair') && !repairWeeks.has(week)) {
        repairWeeks.add(week);
        ordered.push(task({ id: 'repair', type: 'repair', minutes: 15 }));
      }
      if (features.has('rehearsal') && phase === 'execution' && !rehearsalWeeks.has(week)) {
        rehearsalWeeks.add(week);
        ordered.push(task({ id: 'rehearsal', type: 'rehearsal', minutes: 60 }));
      }
      days[date] = ordered;
    });
    // Round once at the task allocator's minute precision, including partial weeks.
    const target = Math.max(1, Math.round((span * spec.hoursPerWeek * 60) / 7));
    const totalHours = target / 60;
    const extraCounter = { n: 0 };
    study.forEach((date, i) => {
      const budget = Math.round((target * (i + 1)) / study.length) - Math.round((target * i) / study.length);
      balance(days, [date], budget, d => sectionFor[d], features.has('drill'), focus, extraCounter);
    });
    const warnings = [];
    const plannedMinutes = sumDays(days, study);
    if (plannedMinutes > target * 1.05)
      warnings.push(
        `The shortest available blocks total about ${Math.round(plannedMinutes / 6) / 10} hours, above your ${Math.round(totalHours * 10) / 10}-hour budget. Increase your hours or choose fewer study days.`
      );
    if (totalHours < 150 || totalHours > 400)
      warnings.push(
        `This plan is about ${Math.round(totalHours * 10) / 10} hours. Reported preparation time runs from 150 to 400 hours.`
      );
    const plan = {
      version: 1,
      createdAt: Number.isFinite(ev.now) ? ev.now : Date.now(),
      testDate: spec.testDate,
      startDate: spec.startDate,
      hoursPerWeek: spec.hoursPerWeek,
      daysOff: spec.daysOff,
      accommodations: spec.accommodations,
      background: spec.background,
      features: spec.features,
      phases,
      days,
      done: {},
      exams: (ev.exams || [])
        .filter(e => validScores(e?.scores))
        .map(e => ({
          id: String(e.id || 'exam'),
          date: isISO(e.date) ? e.date : spec.startDate,
          source: e.source || 'official-practice',
          scores: Object.assign({}, e.scores),
        })),
      totalHours,
    };
    if (focus) plan.focus = focus;
    if (warnings.length) plan.warnings = warnings;
    if (spec.accommodations)
      plan.reminder =
        'File testing accommodations at least 60 days before your test date. Approval has to arrive before you book.';
    return plan;
  }

  // The Today card shows the day's template (PAT, science drill, QR or reading), not the
  // extra drills that exist only to fill the weekly hours.
  function cardTasks(plan, iso) {
    const tasks = (plan?.days && plan.days[iso]) || [];
    return tasks.filter(t => !/-x\d+$/.test(t.id)).slice(0, 3);
  }
  function todayTasks(plan, iso, limit) {
    if (!plan || !plan.days) return [];
    const tasks = plan.days[iso] || [];
    const open = tasks.filter(t => !plan.done || !plan.done[`${iso}:${t.id}`]);
    return Number.isFinite(limit) ? open.slice(0, limit) : open;
  }
  function anchorDate(plan, iso) {
    const dates = Object.keys(plan?.days || {}).sort();
    if (!dates.length) return null;
    if (plan.days[iso]) return iso;
    return dates.find(d => d >= iso) || null;
  }
  function markDone(plan, date, taskId, now) {
    const next = JSON.parse(JSON.stringify(plan));
    next.done = Object.assign({}, next.done, { [`${date}:${taskId}`]: now });
    return next;
  }
  function inputsFrom(plan) {
    return {
      testDate: plan.testDate,
      startDate: plan.startDate,
      hoursPerWeek: plan.hoursPerWeek,
      daysOff: plan.daysOff,
      accommodations: plan.accommodations,
      background: plan.background,
      features: plan.features,
    };
  }
  function regenerate(plan, inputs, evidence) {
    if (!plan) return null;
    const ev = Object.assign({}, evidence || {});
    if (!ev.exams && plan.exams) ev.exams = plan.exams;
    const next = build(Object.assign(inputsFrom(plan), inputs || {}), ev);
    if (!next) return null;
    next.done = Object.assign({}, plan.done);
    if (plan.createdAt) next.createdAt = plan.createdAt;
    return next;
  }

  function validTask(row) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
    if (typeof row.id !== 'string' || !row.id || /[<:]/.test(row.id)) return false;
    if (!TASK_TYPES.includes(row.type)) return false;
    if (!Number.isFinite(row.minutes) || row.minutes <= 0) return false;
    if (row.label != null && typeof row.label !== 'string') return false;
    if (['drill', 'pat', 'qr'].includes(row.type) && (!Number.isInteger(row.n) || row.n < 1 || row.n > 100))
      return false;
    if (row.type === 'drill' && !SNS.includes(row.section)) return false;
    if (
      row.type === 'pat' &&
      (!PAT_ORDER.includes(row.subtest) || !Number.isInteger(row.level) || row.level < 1 || row.level > 3 || row.n > 90)
    )
      return false;
    if (row.type === 'rc' && row.passage != null && typeof row.passage !== 'string') return false;
    if (row.type === 'course' && (typeof row.unit !== 'string' || !row.unit)) return false;
    if (!row.params || typeof row.params !== 'object' || Array.isArray(row.params)) return false;
    const params = task(row).params;
    return (
      Object.keys(row.params).length === Object.keys(params).length &&
      Object.entries(params).every(([key, value]) => row.params[key] === value)
    );
  }
  /* Validate every field the page consumes before rendering imported or stored data.
     Invalid JSON shapes return false, including null entries inside collections. */
  function validPlan(plan) {
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return false;
    if (plan.version !== 1) return false;
    if (!isISO(plan.startDate) || !isISO(plan.testDate) || daysBetween(plan.startDate, plan.testDate) < 1) return false;
    if (!Number.isInteger(plan.hoursPerWeek) || plan.hoursPerWeek < 1 || plan.hoursPerWeek > 60) return false;
    if (
      !Array.isArray(plan.daysOff) ||
      plan.daysOff.length >= 7 ||
      plan.daysOff.some(d => !WEEKDAYS.includes(d)) ||
      new Set(plan.daysOff).size !== plan.daysOff.length
    )
      return false;
    if (!Array.isArray(plan.features) || plan.features.some(f => !TASK_TYPES.includes(f))) return false;
    if (!Array.isArray(plan.phases) || !plan.phases.length) return false;
    let cursor = plan.startDate;
    let phaseIndex = -1;
    for (const phase of plan.phases) {
      if (!phase || typeof phase !== 'object') return false;
      const index = PHASES.findIndex(p => p.id === phase.id);
      if (
        index <= phaseIndex ||
        !isISO(phase.from) ||
        !isISO(phase.to) ||
        phase.from !== cursor ||
        phase.from > phase.to ||
        phase.to >= plan.testDate
      )
        return false;
      cursor = addDays(phase.to, 1);
      phaseIndex = index;
    }
    if (cursor !== plan.testDate) return false;
    if (!plan.days || typeof plan.days !== 'object' || Array.isArray(plan.days)) return false;
    const span = daysBetween(plan.startDate, plan.testDate);
    let studyDays = Math.floor(span / 7) * (7 - plan.daysOff.length);
    for (let i = 0; i < span % 7; i++) if (!plan.daysOff.includes(weekday(addDays(plan.startDate, i)))) studyDays++;
    if (!studyDays || Object.keys(plan.days).length !== studyDays) return false;
    for (const [date, tasks] of Object.entries(plan.days)) {
      if (
        !isISO(date) ||
        date < plan.startDate ||
        date >= plan.testDate ||
        plan.daysOff.includes(weekday(date)) ||
        !Array.isArray(tasks) ||
        tasks.some(t => !validTask(t) || !plan.features.includes(t.type)) ||
        new Set(tasks.map(t => t.id)).size !== tasks.length
      )
        return false;
    }
    if (!plan.done || typeof plan.done !== 'object' || Array.isArray(plan.done)) return false;
    for (const stamp of Object.values(plan.done)) if (!Number.isFinite(stamp)) return false;
    if (plan.exams != null) {
      if (!Array.isArray(plan.exams)) return false;
      for (const exam of plan.exams) if (!validScores(exam?.scores)) return false;
    }
    if (!Number.isFinite(plan.totalHours) || plan.totalHours <= 0) return false;
    if (plan.focus != null && !SECTIONS.includes(plan.focus)) return false;
    if (plan.warnings != null && (!Array.isArray(plan.warnings) || plan.warnings.some(w => typeof w !== 'string')))
      return false;
    if (plan.reminder != null && typeof plan.reminder !== 'string') return false;
    return true;
  }

  const api = {
    WEEKDAYS,
    SECTIONS,
    TASK_TYPES,
    SECTION_NAME,
    build,
    cardTasks,
    todayTasks,
    anchorDate,
    markDone,
    regenerate,
    validPlan,
    focusSection,
    daysBetween,
    addDays,
    weekday,
    phaseLengths,
  };
  root.DatPlanCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
