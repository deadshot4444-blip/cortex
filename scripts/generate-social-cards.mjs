// Renders every share card (1200×630 JPEG) with Playwright, one per main area of the site.
//
// The cards follow the site's own look: the Midnight navy heroes with a Cormorant Garamond headline,
// the Neuroengineering course's dark code-editor page, and the Histology Lab's bronze. Fonts are the
// ones bundled in assets/fonts, so a card renders the same on any machine. Every number on a card is
// counted from the site's data by cardFacts() below; scripts/test-social-cards.cjs fails when the data
// and og/cards.json disagree, which is the cue to run this again.
//
//   node scripts/generate-social-cards.mjs                 # write og/<card>-<rev>.jpg and og/cards.json
//   node scripts/generate-social-cards.mjs --out /tmp/x    # write the images somewhere else (design work)
//   node scripts/generate-social-cards.mjs --only mcat,dat # render some of the cards
//
// Crawlers cache a card by its image URL. When a card's look or copy changes, raise its `rev` here
// (the file name changes) and run scripts/build-share-pages.py so every page points at the new file.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, ROOT));
const json = path => JSON.parse(read(path).toString());
const esc = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const count = n => n.toLocaleString('en-US');

/* ---------- what the cards say, counted from the site ---------- */

function catalog() {
  const context = { IS_LOCAL_PREVIEW: false, PREVIEW_COURSES: new Set() };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read('academy.js').toString(), context);
  return context.CortexAcademy.tracks.map(track => ({ ...track }));
}

export function cardFacts() {
  const open = catalog().filter(track => track.available);
  const byId = Object.fromEntries(open.map(track => [track.id, track]));
  const course = json('data/mcat-course.json');
  const outline = json('data/dat-outline.json');
  const datItems = outline.files.questions.reduce((sum, file) => sum + json(`data/${file}.json`).items.length, 0);
  const rc = json('data/dat-rc.json').passages.reduce((sum, passage) => sum + passage.questions.length, 0);
  const bank = json('data/index.json');
  const neuro = json('data/neuro.json');
  return {
    courses: open.map(track => ({ id: track.id, name: track.name, kind: track.kind })),
    mcat: {
      description: byId.mcat.description,
      lessons: course.units.length,
      questions: json('data/mcat-questions.json').length,
      flashcards: json('data/mcat-cards.json').length,
      carsPassages: json('data/mcat-cars.json').length,
      sciencePassages: json('data/mcat-science-passages.json').length,
    },
    dat: {
      description: byId.dat.description,
      items: datItems,
      sections: Object.keys(outline.sections).length,
      readingQuestions: rc,
      patGenerators: json('data/dat-pat.json').subtests.length,
    },
    clinical: {
      specialties: new Set(bank.map(entry => entry.key)).size,
      // The classic case bank, rounded down to the hundred so a few new cases do not date the card.
      bankFloor: Math.floor(bank.length / 100) * 100,
    },
    neuro: {
      units: neuro.learningPaths[0].steps.length,
      exercises: neuro.neuroCodeLessons.length,
      labs: neuro.simulations.length,
      projects: json('data/neuro-projects.json').projects.length,
      course: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][open.findIndex(track => track.id === 'neuro')],
    },
  };
}

/* ---------- shared pieces ---------- */

const font = (file, type = 'font/woff2') => `data:${type};base64,${read(`assets/fonts/${file}`).toString('base64')}`;
const FONTS = `
  @font-face { font-family: "Cormorant Garamond"; font-style: normal; font-weight: 300 700; src: url(${font('cormorant-garamond-latin-wght-normal.woff2')}) format("woff2"); }
  @font-face { font-family: "Cormorant Garamond"; font-style: italic; font-weight: 300 700; src: url(${font('cormorant-garamond-latin-wght-italic.woff2')}) format("woff2"); }
  @font-face { font-family: "Source Sans 3"; font-style: normal; font-weight: 200 900; src: url(${font('source-sans-3-latin-wght-normal.woff2')}) format("woff2"); }
  @font-face { font-family: "JetBrains Mono"; font-style: normal; font-weight: 100 800; src: url(${font('jetbrains-mono-latin-wght-normal.woff2')}) format("woff2"); }`;

