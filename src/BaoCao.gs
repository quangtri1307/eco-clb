/**
 * Báo cáo (BOD) và tạo file đăng ký log từ sheet mẫu.
 */

/* ===================== Báo cáo ===================== */

function ngayCuaThoiGian_(v) {
  if (!v) return '';
  var d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function truMotNgay_(ngay) {
  var p = ngay.split('-');
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] - 1)).toISOString().slice(0, 10);
}

/** Các mốc thời gian chọn nhanh: học kỳ, nhiệm kỳ (từ tab KyHoatDong) và các tháng. */
function layThongTinBaoCao(phien) {
  canDangNhap_(phien, 'baocao');
  var hom = homNay_();
  var ky = docBangNhiemKy_('KyHoatDong', 'BatDau').map(function (k) { return { nhiemKy: String(k.NhiemKy), hocKy: Number(k.HocKy), tu: ngayCuaThoiGian_(k.BatDau) }; })
    .filter(function (k) { return k.tu; }).sort(function (a, b) { return a.tu < b.tu ? -1 : 1; })
    // Lỡ tải cùng một đợt hai lần thì vẫn chỉ là một học kỳ.
    .filter(function (k, i, ds) { return !i || ds[i - 1].nhiemKy !== k.nhiemKy || ds[i - 1].hocKy !== k.hocKy; });
  var hocKy = ky.map(function (k, i) {
    return { ten: 'Học kỳ ' + k.hocKy + ' · ' + k.nhiemKy, tu: k.tu, den: i + 1 < ky.length ? truMotNgay_(ky[i + 1].tu) : hom };
  }).reverse();
  var nhiemKy = [];
  hocKy.slice().reverse().forEach(function (h, i) {
    var ten = 'Nhiệm kỳ ' + ky[i].nhiemKy;
    var co = nhiemKy.filter(function (n) { return n.ten === ten; })[0];
    if (co) co.den = h.den; else nhiemKy.push({ ten: ten, tu: h.tu, den: h.den });
  });
  return { homNay: hom, hocKy: hocKy, nhiemKy: nhiemKy.reverse(), batDau: ky.length ? ky[0].tu : hom };
}

function duLieuBaoCao_() {
  return {
    lichSu: docBangNhiemKy_('LichSuDiem', 'ThoiGian').map(function (d) {
      return { ngay: ngayCuaThoiGian_(d.ThoiGian), ten: String(d.HoVaTen), loai: String(d.LoaiHoatDong), tenHoatDong: String(d.TenHoatDong || ''), diem: Number(d.Diem) || 0 };
    }),
    task: docBangNhiemKy_('Task', 'ThoiGianTao').map(function (t) {
      return { nguoi: String(t.NguoiPhuTrach), hanChot: ngayChuoi_(t.HanChot), trangThaiLuu: String(t.TrangThai || TRANG_THAI_TASK.GIAO), ngayXong: ngayCuaThoiGian_(t.ThoiGianXong) };
    }),
    thanhVien: docThanhVien_().filter(khongPhaiBod_).map(function (t) { return { ten: String(t.HoVaTen), ban: String(t.Ban), nhom: nhomBan_(t.Ban) }; }),
    loai: docBang_('LoaiHoatDong').map(function (l) { return String(l.TenLoai); })
  };
}

function kiemTraKhoang_(tu, den) {
  if (!ngayHopLe_(tu) || !ngayHopLe_(den)) throw new Error('Khoảng thời gian chưa đúng.');
  if (tu > den) throw new Error('Ngày bắt đầu phải trước ngày kết thúc.');
  if (soNgayGiua_(tu, den) > 366 * 3) throw new Error('Khoảng thời gian dài quá 3 năm.');
}

