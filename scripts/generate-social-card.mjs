// Renders the site-wide social card, og-v5.jpg (1200×630), from the HTML below with Playwright.
// Same system as og-clinical.jpg: near-black canvas, corner brackets, the cross mark, one green
// signal badge, a light headline and a tracked footer on a hairline. When the copy changes, bump
// the file name (og-v6.jpg …) and its references in index.html, share.html and _headers, so
// crawlers that cache a card by image URL fetch the new one.
//
//   node scripts/generate-social-card.mjs
import { chromium } from 'playwright';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../og-v5.jpg', import.meta.url));

// The courses open to the public (academy.js `available: true`), each with a count that will not
// go stale with the next content session.
const TRACKS = [
  ['MCAT prep', '45 lessons'],
  ['DAT prep', 'All 4 sections'],
  ['Clinical Scenarios', '2,599+ cases'],
];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1200px; height: 630px; }
  body {
    position: relative; overflow: hidden; color: #fff;
    font-family: -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
    background:
      radial-gradient(900px 520px at 88% 8%, rgba(255,255,255,.075), transparent 60%),
      linear-gradient(180deg, #16181c 0%, #0c0d10 100%);
    -webkit-font-smoothing: antialiased;
  }
  .mono { font-family: "SF Mono", Menlo, monospace; }
  .corner { position: absolute; width: 38px; height: 38px; border-color: #6a6d74; border-style: solid; border-width: 0; }
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
  .badge { background: #1f9d4c; padding: 14px 22px; font-size: 18px; font-weight: 700; letter-spacing: .08em; }
  h1 { position: absolute; left: 58px; top: 168px; font-size: 86px; line-height: 1.02; font-weight: 300; letter-spacing: -.025em; }
  .sub { position: absolute; left: 60px; top: 372px; width: 560px; font-size: 26px; line-height: 1.45; color: #b9bcc3; font-weight: 400; }
  .tracks { position: absolute; left: 700px; right: 60px; top: 186px; list-style: none; border-top: 1px solid #33363d; }
  .tracks li { display: grid; grid-template-columns: 44px 1fr auto; align-items: baseline; padding: 25px 0 24px; border-bottom: 1px solid #33363d; }
  .tracks .n { font-size: 16px; color: #7c808a; }
  .tracks .name { font-size: 27px; font-weight: 500; letter-spacing: -.01em; }
  .tracks .count { font-size: 18px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #e6e7ea; }
  footer { position: absolute; left: 60px; right: 60px; top: 527px; border-top: 1px solid #33363d; height: 76px; display: flex; align-items: center; justify-content: space-between; }
  .facts { font-size: 21px; font-weight: 600; letter-spacing: .1em; color: #c9cbd0; }
  .url { font-size: 25px; font-weight: 600; }
</style></head><body>
  <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
  <header><div class="brand"><span class="mark"></span>CORTEX MEDICAL ACADEMY</div><div class="badge">FREE FOREVER</div></header>
  <h1>Master the<br>human machine.</h1>
  <p class="sub">Free MCAT and DAT prep and clinical case practice, built on first principles.</p>
  <ol class="tracks">${TRACKS.map(([name, count], i) => `<li><span class="n mono">0${i + 1}</span><span class="name">${esc(name)}</span><span class="count mono">${esc(count)}</span></li>`).join('')}</ol>
  <footer><span class="facts">NO ACCOUNT &nbsp;·&nbsp; NO PAYWALL &nbsp;·&nbsp; WORKS OFFLINE</span><span class="url">cortexmedical.academy</span></footer>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 92 });
await browser.close();
console.log(`Wrote ${OUT} (${statSync(OUT).size} bytes)`);
