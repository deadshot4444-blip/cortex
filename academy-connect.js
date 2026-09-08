/* Explicit discovery and optional practice. Loading a course never reads this queue. */
(() => {
  'use strict';
  const Core = AcademyCurriculum,
    KEY = 'cs-academy-connections-v1';
  let catalog = null,
    loading = null,
    state = null,
    generation = 0;
  const trackName = key => CortexAcademy.tracks.find(t => t.id === key)?.name || 'Academy';
  const current = () => location.pathname + location.search + location.hash;
  const params = () => new URLSearchParams(location.search);
  const back = () => Core.safeReturn(params().get('returnTo'));
  const normalClick = event => !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.button;
  const levelName = level => ({ foundation: 'Foundation', applied: 'Applied', advanced: 'Advanced' })[level];
  function academyUrl(view, values = {}) {
    const url = new URL(sectionUrl('academy'), location.origin);
    url.searchParams.set('view', view);
    for (const [key, value] of Object.entries(values)) if (value) url.searchParams.set(key, value);
    return url.pathname + url.search;
  }
  function href(entry) {
    const url = Core.destination(entry, current(), back());
    if (!url) return url;
    // A link back to the lesson the learner came from must not carry a return link to itself.
    const parsed = new URL(url, location.origin),
      key = Core.contextKey(url);
    if (key && key === Core.contextKey(parsed.searchParams.get('returnTo'))) {
      parsed.searchParams.delete('returnTo');
      return parsed.pathname + parsed.search + parsed.hash;
    }
    return url;
  }
  function courseLink(entry, label = entry.title) {
    return `<a data-connect-course="${esc(entry.track)}" href="${esc(href(entry))}">${esc(label)}</a>`;
  }
  function shell(title, description, body) {
    const root = el('<div></div>');
    root.appendChild(topbar('academy'));
    root.appendChild(
      el(
        `<main class="panel academy-shell academy-connect"><div class="academy-intro"><span class="label">Connected Academy</span><h1>${esc(title)}</h1><p>${esc(description)}</p><nav aria-label="Academy discovery"><a href="${esc(academyUrl('curriculum'))}" data-connect-view>Find a lesson</a><a href="${esc(academyUrl('queue'))}" data-connect-view>Optional retrieval</a><a href="${esc(sectionUrl('academy'))}" data-connect-view>All courses</a></nav></div>${body}</main>`
      )
    );
    return root;
  }
  function wireNavigation(root) {
    root.querySelectorAll('[data-connect-view], [data-connect-course]').forEach(
      link =>
        (link.onclick = event => {
          if (!normalClick(event)) return;
          event.preventDefault();
          history.pushState({}, '', link.getAttribute('href'));
          openSection(link.dataset.connectCourse || 'academy');
        })
    );
  }
  function show(root) {
    wireNavigation(root);
    setView(root);
  }
  async function load() {
    if (catalog) return catalog;
    if (!loading)
      loading = fetch('data/academy-curriculum.json?v=8')
        .then(response => {
          if (!response.ok) throw Error('Curriculum could not load.');
          return response.json();
        })
        .then(Core.validate)
        .then(data => (catalog = data))
        .finally(() => (loading = null));
    return loading;
  }
  function queueState() {
    if (state) return state;
    const saved = StudyStorage.read(KEY, Core.emptyState());
    if (!Core.validState(saved)) {
      StudyStorage.sessionFailed();
      state = Core.emptyState();
    } else state = saved;
    StudyStorage.watch(KEY, () => state);
    return state;
  }
  function sources(card) {
    return `<details class="connect-sources"><summary>Sources and review status</summary><p>${esc(card.reviewStatus)}</p><ul>${card.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></li>`).join('')}</ul><p>These sources support the connected teaching material. They do not constitute an independent review of this original prompt.</p></details>`;
  }
  function entryCard(entry, explanation = '') {
    const prereqs = entry.prerequisites.map(key => catalog.entries.find(e => e.id === key));
    const track = CortexAcademy.tracks.find(t => t.id === entry.track);
    return `<article class="academy-course"><p class="connect-meta">${esc(trackName(entry.track))} · ${esc(entry.kind)} · ${levelName(entry.level)} · ${entry.status === 'draft' ? 'Draft' : 'Author revised'}${CortexAcademy.status ? ' · ' + esc(CortexAcademy.status(track)) : ''}</p><h3>${courseLink(entry)}</h3><p>${esc(entry.summary)}</p>${explanation}
      ${entry.track === 'practice' ? '<p class="connect-caution">Opens the case teaching focus, which may reveal the target of a blind encounter.</p>' : ''}
      ${prereqs.length ? `<details><summary>Suggested preparation (${prereqs.length})</summary><p>These are the course’s recommended earlier steps. This catalog does not check or award readiness.</p><ul>${prereqs.map(p => `<li>${courseLink(p)}${p.status === 'draft' ? ' · Draft' : ''}</li>`).join('')}</ul></details>` : ''}
      <p class="connect-meta">${esc(entry.reviewStatus)}</p></article>`;
  }
  function discovery() {
    const p = params(),
      context = catalog.entries.find(e => e.id === p.get('context'));
    const filters = {
      q: p.get('q') || '',
      track: p.get('track') || '',
      level: p.get('level') || '',
      objective: p.get('objective') || '',
      drafts: p.get('scope') === 'drafts',
    };
    const results = Core.search(catalog, filters),
      matches = new Set(results.map(e => e.id));
    const pages = Math.max(1, Math.ceil(results.length / 24)),
      page = Math.min(pages, Math.max(1, Number.parseInt(p.get('page'), 10) || 1));
    const pageUrl = number => {
      const url = new URL(location.href);
      url.searchParams.set('page', String(number));
      return url.pathname + url.search;
    };
    const connections = context
      ? catalog.connections
          .filter(c => c.from === context.id || c.to === context.id)
          .map(c => ({
            entry: catalog.entries.find(e => e.id === (c.from === context.id ? c.to : c.from)),
            connection: c,
          }))
          .filter(
            (item, index, items) =>
              matches.has(item.entry.id) && items.findIndex(other => other.entry.id === item.entry.id) === index
          )
      : [];
    const cards = context ? catalog.cards.filter(c => c.links.some(e => e.id === context.id)) : [];
    const root = shell(
      'Find the next useful connection.',
      'Search public lesson descriptions and selected shared objectives. Preparation levels are author suggestions, not calibrated difficulty or a measurement of your ability.',
      `
      <form class="connect-search" id="connect-search"><label for="connect-query">Search lessons and objectives<input id="connect-query" name="q" type="search" maxlength="200" value="${esc(filters.q)}" placeholder="Try pressure, memory or measurement"></label>
      <label for="connect-track">Course<select id="connect-track" name="track"><option value="">All courses</option>${CortexAcademy.tracks.map(t => `<option value="${t.id}" ${filters.track === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
      <label for="connect-level">Preparation level<select id="connect-level" name="level"><option value="">All levels</option>${Core.levels.map(l => `<option value="${l}" ${filters.level === l ? 'selected' : ''}>${levelName(l)}</option>`).join('')}</select></label>
      <label for="connect-objective">Shared objective<select id="connect-objective" name="objective"><option value="">Any objective</option>${catalog.objectives.map(o => `<option value="${o.id}" ${filters.objective === o.id ? 'selected' : ''}>${esc(o.title)}</option>`).join('')}</select></label>
      <label class="connect-check"><input name="drafts" type="checkbox" ${filters.drafts ? 'checked' : ''}>Include the separate draft library</label><button class="btn btn-solid" type="submit">Search</button><a data-connect-view href="${esc(academyUrl('curriculum', { context: context?.id }))}">Clear filters</a></form>
      <p>Course answers and your private writing are not searched. Independent subject review remains pending. Downloaded packs include this catalog; opening another course offline requires that course’s pack.</p>
      ${
        context
          ? `<section><h2>Connected to: ${esc(context.title)}</h2><p>${esc(context.summary)}</p><p>These optional links explain a teaching connection. They do not add tasks, change a plan or complete either course. ${courseLink(context, 'Stay with this lesson')}</p>
        <div class="academy-catalog">${connections.map(({ entry, connection }) => entryCard(entry, `<p><b>${esc(connection.relation)}:</b> ${esc(connection.why)}</p><p><b>Limit:</b> ${esc(connection.limits)}</p>`)).join('') || '<p>No selected connections match these filters. Clear filters or continue your course.</p>'}</div>
        ${cards.length ? `<p>Related optional retrieval: ${cards.map(c => `<a data-connect-view href="${esc(academyUrl('queue', { card: c.id }))}">${esc(c.title)}</a>`).join(' · ')}. Opening a prompt does not add it to your queue.</p>` : ''}</section>`
          : p.get('context')
            ? '<p role="status">That lesson is not in the current index. Your return link and general search remain available.</p>'
            : ''
      }
      <section><h2>${results.length} matching ${results.length === 1 ? 'entry' : 'entries'}</h2>${
        results.length
          ? `<p>Page ${page} of ${pages}</p><div class="academy-catalog">${results
              .slice((page - 1) * 24, page * 24)
              .map(e => entryCard(e))
              .join(
                ''
              )}</div><nav aria-label="Search result pages">${page > 1 ? `<a data-connect-view href="${esc(pageUrl(page - 1))}">Previous page</a>` : ''}${page < pages ? `<a data-connect-view href="${esc(pageUrl(page + 1))}">Next page</a>` : ''}</nav>`
          : '<p>No matches. Try fewer words or clear the course, level or objective filters.</p>'
      }</section>`
    );
    root.querySelector('#connect-search').onsubmit = event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      history.pushState(
        {},
        '',
        academyUrl('curriculum', {
          context: context?.id,
          q: String(form.get('q') || '').trim(),
          track: form.get('track'),
          level: form.get('level'),
          objective: form.get('objective'),
          scope: form.has('drafts') ? 'drafts' : '',
        })
      );
      render();
    };
    show(root);
  }
  function write(mutation, after = render) {
    if (StudyStorage.paused) return false;
    if (mutation() === false) return false;
    if (!StudyStorage.write(KEY, state)) return false;
    after();
    return true;
  }
  function recordUrl(record) {
    return academyUrl('queue', { run: record.id });
  }
  function queue(unavailable = false) {
    const saved = queueState(),
      p = params(),
      record = saved.records.find(r => r.id === p.get('run'));
    const cards = catalog?.cards || [],
      selected = cards.find(c => c.id === p.get('card'));
    if (record) {
      player(record);
      return;
    }
    const pending = saved.records.filter(r => !r.completedAt && r.status === 'pending');
    const root = shell(
      'Practice a connection, if it helps.',
      'Choose original written prompts that connect subjects. Each attempt keeps its own explanation and comparison. Nothing here changes a course score, lesson completion or study plan.',
      `
      <section class="academy-day-summary"><h2>Optional retrieval is ${saved.enabled ? 'on' : 'off'}</h2><p>${saved.enabled ? 'Add only the prompts you want. There is no automatic schedule or overdue count.' : 'Turn it on to add or continue a prompt. Existing work stays available to read.'}</p><button class="btn" id="connect-enable" data-connect-write>${saved.enabled ? 'Pause optional retrieval' : 'Turn on optional retrieval'}</button><p id="connect-status" role="status"></p></section>
      ${p.get('run') ? '<p role="status">That attempt is not in this workspace. Existing records are listed below.</p>' : ''}
      ${unavailable ? '<p role="status">New prompts could not load. Your saved attempts and their original content remain available below.</p><button class="btn" id="connect-retry">Try loading new prompts again</button>' : p.get('card') && !selected ? '<p role="status">That prompt is not in the current catalog. Saved attempts still use their original content.</p>' : ''}
      <section><h2>Your queue (${pending.length})</h2>${pending.length ? `<ul class="connect-records">${pending.map(r => `<li><a data-connect-view href="${esc(recordUrl(r))}">${esc(r.content.title)}</a> · ${r.revealedAt ? 'Comparison unfinished' : r.draft ? 'Writing saved' : 'Ready to start'}<button class="btn" data-connect-move="${r.id}" data-status="deferred" data-connect-write>Set aside</button><button class="btn" data-connect-move="${r.id}" data-status="removed" data-connect-write>Remove from queue</button></li>`).join('')}</ul>` : '<p>No prompts waiting. You can keep this empty.</p>'}</section>
      <section><h2>${unavailable ? 'New prompts unavailable' : selected ? 'Selected prompt' : 'Choose a prompt'}</h2><div class="academy-catalog">${(selected
        ? [selected]
        : cards
      )
        .map(c => {
          const existing = saved.records.find(r => r.content.id === c.id && !r.completedAt && r.status !== 'removed');
          return `<article class="academy-course"><p class="connect-meta">${levelName(c.level)} · ${esc([...new Set(c.links.map(e => trackName(e.track)))].join(' / '))}</p><h3>${esc(c.title)}</h3><p>${esc(c.prompt)}</p>
          ${existing ? `<a data-connect-view href="${esc(recordUrl(existing))}">Open saved attempt${existing.status === 'deferred' ? ' (set aside)' : ''}</a>` : `<button class="btn" data-connect-add="${c.id}" data-connect-write ${saved.enabled ? '' : 'disabled'}>${saved.records.some(r => r.content.id === c.id && r.completedAt) ? 'Add a new attempt' : 'Add to my queue'}</button>`}${sources(c)}</article>`;
        })
        .join(
          ''
        )}</div>${selected ? `<p><a data-connect-view href="${esc(academyUrl('queue'))}">See all prompts and records</a></p>` : ''}</section>
      <section><h2>Completed, set aside and removed</h2><p>Removing a prompt from the queue retains its writing here. Saved content is kept even if the catalog changes.</p><ul class="connect-records">${
        saved.records
          .filter(r => r.completedAt || r.status !== 'pending')
          .slice()
          .reverse()
          .map(
            r =>
              `<li><a data-connect-view href="${esc(recordUrl(r))}">${esc(r.content.title)}</a> · ${r.completedAt ? 'Written comparison completed' : r.status === 'deferred' ? 'Set aside' : 'Removed from queue'} · ${esc(new Date(r.queuedAt).toLocaleDateString())}</li>`
          )
          .join('') || '<li>No earlier records.</li>'
      }</ul></section>`
    );
    root.querySelector('#connect-enable').onclick = () =>
      write(() => {
        saved.enabled = !saved.enabled;
        return true;
      });
    const retry = root.querySelector('#connect-retry');
    if (retry) retry.onclick = render;
    root.querySelectorAll('[data-connect-add]').forEach(
      button =>
        (button.onclick = () => {
          if (StudyStorage.paused) return;
          const card = catalog.cards.find(c => c.id === button.dataset.connectAdd);
          const run = Core.enqueue(saved, card, 'retrieval-' + crypto.randomUUID(), Date.now());
          if (!run) {
            root.querySelector('#connect-status').textContent =
              'This prompt could not be added. Turn retrieval on, or keep your existing records and download a backup if the record limit is reached.';
            return;
          }
          // Put the pending record in the URL before writing so recovery resumes it.
          history.pushState({}, '', recordUrl(run));
          if (StudyStorage.write(KEY, saved)) render();
        })
    );
    wireMoves(root);
    show(root);
    pauseControls(root);
  }
  function wireMoves(root) {
    root.querySelectorAll('[data-connect-move]').forEach(
      button =>
        (button.onclick = () => {
          if (!write(() => Core.move(state, button.dataset.connectMove, button.dataset.status))) {
            const message = root.querySelector('#connect-status');
            if (message && !StudyStorage.paused)
              message.textContent =
                'Another unfinished attempt for this prompt is already in the queue. Open that attempt first.';
          }
        })
    );
  }
  function player(record) {
    const card = record.content,
      revealed = record.revealedAt != null;
    const canEdit = state.enabled && record.status === 'pending' && !record.completedAt;
    const root = shell(
      card.title,
      'This original cross-course prompt uses a frozen copy of the content saved when you added it.',
      `
      <p><a data-connect-view href="${esc(academyUrl('queue'))}">Back to optional retrieval</a> · ${record.completedAt ? 'Written comparison completed' : record.status === 'deferred' ? 'Set aside' : record.status === 'removed' ? 'Removed from queue' : 'In your queue'} · revision ${card.revision}</p>
      ${!state.enabled ? '<p>Optional retrieval is paused. Turn it on from the queue to continue writing.</p>' : ''}
      <section class="academy-day-summary"><h2>Explain before checking</h2><p>${esc(card.prompt)}</p>
      <label for="connect-draft">${revealed ? 'Your first explanation (kept unchanged)' : 'Your explanation'}<textarea id="connect-draft" maxlength="6000" rows="7" ${!canEdit || revealed ? 'readonly' : ''}>${esc(revealed ? record.firstDraft : record.draft)}</textarea></label>
      ${!revealed ? `<button class="btn btn-solid" id="connect-reveal" data-connect-write ${canEdit ? '' : 'disabled'}>Keep my explanation and show the model</button>` : ''}<p id="connect-status" role="status"></p></section>
      ${revealed ? `<section class="academy-day-summary"><h2>Compare your reasoning</h2><p>${esc(card.model)}</p><p>${esc(card.compare)}</p><label for="connect-comparison">Your comparison<textarea id="connect-comparison" maxlength="6000" rows="6" ${canEdit ? '' : 'readonly'}>${esc(record.comparison)}</textarea></label>${record.completedAt ? '<p>Comparison saved. This records the activity you completed; it does not grade your explanation or award course credit.</p>' : `<button class="btn btn-solid" id="connect-complete" data-connect-write ${canEdit ? '' : 'disabled'}>Save completed comparison</button>`}</section>` : ''}
      ${!record.completedAt ? `<div class="connect-actions">${record.status === 'pending' ? `<button class="btn" data-connect-move="${record.id}" data-status="deferred" data-connect-write>Set aside</button><button class="btn" data-connect-move="${record.id}" data-status="removed" data-connect-write>Remove from queue</button>` : `<button class="btn" data-connect-move="${record.id}" data-status="pending" data-connect-write>Return to queue</button>`}</div>` : ''}
      <details><summary>Connected lessons (opening one can provide help)</summary><ul>${card.links.map(entry => `<li>${courseLink(entry)} · ${esc(trackName(entry.track))}${entry.track === 'practice' ? ' · Opens the case teaching focus and can reveal its target.' : ''}</li>`).join('')}</ul><p>Each course keeps its own record. Returning here preserves this attempt.</p></details>${sources(card)}`
    );
    const status = root.querySelector('#connect-status');
    const draft = root.querySelector('#connect-draft'),
      comparison = root.querySelector('#connect-comparison');
    const input = (node, field) => {
      if (node && canEdit && !(field === 'draft' && revealed))
        node.oninput = () => {
          write(
            () => Core.edit(state, record.id, field, node.value),
            () => (status.textContent = 'Writing saved in this workspace.')
          );
        };
    };
    input(draft, 'draft');
    input(comparison, 'comparison');
    const revealButton = root.querySelector('#connect-reveal');
    if (revealButton)
      revealButton.onclick = () => {
        if (!draft.value.trim()) {
          status.textContent = 'Write your own explanation before showing the model.';
          draft.focus();
          return;
        }
        write(() => Core.reveal(state, record.id, Date.now()));
      };
    const completeButton = root.querySelector('#connect-complete');
    if (completeButton)
      completeButton.onclick = () => {
        if (!comparison.value.trim()) {
          status.textContent = 'Write what matched, changed or still needs work before completing this comparison.';
          comparison.focus();
          return;
        }
        write(() => Core.complete(state, record.id, Date.now()));
      };
    // A side trip from this prompt returns to this attempt, unless an earlier
    // course already established the return destination.
    root.querySelectorAll('[data-connect-course]').forEach(link => {
      const url = new URL(link.getAttribute('href'), location.origin);
      if (!url.searchParams.get('returnTo')) url.searchParams.set('returnTo', Core.safeReturn(current()));
      link.setAttribute('href', url.pathname + url.search + url.hash);
    });
    wireMoves(root);
    show(root);
    pauseControls(root);
  }
  function pauseControls(root) {
    if (!StudyStorage.paused) return;
    root.querySelectorAll('[data-connect-write]').forEach(button => (button.disabled = true));
    root.querySelectorAll('textarea').forEach(input => (input.readOnly = true));
  }
  async function render() {
    const token = ++generation,
      address = current();
    if (params().get('view') !== 'curriculum' && params().get('view') !== 'queue') return;
    // Saved prompts include their full content and must not depend on the catalog.
    if (params().get('view') === 'queue') {
      const record = queueState().records.find(r => r.id === params().get('run'));
      if (record) {
        player(record);
        return;
      }
    }
    if (!catalog)
      show(
        shell(
          'Loading the curriculum…',
          'Your course work stays saved while the public catalog loads.',
          '<p role="status">Loading lesson descriptions.</p>'
        )
      );
    try {
      await load();
      if (token !== generation || address !== current()) return;
      if (params().get('view') === 'queue') queue();
      else discovery();
    } catch {
      if (token !== generation || address !== current()) return;
      if (params().get('view') === 'queue') {
        queue(true);
        return;
      }
      const root = shell(
        'The curriculum could not load.',
        'Your saved work has not been cleared. Try the catalog again when its course files are available.',
        '<button class="btn" id="connect-retry">Try again</button>'
      );
      root.querySelector('#connect-retry').onclick = render;
      show(root);
    }
  }
  function attach(root) {
    const main = root.querySelector('main');
    if (!main || root.querySelector('.connect-return')) return;
    const returnTo = back(),
      context = Core.contextKey(current());
    if (returnTo) {
      const target = new URL(returnTo, location.origin),
        track = Object.keys(Core.paths).find(key => Core.paths[key] === target.pathname);
      const here = new URL(location.href);
      here.searchParams.delete('returnTo');
      main.prepend(
        el(
          `<aside class="connect-return" aria-label="Return to your starting point"><a href="${esc(returnTo)}">Return to ${esc(trackName(track))}</a><span>Your course records stay separate.</span><a href="${esc(here.pathname + here.search + here.hash)}">End this return link</a></aside>`
        )
      );
    }
    if (context) {
      const url = new URL(academyUrl('curriculum', { context }), location.origin);
      const destination = returnTo || Core.safeReturn(current());
      if (destination) url.searchParams.set('returnTo', destination);
      main.appendChild(
        el(
          `<aside class="connect-context"><a href="${esc(url.pathname + url.search)}">Explore related lessons</a><p>Optional connections with a return link to your starting point.</p></aside>`
        )
      );
    }
  }
  window.addEventListener('study-storage-paused', () => {
    const root = document.querySelector('.academy-connect');
    if (root) pauseControls(root);
  });
  window.addEventListener('study-storage-recovered', () => {
    if (location.pathname === '/academy' && params().get('view') === 'queue') render();
  });
  window.AcademyConnect = Object.freeze({ render, attach });
})();
