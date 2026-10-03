// Giao diện theo mùa và ngày lễ: mã hợp lệ, thuộc tính gắn vào trang, danh sách ở máy chủ khớp với trang.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('./load-logic');

test('chỉ nhận mã giao diện có trong danh sách', () => {
  assert.strictEqual(L.chuDeHopLe('tet'), 'tet');
  assert.strictEqual(L.chuDeHopLe(' halloween '), 'halloween');
  assert.strictEqual(L.chuDeHopLe(''), '');
  assert.strictEqual(L.chuDeHopLe(null), '');
  assert.strictEqual(L.chuDeHopLe('"><script>'), '');
});

test('thuộc tính html: mặc định không gắn gì, Halloween luôn tối', () => {
  assert.strictEqual(L.thuocTinhChuDe(''), '');
  assert.strictEqual(L.thuocTinhChuDe('linh tinh'), '');
  assert.strictEqual(L.thuocTinhChuDe('xuan'), ' data-chude="xuan"');
  assert.strictEqual(L.thuocTinhChuDe('halloween'), ' data-chude="halloween" data-theme="dark"');
});

/** Chạy phần script của ChuDe.html trong một trang giả để lấy danh sách và hàm tính màu. */
function napTrang(chuDe) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'ChuDe.html'), 'utf8');
  const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const kieu = { textContent: '' };
  const goc = { attrs: chuDe ? { 'data-chude': chuDe } : {}, getAttribute(k) { return this.attrs[k] || null; }, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } };
  const ctx = {
    document: { documentElement: goc, head: { appendChild() {} }, body: null, getElementById: (id) => (id === 'chude-mau' ? kieu : null), createElement: () => kieu, addEventListener() {}, querySelectorAll: () => [] },
    window: { innerWidth: 1200, addEventListener() {} }, localStorage: { getItem: () => null }, Math
  };
  vm.runInNewContext(js, ctx);
  return { ctx, kieu, goc };
}

test('danh sách giao diện trên trang khớp với máy chủ', () => {
  const { ctx } = napTrang('');
  const ma = vm.runInNewContext('DS_CHU_DE.map(function (p) { return p.ma; })', ctx);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ma)), L.CHU_DE);
  const toi = vm.runInNewContext('DS_CHU_DE.filter(function (p) { return p.toi; }).map(function (p) { return p.ma; })', ctx);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(toi)), ['halloween']);
  // Mỗi giao diện đều có trang trí, lời chúc, màu lá và hình trên thẻ chọn.
  L.CHU_DE.forEach((m) => {
    ['TRANG_TRI', 'LOI_CHUC', 'LA_CHU_DE', 'HINH_THE', 'HAT'].forEach((bang) => {
      assert.ok(vm.runInNewContext(bang + '[' + JSON.stringify(m) + ']', ctx), bang + ' thiếu ' + m);
    });
  });
});

test('màu tính sẵn là mã hex 6 chữ số (trang vỏ trên điện thoại chỉ nhận dạng này)', () => {
  L.CHU_DE.forEach((m) => {
    const { kieu } = napTrang(m);
    const css = kieu.textContent;
    assert.match(css, new RegExp('html\\[data-chude="' + m + '"\\]'));
    ['--brand', '--brand-3', '--bg', '--surface'].forEach((b) => {
      const ds = [...css.matchAll(new RegExp('(?:^|[;{])' + b + ':([^;}]+)', 'g'))].map((x) => x[1]);
      assert.ok(ds.length >= 1, m + ' thiếu ' + b);
      ds.forEach((v) => assert.match(v, /^#[0-9a-f]{6}$/, m + ' ' + b + ' = ' + v));
    });
  });
  assert.strictEqual(napTrang('').kieu.textContent, '');
});

test('đổi giao diện trên trang: gắn và bỏ thuộc tính, Halloween bật tối', () => {
  const { ctx, goc } = napTrang('');
  vm.runInNewContext('apChuDe("halloween")', ctx);
  assert.strictEqual(goc.attrs['data-chude'], 'halloween');
  assert.strictEqual(goc.attrs['data-theme'], 'dark');
  vm.runInNewContext('apChuDe("")', ctx);
  assert.strictEqual(goc.attrs['data-chude'], undefined);
  assert.strictEqual(goc.attrs['data-theme'], undefined);
  vm.runInNewContext('apChuDe("khong-co")', ctx);
  assert.strictEqual(goc.attrs['data-chude'], undefined);
});
