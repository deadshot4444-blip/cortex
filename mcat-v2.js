/* MCAT 2.0 learning tools. First answers are immutable and assistance is always labeled. */
let v2Data = null,
  v2CarsPath = null,
  v2MathTransfer = null,
  v2Loading = null;
const v2State = McatV2Core.normalize(StudyStorage.read('cs-mcat-v2', {}));
const v2Store = StudyStorage.watch('cs-mcat-v2', () => v2State);
if (!McatV2Core.validPlanDays(v2State.weekly.planDays)) StudyStorage.sessionFailed();
let v2SaveFailed = false,
  v2Clock = null,
  v2LastInput = Date.now();
const V2_CAUSES = {
  content: 'Content',
  graph: 'Data / graph',
  math: 'Math / setup',
  reading: 'Main claim / reading',
  argument: 'Argument structure',
  transfer: 'Transfer to a new case',
  uncertain: 'Still uncertain',
};
function loadMcatV2() {
  if (!v2Loading)
    v2Loading = fetchMcatV2().finally(() => {
      v2Loading = null;
    });
  return v2Loading;
}
async function fetchMcatV2() {
  if (
    !StudyStorage.paused &&
    McatV2Core.reconcileCoachExposure(v2State, { qlog: QLOG, passageDisplays: window.McatRehearsal?.passageDisplays() })
  )
    v2Save();
  if (!v2Data) {
    try {
      const response = await fetch('data/mcat-v2.json?v=5');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.coaches) && data.probes) v2Data = data;
      }
    } catch {}
  }
  if (v2Data && !v2MathTransfer) {
    try {
      const response = await fetch('data/mcat-math-transfer.json?v=1');
      if (response.ok) {
        const data = await response.json();
        if (McatV2Core.validMathTransfer(data)) v2MathTransfer = data;
      }
    } catch {}
  }
  if (!v2Data || v2CarsPath) return;
  try {
    const response = await fetch('data/mcat-cars-path.json?v=1');
    if (!response.ok) return;
    const data = await response.json();
    if (
      !McatV2Core.validCarsPath(data) ||
      data.coaches.some(coach => v2Data.coaches.some(old => old.id === coach.id)) ||
      data.steps.some(step => ![...v2Data.coaches, ...data.coaches].some(coach => coach.id === step.coachId))
    )
      return;
    v2CarsPath = data;
    v2Data.coaches.push(...data.coaches);
  } catch {}
}
function v2RunCoach(run) {
  return run?.content?.coach || v2Coach(run?.coachId);
}
function v2CoachAllowed(coach) {
  if (!coach) return false;
  if (!coach.reservedTransfer) return true;
  const step = v2CarsPath?.steps.findIndex(item => item.coachId === coach.id);
  return (
    step >= 0 &&
    v2CarsPath.steps
      .slice(0, step)
      .every(item => v2State.coach.history.some(run => run.coachId === item.coachId && run.completedAt))
  );
}
function v2CarsPathMarkup(active) {
  if (!v2CarsPath)
    return '<section class="course-notice"><h2>CARS pathway did not download</h2><p>Existing workshops and saved work remain available.</p><button class="btn" id="cars-path-retry">Retry CARS pathway</button></section>';
  return `<section class="course-notice v2-cars-path"><span class="course-eyebrow">CLAIM → ARGUMENT → TRANSFER</span><h2>${esc(v2CarsPath.title)}</h2>
    <p>Work through four workshops. Support suggestions decrease along the path; you can choose the support you need. Completion unlocks the last passage without claiming mastery.</p>
    <ol>${v2CarsPath.steps
      .map(item => {
        const coach = v2Coach(item.coachId),
          done = v2State.coach.history.some(run => run.coachId === item.coachId && run.completedAt),
          allowed = v2CoachAllowed(coach);
        return `<li><h3>${esc(item.title)}</h3><p>${esc(coach.focus)}</p><p>${done ? 'Completed · original results retained' : allowed ? `${esc(item.support)} support suggested` : 'Complete the three earlier workshops to open this passage.'}</p>
        <button class="btn" data-coach-start="${esc(item.coachId)}" ${active || !allowed ? 'disabled' : ''}>${done ? 'Revisit workshop' : v2State.coach.parked.some(run => run.coachId === item.coachId) ? 'Resume saved workshop' : 'Open workshop'} →</button>
        <button class="ghostbtn" data-course-open="${esc(item.unitId)}">Open the connected lesson</button></li>`;
      })
      .join(
        ''
      )}</ol><p class="course-caption">The two new essays are short skill-practice passages. The final essay is reserved for this pathway and excluded from the general passage bank. A previous display or your self-report still makes a later attempt repeated practice. It is not a calibrated evaluation.</p>
    <details><summary>Sources and review</summary><p>${esc(v2CarsPath.reviewStatus)}</p><a href="${esc(v2CarsPath.source.url)}" target="_blank" rel="noopener">${esc(v2CarsPath.source.title)}</a></details></section>`;
}

function v2Save() {
  try {
    v2SaveFailed = !v2Store.save(v2State);
    return !v2SaveFailed;
  } catch {
    v2SaveFailed = true;
    document
      .querySelector('#v2-save-status')
      ?.replaceChildren(
        document.createTextNode('Storage unavailable. Keep this tab open and copy any important notes.')
      );
    return false;
  }
}
function v2Id() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function v2Tick() {
  const now = Date.now();
  if (v2Clock) {
    const delta = now - v2Clock.last;
    if (!document.hidden && now - v2LastInput < 120000 && delta >= 0 && delta < 30000) {
      const key = v2Clock.type + ':' + v2Clock.key;
      v2State.activityTime[key] = (v2State.activityTime[key] || 0) + delta;
    }
    v2Clock.last = now;
  }
}
function v2PauseActivity() {
  v2Tick();
  v2Clock = null;
  v2Save();
}
function v2BeginActivity(type, key) {
  if (StudyStorage.paused || (v2Clock?.type === type && v2Clock?.key === key)) return;
  v2Tick();
  v2Clock = { type, key, last: Date.now() };
  v2LastInput = Date.now();
}
function v2TrackView(root) {
  const node = root.querySelector('[data-v2-activity]');
  v2Tick();
  if (node) v2BeginActivity(node.dataset.v2Activity, node.dataset.v2Key);
  else {
    v2Clock = null;
    v2Save();
  }
  if (v2SaveFailed) {
    const status = root.querySelector('#v2-save-status');
    if (status) status.textContent = 'Storage unavailable. Keep this tab open and copy important notes.';
  }
}
function v2CompleteActivity(type, key) {
  v2Tick();
  const id = type + ':' + key,
    ms = v2State.activityTime[id] || 0;
  delete v2State.activityTime[id];
  v2Clock = null;
  if (ms > 0) v2State.durations.push({ type, key, ms, ts: Date.now() });
  v2State.durations = v2State.durations.slice(-120);
  const active = v2State.weekly.active;
  if (active?.type === type && active.key === key) {
    const ts = Date.now(),
      day = McatV2Core.dateKey(new Date(ts));
    v2State.weekly.done[active.id + ':' + day] = { ...active, plannedDay: active.plannedDay || active.day, day, ts };
    delete v2State.weekly.active;
  }
  v2Save();
}
setInterval(() => {
  if (v2Clock) {
    v2Tick();
    v2Save();
  }
}, 5000);
window.addEventListener('study-storage-conflict', () => {
  v2Clock = null;
});
for (const event of ['pointerdown', 'keydown', 'input', 'scroll'])
  document.addEventListener(
    event,
    () => {
      v2LastInput = Date.now();
    },
    { passive: true }
  );
