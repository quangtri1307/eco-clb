// Form seeding chạy trên Google Sheet giả: liên kết tab câu trả lời, bật, nộp form, không cộng hai lần.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MA = ['Logic.gs', 'Code.gs', 'FormSeeding.gs'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');

function mayChu() {
  const tabs = {}, cache = new Map(), props = new Map(), triggers = [];
  let soTab = 100;
  function tab(ten) {
    const sh = {
      ten, o: [], id: ++soTab,
      getName: () => ten, getSheetId: () => sh.id,
      getLastRow: () => sh.o.length,
      getLastColumn: () => Math.max(0, ...sh.o.map((r) => r.length)),
      setFrozenRows() {}, deleteRow(r) { sh.o.splice(r - 1, 1); },
      getDataRange() { return sh.getRange(1, 1, sh.o.length, sh.getLastColumn()); },
      getRange(r, c, nr = 1, nc = 1) {
        const rg = {
          getValues() { const ra = []; for (let i = 0; i < nr; i++) { const d = sh.o[r - 1 + i] || []; const x = []; for (let j = 0; j < nc; j++) x.push(d[c - 1 + j] === undefined ? '' : d[c - 1 + j]); ra.push(x); } return ra; },
          setValues(v) { v.forEach((d, i) => { const row = sh.o[r - 1 + i] || (sh.o[r - 1 + i] = []); d.forEach((x, j) => { row[c - 1 + j] = x; }); }); return rg; },
          setValue(x) { return rg.setValues([[x]]); },
          clearContent() { for (let i = 0; i < nr; i++) { const d = sh.o[r - 1 + i]; if (d) for (let j = 0; j < nc; j++) d[c - 1 + j] = ''; } while (sh.o.length && sh.o[sh.o.length - 1].every((x) => x === '')) sh.o.pop(); return rg; },
          setNumberFormat() { return rg; }, setFontWeight() { return rg; }, setBackground() { return rg; }, setFontColor() { return rg; }
        };
        return rg;
      }
    };
    return sh;
  }
  const ss = { getSheetByName: (t) => tabs[t] || null, insertSheet: (t) => (tabs[t] = tab(t)), getSheets: () => Object.values(tabs) };
  function lanChay() {
    const trig = (fn) => ({ getHandlerFunction: () => fn, getUniqueId: () => 'u-' + fn });
    const ctx = {
      SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush() {} },
      CacheService: { getScriptCache: () => ({ get: (k) => (cache.has(k) ? cache.get(k) : null), getAll: (ks) => { const o = {}; ks.forEach((k) => { if (cache.has(k)) o[k] = cache.get(k); }); return o; }, put: (k, v) => cache.set(k, v), remove: (k) => cache.delete(k) }) },
      LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
      PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (props.has(k) ? props.get(k) : null), setProperty: (k, v) => props.set(k, v) }) },
      Utilities: { getUuid: () => Math.random().toString(36).slice(2) },
      ScriptApp: {
        getProjectTriggers: () => triggers.map(trig),
        deleteTrigger: (t) => { const i = triggers.indexOf(t.getHandlerFunction()); if (i >= 0) triggers.splice(i, 1); },
        newTrigger: (fn) => ({ forSpreadsheet: () => ({ onFormSubmit: () => ({ create: () => triggers.push(fn) }) }) })
      },
      canDangNhap_: () => ({ HoVaTen: 'BOD A' })
    };
    vm.createContext(ctx);
    vm.runInContext(MA, ctx);
    return ctx;
  }
  return { tabs, triggers, lanChay };
}

function chuanBi() {
  const m = mayChu();
  const a = m.lanChay();
  a.khoiTaoCoSoDuLieu_();
  a.themDong_('ThanhVien', [
    { HoVaTen: 'Nguyễn Văn An', Ban: 'PG', TenFacebook: 'An Nguyễn' },
    { HoVaTen: 'Trần Thị Bình', Ban: 'PR CAP', TenFacebook: 'Bình Trần' },
    { HoVaTen: 'Phan Văn', Ban: 'BOD', TenFacebook: 'Văn Phan' },
    { HoVaTen: 'Lê Chưa Fb', Ban: 'HR', TenFacebook: '' }
  ]);
  a.themDong_('KyHoatDong', [{ NhiemKy: '2026-2027', HocKy: 1, BatDau: new Date(), KieuTaiLen: 'Sau tuyển đợt 1' }]);
  a.ghiDeBang_('LoaiHoatDong', [{ TenLoai: 'Staff', Diem: 3, CongTay: 'co' }, { TenLoai: 'Seeding Reaction', Diem: 1, CongTay: 'khong' }, { TenLoai: 'Seeding Comment', Diem: 2, CongTay: 'khong' }]);
  const form = m.lanChay().SpreadsheetApp.getActiveSpreadsheet().insertSheet('Câu trả lời biểu mẫu 1');
  form.o.push(['Dấu thời gian', 'Họ và tên người nộp', 'Reaction', 'Comment']);
  form.o.push([new Date('2026-09-01'), 'Cũ', 'An Nguyễn', '']); // câu có từ trước khi bật
  return { m, form };
}
const nopForm = (m, form, dong) => { form.o.push(dong); m.lanChay().khiNopForm({ triggerUid: 'u-khiNopForm', range: { getSheet: () => form } }); };
const j = (x) => JSON.parse(JSON.stringify(x));
const diem = (m) => j(m.lanChay().docBang_('LichSuDiem').map((d) => [d.HoVaTen, d.LoaiHoatDong, d.TenHoatDong, d.Diem]));

