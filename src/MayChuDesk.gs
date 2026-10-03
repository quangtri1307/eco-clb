/**
 * Máy chủ ECODesk: đăng nhập, phân quyền và các chức năng cho BOD, ban nhân sự, UCV.
 * Mọi hàm gọi từ giao diện đều nhận "phien" (mã phiên đăng nhập) làm tham số đầu tiên.
 */

var THOI_HAN_PHIEN_NGAY = 60; // Ghi nhớ đăng nhập: mỗi lần mở ECODesk, hạn được kéo dài thêm 60 ngày.
var GIOI_HAN_SAI_MAT_KHAU = 8;

/* ===================== Đăng nhập ===================== */

function dangNhap(email, matKhau) {
  email = String(email || '').trim().toLowerCase();
  var cache = CacheService.getScriptCache();
  var khoaDem = 'sai_' + email;
  var soLanSai = Number(cache.get(khoaDem) || 0);
  if (soLanSai >= GIOI_HAN_SAI_MAT_KHAU) throw new Error('Sai mật khẩu quá nhiều lần. Bạn thử lại sau 15 phút.');

  var tk = timTaiKhoan(email);
  if (!tk || bamMatKhau(String(matKhau || ''), String(tk.Muoi)) !== String(tk.MatKhau)) {
    cache.put(khoaDem, String(soLanSai + 1), 900);
    throw new Error('Email hoặc mật khẩu không đúng.');
  }
  cache.remove(khoaDem);
  return taoPhien(tk);
}

function taoPhien(tk) {
  donPhienHetHan();
  var phien = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('phien_' + phien, JSON.stringify({
    email: String(tk.Email).toLowerCase(), hetHan: Date.now() + THOI_HAN_PHIEN_NGAY * 864e5
  }));
  return { phien: phien, nguoiDung: thongTinNguoiDung(tk) };
}

/**
 * Đăng nhập bằng Google (chỉ có khi mở ECODesk qua trang vỏ cài trên điện thoại/máy tính).
 * Trang vỏ lấy mã xác nhận (ID token) từ Google; ở đây hỏi lại Google để chắc mã thật, đúng ứng dụng của CLB.
 */
function dangNhapGoogle(idToken) {
  var clientId = String(layCaiDat('GoogleClientId') || '');
  if (!clientId) throw new Error('CLB chưa bật đăng nhập bằng Google.');
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(String(idToken || '')), { muteHttpExceptions: true });
  var info = null;
  try { info = JSON.parse(res.getContentText()); } catch (e) { info = null; }
  var loi = kiemTraTokenGoogle(res.getResponseCode() === 200 ? info : null, clientId, Math.floor(Date.now() / 1000));
  if (loi) throw new Error(loi);
  var tk = timTaiKhoan(info.email);
  if (!tk) throw new Error('Email ' + info.email + ' chưa có tài khoản ECODesk.');
  return taoPhien(tk);
}

function dangXuat(phien) {
  PropertiesService.getScriptProperties().deleteProperty('phien_' + phien);
  return true;
}

/** Trả về người dùng của phiên, hoặc null nếu phiên hết hạn. Mỗi lần mở app thì gia hạn phiên. */
function layNguoiDung(phien) {
  var u = docPhien(phien);
  if (!u) return null;
  var props = PropertiesService.getScriptProperties();
  try {
    var p = JSON.parse(props.getProperty('phien_' + phien));
    if (p.hetHan - Date.now() < (THOI_HAN_PHIEN_NGAY - 1) * 864e5) {
      p.hetHan = Date.now() + THOI_HAN_PHIEN_NGAY * 864e5;
      props.setProperty('phien_' + phien, JSON.stringify(p));
    }
  } catch (e) { /* không gia hạn được thì thôi */ }
  return thongTinNguoiDung(u);
}

function doiMatKhau(phien, matKhauCu, matKhauMoi) {
  var tk = canDangNhap(phien);
  if (bamMatKhau(String(matKhauCu || ''), String(tk.Muoi)) !== String(tk.MatKhau)) throw new Error('Mật khẩu hiện tại không đúng.');
  var loi = kiemTraMatKhauMoi(matKhauMoi);
  if (loi) throw new Error(loi);
  ghiMatKhau(tk.Email, matKhauMoi);
  return true;
}

