// ProtoMusic Service Worker v2 — Optimized caching strategy
const CACHE_NAME = 'protomusic-v2.0.0';

// App shell — cached at install time (Cache-First)
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/styles/main.css',
    '/styles/kalandar.css',
    '/js/api.js',
    '/js/app.js',
    '/js/player.js',
    '/js/color-extractor.js',
    '/js/image-retry.js',
    '/js/discord-helper.js',
    '/js/settings.js',
    '/js/swipe.js',
    '/manifest.json'
];

// Install event — pre-cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_TO_CACHE))
            .catch(err => console.error('[SW] Cache failed:', err))
    );
    self.skipWaiting();
});

// Activate event — clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(cacheNames =>
            Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            )
        )
    );
    self.clients.claim();
});

// Fetch event — smart caching per resource type
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // --- API calls: always fetch fresh, no caching ---
    if (url.hostname === 'v2.protogen.fr' &&
        (url.pathname.startsWith('/api/') || url.pathname.startsWith('/webapi/media/stream'))) {
        return; // let the browser handle it (no respondWith = network passthrough)
    }

    // --- Thumbnails: Stale-While-Revalidate (fast but keeps fresh) ---
    if (url.hostname === 'v2.protogen.fr' && url.pathname.startsWith('/webapi/media/thumb')) {
        event.respondWith(staleWhileRevalidate(event.request));
        return;
    }

    // --- Google Fonts / CDN: Cache-First (very stable resources) ---
    if (url.hostname === 'fonts.gstatic.com' ||
        url.hostname === 'fonts.googleapis.com' ||
        url.hostname === 'cdn.jsdelivr.net') {
        event.respondWith(cacheFirst(event.request, true));
        return;
    }

    // --- App shell & local assets: Cache-First ---
    if (url.origin === self.location.origin) {
        event.respondWith(cacheFirst(event.request, false));
        return;
    }
});

// Cache-First strategy
async function cacheFirst(request, longLived) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        // Offline fallback for HTML pages
        if (request.destination === 'document') {
            return caches.match('/index.html');
        }
        return new Response('', { status: 503 });
    }
}

// Stale-While-Revalidate strategy
async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    // Always kick off a background revalidation
    const networkFetch = fetch(request).then(response => {
        if (response.ok) cache.put(request, response.clone());
        return response;
    }).catch(() => null);

    // Return cached immediately if available, otherwise wait for network
    return cached || networkFetch;
}
