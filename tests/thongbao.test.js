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
