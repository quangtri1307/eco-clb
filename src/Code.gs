/**
 * Máy chủ của hệ thống quản lý CLB (Google Apps Script).
 * Script này gắn với file Google Sheet chứa dữ liệu; mỗi tab là một bảng.
 */

var GIOI_HAN_GOP_Y_MOI_PHUT = 20;

/* ===================== Trang web ===================== */

function doGet(e) {
  var app = (e && e.parameter && e.parameter.app) || 'board';
  var laDesk = app === 'desk';
  return HtmlService.createTemplateFromFile(laDesk ? 'Desk' : 'Board').evaluate()
    .setTitle(laDesk ? 'ECODesk' : 'ECOBoard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ===================== Menu hậu kỳ trong Google Sheet ===================== */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ECO hậu kỳ')
    .addItem('Tải danh sách lên hệ thống', 'moHopThoaiTaiDanhSach')
    .addToUi();
}

function moHopThoaiTaiDanhSach() {
  khoiTaoCoSoDuLieu();
  var t = HtmlService.createTemplateFromFile('HauKy');
  t.linkNguon = layCaiDat('LinkSheetThanhVien') || '';
  var html = t.evaluate().setWidth(460).setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(html, 'Tải danh sách lên hệ thống');
}

/**
 * Tải danh sách thành viên từ sheet nguồn vào hệ thống. Gọi từ hộp thoại hậu kỳ.
 * @param {{link:string, tenTab:string, kieu:string, matKhauMacDinh:string}} yeuCau
 */
function taiDanhSachThanhVien(yeuCau) {
  var kieuHopLe = [KIEU_TAI.DOT1, KIEU_TAI.DOT2, KIEU_TAI.CAP_NHAT];
  if (kieuHopLe.indexOf(yeuCau.kieu) < 0) throw new Error('Kiểu tải không hợp lệ.');

  var nguon;
  try {
    nguon = SpreadsheetApp.openByUrl(String(yeuCau.link || '').trim());
  } catch (err) {
    throw new Error('Không mở được sheet nguồn. Kiểm tra lại link và quyền truy cập của tài khoản CLB.');
  }
  var tab = yeuCau.tenTab ? nguon.getSheetByName(yeuCau.tenTab) : nguon.getSheets()[0];
  if (!tab) throw new Error('Không thấy tab "' + yeuCau.tenTab + '" trong sheet nguồn.');

  var kq = docDanhSachThanhVien(tab.getDataRange().getValues());
  if (kq.loi.length) throw new Error(kq.loi.join('\n'));

  var bodCanCo = taiKhoanBodCanCo(kq.thanhVien);
  var taiKhoan = docBang('TaiKhoan');
  var emailDaCo = {};
  taiKhoan.forEach(function (tk) { emailDaCo[String(tk.Email).toLowerCase()] = true; });
  var canTaoMoi = bodCanCo.filter(function (b) { return !emailDaCo[b.Email]; });
  var matKhau = String(yeuCau.matKhauMacDinh || '');
  if (canTaoMoi.length && matKhau.length < 6) {
    throw new Error('Có ' + canTaoMoi.length + ' BOD mới cần tài khoản. Nhập mật khẩu mặc định (ít nhất 6 ký tự).');
  }

  var khoa = LockService.getScriptLock();
  khoa.waitLock(30000);
  try {
    var bayGio = new Date();
    var kyHienTai = layKyHienTai();
    var kyMoi = tinhKyMoi(kyHienTai, yeuCau.kieu, bayGio);

    ghiDeBang('ThanhVien', kq.thanhVien);

    if (kyMoi) {
      themDong('KyHoatDong', [{ NhiemKy: kyMoi.NhiemKy, HocKy: kyMoi.HocKy, BatDau: bayGio, KieuTaiLen: yeuCau.kieu }]);
      themDong('LuuTruThanhVien', kq.thanhVien.map(function (tv) {
        return { NhiemKy: kyMoi.NhiemKy, HocKy: kyMoi.HocKy, HoVaTen: tv.HoVaTen, Ban: tv.Ban };
      }));
    }

    var soTaoMoi = dongBoTaiKhoanBod(bodCanCo, matKhau, bayGio);
    datCaiDat('LinkSheetThanhVien', yeuCau.link);
    xoaBoNhoTam();

    var ky = kyMoi || kyHienTai;
    return 'Đã tải ' + kq.thanhVien.length + ' thành viên (' + yeuCau.kieu + ').' +
      (ky ? ' Kỳ hiện tại: nhiệm kỳ ' + ky.NhiemKy + ', học kỳ ' + ky.HocKy + '.' : ' Chưa có kỳ hoạt động; lần đầu hãy chọn "Sau tuyển đợt 1".') +
      (soTaoMoi ? ' Đã tạo ' + soTaoMoi + ' tài khoản BOD mới.' : '');
  } finally {
    khoa.releaseLock();
  }
}