// The site's mark (app.js MARK_SVG): a ring with the cross.
const MARK =
  '<svg viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="16" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M15.4 9h3.2v6.4H25v3.2h-6.4V25h-3.2v-6.4H9v-3.2h6.4z" fill="currentColor"/></svg>';

const BASE = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1200px; height: 630px; }
  body {
    position: relative; overflow: hidden;
    --canvas: #0b1730; --ink: #f4f6fa; --dim: #c8d0de; --silver: #b9c4d6; --hair: rgba(185, 196, 214, .34); --accent: #b9c4d6;
    background:
      radial-gradient(760px 460px at 86% -6%, rgba(86, 116, 176, .30), transparent 68%),
      radial-gradient(900px 520px at 4% 108%, rgba(4, 10, 24, .75), transparent 70%),
      var(--canvas);
    color: var(--ink);
    font-family: "Source Sans 3", sans-serif; font-variant-numeric: lining-nums;
    -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision;
  }
  .serif { font-family: "Cormorant Garamond", serif; }
  .mono { font-family: "JetBrains Mono", monospace; font-variant-ligatures: none; }
  .top { position: absolute; top: 48px; left: 64px; right: 64px; height: 40px; display: flex; align-items: center; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 15px; font-family: "Cormorant Garamond", serif; font-size: 21px; font-weight: 600; letter-spacing: .21em; text-transform: uppercase; }
  .brand svg { width: 38px; height: 38px; }
  .tag { border: 1px solid var(--tag-line, rgba(185, 196, 214, .6)); padding: 9px 15px 8px 17px; color: var(--tag-ink, var(--ink)); font-size: 13px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; }
  .copy { position: absolute; left: 64px; top: 150px; width: 660px; }
  .eyebrow { color: var(--accent); font-size: 14px; font-weight: 600; letter-spacing: .21em; text-transform: uppercase; }
  h1 { margin-top: 20px; font-family: "Cormorant Garamond", serif; font-size: 96px; font-weight: 500; line-height: .97; letter-spacing: -.014em; }
  h1 em { font-style: italic; font-weight: 400; }
  .rule { display: block; width: 46px; height: 1px; margin: 30px 0 24px; background: rgba(185, 196, 214, .7); }
  .sub { max-width: 560px; color: var(--dim); font-size: 22px; line-height: 1.46; }
  .foot { position: absolute; left: 64px; right: 64px; bottom: 42px; display: flex; align-items: baseline; justify-content: space-between; padding-top: 21px; border-top: 1px solid var(--hair); }
  .facts { color: var(--silver); font-size: 14px; font-weight: 600; letter-spacing: .2em; text-transform: uppercase; }
  .facts i { margin: 0 13px; font-style: normal; opacity: .6; }
  .url { font-size: 20px; font-weight: 600; letter-spacing: .012em; }
  .figure { position: absolute; right: 64px; top: 150px; width: 384px; }

  /* A count with its ledger, as on the DAT page's hero. */
  .index { padding-left: 40px; border-left: 1px solid var(--hair); }
  .index .k { display: block; color: var(--silver); font-size: 12.5px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; }
  .index strong { display: block; margin: 8px 0 0 -5px; font-family: "Cormorant Garamond", serif; font-size: 148px; font-weight: 500; line-height: .86; letter-spacing: -.02em; }
  .index .unit { display: block; margin-top: 12px; color: var(--ink); font-size: 21px; }
  .index ul { margin-top: 22px; list-style: none; border-top: 1px solid var(--hair); }
  .index li { display: flex; justify-content: space-between; padding: 9px 0 8px; border-bottom: 1px solid var(--hair); color: var(--dim); font-size: 17px; }
  .index li b { color: var(--ink); font-weight: 600; }

  /* A numbered list of names on hairlines, as in the course catalog. */
  .ledger { list-style: none; border-top: 1px solid var(--hair); }
  .ledger li { display: flex; align-items: baseline; gap: 22px; height: 62px; padding-top: 14px; border-bottom: 1px solid var(--hair); }
  .ledger .n { flex: 0 0 34px; color: var(--silver); font-family: "Cormorant Garamond", serif; font-size: 20px; font-style: italic; }
  .ledger .name { flex: 1; font-family: "Cormorant Garamond", serif; font-size: 29px; font-weight: 500; letter-spacing: -.004em; white-space: nowrap; }
  .ledger .kind { color: var(--silver); font-size: 11.5px; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; white-space: nowrap; }`;

const top = tag =>
  `<header class="top"><div class="brand">${MARK}<span>Cortex Medical Academy</span></div>${tag ? `<span class="tag">${esc(tag)}</span>` : ''}</header>`;
const foot = (facts, url) =>
  `<footer class="foot"><span class="facts">${facts.map(esc).join('<i>·</i>')}</span><span class="url">${esc(url)}</span></footer>`;
const page = (css, body, cls = '') =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${FONTS}${BASE}${css}</style></head><body class="${cls}">${body}</body></html>`;

