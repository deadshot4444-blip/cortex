/* ALZ histology lab: accessible microscope (ALZ-LAB-CONTRACT.md §4 and §8, PLAN-ALZ-LAB.md §7,
   PLAN-ALZ-LAB-SIMPLIFY.md §3.4). One view: a badge above the picture, a top bar (objective as a
   segmented control, a Compare menu when two runs are given, a Layers toggle), the picture with
   a one-line reference note under it, ONE "Measure" button that opens a sheet of five tools (each
   rule is read and confirmed with a checkbox before the tool opens), a "View controls" disclosure
   (zoom, pan, reset, high contrast, touch pan, keyboard help) and a "Numbers behind this image"
   expander (text alternative, layer choices, per-site tables, compare differences). The renderer
   is a deterministic procedural 2D painter (mulberry32 from specimen.seed; no Math.random, no
   images, no textures). Everything is wrapped in one IIFE; the only global is
   window.CortexLabMicroscope. The engine global window.SilverLab and the shell's window.CortexLab
   (words / badge / level) are read lazily, with private fallbacks of the same strings. Nothing
   drawn here is a measurement: the shades are an illustrative device and the short label is always
   painted into the image itself. Game layer (contract §10): aria-hidden hint chips over the picture
   say what a gesture does, and a hover / click tag names the drawn structure under the pointer.
   Real reference slides (contract §12): when a CC BY photo of a published slide matches the run
   (referenceSlides: the specimen's role and the run's by-eye look), a Picture switch offers it as
   the main picture (default), with its badge, credit and facts; it is an observed reference of a
   published slide, never the student's run, and the drawing stays one click away. Open free bench
   (contract §13.5): a run with a currently unknown reaction matches no real photo; the fallback
   line says why, and the drawing's caption and text alternative say an unknown dip is left out. */
