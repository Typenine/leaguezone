const CACHE_VERSION = 'leaguezone-pwa-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = '/offline';
const DATA_CACHE = `${CACHE_VERSION}-research-data`;
const RESEARCH_SHELL = '/research/index.html';
const PRECACHE_URLS = [OFFLINE_URL, '/manifest.webmanifest', '/pwa/icon-192.png', RESEARCH_SHELL, '/research/styles.css', '/research/app.js', '/research/metrics.js', '/research/opportunities.js', '/research/tools.js', '/research/pwa.js', '/research/app-shell.js', '/research/app-shell.css'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('leaguezone-pwa-') && key !== STATIC_CACHE && key !== DATA_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/pwa/') ||
      /\.(?:css|js|woff2?|png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url.pathname))
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        if (url.pathname === '/research' || url.pathname.startsWith('/research/')) {
          return (await cache.match(RESEARCH_SHELL)) || (await cache.match(OFFLINE_URL)) || Response.error();
        }
        return (await cache.match(OFFLINE_URL)) || Response.error();
      }),
    );
    return;
  }

  if (url.pathname.startsWith('/research/data/') && url.pathname.endsWith('.json')) {
    event.respondWith((async () => {
      const cache = await caches.open(DATA_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic' && !/no-store|private/i.test(response.headers.get('cache-control') || '')) {
          await cache.put(request, response.clone());
          const keys = await cache.keys();
          await Promise.all(keys.slice(0, Math.max(0, keys.length - 25)).map(key => cache.delete(key)));
        }
        return response;
      } catch { return (await cache.match(request)) || Response.error(); }
    })());
    return;
  }
  if (!isCacheableStaticAsset(url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      const load = async () => {
        const response = await fetch(request);
        const cacheControl = response.headers.get('cache-control') || '';
        if (response.ok && response.type === 'basic' && !cacheControl.includes('no-store')) {
          await cache.put(request, response.clone());
        }
        return response;
      };

      // Research CSS and JS evolve while public data refreshes. Prefer current
      // code when online, with cached assets as a network-failure fallback.
      if (url.pathname.startsWith('/research/')) {
        try { return await load(); } catch { return cached || Response.error(); }
      }
      if (cached) return cached;
      try { return await load(); } catch { return Response.error(); }
    })(),
  );
});
