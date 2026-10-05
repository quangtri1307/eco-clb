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

  var tk = timTaiKhoan_(email);
  if (!tk || bamMatKhau_(String(matKhau || ''), String(tk.Muoi)) !== String(tk.MatKhau)) {
    cache.put(khoaDem, String(soLanSai + 1), 900);
    throw new Error('Email hoặc mật khẩu không đúng.');
  }
  cache.remove(khoaDem);
  return taoPhien_(tk);
}

function taoPhien_(tk) {
  donPhienHetHan_();
  var phien = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('phien_' + phien, JSON.stringify({
    email: String(tk.Email).toLowerCase(), hetHan: Date.now() + THOI_HAN_PHIEN_NGAY * 864e5
  }));
  return { phien: phien, nguoiDung: thongTinNguoiDung_(tk) };
}

/**
 * Đăng nhập bằng Google (chỉ có khi mở ECODesk qua trang vỏ cài trên điện thoại/máy tính).
 * Trang vỏ lấy mã xác nhận (ID token) từ Google; ở đây hỏi lại Google để chắc mã thật, đúng ứng dụng của CLB.
 */
function dangNhapGoogle(idToken) {
  var clientId = String(layCaiDat_('GoogleClientId') || '');
  if (!clientId) throw new Error('CLB chưa bật đăng nhập bằng Google.');
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(String(idToken || '')), { muteHttpExceptions: true });
  var info = null;
  try { info = JSON.parse(res.getContentText()); } catch (e) { info = null; }
  var loi = kiemTraTokenGoogle_(res.getResponseCode() === 200 ? info : null, clientId, Math.floor(Date.now() / 1000));
  if (loi) throw new Error(loi);
  var tk = timTaiKhoan_(info.email);
  if (!tk) throw new Error('Email ' + info.email + ' chưa có tài khoản ECODesk.');
  return taoPhien_(tk);
}

function dangXuat(phien) {
  PropertiesService.getScriptProperties().deleteProperty('phien_' + phien);
  return true;
}

/** Mở app: người dùng và trang chào trong một lần hỏi máy chủ (mở nhanh hơn). Phiên hết hạn thì trả về null. */
function moDesk(phien) {
  var u = layNguoiDung_(phien);
  if (!u) return null;
  return { nguoiDung: u, trangChu: layTrangChu(phien) };
}

/** Trả về người dùng của phiên, hoặc null nếu phiên hết hạn. Mỗi lần mở app thì gia hạn phiên. */
function layNguoiDung_(phien) {
  var u = docPhien_(phien);
  if (!u) return null;
  var props = PropertiesService.getScriptProperties();
  try {
    var p = JSON.parse(props.getProperty('phien_' + phien));
    if (p.hetHan - Date.now() < (THOI_HAN_PHIEN_NGAY - 1) * 864e5) {
      p.hetHan = Date.now() + THOI_HAN_PHIEN_NGAY * 864e5;
      props.setProperty('phien_' + phien, JSON.stringify(p));
    }
  } catch (e) { /* không gia hạn được thì thôi */ }
  return thongTinNguoiDung_(u);
}

function doiMatKhau(phien, matKhauCu, matKhauMoi) {
  var tk = canDangNhap_(phien);
  if (bamMatKhau_(String(matKhauCu || ''), String(tk.Muoi)) !== String(tk.MatKhau)) throw new Error('Mật khẩu hiện tại không đúng.');
  var loi = kiemTraMatKhauMoi_(matKhauMoi);
  if (loi) throw new Error(loi);
  ghiMatKhau_(tk.Email, matKhauMoi);
  return true;
}

function thongTinNguoiDung_(tk) {
  var vaiTro = String(tk.VaiTro);
  var gd = String(tk.GiaoDien || '');
  return { email: String(tk.Email), ten: String(tk.HoVaTen), vaiTro: vaiTro, chucVu: vaiTro === 'BOD' ? chucVuCua_(tk) : '', maHr: vaiTro === 'HR' ? String(tk.MaHr || '').trim() : '', gmail: vaiTro === 'BOD' ? linkGmail_('#inbox') : '', giaoDien: ['light', 'dark'].indexOf(gd) >= 0 ? gd : 'auto' };
}

