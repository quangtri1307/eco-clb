/**
 * Nhắc việc qua bot Zalo.
 * Head HR tạo bot mỗi năm và dán mã bot vào Cài đặt. Mỗi BOD và thành viên ban nhân sự nhắn mã kết nối
 * của mình cho bot một lần, sau đó mỗi ngày bot tự gửi tin nhắc vào giờ đã chọn:
 *  - BOD nhận các task của chính mình;
 *  - ban nhân sự nhận task của các thành viên khác (không phải BOD) để nhắc lại qua Messenger.
 */

var ZALO_API = 'https://bot-api.zapps.me/bot';
var ZALO_TOI_DA_KY_TU = 2000;

/* ---------- Gọi API Zalo ---------- */

function goiZalo(token, phuongThuc, thamSo) {
  var res = UrlFetchApp.fetch(ZALO_API + token + '/' + phuongThuc, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(thamSo || {}), muteHttpExceptions: true
  });
  var kq;
  try { kq = JSON.parse(res.getContentText()); } catch (e) { kq = null; }
  if (!kq || !kq.ok) {
    var lyDo = kq && (kq.description || kq.message) ? (kq.description || kq.message) : 'mã lỗi ' + res.getResponseCode();
    var loi = new Error('Zalo báo lỗi: ' + lyDo);
    loi.maLoi = kq && kq.error_code;
    throw loi;
  }
  return kq.result;
}

function layTokenZalo() {
  return String(layCaiDat('ZaloToken') || '').trim();
}

/** Gửi một tin (tự chia nếu dài). */
function guiZalo(token, chatId, tin) {
  chiaTin(tin, ZALO_TOI_DA_KY_TU).forEach(function (phan) {
    goiZalo(token, 'sendMessage', { chat_id: String(chatId), text: phan });
  });
}

/* ---------- Người nhận và mã kết nối ---------- */

/** Mã 6 ký tự dễ đọc, không có chữ dễ nhầm như O/0, I/1. */
function taoMaKetNoi() {
  var chu = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', ma = '';
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid());
  for (var i = 0; i < 6; i++) ma += chu.charAt((bytes[i] + 256) % chu.length);
  return ma;
}

/**
 * Đảm bảo mỗi tài khoản BOD và ban nhân sự có một dòng trong tab KetNoiZalo (kèm mã kết nối).
 * Trả về danh sách người nhận: [{ ten, vaiTro, ma, chatId, tenZalo }].
 */
function dongBoNguoiNhanZalo() {
  var tk = docBang('TaiKhoan').filter(function (t) { return t.VaiTro === 'BOD' || t.VaiTro === 'HR'; });
  var ketNoi = docBang('KetNoiZalo');
  var theoTen = {};
  ketNoi.forEach(function (k) { theoTen[String(k.HoVaTen)] = k; });
  var moi = [];
  tk.forEach(function (t) {
    if (!theoTen[String(t.HoVaTen)]) {
      var dong = { HoVaTen: String(t.HoVaTen), MaKetNoi: taoMaKetNoi(), ChatId: '', TenZalo: '', ThoiGianKetNoi: '' };
      theoTen[dong.HoVaTen] = dong;
      moi.push(dong);
    }
  });
  if (moi.length) themDong('KetNoiZalo', moi);
  return tk.map(function (t) {
    var k = theoTen[String(t.HoVaTen)];
    return { ten: String(t.HoVaTen), vaiTro: String(t.VaiTro), ma: String(k.MaKetNoi), chatId: String(k.ChatId || ''), tenZalo: String(k.TenZalo || '') };
  });
}

function trangThaiZaloCuaToi(ten) {
  var coBot = !!layTokenZalo();
  var toi = dongBoNguoiNhanZalo().filter(function (n) { return n.ten === ten; })[0];
  return { coBot: coBot, tenBot: String(layCaiDat('ZaloTenBot') || ''), ma: toi ? toi.ma : '', daKetNoi: !!(toi && toi.chatId), tenZalo: toi ? toi.tenZalo : '' };
}

/**
 * Đọc các tin mới người dùng nhắn cho bot. Tin có mã kết nối thì ghi lại ID Zalo của người đó.
 * Trả về số người vừa kết nối.
 */
