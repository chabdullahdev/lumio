/* LUMIO service worker: makes the app open instantly and survive a bad connection.
 * It only ever stores LUMIO's own files. Lessons, accounts and everything else
 * from the database are never cached here, so nothing private is kept on disk. */
const CACHE = 'lumio-shell-v1';
const SHELL = ['/app/', '/app/logo.svg', '/app/manifest.webmanifest', '/app/icon-192.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith('/app/')) return;

  // Pages: always try the network first so updates arrive; fall back to the saved shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('/app/', copy));
          return response;
        })
        .catch(() => caches.match('/app/').then(hit => hit || Response.error())),
    );
    return;
  }

  // Built files have a hash in their name, so a saved copy is always correct.
  event.respondWith(
    caches.match(request).then(
      hit =>
        hit ||
        fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
