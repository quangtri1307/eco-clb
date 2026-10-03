/**
 * Form cộng điểm seeding: thành viên nộp Google Form, dán danh sách tên Facebook đã thả cảm xúc / bình luận.
 * Form được liên kết câu trả lời về chính file dữ liệu này (tab "Câu trả lời biểu mẫu …").
 * Mỗi lần có người nộp, app dò tên với cột Tên Facebook của thành viên đang trong danh sách (không gồm BOD) và cộng điểm.
 * Câu đã xử lý được đánh dấu ở cột "ECO đã cộng" trong tab đó, nên không bao giờ cộng hai lần.
 */

/** Cấu hình lưu ở CaiDat: { tab: mã tab (sheetId), anhXa: { tên cột: tên loại hoạt động }, tat: true khi BOD tắt }. */
function docCauHinhSeeding_() {
  try { return JSON.parse(layCaiDat_('FormSeeding') || '{}') || {}; } catch (e) { return {}; }
}

function tabTheoMa_(ma) {
  var ds = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < ds.length; i++) if (String(ds[i].getSheetId()) === String(ma)) return ds[i];
  return null;
}

/** Các tab câu trả lời form trong file dữ liệu (có cột Dấu thời gian, không phải tab của hệ thống). */
function cacTabForm_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function (sh) {
    if (BANG[sh.getName()] || !sh.getLastColumn()) return null;
    var cot = cotFormSeeding_(tieuDe_(sh));
    if (cot.thoiGian < 0) return null;
    var soDong = Math.max(0, sh.getLastRow() - 1), daCong = 0;
    if (cot.daCong >= 0 && soDong) daCong = sh.getRange(2, cot.daCong + 1, soDong, 1).getValues().filter(function (r) { return String(r[0]).trim(); }).length;
    return { ma: String(sh.getSheetId()), ten: sh.getName(), cot: cot.seeding.map(function (c) { return c.ten; }), coNguoiNop: cot.nguoiNop >= 0, soCau: soDong, chuaCong: soDong - daCong };
  }).filter(Boolean);
}

function coLichForm_() {
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'khiNopForm'; });
}

function docNhatKySeeding_() {
  try { return JSON.parse(layCaiDat_('FormSeedingNhatKy') || '[]') || []; } catch (e) { return []; }
}

function layFormSeeding(phien) {
  canDangNhap_(phien, 'caidat');
  var ch = docCauHinhSeeding_();
  return {
    tabs: cacTabForm_(),
    cauHinh: { tab: ch.tab ? String(ch.tab) : '', anhXa: ch.anhXa || {}, bat: !!(ch.tab && !ch.tat && coLichForm_()) },
    loai: docBang_('LoaiHoatDong').map(function (l) { return { ten: String(l.TenLoai), diem: Number(l.Diem) || 0 }; }),
    nhatKy: docNhatKySeeding_()
  };
}

/**
 * Lưu và bật tự cộng. yc = { tab, anhXa: { cột: tên loại }, loaiMoi: [{ ten, diem }], congCu: true nếu cộng cả các câu đã có }.
 * Loại mới được tạo ở dạng chỉ hiển thị (BOD không cộng tay loại này).
 */
function luuFormSeeding(phien, yc) {
  canDangNhap_(phien, 'caidat');
  yc = yc || {};
  var sh = tabTheoMa_(yc.tab);
  if (!sh) throw new Error('Không tìm thấy tab câu trả lời. Bấm Tải lại rồi chọn lại nhé.');
  var cot = cotFormSeeding_(tieuDe_(sh));
  var kq = voiKhoa_(function () {
    var loai = docBang_('LoaiHoatDong');
    var coSan = {};
    loai.forEach(function (l) { coSan[String(l.TenLoai).toLowerCase()] = true; });
    var moi = [];
    (yc.loaiMoi || []).forEach(function (l) {
      var ten = String(l.ten || '').trim(), diem = Number(l.diem);
      if (!ten) throw new Error('Loại hoạt động mới chưa có tên.');
      if (!isFinite(diem) || diem < 0) throw new Error('Điểm của "' + ten + '" phải là số không âm.');
      if (coSan[ten.toLowerCase()]) return;
      coSan[ten.toLowerCase()] = true;
      moi.push({ TenLoai: ten, Diem: diem, CongTay: 'khong' });
    });
    themDong_('LoaiHoatDong', moi);
    var anhXa = {};
    cot.seeding.forEach(function (c) {
      var ten = String((yc.anhXa || {})[c.ten] || '').trim();
      if (ten && coSan[ten.toLowerCase()]) anhXa[c.ten] = ten;
    });
    if (!Object.keys(anhXa).length) throw new Error('Bạn chưa chọn loại hoạt động cho cột nào.');
    var cu = docCauHinhSeeding_();
    // Lần đầu bật cho tab này: các câu đã có từ trước được đánh dấu bỏ qua, trừ khi BOD chọn cộng luôn.
    if (String(cu.tab) !== String(yc.tab) && !yc.congCu) danhDauBoQua_(sh);
    datCaiDat_('FormSeeding', JSON.stringify({ tab: String(yc.tab), anhXa: anhXa }));
    if (!coLichForm_()) ScriptApp.newTrigger('khiNopForm').forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onFormSubmit().create();
    return xuLyFormSeeding_();
  });
  return kq;
}

