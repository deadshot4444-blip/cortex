/* Shared, authored foundation lessons. Each track keeps its own evidence. */
(() => {
  'use strict';
  const courses = new Map();
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const clone = value => JSON.parse(JSON.stringify(value));
  const validTable = table => table == null || object(table) && text(table.caption)
    && Array.isArray(table.columns) && table.columns.length >= 2 && table.columns.length <= 5 && table.columns.every(text)
    && Array.isArray(table.rows) && table.rows.length > 0
    && table.rows.every(row => Array.isArray(row) && row.length === table.columns.length && row.every(text));
  const validViews = views => views == null || Array.isArray(views) && views.length >= 2 && views.length <= 6
    && new Set(views.map(view => view?.id)).size === views.length
    && views.every(view => object(view) && text(view.id) && /^[a-z][a-z0-9-]*$/.test(view.id) && text(view.title) && text(view.description)
      && Array.isArray(view.rows) && view.rows.length > 0 && view.rows.every(row => object(row)
        && ['from', 'relation', 'to'].every(field => text(row[field]))));
  const validStep = step => object(step) && text(step.id) && (
    step.kind === 'read' && Array.isArray(step.paragraphs) && step.paragraphs.length && step.paragraphs.every(text)
      && (step.sequence == null || Array.isArray(step.sequence) && step.sequence.every(text))
      && validViews(step.views) && validTable(step.table)
      && (step.trace == null || typeof ECGTrace !== 'undefined' && ECGTrace.valid(step.trace))
    || step.kind === 'check' && text(step.prompt) && text(step.explanation) && Array.isArray(step.options)
      && step.options.length >= 2 && step.options.every(text) && Number.isInteger(step.answer)
      && step.answer >= 0 && step.answer < step.options.length
    || step.kind === 'reflect' && text(step.prompt) && text(step.model) && (step.required == null || typeof step.required === 'boolean')
  );
  function validLesson(lesson) {
    return object(lesson) && text(lesson.id) && text(lesson.title) && text(lesson.objective)
      && Number.isInteger(lesson.revision) && lesson.revision > 0 && Array.isArray(lesson.steps)
      && lesson.steps.length > 0 && lesson.steps.every(validStep)
      && new Set(lesson.steps.map(step => step.id)).size === lesson.steps.length
      && Array.isArray(lesson.sources) && lesson.sources.length > 0
      && lesson.sources.every(source => text(source.title) && /^https:\/\//.test(source.url))
      && (lesson.connections == null || Array.isArray(lesson.connections) && lesson.connections.every(link => object(link)
        && ['reference', 'anatomy', 'practice'].includes(link.section) && text(link.label) && object(link.params)
        && Object.entries(link.params).every(([key, value]) => ['lesson', 'view', 'tool', 'mode', 'focus'].includes(key) && /^[a-z0-9-]+$/.test(value))
        && (link.hash == null || /^case-[a-z0-9-]+$/.test(link.hash))));
  }
  function validRecord(record) {
    if (!object(record) || !validLesson(record.content) || !object(record.steps)
      || !Number.isInteger(record.index) || record.index < 0 || record.index >= record.content.steps.length
      || !Number.isFinite(record.startedAt) || (record.completedAt != null && !Number.isFinite(record.completedAt))) return false;
    if (record.completedAt && !record.content.steps.every(step => ready(step, record.steps[step.id]))) return false;
    return Object.entries(record.steps).every(([id, saved]) => {
      const step = record.content.steps.find(item => item.id === id);
      if (!step || !object(saved) || ['draft', 'firstDraft', 'comparison'].some(key => saved[key] != null && typeof saved[key] !== 'string')) return false;
      if (step.required && saved.revealedAt && !text(saved.firstDraft)) return false;
      if (saved.view != null && (step.kind !== 'read' || !step.views?.some(view => view.id === saved.view))) return false;
      if (step.kind !== 'check') return saved.selected == null;
      return Array.isArray(saved.order) && saved.order.length === step.options.length
        && new Set(saved.order).size === step.options.length
        && saved.order.every(value => Number.isInteger(value) && value >= 0 && value < step.options.length)
        && (saved.selected == null || Number.isInteger(saved.selected) && saved.order.includes(saved.selected));
    });
  }
  async function load(section, file) {
    if (courses.has(section)) return courses.get(section);
    const response = await fetch(file);
    if (!response.ok) throw new Error('Foundation lessons did not download');
    const data = await response.json();
    if (!object(data) || !text(data.title) || !Array.isArray(data.lessons) || !data.lessons.length
      || !data.lessons.every(validLesson) || new Set(data.lessons.map(lesson => lesson.id)).size !== data.lessons.length
      || data.groups != null && (!Array.isArray(data.groups) || !data.groups.length
        || data.groups.some(group => !object(group) || !text(group.id) || !text(group.title) || !text(group.description))
        || new Set(data.groups.map(group => group.id)).size !== data.groups.length
        || data.lessons.some(lesson => !data.groups.some(group => group.id === lesson.group))))
      throw new Error('Foundation lesson structure is invalid');
    const key = `cs-academy-${section}-v1`, progress = StudyStorage.read(key, { lessons: {} });
    if (!object(progress) || !object(progress.lessons)
      || Object.entries(progress.lessons).some(([id, record]) => !validRecord(record) || record.content.id !== id)) {
      StudyStorage.sessionFailed();
      return null;
    }
    const course = { section, key, data, progress, back: null };
    StudyStorage.watch(key, () => progress);
    courses.set(section, course);
    return course;
  }
  function save(course) { return StudyStorage.write(course.key, course.progress); }
  function ready(step, saved = {}) {
    return step.kind === 'check' ? Number.isInteger(saved.selected) : step.kind === 'reflect'
      ? !!saved.revealedAt && (!step.required || text(saved.firstDraft) && text(saved.comparison)) : !!saved.seenAt;
  }
  function recordFor(course, lesson) {
    return course.progress.lessons[lesson.id] ||= { content: clone(lesson), index: 0, steps: {}, startedAt: Date.now() };
  }
  const revised = (record, lesson) => (record.content.revision || 0) < lesson.revision;
  // Corrections are available without changing what an earlier answer or draft meant.
  function liveMarkup(lesson) {
    const body = lesson.steps.map(step => step.kind === 'read' ? step.paragraphs.map(paragraph => `<p>${esc(paragraph)}</p>`).join('')
      + (step.sequence ? `<ol>${step.sequence.map(item => `<li>${esc(item)}</li>`).join('')}</ol>` : '')
      + (step.views || []).map(view => `<h3>${esc(view.title)}</h3><p>${esc(view.description)}</p><ul>${view.rows.map(row => `<li>${esc(row.from)}: ${esc(row.relation)} ${esc(row.to)}</li>`).join('')}</ul>`).join('')
      + tableMarkup(step.table) + (step.trace ? ECGTrace.markup(step.trace) : '')
      : step.kind === 'check' ? `<p>${esc(step.prompt)}</p><ul>${step.options.map(option => `<li>${esc(option)}</li>`).join('')}</ul><p>Answer: ${esc(step.options[step.answer])}</p><p>${esc(step.explanation)}</p>`
      : `<p>${esc(step.prompt)}</p><p>${esc(step.model)}</p>`).join('<hr>');
    return `<details class="academy-source-note academy-revised"><summary>Read the revised lesson (includes answers)</summary><h2>${esc(lesson.title)} · Revision ${lesson.revision}</h2><p>${esc(lesson.objective)}</p><p>This is the current teaching text. Reviewing it does not replace your saved attempt or add another result.</p>${body}<p>${esc(lesson.reviewStatus || '')}</p>${lesson.sources.map(source => `<p><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)} ↗</a></p>`).join('')}</details>`;
  }
  // Re-render a step after an in-place action without sending the learner back to the top of the page.
  function reopen(section, id, index, selector) {
    const y = window.scrollY || 0;
    open(section, id, index);
    if (typeof window.scrollTo === 'function') window.scrollTo(0, y);
    const target = document.querySelector(selector);
    if (!target) return;
    target.focus?.({ preventScroll: true });
    target.scrollIntoView?.({ block: 'nearest' });
  }
  function orderFor(step, saved) {
    if (!saved.order) {
      saved.order = step.options.map((_, index) => index);
      for (let i = saved.order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [saved.order[i], saved.order[j]] = [saved.order[j], saved.order[i]];
      }
    }
    return saved.order;
  }
  function viewsMarkup(step, saved) {
    if (!step.views) return '';
    const selected = step.views.find(view => view.id === saved.view) || step.views[0];
    return `<section class="academy-views" aria-label="Relationship views"><div class="academy-view-controls" role="group" aria-label="Choose a relationship view">
      ${step.views.map(view => `<button class="btn" data-academy-view="${esc(view.id)}" aria-pressed="${view.id === selected.id}">${esc(view.title)}</button>`).join('')}</div>
      <div id="academy-view-content" aria-live="polite"><h2>${esc(selected.title)}</h2><p>${esc(selected.description)}</p>
      <ul class="academy-relation-map">${selected.rows.map(row => `<li><strong>${esc(row.from)}</strong><span>${esc(row.relation)}</span><strong>${esc(row.to)}</strong></li>`).join('')}</ul></div>
      <p class="academy-source-note">Original relationship diagram. Box placement organizes the statements; it is not an anatomically scaled view. Every relationship is written in full and remains readable without color.</p></section>`;
  }
  function tableMarkup(table) {
    if (!table) return '';
    return `<div class="academy-comparison" tabindex="0" role="region" aria-label="${esc(table.caption)}"><table><caption>${esc(table.caption)}</caption>
      <thead><tr>${table.columns.map(column => `<th scope="col">${esc(column)}</th>`).join('')}</tr></thead>
      <tbody>${table.rows.map(row => `<tr>${row.map((cell, i) => i ? `<td>${esc(cell)}</td>` : `<th scope="row">${esc(cell)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function connectionsMarkup(lesson) {
    if (!lesson.connections?.length) return '';
    return `<aside class="academy-connections"><h2>Connect this lesson</h2><ul>${lesson.connections.map(link => {
      const url = new URL(sectionUrl(link.section), location.origin);
      for (const [key, value] of Object.entries(link.params)) url.searchParams.set(key, value);
      if (link.hash) url.hash = link.hash;
      const back = window.AcademyCurriculum?.safeReturn(url.searchParams.get('returnTo') || location.pathname + location.search + location.hash);
      if (back) url.searchParams.set('returnTo', back);
      return `<li><a href="${esc(url.pathname + url.search + url.hash)}">${esc(link.label)}</a></li>`;
    }).join('')}</ul></aside>`;
  }
  function route(course, lesson, index) {
    const url = new URL(sectionUrl(course.section), location.origin);
    if (lesson) { url.searchParams.set('lesson', lesson); url.searchParams.set('step', String(index + 1)); }
    if (url.pathname + url.search === location.pathname + location.search) return;
    const same = new URLSearchParams(location.search).get('lesson') === lesson;
    history[same ? 'replaceState' : 'pushState']({}, '', url.pathname + url.search);
  }
  function home(course) { route(course); course.back(); }
  function catalog(section) {
    const course = courses.get(section);
    if (!course) return '';
    const done = course.data.lessons.filter(lesson => course.progress.lessons[lesson.id]?.completedAt).length;
    const list = lessons => `<ol class="academy-lesson-list">${lessons.map(lesson => {
        const saved = course.progress.lessons[lesson.id];
        return `<li><button class="btn" data-academy-lesson="${esc(lesson.id)}">${esc(lesson.title)}<span>${saved?.completedAt ? 'Completed · review your work' : saved ? 'Continue saved lesson' : 'Start lesson'} · about ${lesson.minutes} minutes</span></button></li>`;
      }).join('')}</ol>`;
    return `<section class="academy-foundation"><span class="label">Guided path · ${done}/${course.data.lessons.length} complete</span>
      <h2>${esc(course.data.title)}</h2><p>${esc(course.data.description)}</p><p class="academy-source-note">${esc(course.data.reviewStatus)}</p>
      ${course.data.groups ? course.data.groups.map(group => `<section><h3>${esc(group.title)}</h3><p>${esc(group.description)}</p>${list(course.data.lessons.filter(lesson => lesson.group === group.id))}</section>`).join('') : list(course.data.lessons)}</section>`;
  }
  function bind(root, section, back) {
    const course = courses.get(section);
    if (!course) return;
    course.back = back;
    root.querySelectorAll('[data-academy-lesson]').forEach(button => button.addEventListener('click', () => open(section, button.dataset.academyLesson)));
  }
  function fromUrl(section, back) {
    const course = courses.get(section), params = new URLSearchParams(location.search), id = params.get('lesson');
    if (!course || !id) return false;
    course.back = back;
    if (!course.data.lessons.some(lesson => lesson.id === id)) return false;
    open(section, id, Number(params.get('step') || 1) - 1);
    return true;
  }
  function open(section, id, requested) {
    if (StudyStorage.paused) return;
    const course = courses.get(section), current = course?.data.lessons.find(lesson => lesson.id === id);
    if (!current) return;
    const record = recordFor(course, current), lesson = record.content;
    const stale = revised(record, current);
    let index = Number.isInteger(requested) ? requested : record.index;
    const firstUnfinished = lesson.steps.findIndex(step => !ready(step, record.steps[step.id]));
    index = Math.max(0, Math.min(index, lesson.steps.length - 1, firstUnfinished < 0 ? lesson.steps.length - 1 : firstUnfinished));
    record.index = index;
    const step = lesson.steps[index], saved = record.steps[step.id] ||= {};
    if (step.kind === 'read') saved.seenAt ||= Date.now();
    if (step.kind === 'check') orderFor(step, saved);
    if (!save(course)) return;
    route(course, id, index);
    const answered = Number.isInteger(saved.selected);
    const body = step.kind === 'read' ? `${step.paragraphs.map(paragraph => `<p>${esc(paragraph)}</p>`).join('')}
      ${step.sequence ? `<ol class="academy-text-map">${step.sequence.map(item => `<li>${esc(item)}</li>`).join('')}</ol>` : ''}${viewsMarkup(step,saved)}${tableMarkup(step.table)}${step.trace ? ECGTrace.markup(step.trace) : ''}`
      : step.kind === 'check' ? `<h2>${esc(step.prompt)}</h2><div class="academy-check-options">${saved.order.map((option, i) => `<button class="btn" data-answer="${option}" ${answered ? 'disabled' : ''}>
        <span aria-hidden="true">${'ABCD'[i] || i + 1}.</span> ${esc(step.options[option])}${answered && saved.selected === option ? ' · Your first answer' : ''}</button>`).join('')}</div>
        ${answered ? `<div class="academy-answer" role="status" tabindex="-1"><strong>${saved.selected === step.answer ? 'Correct.' : 'Review this idea.'}</strong><p>Answer: ${esc(step.options[step.answer])}</p><p>${esc(step.explanation)}</p></div>` : ''}`
      : `<h2>${esc(step.prompt)}</h2><label for="academy-response">${record.completedAt ? 'Your saved explanation' : step.required ? 'Your explanation before feedback (required)' : 'Your explanation (optional)'}</label><textarea id="academy-response" rows="5" maxlength="12000" ${record.completedAt || step.required && saved.revealedAt ? 'readonly' : ''}>${esc(saved.firstDraft ?? saved.draft ?? '')}</textarea>
        <button class="btn" id="academy-reveal">${saved.revealedAt ? 'Model explanation shown' : 'Compare with a model explanation'}</button>
        ${saved.revealedAt ? `<div class="academy-answer" role="status" tabindex="-1"><p>${esc(step.model)}</p><p>Your writing is saved, without an automated correctness score.</p></div>
        ${step.required ? `<label for="academy-comparison">Compare your explanation: what agrees, what would you change, and what remains uncertain?</label><textarea id="academy-comparison" rows="4" maxlength="12000" ${record.completedAt ? 'readonly' : ''}>${esc(saved.comparison || '')}</textarea>` : ''}` : ''}`;
    const root = el('<div></div>'); root.appendChild(topbar(section));
    const main = el(`<main class="panel academy-lesson" id="main"><button class="ghostbtn" id="academy-back">← Course home</button>
      <span class="label">Step ${index + 1}/${lesson.steps.length}${record.completedAt ? ' · Saved completed lesson' : ''}</span>
      <h1>${esc(lesson.title)}</h1><p class="academy-objective">${esc(lesson.objective)}</p>
      ${stale ? '<p class="course-notice">This lesson was revised since you started it. Your saved wording, answers and writing are kept. You can read the corrected lesson below, including new or changed steps.</p>' : ''}
      <div class="academy-step">${body}</div>${stale ? liveMarkup(current) : ''}
      <div class="academy-lesson-nav"><button class="btn" id="academy-previous" ${index ? '' : 'disabled'}>Previous</button>
      <button class="btn btn-solid" id="academy-next" ${ready(step, saved) ? '' : 'disabled'}>${index === lesson.steps.length - 1 ? 'Finish lesson' : 'Continue'} →</button></div>
      <details class="academy-source-note"><summary>Sources and scope</summary><p>${esc(lesson.reviewStatus || course.data.reviewStatus)}</p>
      ${lesson.sourceCheckedOn ? `<p>Sources checked: ${esc(lesson.sourceCheckedOn)}.</p>` : ''}
      <p>Authored learning examples. These checks record practice, not professional competence or lasting mastery.</p>
      ${lesson.sources.map(source => `<p><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)}</a></p>`).join('')}</details></main>`);
    main.querySelector('#academy-back').onclick = () => home(course);
    main.querySelector('#academy-previous').onclick = () => open(section, id, index - 1);
    main.querySelectorAll('[data-academy-view]').forEach(button => button.onclick = () => {
      if (StudyStorage.paused || !step.views?.some(view => view.id === button.dataset.academyView)) return;
      saved.view = button.dataset.academyView;
      if (save(course)) reopen(section, id, index, `[data-academy-view="${saved.view}"]`);
    });
    main.querySelectorAll('[data-answer]').forEach(button => button.onclick = () => {
      if (StudyStorage.paused || Number.isInteger(saved.selected)) return;
      saved.selected = Number(button.dataset.answer); saved.answeredAt = Date.now();
      if (save(course)) reopen(section, id, index, '.academy-answer');
    });
    const input = main.querySelector('#academy-response');
    if (input && !record.completedAt && !(step.required && saved.revealedAt)) input.oninput = () => {
      saved.draft = input.value; save(course);
      if (step.required) main.querySelector('#academy-reveal').disabled = !text(saved.draft) || StudyStorage.paused;
    };
    const reveal = main.querySelector('#academy-reveal');
    if (reveal) {
      reveal.disabled = !!saved.revealedAt || step.required && !text(saved.draft);
      reveal.onclick = () => {
        if (StudyStorage.paused || saved.revealedAt || step.required && !text(saved.draft)) return;
        if (step.required) saved.firstDraft = saved.draft;
        saved.revealedAt = Date.now(); if (save(course)) reopen(section, id, index, '.academy-answer');
      };
    }
    const comparison = main.querySelector('#academy-comparison');
    if (comparison && !record.completedAt) comparison.oninput = () => {
      saved.comparison = comparison.value;
      main.querySelector('#academy-next').disabled = !save(course) || !ready(step, saved);
    };
    main.querySelector('#academy-next').onclick = () => {
      if (StudyStorage.paused || !ready(step, saved)) return;
      if (index + 1 < lesson.steps.length) return open(section, id, index + 1);
      if (lesson.steps.every(item => ready(item, record.steps[item.id]))) {
        record.completedAt ||= Date.now();
        if (save(course)) result(course, record);
      }
    };
    root.appendChild(main); setView(root);
  }
  function result(course, record) {
    const lesson = record.content, checks = lesson.steps.filter(step => step.kind === 'check');
    const next = course.data.lessons[course.data.lessons.findIndex(item => item.id === lesson.id) + 1];
    const correct = checks.filter(step => record.steps[step.id]?.selected === step.answer).length;
    const root = el('<div></div>'); root.appendChild(topbar(course.section));
    const main = el(`<main class="panel academy-lesson"><span class="label">Lesson complete</span><h1>${esc(lesson.title)}</h1>
      <p>${correct}/${checks.length} checks correct on the first answer. This is a practice record.</p>
      <p>Completed ${esc(new Date(record.completedAt).toLocaleString())}. Reviewing keeps the original answers and completion time.</p>
      ${lesson.steps.filter(step => step.kind === 'reflect').map(step => `<h2>Your explanation</h2><p class="academy-written-work">${esc(record.steps[step.id]?.firstDraft || record.steps[step.id]?.draft || 'No written response added.')}</p>
        ${record.steps[step.id]?.comparison ? `<h3>Your comparison</h3><p class="academy-written-work">${esc(record.steps[step.id].comparison)}</p>` : ''}`).join('')}
      ${connectionsMarkup(lesson)}
      <div class="academy-lesson-nav">${next ? `<button class="btn btn-solid" id="academy-next-lesson">Next: ${esc(next.title)} →</button>` : ''}<button class="btn" id="academy-review">Review saved work</button><button class="btn" id="academy-course">Course home →</button></div></main>`);
    main.querySelector('#academy-review').onclick = () => open(course.section, lesson.id, 0);
    main.querySelector('#academy-course').onclick = () => home(course);
    const nextButton = main.querySelector('#academy-next-lesson'); if (nextButton) nextButton.onclick = () => open(course.section, next.id);
    root.appendChild(main); setView(root);
  }
  window.addEventListener('study-storage-recovered', () => {
    for (const course of courses.values()) {
      if (location.pathname === new URL(sectionUrl(course.section), location.origin).pathname && course.back) {
        if (!fromUrl(course.section, course.back)) course.back();
        break;
      }
    }
  });
  window.AcademyLessons = Object.freeze({ load, catalog, bind, fromUrl, open });
})();
