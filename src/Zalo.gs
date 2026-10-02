/**
 * Bot Zalo và lịch nhắc việc hằng ngày (nhắc gửi theo cách mỗi người chọn, xem ThongBao.gs).
 * Head HR tạo bot mỗi năm và dán mã bot vào Cài đặt. Ai muốn nhận thông báo qua Zalo thì nhắn mã kết nối
 * của mình cho bot một lần (xem ở mục Thông báo). Mỗi ngày, vào giờ BOD chọn, gửi tin nhắc việc:
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

/** Tên bot người dùng tìm được trong Zalo (tên hiển thị, không phải mã dạng bot.xxxx). */
function tenHienThiBot(bot) {
  return String((bot && (bot.display_name || bot.name || bot.account_name)) || '');
}

/** Tên bot đã lưu. Bản cũ lưu mã dạng bot.xxxx thì hỏi lại Zalo để lấy tên hiển thị. */
function tenBotZalo() {
  var ten = String(layCaiDat('ZaloTenBot') || '');
  var token = layTokenZalo();
  if (token && (!ten || /^bot\./.test(ten))) {
    try { var moi = tenHienThiBot(goiZalo(token, 'getMe', {})); if (moi && moi !== ten) { ten = moi; datCaiDat('ZaloTenBot', ten); } } catch (e) { /* giữ tên cũ */ }
  }
  return ten;
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
  var tk = docBang('TaiKhoan').filter(function (t) { return t.HoVaTen && (t.VaiTro === 'BOD' || t.VaiTro === 'HR'); });
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
  return { coBot: coBot, tenBot: tenBotZalo(), ma: toi ? toi.ma : '', daKetNoi: !!(toi && toi.chatId), tenZalo: toi ? toi.tenZalo : '' };
}

/**
 * Đọc các tin mới người dùng nhắn cho bot. Tin có mã kết nối thì ghi lại ID Zalo của người đó.
 * Trả về { soTin, soMoi, tinKhongMa: [{ tenZalo, noiDung }], loi } để trang Cài đặt báo rõ chuyện gì đã xảy ra.
 */
function nhanTinMoiZalo() {
  var token = layTokenZalo();
  var bao = { soTin: 0, soMoi: 0, tinKhongMa: [], loi: '' };
  if (!token) return bao;
  var nguoiNhan = dongBoNguoiNhanZalo();
  var dsMa = nguoiNhan.map(function (n) { return n.ma; });
  for (var lan = 0; lan < 20; lan++) {
    var kq;
    try { kq = goiZalo(token, 'getUpdates', { timeout: 1 }); } catch (e) {
      // Không có tin mới thì Zalo trả lỗi hết giờ chờ; lỗi khác thì báo lại cho người bấm kiểm tra.
      if (e.maLoi !== 408 && !/time ?out|hết giờ/i.test(e.message)) bao.loi = e.message;
      break;
    }
    var ds = Array.isArray(kq) ? kq : (kq ? [kq] : []);
    if (!ds.length) break;
    ds.forEach(function (u) {
      var m = u && u.message;
      if (!m || !m.chat || !m.chat.id) return;
      bao.soTin++;
      var ma = timMaTrongTin(m.text, dsMa);
      var ai = nguoiNhan.filter(function (n) { return n.ma === ma; })[0];
      try {
        if (ai) {
          ghiKetNoiZalo(ai.ten, String(m.chat.id), String((m.from && m.from.display_name) || ''));
          bao.soMoi++;
          guiZalo(token, m.chat.id, 'Đã kết nối với ECODesk. Từ nay ' + ai.ten + ' sẽ nhận thông báo ở đây.');
        } else {
          if (bao.tinKhongMa.length < 5) bao.tinKhongMa.push({ tenZalo: String((m.from && m.from.display_name) || ''), noiDung: String(m.text || '(không phải chữ)').slice(0, 40) });
          guiZalo(token, m.chat.id, 'Bot này gửi thông báo của ECODesk. Muốn nhận, hãy gửi mã kết nối 6 ký tự của bạn (xem trong ECODesk, mục Thông báo).');
        }
      } catch (e) { /* gửi trả lời lỗi thì bỏ qua, lần sau vẫn chạy tiếp */ }
    });
  }
  return bao;
}

