import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.env.CORTEX_URL || 'http://127.0.0.1:8805/';
const browser = await chromium.launch({ headless: true });
mkdirSync('output/playwright', { recursive: true });
try {
  for (const width of [1280, 390, 320]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' }),
      page = await ctx.newPage(),
      errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"value":0}' })
    );
    const open = async view => {
      await page.goto(base + 'mcat?gates=prod&view=' + view, { waitUntil: 'networkidle' });
    };
    for (const view of ['today', 'course', 'practice', 'coach', 'math', 'weekly', 'diagnose', 'review', 'progress']) {
      await open(view);
      assert.equal(await page.locator('main').count(), 1, view);
      assert.ok(
        (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1,
        `${width} ${view} overflow`
      );
      if (width !== 320)
        await page.screenshot({ path: `output/playwright/mcat-v2-${view}-${width}.png`, fullPage: true });
    }
    assert.deepEqual(errors, []);
    console.log(`${width}: all v2 views render without errors or horizontal overflow`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
