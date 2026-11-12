const CACHE = 'fleet-shell-v6';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const keys = await caches.keys();
    for (const key of keys) {
      if (key === CACHE) continue;
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
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === '/sw.js' || url.pathname === '/online.txt') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
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
