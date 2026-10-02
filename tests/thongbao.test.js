const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const L = require('./load-logic');

const hmac = (k, d) => Array.from(crypto.createHmac('sha256', Buffer.from(k)).update(Buffer.from(d)).digest());

test('khoaCongP256 khớp với thư viện chuẩn', () => {
  for (let i = 0; i < 3; i++) {
    const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
    const cong = L.khoaCongP256(Array.from(ecdh.getPrivateKey()));
    assert.deepStrictEqual(Buffer.from(cong), ecdh.getPublicKey());
  }
});

test('kyP256 tạo chữ ký JWT ES256 hợp lệ và ổn định', () => {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const rieng = Array.from(ecdh.getPrivateKey());
  const cong = Buffer.from(L.khoaCongP256(rieng));
  const jwk = { kty: 'EC', crv: 'P-256', x: cong.subarray(1, 33).toString('base64url'), y: cong.subarray(33).toString('base64url') };
  const khoa = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const vao = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJhdWQiOiJodHRwczovL2ZjbS5nb29nbGVhcGlzLmNvbSJ9';
  const bam = Array.from(crypto.createHash('sha256').update(vao).digest());
  const ky = L.kyP256(bam, rieng, hmac);
  assert.strictEqual(ky.length, 64);
  assert.ok(crypto.verify('sha256', Buffer.from(vao), { key: khoa, dsaEncoding: 'ieee-p1363' }, Buffer.from(ky)));
  assert.deepStrictEqual(L.kyP256(bam, rieng, hmac), ky);
});

test('kyP256 đúng mẫu RFC 6979 (P-256, SHA-256, "sample")', () => {
  const rieng = Array.from(Buffer.from('C9AFA9D845BA75166B5C215767B1D6934E50C3DB36E89B127B8A622B120F6721', 'hex'));
  const bam = Array.from(crypto.createHash('sha256').update('sample').digest());
  const ky = Buffer.from(L.kyP256(bam, rieng, hmac)).toString('hex').toUpperCase();
  assert.strictEqual(ky, 'EFD48B2AACB6A8FD1140DD9CD45E81D69D2C877B56AAF991C34D0EA84EAF3716' + 'F7CB1C942D657C41D436C7A1B6E29F65F3E900DBB9AFF4064DC4AB2F843ACDA8');
});

test('base64Url, gocDiaChi, chuanHoaCachNhan', () => {
  for (const n of [0, 1, 2, 3, 31, 32, 65]) {
    const b = crypto.randomBytes(n);
    assert.strictEqual(L.base64Url(Array.from(b)), b.toString('base64url'));
  }
  assert.strictEqual(L.gocDiaChi('https://fcm.googleapis.com/fcm/send/abc'), 'https://fcm.googleapis.com');
  assert.strictEqual(L.gocDiaChi('http://x.com/a'), '');
  assert.ok(L.diaChiDayHopLe('https://fcm.googleapis.com/fcm/send/abc'));
  assert.ok(L.diaChiDayHopLe('https://web.push.apple.com/QAbc'));
  assert.ok(L.diaChiDayHopLe('https://updates.push.services.mozilla.com/wpush/v2/x'));
  assert.ok(!L.diaChiDayHopLe('https://evil.com/fcm.googleapis.com'));
  assert.ok(!L.diaChiDayHopLe('https://fcm.googleapis.com.evil.com/x'));
  assert.ok(!L.diaChiDayHopLe('http://fcm.googleapis.com/x'));
  assert.deepStrictEqual(L.chuanHoaCachNhan('mail, zalo'), ['zalo', 'mail']);
  assert.deepStrictEqual(L.chuanHoaCachNhan(''), ['zalo']);
  assert.deepStrictEqual(L.chuanHoaCachNhan(['app', 'xyz']), ['app']);
});

test('maHoaAesGcm khớp với AES-128-GCM chuẩn', () => {
  const crypto = require('node:crypto');
  for (const n of [0, 1, 15, 16, 17, 100, 1000]) {
    const khoa = crypto.randomBytes(16), nonce = crypto.randomBytes(12), dl = crypto.randomBytes(n);
    const c = crypto.createCipheriv('aes-128-gcm', khoa, nonce);
    const mong = Buffer.concat([c.update(dl), c.final(), c.getAuthTag()]);
    assert.deepStrictEqual(Buffer.from(L.maHoaAesGcm(Array.from(khoa), Array.from(nonce), Array.from(dl))), mong);
  }
});

test('maHoaThongBaoDay giải mã được như trình duyệt (RFC 8291)', () => {
  const crypto = require('node:crypto');
  const hmac = (k, d) => Array.from(crypto.createHmac('sha256', Buffer.from(k)).update(Buffer.from(d)).digest());
  const may = crypto.createECDH('prime256v1'); may.generateKeys();
  const auth = crypto.randomBytes(16), salt = crypto.randomBytes(16);
  const tam = crypto.createECDH('prime256v1'); tam.generateKeys();
  const noiDung = Buffer.from(JSON.stringify({ tieuDe: 'Thử', noiDung: 'Nhắc deadline: nộp báo cáo' }));
  const than = Buffer.from(L.maHoaThongBaoDay(Array.from(noiDung), Array.from(may.getPublicKey()), Array.from(auth), Array.from(tam.getPrivateKey()), Array.from(salt), hmac));
  // Phía máy nhận: đọc tiêu đề rồi giải mã.
  const s = than.subarray(0, 16), rs = than.readUInt32BE(16), idlen = than[20], cong = than.subarray(21, 21 + idlen), ma = than.subarray(21 + idlen);
  assert.strictEqual(rs, 4096); assert.strictEqual(idlen, 65);
  const chung = may.computeSecret(cong);
  const H = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
  const ikm = H(H(auth, chung), Buffer.concat([Buffer.from('WebPush: info\0'), may.getPublicKey(), cong, Buffer.from([1])]));
  const prk = H(s, ikm);
  const cek = H(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = H(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(ma.subarray(ma.length - 16));
  const ro = Buffer.concat([d.update(ma.subarray(0, ma.length - 16)), d.final()]);
  assert.strictEqual(ro[ro.length - 1], 2);
  assert.deepStrictEqual(ro.subarray(0, -1), noiDung);
});
