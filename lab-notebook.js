// Alzheimer's Histology Lab: the experiment designer (two screens, Plan and Predict and reveal, with
// the reveal gate and the outcome cards), the student report with its free notes and its export (context/ALZ-LAB-CONTRACT.md §4
// "window.CortexLabNotebook", §5 and §8; context/PLAN-ALZ-LAB-SIMPLIFY.md §3.6 and §3.7). Classic
// script: everything lives inside this IIFE and only window.CortexLabNotebook is exposed. Classes
// .labn-*, ids #labn-*, attributes data-labn-*. The engine (window.SilverLab) owns every outcome,
// every validation and every word of the export; this file renders forms, calls the engine and
// never computes, rewords or invents a result. Plain words, badges and one-line summaries come from
// window.CortexLab (lab.js, contract §8.1) when it is loaded, with private fallback copies here so
// the module also runs on its own (node tests, dev harness).
(function () {
  'use strict';

  // ---- engine constants with contract fallbacks ---------------------------------------------
  const FALLBACK = {
    ENTRY_TYPES: ['published', 'observed', 'simulated', 'reflection'],
    SECTIONS: ['starting-ideas', 'process-decisions', 'outcomes-limitations', 'learning-reflection', 'next-steps'],
    SECTION_TEXT: {
      'starting-ideas': 'Starting ideas',
      'process-decisions': 'Process and decisions',
      'outcomes-limitations': 'Outcomes and limitations',
      'learning-reflection': 'Learning and reflection',
      'next-steps': 'Next steps',
    },
    ENTRY_TAG: {
      published: '[Published]',
      observed: '[Observed]',
      simulated: '[Simulated: illustrative, not a measurement]',
      reflection: '[Reflection]',
    },
    STAND_IN_SUFFIX: '(stand-in: synthetic specimen, not characterized)',
    LABELS: {
      OBSERVED: 'observed-reference',
      SYNTHETIC: 'illustrative-synthetic',
      VALIDATED: 'validated-prediction',
      NO_BASIS: 'no-basis',
    },
    LABEL_TEXT: {
      'observed-reference': 'Observed reference image',
      'illustrative-synthetic': 'Illustrative simulation (synthetic, not a measurement)',
      'validated-prediction': 'Validated model prediction',
      'no-basis': 'No basis for a simulated result',
    },
    HYPOTHESES: ['H-fixation-carbonyl', 'H-endogenous-carbonyl', 'H-reduced-metal', 'H-other-reduction-site'],
    HYPOTHESIS_TEXT: {
      'H-fixation-carbonyl': 'Hypothesis: fixation-related carbonyls are the reduction sites',
      'H-endogenous-carbonyl': 'Hypothesis: endogenous carbonyls are the reduction sites',
      'H-reduced-metal': 'Hypothesis: reduced metals are the reduction sites',
      'H-other-reduction-site': 'Hypothesis: other reduction sites',
    },
    SITE_CLASSES: ['axon', 'plaque-core', 'plaque-neurite', 'tangle', 'neuropil-thread', 'background'],
    SITE_TEXT: {},
    ORDINAL_TEXT: ['none', 'trace', 'low', 'moderate', 'high'],
    STEPS: [],
    DEFAULT_PARAMS: {
      impregnation: { endpoint: 'sop-default', temperature: 'sop-default', condition: 'sop-default' },
      ammoniacal: { endpoint: 'sop-default', condition: 'sop-default' },
      development: { endpoint: 'sop-default', strength: 'sop-default', condition: 'sop-default' },
      washes: { condition: 'sop-default' },
      pretreatment: 'none',
      toning: true,
      thiosulfate: true,
    },
  };
  const K = name => (window.SilverLab && window.SilverLab[name]) || FALLBACK[name];

  // ---- student vocabulary (contract §8.1; lab.js owns the shared copy) --------------------------
  const WORDS = {
    standard: 'standard (per procedure)',
    changed: 'changed',
    notSet: 'not set',
    simulated: 'Simulated · not a measurement',
    simulatedLong: 'Illustrative simulation from a teaching model, not a measurement.',
    notModeled: 'Not modeled',
    notModeledLong: 'The model has no rule for this change, so it shows no picture.',
    referenceNone: 'Real slide',
    inProgress: 'Steps still to do',
    modelScale: 'model scale',
    scaleLegend: 'Model scale: none · trace · low · moderate · high (positions, not amounts)',
    keepInMind: 'Keep in mind',
    why: 'Why?',
    sources: 'Sources',
    boundSilver: 'bound silver',
    nuclei: 'silver nuclei',
    visibleSilver: 'visible silver',
    practiceSpecimen: 'practice specimen (not real tissue)',
    outOfOrder: 'Done out of order',
    howItWorks: 'How this lab works',
  };
  const shell = () => (window.CortexLab && typeof window.CortexLab === 'object' ? window.CortexLab : null);
  // Engine sentences in plain words ("this change (washes: changed)") when lab.js provides it.
  const plainText = text => {
    const fn = shell() && shell().plain;
    return typeof fn === 'function' ? String(fn(text)) : String(text || '');
  };
  const W = key => {
    const s = shell(),
      word = s && s.words ? s.words[key] : null;
    return typeof word === 'string' && word ? word : WORDS[key];
  };
  // Long words for the badges the vocabulary gives only a short form for.
  const BADGE_LONG = {
    'reference-none':
      'A real photomicrograph from an open-access study, shown when one matches the run; credited under the picture.',
    'in-progress': 'The run is not finished; some steps are still to do.',
  };
  const BADGE_WORDS = {
    simulated: ['simulated', 'simulatedLong'],
    'not-modeled': ['notModeled', 'notModeledLong'],
    'reference-none': ['referenceNone', null],
    'in-progress': ['inProgress', null],
  };

  const CONTROL_TYPES = [
    {
      type: 'characterized-positive',
      text: 'Characterized positive control',
      hint: 'A section known to stain, to show the stain worked. A real one needs real tissue with a known staining history.',
    },
    {
      type: 'negative-biological',
      text: 'Negative biological comparison',
      hint: 'A section without the lesions. It need not be blank: normal structures such as axons can still stain.',
    },
    {
      type: 'baseline-process',
      text: 'Baseline process comparison',
      hint: 'Your standard run, every setting per procedure, to compare against. It is a run, not a specimen.',
    },
  ];
  const FIELD_TEXT = {
    title: 'Title',
    background: 'Background',
    question: 'Your question',
    hypothesis: 'Your hypothesis',
    alternative: 'Another explanation',
    independentVariable: 'Main variable (the one you test)',
    measures: 'Outcome measures',
    heldComparable: 'What you keep the same',
    changed: 'What you change',
    controls: 'Controls',
    // The three outcome names, the same everywhere in the designer and the report (UX-POLISH).
    'predictions.expected': 'Expected outcome',
    'predictions.negligible': 'Negligible change',
    'predictions.opposite': 'Opposite outcome',
    limitations: 'Limits of your design',
    baselineRunId: 'Baseline run (standard)',
    experimentalRunId: 'Experimental run (with your change)',
  };
  // Short names for the "things left" links.
  const LEFT_TEXT = {
    title: 'Title',
    background: 'Background',
    question: 'Question',
    hypothesis: 'Hypothesis',
    alternative: 'Another explanation',
    independentVariable: 'Main variable',
    measures: 'An outcome measure',
    heldComparable: 'What you keep the same',
    changed: 'What you change',
    controls: 'A control',
    'predictions.expected': 'Expected outcome',
    'predictions.negligible': 'Negligible change',
    'predictions.opposite': 'Opposite outcome',
    limitations: 'Limits of your design',
    baselineRunId: 'Baseline run',
    experimentalRunId: 'Experimental run',
  };
  // [one-line hint, example placeholder]
  const FIELD_HELP = {
    title: [
      'A short name for this experiment. Leave it blank and it is filled in from your change.',
      'e.g. Development time and plaque contrast',
    ],
    background: [
      'Why this question matters, and what published work you build on.',
      'e.g. Why development time might change how plaques show up',
    ],
    question: [
      'One question your two runs can answer.',
      'e.g. Does a longer development time change how plaques stand out from the background?',
    ],
    hypothesis: [
      'What you think will happen, and why.',
      'e.g. Longer development darkens plaques more than the background',
    ],
    alternative: [
      'Another explanation that could produce the same outcome.',
      'e.g. The background darkens just as much, so contrast stays the same',
    ],
    changed: ['The setting that differs between your two runs. Usually just one.', 'e.g. Development time'],
    independentVariable: [
      'The one change you are testing. It is filled in from your first change; edit it if needed.',
      'e.g. Development time',
    ],
    heldComparable: ['What stays the same in both runs, so the comparison is fair.', 'e.g. Specimen'],
    'predictions.expected': [
      'If the experimental run shows the change you expect, what does that support, and what does it fail to establish?',
      'e.g. Plaques move up a step and the background does not. That would support …, but not show …',
    ],
    'predictions.negligible': [
      'If the change is negligible, what does that support, what does it fail to establish, and which of the competing explanations does it leave untouched?',
      'e.g. Nothing moves. That would suggest …, and leaves … untouched',
    ],
    'predictions.opposite': [
      'If the change goes the opposite way, what does that support, what does it fail to establish, and which of the four explanations could account for it?',
      'e.g. Plaques fade against the background. That could mean …',
    ],
    limitations: [
      'What this design and this teaching model cannot show.',
      'e.g. Practice specimens only; the model uses a simple scale, not amounts',
    ],
  };
  // The opposite-outcome prompt asks which of the four explanations could account for it; a design that
  // tests the procedure (development time, say) has no such explanation, and saying so is an answer.
  const PROCEDURE_NOTE =
    'Testing the procedure (such as development time) and not one of the four explanations? Then “None of the four: my hypothesis is about the procedure” is a fine answer to the last part.';
  // Plain words for the jargon in the four hypotheses (step 1). Definitions only: none says which
  // explanation is right, and the hypothesis text itself stays the engine's.
  const HYPOTHESIS_GLOSS = {
    'H-fixation-carbonyl':
      'Carbonyls: a kind of chemical group. Fixation-related: coming from fixation, the step that preserves the tissue.',
    'H-endogenous-carbonyl': 'Endogenous: already present in the tissue, not created by fixation.',
    'H-reduced-metal': 'Reduced metals: metals in a chemically reduced form (one that has gained electrons).',
    'H-other-reduction-site': 'Other reduction sites: reduction sites other than the three kinds above.',
  };
  const PREDICTION_KEYS = ['expected', 'negligible', 'opposite'];
  const INTERPRETATION_FALLBACK = {
    supports: 'What would this outcome support?',
    failsToEstablish: 'What would it fail to establish?',
    next: 'What experiment would be informative next?',
  };
  // The interpretation's three names (the engine's prompt is the hint under each, as above).
  const INTERPRETATION_TEXT = {
    supports: 'What it supports',
    failsToEstablish: 'What it fails to establish',
    next: 'Next experiment',
  };
  // SIMPLE-notebook: two screens. Plan holds the question, the hypothesis, what changes, the controls,
  // the measures and the two runs; Predict and reveal holds the three predictions, the gate, the locked
  // design, the cards and the interpretation. The reveal gate (lab.canReveal) is unchanged.
  const WIZARD = [
    {
      n: 1,
      name: 'Plan',
      title: 'Plan your experiment',
      lede: 'Say what you want to find out, what you change, how you measure it and which two runs you compare, before you run anything.',
      fields: [
        'title',
        'background',
        'question',
        'hypothesis',
        'alternative',
        'changed',
        'independentVariable',
        'heldComparable',
        'controls',
        'measures',
        'baselineRunId',
        'experimentalRunId',
      ],
    },
    {
      n: 2,
      name: 'Predict and reveal',
      title: 'Predict, then reveal',
      lede: 'Write what each possible outcome would mean, before you reveal what the teaching model gives for your experimental run next to your baseline. It never says which explanation is right.',
      fields: ['predictions.expected', 'predictions.negligible', 'predictions.opposite', 'limitations'],
    },
  ];
  const LAST_STEP = WIZARD.length;
  // Fields the screen does not wait for (no "required" pill, never in "Still empty"): the engine's
  // checkExperiment may still list them, and that shows as a soft hint, never a blocker. A blank title
  // is filled in from the change when the experiment is saved.
  const OPTIONAL_FIELDS = ['title', 'background', 'alternative', 'heldComparable', 'limitations'];
  const stepOf = field => (WIZARD.find(s => s.fields.includes(field)) || WIZARD[0]).n;
  // The parts of the last screen a microscope link returns to (?at=<anchor>): the outcome measures, the
  // cards and the comparison.
  const AT_ANCHORS = { measures: '.labn-measures-out', cards: '.labn-cards', compare: '.labn-compare' };
  // One plain line per measurement rule, the same words as the microscope's Measure sheet; a chosen
  // measure adds how it is recorded, and the full written rule sits under "Full rule".
  const MEASURE_LINE = {
    'contrast-ordinal': 'Compare the darkest structure with the background.',
    'roi-lesion-count': 'Count one kind of lesion inside 9 fixed regions.',
    'artifact-area': 'Outline folds, tears or stray silver that is not tissue.',
    'tissue-coverage': 'Count the grid squares that hold tissue.',
    'blinded-quality-score': 'Rate the picture 1 to 5 on a scale you write first.',
  };
  const MEASURE_HOW = {
    'contrast-ordinal': 'The microscope reads it from the simulated picture, on the model scale.',
    'roi-lesion-count': 'You fix the regions and what counts before you look, then count by hand.',
    'artifact-area': 'You write what counts as an artifact first, then outline it by hand.',
    'tissue-coverage': 'You record it by hand on a fixed grid.',
    'blinded-quality-score': 'You score it by hand. It is not blinded in this version: there is no second scorer.',
  };
  const PARAM_TEXT = {
    'impregnation.endpoint': 'Impregnation time',
    'impregnation.temperature': 'Impregnation temperature',
    'impregnation.condition': 'Impregnation bath condition',
    'ammoniacal.endpoint': 'Ammoniacal silver time',
    'ammoniacal.condition': 'Ammoniacal silver condition',
    'development.endpoint': 'Development time',
    'development.strength': 'Developer strength',
    'development.condition': 'Developer condition',
    'washes.condition': 'Washes',
    pretreatment: 'Pretreatment',
    toning: 'Gold toning',
    thiosulfate: 'Thiosulfate',
    specimenId: 'Specimen',
    method: 'Staining method',
  };
  const RUNNABLE_METHOD = 'bielschowsky-modified';
  const STATUS_TEXT = { draft: 'Draft', revealed: 'Revealed', done: 'Done' };
  // A claim's strength in words (no claim changes: only the category). The engine puts them in brackets.
  // 'schematic-analogy' also holds the course's own modeling rules, so it never says "another system".
  const STRENGTH_TEXT = {
    'published-qualitative': 'published, qualitative',
    'schematic-analogy': 'schematic: a model assumption or an analogy',
    'course-handout': 'course materials',
    placeholder: 'not yet sourced',
    'hypothesis-conditional': 'conditional on a hypothesis',
  };
  // The file's heading matches the page ("My report") and the file name.
  const EXPORT_TITLE = "My lab report: Alzheimer's Histology Lab";
  // The page is "My report", so the file is named for it (its content is the engine's export, unchanged).
  const REPORT_FILE = 'my-lab-report.md';

  // ---- report vocabulary ----------------------------------------------------------------------
  const TYPE_TAG = { published: 'Published', observed: 'Observed', simulated: 'Simulated', reflection: 'Reflection' };
  const TYPE_LEGEND = {
    published: 'a finding from a published source',
    observed: 'what you saw in the real lab',
    simulated: 'about a run of the teaching model, not a measurement',
    reflection: 'your own thinking',
  };
  // The "Add to my report" menu, Reflection first (contract §8.4 decision 2).
  const ADD_TYPES = [
    ['reflection', 'Reflection'],
    ['observed', 'Real-lab observation'],
    ['published', 'Cite a published finding'],
    ['simulated', 'Note on a simulated run'],
  ];
  const FORM_TITLE = {
    reflection: 'New reflection',
    observed: 'New real-lab observation',
    published: 'Cite a published finding',
    simulated: 'Note on a simulated run',
  };
  const TYPE_HELP = {
    published: 'Pick a finding from the course sources. Its sources print with your note.',
    observed:
      'Only for what you saw yourself in the real lab, with the date. Anything from this simulator goes in as a note on a simulated run.',
    simulated:
      'A note about one of your simulated runs. It keeps that run’s label (Simulated or Not modeled) and is never an observation.',
    reflection: 'Your own thinking: choices, limits, what you learned, what comes next.',
  };
  const SECTION_HINT = {
    'starting-ideas': 'What you thought before any run: your question, hypothesis and the findings behind them.',
    'process-decisions': 'What you did and why: the choices you made and what you saw in the real lab.',
    'outcomes-limitations': 'What the simulated runs showed, and what they cannot show.',
    'learning-reflection': 'What you learned and what you would do differently.',
    'next-steps': 'The experiment you would run next, and why.',
  };
  const DEFAULT_SECTION = {
    reflection: 'learning-reflection',
    observed: 'process-decisions',
    published: 'starting-ideas',
    simulated: 'outcomes-limitations',
  };

  // ---- small helpers ---------------------------------------------------------------------
  const esc = s =>
    String(s ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  function h(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function mk(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'text') node.textContent = value;
      else if (key === 'class') node.className = value;
      else node.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of [].concat(children || [])) {
      if (child === null || child === undefined || child === false) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  }
  let uidCounter = 0;
  const uid = name => `labn-${String(name).replace(/[^A-Za-z0-9_-]/g, '-')}-${++uidCounter}`;
  const clone = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const filled = x => (Array.isArray(x) ? x.length > 0 : typeof x === 'string' ? x.trim().length > 0 : x != null);
  const titleCase = s =>
    String(s || '')
      .split('-')
      .map((w, i) => (i ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ');
  const siteText = site => K('SITE_TEXT')[site] || titleCase(site);
  const sitePlural = site => (site === 'background' ? 'background' : `${siteText(site)}s`.toLowerCase());
  const ordinalWord = n => K('ORDINAL_TEXT')[Math.min(4, Math.max(0, Math.round(Number(n) || 0)))];
  const andList = items =>
    items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  const moveText = d =>
    !d ? 'no change' : `${d > 0 ? 'up' : 'down'} ${Math.abs(d)} ${Math.abs(d) === 1 ? 'step' : 'steps'}`;
  const capital = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const nowIso = () => new Date().toISOString();
  // Dates are stored as UTC ISO strings and shown as the student's local calendar day (an evening in
  // Texas is still that day, not the next one). A bare YYYY-MM-DD (a date the student typed) is kept.
  const pad2 = n => String(n).padStart(2, '0');
  function localDay(value) {
    const text = String(value || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const d = new Date(text);
    return Number.isNaN(d.getTime())
      ? text.slice(0, 10)
      : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  // A link to another lab view. The shell routes a[data-lab-go] in place; elsewhere it is a plain link.
  // Site-wide parameters (gates, offline, returnTo) stay; the lab's own are replaced.
  function viewHref(params) {
    let url;
    try {
      url = new URL(window.location.href);
    } catch {
      return '#';
    }
    for (const key of ['view', 'exp', 'step', 'tab', 'run', 'mode', 'intro', 'from', 'at'])
      url.searchParams.delete(key);
    for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, String(value));
    return `${url.pathname}${url.search}`;
  }
  const stripUndefined = obj => {
    const out = {};
    for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
    return out;
  };
  // Re-rendering replaces nodes: put focus back on the node with the same (memoized) id.
  function keepFocus(scope, render) {
    const active = document.activeElement,
      activeId = active && active.id && scope && scope.contains(active) ? active.id : null;
    render();
    if (activeId && document.activeElement !== active) {
      const again = document.getElementById(activeId);
      if (again && typeof again.focus === 'function') again.focus();
    }
  }
  function disclosure(buttonText, panel, opts = {}) {
    const panelId = panel.id || uid('panel');
    panel.id = panelId;
    panel.hidden = !opts.open;
    const button = mk(
      'button',
      {
        type: 'button',
        class: 'labn-disclose',
        'aria-expanded': opts.open ? 'true' : 'false',
        'aria-controls': panelId,
        'data-labn-why': opts.why ? true : null,
      },
      [buttonText, opts.srText ? mk('span', { class: 'labn-sr-only', text: opts.srText }) : null]
    );
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.hidden = !open;
    });
    return button;
  }
  // A fold built as markup (static screens): a .labn-disclose button with data-labn-toggle and its
  // hidden panel. toggleFold answers a click on one; openFold opens the folds around a node.
  function foldHtml(button, text, body, panelId) {
    return `<button type="button" class="labn-disclose" data-labn-toggle="${esc(button)}" aria-expanded="false" aria-controls="${panelId}">${esc(text)}</button><div class="labn-disclosure" id="${panelId}" hidden>${body}</div>`;
  }
  function setFold(button, open) {
    const panel = button.ownerDocument.getElementById(button.getAttribute('aria-controls'));
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (panel) panel.hidden = !open;
  }
  function toggleFold(button) {
    setFold(button, button.getAttribute('aria-expanded') !== 'true');
  }
  function openFolds(node, root) {
    for (let panel = node.closest('.labn-disclosure'); panel; panel = panel.parentElement.closest('.labn-disclosure')) {
      const button = root.querySelector(`[aria-controls="${panel.id}"]`);
      if (button) setFold(button, true);
      else panel.hidden = false;
    }
  }
  // A "Why?" expander: the button and its panel, ready to append.
  function whyBlock(children, text) {
    const panel = mk('div', { class: 'labn-disclosure labn-why' }, children);
    return [disclosure(text || W('why'), panel, { why: true }), panel];
  }
  // The "Sources" expander nested at the end of a Why? panel: the engine's own words and the ids.
  function sourcesBlock(children) {
    const panel = mk('div', { class: 'labn-disclosure labn-why-sources' }, children),
      button = disclosure(W('sources'), panel);
    button.setAttribute('data-labn-sources', '');
    return [button, panel];
  }

  // ---- badges and plain summaries (window.CortexLab when present, else the same markup here) --------
  function fallbackBadge(kind, label) {
    const [shortKey, longKey] = BADGE_WORDS[kind] || BADGE_WORDS['not-modeled'];
    return mk(
      'span',
      { class: `lab-badge lab-badge-${kind}`, 'data-lab-badge': kind, 'data-lab-label': label || null },
      [
        mk('span', { class: 'lab-badge-text', text: W(shortKey) }),
        mk('span', { class: 'lab-sr-only labn-sr-only', text: ` ${longKey ? W(longKey) : BADGE_LONG[kind] || ''}` }),
      ]
    );
  }
  function shellNode(fnName, ...args) {
    const s = shell();
    if (!s || typeof s[fnName] !== 'function') return null;
    try {
      const html = s[fnName](...args);
      return typeof html === 'string' && html.trim() ? h(html) : null;
    } catch {
      return null;
    }
  }
  // Every badge on an engine output carries data-lab-label = the engine label (contract §8.1).
  function badgeNode(kind, label) {
    const node = shellNode('badge', kind, label ? { label } : {}) || fallbackBadge(kind, label);
    if (label && !node.hasAttribute('data-lab-label')) node.setAttribute('data-lab-label', label);
    return node;
  }
  const outcomeKind = o =>
    !isObj(o)
      ? 'not-modeled'
      : o.label === K('LABELS').SYNTHETIC
        ? 'simulated'
        : o.code === 'step-skipped'
          ? 'in-progress'
          : 'not-modeled';
  function outcomeBadge(o) {
    const label = isObj(o) ? o.label : null,
      node = shellNode('badgeForOutcome', o) || fallbackBadge(outcomeKind(o), label);
    if (label && !node.hasAttribute('data-lab-label')) node.setAttribute('data-lab-label', label);
    return node;
  }
  const labelKind = label => (label === K('LABELS').SYNTHETIC ? 'simulated' : 'not-modeled');
  // A comparison's badge and its background-assumption clause come from the shell when lab.js is
  // loaded (CortexLab.badgeForComparison / assumptionNote), else the label's badge and no clause.
  function comparisonBadge(cmp) {
    const label = isObj(cmp) ? cmp.label : null,
      node = shellNode('badgeForComparison', cmp) || badgeNode(labelKind(label), label);
    if (label && !node.hasAttribute('data-lab-label')) node.setAttribute('data-lab-label', label);
    return node;
  }
  function assumptionNote(result) {
    const fn = shell() && shell().assumptionNote;
    if (typeof fn !== 'function') return '';
    try {
      const text = fn(result);
      return typeof text === 'string' ? text : '';
    } catch {
      return '';
    }
  }
  function level(n) {
    const s = shell();
    if (s && typeof s.level === 'function') {
      try {
        const word = s.level(n);
        if (typeof word === 'string' && word) return word;
      } catch {
        /* fall back to the engine's ordinal words */
      }
    }
    return ordinalWord(n);
  }
  // Same wording as lab.js labSummarize: lesion structures first, grouped by their word, never the
  // words result, data, measured or predicts.
  const SUMMARY_SITES = ['plaque-core', 'plaque-neurite', 'tangle', 'axon', 'neuropil-thread'];
  const SUMMARY_BANNED = /\b(results?|data|measured|predicts?)\b/i;
  function fallbackSummary(o) {
    if (!isObj(o)) return '';
    if (o.label !== K('LABELS').SYNTHETIC) {
      if (o.code === 'step-skipped') {
        const steps = K('STEPS'),
          total = steps.length || 9,
          missing = steps.filter(step => (o.outsideSupport || []).includes(step)).length;
        return `${W('inProgress')}: ${total - missing} of ${total} done. Finish the steps to see the simulated picture.`;
      }
      const first = (String(o.explanation || '').match(/^.*?[.!?](?=\s|$)/) || [''])[0].trim();
      return `${W('notModeled')}: ${first && !SUMMARY_BANNED.test(first) ? first : W('notModeledLong')}`;
    }
    const groups = new Map();
    for (const site of SUMMARY_SITES) {
      if (!o.perSite || !o.perSite[site]) continue;
      const word = level(o.perSite[site].visibility);
      if (!groups.has(word)) groups.set(word, []);
      groups.get(word).push(sitePlural(site));
    }
    if (!groups.size) return '';
    const rank = word => K('ORDINAL_TEXT').indexOf(word);
    const sentence = [...groups]
      .sort((a, b) => rank(b[0]) - rank(a[0]))
      .map(([word, sites], i) =>
        i
          ? `${andList(sites)} show ${word}`
          : `${andList(sites)} show ${word === 'none' ? 'no' : word} ${W('visibleSilver')}`
      )
      .join('; ');
    return `${capital(sentence)}. The background is at ${level(o.background)}; contrast is ${level(o.contrast)}.`;
  }
  function summarize(o, specimen) {
    const s = shell();
    if (s && typeof s.summarize === 'function') {
      try {
        const text = s.summarize(o, specimen);
        if (typeof text === 'string' && text) return text;
      } catch {
        /* the private copy below */
      }
    }
    return fallbackSummary(o);
  }

  // ---- Why? in the bench's words -----------------------------------------------------------------
  // Rule titles and the engine's caveats in plain words: the shell's CortexLab.plainRule / plainCaveat
  // when lab.js exports them, else these copies of lab.js LAB_EFFECT_WORDS / LAB_CAVEAT_WORDS (same
  // pairs, same order; test-lab-notebook pins that both give the same words). The engine text and the
  // rule ids stay under the nested Sources disclosure.
  const RULE_WORDS = [
    [
      /^Rate phase: schematic position of the development endpoint relative to the reference$/,
      "Timing: where the development time sits on the model's scale compared with the procedure's (before, at or after it)",
    ],
    // R-model-01 as a whole: "fixes" read as fixation, and the sentence named step 4 from step 2 (F15).
    [
      /^Binding \(schematic\): the model fixes the bound-ionic-silver ordinal at the ammoniacal-silver step from impregnation\.endpoint/,
      'Bound silver: the impregnation time sets how much silver binds; the model reads it at the ammoniacal silver bath (step 4)',
    ],
    [/^Binding \(schematic\): /, 'Bound silver: '],
    [/^Nuclei: /, 'Silver nuclei: '],
    [/^Deposit: /, 'Visible silver: '],
    [/^Visibility: /, 'What you see: '],
    [
      /^Background \(schematic assumption; no source for Bielschowsky\): /,
      'Background (an assumption of the model, with no source for this stain): ',
    ],
    [/the bound-ionic-silver ordinal/g, 'the bound silver level'],
    [/from impregnation\.endpoint/g, 'from the impregnation time'],
    [/at the ammoniacal-silver step/g, 'at the ammoniacal silver bath'],
    [/reduced-silver nuclei/g, 'silver nuclei'],
    [/grows deposit on nuclei/g, 'grows visible silver on the nuclei'],
    [/development endpoint/g, 'development time'],
    [/background deposit by one ordinal step/g, 'the background by one step on the model scale'],
    [
      /accumulated deposit, never presence and never bound ionic silver/g,
      'built-up silver, never the amount of target and never bound silver',
    ],
  ];
  const CAVEAT_WORDS = [
    [
      /Endpoint positions early \/ sop-default \/ extended are ordered schematic positions\./g,
      "Shorter, standard and longer are ordered places on the model's scale, not times.",
    ],
    [
      /Nothing is known about where the course SOP's actual times fall on any binding or deposition curve\./g,
      "No one knows where the course's real times fall on a binding or build-up curve.",
    ],
    [
      /Longer development is assumed to raise background in this schematic; no source in the registry supports or refutes this for Bielschowsky\./g,
      'The model assumes that longer development raises the background; no source in this lab supports or refutes this for this stain.',
    ],
    [
      /Toning and thiosulfate are recorded but have no modeled effect in v1 \(no sourced rule\)\.?/g,
      'Gold toning and thiosulfate are recorded in the log, but they change nothing in this teaching model (no rule with a source).',
    ],
    [/^Bielschowsky staining is reported/g, 'This stain is reported'],
    [
      /this run's temperature deviates from the SOP, so the outcome is low-confidence and no direction of change is encoded/g,
      "this run changes the temperature from the procedure's, so the model marks the picture low confidence and gives no direction of change",
    ],
    [
      /Protocol deviation: at least one step was performed out of the course procedure order or repeated\./g,
      'At least one step was done out of procedure order or done twice.',
    ],
    [
      /The illustrative state is whatever the performed order produced/g,
      'The picture is whatever that order produces in the model',
    ],
    [/describes the staining consequence of this deviation/g, 'describes what this does to a real stain'],
    [/so nothing beyond the recorded deviation is encoded/g, 'so the model adds nothing beyond the record'],
    [/The course SOP developer is not characterized here/g, "The course's developer is not described here"],
    [
      /the strength positions weak \/ sop-default \/ strong are ordered schematic positions only/g,
      "weaker, standard and stronger are only ordered places on the model's scale",
    ],
    [
      /are schematized from different bases \(ordinal model for the Bielschowsky run; Velasco 1992 description for CPS\)/g,
      'come from different bases (the teaching model for the Bielschowsky run; the Velasco 1992 description for CPS)',
    ],
    [
      /so per-site differences are not computed; view the two labeled outcomes side by side and read each method's own sources/g,
      'so no difference is computed; read each picture on its own, with its own sources',
    ],
    [
      /Compare-only method; not runnable on the bench; schematic from the published description\./g,
      'Compare only: no bench steps; the picture is drawn from the published description.',
    ],
    [/The cap on binding under wax is a schematic device/g, 'The cap on binding under wax is a device of the model'],
    [/\bthe schematic shows\b/g, 'the drawing shows'],
    [
      /Axon 0 and plaque core 1 \(trace\) are schematic readings of the CPS-II description/g,
      'Axons at none and plaque cores at trace are the drawing’s reading of the CPS-II description',
    ],
    [/\bin the registry\b/g, 'in this lab'],
  ];
  function shellWords(fnName, pairs, text) {
    const fn = shell() && shell()[fnName];
    if (typeof fn === 'function') {
      try {
        const out = fn(text);
        if (typeof out === 'string') return out;
      } catch {
        /* the private copy below */
      }
    }
    return pairs.reduce((out, [from, to]) => out.replace(from, to), String(text || ''));
  }
  const plainRule = text => shellWords('plainRule', RULE_WORDS, text);
  const plainCaveat = text => shellWords('plainCaveat', CAVEAT_WORDS, text);

  // ---- runs in plain words ----------------------------------------------------------------------
  const GROUP_STEP = {
    impregnation: 'silver-impregnation',
    ammoniacal: 'ammoniacal-silver',
    development: 'development',
    washes: 'water-wash',
  };
  function leaves(obj, prefix = '') {
    const out = [];
    for (const [k, v] of Object.entries(obj || {})) {
      if (isObj(v)) out.push(...leaves(v, `${prefix}${k}.`));
      else out.push([`${prefix}${k}`, v]);
    }
    return out;
  }
  // The effective-params view of a run (contract §2): each group from its step event, else run.params.
  function effectiveParams(run) {
    const view = {};
    const defaults = K('DEFAULT_PARAMS');
    for (const group of Object.keys(defaults)) {
      const step = GROUP_STEP[group],
        fromStep =
          step && run.effectiveParams && run.effectiveParams[step] ? run.effectiveParams[step][group] : undefined;
      view[group] = fromStep !== undefined ? fromStep : run.params ? run.params[group] : defaults[group];
    }
    return view;
  }
  const paramText = p => PARAM_TEXT[p] || p;
  // Endpoint and strength positions in the bench's words (shorter / longer, weaker / stronger).
  const VALUE_WORDS = { early: 'shorter', extended: 'longer', weak: 'weaker', strong: 'stronger' };
  // A parameter value in the bench's words: the shell's CortexLab.valueText(path, value) when lab.js
  // provides it, else the same words here (MODE-notebook: a pretreatment value, which no settings UI
  // offers any more, prints as its plain words like any other value).
  function valueText(lab, path, v) {
    const fn = shell() && shell().valueText;
    if (typeof fn === 'function') {
      try {
        const text = fn(path, v);
        if (typeof text === 'string' && text) return text;
      } catch {
        /* the private words below */
      }
    }
    // Gold toning and thiosulfate as the bench says them (lab.js labValueText): performed or skipped.
    if ((path === 'toning' || path === 'thiosulfate') && typeof v === 'boolean') return v ? 'performed' : 'skipped';
    return v === 'sop-default'
      ? W('standard')
      : v === 'deviated'
        ? W('changed')
        : v === 'unspecified'
          ? W('notSet')
          : v === true
            ? 'on'
            : v === false
              ? 'off'
              : VALUE_WORDS[v] || String(v).replace(/-/g, ' ');
  }
  function changesText(lab, run) {
    const defaults = leaves(K('DEFAULT_PARAMS')),
      actual = Object.fromEntries(leaves(effectiveParams(run)));
    const changed = defaults
      .filter(([k, v]) => actual[k] !== undefined && actual[k] !== v)
      .map(([k]) => `${paramText(k)}: ${valueText(lab, k, actual[k])}`);
    return changed.length ? changed.join(', ') : W('standard');
  }
  const stepTitle = (lab, stepId) => {
    const method = lab && typeof lab.getMethod === 'function' ? lab.getMethod(RUNNABLE_METHOD) : null,
      found = ((method && method.steps) || []).find(st => st && st.id === stepId);
    return (found && (found.studentTitle || found.title)) || String(stepId || '');
  };
  // "a step event for development" (engine) -> "the step “Develop the silver”" (HON-5).
  const neededText = (lab, x) => {
    const m = /^a step event for ([a-z0-9-]+)$/.exec(String(x || ''));
    return m ? `the step “${stepTitle(lab, m[1])}”` : plainText(x);
  };
  // A step done out of order, twice, or although the run's settings skip it (ENGINE-14 'not-planned'),
  // in the bench's words ("Done out of order: Develop the silver").
  const deviationWord = kind =>
    kind === 'out-of-order'
      ? W('outOfOrder')
      : kind === 'repeated'
        ? 'Done twice'
        : kind === 'not-planned'
          ? 'Done though your setting skips it'
          : '';
  const deviationWords = (lab, run) =>
    ((run && run.deviations) || [])
      .filter(d => d && deviationWord(d.kind))
      .map(d => `${deviationWord(d.kind)}: ${stepTitle(lab, d.step)}`);
  // The warning lines the bench's result card shows on its face (low confidence, a step done out of
  // order or twice): the shell's CortexLab.flags(run, result) when lab.js provides it, else the same here.
  function runFlags(lab, run, result) {
    const fn = shell() && shell().flags;
    if (typeof fn === 'function') {
      try {
        const out = fn(run, result);
        if (Array.isArray(out)) return out.filter(x => typeof x === 'string' && x);
      } catch {
        /* the private copy below */
      }
    }
    if (!run) return [];
    const out = [];
    if (isObj(result) && result.label === K('LABELS').SYNTHETIC && result.confidence === 'low')
      out.push(
        (result.rulesApplied || []).includes('R-temp-01')
          ? 'Low confidence: the impregnation temperature changed, and the model has no direction for that change.'
          : 'Low confidence: see Why?'
      );
    const deviations = deviationWords(lab, run);
    if (deviations.length) out.push(`${deviations.join('; ')}.`);
    return out;
  }
  // A recorded measurement's value: an ordinal in model-scale words, anything else with its unit.
  const isOrdinal = m => m.unit === 'ordinal' && typeof m.value === 'number';
  const measureValue = m =>
    isOrdinal(m) ? `${level(m.value)} (${W('modelScale')})` : `${m.value}${m.unit ? ` (${m.unit})` : ''}`;
  const getSpecimen = (lab, id) => (lab && typeof lab.getSpecimen === 'function' ? lab.getSpecimen(id) : null);
  const specimenName = (lab, id) => {
    const specimen = getSpecimen(lab, id);
    return specimen ? specimen.studentLabel || specimen.label : String(id || '');
  };
  function runName(run) {
    const title = shell() && shell().runTitle; // the shell's plain run name, when lab.js is loaded
    if (typeof title === 'function' && run && run.events) return title(run);
    const n = /(\d+)$/.exec(String(run.id || ''));
    const base = n ? `Run ${n[1]}` : `Run ${run.id}`;
    return run.label ? `${base}: ${run.label}` : base;
  }
  function runText(lab, run) {
    const compareOnly = run.method !== RUNNABLE_METHOD,
      method = compareOnly && lab && typeof lab.getMethod === 'function' ? lab.getMethod(run.method) : null;
    const name = runName(run),
      changes = changesText(lab, run),
      deviations = deviationWords(lab, run);
    // "standard (per procedure)" only for a procedure run done in order: a compare-only method is not the
    // procedure, and a run with a step out of order or done twice did not follow it.
    const what = compareOnly
      ? method
        ? 'compare only'
        : null
      : deviations.length && changes === W('standard')
        ? null
        : changes;
    // A copy's name already says what it changes ("copy of Run 1 · development time: longer").
    const said = what && name.toLowerCase().includes(what.toLowerCase());
    return [
      name,
      modeText(run),
      specimenName(lab, run.specimenId),
      method ? method.title : null,
      said ? null : what,
      deviations.length ? deviations.join('; ') : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  // MODE-notebook (contract §11.1 / §11.7): the run's mode in the report's run line. A stored run
  // without the field is a practice run, which the standard words already say, so only a free run
  // adds a word; a run that carries mode 'practice' says so only when its settings are not standard
  // (the "standard (per procedure)" words already say it otherwise).
  const MODE_TEXT = { practice: 'Practice the procedure', free: 'Free bench' };
  function modeText(run) {
    if (!run || typeof run.mode !== 'string') return null;
    if (run.mode === 'free') return MODE_TEXT.free;
    return null;
  }
  // The free run's What happened lines (one per reaction, the engine's plain words), from the
  // resolved outcome when it carries them, else the run's own log; [] for a practice run. A
  // reaction of kind 'unknown' (contract §13.6) always reads "Currently unknown reaction: …".
  const UNKNOWN_REACTION = 'Currently unknown reaction';
  function reactionLine(r) {
    const text = r && typeof r.text === 'string' ? r.text.trim() : '';
    if (!r || r.kind !== 'unknown' || text.startsWith(UNKNOWN_REACTION)) return text;
    return text ? `${UNKNOWN_REACTION}: ${text}` : `${UNKNOWN_REACTION}.`;
  }
  function reactionLines(run, outcome) {
    if (!run || run.mode !== 'free') return [];
    const list = Array.isArray(outcome && outcome.reactions)
      ? outcome.reactions
      : Array.isArray(run.reactions)
        ? run.reactions
        : [];
    return list.map(reactionLine).filter(Boolean);
  }
  // TONING-verify-1: over the steps the run needs (ENGINE-14: gold toning / thiosulfate drop out when
  // its setting skips them), as the bench counts; 9 and every step done when the engine's list is absent.
  function stepCount(run) {
    const params = isObj(run.params) ? run.params : {},
      skip = { 'gold-toning': params.toning === false, 'sodium-thiosulfate': params.thiosulfate === false },
      done = Array.isArray(run.stepsDone) ? run.stepsDone : [],
      needed = K('STEPS').filter(s => !skip[s]);
    if (!K('STEPS').length) return { done: done.length, total: 9 };
    return { done: needed.filter(s => done.includes(s)).length, total: needed.length };
  }
  function stepsText(run) {
    const { done, total } = stepCount(run);
    if (!(run.events || []).some(ev => ev && (ev.type === 'step' || ev.type === 'dip'))) return 'No steps done yet.';
    return done >= total ? `All ${total} steps done.` : `${done} of ${total} steps done.`;
  }
  function runsList(state) {
    const runs = isObj(state.runs) ? state.runs : {},
      order = Array.isArray(state.runOrder) && state.runOrder.length ? state.runOrder : Object.keys(runs);
    return order.map(id => runs[id]).filter(Boolean);
  }
  function safeResolve(lab, run) {
    try {
      return run && lab && typeof lab.resolve === 'function' ? lab.resolve(run) : null;
    } catch {
      return null;
    }
  }
  // Run sealing (lab.js writes state.sealed = { [runId]: expId }, ids only): a run that "Make the runs
  // for me" made for an experiment shows no outcome anywhere while that experiment is a draft that still
  // names it (lab.js labSealedExp, the same rule). `current` is the designer's own copy of an experiment
  // (newer than the stored one while it saves). `name` is the bench's: “<title>”, else "your experiment".
  // A twin (UX-LAST-lab.js-4: same specimen, method and modeled settings as a run the draft seals) is
  // not named by the experiment: lab.js decides it (CortexLab.isSealed), as on every bench surface.
  const shellSealed = runId => {
    try {
      const fn = shell() && shell().isSealed;
      return typeof fn === 'function' && fn(runId) === true;
    } catch {
      return false;
    }
  };
  function sealOf(state, runId, current) {
    const map = isObj(state) && isObj(state.sealed) ? state.sealed : null,
      expId = map && typeof map[runId] === 'string' ? map[runId] : '';
    if (!expId) return null;
    const stored = isObj(state.experiments) ? state.experiments[expId] : null,
      e = isObj(current) && current.id === expId ? current : stored,
      names = x => isObj(x) && (x.baselineRunId === runId || x.experimentalRunId === runId);
    if (!isObj(e) || e.status !== 'draft') return null;
    if (!names(e) && (names(stored) || !shellSealed(runId))) return null;
    const title = String(e.title || '').trim();
    return { expId, name: title ? `“${title}”` : 'your experiment' };
  }
  // "Sealed until you reveal “<title>”. Write your predictions first." with the second sentence a link
  // to that experiment's predictions (step 3), as the bench says it.
  function sealedLine(seal, attrs = {}) {
    return mk('p', { class: 'labn-sealed', 'data-labn-sealed': seal.expId, ...attrs }, [
      `Sealed until you reveal ${seal.name}. `,
      mk('a', {
        class: 'labn-link',
        href: viewHref({ view: 'designer', exp: seal.expId, step: LAST_STEP }),
        'data-lab-go': true,
        'data-labn-sealed-link': seal.expId,
        text: 'Write your predictions first.',
      }),
    ]);
  }
  // The engine's text alternative is one sentence per clause; put each clause on its own line
  // (newlines only: the words are the engine's and stay untouched). Rendered with white-space: pre-line.
  const escapeRegExp = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function breakClauses(text) {
    const starters = [
      ...K('SITE_CLASSES').map(siteText),
      'Background',
      'Contrast',
      'Artifacts',
      'Conditional on',
      'Caveats',
      'Outside support',
      'What would be needed',
      'Suggested next',
    ];
    const re = new RegExp(`\\. (?=(?:${starters.map(escapeRegExp).join('|')}):)`, 'g');
    return String(text || '').replace(re, '.\n');
  }
  function modulePrompts(lab, moduleId) {
    const mod = lab && typeof lab.getModule === 'function' ? lab.getModule(moduleId) : null,
      out = {};
    for (const step of (mod && mod.steps) || []) if (step && step.field && step.prompt) out[step.field] = step.prompt;
    return out;
  }
  // A model-scale table (Why? expanders only): words, never a bare number, with the scale legend.
  function scaleTable(head, rows) {
    return mk('table', { class: 'labn-table' }, [
      mk('caption', { class: 'labn-caption', text: W('scaleLegend') }),
      mk('thead', {}, [
        mk(
          'tr',
          {},
          head.map(text => mk('th', { scope: 'col', text }))
        ),
      ]),
      mk(
        'tbody',
        {},
        rows.map(([site, ...cells]) =>
          mk('tr', {}, [mk('th', { scope: 'row', text: siteText(site) }), ...cells.map(text => mk('td', { text }))])
        )
      ),
    ]);
  }

  function blankExperiment(id) {
    return {
      id: id || null,
      status: 'draft',
      title: '',
      background: '',
      question: '',
      hypothesis: '',
      alternative: '',
      independentVariable: '',
      measures: [],
      heldComparable: [],
      changed: [],
      controls: [],
      predictions: { expected: '', negligible: '', opposite: '' },
      limitations: '',
      baselineRunId: '',
      experimentalRunId: '',
      interpretation: null,
    };
  }
  function normalizeExperiment(raw, id) {
    const base = blankExperiment(id),
      src = isObj(raw) ? clone(raw) : {},
      exp = { ...base, ...src };
    exp.id = src.id || id || null;
    if (!['draft', 'revealed', 'done'].includes(exp.status)) exp.status = 'draft';
    for (const key of ['measures', 'heldComparable', 'changed', 'controls'])
      exp[key] = Array.isArray(src[key]) ? src[key] : [];
    exp.controls = exp.controls
      .filter(isObj)
      .map(c => ({ type: String(c.type || ''), addresses: String(c.addresses || '') }));
    exp.predictions = { ...base.predictions, ...(isObj(src.predictions) ? src.predictions : {}) };
    exp.interpretation = isObj(src.interpretation)
      ? { supports: '', failsToEstablish: '', next: '', ...src.interpretation }
      : null;
    if (blankInterpretation(exp.interpretation)) exp.interpretation = null;
    for (const key of [
      'title',
      'background',
      'question',
      'hypothesis',
      'alternative',
      'independentVariable',
      'limitations',
    ])
      exp[key] = typeof exp[key] === 'string' ? exp[key] : '';
    for (const key of ['baselineRunId', 'experimentalRunId']) exp[key] = typeof exp[key] === 'string' ? exp[key] : '';
    return exp;
  }
  const INTERPRETATION_KEYS = ['supports', 'failsToEstablish', 'next'];
  // Three empty answers are not an interpretation: they are stored as null, so the export keeps reading
  // "Interpretation: not written" until the student writes something.
  const blankInterpretation = i => isObj(i) && !INTERPRETATION_KEYS.some(k => filled(i[k]));
  const interpretationComplete = exp =>
    !!exp.interpretation && ['supports', 'failsToEstablish', 'next'].every(k => filled(exp.interpretation[k]));
  // Engine gate reasons → the field they are about (the wording stays the engine's, in data-labn-reason).
  function reasonField(reason) {
    const r = String(reason);
    let m = /^predictions\.(expected|negligible|opposite) is empty$/.exec(r);
    if (m) return { field: `predictions.${m[1]}` };
    if (r === 'no control is specified') return { field: 'controls' };
    if (r === 'independentVariable is empty') return { field: 'independentVariable' };
    if (r === 'no outcome measure is chosen') return { field: 'measures' };
    m = /^(baselineRunId|experimentalRunId) does not name a run$/.exec(r);
    if (m) return { field: m[1] };
    m = /^(baselineRunId|experimentalRunId) \(.*\) has no step event$/.exec(r);
    if (m) return { field: m[1], note: 'no steps done yet' };
    return null;
  }
  const WARNING_TEXT = [
    [/^independentVariable is not listed under changed$/, 'Your main variable is not in “What you change”.'],
    [
      /^a control does not say which alternative explanation it addresses$/,
      'Each control needs the explanation it rules out.',
    ],
    [/^measure .* is not a measurement rule id$/, 'One saved outcome measure is no longer in the list.'],
  ];
  const warningText = w => (WARNING_TEXT.find(([re]) => re.test(String(w))) || [null, String(w)])[1];

  // ---- the bench's changes (lab.js CortexLab.changeOptions / matchChange) ----------------------------
  // "What you change" suggests only the changes the bench's "What do you want to change?" select can make,
  // in its order and words ("Development time: longer"), so "Make the runs for me" makes exactly the
  // change the student picked. Without both functions the designer keeps its plain setting names and has
  // no such button.
  function changeApi() {
    const s = shell();
    return s && typeof s.changeOptions === 'function' && typeof s.matchChange === 'function' ? s : null;
  }
  function benchMatch(api, text) {
    const t = String(text || '').trim();
    if (!api || !t) return null;
    try {
      const m = api.matchChange(t);
      return isObj(m) && typeof m.id === 'string' && m.id ? m : null;
    } catch {
      return null;
    }
  }
  // The procedure's own value of a setting is no change.
  const STANDARD_VALUES = ['sop-default', 'none'];
  // Bench changes no sourced rule covers (contract §2.1): changed washes. Such a run resolves to an
  // uncertainty card, so the reveal says Not modeled. (Skipping gold toning or thiosulfate is modeled
  // since §11.5, R-model-10: the course procedure says what the skip leaves.)
  const NOT_MODELED_CHANGES = { washes: ['deviated'] };
  // One suggestion per non-standard value ("<setting>: <value>"), else the setting's name, and only text
  // the bench recognizes (matchChange), so every suggestion can be made. [] when the list is unusable.
  function benchChanges(api) {
    let options;
    try {
      options = api ? api.changeOptions() : null;
    } catch {
      options = null;
    }
    const out = [];
    for (const opt of Array.isArray(options) ? options : []) {
      const name = isObj(opt) && typeof opt.label === 'string' ? opt.label.trim() : '';
      if (!name) continue;
      const values = (Array.isArray(opt.values) ? opt.values : []).filter(
        v => isObj(v) && typeof v.label === 'string' && v.label.trim() && !STANDARD_VALUES.includes(v.value)
      );
      const named = values.map(v => `${name}: ${v.label.trim()}`).filter(t => benchMatch(api, t));
      if (named.length) out.push(...named);
      else if (values.length && benchMatch(api, name)) out.push(name);
    }
    return [...new Set(out)];
  }

  // ---- designer: two screens, Plan and Predict and reveal -----------------------------------------
  function mountDesigner(container, opts) {
    if (!container || typeof container.appendChild !== 'function')
      throw new Error('CortexLabNotebook.mountDesigner needs a container element');
    let o = { ...(opts || {}) };
    let lab = o.lab,
      state = isObj(o.state) ? o.state : {};
    if (!lab) throw new Error('CortexLabNotebook.mountDesigner needs { lab }');
    let exp = loadExperiment(),
      reveal = null,
      changes = [],
      saveTimer = null,
      lastSaved = null,
      offRun = null,
      destroyed = false,
      step = startStep();
    const ids = {},
      id = name => (ids[name] = ids[name] || uid(name));
    const root = mk('div', { class: 'labn labn-designer' });
    container.appendChild(root);

    function runsById() {
      return isObj(o.runsById) ? o.runsById : isObj(state.runs) ? state.runs : {};
    }
    function loadExperiment() {
      const experiments = isObj(state.experiments) ? state.experiments : {};
      let key = o.experimentId;
      if (!key) {
        const order = Array.isArray(state.experimentOrder) ? state.experimentOrder : Object.keys(experiments);
        key = order[order.length - 1];
      }
      const raw = key ? experiments[key] : null,
        found = normalizeExperiment(raw, key || null);
      if (!isObj(raw)) found.createdAt = nowIso();
      return found;
    }
    // A revealed experiment opens on the last screen; `step` may ask for another one (an old link's 3 or
    // 4 lands on the last screen), except that a draft with nothing planned yet always opens on screen 1.
    function startStep() {
      const wanted = Math.round(Number(o.step));
      if (exp.status === 'draft' && !WIZARD[0].fields.some(f => filled(exp[f]))) return 1;
      return wanted >= 1 ? Math.min(LAST_STEP, wanted) : exp.status !== 'draft' ? LAST_STEP : 1;
    }
    // The address names this experiment and its step, so a reload (or a phone discarding the tab) opens
    // the same draft at the same step. Only under ?view=designer; replaceState, so Back still leaves.
    function syncUrl() {
      const hist = window.history;
      if (destroyed || !hist || typeof hist.replaceState !== 'function') return;
      let url;
      try {
        url = new URL(window.location.href);
      } catch {
        return;
      }
      if (url.searchParams.get('view') !== 'designer') return;
      if (exp.id) url.searchParams.set('exp', exp.id);
      url.searchParams.set('step', String(step));
      url.searchParams.delete('at'); // where the microscope sent the student back to; used once
      const next = `${url.pathname}${url.search}${url.hash}`;
      if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
      try {
        hist.replaceState(hist.state, '', next);
      } catch {
        /* the address is a convenience; the page works without it */
      }
    }
    // Every link from the designer to the microscope says where it came from (from=designer, this
    // experiment, the wizard step), so the microscope's back link and Esc can return here (lab.js owns
    // those). The href is built with the shell's CortexLab.url when lab.js is loaded, else like every
    // other link here, and refreshed when the step changes and on click (the id may be adopted after a
    // render); a plain click opens the microscope through CortexLab.openMicroscope (see onClick).
    // `at` names the part of step 4 the link sits in ('measures', 'compare'), so the way back lands there.
    function scopeHref(runIds, at) {
      const params = {
        view: 'microscope',
        run: runIds.join(','),
        from: 'designer',
        exp: exp.id || null,
        step,
        at: AT_ANCHORS[at] ? at : null,
      };
      const url = shell() && shell().url;
      if (typeof url === 'function') {
        try {
          const href = url(params);
          if (typeof href === 'string' && href) return href;
        } catch {
          /* the module's own link below */
        }
      }
      return viewHref(params);
    }
    function scopeLink(runIds, attrs, children, at) {
      return mk(
        'a',
        {
          class: 'labn-link',
          href: scopeHref(runIds, at),
          'data-lab-go': true,
          ...attrs,
          'data-labn-scope-runs': runIds.join(','),
          'data-labn-scope-at': at || null,
        },
        children
      );
    }
    function refreshScopeLinks() {
      for (const link of root.querySelectorAll('a[data-labn-scope-runs]'))
        link.setAttribute(
          'href',
          scopeHref(link.getAttribute('data-labn-scope-runs').split(','), link.getAttribute('data-labn-scope-at'))
        );
    }
    // Back from the microscope (at=<anchor>, passed through by lab.js): step 4 opens on the section the
    // student left, its heading focused, instead of the top of the page.
    function goToAnchor(at) {
      const sel = AT_ANCHORS[at],
        section = sel && step === LAST_STEP ? q(`[data-labn-reveal] ${sel}`) : null,
        heading = section ? section.querySelector('.labn-h4') : null;
      if (!heading) return false;
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      const scroll = () => {
        if (typeof section.scrollIntoView === 'function') section.scrollIntoView({ block: 'start' });
      };
      scroll();
      // Once more after layout settles (pictures, fonts), unless the student has moved on already.
      if (typeof window.requestAnimationFrame === 'function')
        window.requestAnimationFrame(() => {
          if (!destroyed && document.activeElement === heading) scroll();
        });
      return true;
    }
    function initialAnchor() {
      if (typeof o.at === 'string') return o.at;
      try {
        const params = new URL(window.location.href).searchParams;
        return params.get('view') === 'designer' ? params.get('at') : null;
      } catch {
        return null;
      }
    }

    // ---- persistence -------------------------------------------------------------------------
    function setSaveStatus(kind, message) {
      const node = root.querySelector('[data-labn-save]');
      if (!node) return;
      node.dataset.labnSave = kind;
      node.textContent =
        message ||
        {
          idle: '',
          saving: 'Saving',
          saved: 'Saved',
          paused: 'Saving is paused (browser storage is unavailable). Your edits stay on this page.',
          error: 'Saving failed.',
        }[kind];
    }
    function applySaveResult(result) {
      if (result === false) return setSaveStatus('paused');
      if (isObj(result)) {
        if (typeof result.id === 'string' && !exp.id) {
          exp.id = result.id;
          renderHeader();
          renderOthers();
          syncUrl();
        }
        if (result.ok === false || result.paused) return setSaveStatus('paused', result.message);
        if (result.message) return setSaveStatus('saved', result.message);
      }
      return setSaveStatus('saved');
    }
    // "Development time: longer vs standard": the title of an experiment the student left untitled.
    function fillTitle() {
      if (filled(exp.title)) return;
      const change =
        exp.changed.map(t => String(t).trim()).find(Boolean) || String(exp.independentVariable || '').trim();
      if (!change) return;
      exp.title = `${change} vs standard`;
      const input = q(`#${ids.title}`);
      if (input && input.value !== exp.title) input.value = exp.title;
    }
    function persist() {
      saveTimer = null;
      if (blankInterpretation(exp.interpretation)) exp.interpretation = null;
      fillTitle();
      const snapshot = clone(exp);
      lastSaved = JSON.stringify(snapshot);
      if (typeof o.onSave !== 'function') {
        // No shell callback: keep the shared state object current so the notebook export sees it.
        if (exp.id && isObj(state.experiments)) {
          state.experiments[exp.id] = snapshot;
          if (Array.isArray(state.experimentOrder) && !state.experimentOrder.includes(exp.id))
            state.experimentOrder.push(exp.id);
        }
        return setSaveStatus('saved', 'Kept on this page');
      }
      let result;
      try {
        result = o.onSave(snapshot);
      } catch (err) {
        return setSaveStatus('error', `Saving failed: ${err && err.message ? err.message : err}`);
      }
      if (result && typeof result.then === 'function') {
        setSaveStatus('saving');
        result.then(applySaveResult, err =>
          setSaveStatus('error', `Saving failed: ${err && err.message ? err.message : err}`)
        );
        return undefined;
      }
      return applySaveResult(result);
    }
    function scheduleSave() {
      if (destroyed) return;
      setSaveStatus('saving');
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(persist, 400);
    }
    function flushSave() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        persist();
      }
    }

    // ---- static markup -------------------------------------------------------------------------
    const prompts6 = modulePrompts(lab, 'M6');
    const req = '<span class="labn-req">required</span>',
      opt = '<span class="labn-req labn-opt">optional</span>';
    const helpFor = field => {
      const [hint, example] = FIELD_HELP[field] || ['', ''];
      const prompt = field.startsWith('predictions.') ? prompts6[field.slice('predictions.'.length)] : null;
      return [prompt || hint, example];
    };
    const textField = (field, { rows = 0, lock = true, extra = '' } = {}) => {
      const [hint, example] = helpFor(field),
        hintId = id(`${field}-hint`),
        described = extra ? `${hintId} ${id(`${field}-extra`)}` : hintId;
      const control = rows
        ? `<textarea id="${id(field)}" class="labn-textarea" rows="${rows}" data-labn-field="${field}" placeholder="${esc(example)}" aria-describedby="${described}"></textarea>`
        : `<input id="${id(field)}" class="labn-input" type="text" data-labn-field="${field}" autocomplete="off" placeholder="${esc(example)}" aria-describedby="${described}">`;
      return `<div class="labn-field"${lock ? ' data-labn-lock' : ''}><label class="labn-label" for="${id(field)}">${esc(FIELD_TEXT[field])} ${OPTIONAL_FIELDS.includes(field) ? opt : req}</label><p class="labn-hint" id="${hintId}">${esc(hint)}</p>${extra ? `<div id="${id(`${field}-extra`)}">${extra}</div>` : ''}${control}</div>`;
    };
    // The four hypotheses name "reduction sites"; one plain gloss under the list (UX-FIX-data, F12).
    const REDUCTION_SITE_GLOSS =
      '<p class="labn-hint">A reduction site is a spot in the tissue that can turn silver ions into metal.</p>';
    const hypothesisList = `<p class="labn-hint">The course raises these four explanations; none is established:</p><ul class="labn-hint-list">${K(
      'HYPOTHESES'
    )
      .map(
        hid =>
          `<li>${esc(K('HYPOTHESIS_TEXT')[hid] || hid)}${HYPOTHESIS_GLOSS[hid] ? `<span class="labn-gloss" data-labn-gloss="${esc(hid)}">${esc(HYPOTHESIS_GLOSS[hid])}</span>` : ''}</li>`
      )
      .join('')}</ul>${REDUCTION_SITE_GLOSS}`;
    // The folds of screen 1 (SIMPLE-notebook): the glossary, the optional question fields, the optional
    // comparison fields. Each is a .labn-disclose button and a hidden panel (foldHtml).
    const fold = (name, text, body) =>
      `<div class="labn-field labn-fold">${foldHtml(name, text, body, id(`${name}-panel`))}</div>`;
    const stepHead = s =>
      `<h2 class="labn-h2 labn-step-h" id="${id(`step-${s.n}-h`)}" tabindex="-1"><span class="labn-step-of">Step ${s.n} of ${LAST_STEP}</span> ${esc(s.title)}</h2><p class="labn-lede">${esc(s.lede)}</p>`;
    const stepCheck = s => `<p class="labn-step-check" data-labn-step-check="${s.n}"></p>`;
    const stepSection = (s, body) =>
      `<section class="labn-step" data-labn-wizard-step="${s.n}" aria-labelledby="${id(`step-${s.n}-h`)}" hidden>${stepHead(s)}${body}${s.n === 1 ? stepCheck(s) : ''}</section>`;
    root.innerHTML = `
      <div class="labn-wizard-head">
        <ol class="labn-progress" aria-label="Steps">${WIZARD.map(
          s =>
            `<li class="labn-progress-item" data-labn-progress="${s.n}"><button type="button" class="labn-progress-btn" data-labn-action="wizard-go" data-labn-step="${s.n}"><span class="labn-sr-only">Step ${s.n}: </span><span class="labn-progress-n" aria-hidden="true">${s.n}</span><span class="labn-progress-name">${esc(s.name)}</span><span class="labn-progress-done" data-labn-progress-done></span></button></li>`
        ).join('')}</ol>
        <div class="labn-status-row" data-labn-header></div>
      </div>
      <p class="labn-others" data-labn-others hidden></p>
      <p class="labn-lock-note" role="note" data-labn-lock-note hidden>Your plan is locked now that you have seen the outcome.</p>
      <datalist id="${id('paths')}">${Object.values(PARAM_TEXT)
        .map(p => `<option value="${esc(p)}"></option>`)
        .join('')}</datalist>
      <datalist id="${id('changes')}" data-labn-changes></datalist>
      ${stepSection(
        WIZARD[0],
        `${textField('title', { lock: false })}${textField('question', { rows: 2 })}${textField('hypothesis', { rows: 3 })}${fold('glossary', 'The four explanations the course raises', hypothesisList)}${fold(
          'more-question',
          'More detail: background, another explanation',
          `${textField('background', { rows: 3 })}${textField('alternative', { rows: 2 })}`
        )}
        <fieldset class="labn-group" data-labn-lock><legend class="labn-legend">What changes and what stays the same</legend>
          <div class="labn-field" data-labn-chips="changed"></div>
          ${fold(
            'more-design',
            'More detail: main variable, what you keep the same',
            `${textField('independentVariable')}<div class="labn-field" data-labn-chips="heldComparable"></div>`
          )}
        </fieldset>
        <fieldset class="labn-group" data-labn-lock data-labn-controls aria-describedby="${id('controls-hint')} ${id('controls-note')}"></fieldset>
        <fieldset class="labn-group" data-labn-lock aria-describedby="${id('measures-hint')}"><legend class="labn-legend">${esc(FIELD_TEXT.measures)} ${req}</legend>
          <p class="labn-hint" id="${id('measures-hint')}">Choose how you will measure, before you look. Each one comes with a rule you agree to.</p>
          <div data-labn-measures></div>
        </fieldset>
        <fieldset class="labn-group" data-labn-lock aria-describedby="${id('runs-hint')}"><legend class="labn-legend">Your two runs ${req}</legend>
          <p class="labn-hint" id="${id('runs-hint')}">They should differ only in what you change. Both need their steps done on the bench before you can reveal.</p>
          <div data-labn-runs></div>
        </fieldset>`
      )}
      ${stepSection(
        WIZARD[1],
        `${PREDICTION_KEYS.map(k =>
          textField(`predictions.${k}`, {
            rows: 3,
            extra: k === 'opposite' ? `<p class="labn-hint" data-labn-procedure-note>${esc(PROCEDURE_NOTE)}</p>` : '',
          })
        ).join('')}${textField('limitations', { rows: 2, lock: false })}${stepCheck(WIZARD[1])}
        <div class="labn-gate" data-labn-gate>
          <div id="${id('reasons')}" class="labn-reasons" aria-live="polite" aria-atomic="true"></div>
          <p class="labn-also" data-labn-also hidden></p>
          <button type="button" id="${id('reveal')}" class="btn btn-solid labn-btn labn-reveal-btn" data-labn-action="reveal" aria-describedby="${id('reasons')}" disabled aria-disabled="true">Reveal the simulated outcome</button>
        </div>
        <section class="labn-summary" data-labn-summary aria-labelledby="${id('summary-h')}" hidden></section>
        <section class="labn-reveal" aria-label="Outcome cards and interpretation" data-labn-reveal></section>`
      )}
      <div class="labn-wizard-nav" role="group" aria-label="Move between steps">
        <button type="button" id="${id('back')}" class="btn labn-btn" data-labn-action="wizard-back">Back</button>
        <button type="button" id="${id('next')}" class="btn btn-solid labn-btn" data-labn-action="wizard-next">Next</button>
      </div>`;

    const q = sel => root.querySelector(sel);

    function renderHeader() {
      const node = q('[data-labn-header]');
      if (!node.childElementCount)
        node.replaceChildren(
          mk('span', { class: 'pill labn-status' }),
          mk('p', { class: 'labn-save', role: 'status', 'data-labn-save': 'idle' })
        );
      const pill = node.querySelector('.labn-status');
      pill.className = `pill labn-status ${exp.status === 'done' ? 'ok' : exp.status === 'revealed' ? 'mid' : ''}`;
      pill.setAttribute('data-labn-status', exp.status);
      pill.textContent = `Status: ${STATUS_TEXT[exp.status] || exp.status}`;
    }
    function fillStatic() {
      for (const key of [
        'title',
        'background',
        'question',
        'hypothesis',
        'alternative',
        'independentVariable',
        'limitations',
      ])
        q(`#${ids[key]}`).value = exp[key] || '';
      for (const key of PREDICTION_KEYS) q(`#${ids[`predictions.${key}`]}`).value = exp.predictions[key] || '';
    }

    // Other experiments in this browser, as links (a reload of a new proposal, or "New proposal", must
    // never leave a saved draft out of reach).
    function renderOthers() {
      const node = q('[data-labn-others]'),
        all = isObj(state.experiments) ? state.experiments : {},
        order = [
          ...new Set([...(Array.isArray(state.experimentOrder) ? state.experimentOrder : []), ...Object.keys(all)]),
        ],
        others = order.filter(key => key !== exp.id && isObj(all[key]));
      node.replaceChildren();
      node.hidden = !others.length;
      if (!others.length) return;
      node.appendChild(document.createTextNode(`Your other experiment${others.length === 1 ? '' : 's'}: `));
      others.forEach((key, i) => {
        const other = all[key],
          status = (STATUS_TEXT[other.status] || STATUS_TEXT.draft).toLowerCase();
        if (i) node.appendChild(document.createTextNode(' · '));
        node.appendChild(
          mk('a', {
            class: 'labn-link',
            href: viewHref({ view: 'designer', exp: key }),
            'data-lab-go': true,
            'data-labn-other': key,
            text: `${other.title || 'Untitled experiment'} (${status})`,
          })
        );
      });
    }

    // ---- wizard navigation -------------------------------------------------------------------------
    // `sync` (user navigation) writes the step into the address; the first render leaves it alone.
    function goToStep(n, { focus = true, sync = true } = {}) {
      step = Math.min(LAST_STEP, Math.max(1, n));
      for (const section of root.querySelectorAll('[data-labn-wizard-step]'))
        section.hidden = Number(section.getAttribute('data-labn-wizard-step')) !== step;
      for (const button of root.querySelectorAll('[data-labn-action="wizard-go"]')) {
        if (Number(button.getAttribute('data-labn-step')) === step) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      }
      const back = q('[data-labn-action="wizard-back"]'),
        next = q('[data-labn-action="wizard-next"]');
      back.hidden = step === 1;
      back.textContent = step > 1 ? `Back: ${WIZARD[step - 2].name}` : 'Back';
      next.hidden = step === LAST_STEP;
      next.textContent = step < LAST_STEP ? `Next: ${WIZARD[step].name}` : 'Next';
      refreshScopeLinks();
      if (focus) {
        const heading = q(`#${ids[`step-${step}-h`]}`);
        if (heading) heading.focus();
      }
      if (sync) syncUrl();
    }
    // A "things left" link: open the field's step and put focus on the field.
    function jumpTo(field) {
      goToStep(stepOf(field), { focus: false });
      const target =
        field === 'changed' || field === 'heldComparable'
          ? q(`input[data-labn-chip-input="${field}"]`)
          : field === 'controls'
            ? q('input[data-labn-control-type]')
            : field === 'measures'
              ? q('input[data-labn-field="measures"]')
              : q(`[data-labn-field="${field}"]`);
      if (target) openFolds(target, root);
      if (target && !target.disabled) target.focus();
      else q(`#${ids[`step-${step}-h`]}`).focus();
    }
    const jumpLink = (field, text) =>
      mk('a', { href: `#${id(field)}`, class: 'labn-jump', 'data-labn-jump': field, text });

    // M2 (NOTE-5): once revealed, the pre-registered design is read-only. Text controls get readonly
    // (still focusable and readable), selects, checkboxes and buttons get disabled. Title, limitations
    // and the interpretation stay editable; the shell's onSave refuses the locked fields as well.
    const locked = () => exp.status !== 'draft';
    function applyLock() {
      const lock = locked();
      for (const control of root.querySelectorAll(
        '[data-labn-lock] input, [data-labn-lock] textarea, [data-labn-lock] select, [data-labn-lock] button:not(.labn-disclose)'
      )) {
        const textual =
          control.tagName === 'TEXTAREA' ||
          (control.tagName === 'INPUT' && control.type !== 'checkbox' && control.type !== 'radio');
        if (textual) control.readOnly = lock;
        else control.disabled = lock;
      }
      const note = q('[data-labn-lock-note]');
      if (note) note.hidden = !lock;
      syncRequestRuns();
    }

    // ---- the bench's changes and "Make the runs for me" -------------------------------------------
    // The suggestions for "What you change" (and the main variable) are the bench's own changes when
    // lab.js lists them; otherwise the plain setting names and no "Make the runs for me".
    function renderChangeList() {
      changes = benchChanges(changeApi());
      q('[data-labn-changes]').replaceChildren(...changes.map(t => mk('option', { value: t })));
      const main = q(`#${ids.independentVariable}`);
      if (changes.length) main.setAttribute('list', ids.changes);
      else main.removeAttribute('list');
    }
    // The change the runs will differ in, read the way lab.js reads it for "Make the runs for me" (its
    // labChangeForExperiment), with CortexLab.matchChange only: every "What you change" item must be a
    // bench change, the main variable counts when it is one, and together they must name one setting
    // and one value other than the procedure's. { ok } or { ok: false, why, text }; nothing is guessed.
    function plannedChange() {
      const api = changeApi(),
        said = t => String(t ?? '').trim(),
        changed = exp.changed.map(said).filter(Boolean),
        mainText = said(exp.independentVariable),
        main = benchMatch(api, mainText);
      const unknown = changed.find(t => !benchMatch(api, t));
      if (unknown) return { ok: false, why: 'unknown', text: unknown };
      const matches = changed.map(t => benchMatch(api, t)).concat(main ? [main] : []);
      if (!matches.length) return { ok: false, why: mainText ? 'unknown' : 'empty', text: mainText };
      if (new Set(matches.map(m => m.id)).size > 1) return { ok: false, why: 'several' };
      const values = [...new Set(matches.map(m => m.value).filter(v => v !== null && v !== undefined))];
      if (values.length > 1) return { ok: false, why: 'several' };
      const text = changed[0] || mainText;
      if (!values.length) return { ok: false, why: 'direction', text };
      if (STANDARD_VALUES.includes(values[0])) return { ok: false, why: 'standard', text };
      return { ok: true, id: matches[0].id, value: values[0] };
    }
    // Disabled, with a one-line reason, until the planned change is one the bench can make. A change the
    // model has no rule for stays available, with a note before the button that the reveal will say
    // Not modeled (honest expectation-setting, not a refusal).
    function syncRequestRuns() {
      const button = q('[data-labn-action="request-runs"]'),
        reason = q('[data-labn-request-reason]'),
        note = q('[data-labn-request-note]');
      if (!button || !reason) return;
      const planned = plannedChange(),
        lock = locked();
      if (note) note.hidden = !(!lock && planned.ok && (NOT_MODELED_CHANGES[planned.id] || []).includes(planned.value));
      button.disabled = lock || !planned.ok;
      reason.hidden = lock || planned.ok;
      reason.setAttribute('data-labn-request-reason', reason.hidden ? '' : planned.why);
      if (reason.hidden) {
        reason.replaceChildren();
        return;
      }
      const pick = jumpLink('changed', 'Pick one from the list');
      reason.replaceChildren(
        ...{
          empty: () => [jumpLink('changed', 'Pick what you change'), ' from the list first.'],
          unknown: () => [`“${planned.text}” is not one of the changes the bench can make. `, pick, '.'],
          direction: () => [`“${planned.text}” does not say which way to change it. `, pick, '.'],
          standard: () => [`“${planned.text}” is the procedure’s own setting, not a change. `, pick, '.'],
          several: () => [
            'The bench makes one change at a time. ',
            jumpLink('changed', 'Keep one in “What you change”'),
            ' and the same one as your main variable.',
          ],
        }[planned.why]()
      );
    }

    // ---- step 2 parts ------------------------------------------------------------------------------
    function renderChips(field) {
      // "What you change" offers the bench's own changes when lab.js lists them (renderChangeList).
      const bench = field === 'changed' && changes.length > 0,
        host = q(`[data-labn-chips="${field}"]`),
        [hint, example] = bench
          ? [
              'Pick the setting that differs between your two runs from the list. Usually just one.',
              `e.g. ${changes.find(t => /^development time: longer$/i.test(t)) || changes[0]}`,
            ]
          : helpFor(field),
        inputId = id(`${field}-input`),
        listId = id(`${field}-list`),
        hintId = id(`${field}-hint`);
      host.replaceChildren();
      host.appendChild(
        h(
          `<label class="labn-label" for="${inputId}">${esc(FIELD_TEXT[field])} ${OPTIONAL_FIELDS.includes(field) ? opt : req}</label>`
        )
      );
      host.appendChild(mk('p', { class: 'labn-hint', id: hintId, text: hint }));
      const list = mk('ul', { class: 'labn-chips', id: listId, 'aria-label': `${FIELD_TEXT[field]}: items` });
      for (const [index, item] of exp[field].entries()) {
        list.appendChild(
          mk('li', { class: 'labn-chip' }, [
            mk('span', { text: item }),
            mk('button', {
              type: 'button',
              class: 'labn-chip-x',
              'data-labn-action': 'chip-remove',
              'data-labn-list': field,
              'data-labn-index': index,
              'aria-label': `Remove ${item} from ${FIELD_TEXT[field]}`,
              text: '×',
            }),
          ])
        );
      }
      if (exp[field].length) host.appendChild(list);
      const row = mk('div', { class: 'labn-chip-row' });
      row.appendChild(
        mk('input', {
          id: inputId,
          class: 'labn-input',
          type: 'text',
          list: bench ? ids.changes : ids.paths,
          autocomplete: 'off',
          'data-labn-chip-input': field,
          'aria-describedby': exp[field].length ? `${hintId} ${listId}` : hintId,
          placeholder: example,
        })
      );
      row.appendChild(
        mk(
          'button',
          { type: 'button', class: 'btn labn-btn', 'data-labn-action': 'chip-add', 'data-labn-list': field },
          ['Add', mk('span', { class: 'labn-sr-only', text: ` to ${FIELD_TEXT[field]}` })]
        )
      );
      host.appendChild(row);
      applyLock();
    }
    function renderMeasures() {
      const host = q('[data-labn-measures]'),
        rules = typeof lab.measurementRules === 'function' ? lab.measurementRules() : [];
      keepFocus(host, () => {
        host.replaceChildren();
        if (!rules.length) host.appendChild(mk('p', { class: 'labn-hint', text: 'No measurement rules are defined.' }));
        for (const rule of rules) {
          const boxId = id(`measure-${rule.id}`),
            lineId = id(`measure-line-${rule.id}`),
            ruleId = id(`rule-${rule.id}`),
            howId = id(`measure-how-${rule.id}`),
            chosen = exp.measures.includes(rule.id);
          // The box is described in plain words; the written rule (engine wording) waits under "Full rule".
          const box = mk('input', {
            type: 'checkbox',
            id: boxId,
            value: rule.id,
            'data-labn-field': 'measures',
            'aria-describedby': `${lineId} ${howId}`,
          });
          box.checked = chosen;
          const firstSentence = /^(.*?\.)(\s|$)/.exec(rule.rule || '');
          const full = mk('div', { class: 'labn-disclosure labn-rule-full' }, [
            mk('p', { text: `Full rule: ${rule.rule}` }),
            mk('p', {
              class: 'labn-meta',
              text: rule.manual
                ? `You record this by hand (${rule.unit}).`
                : "Read from the simulated picture; the model's own value is saved in the note.",
            }),
          ]);
          host.appendChild(
            mk('div', { class: 'labn-check' }, [
              box,
              mk('div', { class: 'labn-check-copy' }, [
                mk('label', { for: boxId, class: 'labn-check-title', text: rule.title }),
                mk('p', {
                  class: 'labn-check-line',
                  id: lineId,
                  text: MEASURE_LINE[rule.id] || (firstSentence ? firstSentence[1] : rule.rule),
                }),
                mk('div', { class: 'labn-rule', id: ruleId, 'data-labn-measure-detail': rule.id, hidden: !chosen }, [
                  mk('p', {
                    id: howId,
                    text: `You agree to this rule before you look. ${MEASURE_HOW[rule.id] || (rule.manual ? `You record it by hand (${rule.unit}).` : 'The microscope reads it from the simulated picture.')}`,
                  }),
                  disclosure('Full rule', full, { srText: `: ${rule.title}` }),
                  full,
                ]),
              ]),
            ])
          );
        }
      });
      applyLock();
    }
    function renderControls() {
      const host = q('[data-labn-controls]');
      keepFocus(host, () => {
        host.replaceChildren(
          h(`<legend class="labn-legend">${esc(FIELD_TEXT.controls)} ${req}</legend>`),
          mk('p', {
            class: 'labn-hint',
            id: id('controls-hint'),
            text: 'Pick at least one, and say which other explanation it rules out.',
          })
        );
        for (const ct of CONTROL_TYPES) {
          const boxId = id(`control-${ct.type}`),
            hintId = id(`control-hint-${ct.type}`),
            indexes = exp.controls.map((c, i) => (c.type === ct.type ? i : -1)).filter(i => i >= 0);
          // A checked box names the field it adds (right after it in tab order) in its description.
          const box = mk('input', {
            type: 'checkbox',
            id: boxId,
            'data-labn-control-type': ct.type,
            'aria-describedby': [hintId, ...indexes.map(i => id(`control-addr-label-${i}`))].join(' '),
            'aria-controls': indexes.length ? indexes.map(i => id(`control-addr-${i}`)).join(' ') : null,
          });
          box.checked = indexes.length > 0;
          const copy = mk('div', { class: 'labn-check-copy' }, [
            mk('label', { for: boxId, class: 'labn-check-title', text: ct.text }),
            mk('p', { class: 'labn-check-line', id: hintId, text: ct.hint }),
          ]);
          for (const [k, index] of indexes.entries()) {
            const addrId = id(`control-addr-${index}`),
              input = mk('input', {
                id: addrId,
                class: 'labn-input',
                type: 'text',
                'data-labn-field': `controls.${index}.addresses`,
                autocomplete: 'off',
                placeholder: 'e.g. that the stain did not work at all',
              });
            input.value = exp.controls[index].addresses || '';
            copy.appendChild(
              mk('div', { class: 'labn-field labn-subfield' }, [
                mk('label', { class: 'labn-label', for: addrId, id: id(`control-addr-label-${index}`) }, [
                  `Which other explanation does it rule out?${indexes.length > 1 ? ` (${k + 1})` : ''} `,
                  mk('span', { class: 'labn-req', text: 'required' }),
                ]),
                input,
              ])
            );
          }
          host.appendChild(mk('div', { class: 'labn-check' }, [box, copy]));
        }
        // Controls of a type this version does not know stay in the experiment untouched.
        const other = exp.controls.filter(c => !CONTROL_TYPES.some(ct => ct.type === c.type));
        if (other.length)
          host.appendChild(
            mk('p', {
              class: 'labn-meta',
              text: `Also saved: ${other.map(c => `${c.type}${c.addresses ? ` (${c.addresses})` : ''}`).join('; ')}.`,
            })
          );
        host.appendChild(
          mk('p', {
            class: 'labn-note',
            id: id('controls-note'),
            text: `Every specimen here is a ${W('practiceSpecimen')}, so your report marks each control as a stand-in: a made-up specimen with no known staining history.`,
          })
        );
      });
      applyLock();
    }
    function renderRuns() {
      const host = q('[data-labn-runs]'),
        runs = runsList(state);
      keepFocus(host, () => {
        host.replaceChildren();
        for (const field of ['baselineRunId', 'experimentalRunId']) {
          const selectId = id(field),
            summaryId = id(`${field}-summary`);
          const select = mk('select', {
            id: selectId,
            class: 'labn-select',
            'data-labn-field': field,
            'aria-describedby': summaryId,
          });
          select.appendChild(mk('option', { value: '', text: runs.length ? 'Choose a run' : 'No runs yet' }));
          for (const run of runs) {
            const option = mk('option', { value: run.id, text: `${runText(lab, run)}${sealWords(run)}` });
            if (run.id === exp[field]) option.selected = true;
            select.appendChild(option);
          }
          if (exp[field] && !runs.some(r => r.id === exp[field])) {
            const option = mk('option', { value: exp[field], text: `${exp[field]} (run not found)` });
            option.selected = true;
            select.appendChild(option);
          }
          host.appendChild(
            mk('div', { class: 'labn-field' }, [
              mk('label', { class: 'labn-label', for: selectId, text: FIELD_TEXT[field] }),
              select,
              mk('p', { class: 'labn-hint labn-run-summary', id: summaryId, 'data-labn-run-summary': field }),
            ])
          );
        }
        // "Make the runs for me" only when the bench lists its changes (CortexLab.changeOptions): it makes
        // the change the student picked from that list, never a guess (syncRequestRuns).
        if (changes.length)
          host.appendChild(
            mk('div', { class: 'labn-chip-row labn-request' }, [
              mk('p', {
                class: 'labn-hint labn-request-note',
                id: id('request-note'),
                'data-labn-request-note': true,
                hidden: true,
                text: 'The model has no rule for this change, so the reveal will say Not modeled. That is a valid result to interpret.',
              }),
              mk('button', {
                type: 'button',
                id: id('request-runs'),
                class: 'btn labn-btn',
                'data-labn-action': 'request-runs',
                'aria-describedby': `${id('request-hint')} ${id('request-reason')} ${id('request-note')}`,
                text: 'Make the runs for me',
              }),
              mk('p', {
                class: 'labn-hint labn-request-reason',
                id: id('request-reason'),
                'data-labn-request-reason': true,
                hidden: true,
              }),
              mk('p', {
                class: 'labn-hint labn-request-hint',
                id: id('request-hint'),
                text: 'Opens the bench with both runs, every step done: a standard run (one you already finished, if you have one) and a copy with your change. What a new run shows stays hidden until you reveal this experiment.',
              }),
            ])
          );
        renderRunSummaries();
      });
      applyLock();
    }
    // A run made for a draft (RUN SEALING): "ready (sealed)" once its steps are done, its outcome kept
    // for the reveal of the experiment it was made for.
    const runFinished = run => {
      const { done, total } = stepCount(run);
      return Array.isArray(run.stepsDone) && done >= total;
    };
    function sealWords(run) {
      const seal = sealOf(state, run.id, exp);
      if (!seal) return '';
      if (seal.expId !== exp.id) return ' · sealed';
      return runFinished(run) ? ' · ready (sealed)' : ' · sealed';
    }
    function renderRunSummaries() {
      const runs = runsById();
      for (const field of ['baselineRunId', 'experimentalRunId']) {
        const node = q(`[data-labn-run-summary="${field}"]`);
        if (!node) continue;
        const run = runs[exp[field]],
          seal = run ? sealOf(state, run.id, exp) : null;
        node.toggleAttribute('data-labn-run-sealed', !!seal);
        if (seal && seal.expId === exp.id) {
          node.textContent = runFinished(run)
            ? 'Ready (sealed): all steps done. You see its outcome when you reveal this experiment.'
            : `${stepsText(run)} Sealed: you see its outcome when you reveal this experiment.`;
          continue;
        }
        if (seal) {
          node.textContent = `Sealed until you reveal ${seal.name}. Choose another run, or reveal that experiment first.`;
          continue;
        }
        node.textContent = !exp[field]
          ? 'No run chosen.'
          : !run
            ? exp.status !== 'draft'
              ? "This proposal's run is no longer in your runs."
              : 'This run is no longer in your runs.'
            : stepsText(run);
      }
    }
    // A run sealed for ANOTHER draft experiment keeps its outcome for that reveal: this one waits.
    function sealConflicts() {
      const runs = runsById();
      return [...new Set([exp.baselineRunId, exp.experimentalRunId])]
        .filter(rid => rid && runs[rid])
        .map(rid => ({ run: runs[rid], seal: sealOf(state, rid, exp) }))
        .filter(x => x.seal && x.seal.expId !== exp.id)
        .map(x => `${runName(x.run)} is sealed until you reveal ${x.seal.name}`);
    }

    // ---- inline checks and the gate ---------------------------------------------------------------
    let lastCheckKey = null,
      lastGateKey = null,
      lastGate = { ok: false, reasons: [] };
    function currentCheck() {
      try {
        return lab.checkExperiment(exp);
      } catch (err) {
        return { complete: false, missing: [], overlaps: [], warnings: [`Completeness check failed: ${err.message}`] };
      }
    }
    // A finished step shows a check mark in the progress list (and the words "done" for screen readers).
    function markDone(n, done) {
      const item = q(`[data-labn-progress="${n}"]`);
      item.classList.toggle('labn-progress-complete', done);
      item
        .querySelector('[data-labn-progress-done]')
        .replaceChildren(
          ...(done
            ? [
                mk('span', { 'aria-hidden': 'true', text: ' ✓' }),
                mk('span', { class: 'labn-sr-only', text: ' (done)' }),
              ]
            : [])
        );
    }
    // The completeness check is inline: a line under each step, a mark in the progress list, and on
    // step 4 the boxes that are still empty although the reveal does not need them.
    function renderCheck() {
      const check = currentCheck(),
        key = JSON.stringify([check, lastGate.reasons, !!(reveal && reveal.ok), exp.status]);
      if (key === lastCheckKey) return;
      lastCheckKey = key;
      const missing = check.missing || [],
        overlaps = check.overlaps || [],
        warnings = (check.warnings || []).map(warningText);
      // One line per screen: what is still empty, then the optional fields the engine lists, as a
      // soft hint. Screen 1 is done when nothing required is empty; screen 2 when the experiment is.
      for (const s of WIZARD) {
        const left = s.fields.filter(f => missing.includes(f) && !OPTIONAL_FIELDS.includes(f)),
          soft = s.fields.filter(f => missing.includes(f) && OPTIONAL_FIELDS.includes(f) && f !== 'title'),
          extra =
            s.n === 1 ? [...overlaps.map(x => `“${x}” is listed as both changed and kept the same.`), ...warnings] : [],
          node = q(`[data-labn-step-check="${s.n}"]`),
          parts = [
            left.length ? `Still empty: ${left.map(f => LEFT_TEXT[f]).join(', ')}.` : '',
            ...extra,
            soft.length ? `Optional, still empty: ${soft.map(f => LEFT_TEXT[f]).join(', ')}.` : '',
          ].filter(Boolean);
        node.textContent = parts.length
          ? parts.join(' ')
          : s.n === 1
            ? 'Your plan is complete.'
            : 'Your predictions are written.';
        node.classList.toggle('labn-ok', !left.length && !extra.length);
        markDone(s.n, s.n === 1 ? !left.length && !overlaps.length : exp.status === 'done');
      }
      // The last screen, once the gate is open: fields the reveal does not wait for, as links (while it
      // is closed only the blocking "things left" show, so the list stays short). The title is filled
      // in on its own, so it is never asked for.
      const blocking = new Set(lastGate.reasons.map(r => (reasonField(r) || {}).field).filter(Boolean)),
        also = q('[data-labn-also]'),
        rest = missing.filter(f => !blocking.has(f) && f !== 'title');
      also.replaceChildren();
      also.hidden = !!(reveal && reveal.ok) || !lastGate.ok || (!rest.length && !overlaps.length);
      if (also.hidden) return;
      if (rest.length) {
        also.appendChild(document.createTextNode('Still empty (fill these in first if you can): '));
        rest.forEach((f, i) => {
          if (i) also.appendChild(document.createTextNode(' · '));
          also.appendChild(jumpLink(f, LEFT_TEXT[f] || f));
        });
        also.appendChild(document.createTextNode('.'));
      }
      if (overlaps.length) {
        also.appendChild(
          document.createTextNode(`${rest.length ? ' ' : ''}Listed as both changed and kept the same: `)
        );
        also.appendChild(jumpLink('changed', overlaps.join(', ')));
        also.appendChild(document.createTextNode('.'));
      }
    }
    function reasonItem(reason) {
      const mapped = reasonField(reason),
        item = mk('li', { 'data-labn-reason': reason });
      if (!mapped) {
        item.textContent = reason;
        return item;
      }
      item.appendChild(jumpLink(mapped.field, `${LEFT_TEXT[mapped.field]}${mapped.note ? `: ${mapped.note}` : ''}`));
      item.appendChild(mk('span', { class: 'labn-meta', text: ` (step ${stepOf(mapped.field)})` }));
      return item;
    }
    function renderGate() {
      const host = q('[data-labn-gate]'),
        reasons = host.querySelector('.labn-reasons'),
        button = host.querySelector('[data-labn-action="reveal"]');
      let gate;
      try {
        gate = lab.canReveal(exp, runsById());
      } catch (err) {
        gate = { ok: false, reasons: [`Gate check failed: ${err.message}`] };
      }
      const sealed = sealConflicts();
      if (sealed.length) gate = { ok: false, reasons: [...(gate.reasons || []), ...sealed] };
      lastGate = gate;
      const revealed = !!(reveal && reveal.ok),
        key = JSON.stringify([gate, revealed]);
      if (key === lastGateKey) return;
      lastGateKey = key;
      host.hidden = revealed;
      // The live region persists across changes (only its children are replaced) so that assistive
      // technology announces each change; a region created together with its text is never announced.
      if (revealed) reasons.replaceChildren(mk('p', { text: 'Revealed. Your outcome is shown below.' }));
      else if (gate.ok) reasons.replaceChildren(mk('p', { class: 'labn-ok', text: 'Ready to reveal.' }));
      else
        reasons.replaceChildren(
          mk('p', {
            class: 'labn-left-h',
            text: `${gate.reasons.length} ${gate.reasons.length === 1 ? 'thing' : 'things'} left before you can reveal:`,
          }),
          mk('ul', { class: 'labn-left' }, gate.reasons.map(reasonItem))
        );
      button.disabled = !gate.ok;
      if (gate.ok) button.removeAttribute('aria-disabled');
      else button.setAttribute('aria-disabled', 'true');
    }
    function refreshChecks() {
      renderGate();
      renderCheck();
      renderHeader();
      renderSummary();
      renderDone();
      syncRequestRuns();
    }

    // ---- the last screen: the locked design, the cards, the interpretation ---------------------------
    // An engine sentence in the bench's words: the caveat wording, `path = value` (CortexLab.plain), and
    // the run id, card code, step ids and probe id that a Not modeled side's caveat carries.
    function plainLine(text) {
      return plainText(plainCaveat(text))
        .replace(
          /^Run (\S+) resolved to an uncertainty card \(([a-z-]+)\); per-site differences are not computed\./,
          (all, rid, code) => {
            const run = runsById()[rid];
            return `${run ? runName(run) : 'One run'}: ${code === 'step-skipped' ? W('inProgress').toLowerCase() : W('notModeled')}, so no difference is computed.`;
          }
        )
        .replace(
          /The run has no step event for ([a-z0-9-]+(?:, [a-z0-9-]+)*); the model only resolves a complete run of the method\./,
          (all, list) =>
            `${W('inProgress')}: ${list
              .split(', ')
              .map(st => stepTitle(lab, st))
              .join(', ')}.`
        )
        .replace(/Pretreatment "([^"]+)"/g, (all, probe) => `Pretreatment ${valueText(lab, 'pretreatment', probe)}`);
    }
    // "Why the model did this" as plain rule titles (ids under Sources), and "Keep in mind" in plain words.
    function ruleTitleList(ruleIds) {
      const titles = (ruleIds || [])
        .map(rid => (typeof lab.getRule === 'function' ? lab.getRule(rid) : null))
        .filter(rule => rule && rule.title);
      return titles.length
        ? [
            mk('p', { class: 'labn-meta', text: 'Why the model did this:' }),
            mk(
              'ul',
              { class: 'labn-list' },
              titles.map(rule => mk('li', { text: plainRule(rule.title) }))
            ),
          ]
        : [];
    }
    function keepInMindList(caveats) {
      return (caveats || []).length
        ? [
            mk('p', { class: 'labn-meta', text: `${W('keepInMind')}:` }),
            mk(
              'ul',
              { class: 'labn-list', 'data-labn-keep': true },
              caveats.map(c => mk('li', { text: plainLine(c) }))
            ),
          ]
        : [];
    }
    function cardLabel(card) {
      if (card.kind === 'outcome') return (card.outcome && card.outcome.label) || K('LABELS').SYNTHETIC;
      return (card.card && card.card.label) || K('LABELS').NO_BASIS;
    }
    function renderSummary() {
      const host = q('[data-labn-summary]');
      if (!locked()) {
        host.hidden = true;
        host.replaceChildren();
        return;
      }
      host.hidden = false;
      const runs = runsById(),
        rules = typeof lab.measurementRules === 'function' ? lab.measurementRules() : [],
        runLine = (word, runId) => `${word}: ${runs[runId] ? runText(lab, runs[runId]) : runId || 'none chosen'}`;
      const rows = [
        ['Question', exp.question],
        ['Hypothesis', exp.hypothesis],
        ['Another explanation', exp.alternative],
        [
          'What you change',
          [exp.changed.join(', '), exp.independentVariable ? `Main variable: ${exp.independentVariable}` : ''],
        ],
        ['What you keep the same', exp.heldComparable.join(', ')],
        [
          'Controls',
          [
            ...exp.controls.map(c => {
              const ct = CONTROL_TYPES.find(x => x.type === c.type);
              return `${ct ? ct.text : c.type}${c.addresses ? `: rules out ${c.addresses}` : ''}`;
            }),
            exp.controls.length ? `Stand-ins: every specimen is a ${W('practiceSpecimen')}.` : '',
          ],
        ],
        ['Outcome measures', exp.measures.map(m => (rules.find(r => r.id === m) || { title: m }).title).join(', ')],
        [
          'Predictions',
          PREDICTION_KEYS.map(k => `${LEFT_TEXT[`predictions.${k}`]}: ${exp.predictions[k] || '(empty)'}`),
        ],
        ['Runs', [runLine('Baseline', exp.baselineRunId), runLine('Experimental', exp.experimentalRunId)]],
      ];
      const dl = mk('dl', { class: 'labn-dl' });
      for (const [term, value] of rows) {
        const lines = [].concat(value).filter(filled);
        dl.appendChild(mk('dt', { text: term }));
        dl.appendChild(
          mk(
            'dd',
            {},
            lines.length
              ? lines.map(line => mk('p', { text: line }))
              : [mk('p', { class: 'labn-meta', text: '(empty)' })]
          )
        );
      }
      host.replaceChildren(
        mk('h3', { class: 'labn-h3', id: id('summary-h'), text: 'Your design (locked)' }),
        mk('p', { class: 'labn-hint', text: 'You wrote this before the reveal; it stays as it was.' }),
        dl
      );
    }
    // Next to the comparison, "The background is at low" reads as if nothing moved: the experimental
    // card then says how the background moved (rose / fell to, from). Its assumption note stays only
    // when the comparison line below does not already carry one (one honesty note per screen).
    function cardSummary(card, subject, specimen, comparison) {
      const text = summarize(subject, specimen),
        row = comparison && comparison.perSite ? comparison.perSite.background : null;
      if (card.kind !== 'outcome' || card.conditionalOn || !isObj(row) || !row.delta) return text;
      const said = !!assumptionNote(comparison);
      return text.replace(
        /\bThe background is at ([a-z]+)(?: \(([^)]*)\))?/,
        (all, word, note) =>
          `The background ${row.delta > 0 ? 'rose' : 'fell'} to ${word} (from ${level(row.baseline)}${note && !said ? `; ${note}` : ''})`
      );
    }
    function renderCard(card, index, total, specimen, ctx = {}) {
      const lbl = cardLabel(card),
        subject = card.kind === 'outcome' ? card.outcome : card.card,
        hypText = card.conditionalOn ? K('HYPOTHESIS_TEXT')[card.conditionalOn] || card.conditionalOn : null;
      const article = mk('article', {
        class: `labn-card labn-card-${card.kind}`,
        'data-labn-label': lbl,
        'aria-labelledby': id(`card-${index}`),
      });
      article.appendChild(
        mk('div', { class: 'labn-card-head' }, [
          mk('h4', {
            class: 'labn-h4 labn-card-title',
            id: id(`card-${index}`),
            text: total > 1 ? `Your experimental run, card ${index + 1} of ${total}` : 'Your experimental run',
          }),
          outcomeBadge(isObj(subject) ? subject : { label: lbl }),
        ])
      );
      if (hypText) article.appendChild(mk('p', { class: 'labn-conditional', text: `Conditional on: ${hypText}` }));
      article.appendChild(
        mk('p', {
          class: 'labn-plain',
          'data-labn-plain': true,
          text: cardSummary(card, subject, specimen, ctx.comparison),
        })
      );
      // The same warnings the bench's result card shows on its face (low confidence, a step out of order).
      for (const flag of runFlags(lab, ctx.run, isObj(subject) ? subject : null))
        article.appendChild(mk('p', { class: 'labn-flag', 'data-labn-flag': true, text: flag }));
      // Why? in the bench's words (table, contrast, rule titles, Keep in mind); the engine's own text and
      // the rule ids sit one level down, under Sources.
      const why = [];
      if (card.kind === 'outcome' && card.outcome && card.outcome.perSite) {
        why.push(
          scaleTable(
            ['Site', `Visible silver (${W('modelScale')})`],
            K('SITE_CLASSES').map(site => [
              site,
              card.outcome.perSite[site] ? level(card.outcome.perSite[site].visibility) : 'not modeled',
            ])
          ),
          mk('p', { 'data-labn-contrast': true }, [
            'Contrast: ',
            mk('strong', { text: level(card.outcome.contrast) }),
            ` (${W('modelScale')}): how many steps the darkest structure sits above the background (0 none … 4 high); not an amount of protein.`,
          ]),
          ...ruleTitleList(card.outcome.rulesApplied),
          ...keepInMindList(card.outcome.caveats)
        );
      }
      if (card.kind === 'uncertainty' && isObj(card.card)) {
        const c = card.card;
        if (Array.isArray(c.whatWouldBeNeeded) && c.whatWouldBeNeeded.length)
          article.appendChild(
            mk('div', { class: 'labn-needed' }, [
              mk('p', { class: 'labn-meta', text: 'What the model would need:' }),
              mk(
                'ul',
                { class: 'labn-list' },
                c.whatWouldBeNeeded.map(x => mk('li', { text: neededText(lab, x) }))
              ),
            ])
          );
        if (Array.isArray(c.hypotheses) && c.hypotheses.length) {
          article.appendChild(
            mk('p', { class: 'labn-meta', text: 'No direction is encoded for any of the four explanations:' })
          );
          article.appendChild(
            mk(
              'ul',
              { class: 'labn-list' },
              c.hypotheses.map(hid => mk('li', { text: K('HYPOTHESIS_TEXT')[hid] || hid }))
            )
          );
        }
        if (c.explanation) why.push(mk('p', { text: plainLine(c.explanation) }));
        if (Array.isArray(c.suggestedNext) && c.suggestedNext.length)
          why.push(
            mk('p', { class: 'labn-meta', text: 'What you could do next:' }),
            mk(
              'ul',
              { class: 'labn-list' },
              c.suggestedNext.map(x => mk('li', { text: plainLine(x) }))
            )
          );
      }
      const ruleIds = isObj(subject) ? subject.rulesApplied || subject.rulesConsulted || [] : [];
      why.push(
        ...sourcesBlock([
          mk('p', { class: 'labn-card-body', text: breakClauses(card.body) }),
          ruleIds.length
            ? mk('p', {
                class: 'labn-meta labn-mono',
                text: `${card.kind === 'outcome' ? 'Rules applied' : 'Rules consulted'}: ${ruleIds.join(', ')}`,
              })
            : null,
        ])
      );
      article.append(...whyBlock(why));
      return article;
    }
    // Baseline and experimental pictures side by side, drawn by the microscope's own renderer with its
    // label plate painted in. Only when lab-microscope.js is loaded and both runs give a simulated picture
    // (a Not modeled run has no picture; its card says so in words).
    function thumbRow(pair) {
      const scope = window.CortexLabMicroscope;
      if (!scope || typeof scope.renderSynthetic !== 'function' || !pair.every(Boolean)) return null;
      const outs = pair.map(run => safeResolve(lab, run));
      if (!outs.every(out => isObj(out) && out.label === K('LABELS').SYNTHETIC)) return null;
      const row = mk('div', { class: 'labn-thumbs', 'data-labn-thumbs': true });
      pair.forEach((run, i) => {
        const specimen = getSpecimen(lab, run.specimenId),
          canvas = mk('canvas', {
            class: 'labn-thumb-canvas',
            role: 'img',
            'aria-label': `${W('simulated')}: picture of ${runName(run)}`,
          });
        try {
          scope.renderSynthetic(canvas, {
            specimen,
            outcome: outs[i],
            width: 216,
            height: 162,
            objective: 4,
            zoom: 1,
            seed: specimen ? specimen.seed : undefined,
            highContrast: !!(state.settings && state.settings.highContrast),
            tag: false,
          });
        } catch {
          return;
        }
        row.appendChild(
          mk('figure', { class: 'labn-thumb' }, [
            canvas,
            mk('figcaption', { text: `${i ? 'Experimental' : 'Baseline'}: ${runName(run)}` }),
          ])
        );
      });
      return row.childElementCount ? row : null;
    }
    function renderComparison(comparison) {
      const section = mk('section', { class: 'labn-compare', 'aria-labelledby': id('compare-h') });
      section.appendChild(
        mk('div', { class: 'labn-card-head' }, [
          mk('h4', { class: 'labn-h4', id: id('compare-h'), text: 'Compared with your baseline' }),
          comparisonBadge(comparison),
        ])
      );
      const changed = comparison.changedParams || [];
      section.appendChild(
        mk('p', {}, [
          mk('strong', { text: 'What differs between the runs: ' }),
          changed.length ? changed.map(paramText).join(', ') : 'nothing',
        ])
      );
      const pair = [exp.baselineRunId, exp.experimentalRunId].map(rid => runsById()[rid]);
      const thumbs = thumbRow(pair);
      if (thumbs) section.appendChild(thumbs);
      if (pair.every(Boolean))
        section.appendChild(
          mk('p', { class: 'labn-scope-link' }, [
            scopeLink(
              pair.map(run => run.id),
              { 'data-labn-scope-link': true },
              'Look at both in the microscope',
              'compare'
            ),
          ])
        );
      const why = [];
      if (comparison.perSite) {
        // Sites grouped by how far they moved, lesion structures first, the background last.
        const byMove = new Map();
        for (const site of [...SUMMARY_SITES, 'background']) {
          const row = comparison.perSite[site];
          if (!row || !row.delta) continue;
          const move = moveText(row.delta);
          if (!byMove.has(move)) byMove.set(move, []);
          byMove.get(move).push(site === 'background' ? 'the background' : sitePlural(site));
        }
        section.appendChild(
          mk('p', {
            class: 'labn-plain',
            'data-labn-plain': true,
            text: byMove.size
              ? `${capital([...byMove].map(([move, sites]) => `${andList(sites)} moved ${move}`).join('; '))} on the ${W('modelScale')}${assumptionNote(comparison) ? ` (${assumptionNote(comparison)})` : ''}.`
              : `Nothing moved on the ${W('modelScale')}.`,
          })
        );
        why.push(
          scaleTable(
            ['Site', 'Baseline', 'Experimental', 'Change'],
            Object.entries(comparison.perSite).map(([site, row]) => [
              site,
              level(row.baseline),
              level(row.experimental),
              moveText(row.delta),
            ])
          )
        );
      } else
        section.appendChild(
          mk('p', { class: 'labn-plain', text: 'The model gives no site-by-site comparison for this pair.' })
        );
      const ruleIds = comparison.rulesResponsible || [],
        caveats = comparison.caveats || [];
      why.push(...ruleTitleList(ruleIds), ...keepInMindList(caveats));
      // Engine words and ids only under Sources: the setting paths, the rule ids, the caveats as written.
      const sources = [
        changed.length
          ? mk('p', { class: 'labn-meta labn-mono', text: `Changed settings: ${changed.join(', ')}` })
          : null,
        ruleIds.length
          ? mk('p', { class: 'labn-meta labn-mono', text: `Rules responsible: ${ruleIds.join(', ')}` })
          : null,
        ...(caveats.length
          ? [
              mk('p', { class: 'labn-meta', text: `${W('keepInMind')}, as the model words it:` }),
              mk(
                'ul',
                { class: 'labn-list' },
                caveats.map(c => mk('li', { text: c }))
              ),
            ]
          : []),
      ].filter(Boolean);
      if (sources.length) why.push(...sourcesBlock(sources));
      if (why.length) section.append(...whyBlock(why));
      return section;
    }
    // notModeled: a card is Not modeled (no rule covers the change; not a run still in progress), so the
    // engine's "What would this outcome support?" gets the question that makes it answerable.
    function renderInterpretation(prompts, cards, notModeled = false) {
      const form = mk('form', {
        class: 'labn-form labn-interpretation',
        novalidate: true,
        'aria-labelledby': id('interp-h'),
      });
      form.appendChild(mk('h3', { class: 'labn-h3', id: id('interp-h'), text: 'Interpret' }));
      form.appendChild(
        mk('p', {
          class: 'labn-hint',
          text: `${cards > 1 ? 'Answer once for all the cards. ' : ''}All three answers are needed before the experiment counts as done.`,
        })
      );
      if (notModeled)
        form.appendChild(
          mk('p', {
            class: 'labn-hint',
            id: id('interp-not-modeled'),
            'data-labn-not-modeled-prompt': true,
            text: `${W('notModeledLong')} What does it mean that the model cannot say?`,
          })
        );
      // Each answer is named the same way as in the export ("What it supports", ...); the engine's
      // prompt is the hint under the name.
      for (const key of ['supports', 'failsToEstablish', 'next']) {
        const fieldId = id(`interpretation.${key}`),
          hintId = id(`interpretation.${key}-hint`);
        const area = mk('textarea', {
          id: fieldId,
          class: 'labn-textarea',
          rows: 3,
          'data-labn-field': `interpretation.${key}`,
          required: true,
          'aria-required': 'true',
          'aria-describedby': notModeled && key === 'supports' ? `${id('interp-not-modeled')} ${hintId}` : hintId,
        });
        area.value = (exp.interpretation && exp.interpretation[key]) || '';
        form.appendChild(
          mk('div', { class: 'labn-field' }, [
            mk('label', { class: 'labn-label', for: fieldId }, [
              `${INTERPRETATION_TEXT[key]} `,
              mk('span', { class: 'labn-req', text: 'required' }),
            ]),
            mk('p', { class: 'labn-hint', id: hintId, text: prompts[key] || INTERPRETATION_FALLBACK[key] }),
            area,
          ])
        );
      }
      form.addEventListener('submit', ev => ev.preventDefault());
      return form;
    }
    // Under the interpretation: "Experiment done" and a way to the report once all three answers exist.
    // The status line exists before it gets text, so the change is announced.
    function renderDone() {
      const line = q('[data-labn-done-line]'),
        link = q('[data-labn-report-link]');
      if (!line || !link) return;
      const done = exp.status === 'done',
        text = done ? 'Experiment done. It is in your report, in the Experiment log.' : '';
      if (line.textContent !== text) line.textContent = text;
      link.hidden = !done;
    }
    // RC-1: the outcome measures the student chose, for both runs and the change, before the cards.
    // Contrast, and the background it is read against, come from the comparison's two outcomes in
    // model-scale words. A measure the student records by hand has no model value: its line sends the
    // student to the microscope. Measurements already recorded for these two runs show with their badge.
    function modelLine(title, key, sides) {
      const [b, e] = sides.map(o => (isObj(o) && typeof o[key] === 'number' ? o[key] : null));
      if (b !== null && e !== null)
        return b === e
          ? `${title}: ${level(b)} in both runs (no change on the ${W('modelScale')}).`
          : `${title}: ${level(b)} in the baseline, ${level(e)} in the experimental run (${moveText(e - b)} on the ${W('modelScale')}).`;
      const gaps = ['baseline', 'experimental']
        .map((side, i) =>
          [b, e][i] !== null
            ? null
            : isObj(sides[i])
              ? `the ${side} run is ${outcomeKind(sides[i]) === 'in-progress' ? 'not finished' : W('notModeled')}`
              : `the ${side} run is missing`
        )
        .filter(Boolean);
      return `${title}: no model value, because ${andList(gaps)}.`;
    }
    function renderMeasuresOut(comparison) {
      if (!exp.measures.length) return null;
      const rules = typeof lab.measurementRules === 'function' ? lab.measurementRules() : [],
        runs = runsById(),
        pair = [exp.baselineRunId, exp.experimentalRunId],
        sides = ['baseline', 'experimental'].map((side, i) =>
          isObj(comparison) && isObj(comparison[side]) ? comparison[side] : safeResolve(lab, runs[pair[i]])
        ),
        measurements = isObj(state.measurements) ? state.measurements : {},
        order = Array.isArray(state.measurementOrder) ? state.measurementOrder : Object.keys(measurements);
      const section = mk('section', {
        class: 'labn-measures-out',
        'data-labn-measures-out': true,
        'aria-labelledby': id('measures-out-h'),
      });
      section.appendChild(
        mk('div', { class: 'labn-card-head' }, [
          mk('h4', { class: 'labn-h4', id: id('measures-out-h'), text: 'Your outcome measures' }),
          isObj(comparison) ? comparisonBadge(comparison) : outcomeBadge(sides[1]),
        ])
      );
      const list = mk('ul', { class: 'labn-measures-list' });
      for (const mid of exp.measures) {
        const rule = rules.find(r => r.id === mid) || { id: mid, title: mid, manual: true },
          item = mk('li', { class: 'labn-measure-out', 'data-labn-measure-out': mid });
        if (mid === 'contrast-ordinal') {
          item.appendChild(
            mk('p', {
              class: 'labn-plain',
              'data-labn-measure-line': true,
              text: modelLine(rule.title, 'contrast', sides),
            })
          );
          if (sides.every(o => isObj(o) && typeof o.background === 'number'))
            item.appendChild(
              mk('p', { class: 'labn-measure-sub', text: modelLine('Background', 'background', sides) })
            );
        } else {
          const both = pair.every(rid => runs[rid]);
          item.appendChild(
            mk('p', { class: 'labn-plain', 'data-labn-measure-line': true }, [
              `${rule.title}: the model gives no value for this; measure it yourself. `,
              both
                ? scopeLink(
                    pair,
                    { 'data-labn-measure-scope': mid },
                    [
                      'Open both runs in the microscope',
                      mk('span', { class: 'labn-sr-only', text: ` to measure: ${rule.title}` }),
                    ],
                    'measures'
                  )
                : 'Open both runs in the microscope.',
            ])
          );
        }
        const recorded = order
          .map(key => measurements[key])
          .filter(m => isObj(m) && m.measurementId === mid && pair.includes(m.runId));
        if (recorded.length)
          item.appendChild(
            mk(
              'ul',
              { class: 'labn-list labn-recorded', 'aria-label': `Recorded: ${rule.title}` },
              recorded.map(m =>
                mk('li', { 'data-labn-recorded': m.id || true }, [
                  `Recorded for the ${m.runId === pair[0] ? 'baseline' : 'experimental'} run: ${measureValue(m)}${m.manual ? ', by hand' : ''} `,
                  badgeNode(labelKind(m.label), m.label),
                ])
              )
            )
          );
        else if (mid !== 'contrast-ordinal')
          item.appendChild(mk('p', { class: 'labn-measure-sub', text: 'Nothing recorded for these two runs yet.' }));
        list.appendChild(item);
      }
      section.appendChild(list);
      return section;
    }
    function renderReveal() {
      const host = q('[data-labn-reveal]');
      keepFocus(host, () => {
        host.replaceChildren();
        if (!reveal || !reveal.ok) return;
        const run = runsById()[exp.experimentalRunId],
          specimen = run ? getSpecimen(lab, run.specimenId) : null,
          total = reveal.cards.length;
        host.appendChild(mk('h3', { class: 'labn-h3', id: id('reveal-h'), text: 'What the model shows' }));
        // The step's lede already says the model never names the right explanation (once per screen).
        host.appendChild(
          mk('p', {
            class: 'labn-hint',
            text: `${exp.revealedAt ? `Revealed ${localDay(exp.revealedAt)}. ` : ''}${total === 1 ? 'The model shows one outcome for your experimental run.' : `The model shows ${total} possible outcomes, one for each explanation in course order.`}`,
          })
        );
        const measuresOut = renderMeasuresOut(reveal.comparison);
        if (measuresOut) host.appendChild(measuresOut);
        host.appendChild(
          mk(
            'div',
            { class: 'labn-cards' },
            reveal.cards.map((c, i) => renderCard(c, i, total, specimen, { run, comparison: reveal.comparison }))
          )
        );
        if (reveal.comparison) host.appendChild(renderComparison(reveal.comparison));
        host.appendChild(
          renderInterpretation(
            (reveal.cards[0] && reveal.cards[0].prompts) || INTERPRETATION_FALLBACK,
            total,
            reveal.cards.some(c => isObj(c) && c.kind === 'uncertainty' && outcomeKind(c.card) === 'not-modeled')
          )
        );
        host.appendChild(
          mk('div', { class: 'labn-done' }, [
            mk('p', { class: 'labn-done-line', role: 'status', 'data-labn-done-line': true }),
            mk('a', {
              class: 'btn btn-solid labn-btn',
              href: viewHref({ view: 'notebook' }),
              'data-lab-go': true,
              'data-labn-report-link': true,
              hidden: true,
              text: 'Go to My report',
            }),
          ])
        );
      });
      renderDone();
    }
    function restoreReveal() {
      // Already revealed on an earlier visit: show the cards again, but only if the gate still passes.
      if (exp.status === 'draft') return;
      let gate;
      try {
        gate = lab.canReveal(exp, runsById());
      } catch {
        gate = { ok: false };
      }
      if (!gate.ok || sealConflicts().length) return;
      try {
        const result = lab.reveal(exp, runsById());
        if (result && result.ok) reveal = result;
      } catch {
        reveal = null;
      }
    }
    function finishReveal(result) {
      if (!result || !result.ok) {
        reveal = null;
        lastGateKey = null;
        renderGate();
        if (result && Array.isArray(result.reasons)) {
          const host = q('[data-labn-gate] .labn-reasons');
          if (host)
            host.replaceChildren(
              mk('p', { text: 'The reveal was refused:' }),
              mk('ul', { class: 'labn-left' }, result.reasons.map(reasonItem))
            );
        }
        return;
      }
      reveal = result;
      if (!exp.revealedAt) exp.revealedAt = nowIso();
      exp.status = interpretationComplete(exp) ? 'done' : 'revealed';
      renderReveal();
      refreshChecks();
      applyLock();
      scheduleSave();
      // The gate (and its button) hides once the cards are shown: focus moves to the cards' heading.
      const heading = q('[data-labn-reveal] h3');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus();
      }
    }
    function doReveal() {
      flushSave(); // the shell may reveal from its stored copy: make it current first
      let gate;
      try {
        gate = lab.canReveal(exp, runsById());
      } catch (err) {
        gate = { ok: false, reasons: [err.message] };
      }
      if (!gate.ok || sealConflicts().length) {
        reveal = null;
        renderReveal();
        renderGate();
        return;
      }
      let result;
      try {
        result = typeof o.onReveal === 'function' ? o.onReveal(clone(exp)) : undefined;
      } catch (err) {
        finishReveal({ ok: false, reasons: [`The shell refused the reveal: ${err.message}`] });
        return;
      }
      const settle = value => {
        let final = value;
        if (!isObj(final) || typeof final.ok !== 'boolean') {
          try {
            final = lab.reveal(exp, runsById());
          } catch (err) {
            final = { ok: false, reasons: [`Reveal failed: ${err.message}`] };
          }
        }
        finishReveal(final);
      };
      if (result && typeof result.then === 'function')
        result.then(settle, err =>
          finishReveal({ ok: false, reasons: [`The shell refused the reveal: ${err.message}`] })
        );
      else settle(result);
    }

    // ---- events ---------------------------------------------------------------------------------------
    function toggleControl(target) {
      const type = target.getAttribute('data-labn-control-type'),
        has = exp.controls.some(c => c.type === type);
      // input and change both fire for a checkbox: both paths are idempotent.
      if (target.checked && !has) exp.controls.push({ type, addresses: '' });
      else if (!target.checked && has) exp.controls = exp.controls.filter(c => c.type !== type);
      else return false;
      renderControls();
      // Focus stays on the box (the student may be tabbing through the list); its description names the
      // new "Which other explanation does it rule out?" field, which is the next tab stop.
      const box = q(`#${ids[`control-${type}`]}`);
      if (box) box.focus();
      return true;
    }
    function onFieldInput(ev) {
      const target = ev.target;
      if (target && target.hasAttribute && target.hasAttribute('data-labn-control-type')) {
        if (toggleControl(target)) {
          refreshChecks();
          scheduleSave();
        }
        return;
      }
      const field = target && target.getAttribute ? target.getAttribute('data-labn-field') : null;
      if (!field) return;
      if (field === 'measures') {
        const boxes = [...root.querySelectorAll('input[data-labn-field="measures"]')];
        exp.measures = boxes.filter(b => b.checked).map(b => b.value);
        for (const box of boxes) {
          const detail = q(`[data-labn-measure-detail="${box.value}"]`);
          if (detail) detail.hidden = !box.checked;
        }
      } else if (field.startsWith('predictions.')) {
        exp.predictions[field.slice('predictions.'.length)] = target.value;
      } else if (field.startsWith('interpretation.')) {
        if (!exp.interpretation) exp.interpretation = { supports: '', failsToEstablish: '', next: '' };
        exp.interpretation[field.slice('interpretation.'.length)] = target.value;
        if (exp.status !== 'draft') exp.status = interpretationComplete(exp) ? 'done' : 'revealed';
      } else if (field.startsWith('controls.')) {
        const [, index, key] = field.split('.');
        if (exp.controls[Number(index)]) exp.controls[Number(index)][key] = target.value;
      } else if (field === 'baselineRunId' || field === 'experimentalRunId') {
        exp[field] = target.value;
        renderRunSummaries();
        // The cards belong to the pair that was revealed: another pair clears them and re-arms the gate.
        reveal = null;
        lastGateKey = null;
        renderReveal();
      } else {
        exp[field] = target.value;
      }
      if (ev.type === 'change' || field === 'measures' || field.endsWith('RunId')) refreshChecks();
      else refreshChecksSoon();
      if (field === 'independentVariable') syncRequestRuns();
      scheduleSave();
    }
    let checkTimer = null;
    function refreshChecksSoon() {
      if (checkTimer) clearTimeout(checkTimer);
      checkTimer = setTimeout(() => {
        checkTimer = null;
        if (!destroyed) refreshChecks();
      }, 150);
    }
    function addChip(field) {
      const input = root.querySelector(`input[data-labn-chip-input="${field}"]`),
        value = input ? input.value.trim() : '';
      if (!value) {
        if (input) input.focus();
        return;
      }
      if (!exp[field].includes(value)) exp[field].push(value);
      // The first change becomes the main variable unless one is already written.
      if (field === 'changed' && !filled(exp.independentVariable)) {
        exp.independentVariable = value;
        q(`#${ids.independentVariable}`).value = value;
      }
      renderChips(field);
      const next = root.querySelector(`input[data-labn-chip-input="${field}"]`);
      if (next) next.focus();
      refreshChecks();
      scheduleSave();
    }
    function removeChip(field, index) {
      const [removed] = exp[field].splice(index, 1);
      if (field === 'changed' && removed !== undefined && exp.independentVariable === removed) {
        exp.independentVariable = exp.changed[0] || '';
        q(`#${ids.independentVariable}`).value = exp.independentVariable;
      }
      renderChips(field);
      const input = root.querySelector(`input[data-labn-chip-input="${field}"]`);
      if (input) input.focus();
      refreshChecks();
      scheduleSave();
    }
    function onClick(ev) {
      const scope = ev.target && ev.target.closest ? ev.target.closest('a[data-labn-scope-runs]') : null;
      if (scope && root.contains(scope)) {
        flushSave();
        refreshScopeLinks();
        // A plain click goes through the shell's CortexLab.openMicroscope with the same keys; otherwise
        // (a modified click, or no shell) the link's href does, routed by the shell's data-lab-go.
        const open = shell() && shell().openMicroscope;
        if (typeof open !== 'function' || ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
        ev.preventDefault();
        ev.stopPropagation();
        const at = scope.getAttribute('data-labn-scope-at');
        open({
          runIds: scope.getAttribute('data-labn-scope-runs').split(','),
          from: 'designer',
          exp: exp.id || null,
          step,
          ...(AT_ANCHORS[at] ? { at } : {}),
        });
        return;
      }
      const jump = ev.target && ev.target.closest ? ev.target.closest('a[data-labn-jump]') : null;
      if (jump && root.contains(jump)) {
        ev.preventDefault();
        jumpTo(jump.getAttribute('data-labn-jump'));
        return;
      }
      const fold = ev.target && ev.target.closest ? ev.target.closest('button[data-labn-toggle]') : null;
      if (fold && root.contains(fold)) {
        ev.preventDefault();
        toggleFold(fold);
        return;
      }
      const button = ev.target && ev.target.closest ? ev.target.closest('[data-labn-action]') : null;
      if (!button || !root.contains(button)) return;
      const action = button.getAttribute('data-labn-action');
      if (action === 'wizard-next' || action === 'wizard-back') {
        ev.preventDefault();
        flushSave();
        goToStep(step + (action === 'wizard-next' ? 1 : -1));
      } else if (action === 'wizard-go') {
        ev.preventDefault();
        flushSave();
        goToStep(Number(button.getAttribute('data-labn-step')));
      } else if (action === 'chip-add') {
        ev.preventDefault();
        addChip(button.getAttribute('data-labn-list'));
      } else if (action === 'chip-remove') {
        ev.preventDefault();
        removeChip(button.getAttribute('data-labn-list'), Number(button.getAttribute('data-labn-index')));
      } else if (action === 'request-runs') {
        ev.preventDefault();
        if (button.disabled) return; // the planned change is not one the bench can make (syncRequestRuns)
        // A draft that was never saved has no id: save it now (not only a save still waiting) so the shell can
        // allocate the id and tie the runs it makes to this experiment.
        if (!exp.id) {
          if (saveTimer) clearTimeout(saveTimer);
          persist();
        } else flushSave();
        if (typeof o.onRequestRuns === 'function') {
          let picked;
          try {
            picked = o.onRequestRuns(clone(exp));
          } catch (err) {
            setSaveStatus('error', `Run request failed: ${err.message}`);
          }
          if (destroyed) return;
          // A shell may answer with the pair it prepared: adopt the ids it names.
          if (isObj(picked)) {
            for (const field of ['baselineRunId', 'experimentalRunId'])
              if (typeof picked[field] === 'string' && picked[field]) exp[field] = picked[field];
            scheduleSave();
          }
        }
        renderRuns();
        refreshChecks();
      } else if (action === 'reveal') {
        ev.preventDefault();
        if (!button.disabled) doReveal();
      }
    }
    function onKeydown(ev) {
      if (ev.key !== 'Enter') return;
      const field = ev.target && ev.target.getAttribute ? ev.target.getAttribute('data-labn-chip-input') : null;
      if (field) {
        ev.preventDefault();
        addChip(field);
      }
    }
    // Phones: the Back / Next bar sticks to the bottom of the screen, and a browser leaves a focused field
    // that the bar covers where it is. Lift it to 8px above the bar, measured (the bar is one or two lines
    // tall), never past the site's top bar; lab-notebook.css keeps the same room with the page's
    // scroll-padding-bottom for the browser's own focus scroll. As the bench and the activities do.
    function liftAboveNav(target) {
      const nav = q('.labn-wizard-nav');
      if (!nav || !target || !target.isConnected || nav.contains(target) || typeof getComputedStyle !== 'function')
        return;
      if (getComputedStyle(nav).position !== 'sticky' || typeof target.getBoundingClientRect !== 'function') return;
      const box = target.getBoundingClientRect(),
        bar = nav.getBoundingClientRect();
      if ((!box.width && !box.height) || box.bottom <= bar.top || box.top >= bar.bottom) return;
      const topbar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lab-topbar-h')) || 0,
        by = Math.min(box.bottom - bar.top + 8, box.top - topbar - 8);
      // 'instant': the site's html { scroll-behavior: smooth } would otherwise animate it.
      if (by > 0 && typeof window.scrollBy === 'function') window.scrollBy({ top: by, behavior: 'instant' });
    }
    function onFocusIn(ev) {
      const target = ev.target;
      liftAboveNav(target);
      // Once more after the browser's own focus scroll, while the field still has focus.
      if (typeof window.requestAnimationFrame === 'function')
        window.requestAnimationFrame(() => {
          if (!destroyed && document.activeElement === target) liftAboveNav(target);
        });
    }
    root.addEventListener('input', onFieldInput);
    root.addEventListener('change', onFieldInput);
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeydown);
    root.addEventListener('focusin', onFocusIn);
    const shellEvents = window.CortexLab && window.CortexLab.events;
    if (shellEvents && typeof shellEvents.on === 'function') {
      const handler = () => {
        if (destroyed) return;
        renderRuns();
        refreshChecks();
      };
      try {
        const off = shellEvents.on('run', handler);
        offRun = typeof off === 'function' ? off : () => shellEvents.off && shellEvents.off('run', handler);
      } catch {
        offRun = null;
      }
    }

    function renderAll() {
      renderHeader();
      renderOthers();
      fillStatic();
      renderChangeList();
      renderChips('changed');
      renderChips('heldComparable');
      renderMeasures();
      renderControls();
      renderRuns();
      restoreReveal();
      renderReveal();
      refreshChecks();
      applyLock();
      goToStep(step, { focus: false, sync: false });
      setSaveStatus('idle');
    }
    renderAll();
    goToAnchor(initialAnchor());

    return {
      update(next) {
        if (destroyed) return;
        flushSave();
        o = { ...o, ...(next || {}) };
        if (next && next.lab) lab = next.lab;
        if (next && isObj(next.state)) state = next.state;
        const wantId = next && next.experimentId !== undefined ? next.experimentId : exp.id;
        const stored = wantId && isObj(state.experiments) ? state.experiments[wantId] : null;
        if (wantId !== exp.id) {
          o.experimentId = wantId;
          exp = loadExperiment();
          reveal = null;
          step = startStep();
        } else if (stored && JSON.stringify(stored) !== lastSaved) {
          // The shell changed the stored copy (or another view did): adopt it.
          exp = normalizeExperiment(stored, wantId);
          reveal = null;
        }
        if (next && next.step !== undefined) step = startStep();
        lastCheckKey = null;
        lastGateKey = null;
        keepFocus(root, renderAll);
        if (next && typeof next.at === 'string') goToAnchor(next.at);
      },
      destroy() {
        if (destroyed) return;
        flushSave();
        destroyed = true;
        if (checkTimer) clearTimeout(checkTimer);
        if (offRun) offRun();
        root.removeEventListener('input', onFieldInput);
        root.removeEventListener('change', onFieldInput);
        root.removeEventListener('click', onClick);
        root.removeEventListener('keydown', onKeydown);
        root.removeEventListener('focusin', onFocusIn);
        root.remove();
      },
      getExperiment: () => clone(exp),
    };
  }

  // ---- report ------------------------------------------------------------------------------
  function nextEntryId(state) {
    const entries = (state.notebook && state.notebook.entries) || [];
    let n = (state.counters && Number(state.counters.entry)) || 0;
    let candidate;
    do candidate = `entry-${++n}`;
    while (entries.some(e => e && e.id === candidate));
    return candidate;
  }
  function claimSources(lab, claimId) {
    const claim = lab && typeof lab.getClaim === 'function' ? lab.getClaim(claimId) : null;
    if (!claim) return [];
    return (claim.sources || []).map(sid => {
      const s = typeof lab.getSource === 'function' ? lab.getSource(sid) : null;
      return s ? { id: s.id, citation: s.citation, url: s.url } : { id: sid, citation: null, url: null };
    });
  }
  function sourcesList(lab, claimId) {
    const list = mk('ul', { class: 'labn-sources' });
    const refs = claimSources(lab, claimId);
    if (!refs.length) list.appendChild(mk('li', { text: 'No source listed.' }));
    for (const ref of refs) {
      const item = mk('li', {}, [mk('span', { class: 'labn-mono', text: ref.id }), ' ', ref.citation || '']);
      if (ref.url) {
        item.appendChild(document.createTextNode(' '));
        item.appendChild(mk('a', { href: ref.url, target: '_blank', rel: 'noopener', text: ref.url }));
      }
      list.appendChild(item);
    }
    return list;
  }
  const excerpt = text => {
    const s = String(text || '').trim();
    return s.length > 48 ? `${s.slice(0, 45).trim()}…` : s;
  };

  function mountNotebook(container, opts) {
    if (!container || typeof container.appendChild !== 'function')
      throw new Error('CortexLabNotebook.mountNotebook needs a container element');
    let o = { ...(opts || {}) };
    let lab = o.lab,
      state = isObj(o.state) ? o.state : {};
    if (!lab) throw new Error('CortexLabNotebook.mountNotebook needs { lab }');
    const tabSection = K('SECTIONS').includes(o.tab) ? o.tab : null,
      tabType = K('ENTRY_TYPES').includes(o.tab) ? o.tab : null;
    // The page's h1 is the shell's ("My report"): the module's headings start one level below it.
    const hl = Math.min(5, Math.max(2, Math.round(Number(o.headingLevel)) || 2)),
      hs = hl + 1;
    const blankDraft = (type = 'reflection', section = DEFAULT_SECTION[type] || K('SECTIONS')[0]) => ({
      type,
      section,
      text: '',
      claimId: '',
      observedAt: '',
      assetId: null,
      runId: '',
      search: '',
    });
    let destroyed = false,
      formOpen = false,
      draft = blankDraft(tabType || 'reflection', tabSection || undefined);
    const ids = {},
      id = name => (ids[name] = ids[name] || uid(name));
    const root = mk('div', { class: 'labn labn-notebook' });
    container.appendChild(root);

    // SIMPLE-notebook: one calm page. Notes (the shell's free-text notepad; hidden without it), the
    // derived lab work, the report's own notes (a section shows only once it holds one), then the file.
    root.innerHTML = `
      <p class="labn-lede">Your notes, your lab work and the notes you add to the five report sections all go into one file you can download.</p>
      <section class="labn-notepad" data-labn-notepad aria-labelledby="${id('notepad-h')}" hidden>
        <h${hl} class="labn-h3" id="${id('notepad-h')}">Notes</h${hl}>
        <p class="labn-hint" id="${id('notepad-hint')}">Free writing, saved as you type. It goes into your download as a “Notes” section, marked as your own reflection.</p>
        <textarea id="labn-notepad" class="labn-textarea labn-notepad-text" rows="8" data-labn-notepad-text aria-labelledby="${id('notepad-h')}" aria-describedby="${id('notepad-hint')}" placeholder="e.g. What I noticed today, questions for class, ideas for the next run"></textarea>
        <p class="labn-save" role="status" data-labn-notepad-status></p>
      </section>
      <section class="labn-work" aria-labelledby="${id('work-h')}">
        <h${hl} class="labn-h3" id="${id('work-h')}">Your lab work</h${hl}>
        <div data-labn-derived></div>
      </section>
      <section class="labn-entries" aria-labelledby="${id('entries-h')}">
        <div class="labn-entries-head">
          <h${hl} class="labn-h3" id="${id('entries-h')}">Your report</h${hl}>
          <div class="labn-menu" data-labn-menu="add">
            <button type="button" id="${id('add-menu')}" class="btn labn-btn" data-labn-action="add-menu" aria-expanded="false" aria-controls="${id('add-list')}">Add to my report</button>
            <div class="labn-menu-list" id="${id('add-list')}" hidden>${ADD_TYPES.map(
              ([type, text]) =>
                `<button type="button" class="labn-menu-item" data-labn-action="add-type" data-labn-add-type="${type}">${esc(text)}</button>`
            ).join('')}</div>
          </div>
        </div>
        <div class="labn-legend-fold">${foldHtml(
          'legend',
          'What the four labels mean',
          `<ul class="labn-taglist" aria-label="What the labels mean">${K('ENTRY_TYPES')
            .map(
              t =>
                `<li><span class="labn-tag labn-tag-${t}">${esc(TYPE_TAG[t] || t)}</span> ${esc(TYPE_LEGEND[t] || '')}</li>`
            )
            .join('')}</ul>`,
          id('legend-panel')
        )}</div>
        <div class="labn-add" data-labn-add hidden>
          <form class="labn-form labn-add-form" novalidate data-labn-add-form aria-labelledby="${id('form-h')}">
            <h${hs} class="labn-h4" id="${id('form-h')}" tabindex="-1" data-labn-form-title></h${hs}>
            <p class="labn-hint" data-labn-type-help></p>
            <div data-labn-type-fields></div>
            <div class="labn-field"><label class="labn-label" for="${id('section')}">Report section <span class="labn-req">required</span></label><select id="${id('section')}" class="labn-select" data-labn-draft="section">${K(
              'SECTIONS'
            )
              .map(s => `<option value="${esc(s)}">${esc(K('SECTION_TEXT')[s] || s)}</option>`)
              .join('')}</select></div>
            <div class="labn-field"><label class="labn-label" for="${id('text')}">Your note <span class="labn-req">required</span></label><textarea id="${id('text')}" class="labn-textarea" rows="4" data-labn-draft="text"></textarea></div>
            <p class="labn-error" role="alert" data-labn-add-error></p>
            <div class="labn-chip-row"><button type="submit" class="btn btn-solid labn-btn" data-labn-submit>Save note</button><button type="button" class="btn labn-btn" data-labn-action="add-cancel">Cancel</button></div>
          </form>
        </div>
        <div data-labn-entries></div>
      </section>
      <section class="labn-file" data-labn-file aria-label="Download your report">
        <div class="labn-actions labn-export" data-labn-export-block>
          <button type="button" id="labn-export" class="btn btn-solid labn-btn" data-labn-action="download">Download my report (.md)</button>
          <div class="labn-menu" data-labn-menu="more">
            <button type="button" id="${id('more')}" class="btn labn-btn labn-quiet" data-labn-action="more" aria-expanded="false" aria-controls="${id('more-list')}">More<span class="labn-sr-only"> ways to save the report</span></button>
            <div class="labn-menu-list" id="${id('more-list')}" hidden>
              <button type="button" class="labn-menu-item" data-labn-action="copy-plain">Copy as plain text</button>
              <button type="button" class="labn-menu-item" data-labn-action="copy">Copy as Markdown</button>
              <button type="button" class="labn-menu-item" data-labn-action="print">Print</button>
            </div>
          </div>
        </div>
        <p class="labn-hint labn-file-hint" data-labn-file-honesty>The file starts with a note that every simulated line comes from a teaching model, not the lab.</p>
        <p class="labn-save" role="status" data-labn-export-status></p>
      </section>`;
    const q = sel => root.querySelector(sel);

    // ---- Notes: the shell's free-text notepad (CortexLab.getNotepad() -> string, setNotepad(text)) ------
    // Hidden when the shell does not provide both. Saved 400 ms after the last keystroke, on leaving
    // the page and before every export; the shell's copy is read again whenever the page re-renders
    // while the student is not typing (the bench shows the same notepad).
    const notepadApi = () => {
      const s = shell();
      return s && typeof s.getNotepad === 'function' && typeof s.setNotepad === 'function' ? s : null;
    };
    let notepadTimer = null,
      notepadLast = null;
    function setNotepadStatus(kind, message) {
      const node = q('[data-labn-notepad-status]');
      if (!node) return;
      node.dataset.labnSave = kind;
      node.textContent =
        message ||
        {
          idle: '',
          saving: 'Saving',
          saved: 'Saved',
          paused: 'Saving is paused (browser storage is unavailable). Your notes stay on this page.',
          error: 'Saving failed.',
        }[kind];
    }
    function readNotepad(api) {
      try {
        const text = api.getNotepad();
        return typeof text === 'string' ? text : '';
      } catch {
        return '';
      }
    }
    function syncNotepad() {
      const api = notepadApi(),
        block = q('[data-labn-notepad]'),
        area = q('[data-labn-notepad-text]');
      block.hidden = !api;
      if (!api || notepadTimer || document.activeElement === area) return;
      const text = readNotepad(api);
      if (area.value !== text) area.value = text;
      notepadLast = text;
    }
    function saveNotepad() {
      notepadTimer = null;
      const api = notepadApi(),
        area = q('[data-labn-notepad-text]');
      if (!api || !area) return;
      const text = area.value;
      if (text === notepadLast) return setNotepadStatus('idle');
      let result;
      try {
        result = api.setNotepad(text);
      } catch (err) {
        return setNotepadStatus('error', `Saving failed: ${err && err.message ? err.message : err}`);
      }
      notepadLast = text;
      return setNotepadStatus(result === false ? 'paused' : 'saved');
    }
    function scheduleNotepad() {
      if (destroyed) return;
      setNotepadStatus('saving');
      if (notepadTimer) clearTimeout(notepadTimer);
      notepadTimer = setTimeout(saveNotepad, 400);
    }
    function flushNotepad() {
      if (notepadTimer) {
        clearTimeout(notepadTimer);
        saveNotepad();
      }
    }

    function entries() {
      return state.notebook && Array.isArray(state.notebook.entries) ? state.notebook.entries.filter(isObj) : [];
    }
    function tagNode(type) {
      return mk('span', { class: `labn-tag labn-tag-${type}`, text: TYPE_TAG[type] || type });
    }
    function renderEntry(entry) {
      const type = entry.type,
        item = mk('li', {
          class: `labn-entry labn-entry-${type}`,
          'data-labn-type': type,
          'data-labn-entry': entry.id,
        });
      item.appendChild(
        mk('div', { class: 'labn-entry-head' }, [
          tagNode(type),
          mk('button', {
            type: 'button',
            class: 'labn-textbtn labn-remove',
            'data-labn-action': 'remove',
            'data-labn-id': entry.id,
            'aria-label': `Remove: ${excerpt(entry.text) || TYPE_TAG[type] || 'entry'}`,
            text: 'Remove',
          }),
        ])
      );
      item.appendChild(mk('p', { class: 'labn-entry-text', text: entry.text }));
      const meta = mk('div', { class: 'labn-entry-meta' });
      if (type === 'published') {
        const claim = typeof lab.getClaim === 'function' ? lab.getClaim(entry.claimId) : null;
        meta.appendChild(
          mk('p', { text: claim ? `Cites: “${claim.text}”` : 'Cites a finding that is not in the course sources.' })
        );
        meta.append(
          ...whyBlock(
            [
              mk('p', {}, [
                mk('span', { class: 'labn-mono', text: entry.claimId || '' }),
                claim ? ` (${STRENGTH_TEXT[claim.strength] || String(claim.strength || '').replace(/-/g, ' ')})` : '',
              ]),
              claim ? sourcesList(lab, entry.claimId) : null,
            ],
            W('sources')
          )
        );
      } else if (type === 'observed') {
        meta.appendChild(
          mk('p', {
            text:
              entry.assetId === null || entry.assetId === undefined
                ? `Real-lab observation, ${entry.observedAt}`
                : `Asset ${entry.assetId}, ${entry.observedAt}`,
          })
        );
      } else if (type === 'simulated') {
        const run = (state.runs || {})[entry.runId],
          seal = run ? sealOf(state, run.id) : null;
        meta.appendChild(
          mk('p', { class: 'labn-entry-run' }, [
            // A sealed run's label (Simulated or Not modeled) is part of its outcome: no badge yet.
            seal ? null : badgeNode(labelKind(entry.label), entry.label),
            `${seal ? '' : ' '}${run ? runText(lab, run) : runName({ id: entry.runId })}`,
          ])
        );
        const outcome = safeResolve(lab, run);
        if (seal) meta.appendChild(sealedLine(seal, { class: 'labn-meta labn-sealed' }));
        else if (!outcome)
          meta.appendChild(mk('p', { class: 'labn-meta', text: 'This run is no longer in your runs.' }));
        else if (outcome.label !== entry.label)
          // The run resolves to another label now (it changed after the entry was written): the entry
          // keeps the label it recorded, and the live outcome text is not shown as if it were the entry's.
          meta.appendChild(
            mk('p', {
              class: 'labn-meta',
              role: 'note',
              'data-labn-stale': true,
              text: 'This run changed after the entry was recorded; the stored label is kept.',
            })
          );
        else
          meta.appendChild(
            mk('p', {
              class: 'labn-meta',
              'data-labn-plain': true,
              text: summarize(outcome, getSpecimen(lab, run.specimenId)),
            })
          );
      }
      if (entry.createdAt)
        meta.appendChild(mk('p', { class: 'labn-meta', text: `Added ${localDay(entry.createdAt)}` }));
      item.appendChild(meta);
      return item;
    }
    // The five sections keep their order and words (the file prints every one); on the page a section
    // shows only once it holds a note, so an empty report is one line, not five empty headings.
    function renderEntries() {
      const host = q('[data-labn-entries]'),
        all = entries();
      host.replaceChildren();
      for (const section of K('SECTIONS')) {
        const rows = all.filter(e => e.section === section);
        if (!rows.length) continue;
        const block = mk('section', { class: 'labn-section', 'aria-labelledby': id(`sec-${section}`) });
        block.appendChild(
          mk(`h${hs}`, { class: 'labn-h4', id: id(`sec-${section}`), text: K('SECTION_TEXT')[section] || section })
        );
        block.appendChild(mk('p', { class: 'labn-hint', text: SECTION_HINT[section] || '' }));
        block.appendChild(mk('ul', { class: 'labn-entry-list' }, rows.map(renderEntry)));
        host.appendChild(block);
      }
      if (!host.childElementCount)
        host.appendChild(
          mk('p', {
            class: 'labn-empty',
            'data-labn-no-entries': true,
            text: 'No notes yet. Use “Add to my report”, or “Add a note about this” under your lab work. The file shows the five report sections with “(no entries)” until then.',
          })
        );
    }
    // "From your lab work": derived from state on every render and never written into notebook.entries,
    // so the export for the same state stays byte-identical (contract §8.4 decision 2). Each item also
    // says whether the exported file holds it (the same lists exportMarkdown hands the engine).
    function workItems() {
      const items = [],
        runs = isObj(state.runs) ? state.runs : {},
        rules = typeof lab.measurementRules === 'function' ? lab.measurementRules() : [],
        file = fileFacts(state),
        noteIn = entry => ({ yes: true, where: `your note in ${K('SECTION_TEXT')[entry.section] || entry.section}` });
      for (const run of runsList(state)) {
        const outcome = safeResolve(lab, run);
        if (!outcome || outcome.code === 'step-skipped') continue; // only finished runs
        const title = runText(lab, run),
          noted = file.entries.find(e => e.type === 'simulated' && e.runId === run.id),
          seal = sealOf(state, run.id),
          inFile = file.logRuns.has(run.id)
            ? { yes: true, where: 'the Experiment log' }
            : noted
              ? noteIn(noted)
              : { yes: false };
        if (seal) {
          // Sealed (RUN SEALING): no badge, summary, flags or needs until its experiment is revealed. A note
          // on a simulated run would carry its label, which is part of the outcome: a reflection instead.
          items.push({
            kind: 'run',
            ref: run.id,
            badge: null,
            title,
            sealed: seal,
            note: sealedNote(`About ${runName(run)}: `),
            file: inFile,
          });
          continue;
        }
        const needed =
          outcome.label !== K('LABELS').SYNTHETIC && Array.isArray(outcome.whatWouldBeNeeded)
            ? outcome.whatWouldBeNeeded
            : [];
        items.push({
          kind: 'run',
          ref: run.id,
          badge: outcomeBadge(outcome),
          title,
          line: summarize(outcome, getSpecimen(lab, run.specimenId)),
          // The bench card's warnings, unless the run's name already says them.
          flags: runFlags(lab, run, outcome).filter(flag => !title.includes(flag.replace(/\.$/, ''))),
          needs: needed.length ? `What the model would need: ${needed.map(x => neededText(lab, x)).join('; ')}.` : '',
          reactions: reactionLines(run, outcome),
          note: { type: 'simulated', runId: run.id },
          file: inFile,
        });
      }
      const measurements = isObj(state.measurements) ? state.measurements : {},
        order = Array.isArray(state.measurementOrder) ? state.measurementOrder : Object.keys(measurements);
      for (const mid of order) {
        const m = measurements[mid];
        if (!isObj(m)) continue;
        const rule = rules.find(r => r.id === m.measurementId) || { title: m.measurementId || 'Measurement' },
          run = runs[m.runId],
          ordinal = isOrdinal(m),
          value = measureValue(m),
          // The engine prints a measurement only inside an experiment's run; elsewhere the note carries it,
          // so the note starts with the value.
          said = `${rule.title} measurement`,
          noted = file.entries.find(e => e.runId === m.runId && String(e.text || '').includes(said)),
          // A value read from a sealed run is part of its outcome: kept back like the run itself.
          seal = run ? sealOf(state, run.id) : null;
        items.push({
          kind: 'measurement',
          ref: m.id || mid,
          badge: seal ? null : badgeNode(labelKind(m.label), m.label),
          title: `${rule.title}${run ? ` on ${runName(run)}` : ''}`,
          line: `Value: ${value}${m.manual ? ', recorded by hand' : ''}.`,
          sealed: seal,
          note: seal
            ? sealedNote(`About the ${said}: `)
            : {
                type: 'simulated',
                runId: run ? run.id : '',
                text: `About the ${said}, ${ordinal ? `${level(m.value)} on the ${W('modelScale')}` : `${m.value}${m.unit ? ` ${m.unit}` : ''}`}: `,
              },
          file:
            run && file.logRuns.has(run.id)
              ? { yes: true, where: 'the Experiment log, with its run' }
              : noted
                ? noteIn(noted)
                : { yes: false },
        });
      }
      const experiments = isObj(state.experiments) ? state.experiments : {},
        expOrder = Array.isArray(state.experimentOrder) ? state.experimentOrder : Object.keys(experiments);
      for (const eid of expOrder) {
        const e = experiments[eid];
        if (!isObj(e) || !['revealed', 'done'].includes(e.status)) continue;
        const outcome = safeResolve(lab, runs[e.experimentalRunId]);
        items.push({
          kind: 'experiment',
          ref: e.id || eid,
          file: file.experiments.includes(e) ? { yes: true, where: 'the Experiment log' } : { yes: false },
          badge: outcome ? outcomeBadge(outcome) : null,
          title: e.title ? `Experiment: ${e.title}` : 'Experiment (untitled)',
          line: e.status === 'done' ? 'Revealed and interpreted.' : 'Revealed; the interpretation is not finished yet.',
          note: {
            type: 'reflection',
            section: 'outcomes-limitations',
            text: `About my experiment “${e.title || 'untitled'}”: `,
          },
        });
      }
      return items;
    }
    // The note "Add a note about this" opens for a sealed run or a value read from one: a reflection in
    // Process and decisions (what was done), never a note that carries the sealed run's label.
    const sealedNote = text => ({ type: 'reflection', section: 'process-decisions', text });
    let workNotes = {};
    function renderWork(items) {
      const host = q('[data-labn-derived]');
      workNotes = {};
      keepFocus(host, () => {
        host.replaceChildren();
        if (!items.length) {
          host.appendChild(
            mk('p', {
              class: 'labn-empty',
              text: 'Nothing yet. Runs you finish on the bench, your measurements and your revealed experiments show up here, each with a way to add a note about it.',
            })
          );
          return;
        }
        host.appendChild(
          mk(
            'ul',
            { class: 'labn-work-list' },
            items.map(item => {
              const key = `${item.kind}:${item.ref}`;
              workNotes[key] = item.note;
              // One row per item: its name and badge, the readout under it, then the note link. Whether
              // the file already holds it stays on the row as data-labn-in-file (the engine prints an
              // experiment's runs; any other run or measurement goes in with a note about it).
              return mk(
                'li',
                {
                  class: 'labn-work-item',
                  'data-labn-work': item.kind,
                  'data-labn-ref': item.ref,
                  'data-labn-in-file': item.file.yes ? 'yes' : 'no',
                },
                [
                  mk('div', { class: 'labn-work-head' }, [
                    mk('p', { class: 'labn-work-title', text: item.title }),
                    item.badge,
                  ]),
                  item.sealed
                    ? sealedLine(item.sealed, { class: 'labn-work-line labn-sealed' })
                    : mk('p', { class: 'labn-work-line', text: item.line }),
                  ...(item.flags || []).map(flag =>
                    mk('p', { class: 'labn-flag', 'data-labn-flag': true, text: flag })
                  ),
                  item.needs ? mk('p', { class: 'labn-work-needs', text: item.needs }) : null,
                  // MODE-notebook: a free run's What happened lines in place of a step log.
                  item.reactions && item.reactions.length
                    ? mk('div', { class: 'labn-work-reactions', 'data-labn-reactions': item.ref }, [
                        mk('p', { class: 'labn-work-reactions-h', text: 'What happened' }),
                        mk(
                          'ol',
                          { class: 'labn-work-reactions-list' },
                          item.reactions.map(text => mk('li', { text }))
                        ),
                      ])
                    : null,
                  mk(
                    'button',
                    {
                      type: 'button',
                      id: id(`note-${key}`),
                      class: 'labn-textbtn',
                      'data-labn-action': 'note-about',
                      'data-labn-note': key,
                    },
                    ['Add a note about this', mk('span', { class: 'labn-sr-only', text: `: ${item.title}` })]
                  ),
                ]
              );
            })
          )
        );
      });
    }
    function renderDerived() {
      renderWork(workItems());
    }
    function claimMatches(query) {
      const items =
          lab.content && lab.content.claims && Array.isArray(lab.content.claims.items) ? lab.content.claims.items : [],
        needle = String(query || '')
          .trim()
          .toLowerCase();
      const hits = needle ? items.filter(c => `${c.id} ${c.text}`.toLowerCase().includes(needle)) : items;
      return hits.slice(0, 12);
    }
    function renderTypeFields() {
      const host = q('[data-labn-type-fields]');
      q('[data-labn-form-title]').textContent = FORM_TITLE[draft.type] || 'New note';
      q('[data-labn-type-help]').textContent = TYPE_HELP[draft.type] || '';
      host.replaceChildren();
      if (draft.type === 'published') {
        const searchId = id('claim-search'),
          resultsId = id('claim-results');
        const search = mk('input', {
          id: searchId,
          class: 'labn-input',
          type: 'search',
          'data-labn-draft': 'search',
          autocomplete: 'off',
          'aria-controls': resultsId,
          placeholder: 'e.g. temperature',
        });
        search.value = draft.search;
        host.appendChild(
          mk('div', { class: 'labn-field' }, [
            mk('label', { class: 'labn-label', for: searchId }, [
              'Find a finding ',
              mk('span', { class: 'labn-req', text: 'required' }),
            ]),
            search,
          ])
        );
        const results = mk('div', {
          class: 'labn-claims',
          id: resultsId,
          role: 'radiogroup',
          'aria-label': 'Matching findings',
        });
        const hits = claimMatches(draft.search);
        if (!hits.length) results.appendChild(mk('p', { class: 'labn-meta', text: 'No finding matches.' }));
        for (const claim of hits) {
          const radioId = id(`claim-${claim.id}`);
          const radio = mk('input', {
            type: 'radio',
            id: radioId,
            name: `${ids.text}-claim`,
            value: claim.id,
            'data-labn-draft': 'claimId',
          });
          radio.checked = draft.claimId === claim.id;
          results.appendChild(
            mk('div', { class: 'labn-check labn-claim' }, [
              radio,
              mk('label', { for: radioId, class: 'labn-check-copy', text: claim.text }),
            ])
          );
        }
        host.appendChild(results);
        const chosen = mk('div', { class: 'labn-field', 'data-labn-claim-sources': true });
        if (draft.claimId) {
          chosen.appendChild(mk('p', { class: 'labn-label', text: W('sources') }));
          chosen.appendChild(sourcesList(lab, draft.claimId));
        }
        host.appendChild(chosen);
      } else if (draft.type === 'observed') {
        host.appendChild(
          mk('p', {
            class: 'labn-notice',
            role: 'note',
            text: 'This is for what you saw yourself in the real lab. Nothing from the simulator is an observation; add a simulated run as a note on a simulated run, with its label.',
          })
        );
        const dateId = id('observedAt');
        const date = mk('input', {
          id: dateId,
          class: 'labn-input',
          type: 'date',
          'data-labn-draft': 'observedAt',
          required: true,
          'aria-required': 'true',
        });
        date.value = draft.observedAt;
        host.appendChild(
          mk('div', { class: 'labn-field' }, [
            mk('label', { class: 'labn-label', for: dateId }, [
              'Date you saw it ',
              mk('span', { class: 'labn-req', text: 'required' }),
            ]),
            date,
          ])
        );
        const assets =
          lab.content && lab.content.assets && Array.isArray(lab.content.assets.items)
            ? lab.content.assets.items.filter(a => a && a.label === K('LABELS').OBSERVED)
            : [];
        if (assets.length) {
          const assetId = id('assetId');
          const select = mk('select', { id: assetId, class: 'labn-select', 'data-labn-draft': 'assetId' });
          select.appendChild(mk('option', { value: '', text: 'None: a real-lab observation I typed' }));
          for (const a of assets) {
            const option = mk('option', { value: a.id, text: `${a.id}: ${a.description || ''}` });
            if (draft.assetId === a.id) option.selected = true;
            select.appendChild(option);
          }
          host.appendChild(
            mk('div', { class: 'labn-field' }, [
              mk('label', { class: 'labn-label', for: assetId, text: 'Reference image (optional)' }),
              select,
            ])
          );
        }
      } else if (draft.type === 'simulated') {
        const runId = id('runId'),
          previewId = id('run-preview');
        const select = mk('select', {
          id: runId,
          class: 'labn-select',
          'data-labn-draft': 'runId',
          'aria-describedby': previewId,
        });
        const runs = runsList(state);
        select.appendChild(mk('option', { value: '', text: runs.length ? 'Choose a run' : 'No runs yet' }));
        // A sealed run is listed but cannot be chosen: a note on it would carry its label (its outcome).
        for (const run of runs) {
          const seal = sealOf(state, run.id),
            option = mk('option', {
              value: run.id,
              text: `${runText(lab, run)}${seal ? ` · sealed until you reveal ${seal.name}` : ''}`,
              disabled: !!seal,
              'data-labn-sealed-run': seal ? seal.expId : null,
            });
          if (run.id === draft.runId) option.selected = true;
          select.appendChild(option);
        }
        host.appendChild(
          mk('div', { class: 'labn-field' }, [
            mk('label', { class: 'labn-label', for: runId }, [
              'Which run ',
              mk('span', { class: 'labn-req', text: 'required' }),
            ]),
            select,
          ])
        );
        const preview = mk('div', { class: 'labn-run-preview', id: previewId });
        const run = (state.runs || {})[draft.runId],
          outcome = safeResolve(lab, run),
          seal = run ? sealOf(state, run.id) : null;
        if (seal) preview.appendChild(sealedLine(seal, { class: 'labn-meta labn-sealed' }));
        else if (outcome) {
          preview.appendChild(outcomeBadge(outcome));
          preview.appendChild(
            mk('p', {
              class: 'labn-meta',
              'data-labn-plain': true,
              text: summarize(outcome, getSpecimen(lab, run.specimenId)),
            })
          );
        } else
          preview.appendChild(
            mk('p', {
              class: 'labn-meta',
              text: draft.runId
                ? 'This run cannot be shown.'
                : `Your note keeps the label of the run you choose.${runs.some(r => sealOf(state, r.id)) ? ' A sealed run takes no note until you reveal its experiment: write a reflection about it instead.' : ''}`,
            })
          );
        host.appendChild(preview);
      }
    }
    function showError(message) {
      const node = q('[data-labn-add-error]');
      node.textContent = message || '';
      node.hidden = !message;
    }
    function setExportStatus(message) {
      const node = q('[data-labn-export-status]');
      if (node) node.textContent = message || '';
    }

    // ---- menus (disclosure buttons; Escape or a click elsewhere closes them) -------------------------
    function setMenu(name, open, { focusToggle = false, focusFirst = false } = {}) {
      const toggle = q(`[data-labn-action="${name}"]`),
        list = toggle ? q(`#${toggle.getAttribute('aria-controls')}`) : null;
      if (!toggle || !list) return;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      list.hidden = !open;
      if (open && focusFirst) {
        const first = list.querySelector('button');
        if (first) first.focus();
      }
      if (!open && focusToggle) toggle.focus();
    }
    const menuOpen = name => q(`[data-labn-action="${name}"]`).getAttribute('aria-expanded') === 'true';
    function closeMenus() {
      for (const name of ['more', 'add-menu']) if (menuOpen(name)) setMenu(name, false);
    }
    function onDocumentClick(ev) {
      if (destroyed) return;
      const menu = ev.target && ev.target.closest ? ev.target.closest('.labn-menu') : null;
      if (!menu || !root.contains(menu)) closeMenus();
    }

    // ---- the add form ------------------------------------------------------------------------------
    function openForm(type, preset = {}, { focus = true } = {}) {
      const keepText = formOpen && !preset.text ? draft.text : preset.text || '';
      draft = { ...blankDraft(type, preset.section || DEFAULT_SECTION[type]), ...preset, text: keepText };
      formOpen = true;
      q('[data-labn-add]').hidden = false;
      q(`#${ids.section}`).value = draft.section;
      q(`#${ids.text}`).value = draft.text;
      showError('');
      renderTypeFields();
      if (!focus) return;
      const first =
        draft.type === 'published'
          ? q('input[data-labn-draft="search"]')
          : draft.type === 'observed'
            ? q('input[data-labn-draft="observedAt"]')
            : draft.type === 'simulated' && !draft.runId
              ? q('select[data-labn-draft="runId"]')
              : q(`#${ids.text}`);
      if (first) {
        first.focus();
        if (first === q(`#${ids.text}`) && typeof first.setSelectionRange === 'function')
          first.setSelectionRange(first.value.length, first.value.length);
      }
    }
    function closeForm({ focusToggle = false } = {}) {
      formOpen = false;
      q('[data-labn-add]').hidden = true;
      showError('');
      if (focusToggle) q('[data-labn-action="add-menu"]').focus();
    }
    function buildEntry() {
      const base = {
        id: nextEntryId(state),
        type: draft.type,
        section: draft.section,
        text: draft.text.trim(),
        createdAt: nowIso(),
      };
      if (draft.type === 'published') return { ...base, claimId: draft.claimId || undefined };
      if (draft.type === 'observed') return { ...base, assetId: draft.assetId || null, observedAt: draft.observedAt };
      if (draft.type === 'simulated') {
        const run = (state.runs || {})[draft.runId],
          outcome = safeResolve(lab, run);
        return { ...base, runId: draft.runId || undefined, label: outcome ? outcome.label : undefined };
      }
      return base;
    }
    function onSubmit(ev) {
      ev.preventDefault();
      showError('');
      const entry = stripUndefined(buildEntry());
      if (!entry.text) {
        showError('Your note is empty.');
        q(`#${ids.text}`).focus();
        return;
      }
      const seal = entry.type === 'simulated' && entry.runId ? sealOf(state, entry.runId) : null;
      if (seal) {
        showError(
          `That run is sealed until you reveal ${seal.name}, so a note on it would give away its outcome. Choose another run, or write a reflection.`
        );
        const select = q('select[data-labn-draft="runId"]');
        if (select) select.focus();
        return;
      }
      try {
        lab.addEntry(state.notebook || lab.newNotebook(), entry, isObj(state.runs) ? state.runs : undefined);
      } catch (err) {
        showError(`The note was not added: ${err && err.message ? err.message : err}`);
        return;
      }
      let result;
      try {
        result = typeof o.onAdd === 'function' ? o.onAdd(entry) : undefined;
      } catch (err) {
        showError(`The note was not saved: ${err && err.message ? err.message : err}`);
        return;
      }
      if (typeof o.onAdd !== 'function') {
        state.notebook = lab.addEntry(
          state.notebook || lab.newNotebook(),
          entry,
          isObj(state.runs) ? state.runs : undefined
        );
      }
      // The shell may store the entry under its own id (contract §4: ids come from counters).
      const storedId = isObj(result) && typeof result.id === 'string' ? result.id : entry.id;
      draft = blankDraft(draft.type, draft.section);
      q(`#${ids.text}`).value = '';
      closeForm();
      renderEntries();
      renderDerived();
      setExportStatus(
        result === false
          ? 'Saving is paused (browser storage is unavailable); the note is kept on this page.'
          : `Added to ${K('SECTION_TEXT')[entry.section] || entry.section}.`
      );
      const node = root.querySelector(`[data-labn-entry="${storedId}"]`);
      if (node) {
        node.setAttribute('tabindex', '-1');
        node.focus();
      }
    }
    function onDraftInput(ev) {
      const target = ev.target,
        key = target && target.getAttribute ? target.getAttribute('data-labn-draft') : null;
      if (target && target.hasAttribute && target.hasAttribute('data-labn-notepad-text')) {
        scheduleNotepad();
        return;
      }
      if (!key) return;
      if (key === 'search') {
        draft.search = target.value;
        renderTypeFields();
        const search = q('input[data-labn-draft="search"]');
        if (search) {
          search.focus();
          search.setSelectionRange(search.value.length, search.value.length);
        }
      } else if (key === 'claimId') {
        if (!target.checked) return;
        draft.claimId = target.value;
        const chosen = q('[data-labn-claim-sources]');
        if (chosen)
          chosen.replaceChildren(mk('p', { class: 'labn-label', text: W('sources') }), sourcesList(lab, draft.claimId));
      } else if (key === 'runId') {
        draft.runId = target.value;
        renderTypeFields();
        const select = q('select[data-labn-draft="runId"]');
        if (select) select.focus();
      } else if (key === 'assetId') draft.assetId = target.value || null;
      else draft[key] = target.value;
    }
    function markdown() {
      flushNotepad();
      try {
        return exportMarkdown(state, lab);
      } catch (err) {
        setExportStatus(`Export failed: ${err.message}`);
        return null;
      }
    }
    function download(md) {
      if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        setExportStatus('Downloading is not available here; use Copy as plain text or Print under More.');
        return;
      }
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' }),
        url = URL.createObjectURL(blob),
        a = mk('a', { href: url, download: REPORT_FILE, class: 'labn-sr-only', text: 'Download' });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportStatus(`Report file ready: ${REPORT_FILE}`);
    }
    // `plain`: the report without Markdown signs (headings as lines, tags in words) for Canvas or a document.
    function copy(md, plain = false) {
      const text = plain ? markdownToPlain(md) : md,
        done = () => setExportStatus(plain ? 'Report copied as plain text.' : 'Report copied as Markdown.');
      const fallback = () => {
        const prev = document.activeElement,
          area = mk('textarea', { class: 'labn-sr-only', 'aria-hidden': 'true' });
        area.value = text;
        document.body.appendChild(area);
        area.select();
        let ok;
        try {
          ok = document.execCommand && document.execCommand('copy');
        } catch {
          ok = false;
        }
        area.remove();
        // Removing the selected textarea drops focus to body: put it back where it was (the More button).
        const back = prev && prev !== document.body && prev.isConnected ? prev : q('[data-labn-action="more"]');
        if (back && typeof back.focus === 'function') back.focus();
        if (ok) done();
        else setExportStatus('Copying is not available here; use Download my report instead.');
      };
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function')
        navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    }
    function removeEntry(entryId) {
      const ok =
        typeof window.confirm === 'function'
          ? window.confirm('Remove this note from your report? This cannot be undone.')
          : true;
      if (!ok) return;
      // The list re-renders, so focus is placed deliberately: on the entry that followed, else the heading.
      const items = [...root.querySelectorAll('[data-labn-entry]')],
        at = items.findIndex(n => n.getAttribute('data-labn-entry') === entryId),
        nextId = at >= 0 && items[at + 1] ? items[at + 1].getAttribute('data-labn-entry') : null;
      if (typeof o.onRemove === 'function') {
        try {
          o.onRemove(entryId);
        } catch (err) {
          setExportStatus(`The note was not removed: ${err.message}`);
          return;
        }
      } else if (state.notebook && Array.isArray(state.notebook.entries)) {
        state.notebook = { v: 1, entries: state.notebook.entries.filter(e => e && e.id !== entryId) };
      }
      renderEntries();
      renderDerived();
      setExportStatus('Note removed.');
      const target = (nextId && root.querySelector(`[data-labn-entry="${nextId}"]`)) || q(`#${ids['entries-h']}`);
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus();
      }
    }
    function onClick(ev) {
      const fold = ev.target && ev.target.closest ? ev.target.closest('button[data-labn-toggle]') : null;
      if (fold && root.contains(fold)) {
        ev.preventDefault();
        toggleFold(fold);
        return;
      }
      const button = ev.target && ev.target.closest ? ev.target.closest('[data-labn-action]') : null;
      if (!button || !root.contains(button)) return;
      const action = button.getAttribute('data-labn-action');
      if (action === 'more' || action === 'add-menu') {
        ev.preventDefault();
        const open = !menuOpen(action);
        closeMenus();
        setMenu(action, open, { focusFirst: open });
      } else if (action === 'add-type') {
        ev.preventDefault();
        setMenu('add-menu', false);
        openForm(button.getAttribute('data-labn-add-type'));
      } else if (action === 'note-about') {
        ev.preventDefault();
        const note = workNotes[button.getAttribute('data-labn-note')];
        if (!note) return;
        const { type, ...preset } = note;
        closeMenus();
        openForm(type, preset);
      } else if (action === 'add-cancel') {
        ev.preventDefault();
        closeForm({ focusToggle: true });
      } else if (action === 'remove') {
        ev.preventDefault();
        removeEntry(button.getAttribute('data-labn-id'));
      } else if (action === 'download') {
        ev.preventDefault();
        closeMenus();
        flushNotepad(); // the shell's own export reads the notepad from its state: make it current
        // onExport() is the shell's hook for the file export. A string back means the shell
        // produced (and delivered) the markdown itself; otherwise the module downloads it here.
        let handled;
        if (typeof o.onExport === 'function') {
          try {
            handled = o.onExport();
          } catch (err) {
            setExportStatus(`Export failed: ${err.message}`);
            return;
          }
        }
        if (typeof handled === 'string') setExportStatus(`Report file ready: ${REPORT_FILE}`);
        else {
          const md = markdown();
          if (md !== null) download(md);
        }
      } else if (action === 'copy' || action === 'copy-plain' || action === 'print') {
        ev.preventDefault();
        // Close the menu first so focus sits on its visible More button, where Copy and Print return it.
        setMenu('more', false, { focusToggle: true });
        const md = markdown();
        if (md === null) return;
        if (action !== 'print') copy(md, action === 'copy-plain');
        else {
          setExportStatus('Print view opened.');
          print(md);
        }
      }
    }
    function onKeydown(ev) {
      if (ev.key !== 'Escape') return;
      for (const name of ['more', 'add-menu'])
        if (menuOpen(name)) {
          ev.preventDefault();
          setMenu(name, false, { focusToggle: true });
          return;
        }
    }
    root.addEventListener('input', onDraftInput);
    root.addEventListener('change', onDraftInput);
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeydown);
    document.addEventListener('click', onDocumentClick);
    q('[data-labn-add-form]').addEventListener('submit', onSubmit);

    function renderAll() {
      syncNotepad();
      renderDerived();
      renderEntries();
      if (formOpen) {
        q(`#${ids.section}`).value = draft.section;
        keepFocus(q('[data-labn-type-fields]'), renderTypeFields);
      }
    }
    renderAll();
    // `tab` (contract NOTE-2): an entry type opens that form, a section opens a reflection for it,
    // 'export' / 'add' focus the export button / the add menu.
    if (tabType) openForm(tabType, {}, { focus: false });
    else if (tabSection) openForm('reflection', { section: tabSection }, { focus: false });
    if (o.tab === 'export' || o.tab === 'add') {
      const target = q(o.tab === 'export' ? '#labn-export' : '[data-labn-action="add-menu"]');
      if (target) {
        target.focus();
        if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'center' });
      }
    }

    return {
      update(next) {
        if (destroyed) return;
        o = { ...o, ...(next || {}) };
        if (next && next.lab) lab = next.lab;
        if (next && isObj(next.state)) state = next.state;
        keepFocus(root, renderAll);
      },
      destroy() {
        if (destroyed) return;
        flushNotepad();
        destroyed = true;
        root.removeEventListener('input', onDraftInput);
        root.removeEventListener('change', onDraftInput);
        root.removeEventListener('click', onClick);
        root.removeEventListener('keydown', onKeydown);
        document.removeEventListener('click', onDocumentClick);
        root.remove();
      },
    };
  }

  // ---- export and print ----------------------------------------------------------------------
  const exportExperiments = s =>
    (Array.isArray(s.experimentOrder) ? s.experimentOrder : Object.keys(s.experiments || {}))
      .map(id => (s.experiments || {})[id])
      .filter(isObj);
  // What the exported file holds for a state: the notes, the experiments of the Experiment log and the
  // runs printed there (the engine prints each experiment's two runs with their measurements).
  function fileFacts(state) {
    const s = isObj(state) ? state : {},
      runs = isObj(s.runs) ? s.runs : {},
      experiments = exportExperiments(s),
      logRuns = new Set();
    for (const e of experiments)
      for (const rid of [e.baselineRunId, e.experimentalRunId]) if (rid && runs[rid]) logRuns.add(rid);
    return {
      entries: isObj(s.notebook) && Array.isArray(s.notebook.entries) ? s.notebook.entries.filter(isObj) : [],
      experiments,
      logRuns,
    };
  }
  // The export is the engine's (§5): this only hands it the state's lists, the title and the student's
  // words for its lines (export API v2). From lab.js when it is loaded: run names, settings, steps and
  // the plain outcome summary (outcomeText = CortexLab.summarize; the engine then prints "Summary:" and
  // keeps its label and description in "Model detail (for instructors)"). From this module: specimen
  // and method names, the controls as the designer names them, claim strengths in words. Absent ones
  // keep the engine's defaults; one that throws gives back nothing, so the engine keeps its default for
  // that line (the engine also refuses multi-line, reserved-label and unqualified 'result' text). No
  // student label: the engine then prints a "Name: ________" line to fill in.
  const EXPORT_FORMATTERS = ['runTitle', 'paramText', 'stepTitle'];
  const safeFormatter =
    fn =>
    (...args) => {
      try {
        return fn(...args);
      } catch {
        return undefined;
      }
    };
  // "Practice specimen A · high burden (not real tissue)": the name students see, and that it is a
  // practice specimen (a reader of the file never saw the bench). The engine's label already says
  // "Synthetic ... (schematic)", so it is given as is.
  function specimenExportName(lab, id) {
    const sp = getSpecimen(lab, id);
    if (!sp) return undefined;
    if (!sp.studentLabel) return sp.label || undefined;
    return `${sp.studentLabel} (${/practice specimen/i.test(sp.studentLabel) ? 'not real tissue' : 'practice specimen, not real tissue'})`;
  }
  function methodExportName(lab, id) {
    const m = lab && typeof lab.getMethod === 'function' ? lab.getMethod(id) : null;
    return m && m.title ? String(m.title) : undefined;
  }
  // A control as the designer names it; a type it does not know keeps the engine's words.
  function controlExportText(control) {
    const ct = isObj(control) ? CONTROL_TYPES.find(x => x.type === control.type) : null;
    if (!ct) return undefined;
    const addresses = String(control.addresses || '').trim();
    return addresses ? `${ct.text}, rules out: ${addresses}` : ct.text;
  }
  function exportOptions(lab, state) {
    const words = shell(),
      options = { title: EXPORT_TITLE };
    for (const name of EXPORT_FORMATTERS)
      if (words && typeof words[name] === 'function') options[name] = safeFormatter(words[name]);
    if (words && typeof words.summarize === 'function') options.outcomeText = safeFormatter(o => words.summarize(o));
    if (lab && typeof lab.getSpecimen === 'function')
      options.specimenTitle = safeFormatter(id => specimenExportName(lab, id));
    if (lab && typeof lab.getMethod === 'function')
      options.methodTitle = safeFormatter(id => methodExportName(lab, id));
    options.controlText = safeFormatter(controlExportText);
    options.strengthText = safeFormatter(strength => STRENGTH_TEXT[strength]);
    // A run sealed for a draft experiment (the same rule as the report and lab.js) prints no outcome
    // in the file either: the engine writes one "Sealed until this experiment is revealed." line in
    // place of its label, summary and measurements (ENGINE-12, UX-POLISH-verify-1).
    options.isSealed = run => !!(isObj(run) && sealOf(state, run.id));
    return options;
  }
  // SIMPLE-notebook: the student's free notes (the shell's `state.notepad`, else CortexLab.getNotepad())
  // as a "## Notes" section after the five sections and before the Experiment log, under one
  // Reflection tag line; the text itself is printed as typed. Nothing when the notepad is blank.
  function notepadText(state) {
    if (isObj(state) && typeof state.notepad === 'string') return state.notepad;
    const s = shell();
    if (s && typeof s.getNotepad === 'function') {
      try {
        const text = s.getNotepad();
        if (typeof text === 'string') return text;
      } catch {
        /* no notepad */
      }
    }
    return '';
  }
  const NOTES_HEADING = '## Notes',
    NOTES_LEAD = 'Free notes, written by the student as they worked.';
  function withNotes(markdown, notes) {
    const text = String(notes || '')
      .replace(/\r\n?/g, '\n')
      .trim();
    if (!text) return markdown;
    const block = `${[NOTES_HEADING, '', `${K('ENTRY_TAG').reflection} ${NOTES_LEAD}`, '', text, ''].join('\n')}\n`;
    for (const marker of ['\n## Experiment log\n', '\n## Model detail (for instructors)\n']) {
      const at = markdown.indexOf(marker);
      if (at >= 0) return `${markdown.slice(0, at + 1)}${block}${markdown.slice(at + 1)}`;
    }
    return `${markdown.replace(/\n*$/, '\n')}\n${block}`;
  }
  function exportMarkdown(state, lab) {
    if (!lab || typeof lab.exportNotebook !== 'function')
      throw new Error('CortexLabNotebook.exportMarkdown needs a lab');
    // An experiment without a title is headed "Untitled experiment" (the designer's word) in place of
    // the engine's fallback, its id (UX-SMALL-verify-2); the state itself is not changed.
    const s = isObj(state) ? state : {},
      experiments = exportExperiments(s).map(e =>
        String(e.title || '').trim() ? e : { ...e, title: 'Untitled experiment' }
      ),
      measurements = (Array.isArray(s.measurementOrder) ? s.measurementOrder : Object.keys(s.measurements || {}))
        .map(id => (s.measurements || {})[id])
        .filter(isObj),
      options = exportOptions(lab, s);
    return withNotes(
      lab.exportNotebook(
        {
          notebook: isObj(s.notebook) ? s.notebook : lab.newNotebook(),
          experiments,
          runsById: isObj(s.runs) ? s.runs : {},
          measurements,
        },
        options
      ),
      notepadText(s)
    );
  }

  // A link the export writes as <https://...> reads as the bare address in the print view and the plain copy.
  const bareLinks = line => line.replace(/<((?:https?|mailto):[^<>\s]+)>/g, '$1');
  // Minimal, safe Markdown to HTML: headings, paragraphs, lists (with the export's two-space
  // continuation lines; "1. x" lines, the export's event list, as a numbered list keeping its numbers).
  // An item indented under another ("  - Cited for: ...", a run's measurements) is a list inside that
  // item, as a Markdown viewer shows it, not its sibling.
  // Every character of text is escaped; no inline markup is interpreted.
  function markdownToHtml(markdown) {
    const lines = String(markdown || '')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map(bareLinks);
    const out = [];
    // stack: the open lists, outermost first ({ ordered, indent, items }); last: the newest item.
    let para = [],
      stack = [],
      last = null;
    const flushPara = () => {
      if (para.length) out.push(`<p>${para.map(esc).join('<br>')}</p>`);
      para = [];
    };
    const listHtml = list => {
      const tag = list.ordered ? 'ol' : 'ul';
      return `<${tag}>${list.items.map(item => `<li${item.n ? ` value="${item.n}"` : ''}>${esc(item.text)}${item.extra.map(x => `<span class="labn-print-sub">${esc(x)}</span>`).join('')}${item.lists.map(listHtml).join('')}</li>`).join('')}</${tag}>`;
    };
    const flushList = () => {
      if (stack.length) out.push(listHtml(stack[0]));
      stack = [];
      last = null;
    };
    // A new list inside the newest item of the list on top of the stack.
    const nestList = (ordered, indent) => {
      const top = stack[stack.length - 1],
        list = { ordered, indent, items: [] };
      top.items[top.items.length - 1].lists.push(list);
      stack.push(list);
    };
    for (const line of lines) {
      const heading = /^(#{1,6})\s+(.*)$/.exec(line),
        item = /^\s*-\s+(.*)$/.exec(line),
        numbered = item ? null : /^\s*(\d+)\.\s+(.*)$/.exec(line);
      if (heading) {
        flushPara();
        flushList();
        const level = Math.min(6, heading[1].length + 1);
        out.push(`<h${level}>${esc(heading[2].trim())}</h${level}>`);
      } else if (item || numbered) {
        flushPara();
        const indent = /^\s*/.exec(line)[0].length,
          ordered = !!numbered;
        while (stack.length > 1 && indent < stack[stack.length - 1].indent) stack.pop();
        const top = stack[stack.length - 1];
        if (top && indent > top.indent) nestList(ordered, indent);
        else if (top && top.ordered !== ordered) {
          if (stack.length === 1) flushList();
          else {
            stack.pop();
            nestList(ordered, indent);
          }
        }
        if (!stack.length) stack.push({ ordered, indent, items: [] });
        last = numbered
          ? { n: Number(numbered[1]), text: numbered[2].trim(), extra: [], lists: [] }
          : { text: item[1].trim(), extra: [], lists: [] };
        stack[stack.length - 1].items.push(last);
      } else if (last && /^\s{2,}\S/.test(line)) {
        last.extra.push(line.trim());
      } else if (!line.trim()) {
        flushPara();
        flushList();
      } else {
        flushList();
        para.push(line.trim());
      }
    }
    flushPara();
    flushList();
    return out.join('\n');
  }

  // The same report without Markdown signs, for pasting into Canvas or a document: a top heading (# / ##)
  // becomes its text in capitals with a blank line after it, a ### / #### heading its text over a line of
  // dashes (so the levels stay readable), a list item keeps a plain dash (a numbered one needs none), an
  // entry's bracket tag becomes its words ("[Simulated: illustrative, not a measurement] x" -> "Simulated
  // (illustrative, not a measurement): x"; "[Reflection] x" -> "Reflection: x"), and <https://...> loses
  // its brackets. Only the signs change: every word, label and the disclaimer stay as the engine wrote them.
  const tagWords = tag => {
    const m = /^\[([^:\]]+)(?::\s*([^\]]+))?\]$/.exec(tag);
    return m ? `${m[1]}${m[2] ? ` (${m[2]})` : ''}:` : tag;
  };
  function markdownToPlain(markdown) {
    const tags = Object.values(K('ENTRY_TAG')).sort((a, b) => b.length - a.length),
      lines = String(markdown || '')
        .replace(/\r\n?/g, '\n')
        .split('\n'),
      out = [];
    lines.forEach((line, i) => {
      const heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (heading) {
        const text = heading[2].trim(),
          depth = heading[1].length;
        if (depth <= 2) {
          out.push(text.toUpperCase());
          if (i + 1 < lines.length && lines[i + 1].trim()) out.push('');
        } else if (depth <= 4) out.push(text, '-'.repeat(Math.max(3, text.length)));
        else out.push(text);
        return;
      }
      const item = /^(\s*)[-*+]\s+(.*)$/.exec(line);
      if (!item) {
        // The Notes section's tag line ("[Reflection] Free notes, ...") loses its brackets like an entry.
        const lead = tags.find(t => line === t || line.startsWith(`${t} `));
        out.push(lead ? `${tagWords(lead)}${line.slice(lead.length)}` : line);
        return;
      }
      let text = item[2];
      const tag = tags.find(t => text === t || text.startsWith(`${t} `));
      if (tag) text = `${tagWords(tag)}${text.slice(tag.length)}`;
      out.push(/^\d+[.)]\s/.test(text) ? `${item[1]}${text}` : `${item[1]}- ${text}`);
    });
    return out.map(bareLinks).join('\n');
  }

  // One print view at a time. Its close function is also what the pauser registered in
  // window.LAB.pausers calls when lab.js leaves the section (SHELL-5), so the view, the body class
  // and the document listener never outlive the lab view (NOTE-5). Registered once per pausers array.
  let closePrintView = null,
    printPausers = null;
  function registerPrintPauser() {
    const LAB = window.LAB;
    if (!LAB || !Array.isArray(LAB.pausers) || LAB.pausers === printPausers) return;
    LAB.pausers.push(() => {
      if (closePrintView) closePrintView();
    });
    printPausers = LAB.pausers;
  }
  function print(markdown) {
    if (closePrintView) closePrintView();
    for (const stray of document.querySelectorAll('.labn-print-view')) stray.remove();
    const opener = document.activeElement;
    const view = h(
      `<section class="labn labn-print-view" role="dialog" aria-modal="true" aria-label="Print view of your report"><div class="labn-print-bar labn-no-print"><p>Print view. Your browser's print dialog opens; choose "Save as PDF" there to keep a copy. Close returns to your report.</p><div class="labn-chip-row"><button type="button" class="btn labn-btn" data-labn-action="print-again">Print</button><button type="button" class="btn labn-btn" data-labn-action="close">Close</button></div></div><div class="labn-print-doc"></div></section>`
    );
    view.querySelector('.labn-print-doc').innerHTML = markdownToHtml(markdown);
    const inerted = [];
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      if (closePrintView === close) closePrintView = null;
      view.remove();
      document.body.classList.remove('labn-printing');
      document.removeEventListener('keydown', onKey);
      for (const node of inerted) node.removeAttribute('inert');
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
    const onKey = ev => {
      if (ev.key === 'Escape') close();
    };
    view.addEventListener('click', ev => {
      const button = ev.target && ev.target.closest ? ev.target.closest('[data-labn-action]') : null;
      if (!button) return;
      if (button.getAttribute('data-labn-action') === 'close') close();
      else if (typeof window.print === 'function') window.print();
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(view);
    document.body.classList.add('labn-printing');
    // Focus stays inside the dialog: the site's trapModal (Tab wrap, Escape, focus back to the opener
    // when the node leaves the document) when app.js is present, otherwise the rest of the page is inert.
    if (typeof window.trapModal === 'function') window.trapModal(view, close);
    else
      for (const node of document.body.children)
        if (node !== view && !node.hasAttribute('inert')) {
          node.setAttribute('inert', '');
          inerted.push(node);
        }
    closePrintView = close;
    registerPrintPauser();
    const closeButton = view.querySelector('[data-labn-action="close"]');
    if (closeButton) closeButton.focus();
    setTimeout(() => {
      if (view.isConnected && typeof window.print === 'function') window.print();
    }, 50);
    return view;
  }

  window.CortexLabNotebook = {
    mountDesigner,
    mountNotebook,
    exportMarkdown,
    print,
    markdownToHtml,
    markdownToPlain,
    // The report's file name, so the shell's download (onExport) can use the same one.
    fileName: REPORT_FILE,
  };
})();
