/*
 * Offline app-shell service worker for the web/PWA build (REQ-023, ADR-0004).
 * Cache-first for static assets, network-first for navigations with an offline
 * fallback to the cached shell — so the app opens and runs without a network once
 * it has been visited. The app's own data is already offline (local SQLite); this
 * only makes the shell itself available offline. Plain JS: it runs in the
 * ServiceWorker scope, outside the app bundle and the type/lint gate.
 */
const CACHE = 'mydevtime-shell-v1'
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg']

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  // Navigations: try the network, fall back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('./index.html').then(cached => cached || caches.match('./')),
      ),
    )
    return
  }

  // Static assets (the hashed JS bundle, fonts, …): cache-first, then network,
  // caching whatever the network returns so the next load works offline.
  event.respondWith(
    caches.match(request).then(
      cached =>
        cached ||
        fetch(request).then(response => {
          const copy = response.clone()
          void caches.open(CACHE).then(cache => cache.put(request, copy))
          return response
        }),
    ),
  )
})
