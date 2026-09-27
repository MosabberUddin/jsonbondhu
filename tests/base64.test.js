const test = require('node:test');
const assert = require('node:assert');
const B = require('../public/lib/base64-core.js');

test('encodes ASCII like btoa, with and without padding', () => {
  assert.strictEqual(B.encodeText('Man'), 'TWFu');
  assert.strictEqual(B.encodeText('Ma'), 'TWE=');
  assert.strictEqual(B.encodeText('M'), 'TQ==');
  assert.strictEqual(B.encodeText('M', { pad: false }), 'TQ');
  assert.strictEqual(B.encodeText(''), '');
  assert.strictEqual(B.encodeText('hello world'), Buffer.from('hello world').toString('base64'));
});

test('Bangla and emoji round-trip through UTF-8', () => {
  for (const s of ['আমার সোনার বাংলা', 'JSON বন্ধু 😀', 'ক্ষ্ম ৳১২৩', '\u{1F1E7}\u{1F1E9}']) {
    const enc = B.encodeText(s);
    assert.strictEqual(enc, Buffer.from(s, 'utf8').toString('base64'));
    assert.strictEqual(B.decode(enc).text, s);
  }
});

test('URL-safe alphabet uses - and _ and decodes either alphabet', () => {
  const bytes = new Uint8Array([0xfb, 0xff, 0xbf]);
  assert.strictEqual(B.encodeBytes(bytes), '+/+/');
  assert.strictEqual(B.encodeBytes(bytes, { urlSafe: true }), '-_-_');
  assert.deepStrictEqual([...B.decodeToBytes('-_-_')], [0xfb, 0xff, 0xbf]);
  assert.deepStrictEqual([...B.decodeToBytes('+/+/')], [0xfb, 0xff, 0xbf]);
});

test('decodes unpadded input and ignores whitespace/line breaks', () => {
  assert.strictEqual(B.decode('TQ').text, 'M');
  assert.strictEqual(B.decode('TWE').text, 'Ma');
  assert.strictEqual(B.decode('aGVs\r\nbG8g\n d29y bGQ=').text, 'hello world');
});

test('rejects invalid Base64 with a useful error code', () => {
  assert.throws(() => B.decodeToBytes('abc$def'), (e) => e.code === 'char' && e.index === 3 && e.char === '$');
  assert.throws(() => B.decodeToBytes('abcde'), (e) => e.code === 'length');
  assert.throws(() => B.decodeToBytes('TQ=A'), (e) => e.code === 'padding');
  assert.throws(() => B.decodeToBytes('TWFu='), (e) => e.code === 'padding');
  assert.throws(() => B.decodeToBytes('TQ==='), (e) => e.code === 'padding');
  assert.throws(() => B.decodeToBytes('বাংলা'), (e) => e.code === 'char' && e.char === 'ব');
});

test('random bytes round-trip in both alphabets', () => {
  for (let n = 0; n < 50; n++) {
    const bytes = new Uint8Array(n);
    for (let i = 0; i < n; i++) bytes[i] = (i * 37 + n * 11) & 255;
    for (const opts of [{}, { urlSafe: true }, { pad: false }, { urlSafe: true, pad: false }]) {
      assert.deepStrictEqual(B.decodeToBytes(B.encodeBytes(bytes, opts)), bytes);
    }
    assert.strictEqual(B.encodeBytes(bytes), Buffer.from(bytes).toString('base64'));
  }
});

test('large input encodes correctly', () => {
  const bytes = new Uint8Array(100000).map((_, i) => i & 255);
  assert.strictEqual(B.encodeBytes(bytes), Buffer.from(bytes).toString('base64'));
});

test('parses data URIs', () => {
  assert.deepStrictEqual(B.parseDataUri('data:image/png;base64,iVBO'), { mime: 'image/png', base64: true, data: 'iVBO' });
  assert.deepStrictEqual(B.parseDataUri('data:,Hello%20there'), { mime: 'text/plain', base64: false, data: 'Hello%20there' });
  assert.strictEqual(B.parseDataUri('aGVsbG8='), null);
  assert.strictEqual(B.decode('data:text/plain;charset=utf-8;base64,4KaV').text, 'ক');
  assert.strictEqual(B.decode('data:,a%20b').text, 'a b');
});

test('sniffs images and treats them as binary', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  const r = B.decode(B.encodeBytes(png));
  assert.strictEqual(r.mime, 'image/png');
  assert.strictEqual(r.text, null);
  assert.strictEqual(B.sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.strictEqual(B.sniffMime(B.utf8Encode('GIF89a')), 'image/gif');
  assert.strictEqual(B.sniffMime(B.utf8Encode('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp');
  assert.strictEqual(B.sniffMime(B.utf8Encode('hello')), null);
  // Declared image type wins over octet-stream only when sniffing finds one.
  assert.strictEqual(B.decode('data:image/svg+xml;base64,' + B.encodeText('<svg/>')).mime, 'image/svg+xml');
});

test('invalid UTF-8 and control-heavy bytes are reported as binary', () => {
  assert.strictEqual(B.decode(B.encodeBytes(new Uint8Array([0xc3, 0x28]))).text, null);
  assert.strictEqual(B.decode(B.encodeBytes(new Uint8Array([0, 1, 2, 3, 4, 5]))).text, null);
  assert.strictEqual(B.decode(B.encodeText('line1\nline2\ttab')).text, 'line1\nline2\ttab');
});

test('toDataUri and extFor', () => {
  assert.strictEqual(B.toDataUri(B.utf8Encode('hi'), 'text/plain'), 'data:text/plain;base64,aGk=');
  assert.strictEqual(B.toDataUri(B.utf8Encode('hi')), 'data:application/octet-stream;base64,aGk=');
  assert.strictEqual(B.extFor('image/png', false), 'png');
  assert.strictEqual(B.extFor(null, true), 'txt');
  assert.strictEqual(B.extFor(null, false), 'bin');
});
