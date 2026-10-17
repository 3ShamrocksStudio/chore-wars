const CACHE='chorewars-v5';
const ASSETS=['/chore-wars/','/chore-wars/index.html','/chore-wars/manifest.json',
  '/chore-wars/assets/brand/knight.webp','/chore-wars/assets/brand/lockup.webp','/chore-wars/assets/brand/lockup.png','/chore-wars/assets/brand/wordmark.webp',
  '/chore-wars/assets/brand/favicon-32.png','/chore-wars/icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
// Same-origin only: family sync (Firebase REST + live stream) must never be cached or rerouted.
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).catch(()=>caches.match('/chore-wars/index.html'))));});