function thongTinNguoiDung(tk) {
  var vaiTro = String(tk.VaiTro);
  var gd = String(tk.GiaoDien || '');
  return { email: String(tk.Email), ten: String(tk.HoVaTen), vaiTro: vaiTro, chucVu: vaiTro === 'BOD' ? chucVuCua(tk) : '', gmail: vaiTro === 'BOD' ? linkGmail('#inbox') : '', giaoDien: ['light', 'dark'].indexOf(gd) >= 0 ? gd : 'auto' };
}

/** Chức vụ ghi trong danh sách thành viên (tìm theo email, rồi theo họ tên). */
function chucVuCua(tk) {
  var e = String(tk.Email).toLowerCase(), ten = String(tk.HoVaTen).toLowerCase();
  var ds = docBang('ThanhVien');
  var tv = ds.filter(function (t) { return String(t.Email).toLowerCase() === e; })[0] || ds.filter(function (t) { return String(t.HoVaTen).toLowerCase() === ten; })[0];
  return tv ? String(tv.ChucVu || '').trim() : '';
}

function timTaiKhoan(email) {
  var e = String(email || '').toLowerCase();
  var ds = docBang('TaiKhoan');
  for (var i = 0; i < ds.length; i++) if (String(ds[i].Email).toLowerCase() === e) return ds[i];
  return null;
}

function docPhien(phien) {
  if (!phien) return null;
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('phien_' + phien);
  if (!raw) return null;
  var p = JSON.parse(raw);
  if (p.hetHan < Date.now()) { props.deleteProperty('phien_' + phien); return null; }
  return timTaiKhoan(p.email);
}

/** Bắt buộc đăng nhập (và có quyền với chức năng, nếu nêu). Trả về tài khoản. */
function canDangNhap(phien, chucNang) {
  var tk = docPhien(phien);
  if (!tk) throw new Error('PHIEN_HET_HAN');
  if (chucNang && !coQuyen(String(tk.VaiTro), chucNang)) throw new Error('Bạn không có quyền dùng chức năng này.');
  return tk;
}

function ghiMatKhau(email, matKhau) {
  var sh = bangDuLieu('TaiKhoan');
  var v = sh.getDataRange().getValues();
  var td = v[0];
  var cE = td.indexOf('Email'), cM = td.indexOf('MatKhau'), cS = td.indexOf('Muoi');
  for (var r = 1; r < v.length; r++) {
    if (String(v[r][cE]).toLowerCase() === String(email).toLowerCase()) {
      var muoi = Utilities.getUuid();
      sh.getRange(r + 1, cM + 1).setValue(bamMatKhau(String(matKhau), muoi));
      sh.getRange(r + 1, cS + 1).setValue(muoi);
      return;
    }
  }
  throw new Error('Không tìm thấy tài khoản ' + email + '.');
}

/** Xoá các phiên đã hết hạn. Gọi kèm mỗi lần đăng nhập thành công là đủ, không cần lịch chạy. */
function donPhienHetHan() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('phien_') !== 0) return;
    try { if (JSON.parse(all[k]).hetHan < Date.now()) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
  });
}

/* ===================== Cộng điểm ===================== */

function layDuLieuCongDiem(phien) {
  canDangNhap(phien, 'congdiem');
  var ky = layKyHienTai();
  return {
    ky: ky ? { nhiemKy: String(ky.NhiemKy), hocKy: Number(ky.HocKy) } : null,
    thanhVien: docBang('ThanhVien').filter(khongPhaiBod).map(function (tv) { return { ten: String(tv.HoVaTen), ban: String(tv.Ban), nhom: nhomBan(tv.Ban) }; }),
    loai: docBang('LoaiHoatDong').filter(loaiCongTay).map(function (l) { return { ten: String(l.TenLoai), diem: Number(l.Diem) || 0 }; }),
    ganDay: lichSuGanDay(ky, 30)
  };
}

