/* Rehearsal screens use the existing MCAT session/archive keys and study safeguards. */
(() => {
  'use strict';
  const Core = McatRehearsalCore,
    KEY = 'cs-mcat-rehearsal-v1',
    tags = new WeakMap();
  let ledgerState = null,
    catalog = null,
    generation = 0,
    timer = null,
    onScreen = false,
    screen = 'question',
    lastCheckpoint = 0;
  const now = () => Date.now();
  const active = () => typeof sim !== 'undefined' && sim?.rehearsalVersion === 1;
  const address = () => location.pathname + location.search;
  function route(runId = '') {
    const url = new URL(sectionUrl('mcat'), location.origin);
    url.searchParams.set('view', 'rehearsal');
    if (runId) url.searchParams.set('run', runId);
    const path = url.pathname + url.search;
    if (address() !== path) history.pushState({}, '', path);
  }
  function ledger() {
    if (ledgerState) return ledgerState;
    const value = StudyStorage.read(KEY, Core.emptyExposure());
    ledgerState = Core.validExposure(value) ? value : Core.emptyExposure();
    if (!Core.validExposure(value)) StudyStorage.sessionFailed();
    StudyStorage.watch(KEY, () => ledgerState);
    return ledgerState;
  }
  const saveLedger = () => StudyStorage.write(KEY, ledger());
  function persist() {
    if (!active() || sim.archived) return false;
    const run = sim;
    run._saved = now();
    run.screen = screen;
    if (!run.pausedAt) run._remain = Math.max(0, run.deadline - run._saved);
    StudyStorage.watch('cs-mcat-r-sim', () => run);
    return StudyStorage.write('cs-mcat-r-sim', Core.pack(run));
  }
  function stopClock() {
    if (timer) clearInterval(timer);
    timer = null;
  }
  function reset() {
    stopClock();
    onScreen = false;
    ledgerState = null;
    catalog = null;
    generation++;
  }
  function pause(reason = 'left-workspace', leave = true) {
    if (!active() || !onScreen || sim.archived) return;
    stopClock();
    if (['section', 'break'].includes(sim.phase)) {
      Core.interrupt(sim, reason, now());
      persist();
    }
    if (leave) onScreen = false;
  }
  function tag(root, descriptor) {
    tags.set(root, descriptor);
  }
  function recordDisplay(root) {
    const main = root.querySelector('main'),
      descriptor = tags.get(root) || tags.get(main);
    if (!descriptor) return;
    tags.delete(root);
    if (main) tags.delete(main);
    const state = ledger();
    if (descriptor.rehearsal && active() && sim.phase === 'section') {
      Core.present(sim, sim.idx, now(), !document.hidden);
      persist();
    }
    if (Core.expose(state, descriptor, now())) saveLedger();
  }
  function allowed(questionId, passageId) {
    const reserved = Core.reservedItems(ledger());
    return !StudyStorage.paused && !reserved.questions.has(questionId) && !reserved.passages.has(passageId);
  }
  function allow(descriptor, retry, fallback = renderMCAT) {
    if (allowed(descriptor.questionId, descriptor.passageId)) return true;
    if (StudyStorage.paused) return false;
    coursePauseTools();
    const state = ledger(),
      affected = Object.entries(state.reserved).filter(
        ([, r]) => r.questions.includes(descriptor.questionId) || r.passages.includes(descriptor.passageId)
      );
    const root = shell(
      'This material is reserved.',
      'You reserved a rehearsal that uses this material. Any existing practice session is still saved.',
      `<p>Release the relevant reservation to open it here, or keep it reserved and choose another activity. Releasing it does not change earlier exposure records.</p><div class="course-actions">${affected
        .map(
          ([id]) =>
            `<button class="btn" data-release="${esc(id)}">Release ${esc(
              catalog?.forms.find(form => form.id === id)?.title ||
                id
                  .replace(/^rehearsal-/, '')
                  .replaceAll('-', ' ')
                  .toUpperCase()
            )}</button>`
        )
        .join('')}<button class="btn" id="rehearsal-other">Keep reserved and leave</button></div>`
    );
    root.querySelectorAll('[data-release]').forEach(
      button =>
        (button.onclick = () => {
          if (StudyStorage.paused) return;
          delete state.reserved[button.dataset.release];
          if (saveLedger()) {
            if (allowed(descriptor.questionId, descriptor.passageId)) retry();
            else allow(descriptor, retry, fallback);
          }
        })
    );
    root.querySelector('#rehearsal-other').onclick = fallback;
    setView(root);
    return false;
  }
  function shell(title, description, body) {
    const root = el('<div></div>');
    root.appendChild(topbar('mcat'));
    root.appendChild(
      el(
        `<main class="course-page rehearsal-page"><span class="course-eyebrow">MCAT / REHEARSAL</span><h1>${esc(title)}</h1><p>${esc(description)}</p>${body}</main>`
      )
    );
    return root;
  }
  function historyRecords() {
    const records = courseExamReports();
    if (!Array.isArray(records)) {
      StudyStorage.sessionFailed();
      return [];
    }
    return records;
  }
  function knownHistory() {
    const passages = {};
    for (const record of QLOG) if (record.passage) passages[record.passage] = true;
    for (const run of historyRecords())
      for (const section of run.results || [])
        for (const item of section.items || []) if (item.passageId) passages[item.passageId] = true;
    for (const kind of ['cars', 'plab']) {
      const run = loadResume(kind);
      if (run?.p?.id) passages[run.p.id] = true;
    }
    if (typeof v2State !== 'undefined')
      for (const run of [
        v2State.coach.active,
        ...(v2State.coach.parked || []),
        ...(v2State.coach.history || []),
      ].filter(Boolean)) {
        const p = run.content?.passage;
        if (p?.id) passages[p.id] = true;
      }
    if (typeof v2State !== 'undefined')
      for (const id of Object.keys(v2State.coach.exposures || {})) passages[id] = true;
    return { questions: QHIST, passages };
  }
  async function load() {
    if (catalog) return catalog;
    const response = await fetch('data/mcat-rehearsals.json?v=5');
    if (!response.ok) throw Error('The rehearsal inventory could not load.');
    const data = await response.json();
    if (
      data.format !== 1 ||
      !Array.isArray(data.forms) ||
      !Array.isArray(data.protectedPassages) ||
      new Set(data.forms.map(f => f.id)).size !== data.forms.length
    )
      throw Error('The rehearsal inventory is incomplete.');
    catalog = data;
    return data;
  }
  async function home(selected = []) {
    pause();
    onScreen = false;
    route();
    const token = ++generation,
      path = address();
    ledger();
    setView(
      shell(
        'Loading rehearsal forms…',
        'Saved runs can be resumed without changing their original content.',
        '<p role="status">Checking the available form inventory.</p>'
      )
    );
    try {
      const data = await load();
      const checks = await Promise.all(
        data.forms.map(async form => {
          try {
            return { form, section: await Core.verify(form, MCAT, data.protectedPassages) };
          } catch (error) {
            return { form, error: error.message };
          }
        })
      );
      if (generation !== token || address() !== path) return;
      const previous = loadResume('sim'),
        history = knownHistory();
      const reports = checks.map(check => ({
        ...check,
        exposure: check.section ? Core.exposure(check.section, ledger(), history.questions, history.passages) : null,
      }));
      const root = shell(
        'Choose a rehearsal you can review.',
        'Fixed draft forms preserve their exact questions and passage text. They are practice material with pending content and rights review, not calibrated exams or score predictions.',
        `
        ${previous ? '<section class="course-notice"><h2>A timed run is already saved.</h2><p>Resume it before starting another. Its questions, answers and remaining-work record have been kept.</p><button class="btn btn-solid" id="rehearsal-resume">Resume saved run</button></section>' : ''}
        <form id="rehearsal-setup"><fieldset class="rehearsal-forms"><legend>Choose one or more sections</legend>${reports.map(({ form, section, error, exposure }) => `<article class="course-notice"><label class="rehearsal-choice"><input type="checkbox" name="form" value="${esc(form.id)}" ${selected.includes(form.section) ? 'checked' : ''} ${section ? '' : 'disabled'}><strong>${esc(form.title)}</strong></label><p>${form.section === 'cars' ? 53 : 59} questions · ${form.minutes} minutes · ${esc(form.status)}</p>${error ? `<p role="status">Unavailable: ${esc(error)}</p>` : `<p>${exposure.seenQuestions.length} questions with tracked displays · ${exposure.recordedQuestions.length} additional question-history records · ${new Set([...exposure.seenPassages, ...exposure.recordedPassages]).size} passages with a prior record.</p>`}<p>${esc(form.selectionNote)}</p>${section ? `<button class="btn" type="button" data-reserve="${esc(form.id)}">${ledger().reserved[form.id] ? 'Release reservation' : 'Reserve from ordinary practice'}</button>` : ''}</article>`).join('')}</fieldset>
        <p>Reservations retain the selected IDs even if this catalog cannot load later. They cannot undo prior exposure. A missing record does not prove that a question is new to you.</p>
        <fieldset><legend>Timing</legend><label class="rehearsal-choice"><input type="radio" name="timing" value="flexible" checked>Flexible practice: leaving or hiding the page pauses the section and records the interruption.</label><label class="rehearsal-choice"><input type="radio" name="timing" value="continuous">Continuous countdown: time continues through hidden tabs, reloads and breaks. Returning late can leave sections unanswered.</label></fieldset>
        <label for="rehearsal-exposure">Have you seen the selected material elsewhere?<select id="rehearsal-exposure" name="exposure"><option value="unsure">I am not sure</option><option value="not-aware">Not that I recall</option><option value="seen">Yes, some of it</option></select></label>
        <label class="rehearsal-choice"><input type="checkbox" name="repeat">Allow material with a prior record or reported exposure as repeated practice.</label>
        <p>Break targets between selected sections are 10 minutes, or 30 after CARS. In continuous mode a late break consumes the next section’s time. Flexible breaks can be longer and are recorded.</p>
        <p id="rehearsal-setup-status" role="status"></p><button class="btn btn-solid" type="submit" ${previous ? 'disabled' : ''}>Start selected draft rehearsal</button></form>
        <section><h2>Saved reviews</h2><div class="course-actions">${
          historyRecords()
            .map(
              run =>
                `<button class="btn" data-rehearsal-review="${esc(run.attemptId)}">${esc(new Date(run.finishedAt).toLocaleDateString())} · ${run.results?.length || 0} sections · ${run.rehearsalVersion ? 'Fixed draft form' : 'Legacy variable-length practice'}</button>`
            )
            .join('') || '<p>No saved timed runs yet.</p>'
        }</div></section>
        <details><summary>Shorter practice and format information</summary><p>The older short sets remain separate variable-length practice. Their saved timing does not establish a continuous exam-style run.</p><button class="btn" id="rehearsal-short">Open shorter practice</button><p><a href="${esc(data.formatSource.url)}" target="_blank" rel="noopener">AAMC section format</a> · checked ${esc(data.sourceCheckedOn)}. Independent content and rights reviews remain pending for these forms.</p></details><button class="backbtn" id="rehearsal-back">Back to MCAT</button>`
      );
      const form = root.querySelector('#rehearsal-setup'),
        status = root.querySelector('#rehearsal-setup-status');
      const selectedKeys = () =>
        Array.from(new FormData(form).getAll('form'))
          .map(id => data.forms.find(f => f.id === id)?.section)
          .filter(Boolean);
      root
        .querySelector('#rehearsal-resume')
        ?.addEventListener('click', () => RESUME_SPECS.find(s => s.key === 'sim').resume(previous));
      root.querySelectorAll('[data-reserve]').forEach(
        button =>
          (button.onclick = () => {
            if (StudyStorage.paused) return;
            const check = reports.find(r => r.form.id === button.dataset.reserve),
              selection = selectedKeys();
            Core.reserve(ledger(), check.section, !ledger().reserved[check.form.id]);
            if (saveLedger()) home(selection);
          })
      );
      form.onsubmit = event => {
        event.preventDefault();
        if (StudyStorage.paused || previous) return;
        const values = new FormData(form),
          ids = values.getAll('form'),
          chosen = reports
            .filter(r => ids.includes(r.form.id) && r.section)
            .sort((a, b) => Core.ORDER.indexOf(a.form.section) - Core.ORDER.indexOf(b.form.section));
        if (!chosen.length) {
          status.textContent = 'Choose at least one available section.';
          return;
        }
        const seen = values.get('exposure'),
          repeat = values.has('repeat');
        if ((seen === 'seen' || chosen.some(r => r.exposure.hasKnownExposure)) && !repeat) {
          status.textContent =
            'This selection has recorded or reported exposure. Choose other sections or explicitly allow repeated practice.';
          return;
        }
        if (StudyStorage.read('cs-mcat-r-sim', null)) {
          status.textContent = 'Resume the existing timed run before starting another.';
          return;
        }
        sim = Core.create(
          chosen.map(r => r.section),
          {
            mode: values.get('timing'),
            priorExposureSelfReport: seen,
            repeatAcknowledged: repeat,
            exposure: chosen.map(r => ({ formId: r.form.id, ...r.exposure })),
            reviewStatus: 'Draft; independent content and rights review pending',
          },
          studyAttemptId(),
          now()
        );
        route(sim.attemptId);
        onScreen = true;
        screen = 'question';
        if (persist()) drive();
      };
      root
        .querySelectorAll('[data-rehearsal-review]')
        .forEach(button => (button.onclick = () => courseOpenExam(button.dataset.rehearsalReview)));
      root.querySelector('#rehearsal-short').onclick = renderLegacySimHome;
      root.querySelector('#rehearsal-back').onclick = renderMCAT;
      setView(root);
      lockControls(root);
    } catch {
      if (generation !== token || address() !== path) return;
      const root = shell(
        'Rehearsal forms could not load.',
        'Your saved runs and reservations have been retained.',
        '<button class="btn" id="rehearsal-retry">Retry available material</button><button class="btn" id="rehearsal-saved">Open saved MCAT work</button>'
      );
      root.querySelector('#rehearsal-retry').onclick = async () => {
        catalog = null;
        await loadMCAT();
        home(selected);
      };
      root.querySelector('#rehearsal-saved').onclick = renderCourseProgress;
      setView(root);
    }
  }
  function logSection(result) {
    if (result.loggedAt) return true;
    for (let index = 0; index < result.items.length; index++) {
      const item = result.items[index],
        choice = result.answers[result.sectionIndex + ':' + index],
        correct = choice === item.q.answer;
      // Unpresented items remain in the run denominator but do not become
      // fabricated practice exposures in the general question history.
      if (!result.seen.includes(result.sectionIndex + ':' + index)) continue;
      if (!QLOG.some(a => a.attemptId === sim.attemptId && a.qId === item.q.id))
        QLOG.push({
          qId: item.q.id,
          section: result.key,
          category: item.q.category || 'CARS-' + String(item.q.skill || '').split('-')[1],
          passage: item.passageId,
          correct,
          unanswered: choice == null,
          conf: 'unsure',
          ts: result.endedAt,
          sim: true,
          attemptId: sim.attemptId,
        });
      const old = QHIST[item.q.id];
      QHIST[item.q.id] = {
        n: (old?.n || 0) + (old?.lastAttemptId === sim.attemptId ? 0 : 1),
        lastAttemptId: sim.attemptId,
        lastCorrect: correct,
        ts: result.endedAt,
      };
    }
    if (!saveQ()) return false;
    result.loggedAt = now();
    return persist();
  }
  function drive() {
    if (!active() || !onScreen || StudyStorage.paused) return;
    stopClock();
    for (let guard = 0; guard < 12; guard++) {
      const t = now();
      if (sim.phase === 'ready') {
        Core.begin(sim, t);
        if (!persist()) return;
      }
      if (sim.phase === 'section' && !sim.pausedAt && t >= sim.deadline) {
        Core.submit(sim, t);
        if (!persist()) return;
      }
      if (sim.phase === 'submitted') {
        if (!logSection(sim.results.at(-1))) return;
        Core.next(sim, t);
        if (!persist()) return;
        continue;
      }
      if (sim.phase === 'break' && sim.timing.mode === 'continuous' && t >= sim.timing.breaks.at(-1).deadline) {
        Core.endBreak(sim, t);
        if (!persist()) return;
        screen = 'question';
        continue;
      }
      if (sim.phase === 'finished') {
        if (!sim.archived) {
          if (!courseArchiveExam(sim)) return;
          if (!clearResume('sim')) return;
          sim.archived = true;
        }
        review(sim);
        return;
      }
      if (sim.phase === 'break') breakScreen();
      else if (screen === 'navigator') navigator();
      else questionScreen();
      if (!StudyStorage.paused && active() && !sim.archived) timer = setInterval(tick, 500);
      return;
    }
    StudyStorage.sessionFailed();
  }
  function tick() {
    if (!onScreen || !active() || StudyStorage.paused) {
      stopClock();
      return;
    }
    const t = now(),
      deadline = sim.phase === 'break' ? sim.timing.breaks.at(-1).deadline : sim.deadline;
    const node = document.getElementById('rehearsal-timer');
    if (node)
      node.textContent =
        sim.phase === 'break' && t > deadline && sim.timing.mode === 'flexible'
          ? 'Beyond the break target'
          : fmtTime((deadline - t) / 1000);
    if (
      !sim.pausedAt &&
      ((sim.phase === 'section' && t >= deadline) ||
        (sim.phase === 'break' && sim.timing.mode === 'continuous' && t >= deadline))
    ) {
      drive();
      return;
    }
    if (t - lastCheckpoint >= 15000) {
      lastCheckpoint = t;
      if (sim.phase === 'section' && screen === 'question' && !document.hidden && !sim.pausedAt)
        Core.present(sim, sim.idx, t, true);
      persist();
    }
  }
  function change(action, nextScreen = screen) {
    if (StudyStorage.paused || !active() || sim.archived) return;
    if (sim.phase === 'section' && now() >= sim.deadline) {
      drive();
      return;
    }
    if (action() === false) return;
    screen = nextScreen;
    if (persist()) drive();
  }
  function questionScreen() {
    const section = sim.queue[sim.si],
      item = section.items[sim.idx],
      q = item.q,
      key = sim.si + ':' + sim.idx;
    const root =
      el(`<div>${mcatTaskHeader([SEC_ABBR[section.key], `Q ${sim.idx + 1}/${section.items.length}`], `<span class="timer" id="rehearsal-timer">${fmtTime((sim.deadline - now()) / 1000)}</span>`, 'Save & leave')}
      <main class="case rehearsal-page"><p class="course-caption">${esc(section.form.title)} · ${sim.timing.mode === 'continuous' ? 'Continuous countdown' : 'Flexible practice'} · Draft content</p>
      ${item.passageText ? passageBody(item.passageTitle, item.passageText, item.table, item.contentNote) : ''}<h1 class="q">${esc(q.stem)}</h1><div class="opts">${McatV2Core.optionOrder(
        q.options,
        q.displayOrder
      )
        .map(
          (index, position) =>
            `<button class="opt ${sim.answers[key] === index ? 'picked' : ''}" data-rehearsal-answer="${index}" aria-pressed="${sim.answers[key] === index}"><span class="key">${'ABCD'[position]}</span><span>${esc(q.options[index])}</span></button>`
        )
        .join('')}</div>
      <div class="course-actions"><button class="btn" id="rehearsal-flag" aria-pressed="${!!sim.flags[key]}">${sim.flags[key] ? 'Flagged' : 'Flag for review'}</button>${section.key !== 'cars' ? '<button class="btn" id="rehearsal-table">Periodic table</button>' : ''}<button class="btn" id="rehearsal-prev" ${sim.idx === 0 ? 'disabled' : ''}>Previous</button><button class="btn" id="rehearsal-nav">Navigator</button><button class="btn btn-solid" id="rehearsal-next">${sim.idx + 1 === section.items.length ? 'Review section' : 'Next'}</button></div><p role="status" id="rehearsal-save-status">Selections save as you work. You can change them before submitting this section.</p></main></div>`);
    wireRunHeader(root, () => {
      pause();
      home();
    });
    root.querySelectorAll('[data-rehearsal-answer]').forEach(
      button =>
        (button.onclick = () => {
          if (StudyStorage.paused) return;
          if (now() >= sim.deadline) {
            drive();
            return;
          }
          if (!Core.answer(sim, Number(button.dataset.rehearsalAnswer), now()) || !persist()) return;
          root.querySelectorAll('[data-rehearsal-answer]').forEach(option => {
            const chosen = option === button;
            option.classList.toggle('picked', chosen);
            option.setAttribute('aria-pressed', String(chosen));
          });
          root.querySelector('#rehearsal-save-status').textContent =
            'Selection saved. You can revise it before submitting.';
        })
    );
    root.querySelector('#rehearsal-flag').onclick = event => {
      if (StudyStorage.paused) return;
      if (now() >= sim.deadline) {
        drive();
        return;
      }
      sim.flags[key] = !sim.flags[key];
      if (!persist()) return;
      event.currentTarget.textContent = sim.flags[key] ? 'Flagged' : 'Flag for review';
      event.currentTarget.setAttribute('aria-pressed', String(sim.flags[key]));
    };
    root.querySelector('#rehearsal-prev').onclick = () =>
      change(() => {
        if (sim.idx > 0) sim.idx--;
      });
    root.querySelector('#rehearsal-next').onclick = () =>
      change(
        () => {
          if (sim.idx + 1 < section.items.length) sim.idx++;
        },
        sim.idx + 1 === section.items.length ? 'navigator' : 'question'
      );
    root.querySelector('#rehearsal-nav').onclick = () =>
      change(() => Core.present(sim, sim.idx, now(), false), 'navigator');
    root.querySelector('#rehearsal-table')?.addEventListener('click', periodicModal);
    tag(root, { questionId: q.id, passageId: item.passageId, context: 'fixed-rehearsal', rehearsal: true });
    setView(root);
    lockControls(root);
  }
  function navigator() {
    const section = sim.queue[sim.si],
      blanks = section.items.filter((_, index) => sim.answers[sim.si + ':' + index] == null).length;
    Core.present(sim, sim.idx, now(), false);
    const root = shell(
      'Review this section before submitting.',
      `${blanks} unanswered. Answers remain hidden until the run ends.`,
      `<p>${esc(section.form.title)} · <span id="rehearsal-timer">${fmtTime((sim.deadline - now()) / 1000)}</span></p><div class="navgrid">${section.items
        .map((_, index) => {
          const key = sim.si + ':' + index,
            answered = sim.answers[key] != null,
            flagged = !!sim.flags[key];
          return `<button class="navcell ${answered ? 'ans' : ''} ${flagged ? 'fl' : ''}" data-rehearsal-jump="${index}" aria-label="Question ${index + 1}, ${answered ? 'answered' : 'unanswered'}${flagged ? ', flagged' : ''}">${index + 1}${flagged ? ' ⚑' : ''}</button>`;
        })
        .join(
          ''
        )}</div><div class="course-actions"><button class="btn btn-solid" id="rehearsal-submit">Submit section (${blanks} unanswered)</button><button class="btn" id="rehearsal-return">Back to current question</button><button class="btn" id="rehearsal-leave">Save & leave</button></div>`
    );
    root.querySelectorAll('[data-rehearsal-jump]').forEach(
      button =>
        (button.onclick = () =>
          change(() => {
            sim.idx = Number(button.dataset.rehearsalJump);
          }, 'question'))
    );
    root.querySelector('#rehearsal-submit').onclick = () => change(() => !!Core.submit(sim, now()));
    root.querySelector('#rehearsal-return').onclick = () => change(() => true, 'question');
    root.querySelector('#rehearsal-leave').onclick = () => {
      pause();
      home();
    };
    setView(root);
    lockControls(root);
  }
  function breakScreen() {
    const rest = sim.timing.breaks.at(-1),
      section = sim.queue[sim.si];
    const root = shell(
      'Take a break.',
      `${sim.results.length} of ${sim.queue.length} sections submitted. Answers stay hidden while this run continues.`,
      `<p>Next: ${esc(section.form.title)} · ${section.items.length} questions · ${section.durationMs / 60000} minutes.</p><p>Break target: ${rest.targetMs / 60000} minutes · <span id="rehearsal-timer">${fmtTime((rest.deadline - now()) / 1000)}</span></p><p>${sim.timing.mode === 'continuous' ? 'The next section starts at the break deadline, even if this tab is hidden or closed. You may start it earlier.' : 'Continue when ready. Extra break time is retained in the report.'}</p><div class="course-actions"><button class="btn btn-solid" id="rehearsal-continue">Start next section now</button><button class="btn" id="rehearsal-end">End this partial run and review</button><button class="btn" id="rehearsal-leave">Save & leave</button></div>`
    );
    root.querySelector('#rehearsal-continue').onclick = () => change(() => Core.endBreak(sim, now()), 'question');
    root.querySelector('#rehearsal-end').onclick = () => change(() => Core.finishEarly(sim, now()));
    root.querySelector('#rehearsal-leave').onclick = () => {
      pause();
      home();
    };
    setView(root);
    lockControls(root);
  }
  function resume(run, { reload = true } = {}) {
    try {
      run = Core.unpack(run);
    } catch {
      StudyStorage.sessionFailed();
      return;
    }
    pause();
    sim = run;
    route(run.attemptId);
    onScreen = true;
    screen = run.screen === 'navigator' ? 'navigator' : 'question';
    if (run.archived) {
      review(run);
      return;
    }
    Core.resume(run, now(), { reload });
    if (persist()) drive();
  }
  function review(run) {
    stopClock();
    onScreen = false;
    route(run.attemptId);
    const total = run.results.reduce((n, r) => n + r.total, 0),
      correct = run.results.reduce((n, r) => n + r.correct, 0);
    const root = shell(
      run.stoppedEarly ? 'Partial rehearsal saved.' : 'Rehearsal saved.',
      'Review the raw answers, timing and exposure separately. This draft practice result is not a scaled MCAT score.',
      `
      <p><strong>${correct}/${total} correct</strong> across ${run.results.length}/${run.queue.length} submitted sections. Unanswered questions in those sections remain in the denominator.</p>
      <p>${run.timing.mode === 'continuous' ? 'Continuous countdown' : 'Flexible practice'} · ${run.timing.interruptions.length} recorded ${run.timing.interruptions.length === 1 ? 'interruption' : 'interruptions'} · ${run.preflight.priorExposureSelfReport === 'seen' ? 'Earlier exposure reported' : run.preflight.priorExposureSelfReport === 'not-aware' ? 'No earlier exposure recalled' : 'Earlier exposure uncertain'}.</p>
      ${run.timing.clockChanged ? '<p class="course-notice">The device clock moved backward. Treat timing as interrupted; it cannot establish a continuous rehearsal.</p>' : ''}${run.timing.unobservedInterval ? '<p>An open display interval could not be observed across reload. It was excluded from display-time estimates.</p>' : ''}
      <section><h2>Pacing by section</h2>${run.results.map(r => `<article class="course-notice"><h3>${esc(run.queue[r.sectionIndex].form.title)}</h3><p>${r.correct}/${r.total} correct · ${r.unanswered} unanswered · ${r.seen.length} questions with a recorded display · ${(r.elapsedMs / 60000).toFixed(1)} section minutes · ${esc(r.reason)}.</p><p>Display intervals are estimates of time on a question screen, not measured reading or attention.</p></article>`).join('')}</section>
      <details><summary>Breaks and interruptions</summary><ul>${run.timing.breaks.map(b => `<li>After ${SEC_ABBR[b.afterSection]}: ${(b.elapsedMs / 60000).toFixed(1)} minutes until return/start action; target ${b.targetMs / 60000} minutes.</li>`).join('')}${run.timing.interruptions.map(i => `<li>${esc(i.reason)} · ${esc(new Date(i.at).toLocaleString())}${i.resumedAt ? ' · resumed ' + esc(new Date(i.resumedAt).toLocaleString()) : ''}</li>`).join('') || '<li>No break or interruption records.</li>'}</ul></details>
      <div class="drill-review"><h2>Saved question review</h2>${run.results
        .map(r =>
          r.items
            .map((item, index) => {
              const key = r.sectionIndex + ':' + index,
                chosen = r.answers[key],
                first = r.firstAnswers[key]?.chosen;
              return `<details class="rev" data-rehearsal-reveal="${r.sectionIndex}:${index}"><summary>${SEC_ABBR[r.key]} Q${index + 1} · ${chosen == null ? 'Unanswered' : chosen === item.q.answer ? 'Correct' : 'Revisit'}${run.flags[key] ? ' · Flagged' : ''}</summary><div class="rev-body">${item.passageText ? passageBody(item.passageTitle, item.passageText, item.table, item.contentNote, item.sources) : ''}<h3>${esc(item.q.stem)}</h3><ol type="A">${McatV2Core.optionOrder(
                item.q.options,
                item.q.displayOrder
              )
                .map(i => `<li>${esc(item.q.options[i])}</li>`)
                .join(
                  ''
                )}</ol><p>First: ${first == null ? 'No choice' : McatV2Core.optionLabel(item.q, first)} · Final: ${chosen == null ? 'Unanswered' : McatV2Core.optionLabel(item.q, chosen)} · Answer: ${McatV2Core.optionLabel(item.q, item.q.answer)} · Recorded display: ${((r.displayMs[key] || 0) / 1000).toFixed(0)} seconds.</p><p>${esc(item.q.explanation)}</p>${(item.q.distractors || []).map(d => `<p>${McatV2Core.optionLabel(item.q, d.i)}: ${esc(d.why)}</p>`).join('')}</div></details>`;
            })
            .join('')
        )
        .join(
          ''
        )}</div><div class="course-actions"><button class="btn" id="rehearsal-home">Choose another rehearsal</button><button class="btn" id="rehearsal-progress">MCAT progress</button></div>`
    );
    courseExamReviewControls(root.querySelector('main'), run);
    root.querySelectorAll('[data-rehearsal-reveal]').forEach(
      details =>
        (details.ontoggle = () => {
          if (!details.open) return;
          const [si, index] = details.dataset.rehearsalReveal.split(':').map(Number),
            item = run.results[si].items[index];
          if (
            Core.expose(
              ledger(),
              { questionId: item.q.id, passageId: item.passageId, context: 'saved-rehearsal-review' },
              now()
            )
          )
            saveLedger();
        })
    );
    root.querySelector('#rehearsal-home').onclick = () => home();
    root.querySelector('#rehearsal-progress').onclick = renderCourseProgress;
    setView(root);
    lockControls(root);
  }
  function lockControls(root) {
    if (!StudyStorage.paused) return;
    root.querySelectorAll('button,input,select,textarea').forEach(node => (node.disabled = true));
  }
  function entry() {
    const key = new URLSearchParams(location.search).get('run'),
      saved = loadResume('sim');
    if (key && saved?.attemptId === key)
      return saved.rehearsalVersion ? resume(saved) : RESUME_SPECS.find(s => s.key === 'sim').resume(saved);
    if (key) {
      const archived = historyRecords().find(r => r.attemptId === key);
      if (archived) return courseOpenExam(key);
    }
    return home();
  }
  window.addEventListener('pagehide', () => pause('page-closed'));
  document.addEventListener('visibilitychange', () => {
    if (!onScreen || !active() || sim.archived) return;
    if (document.hidden) pause('hidden-tab', false);
    else {
      Core.resume(sim, now());
      if (persist()) drive();
    }
  });
  window.addEventListener('study-storage-paused', () => {
    pause('save-failure', false);
    const root = document.querySelector('.rehearsal-page');
    if (root) lockControls(root);
  });
  window.addEventListener('study-storage-recovered', () => {
    if (location.pathname === '/mcat' && new URLSearchParams(location.search).get('view') === 'rehearsal') {
      if (active() && !sim.archived) {
        onScreen = true;
        Core.resume(sim, now());
        if (persist()) drive();
      } else entry();
    }
  });
  window.McatRehearsal = Object.freeze({
    home,
    entry,
    resume,
    review,
    pause,
    allow,
    allowed,
    tag,
    recordDisplay,
    reset,
    passageDisplays: () =>
      Object.fromEntries(Object.entries(ledger().passages).map(([id, record]) => [id, record.firstAt])),
  });
})();
