/* Longitudinal Clinical Shift: frozen cases, first reasoning and handoff comparison. */
(() => {
  'use strict';
  const Core = ClinicalLongitudinalCore,
    KEY = 'cs-clinical-longitudinal-v1';
  const labels = {
    hypothesis: 'Working explanation',
    alternative: 'A competing explanation or important uncertainty',
    evidence: 'Evidence supporting your view, and what would change it',
    situation: 'Situation and relevant background',
    assessment: 'Current assessment and its supporting evidence',
    uncertainty: 'What remains uncertain',
    next: 'Next steps, pending results and who owns them',
    changed: 'How your reasoning changed over time',
  };
  const blank = () => ({ version: 1, active: null, history: [] });
  let state = StudyStorage.read(KEY, blank()),
    catalog = null,
    renderToken = 0;
  try {
    if (
      !state ||
      state.version !== 1 ||
      !Array.isArray(state.history) ||
      (state.active !== null && (typeof state.active !== 'object' || !state.active))
    )
      throw Error('Invalid workspace');
    if (state.active) Core.validateRun(state.active);
    for (const run of state.history) {
      Core.validateRun(run);
      if (run.phase !== 'complete') throw Error('Incomplete history');
    }
    if (new Set(state.history.map(run => run.runId)).size !== state.history.length) throw Error('Duplicate history');
    if (
      state.active &&
      (state.active.phase === 'complete' || state.history.some(run => run.runId === state.active.runId))
    )
      throw Error('Conflicting active encounter');
  } catch {
    StudyStorage.sessionFailed();
    state = blank();
  }
  StudyStorage.watch(KEY, () => state);
  const onRoute = () =>
    location.pathname.replace(/\/$/, '') === '/practice' &&
    new URLSearchParams(location.search).get('view') === 'longitudinal';
  window.addEventListener('study-storage-recovered', () => {
    if (onRoute()) entry();
  });
  function route(runId = null, caseId = null) {
    const url = new URL(location.href);
    url.pathname = '/practice';
    url.hash = '';
    for (const key of ['view', 'run', 'case']) url.searchParams.delete(key);
    url.searchParams.set('view', 'longitudinal');
    if (runId) url.searchParams.set('run', runId);
    if (caseId) url.searchParams.set('case', caseId);
    if (url.href !== location.href) history.pushState({}, '', url.pathname + url.search);
  }
  function save() {
    return StudyStorage.write(KEY, state);
  }
  function change(fn) {
    if (StudyStorage.paused) return;
    try {
      state.active = fn(state.active);
      if (save()) {
        route(state.active.runId);
        renderRun(state.active);
      }
    } catch (error) {
      const status = document.querySelector('#clong-status');
      if (status) status.textContent = error.message;
    }
  }
  function frame(title, content) {
    const root = el('<div></div>');
    root.appendChild(topbar('practice'));
    root.appendChild(
      el(
        `<main class="panel clong" id="main"><button class="backbtn" id="clong-hub">← Patient timelines</button><header class="cshift-hub-hero"><span class="label">Clinical Shift · Longitudinal practice</span><h1>${esc(title)}</h1></header>${content}<p id="clong-status" role="status" aria-live="polite"></p></main>`
      )
    );
    root.querySelector('#clong-hub').onclick = () => {
      route();
      entry();
    };
    setView(root);
    return root;
  }
  const paragraphs = text => `<p>${esc(text)}</p>`;
  const written = (value, fields) =>
    fields
      .map(
        key =>
          `<div class="clong-written"><h3>${esc(labels[key])}</h3><p>${esc(value?.[key] || 'Not recorded')}</p></div>`
      )
      .join('');
  const inputs = (fields, value) =>
    fields
      .map(
        key =>
          `<label class="clong-field">${esc(labels[key])}<textarea name="${key}" rows="3" maxlength="6000" required>${esc(value?.[key] || '')}</textarea></label>`
      )
      .join('');
  function sourceMarkup(item) {
    return `<details class="clong-sources"><summary>Case scope, sources and review status</summary><p>${esc(item.scope)}</p><p>Independent clinician review: ${esc(item.review.status)}.</p><ul>${item.sources.map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a>${source.note ? paragraphs(source.note) : ''}</li>`).join('')}</ul></details>`;
  }
  async function entry() {
    const token = ++renderToken,
      params = new URLSearchParams(location.search),
      runId = params.get('run');
    if (!onRoute()) return;
    if (runId) {
      const run = state.active?.runId === runId ? state.active : state.history.find(r => r.runId === runId);
      if (run) {
        renderRun(run);
        return;
      }
      frame(
        'This saved encounter is not in this workspace.',
        '<p>Your other work has been kept. Return to patient timelines to open an available encounter.</p>'
      );
      return;
    }
    if (!catalog) {
      const root = frame('Opening patient timelines…', '<p>Downloading the fictional case collection.</p>');
      try {
        const response = await fetch('data/clinical-longitudinal.json?v=1');
        if (!response.ok) throw Error('Download unavailable');
        const data = await response.json();
        if (
          data.version !== 1 ||
          !Array.isArray(data.cases) ||
          !data.cases.length ||
          new Set(data.cases.map(c => c.id)).size !== data.cases.length
        )
          throw Error('Invalid collection');
        data.cases.forEach(Core.validateCase);
        catalog = data;
      } catch {
        if (token === renderToken && onRoute()) {
          root.querySelector('h1').textContent = 'The case collection could not open.';
          root.querySelector('#clong-status').textContent = 'Your saved encounters remain available below.';
          root.querySelector('main').appendChild(el('<button class="btn" id="clong-retry">Retry download</button>'));
          root.querySelector('#clong-retry').onclick = entry;
          appendSaved(root);
        }
        return;
      }
    }
    if (token !== renderToken || !onRoute() || new URLSearchParams(location.search).get('run')) return;
    const chosen = params.get('case'),
      visible = chosen ? catalog.cases.filter(c => c.id === chosen) : catalog.cases;
    const root = frame(
      'Follow the evidence. Revise the story.',
      `<p>Three fictional patients, each followed across new findings and a later handoff. Record your explanation before the next evidence appears. Your first reasoning stays in the timeline.</p><p class="cshift-content-status">Local author drafts for advanced students. Independent clinician review is pending. Written comparisons are not graded or evidence of clinical competence. Use only the fictional chart; do not enter real patient information.</p><p>About 15–25 minutes per case. Your active encounter and completed timelines are saved in this browser workspace and included in its study backup.</p>
      ${!visible.length ? '<p>This case is not in the available collection. Return to patient timelines to choose a case.</p>' : ''}
      <section class="clong-cases" aria-label="Available patient timelines">${visible.map(item => `<article><h2>${esc(item.title)}</h2><p>${esc(item.objective)}</p><p>${esc(item.prerequisites)}</p><button class="btn" data-clong-start="${esc(item.id)}" ${state.active ? 'disabled' : ''}>Start patient timeline</button>${sourceMarkup(item)}</article>`).join('')}</section><button class="btn" id="clong-rotations">Back to specialty rotations</button>`
    );
    root.querySelector('#clong-rotations').onclick = () => {
      const url = new URL(location.href);
      for (const key of ['view', 'run', 'case']) url.searchParams.delete(key);
      history.pushState({}, '', url.pathname + url.search);
      renderClinicalShift();
    };
    for (const button of root.querySelectorAll('[data-clong-start]'))
      button.onclick = () => {
        if (StudyStorage.paused || state.active) return;
        state.active = Core.create(
          catalog.cases.find(c => c.id === button.dataset.clongStart),
          `timeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        );
        if (save()) {
          route(state.active.runId);
          renderRun(state.active);
        }
      };
    appendSaved(root);
  }
  function appendSaved(root) {
    const section =
      el(`<section class="clong-saved"><h2>Your patient timelines</h2>${state.active ? `<article><h3>${esc(state.active.caseData.title)}</h3><p>Encounter in progress. Continue it or explicitly discard it before starting another.</p><button class="btn" data-clong-open="${esc(state.active.runId)}">Continue saved encounter</button><button class="ghostbtn" id="clong-discard">Discard unfinished encounter</button></article>` : '<p>No unfinished timeline.</p>'}
      ${state.history.map(run => `<article><h3>${esc(run.caseData.title)}</h3><p>Comparison completed · ${new Date(run.completedAt).toLocaleDateString()} · Case revision ${run.caseData.revision}</p><button class="btn" data-clong-open="${esc(run.runId)}">Open saved reasoning</button></article>`).join('')}</section>`);
    root.querySelector('main').appendChild(section);
    for (const button of section.querySelectorAll('[data-clong-open]'))
      button.onclick = () => {
        route(button.dataset.clongOpen);
        entry();
      };
    section.querySelector('#clong-discard')?.addEventListener('click', event => confirmDiscard(event.currentTarget));
  }
  function confirmDiscard(trigger) {
    const main = trigger.closest('main'),
      run = state.active;
    if (!main || !run || main.querySelector('dialog') || StudyStorage.paused) return;
    const dialog =
      el(`<dialog class="cshift-confirm" aria-labelledby="clong-discard-title" aria-describedby="clong-discard-scope">
      <h2 id="clong-discard-title">Discard this unfinished encounter?</h2>
      <p id="clong-discard-scope">This removes the unfinished timeline and its written drafts. Completed patient timelines stay in your history.</p>
      <div><button class="btn" id="clong-keep" autofocus>Keep this encounter</button><button class="btn btn-solid" id="clong-confirm-discard">Discard encounter</button></div>
    </dialog>`);
    const finish = accepted => {
      dialog.close();
      dialog.remove();
      if (accepted && main.isConnected && state.active === run && !StudyStorage.paused && save()) {
        state.active = null;
        if (save()) {
          route();
          entry();
        }
      } else if (trigger.isConnected && !StudyStorage.paused) trigger.focus();
    };
    dialog.querySelector('#clong-keep').onclick = () => finish(false);
    dialog.querySelector('#clong-confirm-discard').onclick = () => finish(true);
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      finish(false);
    });
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const first = dialog.querySelector('#clong-keep'),
        last = dialog.querySelector('#clong-confirm-discard');
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
    dialog.querySelector('#clong-keep').focus();
  }
  function historyMarkup(run) {
    return `<details class="clong-history"><summary>Your recorded reasoning · ${run.records.length} checkpoint${run.records.length === 1 ? '' : 's'}</summary>${run.records
      .map(record => {
        const node = run.caseData.nodes.find(n => n.id === record.nodeId),
          option = node.options.find(o => o.id === record.choice);
        return `<article><span class="label">${esc(node.time)}</span><h2>${esc(node.title)}</h2>${paragraphs(node.observation)}${written(record.reason, Core.REASON)}<h3>Your next step</h3>${paragraphs(option.text)}<h3>Comparison</h3>${paragraphs(option.feedback)}${paragraphs(node.model)}</article>`;
      })
      .join('')}</details>`;
  }
  function renderRun(run) {
    const node = Core.nodeFor(run),
      active = state.active === run;
    let body = `<p class="cshift-content-status">Fictional learning encounter · Case revision ${run.caseData.revision} · Independent clinician review ${esc(run.caseData.review.status)}</p>${historyMarkup(run)}<section class="clong-chart"><span class="label">${esc(node.time)}</span><h2>${esc(node.title)}</h2>${paragraphs(node.observation)}</section>`;
    if (run.phase === 'reason') {
      const draft = run.drafts[node.id] || {};
      body += `<form id="clong-reason">${inputs(Core.REASON, draft)}<fieldset><legend>${esc(node.prompt)}</legend>${node.options.map(option => `<label class="clong-option"><input type="radio" name="choice" value="${esc(option.id)}" ${draft.choice === option.id ? 'checked' : ''} required><span>${esc(option.text)}</span></label>`).join('')}</fieldset><button class="btn btn-solid" type="submit">Save first reasoning & compare</button><p>After saving, these first answers stay fixed. Your next checkpoint gives you room to revise.</p></form>`;
    } else if (run.phase === 'feedback') {
      const record = run.records.at(-1),
        option = node.options.find(o => o.id === record.choice);
      body += `<section><h2>Compare this decision</h2>${written(record.reason, Core.REASON)}<h3>Your next step</h3>${paragraphs(option.text)}<h3>Authored comparison</h3>${paragraphs(option.feedback)}${paragraphs(node.model)}<button class="btn btn-solid" id="clong-next">Continue the timeline</button></section>`;
    } else if (run.phase === 'handoff') {
      body += `<form id="clong-handoff"><h2>Write your handoff</h2><p>Use the earlier timeline to explain the change in your reasoning. Include pending work and responsibility for it.</p>${inputs(Core.HANDOFF, run.handoffDraft)}<button class="btn btn-solid" type="submit">Save first handoff & reveal model</button></form>`;
    } else {
      body += `<section><h2>Your first handoff and the model</h2><p>The model is one authored example. Reasonable wording and alternatives can differ. No automated judgment of your clinical competence is made.</p><div class="clong-comparison"><article><h2>Your first handoff</h2>${written(run.handoff, Core.HANDOFF)}</article><article><h2>Authored model</h2>${written(node.model, Core.HANDOFF)}</article></div></section>`;
      body +=
        run.phase === 'complete'
          ? `<section><h2>Your comparison</h2>${paragraphs(run.comparison)}<p>Comparison completed. Your original case and reasoning are preserved in this record.</p></section>`
          : '<form id="clong-comparison"><label class="clong-field">One difference, useful revision, or unresolved question<textarea name="comparison" rows="4" maxlength="6000" required>' +
            esc(run.comparison) +
            '</textarea></label><button class="btn btn-solid" type="submit">Save comparison & finish</button></form>';
    }
    body += sourceMarkup(run.caseData);
    const root = frame(run.caseData.title, body);
    if (!active) return;
    const reason = root.querySelector('#clong-reason'),
      handoff = root.querySelector('#clong-handoff'),
      comparison = root.querySelector('#clong-comparison');
    for (const form of [reason, handoff, comparison].filter(Boolean)) {
      form.addEventListener('input', event => {
        if (StudyStorage.paused || state.active !== run) return;
        const target = event.target,
          field = target.name;
        if (form === reason && [...Core.REASON, 'choice'].includes(field)) {
          run.drafts[node.id] ||= {};
          run.drafts[node.id][field] = target.value;
        } else if (form === handoff && Core.HANDOFF.includes(field)) run.handoffDraft[field] = target.value;
        else if (form === comparison && field === 'comparison') run.comparison = target.value;
        if (save()) root.querySelector('#clong-status').textContent = 'Draft saved on this device.';
      });
      form.addEventListener('submit', event => {
        event.preventDefault();
        if (state.active !== run || StudyStorage.paused) return;
        if (form === comparison) {
          try {
            const finished = Core.complete(run);
            state = { ...state, active: null, history: [finished, ...state.history] };
            if (save()) {
              route(finished.runId);
              renderRun(finished);
            }
          } catch (error) {
            root.querySelector('#clong-status').textContent = error.message;
          }
        } else change(form === reason ? Core.lock : Core.revealHandoff);
      });
    }
    root.querySelector('#clong-next')?.addEventListener('click', () => {
      if (state.active === run) change(Core.advance);
    });
  }
  window.ClinicalLongitudinal = {
    entry,
    open: () => {
      route();
      return entry();
    },
    reset: () => {
      state = blank();
      return StudyStorage.remove(KEY);
    },
  };
})();
