/**
 * Mail của ECODesk. Mọi thư gửi đi dưới tên tài khoản Gmail của CLB (tài khoản chủ của file dữ liệu).
 *  - UCV (UCV): đọc hộp thư tự do; mọi thao tác làm thay đổi hộp thư tạo một "việc" chờ BOD duyệt.
 *  - BOD: duyệt thư của UCV; soạn thư nháp ngay trong Gmail của CLB rồi dùng ECODesk để gửi hàng loạt
 *    (gửi ngay hoặc hẹn giờ), xem thư đã lên lịch.
 */

var THU_MUC_GMAIL = {
  'Hộp thư đến': 'in:inbox',
  'Đã gửi': 'in:sent',
  'Lưu trữ': '-in:inbox -in:sent -in:trash -in:spam -in:drafts',
  'Thư rác': 'in:spam',
  'Thùng rác': 'in:trash'
};
var SO_THU_MOI_TRANG = 30;
var TOI_DA_TEP_MB = 10;
var TOI_DA_TONG_TEP_MB = 20;

/* ===================== Dùng chung ===================== */

function cheDoXemUcv() {
  return layCaiDat('UcvXemHopThu') === 'rieng' ? 'rieng' : 'tatca';
}

/** Tên người gửi luôn là tên của tài khoản Google CLB (đổi trong cài đặt tài khoản Google). */
function tuyChonGui(them) {
  return them || {};
}

var EMAIL_CLB_ = null;
function emailClb() {
  if (EMAIL_CLB_ === null) EMAIL_CLB_ = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  return EMAIL_CLB_;
}

/** Link mở Gmail của tài khoản CLB (BOD đã đăng nhập sẵn tài khoản này trên máy). */
function linkGmail(phanSau) {
  return 'https://mail.google.com/mail/u/?authuser=' + encodeURIComponent(emailClb()) + (phanSau || '');
}

/* Chữ ký: lấy đúng chữ ký mặc định trong cài đặt Gmail của tài khoản CLB; BOD chỉ chọn có thêm vào thư UCV hay không. */
function chuKyGmail(lamMoi) {
  var bo = CacheService.getScriptCache(), khoa = 'chuKyGmail';
  if (!lamMoi) { var co = bo.get(khoa); if (co !== null) return co; }
  var html = '';
  try {
    // Gọi thẳng Gmail API bằng quyền Gmail sẵn có của GmailApp, không cần bật thêm dịch vụ hay xin thêm quyền.
    var r = UrlFetchApp.fetch('https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs', {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
    });
    var ds = r.getResponseCode() === 200 ? (JSON.parse(r.getContentText()).sendAs || []) : [];
    var chinh = ds.filter(function (s) { return s.isDefault; })[0] || ds.filter(function (s) { return s.isPrimary; })[0];
    html = chinh && chinh.signature ? String(chinh.signature) : '';
  } catch (e) { html = ''; }
  try { bo.put(khoa, html, 21600); } catch (e) { /* chữ ký quá dài để nhớ tạm thì thôi */ }
  return html;
}

/** Chữ ký đang dùng: { bat, html }. */
function layChuKy(lamMoi) {
  return { bat: String(layCaiDat('DungChuKy') || '') !== 'tat', html: chuKyGmail(lamMoi) };
}

function luuChuKy(phien, ck) {
  canDangNhap(phien, 'caidat');
  datCaiDat('DungChuKy', ck && ck.bat ? 'bat' : 'tat');
  return true;
}

/** Đọc lại chữ ký từ Gmail (sau khi sửa chữ ký trong Gmail). */
function taiLaiChuKy(phien) {
  canDangNhap(phien, 'caidat');
  return { chuKy: layChuKy(true), linkSua: linkGmail('#settings/general') };
}

