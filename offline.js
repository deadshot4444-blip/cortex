window.CortexOffline = (() => {
  let registration,
    job = null,
    activeHost = null,
    renderRequest = 0;
  const selected = () => new URLSearchParams(location.search).get('offline');
  const bytes = n => (n / 1024 / 1024).toFixed(1) + ' MB';
  const available = () =>
    window.isSecureContext && 'serviceWorker' in navigator && 'caches' in window && !!window.crypto?.subtle;
  async function register() {
    if (!available())
      throw Error(
        'Offline downloads require HTTPS or localhost and a browser that allows service workers and course storage.'
      );
    registration ||= await navigator.serviceWorker.getRegistration('/');
    if (registration?.active && new URL(registration.active.scriptURL).pathname !== '/offline-worker.js')
      throw Error('This site has a different offline controller. Its existing downloads have not been replaced.');
    registration ||= await navigator.serviceWorker.register('/offline-worker.js?v=1', {
      scope: '/',
      updateViaCache: 'none',
    });
    if (registration.active) return registration;
    const worker = registration.installing || registration.waiting;
    if (!worker) throw Error('Offline support did not finish installing. Reload and try again.');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.removeEventListener('statechange', change);
        reject(Error('Offline support is waiting. Close other Cortex tabs and reload.'));
      }, 10000);
      function change() {
        if (worker.state === 'activated' || worker.state === 'redundant') {
          clearTimeout(timeout);
          worker.removeEventListener('statechange', change);
          worker.state === 'activated' ? resolve() : reject(Error('Offline support could not install.'));
        }
      }
      worker.addEventListener('statechange', change);
      change();
    });
    return registration;
  }
  function openURL(pack, name) {
    const url = new URL(pack.entry, location.origin);
    url.searchParams.set('offline', name);
    const gates = new URLSearchParams(location.search).get('gates');
    if (gates) url.searchParams.set('gates', gates);
    return url.pathname + url.search;
  }
  async function message(data) {
    const reg = await register(),
      channel = new MessageChannel();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        channel.port1.close();
        reject(Error('The offline request could not be confirmed. Refresh the download list.'));
      }, 10000);
      channel.port1.onmessage = event => {
        clearTimeout(timeout);
        channel.port1.close();
        event.data.error ? reject(Error(event.data.error)) : resolve(event.data);
      };
      reg.active.postMessage(data, [channel.port2]);
    });
  }
  const remove = (name, expectedIncomplete = false) => message({ type: 'REMOVE_COURSE', name, expectedIncomplete });
  async function render(host) {
    activeHost = host;
    const request = ++renderRequest;
    host.innerHTML = '<p>Checking downloaded files…</p>';
    if (!available()) {
      host.textContent =
        'This browser cannot keep verified offline downloads. Online study and saved-work backups remain available.';
      return;
    }
    try {
      let manifest = null,
        catalogError = '';
      try {
        const response = await fetch('/offline-manifest.json', { cache: 'no-store' });
        if (!response.ok) throw Error();
        manifest = CortexOfflineCore.validate(await response.json());
      } catch {
        catalogError = 'The current download catalog could not load. Previously downloaded courses are listed below.';
      }
      const saved = await CortexOfflineCore.list({ verify: true });
      const incomplete = (await caches.keys()).filter(
        name => CortexOfflineCore.cacheNameOK(name) && !saved.some(item => item.name === name)
      );
      if (!host.isConnected || request !== renderRequest) return;
      host.innerHTML = `<p>Downloads contain public course material only. Your progress continues saving in the active workspace. External sources, sign-in, cloud sync and Python packages need a connection. A browser may remove downloads under storage pressure; check this list before relying on them.</p>
        <p id="offline-space"></p><button class="btn" id="offline-persist">Ask browser to retain site storage</button>
        <p id="offline-status" role="status"></p><div id="offline-catalog"></div><h3>On this device</h3><div id="offline-saved"></div>`;
      const status = message => {
        if (host.isConnected) host.querySelector('#offline-status').textContent = message;
      };
      if (catalogError) status(catalogError);
      if (job) status('A course is downloading. Return here after it finishes, or stop it below.');
      navigator.storage
        ?.estimate?.()
        .then(e => {
          if (host.isConnected)
            host.querySelector('#offline-space').textContent =
              'Estimated storage used by this site: ' +
              bytes(e.usage || 0) +
              (e.quota ? ' · available quota ' + bytes(e.quota) : '') +
              '. This includes more than downloaded courses.';
        })
        .catch(() => {});
      host.querySelector('#offline-persist').onclick = async () => {
        try {
          status(
            (await navigator.storage?.persist?.())
              ? 'The browser granted persistent site storage. Keep a separate study backup as well.'
              : 'Persistent storage was not granted. Downloads and saved work may still be removed by browser settings or storage pressure.'
          );
        } catch {
          status('The browser could not confirm persistent storage.');
        }
      };
      const controls = [],
        catalog = host.querySelector('#offline-catalog');
      const stop = document.createElement('button');
      stop.className = 'btn';
      stop.textContent = 'Stop download';
      stop.hidden = !job;
      stop.onclick = () => job?.abort();
      catalog.appendChild(stop);
      for (const pack of manifest?.packs || []) {
        const card = document.createElement('article');
        card.className = 'offline-course';
        const title = document.createElement('h3');
        title.textContent = pack.title;
        const scope = document.createElement('p');
        scope.textContent = pack.scope + ' · ' + bytes(pack.files.reduce((n, f) => n + f.bytes, 0));
        const button = document.createElement('button');
        button.className = 'btn';
        button.textContent = 'Download course';
        button.disabled = !!job || !!selected();
        controls.push(button);
        card.append(title, scope, button);
        catalog.appendChild(card);
        button.onclick = async () => {
          if (job) return;
          const controller = new AbortController();
          job = controller;
          stop.hidden = false;
          controls.forEach(b => {
            b.disabled = true;
          });
          status('Preparing offline support…');
          try {
            const { clientId } = await message({ type: 'DOWNLOAD_CLIENT' });
            await CortexOfflineCore.download(manifest, pack.id, {
              clientId,
              signal: controller.signal,
              onProgress: (done, total) =>
                status('Downloading ' + pack.title + ': ' + done + ' of ' + total + ' files verified.'),
            });
            status('Download finished. Refresh the list below to open this course.');
          } catch (error) {
            status(
              error.name === 'AbortError'
                ? 'Download stopped. Any previous complete download remains available.'
                : error.message + ' No incomplete download was activated.'
            );
          } finally {
            job = null;
            stop.hidden = true;
            controls.forEach(b => {
              b.disabled = false;
            });
            if (host.isConnected) {
              const refresh = document.createElement('button');
              refresh.className = 'btn';
              refresh.textContent = 'Refresh download list';
              refresh.onclick = () => render(host);
              host.querySelector('#offline-saved').prepend(refresh);
            } else if (activeHost?.isConnected) render(activeHost);
          }
        };
      }
      if (selected()) {
        const p = document.createElement('p');
        p.textContent =
          'You are using a downloaded version. Open the online version before downloading new or updated courses.';
        catalog.prepend(p);
      }
      const list = host.querySelector('#offline-saved');
      if (!saved.length) list.textContent = 'No complete courses downloaded yet.';
      for (const item of saved) {
        const card = document.createElement('article');
        card.className = 'offline-course';
        const p = document.createElement('p');
        p.textContent =
          item.pack.title +
          ' · ' +
          (item.available ? 'all files verified' : 'files missing or changed; download again') +
          ' · saved ' +
          new Date(item.completedAt).toLocaleString();
        const link = document.createElement('a');
        link.className = 'btn';
        link.textContent = 'Open downloaded course';
        link.href = openURL(item.pack, item.name);
        if (!item.available) link.removeAttribute('href');
        const del = document.createElement('button');
        del.className = 'btn';
        del.textContent = 'Remove downloaded files';
        del.onclick = async () => {
          del.disabled = true;
          try {
            await remove(item.name);
            await render(host);
          } catch (error) {
            status(error.message);
            del.disabled = false;
          }
        };
        card.append(p, link, del);
        list.appendChild(card);
      }
      for (const name of incomplete) {
        const card = document.createElement('article');
        card.className = 'offline-course';
        const p = document.createElement('p');
        p.textContent = 'Incomplete course download. These files are not available for offline study.';
        const del = document.createElement('button');
        del.className = 'btn';
        del.textContent = 'Discard incomplete download';
        del.disabled = !!job;
        del.onclick = async () => {
          del.disabled = true;
          try {
            await remove(name, true);
            await render(host);
          } catch (error) {
            status(error.message);
            del.disabled = false;
          }
        };
        card.append(p, del);
        list.appendChild(card);
      }
    } catch (error) {
      if (host.isConnected && request === renderRequest)
        host.textContent =
          'Download storage could not be read: ' + error.message + ' Your study progress has not been removed.';
    }
  }
  function banner() {
    if (!selected() || document.getElementById('offline-banner')) return;
    const node = document.createElement('aside');
    node.id = 'offline-banner';
    node.className = 'offline-banner';
    node.setAttribute('aria-label', 'Downloaded version');
    const label = document.createElement('span');
    label.textContent = 'Using a downloaded course version. External links, Python and account sync need a connection.';
    const link = document.createElement('a'),
      url = new URL(location.href);
    url.searchParams.delete('offline');
    link.href = url.pathname + url.search;
    link.textContent = 'Open online version';
    node.append(label, link);
    document.body.prepend(node);
  }
  async function canOpen(path) {
    if (!selected()) return true;
    const item = await CortexOfflineCore.info(selected());
    return !!item && ['/', '/academy', ...item.pack.routes].includes(path);
  }
  function unavailable() {
    const root = el('<div></div>');
    root.appendChild(topbar('academy'));
    const online = new URL(location.href);
    online.searchParams.delete('offline');
    const manage = new URL(sectionUrl('academy'), location.origin);
    manage.searchParams.set('view', 'storage');
    root.appendChild(
      el(
        `<main class="panel section-load-error"><span class="label">Downloaded version</span><h1>This path is outside your download.</h1><p>Your saved work is still on this device. Open another downloaded course from study data, or reconnect and use the online version.</p><div class="academy-lesson-nav"><a class="btn" href="${esc(manage.pathname + manage.search)}">Manage downloaded courses</a><a class="btn" href="${esc(online.pathname + online.search)}">Open online version</a></div></main>`
      )
    );
    setView(root);
  }
  window.addEventListener('pagehide', () => job?.abort());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', banner);
  else banner();
  return { render, selected, canOpen, unavailable };
})();