/** Chức vụ ghi trong danh sách thành viên (tìm theo email, rồi theo họ tên). */
function chucVuCua_(tk) {
  var e = String(tk.Email).toLowerCase(), ten = String(tk.HoVaTen).toLowerCase();
  var ds = docBang_('ThanhVien');
  var tv = ds.filter(function (t) { return String(t.Email).toLowerCase() === e; })[0] || ds.filter(function (t) { return String(t.HoVaTen).toLowerCase() === ten; })[0];
  return tv ? String(tv.ChucVu || '').trim() : '';
}

function timTaiKhoan_(email) {
  var e = String(email || '').toLowerCase();
  var ds = docBang_('TaiKhoan');
  for (var i = 0; i < ds.length; i++) if (String(ds[i].Email).toLowerCase() === e) return ds[i];
  return null;
}

function docPhien_(phien) {
  if (!phien) return null;
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('phien_' + phien);
  if (!raw) return null;
  var p = JSON.parse(raw);
  if (p.hetHan < Date.now()) { props.deleteProperty('phien_' + phien); return null; }
  return timTaiKhoan_(p.email);
}

/** Bắt buộc đăng nhập (và có quyền với chức năng, nếu nêu). Trả về tài khoản. */
function canDangNhap_(phien, chucNang) {
  var tk = docPhien_(phien);
  if (!tk) throw new Error('PHIEN_HET_HAN');
  if (chucNang && !coQuyen_(String(tk.VaiTro), chucNang)) throw new Error('Bạn không có quyền dùng chức năng này.');
  return tk;
}

function ghiMatKhau_(email, matKhau) {
  voiKhoa_(function () {
    var sh = bangDuLieu_('TaiKhoan');
    var v = sh.getDataRange().getValues();
    var td = v[0];
    var cE = td.indexOf('Email'), cM = td.indexOf('MatKhau'), cS = td.indexOf('Muoi');
    for (var r = 1; r < v.length; r++) {
      if (String(v[r][cE]).toLowerCase() === String(email).toLowerCase()) {
        var muoi = Utilities.getUuid();
        sh.getRange(r + 1, cM + 1).setValue(bamMatKhau_(String(matKhau), muoi));
        sh.getRange(r + 1, cS + 1).setValue(muoi);
        return;
      }
    }
    throw new Error('Không tìm thấy tài khoản ' + email + '.');
  });
}

/** Xoá các phiên đã hết hạn. Gọi kèm mỗi lần đăng nhập thành công là đủ, không cần lịch chạy. */
function donPhienHetHan_() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('phien_') !== 0) return;
    try { if (JSON.parse(all[k]).hetHan < Date.now()) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
  });
}

/* ===================== Cộng điểm ===================== */

function layDuLieuCongDiem(phien) {
  canDangNhap_(phien, 'congdiem');
  var ky = layKyHienTai_();
  return {
    ky: ky ? { nhiemKy: String(ky.NhiemKy), hocKy: Number(ky.HocKy) } : null,
    thanhVien: docThanhVien_().filter(khongPhaiBod_).map(function (tv) { return { ten: String(tv.HoVaTen), ban: String(tv.Ban), nhom: nhomBan_(tv.Ban) }; }),
    loai: docBang_('LoaiHoatDong').filter(loaiCongTay_).map(function (l) { return { ten: String(l.TenLoai), diem: Number(l.Diem) || 0 }; }),
    ganDay: lichSuGanDay_(ky, 30)
  };
}

function lichSuGanDay_(ky, soDong) {
  if (!ky) return [];
  return docBang_('LichSuDiem').filter(function (d) { return cungKy_(d, ky.NhiemKy, ky.HocKy); })
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
  var tk = canDangNhap_(phien, 'congdiem');
  var khoa = layKhoa_();
  try {
    var kq = taoDongCongDiem_(yeuCau, docBang_('ThanhVien').filter(khongPhaiBod_), docBang_('LoaiHoatDong').filter(loaiCongTay_), String(tk.HoVaTen), layKyHienTai_(), new Date());
    if (kq.loi) throw new Error(kq.loi);
    themDong_('LichSuDiem', kq.dong);
    xoaBoNhoTam_();
    return kq.dong.length;
  } finally {
    traKhoa_(khoa);
  }
}