function lichSuGanDay(ky, soDong) {
  if (!ky) return [];
  return docBang('LichSuDiem').filter(function (d) { return cungKy(d, ky.NhiemKy, ky.HocKy); })
    .map(function (d) {
      return {
        thoiGian: new Date(d.ThoiGian).getTime(), ten: String(d.HoVaTen), loai: String(d.LoaiHoatDong),
        tenHoatDong: String(d.TenHoatDong || ''), diem: Number(d.Diem) || 0, nguoiCong: String(d.NguoiCong)
      };
    })
    .sort(function (a, b) { return b.thoiGian - a.thoiGian; })
    .slice(0, soDong);
}

function congDiem(phien, yeuCau) {
  var tk = canDangNhap(phien, 'congdiem');
  var khoa = LockService.getScriptLock();
  khoa.waitLock(30000);
  try {
    var kq = taoDongCongDiem(yeuCau, docBang('ThanhVien').filter(khongPhaiBod), docBang('LoaiHoatDong').filter(loaiCongTay), String(tk.HoVaTen), layKyHienTai(), new Date());
    if (kq.loi) throw new Error(kq.loi);
    themDong('LichSuDiem', kq.dong);
    xoaBoNhoTam();
    return kq.dong.length;
  } finally {
    khoa.releaseLock();
  }
}

/** Xoá một lần cộng nhầm, nhận diện bằng thời gian cộng và họ tên. */
function xoaDongDiem(phien, thoiGianMs, hoVaTen) {
  canDangNhap(phien, 'congdiem');
  var sh = bangDuLieu('LichSuDiem');
  var v = sh.getDataRange().getValues();
  var cT = v[0].indexOf('ThoiGian'), cN = v[0].indexOf('HoVaTen');
  for (var r = v.length - 1; r >= 1; r--) {
    if (new Date(v[r][cT]).getTime() === Number(thoiGianMs) && String(v[r][cN]) === String(hoVaTen)) {
      sh.deleteRow(r + 1);
      xoaBoNhoTam();
      return true;
    }
  }
  throw new Error('Không tìm thấy dòng cần xoá, có thể đã bị xoá trước đó.');
}

/* ===================== Góp ý ===================== */

function layGopY(phien) {
  canDangNhap(phien, 'gopy');
  return docBang('GopY').map(function (g) {
    return { thoiGian: new Date(g.ThoiGian).getTime(), noiDung: String(g.NoiDung), daDoc: g.DaDoc === true || g.DaDoc === 'TRUE' };
  }).sort(function (a, b) { return b.thoiGian - a.thoiGian; });
}

function danhDauDaDoc(phien, thoiGianMs) {
  canDangNhap(phien, 'gopy');
  var sh = bangDuLieu('GopY');
  var v = sh.getDataRange().getValues();
  var cT = v[0].indexOf('ThoiGian'), cD = v[0].indexOf('DaDoc');
  for (var r = 1; r < v.length; r++) {
    if (new Date(v[r][cT]).getTime() === Number(thoiGianMs)) { sh.getRange(r + 1, cD + 1).setValue(true); return true; }
  }
  return false;
}

/* ===================== Cài đặt ===================== */

function layCaiDatDesk(phien) {
  canDangNhap(phien, 'caidat');
  var tv = docBang('ThanhVien');
  return {
    loai: docBang('LoaiHoatDong').map(function (l) { return { ten: String(l.TenLoai), diem: Number(l.Diem) || 0, congTay: loaiCongTay(l) }; }),
    quyChe: String(layCaiDat('QuyChe') || ''),
    baoGopY: baoGopYQuaMail(),
    baoThuChoDuyet: batSuKien('BaoThuChoDuyet'),
    nhac: caiDatNhacZalo(),
    anhNen: String(layCaiDat('AnhNenPhienBan') || ''),
    ghim: docBang('BangGhim').map(function (g) { return { tieuDe: String(g.TieuDe), link: String(g.DuongDan) }; }),
    sapDenHanNgay: soNgaySapDenHan(),
    mail: { cheDoUcv: cheDoXemUcv(), soDanhBa: docBang('DanhBa').length, soThanhVien: tv.filter(function (t) { return emailHopLe(t.Email); }).length },
    googleClientId: String(layCaiDat('GoogleClientId') || ''),
    log: { linkMau: String(layCaiDat('LinkMauLog') || ''), linkThuMuc: String(layCaiDat('LinkThuMucLog') || '') },
    zalo: (function () {
      var n = dongBoNguoiNhanZalo();
      return { coBot: !!layTokenZalo(), daKetNoi: n.filter(function (x) { return x.chatId; }).length, tong: n.length };
    })(),
    taiKhoan: docBang('TaiKhoan').map(function (t) { return { email: String(t.Email), ten: String(t.HoVaTen), vaiTro: String(t.VaiTro) }; }),
    thanhVien: tv.map(function (t) { return { ten: String(t.HoVaTen), ban: String(t.Ban), email: String(t.Email || '') }; })
  };
}

