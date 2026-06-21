import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

// Track the live app version so the "what's new" modal never blocks navigation as versions bump.
const APP_VERSION = (readFileSync(new URL('../app.js', import.meta.url), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || '';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));

await page.addInitScript(v => localStorage.setItem('cs-seen-ver', v), APP_VERSION);
await page.goto('http://localhost:8765/', { waitUntil: 'networkidle' });
await page.click('[data-go="neuro"]');
await page.waitForSelector('.neuro-page', { timeout: 15000 });
await page.click('#ne-codelab');
await page.waitForSelector('#necodelab .neuro-row', { timeout: 10000 });

// Spike counting lesson — starter should run to Spikes: 3
await page.locator('#necodelab .neuro-row').nth(3).click();
await page.waitForSelector('[data-run-code]', { timeout: 10000 });

await page.click('[data-run-code]');
await page.waitForFunction(
  () => document.querySelector('[data-py-status]')?.textContent?.includes('ready') ||
        document.querySelector('[data-py-status]')?.textContent?.includes('error') ||
        document.querySelector('.neuro-term-line.out')?.textContent?.includes('Spikes'),
  { timeout: 120000 },
);

const runOut = await page.locator('.neuro-term-line.out').last().textContent();
const starterOk = runOut?.includes('Spikes: 3');

await page.click('[data-load-sol]');
await page.click('[data-check-code]');
await page.waitForFunction(
  () => document.querySelector('[data-term-msg]')?.textContent?.includes('Check passed'),
  { timeout: 120000 },
);
const checkMsg = await page.textContent('[data-term-msg]');

console.log(JSON.stringify({
  starterOk,
  runOut: runOut?.trim(),
  checkMsg: checkMsg?.trim(),
  errors,
}, null, 2));
await browser.close();
const ok = !errors.length && starterOk && checkMsg?.includes('Check passed');
process.exit(ok ? 0 : 1);