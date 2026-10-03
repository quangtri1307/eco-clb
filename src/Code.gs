/**
 * Máy chủ của hệ thống quản lý CLB (Google Apps Script).
 * Script này gắn với file Google Sheet chứa dữ liệu; mỗi tab là một bảng.
 */

var GIOI_HAN_GOP_Y_MOI_PHUT = 20;

/* ===================== Trang web ===================== */

function doGet(e) {
  if (e && e.parameter && e.parameter.tb) {
    // App trên điện thoại hỏi nội dung thông báo mới.
    return ContentService.createTextOutput(JSON.stringify(layThongBaoChoMay_(e.parameter.tb))).setMimeType(ContentService.MimeType.JSON);
  }
  var app = (e && e.parameter && e.parameter.app) || 'board';
  var laDesk = app === 'desk';
  var trang = HtmlService.createTemplateFromFile(laDesk ? 'Desk' : 'Board');
  trang.googleClientId = laDesk ? String(layCaiDat_('GoogleClientId') || '') : '';
  return trang.evaluate()
    .setTitle(laDesk ? 'ECODesk' : 'ECOBoard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover')
    .setFaviconUrl('https://ecotdn.github.io/icons/tab-' + (laDesk ? 'desk' : 'board') + '.png')
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
  khoiTaoCoSoDuLieu_();
  var t = HtmlService.createTemplateFromFile('HauKy');
  t.linkNguon = layCaiDat_('LinkSheetThanhVien') || '';
  // Vé dùng một lần: chỉ người mở được menu trong file Sheet mới tải danh sách lên được.
  t.ve = Utilities.getUuid();
  CacheService.getScriptCache().put('ve_tai_danh_sach', t.ve, 3600);
  var html = t.evaluate().setWidth(460).setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(html, 'Tải danh sách lên hệ thống');
}

/**
 * Tải danh sách thành viên từ sheet nguồn vào hệ thống. Gọi từ hộp thoại hậu kỳ.
 * @param {{link:string, tenTab:string, kieu:string, matKhauMacDinh:string}} yeuCau
 */
function taiDanhSachThanhVien(yeuCau) {
  yeuCau = yeuCau || {};
  var ve = CacheService.getScriptCache().get('ve_tai_danh_sach');
  if (!ve || String(yeuCau.ve || '') !== ve) throw new Error('Hộp thoại đã cũ. Đóng lại rồi mở menu ECO hậu kỳ → Tải danh sách lên hệ thống lần nữa.');
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

  var kq = docDanhSachThanhVien_(tab.getDataRange().getValues());
  if (kq.loi.length) throw new Error(kq.loi.join('\n'));

  var bodCanCo = taiKhoanBodCanCo_(kq.thanhVien);
  var taiKhoan = docBang_('TaiKhoan');
  var emailDaCo = {};
  taiKhoan.forEach(function (tk) { emailDaCo[String(tk.Email).toLowerCase()] = true; });
  var canTaoMoi = bodCanCo.filter(function (b) { return !emailDaCo[b.Email]; });
  var matKhau = String(yeuCau.matKhauMacDinh || '');
  if (canTaoMoi.length && matKhau.length < 6) {
    throw new Error('Có ' + canTaoMoi.length + ' BOD mới cần tài khoản. Nhập mật khẩu mặc định (ít nhất 6 ký tự).');
  }

  var khoa = layKhoa_();
  try {
    var bayGio = new Date();
    var kyHienTai = layKyHienTai_();
    var kyMoi = tinhKyMoi_(kyHienTai, yeuCau.kieu, bayGio);

    // Người không còn trong danh sách mới: giữ hồ sơ đầy đủ ở tab Thành viên cũ để sau này còn tra cứu.
    var cu = capNhatThanhVienCu_(docBang_('ThanhVien'), kq.thanhVien, docBang_('ThanhVienCu'), bayGio);
    ghiDeBang_('ThanhVienCu', cu.ds);
    ghiDeBang_('ThanhVien', xepThanhVienTheoBan_(kq.thanhVien));

    if (kyMoi) {
      themDong_('KyHoatDong', [{ NhiemKy: kyMoi.NhiemKy, HocKy: kyMoi.HocKy, BatDau: bayGio, KieuTaiLen: yeuCau.kieu }]);
      themDong_('LuuTruThanhVien', kq.thanhVien.map(function (tv) {
        return { NhiemKy: kyMoi.NhiemKy, HocKy: kyMoi.HocKy, HoVaTen: tv.HoVaTen, Ban: tv.Ban };
      }));
    }

    var soTaoMoi = dongBoTaiKhoanBod_(bodCanCo, matKhau, bayGio);
    datCaiDat_('LinkSheetThanhVien', yeuCau.link);
    xoaBoNhoTam_();

    var ky = kyMoi || kyHienTai;
    return 'Đã tải ' + kq.thanhVien.length + ' thành viên (' + yeuCau.kieu + ').' +
      (ky ? ' Kỳ hiện tại: nhiệm kỳ ' + ky.NhiemKy + ', học kỳ ' + ky.HocKy + '.' : ' Chưa có kỳ hoạt động; lần đầu hãy chọn "Sau tuyển đợt 1".') +
      (soTaoMoi ? ' Đã tạo ' + soTaoMoi + ' tài khoản BOD mới.' : '') +
      (cu.soMoiRoi ? ' ' + cu.soMoiRoi + ' người không còn trong danh sách, hồ sơ đã được giữ ở tab ThanhVienCu.' : '');
  } finally {
    traKhoa_(khoa);
  }
}

