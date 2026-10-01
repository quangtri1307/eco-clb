const test = require('node:test');
const assert = require('node:assert');
const L = require('./load-logic');

const TV = [{ ten: 'An', ban: 'PR CAP', nhom: 'PR' }, { ten: 'Bình', ban: 'PR DES', nhom: 'PR' }, { ten: 'Chi', ban: 'BOD', nhom: 'BOD' }];
const LS = [
  { ngay: '2026-10-01', ten: 'An', loai: 'Staff', tenHoatDong: 'Hội chợ', diem: 5 },
  { ngay: '2026-10-02', ten: 'An', loai: 'Seeding', tenHoatDong: 'Comment', diem: 1 },
  { ngay: '2026-10-02', ten: 'Bình', loai: 'Seeding', tenHoatDong: ' react ', diem: 1 },
  { ngay: '2026-10-20', ten: 'Bình', loai: 'Staff', tenHoatDong: '', diem: 5 },
  { ngay: '2026-10-03', ten: 'Đã Nghỉ', loai: 'Staff', tenHoatDong: '', diem: 5 }
];
const TASK = [
  { nguoi: 'An', hanChot: '2026-10-05', trangThaiLuu: 'Đã xong', ngayXong: '2026-10-04' },
  { nguoi: 'An', hanChot: '2026-10-05', trangThaiLuu: 'Đã xong', ngayXong: '2026-10-07' },
  { nguoi: 'Chi', hanChot: '2026-10-06', trangThaiLuu: 'Đã giao', ngayXong: '' },
  { nguoi: 'Chi', hanChot: '2026-10-06', trangThaiLuu: 'Đã huỷ', ngayXong: '' }
];

test('chiSoBaoCao tách Seeding theo tên hoạt động', () => {
  const ds = L.chiSoBaoCao(['Staff', 'Seeding'], LS).map((c) => c.khoa);
  assert.deepStrictEqual(ds, ['diem', 'loai:Staff', 'loai:Seeding:comment', 'loai:Seeding:react', 'taskXong', 'taskTre']);
});

test('tongHopBaoCao theo thành viên, bỏ người đã rời CLB', () => {
  const kq = L.tongHopBaoCao(LS, TASK, TV, '2026-10-01', '2026-10-10', 'thanhvien', '2026-10-15');
  const an = kq.dong.find((d) => d.ten === 'An');
  assert.deepStrictEqual(an.so, { diem: 6, 'loai:Staff': 1, 'loai:Seeding:comment': 1, taskXong: 2, taskTre: 1 });
  assert.strictEqual(an.ban, 'PR CAP');
  assert.deepStrictEqual(kq.dong.find((d) => d.ten === 'Chi').so, { taskTre: 1 });
  assert.strictEqual(kq.dong.length, 3);
});

test('tongHopBaoCao theo ban và cả CLB', () => {
  const ban = L.tongHopBaoCao(LS, TASK, TV, '2026-10-01', '2026-10-31', 'ban', '2026-10-15');
  assert.deepStrictEqual(ban.dong.map((d) => [d.ten, d.so.diem || 0]), [['PR', 12], ['BOD', 0]]);
  const clb = L.tongHopBaoCao(LS, TASK, TV, '2026-10-01', '2026-10-31', 'clb', '2026-10-15');
  assert.strictEqual(clb.dong.length, 1);
  assert.strictEqual(clb.dong[0].so.diem, 12);
});

test('taskBiTre', () => {
  assert.strictEqual(L.taskBiTre({ hanChot: '2026-10-05', trangThaiLuu: 'Đã giao' }, '2026-10-05'), false);
  assert.strictEqual(L.taskBiTre({ hanChot: '2026-10-05', trangThaiLuu: 'Đã giao' }, '2026-10-06'), true);
  assert.strictEqual(L.taskBiTre({ hanChot: '2026-10-05', trangThaiLuu: 'Đã huỷ' }, '2026-10-09'), false);
});

test('chiaMoc theo ngày, tuần, tháng', () => {
  const ngay = L.chiaMoc('2026-10-01', '2026-10-03');
  assert.strictEqual(ngay.kieu, 'ngay');
  assert.deepStrictEqual(ngay.moc.map((m) => m.nhan), ['01/10', '02/10', '03/10']);
  const tuan = L.chiaMoc('2026-10-01', '2026-11-15');
  assert.strictEqual(tuan.kieu, 'tuan');
  assert.deepStrictEqual(tuan.moc[0], { tu: '2026-10-01', den: '2026-10-04', nhan: '01/10' });
  assert.deepStrictEqual(tuan.moc[1], { tu: '2026-10-05', den: '2026-10-11', nhan: '05/10' });
  assert.strictEqual(tuan.moc[tuan.moc.length - 1].den, '2026-11-15');
  const thang = L.chiaMoc('2026-08-15', '2027-01-10');
  assert.strictEqual(thang.kieu, 'thang');
  assert.deepStrictEqual(thang.moc.map((m) => m.nhan), ['08/2026', '09/2026', '10/2026', '11/2026', '12/2026', '01/2027']);
  assert.deepStrictEqual(thang.moc[0], { tu: '2026-08-15', den: '2026-08-31', nhan: '08/2026' });
});

test('bieuDoBaoCao chia số liệu theo mốc', () => {
  const bd = L.bieuDoBaoCao(LS, TASK, TV, '2026-10-01', '2026-10-03', 'clb', '2026-10-15');
  assert.deepStrictEqual(bd.chuoi['Cả CLB'].map((s) => s.diem || 0), [5, 2, 0]);
});

test('timTieuDeMauLog và kiemTraFileLog', () => {
  const t = L.timTieuDeMauLog([['ĐĂNG KÝ LOG'], [], ['STT', 'Họ và tên', 'Ban', 'SĐT', '']]);
  assert.deepStrictEqual(t, { dong: 2, cot: { stt: 0, ten: 1, ban: 2, sdt: 3 }, cotBuoi: 4 });
  assert.strictEqual(L.timTieuDeMauLog([['a', 'b']]), null);
  const TVs = [{ HoVaTen: 'An', Ban: 'PG' }];
  assert.strictEqual(L.kiemTraFileLog({ coMau: true, tenFile: 'Log T10', nguoi: ['an'], buoi: ['Buổi 1'] }, TVs).loi, '');
  assert.match(L.kiemTraFileLog({ coMau: true, tenFile: 'x', nguoi: ['an'], buoi: [' '] }, TVs).loi, /chưa đặt tên/);
  assert.match(L.kiemTraFileLog({ coMau: true, tenFile: 'x', nguoi: [], buoi: ['a'] }, TVs).loi, /thành viên/);
  assert.match(L.kiemTraFileLog({ tenFile: 'Log T10', nguoi: ['an'], buoi: ['Buổi 1'] }, TVs).loi, /file mẫu/);
});