function tinhBaoCao_(tu, den, cheDo) {
  kiemTraKhoang_(tu, den);
  cheDo = ['thanhvien', 'ban', 'clb'].indexOf(cheDo) >= 0 ? cheDo : 'thanhvien';
  var d = duLieuBaoCao_(), hom = homNay_(), kht = soNgayKhongHoanThanh_();
  var lichSuKhoang = d.lichSu.filter(function (x) { return x.ngay >= tu && x.ngay <= den; });
  return {
    chiSo: chiSoBaoCao_(d.loai, lichSuKhoang),
    bang: tongHopBaoCao_(d.lichSu, d.task, d.thanhVien, tu, den, cheDo, hom, kht).dong,
    bieuDo: bieuDoBaoCao_(lichSuKhoang, d.task, d.thanhVien, tu, den, cheDo, hom, kht)
  };
}

function layBaoCao(phien, tu, den, cheDo) {
  canDangNhap_(phien, 'baocao');
  return tinhBaoCao_(tu, den, cheDo);
}

/** Xuất báo cáo ra file Excel (.xlsx). Trả về { ten, base64 } để trình duyệt tải về. */
function xuatExcelBaoCao(phien, tu, den, cheDo) {
  canDangNhap_(phien, 'baocao');
  var kq = tinhBaoCao_(tu, den, cheDo);
  var tenCheDo = { thanhvien: 'thành viên', ban: 'ban', clb: 'cả CLB' }[cheDo] || 'thành viên';
  var ten = 'Báo cáo ' + tenCheDo + ' ' + hienNgay_(tu) + ' - ' + hienNgay_(den);
  var ss = SpreadsheetApp.create(ten);
  try {
    var sh = ss.getSheets()[0].setName('Tổng hợp');
    var dau = [cheDo === 'ban' ? 'Ban' : cheDo === 'clb' ? '' : 'Họ và tên'].concat(cheDo === 'thanhvien' ? ['Ban'] : []).concat(kq.chiSo.map(function (c) { return c.ten; }));
    var dong = kq.bang.map(function (d) { return [d.ten].concat(cheDo === 'thanhvien' ? [d.ban] : []).concat(kq.chiSo.map(function (c) { return d.so[c.khoa] || 0; })); });
    sh.getRange(1, 1).setValue(ten).setFontWeight('bold').setFontSize(13);
    sh.getRange(3, 1, 1, dau.length).setValues([dau]).setFontWeight('bold').setBackground('#274e13').setFontColor('#ffffff');
    if (dong.length) sh.getRange(4, 1, dong.length, dau.length).setValues(dong);
    sh.setFrozenRows(3);
    sh.autoResizeColumns(1, dau.length);

    var sh2 = ss.insertSheet('Theo thời gian');
    var chuoi = Object.keys(kq.bieuDo.chuoi);
    var dau2 = ['Từ ngày', 'Đến ngày'];
    var cot2 = [];
    chuoi.forEach(function (c) { kq.chiSo.forEach(function (s) { dau2.push((cheDo === 'clb' ? '' : c + ' · ') + s.ten); cot2.push([c, s.khoa]); }); });
    var dong2 = kq.bieuDo.moc.map(function (m, i) { return [hienNgay_(m.tu), hienNgay_(m.den)].concat(cot2.map(function (x) { return kq.bieuDo.chuoi[x[0]][i][x[1]] || 0; })); });
    sh2.getRange(1, 1, 1, dau2.length).setValues([dau2]).setFontWeight('bold').setBackground('#274e13').setFontColor('#ffffff');
    if (dong2.length) sh2.getRange(2, 1, dong2.length, dau2.length).setValues(dong2);
    sh2.setFrozenRows(1);
    SpreadsheetApp.flush();

    var res = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx', {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) throw new Error('Google không xuất được file (mã ' + res.getResponseCode() + ').');
    return { ten: ten + '.xlsx', base64: Utilities.base64Encode(res.getContent()) };
  } finally {
    DriveApp.getFileById(ss.getId()).setTrashed(true);
  }
}

/* ===================== File đăng ký log ===================== */

function maTuLink_(link) {
  var s = String(link || '').trim();
  var m = /\/d\/([a-zA-Z0-9_-]{20,})/.exec(s) || /\/folders\/([a-zA-Z0-9_-]{20,})/.exec(s) || /[?&]id=([a-zA-Z0-9_-]{20,})/.exec(s);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(s) ? s : '';
}

