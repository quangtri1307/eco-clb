const test = require('node:test');
const assert = require('node:assert');
const L = require('./load-logic');

const KY = { NhiemKy: '2026-2027', HocKy: 1 };
const TV = [{ HoVaTen: 'Nguyễn A', Ban: 'PG' }, { HoVaTen: 'Lê B', Ban: 'BOD' }];
const LOAI = [{ TenLoai: 'Staff', Diem: 5 }, { TenLoai: 'Seeding', Diem: 1 }];

test('coQuyen theo vai trò', () => {
  assert.strictEqual(L.coQuyen('BOD', 'congdiem'), true);
  assert.strictEqual(L.coQuyen('HR', 'congdiem'), false);
  assert.strictEqual(L.coQuyen('HR', 'task'), true);
  assert.strictEqual(L.coQuyen('UCV', 'mail'), true);
  assert.strictEqual(L.coQuyen('UCV', 'caidat'), false);
  assert.strictEqual(L.coQuyen('', 'task'), false);
});

test('taoDongCongDiem lấy điểm theo loại, bỏ người trùng, chuẩn tên', () => {
  const now = new Date(2026, 9, 1, 10);
  const kq = L.taoDongCongDiem({ loai: 'Staff', tenHoatDong: ' Hội chợ ', nguoi: ['nguyễn a', 'Lê B', 'Nguyễn A'] }, TV, LOAI, 'Lê B', KY, now);
  assert.strictEqual(kq.loi, '');
  assert.strictEqual(kq.dong.length, 2);
  assert.deepStrictEqual(kq.dong[0], { ThoiGian: now, HoVaTen: 'Nguyễn A', LoaiHoatDong: 'Staff', TenHoatDong: 'Hội chợ', Diem: 5, NguoiCong: 'Lê B', NhiemKy: '2026-2027', HocKy: 1 });
});

test('taoDongCongDiem báo lỗi rõ ràng', () => {
  const now = new Date();
  assert.match(L.taoDongCongDiem({ loai: 'Staff', nguoi: ['Nguyễn A'] }, TV, LOAI, 'X', null, now).loi, /Chưa có học kỳ/);
  assert.match(L.taoDongCongDiem({ loai: 'Bay', nguoi: ['Nguyễn A'] }, TV, LOAI, 'X', KY, now).loi, /Không có loại/);
  assert.match(L.taoDongCongDiem({ loai: 'Staff', nguoi: [] }, TV, LOAI, 'X', KY, now).loi, /chưa chọn/);
  assert.match(L.taoDongCongDiem({ loai: 'Staff', nguoi: ['Người Lạ'] }, TV, LOAI, 'X', KY, now).loi, /Người Lạ/);
});

test('kiemTraMatKhauMoi', () => {
  assert.notStrictEqual(L.kiemTraMatKhauMoi('12345'), '');
  assert.strictEqual(L.kiemTraMatKhauMoi('123456'), '');
});

test('chuanHoaLoaiHoatDong bỏ dòng trống, chặn trùng và điểm âm', () => {
  assert.deepStrictEqual(L.chuanHoaLoaiHoatDong([{ ten: ' Staff ', diem: '5' }, { ten: '', diem: 3 }]).ds, [{ TenLoai: 'Staff', Diem: 5 }]);
  assert.match(L.chuanHoaLoaiHoatDong([{ ten: 'A', diem: 1 }, { ten: 'a', diem: 2 }]).loi, /trùng/);
  assert.match(L.chuanHoaLoaiHoatDong([{ ten: 'A', diem: -1 }]).loi, /không âm/);
  assert.match(L.chuanHoaLoaiHoatDong([]).loi, /ít nhất/);
});

test('chuanHoaGhim chỉ nhận link http(s)', () => {
  assert.deepStrictEqual(L.chuanHoaGhim([{ tieuDe: '', link: 'https://a.vn' }, { tieuDe: '', link: '' }]).ds, [{ TieuDe: 'https://a.vn', DuongDan: 'https://a.vn' }]);
  assert.match(L.chuanHoaGhim([{ tieuDe: 'X', link: 'javascript:alert(1)' }]).loi, /http/);
});
