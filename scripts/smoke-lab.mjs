// Lab smoke: the Alzheimer's Histology Lab (/lab) end to end on localhost, where the closed course
// opens for development, after the student-friendly cleanup (context/PLAN-ALZ-LAB-SIMPLIFY.md,
// contract §8). Home (one h1, three cards, the progress strip, no safety gate) and How this lab
// works (the labels explained once); the bench gate; the list-mode bench in three parts (set up, do
// the steps, one result card with its badge and plain summary; the run log and the replay inside
// History); a copy that changes one thing with the comparison card and the microscope compare; a
// Not modeled card for an uncovered parameter (no stain drawn); persistence across a reload; the
// activities stepper (M3 curves, Back / Next by keyboard, deep links, the M1 Sources chips);
// microscope keys and one measurement; the four-step designer gate and reveal; the report with its
// collected lab work, one entry of each type and the tagged export (byte checks); deep links and
// phone overflow (390 px, and 320 px with Why? open). The 3D bench runs first in its own context
// (SwiftShader WebGL2): the one view toggle, Go to station under 3D options, Do a different step in
// the Explain sheet, Do this step, the camera following the step, a plain wheel over the stage
// scrolling the page (the camera stays; the zoom hint shows) and Ctrl + wheel zooming, back to list
// mode; then a context without WebGL keeps the 3D button disabled. The header's Run menu holds New
// run, History and the safety notes (UX-R2). Step 15
// drives the tissue clip inside the bench (contract §7.1): the home intro card and the M1 clip step,
// the intro playing above the safety notes for a first-time visitor (steps wait for them), the
// auto-played intro, the dive from the result card, Explore with the structure card, Back to the
// bench, the list-mode text, the reduced-motion storyboard (starts paused) and the no-WebGL
// fallback; the 3D parts are desktop only (SwiftShader has no WebGL2 under mobile emulation). Under
// `?gates=prod` /lab shows the Under construction page and requests none of the lab's files.
// UX-SMALL (2026-10-12): the designer's microscope link leads back ("Back to your experiment" and Esc
// reopen the designer on the same step); at a non-emulated 390x844 with WebGL2, "Do this step" never
// overlaps the 3D stage at any scroll position; the export has a Name line, the app's run titles as
// run headings (no "Run run-" ids), "<change> vs standard" for a design without a title, plain
// parameter and step words, and keeps the disclaimer, tags and labels.
// UX-POLISH (2026-10-12): run sealing (step 17: the designer's "Make the runs for me" seals the pair, and
// no bench, 3D, comparison, History, microscope, report or file surface shows its outcome until the
// reveal); a finished run's jar double click in 3D records nothing; Redo a step asks first; 3D options
// open at a non-emulated 390 and 320 px never widen the page; the way back from the microscope lands on
// the designer section the student left; the export v2 file (plain names, three-line answers, settings
// and numbered events, Summary + Model detail (for instructors), honest course-guide citation) and its
// plain-text copy (no "#" headings).
// UX-LAST (2026-10-12): "Make the runs for me" reuses the finished standard run already seen as the open
// baseline and seals only the copy; a hand-made twin is sealed too; the microscope shows the open run
// beside the sealed card; the note form offers no sealed run; every designer change suggestion makes
// exactly that change or the bench refuses (17b, no fallback); the export v3 file (ENGINE-13: field
// items with blank lines around every list, Sources, no id or strength code before Model detail, the
// Model readout (simulated) after the reveal) and its plain copy (headings in capitals); finishing a
// run in 3D lands on the microscope (S6).
// MODE (2026-10-13, contract §11; step 17c rewritten): two modes (Practice the procedure: the next jar
// only; the free bench: any jar, one reaction per dip, the Slide now card, the What happened log), the
// station row under the stage, no "pending" anywhere; skipping gold toning is a free-bench mix now
// (§11.5: modeled by R-model-10, a drawn outcome), dipped as 8 steps with History in the procedure's words.
// SHELF (2026-10-13, contract §13.3; step 17d): the open free bench: the mode switch, a jar edited in its sheet
// (37 °C silver nitrate: "Partly unknown"), an extra tap-water jar ("Currently unknown reaction"), the mode
// switch back to Practice; the Mix panel is gone (its settings are the jars' fields).
// Acceptance checks (PLAN-ALZ-LAB-SIMPLIFY §8, the mechanically checkable ones): home -> a resolved
// standard run in <= 5 clicks; at 1280x800 the enabled controls above the fold on the bench while
// steps remain are <= 5 in list mode and <= 6 in 3D, and <= 5 after a run in both; no engine
// identifier in the visible text outside
// <details> on home, How this lab works, the bench, every activity screen, the microscope, the
// designer (before and after the reveal) and the report; every simulated output keeps a badge
// carrying data-lab-label; the designer reveal states the chosen contrast measure for both runs and
// the report export carries the designer lines (ENGINE-9). Desktop (1280x800) and phone (390x844,
// touch); viewport screenshots only
// (tall full-page captures crash SwiftShader's GPU process) in
// output/playwright/lab-smoke-<step>-<width>.png.
//
//   node scripts/run-browser-tests.mjs smoke-lab                        # harness serves on 8805
//   CORTEX_URL=http://127.0.0.1:8765/ node scripts/smoke-lab.mjs         # against `npm run serve`
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';

const APP_VERSION =
  (readFileSync(new URL('../app.js', import.meta.url), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || '';
const base = new URL(process.env.CORTEX_URL || 'http://127.0.0.1:8805/');
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(base.hostname);
const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
];
// Byte-identical to SECTION_INFO.lab.label (app.js), the lab track's name (academy.js) and LAB_TITLE (lab.js).
const LABEL = "Alzheimer's Histology Lab";
const STATE_KEY = 'cs-lab-state-v1';
// Engine labels (data-lab-label on every badge that sits on an engine output) and the export wording
// fixed by context/ALZ-LAB-CONTRACT.md §5.
const SYNTHETIC_LABEL = 'illustrative-synthetic';
const SYNTHETIC = 'Illustrative simulation (synthetic, not a measurement)';
const SIMULATED_WORDS = 'Simulated · not a measurement';
const DISCLAIMER = 'Simulated outputs in this document are illustrative predictions';
const TAGS = ['[Published]', '[Observed]', '[Simulated: illustrative, not a measurement]', '[Reflection]'];
const TAG_WORDS = ['Published', 'Observed', 'Simulated', 'Reflection'];
// Files only the lab ships. None may be requested while the gate is up; lab.css is linked site-wide.
const LAB_ASSETS =
  /\/(lab|lab-microscope|lab-notebook|silver-lab-core)\.js(?:\?|$)|\/data\/lab\/|\/lab-3d\/|\/assets\/three\/|\/lab-(?:microscope|notebook)\.css/;
// Digits followed by a unit would mean a calibrated time, temperature or amount: the curves have none.
const DIGITS_WITH_UNITS = /\b\d+(?:\.\d+)?\s?(?:s|sec|seconds|min|minutes|h|hr|hours|°C|%|mM|M|µm|um|nm|mL|ml|mg|g)\b/;
// Engine identifiers a student never reads outside Why? / Sources / History / All settings (PLAN §4 rule a).
const ENGINE_IDS =
  /\b(R-[a-z]+-\d|C-[a-z0-9-]+|S-[a-z0-9-]+|SPEC-[A-Z0-9-]+|sop-default|step-skipped|param-uncovered|PENDING-EHS)\b/g;
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

const lab = (query = {}) => {
  const url = new URL('/lab', base);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.href;
};
const prod = path => new URL(path + (path.includes('?') ? '&' : '?') + 'gates=prod', base).href;
const text = async locator => ((await locator.textContent()) || '').trim();
// Viewport capture once the page has stopped scrolling: the site scrolls smoothly, and a capture
// taken mid-scroll shows the sticky header displaced over a blank band.
const settled = page =>
  page.waitForFunction(
    () =>
      new Promise(done => {
        const y = scrollY;
        setTimeout(() => done(scrollY === y), 150);
      })
  );
const shot = async (page, step, width) => {
  await settled(page);
  await page.screenshot({ path: `output/playwright/lab-smoke-${step}-${width}.png` });
};
const getState = page => page.evaluate(() => window.CortexLab.getState());
const noOverflow = async (page, label) => {
  const overflow = await page.evaluate(
    () => document.scrollingElement.scrollWidth - document.documentElement.clientWidth
  );
  assert.ok(overflow <= 1, `${label}: horizontal overflow of ${overflow}px`);
};
const oneH1 = async (page, label) => assert.equal(await page.locator('h1').count(), 1, `${label}: exactly one h1`);
// Focus is never dropped to the page body after a re-render.
const focusKept = async (page, label) => {
  const active = await page.evaluate(() => {
    const a = document.activeElement;
    return !a || a === document.body ? 'body' : `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}`;
  });
  assert.notEqual(active, 'body', `${label}: focus dropped to the page body`);
  return active;
};
// REF (contract §12.3): a single finished run with a matching real photo opens on the Real slide view; the
// steps that read the drawing (Measure, the layers, the canvas census) switch to Drawing (simulation) first
// when the switch is offered, then wait for the canvas either way.
const drawingView = async (page, host = '#lab-scope-host') => {
  const btn = page.locator(`${host} [data-labm-view="drawing"]`);
  if (await btn.count()) await btn.first().click();
  await page.waitForSelector(`${host} .labm canvas`);
};
// Engine identifiers in the visible text outside <details> (closed and open), visually hidden text included.
const engineIds = page =>
  page.evaluate(source => {
    const style = document.createElement('style');
    style.textContent = 'details { display: none !important; }';
    document.head.appendChild(style);
    const visible = document.body.innerText;
    style.remove();
    return [...visible.matchAll(new RegExp(source, 'g'))].map(m =>
      visible.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\s+/g, ' ')
    );
  }, ENGINE_IDS.source);
const noEngineIds = async (page, label) => assert.deepEqual(await engineIds(page), [], `${label}: engine identifiers`);
// Enabled buttons, links, selects and inputs in <main> whose box starts above the fold (scrolled to the
// top), outside closed <details> and hidden parts.
const controlsAboveFold = page =>
  page.evaluate(() => {
    scrollTo({ top: 0, behavior: 'instant' });
    return [...document.querySelectorAll('main button, main a[href], main select, main input, main textarea')]
      .filter(n => !n.closest('.lab-nav')) // FREE-1: the nav line is navigation, not a bench control
      .filter(n => {
        const r = n.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.height > 0 &&
          r.top < innerHeight &&
          !n.disabled &&
          !n.closest('[hidden], details:not([open])') &&
          getComputedStyle(n).visibility !== 'hidden'
        );
      })
      .map(
        n =>
          `${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}: ${(n.textContent || n.value || '').trim().slice(0, 40)}`
      );
  });
// FIX5 I2: "Back to my station" (#lab-recenter) is a control: a budget grows by one only while it shows.
const recenterShown = page =>
  page.evaluate(() => {
    const b = document.querySelector('#lab-recenter');
    return b && !b.hidden && b.getBoundingClientRect().top < innerHeight ? 1 : 0;
  });
// Every simulated output on the page keeps its badge with the engine label (PLAN §8.4).
const labeledOutputs = page =>
  page.evaluate(() => {
    const groups = {
      '.lab-result-card': '.lab-badge[data-lab-label]',
      '.lab-curves': '[data-lab-label]',
      '.labm': '[data-labm-banner] [data-lab-label]',
      '.labn-card': '[data-lab-badge][data-lab-label]',
      '[data-labn-measures-out]': '[data-lab-badge][data-lab-label]',
      '[data-labn-work]': '[data-lab-badge][data-lab-label]',
      '.labn-entry[data-labn-type="simulated"]': '[data-lab-badge][data-lab-label]',
    };
    const missing = [];
    let outputs = 0;
    for (const [output, badge] of Object.entries(groups))
      for (const node of document.querySelectorAll(output)) {
        outputs++;
        if (!node.querySelector(badge)) missing.push(`${output}: ${node.textContent.trim().slice(0, 60)}`);
      }
    return { outputs, missing };
  });
const allLabeled = async (page, label) => {
  const found = await labeledOutputs(page);
  assert.ok(found.outputs > 0, `${label}: a simulated output is on the page`);
  assert.deepEqual(found.missing, [], `${label}: every simulated output carries data-lab-label`);
  return found.outputs;
};
// Tissue clip (contract §7.1): the bench handle's clipState(), the transcript marker, and settling.
const clipState = page => page.evaluate(() => window.LAB.bench.clipState());
const currentScene = page => page.getAttribute('#lab-clip-transcript li[aria-current="step"]', 'data-lab-scene');
// The descend, fly and dip transitions change clipState() after a handle call has returned: wait
// for the keys of `want` to match.
async function clipStateIs(page, want, label) {
  try {
    await page.waitForFunction(
      want => {
        const s = window.LAB.bench && window.LAB.bench.clipState ? window.LAB.bench.clipState() : null;
        return !!s && Object.entries(want).every(([key, value]) => s[key] === value);
      },
      want,
      { timeout: 20000 }
    );
  } catch {
    assert.fail(`${label}: clipState() ${JSON.stringify(await clipState(page))} never reached ${JSON.stringify(want)}`);
  }
}
// SwiftShader can hand back a blank frame while the pale dip overlay of a tissue transition renders:
// wait for the dip to clear and two frames to draw before a clip capture.
const clipSettled = async page => {
  await page.waitForFunction(() => window.LAB.bench.debug.clip.dip() === 0, null, { timeout: 10000 });
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
};
// UX-R2-lab.js-1: the header's Run menu (a disclosure) holds New run, History and the safety notes.
const openRunMenu = async page => {
  if ((await page.getAttribute('#lab-run-menu-btn', 'aria-expanded')) !== 'true') await page.click('#lab-run-menu-btn');
  await page.waitForSelector('#lab-run-menu:not([hidden])');
};
// UX-R2-lab.js-2 / MODE §11.2: in 3D one "3D options" disclosure under the stage holds Play the intro,
// Reduce motion and Read aloud (the stations are the row under the stage); an open drawer stays open
// across a redraw, so close it before a fold count.
const open3dOptions = async (page, open = true) => {
  const button = '[data-lab-drawer="3d-options"] > .lab-drawer-btn';
  if ((await page.getAttribute(button, 'aria-expanded')) !== String(open)) await page.click(button);
  await page.waitForSelector('#lab-clip-intro', { state: open ? 'visible' : 'hidden' });
};
// MODE §11.2: the station row's current button (aria-current) names where the camera is.
const stationNamed = page =>
  page.evaluate(() => {
    const b = document.querySelector('#lab-stations .lab-station-btn[aria-current="true"]');
    return b ? b.dataset.labStation : '';
  });
// MODE §11.2: the station row's buttons sit under the 3D stage, so a 3D first-view budget grows by the
// nine of them (eight stations plus Whole bench): they are the way across the bench, in reach.
const STATION_BUTTONS = 9;
// SHELF (§13.3): the mode switch (two buttons, always at the top of the bench) and a finished practice run's
// New slide are controls too: a budget grows by them while they are above the fold (measured at the top,
// after controlsAboveFold scrolled there).
const shelfShown = page =>
  page.evaluate(
    () =>
      [...document.querySelectorAll('#lab-mode-switch button, #lab-do-status #lab-new-slide')].filter(b => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top < innerHeight && !b.disabled;
      }).length
  );
// The page scroll and the camera's distance from its orbit target (the bench's debug hook).
const benchView = page =>
  page.evaluate(() => {
    const debug = window.LAB.bench.debug;
    const [p, t] = [debug.cameraPosition(), debug.target()];
    return { y: scrollY, d: Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]) };
  });
const ZOOM_HINT = 'Hold Ctrl (⌘ on Mac) and scroll to zoom';
// Pixel census of a simulation canvas as fractions of the sampled pixels: a stain is a warm paper
// field (light, red well above blue) carrying brown tint shapes, or, for a gold-toned run (MODE-micro-1:
// the gray-black family), gray deposit shapes (mid-dark, red and blue alike).
const census = (page, selector) =>
  page.evaluate(sel => {
    const canvas = document.querySelector(sel);
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let paper = 0,
      stain = 0,
      gray = 0,
      inked = 0,
      samples = 0;
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      samples++;
      if (r > 180 && r - b >= 10) paper++;
      else if (r - b > 24) stain++;
      else if (Math.abs(r - b) <= 16 && r + g + b > 150 && r + g + b < 600) gray++;
      if (r + g + b < 720) inked++;
    }
    return {
      paper: paper / samples,
      stain: stain / samples,
      gray: gray / samples,
      inked: inked / samples,
      width: canvas.width,
    };
  }, selector);
// The engine test's mechanical check (contract §6 test 13): no line of a simulated entry, nor its
// indented continuation lines, says "result" unless it says "simulated result".
function resultOnSimulatedLines(markdown) {
  const offenders = [];
  let inSimulated = false;
  for (const line of markdown.split('\n')) {
    if (/^\s*(- )?\[Simulated: illustrative, not a measurement\]/.test(line)) inSimulated = true;
    else if (!/^\s{2,}\S/.test(line)) inSimulated = false;
    if (inSimulated && /\bresults?\b/i.test(line.replace(/simulated results?/gi, ''))) offenders.push(line);
  }
  return offenders;
}
const sentences = line => line.split(/(?<=[.!?])\s+/).filter(Boolean).length;
// UX-LAST (ENGINE-13): the downloaded file read the way a CommonMark viewer reads it. Every list (one
// kind: bullets or numbers) has a blank line before and after it, an indented line belongs to a list,
// and below "## Experiment log" no field is a bare "Field: value" line (a viewer folds those into one
// paragraph). Returns the offending lines.
function markdownProblems(markdown) {
  const lines = markdown.split('\n'),
    kindOf = l => (/^- /.test(l) ? 'bullet' : /^\d+\. /.test(l) ? 'number' : null),
    problems = [];
  let open = null;
  lines.forEach((line, n) => {
    const kind = kindOf(line),
      at = `line ${n + 1}: ${line}`;
    if (kind) {
      if (open === null && n > 0 && lines[n - 1] !== '') problems.push(`no blank line before the list, ${at}`);
      if (open !== null && kind !== open) problems.push(`two kinds of list, ${at}`);
      open = kind;
    } else if (/^ {2,}\S/.test(line)) {
      if (open === null) problems.push(`an indented line outside a list, ${at}`);
    } else if (line === '') open = null;
    else if (open !== null) problems.push(`no blank line after the list, ${at}`);
  });
  const log = lines.indexOf('## Experiment log');
  if (log < 0) problems.push('no Experiment log');
  else
    for (const line of lines.slice(log)) if (/^[A-Z][A-Za-z ()/]*: /.test(line)) problems.push(`a bare field: ${line}`);
  return problems;
}
// No claim (C-), source (S-) or rule (R-) id and no strength code before "## Model detail (for instructors)".
function studentPartProblems(markdown, codes) {
  const code = new RegExp(`\\b(${codes.join('|')})\\b`);
  return markdown
    .split('\n## Model detail (for instructors)\n')[0]
    .split('\n')
    .filter(l => /\b[CSR]-[A-Za-z0-9]/.test(l) || code.test(l));
}
// The Model readout's words for two contrasts on the model scale (ENGINE-13; same method).
const STEP_WORDS = ['no', 'one', 'two', 'three', 'four'];
const readoutText = ([b, x], words) => {
  const d = Math.abs(x - b);
  return d
    ? `${words[b]} in the baseline, ${words[x]} in the experimental run (${x > b ? 'up' : 'down'} ${STEP_WORDS[d]} ${d === 1 ? 'step' : 'steps'} on the model scale)`
    : `${words[b]} in both runs (no change on the model scale)`;
};

// The saved list start the journeys begin from (open() writes the same JSON in the page); the gate check
// accepts exactly this, untouched.
const LIST_SEED = JSON.stringify({ v: 1, mode: 'list', modeChosen: true, runs: {}, runOrder: [] });
async function open(browser, viewport, { noWebgl = false, flagsOff = false, startMode = 'list', ...options } = {}) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: !!viewport.isMobile,
    hasTouch: !!viewport.hasTouch,
    acceptDownloads: true,
    ...options,
  });
  // serve.py answers the proxied visitor counter with 404 on purpose; keep that out of the console.
  await context.route('**/cx-visits/**', r => r.fulfill({ contentType: 'application/json', body: '{"value":0}' }));
  await context.addInitScript(version => localStorage.setItem('cs-seen-ver', version), APP_VERSION);
  // 3D is the bench's default since 2026-10-13. The journeys below were written from the list start, so
  // they begin with list as a saved choice; `startMode: null` is a fresh visitor (the 3D-default check).
  if (startMode)
    await context.addInitScript(mode => {
      if (localStorage.getItem('cs-lab-state-v1') === null)
        localStorage.setItem(
          'cs-lab-state-v1',
          JSON.stringify({ v: 1, mode, modeChosen: true, runs: {}, runOrder: [] })
        );
    }, startMode);
  // BENCH-1: the activities, designer and report pages are off by default; the smoke keeps them covered.
  if (!flagsOff)
    await context.addInitScript(() => {
      window.LAB_FLAGS = { activities: true, designer: true, report: true };
    });
  if (noWebgl)
    await context.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (type === 'webgl2' || type === 'webgl') return null;
        return getContext.call(this, type, ...rest);
      };
    });
  const page = await context.newPage();
  const errors = [],
    labAssets = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('request', r => {
    if (LAB_ASSETS.test(r.url())) labAssets.push(r.url());
  });
  const clean = label => assert.deepEqual(errors, [], `${viewport.name} ${label}: browser errors`);
  return { context, page, errors, labAssets, clean };
}

// Safety gate only: the bench shows it before anything else; acknowledge, wait for the state flag.
async function acknowledge(page) {
  await page.goto(lab({ view: 'bench' }), { waitUntil: 'networkidle' });
  await page.waitForSelector('main.lab-view-bench h1', { timeout: 15000 });
  await page.click('#lab-safety-ack');
  // The acknowledged card sits in the closed Run menu (UX-R2-lab.js-1).
  await page.waitForSelector('[data-lab-safety="acknowledged"]', { state: 'attached' });
}

// Safety gate, then the bench with one fresh run on the default specimen (list mode).
async function acknowledgeAndCreateRun(page) {
  await acknowledge(page);
  await page.waitForSelector('#lab-newrun-create');
  await page.click('#lab-newrun-create');
  await page.waitForSelector('#lab-do-step');
}