function layDuLieuLog(phien) {
  canDangNhap_(phien, 'log');
  return {
    thanhVien: docThanhVien_().map(function (t) { return { ten: String(t.HoVaTen), ban: String(t.Ban), nhom: nhomBan_(t.Ban), sdt: String(t.SoDienThoaiCaNhan || '') }; }),
    linkMau: String(layCaiDat_('LinkMauLog') || ''), linkThuMuc: String(layCaiDat_('LinkThuMucLog') || ''),
    ganDay: docBangNhiemKy_('FileLog', 'ThoiGian').map(function (f) {
      return { thoiGian: new Date(f.ThoiGian).getTime(), ten: String(f.TenFile), link: String(f.DuongDan), soNguoi: Number(f.SoNguoi) || 0, soBuoi: Number(f.SoBuoi) || 0, nguoiTao: String(f.NguoiTao) };
    }).sort(function (a, b) { return b.thoiGian - a.thoiGian; }).slice(0, 20)
  };
}

/** Tạo file đăng ký log: chép sheet mẫu (nếu có) vào thư mục đã chọn, điền thành viên và các buổi. */
function taoFileLog(phien, yc) {
  var tk = canDangNhap_(phien, 'log');
  var tv = docBang_('ThanhVien');
  var maMau = maTuLink_(layCaiDat_('LinkMauLog'));
  var k = kiemTraFileLog_({ coMau: !!maMau, tenFile: yc && yc.tenFile, nguoi: yc && yc.nguoi, buoi: yc && yc.buoi }, tv);
  if (k.loi) throw new Error(k.loi);

  var maThuMuc = maTuLink_(layCaiDat_('LinkThuMucLog'));
  var thuMuc = null;
  if (maThuMuc) { try { thuMuc = DriveApp.getFolderById(maThuMuc); } catch (e) { throw new Error('Không mở được thư mục lưu file log. Kiểm tra lại link trong Cài đặt.'); } }
  var file;
  try { file = DriveApp.getFileById(maMau).makeCopy(k.tenFile, thuMuc || DriveApp.getRootFolder()); }
  catch (e) { throw new Error('Không chép được file mẫu. Kiểm tra lại link file mẫu.'); }
  // Ai có link cũng mở và tích đăng ký được; tab Đăng ký log đã khoá, chỉ chừa ô tích và Ghi chú.
  var canhBao = '';
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT); }
  catch (e) { canhBao = 'Chưa mở được quyền cho người có link, bạn mở file và bật chia sẻ bằng tay nhé.'; }
  var ss = SpreadsheetApp.openById(file.getId());
  var dangKy = timTab_(ss, 'Đăng ký log');
  if (dangKy) dienMauToolCu_(ss, dangKy, xepTheoBan_(k.nguoi, tv), k.buoi);
  else dienMauChung_(ss.getSheets()[0], k.nguoi, k.buoi);
  SpreadsheetApp.flush();

  var url = ss.getUrl();
  themDong_('FileLog', [{ ThoiGian: new Date(), TenFile: k.tenFile, DuongDan: url, SoNguoi: k.nguoi.length, SoBuoi: k.buoi.length, NguoiTao: String(tk.HoVaTen) }]);
  return { url: url, ten: k.tenFile, canhBao: canhBao };
}

/** Tìm tab theo tên, không phân biệt hoa thường và khoảng trắng thừa. */
function timTab_(ss, ten) {
  var can = String(ten).trim().toLowerCase();
  var ds = ss.getSheets();
  for (var i = 0; i < ds.length; i++) if (String(ds[i].getName()).trim().toLowerCase() === can) return ds[i];
  return null;
}

