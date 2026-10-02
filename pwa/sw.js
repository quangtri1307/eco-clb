/* Service worker tối giản: giữ sẵn các file của trang vỏ để app mở nhanh và cài được lên màn hình chính. */
var BO_NHO = 'eco-vo-5';
var TEP = ['./config.js', './vo.js', './vo.css', './board/', './board/index.html', './board/manifest.webmanifest', './desk/', './desk/index.html', './desk/manifest.webmanifest',
  './icons/board-192.png', './icons/board-512.png', './icons/desk-192.png', './icons/desk-512.png',
  './icons/tab-board.png', './icons/tab-desk.png', './icons/apple-board.png', './icons/apple-desk.png', './icons/badge-96.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(BO_NHO).then(function (c) { return c.addAll(TEP); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== BO_NHO && k !== 'eco-tb'; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
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

/* ---------- Thông báo của ECODesk ---------- */
/* Máy chủ chỉ báo "có tin mới" (không kèm nội dung); service worker hỏi lại nội dung bằng mã riêng của máy. */
self.addEventListener('push', function (e) {
  var mac = { tieuDe: 'ECODesk', noiDung: 'Bạn có thông báo mới.' };
  var hien = function (ds) {
    return Promise.all((ds.length ? ds : [mac]).slice(-3).map(function (t, i) {
      return self.registration.showNotification(t.tieuDe === 'ECODesk' ? 'ECODesk' : 'ECODesk: ' + t.tieuDe, {
        body: String(t.noiDung || '').slice(0, 400), icon: '../icons/desk-192.png', badge: '../icons/badge-96.png', tag: 'eco-' + Date.now() + '-' + i, data: { url: './' }
      });
    }));
  };
  e.waitUntil(caches.open('eco-tb').then(function (c) { return c.match('./tb-may'); })
    .then(function (r) { return r ? r.json() : null; })
    .then(function (may) {
      if (!may || !may.khoa || !may.url) return [];
      return fetch(may.url + '?tb=' + encodeURIComponent(may.khoa)).then(function (r) { return r.json(); }).then(function (kq) { return (kq && kq.ds) || []; });
    })
    .catch(function () { return []; })
    .then(hien));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ds) {
    for (var i = 0; i < ds.length; i++) if ('focus' in ds[i]) return ds[i].focus();
    return self.clients.openWindow(self.registration.scope);
  }));
});