// A small deterministic generator, so drawn figures come out the same on every run.
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/* ---------- the cards ---------- */

function home(facts) {
  const css = `
    .center { position: absolute; left: 0; right: 0; top: 146px; text-align: center; }
    .center h1 { margin-top: 20px; font-size: 110px; line-height: .95; }
    .center .rule { margin: 30px auto 22px; }
    .center .sub { max-width: 800px; margin: 0 auto; }`;
  return page(
    css,
    `${top(`${facts.courses.length} courses open`)}
    <main class="center">
      <p class="eyebrow">Free · Open to everyone</p>
      <h1>Master the<br><em>human machine.</em></h1>
      <span class="rule"></span>
      <p class="sub">Free MCAT and DAT preparation and clinical case learning for the work ahead.</p>
    </main>
    ${foot(['No account', 'No paywall', 'Works offline'], 'cortexmedical.academy')}`
  );
}

function academy(facts) {
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  const rows = facts.courses
    .map(
      (course, i) =>
        `<li><span class="n">${numerals[i]}</span><span class="name">${esc(course.name.replace("Alzheimer's ", ''))}</span><span class="kind">${esc(course.kind)}</span></li>`
    )
    .join('');
  const css = `
    .copy { width: 600px; }
    h1 { font-size: 82px; }
    .sub { max-width: 500px; }
    .figure { width: 452px; }
    .ledger li { height: 60px; }`;
  return page(
    css,
    `${top('Course catalog')}
    <main class="copy">
      <p class="eyebrow">Your academy</p>
      <h1>Choose what you<br>want <em>to learn.</em></h1>
      <span class="rule"></span>
      <p class="sub">Find a path that fits your goal<br>and start with one useful session.</p>
    </main>
    <aside class="figure"><ol class="ledger">${rows}</ol></aside>
    ${foot([`${facts.courses.length} courses open`, 'Free', 'No account'], 'cortexmedical.academy/academy')}`
  );
}

// The two exam-preparation cards share one layout: the catalog's description beside the track's count.
const EXAM_CSS =
  '.copy, .figure { top: 142px; } h1 { font-size: 92px; } .rule { margin: 26px 0 20px; } .sub { max-width: 590px; }';

function mcat(facts) {
  const m = facts.mcat;
  return page(
    EXAM_CSS,
    `${top('MCAT')}
    <main class="copy">
      <p class="eyebrow">Exam preparation · Beta</p>
      <h1>MCAT<br><em>preparation.</em></h1>
      <span class="rule"></span>
      <p class="sub">${esc(m.description)}</p>
    </main>
    <aside class="figure index">
      <span class="k">The MCAT track</span>
      <strong>${count(m.lessons)}</strong>
      <span class="unit">lessons</span>
      <ul>
        <li><span>Practice questions</span><b>${count(m.questions)}</b></li>
        <li><span>Flashcards</span><b>${count(m.flashcards)}</b></li>
        <li><span>CARS and science passages</span><b>${count(m.carsPassages + m.sciencePassages)}</b></li>
      </ul>
    </aside>
    ${foot(['Free', 'No account', 'Works offline'], 'cortexmedical.academy/mcat')}`
  );
}

function dat(facts) {
  const d = facts.dat;
  return page(
    EXAM_CSS,
    `${top('DAT')}
    <main class="copy">
      <p class="eyebrow">Exam preparation · Beta</p>
      <h1>DAT<br><em>preparation.</em></h1>
      <span class="rule"></span>
      <p class="sub">${esc(d.description)}</p>
    </main>
    <aside class="figure index">
      <span class="k">The DAT track</span>
      <strong>${count(d.items)}</strong>
      <span class="unit">practice items</span>
      <ul>
        <li><span>Test sections</span><b>${count(d.sections)}</b></li>
        <li><span>Reading-comprehension questions</span><b>${count(d.readingQuestions)}</b></li>
        <li><span>Perceptual-ability generators</span><b>${count(d.patGenerators)}</b></li>
      </ul>
    </aside>
    ${foot(['Free', 'No account', 'Works offline'], 'cortexmedical.academy/dat')}`
  );
}