function nhanTinMoiZalo() {
  var token = layTokenZalo();
  if (!token) return 0;
  var nguoiNhan = dongBoNguoiNhanZalo();
  var dsMa = nguoiNhan.map(function (n) { return n.ma; });
  var soMoi = 0;
  for (var lan = 0; lan < 20; lan++) {
    var kq;
    try { kq = goiZalo(token, 'getUpdates', { timeout: 1 }); } catch (e) { break; } // hết tin mới
    var ds = Array.isArray(kq) ? kq : (kq ? [kq] : []);
    if (!ds.length) break;
    ds.forEach(function (u) {
      var m = u && u.message;
      if (!m || !m.chat || !m.chat.id) return;
      var ma = timMaTrongTin(m.text, dsMa);
      var ai = nguoiNhan.filter(function (n) { return n.ma === ma; })[0];
      try {
        if (ai) {
          ghiKetNoiZalo(ai.ten, String(m.chat.id), String((m.from && m.from.display_name) || ''));
          soMoi++;
          guiZalo(token, m.chat.id, 'Đã kết nối với ECODesk. Từ nay ' + ai.ten + ' sẽ nhận tin nhắc việc ở đây.');
        } else {
          guiZalo(token, m.chat.id, 'Bot này dùng để nhắc việc ECODesk. Muốn nhận nhắc, hãy gửi mã kết nối 6 ký tự của bạn (xem trong ECODesk, mục Task).');
        }
      } catch (e) { /* gửi trả lời lỗi thì bỏ qua, lần sau vẫn chạy tiếp */ }
    });
  }
  return soMoi;
}

function ghiKetNoiZalo(ten, chatId, tenZalo) {
  var sh = bangDuLieu('KetNoiZalo');
  var v = sh.getDataRange().getValues();
  var td = v[0];
  for (var r = 1; r < v.length; r++) {
    if (String(v[r][td.indexOf('HoVaTen')]) === ten) {
      sh.getRange(r + 1, td.indexOf('ChatId') + 1).setValue(chatId);
      sh.getRange(r + 1, td.indexOf('TenZalo') + 1).setValue(tenZalo);
      sh.getRange(r + 1, td.indexOf('ThoiGianKetNoi') + 1).setValue(chatId ? new Date() : '');
      return;
    }
  }
}

/* ---------- Nhắc việc hằng ngày ---------- */

function caiDatNhacZalo() {
  var sap = layCaiDat('ZaloNhacSapDenHan');
  return {
    gioNhac: layCaiDat('ZaloGioNhac') === null ? 20 : Number(layCaiDat('ZaloGioNhac')),
    nhacSapDenHan: sap === null ? true : (sap === true || sap === 'TRUE' || sap === 'true'),
    nhacTre: String(layCaiDat('ZaloNhacTre') || NHAC_TRE.MOI_NGAY)
  };
}

/** Chạy tự động mỗi ngày theo lịch (cài khi BOD lưu cài đặt bot Zalo). Cũng chạy được bằng nút "Gửi nhắc ngay". */
function nhacViecHangNgay() {
  var token = layTokenZalo();
  if (!token) return { daGui: 0, loi: [] };
  try { nhanTinMoiZalo(); } catch (e) { /* vẫn nhắc những người đã kết nối */ }
  var cd = caiDatNhacZalo();
  var hom = homNay();
  var canNhac = chonTaskCanNhac(docTask(), hom, cd);
  var nguoiNhan = dongBoNguoiNhanZalo();
  var laBod = {};
  nguoiNhan.forEach(function (n) { if (n.vaiTro === 'BOD') laBod[n.ten] = true; });
  var choNhanSu = canNhac.filter(function (t) { return !laBod[t.nguoi]; });

  var daGui = 0, loi = [];
  nguoiNhan.forEach(function (n) {
    if (!n.chatId) return;
    var tin = n.vaiTro === 'BOD'
      ? soanTinNhac(n.ten, canNhac.filter(function (t) { return t.nguoi === n.ten; }), hom, false)
      : soanTinNhac(n.ten, choNhanSu, hom, true);
    if (!tin) return;
    try { guiZalo(token, n.chatId, tin); daGui++; } catch (e) { loi.push(n.ten + ': ' + e.message); }
  });
  datCaiDat('ZaloLanNhacCuoi', JSON.stringify({ luc: Date.now(), daGui: daGui, loi: loi.slice(0, 5) }));
  return { daGui: daGui, loi: loi };
}

/** Báo ngay cho BOD khi được giao task mới (nếu BOD đó đã kết nối Zalo). Lỗi thì bỏ qua, không ảnh hưởng việc tạo task. */
function baoTaskMoiChoBod(dong, nguoiTao) {
  try {
    var token = layTokenZalo();
    if (!token) return;
    var nguoiNhan = dongBoNguoiNhanZalo();
    dong.forEach(function (d) {
      var n = nguoiNhan.filter(function (x) { return x.ten === d.NguoiPhuTrach && x.vaiTro === 'BOD' && x.chatId; })[0];
      if (!n || n.ten === nguoiTao) return;
      guiZalo(token, n.chatId, 'ECODesk: ' + nguoiTao + ' vừa giao cho bạn task "' + d.TenTask + '", hạn ' + hienNgay(d.HanChot) + '.');
    });
  } catch (e) { /* bỏ qua */ }
}

