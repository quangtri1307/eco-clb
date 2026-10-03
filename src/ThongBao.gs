/**
 * Thông báo của ECODesk.
 *  - Nhắc deadline (BOD: task của mình và task mới được giao; ban nhân sự: task của thành viên) gửi theo cách
 *    mỗi người chọn: Zalo, app trên điện thoại (thông báo đẩy), mail. BOD sửa được cho mọi người.
 *  - Các thông báo khác chỉ gửi qua mail: thư UCV chờ duyệt và góp ý mới (cho BOD), kết quả duyệt thư (cho UCV).
 * Lựa chọn lưu ở cột NhanThongBao của tab TaiKhoan; các máy đã bật thông báo app lưu ở tab ThietBi.
 */

var GIU_THONG_BAO_NGAY = 30;

/* ---------- Ai nhận thông báo, nhận bằng cách nào ---------- */

/** Mã ngắn của một máy (từ địa chỉ nhận tin), dùng khi gỡ máy. */
function maMay(diaChi) {
  return base64Url(byteKhongDau_(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(diaChi)))).slice(0, 12);
}

/** Các máy đã bật thông báo app, theo email: { email: [{ ma, tenMay, thoiGian }] }. */
function mayTheoEmail() {
  var may = {};
  docBang('ThietBi').forEach(function (t) {
    var e = String(t.Email).toLowerCase();
    (may[e] = may[e] || []).push({ ma: maMay(t.DiaChi), tenMay: String(t.TenMay || 'Máy không rõ tên'), thoiGian: t.ThoiGian ? new Date(t.ThoiGian).getTime() : 0 });
  });
  return may;
}

/** Cách nhận nhắc deadline đã lưu của một tài khoản. Chưa chọn thì nhận qua Zalo. */
function cachMacDinh(tk) {
  return chuanHoaCachNhan(tk.NhanThongBao);
}

/** BOD và ban nhân sự (người nhận nhắc deadline) kèm cách nhận: [{ email, ten, vaiTro, cach, chatId, tenZalo, ma, soMay, may }]. */
function nguoiNhanThongBao() {
  var zalo = {};
  dongBoNguoiNhanZalo().forEach(function (n) { zalo[n.ten] = n; });
  var may = mayTheoEmail();
  return docBang('TaiKhoan').filter(function (t) { return t.Email && (t.VaiTro === 'BOD' || t.VaiTro === 'HR'); }).map(function (t) {
    var z = zalo[String(t.HoVaTen)] || {};
    var email = String(t.Email), m = may[email.toLowerCase()] || [];
    var cach = cachMacDinh(t);
    return {
      email: email, ten: String(t.HoVaTen), vaiTro: String(t.VaiTro), cach: cach,
      chatId: String(z.chatId || ''), tenZalo: String(z.tenZalo || ''), ma: String(z.ma || ''), soMay: m.length, may: m
    };
  });
}

function ghiCotTaiKhoan(email, cot, giaTri) {
  return voiKhoa_(function () {
    var sh = bangDuLieu('TaiKhoan');
    var v = sh.getDataRange().getValues();
    var td = v[0], cE = td.indexOf('Email'), c = td.indexOf(cot);
    if (c < 0) throw new Error('Thiếu cột ' + cot + ' trong tab TaiKhoan.');
    for (var r = 1; r < v.length; r++) {
      if (String(v[r][cE]).toLowerCase() === String(email).toLowerCase()) { sh.getRange(r + 1, c + 1).setValue(giaTri); return true; }
    }
    throw new Error('Không tìm thấy tài khoản ' + email + '.');
  });
}

/**
 * Gửi một thông báo cho một người theo các cách người đó chọn. Lỗi ở cách này không chặn cách khác.
 * Trả về số cách đã gửi được.
 */