/** Xoá một lần cộng nhầm, nhận diện bằng thời gian cộng và họ tên. */
function xoaDongDiem(phien, thoiGianMs, hoVaTen) {
  canDangNhap_(phien, 'congdiem');
  return voiKhoa_(function () {
    var sh = bangDuLieu_('LichSuDiem');
    var v = sh.getDataRange().getValues();
    var cT = v[0].indexOf('ThoiGian'), cN = v[0].indexOf('HoVaTen');
    for (var r = v.length - 1; r >= 1; r--) {
      if (new Date(v[r][cT]).getTime() === Number(thoiGianMs) && String(v[r][cN]) === String(hoVaTen)) {
        sh.deleteRow(r + 1);
        xoaBoNhoTam_();
        return true;
      }
    }
    throw new Error('Không tìm thấy dòng cần xoá, có thể đã bị xoá trước đó.');
  });
}

/* ===================== Góp ý ===================== */

function layGopY(phien) {
  canDangNhap_(phien, 'gopy');
  return docBangNhiemKy_('GopY', 'ThoiGian').map(function (g) {
    return { thoiGian: new Date(g.ThoiGian).getTime(), noiDung: String(g.NoiDung), daDoc: g.DaDoc === true || g.DaDoc === 'TRUE' };
  }).sort(function (a, b) { return b.thoiGian - a.thoiGian; });
}

function danhDauDaDoc(phien, thoiGianMs) {
  canDangNhap_(phien, 'gopy');
  return voiKhoa_(function () {
    var sh = bangDuLieu_('GopY');
    var v = sh.getDataRange().getValues();
    var cT = v[0].indexOf('ThoiGian'), cD = v[0].indexOf('DaDoc');
    for (var r = 1; r < v.length; r++) {
      if (new Date(v[r][cT]).getTime() === Number(thoiGianMs)) { sh.getRange(r + 1, cD + 1).setValue(true); return true; }
    }
    return false;
  });
}

/* ===================== Cài đặt ===================== */

function layCaiDatDesk(phien) {
  canDangNhap_(phien, 'caidat');
  var tv = docThanhVien_();
  return {
    loai: docBang_('LoaiHoatDong').map(function (l) { return { ten: String(l.TenLoai), diem: Number(l.Diem) || 0, congTay: loaiCongTay_(l) }; }),
    quyChe: String(layCaiDat_('QuyChe') || ''),
    baoGopY: baoGopYQuaMail_(),
    baoThuChoDuyet: batSuKien_('BaoThuChoDuyet'),
    nhac: caiDatNhacZalo_(),
    anhNen: String(layCaiDat_('AnhNenPhienBan') || ''),
    ghim: docBang_('BangGhim').map(function (g) { return { tieuDe: String(g.TieuDe), link: String(g.DuongDan) }; }),
    sapDenHanNgay: soNgaySapDenHan_(),
    mail: { cheDoUcv: cheDoXemUcv_(), soDanhBa: docBang_('DanhBa').length, soThanhVien: tv.filter(function (t) { return emailHopLe_(t.Email); }).length },
    googleClientId: String(layCaiDat_('GoogleClientId') || ''),
    chuDe: chuDeHopLe_(layCaiDat_('ChuDe')),
    formSeeding: (function () { var ch = docCauHinhSeeding_(); return { bat: !!(ch.tab && !ch.tat && coLichForm_()) }; })(),
    log: { linkMau: String(layCaiDat_('LinkMauLog') || ''), linkThuMuc: String(layCaiDat_('LinkThuMucLog') || '') },
    zalo: (function () {
      var n = dongBoNguoiNhanZalo_();
      return { coBot: !!layTokenZalo_(), daKetNoi: n.filter(function (x) { return x.chatId; }).length, tong: n.length };
    })(),
    taiKhoan: docBang_('TaiKhoan').map(function (t) { return { email: String(t.Email), ten: String(t.HoVaTen), vaiTro: String(t.VaiTro), banQuanLy: banQuanLy_(t.BanQuanLy), maHr: String(t.MaHr || '') }; }),
    thanhVien: tv.map(function (t) { return { ten: String(t.HoVaTen), ban: String(t.Ban), email: String(t.Email || '') }; })
  };
}

