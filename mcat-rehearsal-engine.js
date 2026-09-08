/* Fixed original practice forms. Format, exposure and timing are separate claims. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.McatRehearsalCore = api;
})(typeof window === 'undefined' ? globalThis : window, () => {
  'use strict';
  const FORMAT = Object.freeze({
    chemPhys: { questions: 59, passages: 10, discretes: 15, minutes: 95 },
    cars: { questions: 53, passages: 9, discretes: 0, minutes: 90 },
    bioBiochem: { questions: 59, passages: 10, discretes: 15, minutes: 95 },
    psychSoc: { questions: 59, passages: 10, discretes: 15, minutes: 95 },
  });
  const ORDER = ['chemPhys', 'cars', 'bioBiochem', 'psychSoc'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9][\w:.-]{0,180}$/.test(value);
  const text = value => typeof value === 'string' && value.length > 0;
  const time = value => Number.isFinite(value) && value > 0;
  const optionOrder = value =>
    Array.isArray(value) &&
    value.length === 4 &&
    new Set(value).size === 4 &&
    value.every(i => Number.isInteger(i) && i >= 0 && i < 4);
  function question(q) {
    return (
      object(q) &&
      id(q.id) &&
      text(q.stem) &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      q.options.every(text) &&
      Number.isInteger(q.answer) &&
      q.answer >= 0 &&
      q.answer < 4 &&
      text(q.explanation) &&
      (q.displayOrder == null || optionOrder(q.displayOrder))
    );
  }
  function authoredQuestion(q) {
    return Object.fromEntries(
      ['id', 'stem', 'options', 'answer', 'explanation', 'distractors', 'section', 'category', 'skill', 'difficulty']
        .filter(key => q[key] != null)
        .map(key => [key, clone(q[key])])
    );
  }
  function assemble(form, bank, protectedPassages = []) {
    if (
      !object(form) ||
      !id(form.id) ||
      !FORMAT[form.section] ||
      !text(form.title) ||
      !Number.isInteger(form.revision) ||
      form.revision < 1 ||
      !Array.isArray(form.passages) ||
      !Array.isArray(form.discretes) ||
      !['draft', 'reviewed'].includes(form.status)
    )
      throw Error('The practice form is incomplete.');
    const passages = new Map([...(bank.cars || []), ...(bank.sci || [])].map(p => [p.id, p]));
    const discretes = new Map((bank.questions || []).map(q => [q.id, q])),
      items = [],
      used = new Set(),
      groups = new Set();
    for (const block of form.passages) {
      const p = passages.get(block.id),
        section = p?.section || 'cars';
      if (
        !p ||
        !text(p.text) ||
        !text(p.title) ||
        section !== form.section ||
        protectedPassages.includes(p.id) ||
        groups.has(p.id) ||
        !Array.isArray(block.questions) ||
        block.questions.length < (form.section === 'cars' ? 5 : 4) ||
        block.questions.length > (form.section === 'cars' ? 7 : 6)
      )
        throw Error('A passage block is missing, repeated, reserved or has the wrong section/length.');
      groups.add(p.id);
      for (const key of block.questions) {
        const q = p.questions.find(q => q.id === key);
        if (!question(q) || used.has(key)) throw Error('A form question is missing, damaged or repeated.');
        used.add(key);
        const item = { q: authoredQuestion(q), passageId: p.id, passageTitle: p.title, passageText: p.text };
        for (const field of ['table', 'contentNote', 'sources']) if (p[field] != null) item[field] = clone(p[field]);
        items.push(item);
      }
    }
    for (const key of form.discretes) {
      const q = discretes.get(key);
      if (!question(q) || q.section !== form.section || used.has(key))
        throw Error('An independent form question is missing, damaged or repeated.');
      used.add(key);
      items.push({ q: authoredQuestion(q) });
    }
    const spec = FORMAT[form.section];
    if (
      items.length !== spec.questions ||
      groups.size !== spec.passages ||
      form.discretes.length !== spec.discretes ||
      form.minutes !== spec.minutes
    )
      throw Error('This form does not match its advertised section length.');
    if (form.optionOrders != null) {
      if (
        !object(form.optionOrders) ||
        Object.keys(form.optionOrders).length !== items.length ||
        !items.every(it => optionOrder(form.optionOrders[it.q.id]))
      )
        throw Error('This form has an incomplete or invalid answer presentation.');
      for (const item of items) item.q.displayOrder = clone(form.optionOrders[item.q.id]);
    }
    if (
      form.status === 'reviewed' &&
      (!text(form.review?.reviewer) ||
        !text(form.review?.date) ||
        !text(form.review?.evidence) ||
        form.review?.approved !== true ||
        form.rightsReview?.approved !== true ||
        !text(form.rightsReview?.evidence))
    )
      throw Error('This form has no documented independent content and rights review.');
    return {
      key: form.section,
      items,
      durationMs: form.minutes * 60000,
      form: {
        id: form.id,
        title: form.title,
        revision: form.revision,
        status: form.status,
        review: clone(form.review || { approved: false }),
        rightsReview: clone(form.rightsReview || { approved: false }),
        selectionNote: form.selectionNote || '',
        contentSha256: form.contentSha256 || '',
      },
    };
  }
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (object(value))
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map(key => [key, canonical(value[key])])
      );
    return value;
  }
  async function signature(section, cryptoAPI = globalThis.crypto) {
    const bytes = new TextEncoder().encode(
      JSON.stringify(canonical({ key: section.key, items: section.items, durationMs: section.durationMs }))
    );
    return Array.from(new Uint8Array(await cryptoAPI.subtle.digest('SHA-256', bytes)), n =>
      n.toString(16).padStart(2, '0')
    ).join('');
  }
  async function verify(form, bank, protectedPassages, cryptoAPI) {
    const section = assemble(form, bank, protectedPassages);
    if (
      !/^[a-f0-9]{64}$/.test(form.contentSha256 || '') ||
      (await signature(section, cryptoAPI)) !== form.contentSha256
    )
      throw Error('This form’s source material has changed. It needs a new content check before starting.');
    return section;
  }
  function fullLengthEligible(queue) {
    return (
      queue.length === 4 &&
      queue.every(
        (s, index) =>
          s.key === ORDER[index] &&
          s.form?.status === 'reviewed' &&
          s.form?.review?.approved === true &&
          s.form?.rightsReview?.approved === true &&
          s.items.length === FORMAT[s.key].questions &&
          s.durationMs === FORMAT[s.key].minutes * 60000
      )
    );
  }
  function emptyExposure() {
    return { version: 1, questions: {}, passages: {}, reserved: {} };
  }
  function validExposure(state) {
    const records = value =>
      object(value) &&
      Object.entries(value).every(
        ([key, r]) =>
          id(key) &&
          object(r) &&
          time(r.firstAt) &&
          time(r.lastAt) &&
          r.lastAt >= r.firstAt &&
          Array.isArray(r.contexts) &&
          r.contexts.every(text)
      );
    return (
      object(state) &&
      state.version === 1 &&
      records(state.questions) &&
      records(state.passages) &&
      object(state.reserved) &&
      Object.entries(state.reserved).every(
        ([key, r]) =>
          id(key) &&
          object(r) &&
          Number.isInteger(r.revision) &&
          r.revision > 0 &&
          Array.isArray(r.questions) &&
          r.questions.every(id) &&
          Array.isArray(r.passages) &&
          r.passages.every(id)
      )
    );
  }
  function expose(state, { questionId, passageId, context }, now) {
    if (!time(now) || !text(context) || (!id(questionId) && !id(passageId))) return false;
    for (const [kind, key] of [
      ['questions', questionId],
      ['passages', passageId],
    ])
      if (id(key)) {
        const record = (state[kind][key] ||= { firstAt: now, lastAt: now, contexts: [] });
        record.lastAt = Math.max(record.lastAt, now);
        if (!record.contexts.includes(context)) record.contexts.push(context);
      }
    return true;
  }
  function exposure(section, ledger, knownQuestions = {}, knownPassages = {}) {
    const result = { seenQuestions: [], seenPassages: [], recordedQuestions: [], recordedPassages: [], unrecorded: [] };
    for (const item of section.items) {
      if (ledger.questions[item.q.id]) result.seenQuestions.push(item.q.id);
      else if (knownQuestions[item.q.id]) result.recordedQuestions.push(item.q.id);
      else result.unrecorded.push(item.q.id);
      if (item.passageId && ledger.passages[item.passageId]) result.seenPassages.push(item.passageId);
      else if (item.passageId && knownPassages[item.passageId]) result.recordedPassages.push(item.passageId);
    }
    for (const key of Object.keys(result)) result[key] = [...new Set(result[key])];
    result.hasKnownExposure = !!(
      result.seenQuestions.length ||
      result.seenPassages.length ||
      result.recordedQuestions.length ||
      result.recordedPassages.length
    );
    return result;
  }
  function reserve(ledger, section, enabled) {
    if (
      !section?.form ||
      !id(section.form.id) ||
      !Number.isInteger(section.form.revision) ||
      section.form.revision < 1 ||
      typeof enabled !== 'boolean' ||
      !Array.isArray(section.items) ||
      !section.items.every(it => question(it.q))
    )
      return false;
    if (!enabled) {
      delete ledger.reserved[section.form.id];
      return true;
    }
    ledger.reserved[section.form.id] = {
      revision: section.form.revision,
      questions: section.items.map(it => it.q.id),
      passages: [...new Set(section.items.map(it => it.passageId).filter(Boolean))],
    };
    return true;
  }
  function reservedItems(ledger) {
    // Frozen ID lists keep reservations enforceable even if the catalog fails
    // to download or a later manifest changes a form's selection.
    return {
      passages: new Set(Object.values(ledger.reserved).flatMap(r => r.passages)),
      questions: new Set(Object.values(ledger.reserved).flatMap(r => r.questions)),
    };
  }
  function create(queue, options, attemptId, now) {
    if (
      !id(attemptId) ||
      !time(now) ||
      !queue.length ||
      !['continuous', 'flexible'].includes(options.mode) ||
      new Set(queue.map(s => s.key)).size !== queue.length
    )
      throw Error('Choose a supported form and timing mode.');
    const seen = new Set();
    for (const section of queue)
      for (const item of section.items) {
        if (seen.has(item.q.id)) throw Error('A question is repeated across the selected sections.');
        seen.add(item.q.id);
      }
    return {
      rehearsalVersion: 1,
      attemptId,
      queue: clone(queue),
      si: 0,
      idx: 0,
      answers: {},
      firstAnswers: {},
      flags: {},
      results: [],
      seen: [],
      startedAt: now,
      phase: 'ready',
      deadline: 0,
      sectionDurationMs: 0,
      preflight: clone(options),
      timing: {
        mode: options.mode,
        sections: [],
        breaks: [],
        interruptions: [],
        lastObservedAt: now,
        clockChanged: false,
      },
      review: { notes: {}, takeaway: '' },
    };
  }
  function observe(run, now) {
    if (!time(now)) throw Error('The device clock could not be read.');
    if (now < run.timing.lastObservedAt) run.timing.clockChanged = true;
    run.timing.lastObservedAt = Math.max(now, run.timing.lastObservedAt);
    return run.timing.lastObservedAt;
  }
  function begin(run, now, startAt = now) {
    now = observe(run, now);
    if (
      run.finishedAt ||
      !['ready', 'break'].includes(run.phase) ||
      run.timing.sections[run.si] ||
      !time(startAt) ||
      startAt < run.startedAt ||
      startAt > now
    )
      return false;
    const section = run.queue[run.si];
    const clock = {
      startedAt: startAt,
      durationMs: section.durationMs,
      deadline: startAt + section.durationMs,
      remainingMs: section.durationMs,
      displayMs: {},
      visibleKey: null,
      visibleAt: null,
    };
    run.timing.sections[run.si] = clock;
    run.sectionDurationMs = section.durationMs;
    run.deadline = clock.deadline;
    run.phase = 'section';
    run.onBreak = false;
    run.idx = 0;
    return true;
  }
  function accountDisplay(run, now) {
    const clock = run.timing.sections[run.si];
    if (!clock) return;
    if (clock.visibleKey != null && clock.visibleAt != null) {
      const until = Math.min(now, clock.deadline);
      clock.displayMs[clock.visibleKey] =
        (clock.displayMs[clock.visibleKey] || 0) + Math.max(0, until - clock.visibleAt);
    }
    clock.visibleAt = null;
    clock.visibleKey = null;
  }
  function present(run, index, now, visible = true) {
    now = observe(run, now);
    if (run.phase !== 'section' || run.pausedAt || now >= run.deadline || !run.queue[run.si].items[index]) return false;
    accountDisplay(run, now);
    run.idx = index;
    const key = run.si + ':' + index,
      clock = run.timing.sections[run.si];
    if (visible) {
      clock.visibleKey = key;
      clock.visibleAt = now;
      if (!run.seen.includes(key)) run.seen.push(key);
    }
    return true;
  }
  function answer(run, choice, now) {
    now = observe(run, now);
    if (
      run.phase !== 'section' ||
      run.pausedAt ||
      now >= run.deadline ||
      !Number.isInteger(choice) ||
      choice < 0 ||
      choice > 3
    )
      return false;
    const key = run.si + ':' + run.idx;
    run.firstAnswers[key] ||= { chosen: choice, at: now };
    run.answers[key] = choice;
    return true;
  }
  function interrupt(run, reason, now) {
    now = observe(run, now);
    if (!text(reason) || !['section', 'break'].includes(run.phase) || run.pausedAt) return false;
    accountDisplay(run, now);
    const record = { reason, at: now, phase: run.phase, sectionIndex: run.si };
    run.timing.interruptions.push(record);
    if (run.timing.mode === 'flexible' && run.phase === 'section') {
      run.pausedAt = now;
      run._remain = Math.max(0, run.deadline - now);
      run.timing.sections[run.si].remainingMs = run._remain;
    }
    return true;
  }
  function resume(run, now, { reload = false } = {}) {
    const lastKnown = run._saved || run.timing.lastObservedAt;
    now = observe(run, now);
    const clock = run.timing.sections[run.si];
    if (reload && clock?.visibleAt != null) {
      run.timing.unobservedInterval = true;
      clock.visibleAt = null;
      clock.visibleKey = null;
    }
    if (reload && !run.pausedAt && run.phase === 'section') {
      run.timing.interruptions.push({
        reason: 'reload',
        at: lastKnown,
        resumedAt: now,
        phase: run.phase,
        sectionIndex: run.si,
      });
      if (run.timing.mode === 'flexible') {
        run.pausedAt = lastKnown;
        run._remain = Math.max(0, Math.min(clock.durationMs, run._remain ?? run.deadline - lastKnown));
      }
    }
    if (run.pausedAt && run.timing.mode === 'flexible' && run.phase === 'section') {
      run.timing.sections[run.si].deadline = run.deadline = now + run._remain;
      delete run.pausedAt;
    }
    for (const interruption of run.timing.interruptions) if (!interruption.resumedAt) interruption.resumedAt = now;
    return true;
  }
  function submit(run, now, reason = 'submitted') {
    now = observe(run, now);
    if (run.phase !== 'section' || run.pausedAt || run.results.some(r => r.sectionIndex === run.si)) return null;
    accountDisplay(run, now);
    const section = run.queue[run.si],
      clock = run.timing.sections[run.si];
    const remaining = Math.max(0, Math.min(clock.durationMs, clock.deadline - now));
    clock.endedAt = now;
    clock.remainingMs = remaining;
    const answers = Object.fromEntries(
      section.items.map((_, i) => [run.si + ':' + i, run.answers[run.si + ':' + i] ?? null])
    );
    const result = {
      key: section.key,
      sectionIndex: run.si,
      correct: section.items.filter((it, i) => answers[run.si + ':' + i] === it.q.answer).length,
      total: section.items.length,
      unanswered: Object.values(answers).filter(a => a == null).length,
      seen: run.seen.filter(k => k.startsWith(run.si + ':')),
      items: clone(section.items),
      answers,
      firstAnswers: clone(run.firstAnswers),
      elapsedMs: clock.durationMs - remaining,
      displayMs: clone(clock.displayMs),
      endedAt: now,
      deadline: clock.deadline,
      reason: now >= clock.deadline ? 'time-expired' : reason,
    };
    run.results.push(result);
    run.phase = 'submitted';
    return result;
  }
  function next(run, now) {
    now = observe(run, now);
    if (run.phase !== 'submitted') return false;
    if (run.si + 1 >= run.queue.length) {
      run.phase = 'finished';
      run.finishedAt = now;
      return true;
    }
    const previous = run.queue[run.si].key;
    run.si++;
    run.idx = 0;
    run.phase = 'break';
    run.onBreak = true;
    const minutes = previous === 'cars' ? 30 : 10;
    const lastResult = run.results.at(-1),
      startAt = run.timing.mode === 'continuous' ? Math.min(lastResult.endedAt, lastResult.deadline) : now;
    run.timing.breaks.push({
      afterSection: previous,
      beforeSection: run.queue[run.si].key,
      startedAt: startAt,
      targetMs: minutes * 60000,
      deadline: startAt + minutes * 60000,
    });
    return true;
  }
  function endBreak(run, now) {
    now = observe(run, now);
    if (run.phase !== 'break') return false;
    const rest = run.timing.breaks.at(-1);
    if (!rest || rest.endedAt) return false;
    rest.endedAt = now;
    rest.elapsedMs = Math.max(0, now - rest.startedAt);
    const startAt = run.timing.mode === 'continuous' ? Math.min(now, rest.deadline) : now;
    return begin(run, now, startAt);
  }
  function finishEarly(run, now) {
    now = observe(run, now);
    if (!['break', 'submitted', 'ready'].includes(run.phase)) return false;
    const rest = run.timing.breaks.at(-1);
    if (run.phase === 'break' && rest && !rest.endedAt) {
      rest.endedAt = now;
      rest.elapsedMs = now - rest.startedAt;
    }
    run.phase = 'finished';
    run.finishedAt = now;
    run.stoppedEarly = run.results.length < run.queue.length;
    return true;
  }
  function validRun(run) {
    if (
      !object(run) ||
      run.rehearsalVersion !== 1 ||
      !id(run.attemptId) ||
      !time(run.startedAt) ||
      !Array.isArray(run.queue) ||
      !run.queue.length ||
      run.queue.length > 4 ||
      !run.queue.every(
        s =>
          FORMAT[s.key] &&
          Array.isArray(s.items) &&
          s.items.length === FORMAT[s.key].questions &&
          s.items.every(it => question(it.q)) &&
          s.durationMs === FORMAT[s.key].minutes * 60000
      ) ||
      !Number.isInteger(run.si) ||
      !run.queue[run.si] ||
      !Number.isInteger(run.idx) ||
      !run.queue[run.si].items[run.idx] ||
      !['ready', 'section', 'submitted', 'break', 'finished'].includes(run.phase) ||
      !object(run.answers) ||
      !object(run.firstAnswers) ||
      !object(run.flags) ||
      !Array.isArray(run.results) ||
      !Array.isArray(run.seen) ||
      !object(run.timing) ||
      !['continuous', 'flexible'].includes(run.timing.mode) ||
      !Array.isArray(run.timing.sections) ||
      !Array.isArray(run.timing.breaks) ||
      !Array.isArray(run.timing.interruptions) ||
      !time(run.timing.lastObservedAt)
    )
      return false;
    const hasKey = key => {
      const match = /^(\d+):(\d+)$/.exec(key);
      return !!match && !!run.queue[Number(match[1])]?.items[Number(match[2])];
    };
    const allIds = run.queue.flatMap(s => s.items.map(it => it.q.id));
    if (
      new Set(allIds).size !== allIds.length ||
      new Set(run.queue.map(s => s.key)).size !== run.queue.length ||
      new Set(run.seen).size !== run.seen.length ||
      !Object.entries(run.flags).every(([key, flag]) => hasKey(key) && typeof flag === 'boolean')
    )
      return false;
    if (
      !Object.entries(run.answers).every(([key, a]) => hasKey(key) && Number.isInteger(a) && a >= 0 && a < 4) ||
      !Object.entries(run.firstAnswers).every(
        ([key, a]) =>
          hasKey(key) && object(a) && Number.isInteger(a.chosen) && a.chosen >= 0 && a.chosen < 4 && time(a.at)
      ) ||
      !Object.keys(run.answers).every(key => run.firstAnswers[key]) ||
      !run.seen.every(hasKey)
    )
      return false;
    if (
      !run.timing.sections.every(
        (clock, index) =>
          object(clock) &&
          run.queue[index] &&
          time(clock.startedAt) &&
          time(clock.deadline) &&
          clock.durationMs === run.queue[index].durationMs &&
          clock.deadline >= clock.startedAt + clock.durationMs &&
          Number.isFinite(clock.remainingMs) &&
          clock.remainingMs >= 0 &&
          clock.remainingMs <= clock.durationMs &&
          object(clock.displayMs) &&
          Object.entries(clock.displayMs).every(
            ([key, ms]) => hasKey(key) && key.startsWith(index + ':') && Number.isFinite(ms) && ms >= 0
          ) &&
          ((clock.visibleKey === null && clock.visibleAt === null) ||
            (hasKey(clock.visibleKey) && clock.visibleKey.startsWith(index + ':') && time(clock.visibleAt)))
      )
    )
      return false;
    if (
      !run.timing.breaks.every(
        rest =>
          object(rest) &&
          FORMAT[rest.afterSection] &&
          FORMAT[rest.beforeSection] &&
          time(rest.startedAt) &&
          [600000, 1800000].includes(rest.targetMs) &&
          rest.deadline === rest.startedAt + rest.targetMs &&
          (rest.endedAt == null || (time(rest.endedAt) && Number.isFinite(rest.elapsedMs) && rest.elapsedMs >= 0))
      )
    )
      return false;
    if (
      !run.timing.interruptions.every(
        event =>
          object(event) &&
          text(event.reason) &&
          time(event.at) &&
          ['section', 'break'].includes(event.phase) &&
          Number.isInteger(event.sectionIndex) &&
          run.queue[event.sectionIndex] &&
          (event.resumedAt == null || time(event.resumedAt))
      )
    )
      return false;
    if (
      run.pausedAt != null &&
      (!time(run.pausedAt) ||
        run.phase !== 'section' ||
        run.timing.mode !== 'flexible' ||
        !Number.isFinite(run._remain) ||
        run._remain < 0 ||
        run._remain > run.sectionDurationMs)
    )
      return false;
    if (['section', 'submitted'].includes(run.phase) && (!time(run.deadline) || !object(run.timing.sections[run.si])))
      return false;
    if (run.phase === 'break' && !run.timing.breaks.length) return false;
    if (
      (run.phase === 'ready' && (run.si || run.results.length || run.timing.sections.length)) ||
      (run.phase === 'section' && run.results.length !== run.si) ||
      (run.phase === 'submitted' && run.results.length !== run.si + 1) ||
      (run.phase === 'break' && run.results.length !== run.si)
    )
      return false;
    return (
      run.results.every(
        (r, i) =>
          object(r) &&
          r.sectionIndex === i &&
          r.key === run.queue[i]?.key &&
          r.total === run.queue[i].items.length &&
          Number.isInteger(r.correct) &&
          r.correct >= 0 &&
          r.correct <= r.total &&
          object(r.answers) &&
          Array.isArray(r.items) &&
          r.items.length === r.total &&
          JSON.stringify(canonical(r.items)) === JSON.stringify(canonical(run.queue[i].items)) &&
          r.items.every((_, index) => r.answers[i + ':' + index] === (run.answers[i + ':' + index] ?? null)) &&
          r.correct === r.items.filter((it, index) => r.answers[i + ':' + index] === it.q.answer).length &&
          r.unanswered === r.items.filter((_, index) => r.answers[i + ':' + index] == null).length &&
          Number.isFinite(r.elapsedMs) &&
          r.elapsedMs >= 0 &&
          r.elapsedMs <= run.queue[i].durationMs &&
          time(r.endedAt)
      ) &&
      (run.phase !== 'finished' || time(run.finishedAt))
    );
  }
  function pack(run) {
    const copy = clone(run);
    copy.compact = 1;
    for (const section of copy.queue) {
      section.passages = {};
      for (const item of section.items)
        if (item.passageId) {
          section.passages[item.passageId] ||= Object.fromEntries(
            ['passageTitle', 'passageText', 'table', 'contentNote', 'sources']
              .filter(key => item[key] != null)
              .map(key => [key, item[key]])
          );
          for (const key of ['passageTitle', 'passageText', 'table', 'contentNote', 'sources']) delete item[key];
        }
    }
    for (const result of copy.results) delete result.items;
    return copy;
  }
  function unpack(saved) {
    if (!object(saved) || (saved.compact != null && saved.compact !== 1))
      throw Error('The saved rehearsal format is unsupported.');
    const copy = clone(saved);
    if (copy.compact === 1) {
      for (const section of copy.queue) {
        for (const item of section.items)
          if (item.passageId) {
            const passage = section.passages?.[item.passageId];
            if (!object(passage) || !text(passage.passageTitle) || !text(passage.passageText))
              throw Error('The saved rehearsal passage is missing.');
            for (const key of ['passageTitle', 'passageText', 'table', 'contentNote', 'sources'])
              if (passage[key] != null) item[key] = clone(passage[key]);
          }
        delete section.passages;
      }
      for (const result of copy.results) result.items = clone(copy.queue[result.sectionIndex].items);
      delete copy.compact;
    }
    if (!validRun(copy)) throw Error('The saved rehearsal is damaged.');
    return copy;
  }
  return {
    FORMAT,
    ORDER,
    assemble,
    signature,
    verify,
    fullLengthEligible,
    emptyExposure,
    validExposure,
    expose,
    exposure,
    reserve,
    reservedItems,
    create,
    begin,
    present,
    answer,
    interrupt,
    resume,
    submit,
    next,
    endBreak,
    finishEarly,
    validRun,
    pack,
    unpack,
  };
});
