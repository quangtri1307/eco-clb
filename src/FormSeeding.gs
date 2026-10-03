/**
 * Form cộng điểm seeding: thành viên nộp Google Form, dán danh sách tên Facebook đã thả cảm xúc / bình luận.
 * Form được liên kết câu trả lời về chính file dữ liệu này (tab tên gì cũng được, app nhận tab theo mã nên đổi tên vẫn chạy).
 * Mỗi lần có người nộp, app dò tên với cột Tên Facebook của thành viên đang trong danh sách (gồm cả BOD) và cộng điểm.
 * Điểm mỗi lượt lấy từ bảng Loại hoạt động và mức điểm, nên cấu hình form nằm chung trang đó.
 * Câu đã xử lý được đánh dấu ở cột "ECO đã cộng" trong tab đó, nên không bao giờ cộng hai lần.
 */

/** Cấu hình lưu ở CaiDat: { tab: mã tab (sheetId), anhXa: { tên cột: tên loại hoạt động }, tat: true khi BOD tắt, baoMail: gửi mail báo về mail CLB }. */
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
    cauHinh: { tab: ch.tab ? String(ch.tab) : '', anhXa: ch.anhXa || {}, bat: !!(ch.tab && !ch.tat && coLichForm_()), baoMail: !!ch.baoMail },
    loai: docBang_('LoaiHoatDong').map(function (l) { return { ten: String(l.TenLoai), diem: Number(l.Diem) || 0 }; }),
    nhatKy: docNhatKySeeding_(),
    // Ai chưa có Tên Facebook thì form không cộng được cho người đó: hiện ra để BOD bổ sung.
    thieuFb: docBang_('ThanhVien').filter(function (t) { return String(t.HoVaTen).trim() && !chuanTenFb_(t.TenFacebook); }).map(function (t) { return String(t.HoVaTen); })
  };
}

/** Lưu và bật tự cộng. yc = { tab, anhXa: { cột: tên loại có sẵn }, congCu: true nếu cộng cả các câu đã có }. */
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
    var anhXa = {};
    cot.seeding.forEach(function (c) {
      var ten = String((yc.anhXa || {})[c.ten] || '').trim();
      if (ten && coSan[ten.toLowerCase()]) anhXa[c.ten] = ten;
    });
    if (!Object.keys(anhXa).length) throw new Error('Bạn chưa chọn loại hoạt động cho cột nào.');
    var cu = docCauHinhSeeding_();
    // Lần đầu bật cho tab này: các câu đã có từ trước được đánh dấu bỏ qua, trừ khi BOD chọn cộng luôn.
    if (String(cu.tab) !== String(yc.tab) && !yc.congCu) danhDauBoQua_(sh);
    datCaiDat_('FormSeeding', JSON.stringify({ tab: String(yc.tab), anhXa: anhXa, baoMail: !!cu.baoMail }));
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

/** Bật/tắt gửi mail báo về mail CLB mỗi lần form cộng điểm. */
function luuBaoMailSeeding(phien, bat) {
  canDangNhap_(phien, 'caidat');
  return voiKhoa_(function () {
    var ch = docCauHinhSeeding_();
    ch.baoMail = !!bat;
    datCaiDat_('FormSeeding', JSON.stringify(ch));
    return ch.baoMail;
  });
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
    var tv = docBang_('ThanhVien'), loai = docBang_('LoaiHoatDong'), ky = layKyHienTai_(), nay = new Date();
    var them = [], danhDau = [], nhat = [];
    for (var r = 1; r < v.length; r++) {
      if (String(v[r][c] == null ? '' : v[r][c]).trim()) continue;
      if (!v[r].some(function (x) { return String(x).trim(); })) continue;
      var kq = congTuFormSeeding_(v[r], cot, ch.anhXa || {}, tv, loai, ky, nay);
      if (kq.loi) return { soCau: 0, soLuot: 0, loi: kq.loi };
      them = them.concat(kq.dong);
      danhDau.push([r + 1, 'Đã cộng ' + kq.dong.length + ' lượt']);
      // Nhật ký: mỗi người được cộng kèm các cột (Reaction, Comment) đã cộng cho họ. Giữ tối đa 50 tên để vừa một ô CaiDat.
      var ten = [], cotCua = {};
      kq.dong.forEach(function (d) {
        if (!cotCua[d.HoVaTen]) { cotCua[d.HoVaTen] = []; ten.push(d.HoVaTen); }
        cotCua[d.HoVaTen].push(d.TenHoatDong);
      });
      nhat.push({
        luc: nay.getTime(), nguoiNop: kq.nguoiNop, soLuot: kq.dong.length, soNguoi: ten.length,
        duoc: ten.slice(0, 50).map(function (x) { return [x, cotCua[x].join(', ')]; }),
        khongKhop: kq.khongKhop.slice(0, 50), soKhongKhop: kq.khongKhop.length
      });
    }
    themDong_('LichSuDiem', them);
    danhDau.forEach(function (d) { sh.getRange(d[0], c + 1).setValue(d[1]); });
    if (nhat.length) {
      datCaiDat_('FormSeedingNhatKy', JSON.stringify(nhat.slice().reverse().concat(docNhatKySeeding_()).slice(0, 15)));
      xoaBoNhoTam_();
      if (ch.baoMail) { try { guiMailSeeding_(nhat); } catch (e) { /* lỗi gửi mail không ảnh hưởng việc cộng điểm */ } }
    }
    return { soCau: danhDau.length, soLuot: them.length, loi: '' };
  });
}

/** Một mail tóm tắt các lần nộp vừa cộng, gửi về chính mail CLB. */
function guiMailSeeding_(nhat) {
  var den = emailClb_();
  if (!den) return;
  var tz = Session.getScriptTimeZone();
  var luot = 0;
  var noiDung = nhat.map(function (n) {
    luot += n.soLuot;
    return 'Người nộp: ' + (n.nguoiNop || 'Không rõ') + '\nLúc: ' + Utilities.formatDate(new Date(n.luc), tz, 'dd/MM/yyyy HH:mm') +
      '\nĐược cộng (' + n.soNguoi + ' người, ' + n.soLuot + ' lượt): ' + (n.duoc.length ? n.duoc.map(function (d) { return d[0] + ' (' + d[1] + ')'; }).join(', ') + (n.soNguoi > n.duoc.length ? ', …' : '') : 'không ai') +
      (n.soKhongKhop ? '\nKhông được cộng (' + n.soKhongKhop + ' tên không khớp Tên Facebook của thành viên nào): ' + n.khongKhop.join(', ') + (n.soKhongKhop > n.khongKhop.length ? ', …' : '') : '');
  }).join('\n\n');
  guiMailThongBao_(den, 'Form seeding vừa cộng ' + luot + ' lượt', noiDung + '\n\nTắt mail này trong ECODesk: Cài đặt, Loại hoạt động và mức điểm.');
}