/** Thư mục Drive giữ tệp đính kèm UCV tải lên (tự tạo lần đầu). */
function thuMucDinhKem() {
  var id = layCaiDat('ThuMucDinhKemId');
  if (id) { try { return DriveApp.getFolderById(String(id)); } catch (e) { /* bị xoá thì tạo lại */ } }
  var f = DriveApp.createFolder('ECO - Đính kèm mail');
  datCaiDat('ThuMucDinhKemId', f.getId());
  return f;
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ngayGioChu(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
}

/** Tóm tắt một luồng thư cho danh sách. */
function tomTatLuong(t) {
  var msgs = t.getMessages();
  var cuoi = msgs[msgs.length - 1];
  return {
    ma: t.getId(), tieuDe: t.getFirstMessageSubject() || '(không có tiêu đề)', tu: String(cuoi.getFrom()),
    ngay: t.getLastMessageDate().getTime(), soThu: msgs.length, chuaDoc: t.isUnread(),
    nhan: t.getLabels().map(function (l) { return l.getName(); }), doan: String(cuoi.getPlainBody() || '').replace(/\s+/g, ' ').slice(0, 120)
  };
}

/** Toàn bộ nội dung một luồng thư (dùng cho UCV đọc và BOD xem khi duyệt). */
function chiTietLuong(maThu) {
  var t = GmailApp.getThreadById(String(maThu));
  if (!t) throw new Error('Không tìm thấy thư, có thể đã bị xoá hẳn.');
  return {
    ma: t.getId(), tieuDe: t.getFirstMessageSubject() || '(không có tiêu đề)',
    nhan: t.getLabels().map(function (l) { return l.getName(); }),
    trongHopThu: t.isInInbox(), trongThungRac: t.isInTrash(), laThuRac: t.isInSpam(),
    thu: t.getMessages().map(function (m) {
      return {
        ma: m.getId(), tu: String(m.getFrom()), den: String(m.getTo()), cc: String(m.getCc() || ''),
        ngay: m.getDate().getTime(),
        html: String(m.getBody() || '').replace(/<script[\s\S]*?<\/script>/gi, ''),
        dinhKem: m.getAttachments({ includeInlineImages: false }).map(function (a) { return { ten: a.getName(), kichThuoc: a.getSize() }; })
      };
    })
  };
}

/** Mã các luồng thư UCV này được xem khi BOD chọn chế độ "chỉ thư của mình". */
function luongCuaUcv(ten) {
  var ds = [];
  docBang('ViecMail').forEach(function (v) {
    if (String(v.NguoiTao) === ten && String(v.TrangThai) === TRANG_THAI_VIEC.DUYET && v.MaThu && ds.indexOf(String(v.MaThu)) < 0) ds.push(String(v.MaThu));
  });
  return ds;
}

function canXemLuong(tk, maThu) {
  if (cheDoXemUcv() === 'tatca') return;
  if (luongCuaUcv(String(tk.HoVaTen)).indexOf(String(maThu)) < 0) throw new Error('Bạn chỉ được xem thư do mình gửi.');
}

/* ===================== UCV ===================== */

function layHopThu(phien, thuMuc, timKiem, batDau) {
  var tk = canDangNhap(phien, 'hopthu');
  var cheDo = cheDoXemUcv();
  var nhanGmail = GmailApp.getUserLabels().map(function (l) { return l.getName(); }).sort();
  batDau = Math.max(0, Number(batDau) || 0);
  var ds, coThem = false;
  if (cheDo === 'rieng') {
    var q = boDau(String(timKiem || '')).toLowerCase();
    ds = luongCuaUcv(String(tk.HoVaTen)).map(function (ma) {
      try { var t = GmailApp.getThreadById(ma); return t ? tomTatLuong(t) : null; } catch (e) { return null; }
    }).filter(function (x) { return x && (!q || boDau(x.tieuDe + ' ' + x.tu + ' ' + x.doan).toLowerCase().indexOf(q) >= 0); })
      .sort(function (a, b) { return b.ngay - a.ngay; });
  } else {
    var truyVan = THU_MUC_GMAIL[thuMuc] || (nhanGmail.indexOf(thuMuc) >= 0 ? 'label:"' + thuMuc.replace(/"/g, '') + '"' : THU_MUC_GMAIL['Hộp thư đến']);
    if (timKiem) truyVan += ' ' + String(timKiem).slice(0, 200);
    var luong = GmailApp.search(truyVan, batDau, SO_THU_MOI_TRANG + 1);
    coThem = luong.length > SO_THU_MOI_TRANG;
    ds = luong.slice(0, SO_THU_MOI_TRANG).map(tomTatLuong);
  }
  return { cheDo: cheDo, nhan: nhanGmail, ds: ds, coThem: coThem };
}

function docLuongThu(phien, maThu) {
  var tk = canDangNhap(phien, 'hopthu');
  canXemLuong(tk, maThu);
  return chiTietLuong(maThu);
}

function taiDinhKem(phien, maThu, maMsg, thuTu) {
  var tk = docPhien(phien);
  if (!tk) throw new Error('PHIEN_HET_HAN');
  if (coQuyen(String(tk.VaiTro), 'hopthu')) canXemLuong(tk, maThu);
  else if (!coQuyen(String(tk.VaiTro), 'duyetmail')) throw new Error('Bạn không có quyền dùng chức năng này.');
  var m = GmailApp.getMessageById(String(maMsg));
  if (!m || m.getThread().getId() !== String(maThu)) throw new Error('Không tìm thấy tệp.');
  var a = m.getAttachments({ includeInlineImages: false })[Number(thuTu)];
  if (!a) throw new Error('Không tìm thấy tệp.');
  if (a.getSize() > 8 * 1024 * 1024) throw new Error('Tệp lớn hơn 8MB, không tải qua ECODesk được.');
  return { ten: a.getName(), loai: a.getContentType(), base64: Utilities.base64Encode(a.getBytes()) };
}

function viecRaDoiTuong(v) {
  var dk = [], tc = {};
  try { dk = JSON.parse(String(v.DinhKem || '[]')); } catch (e) { dk = []; }
  try { tc = JSON.parse(String(v.TuyChon || '{}')) || {}; } catch (e) { tc = {}; }
  return {
    laHtml: !!tc.html, trichDan: tc.trichDan !== false,
    thoiGian: new Date(v.ThoiGian).getTime(), nguoiTao: String(v.NguoiTao), thaoTac: String(v.ThaoTac),
    maThu: String(v.MaThu || ''), tieuDeThu: String(v.TieuDeThu || ''), den: String(v.Den || ''), cc: String(v.Cc || ''), bcc: String(v.Bcc || ''),
    tieuDe: String(v.TieuDe || ''), noiDung: String(v.NoiDung || ''), nhan: String(v.Nhan || ''), dinhKem: dk,
    trangThai: String(v.TrangThai), ghiChu: String(v.GhiChu || ''), nguoiDuyet: String(v.NguoiDuyet || ''),
    thoiGianDuyet: v.ThoiGianDuyet ? new Date(v.ThoiGianDuyet).getTime() : null
  };
}

function layViecCuaToi(phien) {
  var tk = canDangNhap(phien, 'hopthu');
  return docBang('ViecMail').filter(function (v) { return String(v.NguoiTao) === String(tk.HoVaTen); })
    .map(viecRaDoiTuong).sort(function (a, b) { return b.thoiGian - a.thoiGian; }).slice(0, 300);
}

/**
 * UCV lưu nháp hoặc gửi BOD duyệt một việc. Sửa việc cũ (nháp hoặc cần sửa lại) khi có thoiGianCu.
 * viec: { thaoTac, maThu, den, cc, bcc, tieuDe, noiDung, nhan, tepGiu[ids], tepMoi[{ten, loai, base64}] }
 */
function luuViecMail(phien, viec, guiDuyet, thoiGianCu) {
  var tk = canDangNhap(phien, 'hopthu');
  viec = viec || {};
  var laHtml = !!viec.laHtml;
  var noiDung = laHtml ? lamSachHtml(viec.noiDung) : String(viec.noiDung || '');
  if (laHtml && !htmlSangChu(noiDung) && !/<img/i.test(noiDung)) noiDung = '';
  viec.noiDung = noiDung;
  var loi = kiemTraViecMail(viec);
  if (noiDung.length > 45000) throw new Error('Nội dung dài quá. Nếu bạn dán từ nơi khác, thử dán lại không kèm định dạng (Ctrl+Shift+V).');
  if (loi && guiDuyet) throw new Error(loi);
  if (viec.thaoTac !== THAO_TAC_MAIL.SOAN && viec.maThu) canXemLuong(tk, viec.maThu);

  var khoa = LockService.getScriptLock();
  khoa.waitLock(30000);
  try {
    var sh = bangDuLieu('ViecMail');
    var v = sh.getDataRange().getValues();
    var td = v[0];
    var dongCu = 0, dkCu = [];
    if (thoiGianCu) {
      for (var r = 1; r < v.length; r++) {
        if (new Date(v[r][td.indexOf('ThoiGian')]).getTime() === Number(thoiGianCu) && String(v[r][td.indexOf('NguoiTao')]) === String(tk.HoVaTen)) { dongCu = r + 1; break; }
      }
      if (!dongCu) throw new Error('Không tìm thấy việc cần sửa.');
      var st = String(v[dongCu - 1][td.indexOf('TrangThai')]);
      if (st !== TRANG_THAI_VIEC.NHAP && st !== TRANG_THAI_VIEC.SUA) throw new Error('Việc này đang chờ duyệt hoặc đã xử lý, không sửa được nữa.');
      try { dkCu = JSON.parse(String(v[dongCu - 1][td.indexOf('DinhKem')] || '[]')); } catch (e) { dkCu = []; }
    }
    var giu = viec.tepGiu || [];
    var dinhKem = dkCu.filter(function (f) { return giu.indexOf(f.id) >= 0; });
    var tepMoi = viec.tepMoi || [];
    if (tepMoi.length) {
      var tong = 0;
      tepMoi.forEach(function (f) {
        var n = Math.floor(String(f.base64 || '').length * 3 / 4);
        if (n > TOI_DA_TEP_MB * 1048576) throw new Error('Tệp "' + f.ten + '" lớn hơn ' + TOI_DA_TEP_MB + 'MB.');
        tong += n;
      });
      if (tong > TOI_DA_TONG_TEP_MB * 1048576) throw new Error('Tổng tệp đính kèm lớn hơn ' + TOI_DA_TONG_TEP_MB + 'MB.');
      var thuMuc = thuMucDinhKem();
      tepMoi.forEach(function (f) {
        var blob = Utilities.newBlob(Utilities.base64Decode(String(f.base64)), String(f.loai || 'application/octet-stream'), String(f.ten || 'tep'));
        dinhKem.push({ id: thuMuc.createFile(blob).getId(), ten: String(f.ten || 'tep') });
      });
    }
    var tieuDeThu = '';
    if (viec.maThu) { try { tieuDeThu = GmailApp.getThreadById(String(viec.maThu)).getFirstMessageSubject(); } catch (e) { tieuDeThu = ''; } }
    var o = {
      ThoiGian: dongCu ? v[dongCu - 1][td.indexOf('ThoiGian')] : new Date(), NguoiTao: String(tk.HoVaTen), ThaoTac: String(viec.thaoTac || THAO_TAC_MAIL.SOAN),
      MaThu: String(viec.maThu || ''), TieuDeThu: tieuDeThu, Den: tachEmail(viec.den).ds.join(', '), Cc: tachEmail(viec.cc).ds.join(', '), Bcc: tachEmail(viec.bcc).ds.join(', '),
      TieuDe: String(viec.tieuDe || '').trim().slice(0, 250), NoiDung: noiDung, Nhan: String(viec.nhan || '').trim().slice(0, 100),
      DinhKem: JSON.stringify(dinhKem), TrangThai: guiDuyet ? TRANG_THAI_VIEC.CHO : TRANG_THAI_VIEC.NHAP,
      GhiChu: dongCu ? v[dongCu - 1][td.indexOf('GhiChu')] : '', NguoiDuyet: '', ThoiGianDuyet: '',
      TuyChon: JSON.stringify({ html: laHtml, trichDan: viec.trichDan !== false })
    };
    var dong = td.map(function (c) { return o[c] === undefined ? '' : o[c]; });
    if (dongCu) sh.getRange(dongCu, 1, 1, td.length).setValues([dong]);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, td.length).setValues([dong]);
  } finally {
    khoa.releaseLock();
  }
  if (guiDuyet) baoThuChoDuyet(String(tk.HoVaTen), o.TieuDe || o.TieuDeThu);
  // Trả về để khung soạn biết việc đã lưu (lần lưu sau sẽ sửa đúng việc này, không tải tệp lên lại).
  return { thoiGian: new Date(o.ThoiGian).getTime(), dinhKem: dinhKem };
}

/** UCV xoá việc nháp hoặc việc bị trả về của mình. */
function xoaViecMail(phien, thoiGian) {
  var tk = canDangNhap(phien, 'hopthu');
  var sh = bangDuLieu('ViecMail');
  var v = sh.getDataRange().getValues();
  var td = v[0];
  for (var r = 1; r < v.length; r++) {
    if (new Date(v[r][td.indexOf('ThoiGian')]).getTime() === Number(thoiGian) && String(v[r][td.indexOf('NguoiTao')]) === String(tk.HoVaTen)) {
      var st = String(v[r][td.indexOf('TrangThai')]);
      if ([TRANG_THAI_VIEC.NHAP, TRANG_THAI_VIEC.SUA, TRANG_THAI_VIEC.TU_CHOI].indexOf(st) < 0) throw new Error('Chỉ xoá được việc nháp, cần sửa lại hoặc bị từ chối.');
      sh.deleteRow(r + 1);
      return true;
    }
  }
  throw new Error('Không tìm thấy việc cần xoá.');
}

/* ===================== BOD duyệt việc ===================== */

function layViecDuyet(phien) {
  canDangNhap(phien, 'duyetmail');
  return docBang('ViecMail').filter(function (v) { return String(v.TrangThai) !== TRANG_THAI_VIEC.NHAP; })
    .map(function (v) { var o = viecRaDoiTuong(v); o.linkThu = o.maThu ? linkLuongGmail(o.maThu) : ''; return o; }).sort(function (a, b) {
      var ca = a.trangThai === TRANG_THAI_VIEC.CHO ? 0 : 1, cb = b.trangThai === TRANG_THAI_VIEC.CHO ? 0 : 1;
      return ca - cb || b.thoiGian - a.thoiGian;
    }).slice(0, 300);
}

/** Đếm việc chờ duyệt (hiện số trên menu). */
function demViecChoDuyet(phien) {
  canDangNhap(phien, 'duyetmail');
  return docBang('ViecMail').filter(function (v) { return String(v.TrangThai) === TRANG_THAI_VIEC.CHO; }).length;
}

function xemLuongKhiDuyet(phien, maThu) {
  canDangNhap(phien, 'duyetmail');
  return chiTietLuong(maThu);
}

/** BOD quyết định: Đã duyệt (thực hiện ngay), Cần sửa lại, hoặc Từ chối. */
function duyetViecMail(phien, thoiGian, nguoiTao, quyetDinh, ghiChu) {
  var tk = canDangNhap(phien, 'duyetmail');
  if ([TRANG_THAI_VIEC.DUYET, TRANG_THAI_VIEC.SUA, TRANG_THAI_VIEC.TU_CHOI].indexOf(quyetDinh) < 0) throw new Error('Quyết định không hợp lệ.');
  var khoa = LockService.getScriptLock();
  khoa.waitLock(30000);
  var trangThai, ghi, o = {};
  try {
    var sh = bangDuLieu('ViecMail');
    var v = sh.getDataRange().getValues();
    var td = v[0], dong = 0;
    for (var r = 1; r < v.length; r++) {
      if (new Date(v[r][td.indexOf('ThoiGian')]).getTime() === Number(thoiGian) && String(v[r][td.indexOf('NguoiTao')]) === String(nguoiTao)) { dong = r + 1; break; }
    }
    if (!dong) throw new Error('Không tìm thấy việc này.');
    td.forEach(function (c, i) { o[c] = v[dong - 1][i]; });
    if (String(o.TrangThai) !== TRANG_THAI_VIEC.CHO) throw new Error('Việc này đã được xử lý rồi.');
    trangThai = quyetDinh; ghi = String(ghiChu || '').trim().slice(0, 2000);
    var maThu = String(o.MaThu || '');
    if (quyetDinh === TRANG_THAI_VIEC.DUYET) {
      try { maThu = thucHienViec(viecRaDoiTuong(o)) || maThu; }
      catch (e) { trangThai = TRANG_THAI_VIEC.LOI; ghi = (ghi ? ghi + '\n' : '') + 'Lỗi: ' + e.message; }
    }
    var set = function (c, val) { sh.getRange(dong, td.indexOf(c) + 1).setValue(val); };
    set('TrangThai', trangThai); set('GhiChu', ghi); set('NguoiDuyet', String(tk.HoVaTen)); set('ThoiGianDuyet', new Date()); set('MaThu', maThu);
    if (trangThai === TRANG_THAI_VIEC.LOI) throw new Error('Không thực hiện được: ' + ghi.split('Lỗi: ').pop());
  } finally {
    khoa.releaseLock();
  }
  baoKetQuaDuyet(o.NguoiTao, o.TieuDe || o.TieuDeThu, trangThai, ghi, String(tk.HoVaTen));
  return trangThai;
}

/** Thư cuối cùng không phải do CLB gửi (để trả lời đúng người). */
function thuDeTraLoi(t) {
  var msgs = t.getMessages(), toi = emailClb();
  for (var i = msgs.length - 1; i >= 0; i--) if (String(msgs[i].getFrom()).toLowerCase().indexOf(toi) < 0) return msgs[i];
  return msgs[msgs.length - 1];
}

function blobDinhKem(ds) {
  return (ds || []).map(function (f) { return DriveApp.getFileById(f.id).getBlob().setName(f.ten); });
}

/** Phần trích dẫn thư gốc kiểu Gmail, đặt dưới thư trả lời. */
function trichDanThu(m) {
  return '<div class="gmail_quote"><div class="gmail_attr">Vào ' + ngayGioChu(m.getDate()) + ', ' + escHtml(m.getFrom()) + ' đã viết:<br></div>' +
    '<blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex">' + m.getBody() + '</blockquote></div>';
}

/** Nội dung HTML cuối cùng của thư UCV: thân thư, chữ ký CLB (nếu bật). */
function thanThuHtml(v) {
  var than = v.laHtml ? '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">' + v.noiDung + '</div>' : chuSangHtml(v.noiDung);
  var ck = layChuKy();
  return than + (ck.bat && ck.html ? '<br><div>--</div>' + ck.html : '');
}

/** Thực hiện một việc đã được duyệt trên Gmail của CLB. Trả về mã luồng thư liên quan. */
function thucHienViec(v) {
  var T = THAO_TAC_MAIL;
  var html = thanThuHtml(v);
  var chu = htmlSangChu(html);
  var opts = tuyChonGui({ htmlBody: html });
  if (v.cc) opts.cc = v.cc;
  if (v.bcc) opts.bcc = v.bcc;
  if (v.dinhKem.length) opts.attachments = blobDinhKem(v.dinhKem);
  if (v.thaoTac === T.SOAN) {
    return GmailApp.createDraft(v.den, v.tieuDe, chu, opts).send().getThread().getId();
  }
  var t = GmailApp.getThreadById(v.maThu);
  if (!t) throw new Error('Thư gốc không còn nữa.');
  if (v.thaoTac === T.TRA_LOI || v.thaoTac === T.TRA_LOI_TAT_CA) {
    var goc = thuDeTraLoi(t);
    if (v.trichDan) opts.htmlBody = html + '<br>' + trichDanThu(goc);
    var nap = v.thaoTac === T.TRA_LOI ? goc.createDraftReply(chu, opts) : goc.createDraftReplyAll(chu, opts);
    nap.send();
    return t.getId();
  }
  if (v.thaoTac === T.CHUYEN_TIEP) {
    var cuoi = t.getMessages()[t.getMessages().length - 1];
    var dau = '<br><br>---------- Thư được chuyển tiếp ----------<br>Từ: ' + escHtml(cuoi.getFrom()) + '<br>Ngày: ' + ngayGioChu(cuoi.getDate()) +
      '<br>Tiêu đề: ' + escHtml(cuoi.getSubject()) + '<br>Tới: ' + escHtml(cuoi.getTo()) + '<br><br>';
    var fo = tuyChonGui({ htmlBody: (htmlSangChu(v.noiDung) || /<img/i.test(v.noiDung) ? html : '') + dau + cuoi.getBody(), attachments: cuoi.getAttachments().concat(opts.attachments || []) });
    if (v.cc) fo.cc = v.cc;
    if (v.bcc) fo.bcc = v.bcc;
    fo.subject = v.tieuDe || ('Fwd: ' + cuoi.getSubject());
    cuoi.forward(v.den, fo);
    return t.getId();
  }
  if (v.thaoTac === T.LUU_TRU) { t.moveToArchive(); return t.getId(); }
  if (v.thaoTac === T.VE_HOP_THU) { t.moveToInbox(); return t.getId(); }
  if (v.thaoTac === T.XOA) { t.moveToTrash(); return t.getId(); }
  if (v.thaoTac === T.THU_RAC) { t.moveToSpam(); return t.getId(); }
  if (v.thaoTac === T.GAN_NHAN) { (GmailApp.getUserLabelByName(v.nhan) || GmailApp.createLabel(v.nhan)).addToThread(t); return t.getId(); }
  if (v.thaoTac === T.BO_NHAN) { var l = GmailApp.getUserLabelByName(v.nhan); if (l) l.removeFromThread(t); return t.getId(); }
  throw new Error('Thao tác không hợp lệ.');
}

/* ===================== Thư nháp Gmail (BOD soạn trong Gmail, ECODesk chỉ tổng hợp và gửi) ===================== */

var SO_THU_NHAP_TOI_DA = 60;

function tomTatThuNhap(d) {
  var m = d.getMessage();
  var html = String(m.getBody() || '');
  return {
    ma: d.getId(), tieuDe: String(m.getSubject() || ''), den: String(m.getTo() || ''), ngay: m.getDate().getTime(),
    doan: htmlSangChu(html).replace(/\s+/g, ' ').slice(0, 160),
    choTrong: timChoTrong(String(m.getSubject() || '') + ' ' + htmlSangChu(html)),
    dinhKem: m.getAttachments({ includeInlineImages: false }).map(function (a) { return a.getName(); }),
    link: linkGmail('#drafts?compose=' + m.getId())
  };
}

/** Danh sách thư nháp trong Gmail của CLB, mới sửa trước. */
function layThuNhapGmail(phien) {
  canDangNhap(phien, 'duyetmail');
  var ds = GmailApp.getDrafts().slice(0, SO_THU_NHAP_TOI_DA).map(tomTatThuNhap);
  ds.sort(function (a, b) { return b.ngay - a.ngay; });
  return { ds: ds, linkNhap: linkGmail('#drafts'), linkMoi: linkGmail('#drafts?compose=new'), linkHopThu: linkGmail('#inbox') };
}

function xemThuNhapGmail(phien, maNhap) {
  canDangNhap(phien, 'duyetmail');
  var d = layNhap(maNhap);
  var t = tomTatThuNhap(d);
  t.html = String(d.getMessage().getBody() || '').replace(/<script[\s\S]*?<\/script>/gi, '');
  return t;
}

function layNhap(maNhap) {
  var d = null;
  try { d = GmailApp.getDraft(String(maNhap)); } catch (e) { d = null; }
  if (!d) throw new Error('Không tìm thấy thư nháp này trong Gmail của CLB, có thể đã bị xoá hoặc đã gửi.');
  return d;
}

/**
 * Lấy nội dung thư nháp để gửi: tiêu đề, HTML, tệp đính kèm và ảnh chèn trong thư.
 * Ảnh chèn trong thư (cid:) được ghép theo tên ảnh, cách Google hướng dẫn cho mail merge.
 */
function mauTuNhap(maNhap) {
  var m = layNhap(maNhap).getMessage();
  var html = String(m.getBody() || '');
  var anh = m.getAttachments({ includeInlineImages: true, includeAttachments: false });
  var theoTen = {};
  anh.forEach(function (a) { theoTen[a.getName()] = a; });
  var inline = {};
  var re = /<img[^>]*?src="cid:([^"]+)"[^>]*?alt="([^"]*)"[^>]*>/gi, x;
  while ((x = re.exec(html))) if (theoTen[x[2]]) inline[x[1]] = theoTen[x[2]];
  return { tieuDe: String(m.getSubject() || ''), html: html, dinhKem: m.getAttachments({ includeInlineImages: false }), anh: inline };
}

/* ===================== Gửi hàng loạt và hẹn giờ ===================== */

/** Dữ liệu cho bước chọn người nhận. */
function layNguonGui(phien) {
  canDangNhap(phien, 'duyetmail');
  var tv = docBang('ThanhVien').map(function (t) {
    var o = {};
    COT_THANH_VIEN.forEach(function (c) { o[c[0]] = t[c[0]] instanceof Date ? Utilities.formatDate(t[c[0]], Session.getScriptTimeZone(), 'dd/MM/yyyy') : String(t[c[0]] == null ? '' : t[c[0]]); });
    return o;
  });
  return {
    thanhVien: tv, cotThanhVien: COT_THANH_VIEN.map(function (c) { return c[0]; }),
    danhBa: danhBaThanhVien().map(function (d) { return { Nhom: d.nhom, Ten: d.ten, Email: d.email, GhiChu: d.ghiChu }; })
      .concat(docBang('DanhBa').map(function (d) { return { Nhom: String(d.Nhom || ''), Ten: String(d.Ten || ''), Email: String(d.Email || ''), GhiChu: String(d.GhiChu || '') }; })),
    conLai: MailApp.getRemainingDailyQuota()
  };
}

/** Đọc một Google Sheet bất kỳ (tài khoản CLB phải mở được) để chọn dòng gửi. */
function docSheetGui(phien, link, tenTab) {
  canDangNhap(phien, 'duyetmail');
  var ss;
  try { ss = SpreadsheetApp.openByUrl(String(link || '').trim()); } catch (e) { throw new Error('Không mở được sheet. Kiểm tra link và chia sẻ sheet cho tài khoản CLB.'); }
  var tabs = ss.getSheets().map(function (s) { return s.getName(); });
  var sh = tenTab ? ss.getSheetByName(String(tenTab)) : ss.getSheets()[0];
  if (!sh) throw new Error('Không có tab "' + tenTab + '".');
  var v = sh.getDataRange().getValues().slice(0, 2001);
  var kq = docBangNgoai(v);
  kq.dong = kq.dong.map(function (d) {
    Object.keys(d).forEach(function (k) { if (d[k] instanceof Date) d[k] = Utilities.formatDate(d[k], ss.getSpreadsheetTimeZone(), 'dd/MM/yyyy'); });
    return d;
  });
  kq.tabs = tabs; kq.tab = sh.getName(); kq.tenFile = ss.getName();
  return kq;
}

/**
 * Gửi hàng loạt từ một thư nháp Gmail. yc: { maNhap, nguoiNhan[{email, duLieu}], moTaNguon, henGio (ms, bỏ trống = gửi ngay) }.
 * Hẹn giờ thì đến giờ mới đọc thư nháp, nên sửa thư nháp trong Gmail trước giờ gửi vẫn được.
 */
function guiHangLoat(phien, yc) {
  var tk = canDangNhap(phien, 'duyetmail');
  yc = yc || {};
  var mau = mauTuNhap(yc.maNhap);
  if (yc.henGio) {
    var kt = chuanBiGuiTuNhap(mau, yc.nguoiNhan, null);
    if (kt.loi) throw new Error(kt.loi);
    var luc = new Date(Number(yc.henGio));
    if (!(luc.getTime() > Date.now() + 60000)) throw new Error('Giờ hẹn phải sau bây giờ ít nhất 1 phút.');
    var nn = JSON.stringify(yc.nguoiNhan.map(function (n) { return { email: n.email, duLieu: n.duLieu || {} }; }));
    if (nn.length > 45000) throw new Error('Danh sách người nhận quá lớn để hẹn giờ. Chia thành nhiều đợt nhỏ hơn.');
    themDong('LichGui', [{
      ThoiGianTao: new Date(), ThoiGianGui: luc, TieuDe: mau.tieuDe, NoiDung: '', NguoiNhan: nn, MaNhap: String(yc.maNhap),
      MoTaNguon: String(yc.moTaNguon || '').slice(0, 200), NguoiTao: String(tk.HoVaTen), TrangThai: 'Đã lên lịch', KetQua: ''
    }]);
    caiLichGuiThu();
    return { henGio: true, soNguoi: kt.ds.length };
  }
  var kq = chuanBiGuiTuNhap(mau, yc.nguoiNhan, MailApp.getRemainingDailyQuota());
  if (kq.loi) throw new Error(kq.loi);
  var gui = guiDanhSach(kq.ds, mau);
  return { henGio: false, daGui: gui.daGui, loi: gui.loi };
}

/** Gửi từng thư. mau (nếu có) mang theo tệp đính kèm và ảnh của thư nháp. */
function guiDanhSach(ds, mau) {
  var daGui = 0, loi = [];
  ds.forEach(function (t) {
    try {
      var o = tuyChonGui({ htmlBody: t.html || chuSangHtml(t.noiDung) });
      if (mau && mau.dinhKem.length) o.attachments = mau.dinhKem;
      if (mau && Object.keys(mau.anh).length) o.inlineImages = mau.anh;
      GmailApp.sendEmail(t.email, t.tieuDe, t.chu || t.noiDung, o);
      daGui++;
    } catch (e) { loi.push(t.email + ': ' + e.message); }
  });
  return { daGui: daGui, loi: loi };
}

function caiLichGuiThu() {
  var co = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'guiThuDaLenLich'; });
  if (!co) ScriptApp.newTrigger('guiThuDaLenLich').timeBased().everyMinutes(10).create();
}

