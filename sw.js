/* Service worker: lưu app và dữ liệu nét chữ để dùng offline */
const VERSION = 'hanzi-pwa-v4';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './hanzi-writer.min.js', './stroke-data.json'];
const LIB = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3/dist/hanzi-writer.min.js';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c =>
    Promise.all(SHELL.map(u => c.add(new Request(u, {cache: 'reload'})).catch(() => {})))
      .then(() => c.add(LIB).catch(() => {}))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Thư viện + dữ liệu nét từ jsDelivr: ưu tiên cache (dữ liệu không đổi)
  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.open(VERSION).then(c => c.match(req).then(hit => hit ||
      fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }))));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // File của app: lấy bản mới từ mạng; mất mạng hoặc GitHub tạm báo lỗi thì dùng bản đã lưu
  const isPage = req.mode === 'navigate';
  const cacheKey = isPage ? './index.html' : req;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      // Dùng URL (không dùng lại Request gốc) để tránh lỗi với yêu cầu điều hướng
      const res = await fetch(url.href, {cache: 'no-cache', credentials: 'same-origin'});
      if (res.ok) { cache.put(cacheKey, res.clone()); return res; }
      const old = await cache.match(cacheKey);
      return old || res;
    } catch (err) {
      const old = await cache.match(cacheKey) || (isPage ? await cache.match('./') : null);
      return old || Response.error();
    }
  })());
});
