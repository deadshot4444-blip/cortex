/* Public course caches. No learner records, account requests or tokens. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CortexOfflineCore = api;
})(typeof self === 'undefined' ? globalThis : self, () => {
  const PREFIX = 'cortex-offline-v1-',
    MARKER = '/__cortex_offline_complete__',
    PENDING = '/__cortex_offline_pending__';
  const cacheNameOK = name =>
    typeof name === 'string' && /^cortex-offline-v1-[a-f0-9]{20}-[a-z0-9-]{1,100}$/.test(name);
  const fileOK = path =>
    typeof path === 'string' &&
    /^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:html|js|css|json|svg|png|jpg|woff2)$/.test(path) &&
    !path.includes('..');
  function validate(manifest) {
    if (
      !manifest ||
      manifest.format !== 1 ||
      !/^[a-f0-9]{20}$/.test(manifest.build) ||
      !Array.isArray(manifest.packs) ||
      !manifest.packs.length ||
      manifest.packs.length > 20
    )
      throw Error('The offline catalog is incompatible with this app.');
    const ids = new Set();
    for (const pack of manifest.packs) {
      if (
        !/^[a-z-]{1,40}$/.test(pack.id) ||
        ids.has(pack.id) ||
        typeof pack.title !== 'string' ||
        typeof pack.scope !== 'string' ||
        !/^\/[a-z-]+$/.test(pack.entry) ||
        !Array.isArray(pack.routes) ||
        !pack.routes.includes(pack.entry) ||
        pack.routes.some(p => !/^\/(?:[a-z-]+)?$/.test(p)) ||
        !Array.isArray(pack.files) ||
        pack.files.length > 250
      )
        throw Error('An offline course description is invalid.');
      ids.add(pack.id);
      const paths = new Set();
      for (const file of pack.files) {
        if (
          !fileOK(file.url) ||
          paths.has(file.url) ||
          !/^[a-f0-9]{64}$/.test(file.sha256) ||
          !Number.isSafeInteger(file.bytes) ||
          file.bytes < 1 ||
          file.bytes > 20 * 1024 * 1024
        )
          throw Error('An offline file description is invalid.');
        paths.add(file.url);
      }
      if (!paths.has('/index.html') || pack.files.reduce((n, f) => n + f.bytes, 0) > 60 * 1024 * 1024)
        throw Error('This course cannot be downloaded as a supported offline pack.');
    }
    return manifest;
  }
  async function hash(buffer, cryptoAPI = globalThis.crypto) {
    return Array.from(new Uint8Array(await cryptoAPI.subtle.digest('SHA-256', buffer)), n =>
      n.toString(16).padStart(2, '0')
    ).join('');
  }
  async function info(name, cacheAPI = globalThis.caches) {
    if (!cacheNameOK(name) || !(await cacheAPI.keys()).includes(name)) return null;
    const cache = await cacheAPI.open(name),
      response = await cache.match(MARKER);
    if (!response) return null;
    try {
      const item = await response.json();
      validate(item.manifest);
      const pack = item.manifest.packs.find(p => p.id === item.packId);
      if (
        !pack ||
        !name.startsWith(PREFIX + item.manifest.build + '-' + pack.id + '-') ||
        !Number.isFinite(Date.parse(item.completedAt))
      )
        return null;
      return { name, pack, manifest: item.manifest, completedAt: item.completedAt };
    } catch {
      return null;
    }
  }
  async function verify(item, options = {}) {
    const cache = await (options.caches || globalThis.caches).open(item.name);
    for (const file of item.pack.files) {
      const response = await cache.match(file.url);
      if (!response?.ok) return false;
      const body = await response.arrayBuffer();
      if (body.byteLength !== file.bytes || (await hash(body, options.crypto)) !== file.sha256) return false;
    }
    return !!(await cache.match('/offline-manifest.json'));
  }
  async function list(options = {}) {
    const cacheAPI = options.caches || globalThis.caches,
      result = [];
    for (const name of await cacheAPI.keys()) {
      const item = await info(name, cacheAPI);
      if (item) {
        item.available = options.verify ? await verify(item, options) : true;
        result.push(item);
      }
    }
    return result.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }
  async function download(manifest, id, options = {}) {
    validate(manifest);
    const pack = manifest.packs.find(p => p.id === id);
    if (!pack) throw Error('This course is not in the offline catalog.');
    const cacheAPI = options.caches || globalThis.caches,
      get = options.fetch || globalThis.fetch;
    const name = PREFIX + manifest.build + '-' + id + '-' + (options.nonce || globalThis.crypto.randomUUID());
    if (!cacheNameOK(name) || (await cacheAPI.keys()).includes(name))
      throw Error('Could not create a separate course download.');
    const cache = await cacheAPI.open(name);
    const checkStop = () => {
      if (options.signal?.aborted) throw new DOMException('Download stopped', 'AbortError');
    };
    try {
      await cache.put(
        PENDING,
        new Response(JSON.stringify({ clientId: options.clientId || null }), {
          headers: { 'Content-Type': 'application/json' },
        })
      );
      for (let i = 0; i < pack.files.length; i++) {
        checkStop();
        const file = pack.files[i];
        const response = await get(file.url, {
          cache: 'reload',
          credentials: 'omit',
          redirect: 'error',
          signal: options.signal,
        });
        if (!response.ok || response.type === 'opaque')
          throw Error('A course file could not be downloaded: ' + file.url);
        const body = await response.clone().arrayBuffer();
        if (body.byteLength !== file.bytes || (await hash(body, options.crypto)) !== file.sha256)
          throw Error('Course files changed during download. Refresh the catalog and try again.');
        checkStop();
        await cache.put(file.url, response);
        options.onProgress?.(i + 1, pack.files.length);
      }
      checkStop();
      await cache.put(
        '/offline-manifest.json',
        new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/json' } })
      );
      checkStop();
      // A pack becomes visible only after its last verified file is stored.
      await cache.put(
        MARKER,
        new Response(JSON.stringify({ manifest, packId: id, completedAt: new Date().toISOString() }), {
          headers: { 'Content-Type': 'application/json' },
        })
      );
      checkStop();
      return name;
    } catch (error) {
      await cacheAPI.delete(name);
      throw error;
    }
  }
  async function remove(name, options = {}) {
    if (!cacheNameOK(name)) throw Error('This is not a Cortex course download.');
    if ((options.inUse || []).includes(name))
      throw Error('Close tabs using this downloaded version, then remove it from the online study-data page.');
    return (options.caches || globalThis.caches).delete(name);
  }
  return { PREFIX, MARKER, PENDING, validate, hash, info, verify, list, download, remove, cacheNameOK };
});