/** Câu báo kết quả đọc tin để hiện trên trang. */
function moTaKiemTraZalo(bao) {
  if (bao.loi) return 'Không đọc được tin nhắn của bot. ' + bao.loi;
  if (!bao.soTin) return 'Bot chưa nhận được tin nhắn mới nào. Hãy nhắn mã trong khung chat của chính bot (tìm tên bot trong Zalo), không phải trong Zalo Bot Manager.';
  var cau = 'Đã đọc ' + bao.soTin + ' tin mới, ' + bao.soMoi + ' người vừa kết nối.';
  if (bao.tinKhongMa.length) cau += ' Tin không có mã đúng: ' + bao.tinKhongMa.map(function (t) { return (t.tenZalo ? t.tenZalo + ': ' : '') + '"' + t.noiDung + '"'; }).join(', ') + '.';
  return cau;
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
    dsGio: chuanHoaDsGio(layCaiDat('ZaloGioNhac')),
    nhacSapDenHan: sap === null ? true : (sap === true || sap === 'TRUE' || sap === 'true'),
    nhacTre: String(layCaiDat('ZaloNhacTre') || NHAC_TRE.MOI_NGAY)
  };
}

/** Chạy tự động mỗi ngày theo lịch. Gửi theo cách mỗi người chọn (Zalo, app, mail). Cũng chạy được bằng nút "Gửi nhắc ngay". */
function nhacViecHangNgay() {
  if (layTokenZalo()) { try { nhanTinMoiZalo(); } catch (e) { /* vẫn nhắc những người đã kết nối */ } }
  try { donThongBaoCu(); } catch (e) { /* bỏ qua */ }
  var cd = caiDatNhacZalo();
  var hom = homNay();
  var canNhac = chonTaskCanNhac(docTask(), hom, cd);
  var nguoiNhan = nguoiNhanThongBao();
  var laBod = {};
  nguoiNhan.forEach(function (n) { if (n.vaiTro === 'BOD') laBod[n.ten] = true; });
  var choNhanSu = canNhac.filter(function (t) { return !laBod[t.nguoi]; });

  var daGui = 0, loi = [];
  nguoiNhan.forEach(function (n) {
    if (n.vaiTro !== 'BOD' && n.vaiTro !== 'HR') return; // UCV không nhận nhắc việc
    var tin = n.vaiTro === 'BOD'
      ? soanTinNhac(n.ten, canNhac.filter(function (t) { return t.nguoi === n.ten; }), hom, false)
      : soanTinNhac(n.ten, choNhanSu, hom, true);
    if (!tin) return;
    try { if (guiThongBao(n, 'Nhắc việc', tin)) daGui++; else loi.push(n.ten + ': chưa có cách nhận nào dùng được'); } catch (e) { loi.push(n.ten + ': ' + e.message); }
  });
  datCaiDat('ZaloLanNhacCuoi', JSON.stringify({ luc: Date.now(), daGui: daGui, loi: loi.slice(0, 5) }));
  return { daGui: daGui, loi: loi };
}

/** Báo ngay cho BOD khi được giao task mới. Lỗi thì bỏ qua, không ảnh hưởng việc tạo task. */
function baoTaskMoiChoBod(dong, nguoiTao) {
  try {
    var nguoiNhan = nguoiNhanThongBao();
    dong.forEach(function (d) {
      var n = nguoiNhan.filter(function (x) { return x.ten === d.NguoiPhuTrach && x.vaiTro === 'BOD'; })[0];
      if (!n || n.ten === nguoiTao) return;
      guiThongBao(n, 'Task mới', 'ECODesk: ' + nguoiTao + ' vừa giao cho bạn task "' + d.TenTask + '", hạn ' + hienNgay(d.HanChot) + '.');
    });
  } catch (e) { /* bỏ qua */ }
}

/** Cài lịch chạy nhacViecHangNgay mỗi ngày vào các giờ đã chọn (thay lịch cũ nếu có). */
function caiLichNhac(dsGio) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'nhacViecHangNgay') ScriptApp.deleteTrigger(t);
  });
  chuanHoaDsGio(dsGio).forEach(function (gio) {
    ScriptApp.newTrigger('nhacViecHangNgay').timeBased().atHour(gio).everyDays(1).inTimezone(Session.getScriptTimeZone()).create();
  });
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
    coBot: !!layTokenZalo(), tenBot: tenBotZalo(), coLich: coLichNhac(),
    dsGio: cd.dsGio, nhacSapDenHan: cd.nhacSapDenHan, nhacTre: cd.nhacTre, lanCuoi: lanCuoi,
    nguoiNhan: dongBoNguoiNhanZalo().map(function (n) { return { ten: n.ten, vaiTro: n.vaiTro, ma: n.ma, daKetNoi: !!n.chatId, tenZalo: n.tenZalo }; })
  };
}