function luuLoaiHoatDong(phien, ds) {
  canDangNhap(phien, 'caidat');
  var kq = chuanHoaLoaiHoatDong(ds);
  if (kq.loi) throw new Error(kq.loi);
  ghiDeBang('LoaiHoatDong', kq.ds);
  xoaBoNhoTam();
  return true;
}

/** Quy chế cộng điểm là một link (thường là file Google Docs). Bỏ trống để ẩn. */
function luuQuyChe(phien, link) {
  canDangNhap(phien, 'caidat');
  var l = String(link || '').trim();
  if (l && !linkHopLe(l)) throw new Error('Link quy chế phải bắt đầu bằng http:// hoặc https://');
  datCaiDat('QuyChe', l);
  xoaBoNhoTam();
  return true;
}

/** Có báo cho BOD khi có góp ý mới không. Mặc định là có. */
function baoGopYQuaMail() {
  return String(layCaiDat('BaoGopYQuaMail') || '') !== 'tat';
}

function luuBaoGopY(phien, bat) {
  canDangNhap(phien, 'caidat');
  datCaiDat('BaoGopYQuaMail', bat ? 'bat' : 'tat');
  return true;
}

/** Báo góp ý mới cho BOD (theo cách mỗi người chọn). Tối đa một lần mỗi 10 phút để không tốn lượt gửi trong ngày. */
function thongBaoGopYMoi(noiDung) {
  if (!baoGopYQuaMail()) return;
  var cache = CacheService.getScriptCache();
  if (cache.get('daBaoGopY')) return;
  cache.put('daBaoGopY', '1', 600);
  baoChoBod('Góp ý mới', 'ECOBoard có góp ý ẩn danh mới:\n\n' + String(noiDung).slice(0, 1500) +
    '\n\nMở ECODesk, mục Góp ý để xem tất cả. Trong 10 phút tới nếu có thêm góp ý thì sẽ không báo nữa.');
}

function luuGhim(phien, ds) {
  canDangNhap(phien, 'caidat');
  var kq = chuanHoaGhim(ds);
  if (kq.loi) throw new Error(kq.loi);
  ghiDeBang('BangGhim', kq.ds);
  xoaBoNhoTam();
  return true;
}

function luuSapDenHan(phien, soNgay) {
  canDangNhap(phien, 'caidat');
  var n = Math.round(Number(soNgay));
  if (!(n >= 0 && n <= 30)) throw new Error('Số ngày phải từ 0 đến 30.');
  datCaiDat('SapDenHanNgay', n);
  return true;
}

/** Cho một thành viên vào ECODesk với vai trò ban nhân sự (HR) hoặc UCV (UCV). */
function themBanNhanSu(phien, hoVaTen, matKhau, vaiTro) {
  vaiTro = vaiTro === 'UCV' ? 'UCV' : 'HR';
  canDangNhap(phien, 'caidat');
  var tv = docBang('ThanhVien').filter(function (t) { return String(t.HoVaTen) === String(hoVaTen); })[0];
  if (!tv) throw new Error('Không có "' + hoVaTen + '" trong danh sách thành viên.');
  var email = String(tv.Email || '').trim().toLowerCase();
  if (!email) throw new Error(hoVaTen + ' chưa có email trong danh sách thành viên.');
  if (timTaiKhoan(email)) throw new Error(hoVaTen + ' đã có tài khoản ECODesk.');
  var loi = kiemTraMatKhauMoi(matKhau);
  if (loi) throw new Error(loi);
  var muoi = Utilities.getUuid();
  themDong('TaiKhoan', [{ Email: email, HoVaTen: tv.HoVaTen, VaiTro: vaiTro, MatKhau: bamMatKhau(String(matKhau), muoi), Muoi: muoi, NgayTao: new Date() }]);
  return true;
}