function luuLoaiHoatDong(phien, ds) {
  canDangNhap_(phien, 'caidat');
  var kq = chuanHoaLoaiHoatDong_(ds);
  if (kq.loi) throw new Error(kq.loi);
  ghiDeBang_('LoaiHoatDong', kq.ds);
  xoaBoNhoTam_();
  return true;
}

/** Giao diện theo mùa hoặc ngày lễ cho cả ECOBoard và ECODesk. Trống là giao diện mặc định. */
function luuChuDe(phien, ma) {
  canDangNhap_(phien, 'caidat');
  var m = chuDeHopLe_(ma);
  if (String(ma || '').trim() && !m) throw new Error('Không có giao diện này.');
  datCaiDat_('ChuDe', m);
  xoaBoNhoTam_();
  return m;
}

/** Quy chế cộng điểm là một link (thường là file Google Docs). Bỏ trống để ẩn. */
function luuQuyChe(phien, link) {
  canDangNhap_(phien, 'caidat');
  var l = String(link || '').trim();
  if (l && !linkHopLe_(l)) throw new Error('Link quy chế phải bắt đầu bằng http:// hoặc https://');
  datCaiDat_('QuyChe', l);
  xoaBoNhoTam_();
  return true;
}

/** Có báo cho BOD khi có góp ý mới không. Mặc định là có. */
function baoGopYQuaMail_() {
  return String(layCaiDat_('BaoGopYQuaMail') || '') !== 'tat';
}

function luuBaoGopY_(phien, bat) {
  canDangNhap_(phien, 'caidat');
  datCaiDat_('BaoGopYQuaMail', bat ? 'bat' : 'tat');
  return true;
}

/** Báo góp ý mới cho BOD (theo cách mỗi người chọn). Tối đa một lần mỗi 10 phút để không tốn lượt gửi trong ngày. */
function thongBaoGopYMoi_(noiDung) {
  if (!baoGopYQuaMail_()) return;
  var cache = CacheService.getScriptCache();
  if (cache.get('daBaoGopY')) return;
  cache.put('daBaoGopY', '1', 600);
  baoChoBod_('Góp ý mới', 'ECOBoard có góp ý ẩn danh mới:\n\n' + String(noiDung).slice(0, 1500) +
    '\n\nMở ECODesk, mục Góp ý để xem tất cả. Trong 10 phút tới nếu có thêm góp ý thì sẽ không báo nữa.');
}

function luuGhim(phien, ds) {
  canDangNhap_(phien, 'caidat');
  var kq = chuanHoaGhim_(ds);
  if (kq.loi) throw new Error(kq.loi);
  ghiDeBang_('BangGhim', kq.ds);
  xoaBoNhoTam_();
  return true;
}

function luuSapDenHan_(phien, soNgay) {
  canDangNhap_(phien, 'caidat');
  var n = Math.round(Number(soNgay));
  if (!(n >= 0 && n <= 30)) throw new Error('Số ngày phải từ 0 đến 30.');
  datCaiDat_('SapDenHanNgay', n);
  return true;
}