function tatFormSeeding(phien) {
  canDangNhap_(phien, 'caidat');
  var ch = docCauHinhSeeding_();
  ch.tat = true;
  datCaiDat_('FormSeeding', JSON.stringify(ch));
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'khiNopForm') ScriptApp.deleteTrigger(t); });
  return true;
}

/** Cộng ngay các câu trả lời chưa cộng (khi lịch tự chạy bị lỡ, hoặc vừa sửa Tên Facebook của ai đó). */
function quetFormSeeding(phien) {
  canDangNhap_(phien, 'caidat');
  return xuLyFormSeeding_();
}

/** Google gọi hàm này mỗi khi có người nộp form được liên kết về file dữ liệu. */
function khiNopForm(e) {
  if (!laLichChay_(e)) return;
  var ch = docCauHinhSeeding_();
  if (!ch.tab || ch.tat) return;
  if (e.range && String(e.range.getSheet().getSheetId()) !== String(ch.tab)) return; // form khác (ví dụ form ứng tuyển)
  xuLyFormSeeding_();
}

/** Tìm hoặc thêm cột "ECO đã cộng". Trả về số thứ tự cột (bắt đầu từ 0). */
function cotDaCong_(sh) {
  var td = tieuDe_(sh), i = td.indexOf(COT_DA_CONG_FORM);
  if (i >= 0) return i;
  i = td.length;
  sh.getRange(1, i + 1).setValue(COT_DA_CONG_FORM);
  return i;
}

function danhDauBoQua_(sh) {
  var c = cotDaCong_(sh), so = sh.getLastRow() - 1;
  if (so < 1) return;
  var o = sh.getRange(2, c + 1, so, 1), v = o.getValues();
  o.setValues(v.map(function (r) { return [String(r[0]).trim() ? r[0] : 'Bỏ qua (có từ trước khi bật)']; }));
}

/** Cộng điểm cho mọi câu trả lời chưa đánh dấu. Trả về { soCau, soLuot, loi }. */
function xuLyFormSeeding_() {
  var ch = docCauHinhSeeding_();
  var sh = ch.tab ? tabTheoMa_(ch.tab) : null;
  if (!sh) return { soCau: 0, soLuot: 0, loi: 'Chưa chọn tab câu trả lời của form.' };
  return voiKhoa_(function () {
    var c = cotDaCong_(sh);
    var v = sh.getDataRange().getValues();
    var cot = cotFormSeeding_(v[0]);
    var tv = docBang_('ThanhVien').filter(khongPhaiBod_), loai = docBang_('LoaiHoatDong'), ky = layKyHienTai_(), nay = new Date();
    var them = [], danhDau = [], nhat = [];
    for (var r = 1; r < v.length; r++) {
      if (String(v[r][c] == null ? '' : v[r][c]).trim()) continue;
      if (!v[r].some(function (x) { return String(x).trim(); })) continue;
      var kq = congTuFormSeeding_(v[r], cot, ch.anhXa || {}, tv, loai, ky, nay);
      if (kq.loi) return { soCau: 0, soLuot: 0, loi: kq.loi };
      them = them.concat(kq.dong);
      danhDau.push([r + 1, 'Đã cộng ' + kq.dong.length + ' lượt']);
      var ten = [];
      kq.dong.forEach(function (d) { if (ten.indexOf(d.HoVaTen) < 0) ten.push(d.HoVaTen); });
      nhat.push({ luc: nay.getTime(), nguoiNop: kq.nguoiNop, soLuot: kq.dong.length, ten: ten.slice(0, 30), khongKhop: kq.khongKhop.slice(0, 30), soKhongKhop: kq.khongKhop.length });
    }
    themDong_('LichSuDiem', them);
    danhDau.forEach(function (d) { sh.getRange(d[0], c + 1).setValue(d[1]); });
    if (nhat.length) {
      datCaiDat_('FormSeedingNhatKy', JSON.stringify(nhat.reverse().concat(docNhatKySeeding_()).slice(0, 15)));
      xoaBoNhoTam_();
    }
    return { soCau: danhDau.length, soLuot: them.length, loi: '' };
  });
}
