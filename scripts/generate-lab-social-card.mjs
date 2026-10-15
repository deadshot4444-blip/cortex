// Renders the Alzheimer's Histology Lab's social card, og-lab.jpg (1200×630), with Playwright.
// Same system as og-v5.jpg and og-clinical.jpg (near-black canvas, corner brackets, the cross mark,
// one signal badge, a light headline, a tracked footer on a hairline) in the lab's bronze accent,
// with one real Bielschowsky slide (CC BY 4.0, credited on the card). When the copy changes, bump
// the file name (og-lab-2.jpg …) and its references in scripts/build-share-pages.py and _headers.
//
//   node scripts/generate-lab-social-card.mjs
import { chromium } from 'playwright';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../og-lab.jpg', import.meta.url));
const SLIDE = fileURLToPath(new URL('../assets/lab/reference/marengo-2022-fig1-ad.jpg', import.meta.url));
const slide = `data:image/jpeg;base64,${readFileSync(SLIDE).toString('base64')}`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1200px; height: 630px; }
  body {
    position: relative; overflow: hidden; color: #fff;
    font-family: -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
    background:
      radial-gradient(900px 520px at 88% 8%, rgba(214,160,96,.10), transparent 60%),
      linear-gradient(180deg, #17150f 0%, #0d0c09 100%);
    -webkit-font-smoothing: antialiased;
  }
  .mono { font-family: "SF Mono", Menlo, monospace; }
  .corner { position: absolute; width: 38px; height: 38px; border-color: #7a6a55; border-style: solid; border-width: 0; }
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
  .badge { background: #a8692a; padding: 14px 22px; font-size: 18px; font-weight: 700; letter-spacing: .08em; }
  .kicker { position: absolute; left: 60px; top: 150px; font-size: 18px; font-weight: 700; letter-spacing: .14em; color: #d6a060; }
  h1 { position: absolute; left: 58px; top: 186px; width: 640px; font-size: 76px; line-height: 1.02; font-weight: 300; letter-spacing: -.025em; }
  .sub { position: absolute; left: 60px; top: 372px; width: 610px; font-size: 25px; line-height: 1.45; color: #c9c0b3; font-weight: 400; }
  figure { position: absolute; right: 60px; top: 122px; width: 340px; }
  figure img { display: block; width: 340px; height: 340px; object-fit: cover; border: 1px solid #4a4134; }
  figcaption { margin-top: 10px; font-size: 13px; line-height: 1.35; color: #9d9384; letter-spacing: .01em; }
  footer { position: absolute; left: 60px; right: 60px; top: 527px; border-top: 1px solid #3a342b; height: 76px; display: flex; align-items: center; justify-content: space-between; }
  .facts { font-size: 21px; font-weight: 600; letter-spacing: .1em; color: #d4cbbd; }
  .url { font-size: 25px; font-weight: 600; }
</style></head><body>
  <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
  <header><div class="brand"><span class="mark"></span>CORTEX MEDICAL ACADEMY</div><div class="badge">HISTOLOGY LAB</div></header>
  <p class="kicker mono">MODIFIED BIELSCHOWSKY SILVER STAIN</p>
  <h1>Alzheimer’s<br>Histology Lab</h1>
  <p class="sub">Practice the procedure step by step, or mix anything on the free bench and see what happens.</p>
  <figure><img src="${slide}" alt=""><figcaption>Real slide, Alzheimer’s cortex · Marengo et al., Cell Mol Life Sci 2022, Fig. 1A (cropped) · CC BY 4.0</figcaption></figure>
  <footer><span class="facts">FREE &nbsp;·&nbsp; NO ACCOUNT &nbsp;·&nbsp; REAL SLIDES</span><span class="url">cortexmedical.academy/lab</span></footer>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 92 });
await browser.close();
console.log(`Wrote ${OUT} (${statSync(OUT).size} bytes)`);
