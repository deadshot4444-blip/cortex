/* Private, explicit selection with a reviewable export. No sharing service or auto-selection. */
window.AcademyPortfolio = (() => {
  const Core = AcademyPortfolioCore;
  let state = null,
    generation = 0;
  function load() {
    if (state) return;
    const saved = StudyStorage.read(Core.KEY, Core.empty());
    try {
      Core.validate(saved);
      state = saved;
      StudyStorage.watch(Core.KEY, () => state);
    } catch (error) {
      StudyStorage.sessionFailed();
      throw error;
    }
  }
  function access() {
    if (StudyStorage.paused)
      throw Error(
        'Resolve the saved-work problem before changing or exporting the portfolio. Your copies remain available in recovery.'
      );
    if (!window.CortexAccount?.available)
      throw Error('The active workspace is not ready. Reload after signing in or continuing as a guest.');
    const data = CortexAccount.snapshot().data;
    const actual = data[Core.KEY] == null ? Core.empty() : JSON.parse(data[Core.KEY]);
    if (state && JSON.stringify(actual) !== JSON.stringify(state))
      throw Error('Your portfolio changed in another tab. Reload to inspect the current copy.');
    return data;
  }
  function save() {
    Core.validate(state);
    return StudyStorage.write(Core.KEY, state);
  }
  function render(track = 'all') {
    const current = ++generation,
      root = el('<div></div>');
    root.appendChild(topbar('academy'));
    const main =
      el(`<main class="panel academy-shell academy-portfolio"><div class="academy-intro"><span class="label">Your private portfolio</span><h1>Keep work you want to revisit.</h1>
      <p>Choose saved work from across the Academy. Each addition keeps a fixed copy; later portfolio reflections remain separate. Private here means there is no public page. If you use an account, these saved entries sync with your study workspace.</p>
      <p>Lesson participation and practice checks are not accreditation or clinical credentials. Recorded assistance describes in-app events; help received elsewhere may be unknown.</p></div>
      <p id="portfolio-status" role="status"></p><div id="portfolio-body"></div><p><a href="${esc(sectionUrl('academy'))}">Return to the Academy</a></p></main>`);
    root.appendChild(main);
    setView(root);
    const active = () => current === generation && main.isConnected;
    const status = message => {
      if (active()) main.querySelector('#portfolio-status').textContent = message;
    };
    const action = fn => {
      if (!active()) return;
      try {
        access();
        fn();
      } catch (error) {
        status(error.message);
      }
    };
    let candidates;
    try {
      load();
      candidates = Core.candidates(access());
    } catch (error) {
      status(error.message);
      return;
    }
    const selected = new Set(),
      host = main.querySelector('#portfolio-body');
    const known = new Map(state.entries.map(e => [e.id, e]));
    const available = candidates.items.filter(c => !known.has(c.id));
    host.innerHTML = `<section aria-labelledby="portfolio-add-title"><h2 id="portfolio-add-title">Choose from saved work</h2>
      <p>Add only the entries you want here. Earlier records without saved wording keep that limitation. Unfinished activities are labeled as drafts. Nothing is selected for export automatically.</p>
      <label for="portfolio-track">Course</label><select id="portfolio-track"><option value="all">All courses</option>${Core.TRACKS.filter(
        id => CortexAcademy.tracks.some(track => track.id === id)
      )
        .map(id => `<option value="${id}">${esc(CortexAcademy.tracks.find(t => t.id === id)?.name || id)}</option>`)
        .join('')}</select>
      <div id="portfolio-candidates"></div><p>${available.length ? '' : 'No additional saved entries are available. Complete or write in a supported lesson, case or project, then return here.'}</p>
      <details ${candidates.unavailable.length ? '' : 'hidden'}><summary>Records that could not be summarized</summary><ul>${candidates.unavailable.map(message => `<li>${esc(message)}</li>`).join('')}</ul></details></section>
      <section aria-labelledby="portfolio-kept-title"><h2 id="portfolio-kept-title">Your selected work</h2><p>Hide keeps a recoverable portfolio copy. The course record is never changed.</p><div id="portfolio-entries"></div>
      <button class="btn btn-solid" id="portfolio-prepare" disabled>Preview selected export</button><div id="portfolio-preview"></div></section>`;
    function drawCandidates() {
      const track = host.querySelector('#portfolio-track').value;
      host.querySelector('#portfolio-candidates').innerHTML = available
        .filter(c => track === 'all' || c.track === track)
        .map(
          c =>
            `<article class="portfolio-source"><h3>${esc(c.title)}</h3><p>${esc(c.kind)} · ${c.provenance.completedAt === null ? 'In progress or completion unrecorded' : 'Participation completion recorded'}</p><p>${c.evidence.length} recorded fields · ${esc(c.provenance.contentSnapshot)}</p><details><summary>Inspect the saved work before adding</summary>${evidenceMarkup(c)}</details><button class="btn" data-add="${esc(c.id)}">Keep this entry</button></article>`
        )
        .join('');
      host.querySelectorAll('[data-add]').forEach(
        button =>
          (button.onclick = () =>
            action(() => {
              const source = candidates.items.find(c => c.id === button.dataset.add);
              const latest = Core.candidates(access()).items.find(c => c.id === source.id);
              if (JSON.stringify(latest) !== JSON.stringify(source))
                throw Error(
                  'The source changed since you opened it. Reopen the portfolio to inspect its latest wording.'
                );
              if (Core.add(state, source) && save()) render(host.querySelector('#portfolio-track').value);
            }))
      );
    }
    host.querySelector('#portfolio-track').value = Core.TRACKS.includes(track) ? track : 'all';
    host.querySelector('#portfolio-track').onchange = drawCandidates;
    drawCandidates();
    const entries = host.querySelector('#portfolio-entries');
    entries.innerHTML =
      state.entries
        .map(
          (entry, index) => `<article class="portfolio-entry" data-entry="${index}"><h3>${esc(entry.source.title)}</h3>
      <p>${entry.hiddenAt === null ? 'Kept' : 'Hidden'} · snapshot added ${esc(new Date(entry.addedAt).toLocaleString())}</p>
      <details><summary>Original saved work and provenance</summary>${evidenceMarkup(entry.source)}</details>
      ${entry.revisions.map(r => `<section class="portfolio-revision"><h4>Later portfolio reflection · ${esc(new Date(r.recordedAt).toLocaleString())}</h4><pre>${esc(r.text)}</pre><p>Help: ${esc(helpLabel(r.help))}. This is a learner report, not independent review.</p></section>`).join('')}
      ${
        entry.hiddenAt === null
          ? `<label for="portfolio-draft-${index}">Add a separate reflection</label><textarea id="portfolio-draft-${index}" data-draft maxlength="6000" rows="3">${esc(entry.draft)}</textarea>
      <label for="portfolio-help-${index}">Assistance with this reflection</label><select id="portfolio-help-${index}" data-help><option value="unknown">Unspecified</option><option value="used">I used help</option><option value="none-recorded">I report no help</option></select>
      <div class="academy-lesson-nav"><button class="btn" data-revise ${entry.draft.trim() ? '' : 'disabled'}>Record reflection</button><button class="btn" data-hide>Hide entry</button></div>
      <label class="portfolio-select"><input type="checkbox" data-select> Include this entry and its recorded reflections in the export</label>`
          : '<button class="btn" data-restore>Restore entry</button>'
      }</article>`
        )
        .join('') || '<p>Your portfolio is empty. Choose a saved entry above to begin.</p>';
    entries.querySelectorAll('[data-entry]').forEach(card => {
      const entry = state.entries[Number(card.dataset.entry)];
      const input = card.querySelector('[data-draft]');
      if (input)
        input.oninput = () =>
          action(() => {
            entry.draft = input.value;
            if (save()) {
              card.querySelector('[data-revise]').disabled = !input.value.trim();
              clearPreview();
            }
          });
      card.querySelector('[data-revise]')?.addEventListener('click', () =>
        action(() => {
          if (Core.revise(entry, card.querySelector('[data-help]').value) && save())
            render(host.querySelector('#portfolio-track').value);
        })
      );
      card.querySelector('[data-hide]')?.addEventListener('click', () =>
        action(() => {
          entry.hiddenAt = Date.now();
          if (save()) render(host.querySelector('#portfolio-track').value);
        })
      );
      card.querySelector('[data-restore]')?.addEventListener('click', () =>
        action(() => {
          entry.hiddenAt = null;
          if (save()) render(host.querySelector('#portfolio-track').value);
        })
      );
      card.querySelector('[data-select]')?.addEventListener('change', event => {
        event.target.checked ? selected.add(entry.id) : selected.delete(entry.id);
        clearPreview();
        host.querySelector('#portfolio-prepare').disabled = !selected.size;
      });
    });
    function clearPreview() {
      host.querySelector('#portfolio-preview').replaceChildren();
    }
    host.querySelector('#portfolio-prepare').onclick = () =>
      action(() => {
        const file = Core.exportFile(state, [...selected]);
        const panel = el(
          '<section class="portfolio-export"><h3>Inspect the exact export</h3><p>Only the selected entries and recorded portfolio reflections are included. Unrecorded reflection drafts, account details and other study records are excluded. This unencrypted JSON file is not published or sent anywhere by Cortex.</p><pre tabindex="0" aria-label="Complete export contents"></pre><label class="portfolio-select"><input type="checkbox" data-reviewed> I reviewed these contents.</label><div class="academy-lesson-nav"><button class="btn btn-solid" data-download disabled>Download this JSON</button><button class="btn" data-cancel>Cancel</button></div></section>'
        );
        panel.querySelector('pre').textContent = file;
        panel.querySelector('[data-reviewed]').onchange = event => {
          panel.querySelector('[data-download]').disabled = !event.target.checked;
        };
        panel.querySelector('[data-cancel]').onclick = clearPreview;
        panel.querySelector('[data-download]').onclick = () =>
          action(() => {
            if (!panel.isConnected || !panel.querySelector('[data-reviewed]').checked) return;
            const url = URL.createObjectURL(new Blob([file], { type: 'application/json' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = 'cortex-selected-portfolio.json';
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            status('Download prepared for the exact preview. Check that the file reached your Downloads folder.');
          });
        host.querySelector('#portfolio-preview').replaceChildren(panel);
      });
  }
  function helpLabel(value) {
    return { used: 'reported help used', 'none-recorded': 'reported no help', unknown: 'unspecified' }[value];
  }
  function evidenceMarkup(source) {
    const p = source.provenance;
    return `<p>${esc(source.kind)} · ${esc(p.recordKey)} / ${esc(p.recordId)} · source revision ${p.revision === null ? 'unrecorded' : p.revision}</p>
      <p>${esc(p.contentSnapshot)}. ${esc(p.contentReview)}. ${esc(p.learnerReview)}.</p>
      ${source.evidence.map(e => `<section class="portfolio-evidence"><h4>${esc(e.label)} · ${esc(e.role)}</h4><pre>${esc(e.text)}</pre></section>`).join('')}`;
  }
  window.addEventListener('study-storage-recovered', () => {
    if (document.querySelector('.academy-portfolio')) render();
  });
  window.addEventListener('study-storage-paused', () => {
    const root = document.querySelector('.academy-portfolio');
    if (root) {
      root.querySelector('#portfolio-preview')?.replaceChildren();
      root.querySelectorAll('button,input,select,textarea').forEach(node => {
        node.disabled = true;
      });
    }
  });
  return { render };
})();
