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
      id: 'dat',
      path: 'dat',
      name: 'DAT preparation',
      available: true,
      description:
        'Drill the sciences on the clock, train perceptual ability against generated figures, and work timed reading and quantitative sets.',
      audience: 'Students preparing for the U.S. Dental Admission Test.',
      prerequisites: 'One year of biology, general chemistry and organic chemistry.',
      scope:
        '216 original questions across biology, both chemistries and quantitative reasoning; six perceptual-ability generators that draw unlimited new figures; three reading-comprehension passages with 50 questions; the exam\u2019s on-screen calculator. Lessons, scheduling, score estimates and full-length tests are still being built.',
      time: 'Start with a 15-minute drill',
      action: 'Open DAT',
      kind: 'Exam preparation',
    },
    {
      id: 'socrates',
      path: 'learn',
      name: 'Learn to Learn',
      available: false,
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
      available: false,
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
      available: false,
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
        'Four modules and twenty units, from neural time series to a closed-loop toy BCI; 22 checked coding exercises, 26 decision labs and six projects. Not yet independently reviewed.',
      time: 'Start with the foundations',
      action: 'Explore neuroengineering',
      kind: 'Engineering',
    },
    {
      id: 'lab',
      path: 'lab',
      name: "Alzheimer's Histology Lab",
      available: true,
      description:
        'Practice the modified Bielschowsky silver stain step by step, or take the free bench and mix anything to see what happens, with real reference slides from open-access studies.',
      audience: 'Students learning Alzheimer’s disease histology methods.',
      prerequisites: 'None. The steps, reagents, quantities and safety notes follow the course procedure.',
      scope:
        'A list mode that needs no WebGL, a 2D microscope and an optional 3D bench. Every simulated output is an illustration, not a measurement; real slides are credited under each. Not yet independently reviewed.',
      time: 'Open-ended: one run takes a few minutes',
      action: 'Open the lab',
      kind: 'Laboratory methods',
    },
  ].map(Object.freeze);

  // A reviewer grant (app.js PREVIEW_COURSES) opens a closed course for one signed-in account.
  const granted = id => typeof PREVIEW_COURSES !== 'undefined' && PREVIEW_COURSES.has(id);
  function status(track) {
    if (!track) return 'Archived';
    if (track.available) return 'Beta';
    if (IS_LOCAL_PREVIEW) return 'Local preview';
    return granted(track.id) ? 'Preview' : 'Under construction';
  }

  function renderCatalog() {
    window.pauseMcatTools?.();
    window.pauseDatTools?.();
    if (typeof stopTimer === 'function') stopTimer();
    const root = el('<div></div>');
    root.appendChild(topbar('academy'));
    const view = name => `${esc(sectionUrl('academy'))}${sectionUrl('academy').includes('?') ? '&' : '?'}view=${name}`;
    // Open courses first, then the ones in review, each group in catalog order.
    const ordered = [...tracks.filter(track => track.available), ...tracks.filter(track => !track.available)];
    const firstClosed = ordered.findIndex(track => !track.available);
    const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
    const main = el(`<main class="academy-shell academy-catalog-page">
      <section class="academy-band">
        <div class="mn-wrap academy-intro">
          <span class="label">Your Academy</span>
          <h1>Choose what you want <em>to learn.</em></h1>
          <p>Find a path that fits your goal. Start with one useful session, and return to the work you save.</p>
          <div class="academy-band-actions">
            <a class="academy-primary" href="${view('today')}" id="academy-open-today">Plan my study day <span aria-hidden="true">→</span></a>
            <a class="academy-primary academy-primary--ghost" href="${esc(sectionUrl('mcat'))}" data-course="mcat">Start MCAT preparation <span aria-hidden="true">→</span></a>
          </div>
        </div>
      </section>
      <div class="mn-wrap academy-body">
        <nav class="academy-tools" aria-label="Study tools">
          <a href="${view('storage')}" data-academy-view>Study backups &amp; offline downloads</a>
          <a href="${view('portfolio')}" data-academy-view>My private portfolio</a>
          <a href="${view('curriculum')}" data-academy-view>Find lessons and connections across the Academy</a>
          <a href="${view('queue')}" data-academy-view>Optional retrieval practice</a>
        </nav>
        <div class="academy-catalog" aria-label="Learning paths">
          ${ordered
            .map(
              (
                track,
                i
              ) => `${i === 0 ? '<p class="academy-group">Open now</p>' : i === firstClosed ? '<p class="academy-group">In review</p>' : ''}<article class="academy-course${track.available ? '' : ' academy-course--closed'}">
            <span class="academy-course-num" aria-hidden="true">${track.available ? numerals[i] : ''}</span>
            <div class="academy-course-head">
              <h2><a href="${esc(sectionUrl(track.id))}" data-course="${track.id}">${esc(track.name)}</a></h2>
              <div class="academy-course-top"><span>${esc(track.kind)}</span><span class="academy-status">${status(track)}</span></div>
            </div>
            <div class="academy-course-copy">
              <p>${esc(track.description)}</p>
              <dl><div><dt>For</dt><dd>${esc(track.audience)}</dd></div></dl>
              <details class="academy-course-more">
                <summary>Before you start, and what is inside</summary>
                <dl>
                  <div><dt>Before you start</dt><dd>${esc(track.prerequisites)}</dd></div>
                  <div><dt>Inside</dt><dd>${esc(track.scope)}</dd></div>
                </dl>
              </details>
            </div>
            <div class="academy-course-bottom"><span>${esc(track.time)}</span>
              <a href="${esc(sectionUrl(track.id))}" data-course="${track.id}">${track.available || IS_LOCAL_PREVIEW || granted(track.id) ? esc(track.action) : 'View course status'} <span aria-hidden="true">→</span></a>
            </div>
          </article>`
            )
            .join('')}
        </div>
        <details class="academy-review-note">
          <summary>About course status and review</summary>
          <p>Beta material is available for evaluation. Not yet independently reviewed. A course's presence here describes its available material, not a qualification or a guarantee of learning outcomes.</p>
          <p>MCAT preparation is free forever. Your work stays on this device unless you choose to use an account or share it.</p>
        </details>
      </div>
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
