/*
 * FloraFind service worker.
 *
 * Hand-written (no build-time generation) so it stays readable and predictable:
 *  - App shell (index.html) uses network-first with an offline cache fallback, so
 *    a fresh deploy is picked up immediately but the app still opens offline.
 *  - Vite's hashed /assets/* files are immutable, so they're cached-first.
 *  - Fonts (Google Fonts) are cached stale-while-revalidate.
 *  - /api/* and /uploads/* are never cached here — live data must hit the network.
 *
 * Bump CACHE_VERSION to invalidate old caches on the next activation.
 */
const CACHE_VERSION = 'v1'
const SHELL_CACHE = `florafind-shell-${CACHE_VERSION}`
const ASSET_CACHE = `florafind-assets-${CACHE_VERSION}`
const FONT_CACHE = `florafind-fonts-${CACHE_VERSION}`

// Minimal precache: the shell + icons so the very first offline load has something.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/pwa-192.png',
  '/pwa-512.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, ASSET_CACHE, FONT_CACHE])
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

// Let the page trigger an immediate update (used by the "refresh" toast).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

function isFontRequest(url) {
  return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response && response.ok) cache.put(request, response.clone())
    return response
  } catch (err) {
    const cached = await cache.match(request)
    if (cached) return cached
    // Navigation fallback: serve the cached app shell so the SPA can boot offline.
    const shell = await caches.match('/index.html')
    if (shell) return shell
    throw err
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone())
  return response
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone())
      return response
    })
    .catch(() => cached)
  return cached || network
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Never intercept live data or uploaded media.
  if (url.origin === self.location.origin && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/'))) {
    return
  }

  // Google Fonts.
  if (isFontRequest(url)) {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE))
    return
  }

  // Only same-origin beyond this point; leave map tiles and other cross-origin
  // requests to the browser's default handling.
  if (url.origin !== self.location.origin) return

  // SPA navigations: network-first with offline shell fallback.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE))
    return
  }

  // Immutable hashed build assets.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE))
    return
  }

  // Other same-origin static files (icons, manifest, etc.).
  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE))
})
