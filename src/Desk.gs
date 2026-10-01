/**
 * Máy chủ ECODesk: đăng nhập, phân quyền và các chức năng cho BOD, ban nhân sự, ứng cử viên.
 * Mọi hàm gọi từ giao diện đều nhận "phien" (mã phiên đăng nhập) làm tham số đầu tiên.
 */

var THOI_HAN_PHIEN_NGAY = 30;
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
  donPhienHetHan();
  var phien = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('phien_' + phien, JSON.stringify({
    email: email, hetHan: Date.now() + THOI_HAN_PHIEN_NGAY * 864e5
  }));
  return { phien: phien, nguoiDung: thongTinNguoiDung(tk) };
}

function dangXuat(phien) {
  PropertiesService.getScriptProperties().deleteProperty('phien_' + phien);
  return true;
}

/** Trả về người dùng của phiên, hoặc null nếu phiên hết hạn. */
function layNguoiDung(phien) {
  var u = docPhien(phien);
  return u ? thongTinNguoiDung(u) : null;
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
  return { email: String(tk.Email), ten: String(tk.HoVaTen), vaiTro: String(tk.VaiTro) };
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
    thanhVien: docBang('ThanhVien').map(function (tv) { return { ten: String(tv.HoVaTen), ban: String(tv.Ban), nhom: nhomBan(tv.Ban) }; }),
    loai: docBang('LoaiHoatDong').map(function (l) { return { ten: String(l.TenLoai), diem: Number(l.Diem) || 0 }; }),
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
    var kq = taoDongCongDiem(yeuCau, docBang('ThanhVien'), docBang('LoaiHoatDong'), String(tk.HoVaTen), layKyHienTai(), new Date());
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
    loai: docBang('LoaiHoatDong').map(function (l) { return { ten: String(l.TenLoai), diem: Number(l.Diem) || 0 }; }),
    quyChe: String(layCaiDat('QuyChe') || ''),
    ghim: docBang('BangGhim').map(function (g) { return { tieuDe: String(g.TieuDe), link: String(g.DuongDan) }; }),
    sapDenHanNgay: Number(layCaiDat('SapDenHanNgay') || 2),
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

function luuQuyChe(phien, noiDung) {
  canDangNhap(phien, 'caidat');
  datCaiDat('QuyChe', String(noiDung || '').slice(0, 20000));
  xoaBoNhoTam();
  return true;
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

/** Cho một thành viên vào ECODesk với vai trò ban nhân sự. */
function themBanNhanSu(phien, hoVaTen, matKhau) {
  canDangNhap(phien, 'caidat');
  var tv = docBang('ThanhVien').filter(function (t) { return String(t.HoVaTen) === String(hoVaTen); })[0];
  if (!tv) throw new Error('Không có "' + hoVaTen + '" trong danh sách thành viên.');
  var email = String(tv.Email || '').trim().toLowerCase();
  if (!email) throw new Error(hoVaTen + ' chưa có email trong danh sách thành viên.');
  if (timTaiKhoan(email)) throw new Error(hoVaTen + ' đã có tài khoản ECODesk.');
  var loi = kiemTraMatKhauMoi(matKhau);
  if (loi) throw new Error(loi);
  var muoi = Utilities.getUuid();
  themDong('TaiKhoan', [{ Email: email, HoVaTen: tv.HoVaTen, VaiTro: 'HR', MatKhau: bamMatKhau(String(matKhau), muoi), Muoi: muoi, NgayTao: new Date() }]);
  return true;
}

/** Gỡ tài khoản ban nhân sự hoặc ứng cử viên. Tài khoản BOD đi theo danh sách thành viên nên không gỡ ở đây. */
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