// One lead of a resting ECG: P wave, QRS complex, T wave, repeated.
function ecg(width, beats, base = 74) {
  const span = width / beats;
  let d = `M0 ${base}`;
  for (let i = 0; i < beats; i++) {
    const x = i * span;
    const at = (dx, y) => `${(x + dx * span).toFixed(1)} ${y}`;
    d += ` L${at(0.16, base)} C${at(0.2, base - 9)} ${at(0.25, base - 9)} ${at(0.29, base)} L${at(0.37, base)} L${at(0.395, base + 7)} L${at(0.435, base - 62)} L${at(0.475, base + 17)} L${at(0.505, base)} L${at(0.6, base)} C${at(0.66, base - 19)} ${at(0.74, base - 19)} ${at(0.8, base)} L${at(1, base)}`;
  }
  return d;
}

function clinical(facts) {
  const c = facts.clinical;
  // A shift in three lines. Nothing here is counted, so new rotations do not date the card.
  const rows = ['Meet the patient', 'Make your calls', 'See what happens']
    .map((name, i) => `<li><span class="n">0${i + 1}</span><span class="name">${esc(name)}</span></li>`)
    .join('');
  const css = `
    .figure { width: 400px; }
    .monitor { border: 1px solid var(--hair); background: rgba(6, 13, 30, .55); }
    .vitals { display: flex; justify-content: space-between; padding: 14px 18px 0; color: var(--silver); font-size: 12.5px; letter-spacing: .08em; }
    .vitals b { margin-right: 7px; color: rgba(185, 196, 214, .62); font-weight: 500; }
    .vitals span { color: var(--ink); }
    .vitals sub { font-size: .7em; vertical-align: -.22em; }
    .monitor svg { display: block; width: 100%; height: 112px; margin: 4px 0 10px; }
    .ledger { margin-top: 20px; }
    .ledger li { height: 51px; padding-top: 11px; }
    .ledger .n { flex-basis: 30px; font-family: "Source Sans 3", sans-serif; font-size: 13px; font-style: normal; font-weight: 600; letter-spacing: .1em; }
    .ledger .name { font-size: 26px; }`;
  return page(
    css,
    `${top('Clinical Scenarios')}
    <main class="copy">
      <p class="eyebrow">Clinical reasoning · Beta</p>
      <h1>Start<br><em>your shift.</em></h1>
      <span class="rule"></span>
      <p class="sub">A patient is waiting. What you decide changes what happens to them.</p>
    </main>
    <aside class="figure">
      <div class="monitor">
        <div class="vitals mono"><span><b>HR</b>112</span><span><b>BP</b>96/61</span><span><b>SpO<sub>2</sub></b>93%</span><span><b>RR</b>22</span><span><b>T</b>38.6°C</span></div>
        <svg viewBox="0 0 400 112" fill="none" aria-hidden="true"><path d="${ecg(400, 3)}" stroke="#f4f6fa" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/></svg>
      </div>
      <ol class="ledger">${rows}</ol>
    </aside>
    ${foot(['Free', `${c.specialties} specialties`, `${count(c.bankFloor)}+ case bank`], 'cortexmedical.academy/practice')}`
  );
}

