/* Pin an offline page to one complete course version. Never mix cached builds. */
importScripts('/offline-core.js?v=1');
const Offline = self.CortexOfflineCore;
function unavailable() {
  return new Response(
    '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Download unavailable | Cortex</title><main><h1>This course is not available offline.</h1><p>The download may be missing or this route is outside its scope. Saved study work has not been removed.</p><p>Reconnect, then <a href="/academy?view=storage">open study backups and downloads</a>.</p></main></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );
}
async function downloaded(request, name) {
  const item = await Offline.info(name);
  if (!item)
    return request.mode === 'navigate' ? unavailable() : new Response('Offline download missing', { status: 503 });
  const url = new URL(request.url),
    cache = await caches.open(name);
  if (request.mode === 'navigate') {
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '');
      return Response.redirect(url.href, 307);
    }
    if (!['/', '/academy', ...item.pack.routes].includes(url.pathname.replace(/\/$/, '') || '/')) return unavailable();
    if (!(await Offline.verify(item))) return unavailable();
    return (await cache.match('/index.html')) || unavailable();
  }
  // The page contains its own pinned script versions. Data query parameters are
  // normalized only inside this complete, explicit downloaded version.
  if (!item.pack.files.some(f => f.url === url.pathname) && url.pathname !== '/offline-manifest.json')
    return new Response('This file is not in the downloaded course.', { status: 503 });
  return (
    (await cache.match(url.pathname)) ||
    new Response('A downloaded file is missing. Reconnect and download again.', { status: 503 })
  );
}
async function navigate(request) {
  const url = new URL(request.url),
    selected = url.searchParams.get('offline');
  if (selected) return downloaded(request, selected);
  try {
    return await fetch(request);
  } catch {
    const route = url.pathname.replace(/\/$/, '') || '/';
    const packs = await Offline.list();
    for (const item of packs) {
      if (!['/', '/academy', ...item.pack.routes].includes(route) || !(await Offline.verify(item))) continue;
      // A real navigation gives the offline document its own persistent URL;
      // worker restarts and subsequent page assets resolve the same version.
      url.searchParams.set('offline', item.name);
      return Response.redirect(url.href, 307);
    }
    return unavailable();
  }
}
self.addEventListener('fetch', event => {
  const request = event.request,
    url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(navigate(request));
    return;
  }
  // Account traffic is cross-origin and is never intercepted or cached. Public
  // counters and non-course endpoints also retain their ordinary network path.
  if (!/\.(?:js|css|json|svg|png|jpg|woff2)$/.test(url.pathname)) return;
  event.respondWith(
    (async () => {
      const client = event.clientId ? await clients.get(event.clientId) : null;
      const selected = client && new URL(client.url).searchParams.get('offline');
      return selected ? downloaded(request, selected) : fetch(request);
    })()
  );
});
self.addEventListener('message', event => {
  if (event.data?.type === 'DOWNLOAD_CLIENT' && event.ports[0]) {
    event.ports[0].postMessage(
      event.source?.id
        ? { clientId: event.source.id }
        : { error: 'The download tab could not be identified. Reload and try again.' }
    );
    return;
  }
  if (event.data?.type !== 'REMOVE_COURSE' || !event.ports[0]) return;
  event.waitUntil(
    (async () => {
      try {
        const tabs = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        const inUse = tabs.map(tab => new URL(tab.url).searchParams.get('offline')).filter(Boolean);
        const complete = await Offline.info(event.data.name);
        if (event.data.expectedIncomplete && complete)
          throw Error('This download finished after the list was opened. Refresh the list before removing it.');
        if (Offline.cacheNameOK(event.data.name) && (await caches.keys()).includes(event.data.name) && !complete) {
          const pending = await (await caches.open(event.data.name)).match(Offline.PENDING);
          const owner = pending && (await pending.json()).clientId;
          if (owner && tabs.some(tab => tab.id === owner))
            throw Error(
              'Another open tab owns this unfinished download. Stop it there, or close that tab before discarding the files.'
            );
        }
        await Offline.remove(event.data.name, { inUse });
        event.ports[0].postMessage({ ok: true });
      } catch (error) {
        event.ports[0].postMessage({ error: error.message });
      }
    })()
  );
});
// No skipWaiting, client takeover or automatic deletion of older downloads.