document.addEventListener('visibilitychange', () => {
  v2Tick();
  v2Save();
});
window.addEventListener('pagehide', () => {
  v2Tick();
  v2Save();
});
function v2Go(view) {
  coursePauseTools();
  const run = new URLSearchParams(location.search).get('run');
  if (run && view === 'coach' && v2State.coach.active?.id === run) return renderV2Coach();
  if (run && view === 'math' && v2State.math.active?.id === run && !v2State.math.active.completedAt)
    return renderV2Math();
  const render = {
    coach: renderV2CoachHome,
    math: renderV2MathHome,
    weekly: renderV2Week,
    diagnose: renderV2DiagnosticHome,
    review: renderV2Review,
  };
  if (render[view]) render[view]();
}
function v2Shell(main, view, activity) {
  main.classList.add('v2-page');
  if (activity) {
    main.dataset.v2Activity = activity.type;
    main.dataset.v2Key = activity.key;
  }
  main.appendChild(
    el(
      `<p class="course-caption v2-save" id="v2-save-status" role="status">${v2SaveFailed ? 'Storage unavailable. Keep this tab open and copy important notes.' : view === 'review' ? 'Your reflections are saved only in this browser.' : 'Your work is saved in this browser. Signed-in sync follows your account settings.'}</p>`
    )
  );
  courseView(main, ['weekly', 'today'].includes(view) ? 'today' : view === 'review' ? 'progress' : 'practice');
  courseRoute(view);
  const url = new URL(location.href);
  const active =
    activity?.type === 'coach' ? v2State.coach.active : activity?.type === 'math' ? v2State.math.active : null;
  if (active?.id) url.searchParams.set('run', active.id);
  else url.searchParams.delete('run');
  history.replaceState({}, '', url.pathname + url.search);
  window.scrollTo(0, 0);
  if (activity?.type === 'coach' && v2State.coach.active?.stage === 'questions')
    courseFocusPrompt(main.querySelector('#coach-work h2'));
}
function v2Unavailable(view) {
  const m = el(
    '<main class="course-page"><h1>Learning tools could not load.</h1><p>Your saved work is unchanged.</p><button class="btn" id="v2-retry">Retry loading</button><button class="btn" data-course-view="practice">Practice</button></main>'
  );
  m.querySelector('#v2-retry').onclick = async () => {
    await loadMcatV2();
    v2Go(view);
  };
  m.querySelector('[data-course-view]').onclick = () => courseGo('practice');
  v2Shell(m, view);
}
function v2FeatureCards() {
  return `<section class="v2-features" aria-label="MCAT 2.0 practice"><button data-v2-view="coach"><span class="course-eyebrow">READ → REASON → APPLY</span><h2>Passage Coach</h2><p>Map the argument or experiment. Get support when you need it, then step back from the hints.</p><strong>${v2Data?.coaches.length || 8} workshops · CARS skill path ↗</strong></button><button data-v2-view="math"><span class="course-eyebrow">SET UP → CALCULATE → CHECK</span><h2>Math & graph gym</h2><p>Build the setup before the answer. Practice units, logs, powers, ratios, slopes, and estimates.</p><strong>6 skills · 48 variants ↗</strong></button></section>`;
}
function v2Today(host, compact = false) {
  const active = v2State.coach.active || (v2State.math.active?.completedAt ? null : v2State.math.active);
  host.insertAdjacentHTML(
    'beforeend',
    `<section class="v2-today-strip${compact ? ' v2-today-compact' : ''}"><div><span class="course-eyebrow">MCAT 2.0 / YOUR WEEK</span><h3>${v2State.weekly.configured ? 'A plan that fits your availability.' : 'Make room for learning and review.'}</h3><p>${v2State.weekly.configured ? 'Your weekly plan uses saved work, due checks, and the time you have available.' : 'Set study time by weekday and reserve space for practice exams and their review.'}</p></div><div class="course-actions"><button class="btn${compact ? '' : ' btn-solid'}" data-v2-view="weekly">${v2State.weekly.configured ? 'Open this week' : 'Build my week'} →</button>${active ? `<button class="btn" data-v2-view="${v2State.coach.active ? 'coach' : 'math'}">Resume saved ${v2State.coach.active ? 'coach' : 'math'} session</button>` : ''}</div></section>`
  );
}
document.addEventListener('click', e => {
  const nav = e.target.closest('[data-v2-view]');
  if (nav) {
    e.preventDefault();
    v2Go(nav.dataset.v2View);
  }
  const diag = e.target.closest('[data-v2-diagnose]');
  if (diag) {
    e.preventDefault();
    v2StartDiagnostic(diag.dataset.v2Diagnose);
  }
});
function v2Coach(id) {
  return v2Data?.coaches.find(c => c.id === id);
}
function v2Passage(c, r) {
  return r?.content?.passage || c.passage || (c.kind === 'cars' ? MCAT.cars : MCAT.sci).find(p => p.id === c.passageId);
}
function v2RehearsalAccess(c, r, retry) {
  const p = v2Passage(c, r);
  return !window.McatRehearsal || window.McatRehearsal.allow({ passageId: p?.id }, retry, renderV2CoachHome);
}
function v2RehearsalTag(main, c, r, questionId) {
  window.McatRehearsal?.tag(main, { passageId: v2Passage(c, r)?.id, questionId, context: 'passage-workshop' });
}
function v2ParkCoach() {
  v2PauseActivity();
  McatV2Core.parkCoach(v2State);
  if (v2Save()) renderV2CoachHome();
}
function v2ResumeCoach(id) {
  v2PauseActivity();
  if (!McatV2Core.resumeCoach(v2State, id)) return renderV2CoachHome();
  if (v2Save()) renderV2Coach();
}
function renderV2CoachHome() {
  if (!v2Data) return v2Unavailable('coach');
  const active = v2State.coach.active;
  const main = el(
    `<main class="course-page"><header class="v2-hero"><span class="course-eyebrow">PASSAGE COACH</span><h1>Make the reasoning visible.</h1><p>Start with a map of the passage. Use staged hints if you need them, then compare your reasoning with an authored model. Choose less support as you gain experience.</p><div class="v2-badges"><span>Science + CARS</span><span>Saved at every step</span><span>Assistance labeled</span></div></header>${active ? `<div class="course-notice"><strong>Continue ${esc(v2RunCoach(active)?.title || 'your workshop')}</strong><p>${active.answers.length} answers saved · ${esc(active.mode)} support</p><div class="course-actions"><button class="btn btn-solid" id="coach-resume">Resume workshop →</button><button class="btn" id="coach-park">Save for later and switch</button></div><p>Switching keeps every answer, note and hint in this workshop.</p></div>` : ''}${v2CarsPathMarkup(active)}<h2>More workshops</h2><div class="v2-catalog">${v2Data.coaches
      .filter(c => !v2CarsPath?.steps.some(step => step.coachId === c.id))
      .map(c => {
        const h = v2State.coach.history.filter(h => h.coachId === c.id);
        return `<article class="v2-catalog-card"><span class="course-eyebrow">${c.kind === 'cars' ? 'CARS' : 'SCIENCE'} / ${h.length ? 'PREVIOUSLY PRACTICED' : 'WORKSHOP'}</span><h2>${esc(c.title)}</h2><p>${esc(c.focus)}</p><button class="btn" data-coach-start="${c.id}" ${active ? 'disabled' : ''}>${v2State.coach.parked.some(r => r.coachId === c.id) ? 'Resume saved workshop' : h.length ? 'Revisit workshop' : 'Choose support & begin'} →</button>${h.length ? `<button class="ghostbtn" data-coach-history="${h.at(-1).id}">View saved reflection</button>` : ''}</article>`;
      })
      .join('')}</div>${
      v2State.coach.history.length
        ? `<details class="course-map"><summary>All saved workshops · ${v2State.coach.history.length}</summary><div class="v2-history">${v2State.coach.history
            .slice()
            .reverse()
            .map(
              h =>
                `<button class="ghostbtn" data-coach-history="${h.id}">${esc(v2RunCoach(h)?.title || 'Workshop')} · ${new Date(h.completedAt).toLocaleString()} · ${esc(h.mode)}</button>`
            )
            .join('')}</div></details>`
        : ''
    }<p class="course-caption">The original eight workshops use passages from the general bank. The two pathway essays are original, separate practice material. Seeing one elsewhere counts as prior exposure when retained in your history. They are not official AAMC questions.</p></main>`
  );
  main.querySelector('#coach-park')?.addEventListener('click', v2ParkCoach);
  main.querySelector('#cars-path-retry')?.addEventListener('click', async () => {
    await loadMcatV2();
    renderV2CoachHome();
  });
  main.querySelector('#coach-resume')?.addEventListener('click', renderV2Coach);
  main
    .querySelectorAll('[data-coach-start]')
    .forEach(b => (b.onclick = () => renderV2CoachSetup(b.dataset.coachStart)));
  main
    .querySelectorAll('[data-coach-history]')
    .forEach(
      b => (b.onclick = () => renderV2CoachReport(v2State.coach.history.find(h => h.id === b.dataset.coachHistory)))
    );
  v2Shell(main, 'coach');
}
function renderV2CoachSetup(id) {
  const parked = v2State.coach.parked.find(r => r.coachId === id);
  if (parked) return v2ResumeCoach(parked.id);
  if (v2State.coach.active) return renderV2Coach();
  const c = v2Coach(id);
  if (!c || !v2CoachAllowed(c)) return renderV2CoachHome();
  const suggested =
    v2CarsPath?.steps.find(step => step.coachId === id)?.support ||
    McatV2Core.nextSupport(v2State.coach.history, c.kind);
  const main = el(
    `<main class="course-page v2-narrow"><button class="backbtn" id="coach-back">← Workshops</button><span class="course-eyebrow">${esc(c.title)}</span><h1>Choose your support.</h1><p>${suggested === 'guided' ? 'Start with prompts for each reasoning step.' : 'Try less support when it suits your practice; you can still request a hint during a question.'} This suggestion follows the pathway order or earlier workshop completion. It is not a mastery estimate.</p><fieldset class="v2-support"><legend>Support level</legend>${[
      ['guided', 'Guided', 'Prompts and an optional hint ladder for each part.'],
      ['light', 'Light', 'A single planning prompt; optional hints remain available.'],
      ['independent', 'Independent', 'Work without scaffolds. Requesting a hint changes the evidence label.'],
    ]
      .map(
        ([v, n, d]) =>
          `<label><input type="radio" name="coach-mode" value="${v}" ${v === suggested ? 'checked' : ''}><span><strong>${n}${v === suggested ? ' · Suggested' : ''}</strong><small>${d}</small></span></label>`
      )
      .join(
        ''
      )}</fieldset><label class="v2-check"><input id="coach-seen" type="checkbox"> I have read this passage before, including outside saved Cortex history.</label><button class="btn btn-solid" id="coach-begin">Start workshop →</button></main>`
  );
  main.querySelector('#coach-back').onclick = renderV2CoachHome;
  main.querySelector('#coach-begin').onclick = () => {
    const mode = main.querySelector('[name="coach-mode"]:checked').value,
      p = v2Passage(c);
    if (!p) return v2Unavailable('coach');
    const seen = main.querySelector('#coach-seen').checked,
      old = new Set(
        McatV2Core.priorQuestionIds(p, {
          qlog: QLOG,
          qhist: QHIST,
          coachHistory: [...v2State.coach.history, ...v2State.coach.parked],
          coachExposures: v2State.coach.exposures,
          passageDisplays: window.McatRehearsal?.passageDisplays(),
          resumes: Object.fromEntries(['cars', 'plab', 'drill', 'sim'].map(key => [key, loadResume(key)])),
        })
      );
    const runId = v2Id();
    v2State.coach.exposures ||= {};
    v2State.coach.exposures[p.id] ||= { runId, ts: Date.now() };
    const { passage: embeddedPassage, ...coachSnapshot } = c;
    v2State.coach.active = {
      id: runId,
      coachId: id,
      content: JSON.parse(JSON.stringify({ coach: coachSnapshot, passage: p })),
      revisions: [],
      revisionDraft: {},
      choiceOrders: Object.fromEntries(p.questions.map(q => [q.id, McatV2Core.optionOrder(q.options, q.displayOrder)])),
      kind: c.kind,
      mode,
      stage: 'map',
      answers: [],
      notes: ['', '', ''],
      roles: [],
      hints: {},
      prior: p.questions.filter(q => seen || old.has(q.id)).map(q => q.id),
      startedAt: Date.now(),
      draft: {},
    };
    if (v2Save()) renderV2Coach();
  };
  v2Shell(main, 'coach');
}
function v2PassageMarkup(c, r) {
  const p = v2Passage(c, r);
  return `<article class="v2-passage" tabindex="0" aria-label="Passage text and data"><span class="label">${esc(p.title)}</span>${p.contentNote ? `<p class="course-caption">${esc(p.contentNote)}</p>` : ''}${p.text
    .split(/\n\n+/)
    .map(
      (par, i) =>
        `<section><span class="v2-par-number">${i + 1}</span><p>${esc(par)}</p>${c.kind === 'cars' && r.stage === 'map' && r.mode === 'guided' ? `<details class="v2-par-note"><summary>Optional paragraph ${i + 1} note${r.roles[i] ? ' · Saved' : ''}</summary><label class="v2-role-label" for="role-${i}">Scratch notes for your passage map<input id="role-${i}" data-coach-role="${i}" value="${esc(r.roles[i] || '')}" placeholder="Context, objection, evidence, qualification…"></label></details>` : ''}</section>`
    )
    .join(
      ''
    )}${p.table ? `<div class="v2-table-scroll" tabindex="0" role="region" aria-label="Passage data"><table><caption>${esc(p.table.caption || 'Passage data')}</caption><thead><tr>${p.table.headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${p.table.rows.map(row => `<tr>${row.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}</article>`;
}
function renderV2Coach() {
  const r = v2State.coach.active,
    c = v2RunCoach(r);
  if (!r || !c) return renderV2CoachHome();
  const p = v2Passage(c, r);
  if (!p) return v2Unavailable('coach');
  if (!v2RehearsalAccess(c, r, renderV2Coach)) return;
  if (r.stage === 'blind') return renderV2CoachBlind();
  if (r.stage === 'reflect') return renderV2CoachReflection();
  const main = el(
    `<main class="course-page"><div class="v2-run-head"><button class="backbtn" id="coach-save-exit">← Save & leave</button><span>${esc(r.mode)} · ${r.answers.length}/${p.questions.length} answers</span></div><h1 class="v2-run-title">${esc(c.title)}</h1><div class="v2-coach-layout">${v2PassageMarkup(c, r)}<section class="v2-coach-work" id="coach-work"></section></div></main>`
  );
  main.querySelector('#coach-save-exit').onclick = renderV2CoachHome;
  main.querySelectorAll('[data-coach-role]').forEach(
    input =>
      (input.oninput = () => {
        r.roles[+input.dataset.coachRole] = input.value;
        v2Save();
      })
  );
  const body = main.querySelector('#coach-work');
  if (r.stage === 'map') {
    const prompts =
      r.mode === 'guided'
        ? c.prompts
        : [
            r.mode === 'light'
              ? 'Summarize the central claim or experimental design, then identify its strongest support and one limitation.'
              : 'Write a short plan for approaching this passage.',
          ];
    body.innerHTML = `<span class="course-eyebrow">01 / MAP THE PASSAGE</span><h2>${r.mode === 'independent' ? 'Your approach' : 'Read for a purpose.'}</h2><p class="course-caption">Complete this short map to start the questions.${c.kind === 'cars' && r.mode === 'guided' ? ' Paragraph notes alongside the passage are optional scratch space.' : ''}</p>${prompts.map((p, i) => `<label for="coach-note-${i}">${esc(p)}</label><textarea id="coach-note-${i}" data-coach-note="${i}" rows="3">${esc(r.notes[i] || '')}</textarea>`).join('')}<div id="coach-map-hints">${Array.from({ length: r.hints.map || 0 }, (_, i) => `<p class="v2-hint">${esc(c.hints[i])}</p>`).join('')}</div>${(r.hints.map || 0) < 2 ? '<button class="ghostbtn" id="coach-map-hint">Request a planning hint</button>' : ''}<p class="course-caption">Writing is saved for comparison with the model. It is not automatically graded.</p><button class="btn btn-solid" id="coach-to-questions">Start the questions →</button>`;
    const next = body.querySelector('#coach-to-questions'),
      ready = () => (next.disabled = !prompts.every((_, i) => r.notes[i]?.trim()));
    ready();
    body.querySelectorAll('[data-coach-note]').forEach(
      t =>
        (t.oninput = () => {
          r.notes[+t.dataset.coachNote] = t.value;
          v2Save();
          ready();
        })
    );
    body.querySelector('#coach-map-hint')?.addEventListener('click', () => {
      r.hints.map = (r.hints.map || 0) + 1;
      v2Save();
      renderV2Coach();
    });
    next.onclick = () => {
      r.stage = 'questions';
      v2Save();
      renderV2Coach();
    };
  } else {
    const q = p.questions[r.answers.length];
    if (!q) {
      r.stage = c.blindReview ? 'blind' : 'reflect';
      if (!v2Save()) return;
      return c.blindReview ? renderV2CoachBlind() : renderV2CoachReflection();
    }
    const draft = r.draft[q.id] || {},
      hintCount = r.hints[q.id] || 0;
    body.innerHTML = `<span class="course-eyebrow">02 / QUESTION ${r.answers.length + 1}</span><h2>${esc(q.stem)}</h2>${v2Options(q.options, draft.chosen, 'coach-answer', r.choiceOrders?.[q.id])}<label for="coach-confidence">How sure are you?</label><select id="coach-confidence">${Object.entries(
      CONF
    )
      .map(([k, v]) => `<option value="${k}" ${(draft.confidence || 'unsure') === k ? 'selected' : ''}>${v}</option>`)
      .join(
        ''
      )}</select><label for="coach-evidence">What passage evidence supports your choice?</label><textarea id="coach-evidence" rows="3">${esc(draft.evidence || '')}</textarea>${Array.from({ length: hintCount }, (_, i) => `<p class="v2-hint">${esc(c.questionHints[i])}</p>`).join('')}${hintCount < 2 ? '<button class="ghostbtn" id="coach-q-hint">Request the next hint</button>' : ''}<button class="btn btn-solid" id="coach-lock">Save first answer →</button><p class="course-caption">Answers and explanations are reviewed after the whole passage. Guided and Light modes count as assisted practice.</p>`;
    const read = () => {
      r.draft[q.id] = {
        chosen: body.querySelector('[name="coach-answer"]:checked')
          ? Number(body.querySelector('[name="coach-answer"]:checked').value)
          : null,
        confidence: body.querySelector('#coach-confidence').value,
        evidence: body.querySelector('#coach-evidence').value,
      };
      v2Save();
      body.querySelector('#coach-lock').disabled = r.draft[q.id].chosen === null || !r.draft[q.id].evidence.trim();
    };
    body.querySelectorAll('input,textarea,select').forEach(i => i.addEventListener('input', read));
    read();
    body.querySelector('#coach-q-hint')?.addEventListener('click', () => {
      r.hints[q.id] = hintCount + 1;
      v2Save();
      renderV2Coach();
    });
    body.querySelector('#coach-lock').onclick = () => {
      const d = r.draft[q.id];
      if (!d || d.chosen === null || r.answers.some(a => a.qId === q.id)) return;
      r.answers.push({
        qId: q.id,
        chosen: d.chosen,
        confidence: d.confidence,
        evidence: d.evidence,
        correct: d.chosen === q.answer,
        assisted: r.mode !== 'independent' || Object.values(r.hints).some(n => n > 0),
        repeat: r.prior.includes(q.id),
        ts: Date.now(),
      });
      delete r.draft[q.id];
      v2Save();
      renderV2Coach();
    };
  }
  v2RehearsalTag(main, c, r, r.stage === 'questions' ? p.questions[r.answers.length]?.id : undefined);
  v2Shell(main, 'coach', { type: 'coach', key: c.id });
}
function v2Options(options, chosen, name, order) {
  return `<fieldset class="course-answers"><legend>Choose one answer</legend>${McatV2Core.optionOrder(options, order)
    .map(
      i =>
        `<label><input type="radio" name="${name}" value="${i}" ${chosen === i ? 'checked' : ''}><span>${esc(options[i])}</span></label>`
    )
    .join('')}</fieldset>`;
}
function renderV2CoachReflection() {
  const r = v2State.coach.active,
    c = v2RunCoach(r);
  if (!r || !c) return renderV2CoachHome();
  if (!v2RehearsalAccess(c, r, renderV2CoachReflection)) return;
  const main = el(
    `<main class="course-page v2-narrow"><span class="course-eyebrow">03 / COMPARE YOUR REASONING</span><h1>What will you carry forward?</h1><details class="course-map" open><summary>Your passage map</summary><div class="course-saved-answer">${r.notes
      .filter(Boolean)
      .map(n => `<p>${esc(n)}</p>`)
      .join(
        ''
      )}${r.roles.map((n, i) => `<p><b>Paragraph ${i + 1}:</b> ${esc(n)}</p>`).join('')}</div></details><section class="v2-model"><h2>Authored model</h2>${c.model.map(m => `<article><span class="label">${esc(m.label)}</span><p>${esc(m.text)}</p></article>`).join('')}</section>${v2CoachAnswers(c, r)}<label for="coach-reflection">Name one change you would make in a fresh passage.</label><textarea id="coach-reflection" rows="4">${esc(r.reflection || '')}</textarea><button class="btn btn-solid" id="coach-finish" ${r.reflection?.trim() ? '' : 'disabled'}>Save workshop & reflection →</button></main>`
  );
  main.querySelector('#coach-reflection').oninput = e => {
    r.reflection = e.target.value;
    v2Save();
    main.querySelector('#coach-finish').disabled = !e.target.value.trim();
  };
  main.querySelector('#coach-finish').onclick = () => {
    if (!r.reflection?.trim()) return;
    r.completedAt ||= Date.now();
    if (!v2State.coach.history.some(h => h.id === r.id)) v2State.coach.history.push(r);
    delete v2State.coach.active;
    v2CompleteActivity('coach', c.id);
    v2Save();
    renderV2CoachReport(r);
  };
  v2RehearsalTag(main, c, r, undefined);
  v2Shell(main, 'coach', { type: 'coach', key: c.id });
}
function renderV2CoachBlind() {
  const r = v2State.coach.active,
    c = v2RunCoach(r);
  if (!r || !c) return renderV2CoachHome();
  if (!v2RehearsalAccess(c, r, renderV2CoachBlind)) return;
  const p = v2Passage(c, r);
  r.revisions ||= [];
  r.revisionDraft ||= {};
  const q = p.questions[r.revisions.length];
  if (!q) {
    r.stage = 'reflect';
    if (v2Save()) renderV2CoachReflection();
    return;
  }
  const first = r.answers.find(answer => answer.qId === q.id);
  if (!first) return renderV2Coach();
  const draft = r.revisionDraft[q.id] || { chosen: first.chosen, evidence: '' };
  const main =
    el(`<main class="course-page"><div class="v2-run-head"><button class="backbtn" id="coach-blind-exit">← Save & leave</button><span>Review ${r.revisions.length + 1}/${p.questions.length}</span></div>
    <h1>Review before feedback.</h1><p>Your first answer stays saved. Keep it or revise it after rereading; answers and models remain hidden until this review is complete.</p>
    <div class="v2-coach-layout">${v2PassageMarkup(c, r)}<section class="v2-coach-work"><h2>${esc(q.stem)}</h2>
    <p>First choice: ${esc(q.options[first.chosen])}</p>${v2Options(q.options, draft.chosen, 'coach-revised-answer', r.choiceOrders?.[q.id])}
    <label for="coach-revised-evidence">Why are you keeping or changing your choice?</label><textarea id="coach-revised-evidence" rows="4">${esc(draft.evidence)}</textarea>
    <button class="btn btn-solid" id="coach-revised-save" ${draft.evidence.trim() ? '' : 'disabled'}>Save review choice →</button></section></div></main>`);
  main.querySelector('#coach-blind-exit').onclick = renderV2CoachHome;
  const read = () => {
    const choice = main.querySelector('[name="coach-revised-answer"]:checked');
    r.revisionDraft[q.id] = {
      chosen: choice ? Number(choice.value) : null,
      evidence: main.querySelector('#coach-revised-evidence').value,
    };
    v2Save();
    main.querySelector('#coach-revised-save').disabled =
      !r.revisionDraft[q.id].evidence.trim() || r.revisionDraft[q.id].chosen === null;
  };
  main.querySelectorAll('input,textarea').forEach(input => input.addEventListener('input', read));
  main.querySelector('#coach-revised-save').onclick = () => {
    const value = r.revisionDraft[q.id] || draft;
    if (
      StudyStorage.paused ||
      !value.evidence.trim() ||
      !Number.isInteger(value.chosen) ||
      r.revisions.some(answer => answer.qId === q.id)
    )
      return;
    r.revisions.push({
      qId: q.id,
      chosen: value.chosen,
      evidence: value.evidence,
      correct: value.chosen === q.answer,
      ts: Date.now(),
      feedbackSeen: false,
    });
    delete r.revisionDraft[q.id];
    if (v2Save()) renderV2CoachBlind();
  };
  v2RehearsalTag(main, c, r, undefined);
  v2Shell(main, 'coach', { type: 'coach', key: c.id });
}

function v2CoachAnswers(c, r) {
  return `<section class="v2-answer-review"><h2>First answers & evidence</h2>${r.exposureCorrection ? '<p>Exposure labels were corrected using an earlier saved passage display. Original choices and correctness are unchanged.</p>' : ''}${v2Passage(
    c,
    r
  )
    .questions.map(q => {
      const a = r.answers.find(a => a.qId === q.id);
      if (!a) return '';
      return `<details class="course-map"><summary>${a.correct ? 'Correct' : 'Revisit'} · ${esc(q.stem)} <span>${McatV2Core.bucket(a)}</span></summary><div class="course-saved-answer"><p>Your answer: ${esc(q.options[a.chosen])}</p><p>Your evidence: ${esc(a.evidence)}</p><p><strong>Answer: ${esc(q.options[q.answer])}</strong></p><p>${esc(q.explanation)}</p>${q.optionFeedback ? `<p><strong>Your option:</strong> ${esc(q.optionFeedback[a.chosen])}</p>` : ''}${q.evidenceParagraphs ? `<p>Passage support: ${q.evidenceParagraphs.map(i => 'paragraph ' + i).join(', ')}.</p>` : ''}${r.revisions?.find(item => item.qId === q.id) ? `<p><strong>Before-feedback review:</strong> ${esc(q.options[r.revisions.find(item => item.qId === q.id).chosen])} · ${r.revisions.find(item => item.qId === q.id).correct ? 'correct' : 'revisit'}</p><p>${esc(r.revisions.find(item => item.qId === q.id).evidence)}</p>` : ''}${!a.correct ? `<button class="btn" data-v2-diagnose="${c.unitId}">Investigate the sticking point →</button>` : ''}</div></details>`;
    })
    .join('')}</section>`;
}
function v2EvidenceMarkup(attempts, empty = 'No answers yet') {
  const e = McatV2Core.evidence(attempts);
  return `<div class="v2-evidence">${Object.entries(e)
    .map(
      ([k, v]) =>
        `<article><span>${k === 'independent' ? 'First independent' : k === 'assisted' ? 'First assisted' : 'Repeated items'}</span><strong>${v.total ? `${v.correct}/${v.total}` : '—'}</strong><small>${v.total ? 'correct' : esc(empty)}</small></article>`
    )
    .join('')}</div>`;
}
function renderV2CoachReport(r) {
  const c = v2RunCoach(r);
  if (!c) return renderV2CoachHome();
  if (!v2RehearsalAccess(c, r, () => renderV2CoachReport(r))) return;
  const main = el(
    `<main class="course-page v2-narrow"><span class="course-eyebrow">WORKSHOP SAVED</span><h1>${esc(c.title)}</h1>${v2EvidenceMarkup(r.answers)}${r.revisions?.length ? `<p>Before-feedback review: ${r.revisions.filter(answer => answer.correct).length}/${r.revisions.length} correct. First answers above remain unchanged.</p>` : ''}<p class="course-caption">First means no earlier exposure in retained history or your self-report. This is a practice record, not a score prediction.</p><section class="course-notice"><h2>Your next adjustment</h2><p>${esc(r.reflection)}</p></section>${v2CoachAnswers(c, r)}<details class="course-map"><summary>Your saved passage map & model</summary><div class="course-saved-answer"><h3>Your map</h3>${r.notes
      .filter(Boolean)
      .map(n => `<p>${esc(n)}</p>`)
      .join(
        ''
      )}${r.roles.map((n, i) => `<p><b>Paragraph ${i + 1}:</b> ${esc(n)}</p>`).join('')}<h3>Authored model</h3>${c.model.map(m => `<p><b>${esc(m.label)}:</b> ${esc(m.text)}</p>`).join('')}</div></details><div class="course-actions"><button class="btn btn-solid" data-v2-view="coach">Choose another workshop →</button><button class="btn" data-course-open="${c.unitId}">Revisit the connected lesson</button><button class="btn" data-v2-view="weekly">Back to my week</button></div></main>`
  );
  v2RehearsalTag(main, c, r, undefined);
  v2Shell(main, 'coach');
}
function v2Graph(g) {
  if (!g) return '';
  const maxX = Math.max(...g.points.map(p => p[0]), 1) * 1.1,
    maxY = Math.max(...g.points.map(p => p[1]), 1) * 1.15,
    xy = p => [55 + (p[0] / maxX) * 305, 210 - (p[1] / maxY) * 160];
  return `<figure class="v2-graph"><svg viewBox="0 0 400 275" role="img" aria-label="${esc(g.xLabel)} versus ${esc(g.yLabel)}. ${esc(g.points.map(p => p.join(', ')).join('; '))}"><path d="M55 25V210H370" fill="none" stroke="currentColor"/><polyline points="${g.points.map(p => xy(p).join(',')).join(' ')}" fill="none" stroke="#456dd5" stroke-width="3"/>${g.points
    .map(p => {
      const [x, y] = xy(p);
      return `<circle cx="${x}" cy="${y}" r="4" fill="#456dd5"/><text x="${x}" y="${y - 12}" text-anchor="middle">(${p.join(', ')})</text>`;
    })
    .join(
      ''
    )}<text x="40" y="230">0</text><text x="195" y="257" text-anchor="middle">${esc(g.xLabel)}</text><text x="16" y="140" transform="rotate(-90 16 140)" text-anchor="middle">${esc(g.yLabel)}</text></svg><figcaption>Points: ${esc(g.points.map(p => `(${p.join(', ')})`).join(' · '))}</figcaption></figure>`;
}
function v2MathQuestion(run) {
  return (
    run.question ||
    (run.transfer ? v2MathTransfer?.items.find(q => q.id === run.qId) : McatV2Core.quant(run.skill, run.variant))
  );
}
function v2StartTransfer(skill) {
  if (StudyStorage.paused || !v2MathTransfer || !McatV2Core.mathTransferAllowed(v2State, skill)) return;
  if (v2State.math.active && !v2State.math.active.completedAt) return renderV2Math();
  const items = v2MathTransfer.items.filter(q => q.skill === skill);
  const unseen = items.find(q => !McatV2Core.mathPrior(v2State, q.id));
  const used = v2State.math.history.filter(run => run.transfer && run.skill === skill).length;
  const question = unseen || items[used % items.length];
  if (!question) return;
  v2State.math.active = {
    id: v2Id(),
    qId: question.id,
    skill,
    variant: question.variant,
    transfer: true,
    question: JSON.parse(JSON.stringify(question)),
    repeat: !unseen,
    startedAt: Date.now(),
    stage: 'setup',
    hint: false,
    draft: null,
  };
  if (v2Save()) renderV2Math();
}
function renderV2MathHome() {
  const active = v2State.math.active?.completedAt ? null : v2State.math.active;
  const main =
    el(`<main class="course-page"><header class="v2-hero"><span class="course-eyebrow">MATH & GRAPH GYM</span><h1>Build the setup.<br><em>Then solve it.</em></h1>
    <p>Each skill has eight foundation variants and two new-context applications. Complete two different foundation variants to open the applications; this is a practice sequence, not a mastery threshold.</p></header>
    ${active ? '<div class="course-notice"><strong>A calculation is saved.</strong><button class="btn btn-solid" id="math-resume">Resume →</button></div>' : ''}
    <div class="v2-catalog">${Object.entries(McatV2Core.SKILLS)
      .map(([id, name]) => {
        const history = v2State.math.history.filter(run => run.skill === id),
          allowed = McatV2Core.mathTransferAllowed(v2State, id);
        const foundation = new Set(history.filter(run => !run.transfer).map(run => run.qId)).size;
        const transfer = new Set(history.filter(run => run.transfer).map(run => run.qId)).size;
        return `<article class="v2-catalog-card"><span class="course-eyebrow">${foundation}/8 FOUNDATION VARIANTS · ${transfer}/2 APPLICATIONS TRIED</span><h2>${name}</h2>
        <p>${{ units: 'Cancel units across amount, area, volume and time.', notation: 'Keep coefficients, powers and unit conversions consistent.', logs: 'Move between logarithmic values and underlying ratios.', ratios: 'Combine changes in more than one model variable.', slopes: 'Distinguish slope, reciprocal slope and area under a graph.', estimation: 'Choose an approximation and check its scale.' }[id]}</p>
        <button class="btn" data-math-skill="${id}" ${active ? 'disabled' : ''}>Practice the foundation →</button>
        <button class="btn" data-math-transfer="${id}" ${active || !allowed || !v2MathTransfer ? 'disabled' : ''}>Apply in another context →</button>
        ${allowed ? '' : '<p>Opens after two different foundation variants are completed.</p>'}</article>`;
      })
      .join('')}</div>
    ${v2MathTransfer ? `<details class="course-map"><summary>Application scope and sources</summary><p>${esc(v2MathTransfer.reviewStatus)}</p><p>${esc(v2MathTransfer.exposurePolicy)}</p><ul>${v2MathTransfer.sources.map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)}</a></li>`).join('')}</ul></details>` : '<p>New-context applications did not download. Foundation work and saved sessions remain available.</p><button class="btn" id="math-transfer-retry">Retry applications</button>'}
    ${v2EvidenceMarkup(v2State.math.history.map(run => McatV2Core.mathEvidence(v2State, run)))}${v2MathHistory()}
    <p class="course-caption">Unseen means no earlier display found in this browser’s saved history. Foundation variants reuse a model; applications change the context or required operation. Neither is a calibrated assessment of transfer. Help and repeat exposure remain labeled.</p></main>`);
  main.querySelector('#math-resume')?.addEventListener('click', renderV2Math);
  main
    .querySelectorAll('[data-math-skill]')
    .forEach(button => (button.onclick = () => v2StartMath(button.dataset.mathSkill)));
  main
    .querySelectorAll('[data-math-transfer]')
    .forEach(button => (button.onclick = () => v2StartTransfer(button.dataset.mathTransfer)));
  main.querySelector('#math-transfer-retry')?.addEventListener('click', async () => {
    await loadMcatV2();
    renderV2MathHome();
  });
  v2Shell(main, 'math');
}

function v2StartMath(skill) {
  if (StudyStorage.paused) return;
  if (v2State.math.active?.completedAt) delete v2State.math.active;
  if (v2State.math.active) return renderV2Math();
  if (!McatV2Core.SKILLS[skill]) skill = 'units';
  const history = v2State.math.history.filter(h => h.skill === skill && !h.transfer),
    seen = new Set(
      Array.from({ length: 8 }, (_, i) => `math-${skill}-${i}`).filter(id => McatV2Core.mathPrior(v2State, id))
    );
  let variant = Array.from({ length: 8 }, (_, i) => i).find(i => !seen.has(`math-${skill}-${i}`));
  if (variant === undefined) variant = history.length % 8;
  const q = McatV2Core.quant(skill, variant);
  v2State.math.active = {
    id: v2Id(),
    qId: q.id,
    skill,
    variant,
    question: JSON.parse(JSON.stringify(q)),
    repeat: seen.has(q.id),
    startedAt: Date.now(),
    stage: 'setup',
    hint: false,
    draft: null,
  };
  if (v2Save()) renderV2Math();
}
function renderV2Math() {
  const r = v2State.math.active;
  if (!r) return renderV2MathHome();
  const q = v2MathQuestion(r);
  if (!q) return renderV2MathHome();
  const evidence = McatV2Core.mathEvidence(v2State, r);
  McatV2Core.noteMathExposure(v2State, q.id, r.id, 'math', Date.now());
  v2Save();
  const main = el(
    `<main class="course-page v2-narrow"><button class="backbtn" id="math-exit">← Save & leave</button><span class="course-eyebrow">${McatV2Core.SKILLS[r.skill]} / ${r.transfer ? 'NEW-CONTEXT APPLICATION · ' : ''}${evidence.repeat ? 'PREVIOUSLY SEEN SETUP' : 'UNSEEN IN SAVED HISTORY'}</span><h1 class="v2-run-title">${esc(q.stem)}</h1>${v2Graph(q.graph)}<div id="math-work"></div></main>`
  );
  main.querySelector('#math-exit').onclick = renderV2MathHome;
  const body = main.querySelector('#math-work');
  if (r.stage === 'setup') {
    body.innerHTML = `<h2>1. Choose the setup.</h2>${v2Options(q.setups, r.draft, 'math-setup')}${r.hint ? `<p class="v2-hint">${esc(q.hint)}</p>` : '<button class="ghostbtn" id="math-hint">Request a hint</button>'}<button class="btn btn-solid" id="math-setup-save" ${r.draft === null ? 'disabled' : ''}>Check setup →</button>`;
    body.querySelectorAll('[name="math-setup"]').forEach(
      i =>
        (i.onchange = () => {
          r.draft = Number(i.value);
          v2Save();
          body.querySelector('#math-setup-save').disabled = false;
        })
    );
    body.querySelector('#math-hint')?.addEventListener('click', () => {
      r.hint = true;
      v2Save();
      renderV2Math();
    });
    body.querySelector('#math-setup-save').onclick = () => {
      if (StudyStorage.paused || !Number.isInteger(r.draft) || r.setup !== undefined) return;
      r.setup = r.draft;
      r.setupCorrect = r.setup === q.answer;
      r.assisted = r.hint || r.externalAssistance || !r.setupCorrect;
      r.stage = 'calculate';
      v2Save();
      renderV2Math();
    };
  } else if (r.stage === 'calculate') {
    body.innerHTML = `<div class="course-feedback"><strong>${r.setupCorrect ? 'The setup works.' : 'Review the setup.'}</strong><p>${esc(q.errors[r.setup])}</p><p>Use: <b>${esc(q.setups[q.answer])}</b></p></div><h2>2. Calculate the result.</h2><p>${r.assisted ? 'This calculation follows assistance and will be labeled accordingly.' : 'Your first setup was correct without hints.'}</p><form id="math-calculate"><label for="math-value">Numerical answer ${q.unit ? `(${esc(q.unit)})` : ''}</label><input id="math-value" type="text" inputmode="decimal" autocomplete="off" value="${esc(r.valueDraft || '')}" required><p class="course-caption">Use a number or scientific notation such as 4e-3. Do not type units. Answers within 2% are accepted.</p><p id="math-validation" role="alert"></p><button class="btn btn-solid">Save first calculation →</button></form>`;
    body.querySelector('#math-value').oninput = e => {
      r.valueDraft = e.target.value;
      v2Save();
    };
    body.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const result = McatV2Core.numeric(body.querySelector('#math-value').value, q.value);
      if (!result) {
        body.querySelector('#math-validation').textContent = 'Enter a finite number, such as 0.04 or 4e-2.';
        return;
      }
      if (StudyStorage.paused || r.completedAt) return;
      r.value = result.value;
      r.calculationCorrect = result.correct;
      r.correct = r.setupCorrect && result.correct;
      r.completedAt = Date.now();
      r.stage = 'done';
      v2State.math.history.push({ ...r });
      v2CompleteActivity('math', r.skill);
      v2Save();
      renderV2Math();
    };
  } else {
    body.innerHTML = `<div class="course-feedback"><strong>${r.correct ? 'Setup and calculation correct' : 'An opportunity to refine the method'}</strong><p>First setup: ${r.setupCorrect ? 'correct' : 'missed'} · First calculation: ${r.calculationCorrect ? 'correct' : 'missed'} · ${McatV2Core.bucket(evidence)}</p><p>Your result: ${esc(String(r.value))} ${esc(q.unit)}</p><p>${esc(q.explanation)}</p>${q.unitIds?.length ? `<p>Revisit the method:</p>${q.unitIds.map(id => `<button class="btn" data-course-open="${esc(id)}">${esc(courseUnit(id)?.title || id)}</button>`).join('')}` : ''}</div><label for="math-note">Optional: what will you check next time?</label><textarea id="math-note" rows="3">${esc(r.note || '')}</textarea><div class="course-actions"><button class="btn btn-solid" id="math-next">Try the next variant →</button><button class="btn" id="math-done">Choose another skill</button><button class="btn" data-v2-view="weekly">My week</button></div>`;
    body.querySelector('#math-note').oninput = e => {
      r.note = e.target.value;
      const h = v2State.math.history.find(h => h.id === r.id);
      if (h) h.note = r.note;
      v2Save();
    };
    body.querySelector('#math-next').onclick = () => {
      delete v2State.math.active;
      v2Save();
      (r.transfer ? v2StartTransfer : v2StartMath)(r.skill);
    };
    body.querySelector('#math-done').onclick = () => {
      delete v2State.math.active;
      v2Save();
      renderV2MathHome();
    };
  }
  v2Shell(main, 'math', r.completedAt ? null : { type: 'math', key: r.skill });
}
function renderV2DiagnosticHome() {
  if (!v2Data || !courseData) return v2Unavailable('diagnose');
  const active = v2State.diagnostics.active;
  const main = el(
    `<main class="course-page v2-narrow"><span class="course-eyebrow">MISTAKE INVESTIGATION</span><h1>Find the sticking point.</h1><p>Science investigations compare content, data interpretation, and mathematical setup. CARS investigations compare the main claim, argument structure, and transfer to a new case. Three items offer clues; they cannot prove why the original answer was missed.</p>${active ? '<button class="btn btn-solid" id="diagnostic-resume">Resume saved investigation →</button>' : `<label for="diagnostic-unit">Which lesson is related to the miss?</label><select id="diagnostic-unit">${courseData.units.map(u => `<option value="${u.id}">${esc(u.title)}</option>`).join('')}</select><button class="btn btn-solid" id="diagnostic-start">Start three short checks →</button>`}<section class="course-progress-section"><h2>Saved investigations</h2>${
      v2State.diagnostics.history.length
        ? v2State.diagnostics.history
            .slice()
            .reverse()
            .map(
              d =>
                `<article class="course-notice"><strong>${esc(courseUnit(d.unitId)?.title || 'Practice')}</strong><p>Your chosen focus: ${V2_CAUSES[d.cause] || 'Uncertain'}</p><button class="ghostbtn" data-diagnostic-history="${d.id}">Review observations</button></article>`
            )
            .join('')
        : '<p>Your first investigation will appear here.</p>'
    }</section></main>`
  );
  main.querySelector('#diagnostic-resume')?.addEventListener('click', renderV2Diagnostic);
  main
    .querySelector('#diagnostic-start')
    ?.addEventListener('click', () => v2StartDiagnostic(main.querySelector('#diagnostic-unit').value));
  main
    .querySelectorAll('[data-diagnostic-history]')
    .forEach(
      b =>
        (b.onclick = () =>
          renderV2DiagnosticResult(v2State.diagnostics.history.find(d => d.id === b.dataset.diagnosticHistory)))
    );
  v2Shell(main, 'diagnose');
}
function v2StartDiagnostic(unitId) {
  if (v2State.diagnostics.active) return renderV2Diagnostic();
  const u = courseUnit(unitId);
  if (!u || !v2Data) return renderV2DiagnosticHome();
  const concept = u.questions.find(q => q.kind === 'diagnostic'),
    data = v2Data.probes[u.section === 'cars' ? 'cars' : u.section === 'psychSoc' ? 'psychSoc' : 'science'];
  const skill = u.id.includes('buffer')
    ? 'logs'
    : u.id.includes('fluid')
      ? 'ratios'
      : u.id.includes('circuit')
        ? 'units'
        : u.section === 'cars'
          ? 'slopes'
          : 'units';
  const math = McatV2Core.quant(skill, 0);
  v2State.diagnostics.active = {
    id: v2Id(),
    unitId,
    startedAt: Date.now(),
    answers: [],
    probes: [
      { ...concept, domain: u.section === 'cars' ? 'reading' : 'content' },
      { ...data },
      u.section === 'cars'
        ? { ...v2Data.probes.carsTransfer }
        : {
            id: 'probe-' + math.id,
            domain: 'math',
            stem: math.stem + ' Choose the correct setup.',
            options: math.setups,
            answer: math.answer,
            explanation: math.errors[math.answer],
          },
    ],
    draft: null,
  };
  v2Save();
  renderV2Diagnostic();
}
function renderV2Diagnostic() {
  const r = v2State.diagnostics.active;
  if (!r) return renderV2DiagnosticHome();
  const q = r.probes[r.answers.length];
  if (!q) return renderV2DiagnosticResult(r);
  if (q.id.startsWith('probe-math-')) {
    McatV2Core.noteMathExposure(v2State, q.id.slice(6), r.id, 'investigation', Date.now());
    v2Save();
  }
  const main = el(
    `<main class="course-page v2-narrow"><button class="backbtn" id="diagnostic-exit">← Save & leave</button><span class="course-eyebrow">CHECK ${r.answers.length + 1}/3 / ${V2_CAUSES[q.domain]}</span><h1 class="v2-run-title">${esc(q.stem)}</h1>${v2Graph(q.graph)}${q.table ? `<div class="v2-table-scroll"><table><thead><tr>${q.table.headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${q.table.rows.map(row => `<tr>${row.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}${v2Options(q.options, r.draft, 'diagnostic-answer')}<p class="course-caption">These are short screening checks; some items may have been seen before. They do not add to independent learning accuracy.</p><button class="btn btn-solid" id="diagnostic-save" ${r.draft === null ? 'disabled' : ''}>Save answer →</button></main>`
  );
  main.dataset.study = 'true';
  main.querySelector('#diagnostic-exit').onclick = renderV2DiagnosticHome;
  main.querySelectorAll('[name="diagnostic-answer"]').forEach(
    i =>
      (i.onchange = () => {
        r.draft = Number(i.value);
        v2Save();
        main.querySelector('#diagnostic-save').disabled = false;
      })
  );
  main.querySelector('#diagnostic-save').onclick = () => {
    if (!Number.isInteger(r.draft)) return;
    r.answers.push({ qId: q.id, domain: q.domain, chosen: r.draft, correct: r.draft === q.answer, ts: Date.now() });
    r.draft = null;
    v2Save();
    renderV2Diagnostic();
  };
  v2Shell(main, 'diagnose');
}
function renderV2DiagnosticResult(r) {
  if (!r) return renderV2DiagnosticHome();
  const result = McatV2Core.diagnose(r.answers),
    cause = r.cause || result.cause;
  const main = el(
    `<main class="course-page v2-narrow"><span class="course-eyebrow">OBSERVATIONS / NOT A DIAGNOSIS</span><h1>A more specific next step.</h1><p>${esc(result.text)}</p>${r.probes.map((q, i) => `<details class="course-map"><summary>${V2_CAUSES[q.domain]} · ${r.answers[i]?.correct ? 'Correct' : 'Missed'}</summary><div class="course-saved-answer"><p>${esc(q.stem)}</p><p>You: ${esc(q.options[r.answers[i]?.chosen] || 'Unanswered')}</p><p>Answer: ${esc(q.options[q.answer])}</p><p>${esc(q.explanation)}</p></div></details>`).join('')}<label for="diagnostic-cause">Which focus fits your experience?</label><select id="diagnostic-cause">${Object.entries(
      V2_CAUSES
    )
      .map(([k, n]) => `<option value="${k}" ${cause === k ? 'selected' : ''}>${n}</option>`)
      .join(
        ''
      )}</select><label for="diagnostic-note">Optional context: what happened in the original question?</label><textarea id="diagnostic-note" rows="3">${esc(r.note || '')}</textarea><button class="btn btn-solid" id="diagnostic-confirm">${r.confirmedAt ? 'Update chosen focus' : 'Save my chosen focus'} →</button><p class="course-caption">Your choice can override the suggestion. Only the focus you save affects your weekly recommendations.</p><div id="diagnostic-action"></div></main>`
  );
  const actions = () => {
    const action =
      r.cause === 'math'
        ? '<button class="btn" data-v2-view="math">Practice the setup →</button>'
        : ['graph', 'reading', 'argument', 'transfer'].includes(r.cause)
          ? '<button class="btn" data-v2-view="coach">Open Passage Coach →</button>'
          : `<button class="btn" data-course-open="${r.unitId}" data-course-revisit="true">Revisit the lesson →</button>`;
    main.querySelector('#diagnostic-action').innerHTML =
      `<div class="course-notice"><strong>Chosen focus saved.</strong><p>${r.cause === 'uncertain' ? 'Revisit the explanation or compare another passage before deciding on a cause.' : 'Your next weekly plan will reflect this choice.'}</p>${action}<button class="ghostbtn" data-v2-view="weekly">Open my week</button></div>`;
  };
  main.querySelector('#diagnostic-confirm').onclick = () => {
    r.cause = main.querySelector('#diagnostic-cause').value;
    r.note = main.querySelector('#diagnostic-note').value;
    r.confirmedAt = Date.now();
    const i = v2State.diagnostics.history.findIndex(d => d.id === r.id);
    if (i >= 0) v2State.diagnostics.history[i] = r;
    else v2State.diagnostics.history.push(r);
    if (v2State.diagnostics.active?.id === r.id) delete v2State.diagnostics.active;
    v2Save();
    actions();
  };
  if (r.confirmedAt) actions();
  v2Shell(main, 'diagnose');
}
function v2WeekInput() {
  courseData.units.forEach(u => McatCourseCore.refreshSchedule(courseState, u));
  return {
    start: guideDateKey(),
    now: Date.now(),
    units: courseData.units,
    records: courseState.units,
    activeUnit: courseState.activeUnit,
    preferredUnit: courseState.preferredUnit,
    mode: courseState.mode,
    coaches: (v2Data?.coaches || []).filter(v2CoachAllowed),
    completedActivities: studyCompletedActivities(guidePlan()),
  };
}
function v2WeekDays() {
  return courseData ? McatV2Core.week(v2State, v2WeekInput()) : [];
}
function v2PlanTasks(day) {
  const saved = v2State.weekly.planDays[day.date],
    input = v2WeekInput();
  return (
    saved && !saved.released ? saved.tasks : day.tasks.filter(task => !task.done && task.type !== 'externalExam')
  ).filter(task => !McatV2Core.taskCompleted(v2State, input, task, task.selectedAt || Date.now()));
}
function v2PlanEditor(day) {
  const tasks = v2PlanTasks(day),
    previous = v2State.weekly.planDays[day.date]?.previous;
  return `${day.held.length ? `<div class="course-notice"><h3>Saved choices waiting</h3>${day.held.map(task => `<p><b>${esc(task.title)}</b> · ${task.minutes} min<br>${esc(task.hold)}</p>`).join('')}<p>These choices are retained. Adjust the time or your choices below.</p></div>` : ''}
    <details class="course-map"><summary>${day.kept ? 'Your saved choices' : 'Adjust or keep these choices'}</summary><div>
      <p>${day.kept ? 'This day keeps the choices you saved. New recommendations will not replace them.' : 'Suggestions can change with new work. Keep this day when the choices suit you.'}</p>
      ${tasks.map(task => `<div class="course-actions"><span>${esc(task.title)} · ${task.minutes} min</span><button class="ghostbtn" data-plan-remove="${esc(task.id)}" data-plan-date="${day.date}">Leave for later</button></div>`).join('')}
      ${!day.kept ? `<button class="btn" data-plan-keep="${day.date}">Keep these choices</button>` : `<button class="btn" data-plan-release="${day.date}">Use fresh suggestions</button>`}
      ${previous ? `<button class="ghostbtn" data-plan-undo="${day.date}">Undo last choice change</button>` : ''}
      ${
        day.alternatives.length && tasks.length < 3
          ? `<label for="plan-add-${day.date}">Choose another activity that fits</label><select id="plan-add-${day.date}" data-plan-select="${day.date}"><option value="">Choose an activity</option>${day.alternatives.map(task => `<option value="${esc(task.id)}">${esc(task.title)} · ${task.minutes} min${task.prerequisites?.length ? ' · prerequisites pending' : ''}</option>`).join('')}</select>
        <p id="plan-reason-${day.date}"></p><label><input type="checkbox" id="plan-background-${day.date}"> Use my prior background if recorded prerequisites are incomplete. This does not mark them complete.</label>
        <button class="btn" data-plan-add="${day.date}" disabled>Add to this day</button>`
          : '<p>No additional activity fits the current time and three-choice limit. You can leave a choice for later or change availability.</p>'
      }
      <p id="plan-error-${day.date}" role="alert"></p></div></details>`;
}
function v2SaveDay(day, tasks, released = false) {
  if (StudyStorage.paused) return false;
  if (!McatV2Core.keepDay(v2State, day, tasks, Date.now(), released)) return false;
  v2State.weekly.configured = true;
  return v2Save();
}
function v2WirePlanEditors(main, days, redraw) {
  const fresh = date => v2WeekDays().find(day => day.date === date);
  const save = (date, tasks, released = false) => {
    if (v2SaveDay(date, tasks, released)) redraw();
    else if (!StudyStorage.paused) {
      const error = main.querySelector('#plan-error-' + date);
      if (error)
        error.textContent =
          'This choice could not be applied. Reopen the day and check its available time or an existing reservation.';
    }
  };
  main.querySelectorAll('[data-plan-keep]').forEach(
    button =>
      (button.onclick = () => {
        const day = fresh(button.dataset.planKeep);
        if (day) save(day.date, v2PlanTasks(day));
      })
  );
  main
    .querySelectorAll('[data-plan-release]')
    .forEach(button => (button.onclick = () => save(button.dataset.planRelease, [], true)));
  main.querySelectorAll('[data-plan-remove]').forEach(
    button =>
      (button.onclick = () => {
        const day = fresh(button.dataset.planDate);
        if (day)
          save(
            day.date,
            v2PlanTasks(day).filter(task => task.id !== button.dataset.planRemove)
          );
      })
  );
  main.querySelectorAll('[data-plan-undo]').forEach(
    button =>
      (button.onclick = () => {
        const previous = v2State.weekly.planDays[button.dataset.planUndo]?.previous;
        if (previous) save(button.dataset.planUndo, previous.tasks, !!previous.released);
      })
  );
  main.querySelectorAll('[data-plan-select]').forEach(select => {
    const date = select.dataset.planSelect,
      background = main.querySelector('#plan-background-' + date),
      add = main.querySelector(`[data-plan-add="${date}"]`);
    const update = () => {
      const task = days.find(day => day.date === date)?.alternatives.find(task => task.id === select.value);
      main.querySelector('#plan-reason-' + date).textContent = task
        ? [
            task.reason,
            task.evidence,
            task.prerequisites.length
              ? 'Prerequisites without recorded completion: ' +
                task.prerequisites.map(id => courseUnit(id)?.title || id).join(', ') +
                '.'
              : '',
          ]
            .filter(Boolean)
            .join(' ')
        : '';
      add.disabled = !task || (!!task.prerequisites.length && !background.checked);
    };
    select.onchange = update;
    background.onchange = update;
    add.onclick = () => {
      if (StudyStorage.paused) return;
      const day = fresh(date),
        task = day?.alternatives.find(task => task.id === select.value);
      if (!task || (task.prerequisites.length && !background.checked)) return;
      save(date, [
        ...v2PlanTasks(day),
        {
          ...task,
          manualPrerequisites: !!task.prerequisites.length && background.checked,
          reason: 'You chose this activity. ' + task.reason,
        },
      ]);
    };
  });
}
function v2PastChoices() {
  const today = guideDateKey(),
    input = v2WeekInput(),
    plans = v2State.weekly.planDays;
  const scheduled = new Set(
    Object.entries(plans)
      .filter(([date, plan]) => date >= today && !plan.released)
      .flatMap(([, plan]) => plan.tasks.map(task => task.id))
  );
  return Object.entries(plans)
    .filter(([date, plan]) => date < today && !plan.released)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, plan]) => ({
      date,
      tasks: plan.tasks.filter(
        task =>
          !scheduled.has(task.id) && !McatV2Core.taskCompleted(v2State, input, task, task.selectedAt || plan.savedAt)
      ),
    }))
    .filter(day => day.tasks.length);
}
function v2PastChoicesMarkup() {
  const days = v2PastChoices();
  return days.length
    ? `<details class="course-map"><summary>Unfinished choices from earlier days · ${days.length}</summary><div><p>These choices remain saved. They do not stack onto today automatically. Carry one over when it fits, or continue with today's plan.</p>${days.map(day => `<section><h3>${esc(day.date)}</h3>${day.tasks.map(task => `<p>${esc(task.title)} · ${task.minutes} min <button class="ghostbtn" data-plan-carry="${esc(task.id)}" data-plan-from="${day.date}">Use today</button></p>`).join('')}</section>`).join('')}<p id="plan-carry-error" role="alert"></p></div></details>`
    : '';
}
function v2WirePastChoices(main, redraw) {
  main.querySelectorAll('[data-plan-carry]').forEach(
    button =>
      (button.onclick = () => {
        if (StudyStorage.paused) return;
        const day = v2WeekDays()[0],
          task = v2PastChoices()
            .find(old => old.date === button.dataset.planFrom)
            ?.tasks.find(task => task.id === button.dataset.planCarry);
        if (!task) return;
        const tasks = v2PlanTasks(day),
          duplicate = tasks.some(current => current.id === task.id);
        if (duplicate) {
          main.querySelector('#plan-carry-error').textContent =
            'This activity is already in today’s plan. Open it from today’s choices.';
          return;
        }
        if (day.pastTarget || !day.budget || task.minutes > day.unallocated || tasks.length >= 3) {
          main.querySelector('#plan-carry-error').textContent =
            'This choice does not fit today yet. Leave another choice for later or adjust today’s availability first.';
          return;
        }
        if (
          v2SaveDay(day.date, [
            ...tasks,
            { ...task, selectedAt: Date.now(), reason: `Carried from ${button.dataset.planFrom}. ${task.reason}` },
          ])
        )
          redraw();
      })
  );
}
function v2PrerequisiteChoice(task, missing) {
  const main =
    el(`<main class="course-page v2-narrow"><h1>Check the foundation first.</h1><p>${esc(task.title)} builds on ${missing.map(id => esc(courseUnit(id)?.title || id)).join(', ')}. Those lessons have no recorded completion. A future plan assumes you will finish them first.</p>
    <div class="course-actions">${missing.map(id => `<button class="btn" data-prerequisite-open="${esc(id)}">Open ${esc(courseUnit(id)?.title || id)}</button>`).join('')}
    <button class="btn" id="plan-use-background">Use my prior background and open the chosen activity</button><button class="ghostbtn" data-v2-view="weekly">Back to my week</button></div><p>This choice does not mark prerequisites complete or establish mastery.</p></main>`);
  main.querySelectorAll('[data-prerequisite-open]').forEach(
    button =>
      (button.onclick = () => {
        if (!StudyStorage.paused) renderCourseUnit(button.dataset.prerequisiteOpen);
      })
  );
  main.querySelector('#plan-use-background').onclick = () => v2LaunchWeekTask({ ...task, manualPrerequisites: true });
  v2Shell(main, 'weekly');
}

function renderV2Week() {
  if (!v2Data || !courseData) return v2Unavailable('weekly');
  const w = v2State.weekly,
    days = v2WeekDays(),
    today = guideDateKey();
  const main = el(
    `<main class="course-page"><header class="v2-hero"><span class="course-eyebrow">YOUR WEEK / MCAT 2.0</span><h1>Give each day a purpose.</h1><p>A manageable plan for the next seven days, based on your available time, saved activities, fresh checks, and chosen focus. Unfinished work returns without stacking missed days.</p></header><details class="course-map v2-week-settings" ${w.configured ? '' : 'open'}><summary>Availability & target <span>${w.configured ? 'Edit my week' : 'Start here'}</span></summary><form id="week-settings"><label for="week-target">Target test date (optional)</label><input id="week-target" type="date" value="${esc(w.configured ? w.targetDate || '' : guidePlan()?.targetDate || '')}"><div class="v2-availability">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => `<label for="week-day-${i}">${d}<input id="week-day-${i}" data-week-day="${i}" type="number" min="0" max="480" step="5" value="${w.availability[i]}" required><small>minutes</small></label>`).join('')}</div><p>Use 0 for a rest day. A scheduled exam can exceed the ordinary budget; the plan will show that explicitly.</p><button class="btn btn-solid">Save availability →</button><span id="week-saved" role="status"></span></form></details><div class="v2-week-overview"><strong>${days.reduce((n, d) => n + d.budget, 0)} min available</strong><span>${days.reduce((n, d) => n + d.tasks.length, 0)} activities</span><button class="ghostbtn" id="week-exam-add">Plan a practice exam ↓</button></div>${w.configured ? '' : '<p class="course-notice">This is a preview using default availability. Save your preferred times above to personalize it.</p>'}<div class="v2-week-grid">${days.map(day => `<section class="v2-day ${day.date === today ? 'v2-day-today' : ''}"><header><div><span>${day.date === today ? 'TODAY' : McatV2Core.dateFrom(day.date).toLocaleDateString(undefined, { weekday: 'short' })}</span><h2>${McatV2Core.dateFrom(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</h2></div><strong>${day.budget} min</strong></header>${day.tasks.length ? day.tasks.map(t => `<article class="v2-week-task ${t.done ? 'v2-task-done' : ''}"><span class="course-eyebrow">${t.done ? 'COMPLETE' : t.type === 'externalExam' ? 'PLANNED EXAM' : t.type === 'externalReview' ? 'RESERVED REVIEW' : t.type === 'course' ? 'COURSE' : t.type === 'coach' ? 'PASSAGE COACH' : 'QUANTITATIVE'} · ${t.minutes} MIN</span><h3>${esc(t.title)}</h3><p>${esc(t.reason || 'Saved activity')}</p>${t.prerequisiteNote ? `<p>${esc(t.prerequisiteNote)}</p>` : ''}${t.evidence ? `<details><summary>Why this task?</summary><p>${esc(t.evidence)}</p></details>` : ''}${!t.done && day.date === today ? `<button class="btn" data-week-task="${esc(t.id)}" data-week-date="${day.date}">Open activity →</button>` : ''}</article>`).join('') : `<p class="v2-day-rest">${day.pastTarget ? 'Beyond your target date. Adjust the target to plan more study.' : day.budget === 0 ? 'Rest day. No study assigned.' : day.kept ? (day.held.length ? 'Your saved choices are waiting below.' : 'You kept this day open.') : 'No fitting activity is due. Use this time for a break or choose practice.'}</p>`}${day.tasks.reduce((n, t) => n + t.minutes, 0) > day.budget ? '<p class="v2-budget-note">Completed or scheduled work exceeds this day’s availability. Adjust the day if needed.</p>' : ''}${day.unallocated >= 5 ? `<small>${day.unallocated} min left open</small>` : ''}${v2PlanEditor(day)}</section>`).join('')}</div>${v2PastChoicesMarkup()}<p class="course-caption">Lesson, coach, and math estimates use the median of your last ten eligible activity durations, rounded to five minutes. Only visible study time with recent interaction is counted; hidden tabs and long idle periods are excluded. New activities use 15, 20, and 5 minutes. Estimates are not deadlines.</p><section class="course-progress-section" id="week-exams"><h2>Practice exams & official results</h2><p>Schedule time and reserve a later review. You can enter official practice results yourself; Cortex does not convert its own raw scores into an MCAT score.</p><div id="week-exam-form"></div><div id="week-exam-list"></div></section></main>`
  );
  main.querySelector('#week-settings').onsubmit = e => {
    e.preventDefault();
    if (StudyStorage.paused) return;
    const availability = [...main.querySelectorAll('[data-week-day]')].map(i => Number(i.value));
    if (availability.some(value => !Number.isFinite(value) || value < 0 || value > 480 || value % 5)) return;
    w.availability = availability;
    w.targetDate = main.querySelector('#week-target').value;
    w.configured = true;
    if (v2Save()) renderV2Week();
  };
  main.querySelector('#week-exam-add').onclick = () => {
    main.querySelector('#week-exam-form details').open = true;
    main.querySelector('#week-exams').scrollIntoView({ behavior: 'smooth' });
    main.querySelector('#planned-exam-name')?.focus({ preventScroll: true });
  };
  main.querySelectorAll('[data-week-task]').forEach(
    b =>
      (b.onclick = () => {
        const task = days.find(d => d.date === b.dataset.weekDate)?.tasks.find(t => t.id === b.dataset.weekTask);
        if (task) v2LaunchWeekTask({ ...task, day: b.dataset.weekDate });
      })
  );
  v2ExamForm(main.querySelector('#week-exam-form'));
  v2ExamList(main.querySelector('#week-exam-list'));
  v2WirePlanEditors(main, days, renderV2Week);
  v2WirePastChoices(main, renderV2Week);
  v2Shell(main, 'weekly');
}
function v2LaunchWeekTask(task) {
  if (StudyStorage.paused || (task.day && task.day !== guideDateKey()) || (task.dueAt && task.dueAt > Date.now()))
    return;
  const missing = McatV2Core.taskPrerequisites(v2WeekInput(), task);
  if (missing.length) return v2PrerequisiteChoice(task, missing);
  if (task.type === 'externalExam' || task.type === 'externalReview') return renderV2ExamReview(task.key);
  // Resume saved work without replacing a different in-progress activity or its plan link.
  if (task.type === 'coach' && v2State.coach.active && v2State.coach.active.coachId !== task.key)
    return renderV2CoachHome();
  if (
    task.type === 'math' &&
    v2State.math.active &&
    !v2State.math.active.completedAt &&
    v2State.math.active.skill !== task.key
  )
    return renderV2Math();
  const parked = task.type === 'coach' && v2State.coach.parked.find(r => r.coachId === task.key);
  if (parked) parked.weekTask = task;
  v2State.weekly.active = task;
  if (!v2Save()) return;
  if (task.type === 'course')
    renderCourseUnit(task.key, task.kind === 'review' ? 'learn' : task.kind === 'delayed' ? undefined : undefined);
  else if (task.type === 'coach') v2State.coach.active ? renderV2Coach() : renderV2CoachSetup(task.key);
  else if (task.type === 'math') {
    if (v2State.math.active?.completedAt) delete v2State.math.active;
    v2StartMath(task.key);
  }
}
function v2ExamForm(host, exam) {
  const editing = !!exam,
    e = exam || {},
    scores = e.scores || {};
  host.innerHTML = `<details class="course-map" ${editing ? 'open' : ''}><summary>${editing ? 'Edit practice exam' : 'Add a practice exam or result'}</summary><form id="planned-exam-form"><label for="planned-exam-name">Exam name</label><input id="planned-exam-name" maxlength="100" required value="${esc(e.name || '')}"><div class="v2-form-row"><label for="planned-exam-date">Date<input id="planned-exam-date" type="date" required value="${esc(e.date || guideDateKey())}"></label><label for="planned-exam-minutes">Time reserved (minutes)<input id="planned-exam-minutes" type="number" min="5" max="600" step="5" required value="${e.minutes || 120}"></label></div><label for="planned-exam-source">Result source</label><select id="planned-exam-source">${[
    ['official', 'Official AAMC practice · entered by me'],
    ['thirdParty', 'Other provider · entered by me'],
    ['unscored', 'Unscored practice'],
  ]
    .map(([v, n]) => `<option value="${v}" ${(e.source || 'unscored') === v ? 'selected' : ''}>${n}</option>`)
    .join(
      ''
    )}</select><fieldset class="v2-scores"><legend>Optional scaled section results (118–132 each)</legend>${Object.entries(
    SEC_ABBR
  )
    .map(
      ([k, n]) =>
        `<label for="planned-score-${k}">${n}<input id="planned-score-${k}" data-planned-score="${k}" type="number" min="118" max="132" step="1" value="${scores[k] ?? ''}"></label>`
    )
    .join(
      ''
    )}</fieldset><p class="course-caption">Leave scores blank for future or unscored exams. A total appears only when all four section scores are entered. Results are self-reported.</p><p id="planned-exam-error" role="alert"></p><div class="course-actions"><button class="btn btn-solid">${editing ? 'Save changes' : 'Add to my week'}</button>${editing ? '<button type="button" class="btn" id="planned-exam-cancel">Cancel edit</button>' : ''}</div></form></details>`;
  host.querySelector('#planned-exam-cancel')?.addEventListener('click', () => v2ExamForm(host));
  host.querySelector('form').onsubmit = event => {
    event.preventDefault();
    const source = host.querySelector('#planned-exam-source').value,
      date = host.querySelector('#planned-exam-date').value,
      name = host.querySelector('#planned-exam-name').value.trim(),
      values = {};
    host.querySelectorAll('[data-planned-score]').forEach(i => {
      if (i.value !== '') values[i.dataset.plannedScore] = Number(i.value);
    });
    if (!name) return;
    if (Object.keys(values).length && (source === 'unscored' || date > guideDateKey())) {
      host.querySelector('#planned-exam-error').textContent =
        'Choose a scored provider and a date on or before today to enter a result.';
      return;
    }
    const saved = {
      ...e,
      id: e.id || v2Id(),
      name,
      date,
      minutes: Number(host.querySelector('#planned-exam-minutes').value),
      source,
      scores: values,
    };
    if (Object.keys(values).length) saved.completedAt ||= Date.now();
    if (date > guideDateKey()) {
      delete saved.completedAt;
      delete saved.reviewedAt;
    }
    const i = v2State.weekly.exams.findIndex(x => x.id === saved.id);
    if (i >= 0) v2State.weekly.exams[i] = saved;
    else v2State.weekly.exams.push(saved);
    v2Save();
    renderV2Week();
  };
}
function v2ExamList(host) {
  const w = v2State.weekly;
  host.innerHTML = `${w.lastRemoved ? '<div class="course-notice">Practice exam removed from the plan. <button class="ghostbtn" id="exam-undo">Undo</button></div>' : ''}${
    w.exams.length
      ? w.exams
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date))
          .map(e => {
            const values = Object.values(e.scores || {}),
              total = values.length === 4 ? values.reduce((n, v) => n + v, 0) : null;
            return `<article class="v2-exam"><div><span class="course-eyebrow">${e.source === 'official' ? 'OFFICIAL AAMC PRACTICE' : e.source === 'thirdParty' ? 'OTHER PROVIDER' : 'UNSCORED'} / SELF-REPORTED</span><h3>${esc(e.name)}</h3><p>${esc(e.date)} · ${e.minutes} min reserved · ${e.reviewedAt ? 'Review complete' : e.completedAt ? 'Taken · review pending' : 'Planned'}</p></div><div class="v2-score-total">${total ?? '—'}<small>${total ? 'entered total' : 'no complete score'}</small></div><div class="v2-exam-sections">${Object.entries(
              SEC_ABBR
            )
              .map(([k, n]) => `<span>${n} <b>${e.scores?.[k] ?? '—'}</b></span>`)
              .join(
                ''
              )}</div><div class="course-actions"><button class="btn" data-exam-review="${e.id}">Open exam & review</button><button class="ghostbtn" data-exam-edit="${e.id}">Edit</button><button class="ghostbtn" data-exam-remove="${e.id}">Remove from plan</button></div></article>`;
          })
          .join('')
      : '<p>No practice exams added yet.</p>'
  }`;
  host.querySelector('#exam-undo')?.addEventListener('click', () => {
    if (!w.exams.some(e => e.id === w.lastRemoved.id)) w.exams.push(w.lastRemoved);
    delete w.lastRemoved;
    v2Save();
    renderV2Week();
  });
  host
    .querySelectorAll('[data-exam-review]')
    .forEach(b => (b.onclick = () => renderV2ExamReview(b.dataset.examReview)));
  host.querySelectorAll('[data-exam-edit]').forEach(
    b =>
      (b.onclick = () => {
        const form = document.querySelector('#week-exam-form');
        v2ExamForm(
          form,
          w.exams.find(e => e.id === b.dataset.examEdit)
        );
        form.scrollIntoView({ behavior: 'smooth' });
      })
  );
  host.querySelectorAll('[data-exam-remove]').forEach(
    b =>
      (b.onclick = () => {
        w.lastRemoved = w.exams.find(e => e.id === b.dataset.examRemove);
        w.exams = w.exams.filter(e => e.id !== b.dataset.examRemove);
        v2Save();
        renderV2Week();
      })
  );
}
function renderV2ExamReview(id) {
  const e = v2State.weekly.exams.find(e => e.id === id);
  if (!e) return renderV2Week();
  const future = e.date > guideDateKey();
  const main = el(
    `<main class="course-page v2-narrow"><button class="backbtn" data-v2-view="weekly">← My week</button><span class="course-eyebrow">PRACTICE EXAM / YOUR REVIEW</span><h1>${esc(e.name)}</h1><p>${esc(e.date)} · ${e.minutes} minutes reserved. Take the exam with its provider, then save your own result and review here.</p><a href="https://students-residents.aamc.org/prepare-mcat-exam/free-planning-and-study-resources" target="_blank" rel="noopener">AAMC planning and practice resources ↗</a>${future ? '<p class="course-notice">This exam is scheduled for a future date.</p>' : `<button class="btn" id="external-exam-taken">${e.completedAt ? 'Marked as taken' : 'Mark exam taken'}</button>`}<div id="external-exam-edit"></div><label for="external-exam-note">After reviewing, which error patterns and timing decisions will you work on?</label><textarea id="external-exam-note" rows="5">${esc(e.note || '')}</textarea><button class="btn btn-solid" id="external-review-done" ${future || !e.note?.trim() ? 'disabled' : ''}>${e.reviewedAt ? 'Review saved' : 'Save completed review'}</button><p id="external-review-status" role="status"></p></main>`
  );
  main.querySelector('#external-exam-taken')?.addEventListener('click', () => {
    e.completedAt ||= Date.now();
    v2Save();
    renderV2ExamReview(id);
  });
  v2ExamForm(main.querySelector('#external-exam-edit'), e);
  main.querySelector('#external-exam-note').oninput = event => {
    e.note = event.target.value;
    v2Save();
    main.querySelector('#external-review-done').disabled = future || !e.note.trim();
  };
  main.querySelector('#external-review-done').onclick = () => {
    if (future || !e.note?.trim()) return;
    e.completedAt ||= Date.now();
    e.reviewedAt ||= Date.now();
    v2Save();
    main.querySelector('#external-review-status').textContent = 'Review saved. The reserved review is complete.';
    main.querySelector('#external-review-done').textContent = 'Review saved';
  };
  v2Shell(main, 'weekly');
}
function v2Progress(main) {
  const h = v2State.coach.history.flatMap(h => h.answers),
    math = v2State.math.history.map(r => McatV2Core.mathEvidence(v2State, r));
  const section = el(
    `<section class="course-progress-section v2-progress"><div class="v2-section-title"><div><span class="course-eyebrow">MCAT 2.0 / PRACTICE CONDITIONS</span><h2>See how you reached the answer.</h2></div><button class="btn" data-v2-view="diagnose">Investigate a mistake →</button></div><h3>Passage Coach</h3><p>Results below cover completed workshops. Saved sessions above retain answers still in progress.</p>${v2EvidenceMarkup(h, 'No completed answers')}<h3>Math & graph gym</h3>${v2EvidenceMarkup(math)}<p>Math accuracy requires both the first setup and first calculation to be correct. ${math.filter(h => h.setupCorrect).length}/${math.length} first setups and ${math.filter(h => h.calculationCorrect).length}/${math.length} first calculations were correct.</p><p class="course-caption">Assisted practice includes Guided or Light coaching, requested hints, and corrected math setups. Prior exposure to a setup in math or an investigation counts as repeated, even when the calculation is new. These records do not estimate an MCAT score.</p><div class="course-actions"><button class="btn" data-v2-view="weekly">Weekly plan & entered official results</button><button class="btn" data-v2-view="review">My study reflections</button></div></section>`
  );
  main.querySelector('.course-metrics')?.after(section);
}
// Pilot feedback uses a non-cs key so account sync does not upload it.
let v2Pilot = loadJSON('cortex-mcat-pilot-v2', { reviews: {}, sessions: [] });
if (!v2Pilot || typeof v2Pilot !== 'object' || Array.isArray(v2Pilot)) v2Pilot = {};
v2Pilot.reviews ||= {};
if (!Array.isArray(v2Pilot.sessions)) v2Pilot.sessions = [];
function v2SavePilot() {
  try {
    localStorage.setItem('cortex-mcat-pilot-v2', JSON.stringify(v2Pilot));
    return true;
  } catch {
    const p = document.querySelector('#pilot-save-status');
    if (p) p.textContent = 'Could not save your reflection. Copy it before leaving.';
    return false;
  }
}
function v2Download(name, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function v2PilotSnapshot(since = 0) {
  return {
    capturedAt: Date.now(),
    lessons: courseData.units.filter(u => courseRecord(u.id).completedAt >= since).map(u => u.id),
    laterAnswers: courseData.units.flatMap(u =>
      courseRecord(u.id)
        .attempts.filter(a => a.kind === 'delayed' && a.ts >= since)
        .map(a => ({ unitId: u.id, correct: a.correct, ts: a.ts }))
    ),
    coach: v2State.coach.history
      .filter(h => h.completedAt >= since)
      .map(h => ({
        coachId: h.coachId,
        mode: h.mode,
        completedAt: h.completedAt,
        evidence: McatV2Core.evidence(h.answers),
      })),
    math: v2State.math.history
      .map(r => McatV2Core.mathEvidence(v2State, r))
      .filter(h => h.completedAt >= since)
      .map(h => ({ skill: h.skill, qId: h.qId, correct: h.correct, bucket: McatV2Core.bucket(h) })),
  };
}
// Retain the original storage key and record shape so existing private notes stay available.
function renderV2Review() {
  if (!courseData || !v2Data) return v2Unavailable('review');
  const active = v2Pilot.active,
    observed = active ? v2PilotSnapshot(active.startedAt) : null;
  const main = el(`<main class="course-page">
    <header class="v2-hero"><span class="course-eyebrow">YOUR LEARNING / REFLECTIONS</span><h1>Make each session count.</h1><p>Capture what clicked, what felt difficult, and what you want to try next. Return to your notes as your understanding grows.</p></header>
    <section class="course-progress-section"><h2>Your study reflection</h2><p>Reflect after a lesson or practice session. Keep a note open across visits to see how your thinking changes.</p><p class="course-caption">Reflections stay in this browser and are excluded from account sync. Nothing is sent to Cortex. Share a copy only if you choose to download and send it yourself.</p>
    ${active ? `<div class="course-notice"><strong>Started ${new Date(active.startedAt).toLocaleDateString()}</strong><p>Since you started this reflection: ${observed.lessons.length} lessons · ${observed.coach.length} workshops · ${observed.math.length} math exercises · ${observed.laterAnswers.length} follow-up checks</p><div class="course-actions"><button class="btn" data-course-open="protein-structure">Explore a lesson</button><button class="btn" data-v2-view="coach">Passage Coach</button><button class="btn" data-v2-view="math">Math practice</button></div></div><form id="pilot-feedback"><label for="pilot-clarity">How clear is your next step?</label><select id="pilot-clarity"><option value="">Choose a rating</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${active.clarity === String(n) ? 'selected' : ''}>${n}${n === 1 ? ' · Very unclear' : n === 5 ? ' · Very clear' : ''}</option>`).join('')}</select><label for="pilot-feedback-note">What clicked, what was confusing, and what will you try next?</label><textarea id="pilot-feedback-note" rows="4">${esc(active.note || '')}</textarea><button class="btn btn-solid">Finish and save reflection</button><p class="course-caption">Your draft saves as you type. You can leave it open and return later, or finish to start a new reflection.</p></form>` : `<label class="v2-check"><input id="pilot-consent" type="checkbox"> I choose to save a study reflection on this browser.</label><button class="btn btn-solid" id="pilot-start" disabled>Start a reflection →</button>`}
    <p id="pilot-save-status" role="status"></p><div class="course-actions"><button class="btn" id="pilot-export">Download my reflections</button>${v2Pilot.sessions.length ? `<span>${v2Pilot.sessions.length} saved on this browser</span>` : ''}</div>
    ${
      v2Pilot.sessions.length
        ? `<details class="course-map"><summary>Past reflections · ${v2Pilot.sessions.length}</summary>${v2Pilot.sessions
            .slice()
            .reverse()
            .map(
              r =>
                `<article class="course-saved-answer"><h3>${new Date(r.finishedAt || r.startedAt).toLocaleDateString()}</h3>${r.clarity ? `<p>Next-step clarity: ${esc(r.clarity)}/5</p>` : ''}<p style="white-space:pre-wrap">${esc(r.note || 'No written note.')}</p></article>`
            )
            .join('')}</details>`
        : ''
    }</section>
    <details class="course-map"><summary>Explore lesson sources</summary><div class="v2-review-content"><p>Follow the sources behind each lesson and revisit the ideas in context.</p><label for="review-unit">Choose a lesson</label><select id="review-unit">${courseData.units.map(u => `<option value="${u.id}">${esc(u.title)}</option>`).join('')}</select><div id="review-unit-details"></div></div></details>
    <section class="course-progress-section"><h2>Study resources</h2><p>Explore the MCAT content outline and supporting study resources.</p>${v2Data.sources.map(s => `<p><a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)} ↗</a></p>`).join('')}</section>
  </main>`);
  const drawSources = () => {
    const u = courseUnit(main.querySelector('#review-unit').value);
    main.querySelector('#review-unit-details').innerHTML =
      `${[u.source, ...(u.additionalSources || [])].map(s => `<p><a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)} ↗</a></p>`).join('')}<button class="ghostbtn" data-course-open="${u.id}">Open lesson →</button>`;
  };
  main.querySelector('#review-unit').onchange = drawSources;
  drawSources();
  if (active) {
    const form = main.querySelector('#pilot-feedback');
    form.querySelectorAll('textarea,select').forEach(
      i =>
        (i.oninput = () => {
          active.clarity = main.querySelector('#pilot-clarity').value;
          active.note = main.querySelector('#pilot-feedback-note').value;
          v2SavePilot();
        })
    );
    form.onsubmit = e => {
      e.preventDefault();
      active.finishedAt = Date.now();
      active.observed = v2PilotSnapshot(active.startedAt);
      v2Pilot.sessions.push({ ...active });
      delete v2Pilot.active;
      v2SavePilot();
      renderV2Review();
    };
  } else {
    main.querySelector('#pilot-consent').onchange = e =>
      (main.querySelector('#pilot-start').disabled = !e.target.checked);
    main.querySelector('#pilot-start').onclick = () => {
      if (!main.querySelector('#pilot-consent').checked) return;
      v2Pilot.active = {
        id: v2Id(),
        startedAt: Date.now(),
        consent: 'Voluntary local reflection',
        baseline: v2PilotSnapshot(),
        note: '',
      };
      v2SavePilot();
      renderV2Review();
    };
  }
  main.querySelector('#pilot-export').onclick = () =>
    v2Download('cortex-mcat-reflections.json', {
      version: '2.0.0',
      purpose: 'Personal study reflections',
      sessions: v2Pilot.sessions,
      active: v2Pilot.active ? { ...v2Pilot.active, observed: v2PilotSnapshot(v2Pilot.active.startedAt) } : null,
      previousReviewNotes: v2Pilot.reviews,
    });
  v2Shell(main, 'review');
}

function renderV2Today() {
  if (!courseData || !v2Data) return v2Unavailable('weekly');
  const today = v2WeekDays()[0],
    w = v2State.weekly,
    done = today.tasks.filter(t => t.done).length;
  const next = today.tasks.find(t => !t.done);
  const orderedTasks = next ? [next, ...today.tasks.filter(t => t !== next)] : today.tasks;
  const main = el(`<main class="course-page today-page weekly-today">
    <header class="v2-hero"><span class="course-eyebrow">YOUR WEEK / ${McatV2Core.dateFrom(today.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span><h1>Today’s MCAT plan</h1><p>${today.budget ? `${today.budget} minutes available. Take one step at a time.` : 'A rest day in your weekly plan. Your saved work will be here when you return.'}${w.targetDate ? ` Target date: ${esc(w.targetDate)}.` : ''}</p></header>
    <section class="v2-today-plan" aria-label="Today’s study session">
      <div class="v2-section-title"><h2>${next ? 'Your session' : today.held.length ? 'Some choices are waiting.' : today.tasks.length ? 'Session complete.' : today.pastTarget ? 'Your target date has passed.' : 'Room to pause.'}</h2><span class="study-count">${done} of ${today.tasks.length} complete</span></div>
      ${today.tasks.length ? `<div class="study-progress-track" aria-hidden="true"><span style="width:${(done / today.tasks.length) * 100}%"></span></div>` : ''}
      ${
        today.tasks.length
          ? orderedTasks
              .map(t => {
                const isNext = t === next;
                const saved =
                  w.active?.id === t.id ||
                  (t.type === 'course' &&
                    !t.kind &&
                    courseState.activeUnit === t.key &&
                    !courseRecord(t.key).completedAt) ||
                  (t.type === 'coach' && v2State.coach.active?.coachId === t.key) ||
                  (t.type === 'math' && v2State.math.active?.skill === t.key && !v2State.math.active.completedAt);
                return `<article class="v2-week-task ${t.done ? 'v2-task-done' : isNext ? 'v2-task-next' : ''}"><span class="course-eyebrow">${t.done ? 'COMPLETE' : isNext ? (saved ? 'SAVED WORK' : 'UP NEXT') : t.type === 'course' ? 'COURSE' : t.type === 'coach' ? 'PASSAGE COACH' : t.type === 'math' ? 'QUANTITATIVE' : t.type === 'externalReview' ? 'EXAM REVIEW' : 'PRACTICE EXAM'} · ${t.minutes} MIN</span><h3>${esc(t.title)}</h3><p>${esc(t.reason || 'Saved work')}</p>${t.prerequisiteNote ? `<p>${esc(t.prerequisiteNote)}</p>` : ''}${t.evidence ? `<details><summary>Why this task?</summary><p>${esc(t.evidence)}</p></details>` : ''}${!t.done ? `<button class="btn${isNext ? ' btn-solid' : ''}" data-today-task="${esc(t.id)}">${saved ? 'Resume activity' : isNext ? 'Start activity' : 'Open activity'} →</button>` : ''}</article>`;
              })
              .join('')
          : `<p>${today.pastTarget ? 'Adjust your target date to plan more study.' : 'No new tasks are assigned. You can still browse the course or choose a practice tool.'}</p>`
      }
      ${!next && today.tasks.length && !today.held.length ? '<p class="study-complete" role="status">Your planned activities are complete. Take a break, or choose practice below.</p>' : ''}
      ${today.tasks.reduce((n, t) => n + t.minutes, 0) > today.budget ? '<p class="v2-budget-note">Your completed or scheduled work exceeds today’s budget. Pause when you need to.</p>' : ''}
    </section>
    ${v2PlanEditor(today)}${v2PastChoicesMarkup()}
    <div class="course-actions today-management"><button class="btn" data-v2-view="weekly">View or adjust my week →</button><button class="btn" data-v2-view="diagnose">Investigate a mistake</button></div>
    <div class="course-actions v2-today-links"><button class="btn" id="v2-browse-course">Explore ${courseData.units.length} lessons</button><button class="btn" id="v2-browse-practice">Browse practice</button><button class="btn" id="v2-browse-progress">See my progress</button></div>
    ${guidePlan() ? `<details class="course-map"><summary>${guidePlan().flexible ? 'Your earlier daily sessions' : 'Your original reference plan'}</summary><p>The earlier daily plan and its completed work are preserved. Your weekly availability now sets the primary Today view.</p><button class="ghostbtn" id="v2-original-plan">Open original daily plan</button></details>` : ''}
  </main>`);
  main
    .querySelectorAll('[data-today-task]')
    .forEach(
      b =>
        (b.onclick = () =>
          v2LaunchWeekTask({ ...today.tasks.find(t => t.id === b.dataset.todayTask), day: today.date }))
    );
  main.querySelector('#v2-browse-course').onclick = renderCourseHome;
  main.querySelector('#v2-browse-practice').onclick = renderMCAT;
  main.querySelector('#v2-browse-progress').onclick = renderCourseProgress;
  main.querySelector('#v2-original-plan')?.addEventListener('click', () => renderGuide(true));
  v2WirePlanEditors(main, [today], renderV2Today);
  v2WirePastChoices(main, renderV2Today);
  v2Shell(main, 'today');
}

function v2MathHistory() {
  const history = v2State.math.history.map(r => McatV2Core.mathEvidence(v2State, r));
  if (!history.length) return '';
  return `<details class="course-map"><summary>Review saved quantitative answers · ${history.length}</summary>${history
    .slice()
    .reverse()
    .map(r => {
      const q = v2MathQuestion(r);
      if (!q) return '';
      return `<details class="course-map"><summary>${McatV2Core.SKILLS[r.skill]} · ${new Date(r.completedAt).toLocaleString()} · ${McatV2Core.bucket(r)}</summary><div class="course-saved-answer"><h3>${esc(q.stem)}</h3><p>Your setup: ${esc(q.setups[r.setup] || 'Unavailable')}</p><p>${esc(q.errors[r.setup] || '')}</p><p>Your result: ${esc(String(r.value))} ${esc(q.unit)}</p><p>${esc(q.explanation)}</p>${r.note ? `<p>Your note: ${esc(r.note)}</p>` : ''}<small>Saved first answer. This review adds no attempt.</small></div></details>`;
    })
    .join('')}</details>`;
}

window.addEventListener('study-storage-recovered', () => {
  if (!courseData || !v2Data || location.pathname !== '/mcat') return;
  const view = new URLSearchParams(location.search).get('view');
  if (view === 'weekly') renderV2Week();
  else if (view === 'today') renderV2Today();
});
