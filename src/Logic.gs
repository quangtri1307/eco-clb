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
  LichSuDiem: ['ThoiGian', 'HoVaTen', 'LoaiHoatDong', 'TenHoatDong', 'Diem', 'NguoiCong', 'NhiemKy', 'HocKy'],
  KyHoatDong: ['NhiemKy', 'HocKy', 'BatDau', 'KieuTaiLen'],
  LuuTruThanhVien: ['NhiemKy', 'HocKy', 'HoVaTen', 'Ban'],
  LoaiHoatDong: ['TenLoai', 'Diem'],
  BangGhim: ['TieuDe', 'DuongDan'],
  GopY: ['ThoiGian', 'NoiDung', 'DaDoc'],
  TaiKhoan: ['Email', 'HoVaTen', 'VaiTro', 'MatKhau', 'Muoi', 'NgayTao'],
  CaiDat: ['Khoa', 'GiaTri']
};

/** Ba kiểu tải danh sách thành viên ở phần hậu kỳ. */
var KIEU_TAI = {
  DOT1: 'Sau tuyển đợt 1',
  DOT2: 'Sau tuyển đợt 2',
  CAP_NHAT: 'Cập nhật'
};

/** Bỏ dấu tiếng Việt. */
function boDau(s) {
  return String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** Đưa tên cột về dạng so sánh được: bỏ dấu, chữ thường, bỏ khoảng trắng và ký tự lạ. */
function chuanHoaTenCot(s) {
  return boDau(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Gộp ban theo chữ đầu: "PR CAP" -> "PR", "BOD" -> "BOD". */
function nhomBan(ban) {
  var s = String(ban == null ? '' : ban).trim().toUpperCase();
  return s.split(/\s+/)[0] || '';
}

/**
 * Tìm dòng tiêu đề và vị trí các cột theo tên (không phụ thuộc thứ tự cột).
 * @param {Array<Array>} values toàn bộ dữ liệu của tab nguồn
 * @return {{dongTieuDe:number, viTri:Object, thieu:Array<string>}}
 */
function nhanDienCot(values) {
  var nhan = {};
  COT_THANH_VIEN.forEach(function (c) { nhan[chuanHoaTenCot(c[1])] = c[0]; });
  var gioiHan = Math.min(values.length, 10);
  for (var r = 0; r < gioiHan; r++) {
    var viTri = {};
    values[r].forEach(function (o, i) {
      var khoa = nhan[chuanHoaTenCot(o)];
      if (khoa && viTri[khoa] === undefined) viTri[khoa] = i;
    });
    if (viTri.HoVaTen !== undefined) {
      var thieu = COT_BAT_BUOC.filter(function (k) { return viTri[k] === undefined; })
        .map(function (k) { return tenHienThiCot(k); });
      return { dongTieuDe: r, viTri: viTri, thieu: thieu };
    }
  }
  return { dongTieuDe: -1, viTri: {}, thieu: COT_BAT_BUOC.map(tenHienThiCot) };
}

function tenHienThiCot(khoa) {
  for (var i = 0; i < COT_THANH_VIEN.length; i++) if (COT_THANH_VIEN[i][0] === khoa) return COT_THANH_VIEN[i][1];
  return khoa;
}

/**
 * Đọc danh sách thành viên từ dữ liệu sheet nguồn.
 * Bỏ dòng trống tên, báo lỗi nếu trùng tên.
 * @return {{thanhVien:Array<Object>, loi:Array<string>}}
 */
function docDanhSachThanhVien(values) {
  var nd = nhanDienCot(values);
  if (nd.thieu.length) {
    return { thanhVien: [], loi: ['Không tìm thấy cột: ' + nd.thieu.join(', ') + '. Kiểm tra lại tên cột trên sheet nguồn.'] };
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
function tenNhiemKy(ngay) {
  var y = ngay.getFullYear();
  return ngay.getMonth() >= 7 ? y + '-' + (y + 1) : (y - 1) + '-' + y;
}

/**
 * Tính kỳ hoạt động sau khi tải danh sách.
 * @param {?{NhiemKy:string, HocKy:number}} kyHienTai
 * @return {?{NhiemKy:string, HocKy:number}} kỳ mới, hoặc null nếu kiểu tải không mở kỳ mới
 */
function tinhKyMoi(kyHienTai, kieu, ngay) {
  if (kieu === KIEU_TAI.DOT1) return { NhiemKy: tenNhiemKy(ngay), HocKy: 1 };
  if (kieu === KIEU_TAI.DOT2) {
    return { NhiemKy: kyHienTai ? String(kyHienTai.NhiemKy) : tenNhiemKy(ngay), HocKy: 2 };
  }
  return null;
}

/** Biến các dòng của một tab (có dòng tiêu đề) thành danh sách đối tượng. */
function dongThanhDoiTuong(values) {
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

function cungKy(dong, nhiemKy, hocKy) {
  return String(dong.NhiemKy) === String(nhiemKy) && Number(dong.HocKy) === Number(hocKy);
}

/**
 * Dữ liệu công khai cho ECOBoard. Chỉ có họ tên, lớp, ban và điểm.
 * @param {Array<Object>} thanhVien
 * @param {Array<Object>} lichSu các dòng LichSuDiem
 * @param {?Object} ky kỳ hiện tại
 * @param {Array<Object>} luuTru các dòng LuuTruThanhVien
 */
function tongHopBangDiem(thanhVien, lichSu, ky, luuTru) {
  if (!ky) return [];
  var tong = {};
  var tongHk1 = {};
  lichSu.forEach(function (d) {
    var ten = String(d.HoVaTen).toLowerCase();
    var diem = Number(d.Diem) || 0;
    if (cungKy(d, ky.NhiemKy, ky.HocKy)) tong[ten] = (tong[ten] || 0) + diem;
    if (Number(ky.HocKy) === 2 && cungKy(d, ky.NhiemKy, 1)) tongHk1[ten] = (tongHk1[ten] || 0) + diem;
  });
  var coHk1 = {};
  if (Number(ky.HocKy) === 2) {
    luuTru.forEach(function (d) {
      if (cungKy(d, ky.NhiemKy, 1)) coHk1[String(d.HoVaTen).toLowerCase()] = true;
    });
  }
  return thanhVien.map(function (tv) {
    var ten = String(tv.HoVaTen).toLowerCase();
    return {
      ten: String(tv.HoVaTen),
      lop: String(tv.Lop || ''),
      ban: String(tv.Ban || ''),
      nhom: nhomBan(tv.Ban),
      diem: tong[ten] || 0,
      diemHk1: coHk1[ten] ? (tongHk1[ten] || 0) : null
    };
  });
}

/** Lịch sử cộng điểm công khai của một người trong một học kỳ, mới nhất trước. */
function lichSuCongKhai(lichSu, ten, nhiemKy, hocKy) {
  var k = String(ten).toLowerCase();
  return lichSu.filter(function (d) {
    return String(d.HoVaTen).toLowerCase() === k && cungKy(d, nhiemKy, hocKy);
  }).map(function (d) {
    var t = d.ThoiGian instanceof Date ? d.ThoiGian : new Date(d.ThoiGian);
    return { thoiGian: t.getTime(), loai: String(d.LoaiHoatDong), ten: String(d.TenHoatDong || ''), diem: Number(d.Diem) || 0 };
  }).sort(function (a, b) { return b.thoiGian - a.thoiGian; });
}

/** Chỉ giữ link bắt đầu bằng http:// hoặc https://. */
function linkHopLe(s) {
  return /^https?:\/\/\S+$/i.test(String(s || '').trim());
}

/** Kiểm tra nội dung góp ý. Trả về chuỗi lỗi, hoặc '' nếu hợp lệ. */
function kiemTraGopY(noiDung) {
  var s = String(noiDung == null ? '' : noiDung).trim();
  if (!s) return 'Bạn chưa viết góp ý.';
  if (s.length > 2000) return 'Góp ý dài quá 2000 ký tự, bạn rút gọn giúp nhé.';
  return '';
}

/** Danh sách tài khoản BOD cần có theo danh sách thành viên mới (Ban = BOD, có email). */
function taiKhoanBodCanCo(thanhVien) {
  return thanhVien.filter(function (tv) {
    return nhomBan(tv.Ban) === 'BOD' && tv.Email;
  }).map(function (tv) { return { Email: tv.Email, HoVaTen: tv.HoVaTen }; });
}

if (typeof module !== 'undefined') {
  module.exports = {
    COT_THANH_VIEN: COT_THANH_VIEN, BANG: BANG, KIEU_TAI: KIEU_TAI,
    boDau: boDau, chuanHoaTenCot: chuanHoaTenCot, nhomBan: nhomBan, nhanDienCot: nhanDienCot,
    docDanhSachThanhVien: docDanhSachThanhVien, tenNhiemKy: tenNhiemKy, tinhKyMoi: tinhKyMoi,
    dongThanhDoiTuong: dongThanhDoiTuong, tongHopBangDiem: tongHopBangDiem, lichSuCongKhai: lichSuCongKhai,
    linkHopLe: linkHopLe, kiemTraGopY: kiemTraGopY, taiKhoanBodCanCo: taiKhoanBodCanCo
  };
}
