/* Academy time planning. Course records are read, never credited or rewritten. */
(() => {
  'use strict';
  const KEY = 'cs-academy-today-v1';
  const tracks = CortexAcademy.tracks;
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const activeTrack = id => tracks.some(track => track.id === id);
  // Retired course IDs remain valid in historical plans; reading never erases them.
  const validTrack = id => activeTrack(id) || id === 'cogpsych';
  const dateKey = (date = new Date()) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  function validState(value) {
    return (
      object(value) &&
      Number.isInteger(value.budget) &&
      value.budget >= 0 &&
      value.budget <= 240 &&
      value.budget % 15 === 0 &&
      Array.isArray(value.priority) &&
      value.priority.every(validTrack) &&
      new Set(value.priority).size === value.priority.length &&
      Array.isArray(value.paused) &&
      value.paused.every(validTrack) &&
      object(value.days) &&
      Object.entries(value.days).every(
        ([date, day]) =>
          /^\d{4}-\d{2}-\d{2}$/.test(date) &&
          object(day) &&
          object(day.blocks) &&
          Object.entries(day.blocks).every(
            ([id, block]) =>
              validTrack(id) &&
              object(block) &&
              Number.isFinite(block.startedAt) &&
              Number.isInteger(block.planned) &&
              block.planned >= 15 &&
              block.planned <= 240 &&
              (block.completedAt == null ||
                (Number.isFinite(block.completedAt) &&
                  Number.isInteger(block.minutes) &&
                  block.minutes >= 1 &&
                  block.minutes <= 720))
          )
      )
    );
  }
  const raw = StudyStorage.read(KEY, { version: 1, budget: 30, priority: ['mcat'], paused: [], days: {} });
  const state = validState(raw) ? raw : { version: 1, budget: 30, priority: ['mcat'], paused: [], days: {} };
  if (!validState(raw)) StudyStorage.sessionFailed();
  StudyStorage.watch(KEY, () => state);
  const save = () => StudyStorage.write(KEY, state);
  const record = date => state.days[date] || { blocks: {} };
  function plan(date = dateKey()) {
    const blocks = record(date).blocks;
    const complete = Object.entries(blocks).filter(([, block]) => block.completedAt);
    const spent = complete.reduce((sum, [, block]) => sum + block.minutes, 0);
    const eligible = state.priority.filter(
      id =>
        activeTrack(id) &&
        (IS_LOCAL_PREVIEW || tracks.find(track => track.id === id).available) &&
        !state.paused.includes(id) &&
        !blocks[id]?.completedAt
    );
    const ongoing = eligible.filter(id => blocks[id]);
    const reserved = ongoing.reduce((sum, id) => sum + blocks[id].planned, 0);
    let slots = Math.max(0, Math.floor((state.budget - spent - reserved) / 15));
    const fresh = eligible.filter(id => !blocks[id]).slice(0, slots);
    const allocation = Object.fromEntries(fresh.map(id => [id, 0]));
    for (let i = 0; i < slots && fresh.length; i++) allocation[fresh[i % fresh.length]] += 15;
    const items = eligible
      .filter(id => blocks[id] || allocation[id])
      .map(id => ({ id, minutes: blocks[id]?.planned || allocation[id], started: !!blocks[id] }));
    return {
      date,
      spent,
      reserved,
      complete,
      items,
      planned: items.reduce((sum, item) => sum + item.minutes, 0),
      deferred: eligible.filter(id => !items.some(item => item.id === id)),
      over: Math.max(0, spent + reserved - state.budget),
    };
  }
  function start(date, id, minutes) {
    if (
      StudyStorage.paused ||
      date !== dateKey() ||
      !plan(date).items.some(item => item.id === id && item.minutes === minutes)
    )
      return false;
    state.days[date] ||= { blocks: {} };
    state.days[date].blocks[id] ||= { planned: minutes, startedAt: Date.now() };
    return save();
  }
  function finish(date, id, minutes) {
    const block = state.days[date]?.blocks[id];
    if (
      StudyStorage.paused ||
      !block ||
      block.completedAt ||
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      minutes > 720
    )
      return false;
    block.minutes = minutes;
    block.completedAt = Date.now();
    return save();
  }
  function courseUrl(id, params = {}) {
    const url = new URL(sectionUrl(id), location.origin);
    for (const [key, value] of Object.entries(params)) if (value != null) url.searchParams.set(key, String(value));
    return url.pathname + url.search;
  }
  function read(key) {
    const value = StudyStorage.read(key, {});
    if (
      !object(value) ||
      ['lessons', 'units', 'completed', 'learned'].some(field => value[field] != null && !object(value[field])) ||
      (value.pathDone != null &&
        (!Array.isArray(value.pathDone) || !value.pathDone.every(id => typeof id === 'string')))
    ) {
      StudyStorage.sessionFailed();
      return {};
    }
    return value;
  }
  function evidence(now = Date.now()) {
    const result = Object.fromEntries(
      tracks.map(track => [
        track.id,
        {
          url: courseUrl(track.id),
          label: 'Open this course',
          completed: 0,
          unit: 'saved foundation completions',
          due: null,
        },
      ])
    );
    const foundation = (id, key) => {
      const lessons = read(key).lessons || {},
        entries = Object.entries(lessons);
      result[id].completed = entries.filter(([, item]) => item?.completedAt).length;
      const active = entries
        .filter(([, item]) => item && !item.completedAt)
        .sort((a, b) => (b[1].startedAt || 0) - (a[1].startedAt || 0))[0];
      if (active)
        Object.assign(result[id], {
          url: courseUrl(id, { lesson: active[0], step: (active[1].index || 0) + 1 }),
          label: active[1].content?.title || 'Resume saved lesson',
        });
    };
    foundation('anatomy', 'cs-academy-anatomy-v1');
    foundation('reference', 'cs-academy-reference-v1');
    const ltl = read('cs-ltl-progress-v1');
    for (const [track, progress] of Object.entries(ltl)) {
      if (!object(progress)) continue;
      result.socrates.completed += Object.values(progress.lessons || {}).filter(item => item?.completedAt).length;
      if (progress.lastLesson && !progress.lessons?.[progress.lastLesson]?.completedAt)
        Object.assign(result.socrates, {
          url: courseUrl('socrates', { track, lesson: progress.lastLesson, step: (progress.lastStep || 0) + 1 }),
          label: 'Continue learning methods',
        });
    }
    const shift = read('cs-clinical-shift-v1');
    result.practice.completed = Object.values(shift.completed || {}).filter(item => item?.attempts > 0).length;
    result.practice.unit = 'distinct encounters completed';
    if (shift.active?.runId)
      Object.assign(result.practice, {
        url: courseUrl('practice', { view: 'shift', run: shift.active.runId }),
        label: 'Resume saved encounter',
      });
    const timelines = read('cs-clinical-longitudinal-v1');
    result.practice.completed += new Set(
      (Array.isArray(timelines.history) ? timelines.history : [])
        .filter(run => run?.phase === 'complete' && run.completedAt)
        .map(run => run.caseData?.id)
        .filter(Boolean)
    ).size;
    if (
      timelines.active?.runId &&
      (!shift.active?.runId || (timelines.active.startedAt || 0) >= (shift.active.startedAt || 0))
    )
      Object.assign(result.practice, {
        url: courseUrl('practice', { view: 'longitudinal', run: timelines.active.runId }),
        label: 'Resume saved patient timeline',
      });
    const neuro = read('cs-neuro');
    result.neuro.completed = new Set((neuro.pathDone || []).filter(id => typeof id === 'string')).size;
    result.neuro.unit = 'recorded unit completions (including older records)';
    const neuroActive = Object.entries(neuro.units || {})
      .filter(([, item]) => item && !item.completedAt)
      .sort((a, b) => (b[1].startedAt || 0) - (a[1].startedAt || 0))[0];
    if (neuroActive)
      Object.assign(result.neuro, {
        url: courseUrl('neuro', { unit: neuroActive[0] }),
        label: neuroActive[1].content?.step?.title || 'Resume saved unit',
      });
    if (!neuroActive) {
      const unfinishedCode = item => {
        const work = item?.current,
          last = work?.attempts?.at(-1);
        return (
          work &&
          !(
            (last?.passed && last.draft === work.draft) ||
            work.manualTrace?.completedAt ||
            (typeof work.selfReview?.draft === 'string' && work.selfReview.draft === work.draft)
          )
        );
      };
      const labs = [
        ...Object.entries(neuro.simWork || {})
          .filter(([, work]) => work && !work.completedAt)
          .map(([id, work]) => ({ id, work, kind: 'sim' })),
        ...Object.entries(neuro.projects || {})
          .filter(([, item]) => item?.current && !item.current.completedAt)
          .map(([id, item]) => ({ id, work: item.current, kind: 'project' })),
        ...Object.entries(neuro.code || {})
          .filter(([, item]) => unfinishedCode(item))
          .map(([id, item]) => ({ id, work: item.current, kind: 'code' })),
      ].sort((a, b) => (b.work.startedAt || 0) - (a.work.startedAt || 0));
      if (labs[0])
        Object.assign(result.neuro, {
          url: courseUrl('neuro', {
            [labs[0].kind]: labs[0].id,
            ...(labs[0].kind === 'project' ? { run: labs[0].work.runId } : {}),
          }),
          label: labs[0].work.content?.title || 'Resume saved lab',
        });
    }
    const course = read('cs-mcat-course-v1'),
      v2 = read('cs-mcat-v2');
    result.mcat.completed = Object.values(course.units || {}).filter(item => item?.completedAt).length;
    result.mcat.due = Object.values(course.units || {}).filter(
      item => item?.dueAt && Number.isFinite(item.dueAt) && item.dueAt <= now
    ).length;
    result.mcat.url = courseUrl('mcat', { view: 'today' });
    result.mcat.label = 'Open MCAT Today';
    if (course.activeUnit)
      Object.assign(result.mcat, {
        url: courseUrl('mcat', { view: 'course', unit: course.activeUnit }),
        label: 'Resume saved MCAT lesson',
      });
    else if (v2.coach?.active && !v2.coach.active.completedAt)
      Object.assign(result.mcat, {
        url: courseUrl('mcat', { view: 'coach', run: v2.coach.active.id }),
        label: 'Resume saved passage workshop',
      });
    else if (v2.math?.active && !v2.math.active.completedAt)
      Object.assign(result.mcat, {
        url: courseUrl('mcat', { view: 'math', run: v2.math.active.id }),
        label: 'Resume saved calculation',
      });
    return result;
  }
  function render() {
    const url = courseUrl('academy', { view: 'today' });
    if (location.pathname + location.search !== url) history.pushState({}, '', url);
    const day = plan(),
      progress = evidence();
    const root = el('<div></div>');
    root.appendChild(topbar('academy'));
    const main =
      el(`<main class="panel academy-shell academy-today"><div class="academy-intro"><span class="label">Academy Today</span><h1>Make room for what you want to learn.</h1><p>One time budget across your chosen subjects. Each course keeps its own answers, checks and learning record.</p><a href="${esc(courseUrl('academy'))}" id="today-catalog">Explore all courses</a></div>
      <section class="academy-day-summary"><h2>Your day · ${esc(day.date)}</h2><p><b>${day.spent} minutes recorded</b> · ${day.planned} minutes planned · ${state.budget}-minute target</p><p>Time is self-reported. Recording a study block does not complete a lesson or change any subject score.</p>${day.over ? `<p role="status">Recorded and already-started work is ${day.over} minutes above the new target. Existing work is retained; no extra block is added.</p>` : ''}</section>
      <form id="academy-time-settings"><label for="academy-budget">Daily time target, in minutes</label><input id="academy-budget" type="number" min="0" max="240" step="15" value="${state.budget}"><button class="btn" type="submit">Save time target</button><p>Use 0 for a rest day, or 15-minute increments up to 240.</p></form>
      <section><h2>Choose your priorities</h2><p>Pause a course to leave it out of the plan. Saved work stays available.</p><div class="academy-priorities">${[
        ...state.priority.filter(activeTrack),
        ...tracks.map(track => track.id).filter(id => !state.priority.includes(id)),
      ]
        .map(id => {
          const track = tracks.find(track => track.id === id),
            selected = state.priority.includes(id),
            paused = state.paused.includes(id);
          return `<div class="academy-priority"><label><input type="checkbox" data-track="${id}" ${selected ? 'checked' : ''} ${!IS_LOCAL_PREVIEW && !track.available ? 'disabled' : ''}>${esc(track.name)}${!IS_LOCAL_PREVIEW && !track.available ? ' · In development' : ''}</label>${selected ? `<button class="btn" data-pause="${id}" aria-label="${paused ? 'Resume' : 'Pause'} planning for ${esc(track.name)}">${paused ? 'Resume planning' : 'Pause planning'}</button><button class="btn" data-priority="${id}" aria-label="Make ${esc(track.name)} first priority" ${state.priority[0] === id ? 'disabled' : ''}>Make first priority</button>` : ''}</div>`;
        })
        .join('')}</div></section>
      <section><h2>Planned study blocks</h2>${
        day.items.length
          ? `<div class="academy-catalog">${day.items
              .map(item => {
                const track = tracks.find(track => track.id === item.id),
                  saved = progress[item.id];
                return `<article class="academy-course"><h3>${esc(track.name)}</h3><p>${item.minutes} minutes · ${item.started ? 'already started' : 'planned focus time'}</p><p>${esc(saved.label)}</p><p>${saved.completed} ${esc(saved.unit)}${saved.due != null ? ` · ${saved.due} saved lesson recalls due` : ''}</p><a class="academy-primary" data-start="${item.id}" href="${esc(saved.url)}">${item.started ? 'Continue studying' : 'Start this block'}</a>${item.started ? `<form data-finish="${item.id}"><label for="minutes-${item.id}">Minutes you actually studied</label><input id="minutes-${item.id}" name="minutes" type="number" min="1" max="720" required><button class="btn" type="submit">Record study time</button></form>` : ''}</article>`;
              })
              .join('')}</div>`
          : `<p>${state.budget === 0 ? 'Rest day. Your saved courses are still available below.' : 'No further blocks fit this plan. Adjust priorities or the time target when needed.'}</p>`
      }
      ${day.deferred.length ? `<p>Outside today’s remaining budget: ${day.deferred.map(id => esc(tracks.find(track => track.id === id)?.name || 'Archived course')).join(', ')}. These courses stay available without adding more planned time.</p>` : ''}</section>
      <section><h2 id="academy-recorded">Recorded study time</h2>${day.complete.length ? `<ul>${day.complete.map(([id, block]) => `<li>${esc(tracks.find(track => track.id === id)?.name || 'Archived course')} · ${block.minutes} minutes · recorded once</li>`).join('')}</ul>` : '<p>No time recorded yet.</p>'}</section>
      <details><summary>All saved course records</summary><ul>${tracks.map(track => `<li><a href="${esc(progress[track.id].url)}" data-resume="${track.id}">${esc(track.name)}: ${esc(progress[track.id].label)}</a> · ${progress[track.id].completed} ${esc(progress[track.id].unit)}</li>`).join('')}</ul><p>These are separate course records, not an Academy-wide mastery score. Only explicit due dates in saved MCAT lessons are shown; no review schedule is invented for other courses.</p></details>
      <details><summary>Earlier unfinished time blocks</summary>${
        Object.entries(state.days)
          .filter(([date]) => date !== day.date)
          .flatMap(([date, value]) =>
            Object.entries(value.blocks)
              .filter(([id, block]) => activeTrack(id) && !block.completedAt)
              .map(
                ([id]) =>
                  `<form data-earlier="${date}" data-finish="${id}"><p>${esc(date)} · ${esc(tracks.find(track => track.id === id)?.name || 'Archived course')}</p><label>Minutes studied<input name="minutes" type="number" min="1" max="720" required></label><button class="btn" type="submit">Record earlier time</button></form>`
              )
          )
          .join('') || '<p>None.</p>'
      }</details></main>`);
    const refresh = mutation => {
      if (StudyStorage.paused) return;
      mutation();
      if (save()) rerender();
    };
    main.querySelector('#academy-time-settings').onsubmit = event => {
      event.preventDefault();
      const budget = Number(main.querySelector('#academy-budget').value);
      if (Number.isInteger(budget) && budget >= 0 && budget <= 240 && budget % 15 === 0)
        refresh(() => (state.budget = budget));
    };
    main.querySelectorAll('[data-track]').forEach(
      input =>
        (input.onchange = () =>
          refresh(() => {
            if (input.checked) state.priority.push(input.dataset.track);
            else state.priority = state.priority.filter(id => id !== input.dataset.track);
          }))
    );
    main.querySelectorAll('[data-pause]').forEach(
      button =>
        (button.onclick = () =>
          refresh(() => {
            const id = button.dataset.pause;
            state.paused = state.paused.includes(id) ? state.paused.filter(item => item !== id) : [...state.paused, id];
          }))
    );
    main
      .querySelectorAll('[data-priority]')
      .forEach(
        button =>
          (button.onclick = () =>
            refresh(
              () =>
                (state.priority = [
                  button.dataset.priority,
                  ...state.priority.filter(id => id !== button.dataset.priority),
                ])
            ))
      );
    function navigate(event, id, href) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      history.pushState({}, '', href);
      openSection(id);
    }
    main.querySelector('#today-catalog').onclick = event => navigate(event, 'academy', courseUrl('academy'));
    main.querySelectorAll('[data-start]').forEach(
      link =>
        (link.onclick = event => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          const item = day.items.find(item => item.id === link.dataset.start);
          if (start(day.date, item.id, item.minutes)) navigate(event, item.id, link.getAttribute('href'));
        })
    );
    main
      .querySelectorAll('[data-resume]')
      .forEach(link => (link.onclick = event => navigate(event, link.dataset.resume, link.getAttribute('href'))));
    main.querySelectorAll('[data-finish]').forEach(
      form =>
        (form.onsubmit = event => {
          event.preventDefault();
          if (
            finish(
              form.dataset.earlier || day.date,
              form.dataset.finish,
              Number(form.querySelector('[name="minutes"]').value)
            )
          )
            rerender();
        })
    );
    root.appendChild(main);
    setView(root);
  }
  // A control re-render rebuilds the whole view (setView scrolls to the top and focuses the h1), so
  // put focus back on the activated control, or its nearest surviving neighbour, and restore the viewport.
  const quote = value => String(value).replace(/["\\]/g, '\\$&');
  function focusTargets(node) {
    if (!node || !node.tagName || node === document.body) return [];
    const targets = [];
    if (node.id) targets.push('#' + quote(node.id));
    const keys = ['priority', 'pause', 'track'],
      own = keys.find(key => node.dataset?.[key]);
    if (own)
      for (const key of [own, ...keys.filter(key => key !== own)])
        targets.push(`[data-${key}="${quote(node.dataset[own])}"]`);
    const form = node.closest?.('form');
    if (form?.dataset.finish)
      targets.push(
        `[data-finish="${quote(form.dataset.finish)}"]${form.dataset.earlier ? `[data-earlier="${quote(form.dataset.earlier)}"]` : ':not([data-earlier])'} ${node.tagName === 'BUTTON' ? 'button' : '[name="minutes"]'}`,
        '#academy-recorded'
      );
    else if (form?.id && !node.id) targets.push(`#${quote(form.id)} ${node.tagName.toLowerCase()}`);
    return targets;
  }
  function rerender() {
    const targets = focusTargets(document.activeElement),
      x = window.scrollX,
      y = window.scrollY;
    render();
    const target = targets.map(selector => document.querySelector(selector)).find(node => node && !node.disabled);
    if (target) {
      if (!target.matches('a, button, input, select, textarea')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
    window.scrollTo(x, y);
  }
  window.addEventListener('study-storage-recovered', () => {
    if (location.pathname === '/academy' && new URLSearchParams(location.search).get('view') === 'today') render();
  });
  window.AcademyToday = Object.freeze({ render });
})();
