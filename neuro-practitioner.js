/* Practitioner projects: saved code, frozen inputs, bounded Python and written engineering review. */
let neuroProjectCatalog = null,
  neuroProjectLoading = null,
  neuroProjectGeneration = 0,
  neuroProjectJob = null;
const projectCore = () => NeuroProjectCore;
const projectIds = [
  'neural-signal-viewer',
  'spike-detector',
  'noise-smoother',
  'leftright-decoder',
  'cursor-simulator',
  'closed-loop-capstone',
];
const projectLabels = {
  result: 'What did the analysis show?',
  limitation: 'What is one important limitation or failure mode?',
  next: 'What specific test would you run next?',
};
const projectId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
function neuroMilestonePassed(id) {
  return projectCore().completed(NEURO_PROG.projects?.[id]);
}
function neuroMilestoneRequirement(ms) {
  if (
    !neuroPath()
      ?.steps.filter(step => step.order <= ms.unlockUnit)
      .every(step => NEURO_PROG.pathDone.includes(step.id))
  )
    return `Complete units 1–${ms.unlockUnit}`;
  const prior = projectIds[projectIds.indexOf(ms.id) - 1];
  if (prior && !neuroMilestonePassed(prior) && !NEURO_PROG.milestones?.[prior]?.passed) {
    const title = NEURO.milestones?.milestones.find(item => item.id === prior)?.title;
    return title ? `Complete ${title}` : 'Complete the preceding project';
  }
  return 'In development';
}
function neuroMilestoneUnlocked(ms) {
  if (NEURO_PROG.projects?.[ms.id]?.current || NEURO_PROG.milestones?.[ms.id]?.passed) return true;
  const prior = projectIds[projectIds.indexOf(ms.id) - 1];
  return (
    ms.status === 'live' &&
    neuroPath()
      ?.steps.filter(step => step.order <= ms.unlockUnit)
      .every(step => NEURO_PROG.pathDone.includes(step.id)) &&
    (!prior || neuroMilestonePassed(prior) || NEURO_PROG.milestones?.[prior]?.passed)
  );
}
function neuroProjectRoute(id, runId) {
  const url = new URL(sectionUrl('neuro'), location.origin);
  url.searchParams.set('project', id);
  if (runId) url.searchParams.set('run', runId);
  if (url.pathname + url.search === location.pathname + location.search) return;
  // Only the run changed (Start, history, popstate re-route): replace so Back still leaves the project.
  const sameProject = new URLSearchParams(location.search).get('project') === id;
  history[sameProject ? 'replaceState' : 'pushState']({}, '', url.pathname + url.search);
}
async function loadNeuroProjects() {
  if (neuroProjectCatalog) return neuroProjectCatalog;
  if (!neuroProjectLoading)
    neuroProjectLoading = fetch('data/neuro-projects.json?v=2')
      .then(async response => {
        if (!response.ok) throw Error('The project collection did not download.');
        const data = await response.json();
        if (
          data.version !== 1 ||
          !Array.isArray(data.projects) ||
          new Set(data.projects.map(p => p.id)).size !== data.projects.length
        )
          throw Error('The project collection is invalid.');
        data.projects.forEach(projectCore().validateProject);
        for (const project of data.projects)
          if (!(await projectCore().verifyInputs(project)))
            throw Error('The project inputs do not match their recorded version.');
        neuroProjectCatalog = data;
        return data;
      })
      .finally(() => {
        neuroProjectLoading = null;
      });
  return neuroProjectLoading;
}
function projectFrame(title, body) {
  const root = el('<div></div>');
  root.appendChild(topbar('neuro'));
  root.appendChild(
    el(
      `<main class="neuro-page neuro-inner" id="main"><section class="neuro-body neuro-project"><button class="backbtn topback" id="project-back">← Neuroengineering</button><p class="neuro-eyebrow">Practitioner projects</p><h1 class="neuro-h1">${esc(title)}</h1>${body}<p id="project-status" role="status" aria-live="polite"></p></section></main>`
    )
  );
  root.querySelectorAll('.btn').forEach(button => button.classList.add('neuro-btn'));
  root.querySelector('#project-back').onclick = () => renderNeuroEngineering();
  setView(root);
  return root;
}
function projectSources(project) {
  const hash = projectCore().portableInputHash(project);
  return `<details><summary>Inputs, provenance and review status</summary><p>${esc(project.provenance)}</p><p>Independent engineering review: ${esc(project.review.status)}. These are synthetic learning exercises, not clinical device evidence.</p><p class="project-digest">Example-input SHA-256: ${esc(hash)}</p>${hash !== project.inputSha256 ? `<p>Zero values are normalized for portable storage. The original signed-zero checksum is retained in your saved record: <span class="project-digest">${esc(project.inputSha256)}</span>.</p>` : ''}${project.sources.map(s => `<p><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></p>`).join('')}</details>`;
}
async function renderNeuroMilestone(id) {
  const token = ++neuroProjectGeneration;
  neuroProjectJob?.abort();
  const params = new URLSearchParams(location.search),
    requested = params.get('project') === id ? params.get('run') : null;
  neuroProjectRoute(id, requested);
  const group = NEURO_PROG.projects?.[id];
  const saved = requested
    ? [group?.current, ...(group?.history || [])].find(work => work?.runId === requested)
    : group?.current;
  if (saved) {
    try {
      if (!(await projectCore().verifyInputs(saved.content))) throw Error('Input mismatch');
    } catch {
      StudyStorage.sessionFailed();
      projectFrame(
        'The saved project inputs could not be verified.',
        '<p>The original saved record has been kept for recovery.</p>'
      );
      return;
    }
    if (token !== neuroProjectGeneration || new URLSearchParams(location.search).get('project') !== id) return;
    if (projectCore().interrupt(saved) && !saveNeuroProg()) return;
    neuroProjectRoute(id, saved.runId);
    renderNeuroProjectWork(saved, group.current === saved);
    return;
  }
  if (requested) {
    projectFrame(
      'This saved project is not in this workspace.',
      '<p>Your other work has been kept. Return to the project list to choose an available record.</p>'
    );
    return;
  }
  const loading = projectFrame('Opening project…', '<p>Loading the task and its reproducible inputs.</p>');
  let data;
  try {
    [, data] = await Promise.all([loadNeuro(), loadNeuroProjects()]);
  } catch (error) {
    if (token === neuroProjectGeneration && loading.isConnected) {
      loading.querySelector('h1').textContent = 'The project could not open.';
      loading.querySelector('#project-status').textContent = error.message;
      const button = el('<button class="btn neuro-btn">Retry project</button>');
      button.onclick = () => renderNeuroMilestone(id);
      loading.querySelector('.neuro-project').appendChild(button);
    }
    return;
  }
  if (token !== neuroProjectGeneration || !loading.isConnected) return;
  const project = data.projects.find(p => p.id === id),
    ms = NEURO.milestones?.milestones?.find(m => m.id === id);
  if (!project || !ms) {
    projectFrame('This project is unavailable.', '<p>No saved work has been changed.</p>');
    return;
  }
  const unlocked = neuroMilestoneUnlocked(ms);
  const root = projectFrame(
    project.title,
    `<p>${esc(project.objective)}</p><p>${esc(project.prompt)}</p><p>Complete the first ${project.unlockUnit} course units${project.previousProject ? ' and the preceding project' : ''} before starting this project. Previously recorded project access is retained.</p><p>About 30–60 minutes; the capstone may take longer. Python runs in a disposable browser worker and needs its external runtime to download. Only the Python standard library is available in that browser runtime; numpy, scipy and other packages cannot be imported. You can export the exact code and inputs for standard Python.</p><p>Record a prediction, implement the function, inspect the checks, then write an engineering memo. Passing checks proves only the listed behavior. The memo requires independent review to assess its quality.</p><button class="btn btn-solid" id="project-start" ${unlocked ? '' : 'disabled'}>Start saved project</button>${projectSources(project)}`
  );
  root.querySelector('#project-start').onclick = () => {
    if (StudyStorage.paused || !unlocked) return;
    NEURO_PROG.projects ||= {};
    const work = projectCore().create(project, projectId('project'));
    NEURO_PROG.projects[id] = { current: work, history: group?.history || [] };
    if (saveNeuroProg()) {
      neuroProjectRoute(id, work.runId);
      renderNeuroProjectWork(work, true);
    }
  };
}
function projectJSON(value) {
  return `<pre class="project-json">${esc(JSON.stringify(value, null, 2))}</pre>`;
}
function projectPlot(title, values, rate, unit, description, annotations = {}) {
  return neuroSeriesMarkup({ ...annotations, title, values, sampleRateHz: rate, unit, description }, 512);
}
function projectPreview(project) {
  const p = project.preview;
  if (p.kind === 'signal') return projectPlot('Input waveform', p.samples, p.sampleRateHz, p.units, p.note);
  if (p.kind === 'cursor')
    return projectPlot(
      'Fixed target sequence',
      p.targets,
      1 / p.dt,
      p.units,
      'Targets are sampled model inputs. The controller begins at position zero.'
    );
  if (p.kind === 'decoder')
    return `<details><summary>Training and held-out input rows</summary>${projectJSON({ train_x: p.train, train_y: p.trainLabels, test_x: p.test })}<p>Evaluation labels are kept out of the function inputs. This small synthetic split is a practice example, not a reserved final benchmark.</p></details>`;
  return `<p>The capstone has ${p.example.train_trials.length} training trials and ${p.example.test_trials.length} held-out trials. Each trial contains two channels with ${p.example.train_trials[0][0].length} synthetic samples per channel. Units: ${esc(p.units)}.</p><details><summary>Inspect the exact pipeline inputs</summary>${projectJSON(p.example)}</details>`;
}
function projectAnalysis(project, result) {
  const value = result?.cases?.[0]?.value;
  if (!value || typeof value !== 'object') return '';
  let html = `<section><h2>Your saved example output</h2><p>This is the function result from the recorded code. Passing the whole project requires all listed checks and your written memo.</p>`;
  if (project.preview.kind === 'signal' && Array.isArray(value.events)) {
    html += projectPlot(
      'Detected candidate events',
      project.preview.samples,
      project.preview.sampleRateHz,
      project.preview.units,
      'Marked troughs come from your saved function result. They are candidate threshold events, not identified neurons or confirmed action potentials.',
      { markerIndices: value.events.map(event => event?.index), threshold: value.threshold }
    );
  }
  if (project.preview.kind === 'signal' && Array.isArray(value.residual)) {
    html += projectPlot(
      'Estimated baseline',
      value.baseline,
      project.preview.sampleRateHz,
      project.preview.units,
      'Your causal baseline estimate. Each chart has its own labeled vertical range.'
    );
    html += projectPlot(
      'Residual after subtraction',
      value.residual,
      project.preview.sampleRateHz,
      project.preview.units,
      'Subtraction can attenuate signal components; a smaller residual is not automatically better.'
    );
  }
  if (
    project.preview.kind === 'decoder' &&
    Array.isArray(value.test_predictions) &&
    value.test_predictions.length === project.preview.testLabels.length
  ) {
    const accuracy = (a, b) =>
      Array.isArray(a) && a.length === b.length
        ? `${a.filter((v, i) => v === b[i]).length}/${b.length}`
        : 'unavailable';
    html += `<p>Training: ${accuracy(value.train_predictions || [], project.preview.trainLabels)}. Held-out example: ${accuracy(value.test_predictions, project.preview.testLabels)}. These small synthetic counts are separate from function-check results.</p>`;
    html += projectJSON({
      weights: value.weights,
      bias: value.bias,
      predictions: value.test_predictions,
      evaluationLabels: project.preview.testLabels,
    });
  }
  if (['cursor', 'pipeline'].includes(project.preview.kind)) {
    for (let i = 0; i < Math.min(3, result.cases.length); i++) {
      const output = result.cases[i].value,
        spec = project.checks.cases[i];
      if (!output || !Array.isArray(output.positions)) continue;
      const dt = project.preview.kind === 'cursor' ? spec.args[4] : spec.args[0].dt;
      html += projectPlot(
        spec.label,
        output.positions,
        1 / dt,
        'cursor units',
        'Position at each modeled time step, including the initial zero. The horizontal axis is model time, not Python execution time.'
      );
      if (project.preview.kind === 'pipeline')
        html += projectJSON({
          train_features: output.train_features,
          test_features: output.test_features,
          weights: output.weights,
          bias: output.bias,
          predictions: output.predictions,
        });
    }
    if (project.preview.kind === 'pipeline')
      html += `<p>Designated held-out labels: ${esc(project.preview.testLabels.join(', '))}. Compare these with the predictions; labels were not supplied to the pipeline function. A correct recurrence can still follow an incorrectly decoded target.</p>`;
  }
  html += `<details><summary>Exact recorded example result</summary>${projectJSON(value)}</details></section>`;
  return html;
}
function projectAttemptMarkup(work) {
  return `<details><summary>Saved checks · ${work.attempts.length}</summary>${work.attempts.map(a => `<article><h3>${new Date(a.startedAt).toLocaleString()} · ${esc(a.status)}</h3><p>${esc(a.result?.message || (a.status === 'interrupted' ? 'Interrupted; no result assigned.' : 'Check in progress.'))}${a.assisted ? ' Reference had been opened before this check.' : ''}</p><details><summary>Code used for this check</summary><pre class="project-code">${esc(a.draft)}</pre></details>${a.result?.cases ? `<ol>${a.result.cases.map((c, i) => `<li><strong>${esc(work.content.checks.cases[i]?.label || 'Input case')}: ${c.passed ? 'passed' : 'not passed'}</strong><pre class="project-json">Returned: ${esc(c.actual)}\nExpected: ${esc(c.expected)}</pre></li>`).join('')}</ol>` : ''}</article>`).join('')}</details>`;
}
function projectDownload(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function projectExportPython(work) {
  return (
    `# Cortex original synthetic project: ${work.content.id}\n# Revision: ${work.content.revision}; input SHA-256: ${projectCore().portableInputHash(work.content)}\n# Numeric zero is normalized for portable JSON storage.\n# Run with Python 3. No third-party packages are needed.\n# The listed checks are exercise evidence, not general engineering proficiency.\n` +
    neuroCodeCheckScript(work.draft, work.content, 'CORTEX_PROJECT_RESULT:')
  );
}
function projectRecordExport(work, legacy) {
  const record = {
    format: 'cortex-neuro-project',
    version: 1,
    exportedAt: new Date().toISOString(),
    canonicalInputSha256: projectCore().portableInputHash(work.content),
    legacy: legacy || null,
    work,
  };
  if (!work.modelViewedAt) {
    // The reference stays out of the export until it has been opened in-app, so the assisted flag remains meaningful.
    record.work = { ...work, content: { ...work.content } };
    delete record.work.content.solution;
    delete record.work.content.modelMemo;
    record.omitted =
      'content.solution and content.modelMemo are excluded until the reference implementation is opened in-app.';
  }
  return record;
}
function renderNeuroProjectWork(work, isCurrent) {
  const Core = projectCore(),
    p = work.content,
    last = work.attempts.at(-1),
    complete = work.completedAt !== null,
    editable = isCurrent && !complete;
  const group = NEURO_PROG.projects[p.id],
    legacy = NEURO_PROG.milestones?.[p.id];
  const root = projectFrame(
    p.title,
    `<p>${esc(p.objective)}</p><p>Project revision ${p.revision} · Original inputs and instructions saved with this run · Independent engineering review ${esc(p.review.status)}</p>
    ${legacy?.passed ? '<p class="project-notice">Your earlier output-only milestone completion is kept. It does not certify the revised checks or the memo in this project.</p>' : ''}
    <section><h2>Build specification</h2><p>${esc(p.prompt)}</p><ul>${p.method.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p>${esc(p.inputContract)}</p><p>Only the Python standard library is available in the browser runtime; numpy, scipy and other packages cannot be imported.</p>${projectPreview(p)}</section>
    <section><h2>Acceptance rubric</h2><ul>${p.rubric.map(x => `<li>${esc(x)}</li>`).join('')}</ul><details><summary>Listed input cases</summary>${p.checks.cases.map(c => `<article><h3>${esc(c.label)}</h3>${projectJSON(c.args)}${c.raises ? `<p>Expected rejection: ${esc(c.raises)}</p>` : ''}</article>`).join('')}</details></section>
    <label class="project-field">Before running: what result or failure do you predict?<textarea id="project-prediction" rows="3" maxlength="6000" ${work.firstPrediction || !editable ? 'readonly' : ''}>${esc(work.firstPrediction?.text || work.prediction)}</textarea></label>
    <label class="project-field">Your Python function<textarea class="neuro-code-draft" id="project-code" rows="20" maxlength="40000" spellcheck="false" ${editable ? '' : 'readonly'}>${esc(work.draft)}</textarea></label>
    <div class="project-actions">${editable ? '<button class="btn btn-solid" id="project-check">Check all listed inputs</button><button class="btn" id="project-stop" hidden>Stop Python</button><button class="btn" id="project-reset">Restore starter</button>' : ''}<button class="btn" id="project-python">Download reproducible Python</button><button class="btn" id="project-record" title="${work.modelViewedAt ? 'Includes the reference implementation, which was opened in-app.' : 'Excludes the reference implementation until it is opened in-app.'}">Download saved record</button>${editable && !work.modelViewedAt ? '<button class="ghostbtn" id="project-reference">Open reference implementation</button>' : ''}</div>
    <p id="project-runtime" role="status">${esc(last?.result?.message || 'Python idle. No result assigned to unexecuted code.')}</p><pre id="project-output" class="project-json">${esc([last?.result?.stdout, last?.result?.stderr].filter(Boolean).join('\n'))}</pre>
    ${projectAnalysis(p, last?.result)}${projectAttemptMarkup(work)}
    ${work.modelViewedAt ? `<details open><summary>Reference implementation · assistance recorded</summary><pre class="project-code">${esc(p.solution)}</pre></details>` : ''}
    <section><h2>Your engineering memo</h2><p>Describe evidence and limitations in your own words. Writing is retained without automatic quality grading.</p>${Core.MEMO.map(key => `<label class="project-field">${esc(projectLabels[key])}<textarea data-project-memo="${key}" rows="3" maxlength="6000" ${editable ? '' : 'readonly'}>${esc(work.memo[key])}</textarea></label>`).join('')}
    ${complete ? `<p>Project comparison completed. ${work.completion.assisted ? 'Reference assistance was recorded.' : 'No in-app reference opening was recorded.'} This is exercise completion, not independent engineering approval.</p>${isCurrent ? '<button class="btn" id="project-new">Start another saved attempt</button>' : ''}` : '<button class="btn btn-solid" id="project-finish">Save memo & finish project</button><p id="project-gate">A passing check must match your current code, and all three memo fields must be filled.</p>'}</section>
    ${complete || work.modelViewedAt ? `<details><summary>Authored memo comparison</summary>${Core.MEMO.map(key => `<h3>${esc(projectLabels[key])}</h3><p>${esc(p.modelMemo[key])}</p>`).join('')}</details>` : ''}
    ${projectSources(p)}<section><h2>Earlier saved project runs</h2>${group.history.length ? group.history.map(item => `<button class="btn neuro-project-history-button" data-project-history="${esc(item.runId)}">Revision ${item.content.revision} · ${new Date(item.startedAt).toLocaleString()}</button>`).join('') : '<p>No earlier runs in this workspace.</p>'}${!isCurrent ? '<button class="btn" id="project-current">Return to current project</button>' : ''}</section>`
  );
  const message = text => (root.querySelector('#project-status').textContent = text);
  const refresh = () => {
    const button = root.querySelector('#project-finish');
    if (button) button.disabled = !editable || !Core.ready(work) || StudyStorage.paused;
  };
  const save = () => {
    const ok = saveNeuroProg();
    if (ok) {
      message('Draft saved on this device.');
      refresh();
    }
    return ok;
  };
  root.querySelector('#project-code').addEventListener('input', e => {
    if (!StudyStorage.paused && Core.edit(work, 'draft', e.target.value)) save();
  });
  root.querySelector('#project-prediction').addEventListener('input', e => {
    if (!StudyStorage.paused && Core.edit(work, 'prediction', e.target.value)) save();
  });
  root.querySelectorAll('[data-project-memo]').forEach(input =>
    input.addEventListener('input', () => {
      if (!StudyStorage.paused && Core.edit(work, input.dataset.projectMemo, input.value)) save();
    })
  );
  root.querySelector('#project-check')?.addEventListener('click', () => executeNeuroProject(work, root));
  root.querySelector('#project-stop')?.addEventListener('click', () => neuroProjectJob?.abort());
  root.querySelector('#project-reset')?.addEventListener('click', () => {
    if (
      StudyStorage.paused ||
      neuroProjectJob ||
      !confirm('Restore this starter? Your prior draft will remain in the saved record.')
    )
      return;
    work.previousDraft = work.draft;
    Core.edit(work, 'draft', p.starter);
    if (save()) renderNeuroProjectWork(work, true);
  });
  root.querySelector('#project-reference')?.addEventListener('click', () => {
    if (StudyStorage.paused || neuroProjectJob) return;
    work.modelViewedAt = Date.now();
    if (save()) renderNeuroProjectWork(work, true);
  });
  root.querySelector('#project-python').onclick = () =>
    projectDownload(p.id + '.py', projectExportPython(work), 'text/x-python');
  root.querySelector('#project-record').onclick = () =>
    projectDownload(
      p.id + '-record.json',
      JSON.stringify(projectRecordExport(work, legacy), null, 2),
      'application/json'
    );
  root.querySelector('#project-finish')?.addEventListener('click', () => {
    if (!StudyStorage.paused && !neuroProjectJob && editable && Core.complete(work)) {
      if (saveNeuroProg()) renderNeuroProjectWork(work, true);
    }
  });
  root.querySelector('#project-new')?.addEventListener('click', () => {
    if (StudyStorage.paused) return;
    group.history.push(Core.clone(work));
    group.current = Core.create(p, projectId('project'));
    if (saveNeuroProg()) {
      neuroProjectRoute(p.id, group.current.runId);
      renderNeuroProjectWork(group.current, true);
    }
  });
  for (const button of root.querySelectorAll('[data-project-history]'))
    button.onclick = () => {
      neuroProjectRoute(p.id, button.dataset.projectHistory);
      renderNeuroMilestone(p.id);
    };
  root.querySelector('#project-current')?.addEventListener('click', () => {
    neuroProjectRoute(p.id, group.current.runId);
    renderNeuroMilestone(p.id);
  });
  refresh();
}
async function executeNeuroProject(work, root) {
  if (StudyStorage.paused || neuroProjectJob || work.completedAt !== null) return;
  let attempt;
  try {
    attempt = projectCore().begin(work, projectId('check'));
  } catch (error) {
    root.querySelector('#project-status').textContent = error.message;
    return;
  }
  if (!saveNeuroProg()) return;
  const controller = new AbortController();
  neuroProjectJob = controller;
  const observer = new MutationObserver(() => {
    if (!root.isConnected) controller.abort();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  root.querySelectorAll('textarea').forEach(input => (input.readOnly = true));
  root.querySelectorAll('.project-actions button, #project-finish').forEach(button => (button.disabled = true));
  const stop = root.querySelector('#project-stop');
  stop.hidden = false;
  stop.disabled = false;
  try {
    const result = await neuroCodeEvaluateOJT(
      attempt.draft,
      work.content,
      text => {
        if (root.isConnected) root.querySelector('#project-runtime').textContent = text;
      },
      { signal: controller.signal }
    );
    projectCore().finish(work, attempt.id, result);
    if (saveNeuroProg() && root.isConnected) renderNeuroProjectWork(work, true);
  } catch (error) {
    projectCore().finish(work, attempt.id, {
      passed: false,
      message: 'The project check could not finish.',
      stderr: error.message || String(error),
    });
    if (saveNeuroProg() && root.isConnected) renderNeuroProjectWork(work, true);
  } finally {
    observer.disconnect();
    if (neuroProjectJob === controller) neuroProjectJob = null;
  }
}