/** Gỡ tài khoản ban nhân sự hoặc UCV. Tài khoản BOD đi theo danh sách thành viên nên không gỡ ở đây. */
function goTaiKhoan(phien, email) {
  canDangNhap(phien, 'caidat');
  var tk = timTaiKhoan(email);
  if (!tk) throw new Error('Không tìm thấy tài khoản.');
  if (tk.VaiTro === 'BOD') throw new Error('Tài khoản BOD được cấp theo danh sách thành viên. Muốn gỡ, hãy sửa cột Ban trên sheet nguồn rồi tải lại.');
  ghiDeBang('TaiKhoan', docBang('TaiKhoan').filter(function (t) { return String(t.Email).toLowerCase() !== String(email).toLowerCase(); }));
  return true;
}

function datLaiMatKhau(phien, email, matKhauMoi) {
  canDangNhap(phien, 'caidat');
  var loi = kiemTraMatKhauMoi(matKhauMoi);
  if (loi) throw new Error(loi);
  ghiMatKhau(email, matKhauMoi);
  return true;
}

/* ===================== Task ===================== */

var GIU_TASK_DA_KET_THUC_NGAY = 120;

/** Ngày hôm nay theo giờ Việt Nam, dạng yyyy-MM-dd. */
function homNay() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** Ô ngày trong sheet có thể là kiểu ngày hoặc chữ; đưa về yyyy-MM-dd. */
function ngayChuoi(v) {
  if (v instanceof Date) return Utilities.formatDate(v, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  return String(v || '').slice(0, 10);
}

function soNgaySapDenHan() {
  var n = layCaiDat('SapDenHanNgay');
  return n === null || n === '' ? 2 : Number(n);
}

/** Đọc toàn bộ task kèm trạng thái đã tính. */
function docTask() {
  var hom = homNay(), sap = soNgaySapDenHan();
  return docBang('Task').map(function (t) {
    var han = ngayChuoi(t.HanChot);
    var luu = String(t.TrangThai || TRANG_THAI_TASK.GIAO);
    return {
      thoiGianTao: new Date(t.ThoiGianTao).getTime(), ten: String(t.TenTask), moTa: String(t.MoTa || ''), hanChot: han,
      nguoi: String(t.NguoiPhuTrach), nguoiTao: String(t.NguoiTao), kieuTao: String(t.KieuTao),
      trangThaiLuu: luu, trangThai: trangThaiTask(luu, han, hom, sap),
      thoiGianXong: t.ThoiGianXong ? new Date(t.ThoiGianXong).getTime() : null
    };
  });
}

function layDuLieuTask(phien) {
  var tk = canDangNhap(phien, 'task');
  var moc = Date.now() - GIU_TASK_DA_KET_THUC_NGAY * 864e5;
  var ds = docTask().filter(function (t) {
    if (t.trangThaiLuu !== TRANG_THAI_TASK.XONG && t.trangThaiLuu !== TRANG_THAI_TASK.HUY) return true;
    return (t.thoiGianXong || t.thoiGianTao) >= moc;
  }).sort(function (a, b) { return a.hanChot < b.hanChot ? -1 : a.hanChot > b.hanChot ? 1 : b.thoiGianTao - a.thoiGianTao; });
  return {
    homNay: homNay(),
    sapDenHanNgay: soNgaySapDenHan(),
    task: ds,
    thanhVien: docBang('ThanhVien').map(function (tv) { return { ten: String(tv.HoVaTen), ban: String(tv.Ban), nhom: nhomBan(tv.Ban) }; }),
    thongBao: (function () {
      var toi = nguoiNhanThongBao().filter(function (n) { return n.email.toLowerCase() === String(tk.Email).toLowerCase(); })[0];
      return toi ? { cach: toi.cach } : null;
    })()
  };
}

function taoTask(phien, yeuCau) {
  var tk = canDangNhap(phien, 'task');
  var khoa = LockService.getScriptLock();
  khoa.waitLock(30000);
  var kq;
  try {
    kq = taoDongTask(yeuCau, docBang('ThanhVien'), String(tk.HoVaTen), String(tk.VaiTro), new Date());
    if (kq.loi) throw new Error(kq.loi);
    themDong('Task', kq.dong);
  } finally {
    khoa.releaseLock();
  }
  baoTaskMoiChoBod(kq.dong, String(tk.HoVaTen));
  return kq.dong.length;
}

/** Tìm dòng task theo thời gian tạo và người phụ trách. Trả về số dòng trong sheet (tính từ 1). */
function timDongTask(v, thoiGianTao, nguoi) {
  var cT = v[0].indexOf('ThoiGianTao'), cN = v[0].indexOf('NguoiPhuTrach');
  for (var r = 1; r < v.length; r++) {
    if (new Date(v[r][cT]).getTime() === Number(thoiGianTao) && String(v[r][cN]) === String(nguoi)) return r + 1;
  }
  throw new Error('Không tìm thấy task, có thể người khác vừa sửa. Bạn tải lại trang nhé.');
}

/** Sửa tên, mô tả, hạn chót hoặc người phụ trách của một task. */
function suaTask(phien, thoiGianTao, nguoiCu, moi) {
  canDangNhap(phien, 'task');
  var k = kiemTraTask({ ten: moi && moi.ten, moTa: moi && moi.moTa, hanChot: moi && moi.hanChot, nguoi: [moi && moi.nguoi] }, docBang('ThanhVien'));
  if (k.loi) throw new Error(k.loi);
  var khoa = LockService.getScriptLock();
  khoa.waitLock(30000);
  try {
    var sh = bangDuLieu('Task');
    var v = sh.getDataRange().getValues();
    var dong = timDongTask(v, thoiGianTao, nguoiCu);
    var td = v[0];
    var gia = v[dong - 1].slice();
    gia[td.indexOf('TenTask')] = k.ten;
    gia[td.indexOf('MoTa')] = k.moTa;
    gia[td.indexOf('HanChot')] = k.hanChot;
    gia[td.indexOf('NguoiPhuTrach')] = k.nguoi[0];
    sh.getRange(dong, 1, 1, td.length).setValues([gia]);
  } finally {
    khoa.releaseLock();
  }
  return true;
}

/** Đánh dấu Đã xong, Đã huỷ, hoặc mở lại (Đã giao). */
function doiTrangThaiTask(phien, thoiGianTao, nguoi, trangThai) {
  canDangNhap(phien, 'task');
  if ([TRANG_THAI_TASK.XONG, TRANG_THAI_TASK.HUY, TRANG_THAI_TASK.GIAO].indexOf(trangThai) < 0) throw new Error('Trạng thái không hợp lệ.');
  var sh = bangDuLieu('Task');
  var v = sh.getDataRange().getValues();
  var dong = timDongTask(v, thoiGianTao, nguoi);
  var td = v[0];
  sh.getRange(dong, td.indexOf('TrangThai') + 1).setValue(trangThai);
  sh.getRange(dong, td.indexOf('ThoiGianXong') + 1).setValue(trangThai === TRANG_THAI_TASK.GIAO ? '' : new Date());
  return true;
}

function luuGoogleClientId(phien, clientId) {
  canDangNhap(phien, 'caidat');
  var id = String(clientId || '').trim();
  if (id && !/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(id)) throw new Error('Mã Client ID chưa đúng dạng. Mã đúng kết thúc bằng .apps.googleusercontent.com');
  datCaiDat('GoogleClientId', id);
  return true;
}

/* ===================== Ảnh nền trang đăng nhập ===================== */

/** BOD tải ảnh nền (JPEG đã thu nhỏ trên máy, dạng base64). Chuỗi rỗng nghĩa là bỏ ảnh nền. */
function luuAnhNen(phien, base64) {
  canDangNhap(phien, 'caidat');
  var b = String(base64 || '').replace(/^data:image\/\w+;base64,/, '');
  if (b.length > 4 * 1048576) throw new Error('Ảnh lớn quá. Bạn chọn ảnh khác nhé.');
  var cu = String(layCaiDat('AnhNenId') || '');
  var moi = '';
  if (b) {
    var thuMuc = thuMucAnhNen();
    moi = thuMuc.createFile(Utilities.newBlob(Utilities.base64Decode(b), 'image/jpeg', 'Ảnh nền đăng nhập.jpg')).getId();
  }
  datCaiDat('AnhNenId', moi);
  datCaiDat('AnhNenPhienBan', moi ? String(Date.now()) : '');
  if (cu) { try { DriveApp.getFileById(cu).setTrashed(true); } catch (e) { /* đã xoá */ } }
  return String(layCaiDat('AnhNenPhienBan') || '');
}

function thuMucAnhNen() {
  var id = layCaiDat('ThuMucAnhNenId');
  if (id) { try { return DriveApp.getFolderById(String(id)); } catch (e) { /* bị xoá thì tạo lại */ } }
  var f = DriveApp.createFolder('ECO - Ảnh nền ECODesk');
  datCaiDat('ThuMucAnhNenId', f.getId());
  return f;
}

/** Trang đăng nhập hỏi ảnh nền (không cần đăng nhập). Máy đã có đúng bản thì không gửi lại ảnh. */
function layAnhNen(phienBanCo) {
  var pb = String(layCaiDat('AnhNenPhienBan') || '');
  if (!pb || pb === String(phienBanCo || '')) return { phienBan: pb };
  var id = String(layCaiDat('AnhNenId') || '');
  try { return { phienBan: pb, data: 'data:image/jpeg;base64,' + Utilities.base64Encode(DriveApp.getFileById(id).getBlob().getBytes()) }; }
  catch (e) { return { phienBan: '' }; }
}

/* ===================== Trang chào ===================== */

/** Tóm tắt cho trang chào, tuỳ vai trò. */
function layTrangChu(phien) {
  var tk = canDangNhap(phien);
  var vaiTro = String(tk.VaiTro), ten = String(tk.HoVaTen);
  var kq = { vaiTro: vaiTro };
  if (vaiTro === 'BOD' || vaiTro === 'HR') {
    var dsTask = docTask().filter(function (t) { return t.trangThai !== TRANG_THAI_TASK.XONG && t.trangThai !== TRANG_THAI_TASK.HUY; });
    var dem = function (ds) {
      return { dangLam: ds.length, sap: ds.filter(function (t) { return t.trangThai === TRANG_THAI_TASK.SAP; }).length, tre: ds.filter(function (t) { return t.trangThai === TRANG_THAI_TASK.TRE; }).length };
    };
    kq.taskCuaToi = dem(dsTask.filter(function (t) { return t.nguoi === ten; }));
    if (vaiTro === 'HR') {
      var bod = {};
      docBang('TaiKhoan').forEach(function (t) { if (t.VaiTro === 'BOD') bod[String(t.HoVaTen)] = true; });
      kq.taskThanhVien = dem(dsTask.filter(function (t) { return !bod[t.nguoi]; }));
    }
  }
  if (vaiTro === 'BOD') {
    kq.choDuyet = docBang('ViecMail').filter(function (v) { return String(v.TrangThai) === TRANG_THAI_VIEC.CHO; }).length;
    kq.gopYMoi = docBang('GopY').filter(function (g) { return !(g.DaDoc === true || g.DaDoc === 'TRUE'); }).length;
  }
  if (vaiTro === 'UCV') {
    var thu = docBang('ViecMail').filter(function (v) { return String(v.NguoiTao) === ten; });
    var demThu = function (st) { return thu.filter(function (v) { return String(v.TrangThai) === st; }).length; };
    kq.thu = { nhap: demThu(TRANG_THAI_VIEC.NHAP), cho: demThu(TRANG_THAI_VIEC.CHO), sua: demThu(TRANG_THAI_VIEC.SUA), duyet: demThu(TRANG_THAI_VIEC.DUYET) };
  }
  var toi = nguoiNhanThongBao().filter(function (n) { return n.email.toLowerCase() === String(tk.Email).toLowerCase(); })[0];
  kq.thongBao = toi ? { cach: toi.cach, soMay: toi.soMay, daKetNoiZalo: !!toi.chatId } : null;
  return kq;
}
