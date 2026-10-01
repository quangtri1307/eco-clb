/* Service worker tối giản: giữ sẵn các file của trang vỏ để app mở nhanh và cài được lên màn hình chính. */
var BO_NHO = 'eco-vo-2';
var TEP = ['./config.js', './vo.js', './vo.css', './board/', './board/index.html', './board/manifest.webmanifest', './desk/', './desk/index.html', './desk/manifest.webmanifest',
  './icons/board-192.png', './icons/board-512.png', './icons/desk-192.png', './icons/desk-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(BO_NHO).then(function (c) { return c.addAll(TEP); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== BO_NHO; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
/* Ưu tiên lấy bản mới trên mạng; mất mạng thì dùng bản đã lưu. */
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then(function (r) {
    var sao = r.clone();
    caches.open(BO_NHO).then(function (c) { c.put(e.request, sao); });
    return r;
  }).catch(function () { return caches.match(e.request); }));
});
