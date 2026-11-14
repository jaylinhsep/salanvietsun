const CACHE_NAME = 'vietsun-tms-pwa-v2';
const URLS_TO_CACHE = ['/mobile', '/mobile/fuel', '/mobile/maintenance', '/mobile/profile'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE)).catch(() => null),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Only handle /mobile routes for PWA offline fallback; never intercept frontweb routes
  if (!url.pathname.startsWith('/mobile')) return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)),
  );
});
