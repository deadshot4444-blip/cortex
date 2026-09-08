/* Academy catalog: one inventory for course discovery and section URLs. */
(() => {
  'use strict';

  const tracks = [
    {
      id: 'mcat',
      path: 'mcat',
      name: 'MCAT preparation',
      available: true,
      description: 'Learn the foundations, reason through passages, and build a study week you can return to.',
      audience: 'Students preparing for the MCAT.',
      prerequisites: 'Introductory science. Each lesson names its own foundations.',
      scope:
        '45 foundation lessons, a coverage map, passage coaching, math practice, investigations, and a weekly planner.',
      time: 'Start with 15 minutes',
      action: 'Open MCAT',
      kind: 'Exam preparation',
    },
    {
      id: 'socrates',
      path: 'learn',
      name: 'Learn to Learn',
      available: true,
      description: 'Turn memory, explanation, practice, and feedback into a useful learning routine.',
      audience: 'Learners studying independently, at work, or in healthcare.',
      prerequisites: 'No prior course required.',
      scope: 'General and Business courses with 8 lessons each; a Medical course with 10 lessons.',
      time: '12–20 minutes per lesson',
      action: 'Explore learning methods',
      kind: 'Learning methods',
    },
    {
      id: 'practice',
      path: 'practice',
      name: 'Clinical Scenarios',
      available: true,
      description: 'Gather findings, weigh explanations, write a note, and compare your reasoning with a model.',
      audience: 'Learners with introductory clinical knowledge.',
      prerequisites: 'Basic physiology and medical terminology.',
      scope: '18 Clinical Shift cases across 3 rotations, plus the separately labeled classic case bank.',
      time: 'One simulated encounter at a time',
      action: 'Explore clinical cases',
      kind: 'Clinical reasoning',
    },
    {
      id: 'anatomy',
      path: 'anatomy',
      name: 'Anatomy',
      available: true,
      description: 'Connect the location of a structure with its function and important relationships.',
      audience: 'Students beginning human anatomy.',
      prerequisites: 'No earlier Cortex course required.',
      scope:
        'Twelve lessons connect foundations with regional anatomy and basic neuroanatomy; the separate atlas explorers retain draft status.',
      time: 'One region or system at a time',
      action: 'Explore anatomy',
      kind: 'Foundational science',
    },
    {
      id: 'reference',
      path: 'medicine',
      name: 'Medicine',
      available: true,
      description: 'Connect mechanisms with pharmacology, microbiology, laboratory findings, and ECG patterns.',
      audience: 'Healthcare learners building foundational clinical knowledge.',
      prerequisites: 'Introductory biology, chemistry, and physiology.',
      scope:
        'Twenty-two lessons connect physiology, pharmacology, microbiology, ECGs and laboratory interpretation, alongside the separately labeled 81-step draft reference pathway.',
      time: 'One topic or pathway step at a time',
      action: 'Explore medicine',
      kind: 'Clinical foundations',
    },
    {
      id: 'neuro',
      path: 'neuro',
      name: 'Neuroengineering',
      available: true,
      description: 'Move from neurons and signals to code, simulations, and reproducible analysis.',
      audience: 'Learners exploring neuroscience and engineering.',
      prerequisites: 'Foundations introduce the science and coding; later projects build on those units.',
      scope:
        'Five revised foundation units within a 20-unit draft path; 13 checked coding exercises, 15 simulations, and six project entries. Independent subject review is pending.',
      time: 'Start with the foundations',
      action: 'Explore neuroengineering',
      kind: 'Engineering',
    },
  ].map(Object.freeze);

  function status(track) {
    if (!track) return 'Archived';
    if (track.available) return 'Beta';
    return IS_LOCAL_PREVIEW ? 'Local preview' : 'In development';
  }

  function renderCatalog() {
    window.pauseMcatTools?.();
    if (typeof stopTimer === 'function') stopTimer();
    const root = el('<div></div>');
    root.appendChild(topbar('academy'));
    const main = el(`<main class="panel academy-shell">
      <div class="academy-intro">
        <span class="label">Your Academy</span>
        <h1>Choose what you want to learn.</h1>
        <p>Find a path that fits your goal. Start with one useful session, and return to the work you save.</p>
        <a class="academy-primary" href="${esc(sectionUrl('academy'))}${sectionUrl('academy').includes('?') ? '&' : '?'}view=today" id="academy-open-today">Plan my study day <span aria-hidden="true">→</span></a>
        <a class="academy-primary" href="${esc(sectionUrl('mcat'))}" data-course="mcat">Start MCAT preparation <span aria-hidden="true">→</span></a>
        <p><a href="${esc(sectionUrl('academy'))}${sectionUrl('academy').includes('?') ? '&' : '?'}view=storage" data-academy-view>Study backups &amp; offline downloads</a></p>
        <p><a href="${esc(sectionUrl('academy'))}${sectionUrl('academy').includes('?') ? '&' : '?'}view=portfolio" data-academy-view>My private portfolio</a></p>
        <p><a href="${esc(sectionUrl('academy'))}${sectionUrl('academy').includes('?') ? '&' : '?'}view=curriculum" data-academy-view>Find lessons and connections across the Academy</a> · <a href="${esc(sectionUrl('academy'))}${sectionUrl('academy').includes('?') ? '&' : '?'}view=queue" data-academy-view>Optional retrieval practice</a></p>
      </div>
      <div class="academy-catalog" aria-label="Learning paths">
        ${tracks
          .map(
            track => `<article class="academy-course">
          <div class="academy-course-top"><span>${esc(track.kind)}</span><span class="academy-status">${status(track)}</span></div>
          <h2><a href="${esc(sectionUrl(track.id))}" data-course="${track.id}">${esc(track.name)}</a></h2>
          <p>${esc(track.description)}</p>
          <dl>
            <div><dt>For</dt><dd>${esc(track.audience)}</dd></div>
            <div><dt>Before you start</dt><dd>${esc(track.prerequisites)}</dd></div>
            <div><dt>Inside</dt><dd>${esc(track.scope)}</dd></div>
          </dl>
          <div class="academy-course-bottom"><span>${esc(track.time)}</span>
            <a href="${esc(sectionUrl(track.id))}" data-course="${track.id}">${track.available || IS_LOCAL_PREVIEW ? esc(track.action) : 'View course status'} <span aria-hidden="true">→</span></a>
          </div>
        </article>`
          )
          .join('')}
      </div>
      <details class="academy-review-note">
        <summary>About course status and review</summary>
        <p>Beta material is available for evaluation. Independent subject review is pending. A course's presence here describes its available material, not a qualification or a guarantee of learning outcomes.</p>
        <p>MCAT preparation is free forever. Your work stays on this device unless you choose to use an account or share it.</p>
      </details>
    </main>`);
    main.querySelectorAll('[data-course]').forEach(link => {
      link.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigateSection(link.dataset.course);
      });
    });
    main.querySelectorAll('#academy-open-today, [data-academy-view]').forEach(
      link =>
        (link.onclick = event => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          history.pushState({}, '', event.currentTarget.getAttribute('href'));
          openSection('academy');
        })
    );
    root.appendChild(main);
    setView(root);
  }

  window.CortexAcademy = Object.freeze({ tracks: Object.freeze(tracks), status, renderCatalog });
})();
