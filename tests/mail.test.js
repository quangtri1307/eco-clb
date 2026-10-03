const test = require('node:test');
const assert = require('node:assert');
const L = require('./load-logic');
const T = L.THAO_TAC_MAIL;

test('quyền mail: BOD duyệt, UCV dùng hộp thư', () => {
  assert.strictEqual(L.coQuyen('BOD', 'duyetmail'), true);
  assert.strictEqual(L.coQuyen('BOD', 'hopthu'), false);
  assert.strictEqual(L.coQuyen('UCV', 'hopthu'), true);
  assert.strictEqual(L.coQuyen('UCV', 'duyetmail'), false);
});

test('tachEmail bỏ trùng, nhận dạng "Tên <email>", báo email sai', () => {
  const kq = L.tachEmail('a@x.com, A@x.com; Ten <b@y.vn>\nsai@ , c@z.org');
  assert.deepStrictEqual(kq.ds, ['a@x.com', 'b@y.vn', 'c@z.org']);
  assert.deepStrictEqual(kq.sai, ['Ten', 'sai@']);
  assert.deepStrictEqual(L.tachEmail('Nguyễn <n@x.com>').ds, ['n@x.com']);
});

test('kiemTraViecMail', () => {
  assert.strictEqual(L.kiemTraViecMail({ thaoTac: T.SOAN, den: 'a@x.com', tieuDe: 'Chào', noiDung: 'Hi' }), '');
  assert.match(L.kiemTraViecMail({ thaoTac: T.SOAN, den: '', tieuDe: 'Chào', noiDung: 'Hi' }), /người nhận/);
  assert.match(L.kiemTraViecMail({ thaoTac: T.SOAN, den: 'a@x.com', tieuDe: '', noiDung: 'Hi' }), /tiêu đề/);
  assert.match(L.kiemTraViecMail({ thaoTac: T.TRA_LOI, noiDung: 'Hi' }), /Thiếu thư/);
  assert.strictEqual(L.kiemTraViecMail({ thaoTac: T.LUU_TRU, maThu: 't1' }), '');
  assert.match(L.kiemTraViecMail({ thaoTac: T.GAN_NHAN, maThu: 't1' }), /nhãn/);
  assert.match(L.kiemTraViecMail({ thaoTac: 'Xoá sạch', maThu: 't1' }), /không hợp lệ/);
  assert.match(L.kiemTraViecMail({ thaoTac: T.CHUYEN_TIEP, maThu: 't1', den: 'x@' }), /chưa đúng/);
});

test('thayTheMau khớp tên cột không phân biệt dấu, hoa thường, khoảng trắng', () => {
  const kq = L.thayTheMau('Chào {Họ và tên}, ban {BAN}. {Lạ}', { HoVaTen: 'An', Ban: 'PG' });
  assert.strictEqual(kq.chu, 'Chào An, ban PG. {Lạ}');
  assert.deepStrictEqual(kq.thieu, ['Lạ']);
  assert.deepStrictEqual(L.timChoTrong('{A} {B} {A}'), ['A', 'B']);
});

test('chuSangHtml thoát ký tự và giữ xuống dòng', () => {
  const h = L.chuSangHtml('<b>x</b>\nxem https://a.vn/?q=1');
  assert.ok(h.includes('&lt;b&gt;x&lt;/b&gt;<br>xem <a href="https://a.vn/?q=1">'));
});

test('docBangNgoai tìm tiêu đề và cột email', () => {
  const kq = L.docBangNgoai([['', ''], ['Tên đơn vị', 'Địa chỉ mail', 'SĐT'], ['Quỹ A', 'a@x.com', '09'], ['', '', ''], ['Quỹ B', 'b@x.com', '08']]);
  assert.deepStrictEqual(kq.cot, ['Tên đơn vị', 'Địa chỉ mail', 'SĐT']);
  assert.strictEqual(kq.dong.length, 2);
  assert.strictEqual(kq.cotEmail, 'Địa chỉ mail');
  assert.strictEqual(L.docBangNgoai([['Ten', 'Lien he'], ['A', 'a@x.com']]).cotEmail, 'Lien he');
});

