// Chore Wars™ Service Worker — by 3Shamrocks Studio
// © 2026 3Shamrocks Studio. All rights reserved.
//
// NOTE: github.io serves every project of an org from ONE shared origin
// (https://<org>.github.io). A service worker or CacheStorage left behind by
// another project on that origin can hijack navigations. This SW therefore
// (a) uses network-first for navigations so a stale shell can never trap the
// user, and (b) deletes every cache it does not own on activate.

const CACHE_NAME = 'chorewars-v2-cache';
const urlsToCache = [
  './',
  'index.html',
  'manifest.json',
  'icon.svg',
  '3shamrocks_black.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Purge ALL other caches on this (shared) origin — including any left by
    // sibling org projects — so nothing stale or foreign can be served.
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Navigation requests: network-first, fall back to cached app shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('index.html')))
    );
    return;
  }

  // Other assets: cache-first, then network (offline-friendly).
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => cached))
  );
});

// Allow the page to tell the SW to activate immediately after an update.
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
