/* Reproducible teaching models. No participant data or learner timing. */
(() => {
  'use strict';
  const KEY = 'cs-cogpsych-research-v1';
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const text = value => typeof value === 'string' && !!value.trim();
  const finite = value => Number.isFinite(value);
  const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  function validDemo(demo) {
    if (!object(demo) || !['design', 'attention'].includes(demo.kind) || demo.id !== demo.kind
      || !Number.isInteger(demo.version) || demo.version < 1
      || !['title', 'question', 'description', 'assumptions', 'interpretation'].every(key => text(demo[key]))
      || !Array.isArray(demo.sources) || !demo.sources.length
      || !demo.sources.every(source => text(source?.title) && /^https:\/\//.test(source.url))
      || !Array.isArray(demo.lessonIds) || !demo.lessonIds.every(text) || !object(demo.model)) return false;
    const model = demo.model;
    if (demo.kind === 'design') return Array.isArray(model.baseScores) && model.baseScores.length >= 2
      && model.baseScores.length % 2 === 0 && model.baseScores.every(value => finite(value) && value >= 0)
      && ['shortMinutes', 'longMinutes', 'pointsPerMinute', 'maximum'].every(key => finite(model[key]))
      && model.shortMinutes >= 0 && model.longMinutes > model.shortMinutes && model.pointsPerMinute >= 0
      && model.baseScores.every(value => value + model.pointsPerMinute * (model.longMinutes - model.shortMinutes) + 2 <= model.maximum);
    return Array.isArray(model.policies) && model.policies.length === 2
      && new Set(model.policies.map(policy => policy?.id)).size === 2
      && model.policies.every(policy => object(policy) && text(policy.id) && text(policy.title)
        && Array.isArray(policy.latencies) && policy.latencies.length > 0 && policy.latencies.every(value => finite(value) && value > 0)
        && Array.isArray(policy.correct) && policy.correct.length === policy.latencies.length
        && policy.correct.every(value => typeof value === 'boolean'));
  }
  function validConfig(demo, config) {
    return object(config) && (demo.kind === 'design'
      ? ['confounded', 'balanced'].includes(config.design) && [0, 1, 2].includes(config.effect)
      : ['correct', 'all'].includes(config.filter));
  }
  function rowsFor(demo, config) {
    if (!validDemo(demo) || !validConfig(demo, config)) throw new Error('Invalid teaching model or settings');
    const model = demo.model;
    if (demo.kind === 'attention') return model.policies.flatMap(policy => policy.latencies.map((latency, i) =>
      ({ group: policy.title, trial: i + 1, latency, correct: policy.correct[i] })));
    return ['Reread', 'Retrieval'].flatMap(group => model.baseScores.map((baseline, i) => {
      const minutes = (config.design === 'confounded' ? group === 'Retrieval' : i % 2 === 1) ? model.longMinutes : model.shortMinutes;
      return { group, case: i + 1, minutes, baseline,
        score: baseline + model.pointsPerMinute * (minutes - model.shortMinutes) + (group === 'Retrieval' ? config.effect : 0) };
    }));
  }
  function summarize(demo, config, rows) {
    return [...new Set(rows.map(row => row.group))].map(group => {
      const all = rows.filter(row => row.group === group);
      if (demo.kind === 'design') return { group, count: all.length, minutes: mean(all.map(row => row.minutes)), score: mean(all.map(row => row.score)) };
      const included = all.filter(row => config.filter === 'all' || row.correct), correct = all.filter(row => row.correct).length;
      return { group, count: all.length, correct, included: included.length, excluded: all.length - included.length,
        mean: mean(included.map(row => row.latency)), median: median(included.map(row => row.latency)) };
    });
  }
  function createRun(demo, id, now) {
    return { id, demo: demo.id, content: clone(demo), config: demo.kind === 'design' ? { design: 'confounded', effect: 0 } : { filter: 'correct' },
      startedAt: now, prediction: '', note: '', views: [] };
  }
  function capture(run, now) {
    if (run.completedAt || !run.predictionSavedAt) return false;
    const existing = run.views.find(view => JSON.stringify(view.config) === JSON.stringify(run.config));
    if (!existing) run.views.push({ config: clone(run.config), rows: rowsFor(run.content, run.config), shownAt: now });
    return true;
  }
  function reveal(run, now) {
    if (run.completedAt || run.predictionSavedAt || !text(run.prediction)) return false;
    run.predictionSavedAt = now;
    return capture(run, now);
  }
  function complete(run, now) {
    if (!run.predictionSavedAt || run.views.length < 2 || !text(run.note)) return false;
    run.completedAt ||= now;
    return true;
  }
  function validRun(run) {
    if (!object(run) || !text(run.id) || !validDemo(run.content) || run.demo !== run.content.id
      || !validConfig(run.content, run.config) || !finite(run.startedAt) || typeof run.prediction !== 'string' || typeof run.note !== 'string'
      || !Array.isArray(run.views) || run.views.length > (run.demo === 'design' ? 6 : 2)
      || (run.predictionSavedAt != null && (!finite(run.predictionSavedAt) || !text(run.prediction)))
      || (!run.predictionSavedAt && run.views.length) || (run.predictionSavedAt && !run.views.length)
      || (run.completedAt != null && (!finite(run.completedAt) || run.views.length < 2 || !text(run.note)))) return false;
    return new Set(run.views.map(view => JSON.stringify(view?.config))).size === run.views.length
      && run.views.every(view => object(view) && validConfig(run.content, view.config) && finite(view.shownAt)
        && Array.isArray(view.rows) && view.rows.length > 0 && view.rows.every(row => object(row) && text(row.group)
          && (run.demo === 'design' ? ['case', 'minutes', 'baseline', 'score'].every(key => finite(row[key]))
            : finite(row.trial) && finite(row.latency) && typeof row.correct === 'boolean')))
      && (!run.predictionSavedAt || run.views.some(view => JSON.stringify(view.config) === JSON.stringify(run.config)));
  }
  function validProgress(progress) {
    return object(progress) && progress.version === 1 && Array.isArray(progress.runs) && progress.runs.every(validRun)
      && new Set(progress.runs.map(run => run.id)).size === progress.runs.length
      && (progress.activeId == null || progress.runs.some(run => run.id === progress.activeId));
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { validDemo, validConfig, rowsFor, summarize, median, createRun, capture, reveal, complete, validProgress };
  if (typeof window === 'undefined') return;
  let data, progress, loading;
  async function load() {
    if (data) return;
    if (loading) return loading;
    loading = (async () => {
      const response = await fetch('data/cogpsych-research.json?v=1');
      if (!response.ok) throw new Error('Research models did not download');
      const incoming = await response.json();
      if (!object(incoming) || incoming.version !== 1 || !text(incoming.scope) || !text(incoming.reviewStatus)
        || !Array.isArray(incoming.demos) || incoming.demos.length !== 2 || !incoming.demos.every(validDemo)
        || new Set(incoming.demos.map(demo => demo.id)).size !== 2) throw new Error('Research model structure is invalid');
      const saved = StudyStorage.read(KEY, { version: 1, runs: [], activeId: null });
      if (!validProgress(saved)) { StudyStorage.sessionFailed(); throw new Error('Saved research work needs recovery'); }
      progress = saved; data = incoming;
      StudyStorage.watch(KEY, () => progress);
    })();
    try { await loading; } finally { loading = null; }
  }
  const save = () => StudyStorage.write(KEY, progress);
  const activePage = () => location.pathname.replace(/\/$/, '') === '/cogpsych' && new URLSearchParams(location.search).get('view') === 'research';
  function route(run) {
    const url = new URL(sectionUrl('cogpsych'), location.origin);
    url.searchParams.set('view', 'research');
    if (run) { url.searchParams.set('demo', run.demo); url.searchParams.set('run', run.id); }
    if (url.pathname + url.search !== location.pathname + location.search) history.pushState({}, '', url.pathname + url.search);
  }
  function frame(body) {
    const root = el('<div></div>'); root.appendChild(topbar('cogpsych'));
    const main = el(`<main class="panel cog-research" id="main" tabindex="-1"><a class="ghostbtn" href="${sectionUrl('cogpsych')}">← Psychology course</a>${body}</main>`);
    root.append(main); root.append(siteFooter()); setView(root); return main;
  }
  const sources = demo => `<details class="cog-lesson-source"><summary>Model assumptions, sources and scope</summary><p>${esc(demo.assumptions)}</p>
    <p>Original synthetic teaching model. Independent psychology and methods review is pending. No learner cognition is measured.</p>
    ${demo.sources.map(source => `<p><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)} ↗</a></p>`).join('')}</details>`;
  function home(message = '') {
    route();
    const main = frame(`<span class="label">Cognitive Psychology · Research reasoning</span><h1>Prediction, data, interpretation</h1>
      <p>Make a prediction, inspect two versions of an authored model, then explain what the comparison can and cannot show.</p>
      <p class="course-notice">${esc(data.scope)}</p>${message ? `<p role="status">${esc(message)}</p>` : ''}
      <div class="cog-research-grid">${data.demos.map(demo => `<article><h2>${esc(demo.title)}</h2><p>${esc(demo.description)}</p>
        <button class="btn btn-solid" data-demo="${demo.id}">${progress.runs.some(run => run.demo === demo.id && !run.completedAt) ? 'Resume saved work' : 'Start a prediction'}</button></article>`).join('')}</div>
      <section><h2>Saved investigations</h2><p>Saved work records your predictions and comparisons; it does not award lesson completion or a cognitive score.</p>
      ${progress.runs.length ? `<ul>${[...progress.runs].reverse().map(run => `<li><button class="ghostbtn" data-run="${esc(run.id)}">${esc(run.content.title)} · ${run.completedAt ? 'Completed' : 'In progress'} · ${new Date(run.startedAt).toLocaleString()}</button></li>`).join('')}</ul>` : '<p>No investigations saved yet.</p>'}</section>`);
    main.querySelectorAll('[data-demo]').forEach(button => button.onclick = () => {
      if (StudyStorage.paused) return;
      let run = [...progress.runs].reverse().find(item => item.demo === button.dataset.demo && !item.completedAt);
      if (!run) { run = createRun(data.demos.find(demo => demo.id === button.dataset.demo), crypto.randomUUID(), Date.now()); progress.runs.push(run); }
      progress.activeId = run.id;
      if (save()) show(run);
    });
    main.querySelectorAll('[data-run]').forEach(button => button.onclick = () => show(progress.runs.find(run => run.id === button.dataset.run)));
  }
  const number = value => value == null ? 'No included trials' : Number(value.toFixed(2)).toLocaleString();
  const configLabel = (demo, config) => demo.kind === 'design' ? `${config.design === 'balanced' ? 'Balanced time' : 'Unequal time'}; assumed strategy bonus ${config.effect}` : `${config.filter === 'all' ? 'All responses' : 'Correct responses only'} for latency`;
  function results(demo, view) {
    const summaries = summarize(demo, view.config, view.rows);
    const headings = demo.kind === 'design' ? ['Strategy', 'Synthetic cases', 'Mean study minutes', 'Mean recall points'] : ['Policy', 'Correct / all trials', 'Included for latency', 'Excluded from latency', 'Mean latency (ms)', 'Median latency (ms)'];
    const cells = summaries.map(row => demo.kind === 'design' ? [row.group, row.count, number(row.minutes), number(row.score)]
      : [row.group, `${row.correct}/${row.count}`, row.included, row.excluded, number(row.mean), number(row.median)]);
    const rawHeadings = demo.kind === 'design' ? ['Strategy', 'Case', 'Minutes', 'Baseline points', 'Recall points'] : ['Policy', 'Trial', 'Latency (ms)', 'Correct'];
    const rawCells = view.rows.map(row => demo.kind === 'design' ? [row.group, row.case, row.minutes, row.baseline, number(row.score)] : [row.group, row.trial, row.latency, row.correct ? 'Yes' : 'No']);
    const table = (caption, titles, rows) => `<div class="cog-research-table" tabindex="0" role="region" aria-label="${esc(caption)}"><table><caption>${esc(caption)}</caption><thead><tr>${titles.map(title => `<th scope="col">${esc(title)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, i) => i ? `<td>${esc(String(cell))}</td>` : `<th scope="row">${esc(String(cell))}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    return `${table(`Synthetic summary · ${configLabel(demo, view.config)}`, headings, cells)}
      ${demo.kind === 'design' ? `<p>Retrieval minus reread mean: <strong>${number(summaries[1].score - summaries[0].score)} points</strong>.</p>` : '<p>Accuracy always uses all trials, even when incorrect responses are excluded from the latency summary.</p>'}
      <details><summary>Inspect all ${view.rows.length} synthetic records</summary>${table('Authored records; no real participants', rawHeadings, rawCells)}</details>`;
  }
  function show(run) {
    if (!run) return home('That saved investigation is unavailable. Your other saved work is listed below.');
    route(run);
    const demo = run.content, revealed = !!run.predictionSavedAt, done = !!run.completedAt;
    const view = run.views.find(item => JSON.stringify(item.config) === JSON.stringify(run.config));
    const controls = demo.kind === 'design' ? `<label for="research-design">Time assignment</label><select id="research-design"><option value="confounded" ${run.config.design === 'confounded' ? 'selected' : ''}>Unequal: reread ${demo.model.shortMinutes} min, retrieval ${demo.model.longMinutes} min</option><option value="balanced" ${run.config.design === 'balanced' ? 'selected' : ''}>Balanced: both strategies receive both durations</option></select>
      <label for="research-effect">Assumed strategy bonus (points)</label><select id="research-effect">${[0, 1, 2].map(value => `<option value="${value}" ${run.config.effect === value ? 'selected' : ''}>${value}</option>`).join('')}</select>`
      : `<label for="research-filter">Include in latency summary</label><select id="research-filter"><option value="correct" ${run.config.filter === 'correct' ? 'selected' : ''}>Correct responses only</option><option value="all" ${run.config.filter === 'all' ? 'selected' : ''}>All responses</option></select>`;
    const main = frame(`<button class="ghostbtn" id="research-home">All investigations</button><span class="label">Synthetic data · Model version ${demo.version}${done ? ' · Saved completed work' : ''}</span>
      <h1>${esc(demo.title)}</h1><p>${esc(demo.description)}</p>
      <label for="research-prediction"><strong>${esc(demo.question)}</strong></label><textarea id="research-prediction" rows="4" maxlength="12000" ${revealed ? 'readonly' : ''}>${esc(run.prediction)}</textarea>
      ${!revealed ? '<p>Your first prediction is saved before any data are shown.</p><button class="btn btn-solid" id="research-reveal">Save prediction and show data</button>' : `<p>Your first prediction is preserved. Use the comparison below for later reasoning.</p>
      <fieldset ${done ? 'disabled' : ''}><legend>Model settings</legend>${controls}<button class="btn" id="research-apply">Apply and save settings</button></fieldset>
      ${results(demo, view)}<details><summary>Compare saved settings (${run.views.length})</summary>${run.views.map(saved => results(demo, saved)).join('')}</details>
      <label for="research-note"><strong>What changed, what stayed the same, and what cannot be concluded about people?</strong></label><textarea id="research-note" rows="5" maxlength="12000" ${done ? 'readonly' : ''}>${esc(run.note)}</textarea>
      ${done ? `<p role="status">Saved ${new Date(run.completedAt).toLocaleString()}. Your writing has no automated correctness score.</p><article class="academy-answer"><h2>Authored comparison</h2><p>${esc(demo.interpretation)}</p></article>`
        : '<p>Inspect at least two different settings and write a comparison to finish. Completion records participation.</p><button class="btn btn-solid" id="research-complete">Save completed investigation</button>'}`}
      ${sources(demo)}<nav aria-label="Related psychology lessons"><h2>Learn the methods</h2>${demo.lessonIds.map(id => `<a class="btn" href="${sectionUrl('cogpsych')}${sectionUrl('cogpsych').includes('?') ? '&' : '?'}view=lesson&lesson=${encodeURIComponent(id)}">${esc(({ 'cog-R-design': 'Design', 'cog-R-measurement': 'Measurement', 'cog-R-inference': 'Inference', 'cog-R-retention': 'Retention evidence' })[id] || id)}</a>`).join('')}</nav>`);
    main.querySelector('#research-home').onclick = () => home();
    const prediction = main.querySelector('#research-prediction'), revealButton = main.querySelector('#research-reveal');
    if (revealButton) {
      revealButton.disabled = !run.prediction.trim();
      prediction.oninput = () => { run.prediction = prediction.value; save(); revealButton.disabled = !run.prediction.trim(); };
      revealButton.onclick = () => { if (!StudyStorage.paused && reveal(run, Date.now()) && save()) show(run); };
    }
    const apply = main.querySelector('#research-apply');
    if (apply) apply.onclick = () => {
      if (StudyStorage.paused || done) return;
      const config = demo.kind === 'design' ? { design: main.querySelector('#research-design').value, effect: Number(main.querySelector('#research-effect').value) } : { filter: main.querySelector('#research-filter').value };
      if (!validConfig(demo, config)) return;
      run.config = config;
      capture(run, Date.now()); if (save()) show(run);
    };
    const note = main.querySelector('#research-note'), finish = main.querySelector('#research-complete');
    if (finish) {
      finish.disabled = run.views.length < 2 || !run.note.trim();
      note.oninput = () => { run.note = note.value; save(); finish.disabled = run.views.length < 2 || !run.note.trim(); };
      finish.onclick = () => { if (StudyStorage.paused || !complete(run, Date.now())) return; if (progress.activeId === run.id) progress.activeId = null; if (save()) show(run); };
    }
  }
  async function open() {
    try {
      await load(); if (!activePage()) return;
      const params = new URLSearchParams(location.search), id = params.get('run');
      if (id) return show(progress.runs.find(run => run.id === id));
      home();
    } catch {
      if (!activePage()) return;
      const main = frame('<h1>Research lab could not open</h1><p>Your saved work has not been replaced. Retry the model download or return to the psychology course.</p><button class="btn" id="research-retry">Retry research lab</button>');
      main.querySelector('#research-retry').onclick = open;
    }
  }
  window.CogResearch = { open };
  window.addEventListener?.('study-storage-recovered', () => { if (activePage()) return open(); });
})();
