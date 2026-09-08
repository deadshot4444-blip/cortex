/* Clinical Shift pilot — specialty-only, hidden-patient clinical reasoning loop. */
(() => {
  'use strict';

  const SHIFT_STORAGE_KEY = 'cs-clinical-shift-v1';
  const SHIFT_MANIFEST_URL = 'data/clinical-shift-pilot.json?v=8';
  const SHIFT_STEPS = ['Handoff', 'Investigate', 'Reason', 'Chart', 'Debrief'];
  let shiftManifest = null;
  let shiftSession = null;

  function blankShiftState() {
    return { version: 1, active: null, completed: {}, history: [] };
  }

  function loadShiftState() {
    const value = StudyStorage.read(SHIFT_STORAGE_KEY, blankShiftState());
    const object = v => v && typeof v === 'object' && !Array.isArray(v);
    if (!object(value) || value.version !== 1 || !object(value.completed) || !Array.isArray(value.history) ||
        (value.active != null && (!object(value.active) || !value.active.caseId || !value.active.key ||
          !object(value.active.locks) || !object(value.active.drafts) || !object(value.active.optionOrders) ||
          !object(value.active.differential) || !Array.isArray(value.active.differential.ranked) ||
          !Array.isArray(value.active.resultsRevealed) || !object(value.active.note)))) {
      StudyStorage.sessionFailed();
      return blankShiftState();
    }
    return { ...blankShiftState(), ...value };
  }

  let shiftState = loadShiftState();
  StudyStorage.watch(SHIFT_STORAGE_KEY, () => shiftState);
  for (const [key, field] of [['cs-progress', 'progress'], ['cs-cases', 'cases'], ['cs-history', 'history'], ['cs-streak', 'streak']]) {
    const saved = StudyStorage.read(key, store[field]);
    if (JSON.stringify(saved) !== JSON.stringify(field === 'history' ? store.history.slice(0, 400) : store[field])) StudyStorage.sessionFailed();
    StudyStorage.watch(key, () => field === 'history' ? store.history.slice(0, 400) : store[field]);
  }
  window.addEventListener('study-storage-recovered', () => {
    if (location.pathname.replace(/\/$/, '') !== '/practice') return;
    if (new URLSearchParams(location.search).get('view') === 'longitudinal') return;
    if (new URLSearchParams(location.search).get('view') === 'shift-history') { renderClinicalShift(); return; }
    if (shiftSession && shiftState.active) { shiftRoute(shiftState.active); renderActiveShiftPhase(); }
    else renderClinicalShift();
  });

  function saveShiftState() {
    return StudyStorage.write(SHIFT_STORAGE_KEY, shiftState);
  }

  function shiftRoute(active = null) {
    const url = new URL(location.href);
    url.pathname = '/practice';
    ['view', 'run'].forEach(key => url.searchParams.delete(key));
    if (active) { url.searchParams.set('view', 'shift'); url.searchParams.set('run', active.runId); }
    if (url.href !== location.href) history.pushState({}, '', url.pathname + url.search);
  }

  function renderShiftError(message, retry) {
    const root = el('<div></div>');
    root.appendChild(topbar('practice'));
    const main = el(`<main class="panel cshift-loading" id="main"><span class="label">Clinical Shift</span><h1>The patient could not open.</h1><p>${esc(message)} Your saved work has been kept.</p><button class="btn btn-solid" id="cshift-retry">Try again</button><button class="btn" id="cshift-back-hub">Back to specialties</button></main>`);
    main.querySelector('#cshift-retry').addEventListener('click', retry);
    main.querySelector('#cshift-back-hub').addEventListener('click', () => { shiftRoute(); renderClinicalShift(); });
    root.appendChild(main); setShiftView(root);
  }

  function setShiftView(root, { preserveScroll = false, focusSelector = '' } = {}) {
    const previousScroll = preserveScroll ? window.scrollY : 0;
    setView(root);
    if (preserveScroll) requestAnimationFrame(() => {
      window.scrollTo(0, previousScroll);
      root.querySelector(focusSelector)?.focus({ preventScroll: true });
    });
  }

  async function loadShiftManifest() {
    if (shiftManifest) return shiftManifest;
    const response = await fetch(SHIFT_MANIFEST_URL);
    if (!response.ok) throw new Error('Clinical Shift manifest unavailable');
    const value = await response.json();
    if (!Array.isArray(value.rotations) || !value.rotations.length || value.rotations.some(rotation =>
      !rotation.key || !rotation.name || !Array.isArray(rotation.caseIds) || !rotation.caseIds.length ||
      rotation.caseIds.some(id => !value.modelNotes?.[id]?.assessment || !value.modelNotes[id].plan ||
        !value.investigations?.[id]?.interview?.length || !value.investigations[id].exam?.length))) throw new Error('Clinical Shift manifest is incomplete');
    shiftManifest = value;
    return shiftManifest;
  }

  function rotationFor(key) {
    return shiftManifest?.rotations.find(rotation => rotation.key === key) || null;
  }

  function caseIsCompatible(caseData) {
    if (!caseData?.id || !caseData.patient || !caseData.history || !caseData.exam || !caseData.vitals ||
        !Array.isArray(caseData.pearls) || !Array.isArray(caseData.stages)) return false;
    const diagnosisStages = caseData.stages.filter(stage => stage.type === 'question' && stage.label === 'DIAGNOSIS');
    const firstResult = caseData.stages.findIndex(stage => stage.type === 'result');
    const diagnosisIndex = caseData.stages.findIndex(stage => stage.type === 'question' && stage.label === 'DIAGNOSIS');
    return caseData.stages[0]?.type === 'question'
      && caseData.stages[0]?.label === 'INITIAL APPROACH'
      && diagnosisStages.length === 1
      && firstResult > 0
      && firstResult < diagnosisIndex
      && caseData.stages.slice(diagnosisIndex + 1).some(stage => stage.type === 'question')
      && caseData.stages.every(stage => stage.type === 'result' ? typeof stage.content === 'string' : stage.type === 'question')
      && caseData.stages.filter(stage => stage.type === 'question').every(stage => stage.question && stage.explanation && Array.isArray(stage.options)
        && stage.options.length >= 4
        && stage.options.every(option => typeof option === 'string' && option.trim())
        && Number.isInteger(stage.answer)
        && stage.answer >= 0
        && stage.answer < stage.options.length);
  }

  function activeIsCompatible(active, caseData) {
    const validChoice = (index, choice) => {
      const stage = caseData.stages[Number(index)];
      return stage?.type === 'question' && Number.isInteger(choice) && choice >= 0 && choice < stage.options.length;
    };
    return ['handoff', 'investigate', 'timeline', 'decision', 'differential', 'note', 'debrief'].includes(active.phase)
      && Number.isInteger(active.stageCursor) && active.stageCursor >= 0 && active.stageCursor <= caseData.stages.length
      && Object.entries(active.locks).every(([index, lock]) => lock && validChoice(index, lock.choice))
      && Object.entries(active.drafts).every(([index, choice]) => validChoice(index, choice))
      && Object.entries(active.optionOrders).every(([index, order]) => Array.isArray(order) && order.length === caseData.stages[Number(index)]?.options?.length && new Set(order).size === order.length && order.every(choice => validChoice(index, choice)))
      && active.resultsRevealed.every(index => Number.isInteger(index) && caseData.stages[index]?.type === 'result')
      && new Set(active.differential.ranked).size === active.differential.ranked.length
      && active.differential.ranked.length <= 3
      && active.differential.ranked.every(choice => validChoice(active.differential.stageIndex, choice))
      && ['assessment', 'plan'].every(key => typeof active.note[key] === 'string');
  }

  function completedCount(rotation) {
    return rotation.caseIds.filter(id => shiftState.completed[id]?.attempts).length;
  }

  function renderShiftLoading(message = 'Preparing the rotation…') {
    stopTimer(); session = null;
    const root = el('<div></div>');
    root.appendChild(topbar('practice'));
    root.appendChild(el(`<main class="panel cshift-loading" id="main"><span class="label">Clinical Shift</span><h1>${esc(message)}</h1><p>Building your patient assignment and opening the chart.</p></main>`));
    setShiftView(root);
  }

  /* A debriefed encounter is already archived in history; it is never an unfinished shift. */
  const shiftInProgress = () => !!shiftState.active && !shiftState.active.completedAt;
  function releaseFinishedShift() {
    if (!shiftState.active?.completedAt) return false;
    shiftState.active = null; shiftSession = null; return true;
  }

  function activeRotationName() {
    return rotationFor(shiftState.active?.key)?.name || NAME_BY_KEY[shiftState.active?.key] || 'Clinical Shift';
  }

  function confirmShiftEnd(trigger, onConfirm, replacement = false) {
    const main = trigger.closest('main'), runId = shiftState.active?.runId;
    if (!main || main.querySelector('dialog') || StudyStorage.paused) return;
    const dialog = el(`<dialog class="cshift-confirm" aria-labelledby="cshift-confirm-title" aria-describedby="cshift-confirm-description">
      <h2 id="cshift-confirm-title">${replacement ? 'Accept a different patient?' : 'End this shift?'}</h2>
      <p id="cshift-confirm-description">${replacement ? 'Your current patient will be replaced when the new patient is ready.' : 'Your current patient and unfinished decisions will be removed.'} Completed shifts and saved notes will stay in your history.</p>
      <div><button class="btn" id="cshift-keep" autofocus>Keep current shift</button><button class="btn btn-solid" id="cshift-confirm-end">${replacement ? 'Replace patient' : 'End shift'}</button></div>
    </dialog>`);
    const finish = accepted => {
      dialog.close(); dialog.remove();
      if (accepted && main.isConnected && shiftState.active?.runId === runId && !StudyStorage.paused) onConfirm();
      else if (trigger.isConnected && !StudyStorage.paused) trigger.focus();
    };
    dialog.querySelector('#cshift-keep').addEventListener('click', () => finish(false));
    dialog.querySelector('#cshift-confirm-end').addEventListener('click', () => finish(true));
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const first = dialog.querySelector('#cshift-keep'), last = dialog.querySelector('#cshift-confirm-end');
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    main.appendChild(dialog); dialog.showModal(); dialog.querySelector('#cshift-keep').focus();
  }

  async function renderClinicalShift() {
    stopTimer(); session = null;
    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'shift-history') { renderShiftHistory(params.get('run')); return; }
    if (new URLSearchParams(location.search).get('view') === 'longitudinal') { await ClinicalLongitudinal.entry(); return; }
    if (!shiftManifest) {
      renderShiftLoading();
      try { await loadShiftManifest(); }
      catch (error) {
        console.error('Clinical Shift load failed', error);
        renderShiftError('The rotation download failed.', renderClinicalShift);
        return;
      }
    }

    if (location.pathname.replace(/\/$/, '') !== '/practice') return;
    if (params.get('view') === 'content') { renderShiftContentStatus(); return; }
    if (params.get('view') === 'shift' && params.get('run') === shiftState.active?.runId) { await resumeClinicalShift(); return; }
    const root = el('<div></div>');
    root.appendChild(topbar('practice'));
    const active = shiftInProgress() ? shiftState.active : null;
    const main = el(`<main class="panel cshift-hub" id="main">
      <header class="cshift-hub-hero">
        <span class="label">Clinical Scenarios</span>
        <h1>Start your shift.</h1>
        <p>Choose a specialty. Cortex assigns the patient. Review the chart, lock your decisions, rank a differential, write your note, and compare it with a model before the clinical debrief.</p>
        <p class="cshift-content-status">Beta for advanced students with basic clinical knowledge. ${shiftManifest.rotations.reduce((sum, rotation) => sum + rotation.caseIds.length, 0)} fictional encounters, about 15–25 minutes each. Sources checked September 7, 2026; independent clinician review remains pending. Practice decisions and note comparison do not establish clinical competence.</p>
      </header>
      ${active ? `<section class="cshift-resume">
        <div><span class="label">Shift in progress</span><strong>${esc(activeRotationName())}</strong><p>Your patient and every locked decision are saved on this device.</p></div>
        <div><button class="btn btn-solid" id="cshift-resume">Continue shift →</button><button class="ghostbtn" id="cshift-end-active">End shift</button></div>
      </section>` : ''}
      <section class="cshift-rotations" aria-labelledby="cshift-rotations-title">
        <div class="cshift-section-head"><div><span class="label">Specialty rotations</span><h2 id="cshift-rotations-title">Choose your specialty.</h2></div><span>${shiftManifest.rotations.length} specialties · ${shiftManifest.rotations.reduce((sum, rotation) => sum + rotation.caseIds.length, 0)} hidden patients</span></div>
        <div class="cshift-rotation-list">
          ${shiftManifest.rotations.map((rotation, index) => `<button class="cshift-rotation" data-shift-specialty="${esc(rotation.key)}" aria-label="Start ${esc(rotation.name)} shift · ${completedCount(rotation)} of ${rotation.caseIds.length} completed">
            <span class="cshift-rotation-num mono">${String(index + 1).padStart(2, '0')}</span>
            <span class="cshift-rotation-copy"><strong>${esc(rotation.name)}</strong><span>${esc(rotation.description)}</span></span>
            <span class="cshift-rotation-progress">${completedCount(rotation)}/${rotation.caseIds.length} completed</span>
            <span class="cshift-rotation-go" aria-hidden="true"><span>Start</span> →</span>
          </button>`).join('')}
        </div>
      </section>
      <section class="cshift-classic">
        <div><span class="label">Your completed work</span><h2>Return to your notes and decisions.</h2><p>Open the original case, reasoning and model comparison from a completed shift.</p></div>
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

    main.querySelectorAll('[data-shift-specialty]').forEach(button => button.addEventListener('click', () => {
      const start = () => startClinicalShift(button.dataset.shiftSpecialty);
      if (shiftInProgress()) confirmShiftEnd(button, start, true);
      else start();
    }));
    main.querySelector('#cshift-resume')?.addEventListener('click', resumeClinicalShift);
    main.querySelector('#cshift-end-active')?.addEventListener('click', event => {
      confirmShiftEnd(event.currentTarget, () => {
        shiftState.active = null; shiftSession = null; if (saveShiftState()) { shiftRoute(); renderClinicalShift(); }
      });
    });
    main.querySelector('#cshift-classic').addEventListener('click', renderClinicalCaseBank);
    main.querySelector('#cshift-history').addEventListener('click', () => openClinicalShiftHistory());
    main.querySelector('#cshift-longitudinal').addEventListener('click', () => ClinicalLongitudinal.open());
    main.querySelector('#cshift-review').addEventListener('click', () => renderReview());
    main.querySelector('#cshift-content').addEventListener('click', () => {
      const url = new URL(location.href); url.searchParams.set('view', 'content'); url.searchParams.delete('run');
      history.pushState({}, '', url.pathname + url.search); renderShiftContentStatus();
    });
    root.appendChild(main); setShiftView(root);
  }

  function openClinicalShiftHistory({ runId, caseId, ts } = {}) {
    const record = caseId ? shiftState.history.find(item => item?.caseId === caseId && item.ts === ts) : null;
    const selected = runId || (caseId ? record?.encounter?.runId || 'unavailable' : null);
    const url = new URL(location.href);
    url.pathname = '/practice'; url.searchParams.set('view', 'shift-history');
    if (selected) url.searchParams.set('run', selected); else url.searchParams.delete('run');
    history.pushState({}, '', url.pathname + url.search);
    renderClinicalShift();
  }

  function renderShiftHistory(runId) {
    const records = shiftState.history.filter(item => item && typeof item === 'object');
    const record = records.find(item => item.encounter?.runId === runId);
    const active = record?.encounter;
    let valid = false;
    try {
      valid = Number.isFinite(active?.completedAt) && caseIsCompatible(active.content?.caseData)
        && activeIsCompatible(active, active.content.caseData)
        && active.content.modelNote?.assessment && active.content.modelNote?.plan;
    } catch { /* Older or damaged records remain available in the recovery export. */ }
    if (runId && valid) {
      const priorSession = shiftSession;
      shiftSession = { active: JSON.parse(JSON.stringify(active)), caseData: active.content.caseData,
        rotation: { key: record.key, name: NAME_BY_KEY[record.key] || record.key } };
      try { renderShiftDebrief({ readOnly: true }); } finally { shiftSession = priorSession; }
      return;
    }
    const root = el('<div></div>'); root.appendChild(topbar('practice'));
    const main = el(`<main class="panel cshift-hub" id="main"><button class="backbtn" id="cshift-history-home">← Back to rotations</button>
      <header class="cshift-hub-hero"><span class="label">Completed encounters</span><h1>Your saved shifts.</h1><p>Revisit your original notes, choices and model comparison. Opening a record does not change your progress. The most recent 100 completed shifts are retained here.</p></header>
      ${runId ? '<p role="status">The full encounter is unavailable or incomplete. Its summary and any recovery data are preserved.</p>' : ''}
      <div class="rows cs-rows cshift-history-list">${records.length ? records.map(item => `<button class="row cs-row" data-shift-record="${esc(item.encounter?.runId || 'unavailable')}"><span class="row-main"><span class="row-spec">${esc(NAME_BY_KEY[item.key] || item.key)}</span><span class="row-title">${esc(item.encounter?.content?.caseData?.title || item.caseId)}</span></span><span class="row-right">${esc(new Date(item.ts).toLocaleString())} · Open saved shift</span></button>`).join('') : '<p>No completed shifts yet. Your finished notes and debriefs will appear here.</p>'}</div>
    </main>`);
    main.querySelector('#cshift-history-home').addEventListener('click', () => { shiftRoute(); renderClinicalShift(); });
    main.querySelectorAll('[data-shift-record]').forEach(button => button.addEventListener('click', () => openClinicalShiftHistory({ runId: button.dataset.shiftRecord })));
    root.appendChild(main); setShiftView(root);
  }

  function renderShiftContentStatus() {
    const root = el('<div></div>'); root.appendChild(topbar('practice'));
    const main = el(`<main class="panel cshift-hub" id="main"><button class="backbtn" id="cshift-status-back">← Back to rotations</button>
      <header class="cshift-hub-hero"><span class="label">Content status</span><h1>Case sources & objectives.</h1>
        <p>These are original fictional encounters. Source checks are recorded separately from independent clinician review, which is still pending. Opening the details reveals each case’s teaching focus.</p></header>
      ${shiftManifest.rotations.map(rotation => `<section class="cshift-content-register"><h2>${esc(rotation.name)}</h2>${rotation.caseIds.map(id => {
        const review = shiftManifest.caseReviews?.[id];
        return `<details id="case-${esc(id)}"><summary>Case ${esc(id)} · ${review?.batch ? 'New rotation practice' : 'Foundation encounter'}</summary>
          <h3>Teaching objective</h3><p>${esc(review?.objective || 'Objective has not been recorded.')}</p>
          <p>${esc(review?.alternativesAndLimits || 'Scope review is pending.')}</p>
          ${(review?.learningLinks || []).map(link => { const url = new URL(sectionUrl('reference'), location.origin); url.searchParams.set('lesson', link.lesson); const back = window.AcademyCurriculum?.safeReturn(url.searchParams.get('returnTo') || location.pathname + location.search + location.hash); if (back) url.searchParams.set('returnTo', back); return `<p><a href="${esc(url.pathname + url.search)}">Related lesson: ${esc(link.title)}</a></p>`; }).join('')}
          <p>Source check: ${esc(review?.sourceCheckedOn || 'not recorded')} · Independent clinician review: pending.</p>
          ${(review?.reviewQuestions || []).length ? `<h3>Questions for review</h3><ul>${review.reviewQuestions.map(question => `<li>${esc(question)}</li>`).join('')}</ul>` : ''}
          <ul>${(review?.sources || []).filter(source => /^https:\/\//.test(source.url)).map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a></li>`).join('')}</ul></details>`;
      }).join('')}</section>`).join('')}</main>`);
    main.querySelector('#cshift-status-back').onclick = () => { shiftRoute(); renderClinicalShift(); };
    root.appendChild(main); setShiftView(root);
    if (/^#case-[a-z0-9-]+$/.test(location.hash)) {
      const target = main.querySelector(location.hash);
      if (target) { target.open = true; target.scrollIntoView({ block: 'start' }); }
    }
  }

  function newActiveShift(rotation, caseData) {
    return {
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
      completedAt: null,
      scores: null,
      content: JSON.parse(JSON.stringify({ revision: shiftManifest.version, caseData,
        investigation: shiftManifest.investigations[caseData.id], modelNote: shiftManifest.modelNotes[caseData.id],
        review: shiftManifest.caseReviews?.[caseData.id] || null })),
    };
  }

  async function startClinicalShift(key) {
    if (StudyStorage.paused) return;
    const previousRun = shiftState.active?.runId;
    renderShiftLoading('Assigning a patient…');
    try {
      const rotation = rotationFor(key);
      const data = await loadSpecialty(key);
      if (location.pathname.replace(/\/$/, '') !== '/practice' || StudyStorage.paused || shiftState.active?.runId !== previousRun) return;
      const allowed = new Set(rotation?.caseIds || []);
      const eligible = data.cases.filter(caseData => allowed.has(caseData.id) && caseIsCompatible(caseData));
      if (!rotation || !eligible.length) throw new Error('No compatible pilot cases');
      const unseen = eligible.filter(caseData => !shiftState.completed[caseData.id]?.attempts);
      const pool = unseen.length ? unseen : eligible;
      const caseData = pool[Math.floor(Math.random() * pool.length)];
      shiftState.active = newActiveShift(rotation, caseData);
      shiftSession = { rotation, caseData, active: shiftState.active };
      if (saveShiftState()) { shiftRoute(shiftState.active); renderShiftHandoff(); }
    } catch (error) {
      console.error('Clinical Shift patient assignment failed', error);
      renderShiftError('The patient download failed.', () => startClinicalShift(key));
    }
  }

  async function resumeClinicalShift() {
    if (!shiftState.active) { renderClinicalShift(); return; }
    renderShiftLoading('Reopening your patient…');
    try {
      const rotation = rotationFor(shiftState.active.key);
      const saved = shiftState.active.content?.caseData;
      const data = saved ? null : await loadSpecialty(shiftState.active.key);
      if (location.pathname.replace(/\/$/, '') !== '/practice') return;
      const caseData = saved || data.cases.find(item => item.id === shiftState.active.caseId);
      if (!rotation || !caseData || !rotation.caseIds.includes(caseData.id) || !caseIsCompatible(caseData)) throw new Error('Saved patient is unavailable');
      if (!activeIsCompatible(shiftState.active, caseData)) { StudyStorage.sessionFailed(); return; }
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
    else if (phase === 'differential') renderShiftDifferential();
    else if (phase === 'note') renderShiftNote();
    else if (phase === 'debrief') renderShiftDebrief();
    else advanceShiftTimeline();
  }

  function shiftStepIndex(phase) {
    if (phase === 'handoff') return 0;
    if (phase === 'investigate') return 1;
    if (phase === 'timeline' || phase === 'decision' || phase === 'differential') return 2;
    if (phase === 'note') return 3;
    return 4;
  }

  function shiftProgressMarkup(phase) {
    const current = shiftStepIndex(phase);
    return `<ol class="cshift-stepper" aria-label="Shift progress">${SHIFT_STEPS.map((step, index) => `<li class="${index === current ? 'active' : ''} ${index < current ? 'done' : ''}" ${index === current ? 'aria-current="step"' : ''}><span>${index < current ? '✓' : index + 1}</span><strong>${step}</strong></li>`).join('')}</ol>`;
  }

  function resultMarkup() {
    const { caseData, active } = shiftSession;
    const rows = active.resultsRevealed.map(index => caseData.stages[index]).filter(Boolean);
    if (!rows.length) return '<p class="cshift-chart-empty">No laboratory or imaging results have been added yet.</p>';
    return rows.map(result => `<article class="cshift-result"><span>${esc(result.label || 'New result')}</span><p>${esc(result.content)}</p></article>`).join('');
  }

  function investigationFor(caseData) {
    const authored = shiftSession?.active.content?.investigation || shiftManifest?.investigations?.[caseData.id];
    if (authored?.interview?.length && authored?.exam?.length) return authored;
    return {
      interview: [{ prompt: 'Ask for the complete symptom and medical history', finding: caseData.history }],
      exam: [{ prompt: 'Perform the documented focused examination', finding: caseData.exam }],
    };
  }

  function normalizeInvestigationState(active) {
    active.revealed ||= { history: false, exam: false };
    active.revealed.interviewItems = Array.isArray(active.revealed.interviewItems) ? active.revealed.interviewItems : [];
    active.revealed.examItems = Array.isArray(active.revealed.examItems) ? active.revealed.examItems : [];
  }

  function selectedInvestigationMarkup(items, selected, emptyCopy) {
    const rows = selected.map(index => items[index]).filter(Boolean);
    if (!rows.length) return `<p>${esc(emptyCopy)}</p>`;
    return rows.map(item => `<article><strong>${esc(item.prompt)}</strong><p>${esc(item.finding)}</p></article>`).join('');
  }

  function reasoningEvidenceMarkup() {
    const { caseData, active } = shiftSession;
    const rows = active.resultsRevealed.map(index => caseData.stages[index]).filter(Boolean);
    if (!rows.length) return '';
    return `<section class="cshift-evidence" role="status" aria-live="polite">
      <span class="label">Chart evidence available</span>
      ${rows.map(result => `<article><strong>${esc(result.label || 'New result')}</strong><p>${esc(result.content)}</p></article>`).join('')}
    </section>`;
  }

  function chartMarkup() {
    const { caseData, active } = shiftSession;
    normalizeInvestigationState(active);
    const investigation = investigationFor(caseData);
    const interviewCount = active.revealed.interviewItems.length;
    const examCount = active.revealed.examItems.length;
    return `<aside class="cshift-chart" aria-label="Patient chart">
      <div class="cshift-chart-head"><span class="label">Patient chart</span><strong>${esc(caseData.patient)}</strong><small>${esc(caseData.setting)}</small></div>
      <section class="cshift-chart-vitals"><span class="label">Initial vitals</span><div>${vitalsMarkup(caseData)}</div></section>
      <details ${interviewCount || active.revealed.history ? 'open' : ''}><summary>History <span>${active.revealed.history ? 'Reviewed' : `${interviewCount}/${investigation.interview.length} asked`}</span></summary><div class="cshift-chart-findings">${active.revealed.history && !interviewCount ? `<p>${esc(caseData.history)}</p>` : selectedInvestigationMarkup(investigation.interview, active.revealed.interviewItems, 'Choose an interview question to add its answer.')}</div></details>
      <details ${examCount || active.revealed.exam ? 'open' : ''}><summary>Examination <span>${active.revealed.exam ? 'Reviewed' : `${examCount}/${investigation.exam.length} examined`}</span></summary><div class="cshift-chart-findings">${active.revealed.exam && !examCount ? `<p>${esc(caseData.exam)}</p>` : selectedInvestigationMarkup(investigation.exam, active.revealed.examItems, 'Choose a focused examination to add its findings.')}</div></details>
      <section class="cshift-chart-results"><span class="label">Results</span>${resultMarkup()}</section>
      <details><summary>Encounter prompts so far</summary><div class="cshift-chart-findings"><p>Reports above remain as originally received. These prompts may describe later changes or ask about a hypothetical situation.</p>${caseData.stages.slice(0, ['handoff', 'investigate'].includes(active.phase) ? 0 : active.stageCursor + 1).filter(stage => stage.type === 'question').map(stage => `<article><strong>${esc(stage.label)}</strong><p>${esc(stage.question)}</p></article>`).join('') || '<p>No decision prompts have been opened.</p>'}</div></details>
    </aside>`;
  }

  function shiftFrame(content, phase, { readOnly = false } = {}) {
    const { rotation } = shiftSession;
    const root = el(`<div>
      <header class="topbar cshift-runbar"><div class="side"><button class="backbtn" id="cshift-exit">${readOnly ? '← Saved shifts' : '← Save &amp; exit'}</button></div><div class="center"><span class="topstat">${esc(rotation.name)} · Clinical Shift</span></div><div class="side right"><span class="topstat">${readOnly ? 'Saved encounter' : 'Patient assigned'}</span></div></header>
      <main class="panel cshift-workspace" id="main">${shiftProgressMarkup(phase)}${content}</main>
    </div>`);
    root.querySelector('#cshift-exit').addEventListener('click', () => { if (readOnly) { openClinicalShiftHistory(); return; } releaseFinishedShift(); if (saveShiftState()) { shiftRoute(); renderClinicalShift(); } });
    return root;
  }

  function vitalsMarkup(caseData) {
    return Object.entries(caseData.vitals).map(([key, value]) => `<div><span>${esc(key)}</span><strong>${esc(value)}</strong></div>`).join('');
  }

  function renderShiftHandoff() {
    const { caseData, active } = shiftSession;
    active.phase = 'handoff'; saveShiftState();
    const root = shiftFrame(`<section class="cshift-handoff">
      <div class="cshift-handoff-main"><span class="label">New patient handoff</span><h1>A patient is waiting.</h1><p>This simulation separates practice tasks. In urgent clinical care, assessment and stabilization proceed together.</p><p class="cshift-patient-line">${esc(caseData.patient)} · ${esc(caseData.setting)}</p><div class="cshift-complaint"><span>Chief complaint</span><blockquote>${esc(caseData.chiefComplaint.replace(/^[“\"]|[”\"]$/g, ""))}</blockquote></div><button class="btn btn-solid" id="cshift-open-chart">Open patient chart →</button></div>
      <aside class="cshift-vitals"><span class="label">Initial vitals</span>${vitalsMarkup(caseData)}</aside>
    </section>`, 'handoff');
    root.querySelector('#cshift-open-chart').addEventListener('click', () => { active.phase = 'investigate'; saveShiftState(); renderShiftInvestigation(); });
    setShiftView(root);
  }

  function renderShiftInvestigation({ preserveScroll = false, focusSelector = '' } = {}) {
    const { caseData, active } = shiftSession;
    normalizeInvestigationState(active);
    const investigation = investigationFor(caseData);
    active.phase = 'investigate'; saveShiftState();
    const root = shiftFrame(`<div class="cshift-two-col">
      <section class="cshift-task"><span class="label">Investigate</span><h1>Ask, look, and listen.</h1><p>Choose the questions and focused examinations that matter. Each response is added to the chart. You can proceed at any point, but uncollected information may make the reasoning steps harder.</p>
        <div class="cshift-investigation-groups">
          <section class="cshift-investigation-group"><header><div><span class="label">Interview</span><h2>What do you want to ask?</h2></div><strong>${active.revealed.interviewItems.length}/${investigation.interview.length} asked</strong></header><div>${investigation.interview.map((item, index) => {
            const selected = active.revealed.interviewItems.includes(index);
            return `<button class="cshift-inquiry ${selected ? 'done' : ''}" data-cshift-investigation="interview" data-cshift-index="${index}" ${selected ? 'disabled' : ''}><span>${selected ? '✓' : '?'}</span><strong>${esc(item.prompt)}</strong>${selected ? `<small>${esc(item.finding)}</small>` : '<small>Ask patient</small>'}</button>`;
          }).join('')}</div></section>
          <section class="cshift-investigation-group"><header><div><span class="label">Focused examination</span><h2>What do you want to look for?</h2></div><strong>${active.revealed.examItems.length}/${investigation.exam.length} examined</strong></header><div>${investigation.exam.map((item, index) => {
            const selected = active.revealed.examItems.includes(index);
            return `<button class="cshift-inquiry ${selected ? 'done' : ''}" data-cshift-investigation="exam" data-cshift-index="${index}" ${selected ? 'disabled' : ''}><span>${selected ? '✓' : '+'}</span><strong>${esc(item.prompt)}</strong>${selected ? `<small>${esc(item.finding)}</small>` : '<small>Examine patient</small>'}</button>`;
          }).join('')}</div></section>
        </div>
        <button class="btn btn-solid" id="cshift-begin-reasoning">Begin clinical reasoning →</button>
      </section>${chartMarkup()}</div>`, 'investigate');
    root.querySelectorAll('[data-cshift-investigation]').forEach(button => button.addEventListener('click', () => {
      const kind = button.dataset.cshiftInvestigation;
      const index = Number(button.dataset.cshiftIndex);
      const key = kind === 'interview' ? 'interviewItems' : 'examItems';
      if (!active.revealed[key].includes(index)) active.revealed[key].push(index);
      const items = kind === 'interview' ? investigation.interview : investigation.exam;
      if (active.revealed[key].length === items.length) active.revealed[kind === 'interview' ? 'history' : 'exam'] = true;
      saveShiftState();
      renderShiftInvestigation({ preserveScroll: true, focusSelector: `[data-cshift-investigation="${kind}"][data-cshift-index="${index}"]` });
    }));
    root.querySelector('#cshift-begin-reasoning').addEventListener('click', () => { active.phase = 'timeline'; active.stageCursor = 0; saveShiftState(); advanceShiftTimeline(); });
    setShiftView(root, { preserveScroll, focusSelector });
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
    active.phase = 'timeline';
    while (active.stageCursor < caseData.stages.length && caseData.stages[active.stageCursor].type === 'result') {
      if (!active.resultsRevealed.includes(active.stageCursor)) active.resultsRevealed.push(active.stageCursor);
      active.stageCursor++;
    }
    if (active.stageCursor >= caseData.stages.length) {
      active.phase = 'note'; saveShiftState(); renderShiftNote(); return;
    }
    const stage = caseData.stages[active.stageCursor];
    if (stage.label === 'DIAGNOSIS') { active.phase = 'differential'; active.differential.stageIndex = active.stageCursor; saveShiftState(); renderShiftDifferential(); return; }
    active.phase = 'decision'; saveShiftState(); renderShiftDecision();
  }

  function decisionOptionsMarkup(stage, stageIndex, selected, locked) {
    return shuffledOrder(stageIndex, stage).map((originalIndex, displayIndex) => `<button class="cshift-option ${selected === originalIndex ? 'selected' : ''}" data-cshift-choice="${originalIndex}" aria-pressed="${selected === originalIndex}" ${locked ? 'disabled' : ''}><span>${LETTERS[displayIndex]}</span><strong>${esc(stage.options[originalIndex])}</strong></button>`).join('');
  }

  function renderShiftDecision({ preserveScroll = false } = {}) {
    const { caseData, active } = shiftSession;
    const stageIndex = active.stageCursor;
    const stage = caseData.stages[stageIndex];
    const lock = active.locks[stageIndex];
    const selected = lock ? lock.choice : active.drafts[stageIndex];
    const root = shiftFrame(`<div class="cshift-two-col">
      <section class="cshift-task"><span class="label">Clinical decision · ${esc(stage.label || 'Next step')}</span>${reasoningEvidenceMarkup()}<h1>${esc(stage.question)}</h1><p>${lock ? 'Your decision is locked. Correctness and the clinical explanation stay hidden until the debrief.' : 'Choose the best response, then lock it. You cannot change a locked decision.'}</p>
        <div class="cshift-options">${decisionOptionsMarkup(stage, stageIndex, selected, !!lock)}</div>
        ${lock ? `<div class="cshift-locked"><span>Decision locked</span><strong>${esc(stage.options[lock.choice])}</strong></div><button class="btn btn-solid" id="cshift-next-stage">Continue →</button>` : `<button class="btn btn-solid" id="cshift-lock-decision" ${selected == null ? 'disabled' : ''}>Lock decision</button>`}
      </section>${chartMarkup()}</div>`, 'decision');
    root.querySelectorAll('[data-cshift-choice]').forEach(button => button.addEventListener('click', () => {
      const choice = Number(button.dataset.cshiftChoice);
      active.drafts[stageIndex] = choice; saveShiftState();
      root.querySelectorAll('[data-cshift-choice]').forEach(option => {
        const selectedNow = Number(option.dataset.cshiftChoice) === choice;
        option.classList.toggle('selected', selectedNow);
        option.setAttribute('aria-pressed', String(selectedNow));
      });
      root.querySelector('#cshift-lock-decision').disabled = false;
    }));
    root.querySelector('#cshift-lock-decision')?.addEventListener('click', () => {
      const choice = active.drafts[stageIndex]; if (choice == null) return;
      active.locks[stageIndex] = { choice, lockedAt: Date.now() }; delete active.drafts[stageIndex]; saveShiftState();
      renderShiftDecision({ preserveScroll: true });
    });
    root.querySelector('#cshift-next-stage')?.addEventListener('click', () => { active.stageCursor++; saveShiftState(); advanceShiftTimeline(); });
    setShiftView(root, { preserveScroll, focusSelector: preserveScroll ? '#cshift-next-stage' : '' });
  }

  function differentialOptionsMarkup(stage, stageIndex) {
    const { active } = shiftSession;
    const ranked = active.differential.ranked;
    return shuffledOrder(stageIndex, stage).map(originalIndex => {
      const rank = ranked.indexOf(originalIndex);
      const rankLabel = rank >= 0 ? `Rank ${rank + 1}: ` : 'Unranked: ';
      return `<button class="cshift-dx-option ${rank >= 0 ? 'selected' : ''}" data-cshift-dx="${originalIndex}" aria-pressed="${rank >= 0}" aria-label="${esc(rankLabel + stage.options[originalIndex])}" ${active.differential.lockedAt ? 'disabled' : ''}><span>${rank >= 0 ? rank + 1 : '+'}</span><strong>${esc(stage.options[originalIndex])}</strong></button>`;
    }).join('');
  }

  function renderShiftDifferential({ preserveScroll = false } = {}) {
    const { caseData, active } = shiftSession;
    const stageIndex = active.differential.stageIndex;
    const stage = caseData.stages[stageIndex];
    const locked = !!active.differential.lockedAt;
    const root = shiftFrame(`<div class="cshift-two-col">
      <section class="cshift-task"><span class="label">Clinical reasoning</span>${reasoningEvidenceMarkup()}<h1>Rank your differential.</h1><p class="cshift-review-question">${esc(stage.question)}</p><p>Rank one to three possibilities, leading choice first. Explain the evidence and why alternatives fit less well in at least 20 characters. The written rationale is saved for reflection and is not auto-graded.</p>
        <div class="cshift-dx-list">${differentialOptionsMarkup(stage, stageIndex)}</div>
        <label class="cshift-field"><span>Reasoning note</span><textarea id="cshift-rationale" rows="4" ${locked ? 'disabled' : ''} placeholder="My leading diagnosis is ahead because…">${esc(active.differential.rationale || '')}</textarea></label>
        ${locked ? '<div class="cshift-locked"><span>Differential locked</span><strong>Your ranking and rationale are saved for the debrief.</strong></div><button class="btn btn-solid" id="cshift-next-stage">Continue →</button>' : `<button class="btn btn-solid" id="cshift-lock-differential" ${active.differential.ranked.length < 1 || (active.differential.rationale || '').trim().length < 20 ? 'disabled' : ''}>Lock differential</button>`}
      </section>${chartMarkup()}</div>`, 'differential');
    if (!locked) {
      const rationale = root.querySelector('#cshift-rationale');
      const lockButton = root.querySelector('#cshift-lock-differential');
      const syncDifferential = () => {
        root.querySelectorAll('[data-cshift-dx]').forEach(button => {
          const choice = Number(button.dataset.cshiftDx);
          const rank = active.differential.ranked.indexOf(choice);
          button.classList.toggle('selected', rank >= 0);
          button.setAttribute('aria-pressed', String(rank >= 0));
          button.setAttribute('aria-label', `${rank >= 0 ? `Rank ${rank + 1}` : 'Unranked'}: ${stage.options[choice]}`);
          button.querySelector('span').textContent = rank >= 0 ? rank + 1 : '+';
        });
        lockButton.disabled = active.differential.ranked.length < 1 || rationale.value.trim().length < 20;
      };
      root.querySelectorAll('[data-cshift-dx]').forEach(button => button.addEventListener('click', () => {
        const choice = Number(button.dataset.cshiftDx); const current = active.differential.ranked.indexOf(choice);
        if (current >= 0) active.differential.ranked.splice(current, 1);
        else if (active.differential.ranked.length < 3) active.differential.ranked.push(choice);
        active.differential.rationale = rationale.value; saveShiftState(); syncDifferential();
      }));
      rationale.addEventListener('input', () => { active.differential.rationale = rationale.value; saveShiftState(); lockButton.disabled = active.differential.ranked.length < 1 || rationale.value.trim().length < 20; });
      lockButton.addEventListener('click', () => {
        active.differential.rationale = rationale.value;
        if (active.differential.ranked.length < 1 || active.differential.rationale.trim().length < 20) return;
        active.differential.lockedAt = Date.now(); saveShiftState(); renderShiftDifferential({ preserveScroll: true });
      });
    }
    root.querySelector('#cshift-next-stage')?.addEventListener('click', () => { active.stageCursor++; active.phase = 'timeline'; saveShiftState(); advanceShiftTimeline(); });
    setShiftView(root, { preserveScroll, focusSelector: preserveScroll ? '#cshift-next-stage' : '' });
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

  function noteComparisonMarkup(modelNote) {
    const { active } = shiftSession;
    return `<div class="cshift-note-comparison">
      <section><span class="label">Assessment</span><div><article class="cshift-note-yours"><strong>Your response</strong><p>${esc(active.note.assessment)}</p></article><article class="cshift-model-note"><strong>Model note</strong><p>${esc(modelNote.assessment)}</p></article></div></section>
      <section><span class="label">Plan</span><div><article class="cshift-note-yours"><strong>Your response</strong><p>${esc(active.note.plan)}</p></article><article class="cshift-model-note"><strong>Model note</strong><p>${esc(modelNote.plan)}</p></article></div></section>
    </div>`;
  }

  function renderShiftNote() {
    const { caseData, active } = shiftSession;
    active.note ||= { assessment: '', plan: '', revealedAt: null };
    const revealed = !!(active.note.revealedAt || active.note.signedAt);
    const modelNote = modelNoteFor(caseData);
    active.phase = 'note'; saveShiftState();
    const content = revealed
      ? `<section class="cshift-task cshift-note-review-stage"><span class="label">Charting self-review</span><h1>Compare your note with the model.</h1><p>Look for a concise problem representation, the evidence supporting the leading diagnosis, immediate management, consultation, and disposition. This educational reference is not an automated grade or a formally clinician-reviewed note.</p>
          ${noteComparisonMarkup(modelNote)}
          <button class="btn btn-solid" id="cshift-finish-note">Continue to debrief →</button>
        </section>`
      : `<section class="cshift-task"><span class="label">Charting</span><h1>Write your assessment and plan.</h1><p>Capture what you think is happening and what should happen next. When you are ready, reveal a case-specific model note and compare it with your own.</p>
          <label class="cshift-field"><span>Assessment</span><textarea id="cshift-assessment" rows="6" placeholder="Problem representation, leading diagnosis, and supporting evidence…">${esc(active.note.assessment)}</textarea></label>
          <label class="cshift-field"><span>Plan</span><textarea id="cshift-plan" rows="6" placeholder="Immediate actions, testing, treatment, consultation, and disposition…">${esc(active.note.plan)}</textarea></label>
          <p class="cshift-sign-note">Write at least 30 characters in each field. Nothing is submitted or clinically graded. Revealing the model freezes this response for self-review.</p><button class="btn btn-solid" id="cshift-reveal-note" ${active.note.assessment.trim().length < 30 || active.note.plan.trim().length < 30 ? 'disabled' : ''}>Reveal model note →</button>
        </section>`;
    const root = shiftFrame(`<div class="cshift-two-col">${content}${chartMarkup()}</div>`, 'note');
    if (!revealed) {
      const assessment = root.querySelector('#cshift-assessment');
      const plan = root.querySelector('#cshift-plan');
      const reveal = root.querySelector('#cshift-reveal-note');
      const update = () => {
        active.note.assessment = assessment.value;
        active.note.plan = plan.value;
        saveShiftState();
        reveal.disabled = assessment.value.trim().length < 30 || plan.value.trim().length < 30;
      };
      assessment.addEventListener('input', update);
      plan.addEventListener('input', update);
      reveal.addEventListener('click', () => {
        update();
        if (reveal.disabled) return;
        active.note.revealedAt = Date.now();
        saveShiftState();
        renderShiftNote();
      });
    }
    root.querySelector('#cshift-finish-note')?.addEventListener('click', () => {
      active.phase = 'debrief';
      if (finishClinicalShift()) renderShiftDebrief();
    });
    setShiftView(root);
  }

  function calculateScores() {
    const { caseData, active } = shiftSession;
    const diagnosisStage = caseData.stages[active.differential.stageIndex];
    const rank = active.differential.ranked.indexOf(diagnosisStage.answer);
    const reasoning = rank === 0 ? 30 : rank === 1 ? 20 : rank === 2 ? 10 : 0;
    const decisionEntries = Object.entries(active.locks).map(([index, lock]) => ({ stage: caseData.stages[Number(index)], lock }));
    const correct = decisionEntries.filter(entry => entry.lock.choice === entry.stage.answer).length;
    const decisions = decisionEntries.length ? Math.round(45 * correct / decisionEntries.length) : 0;
    normalizeInvestigationState(active);
    const investigation = investigationFor(caseData);
    const historyCoverage = active.revealed.interviewItems.length
      ? active.revealed.interviewItems.length / investigation.interview.length
      : active.revealed.history ? 1 : 0;
    const examCoverage = active.revealed.examItems.length
      ? active.revealed.examItems.length / investigation.exam.length
      : active.revealed.exam ? 1 : 0;
    const information = Math.round(8 * Math.min(historyCoverage, 1)) + Math.round(7 * Math.min(examCoverage, 1));
    const documentation = active.note.revealedAt || active.note.signedAt ? 10 : 0;
    return { information, reasoning, decisions, documentation, total: information + reasoning + decisions + documentation, correct, decisionTotal: decisionEntries.length, diagnosisRank: rank };
  }

  function finishClinicalShift() {
    const { caseData, rotation, active } = shiftSession;
    if (!active.completedAt) {
      active.completedAt = Date.now(); active.scores = calculateScores();
      const previous = shiftState.completed[caseData.id] || { attempts: 0, bestScore: 0 };
      shiftState.completed[caseData.id] = { attempts: previous.attempts + 1, bestScore: Math.max(previous.bestScore || 0, active.scores.total), lastScore: active.scores.total, lastAt: active.completedAt, key: rotation.key };
      shiftState.history.unshift({ caseId: caseData.id, key: rotation.key, score: active.scores.total, ts: active.completedAt,
        encounter: JSON.parse(JSON.stringify(active)) });
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

  function reviewSourceMarkup() {
    const { caseData, active } = shiftSession;
    const review = active.content?.review || shiftManifest?.caseReviews?.[caseData.id];
    if (!review) return '<p class="cshift-provenance">This older encounter has no recorded source pass. Independent clinician review remains pending.</p>';
    return `<section class="cshift-debrief-section"><h2>Scope and alternatives</h2><p>${esc(review.objective)}</p><p>${esc(review.alternativesAndLimits)}</p><p>Sources checked ${esc(review.sourceCheckedOn)}. Independent clinician review remains pending. Your written reasoning is retained, not automatically judged against one model.</p><ul>${review.sources.filter(source => /^https:\/\//.test(source.url)).map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a></li>`).join('')}</ul></section>`;
  }

  function decisionReviewMarkup() {
    const { caseData, active } = shiftSession;
    return Object.entries(active.locks).sort((a, b) => Number(a[0]) - Number(b[0])).map(([index, lock]) => {
      const stage = caseData.stages[Number(index)]; const correct = lock.choice === stage.answer;
      return `<article class="cshift-review-card ${correct ? 'correct' : 'incorrect'}"><div><span>${esc(stage.label || 'Decision')}</span><strong>${correct ? 'Sound decision' : 'Needs review'}</strong></div><p class="cshift-review-question">${esc(stage.question)}</p><dl><div><dt>Your choice</dt><dd>${esc(stage.options[lock.choice])}</dd></div><div><dt>Best choice</dt><dd>${esc(stage.options[stage.answer])}</dd></div></dl><p class="cshift-review-explanation">${esc(stage.explanation)}</p></article>`;
    }).join('');
  }

  function renderShiftDebrief({ readOnly = false } = {}) {
    const { caseData, rotation, active } = shiftSession;
    if (!readOnly) { active.phase = 'debrief'; if (!finishClinicalShift()) return; }
    const scores = active.scores || calculateScores();
    const diagnosisStage = caseData.stages[active.differential.stageIndex];
    const modelNote = modelNoteFor(caseData);
    const root = shiftFrame(`<section class="cshift-debrief">
      <header class="cshift-debrief-hero"><div><span class="label">Shift debrief · ${esc(rotation.name)}</span><h1>${esc(caseData.title)}</h1><p>${esc(caseData.patient)} · ${esc(caseData.setting)} · ${esc(caseData.difficulty)} case</p><p>Completed ${esc(new Date(active.completedAt).toLocaleString())}</p></div><div class="cshift-score"><strong>${scores.total}</strong><span>/100 exercise points</span></div></header>
      ${readOnly ? '<p class="cshift-provenance">Saved encounter: your original response and the teaching content available at that time. Later corrections do not rewrite this record.</p>' : ''}
      <p class="cshift-provenance">Points combine information opened, agreement with the case key, and note comparison. They are not a validated measure of clinical ability or patient safety.</p>
      <section class="cshift-diagnosis"><span class="label">Final diagnosis</span><h2>${esc(caseData.diagnosis)}</h2></section>
      <div class="cshift-domain-grid">
        <article><span>Patient safety</span><strong>Not assessed</strong><small>Branching safety consequences require authored review metadata.</small></article>
        <article><span>Information gathering</span><strong>${scores.information}/15</strong><small>History and examination review.</small></article>
        <article><span>Clinical reasoning</span><strong>${scores.reasoning}/30</strong><small>${scores.diagnosisRank < 0 ? 'Diagnosis absent from top three.' : `Correct diagnosis ranked #${scores.diagnosisRank + 1}.`}</small></article>
        <article><span>Clinical decisions</span><strong>${scores.decisions}/45</strong><small>${scores.correct} of ${scores.decisionTotal} locked decisions.</small></article>
        <article><span>Documentation</span><strong>${scores.documentation}/10</strong><small>Self-review completed; prose was not auto-graded.</small></article>
        <article><span>Efficiency</span><strong>Not assessed</strong><small>Speed and click count are not clinical quality.</small></article>
      </div>
      <section class="cshift-debrief-section"><span class="label">Your differential</span><ol class="cshift-ranked-review">${active.differential.ranked.map((choice, index) => `<li class="${choice === diagnosisStage.answer ? 'correct' : ''}"><span>${index + 1}</span><strong>${esc(diagnosisStage.options[choice])}</strong>${choice === diagnosisStage.answer ? '<em>Final diagnosis</em>' : ''}</li>`).join('')}</ol><blockquote>${esc(active.differential.rationale)}</blockquote></section>
      <section class="cshift-debrief-section"><span class="label">Charting self-review</span>${noteComparisonMarkup(modelNote)}</section>
      ${readOnly ? `<details class="cshift-saved-chart"><summary>Review the saved patient chart</summary>${chartMarkup()}</details>` : ''}
      <section class="cshift-debrief-section"><span class="label">Decision review</span><div class="cshift-review-list">${decisionReviewMarkup()}</div></section>
      <section class="cshift-debrief-section"><span class="label">Clinical pearls</span><div class="cshift-pearls">${caseData.pearls.map((pearl, index) => `<article><span>${String(index + 1).padStart(2, '0')}</span><p>${esc(pearl)}</p></article>`).join('')}</div></section>
      ${reviewSourceMarkup()}
      <div class="cshift-end-actions">${readOnly ? '<button class="btn" id="cshift-back-history">Back to saved shifts</button><button class="btn" id="cshift-history-rotations">Back to rotations</button>' : `<button class="btn btn-solid" id="cshift-next-patient">Next patient in ${esc(rotation.name)} →</button><button class="btn" id="cshift-choose-rotation">Choose another specialty</button><button class="ghostbtn" id="cshift-classic">Classic case bank</button>`}</div>
    </section>`, 'debrief', { readOnly });
    root.querySelector('#cshift-back-history')?.addEventListener('click', () => openClinicalShiftHistory());
    root.querySelector('#cshift-history-rotations')?.addEventListener('click', () => { shiftRoute(); renderClinicalShift(); });
    root.querySelector('#cshift-next-patient')?.addEventListener('click', () => startClinicalShift(rotation.key));
    root.querySelector('#cshift-choose-rotation')?.addEventListener('click', () => { shiftState.active = null; shiftSession = null; if (saveShiftState()) { shiftRoute(); renderClinicalShift(); } });
    root.querySelector('#cshift-classic')?.addEventListener('click', renderClinicalCaseBank);
    setShiftView(root);
  }

  window.renderClinicalShift = renderClinicalShift;
  window.startClinicalShift = startClinicalShift;
  window.openClinicalShiftHistory = openClinicalShiftHistory;
  window.resetClinicalShiftState = () => { shiftState = blankShiftState(); shiftSession = null; return StudyStorage.remove(SHIFT_STORAGE_KEY); };
})();