/** Lưu mã bot Zalo. token để trống nghĩa là giữ mã bot cũ. */
function luuCaiDatZalo(phien, cd) {
  canDangNhap(phien, 'caidat');
  cd = cd || {};
  if (cd.dsGio !== undefined) luuNhacViec(phien, cd);
  var token = String(cd.token || '').trim();
  if (token && token !== layTokenZalo()) {
    var bot;
    try { bot = goiZalo(token, 'getMe', {}); } catch (e) { throw new Error('Mã bot không dùng được. Bạn kiểm tra lại đã chép đủ mã chưa. (' + e.message + ')'); }
    datCaiDat('ZaloToken', token);
    datCaiDat('ZaloTenBot', tenHienThiBot(bot));
    // Bot mới thì mọi người phải nhắn mã kết nối lại.
    var ds = docBang('KetNoiZalo').map(function (k) { k.ChatId = ''; k.TenZalo = ''; k.ThoiGianKetNoi = ''; return k; });
    ghiDeBang('KetNoiZalo', ds);
  }
  damBaoLichNhac();
  return true;
}

/**
 * Thời điểm nhắc deadline (BOD chỉnh): bao nhiêu ngày trước hạn thì coi là sắp đến hạn,
 * những giờ nào gửi nhắc mỗi ngày (có thể nhiều giờ), có nhắc task sắp đến hạn không, nhắc task trễ thế nào.
 */
function luuNhacViec(phien, cd) {
  canDangNhap(phien, 'caidat');
  cd = cd || {};
  if (!Array.isArray(cd.dsGio) || !cd.dsGio.length) throw new Error('Cần ít nhất một giờ nhắc.');
  var dsGio = chuanHoaDsGio(cd.dsGio);
  if (cd.sapDenHanNgay !== undefined) {
    var n = Math.round(Number(cd.sapDenHanNgay));
    if (!(n >= 0 && n <= 30)) throw new Error('Số ngày phải từ 0 đến 30.');
    datCaiDat('SapDenHanNgay', n);
  }
  var nhacTre = [NHAC_TRE.MOI_NGAY, NHAC_TRE.MOT_LAN, NHAC_TRE.KHONG].indexOf(cd.nhacTre) >= 0 ? cd.nhacTre : NHAC_TRE.MOI_NGAY;
  datCaiDat('ZaloGioNhac', dsGio.join(', '));
  datCaiDat('ZaloNhacSapDenHan', !!cd.nhacSapDenHan);
  datCaiDat('ZaloNhacTre', nhacTre);
  caiLichNhac(dsGio);
  return true;
}

/** Đọc tin mới gửi bot để kết nối. Ai đăng nhập cũng bấm được (để tự kết nối). */
function kiemTraKetNoiZalo(phien) {
  var tk = canDangNhap(phien, 'task');
  if (!layTokenZalo()) throw new Error('Chưa có bot Zalo. Nhờ BOD nhập mã bot trong Cài đặt.');
  var bao = nhanTinMoiZalo();
  var kq = trangThaiZaloCuaToi(String(tk.HoVaTen));
  kq.baoCao = moTaKiemTraZalo(bao);
  kq.loi = !!bao.loi;
  return kq;
}

function guiTinThuZalo(phien, ten) {
  canDangNhap(phien, 'caidat');
  var token = layTokenZalo();
  var n = dongBoNguoiNhanZalo().filter(function (x) { return x.ten === ten; })[0];
  if (!token || !n || !n.chatId) throw new Error(ten + ' chưa kết nối Zalo.');
  guiZalo(token, n.chatId, 'ECODesk: đây là tin nhắn thử. Bạn sẽ nhận thông báo ở đây.');
  return true;
}

function goKetNoiZalo(phien, ten) {
  canDangNhap(phien, 'caidat');
  ghiKetNoiZalo(ten, '', '');
  return true;
}

function guiNhacNgay(phien) {
  canDangNhap(phien, 'caidat');
  return nhacViecHangNgay();
}
