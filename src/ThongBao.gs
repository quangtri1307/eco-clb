/**
 * Thông báo cho BOD và ban nhân sự (nhắc việc hằng ngày, task mới).
 * Mỗi người chọn ít nhất một cách nhận: Zalo, app trên điện thoại (thông báo đẩy), mail.
 * Lựa chọn lưu ở cột NhanThongBao của tab TaiKhoan; BOD xem và sửa được cho mọi người trong Cài đặt.
 */

var GIU_THONG_BAO_NGAY = 30;

/* ---------- Ai nhận thông báo, nhận bằng cách nào ---------- */

/** Danh sách BOD và ban nhân sự kèm cách nhận: [{ email, ten, vaiTro, cach, chatId, tenZalo, ma, soMay }]. */
function nguoiNhanThongBao() {
  var zalo = {};
  dongBoNguoiNhanZalo().forEach(function (n) { zalo[n.ten] = n; });
  var may = {};
  docBang('ThietBi').forEach(function (t) { var e = String(t.Email).toLowerCase(); may[e] = (may[e] || 0) + 1; });
  return docBang('TaiKhoan').filter(function (t) { return t.VaiTro === 'BOD' || t.VaiTro === 'HR'; }).map(function (t) {
    var z = zalo[String(t.HoVaTen)] || {};
    var email = String(t.Email);
    return {
      email: email, ten: String(t.HoVaTen), vaiTro: String(t.VaiTro), cach: chuanHoaCachNhan(t.NhanThongBao),
      chatId: String(z.chatId || ''), tenZalo: String(z.tenZalo || ''), ma: String(z.ma || ''), soMay: may[email.toLowerCase()] || 0
    };
  });
}

function ghiCotTaiKhoan(email, cot, giaTri) {
  var sh = bangDuLieu('TaiKhoan');
  var v = sh.getDataRange().getValues();
  var td = v[0], cE = td.indexOf('Email'), c = td.indexOf(cot);
  if (c < 0) throw new Error('Thiếu cột ' + cot + ' trong tab TaiKhoan.');
  for (var r = 1; r < v.length; r++) {
    if (String(v[r][cE]).toLowerCase() === String(email).toLowerCase()) { sh.getRange(r + 1, c + 1).setValue(giaTri); return true; }
  }
  throw new Error('Không tìm thấy tài khoản ' + email + '.');
}

/**
 * Gửi một thông báo cho một người theo các cách người đó chọn. Lỗi ở cách này không chặn cách khác.
 * Trả về số cách đã gửi được.
 */
