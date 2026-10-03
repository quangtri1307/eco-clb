// Form cộng điểm seeding: dò tên Facebook trong ô Reaction/Comment với cột Tên Facebook của thành viên.
const test = require('node:test');
const assert = require('node:assert');
const L = require('./load-logic');
const j = (x) => JSON.parse(JSON.stringify(x));

const TIEU_DE = ['Dấu thời gian', 'Họ và tên người nộp', 'Reaction', 'Comment'];
const TV = [
  { HoVaTen: 'Nguyễn Văn An', Ban: 'PG', TenFacebook: 'An Nguyễn' },
  { HoVaTen: 'Trần Thị Bình', Ban: 'PR CAP', TenFacebook: 'Bình Trần 🌱' },
  { HoVaTen: 'Lê Cường', Ban: 'AD', TenFacebook: '' }
];
const LOAI = [{ TenLoai: 'Seeding Reaction', Diem: 1 }, { TenLoai: 'Seeding Comment', Diem: 2 }, { TenLoai: 'Staff', Diem: 3 }];
const KY = { NhiemKy: '2026-2027', HocKy: 1 };
const ANH_XA = { Reaction: 'Seeding Reaction', Comment: 'Seeding Comment' };

test('nhận diện cột của tab câu trả lời', () => {
  const c = L.cotFormSeeding(TIEU_DE.concat(['Địa chỉ email', L.COT_DA_CONG_FORM]));
  assert.deepStrictEqual(j(c), { thoiGian: 0, nguoiNop: 1, daCong: 5, seeding: [{ cot: 2, ten: 'Reaction' }, { cot: 3, ten: 'Comment' }] });
  assert.strictEqual(L.cotFormSeeding(['Timestamp', 'Họ tên', 'Share']).nguoiNop, 1);
});

test('gợi ý loại hoạt động theo tên cột', () => {
  assert.strictEqual(L.goiYLoaiSeeding('Reaction', LOAI), 'Seeding Reaction');
  assert.strictEqual(L.goiYLoaiSeeding('Share', LOAI), '');
});

test('so tên Facebook không phân biệt dấu, hoa thường, biểu tượng, khoảng trắng', () => {
  assert.strictEqual(L.chuanTenFb('  Bình   TRẦN 🌱 '), 'binh tran');
  assert.strictEqual(L.chuanTenFb('An Nguyễn'), L.chuanTenFb('an nguyen'));
});

test('cộng đúng người, đúng loại, mỗi người một lần mỗi cột', () => {
  const tg = new Date('2026-10-03T08:00:00Z');
  const dong = [tg, 'Hà', 'An Nguyễn\nNgười Lạ\nan nguyen\n\nbinh tran', 'Bình Trần'];
  const kq = L.congTuFormSeeding(dong, L.cotFormSeeding(TIEU_DE), ANH_XA, TV, LOAI, KY, new Date());
  assert.strictEqual(kq.loi, '');
  assert.deepStrictEqual(kq.dong.map((d) => [d.HoVaTen, d.LoaiHoatDong, d.TenHoatDong, d.Diem]), [
    ['Nguyễn Văn An', 'Seeding Reaction', 'Reaction', 1],
    ['Trần Thị Bình', 'Seeding Reaction', 'Reaction', 1],
    ['Trần Thị Bình', 'Seeding Comment', 'Comment', 2]
  ]);
  assert.deepStrictEqual(j(kq.khongKhop), ['Người Lạ']);
  assert.strictEqual(kq.dong[0].NguoiCong, 'Form: Hà');
  assert.strictEqual(new Date(kq.dong[0].ThoiGian).getTime(), tg.getTime());
  assert.strictEqual(kq.dong[0].NhiemKy, '2026-2027');
});

test('chỉ khớp nguyên dòng, không khớp một phần tên', () => {
  const kq = L.congTuFormSeeding(['', '', 'An Nguyễn Văn', ''], L.cotFormSeeding(TIEU_DE), ANH_XA, TV, LOAI, KY, new Date());
  assert.strictEqual(kq.dong.length, 0);
});

test('cột không gắn loại thì bỏ qua; chưa có học kỳ thì báo lỗi', () => {
  const dong = ['', '', 'An Nguyễn', 'An Nguyễn'];
  const kq = L.congTuFormSeeding(dong, L.cotFormSeeding(TIEU_DE), { Comment: 'Seeding Comment' }, TV, LOAI, KY, new Date());
  assert.deepStrictEqual(kq.dong.map((d) => d.TenHoatDong), ['Comment']);
  assert.ok(L.congTuFormSeeding(dong, L.cotFormSeeding(TIEU_DE), ANH_XA, TV, LOAI, null, new Date()).loi);
});
