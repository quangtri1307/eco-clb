const test = require('node:test');
const assert = require('node:assert');
const L = require('./load-logic');

const TV = [{ HoVaTen: 'Nguyễn A', Ban: 'PG' }, { HoVaTen: 'Lê B', Ban: 'BOD' }];
const T = L.TRANG_THAI_TASK;

test('ngày và khoảng cách ngày', () => {
  assert.strictEqual(L.ngayHopLe('2026-02-29'), false);
  assert.strictEqual(L.ngayHopLe('2028-02-29'), true);
  assert.strictEqual(L.ngayHopLe('07/10/2026'), false);
  assert.strictEqual(L.soNgayGiua('2026-09-30', '2026-10-02'), 2);
  assert.strictEqual(L.soNgayGiua('2026-10-02', '2026-09-30'), -2);
  assert.strictEqual(L.hienNgay('2026-10-07'), '07/10/2026');
});

test('trangThaiTask tính sắp đến hạn và trễ hạn', () => {
  const hom = '2026-10-01';
  assert.strictEqual(L.trangThaiTask(T.GIAO, '2026-10-10', hom, 2), T.GIAO);
  assert.strictEqual(L.trangThaiTask(T.GIAO, '2026-10-03', hom, 2), T.SAP);
  assert.strictEqual(L.trangThaiTask(T.GIAO, '2026-10-01', hom, 0), T.SAP);
  assert.strictEqual(L.trangThaiTask(T.GIAO, '2026-09-30', hom, 2), T.TRE);
  assert.strictEqual(L.trangThaiTask(T.XONG, '2026-09-30', hom, 2), T.XONG);
  assert.strictEqual(L.trangThaiTask(T.HUY, '2026-09-30', hom, 2), T.HUY);
});

test('taoDongTask: mỗi người một dòng, ghi giao hay nhập', () => {
  const now = new Date(2026, 9, 1);
  const kq = L.taoDongTask({ ten: '  Chốt  địa điểm ', hanChot: '2026-10-07', nguoi: ['nguyễn a', 'Lê B', 'Nguyễn A'] }, TV, 'Lê B', 'BOD', now);
  assert.strictEqual(kq.loi, '');
  assert.strictEqual(kq.dong.length, 2);
  assert.strictEqual(kq.dong[0].TenTask, 'Chốt địa điểm');
  assert.strictEqual(kq.dong[0].NguoiPhuTrach, 'Nguyễn A');
  assert.strictEqual(kq.dong[0].KieuTao, 'Giao task');
  assert.strictEqual(kq.dong[0].TrangThai, T.GIAO);
  assert.strictEqual(L.taoDongTask({ ten: 'x', hanChot: '2026-10-07', nguoi: ['Lê B'] }, TV, 'C', 'HR', now).dong[0].KieuTao, 'Nhập task');
});

test('kiemTraTask báo lỗi rõ ràng', () => {
  assert.match(L.kiemTraTask({ ten: '', hanChot: '2026-10-07', nguoi: ['Lê B'] }, TV).loi, /tên task/);
  assert.match(L.kiemTraTask({ ten: 'x', hanChot: '', nguoi: ['Lê B'] }, TV).loi, /Hạn chót/);
  assert.match(L.kiemTraTask({ ten: 'x', hanChot: '2026-10-07', nguoi: [] }, TV).loi, /người phụ trách/);
  assert.match(L.kiemTraTask({ ten: 'x', hanChot: '2026-10-07', nguoi: ['Ai Đó'] }, TV).loi, /Ai Đó/);
});

