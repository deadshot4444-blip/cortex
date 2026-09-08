/* Local item review and private concern drafts. No analytics upload or auto-retirement. */
window.McatItemQuality = (() => {
  const Core = McatItemQualityCore;
  const labels = {
    sourceRows: 'Source response records',
    malformedRows: 'Malformed response records excluded',
    unfinishedWorkExcluded: 'Unfinished workshops excluded',
    legacyLogAtLimit: 'Older practice log has reached its retention limit',
    duplicateRows: 'Exact duplicate records excluded',
    conflictingEventIds: 'Conflicting response identities excluded',
    unknownEventIds: 'Records without a stable response identity',
    missingSnapshot: 'Records without complete original wording',
    missingChoice: 'Records without a saved choice',
    knownUnanswered: 'Explicitly unanswered records',
    invalidChoice: 'Invalid choice records excluded',
    missingTimestamp: 'Records without a valid time',
    futureTimestamp: 'Future-dated records excluded',
    inconsistentOutcome: 'Outcomes inconsistent with the saved key',
    unknownExposure: 'Records with unknown prior exposure',
    unknownSupport: 'Records with unknown support',
    scannedRows: 'Nonconflicting records examined',
    retainedRows: 'Records retained in the summary',
  };
  const conditions = {
    'first-recorded-in-this-lesson': 'first answer retained in this lesson; earlier exposure elsewhere unknown',
    'repeat-recorded': 'earlier exposure recorded',
    'no-prior-record-or-self-report': 'no prior exposure in the retained record or self-report',
    unknown: 'unknown',
    'recorded-help': 'help recorded',
    'no-in-app-help-recorded': 'no in-app help recorded; outside help unknown',
    'setup-feedback-only': 'setup feedback shown; no additional help recorded',
  };
  let state = null,
    generation = 0;
  function valid(value) {
    return (
      value?.version === 1 &&
      Array.isArray(value.reports) &&
      new Set(value.reports.map(r => r.id)).size === value.reports.length &&
      value.drafts &&
      typeof value.drafts === 'object' &&
      !Array.isArray(value.drafts) &&
      Object.values(value.drafts).every(x => typeof x === 'string' && x.length <= 6000) &&
      value.reports.every(
        r =>
          r &&
          /^[\w:.-]{1,180}$/.test(r.id) &&
          Number.isFinite(r.createdAt) &&
          r.status === 'unreviewed learner concern' &&
          r.resolution === null &&
          typeof r.note === 'string' &&
          r.note.trim() &&
          r.note.length <= 6000 &&
          r.item &&
          /^[a-f0-9]{64}$/.test(r.item.version) &&
          Core.question(r.item.question) &&
          ['family', 'itemId', 'condition', 'exposure', 'support'].every(key => typeof r.item[key] === 'string')
      )
    );
  }
  function currentData() {
    if (StudyStorage.paused) throw Error('Resolve the saved-work problem before preparing this review.');
    if (!window.CortexAccount?.available)
      throw Error('The active study workspace is not ready. Reload after account setup finishes.');
    const data = CortexAccount.snapshot().data;
    if (
      state &&
      JSON.stringify(data[Core.KEY] ? JSON.parse(data[Core.KEY]) : { version: 1, reports: [], drafts: {} }) !==
        JSON.stringify(state)
    )
      throw Error('Item reports changed in another tab. Reload to inspect the current copy.');
    return data;
  }
  const sourceCopy = data => Object.fromEntries(Core.SOURCES.map(key => [key, data[key] ?? null]));
  function save() {
    if (!valid(state)) throw Error('The item report could not be saved.');
    return StudyStorage.write(Core.KEY, state);
  }
  async function render() {
    const current = ++generation,
      root = el('<div></div>');
    root.appendChild(topbar('mcat'));
    const main =
      el(`<main class="panel academy-shell mcat-quality"><div class="academy-intro"><span class="label">MCAT practice quality</span><h1>Inspect the evidence behind a question.</h1>
      <p>Review this workspace’s retained responses and keep a concern about ambiguous wording. Reports remain private study records and sync if you use an account. Nothing here sends a report to Cortex.</p>
      <p>These are descriptive records from one workspace. The number of distinct learners and a consented research sample are unknown. No item difficulty calibration, score prediction or learning-effect claim is made.</p></div>
      <p id="quality-status" role="status">Reading saved item records…</p><div id="quality-body"></div><p><a href="${esc(sectionUrl('mcat'))}">Return to MCAT</a></p></main>`);
    root.appendChild(main);
    setView(root);
    const active = () => current === generation && main.isConnected;
    const status = message => {
      if (active()) main.querySelector('#quality-status').textContent = message;
    };
    let summary, baseline;
    try {
      if (!state) {
        const value = StudyStorage.read(Core.KEY, { version: 1, reports: [], drafts: {} });
        if (!valid(value)) {
          StudyStorage.sessionFailed();
          throw Error('Saved item reports need recovery. Their original copy was retained.');
        }
        state = value;
        StudyStorage.watch(Core.KEY, () => state);
      }
      baseline = sourceCopy(currentData());
      for (const report of state.reports)
        if (
          (await Core.digest({
            question: Core.question(report.item.question),
            context: Core.savedContext(report.item.context),
          })) !== report.item.version
        ) {
          StudyStorage.sessionFailed();
          throw Error(
            'A saved item concern no longer matches its original wording fingerprint. Keep its recovery copy.'
          );
        }
      summary = await Core.analyze(baseline);
      if (!active()) return;
      if (JSON.stringify(baseline) !== JSON.stringify(sourceCopy(currentData())))
        throw Error('Study responses changed while this summary was being prepared. Reopen it to use current data.');
    } catch (error) {
      status(error.message);
      return;
    }
    const action = fn => {
      if (!active()) return;
      try {
        currentData();
        if (JSON.stringify(baseline) !== JSON.stringify(sourceCopy(currentData())))
          throw Error('Study responses changed. Reopen this page before saving a concern or exporting the summary.');
        fn();
      } catch (error) {
        status(error.message);
      }
    };
    const host = main.querySelector('#quality-body'),
      quality = summary.quality;
    host.innerHTML = `<section><h2>What these records can support</h2><p>Readable sources: ${quality.sourceRows} response records · ${quality.retainedRows} retained response records · ${summary.groups.length} item/version/condition groups. Known unanswered records: ${quality.knownUnanswered}. Unreadable sources are listed below; their unknown row counts are not included.</p>
      <details><summary>Data quality and missingness</summary><p>Checks examine ${quality.scannedRows} deduplicated, nonconflicting records. Counts can overlap; rejected records are excluded from item rates.</p><dl class="quality-profile">${Object.entries(
        quality
      )
        .map(
          ([key, value]) =>
            `<div><dt>${esc(labels[key] || key)}</dt><dd>${typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}</dd></div>`
        )
        .join('')}</dl>
      ${summary.issues.map(message => `<p>${esc(message)}</p>`).join('')}<ul>${summary.limits.map(message => `<li>${esc(message)}</li>`).join('')}</ul></details>
      <label for="quality-family">Activity</label><select id="quality-family"><option value="all">All recorded activity</option><option value="course">Course applications</option><option value="coach">Completed passage workshops</option><option value="math">Math tasks</option><option value="practice-log">Older practice log</option></select></section>
      <section><h2>Recorded item versions</h2><div id="quality-items"></div></section>
      <section><h2>Your unreviewed concerns</h2><p>A concern is a request for review, not a finding that the question is defective. No reviewer or resolution is assigned automatically.</p><div id="quality-reports"></div>
      <button class="btn" id="quality-export">Preview a review file</button><div id="quality-preview"></div></section>`;
    const clearPreview = () => host.querySelector('#quality-preview').replaceChildren();
    const rate = group =>
      group.n
        ? `${group.correct}/${group.n} correct retained records (${((100 * group.correct) / group.n).toFixed(1)}%)`
        : 'No retained records';
    function draw() {
      const family = host.querySelector('#quality-family').value,
        groups = summary.groups.filter(g => family === 'all' || g.family === family);
      host.querySelector('#quality-items').innerHTML =
        groups
          .map(
            g => `<article class="quality-item"><h3>${esc(g.itemId)} · ${esc(g.condition)}</h3><p>${rate(g)}</p><p>Exposure: ${esc(conditions[g.exposure])} · support: ${esc(conditions[g.support])}</p>
        <p>Missing choices: ${g.missingChoice}/${g.n} · missing times: ${g.missingTimestamp}/${g.n} · known omissions: ${g.knownUnanswered}/${g.n} · later supported checks: ${g.laterSupportRecorded}/${g.n}.</p>
        ${g.measurement === 'combined-math' ? `<p>Setup: ${g.setup.correct}/${g.setup.n} recorded correct; calculation: ${g.calculation.correct}/${g.calculation.n}. The overall result requires both. Setup feedback is shown before calculation.</p>` : ''}
        ${
          g.question
            ? `<details><summary>Inspect the saved question and distractor choices</summary><p>${esc(g.question.stem)}</p>${g.context ? `<pre>${esc(JSON.stringify(g.context, null, 2))}</pre>` : ''}
          <ul>${g.choices.map(c => `<li>${esc(c.text)} · ${c.n}/${g.n} retained records chose this option${c.index === g.question.answer ? ' · saved key' : ''}.</li>`).join('')}</ul><p>${esc(g.question.explanation)}</p><p class="quality-digest">Revision fingerprint: ${g.version}</p></details>
          <details><summary>Keep a concern about this wording</summary><label>Describe the ambiguity or possible error<textarea data-note="${esc(g.key)}" maxlength="6000" rows="3">${esc(state.drafts[g.key] || '')}</textarea></label><button class="btn" data-report="${esc(g.key)}" ${(state.drafts[g.key] || '').trim() ? '' : 'disabled'}>Save private concern</button></details>`
            : '<p>Original wording and distractor choices are unavailable. This older record cannot identify a specific authored revision.</p>'
        }</article>`
          )
          .join('') ||
        '<p>No supported saved responses are available for this activity yet. No sample data or learner outcomes have been invented.</p>';
      host.querySelectorAll('[data-note]').forEach(
        input =>
          (input.oninput = () =>
            action(() => {
              state.drafts[input.dataset.note] = input.value;
              if (save()) {
                const button = [...host.querySelectorAll('[data-report]')].find(
                  b => b.dataset.report === input.dataset.note
                );
                button.disabled = !input.value.trim();
                clearPreview();
              }
            }))
      );
      host.querySelectorAll('[data-report]').forEach(
        button =>
          (button.onclick = () =>
            action(() => {
              const group = summary.groups.find(g => g.key === button.dataset.report),
                note = state.drafts[group.key];
              state.reports.push(Core.report(group, note, Date.now() + '-' + Math.random().toString(36).slice(2, 8)));
              delete state.drafts[group.key];
              if (save()) render();
            }))
      );
    }
    host.querySelector('#quality-family').onchange = () => {
      clearPreview();
      draw();
    };
    draw();
    host.querySelector('#quality-reports').innerHTML =
      state.reports
        .map(
          report =>
            `<article class="quality-item"><h3>${esc(report.item.itemId)}</h3><p>${esc(report.status)} · ${esc(new Date(report.createdAt).toLocaleString())}</p><pre>${esc(report.note)}</pre><p class="quality-digest">Version ${esc(report.item.version)}</p></article>`
        )
        .join('') || '<p>No concerns have been saved.</p>';
    host.querySelector('#quality-export').onclick = () =>
      action(() => {
        const reports = state.reports.map(r => ({
          id: r.id,
          createdAt: r.createdAt,
          status: r.status,
          note: r.note,
          item: {
            family: r.item.family,
            itemId: r.item.itemId,
            version: r.item.version,
            question: Core.question(r.item.question),
            context: Core.savedContext(r.item.context),
            condition: r.item.condition,
            exposure: r.item.exposure,
            support: r.item.support,
          },
          resolution: null,
        }));
        const file = JSON.stringify({ format: 'cortex-private-item-review', version: 1, summary, reports }, null, 2);
        const panel = el(
          '<section class="quality-export"><h3>Inspect the exact review file</h3><p>This contains the local item summary and saved concerns. It excludes account identifiers, raw workspace records and unfinished concern drafts. Downloading does not submit or publish it.</p><pre tabindex="0"></pre><label><input type="checkbox" data-reviewed> I reviewed these contents.</label><div class="academy-lesson-nav"><button class="btn btn-solid" data-download disabled>Download review JSON</button><button class="btn" data-cancel>Cancel</button></div></section>'
        );
        panel.querySelector('pre').textContent = file;
        panel.querySelector('[data-reviewed]').onchange = e => {
          panel.querySelector('[data-download]').disabled = !e.target.checked;
        };
        panel.querySelector('[data-cancel]').onclick = clearPreview;
        panel.querySelector('[data-download]').onclick = () =>
          action(() => {
            if (!panel.isConnected || !panel.querySelector('[data-reviewed]').checked) return;
            const url = URL.createObjectURL(new Blob([file], { type: 'application/json' })),
              link = document.createElement('a');
            link.href = url;
            link.download = 'cortex-private-item-review.json';
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            status('Review download prepared. No report has been submitted to Cortex.');
          });
        host.querySelector('#quality-preview').replaceChildren(panel);
      });
    status(
      'Prepared from saved records. Independent item review and an appropriate real-learner research sample remain pending.'
    );
  }
  window.addEventListener('study-storage-recovered', () => {
    if (document.querySelector('.mcat-quality')) render();
  });
  window.addEventListener('study-storage-paused', () => {
    const root = document.querySelector('.mcat-quality');
    if (root) {
      root.querySelector('#quality-preview')?.replaceChildren();
      root.querySelectorAll('input,button,textarea,select').forEach(node => {
        node.disabled = true;
      });
    }
  });
  return { render };
})();
