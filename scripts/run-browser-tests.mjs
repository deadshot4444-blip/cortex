#!/usr/bin/env node
// Run the Playwright browser suites (scripts/smoke-*.mjs and scripts/test-*.mjs) against a
// local server started for the occasion, then report one line per suite.
//
//   npm run test:browser                 # every browser suite
//   node scripts/run-browser-tests.mjs smoke-neuro test-mcat-v2-today   # a subset (name or file)
//
// Each suite reads CORTEX_URL, so the same scripts can target a deployed site instead:
//   CORTEX_URL=https://cortexmedical.academy/ node scripts/smoke-release-gates.mjs
//
// Requires `npx playwright install chromium` once per machine.
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.CORTEX_TEST_PORT) || 8805;
const BASE = `http://127.0.0.1:${PORT}/`;

const requested = process.argv.slice(2).map(name => name.replace(/^scripts\//, '').replace(/\.mjs$/, ''));
const suites = readdirSync(path.join(ROOT, 'scripts'))
  .filter(name => /^(smoke|test)-.*\.mjs$/.test(name))
  .map(name => name.replace(/\.mjs$/, ''))
  .filter(name => !requested.length || requested.includes(name))
  .sort();
if (!suites.length) {
  console.error('No browser suites matched', requested);
  process.exit(2);
}

const server = spawn('python3', ['scripts/serve.py', '--port', String(PORT)], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const stop = () => { if (!server.killed) server.kill(); };
process.on('exit', stop);
process.on('SIGINT', () => { stop(); process.exit(130); });

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await fetch(BASE + 'index.html')).ok) return; } catch { /* not up yet */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Local server did not start on ${BASE}`);
}

function run(suite) {
  return new Promise(resolve => {
    const started = Date.now();
    const child = spawn(process.execPath, [`scripts/${suite}.mjs`], {
      cwd: ROOT, env: { ...process.env, CORTEX_URL: BASE }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('close', code => resolve({ suite, code, output, seconds: ((Date.now() - started) / 1000).toFixed(1) }));
  });
}

await waitForServer();
let failed = 0;
for (const suite of suites) {
  const result = await run(suite);
  const status = result.code === 0 ? 'PASS' : 'FAIL';
  if (result.code !== 0) failed++;
  console.log(`${status}  ${suite}  (${result.seconds}s)`);
  if (result.code !== 0) console.log(result.output.trim().split('\n').slice(-12).map(line => '      ' + line).join('\n'));
}
console.log(`\n${suites.length - failed}/${suites.length} browser suites passed`);
stop();
process.exit(failed ? 1 : 0);