/** Giữ tài khoản BOD khớp với danh sách: thêm BOD mới, gỡ quyền người không còn là BOD. */
function dongBoTaiKhoanBod(bodCanCo, matKhau, bayGio) {
  var canCo = {};
  bodCanCo.forEach(function (b) { canCo[b.Email] = b; });
  var taiKhoan = docBang('TaiKhoan').filter(function (tk) {
    return tk.VaiTro !== 'BOD' || canCo[String(tk.Email).toLowerCase()];
  });
  var daCo = {};
  taiKhoan.forEach(function (tk) { daCo[String(tk.Email).toLowerCase()] = true; });
  var soMoi = 0;
  bodCanCo.forEach(function (b) {
    if (daCo[b.Email]) return;
    var muoi = Utilities.getUuid();
    taiKhoan.push({ Email: b.Email, HoVaTen: b.HoVaTen, VaiTro: 'BOD', MatKhau: bamMatKhau(matKhau, muoi), Muoi: muoi, NgayTao: bayGio });
    soMoi++;
  });
  ghiDeBang('TaiKhoan', taiKhoan);
  return soMoi;
}

function bamMatKhau(matKhau, muoi) {
  var bam = muoi + ':' + matKhau;
  for (var i = 0; i < 300; i++) {
    var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bam, Utilities.Charset.UTF_8);
    bam = Utilities.base64Encode(b);
  }
  return bam;
}

/* ===================== API cho ECOBoard ===================== */

function layDuLieuBoard() {
  var cache = CacheService.getScriptCache();
  var daLuu = cache.get('board');
  if (daLuu) return JSON.parse(daLuu);

  var ky = layKyHienTai();
  var thanhVien = docBang('ThanhVien');
  var lichSu = ky ? docBang('LichSuDiem') : [];
  var luuTru = ky && Number(ky.HocKy) === 2 ? docBang('LuuTruThanhVien') : [];
  var duLieu = {
    ky: ky ? { nhiemKy: String(ky.NhiemKy), hocKy: Number(ky.HocKy) } : null,
    thanhVien: tongHopBangDiem(thanhVien, lichSu, ky, luuTru),
    loaiHoatDong: docBang('LoaiHoatDong').map(function (l) { return { ten: String(l.TenLoai), diem: Number(l.Diem) || 0 }; }),
    ghim: docBang('BangGhim').filter(function (g) { return linkHopLe(g.DuongDan); })
      .map(function (g) { return { tieuDe: String(g.TieuDe || g.DuongDan), link: String(g.DuongDan).trim() }; }),
    quyChe: String(layCaiDat('QuyChe') || '')
  };
  cache.put('board', JSON.stringify(duLieu), 60);
  return duLieu;
}

function layLichSuBoard(ten, hocKy) {
  var ky = layKyHienTai();
  if (!ky) return [];
  var hk = Number(hocKy) === 1 ? 1 : Number(ky.HocKy);
  var laThanhVien = docBang('ThanhVien').some(function (tv) {
    return String(tv.HoVaTen).toLowerCase() === String(ten).toLowerCase();
  });
  if (!laThanhVien) return [];
  return lichSuCongKhai(docBang('LichSuDiem'), ten, ky.NhiemKy, hk);
}