function guiThongBao(n, tieuDe, noiDung, baoCao) {
  var duoc = 0, ghi = function (x) { if (baoCao) baoCao.push(x); };
  if (n.cach.indexOf('zalo') >= 0) {
    var token = layTokenZalo();
    if (!n.chatId) ghi('Zalo: chưa kết nối bot.');
    else if (!token) ghi('Zalo: CLB chưa nhập mã bot.');
    else { try { guiZalo(token, n.chatId, noiDung); duoc++; ghi('Zalo: đã gửi.'); } catch (e) { ghi('Zalo: lỗi ' + e.message); } }
  }
  if (n.cach.indexOf('mail') >= 0 && emailHopLe(n.email)) {
    try { MailApp.sendEmail(n.email, 'ECODesk: ' + tieuDe, noiDung + '\n\n(Thư tự động từ ECODesk. Đổi cách nhận nhắc deadline trong ECODesk.)'); duoc++; ghi('Mail: đã gửi tới ' + n.email + '.'); } catch (e) { ghi('Mail: lỗi ' + e.message); }
  }
  if (n.cach.indexOf('app') >= 0) {
    try { if (guiLenApp(n.email, tieuDe, noiDung, baoCao)) duoc++; } catch (e) { ghi('App: lỗi ' + e.message); }
  }
  return duoc;
}

/* ---------- Thông báo đẩy lên app (Web Push) ---------- */

function byteKy_(b) { return b.map(function (x) { x = x & 255; return x > 127 ? x - 256 : x; }); }
function byteKhongDau_(b) { return b.map(function (x) { return x & 255; }); }
function hmacGas_(khoa, duLieu) { return byteKhongDau_(Utilities.computeHmacSha256Signature(byteKy_(duLieu), byteKy_(khoa))); }

/** Cặp khoá VAPID của CLB: tự tạo lần đầu, lưu trong Script Properties. Đổi khoá thì mọi máy phải bật lại thông báo. */
function khoaVapid() {
  var kho = PropertiesService.getScriptProperties();
  var raw = kho.getProperty('VapidRieng');
  var rieng = raw ? JSON.parse(raw) : null;
  if (!rieng) {
    for (var lan = 0; lan < 5 && !rieng; lan++) {
      var b = byteKhongDau_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid() + Date.now()));
      try { khoaCongP256(b); rieng = b; } catch (e) { rieng = null; }
    }
    kho.setProperty('VapidRieng', JSON.stringify(rieng));
  }
  return { rieng: rieng, cong: base64Url(khoaCongP256(rieng)) };
}

function jwtVapid(goc, khoa) {
  var bo = CacheService.getScriptCache(), k = 'vapid_' + goc;
  var co = bo.get(k);
  if (co) return co;
  var chu = function (o) { return base64Url(byteKhongDau_(Utilities.newBlob(JSON.stringify(o)).getBytes())); };
  var vao = chu({ typ: 'JWT', alg: 'ES256' }) + '.' + chu({ aud: goc, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:' + emailClb() });
  var bam = byteKhongDau_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, vao, Utilities.Charset.UTF_8));
  var jwt = vao + '.' + base64Url(kyP256(bam, khoa.rieng, hmacGas_));
  bo.put(k, jwt, 11 * 3600);
  return jwt;
}