/** Giữ tài khoản BOD khớp với danh sách: thêm BOD mới, gỡ quyền người không còn là BOD. */
function dongBoTaiKhoanBod_(bodCanCo, matKhau, bayGio) {
  var canCo = {};
  bodCanCo.forEach(function (b) { canCo[b.Email] = b; });
  var taiKhoan = docBang_('TaiKhoan').filter(function (tk) {
    return tk.VaiTro !== 'BOD' || canCo[String(tk.Email).toLowerCase()];
  });
  var daCo = {};
  taiKhoan.forEach(function (tk) { daCo[String(tk.Email).toLowerCase()] = true; });
  var soMoi = 0;
  bodCanCo.forEach(function (b) {
    if (daCo[b.Email]) return;
    var muoi = Utilities.getUuid();
    taiKhoan.push({ Email: b.Email, HoVaTen: b.HoVaTen, VaiTro: 'BOD', MatKhau: bamMatKhau_(matKhau, muoi), Muoi: muoi, NgayTao: bayGio });
    soMoi++;
  });
  ghiDeBang_('TaiKhoan', taiKhoan);
  return soMoi;
}

function bamMatKhau_(matKhau, muoi) {
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

  var ky = layKyHienTai_();
  var thanhVien = docThanhVien_();
  var lichSu = ky ? docBang_('LichSuDiem') : [];
  var luuTru = ky && Number(ky.HocKy) === 2 ? docBang_('LuuTruThanhVien') : [];
  var duLieu = {
    ky: ky ? { nhiemKy: String(ky.NhiemKy), hocKy: Number(ky.HocKy) } : null,
    thanhVien: tongHopBangDiem_(thanhVien.filter(khongPhaiBod_), lichSu, ky, luuTru), // BOD không tham gia cộng điểm
    loaiHoatDong: docBang_('LoaiHoatDong').map(function (l) { return { ten: String(l.TenLoai), diem: Number(l.Diem) || 0, tuDong: !loaiCongTay_(l) }; }),
    ghim: docBang_('BangGhim').filter(function (g) { return linkHopLe_(g.DuongDan); })
      .map(function (g) { return { tieuDe: String(g.TieuDe || g.DuongDan), link: String(g.DuongDan).trim() }; }),
    quyChe: String(layCaiDat_('QuyChe') || '')
  };
  cache.put('board', JSON.stringify(duLieu), 60);
  return duLieu;
}

