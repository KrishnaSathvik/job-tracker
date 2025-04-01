// Service Worker for Job Application Tracker
// Version: 1.0.2
const CACHE_NAME = 'job-tracker-cache-v1';
const BASE_PATH = '/job-tracker'; // Base path for GitHub Pages deployment

// List of assets to cache during installation
const urlsToCache = [
  `${BASE_PATH}/`, // Root URL
  `${BASE_PATH}/index.html`,
  'https://cdn.jsdelivr.net/npm/dexie@3.2.2/dist/dexie.min.js', // Dexie from CDN
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
  'https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js',
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/icon-192x192.png`,
  `${BASE_PATH}/icon-512x512.png`
];

// Install event: Cache the essential assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache)
          .catch(error => {
            console.error('Service Worker: Failed to cache some assets:', error);
            return Promise.resolve();
          });
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event: Serve cached assets or fetch from network
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Ignore non-GET requests, requests from different origins, and unsupported schemes
  const supportedSchemes = ['http', 'https'];
  if (
    event.request.method !== 'GET' ||
    requestUrl.origin !== self.location.origin || // Fixed syntax error
    !supportedSchemes.includes(requestUrl.protocol.split(':')[0]) // Ignore unsupported schemes
  ) {
    event.respondWith(fetch(event.request).catch(error => {
      console.error('Service Worker: Fetch failed for unsupported request:', requestUrl.href, error);
      return new Response('Request not supported.', {
        status: 503,
        statusText: 'Service Unavailable'
      });
    }));
    return;
  }

  // Cache-first strategy for static assets
  if (urlsToCache.includes(requestUrl.pathname) || urlsToCache.includes(requestUrl.href)) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            console.log('Service Worker: Serving from cache:', requestUrl.pathname);
            return cachedResponse;
          }
          console.log('Service Worker: Fetching from network:', requestUrl.pathname);
          return fetch(event.request)
            .then(networkResponse => {
              // Cache the new response for future requests
              if (networkResponse && networkResponse.status === 200) {
                return caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                  });
              }
              return networkResponse;
            })
            .catch(error => {
              console.error('Service Worker: Fetch failed:', error);
              return new Response('Offline: Unable to fetch resource.', {
                status: 503,
                statusText: 'Service Unavailable'
              });
            });
        })
    );
  } else {
    // Network-first strategy for dynamic requests (e.g., API calls, if any)
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // Cache the response for future offline use
          if (networkResponse && networkResponse.status === 200) {
            return caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
              });
          }
          return networkResponse;
        })
        .catch(error => {
          console.error('Service Worker: Network fetch failed:', error);
          // Try to serve from cache as a fallback
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                console.log('Service Worker: Serving from cache (fallback):', requestUrl.pathname);
                return cachedResponse;
              }
              return new Response('Offline: Unable to fetch resource.', {
                status: 503,
                statusText: 'Service Unavailable'
              });
            });
        })
    );
  }
});