/** Báo cho các máy của một người là có thông báo mới. App trên máy tự hỏi lại nội dung. Trả về true nếu gửi tới ít nhất một máy. */
function guiLenApp(email, tieuDe, noiDung, baoCao) {
  var ghi = function (x) { if (baoCao) baoCao.push(x); };
  var may = docBang('ThietBi').filter(function (t) { return String(t.Email).toLowerCase() === String(email).toLowerCase(); });
  if (!may.length) { ghi('App: chưa có máy nào bật thông báo.'); return false; }
  themDong('ThongBao', [{ ThoiGian: new Date(), Email: email, TieuDe: String(tieuDe).slice(0, 200), NoiDung: String(noiDung).slice(0, 3000) }]);
  var khoa = khoaVapid(), duoc = false, hong = [];
  var noiDungByte = byteKhongDau_(Utilities.newBlob(JSON.stringify({ tieuDe: String(tieuDe).slice(0, 100), noiDung: String(noiDung).slice(0, 900) })).getBytes());
  may.forEach(function (m) {
    var diaChi = String(m.DiaChi);
    var ten = 'App (' + (m.TenMay || 'máy') + ')';
    if (!diaChiDayHopLe(diaChi)) { ghi(ten + ': địa chỉ nhận tin không hợp lệ (' + gocDiaChi(diaChi) + ').'); return; }
    var ma = 0, tl = '';
    try {
      var tuyChon = {
        method: 'post', payload: '', muteHttpExceptions: true,
        headers: { Authorization: 'vapid t=' + jwtVapid(gocDiaChi(diaChi), khoa) + ', k=' + khoa.cong, TTL: '86400', Urgency: 'high' }
      };
      // Máy có khoá mã hoá thì gửi kèm nội dung để hiện ngay. Máy bật từ bản cũ thì máy tự hỏi lại nội dung.
      if (m.P256dh && m.Auth) {
        tuyChon.payload = byteKy_(maHoaThongBaoDay(noiDungByte, byteBase64Url_(m.P256dh), byteBase64Url_(m.Auth), khoaTam_(), byteNgauNhien_(16), hmacGas_));
        tuyChon.contentType = 'application/octet-stream';
        tuyChon.headers['Content-Encoding'] = 'aes128gcm';
      }
      var res = UrlFetchApp.fetch(diaChi, tuyChon);
      ma = res.getResponseCode(); tl = String(res.getContentText() || '').replace(/\s+/g, ' ').slice(0, 160);
    } catch (e) { ghi(ten + ': lỗi mạng ' + e.message); return; } // lỗi mạng tạm thời: bỏ qua máy này lần này
    if (ma >= 200 && ma < 300) { duoc = true; ghi(ten + ': máy chủ thông báo đã nhận (' + ma + ').' + (m.P256dh && m.Auth ? '' : ' Máy này bật từ bản cũ, nên bấm Gỡ rồi bật lại trên điện thoại để thông báo hiện chắc chắn.')); }
    else {
      ghi(ten + ': bị từ chối, mã ' + ma + (tl ? ' · ' + tl : '') + (ma === 404 || ma === 410 ? ' (máy đã tắt thông báo, đã gỡ khỏi danh sách)' : ''));
      if (ma === 404 || ma === 410) hong.push(diaChi); // máy đã tắt thông báo hoặc gỡ app
    }
  });
  if (hong.length) voiKhoa_(function () { ghiDeBang('ThietBi', docBang('ThietBi').filter(function (t) { return hong.indexOf(String(t.DiaChi)) < 0; })); });
  return duoc;
}

function byteNgauNhien_(n) {
  var ra = [];
  while (ra.length < n) ra = ra.concat(byteKhongDau_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid() + Date.now())));
  return ra.slice(0, n);
}
/** Khoá riêng tạm cho một lần gửi (32 byte hợp lệ trên P-256). */
function khoaTam_() {
  for (var lan = 0; lan < 5; lan++) { var b = byteNgauNhien_(32); try { khoaCongP256(b); return b; } catch (e) { /* thử số khác */ } }
  throw new Error('Không tạo được khoá tạm.');
}
function byteBase64Url_(s) {
  var t = String(s).replace(/=+$/, '');
  while (t.length % 4) t += '=';
  return byteKhongDau_(Utilities.base64DecodeWebSafe(t));
}

/** App trên điện thoại hỏi nội dung thông báo mới (gọi từ service worker, không cần đăng nhập, chỉ cần khoá riêng của máy). */
function layThongBaoChoMay(khoaMay) {
  khoaMay = String(khoaMay || '');
  if (khoaMay.length < 20) return { ds: [] };
  return voiKhoa_(function () {
    var sh = bangDuLieu('ThietBi');
    var v = sh.getDataRange().getValues(), td = v[0];
    var cK = td.indexOf('Khoa'), cE = td.indexOf('Email'), cL = td.indexOf('LayCuoi');
    for (var r = 1; r < v.length; r++) {
      if (String(v[r][cK]) !== khoaMay) continue;
      var email = String(v[r][cE]).toLowerCase();
      var tu = v[r][cL] ? new Date(v[r][cL]).getTime() : 0;
      var ds = docBang('ThongBao').filter(function (t) {
        return String(t.Email).toLowerCase() === email && new Date(t.ThoiGian).getTime() > tu;
      }).slice(-5).map(function (t) { return { tieuDe: String(t.TieuDe), noiDung: String(t.NoiDung) }; });
      sh.getRange(r + 1, cL + 1).setValue(new Date());
      return { ds: ds };
    }
    return { ds: [] };
  });
}

