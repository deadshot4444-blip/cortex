/* Deterministic Cache/Service Worker protocol checks. This is not a browser run. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const Core = require('../offline-core.js');
class CacheStorage {
  constructor() { this.map = new Map(); this.fail = null; }
  async keys() { return [...this.map.keys()]; }
  async delete(name) { return this.map.delete(name); }
  async open(name) {
    if (!this.map.has(name)) this.map.set(name, new Map());
    const entries = this.map.get(name), store = this;
    return { async match(key) { return entries.get(key)?.clone(); }, async put(key, response) { if (store.fail?.(name, key)) throw Error('Quota exceeded'); entries.set(key, response.clone()); }, async delete(key) { entries.delete(key); } };
  }
}
let checks = 0;
async function test(name, fn) { await fn(); console.log('PASS', name); checks++; }
async function fixture() {
  const files = { '/index.html': '<!doctype html><title>Saved build</title>', '/app.js': '/* saved app */', '/data/lesson.json': '{"title":"saved lesson"}' };
  const entries = await Promise.all(Object.entries(files).map(async ([url, text]) => ({ url, bytes: Buffer.byteLength(text), sha256: await Core.hash(Buffer.from(text), crypto) })));
  const manifest = { format: 1, build: 'a'.repeat(20), packs: [{ id: 'mcat', title: 'MCAT', scope: 'Fixture', entry: '/mcat', routes: ['/mcat'], files: entries }] };
  const caches = new CacheStorage(), fetch = async url => new Response(files[url] || '', { status: files[url] ? 200 : 404 });
  const options = { caches, fetch, crypto, nonce: 'first' }; return { files, manifest, caches, options };
}
function worker(f) {
  const handlers = {}, clients = new Map(); let networkFails = false, calls = 0;
  const scope = { location: { origin: 'https://cortex.test' }, CortexOfflineCore: { ...Core,
    info: name => Core.info(name, f.caches), list: () => Core.list(f.options), verify: item => Core.verify(item, f.options), remove: (name, options) => Core.remove(name, { ...options, caches: f.caches }) },
    addEventListener(type, fn) { handlers[type] = fn; } };
  const context = vm.createContext({ self: scope, importScripts() {}, caches: f.caches, URL, Response, console,
    clients: { get: async id => clients.get(id), matchAll: async () => [...clients.values()] },
    fetch: async request => { calls++; if (networkFails) throw Error('Offline'); return new Response('online ' + (request.url || request)); } });
  vm.runInContext(fs.readFileSync('offline-worker.js', 'utf8'), context);
  return { clients, set offline(value) { networkFails = value; }, get calls() { return calls; }, async request(path, mode = 'cors', clientId = '', method = 'GET') {
    let promise; handlers.fetch({ request: { url: new URL(path, 'https://cortex.test').href, mode, method }, clientId, respondWith(value) { promise = value; } });
    return promise ? await promise : null;
  }, async remove(name) { let result, operation; handlers.message({ data: { type: 'REMOVE_COURSE', name }, ports: [{ postMessage(value) { result = value; } }], waitUntil(value) { operation = value; } }); await operation; return result; } };
}
(async () => {
  await test('A complete download verifies every byte and becomes available only after completion', async () => {
    const f = await fixture(), progress = [];
    const name = await Core.download(f.manifest, 'mcat', { ...f.options, async onProgress(done, total) { progress.push([done, total]); } });
    const items = await Core.list({ ...f.options, verify: true }); assert.equal(items.length, 1); assert.equal(items[0].available, true); assert.equal(items[0].name, name); assert.deepEqual(progress, [[1,3],[2,3],[3,3]]);
    assert.equal(await (await (await f.caches.open(name)).match('/app.js')).text(), f.files['/app.js']);
  });
  await test('Changed bytes, missing files and quota failure discard only the incomplete replacement', async () => {
    for (const failure of ['changed','missing','quota']) {
      const f = await fixture(), old = await Core.download(f.manifest, 'mcat', f.options);
      const options = { ...f.options, nonce: 'replacement' };
      if (failure === 'changed') options.fetch = async () => new Response('wrong build');
      if (failure === 'missing') options.fetch = async () => new Response('', { status: 404 });
      if (failure === 'quota') f.caches.fail = (name, key) => name !== old && key === '/app.js';
      await assert.rejects(Core.download(f.manifest, 'mcat', options)); assert.deepEqual(await f.caches.keys(), [old]); assert.equal(await Core.verify(await Core.info(old, f.caches), f.options), true);
    }
  });
  await test('Stopping a replacement or interrupted marker write retains the prior complete course', async () => {
    const f = await fixture(), old = await Core.download(f.manifest, 'mcat', f.options), controller = new AbortController();
    await assert.rejects(Core.download(f.manifest, 'mcat', { ...f.options, nonce: 'stopped', signal: controller.signal, onProgress() { controller.abort(); } }), /stopped/);
    f.caches.fail = (name, key) => name !== old && key === Core.MARKER;
    await assert.rejects(Core.download(f.manifest, 'mcat', { ...f.options, nonce: 'marker' })); assert.deepEqual(await f.caches.keys(), [old]);
  });
  await test('Incomplete orphan caches never appear ready and later file eviction is detected', async () => {
    const f = await fixture(), name = await Core.download(f.manifest, 'mcat', f.options);
    await f.caches.open(Core.PREFIX + f.manifest.build + '-mcat-orphan');
    assert.equal((await Core.list(f.options)).length, 1);
    await (await f.caches.open(name)).delete('/data/lesson.json'); assert.equal((await Core.list({ ...f.options, verify: true }))[0].available, false);
  });
  await test('Malformed manifests, private endpoints, traversal, duplicate files and future formats are rejected', async () => {
    const f = await fixture();
    for (const mutate of [m => { m.format = 2; }, m => { m.packs[0].files[0].url = 'https://private.test/token'; }, m => { m.packs[0].files[0].url = '/api/session'; }, m => { m.packs[0].files[0].url = '/../private.json'; }, m => { m.packs[0].files.push(m.packs[0].files[0]); }]) {
      const bad = structuredClone(f.manifest); mutate(bad); assert.throws(() => Core.validate(bad));
    }
    assert.deepEqual(await f.caches.keys(), []);
  });
  await test('Offline navigation redirects to a pinned complete version and remains pinned after reconnect', async () => {
    const f = await fixture(), name = await Core.download(f.manifest, 'mcat', f.options), w = worker(f); w.offline = true;
    const redirect = await w.request('/mcat?view=today', 'navigate'); assert.equal(redirect.status, 307); const url = new URL(redirect.headers.get('location')); assert.equal(url.searchParams.get('offline'), name); assert.equal(url.searchParams.get('view'), 'today');
    assert.equal(await (await w.request(url.href, 'navigate')).text(), f.files['/index.html']);
    w.clients.set('learner', { url: url.href }); w.offline = false;
    assert.equal(await (await w.request('/app.js?v=old', 'script', 'learner')).text(), f.files['/app.js']);
    assert.equal(await (await w.request('/data/lesson.json?v=old', 'cors', 'learner')).text(), f.files['/data/lesson.json']);
    assert.equal((await w.request('/data/not-downloaded.json', 'cors', 'learner')).status, 503);
    assert.match(await (await w.request('/mcat', 'navigate')).text(), /^online/);
  });
  await test('Normal online asset failures never combine an online page with another cached build', async () => {
    const f = await fixture(); await Core.download(f.manifest, 'mcat', f.options); const w = worker(f); w.clients.set('online', { url: 'https://cortex.test/mcat' }); w.offline = true;
    await assert.rejects(w.request('/app.js?v=new', 'script', 'online'), /Offline/);
  });
  await test('External auth, POST submissions and non-course endpoints bypass the offline handler', async () => {
    const f = await fixture(), w = worker(f);
    assert.equal(await w.request('https://account.supabase.co/auth/v1/token'), null); assert.equal(await w.request('/', 'cors', '', 'POST'), null); assert.equal(await w.request('/cx-visits/incr'), null); assert.equal(w.calls, 0);
  });
  await test('Missing courses and unsupported routes give recovery navigation without clearing work', async () => {
    const f = await fixture(), name = await Core.download(f.manifest, 'mcat', f.options), w = worker(f); w.offline = true;
    assert.equal((await w.request('/neuro', 'navigate')).status, 503);
    assert.equal((await w.request('/neuro?offline=' + name, 'navigate')).status, 503);
    assert.equal((await w.request('/mcat?offline=invalid', 'navigate')).status, 503);
    const trailing = await w.request('/mcat/?offline=' + name, 'navigate'); assert.equal(trailing.status, 307); assert.equal(new URL(trailing.headers.get('location')).pathname, '/mcat');
  });
  await test('Removing a download rejects in-use versions and unrelated browser caches', async () => {
    const f = await fixture(), name = await Core.download(f.manifest, 'mcat', f.options), w = worker(f); w.clients.set('learner', { url: 'https://cortex.test/mcat?offline=' + name });
    assert.match((await w.remove(name)).error, /Close tabs/); assert.ok(await Core.info(name, f.caches));
    w.clients.clear(); assert.equal((await w.remove(name)).ok, true); assert.deepEqual(await f.caches.keys(), []); assert.match((await w.remove('other-app-cache')).error, /not a Cortex/);
  });
  await test('An unfinished download cannot be discarded from another tab while its owner is open', async () => {
    const f = await fixture(), name = Core.PREFIX + f.manifest.build + '-mcat-pending', cache = await f.caches.open(name), w = worker(f);
    await cache.put(Core.PENDING, new Response(JSON.stringify({ clientId: 'downloader' })));
    w.clients.set('downloader', { id: 'downloader', url: 'https://cortex.test/academy?view=storage' });
    assert.match((await w.remove(name)).error, /Another open tab/); assert.ok((await f.caches.keys()).includes(name));
    w.clients.clear(); assert.equal((await w.remove(name)).ok, true); assert.deepEqual(await f.caches.keys(), []);
  });
  await test('The current six-course inventory has matching files and includes its app dependencies', async () => {
    const manifest = Core.validate(JSON.parse(fs.readFileSync('offline-manifest.json'))); assert.equal(manifest.packs.length, 6);
    for (const pack of manifest.packs) {
      for (const file of pack.files) { const body = fs.readFileSync(file.url.slice(1)); assert.equal(body.byteLength, file.bytes, file.url); assert.equal(await Core.hash(body, crypto), file.sha256, file.url); }
      for (const file of ['/index.html','/app.js','/auth.js','/auth-progress.js','/assets/supabase.js','/study-backup.js','/academy-storage.js','/offline-core.js','/offline.js','/academy-curriculum.js','/academy-connect.js','/data/academy-curriculum.json']) assert.ok(pack.files.some(f => f.url === file), pack.id + ' missing ' + file);
    }
  });
  console.log(`${checks} offline cache and worker protocol checks passed. Real browser lifecycle, airplane mode and device storage are pending.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
