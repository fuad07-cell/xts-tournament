// Minimal service worker — enough to satisfy PWA "reliability" checks and
// give a basic offline fallback for already-visited pages. Not a full
// offline-first cache strategy (this app is live-data heavy via Firebase,
// so aggressive caching would show stale tournament data) — just caches
// the app shell so it opens instantly on repeat visits.

const CACHE_NAME = 'xts-tournament-shell-v1'
const APP_SHELL = [
  '/xts-tournament/',
  '/xts-tournament/index.html',
  '/xts-tournament/manifest.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Network-first for navigation (so tournament data / routes stay fresh),
// falling back to the cached shell only when offline.
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/xts-tournament/index.html'))
    )
  }
})
