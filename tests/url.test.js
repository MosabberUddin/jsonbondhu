const test = require('node:test');
const assert = require('node:assert');
const U = require('../public/lib/url-core.js');

test('component vs full-URL encoding', () => {
  const s = 'https://x.com/a b?q=১&r=a/b#h';
  assert.strictEqual(U.encode(s, 'component'), encodeURIComponent(s));
  assert.strictEqual(U.encode(s, 'uri'), 'https://x.com/a%20b?q=%E0%A7%A7&r=a/b#h');
  assert.strictEqual(U.encode('a&b=c', 'component'), 'a%26b%3Dc');
  assert.strictEqual(U.encode('a&b=c', 'uri'), 'a&b=c');
});

test('form encoding uses + for spaces and escapes literal +', () => {
  assert.strictEqual(U.encode('a b+c', 'component', { plus: true }), 'a+b%2Bc');
  assert.strictEqual(U.decode('a+b%2Bc', 'component', { plus: true }), 'a b+c');
  assert.strictEqual(U.decode('a+b', 'component'), 'a+b');
});

test('Bangla round-trips', () => {
  const s = 'আমার সোনার বাংলা ১২৩';
  for (const mode of ['component', 'uri']) {
    for (const plus of [false, true]) {
      assert.strictEqual(U.decode(U.encode(s, mode, { plus }), mode, { plus }), s);
    }
  }
});

test('decodeURI semantics keep reserved characters encoded', () => {
  assert.strictEqual(U.decode('a%2Fb%20c', 'uri'), 'a%2Fb c');
  assert.strictEqual(U.decode('a%2Fb%20c', 'component'), 'a/b c');
});

test('malformed sequences give a position instead of crashing', () => {
  assert.throws(() => U.decode('abc%zz', 'component'), (e) => e.code === 'malformed' && e.index === 3 && e.seq === '%zz');
  assert.throws(() => U.decode('100%', 'component'), (e) => e.code === 'malformed' && e.index === 3);
  assert.throws(() => U.decode('ok%20then%E0%A6', 'component'), (e) => e.code === 'malformed' && e.index === 9 && e.seq === '%E0');
  assert.throws(() => U.decode('%C3%28', 'uri'), (e) => e.code === 'malformed' && e.index === 0);
});

test('lenient decode keeps broken escapes and decodes the rest', () => {
  assert.strictEqual(U.decodeLenient('50%25 off 100% %E0%A6%95 %FF', 'component'), '50% off 100% ক %FF');
  assert.strictEqual(U.decodeLenient('a+b%zz', 'component', { plus: true }), 'a b%zz');
});

test('lone surrogates are reported', () => {
  assert.throws(() => U.encode('\uD800', 'component'), (e) => e.code === 'surrogate');
});

test('parses URL parts and decodes query params, including repeated keys', () => {
  const r = U.parse('https://user:pw@example.com:8080/p%C3%A5th/%E0%A6%95?tag=a&tag=b+c&q=%E0%A6%AC%E0%A6%BE&empty=&flag#sec%201');
  assert.strictEqual(r.protocol, 'https:');
  assert.strictEqual(r.hostname, 'example.com');
  assert.strictEqual(r.port, '8080');
  assert.strictEqual(r.username, 'user');
  assert.strictEqual(r.password, '••');
  assert.strictEqual(r.pathname, '/påth/ক');
  assert.strictEqual(r.hash, 'sec 1');
  assert.deepStrictEqual(r.params.map((p) => [p.key, p.value, p.occurrence, p.total]), [
    ['tag', 'a', 1, 2], ['tag', 'b c', 2, 2], ['q', 'বা', 1, 1], ['empty', '', 1, 1], ['flag', '', 1, 1],
  ]);
  assert.deepStrictEqual(r.repeatedKeys, ['tag']);
});

test('parse reports default ports, assumes https for bare hosts, rejects junk', () => {
  assert.strictEqual(U.parse('http://a.com/').defaultPort, '80');
  const bare = U.parse('example.com/x?y=1');
  assert.strictEqual(bare.assumedScheme, true);
  assert.strictEqual(bare.hostname, 'example.com');
  assert.strictEqual(bare.params[0].value, '1');
  assert.strictEqual(U.parse('not a url'), null);
  assert.strictEqual(U.parse(''), null);
  assert.strictEqual(U.parse('mailto:a@b.com').protocol, 'mailto:');
  const withPort = U.parse('example.com:8080/x');
  assert.strictEqual(withPort.hostname, 'example.com');
  assert.strictEqual(withPort.port, '8080');
  assert.strictEqual(U.parse('localhost:3000').port, '3000');
});
