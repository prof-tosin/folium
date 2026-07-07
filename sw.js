// ============================================================================
// FOLIUM — Service worker
// Caches the static app shell. Firestore/Auth requests always go to network
// (they have their own offline handling via Firestore persistence).
// ============================================================================
const CACHE_NAME = 'folium-shell-v1';
const APP_SHELL = [
  '/', '/index.html', '/auth.html', '/write.html', '/post.html', '/profile.html', '/explore.html',
  '/css/style.css',
  '/js/utils.js', '/js/firebase-config.js', '/js/app.js', '/js/auth.js', '/js/editor.js', '/js/post.js', '/js/profile.js', '/js/explore.js',
  '/manifest.json',
  '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept Firebase/Firestore/Auth/Google API calls or non-GET requests
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