/** Cài lịch chạy nhacViecHangNgay mỗi ngày vào giờ đã chọn (thay lịch cũ nếu có). */
function caiLichNhac(gio) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'nhacViecHangNgay') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('nhacViecHangNgay').timeBased().atHour(gio).everyDays(1).inTimezone(Session.getScriptTimeZone()).create();
}

function coLichNhac() {
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'nhacViecHangNgay'; });
}

/* ---------- Gọi từ ECODesk ---------- */

function layCaiDatZalo(phien) {
  canDangNhap(phien, 'caidat');
  var cd = caiDatNhacZalo();
  var lanCuoi = null;
  try { lanCuoi = JSON.parse(layCaiDat('ZaloLanNhacCuoi') || 'null'); } catch (e) { lanCuoi = null; }
  return {
    coBot: !!layTokenZalo(), tenBot: String(layCaiDat('ZaloTenBot') || ''), coLich: coLichNhac(),
    gioNhac: cd.gioNhac, nhacSapDenHan: cd.nhacSapDenHan, nhacTre: cd.nhacTre, lanCuoi: lanCuoi,
    nguoiNhan: dongBoNguoiNhanZalo().map(function (n) { return { ten: n.ten, vaiTro: n.vaiTro, ma: n.ma, daKetNoi: !!n.chatId, tenZalo: n.tenZalo }; })
  };
}

/** Lưu cài đặt bot. token để trống nghĩa là giữ mã bot cũ. */
function luuCaiDatZalo(phien, cd) {
  canDangNhap(phien, 'caidat');
  cd = cd || {};
  var gio = Math.round(Number(cd.gioNhac));
  if (!(gio >= 0 && gio <= 23)) throw new Error('Giờ nhắc phải từ 0 đến 23.');
  var nhacTre = [NHAC_TRE.MOI_NGAY, NHAC_TRE.MOT_LAN, NHAC_TRE.KHONG].indexOf(cd.nhacTre) >= 0 ? cd.nhacTre : NHAC_TRE.MOI_NGAY;
  var token = String(cd.token || '').trim();
  if (token && token !== layTokenZalo()) {
    var bot;
    try { bot = goiZalo(token, 'getMe', {}); } catch (e) { throw new Error('Mã bot không dùng được. Bạn kiểm tra lại đã chép đủ mã chưa. (' + e.message + ')'); }
    datCaiDat('ZaloToken', token);
    datCaiDat('ZaloTenBot', String((bot && (bot.account_name || bot.display_name || bot.name)) || ''));
    // Bot mới thì mọi người phải nhắn mã kết nối lại.
    var ds = docBang('KetNoiZalo').map(function (k) { k.ChatId = ''; k.TenZalo = ''; k.ThoiGianKetNoi = ''; return k; });
    ghiDeBang('KetNoiZalo', ds);
  }
  if (!layTokenZalo()) throw new Error('Bạn chưa nhập mã bot.');
  datCaiDat('ZaloGioNhac', gio);
  datCaiDat('ZaloNhacSapDenHan', !!cd.nhacSapDenHan);
  datCaiDat('ZaloNhacTre', nhacTre);
  caiLichNhac(gio);
  return true;
}

/** Đọc tin mới gửi bot để kết nối. Ai dùng được Task cũng bấm được (để tự kết nối). */
function kiemTraKetNoiZalo(phien) {
  var tk = canDangNhap(phien, 'task');
  if (!layTokenZalo()) throw new Error('Chưa có bot Zalo. Nhờ BOD nhập mã bot trong Cài đặt.');
  nhanTinMoiZalo();
  return trangThaiZaloCuaToi(String(tk.HoVaTen));
}

function guiTinThuZalo(phien, ten) {
  canDangNhap(phien, 'caidat');
  var token = layTokenZalo();
  var n = dongBoNguoiNhanZalo().filter(function (x) { return x.ten === ten; })[0];
  if (!token || !n || !n.chatId) throw new Error(ten + ' chưa kết nối Zalo.');
  guiZalo(token, n.chatId, 'ECODesk: đây là tin nhắn thử. Bạn sẽ nhận nhắc việc ở đây.');
  return true;
}

function goKetNoiZalo(phien, ten) {
  canDangNhap(phien, 'caidat');
  ghiKetNoiZalo(ten, '', '');
  return true;
}

function guiNhacNgay(phien) {
  canDangNhap(phien, 'caidat');
  if (!layTokenZalo()) throw new Error('Bạn chưa nhập mã bot.');
  return nhacViecHangNgay();
}
