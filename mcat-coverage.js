/* Available content and learner evidence are counted separately. */
(function (root) {
  function rows(outline, course, banks) {
    const questions = [...banks.questions, ...banks.sci.flatMap(p => p.questions)];
    return outline.concepts.flatMap(concept =>
      concept.categories.map(category => {
        const lessons = course.units.filter(unit => unit.categories.includes(category.id));
        const practice = category.id.startsWith('CARS-')
          ? banks.cars.flatMap(p => p.questions).filter(q => q.skill === 'cars-' + category.id.split('-')[1])
          : questions.filter(q => q.category === category.id);
        const cards = banks.cards.filter(card => card.category === category.id);
        const introduced = new Set(lessons.flatMap(unit => unit.topics || []));
        return {
          ...category,
          section: concept.section,
          lessons,
          practiceCount: new Set(practice.map(q => q.id)).size,
          cardCount: new Set(cards.map(card => card.id)).size,
          firstChecks: lessons.reduce((n, unit) => n + unit.questions.filter(q => q.kind === 'check').length, 0),
          laterChecks: lessons.reduce((n, unit) => n + unit.questions.filter(q => q.kind === 'delayed').length, 0),
          missingTopics: category.topics.filter(topic => !introduced.has(topic)),
          skills: [
            ...new Set([...lessons.flatMap(unit => unit.skills || []), ...practice.map(q => q.skill).filter(Boolean)]),
          ],
        };
      })
    );
  }
  function render() {
    coursePauseTools();
    if (!courseData || !MCAT.outline) return renderCourseHome();
    const data = rows(MCAT.outline, courseData, MCAT);
    const params = new URLSearchParams(location.search);
    const category = params.get('category');
    const concept = MCAT.outline.concepts.find(c => c.categories.some(cat => cat.id === category));
    if (concept && !category.startsWith('CARS-'))
      return renderCategory(
        concept.categories.find(cat => cat.id === category),
        concept,
        concept.section
      );
    const requestedSection = params.get('section');
    const section = Object.hasOwn(COURSE_SECTIONS, requestedSection) ? requestedSection : 'all';
    const main = el(`<main class="course-page coverage-page">
      <header class="course-progress-heading"><span class="course-eyebrow">MCAT / CONTENT SCOPE</span><h1>Coverage and gaps.</h1>
      <p>Find a learning objective, open its lesson, and see the practice available around it. These counts describe the material; your saved results are in Progress.</p></header>
      <div class="course-coverage"><span><b>${courseData.units.length}</b> foundation lessons</span><span><b>${data.filter(row => row.lessons.length).length}/${data.length}</b> areas with a lesson</span><span><b>31</b> science categories + <b>3</b> CARS skill areas</span></div>
      <p class="course-caption">Topic groups below are selected navigation aids. A lesson introduces part of an area, and three later checks sample its objective. No count establishes complete exam coverage. <a href="${esc(MCAT.outline.sourceUrl)}" target="_blank" rel="noopener">Open the complete AAMC outline and free study resources</a>.</p>
      <form class="coverage-filters" aria-label="Filter the coverage map">
        <label>Find a topic or objective<input type="search" name="query" value="${esc(params.get('q') || '')}" placeholder="Memory, membrane, feedback…"></label>
        <label>Section<select name="section"><option value="all">All sections</option>${Object.entries(COURSE_SECTIONS)
          .map(([id, name]) => `<option value="${id}" ${id === section ? 'selected' : ''}>${esc(name)}</option>`)
          .join('')}</select></label>
        <label class="coverage-gap"><input type="checkbox" name="gaps" ${params.get('gaps') === '1' ? 'checked' : ''}>Show areas with topic gaps</label>
      </form>
      <p class="course-caption" role="status" id="coverage-count"></p><div id="coverage-results"></div>
      <p class="course-caption">Alignment checked September 7, 2026. Category corrections preserve original question IDs and saved attempts. Content remains original authored practice with independent subject review pending.</p>
      <button class="btn" id="coverage-course">Return to the course</button>
    </main>`);
    const form = main.querySelector('form');
    const skillNames = Object.fromEntries(
      [...MCAT.outline.scienceSkills, ...MCAT.outline.carsSkills].map(skill => [skill.id, skill.title])
    );
    function update() {
      const query = form.elements.query.value.trim().toLowerCase();
      const selected = form.elements.section.value,
        gaps = form.elements.gaps.checked;
      const shown = data.filter(
        row =>
          (selected === 'all' || selected === row.section) &&
          (!gaps || row.missingTopics.length) &&
          [row.id, row.title, ...row.topics, ...row.lessons.flatMap(u => [u.title, u.subtitle])]
            .join(' ')
            .toLowerCase()
            .includes(query)
      );
      const url = new URL(location.href);
      for (const [key, value] of [
        ['q', query],
        ['section', selected === 'all' ? '' : selected],
        ['gaps', gaps ? '1' : ''],
      ]) {
        if (value) url.searchParams.set(key, value);
        else url.searchParams.delete(key);
      }
      history.replaceState({}, '', url.pathname + url.search);
      main.querySelector('#coverage-count').textContent =
        `${shown.length} of ${data.length} areas shown. Expand an area for objectives, resources, and gaps.`;
      main.querySelector('#coverage-results').innerHTML = shown.length
        ? shown
            .map(
              row => `<details class="coverage-area">
        <summary><span><b>${row.id}</b> ${esc(row.title)}</span><small>${row.lessons.length ? `${row.lessons.length} ${row.lessons.length === 1 ? 'lesson' : 'lessons'}` : 'No foundation lesson'}</small></summary>
        <div class="coverage-area-body">
          <dl class="coverage-counts"><div><dt>Practice available</dt><dd>${row.practiceCount} questions · ${row.cardCount} cards</dd></div><div><dt>Lesson assessment</dt><dd>${row.firstChecks} application checks · ${row.laterChecks} later checks available</dd></div></dl>
          <h3>Learning objectives introduced</h3>
          ${row.lessons.length ? `<ul class="coverage-objectives">${row.lessons.map(unit => `<li><strong>${esc(unit.subtitle)}</strong><p>${unit.questions.filter(q => q.kind === 'check').length} application checks · ${unit.questions.filter(q => q.kind === 'delayed').length} later checks · ${esc((unit.skills || []).map(id => skillNames[id] || id).join('; '))}</p><button class="ghostbtn" data-course-open="${unit.id}">Open ${esc(unit.title)} →</button></li>`).join('')}</ul>` : '<p>A foundation lesson is still needed here. Use the official outline to choose additional study material.</p>'}
          ${row.missingTopics.length ? `<h3>Topics without a foundation lesson</h3><p>${esc(row.missingTopics.join(' · '))}</p>` : '<p>These selected topic groups each have an introduction. Subtopics and depth still need additional study.</p>'}
          <p class="course-caption">Tagged reasoning skills: ${esc(row.skills.map(id => skillNames[id] || id).join('; ') || 'No practice skill mapped yet.')}</p>
          <button class="btn" data-coverage-practice="${row.id}">${row.id.startsWith('CARS-') ? 'Open CARS practice' : 'Open available questions and cards'}</button>
        </div></details>`
            )
            .join('')
        : '<p class="course-notice">No matching areas. Try a broader topic or clear the filters.</p>';
      main.querySelectorAll('[data-coverage-practice]').forEach(
        button =>
          (button.onclick = () => {
            const id = button.dataset.coveragePractice;
            if (id.startsWith('CARS-')) return renderCarsHome();
            const concept = MCAT.outline.concepts.find(c => c.categories.some(cat => cat.id === id));
            renderCategory(
              concept.categories.find(cat => cat.id === id),
              concept,
              concept.section
            );
          })
      );
    }
    form.addEventListener('submit', event => event.preventDefault());
    form.addEventListener('input', update);
    main.querySelector('#coverage-course').onclick = renderCourseHome;
    courseView(main, 'coverage');
    update();
  }
  const api = { rows, render };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.McatCoverage = api;
})(typeof window !== 'undefined' ? window : globalThis);