// The course page's own listing (neuro.js NEURO_HERO_CODE), shortened to fit the card.
const NEURO_CODE = [
  'import numpy as np',
  '',
  'fs = 30_000                  # samples per second',
  'x  = load_recording("ch03")  # synthetic signal',
  '',
  '# 1 · threshold crossings',
  'sigma  = np.median(np.abs(x)) / 0.6745',
  'thr    = -4.5 * sigma',
  'cross  = (x[1:] < thr) & (x[:-1] >= thr)',
  'spikes = np.flatnonzero(cross)',
];
function codeLine(line) {
  const hash = line.indexOf('#');
  const code = hash < 0 ? line : line.slice(0, hash);
  let out = '',
    pos = 0;
  for (const match of code.matchAll(/"[^"]*"|[A-Za-z_]\w*|-?\d[\d_]*(?:\.\d+)?/g)) {
    const token = match[0];
    const kind = /^(?:import|as|np)$/.test(token) ? 'k' : /^[A-Za-z_]/.test(token) ? '' : 'n';
    out += esc(code.slice(pos, match.index)) + (kind ? `<span class="${kind}">${esc(token)}</span>` : esc(token));
    pos = match.index + token.length;
  }
  return out + esc(code.slice(pos)) + (hash < 0 ? '' : `<span class="c">${esc(line.slice(hash))}</span>`);
}
// A noisy baseline with extracellular spikes, and a ring over each spike the detector found.
function spikeTrace(width, base, seed) {
  const rand = seeded(seed);
  const spikes = [];
  for (let x = 70 + rand() * 60; x < width - 40; x += 46 + rand() * 150) spikes.push(x);
  let d = `M0 ${base}`,
    next = 0;
  for (let x = 6; x <= width; x += 6) {
    if (next < spikes.length && x >= spikes[next]) {
      const s = spikes[next++];
      d += ` L${(s - 3).toFixed(1)} ${(base + 2).toFixed(1)} L${s.toFixed(1)} ${(base - 30 - rand() * 8).toFixed(1)} L${(s + 4).toFixed(1)} ${(base + 13).toFixed(1)} L${(s + 10).toFixed(1)} ${base}`;
      x = Math.ceil((s + 10) / 6) * 6;
      continue;
    }
    d += ` L${x} ${(base + (rand() - 0.5) * 7).toFixed(1)}`;
  }
  return { d, spikes };
}

function neuro(facts) {
  const n = facts.neuro;
  const lines = NEURO_CODE.map(
    (line, i) => `<span class="ln"><span class="no">${i + 1}</span><span>${codeLine(line) || ' '}</span></span>`
  ).join('');
  const trace = spikeTrace(1200, 62, 8);
  const rings = trace.spikes.map(x => `<circle cx="${x.toFixed(1)}" cy="14" r="4"/>`).join('');
  const css = `
    body {
      --canvas: #05080c; --ink: #eef3f6; --dim: #b4c0cb; --silver: #b4c0cb; --hair: #1d2733; --accent: #6ff0c2;
      --tag-line: rgba(111, 240, 194, .55); --tag-ink: #eef3f6;
      background: radial-gradient(700px 420px at 100% 0%, rgba(111, 240, 194, .07), transparent 70%), var(--canvas);
    }
    .tag { display: flex; align-items: center; gap: 10px; background: rgba(111, 240, 194, .07); }
    .tag svg { width: 17px; height: 17px; }
    .copy { top: 138px; width: 590px; }
    h1 { font-size: 76px; line-height: .98; }
    .rule { margin: 26px 0 20px; background: rgba(111, 240, 194, .7); }
    .sub { max-width: 520px; font-size: 21px; }
    .editor { position: absolute; left: 672px; right: -24px; top: 126px; overflow: hidden; border: 1px solid #1d2733; border-radius: 12px 0 0 12px; background: #0b1118; box-shadow: 0 40px 90px -30px rgba(0, 0, 0, .9), 0 0 0 1px rgba(111, 240, 194, .06); }
    .bar { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid #1d2733; }
    .bar i { width: 10px; height: 10px; border: 1px solid #55626f; border-radius: 50%; }
    .bar span { margin-left: 12px; padding: 3px 11px; border-radius: 6px; background: #05080c; color: #b4c0cb; font-size: 11.5px; line-height: 1.5; }
    .code { display: flex; flex-direction: column; padding: 16px 18px 18px; color: #d7e0e8; font-size: 13.4px; line-height: 1.62; }
    .ln { display: flex; gap: 18px; white-space: pre; }
    .no { flex: 0 0 18px; color: #4d5b69; text-align: right; }
    .k { color: #6ff0c2; } .n { color: #f2c97d; } .c { color: #8593a1; }
    .trace { position: absolute; left: 0; right: 0; bottom: 98px; width: 1200px; height: 84px; }
    .trace path { stroke: #6ff0c2; stroke-width: 1.4; }
    .trace circle { fill: none; stroke: #eef3f6; stroke-width: 1.3; }
    .foot { border-top-color: #1d2733; }`;
  return page(
    css,
    `<header class="top"><div class="brand">${MARK}<span>Cortex Medical Academy</span></div><span class="tag"><svg viewBox="0 0 20 20" fill="none" stroke="#6ff0c2" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 11h4l2-6 3 11 3-8 1.5 3H19"/></svg>Neuroengineering</span></header>
    <main class="copy">
      <p class="eyebrow">Neuroengineering · Course ${n.course}</p>
      <h1>Where the mind<br>meets <em>the machine.</em></h1>
      <span class="rule"></span>
      <p class="sub">Build a brain–computer interface piece by piece, in Python, right in the browser.</p>
    </main>
    <div class="editor mono" aria-hidden="true">
      <div class="bar"><i></i><i></i><i></i><span>bci_pipeline.py</span></div>
      <div class="code">${lines}</div>
    </div>
    <svg class="trace" viewBox="0 0 1200 84" fill="none" aria-hidden="true"><path d="${trace.d}"/>${rings}</svg>
    ${foot(['Free', `${n.units} units`, `${n.exercises} Python exercises`, `${n.labs} labs`, `${n.projects} projects`], 'cortexmedical.academy/neuro')}`
  );
}

