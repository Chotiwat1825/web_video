/* ============================================================
   PlayIDTV — Service Worker (PWA)
   ============================================================
   Cache Strategy:
   - Static shell (HTML, CSS, JS, icons) → Cache First
   - Playlist JSON files                 → Network First (fresh data)
   - Images (thumbnails)                 → Stale-While-Revalidate
   ============================================================ */

const CACHE_VERSION = 'v1.0.29';
const STATIC_CACHE  = `playidtv-static-${CACHE_VERSION}`;
const DATA_CACHE    = `playidtv-data-${CACHE_VERSION}`;
const IMAGE_CACHE   = `playidtv-images-${CACHE_VERSION}`;

// Files to pre-cache on install (app shell)
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css?v=1.0.29',
  './app.js?v=1.0.29',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  './icons/icon-167.png',
  './icons/icon-152.png',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700;800&display=swap',
];

// JSON data files — network first
const DATA_URL_PATTERNS = [
  /playlists_index\.json/,
  /playlists\/.*\.json/,
  /playlists_detailed_summary\.json/,
];

// ── Install: pre-cache static shell ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Pre-cache failed:', err))
  );
});

// ── Activate: remove old caches ──────────────────────────────
self.addEventListener('activate', event => {
  const allowedCaches = [STATIC_CACHE, DATA_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => !allowedCaches.includes(key))
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: routing logic ──────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin streaming URLs (HLS, video streams)
  if (request.method !== 'GET') return;
  if (isStreamingUrl(url)) return;

  // 1. JSON data → Network First
  if (isDataRequest(url)) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // 2. Thumbnail images → Stale-While-Revalidate
  if (isImageRequest(url)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  // 3. App shell (HTML, CSS, JS, fonts, icons) → Cache First
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

// ── Strategy: Cache First ─────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline fallback for navigation requests
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// ── Strategy: Network First ───────────────────────────────────
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ── Strategy: Stale-While-Revalidate ─────────────────────────
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// ── Helpers ───────────────────────────────────────────────────
function isDataRequest(url) {
  return DATA_URL_PATTERNS.some(pattern => pattern.test(url.pathname));
}

function isImageRequest(url) {
  return /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?.*)?$/i.test(url.pathname);
}

function isStreamingUrl(url) {
  // Don't cache HLS streams, embeds, or external video sources
  return /\.(m3u8|ts|mp4|mkv)(\?.*)?$/i.test(url.pathname)
    || url.hostname.includes('streamtape')
    || url.hostname.includes('doodstream')
    || url.hostname.includes('mixdrop')
    || url.hostname.includes('fembed')
    || url.hostname.includes('voe.sx')
    || url.hostname.includes('upstream')
    || url.hostname.includes('hls');
}

// ── Background sync message handler ──────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});
