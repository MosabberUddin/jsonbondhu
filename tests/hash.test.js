const test = require('node:test');
const assert = require('node:assert');
const nodeCrypto = require('node:crypto');
const H = require('../public/lib/hash-core.js');

const subtle = globalThis.crypto.subtle;
const hex = (b) => H.toHex(b);
const bytesOf = (s) => H.utf8(s);

const VECTORS = {
  '': {
    'MD5': 'd41d8cd98f00b204e9800998ecf8427e',
    'SHA-1': 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
    'SHA-256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'SHA-384': '38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b',
    'SHA-512': 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  },
  abc: {
    'MD5': '900150983cd24fb0d6963f7d28e17f72',
    'SHA-1': 'a9993e364706816aba3e25717850c26c9cd0d89d',
    'SHA-256': 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    'SHA-384': 'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7',
    'SHA-512': 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
  },
};

for (const [input, algos] of Object.entries(VECTORS)) {
  for (const [algo, expected] of Object.entries(algos)) {
    test(`${algo} of ${JSON.stringify(input)}`, async () => {
      assert.strictEqual(hex(await H.digest(algo, bytesOf(input), subtle)), expected);
    });
  }
}

test('MD5 matches the RFC 1321 test suite', () => {
  const suite = {
    'a': '0cc175b9c0f1b6a831c399e269772661',
    'message digest': 'f96b697d7cb7938d525a2f31aaf161d0',
    'abcdefghijklmnopqrstuvwxyz': 'c3fcd3d76192e4007dfb496cca67e13b',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789': 'd174ab98d277d9f5a5611c2c9f419d9f',
    '12345678901234567890123456789012345678901234567890123456789012345678901234567890': '57edf4a22be3c955ac49da2e2107b67a',
  };
  for (const [s, e] of Object.entries(suite)) assert.strictEqual(hex(H.md5(bytesOf(s))), e, s);
});

test('MD5 agrees with node:crypto across padding boundaries and UTF-8', () => {
  for (const n of [0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 128, 1000]) {
    const b = new Uint8Array(n).map((_, i) => (i * 31 + 7) & 255);
    assert.strictEqual(hex(H.md5(b)), nodeCrypto.createHash('md5').update(b).digest('hex'), 'len ' + n);
  }
  const bn = bytesOf('বাংলা হ্যাশ ✓');
  assert.strictEqual(hex(H.md5(bn)), nodeCrypto.createHash('md5').update(bn).digest('hex'));
});

test('Bangla text hashes like node:crypto', async () => {
  const bn = bytesOf('বাংলা হ্যাশ ✓');
  assert.strictEqual(hex(await H.digest('SHA-256', bn, subtle)), nodeCrypto.createHash('sha256').update(bn).digest('hex'));
});

test('HMAC-MD5 RFC 2202 vectors', async () => {
  const k1 = new Uint8Array(16).fill(0x0b);
  assert.strictEqual(hex(await H.hmac('MD5', k1, bytesOf('Hi There'), subtle)), '9294727a3638bb1c13f48ef8158bfc9d');
  assert.strictEqual(hex(await H.hmac('MD5', bytesOf('Jefe'), bytesOf('what do ya want for nothing?'), subtle)), '750c783e6ab0b503eaa86e310a5db738');
  const k6 = new Uint8Array(80).fill(0xaa);
  assert.strictEqual(hex(await H.hmac('MD5', k6, bytesOf('Test Using Larger Than Block-Size Key - Hash Key First'), subtle)), '6b1ab7fe4bd7bf8f0b62e6ce61b9d0cd');
});

test('HMAC-SHA RFC 4231 vectors', async () => {
  const k1 = new Uint8Array(20).fill(0x0b);
  assert.strictEqual(hex(await H.hmac('SHA-256', k1, bytesOf('Hi There'), subtle)), 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
  assert.strictEqual(hex(await H.hmac('SHA-384', k1, bytesOf('Hi There'), subtle)), 'afd03944d84895626b0825f4ab46907f15f9dadbe4101ec682aa034c7cebc59cfaea9ea9076ede7f4af152e8b2fa9cb6');
  assert.strictEqual(hex(await H.hmac('SHA-512', k1, bytesOf('Hi There'), subtle)), '87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cdedaa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854');
  const jefe = bytesOf('Jefe'), msg = bytesOf('what do ya want for nothing?');
  assert.strictEqual(hex(await H.hmac('SHA-256', jefe, msg, subtle)), '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  const k6 = new Uint8Array(131).fill(0xaa);
  assert.strictEqual(hex(await H.hmac('SHA-256', k6, bytesOf('Test Using Larger Than Block-Size Key - Hash Key First'), subtle)), '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54');
});

test('HMAC-SHA-1 RFC 2202 vector', async () => {
  const k1 = new Uint8Array(20).fill(0x0b);
  assert.strictEqual(hex(await H.hmac('SHA-1', k1, bytesOf('Hi There'), subtle)), 'b617318655057264e28bc0b6fb378c8ef146be00');
});

test('HMAC agrees with node:crypto for every algorithm, including an empty key', async () => {
  const msg = bytesOf('বাংলা message');
  for (const key of [new Uint8Array(0), bytesOf('secret'), new Uint8Array(200).fill(7)]) {
    for (const a of H.ALGOS) {
      const expected = nodeCrypto.createHmac(a.replace('-', '').toLowerCase(), key).update(msg).digest('hex');
      assert.strictEqual(hex(await H.hmac(a, key, msg, subtle)), expected, a + ' key ' + key.length);
    }
  }
});

test('encoders', () => {
  const b = new Uint8Array([0, 15, 255, 171]);
  assert.strictEqual(H.toHex(b), '000fffab');
  assert.strictEqual(H.format(b, 'hex-upper'), '000FFFAB');
  assert.strictEqual(H.format(b, 'base64'), 'AA//qw==');
});

test('compare is case-insensitive for hex and finds the algorithm', async () => {
  const res = await H.hashAll(bytesOf('abc'), subtle);
  assert.deepStrictEqual(H.compare('BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD', res), { match: true, algo: 'SHA-256', encoding: 'hex' });
  assert.deepStrictEqual(H.compare('  900150983cd24fb0d6963f7d28e17f72\n', res), { match: true, algo: 'MD5', encoding: 'hex' });
  assert.deepStrictEqual(H.compare(H.toBase64(res['SHA-1']), res), { match: true, algo: 'SHA-1', encoding: 'base64' });
  assert.strictEqual(H.compare('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ae', res).match, false);
  assert.strictEqual(H.compare('', res).empty, true);
  assert.strictEqual(H.compare('abc', res).match, false);
});

test('hashAll with a key returns HMACs', async () => {
  const res = await H.hashAll(bytesOf('Hi There'), subtle, { key: new Uint8Array(16).fill(0x0b) });
  assert.strictEqual(hex(res['MD5']), '9294727a3638bb1c13f48ef8158bfc9d');
});

test('timingSafeEqual and unsupported algorithm', async () => {
  assert.strictEqual(H.timingSafeEqual('abc', 'abc'), true);
  assert.strictEqual(H.timingSafeEqual('abc', 'abd'), false);
  assert.strictEqual(H.timingSafeEqual('abc', 'abcd'), false);
  await assert.rejects(() => H.digest('SHA-3', new Uint8Array(0), subtle));
});
