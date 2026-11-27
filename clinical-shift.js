/* Clinical Shift pilot — specialty-only, hidden-patient clinical reasoning loop.
   Every step is one tap: nothing is typed, and the only text box is an optional notepad that is never
   scored. An encounter with a reaction layer (data/clinical-shift-pilot.json, `reactions`) runs as a
   reacting patient: plain wording, a shift clock, and a consequence for every option. Without one it runs
   in the classic format, where correctness stays hidden until the debrief. */
(() => {
  'use strict';

  const SHIFT_STORAGE_KEY = 'cs-clinical-shift-v1';
  const SHIFT_MANIFEST_URL = 'data/clinical-shift-pilot.json?v=22';
  const SHIFT_STEPS = ['Handoff', 'Investigate', 'Decide', 'Debrief'];
  /* One tap answers a question. A second tap that lands just after it (a double click, a bounced touch)
     must not answer the next question or skip an outcome, so the buttons that commit a call start inert
     and wake up after this long. */
  const SHIFT_TAP_HOLD_MS = 450;
  const SHIFT_HELD = SHIFT_TAP_HOLD_MS > 0 ? 'disabled data-cshift-hold' : '';
  /* The optional notepad holds the learner's own words. It is saved with the shift and never scored.
     A save writes every saved shift, so the notepad is saved a moment after the typing stops, not on
     each key. */
  const SHIFT_NOTES_MAX = 4000;
  const SHIFT_NOTES_SAVE_MS = 400;
  /* Reacting patients: every question or check moves the shift clock by this many minutes. */
  const SHIFT_MINUTES_PER_INQUIRY = 2;
  /* How the patient is doing. A higher rank is a worse place to end a shift. */
  const SHIFT_STATUS = {
    better: { label: 'Improving', rank: 0 },
    stable: { label: 'Stable for now', rank: 0 },
    unstable: { label: 'Unstable', rank: 1 },
    worse: { label: 'Getting worse', rank: 2 },
    critical: { label: 'Critical', rank: 3 },
  };
  const SHIFT_VITALS = [
    ['HR', 'Heart rate'],
    ['BP', 'Blood pressure'],
    ['SpO2', 'Oxygen'],
    ['RR', 'Breaths / min'],
    ['Temp', 'Temperature'],
  ];
  const SHIFT_VERDICTS = {
    safe: minutes => `Safe call · ${minuteCount(minutes)} used`,
    'near-miss': minutes => `Near miss · stopped in time, ${minuteCount(minutes)} lost`,
    delay: minutes => `Unsafe delay · ${minuteCount(minutes)} lost`,
  };
  const SHIFT_ICONS = {
    resident:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v3a4 4 0 0 0 8 0v-2"/><circle cx="18" cy="12" r="2"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    safe: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    'near-miss':
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5"/><path d="M12 16v.3"/></svg>',
    delay:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l9 16H3z"/><path d="M12 10v4"/><path d="M12 17.2v.3"/></svg>',
    patient:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.6-3.6 3.3-5.5 7-5.5s6.4 1.9 7 5.5"/></svg>',
    decide:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h6"/><path d="M10 12l5-6h5"/><path d="M10 12l5 6h5"/><path d="M17.5 3.5L20 6l-2.5 2.5"/><path d="M17.5 15.5L20 18l-2.5 2.5"/></svg>',
    debrief:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3.5-4 3 2.5L19 8"/></svg>',
  };
  let shiftManifest = null;
  let shiftSession = null;
  /* Whether the notepad is open. It stays as the learner left it from one question to the next. */
  let shiftNotesOpen = false;
  let shiftNotesTimer = null;

  function minuteCount(minutes) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  }

  /* 75 minutes on shift reads 01:15, the way a ward clock would show it. */
  function shiftClock(minutes) {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  /* A reaction layer is written against one revision of a case. If it no longer lines up with the case's
     decisions, it is ignored and the encounter runs in the classic format, so a consequence can never
     be shown for the wrong option. */
  function reactionUsable(caseData, reaction) {
    const text = value => typeof value === 'string' && value.trim().length > 0;
    const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
    if (!object(reaction) || !object(reaction.decisions) || !object(reaction.differential)) return false;
    const vital = (value, allowed) =>
      value === undefined ||
      (object(value) &&
        Object.entries(value).every(([key, item]) => Object.hasOwn(caseData.vitals, key) && allowed(item)));
    const decisionStages = caseData.stages
      .map((stage, index) => ({ stage, index }))
      .filter(({ stage }) => stage.type === 'question' && stage.label !== 'DIAGNOSIS');
    const diagnosis = caseData.stages.find(stage => stage.type === 'question' && stage.label === 'DIAGNOSIS');
    return (
      Object.keys(reaction.decisions).length === decisionStages.length &&
      decisionStages.every(({ stage, index }) => {
        const decision = reaction.decisions[index];
        return (
          object(decision) &&
          text(decision.resident) &&
          text(decision.question) &&
          Array.isArray(decision.options) &&
          decision.options.length === stage.options.length &&
          decision.options.every(text) &&
          Array.isArray(decision.outcomes) &&
          decision.outcomes.length === stage.options.length &&
          decision.outcomes.every(
            (outcome, choice) =>
              object(outcome) &&
              (choice === stage.answer ? outcome.kind === 'safe' : ['near-miss', 'delay'].includes(outcome.kind)) &&
              Number.isInteger(outcome.minutes) &&
              outcome.minutes > 0 &&
              text(outcome.story) &&
              text(outcome.reply) &&
              vital(outcome.vitals, text) &&
              vital(outcome.trend, item => item === 'up' || item === 'down') &&
              (outcome.status === undefined || Object.hasOwn(SHIFT_STATUS, outcome.status)) &&
              (outcome.alarm === undefined || typeof outcome.alarm === 'string')
          )
        );
      }) &&
      !!diagnosis &&
      text(reaction.differential.question) &&
      Array.isArray(reaction.differential.options) &&
      reaction.differential.options.length === diagnosis.options.length &&
      reaction.differential.options.every(text)
    );
  }

  /* The frozen reaction layer of an encounter, or null when it runs in the classic format. */
  function reactionOf(active) {
    return active?.content?.reactions || null;
  }

  function startingPatient(reaction) {
    const start = reaction?.start || {};
    return {
      status: Object.hasOwn(SHIFT_STATUS, start.status) ? start.status : 'stable',
      vitals: {},
      trend: {},
      tone: '',
      alarm: typeof start.alarm === 'string' ? start.alarm : '',
    };
  }

  /* Encounters saved before the reacting patient existed have no clock; they keep working without one. */
  function normalizeReactiveState(active) {
    if (!Number.isFinite(active.clock) || active.clock < 0) active.clock = 0;
    if (!Array.isArray(active.events)) active.events = [];
    const patient = active.patient;
    if (!patient || typeof patient !== 'object' || !Object.hasOwn(SHIFT_STATUS, patient.status))
      active.patient = startingPatient(reactionOf(active));
    for (const key of ['vitals', 'trend'])
      if (!active.patient[key] || typeof active.patient[key] !== 'object') active.patient[key] = {};
    if (typeof active.patient.alarm !== 'string') active.patient.alarm = '';
    return active;
  }

  function blankShiftState() {
    return { version: 1, active: null, completed: {}, history: [] };
  }

  function loadShiftState() {
    const value = StudyStorage.read(SHIFT_STORAGE_KEY, blankShiftState());
    const object = v => v && typeof v === 'object' && !Array.isArray(v);
    if (
      !object(value) ||
      value.version !== 1 ||
      !object(value.completed) ||
      !Array.isArray(value.history) ||
      (value.active != null &&
        (!object(value.active) ||
          !value.active.caseId ||
          !value.active.key ||
          !object(value.active.locks) ||
          !object(value.active.drafts) ||
          !object(value.active.optionOrders) ||
          !object(value.active.differential) ||
          !Array.isArray(value.active.differential.ranked) ||
          !Array.isArray(value.active.resultsRevealed) ||
          !object(value.active.note)))
    ) {
      StudyStorage.sessionFailed();
      return blankShiftState();
    }
    return { ...blankShiftState(), ...value };
  }

  let shiftState = loadShiftState();
  StudyStorage.watch(SHIFT_STORAGE_KEY, () => shiftState);
  for (const [key, field] of [
    ['cs-progress', 'progress'],
    ['cs-cases', 'cases'],
    ['cs-history', 'history'],
    ['cs-streak', 'streak'],
  ]) {
    const saved = StudyStorage.read(key, store[field]);
    if (JSON.stringify(saved) !== JSON.stringify(field === 'history' ? store.history.slice(0, 400) : store[field]))
      StudyStorage.sessionFailed();
    StudyStorage.watch(key, () => (field === 'history' ? store.history.slice(0, 400) : store[field]));
  }
  window.addEventListener('study-storage-recovered', () => {
    if (location.pathname.replace(/\/$/, '') !== '/practice') return;
    if (new URLSearchParams(location.search).get('view') === 'longitudinal') return;
    if (new URLSearchParams(location.search).get('view') === 'shift-history') {
      renderClinicalShift();
      return;
    }
    if (shiftSession && shiftState.active) {
      shiftRoute(shiftState.active);
      renderActiveShiftPhase();
    } else renderClinicalShift();
  });

  function saveShiftState() {
    if (shiftNotesTimer !== null) clearTimeout(shiftNotesTimer);
    shiftNotesTimer = null;
    return StudyStorage.write(SHIFT_STORAGE_KEY, shiftState);
  }

  /* What is typed on the notepad is in the encounter at once and on disk shortly after. Every other save
     carries it too, and it is written straight away when the learner leaves the notepad or the page. */
  function saveNotesSoon() {
    if (shiftNotesTimer !== null) clearTimeout(shiftNotesTimer);
    shiftNotesTimer = setTimeout(saveShiftState, SHIFT_NOTES_SAVE_MS);
  }
  function saveNotesNow() {
    if (shiftNotesTimer !== null) saveShiftState();
  }
  window.addEventListener('pagehide', saveNotesNow);
  if (typeof document !== 'undefined')
    document.addEventListener('visibilitychange', () => document.hidden && saveNotesNow());

  function shiftRoute(active = null) {
    const url = new URL(location.href);
    url.pathname = '/practice';
    ['view', 'run'].forEach(key => url.searchParams.delete(key));
    if (active) {
      url.searchParams.set('view', 'shift');
      url.searchParams.set('run', active.runId);
    }
    if (url.href !== location.href) history.pushState({}, '', url.pathname + url.search);
  }

  function renderShiftError(message, retry) {
    const root = el('<div></div>');
    root.appendChild(topbar('practice'));
    const main = el(
      `<main class="panel cshift-loading" id="main"><span class="label">Clinical Shift</span><h1>The patient could not open.</h1><p>${esc(message)} Your saved work has been kept.</p><button class="btn btn-solid" id="cshift-retry">Try again</button><button class="btn" id="cshift-back-hub">Back to specialties</button></main>`
    );
    main.querySelector('#cshift-retry').addEventListener('click', retry);
    main.querySelector('#cshift-back-hub').addEventListener('click', () => {
      shiftRoute();
      renderClinicalShift();
    });
    root.appendChild(main);
    setShiftView(root);
  }

  /* A side column taller than the window sticks by its lower edge, so the chart and the notepad under
     the monitor can always be scrolled into view. The column is watched, because it grows when a chart
     section opens or the notepad is dragged taller. */
  let shiftSideWatched = null;
  const shiftSideWatcher = typeof ResizeObserver === 'function' ? new ResizeObserver(() => fitShiftSide()) : null;
  function fitShiftSide() {
    const side = typeof document === 'undefined' ? null : document.querySelector('.cshift-side');
    if (side)
      side.style.setProperty('--cshift-side-top', `${Math.min(76, window.innerHeight - side.offsetHeight - 24)}px`);
    if (shiftSideWatcher && side !== shiftSideWatched) {
      shiftSideWatcher.disconnect();
      if (side) shiftSideWatcher.observe(side);
      shiftSideWatched = side;
    }
  }
  window.addEventListener('resize', fitShiftSide);
  if (typeof document !== 'undefined')
    document.addEventListener('toggle', event => event.target.closest?.('.cshift-side') && fitShiftSide(), true);

  function setShiftView(root, { preserveScroll = false, focusSelector = '' } = {}) {
    const previousScroll = preserveScroll ? window.scrollY : 0;
    setView(root);
    fitShiftSide();
    if (preserveScroll || focusSelector)
      requestAnimationFrame(() => {
        if (preserveScroll) window.scrollTo(0, previousScroll);
        if (focusSelector) root.querySelector(focusSelector)?.focus({ preventScroll: true });
      });
  }

  async function loadShiftManifest() {
    if (shiftManifest) return shiftManifest;
    const response = await fetch(SHIFT_MANIFEST_URL);
    if (!response.ok) throw new Error('Clinical Shift manifest unavailable');
    const value = await response.json();
    if (
      !Array.isArray(value.rotations) ||
      !value.rotations.length ||
      value.rotations.some(
        rotation =>
          !rotation.key ||
          !rotation.name ||
          !Array.isArray(rotation.caseIds) ||
          !rotation.caseIds.length ||
          rotation.caseIds.some(
            id =>
              !value.modelNotes?.[id]?.assessment ||
              !value.modelNotes[id].plan ||
              !value.investigations?.[id]?.interview?.length ||
              !value.investigations[id].exam?.length
          )
      )
    )
      throw new Error('Clinical Shift manifest is incomplete');
    shiftManifest = value;
    return shiftManifest;
  }

  function rotationFor(key) {
    return shiftManifest?.rotations.find(rotation => rotation.key === key) || null;
  }

  function caseIsCompatible(caseData) {
    if (
      !caseData?.id ||
      !caseData.patient ||
      !caseData.history ||
      !caseData.exam ||
      !caseData.vitals ||
      !Array.isArray(caseData.pearls) ||
      !Array.isArray(caseData.stages)
    )
      return false;
    const diagnosisStages = caseData.stages.filter(stage => stage.type === 'question' && stage.label === 'DIAGNOSIS');
    const firstResult = caseData.stages.findIndex(stage => stage.type === 'result');
    const diagnosisIndex = caseData.stages.findIndex(stage => stage.type === 'question' && stage.label === 'DIAGNOSIS');
    return (
      caseData.stages[0]?.type === 'question' &&
      caseData.stages[0]?.label === 'INITIAL APPROACH' &&
      diagnosisStages.length === 1 &&
      firstResult > 0 &&
      firstResult < diagnosisIndex &&
      caseData.stages.slice(diagnosisIndex + 1).some(stage => stage.type === 'question') &&
      caseData.stages.every(stage =>
        stage.type === 'result' ? typeof stage.content === 'string' : stage.type === 'question'
      ) &&
      caseData.stages
        .filter(stage => stage.type === 'question')
        .every(
          stage =>
            stage.question &&
            stage.explanation &&
            Array.isArray(stage.options) &&
            stage.options.length >= 4 &&
            stage.options.every(option => typeof option === 'string' && option.trim()) &&
            Number.isInteger(stage.answer) &&
            stage.answer >= 0 &&
            stage.answer < stage.options.length
        )
    );
  }

  function activeIsCompatible(active, caseData) {
    const validChoice = (index, choice) => {
      const stage = caseData.stages[Number(index)];
      return stage?.type === 'question' && Number.isInteger(choice) && choice >= 0 && choice < stage.options.length;
    };
    return (
      ['handoff', 'investigate', 'timeline', 'decision', 'differential', 'note', 'debrief'].includes(active.phase) &&
      Number.isInteger(active.stageCursor) &&
      active.stageCursor >= 0 &&
      active.stageCursor <= caseData.stages.length &&
      Object.entries(active.locks).every(([index, lock]) => lock && validChoice(index, lock.choice)) &&
      Object.entries(active.drafts).every(([index, choice]) => validChoice(index, choice)) &&
      Object.entries(active.optionOrders).every(
        ([index, order]) =>
          Array.isArray(order) &&
          order.length === caseData.stages[Number(index)]?.options?.length &&
          new Set(order).size === order.length &&
          order.every(choice => validChoice(index, choice))
      ) &&
      active.resultsRevealed.every(index => Number.isInteger(index) && caseData.stages[index]?.type === 'result') &&
      new Set(active.differential.ranked).size === active.differential.ranked.length &&
      active.differential.ranked.length <= 3 &&
      active.differential.ranked.every(choice => validChoice(active.differential.stageIndex, choice)) &&
      ['assessment', 'plan'].every(key => typeof active.note[key] === 'string') &&
      (active.notes === undefined || typeof active.notes === 'string') &&
      reactiveStateIsCompatible(active, caseData, validChoice)
    );
  }

  /* The clock, the patient and the event log are optional (older encounters have none), but when they
     are present they have to describe this case. */
  function reactiveStateIsCompatible(active, caseData, validChoice) {
    const reaction = active.content?.reactions;
    if (reaction != null && !reactionUsable(caseData, reaction)) return false;
    if (active.clock !== undefined && !(Number.isFinite(active.clock) && active.clock >= 0)) return false;
    const patient = active.patient;
    if (
      patient !== undefined &&
      !(
        patient &&
        typeof patient === 'object' &&
        Object.hasOwn(SHIFT_STATUS, patient.status) &&
        ['vitals', 'trend'].every(key => patient[key] && typeof patient[key] === 'object')
      )
    )
      return false;
    return (
      active.events === undefined ||
      (Array.isArray(active.events) &&
        active.events.every(
          event =>
            event &&
            typeof event === 'object' &&
            caseData.stages[event.stage]?.type === 'question' &&
            Number.isFinite(event.at) &&
            Number.isFinite(event.minutes) &&
            Object.hasOwn(SHIFT_STATUS, event.status) &&
            (event.type === 'fix' ||
              (event.type === 'decision' &&
                validChoice(event.stage, event.choice) &&
                Object.hasOwn(SHIFT_VERDICTS, event.kind)))
        ))
    );
  }

  function completedCount(rotation) {
    return rotation.caseIds.filter(id => shiftState.completed[id]?.attempts).length;
  }

  function renderShiftLoading(message = 'Preparing the rotation…') {
    stopTimer();
    session = null;
    const root = el('<div></div>');
    root.appendChild(topbar('practice'));
    root.appendChild(
      el(
        `<main class="panel cshift-loading" id="main"><span class="label">Clinical Shift</span><h1>${esc(message)}</h1><p>Building your patient assignment and opening the chart.</p></main>`
      )
    );
    setShiftView(root);
  }

  /* A debriefed encounter is already archived in history; it is never an unfinished shift. */
  const shiftInProgress = () => !!shiftState.active && !shiftState.active.completedAt;
  function releaseFinishedShift() {
    if (!shiftState.active?.completedAt) return false;
    shiftState.active = null;
    shiftSession = null;
    return true;
  }

  function activeRotationName() {
    const name = rotationFor(shiftState.active?.key)?.name || NAME_BY_KEY[shiftState.active?.key] || 'Clinical Shift';
    return shiftState.active?.shuffle ? `Shuffle · ${name}` : name;
  }

  function confirmShiftEnd(trigger, onConfirm, replacement = false) {
    const main = trigger.closest('main'),
      runId = shiftState.active?.runId;
    if (!main || main.querySelector('dialog') || StudyStorage.paused) return;
    const dialog =
      el(`<dialog class="cshift-confirm" aria-labelledby="cshift-confirm-title" aria-describedby="cshift-confirm-description">
      <h2 id="cshift-confirm-title">${replacement ? 'Accept a different patient?' : 'End this shift?'}</h2>
      <p id="cshift-confirm-description">${replacement ? 'Your current patient will be replaced when the new patient is ready.' : 'Your current patient and the calls you have made will be removed.'} Completed shifts stay in your history.</p>
      <div><button class="btn" id="cshift-keep" autofocus>Keep current shift</button><button class="btn btn-solid" id="cshift-confirm-end">${replacement ? 'Replace patient' : 'End shift'}</button></div>
    </dialog>`);
    const finish = accepted => {
      dialog.close();
      dialog.remove();
      if (accepted && main.isConnected && shiftState.active?.runId === runId && !StudyStorage.paused) onConfirm();
      else if (trigger.isConnected && !StudyStorage.paused) trigger.focus();
    };
    dialog.querySelector('#cshift-keep').addEventListener('click', () => finish(false));
    dialog.querySelector('#cshift-confirm-end').addEventListener('click', () => finish(true));
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      finish(false);
    });
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const first = dialog.querySelector('#cshift-keep'),
        last = dialog.querySelector('#cshift-confirm-end');
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    main.appendChild(dialog);
    dialog.showModal();
    dialog.querySelector('#cshift-keep').focus();
  }

  async function renderClinicalShift() {
    stopTimer();
    session = null;
    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'shift-history') {
      renderShiftHistory(params.get('run'));
      return;
    }
    if (new URLSearchParams(location.search).get('view') === 'longitudinal') {
      await ClinicalLongitudinal.entry();
      return;
    }
    if (!shiftManifest) {
      renderShiftLoading();
      try {
        await loadShiftManifest();
      } catch (error) {
        console.error('Clinical Shift load failed', error);
        renderShiftError('The rotation download failed.', renderClinicalShift);
        return;
      }
    }

    if (location.pathname.replace(/\/$/, '') !== '/practice') return;
    if (params.get('view') === 'content') {
      renderShiftContentStatus();
      return;
    }
    if (params.get('view') === 'shift' && params.get('run') === shiftState.active?.runId) {
      await resumeClinicalShift();
      return;
    }
    const root = el('<div></div>');
    root.appendChild(topbar('practice'));
    const active = shiftInProgress() ? shiftState.active : null;
    const rotations = shiftManifest.rotations;
    const encounterCount = rotations.reduce((sum, rotation) => sum + rotation.caseIds.length, 0);
    const seenCount = rotations.reduce((sum, rotation) => sum + completedCount(rotation), 0);
    const reactingIn = rotation => rotation.caseIds.filter(id => shiftManifest.reactions?.[id]).length;
    const reactingRotations = rotations.filter(rotation => reactingIn(rotation) > 0);
    const everyPatientReacts = rotations.every(rotation => reactingIn(rotation) === rotation.caseIds.length);
    const rotationCode = rotation => String(rotation.caseIds[0]).split('-')[0].toUpperCase();
    // The board has room for three rotations; the rest share one last row.
    const boardRotations = rotations.slice(0, 3);
    const offBoard = rotations.slice(3);
    const offBoardWaiting = offBoard.reduce(
      (sum, rotation) => sum + rotation.caseIds.length - completedCount(rotation),
      0
    );
    const longDate = iso =>
      new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const checkedOn = rotations
      .flatMap(rotation => rotation.caseIds)
      .flatMap(id => [shiftManifest.caseReviews?.[id]?.sourceCheckedOn, shiftManifest.reactions?.[id]?.sourceCheckedOn])
      .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date || ''))
      .sort();
    const sourceChecks = !checkedOn.length
      ? 'Source checks are recorded with each encounter'
      : checkedOn[0] === checkedOn.at(-1)
        ? `Case sources checked ${longDate(checkedOn[0])}`
        : `Case sources checked between ${longDate(checkedOn[0])} and ${longDate(checkedOn.at(-1))}`;
    const lede = everyPatientReacts
      ? 'Pick a rotation and meet your patient. What you decide changes what happens to them. No clinical experience needed: a resident works beside you.'
      : reactingRotations.length
        ? `Pick a rotation and meet your patient. In ${reactingRotations.map(rotation => rotation.name).join(' and ')}, the patient reacts to what you decide, and a resident works beside you. No clinical experience needed there.`
        : 'Pick a rotation and meet your patient. Review the chart, make your calls and name the diagnosis, then see how each call held up.';
    const rotationTag = rotation => {
      const reacting = reactingIn(rotation);
      if (!reacting) return 'Classic format · some clinical knowledge helps';
      return reacting === rotation.caseIds.length
        ? 'The patient reacts to your calls'
        : `${reacting} of ${rotation.caseIds.length} patients react to your calls so far`;
    };
    const main = el(`<main class="panel cshift-hub" id="main">
      <header class="cshift-hub-hero cshift-ward-hero">
        <div class="cshift-hero-copy">
          <span class="label">Clinical Scenarios · Beta</span>
          <h1>Start <em>your shift.</em></h1>
          <p>${esc(lede)}</p>
          <div class="cshift-hero-actions"><button class="btn btn-solid" id="cshift-hero-start">Choose a rotation ↓</button><button class="btn" id="cshift-hero-how">How a shift works</button></div>
          <span class="cshift-hero-meta">${rotations.length} rotations · ${encounterCount} patients · free</span>
        </div>
        <div class="cshift-ward" aria-hidden="true">
          <div class="cshift-ward-case"><div class="cshift-ward-screen">
            <div class="cshift-ward-top"><span>WARD BOARD</span><strong><i></i>SHIFT OPEN</strong></div>
            <svg class="cshift-ecg" viewBox="0 0 360 64">${ecgMarkup(72, false)}</svg>
            <ul>${boardRotations
              .map(rotation => {
                const waiting = rotation.caseIds.length - completedCount(rotation);
                return `<li><b>${esc(rotationCode(rotation))}</b><span>${esc(rotation.name)}</span><em>${waiting ? `${waiting} waiting` : 'all seen'}</em></li>`;
              })
              .join('')}${
              offBoard.length
                ? `<li><b>+${offBoard.length}</b><span>more ${offBoard.length === 1 ? 'rotation' : 'rotations'}</span><em>${offBoardWaiting ? `${offBoardWaiting} waiting` : 'all seen'}</em></li>`
                : ''
            }</ul>
            <p>&gt; pick a rotation to meet your patient</p>
          </div></div>
          <span class="cshift-ward-neck"></span><span class="cshift-ward-foot"></span>
          <div class="cshift-ward-desk"><span></span><span></span></div>
        </div>
        <p class="cshift-content-status">Beta. ${encounterCount} fictional encounters, about 5–10 minutes each. ${sourceChecks}; independent clinician review remains pending. Practice decisions do not establish clinical competence, and nothing here is medical advice.</p>
      </header>
      ${
        active
          ? `<section class="cshift-resume">
        <div><span class="label">Shift in progress</span><strong>${esc(activeRotationName())}</strong><p>Your patient and every call you have made are saved on this device.</p></div>
        <div><button class="btn btn-solid" id="cshift-resume">Continue shift →</button><button class="ghostbtn" id="cshift-end-active">End shift</button></div>
      </section>`
          : ''
      }
      <section class="cshift-how" id="cshift-how" aria-labelledby="cshift-how-title">
        <div class="cshift-section-head"><div><span class="label">How a shift works</span><h2 id="cshift-how-title" tabindex="-1">Four steps, one patient at a time.</h2></div></div>
        <ol>${[
          ['patient', 'Meet the patient', 'A handoff tells you who is waiting and why.'],
          ['resident', 'Ask and examine', 'Choose what to ask and what to check. The answers go in the chart.'],
          ['decide', 'Decide', 'One tap makes each call, and a call is final. Nothing to type.'],
          ['debrief', 'Debrief', 'See how each call held up, and why.'],
        ]
          .map(
            ([icon, title, text], index) =>
              `<li><div><span>${index + 1}</span>${SHIFT_ICONS[icon]}</div><strong>${title}</strong><p>${text}</p></li>`
          )
          .join('')}</ol>
      </section>
      <section class="cshift-rotations" aria-labelledby="cshift-rotations-title">
        <div class="cshift-section-head"><div><span class="label">Choose a rotation</span><h2 id="cshift-rotations-title" tabindex="-1">Where do you want to work today?</h2></div><span>${rotations.length} rotations · ${encounterCount} patients</span></div>
        <div class="cshift-rotation-cards">
          <button class="cshift-rotation cshift-rotation-shuffle" data-shift-shuffle aria-label="Start a shuffle shift · ${seenCount} of ${encounterCount} completed · a patient from any rotation each time">
            <span class="cshift-rotation-num">MIX</span>
            <span class="cshift-rotation-progress">${seenCount}/${encounterCount} completed</span>
            <span class="cshift-rotation-copy"><strong>Shuffle</strong><span>A patient from any rotation each time. You find out where you are working when you meet them.</span></span>
            <span class="cshift-rotation-tag">All ${rotations.length} rotations · new patients first</span>
            <span class="cshift-rotation-go" aria-hidden="true"><span>Start</span> →</span>
          </button>
          ${rotations
            .map(
              rotation => `<button class="cshift-rotation" data-shift-specialty="${esc(rotation.key)}" aria-label="Start ${esc(rotation.name)} shift · ${completedCount(rotation)} of ${rotation.caseIds.length} completed · ${esc(rotationTag(rotation))}">
            <span class="cshift-rotation-num">${esc(rotationCode(rotation))}</span>
            <span class="cshift-rotation-progress">${completedCount(rotation)}/${rotation.caseIds.length} completed</span>
            <span class="cshift-rotation-copy"><strong>${esc(rotation.name)}</strong><span>${esc(rotation.description)}</span></span>
            <span class="cshift-rotation-tag ${reactingIn(rotation) ? 'is-reacting' : ''}">${esc(rotationTag(rotation))}</span>
            <span class="cshift-rotation-go" aria-hidden="true"><span>Start</span> →</span>
          </button>`
            )
            .join('')}
        </div>
      </section>
      <section class="cshift-classic">
        <div><span class="label">Your completed work</span><h2>Return to a finished shift.</h2><p>Open the patient, your calls and the debrief from a completed shift.</p></div>
        <button class="btn" id="cshift-history">Saved shifts</button>
      </section>
      <section class="cshift-classic">
        <div><span class="label">Patient timelines</span><h2>Follow a patient over time.</h2><p>Three fictional encounters with new evidence, competing explanations and a written handoff. Preserve your first reasoning and explain what changed. Independent clinician review is pending.</p></div>
        <button class="btn" id="cshift-longitudinal">Open patient timelines</button>
      </section>
      <section class="cshift-classic">
        <div><span class="label">Existing draft library</span><h2>Explore the full case bank.</h2><p>The original cases and new rotation encounters are available here. Source checks for the selected shifts do not cover the broader draft library.</p></div>
        <div><button class="btn" id="cshift-classic">Classic case bank</button><button class="ghostbtn" id="cshift-review">Case bank history</button><button class="ghostbtn" id="cshift-content">Case sources & teaching objectives</button></div>
      </section>
    </main>`);

    for (const [button, target] of [
      ['#cshift-hero-start', '#cshift-rotations-title'],
      ['#cshift-hero-how', '#cshift-how-title'],
    ])
      main.querySelector(button).addEventListener('click', () => {
        const heading = main.querySelector(target);
        heading.scrollIntoView({ behavior: motionReduced() ? 'auto' : 'smooth', block: 'start' });
        heading.focus({ preventScroll: true });
      });
    main.querySelectorAll('[data-shift-specialty]').forEach(button =>
      button.addEventListener('click', () => {
        const start = () => startClinicalShift(button.dataset.shiftSpecialty);
        if (shiftInProgress()) confirmShiftEnd(button, start, true);
        else start();
      })
    );
    main.querySelector('[data-shift-shuffle]').addEventListener('click', event => {
      if (shiftInProgress()) confirmShiftEnd(event.currentTarget, () => startShuffleShift(), true);
      else startShuffleShift();
    });
    main.querySelector('#cshift-resume')?.addEventListener('click', resumeClinicalShift);
    main.querySelector('#cshift-end-active')?.addEventListener('click', event => {
      confirmShiftEnd(event.currentTarget, () => {
        shiftState.active = null;
        shiftSession = null;
        if (saveShiftState()) {
          shiftRoute();
          renderClinicalShift();
        }
      });
    });
    main.querySelector('#cshift-classic').addEventListener('click', renderClinicalCaseBank);
    main.querySelector('#cshift-history').addEventListener('click', () => openClinicalShiftHistory());
    main.querySelector('#cshift-longitudinal').addEventListener('click', () => ClinicalLongitudinal.open());
    main.querySelector('#cshift-review').addEventListener('click', () => renderReview());
    main.querySelector('#cshift-content').addEventListener('click', () => {
      const url = new URL(location.href);
      url.searchParams.set('view', 'content');
      url.searchParams.delete('run');
      history.pushState({}, '', url.pathname + url.search);
      renderShiftContentStatus();
    });
    root.appendChild(main);
    setShiftView(root);
  }

  function openClinicalShiftHistory({ runId, caseId, ts } = {}) {
    const record = caseId ? shiftState.history.find(item => item?.caseId === caseId && item.ts === ts) : null;
    const selected = runId || (caseId ? record?.encounter?.runId || 'unavailable' : null);
    const url = new URL(location.href);
    url.pathname = '/practice';
    url.searchParams.set('view', 'shift-history');
    if (selected) url.searchParams.set('run', selected);
    else url.searchParams.delete('run');
    history.pushState({}, '', url.pathname + url.search);
    renderClinicalShift();
  }

  function renderShiftHistory(runId) {
    const records = shiftState.history.filter(item => item && typeof item === 'object');
    const record = records.find(item => item.encounter?.runId === runId);
    const active = record?.encounter;
    let valid = false;
    try {
      valid =
        Number.isFinite(active?.completedAt) &&
        caseIsCompatible(active.content?.caseData) &&
        activeIsCompatible(active, active.content.caseData) &&
        active.content.modelNote?.assessment &&
        active.content.modelNote?.plan;
    } catch {
      /* Older or damaged records remain available in the recovery export. */
    }
    if (runId && valid) {
      const priorSession = shiftSession;
      shiftSession = {
        active: JSON.parse(JSON.stringify(active)),
        caseData: active.content.caseData,
        rotation: { key: record.key, name: NAME_BY_KEY[record.key] || record.key },
      };
      try {
        renderShiftDebrief({ readOnly: true });
      } finally {
        shiftSession = priorSession;
      }
      return;
    }
    const root = el('<div></div>');
    root.appendChild(topbar('practice'));
    const main =
      el(`<main class="panel cshift-hub" id="main"><button class="backbtn" id="cshift-history-home">← Back to rotations</button>
      <header class="cshift-hub-hero"><span class="label">Completed encounters</span><h1>Your saved shifts.</h1><p>Revisit each patient, your calls and the debrief. Opening a record does not change your progress. The most recent 100 completed shifts are retained here.</p></header>
      ${runId ? '<p role="status">The full encounter is unavailable or incomplete. Its summary and any recovery data are preserved.</p>' : ''}
      <div class="rows cs-rows cshift-history-list">${records.length ? records.map(item => `<button class="row cs-row" data-shift-record="${esc(item.encounter?.runId || 'unavailable')}"><span class="row-main"><span class="row-spec">${esc(NAME_BY_KEY[item.key] || item.key)}</span><span class="row-title">${esc(shiftTitle(item.encounter) || item.caseId)}</span></span><span class="row-right">${esc(new Date(item.ts).toLocaleString())} · Open saved shift</span></button>`).join('') : '<p>No completed shifts yet. Your finished shifts and their debriefs will appear here.</p>'}</div>
    </main>`);
    main.querySelector('#cshift-history-home').addEventListener('click', () => {
      shiftRoute();
      renderClinicalShift();
    });
    main
      .querySelectorAll('[data-shift-record]')
      .forEach(button =>
        button.addEventListener('click', () => openClinicalShiftHistory({ runId: button.dataset.shiftRecord }))
      );
    root.appendChild(main);
    setShiftView(root);
  }

  function renderShiftContentStatus() {
    const root = el('<div></div>');
    root.appendChild(topbar('practice'));
    const main =
      el(`<main class="panel cshift-hub" id="main"><button class="backbtn" id="cshift-status-back">← Back to rotations</button>
      <header class="cshift-hub-hero"><span class="label">Content status</span><h1>Case sources & objectives.</h1>
        <p>These are original fictional encounters. Source checks are recorded separately from independent clinician review, which is still pending. Opening the details reveals each case’s teaching focus.</p></header>
      ${shiftManifest.rotations
        .map(
          rotation =>
            `<section class="cshift-content-register"><h2>${esc(rotation.name)}</h2>${rotation.caseIds
              .map(id => {
                const review = shiftManifest.caseReviews?.[id];
                const reaction = shiftManifest.reactions?.[id];
                return `<details id="case-${esc(id)}"><summary>Case ${esc(id)} · ${review?.batch ? 'New rotation practice' : 'Foundation encounter'}</summary>
          <h3>Teaching objective</h3><p>${esc(review?.objective || 'Objective has not been recorded.')}</p>
          <p>${esc(review?.alternativesAndLimits || 'Scope review is pending.')}</p>
          ${(review?.learningLinks || [])
            .map(link => {
              // Medicine can be closed to the public (Academy catalog); do not link into its gate.
              if (typeof COMING_SOON !== 'undefined' && COMING_SOON.has('reference'))
                return `<p>Related lesson (Medicine is under construction): ${esc(link.title)}</p>`;
              const url = new URL(sectionUrl('reference'), location.origin);
              url.searchParams.set('lesson', link.lesson);
              const back = window.AcademyCurriculum?.safeReturn(
                url.searchParams.get('returnTo') || location.pathname + location.search + location.hash
              );
              if (back) url.searchParams.set('returnTo', back);
              return `<p><a href="${esc(url.pathname + url.search)}">Related lesson: ${esc(link.title)}</a></p>`;
            })
            .join('')}
          <p>Source check: ${esc(review?.sourceCheckedOn || 'not recorded')} · Independent clinician review: pending.</p>
          ${reaction ? `<p>This patient reacts to the learner’s calls. Reactions and plain-language text, source check: ${esc(reaction.sourceCheckedOn || 'not recorded')} · Independent clinician review: pending.</p>` : ''}
          ${(review?.reviewQuestions || []).length ? `<h3>Questions for review</h3><ul>${review.reviewQuestions.map(question => `<li>${esc(question)}</li>`).join('')}</ul>` : ''}
          ${sourceListMarkup([...(review?.sources || []), ...(Array.isArray(reaction?.sources) ? reaction.sources : [])])}</details>`;
              })
              .join('')}</section>`
        )
        .join('')}</main>`);
    main.querySelector('#cshift-status-back').onclick = () => {
      shiftRoute();
      renderClinicalShift();
    };
    root.appendChild(main);
    setShiftView(root);
    if (/^#case-[a-z0-9-]+$/.test(location.hash)) {
      const target = main.querySelector(location.hash);
      if (target) {
        target.open = true;
        target.scrollIntoView({ block: 'start' });
      }
    }
  }

  function newActiveShift(rotation, caseData, { shuffle = false } = {}) {
    const authored = shiftManifest.reactions?.[caseData.id];
    const reactions = reactionUsable(caseData, authored) ? authored : null;
    return {
      ...(shuffle ? { shuffle: true } : {}),
      runId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      caseId: caseData.id,
      key: rotation.key,
      startedAt: Date.now(),
      phase: 'handoff',
      revealed: { history: false, exam: false, interviewItems: [], examItems: [] },
      stageCursor: 0,
      optionOrders: {},
      drafts: {},
      locks: {},
      resultsRevealed: [],
      differential: { stageIndex: null, ranked: [], rationale: '', lockedAt: null },
      note: { assessment: '', plan: '', revealedAt: null },
      notes: '',
      completedAt: null,
      scores: null,
      clock: 0,
      events: [],
      patient: startingPatient(reactions),
      content: JSON.parse(
        JSON.stringify({
          revision: shiftManifest.version,
          caseData,
          investigation: shiftManifest.investigations[caseData.id],
          modelNote: shiftManifest.modelNotes[caseData.id],
          review: shiftManifest.caseReviews?.[caseData.id] || null,
          reactions,
        })
      ),
    };
  }

  /* Shuffle draws one patient from every rotation at once: those not yet seen first, and never the one
     just finished while another is left. The shift it starts remembers that it is a shuffle, so the
     debrief hands on to another draw. */
  function shufflePick(justSeen = null) {
    const everyone = shiftManifest.rotations.flatMap(rotation =>
      rotation.caseIds.map(caseId => ({ key: rotation.key, caseId }))
    );
    const unseen = everyone.filter(entry => !shiftState.completed[entry.caseId]?.attempts);
    const waiting = unseen.length ? unseen : everyone;
    const fresh = waiting.filter(entry => entry.caseId !== justSeen);
    const pool = fresh.length ? fresh : waiting;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function startShuffleShift(justSeen = null) {
    const pick = shufflePick(justSeen);
    return startClinicalShift(pick.key, { caseId: pick.caseId, shuffle: true });
  }

  /* A rotation hands out its reacting patients first. `caseId` asks for one specific patient. */
  async function startClinicalShift(key, { caseId = null, shuffle = false } = {}) {
    if (StudyStorage.paused) return;
    const previousRun = shiftState.active?.runId;
    renderShiftLoading('Assigning a patient…');
    try {
      const rotation = rotationFor(key);
      const data = await loadSpecialty(key);
      if (
        location.pathname.replace(/\/$/, '') !== '/practice' ||
        StudyStorage.paused ||
        shiftState.active?.runId !== previousRun
      )
        return;
      const allowed = new Set(rotation?.caseIds || []);
      const eligible = data.cases.filter(caseData => allowed.has(caseData.id) && caseIsCompatible(caseData));
      if (!rotation || !eligible.length) throw new Error('No compatible pilot cases');
      const unseen = eligible.filter(caseData => !shiftState.completed[caseData.id]?.attempts);
      const waiting = unseen.length ? unseen : eligible;
      const reacting = waiting.filter(caseData => reactionUsable(caseData, shiftManifest.reactions?.[caseData.id]));
      const pool = reacting.length ? reacting : waiting;
      const caseData =
        eligible.find(caseData => caseData.id === caseId) || pool[Math.floor(Math.random() * pool.length)];
      shiftState.active = newActiveShift(rotation, caseData, { shuffle });
      shiftSession = { rotation, caseData, active: shiftState.active };
      shiftNotesOpen = false;
      if (saveShiftState()) {
        shiftRoute(shiftState.active);
        renderShiftHandoff();
      }
    } catch (error) {
      console.error('Clinical Shift patient assignment failed', error);
      renderShiftError('The patient download failed.', () => startClinicalShift(key, { caseId, shuffle }));
    }
  }

  async function resumeClinicalShift() {
    if (!shiftState.active) {
      renderClinicalShift();
      return;
    }
    renderShiftLoading('Reopening your patient…');
    try {
      const rotation = rotationFor(shiftState.active.key);
      const saved = shiftState.active.content?.caseData;
      const data = saved ? null : await loadSpecialty(shiftState.active.key);
      if (location.pathname.replace(/\/$/, '') !== '/practice') return;
      const caseData = saved || data.cases.find(item => item.id === shiftState.active.caseId);
      if (!rotation || !caseData || !rotation.caseIds.includes(caseData.id) || !caseIsCompatible(caseData))
        throw new Error('Saved patient is unavailable');
      if (!activeIsCompatible(shiftState.active, caseData)) {
        StudyStorage.sessionFailed();
        return;
      }
      shiftSession = { rotation, caseData, active: shiftState.active };
      shiftRoute(shiftState.active);
      renderActiveShiftPhase();
    } catch (error) {
      console.error('Clinical Shift resume failed', error);
      renderShiftError('The saved patient is temporarily unavailable.', resumeClinicalShift);
    }
  }

  function renderActiveShiftPhase() {
    const phase = shiftSession?.active.phase;
    if (phase === 'handoff') renderShiftHandoff();
    else if (phase === 'investigate') renderShiftInvestigation();
    else if (phase === 'debrief') renderShiftDebrief();
    /* Every other phase is worked out again from the calls made so far. That includes 'note', the
       write-up step of an encounter begun before every step became a tap: it has made every call, so
       it is debriefed. */
    else advanceShiftTimeline();
  }

  function shiftStepIndex(phase) {
    if (phase === 'handoff') return 0;
    if (phase === 'investigate') return 1;
    return phase === 'timeline' || phase === 'decision' || phase === 'differential' ? 2 : 3;
  }

  function shiftProgressMarkup(phase) {
    const current = shiftStepIndex(phase);
    return `<ol class="cshift-stepper" aria-label="Shift progress">${SHIFT_STEPS.map((step, index) => `<li class="${index === current ? 'active' : ''} ${index < current ? 'done' : ''}" ${index === current ? 'aria-current="step"' : ''}><span>${index < current ? '✓' : index + 1}</span><strong>${step}</strong></li>`).join('')}</ol>`;
  }

  /* ---------- the ward: bedside monitor, resident and chart ---------- */

  function motionReduced() {
    return typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* Short headlines turn italic at the end, the way the site's do. An author can mark the turn with
     underscores ("Headache and confusion _after a fall._"); otherwise it is the last word. */
  function accentHeading(text) {
    const marked = String(text).match(/^(.*?)_([^_]+)_\s*$/);
    if (marked) return `${esc(marked[1])}<em>${esc(marked[2])}</em>`;
    const words = String(text).trim().split(/\s+/);
    if (words.length < 3) return esc(text);
    return `${esc(words.slice(0, -1).join(' '))} <em>${esc(words[words.length - 1])}</em>`;
  }

  /* The name an encounter goes by: the plain-language one when the patient reacts. */
  function shiftTitle(encounter) {
    const plain = encounter?.content?.reactions?.title;
    return typeof plain === 'string' && plain.trim()
      ? plain.replace(/_/g, '')
      : encounter?.content?.caseData?.title || '';
  }

  function countWord(count, one, many = `${one}s`) {
    const words = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
    return `${words[count] || count} ${count === 1 ? one : many}`;
  }

  /* A rhythm strip drawn from the heart rate: more beats across the screen when it is fast, uneven
     spacing when the rhythm is irregular. It pictures the number beside it; it is not an ECG to read. */
  function ecgMarkup(heartRate, irregular) {
    const width = 360,
      base = 40,
      beats = Math.max(2, Math.min(9, Math.round((Number(heartRate) || 72) / 15))),
      spacing = width / beats,
      slack = Math.max(0, spacing - 36),
      drift = [0, 0.36, -0.3, 0.44, -0.4, 0.2, -0.14, 0.3, -0.24];
    const points = [[0, base]];
    for (let beat = 0; beat < beats; beat++) {
      const x = beat * spacing + spacing * 0.12 + (irregular ? drift[beat] * slack : 0);
      points.push(
        [x, base],
        [x + 2, base + 4],
        [x + 5, base - 30],
        [x + 8, base + 12],
        [x + 10, base],
        [x + 21, base],
        [x + 27, base - 7],
        [x + 33, base]
      );
    }
    points.push([width, base]);
    const path = points.map(([x, y]) => `${Math.round(x * 10) / 10},${y}`).join(' ');
    return `<polyline class="cshift-ecg-base" points="${path}"/><polyline class="cshift-ecg-sweep" pathLength="1" points="${path}"/>`;
  }

  /* "72 bpm (irregular)" reads as a large 72 with its unit and "irregular" under it. */
  function vitalParts(value) {
    const raw = String(value).trim();
    const match = raw.match(/^(\d[\d.]*(?:\/\d[\d.]*)?\s?%?)\s*(.*)$/);
    if (!match) return { main: raw, unit: '', extra: '' };
    let main = match[1].replace(/\s/g, '');
    let unit = match[2].replace(/\s*\([^)]*\)/g, '').trim();
    const extra = [...match[2].matchAll(/\(([^)]*)\)/g)].map(found => found[1].trim()).join(', ');
    if (unit.startsWith('°')) {
      main += ` ${unit}`;
      unit = '';
    }
    unit = unit.replace(/^RA\b/i, 'on room air').replace(/^\/\s*min\b/i, 'per minute');
    return { main, unit, extra };
  }

  /* The bedside monitor. For a reacting patient it carries the current vitals, their direction and the
     patient's status; for a classic encounter it shows the vitals on arrival and makes no claim beyond that. */
  function monitorMarkup({ changed = [] } = {}) {
    const { caseData, active } = shiftSession;
    const patient = reactionOf(active) ? normalizeReactiveState(active).patient : null;
    const vitals = { ...caseData.vitals, ...(patient ? patient.vitals : {}) };
    const rows = [
      ...SHIFT_VITALS.filter(([key]) => Object.hasOwn(vitals, key)),
      ...Object.keys(vitals)
        .filter(key => !SHIFT_VITALS.some(([known]) => known === key))
        .map(key => [key, key]),
    ];
    const heartRate = parseInt(vitals.HR, 10);
    const irregular = /irregular/i.test(String(vitals.HR || ''));
    const bed = ((parseInt(String(caseData.id).replace(/\D/g, ''), 10) || 0) % 12) + 1;
    const status = patient ? patient.status : '';
    return `<figure class="cshift-monitor ${status ? `is-${status}` : 'is-arrival'}" aria-label="Bedside monitor">
      <div class="cshift-monitor-case"><div class="cshift-monitor-screen">
        <div class="cshift-monitor-top"><span>BED ${bed} · MONITOR</span><strong class="cshift-monitor-status"><i></i>${esc(status ? SHIFT_STATUS[status].label : 'On arrival')}</strong></div>
        <svg class="cshift-ecg" viewBox="0 0 360 64" role="img" aria-label="Heart rhythm trace${Number.isFinite(heartRate) ? `, about ${heartRate} beats a minute` : ''}${irregular ? ', irregular' : ''}">${ecgMarkup(heartRate, irregular)}</svg>
        <div class="cshift-vitals">${rows
          .map(([key, label]) => {
            const parts = vitalParts(vitals[key]);
            const trend = patient?.trend?.[key];
            const classes = [
              trend ? `is-${patient.tone === 'good' ? 'good' : 'bad'}` : '',
              changed.includes(key) ? 'is-changed' : '',
            ]
              .filter(Boolean)
              .join(' ');
            const note = [trend === 'up' ? '↑ rising' : trend === 'down' ? '↓ falling' : parts.unit, parts.extra]
              .filter(Boolean)
              .join(' · ');
            return `<div class="${classes}"><span>${esc(label)}</span><strong>${esc(parts.main)}</strong><small>${esc(note)}</small></div>`;
          })
          .join('')}</div>
        <p class="cshift-monitor-alarm">${esc(patient ? patient.alarm || 'No alarms' : 'Vitals on arrival')}</p>
      </div></div>
      <span class="cshift-monitor-neck"></span><span class="cshift-monitor-foot"></span>
    </figure>`;
  }

  function residentMarkup(text, label = 'Resident') {
    return `<div class="cshift-resident"><span class="cshift-resident-face">${SHIFT_ICONS.resident}</span><div><span>${esc(label)}</span><p>${esc(text)}</p></div></div>`;
  }

  function termsMarkup(terms) {
    const rows = (Array.isArray(terms) ? terms : []).filter(item => item?.term && item?.meaning);
    if (!rows.length) return '';
    return `<section class="cshift-terms"><span class="label">Words to know</span><dl>${rows
      .map(item => `<div><dt>${esc(item.term)}</dt><dd>${esc(item.meaning)}</dd></div>`)
      .join('')}</dl></section>`;
  }

  /* Results received so far. A reacting patient shows the plain-language report first and keeps the
     original wording one tap away. */
  function shiftResults() {
    const { caseData, active } = shiftSession;
    const plain = reactionOf(active)?.results || {};
    return active.resultsRevealed
      .map(index => {
        const stage = caseData.stages[index];
        if (!stage) return null;
        const authored = plain[index];
        return authored?.content
          ? { label: authored.label || stage.label || 'New result', content: authored.content, original: stage.content }
          : { label: stage.label || 'New result', content: stage.content, original: '' };
      })
      .filter(Boolean);
  }

  function resultMarkup() {
    const rows = shiftResults();
    if (!rows.length)
      return `<p class="cshift-chart-empty">${reactionOf(shiftSession.active) ? 'Nothing ordered yet.' : 'No laboratory or imaging results have been added yet.'}</p>`;
    return rows
      .map(
        result =>
          `<article class="cshift-result ${result.original ? 'is-plain' : ''}"><span>${esc(result.label)}</span><p>${esc(result.content)}</p>${result.original ? `<details class="cshift-original"><summary>The report in clinical wording</summary><p>${esc(result.original)}</p></details>` : ''}</article>`
      )
      .join('');
  }

  function investigationFor(caseData) {
    const authored = shiftSession?.active.content?.investigation || shiftManifest?.investigations?.[caseData.id];
    if (authored?.interview?.length && authored?.exam?.length) {
      /* The plain-language wording replaces the authored one only when it is the same list, item for item. */
      const plain = reactionOf(shiftSession?.active)?.investigation;
      if (
        plain &&
        ['interview', 'exam'].every(
          kind =>
            Array.isArray(plain[kind]) &&
            plain[kind].length === authored[kind].length &&
            plain[kind].every(item => item?.prompt && item?.finding)
        )
      )
        return plain;
      return authored;
    }
    return {
      interview: [{ prompt: 'Ask for the complete symptom and medical history', finding: caseData.history }],
      exam: [{ prompt: 'Perform the documented focused examination', finding: caseData.exam }],
    };
  }

  function normalizeInvestigationState(active) {
    active.revealed ||= { history: false, exam: false };
    active.revealed.interviewItems = Array.isArray(active.revealed.interviewItems)
      ? active.revealed.interviewItems
      : [];
    active.revealed.examItems = Array.isArray(active.revealed.examItems) ? active.revealed.examItems : [];
  }

  function selectedInvestigationMarkup(items, selected, emptyCopy, findingsOnly = false) {
    const rows = selected.map(index => items[index]).filter(Boolean);
    if (!rows.length) return `<p>${esc(emptyCopy)}</p>`;
    return rows
      .map(item =>
        findingsOnly
          ? `<article><p>${esc(item.finding)}</p></article>`
          : `<article><strong>${esc(item.prompt)}</strong><p>${esc(item.finding)}</p></article>`
      )
      .join('');
  }

  function reasoningEvidenceMarkup() {
    const rows = shiftResults();
    if (!rows.length) return '';
    return `<section class="cshift-evidence" role="status" aria-live="polite">
      <span class="label">${reactionOf(shiftSession.active) ? 'In the chart now' : 'Chart evidence available'}</span>
      ${rows.map(result => `<article><strong>${esc(result.label)}</strong><p>${esc(result.content)}</p></article>`).join('')}
    </section>`;
  }

  /* The ward computer's chart window. `vitals` adds the arrival vitals where no monitor sits beside it. */
  function chartMarkup({ vitals = false } = {}) {
    const { caseData, active } = shiftSession;
    normalizeInvestigationState(active);
    const reaction = reactionOf(active);
    const investigation = investigationFor(caseData);
    const interviewCount = active.revealed.interviewItems.length;
    const examCount = active.revealed.examItems.length;
    return `<aside class="cshift-chart" aria-label="Patient chart">
      <div class="cshift-chart-head"><i></i><i></i><i></i><span>chart · <strong>${esc(caseData.patient)}</strong><small>${esc(reaction?.setting || caseData.setting)}</small></span></div>
      ${vitals ? `<section class="cshift-chart-vitals"><span class="label">Vitals on arrival</span><div>${vitalsMarkup(caseData)}</div></section>` : ''}
      <details ${interviewCount || active.revealed.history ? 'open' : ''}><summary>${reaction ? 'What you were told' : 'History'} <span>${active.revealed.history ? (reaction ? 'All asked' : 'Reviewed') : `${interviewCount}/${investigation.interview.length} asked`}</span></summary><div class="cshift-chart-findings">${active.revealed.history && !interviewCount ? `<p>${esc(caseData.history)}</p>` : selectedInvestigationMarkup(investigation.interview, active.revealed.interviewItems, reaction ? 'Ask a question and the answer appears here.' : 'Choose an interview question to add its answer.', !!reaction)}</div></details>
      <details ${examCount || active.revealed.exam ? 'open' : ''}><summary>${reaction ? 'What you found' : 'Examination'} <span>${active.revealed.exam ? (reaction ? 'All checked' : 'Reviewed') : `${examCount}/${investigation.exam.length} ${reaction ? 'checked' : 'examined'}`}</span></summary><div class="cshift-chart-findings">${active.revealed.exam && !examCount ? `<p>${esc(caseData.exam)}</p>` : selectedInvestigationMarkup(investigation.exam, active.revealed.examItems, reaction ? 'Check something and what you find appears here.' : 'Choose a focused examination to add its findings.', !!reaction)}</div></details>
      <section class="cshift-chart-results"><span class="label">Results</span>${resultMarkup()}</section>
      ${
        reaction
          ? ''
          : `<details><summary>Questions so far</summary><div class="cshift-chart-findings"><p>Reports above remain as originally received. These questions may describe later changes or ask about a hypothetical situation.</p>${
              caseData.stages
                .slice(0, ['handoff', 'investigate'].includes(active.phase) ? 0 : active.stageCursor + 1)
                .map((stage, index) => {
                  if (stage.type !== 'question') return '';
                  const calls =
                    stage.label !== 'DIAGNOSIS'
                      ? [active.locks[index]?.choice]
                      : active.differential.lockedAt
                        ? active.differential.ranked
                        : [];
                  const made = calls.map(choice => stage.options[choice]).filter(Boolean);
                  return `<article><strong>${esc(stage.label)}</strong><p>${esc(stage.question)}</p>${made.length ? `<p class="cshift-call">Your call: ${esc(made.join(' · '))}</p>` : ''}</article>`;
                })
                .join('') || '<p>No questions have been opened.</p>'
            }</div></details>`
      }
    </aside>`;
  }

  /* The optional notepad: a scratch window under the chart. What is written there is the learner's own,
     kept with the shift and shown again at the debrief. Nothing reads it to score anything. */
  function notepadMarkup() {
    const notes = typeof shiftSession.active.notes === 'string' ? shiftSession.active.notes : '';
    /* The line break after the tag is the one HTML drops, so a note that starts with one keeps it. */
    return `<details class="cshift-notepad" ${shiftNotesOpen ? 'open' : ''}>
      <summary><i></i><i></i><i></i><span>notepad · <strong>${notes.trim() ? 'your notes' : 'optional'}</strong></span></summary>
      <div><textarea id="cshift-notes" rows="6" maxlength="${SHIFT_NOTES_MAX}" aria-label="Notepad" aria-describedby="cshift-notes-help" placeholder="Jot down anything you want to remember.">\n${esc(notes)}</textarea><p id="cshift-notes-help">Only for you. Saved with this shift, never graded.</p></div>
    </details>`;
  }

  function bindNotepad(root) {
    const pad = root.querySelector('.cshift-notepad');
    if (!pad) return;
    const { active } = shiftSession;
    const field = pad.querySelector('textarea'),
      label = pad.querySelector('summary strong');
    /* A browser also reports a notepad that was drawn open, a moment after it is drawn. By then a quick
       tap may have replaced the view, so only the notepad on screen has a say. */
    pad.addEventListener('toggle', () => {
      if (pad.isConnected) shiftNotesOpen = pad.open;
    });
    field.addEventListener('input', () => {
      active.notes = field.value.slice(0, SHIFT_NOTES_MAX);
      label.textContent = active.notes.trim() ? 'your notes' : 'optional';
      saveNotesSoon();
    });
    field.addEventListener('blur', saveNotesNow);
  }

  /* Monitor above chart: the patient first, then the paperwork, then the notepad. */
  function sideMarkup({ changed = [] } = {}) {
    const patient = shiftSession.active.patient;
    const unseen = Array.isArray(patient?.unseen) ? patient.unseen : [];
    if (patient && unseen.length) patient.unseen = [];
    return `<div class="cshift-side">${monitorMarkup({ changed: [...changed, ...unseen] })}${chartMarkup()}${notepadMarkup()}</div>`;
  }

  function shiftFrame(content, phase, { readOnly = false } = {}) {
    const { rotation, active } = shiftSession;
    const status = reactionOf(active)
      ? `<span class="topstat cshift-clock" id="cshift-clock" data-minutes="${normalizeReactiveState(active).clock}">${SHIFT_ICONS.clock}<span>${phase === 'debrief' ? 'Shift time' : 'On shift'} <b>${shiftClock(active.clock)}</b></span></span>`
      : `<span class="topstat">${readOnly ? 'Saved encounter' : 'Patient assigned'}</span>`;
    const root = el(`<div>
      <header class="topbar cshift-runbar"><div class="side"><button class="backbtn" id="cshift-exit">${readOnly ? '← Saved shifts' : '← Save &amp; exit'}</button></div><div class="center"><span class="topstat">${active.shuffle ? 'Shuffle · ' : ''}${esc(rotation.name)} · Clinical Shift</span></div><div class="side right">${status}</div></header>
      <main class="panel cshift-workspace" id="main">${shiftProgressMarkup(phase)}${content}</main>
    </div>`);
    root.querySelector('#cshift-exit').addEventListener('click', () => {
      if (readOnly) {
        openClinicalShiftHistory();
        return;
      }
      releaseFinishedShift();
      if (saveShiftState()) {
        shiftRoute();
        renderClinicalShift();
      }
    });
    bindNotepad(root);
    /* The buttons that commit a call wake up a moment after their view is built. */
    const held = [...root.querySelectorAll('[data-cshift-hold]')];
    if (held.length) setTimeout(() => held.forEach(button => (button.disabled = false)), SHIFT_TAP_HOLD_MS);
    return root;
  }

  /* Runs the shift clock forward from where it stood, so lost time is seen passing. */
  function tickClock(root, from) {
    const chip = root.querySelector('#cshift-clock'),
      face = chip?.querySelector('b'),
      to = Number(chip?.dataset.minutes);
    if (!face || !(to > from) || motionReduced()) return;
    const started = performance.now();
    face.textContent = shiftClock(from);
    chip.classList.add('is-ticking');
    const step = now => {
      const progress = Math.min(1, (now - started) / 900);
      face.textContent = shiftClock(from + (to - from) * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1 && face.isConnected) requestAnimationFrame(step);
      else chip.classList.remove('is-ticking');
    };
    requestAnimationFrame(step);
  }

  function vitalsMarkup(caseData) {
    return Object.entries(caseData.vitals)
      .map(([key, value]) => `<div><span>${esc(key)}</span><strong>${esc(value)}</strong></div>`)
      .join('');
  }

  function renderShiftHandoff() {
    const { caseData, active } = shiftSession;
    const reaction = reactionOf(active);
    active.phase = 'handoff';
    saveShiftState();
    const complaint = esc(caseData.chiefComplaint.replace(/^[“"]|[”"]$/g, ''));
    const root = shiftFrame(
      `<section class="cshift-handoff">
      <div class="cshift-handoff-main">${
        reaction
          ? `<span class="label">New patient</span><h1>A patient <em>is waiting.</em></h1><p>You are the student on the team. A resident asks what you would do, and steps in when a call goes wrong.</p><p class="cshift-patient-line">${esc(caseData.patient)} · ${esc(reaction.setting || caseData.setting)}</p>${reaction.handoff ? residentMarkup(reaction.handoff) : ''}<div class="cshift-complaint"><span>Why the patient came in</span><blockquote>${complaint}</blockquote></div><button class="btn btn-solid" id="cshift-open-chart">Go to the bedside →</button><p class="cshift-sign-note">A fictional patient, for learning. In a real emergency the team assesses and treats at the same time.</p>`
          : `<span class="label">New patient handoff</span><h1>A patient <em>is waiting.</em></h1><p>This simulation separates practice tasks. In urgent clinical care, assessment and stabilization proceed together.</p><p class="cshift-patient-line">${esc(caseData.patient)} · ${esc(caseData.setting)}</p><div class="cshift-complaint"><span>Chief complaint</span><blockquote>${complaint}</blockquote></div><button class="btn btn-solid" id="cshift-open-chart">Open patient chart →</button>`
      }</div>
      ${monitorMarkup()}
    </section>`,
      'handoff'
    );
    root.querySelector('#cshift-open-chart').addEventListener('click', () => {
      active.phase = 'investigate';
      saveShiftState();
      renderShiftInvestigation();
    });
    setShiftView(root);
  }

  function renderShiftInvestigation({ preserveScroll = false, focusSelector = '', from = null } = {}) {
    const { caseData, active } = shiftSession;
    normalizeInvestigationState(active);
    const reaction = reactionOf(active);
    const investigation = investigationFor(caseData);
    active.phase = 'investigate';
    saveShiftState();
    const inquiry = (kind, item, index, selected) =>
      `<button class="cshift-inquiry ${selected ? 'done' : ''}" data-cshift-investigation="${kind}" data-cshift-index="${index}" ${selected ? 'disabled' : ''}><span>${selected ? '✓' : kind === 'interview' ? '?' : '+'}</span><strong>${esc(item.prompt)}</strong>${
        selected
          ? `<small>${esc(item.finding)}</small>`
          : `<small>${
              reaction
                ? `${kind === 'interview' ? 'Ask' : 'Check'} · ${SHIFT_MINUTES_PER_INQUIRY} min`
                : kind === 'interview'
                  ? 'Ask patient'
                  : 'Examine patient'
            }</small>`
      }</button>`;
    const root = shiftFrame(
      `<div class="cshift-two-col">
      <section class="cshift-task"><span class="label">Investigate</span><h1>Ask, look, <em>and listen.</em></h1><p>${
        reaction
          ? `Choose what to ask and what to check. Each one takes about ${SHIFT_MINUTES_PER_INQUIRY} minutes on the shift clock, and the answer goes in the chart. Start deciding whenever you are ready.`
          : 'Choose the questions and focused examinations that matter. Each response is added to the chart. You can proceed at any point, but uncollected information may make the reasoning steps harder.'
      }</p>
        <div class="cshift-investigation-groups">
          <section class="cshift-investigation-group"><header><div><span class="label">${reaction ? 'Ask' : 'Interview'}</span><h2>What do you want to ask?</h2></div><strong>${active.revealed.interviewItems.length}/${investigation.interview.length} asked</strong></header><div>${investigation.interview
            .map((item, index) => inquiry('interview', item, index, active.revealed.interviewItems.includes(index)))
            .join('')}</div></section>
          <section class="cshift-investigation-group"><header><div><span class="label">${reaction ? 'Examine' : 'Focused examination'}</span><h2>${reaction ? 'What do you want to check?' : 'What do you want to look for?'}</h2></div><strong>${active.revealed.examItems.length}/${investigation.exam.length} ${reaction ? 'checked' : 'examined'}</strong></header><div>${investigation.exam
            .map((item, index) => inquiry('exam', item, index, active.revealed.examItems.includes(index)))
            .join('')}</div></section>
        </div>
        <button class="btn btn-solid" id="cshift-begin-reasoning">${reaction ? 'I am ready to decide →' : 'Begin clinical reasoning →'}</button>
      </section>${sideMarkup()}</div>`,
      'investigate'
    );
    root.querySelectorAll('[data-cshift-investigation]').forEach(button =>
      button.addEventListener('click', () => {
        const kind = button.dataset.cshiftInvestigation;
        const index = Number(button.dataset.cshiftIndex);
        const key = kind === 'interview' ? 'interviewItems' : 'examItems';
        const before = reaction ? normalizeReactiveState(active).clock : null;
        if (!active.revealed[key].includes(index)) {
          active.revealed[key].push(index);
          if (reaction) active.clock += SHIFT_MINUTES_PER_INQUIRY;
        }
        const items = kind === 'interview' ? investigation.interview : investigation.exam;
        if (active.revealed[key].length === items.length)
          active.revealed[kind === 'interview' ? 'history' : 'exam'] = true;
        saveShiftState();
        renderShiftInvestigation({
          preserveScroll: true,
          focusSelector: `[data-cshift-investigation="${kind}"][data-cshift-index="${index}"]`,
          from: before,
        });
      })
    );
    root.querySelector('#cshift-begin-reasoning').addEventListener('click', () => {
      active.phase = 'timeline';
      active.stageCursor = 0;
      saveShiftState();
      advanceShiftTimeline();
    });
    setShiftView(root, { preserveScroll, focusSelector });
    if (from != null) tickClock(root, from);
  }

  function shuffledOrder(stageIndex, stage) {
    const { active } = shiftSession;
    if (!Array.isArray(active.optionOrders[stageIndex])) {
      const order = stage.options.map((_, index) => index);
      for (let index = order.length - 1; index > 0; index--) {
        const swap = Math.floor(Math.random() * (index + 1));
        [order[index], order[swap]] = [order[swap], order[index]];
      }
      active.optionOrders[stageIndex] = order;
      saveShiftState();
    }
    return active.optionOrders[stageIndex];
  }

  function advanceShiftTimeline() {
    const { caseData, active } = shiftSession;
    const reacting = !!reactionOf(active);
    active.phase = 'timeline';
    /* Results are filed as they are reached. A classic encounter also moves on from a question that is
       already answered: its feedback waits for the debrief, so there is nothing to show for it here.
       (An encounter begun before one tap answered a question can be resting on an answered one.) */
    const answered = index =>
      caseData.stages[index].label === 'DIAGNOSIS' ? !!active.differential.lockedAt : !!active.locks[index];
    while (active.stageCursor < caseData.stages.length) {
      const stage = caseData.stages[active.stageCursor];
      if (stage.type === 'result') {
        if (!active.resultsRevealed.includes(active.stageCursor)) active.resultsRevealed.push(active.stageCursor);
      } else if (reacting || !answered(active.stageCursor)) break;
      active.stageCursor++;
    }
    if (active.stageCursor >= caseData.stages.length) {
      /* The last call leads straight to the debrief. */
      renderShiftDebrief();
      return;
    }
    const diagnosis = caseData.stages[active.stageCursor].label === 'DIAGNOSIS';
    active.phase = diagnosis ? 'differential' : 'decision';
    if (diagnosis) active.differential.stageIndex = active.stageCursor;
    saveShiftState();
    if (!reacting) renderClassicQuestion();
    else if (diagnosis) renderReactingDiagnosis();
    else renderReactingDecision();
  }

  /* `texts` is the wording shown for each option; the choice itself is always the case's own option index. */
  function decisionOptionsMarkup(stage, stageIndex, texts = stage.options) {
    return shuffledOrder(stageIndex, stage)
      .map(
        (originalIndex, displayIndex) =>
          `<button class="cshift-option" data-cshift-choice="${originalIndex}" ${SHIFT_HELD}><span>${LETTERS[displayIndex]}</span><strong>${esc(texts[originalIndex])}</strong></button>`
      )
      .join('');
  }

  /* One tap is the answer: there is no second step to confirm it. */
  function onChoice(root, commit) {
    root
      .querySelectorAll('[data-cshift-choice]')
      .forEach(button => button.addEventListener('click', () => commit(Number(button.dataset.cshiftChoice))));
  }

  /* Where a question sits among all the questions of an encounter, the diagnosis included. */
  function questionNumber(stageIndex) {
    const questions = shiftSession.caseData.stages
      .map((stage, index) => (stage.type === 'question' ? index : -1))
      .filter(index => index >= 0);
    return { number: questions.indexOf(stageIndex) + 1, total: questions.length };
  }

  /* A classic encounter asks each question once, the diagnosis among them. A tap answers it and the next
     question opens; how each call held up is kept for the debrief. */
  function renderClassicQuestion() {
    const { caseData, active } = shiftSession;
    const stageIndex = active.stageCursor;
    const stage = caseData.stages[stageIndex];
    const diagnosis = stage.label === 'DIAGNOSIS';
    const { number, total } = questionNumber(stageIndex);
    const root = shiftFrame(
      `<div class="cshift-two-col">
      <section class="cshift-task is-question" data-cshift-kind="${diagnosis ? 'diagnosis' : 'decision'}"><span class="label">Question ${number} of ${total} · ${esc(diagnosis ? 'Diagnosis' : stage.label || 'Next step')}</span>${reasoningEvidenceMarkup()}<h1 class="cshift-question">${esc(stage.question)}</h1><p>Pick the best response. Your call is final, and you see how each one held up at the debrief.</p>
        <div class="cshift-options">${decisionOptionsMarkup(stage, stageIndex)}</div>
      </section>${sideMarkup()}</div>`,
      diagnosis ? 'differential' : 'decision'
    );
    onChoice(root, choice => {
      /* An answer is given once. A tap that reaches a question already answered changes nothing. */
      if (diagnosis ? active.differential.lockedAt : active.locks[stageIndex]) return;
      if (diagnosis) {
        active.differential.ranked = [choice];
        active.differential.lockedAt = Date.now();
      } else active.locks[stageIndex] = { choice, lockedAt: Date.now() };
      delete active.drafts[stageIndex];
      /* The question is answered now, so this moves on to the next one, or to the debrief. */
      advanceShiftTimeline();
    });
    setShiftView(root);
  }

  /* ---------- the reacting patient ---------- */

  function decisionNumber(stageIndex) {
    const decisions = shiftSession.caseData.stages
      .map((stage, index) => (stage.type === 'question' && stage.label !== 'DIAGNOSIS' ? index : -1))
      .filter(index => index >= 0);
    return { number: decisions.indexOf(stageIndex) + 1, total: decisions.length };
  }

  function applyOutcomeToPatient(patient, outcome) {
    if (outcome.vitals) Object.assign(patient.vitals, outcome.vitals);
    patient.trend = outcome.trend ? { ...outcome.trend } : {};
    patient.tone = outcome.kind === 'safe' ? 'good' : 'bad';
    if (outcome.status) patient.status = outcome.status;
    if (typeof outcome.alarm === 'string') patient.alarm = outcome.alarm;
  }

  /* Making a call moves the clock and the patient. It is recorded once; a resumed shift never replays it. */
  function applyDecisionOutcome(stageIndex, choice) {
    const active = normalizeReactiveState(shiftSession.active);
    if (active.events.some(event => event.type === 'decision' && event.stage === stageIndex)) return;
    const outcome = reactionOf(active).decisions[stageIndex].outcomes[choice];
    const at = active.clock;
    active.clock += outcome.minutes;
    applyOutcomeToPatient(active.patient, outcome);
    active.events.push({
      type: 'decision',
      stage: stageIndex,
      choice,
      kind: outcome.kind,
      minutes: outcome.minutes,
      at,
      status: active.patient.status,
    });
  }

  /* After an unsafe call or a near miss the resident makes the safe call. It still takes its own time. */
  function applyResidentFix(stageIndex) {
    const { caseData } = shiftSession;
    const active = normalizeReactiveState(shiftSession.active);
    const decided = active.events.find(event => event.type === 'decision' && event.stage === stageIndex);
    if (
      !decided ||
      decided.kind === 'safe' ||
      active.events.some(event => event.type === 'fix' && event.stage === stageIndex)
    )
      return;
    const safe = reactionOf(active).decisions[stageIndex].outcomes[caseData.stages[stageIndex].answer];
    const at = active.clock;
    active.clock += safe.minutes;
    applyOutcomeToPatient(active.patient, safe);
    /* No outcome screen follows the resident's call, so the readings it changed are marked on the next one. */
    active.patient.unseen = Object.keys(safe.vitals || {});
    active.events.push({ type: 'fix', stage: stageIndex, minutes: safe.minutes, at, status: active.patient.status });
  }

  function outcomeBeatMarkup(decision, choice) {
    const outcome = decision.outcomes[choice];
    const safe = outcome.kind === 'safe';
    return `<div class="cshift-beat is-${outcome.kind}">
      <h2 class="cshift-beat-time" tabindex="-1"><span>${minuteCount(outcome.minutes)} later</span></h2>
      <div class="cshift-beat-story"><span>You chose · ${esc(decision.options[choice])}</span><p>${esc(outcome.story)}</p></div>
      ${residentMarkup(outcome.reply, safe ? 'Resident' : 'Resident steps in')}
      <p class="cshift-verdict is-${outcome.kind}">${SHIFT_ICONS[outcome.kind]}<span>${SHIFT_VERDICTS[outcome.kind](outcome.minutes)}</span></p>
      <button class="btn btn-solid" id="cshift-next-stage" ${SHIFT_HELD}>${safe || !decision.fix ? 'Continue' : esc(decision.fix)} →</button>
    </div>`;
  }

  /* A reacting decision: one tap makes the call, and what happens to the patient is shown at once. */
  function renderReactingDecision({ from = null } = {}) {
    const { caseData, active } = shiftSession;
    const stageIndex = active.stageCursor;
    const stage = caseData.stages[stageIndex];
    const decision = reactionOf(active).decisions[stageIndex];
    const lock = active.locks[stageIndex];
    const { number, total } = decisionNumber(stageIndex);
    const arriving = from != null;
    const root = shiftFrame(
      `<div class="cshift-two-col">${
        lock
          ? `<section class="cshift-task is-decided" data-cshift-kind="decision"><span class="label">Decision ${number} of ${total}</span><h1>${accentHeading(decision.question)}</h1>${outcomeBeatMarkup(decision, lock.choice)}${termsMarkup(decision.terms)}</section>`
          : `<section class="cshift-task is-question" data-cshift-kind="decision"><span class="label">Decision ${number} of ${total}</span>${residentMarkup(decision.resident)}<h1>${accentHeading(decision.question)}</h1><p>Pick one. Your call is final, and it changes what happens next.</p>
        <div class="cshift-options">${decisionOptionsMarkup(stage, stageIndex, decision.options)}</div>${termsMarkup(decision.terms)}</section>`
      }${sideMarkup({ changed: lock && arriving ? Object.keys(decision.outcomes[lock.choice].vitals || {}) : [] })}</div>`,
      'decision'
    );
    if (arriving) root.querySelector('.cshift-workspace').classList.add('is-arriving');
    onChoice(root, choice => {
      if (active.locks[stageIndex]) return;
      const before = normalizeReactiveState(active).clock;
      active.locks[stageIndex] = { choice, lockedAt: Date.now() };
      delete active.drafts[stageIndex];
      applyDecisionOutcome(stageIndex, choice);
      saveShiftState();
      renderReactingDecision({ from: before });
    });
    root.querySelector('#cshift-next-stage')?.addEventListener('click', () => {
      applyResidentFix(stageIndex);
      active.stageCursor++;
      saveShiftState();
      advanceShiftTimeline();
    });
    setShiftView(root, { focusSelector: arriving ? '.cshift-beat-time' : '' });
    if (arriving) tickClock(root, from);
  }

  /* The diagnosis for a reacting patient is one quick call: pick one and hear the answer. */
  function renderReactingDiagnosis({ arriving = false } = {}) {
    const { caseData, active } = shiftSession;
    const stageIndex = active.differential.stageIndex;
    const stage = caseData.stages[stageIndex];
    const plain = reactionOf(active).differential;
    const locked = !!active.differential.lockedAt;
    const choice = active.differential.ranked[0];
    const right = choice === stage.answer;
    const root = shiftFrame(
      `<div class="cshift-two-col">${
        locked
          ? `<section class="cshift-task is-decided" data-cshift-kind="diagnosis"><span class="label">Work it out</span><h1>${accentHeading(plain.question)}</h1>
        <div class="cshift-beat">
          <div class="cshift-beat-story" tabindex="-1"><span>You said</span><p>${esc(plain.options[choice])}</p></div>
          ${residentMarkup(`${right ? 'Yes.' : 'Not this time.'} ${plain.reveal || `It is this: ${plain.options[stage.answer]}`}`)}
          <p class="cshift-verdict is-${right ? 'safe' : 'near-miss'}">${SHIFT_ICONS[right ? 'safe' : 'near-miss']}<span>${right ? 'Right first time' : 'Not this time'}</span></p>
          <button class="btn btn-solid" id="cshift-next-stage" ${SHIFT_HELD}>Continue →</button>
        </div>${termsMarkup(plain.terms)}</section>`
          : `<section class="cshift-task is-question" data-cshift-kind="diagnosis"><span class="label">Work it out</span>${plain.resident ? residentMarkup(plain.resident) : ''}${reasoningEvidenceMarkup()}<h1>${accentHeading(plain.question)}</h1><p>Pick one. Your answer is final.</p>
        <div class="cshift-options">${decisionOptionsMarkup(stage, stageIndex, plain.options)}</div>${termsMarkup(plain.terms)}</section>`
      }${sideMarkup()}</div>`,
      'differential'
    );
    if (arriving) root.querySelector('.cshift-workspace').classList.add('is-arriving');
    onChoice(root, picked => {
      if (active.differential.lockedAt) return;
      active.differential.ranked = [picked];
      active.differential.rationale = '';
      active.differential.lockedAt = Date.now();
      delete active.drafts[stageIndex];
      saveShiftState();
      renderReactingDiagnosis({ arriving: true });
    });
    root.querySelector('#cshift-next-stage')?.addEventListener('click', () => {
      active.stageCursor++;
      active.phase = 'timeline';
      saveShiftState();
      advanceShiftTimeline();
    });
    setShiftView(root, { focusSelector: arriving ? '.cshift-beat-story' : '' });
  }

  function modelNoteFor(caseData) {
    const authored = shiftSession?.active.content?.modelNote || shiftManifest?.modelNotes?.[caseData.id];
    if (authored?.assessment && authored?.plan) return authored;
    const keyedActions = caseData.stages
      .filter(stage => stage.type === 'question' && stage.label !== 'DIAGNOSIS')
      .map(stage => stage.options?.[stage.answer])
      .filter(Boolean);
    return {
      assessment: `${caseData.patient} with findings most consistent with ${caseData.diagnosis}. The history, examination, and available results support this as the leading diagnosis.`,
      plan: keyedActions.length
        ? `${keyedActions.join('. ')}. Reassess the patient, monitor for deterioration, and arrange the appropriate follow-up or disposition.`
        : 'Stabilize the patient, complete the indicated diagnostic evaluation, begin condition-specific treatment, and arrange the appropriate consultation and disposition.',
    };
  }

  /* Shifts finished before every step became a tap can hold a typed note. It is shown beside the
     example note, as it was then. */
  function noteComparisonMarkup(modelNote) {
    const { active } = shiftSession;
    return `<div class="cshift-note-comparison">
      <section><span class="label">Assessment</span><div><article class="cshift-note-yours"><strong>Your response</strong><p>${esc(active.note.assessment)}</p></article><article class="cshift-model-note"><strong>Example note</strong><p>${esc(modelNote.assessment)}</p></article></div></section>
      <section><span class="label">Plan</span><div><article class="cshift-note-yours"><strong>Your response</strong><p>${esc(active.note.plan)}</p></article><article class="cshift-model-note"><strong>Example note</strong><p>${esc(modelNote.plan)}</p></article></div></section>
    </div>`;
  }

  /* The learner's diagnosis beside the keyed one. An older shift can list up to three picks. */
  function diagnosisReviewMarkup(options) {
    const { caseData, active } = shiftSession;
    const answer = caseData.stages[active.differential.stageIndex].answer,
      picked = active.differential.ranked;
    return `<ol class="cshift-ranked-review">${picked.map(choice => `<li class="${choice === answer ? 'correct' : 'missed'}"><span>${choice === answer ? '✓' : '✕'}</span><strong>${esc(options[choice])}</strong><em>${choice === answer ? 'The diagnosis' : 'Your pick'}</em></li>`).join('')}${picked.includes(answer) ? '' : `<li class="correct"><span>✓</span><strong>${esc(options[answer])}</strong><em>The diagnosis</em></li>`}</ol>`;
  }

  function notesReviewMarkup() {
    const notes = shiftSession.active.notes;
    return typeof notes === 'string' && notes.trim()
      ? `<section class="cshift-debrief-section cshift-notes-review"><span class="label">Your notepad</span><p>${esc(notes.trim())}</p></section>`
      : '';
  }

  /* What the learner's calls did to the patient: the part of the debrief the classic format cannot give. */
  function safetySummary(active) {
    normalizeReactiveState(active);
    const decisions = active.events.filter(event => event.type === 'decision');
    const lost = kinds =>
      decisions.filter(event => kinds.includes(event.kind)).reduce((sum, event) => sum + event.minutes, 0);
    return {
      delays: decisions.filter(event => event.kind === 'delay').length,
      nearMisses: decisions.filter(event => event.kind === 'near-miss').length,
      minutesLost: lost(['delay', 'near-miss']),
      delayMinutes: lost(['delay']),
      minutes: active.clock,
      status: active.patient.status,
    };
  }

  function calculateScores() {
    const { caseData, active } = shiftSession;
    const diagnosisStage = caseData.stages[active.differential.stageIndex];
    const rank = active.differential.ranked.indexOf(diagnosisStage.answer);
    /* Nothing is written, so the hundred points sit on the calls: 15 for asking and examining, 25 for
       the diagnosis and 60 for the decisions. */
    const reacting = !!reactionOf(active);
    const reasoning = rank === 0 ? 25 : 0;
    const decisionEntries = Object.entries(active.locks).map(([index, lock]) => ({
      stage: caseData.stages[Number(index)],
      lock,
    }));
    const correct = decisionEntries.filter(entry => entry.lock.choice === entry.stage.answer).length;
    const decisions = decisionEntries.length ? Math.round((60 * correct) / decisionEntries.length) : 0;
    normalizeInvestigationState(active);
    const investigation = investigationFor(caseData);
    const historyCoverage = active.revealed.interviewItems.length
      ? active.revealed.interviewItems.length / investigation.interview.length
      : active.revealed.history
        ? 1
        : 0;
    const examCoverage = active.revealed.examItems.length
      ? active.revealed.examItems.length / investigation.exam.length
      : active.revealed.exam
        ? 1
        : 0;
    const information = Math.round(8 * Math.min(historyCoverage, 1)) + Math.round(7 * Math.min(examCoverage, 1));
    return {
      information,
      reasoning,
      decisions,
      documentation: 0,
      total: information + reasoning + decisions,
      correct,
      decisionTotal: decisionEntries.length,
      diagnosisRank: rank,
      ...(reacting ? { safety: safetySummary(active) } : {}),
    };
  }

  function finishClinicalShift() {
    const { caseData, rotation, active } = shiftSession;
    if (!active.completedAt) {
      active.completedAt = Date.now();
      active.scores = calculateScores();
      const previous = shiftState.completed[caseData.id] || { attempts: 0, bestScore: 0 };
      shiftState.completed[caseData.id] = {
        attempts: previous.attempts + 1,
        bestScore: Math.max(previous.bestScore || 0, active.scores.total),
        lastScore: active.scores.total,
        lastAt: active.completedAt,
        key: rotation.key,
      };
      shiftState.history.unshift({
        caseId: caseData.id,
        key: rotation.key,
        score: active.scores.total,
        ts: active.completedAt,
        encounter: JSON.parse(JSON.stringify(active)),
      });
      shiftState.history = shiftState.history.slice(0, 100);
    }
    const saved = saveShiftState();
    if (saved && typeof recordClinicalShiftCompletion === 'function') {
      recordClinicalShiftCompletion({
        id: caseData.id,
        key: rotation.key,
        difficulty: caseData.difficulty,
        correct: active.scores.correct + (active.scores.diagnosisRank === 0 ? 1 : 0),
        total: active.scores.decisionTotal + 1,
        ts: active.completedAt,
      });
    }
    return saved;
  }

  function sourceListMarkup(sources) {
    const seen = new Set();
    return `<ul>${sources
      .filter(source => /^https:\/\//.test(source?.url) && !seen.has(source.url) && seen.add(source.url))
      .map(
        source =>
          `<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a></li>`
      )
      .join('')}</ul>`;
  }

  function reviewSourceMarkup() {
    const { caseData, active } = shiftSession;
    const review = active.content?.review || shiftManifest?.caseReviews?.[caseData.id];
    const reaction = reactionOf(active);
    if (!review)
      return '<p class="cshift-provenance">This older encounter has no recorded source pass. Independent clinician review remains pending.</p>';
    return `<section class="cshift-debrief-section"><h2>Scope and alternatives</h2><p>${esc(review.objective)}</p><p>${esc(review.alternativesAndLimits)}</p><p>Sources checked ${esc(review.sourceCheckedOn)}${reaction?.sourceCheckedOn ? `; the patient’s reactions and the plain-language text were checked ${esc(reaction.sourceCheckedOn)}` : ''}. Independent clinician review remains pending.</p>${sourceListMarkup([...review.sources, ...(Array.isArray(reaction?.sources) ? reaction.sources : [])])}</section>`;
  }

  function decisionReviewMarkup() {
    const { caseData, active } = shiftSession;
    const reaction = reactionOf(active);
    return Object.entries(active.locks)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([index, lock]) => {
        const stage = caseData.stages[Number(index)];
        const correct = lock.choice === stage.answer;
        const decision = reaction?.decisions[index];
        if (!decision)
          return `<article class="cshift-review-card ${correct ? 'correct' : 'incorrect'}"><div><span>${esc(stage.label || 'Decision')}</span><strong>${correct ? 'Sound decision' : 'Needs review'}</strong></div><p class="cshift-review-question">${esc(stage.question)}</p><dl><div><dt>Your choice</dt><dd>${esc(stage.options[lock.choice])}</dd></div><div><dt>Best choice</dt><dd>${esc(stage.options[stage.answer])}</dd></div></dl><p class="cshift-review-explanation">${esc(stage.explanation)}</p></article>`;
        const outcome = decision.outcomes[lock.choice];
        const { number, total } = decisionNumber(Number(index));
        return `<article class="cshift-review-card ${correct ? 'correct' : 'incorrect'}"><div><span>Decision ${number} of ${total}</span><strong>${correct ? 'Safe call' : outcome.kind === 'delay' ? 'Unsafe delay' : 'Near miss'}</strong></div><p class="cshift-review-question">${esc(decision.question)}</p><dl><div><dt>Your call</dt><dd>${esc(decision.options[lock.choice])}</dd></div><div><dt>The safe call</dt><dd>${esc(decision.options[stage.answer])}</dd></div></dl><p class="cshift-review-explanation">${esc(outcome.reply)}</p><details class="cshift-original"><summary>How a clinician would put it</summary><p><strong>${esc(stage.question)}</strong></p><p>${esc(stage.explanation)}</p></details></article>`;
      })
      .join('');
  }

  /* The patient's status across the shift, as the stretches of time between the calls that changed it. */
  function shiftTimeline(active) {
    normalizeReactiveState(active);
    const total = Math.max(active.clock, ...active.events.map(event => event.at + event.minutes), 0);
    const marks = [{ at: 0, status: startingPatient(reactionOf(active)).status }];
    for (const event of active.events)
      if (event.status !== marks[marks.length - 1].status) marks.push({ at: event.at, status: event.status });
    return {
      total,
      segments: marks
        .map((mark, index) => ({
          from: mark.at,
          to: index + 1 < marks.length ? marks[index + 1].at : total,
          status: mark.status,
        }))
        .filter(segment => segment.to > segment.from),
    };
  }

  function timelineMarkup() {
    const { caseData, active } = shiftSession;
    const reaction = reactionOf(active);
    const { segments } = shiftTimeline(active);
    const cards = active.events
      .map(event => {
        const decision = reaction.decisions[event.stage],
          stage = caseData.stages[event.stage];
        if (!decision || !stage) return '';
        if (event.type === 'fix')
          return `<li><span>${shiftClock(event.at)} · Resident steps in</span><strong>${esc(decision.options[stage.answer])}</strong><p>${esc(decision.outcomes[stage.answer].story)}</p><em class="cshift-chip is-fix">Back on track · ${event.minutes} min</em></li>`;
        const label = { safe: 'Safe', 'near-miss': 'Near miss', delay: 'Unsafe delay' }[event.kind];
        return `<li><span>${shiftClock(event.at)} · Decision ${decisionNumber(event.stage).number}</span><strong>You chose: ${esc(decision.options[event.choice])}</strong><p>${esc(decision.outcomes[event.choice].story)}</p><em class="cshift-chip is-${event.kind}">${label} · ${event.minutes} min</em></li>`;
      })
      .join('');
    const bar = segments.length
      ? `<div class="cshift-timebar" role="img" aria-label="The patient’s status over the shift: ${esc(
          segments
            .map(
              segment =>
                `${SHIFT_STATUS[segment.status].label.toLowerCase()} for ${minuteCount(segment.to - segment.from)}`
            )
            .join(', then ')
        )}">${segments.map(segment => `<i class="is-${segment.status}" style="flex-grow:${segment.to - segment.from}"></i>`).join('')}</div>
        <ol class="cshift-timebar-key">${segments.map(segment => `<li class="is-${segment.status}"><i></i>${shiftClock(segment.from)} · ${esc(SHIFT_STATUS[segment.status].label)}</li>`).join('')}</ol>`
      : '';
    return `${bar}${cards ? `<ol class="cshift-events">${cards}</ol>` : ''}`;
  }

  function reactingDebriefMarkup(scores, readOnly) {
    const { caseData, rotation, active } = shiftSession;
    const reaction = reactionOf(active);
    const safety = scores.safety || safetySummary(active);
    const modelNote = modelNoteFor(caseData);
    normalizeInvestigationState(active);
    const investigation = investigationFor(caseData);
    const asked = active.revealed.interviewItems.length + active.revealed.examItems.length;
    /* The shortest this shift could have been with the same questions asked and every call the safe one. */
    const fastest =
      asked * SHIFT_MINUTES_PER_INQUIRY +
      Object.entries(reaction.decisions).reduce(
        (sum, [index, decision]) => sum + decision.outcomes[caseData.stages[index].answer].minutes,
        0
      );
    const ending = reaction.ending?.[safety.status] || reaction.ending?.stable || SHIFT_STATUS[safety.status].label;
    const tone = SHIFT_STATUS[safety.status].rank >= 2 ? 'is-bad' : safety.minutesLost ? 'is-warn' : 'is-good';
    const misses = countWord(safety.nearMisses, 'near miss', 'near misses');
    const headline = safety.delays
      ? `${countWord(safety.delays, 'call')} cost the patient ${minuteCount(safety.delayMinutes)}.`
      : safety.nearMisses
        ? `${misses}, caught in time.`
        : 'Every call was safe. No time was lost.';
    const science = (Array.isArray(reaction.science) ? reaction.science : []).filter(item => item?.title && item?.text);
    const lessonsOpen = !(typeof COMING_SOON !== 'undefined' && COMING_SOON.has('mcat'));
    const lessonUrl = lesson => {
      const url = new URL(typeof sectionUrl === 'function' ? sectionUrl('mcat') : '/mcat', location.origin);
      url.searchParams.set('view', 'course');
      url.searchParams.set('unit', lesson);
      return url.pathname + url.search;
    };
    return `<header class="cshift-debrief-hero"><div><span class="label">Shift debrief · ${esc(rotation.name)}</span><h1>${reaction.title ? accentHeading(reaction.title) : esc(caseData.title)}</h1>${reaction.plainDiagnosis ? `<p class="cshift-what"><strong>What it was:</strong> ${esc(reaction.plainDiagnosis)}</p>` : ''}<p>${esc(caseData.patient)} · ${esc(reaction.setting || caseData.setting)} · Completed ${esc(new Date(active.completedAt).toLocaleString())}</p></div><div class="cshift-outcome ${tone}"><span>Where the patient is now</span><strong>${esc(ending)}</strong><small>${minuteCount(safety.minutes)} after arriving</small></div></header>
      ${readOnly ? '<p class="cshift-provenance">Saved encounter: your original response and the teaching content available at that time. Later corrections do not rewrite this record.</p>' : ''}
      <section class="cshift-debrief-section cshift-timeline"><span class="label">Your shift, minute by minute</span><h2>${esc(headline)}</h2>${timelineMarkup()}</section>
      <section class="cshift-debrief-section"><span class="label">How you did</span>
      <div class="cshift-domain-grid">
        <article class="${tone}"><span>Patient safety</span><strong>${safety.delays ? `${safety.delays} unsafe ${safety.delays === 1 ? 'delay' : 'delays'}` : safety.nearMisses ? `${safety.nearMisses} near ${safety.nearMisses === 1 ? 'miss' : 'misses'}` : 'No unsafe calls'}</strong><small>${safety.delays ? `${minuteCount(safety.minutesLost)} lost in all${safety.nearMisses ? `, counting ${misses.toLowerCase()}` : ''}.` : safety.nearMisses ? `The team stopped it in time. ${minuteCount(safety.minutesLost)} lost.` : 'Every call was the safe one, first time.'}</small></article>
        <article><span>Decisions</span><strong>${scores.correct} of ${scores.decisionTotal}</strong><small>Safe on the first try.</small></article>
        <article><span>Diagnosis</span><strong>${scores.diagnosisRank === 0 ? 'Right first time' : 'Missed'}</strong><small>${scores.diagnosisRank === 0 ? 'You named it before the resident did.' : 'The resident named it for you.'}</small></article>
        <article><span>Investigating</span><strong>${asked} of ${investigation.interview.length + investigation.exam.length}</strong><small>Questions and checks, ${minuteCount(asked * SHIFT_MINUTES_PER_INQUIRY)} on the clock.</small></article>
        <article><span>Time on shift</span><strong>${safety.minutes} min</strong><small>${safety.minutes > fastest ? `With every call safe it would have been ${fastest}.` : 'As fast as this patient allows.'}</small></article>
        <article><span>Practice points</span><strong>${scores.total}/100</strong><small>For this shift only.</small></article>
      </div>
      <p class="cshift-provenance">These scores are for practice. They follow the choices built into this fictional patient and do not measure clinical ability.</p></section>
      ${
        science.length
          ? `<section class="cshift-debrief-section cshift-science"><span class="label">The science behind it</span><h2>${countWord(science.length, 'idea')} you already study.</h2><div>${science
              .map(
                item =>
                  `<article><span>MCAT${item.tag ? ` · ${esc(item.tag)}` : ''}</span><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p>${item.lesson && lessonsOpen ? `<a href="${esc(lessonUrl(item.lesson))}">Open the lesson${item.lessonTitle ? `: ${esc(item.lessonTitle)}` : ''} →</a>` : ''}</article>`
              )
              .join('')}</div></section>`
          : ''
      }
      <section class="cshift-debrief-section"><span class="label">Your calls, one by one</span><div class="cshift-review-list">${decisionReviewMarkup()}</div></section>
      <section class="cshift-debrief-section"><span class="label">Your diagnosis</span>${diagnosisReviewMarkup(reaction.differential.options)}${reaction.differential.reveal ? `<p>${esc(reaction.differential.reveal)}</p>` : ''}</section>
      ${readOnly ? `<details class="cshift-saved-chart"><summary>Review the saved patient chart</summary>${chartMarkup({ vitals: true })}</details>` : ''}
      <section class="cshift-debrief-section"><span class="label">In clinical language</span><p class="cshift-diagnosis-line">${reaction.title ? `Case: <strong>${esc(caseData.title)}</strong><br>` : ''}Final diagnosis: <strong>${esc(caseData.diagnosis)}</strong></p><div class="cshift-clinical-note"><article><strong>The resident’s note · what is going on</strong><p>${esc(modelNote.assessment)}</p></article><article><strong>The resident’s note · the plan</strong><p>${esc(modelNote.plan)}</p></article></div><div class="cshift-pearls">${caseData.pearls.map((pearl, index) => `<article><span>${String(index + 1).padStart(2, '0')}</span><p>${esc(pearl)}</p></article>`).join('')}</div></section>
      ${notesReviewMarkup()}
      ${reviewSourceMarkup()}`;
  }

  /* The classic debrief: where the calls landed against the case's key, and the teaching that goes with
     them. A shift finished before every step became a tap also shows what was typed then. */
  function classicDebriefMarkup(scores, readOnly) {
    const { caseData, rotation, active } = shiftSession;
    const diagnosisStage = caseData.stages[active.differential.stageIndex];
    const modelNote = modelNoteFor(caseData);
    normalizeInvestigationState(active);
    const investigation = investigationFor(caseData);
    /* Older encounters could review the whole history or examination in one step. */
    const covered = (items, all, list) => (items.length ? items.length : all ? list.length : 0);
    const asked =
      covered(active.revealed.interviewItems, active.revealed.history, investigation.interview) +
      covered(active.revealed.examItems, active.revealed.exam, investigation.exam);
    const rank = scores.diagnosisRank;
    const rationale = typeof active.differential.rationale === 'string' ? active.differential.rationale.trim() : '';
    const wroteNote = ['assessment', 'plan'].some(
      key => typeof active.note?.[key] === 'string' && active.note[key].trim()
    );
    return `<header class="cshift-debrief-hero"><div><span class="label">Shift debrief · ${esc(rotation.name)}</span><h1>${esc(caseData.title)}</h1><p>${esc(caseData.patient)} · ${esc(caseData.setting)} · ${esc(caseData.difficulty)} case</p><p>Completed ${esc(new Date(active.completedAt).toLocaleString())}</p></div><div class="cshift-score"><strong>${scores.total}</strong><span>/100 practice points</span></div></header>
      ${readOnly ? '<p class="cshift-provenance">Saved encounter: your original response and the teaching content available at that time. Later corrections do not rewrite this record.</p>' : ''}
      <p class="cshift-provenance">Points follow what you asked and checked, and how your calls match this case’s answer key.${scores.documentation ? ' This older shift also earned points for a written note.' : ''} They are for practice and are not a validated measure of clinical ability or patient safety.</p>
      <section class="cshift-diagnosis"><span class="label">Final diagnosis</span><h2>${esc(caseData.diagnosis)}</h2></section>
      <div class="cshift-domain-grid">
        <article><span>Decisions</span><strong>${scores.correct} of ${scores.decisionTotal}</strong><small>The best response, first time.</small></article>
        <article><span>Diagnosis</span><strong>${rank === 0 ? 'Right first time' : rank > 0 ? `Ranked #${rank + 1}` : 'Missed'}</strong><small>${rank === 0 ? 'You named it.' : rank > 0 ? 'On your list, but not first.' : 'It is named above.'}</small></article>
        <article><span>Investigating</span><strong>${asked} of ${investigation.interview.length + investigation.exam.length}</strong><small>Questions asked and checks made.</small></article>
      </div>
      <section class="cshift-debrief-section"><span class="label">Your diagnosis</span>${diagnosisReviewMarkup(diagnosisStage.options)}<p class="cshift-review-explanation">${esc(diagnosisStage.explanation)}</p>${rationale ? `<blockquote>${esc(rationale)}</blockquote>` : ''}</section>
      <section class="cshift-debrief-section"><span class="label">Decision review</span><div class="cshift-review-list">${decisionReviewMarkup()}</div></section>
      ${
        wroteNote
          ? `<section class="cshift-debrief-section"><span class="label">Your note</span>${noteComparisonMarkup(modelNote)}</section>`
          : `<section class="cshift-debrief-section"><span class="label">Example note</span><div class="cshift-clinical-note"><article><strong>What is going on</strong><p>${esc(modelNote.assessment)}</p></article><article><strong>The plan</strong><p>${esc(modelNote.plan)}</p></article></div></section>`
      }
      <section class="cshift-debrief-section"><span class="label">Clinical pearls</span><div class="cshift-pearls">${caseData.pearls.map((pearl, index) => `<article><span>${String(index + 1).padStart(2, '0')}</span><p>${esc(pearl)}</p></article>`).join('')}</div></section>
      ${notesReviewMarkup()}
      ${readOnly ? `<details class="cshift-saved-chart"><summary>Review the saved patient chart</summary>${chartMarkup({ vitals: true })}</details>` : ''}
      ${reviewSourceMarkup()}`;
  }

  function renderShiftDebrief({ readOnly = false } = {}) {
    const { caseData, rotation, active } = shiftSession;
    if (!readOnly) {
      active.phase = 'debrief';
      if (!finishClinicalShift()) return;
    }
    /* A saved record keeps the scores it was given; anything it lacks is worked out from its calls. */
    const scores = { ...calculateScores(), ...(active.scores || {}) };
    const reacting = !!reactionOf(active);
    const body = reacting ? reactingDebriefMarkup(scores, readOnly) : classicDebriefMarkup(scores, readOnly);
    const root = shiftFrame(
      `<section class="cshift-debrief ${reacting ? 'cshift-debrief-ward' : ''}">
      ${body}
      <div class="cshift-end-actions">${readOnly ? '<button class="btn" id="cshift-back-history">Back to saved shifts</button><button class="btn" id="cshift-history-rotations">Back to rotations</button>' : `<button class="btn btn-solid" id="cshift-next-patient">${active.shuffle ? 'Next patient · shuffle' : `Next patient in ${esc(rotation.name)}`} →</button>${reacting ? '<button class="btn" id="cshift-replay">Replay this patient</button>' : ''}<button class="btn" id="cshift-choose-rotation">Choose another rotation</button><button class="ghostbtn" id="cshift-classic">Classic case bank</button>`}</div>
    </section>`,
      'debrief',
      { readOnly }
    );
    root.querySelector('#cshift-back-history')?.addEventListener('click', () => openClinicalShiftHistory());
    root.querySelector('#cshift-history-rotations')?.addEventListener('click', () => {
      shiftRoute();
      renderClinicalShift();
    });
    root
      .querySelector('#cshift-next-patient')
      ?.addEventListener('click', () =>
        active.shuffle ? startShuffleShift(caseData.id) : startClinicalShift(rotation.key)
      );
    root
      .querySelector('#cshift-replay')
      ?.addEventListener('click', () =>
        startClinicalShift(rotation.key, { caseId: caseData.id, shuffle: !!active.shuffle })
      );
    root.querySelector('#cshift-choose-rotation')?.addEventListener('click', () => {
      shiftState.active = null;
      shiftSession = null;
      if (saveShiftState()) {
        shiftRoute();
        renderClinicalShift();
      }
    });
    root.querySelector('#cshift-classic')?.addEventListener('click', renderClinicalCaseBank);
    setShiftView(root);
  }

  window.renderClinicalShift = renderClinicalShift;
  window.startClinicalShift = startClinicalShift;
  window.openClinicalShiftHistory = openClinicalShiftHistory;
})();
