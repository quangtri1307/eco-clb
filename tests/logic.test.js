const test = require('node:test');
const assert = require('node:assert');
const L = require('./load-logic');

test('chuanHoaTenCot bỏ dấu, chữ hoa và khoảng trắng', () => {
  assert.strictEqual(L.chuanHoaTenCot('Số điện thoại cá nhân'), 'sodienthoaicanhan');
  assert.strictEqual(L.chuanHoaTenCot('  Họ và tên '), 'hovaten');
  assert.strictEqual(L.chuanHoaTenCot('Đ'), 'd');
});

test('nhomBan gộp PR CAP, PR DES, PR PHO thành PR', () => {
  assert.strictEqual(L.nhomBan('PR CAP'), 'PR');
  assert.strictEqual(L.nhomBan('pr  des'), 'PR');
  assert.strictEqual(L.nhomBan('BOD'), 'BOD');
  assert.strictEqual(L.nhomBan(''), '');
});

test('nhanDienCot không phụ thuộc thứ tự cột và bỏ qua cột Ghi chú', () => {
  const values = [
    ['', '', ''],
    ['Email', 'Ghi chú', 'Ban', 'Họ và tên'],
    ['a@gmail.com', 'x', 'PG', 'Trần A']
  ];
  const nd = L.nhanDienCot(values);
  assert.strictEqual(nd.dongTieuDe, 1);
  assert.deepStrictEqual(nd.thieu, []);
  assert.strictEqual(nd.viTri.HoVaTen, 3);
  assert.strictEqual(nd.viTri.Email, 0);
});

test('docDanhSachThanhVien bỏ dòng trống, báo trùng tên, thiếu cột', () => {
  const ok = L.docDanhSachThanhVien([
    ['Họ và tên', 'Ban', 'Email', 'Ghi chú'],
    ['Nguyễn  Văn A ', 'BOD', ' A@Gmail.com ', 'abc'],
    ['', '', '', ''],
    ['Lê B', 'PR CAP', '', '']
  ]);
  assert.deepStrictEqual(ok.loi, []);
  assert.strictEqual(ok.thanhVien.length, 2);
  assert.strictEqual(ok.thanhVien[0].HoVaTen, 'Nguyễn Văn A');
  assert.strictEqual(ok.thanhVien[0].Email, 'a@gmail.com');
  assert.strictEqual(ok.thanhVien[0].GhiChu, undefined);

  const trung = L.docDanhSachThanhVien([['Họ và tên', 'Ban'], ['A', 'PG'], ['a', 'AD']]);
  assert.match(trung.loi[0], /trùng/);

  const thieu = L.docDanhSachThanhVien([['Họ và tên', 'Lớp'], ['A', '10A']]);
  assert.match(thieu.loi[0], /Ban/);
});

test('tinhKyMoi theo ba kiểu tải', () => {
  const t10 = new Date(2026, 9, 1);
  const t2 = new Date(2027, 1, 1);
  assert.deepStrictEqual(L.tinhKyMoi(null, L.KIEU_TAI.DOT1, t10), { NhiemKy: '2026-2027', HocKy: 1 });
  assert.deepStrictEqual(L.tinhKyMoi({ NhiemKy: '2026-2027', HocKy: 1 }, L.KIEU_TAI.DOT2, t2), { NhiemKy: '2026-2027', HocKy: 2 });
  assert.strictEqual(L.tinhKyMoi({ NhiemKy: '2026-2027', HocKy: 1 }, L.KIEU_TAI.CAP_NHAT, t2), null);
});