mkdirSync('output/playwright', { recursive: true });
const browser = await chromium.launch({ headless: true, args: GL_ARGS });
const results = {};
try {
  if (LOCAL) {
    // GPU warm-up: the very first context of a fresh headless browser can answer no WebGL2 once, and
    // lab.js caches its probe per page.
    {
      const warm = await browser.newContext();
      const page = await warm.newPage();
      await page.goto(lab(), { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
      await page.waitForTimeout(500);
      await warm.close();
    }

    // 9. 3D bench (desktop only), in a fresh context before anything else renders.
    {
      const viewport = viewports[0];
      const { context, page, clean } = await open(browser, viewport);
      const record = (results['3d'] = {});
      await acknowledgeAndCreateRun(page);
      record.webgl2 = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
      assert.ok(record.webgl2, '3D: headless Chromium answers WebGL2 through SwiftShader');
      // ONE view toggle (UX-R2-lab.js-1): it names the view it switches to; data-lab-mode is that target.
      record.toggle = [await page.locator('[data-lab-mode]').count(), await text(page.locator('#lab-mode-toggle'))];
      assert.deepEqual(record.toggle, [1, 'Switch to 3D'], '3D: one view toggle, naming the view it opens');
      await page.click('[data-lab-mode="3d"]');
      await page.waitForSelector('#lab-bench-3d canvas', { timeout: 60000 });
      await page.waitForSelector('.lab-stage-live', { timeout: 60000 });
      assert.equal(await text(page.locator('#lab-mode-toggle[data-lab-mode="list"]')), 'Switch to list');
      record.canvasHidden = await page.getAttribute('#lab-bench-3d canvas', 'aria-hidden');
      assert.equal(record.canvasHidden, 'true', '3D: the canvas is aria-hidden');
      // MODE §11.2: the station row (nine buttons, student titles, no step numbers) directly under the stage
      // (MODE-FIX-shell-16: after the stage's layout, outside its group #lab-clip-stage, so the clip keys
      // never describe the row).
      record.stationRow = await page.evaluate(() => {
        const nav = document.querySelector('#lab-stations');
        return {
          ids: [...nav.querySelectorAll('.lab-station-btn')].map(b => b.dataset.labStation),
          titles: [...nav.querySelectorAll('.lab-station-btn')].map(b => b.textContent.trim()),
          underStage:
            nav.previousElementSibling.classList.contains('lab-clip-layout') && !nav.closest('[role="group"]'),
          aboveHud: nav.nextElementSibling.hasAttribute('data-lab-hud'),
          select: document.querySelectorAll('#lab-station-select, #lab-overlay').length,
        };
      });
      assert.deepEqual(
        record.stationRow,
        {
          ids: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'overview'],
          titles: [
            'Remove the wax',
            'First silver bath',
            'Ammoniacal silver and develop',
            'Gold and thiosulfate',
            'Dehydrate and mount',
            'Microscope',
            'Waste and safety',
            'Notebook',
            'Whole bench',
          ],
          underStage: true,
          aboveHud: true,
          select: 0,
        },
        '3D: the station row sits directly under the stage, above the HUD'
      );
      const station = async () => [
        await stationNamed(page),
        await page.evaluate(() => window.LAB.bench.debug.currentStation()),
      ];
      // MODE §11.1: no pick list anywhere (no "Do a different step"): the Explain sheet explains only.
      await page.click('#lab-explain-open');
      await page.waitForSelector('#lab-sheet:not([hidden])');
      record.pickButtons = await page
        .locator('#lab-sheet [data-lab-drawer="pick-step"], #lab-sheet [data-lab-perform]')
        .count();
      assert.equal(record.pickButtons, 0, '3D: no Do a different step in the sheet (§11.1)');
      await page.keyboard.press('Escape');
      await page.waitForSelector('#lab-sheet', { state: 'hidden' });
      record.status = await text(page.locator('#lab-3d-status'));
      assert.equal(record.status, '3D bench ready.');
      const eventsBefore = await page.evaluate(() => Object.values(window.CortexLab.getState().runs)[0].events.length);
      await page.click('#lab-do-step');
      await page.waitForFunction(
        n => Object.values(window.CortexLab.getState().runs)[0].events.length === n,
        eventsBefore + 1
      );
      record.doStepEvent = await page.evaluate(() => Object.values(window.CortexLab.getState().runs)[0].events.at(-1));
      assert.equal(record.doStepEvent.step, 'deparaffinize-rehydrate', '3D: Do this step appended the first step');
      assert.equal(await text(page.locator('#lab-do-count')), '1 of 9 done');
      // UX-POLISH-lab.js-7: History's log names each step the way the export does.
      record.firstStepTitle = await page.evaluate(() => window.CortexLab.stepTitle('deparaffinize-rehydrate'));
      assert.equal(record.firstStepTitle, 'Remove the wax and rehydrate');
      assert.ok(
        (await text(page.locator('#lab-history .lab-log-table'))).includes(record.firstStepTitle),
        '3D: the run log in History records the step'
      );
      // FIX2 E1: the rack stays at step 1's station (S1) and the next jar (step 2) stands at S2: the
      // camera frames both (frameStations) and the select names the last framed station.
      await page.waitForFunction(
        () => document.querySelector('#lab-stations [aria-current="true"]')?.dataset.labStation === 'S2'
      );
      record.followed = await station();
      assert.deepEqual(
        record.followed,
        ['S2', 'S2'],
        '3D: the camera frames the rack and the next jar; the row names it'
      );
      assert.equal(await focusKept(page, '3D Do this step'), 'button#lab-do-step', 'the primary keeps focus');
      // Mid-run in 3D (UX-R2 budget + the FREE-2 Notes toggle + the station row, §11.2): <= 7 + 9 enabled
      // controls above the fold at 1280x800.
      record.foldControls3dMid = await controlsAboveFold(page);
      assert.ok(
        record.foldControls3dMid.length <= 7 + STATION_BUTTONS + (await recenterShown(page)) + (await shelfShown(page)),
        `3D: <= ${7 + STATION_BUTTONS} enabled controls above the fold mid-run: ${JSON.stringify(record.foldControls3dMid)}`
      );
      await shot(page, '9-3d-mid', viewport.width);
      // SHELF (§13.3): the mode switch above Your slide can leave the row just under the fold at 800 px tall:
      // it comes into view first, so the check is the app's own scroll only.
      await page.locator('#lab-stations').scrollIntoViewIfNeeded();
      const scrollBefore = await page.evaluate(() => scrollY);
      await page.click('#lab-stations [data-lab-station="S3"]');
      await page.waitForFunction(() => window.LAB.bench.debug.currentStation() === 'S3');
      record.picked = await station();
      assert.deepEqual(record.picked, ['S3', 'S3'], '3D: a station button moves the camera and is marked current');
      assert.equal(await page.evaluate(() => scrollY), scrollBefore, '3D: the row never scrolls the page');
      // RC-2 (UX-R2-lab-3d-1, UX-R2-lab.js-3): a plain wheel over the stage scrolls the page and leaves
      // the camera distance alone, and the stage hint says how to zoom; Ctrl + wheel zooms without
      // scrolling and takes the hint away at once.
      await page.waitForFunction(() => window.LAB.bench.debug.raw().controls.enabled === true, null, {
        timeout: 15000,
      });
      const overStage = async () => {
        await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
        await settled(page);
        const box = await page.locator('#lab-bench-3d canvas').boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      };
      await overStage();
      const w0 = await benchView(page);
      await page.mouse.wheel(0, 400);
      await page.waitForFunction(y => scrollY > y, w0.y, { timeout: 5000 }).catch(() => {});
      await settled(page);
      const w1 = await benchView(page);
      record.wheel = { scrollY: [w0.y, w1.y], distance: [w0.d, w1.d] };
      assert.ok(
        w1.y > w0.y && Math.abs(w1.d - w0.d) < 1e-6,
        `3D: a plain wheel over the stage scrolls the page and leaves the camera distance: ${JSON.stringify(record.wheel)}`
      );
      await page.waitForSelector('#lab-stage-hint.lab-stage-hint-on');
      record.hint = await text(page.locator('#lab-stage-hint'));
      assert.equal(record.hint, ZOOM_HINT, '3D: the stage hint says how to zoom');
      await overStage();
      const w1top = await benchView(page);
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, 100);
      await page.keyboard.up('Control');
      await page.waitForFunction(d => {
        const debug = window.LAB.bench.debug;
        const [p, t] = [debug.cameraPosition(), debug.target()];
        return Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]) > d + 0.01;
      }, w1top.d);
      const w2 = await benchView(page);
      record.ctrlWheel = { scrollY: [w1top.y, w2.y], distance: [w1top.d, w2.d] };
      assert.equal(
        w2.y,
        w1top.y,
        `3D: Ctrl + wheel zooms without scrolling the page: ${JSON.stringify(record.ctrlWheel)}`
      );
      await page.waitForSelector('#lab-stage-hint:not(.lab-stage-hint-on)', { state: 'attached', timeout: 1000 });
      // Explain this step: the side sheet follows the next step; Esc closes it and returns focus.
      await page.click('#lab-explain-open');
      await page.waitForSelector('#lab-sheet:not([hidden])');
      record.sheet = await text(page.locator('#lab-sheet-h'));
      assert.equal(record.sheet, 'First silver bath', 'the sheet explains the next step');
      assert.equal(await focusKept(page, 'sheet'), 'h2#lab-sheet-h');
      await page.keyboard.press('Escape');
      await page.waitForSelector('#lab-sheet', { state: 'hidden' });
      assert.equal(await focusKept(page, 'sheet closed'), 'button#lab-explain-open');
      await noOverflow(page, '3D bench');
      await page.locator('#lab-do-h').scrollIntoViewIfNeeded();
      await shot(page, '9-3d', viewport.width);
      // A finished run in 3D: the plan's control budget (PLAN §8.3) holds on the first view too; the
      // 3D options (Go to station, Play the intro, Reduce motion) stay under the stage (UX-R2-lab.js-2).
      await page.click('#lab-run-all');
      await page.waitForSelector('#lab-resolve-out .lab-result-card');
      // UX-LAST-lab.js-6: finishing the run in 3D flies the camera to the microscope (S6), and Go to
      // station shows it.
      await page.waitForFunction(() => window.LAB.bench.debug.currentStation() === 'S6', null, { timeout: 15000 });
      record.finishedStation = await station();
      assert.deepEqual(record.finishedStation, ['S6', 'S6'], '3D: a finished run lands on the microscope (S6)');
      // UX-POLISH-lab.js-4: on a finished run a jar's double click records nothing; it opens that step's
      // sheet with the way to redo a step on purpose (Run menu > History > Redo a step).
      {
        const events = () => page.evaluate(() => Object.values(window.CortexLab.getState().runs)[0].events.length);
        const done = await events();
        const jar = await page.evaluate(() =>
          window.LAB.bench.hotspots().find(h => h.kind === 'step' && h.step === 'development')
        );
        await page.evaluate(id => window.LAB.bench.goToStation(id), jar.station);
        await page.waitForFunction(id => window.LAB.bench.debug.currentStation() === id, jar.station);
        await page.waitForFunction(() => window.LAB.bench.debug.raw().controls.enabled === true, null, {
          timeout: 15000,
        });
        await page.locator('#lab-bench-3d canvas').scrollIntoViewIfNeeded();
        await settled(page);
        const at = await page.evaluate(id => window.LAB.bench.debug.projectHotspot(id), jar.id);
        assert.ok(
          at && at.depth < 1 && at.x > 0 && at.x < viewport.width && at.y > 0 && at.y < viewport.height,
          `the development jar projects into the viewport: ${JSON.stringify(at)}`
        );
        await page.mouse.dblclick(at.x, at.y);
        await page.waitForSelector('#lab-sheet:not([hidden]) .lab-sheet-finished', { timeout: 5000 });
        await page.waitForTimeout(600); // past the jar sheet's 300 ms and the bench's double-click window
        record.finishedJar = {
          sheet: await text(page.locator('#lab-sheet-h')),
          line: await text(page.locator('#lab-sheet .lab-sheet-finished')),
          events: [done, await events()],
        };
        assert.deepEqual(
          record.finishedJar,
          {
            sheet: await page.evaluate(() => window.CortexLab.stepTitle('development')),
            line: 'This run is finished. New run (in the Run menu) starts another.',
            events: [done, done],
          },
          '3D: a jar double click on a finished run opens its sheet and records nothing'
        );
        await page.keyboard.press('Escape');
        await page.waitForSelector('#lab-sheet', { state: 'hidden' });
        await shot(page, '9-3d-finished-jar', viewport.width);
      }
      await open3dOptions(page, false);
      record.foldControls3d = await controlsAboveFold(page);
      assert.ok(
        record.foldControls3d.length <= 6 + STATION_BUTTONS + (await recenterShown(page)) + (await shelfShown(page)),
        `3D: <= ${6 + STATION_BUTTONS} enabled controls above the fold after a run: ${JSON.stringify(record.foldControls3d)}`
      );
      assert.ok(
        await page.locator('#lab-do #lab-stations:not([hidden]) .lab-station-btn').count(),
        '3D: the station row stays under the stage after a run'
      );
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForSelector('main.lab-view-bench[data-mode="3d"] .lab-stage-live', { timeout: 60000 });
      await page.waitForSelector('#lab-resolve-out .lab-result-card');
      record.foldControls3dReload = await controlsAboveFold(page);
      assert.ok(
        record.foldControls3dReload.length <=
          6 + STATION_BUTTONS + (await recenterShown(page)) + (await shelfShown(page)),
        `3D reloaded: <= ${6 + STATION_BUTTONS} enabled controls above the fold: ${JSON.stringify(record.foldControls3dReload)}`
      );
      await shot(page, '9-3d-top', viewport.width);
      await page.click('[data-lab-mode="list"]');
      await page.waitForSelector('main.lab-view-bench[data-mode="list"] .lab-step');
      record.afterList = await page.evaluate(() => ({
        bench: window.LAB.bench,
        stage: document.querySelectorAll('#lab-bench-3d, #lab-bench-3d canvas').length,
        canvases: document.querySelectorAll('canvas:not(.lab-result-canvas)').length,
      }));
      assert.deepEqual(record.afterList, { bench: null, stage: 0, canvases: 0 }, '3D: list mode releases the renderer');
      clean('3D bench');
      await context.close();
    }

    // 9b. Without WebGL the 3D button is disabled with a reason and list mode still works.
    {
      const viewport = viewports[0];
      const { context, page, clean } = await open(browser, viewport, { noWebgl: true });
      const record = (results.noWebgl = {});
      await acknowledge(page);
      await page.waitForSelector('[data-lab-mode="3d"]');
      record.disabled = await page.locator('[data-lab-mode="3d"]').isDisabled();
      record.reason = await text(page.locator('.lab-mode-reason'));
      assert.ok(
        record.disabled && /no WebGL2/.test(record.reason),
        `no WebGL: 3D disabled with a reason: ${record.reason}`
      );
      await page.click('#lab-newrun-create');
      await page.click('#lab-do-step');
      await page.waitForSelector('.lab-step.lab-step-done');
      record.stepsDone = await page.locator('.lab-step.lab-step-done').count();
      assert.equal(record.stepsDone, 1, 'no WebGL: list mode performs a step');
      clean('no WebGL');
      await context.close();
    }

    // 9c. UX-SMALL-lab.js-2: at a non-emulated 390x844 (SwiftShader keeps WebGL2 there) "Do this step"
    // stays in the flow under the 3D stage: scrolling through the bench mid-run, its box never overlaps
    // the stage's.
    {
      const viewport = { name: 'phone-3d', width: 390, height: 844 };
      const { context, page, clean } = await open(browser, viewport);
      const record = (results.phone3d = {});
      await acknowledgeAndCreateRun(page);
      await page.click('[data-lab-mode="3d"]');
      await page.waitForSelector('#lab-bench-3d canvas', { timeout: 60000 });
      await page.waitForSelector('.lab-stage-live', { timeout: 60000 });
      await page.click('#lab-do-step');
      await page.waitForFunction(() => document.querySelector('#lab-do-count').textContent.trim() === '1 of 9 done');
      const boxesAt = top =>
        page.evaluate(async y => {
          scrollTo({ top: y, behavior: 'instant' });
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          const a = document.querySelector('#lab-bench-3d').getBoundingClientRect(),
            b = document.querySelector('#lab-do-step').getBoundingClientRect();
          const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)),
            h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          const seen = r => r.bottom > 0 && r.top < innerHeight;
          return {
            y: Math.round(scrollY),
            stage: [Math.round(a.top), Math.round(a.bottom)],
            bar: [Math.round(b.top), Math.round(b.bottom)],
            overlap: Math.round(w * h),
            both: seen(a) && seen(b),
          };
        }, top);
      const max = await page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight);
      const stageTop = await page.evaluate(
        () => document.querySelector('#lab-bench-3d').getBoundingClientRect().top + scrollY
      );
      const tops = new Set([0, max]);
      for (let y = 0; y < max; y += 120) tops.add(y);
      for (const d of [-400, -200, -100, 0, 100, 200, 300])
        tops.add(Math.max(0, Math.min(max, Math.round(stageTop + d))));
      const samples = [];
      for (const y of [...tops].sort((a, b) => a - b)) samples.push(await boxesAt(y));
      record.sampled = samples.length;
      record.together = samples.filter(x => x.both).length;
      record.overlaps = samples.filter(x => x.overlap > 0);
      assert.deepEqual(record.overlaps, [], '390 px 3D: "Do this step" never overlaps the stage');
      assert.ok(record.together > 0, `390 px 3D: the stage and the bar on screen together: ${JSON.stringify(samples)}`);
      await noOverflow(page, '390 px 3D bench');
      await boxesAt(Math.max(0, Math.round(stageTop - 120)));
      await settled(page);
      await shot(page, '9c-3d-mid-scroll', viewport.width);
      // MODE §11.2: the station row scrolls sideways below 640 px; with 3D options open the page is no
      // wider than the screen.
      await open3dOptions(page);
      await page.locator('#lab-stations').scrollIntoViewIfNeeded();
      record.stationRowScrolls = await page.evaluate(() => {
        const nav = document.querySelector('#lab-stations');
        return { overflowX: getComputedStyle(nav).overflowX, scrolls: nav.scrollWidth > nav.clientWidth };
      });
      assert.deepEqual(
        record.stationRowScrolls,
        { overflowX: 'auto', scrolls: true },
        '390 px: the station row scrolls sideways'
      );
      record.optionsOverflow = await page.evaluate(
        () => document.scrollingElement.scrollWidth - document.documentElement.clientWidth
      );
      await noOverflow(page, '390 px 3D options open');
      await shot(page, '9c-3d-options', viewport.width);
      clean('390 px 3D bench');
      await context.close();
    }

    // 9d. The same at a non-emulated 320x640 (WebGL2): 3D mid-run with 3D options open, no overflow.
    {
      const viewport = { name: 'narrow-3d', width: 320, height: 640 };
      const { context, page, clean } = await open(browser, viewport);
      const record = (results.narrow3d = {});
      await acknowledgeAndCreateRun(page);
      await page.click('[data-lab-mode="3d"]');
      await page.waitForSelector('#lab-bench-3d canvas', { timeout: 60000 });
      await page.waitForSelector('.lab-stage-live', { timeout: 60000 });
      await page.click('#lab-do-step');
      await page.waitForFunction(() => document.querySelector('#lab-do-count').textContent.trim() === '1 of 9 done');
      await open3dOptions(page);
      await page.locator('#lab-stations').scrollIntoViewIfNeeded();
      record.overflow = await page.evaluate(
        () => document.scrollingElement.scrollWidth - document.documentElement.clientWidth
      );
      await noOverflow(page, '320 px 3D options open');
      await shot(page, '9d-3d-options', viewport.width);
      clean('320 px 3D options');
      await context.close();
    }

    // 15. Tissue clip inside the bench (contract §7 and §7.1; deviations SHELL-8, 3D-4, UX-B-8). clip.json
    // is the caption source; the 3D parts run on the desktop viewport only.
    const clipJson = await (await fetch(new URL('/data/lab/clip.json', base))).json();
    const sceneIds = clipJson.items.map(s => s.id);
    const BENCH_INTRO = { view: 'bench', mode: '3d', intro: '1' };
    // The home card names the intro's length from clip.json (every scene before the dive, to five seconds).
    const introAt = clipJson.items.findIndex(s => s.id === 'dive');
    const introMs = clipJson.items.slice(0, introAt).reduce((sum, s) => sum + (Number(s.durationMs) || 0), 0);
    const introLabel =
      Math.round(introMs / 5000) * 5 ? `Watch the ${Math.round(introMs / 5000) * 5}-second intro` : 'Watch the intro';
    results.clip = { scenes: sceneIds };

    // 15a. Home: the intro is the first card, with no safety gate on home; M1: the clip step is step 1.
    for (const viewport of viewports) {
      const { context, page, clean } = await open(browser, viewport);
      const record = (results.clip[viewport.name] = {});
      await page.goto(lab({ view: 'bench' }), { waitUntil: 'networkidle' });
      await page.waitForSelector('main.lab-view-bench .lab-nav', { timeout: 15000 });
      // FREE-1: the intro link sits first on the bench nav. With WebGL2 it plays the 3D intro; without it
      // (phones under emulation, offline) it opens the intro as text, never a dead end (phone re-walk blocker).
      record.webgl2 = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
      if (record.webgl2) {
        record.watch = await text(page.locator('#lab-clip-watch'));
        assert.equal(record.watch, introLabel);
        record.watchHref = await page.getAttribute('#lab-clip-watch', 'href');
        assert.equal(record.watchHref, '/lab?view=bench&mode=3d&intro=1', 'the nav link opens the bench intro');
      } else {
        assert.equal(await page.locator('#lab-clip-watch').count(), 0, 'no 3D intro link without WebGL2');
        record.watch = await text(page.locator('#lab-intro-text'));
        assert.equal(record.watch, 'Read the intro');
        record.watchHref = await page.getAttribute('#lab-intro-text', 'href');
        assert.equal(record.watchHref, '/lab?view=intro', 'the nav link opens the text intro');
        await page.click('#lab-intro-text');
        await page.waitForSelector('main.lab-view-intro h1');
        await oneH1(page, 'text intro');
        assert.equal(await text(page.locator('h1')), 'The intro, as text');
        assert.deepEqual(
          await page.$$eval('main.lab-view-intro .lab-clip-text li', lis => lis.map(li => li.dataset.labScene)),
          sceneIds,
          'the text intro lists every scene'
        );
        await noOverflow(page, 'text intro');
        await page.goto(lab({ view: 'bench' }), { waitUntil: 'networkidle' });
        await page.waitForSelector('main.lab-view-bench .lab-nav', { timeout: 15000 });
      }
      assert.equal(
        await page.getAttribute('.lab-nav a', 'id'),
        record.webgl2 ? 'lab-clip-watch' : 'lab-intro-text',
        'intro first'
      );
      await page.goto(lab(), { waitUntil: 'networkidle' });
      await page.waitForSelector('main.lab-view-home h1', { timeout: 15000 });
      assert.equal(await page.locator('main [data-lab-safety]').count(), 0, 'no safety gate on home');
      await page.goto(lab({ view: 'module:M1' }), { waitUntil: 'networkidle' });
      await page.waitForSelector('main.lab-view-module .lab-mstep');
      record.m1 = await page.evaluate(() => {
        const first = document.querySelector('main.lab-view-module .lab-mstep');
        return {
          clip: first.classList.contains('lab-mstep-clip'),
          step: first.querySelector('h2 .label').textContent.trim(),
          links: [...first.querySelectorAll('a')].map(a => [a.textContent.trim(), a.getAttribute('href')]),
        };
      });
      assert.ok(
        record.m1.clip && /^Step 1\b/.test(record.m1.step),
        `M1 step 1 is the clip step: ${JSON.stringify(record.m1)}`
      );
      assert.ok(
        record.m1.links.some(([label, href]) => label === 'Open the tissue clip' && /mode=3d&intro=1/.test(href)),
        `the M1 clip step opens the tissue clip: ${JSON.stringify(record.m1.links)}`
      );
      await noOverflow(page, 'module M1 clip step');
      clean('clip home and M1');
      await context.close();
    }

    // 15a2. A first-time visitor (nothing acknowledged): the requested intro plays above the safety
    // notes (PLAN §3.1, CC-7). Nothing that does a step is on the page until they are acknowledged, and
    // acknowledging builds the bench around the same 3D handle (no second load, no second intro).
    {
      const viewport = viewports[0];
      const { context, page, clean } = await open(browser, viewport);
      const record = (results.clip.beforeGate = {});
      await page.goto(lab(BENCH_INTRO), { waitUntil: 'networkidle' });
      await page.waitForSelector('main.lab-view-bench .lab-stage-live', { timeout: 60000 });
      await page.waitForSelector('#lab-intro.lab-bench-3d[data-lab-clip-phase="intro"]');
      await clipStateIs(page, { phase: 'intro', playing: true }, 'the intro plays before the safety notes');
      record.page = await page.evaluate(key => {
        const saved = JSON.parse(localStorage.getItem(key) || 'null');
        return {
          gate: document.querySelectorAll('#lab-bench-body [data-lab-safety="open"]').length,
          ack: !!document.querySelector('#lab-safety-ack'),
          stepControls: document.querySelectorAll(
            '#lab-do-step, #lab-run-all, .lab-step, #lab-newrun-create, #lab-stations:not([hidden]) button, #lab-free-dip'
          ).length,
          acknowledged: saved ? saved.safetyAcknowledgedAt || null : null,
        };
      }, STATE_KEY);
      assert.deepEqual(
        record.page,
        { gate: 1, ack: true, stepControls: 0, acknowledged: null },
        'the intro plays above the safety notes; no step can be done yet'
      );
      assert.equal(await text(page.locator('#lab-clip-play')), 'Pause');
      await oneH1(page, 'intro before the safety notes');
      await noEngineIds(page, 'intro before the safety notes');
      await noOverflow(page, 'intro before the safety notes');
      await shot(page, '15-intro-gate', viewport.width);
      await page.evaluate(() => {
        window.__introBench = window.LAB.bench;
      });
      await page.focus('#lab-clip-stage');
      await page.keyboard.press('s');
      await clipStateIs(page, { phase: 'bench', ended: true }, 'S ends the intro before the safety notes');
      await page.waitForSelector('#lab-clip-ended:not([hidden])');
      record.ended = await text(page.locator('#lab-clip-ended'));
      assert.equal(record.ended, 'Intro finished. The safety notes below open the bench.');
      await page.click('#lab-safety-ack');
      await page.waitForSelector('#lab-newrun-create');
      record.afterAck = await page.evaluate(() => ({
        sameBench: !!window.LAB.bench && window.LAB.bench === window.__introBench,
        phase: window.LAB.bench.clipState().phase,
        part: document.querySelectorAll('#lab-intro').length,
      }));
      assert.deepEqual(
        record.afterAck,
        { sameBench: true, phase: 'bench', part: 0 },
        'acknowledging keeps the same 3D bench and does not replay the intro'
      );
      clean('intro before the safety notes');
      await context.close();
    }

    // 15b. Desktop: ?mode=3d&intro=1 auto-plays the intro (captions, transcript, Space and S from the
    // stage wrapper); a run, the dive from the result card, Explore with the structure card, Esc, Back
    // to the bench, then the list-mode text.
    {
      const viewport = viewports[0];
      const { context, page, clean } = await open(browser, viewport);
      const record = (results.clip.bench = {});
      await acknowledge(page);
      await page.goto(lab(BENCH_INTRO), { waitUntil: 'networkidle' });
      await page.waitForSelector('main.lab-view-bench[data-mode="3d"] .lab-stage-live', { timeout: 60000 });
      record.url = page.url();
      assert.doesNotMatch(record.url, /[?&](mode|intro)=/, 'mode and intro are consumed from the URL');
      await page.waitForSelector('#lab-clip-controls:not([hidden])');
      await page.waitForSelector('.lab-bench-3d[data-lab-clip-phase="intro"]');
      await page.waitForFunction(() => (document.querySelector('#lab-clip-caption')?.textContent || '').trim() !== '');
      record.caption = await text(page.locator('#lab-clip-caption'));
      assert.equal(record.caption, clipJson.items[0].caption, 'the first caption is clip.json items[0]');
      record.transcript = await page
        .locator('#lab-clip-transcript li')
        .evaluateAll(nodes => nodes.map(n => n.dataset.labScene));
      assert.deepEqual(
        record.transcript,
        await page.evaluate(() => window.SilverLab.CLIP_SCENES),
        'ten transcript items in CLIP_SCENES order'
      );
      assert.deepEqual(record.transcript, sceneIds, 'clip.json items follow CLIP_SCENES');
      assert.equal(record.transcript.length, 10);
      record.firstScene = await currentScene(page);
      assert.equal(record.firstScene, 'brain-overview');
      assert.equal(await text(page.locator('#lab-clip-play')), 'Pause');
      assert.equal(await page.getAttribute('#lab-clip-play', 'aria-pressed'), null, 'the label is the state (F22)');
      await page.locator('#lab-clip-stage').scrollIntoViewIfNeeded();
      await noOverflow(page, 'clip intro');
      await shot(page, '15-intro', viewport.width);
      await page.evaluate(() => window.LAB.bench.debug.clip.setSpeed(5));
      await page.waitForFunction(
        prev => document.querySelector('#lab-clip-transcript li[aria-current="step"]')?.dataset.labScene !== prev,
        record.firstScene,
        { timeout: 15000 }
      );
      record.advancedTo = await currentScene(page);
      assert.ok(sceneIds.indexOf(record.advancedTo) > 0, `the transcript marker advanced: ${record.advancedTo}`);
      await page.focus('#lab-clip-stage');
      await page.keyboard.press('Space');
      await clipStateIs(page, { phase: 'intro', playing: false }, 'Space pauses the intro');
      await page.waitForFunction(() => document.querySelector('#lab-clip-play')?.textContent.trim() === 'Play');
      assert.equal(await page.getAttribute('#lab-clip-play', 'aria-pressed'), null);
      await page.keyboard.press('s');
      await page.waitForSelector('#lab-clip-loaded:not([hidden])', { timeout: 15000 });
      record.loaded = await text(page.locator('#lab-clip-loaded'));
      assert.ok(record.loaded.includes('Section on slide 1'), record.loaded);
      await clipStateIs(page, { phase: 'bench', ended: true, loaded: true }, 'S ends the intro on the bench');
      await page.waitForSelector('#lab-clip-controls', { state: 'hidden' });
      record.focusAfterIntro = await focusKept(page, 'the clip row hides');
      record.ended = await text(page.locator('#lab-clip-ended'));
      assert.equal(
        record.ended,
        'Intro finished. No run yet: Start the run is under Your slide, above.',
        'the intro ends with what the bench waits for (no order, D5)'
      );
      record.noRun = await text(page.locator('#lab-clip-note'));
      assert.equal(record.noRun, clipJson.noRunCaption, 'without a run the note prints noRunCaption');
      assert.equal(await page.locator('#lab-3d-norun').count(), 1, 'without a run the steps wait for one');
      clean('clip intro');

      // A run, every step, the S6 station, then Look into the tissue from the result card.
      await page.click('#lab-newrun-create');
      await page.waitForSelector('#lab-run-all:not([disabled])');
      assert.equal(
        await page.locator('#lab-clip-note, #lab-3d-norun').count(),
        0,
        'the no-run notices leave with a run'
      );
      await page.click('#lab-run-all');
      await page.waitForFunction(() => {
        const s = window.CortexLab.getState();
        return s.runOrder.length === 1 && s.runs[s.runOrder[0]].stepsDone.length === 9;
      });
      await page.waitForSelector('#lab-resolve-out .lab-result-card');
      await page.click('#lab-stations [data-lab-station="S6"]');
      await page.waitForFunction(() => window.LAB.bench.debug.currentStation() === 'S6');
      record.s6 = await page.evaluate(() => {
        const q = sel => document.querySelector(sel);
        return {
          dive: q('#lab-resolve-out #lab-clip-dive').textContent.trim(),
          diveDisabled: q('#lab-clip-dive').disabled,
          explore: [q('#lab-clip-explore').hidden, q('#lab-clip-explore').disabled],
          surface: [q('#lab-clip-surface').hidden, q('#lab-clip-surface').disabled],
        };
      });
      assert.deepEqual(
        record.s6,
        { dive: 'Look into the tissue', diveDisabled: false, explore: [true, true], surface: [true, true] },
        'the result card opens the dive; Explore and Back to the bench wait in the hidden clip row'
      );
      await page.evaluate(() => window.LAB.bench.debug.clip.setSpeed(1));
      await page.click('#lab-clip-dive');
      await clipStateIs(page, { phase: 'dive', scene: 'dive', playing: true }, 'Look into the tissue starts the dive');
      await page.waitForSelector('#lab-clip-controls:not([hidden])');
      // The dive scene fades the pale dip overlay out over its first third: pause once it is clear.
      await page.waitForFunction(() => window.LAB.bench.debug.clip.dip() === 0, null, { timeout: 15000 });
      await page.focus('#lab-clip-stage');
      await page.keyboard.press('Space');
      await clipStateIs(page, { phase: 'dive', playing: false }, 'Space pauses the dive');
      record.arrows = [];
      while ((await clipState(page)).scene !== 'structures') {
        assert.ok(record.arrows.length < 3, `ArrowRight reaches structures: ${record.arrows}`);
        const before = (await clipState(page)).scene;
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(prev => window.LAB.bench.clipState().scene !== prev, before, { timeout: 10000 });
        record.arrows.push((await clipState(page)).scene);
      }
      assert.ok(record.arrows.length >= 1, 'ArrowRight moved the paused dive on');
      assert.equal(await currentScene(page), 'structures', 'the transcript marker follows ArrowRight');
      await noOverflow(page, 'clip dive');
      await page.locator('#lab-clip-stage').scrollIntoViewIfNeeded();
      await clipSettled(page);
      await shot(page, '15-dive', viewport.width);
      await page.focus('#lab-clip-stage');
      await page.keyboard.press('s');
      await page.waitForSelector('#lab-clip-explore:not([disabled])', { timeout: 15000 });
      await clipStateIs(page, { phase: 'dive', scene: 'end', ended: true }, 'S ends the dive');
      await page.keyboard.press('e');
      await page.waitForSelector('.lab-bench-3d[data-lab-clip-phase="explore"]');
      assert.equal(await page.getAttribute('#lab-clip-explore', 'aria-pressed'), 'true');
      assert.equal(await text(page.locator('#lab-clip-explore')), 'Leave explore');
      // OrbitControls come back when the explore fly-in lands: project only then, so the click lands
      // on the structure the camera has settled on.
      await page.waitForFunction(() => window.LAB.bench.debug.raw().controls.enabled === true, null, {
        timeout: 15000,
      });
      await page.locator('#lab-clip-stage').scrollIntoViewIfNeeded();
      const inspect = async site => {
        const at = await page.evaluate(id => window.LAB.bench.debug.projectStructure(id), site);
        assert.ok(
          at && at.depth < 1 && at.x >= 0 && at.x <= viewport.width && at.y >= 0 && at.y <= viewport.height,
          `${site} projects into the viewport: ${JSON.stringify(at)}`
        );
        await page.mouse.click(at.x, at.y);
        await page
          .waitForSelector('#lab-clip-card:not([hidden])', { timeout: 10000 })
          .catch(() => assert.fail(`a click on the projected ${site} opens the structure card`));
        return text(page.locator('#lab-clip-card h3'));
      };
      record.inspected = ['plaque-core'];
      record.card = await inspect('plaque-core');
      // Picking from a projected point is approximate: a cell body can sit in front of the core, and
      // the cell body carries no modeled state. Retry other structures until a site card opens.
      for (const site of ['tangle', 'plaque-neurite', 'axon', 'neuropil-thread']) {
        if (!/cell body/.test(record.card)) break;
        await page.click('#lab-clip-card-close');
        await page.waitForSelector('#lab-clip-card[hidden]', { state: 'attached' });
        record.inspected.push(site);
        record.card = await inspect(site);
      }
      assert.match(record.card, /^Structure: /);
      assert.equal(await page.getAttribute('.lab-clip-layout', 'data-lab-clip-card'), 'open');
      record.cardWords = await page.locator('#lab-clip-card dd').allTextContents();
      const ordinal = await page.evaluate(() => window.SilverLab.ORDINAL_TEXT);
      assert.equal(record.cardWords.length, 3, 'three model-scale rows on the structure card');
      for (const word of record.cardWords) assert.ok(ordinal.includes(word), `${word} is an ORDINAL_TEXT word`);
      record.cardLabels = await text(page.locator('.lab-clip-card-labels'));
      assert.ok(record.cardLabels.includes(clipJson.label), `the card carries the clip label: ${record.cardLabels}`);
      assert.equal(
        await page.getAttribute('#lab-clip-card [data-lab-badge]', 'data-lab-label'),
        SYNTHETIC_LABEL,
        'the structure card carries the simulation badge'
      );
      await noOverflow(page, 'clip explore with the structure card');
      await clipSettled(page);
      await shot(page, '15-explore', viewport.width);
      await page.focus('#lab-clip-stage');
      // FIX5 I3: Escape with the card open closes only the card; the next Escape leaves explore.
      await page.keyboard.press('Escape');
      await page.waitForSelector('#lab-clip-card[hidden]', { state: 'attached' });
      await clipStateIs(page, { phase: 'explore' }, 'Esc closes only the structure card');
      await page.keyboard.press('Escape');
      await clipStateIs(page, { phase: 'dive' }, 'Esc leaves explore');
      await page.waitForSelector('.lab-bench-3d[data-lab-clip-phase="dive"]');
      assert.equal(await page.getAttribute('#lab-clip-explore', 'aria-pressed'), 'false');
      await page.click('#lab-clip-surface');
      await clipStateIs(page, { phase: 'bench' }, 'Back to the bench surfaces');
      await page.waitForSelector('.lab-bench-3d[data-lab-clip-phase="bench"]');
      assert.ok(await page.locator('#lab-clip-surface').isDisabled(), 'Back to the bench is disabled on the bench');
      assert.ok(await page.locator('#lab-clip-surface').isHidden(), 'and hidden with the clip row');
      record.focusAfterSurface = await focusKept(page, 'Back to the bench');
      clean('clip dive and explore');

      // List mode: the clip's captions as text behind Look into the tissue on the result card.
      await page.click('[data-lab-mode="list"]');
      await page.waitForSelector(
        'main.lab-view-bench[data-mode="list"] #lab-resolve-out [data-lab-drawer="tissue-text"]'
      );
      await page.click('#lab-resolve-out [data-lab-drawer="tissue-text"] .lab-drawer-btn');
      await page.waitForSelector('#lab-resolve-out .lab-clip-text');
      record.listHeading = await text(page.locator('#lab-resolve-out .lab-clip-text h3'));
      assert.equal(record.listHeading, 'What the tissue view shows');
      record.listScenes = await page.locator('#lab-resolve-out .lab-clip-text li').count();
      assert.equal(record.listScenes, 10, 'the list-mode text lists the ten scenes');
      clean('clip list mode');
      await context.close();
    }

    // 15c. Reduced motion: the storyboard starts paused (KB-13), plays and pauses from Play/Pause, and
    // steps with Previous / Next.
    {
      const { context, page, clean } = await open(browser, viewports[0], { reducedMotion: 'reduce' });
      const record = (results.clip.storyboard = {});
      await acknowledge(page);
      await page.goto(lab(BENCH_INTRO), { waitUntil: 'networkidle' });
      await page.waitForSelector('.lab-stage-live', { timeout: 60000 });
      await page.waitForSelector('.lab-bench-3d[data-lab-clip-phase="intro"]');
      record.prefers = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
      assert.ok(record.prefers, 'the context prefers reduced motion');
      await clipStateIs(page, { phase: 'intro', playing: false }, 'under reduced motion the intro starts paused');
      assert.equal(await text(page.locator('#lab-clip-play')), 'Play');
      record.reducedBox = await page.evaluate(() => {
        const box = document.querySelector('#lab-3d-reduced');
        return box ? [box.checked, box.disabled] : null;
      });
      assert.deepEqual(record.reducedBox, [true, true], 'Reduce motion is checked and fixed by the system setting');
      await page.click('#lab-clip-play');
      await clipStateIs(page, { phase: 'intro', playing: true }, 'Play plays the storyboard');
      await page.waitForFunction(() => document.querySelector('#lab-clip-play')?.textContent.trim() === 'Pause');
      await page.click('#lab-clip-play');
      await clipStateIs(page, { phase: 'intro', playing: false }, 'Play/Pause pauses the storyboard');
      await page.waitForFunction(() => document.querySelector('#lab-clip-play')?.textContent.trim() === 'Play');
      record.start = (await clipState(page)).scene;
      await page.click('#lab-clip-next');
      await page.waitForFunction(prev => window.LAB.bench.clipState().scene !== prev, record.start, { timeout: 20000 });
      record.next = (await clipState(page)).scene;
      assert.equal(
        sceneIds.indexOf(record.next),
        sceneIds.indexOf(record.start) + 1,
        `Next moves one scene on: ${record.start} -> ${record.next}`
      );
      assert.equal(await currentScene(page), record.next, 'the transcript marker follows Next');
      await page.click('#lab-clip-prev');
      await page.waitForFunction(prev => window.LAB.bench.clipState().scene === prev, record.start, { timeout: 20000 });
      assert.equal(await currentScene(page), record.start, 'the transcript marker follows Previous');
      clean('clip storyboard');
      await context.close();
    }

    // 15d. No WebGL: ?mode=3d&intro=1 stays in list mode with the reason.
    {
      const { context, page, clean } = await open(browser, viewports[0], { noWebgl: true });
      const record = (results.clip.noWebgl = {});
      await acknowledge(page);
      await page.goto(lab(BENCH_INTRO), { waitUntil: 'networkidle' });
      await page.waitForSelector('main.lab-view-bench[data-mode="list"]');
      record.reason = await text(page.locator('.lab-mode-reason'));
      assert.match(record.reason, /no WebGL2/, 'mode=3d without WebGL2 stays in list mode with the reason');
      record.mode = await page.evaluate(() => window.CortexLab.getState().mode);
      assert.equal(record.mode, 'list');
      clean('clip without WebGL');
      await context.close();
    }

    // 17. Run sealing (UX-POLISH-lab.js-1 to -3, UX-POLISH-notebook-4, UX-POLISH-verify-1, UX-LAST): the
    // designer's "Make the runs for me" with "Developer strength: weaker" reuses the finished standard run
    // the student has already seen as the baseline (it stays open) and makes and seals only the copy with
    // the change. Until the experiment is revealed nothing shows the copy's outcome: the bench (list and
    // 3D, no tissue dive), a comparison, History's replay, the microscope (the baseline's picture beside
    // the sealed card), the report's lab-work list, its note form and the exported file; a hand-made run
    // with the same change is a twin and sealed too. The reveal brings every one back, with the file's
    // Model readout (simulated). Desktop in full; at a non-emulated 390x844 the message and the bench only.
    for (const viewport of [viewports[0], { name: 'phone-3d', width: 390, height: 844 }]) {
      const full = viewport.name === 'desktop';
      const { context, page, clean } = await open(browser, viewport);
      const record = (results[`sealed${viewport.width}`] = {});
      const TITLE = 'Weaker developer and background';
      const SEALED_LINE = `Sealed until you reveal “${TITLE}”. Write your predictions first.`;
      const TWIN_LINE = `This run matches a sealed run, so it stays sealed until you reveal “${TITLE}”. Write your predictions first.`;
      const field = name => page.locator(`[data-labn-field="${name}"]`);
      // Nothing that shows a sealed run's outcome may be on the page (badges, cards, summaries,
      // pictures, the dive, the replay's frames), nor its words.
      const noOutcome = async label => {
        const found = await page.evaluate(() => ({
          outputs: [
            ...document.querySelectorAll(
              'main .lab-result-card, main [data-lab-card], main .lab-result-summary, main [data-lab-label]:not([data-lab-label="schematic"]), main .lab-compare, main .labm canvas, main .lab-result-canvas, #lab-clip-dive, main [data-lab-drawer="tissue-text"], #lab-replay-frame'
            ),
          ].map(n => n.id || n.className),
          words:
            document
              .querySelector('main')
              .innerText.match(
                /visible silver|contrast is|background is at|Not modeled|Simulated · not a measurement/g
              ) || [],
        }));
        assert.deepEqual(found, { outputs: [], words: [] }, `${label}: no outcome while sealed`);
      };
      // A finished standard run first: its outcome was seen, so it becomes the open baseline.
      await acknowledgeAndCreateRun(page);
      await page.click('#lab-run-all');
      await page.waitForSelector('#lab-resolve-out .lab-result-card');
      const first = (await getState(page)).runOrder[0];
      await page.goto(lab({ view: 'designer', exp: 'new' }), { waitUntil: 'networkidle' });
      await page.waitForSelector('#lab-designer-host .labn-designer');
      await field('title').fill(TITLE);
      await field('question').fill('Does a weaker developer lower the background more than the plaques?');
      await field('hypothesis').fill('A weaker developer lightens the background more than the plaques.');
      await page.click('[data-labn-toggle="more-question"]'); // SIMPLE: Another explanation sits in a fold
      await field('alternative').fill('Everything lightens together, so contrast does not change.');
      // SIMPLE: screen 1 holds the plan and the runs; no Next before What you change
      // UX-LAST: "What you change" takes one of the bench's own changes (CortexLab.changeOptions words).
      await page.locator('input[data-labn-chip-input="changed"]').fill('Developer strength: weaker');
      await page.locator('input[data-labn-chip-input="changed"]').press('Enter');
      await page.locator('input[data-labn-control-type="negative-biological"]').check();
      await field('controls.0.addresses').fill('that the developer darkens everything, lesion or not');
      await page.locator('input[data-labn-field="measures"][value="contrast-ordinal"]').check();
      await page.click('[data-labn-action="request-runs"]');
      await page.waitForSelector('#lab-sealed-ready', { timeout: 20000 });
      // It comes to the top of the view by a smooth scroll: wait for it (or time out and report).
      await page
        .waitForFunction(
          () => {
            const r = document.querySelector('#lab-sealed-ready').getBoundingClientRect();
            return r.top >= 0 && r.bottom <= innerHeight;
          },
          null,
          { timeout: 5000 }
        )
        .catch(() => {});
      await settled(page);
      const made = await page.evaluate(() => {
        const s = window.CortexLab.getState(),
          id = s.experimentOrder.at(-1),
          e = s.experiments[id];
        return {
          exp: id,
          status: e.status,
          base: e.baselineRunId,
          copy: e.experimentalRunId,
          runs: s.runOrder.length,
          sealed: { ...s.sealed },
          strength: (s.runs[e.experimentalRunId].params.development || {}).strength,
          steps: [e.baselineRunId, e.experimentalRunId].map(r => s.runs[r].stepsDone.length),
          url: Object.fromEntries(new URLSearchParams(location.search)),
        };
      });
      record.made = made;
      assert.equal(made.status, 'draft');
      // UX-LAST-lab.js-3: the run already seen is the baseline, left open; only the copy is new and sealed.
      assert.equal(made.base, first, 'the finished standard run already seen is the baseline');
      assert.equal(made.runs, 2, 'only the copy is made');
      assert.deepEqual(made.sealed, { [made.copy]: made.exp }, 'only the run with the change is sealed');
      assert.deepEqual(made.steps, [9, 9], 'both runs did every step');
      assert.equal(made.strength, 'weak', '"Developer strength: weaker" makes the weaker copy');
      assert.deepEqual([made.url.view, made.url.run, made.url.exp], ['bench', made.copy, made.exp]);
      const titles = await page.evaluate(
        ids => ids.map(id => window.CortexLab.runTitle(window.CortexLab.getState().runs[id])),
        [made.base, made.copy]
      );
      // The message has focus and sits in view under the site bar (not at the page top).
      record.ready = await page.evaluate(() => {
        const node = document.querySelector('#lab-sealed-ready'),
          r = node.getBoundingClientRect(),
          bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lab-topbar-h')) || 64;
        return {
          focused: document.activeElement === node,
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          bar: Math.round(bar),
          vh: innerHeight,
          lead: node.querySelector('#lab-sealed-ready-h').textContent.trim(),
          runs: [...node.querySelectorAll('.lab-sealed-runs li')].map(li => li.textContent.trim()),
          link: new URL(node.querySelector('a').href).search,
        };
      });
      assert.ok(
        record.ready.focused && record.ready.top >= record.ready.bar - 1 && record.ready.bottom <= record.ready.vh,
        `the sealed message is focused and in view: ${JSON.stringify(record.ready)}`
      );
      assert.equal(
        record.ready.lead,
        'Your two runs are ready; the run with your change is sealed. Go back to your experiment to write your predictions.'
      );
      assert.deepEqual(record.ready.runs, [`Baseline (already seen): ${titles[0]}`, `With your change: ${titles[1]}`]);
      assert.deepEqual(
        Object.fromEntries(new URLSearchParams(record.ready.link)),
        { view: 'designer', exp: made.exp, step: '2' },
        'the message links to the predictions screen (SIMPLE)'
      );
      await noOutcome('bench after Make the runs for me');
      await noEngineIds(page, 'sealed bench');
      await noOverflow(page, 'sealed bench');
      await shot(page, '17-sealed-ready', viewport.width);
      assert.equal(
        await text(page.locator('#lab-do-status .lab-do-finished')),
        `All steps done: sealed until you reveal “${TITLE}”.`
      );
      // History: the log (no outcome in it), and the replay is only the sealed note.
      await openRunMenu(page);
      await page.click('#lab-history-toggle');
      await page.waitForSelector('#lab-history:not([hidden])');
      record.history = await page.evaluate(() => ({
        rows: document.querySelectorAll('#lab-history .lab-log-table tbody tr').length,
        replay: (document.querySelector('#lab-history .lab-replay .lab-sealed') || {}).textContent || null,
        tables: document.querySelectorAll('#lab-history .lab-replay table, #lab-replay-range').length,
      }));
      assert.ok(record.history.rows >= 9, `the run log is kept: ${record.history.rows} rows`);
      assert.equal((record.history.replay || '').trim(), SEALED_LINE, 'the replay is the sealed note');
      assert.equal(record.history.tables, 0, 'no replay frames or state tables');
      await noOutcome('History of a sealed run');
      await page.click('#lab-history-close');
      await page.waitForSelector('#lab-history', { state: 'hidden' });
      clean('sealed bench');
      if (full) {
        // A comparison with a sealed side shows that run's sealed card and no difference.
        await page.goto(lab({ view: 'bench', run: first }), { waitUntil: 'networkidle' });
        await page.waitForSelector('#lab-resolve-out .lab-result-card');
        await page.click('#lab-compare-open');
        await page.waitForSelector('#lab-pair');
        await page.click('#lab-pair [data-lab-drawer="compare-existing"] .lab-drawer-btn');
        await page.selectOption('#lab-compare-a', made.base);
        await page.selectOption('#lab-compare-b', made.copy);
        await page.click('#lab-compare-btn');
        await page.waitForSelector('#lab-compare-out .lab-sealed-card');
        record.compare = await page.evaluate(() => ({
          cards: [...document.querySelectorAll('#lab-compare-out .lab-sealed-card .lab-sealed-run')].map(n =>
            n.textContent.trim()
          ),
          outcome: document.querySelectorAll(
            '#lab-compare-out .lab-compare, #lab-compare-out [data-lab-label], #lab-scope-compare canvas, #lab-compare-scope'
          ).length,
        }));
        assert.deepEqual(
          record.compare,
          { cards: [titles[1]], outcome: 0 },
          'a comparison with a sealed run shows no difference'
        );
        // UX-LAST-lab.js-5: the microscope shows the open baseline's picture beside the copy's sealed card.
        await page.goto(lab({ view: 'microscope', run: `${made.base},${made.copy}` }), { waitUntil: 'networkidle' });
        await page.waitForSelector('main .lab-scope-split .lab-sealed-card');
        await drawingView(page, 'main .lab-scope-split-open'); // REF: the open run alone opens on its real slide
        record.scope = await page.evaluate(() => ({
          sealed: [...document.querySelectorAll('main .lab-sealed-card .lab-sealed-run')].map(n =>
            n.textContent.trim()
          ),
          title: document.querySelector('main .lab-scope-split-open .lab-scope-title').textContent.trim(),
          canvasesElsewhere: [...document.querySelectorAll('main canvas')].filter(
            c => !c.closest('.lab-scope-split-open')
          ).length,
          words: /visible silver|contrast is|background is/.test(
            document.querySelector('main .lab-sealed-card').textContent
          ),
        }));
        assert.deepEqual(
          record.scope,
          { sealed: [titles[1]], title: `In the microscope: ${titles[0]}`, canvasesElsewhere: 0, words: false },
          'the microscope: the baseline in view, the copy sealed'
        );
        await noOverflow(page, 'microscope with one sealed run');
        await shot(page, '17-scope-split', viewport.width);
        // UX-LAST-lab.js-4: a run with the same change is a twin of the sealed copy. SHELF (§13.3): no set-up
        // offers a setting now (the free bench's Mix panel left it; the jars hold the mix), so the run is made
        // as an older save or an activity would: the same set-params event, sealed at its start.
        const twin = await page.evaluate(base => {
          const specimenId = window.CortexLab.getState().runs[base].specimenId;
          const run = window.CortexLab.newRun({ specimenId, mode: 'practice' });
          window.CortexLab.applyEvent(run.id, { type: 'set-params', params: { development: { strength: 'weak' } } });
          window.labSealTwin(run.id);
          window.CortexLab.save();
          return run.id;
        }, first);
        await page.goto(lab({ view: 'bench', run: twin }), { waitUntil: 'networkidle' });
        await page.waitForSelector('#lab-run-all');
        assert.equal((await getState(page)).runOrder[2], twin);
        await page.click('#lab-run-all');
        await page.waitForSelector('#lab-resolve-out .lab-sealed');
        record.twin = await page.evaluate(
          id => ({
            sealedTo: window.CortexLab.getState().sealed[id] || null,
            isSealed: window.CortexLab.isSealed(id),
            line: document.querySelector('#lab-resolve-out .lab-sealed').textContent.trim(),
          }),
          twin
        );
        assert.deepEqual(record.twin, { sealedTo: made.exp, isSealed: true, line: TWIN_LINE }, 'the twin is sealed');
        await noOutcome('a twin of the sealed copy');
        // The report's lab work: the sealed line in place of the copy's and the twin's badge and summary.
        await page.goto(lab({ view: 'notebook' }), { waitUntil: 'networkidle' });
        await page.waitForSelector('#lab-notebook-host .labn-notebook');
        const reportItems = () =>
          page.evaluate(
            ids =>
              ids.map(id => {
                const node = document.querySelector(`[data-labn-ref="${id}"]`);
                return node
                  ? {
                      badges: node.querySelectorAll('[data-lab-badge]').length > 0,
                      sealed: (node.querySelector('[data-labn-sealed]') || {}).textContent || null,
                      words: /visible silver|contrast is|background is/.test(node.textContent),
                    }
                  : null;
              }),
            [made.base, made.copy, twin]
          );
        record.report = await reportItems();
        assert.deepEqual(
          record.report,
          [
            { badges: true, sealed: null, words: true },
            { badges: false, sealed: SEALED_LINE, words: false },
            { badges: false, sealed: SEALED_LINE, words: false },
          ],
          'the report holds back the copy and its twin; the baseline already seen keeps its badge'
        );
        // UX-LAST-notebook-2: "Note on a simulated run" offers no sealed run (listed, never choosable),
        // and a forced choice is refused before anything is written.
        const nb = page.locator('.labn-notebook');
        await nb.locator('[data-labn-action="add-menu"]').click();
        await nb.locator('[data-labn-add-type="simulated"]').click();
        record.noteForm = await page.evaluate(
          ids => {
            const select = document.querySelector('select[data-labn-draft="runId"]');
            return {
              choosable: [...select.options].filter(o => o.value && !o.disabled).map(o => o.value),
              sealed: ids.map(id => select.querySelector(`option[value="${id}"]`).getAttribute('data-labn-sealed-run')),
            };
          },
          [made.copy, twin]
        );
        assert.deepEqual(
          record.noteForm,
          { choosable: [made.base], sealed: [made.exp, made.exp] },
          'no sealed run can be chosen for a simulated note'
        );
        await page.evaluate(id => {
          const select = document.querySelector('select[data-labn-draft="runId"]');
          select.value = id;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }, made.copy);
        await nb.locator('[data-labn-draft="text"]').fill('A note on the sealed copy.');
        await nb.locator('[data-labn-add-form] button[type="submit"]').click();
        assert.match(
          await text(nb.locator('[data-labn-add-error]')),
          new RegExp(`^That run is sealed until you reveal “${TITLE}”`),
          'a forced note on a sealed run is refused'
        );
        assert.equal((await getState(page)).notebook.entries.length, 0, 'nothing written');
        await nb.locator('[data-labn-action="add-cancel"]').click();
        // The exported file (and its plain-text copy) of the draft: the copy's block keeps the process
        // and prints one sealed line; the open baseline keeps its label and summary; no readout yet.
        const fileOf = () =>
          page.evaluate(() => window.CortexLabNotebook.exportMarkdown(window.CortexLab.getState(), window.LAB.lab));
        const codes = await page.evaluate(() => [...window.SilverLab.BASIS]);
        const blockOf = (md, title) => {
          const lines = md.split('\n'),
            at = lines.indexOf(`#### ${title}`),
            end = lines.findIndex((l, n) => n > at && /^#{2,4} /.test(l));
          return at < 0 ? null : lines.slice(at, end < 0 ? undefined : end).filter(Boolean);
        };
        const appendixOf = md =>
          (md.split('\n## Model detail (for instructors)\n')[1] || '').split('\n').filter(l => l.startsWith('### '));
        const fileChecks = (md, label) => {
          assert.deepEqual(markdownProblems(md), [], `${label}: Markdown structure`);
          assert.deepEqual(studentPartProblems(md, codes), [], `${label}: no id or strength code before Model detail`);
          assert.ok(md.includes(DISCLAIMER) && md.includes(`### ${TITLE}`), label);
        };
        const draftFile = await fileOf();
        fileChecks(draftFile, 'the draft file');
        record.draftBlocks = titles.map(t => blockOf(draftFile, t));
        const [baseBlock, copyBlock] = record.draftBlocks;
        assert.ok(baseBlock.includes(`- Label: ${SYNTHETIC}`) && baseBlock.some(l => l.startsWith('- Summary: ')));
        assert.equal(copyBlock.at(-1), 'Sealed until this experiment is revealed.', copyBlock.join(' / '));
        assert.ok(!copyBlock.some(l => /^- (Label|Summary|Description|Measurements):/.test(l)), copyBlock.join(' / '));
        assert.deepEqual(
          appendixOf(draftFile),
          [`### ${titles[0]}`, '### Model sources'],
          'no model detail for the copy'
        );
        assert.ok(!draftFile.includes('- Model readout (simulated): '), 'no model readout before the reveal');
        assert.ok(
          (await page.evaluate(md => window.CortexLabNotebook.markdownToPlain(md), draftFile)).includes(
            '\nSealed until this experiment is revealed.\n'
          ),
          'the plain-text copy keeps the seal'
        );
        // 3D: no dive and the sealed card; the run is complete but sealed.
        await page.goto(lab({ view: 'bench', run: made.copy }), { waitUntil: 'networkidle' });
        await page.waitForSelector('#lab-resolve-out .lab-sealed');
        await page.click('[data-lab-mode="3d"]');
        await page.waitForSelector('#lab-bench-3d canvas', { timeout: 60000 });
        await page.waitForSelector('.lab-stage-live', { timeout: 60000 });
        await page.waitForSelector('#lab-resolve-out .lab-sealed');
        assert.equal(
          await text(page.locator('#lab-do-status .lab-do-finished')),
          `Run complete: sealed until you reveal “${TITLE}”.`
        );
        await noOutcome('3D bench with a sealed run');
        // Reveal (predictions first): every surface shows the outcome again.
        await page.goto(lab({ view: 'designer', exp: made.exp, step: '2' }), { waitUntil: 'networkidle' });
        await page.waitForSelector('#lab-designer-host .labn-designer');
        await field('predictions.expected').fill('The background drops while plaques stay visible, so contrast rises.');
        await field('predictions.negligible').fill('Nothing moves; developer strength is not limiting here.');
        await field('predictions.opposite').fill('Plaques fade more than the background, so contrast falls.');
        await page.waitForFunction(() => !document.querySelector('[data-labn-action="reveal"]').disabled, null, {
          timeout: 5000,
        });
        await page.click('[data-labn-action="reveal"]');
        await page.waitForSelector('.labn-card');
        await page.waitForFunction(
          ([id, a, b, c]) =>
            window.CortexLab.getState().experiments[id].status === 'revealed' &&
            ![a, b, c].some(r => window.CortexLab.isSealed(r)),
          [made.exp, made.base, made.copy, twin]
        );
        await page.goto(lab({ view: 'bench', run: made.copy }), { waitUntil: 'networkidle' });
        await page.waitForSelector('main.lab-view-bench[data-mode="3d"] .lab-stage-live', { timeout: 60000 });
        await page.waitForSelector('#lab-resolve-out .lab-result-card');
        assert.equal(
          await page.getAttribute('#lab-resolve-out .lab-banner .lab-badge', 'data-lab-label'),
          SYNTHETIC_LABEL
        );
        assert.equal(await page.locator('#lab-clip-dive').count(), 1, 'the tissue dive is offered again');
        await allLabeled(page, 'bench after the reveal');
        await page.locator('#lab-result-h').scrollIntoViewIfNeeded();
        await shot(page, '17-revealed', viewport.width);
        await openRunMenu(page);
        await page.click('#lab-history-toggle');
        await page.waitForSelector('#lab-history:not([hidden]) #lab-replay-frame .lab-frame-head');
        await page.goto(lab({ view: 'microscope', run: `${made.base},${made.copy}` }), { waitUntil: 'networkidle' });
        await page.waitForSelector('#lab-scope-host .labm canvas');
        assert.equal(await page.locator('#lab-scope-host canvas').count(), 2, 'the microscope shows both runs');
        await page.goto(lab({ view: 'notebook' }), { waitUntil: 'networkidle' });
        await page.waitForSelector('#lab-notebook-host .labn-notebook');
        record.reportAfter = await reportItems();
        assert.deepEqual(
          record.reportAfter.map(x => [x.badges, x.sealed]),
          [
            [true, null],
            [true, null],
            [true, null],
          ],
          'after the reveal every run (the twin too) shows its badge'
        );
        // The downloaded file after the reveal: labels, summaries, both appendix entries and the Model
        // readout (simulated) of the pair, in model-scale words.
        const [download] = await Promise.all([page.waitForEvent('download'), page.click('#labn-export')]);
        const openFile = readFileSync(await download.path(), 'utf8');
        assert.equal(openFile, await fileOf(), 'the download is exportMarkdown(state)');
        fileChecks(openFile, 'the revealed file');
        for (const title of titles) {
          const block = blockOf(openFile, title);
          assert.ok(block.includes(`- Label: ${SYNTHETIC}`) && block.some(l => l.startsWith('- Summary: ')), title);
        }
        assert.deepEqual(
          appendixOf(openFile),
          [...titles.map(t => `### ${t}`), '### Model sources'],
          'Model detail lists both runs, then the model sources'
        );
        const contrast = await page.evaluate(
          ids => ids.map(id => window.LAB.lab.resolve(window.CortexLab.getState().runs[id]).contrast),
          [made.base, made.copy]
        );
        record.readout = openFile.split('\n').filter(l => l.startsWith('- Model readout (simulated): '));
        assert.deepEqual(record.readout, [
          `- Model readout (simulated): Target/background contrast: ${readoutText(contrast, await page.evaluate(() => [...window.SilverLab.ORDINAL_TEXT]))}`,
        ]);
        assert.ok(!openFile.includes('Sealed until'));
      }
      clean('run sealing');
      await context.close();
    }

    // 17b. UX-LAST (shared API (a), UX-LAST-lab.js-1/-2, UX-LAST-notebook-1): the designer suggests
    // exactly the bench's changes (CortexLab.changeOptions, in its order and words), and each suggestion
    // either makes runs whose only difference is that change, or the bench refuses: no run is ever made
    // with a change the student did not plan (no fallback). Text the bench does not know ("Developer
    // strength" without its direction, the old "Gold toning") keeps the button waiting with its reason,
    // and the bench, opened anyway, refuses and makes nothing. Desktop.
    {
      const viewport = viewports[0];
      const { context, page, clean } = await open(browser, viewport);
      const record = (results.changeSuggestions = { made: [], refused: [] });
      const field = name => page.locator(`[data-labn-field="${name}"]`);
      const CHANGE_PATHS = {
        'impregnation-time': 'impregnation.endpoint',
        'impregnation-temperature': 'impregnation.temperature',
        'development-time': 'development.endpoint',
        'developer-strength': 'development.strength',
        washes: 'washes.condition',
        pretreatment: 'pretreatment',
      };
      await acknowledge(page);
      const designWith = async (title, change) => {
        await page.goto(lab({ view: 'designer', exp: 'new' }), { waitUntil: 'networkidle' });
        await page.waitForSelector('#lab-designer-host .labn-designer');
        await field('title').fill(title);
        await page.locator('input[data-labn-chip-input="changed"]').fill(change);
        await page.locator('input[data-labn-chip-input="changed"]').press('Enter');
        await page.waitForFunction(
          ([t, c]) =>
            Object.values(window.CortexLab.getState().experiments).some(
              e => e.title === t && (e.changed || []).includes(c)
            ),
          [title, change]
        );
        return page.evaluate(() => {
          const button = document.querySelector('[data-labn-action="request-runs"]'),
            reason = document.querySelector('[data-labn-request-reason]');
          return { disabled: button.disabled, reason: reason.hidden ? '' : reason.dataset.labnRequestReason };
        });
      };
      await page.goto(lab({ view: 'designer', exp: 'new' }), { waitUntil: 'networkidle' });
      await page.waitForSelector('#lab-designer-host .labn-designer');
      const offered = await page.evaluate(() => ({
        options: window.CortexLab.changeOptions(),
        suggestions: [...document.querySelectorAll('datalist[data-labn-changes] option')].map(o => o.value),
        defaults: window.SilverLab.DEFAULT_PARAMS,
      }));
      record.suggestions = offered.suggestions;
      assert.deepEqual(
        offered.suggestions,
        offered.options.flatMap(o =>
          o.values.filter(v => !['sop-default', 'none'].includes(v.value)).map(v => `${o.label}: ${v.label}`)
        ),
        'the designer suggests the bench’s own changes, in its order and words'
      );
      for (const [n, suggestion] of offered.suggestions.entries()) {
        const title = `Suggestion ${n + 1}`;
        const match = await page.evaluate(t => window.CortexLab.matchChange(t), suggestion);
        assert.ok(match && match.value, `"${suggestion}" is a bench change: ${JSON.stringify(match)}`);
        const button = await designWith(title, suggestion);
        assert.deepEqual(button, { disabled: false, reason: '' }, `"${suggestion}": Make the runs for me is ready`);
        const before = (await getState(page)).runOrder.length;
        await page.click('[data-labn-action="request-runs"]');
        await page.waitForSelector('#lab-sealed-ready, #lab-make-refused', { timeout: 20000 });
        const made = await page.evaluate(
          ([t, defaults]) => {
            const s = window.CortexLab.getState(),
              e = Object.values(s.experiments).find(x => x.title === t),
              leaves = (o, pre = '') =>
                Object.entries(o).flatMap(([k, v]) =>
                  v && typeof v === 'object' ? leaves(v, `${pre}${k}.`) : [[`${pre}${k}`, v]]
                ),
              valueOf = (params, path) =>
                path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), params),
              effective = run => leaves(defaults).map(([k, v]) => [k, valueOf(run.params, k) ?? v]),
              [b, x] = [s.runs[e.baselineRunId], s.runs[e.experimentalRunId]];
            if (!b || !x) return { refused: !!document.querySelector('#lab-make-refused'), runs: s.runOrder.length };
            const base = Object.fromEntries(effective(b));
            return {
              refused: !!document.querySelector('#lab-make-refused'),
              diff: effective(x).filter(([k, v]) => base[k] !== v),
              steps: [b.stepsDone.length, x.stepsDone.length],
              sealed: window.CortexLab.isSealed(x.id),
              runs: s.runOrder.length,
            };
          },
          [title, offered.defaults]
        );
        const path = CHANGE_PATHS[match.id];
        const want = path ? [[path, match.value]] : [[match.value, !offered.defaults[match.value]]];
        record.made.push([suggestion, made.diff]);
        // TONING (ENGINE-14): a copy that skips gold toning or thiosulfate does the 8 steps it needs.
        assert.deepEqual(
          made,
          { refused: false, diff: want, steps: path ? [9, 9] : [9, 8], sealed: true, runs: before + 2 },
          `"${suggestion}" makes a standard run and a sealed copy with exactly that change`
        );
      }
      // Not a bench change: the button waits with its reason; the bench opened anyway refuses.
      for (const [text, why] of [
        ['Developer strength', 'direction'],
        ['Gold toning', 'unknown'],
      ]) {
        const title = `Not offered: ${text}`;
        const button = await designWith(title, text);
        assert.deepEqual(button, { disabled: true, reason: why }, `"${text}": the button waits (${why})`);
        const id = await page.evaluate(
          t => Object.values(window.CortexLab.getState().experiments).find(e => e.title === t).id,
          title
        );
        const before = await getState(page);
        await page.goto(lab({ view: 'bench', exp: id }), { waitUntil: 'networkidle' });
        await page.waitForSelector('#lab-make-refused');
        const refused = await page.evaluate(
          ([expId, runsBefore, sealedBefore]) => {
            const node = document.querySelector('#lab-make-refused'),
              s = window.CortexLab.getState();
            return {
              focused: document.activeElement === node,
              text: node.textContent.replace(/\s+/g, ' ').trim(),
              link: Object.fromEntries(new URL(node.querySelector('a[data-lab-go]').href).searchParams),
              made: s.runOrder.length - runsBefore,
              sealed: Object.keys(s.sealed).length - sealedBefore,
              named: [s.experiments[expId].baselineRunId || '', s.experiments[expId].experimentalRunId || ''],
            };
          },
          [id, before.runOrder.length, Object.keys(before.sealed || {}).length]
        );
        record.refused.push([text, refused]);
        assert.deepEqual(
          refused,
          {
            focused: true,
            text: "The bench can't make this change for you. Pick your two runs yourself on the plan screen, or choose a change the bench offers.",
            link: { view: 'designer', exp: id, step: '1' }, // SIMPLE: the runs sit on the plan screen
            made: 0,
            sealed: 0,
            named: ['', ''],
          },
          `"${text}": the bench refuses and makes nothing`
        );
        await noOverflow(page, 'bench refusal');
        if (why === 'unknown') await shot(page, '17b-refused', viewport.width);
      }
      clean('change suggestions');
      await context.close();
    }

    // 17c. TONING under MODE §11.5 / MODE-FIX-shell-2: the practice set-up has no settings UI, and on the free
    // bench gold toning and thiosulfate are jars, not settings (no flag checkbox in the Mix panel): a slide
    // that is not gold toned is one whose gold jar was never dipped. The run dips the other eight steps from
    // the Jar select; the Slide now card is a picture that is not gold toned; History's settings read the
    // slide ("Gold toning: not done") in the course procedure's words, never "skipped". (The designer /
    // report parts of the old journey asserted the pre-§11.5 "Not modeled" reveal; they belong to the
    // notebook and are not asserted here.)
    for (const viewport of viewports) {
      const { context, page, clean } = await open(browser, viewport);
      const record = (results[`toning${viewport.width}`] = {});
      const steps = await (async () => {
        await acknowledge(page);
        return page.evaluate(() => [...window.SilverLab.STEPS]);
      })();
      const needed = steps.filter(s => s !== 'gold-toning');
      await page.waitForSelector('#lab-newrun-create');
      await page.check('#lab-bench-mode input[value="free"]');
      await page.waitForSelector('#lab-newrun-guess');
      record.flagControls = await page.locator('#lab-mix, [name="toning"], [name="thiosulfate"]').count();
      assert.equal(record.flagControls, 0, 'no Mix panel and no toning / thiosulfate checkbox (SHELF: the jars)');
      await page.click('#lab-newrun-create');
      await page.waitForSelector('#lab-free-dip');
      const skipRun = (await getState(page)).runOrder[0];
      for (const step of needed) {
        await page.selectOption('#lab-free-step', step);
        await page.click('#lab-free-dip');
        await page.waitForFunction(
          ([id, n]) => window.CortexLab.getState().runs[id].events.filter(e => e.type === 'dip').length === n,
          [skipRun, needed.indexOf(step) + 1]
        );
      }
      record.run = await page.evaluate(id => {
        const run = window.CortexLab.getState().runs[id],
          out = window.LAB.lab.resolve(run);
        return {
          steps: run.events.filter(e => e.type === 'dip').map(e => e.jarId),
          events: run.events.filter(e => e.type !== 'dip').length,
          mode: run.mode,
          label: out.label,
          tone: out.tone,
          toned: out.slide.toned,
          sealed: out.slide.coverslipped,
        };
      }, skipRun);
      assert.deepEqual(
        record.run,
        {
          steps: needed,
          events: 0,
          mode: 'free',
          label: SYNTHETIC_LABEL,
          tone: 'silver',
          toned: false,
          sealed: true,
        },
        'the free run dips eight jars (dip events, SHELF), never the gold one; its picture is not toned; no setting was recorded'
      );
      await page.waitForSelector('#lab-slide-now .lab-slide-flags');
      record.flags = await text(page.locator('#lab-slide-now .lab-slide-flags'));
      assert.ok(
        !record.flags.includes('gold toned') && record.flags.includes('sealed under a coverslip'),
        `the flags in plain words: ${record.flags}`
      );
      assert.equal(await page.locator('#lab-reactions > li').count(), 8, 'one reaction per dip');
      record.sealFocus = await page.evaluate(() => document.activeElement.id);
      assert.equal(record.sealFocus, 'lab-new-slide', 'the sealing dip lands focus on New slide (MODE-FIX-shell-13)');
      await allLabeled(page, 'a free run without gold toning');
      await noEngineIds(page, 'a free run without gold toning');
      await openRunMenu(page);
      await page.click('#lab-history-toggle');
      await page.waitForSelector('#lab-history:not([hidden])');
      record.history = await page.evaluate(() => ({
        rows: [...document.querySelectorAll('#lab-history .lab-log-table tbody tr')].map(tr =>
          tr.cells[1].textContent.trim()
        ),
        settings: [...document.querySelectorAll('#lab-history .lab-log-settings')].map(n => n.textContent.trim()),
        words: [window.SilverLab.TONING_TEXT.skipped, window.SilverLab.THIOSULFATE_TEXT.performed],
      }));
      assert.equal(record.history.rows.length, 8, 'the 8 dips, no setting line');
      assert.ok(!record.history.rows.some(r => r.startsWith('Gold toning')), 'no gold toning dip in the log');
      assert.ok(!record.history.rows.some(r => /skipped/i.test(r)), 'nothing is called skipped');
      assert.deepEqual(record.history.settings, [
        'Settings: all standard (per procedure)',
        `Gold toning: not done (${record.history.words[0]})`,
        `Thiosulfate: done (${record.history.words[1]})`,
      ]);
      await page.click('#lab-history-close');
      await page.waitForSelector('#lab-history', { state: 'hidden' });
      await noOverflow(page, 'a free run without gold toning');
      await page.locator('#lab-slide-now').scrollIntoViewIfNeeded();
      await shot(page, '17c-free-no-toning', viewport.width);
      clean('a free run without the gold jar');
      await context.close();
    }

    // 17d. SHELF (contract §13.3): the open free bench. The mode switch at the top starts the free bench; the
    // silver nitrate jar edited to 37 °C (its sheet's Edit jar form) and dipped is a reaction with a
    // "Currently unknown:" sentence ("Partly unknown"); an extra jar of tap water, dipped, is a "Currently
    // unknown reaction" in the log (and left out of the drawing on Slide now); the mode switch back to
    // Practice starts a new practice run at once.
    for (const viewport of viewports) {
      const { context, page, clean } = await open(browser, viewport);
      const record = (results[`shelf${viewport.width}`] = {});
      await acknowledge(page);
      await page.waitForSelector('#lab-mode-switch');
      await page.click('#lab-mode-switch [data-lab-benchmode="free"]');
      await page.waitForSelector('#lab-mode-switch [data-lab-benchmode="free"][aria-pressed="true"]');
      await page.click('#lab-newrun-create');
      await page.waitForSelector('#lab-free-dip');
      // the silver nitrate jar at 37 °C
      await page.click('li.lab-step[data-lab-jar="silver-impregnation"] .lab-step-title');
      await page.waitForSelector('#lab-sheet #lab-jar-edit');
      await page.selectOption('#lab-jar-tempC', '37');
      await page.waitForSelector('#lab-jar-now .lab-jar-changed');
      record.row = await text(page.locator('li.lab-step[data-lab-jar="silver-impregnation"] .lab-step-contents'));
      assert.match(record.row, /37 °C.*\(changed\)$/, 'the row says what is in the jar now');
      await noOverflow(page, 'the jar editor');
      await shot(page, '17d-jar-editor', viewport.width);
      await page.keyboard.press('Escape');
      await page.waitForSelector('#lab-sheet', { state: 'hidden' });
      await page.selectOption('#lab-free-step', 'silver-impregnation');
      await page.click('#lab-free-dip');
      await page.waitForSelector('#lab-reactions > li.lab-reaction-latest[data-lab-reaction-partly]');
      record.partly = await page.evaluate(() => {
        const item = document.querySelector('#lab-reactions > li.lab-reaction-latest');
        return {
          chip: item.querySelector('.lab-reaction-chip').textContent.replace('?', '').trim(),
          unknown: [...item.querySelectorAll('.lab-reaction-unknown > li')].map(n => n.textContent.trim()),
          event: (({ type, jarId, solution }) => ({ type, jarId, tempC: solution.tempC }))(
            window.CortexLab.getState().runs[window.CortexLab.getState().runOrder.at(-1)].events.at(-1)
          ),
        };
      });
      assert.equal(record.partly.chip, 'Partly unknown');
      assert.ok(
        record.partly.unknown.length === 1 && record.partly.unknown[0].startsWith('Currently unknown: '),
        `the "Currently unknown:" sentence under the known text: ${JSON.stringify(record.partly.unknown)}`
      );
      assert.deepEqual(record.partly.event, { type: 'dip', jarId: 'silver-impregnation', tempC: 37 });
      // an extra jar of tap water
      await page.click('#lab-add-jar');
      await page.waitForSelector('#lab-sheet #lab-jar-bottle');
      await page.selectOption('#lab-jar-bottle', 'tap-water');
      await page.waitForSelector('li.lab-step[data-lab-jar="x1"]');
      await page.keyboard.press('Escape');
      await page.waitForSelector('#lab-sheet', { state: 'hidden' });
      await page.selectOption('#lab-free-step', 'x1');
      await page.click('#lab-free-dip');
      await page.waitForSelector('#lab-reactions > li.lab-reaction-latest[data-lab-reaction-kind="unknown"]');
      record.unknown = await page.evaluate(() => {
        const item = document.querySelector('#lab-reactions > li.lab-reaction-latest');
        return {
          chip: item.querySelector('.lab-reaction-chip').textContent.replace('?', '').trim(),
          mark: item.querySelector('.lab-unknown-mark').getAttribute('aria-hidden'),
          text: item.querySelector('.lab-reaction-text').textContent.trim(),
          slide: document
            .querySelector('#lab-slide-unknown .lab-slide-unknown-head')
            .textContent.replace('?', '')
            .trim(),
        };
      });
      assert.equal(record.unknown.chip, 'Currently unknown reaction');
      assert.equal(record.unknown.mark, 'true');
      assert.match(record.unknown.text, /^Currently unknown reaction: /);
      assert.equal(record.unknown.slide, 'Currently unknown: 1 dip, left out of the drawing');
      await allLabeled(page, 'the open free bench');
      await noEngineIds(page, 'the open free bench');
      await noOverflow(page, 'the open free bench');
      await page.locator('#lab-reactions').scrollIntoViewIfNeeded();
      await shot(page, '17d-unknown-log', viewport.width);
      // back to Practice: a new practice run at once, the free run kept
      await page.click('#lab-mode-switch [data-lab-benchmode="practice"]');
      await page.waitForSelector('#lab-do-step');
      record.practice = await page.evaluate(() => {
        const s = window.CortexLab.getState(),
          run = s.runs[s.runOrder.at(-1)];
        return {
          runs: s.runOrder.length,
          mode: run.mode,
          events: run.events.length,
          live: document.querySelector('#lab-live').textContent.trim(),
          pressed: document.querySelector('#lab-mode-switch [aria-pressed="true"]').dataset.labBenchmode,
        };
      });
      assert.deepEqual(record.practice, {
        runs: 2,
        mode: 'practice',
        events: 0,
        live: 'New slide: Practice the procedure.',
        pressed: 'practice',
      });
      clean('the open free bench');
      await context.close();
    }

    for (const viewport of viewports) {
      const { context, page, clean } = await open(browser, viewport);
      const record = (results[viewport.name] = {});
      const width = viewport.width;
      const desktop = viewport.name === 'desktop';
      let clicks = 0;
      const click = async selector => {
        clicks++;
        await page.click(selector);
      };

      // 1. Home: one h1, three cards, the progress strip, one honesty line, no gate; How this lab works
      // explains the labels once; the bench is blocked until the safety notes are acknowledged.
      await page.goto(lab({ view: 'about' }), { waitUntil: 'networkidle' });
      await page.waitForSelector('main.lab-view-about h1', { timeout: 15000 });
      await oneH1(page, 'about');
      record.aboutBadges = await page
        .locator('.lab-about-labels [data-lab-badge]')
        .evaluateAll(nodes => nodes.map(n => [n.dataset.labBadge, n.dataset.labLabel || null]));
      assert.deepEqual(
        record.aboutBadges.map(([kind]) => kind).sort(),
        ['in-progress', 'not-modeled', 'reference-none', 'simulated'],
        'How this lab works shows the four badges (no pending badge, §11.7)'
      );
      assert.ok(
        record.aboutBadges.every(([, label]) => label === null),
        'the legend badges sit on no output (no data-lab-label)'
      );
      const validated = await page.evaluate(() => [
        window.SilverLab.LABELS.VALIDATED,
        window.SilverLab.LABEL_TEXT[window.SilverLab.LABELS.VALIDATED],
      ]);
      assert.equal(
        await text(page.locator(`.lab-about-labels strong[data-lab-label="${validated[0]}"]`)),
        validated[1],
        'the reserved validated label is explained once, as static text'
      );
      assert.equal(
        await page.locator(`.lab-badge[data-lab-label="${validated[0]}"]`).count(),
        0,
        'the validated label is never a live badge'
      );
      const safetyNotes = await page.evaluate(
        () => window.LAB.lab.content.safety.items.filter(h => h.kind !== 'disclaimer').length
      );
      assert.equal(await page.locator('#lab-about-safety details').count(), safetyNotes, 'every safety note listed');
      await noEngineIds(page, 'about');
      await noOverflow(page, 'about');
      await page.goto(lab(), { waitUntil: 'networkidle' });
      await page.waitForSelector('main.lab-view-home h1', { timeout: 15000 });
      assert.equal(await page.locator('.comingsoon').count(), 0, 'localhost opens the lab');
      await oneH1(page, 'home');
      record.h1 = await text(page.locator('h1'));
      assert.equal(record.h1, LABEL);
      // FREE-1: one page, one button; the cards, links and progress strip are gone (the strip moved to Activities)
      record.homeControls = await page.locator('main a, main button').allTextContents();
      assert.deepEqual(
        record.homeControls.map(t => t.trim()),
        ['Enter the lab', 'How this lab works'],
        'Enter the lab and the honesty link only'
      );
      assert.equal(await page.locator('[data-lab-home-card], #lab-progress-strip').count(), 0, 'no cards, no strip');
      assert.equal(await page.getAttribute('#lab-enter', 'href'), '/lab?view=bench');
      assert.equal(await page.getAttribute('.lab-honesty a', 'href'), '/lab?view=about');
      assert.equal(await page.locator('main [data-lab-safety], main [data-lab-badge]').count(), 0, 'no gate, no badge');
      await noEngineIds(page, 'home');
      await noOverflow(page, 'home');
      await shot(page, '1-home', width);
      // From home to a resolved standard run, counting every click (PLAN §8.1: <= 5).
      await click('#lab-enter');
      await page.waitForSelector('#lab-bench-body [data-lab-safety="open"]');
      await oneH1(page, 'bench gate');
      record.blocked = await page.evaluate(() => ({
        newRun: document.querySelectorAll('#lab-newrun, .lab-step, #lab-do-step').length,
        modes: document.querySelectorAll('[data-lab-mode], #lab-bench-3d').length,
        stored: localStorage.getItem('cs-lab-state-v1'),
      }));
      assert.deepEqual(
        record.blocked,
        { newRun: 0, modes: 0, stored: LIST_SEED }, // nothing written beyond the smoke's own list seed
        'bench and 3D blocked before acknowledgement'
      );
      assert.equal(await text(page.locator('#lab-safety-ack')), 'I understand, open the bench');
      await noEngineIds(page, 'bench gate');
      await click('#lab-safety-ack');
      await page.waitForSelector('#lab-newrun-create');
      assert.equal(await page.locator('#lab-bench-head [data-lab-safety="acknowledged"]').count(), 1);
      record.focusAfterAck = await focusKept(page, 'after the safety gate');
      record.acknowledgedAt = await page.evaluate(
        key => JSON.parse(localStorage.getItem(key)).safetyAcknowledgedAt,
        STATE_KEY
      );
      assert.ok(
        typeof record.acknowledgedAt === 'string' && !Number.isNaN(Date.parse(record.acknowledgedAt)),
        `${STATE_KEY} carries safetyAcknowledgedAt`
      );
      await noEngineIds(page, 'bench set-up');
      clean('home');
      // BENCH-1: without LAB_FLAGS (the shipped default) the activities, designer and report pages are off:
      // the bench nav holds the intro and How this lab works, and their addresses show the notice.
      {
        const bare = await open(browser, viewport, { flagsOff: true });
        await bare.page.goto(lab({ view: 'bench' }), { waitUntil: 'networkidle' });
        await bare.page.waitForSelector('main.lab-view-bench .lab-nav');
        record.bareNav = (await bare.page.locator('.lab-nav a').allTextContents()).map(t => t.trim());
        assert.deepEqual(record.bareNav.slice(1), ['How this lab works'], `default nav: ${record.bareNav}`);
        assert.match(record.bareNav[0], /intro$/);
        for (const view of ['modules', 'designer', 'notebook']) {
          await bare.page.goto(lab({ view }), { waitUntil: 'networkidle' });
          await bare.page.waitForSelector('main.lab-view-notice h1');
          assert.equal(
            await text(bare.page.locator('h1')),
            'This part of the lab is not available.',
            `${view} is off by default`
          );
        }
        bare.clean('default flags');
      }

      // 2. Bench list mode: new run on the default specimen, nine steps, Run all, one result card with
      // its badge and plain summary; Why? holds the engine text; History holds the log and the replay.
      record.defaultSpecimen = await page.inputValue('#lab-setup [name="specimen"]:checked');
      assert.equal(record.defaultSpecimen, 'SPEC-SYN-AD-01');
      assert.equal(
        await page.inputValue('#lab-bench-mode input:checked'),
        'practice',
        'Practice the procedure by default (MODE §11.1)'
      );
      assert.equal(
        await page.locator('#lab-mix, #lab-change-what, #lab-setup-mode').count(),
        0,
        'practice: no settings UI'
      );
      await click('#lab-newrun-create');
      await page.waitForSelector('.lab-step');
      const steps = await page.evaluate(() => window.SilverLab.STEPS);
      record.stepCards = await page.locator('.lab-step').evaluateAll(nodes => nodes.map(n => n.dataset.labStep));
      assert.deepEqual(record.stepCards, steps, 'one step per row in procedure order');
      assert.equal(record.stepCards.length, 9);
      assert.equal(await page.getAttribute('.lab-step[aria-current="step"]', 'data-lab-step'), steps[0]);
      const run1 = (await getState(page)).runOrder[0];
      assert.equal((await getState(page)).runs[run1].events.length, 0, 'the standard protocol records no event');
      await click('#lab-run-all');
      await page.waitForSelector('#lab-resolve-out .lab-result-card');
      record.clicksToResult = clicks;
      assert.ok(clicks <= 5, `home -> a resolved standard run in ${clicks} clicks (<= 5)`);
      record.badge = await page.getAttribute('#lab-resolve-out .lab-banner .lab-badge', 'data-lab-label');
      assert.equal(record.badge, SYNTHETIC_LABEL);
      assert.equal(await text(page.locator('#lab-resolve-out .lab-banner .lab-badge-text')), SIMULATED_WORDS);
      assert.equal(await focusKept(page, 'Run all'), 'p', 'Run all lands on the result banner');
      // REF-shell (contract §12.4): the finished standard run on specimen A matches a real slide, so the
      // result card's thumbnail is the first photo (from the reference folder, loaded) under the Real slide
      // badge, never the drawing; the hint under it still says what the click does.
      await page.waitForFunction(() => {
        const img = document.querySelector('#lab-resolve-out #lab-scope-btn .lab-result-pic-real img');
        return !!img && img.complete && img.naturalWidth > 0;
      });
      record.realSlide = await page.evaluate(() => {
        const card = document.querySelector('#lab-resolve-out .lab-result-card');
        const img = card.querySelector('#lab-scope-btn .lab-result-pic-real img');
        const badge = card.querySelector('.lab-thumb-real [data-lab-badge="reference-none"]');
        return {
          src: img.getAttribute('src'),
          alt: img.getAttribute('alt'),
          badge: badge && badge.querySelector('.lab-badge-text').textContent.trim(),
          label: badge && badge.dataset.labLabel,
          hint: card.querySelector('.lab-thumb-hints').textContent.replace(/\s+/g, ' ').trim(),
          button: card.querySelector('#lab-scope-btn').textContent.trim(),
          canvas: card.querySelectorAll('#lab-scope-btn canvas').length,
        };
      });
      assert.match(
        record.realSlide.src,
        /^\/assets\/lab\/reference\/[a-z0-9-]+\.jpg\?v=1$/,
        'a shipped reference photo'
      );
      assert.match(record.realSlide.alt, /^Real slide: /, 'alt = the asset description');
      assert.deepEqual(
        [record.realSlide.badge, record.realSlide.label, record.realSlide.canvas],
        ['Real slide', 'observed-reference', 0],
        `the Real slide badge above the photo, no drawing: ${JSON.stringify(record.realSlide)}`
      );
      assert.equal(record.realSlide.hint, `${desktop ? 'Click' : 'Tap'} the slide: open the microscope`);
      assert.equal(record.realSlide.button, 'Open in the microscope');
      record.summary = await text(page.locator('#lab-resolve-out .lab-result-summary'));
      const summarized = await page.evaluate(id => {
        const run = window.CortexLab.getState().runs[id];
        return window.CortexLab.summarize(window.LAB.lab.resolve(run), window.LAB.lab.getSpecimen(run.specimenId));
      }, run1);
      assert.equal(record.summary, summarized, 'the card shows the plain summary');
      assert.equal(sentences(record.summary), 2, `a two-sentence summary: ${record.summary}`);
      await page.click('#lab-resolve-out [data-lab-why="result"] .lab-drawer-btn');
      await page.click('#lab-resolve-out [data-lab-drawer="why-result-sources"] .lab-drawer-btn');
      record.describe = await text(page.locator('#lab-resolve-out .lab-describe'));
      const described = await page.evaluate(id => {
        const run = window.CortexLab.getState().runs[id];
        return window.LAB.lab.describeOutcome(window.LAB.lab.resolve(run), window.LAB.lab.getSpecimen(run.specimenId));
      }, run1);
      assert.equal(record.describe, described, 'Why? > Sources keeps describeOutcome');
      assert.ok(record.describe.startsWith(SYNTHETIC));
      record.rules = await page.locator('#lab-resolve-out .lab-chip-rule').allTextContents();
      assert.ok(record.rules.includes('R-model-01'), `rule chips include R-model-01: ${record.rules}`);
      record.whyRows = await page.locator('#lab-resolve-out .lab-why-table tbody tr').count();
      assert.equal(record.whyRows, 6, 'Why? lists five structures and the background on the model scale');
      await page.click('#lab-resolve-out [data-lab-why="result"] .lab-drawer-btn');
      // The Run menu (UX-R2-lab.js-1): a disclosure holding New run, History and the safety notes; Esc
      // closes it and gives the button focus back.
      await openRunMenu(page);
      record.runMenu = await page
        .locator('#lab-run-menu > *')
        .evaluateAll(nodes => nodes.map(n => n.id || n.getAttribute('data-lab-safety') || n.className));
      assert.deepEqual(
        record.runMenu,
        ['lab-setup-toggle', 'lab-history-toggle', 'acknowledged', 'lab-hints-row'], // GAME-shell-1: Show hints
        'the Run menu holds New run, History and the safety notes'
      );
      assert.equal(await page.getAttribute('#lab-run-menu-btn', 'aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      await page.waitForSelector('#lab-run-menu', { state: 'hidden' });
      assert.equal(await focusKept(page, 'Run menu closed'), 'button#lab-run-menu-btn');
      await openRunMenu(page);
      await page.click('#lab-history-toggle');
      await page.waitForSelector('#lab-history:not([hidden])');
      assert.equal(await focusKept(page, 'History'), 'h2#lab-history-h');
      record.log = await page
        .locator('#lab-history .lab-log-table tbody tr')
        .evaluateAll(rows => rows.map(r => [Number(r.cells[0].textContent), r.cells[1].textContent.trim()]));
      // UX-POLISH-lab.js-7: one line per event in the export's words ("1." then the step's name).
      const stepTitles = await page.evaluate(ids => ids.map(id => window.CortexLab.stepTitle(id)), steps);
      assert.deepEqual(
        record.log,
        stepTitles.map((title, i) => [i + 1, title]),
        'the run log has nine step events with increasing seq, each by its name'
      );
      assert.equal(await text(page.locator('#lab-replay-frame .lab-frame-head')), `Frame 1 of 9 · 1. ${stepTitles[0]}`);
      await page.click('#lab-replay-next');
      assert.ok(
        (await text(page.locator('#lab-replay-frame .lab-frame-head'))).startsWith('Frame 2 of 9'),
        'replay next'
      );
      await page.focus('#lab-replay-range');
      await page.keyboard.press('End');
      record.lastFrame = await text(page.locator('#lab-replay-frame .lab-frame-head'));
      assert.ok(record.lastFrame.startsWith('Frame 9 of 9'), `replay range: ${record.lastFrame}`);
      // MODE §11.1: no Redo a step and no pick list anywhere on a finished practice run.
      record.redo = await page.locator('#lab-history [data-lab-drawer="redo-step"], [data-lab-perform]').count();
      assert.equal(record.redo, 0, 'a finished run offers no Redo a step');
      await page.click('#lab-history-close');
      await page.waitForSelector('#lab-history', { state: 'hidden' });
      assert.equal(await focusKept(page, 'History closed'), 'button#lab-run-menu-btn');
      await noOverflow(page, 'bench after a full run');
      await allLabeled(page, 'bench result');
      // The first view of the bench after a run (reloaded, at the top): the plan's control budget.
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForSelector('#lab-resolve-out .lab-result-card');
      await noEngineIds(page, 'bench after a run');
      if (desktop) {
        record.foldControls = await controlsAboveFold(page);
        assert.ok(
          record.foldControls.length <= 6 + (await recenterShown(page)) + (await shelfShown(page)),
          `<= 6 enabled controls above the fold after a run: ${JSON.stringify(record.foldControls)}`
        );
        await shot(page, '2-bench-top', width);
      }
      await page.locator('#lab-result-h').scrollIntoViewIfNeeded();
      await shot(page, '2-bench', width);
      clean('bench');

      // 4. Compare: a copy that changes development time (longer), both run; the comparison card and
      // the microscope compare.
      await page.click('#lab-compare-open');
      await page.waitForSelector('#lab-pair');
      assert.equal(await focusKept(page, 'Compare opened'), 'select#lab-change-what');
      await page.selectOption('#lab-change-what', 'development-time');
      await page.check('#lab-pair [data-lab-change-value="extended"]');
      assert.ok(await page.locator('#lab-pair [data-lab-change-value="sop-default"]').isDisabled(), 'same as run');
      await page.click('#lab-pair-btn');
      await page.waitForSelector('#lab-compare-out .lab-compare');
      const run2 = (await getState(page)).runOrder[1];
      record.changedParams = await page.evaluate(
        ([a, b]) => {
          const runs = window.CortexLab.getState().runs;
          return window.LAB.lab.compare(runs[a], runs[b]).changedParams;
        },
        [run1, run2]
      );
      assert.deepEqual(record.changedParams, ['development.endpoint']);
      assert.equal(
        await page.getAttribute('#lab-compare-out .lab-compare .lab-badge', 'data-lab-label'),
        SYNTHETIC_LABEL
      );
      record.changedText = await text(page.locator('#lab-compare-out .lab-compare .lab-result-summary'));
      assert.ok(
        record.changedText.startsWith('Run 2 differs from Run 1 in development time: longer.'),
        record.changedText
      );
      await page.click('#lab-compare-out [data-lab-why="compare"] .lab-drawer-btn');
      const sites = await page.evaluate(() => window.SilverLab.SITE_CLASSES.length);
      record.deltaRows = await page
        .locator('#lab-compare-out .lab-why-table tbody tr')
        .evaluateAll(rows => rows.map(r => r.cells[r.cells.length - 1].textContent.trim()));
      assert.deepEqual(record.deltaRows, Array(sites).fill('one step darker'), 'one change row per site');
      await page.click('#lab-compare-out [data-lab-why="compare"] .lab-drawer-btn');
      await page.click('#lab-compare-scope');
      await page.waitForSelector('#lab-scope-compare .labm canvas');
      record.compareCanvases = await page.locator('#lab-scope-compare canvas').count();
      assert.equal(record.compareCanvases, 2, 'microscope compare shows two canvases');
      assert.equal(await page.locator('#lab-scope-compare [data-labm-diff]').count(), sites, 'difference table rows');
      record.deltas = await page.locator('#lab-scope-compare [data-labm-diff] .labm-delta').allTextContents();
      assert.deepEqual(record.deltas, Array(sites).fill('+1'), 'longer development: +1 at every site and background');
      record.scopeBadges = await page
        .locator('#lab-scope-compare [data-labm-banner] [data-lab-label]')
        .evaluateAll(nodes => nodes.map(n => n.dataset.labLabel));
      assert.deepEqual(record.scopeBadges, [SYNTHETIC_LABEL], 'one badge for two simulated runs');
      record.stainCanvas = await census(page, '#lab-scope-compare canvas');
      // §11.5 / MODE-micro-1: a standard run performs gold toning, so its deposits are drawn gray-black.
      // MODE-FIX-micro-2 (lab-microscope.js): the field is painted in the background's shade composited
      // over the paper, so a standard run (background low, gold toned) reads as a light gray field with
      // gray-black shapes: the census counts the painted field (paper, stain or gray) and the inked part.
      assert.ok(
        record.stainCanvas.paper + record.stainCanvas.stain + record.stainCanvas.gray > 0.4 &&
          record.stainCanvas.inked > 0.005,
        `a resolved run paints a paper field with stain shapes: ${JSON.stringify(record.stainCanvas)}`
      );
      await allLabeled(page, 'compare');
      await noOverflow(page, 'compare');
      await page.locator('#lab-compare-out').scrollIntoViewIfNeeded();
      await shot(page, '4-compare', width);
      clean('pair');

      // 3. The free bench (MODE §11.1; SHELF §13.3: the jars hold the mix, no Mix panel): a third run starts on
      // an unstained slide with nothing outside the model; develop before any silver is a no-reaction at the
      // jar and in the What happened log; Do the whole procedure dips the procedure's jars from where the
      // slide is (the fruitless develop does not count as done, MODE-integrate-3: all nine, in order) and
      // seals the slide.
      await openRunMenu(page);
      await page.click('#lab-setup-toggle');
      await page.check('#lab-bench-mode input[value="free"]');
      await page.waitForSelector('#lab-newrun-guess');
      assert.equal(await page.locator('#lab-mix').count(), 0, 'no Mix panel on the free bench (SHELF)');
      await page.click('#lab-newrun-create');
      await page.waitForFunction(() => window.CortexLab.getState().runOrder.length === 3);
      const run3 = (await getState(page)).runOrder[2];
      assert.equal(await page.inputValue('#lab-run-select'), run3, 'the new run is active');
      record.setParams = await page.evaluate(id => window.CortexLab.getState().runs[id].events, run3);
      assert.deepEqual(record.setParams, [], 'no setting: the jars hold the mix');
      await page.waitForSelector('#lab-slide-now[data-lab-slide-fresh]');
      assert.equal(await text(page.locator('#lab-do-h')), 'The bench');
      assert.equal(await text(page.locator('#lab-result-h')), 'Slide now');
      record.freeStart = await page.evaluate(() => ({
        look: document.querySelector('#lab-slide-now .lab-look-swatch').dataset.labLook,
        swatch: getComputedStyle(document.querySelector('#lab-slide-now .lab-look-swatch')).backgroundColor,
        gaps: document.querySelectorAll('#lab-slide-now .lab-slide-gaps').length,
        log: document.querySelector('#lab-reactions-empty').textContent.trim(),
        progress: document.querySelectorAll('#lab-do-count, #lab-do-progress, .lab-step[aria-current]').length,
      }));
      assert.deepEqual(
        record.freeStart,
        {
          look: 'unstained',
          swatch: 'rgb(238, 242, 246)',
          gaps: 0,
          log: 'No dip yet. Every dip is written here: a reaction, or none.',
          progress: 0,
        },
        'the free bench starts on an unstained slide (LOOK_COLORS.unstained), nothing next, nothing outside the model'
      );
      // MODE-FIX-shell-28: free rows carry a jar glyph, never the circled numerals (practice keeps them).
      record.freeRows = await page.$$eval('li.lab-step .lab-step-order', nodes =>
        nodes.map(n => [n.classList.contains('lab-step-jar'), n.textContent.trim()])
      );
      assert.equal(record.freeRows.length, 9);
      assert.ok(
        record.freeRows.every(([jar, words]) => jar && words === ''),
        'free bench rows: a jar glyph, no ordinal'
      );
      await page.selectOption('#lab-free-step', 'development');
      await page.click('#lab-free-dip');
      await page.waitForSelector('#lab-reactions > li.lab-reaction-latest');
      const NO_REACTION =
        'No reaction: the developer found no bound silver on the section, so there was nothing to reduce.';
      record.noReaction = await page.evaluate(() => ({
        row: document.querySelector('.lab-step[data-lab-step="development"] .lab-step-note').textContent.trim(),
        log: document.querySelector('#lab-reactions > li.lab-reaction-latest .lab-reaction-text').textContent.trim(),
        kind: document.querySelector('#lab-reactions > li.lab-reaction-latest').dataset.labReaction,
        focus: document.activeElement.id,
      }));
      assert.deepEqual(
        record.noReaction,
        { row: NO_REACTION, log: NO_REACTION, kind: 'no-reaction', focus: 'lab-free-dip' },
        'develop before any silver: the no-reaction line at the jar and in the log'
      );
      await page.click('#lab-run-all');
      await page.waitForFunction(
        id => window.LAB.lab.resolve(window.CortexLab.getState().runs[id]).slide.coverslipped === true,
        run3
      );
      record.card = await page.evaluate(() => {
        const card = document.querySelector('#lab-slide-now'),
          badge = card.querySelector('.lab-banner .lab-badge');
        return {
          outcome: card.dataset.labOutcome,
          badge: [badge.dataset.labBadge, badge.dataset.labLabel],
          look: card.querySelector('.lab-look-swatch').dataset.labLook,
          flags: card.querySelector('.lab-slide-flags').textContent.trim(),
          gaps: !!card.querySelector('.lab-slide-gaps'),
          reactions: document.querySelectorAll('#lab-reactions > li').length,
          latest: document.querySelectorAll('#lab-reactions > li.lab-reaction-latest').length,
          dipDisabled: document.querySelector('#lab-free-dip').disabled,
          wholeDisabled: document.querySelector('#lab-run-all').disabled,
        };
      });
      assert.equal(record.card.outcome, run3);
      assert.deepEqual(record.card.badge, ['simulated', SYNTHETIC_LABEL]);
      assert.ok(record.card.flags.includes('sealed under a coverslip'), record.card.flags);
      assert.ok(
        !record.card.gaps && record.card.reactions === 10 && record.card.latest === 1,
        JSON.stringify(record.card)
      );
      assert.equal(record.card.look, 'gray-black', 'the whole procedure on this slide: gold toned');
      assert.ok(record.card.dipDisabled && record.card.wholeDisabled, 'sealed: no more dips');
      await noEngineIds(page, 'the free bench');
      await allLabeled(page, 'the free bench');
      await page.locator('#lab-slide-now').scrollIntoViewIfNeeded();
      await shot(page, '3-free-bench', width);
      // the microscope opens on the free run's picture
      await page.goto(lab({ view: 'microscope', run: run3 }), { waitUntil: 'networkidle' });
      await drawingView(page); // REF: a gold-toned free run on specimen A opens on the Real slide view
      assert.equal(
        await page.getAttribute('#lab-scope-host [data-labm-banner] [data-lab-label]', 'data-lab-label'),
        SYNTHETIC_LABEL
      );
      clean('the free bench');
      clean('Not modeled');

      // 13. Persistence: reload; the first run and its outcome are rebuilt from the saved events.
      await page.goto(lab({ view: 'bench', run: run1 }), { waitUntil: 'networkidle' });
      await page.waitForSelector('#lab-resolve-out .lab-result-card');
      assert.equal(await page.inputValue('#lab-run-select'), run1);
      assert.equal(await page.locator('#lab-history .lab-log-table tbody tr').count(), 9, 'nine events after reload');
      assert.equal(
        await page.getAttribute('#lab-resolve-out .lab-banner .lab-badge', 'data-lab-label'),
        SYNTHETIC_LABEL
      );
      record.rehydrated = await page.evaluate(id => {
        const s = window.CortexLab.getState();
        return {
          runs: s.runOrder.length,
          stepsDone: s.runs[id].stepsDone.length,
          label: window.LAB.lab.resolve(s.runs[id]).label,
        };
      }, run1);
      assert.deepEqual(record.rehydrated, { runs: 3, stepsDone: 9, label: SYNTHETIC_LABEL });
      clean('persistence');

      // 5. Activities: M3 curves (three polylines, model-scale ticks, no units, badge, Keep in mind
      // under Why?); the stepper's Next / Back by mouse and keyboard; the M1 Sources chips.
      await page.goto(lab({ view: 'module:M3' }), { waitUntil: 'networkidle' });
      await page.waitForSelector('main.lab-view-module .lab-curves svg');
      await oneH1(page, 'module M3');
      const figure = page.locator('.lab-curves').first();
      record.polylines = await figure.locator('polyline').count();
      assert.equal(record.polylines, 3);
      record.ticks = await figure.locator('.lab-curve-tick').allTextContents();
      assert.deepEqual(record.ticks, await page.evaluate(() => window.SilverLab.ORDINAL_TEXT), 'model-scale ticks');
      const figureText = await text(figure);
      assert.doesNotMatch(figureText, DIGITS_WITH_UNITS, 'no digits with units on the curves');
      assert.equal(
        await figure.locator('.lab-banner [data-lab-label]').getAttribute('data-lab-label'),
        SYNTHETIC_LABEL
      );
      await figure.locator('[data-lab-why="curves"] .lab-drawer-btn').click();
      record.caveats = await figure.locator('.lab-caveats li').allTextContents();
      assert.ok(record.caveats.length && record.caveats[0] !== 'none', 'curve caveats listed under Why?');
      await allLabeled(page, 'curves');
      await noOverflow(page, 'module M3');
      await figure.scrollIntoViewIfNeeded();
      await shot(page, '5-m3', width);
      const stepNow = () =>
        page.evaluate(() => [
          document.querySelector('.lab-mstep').dataset.labMstep,
          new URL(location.href).searchParams.get('step') || '1', // step 1 drops the key
        ]);
      await page.click('#lab-module-next');
      await page.waitForSelector('.lab-mstep[data-lab-mstep="2"]');
      assert.deepEqual(await stepNow(), ['2', '2'], 'Next swaps the screen and the URL');
      assert.equal(await focusKept(page, 'Next'), `h2#${await page.getAttribute('.lab-mstep h2', 'id')}`);
      await page.focus('#lab-module-prev');
      await page.keyboard.press('Enter');
      await page.waitForSelector('.lab-mstep[data-lab-mstep="1"]');
      assert.deepEqual(await stepNow(), ['1', '1'], 'Back by keyboard');
      assert.equal(await focusKept(page, 'Back'), `h2#${await page.getAttribute('.lab-mstep h2', 'id')}`);
      await page.goto(lab({ view: 'module:M1' }), { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-lab-drawer="module-sources"] .lab-drawer-btn');
      assert.ok((await page.locator('.lab-readfirst-list li').count()) <= 3, 'at most three Read first facts');
      await page.click('[data-lab-drawer="module-sources"] .lab-drawer-btn');
      await page.locator('.lab-fact-list .lab-chip[aria-expanded]').first().click();
      const detail = page.locator('.lab-fact-list .lab-chip-detail:not([hidden])');
      assert.equal(await detail.count(), 1, 'a claim chip opens its detail');
      record.citation = await detail.locator('.lab-sources li').allTextContents();
      assert.ok(
        record.citation.length && /\bS-[a-z0-9-]+/.test(record.citation[0]) && record.citation[0].length > 30,
        `claim detail cites a source: ${record.citation}`
      );
      clean('modules');
      // Every activity screen: one prompt of at most two sentences, no engine identifier (desktop).
      if (desktop) {
        record.screens = 0;
        const modules = await page.evaluate(() => window.LAB.lab.listModules().map(m => m.id));
        for (const id of modules) {
          for (let n = 1; ; n++) {
            await page.goto(lab({ view: `module:${id}`, step: String(n) }), { waitUntil: 'networkidle' });
            await page.waitForSelector('.lab-mstep');
            if (Number(await page.getAttribute('.lab-mstep', 'data-lab-mstep')) !== n) break; // clamped
            record.screens++;
            await oneH1(page, `${id} step ${n}`);
            const prompt = await text(page.locator('.lab-mstep-prompt'));
            assert.ok(sentences(prompt) <= 2, `${id} step ${n}: prompt of at most two sentences: ${prompt}`);
            await noEngineIds(page, `${id} step ${n}`);
          }
        }
        assert.ok(record.screens >= 20, `every activity screen visited: ${record.screens}`);
        clean('activity screens');
      }

      // 6. Microscope keyboard on two runs: objective, zoom, pan, layers, compare toggle, Esc; then one
      // measurement through the Measure sheet.
      await page.goto(lab({ view: 'microscope', run: `${run1},${run2}` }), { waitUntil: 'networkidle' });
      await page.waitForSelector('#lab-scope-host .labm canvas');
      await oneH1(page, 'microscope');
      await noEngineIds(page, 'microscope');
      assert.equal(await page.locator('#lab-scope-host canvas').count(), 2);
      // A11Y-06 / K7: nothing is announced on mount; the engine's full description sits in the Numbers
      // expander ([data-labm-text-alt]) and a user's view change speaks one short sentence.
      const live = () => page.evaluate(() => document.querySelector('#lab-scope-host [data-labm-live]').textContent);
      const textAlt = () =>
        page.evaluate(() => document.querySelector('#lab-scope-host [data-labm-text-alt]').textContent);
      await page.waitForFunction(() =>
        /Objective: \d+x/.test(document.querySelector('#lab-scope-host [data-labm-text-alt]').textContent)
      );
      assert.equal(await live(), '', 'nothing announced on mount');
      record.live0 = await textAlt();
      await page.focus('#lab-scope-host [role="application"]');
      await page.keyboard.press('2');
      assert.equal(
        await page.locator('#lab-scope-host [data-labm-objective="10"][aria-pressed="true"]').count(),
        1,
        'key 2 = 10x'
      );
      await page.keyboard.press('+');
      await page.waitForFunction(() =>
        /Zoom 1\.25x/.test(document.querySelector('#lab-scope-host [data-labm-live-delta]').textContent)
      );
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('l');
      await page.waitForSelector('#lab-scope-host .labm[data-labm-tab="layers"]');
      await page.waitForFunction(() =>
        /simulated picture with layers/.test(document.querySelector('#lab-scope-host [data-labm-text-alt]').textContent)
      );
      await page.keyboard.press('c');
      await page.waitForSelector('#lab-scope-host [data-labm-stage="single"]');
      await page.waitForFunction(
        () => !/Experimental side/.test(document.querySelector('#lab-scope-host [data-labm-text-alt]').textContent)
      );
      record.live1 = await textAlt();
      assert.notEqual(record.live1, record.live0, 'the description changed with the view');
      assert.ok(record.live1.includes('Illustrative simulation'), `description: ${record.live1}`);
      assert.ok(record.live1.includes('Objective: 10x') && record.live1.includes('Zoom: 1.25x'), record.live1);
      await page.waitForFunction(() =>
        document
          .querySelector('#lab-scope-host [data-labm-live]')
          .textContent.startsWith('Simulated, not a measurement.')
      );
      record.spoken = await live();
      assert.ok(
        record.spoken.startsWith('Simulated, not a measurement. Baseline run, 10x, layers on: '),
        `the live sentence after C: ${record.spoken}`
      );
      assert.doesNotMatch(record.spoken, /Illustrative simulation|ordinal|sop-default/, 'a short plain sentence');
      await allLabeled(page, 'microscope');
      await page.keyboard.press('Escape');
      await page.waitForSelector('main.lab-view-bench #lab-resolve-out .lab-result-card');
      await oneH1(page, 'bench after Esc from the full microscope view');
      assert.equal(await page.inputValue('#lab-run-select'), run1, 'Esc returns to the bench on the first run');
      await page.goto(lab({ view: 'microscope', run: run1 }), { waitUntil: 'networkidle' });
      // REF (contract §12.3 / §12.5): the free run's step above chose Drawing (simulation), and the choice is
      // remembered (settings.microscopeView), so this run opens on the drawing; Real slide brings the photo
      // back as its own labeled figure, with the view switch, the credit line (the article and the license
      // links) and the honesty lines under it; Drawing (simulation) switches back to the canvas.
      await page.waitForSelector('#lab-scope-host div.labm-view button[data-labm-view="real"]');
      record.scopeRemembered = await page.evaluate(() => [
        window.CortexLab.getSetting('microscopeView'),
        document.querySelector('#lab-scope-host [data-labm-view="drawing"]').getAttribute('aria-pressed'),
        document.querySelectorAll('#lab-scope-host .labm canvas').length,
      ]);
      assert.deepEqual(record.scopeRemembered, ['drawing', 'true', 1], 'Drawing (simulation) is remembered');
      await page.click('#lab-scope-host [data-labm-view="real"]');
      await page.waitForSelector('#lab-scope-host figure.labm-observed img');
      await page.waitForFunction(() => {
        const img = document.querySelector('#lab-scope-host figure.labm-observed img');
        return !!img && img.complete && img.naturalWidth > 0;
      });
      assert.equal(
        await page.evaluate(() => window.CortexLab.getSetting('microscopeView')),
        'real',
        'the switch writes the setting through the shell'
      );
      record.scopeReal = await page.evaluate(() => {
        const host = document.querySelector('#lab-scope-host');
        const figure = host.querySelector('figure.labm-observed');
        const credit = host.querySelector('p.labm-credit');
        const view = host.querySelector('div.labm-view');
        const img = figure.querySelector('img');
        return {
          label: figure.dataset.labLabel,
          src: img.getAttribute('src'),
          loaded: img.complete && img.naturalWidth > 0,
          view: view && view.getAttribute('aria-label'),
          pressed:
            view &&
            [...view.querySelectorAll('button[data-labm-view]')].map(b => [
              b.dataset.labmView,
              b.getAttribute('aria-pressed'),
            ]),
          credit: credit && credit.textContent.replace(/\s+/g, ' ').trim(),
          links: credit ? [...credit.querySelectorAll('a[href]')].map(a => a.getAttribute('href')) : [],
          text: host.textContent.replace(/\s+/g, ' '),
        };
      });
      assert.equal(record.scopeReal.label, 'observed-reference', 'the photo carries the brief label');
      assert.match(record.scopeReal.src, /^\/assets\/lab\/reference\//);
      assert.ok(record.scopeReal.loaded, 'the photo loaded');
      assert.equal(record.scopeReal.view, 'Picture', 'the view switch');
      assert.deepEqual(
        record.scopeReal.pressed,
        [
          ['real', 'true'],
          ['drawing', 'false'],
        ],
        'Real slide by default'
      );
      assert.ok(record.scopeReal.credit, 'a credit line under the photo');
      assert.match(
        record.scopeReal.credit,
        /\b(19|20)\d\d\b.*Fig\. .*\(cropped\).*CC BY/,
        `the credit: ${record.scopeReal.credit}`
      );
      assert.ok(
        record.scopeReal.links.some(h => /pmc\.ncbi\.nlm\.nih\.gov/.test(h)) &&
          record.scopeReal.links.some(h => /creativecommons\.org\/licenses\//.test(h)),
        `the article and the license links: ${record.scopeReal.links}`
      );
      assert.match(record.scopeReal.text, /Real slide · observed reference/);
      assert.match(record.scopeReal.text, /A real slide from a published study, not your run\./);
      assert.match(record.scopeReal.text, /Darker does not mean more protein, more pathology or a better method\./);
      await noEngineIds(page, 'microscope, real slide');
      await drawingView(page);
      assert.equal(
        await page.getAttribute('#lab-scope-host [data-labm-view="drawing"]', 'aria-pressed'),
        'true',
        'Drawing (simulation) switches back'
      );
      await page.waitForSelector('#lab-scope-host [data-labm-measure-open]');
      await page.click('#lab-scope-host [data-labm-measure-open]');
      assert.equal(await page.getAttribute('#lab-scope-host [data-labm-measure-open]', 'aria-expanded'), 'true');
      assert.equal(await page.locator('#lab-scope-host [data-labm-tools] [data-labm-tool]').count(), 5, 'five tools');
      await page.click('#lab-scope-host [data-labm-tool="contrast-ordinal"]');
      assert.equal(await page.locator('#lab-scope-host [data-labm-tool-form]').count(), 0, 'the rule comes first');
      await page.check('#lab-scope-host [data-labm-rule-ok]');
      await page.waitForSelector('#lab-scope-host [data-labm-tool-form="contrast-ordinal"]');
      await page.click('#lab-scope-host [data-labm-sample]');
      await page.click('#lab-scope-host [data-labm-tool-form] button[type="submit"]');
      await page.waitForFunction(() => window.CortexLab.getState().measurementOrder.length === 1);
      record.measurement = await page.evaluate(() => {
        const s = window.CortexLab.getState();
        const m = s.measurements[s.measurementOrder[0]];
        return { runId: m.runId, label: m.label, measurementId: m.measurementId };
      });
      assert.deepEqual(record.measurement, {
        runId: run1,
        label: SYNTHETIC_LABEL,
        measurementId: 'contrast-ordinal',
      });
      assert.match(await text(page.locator('#lab-scope-host [data-labm-status]')), /^Recorded: /);
      await focusKept(page, 'measurement saved');
      await noOverflow(page, 'microscope');
      clean('microscope');

      // 7. Designer: two screens (SIMPLE); the gate lists what is left; fill every required field; reveal
      // one card with its badge, the locked summary and the interpretation boxes.
      await page.goto(lab({ view: 'designer' }), { waitUntil: 'networkidle' });
      await page.waitForSelector('#lab-designer-host .labn-designer');
      await oneH1(page, 'designer');
      await noEngineIds(page, 'designer');
      assert.equal(await page.locator('[data-labn-wizard-step]').count(), 2, 'two wizard screens');
      const shownStep = () =>
        page.evaluate(() => document.querySelector('[data-labn-wizard-step]:not([hidden])').dataset.labnWizardStep);
      const next = async () => {
        await page.click('[data-labn-action="wizard-next"]');
        await focusKept(page, 'wizard Next');
      };
      const reveal = page.locator('[data-labn-action="reveal"]');
      assert.ok(await reveal.isDisabled(), 'Reveal starts disabled');
      record.reasons = await page
        .locator('.labn-reasons li[data-labn-reason]')
        .evaluateAll(nodes => nodes.map(n => n.dataset.labnReason));
      assert.ok(
        record.reasons.length >= 6 && record.reasons.includes('predictions.expected is empty'),
        `reasons: ${record.reasons}`
      );
      assert.equal(await page.locator('.labn-designer .labn-card').count(), 0, 'no outcome card before reveal');
      const field = name => page.locator(`[data-labn-field="${name}"]`);
      assert.equal(await shownStep(), '1');
      await field('question').fill('Does a longer development time change simulated plaque-core visibility?');
      await field('hypothesis').fill('Longer development raises visible silver at sites already nucleated.');
      await page.click('[data-labn-toggle="more-question"]');
      await field('alternative').fill('Background rises as fast as the targets, so contrast does not change.');
      await page.click('[data-labn-toggle="more-design"]');
      await field('independentVariable').fill('development time');
      await page.locator('input[data-labn-field="measures"][value="contrast-ordinal"]').check();
      await page.locator('input[data-labn-control-type="baseline-process"]').check();
      await field('controls.0.addresses').fill('process drift between the two runs');
      await field('baselineRunId').selectOption(run1);
      await field('experimentalRunId').selectOption(run2);
      await next();
      assert.equal(await shownStep(), '2', 'predict and reveal share the second screen');
      await field('predictions.expected').fill('Targets one step darker, background too; supports an endpoint effect.');
      await field('predictions.negligible').fill('No per-site change; the endpoint is not limiting here.');
      await field('predictions.opposite').fill('Targets lighter than baseline; loss of differentiation.');
      await page.waitForFunction(() => !document.querySelector('[data-labn-action="reveal"]').disabled, null, {
        timeout: 5000,
      });
      assert.equal(await page.locator('.labn-reasons li[data-labn-reason]').count(), 0, 'no gate reason remains');
      assert.equal(await page.locator('.labn-designer .labn-card').count(), 0, 'still no card before reveal');
      await noOverflow(page, 'designer');
      await shot(page, '7-designer', width);
      await reveal.click();
      await page.waitForSelector('.labn-card');
      record.cards = await page.locator('.labn-card').count();
      assert.equal(record.cards, 1, 'reveal shows one outcome card');
      assert.equal(await page.getAttribute('.labn-card [data-lab-badge]', 'data-lab-label'), SYNTHETIC_LABEL);
      // RC-1 (UX-R2-notebook-1): "Your outcome measures" states the chosen contrast measure for both
      // runs on the model scale, before the cards, with its badge and the measurement recorded in step 6.
      const measures = page.locator('[data-labn-measures-out]');
      assert.equal(await text(measures.locator('h4')), 'Your outcome measures');
      assert.equal(
        await measures.evaluate(node => node.compareDocumentPosition(document.querySelector('.labn-card')) & 4),
        4,
        'the outcome measures come before the cards'
      );
      assert.equal(
        await measures.locator('.labn-card-head [data-lab-badge]').getAttribute('data-lab-label'),
        SYNTHETIC_LABEL
      );
      const contrastWords = await page.evaluate(
        ([a, b]) => {
          const runs = window.CortexLab.getState().runs;
          const cmp = window.LAB.lab.compare(runs[a], runs[b]);
          return [cmp.baseline.contrast, cmp.experimental.contrast].map(n => window.CortexLab.level(n));
        },
        [run1, run2]
      );
      record.measureLine = await text(
        measures.locator('[data-labn-measure-out="contrast-ordinal"] [data-labn-measure-line]')
      );
      assert.equal(
        record.measureLine.split(' (')[0],
        contrastWords[0] === contrastWords[1]
          ? `Target/background contrast: ${contrastWords[0]} in both runs`
          : `Target/background contrast: ${contrastWords[0]} in the baseline, ${contrastWords[1]} in the experimental run`,
        `the reveal gives the contrast of both runs: ${record.measureLine}`
      );
      assert.match(record.measureLine, /on the model scale\)\.$/, record.measureLine);
      record.measureRecorded = await measures.locator('[data-labn-recorded]').allTextContents();
      assert.equal(record.measureRecorded.length, 1, 'the contrast measurement recorded for the baseline is listed');
      assert.match(record.measureRecorded[0], /^Recorded for the baseline run: /);
      assert.ok(await page.locator('[data-labn-summary]').isVisible(), 'the locked design shows as a summary');
      await noEngineIds(page, 'designer after the reveal');
      await focusKept(page, 'reveal');
      record.interpretation = await page
        .locator('[data-labn-field^="interpretation."]')
        .evaluateAll(nodes => nodes.map(n => n.dataset.labnField));
      assert.deepEqual(record.interpretation, [
        'interpretation.supports',
        'interpretation.failsToEstablish',
        'interpretation.next',
      ]);
      await page.waitForFunction(() => window.CortexLab.getState().experimentOrder.length === 1);
      record.experiment = await page.evaluate(() => {
        const s = window.CortexLab.getState();
        return s.experiments[s.experimentOrder[0]].status;
      });
      assert.equal(record.experiment, 'revealed');
      await allLabeled(page, 'designer');
      await measures.scrollIntoViewIfNeeded();
      await shot(page, '7-reveal', width);
      // 7b. UX-SMALL-notebook-1 / UX-SMALL-lab.js-1: the reveal's "Look at both in the microscope" opens
      // the microscope with the way back; "Back to your experiment" and Esc both reopen the designer on
      // the same (reveal) step with the same experiment.
      const designedExp = (await getState(page)).experimentOrder[0];
      const query = () => page.evaluate(() => Object.fromEntries(new URLSearchParams(location.search)));
      const toScope = async label => {
        await page.click('[data-labn-scope-link]');
        await page.waitForSelector('main.lab-view-microscope #lab-scope-host .labm canvas');
        await oneH1(page, label);
        const q = await query();
        assert.deepEqual(
          [q.view, q.run, q.from, q.exp, q.step, q.at],
          ['microscope', `${run1},${run2}`, 'designer', designedExp, '2', 'compare'], // SIMPLE: screen 2
          `${label}: the microscope keeps the way back: ${JSON.stringify(q)}`
        );
        assert.match(
          await text(page.locator('main.lab-view-microscope .lab-backlink a')),
          /Back to your experiment$/,
          `${label}: the back link names the experiment`
        );
      };
      const backInDesigner = async label => {
        await page.waitForSelector('main.lab-view-designer #lab-designer-host .labn-designer');
        await oneH1(page, label);
        const q = await query();
        assert.deepEqual(
          [q.view, q.exp, q.step, q.at],
          ['designer', designedExp, '2', 'compare'],
          `${label}: ${JSON.stringify(q)}`
        );
        assert.equal(await shownStep(), '2', `${label}: the designer is on the same screen`);
        assert.equal(await page.locator('.labn-designer .labn-card').count(), 1, `${label}: still revealed`);
        // UX-POLISH-notebook-5 / lab.js-6: it lands on the section the student left (the comparison),
        // heading focused, below the top bar and in view, not at the page top.
        // The designer scrolls smoothly after a frame: wait for the focused heading to come into view
        // (or time out and report where it is), then for the scroll to stop.
        await page
          .waitForFunction(
            () => {
              const a = document.activeElement;
              if (!a || !a.closest('.labn-compare')) return false;
              const r = a.getBoundingClientRect();
              return r.top >= 0 && r.bottom <= innerHeight;
            },
            null,
            { timeout: 5000 }
          )
          .catch(() => {});
        await settled(page);
        const landed = await page.evaluate(() => {
          const a = document.activeElement,
            r = a.getBoundingClientRect(),
            bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lab-topbar-h')) || 64;
          return {
            text: a.textContent.trim(),
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            bar: Math.round(bar),
            vh: innerHeight,
            y: Math.round(scrollY),
          };
        });
        (record.landed ||= []).push(landed);
        assert.ok(
          landed.text === 'Compared with your baseline' &&
            landed.top >= landed.bar - 1 &&
            landed.bottom <= landed.vh &&
            landed.y > 0,
          `${label}: back on the comparison, in view: ${JSON.stringify(landed)}`
        );
      };
      await toScope('microscope from the designer');
      await shot(page, '7b-scope-from-designer', width);
      await page.click('main.lab-view-microscope .lab-backlink a');
      await backInDesigner('designer after "Back to your experiment"');
      await toScope('microscope from the designer, again');
      await page.focus('#lab-scope-host [role="application"]');
      await page.keyboard.press('Escape');
      await backInDesigner('designer after Esc in the microscope');
      record.scopeRoundTrip = 'ok';
      clean('designer');

      // 8. Report: the lab work collected from state (never written into the entries, so the export
      // is unchanged by opening it), one entry of each type, word tags in the UI, bracket tags in the
      // export, the downloaded file byte-identical to exportMarkdown(state).
      // The designer's debounced save lands on leaving it: read the export on a neutral view first.
      await page.goto(lab({ view: 'modules' }), { waitUntil: 'networkidle' });
      await page.waitForSelector('main.lab-view-modules h1');
      const exportBefore = await page.evaluate(() =>
        window.CortexLabNotebook.exportMarkdown(window.CortexLab.getState(), window.LAB.lab)
      );
      await page.goto(lab({ view: 'notebook' }), { waitUntil: 'networkidle' });
      await page.waitForSelector('#lab-notebook-host .labn-notebook');
      await oneH1(page, 'notebook');
      await noEngineIds(page, 'report');
      const nb = page.locator('.labn-notebook');
      record.work = await nb
        .locator('[data-labn-work]')
        .evaluateAll(nodes => nodes.map(n => `${n.dataset.labnWork}:${n.dataset.labnRef}`));
      const expId = (await getState(page)).experimentOrder[0];
      const measurementRef = (await getState(page)).measurementOrder[0];
      assert.deepEqual(
        record.work,
        [`run:${run1}`, `run:${run2}`, `run:${run3}`, `measurement:${measurementRef}`, `experiment:${expId}`],
        'finished runs, the measurement and the revealed experiment are collected'
      );
      assert.equal((await getState(page)).notebook.entries.length, 0, 'nothing written into the entries');
      assert.equal(
        await page.evaluate(() => window.CortexLabNotebook.exportMarkdown(window.CortexLab.getState(), window.LAB.lab)),
        exportBefore,
        'opening the report leaves the export byte-identical'
      );
      await allLabeled(page, 'report lab work');
      const draft = key => nb.locator(`[data-labn-draft="${key}"]`);
      const add = async (type, fill, count) => {
        await nb.locator('[data-labn-action="add-menu"]').click();
        await nb.locator(`[data-labn-add-type="${type}"]`).click();
        await fill();
        await nb.locator('[data-labn-add-form] button[type="submit"]').click();
        await page.waitForFunction(n => document.querySelectorAll('.labn-entry').length === n, count);
        assert.equal(await text(nb.locator('[data-labn-add-error]')), '', `${type} entry added without error`);
        await focusKept(page, `${type} entry added`);
      };
      await add(
        'published',
        async () => {
          await draft('search').fill('temperature');
          await nb.locator('input[data-labn-draft="claimId"][value="C-litchfield-2001-temp"]').check();
          await draft('text').fill('Temperature sensitivity motivates holding temperature comparable.');
        },
        1
      );
      await add(
        'observed',
        async () => {
          await draft('observedAt').fill('2026-10-10');
          await draft('text').fill(
            'In the teaching lab the ammoniacal step was run in the hood; noted for the instructor.'
          );
        },
        2
      );
      await add(
        'simulated',
        async () => {
          await draft('runId').selectOption(run2);
          await draft('text').fill('Longer development raised simulated visible silver by one step at every site.');
        },
        3
      );
      await add(
        'reflection',
        async () => {
          await draft('text').fill('Run the negative comparison pair before any pretreatment probe.');
        },
        4
      );
      record.tags = await nb.locator('.labn-entry .labn-tag').allTextContents();
      for (const tag of TAG_WORDS) assert.ok(record.tags.includes(tag), `${tag} visible in ${record.tags}`);
      assert.ok(!(await text(nb)).includes('[Simulated'), 'bracket tags only in the export');
      await allLabeled(page, 'report entries');
      const [download] = await Promise.all([page.waitForEvent('download'), page.click('#labn-export')]);
      record.download = download.suggestedFilename();
      assert.equal(record.download, 'my-lab-report.md');
      assert.equal(record.download, await page.evaluate(() => window.CortexLabNotebook.fileName));
      const downloaded = readFileSync(await download.path(), 'utf8');
      const exported = await page.evaluate(() =>
        window.CortexLabNotebook.exportMarkdown(window.CortexLab.getState(), window.LAB.lab)
      );
      assert.equal(downloaded, exported, 'the downloaded file is byte-identical to exportMarkdown(state)');
      assert.notEqual(exported, exportBefore, 'the four entries are in the export');
      // UX-SMALL / UX-POLISH (export v2, ENGINE-11 and UX-POLISH-notebook-1): the app's run titles, step
      // titles and setting words; plain specimen, method and control names; three-line answers; a
      // "Summary:" per run with the label and the engine's full description kept in "Model detail
      // (for instructors)". The expected words come from the page's own CortexLab and engine.
      const names = await page.evaluate(
        ([a, b]) => {
          const L = window.CortexLab,
            lab = window.LAB.lab,
            s = L.getState();
          return {
            titles: [a, b].map(id => L.runTitle(s.runs[id])),
            summaries: [a, b].map(id => L.summarize(lab.resolve(s.runs[id]))),
            descriptions: [a, b].map(id =>
              lab.describeOutcome(lab.resolve(s.runs[id]), lab.getSpecimen(s.runs[id].specimenId))
            ),
            specimens: [a, b].map(id => lab.getSpecimen(s.runs[id].specimenId).studentLabel),
            method: lab.getMethod('bielschowsky-modified').title,
            steps: [a, b].flatMap(id =>
              s.runs[id].events.filter(ev => ev.type === 'step').map(ev => [ev.seq, ev.step, L.stepTitle(ev.step)])
            ),
            stepIds: [...window.SilverLab.STEPS],
            guide: lab.getSource('S-course-guide'),
            sections: window.SilverLab.SECTIONS.map(x => window.SilverLab.SECTION_TEXT[x]),
            contrast: [a, b].map(id => lab.resolve(s.runs[id]).contrast),
            words: [...window.SilverLab.ORDINAL_TEXT],
            codes: [...window.SilverLab.BASIS],
            cited: (claim => ({
              text: claim.text,
              refs: claim.sources.map(id => lab.getSource(id)).map(x => `${x.citation} <${x.url}>`),
            }))(lab.getClaim('C-litchfield-2001-temp')),
          };
        },
        [run1, run2]
      );
      record.exportRunTitles = names.titles;
      // UX-LAST (ENGINE-13, export v3): every experiment and run field a "- Field: value" item in the
      // designer's words, blank lines around every list, the events a numbered list of their own, the
      // revealed experiment's Model readout (simulated), the student's Sources in words, and every
      // claim / source id and strength code only under "Model detail (for instructors)".
      const DETAIL = '## Model detail (for instructors)';
      const readout = `- Model readout (simulated): Target/background contrast: ${readoutText(names.contrast, names.words)}`;
      for (const markdown of [downloaded, exported]) {
        assert.ok(markdown.includes(DISCLAIMER), 'export carries the disclaimer header');
        for (const tag of TAGS) assert.ok(markdown.includes(tag), `export carries ${tag}`);
        const lines = markdown.split('\n');
        assert.deepEqual(
          lines.slice(0, 3),
          [`# My lab report: ${LABEL}`, '', 'Name: ________'],
          'the header leaves a Name line to fill in'
        );
        assert.deepEqual(
          lines.filter(l => l.startsWith('## ')),
          [...names.sections, 'Experiment log', 'Sources', DETAIL.slice(3)].map(h => `## ${h}`),
          'section order: Sources after the log, the instructors’ appendix last'
        );
        assert.deepEqual(markdownProblems(markdown), [], 'every field a list item, a blank line around every list');
        assert.deepEqual(studentPartProblems(markdown, names.codes), [], 'no id or strength code before Model detail');
        const [body, appendix] = markdown.split(`\n${DETAIL}\n`);
        const log = body.split('\n## Experiment log\n')[1].split('\n## Sources\n')[0].split('\n');
        const sources = body.split('\n## Sources\n')[1].split('\n').filter(Boolean);
        assert.doesNotMatch(markdown, /Run run-/, 'no raw run ids in the export');
        assert.doesNotMatch(body, /SPEC-|bielschowsky-modified/, 'no specimen or method id outside the appendix');
        // SIMPLE-notebook: a blank title is filled from the change ("<change> vs standard"), never the id.
        assert.ok(
          lines.some(l => /^### .+ vs standard$/.test(l)),
          `an untitled experiment is headed by its change: ${JSON.stringify(lines.filter(l => l.startsWith('### ')))}`
        );
        assert.doesNotMatch(markdown, /^### exp-/m, 'no experiment id as a heading');
        assert.deepEqual(
          lines.filter(l => l.startsWith('#### ')).map(l => l.slice(5)),
          names.titles,
          "the Experiment log's run headings are the app's run titles"
        );
        assert.ok(
          lines.includes(`  ${names.titles[1]}, label: ${SYNTHETIC}`),
          'the simulated entry names its run by title and keeps its label'
        );
        // The designer's field names; the main variable says what "What you change" says (step 7 typed
        // only the main variable), so it has no line of its own; the two runs by name.
        assert.ok(
          log.includes('- What you change: development time'),
          'What you change falls back to the main variable'
        );
        assert.ok(!log.some(l => l.startsWith('- Main variable (the one you test): ')), 'no repeated main variable');
        assert.ok(
          log.includes(`- Baseline run (standard): ${names.titles[0]}`) &&
            log.includes(`- Experimental run (with your change): ${names.titles[1]}`),
          'the baseline and the experimental run by name'
        );
        // Plain names: the specimen as students see it (not real tissue), the procedure method, the
        // control as the designer names it; a baseline process comparison carries no stand-in note.
        assert.deepEqual(
          log.filter(l => l.startsWith('- Specimen: ')),
          names.specimens.map(n => `- Specimen: ${n} (not real tissue)`)
        );
        assert.deepEqual(
          log.filter(l => l.startsWith('- Method: ')),
          [`- Method: ${names.method}`, `- Method: ${names.method}`]
        );
        assert.deepEqual(
          log.filter(l => l.startsWith('- Controls: ')),
          ['- Controls: Baseline process comparison, rules out: process drift between the two runs']
        );
        // Three-line answers.
        for (const line of [
          '- Expected outcome: Targets one step darker, background too; supports an endpoint effect.',
          '- Negligible change: No per-site change; the endpoint is not limiting here.',
          '- Opposite outcome: Targets lighter than baseline; loss of differentiation.',
        ])
          assert.ok(log.includes(line), line);
        const interpretationAt = log.findIndex(
          l => l === '- Interpretation: not written' || l.startsWith('- What it supports: ')
        );
        assert.ok(
          log[interpretationAt] === '- Interpretation: not written' ||
            ['- What it supports: ', '- What it fails to establish: ', '- Next experiment: '].every(n =>
              log.some(l => l.startsWith(n))
            ),
          'the interpretation as three lines (or not written)'
        );
        // The revealed experiment's Model readout: the contrast of both runs in model-scale words, after
        // the limits and before the interpretation (the designer's step 4 order), no digit.
        assert.deepEqual(
          log.filter(l => l.startsWith('- Model readout (simulated): ')),
          [readout]
        );
        const readoutAt = log.indexOf(readout);
        assert.ok(
          log.findIndex(l => l.startsWith('- Limits of your design: ')) < readoutAt && readoutAt < interpretationAt,
          'the readout sits between the limits and the interpretation'
        );
        assert.doesNotMatch(readout, /\d/, 'the readout has no digit');
        // The settings and the toning / thiosulfate record.
        assert.deepEqual(
          log.filter(l => /^- Settings( changed from standard)?: /.test(l)),
          ['- Settings: all standard (per procedure)', '- Settings changed from standard: Development time: longer']
        );
        // MODE-engine-6 (§11.5): the toning / thiosulfate line in the course procedure's words.
        assert.equal(
          log.filter(
            l =>
              l ===
              '- Toning and thiosulfate: performed (the stain turns from brown-black to gray-black; silver that was never reduced is removed, so the slide stops changing)'
          ).length,
          2
        );
        assert.ok(!lines.some(l => /^(- )?Effective params: /.test(l)), 'no parameter dump');
        // ENGINE-14: step 6's measurement prints in model-scale words, never a digit.
        const measuredLines = log.filter(l => l.startsWith('  - [Simulated: illustrative, not a measurement] '));
        assert.equal(measuredLines.length, 1, measuredLines.join(' / '));
        assert.match(
          measuredLines[0],
          /^ {2}- \[Simulated: illustrative, not a measurement\] Target\/background contrast: (none|trace|low|moderate|high) \(model scale\) \((manual|derived)\)(, note: .+)?$/
        );
        assert.doesNotMatch(measuredLines[0], /\d/, 'the measurement line has no digit');
        // Numbered event lines (a list of their own after "- Events:" and a blank line), each step by name.
        assert.deepEqual(
          log.flatMap((l, n) => (l === '- Events:' ? [[log[n + 1], /^1\. /.test(log[n + 2])]] : [])),
          [
            ['', true],
            ['', true],
          ],
          'each run\'s events follow "- Events:" and a blank line'
        );
        const eventLines = log.filter(l => /^\d+\. /.test(l));
        assert.equal(eventLines.length, names.steps.length, 'one numbered event line per step event');
        for (const [seq, id, title] of names.steps) {
          assert.notEqual(title, id, `${id} has a plain title`);
          assert.ok(log.includes(`${seq}. ${title}`), `event ${seq}: "${title}"`);
        }
        assert.deepEqual(
          eventLines.filter(l => names.stepIds.includes(l.replace(/^\d+\. /, '').split(' ')[0])),
          [],
          'no raw step id in the event list'
        );
        // A plain summary per run block; the label stays there, and Model detail keeps each run's label
        // and the engine's full description, word for word, then the model's sources with their ids.
        assert.deepEqual(
          log.filter(l => /^- (Label|Summary|Description): /.test(l)),
          names.summaries.flatMap(summary => [`- Label: ${SYNTHETIC}`, `- Summary: ${summary}`])
        );
        const [runDetail, modelSources = ''] = appendix.split('\n### Model sources\n');
        assert.deepEqual(
          runDetail.split('\n').filter(Boolean),
          names.titles.flatMap((title, n) => [
            `### ${title}`,
            `- Label: ${SYNTHETIC}`,
            `- Description: ${names.descriptions[n]}`,
          ]),
          'Model detail (for instructors) keeps every label and description'
        );
        const modelLines = modelSources.split('\n').filter(Boolean);
        assert.ok(
          modelLines.length > 1 && modelLines.every(l => /^- C-[a-z0-9-]+: "/.test(l)),
          `Model sources: one claim per line with its id: ${modelLines.slice(0, 2)}`
        );
        // UX-POLISH-data-1: the course-guide source says what it is (a summary by the lab's author, not
        // the official guide the link points to); with its id it is now under Model sources.
        assert.match(names.guide.citation, /^NDRB 2903 course context .*not the official course guide/);
        assert.ok(
          modelSources.includes(`S-course-guide ${names.guide.citation} <${names.guide.url}>`),
          'Model sources cite the course context honestly'
        );
        assert.doesNotMatch(markdown, /project brief/i);
        // The student's Sources: only the claim the published entry cites, in words (citation, then
        // what it is cited for); the entry's own claim line in the same words.
        assert.deepEqual(sources, [
          `- ${names.cited.refs.join(' | ')}`,
          `  - Cited for: "${names.cited.text}" (published, qualitative)`,
        ]);
        assert.ok(
          lines.includes(`  "${names.cited.text}" (published, qualitative). Source: ${names.cited.refs.join(' | ')}`),
          'the published entry prints its claim, strength words and citation, no id'
        );
        assert.deepEqual(resultOnSimulatedLines(markdown), [], 'no "result" on a simulated line without "simulated"');
        // ENGINE-9 / ENGINE-13: the designer lines in the Experiment log block.
        for (const line of ['- Background: ', '- What you change: ', '- What you keep the same: '])
          assert.ok(markdown.includes(`\n${line}`), `export carries "${line.trim()}"`);
        assert.ok(
          markdown.includes('\n- Outcome measures: Target/background contrast\n'),
          'export carries "Outcome measures:" with the chosen measure by its title'
        );
      }
      // UX-POLISH-notebook-2: More > Copy as plain text puts the same report on the clipboard without
      // Markdown signs (no "#" headings, tags in words); every label and the disclaimer stay.
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base.origin });
      await nb.locator('[data-labn-action="more"]').click();
      record.moreItems = await nb.locator('[data-labn-menu="more"] .labn-menu-item').allTextContents();
      assert.deepEqual(
        record.moreItems.map(t => t.trim()),
        ['Copy as plain text', 'Copy as Markdown', 'Print']
      );
      await nb.locator('[data-labn-action="copy-plain"]').click();
      await page.waitForFunction(() =>
        /copied as plain text/.test(document.querySelector('[data-labn-export-status]')?.textContent || '')
      );
      const plain = await page.evaluate(() => navigator.clipboard.readText());
      assert.equal(plain, await page.evaluate(md => window.CortexLabNotebook.markdownToPlain(md), exported));
      assert.deepEqual(
        plain.split('\n').filter(l => l.startsWith('#')),
        [],
        'no "#" heading in the plain text'
      );
      assert.ok(!/\[(Published|Observed|Reflection|Simulated)/.test(plain), 'tags in words');
      for (const words of [
        DISCLAIMER,
        'Name: ________',
        `Label: ${SYNTHETIC}`,
        'Simulated (illustrative, not a measurement): ',
      ])
        assert.ok(plain.includes(words), words);
      // UX-LAST-notebook-4: the title and the section headings in capitals with a blank line after them;
      // an experiment's heading over a line of dashes.
      const plainLines = plain.split('\n');
      record.plainHeadings = [
        `MY LAB REPORT: ${LABEL.toUpperCase()}`,
        ...names.sections.map(h => h.toUpperCase()),
        'EXPERIMENT LOG',
        'SOURCES',
        'MODEL DETAIL (FOR INSTRUCTORS)',
      ].map(h => [h, plainLines.indexOf(h) >= 0 && plainLines[plainLines.indexOf(h) + 1] === '']);
      assert.deepEqual(
        record.plainHeadings.filter(([, ok]) => !ok),
        [],
        'the plain text keeps every section heading in capitals'
      );
      // SIMPLE-notebook: the blank title was filled from the change ("<change> vs standard")
      const untitled = plainLines.findIndex(l => /^.+ vs standard$/.test(l));
      assert.ok(
        untitled > 0 && plainLines[untitled + 1] === '-'.repeat(plainLines[untitled].length),
        `an experiment heading sits over a line of dashes: ${JSON.stringify(plainLines.slice(Math.max(0, untitled), untitled + 2))}`
      );
      record.exportLines = exported.split('\n').length;
      await noOverflow(page, 'notebook');
      await page.locator('.labn-entries').scrollIntoViewIfNeeded();
      await shot(page, '8-notebook', width);
      clean('notebook');

      // 11. Deep links: each view renders one h1 (How this lab works and the activity stepper too);
      // /lab/ renders the home view.
      record.deepLinks = {};
      for (const view of ['notebook', 'designer', 'modules', 'about']) {
        await page.goto(lab({ view }), { waitUntil: 'networkidle' });
        await page.waitForSelector(`main.lab-view-${view} h1`);
        await oneH1(page, `deep link ${view}`);
        record.deepLinks[view] = await text(page.locator('h1'));
      }
      assert.deepEqual(record.deepLinks, {
        notebook: 'My report',
        designer: 'Design your experiment',
        modules: 'Weekly activities',
        about: 'How this lab works',
      });
      const m3 = await page.evaluate(() => window.LAB.lab.getModule('M3'));
      for (const [step, shown] of [
        ['2', '2'],
        ['abc', '1'],
        ['99', String(m3.steps.length)],
      ]) {
        await page.goto(lab({ view: 'module:M3', step }), { waitUntil: 'networkidle' });
        await page.waitForSelector('main.lab-view-module .lab-mstep');
        await oneH1(page, `deep link module:M3&step=${step}`);
        assert.equal(await text(page.locator('h1')), m3.title, 'the activity title is the h1');
        assert.equal(await page.getAttribute('.lab-mstep', 'data-lab-mstep'), shown, `step=${step} opens ${shown}`);
      }
      assert.equal(await text(page.locator('#lab-module-next')), 'Finish: back to all activities', 'last step');
      record.deepLinks.module = m3.title;
      await page.goto(new URL('/lab/', base).href, { waitUntil: 'networkidle' });
      await page.waitForSelector('main.lab-view-home h1');
      await oneH1(page, '/lab/');
      record.deepLinks.trailingSlash = await text(page.locator('h1'));
      assert.equal(record.deepLinks.trailingSlash, LABEL, '/lab/ renders the lab home');
      assert.equal(await page.locator('.comingsoon').count(), 0);
      clean('deep links');
      await context.close();
    }
  } else console.log(`${base.hostname} is not a development host: the open-lab steps need localhost; gating only.`);

  // 9b. 3D is the default bench: a fresh visitor (nothing saved) lands on the 3D stage, and the one view
  // toggle offers the list.
  if (LOCAL) {
    const { context, page, clean } = await open(browser, viewports[0], { startMode: null });
    await page.goto(new URL('/lab?view=bench', base).href, { waitUntil: 'networkidle' });
    await page.waitForSelector('main.lab-view-bench');
    assert.equal(
      await page.getAttribute('main.lab-view-bench', 'data-mode'),
      '3d',
      'a fresh visitor opens the 3D bench'
    );
    await page.click('#lab-safety-ack');
    await page.waitForSelector('#lab-mode-toggle');
    assert.equal((await text(page.locator('#lab-mode-toggle'))).trim(), 'Switch to list');
    results.defaultMode = '3d';
    clean('3D default');
    await context.close();
  }

  // 10. Production gating (both viewports): the lab is open since 2.36.0-beta.1, so /lab, a deep link
  // and the About page render the lab itself under ?gates=prod, never the Under construction gate.
  for (const viewport of viewports) {
    const { context, page, clean } = await open(browser, viewport);
    const record = (results[`${viewport.name}Gate`] = {});
    const opens = async (path, selector) => {
      await page.goto(prod(path), { waitUntil: 'networkidle' });
      await page.waitForSelector(selector);
      assert.equal(await page.locator('.comingsoon').count(), 0, `${path}: no gate under production gating`);
      await noOverflow(page, `${path} open`);
      return true;
    };
    record.home = await opens('/lab', '#lab-enter');
    record.about = await opens('/lab?view=about', 'main.lab-page h1');
    record.bench = await opens('/lab?view=bench', 'main.lab-view-bench h1');
    clean('production open');
    await context.close();
  }

  // 14. Reduced motion (sanity): a bench run renders without error. On the way, the list bench mid-run
  // keeps the control budget (UX-R2 + the FREE-2 Notes toggle: <= 6 enabled controls above the fold at 1280x800).
  if (LOCAL) {
    const { context, page, clean } = await open(browser, viewports[0], { reducedMotion: 'reduce' });
    await acknowledgeAndCreateRun(page);
    await page.click('#lab-do-step');
    await page.waitForSelector('.lab-step.lab-step-done');
    assert.equal(await page.getAttribute('main.lab-view-bench', 'data-mode'), 'list');
    results.foldControlsListMid = await controlsAboveFold(page);
    assert.ok(
      results.foldControlsListMid.length <= 6 + (await shelfShown(page)),
      `list: <= 6 enabled controls above the fold mid-run: ${JSON.stringify(results.foldControlsListMid)}`
    );
    await page.click('#lab-run-all');
    await page.waitForSelector('#lab-resolve-out .lab-result-card');
    results.reducedMotion = await page.getAttribute('#lab-resolve-out .lab-banner .lab-badge', 'data-lab-label');
    assert.equal(results.reducedMotion, SYNTHETIC_LABEL);
    clean('reduced motion');
    await context.close();
  }

  // 16. 320 px (A11Y-05, PLAN §8.9): Why? and its Sources open on the result and on the comparison
  // never widen the page.
  if (LOCAL) {
    const narrow = { name: 'narrow', width: 320, height: 640, isMobile: true, hasTouch: true };
    const { context, page, clean } = await open(browser, narrow);
    const record = (results.narrow = {});
    await acknowledgeAndCreateRun(page);
    await page.click('#lab-run-all');
    await page.waitForSelector('#lab-resolve-out .lab-result-card');
    await page.click('#lab-resolve-out [data-lab-why="result"] .lab-drawer-btn');
    await page.click('#lab-resolve-out [data-lab-drawer="why-result-sources"] .lab-drawer-btn');
    await page.waitForSelector('#lab-resolve-out .lab-describe');
    await noOverflow(page, '320 px result with Why? and Sources open');
    await page.locator('#lab-resolve-out [data-lab-why="result"]').scrollIntoViewIfNeeded();
    await shot(page, '16-why', narrow.width);
    await page.click('#lab-compare-open');
    await page.waitForSelector('#lab-pair');
    await page.selectOption('#lab-change-what', 'development-time');
    await page.check('#lab-pair [data-lab-change-value="extended"]');
    await page.click('#lab-pair-btn');
    await page.waitForSelector('#lab-compare-out .lab-compare');
    await page.click('#lab-compare-out [data-lab-why="compare"] .lab-drawer-btn');
    await page.waitForSelector('#lab-compare-out .lab-why-table');
    await noOverflow(page, '320 px comparison with Why? open');
    record.overflow = await page.evaluate(
      () => document.scrollingElement.scrollWidth - document.documentElement.clientWidth
    );
    clean('320 px');
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
console.log(
  LOCAL
    ? 'lab smoke: 3D bench, no-WebGL fallback, tissue clip (intro before the safety notes), desktop and phone journeys, acceptance checks (fold budget in list and 3D), production gating, reduced motion and 320 px passed'
    : 'lab smoke: production gating passed (open-lab steps skipped off localhost)'
);
