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
  CaiDat: ['Khoa', 'GiaTri'],
  Task: ['ThoiGianTao', 'TenTask', 'MoTa', 'HanChot', 'NguoiPhuTrach', 'NguoiTao', 'KieuTao', 'TrangThai', 'ThoiGianXong'],
  KetNoiZalo: ['HoVaTen', 'MaKetNoi', 'ChatId', 'TenZalo', 'ThoiGianKetNoi'],
  ViecMail: ['ThoiGian', 'NguoiTao', 'ThaoTac', 'MaThu', 'TieuDeThu', 'Den', 'Cc', 'Bcc', 'TieuDe', 'NoiDung', 'Nhan', 'DinhKem', 'TrangThai', 'GhiChu', 'NguoiDuyet', 'ThoiGianDuyet'],
  ThuMau: ['ThoiGianTao', 'ThuMuc', 'TieuDe', 'NoiDung', 'NguoiSua', 'ThoiGianSua'],
  DanhBa: ['Nhom', 'Ten', 'Email', 'GhiChu'],
  LichGui: ['ThoiGianTao', 'ThoiGianGui', 'TieuDe', 'NoiDung', 'NguoiNhan', 'MoTaNguon', 'NguoiTao', 'TrangThai', 'KetQua'],
  FileLog: ['ThoiGian', 'TenFile', 'DuongDan', 'SoNguoi', 'SoBuoi', 'NguoiTao']
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

/* ===================== ECODesk ===================== */

/** Chức năng mỗi vai trò được dùng. */
var QUYEN = {
  BOD: ['congdiem', 'task', 'mail', 'duyetmail', 'baocao', 'gopy', 'log', 'caidat'],
  HR: ['task'],
  UCV: ['mail', 'hopthu']
};

function coQuyen(vaiTro, chucNang) {
  return (QUYEN[vaiTro] || []).indexOf(chucNang) >= 0;
}

