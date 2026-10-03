// So file log app tạo với tool tạo file log cũ của CLB (tests/mau/tool-log-cu.js) trên cùng một Google Sheet giả.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const TOOL_CU = fs.readFileSync(path.join(__dirname, 'mau', 'tool-log-cu.js'), 'utf8');

/** Một tab giả: lưu từng ô (giá trị, công thức, định dạng), ô gộp, khung, khoá. */
function taoTab(ten, soDong, soCot) {
  const sh = { ten, o: {}, gop: [], khung: [], khoa: null, soDong, soCot };
  const khoaO = (r, c) => r + ',' + c;
  const lay = (r, c) => sh.o[khoaO(r, c)] || (sh.o[khoaO(r, c)] = {});
  const chuSo = (a1) => { const m = a1.match(/^([A-Z]+)(\d+)$/); let c = 0; for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64; return [Number(m[2]), c]; };
  sh.getName = () => ten;
  sh.getMaxRows = () => sh.soDong;
  sh.getMaxColumns = () => sh.soCot;
  sh.insertRowsAfter = (sau, so) => { sh.soDong += so; };
  sh.insertColumnsAfter = (sau, so) => {
    const moi = {};
    Object.keys(sh.o).forEach((k) => { const [r, c] = k.split(',').map(Number); moi[khoaO(r, c > sau ? c + so : c)] = sh.o[k]; });
    sh.o = moi; sh.soCot += so;
  };
  sh.protect = () => { sh.khoa = { mota: '', mo: [] }; const p = { setDescription(m) { sh.khoa.mota = m; return p; }, setUnprotectedRanges(ds) { sh.khoa.mo = ds.map((x) => x.mo); return p; } }; return p; };
  sh.getRange = (r, c, nr = 1, nc = 1) => {
    if (typeof r === 'string') { [r, c] = chuSo(r); }
    const moiO = (f) => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) f(lay(r + i, c + j), i, j); return rg; };
    const rg = {
      mo: [r, c, nr, nc],
      getBackground: () => lay(r, c).nen || '#ffffff',
      setValues: (v) => moiO((o, i, j) => { const x = v[i][j]; o.gt = typeof x === 'string' && x[0] === "'" ? x.slice(1) : x; delete o.ct; }),
      setValue: (x) => rg.setValues([[x]]),
      setFormula: (f) => moiO((o) => { o.ct = f; delete o.gt; }),
      setFormulas: (v) => moiO((o, i, j) => { o.ct = v[i][j]; delete o.gt; }),
      setBackground: (x) => moiO((o) => { o.nen = x; }),
      setFontColor: (x) => moiO((o) => { o.mauChu = x; }),
      setFontWeight: (x) => moiO((o) => { o.dam = x; }),
      setHorizontalAlignment: (x) => moiO((o) => { o.ngang = x; }),
      setVerticalAlignment: (x) => moiO((o) => { o.doc = x; }),
      setTextRotation: (x) => moiO((o) => { o.xoay = x; }),
      setNumberFormat: (x) => moiO((o) => { o.dang = x; }),
      insertCheckboxes: () => moiO((o) => { o.tich = true; }),
      merge: () => { sh.gop.push([r, c, nr, nc].join(',')); return rg; },
      setBorder: (...a) => { sh.khung.push([r, c, nr, nc].join(',') + ' ' + a.slice(6, 7).join() + ' ' + a.slice(0, 6).join()); return rg; },
      copyTo: (dich) => {
        const [r2, c2] = dich.mo;
        for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
          const o = sh.o[khoaO(r + i, c + j)];
          if (o) sh.o[khoaO(r2 + i, c2 + j)] = JSON.parse(JSON.stringify(o));
          else delete sh.o[khoaO(r2 + i, c2 + j)];
        }
        return rg;
      }
    };
    return rg;
  };
  return sh;
}

/** File mẫu giống mẫu tool cũ: tiêu đề dòng 1–2, tiêu đề cột dòng 3–4, cột E là buổi mẫu, F là Ghi chú. */
function taoFileMau() {
  const dk = taoTab('Đăng ký log', 60, 6);
  dk.getRange(1, 1).setValue('ĐĂNG KÝ LÀM LOG');
  dk.getRange(3, 1, 1, 4).setValues([['Họ và tên', 'Lớp', 'Ban', 'SĐT']]);
  dk.getRange(3, 1, 2, 6).setBackground('#b6d7a8');
  dk.getRange('F4').setBackground('#fce5cd');
  dk.getRange(5, 5, 50, 1).setBackground('#eeeeee');
  const kh = taoTab('Kế hoạch', 30, 2);
  kh.getRange(3, 1).setValue('Buổi');
  kh.getRange(3, 2, 3, 1).setBackground('#d9ead3');
  const tabs = [dk, kh];
  return { tabs, getSheetByName: (t) => tabs.find((x) => x.ten === t) || null, getSheets: () => tabs, getUrl: () => 'https://x' };
}

