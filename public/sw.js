const CACHE = 'fleet-shell-v17';
const PHOTO_CACHE = 'fleet-photos-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const keys = await caches.keys();
    for (const key of keys) {
      if (key === CACHE || key === PHOTO_CACHE) continue;
      const older = await caches.open(key);
      const requests = await older.keys();
      for (const request of requests) {
        if (await cache.match(request)) continue;
        const response = await older.match(request);
        if (response) await cache.put(request, response);
      }
      await caches.delete(key);
    }
    await self.clients.claim();
    await caches.delete(PHOTO_CACHE);
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.includes('/media/captures/') || url.pathname.includes('/media/rentals/') || url.pathname.includes('/media/maintenance/')) return;
  if (request.destination === 'image' && url.origin !== self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(PHOTO_CACHE);
      const cached = await cache.match(request);
      try {
        const response = await fetch(request);
        if (response && (response.ok || response.type === 'opaque')) void cache.put(request, response.clone());
        return response;
      } catch {
        if (cached) return cached;
        throw new Error('offline');
      }
    })());
    return;
  }
  if (url.origin !== self.location.origin || url.pathname === '/sw.js' || url.pathname === '/online.txt') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request, request.mode === 'navigate' ? { cache: 'no-store' } : undefined);
      if (response && response.ok) void cache.put(request, response.clone());
      return response;
    } catch {
      const cached =
        (await cache.match(request)) ||
        (await cache.match(request, { ignoreSearch: true })) ||
        (request.mode === 'navigate' ? (await cache.match('/index.html')) || (await cache.match('/')) : undefined);
      if (cached) return cached;
      return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});
