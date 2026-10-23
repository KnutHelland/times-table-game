// Offline support: serve the game from the cache, and refresh the cache in the background so a newly
// published version shows up the next time the game is opened.
const CACHE = 'times-tables-v1';
const FILES = [
  './', 'index.html', 'style.css', 'i18n.js', 'core.js', 'levels.js', 'games.js', 'app.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request, { ignoreSearch: true });
    const refresh = fetch(event.request)
      .then(response => {
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      })
      .catch(() => cached);
    return cached ?? refresh;
  }));
});
