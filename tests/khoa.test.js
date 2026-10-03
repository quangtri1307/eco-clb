// Kiểm tra khoá ghi và bộ nhớ tạm của bảng (Code.gs) bằng Google Sheet giả.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MA = ['Logic.gs', 'Code.gs'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');

/** Một "máy chủ" giả: sheet, bộ nhớ tạm và khoá dùng chung giữa các lần chạy. */
function mayChu() {
  const tabs = {};
  const dem = { docSheet: 0, flush: 0, khoa: 0 };
  const cache = new Map();
  const khoaChung = { dangGiu: false };
  const props = new Map();
  function tab(ten) {
    const sh = {
      ten, o: [],
      getName: () => ten,
      getLastRow: () => sh.o.length,
      getLastColumn: () => (sh.o[0] || []).length,
      getMaxRows: () => sh.o.length + 100,
      setFrozenRows() {},
      deleteRow(r) { sh.o.splice(r - 1, 1); },
      getDataRange() { return sh.getRange(1, 1, sh.o.length, sh.getLastColumn()); },
      getRange(r, c, nr = 1, nc = 1) {
        const rg = {
          getValues() {
            dem.docSheet++;
            const ra = [];
            for (let i = 0; i < nr; i++) { const d = sh.o[r - 1 + i] || []; const x = []; for (let j = 0; j < nc; j++) x.push(d[c - 1 + j] === undefined ? '' : d[c - 1 + j]); ra.push(x); }
            return ra;
          },
          setValues(v) {
            v.forEach((d, i) => { const row = sh.o[r - 1 + i] || (sh.o[r - 1 + i] = []); d.forEach((x, j) => { row[c - 1 + j] = x; }); });
            return rg;
          },
          setValue(x) { return rg.setValues([[x]]); },
          clearContent() { for (let i = 0; i < nr; i++) { const d = sh.o[r - 1 + i]; if (d) for (let j = 0; j < nc; j++) d[c - 1 + j] = ''; } while (sh.o.length && sh.o[sh.o.length - 1].every((x) => x === '')) sh.o.pop(); return rg; },
          setNumberFormat() { return rg; }, setFontWeight() { return rg; }, setBackground() { return rg; }, setFontColor() { return rg; }
        };
        return rg;
      }
    };
    return sh;
  }
  const ss = {
    getSheetByName: (t) => tabs[t] || null,
    insertSheet: (t) => (tabs[t] = tab(t)),
    getSheets: () => Object.values(tabs),
    deleteSheet: (sh) => { delete tabs[sh.ten]; }
  };
  /** Một lần chạy mới: biến toàn cục làm lại từ đầu, dữ liệu thì dùng chung. */
  function lanChay() {
    const ctx = {
      SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush: () => { dem.flush++; } },
      CacheService: { getScriptCache: () => ({
        get: (k) => (cache.has(k) ? cache.get(k) : null),
        getAll: (ks) => { const o = {}; ks.forEach((k) => { if (cache.has(k)) o[k] = cache.get(k); }); return o; },
        put: (k, v) => { cache.set(k, v); },
        remove: (k) => { cache.delete(k); }
      }) },
      LockService: { getScriptLock: () => ({
        tryLock() { if (khoaChung.dangGiu) return false; khoaChung.dangGiu = true; dem.khoa++; return true; },
        releaseLock() { khoaChung.dangGiu = false; }
      }) },
      PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (props.has(k) ? props.get(k) : null), setProperty: (k, v) => props.set(k, v) }) },
      Utilities: { getUuid: () => Math.random().toString(36).slice(2) }
    };
    vm.createContext(ctx);
    vm.runInContext(MA, ctx);
    return ctx;
  }
  return { tabs, dem, cache, khoaChung, lanChay };
}

test('bảng ít đổi được nhớ tạm giữa các lần chạy, ngày giờ giữ đúng kiểu', () => {
  const m = mayChu();
  const a = m.lanChay();
  a.khoiTaoCoSoDuLieu();
  const ngay = new Date(2026, 9, 3, 8, 30);
  a.themDong('TaiKhoan', [{ Email: 'a@x.vn', HoVaTen: 'A', VaiTro: 'BOD', NgayTao: ngay }]);
  const b = m.lanChay();
  const truoc = m.dem.docSheet;
  assert.strictEqual(b.docBang('TaiKhoan')[0].Email, 'a@x.vn');
  const c = m.lanChay();
  const doc = m.dem.docSheet;
  const tk = c.docBang('TaiKhoan')[0];
  assert.strictEqual(m.dem.docSheet, doc, 'lần chạy sau lấy từ bộ nhớ tạm, không đọc sheet');
  assert.ok(doc > truoc);
  assert.ok(Object.prototype.toString.call(tk.NgayTao) === '[object Date]' && tk.NgayTao.getTime() === ngay.getTime());
  tk.HoVaTen = 'sửa trên bản sao';
  assert.strictEqual(c.docBang('TaiKhoan')[0].HoVaTen, 'A', 'mỗi lần đọc là một bản riêng');
});