/** Xoá thông báo cũ (chạy kèm nhắc việc hằng ngày). */
function donThongBaoCu() {
  var moc = Date.now() - GIU_THONG_BAO_NGAY * 864e5;
  voiKhoa_(function () {
    var ds = docBang('ThongBao');
    var con = ds.filter(function (t) { return new Date(t.ThoiGian).getTime() >= moc; });
    if (con.length < ds.length) ghiDeBang('ThongBao', con);
  });
}

/** Đảm bảo có lịch nhắc việc hằng ngày (dù chưa có bot Zalo). */
function damBaoLichNhac() {
  if (!coLichNhac()) caiLichNhac(caiDatNhacZalo().dsGio);
}

/* ---------- Sự kiện cần báo ---------- */

/** Bật/tắt từng loại thông báo (BOD chỉnh trong Cài đặt). Mặc định là bật. */
function batSuKien(khoa) {
  return String(layCaiDat(khoa) || '') !== 'tat';
}

/** Gửi một mail thông báo. Lỗi thì bỏ qua, không ảnh hưởng việc đang làm. */
function guiMailThongBao(email, tieuDe, noiDung) {
  if (!emailHopLe(email)) return false;
  try { MailApp.sendEmail(String(email).trim(), 'ECODesk: ' + tieuDe, noiDung + '\n\n(Thư tự động từ ECODesk.)', { name: 'ECODesk' }); return true; } catch (e) { return false; }
}

/** Báo qua mail cho mọi BOD. */
function baoChoBod(tieuDe, noiDung) {
  try {
    docBang('TaiKhoan').forEach(function (t) { if (t.VaiTro === 'BOD') guiMailThongBao(t.Email, tieuDe, noiDung); });
  } catch (e) { /* bỏ qua */ }
}

/** UCV vừa gửi thư chờ BOD duyệt. */
function baoThuChoDuyet(nguoiTao, tieuDeThu) {
  if (!batSuKien('BaoThuChoDuyet')) return;
  baoChoBod('Thư chờ duyệt', 'ECODesk: ' + nguoiTao + ' vừa gửi thư "' + (String(tieuDeThu || '').trim() || '(chưa có tiêu đề)') + '" chờ BOD duyệt. Mở ECODesk, mục Mail để xem.');
}

/** Báo cho UCV kết quả duyệt thư của mình. */
function baoKetQuaDuyet(nguoiTao, tieuDeThu, trangThai, ghiChu, nguoiDuyet) {
  try {
    var n = docBang('TaiKhoan').filter(function (t) { return String(t.HoVaTen) === String(nguoiTao) && t.VaiTro === 'UCV'; })[0];
    if (!n) return;
    var ten = '"' + (String(tieuDeThu || '').trim() || '(chưa có tiêu đề)') + '"';
    var tin = trangThai === TRANG_THAI_VIEC.DUYET ? 'ECODesk: thư ' + ten + ' đã được ' + nguoiDuyet + ' duyệt và gửi đi.'
      : trangThai === TRANG_THAI_VIEC.SUA ? 'ECODesk: thư ' + ten + ' cần sửa lại.'
      : 'ECODesk: thư ' + ten + ' không được duyệt.';
    if (ghiChu && trangThai !== TRANG_THAI_VIEC.DUYET) tin += ' Ghi chú của BOD: ' + String(ghiChu).slice(0, 500);
    guiMailThongBao(n.Email, trangThai === TRANG_THAI_VIEC.DUYET ? 'Thư đã được duyệt' : 'Kết quả duyệt thư', tin);
  } catch (e) { /* bỏ qua */ }
}

/* ---------- Gọi từ ECODesk ---------- */

