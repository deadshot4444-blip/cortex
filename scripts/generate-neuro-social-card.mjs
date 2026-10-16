// Renders the Neuroengineering course's social card, og-neuro-2.jpg (1200×630), with Playwright.
// Same system as og-v5.jpg and og-lab.jpg (near-black canvas, corner brackets, the cross mark,
// one signal badge, a light headline, a tracked footer on a hairline), monochrome like the /neuro
// page, with a drawn action-potential trace and the course's numbered contents. When the copy
// changes, bump the file name (og-neuro-3.jpg …) and its references in scripts/build-share-pages.py
// and _headers.
//
//   node scripts/generate-neuro-social-card.mjs
import { chromium } from 'playwright';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../og-neuro-2.jpg', import.meta.url));

// One action potential on a flat baseline: rest, threshold, spike, undershoot, recovery.
const trace =
  'M0 64 L250 64 C262 64 266 60 272 56 C278 50 280 6 286 4 C292 2 294 84 302 92 C312 100 326 72 344 66 C360 62 380 64 400 64 L560 64';

const rows = [
  ['01', 'Units', '20 IN 4 MODULES'],
  ['02', 'Coding exercises', '22 CHECKED'],
  ['03', 'Simulations', '26 INTERACTIVE'],
  ['04', 'Projects', '6 BUILDS'],
];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1200px; height: 630px; }
  body {
    position: relative; overflow: hidden; color: #fff;
    font-family: -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
    background:
      radial-gradient(900px 520px at 88% 8%, rgba(255,255,255,.06), transparent 60%),
      linear-gradient(180deg, #16171a 0%, #0b0b0d 100%);
    -webkit-font-smoothing: antialiased;
  }
  .mono { font-family: "SF Mono", Menlo, monospace; }
  .corner { position: absolute; width: 38px; height: 38px; border-color: #5c5f66; border-style: solid; border-width: 0; }
  .tl { top: 24px; left: 24px; border-top-width: 2px; border-left-width: 2px; }
  .tr { top: 24px; right: 24px; border-top-width: 2px; border-right-width: 2px; }
  .bl { bottom: 24px; left: 24px; border-bottom-width: 2px; border-left-width: 2px; }
  .br { bottom: 24px; right: 24px; border-bottom-width: 2px; border-right-width: 2px; }
  header { position: absolute; top: 52px; left: 60px; right: 60px; height: 54px; display: flex; align-items: center; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 18px; font-size: 26px; font-weight: 600; letter-spacing: .01em; }
  .mark { width: 54px; height: 54px; border-radius: 9px; background: #fff; position: relative; }
  .mark::before, .mark::after { content: ""; position: absolute; background: #111113; }
  .mark::before { left: 22px; top: 12px; width: 10px; height: 30px; }
  .mark::after { left: 12px; top: 22px; width: 30px; height: 10px; }
  .badge { display: flex; align-items: center; gap: 12px; border: 1px solid #fff; padding: 13px 20px; font-size: 18px; font-weight: 700; letter-spacing: .1em; }
  .badge svg { width: 20px; height: 20px; }
  .kicker { position: absolute; left: 60px; top: 150px; font-size: 17px; font-weight: 600; letter-spacing: .2em; color: #9a9da4; }
  h1 { position: absolute; left: 57px; top: 184px; width: 600px; font-size: 76px; line-height: 1.02; font-weight: 300; letter-spacing: -.026em; }
  .trace { position: absolute; left: 60px; top: 376px; width: 560px; height: 100px; }
  .trace .base { stroke: #3a3c42; }
  .trace .ap { stroke: #fff; }
  .scale { position: absolute; left: 60px; top: 478px; font-size: 13px; letter-spacing: .14em; color: #6f727a; }
  ol { position: absolute; right: 60px; top: 186px; width: 440px; list-style: none; border-top: 1px solid #2c2e33; }
  li { height: 72px; display: flex; align-items: center; border-bottom: 1px solid #2c2e33; }
  li .n { width: 44px; font-size: 16px; color: #6f727a; }
  li .name { flex: 1; font-size: 27px; font-weight: 400; }
  li .stat { font-size: 17px; font-weight: 600; letter-spacing: .12em; color: #c9cbd0; }
  footer { position: absolute; left: 60px; right: 60px; top: 527px; border-top: 1px solid #2c2e33; height: 76px; display: flex; align-items: center; justify-content: space-between; }
  .facts { font-size: 21px; font-weight: 600; letter-spacing: .1em; color: #c9cbd0; }
  .url { font-size: 25px; font-weight: 600; }
</style></head><body>
  <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
  <header>
    <div class="brand"><span class="mark"></span>CORTEX MEDICAL ACADEMY</div>
    <div class="badge"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2L17 6V14L10 18L3 14V6Z" fill="none" stroke="#fff" stroke-width="1.8"/></svg>NEUROENGINEERING</div>
  </header>
  <p class="kicker mono">NEURONS · SIGNALS · CODE</p>
  <h1>Where the mind<br>meets the machine.</h1>
  <svg class="trace" viewBox="0 0 560 100" fill="none" aria-hidden="true">
    <path class="base" d="M0 64 H560" stroke-width="1" stroke-dasharray="3 6"/>
    <path class="ap" d="${trace}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>
  <p class="scale mono">ACTION POTENTIAL</p>
  <ol class="rows">${rows
    .map(
      ([n, name, stat]) =>
        `<li><span class="n mono">${n}</span><span class="name">${name}</span><span class="stat mono">${stat}</span></li>`
    )
    .join('')}</ol>
  <footer><span class="facts">FREE &nbsp;·&nbsp; NO ACCOUNT &nbsp;·&nbsp; CODE IN THE BROWSER</span><span class="url">cortexmedical.academy/neuro</span></footer>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 92 });
await browser.close();
console.log(`Wrote ${OUT} (${statSync(OUT).size} bytes)`);
