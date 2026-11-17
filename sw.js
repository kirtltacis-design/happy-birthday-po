/* ============================================================================
   HAPPY BIRTHDAY PO! — Service Worker (offline-first)
   Precaches the app shell + content catalog; content FILES (messages,
   pictures, videos) are cached on first fetch (cache-first with network
   fill) so offline repeats work and huge videos are never force-precached.
   Bump CACHE_VERSION whenever any packaged file changes.
   ========================================================================== */

var CACHE_VERSION = 'saging-v19';
var PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/app.js',
  'js/content-parser.js',
  'js/surprise-picker.js',
  'content/catalog.json',
  'content/messages/Random Messages.txt',
  'assets/img/kamote.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon-32.png',
  'assets/icons/favicon-16.png',
  'assets/fonts/press-start-2p.ttf',
  'assets/fonts/nunito-400.ttf',
  'assets/fonts/nunito-800.ttf'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      // Force fresh 200s so a 304 (empty body) never poisons the install.
      return cache.addAll(PRECACHE.map(function (url) {
        return new Request(url, { cache: 'reload' });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      var KEEP = { 'saging-media-v1': true };
      return Promise.all(keys.map(function (key) {
        if (key === CACHE_VERSION || KEEP[key]) return undefined;
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;

  // Only GET requests are cacheable; let everything else pass through.
  if (request.method !== 'GET') return;

  var url = new URL(request.url);

  // Only handle same-origin requests (no external dependencies exist anyway).
  if (url.origin !== self.location.origin) return;

  // The catalog index decides what content exists — it must be FRESH online
  // and cached offline. Content files themselves are cache-first.
  if (/\/content\/catalog\.json$/i.test(url.pathname)) {
    event.respondWith(
      fetch(request).then(function (response) {
        if (!response || !response.ok) throw new Error('catalog fetch failed: ' + (response && response.status));
        var copy = response.clone();
        caches.open(CACHE_VERSION).then(function (cache) { cache.put('content/catalog.json', copy); });
        return response;
      }).catch(function () {
        return caches.match('content/catalog.json').then(function (cached) {
          return cached || caches.match('./'); // extremely unlikely; app handles empty state
        });
      })
    );
    return;
  }

  // Content files (messages, pictures, videos): serve from ANY cache (the app
  // stores media on first launch); network fallback otherwise. No auto-caching —
  // media caching is owned by the app's first-launch preparation flow.
  if (url.pathname.indexOf('/content/') !== -1) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then(function (cached) {
        if (cached) return cached;
        return fetch(request);
      })
    );
    return;
  }

  // Navigations: network-first with cache fallback (fresh HTML when online,
  // instant offline start when not).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(function (response) {
        // A proxy/gateway can answer with an error page (e.g. 502/504) while
        // the origin server is unreachable. Never treat that as success.
        if (!response || !response.ok) throw new Error('navigation failed: ' + (response && response.status));
        var copy = response.clone();
        caches.open(CACHE_VERSION).then(function (cache) { cache.put('index.html', copy); });
        return response;
      }).catch(function () {
        return caches.match('index.html').then(function (cached) {
          return cached || caches.match('./');
        });
      })
    );
    return;
  }

  // Static assets: cache-first, falling back to network (and caching it).
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response && response.ok && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      });
    })
  );
});
