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

  var nguon = null, nguonOrigin = '';
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || typeof d !== 'object' || !laTrangAppsScript(e.origin)) return;
    if (d.eco === 'xin-chao') { e.source.postMessage({ eco: 'vo' }, e.origin); return; }
    if (d.eco === 'dang-nhap-google' && app === 'desk' && d.clientId) {
      nguon = e.source; nguonOrigin = e.origin;
      moGoogle(String(d.clientId));
    }
  });

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
