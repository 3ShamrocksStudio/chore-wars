// PREVIEW service worker. Lives in /chore-wars/preview/, so its scope can never reach the live root app.
const PREFIX='chorewars-preview-';
const CACHE=PREFIX+'v3';
const B='/chore-wars/preview/';
const ASSETS=[B,B+'index.html',B+'manifest.json',B+'assets/brand/knight.webp',B+'assets/brand/lockup.webp',B+'assets/brand/lockup.png',
  B+'assets/brand/wordmark.webp',B+'assets/brand/favicon-32.png',B+'icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})));self.skipWaiting();});
// Only ever deletes its OWN old caches; the live app's caches are left alone.
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
// Same-origin, preview paths only: family sync (Firebase) is never cached or rerouted.
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||!u.pathname.startsWith(B))return;
  e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).catch(()=>caches.match(B+'index.html'))));});
