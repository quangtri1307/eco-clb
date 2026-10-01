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
  function guiVo() { if (appCon) { try { appCon.postMessage({ eco: 'vo', vien: vien(), phien: app === 'desk' ? docPhien() : '' }, appOrigin); } catch (e) {} } }
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
      var mau = /^#[0-9a-f]{6}$/i.test(d.mau) ? d.mau : '#274e13', nen = /^#[0-9a-f]{6}$/i.test(d.nen) ? d.nen : '#274e13';
      var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', mau);
      document.documentElement.style.background = mau; khung.style.background = nen;
      return;
    }
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