/** Cho một thành viên vào ECODesk với vai trò ban nhân sự (HR) hoặc UCV (UCV). */
function themBanNhanSu(phien, hoVaTen, matKhau, vaiTro, maHr) {
  vaiTro = vaiTro === 'UCV' ? 'UCV' : 'HR';
  canDangNhap_(phien, 'caidat');
  var tv = docBang_('ThanhVien').filter(function (t) { return String(t.HoVaTen) === String(hoVaTen); })[0];
  if (!tv) throw new Error('Không có "' + hoVaTen + '" trong danh sách thành viên.');
  var email = String(tv.Email || '').trim().toLowerCase();
  if (!email) throw new Error(hoVaTen + ' chưa có email trong danh sách thành viên.');
  if (timTaiKhoan_(email)) throw new Error(hoVaTen + ' đã có tài khoản ECODesk.');
  var loi = kiemTraMatKhauMoi_(matKhau);
  if (loi) throw new Error(loi);
  var muoi = Utilities.getUuid();
  return voiKhoa_(function () {
    if (timTaiKhoan_(email)) throw new Error(hoVaTen + ' đã có tài khoản ECODesk.'); // kiểm lại trong khoá: có thể ai đó vừa thêm
    var ma = vaiTro === 'HR' ? kiemTraMaHr_(maHr, docBang_('TaiKhoan'), email) : { ma: '', loi: '' };
    if (ma.loi) throw new Error(ma.loi);
    bangDuLieu_('TaiKhoan'); // thêm cột MaHr nếu sheet còn bản cũ
    themDong_('TaiKhoan', [{ Email: email, HoVaTen: tv.HoVaTen, VaiTro: vaiTro, MatKhau: bamMatKhau_(String(matKhau), muoi), Muoi: muoi, NgayTao: new Date(), MaHr: ma.ma }]);
    return true;
  });
}

/** Lưu mã HR và phân ban cho một tài khoản HR (danh sách nhóm ban, trống là chưa phân ban: thấy mọi task). maHr bỏ trống = không có mã. */
function luuBanQuanLy(phien, email, dsBan, maHr) {
  canDangNhap_(phien, 'caidat');
  var tk = timTaiKhoan_(email);
  if (!tk || String(tk.VaiTro) !== 'HR') throw new Error('Chỉ phân ban cho tài khoản HR.');
  bangDuLieu_('TaiKhoan'); // thêm cột BanQuanLy, MaHr nếu sheet còn bản cũ
  if (maHr !== undefined) {
    var ma = kiemTraMaHr_(maHr, docBang_('TaiKhoan'), tk.Email);
    if (ma.loi) throw new Error(ma.loi);
    ghiCotTaiKhoan_(tk.Email, 'MaHr', ma.ma);
  }
  ghiCotTaiKhoan_(tk.Email, 'BanQuanLy', banQuanLy_((dsBan || []).join(',')).filter(function (b) { return BAN_HR_QUAN_LY.indexOf(b) >= 0; }).join(', '));
  return true;
}

/** Gỡ tài khoản ban nhân sự hoặc UCV. Tài khoản BOD đi theo danh sách thành viên nên không gỡ ở đây. */
function goTaiKhoan(phien, email) {
  canDangNhap_(phien, 'caidat');
  var tk = timTaiKhoan_(email);
  if (!tk) throw new Error('Không tìm thấy tài khoản.');
  if (tk.VaiTro === 'BOD') throw new Error('Tài khoản BOD được cấp theo danh sách thành viên. Muốn gỡ, hãy sửa cột Ban trên sheet nguồn rồi tải lại.');
  voiKhoa_(function () {
    ghiDeBang_('TaiKhoan', docBang_('TaiKhoan').filter(function (t) { return String(t.Email).toLowerCase() !== String(email).toLowerCase(); }));
  });
  return true;
}

function datLaiMatKhau(phien, email, matKhauMoi) {
  canDangNhap_(phien, 'caidat');
  var loi = kiemTraMatKhauMoi_(matKhauMoi);
  if (loi) throw new Error(loi);
  ghiMatKhau_(email, matKhauMoi);
  return true;
}

/* ===================== Task ===================== */

var GIU_TASK_DA_KET_THUC_NGAY = 120;

/** Ngày hôm nay theo giờ Việt Nam, dạng yyyy-MM-dd. */
function homNay_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** Ô ngày trong sheet có thể là kiểu ngày hoặc chữ; đưa về yyyy-MM-dd. */
function ngayChuoi_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  return String(v || '').slice(0, 10);
}

function soNgaySapDenHan_() {
  var n = layCaiDat_('SapDenHanNgay');
  return n === null || n === '' ? 2 : Number(n);
}