/** Trả về chuỗi lỗi, hoặc '' nếu mật khẩu mới hợp lệ. */
function kiemTraMatKhauMoi(mk) {
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
function taoDongCongDiem(yeuCau, thanhVien, loaiHoatDong, nguoiCong, ky, bayGio) {
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
function chuanHoaLoaiHoatDong(ds) {
  var kq = [];
  var daCo = {};
  for (var i = 0; i < (ds || []).length; i++) {
    var ten = String(ds[i].ten == null ? '' : ds[i].ten).trim();
    var diem = Number(ds[i].diem);
    if (!ten) continue;
    if (daCo[ten.toLowerCase()]) return { ds: [], loi: 'Loại "' + ten + '" bị trùng.' };
    if (!isFinite(diem) || diem < 0) return { ds: [], loi: 'Điểm của "' + ten + '" phải là số không âm.' };
    daCo[ten.toLowerCase()] = true;
    kq.push({ TenLoai: ten, Diem: diem });
  }
  if (!kq.length) return { ds: [], loi: 'Cần ít nhất một loại hoạt động.' };
  return { ds: kq, loi: '' };
}

/** Kiểm tra danh sách link ghim do BOD sửa. */
function chuanHoaGhim(ds) {
  var kq = [];
  for (var i = 0; i < (ds || []).length; i++) {
    var tieuDe = String(ds[i].tieuDe == null ? '' : ds[i].tieuDe).trim();
    var link = String(ds[i].link == null ? '' : ds[i].link).trim();
    if (!tieuDe && !link) continue;
    if (!linkHopLe(link)) return { ds: [], loi: 'Link "' + (tieuDe || link) + '" phải bắt đầu bằng http:// hoặc https://' };
    kq.push({ TieuDe: tieuDe || link, DuongDan: link });
  }
  return { ds: kq, loi: '' };
}

/* ===================== Task ===================== */

/** Trạng thái lưu trong sheet chỉ có Đã giao, Đã xong, Đã huỷ. Sắp đến hạn và Trễ hạn được tính từ hạn chót. */
var TRANG_THAI_TASK = { GIAO: 'Đã giao', SAP: 'Sắp đến hạn', TRE: 'Trễ hạn', XONG: 'Đã xong', HUY: 'Đã huỷ' };

/** Ngày dạng yyyy-mm-dd có thật hay không. */
function ngayHopLe(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return false;
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Số ngày từ ngày "tu" đến ngày "den" (cả hai dạng yyyy-mm-dd). */
function soNgayGiua(tu, den) {
  var a = String(tu).split('-'), b = String(den).split('-');
  return Math.round((Date.UTC(+b[0], +b[1] - 1, +b[2]) - Date.UTC(+a[0], +a[1] - 1, +a[2])) / 864e5);
}

/** yyyy-mm-dd → dd/mm/yyyy */
function hienNgay(s) {
  var p = String(s).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(s);
}

/** Ngày trong tên file: 2026-10-15 → 2026.10.15 (năm trước để Drive xếp đúng thứ tự). */
function ngayTenFile(s) {
  var p = String(s).split('-');
  return p.length === 3 ? p.join('.') : String(s);
}

/** Tên file theo quy tắc CLB: "Loại - Nội dung - Năm.Tháng.Ngày". */
function tenFileChuan(loai, noiDung, ngay) {
  return [loai, noiDung, ngay].map(function (x) { return String(x || '').trim(); }).filter(String).join(' - ');
}

function trangThaiTask(trangThaiLuu, hanChot, homNay, soNgaySapDenHan) {
  if (trangThaiLuu === TRANG_THAI_TASK.XONG || trangThaiLuu === TRANG_THAI_TASK.HUY) return trangThaiLuu;
  if (!ngayHopLe(hanChot)) return TRANG_THAI_TASK.GIAO;
  var conLai = soNgayGiua(homNay, hanChot);
  if (conLai < 0) return TRANG_THAI_TASK.TRE;
  if (conLai <= soNgaySapDenHan) return TRANG_THAI_TASK.SAP;
  return TRANG_THAI_TASK.GIAO;
}

/** Kiểm tra nội dung task. Trả về { loi, ten, moTa, hanChot, nguoi[] } với tên người đã chuẩn theo danh sách. */
function kiemTraTask(yeuCau, thanhVien) {
  yeuCau = yeuCau || {};
  var ten = String(yeuCau.ten || '').replace(/\s+/g, ' ').trim();
  var moTa = String(yeuCau.moTa || '').trim();
  var hanChot = String(yeuCau.hanChot || '').trim();
  if (!ten) return { loi: 'Bạn chưa nhập tên task.' };
  if (ten.length > 200) return { loi: 'Tên task dài quá 200 ký tự.' };
  if (moTa.length > 2000) return { loi: 'Mô tả dài quá 2000 ký tự.' };
  if (!ngayHopLe(hanChot)) return { loi: 'Hạn chót chưa đúng.' };
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
function taoDongTask(yeuCau, thanhVien, nguoiTao, vaiTro, bayGio) {
  var k = kiemTraTask(yeuCau, thanhVien);
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
function chonTaskCanNhac(ds, homNay, caiDat) {
  return ds.filter(function (t) {
    if (t.trangThai === TRANG_THAI_TASK.SAP) return !!caiDat.nhacSapDenHan;
    if (t.trangThai !== TRANG_THAI_TASK.TRE) return false;
    if (caiDat.nhacTre === NHAC_TRE.MOI_NGAY) return true;
    if (caiDat.nhacTre === NHAC_TRE.MOT_LAN) return soNgayGiua(t.hanChot, homNay) === 1;
    return false;
  });
}

/** Mô tả hạn của một task, ví dụ "trễ 2 ngày", "hạn hôm nay", "còn 1 ngày". */
function moTaHan(hanChot, homNay) {
  var d = soNgayGiua(homNay, hanChot);
  if (d < 0) return 'trễ ' + (-d) + ' ngày';
  if (d === 0) return 'hạn hôm nay';
  return 'còn ' + d + ' ngày';
}

/**
 * Soạn tin nhắc. laNhanSu = true: tin cho ban nhân sự, có tên người phụ trách để nhắc lại qua Messenger.
 * Trả về '' nếu không có gì cần nhắc.
 */
function soanTinNhac(tenNguoiNhan, ds, homNay, laNhanSu) {
  if (!ds.length) return '';
  var sx = ds.slice().sort(function (a, b) { return a.hanChot < b.hanChot ? -1 : a.hanChot > b.hanChot ? 1 : 0; });
  var dau = laNhanSu
    ? 'ECODesk nhắc việc. Chào ' + tenNguoiNhan + ', nhờ bạn nhắc các bạn sau qua Messenger:'
    : 'ECODesk nhắc việc. Chào ' + tenNguoiNhan + ', bạn có ' + ds.length + ' task cần chú ý:';
  return dau + '\n' + sx.map(function (t) {
    return '• ' + (laNhanSu ? t.nguoi + ': ' : '') + t.ten + ' (hạn ' + hienNgay(t.hanChot) + ', ' + moTaHan(t.hanChot, homNay) + ')';
  }).join('\n');
}

/** Chia tin dài thành nhiều tin, mỗi tin không quá "toiDa" ký tự, ưu tiên cắt ở chỗ xuống dòng. */
function chiaTin(tin, toiDa) {
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
function timMaTrongTin(tin, dsMa) {
  var chu = String(tin || '').toUpperCase().replace(/[^A-Z0-9]/g, ' ');
  var tu = chu.split(/\s+/);
  for (var i = 0; i < dsMa.length; i++) {
    if (dsMa[i] && tu.indexOf(String(dsMa[i]).toUpperCase()) >= 0) return dsMa[i];
  }
  return '';
}

/* ===================== Mail ===================== */

/** Các thao tác ứng cử viên được đề nghị. Mọi thao tác làm thay đổi hộp thư đều chờ BOD duyệt. */
var THAO_TAC_MAIL = {
  SOAN: 'Soạn thư mới', TRA_LOI: 'Trả lời', TRA_LOI_TAT_CA: 'Trả lời tất cả', CHUYEN_TIEP: 'Chuyển tiếp',
  LUU_TRU: 'Lưu trữ', VE_HOP_THU: 'Chuyển về hộp thư đến', XOA: 'Chuyển vào thùng rác',
  GAN_NHAN: 'Gắn nhãn', BO_NHAN: 'Bỏ nhãn', THU_RAC: 'Báo cáo thư rác'
};
var TRANG_THAI_VIEC = { NHAP: 'Nháp', CHO: 'Chờ duyệt', DUYET: 'Đã duyệt', SUA: 'Cần sửa lại', TU_CHOI: 'Từ chối', LOI: 'Lỗi khi thực hiện' };

function emailHopLe(e) {
  return /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/.test(String(e || '').trim());
}

/** Tách chuỗi nhiều email (phẩy, chấm phẩy, xuống dòng, khoảng trắng). Trả về { ds, sai }. Bỏ trùng. */
function tachEmail(chuoi) {
  var ds = [], sai = [], daCo = {};
  String(chuoi || '').split(/[\s,;]+/).forEach(function (x) {
    var m = /<([^>]+)>/.exec(x);
    var e = (m ? m[1] : x).trim().replace(/^mailto:/i, '');
    if (!e) return;
    if (!emailHopLe(e)) { sai.push(e); return; }
    var k = e.toLowerCase();
    if (!daCo[k]) { daCo[k] = true; ds.push(e); }
  });
  return { ds: ds, sai: sai };
}

/** Kiểm tra một việc mail của ứng cử viên. Trả về '' nếu hợp lệ. */
function kiemTraViecMail(v) {
  v = v || {};
  var tt = v.thaoTac;
  var hopLe = Object.keys(THAO_TAC_MAIL).some(function (k) { return THAO_TAC_MAIL[k] === tt; });
  if (!hopLe) return 'Thao tác không hợp lệ.';
  if (tt !== THAO_TAC_MAIL.SOAN && !v.maThu) return 'Thiếu thư cần thao tác.';
  if (tt === THAO_TAC_MAIL.SOAN || tt === THAO_TAC_MAIL.CHUYEN_TIEP) {
    var den = tachEmail(v.den);
    if (den.sai.length) return 'Email chưa đúng: ' + den.sai.join(', ');
    if (!den.ds.length) return 'Bạn chưa nhập người nhận.';
  }
  var cc = tachEmail(v.cc), bcc = tachEmail(v.bcc);
  if (cc.sai.length || bcc.sai.length) return 'Email chưa đúng: ' + cc.sai.concat(bcc.sai).join(', ');
  if (tt === THAO_TAC_MAIL.SOAN && !String(v.tieuDe || '').trim()) return 'Bạn chưa nhập tiêu đề.';
  if ((tt === THAO_TAC_MAIL.SOAN || tt === THAO_TAC_MAIL.TRA_LOI || tt === THAO_TAC_MAIL.TRA_LOI_TAT_CA) && !String(v.noiDung || '').trim()) return 'Bạn chưa nhập nội dung.';
  if ((tt === THAO_TAC_MAIL.GAN_NHAN || tt === THAO_TAC_MAIL.BO_NHAN) && !String(v.nhan || '').trim()) return 'Bạn chưa chọn nhãn.';
  if (String(v.tieuDe || '').length > 250) return 'Tiêu đề dài quá 250 ký tự.';
  if (String(v.noiDung || '').length > 40000) return 'Nội dung dài quá.';
  return '';
}

/** Các chỗ {TenCot} có trong thư mẫu, theo thứ tự xuất hiện, không trùng. */
function timChoTrong(chu) {
  var ds = [], re = /\{([^{}\n]{1,60})\}/g, m;
  while ((m = re.exec(String(chu || '')))) if (ds.indexOf(m[1]) < 0) ds.push(m[1]);
  return ds;
}

/**
 * Thay {TenCot} bằng giá trị của người nhận. So khớp tên cột không phân biệt hoa thường, dấu và khoảng trắng.
 * Trả về { chu, thieu[] } với thieu là các chỗ không có cột tương ứng (giữ nguyên trong thư).
 */
function thayTheMau(chu, duLieu) {
  var theoKhoa = {};
  Object.keys(duLieu || {}).forEach(function (k) { theoKhoa[chuanHoaTenCot(k)] = duLieu[k]; });
  var thieu = [];
  var kq = String(chu || '').replace(/\{([^{}\n]{1,60})\}/g, function (toan, ten) {
    var k = chuanHoaTenCot(ten);
    if (Object.prototype.hasOwnProperty.call(theoKhoa, k)) return String(theoKhoa[k] == null ? '' : theoKhoa[k]);
    if (thieu.indexOf(ten) < 0) thieu.push(ten);
    return toan;
  });
  return { chu: kq, thieu: thieu };
}

/** Đổi thư chữ thường sang HTML đơn giản (giữ xuống dòng, link bấm được). */
function chuSangHtml(chu) {
  var e = String(chu || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  e = e.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">' + e.replace(/\r?\n/g, '<br>') + '</div>';
}

/**
 * Đọc bảng từ một sheet bất kỳ (dòng tiêu đề đầu tiên có chữ). Trả về { cot[], dong[{...}], cotEmail }.
 * cotEmail là cột đoán là email (tên có chữ "email"/"mail", hoặc cột có nhiều email nhất).
 */
function docBangNgoai(giaTri) {
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
  var cotEmail = cot.filter(function (c) { return /e-?mail|mail/.test(boDau(c).toLowerCase()); })[0] || '';
  if (!cotEmail) {
    var tot = 0;
    cot.forEach(function (c) {
      var n = dong.filter(function (d) { return emailHopLe(d[c]); }).length;
      if (n > tot) { tot = n; cotEmail = c; }
    });
  }
  return { cot: cot, dong: dong, cotEmail: cotEmail };
}

/**
 * Chuẩn bị danh sách gửi hàng loạt. nguoiNhan: [{ email, duLieu{} }].
 * Trả về { ds[{email, tieuDe, noiDung}], loi } — báo lỗi nếu email sai, thiếu cột, hay vượt giới hạn.
 */
function chuanBiGuiHangLoat(tieuDe, noiDung, nguoiNhan, gioiHan) {
  if (!String(tieuDe || '').trim()) return { ds: [], loi: 'Thư chưa có tiêu đề.' };
  if (!String(noiDung || '').trim()) return { ds: [], loi: 'Thư chưa có nội dung.' };
  var ds = [], daCo = {}, thieu = [], sai = [];
  (nguoiNhan || []).forEach(function (n) {
    var e = String(n.email || '').trim();
    if (!emailHopLe(e)) { sai.push(e || '(trống)'); return; }
    if (daCo[e.toLowerCase()]) return;
    daCo[e.toLowerCase()] = true;
    var d = n.duLieu || {};
    var a = thayTheMau(tieuDe, d), b = thayTheMau(noiDung, d);
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

function laSeeding(loai) { return boDau(loai).toLowerCase().indexOf('seeding') >= 0; }

function tenHoatDongChuan(t) {
  var x = String(t || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return x || '(không ghi)';
}

/**
 * Danh sách chỉ số của báo cáo: điểm, số lần mỗi loại hoạt động (Seeding tách theo tên hoạt động), task xong, task trễ hạn.
 * Trả về [{ khoa, ten }].
 */
function chiSoBaoCao(loaiHoatDong, lichSu) {
  var ds = [{ khoa: 'diem', ten: 'Điểm' }];
  loaiHoatDong.forEach(function (l) {
    if (!laSeeding(l)) { ds.push({ khoa: 'loai:' + l, ten: l }); return; }
    var ten = [];
    lichSu.forEach(function (d) { if (d.loai === l) { var t = tenHoatDongChuan(d.tenHoatDong); if (ten.indexOf(t) < 0) ten.push(t); } });
    ten.sort();
    if (!ten.length) ds.push({ khoa: 'loai:' + l, ten: l });
    ten.forEach(function (t) { ds.push({ khoa: 'loai:' + l + ':' + t, ten: l + ' (' + t + ')' }); });
  });
  ds.push({ khoa: 'taskXong', ten: 'Task đã xong' });
  ds.push({ khoa: 'taskTre', ten: 'Task trễ hạn' });
  return ds;
}

function khoaChiSo(d) {
  return laSeeding(d.loai) ? 'loai:' + d.loai + ':' + tenHoatDongChuan(d.tenHoatDong) : 'loai:' + d.loai;
}

/** Task có bị trễ hạn không (đã xong sau hạn, hoặc chưa xong mà quá hạn). */
function taskBiTre(t, homNay) {
  if (t.trangThaiLuu === TRANG_THAI_TASK.HUY || !ngayHopLe(t.hanChot)) return false;
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
function tongHopBaoCao(lichSu, task, thanhVien, tu, den, cheDo, homNay) {
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
    cong(d, khoaChiSo(x), 1);
  });
  task.forEach(function (t) {
    var k = nhom(t.nguoi);
    if (k === null) return;
    var d = dongCua(k);
    if (t.trangThaiLuu === TRANG_THAI_TASK.XONG && t.ngayXong && t.ngayXong >= tu && t.ngayXong <= den) cong(d, 'taskXong', 1);
    if (t.hanChot >= tu && t.hanChot <= den && taskBiTre(t, homNay)) cong(d, 'taskTre', 1);
  });
  return { dong: thuTu.map(function (k) { return bang[k]; }) };
}

/** Chia khoảng ngày thành các mốc: theo ngày (≤ 31 ngày), theo tuần (≤ 120 ngày), còn lại theo tháng. */
function chiaMoc(tu, den) {
  var soNgay = soNgayGiua(tu, den) + 1;
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
function bieuDoBaoCao(lichSu, task, thanhVien, tu, den, cheDo, homNay) {
  var c = chiaMoc(tu, den);
  var chuoi = {};
  c.moc.forEach(function (m, i) {
    tongHopBaoCao(lichSu, task, thanhVien, m.tu, m.den, cheDo, homNay).dong.forEach(function (d) {
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
function timTieuDeMauLog(values) {
  var TEN = ['hovaten', 'hoten', 'ten', 'tenthanhvien'], BAN = ['ban'], SDT = ['sodienthoai', 'sdt', 'sodienthoaicanhan', 'dienthoai'], STT = ['stt', 'sothutu'];
  for (var r = 0; r < Math.min(values.length, 15); r++) {
    var cot = {}, cuoi = -1;
    values[r].forEach(function (o, i) {
      var k = chuanHoaTenCot(o);
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
function kiemTraFileLog(yc, thanhVien) {
  yc = yc || {};
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

/* ===================== Đăng nhập Google ===================== */

/** Kiểm tra thông tin Google trả về cho một ID token. Trả về '' nếu hợp lệ. */
function kiemTraTokenGoogle(info, clientId, bayGioGiay) {
  if (!info || !info.email) return 'Không xác nhận được tài khoản Google. Bạn thử lại nhé.';
  if (String(info.aud) !== String(clientId)) return 'Mã đăng nhập không phải của ECODesk.';
  if (['accounts.google.com', 'https://accounts.google.com'].indexOf(String(info.iss)) < 0) return 'Mã đăng nhập không phải do Google cấp.';
  if (!(info.email_verified === true || info.email_verified === 'true')) return 'Email Google này chưa được xác minh.';
  if (Number(info.exp) < bayGioGiay) return 'Mã đăng nhập đã hết hạn. Bạn thử lại nhé.';
  return '';
}

if (typeof module !== 'undefined') {
  module.exports = {
    COT_THANH_VIEN: COT_THANH_VIEN, BANG: BANG, KIEU_TAI: KIEU_TAI,
    boDau: boDau, chuanHoaTenCot: chuanHoaTenCot, nhomBan: nhomBan, nhanDienCot: nhanDienCot,
    docDanhSachThanhVien: docDanhSachThanhVien, tenNhiemKy: tenNhiemKy, tinhKyMoi: tinhKyMoi,
    dongThanhDoiTuong: dongThanhDoiTuong, tongHopBangDiem: tongHopBangDiem, lichSuCongKhai: lichSuCongKhai,
    linkHopLe: linkHopLe, kiemTraGopY: kiemTraGopY, taiKhoanBodCanCo: taiKhoanBodCanCo,
    coQuyen: coQuyen, kiemTraMatKhauMoi: kiemTraMatKhauMoi, taoDongCongDiem: taoDongCongDiem,
    chuanHoaLoaiHoatDong: chuanHoaLoaiHoatDong, chuanHoaGhim: chuanHoaGhim,
    TRANG_THAI_TASK: TRANG_THAI_TASK, NHAC_TRE: NHAC_TRE, ngayHopLe: ngayHopLe, soNgayGiua: soNgayGiua, hienNgay: hienNgay, ngayTenFile: ngayTenFile, tenFileChuan: tenFileChuan,
    trangThaiTask: trangThaiTask, kiemTraTask: kiemTraTask, taoDongTask: taoDongTask, chonTaskCanNhac: chonTaskCanNhac,
    moTaHan: moTaHan, soanTinNhac: soanTinNhac, chiaTin: chiaTin, timMaTrongTin: timMaTrongTin,
    THAO_TAC_MAIL: THAO_TAC_MAIL, TRANG_THAI_VIEC: TRANG_THAI_VIEC, emailHopLe: emailHopLe, tachEmail: tachEmail,
    kiemTraViecMail: kiemTraViecMail, timChoTrong: timChoTrong, thayTheMau: thayTheMau, chuSangHtml: chuSangHtml,
    docBangNgoai: docBangNgoai, chuanBiGuiHangLoat: chuanBiGuiHangLoat,
    chiSoBaoCao: chiSoBaoCao, taskBiTre: taskBiTre, tongHopBaoCao: tongHopBaoCao, chiaMoc: chiaMoc, bieuDoBaoCao: bieuDoBaoCao,
    timTieuDeMauLog: timTieuDeMauLog, kiemTraFileLog: kiemTraFileLog, kiemTraTokenGoogle: kiemTraTokenGoogle
  };
}