/** Cách nhận nhắc deadline của chính mình (BOD, ban nhân sự). */
function layThongBaoCuaToi(phien) {
  var tk = canDangNhap(phien, 'task');
  var toi = nguoiNhanThongBao().filter(function (n) { return n.email.toLowerCase() === String(tk.Email).toLowerCase(); })[0] || { cach: ['zalo'], may: [] };
  return {
    email: String(tk.Email), vaiTro: String(tk.VaiTro), cach: toi.cach, soMay: toi.may.length, may: toi.may,
    zalo: trangThaiZaloCuaToi(String(tk.HoVaTen)), khoaCong: khoaVapid().cong,
    suKien: { dsGio: caiDatNhacZalo().dsGio, gopY: baoGopYQuaMail(), thuChoDuyet: batSuKien('BaoThuChoDuyet') }
  };
}

function kiemTraCachNhan(cach) {
  var ds = (Array.isArray(cach) ? cach : []).filter(function (c) { return CACH_THONG_BAO.indexOf(c) >= 0; });
  if (!ds.length) throw new Error('Chọn ít nhất một cách nhận thông báo.');
  return chuanHoaCachNhan(ds).join(',');
}

function luuCachNhanCuaToi(phien, cach) {
  var tk = canDangNhap(phien, 'task');
  ghiCotTaiKhoan(String(tk.Email), 'NhanThongBao', kiemTraCachNhan(cach));
  damBaoLichNhac();
  return layThongBaoCuaToi(phien);
}

/** Ghi lại máy vừa bật thông báo (gọi sau khi trang vỏ đăng ký nhận thông báo đẩy). */
function luuThietBi(phien, tb) {
  var tk = canDangNhap(phien, 'task');
  tb = tb || {};
  var diaChi = String(tb.diaChi || ''), khoa = String(tb.khoa || '');
  if (!diaChiDayHopLe(diaChi)) throw new Error('Máy này chưa hỗ trợ thông báo của app.');
  if (!/^[A-Za-z0-9-]{20,80}$/.test(khoa)) throw new Error('Thiếu mã của máy. Bạn thử bật lại nhé.');
  var p256dh = /^[A-Za-z0-9_-]{80,100}$/.test(String(tb.p256dh || '')) ? String(tb.p256dh) : '';
  var auth = /^[A-Za-z0-9_-]{16,30}$/.test(String(tb.auth || '')) ? String(tb.auth) : '';
  voiKhoa_(function () {
    var con = docBang('ThietBi').filter(function (t) { return String(t.DiaChi) !== diaChi; });
    con.push({ Email: String(tk.Email), DiaChi: diaChi, Khoa: khoa, TenMay: String(tb.tenMay || '').slice(0, 80), ThoiGian: new Date(), LayCuoi: new Date(), P256dh: p256dh, Auth: auth });
    ghiDeBang('ThietBi', con);
  });
  var cach = cachMacDinh(tk);
  if (cach.indexOf('app') < 0) { cach.push('app'); ghiCotTaiKhoan(String(tk.Email), 'NhanThongBao', chuanHoaCachNhan(cach).join(',')); }
  damBaoLichNhac();
  return layThongBaoCuaToi(phien);
}

/** Gỡ một máy khỏi danh sách nhận thông báo app. Chủ máy hoặc BOD gỡ được. */
function goThietBi(phien, ma) {
  var tk = canDangNhap(phien);
  return voiKhoa_(function () {
    var ds = docBang('ThietBi');
    var may = ds.filter(function (t) { return maMay(t.DiaChi) === String(ma); })[0];
    if (!may) throw new Error('Máy này đã được gỡ rồi.');
    if (String(may.Email).toLowerCase() !== String(tk.Email).toLowerCase() && !coQuyen(String(tk.VaiTro), 'caidat')) throw new Error('Bạn chỉ gỡ được máy của mình.');
    ghiDeBang('ThietBi', ds.filter(function (t) { return t !== may; }));
    return true;
  });
}