/** Quyền với task của tài khoản đang đăng nhập (theo vai trò, ban HR được phân, chức vụ BOD). */
function quyenTaskCua_(tk) {
  var banCua = {};
  docBang_('ThanhVien').forEach(function (t) { banCua[String(t.HoVaTen)] = String(t.Ban); });
  return quyenTask_(tk, String(tk.VaiTro) === 'BOD' ? chucVuCua_(tk) : '', banCua);
}

function kiemTraDuocGiao_(q, ten) {
  if (!q.sua(ten)) throw new Error('Bạn không có quyền với task của ' + ten + '. ' + (q.moTa || ''));
}

/** Đọc toàn bộ task kèm trạng thái đã tính. */
function docTask_() {
  var hom = homNay_(), sap = soNgaySapDenHan_();
  return docBangNhiemKy_('Task', 'ThoiGianTao').map(function (t) {
    var han = ngayChuoi_(t.HanChot);
    var luu = String(t.TrangThai || TRANG_THAI_TASK.GIAO);
    return {
      thoiGianTao: new Date(t.ThoiGianTao).getTime(), ten: String(t.TenTask), moTa: String(t.MoTa || ''), hanChot: han,
      nguoi: String(t.NguoiPhuTrach), nguoiTao: String(t.NguoiTao), kieuTao: String(t.KieuTao),
      trangThaiLuu: luu, trangThai: trangThaiTask_(luu, han, hom, sap),
      thoiGianXong: t.ThoiGianXong ? new Date(t.ThoiGianXong).getTime() : null
    };
  });
}

function layDuLieuTask(phien) {
  var tk = canDangNhap_(phien, 'task');
  var moc = Date.now() - GIU_TASK_DA_KET_THUC_NGAY * 864e5;
  var q = quyenTaskCua_(tk);
  var ds = docTask_().filter(function (t) {
    if (!q.xem(t.nguoi)) return false;
    if (t.trangThaiLuu !== TRANG_THAI_TASK.XONG && t.trangThaiLuu !== TRANG_THAI_TASK.HUY) return true;
    return (t.thoiGianXong || t.thoiGianTao) >= moc;
  }).map(function (t) { t.sua = q.sua(t.nguoi); return t; })
    .sort(function (a, b) { return a.hanChot < b.hanChot ? -1 : a.hanChot > b.hanChot ? 1 : b.thoiGianTao - a.thoiGianTao; });
  return {
    homNay: homNay_(),
    sapDenHanNgay: soNgaySapDenHan_(),
    task: ds,
    thanhVien: docThanhVien_().filter(function (tv) { return q.sua(tv.HoVaTen); }).map(function (tv) { return { ten: String(tv.HoVaTen), ban: String(tv.Ban), nhom: nhomBan_(tv.Ban) }; }),
    phamVi: q.moTa,
    thongBao: (function () {
      var toi = nguoiNhanThongBao_().filter(function (n) { return n.email.toLowerCase() === String(tk.Email).toLowerCase(); })[0];
      return toi ? { cach: toi.cach } : null;
    })()
  };
}

function taoTask(phien, yeuCau) {
  var tk = canDangNhap_(phien, 'task');
  var q = quyenTaskCua_(tk);
  ((yeuCau && yeuCau.nguoi) || []).forEach(function (n) { kiemTraDuocGiao_(q, n); });
  var khoa = layKhoa_();
  var kq;
  try {
    kq = taoDongTask_(yeuCau, docBang_('ThanhVien'), String(tk.HoVaTen), String(tk.VaiTro), new Date());
    if (kq.loi) throw new Error(kq.loi);
    themDong_('Task', kq.dong);
  } finally {
    traKhoa_(khoa);
  }
  baoTaskMoiChoBod_(kq.dong, String(tk.HoVaTen));
  return kq.dong.length;
}