function guiThongBao(n, tieuDe, noiDung) {
  var duoc = 0;
  if (n.cach.indexOf('zalo') >= 0 && n.chatId) {
    var token = layTokenZalo();
    if (token) { try { guiZalo(token, n.chatId, noiDung); duoc++; } catch (e) { /* bỏ qua */ } }
  }
  if (n.cach.indexOf('mail') >= 0 && emailHopLe(n.email)) {
    try { MailApp.sendEmail(n.email, 'ECODesk: ' + tieuDe, noiDung + '\n\n(Thư tự động từ ECODesk. Đổi cách nhận thông báo trong ECODesk, mục Task.)'); duoc++; } catch (e) { /* hết lượt gửi trong ngày */ }
  }
  if (n.cach.indexOf('app') >= 0) {
    try { if (guiLenApp(n.email, tieuDe, noiDung)) duoc++; } catch (e) { /* bỏ qua */ }
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
function guiLenApp(email, tieuDe, noiDung) {
  var may = docBang('ThietBi').filter(function (t) { return String(t.Email).toLowerCase() === String(email).toLowerCase(); });
  if (!may.length) return false;
  themDong('ThongBao', [{ ThoiGian: new Date(), Email: email, TieuDe: String(tieuDe).slice(0, 200), NoiDung: String(noiDung).slice(0, 3000) }]);
  var khoa = khoaVapid(), duoc = false, hong = [];
  may.forEach(function (m) {
    var diaChi = String(m.DiaChi);
    if (!diaChiDayHopLe(diaChi)) return;
    var ma = 0;
    try {
      ma = UrlFetchApp.fetch(diaChi, {
        method: 'post', payload: '', muteHttpExceptions: true,
        headers: { Authorization: 'vapid t=' + jwtVapid(gocDiaChi(diaChi), khoa) + ', k=' + khoa.cong, TTL: '86400', Urgency: 'high' }
      }).getResponseCode();
    } catch (e) { return; } // lỗi mạng tạm thời: bỏ qua máy này lần này
    if (ma >= 200 && ma < 300) duoc = true;
    else if (ma === 404 || ma === 410) hong.push(diaChi); // máy đã tắt thông báo hoặc gỡ app
  });
  if (hong.length) ghiDeBang('ThietBi', docBang('ThietBi').filter(function (t) { return hong.indexOf(String(t.DiaChi)) < 0; }));
  return duoc;
}

/** App trên điện thoại hỏi nội dung thông báo mới (gọi từ service worker, không cần đăng nhập, chỉ cần khoá riêng của máy). */
function layThongBaoChoMay(khoaMay) {
  khoaMay = String(khoaMay || '');
  if (khoaMay.length < 20) return { ds: [] };
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
}

/** Xoá thông báo cũ (chạy kèm nhắc việc hằng ngày). */
function donThongBaoCu() {
  var moc = Date.now() - GIU_THONG_BAO_NGAY * 864e5;
  var ds = docBang('ThongBao');
  var con = ds.filter(function (t) { return new Date(t.ThoiGian).getTime() >= moc; });
  if (con.length < ds.length) ghiDeBang('ThongBao', con);
}

/** Đảm bảo có lịch nhắc việc hằng ngày (dù chưa có bot Zalo). */
function damBaoLichNhac() {
  if (!coLichNhac()) caiLichNhac(caiDatNhacZalo().gioNhac);
}

/* ---------- Gọi từ ECODesk ---------- */

/** Cách nhận thông báo của chính mình (BOD, ban nhân sự). */
function layThongBaoCuaToi(phien) {
  var tk = canDangNhap(phien, 'task');
  var toi = nguoiNhanThongBao().filter(function (n) { return n.email.toLowerCase() === String(tk.Email).toLowerCase(); })[0];
  return {
    email: String(tk.Email), cach: toi ? toi.cach : ['zalo'], soMay: toi ? toi.soMay : 0,
    zalo: trangThaiZaloCuaToi(String(tk.HoVaTen)), khoaCong: khoaVapid().cong
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
  var con = docBang('ThietBi').filter(function (t) { return String(t.DiaChi) !== diaChi; });
  con.push({ Email: String(tk.Email), DiaChi: diaChi, Khoa: khoa, TenMay: String(tb.tenMay || '').slice(0, 80), ThoiGian: new Date(), LayCuoi: new Date() });
  ghiDeBang('ThietBi', con);
  var cach = chuanHoaCachNhan(tk.NhanThongBao);
  if (cach.indexOf('app') < 0) { cach.push('app'); ghiCotTaiKhoan(String(tk.Email), 'NhanThongBao', chuanHoaCachNhan(cach).join(',')); }
  damBaoLichNhac();
  return layThongBaoCuaToi(phien);
}

/** Gửi thử một thông báo cho chính mình theo các cách đã chọn. */
function guiThuThongBaoCuaToi(phien) {
  var tk = canDangNhap(phien, 'task');
  var toi = nguoiNhanThongBao().filter(function (n) { return n.email.toLowerCase() === String(tk.Email).toLowerCase(); })[0];
  if (!toi) throw new Error('Chỉ BOD và ban nhân sự nhận thông báo.');
  var duoc = guiThongBao(toi, 'Thông báo thử', 'ECODesk: đây là thông báo thử. Bạn sẽ nhận nhắc việc theo cách này.');
  if (!duoc) throw new Error('Chưa gửi được theo cách nào. Kiểm tra Zalo đã kết nối hoặc máy đã bật thông báo chưa.');
  return duoc;
}

/** BOD xem mọi người đang nhận thông báo bằng cách nào. */
function layNguoiNhanThongBao(phien) {
  canDangNhap(phien, 'caidat');
  return nguoiNhanThongBao().map(function (n) {
    return { email: n.email, ten: n.ten, vaiTro: n.vaiTro, cach: n.cach, daKetNoiZalo: !!n.chatId, soMay: n.soMay };
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

/** Giao diện sáng/tối của từng người, nhớ theo tài khoản. */
function luuGiaoDien(phien, giaoDien) {
  var tk = canDangNhap(phien);
  ghiCotTaiKhoan(String(tk.Email), 'GiaoDien', ['light', 'dark'].indexOf(giaoDien) >= 0 ? giaoDien : 'auto');
  return true;
}
