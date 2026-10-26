// Offline support: serve the game from the cache. When the page asks (at start and when the app comes back
// to the foreground), download the files again and tell the page if the content of any of them changed, so it can
// offer to reload.
const CACHE = 'times-tables-v6';
const LANGUAGES = ['en', 'no', 'nn', 'sv', 'da', 'de', 'fr', 'es'];
const FLAGS = ['gb', 'no', 'se', 'dk', 'de', 'fr', 'es'];
const AVATARS = ['fox', 'cat', 'dog', 'panda', 'lion', 'unicorn', 'frog', 'owl',
  'tiger', 'koala', 'rabbit', 'bear', 'penguin', 'monkey', 'octopus', 'dragon'];
const FILES = [
  './', 'index.html', 'style.css', 'i18n.js', 'core.js', 'levels.js', 'games.js', 'savecode.js', 'profiles.js', 'app.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  ...LANGUAGES.map(lang => `lang/${lang}.js`),
  ...FLAGS.map(flag => `flags/${flag}.svg`),
  ...AVATARS.map(avatar => `avatars/${avatar}.svg`),
];

// GitHub Pages lets browsers cache files for 10 minutes; 'no-cache' asks the server every time (cheap, via ETag)
const fetchFresh = file => fetch(file, { cache: 'no-cache' });

// GitHub Pages' ETags contain the time each file was deployed, so every push changes them for all files, and
// copies of the same deploy on different servers can differ by a second. Only the content tells a real update.
async function sameContent(a, b) {
  const [x, y] = await Promise.all([a.clone().arrayBuffer(), b.clone().arrayBuffer()]);
  if (x.byteLength !== y.byteLength) return false;
  const bytesX = new Uint8Array(x);
  const bytesY = new Uint8Array(y);
  return bytesX.every((byte, i) => byte === bytesY[i]);
}

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
    if (cached && await sameContent(cached, fresh)) return;
    if (cached) changed = true;
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