function guiGopY(noiDung) {
  var loi = kiemTraGopY(noiDung);
  if (loi) throw new Error(loi);
  var cache = CacheService.getScriptCache();
  var dem = Number(cache.get('demGopY') || 0);
  if (dem >= GIOI_HAN_GOP_Y_MOI_PHUT) throw new Error('Đang có nhiều góp ý gửi cùng lúc, bạn thử lại sau một phút nhé.');
  cache.put('demGopY', String(dem + 1), 60);
  themDong('GopY', [{ ThoiGian: new Date(), NoiDung: String(noiDung).trim(), DaDoc: false }]);
  return true;
}

/* ===================== Cơ sở dữ liệu ===================== */

/** Tạo các tab còn thiếu, thêm cột còn thiếu, và dữ liệu mặc định. Chạy lại nhiều lần không sao. */
function khoiTaoCoSoDuLieu() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(BANG).forEach(function (ten) {
    var sh = ss.getSheetByName(ten) || ss.insertSheet(ten);
    var cot = BANG[ten];
    var hienCo = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    var thieu = cot.filter(function (c) { return hienCo.indexOf(c) < 0; });
    if (thieu.length) {
      var batDau = hienCo.filter(String).length + 1;
      sh.getRange(1, batDau, 1, thieu.length).setValues([thieu]);
      sh.getRange(1, 1, 1, batDau + thieu.length - 1).setFontWeight('bold').setBackground('#274e13').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
  });
  if (!docBang('LoaiHoatDong').length) {
    themDong('LoaiHoatDong', ['Staff', 'Log', 'Tham gia hoạt động', 'Seeding'].map(function (t) { return { TenLoai: t, Diem: 0 }; }));
  }
  var macDinh = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (macDinh && macDinh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(macDinh);
}

function bangDuLieu(ten) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ten);
  if (!sh && BANG[ten]) { khoiTaoCoSoDuLieu(); sh = ss.getSheetByName(ten); } // tab mới thêm ở bản cập nhật
  if (!sh) throw new Error('Thiếu tab ' + ten + '. Mở menu ECO hậu kỳ để khởi tạo.');
  return sh;
}

function docBang(ten) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ten);
  if (!sh || sh.getLastRow() < 2) return [];
  return dongThanhDoiTuong(sh.getDataRange().getValues());
}

function tieuDe(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
}

function themDong(ten, doiTuong) {
  if (!doiTuong.length) return;
  var sh = bangDuLieu(ten);
  var td = tieuDe(sh);
  var dong = doiTuong.map(function (o) { return td.map(function (c) { return o[c] === undefined ? '' : o[c]; }); });
  sh.getRange(sh.getLastRow() + 1, 1, dong.length, td.length).setValues(dong);
}

function ghiDeBang(ten, doiTuong) {
  var sh = bangDuLieu(ten);
  var td = tieuDe(sh);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, td.length).clearContent();
  if (!doiTuong.length) return;
  var dong = doiTuong.map(function (o) { return td.map(function (c) { return o[c] === undefined ? '' : o[c]; }); });
  sh.getRange(2, 1, dong.length, td.length).setValues(dong);
}

function layKyHienTai() {
  var ds = docBang('KyHoatDong');
  return ds.length ? ds[ds.length - 1] : null;
}

function layCaiDat(khoa) {
  var ds = docBang('CaiDat');
  for (var i = 0; i < ds.length; i++) if (ds[i].Khoa === khoa) return ds[i].GiaTri;
  return null;
}

function datCaiDat(khoa, giaTri) {
  var sh = bangDuLieu('CaiDat');
  var v = sh.getDataRange().getValues();
  var dong = v.length + 1;
  for (var r = 1; r < v.length; r++) if (v[r][0] === khoa) { dong = r + 1; break; }
  if (dong > v.length) sh.getRange(dong, 1).setValue(khoa);
  var o = sh.getRange(dong, 2);
  // Chữ thì giữ nguyên là chữ, để sheet không tự đổi thành ngày giờ hay số.
  o.setNumberFormat(typeof giaTri === 'string' ? '@' : 'General');
  o.setValue(giaTri);
}

function xoaBoNhoTam() {
  CacheService.getScriptCache().remove('board');
}

function include(ten) {
  return HtmlService.createHtmlOutputFromFile(ten).getContent();
}