test('chuanBiGuiHangLoat', () => {
  const nn = [{ email: 'a@x.com', duLieu: { Ten: 'A' } }, { email: 'A@x.com', duLieu: { Ten: 'A2' } }, { email: 'b@x.com', duLieu: { Ten: 'B' } }];
  const ok = L.chuanBiGuiHangLoat('Mời {Ten}', 'Chào {ten}', nn, 10);
  assert.strictEqual(ok.loi, '');
  assert.deepStrictEqual(ok.ds, [{ email: 'a@x.com', tieuDe: 'Mời A', noiDung: 'Chào A' }, { email: 'b@x.com', tieuDe: 'Mời B', noiDung: 'Chào B' }]);
  assert.match(L.chuanBiGuiHangLoat('x', 'Chào {Lop}', nn, 10).loi, /\{Lop\}/);
  assert.match(L.chuanBiGuiHangLoat('x', 'y', nn, 1).loi, /chỉ còn gửi được 1/);
  assert.match(L.chuanBiGuiHangLoat('x', 'y', [{ email: 'sai' }], 10).loi, /chưa đúng/);
  assert.match(L.chuanBiGuiHangLoat('', 'y', nn, 10).loi, /tiêu đề/);
});

test('htmlSangChu và lamSachHtml', () => {
  assert.strictEqual(L.htmlSangChu('<div>Chào <b>bạn</b></div><div><br></div><p>A &amp; B</p>'), 'Chào bạn\n\nA & B');
  assert.strictEqual(L.htmlSangChu('<div><br></div>'), '');
  const s = L.lamSachHtml('<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">l</a><img src="data:image/png;base64,AA"><iframe src="x"></iframe>');
  assert.doesNotMatch(s, /onclick|script|javascript|iframe/i);
  assert.match(s, /<p>Hi<\/p>/);
  assert.match(s, /data:image\/png/);
});

test('chuanBiGuiTuNhap thay chỗ trống, escape giá trị trong HTML', () => {
  const mau = { tieuDe: 'Chào {HoVaTen}', html: '<p>Bạn {Họ và tên} ở ban {Ban}</p>' };
  const kq = L.chuanBiGuiTuNhap(mau, [{ email: 'a@x.com', duLieu: { HoVaTen: 'A <B>', Ban: 'PG' } }, { email: 'A@x.com', duLieu: {} }], 10);
  assert.strictEqual(kq.loi, '');
  assert.strictEqual(kq.ds.length, 1);
  assert.strictEqual(kq.ds[0].tieuDe, 'Chào A <B>');
  assert.strictEqual(kq.ds[0].html, '<p>Bạn A &lt;B&gt; ở ban PG</p>');
  assert.strictEqual(kq.ds[0].chu, 'Bạn A <B> ở ban PG');
  assert.match(L.chuanBiGuiTuNhap(mau, [{ email: 'a@x.com', duLieu: { HoVaTen: 'A' } }], 10).loi, /\{Ban\}/);
  assert.match(L.chuanBiGuiTuNhap({ tieuDe: '', html: '<p>x</p>' }, [], 10).loi, /tiêu đề/);
  assert.match(L.chuanBiGuiTuNhap({ tieuDe: 'x', html: '<div><br></div>' }, [], 10).loi, /nội dung/);
  assert.match(L.chuanBiGuiTuNhap({ tieuDe: 'x', html: 'y' }, [{ email: 'a@x.com' }, { email: 'b@x.com' }], 1).loi, /chỉ còn/);
});

test('chỗ chèn viết {Tên cột} hay {{Tên cột}}, có dấu hay không dấu đều khớp', () => {
  const L2 = require('./load-logic');
  assert.deepStrictEqual(L2.timChoTrong('Chào {{Họ và tên}} ban {Ban}, {{ Lớp }}'), ['Họ và tên', 'Ban', 'Lớp']);
  const kq = L2.thayTheMau('Chào {{Họ và tên}} ({HoVaTen}) ban {Ban} {Lạ}', { 'Họ và tên': 'An', Ban: 'PG' });
  assert.strictEqual(kq.chu, 'Chào An (An) ban PG {Lạ}');
  assert.deepStrictEqual(kq.thieu, ['Lạ']);
});