/** Tìm dòng task theo thời gian tạo và người phụ trách. Trả về số dòng trong sheet (tính từ 1). */
function timDongTask_(v, thoiGianTao, nguoi) {
  var cT = v[0].indexOf('ThoiGianTao'), cN = v[0].indexOf('NguoiPhuTrach');
  for (var r = 1; r < v.length; r++) {
    if (new Date(v[r][cT]).getTime() === Number(thoiGianTao) && String(v[r][cN]) === String(nguoi)) return r + 1;
  }
  throw new Error('Không tìm thấy task, có thể người khác vừa sửa. Bạn tải lại trang nhé.');
}

/** Sửa tên, mô tả, hạn chót hoặc người phụ trách của một task. */
function suaTask(phien, thoiGianTao, nguoiCu, moi) {
  var q = quyenTaskCua_(canDangNhap_(phien, 'task'));
  kiemTraDuocGiao_(q, nguoiCu);
  kiemTraDuocGiao_(q, moi && moi.nguoi);
  var k = kiemTraTask_({ ten: moi && moi.ten, moTa: moi && moi.moTa, hanChot: moi && moi.hanChot, nguoi: [moi && moi.nguoi] }, docBang_('ThanhVien'));
  if (k.loi) throw new Error(k.loi);
  var khoa = layKhoa_();
  try {
    var sh = bangDuLieu_('Task');
    var v = sh.getDataRange().getValues();
    var dong = timDongTask_(v, thoiGianTao, nguoiCu);
    var td = v[0];
    var gia = v[dong - 1].slice();
    gia[td.indexOf('TenTask')] = k.ten;
    gia[td.indexOf('MoTa')] = k.moTa;
    gia[td.indexOf('HanChot')] = k.hanChot;
    gia[td.indexOf('NguoiPhuTrach')] = k.nguoi[0];
    sh.getRange(dong, 1, 1, td.length).setValues([gia]);
  } finally {
    traKhoa_(khoa);
  }
  return true;
}

/** Đánh dấu Đã xong, Đã huỷ, hoặc mở lại (Đã giao). */
function doiTrangThaiTask(phien, thoiGianTao, nguoi, trangThai) {
  kiemTraDuocGiao_(quyenTaskCua_(canDangNhap_(phien, 'task')), nguoi);
  if ([TRANG_THAI_TASK.XONG, TRANG_THAI_TASK.HUY, TRANG_THAI_TASK.GIAO].indexOf(trangThai) < 0) throw new Error('Trạng thái không hợp lệ.');
  return voiKhoa_(function () {
    var sh = bangDuLieu_('Task');
    var v = sh.getDataRange().getValues();
    var dong = timDongTask_(v, thoiGianTao, nguoi);
    var td = v[0];
    sh.getRange(dong, td.indexOf('TrangThai') + 1).setValue(trangThai);
    sh.getRange(dong, td.indexOf('ThoiGianXong') + 1).setValue(trangThai === TRANG_THAI_TASK.GIAO ? '' : new Date());
    return true;
  });
}

function luuGoogleClientId(phien, clientId) {
  canDangNhap_(phien, 'caidat');
  var id = String(clientId || '').trim();
  if (id && !/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(id)) throw new Error('Mã Client ID chưa đúng dạng. Mã đúng kết thúc bằng .apps.googleusercontent.com');
  datCaiDat_('GoogleClientId', id);
  return true;
}

/* ===================== Ảnh nền trang đăng nhập ===================== */

/** BOD tải ảnh nền (JPEG đã thu nhỏ trên máy, dạng base64). Chuỗi rỗng nghĩa là bỏ ảnh nền. */
function luuAnhNen(phien, base64) {
  canDangNhap_(phien, 'caidat');
  var b = String(base64 || '').replace(/^data:image\/\w+;base64,/, '');
  if (b.length > 4 * 1048576) throw new Error('Ảnh lớn quá. Bạn chọn ảnh khác nhé.');
  var cu = String(layCaiDat_('AnhNenId') || '');
  var moi = '';
  if (b) {
    var thuMuc = thuMucAnhNen_();
    moi = thuMuc.createFile(Utilities.newBlob(Utilities.base64Decode(b), 'image/jpeg', 'Ảnh nền đăng nhập.jpg')).getId();
  }
  datCaiDat_('AnhNenId', moi);
  datCaiDat_('AnhNenPhienBan', moi ? String(Date.now()) : '');
  if (cu) { try { DriveApp.getFileById(cu).setTrashed(true); } catch (e) { /* đã xoá */ } }
  return String(layCaiDat_('AnhNenPhienBan') || '');
}