/** Gửi thử một thông báo cho chính mình theo các cách đã chọn. */
function guiThuThongBaoCuaToi(phien) {
  var tk = canDangNhap(phien, 'task');
  var toi = nguoiNhanThongBao().filter(function (n) { return n.email.toLowerCase() === String(tk.Email).toLowerCase(); })[0];
  if (!toi) throw new Error('Không tìm thấy tài khoản của bạn.');
  var baoCao = [];
  var duoc = guiThongBao(toi, 'Thông báo thử', 'ECODesk: đây là thông báo thử. Bạn sẽ nhận nhắc deadline theo cách này.', baoCao);
  if (!baoCao.length) baoCao.push('Chưa chọn cách nhận nào.');
  return { duoc: duoc, chiTiet: baoCao };
}

/** BOD gửi thử cho một người hoặc tất cả (email = '*'), bằng các cách tự chọn (không theo lựa chọn của người nhận). */
function guiThuThongBao(phien, yc) {
  var tk = canDangNhap(phien, 'caidat');
  yc = yc || {};
  var cach = (Array.isArray(yc.cach) ? yc.cach : []).filter(function (c) { return CACH_THONG_BAO.indexOf(c) >= 0; });
  if (!cach.length) throw new Error('Chọn ít nhất một cách gửi.');
  var ai = String(yc.email || '');
  var ds = nguoiNhanThongBao().filter(function (n) { return ai === '*' || n.email.toLowerCase() === ai.toLowerCase(); });
  if (!ds.length) throw new Error('Không tìm thấy người nhận.');
  var chiTiet = [], duoc = 0;
  ds.forEach(function (n) {
    var bc = [];
    var x = {}; Object.keys(n).forEach(function (k) { x[k] = n[k]; });
    x.cach = cach;
    try { if (guiThongBao(x, 'Thông báo thử', 'ECODesk: ' + tk.HoVaTen + ' gửi thử thông báo cho bạn. Nếu bạn đọc được dòng này là đã nhận được.', bc)) duoc++; }
    catch (e) { bc.push('Lỗi: ' + e.message); }
    if (cach.indexOf('mail') >= 0 && !emailHopLe(n.email)) bc.push('Mail: email không hợp lệ.');
    bc.forEach(function (d) { chiTiet.push(n.ten + ' · ' + d); });
  });
  return { duoc: duoc, tong: ds.length, chiTiet: chiTiet };
}

/** BOD xem mọi người đang nhận thông báo bằng cách nào, có những máy nào. */
function layNguoiNhanThongBao(phien) {
  canDangNhap(phien, 'caidat');
  return nguoiNhanThongBao().map(function (n) {
    return { email: n.email, ten: n.ten, vaiTro: n.vaiTro, cach: n.cach, daKetNoiZalo: !!n.chatId, tenZalo: n.tenZalo, soMay: n.soMay, may: n.may };
  });
}

/** BOD sửa cách nhận thông báo của một người. */
function luuCachNhan(phien, email, cach) {
  canDangNhap(phien, 'caidat');
  var tk = timTaiKhoan(email);
  if (!tk || (tk.VaiTro !== 'BOD' && tk.VaiTro !== 'HR')) throw new Error('Không tìm thấy tài khoản ' + email + '.');
  ghiCotTaiKhoan(String(tk.Email), 'NhanThongBao', kiemTraCachNhan(cach));
  damBaoLichNhac();
  return true;
}

/** Bật/tắt mail báo góp ý mới và thư chờ duyệt. */
function luuSuKienThongBao(phien, cd) {
  canDangNhap(phien, 'caidat');
  cd = cd || {};
  if (cd.gopY !== undefined) datCaiDat('BaoGopYQuaMail', cd.gopY ? 'bat' : 'tat');
  if (cd.thuChoDuyet !== undefined) datCaiDat('BaoThuChoDuyet', cd.thuChoDuyet ? 'bat' : 'tat');
  return true;
}

/** Giao diện sáng/tối của từng người, nhớ theo tài khoản. */
function luuGiaoDien(phien, giaoDien) {
  var tk = canDangNhap(phien);
  ghiCotTaiKhoan(String(tk.Email), 'GiaoDien', ['light', 'dark'].indexOf(giaoDien) >= 0 ? giaoDien : 'auto');
  return true;
}