function lab() {
  const slide = `data:image/jpeg;base64,${read('assets/lab/reference/marengo-2022-fig1-ad.jpg').toString('base64')}`;
  let ticks = '';
  for (let k = 0; k < 72; k++) {
    const turn = (k * 5 * Math.PI) / 180,
      outer = k % 6 ? 163 : 171;
    ticks += `<line x1="${(180 + 155 * Math.cos(turn)).toFixed(1)}" y1="${(180 + 155 * Math.sin(turn)).toFixed(1)}" x2="${(180 + outer * Math.cos(turn)).toFixed(1)}" y2="${(180 + outer * Math.sin(turn)).toFixed(1)}"/>`;
  }
  const css = `
    body { --accent: #dcb98a; }
    .copy { top: 146px; }
    h1 { font-size: 92px; }
    .sub { max-width: 620px; }
    .figure { top: 112px; right: 76px; width: 360px; }
    .figure svg { display: block; width: 360px; height: 360px; }
    .figure .rim { stroke: #d7deea; stroke-width: 1.4; }
    .figure .ticks line { stroke: #d7deea; stroke-opacity: .55; }
    .credit { margin-top: 6px; color: rgba(200, 208, 222, .78); font-size: 11.5px; line-height: 1.4; text-align: center; }`;
  return page(
    css,
    `${top('Histology Lab')}
    <main class="copy">
      <p class="eyebrow">Laboratory methods · Beta</p>
      <h1>Alzheimer’s<br><em>Histology Lab</em></h1>
      <span class="rule"></span>
      <p class="sub">Practice the modified Bielschowsky silver stain step by step, or mix anything on the free bench and see what happens.</p>
    </main>
    <figure class="figure">
      <svg viewBox="0 0 360 360" fill="none" aria-hidden="true">
        <defs><clipPath id="field"><circle cx="180" cy="180" r="146"/></clipPath></defs>
        <image href="${slide}" x="26" y="20" width="308" height="320" preserveAspectRatio="xMidYMid slice" clip-path="url(#field)"/>
        <circle class="rim" cx="180" cy="180" r="146"/>
        <g class="ticks">${ticks}</g>
      </svg>
      <figcaption class="credit">Real slide, Alzheimer’s cortex · Marengo et al., Cell Mol Life Sci 2022, Fig. 1A (cropped) · CC BY 4.0</figcaption>
    </figure>
    ${foot(['Free', 'No account', 'Real slides'], 'cortexmedical.academy/lab')}`
  );
}