test('tongHopBangDiem chỉ tính học kỳ hiện tại, ẩn thông tin riêng, có điểm HK1 cho người ở lại', () => {
  const tv = [
    { HoVaTen: 'A', Lop: '10A', Ban: 'PR CAP', Email: 'a@x', SoDienThoaiCaNhan: '090' },
    { HoVaTen: 'B', Lop: '11B', Ban: 'PG' }
  ];
  const ls = [
    { HoVaTen: 'A', Diem: 5, NhiemKy: '2026-2027', HocKy: 1 },
    { HoVaTen: 'A', Diem: 3, NhiemKy: '2026-2027', HocKy: 2 },
    { HoVaTen: 'B', Diem: 2, NhiemKy: '2026-2027', HocKy: 2 },
    { HoVaTen: 'A', Diem: 9, NhiemKy: '2025-2026', HocKy: 2 }
  ];
  const luuTru = [{ NhiemKy: '2026-2027', HocKy: 1, HoVaTen: 'A' }];
  const kq = L.tongHopBangDiem(tv, ls, { NhiemKy: '2026-2027', HocKy: 2 }, luuTru);
  assert.deepStrictEqual(kq[0], { ten: 'A', lop: '10A', ban: 'PR CAP', nhom: 'PR', diem: 3, diemHk1: 5 });
  assert.strictEqual(kq[1].diem, 2);
  assert.strictEqual(kq[1].diemHk1, null);
  assert.strictEqual(JSON.stringify(kq).includes('090'), false);
});

test('lichSuCongKhai lọc đúng người, đúng kỳ, mới nhất trước', () => {
  const ls = [
    { HoVaTen: 'A', ThoiGian: new Date(2026, 9, 1), LoaiHoatDong: 'Log', TenHoatDong: '', Diem: 3, NguoiCong: 'X', NhiemKy: '2026-2027', HocKy: 1 },
    { HoVaTen: 'A', ThoiGian: new Date(2026, 9, 5), LoaiHoatDong: 'Seeding', TenHoatDong: 'react', Diem: 1, NguoiCong: 'X', NhiemKy: '2026-2027', HocKy: 1 },
    { HoVaTen: 'B', ThoiGian: new Date(2026, 9, 2), LoaiHoatDong: 'Log', Diem: 3, NhiemKy: '2026-2027', HocKy: 1 }
  ];
  const kq = L.lichSuCongKhai(ls, 'a', '2026-2027', 1);
  assert.strictEqual(kq.length, 2);
  assert.strictEqual(kq[0].ten, 'react');
  assert.strictEqual(JSON.stringify(kq).includes('NguoiCong'), false);
});

test('linkHopLe, kiemTraGopY, taiKhoanBodCanCo', () => {
  assert.strictEqual(L.linkHopLe('https://a.com/x'), true);
  assert.strictEqual(L.linkHopLe('javascript:alert(1)'), false);
  assert.notStrictEqual(L.kiemTraGopY('   '), '');
  assert.notStrictEqual(L.kiemTraGopY('x'.repeat(2001)), '');
  assert.strictEqual(L.kiemTraGopY('ok'), '');
  const bod = L.taiKhoanBodCanCo([{ HoVaTen: 'A', Ban: 'BOD', Email: 'a@x' }, { HoVaTen: 'B', Ban: 'PG', Email: 'b@x' }, { HoVaTen: 'C', Ban: 'BOD', Email: '' }]);
  assert.deepStrictEqual(bod, [{ Email: 'a@x', HoVaTen: 'A' }]);
});

test('locNhiemKy: ẩn dữ liệu nhiệm kỳ cũ, không rõ thời điểm thì giữ', () => {
  const moc = new Date(2026, 8, 15).getTime();
  const ds = [{ t: new Date(2026, 8, 1) }, { t: new Date(2026, 8, 15) }, { t: new Date(2026, 9, 1).getTime() }, { t: '' }, { t: 'không phải ngày' }];
  assert.strictEqual(L.locNhiemKy(ds, (d) => d.t, moc).length, 4);
  assert.ok(!L.locNhiemKy(ds, (d) => d.t, moc).includes(ds[0]));
  assert.strictEqual(L.locNhiemKy(ds, (d) => d.t, 0).length, 5);
});
