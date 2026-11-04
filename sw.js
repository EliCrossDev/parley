/* Parley service worker — caches the app shell so it opens instantly and works as an installed app.
   Translation requests always go to the network. */
const CACHE = 'parley-v67';
const SHELL = ['index.html', 'app.html', 'styles.css', 'landing.css', 'app.css', 'app.js', 'landing.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'aurora.js', 'i18n.js', 'ear.js', 'reel.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return; // APIs, fonts, CDN: network only
  // Network first (so a deploy shows up on the next load), cache as the offline fallback.
  e.respondWith(
    fetch(e.request).then((res) => { if (res && res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone())); return res; })
      .catch(() => caches.match(e.request))
  );
});
