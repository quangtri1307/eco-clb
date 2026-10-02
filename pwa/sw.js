/* Service worker tối giản: giữ sẵn các file của trang vỏ để app mở nhanh và cài được lên màn hình chính. */
var BO_NHO = 'eco-vo-7';
var TEP = ['./config.js', './vo.js', './vo.css', './board/', './board/index.html', './board/manifest.webmanifest', './desk/', './desk/index.html', './desk/manifest.webmanifest',
  './icons/board-192.png', './icons/board-512.png', './icons/desk-192.png', './icons/desk-512.png',
  './icons/tab-board.png', './icons/tab-desk.png', './icons/apple-board.png', './icons/apple-desk.png', './icons/badge-96.png'];

self.addEventListener('install', function (e) {
  // Lưu từng file riêng: thiếu một file cũng không làm hỏng việc cài (cần để nhận thông báo).
  e.waitUntil(caches.open(BO_NHO).then(function (c) { return Promise.all(TEP.map(function (f) { return c.add(f).catch(function () {}); })); }).then(function () { return self.skipWaiting(); }));
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
/*
 * Máy chủ gửi kèm nội dung đã mã hoá (trình duyệt tự giải mã) nên hiện ngay. iPhone chỉ cho rất ít thời gian,
 * phải hiện thông báo ngay chứ không kịp hỏi lại máy chủ. Máy bật từ bản cũ (tin không có nội dung) thì
 * hỏi lại nội dung bằng mã riêng của máy, quá 4 giây thì hiện câu chung.
 */
self.addEventListener('push', function (e) {
  var mac = { tieuDe: 'ECODesk', noiDung: 'Bạn có thông báo mới.' };
  var co = null;
  try { co = e.data ? e.data.json() : null; } catch (loi) { co = null; }
  var hien = function (ds) {
    return Promise.all((ds.length ? ds : [mac]).slice(-3).map(function (t, i) {
      return self.registration.showNotification(t.tieuDe === 'ECODesk' ? 'ECODesk' : 'ECODesk: ' + t.tieuDe, {
        body: String(t.noiDung || '').slice(0, 400), icon: '../icons/desk-192.png', badge: '../icons/badge-96.png', tag: 'eco-' + Date.now() + '-' + i, data: { url: './' }
      });
    }));
  };
  if (co && co.tieuDe) { e.waitUntil(hien([co])); return; }
  var hoiLai = caches.open('eco-tb').then(function (c) { return c.match(self.registration.scope + 'tb-may'); })
    .then(function (r) { return r ? r.json() : null; })
    .then(function (may) {
      if (!may || !may.khoa || !may.url) return [];
      return fetch(may.url + '?tb=' + encodeURIComponent(may.khoa)).then(function (r) { return r.json(); }).then(function (kq) { return (kq && kq.ds) || []; });
    })
    .catch(function () { return []; });
  var choToiDa = new Promise(function (ok) { setTimeout(function () { ok([]); }, 4000); });
  e.waitUntil(Promise.race([hoiLai, choToiDa]).then(hien));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ds) {
    for (var i = 0; i < ds.length; i++) if ('focus' in ds[i]) return ds[i].focus();
    return self.clients.openWindow(self.registration.scope);
  }));
});
