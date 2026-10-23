// Offline support: serve the game from the cache. When the page asks (at start and when the app comes back
// to the foreground), download the files again and tell the page if any of them changed, so it can offer to reload.
const CACHE = 'times-tables-v3';
const AVATARS = ['fox', 'cat', 'dog', 'panda', 'lion', 'unicorn', 'frog', 'owl',
  'tiger', 'koala', 'rabbit', 'bear', 'penguin', 'monkey', 'octopus', 'dragon'];
const FILES = [
  './', 'index.html', 'style.css', 'i18n.js', 'core.js', 'levels.js', 'games.js', 'profiles.js', 'app.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  ...AVATARS.map(avatar => `avatars/${avatar}.svg`),
];

// GitHub Pages lets browsers cache files for 10 minutes; 'no-cache' asks the server every time (cheap, via ETag)
const fetchFresh = file => fetch(file, { cache: 'no-cache' });

const version = response => response.headers.get('etag') ?? response.headers.get('last-modified');

// Served files keep the server's 'max-age', which lets the browser reuse old scripts from memory on a reload
// without asking this worker, so the reload after an update would still show the old version.
async function withoutBrowserCaching(response) {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-cache');
  return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE)
    .then(cache => Promise.all(FILES.map(async file => {
      const response = await fetchFresh(file);
      if (!response.ok) throw new Error(`${file}: ${response.status}`);
      await cache.put(file, await withoutBrowserCaching(response));
    })))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then(cached => cached ?? fetch(event.request)));
});

async function checkForUpdate() {
  const cache = await caches.open(CACHE);
  let changed = false;
  await Promise.all(FILES.map(async file => {
    const fresh = await fetchFresh(file).catch(() => null); // offline: keep what we have
    if (!fresh?.ok) return;
    const cached = await cache.match(file);
    if (cached && version(cached) !== version(fresh)) changed = true;
    await cache.put(file, await withoutBrowserCaching(fresh));
  }));
  // a newer worker took over during the check and already deleted this cache; the puts above made it again
  if (self.serviceWorker?.state === 'redundant') return caches.delete(CACHE);
  if (!changed) return;
  for (const client of await self.clients.matchAll({ type: 'window' })) client.postMessage('updated');
}

self.addEventListener('message', event => {
  if (event.data === 'checkForUpdate') event.waitUntil(checkForUpdate());
});