/** Chạy tự động mỗi 10 phút: gửi các thư đã đến giờ hẹn. */
function guiThuDaLenLich() {
  var khoa = LockService.getScriptLock();
  if (!khoa.tryLock(1000)) return;
  try {
    var sh = bangDuLieu('LichGui');
    var v = sh.getDataRange().getValues(), td = v[0];
    var c = function (ten) { return td.indexOf(ten); };
    for (var r = 1; r < v.length; r++) {
      if (String(v[r][c('TrangThai')]) !== 'Đã lên lịch') continue;
      if (new Date(v[r][c('ThoiGianGui')]).getTime() > Date.now()) continue;
      sh.getRange(r + 1, c('TrangThai') + 1).setValue('Đang gửi');
      SpreadsheetApp.flush();
      var trangThai = 'Đã gửi', ketQua;
      try {
        var nn = JSON.parse(String(v[r][c('NguoiNhan')]));
        var maNhap = c('MaNhap') >= 0 ? String(v[r][c('MaNhap')] || '') : '';
        var mau = maNhap ? mauTuNhap(maNhap) : null;
        var kq = mau ? chuanBiGuiTuNhap(mau, nn, MailApp.getRemainingDailyQuota())
          : chuanBiGuiHangLoat(v[r][c('TieuDe')], v[r][c('NoiDung')], nn, MailApp.getRemainingDailyQuota());
        if (kq.loi) { trangThai = 'Lỗi'; ketQua = kq.loi; }
        else {
          var g = guiDanhSach(kq.ds, mau);
          ketQua = 'Đã gửi ' + g.daGui + '/' + kq.ds.length + (g.loi.length ? '. Lỗi: ' + g.loi.slice(0, 5).join('; ') : '');
          if (!g.daGui) trangThai = 'Lỗi';
        }
      } catch (e) { trangThai = 'Lỗi'; ketQua = e.message; }
      sh.getRange(r + 1, c('TrangThai') + 1).setValue(trangThai);
      sh.getRange(r + 1, c('KetQua') + 1).setValue(ketQua);
    }
  } finally {
    khoa.releaseLock();
  }
}

