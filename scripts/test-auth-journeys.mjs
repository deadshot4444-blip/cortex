import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.CORTEX_URL || 'http://127.0.0.1:8805/';
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base))
  throw Error('Use an isolated local preview for synthetic accounts');
const browser = await chromium.launch({ headless: true });
const sdk = `window.supabase={createClient(){let cb;const auth={onAuthStateChange(fn){cb=fn;setTimeout(()=>fn('INITIAL_SESSION',JSON.parse(localStorage.getItem('test-account')||'null')),0);return {data:{subscription:{unsubscribe(){}}}};},async signOut(){if(window.testSignOutFailure)return {error:{message:'offline'}};localStorage.removeItem('test-account');cb('SIGNED_OUT',null);return {};},async signInWithOtp(){throw Error('mail offline');}};window.testAuthEvent=(id)=>{const session=id?{user:{id,email:id+'@example.test'}}:null;if(session)localStorage.setItem('test-account',JSON.stringify(session));else localStorage.removeItem('test-account');cb(id?'SIGNED_IN':'SIGNED_OUT',session);};return {auth,from(table){let op='read',value,revision,uid=table==='preview_access'?(JSON.parse(localStorage.getItem('test-account')||'null')?.user?.id):undefined;const q={select(){return q;},eq(k,v){if(k==='user_id')uid=v;else revision=v;return q;},update(v){op='update';value=v;return q;},insert(v){op='insert';value=v;uid=v.user_id;return q;},async maybeSingle(){return fetch('/__auth-test',{method:'POST',body:JSON.stringify({table,op,value,uid,revision})}).then(r=>r.json());}};return q;}};}};`;
let checks = 0;
async function setup({ user = null, storage = {}, rows = {}, grants = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    errors = [],
    calls = [];
  await ctx.addInitScript(
    ({ user, storage }) => {
      if (!sessionStorage.getItem('test-seeded')) {
        sessionStorage.setItem('test-seeded', '1');
        for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
        if (user)
          localStorage.setItem('test-account', JSON.stringify({ user: { id: user, email: user + '@example.test' } }));
      }
    },
    { user, storage }
  );
  await ctx.route('**/assets/supabase.js*', r => r.fulfill({ contentType: 'application/javascript', body: sdk }));
  await ctx.route('**/*.supabase.co/**', r => {
    errors.push('Unexpected real backend request');
    return r.abort();
  });
  await ctx.route('**/api/**', r => r.fulfill({ contentType: 'application/json', body: '{"value":0}' }));
  let offline = false;
  const closedAssets = [];
  ctx.on('request', request => {
    if (/\/(socrates|anatomy|reference|neuro)\.js(\?|$)/.test(request.url())) closedAssets.push(request.url());
  });
  await ctx.route('**/__auth-test', async r => {
    const q = r.request().postDataJSON();
    if (q.table === 'preview_access') {
      // Row-level security returns only the signed-in account's row; the mock SDK sends the
      // session's user id in place of the JWT.
      const courses = grants[q.uid];
      return r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: courses ? { courses } : null, error: null }),
      });
    }
    calls.push(q);
    let data = null,
      error = null,
      old = rows[q.uid];
    if (offline) error = { message: 'offline' };
    else if (q.op === 'read') data = old || null;
    else if (q.op === 'insert' && old) error = { code: '23505' };
    else if (q.op === 'update' && old?.updated_at !== q.revision) {
      /* stale revision: the conditional update matches no row */
    } else {
      rows[q.uid] = { data: q.value.data, updated_at: q.value.updated_at };
      data = { updated_at: q.value.updated_at };
    }
    await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data, error }) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  return {
    ctx,
    page,
    errors,
    calls,
    rows,
    closedAssets,
    setOffline(v) {
      offline = v;
    },
  };
}
const revision = '2026-09-06T00:00:00.000Z';
const owned = (id, data = {}) => ({
  'cortex-progress-owner-v1': JSON.stringify({ id, token: 'test-' + id }),
  'cs-sync-meta': JSON.stringify({ owner: id, known: true, revision }),
  ...data,
});
async function test(name, fn, config) {
  const h = await setup(config);
  try {
    await fn(h);
    assert.deepEqual(h.errors, []);
    checks++;
    console.log('PASS', name);
  } finally {
    await h.ctx.close();
  }
}
try {
  await test(
    'Native browser storage writes and removals sync; sessionStorage stays independent',
    async h => {
      await h.page.goto(base + 'learn', { waitUntil: 'networkidle' });
      await h.page.waitForFunction(() => currentUser?.id === 'A' && !progress.paused);
      await h.page.evaluate(async () => {
        localStorage.setItem('cs-auth-check', 'saved');
        await progress.sync();
      });
      assert.equal(h.rows.A.data['cs-auth-check'], 'saved');
      await h.page.evaluate(async () => {
        localStorage.removeItem('cs-auth-check');
        sessionStorage.setItem('session-only', 'keep');
        sessionStorage.clear();
        await progress.sync();
      });
      assert.equal(h.rows.A.data['cs-auth-check'], undefined);
      assert.equal(await h.page.evaluate(() => localStorage.getItem('setItem')), null);
    },
    { user: 'A', storage: owned('A'), rows: { A: { data: {}, updated_at: revision } } }
  );
  await test(
    'Failed sign-out stays signed in; successful sign-out removes account work from the active guest workspace',
    async h => {
      await h.page.goto(base + 'learn', { waitUntil: 'networkidle' });
      await h.page.waitForFunction(() => currentUser?.id === 'A');
      await h.page.evaluate(async () => {
        localStorage.setItem('cs-auth-check', 'A private');
        await progress.sync();
        window.testSignOutFailure = true;
        openAuth();
      });
      await h.page.click('[data-signout]');
      assert.match(await h.page.locator('.fbmodal [role="status"]').innerText(), /Sign-out could not finish/);
      assert.equal(await h.page.evaluate(() => currentUser.id), 'A');
      await h.page.evaluate(() => (window.testSignOutFailure = false));
      await h.page.click('[data-signout]');
      await h.page.waitForFunction(() => JSON.parse(localStorage.getItem('cortex-progress-owner-v1')).id === 'guest');
      await h.page.waitForLoadState('networkidle');
      assert.equal(await h.page.evaluate(() => localStorage.getItem('cs-auth-check')), null);
      assert.equal(
        await h.page.evaluate(
          () => JSON.parse(localStorage.getItem('cortex-progress-copy-v1:A')).data['cs-auth-check']
        ),
        'A private'
      );
    },
    { user: 'A', storage: owned('A'), rows: { A: { data: {}, updated_at: revision } } }
  );
  await test('Mail failures leave a retryable sign-in form without sending a real message', async h => {
    await h.page.goto(base + 'learn', { waitUntil: 'networkidle' });
    await h.page.evaluate(() => openAuth());
    await h.page.fill('#auth-email', 'learner@example.test');
    await h.page.click('[data-send]');
    assert.match(await h.page.locator('#auth-status').innerText(), /Couldn’t send/);
    assert.equal(await h.page.locator('[data-send]').isDisabled(), false);
  });
  await test(
    'Account switching prevents a stale second tab from writing into the new account',
    async h => {
      await h.page.goto(base + 'learn', { waitUntil: 'networkidle' });
      await h.page.evaluate(async () => {
        localStorage.setItem('cs-auth-check', 'A only');
        await progress.sync();
      });
      const other = await h.ctx.newPage();
      await other.goto(base + 'learn', { waitUntil: 'networkidle' });
      await h.page.evaluate(() => testAuthEvent('B'));
      await h.page.waitForFunction(() => JSON.parse(localStorage.getItem('cortex-progress-owner-v1')).id === 'B');
      await h.page.waitForLoadState('networkidle');
      // Learn loads StudyStorage, so the shared recovery dialog owns workspace changes.
      // The standalone account dialog is used only before the course storage layer loads.
      await other.waitForSelector('#study-save-conflict');
      assert.equal(await other.locator('#study-conflict-title').innerText(), 'Your active workspace changed.');
      assert.equal(await other.evaluate(() => progress.paused && StudyStorage.paused), true);
      assert.equal(await other.locator('dialog[open]').count(), 1);
      assert.equal(
        await other.evaluate(() => {
          try {
            localStorage.setItem('cs-auth-check', 'stale');
            return false;
          } catch {
            return true;
          }
        }),
        true
      );
      assert.equal(await h.page.evaluate(() => localStorage.getItem('cs-auth-check')), null);
      assert.equal(h.rows.B?.data['cs-auth-check'], undefined);
    },
    { user: 'A', storage: owned('A'), rows: { A: { data: {}, updated_at: revision } } }
  );
  await test(
    'Cloud conflicts show usable recovery controls at 320px',
    async h => {
      await h.page.setViewportSize({ width: 320, height: 844 });
      await h.page.goto(base + 'learn', { waitUntil: 'networkidle' });
      await h.page.waitForFunction(() => progress.state === 'conflict');
      await h.page.evaluate(() => openAuth());
      const download = h.page.waitForEvent('download');
      await h.page.click('[data-download]');
      const file = await download;
      let text = '';
      for await (const c of await file.createReadStream()) text += c;
      const saved = JSON.parse(text);
      assert.equal(saved.device.data['cs-auth-check'], 'device');
      assert.equal(saved.cloud.data['cs-auth-check'], 'remote');
      assert.equal(await h.page.locator('[data-cloud]').isVisible(), true);
      assert.equal(await h.page.locator('[data-device]').isVisible(), true);
      assert.ok(await h.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.ok(
        await h.page.evaluate(() => {
          const box = document.querySelector('.fbmodal').getBoundingClientRect();
          return [...document.querySelectorAll('.fbmodal button')].every(b => {
            const r = b.getBoundingClientRect();
            return r.left >= box.left && r.right <= box.right;
          });
        })
      );
      await h.page.screenshot({ path: 'output/playwright/auth-conflict-320.png' });
    },
    {
      user: 'A',
      storage: { ...owned('A', { 'cs-auth-check': 'device' }), 'cs-sync-dirty': 'pending' },
      rows: { A: { data: { 'cs-auth-check': 'remote' }, updated_at: '2026-09-06T00:00:01.000Z' } },
    }
  );
  const PREVIEW = 'cortex-preview-access-v1';
  await test(
    'An invited reviewer opens Learn to Learn under production gates; other closed courses stay closed',
    async h => {
      await h.page.goto(base + 'learn?gates=prod', { waitUntil: 'networkidle' });
      // The first load caches the grant and reloads once; the course then renders.
      await h.page.waitForSelector('main.ltl-shell', { timeout: 15000 });
      assert.deepEqual(JSON.parse(await h.page.evaluate(k => localStorage.getItem(k), PREVIEW)).courses, ['socrates']);
      assert.equal(await h.page.locator('.comingsoon').count(), 0);
      assert.match(await h.page.locator('[data-go="socrates"] .nav-availability').innerText(), /Preview/i);
      await h.page.evaluate(() => openAuth());
      assert.match(await h.page.locator('.acct-preview').textContent(), /Preview access: Learn to Learn/);
      await h.page.goto(base + 'anatomy?gates=prod', { waitUntil: 'networkidle' });
      await h.page.waitForSelector('main.comingsoon');
      assert.equal(await h.page.evaluate(() => [...PREVIEW_COURSES].join()), 'socrates');
      assert.deepEqual(
        h.closedAssets.filter(url => !/socrates\.js/.test(url)),
        [],
        'no other closed course module is downloaded'
      );
      // Signing out closes it again and drops the cached grant.
      await h.page.evaluate(() => window.testAuthEvent(null));
      await h.page.waitForFunction(() => JSON.parse(localStorage.getItem('cortex-progress-owner-v1')).id === 'guest');
      await h.page.waitForLoadState('networkidle');
      await h.page.goto(base + 'learn?gates=prod', { waitUntil: 'networkidle' });
      await h.page.waitForSelector('main.comingsoon');
      assert.equal(await h.page.evaluate(k => localStorage.getItem(k), PREVIEW), null);
    },
    {
      user: 'rev',
      storage: owned('rev'),
      rows: { rev: { data: {}, updated_at: revision } },
      grants: { rev: ['socrates'] },
    }
  );
  await test(
    'An uninvited account sees the gate and is told it has no preview access',
    async h => {
      await h.page.goto(base + 'learn?gates=prod', { waitUntil: 'networkidle' });
      await h.page.waitForSelector('main.comingsoon');
      await h.page.waitForFunction(() => !document.querySelector('[data-preview-note]').hidden);
      assert.match(
        await h.page.locator('[data-preview-note]').innerText(),
        /plain@example\.test\) does not have preview access to Learn to Learn/
      );
      assert.equal(await h.page.evaluate(k => localStorage.getItem(k), PREVIEW), null);
      assert.deepEqual(h.closedAssets, [], 'no closed course module is downloaded');
    },
    { user: 'plain', storage: owned('plain'), rows: { plain: { data: {}, updated_at: revision } } }
  );
  await test('A signed-out visitor can open sign-in from a closed course page at 320px', async h => {
    await h.page.setViewportSize({ width: 320, height: 720 });
    await h.page.goto(base + 'learn?gates=prod', { waitUntil: 'networkidle' });
    await h.page.waitForSelector('main.comingsoon');
    const note = h.page.locator('[data-preview-note] button');
    assert.match(await note.innerText(), /Reviewing Learn to Learn\? Sign in with your invited email\./);
    await note.click();
    await h.page.waitForSelector('#auth-email');
    // The reviewer line and the sign-in dialog fit the phone width.
    assert.ok(
      await h.page.evaluate(() =>
        ['[data-preview-note]', '.fbmodal:not(.upd-modal)'].every(sel => {
          const r = document.querySelector(sel).getBoundingClientRect();
          return r.left >= 0 && r.right <= innerWidth;
        })
      )
    );
    assert.deepEqual(h.closedAssets, []);
  });
  console.log(`${checks} isolated account browser journeys passed.`);
} finally {
  await browser.close();
}
