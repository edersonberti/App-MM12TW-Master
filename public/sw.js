const CACHE_NAME = 'masterlazer-cache-v4';
const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/180x180.png',
  '/192x192.png',
  '/512x512.png',
  '/logo(512 x 512 px).png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use cache.addAll but handle individual failures gracefully so the sw still installs even if an asset is missing
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) => {
          return cache.add(url).catch((err) => {
            console.warn(`[SW] Failed to cache asset: ${url}`, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests and local/same-origin URLs to avoid caching dynamic API/MQTT routes or external APIs
  if (event.request.method !== 'GET') return;
  
  // Always go network-only for HTML documents (navigation requests) to avoid stale chunk errors
  if (event.request.mode === 'navigate') return;
  
  const url = new URL(event.request.url);
  
  // Do not intercept hot module replacement, dev-server websockets, or external APIs (except for images if needed)
  if (
    url.pathname === '/' ||
    url.pathname.startsWith('/_next') || 
    url.pathname.startsWith('/api') || 
    url.hostname.includes('hivemq') ||
    (url.hostname.includes('localhost') && url.port !== '3000')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return from cache, and optionally update in the background (stale-while-revalidate)
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Ignore background refresh errors
          });
        return cachedResponse;
      }

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Cache newly requested local GET resources dynamically
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // Fallback if offline
          console.log('[SW] Fetch failed, device might be offline.');
        });
    })
  );
});