function layLichSuBoard(ten, hocKy) {
  var ky = layKyHienTai_();
  if (!ky) return [];
  var hk = Number(hocKy) === 1 ? 1 : Number(ky.HocKy);
  var laThanhVien = docBang_('ThanhVien').some(function (tv) {
    return String(tv.HoVaTen).toLowerCase() === String(ten).toLowerCase();
  });
  if (!laThanhVien) return [];
  return lichSuCongKhai_(docBang_('LichSuDiem'), ten, ky.NhiemKy, hk);
}

function guiGopY(noiDung) {
  var loi = kiemTraGopY_(noiDung);
  if (loi) throw new Error(loi);
  var cache = CacheService.getScriptCache();
  var dem = Number(cache.get('demGopY') || 0);
  if (dem >= GIOI_HAN_GOP_Y_MOI_PHUT) throw new Error('Đang có nhiều góp ý gửi cùng lúc, bạn thử lại sau một phút nhé.');
  cache.put('demGopY', String(dem + 1), 60);
  themDong_('GopY', [{ ThoiGian: new Date(), NoiDung: String(noiDung).trim(), DaDoc: false }]);
  try { thongBaoGopYMoi_(String(noiDung).trim()); } catch (e) { /* không gửi được mail báo thì góp ý vẫn được lưu */ }
  return true;
}

/* ===================== Cơ sở dữ liệu ===================== */

/** Chọn hàm này rồi bấm Chạy trong Apps Script để cấp quyền lần đầu (hoặc khi bản mới cần thêm quyền). */
function khoiTaoCoSoDuLieu() {
  khoiTaoCoSoDuLieu_();
}

/** Tạo các tab còn thiếu, thêm cột còn thiếu, và dữ liệu mặc định. Chạy lại nhiều lần không sao. */
function khoiTaoCoSoDuLieu_() {
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
  BANG_NHO_TAM.forEach(boNhoTamBang_); // có thể vừa thêm cột: đọc lại cho đủ cột
  BO_NHO_BANG_ = {};
  if (!docBang_('LoaiHoatDong').length) {
    themDong_('LoaiHoatDong', ['Staff', 'Log', 'Tham gia hoạt động'].map(function (t) { return { TenLoai: t, Diem: 0 }; }));
  }
  var macDinh = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (macDinh && macDinh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(macDinh);
}

/** Bản cập nhật thêm tab hoặc cột mới thì tự thêm vào sheet ở lần dùng đầu tiên, không cần ai mở menu. */
var DA_KIEM_TRA_BANG_ = false;
function damBaoCauTrucBang_() {
  if (DA_KIEM_TRA_BANG_) return;
  DA_KIEM_TRA_BANG_ = true;
  var mau = JSON.stringify(BANG), kho = PropertiesService.getScriptProperties();
  if (kho.getProperty('CauTrucBang') === mau) return;
  khoiTaoCoSoDuLieu_();
  kho.setProperty('CauTrucBang', mau);
}

/** Lấy tab để ghi. Bảng này sắp đổi nên bản nhớ tạm của nó bị bỏ. */
function bangDuLieu_(ten) {
  damBaoCauTrucBang_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ten);
  if (!sh && BANG[ten]) { khoiTaoCoSoDuLieu_(); sh = ss.getSheetByName(ten); } // tab mới thêm ở bản cập nhật
  if (!sh) throw new Error('Thiếu tab ' + ten + '. Mở menu ECO hậu kỳ để khởi tạo.');
  delete BO_NHO_BANG_[ten];
  BANG_DA_GHI_[ten] = true;
  boNhoTamBang_(ten);
  return sh;
}

