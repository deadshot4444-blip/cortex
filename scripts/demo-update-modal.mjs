import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';

const OUT = path.join(process.env.HOME, 'Desktop', 'cortex-update-demo');
const URL = 'http://localhost:8765/';

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

// Fresh visitor — no cs-seen-ver → modal should appear
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(OUT, '1-modal-on-load.png'), fullPage: false });

const modal = page.locator('.upd-modal-back');
const modalVisible = await modal.isVisible();
console.log('modal visible on first load:', modalVisible);

if (modalVisible) {
  const title = await page.locator('#upd-modal-title').textContent();
  const version = await page.locator('.upd-modal .label').textContent();
  console.log('modal shows:', version?.trim(), '—', title?.trim());
}

// Dismiss with "Got it"
await page.locator('#upd-got').click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, '2-after-got-it.png'), fullPage: false });
console.log('modal after dismiss:', await modal.isVisible());

// Reload — should NOT pop again (same version)
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(OUT, '3-reload-no-modal.png'), fullPage: false });
console.log('modal after reload:', await modal.isVisible());

// Version chip opens optional full changelog
await page.locator('button.ver').click();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, '4-full-changelog.png'), fullPage: true });

const seen = await page.evaluate(() => localStorage.getItem('cs-seen-ver'));
console.log('cs-seen-ver stored as:', seen);

await browser.close();
console.log('screenshots saved to', OUT);