const TV = [
  { HoVaTen: 'Nguyễn An', Lop: '11A1', Ban: 'PR CAP', SoDienThoaiCaNhan: '0912000001' },
  { HoVaTen: 'Trần Bình', Lop: '10A2', Ban: 'HR', SoDienThoaiCaNhan: '0912000002' },
  { HoVaTen: 'Lê Chi', Lop: '11A3', Ban: 'PR CAP', SoDienThoaiCaNhan: '' },
  { HoVaTen: 'Phạm Dũng', Lop: '12A1', Ban: 'BOD', SoDienThoaiCaNhan: '0912000004' },
  { HoVaTen: 'Võ Em', Lop: '10A1', Ban: 'HR', SoDienThoaiCaNhan: '0912000005' }
];
const KIEU = { BorderStyle: { SOLID: 'SOLID' } };

function chayToolCu(buoi) {
  const mau = taoFileMau();
  const nguon = { getSheetByName: () => ({ getDataRange: () => ({ getValues: () => [['Tên', 'Lớp', 'Ban', 'x', 'SĐT']].concat(TV.map((t) => [t.HoVaTen, t.Lop, t.Ban, '', t.SoDienThoaiCaNhan])) }) }) };
  const traLoi = ['ODAY', buoi.join(', ')];
  const ui = { ButtonSet: { OK_CANCEL: 1, OK: 2 }, Button: { OK: 'ok' }, prompt: () => { const t = traLoi.shift(); return { getSelectedButton: () => 'ok', getResponseText: () => t }; }, alert() {} };
  let tenFile = '';
  const ctx = {
    SpreadsheetApp: Object.assign({ getUi: () => ui, getActiveSpreadsheet: () => nguon, open: () => mau }, KIEU),
    DriveApp: { getFileById: () => ({ makeCopy: (t) => { tenFile = t; return {}; } }), getFolderById: () => ({}) }
  };
  vm.createContext(ctx);
  vm.runInContext(TOOL_CU, ctx);
  ctx.createLogFromTemplate();
  return { mau, tenFile };
}

function chayApp(buoi, chon) {
  const mau = taoFileMau();
  const ctx = { SpreadsheetApp: Object.assign({}, KIEU) };
  vm.createContext(ctx);
  vm.runInContext(SRC('Logic.gs') + '\n' + SRC('BaoCao.gs'), ctx);
  const nguoi = chon.map((ten) => TV.find((t) => t.HoVaTen === ten));
  ctx.dienMauToolCu_(mau, ctx.timTab_(mau, 'đăng ký LOG '), ctx.xepTheoBan_(nguoi, TV), buoi);
  return { mau, ctx };
}

// Chuyển qua JSON để so được dữ liệu sinh ra trong vm (khác realm).
const trangThai = (mau) => JSON.parse(JSON.stringify(mau.tabs.map((t) => ({ ten: t.ten, soCot: t.soCot, soDong: t.soDong, o: t.o, gop: t.gop.slice().sort(), khung: t.khung, khoa: t.khoa }))));

for (const buoi of [['Sáng T7'], ['Sáng T7', 'Chiều T7', 'Sáng CN']]) {
  test('file log app tạo giống hệt tool cũ (' + buoi.length + ' buổi)', () => {
    const cu = chayToolCu(buoi);
    // Chọn theo thứ tự lộn xộn: app vẫn xếp theo ban, cùng ban giữ thứ tự danh sách thành viên.
    const moi = chayApp(buoi, ['Võ Em', 'Phạm Dũng', 'Lê Chi', 'Trần Bình', 'Nguyễn An']);
    assert.deepStrictEqual(trangThai(moi.mau), trangThai(cu.mau));
  });
}

test('tab Đăng ký log điền đúng chỗ', () => {
  const { mau } = chayApp(['A', 'B'], TV.map((t) => t.HoVaTen));
  const dk = mau.tabs[0], o = (r, c) => dk.o[r + ',' + c] || {};
  assert.deepStrictEqual([5, 6, 7, 8, 9].map((r) => o(r, 1).gt), ['Phạm Dũng', 'Trần Bình', 'Võ Em', 'Nguyễn An', 'Lê Chi']);
  assert.strictEqual(o(5, 4).gt, '0912000004');
  assert.deepStrictEqual([o(4, 5).gt, o(4, 6).gt, o(4, 7).gt], ['A', 'B', 'Ghi chú']);
  assert.strictEqual(o(3, 6).ct, '=COUNTIF(F5:F9, TRUE)');
  assert.strictEqual(o(4, 7).nen, '#fce5cd');
  assert.ok(o(9, 6).tich && !o(9, 7).tich);
  assert.ok(dk.gop.includes('6,3,2,1') && dk.gop.includes('8,3,2,1') && !dk.gop.includes('5,3,1,1'));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(dk.khoa.mo)), [[5, 5, 5, 2], [5, 7, 5, 1]]);
  assert.strictEqual(mau.tabs[1].o['3,3'].ct, "='Đăng ký log'!F3");
});

test('chữ cột', () => {
  const L = require('./load-logic');
  assert.deepStrictEqual([1, 5, 26, 27, 52, 703].map(L.chuCot), ['A', 'E', 'Z', 'AA', 'AZ', 'AAA']);
});