test('ghi vào bảng thì lần chạy khác thấy ngay dữ liệu mới', () => {
  const m = mayChu();
  const a = m.lanChay();
  a.khoiTaoCoSoDuLieu();
  a.datCaiDat('QuyChe', 'link-cu');
  assert.strictEqual(m.lanChay().layCaiDat('QuyChe'), 'link-cu');
  m.lanChay().datCaiDat('QuyChe', 'link-moi');
  assert.strictEqual(m.lanChay().layCaiDat('QuyChe'), 'link-moi');
  m.lanChay().ghiDeBang('LoaiHoatDong', [{ TenLoai: 'Staff', Diem: 5 }]);
  assert.strictEqual(m.lanChay().docBang('LoaiHoatDong')[0].Diem, 5);
});

test('bản đọc cũ cất vào sau khi người khác đã ghi thì không được dùng', () => {
  const m = mayChu();
  m.lanChay().khoiTaoCoSoDuLieu();
  m.lanChay().datCaiDat('X', 'cu');
  const r = m.lanChay();
  // r đọc phiên bản trước, rồi có người ghi chen vào, rồi r mới cất bản cũ.
  const pb = m.cache.get('phienban_CaiDat') || '0';
  m.lanChay().datCaiDat('X', 'moi');
  m.cache.set('bang_CaiDat', pb + '|' + r.maHoaBang([{ Khoa: 'X', GiaTri: 'cu' }]));
  assert.strictEqual(m.lanChay().layCaiDat('X'), 'moi');
});

test('sửa tay trên sheet (onEdit) thì bỏ bản nhớ tạm', () => {
  const m = mayChu();
  const a = m.lanChay();
  a.khoiTaoCoSoDuLieu();
  a.datCaiDat('X', 'cu');
  m.lanChay().layCaiDat('X');
  m.tabs.CaiDat.o[1][1] = 'sua-tay';
  const b = m.lanChay();
  b.onEdit({ range: { getSheet: () => m.tabs.CaiDat } });
  assert.strictEqual(m.lanChay().layCaiDat('X'), 'sua-tay');
});

test('khoá lồng nhau chỉ khoá một lần, ghi xong thì nhả và đẩy dữ liệu xuống sheet', () => {
  const m = mayChu();
  const a = m.lanChay();
  a.khoiTaoCoSoDuLieu();
  const khoaTruoc = m.dem.khoa, flushTruoc = m.dem.flush;
  const kq = a.voiKhoa_(() => {
    a.themDong('GopY', [{ NoiDung: '1' }]);
    a.voiKhoa_(() => a.themDong('GopY', [{ NoiDung: '2' }]));
    return a.docBang('GopY').length;
  });
  assert.strictEqual(kq, 2);
  assert.strictEqual(m.dem.khoa - khoaTruoc, 1);
  assert.ok(m.dem.flush > flushTruoc);
  assert.strictEqual(m.khoaChung.dangGiu, false);
  assert.strictEqual(a.DO_SAU_KHOA_, 0);
});

test('lỗi giữa chừng vẫn nhả khoá', () => {
  const m = mayChu();
  const a = m.lanChay();
  assert.throws(() => a.voiKhoa_(() => { throw new Error('hỏng'); }), /hỏng/);
  assert.strictEqual(m.khoaChung.dangGiu, false);
  assert.strictEqual(a.DO_SAU_KHOA_, 0);
});

test('đang có người giữ khoá: báo bận, hoặc trả về false cho việc chạy tự động', () => {
  const m = mayChu();
  const a = m.lanChay();
  m.khoaChung.dangGiu = true;
  assert.throws(() => a.voiKhoa_(() => 1), /nhiều người lưu cùng lúc/);
  assert.strictEqual(a.layKhoa_(1, true), false);
  assert.strictEqual(a.DO_SAU_KHOA_, 0);
});

test('trong khoá luôn đọc thẳng từ sheet, không dùng bản nhớ tạm', () => {
  const m = mayChu();
  const a = m.lanChay();
  a.khoiTaoCoSoDuLieu();
  a.datCaiDat('X', 'cu');
  const b = m.lanChay();
  b.layCaiDat('X'); // b đã nhớ bản cũ
  m.lanChay().datCaiDat('X', 'moi'); // người khác ghi
  assert.strictEqual(b.voiKhoa_(() => b.layCaiDat('X')), 'moi');
});
