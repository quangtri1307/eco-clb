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

test('chonTaskTheoLich: mỗi mốc có ngày và giờ riêng', () => {
  const hom = '2026-10-05';
  const ds = [
    { ten: 'còn 2', hanChot: '2026-10-07', trangThai: T.GIAO },
    { ten: 'hôm nay', hanChot: '2026-10-05', trangThai: T.SAP },
    { ten: 'trễ 1', hanChot: '2026-10-04', trangThai: T.TRE },
    { ten: 'trễ 3', hanChot: '2026-10-02', trangThai: T.TRE },
    { ten: 'xong', hanChot: '2026-10-05', trangThai: T.XONG }
  ];
  const lich = [{ ngay: -2, gio: 19, phut: 0 }, { ngay: 0, gio: 6, phut: 30 }, { ngay: 1, gio: 19, phut: 0 }];
  const ten = (l, luc) => L.chonTaskTheoLich(ds, hom, l, luc).map((t) => t.ten);
  assert.deepStrictEqual(ten(lich, 19 * 60), ['còn 2', 'trễ 1']);
  assert.deepStrictEqual(ten(lich, 6 * 60 + 30), ['hôm nay']);
  assert.deepStrictEqual(ten(lich, 8 * 60), []);
  assert.deepStrictEqual(ten(lich, null), ['còn 2', 'hôm nay', 'trễ 1']);
  assert.deepStrictEqual(ten([{ ngay: 'T', gio: 20, phut: 0 }], 20 * 60), ['trễ 1', 'trễ 3']);
});

test('chuanHoaLichNhac bỏ mốc sai và trùng, xếp theo ngày', () => {
  const kq = L.chuanHoaLichNhac('[{"ngay":"T","gio":20},{"ngay":0,"gio":6,"phut":30},{"ngay":-2,"gio":19},{"ngay":-2,"gio":19},{"ngay":1,"gio":25},{"ngay":"","gio":8},{"ngay":0,"gio":7,"phut":10}]');
  assert.deepStrictEqual(kq, [{ ngay: -2, gio: 19, phut: 0 }, { ngay: 0, gio: 6, phut: 30 }, { ngay: 'T', gio: 20, phut: 0 }]);
  assert.strictEqual(L.chuanHoaLichNhac('không phải json'), null);
  assert.strictEqual(L.chuanHoaLichNhac(null), null);
  assert.deepStrictEqual(L.lucCuaLich(kq), [390, 1140, 1200]);
  assert.strictEqual(L.moTaMocNhac(kq[1]), 'Ngày hạn chót lúc 06:30');
  assert.strictEqual(L.moTaMocNhac(kq[2]), 'Trễ hạn, mỗi ngày lúc 20:00');
});

test('lichNhacTuCaiDatCu giữ nguyên cách nhắc cũ', () => {
  const ten = (l) => l.map((m) => m.ngay + '@' + m.gio);
  assert.deepStrictEqual(ten(L.lichNhacTuCaiDatCu(2, [20], true, L.NHAC_TRE.MOI_NGAY)), ['-2@20', '-1@20', '0@20', 'T@20']);
  assert.deepStrictEqual(ten(L.lichNhacTuCaiDatCu(1, [7, 20], false, L.NHAC_TRE.MOT_LAN)), ['1@7', '1@20']);
  assert.deepStrictEqual(ten(L.lichNhacTuCaiDatCu(2, [20], false, L.NHAC_TRE.KHONG)), ['0@20']);
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

test('quyền task theo vai trò và chức vụ', () => {
  assert.deepStrictEqual(L.banQuanLy('ad, PR cap; pg,'), ['PG', 'PR', 'AD']);
  assert.deepStrictEqual(L.banQuanLy(''), []);
  assert.deepStrictEqual(L.banCuaHr('HR, BOD'), ['PG', 'PR', 'AD'], 'HR chỉ quản lý PG, PR, AD; chưa phân thì cả ba');
  const ban = { An: 'PG', Binh: 'PR CAP', Bao: 'PR DES', Chi: 'AD', Dung: 'BOD', Duy: 'BOD', Em: 'HR', Ha: 'HR' };
  const ds = Object.keys(ban).concat(['Người cũ']);
  const ha = L.quyenTask({ VaiTro: 'HR', HoVaTen: 'Ha', BanQuanLy: 'PR' }, '', ban);
  assert.deepStrictEqual(ds.filter(ha.sua), ['Binh', 'Bao']);
  assert.deepStrictEqual(ds.filter(ha.xem), ['Binh', 'Bao', 'Ha'], 'HR xem thêm task của chính mình');
  const linh = L.quyenTask({ VaiTro: 'HR', HoVaTen: 'Linh', BanQuanLy: '' }, '', ban);
  assert.deepStrictEqual(ds.filter(linh.sua), ['An', 'Binh', 'Bao', 'Chi']);
  const headCap = L.quyenTask({ VaiTro: 'BOD', HoVaTen: 'Dung' }, 'Head PR CAP', ban);
  assert.deepStrictEqual(ds.filter(headCap.sua), ['Binh']);
  assert.deepStrictEqual(ds.filter(headCap.xem), ['Binh', 'Dung']);
  const headHr = L.quyenTask({ VaiTro: 'BOD', HoVaTen: 'Dung' }, ' head  hr ', ban);
  assert.deepStrictEqual(ds.filter(headHr.sua), ['Em', 'Ha']);
  assert.ok(ds.every(headHr.xem), 'Head HR xem mọi task');
  const vp = L.quyenTask({ VaiTro: 'BOD', HoVaTen: 'Duy' }, 'Vice pres', ban);
  assert.deepStrictEqual(ds.filter(vp.sua), ['Dung', 'Duy']);
  assert.ok(ds.every(vp.xem), 'Pres, Vice pres xem mọi task');
  assert.ok(L.quyenTask({ VaiTro: 'BOD', HoVaTen: 'Duy' }, 'Pres', ban).sua('Dung'));
  const khac = L.quyenTask({ VaiTro: 'BOD', HoVaTen: 'Duy' }, '', ban);
  assert.ok(ds.every(khac.sua), 'BOD chưa có chức vụ rõ thì như cũ');
});
