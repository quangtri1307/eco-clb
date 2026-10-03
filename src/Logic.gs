/**
 * Các hàm xử lý thuần (không gọi dịch vụ Google), dùng chung cho cả hệ thống.
 * Tách riêng để kiểm tra được bằng máy tính (xem thư mục tests).
 */

/** Cột của sheet nguồn danh sách thành viên: [tên cột trong hệ thống, tên cột trên sheet nguồn]. */
var COT_THANH_VIEN = [
  ['HoVaTen', 'Họ và tên'],
  ['Lop', 'Lớp'],
  ['Ban', 'Ban'],
  ['ChucVu', 'Chức vụ'],
  ['NgaySinh', 'Ngày sinh'],
  ['SoDienThoaiCaNhan', 'Số điện thoại cá nhân'],
  ['SoDienThoaiPhuHuynh', 'Số điện thoại phụ huynh'],
  ['Email', 'Email'],
  ['LinkFacebook', 'Link Facebook'],
  ['TenFacebook', 'Tên Facebook'],
  ['NoiSong', 'Nơi sống']
];

/** Cột bắt buộc phải có trên sheet nguồn. */
var COT_BAT_BUOC = ['HoVaTen', 'Ban'];

/** Các tab trong file dữ liệu và tên cột của từng tab. */
var BANG = {
  ThanhVien: COT_THANH_VIEN.map(function (c) { return c[0]; }),
  ThanhVienCu: COT_THANH_VIEN.map(function (c) { return c[0]; }).concat(['NgayRoi']),
  LichSuDiem: ['ThoiGian', 'HoVaTen', 'LoaiHoatDong', 'TenHoatDong', 'Diem', 'NguoiCong', 'NhiemKy', 'HocKy'],
  KyHoatDong: ['NhiemKy', 'HocKy', 'BatDau', 'KieuTaiLen'],
  LuuTruThanhVien: ['NhiemKy', 'HocKy', 'HoVaTen', 'Ban'],
  LoaiHoatDong: ['TenLoai', 'Diem', 'CongTay'],
  BangGhim: ['TieuDe', 'DuongDan'],
  GopY: ['ThoiGian', 'NoiDung', 'DaDoc'],
  TaiKhoan: ['Email', 'HoVaTen', 'VaiTro', 'MatKhau', 'Muoi', 'NgayTao', 'NhanThongBao', 'GiaoDien', 'BanQuanLy'],
  CaiDat: ['Khoa', 'GiaTri'],
  Task: ['ThoiGianTao', 'TenTask', 'MoTa', 'HanChot', 'NguoiPhuTrach', 'NguoiTao', 'KieuTao', 'TrangThai', 'ThoiGianXong'],
  KetNoiZalo: ['HoVaTen', 'MaKetNoi', 'ChatId', 'TenZalo', 'ThoiGianKetNoi'],
  ViecMail: ['ThoiGian', 'NguoiTao', 'ThaoTac', 'MaThu', 'TieuDeThu', 'Den', 'Cc', 'Bcc', 'TieuDe', 'NoiDung', 'Nhan', 'DinhKem', 'TrangThai', 'GhiChu', 'NguoiDuyet', 'ThoiGianDuyet', 'TuyChon'],
  DanhBa: ['Nhom', 'Ten', 'Email', 'GhiChu'],
  LichGui: ['ThoiGianTao', 'ThoiGianGui', 'TieuDe', 'NoiDung', 'NguoiNhan', 'MoTaNguon', 'NguoiTao', 'TrangThai', 'KetQua', 'MaNhap'],
  FileLog: ['ThoiGian', 'TenFile', 'DuongDan', 'SoNguoi', 'SoBuoi', 'NguoiTao'],
  ThietBi: ['Email', 'DiaChi', 'Khoa', 'TenMay', 'ThoiGian', 'LayCuoi', 'P256dh', 'Auth'],
  ThongBao: ['ThoiGian', 'Email', 'TieuDe', 'NoiDung']
};

/**
 * Cập nhật tab Thành viên cũ khi tải danh sách mới: ai có trong danh sách cũ mà không còn trong danh sách mới
 * thì giữ lại hồ sơ đầy đủ kèm ngày rời; ai quay lại CLB thì bỏ khỏi Thành viên cũ. So theo họ tên (không phân biệt hoa thường).
 * Trả về { ds: các dòng Thành viên cũ mới, soMoiRoi }.
 */
function capNhatThanhVienCu_(cu, moi, daRoi, bayGio) {
  var k = function (t) { return String(t.HoVaTen || '').trim().toLowerCase(); };
  var conLai = {};
  moi.forEach(function (t) { conLai[k(t)] = true; });
  var roi = cu.filter(function (t) { return k(t) && !conLai[k(t)]; });
  var moiRoi = {};
  roi.forEach(function (t) { moiRoi[k(t)] = true; });
  var ds = daRoi.filter(function (t) { return k(t) && !conLai[k(t)] && !moiRoi[k(t)]; });
  roi.forEach(function (t) {
    var dong = { NgayRoi: bayGio };
    COT_THANH_VIEN.forEach(function (c) { dong[c[0]] = t[c[0]] == null ? '' : t[c[0]]; });
    ds.push(dong);
  });
  return { ds: ds, soMoiRoi: roi.length };
}

/** Ba kiểu tải danh sách thành viên ở phần hậu kỳ. */
var KIEU_TAI = {
  DOT1: 'Sau tuyển đợt 1',
  DOT2: 'Sau tuyển đợt 2',
  CAP_NHAT: 'Cập nhật'
};