function layLichGui(phien) {
  canDangNhap(phien, 'duyetmail');
  return docBang('LichGui').map(function (l) {
    var soNguoi = 0;
    try { soNguoi = JSON.parse(String(l.NguoiNhan)).length; } catch (e) { soNguoi = 0; }
    var maNhap = String(l.MaNhap || '');
    return {
      maNhap: maNhap, linkNhap: maNhap ? linkGmail('#drafts') : '',
      thoiGianTao: new Date(l.ThoiGianTao).getTime(), thoiGianGui: new Date(l.ThoiGianGui).getTime(), tieuDe: String(l.TieuDe), noiDung: String(l.NoiDung),
      soNguoi: soNguoi, moTaNguon: String(l.MoTaNguon || ''), nguoiTao: String(l.NguoiTao), trangThai: String(l.TrangThai), ketQua: String(l.KetQua || '')
    };
  }).sort(function (a, b) { return b.thoiGianGui - a.thoiGianGui; }).slice(0, 200);
}

function timDongLich(sh, thoiGianTao) {
  var v = sh.getDataRange().getValues(), td = v[0];
  for (var r = 1; r < v.length; r++) {
    if (new Date(v[r][td.indexOf('ThoiGianTao')]).getTime() === Number(thoiGianTao)) {
      if (String(v[r][td.indexOf('TrangThai')]) !== 'Đã lên lịch') throw new Error('Thư này đã gửi hoặc đã huỷ, không sửa được nữa.');
      return { dong: r + 1, td: td, gia: v[r] };
    }
  }
  throw new Error('Không tìm thấy thư đã lên lịch.');
}

