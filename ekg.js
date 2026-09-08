/* ECG pattern study and explanation practice. Saved examples retain their trace and content. */
let EKG_DATA = null;
const EKG_KEY = 'cs-ekg';
const ekgObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
const ekgText = value => typeof value === 'string' && value.trim().length > 0;
function validEkgPattern(item) {
  return (
    ekgObject(item) &&
    ECGTrace.kinds.includes(item.id) &&
    Number.isInteger(item.revision) &&
    item.revision > 0 &&
    ['name', 'cat', 'rate', 'clue', 'limits', 'prompt'].every(key => ekgText(item[key])) &&
    Array.isArray(item.sources) &&
    item.sources.length > 0 &&
    item.sources.every(source => ekgText(source.title) && /^https:\/\//.test(source.url))
  );
}
function validEkgRecord(record) {
  return (
    ekgObject(record) &&
    ekgText(record.id) &&
    validEkgPattern(record.content) &&
    ECGTrace.valid(record.trace) &&
    Number.isFinite(record.startedAt) &&
    typeof record.draft === 'string' &&
    typeof record.comparison === 'string' &&
    Array.isArray(record.options) &&
    record.options.length === 4 &&
    record.options.every(
      option =>
        ekgObject(option) &&
        ECGTrace.kinds.includes(option.id) &&
        ekgText(option.name) &&
        (option.features == null || ekgText(option.features))
    ) &&
    new Set(record.options.map(option => option.id)).size === 4 &&
    record.options.some(option => option.id === record.content.id) &&
    ((record.selected === null &&
      record.answeredAt == null &&
      record.firstExplanation == null &&
      record.completedAt == null) ||
      (record.options.some(option => option.id === record.selected) &&
        Number.isFinite(record.answeredAt) &&
        ekgText(record.firstExplanation) &&
        (record.completedAt == null || (Number.isFinite(record.completedAt) && ekgText(record.comparison)))))
  );
}
function defaultEkgProg() {
  return { drill: { correct: 0, total: 0 }, byCat: {}, reviewed: [], records: {}, active: null, category: 'all' };
}
function safeEkgProg(raw) {
  const base = { ...defaultEkgProg(), ...raw };
  const count = value =>
    ekgObject(value) &&
    Number.isInteger(value.correct) &&
    Number.isInteger(value.total) &&
    value.correct >= 0 &&
    value.total >= value.correct;
  if (
    !ekgObject(raw) ||
    !count(base.drill) ||
    !ekgObject(base.byCat) ||
    !Object.values(base.byCat).every(count) ||
    !Array.isArray(base.reviewed) ||
    !base.reviewed.every(id => ECGTrace.kinds.includes(id)) ||
    !ekgObject(base.records) ||
    Object.entries(base.records).some(([id, record]) => id !== record.id || !validEkgRecord(record)) ||
    (base.active !== null && !base.records[base.active]) ||
    !ekgText(base.category)
  ) {
    StudyStorage.sessionFailed();
    return defaultEkgProg();
  }
  return base;
}
let EKG_PROG = safeEkgProg(StudyStorage.read(EKG_KEY, {}));
StudyStorage.watch(EKG_KEY, () => EKG_PROG);
function saveEkgProg() {
  return StudyStorage.write(EKG_KEY, EKG_PROG);
}
function ekgReviewedSet() {
  return new Set(EKG_PROG.reviewed);
}
function markEkgReviewed(id) {
  if (StudyStorage.paused || !ECGTrace.kinds.includes(id)) return false;
  if (!EKG_PROG.reviewed.includes(id)) EKG_PROG.reviewed.push(id);
  return saveEkgProg();
}
function ekgHubStats() {
  const reviewed = ekgReviewedSet().size,
    total = ECGTrace.kinds.length;
  return {
    reviewed,
    total,
    pct: Math.round((100 * reviewed) / total),
    drillAcc: EKG_PROG.drill.total ? Math.round((100 * EKG_PROG.drill.correct) / EKG_PROG.drill.total) : null,
    has: reviewed > 0 || EKG_PROG.drill.total > 0,
    explanations: Object.values(EKG_PROG.records).filter(record => record.completedAt).length,
  };
}
async function loadEkg() {
  if (EKG_DATA) return EKG_DATA;
  const response = await fetch('data/ecg-patterns.json?v=2');
  if (!response.ok) throw Error('ECG examples did not download');
  const data = await response.json();
  if (
    !data ||
    !Array.isArray(data.patterns) ||
    data.patterns.length !== ECGTrace.kinds.length ||
    !data.patterns.every(validEkgPattern) ||
    new Set(data.patterns.map(item => item.id)).size !== ECGTrace.kinds.length
  )
    throw Error('ECG examples are incomplete');
  EKG_DATA = data;
  return data;
}
function ekgRoute(mode, params = {}) {
  const url = new URL(sectionUrl('reference'), location.origin);
  url.searchParams.set('tool', 'ecg');
  url.searchParams.set('mode', mode);
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
  if (url.pathname + url.search !== location.pathname + location.search)
    history.replaceState({}, '', url.pathname + url.search);
}
function newEkgRecord() {
  if (StudyStorage.paused || !EKG_DATA) return null;
  const active = EKG_PROG.records[EKG_PROG.active];
  if (active && !active.completedAt) return active;
  const shuffle = values => {
    const out = values.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const pool = EKG_DATA.patterns.filter(item => EKG_PROG.category === 'all' || item.cat === EKG_PROG.category);
  if (!pool.length) {
    EKG_PROG.category = 'all';
    return newEkgRecord();
  }
  const item = pool[Math.floor(Math.random() * pool.length)],
    id = `ecg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const record = {
    id,
    content: JSON.parse(JSON.stringify(item)),
    trace: ECGTrace.create(item.id),
    options: shuffle([item, ...shuffle(EKG_DATA.patterns.filter(other => other.id !== item.id)).slice(0, 3)]).map(
      option => ({ id: option.id, name: option.name, features: option.clue })
    ),
    draft: '',
    comparison: '',
    startedAt: Date.now(),
    selected: null,
    answeredAt: null,
    firstExplanation: null,
    completedAt: null,
  };
  EKG_PROG.records[id] = record;
  EKG_PROG.active = id;
  ekgRoute('drill', { record: id });
  return saveEkgProg() ? record : null;
}
function answerEkg(record, selected) {
  if (
    StudyStorage.paused ||
    record.selected !== null ||
    !ekgText(record.draft) ||
    !record.options.some(option => option.id === selected)
  )
    return false;
  record.selected = selected;
  record.firstExplanation = record.draft;
  record.answeredAt = Date.now();
  const correct = selected === record.content.id,
    cat = record.content.cat;
  EKG_PROG.drill.total++;
  if (correct) EKG_PROG.drill.correct++;
  EKG_PROG.byCat[cat] ||= { correct: 0, total: 0 };
  EKG_PROG.byCat[cat].total++;
  if (correct) EKG_PROG.byCat[cat].correct++;
  return saveEkgProg();
}
function completeEkg(record) {
  if (StudyStorage.paused || record.selected === null || !ekgText(record.comparison)) return false;
  record.completedAt ||= Date.now();
  return saveEkgProg();
}
function ekgSources(item) {
  return `<details class="academy-source-note"><summary>Sources and review status</summary><p>Original authored example. Independent clinical review is pending. Sources checked ${esc(item.sourceCheckedOn || '2026-09-07')}.</p>
    ${item.sources.map(source => `<p><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)}</a>${ekgText(source.accessed) ? ` · accessed ${esc(source.accessed)}` : ''}</p>`).join('')}</details>`;
}
async function renderEKG(tab = 'library', opts = {}) {
  const requestedView = ++MED_VIEW;
  if (typeof stopTimer === 'function') stopTimer();
  if (typeof session !== 'undefined') session = null;
  let requestedUrl = location.pathname + location.search;
  try {
    await loadEkg();
    if (
      StudyStorage.paused ||
      MED_VIEW !== requestedView ||
      location.pathname !== '/medicine' ||
      location.pathname + location.search !== requestedUrl
    )
      return;
    tab = tab === 'drill' ? 'drill' : 'library';
    const query = new URLSearchParams(location.search);
    const id = opts.record || (query.get('mode') === 'drill' ? query.get('record') : null);
    if (id && !EKG_PROG.records[id]) throw Error('This saved ECG exercise is not available in the active workspace');
    if (id) EKG_PROG.active = id;
    const record = tab === 'drill' ? EKG_PROG.records[EKG_PROG.active] || newEkgRecord() : null;
    if ((tab === 'drill' && !record) || !saveEkgProg()) return;
    ekgRoute(tab, tab === 'drill' ? { record: record.id } : { focus: opts.focus });
    requestedUrl = location.pathname + location.search;
    const stats = ekgHubStats(),
      root = el('<div></div>');
    root.appendChild(topbar('reference'));
    const main = el(`<main class="panel ecg-workspace"><button class="ghostbtn" id="ekgback">← Medicine</button>
      <div class="hero"><span class="label">Measurement and interpretation</span><h1>ECG patterns.</h1>
      <p class="sub">${stats.reviewed}/${stats.total} library entries marked reviewed · ${stats.explanations} explanation exercise${stats.explanations === 1 ? '' : 's'} completed.</p>
      <p>Original synthetic examples with readable measurements. Describe what is present, explain it, then state what the strip cannot establish.</p>
      <p>Adult reference limits used in this lab: PR 120–200 ms, QRS under 120 ms, QTc roughly 350–450 ms. Each pattern states its own modeled values separately.</p>
      <p class="course-caption">Independent clinical review is pending. These are educational examples, with one schematic projection and deliberately simplified shapes.</p></div>
      <div class="tabs"><button class="tab ${tab === 'library' ? 'active' : ''}" data-tab="library">Pattern library</button>
      <button class="tab ${tab === 'drill' ? 'active' : ''}" data-tab="drill">Explanation practice</button></div><div id="ekgbody"></div></main>`);
    main.querySelector('#ekgback').onclick = medicineHome;
    main.querySelectorAll('[data-tab]').forEach(button => (button.onclick = () => renderEKG(button.dataset.tab)));
    if (tab === 'library') buildEkgLibrary(main.querySelector('#ekgbody'), opts.focus);
    else buildEkgDrill(main.querySelector('#ekgbody'), record);
    root.appendChild(main);
    setView(root);
    const focusId = opts.returnFocus || opts.focus;
    const target =
      tab === 'library' && ECGTrace.kinds.includes(focusId)
        ? main.querySelector(`[data-pattern="${focusId}"]`)
        : opts.feedback
          ? main.querySelector('#ekgfeedback')
          : null;
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start' });
    }
  } catch (error) {
    if (
      MED_VIEW !== requestedView ||
      location.pathname !== '/medicine' ||
      location.pathname + location.search !== requestedUrl
    )
      return;
    const root = el('<div></div>');
    root.appendChild(topbar('reference'));
    const main =
      el(`<main class="panel"><h1>ECG study could not open.</h1><p>${esc(error.message)}</p><p>Your saved exercises have been kept.</p>
      <button class="btn" id="ekgretry">Retry</button><button class="btn" id="ekghome">Medicine home</button></main>`);
    main.querySelector('#ekgretry').onclick = () => renderEKG(tab, opts);
    main.querySelector('#ekghome').onclick = medicineHome;
    root.appendChild(main);
    setView(root);
  }
}
function buildEkgLibrary(body, focus) {
  body.appendChild(
    el(
      '<p class="course-caption">Open a pattern to inspect its trace. “Marked reviewed” records a reading action, not an interpretation assessment.</p>'
    )
  );
  const list = el('<div class="ekglist"></div>');
  EKG_DATA.patterns.forEach(item => {
    const open = item.id === focus,
      done = ekgReviewedSet().has(item.id);
    const card =
      el(`<section class="ekgitem ${open ? 'open' : ''}"><button class="ekghead" data-pattern="${item.id}" aria-expanded="${open}">
      <span><span class="ekgname">${esc(item.name)}</span> <span class="ekgcat">${esc(item.cat)}</span>${done ? ' · Marked reviewed' : ''}</span><span aria-hidden="true">${open ? '−' : '+'}</span></button>
      ${
        open
          ? `<div class="ekgdetail">${ECGTrace.markup(ECGTrace.create(item.id))}<p><strong>Modeled timing:</strong> ${esc(item.rate)}${/^(?:About )?\d/.test(item.rate) ? ' per minute' : ''}.</p>
      <h2>Interpretation</h2><p>${esc(item.clue)}</p><h2>What remains uncertain</h2><p>${esc(item.limits)}</p><h2>Connect the mechanism</h2><p>${esc(item.prompt)}</p>${ekgSources(item)}
      ${done ? '' : '<button class="btn" id="ekgmark">Mark this entry reviewed</button>'}</div>`
          : ''
      }</section>`);
    card.querySelector('[data-pattern]').onclick = () =>
      renderEKG('library', { focus: open ? null : item.id, returnFocus: item.id });
    const button = card.querySelector('#ekgmark');
    if (button)
      button.onclick = () => {
        if (markEkgReviewed(item.id)) renderEKG('library', { focus: item.id });
      };
    list.appendChild(card);
  });
  body.appendChild(list);
}
function buildEkgDrill(body, record) {
  const answered = record.selected !== null,
    complete = !!record.completedAt,
    item = record.content;
  const chosen = record.options.find(option => option.id === record.selected);
  const card =
    el(`<section class="academy-lesson"><span class="label">${complete ? 'Saved completed exercise' : answered ? 'Compare your reasoning' : 'Observe, measure, explain'}</span>
    ${ECGTrace.markup(record.trace)}
    ${
      answered
        ? `<h2 id="ekgfeedback" tabindex="-1">${esc(item.name)}</h2><p><strong>First choice:</strong> ${esc(chosen.name)} · ${record.selected === item.id ? 'Matched the authored pattern' : 'Review the distinction'}</p>
      ${record.selected !== item.id && chosen.features ? `<p><strong>Compare with your selected library example:</strong> ${esc(chosen.features)} Recheck those features against the measurements of the displayed trace.</p>` : ''}
      <h3>Your explanation before feedback</h3><p class="academy-written-work">${esc(record.firstExplanation)}</p><h3>Authored interpretation</h3><p>${esc(item.clue)}</p><p>${esc(item.limits)}</p><p>${esc(item.prompt)}</p>
      <label for="ekgcomparison">Compare your reasoning: what agrees, what would you change, and what remains uncertain?</label><textarea id="ekgcomparison" rows="5" maxlength="12000" ${complete ? 'readonly' : ''}>${esc(record.comparison)}</textarea>
      <p>Writing is saved without an automated correctness score.</p>${ekgSources(item)}
      ${complete ? `<p>Completed ${esc(new Date(record.completedAt).toLocaleString())}. Reviewing preserves the original answer and time.</p>` : '<button class="btn btn-solid" id="ekgfinish">Save comparison and finish</button>'}`
        : `<h2>Which pattern best fits?</h2><label for="ekgreason">First explain your observations: timing, QRS width, atrial relationship and one limit of this strip.</label>
      <textarea id="ekgreason" rows="5" maxlength="12000">${esc(record.draft)}</textarea><p>Write your reasoning before choosing. Your first choice and explanation are kept.</p>
      <div class="academy-check-options">${record.options.map(option => `<button class="btn" data-pick="${option.id}">${esc(option.name)}</button>`).join('')}</div>`
    }
    <div class="ecg-next-options"><label for="ekgcategory">Category for the next new exercise</label><select id="ekgcategory">
      ${['all', ...new Set(EKG_DATA.patterns.map(pattern => pattern.cat))].map(cat => `<option value="${esc(cat)}" ${cat === EKG_PROG.category ? 'selected' : ''}>${cat === 'all' ? 'All patterns' : esc(cat)}</option>`).join('')}</select>
      ${complete ? '<button class="btn" id="ekgnext">Start another exercise</button>' : '<p>Your current exercise stays saved while you study elsewhere.</p>'}</div></section>`);
  const input = card.querySelector('#ekgreason'),
    buttons = card.querySelectorAll('[data-pick]');
  const updateChoices = () =>
    buttons.forEach(button => {
      button.disabled = !ekgText(record.draft) || StudyStorage.paused;
    });
  if (input) {
    input.oninput = () => {
      record.draft = input.value;
      saveEkgProg();
      updateChoices();
    };
    updateChoices();
  }
  buttons.forEach(
    button =>
      (button.onclick = () => {
        if (answerEkg(record, button.dataset.pick)) renderEKG('drill', { record: record.id, feedback: true });
      })
  );
  const comparison = card.querySelector('#ekgcomparison'),
    finish = card.querySelector('#ekgfinish');
  if (finish) {
    finish.disabled = !ekgText(record.comparison);
    comparison.oninput = () => {
      record.comparison = comparison.value;
      saveEkgProg();
      finish.disabled = !ekgText(record.comparison) || StudyStorage.paused;
    };
    finish.onclick = () => {
      if (completeEkg(record)) renderEKG('drill', { record: record.id });
    };
  }
  card.querySelector('#ekgcategory').onchange = event => {
    if (StudyStorage.paused) return;
    EKG_PROG.category = event.target.value;
    saveEkgProg();
  };
  const next = card.querySelector('#ekgnext');
  if (next)
    next.onclick = () => {
      const created = newEkgRecord();
      if (created) renderEKG('drill', { record: created.id });
    };
  body.appendChild(card);
  const records = Object.values(EKG_PROG.records).sort((a, b) => b.startedAt - a.startedAt);
  const history =
    el(`<details class="ecg-history"><summary>Saved exercises (${records.length}) and earlier drill totals</summary>
    <p>All drill first choices, including earlier sessions: ${EKG_PROG.drill.correct}/${EKG_PROG.drill.total} matched the expected answer. Earlier aggregate totals have no saved explanation attached.</p>
    <ul>${records.map(saved => `<li><button class="btn" data-record="${esc(saved.id)}">${esc(new Date(saved.startedAt).toLocaleString())} · ${saved.completedAt ? 'Completed' : 'Continue'}${saved.selected !== null ? ' · ' + esc(saved.content.name) : ''}</button></li>`).join('')}</ul></details>`);
  history
    .querySelectorAll('[data-record]')
    .forEach(button => (button.onclick = () => renderEKG('drill', { record: button.dataset.record })));
  body.appendChild(history);
}
window.addEventListener('study-storage-recovered', () => {
  const params = new URLSearchParams(location.search);
  if (location.pathname === '/medicine' && params.get('tool') === 'ecg')
    renderEKG(params.get('mode'), { record: params.get('record'), focus: params.get('focus') });
});
window.ekgHubStats = ekgHubStats;