test('chonTaskCanNhac theo cài đặt', () => {
  const hom = '2026-10-05';
  const ds = [
    { ten: 'sắp', hanChot: '2026-10-06', trangThai: T.SAP },
    { ten: 'trễ 1', hanChot: '2026-10-04', trangThai: T.TRE },
    { ten: 'trễ 3', hanChot: '2026-10-02', trangThai: T.TRE },
    { ten: 'xong', hanChot: '2026-10-02', trangThai: T.XONG }
  ];
  const ten = (cd) => L.chonTaskCanNhac(ds, hom, cd).map((t) => t.ten);
  assert.deepStrictEqual(ten({ nhacSapDenHan: true, nhacTre: L.NHAC_TRE.MOI_NGAY }), ['sắp', 'trễ 1', 'trễ 3']);
  assert.deepStrictEqual(ten({ nhacSapDenHan: false, nhacTre: L.NHAC_TRE.MOT_LAN }), ['trễ 1']);
  assert.deepStrictEqual(ten({ nhacSapDenHan: true, nhacTre: L.NHAC_TRE.KHONG }), ['sắp']);
});

test('soanTinNhac và chiaTin', () => {
  const hom = '2026-10-05';
  const ds = [{ ten: 'B', nguoi: 'Nguyễn A', hanChot: '2026-10-06' }, { ten: 'A', nguoi: 'Lê B', hanChot: '2026-10-03' }];
  assert.strictEqual(L.soanTinNhac('C', [], hom, false), '');
  const tin = L.soanTinNhac('C', ds, hom, true);
  assert.match(tin, /Messenger/);
  assert.ok(tin.indexOf('Lê B: A (hạn 03/10/2026, trễ 2 ngày)') < tin.indexOf('Nguyễn A: B (hạn 06/10/2026, còn 1 ngày)'));
  const phan = L.chiaTin('a'.repeat(15) + '\n' + 'b'.repeat(8) + '\n' + 'c'.repeat(25), 20);
  assert.ok(phan.every((p) => p.length <= 20));
  assert.strictEqual(phan.join('').replace(/\n/g, ''), 'a'.repeat(15) + 'b'.repeat(8) + 'c'.repeat(25));
});

test('timMaTrongTin', () => {
  assert.strictEqual(L.timMaTrongTin('mã của mình là k7m2qp nhé', ['AB12CD', 'K7M2QP']), 'K7M2QP');
  assert.strictEqual(L.timMaTrongTin('xin chào', ['K7M2QP']), '');
  assert.strictEqual(L.timMaTrongTin('XK7M2QP', ['K7M2QP']), '');
});

test('phân ban cho HR: chỉ thấy task của ban mình, ban chưa ai quản lý thì ai cũng thấy', () => {
  assert.deepStrictEqual(L.banQuanLy('ad, PR cap; pg,'), ['PG', 'PR', 'AD']);
  assert.deepStrictEqual(L.banQuanLy(''), []);
  const nhom = { An: 'PG', Binh: 'PR', Chi: 'AD', Dung: 'BOD', Em: 'HR', Ha: 'HR' };
  const tk = [
    { VaiTro: 'HR', HoVaTen: 'Ha', BanQuanLy: 'PR' },
    { VaiTro: 'HR', HoVaTen: 'Khoa', BanQuanLy: 'PR, AD' },
    { VaiTro: 'HR', HoVaTen: 'Linh', BanQuanLy: '' },
    { VaiTro: 'BOD', HoVaTen: 'Dung', BanQuanLy: '' }
  ];
  const ha = L.boLocTaskHr(tk[0], tk, nhom);
  assert.deepStrictEqual(['An', 'Binh', 'Chi', 'Dung', 'Em', 'Ha', 'Người cũ'].filter(ha), ['An', 'Binh', 'Em', 'Ha', 'Người cũ']);
  const khoa = L.boLocTaskHr(tk[1], tk, nhom);
  assert.ok(khoa('Binh') && khoa('Chi') && !khoa('Dung'));
  assert.ok(['An', 'Binh', 'Chi', 'Dung'].every(L.boLocTaskHr(tk[2], tk, nhom)), 'HR chưa phân ban thấy hết');
  assert.ok(['An', 'Binh', 'Chi', 'Dung'].every(L.boLocTaskHr(tk[3], tk, nhom)), 'BOD thấy hết');
});