(function (root) {
  'use strict';

  // ---- constants ---------------------------------------------------------------------------
  const OBJECTIVES = Object.freeze([4, 10, 20, 40]);
  const OBJECTIVE_NOTE = 'approximate field, not calibrated';
  // BRIEF §4B: a single thin section is never a 3D reconstruction; printed under every stain view.
  const SECTION_NOTE =
    'The field is one drawn thin section; a single section cannot establish a true 3D reconstruction of a plaque or tangle.';
  const FIELD = 1000; // schematic field units; no micrometres are implied anywhere
  const ZOOM_MIN = 0.5,
    ZOOM_MAX = 4,
    ZOOM_STEP = 1.25,
    PAN_STEP_PX = 48;
  const LABEL_SYNTHETIC = 'illustrative-synthetic',
    LABEL_NO_BASIS = 'no-basis',
    LABEL_OBSERVED = 'observed-reference';
  // View ids (the tabs became one view in UX-C; `tab` is still accepted by mount / update and
  // describe(), and these texts name the view in the text alternative).
  const TABS = Object.freeze([
    { id: 'observed', text: 'Reference image' },
    { id: 'simulation', text: 'Simulated picture' },
    { id: 'layers', text: 'Simulated picture with layers' },
  ]);
  const LAYER_KEYS = Object.freeze(['lesions', 'ionic', 'nuclei', 'deposit', 'background']);
  const LAYER_TEXT = Object.freeze({
    lesions: 'Where lesions are (dashed outline, not stained)',
    ionic: 'Bound silver (halo)',
    nuclei: 'Silver nuclei (dots)',
    deposit: 'Visible silver (what the stain shows)',
    background: 'Background silver',
  });
  // Shell vocabulary (contract §8.1): window.CortexLab.words wins when present; this private copy
  // keeps the same strings for node tests and for a page without lab.js.
  const FALLBACK_WORDS = Object.freeze({
    standard: 'standard (per procedure)',
    changed: 'changed',
    notSet: 'not set',
    simulated: 'Simulated · not a measurement',
    simulatedLong: 'Illustrative simulation from a teaching model, not a measurement.',
    notModeled: 'Not modeled',
    notModeledLong: 'The model has no rule for this change, so it shows no picture.',
    realSlide: 'Real slide · observed reference',
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
  });
  // Long (screen-reader) text for the badge kinds whose long words are not in CortexLab.words
  // (the same strings as lab.js LAB_BADGE_TEXT, Deviations UX-A-1).
  const BADGE_LONG = Object.freeze({
    'in-progress': 'The run is not finished; some steps are still to do.',
    observed: 'A real slide from a published study, not your run.',
  });
  const BADGE_WORDS = Object.freeze({
    simulated: ['simulated', 'simulatedLong'],
    'not-modeled': ['notModeled', 'notModeledLong'],
    'in-progress': ['inProgress', null],
    observed: ['realSlide', null],
  });
  // One-line plain rule per measurement tool for the Measure sheet (the full written rule from
  // rules.json shows when a tool is picked, before the "I read the rule" checkbox).
  const TOOL_PLAIN = Object.freeze({
    'roi-lesion-count': { name: 'Count lesions', line: 'Count one kind of lesion inside 9 fixed regions.' },
    'contrast-ordinal': { name: 'Contrast', line: 'Compare the darkest structure with the background.' },
    'artifact-area': { name: 'Artifact area', line: 'Outline folds, tears or stray silver that is not tissue.' },
    'tissue-coverage': { name: 'Tissue coverage', line: 'Count the grid squares that hold tissue.' },
    'blinded-quality-score': { name: 'Quality score', line: 'Rate the picture 1 to 5 on a scale you write first.' },
  });
  // HON-7: where a measurement goes (the status after recording; the sheet note says the first
  // part only, so the sentence is not shown twice). The export (engine, unchanged) lists
  // measurements only under the runs of an experiment; the report page lists every one under
  // "From your lab work".
  const REPORT_NOTE =
    'Saved in this lab and listed under From your lab work in My report. Add a note about it (or use the run in an experiment) to put it in the exported report.';
  // FIX3 (G4): with the shell's designer off (CortexLab.featureOn) the status names no experiment.
  const REPORT_NOTE_NO_EXP =
    'Saved in this lab and listed under From your lab work in My report. Add a note about it to put it in the exported report.';
  // A recorded measurement keeps its run as it is (the shell's lock); said in plain words right
  // after recording while the shell has the report on (FIX4, H2: with the report off a measurement
  // locks nothing and the status names no place the student cannot open; standalone, nothing locks).
  const LOCK_NOTE = 'This run now stays as it is so the record keeps matching; changes go in a new run.';
  // Under the picture (plain, ≤ 25 words); the full device note sits in the Numbers expander. The
  // "darker does not mean better" line is the shell's one honesty lede on every host screen (UX-A-3),
  // so it is not repeated here.
  const PICTURE_NOTE =
    'Shading follows the model scale, not an amount. One thin section cannot show a plaque or tangle in 3D.';
  // Layer names in the short update after a layer checkbox ("Bound silver layer hidden").
  const LAYER_SPOKEN = Object.freeze({
    lesions: 'Lesion outline',
    ionic: 'Bound silver',
    nuclei: 'Silver nuclei',
    deposit: 'Visible silver',
    background: 'Background silver',
  });
  // Structures in the short summaries (lesion structures first, like CortexLab.summarize).
  const SITE_PLURAL = Object.freeze({
    'plaque-core': 'plaque cores',
    'plaque-neurite': 'plaque neurites',
    tangle: 'tangles',
    axon: 'axons',
    'neuropil-thread': 'neuropil threads',
  });
  const NUMBER_WORDS = Object.freeze(['no', 'one', 'two', 'three', 'four', 'five', 'six']);
  const SIM_LAYERS = Object.freeze({ lesions: false, ionic: false, nuclei: false, deposit: true, background: true });
  const ALL_LAYERS = Object.freeze({ lesions: true, ionic: true, nuclei: true, deposit: true, background: true });
  // Five fixed illustrative tints for visibility 0..4 (none, trace, low, moderate, high): light tan
  // to near-black. Index 0 is painted with alpha 0 (a 'none' site is not visible).
  const TINTS = Object.freeze([
    Object.freeze({ color: '#e4d8c4', alpha: 0 }),
    Object.freeze({ color: '#c9a978', alpha: 0.72 }),
    Object.freeze({ color: '#8f6a45', alpha: 0.86 }),
    Object.freeze({ color: '#4e3826', alpha: 0.95 }),
    Object.freeze({ color: '#16110d', alpha: 1 }),
  ]);
  const TINTS_HC = Object.freeze([
    Object.freeze({ color: '#ffffff', alpha: 0 }),
    Object.freeze({ color: '#9c9c9c', alpha: 1 }),
    Object.freeze({ color: '#5e5e5e', alpha: 1 }),
    Object.freeze({ color: '#2a2a2a', alpha: 1 }),
    Object.freeze({ color: '#000000', alpha: 1 }),
  ]);
  // MODE-micro (contract §11.6): a gold-toned outcome (outcome.tone === 'gold') draws its visible
  // silver in a gray-black family at the same five positions (the course procedure: toning turns the
  // brown-black silver gray-black). Same alphas as the silver family; index 0 stays invisible.
  const TINTS_GOLD = Object.freeze([
    Object.freeze({ color: '#e6e8ea', alpha: 0 }),
    Object.freeze({ color: '#b0b4ba', alpha: 0.72 }),
    Object.freeze({ color: '#7d8188', alpha: 0.86 }),
    Object.freeze({ color: '#4a4e54', alpha: 0.95 }),
    Object.freeze({ color: '#111214', alpha: 1 }),
  ]);
  const TINTS_GOLD_HC = Object.freeze([
    Object.freeze({ color: '#ffffff', alpha: 0 }),
    Object.freeze({ color: '#a3a8b0', alpha: 1 }),
    Object.freeze({ color: '#60656c', alpha: 1 }),
    Object.freeze({ color: '#2b2e33', alpha: 1 }),
    Object.freeze({ color: '#000000', alpha: 1 }),
  ]);
  const TONE_NOTE = 'Gold toned (drawn): the visible silver is drawn gray-black instead of brown-black.';
  const UNSTAINED_NOTE = 'Unstained: no silver was reduced on this section (a drawing).';
  // Under the layers table of a run whose slide went through thiosulfate (outcome.slide.fixed): the
  // Bound silver column reads none because the step removed it, not because nothing was ever bound.
  const FIXED_NOTE =
    'Bound silver is at none here: the thiosulfate step removed the unreduced silver; the visible silver is what was reduced before it (course procedure).';
  // The two drawn artifacts (outcome.artifacts): their identify-tag / caption names.
  const ARTIFACT_TEXT = Object.freeze({ patchy: 'patchy (drawn)', grains: 'black grains (drawn)' });
  const PAPER = '#f8f2e7',
    PAPER_TAN = '#c9b58f',
    PAPER_HC = '#ffffff';
  const BG_DENSITY = Object.freeze([0, 0.1, 0.26, 0.48, 0.72]);
  const LAYER_COLORS = Object.freeze({ lesions: '#1f7a4d', ionic: '#1769d2', nuclei: '#c2410c' });
  const LAYER_COLORS_HC = Object.freeze({ lesions: '#000000', ionic: '#0000cc', nuclei: '#cc0000' });
  const COUNT_PER_PRESENCE = Object.freeze({
    'plaque-core': 3,
    'plaque-neurite': 18, // 3 clusters x 6 radiating segments per presence step
    tangle: 5,
    'neuropil-thread': 28,
    axon: 7,
  });
  const DRAW_ORDER = Object.freeze({ axon: 0, 'neuropil-thread': 1, 'plaque-neurite': 2, 'plaque-core': 3, tangle: 4 });
  const FALLBACK_SITES = Object.freeze([
    'axon',
    'plaque-core',
    'plaque-neurite',
    'tangle',
    'neuropil-thread',
    'background',
  ]);
  const FALLBACK_ORDINAL = Object.freeze(['none', 'trace', 'low', 'moderate', 'high']);
  const ROI_GRID = 3,
    CELL_GRID = 6;
  const CONTRAST_SAMPLE_PX = 256;
  // GAME-micro (contract §10): hint chips under the picture say what a gesture does ([verb, what]);
  // a picture tool shows its own verb (desktop, touch) while its grid or outline is drawn. No key
  // chips: keys work only once the picture has focus (the keys list in View controls says so).
  // The IDENTIFY chips show only while the current layers draw a structure to name.
  const IDENTIFY = 'what it is';
  const HUD_DESKTOP = Object.freeze([
    ['Drag', 'move around'],
    ['Ctrl/⌘ + scroll', 'zoom'],
    ['Click a structure', IDENTIFY],
  ]);
  // Touch: one finger scrolls the page until "Drag to pan" (inside View controls) is on.
  const HUD_TOUCH = Object.freeze([
    ['Tap a structure', IDENTIFY],
    ['View controls › Drag to pan', 'move around'],
  ]);
  const HUD_TOUCH_PAN = Object.freeze([
    ['Drag', 'move around'],
    ['Pinch', 'zoom'],
    ['Tap a structure', IDENTIFY],
  ]);
  const TOOL_VERBS = Object.freeze({
    'artifact-area': [['Click', 'Tap'], 'add an outline point'],
    'roi-lesion-count': [['Click a lesion', 'Tap a lesion'], 'count it in its region'],
  });
  // REF-micro (contract §12.3): the real slide's chips. A click counts only through Measure › Count
  // lesions (the chip says where); with the tool open each click adds a numbered ring.
  const COUNT_WHERE = 'count (Measure › Count lesions)';
  const HUD_REAL_DESKTOP = Object.freeze([
    ['Drag', 'move around'],
    ['Ctrl/⌘ + scroll', 'zoom'],
    ['Click', COUNT_WHERE],
  ]);
  const HUD_REAL_TOUCH = Object.freeze([
    ['Tap', COUNT_WHERE],
    ['View controls › Drag to pan', 'move around'],
  ]);
  const HUD_REAL_TOUCH_PAN = Object.freeze([
    ['Drag', 'move around'],
    ['Pinch', 'zoom'],
    ['Tap', COUNT_WHERE],
  ]);
  const REAL_COUNT_VERB = Object.freeze([['Click', 'Tap'], 'add a numbered ring']);
  const PHOTO_ZOOM_MAX = 4; // the photo never leaves its box empty: zoom 1 shows it whole
  const PHOTO_ROLE_SETS = Object.freeze({
    'positive-control-stand-in': Object.freeze(['positive', 'other']),
    experimental: Object.freeze(['positive', 'other']),
    'negative-comparison-stand-in': Object.freeze(['negative']),
  });
  const VIEW_TEXT = Object.freeze({ real: 'Real slide', drawing: 'Drawing (simulation)' });
  const REAL_NOTE = 'A real slide from a published study, not your run.';
  const DARKER_NOTE = 'Darker does not mean more protein, more pathology or a better method.';
  const REFERENCE_NONE = "No real photo of this condition is in the library; this drawing is the model's picture.";
  // OPEN-micro (contract §13.5): a free run with a currently unknown reaction matches no real photo;
  // the fallback line says why, and the drawing's caption says a whole unknown dip is left out.
  const REFERENCE_UNKNOWN =
    'This slide had a currently unknown reaction, so no real photo is matched; the drawing leaves that dip out.';
  const REFERENCE_PARTLY_UNKNOWN =
    "This slide had a partly unknown reaction, so no real photo is matched; the drawing shows the procedure's effect for it.";
  const UNKNOWN_DIP_NOTE = 'Includes a currently unknown reaction (left out of the drawing).';
  const PHOTO_COUNT_NOTE = 'Your own count on a real slide; the model does not know the answer.';
  const TOOL_READS_DRAWING = 'This tool reads the drawing: switch to Drawing (simulation).';
  const HIT_PX = 4, // identify tolerance in screen pixels
    TAG_PIN_MS = 2500, // a mouse click shows the tag this long (a tap keeps it until the next press)
    TAG_MOVE_PX = 8, // a pinned tag stays until the mouse moves this far
    TAG_GAP_PX = 14, // tag beside the pointer
    TAG_NEAR_PX = 48, // on the same structure the tag holds still until the pointer is this far from it
    FINGER_PX = 28, // a finger's tag sits this far above the touch point, clear of the fingertip
    CLICK_PX = 3, // a mouse press that moves further pans instead of clicking
    TAP_PX = 8, // the same for a finger or pen (Euclidean), which wobbles more
    COUNT_PX = 6, // Count lesions: a mouse click this close to a drawn lesion of the counted kind counts
    COUNT_TOUCH_PX = 12, // the same for a finger or pen
    COUNT_DOUBLE_MS = 600, // a second click / tap on the same lesion this soon is a double click's second half
    REVEAL_GAP_PX = 20, // the full view opens with the badge about this far below the site's top bar
    BAND_PAD_PX = 8; // what a picture tool brings up sits this far inside the free band

  // ---- helpers -----------------------------------------------------------------------------
  const S = () => root.SilverLab || null;
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const ordinal = n => clamp(Math.round(Number(n) || 0), 0, 4);
  const esc = s =>
    String(s ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  function h(html) {
    const t = root.document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  const sites = () => (S() ? S().SITE_CLASSES : FALLBACK_SITES);
  const targetSites = () => sites().filter(site => site !== 'background');
  const ordWord = n => (S() ? S().ORDINAL_TEXT : FALLBACK_ORDINAL)[ordinal(n)];
  const siteText = site => (S() && S().SITE_TEXT && S().SITE_TEXT[site]) || site;
  const labelText = label => (S() && S().LABEL_TEXT && S().LABEL_TEXT[label]) || String(label || '');
  const isCard = out => !!out && out.label === LABEL_NO_BASIS;
  const isSynthetic = out => !!out && out.label === LABEL_SYNTHETIC;
  const toolsEnabled = out => isSynthetic(out);
  // ---- shell vocabulary and badges (contract §8.1; window.CortexLab first, private copy after) --
  const shell = () => root.CortexLab || null;
  const W = key => {
    const words = shell() && shell().words;
    return (words && typeof words[key] === 'string' && words[key]) || FALLBACK_WORDS[key] || '';
  };
  // Engine sentences in plain words ("this change (washes: changed)") when the shell is loaded.
  const plain = text => {
    const fn = shell() && shell().plain;
    if (typeof fn === 'function') {
      try {
        const out = fn(text);
        if (typeof out === 'string') return out;
      } catch {
        /* the engine text below */
      }
    }
    return String(text || '');
  };
  const level = n => {
    const fn = shell() && shell().level;
    if (typeof fn === 'function') {
      try {
        const word = fn(ordinal(n));
        if (typeof word === 'string' && word) return word;
      } catch {
        /* fall back to the engine words */
      }
    }
    return ordWord(n);
  };
  // 'simulated' | 'not-modeled' | 'in-progress' (a step-skipped card is a run still in progress).
  const badgeKind = out =>
    isSynthetic(out) ? 'simulated' : out && out.code === 'step-skipped' ? 'in-progress' : 'not-modeled';
  function badgeHtml(kind, label) {
    const fn = shell() && shell().badge;
    if (typeof fn === 'function') {
      try {
        const html = fn(kind, label ? { label } : {});
        if (typeof html === 'string' && html) return html;
      } catch {
        /* fall back to the private markup */
      }
    }
    const [shortKey, longKey] = BADGE_WORDS[kind] || BADGE_WORDS['not-modeled'],
      long = longKey ? W(longKey) : BADGE_LONG[kind] || '';
    return `<span class="lab-badge lab-badge-${esc(kind)}" data-lab-badge="${esc(kind)}"${label ? ` data-lab-label="${esc(label)}"` : ''}><span class="lab-badge-text">${esc(W(shortKey))}</span>${long ? `<span class="lab-sr-only"> ${esc(long)}</span>` : ''}</span>`;
  }
  // Every badge on an engine output carries data-lab-label=<engine label> (a missing outcome is
  // shown as the no-basis label it stands for).
  function badgeForOutcome(out) {
    const fn = shell() && shell().badgeForOutcome;
    if (out && typeof fn === 'function') {
      try {
        const html = fn(out);
        if (typeof html === 'string' && /data-lab-label=/.test(html)) return html;
      } catch {
        /* fall back to the private markup */
      }
    }
    return badgeHtml(badgeKind(out), (out && out.label) || LABEL_NO_BASIS);
  }
  // Short label painted into the bitmap and used in canvas names (the badge's visible words: a run
  // still in progress reads "Steps still to do", never Not modeled).
  const shortLabel = out =>
    isSynthetic(out)
      ? W('simulated')
      : out && out.code === 'step-skipped'
        ? W('inProgress')
        : !out || isCard(out)
          ? W('notModeled')
          : labelText(out.label);
  const visibilityOf = (out, site) => ordinal(out && out.perSite && out.perSite[site] && out.perSite[site].visibility);
  const stateOf = (out, site, key) => {
    const s = out && out.state && out.state[site];
    return s && s[key] !== undefined ? s[key] : null;
  };
  function hexRgb(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgbHex = rgb => '#' + rgb.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => rgbHex(hexRgb(a).map((v, i) => v + (hexRgb(b)[i] - v) * t));
  const luminance = rgb => (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  // 'gold' only when the engine says so (outcome.tone); anything else is today's silver family.
  const toneOf = out => (out && out.tone === 'gold' ? 'gold' : 'silver');
  const tintsFor = (highContrast, tone) =>
    tone === 'gold' ? (highContrast ? TINTS_GOLD_HC : TINTS_GOLD) : highContrast ? TINTS_HC : TINTS;
  // MODE-FIX-micro-2: the field is painted on the same five-shade scale as the structures (the
  // background's model-scale shade composited over the paper), so a structure one step above the
  // background stands out by one step and a background at or above the darkest structure merges
  // with it: the picture reads "dark brown everywhere" exactly when the engine's look says so,
  // instead of a light tan field under crisp black structures. High contrast keeps a white field.
  const paperFor = (bg, hc, tone) => {
    if (hc) return PAPER_HC;
    const tint = tintsFor(false, tone)[ordinal(bg)];
    return mix(PAPER, tint.color, tint.alpha);
  };
  // Luminance of a tint composited over a paper colour (what a clean sample of the render reads).
  function compositeLuminance(tint, paper) {
    const p = hexRgb(paper),
      c = hexRgb(tint.color);
    return luminance(p.map((v, i) => v * (1 - tint.alpha) + c[i] * tint.alpha));
  }
  function tintFor(visibility, highContrast, tone) {
    return tintsFor(!!highContrast, tone)[ordinal(visibility)];
  }
  // outcome.look { key, text } when the engine provides it (contract §11.4); null otherwise.
  const lookOf = out =>
    out && out.look && typeof out.look === 'object' && typeof out.look.text === 'string' && out.look.text
      ? out.look
      : null;
  const lookColor = key => {
    const colors = S() && S().LOOK_COLORS;
    return colors && typeof colors[key] === 'string' ? colors[key] : '';
  };
  // OPEN-micro (contract §13.2): a free run's whole-dip unknowns (outcome.unknownDips) and partly
  // unknown fields (outcome.unknownFields); a missing or empty list is none (older engines).
  const hasUnknownDips = out => !!out && Array.isArray(out.unknownDips) && out.unknownDips.length > 0;
  const hasUnknownFields = out => !!out && Array.isArray(out.unknownFields) && out.unknownFields.length > 0;
  const referenceFallback = out =>
    hasUnknownDips(out) ? REFERENCE_UNKNOWN : hasUnknownFields(out) ? REFERENCE_PARTLY_UNKNOWN : REFERENCE_NONE;
  // The drawn artifacts the outcome carries, in a fixed order (patchy, grains); other ids are not drawn.
  const artifactsOf = out =>
    Array.isArray(out && out.artifacts) ? Object.keys(ARTIFACT_TEXT).filter(a => out.artifacts.includes(a)) : [];
  // A drawn outcome whose every structure's visibility is 0 and whose background is 0: nothing
  // was reduced on the section (an unstained slide is a real thing to look at).
  const isUnstained = out =>
    isSynthetic(out) && ordinal(out.background) === 0 && targetSites().every(site => visibilityOf(out, site) === 0);
  const prefersReducedMotion = settings =>
    (settings && settings.reducedMotion === 'on') ||
    !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const coarsePointer = () => !!(root.matchMedia && root.matchMedia('(pointer: coarse)').matches);
  // "Show hints" (contract §10): off when CortexLab.hintsOn() says false or the html carries
  // lab-hints-off; on by default (no shell loaded).
  // FIX3 (G4): a lab feature ('report', 'designer', 'activities') the shell has on. Without the
  // shell's featureOn (standalone, tests) everything stays as it was: on.
  function featureOn(name) {
    const fn = shell() && shell().featureOn;
    if (typeof fn !== 'function') return true;
    try {
      return fn(name) !== false;
    } catch {
      return true;
    }
  }
  function hintsShown() {
    const fn = shell() && shell().hintsOn;
    if (typeof fn === 'function') {
      try {
        if (fn() === false) return false;
      } catch {
        /* default on */
      }
    }
    const html = root.document && root.document.documentElement;
    return !(html && html.classList && html.classList.contains('lab-hints-off'));
  }

  // mulberry32: a small deterministic PRNG. The specimen seed decides every shape position.
  function prng(seed) {
    let a = Number(seed) >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- shape list (precomputed once per specimen + seed + presence signature) ---------------
  const shapeCache = new Map();
  const presenceOf = (specimen, site) =>
    ordinal(specimen && specimen.sites && specimen.sites[site] && specimen.sites[site].presence);
  const dotsAround = (rnd, x, y, r) =>
    Array.from({ length: 8 }, () => {
      const a = rnd() * Math.PI * 2,
        d = Math.sqrt(rnd()) * r;
      return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
    });
  const dotsAlong = (rnd, x1, y1, x2, y2) =>
    Array.from({ length: 8 }, () => {
      const t = rnd();
      return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
    });
  function shapeList(specimen, seedOverride) {
    const seed =
      seedOverride === undefined || seedOverride === null
        ? Number(specimen && specimen.seed) || 1
        : Number(seedOverride) || 1;
    const names = ['plaque-core', 'plaque-neurite', 'tangle', 'neuropil-thread', 'axon'];
    const key = `${specimen && specimen.id}|${seed}|${names.map(s => presenceOf(specimen, s)).join('')}`;
    if (shapeCache.has(key)) return shapeCache.get(key);
    const rnd = prng(seed),
      shapes = [],
      counts = {};
    const coreN = presenceOf(specimen, 'plaque-core') * COUNT_PER_PRESENCE['plaque-core'],
      neuClusters = presenceOf(specimen, 'plaque-neurite') * 3,
      centers = [];
    for (let i = 0; i < Math.max(coreN, neuClusters); i++)
      centers.push({ x: 90 + rnd() * (FIELD - 180), y: 90 + rnd() * (FIELD - 180), r: 24 + rnd() * 24 });
    for (let i = 0; i < coreN; i++) {
      const c = centers[i],
        lobes = [];
      for (let k = 0; k < 9; k++) lobes.push(0.8 + rnd() * 0.4);
      shapes.push({
        site: 'plaque-core',
        kind: 'blob',
        x: c.x,
        y: c.y,
        r: c.r,
        lobes,
        dots: dotsAround(rnd, c.x, c.y, c.r * 0.7),
      });
    }
    for (let i = 0; i < neuClusters; i++) {
      const c = centers[i];
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + rnd() * 0.7,
          r0 = c.r * (1.05 + rnd() * 0.35),
          len = 16 + rnd() * 26,
          x1 = c.x + Math.cos(a) * r0,
          y1 = c.y + Math.sin(a) * r0,
          x2 = x1 + Math.cos(a) * len,
          y2 = y1 + Math.sin(a) * len;
        shapes.push({
          site: 'plaque-neurite',
          kind: 'segment',
          x1,
          y1,
          x2,
          y2,
          w: 3.2,
          dots: dotsAlong(rnd, x1, y1, x2, y2),
        });
      }
    }
    const tangleN = presenceOf(specimen, 'tangle') * COUNT_PER_PRESENCE.tangle;
    for (let i = 0; i < tangleN; i++) {
      const x = 60 + rnd() * (FIELD - 120),
        y = 60 + rnd() * (FIELD - 120),
        hgt = 26 + rnd() * 18,
        wid = 13 + rnd() * 9;
      shapes.push({
        site: 'tangle',
        kind: 'flame',
        x,
        y,
        hgt,
        wid,
        a: -0.6 + rnd() * 1.2,
        dots: dotsAround(rnd, x, y, wid * 0.6),
      });
    }
    const threadN = presenceOf(specimen, 'neuropil-thread') * COUNT_PER_PRESENCE['neuropil-thread'];
    for (let i = 0; i < threadN; i++) {
      const x1 = 20 + rnd() * (FIELD - 40),
        y1 = 20 + rnd() * (FIELD - 40),
        a = rnd() * Math.PI * 2,
        len = 14 + rnd() * 24,
        x2 = x1 + Math.cos(a) * len,
        y2 = y1 + Math.sin(a) * len;
      shapes.push({
        site: 'neuropil-thread',
        kind: 'line',
        x1,
        y1,
        x2,
        y2,
        w: 1.5,
        dots: dotsAlong(rnd, x1, y1, x2, y2),
      });
    }
    const axonN = presenceOf(specimen, 'axon') * COUNT_PER_PRESENCE.axon;
    for (let i = 0; i < axonN; i++) {
      const x1 = rnd() * FIELD,
        y1 = rnd() * FIELD,
        a = rnd() * Math.PI * 2,
        len = 220 + rnd() * 220,
        x2 = x1 + Math.cos(a) * len,
        y2 = y1 + Math.sin(a) * len,
        bend = (rnd() - 0.5) * 160,
        cx = (x1 + x2) / 2 - Math.sin(a) * bend,
        cy = (y1 + y2) / 2 + Math.cos(a) * bend;
      shapes.push({
        site: 'axon',
        kind: 'curve',
        x1,
        y1,
        cx,
        cy,
        x2,
        y2,
        w: 2.6,
        dots: dotsAlong(rnd, x1, y1, x2, y2),
      });
    }
    const noise = [];
    for (let i = 0; i < 1600; i++) noise.push({ x: rnd() * FIELD, y: rnd() * FIELD, v: rnd(), s: 1.2 + rnd() * 2.4 });
    shapes.sort((p, q) => DRAW_ORDER[p.site] - DRAW_ORDER[q.site]);
    for (const site of names) counts[site] = shapes.filter(s => s.site === site).length;
    const list = Object.freeze({
      seed,
      shapes: Object.freeze(shapes),
      noise: Object.freeze(noise),
      counts: Object.freeze(counts),
    });
    shapeCache.set(key, list);
    return list;
  }
  function anchorOf(shape) {
    switch (shape.kind) {
      case 'blob':
        return { x: shape.x, y: shape.y };
      case 'flame':
        return { x: shape.x, y: shape.y - shape.hgt * 0.15 };
      case 'curve':
        return {
          x: 0.25 * shape.x1 + 0.5 * shape.cx + 0.25 * shape.x2,
          y: 0.25 * shape.y1 + 0.5 * shape.cy + 0.25 * shape.y2,
        };
      default:
        return { x: (shape.x1 + shape.x2) / 2, y: (shape.y1 + shape.y2) / 2 };
    }
  }
  // GAME-micro identify: is field point (x, y) on this drawn shape (within tol field units)? The
  // outlines are the ones tracePath draws, approximated (lobed radius, flame spine, sampled curve).
  function distToSegment(x, y, x1, y1, x2, y2) {
    const dx = x2 - x1,
      dy = y2 - y1,
      len2 = dx * dx + dy * dy,
      t = len2 ? clamp(((x - x1) * dx + (y - y1) * dy) / len2, 0, 1) : 0;
    return Math.hypot(x - (x1 + dx * t), y - (y1 + dy * t));
  }
  function onShape(shape, x, y, tol) {
    if (shape.kind === 'blob') {
      const n = shape.lobes.length,
        f = (((Math.atan2(y - shape.y, x - shape.x) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * n,
        i = Math.floor(f) % n,
        r = shape.r * (shape.lobes[i] + (shape.lobes[(i + 1) % n] - shape.lobes[i]) * (f - Math.floor(f)));
      return Math.hypot(x - shape.x, y - shape.y) <= r + tol;
    }
    if (shape.kind === 'flame') {
      const tipX = shape.x + Math.sin(shape.a) * shape.hgt * 0.5;
      return (
        distToSegment(x, y, shape.x, shape.y + shape.hgt / 2, tipX, shape.y - shape.hgt / 2) <= shape.wid / 2 + tol
      );
    }
    if (shape.kind === 'curve') {
      let px = shape.x1,
        py = shape.y1;
      for (let k = 1; k <= 16; k++) {
        const t = k / 16,
          u = 1 - t,
          qx = u * u * shape.x1 + 2 * u * t * shape.cx + t * t * shape.x2,
          qy = u * u * shape.y1 + 2 * u * t * shape.cy + t * t * shape.y2;
        if (distToSegment(x, y, px, py, qx, qy) <= shape.w / 2 + tol) return true;
        px = qx;
        py = qy;
      }
      return false;
    }
    return distToSegment(x, y, shape.x1, shape.y1, shape.x2, shape.y2) <= shape.w / 2 + tol;
  }
  // The top-most drawn shape at field point (x, y), or null. opts: { tolerance (field units),
  // seed, drawn(shape) -> boolean (which shapes the current view paints; default all) }.
  function structureAt(specimen, x, y, opts = {}) {
    const list = shapeList(specimen, opts.seed),
      tol = Math.max(0, Number(opts.tolerance) || 0),
      drawn = typeof opts.drawn === 'function' ? opts.drawn : () => true;
    for (let i = list.shapes.length - 1; i >= 0; i--) {
      const shape = list.shapes[i];
      if (drawn(shape) && onShape(shape, x, y, tol)) return shape;
    }
    return null;
  }

  // ---- drawn artifacts (MODE-micro, contract §11.6) ---------------------------------------
  // Seeded from the run id (a string) so the same run always draws the same patches and grains.
  function hashSeed(id) {
    let hsh = 2166136261;
    for (const ch of String(id || '')) hsh = Math.imul(hsh ^ ch.charCodeAt(0), 16777619);
    return hsh >>> 0 || 1;
  }
  const artifactCache = new Map();
  // { patches: [{ x, y, r, lobes }], grains: [{ x, y, s }] } in field units: 6 irregular pale
  // regions (a patchy, uneven stain) and 160 small black specks (grains from a cloudy bath). The
  // counts are a drawing, not a quantity.
  function artifactList(seed) {
    const n = Number(seed) >>> 0 || 1;
    if (artifactCache.has(n)) return artifactCache.get(n);
    const rnd = prng(n ^ 0x5bd1e995),
      patches = [],
      grains = [];
    for (let i = 0; i < 6; i++) {
      const lobes = [];
      for (let k = 0; k < 11; k++) lobes.push(0.55 + rnd() * 0.75);
      patches.push({ x: 60 + rnd() * (FIELD - 120), y: 60 + rnd() * (FIELD - 120), r: 70 + rnd() * 110, lobes });
    }
    for (let i = 0; i < 160; i++) grains.push({ x: rnd() * FIELD, y: rnd() * FIELD, s: 1.6 + rnd() * 1.8 });
    const list = Object.freeze({ seed: n, patches: Object.freeze(patches), grains: Object.freeze(grains) });
    artifactCache.set(n, list);
    return list;
  }
  // 'patchy' | 'grains' | null: the drawn artifact at field point (x, y) (tol: field units).
  function artifactAt(seed, artifacts, x, y, tol) {
    const list = artifactList(seed),
      has = a => Array.isArray(artifacts) && artifacts.includes(a);
    if (has('grains') && list.grains.some(g => Math.hypot(x - g.x, y - g.y) <= g.s + tol)) return 'grains';
    if (has('patchy') && list.patches.some(p => onShape({ kind: 'blob', ...p }, x, y, tol))) return 'patchy';
    return null;
  }

  // ---- painting ----------------------------------------------------------------------------
  function viewTransform(cssW, cssH, view = {}) {
    const objective = OBJECTIVES.includes(view.objective) ? view.objective : 10,
      zoom = clamp(Number(view.zoom) || 1, ZOOM_MIN, ZOOM_MAX),
      scale = (Math.min(cssW, cssH) / FIELD) * (objective / 4) * zoom,
      cx = view.cx === undefined ? FIELD / 2 : view.cx,
      cy = view.cy === undefined ? FIELD / 2 : view.cy;
    return { objective, zoom, scale, ox: cssW / 2 - cx * scale, oy: cssH / 2 - cy * scale };
  }
  function tracePath(ctx, shape) {
    ctx.beginPath();
    if (shape.kind === 'blob') {
      const n = shape.lobes.length;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2,
          r = shape.r * shape.lobes[i % n];
        const x = shape.x + Math.cos(a) * r,
          y = shape.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else if (shape.kind === 'flame') {
      const { x, y, hgt, wid, a } = shape,
        sx = Math.sin(a) * hgt;
      ctx.moveTo(x - wid / 2, y + hgt / 2);
      ctx.quadraticCurveTo(x - wid * 0.9, y - hgt * 0.1, x + sx * 0.5, y - hgt / 2);
      ctx.quadraticCurveTo(x + wid * 0.9, y - hgt * 0.1, x + wid / 2, y + hgt / 2);
      ctx.quadraticCurveTo(x, y + hgt * 0.62, x - wid / 2, y + hgt / 2);
      ctx.closePath();
    } else if (shape.kind === 'curve') {
      ctx.moveTo(shape.x1, shape.y1);
      ctx.quadraticCurveTo(shape.cx, shape.cy, shape.x2, shape.y2);
    } else {
      ctx.moveTo(shape.x1, shape.y1);
      ctx.lineTo(shape.x2, shape.y2);
    }
  }
  const isFilled = shape => shape.kind === 'blob' || shape.kind === 'flame';
  function paintDeposit(ctx, shape, tint, hc) {
    if (tint.alpha <= 0) return;
    ctx.globalAlpha = tint.alpha;
    ctx.fillStyle = tint.color;
    ctx.strokeStyle = tint.color;
    ctx.lineCap = 'round';
    tracePath(ctx, shape);
    if (isFilled(shape)) {
      ctx.fill();
      ctx.lineWidth = hc ? 1.6 : 1;
      ctx.stroke();
    } else {
      ctx.lineWidth = shape.w * (hc ? 1.35 : 1);
      ctx.stroke();
      if (shape.kind === 'segment') {
        ctx.beginPath();
        ctx.arc(shape.x2, shape.y2, shape.w * 0.95, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  function paintOutline(ctx, shape, color, scale) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2 / Math.sqrt(scale);
    ctx.setLineDash([4 / Math.sqrt(scale), 3 / Math.sqrt(scale)]);
    ctx.globalAlpha = 0.85;
    tracePath(ctx, shape);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  function paintIonic(ctx, shape, level, color, hc) {
    if (!level) return;
    ctx.globalAlpha = hc ? 0.25 + 0.15 * level : 0.1 + 0.14 * level;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    tracePath(ctx, shape);
    if (isFilled(shape)) {
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.fill();
    } else {
      ctx.lineWidth = (shape.w || 1) + 5;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function paintNuclei(ctx, shape, level, color, hc) {
    if (!level) return;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.95;
    const dots = shape.dots.slice(0, level * 2);
    for (const d of dots) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, hc ? 2.4 : 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function paintGrid(ctx, n, scale, numbered, hc) {
    ctx.strokeStyle = hc ? '#000000' : '#1769d2';
    ctx.lineWidth = 1.5 / scale;
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.9;
    for (let i = 0; i <= n; i++) {
      const p = (FIELD / n) * i;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, FIELD);
      ctx.moveTo(0, p);
      ctx.lineTo(FIELD, p);
      ctx.stroke();
    }
    if (numbered) {
      ctx.fillStyle = hc ? '#000000' : '#1769d2';
      ctx.font = `${14 / scale}px system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++)
          ctx.fillText(String(r * n + c + 1), (FIELD / n) * c + 6 / scale, (FIELD / n) * r + 4 / scale);
    }
    ctx.globalAlpha = 1;
  }
  function paintPolygon(ctx, pts, close, scale, hc) {
    if (!pts.length) return;
    ctx.strokeStyle = hc ? '#cc0000' : '#c52b37';
    ctx.fillStyle = hc ? '#cc0000' : '#c52b37';
    ctx.lineWidth = 2 / scale;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    if (close) {
      ctx.closePath();
      ctx.globalAlpha = 0.22;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.stroke();
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5 / scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Patchy: pale irregular regions laid over the stained section (the solution did not reach it
  // evenly); grains: black specks with a faint sheen. Both are painted under every picture-tool
  // overlay (grid, outlines, the count rings), so nothing a tool draws is hidden.
  function paintPatches(ctx, patches, paper, hc, scale = 1) {
    // Paler than the paper around it (toward white), so a patch reads on a tan background too.
    ctx.fillStyle = hc ? '#ffffff' : mix(paper, '#ffffff', 0.6);
    for (const p of patches) {
      const blob = { kind: 'blob', ...p };
      ctx.globalAlpha = hc ? 0.5 : 0.42;
      tracePath(ctx, { ...blob, r: p.r * 1.18 });
      ctx.fill();
      ctx.globalAlpha = hc ? 0.92 : 0.8;
      tracePath(ctx, blob);
      ctx.fill();
      // MODE-FIX-micro-4: a thin dashed edge, so the pale region is legible on an unstained (cream)
      // section too and reads as drawn, which the "(drawn)" label says it is.
      ctx.setLineDash([6 / scale, 4 / scale]);
      ctx.lineWidth = 1.25 / scale;
      ctx.strokeStyle = hc ? '#000000' : mix(paper, PAPER_TAN, 0.7);
      ctx.globalAlpha = hc ? 0.9 : 0.55;
      tracePath(ctx, blob);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }
  function paintGrains(ctx, grains, hc) {
    for (const g of grains) {
      ctx.globalAlpha = hc ? 1 : 0.9;
      ctx.fillStyle = hc ? '#000000' : '#101010';
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.s, 0, Math.PI * 2);
      ctx.fill();
      // the sheen: a small lighter dot off centre
      ctx.globalAlpha = hc ? 0.8 : 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(g.x - g.s * 0.35, g.y - g.s * 0.35, g.s * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function paintCells(ctx, cells, n, hc) {
    ctx.fillStyle = hc ? '#cc0000' : '#c52b37';
    ctx.globalAlpha = 0.28;
    for (const key of cells) {
      const [r, c] = key.split(',').map(Number);
      ctx.fillRect((FIELD / n) * c, (FIELD / n) * r, FIELD / n, FIELD / n);
    }
    ctx.globalAlpha = 1;
  }
  // FIX5 (I1): Count lesions rings each counted lesion and numbers it in the order counted, so the
  // tally can be seen on the picture (and a ringed lesion is the one a click takes back). Sizes are
  // screen px: a ring just outside a plaque core or a tangle, at least 11 px round a thin shape.
  function markRadius(shape) {
    if (shape.kind === 'blob') return shape.r * Math.max(...shape.lobes);
    if (shape.kind === 'flame') return shape.hgt * 0.6;
    return 0;
  }
  function paintMarks(ctx, shapes, scale, hc) {
    const color = hc ? '#000000' : '#1769d2';
    ctx.save();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    shapes.forEach((shape, i) => {
      const a = anchorOf(shape),
        r = Math.max(markRadius(shape) + 4 / scale, 11 / scale),
        label = String(i + 1),
        br = (label.length > 1 ? 9.5 : 8) / scale,
        bx = a.x + r * Math.SQRT1_2,
        by = a.y - r * Math.SQRT1_2;
      // A white halo under the ring keeps it visible on dark silver and on pale paper alike.
      ctx.beginPath();
      ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5 / scale;
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5 / scale;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 / scale;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${11 / scale}px system-ui, sans-serif`;
      ctx.fillText(label, bx, by + 0.5 / scale);
    });
    ctx.restore();
  }
  // Paints one outcome into a context already scaled by devicePixelRatio. Banner excluded.
  function paintScene(ctx, cssW, cssH, scene) {
    const hc = !!scene.highContrast,
      out = scene.outcome,
      tone = scene.tone || toneOf(out),
      tints = tintsFor(hc, tone),
      colors = hc ? LAYER_COLORS_HC : LAYER_COLORS,
      layers = scene.layers || SIM_LAYERS,
      bg = ordinal(out && out.background),
      list = shapeList(scene.specimen, scene.seed),
      t = viewTransform(cssW, cssH, scene.view);
    ctx.fillStyle = paperFor(bg, hc, tone);
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.save();
    ctx.translate(t.ox, t.oy);
    ctx.scale(t.scale, t.scale);
    // Field edge: the extent of the schematic section.
    ctx.strokeStyle = hc ? '#000000' : '#b9ab90';
    ctx.lineWidth = 2 / t.scale;
    ctx.strokeRect(0, 0, FIELD, FIELD);
    if (layers.background && bg > 0) {
      const tint = tints[bg];
      ctx.fillStyle = tint.color;
      ctx.globalAlpha = hc ? 0.75 : 0.55;
      for (const p of list.noise) {
        if (p.v >= BG_DENSITY[bg]) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (layers.lesions) for (const shape of list.shapes) paintOutline(ctx, shape, colors.lesions, t.scale);
    if (layers.ionic)
      for (const shape of list.shapes)
        paintIonic(ctx, shape, ordinal(stateOf(out, shape.site, 'ionicBound')), colors.ionic, hc);
    if (layers.nuclei)
      for (const shape of list.shapes)
        paintNuclei(ctx, shape, ordinal(stateOf(out, shape.site, 'nuclei')), colors.nuclei, hc);
    if (layers.deposit)
      for (const shape of list.shapes) paintDeposit(ctx, shape, tints[visibilityOf(out, shape.site)], hc);
    // MODE-micro: the drawn artifacts belong to the silver picture (the deposit layer), under
    // every picture-tool overlay.
    const artifacts = layers.deposit ? artifactsOf(out) : [];
    if (artifacts.length) {
      const art = artifactList(scene.artifactSeed);
      if (artifacts.includes('patchy')) paintPatches(ctx, art.patches, paperFor(bg, hc, tone), hc, t.scale);
      if (artifacts.includes('grains')) paintGrains(ctx, art.grains, hc);
    }
    const ov = scene.overlay;
    if (ov) {
      if (ov.grid) paintGrid(ctx, ov.grid, t.scale, !!ov.numbered, hc);
      if (ov.cells && ov.cells.size) paintCells(ctx, ov.cells, ov.cellGrid || CELL_GRID, hc);
      for (const poly of ov.outlines || []) paintPolygon(ctx, poly, true, t.scale, hc);
      if (ov.draft && ov.draft.length) paintPolygon(ctx, ov.draft, false, t.scale, hc);
      if (ov.marks && ov.marks.length) paintMarks(ctx, ov.marks, t.scale, hc);
    }
    ctx.restore();
    return t;
  }
  function wrapText(ctx, text, maxWidth) {
    const words = String(text).split(/\s+/),
      lines = [];
    let line = '';
    for (const word of words) {
      const probe = line ? `${line} ${word}` : word;
      if (ctx.measureText(probe).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = probe;
    }
    if (line) lines.push(line);
    return lines;
  }
  function paintHatched(ctx, cssW, cssH, card, hc) {
    ctx.fillStyle = hc ? '#ffffff' : '#eeeef1';
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.strokeStyle = hc ? '#000000' : '#b4b8c0';
    ctx.lineWidth = 1;
    for (let x = -cssH; x < cssW; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + cssH, cssH);
      ctx.stroke();
    }
    const pad = 12,
      boxW = Math.min(cssW - 2 * pad, 420);
    // The plate keeps its own label (a saved picture explains itself), the badge's words: "Not
    // modeled" for an uncertainty card, "Steps still to do" for a run still in progress (FIX2
    // desktop-9: an unfinished run is never headed Not modeled), never engine step ids.
    // TONING-verify-1: a run in progress whose card also names a setting gap (a skipped step, the
    // washes) never gets a picture, so the plate promises none.
    const inProgress = !!card && card.code === 'step-skipped',
      settingGap = inProgress && (card.outsideSupport || []).some(id => !(S() ? S().STEPS : []).includes(id)),
      title = shortLabel(card),
      body = settingGap
        ? `Finished, it still comes back ${W('notModeled')}: the model has no rule for its settings.`
        : inProgress
          ? 'The picture is drawn once every step is done.'
          : card && card.explanation
            ? plain(card.explanation)
            : 'No outcome to draw.',
      bodyLines = [];
    ctx.font = '13px system-ui, -apple-system, sans-serif';
    for (const line of wrapText(ctx, body, boxW - 2 * pad)) bodyLines.push(line);
    if (!inProgress || settingGap) bodyLines.push('(no stain is drawn without a model rule)');
    const lineH = 18,
      boxH = 20 + 22 + bodyLines.length * lineH + pad,
      bx = (cssW - boxW) / 2,
      by = Math.max(pad, (cssH - boxH) / 2);
    ctx.fillStyle = hc ? '#ffffff' : 'rgba(255,255,255,0.96)';
    ctx.strokeStyle = hc ? '#000000' : '#8a6100';
    ctx.lineWidth = hc ? 2 : 1.5;
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeRect(bx, by, boxW, boxH);
    ctx.fillStyle = hc ? '#000000' : '#0b0c0e';
    ctx.textBaseline = 'top';
    ctx.font = '600 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(title, bx + pad, by + pad);
    ctx.font = '13px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = hc ? '#000000' : '#41464d';
    bodyLines.forEach((line, i) => ctx.fillText(line, bx + pad, by + pad + 24 + i * lineH));
  }
  function paintBanner(ctx, cssW, cssH, text, hc) {
    const barH = 24;
    ctx.fillStyle = hc ? '#000000' : 'rgba(255,255,255,0.9)';
    ctx.fillRect(0, cssH - barH, cssW, barH);
    ctx.fillStyle = hc ? '#ffffff' : '#0b0c0e';
    ctx.font = '600 12px system-ui, -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    let label = String(text);
    while (label.length > 4 && ctx.measureText(label).width > cssW - 16) label = label.slice(0, -2).trimEnd() + '…';
    ctx.fillText(label, 8, cssH - barH / 2);
  }
  function paintTag(ctx, text, hc, maxWidth) {
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.textBaseline = 'top';
    // Shortened with an ellipsis on a narrow canvas (the full words are in the text alternative).
    while (maxWidth && text.length > 4 && ctx.measureText(text).width + 24 > maxWidth)
      text = text.slice(0, -2).trimEnd() + '…';
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = hc ? '#000000' : 'rgba(255,255,255,0.85)';
    ctx.fillRect(6, 6, w, 18);
    ctx.fillStyle = hc ? '#ffffff' : '#41464d';
    ctx.fillText(text, 12, 10);
  }
  function sizeCanvas(canvas, opts) {
    const dpr = clamp(root.devicePixelRatio || 1, 1, 3),
      cssW = Math.max(1, Math.round(opts.width || canvas.clientWidth || 320)),
      cssH = Math.max(1, Math.round(opts.height || canvas.clientHeight || Math.round(cssW * 0.75))),
      pw = Math.round(cssW * dpr),
      ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    return { dpr, cssW, cssH };
  }
  // Public renderer: one outcome (or an uncertainty card) into one canvas.
  function renderSynthetic(canvas, opts = {}) {
    const ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    if (!ctx) return null;
    const { dpr, cssW, cssH } = sizeCanvas(canvas, opts),
      hc = !!opts.highContrast,
      out = opts.outcome,
      view = { zoom: opts.zoom, objective: opts.objective, cx: opts.pan && opts.pan.x, cy: opts.pan && opts.pan.y };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    let t = viewTransform(cssW, cssH, view);
    if (!out || isCard(out)) paintHatched(ctx, cssW, cssH, out, hc);
    else
      t = paintScene(ctx, cssW, cssH, {
        specimen: opts.specimen,
        outcome: out,
        view,
        layers: opts.layers || SIM_LAYERS,
        highContrast: hc,
        seed: opts.seed,
        overlay: opts.overlay,
        artifactSeed: hashSeed(opts.runId),
      });
    if (opts.tag !== false) paintTag(ctx, `${t.objective}x · ${OBJECTIVE_NOTE}`, hc, cssW);
    if (opts.banner !== false) paintBanner(ctx, cssW, cssH, shortLabel(out), hc);
    return { width: cssW, height: cssH, transform: t };
  }

  // Image-derived contrast: samples the rendered simulation (never the model directly) and reads
  // each sample back as the nearest of the five fixed tints. Illustrative; null without a canvas.
  function sampleContrast(specimen, outcome) {
    if (!root.document || !isSynthetic(outcome)) return null;
    const canvas = root.document.createElement('canvas');
    canvas.width = canvas.height = CONTRAST_SAMPLE_PX;
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx || typeof ctx.getImageData !== 'function') return null;
    const px = CONTRAST_SAMPLE_PX,
      view = { zoom: 1, objective: 4, cx: FIELD / 2, cy: FIELD / 2 };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const t = paintScene(ctx, px, px, { specimen, outcome, view, layers: SIM_LAYERS, highContrast: false });
    let data;
    try {
      data = ctx.getImageData(0, 0, px, px).data;
    } catch {
      return null;
    }
    const lumAt = (fx, fy) => {
      const x = clamp(Math.round(t.ox + fx * t.scale), 0, px - 1),
        y = clamp(Math.round(t.oy + fy * t.scale), 0, px - 1),
        i = (y * px + x) * 4;
      return luminance([data[i], data[i + 1], data[i + 2]]);
    };
    const mean = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const bgSamples = [];
    for (let r = 0; r < 12; r++)
      for (let c = 0; c < 12; c++) bgSamples.push(lumAt((FIELD / 12) * (c + 0.5), (FIELD / 12) * (r + 0.5)));
    bgSamples.sort((a, b) => b - a);
    const bgLum = mean(bgSamples.slice(0, Math.ceil(bgSamples.length * 0.6)));
    const nearest = (lum, candidates) =>
      candidates.reduce((best, cand, i) => (Math.abs(cand - lum) < Math.abs(candidates[best] - lum) ? i : best), 0);
    const tone = toneOf(outcome),
      bgLevel = nearest(
        bgLum,
        [0, 1, 2, 3, 4].map(k => luminance(hexRgb(paperFor(k, false, tone))))
      );
    const list = shapeList(specimen),
      order = ['plaque-core', 'tangle', 'plaque-neurite', 'axon', 'neuropil-thread'],
      present = order.filter(site => list.counts[site] > 0),
      darkest = present.reduce(
        (best, site) => (best === null || visibilityOf(outcome, site) > visibilityOf(outcome, best) ? site : best),
        null
      );
    let targetLevel = 0;
    if (darkest) {
      const samples = list.shapes
        .filter(s => s.site === darkest)
        .map(s => {
          const a = anchorOf(s);
          return lumAt(a.x, a.y);
        })
        .sort((a, b) => a - b);
      const targetLum = mean(samples.slice(0, Math.max(1, Math.ceil(samples.length / 2)))),
        paper = paperFor(bgLevel, false, tone);
      targetLevel = nearest(
        targetLum,
        tintsFor(false, tone).map(tint => compositeLuminance(tint, paper))
      );
    }
    return {
      target: targetLevel,
      background: bgLevel,
      contrast: clamp(targetLevel - bgLevel, 0, 4),
      modelContrast: ordinal(outcome.contrast),
      // TONING-verify-1: words only, so the report's measurement line carries no digit (ENGINE-14).
      note: 'image-derived from the rendered simulation at the lowest objective (whole field); illustrative',
    };
  }

  // ---- text alternative, difference table, measurement payload ------------------------------
  // Plain words for an outcome: CortexLab.summarize when lab.js is loaded, else a short private
  // list of the same model-scale words.
  function plainSummary(out, specimen) {
    const fn = shell() && shell().summarize;
    if (typeof fn === 'function') {
      try {
        const text = fn(out, specimen);
        if (typeof text === 'string' && text) return text;
      } catch {
        /* the private list below */
      }
    }
    const list = Object.keys(SITE_PLURAL)
      .filter(site => out.perSite && out.perSite[site])
      .map(site => `${SITE_PLURAL[site]} ${level(visibilityOf(out, site))}`)
      .join(', ');
    const text = `${list}; background ${level(out.background)}; contrast ${level(out.contrast)} (${W('modelScale')}).`;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  // MODE-FIX-micro-1: the engine's caveats in plain words. The shell's CortexLab.plainCaveat (lab.js
  // LAB_CAVEAT_WORDS) first when it is loaded, then this private copy of the pairs an outcome's
  // caveats need, so no "schematic" / "ordinal" / "SOP" / "sop-default" / "registry" reaches the
  // text alternative in any host. The engine text itself stays under the Sources disclosures.
  const CAVEAT_WORDS = Object.freeze([
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
    [/The cap on binding under wax is a schematic device/g, 'The cap on binding under wax is a device of the model'],
    [
      /Compare-only method; not runnable on the bench; schematic from the published description\./g,
      'Compare only: no bench steps; the picture is drawn from the published description.',
    ],
    [/\bthe schematic shows\b/g, 'the drawing shows'],
    [
      /Axon 0 and plaque core 1 \(trace\) are schematic readings of the CPS-II description/g,
      'Axons at none and plaque cores at trace are the drawing’s reading of the CPS-II description',
    ],
    [/\bin the registry\b/g, 'in this lab'],
  ]);
  function plainCaveat(text) {
    let out = String(text || '');
    const fn = shell() && shell().plainCaveat;
    if (typeof fn === 'function') {
      try {
        const mapped = fn(out);
        if (typeof mapped === 'string') out = mapped;
      } catch {
        /* the private copy below */
      }
    }
    return CAVEAT_WORDS.reduce((acc, [from, to]) => acc.replace(from, to), out);
  }
  // The text alternative of a drawn outcome in the words the captions use (contract §11.8: no
  // engine vocabulary outside the Why / sources disclosures): the label, the plain summary, the
  // unstained / gold-toned notes, the drawn artifacts, the by-eye look, the hypothesis an outcome
  // is conditional on (only when it is), and the caveats in plain words. The engine's own
  // describeOutcome text stays under the Sources disclosures and in the export.
  function plainDescription(out, specimen) {
    const parts = [`${labelText(out.label)}.`],
      summary = plainSummary(out, specimen);
    if (summary) parts.push(summary);
    if (hasUnknownDips(out)) parts.push(UNKNOWN_DIP_NOTE);
    if (isUnstained(out)) parts.push(UNSTAINED_NOTE);
    if (toneOf(out) === 'gold') parts.push(TONE_NOTE);
    const arts = artifactsOf(out);
    if (arts.length) parts.push(`Drawn on the section: ${arts.map(a => ARTIFACT_TEXT[a]).join(', ')}.`);
    const look = lookOf(out);
    if (look) parts.push(`By eye: ${look.text}`);
    if (out.conditionalOn) {
      const names = S() && S().HYPOTHESIS_TEXT;
      parts.push(`Conditional on one explanation: ${(names && names[out.conditionalOn]) || out.conditionalOn}.`);
    }
    const caveats = Array.isArray(out.caveats) ? out.caveats.map(plainCaveat).filter(Boolean) : [];
    if (caveats.length) parts.push(`Keep in mind: ${caveats.join(' ')}`);
    return parts.map(p => (/[.!?]$/.test(p) ? p : `${p}.`)).join(' ');
  }
  function describe(outcome, specimen, lab, view = {}) {
    const base = isSynthetic(outcome)
      ? plainDescription(outcome, specimen)
      : lab && typeof lab.describeOutcome === 'function'
        ? plain(lab.describeOutcome(outcome, specimen))
        : '';
    const objective = OBJECTIVES.includes(view.objective) ? view.objective : 10,
      tab = TABS.find(t => t.id === view.tab) || TABS[1],
      parts = [`Objective: ${objective}x (approximate).`];
    const zoom = Number(view.zoom);
    if (zoom && Math.abs(zoom - 1) > 0.01)
      parts.push(`Zoom: ${zoom.toFixed(2).replace(/\.?0+$/, '')}x within that field.`);
    let viewText = `View: ${tab.text.toLowerCase()}`;
    if (view.compare) viewText += `, compare ${view.compareMode === 'swipe' ? 'swipe' : 'side by side'}`;
    if (view.side) viewText += ` (${view.side})`;
    parts.push(`${viewText}.`);
    // Layers tab: say which schematic overlays are drawn (the image differs with every toggle).
    if (tab.id === 'layers' && view.layers && typeof view.layers === 'object') {
      const shown = LAYER_KEYS.filter(k => view.layers[k]);
      parts.push(`Layers shown: ${shown.length ? shown.join(', ') : 'none'}.`);
    }
    const sep = base && !/[.!?]$/.test(base) ? '.' : '';
    return `${base}${sep} ${parts.join(' ')}`.trim();
  }
  function differenceRows(comparison) {
    if (!comparison || !comparison.perSite) return [];
    return sites()
      .filter(site => comparison.perSite[site])
      .map(site => {
        const row = comparison.perSite[site],
          delta = Number(row.delta) || 0;
        return {
          site,
          siteText: siteText(site),
          baseline: ordinal(row.baseline),
          baselineText: ordWord(row.baseline),
          experimental: ordinal(row.experimental),
          experimentalText: ordWord(row.experimental),
          delta,
          deltaText: delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : '0',
          changed: delta !== 0,
        };
      });
  }
  function measurementPayload({ rule, run, outcome, value, note }) {
    return {
      measurementId: rule.id,
      runId: run ? run.id : undefined,
      label: outcome ? outcome.label : undefined,
      value,
      unit: rule.unit,
      manual: !!rule.manual,
      note: String(note || ''),
    };
  }
  function polygonArea(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i],
        q = pts[(i + 1) % pts.length];
      a += p.x * q.y - q.x * p.y;
    }
    return Math.abs(a) / 2;
  }
  function referenceAsset(lab, specimen) {
    const list =
      lab && lab.content && lab.content.assets && Array.isArray(lab.content.assets.items)
        ? lab.content.assets.items
        : [];
    return (
      list.find(
        a =>
          a &&
          specimen &&
          a.specimenId === specimen.id &&
          (a.label === LABEL_OBSERVED || a.kind === 'reference-image') &&
          a.rights &&
          a.rights.status &&
          a.rights.status !== 'unknown' &&
          a.src
      ) || null
    );
  }

  // ---- REF-micro (contract §12.2): which real photos match a run -----------------------------
  // The photos whose role fits the specimen's role (positive / experimental → positive + other;
  // negative comparison → negative) and whose looks list the run's by-eye look. An uncertainty
  // card, a compare-only run (no look), a look no photo stands for (unstained, faint-yellow,
  // tan-brown, dark-brown, patchy …), a grains artifact, a specimen with no role set or (§13.5) a
  // free run with any currently unknown dip or field return [].
  // Order: positive cortex, then hippocampus, then other regions, then the 'other' role; the
  // library's own order inside each group.
  const regionRank = region => (/cortex|gyrus/i.test(region || '') ? 0 : /hippocamp/i.test(region || '') ? 1 : 2);
  function referenceSlides(lab, outcome, specimen) {
    const items =
        lab && lab.content && lab.content.assets && Array.isArray(lab.content.assets.items)
          ? lab.content.assets.items
          : [],
      roles = specimen && PHOTO_ROLE_SETS[specimen.role];
    if (!roles || !isSynthetic(outcome) || hasUnknownDips(outcome) || hasUnknownFields(outcome)) return [];
    const look = outcome.look && typeof outcome.look.key === 'string' ? outcome.look.key : '';
    if (!look || artifactsOf(outcome).includes('grains')) return [];
    return items
      .map((a, i) => ({ a, i }))
      .filter(
        ({ a }) =>
          a &&
          a.kind === 'reference-image' &&
          a.label === LABEL_OBSERVED &&
          typeof a.src === 'string' &&
          a.src &&
          a.rights &&
          a.rights.status &&
          a.rights.status !== 'unknown' &&
          roles.includes(a.role) &&
          Array.isArray(a.looks) &&
          a.looks.includes(look)
      )
      .sort(
        (p, q) =>
          Number(p.a.role === 'other') - Number(q.a.role === 'other') ||
          regionRank(p.a.region) - regionRank(q.a.region) ||
          p.i - q.i
      )
      .map(({ a }) => a);
  }
  // "Ikonomovic MD, Buckley CJ, … Post-mortem analyses … Acta Neuropathol. 2020;140:649-661. …"
  // → { author: 'Ikonomovic', journal: 'Acta Neuropathol', year: '2020' } ('' where not found).
  function parseCitation(citation) {
    const text = String(citation || ''),
      author = (text.match(/^([^,.]+?)\s+[A-Z][A-Za-z]{0,3}[,.]/) || [])[1] || text.split(/[,.]/)[0] || '',
      jy = text.match(/\.\s+([A-Z][^.;:]*?)\.\s+(\d{4})\b/);
    return { author: author.trim(), journal: jy ? jy[1].trim() : '', year: jy ? jy[2] : '' };
  }
  // rights.status → the license name: cc-by-4.0 → "CC BY 4.0", cc-by → "CC BY"; else as stated.
  function licenseName(status) {
    const m = /^cc-by(?:-([\d.]+))?$/i.exec(String(status || '').trim());
    return m ? `CC BY${m[1] ? ` ${m[1]}` : ''}` : String(status || '');
  }
  // The credit under a real photo (contract §12.3): "<first author> et al., <journal> <year>,
  // <figure> (cropped) · <license>", with the article url and the license url for the two links.
  function creditFor(lab, asset) {
    const source = (lab && typeof lab.getSource === 'function' && asset && lab.getSource(asset.sourceId)) || null,
      parsed = parseCitation(source && source.citation),
      rights = (asset && asset.rights) || {},
      who = parsed.author ? `${parsed.author} et al.` : (source && source.id) || (asset && asset.sourceId) || '',
      where = [parsed.journal, parsed.year].filter(Boolean).join(' '),
      figure = `${(asset && asset.figure) || ''}${/crop/i.test(rights.changes || '') ? ' (cropped)' : ''}`.trim(),
      license = licenseName(rights.status),
      head = [who, where].filter(Boolean).join(', ');
    return {
      source,
      head,
      figure,
      license,
      articleUrl: (source && source.url) || '',
      licenseUrl: rights.licenseUrl || '',
      text: [[head, figure].filter(Boolean).join(', '), license].filter(Boolean).join(' · '),
    };
  }
  const creditText = (lab, asset) => creditFor(lab, asset).text;
  // The remembered Picture view (contract §12.3): CortexLab.getSetting / setSetting('microscopeView')
  // when the shell has them; a module variable otherwise (one page session). Default: the real slide.
  let labmViewPref = 'real';
  function readViewPref() {
    const fn = shell() && shell().getSetting;
    if (typeof fn === 'function') {
      try {
        const v = fn('microscopeView');
        if (v === 'real' || v === 'drawing') return v;
      } catch {
        /* the module's own memory below */
      }
    }
    return labmViewPref;
  }
  function writeViewPref(v) {
    labmViewPref = v;
    const fn = shell() && shell().setSetting;
    if (typeof fn === 'function') {
      try {
        fn('microscopeView', v);
      } catch {
        /* remembered for this page only */
      }
    }
  }

  // ---- mount -------------------------------------------------------------------------------
  // A selector that finds "the same control" again after a rebuild (first data-labm-* attribute).
  function focusSelector(node) {
    if (!node || !node.attributes) return null;
    for (const attr of node.attributes)
      if (attr.name.indexOf('data-labm-') === 0)
        return attr.value ? `[${attr.name}="${String(attr.value).replace(/["\\]/g, '')}"]` : `[${attr.name}]`;
    return null;
  }
  const firstSentence = text => {
    const m = String(text || '').match(/^[^.!?]*[.!?]/);
    return m ? m[0] : String(text || '');
  };
  let instanceSeq = 0;
  function mount(container, opts = {}) {
    if (!container || !root.document) throw new Error('CortexLabMicroscope.mount: a container element is required');
    const doc = root.document,
      id = `labm-${++instanceSeq}`,
      st = {
        lab: opts.lab,
        specimen: opts.specimen,
        runs: Array.isArray(opts.runs) ? opts.runs.filter(Boolean) : [],
        outcomes: Array.isArray(opts.outcomes) ? opts.outcomes.filter(Boolean) : [],
        settings: Object.assign({ reducedMotion: 'auto', highContrast: false, objective: 10 }, opts.settings || {}),
        onSettings: typeof opts.onSettings === 'function' ? opts.onSettings : () => {},
        onMeasurement: typeof opts.onMeasurement === 'function' ? opts.onMeasurement : () => {},
        onClose: typeof opts.onClose === 'function' ? opts.onClose : null,
        // Section headings render at this level (2 or 3) and sub-headings one lower, so the full
        // ?view=microscope page (h1) does not jump to h3.
        headingLevel: Number(opts.headingLevel) === 2 ? 2 : 3,
        layersOn: opts.tab === 'layers', // the Layers toggle (was the "Schematic layers" tab)
        sheetOpen: false, // the Measure sheet
        menuOpen: false, // the Compare menu (two runs only)
        active: 0,
        compare: false,
        compareMode: 'side',
        split: 50,
        view: { zoom: 1, cx: FIELD / 2, cy: FIELD / 2 },
        layers: { ...ALL_LAYERS },
        touchPan: false, // "Drag to pan" toggle: off = one finger scrolls the page (touch-action: pan-y pinch-zoom)
        readRules: new Set(),
        tool: null,
        toolState: {},
        status: '',
        comparison: null,
        canvases: [],
        rafId: 0,
        liveTimer: 0,
        deltaTimer: 0,
        destroyed: false,
        pointers: new Map(),
        drag: null,
        pinch: null,
        // REF-micro (contract §12): the Picture view, the matching photos, the chosen one and its pan / zoom
        picView: readViewPref(),
        slides: [],
        slideKey: '',
        slideIndex: 0,
        photo: { zoom: 1, ox: 0, oy: 0 }, // ox / oy: the photo fraction at the box's top left
      };
    st.compare = st.outcomes.length >= 2;
    st.objective = OBJECTIVES.includes(Number(st.settings.objective)) ? Number(st.settings.objective) : 10;
    st.highContrast = !!st.settings.highContrast;

    const outcomeAt = i => st.outcomes[i] || null,
      runAt = i => st.runs[i] || null,
      activeOutcome = () => outcomeAt(st.active),
      activeRun = () => runAt(st.active),
      viewId = () => (st.layersOn ? 'layers' : 'simulation'),
      runName = i => {
        const run = runAt(i),
          title = window.CortexLab && window.CortexLab.runTitle;
        if (run && typeof title === 'function') return title(run); // the shell's plain run name
        return run ? run.label || run.id : `run ${i + 1}`;
      },
      sideName = i => (st.outcomes.length >= 2 ? (i === 0 ? 'Baseline' : 'Experimental') : 'Run'),
      // "Baseline: run-1", or just "Baseline" when the run is already called that.
      sideRun = i => (runName(i) === sideName(i) ? sideName(i) : `${sideName(i)}: ${runName(i)}`),
      // Units in plain words ('ordinal' is engine vocabulary; the payload keeps rule.unit).
      unitText = unit => (unit === 'ordinal' ? 'steps on the model scale' : unit),
      // Landmark and group names carry the run name(s) so two mounted viewers never share a name.
      runNames = () =>
        Array.from({ length: Math.min(2, Math.max(1, st.outcomes.length, st.runs.length)) }, (_, i) => runName(i)).join(
          ' and '
        ),
      H = () => `h${st.headingLevel}`,
      HS = () => `h${st.headingLevel + 1}`,
      pct = v => Math.round((clamp(Number(v) || 0, 0, FIELD) / FIELD) * 100),
      zoomText = z =>
        `${Number(z)
          .toFixed(2)
          .replace(/\.?0+$/, '')}x`,
      measurementRules = () =>
        st.lab && typeof st.lab.measurementRules === 'function' ? st.lab.measurementRules() : [],
      ruleTitle = rid =>
        st.lab && typeof st.lab.getRule === 'function' && st.lab.getRule(rid) ? st.lab.getRule(rid).title : '',
      toolPlain = rule => TOOL_PLAIN[rule.id] || { name: rule.title, line: firstSentence(rule.rule) },
      // REF-micro: the real slide shows on a single run only, when offered and chosen.
      realOn = () => st.picView === 'real' && !st.compare && st.slides.length > 0,
      slide = () => st.slides[Math.min(st.slideIndex, st.slides.length - 1)] || null;
    // The matching photos for the run shown; a new set starts at the first photo, whole.
    function syncSlides() {
      st.slides = referenceSlides(st.lab, activeOutcome(), st.specimen);
      const key = st.slides.map(a => a.id).join('|');
      if (key === st.slideKey) return;
      st.slideKey = key;
      st.slideIndex = 0;
      st.photo = { zoom: 1, ox: 0, oy: 0 };
    }

    function computeComparison() {
      st.comparison = null;
      if (st.runs.length >= 2 && st.lab && typeof st.lab.compare === 'function') {
        try {
          st.comparison = st.lab.compare(st.runs[0], st.runs[1]);
        } catch {
          st.comparison = null;
        }
      }
    }
    computeComparison();

    // ---- skeleton: badge, top bar, picture, Measure, sheet, two disclosures ----
    const rootEl = h(`<div class="labm" data-labm="${id}" data-labm-tab="simulation"><div class="labm-grid">
      <p class="labm-badges" data-labm-banner></p>
      <div class="labm-toolbar" role="group" aria-label="Viewer controls">
        <div class="labm-group labm-view" role="group" aria-label="Picture" data-labm-view-group hidden>
          <span class="labm-group-label">Picture</span>
          <span class="labm-seg"><button type="button" data-labm-view="real" aria-pressed="false">${esc(VIEW_TEXT.real)}</button><button type="button" data-labm-view="drawing" aria-pressed="false">${esc(VIEW_TEXT.drawing)}</button></span>
        </div>
        <div class="labm-group" role="group" aria-label="Objective (${esc(OBJECTIVE_NOTE)})" data-labm-objective-group>
          <span class="labm-group-label">Objective <small>approximate</small></span>
          <span class="labm-seg">${OBJECTIVES.map(o => `<button type="button" data-labm-objective="${o}" aria-pressed="false">${o}x</button>`).join('')}</span>
        </div>
        <div class="labm-group labm-compare-wrap" role="group" aria-label="Compare two runs" data-labm-compare-group>
          <button type="button" class="labm-menu-btn" data-labm-compare-toggle aria-expanded="false" aria-controls="${id}-compare-menu"><span>Compare: <span data-labm-compare-current>side by side</span></span></button>
          <div class="labm-menu" id="${id}-compare-menu" data-labm-compare-menu hidden>
            <p class="labm-menu-label" id="${id}-cm-both">Both runs</p>
            <div class="labm-menu-list" role="group" aria-labelledby="${id}-cm-both" data-labm-compare-modes><button type="button" data-labm-compare-mode="side" aria-pressed="false">Side by side</button><button type="button" data-labm-compare-mode="swipe" aria-pressed="false">Swipe</button></div>
            <p class="labm-menu-label" id="${id}-cm-one">One run</p>
            <div class="labm-menu-list" role="group" aria-labelledby="${id}-cm-one" data-labm-side-group><button type="button" data-labm-side="0" aria-pressed="false"></button><button type="button" data-labm-side="1" aria-pressed="false"></button></div>
          </div>
          <label class="labm-split" data-labm-split-wrap><span>Split position</span><input type="range" min="0" max="100" step="1" value="50" data-labm-split></label>
        </div>
        <button type="button" class="labm-toggle" data-labm-layers-toggle aria-pressed="false">Layers</button>
      </div>
      <div class="labm-sr-only" aria-live="polite" aria-atomic="true" data-labm-live></div>
      <div class="labm-sr-only" aria-live="polite" aria-atomic="false" data-labm-live-delta></div>
      <div class="labm-main">
      <div class="labm-panel" tabindex="-1"></div>
      <div class="labm-aside">
      <div class="labm-actions">
        <button type="button" class="btn btn-solid labm-measure" data-labm-measure-open aria-expanded="false" aria-controls="${id}-tools" aria-describedby="${id}-measure-hint">Measure</button>
        <p class="labm-caption labm-measure-hint" id="${id}-measure-hint">Five tools, each with a short rule you read first.</p>
        <p class="labm-status" role="status" tabindex="-1" data-labm-status></p>
      </div>
      <section class="labm-tools" id="${id}-tools" data-labm-tools hidden></section>
      <details class="labm-more" data-labm-view-controls>
        <summary>View controls</summary>
        <div class="labm-more-body">
          <div class="labm-group" role="group" aria-label="Zoom">
            <span class="labm-group-label">Zoom</span>
            <button type="button" data-labm-zoom="in">Zoom in</button>
            <button type="button" data-labm-zoom="out">Zoom out</button>
            <button type="button" data-labm-zoom="reset">Reset view</button>
          </div>
          <div class="labm-group" role="group" aria-label="Pan">
            <span class="labm-group-label">Pan</span>
            <button type="button" data-labm-pan="left" aria-label="Pan left"><span aria-hidden="true">&larr;</span> Left</button>
            <button type="button" data-labm-pan="up" aria-label="Pan up"><span aria-hidden="true">&uarr;</span> Up</button>
            <button type="button" data-labm-pan="down" aria-label="Pan down"><span aria-hidden="true">&darr;</span> Down</button>
            <button type="button" data-labm-pan="right" aria-label="Pan right"><span aria-hidden="true">&rarr;</span> Right</button>
          </div>
          <div class="labm-group" role="group" aria-label="Display">
            <span class="labm-group-label">Display</span>
            <button type="button" class="labm-toggle" data-labm-contrast aria-pressed="false">High contrast</button>
            <button type="button" class="labm-toggle" data-labm-touch-pan aria-pressed="false">Drag to pan <small>(touch)</small></button>
          </div>
          <div class="labm-keys"><p class="labm-sub">Keyboard and touch</p><ul data-labm-keys-list></ul></div>
        </div>
      </details>
      </div>
      </div>
      <details class="labm-more" data-labm-numbers>
        <summary>Numbers behind this image</summary>
        <div class="labm-more-body">
          <p class="labm-sub">Text description</p>
          <p class="labm-textalt" data-labm-text-alt></p>
          <p class="labm-caption" data-labm-scale></p>
          <fieldset class="labm-layers"><legend data-labm-layers-legend>Layers to draw</legend></fieldset>
          <div data-labm-tables></div>
          <section class="labm-compare" data-labm-compare hidden></section>
          <p class="labm-caption" data-labm-notes></p>
        </div>
      </details>
    </div></div>`);
    const q = sel => rootEl.querySelector(sel),
      bannerEl = q('[data-labm-banner]'),
      toolbarEl = q('.labm-toolbar'),
      panelEl = q('.labm-panel'),
      asideEl = q('.labm-aside'),
      liveEl = q('[data-labm-live]'),
      deltaEl = q('[data-labm-live-delta]'),
      statusEl = q('[data-labm-status]'),
      measureBtn = q('[data-labm-measure-open]'),
      keysEl = q('[data-labm-keys-list]'),
      textAltEl = q('[data-labm-text-alt]'),
      layersEl = q('.labm-layers'),
      tablesEl = q('[data-labm-tables]'),
      compareEl = q('[data-labm-compare]'),
      toolsEl = q('[data-labm-tools]'),
      splitInput = q('[data-labm-split]'),
      compareGroup = q('[data-labm-compare-group]'),
      compareBtn = q('[data-labm-compare-toggle]'),
      compareMenu = q('[data-labm-compare-menu]');
    container.replaceChildren(rootEl);
    q('[data-labm-scale]').textContent = W('scaleLegend');
    // F2 / MODE-FIX-micro-2: the field takes the background's shade on the same scale, so the
    // picture's contrast is the model's words drawn out; the note still says to judge by the words.
    q('[data-labm-notes]').textContent =
      `Each site is drawn in one of five fixed shades, one per model-scale step, and the field is painted in the background's shade: an illustrative device, not intensity data. The picture's contrast is the model's words drawn out (a structure one step above the background stands out by one shade), never a measurement, so judge contrast by the words. The objective presets are an ${OBJECTIVE_NOTE}. ${SECTION_NOTE}`;
    // Help text: the Esc line appears only when a host gave onClose (otherwise Esc does nothing). The
    // host decides where closing leads (the bench, an activity, or the designer that opened it).
    function escHelp(kbd) {
      return st.onClose ? `, ${kbd} closes the microscope` : '';
    }
    function renderKeysHelp() {
      keysEl.innerHTML = `<li>With the picture focused (click it or Tab to it): arrow keys pan, <kbd>+</kbd> / <kbd>-</kbd> zoom, <kbd>0</kbd> resets the view, <kbd>1</kbd> to <kbd>4</kbd> pick the 4x / 10x / 20x / 40x objective (${esc(OBJECTIVE_NOTE)}), <kbd>C</kbd> toggles compare, <kbd>L</kbd> toggles layers${escHelp('<kbd>Esc</kbd>')}.</li>
        <li>Mouse: drag to pan; hold Ctrl or Cmd and scroll to zoom. Touch: with <strong>Drag to pan</strong> off, one finger scrolls the page; with it on, one finger pans the picture and two fingers pinch to zoom.</li>
        <li>Screen readers hear a one-line summary when you change layers, compare or the run shown, and a short position update after each pan or zoom. The full description is under &ldquo;Numbers behind this image&rdquo;.</li>`;
    }

    // ---- layer choices (built once; they live in the Numbers expander) ----
    for (const key of LAYER_KEYS) {
      const label = h(`<label><input type="checkbox" data-labm-layer="${key}"> ${esc(LAYER_TEXT[key])}</label>`);
      label.querySelector('input').addEventListener('change', e => {
        st.layers[key] = !!e.target.checked;
        if (!st.layersOn) {
          setLayers(true);
          return;
        }
        paint();
        renderBelow();
        // One layer more or less: a short update, not the whole summary again.
        announceDelta(`${LAYER_SPOKEN[key]} layer ${st.layers[key] ? 'shown' : 'hidden'}`);
      });
      layersEl.appendChild(label);
    }

    // ---- clicks on the top bar, the View controls and the Measure button ----
    rootEl.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn || !rootEl.contains(btn) || toolsEl.contains(btn)) return;
      if (btn.hasAttribute('data-labm-objective')) setObjective(Number(btn.getAttribute('data-labm-objective')));
      else if (btn.hasAttribute('data-labm-view')) setPicView(btn.getAttribute('data-labm-view'));
      else if (btn.hasAttribute('data-labm-slide')) setSlide(Number(btn.getAttribute('data-labm-slide')));
      else if (btn.hasAttribute('data-labm-photo-reset')) resetView();
      else if (btn.hasAttribute('data-labm-zoom')) {
        const kind = btn.getAttribute('data-labm-zoom');
        if (kind === 'in') zoomBy(ZOOM_STEP);
        else if (kind === 'out') zoomBy(1 / ZOOM_STEP);
        else resetView();
      } else if (btn.hasAttribute('data-labm-pan')) panByPixels(btn.getAttribute('data-labm-pan'));
      else if (btn.hasAttribute('data-labm-touch-pan')) setTouchPan(!st.touchPan);
      else if (btn.hasAttribute('data-labm-contrast')) setHighContrast(!st.highContrast);
      else if (btn.hasAttribute('data-labm-compare-toggle')) setMenu(!st.menuOpen);
      else if (btn.hasAttribute('data-labm-compare-mode')) {
        // A choice in the Compare menu applies, closes the menu and returns focus to its button.
        chooseView(() => {
          st.compare = st.outcomes.length >= 2;
          st.compareMode = btn.getAttribute('data-labm-compare-mode') === 'swipe' ? 'swipe' : 'side';
        });
      } else if (btn.hasAttribute('data-labm-side')) {
        const i = Number(btn.getAttribute('data-labm-side'));
        if (outcomeAt(i))
          chooseView(() => {
            if (i !== st.active) st.tool = null;
            st.compare = false;
            st.active = i;
          });
      } else if (btn.hasAttribute('data-labm-layers-toggle')) setLayers(!st.layersOn);
      else if (btn.hasAttribute('data-labm-measure-open')) setSheet(!st.sheetOpen);
    });
    splitInput.addEventListener('input', () => {
      st.split = clamp(Number(splitInput.value) || 0, 0, 100);
      paint();
    });
    // The Compare menu (a disclosure, not an ARIA menu): Esc closes it and returns to its button; a
    // pointer press outside it closes it too.
    compareMenu.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setMenu(false);
      compareBtn.focus();
    });
    // Any press also drops the identify tag (a tap's tag stays until the next press anywhere).
    const onDocPointer = e => {
      if (st.menuOpen && !compareGroup.contains(e.target)) setMenu(false);
      if (!tagEl.hidden) hideTag();
    };
    doc.addEventListener('pointerdown', onDocPointer);
    // Esc drops a visible tag and does nothing else (WCAG 1.4.13); on the picture itself onStageKey
    // does it, so its Esc never also closes the viewer. Capture: runs before a handler that stops it.
    const onDocKey = e => {
      if (e.key === 'Escape' && !tagEl.hidden && !(stageEl && stageEl.contains(e.target))) dismissTag();
    };
    doc.addEventListener('keydown', onDocKey, true);
    function setMenu(open) {
      st.menuOpen = !!open && st.outcomes.length >= 2;
      syncToolbar();
    }
    function chooseView(apply) {
      const before = `${st.compare}|${st.compareMode}|${st.active}`;
      apply();
      st.menuOpen = false;
      if (before === `${st.compare}|${st.compareMode}|${st.active}`) syncToolbar();
      else {
        sync();
        announce();
      }
      compareBtn.focus();
    }
    // Esc inside the sheet closes the sheet (not the microscope) and returns to the Measure button.
    toolsEl.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setSheet(false);
      measureBtn.focus();
    });

    // ---- view state changes ----
    // REF-micro: Real slide / Drawing (simulation); remembered through the shell when it can.
    function setPicView(v) {
      const next = v === 'drawing' ? 'drawing' : 'real';
      if (next === st.picView) return;
      st.picView = next;
      writeViewPref(next);
      sync();
      announce();
    }
    function setSlide(i) {
      if (!st.slides[i] || i === st.slideIndex) return;
      st.slideIndex = i;
      st.photo = { zoom: 1, ox: 0, oy: 0 };
      sync();
      const b = stageEl && stageEl.querySelector(`[data-labm-slide="${i}"]`);
      if (b) b.focus();
      announce();
    }
    function setLayers(on) {
      if (realOn()) return; // the layers belong to the drawing
      if (!!on === st.layersOn) return;
      st.layersOn = !!on;
      sync();
      announce();
    }
    function setObjective(objective) {
      if (!OBJECTIVES.includes(objective) || objective === st.objective) return;
      st.objective = objective;
      st.onSettings({ objective });
      syncToolbar();
      toolsEl
        .querySelectorAll('[data-labm-objective-note]')
        .forEach(n => (n.textContent = `Counts per region at ${objective}x (approximate)`));
      paint();
      announceDelta(`Objective ${objective}x (approximate)`);
    }
    function setHighContrast(on) {
      st.highContrast = !!on;
      rootEl.classList.toggle('labm-hc', st.highContrast);
      st.onSettings({ highContrast: st.highContrast });
      syncToolbar();
      paint();
    }
    function setTouchPan(on) {
      st.touchPan = !!on;
      rootEl.classList.toggle('labm-touch-pan', st.touchPan);
      syncToolbar();
      syncHud();
    }
    function setCompare(on) {
      const next = !!on && st.outcomes.length >= 2;
      if (next === st.compare) return;
      st.compare = next;
      sync();
      announce();
    }
    function setActive(i) {
      if (!outcomeAt(i) || i === st.active) return;
      st.active = i;
      st.tool = null;
      sync();
      announce();
    }
    function setSheet(open) {
      st.sheetOpen = !!open;
      if (!st.sheetOpen) st.tool = null;
      measureBtn.setAttribute('aria-expanded', String(st.sheetOpen));
      renderTools();
      paint();
    }
    function zoomBy(factor) {
      if (stageMode === 'real') {
        photoZoomAt(st.photo.zoom * factor);
        return;
      }
      const target = clamp(st.view.zoom * factor, ZOOM_MIN, ZOOM_MAX);
      animateZoom(target);
    }
    function animateZoom(target) {
      cancelRaf();
      if (prefersReducedMotion(st.settings) || !root.requestAnimationFrame || Math.abs(target - st.view.zoom) < 1e-6) {
        st.view.zoom = target;
        paint();
        announceDelta(`Zoom ${zoomText(st.view.zoom)}`);
        return;
      }
      const from = st.view.zoom,
        start = (root.performance && root.performance.now && root.performance.now()) || 0,
        tick = now => {
          const t = clamp((now - start) / 140, 0, 1),
            eased = 1 - Math.pow(1 - t, 3);
          st.view.zoom = from + (target - from) * eased;
          paint();
          if (t < 1) st.rafId = root.requestAnimationFrame(tick);
          else {
            st.rafId = 0;
            announceDelta(`Zoom ${zoomText(st.view.zoom)}`);
          }
        };
      st.rafId = root.requestAnimationFrame(tick);
    }
    function cancelRaf() {
      if (st.rafId && root.cancelAnimationFrame) root.cancelAnimationFrame(st.rafId);
      st.rafId = 0;
    }
    function currentScale() {
      const c = st.canvases[0];
      if (!c) return 1;
      return viewTransform(c.clientWidth || 320, c.clientHeight || 240, { ...st.view, objective: st.objective }).scale;
    }
    function panByPixels(direction) {
      if (stageMode === 'real') {
        const s = PAN_STEP_PX,
          d = { left: [s, 0], right: [-s, 0], up: [0, s], down: [0, -s] }[direction];
        if (d) photoPanBy(d[0], d[1], direction);
        return;
      }
      const step = PAN_STEP_PX / currentScale(),
        d = { left: [-step, 0], right: [step, 0], up: [0, -step], down: [0, step] }[direction];
      if (!d) return;
      panTo(st.view.cx + d[0], st.view.cy + d[1], direction);
    }
    const centreText = () => `centre ${pct(st.view.cx)}% / ${pct(st.view.cy)}%`;
    function panTo(cx, cy, direction) {
      const before = `${st.view.cx},${st.view.cy}`;
      st.view.cx = clamp(cx, 0, FIELD);
      st.view.cy = clamp(cy, 0, FIELD);
      paint();
      // At the field edge the centre does not move; say so instead of repeating the same text.
      const moved = before !== `${st.view.cx},${st.view.cy}`;
      announceDelta(
        `${moved ? `Panned${direction ? ` ${direction}` : ''}` : 'Edge of the field, no further pan'}; ${centreText()}`
      );
    }
    function resetView() {
      cancelRaf();
      if (stageMode === 'real') {
        st.photo = { zoom: 1, ox: 0, oy: 0 };
        paint();
        announceDelta('View reset: the whole photo, zoom 1x');
        return;
      }
      st.view = { zoom: 1, cx: FIELD / 2, cy: FIELD / 2 };
      paint();
      announceDelta(`View reset: objective ${st.objective}x (approximate), zoom 1x, ${centreText()}`);
    }
    // ---- REF-micro: pan and zoom on the photo (a CSS transform inside a clipping box) ----
    // ox / oy are the photo fractions at the box's top left, zoom 1..PHOTO_ZOOM_MAX; the clamp keeps
    // the box full of photo (no empty strip). Box size in px; jsdom (no layout) falls back to the
    // picture's own width and height so the maths stays deterministic.
    const photoBox = () => (stageEl ? stageEl.querySelector('[data-labm-photo]') : null);
    function photoSize(box) {
      const a = slide(),
        r = box && box.getBoundingClientRect ? box.getBoundingClientRect() : { width: 0, height: 0 };
      return {
        W: r.width || (box && box.clientWidth) || (a && Number(a.width)) || 320,
        H: r.height || (box && box.clientHeight) || (a && Number(a.height)) || 240,
      };
    }
    function photoClamp() {
      st.photo.zoom = clamp(st.photo.zoom, 1, PHOTO_ZOOM_MAX);
      const lim = 1 - 1 / st.photo.zoom;
      st.photo.ox = clamp(st.photo.ox, 0, lim);
      st.photo.oy = clamp(st.photo.oy, 0, lim);
    }
    // Zoom to z2 keeping the photo point under (mx, my) (box px; the centre by default) in place.
    function photoZoomAt(z2, mx, my, quiet) {
      const { W, H } = photoSize(photoBox()),
        z = st.photo.zoom,
        ax = mx === undefined ? W / 2 : mx,
        ay = my === undefined ? H / 2 : my,
        u = st.photo.ox + ax / (z * W),
        v = st.photo.oy + ay / (z * H);
      st.photo.zoom = clamp(z2, 1, PHOTO_ZOOM_MAX);
      st.photo.ox = u - ax / (st.photo.zoom * W);
      st.photo.oy = v - ay / (st.photo.zoom * H);
      photoClamp();
      paint();
      if (!quiet) announceDelta(`Zoom ${zoomText(st.photo.zoom)}`);
    }
    function photoPanBy(dxPx, dyPx, direction) {
      const { W, H } = photoSize(photoBox()),
        z = st.photo.zoom,
        before = `${st.photo.ox},${st.photo.oy}`;
      st.photo.ox -= dxPx / (z * W);
      st.photo.oy -= dyPx / (z * H);
      photoClamp();
      paint();
      const moved = before !== `${st.photo.ox},${st.photo.oy}`;
      announceDelta(moved ? `Panned${direction ? ` ${direction}` : ''}` : 'Edge of the photo, no further pan');
    }
    // The photo point (fractions 0..1) under a client point, or null outside the box.
    function photoPoint(box, clientX, clientY) {
      const r = box.getBoundingClientRect(),
        { W, H } = photoSize(box),
        z = st.photo.zoom,
        mx = clientX - r.left,
        my = clientY - r.top;
      if (!(mx >= 0 && my >= 0 && mx <= W && my <= H)) return null;
      return { x: st.photo.ox + mx / (z * W), y: st.photo.oy + my / (z * H) };
    }
    function onPhotoDown(e) {
      const box = e.currentTarget;
      st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (st.pointers.size === 2) {
        const [a, b] = [...st.pointers.values()],
          r = box.getBoundingClientRect();
        st.pinch = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          zoom: st.photo.zoom,
          mx: (a.x + b.x) / 2 - r.left,
          my: (a.y + b.y) / 2 - r.top,
          ox: st.photo.ox,
          oy: st.photo.oy,
        };
        st.drag = null;
      } else st.drag = { x: e.clientX, y: e.clientY, ox: st.photo.ox, oy: st.photo.oy, moved: false, photo: box };
      if (box.setPointerCapture) {
        try {
          box.setPointerCapture(e.pointerId);
        } catch {
          /* capture is optional */
        }
      }
    }
    function onPhotoMove(e) {
      if (!st.pointers.has(e.pointerId)) return;
      st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (st.pinch && st.pointers.size >= 2) {
        const [a, b] = [...st.pointers.values()],
          dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (st.pinch.dist > 0 && !pageGesture(e)) {
          st.photo.ox = st.pinch.ox;
          st.photo.oy = st.pinch.oy;
          st.photo.zoom = st.pinch.zoom;
          photoZoomAt(st.pinch.zoom * (dist / st.pinch.dist), st.pinch.mx, st.pinch.my, true);
        }
        return;
      }
      if (!st.drag || !st.drag.photo) return;
      const dx = e.clientX - st.drag.x,
        dy = e.clientY - st.drag.y;
      if (Math.hypot(dx, dy) > (e.pointerType === 'mouse' ? CLICK_PX : TAP_PX)) st.drag.moved = true;
      if (!st.drag.moved || pageGesture(e)) return;
      const { W, H } = photoSize(st.drag.photo),
        z = st.photo.zoom;
      st.photo.ox = st.drag.ox - dx / (z * W);
      st.photo.oy = st.drag.oy - dy / (z * H);
      photoClamp();
      st.drag.panned = true;
      paint();
    }
    function onPhotoUp(e) {
      const box = e.currentTarget;
      st.pointers.delete(e.pointerId);
      if (st.pinch && st.pointers.size < 2) {
        if (st.photo.zoom !== st.pinch.zoom) announceDelta(`Zoom ${zoomText(st.photo.zoom)}`);
        st.pinch = null;
      }
      if (st.drag && st.drag.photo === box) {
        if (!st.drag.moved) onPhotoClick(box, { clientX: st.drag.x, clientY: st.drag.y, pointerType: e.pointerType });
        else if (st.drag.panned) announceDelta('Panned');
        st.drag = null;
      }
    }
    function onPhotoCancel(e) {
      let restored = false;
      st.pointers.delete(e.pointerId);
      if (st.pinch && st.pointers.size < 2) {
        restored = st.photo.zoom !== st.pinch.zoom;
        st.photo = { zoom: st.pinch.zoom, ox: st.pinch.ox, oy: st.pinch.oy };
        st.pinch = null;
      }
      if (st.drag && st.drag.photo === e.currentTarget) {
        if (st.drag.panned) {
          st.photo.ox = st.drag.ox;
          st.photo.oy = st.drag.oy;
          restored = true;
        }
        st.drag = null;
      }
      if (restored) paint();
    }
    function onPhotoWheel(e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      photoZoomAt(st.photo.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top);
    }
    // Count lesions on the photo (contract §12.3): each click adds a numbered ring where it landed
    // (no snapping, no de-duplication: the model has no geometry for a photo) and counts one in the
    // region under it (a 3×3 grid of the photo, like the drawing's). No identify tag on a photo.
    function onPhotoClick(box, e) {
      if (!(st.tool === 'roi-lesion-count' && overlayFor())) return;
      const p = photoPoint(box, e.clientX, e.clientY),
        asset = slide();
      if (!p || !asset) return;
      const ts = toolState('roi-lesion-count'),
        list = ts.photoMarks[asset.id] || (ts.photoMarks[asset.id] = []),
        region =
          Math.min(ROI_GRID - 1, Math.floor(p.y * ROI_GRID)) * ROI_GRID +
          Math.min(ROI_GRID - 1, Math.floor(p.x * ROI_GRID));
      list.push({ x: p.x, y: p.y, region });
      ts.counts[region] = (Number(ts.counts[region]) || 0) + 1;
      const input = toolsEl.querySelector(`[data-labm-roi="${region}"]`);
      if (input) input.value = String(ts.counts[region]);
      paint();
      announceDelta(`Ring ${list.length} added; region ${region + 1}: ${ts.counts[region]} counted`);
    }
    function bindPhoto(box) {
      box.addEventListener('pointerdown', onPhotoDown);
      box.addEventListener('pointermove', onPhotoMove);
      box.addEventListener('pointerup', onPhotoUp);
      box.addEventListener('pointercancel', onPhotoCancel);
      box.addEventListener('wheel', onPhotoWheel, { passive: false });
    }
    // The transform, the rings and the Reset view link follow st.photo.
    function syncPhoto() {
      const box = photoBox();
      if (!box) return;
      const { zoom: z, ox, oy } = st.photo,
        t = `translate(${-ox * z * 100}%, ${-oy * z * 100}%) scale(${z})`,
        rings = box.querySelector('[data-labm-rings]'),
        asset = slide(),
        counting = !!(st.tool === 'roi-lesion-count' && overlayFor()),
        marks = counting && asset ? toolState('roi-lesion-count').photoMarks[asset.id] || [] : [];
      box.querySelector('[data-labm-photo-img]').style.transform = t;
      rings.style.transform = t;
      rings.classList.toggle('labm-rings-grid', counting);
      rings.innerHTML = marks
        .map(
          (m, i) =>
            `<span class="labm-ring" style="left:${(m.x * 100).toFixed(3)}%;top:${(m.y * 100).toFixed(3)}%;--labm-ring-scale:${(1 / z).toFixed(4)}"><span>${i + 1}</span></span>`
        )
        .join('');
      const reset = stageEl.querySelector('[data-labm-photo-reset]');
      if (reset) reset.hidden = z === 1 && !ox && !oy;
    }
    // Count and grid tools need every region on screen: 4x shows the whole schematic field.
    function wholeFieldButton() {
      const b = h(
        '<button type="button" class="btn" data-labm-whole-field>Show the whole field (4x, reset view)</button>'
      );
      b.addEventListener('click', () => {
        setObjective(4);
        resetView();
      });
      return b;
    }
    function viewForDescribe(i) {
      return {
        objective: st.objective,
        zoom: st.view.zoom,
        tab: viewId(),
        layers: st.layersOn ? st.layers : undefined,
        compare: st.compare,
        compareMode: st.compareMode,
        side: st.compare
          ? 'baseline on the left, experimental on the right'
          : st.outcomes.length >= 2
            ? sideName(i).toLowerCase()
            : '',
      };
    }
    function describeCurrent() {
      // REF-micro: the real slide's text alternative is its description plus the credit.
      if (realOn() && slide()) return `${slide().description || ''} ${creditText(st.lab, slide())}`.trim();
      const i = st.compare ? 0 : st.active,
        text = describe(outcomeAt(i), st.specimen, st.lab, viewForDescribe(i));
      if (!st.compare) return text;
      return `${text} Experimental side: ${describe(outcomeAt(1), st.specimen, st.lab, { objective: st.objective, zoom: st.view.zoom, tab: viewId() })}`;
    }
    // The visible text alternative (Numbers expander) follows every view change, pans included.
    function syncTextAlt() {
      if (!st.destroyed) textAltEl.textContent = describeCurrent();
    }
    // Plain words for an outcome: CortexLab.summarize when lab.js is loaded, else a short private
    // list of the same model-scale words.
    function summaryOf(out) {
      return plainSummary(out, st.specimen);
    }
    // What one side says in the short sentence: the summary, or why there is no picture.
    function outcomeWords(i) {
      const out = outcomeAt(i);
      if (isSynthetic(out)) return summaryOf(out);
      if (out && out.code === 'step-skipped') {
        const { done, total } = stepsDone(runAt(i));
        return `${done} of ${total} steps done; ${settingGap(out) ? noPictureAfter() : 'the picture is drawn once every step is done.'}`;
      }
      return W('notModeledLong');
    }
    // Badge words read aloud ("Simulated · not a measurement" -> "Simulated, not a measurement").
    const spokenBadge = out => W(BADGE_WORDS[badgeKind(out)][0]).replace(/\s*·\s*/g, ', ');
    // The short live sentence (A11Y-06): badge words, run, objective and view, then plain words.
    // The engine's full description stays in the Numbers expander ([data-labm-text-alt]).
    function liveSentence() {
      if (realOn() && slide()) return `${W('realSlide')}. ${runName(st.active)}: ${slide().description || ''}`;
      const view = `${st.objective}x${st.layersOn ? ', layers on' : ''}`;
      if (!st.compare) {
        const i = st.active,
          // With two runs the side is named (the menu choice just named the run itself).
          name = st.outcomes.length >= 2 ? `${sideName(i)} run` : runName(i);
        return `${spokenBadge(outcomeAt(i))}. ${name}, ${view}: ${outcomeWords(i)}`;
      }
      const [a, b] = [outcomeAt(0), outcomeAt(1)],
        badges =
          badgeKind(a) === badgeKind(b)
            ? spokenBadge(a)
            : `Baseline ${spokenBadge(a).toLowerCase()}; experimental ${spokenBadge(b).toLowerCase()}`,
        mode = st.compareMode === 'swipe' ? 'swipe' : 'side by side',
        words =
          compareWords() ||
          [0, 1]
            .filter(i => !isSynthetic(outcomeAt(i)))
            .map(i => `${sideName(i)}: ${outcomeWords(i)}`)
            .join(' ') ||
          'The model does not compare these two runs site by site.';
      // The run names are on screen and in the viewer's name; the sentence stays short.
      return `${badges}. Comparing the baseline and experimental runs, ${mode}, ${view}: ${words}`;
    }
    // User-initiated view changes only (layers, compare, which run); never on mount or update().
    function announce() {
      if (st.destroyed) return;
      syncTextAlt();
      root.clearTimeout(st.liveTimer);
      st.liveTimer = root.setTimeout(() => {
        if (!st.destroyed) liveEl.textContent = liveSentence();
      }, 120);
    }
    // Short position update (non-atomic region): pans, zooms and objective changes, so an arrow
    // key never re-reads the whole outcome description.
    function announceDelta(text) {
      if (st.destroyed) return;
      syncTextAlt();
      root.clearTimeout(st.deltaTimer);
      st.deltaTimer = root.setTimeout(() => {
        if (!st.destroyed) deltaEl.textContent = text;
      }, 80);
    }
    function setStatus(text) {
      st.status = text || '';
      statusEl.textContent = st.status;
    }

    // ---- keyboard on the viewer ----
    function onStageKey(e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const key = e.key;
      let handled = true;
      if (stageMode === 'real' && (/^[1-4]$/.test(key) || key === 'l' || key === 'L'))
        handled = false; // the drawing's keys
      else if (key === 'ArrowLeft') panByPixels('left');
      else if (key === 'ArrowRight') panByPixels('right');
      else if (key === 'ArrowUp') panByPixels('up');
      else if (key === 'ArrowDown') panByPixels('down');
      else if (key === '+' || key === '=') zoomBy(ZOOM_STEP);
      else if (key === '-' || key === '_') zoomBy(1 / ZOOM_STEP);
      else if (key === '0') resetView();
      else if (/^[1-4]$/.test(key)) setObjective(OBJECTIVES[Number(key) - 1]);
      else if (key === 'c' || key === 'C') setCompare(!st.compare);
      else if (key === 'l' || key === 'L') setLayers(!st.layersOn);
      else if (key === 'Escape') {
        // A visible tag goes first; the next Esc closes the viewer.
        if (!tagEl.hidden) dismissTag();
        else if (st.onClose) st.onClose();
        else handled = false;
      } else handled = false;
      if (handled) e.preventDefault();
    }

    // ---- pointer on canvases ----
    function fieldPoint(canvas, clientX, clientY) {
      const rect = canvas.getBoundingClientRect(),
        t = viewTransform(rect.width || canvas.clientWidth || 320, rect.height || canvas.clientHeight || 240, {
          ...st.view,
          objective: st.objective,
        });
      return { x: (clientX - rect.left - t.ox) / t.scale, y: (clientY - rect.top - t.oy) / t.scale, scale: t.scale };
    }
    function onPointerDown(e) {
      const canvas = e.currentTarget;
      hideTag();
      st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (st.pointers.size === 2) {
        const [a, b] = [...st.pointers.values()];
        st.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: st.view.zoom };
        st.drag = null;
      } else {
        st.drag = { x: e.clientX, y: e.clientY, cx: st.view.cx, cy: st.view.cy, moved: false, canvas };
      }
      if (canvas.setPointerCapture) {
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          /* capture is optional */
        }
      }
    }
    // FIX2 (partial-micro-pan-nudge): with "Drag to pan" off a finger belongs to the page
    // (touch-action: pan-y pinch-zoom), so its moves never pan or zoom the picture, not even the few
    // that arrive before the browser takes the scroll (pointercancel). It can still tap.
    const pageGesture = e => e.pointerType === 'touch' && !st.touchPan;
    function onPointerMove(e) {
      if (!st.pointers.has(e.pointerId)) {
        onHover(e);
        return;
      }
      st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (st.pinch && st.pointers.size >= 2) {
        const [a, b] = [...st.pointers.values()],
          dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (st.pinch.dist > 0 && !pageGesture(e)) {
          st.view.zoom = clamp(st.pinch.zoom * (dist / st.pinch.dist), ZOOM_MIN, ZOOM_MAX);
          paint();
        }
        return;
      }
      if (!st.drag) return;
      const dx = e.clientX - st.drag.x,
        dy = e.clientY - st.drag.y;
      // A finger or pen wobbles a few pixels on a tap: that still identifies / counts.
      if (Math.hypot(dx, dy) > (e.pointerType === 'mouse' ? CLICK_PX : TAP_PX)) st.drag.moved = true;
      if (!st.drag.moved || pageGesture(e)) return;
      const scale = currentScale();
      st.view.cx = clamp(st.drag.cx - dx / scale, 0, FIELD);
      st.view.cy = clamp(st.drag.cy - dy / scale, 0, FIELD);
      st.drag.panned = true;
      paint();
    }
    function onPointerUp(e) {
      const canvas = e.currentTarget;
      st.pointers.delete(e.pointerId);
      if (st.pinch && st.pointers.size < 2) {
        if (st.view.zoom !== st.pinch.zoom) announceDelta(`Zoom ${zoomText(st.view.zoom)}`);
        st.pinch = null;
      }
      if (st.drag && st.drag.canvas === canvas) {
        // A tap acts where it came down: the finger wobbles off a thin line on the way up.
        if (!st.drag.moved)
          onCanvasClick(canvas, {
            clientX: st.drag.x,
            clientY: st.drag.y,
            pointerType: e.pointerType,
            detail: e.detail,
          });
        else if (st.drag.panned) announceDelta(`Panned; ${centreText()}`);
        st.drag = null;
      }
    }
    // The browser took the gesture (page scroll or page pinch while "Drag to pan" is off): drop the
    // pointer without treating it as a click, so no outline point is added by a scroll, and put back
    // any pan or zoom its first moves made (a pen, or a finger with Drag to pan on), so the picture
    // is where it was before the gesture.
    function onPointerCancel(e) {
      let restored = false;
      st.pointers.delete(e.pointerId);
      if (st.pinch && st.pointers.size < 2) {
        restored = st.view.zoom !== st.pinch.zoom;
        st.view.zoom = st.pinch.zoom;
        st.pinch = null;
      }
      if (st.drag && st.drag.canvas === e.currentTarget) {
        if (st.drag.panned) {
          st.view.cx = st.drag.cx;
          st.view.cy = st.drag.cy;
          restored = true;
        }
        st.drag = null;
      }
      if (restored) paint();
    }
    function onWheel(e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      cancelRaf();
      st.view.zoom = clamp(st.view.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), ZOOM_MIN, ZOOM_MAX);
      paint();
      announceDelta(`Zoom ${zoomText(st.view.zoom)}`);
    }
    // A click / tap: the open picture tool's action, else the identify tag, pinned (showTag).
    function onCanvasClick(canvas, e) {
      if (st.tool === 'roi-lesion-count' && overlayFor()) {
        countAt(canvas, e);
        return;
      }
      if (st.tool !== 'artifact-area' || !overlayFor()) {
        showIdentify(canvas, e, true);
        return;
      }
      const p = fieldPoint(canvas, e.clientX, e.clientY);
      if (p.x < 0 || p.y < 0 || p.x > FIELD || p.y > FIELD) return;
      const ts = toolState('artifact-area');
      ts.draft.push({ x: p.x, y: p.y });
      syncToolPanel();
      paint();
    }
    function bindCanvas(canvas) {
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerCancel);
      canvas.addEventListener('pointerleave', onPointerLeave);
      canvas.addEventListener('wheel', onWheel, { passive: false });
    }

    // ---- GAME-micro (contract §10): hint chips under the picture and the identify tag ----
    // Both are aria-hidden decoration with pointer-events off: the keys list in View controls, the
    // status lines and the text description stay the accessible path. The chips are a caption row
    // under the canvases (a grid row of the stage, lab-microscope.css), so nothing covers the picture.
    const hudEl = h('<div class="labm-hud" aria-hidden="true" data-labm-hud hidden></div>'),
      tagEl = h('<div class="labm-tag" aria-hidden="true" data-labm-tag hidden></div>'),
      // FIX3 (G5): Count lesions' running total beside the picture (the region boxes in the sheet
      // carry the same numbers for assistive tech, so this line is aria-hidden; it is a count, not a
      // hint, so it stays with Show hints off).
      tallyEl = h('<p class="labm-tally" aria-hidden="true" data-labm-tally hidden></p>');
    let hudKey = '',
      tagTimer = 0,
      tagPin = null,
      tagHtml = '',
      tagText = '', // the line the tag shows now
      tagDismissed = ''; // the line Esc took away: hovering it again does not bring it back at once
    // True when the current layers draw at least one structure on a shown side, so "Click a
    // structure" never promises a tag that cannot come (a run with no visible silver).
    function canIdentify(shown) {
      const shapes = shapeList(st.specimen).shapes,
        layers = st.layersOn ? st.layers : SIM_LAYERS;
      return shown.some(i => isSynthetic(outcomeAt(i)) && shapes.some(drawnBy(outcomeAt(i), layers)));
    }
    // FIX4 (r3-d3-8): the count chip promises a count only while the current layers draw a lesion
    // of the kind being counted (a development-first run draws none: the view chips show instead).
    function canCount() {
      const site = toolState('roi-lesion-count').site,
        drawn = drawnBy(activeOutcome(), st.layersOn ? st.layers : SIM_LAYERS);
      return isSynthetic(activeOutcome()) && shapeList(st.specimen).shapes.some(s => s.site === site && drawn(s));
    }
    // [verb, what it does] chips for what the picture does now; none when no shown side is drawn
    // (a Not modeled plate does not pan or zoom).
    function hudChips() {
      const shown = st.compare ? [0, 1] : [st.active];
      if (!shown.some(i => isSynthetic(outcomeAt(i)))) return [];
      if (stageMode === 'real') {
        const touch = coarsePointer();
        if (overlayFor() && st.tool === 'roi-lesion-count')
          return [[REAL_COUNT_VERB[0][touch ? 1 : 0], REAL_COUNT_VERB[1]]];
        return !touch ? HUD_REAL_DESKTOP : st.touchPan ? HUD_REAL_TOUCH_PAN : HUD_REAL_TOUCH;
      }
      const touch = coarsePointer(),
        verb = overlayFor() && TOOL_VERBS[st.tool];
      if (verb && (st.tool !== 'roi-lesion-count' || canCount())) return [[verb[0][touch ? 1 : 0], verb[1]]];
      const chips = !touch ? HUD_DESKTOP : st.touchPan ? HUD_TOUCH_PAN : HUD_TOUCH;
      return canIdentify(shown) ? chips : chips.filter(([, what]) => what !== IDENTIFY);
    }
    function syncTally() {
      const on = !st.destroyed && st.tool === 'roi-lesion-count' && !!overlayFor();
      tallyEl.hidden = !on;
      if (!on) return;
      const ts = toolState('roi-lesion-count'),
        total = ts.counts.reduce((a, b) => a + (Number(b) || 0), 0),
        what = SITE_PLURAL[ts.site] || siteText(ts.site);
      tallyEl.innerHTML = `${esc(what.charAt(0).toUpperCase() + what.slice(1))} counted: <strong>${total}</strong>`;
    }
    function syncHud(on) {
      if (st.destroyed) return;
      const chips = on !== false && hintsShown() ? hudChips() : [],
        key = JSON.stringify(chips);
      hudEl.hidden = !chips.length;
      const picking = !!(overlayFor() && (stageMode === 'real' ? st.tool === 'roi-lesion-count' : TOOL_VERBS[st.tool]));
      if (rootEl.classList.contains('labm-picking') !== picking)
        holdPlace(() => rootEl.classList.toggle('labm-picking', picking));
      syncStuck(picking);
      if (key === hudKey) return;
      hudKey = key;
      hudEl.innerHTML = chips
        .map(
          ([verb, what]) =>
            `<span class="labm-hint"><span class="labm-hint-verb">${esc(verb)}</span>: ${esc(what)}</span>`
        )
        .join('');
    }
    // FIX4 (H3): while the picture sticks above the sheet (a narrow viewer), its height (+ 8 px) is
    // kept in --labm-stuck-h on the html element, which lab-microscope.css adds to the page's
    // scroll-padding-top: a control the keyboard focuses scrolls in below the picture, never under it.
    let stuckH = '';
    function syncStuck(picking) {
      let next = '';
      if (picking && !st.destroyed && stageEl && root.getComputedStyle)
        if (root.getComputedStyle(stageEl).position === 'sticky')
          next = `${Math.round((stageEl.offsetHeight || 0) + BAND_PAD_PX)}px`;
      if (next === stuckH) return;
      stuckH = next;
      if (next) doc.documentElement.style.setProperty('--labm-stuck-h', next);
      else doc.documentElement.style.removeProperty('--labm-stuck-h');
    }
    // CortexLab.events 'hints' (the shell's Show hints switch); a viewer whose DOM the host
    // replaced without destroy() lets go on the next event, like the shell's own listeners.
    const hintBus = shell() && shell().events && typeof shell().events.on === 'function' ? shell().events : null;
    let offHints = () => {};
    function onHints(on) {
      if (st.destroyed || !rootEl.isConnected) {
        offHints();
        return;
      }
      syncHud(on);
    }
    if (hintBus) {
      const off = hintBus.on('hints', onHints);
      offHints = () => {
        offHints = () => {};
        if (typeof off === 'function') off();
        else if (typeof hintBus.off === 'function') hintBus.off('hints', onHints);
      };
    }
    function hideTag() {
      root.clearTimeout(tagTimer);
      tagTimer = 0;
      tagPin = null;
      tagHtml = '';
      tagText = '';
      tagEl.hidden = true;
      tagEl.replaceChildren();
    }
    // Esc: the tag goes, and stays gone while the pointer rests on the same structure.
    function dismissTag() {
      tagDismissed = tagText;
      hideTag();
    }
    // v inside [lo, hi] with a 4 px margin for a box of this size (no layout, e.g. jsdom: only >= 4).
    const within = (v, lo, hi, size) => (hi > lo ? Math.max(lo + 4, Math.min(v, hi - size - 4)) : Math.max(4, v));
    // lines[0] in bold, the rest small; e is the pointer event. Mouse / pen: beside the pointer,
    // flipped to stay inside the picture it names (so the pointer can reach it). A finger hides what
    // is under it (D4): centred above the touch point, which may rise over the top bar while it
    // stays on screen; with no room there, beside the finger (see below). pin (a click / tap): a
    // mouse click's tag goes after TAG_PIN_MS (hover brings it back); a tap's stays until the next
    // press, Esc or a repaint (WCAG 2.2.1: touch has no hover to bring it back).
    function showTag(lines, canvas, e, pin) {
      if (st.destroyed || !stageEl || !lines.length) return hideTag();
      root.clearTimeout(tagTimer);
      tagTimer = 0;
      const html = lines
        .map((line, i) => `<span class="${i ? 'labm-tag-line' : 'labm-tag-main'}">${esc(line)}</span>`)
        .join('');
      // A hover over the same structure only moves the tag.
      if (html !== tagHtml) tagEl.innerHTML = tagHtml = html;
      tagText = lines[0];
      tagEl.hidden = false;
      const sr = stageEl.getBoundingClientRect(),
        cr = canvas.getBoundingClientRect(),
        x = e.clientX - sr.left,
        y = e.clientY - sr.top,
        tw = tagEl.offsetWidth || 0,
        th = tagEl.offsetHeight || 0,
        sw = stageEl.clientWidth || sr.width || 0;
      let left, top;
      if (e.pointerType === 'touch') {
        // The screen's top edge: below the site's sticky top bar (lab.js keeps its height).
        const bar =
            root.getComputedStyle && root.getComputedStyle(doc.documentElement).getPropertyValue('--lab-topbar-h'),
          screenTop = (parseFloat(bar) || 0) + 4;
        left = x - tw / 2;
        top = y - FINGER_PX - th;
        // No room above (just under the top bar): beside the finger on the roomier side; if the tag
        // is too wide for that side, below it, so it still never covers the spot that was tapped.
        if (sr.top + top < screenTop) {
          const right = x < sw / 2;
          left = right ? x + FINGER_PX : x - FINGER_PX - tw;
          top = Math.max(screenTop - sr.top, y - th / 2);
          if (sw && (right ? left + tw > sw - 4 : left < 4)) {
            left = x - tw / 2;
            top = y + FINGER_PX;
          }
        }
        left = within(left, 0, sw, tw);
      } else {
        const box = { l: cr.left - sr.left, t: cr.top - sr.top, r: cr.right - sr.left, b: cr.bottom - sr.top };
        left = cr.width && x + TAG_GAP_PX + tw > box.r - 4 ? x - TAG_GAP_PX - tw : x + TAG_GAP_PX;
        top = cr.height && y + TAG_GAP_PX + th > box.b - 4 ? y - TAG_GAP_PX - th : y + TAG_GAP_PX;
        left = within(left, box.l, box.r, tw);
        top = within(top, box.t, box.b, th);
      }
      tagEl.style.left = `${Math.round(left)}px`;
      tagEl.style.top = `${Math.round(top)}px`;
      tagPin = pin ? { x: e.clientX, y: e.clientY } : null;
      if (pin && e.pointerType === 'mouse') tagTimer = root.setTimeout(hideTag, TAG_PIN_MS);
    }
    // The pointer is on the tag's box grown by pad px.
    function onTag(e, pad) {
      if (tagEl.hidden) return false;
      const r = tagEl.getBoundingClientRect();
      return (
        r.width > 0 &&
        e.clientX >= r.left - pad &&
        e.clientX <= r.right + pad &&
        e.clientY >= r.top - pad &&
        e.clientY <= r.bottom + pad
      );
    }
    // Which outcome a canvas point shows (side by side: its canvas; swipe: its side of the split).
    function outcomeIndexAt(canvas, clientX) {
      if (stageMode === 'side') return Math.max(0, st.canvases.indexOf(canvas));
      if (stageMode === 'swipe') {
        const rect = canvas.getBoundingClientRect(),
          width = rect.width || canvas.clientWidth || 320;
        return clientX - rect.left < (width * st.split) / 100 ? 0 : 1;
      }
      return st.active;
    }
    // A shape counts as drawn when the current layers paint it (the dashed outline draws every one).
    function drawnBy(out, layers) {
      return shape =>
        (layers.deposit && visibilityOf(out, shape.site) > 0) ||
        !!layers.lesions ||
        (layers.ionic && ordinal(stateOf(out, shape.site, 'ionicBound')) > 0) ||
        (layers.nuclei && ordinal(stateOf(out, shape.site, 'nuclei')) > 0);
    }
    // "Plaque core (drawn) · visible silver: moderate" for the drawn structure under the point; ''
    // on a Not modeled side or empty paper.
    function identifyAt(canvas, clientX, clientY) {
      const out = outcomeAt(outcomeIndexAt(canvas, clientX));
      if (!isSynthetic(out)) return '';
      const p = fieldPoint(canvas, clientX, clientY),
        shape = structureAt(st.specimen, p.x, p.y, {
          tolerance: HIT_PX / p.scale,
          drawn: drawnBy(out, st.layersOn ? st.layers : SIM_LAYERS),
        });
      if (shape)
        return `${siteText(shape.site)} (drawn) · ${W('visibleSilver')}: ${level(visibilityOf(out, shape.site))}`;
      // MODE-micro: a drawn artifact under the point, only where no structure is (structures win).
      const run = runAt(outcomeIndexAt(canvas, clientX)),
        art =
          (st.layersOn ? st.layers : SIM_LAYERS).deposit &&
          artifactAt(hashSeed(run && run.id), artifactsOf(out), p.x, p.y, HIT_PX / p.scale);
      return art ? ARTIFACT_TEXT[art] : '';
    }
    function showIdentify(canvas, e, pin, text = identifyAt(canvas, e.clientX, e.clientY)) {
      tagDismissed = '';
      if (text) showTag([text, W('simulated')], canvas, e, pin);
      else hideTag();
    }
    // Mouse / pen hover (touch has none: a tap pins the tag instead). WCAG 1.4.13: the pointer can move
    // onto the tag (it can be read under a magnifier); after Esc it does not come back until the
    // pointer finds something else.
    function onHover(e) {
      if (e.pointerType === 'touch') return;
      if (tagPin && Math.hypot(e.clientX - tagPin.x, e.clientY - tagPin.y) < TAG_MOVE_PX) return;
      const canvas = e.currentTarget,
        text = identifyAt(canvas, e.clientX, e.clientY);
      // Hold still while the pointer is on the tag or crossing the gap to it, or near it on the same
      // structure (a big plaque at 40x runs under the tag), so the pointer can always reach it.
      if (onTag(e, text === tagText ? TAG_NEAR_PX : TAG_GAP_PX + 2)) return;
      if (text && text === tagDismissed) return;
      showIdentify(canvas, e, false, text);
    }
    function onPointerLeave(e) {
      if (!st.pointers.has(e.pointerId) && !tagPin) hideTag();
      if (!st.pointers.has(e.pointerId)) tagDismissed = '';
    }
    // Count lesions: a click on a drawn lesion of the kind being counted counts that lesion once, in
    // the region under the click (FIX3, G5: within COUNT_PX, a finger's COUNT_TOUCH_PX), and rings it
    // on the picture; a click on a ringed lesion takes it off again (FIX5, I1: the count is of lesions,
    // not clicks). The second click of a double click (or a quick second tap) on the same lesion
    // changes nothing. Anywhere else nothing is counted and the tag says so. The typed boxes in the
    // sheet stay the keyboard path and can correct it; the running total shows under the picture.
    let lastCount = null; // { shape, region, at }: the lesion the last count click took or gave back
    function countAt(canvas, e) {
      const p = fieldPoint(canvas, e.clientX, e.clientY);
      if (p.x < 0 || p.y < 0 || p.x > FIELD || p.y > FIELD) {
        showTag(['Outside the field: nothing counted'], canvas, e, true);
        return;
      }
      const ts = toolState('roi-lesion-count'),
        drawn = drawnBy(activeOutcome(), st.layersOn ? st.layers : SIM_LAYERS),
        tolerance = (e.pointerType === 'mouse' ? COUNT_PX : COUNT_TOUCH_PX) / p.scale,
        hit = structureAt(st.specimen, p.x, p.y, { tolerance, drawn: s => s.site === ts.site && drawn(s) });
      if (!hit) {
        // What is there instead, when it is another drawn structure (a neurite beside a core).
        const other = structureAt(st.specimen, p.x, p.y, { tolerance: HIT_PX / p.scale, drawn });
        showTag(
          other
            ? [`${siteText(other.site)} (drawn): not counted`, `Counting: ${siteText(ts.site).toLowerCase()}`]
            : ['No lesion here', 'Nothing counted'],
          canvas,
          e,
          true
        );
        return;
      }
      const marks = ts.marks[ts.site] || (ts.marks[ts.site] = []),
        now = Date.now(),
        again = !!lastCount && lastCount.shape === hit && (now - lastCount.at < COUNT_DOUBLE_MS || e.detail > 1);
      if (again) lastCount.at = now;
      else {
        const k = marks.findIndex(m => m.shape === hit),
          cell = FIELD / ROI_GRID,
          region =
            k >= 0
              ? marks.splice(k, 1)[0].region
              : Math.min(ROI_GRID - 1, Math.floor(p.y / cell)) * ROI_GRID +
                Math.min(ROI_GRID - 1, Math.floor(p.x / cell));
        if (k < 0) marks.push({ shape: hit, region });
        ts.counts[region] = Math.max(0, (Number(ts.counts[region]) || 0) + (k < 0 ? 1 : -1));
        const box = toolsEl.querySelector(`[data-labm-roi="${region}"]`);
        if (box) box.value = String(ts.counts[region]);
        lastCount = { shape: hit, region, at: now };
        paint(); // the ring comes or goes, the total follows
      }
      const r = lastCount.region,
        counted = marks.some(m => m.shape === hit),
        lines = [
          `Region ${r + 1}: ${ts.counts[r]} counted`,
          `${siteText(hit.site)} (drawn)${counted ? '' : ': taken off'}`,
        ];
      if (counted && hintsShown()) lines.push(`${e.pointerType === 'mouse' ? 'Click' : 'Tap'} it again: take it off`);
      showTag(lines, canvas, e, true);
    }

    // ---- stage ----
    let stageEl = null,
      stageMode = '';
    function makeCanvas(label) {
      const canvas = h(`<canvas class="labm-canvas" role="img" aria-label="${esc(label)}"></canvas>`);
      bindCanvas(canvas);
      return canvas;
    }
    function stageLabel() {
      if (realOn())
        return `Microscope viewer for ${runNames()}, real slide (observed reference). Arrow keys pan; plus and minus zoom.`;
      return `Microscope viewer for ${runNames()}, simulated picture${st.layersOn ? ' with layers' : ''}${st.compare ? ', comparing two runs' : ''}. Arrow keys pan; plus and minus zoom.`;
    }
    // REF-micro (contract §12.3): the real slide as the main picture: the photo in a clipping box its
    // own size (never wider than twice the picture, never taller than about 70 % of the window),
    // the Reset view link once moved, a thumbnail strip when several photos match, then the credit
    // (two links) and the facts as the authors state them. Nothing sits over the photo.
    function buildPhoto() {
      const asset = slide(),
        w = Number(asset.width) || 0,
        hgt = Number(asset.height) || 0,
        ratio = w && hgt ? `${w} / ${hgt}` : '4 / 3',
        maxW = w ? `max-width: min(${2 * w}px, calc(70vh * ${(w / (hgt || w)).toFixed(4)}));` : '',
        credit = creditFor(st.lab, asset),
        link = (url, text) =>
          url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>` : `<span>${esc(text)}</span>`,
        facts = [asset.stain, asset.region, asset.tissue, asset.scale].filter(Boolean),
        fig = h(`<figure class="labm-observed" data-labm-reference data-lab-label="${LABEL_OBSERVED}">
          <div class="labm-photo" data-labm-photo style="aspect-ratio: ${ratio}; ${maxW}">
            <img class="labm-photo-img" data-labm-photo-img src="${esc(asset.src)}" alt="${esc(asset.description || '')}"${w ? ` width="${w}"` : ''}${hgt ? ` height="${hgt}"` : ''} draggable="false" decoding="async">
            <div class="labm-rings" data-labm-rings aria-hidden="true"></div>
          </div>
          <div class="labm-photo-bar"><button type="button" class="labm-link" data-labm-photo-reset hidden>Reset view</button></div>
          <figcaption>
            <p class="labm-credit" data-labm-credit>${link(credit.articleUrl, credit.head || credit.text)}${credit.figure ? `, ${esc(credit.figure)}` : ''}${credit.license ? ` · ${link(credit.licenseUrl, credit.license)}` : ''}</p>
            ${facts.length ? `<p class="labm-facts" data-labm-facts>${esc(facts.join(' · '))}</p>` : ''}
          </figcaption>
        </figure>`);
      bindPhoto(fig.querySelector('[data-labm-photo]'));
      if (st.slides.length > 1) {
        const strip = h(
          `<div class="labm-strip" role="group" aria-label="Real slides for this condition" data-labm-strip></div>`
        );
        st.slides.forEach((a, i) => {
          strip.appendChild(
            h(
              `<button type="button" data-labm-slide="${i}" aria-pressed="${a === asset}" aria-label="${esc(`Slide ${i + 1} of ${st.slides.length}: ${a.description || ''}`)}"><img src="${esc(a.src)}" alt="" width="56" height="56" loading="lazy" decoding="async"></button>`
            )
          );
        });
        fig.insertBefore(strip, fig.querySelector('figcaption'));
      }
      return fig;
    }
    function buildStage(mode) {
      stageEl = h(
        `<div class="labm-stage" role="application" tabindex="0" aria-roledescription="microscope viewer" aria-label="${esc(stageLabel())}" aria-describedby="${id}-stage-help" data-labm-stage="${mode}"></div>`
      );
      stageEl.addEventListener('keydown', onStageKey);
      st.canvases = [];
      if (mode === 'side') {
        for (const i of [0, 1]) {
          const fig = h(
            `<figure class="labm-side"><figcaption><strong>${esc(sideName(i))}</strong>${runName(i) === sideName(i) ? '' : `: ${esc(runName(i))}`}</figcaption></figure>`
          );
          const canvas = makeCanvas(`${sideName(i)}, ${runName(i)}: ${shortLabel(outcomeAt(i))}`);
          fig.appendChild(canvas);
          stageEl.appendChild(fig);
          st.canvases.push(canvas);
        }
      } else if (mode === 'swipe') {
        const fig = h(
          `<figure class="labm-swipe"><figcaption><strong>Swipe:</strong> left of the split is ${esc(sideName(0).toLowerCase())} (${esc(runName(0))}), right is ${esc(sideName(1).toLowerCase())} (${esc(runName(1))}). The slider moves the split.</figcaption></figure>`
        );
        const canvas = makeCanvas(`Swipe comparison of ${runName(0)} and ${runName(1)}`);
        fig.appendChild(canvas);
        stageEl.appendChild(fig);
        st.canvases.push(canvas);
      } else if (mode === 'real') {
        stageEl.appendChild(buildPhoto());
      } else {
        const canvas = makeCanvas(`${runName(st.active)}: ${shortLabel(activeOutcome())}`);
        stageEl.appendChild(canvas);
        st.canvases.push(canvas);
      }
      stageEl.appendChild(
        h(
          mode === 'real'
            ? `<p class="labm-sr-only" id="${id}-stage-help">Arrow keys pan, plus and minus zoom, 0 shows the whole photo, C toggles compare${esc(escHelp('Escape'))}.</p>`
            : `<p class="labm-sr-only" id="${id}-stage-help">Arrow keys pan, plus and minus zoom, 1 to 4 choose the objective, C toggles compare, L toggles layers${esc(escHelp('Escape'))}.</p>`
        )
      );
      hideTag();
      stageEl.append(hudEl, tallyEl, tagEl);
      stageMode = mode;
      return stageEl;
    }

    // ---- under the picture: card lines or the shading note, the layers legend, the reference ----
    // TONING-verify-1: over the steps the run needs (ENGINE-14: gold toning / thiosulfate drop out when
    // its setting skips them), as the bench counts.
    function stepsDone(run) {
      const params = run && run.params && typeof run.params === 'object' ? run.params : {},
        skip = { 'gold-toning': params.toning === false, 'sodium-thiosulfate': params.thiosulfate === false },
        steps = (S() ? S().STEPS : []).filter(s => !skip[s]),
        done = run && Array.isArray(run.stepsDone) ? steps.filter(s => run.stepsDone.includes(s)).length : 0;
      return { done, total: steps.length || 9 };
    }
    // A run in progress whose card also names a setting gap (a skipped step, the washes) never gets a
    // picture, finished or not: the promise of one would be false (lab.js says the same).
    function settingGap(out) {
      const steps = S() ? S().STEPS : [];
      return (out.outsideSupport || []).some(id => !steps.includes(id));
    }
    function noPictureAfter() {
      return `finished, it still comes back ${W('notModeled')}: the model has no rule for its settings.`;
    }
    // An uncertainty card stays visible as "Not modeled" with what would be needed.
    function cardLine(i) {
      const out = outcomeAt(i),
        prefix = st.compare ? `<strong>${esc(sideName(i))}:</strong> ` : '';
      if (out && out.code === 'step-skipped') {
        const { done, total } = stepsDone(runAt(i));
        return h(
          `<p class="labm-card" data-labm-card="${i}">${prefix}${esc(`${done} of ${total} steps done.`)} ${esc(settingGap(out) ? `F${noPictureAfter().slice(1)}` : 'The microscope draws the picture once every step is done.')}</p>`
        );
      }
      const needed = out && Array.isArray(out.whatWouldBeNeeded) ? out.whatWouldBeNeeded.map(plain).join('; ') : '';
      return h(
        `<p class="labm-card" data-labm-card="${i}">${prefix}${esc(W('notModeledLong'))}${needed ? ` <strong>What would be needed:</strong> ${esc(needed)}.` : ''}</p>`
      );
    }
    // "Drawn darker for all five structures and the background (model scale)." (KB-26: the
    // background is named, never counted as a sixth "site").
    function drawnSentence(rows) {
      const bg = rows.find(r => r.site === 'background'),
        structs = rows.filter(r => r.site !== 'background'),
        num = k => NUMBER_WORDS[k] || String(k),
        clauses = [
          ['darker', d => d > 0],
          ['lighter', d => d < 0],
          ['the same', d => d === 0],
        ]
          .map(([word, test]) => {
            const k = structs.filter(r => test(r.delta)).length,
              items = [];
            if (k)
              items.push(
                k === structs.length && k > 1 ? `all ${num(k)} structures` : `${num(k)} structure${k === 1 ? '' : 's'}`
              );
            if (bg && test(bg.delta)) items.push('the background');
            return items.length ? `${word} for ${items.join(' and ')}` : '';
          })
          .filter(Boolean);
      return `Drawn ${clauses.join('; ')} (${W('modelScale')}).`;
    }
    // F2: the darker picture can look crisper while the model contrast is unchanged; say so.
    function contrastSentence(rows) {
      const [a, b] = [outcomeAt(0), outcomeAt(1)];
      if (!isSynthetic(a) || !isSynthetic(b)) return '';
      const ca = ordinal(a.contrast),
        cb = ordinal(b.contrast),
        bg = rows.find(r => r.site === 'background'),
        moved = bg && bg.delta ? `: the background ${bg.delta > 0 ? 'darkened' : 'lightened'} too` : '';
      return ca === cb
        ? `Same model contrast in both (${level(ca)})${moved}.`
        : `Model contrast: ${level(ca)} in the baseline, ${level(cb)} in the experimental run.`;
    }
    // Plain words for the comparison (also the live sentence); '' when there is no per-site table.
    function compareWords() {
      const rows = differenceRows(st.comparison);
      if (!rows.length) return '';
      return `${drawnSentence(rows)} ${contrastSentence(rows)}`.trim();
    }
    // One plain line per comparison plus the contrast line; the per-site table is in Numbers.
    function compareSummary() {
      const rows = differenceRows(st.comparison);
      if (!rows.length) {
        // A card side already has its own line; two drawn runs from different bases need one.
        if (!st.comparison || ![0, 1].every(i => isSynthetic(outcomeAt(i)))) return null;
        return h(
          `<p class="labm-caption" data-labm-compare-summary><strong>Experimental vs baseline:</strong> ${esc(W('notModeled').toLowerCase())} site by site, because the model draws these two runs from different bases. Details are under &ldquo;Numbers behind this image&rdquo;.</p>`
        );
      }
      const contrast = contrastSentence(rows),
        wrap = h('<div class="labm-compare-lines"></div>');
      wrap.appendChild(
        h(
          `<p class="labm-caption" data-labm-compare-summary><strong>Experimental vs baseline:</strong> ${esc(drawnSentence(rows))} The table is under &ldquo;Numbers behind this image&rdquo;.</p>`
        )
      );
      if (contrast)
        wrap.appendChild(h(`<p class="labm-compare-contrast" data-labm-compare-contrast>${esc(contrast)}</p>`));
      return wrap;
    }
    function layersLegend() {
      const parts = [];
      if (st.layers.lesions) parts.push('dashed outline = where lesions are');
      if (st.layers.ionic) parts.push('halo = bound silver');
      if (st.layers.nuclei) parts.push('dots = silver nuclei');
      return h(
        `<p class="labm-caption labm-legend" data-labm-legend><strong>Layers on.</strong> ${esc(parts.length ? `${parts.join(' · ')}.` : 'No extra layer is picked.')} The layers are picked under &ldquo;Numbers behind this image&rdquo;.</p>`
      );
    }
    // Contract §12.3: the one honesty line under both views (the shell's lede says it above too).
    const honestyLine = () => h(`<p class="labm-caption labm-honesty" data-labm-honesty>${esc(DARKER_NOTE)}</p>`);
    function belowPicture() {
      const wrap = h('<div class="labm-below"></div>'),
        shown = st.compare ? [0, 1] : [st.active],
        drawn = shown.filter(i => isSynthetic(outcomeAt(i))).length;
      if (stageMode === 'real') {
        // The real slide: what it is (not the run), the run's own by-eye look it stands for, honesty.
        wrap.appendChild(h(`<p class="labm-caption labm-real-note" data-labm-real-note>${esc(REAL_NOTE)}</p>`));
        const look = lookOf(activeOutcome());
        if (look) {
          const color = lookColor(look.key);
          wrap.appendChild(
            h(
              `<p class="labm-caption labm-look" data-labm-look="${esc(look.key || '')}">${color ? `<span class="labm-look-swatch" style="background:${esc(color)}" aria-hidden="true"></span>` : ''}<strong>Your run, by eye:</strong> ${esc(look.text)}</p>`
            )
          );
        }
        wrap.appendChild(honestyLine());
        return wrap;
      }
      for (const i of shown) if (!isSynthetic(outcomeAt(i))) wrap.appendChild(cardLine(i));
      if (st.compare) {
        const summary = compareSummary();
        if (summary) wrap.appendChild(summary);
      }
      // OPEN-micro (§13.5): a drawn run with a whole unknown dip says so in the caption (each side named).
      const unknownNote = shown
        .filter(i => isSynthetic(outcomeAt(i)) && hasUnknownDips(outcomeAt(i)))
        .map(i => ` ${st.compare ? `<strong>${esc(sideName(i))}:</strong> ` : ''}${esc(UNKNOWN_DIP_NOTE)}`)
        .join('');
      if (drawn)
        wrap.appendChild(h(`<p class="labm-caption" data-labm-caption>${esc(PICTURE_NOTE)}${unknownNote}</p>`));
      // MODE-micro (contract §11.6): what the drawn silver looks like beyond the structures — an
      // unstained section, gold toning, the drawn artifacts, and the by-eye look the engine gives.
      for (const i of shown) {
        const out = outcomeAt(i);
        if (!isSynthetic(out)) continue;
        const prefix = st.compare ? `<strong>${esc(sideName(i))}:</strong> ` : '';
        if (isUnstained(out))
          wrap.appendChild(
            h(`<p class="labm-caption labm-unstained" data-labm-unstained="${i}">${prefix}${esc(UNSTAINED_NOTE)}</p>`)
          );
        if (toneOf(out) === 'gold')
          wrap.appendChild(h(`<p class="labm-caption labm-tone" data-labm-tone="${i}">${prefix}${esc(TONE_NOTE)}</p>`));
        const arts = artifactsOf(out);
        if (arts.length)
          wrap.appendChild(
            h(
              `<p class="labm-caption labm-artifacts" data-labm-artifacts="${i}">${prefix}<strong>Also drawn on the section:</strong> ${esc(arts.map(a => ARTIFACT_TEXT[a]).join(' · '))}.</p>`
            )
          );
        const look = lookOf(out);
        if (look) {
          const color = lookColor(look.key);
          wrap.appendChild(
            h(
              `<p class="labm-caption labm-look" data-labm-look="${esc(look.key || '')}">${prefix}${color ? `<span class="labm-look-swatch" style="background:${esc(color)}" aria-hidden="true"></span>` : ''}<strong>By eye:</strong> ${esc(look.text)}</p>`
            )
          );
        }
      }
      if (drawn && st.layersOn) wrap.appendChild(layersLegend());
      if (drawn) wrap.appendChild(honestyLine());
      // No real photo for this condition: say so, once, under a drawn single run (the switch is away).
      if (drawn && !st.compare && !st.slides.length)
        wrap.appendChild(
          h(`<p class="labm-reference" data-labm-reference="none">${esc(referenceFallback(activeOutcome()))}</p>`)
        );
      return wrap;
    }
    function renderBelow() {
      const old = panelEl.querySelector('.labm-below');
      if (old) old.replaceWith(belowPicture());
    }
    function renderPanel() {
      // Rebuilding the panel removes the focused viewer; keep keyboard users on the new one.
      const hadFocus = !!(
        stageEl &&
        doc.activeElement &&
        (doc.activeElement === stageEl || stageEl.contains(doc.activeElement))
      );
      panelEl.replaceChildren();
      panelEl.appendChild(buildStage(realOn() ? 'real' : st.compare ? st.compareMode : 'single'));
      if (hadFocus) stageEl.focus();
      panelEl.appendChild(belowPicture());
    }

    // ---- Numbers behind this image: per-run tables and the compare differences ----
    const valueCell = value => `<td>${value === null || value === undefined ? 'not modeled' : esc(level(value))}</td>`;
    function cardDetail(out) {
      if (!out) return '<p>No outcome.</p>';
      return `<p>${esc(out.explanation || '')}</p>
        <p><strong>What would be needed:</strong> ${esc((out.whatWouldBeNeeded || []).join('; ') || 'none listed')}.</p>
        <p><strong>Suggested next:</strong> ${esc((out.suggestedNext || []).join('; ') || 'none listed')}.</p>`;
    }
    function layerTable(i) {
      const out = outcomeAt(i),
        caption = `${st.outcomes.length >= 2 ? `${esc(sideName(i))}: ` : ''}${esc(runName(i))} &middot; ${esc(W('modelScale'))}`;
      if (!isSynthetic(out))
        return h(
          `<div class="labm-table-wrap labm-card-detail" data-labm-card-detail="${i}"><p class="labm-caption">${caption} &middot; ${esc(shortLabel(out))}</p>${cardDetail(out)}</div>`
        );
      const compareOnly = !!(out.state && out.state.axon && out.state.axon.ionicBound === null);
      const rows = sites()
        .map(site => {
          const presence = site === 'background' ? null : presenceOf(st.specimen, site),
            phase = stateOf(out, site, 'ratePhase');
          return `<tr><th scope="row">${esc(siteText(site))}</th>
            <td>${site === 'background' ? 'set by a model rule' : esc(level(presence))}</td>
            ${valueCell(stateOf(out, site, 'ionicBound'))}
            ${valueCell(stateOf(out, site, 'nuclei'))}
            ${valueCell(stateOf(out, site, 'deposit'))}
            ${valueCell(visibilityOf(out, site))}
            <td>${esc(phase === null || phase === undefined ? 'not modeled' : phase)}</td></tr>`;
        })
        .join('');
      return h(`<div class="labm-table-wrap"><table class="labm-table">
        <caption>${caption}</caption>
        <thead><tr><th scope="col">Site</th><th scope="col">In the specimen <small>(presence)</small></th><th scope="col">Bound silver <small>(ionic bound)</small></th><th scope="col">Silver nuclei <small>(nuclei)</small></th><th scope="col">Visible silver <small>(deposit)</small></th><th scope="col">Drawn as <small>(visibility${compareOnly ? ', compare only' : ''})</small></th><th scope="col">Rate phase</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <p class="labm-caption">Contrast: ${esc(level(out.contrast))}; background: ${esc(level(out.background))} (${esc(W('modelScale'))}).</p>
        ${out.slide && out.slide.fixed === true ? `<p class="labm-caption" data-labm-fixed="${i}">${esc(FIXED_NOTE)}</p>` : ''}
        </div>`);
    }
    function renderCompare() {
      compareEl.replaceChildren();
      if (!st.compare || st.outcomes.length < 2) {
        compareEl.hidden = true;
        return;
      }
      compareEl.hidden = false;
      compareEl.setAttribute('aria-label', `Per-site difference, ${runNames()}`);
      const cmp = st.comparison;
      compareEl.appendChild(
        h(`<${H()} class="labm-h" id="${id}-compare-h">Per-site difference, experimental minus baseline</${H()}>`)
      );
      if (!cmp) {
        compareEl.appendChild(h(`<p>No comparison is available (two runs and lab.compare are required).</p>`));
        return;
      }
      compareEl.appendChild(
        h(
          `<p class="labm-caption">Comparison: ${badgeHtml(cmp.label === LABEL_NO_BASIS ? 'not-modeled' : 'simulated', cmp.label)} &middot; Changed: ${cmp.changedParams && cmp.changedParams.length ? cmp.changedParams.map(p => `<code>${esc(p)}</code>`).join(', ') : 'nothing differs'}.</p>`
        )
      );
      const rows = differenceRows(cmp);
      if (rows.length)
        compareEl.appendChild(
          h(`<div class="labm-table-wrap"><table class="labm-table labm-diff">
            <caption>How dark each site is drawn (${esc(W('modelScale'))}), ${esc(runName(0))} vs ${esc(runName(1))}</caption>
            <thead><tr><th scope="col">Site</th><th scope="col">Baseline</th><th scope="col">Experimental</th><th scope="col">Change <small>(steps)</small></th></tr></thead>
            <tbody>${rows
              .map(
                r =>
                  `<tr class="${r.changed ? 'labm-changed' : ''}" data-labm-diff="${esc(r.site)}"><th scope="row">${esc(r.siteText)}</th><td>${esc(level(r.baseline))}</td><td>${esc(level(r.experimental))}</td><td class="labm-delta">${esc(r.deltaText)}</td></tr>`
              )
              .join('')}</tbody></table></div>`)
        );
      else
        compareEl.appendChild(
          h(
            `<p>${esc(W('notModeled'))}: no per-site difference is worked out while either run has no model rule. Each run's details are above.</p>`
          )
        );
      const responsible = (cmp.rulesResponsible || [])
        .map(
          rid => `<li>${ruleTitle(rid) ? `${esc(ruleTitle(rid))} ` : ''}<small><code>${esc(rid)}</code></small></li>`
        )
        .join('');
      compareEl.appendChild(
        h(
          `<div class="labm-rules"><p><strong>Why the model did this</strong></p>${responsible ? `<ul>${responsible}</ul>` : '<p>none listed</p>'}</div>`
        )
      );
      const caveats = (cmp.caveats || []).map(c => `<li>${esc(c)}</li>`).join('');
      if (caveats)
        compareEl.appendChild(
          h(`<div class="labm-caveats"><p><strong>${esc(W('keepInMind'))}</strong></p><ul>${caveats}</ul></div>`)
        );
    }
    function renderNumbers() {
      q('[data-labm-layers-legend]').textContent = st.layersOn
        ? 'Layers to draw (Layers is on)'
        : 'Layers to draw (Layers is off; picking one turns it on)';
      layersEl.querySelectorAll('[data-labm-layer]').forEach(input => {
        input.checked = !!st.layers[input.getAttribute('data-labm-layer')];
      });
      tablesEl.replaceChildren(...(st.compare ? [0, 1] : [st.active]).map(layerTable));
      renderCompare();
    }

    // ---- Measure sheet: five tools, each rule confirmed with a checkbox before the tool UI ----
    const TOOL_DEFAULTS = {
      'roi-lesion-count': () => ({
        site: targetSites()[1] || 'plaque-core',
        criterion: '',
        counts: Array(ROI_GRID * ROI_GRID).fill(0),
        bySite: {}, // FIX4 (r3-d3-8): each kind's own counts while another kind is chosen
        marks: {}, // FIX5 (I1): each kind's clicked lesions, in the order counted: [{ shape, region }]
        photoMarks: {}, // REF-micro: rings on each real photo, by asset id: [{ x, y, region }] (photo fractions)
      }),
      'contrast-ordinal': () => ({ sample: null }),
      'artifact-area': () => ({ criterion: '', outlines: [], draft: [], cells: new Set() }),
      'tissue-coverage': () => ({ grid: 4, cells: '' }),
      'blinded-quality-score': () => ({ score: '', scale: '', scorer: '' }),
    };
    function toolState(toolId) {
      if (!st.toolState[toolId]) st.toolState[toolId] = (TOOL_DEFAULTS[toolId] || (() => ({})))();
      return st.toolState[toolId];
    }
    // Grids and outlines show only while that tool is open (rule read) on a single run.
    function overlayFor() {
      if (st.compare || !st.sheetOpen || !st.tool || !st.readRules.has(st.tool)) return null;
      if (st.tool === 'roi-lesion-count') {
        const ts = toolState('roi-lesion-count');
        return { grid: ROI_GRID, numbered: true, marks: (ts.marks[ts.site] || []).map(m => m.shape) };
      }
      if (st.tool === 'tissue-coverage') return { grid: toolState('tissue-coverage').grid };
      if (st.tool === 'artifact-area') {
        const ts = toolState('artifact-area');
        return { outlines: ts.outlines, draft: ts.draft, cells: ts.cells, cellGrid: CELL_GRID };
      }
      return null;
    }
    function openTool(rule) {
      if (!toolsEnabled(activeOutcome())) return;
      st.tool = st.tool === rule.id ? null : rule.id;
      syncTools(rule.id);
      paint();
      if (st.tool === rule.id) revealTool(rule.id, toolsEl.querySelector(`[data-labm-tool="${rule.id}"]`));
    }
    // FIX4 (H3, H10): the part of the window the student sees: under the site's sticky top bar and
    // above an open Notes drawer (CortexLab.viewportInsets() -> { top, bottom }; without it the top
    // bar's --lab-topbar-h and the window's bottom).
    function freeBand() {
      let top = NaN,
        cover = 0;
      const fn = shell() && shell().viewportInsets;
      if (typeof fn === 'function') {
        try {
          const v = fn() || {};
          top = Number(v.top);
          cover = Math.max(0, Number(v.bottom) || 0);
        } catch {
          top = NaN;
        }
      }
      if (!Number.isFinite(top)) {
        const bar =
          root.getComputedStyle && root.getComputedStyle(doc.documentElement).getPropertyValue('--lab-topbar-h');
        top = parseFloat(bar) || 0;
        cover = 0;
      }
      return { top, bottom: (root.innerHeight || 0) - cover };
    }
    // The bottom of the picture while it sticks above the sheet (a narrow viewer with a picture tool
    // open: the stage sticks), else 0: beside the sheet, or in the flow, it covers none of it.
    function pictureCover() {
      if (!root.getComputedStyle || !asideEl) return 0;
      const box = [stageEl, panelEl].find(n => n && root.getComputedStyle(n).position === 'sticky');
      if (!box) return 0;
      const p = box.getBoundingClientRect(),
        a = asideEl.getBoundingClientRect();
      if (p.right <= a.left || a.right <= p.left) return 0;
      return (parseFloat(root.getComputedStyle(box).top) || 0) + p.height;
    }
    // Scrolls just enough that `first` down to `last` sits in the free band (under a stuck picture);
    // when it is taller than the band, `first` lands at the band's top.
    function bringIntoBand(first, last) {
      if (st.destroyed || !first || !first.isConnected || typeof root.scrollBy !== 'function') return;
      const band = freeBand(),
        top = Math.max(band.top, pictureCover()) + BAND_PAD_PX,
        bottom = band.bottom - BAND_PAD_PX,
        a = first.getBoundingClientRect(),
        b = last && last.isConnected ? last.getBoundingClientRect() : a,
        hi = Math.max(a.bottom, b.bottom);
      if (!(bottom > top) || !(a.height || b.height)) return;
      let d = 0;
      if (a.top < top || hi - a.top > bottom - top) d = a.top - top;
      else if (hi > bottom) d = hi - bottom;
      if (Math.abs(d) >= 1) root.scrollBy({ top: d, behavior: 'instant' });
    }
    // A picture tool that takes clicks, just opened: from the control the student used down to
    // Record, in the band beside / under the picture.
    function revealTool(toolId, from) {
      if (!TOOL_VERBS[toolId] || !overlayFor()) return;
      const form = toolsEl.querySelector(`[data-labm-tool-form="${toolId}"]`);
      if (form) bringIntoBand(from || form, form.querySelector('button[type="submit"]') || form);
    }
    // A refused Record: focus the field without the browser's own scroll (it ignores the top bar,
    // a stuck picture and the drawer), then bring the field and the refusal under it into the band.
    // FIX5 (I1, d5-7): from the field down to Record, so the refusal under the field never pushes
    // Record off screen (when that is taller than the band, the field and its refusal lead).
    function showField(label, after) {
      const input = label.querySelector('input'),
        form = label.closest('form'),
        submit = form && form.querySelector('button[type="submit"]');
      if (input) input.focus({ preventScroll: true });
      bringIntoBand(label, submit || after);
      return false;
    }
    // The picture tools' layout coming or going (lab-microscope.css) keeps the focused control where
    // it was on screen, so a tick or a Close never jumps the page; a control focused out of view (the
    // tool's button after Close or Record rebuilt the sheet) is then brought into the band.
    function holdPlace(change) {
      const el = doc.activeElement,
        anchor = el && el !== doc.body && rootEl.contains(el) ? el : null,
        before = anchor ? anchor.getBoundingClientRect().top : 0;
      change();
      if (!anchor || !anchor.isConnected || typeof root.scrollBy !== 'function') return;
      const d = anchor.getBoundingClientRect().top - before;
      if (Math.abs(d) >= 1) root.scrollBy({ top: d, behavior: 'instant' });
      if (!panelEl.contains(anchor)) bringIntoBand(anchor);
    }
    function record(rule, value, note) {
      const payload = measurementPayload({ rule, run: activeRun(), outcome: activeOutcome(), value, note });
      st.onMeasurement(payload);
      const what = `${toolPlain(rule).name} = ${value} (${unitText(rule.unit)}) for ${runName(st.active)}, labeled “${isSynthetic(activeOutcome()) ? W('simulated') : labelText(payload.label)}”.`;
      // FIX4 (H2): with the report off, "Recorded." and what was recorded, plainly (no lock, no place).
      setStatus(
        featureOn('report') ? `Recorded: ${what} ${savedNote()}${shell() ? ` ${LOCK_NOTE}` : ''}` : `Recorded. ${what}`
      );
      // Said where the student acted: the line is in view once the form closes (G4).
      root.requestAnimationFrame?.(() => {
        if (!st.destroyed && statusEl.isConnected && typeof statusEl.scrollIntoView === 'function')
          statusEl.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      });
      return payload;
    }
    // Where a record goes (the report is on), naming experiments only while the designer is on.
    function savedNote() {
      return featureOn('designer') ? REPORT_NOTE : REPORT_NOTE_NO_EXP;
    }
    // How a tool takes its value, in the caption under its rule (FIX4, d4-8: the picture tools say
    // what a click does, Click / Tap by pointer like the chips).
    function toolHow(rule) {
      const tap = coarsePointer() ? 'Tap' : 'Click';
      if (rule.id === 'roi-lesion-count') return `${tap} lesions on the picture, or type counts.`;
      if (rule.id === 'artifact-area') return `${tap} outline points on the picture, or mark squares.`;
      return rule.manual
        ? 'Manual: you enter the value.'
        : 'Worked out from the picture (nearest of five shades); the model&rsquo;s own value goes in the note.';
    }
    function toolPane(rule) {
      // REF-micro (contract §12.3): on the real slide only Count lesions takes clicks; a tool that
      // reads the drawing's geometry says so and offers the switch.
      if (realOn() && rule.id !== 'roi-lesion-count') {
        const refusal =
          h(`<div class="labm-tool-pane" id="${id}-pane-${esc(rule.id)}" data-labm-tool-pane="${esc(rule.id)}">
          <${HS()} class="labm-h-sub">${esc(rule.title)}</${HS()}>
          <p class="labm-caption" data-labm-tool-refusal>${esc(TOOL_READS_DRAWING)}</p>
          <div class="labm-tool-actions"><button type="button" class="btn" data-labm-switch-drawing>${esc(VIEW_TEXT.drawing)}</button><button type="button" class="btn" data-labm-tool-close>Close tool</button></div>
        </div>`);
        refusal.querySelector('[data-labm-switch-drawing]').addEventListener('click', () => setPicView('drawing'));
        refusal.querySelector('[data-labm-tool-close]').addEventListener('click', () => {
          st.tool = null;
          syncTools(rule.id);
          paint();
        });
        return refusal;
      }
      const read = st.readRules.has(rule.id),
        pane = h(`<div class="labm-tool-pane" id="${id}-pane-${esc(rule.id)}" data-labm-tool-pane="${esc(rule.id)}">
          <${HS()} class="labm-h-sub">${esc(rule.title)}</${HS()}>
          <p class="labm-rule-text" id="${id}-rule-${esc(rule.id)}">${esc(rule.rule)}</p>
          <p class="labm-caption">Unit: ${esc(unitText(rule.unit))}. ${toolHow(rule)} ${featureOn('report') ? 'Saved' : 'Recorded'} with the label &ldquo;${esc(W('simulated'))}&rdquo;.</p>
          ${realOn() ? `<p class="labm-caption" data-labm-photo-count>${esc(PHOTO_COUNT_NOTE)}</p>` : ''}
          <label class="labm-check"><input type="checkbox" data-labm-rule-ok aria-describedby="${id}-rule-${esc(rule.id)}" ${read ? 'checked' : ''}> I read the rule</label>
        </div>`);
      pane.querySelector('[data-labm-rule-ok]').addEventListener('change', e => {
        if (e.target.checked) st.readRules.add(rule.id);
        else st.readRules.delete(rule.id);
        renderTools('[data-labm-rule-ok]');
        paint();
        // FIX4 (H3): a picture tool's rule field, counts and Record come up from the checkbox down,
        // beside / under the picture (focus stays on the checkbox).
        if (e.target.checked) revealTool(rule.id, toolsEl.querySelector('[data-labm-rule-ok]'));
      });
      if (read) pane.appendChild(toolForm(rule));
      else {
        const closeBtn = h('<button type="button" class="btn" data-labm-tool-close>Close tool</button>');
        closeBtn.addEventListener('click', () => {
          st.tool = null;
          syncTools(rule.id);
          paint();
        });
        pane.appendChild(h('<div class="labm-tool-actions"></div>')).appendChild(closeBtn);
      }
      return pane;
    }
    function toolForm(rule) {
      const ts = toolState(rule.id),
        out = activeOutcome(),
        form = h(`<form class="labm-tool-form" data-labm-tool-form="${esc(rule.id)}" novalidate></form>`),
        body = h('<div class="labm-tool-body"></div>'),
        err = h('<p class="labm-error" role="alert"></p>'),
        actions = h(
          `<div class="labm-tool-actions"><button type="submit" class="btn btn-solid">Record measurement</button><button type="button" class="btn" data-labm-tool-close>Close tool</button></div>`
        );
      form.append(body, err, actions);
      actions.querySelector('[data-labm-tool-close]').addEventListener('click', () => {
        st.tool = null;
        syncTools(rule.id);
        paint();
      });
      const fail = msg => {
        err.textContent = msg;
        return false;
      };
      let submit = () => true;
      if (rule.id === 'roi-lesion-count') {
        const sel = h(
          `<label>What to count <select data-labm-field="site">${targetSites()
            .map(s => `<option value="${esc(s)}" ${ts.site === s ? 'selected' : ''}>${esc(siteText(s))}</option>`)
            .join('')}</select></label>`
        );
        const crit = h(
          `<label>Your rule for what counts (write it before counting) <input type="text" data-labm-field="criterion" value="${esc(ts.criterion)}" placeholder="for example: counts only when fully inside the region"></label>`
        );
        const grid = h(
          `<fieldset class="labm-roi" aria-describedby="${id}-roi-where"><legend data-labm-objective-note>Counts per region at ${st.objective}x (approximate)</legend></fieldset>`
        );
        ts.counts.forEach((v, i) =>
          grid.appendChild(
            h(
              `<label>Region ${i + 1} <input type="number" min="0" step="1" inputmode="numeric" data-labm-roi="${i}" value="${esc(v)}"></label>`
            )
          )
        );
        // FIX4 (H3): the rule field first, its refusal right under it, then what to count, the region
        // boxes and Record, so they follow "I read the rule" straight down beside / under the picture.
        body.append(crit, err, sel, grid);
        if (!realOn()) body.appendChild(wholeFieldButton()); // the objective belongs to the drawing
        // Where each region is: a note under Record (it names the region boxes' group too), so the
        // rule field, the boxes and Record stay together beside the picture.
        form.appendChild(
          h(
            `<p class="labm-caption" id="${id}-roi-where">Regions 1 to ${ROI_GRID * ROI_GRID} run left to right, top to bottom on the picture (a fixed ${ROI_GRID}&times;${ROI_GRID} grid); a lesion counts in the region it sits in.</p>`
          )
        );
        sel.querySelector('select').addEventListener('change', e => {
          // FIX4 (r3-d3-8): each kind keeps its own counts, so the boxes and the total never give one
          // kind's clicks another kind's name; switching back brings the earlier counts back.
          ts.bySite[ts.site] = ts.counts;
          ts.site = e.target.value;
          ts.counts = ts.bySite[ts.site] || Array(ROI_GRID * ROI_GRID).fill(0);
          grid.querySelectorAll('[data-labm-roi]').forEach(inp => {
            inp.value = String(ts.counts[Number(inp.getAttribute('data-labm-roi'))]);
          });
          paint(); // that kind's rings (FIX5, I1), its total and the chips
        });
        crit.querySelector('input').addEventListener('input', e => (ts.criterion = e.target.value));
        grid.querySelectorAll('input').forEach(inp =>
          inp.addEventListener('input', e => {
            ts.counts[Number(e.target.getAttribute('data-labm-roi'))] = Math.max(
              0,
              Math.round(Number(e.target.value) || 0)
            );
            syncTally();
          })
        );
        submit = () => {
          if (!ts.criterion.trim()) {
            // The rule field sits above the region boxes: bring it, with the refusal under it, to the
            // student (d3-8; FIX4: in the free band, not under the top bar, a stuck picture or a drawer).
            fail('Write your rule for what counts (the inclusion criterion) first.');
            return showField(crit, err);
          }
          const total = ts.counts.reduce((a, b) => a + b, 0),
            onPhoto = realOn() && slide() ? `; on=real slide ${slide().id} (observed reference; your own count)` : '';
          record(
            rule,
            total,
            `class=${ts.site}; objective=${st.objective}x (approximate); criterion="${ts.criterion.trim()}"; regions=[${ts.counts.join(',')}]; grid=${ROI_GRID}x${ROI_GRID} fixed${onPhoto}`
          );
          return true;
        };
      } else if (rule.id === 'contrast-ordinal') {
        const model = ordinal(out.contrast),
          sampleText = s =>
            s
              ? `Picture sample: <strong>${esc(level(s.contrast))}</strong> contrast (the darkest structure reads as ${esc(level(s.target))}, the background as ${esc(level(s.background))}).`
              : 'The picture has not been sampled yet.',
          readout = h(
            `<div class="labm-contrast" data-labm-contrast-readout><p>The model gives: <strong>${esc(level(model))}</strong> contrast.</p><p data-labm-sample-text>${sampleText(ts.sample)}</p></div>`
          ),
          sampleBtn = h('<button type="button" class="btn" data-labm-sample>Sample the picture</button>');
        sampleBtn.addEventListener('click', () => {
          ts.sample = sampleContrast(st.specimen, out);
          readout.querySelector('[data-labm-sample-text]').innerHTML = ts.sample
            ? sampleText(ts.sample)
            : 'This browser cannot sample the picture (no 2D canvas); the model&rsquo;s value will be recorded instead.';
        });
        body.append(readout, sampleBtn);
        submit = () => {
          if (!ts.sample) ts.sample = sampleContrast(st.specimen, out);
          const value = ts.sample ? ts.sample.contrast : model;
          record(
            rule,
            value,
            ts.sample
              ? `${ts.sample.note}; darkest site ${ordWord(ts.sample.target)}, background ${ordWord(ts.sample.background)}; model-state contrast ${ordWord(model)}`
              : `model-state contrast (no 2D canvas available to sample the render); illustrative`
          );
          return true;
        };
      } else if (rule.id === 'artifact-area') {
        const crit = h(
          `<label>Your rule for what counts as an artifact (write it first) <input type="text" data-labm-field="criterion" value="${esc(ts.criterion)}" placeholder="for example: silver that follows no tissue structure"></label>`
        );
        const info = h(`<p data-labm-outline-info></p>`);
        const btns = h(
          `<div class="labm-tool-actions"><button type="button" class="btn" data-labm-outline="close">Close outline</button><button type="button" class="btn" data-labm-outline="undo">Undo point</button><button type="button" class="btn" data-labm-outline="clear">Clear outlines</button></div>`
        );
        const cells = h(
          `<details class="labm-cells"><summary>Keyboard alternative: mark ${CELL_GRID}&times;${CELL_GRID} squares as artifact</summary><div class="labm-cell-grid" role="group" aria-label="Field squares"></div></details>`
        );
        const cellGrid = cells.querySelector('.labm-cell-grid');
        for (let r = 0; r < CELL_GRID; r++)
          for (let c = 0; c < CELL_GRID; c++) {
            const key = `${r},${c}`,
              b = h(
                `<button type="button" aria-pressed="${ts.cells.has(key)}" data-labm-cell="${key}"><span class="labm-sr-only">Row ${r + 1}, column ${c + 1}</span><span aria-hidden="true">${r + 1},${c + 1}</span></button>`
              );
            b.addEventListener('click', () => {
              if (ts.cells.has(key)) ts.cells.delete(key);
              else ts.cells.add(key);
              b.setAttribute('aria-pressed', String(ts.cells.has(key)));
              refresh();
              paint();
            });
            cellGrid.appendChild(b);
          }
        const fractions = () => {
          const poly = clamp(ts.outlines.reduce((a, p) => a + polygonArea(p), 0) / (FIELD * FIELD), 0, 1),
            cell = ts.cells.size / (CELL_GRID * CELL_GRID);
          return { poly, cell, total: clamp(poly + cell, 0, 1) };
        };
        const refresh = () => {
          const f = fractions();
          info.textContent = `Click on the picture to add outline points (${ts.draft.length} in the open outline; ${ts.outlines.length} closed outline${ts.outlines.length === 1 ? '' : 's'}, fraction ${f.poly.toFixed(2)}). Marked squares: ${ts.cells.size} of ${CELL_GRID * CELL_GRID} (fraction ${f.cell.toFixed(2)}). Combined fraction: ${f.total.toFixed(2)}.`;
        };
        refresh();
        crit.querySelector('input').addEventListener('input', e => (ts.criterion = e.target.value));
        btns.addEventListener('click', e => {
          const b = e.target.closest('button[data-labm-outline]');
          if (!b) return;
          const kind = b.getAttribute('data-labm-outline');
          if (kind === 'close' && ts.draft.length >= 3) {
            ts.outlines.push(ts.draft.slice());
            ts.draft = [];
          } else if (kind === 'close')
            err.textContent = 'An outline needs at least three points before it can be closed.';
          else if (kind === 'undo') ts.draft.pop();
          else {
            ts.draft = [];
            ts.outlines = [];
          }
          refresh();
          paint();
        });
        body.append(crit, err, info, btns, cells);
        submit = () => {
          if (!ts.criterion.trim()) {
            fail('Write your rule for what counts as an artifact first.');
            return showField(crit, err);
          }
          const f = fractions();
          if (!ts.outlines.length && !ts.cells.size)
            return fail('Outline at least one region or mark at least one square.');
          record(
            rule,
            Number(f.total.toFixed(3)),
            `criterion="${ts.criterion.trim()}"; outlines=${ts.outlines.length} (fraction ${f.poly.toFixed(3)}); cells=${ts.cells.size} of ${CELL_GRID * CELL_GRID} (fraction ${f.cell.toFixed(3)}); manual estimate, not a segmentation`
          );
          return true;
        };
      } else if (rule.id === 'tissue-coverage') {
        const sel = h(
          `<label>Grid size <select data-labm-field="grid">${[4, 6, 8].map(n => `<option value="${n}" ${ts.grid === n ? 'selected' : ''}>${n}&times;${n} (${n * n} squares)</option>`).join('')}</select></label>`
        );
        const cells = h(
          `<label>Squares that hold tissue <input type="number" min="0" max="${ts.grid * ts.grid}" step="1" inputmode="numeric" data-labm-field="cells" value="${esc(ts.cells)}"></label>`
        );
        body.append(
          h(
            '<p>The grid is drawn on the picture; count the squares that hold tissue (not empty slide, folds or lost tissue).</p>'
          ),
          sel,
          cells,
          wholeFieldButton()
        );
        sel.querySelector('select').addEventListener('change', e => {
          ts.grid = Number(e.target.value);
          cells.querySelector('input').max = String(ts.grid * ts.grid);
          paint();
        });
        cells.querySelector('input').addEventListener('input', e => (ts.cells = e.target.value));
        submit = () => {
          const total = ts.grid * ts.grid,
            k = Math.round(Number(ts.cells));
          if (ts.cells === '' || !Number.isFinite(k) || k < 0 || k > total)
            return fail(`Enter a number of squares between 0 and ${total}.`);
          record(
            rule,
            Number((k / total).toFixed(3)),
            `grid=${ts.grid}x${ts.grid}; cells=${k} of ${total}; describes the section, not the staining`
          );
          return true;
        };
      } else if (rule.id === 'blinded-quality-score') {
        body.append(
          h(
            `<p class="labm-warn"><strong>Caveat:</strong> run identity is visible in this view, so this score is not blinded. A blinded score needs a second scorer who cannot see which run produced the image; this version has no image-set export, so every score recorded here is tagged blinded=no. A score is a judgment of image quality, not a measurement of protein or pathology.</p>`
          ),
          h(
            `<fieldset class="labm-score"><legend>Score (1 to 5 on your written scale)</legend>${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="${id}-score" value="${n}" ${String(ts.score) === String(n) ? 'checked' : ''}> ${n}</label>`).join('')}</fieldset>`
          ),
          h(
            `<label>Your scale, written before scoring <input type="text" data-labm-field="scale" value="${esc(ts.scale)}" placeholder="for example: 1 = unreadable, 5 = every structure clear"></label>`
          ),
          h(
            `<label>Scorer <input type="text" data-labm-field="scorer" value="${esc(ts.scorer)}" placeholder="initials or role"></label>`
          )
        );
        body
          .querySelectorAll('input[type="radio"]')
          .forEach(r => r.addEventListener('change', e => (ts.score = e.target.value)));
        body.querySelector('[data-labm-field="scale"]').addEventListener('input', e => (ts.scale = e.target.value));
        body.querySelector('[data-labm-field="scorer"]').addEventListener('input', e => (ts.scorer = e.target.value));
        submit = () => {
          if (!ts.score) return fail('Choose a score.');
          if (!ts.scale.trim()) return fail('Write the scale before scoring.');
          if (!ts.scorer.trim()) return fail('Name the scorer.');
          record(
            rule,
            Number(ts.score),
            `scale="${ts.scale.trim()}"; scorer="${ts.scorer.trim()}"; blinded=no (run identity visible in this view); judgment of image quality`
          );
          return true;
        };
      } else {
        const val = h(`<label>Value (${esc(unitText(rule.unit))}) <input type="text" data-labm-field="value"></label>`);
        body.appendChild(val);
        submit = () => {
          const v = val.querySelector('input').value.trim();
          if (!v) return fail('Enter a value.');
          record(rule, Number.isFinite(Number(v)) ? Number(v) : v, 'manual entry');
          return true;
        };
      }
      form.addEventListener('submit', e => {
        e.preventDefault();
        err.textContent = '';
        if (submit()) {
          st.tool = null;
          // The form (and the focused submit button) is removed: keep focus on the tool's button.
          syncTools(rule.id);
          paint();
        }
      });
      return form;
    }
    // Rebuilds the sheet. Focus goes to `focusSel` when given (fallback: the status line), else to
    // the same control found again, else to the first tool or the Measure button: never to body.
    function renderTools(focusSel, statusFallback) {
      const before = toolsEl.contains(doc.activeElement) ? doc.activeElement : null,
        again = focusSel || (before ? focusSelector(before) : null);
      toolsEl.replaceChildren();
      toolsEl.hidden = !st.sheetOpen;
      measureBtn.setAttribute('aria-expanded', String(st.sheetOpen));
      toolsEl.setAttribute('aria-label', `Measurement tools, ${runNames()}`);
      const rules = measurementRules(),
        out = activeOutcome(),
        enabled = toolsEnabled(out),
        head = h(
          `<div class="labm-sheet-head"><${H()} class="labm-h" id="${id}-tools-h">Measurement tools</${H()}><button type="button" data-labm-measure-close aria-label="Close measurement tools">Close</button></div>`
        );
      head.querySelector('[data-labm-measure-close]').addEventListener('click', () => {
        setSheet(false);
        measureBtn.focus();
      });
      toolsEl.appendChild(head);
      if (!rules.length) toolsEl.appendChild(h('<p>No measurement rules are defined.</p>'));
      else {
        if (st.outcomes.length >= 2) {
          const pick = h(
            `<div class="labm-group" role="group" aria-label="Measure which run"><span class="labm-group-label">Measure</span><span class="labm-seg">${[
              0, 1,
            ]
              .map(
                i =>
                  `<button type="button" data-labm-measure-side="${i}" aria-pressed="${st.active === i}">${esc(sideRun(i))}</button>`
              )
              .join('')}</span></div>`
          );
          pick.addEventListener('click', e => {
            const b = e.target.closest('button[data-labm-measure-side]');
            if (b) setActive(Number(b.getAttribute('data-labm-measure-side')));
          });
          toolsEl.appendChild(pick);
        }
        toolsEl.appendChild(
          h(
            `<p class="labm-caption" data-labm-tools-note>${
              enabled
                ? `Each tool shows its rule; the tool opens once the rule is read. Each record is labeled &ldquo;${esc(W('simulated'))}&rdquo;${featureOn('report') ? ' and listed under From your lab work in My report' : ''}.${st.compare ? ' Grids and outlines show on one run only, with Compare off.' : ''}${realOn() ? ' On the real slide, Count lesions takes your clicks; the other tools read the drawing.' : ''}`
                : `Nothing to measure: ${esc(runName(st.active))} ${badgeKind(activeOutcome()) === 'in-progress' ? `has ${esc(W('inProgress').toLowerCase())}, so there is no picture yet` : `is ${esc(W('notModeled').toLowerCase())}, so there is no picture`}.`
            }</p>`
          )
        );
        const list = h('<ul class="labm-tool-list"></ul>');
        for (const rule of rules) {
          const plain = toolPlain(rule),
            open = enabled && st.tool === rule.id,
            item = h(`<li class="labm-tool-item"></li>`),
            b = h(
              `<button type="button" class="labm-tool-btn" data-labm-tool="${esc(rule.id)}" aria-expanded="${open}"${open ? ` aria-controls="${id}-pane-${esc(rule.id)}"` : ''} ${enabled ? '' : 'disabled'}><span class="labm-tool-name">${esc(plain.name)}</span><span class="labm-tool-line">${esc(plain.line)}</span></button>`
            );
          b.addEventListener('click', () => openTool(rule));
          item.appendChild(b);
          if (open) item.appendChild(toolPane(rule));
          list.appendChild(item);
        }
        toolsEl.appendChild(list);
      }
      if (!again && !before) return;
      const target = again ? toolsEl.querySelector(again) : null;
      if (target && !target.disabled && !toolsEl.hidden) target.focus();
      else if (statusFallback) statusEl.focus();
      else if (before)
        (toolsEl.hidden ? measureBtn : toolsEl.querySelector('[data-labm-tool]:not([disabled])') || measureBtn).focus();
    }
    // After "Record measurement" / "Close tool" (whose buttons disappear with the form) focus
    // moves to that tool's button, or to the status line.
    function syncTools(focusToolId) {
      renderTools(focusToolId ? `[data-labm-tool="${focusToolId}"]` : null, !!focusToolId);
    }
    function syncToolPanel() {
      if (toolsEl.querySelector('[data-labm-tool-form]')) renderTools();
    }

    // ---- sync + paint ----
    function syncToolbar() {
      // REF-micro: the Picture switch only when a real photo matches; objectives and Layers belong
      // to the drawing and step aside while the photo shows.
      const offered = st.slides.length > 0 && !st.compare,
        real = realOn();
      q('[data-labm-view-group]').hidden = !offered;
      rootEl
        .querySelectorAll('[data-labm-view]')
        .forEach(b =>
          b.setAttribute(
            'aria-pressed',
            String(offered && b.getAttribute('data-labm-view') === (real ? 'real' : 'drawing'))
          )
        );
      q('[data-labm-objective-group]').hidden = real;
      q('[data-labm-layers-toggle]').hidden = real;
      rootEl
        .querySelectorAll('[data-labm-objective]')
        .forEach(b =>
          b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-labm-objective')) === st.objective))
        );
      q('[data-labm-contrast]').setAttribute('aria-pressed', String(st.highContrast));
      q('[data-labm-touch-pan]').setAttribute('aria-pressed', String(st.touchPan));
      q('[data-labm-layers-toggle]').setAttribute('aria-pressed', String(st.layersOn));
      const two = st.outcomes.length >= 2;
      if (!two) st.menuOpen = false;
      compareGroup.hidden = !two;
      // K9: one Compare button; side by side / swipe and the one-run choices live in its menu.
      compareBtn.setAttribute('aria-expanded', String(st.menuOpen));
      compareMenu.hidden = !st.menuOpen;
      q('[data-labm-compare-current]').textContent = st.compare
        ? st.compareMode === 'swipe'
          ? 'swipe'
          : 'side by side'
        : `off (${sideName(st.active).toLowerCase()} shown)`;
      rootEl
        .querySelectorAll('[data-labm-compare-mode]')
        .forEach(b =>
          b.setAttribute(
            'aria-pressed',
            String(st.compare && b.getAttribute('data-labm-compare-mode') === st.compareMode)
          )
        );
      q('[data-labm-split-wrap]').hidden = !(st.compare && st.compareMode === 'swipe');
      splitInput.value = String(st.split);
      q('[data-labm-side-group]')
        .querySelectorAll('[data-labm-side]')
        .forEach(b => {
          const i = Number(b.getAttribute('data-labm-side'));
          b.textContent = `${sideRun(i)} only`;
          b.setAttribute('aria-pressed', String(!st.compare && st.active === i));
        });
      measureBtn.setAttribute('aria-expanded', String(st.sheetOpen));
    }
    // The badge replaces the old banner: one badge for the picture (one per side when the two
    // compared runs carry different labels), each with data-lab-label=<engine label>.
    function syncBadges() {
      if (realOn()) {
        // The photo's own badge (private markup: the words are the contract's, whatever the shell's
        // card badge says), with the engine label it carries.
        bannerEl.innerHTML = `<span class="lab-badge lab-badge-observed" data-lab-badge="observed" data-lab-label="${LABEL_OBSERVED}"><span class="lab-badge-text">${esc(W('realSlide'))}</span><span class="lab-sr-only"> ${esc(BADGE_LONG.observed)}</span></span>`;
        return;
      }
      if (!st.compare) {
        bannerEl.innerHTML = badgeForOutcome(activeOutcome());
        return;
      }
      const a = outcomeAt(0),
        b = outcomeAt(1);
      bannerEl.innerHTML =
        badgeKind(a) === badgeKind(b)
          ? badgeForOutcome(a)
          : [0, 1]
              .map(
                i =>
                  `<span class="labm-badge-side"><span class="labm-badge-run">${esc(sideName(i))}</span> ${badgeForOutcome(outcomeAt(i))}</span>`
              )
              .join(' ');
    }
    function sync() {
      const before = rootEl.contains(doc.activeElement) ? doc.activeElement : null;
      syncSlides();
      rootEl.setAttribute('data-labm-tab', viewId());
      rootEl.setAttribute('data-labm-picture', realOn() ? 'real' : 'drawing');
      rootEl.classList.toggle('labm-hc', st.highContrast);
      rootEl.classList.toggle('labm-touch-pan', st.touchPan);
      // Two pictures side by side need the full width: the wide two-column layout steps aside.
      rootEl.classList.toggle('labm-pair', st.compare && st.compareMode === 'side');
      toolbarEl.setAttribute('aria-label', `Viewer controls, ${runNames()}`);
      renderKeysHelp();
      syncToolbar();
      syncBadges();
      renderPanel();
      renderNumbers();
      renderTools();
      syncTextAlt();
      paint();
      // A control that was focused and is now hidden or gone hands focus to the viewer.
      const now = doc.activeElement;
      if (before && (!now || now === doc.body || !rootEl.contains(now) || now.closest('[hidden]')))
        (stageEl || panelEl).focus();
    }
    function paint() {
      if (st.destroyed || !stageEl) return;
      // Any repaint moves or changes the picture: the tag goes, the chips follow the view and tool.
      hideTag();
      syncHud();
      syncTally();
      if (stageMode === 'real') {
        syncPhoto();
        return;
      }
      const base = {
          specimen: st.specimen,
          highContrast: st.highContrast,
          objective: st.objective,
          zoom: st.view.zoom,
          pan: { x: st.view.cx, y: st.view.cy },
        },
        layers = st.layersOn ? st.layers : SIM_LAYERS;
      const runIdAt = i => (runAt(i) ? runAt(i).id : undefined);
      if (stageMode === 'side') {
        [0, 1].forEach(i =>
          renderSynthetic(st.canvases[i], { ...base, outcome: outcomeAt(i), layers, runId: runIdAt(i) })
        );
      } else if (stageMode === 'swipe') {
        const canvas = st.canvases[0],
          ctx = canvas.getContext && canvas.getContext('2d');
        if (!ctx) return;
        const { dpr, cssW, cssH } = sizeCanvas(canvas, {}),
          view = { zoom: st.view.zoom, objective: st.objective, cx: st.view.cx, cy: st.view.cy },
          splitX = (cssW * st.split) / 100;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cssW, cssH);
        const paintSide = (i, clipFrom, clipTo) => {
          ctx.save();
          ctx.beginPath();
          ctx.rect(clipFrom, 0, clipTo - clipFrom, cssH);
          ctx.clip();
          const out = outcomeAt(i);
          if (!out || isCard(out)) paintHatched(ctx, cssW, cssH, out, st.highContrast);
          else
            paintScene(ctx, cssW, cssH, {
              specimen: st.specimen,
              outcome: out,
              view,
              layers,
              highContrast: st.highContrast,
              artifactSeed: hashSeed(runIdAt(i)),
            });
          ctx.restore();
        };
        paintSide(0, 0, splitX);
        paintSide(1, splitX, cssW);
        ctx.strokeStyle = st.highContrast ? '#000000' : '#1769d2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(splitX, 0);
        ctx.lineTo(splitX, cssH);
        ctx.stroke();
        paintTag(
          ctx,
          `${st.objective}x · ${OBJECTIVE_NOTE} · left: ${sideName(0).toLowerCase()}, right: ${sideName(1).toLowerCase()}`,
          st.highContrast,
          cssW
        );
        const a = shortLabel(outcomeAt(0)),
          b = shortLabel(outcomeAt(1));
        paintBanner(ctx, cssW, cssH, a === b ? a : `Left: ${a} | Right: ${b}`, st.highContrast);
      } else {
        renderSynthetic(st.canvases[0], {
          ...base,
          outcome: activeOutcome(),
          layers,
          overlay: overlayFor(),
          runId: runIdAt(st.active),
        });
      }
    }

    // ---- resize + reduced motion ----
    let resizeObserver = null;
    const onResize = () => paint();
    if (typeof root.ResizeObserver === 'function') {
      resizeObserver = new root.ResizeObserver(onResize);
      resizeObserver.observe(rootEl);
    } else root.addEventListener('resize', onResize);

    // ---- handle ----
    function update(next = {}) {
      if (st.destroyed) return;
      if (next.lab) st.lab = next.lab;
      if (next.specimen) st.specimen = next.specimen;
      if (next.runs) st.runs = next.runs.filter(Boolean);
      if (next.outcomes) st.outcomes = next.outcomes.filter(Boolean);
      if (next.settings) {
        Object.assign(st.settings, next.settings);
        if (OBJECTIVES.includes(Number(st.settings.objective))) st.objective = Number(st.settings.objective);
        st.highContrast = !!st.settings.highContrast;
      }
      if (typeof next.onSettings === 'function') st.onSettings = next.onSettings;
      if (typeof next.onMeasurement === 'function') st.onMeasurement = next.onMeasurement;
      if (next.onClose !== undefined) st.onClose = typeof next.onClose === 'function' ? next.onClose : null;
      if (next.headingLevel !== undefined) st.headingLevel = Number(next.headingLevel) === 2 ? 2 : 3;
      if (st.active >= st.outcomes.length) st.active = 0;
      if (st.outcomes.length < 2) st.compare = false;
      if (typeof next.compare === 'boolean') st.compare = next.compare && st.outcomes.length >= 2;
      // 'layers' turns the Layers toggle on; 'simulation' and 'observed' show the plain picture
      // (the reference note is always under it).
      if (TABS.some(t => t.id === next.tab)) st.layersOn = next.tab === 'layers';
      st.tool = null;
      st.toolState = {};
      computeComparison();
      sync();
    }
    function destroy() {
      if (st.destroyed) return;
      st.destroyed = true;
      cancelRaf();
      root.clearTimeout(st.liveTimer);
      root.clearTimeout(st.deltaTimer);
      hideTag();
      offHints();
      syncStuck(false);
      if (resizeObserver) resizeObserver.disconnect();
      else root.removeEventListener('resize', onResize);
      doc.removeEventListener('pointerdown', onDocPointer);
      doc.removeEventListener('keydown', onDocKey, true);
      if (rootEl.parentNode === container) container.removeChild(rootEl);
      st.canvases = [];
      stageEl = null;
    }

    // FIX3 (G6, d3-7): the shell's full microscope view (main.lab-view-microscope) opens with the
    // picture and its chips in view below the site's sticky top bar: from the badge (the objectives
    // and the picture under it) when that fits, else from the picture's top. One frame later, so the
    // layout is done and the shell's first-frame scroll check has run. Positions are taken from the
    // page top, the place a new view opens at (the shell's smooth scroll there may still be running;
    // the instant scroll replaces it). Focus stays where the shell put it (the h1); an inline viewer,
    // or a picture that the page top already shows whole, moves nothing.
    // FIX4 (H10, p4-3): the space is the free band (freeBand: CortexLab.viewportInsets when the shell
    // has it), so an open Notes drawer counts; when even the picture with its chips is taller than
    // that band, the canvas itself is brought whole above the drawer. The view's page-in animation
    // (a transform on its main) holds a fixed drawer out of place until it ends, so the band is looked
    // at once more then, and the page moves again only when the band changed and the picture is not
    // whole in it where the page now is.
    function revealPicture(first) {
      if (st.destroyed || !stageEl || !rootEl.isConnected) return;
      const band = freeBand();
      if (!first) lookAgainLater(band);
      else if (band.top === first.top && band.bottom === first.bottom) return;
      const top = band.top + REVEAL_GAP_PX,
        bottom = band.bottom,
        y = root.scrollY || 0,
        pic = stageEl.getBoundingClientRect(),
        picTop = pic.top + y,
        picBottom = pic.bottom + y,
        headTop = bannerEl.getBoundingClientRect().top + y,
        canvas = st.canvases[0] && st.canvases[0].isConnected ? st.canvases[0].getBoundingClientRect() : null,
        shown = first ? pic.top >= band.top && pic.bottom <= bottom : picTop >= top && picBottom <= bottom;
      if (!(bottom > top) || !pic.height || shown) return;
      let from = picTop;
      if (picBottom - headTop <= bottom - top) from = headTop;
      else if (pic.height > bottom - top && canvas && canvas.height) from = canvas.top + y;
      root.scrollTo({ top: Math.max(0, from - top), behavior: 'instant' });
    }
    function lookAgainLater(band) {
      const host = container.closest && container.closest('main'),
        running =
          host && typeof host.getAnimations === 'function'
            ? host.getAnimations().filter(a => a.playState === 'running')
            : [];
      if (!running.length) return;
      Promise.all(running.map(a => a.finished)).then(
        () => root.requestAnimationFrame && root.requestAnimationFrame(() => revealPicture(band)),
        () => {}
      );
    }

    // No announcement on mount (A11Y-06): the host remounts the viewer on every bench redraw.
    sync();
    if (container.closest && container.closest('.lab-view-microscope') && root.requestAnimationFrame)
      root.requestAnimationFrame(() => revealPicture());
    return {
      update,
      destroy,
      element: rootEl,
      state: () => ({
        tab: viewId(),
        layers: st.layersOn,
        sheet: st.sheetOpen,
        menu: st.menuOpen,
        compare: st.compare,
        compareMode: st.compareMode,
        active: st.active,
        objective: st.objective,
        zoom: st.view.zoom,
        cx: st.view.cx,
        cy: st.view.cy,
        tool: st.tool,
        highContrast: st.highContrast,
        touchPan: st.touchPan,
        headingLevel: st.headingLevel,
        view: realOn() ? 'real' : 'drawing',
        slides: st.slides.length,
        slide: st.slideIndex,
        photo: { ...st.photo },
      }),
    };
  }

  root.CortexLabMicroscope = {
    mount,
    renderSynthetic,
    describe,
    // Additive pure helpers (tests and the shell may read them; see contract deviation MICRO-1).
    OBJECTIVES,
    OBJECTIVE_NOTE,
    FIELD,
    TABS,
    LAYER_KEYS,
    TINTS,
    TINTS_HC,
    TINTS_GOLD,
    TINTS_GOLD_HC,
    ARTIFACT_TEXT,
    prng,
    hashSeed,
    artifactList,
    artifactAt,
    toneOf,
    isUnstained,
    shapeList,
    structureAt,
    tintFor,
    paperFor,
    compositeLuminance,
    plainCaveat,
    differenceRows,
    measurementPayload,
    toolsEnabled,
    sampleContrast,
    referenceAsset,
    // REF-micro (contract §12.2 / §12.3): the selection rule and the credit builders, pure.
    referenceSlides,
    parseCitation,
    licenseName,
    creditFor,
    creditText,
  };
})(typeof window !== 'undefined' ? window : globalThis);