/** Bỏ dấu tiếng Việt. */
function boDau_(s) {
  return String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** Đưa tên cột về dạng so sánh được: bỏ dấu, chữ thường, bỏ khoảng trắng và ký tự lạ. */
function chuanHoaTenCot_(s) {
  return boDau_(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Gộp ban theo chữ đầu: "PR CAP" -> "PR", "BOD" -> "BOD". */
function nhomBan_(ban) {
  var s = String(ban == null ? '' : ban).trim().toUpperCase();
  return s.split(/\s+/)[0] || '';
}

/** Thứ tự chuẩn của các ban, dùng ở mọi chỗ liệt kê theo ban trong hai app. */
var THU_TU_BAN = ['BOD', 'PG', 'PR CAP', 'PR DES', 'PR PHO', 'AD', 'HR'];

/**
 * Vị trí của một ban (hoặc một nhóm như "PR") trong thứ tự chuẩn.
 * Ban mới cùng nhóm với ban đã có (ví dụ "PR MKT") đứng ngay sau nhóm đó; ban lạ hẳn đứng cuối.
 */
function hangBan_(ban) {
  var s = String(ban == null ? '' : ban).trim().toUpperCase().replace(/\s+/g, ' ');
  var i = THU_TU_BAN.indexOf(s);
  if (i >= 0) return i;
  var nhom = nhomBan_(s), cuoi = -1;
  THU_TU_BAN.forEach(function (b, j) { if (nhomBan_(b) === nhom) cuoi = j; });
  return cuoi >= 0 ? cuoi + 0.5 : THU_TU_BAN.length;
}

/** So sánh hai tên ban theo thứ tự chuẩn; ban lạ thì xếp theo chữ cái. */
function soSanhBan_(a, b) {
  return (hangBan_(a) - hangBan_(b)) || String(a || '').trim().toUpperCase().localeCompare(String(b || '').trim().toUpperCase());
}

/** Xếp danh sách thành viên (có Ban hoặc ban) theo thứ tự ban chuẩn; cùng ban thì giữ thứ tự cũ. */
function xepThanhVienTheoBan_(ds) {
  var banCua = function (t) { return t.Ban !== undefined ? t.Ban : t.ban; };
  return ds.map(function (t, i) { return { t: t, i: i }; })
    .sort(function (a, b) { return soSanhBan_(banCua(a.t), banCua(b.t)) || a.i - b.i; })
    .map(function (x) { return x.t; });
}

/**
 * Tìm dòng tiêu đề và vị trí các cột theo tên (không phụ thuộc thứ tự cột).
 * @param {Array<Array>} values toàn bộ dữ liệu của tab nguồn
 * @return {{dongTieuDe:number, viTri:Object, thieu:Array<string>}}
 */
function nhanDienCot_(values) {
  var nhan = {};
  COT_THANH_VIEN.forEach(function (c) { nhan[chuanHoaTenCot_(c[1])] = c[0]; });
  var gioiHan = Math.min(values.length, 10);
  for (var r = 0; r < gioiHan; r++) {
    var viTri = {};
    values[r].forEach(function (o, i) {
      var khoa = nhan[chuanHoaTenCot_(o)];
      if (khoa && viTri[khoa] === undefined) viTri[khoa] = i;
    });
    if (viTri.HoVaTen !== undefined) {
      var thieu = COT_BAT_BUOC.filter(function (k) { return viTri[k] === undefined; })
        .map(function (k) { return tenHienThiCot_(k); });
      return { dongTieuDe: r, viTri: viTri, thieu: thieu };
    }
  }
  return { dongTieuDe: -1, viTri: {}, thieu: COT_BAT_BUOC.map(tenHienThiCot_) };
}

function tenHienThiCot_(khoa) {
  for (var i = 0; i < COT_THANH_VIEN.length; i++) if (COT_THANH_VIEN[i][0] === khoa) return COT_THANH_VIEN[i][1];
  return khoa;
}

/**
 * Đọc danh sách thành viên từ dữ liệu sheet nguồn.
 * Bỏ dòng trống tên, báo lỗi nếu trùng tên.
 * @return {{thanhVien:Array<Object>, loi:Array<string>}}
 */
function docDanhSachThanhVien_(values) {
  var nd = nhanDienCot_(values);
  if (nd.thieu.length) {
    return { thanhVien: [], loi: ['Không tìm thấy cột: ' + nd.thieu.join(', ') + '. Kiểm tra lai tên cột trên sheet nguồn.'] };
  }
  var ds = [];
  var loi = [];
  var daCo = {};
  for (var r = nd.dongTieuDe + 1; r < values.length; r++) {
    var dong = values[r];
    var tv = {};
    COT_THANH_VIEN.forEach(function (c) {
      var i = nd.viTri[c[0]];
      var v = i === undefined ? '' : dong[i];
      tv[c[0]] = typeof v === 'string' ? v.trim() : v;
    });
    tv.HoVaTen = String(tv.HoVaTen || '').replace(/\s+/g, ' ').trim();
    if (!tv.HoVaTen) continue;
    tv.Ban = String(tv.Ban || '').trim();
    tv.Email = String(tv.Email || '').trim().toLowerCase();
    var khoa = tv.HoVaTen.toLowerCase();
    if (daCo[khoa]) {
      loi.push('Tên bị trùng: ' + tv.HoVaTen + ' (dòng ' + (r + 1) + ').');
      continue;
    }
    daCo[khoa] = true;
    ds.push(tv);
  }
  if (!ds.length && !loi.length) loi.push('Sheet nguồn không có thành viên nào.');
  return { thanhVien: ds, loi: loi };
}

/** Tên nhiệm kỳ theo năm học: từ tháng 8 trở đi tính là năm học mới. */
function tenNhiemKy_(ngay) {
  var y = ngay.getFullYear();
  return ngay.getMonth() >= 7 ? y + '-' + (y + 1) : (y - 1) + '-' + y;
}

/**
 * Tính kỳ hoạt động sau khi tải danh sách.
 * @param {?{NhiemKy:string, HocKy:number}} kyHienTai
 * @return {?{NhiemKy:string, HocKy:number}} kỳ mới, hoặc null nếu kiểu tải không mở kỳ mới
 */
function tinhKyMoi_(kyHienTai, kieu, ngay) {
  if (kieu === KIEU_TAI.DOT1) return { NhiemKy: tenNhiemKy_(ngay), HocKy: 1 };
  if (kieu === KIEU_TAI.DOT2) {
    return { NhiemKy: kyHienTai ? String(kyHienTai.NhiemKy) : tenNhiemKy_(ngay), HocKy: 2 };
  }
  return null;
}

/** Biến các dòng của một tab (có dòng tiêu đề) thành danh sách đối tượng. */
/** Chuyển một bảng thành chữ để cất vào bộ nhớ tạm, và đổi ngược lại. Ô ngày giờ vẫn giữ là ngày giờ. */
function maHoaBang_(ds) {
  return JSON.stringify(ds.map(function (o) {
    var x = {};
    Object.keys(o).forEach(function (k) { var v = o[k]; x[k] = Object.prototype.toString.call(v) === '[object Date]' ? { $ngay: v.getTime() } : v; });
    return x;
  }));
}
function giaiMaBang_(chuoi) {
  return JSON.parse(chuoi, function (k, v) {
    return v && typeof v === 'object' && typeof v.$ngay === 'number' && Object.keys(v).length === 1 ? new Date(v.$ngay) : v;
  });
}

function dongThanhDoiTuong_(values) {
  if (!values || values.length < 2) return [];
  var tieuDe = values[0];
  return values.slice(1).filter(function (d) {
    return d.some(function (o) { return o !== '' && o !== null; });
  }).map(function (d) {
    var o = {};
    tieuDe.forEach(function (t, i) { if (t) o[t] = d[i]; });
    return o;
  });
}

function cungKy_(dong, nhiemKy, hocKy) {
  return String(dong.NhiemKy) === String(nhiemKy) && Number(dong.HocKy) === Number(hocKy);
}

/**
 * Dữ liệu công khai cho ECOBoard. Chỉ có họ tên, lớp, ban và điểm.
 * @param {Array<Object>} thanhVien
 * @param {Array<Object>} lichSu các dòng LichSuDiem
 * @param {?Object} ky kỳ hiện tại
 * @param {Array<Object>} luuTru các dòng LuuTruThanhVien
 */
function tongHopBangDiem_(thanhVien, lichSu, ky, luuTru) {
  if (!ky) return [];
  var tong = {};
  var tongHk1 = {};
  lichSu.forEach(function (d) {
    var ten = String(d.HoVaTen).toLowerCase();
    var diem = Number(d.Diem) || 0;
    if (cungKy_(d, ky.NhiemKy, ky.HocKy)) tong[ten] = (tong[ten] || 0) + diem;
    if (Number(ky.HocKy) === 2 && cungKy_(d, ky.NhiemKy, 1)) tongHk1[ten] = (tongHk1[ten] || 0) + diem;
  });
  var coHk1 = {};
  if (Number(ky.HocKy) === 2) {
    luuTru.forEach(function (d) {
      if (cungKy_(d, ky.NhiemKy, 1)) coHk1[String(d.HoVaTen).toLowerCase()] = true;
    });
  }
  return thanhVien.map(function (tv) {
    var ten = String(tv.HoVaTen).toLowerCase();
    return {
      ten: String(tv.HoVaTen),
      lop: String(tv.Lop || ''),
      ban: String(tv.Ban || ''),
      nhom: nhomBan_(tv.Ban),
      diem: tong[ten] || 0,
      diemHk1: coHk1[ten] ? (tongHk1[ten] || 0) : null
    };
  });
}

/** Lịch sử cộng điểm công khai của một người trong một học kỳ, mới nhất trước. */
function lichSuCongKhai_(lichSu, ten, nhiemKy, hocKy) {
  var k = String(ten).toLowerCase();
  return lichSu.filter(function (d) {
    return String(d.HoVaTen).toLowerCase() === k && cungKy_(d, nhiemKy, hocKy);
  }).map(function (d) {
    var t = d.ThoiGian instanceof Date ? d.ThoiGian : new Date(d.ThoiGian);
    return { thoiGian: t.getTime(), loai: String(d.LoaiHoatDong), ten: String(d.TenHoatDong || ''), diem: Number(d.Diem) || 0 };
  }).sort(function (a, b) { return b.thoiGian - a.thoiGian; });
}

/** Chỉ giữ link bắt đầu bằng http:// hoặc https://. */
function linkHopLe_(s) {
  return /^https?:\/\/\S+$/i.test(String(s || '').trim());
}

/** Kiểm tra nội dung góp ý. Trả về chuỗi lỗi, hoặc '' nếu hợp lệ. */
function kiemTraGopY_(noiDung) {
  var s = String(noiDung == null ? '' : noiDung).trim();
  if (!s) return 'Bạn chưa viết góp ý.';
  if (s.length > 2000) return 'Góp ý dài quá 2000 ký tự, bạn rút gọn giúp nhé.';
  return '';
}

/** Người thuộc BOD không tham gia cộng điểm và không có trong báo cáo. */
function khongPhaiBod_(tv) {
  return nhomBan_(tv.Ban !== undefined ? tv.Ban : tv.ban) !== 'BOD';
}

/** Danh sách tài khoản BOD cần có theo danh sách thành viên mới (Ban = BOD, có email). */
function taiKhoanBodCanCo_(thanhVien) {
  return thanhVien.filter(function (tv) {
    return nhomBan_(tv.Ban) === 'BOD' && tv.Email;
  }).map(function (tv) { return { Email: tv.Email, HoVaTen: tv.HoVaTen }; });
}

/* ===================== ECODesk ===================== */

/** Chức năng mỗi vai trò được dùng. */
var QUYEN = {
  BOD: ['congdiem', 'task', 'mail', 'duyetmail', 'baocao', 'gopy', 'log', 'caidat'],
  HR: ['task'],
  UCV: ['mail', 'hopthu']
};

function coQuyen_(vaiTro, chucNang) {
  return (QUYEN[vaiTro] || []).indexOf(chucNang) >= 0;
}

/** Các ban một HR quản lý, lưu dạng "PG, AD" (theo nhóm: PR gồm PR CAP, PR DES, PR PHO). Trống là chưa phân ban. */
function banQuanLy_(giaTri) {
  var ds = [];
  String(giaTri == null ? '' : giaTri).split(/[,;]/).forEach(function (s) { var n = nhomBan_(s); if (n && ds.indexOf(n) < 0) ds.push(n); });
  return ds.sort(soSanhBan_);
}

/**
 * Bộ lọc task cho một tài khoản: trả về hàm (tên người phụ trách) → được xem và thao tác hay không.
 * BOD và HR chưa phân ban: mọi task. HR đã phân ban: task của chính mình, của các ban mình quản lý,
 * và của ban (không phải BOD) chưa có HR nào quản lý, để không task nào bị bỏ sót.
 * nhomCua: { họ tên: nhóm ban }.
 */
function boLocTaskHr_(tk, taiKhoan, nhomCua) {
  var cuaToi = banQuanLy_(tk.BanQuanLy);
  if (String(tk.VaiTro) !== 'HR' || !cuaToi.length) return function () { return true; };
  var coHr = {};
  (taiKhoan || []).forEach(function (t) { if (String(t.VaiTro) === 'HR') banQuanLy_(t.BanQuanLy).forEach(function (b) { coHr[b] = true; }); });
  return function (ten) {
    if (String(ten) === String(tk.HoVaTen)) return true;
    var n = nhomCua[String(ten)] || '';
    return cuaToi.indexOf(n) >= 0 || (n !== 'BOD' && !coHr[n]);
  };
}

/** Trả về chuỗi lỗi, hoặc '' nếu mật khẩu mới hợp lệ. */
function kiemTraMatKhauMoi_(mk) {
  var s = String(mk == null ? '' : mk);
  if (s.length < 6) return 'Mật khẩu cần ít nhất 6 ký tự.';
  if (s.length > 100) return 'Mật khẩu dài quá.';
  return '';
}

/**
 * Tạo các dòng LichSuDiem cho một lần cộng điểm.
 * Điểm lấy theo loại hoạt động tại lúc cộng; người được cộng phải có trong danh sách thành viên.
 * @return {{dong:Array<Object>, loi:string}}
 */
function taoDongCongDiem_(yeuCau, thanhVien, loaiHoatDong, nguoiCong, ky, bayGio) {
  if (!ky) return { dong: [], loi: 'Chưa có học kỳ nào. Hãy tải danh sách thành viên kiểu "Sau tuyển đợt 1" trước.' };
  var loai = null;
  loaiHoatDong.forEach(function (l) { if (String(l.TenLoai) === String(yeuCau.loai)) loai = l; });
  if (!loai) return { dong: [], loi: 'Không có loại hoạt động "' + yeuCau.loai + '".' };
  var ds = (yeuCau.nguoi || []).map(function (n) { return String(n); });
  if (!ds.length) return { dong: [], loi: 'Bạn chưa chọn ai.' };
  var tenDung = {};
  thanhVien.forEach(function (tv) { tenDung[String(tv.HoVaTen).toLowerCase()] = String(tv.HoVaTen); });
  var khongCo = ds.filter(function (n) { return !tenDung[n.toLowerCase()]; });
  if (khongCo.length) return { dong: [], loi: 'Không có trong danh sách thành viên: ' + khongCo.join(', ') + '.' };
  var daCo = {};
  var dong = [];
  ds.forEach(function (n) {
    var k = n.toLowerCase();
    if (daCo[k]) return;
    daCo[k] = true;
    dong.push({
      ThoiGian: bayGio, HoVaTen: tenDung[k], LoaiHoatDong: String(loai.TenLoai),
      TenHoatDong: String(yeuCau.tenHoatDong || '').trim().slice(0, 200), Diem: Number(loai.Diem) || 0,
      NguoiCong: nguoiCong, NhiemKy: String(ky.NhiemKy), HocKy: Number(ky.HocKy)
    });
  });
  return { dong: dong, loi: '' };
}

/** Kiểm tra danh sách loại hoạt động do BOD sửa. */
function chuanHoaLoaiHoatDong_(ds) {
  var kq = [];
  var daCo = {};
  for (var i = 0; i < (ds || []).length; i++) {
    var ten = String(ds[i].ten == null ? '' : ds[i].ten).trim();
    var diem = Number(ds[i].diem);
    if (!ten) continue;
    if (daCo[ten.toLowerCase()]) return { ds: [], loi: 'Loại "' + ten + '" bị trùng.' };
    if (!isFinite(diem) || diem < 0) return { ds: [], loi: 'Điểm của "' + ten + '" phải là số không âm.' };
    daCo[ten.toLowerCase()] = true;
    // CongTay = false: chỉ hiện trên ECOBoard (ví dụ điểm cộng tự động qua form), BOD không chọn được khi cộng điểm.
    kq.push({ TenLoai: ten, Diem: diem, CongTay: ds[i].congTay === false ? 'khong' : 'co' });
  }
  if (!kq.length) return { ds: [], loi: 'Cần ít nhất một loại hoạt động.' };
  return { ds: kq, loi: '' };
}

/** Kiểm tra danh sách link ghim do BOD sửa. */
function chuanHoaGhim_(ds) {
  var kq = [];
  for (var i = 0; i < (ds || []).length; i++) {
    var tieuDe = String(ds[i].tieuDe == null ? '' : ds[i].tieuDe).trim();
    var link = String(ds[i].link == null ? '' : ds[i].link).trim();
    if (!tieuDe && !link) continue;
    if (!linkHopLe_(link)) return { ds: [], loi: 'Link "' + (tieuDe || link) + '" phải bắt đầu bằng http:// hoặc https://' };
    kq.push({ TieuDe: tieuDe || link, DuongDan: link });
  }
  return { ds: kq, loi: '' };
}

/* ===================== Task ===================== */

/** Trạng thái lưu trong sheet chỉ có Đã giao, Đã xong, Đã huỷ. Sắp đến hạn và Trễ hạn được tính từ hạn chót. */
var TRANG_THAI_TASK = { GIAO: 'Đã giao', SAP: 'Sắp đến hạn', TRE: 'Trễ hạn', XONG: 'Đã xong', HUY: 'Đã huỷ' };

/** Ngày dạng yyyy-mm-dd có thật hay không. */
function ngayHopLe_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return false;
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Số ngày từ ngày "tu" đến ngày "den" (cả hai dạng yyyy-mm-dd). */
function soNgayGiua_(tu, den) {
  var a = String(tu).split('-'), b = String(den).split('-');
  return Math.round((Date.UTC(+b[0], +b[1] - 1, +b[2]) - Date.UTC(+a[0], +a[1] - 1, +a[2])) / 864e5);
}

/** yyyy-mm-dd → dd/mm/yyyy */
function hienNgay_(s) {
  var p = String(s).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(s);
}

function trangThaiTask_(trangThaiLuu, hanChot, homNay, soNgaySapDenHan) {
  if (trangThaiLuu === TRANG_THAI_TASK.XONG || trangThaiLuu === TRANG_THAI_TASK.HUY) return trangThaiLuu;
  if (!ngayHopLe_(hanChot)) return TRANG_THAI_TASK.GIAO;
  var conLai = soNgayGiua_(homNay, hanChot);
  if (conLai < 0) return TRANG_THAI_TASK.TRE;
  if (conLai <= soNgaySapDenHan) return TRANG_THAI_TASK.SAP;
  return TRANG_THAI_TASK.GIAO;
}

/** Kiểm tra nội dung task. Trả về { loi, ten, moTa, hanChot, nguoi[] } với tên người đã chuẩn theo danh sách. */
function kiemTraTask_(yeuCau, thanhVien) {
  yeuCau = yeuCau || {};
  var ten = String(yeuCau.ten || '').replace(/\s+/g, ' ').trim();
  var moTa = String(yeuCau.moTa || '').trim();
  var hanChot = String(yeuCau.hanChot || '').trim();
  if (!ten) return { loi: 'Bạn chưa nhập tên task.' };
  if (ten.length > 200) return { loi: 'Tên task dài quá 200 ký tự.' };
  if (moTa.length > 2000) return { loi: 'Mô tả dài quá 2000 ký tự.' };
  if (!ngayHopLe_(hanChot)) return { loi: 'Hạn chót chưa đúng.' };
  var theoTen = {};
  thanhVien.forEach(function (tv) { theoTen[String(tv.HoVaTen).toLowerCase()] = String(tv.HoVaTen); });
  var nguoi = [], daCo = {};
  var vao = yeuCau.nguoi || [];
  for (var i = 0; i < vao.length; i++) {
    var chuan = theoTen[String(vao[i]).trim().toLowerCase()];
    if (!chuan) return { loi: 'Không có "' + vao[i] + '" trong danh sách thành viên.' };
    if (!daCo[chuan]) { daCo[chuan] = true; nguoi.push(chuan); }
  }
  if (!nguoi.length) return { loi: 'Bạn chưa chọn người phụ trách.' };
  return { loi: '', ten: ten, moTa: moTa, hanChot: hanChot, nguoi: nguoi };
}

/** Tạo các dòng task, mỗi người phụ trách một dòng. BOD tạo là "Giao task", ban nhân sự tạo là "Nhập task". */
function taoDongTask_(yeuCau, thanhVien, nguoiTao, vaiTro, bayGio) {
  var k = kiemTraTask_(yeuCau, thanhVien);
  if (k.loi) return { dong: [], loi: k.loi };
  return {
    loi: '',
    dong: k.nguoi.map(function (n) {
      return {
        ThoiGianTao: bayGio, TenTask: k.ten, MoTa: k.moTa, HanChot: k.hanChot, NguoiPhuTrach: n,
        NguoiTao: nguoiTao, KieuTao: vaiTro === 'BOD' ? 'Giao task' : 'Nhập task', TrangThai: TRANG_THAI_TASK.GIAO, ThoiGianXong: ''
      };
    })
  };
}

/* ===================== Nhắc việc qua Zalo ===================== */

var NHAC_TRE = { MOI_NGAY: 'Mỗi ngày', MOT_LAN: 'Chỉ một lần', KHONG: 'Không nhắc' };

/**
 * Chọn task cần nhắc hôm nay. ds: [{ ten, nguoi, hanChot, trangThai }] (trangThai đã tính).
 * caiDat: { nhacSapDenHan: true/false, nhacTre: một giá trị của NHAC_TRE }.
 */
function chonTaskCanNhac_(ds, homNay, caiDat) {
  return ds.filter(function (t) {
    if (t.trangThai === TRANG_THAI_TASK.SAP) return !!caiDat.nhacSapDenHan;
    if (t.trangThai !== TRANG_THAI_TASK.TRE) return false;
    if (caiDat.nhacTre === NHAC_TRE.MOI_NGAY) return true;
    if (caiDat.nhacTre === NHAC_TRE.MOT_LAN) return soNgayGiua_(t.hanChot, homNay) === 1;
    return false;
  });
}

/** Mô tả hạn của một task, ví dụ "trễ 2 ngày", "hạn hôm nay", "còn 1 ngày". */
function moTaHan_(hanChot, homNay) {
  var d = soNgayGiua_(homNay, hanChot);
  if (d < 0) return 'trễ ' + (-d) + ' ngày';
  if (d === 0) return 'hạn hôm nay';
  return 'còn ' + d + ' ngày';
}

/**
 * Soạn tin nhắc. laNhanSu = true: tin cho ban nhân sự, có tên người phụ trách để nhắc lại qua Messenger.
 * Trả về '' nếu không có gì cần nhắc.
 */
function soanTinNhac_(tenNguoiNhan, ds, homNay, laNhanSu) {
  if (!ds.length) return '';
  var sx = ds.slice().sort(function (a, b) { return a.hanChot < b.hanChot ? -1 : a.hanChot > b.hanChot ? 1 : 0; });
  var dau = laNhanSu
    ? 'ECODesk nhắc việc. Chào ' + tenNguoiNhan + ', nhờ bạn nhắc các bạn sau qua Messenger:'
    : 'ECODesk nhắc việc. Chào ' + tenNguoiNhan + ', bạn có ' + ds.length + ' task cần chú ý:';
  return dau + '\n' + sx.map(function (t) {
    return '• ' + (laNhanSu ? t.nguoi + ': ' : '') + t.ten + ' (hạn ' + hienNgay_(t.hanChot) + ', ' + moTaHan_(t.hanChot, homNay) + ')';
  }).join('\n');
}

/** Chia tin dài thành nhiều tin, mỗi tin không quá "toiDa" ký tự, ưu tiên cắt ở chỗ xuống dòng. */
function chiaTin_(tin, toiDa) {
  var kq = [], cur = '';
  String(tin).split('\n').forEach(function (dong) {
    while (dong.length > toiDa) {
      if (cur) { kq.push(cur); cur = ''; }
      kq.push(dong.slice(0, toiDa));
      dong = dong.slice(toiDa);
    }
    if (cur && (cur.length + 1 + dong.length) > toiDa) { kq.push(cur); cur = dong; }
    else cur = cur ? cur + '\n' + dong : dong;
  });
  if (cur) kq.push(cur);
  return kq;
}

/** Tìm mã kết nối trong tin nhắn người dùng gửi bot. Trả về mã khớp hoặc ''. */
function timMaTrongTin_(tin, dsMa) {
  var chu = String(tin || '').toUpperCase().replace(/[^A-Z0-9]/g, ' ');
  var tu = chu.split(/\s+/);
  for (var i = 0; i < dsMa.length; i++) {
    if (dsMa[i] && tu.indexOf(String(dsMa[i]).toUpperCase()) >= 0) return dsMa[i];
  }
  return '';
}

/* ===================== Mail ===================== */

/** Các thao tác UCV được đề nghị. Mọi thao tác làm thay đổi hộp thư đều chờ BOD duyệt. */
var THAO_TAC_MAIL = {
  SOAN: 'Soạn thư mới', TRA_LOI: 'Trả lời', TRA_LOI_TAT_CA: 'Trả lời tất cả', CHUYEN_TIEP: 'Chuyển tiếp',
  LUU_TRU: 'Lưu trữ', VE_HOP_THU: 'Chuyển về hộp thư đến', XOA: 'Chuyển vào thùng rác',
  GAN_NHAN: 'Gắn nhãn', BO_NHAN: 'Bỏ nhãn', THU_RAC: 'Báo cáo thư rác'
};
var TRANG_THAI_VIEC = { NHAP: 'Nháp', CHO: 'Chờ duyệt', DUYET: 'Đã duyệt', SUA: 'Cần sửa lại', TU_CHOI: 'Từ chối', LOI: 'Lỗi khi thực hiện' };

function emailHopLe_(e) {
  return /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/.test(String(e || '').trim());
}

/** Tách chuỗi nhiều email (phẩy, chấm phẩy, xuống dòng, khoảng trắng). Trả về { ds, sai }. Bỏ trùng. */
function tachEmail_(chuoi) {
  var ds = [], sai = [], daCo = {};
  String(chuoi || '').split(/[\s,;]+/).forEach(function (x) {
    var m = /<([^>]+)>/.exec(x);
    var e = (m ? m[1] : x).trim().replace(/^mailto:/i, '');
    if (!e) return;
    if (!emailHopLe_(e)) { sai.push(e); return; }
    var k = e.toLowerCase();
    if (!daCo[k]) { daCo[k] = true; ds.push(e); }
  });
  return { ds: ds, sai: sai };
}

/** Kiểm tra một việc mail của UCV. Trả về '' nếu hợp lệ. */
function kiemTraViecMail_(v) {
  v = v || {};
  var tt = v.thaoTac;
  var hopLe = Object.keys(THAO_TAC_MAIL).some(function (k) { return THAO_TAC_MAIL[k] === tt; });
  if (!hopLe) return 'Thao tác không hợp lệ.';
  if (tt !== THAO_TAC_MAIL.SOAN && !v.maThu) return 'Thiếu thư cần thao tác.';
  if (tt === THAO_TAC_MAIL.SOAN || tt === THAO_TAC_MAIL.CHUYEN_TIEP) {
    var den = tachEmail_(v.den);
    if (den.sai.length) return 'Email chưa đúng: ' + den.sai.join(', ');
    if (!den.ds.length) return 'Bạn chưa nhập người nhận.';
  }
  var cc = tachEmail_(v.cc), bcc = tachEmail_(v.bcc);
  if (cc.sai.length || bcc.sai.length) return 'Email chưa đúng: ' + cc.sai.concat(bcc.sai).join(', ');
  if (tt === THAO_TAC_MAIL.SOAN && !String(v.tieuDe || '').trim()) return 'Bạn chưa nhập tiêu đề.';
  if ((tt === THAO_TAC_MAIL.SOAN || tt === THAO_TAC_MAIL.TRA_LOI || tt === THAO_TAC_MAIL.TRA_LOI_TAT_CA) && !String(v.noiDung || '').trim()) return 'Bạn chưa nhập nội dung.';
  if ((tt === THAO_TAC_MAIL.GAN_NHAN || tt === THAO_TAC_MAIL.BO_NHAN) && !String(v.nhan || '').trim()) return 'Bạn chưa chọn nhãn.';
  if (String(v.tieuDe || '').length > 250) return 'Tiêu đề dài quá 250 ký tự.';
  if (String(v.noiDung || '').length > 45000) return 'Nội dung dài quá. Nếu bạn dán từ nơi khác, thử dán lại không kèm định dạng (Ctrl+Shift+V).';
  return '';
}

/** Các chỗ {TenCot} có trong thư mẫu, theo thứ tự xuất hiện, không trùng. */
/** Chỗ chèn viết {Tên cột} hoặc {{Tên cột}} đều được. */
var CHO_CHEN_ = /\{\{([^{}\n]{1,60})\}\}|\{([^{}\n]{1,60})\}/g;
function timChoTrong_(chu) {
  var ds = [], re = new RegExp(CHO_CHEN_.source, 'g'), m;
  while ((m = re.exec(String(chu || '')))) { var ten = (m[1] || m[2]).trim(); if (ten && ds.indexOf(ten) < 0) ds.push(ten); }
  return ds;
}

/**
 * Thay {TenCot} bằng giá trị của người nhận. So khớp tên cột không phân biệt hoa thường, dấu và khoảng trắng.
 * Trả về { chu, thieu[] } với thieu là các chỗ không có cột tương ứng (giữ nguyên trong thư).
 */
function thayTheMau_(chu, duLieu) {
  var theoKhoa = {};
  Object.keys(duLieu || {}).forEach(function (k) { theoKhoa[chuanHoaTenCot_(k)] = duLieu[k]; });
  var thieu = [];
  var kq = String(chu || '').replace(new RegExp(CHO_CHEN_.source, 'g'), function (toan, ten2, ten1) {
    var ten = (ten2 || ten1).trim();
    var k = chuanHoaTenCot_(ten);
    if (Object.prototype.hasOwnProperty.call(theoKhoa, k)) return String(theoKhoa[k] == null ? '' : theoKhoa[k]);
    if (thieu.indexOf(ten) < 0) thieu.push(ten);
    return toan;
  });
  return { chu: kq, thieu: thieu };
}

/** Đổi thư chữ thường sang HTML đơn giản (giữ xuống dòng, link bấm được). */
function chuSangHtml_(chu) {
  var e = String(chu || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  e = e.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">' + e.replace(/\r?\n/g, '<br>') + '</div>';
}

/** Bỏ thẻ HTML, lấy chữ thường (dùng làm bản chữ của thư HTML và kiểm tra thư trống). */
function htmlSangChu_(html) {
  return String(html || '')
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Lọc HTML do người dùng soạn trước khi lưu và gửi: bỏ thẻ chạy được, thuộc tính on…, link javascript:.
 * Giao diện đã lọc một lần; đây là lớp chặn thứ hai ở máy chủ.
 */
function lamSachHtml_(html) {
  return String(html || '')
    .replace(/<(script|style|iframe|object|embed|form|textarea|select|button|meta|link|base|frame|frameset|applet|noscript)\b[\s\S]*?(<\/\1\s*>|$)/gi, '')
    .replace(/<\/?(script|style|iframe|object|embed|form|input|textarea|select|button|meta|link|base|frame|frameset|applet|noscript)\b[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*(javascript|vbscript|data(?!:image\/)):[^"']*\2/gi, '$1=$2#$2');
}

/** Đổi giá trị thành chữ an toàn để chèn vào HTML. */
function escHtmlChu_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Chuẩn bị gửi hàng loạt từ một thư nháp Gmail. mau: { tieuDe, html }; nguoiNhan: [{ email, duLieu{} }].
 * Thay {TenCot} ở tiêu đề và nội dung (giá trị chèn vào HTML được escape).
 * Trả về { ds[{email, tieuDe, html, chu}], loi }.
 */
function chuanBiGuiTuNhap_(mau, nguoiNhan, gioiHan) {
  mau = mau || {};
  if (!String(mau.tieuDe || '').trim()) return { ds: [], loi: 'Thư nháp chưa có tiêu đề. Mở Gmail, thêm tiêu đề cho thư nháp rồi thử lại.' };
  if (!htmlSangChu_(mau.html) && !/<img/i.test(String(mau.html || ''))) return { ds: [], loi: 'Thư nháp chưa có nội dung.' };
  var ds = [], daCo = {}, thieu = [], sai = [];
  (nguoiNhan || []).forEach(function (n) {
    var e = String(n.email || '').trim();
    if (!emailHopLe_(e)) { sai.push(e || '(trống)'); return; }
    if (daCo[e.toLowerCase()]) return;
    daCo[e.toLowerCase()] = true;
    var d = n.duLieu || {}, dHtml = {};
    Object.keys(d).forEach(function (k) { dHtml[k] = escHtmlChu_(d[k]); });
    var a = thayTheMau_(mau.tieuDe, d), b = thayTheMau_(mau.html, dHtml);
    a.thieu.concat(b.thieu).forEach(function (t) { if (thieu.indexOf(t) < 0) thieu.push(t); });
    ds.push({ email: e, tieuDe: a.chu, html: b.chu, chu: htmlSangChu_(b.chu) });
  });
  if (sai.length) return { ds: [], loi: 'Có ' + sai.length + ' email chưa đúng: ' + sai.slice(0, 5).join(', ') + (sai.length > 5 ? '…' : '') };
  if (thieu.length) return { ds: [], loi: 'Không tìm thấy thông tin cho: ' + thieu.map(function (t) { return '{' + t + '}'; }).join(', ') + '. Sửa thư nháp hoặc chọn nguồn có cột tương ứng.' };
  if (!ds.length) return { ds: [], loi: 'Chưa có người nhận nào.' };
  if (gioiHan != null && ds.length > gioiHan) return { ds: [], loi: 'Gửi ' + ds.length + ' thư nhưng hôm nay tài khoản CLB chỉ còn gửi được ' + gioiHan + ' thư. Bớt người nhận hoặc hẹn giờ sang ngày mai.' };
  return { ds: ds, loi: '' };
}

/**
 * Đọc bảng từ một sheet bất kỳ (dòng tiêu đề đầu tiên có chữ). Trả về { cot[], dong[{...}], cotEmail }.
 * cotEmail là cột đoán là email (tên có chữ "email"/"mail", hoặc cột có nhiều email nhất).
 */
function docBangNgoai_(giaTri) {
  var v = giaTri || [];
  var h = 0;
  while (h < v.length && h < 10 && !v[h].some(function (c) { return String(c).trim(); })) h++;
  if (h >= v.length) return { cot: [], dong: [], cotEmail: '' };
  var cot = v[h].map(function (c, i) { return String(c).trim() || ('Cột ' + (i + 1)); });
  var dong = [];
  for (var r = h + 1; r < v.length; r++) {
    if (!v[r].some(function (c) { return String(c).trim(); })) continue;
    var o = {};
    cot.forEach(function (c, i) { o[c] = v[r][i] instanceof Date ? v[r][i] : String(v[r][i] == null ? '' : v[r][i]).trim(); });
    dong.push(o);
  }
  var cotEmail = cot.filter(function (c) { return /e-?mail|mail/.test(boDau_(c).toLowerCase()); })[0] || '';
  if (!cotEmail) {
    var tot = 0;
    cot.forEach(function (c) {
      var n = dong.filter(function (d) { return emailHopLe_(d[c]); }).length;
      if (n > tot) { tot = n; cotEmail = c; }
    });
  }
  return { cot: cot, dong: dong, cotEmail: cotEmail };
}

/**
 * Chuẩn bị danh sách gửi hàng loạt. nguoiNhan: [{ email, duLieu{} }].
 * Trả về { ds[{email, tieuDe, noiDung}], loi } — báo lỗi nếu email sai, thiếu cột, hay vượt giới hạn.
 */
function chuanBiGuiHangLoat_(tieuDe, noiDung, nguoiNhan, gioiHan) {
  if (!String(tieuDe || '').trim()) return { ds: [], loi: 'Thư chưa có tiêu đề.' };
  if (!String(noiDung || '').trim()) return { ds: [], loi: 'Thư chưa có nội dung.' };
  var ds = [], daCo = {}, thieu = [], sai = [];
  (nguoiNhan || []).forEach(function (n) {
    var e = String(n.email || '').trim();
    if (!emailHopLe_(e)) { sai.push(e || '(trống)'); return; }
    if (daCo[e.toLowerCase()]) return;
    daCo[e.toLowerCase()] = true;
    var d = n.duLieu || {};
    var a = thayTheMau_(tieuDe, d), b = thayTheMau_(noiDung, d);
    a.thieu.concat(b.thieu).forEach(function (t) { if (thieu.indexOf(t) < 0) thieu.push(t); });
    ds.push({ email: e, tieuDe: a.chu, noiDung: b.chu });
  });
  if (sai.length) return { ds: [], loi: 'Có ' + sai.length + ' email chưa đúng: ' + sai.slice(0, 5).join(', ') + (sai.length > 5 ? '…' : '') };
  if (thieu.length) return { ds: [], loi: 'Không tìm thấy thông tin cho: ' + thieu.map(function (t) { return '{' + t + '}'; }).join(', ') + '. Sửa thư hoặc chọn nguồn có cột tương ứng.' };
  if (!ds.length) return { ds: [], loi: 'Chưa có người nhận nào.' };
  if (gioiHan != null && ds.length > gioiHan) return { ds: [], loi: 'Gửi ' + ds.length + ' thư nhưng hôm nay tài khoản CLB chỉ còn gửi được ' + gioiHan + ' thư. Bớt người nhận hoặc hẹn giờ sang ngày mai.' };
  return { ds: ds, loi: '' };
}

/* ===================== Báo cáo ===================== */

function laSeeding_(loai) { return boDau_(loai).toLowerCase().indexOf('seeding') >= 0; }

function tenHoatDongChuan_(t) {
  var x = String(t || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return x || '(không ghi)';
}

/**
 * Danh sách chỉ số của báo cáo: điểm, số lần mỗi loại hoạt động (Seeding tách theo tên hoạt động), task xong, task trễ hạn.
 * Trả về [{ khoa, ten }].
 */
function chiSoBaoCao_(loaiHoatDong, lichSu) {
  var ds = [{ khoa: 'diem', ten: 'Điểm' }];
  loaiHoatDong.forEach(function (l) {
    if (!laSeeding_(l)) { ds.push({ khoa: 'loai:' + l, ten: l }); return; }
    var ten = [];
    lichSu.forEach(function (d) { if (d.loai === l) { var t = tenHoatDongChuan_(d.tenHoatDong); if (ten.indexOf(t) < 0) ten.push(t); } });
    ten.sort();
    if (!ten.length) ds.push({ khoa: 'loai:' + l, ten: l });
    ten.forEach(function (t) { ds.push({ khoa: 'loai:' + l + ':' + t, ten: l + ' (' + t + ')' }); });
  });
  ds.push({ khoa: 'taskXong', ten: 'Task đã xong' });
  ds.push({ khoa: 'taskTre', ten: 'Task trễ hạn' });
  return ds;
}

function khoaChiSo_(d) {
  return laSeeding_(d.loai) ? 'loai:' + d.loai + ':' + tenHoatDongChuan_(d.tenHoatDong) : 'loai:' + d.loai;
}

/** Task có bị trễ hạn không (đã xong sau hạn, hoặc chưa xong mà quá hạn). */
function taskBiTre_(t, homNay) {
  if (t.trangThaiLuu === TRANG_THAI_TASK.HUY || !ngayHopLe_(t.hanChot)) return false;
  if (t.trangThaiLuu === TRANG_THAI_TASK.XONG) return !!t.ngayXong && t.ngayXong > t.hanChot;
  return homNay > t.hanChot;
}

/**
 * Tổng hợp báo cáo trong khoảng ngày [tu, den] (yyyy-mm-dd, tính cả hai đầu).
 * lichSu: [{ ngay, ten, loai, tenHoatDong, diem }]; task: [{ nguoi, hanChot, trangThaiLuu, ngayXong }];
 * thanhVien: [{ ten, ban, nhom }] (chỉ người còn trong CLB mới có trong báo cáo);
 * cheDo: 'thanhvien' | 'ban' | 'clb'.
 * Trả về { dong: [{ ten, ban, so: {khoa: số} }] }.
 */
function tongHopBaoCao_(lichSu, task, thanhVien, tu, den, cheDo, homNay) {
  var cuaAi = {};
  thanhVien.forEach(function (t) { cuaAi[t.ten] = t; });
  var nhom = function (ten) {
    var tv = cuaAi[ten];
    if (!tv) return null;
    if (cheDo === 'ban') return tv.nhom;
    if (cheDo === 'clb') return 'Cả CLB';
    return ten;
  };
  var bang = {}, thuTu = [];
  var dongCua = function (k) {
    if (!bang[k]) { bang[k] = { ten: k, ban: cheDo === 'thanhvien' ? cuaAi[k].ban : '', so: {} }; thuTu.push(k); }
    return bang[k];
  };
  // Mọi người / ban đều có dòng, kể cả khi bằng 0.
  thanhVien.forEach(function (t) { dongCua(nhom(t.ten)); });
  var cong = function (d, khoa, n) { d.so[khoa] = (d.so[khoa] || 0) + n; };
  lichSu.forEach(function (x) {
    if (x.ngay < tu || x.ngay > den) return;
    var k = nhom(x.ten);
    if (k === null) return;
    var d = dongCua(k);
    cong(d, 'diem', Number(x.diem) || 0);
    cong(d, khoaChiSo_(x), 1);
  });
  task.forEach(function (t) {
    var k = nhom(t.nguoi);
    if (k === null) return;
    var d = dongCua(k);
    if (t.trangThaiLuu === TRANG_THAI_TASK.XONG && t.ngayXong && t.ngayXong >= tu && t.ngayXong <= den) cong(d, 'taskXong', 1);
    if (t.hanChot >= tu && t.hanChot <= den && taskBiTre_(t, homNay)) cong(d, 'taskTre', 1);
  });
  return { dong: thuTu.map(function (k) { return bang[k]; }) };
}

/** Chia khoảng ngày thành các mốc: theo ngày (≤ 31 ngày), theo tuần (≤ 120 ngày), còn lại theo tháng. */
function chiaMoc_(tu, den) {
  var soNgay = soNgayGiua_(tu, den) + 1;
  var kieu = soNgay <= 31 ? 'ngay' : soNgay <= 120 ? 'tuan' : 'thang';
  var moc = [];
  var p = tu.split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  var chu = function (x) { return x.toISOString().slice(0, 10); };
  while (chu(d) <= den) {
    var batDau = chu(d), ketThuc, nhan;
    if (kieu === 'ngay') { ketThuc = batDau; nhan = batDau.slice(8, 10) + '/' + batDau.slice(5, 7); d.setUTCDate(d.getUTCDate() + 1); }
    else if (kieu === 'tuan') {
      var e = new Date(d); e.setUTCDate(e.getUTCDate() + (7 - ((e.getUTCDay() + 6) % 7)) - 1); // đến Chủ nhật
      ketThuc = chu(e) < den ? chu(e) : den; nhan = batDau.slice(8, 10) + '/' + batDau.slice(5, 7);
      d = new Date(e); d.setUTCDate(d.getUTCDate() + 1);
    } else {
      var c = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
      ketThuc = chu(c) < den ? chu(c) : den; nhan = batDau.slice(5, 7) + '/' + batDau.slice(0, 4);
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    }
    moc.push({ tu: batDau, den: ketThuc, nhan: nhan });
  }
  return { kieu: kieu, moc: moc };
}

/** Số liệu theo từng mốc cho biểu đồ: { moc[], chuoi: { tenDong: [ {khoa: số} theo mốc ] } }. */
function bieuDoBaoCao_(lichSu, task, thanhVien, tu, den, cheDo, homNay) {
  var c = chiaMoc_(tu, den);
  var chuoi = {};
  c.moc.forEach(function (m, i) {
    tongHopBaoCao_(lichSu, task, thanhVien, m.tu, m.den, cheDo, homNay).dong.forEach(function (d) {
      if (!chuoi[d.ten]) chuoi[d.ten] = c.moc.map(function () { return {}; });
      chuoi[d.ten][i] = d.so;
    });
  });
  return { kieu: c.kieu, moc: c.moc, chuoi: chuoi };
}

/* ===================== File đăng ký log ===================== */

/**
 * Tìm dòng tiêu đề trong sheet mẫu: dòng đầu (trong 15 dòng) có ô Họ và tên.
 * Trả về { dong, cot: { stt, ten, ban, sdt }, cotBuoi } (vị trí tính từ 0; cotBuoi là cột trống đầu tiên sau tiêu đề), hoặc null.
 */
function timTieuDeMauLog_(values) {
  var TEN = ['hovaten', 'hoten', 'ten', 'tenthanhvien'], BAN = ['ban'], SDT = ['sodienthoai', 'sdt', 'sodienthoaicanhan', 'dienthoai'], STT = ['stt', 'sothutu'];
  for (var r = 0; r < Math.min(values.length, 15); r++) {
    var cot = {}, cuoi = -1;
    values[r].forEach(function (o, i) {
      var k = chuanHoaTenCot_(o);
      if (k) cuoi = i;
      if (TEN.indexOf(k) >= 0 && cot.ten === undefined) cot.ten = i;
      else if (BAN.indexOf(k) >= 0 && cot.ban === undefined) cot.ban = i;
      else if (SDT.indexOf(k) >= 0 && cot.sdt === undefined) cot.sdt = i;
      else if (STT.indexOf(k) >= 0 && cot.stt === undefined) cot.stt = i;
    });
    if (cot.ten !== undefined) return { dong: r, cot: cot, cotBuoi: cuoi + 1 };
  }
  return null;
}

/** Kiểm tra yêu cầu tạo file log. Trả về { loi, tenFile, nguoi[], buoi[] }. */
function kiemTraFileLog_(yc, thanhVien) {
  yc = yc || {};
  if (!yc.coMau) return { loi: 'Chưa có file mẫu. Dán link file mẫu rồi mới tạo được file đăng ký log.' };
  var tenFile = String(yc.tenFile || '').trim();
  if (!tenFile) return { loi: 'Bạn chưa đặt tên file.' };
  var theoTen = {};
  thanhVien.forEach(function (t) { theoTen[String(t.HoVaTen).toLowerCase()] = t; });
  var nguoi = [], daCo = {};
  (yc.nguoi || []).forEach(function (n) {
    var t = theoTen[String(n).trim().toLowerCase()];
    if (t && !daCo[t.HoVaTen]) { daCo[t.HoVaTen] = true; nguoi.push(t); }
  });
  if (!nguoi.length) return { loi: 'Bạn chưa chọn thành viên nào.' };
  var buoi = (yc.buoi || []).map(function (b) { return String(b || '').trim(); });
  if (!buoi.length) return { loi: 'Cần ít nhất một buổi.' };
  if (buoi.some(function (b) { return !b; })) return { loi: 'Có buổi chưa đặt tên.' };
  return { loi: '', tenFile: tenFile.slice(0, 150), nguoi: nguoi, buoi: buoi };
}

/* Mẫu file log của tool cũ (tab "Đăng ký log" và "Kế hoạch"): các hàm phụ không đụng tới Google. */

/** Số thứ tự cột thành chữ: 1 → A, 5 → E, 27 → AA. */
function chuCot_(so) {
  var chu = '';
  while (so > 0) { var du = (so - 1) % 26; chu = String.fromCharCode(65 + du) + chu; so = (so - du - 1) / 26; }
  return chu;
}

/**
 * Xếp người theo thứ tự ban chuẩn (THU_TU_BAN); cùng ban thì giữ thứ tự trong danh sách thành viên.
 * Trả về { nguoi[], nhomBan[{dau, so}] } — dau là vị trí (từ 0) của người đầu tiên mỗi nhóm ban liền nhau.
 */
function xepTheoBan_(nguoi, thuTu) {
  var viTri = {};
  (thuTu || []).forEach(function (t, i) { viTri[String(t.HoVaTen)] = i; });
  var ds = nguoi.map(function (t, i) { return { t: t, i: viTri[String(t.HoVaTen)] !== undefined ? viTri[String(t.HoVaTen)] : 1e6 + i }; });
  ds.sort(function (a, b) { return soSanhBan_(a.t.Ban, b.t.Ban) || a.i - b.i; });
  var kq = ds.map(function (x) { return x.t; }), nhom = [];
  kq.forEach(function (t, i) {
    if (i && String(t.Ban).trim() === String(kq[i - 1].Ban).trim()) nhom[nhom.length - 1].so++;
    else nhom.push({ dau: i, so: 1 });
  });
  return { nguoi: kq, nhomBan: nhom };
}

/* ===================== Đăng nhập Google ===================== */

/** Kiểm tra thông tin Google trả về cho một ID token. Trả về '' nếu hợp lệ. */
function kiemTraTokenGoogle_(info, clientId, bayGioGiay) {
  if (!info || !info.email) return 'Không xác nhận được tài khoản Google. Bạn thử lại nhé.';
  if (String(info.aud) !== String(clientId)) return 'Mã đăng nhập không phải của ECODesk.';
  if (['accounts.google.com', 'https://accounts.google.com'].indexOf(String(info.iss)) < 0) return 'Mã đăng nhập không phải do Google cấp.';
  if (!(info.email_verified === true || info.email_verified === 'true')) return 'Email Google này chưa được xác minh.';
  if (Number(info.exp) < bayGioGiay) return 'Mã đăng nhập đã hết hạn. Bạn thử lại nhé.';
  return '';
}

/* ===================== Thông báo đẩy lên điện thoại (Web Push, khoá VAPID) ===================== */
/*
 * Gửi thông báo lên app cài trên điện thoại theo chuẩn Web Push. Máy chủ ký một mã (JWT) bằng chữ ký số
 * ECDSA P-256; Apps Script không có sẵn thuật toán này nên tự tính ở đây bằng BigInt. Không cần dịch vụ ngoài.
 */
var P256_ = null;
function p256_() {
  if (P256_) return P256_;
  var B = function (h) { return BigInt('0x' + h); };
  P256_ = {
    p: B('ffffffff00000001000000000000000000000000ffffffffffffffffffffffff'),
    n: B('ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551'),
    G: [B('6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'), B('4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5')],
    O: BigInt(0), I: BigInt(1), H2: BigInt(2), H3: BigInt(3)
  };
  return P256_;
}
function modP256_(a, m) { var r = a % m; return r < P256_.O ? r + m : r; }
function nghichDaoP256_(a, m) {
  var c = p256_(), t = c.O, t2 = c.I, r = m, r2 = modP256_(a, m);
  while (r2 !== c.O) { var q = r / r2, x = t - q * t2; t = t2; t2 = x; x = r - q * r2; r = r2; r2 = x; }
  return modP256_(t, m);
}
function congDiemP256_(A, Bp) {
  var c = p256_();
  if (!A) return Bp; if (!Bp) return A;
  var l;
  if (A[0] === Bp[0]) {
    if (modP256_(A[1] + Bp[1], c.p) === c.O) return null;
    l = modP256_(c.H3 * A[0] * A[0] - c.H3, c.p) * nghichDaoP256_(c.H2 * A[1], c.p);
  } else {
    l = modP256_(Bp[1] - A[1], c.p) * nghichDaoP256_(Bp[0] - A[0], c.p);
  }
  l = modP256_(l, c.p);
  var x = modP256_(l * l - A[0] - Bp[0], c.p);
  return [x, modP256_(l * (A[0] - x) - A[1], c.p)];
}
function nhanDiemP256_(k, P) {
  var c = p256_(), R = null, Q = P;
  while (k > c.O) { if (k & c.I) R = congDiemP256_(R, Q); Q = congDiemP256_(Q, Q); k = k >> c.I; }
  return R;
}
function soSangByte_(x, dai) {
  var h = x.toString(16); while (h.length < dai * 2) h = '0' + h;
  var b = []; for (var i = 0; i < dai * 2; i += 2) b.push(parseInt(h.substr(i, 2), 16)); return b;
}
function byteSangSo_(b) {
  var h = ''; for (var i = 0; i < b.length; i++) h += ((b[i] & 255) + 256).toString(16).slice(1);
  return BigInt('0x' + (h || '0'));
}
/** Chuỗi base64url (không có dấu =) từ mảng byte. */
function base64Url_(b) {
  var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_', s = '';
  for (var i = 0; i < b.length; i += 3) {
    var n = ((b[i] & 255) << 16) | (((b[i + 1] || 0) & 255) << 8) | ((b[i + 2] || 0) & 255);
    s += A.charAt((n >> 18) & 63) + A.charAt((n >> 12) & 63) + (i + 1 < b.length ? A.charAt((n >> 6) & 63) : '') + (i + 2 < b.length ? A.charAt(n & 63) : '');
  }
  return s;
}
/** Từ khoá riêng (32 byte) ra khoá công khai dạng 65 byte (04 || X || Y). */
function khoaCongP256_(khoaRieng) {
  var c = p256_(), d = byteSangSo_(khoaRieng);
  if (d <= c.O || d >= c.n) throw new Error('Khoá riêng không hợp lệ.');
  var Q = nhanDiemP256_(d, c.G);
  return [4].concat(soSangByte_(Q[0], 32), soSangByte_(Q[1], 32));
}
/**
 * Ký ECDSA P-256 theo RFC 6979 (số k sinh từ khoá và nội dung, không cần số ngẫu nhiên).
 * bam: 32 byte SHA-256 của nội dung; hmac(khoa, duLieu) trả về 32 byte HMAC-SHA256. Trả về 64 byte r || s.
 */
function kyP256_(bam, khoaRieng, hmac) {
  var c = p256_(), d = byteSangSo_(khoaRieng), z = byteSangSo_(bam);
  var x = soSangByte_(d, 32), h1 = soSangByte_(modP256_(z, c.n), 32);
  var V = [], K = [], i;
  for (i = 0; i < 32; i++) { V.push(1); K.push(0); }
  K = hmac(K, V.concat([0], x, h1)); V = hmac(K, V);
  K = hmac(K, V.concat([1], x, h1)); V = hmac(K, V);
  for (var lan = 0; lan < 100; lan++) {
    V = hmac(K, V);
    var k = byteSangSo_(V);
    if (k > c.O && k < c.n) {
      var R = nhanDiemP256_(k, c.G), r = modP256_(R[0], c.n);
      if (r !== c.O) {
        var s2 = modP256_(nghichDaoP256_(k, c.n) * modP256_(z + r * d, c.n), c.n);
        if (s2 !== c.O) return soSangByte_(r, 32).concat(soSangByte_(s2, 32));
      }
    }
    K = hmac(K, V.concat([0])); V = hmac(K, V);
  }
  throw new Error('Không ký được.');
}
/*
 * Mã hoá nội dung thông báo đẩy (RFC 8291, aes128gcm) để điện thoại hiện thông báo ngay, không phải hỏi lại máy chủ.
 * iPhone chỉ cho service worker rất ít thời gian; hỏi lại Apps Script thường quá chậm nên thông báo không hiện.
 */
var AES_ = null;
function aes_() {
  if (AES_) return AES_;
  var sbox = [], x = 1, y = 1, i;
  // Sinh bảng S-box của AES bằng phép nhân trong GF(2^8).
  do {
    x = (x ^ ((x << 1) & 255) ^ (x & 128 ? 0x1b : 0)) & 255;
    y ^= (y << 1) & 255; y ^= (y << 2) & 255; y ^= (y << 4) & 255; y &= 255; if (y & 128) y ^= 0x09;
    var b = y ^ ((y << 1) | (y >> 7)) ^ ((y << 2) | (y >> 6)) ^ ((y << 3) | (y >> 5)) ^ ((y << 4) | (y >> 4));
    sbox[x] = (b ^ 0x63) & 255;
  } while (x !== 1);
  sbox[0] = 0x63;
  AES_ = { sbox: sbox };
  return AES_;
}
function xtime_(a) { return ((a << 1) ^ (a & 128 ? 0x1b : 0)) & 255; }
function moRongKhoaAes_(khoa) {
  var S = aes_().sbox, w = khoa.slice(0, 16), rcon = 1;
  for (var i = 16; i < 176; i += 4) {
    var t = w.slice(i - 4, i);
    if (i % 16 === 0) { t = [S[t[1]] ^ rcon, S[t[2]], S[t[3]], S[t[0]]]; rcon = xtime_(rcon); }
    for (var j = 0; j < 4; j++) w.push(w[i - 16 + j] ^ t[j]);
  }
  return w;
}
function maHoaKhoiAes_(w, vao) {
  var S = aes_().sbox, s = [], r, c, i;
  for (i = 0; i < 16; i++) s[i] = vao[i] ^ w[i];
  for (r = 1; r <= 10; r++) {
    var t = [];
    for (i = 0; i < 16; i++) t[i] = S[s[(i + 4 * (i % 4)) % 16]]; // SubBytes + ShiftRows (cột chính)
    if (r < 10) {
      for (c = 0; c < 16; c += 4) {
        var a0 = t[c], a1 = t[c + 1], a2 = t[c + 2], a3 = t[c + 3], e = a0 ^ a1 ^ a2 ^ a3;
        t[c] ^= e ^ xtime_(a0 ^ a1); t[c + 1] ^= e ^ xtime_(a1 ^ a2); t[c + 2] ^= e ^ xtime_(a2 ^ a3); t[c + 3] ^= e ^ xtime_(a3 ^ a0);
      }
    }
    for (i = 0; i < 16; i++) s[i] = t[i] ^ w[16 * r + i];
  }
  return s;
}
function nhanGf128_(X, Y) {
  var Z = [], V = Y.slice(), i, j;
  for (i = 0; i < 16; i++) Z[i] = 0;
  for (i = 0; i < 128; i++) {
    if ((X[i >> 3] >> (7 - (i & 7))) & 1) for (j = 0; j < 16; j++) Z[j] ^= V[j];
    var cuoi = V[15] & 1;
    for (j = 15; j > 0; j--) V[j] = ((V[j] >> 1) | ((V[j - 1] & 1) << 7)) & 255;
    V[0] >>= 1;
    if (cuoi) V[0] ^= 0xe1;
  }
  return Z;
}
/** AES-128-GCM: trả về bản mã nối thẻ xác thực 16 byte. Nonce 12 byte, không có dữ liệu kèm (AAD). */
function maHoaAesGcm_(khoa, nonce, duLieu) {
  var w = moRongKhoaAes_(khoa), H = maHoaKhoiAes_(w, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  var dem = function (n) { return nonce.slice(0, 12).concat([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]); };
  var ra = [], g = [], i, j;
  for (i = 0; i < 16; i++) g[i] = 0;
  for (i = 0; i < duLieu.length; i += 16) {
    var k = maHoaKhoiAes_(w, dem(2 + i / 16)), khoi = [];
    for (j = 0; j < 16 && i + j < duLieu.length; j++) { var m = (duLieu[i + j] ^ k[j]) & 255; ra.push(m); khoi.push(m); }
    while (khoi.length < 16) khoi.push(0);
    for (j = 0; j < 16; j++) g[j] ^= khoi[j];
    g = nhanGf128_(g, H);
  }
  var bit = duLieu.length * 8, dai = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, (bit >>> 24) & 255, (bit >>> 16) & 255, (bit >>> 8) & 255, bit & 255];
  for (j = 0; j < 16; j++) g[j] ^= dai[j];
  g = nhanGf128_(g, H);
  var e0 = maHoaKhoiAes_(w, dem(1));
  for (j = 0; j < 16; j++) ra.push((g[j] ^ e0[j]) & 255);
  return ra;
}
function chuSangByte_(s) { var b = []; for (var i = 0; i < s.length; i++) b.push(s.charCodeAt(i)); return b; }
/**
 * Thân tin Web Push đã mã hoá (RFC 8291). duLieu: byte nội dung; khoaMay: 65 byte p256dh của máy; auth: 16 byte;
 * rieng: 32 byte khoá tạm của máy chủ; salt: 16 byte ngẫu nhiên; hmac(khoa, duLieu) như kyP256.
 */
function maHoaThongBaoDay_(duLieu, khoaMay, auth, rieng, salt, hmac) {
  var c = p256_();
  if (khoaMay.length !== 65 || khoaMay[0] !== 4 || auth.length !== 16) throw new Error('Khoá của máy không hợp lệ.');
  var cong = khoaCongP256_(rieng);
  var diem = nhanDiemP256_(byteSangSo_(rieng), [byteSangSo_(khoaMay.slice(1, 33)), byteSangSo_(khoaMay.slice(33, 65))]);
  if (!diem) throw new Error('Khoá của máy không hợp lệ.');
  var chung = soSangByte_(diem[0], 32);
  var ikm = hmac(hmac(auth, chung), chuSangByte_('WebPush: info').concat([0], khoaMay, cong, [1]));
  var prk = hmac(salt, ikm);
  var cek = hmac(prk, chuSangByte_('Content-Encoding: aes128gcm').concat([0, 1])).slice(0, 16);
  var nonce = hmac(prk, chuSangByte_('Content-Encoding: nonce').concat([0, 1])).slice(0, 12);
  var ma = maHoaAesGcm_(cek, nonce, duLieu.concat([2]));
  return salt.slice(0, 16).concat([0, 0, 16, 0, 65], cong, ma);
}
/** Phần gốc (https://máy-chủ) của địa chỉ nhận thông báo đẩy; '' nếu không phải https. */
function gocDiaChi_(url) {
  var m = /^https:\/\/[^\/?#]+/i.exec(String(url || ''));
  return m ? m[0] : '';
}

/** Chỉ gửi tới máy chủ nhận thông báo đẩy của Google, Apple, Mozilla, Microsoft. */
function diaChiDayHopLe_(url) {
  var g = gocDiaChi_(url).toLowerCase();
  return !!g && String(url).length < 1000 && /^https:\/\/([a-z0-9-]+\.)*(fcm\.googleapis\.com|push\.apple\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/.test(g);
}

/** Loại hoạt động BOD cộng tay được không (ô trống là có). */
function loaiCongTay_(l) {
  return String(l.CongTay == null ? '' : l.CongTay).trim().toLowerCase() !== 'khong';
}

/** Các giờ nhắc mỗi ngày: "8, 20" hoặc 20 hoặc [8, 20]. Trống thì 20 giờ. Tối đa 6 giờ. */
function chuanHoaDsGio_(v) {
  var ds = (Array.isArray(v) ? v : String(v == null ? '' : v).split(/[,;\s]+/)).map(function (x) { return String(x).trim() === '' ? NaN : Number(x); });
  var kq = [];
  ds.forEach(function (g) { g = Math.round(g); if (g >= 0 && g <= 23 && kq.indexOf(g) < 0) kq.push(g); });
  kq.sort(function (a, b) { return a - b; });
  return kq.length ? kq.slice(0, 6) : [20];
}

/* ===================== Form cộng điểm seeding ===================== */

/** Cột app tự thêm vào tab câu trả lời form để đánh dấu câu nào đã cộng (không cộng lại lần hai). */
var COT_DA_CONG_FORM = 'ECO đã cộng';

/** Tên Facebook để so: bỏ dấu, chữ thường, bỏ ký tự lạ (biểu tượng, dấu chấm…), gộp khoảng trắng. */
function chuanTenFb_(s) {
  return boDau_(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Nhận diện cột của tab câu trả lời: dấu thời gian, người nộp, cột đánh dấu, email (bỏ qua),
 * còn lại là các cột danh sách tên (Reaction, Comment…).
 */
function cotFormSeeding_(tieuDe) {
  var kq = { thoiGian: -1, nguoiNop: -1, daCong: -1, seeding: [] };
  (tieuDe || []).forEach(function (t, i) {
    var c = chuanHoaTenCot_(t);
    if (!c) return;
    if (String(t).trim() === COT_DA_CONG_FORM) kq.daCong = i;
    else if (c === 'dauthoigian' || c === 'timestamp') kq.thoiGian = i;
    else if (kq.nguoiNop < 0 && (c.indexOf('hovaten') >= 0 || c.indexOf('nguoinop') >= 0 || c.indexOf('hoten') >= 0)) kq.nguoiNop = i;
    else if (c.indexOf('email') >= 0) return;
    else kq.seeding.push({ cot: i, ten: String(t).trim() });
  });
  return kq;
}

/** Loại hoạt động gợi ý cho một cột: loại có tên chứa tên cột (ví dụ "Seeding Reaction" cho cột Reaction), không có thì loại có chữ "seeding". */
function goiYLoaiSeeding_(tenCot, loaiHoatDong) {
  var c = chuanHoaTenCot_(tenCot), i;
  for (i = 0; i < loaiHoatDong.length; i++) if (c && chuanHoaTenCot_(loaiHoatDong[i].TenLoai).indexOf(c) >= 0) return String(loaiHoatDong[i].TenLoai);
  for (i = 0; i < loaiHoatDong.length; i++) if (chuanHoaTenCot_(loaiHoatDong[i].TenLoai).indexOf('seeding') >= 0) return String(loaiHoatDong[i].TenLoai);
  return '';
}

/**
 * Một câu trả lời form thành các dòng cộng điểm. Mỗi dòng trong ô Reaction/Comment là một tên Facebook,
 * khớp nguyên dòng với cột Tên Facebook của thành viên (không phân biệt dấu, hoa thường, ký tự lạ).
 * anhXa: { tên cột: tên loại hoạt động }. thanhVien: những người được cộng (danh sách thành viên hiện tại, gồm cả BOD).
 * Trả về { dong, khongKhop (tên không khớp ai), nguoiNop, loi }.
 */
function congTuFormSeeding_(dong, cot, anhXa, thanhVien, loaiHoatDong, ky, bayGio) {
  var nguoiNop = cot.nguoiNop >= 0 ? String(dong[cot.nguoiNop] == null ? '' : dong[cot.nguoiNop]).trim() : '';
  var kq = { dong: [], khongKhop: [], nguoiNop: nguoiNop, loi: '' };
  if (!ky) { kq.loi = 'Chưa có học kỳ nào nên chưa cộng được. Hãy tải danh sách thành viên kiểu "Sau tuyển đợt 1" trước.'; return kq; }
  var loaiTheoTen = {};
  loaiHoatDong.forEach(function (l) { loaiTheoTen[String(l.TenLoai)] = l; });
  var theoFb = {};
  thanhVien.forEach(function (tv) {
    var k = chuanTenFb_(tv.TenFacebook);
    if (k) (theoFb[k] = theoFb[k] || []).push(String(tv.HoVaTen));
  });
  var tg = cot.thoiGian >= 0 ? dong[cot.thoiGian] : null;
  var thoiGian = tg !== null && String(tg).trim() !== '' && !isNaN(new Date(tg).getTime()) ? new Date(tg) : bayGio;
  cot.seeding.forEach(function (c) {
    var loai = loaiTheoTen[(anhXa || {})[c.ten]];
    if (!loai) return;
    var daCo = {};
    String(dong[c.cot] == null ? '' : dong[c.cot]).split(/\r?\n/).forEach(function (dongTen) {
      var k = chuanTenFb_(dongTen);
      if (!k) return;
      if (!theoFb[k]) { var goc = String(dongTen).trim(); if (kq.khongKhop.indexOf(goc) < 0) kq.khongKhop.push(goc); return; }
      theoFb[k].forEach(function (ten) {
        if (daCo[ten]) return;
        daCo[ten] = true;
        kq.dong.push({
          ThoiGian: thoiGian, HoVaTen: ten, LoaiHoatDong: String(loai.TenLoai), TenHoatDong: c.ten, Diem: Number(loai.Diem) || 0,
          NguoiCong: 'Form' + (nguoiNop ? ': ' + nguoiNop : ''), NhiemKy: String(ky.NhiemKy), HocKy: Number(ky.HocKy)
        });
      });
    });
  });
  return kq;
}

/** Giao diện theo mùa và ngày lễ do BOD chọn (trống là giao diện xanh mặc định). Tên, màu, hình nằm ở ChuDe.html. */
var CHU_DE = ['xuan', 'ha', 'thu', 'dong', 'tet', 'phunu', 'traidat', 'quockhanh', 'trungthu', 'halloween', 'nhagiao', 'giangsinh'];
/** Giao diện luôn tối (bất kể người dùng chọn sáng hay tối). */
var CHU_DE_TOI = ['halloween'];
function chuDeHopLe_(ma) { ma = String(ma == null ? '' : ma).trim(); return CHU_DE.indexOf(ma) >= 0 ? ma : ''; }
/** Thuộc tính gắn vào thẻ html khi trang được tạo, để giao diện hiện đúng ngay từ đầu, không bị nháy màu xanh. */
function thuocTinhChuDe_(ma) {
  ma = chuDeHopLe_(ma);
  if (!ma) return '';
  return ' data-chude="' + ma + '"' + (CHU_DE_TOI.indexOf(ma) >= 0 ? ' data-theme="dark"' : '');
}

/** Các cách nhận thông báo. */
var CACH_THONG_BAO = ['zalo', 'app', 'mail'];
/** Chuẩn hoá lựa chọn cách nhận thông báo (chuỗi "zalo,mail" hoặc mảng). Trống thì mặc định Zalo. */
function chuanHoaCachNhan_(giaTri) {
  var ds = Array.isArray(giaTri) ? giaTri : String(giaTri || '').split(/[,\s]+/);
  var kq = CACH_THONG_BAO.filter(function (c) { return ds.indexOf(c) >= 0; });
  return kq.length ? kq : ['zalo'];
}

if (typeof module !== 'undefined') {
  module.exports = {
    COT_THANH_VIEN: COT_THANH_VIEN, BANG: BANG, KIEU_TAI: KIEU_TAI,
    boDau: boDau_, chuanHoaTenCot: chuanHoaTenCot_, nhomBan: nhomBan_, THU_TU_BAN: THU_TU_BAN, hangBan: hangBan_, soSanhBan: soSanhBan_, xepThanhVienTheoBan: xepThanhVienTheoBan_, nhanDienCot: nhanDienCot_,
    docDanhSachThanhVien: docDanhSachThanhVien_, capNhatThanhVienCu: capNhatThanhVienCu_, tenNhiemKy: tenNhiemKy_, tinhKyMoi: tinhKyMoi_,
    dongThanhDoiTuong: dongThanhDoiTuong_, maHoaBang: maHoaBang_, giaiMaBang: giaiMaBang_, tongHopBangDiem: tongHopBangDiem_, lichSuCongKhai: lichSuCongKhai_,
    linkHopLe: linkHopLe_, kiemTraGopY: kiemTraGopY_, taiKhoanBodCanCo: taiKhoanBodCanCo_, khongPhaiBod: khongPhaiBod_,
    htmlSangChu: htmlSangChu_, lamSachHtml: lamSachHtml_, chuanBiGuiTuNhap: chuanBiGuiTuNhap_,
    coQuyen: coQuyen_, banQuanLy: banQuanLy_, boLocTaskHr: boLocTaskHr_, kiemTraMatKhauMoi: kiemTraMatKhauMoi_, taoDongCongDiem: taoDongCongDiem_,
    chuanHoaLoaiHoatDong: chuanHoaLoaiHoatDong_, chuanHoaGhim: chuanHoaGhim_,
    TRANG_THAI_TASK: TRANG_THAI_TASK, NHAC_TRE: NHAC_TRE, ngayHopLe: ngayHopLe_, soNgayGiua: soNgayGiua_, hienNgay: hienNgay_,
    trangThaiTask: trangThaiTask_, kiemTraTask: kiemTraTask_, taoDongTask: taoDongTask_, chonTaskCanNhac: chonTaskCanNhac_,
    moTaHan: moTaHan_, soanTinNhac: soanTinNhac_, chiaTin: chiaTin_, timMaTrongTin: timMaTrongTin_,
    THAO_TAC_MAIL: THAO_TAC_MAIL, TRANG_THAI_VIEC: TRANG_THAI_VIEC, emailHopLe: emailHopLe_, tachEmail: tachEmail_,
    kiemTraViecMail: kiemTraViecMail_, timChoTrong: timChoTrong_, thayTheMau: thayTheMau_, chuSangHtml: chuSangHtml_,
    docBangNgoai: docBangNgoai_, chuanBiGuiHangLoat: chuanBiGuiHangLoat_,
    chiSoBaoCao: chiSoBaoCao_, taskBiTre: taskBiTre_, tongHopBaoCao: tongHopBaoCao_, chiaMoc: chiaMoc_, bieuDoBaoCao: bieuDoBaoCao_,
    timTieuDeMauLog: timTieuDeMauLog_, kiemTraFileLog: kiemTraFileLog_, chuCot: chuCot_, xepTheoBan: xepTheoBan_, kiemTraTokenGoogle: kiemTraTokenGoogle_,
    base64Url: base64Url_, khoaCongP256: khoaCongP256_, kyP256: kyP256_, maHoaAesGcm: maHoaAesGcm_, maHoaThongBaoDay: maHoaThongBaoDay_, gocDiaChi: gocDiaChi_, diaChiDayHopLe: diaChiDayHopLe_,
    CACH_THONG_BAO: CACH_THONG_BAO, chuanHoaCachNhan: chuanHoaCachNhan_, loaiCongTay: loaiCongTay_, chuanHoaDsGio: chuanHoaDsGio_,
    CHU_DE: CHU_DE, chuDeHopLe: chuDeHopLe_, thuocTinhChuDe: thuocTinhChuDe_,
    COT_DA_CONG_FORM: COT_DA_CONG_FORM, chuanTenFb: chuanTenFb_, cotFormSeeding: cotFormSeeding_, goiYLoaiSeeding: goiYLoaiSeeding_, congTuFormSeeding: congTuFormSeeding_
  };
}
