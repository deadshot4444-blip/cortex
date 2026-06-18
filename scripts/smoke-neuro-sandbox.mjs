import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));

await page.addInitScript(() => localStorage.setItem('cs-seen-ver', '1.9.0'));
await page.goto('http://localhost:8765/', { waitUntil: 'networkidle' });
await page.click('[data-go="neuro"]');
await page.waitForSelector('.neuro-page', { timeout: 15000 });
await page.click('#ne-codelab');
await page.waitForSelector('#necodelab .neuro-row', { timeout: 10000 });
await page.locator('#necodelab .neuro-row').first().click();
await page.waitForSelector('[data-run-check]', { timeout: 10000 });

await page.click('[data-run-check]');
const starterMsg = (await page.textContent('[data-term-msg]'))?.trim();
await page.click('[data-load-sol]');
await page.click('[data-run-check]');
const solutionMsg = (await page.textContent('[data-term-msg]'))?.trim();

console.log(JSON.stringify({
  starterBlocks: starterMsg?.includes('Keep going'),
  solutionPasses: solutionMsg?.includes('Check passed'),
  errors,
}, null, 2));
await browser.close();
const ok = !errors.length && starterMsg?.includes('Keep going') && solutionMsg?.includes('Check passed');
process.exit(ok ? 0 : 1);