test('bật form: bỏ qua câu cũ, cài lịch; nộp form thì cộng ngay, cộng cả BOD', () => {
  const { m, form } = chuanBi();
  const ds = m.lanChay().layFormSeeding('p');
  assert.strictEqual(ds.tabs.length, 1);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ds.tabs[0].cot)), ['Reaction', 'Comment']);
  assert.deepStrictEqual(j(ds.thieuFb), ['Lê Chưa Fb']);
  const kq = m.lanChay().luuFormSeeding('p', {
    tab: ds.tabs[0].ma, anhXa: { Reaction: 'Seeding Reaction', Comment: 'Seeding Comment', Khac: 'Không có loại này' }, congCu: false
  });
  assert.strictEqual(kq.soLuot, 0);
  assert.deepStrictEqual(j(m.triggers), ['khiNopForm']);
  assert.match(String(form.o[1][4]), /Bỏ qua/);
  assert.strictEqual(m.lanChay().docBang_('LoaiHoatDong').length, 3, 'không tự tạo loại mới');

  nopForm(m, form, [new Date(), 'Hà', 'An Nguyễn\nVăn Phan\nNgười lạ', 'Bình Trần']);
  assert.deepStrictEqual(diem(m), [['Nguyễn Văn An', 'Seeding Reaction', 'Reaction', 1], ['Phan Văn', 'Seeding Reaction', 'Reaction', 1], ['Trần Thị Bình', 'Seeding Comment', 'Comment', 2]]);
  assert.strictEqual(form.o[2][4], 'Đã cộng 3 lượt');
  const nk = m.lanChay().layFormSeeding('p').nhatKy;
  assert.strictEqual(nk[0].nguoiNop, 'Hà');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(nk[0].khongKhop)), ['Người lạ']);

  // Chạy lại (quét tay hoặc lịch chạy lần nữa) thì không cộng hai lần.
  assert.strictEqual(m.lanChay().quetFormSeeding('p').soLuot, 0);
  assert.strictEqual(diem(m).length, 3);
});

test('form khác trong cùng file thì không đụng tới; tắt thì gỡ lịch', () => {
  const { m, form } = chuanBi();
  const ma = m.lanChay().layFormSeeding('p').tabs[0].ma;
  m.lanChay().luuFormSeeding('p', { tab: ma, anhXa: { Reaction: 'Staff' }, congCu: true });
  assert.deepStrictEqual(diem(m), [['Nguyễn Văn An', 'Staff', 'Reaction', 3]], 'chọn cộng cả câu cũ');
  const khac = m.lanChay().SpreadsheetApp.getActiveSpreadsheet().insertSheet('Câu trả lời biểu mẫu 2');
  khac.o.push(['Dấu thời gian', 'Họ và tên', 'Reaction']);
  nopForm(m, khac, [new Date(), 'X', 'Bình Trần']);
  assert.strictEqual(diem(m).length, 1);
  assert.strictEqual(khac.o[0].length, 3, 'không thêm cột vào form khác');
  m.lanChay().tatFormSeeding('p');
  assert.deepStrictEqual(j(m.triggers), []);
  assert.strictEqual(m.lanChay().layFormSeeding('p').cauHinh.bat, false);
});

test('lịch lạ (không phải lịch của app) gọi vào thì không làm gì', () => {
  const { m, form } = chuanBi();
  const ma = m.lanChay().layFormSeeding('p').tabs[0].ma;
  m.lanChay().luuFormSeeding('p', { tab: ma, anhXa: { Reaction: 'Staff' } });
  form.o.push([new Date(), 'X', 'Bình Trần', '']);
  m.lanChay().khiNopForm({ triggerUid: 'gia-mao', range: { getSheet: () => form } });
  assert.strictEqual(diem(m).length, 0);
});
