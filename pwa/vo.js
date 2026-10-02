/*
 * Trang vỏ: mở ECOBoard hoặc ECODesk (chạy trên Google Apps Script) toàn màn hình,
 * để có thể "Thêm vào màn hình chính" như một app, và giúp ECODesk đăng nhập bằng Google.
 */
(function () {
  var app = document.body.getAttribute('data-app');
  var khung = document.getElementById('khung');
  var bao = document.getElementById('bao');
  var url = String((window.ECO_CONFIG && ECO_CONFIG.webAppUrl) || '').trim();

  function hienBao(chu) { bao.textContent = chu; bao.hidden = false; }

  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) {
    hienBao('Trang vỏ chưa được cấu hình. Mở file pwa/config.js trên GitHub và dán link ứng dụng web vào.');
  } else if (!navigator.onLine) {
    hienBao('Không có mạng. Kết nối mạng rồi mở lại app.');
  } else {
    khung.src = url + (app === 'desk' ? '?app=desk' : '');
    khung.hidden = false;
  }
  window.addEventListener('online', function () { if (!khung.src && url) location.reload(); });

  /* Chỉ nói chuyện với trang của Google Apps Script. */
  function laTrangAppsScript(origin) {
    return /^https:\/\/([a-z0-9-]+\.)*googleusercontent\.com$/.test(origin) || origin === 'https://script.google.com';
  }

  /* Khoảng an toàn (tai thỏ, thanh điều hướng) đo bằng CSS env() để app bên trong tự chừa chỗ. */
  var do_ = document.createElement('div');
  do_.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(do_);
  function vien() {
    var c = getComputedStyle(do_);
    return { t: parseFloat(c.paddingTop) || 0, r: parseFloat(c.paddingRight) || 0, b: parseFloat(c.paddingBottom) || 0, l: parseFloat(c.paddingLeft) || 0 };
  }
  /* Ghi nhớ đăng nhập ECODesk ngay ở trang vỏ (bộ nhớ của khung bên trong hay bị điện thoại xoá). */
  var KHOA_PHIEN = 'eco_' + app + '_phien';
  function docPhien() { try { return localStorage.getItem(KHOA_PHIEN) || ''; } catch (e) { return ''; } }
  function luuPhien(p) { try { if (p) localStorage.setItem(KHOA_PHIEN, p); else localStorage.removeItem(KHOA_PHIEN); } catch (e) {} }

  var nguon = null, nguonOrigin = '', appCon = null, appOrigin = '';
  /* iPhone (app trên màn hình chính) đôi khi báo chiều cao màn hình thiếu một đoạn ở dưới: kéo khung xuống tận đáy. */
  var iPhone = /iPhone|iPod/.test(navigator.userAgent);
  var dangLaApp = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  function chinhCao() {
    if (!iPhone || !dangLaApp) return;
    var doc = window.innerWidth < window.innerHeight, cao = doc ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
    khung.style.height = cao > window.innerHeight && cao - window.innerHeight < 120 ? cao + 'px' : '';
  }
  /* Máy này bật được thông báo của app không: co, khong, can-cai (iPhone phải thêm vào màn hình chính trước). */
  function trangThaiThongBao() {
    if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'co';
    return /iPhone|iPad|iPod/.test(navigator.userAgent) && !dangLaApp ? 'can-cai' : 'khong';
  }
  function guiVo() {
    chinhCao();
    if (appCon) { try { appCon.postMessage({ eco: 'vo', vien: vien(), phien: app === 'desk' ? docPhien() : '', thongBao: app === 'desk' ? trangThaiThongBao() : '' }, appOrigin); } catch (e) {} }
  }
  window.addEventListener('resize', guiVo);
  window.addEventListener('orientationchange', function () { setTimeout(guiVo, 300); });

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || typeof d !== 'object' || !laTrangAppsScript(e.origin)) return;
    if (d.eco === 'xin-chao') { appCon = e.source; appOrigin = e.origin; guiVo(); return; }
    /* App mới tự chừa khoảng an toàn: cho khung tràn toàn màn hình để đầu và chân app cân đối. */
    if (d.eco === 'ho-tro-vien') { document.body.classList.add('tran'); return; }
    if (d.eco === 'phien' && app === 'desk') { luuPhien(String(d.phien || '')); return; }
    if (d.eco === 'mau') {
      var mau3 = function (x, mac) { return /^#[0-9a-f]{6}$/i.test(x) ? x : mac; };
      var mau = mau3(d.mau, '#274e13'), nen = mau3(d.nen, '#f4f6f1'), chan = mau3(d.chan, mau);
      var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', mau);
      // Trên cùng (tai thỏ) cùng màu thanh tiêu đề, dưới cùng (thanh vuốt) cùng màu thanh tab của app.
      document.documentElement.style.background = 'linear-gradient(' + mau + ' 50%, ' + chan + ' 50%)';
      document.body.style.background = 'transparent';
      khung.style.background = nen;
      return;
    }
    if (d.eco === 'bat-thong-bao' && app === 'desk' && d.khoaCong) { moHopThongBao(String(d.khoaCong)); return;
    }
    if (d.eco === 'dang-nhap-google' && app === 'desk' && d.clientId) {
      nguon = e.source; nguonOrigin = e.origin;
      moGoogle(String(d.clientId));
    }
  });

  /* ---------- Thông báo của app (Web Push) ---------- */
  function baoApp(d) { if (appCon) { try { appCon.postMessage(d, appOrigin); } catch (e) {} } }
  function khoaSangByte(b64) {
    var s = String(b64).replace(/[^A-Za-z0-9_\-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
    s += '==='.slice(0, (4 - s.length % 4) % 4);
    var raw = atob(s), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function maNgauNhien() {
    var b = new Uint8Array(24); crypto.getRandomValues(b);
    return Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }
  function tenMay() {
    var u = navigator.userAgent;
    return /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'Máy khác';
  }
  function henGio(hua, ms, loi) {
    return new Promise(function (ok, hong) {
      var t = setTimeout(function () { hong(new Error(loi)); }, ms);
      hua.then(function (v) { clearTimeout(t); ok(v); }, function (e) { clearTimeout(t); hong(e); });
    });
  }
  function dangKyThongBao(khoaCong) {
    var tt = trangThaiThongBao();
    if (tt === 'can-cai') return Promise.reject(new Error('Trên iPhone, thêm ECODesk vào màn hình chính rồi mở từ đó mới bật được thông báo.'));
    if (tt !== 'co') return Promise.reject(new Error('Trình duyệt này không hỗ trợ thông báo của app.'));
    return Notification.requestPermission().then(function (q) {
      if (q !== 'granted') throw new Error('Bạn chưa cho phép thông báo. Mở cài đặt của máy, cho phép thông báo với ECODesk rồi thử lại.');
      // Đăng ký (hoặc cập nhật) service worker ngay lúc này, không chờ trang tải xong.
      return henGio(navigator.serviceWorker.register('../sw.js', { scope: './' }).then(function (reg) {
        return reg.update().catch(function () {}).then(function () { return navigator.serviceWorker.ready; });
      }), 25000, 'Máy chưa sẵn sàng nhận thông báo. Đóng hẳn app, mở lại rồi bật lại nhé.');
    }).then(function (reg) {
      var khoa = khoaSangByte(khoaCong);
      return henGio(reg.pushManager.getSubscription().then(function (cu) { return cu ? cu.unsubscribe() : true; })
        .then(function () { return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: khoa }); }), 25000,
        'Không kết nối được máy chủ thông báo của điện thoại. Kiểm tra mạng rồi thử lại.').then(function (sub) { return { reg: reg, sub: sub }; });
    }).then(function (x) {
      var ma = maNgauNhien();
      // Service worker cần mã này và link ứng dụng web để hỏi nội dung thông báo khi có tin.
      return caches.open('eco-tb').then(function (c) {
        return c.put(x.reg.scope + 'tb-may', new Response(JSON.stringify({ khoa: ma, url: url })));
      }).then(function () {
        var k = (x.sub.toJSON && x.sub.toJSON().keys) || {};
        return { diaChi: x.sub.endpoint, khoa: ma, tenMay: tenMay(), p256dh: k.p256dh || '', auth: k.auth || '' };
      });
    });
  }
  function moHopThongBao(khoaCong) {
    var hop = document.getElementById('thongbao');
    if (!hop) return;
    hop.hidden = false;
    document.getElementById('tb-bat').onclick = function () {
      hop.hidden = true;
      dangKyThongBao(khoaCong).then(function (kq) { baoApp({ eco: 'dang-ky-thong-bao', diaChi: kq.diaChi, khoa: kq.khoa, tenMay: kq.tenMay, p256dh: kq.p256dh, auth: kq.auth }); })
        .catch(function (e) { baoApp({ eco: 'thong-bao-loi', loi: e.message }); });
    };
    document.getElementById('tb-dong').onclick = function () { hop.hidden = true; baoApp({ eco: 'thong-bao-loi', loi: 'Bạn đã bỏ qua. Bấm lại khi muốn bật.' }); };
  }

  var daNapGoogle = false;
  function moGoogle(clientId) {
    var hop = document.getElementById('google');
    hop.hidden = false;
    var ve = function () {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: function (r) {
          hop.hidden = true;
          if (nguon && r && r.credential) nguon.postMessage({ eco: 'google-token', token: r.credential }, nguonOrigin);
        }
      });
      var cho = document.getElementById('google-nut');
      cho.innerHTML = '';
      google.accounts.id.renderButton(cho, { theme: 'outline', size: 'large', text: 'signin_with', locale: 'vi', width: 260 });
    };
    if (daNapGoogle) { ve(); return; }
    var s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = function () { daNapGoogle = true; ve(); };
    s.onerror = function () { hop.hidden = true; hienBao('Không tải được đăng nhập Google. Kiểm tra mạng rồi thử lại.'); };
    document.head.appendChild(s);
  }
  document.getElementById('google-dong').onclick = function () { document.getElementById('google').hidden = true; };

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('../sw.js', { scope: './' }).catch(function () {}); });
  }
})();