/** Mẫu bất kỳ: tìm dòng tiêu đề có cột Họ và tên, điền người vào bên dưới, mỗi buổi một cột ô tích. */
function dienMauChung_(sh, nguoi, buoi) {
  var v = sh.getDataRange().getValues();
  var td = timTieuDeMauLog_(v);
  if (!td) {
    // Mẫu không có dòng tiêu đề nhận ra được: tự tạo tiêu đề ở dòng đầu tiên còn trống.
    var dongTrong = sh.getLastRow() ? sh.getLastRow() + 1 : 0;
    td = { dong: dongTrong, cot: { stt: 0, ten: 1, ban: 2, sdt: 3 }, cotBuoi: 4 };
    sh.getRange(dongTrong + 1, 1, 1, 4).setValues([['STT', 'Họ và tên', 'Ban', 'Số điện thoại']]).setFontWeight('bold').setBackground('#274e13').setFontColor('#ffffff');
  }
  var dongDau = td.dong + 2; // dòng dữ liệu đầu tiên (đánh số từ 1)
  var canDong = dongDau + nguoi.length - 1;
  if (sh.getMaxRows() < canDong) sh.insertRowsAfter(sh.getMaxRows(), canDong - sh.getMaxRows());
  var canCot = td.cotBuoi + buoi.length;
  if (sh.getMaxColumns() < canCot) sh.insertColumnsAfter(sh.getMaxColumns(), canCot - sh.getMaxColumns());

  var ghiCot = function (c, giaTri, chu) {
    if (c === undefined) return;
    var o = sh.getRange(dongDau, c + 1, giaTri.length, 1);
    if (chu) o.setNumberFormat('@');
    o.setValues(giaTri.map(function (x) { return [x]; }));
  };
  ghiCot(td.cot.stt, nguoi.map(function (_, i) { return i + 1; }));
  ghiCot(td.cot.ten, nguoi.map(function (t) { return String(t.HoVaTen); }), true);
  ghiCot(td.cot.ban, nguoi.map(function (t) { return String(t.Ban); }), true);
  ghiCot(td.cot.sdt, nguoi.map(function (t) { return String(t.SoDienThoaiCaNhan || ''); }), true);

  var oTieuDe = sh.getRange(td.dong + 1, td.cotBuoi + 1, 1, buoi.length);
  if (td.cotBuoi > 0) sh.getRange(td.dong + 1, td.cotBuoi).copyTo(oTieuDe, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  oTieuDe.setValues([buoi]);
  sh.getRange(dongDau, td.cotBuoi + 1, nguoi.length, buoi.length).insertCheckboxes();
}

/**
 * Mẫu của tool tạo file log cũ (tab "Đăng ký log", tab "Kế hoạch" nếu có). Làm đúng như tool cũ:
 * dòng 4 là tên buổi (cột E trở đi, nền lấy từ ô Ghi chú F4), dòng 3 đếm số người đăng ký,
 * từ dòng 5 là Họ tên, Lớp, Ban, SĐT; cột Ban gộp ô theo ban và xoay chữ; khoá tab, chỉ chừa ô tích và Ghi chú.
 */
function dienMauToolCu_(ss, sh, xep, buoi) {
  var nguoi = xep.nguoi, n = nguoi.length, soBuoi = buoi.length;
  var nenGhiChu = sh.getRange('F4').getBackground();
  if (soBuoi > 1) {
    sh.insertColumnsAfter(5, soBuoi - 1);
    var cotMau = sh.getRange(1, 5, sh.getMaxRows(), 1);
    for (var c = 1; c < soBuoi; c++) cotMau.copyTo(sh.getRange(1, 5 + c, sh.getMaxRows(), 1));
  }
  var tongCot = 4 + soBuoi + 1, dongCuoi = 4 + n;
  if (sh.getMaxRows() < dongCuoi) sh.insertRowsAfter(sh.getMaxRows(), dongCuoi - sh.getMaxRows());

  sh.getRange(5, 1, n, 4).setValues(nguoi.map(function (t) {
    return [String(t.HoVaTen), String(t.Lop || ''), String(t.Ban || ''), "'" + String(t.SoDienThoaiCaNhan || '')];
  }));
  sh.getRange(5, 1, n, 1).setHorizontalAlignment('left');
  sh.getRange(5, 2, n, 3).setHorizontalAlignment('center');
  sh.getRange(5, 5, n, soBuoi).insertCheckboxes().setHorizontalAlignment('center');
  xep.nhomBan.forEach(function (g) {
    var o = sh.getRange(5 + g.dau, 3, g.so, 1);
    if (g.so > 1) o.merge();
    o.setTextRotation(90).setVerticalAlignment('middle').setHorizontalAlignment('center');
  });

  var kieuTieuDe = function (o) { return o.setBackground(nenGhiChu).setFontColor('#000000').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle'); };
  kieuTieuDe(sh.getRange(4, 5, 1, soBuoi).setValues([buoi]));
  kieuTieuDe(sh.getRange(4, tongCot).setValue('Ghi chú'));
  sh.getRange(3, 5, 1, soBuoi).setFormulas([buoi.map(function (_, i) { var c = chuCot_(5 + i); return '=COUNTIF(' + c + '5:' + c + dongCuoi + ', TRUE)'; })])
    .setBackground('#ffffff').setFontWeight('normal').setHorizontalAlignment('center').setVerticalAlignment('middle');

  sh.getRange(1, 1, 1, tongCot).merge();
  sh.getRange(2, 1, 1, tongCot).merge();
  for (var cot = 1; cot <= 4; cot++) sh.getRange(3, cot, 2, 1).merge();
  sh.getRange(3, tongCot, 2, 1).merge();
  sh.getRange(3, 1, n + 2, tongCot).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  sh.protect().setDescription('Khóa chỉnh sửa Tab Đăng ký log')
    .setUnprotectedRanges([sh.getRange(5, 5, n, soBuoi), sh.getRange(5, tongCot, n, 1)]);

  var keHoach = timTab_(ss, 'Kế hoạch');
  if (!keHoach) return;
  if (soBuoi > 1) {
    keHoach.insertColumnsAfter(2, soBuoi - 1);
    var cotMau2 = keHoach.getRange(1, 2, keHoach.getMaxRows(), 1);
    for (var c2 = 1; c2 < soBuoi; c2++) cotMau2.copyTo(keHoach.getRange(1, 2 + c2, keHoach.getMaxRows(), 1));
  }
  var tongCot2 = 1 + soBuoi, tenTab = sh.getName().replace(/'/g, "''");
  keHoach.getRange(3, 2, 1, soBuoi).setFormulas([buoi.map(function (_, i) { return "='" + tenTab + "'!" + chuCot_(5 + i) + '3'; })])
    .setBackground('#ffffff').setFontWeight('normal').setHorizontalAlignment('center').setVerticalAlignment('middle');
  kieuTieuDe(keHoach.getRange(4, 2, 1, soBuoi).setValues([buoi]));
  keHoach.getRange(1, 1, 1, tongCot2).merge();
  keHoach.getRange(2, 1, 1, tongCot2).merge();
  keHoach.getRange(3, 1, 2, 1).merge();
  keHoach.getRange(3, 1, 5, tongCot2).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
}

function luuCaiDatLog(phien, cd) {
  canDangNhap_(phien, 'log');
  cd = cd || {};
  var mau = String(cd.linkMau || '').trim(), thuMuc = String(cd.linkThuMuc || '').trim();
  if (mau) {
    var m = maTuLink_(mau);
    try { SpreadsheetApp.openById(m); } catch (e) { throw new Error('Không mở được sheet mẫu. Kiểm tra link và quyền truy cập của tài khoản CLB.'); }
  }
  if (thuMuc) {
    try { DriveApp.getFolderById(maTuLink_(thuMuc)).getName(); } catch (e) { throw new Error('Không mở được thư mục. Kiểm tra link và quyền truy cập của tài khoản CLB.'); }
  }
  datCaiDat_('LinkMauLog', mau);
  datCaiDat_('LinkThuMucLog', thuMuc);
  return true;
}