function suaLichGui(phien, thoiGianTao, moi) {
  canDangNhap(phien, 'duyetmail');
  var khoa = LockService.getScriptLock();
  khoa.waitLock(30000);
  try {
    var sh = bangDuLieu('LichGui');
    var x = timDongLich(sh, thoiGianTao);
    var luc = new Date(Number(moi.thoiGianGui));
    if (!(luc.getTime() > Date.now() + 60000)) throw new Error('Giờ hẹn phải sau bây giờ ít nhất 1 phút.');
    sh.getRange(x.dong, x.td.indexOf('ThoiGianGui') + 1).setValue(luc);
  } finally {
    khoa.releaseLock();
  }
  return true;
}

function huyLichGui(phien, thoiGianTao) {
  canDangNhap(phien, 'duyetmail');
  var khoa = LockService.getScriptLock();
  khoa.waitLock(30000);
  try {
    var sh = bangDuLieu('LichGui');
    var x = timDongLich(sh, thoiGianTao);
    sh.getRange(x.dong, x.td.indexOf('TrangThai') + 1).setValue('Đã huỷ');
  } finally {
    khoa.releaseLock();
  }
  return true;
}

/* ===================== Cài đặt mail ===================== */

function layCaiDatMail(phien) {
  canDangNhap(phien, 'caidat');
  return {
    danhBa: docBang('DanhBa').map(function (d) { return { nhom: String(d.Nhom || ''), ten: String(d.Ten || ''), email: String(d.Email || ''), ghiChu: String(d.GhiChu || '') }; }),
    thanhVien: danhBaThanhVien(),
    cheDoUcv: cheDoXemUcv(), emailClb: emailClb(),
    chuKy: layChuKy(), linkSuaChuKy: linkGmail('#settings/general')
  };
}

