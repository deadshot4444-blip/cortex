import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

// Track the live app version so the "what's new" modal never blocks navigation as versions bump.
const APP_VERSION =
  (readFileSync(new URL('../app.js', import.meta.url), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || '';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));

await page.addInitScript(v => localStorage.setItem('cs-seen-ver', v), APP_VERSION);
await page.goto(process.env.CORTEX_URL || 'http://localhost:8765/', { waitUntil: 'networkidle' });
await page.click('[data-go="neuro"]');
await page.waitForSelector('.neuro-page', { timeout: 15000 });
await page.click('#ne-library');
await page.waitForSelector('.neuro-library', { timeout: 10000 });
await page.click('#ne-codelab');
await page.waitForSelector('#necodelab .neuro-row', { timeout: 10000 });

// Threshold-episode lesson: the stub runs, then the solution passes every authored input case.
await page.locator('#necodelab .neuro-row').nth(3).click();
await page.waitForSelector('[data-run-code]', { timeout: 10000 });

await page.click('[data-run-code]');
await page.waitForFunction(() => document.querySelector('[data-stop-code]')?.hidden === true, null, { timeout: 60000 });

const runOut = await page.locator('[data-term-log]').textContent();
const starterOk = runOut?.trim() === 'Events: 0';

// The solution/check controls live inside a collapsed <details> fold — open it first.
await page.evaluate(() =>
  document.querySelectorAll('details.neuro-sandbox-more').forEach(d => {
    d.open = true;
  })
);
await page.click('[data-load-sol]');
await page.click('[data-check-code]');
await page.waitForFunction(() => document.querySelector('[data-stop-code]')?.hidden === true, null, { timeout: 60000 });
const checkMsg = await page.textContent('[data-py-status]');
const checkedOutput = await page.textContent('[data-term-log]');
const caseResults = await page.locator('[data-check-results] li').allTextContents();

console.log(
  JSON.stringify(
    {
      starterOk,
      runOut: runOut?.trim(),
      checkMsg: checkMsg?.trim(),
      checkedOutput: checkedOutput?.trim(),
      caseResults,
      errors,
    },
    null,
    2
  )
);
await browser.close();
const ok =
  !errors.length &&
  starterOk &&
  checkMsg === '6/6 input cases passed.' &&
  checkedOutput?.trim() === 'Events: 2' &&
  caseResults.length === 6 &&
  caseResults.every(result => result.includes(': passed'));
process.exit(ok ? 0 : 1);
