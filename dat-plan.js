/* DAT schedule page (DAT-07). Setup, week grid and the Today card. Reads cs-dat-plan.
   Launch links carry the runner params. A damaged plan is cleared and replaced with a
   notice; saving is refused before a bad plan can be written. */
(function () {
  'use strict';
  const KEY = 'cs-dat-plan';
  const Core = window.DatPlanCore;
  const PHASE_LABEL = { content: 'Content', mixed: 'Mixed practice', execution: 'Exam execution' };
  let clearedNotice = false;
  let weekIndex = 0;
  let weekPinned = false;
  let formError = '';

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function pretty(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }
  function mondayOf(iso) {
    const idx = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(Core.weekday(iso));
    return Core.addDays(iso, -idx);
  }
  function weeksOf(plan) {
    const weeks = [];
    let cursor = mondayOf(plan.startDate);
    const last = Core.addDays(plan.testDate, -1);
    while (cursor <= last) {
      const days = [];
      for (let i = 0; i < 7; i++) {
        const date = Core.addDays(cursor, i);
        if (date >= plan.startDate && date < plan.testDate) days.push(date);
      }
      if (days.length) weeks.push(days);
      cursor = Core.addDays(cursor, 7);
    }
    return weeks;
  }
  function phaseOf(plan, iso) {
    return plan.phases.find(p => iso >= p.from && iso <= p.to)?.id || '';
  }
  function liveFeatures() {
    const features = [];
    if (window.DatPractice) features.push('drill');
    if (window.DatPat) features.push('pat');
    if (window.DatQr) features.push('qr');
    if (window.DatRc) features.push('rc');
    if (typeof window.renderDatCourseHome === 'function') features.push('course');
    if (window.DatRehearsal) features.push('rehearsal');
    if (typeof window.renderDatRepairHub === 'function') features.push('repair');
    return features;
  }
  function evidence() {
    const stored = StudyStorage.read('cs-dat-log', []);
    const log = window.DAT?.attemptStores?.log || stored;
    const patSeconds = {};
    for (const sub of window.DAT?.outline?.patSubtests || []) patSeconds[sub.id] = sub.seconds;
    return {
      log: Array.isArray(log) ? log : [],
      passages: (window.DAT?.rc?.passages || []).map(p => p.id).filter(Boolean),
      patSubtests: window.DatPatCore?.BUILT,
      patSeconds,
      units: (window.DAT?.course?.units || []).map(u => ({ id: u.id, title: u.title })).filter(u => u.id),
      pace: window.DAT?.outline?.pacingSeconds || null,
    };
  }
  function loadPlan() {
    if (!Core) return null;
    const raw = StudyStorage.read(KEY, null);
    if (raw == null) return null;
    if (!Core.validPlan(raw)) {
      clearedNotice = true;
      StudyStorage.write(KEY, null);
      return null;
    }
    return raw;
  }
  function persist(plan) {
    if (!Core.validPlan(plan)) return false;
    return StudyStorage.write(KEY, plan);
  }
  function scoreLine(scores) {
    const score = window.DatScoreCore;
    if (!score?.academicAverage || !score?.totalScience) return '';
    try {
      const aa = score.academicAverage(scores);
      const ts = score.totalScience({ bio: scores.bio, gchem: scores.gchem, ochem: scores.ochem });
      if (aa == null && ts == null) return '';
      return `Academic average ${aa ?? '—'} · Total science ${ts ?? '—'}. These are estimates, not ADA scores.`;
    } catch {
      return '';
    }
  }
  function taskLink(row, solid) {
    return `<a class="btn${solid ? ' btn-solid' : ''}" data-dat-go href="${esc(datUrl(row.params || { view: row.type }))}">${esc(row.label || row.type)}</a>`;
  }
  function doneKey(date, id) {
    return `${date}:${id}`;
  }
  function taskRow(plan, date, row) {
    const done = plan.done[doneKey(date, row.id)];
    return `<li class="${done ? 'is-done' : ''}">${taskLink(row, false)}<small>${row.minutes} min${done ? ' · done' : ''}</small>${done ? '' : `<button class="btn" type="button" data-dat-plan-done="${esc(date)}:${esc(row.id)}">Mark done</button>`}</li>`;
  }

  function formHtml(plan) {
    const start = plan?.startDate || todayISO();
    const test = plan?.testDate || Core.addDays(start, 70);
    const hours = plan?.hoursPerWeek || 22;
    const off = new Set(plan?.daysOff || ['Sun']);
    const bg = plan?.background || {};
    const days = Core.WEEKDAYS.map(
      d => `<label><input type="checkbox" name="dat-plan-off" value="${d}"${off.has(d) ? ' checked' : ''}> ${d}</label>`
    ).join('');
    const backgrounds = Core.SECTIONS.map(s => {
      const value = bg[s] || 2;
      const options = [1, 2, 3]
        .map(
          n =>
            `<option value="${n}"${n === value ? ' selected' : ''}>${n === 1 ? 'Shaky' : n === 2 ? 'Okay' : 'Solid'}</option>`
        )
        .join('');
      return `<label>${esc(Core.SECTION_NAME[s])}<select id="dat-plan-bg-${s}">${options}</select></label>`;
    }).join('');
    return `<form id="dat-plan-form" class="dat-plan-form">
      <div class="dat-plan-fields">
        <label for="dat-plan-start">Start date<input id="dat-plan-start" type="date" required value="${esc(start)}"></label>
        <label for="dat-plan-date">Test date<input id="dat-plan-date" type="date" required value="${esc(test)}"></label>
        <label for="dat-plan-hours">Hours per week<input id="dat-plan-hours" type="number" min="1" max="60" step="1" required value="${hours}"></label>
      </div>
      <fieldset class="dat-plan-off"><legend>Days you do not study</legend>${days}</fieldset>
      <label class="dat-plan-acc"><input id="dat-plan-acc" type="checkbox"${plan?.accommodations ? ' checked' : ''}> I need to request testing accommodations</label>
      <details class="dat-plan-bg"><summary>Background, if you want the drills aimed</summary><div>${backgrounds}</div><p>1 is shaky, 3 is solid. Leave these alone and the schedule rotates the sciences.</p></details>
      <p id="dat-plan-error" class="dat-plan-error" role="alert">${esc(formError)}</p>
      <button class="btn btn-solid" type="submit">${plan ? 'Rebuild schedule' : 'Build schedule'}</button>
    </form>`;
  }
  function readInputs(form, features) {
    const startDate = form.querySelector('#dat-plan-start').value;
    const testDate = form.querySelector('#dat-plan-date').value;
    const hoursPerWeek = Number(form.querySelector('#dat-plan-hours').value);
    const daysOff = [...form.querySelectorAll('input[name="dat-plan-off"]:checked')].map(box => box.value);
    const background = {};
    for (const s of Core.SECTIONS) background[s] = Number(form.querySelector('#dat-plan-bg-' + s).value);
    return {
      startDate,
      testDate,
      hoursPerWeek,
      daysOff,
      accommodations: form.querySelector('#dat-plan-acc').checked,
      background,
      features,
    };
  }
  function scoreForm(plan) {
    const fields = Core.SECTIONS.map(
      s =>
        `<label>${esc(Core.SECTION_NAME[s])}<input id="dat-plan-score-${s}" type="number" inputmode="numeric" min="200" max="600" step="10"></label>`
    ).join('');
    const saved = (plan.exams || [])
      .map(exam => {
        const bits = Core.SECTIONS.map(s => `${Core.SECTION_NAME[s]} ${exam.scores[s]}`).join(' · ');
        const line = scoreLine(exam.scores);
        return `<li><span>${esc(bits)}</span>${line ? `<small>${esc(line)}</small>` : '<small>Academic average and total science show once score estimates are available.</small>'}</li>`;
      })
      .join('');
    return `<section class="dat-plan-scores" aria-labelledby="dat-plan-scores-title"><h2 id="dat-plan-scores-title">Scores you already have</h2>
      <p>Six section scores from 200 to 600, in steps of 10. The lowest section, perceptual ability included, leads each study day after you save.</p>
      ${saved ? `<ul class="dat-plan-score-list">${saved}</ul>` : ''}
      <form id="dat-plan-scores">${fields}<button class="btn" type="submit">Save scores</button></form></section>`;
  }
  function phaseSummary(plan) {
    return `<ol class="dat-plan-phases">${plan.phases
      .map(
        phase =>
          `<li data-dat-phase="${esc(phase.id)}"><span>${esc(PHASE_LABEL[phase.id] || phase.id)}</span> ${esc(phase.from)} – ${esc(phase.to)}</li>`
      )
      .join('')}</ol>`;
  }
  function weekHtml(plan) {
    const weeks = weeksOf(plan);
    if (!weeks.length) return '';
    if (!weekPinned)
      weekIndex = Math.max(
        0,
        weeks.findIndex(days => days.some(d => d >= todayISO()))
      );
    weekIndex = Math.min(weeks.length - 1, Math.max(0, weekIndex));
    const days = weeks[weekIndex];
    const cells = days
      .map(date => {
        const phase = phaseOf(plan, date);
        const tasks = plan.days[date] || [];
        const lead = tasks.filter(t => !/-x\d+$/.test(t.id));
        const extras = tasks.filter(t => /-x\d+$/.test(t.id));
        const extraMin = extras.reduce((n, t) => n + t.minutes, 0);
        const off = !tasks.length;
        const body = off
          ? '<p class="dat-plan-rest">Day off</p>'
          : `<ul>${lead.map(t => taskRow(plan, date, t)).join('')}</ul>${extras.length ? `<details class="dat-plan-more"><summary>+ ${extras.length} more drill${extras.length === 1 ? '' : 's'} · ${extraMin} min</summary><ul>${extras.map(t => taskRow(plan, date, t)).join('')}</ul></details>` : ''}`;
        return `<article class="dat-plan-day${off ? ' is-off' : ''}" data-dat-phase="${esc(phase)}"><header><span>${esc(pretty(date).split(',')[0])}</span><time datetime="${esc(date)}">${esc(date.slice(5))}</time></header><p class="dat-plan-phase">${esc(PHASE_LABEL[phase] || phase)}</p>${body}</article>`;
      })
      .join('');
    return `<section class="dat-plan-board" aria-labelledby="dat-plan-week-title"><div class="dat-plan-pager"><button class="btn" type="button" data-dat-plan-week="prev"${weekIndex === 0 ? ' disabled' : ''}>Previous week</button><h2 id="dat-plan-week-title">Week ${weekIndex + 1} of ${weeks.length}</h2><button class="btn" type="button" data-dat-plan-week="next"${weekIndex === weeks.length - 1 ? ' disabled' : ''}>Next week</button></div><div class="dat-plan-week">${cells}</div></section>`;
  }
  function statusHtml(plan) {
    const bits = [];
    if (plan.warnings) bits.push(`<p class="dat-plan-warn" role="status">${esc(plan.warnings.join(' '))}</p>`);
    if (plan.reminder) bits.push(`<p class="dat-plan-reminder" role="status">${esc(plan.reminder)}</p>`);
    if (plan.focus)
      bits.push(
        `<p id="dat-plan-focus" data-dat-focus="${esc(plan.focus)}">${esc(Core.SECTION_NAME[plan.focus])} leads each study day.</p>`
      );
    return bits.join('');
  }
  function wire(main, mode) {
    const form = main.querySelector('#dat-plan-form');
    if (form)
      form.onsubmit = event => {
        event.preventDefault();
        formError = '';
        const features = liveFeatures();
        if (!features.length) {
          formError = 'The practice tools have not loaded, so there is nothing to put on the schedule yet.';
          return mode === 'today' ? today() : render();
        }
        const inputs = readInputs(form, features);
        if (inputs.daysOff.length >= 7) {
          formError = 'Leave at least one day for studying.';
          return mode === 'today' ? today() : render();
        }
        const existing = loadPlan();
        const ev = evidence();
        if (existing?.exams?.length) ev.exams = existing.exams;
        const plan = existing ? Core.regenerate(existing, inputs, ev) : Core.build(inputs, ev);
        if (!plan || !Core.validPlan(plan)) {
          formError =
            'Use a test date after the start date, between 1 and 60 hours a week, and at least one study day.';
          return mode === 'today' ? today() : render();
        }
        if (!persist(plan)) {
          formError = 'The schedule could not be saved in this browser.';
          return mode === 'today' ? today() : render();
        }
        clearedNotice = false;
        weekPinned = false;
        if (mode === 'today') return today();
        render();
      };
    const scores = main.querySelector('#dat-plan-scores');
    if (scores)
      scores.onsubmit = event => {
        event.preventDefault();
        formError = '';
        const plan = loadPlan();
        if (!plan) return render();
        const values = {};
        for (const s of Core.SECTIONS) {
          const n = Number(scores.querySelector('#dat-plan-score-' + s).value);
          if (!Number.isInteger(n) || n < 200 || n > 600 || n % 10) {
            formError = 'Enter all six scores from 200 to 600, in steps of 10.';
            return render();
          }
          values[s] = n;
        }
        const exams = (plan.exams || []).concat([
          { id: 'e' + Date.now(), date: todayISO(), source: 'official-practice', scores: values },
        ]);
        const next = Core.regenerate(plan, null, Object.assign(evidence(), { exams }));
        if (!next || !Core.validPlan(next) || !persist(next)) {
          formError = 'Those scores could not be saved.';
          return render();
        }
        weekPinned = true;
        render();
      };
    main.querySelectorAll('[data-dat-plan-week]').forEach(button => {
      button.onclick = () => {
        weekPinned = true;
        weekIndex += button.getAttribute('data-dat-plan-week') === 'next' ? 1 : -1;
        render();
      };
    });
    main.querySelectorAll('[data-dat-plan-done]').forEach(button => {
      button.onclick = () => {
        const plan = loadPlan();
        if (!plan) return;
        const [date, id] = button.getAttribute('data-dat-plan-done').split(':');
        const next = Core.markDone(plan, date, id, Date.now());
        if (!persist(next)) return;
        if (mode === 'today') today();
        else render();
      };
    });
    datView(main);
  }
  function missing() {
    const main = el(
      `<main class="panel dat-notice"><h1>The schedule could not load.</h1><p class="sub">The planner module is missing. Nothing you saved has changed.</p></main>`
    );
    datView(main);
  }
  function render() {
    if (!Core) return missing();
    const plan = loadPlan();
    const notice = clearedNotice
      ? '<p id="dat-plan-cleared" class="dat-plan-warn" role="status">This schedule could not be read, so it was cleared. Nothing else you saved was changed.</p>'
      : '';
    const summary = plan
      ? `<p class="sub">About ${Math.round(plan.totalHours * 10) / 10} hours from ${esc(pretty(plan.startDate))} to ${esc(pretty(plan.testDate))}, at ${plan.hoursPerWeek} hours a week.</p>`
      : '<p class="sub">Pick a test date and how many hours a week you can study. The schedule fills those hours with the practice that is already built.</p>';
    const main = el(
      `<main class="panel dat-plan"><span class="label">DAT · Schedule</span><h1>A schedule built around your test date.</h1>${summary}${notice}${formHtml(plan)}${plan ? statusHtml(plan) + phaseSummary(plan) + weekHtml(plan) + scoreForm(plan) : ''}<p class="dat-plan-back"><a data-dat-go href="${esc(datUrl())}">Back to today</a> · <a data-dat-go href="${esc(datUrl({ view: 'home' }))}">DAT overview</a></p></main>`
    );
    wire(main, 'plan');
  }
  function today() {
    if (!Core) return false;
    const plan = loadPlan();
    if (!plan) {
      if (!clearedNotice) return false;
      render();
      return true;
    }
    const iso = todayISO();
    const anchor = Core.anchorDate(plan, iso);
    if (!anchor) {
      const main = el(
        `<main class="panel dat-today"><span class="label">DAT · Today</span><h1>This schedule has ended.</h1><p class="sub">Test date: ${esc(pretty(plan.testDate))}. Open the full schedule to review your work or set a new test date.</p><p class="dat-plan-back"><a data-dat-go href="${esc(datUrl({ view: 'plan' }))}">Full schedule</a> · <a data-dat-go href="${esc(datUrl({ view: 'home' }))}">DAT overview</a></p></main>`
      );
      wire(main, 'today');
      return true;
    }
    const tasks = Core.cardTasks(plan, anchor);
    const heading = anchor === iso ? 'Today' : 'Next study day';
    const phase = phaseOf(plan, anchor);
    const items = tasks
      .map((row, i) => {
        const done = plan.done[doneKey(anchor, row.id)];
        return `<li class="dat-today-task${done ? ' is-done' : ''}">${taskLink(row, i === 0 && !done)}${done ? '<span>Done</span>' : `<button class="btn" type="button" data-dat-plan-done="${esc(anchor)}:${esc(row.id)}">Mark done</button>`}</li>`;
      })
      .join('');
    const main = el(
      `<main class="panel dat-today"><span class="label">DAT · Today</span><h1>${heading}</h1><p class="sub">${esc(pretty(anchor))}${phase ? ` · ${esc(PHASE_LABEL[phase] || phase)}` : ''}</p>${plan.reminder ? `<p class="dat-plan-reminder" role="status">${esc(plan.reminder)}</p>` : ''}${plan.warnings ? `<p class="dat-plan-warn" role="status">${esc(plan.warnings.join(' '))}</p>` : ''}${plan.focus ? `<p id="dat-plan-focus" data-dat-focus="${esc(plan.focus)}">${esc(Core.SECTION_NAME[plan.focus])} leads each study day.</p>` : ''}<ol class="dat-today-tasks">${items}</ol><p class="dat-plan-back"><a data-dat-go href="${esc(datUrl({ view: 'plan' }))}">Full schedule</a> · <a data-dat-go href="${esc(datUrl({ view: 'home' }))}">DAT overview</a></p></main>`
    );
    wire(main, 'today');
    return true;
  }
  function reset() {
    clearedNotice = false;
    weekIndex = 0;
    weekPinned = false;
    formError = '';
  }
  window.DatPlan = { render, today, reset };
})();