function thuMucAnhNen_() {
  var id = layCaiDat_('ThuMucAnhNenId');
  if (id) { try { return DriveApp.getFolderById(String(id)); } catch (e) { /* bị xoá thì tạo lại */ } }
  var f = DriveApp.createFolder('ECO - Ảnh nền ECODesk');
  datCaiDat_('ThuMucAnhNenId', f.getId());
  return f;
}

/** Trang đăng nhập hỏi ảnh nền (không cần đăng nhập). Máy đã có đúng bản thì không gửi lại ảnh. */
function layAnhNen(phienBanCo) {
  var pb = String(layCaiDat_('AnhNenPhienBan') || '');
  if (!pb || pb === String(phienBanCo || '')) return { phienBan: pb };
  var id = String(layCaiDat_('AnhNenId') || '');
  try { return { phienBan: pb, data: 'data:image/jpeg;base64,' + Utilities.base64Encode(DriveApp.getFileById(id).getBlob().getBytes()) }; }
  catch (e) { return { phienBan: '' }; }
}

/* ===================== Trang chào ===================== */

/** Tóm tắt cho trang chào, tuỳ vai trò. */
function layTrangChu(phien) {
  var tk = canDangNhap_(phien);
  var vaiTro = String(tk.VaiTro), ten = String(tk.HoVaTen);
  var kq = { vaiTro: vaiTro };
  if (vaiTro === 'BOD' || vaiTro === 'HR') {
    var dsTask = docTask_().filter(function (t) { return t.trangThai !== TRANG_THAI_TASK.XONG && t.trangThai !== TRANG_THAI_TASK.HUY; });
    var dem = function (ds) {
      return { dangLam: ds.length, sap: ds.filter(function (t) { return t.trangThai === TRANG_THAI_TASK.SAP; }).length, tre: ds.filter(function (t) { return t.trangThai === TRANG_THAI_TASK.TRE; }).length };
    };
    kq.taskCuaToi = dem(dsTask.filter(function (t) { return t.nguoi === ten; }));
    if (vaiTro === 'HR') {
      var bod = {};
      docBang_('TaiKhoan').forEach(function (t) { if (t.VaiTro === 'BOD') bod[String(t.HoVaTen)] = true; });
      var q = quyenTaskCua_(tk);
      kq.taskThanhVien = dem(dsTask.filter(function (t) { return !bod[t.nguoi] && q.sua(t.nguoi); }));
    }
  }
  if (vaiTro === 'BOD') {
    kq.choDuyet = docBangNhiemKy_('ViecMail', 'ThoiGian').filter(function (v) { return String(v.TrangThai) === TRANG_THAI_VIEC.CHO; }).length;
    kq.gopYMoi = docBangNhiemKy_('GopY', 'ThoiGian').filter(function (g) { return !(g.DaDoc === true || g.DaDoc === 'TRUE'); }).length;
  }
  if (vaiTro === 'UCV') {
    var thu = docBangNhiemKy_('ViecMail', 'ThoiGian').filter(function (v) { return String(v.NguoiTao) === ten; });
    var demThu = function (st) { return thu.filter(function (v) { return String(v.TrangThai) === st; }).length; };
    kq.thu = { nhap: demThu(TRANG_THAI_VIEC.NHAP), cho: demThu(TRANG_THAI_VIEC.CHO), sua: demThu(TRANG_THAI_VIEC.SUA), duyet: demThu(TRANG_THAI_VIEC.DUYET) };
  }
  var toi = nguoiNhanThongBao_().filter(function (n) { return n.email.toLowerCase() === String(tk.Email).toLowerCase(); })[0];
  kq.thongBao = toi ? { cach: toi.cach, soMay: toi.soMay, daKetNoiZalo: !!toi.chatId } : null;
  return kq;
}
