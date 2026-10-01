/**
 * Báo cáo (BOD) và tạo file đăng ký log từ sheet mẫu.
 */

/* ===================== Báo cáo ===================== */

function ngayCuaThoiGian(v) {
  if (!v) return '';
  var d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function truMotNgay(ngay) {
  var p = ngay.split('-');
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] - 1)).toISOString().slice(0, 10);
}

/** Các mốc thời gian chọn nhanh: học kỳ, nhiệm kỳ (từ tab KyHoatDong) và các tháng. */
function layThongTinBaoCao(phien) {
  canDangNhap(phien, 'baocao');
  var hom = homNay();
  var ky = docBang('KyHoatDong').map(function (k) { return { nhiemKy: String(k.NhiemKy), hocKy: Number(k.HocKy), tu: ngayCuaThoiGian(k.BatDau) }; })
    .filter(function (k) { return k.tu; }).sort(function (a, b) { return a.tu < b.tu ? -1 : 1; });
  var hocKy = ky.map(function (k, i) {
    return { ten: 'Học kỳ ' + k.hocKy + ' · ' + k.nhiemKy, tu: k.tu, den: i + 1 < ky.length ? truMotNgay(ky[i + 1].tu) : hom };
  }).reverse();
  var nhiemKy = [];
  hocKy.slice().reverse().forEach(function (h, i) {
    var ten = 'Nhiệm kỳ ' + ky[i].nhiemKy;
    var co = nhiemKy.filter(function (n) { return n.ten === ten; })[0];
    if (co) co.den = h.den; else nhiemKy.push({ ten: ten, tu: h.tu, den: h.den });
  });
  return { homNay: hom, hocKy: hocKy, nhiemKy: nhiemKy.reverse(), batDau: ky.length ? ky[0].tu : hom };
}

function duLieuBaoCao() {
  return {
    lichSu: docBang('LichSuDiem').map(function (d) {
      return { ngay: ngayCuaThoiGian(d.ThoiGian), ten: String(d.HoVaTen), loai: String(d.LoaiHoatDong), tenHoatDong: String(d.TenHoatDong || ''), diem: Number(d.Diem) || 0 };
    }),
    task: docBang('Task').map(function (t) {
      return { nguoi: String(t.NguoiPhuTrach), hanChot: ngayChuoi(t.HanChot), trangThaiLuu: String(t.TrangThai || TRANG_THAI_TASK.GIAO), ngayXong: ngayCuaThoiGian(t.ThoiGianXong) };
    }),
    thanhVien: docBang('ThanhVien').map(function (t) { return { ten: String(t.HoVaTen), ban: String(t.Ban), nhom: nhomBan(t.Ban) }; }),
    loai: docBang('LoaiHoatDong').map(function (l) { return String(l.TenLoai); })
  };
}

function kiemTraKhoang(tu, den) {
  if (!ngayHopLe(tu) || !ngayHopLe(den)) throw new Error('Khoảng thời gian chưa đúng.');
  if (tu > den) throw new Error('Ngày bắt đầu phải trước ngày kết thúc.');
  if (soNgayGiua(tu, den) > 366 * 3) throw new Error('Khoảng thời gian dài quá 3 năm.');
}

function tinhBaoCao(tu, den, cheDo) {
  kiemTraKhoang(tu, den);
  cheDo = ['thanhvien', 'ban', 'clb'].indexOf(cheDo) >= 0 ? cheDo : 'thanhvien';
  var d = duLieuBaoCao(), hom = homNay();
  var lichSuKhoang = d.lichSu.filter(function (x) { return x.ngay >= tu && x.ngay <= den; });
  return {
    chiSo: chiSoBaoCao(d.loai, lichSuKhoang),
    bang: tongHopBaoCao(d.lichSu, d.task, d.thanhVien, tu, den, cheDo, hom).dong,
    bieuDo: bieuDoBaoCao(lichSuKhoang, d.task, d.thanhVien, tu, den, cheDo, hom)
  };
}

function layBaoCao(phien, tu, den, cheDo) {
  canDangNhap(phien, 'baocao');
  return tinhBaoCao(tu, den, cheDo);
}

