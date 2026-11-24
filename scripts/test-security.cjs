// Safeguards for learner accounts, checked in the files that ship:
//   * the Content-Security-Policy in _headers, and that it still agrees with the pages, the
//     sign-in code and the Python worker it has to allow;
//   * that no third-party answer is served under this site's own address (the visitor counter
//     goes through an edge function that returns only a checked number);
//   * that the database schema leaves nothing open to a visitor who is not signed in;
//   * that no secret key has been committed. The repository is public.
// The sign-in session is kept in browser storage, so a script that runs on a page can take it.
// These checks exist so that a later edit cannot quietly remove what prevents that.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const SITE = 'https://cortexmedical.academy';
const read = file => fs.readFileSync(file, 'utf8');
const PAGES = fs.readdirSync('.').filter(name => name.endsWith('.html'));
const RUNTIME = [
  ...fs.readdirSync('.').filter(name => name.endsWith('.js') && name !== 'eslint.config.mjs'),
  ...fs.readdirSync('lab-3d').map(name => `lab-3d/${name}`),
].filter(name => name.endsWith('.js'));

// Headers of the site-wide /* block in _headers.
function siteHeaders() {
  const headers = {};
  let inside = false;
  for (const line of read('_headers').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      inside = line.trim() === '/*';
      continue;
    }
    if (!inside) continue;
    const at = line.indexOf(':');
    headers[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
  }
  return headers;
}
// { 'script-src': ["'self'", ...], ... }
function policy() {
  const text = siteHeaders()['content-security-policy'];
  assert.ok(text, '_headers sends a Content-Security-Policy on every path');
  return Object.fromEntries(
    text
      .split(';')
      .map(part => part.trim().split(/\s+/))
      .filter(part => part[0])
      .map(([name, ...sources]) => [name, sources])
  );
}
const hosts = sources => sources.filter(source => /^[a-z]+:\/\//.test(source)).sort();
const inlineScripts = html =>
  [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(found => !/\bsrc\s*=/.test(found[1]))
    .map(found => ({ type: (found[1].match(/\btype="([^"]*)"/) || [])[1] || '', body: found[2] }));

test('the policy refuses inline and evaluated scripts, plug-ins, framing and outside form targets', () => {
  const csp = policy();
  assert.deepEqual(csp['default-src'], ["'self'"]);
  for (const banned of [
    "'unsafe-inline'",
    "'unsafe-eval'",
    "'unsafe-hashes'",
    '*',
    'https:',
    'http:',
    'data:',
    'blob:',
  ])
    assert.ok(!csp['script-src'].includes(banned), `script-src must not contain ${banned}`);
  assert.ok(csp['script-src'].includes("'self'"));
  assert.deepEqual(csp['object-src'], ["'none'"]);
  assert.deepEqual(csp['base-uri'], ["'none'"]);
  assert.deepEqual(csp['frame-ancestors'], ["'none'"]);
  assert.deepEqual(csp['form-action'], ["'self'"]);
  assert.deepEqual(csp['worker-src'], ["'self'"]);
  for (const name of ['script-src', 'connect-src', 'img-src', 'font-src', 'media-src', 'style-src'])
    for (const source of hosts(csp[name])) assert.match(source, /^(?:https|wss):\/\//, `${name}: ${source}`);
  const headers = siteHeaders();
  assert.equal(headers['x-frame-options'], 'DENY');
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(headers['cross-origin-opener-policy'], 'same-origin');
});

test('the only inline script on any page is the import map the policy names by hash', () => {
  const allowed = policy()['script-src'].filter(source => source.startsWith("'sha256-"));
  assert.equal(allowed.length, 1, 'one hashed inline script');
  let importMaps = 0;
  for (const page of PAGES) {
    const html = read(page);
    for (const script of inlineScripts(html)) {
      // A JSON data block is never run, so the policy does not apply to it.
      if (script.type === 'application/ld+json') continue;
      assert.equal(script.type, 'importmap', `${page}: an inline <script> the policy would block`);
      const hash = `'sha256-${crypto.createHash('sha256').update(script.body, 'utf8').digest('base64')}'`;
      assert.equal(
        hash,
        allowed[0],
        `${page}: the import map changed. Put its new hash in the Content-Security-Policy line of _headers.`
      );
      importMaps += 1;
    }
    assert.doesNotMatch(html, /<[^>]+\son[a-z]+\s*=/i, `${page}: inline event handlers are blocked by the policy`);
    assert.doesNotMatch(html, /<(?:base|iframe|object|embed)\b/i, `${page}: element the policy forbids`);
    assert.doesNotMatch(html, /\b(?:src|href)="http:\/\//, `${page}: insecure address`);
    for (const found of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="(https?:\/\/[^"]+)"/g))
      assert.ok(found[1].startsWith(SITE + '/'), `${page}: loads ${found[1]} from another site`);
  }
  assert.ok(importMaps >= 1, 'index.html carries the import map');
});

test("the app's own scripts contain nothing the policy would block", () => {
  const handler =
    /<[^>`]*\son(?:abort|blur|change|click|close|dblclick|error|focus\w*|input|key\w+|load\w*|mouse\w+|pointer\w+|submit|toggle|touch\w+)\s*=/i;
  for (const file of RUNTIME) {
    const source = read(file);
    assert.doesNotMatch(source, handler, `${file}: writes an inline event handler; use addEventListener`);
    assert.doesNotMatch(source, /['"`]\s*javascript:/i, `${file}: javascript: address`);
    assert.doesNotMatch(source, /\beval\s*\(|\bnew Function\s*\(/, `${file}: evaluates text as code`);
    assert.doesNotMatch(source, /setAttribute\(\s*['"]on[a-z]+['"]/i, `${file}: sets an inline event handler`);
  }
});

test('the policy names exactly the outside hosts the code uses', () => {
  const csp = policy();
  const supabase = read('auth.js').match(/const SUPABASE_URL = '(https:\/\/[a-z0-9]+\.supabase\.co)'/)[1];
  const pyodide = read('python-runtime-worker.js').match(/const PYODIDE_CDN = '(https:\/\/[^']+\/)'/)[1];
  assert.match(pyodide, /^https:\/\/cdn\.jsdelivr\.net\/pyodide\/v\d+\.\d+\.\d+\/full\/$/, 'Pyodide stays pinned');
  // A bare CDN host would let any package published there run as one of our scripts.
  assert.deepEqual(hosts(csp['script-src']), [pyodide], 'script-src: only the pinned Pyodide folder');
  assert.deepEqual(
    hosts(csp['connect-src']),
    [pyodide, supabase, supabase.replace('https://', 'wss://')].sort(),
    'connect-src: Pyodide packages and the Supabase project named in auth.js'
  );
  // blob: lets a page read back a download it prepared itself; it cannot reach another site.
  assert.deepEqual(csp['connect-src'].filter(source => !hosts([source]).length).sort(), ["'self'", 'blob:']);
  for (const name of ['img-src', 'font-src', 'media-src', 'style-src'])
    assert.deepEqual(hosts(csp[name]), [], `${name}: nothing is loaded from another site`);
});

test('the sign-in code carries a publishable key, never a secret one', () => {
  const key = read('auth.js').match(/const SUPABASE_ANON_KEY = '([^']+)'/)[1];
  assert.match(key, /^sb_publishable_[A-Za-z0-9_-]{20,}$/);
});

test("_redirects never serves another host's answer under this site's address", () => {
  const rules = read('_redirects')
    .split('\n')
    .map(line => line.split('#')[0].trim())
    .filter(Boolean)
    .map(line => line.split(/\s+/));
  for (const [from, to, status = '301'] of rules) {
    assert.ok(from.startsWith('/'), from);
    if (/^https?:\/\//.test(to))
      assert.match(
        status,
        /^30[1278]/,
        `${from} proxies ${to}: use a redirect or an edge function that checks the answer`
      );
  }
});

test('the visitor counter answers only its two requests, with a number it has checked', async () => {
  const source = read('netlify/edge-functions/visit-counter.js');
  const edge = await import(`data:text/javascript,${encodeURIComponent(source)}`);
  assert.equal(edge.config.path, '/cx-visits/*');
  // The paths app.js asks for.
  const asked = [...read('app.js').matchAll(/fetch\(`(\/cx-visits\/[^`]+)`/g)].map(found => found[1]);
  assert.deepEqual(asked, ['/cx-visits/${action}/cortexmedacademy/people']);
  assert.equal(edge.action('/cx-visits/hit/cortexmedacademy/people'), 'hit');
  assert.equal(edge.action('/cx-visits/get/cortexmedacademy/people'), 'get');
  for (const other of [
    '/cx-visits/',
    '/cx-visits/stats',
    '/cx-visits/healthcheck',
    '/cx-visits/create/cortexmedacademy/people',
    '/cx-visits/set/cortexmedacademy/people',
    '/cx-visits/delete/cortexmedacademy/people',
    '/cx-visits/info/cortexmedacademy/people',
    '/cx-visits/stream/cortexmedacademy/people',
    '/cx-visits/get/another/counter',
    '/cx-visits/get/cortexmedacademy/people/more',
    '/cx-visits/GET/cortexmedacademy/people',
    '/cx-visits/constructor/cortexmedacademy/people',
  ])
    assert.equal(edge.action(other), null, other);
  assert.equal(edge.count({ value: 1408 }), 1408);
  assert.equal(edge.count({ value: 0 }), 0);
  for (const bad of [null, [], 'x', {}, { value: '1408' }, { value: -1 }, { value: 1.5 }, { value: Infinity }])
    assert.equal(edge.count(bad), null, JSON.stringify(bad));

  const realFetch = globalThis.fetch;
  const calls = [];
  const upstream = answer => {
    globalThis.fetch = async (url, options) => {
      calls.push({ url: String(url), options });
      if (answer instanceof Error) throw answer;
      return answer;
    };
  };
  const ask = (pathAndQuery, method = 'GET') => edge.default(new Request(SITE + pathAndQuery, { method }));
  try {
    // A callback query must not reach the service: it would come back as JavaScript.
    upstream(new Response('{"value":1408}', { headers: { 'Content-Type': 'application/json' } }));
    let response = await ask('/cx-visits/get/cortexmedacademy/people?callback=alert&x=1');
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '{"value":1408}');
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://abacus.jasoncameron.dev/get/cortexmedacademy/people');
    assert.equal(calls[0].options.redirect, 'error');

    upstream(new Response('{"value":7}'));
    response = await ask('/cx-visits/hit/cortexmedacademy/people');
    assert.equal(await response.text(), '{"value":7}');
    assert.equal(calls[1].url, 'https://abacus.jasoncameron.dev/hit/cortexmedacademy/people');

    // Whatever else the service sends, the browser gets a fixed JSON error and nothing of it.
    for (const answer of [
      new Response('alert(1)//({"value":1})', { headers: { 'Content-Type': 'application/javascript' } }),
      new Response('<script>alert(1)</script>', { headers: { 'Content-Type': 'text/html' } }),
      new Response('{"value":"<img src=x>"}'),
      new Response('{"value":1}', { status: 500 }),
      new Error('network down'),
    ]) {
      upstream(answer);
      response = await ask('/cx-visits/get/cortexmedacademy/people');
      assert.equal(response.status, 502);
      assert.equal(await response.text(), '{"error":"Counter unavailable"}');
      assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    }

    // Requests the app never makes do not reach the service at all.
    const before = calls.length;
    assert.equal((await ask('/cx-visits/stats')).status, 404);
    assert.equal((await ask('/cx-visits/create/cortexmedacademy/people')).status, 404);
    assert.equal((await ask('/cx-visits/hit/cortexmedacademy/people', 'POST')).status, 405);
    assert.equal(calls.length, before);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('security.txt names the support contact and has not expired', () => {
  const text = read('.well-known/security.txt');
  const field = name => (text.match(new RegExp(`^${name}: (.+)$`, 'm')) || [])[1];
  const support = read('app.js').match(/href="mailto:([^"]+)">Contact</)[1];
  assert.equal(field('Contact'), `mailto:${support}`, 'the same address as the Contact link in the footer');
  assert.equal(field('Canonical'), `${SITE}/.well-known/security.txt`);
  const expires = Date.parse(field('Expires'));
  assert.ok(Number.isFinite(expires), 'Expires is a date');
  assert.ok(
    expires > Date.now(),
    'Renew .well-known/security.txt: set Expires to a date within the next year (an expired file is ignored).'
  );
});

test('every table has row-level security and nothing is open to a visitor who is not signed in', () => {
  const sql = read('supabase/schema.sql')
    .split('\n')
    .map(line => line.split('--')[0])
    .join('\n');
  const tables = [...sql.matchAll(/create table if not exists public\.([a-z_]+)/g)].map(found => found[1]);
  assert.deepEqual(tables, ['progress', 'preview_access']);
  for (const table of tables)
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security;`), table);
  const policies = [...sql.matchAll(/create policy "[^"]+" on public\.([a-z_]+)\s+([^;]+);/g)];
  assert.equal(policies.length, 4);
  for (const [, table, rule] of policies) {
    assert.ok(tables.includes(table), table);
    assert.doesNotMatch(rule, /\bto\s+(?:anon|public)\b/i, `${table}: a policy for visitors who are not signed in`);
    assert.doesNotMatch(rule, /\(\s*true\s*\)/i, `${table}: a policy that allows every row`);
    assert.match(rule, /auth\.(?:uid|jwt)\(\)/, `${table}: each rule is tied to the signed-in account`);
  }
  // Only the account's own row may be written; nobody can write a reviewer grant through the API.
  assert.doesNotMatch(sql, /create policy "[^"]+" on public\.preview_access\s+for (?:insert|update|delete|all)/i);
  assert.match(sql, /add constraint progress_data_size check \(octet_length\(data::text\) <= 16777216\)/);
});

test('no secret key or private key is committed', () => {
  // Built from pieces so this file does not match itself.
  const secrets = [
    ['Supabase secret key', new RegExp('sb_' + 'secret_[A-Za-z0-9_-]{8,}')],
    ['Supabase access token', new RegExp('sbp_' + '[a-f0-9]{30,}')],
    ['private key', new RegExp('-----BEGIN [A-Z ]*PRIVATE' + ' KEY-----')],
    ['GitHub token', new RegExp('(?:gh[pousr]_|github_pat_)' + '[A-Za-z0-9_]{30,}')],
    ['Netlify token', new RegExp('nfp_' + '[A-Za-z0-9]{30,}')],
    ['API key', new RegExp('\\bsk-(?:ant-|proj-)?' + '[A-Za-z0-9_-]{32,}')],
  ];
  const jwt = /eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g;
  const skipDirs = new Set(['.git', 'node_modules', 'context', 'output', '.playwright-cli', '.claude']);
  const textFile = /\.(?:js|cjs|mjs|json|html|css|md|py|sql|toml|txt|yml|yaml|command|svg)$|^[_.][a-z]+$|^[^.]+$/;
  const files = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name) && file !== path.join('data', 'raw')) walk(file);
      } else if (entry.isFile() && textFile.test(entry.name)) files.push(file);
    }
  })('.');
  assert.ok(files.includes('auth.js') && files.includes('_headers') && files.length > 200, 'the tree was scanned');
  for (const file of files) {
    const text = read(file);
    for (const [name, pattern] of secrets) assert.doesNotMatch(text, pattern, `${file}: looks like a ${name}`);
    for (const found of text.matchAll(jwt)) {
      let claims;
      try {
        claims = JSON.parse(Buffer.from(found[1], 'base64url').toString('utf8'));
      } catch {
        continue;
      }
      assert.notEqual(claims?.role, 'service_role', `${file}: a Supabase service-role key`);
    }
  }
  assert.match(read('.gitignore'), /^context\/$/m, 'private working notes stay untracked');
});

test('the local server sends the same site-wide headers, so the policy is exercised before it ships', () => {
  const sent = JSON.parse(
    execFileSync(
      'python3',
      [
        '-c',
        'import json, runpy; print(json.dumps(runpy.run_path("scripts/serve.py", run_name="serve")["SITE_HEADERS"]))',
      ],
      { encoding: 'utf8' }
    )
  );
  const expected = Object.entries(siteHeaders()).filter(([name]) => name !== 'cache-control');
  assert.deepEqual(
    sent.map(([name, value]) => [name.toLowerCase(), value]),
    expected
  );
  assert.ok(sent.some(([name]) => name === 'Content-Security-Policy'));
});