/** Thành viên CLB có email luôn nằm sẵn trong danh bạ (lấy từ danh sách thành viên, không cần nhập). */
function danhBaThanhVien() {
  return docBang('ThanhVien').filter(function (t) { return emailHopLe(t.Email); }).map(function (t) {
    return { nhom: 'Thành viên CLB', ten: String(t.HoVaTen), email: String(t.Email).trim(), ghiChu: String(t.Ban || '') };
  });
}

function luuDanhBa(phien, ds) {
  canDangNhap(phien, 'caidat');
  var kq = [];
  (ds || []).forEach(function (d) {
    var e = String(d.email || '').trim(), ten = String(d.ten || '').trim();
    if (!e && !ten) return;
    if (!emailHopLe(e)) throw new Error('Email của "' + (ten || e) + '" chưa đúng.');
    kq.push({ Nhom: String(d.nhom || '').trim() || 'Khác', Ten: ten || e, Email: e, GhiChu: String(d.ghiChu || '').trim() });
  });
  ghiDeBang('DanhBa', kq);
  return true;
}

function luuCaiDatMail(phien, cd) {
  canDangNhap(phien, 'caidat');
  datCaiDat('UcvXemHopThu', cd && cd.cheDoUcv === 'rieng' ? 'rieng' : 'tatca');
  return true;
}

/* ===================== Dữ liệu cho khung soạn thư của UCV ===================== */

/** Danh bạ để chọn người nhận (thành viên có email và danh bạ CLB), cùng chữ ký sẽ tự thêm. */
function layCauHinhSoan(phien) {
  canDangNhap(phien, 'hopthu');
  var ds = [];
  docBang('ThanhVien').forEach(function (t) {
    if (emailHopLe(t.Email)) ds.push({ nhom: 'Thành viên · ' + (nhomBan(t.Ban) || 'Khác'), ten: String(t.HoVaTen), email: String(t.Email).trim() });
  });
  docBang('DanhBa').forEach(function (d) {
    if (emailHopLe(d.Email)) ds.push({ nhom: String(d.Nhom || 'Danh bạ'), ten: String(d.Ten || d.Email), email: String(d.Email).trim() });
  });
  var ck = layChuKy();
  return { danhBa: ds, chuKy: ck.bat ? ck.html : '', toiDaTepMb: TOI_DA_TEP_MB, toiDaTongMb: TOI_DA_TONG_TEP_MB };
}

/** Link mở luồng thư trong Gmail CLB (cho BOD). */
function linkLuongGmail(maThu) {
  return linkGmail('#all/' + String(maThu));
}
