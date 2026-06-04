/**
 * Service Worker — Ngawiti 2
 * Offline-first strategy: Cache assets, serve from cache, update in background
 * Target: <500ms load time even on 2G / offline
 */

const CACHE_VERSION = 'ngawiti-v2.1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/detail.html',
  '/viewer.html',
  '/data.json',
  '/style.css',
  '/offline-cache.js',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;700&display=swap',
];

// Cache strategy: Network-first for dynamic data, Cache-first for static + media
const CACHE_PATTERNS = {
  // Static: cache-first (serve from cache, update in background)
  static: [
    /\.(js|css|woff2?)$/,
    /fonts\.googleapis/,
    /cdnjs\.cloudflare/,
  ],
  
  // JSON data: network-first (try network, fallback to cache)
  data: [/data\.json/],
  
  // Images & media: cache-first with long expiry
  media: [/\.(jpg|jpeg|png|gif|webp|mp4|webm|ogg|mp3|wav)$/i],
};

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      console.log('[SW] Caching static assets:', STATIC_ASSETS.length);
      return cache.addAll(STATIC_ASSETS.filter(url => !url.includes('http') || url.includes('fonts')))
        .catch(err => console.warn('[SW] Some assets failed to cache:', err.message));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter(name => name !== CACHE_VERSION && name.startsWith('ngawiti-'))
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET or cross-origin (except fonts/cdn)
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin && !isCrossOriginAllowed(url)) return;

  // Determine caching strategy
  if (matchesPatterns(url, CACHE_PATTERNS.data)) {
    // JSON: network-first (always try to update data)
    return event.respondWith(networkFirstStrategy(request));
  }
  
  if (matchesPatterns(url, CACHE_PATTERNS.media)) {
    // Images/media: cache-first (serve from cache, update in background)
    return event.respondWith(cacheFirstStrategy(request));
  }
  
  // Default: cache-first for static, network-first for everything else
  return event.respondWith(cacheFirstStrategy(request, true));
});

/**
 * Cache-first: Serve from cache, fallback to network, cache result
 */
async function cacheFirstStrategy(request, updateInBackground = false) {
  try {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    
    if (cached) {
      // Update in background if enabled
      if (updateInBackground) {
        fetch(request)
          .then(res => {
            if (res.ok && res.status === 200) {
              const clone = res.clone();
              cache.put(request, clone);
            }
          })
          .catch(() => {/* offline, ignore */});
      }
      return cached;
    }
    
    // Not in cache, fetch from network
    const response = await fetch(request);
    if (response.ok && response.status === 200) {
      const clone = response.clone();
      cache.put(request, clone);
    }
    return response;
  } catch (error) {
    console.warn('[SW] Cache-first failed:', request.url, error.message);
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network-first: Try network, fallback to cache
 */
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.status === 200) {
      const cache = await caches.open(CACHE_VERSION);
      const clone = response.clone();
      cache.put(request, clone);
    }
    return response;
  } catch (error) {
    console.warn('[SW] Network failed, using cache:', request.url);
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

function matchesPatterns(url, patterns) {
  return patterns.some(pattern => pattern.test(url.pathname));
}

function isCrossOriginAllowed(url) {
  const allowedOrigins = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdnjs.cloudflare.com',
    'cdn.tailwindcss.com',
    'apis.google.com'
  ];
  return allowedOrigins.some(origin => url.hostname.includes(origin));
}

// Background sync untuk pre-cache data
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(
      fetch('/data.json')
        .then(res => {
          if (res.ok) {
            const cache = caches.open(CACHE_VERSION);
            return cache.then(c => c.put('/data.json', res.clone()));
          }
        })
        .catch(() => console.warn('[SW] Background sync failed'))
    );
  }
});