/** Xuất báo cáo ra file Excel (.xlsx). Trả về { ten, base64 } để trình duyệt tải về. */
function xuatExcelBaoCao(phien, tu, den, cheDo) {
  canDangNhap(phien, 'baocao');
  var kq = tinhBaoCao(tu, den, cheDo);
  var tenCheDo = { thanhvien: 'thành viên', ban: 'ban', clb: 'cả CLB' }[cheDo] || 'thành viên';
  var ten = tenFileChuan('Báo cáo', tenCheDo, ngayTenFile(tu) + ' đến ' + ngayTenFile(den));
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
    var dong2 = kq.bieuDo.moc.map(function (m, i) { return [hienNgay(m.tu), hienNgay(m.den)].concat(cot2.map(function (x) { return kq.bieuDo.chuoi[x[0]][i][x[1]] || 0; })); });
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

function maTuLink(link) {
  var s = String(link || '').trim();
  var m = /\/d\/([a-zA-Z0-9_-]{20,})/.exec(s) || /\/folders\/([a-zA-Z0-9_-]{20,})/.exec(s) || /[?&]id=([a-zA-Z0-9_-]{20,})/.exec(s);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(s) ? s : '';
}

function layDuLieuLog(phien) {
  canDangNhap(phien, 'log');
  return {
    thanhVien: docBang('ThanhVien').map(function (t) { return { ten: String(t.HoVaTen), ban: String(t.Ban), nhom: nhomBan(t.Ban), sdt: String(t.SoDienThoaiCaNhan || '') }; }),
    coMau: !!layCaiDat('LinkMauLog'), coThuMuc: !!layCaiDat('LinkThuMucLog'),
    ganDay: docBang('FileLog').map(function (f) {
      return { thoiGian: new Date(f.ThoiGian).getTime(), ten: String(f.TenFile), link: String(f.DuongDan), soNguoi: Number(f.SoNguoi) || 0, soBuoi: Number(f.SoBuoi) || 0, nguoiTao: String(f.NguoiTao) };
    }).sort(function (a, b) { return b.thoiGian - a.thoiGian; }).slice(0, 20)
  };
}

/** Tạo file đăng ký log: chép sheet mẫu (nếu có) vào thư mục đã chọn, điền thành viên và các buổi. */
function taoFileLog(phien, yc) {
  var tk = canDangNhap(phien, 'log');
  var tv = docBang('ThanhVien');
  var k = kiemTraFileLog(yc, tv);
  if (k.loi) throw new Error(k.loi);

  var maMau = maTuLink(layCaiDat('LinkMauLog'));
  var maThuMuc = maTuLink(layCaiDat('LinkThuMucLog'));
  var thuMuc = null;
  if (maThuMuc) { try { thuMuc = DriveApp.getFolderById(maThuMuc); } catch (e) { throw new Error('Không mở được thư mục lưu file log. Kiểm tra lại link trong Cài đặt.'); } }
  if (!thuMuc) {
    thuMuc = thuMucCon(THU_MUC.LOG);
    datCaiDat('LinkThuMucLog', thuMuc.getUrl());
  }
  var file;
  if (maMau) {
    try { file = DriveApp.getFileById(maMau).makeCopy(k.tenFile, thuMuc); }
    catch (e) { throw new Error('Không chép được sheet mẫu. Kiểm tra lại link mẫu trong Cài đặt.'); }
  } else {
    var moi = SpreadsheetApp.create(k.tenFile);
    file = DriveApp.getFileById(moi.getId());
    file.moveTo(thuMuc);
  }
  var ss = SpreadsheetApp.openById(file.getId());
  var sh = ss.getSheets()[0];
  var v = sh.getDataRange().getValues();
  var td = timTieuDeMauLog(v);
  if (!td) {
    // Mẫu không có dòng tiêu đề nhận ra được: tự tạo tiêu đề ở dòng đầu tiên còn trống.
    var dongTrong = sh.getLastRow() ? sh.getLastRow() + 1 : 0;
    td = { dong: dongTrong, cot: { stt: 0, ten: 1, ban: 2, sdt: 3 }, cotBuoi: 4 };
    sh.getRange(dongTrong + 1, 1, 1, 4).setValues([['STT', 'Họ và tên', 'Ban', 'Số điện thoại']]).setFontWeight('bold').setBackground('#274e13').setFontColor('#ffffff');
  }
  var dongDau = td.dong + 2; // dòng dữ liệu đầu tiên (đánh số từ 1)
  var canDong = dongDau + k.nguoi.length - 1;
  if (sh.getMaxRows() < canDong) sh.insertRowsAfter(sh.getMaxRows(), canDong - sh.getMaxRows());
  var canCot = td.cotBuoi + k.buoi.length;
  if (sh.getMaxColumns() < canCot) sh.insertColumnsAfter(sh.getMaxColumns(), canCot - sh.getMaxColumns());

  var ghiCot = function (c, giaTri, chu) {
    if (c === undefined) return;
    var o = sh.getRange(dongDau, c + 1, giaTri.length, 1);
    if (chu) o.setNumberFormat('@');
    o.setValues(giaTri.map(function (x) { return [x]; }));
  };
  ghiCot(td.cot.stt, k.nguoi.map(function (_, i) { return i + 1; }));
  ghiCot(td.cot.ten, k.nguoi.map(function (t) { return String(t.HoVaTen); }), true);
  ghiCot(td.cot.ban, k.nguoi.map(function (t) { return String(t.Ban); }), true);
  ghiCot(td.cot.sdt, k.nguoi.map(function (t) { return String(t.SoDienThoaiCaNhan || ''); }), true);

  var oTieuDe = sh.getRange(td.dong + 1, td.cotBuoi + 1, 1, k.buoi.length);
  if (td.cotBuoi > 0) sh.getRange(td.dong + 1, td.cotBuoi).copyTo(oTieuDe, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  oTieuDe.setValues([k.buoi]);
  sh.getRange(dongDau, td.cotBuoi + 1, k.nguoi.length, k.buoi.length).insertCheckboxes();
  SpreadsheetApp.flush();

  var url = ss.getUrl();
  themDong('FileLog', [{ ThoiGian: new Date(), TenFile: k.tenFile, DuongDan: url, SoNguoi: k.nguoi.length, SoBuoi: k.buoi.length, NguoiTao: String(tk.HoVaTen) }]);
  return { url: url, ten: k.tenFile };
}

function luuCaiDatLog(phien, cd) {
  canDangNhap(phien, 'caidat');
  cd = cd || {};
  var mau = String(cd.linkMau || '').trim(), thuMuc = String(cd.linkThuMuc || '').trim();
  if (mau) {
    var m = maTuLink(mau);
    try { SpreadsheetApp.openById(m); } catch (e) { throw new Error('Không mở được sheet mẫu. Kiểm tra link và quyền truy cập của tài khoản CLB.'); }
  }
  if (thuMuc) {
    try { DriveApp.getFolderById(maTuLink(thuMuc)).getName(); } catch (e) { throw new Error('Không mở được thư mục. Kiểm tra link và quyền truy cập của tài khoản CLB.'); }
  }
  datCaiDat('LinkMauLog', mau);
  datCaiDat('LinkThuMucLog', thuMuc);
  return true;
}
