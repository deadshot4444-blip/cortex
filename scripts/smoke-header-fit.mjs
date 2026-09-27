// Header fit: the main bar's right cluster (Neuroengineering, Sign in / Account, version chip)
// must never push the page wider than a phone. Checked at 320, 360 and 390 px, signed out and
// signed in (the Account button is wider), with the real APP_VERSION and a long stubbed one.
// Below 380 px the chip drops its pre-release suffix; the full version stays in its text.
//
//   CORTEX_URL=http://127.0.0.1:8765/ node scripts/smoke-header-fit.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const base = process.env.CORTEX_URL || 'http://127.0.0.1:8765/';
const REAL = readFileSync(new URL('../app.js', import.meta.url), 'utf8').match(/APP_VERSION = '([^']+)'/)[1];
const LONG = '2.35.10-local.12';
// Minimal stand-in for the Supabase SDK: a stored session signs in, and no row exists anywhere.
const sdk = `window.supabase={createClient(){return {auth:{onAuthStateChange(fn){setTimeout(()=>fn('INITIAL_SESSION',JSON.parse(localStorage.getItem('test-account')||'null')),0);return {data:{subscription:{unsubscribe(){}}}};}},from(){const q={select:()=>q,eq:()=>q,async maybeSingle(){return {data:null,error:null};}};return q;}};}};`;

const browser = await chromium.launch({ headless: true });
let checks = 0;
try {
  for (const version of [REAL, LONG])
    for (const user of [null, 'fit'])
      for (const width of [320, 360, 390]) {
        const ctx = await browser.newContext({ viewport: { width, height: 720 } });
        await ctx.addInitScript(
          ({ user, version }) => {
            if (sessionStorage.getItem('fit-seeded')) return;
            sessionStorage.setItem('fit-seeded', '1');
            localStorage.setItem('cs-seen-ver', version);
            if (user) {
              localStorage.setItem(
                'test-account',
                JSON.stringify({ user: { id: user, email: user + '@example.test' } })
              );
              localStorage.setItem('cortex-progress-owner-v1', JSON.stringify({ id: user, token: 'fit' }));
            }
          },
          { user, version }
        );
        await ctx.route('**/assets/supabase.js*', r => r.fulfill({ contentType: 'application/javascript', body: sdk }));
        await ctx.route('**/*.supabase.co/**', r => r.abort());
        await ctx.route('**/api/**', r => r.fulfill({ contentType: 'application/json', body: '{"value":0}' }));
        await ctx.route(/\/app\.js(\?|$)/, async r => {
          const res = await r.fetch();
          const body = (await res.text()).replace(/const APP_VERSION = '[^']*';/, `const APP_VERSION = '${version}';`);
          await r.fulfill({ response: res, body });
        });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(base + 'learn?gates=prod', { waitUntil: 'networkidle' });
        await page.waitForSelector('.acctbtn:not([hidden])');
        const m = await page.evaluate(() => {
          const bar = document.querySelector('.topbar.mainbar');
          const pad = parseFloat(getComputedStyle(bar).paddingRight);
          return {
            sw: document.documentElement.scrollWidth,
            iw: innerWidth,
            right: document.querySelector('.bar-right').getBoundingClientRect().right,
            limit: bar.getBoundingClientRect().right - pad,
            acct: document.querySelector('.acctbtn').innerText.trim(),
            shown: document.querySelector('button.ver').innerText.trim(),
            full: document.querySelector('button.ver').textContent.trim(),
          };
        });
        const label = `${width}px ${user ? 'signed in' : 'signed out'} v${version}`;
        assert.equal(m.acct, user ? 'ACCOUNT' : 'SIGN IN', label);
        assert.ok(m.sw <= m.iw, `${label}: page is ${m.sw}px wide`);
        assert.ok(
          m.right <= m.limit + 0.5,
          `${label}: right cluster ends at ${m.right}, bar content ends at ${m.limit}`
        );
        assert.equal(m.full, 'v' + version, `${label}: the chip keeps the full version in its text`);
        assert.equal(m.shown, width < 380 ? 'v' + version.split('-')[0] : 'v' + version, label);
        assert.deepEqual(errors, [], label);
        checks++;
        await ctx.close();
      }
  console.log(`${checks} header fit checks passed (320/360/390 px, signed out and in, real and long versions).`);
} finally {
  await browser.close();
}