/**
 * Đọc cả bảng thành danh sách đối tượng.
 * Trong một lần chạy, mỗi bảng chỉ đọc từ sheet một lần. Vài bảng ít đổi (BANG_NHO_TAM) còn được nhớ tạm
 * giữa các lần chạy, để mở app nhanh hơn; ghi vào bảng nào thì bản nhớ tạm của bảng đó bị bỏ ngay.
 */
var BANG_NHO_TAM = ['CaiDat', 'TaiKhoan', 'ThanhVien', 'LoaiHoatDong'];
var GIAY_NHO_TAM = 600;
var BO_NHO_BANG_ = {};
var BANG_DA_GHI_ = {};
function docBang_(ten) {
  var chuoi = BO_NHO_BANG_[ten];
  if (chuoi === undefined) {
    var nhoTam = BANG_NHO_TAM.indexOf(ten) >= 0 && !DO_SAU_KHOA_; // đang giữ khoá để ghi thì luôn đọc thẳng từ sheet
    var bo = nhoTam ? CacheService.getScriptCache() : null, phienBan = '';
    if (nhoTam) {
      try {
        var co = bo.getAll(['bang_' + ten, 'phienban_' + ten]);
        phienBan = co['phienban_' + ten] || '0';
        var luu = co['bang_' + ten];
        if (luu && luu.indexOf(phienBan + '|') === 0) chuoi = luu.slice(phienBan.length + 1);
      } catch (e) { nhoTam = false; }
    }
    if (chuoi === undefined) {
      var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ten);
      chuoi = maHoaBang_(!sh || sh.getLastRow() < 2 ? [] : dongThanhDoiTuong_(sh.getDataRange().getValues()));
      // Ghi kèm phiên bản đã thấy trước khi đọc: nếu có người ghi chen vào giữa thì bản này tự hết hiệu lực.
      if (nhoTam) { try { bo.put('bang_' + ten, phienBan + '|' + chuoi, GIAY_NHO_TAM); } catch (e) { /* bảng lớn quá thì thôi không nhớ tạm */ } }
    }
    BO_NHO_BANG_[ten] = chuoi;
  }
  return giaiMaBang_(chuoi);
}

/** Bỏ bản nhớ tạm của một bảng (sau khi ghi, hoặc khi có người sửa tay trên sheet). */
function boNhoTamBang_(ten) {
  if (BANG_NHO_TAM.indexOf(ten) < 0) return;
  try {
    var bo = CacheService.getScriptCache();
    bo.put('phienban_' + ten, String(Date.now()) + Math.random().toString(36).slice(2, 6), 21600);
    bo.remove('bang_' + ten);
  } catch (e) { /* bản nhớ tạm tự hết hạn sau GIAY_NHO_TAM giây */ }
}

/** Có người sửa tay trên sheet: bỏ bản nhớ tạm của tab đó để app thấy ngay. */
function onEdit(e) {
  try { boNhoTamBang_(e.range.getSheet().getName()); } catch (x) { /* bỏ qua */ }
}

/** Đúng là lịch chạy tự động của dự án gọi (không phải ai đó gọi thẳng từ trang web). */
function laLichChay_(e) {
  if (!e || !e.triggerUid) return false;
  var ma = String(e.triggerUid);
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getUniqueId() === ma; });
}

/* ===================== Khoá ghi ===================== */

/**
 * Hai người bấm lưu cùng lúc thì lần lượt từng người ghi, không ai ghi đè hay chen vào dòng của người kia.
 * Cách dùng: var khoa = layKhoa_(); try { ... } finally { traKhoa_(khoa); }   hoặc   voiKhoa_(function () { ... }).
 * Gọi lồng nhau trong cùng một lần chạy vẫn được: chỉ lần ngoài cùng mới thật sự khoá.
 * khongChoDuoc = true: đang bận thì trả về false thay vì báo lỗi (dùng cho việc chạy tự động).
 */
