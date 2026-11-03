/* 논문 지도 앱 서비스 워커: 화면은 저장해 두고(오프라인에서도 열림), 저장본(data.enc)은 새것을 먼저 받음 */
const VERSION = 'pm-20261104-040925';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './apple-touch-icon.png', './favicon-32.png', './data.enc', './version.json'];
const FRESH = /\/(data\.enc|version\.json)$/;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(new URL('./', location.href).pathname)) return;
  // 저장본·버전: 인터넷 되면 새것, 안 되면 저장해 둔 것
  if (FRESH.test(url.pathname)) {
    if (req.cache === 'no-store') return;
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const r = await fetch(req, { cache: 'no-cache' });
        if (r.ok) await cache.put(req, r.clone());
        return r;
      } catch (err) {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        throw err;
      }
    })());
    return;
  }
  // 화면 파일: 저장해 둔 것을 바로 쓰고 뒤에서 새로 받아 둠(다음 실행 때 반영)
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const key = req.mode === 'navigate' ? './index.html' : req;
    const hit = await cache.match(key, { ignoreSearch: true });
    const net = fetch(req).then((r) => { if (r.ok && r.type === 'basic') cache.put(key, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const r = await net;
    return r || new Response('오프라인입니다', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  })());
});
