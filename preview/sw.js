/* Retired: the old prototype service worker. This version clears its caches, unregisters itself and reloads open pages into Chore Wars. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('chorewars-') === 0; }).map(function (k) { return caches.delete(k); })); })
    .then(function () { return self.registration.unregister(); })
    .then(function () { return self.clients.matchAll({ type: 'window' }); })
    .then(function (cs) { cs.forEach(function (c) { if (c.url.indexOf('/chore-wars/app/') < 0) c.navigate('/chore-wars/app/'); }); }));
});