function updates() {
  const rows = [
    ['New', 'Courses, labs and tools'],
    ['Update', 'Lessons and practice'],
    ['Fix', 'Corrections'],
  ]
    .map(([tag, what]) => `<li><span class="chip">${tag}</span><span class="name">${what}</span></li>`)
    .join('');
  const css = `
    .copy { top: 168px; }
    h1 { font-size: 128px; }
    .figure { top: 214px; width: 430px; }
    .ledger li { align-items: center; gap: 24px; height: 66px; padding-top: 0; }
    .chip { flex: 0 0 96px; border: 1px solid rgba(185, 196, 214, .6); padding: 7px 0 6px 3px; font-size: 12px; font-weight: 600; letter-spacing: .22em; text-align: center; text-transform: uppercase; }`;
  return page(
    css,
    `${top('What’s new')}
    <main class="copy">
      <p class="eyebrow">Changelog</p>
      <h1>Updates.</h1>
      <span class="rule"></span>
      <p class="sub">Public release history:<br>what changed in Cortex, release by release.</p>
    </main>
    <aside class="figure"><ol class="ledger">${rows}</ol></aside>
    ${foot(['Every release', 'Dated', 'Public'], 'cortexmedical.academy/updates')}`
  );
}

// One card per main area: its id, its revision (raise it when the card's look or copy changes, so the
// file name changes), the page that draws it, and the words a screen reader gets in its place.
export const CARDS = [
  {
    id: 'home',
    rev: 1,
    build: home,
    alt: () =>
      'Cortex Medical Academy. Master the human machine: free MCAT and DAT preparation and clinical case learning.',
  },
  {
    id: 'academy',
    rev: 1,
    build: academy,
    alt: f =>
      `Cortex Medical Academy course catalog. Choose what you want to learn: ${f.courses.map(course => course.name).join(', ')}.`,
  },
  {
    id: 'mcat',
    rev: 1,
    build: mcat,
    alt: f =>
      `Cortex Medical Academy, MCAT preparation: ${count(f.mcat.lessons)} lessons, ${count(f.mcat.questions)} practice questions, ${count(f.mcat.flashcards)} flashcards and ${count(f.mcat.carsPassages + f.mcat.sciencePassages)} CARS and science passages.`,
  },
  {
    id: 'dat',
    rev: 1,
    build: dat,
    alt: f =>
      `Cortex Medical Academy, DAT preparation: ${count(f.dat.items)} practice items across ${f.dat.sections} test sections.`,
  },
  {
    id: 'clinical',
    rev: 2,
    build: clinical,
    alt: f =>
      `Cortex Medical Academy, Clinical Scenarios. Start your shift: meet a patient, make the calls and see what happens to them. Shift rotations and a case bank of ${count(f.clinical.bankFloor)}+ across ${f.clinical.specialties} specialties.`,
  },
  {
    id: 'neuro',
    rev: 1,
    build: neuro,
    alt: f =>
      `Cortex Medical Academy, Neuroengineering. Where the mind meets the machine: ${f.neuro.units} units, ${f.neuro.exercises} Python exercises, ${f.neuro.labs} labs and ${f.neuro.projects} projects.`,
  },
  {
    id: 'lab',
    rev: 1,
    build: lab,
    alt: () => 'Cortex Medical Academy, Alzheimer’s Histology Lab, with a real Bielschowsky-stained slide.',
  },
  {
    id: 'updates',
    rev: 1,
    build: updates,
    alt: () => 'Cortex Medical Academy updates: the public release history.',
  },
];
export const cardFile = card => `og/${card.id}-${card.rev}.jpg`;

async function main() {
  const args = process.argv.slice(2);
  const option = name => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
  const only = option('--only')?.split(',');
  const out = option('--out');
  const facts = cardFacts();
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const view = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const written = {};
  for (const card of CARDS) {
    if (only && !only.includes(card.id)) continue;
    await view.setContent(card.build(facts), { waitUntil: 'load' });
    await view.evaluate(() => document.fonts.ready);
    const image = await view.screenshot({ type: 'jpeg', quality: 92 });
    const target = out ? `${out}/${card.id}.jpg` : fileURLToPath(new URL(cardFile(card), ROOT));
    mkdirSync(target.slice(0, target.lastIndexOf('/')), { recursive: true });
    writeFileSync(target, image);
    written[card.id] = {
      file: cardFile(card),
      alt: card.alt(facts),
      sha256: createHash('sha256').update(image).digest('hex'),
    };
    console.log(`Wrote ${target} (${Math.round(image.length / 1024)} KB)`);
  }
  await browser.close();
  if (!out && !only) {
    writeFileSync(new URL('og/cards.json', ROOT), JSON.stringify({ facts, cards: written }, null, 1) + '\n');
    console.log('Wrote og/cards.json');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
