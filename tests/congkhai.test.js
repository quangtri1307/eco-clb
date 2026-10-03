// Trên Apps Script, trang web gọi thẳng được mọi hàm không có dấu _ ở cuối tên.
// Kiểm tra: hàm nào gọi được từ ngoài thì phải kiểm tra đăng nhập, trừ vài hàm được phép công khai.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const CONG_KHAI = [
  'doGet', 'include', 'onOpen', 'onEdit', // Apps Script tự gọi
  'khoiTaoCoSoDuLieu', // chạy tay trong Apps Script để cấp quyền; chạy lại nhiều lần không sao
  'moHopThoaiTaiDanhSach', 'taiDanhSachThanhVien', // menu trong Sheet (có vé dùng một lần)
  'guiThuDaLenLich', 'nhacViecHangNgay', 'khiNopForm', // lịch chạy tự động (kiểm tra laLichChay_)
  'layDuLieuBoard', 'layLichSuBoard', 'guiGopY', // ECOBoard không cần đăng nhập
  'dangNhap', 'dangNhapGoogle', 'dangXuat', 'moDesk', 'layAnhNen' // trước khi đăng nhập
];

function hamCongKhai() {
  const ra = [];
  fs.readdirSync(SRC).filter((f) => f.endsWith('.gs')).forEach((f) => {
    const s = fs.readFileSync(path.join(SRC, f), 'utf8');
    const dau = [...s.matchAll(/^function ([A-Za-z0-9$]+)\(/gm)];
    dau.forEach((m, i) => {
      const than = s.slice(m.index, i + 1 < dau.length ? dau[i + 1].index : s.length);
      ra.push({ ten: m[1], file: f, than });
    });
  });
  return ra;
}

test('hàm gọi được từ trang web đều kiểm tra đăng nhập', () => {
  const thieu = hamCongKhai().filter((h) => CONG_KHAI.indexOf(h.ten) < 0 && !/(canDangNhap_|docPhien_)\(/.test(h.than));
  assert.deepStrictEqual(thieu.map((h) => h.file + ': ' + h.ten), []);
});

test('hàm chạy theo lịch và tải danh sách có chặn người ngoài', () => {
  const ds = hamCongKhai();
  const than = (ten) => ds.filter((h) => h.ten === ten)[0].than;
  assert.match(than('nhacViecHangNgay'), /laLichChay_\(e\)/);
  assert.match(than('guiThuDaLenLich'), /laLichChay_\(e\)/);
  assert.match(than('khiNopForm'), /laLichChay_\(e\)/);
  assert.match(than('taiDanhSachThanhVien'), /ve_tai_danh_sach/);
});