var DO_SAU_KHOA_ = 0;
function layKhoa_(choMs, khongChoDuoc) {
  if (DO_SAU_KHOA_) { DO_SAU_KHOA_++; return null; }
  var khoa = LockService.getScriptLock();
  if (!khoa.tryLock(choMs || 30000)) {
    if (khongChoDuoc) return false;
    throw new Error('Đang có nhiều người lưu cùng lúc. Bạn đợi vài giây rồi thử lại nhé.');
  }
  DO_SAU_KHOA_ = 1;
  BO_NHO_BANG_ = {}; // đọc lại từ sheet: có thể người khác vừa ghi trước mình
  BANG_DA_GHI_ = {};
  return khoa;
}
function traKhoa_(khoa) {
  if (khoa === false) return;
  DO_SAU_KHOA_ = Math.max(0, DO_SAU_KHOA_ - 1);
  if (!khoa) return;
  try { SpreadsheetApp.flush(); } catch (e) { /* bỏ qua */ }
  Object.keys(BANG_DA_GHI_).forEach(boNhoTamBang_); // bỏ lần nữa sau khi ghi xong hẳn
  BANG_DA_GHI_ = {};
  khoa.releaseLock();
}
function voiKhoa_(viec) {
  var khoa = layKhoa_();
  try { return viec(); } finally { traKhoa_(khoa); }
}

function tieuDe_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
}

function themDong_(ten, doiTuong) {
  if (!doiTuong.length) return;
  voiKhoa_(function () {
    var sh = bangDuLieu_(ten);
    var td = tieuDe_(sh);
    var dong = doiTuong.map(function (o) { return td.map(function (c) { return o[c] === undefined ? '' : o[c]; }); });
    sh.getRange(sh.getLastRow() + 1, 1, dong.length, td.length).setValues(dong);
  });
}

/** Ghi đè cả bảng. Nếu danh sách mới lấy từ chính bảng đó thì phải đọc và ghi trong cùng một khoá (voiKhoa_). */
function ghiDeBang_(ten, doiTuong) {
  voiKhoa_(function () {
    var sh = bangDuLieu_(ten);
    var td = tieuDe_(sh);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, td.length).clearContent();
    if (!doiTuong.length) return;
    var dong = doiTuong.map(function (o) { return td.map(function (c) { return o[c] === undefined ? '' : o[c]; }); });
    sh.getRange(2, 1, dong.length, td.length).setValues(dong);
  });
}

/** Danh sách thành viên theo thứ tự ban chuẩn, dùng cho mọi chỗ hiện danh sách. */
function docThanhVien_() {
  return xepThanhVienTheoBan_(docBang_('ThanhVien'));
}

function layKyHienTai_() {
  var ds = docBang_('KyHoatDong');
  return ds.length ? ds[ds.length - 1] : null;
}

function layCaiDat_(khoa) {
  var ds = docBang_('CaiDat');
  for (var i = 0; i < ds.length; i++) if (ds[i].Khoa === khoa) return ds[i].GiaTri;
  return null;
}

function datCaiDat_(khoa, giaTri) {
  voiKhoa_(function () {
    var sh = bangDuLieu_('CaiDat');
    var v = sh.getDataRange().getValues();
    var dong = v.length + 1;
    for (var r = 1; r < v.length; r++) if (v[r][0] === khoa) { dong = r + 1; break; }
    if (dong > v.length) sh.getRange(dong, 1).setValue(khoa);
    var o = sh.getRange(dong, 2);
    // Chữ thì giữ nguyên là chữ, để sheet không tự đổi thành ngày giờ hay số.
    o.setNumberFormat(typeof giaTri === 'string' ? '@' : 'General');
    o.setValue(giaTri);
  });
}

function xoaBoNhoTam_() {
  CacheService.getScriptCache().remove('board');
}

function include(ten) {
  return HtmlService.createHtmlOutputFromFile(ten).getContent();
}
