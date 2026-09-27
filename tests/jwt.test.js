const test = require('node:test');
const assert = require('node:assert');
const nodeCrypto = require('node:crypto');
const J = require('../public/lib/jwt-core.js');

const { subtle } = nodeCrypto.webcrypto;
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const enc = (obj) => b64u(JSON.stringify(obj));

function hsToken(header, payload, secret) {
  const input = enc(header) + '.' + enc(payload);
  const alg = { HS256: 'sha256', HS384: 'sha384', HS512: 'sha512' }[header.alg];
  return input + '.' + b64u(nodeCrypto.createHmac(alg, secret).update(input).digest());
}

test('base64url round-trips all byte values and accepts standard base64', () => {
  const bytes = new Uint8Array(256).map((_, i) => i);
  for (let n = 0; n <= 10; n++) {
    const slice = bytes.slice(0, n);
    assert.strictEqual(J.b64urlEncode(slice), b64u(slice));
    assert.deepStrictEqual([...J.b64urlDecode(b64u(slice))], [...slice]);
  }
  assert.deepStrictEqual([...J.b64urlDecode(Buffer.from([251, 255]).toString('base64'))], [251, 255]);
  assert.throws(() => J.b64urlDecode('ab$c'));
  assert.throws(() => J.b64urlDecode('abcde'));
});

test('normalize strips whitespace, quotes and a Bearer prefix', () => {
  assert.strictEqual(J.normalize('  Bearer aaa.bbb.ccc \n'), 'aaa.bbb.ccc');
  assert.strictEqual(J.normalize('Authorization: Bearer aaa.bbb.ccc'), 'aaa.bbb.ccc');
  assert.strictEqual(J.normalize('"aaa.\nbbb.ccc"'), 'aaa.bbb.ccc');
});

test('decodes header, Unicode payload and signature', () => {
  const payload = { sub: '42', name: 'রহিম উদ্দিন', emoji: '🔐', exp: 2000000000 };
  const token = hsToken({ alg: 'HS256', typ: 'JWT' }, payload, 'secret');
  const d = J.decode('Bearer ' + token + '  ');
  assert.strictEqual(d.ok, true);
  assert.deepStrictEqual(d.header, { alg: 'HS256', typ: 'JWT' });
  assert.deepStrictEqual(d.payload, payload);
  assert.strictEqual(d.alg, 'HS256');
  assert.strictEqual(d.signatureBytes, 32);
  assert.strictEqual(d.unsigned, false);
});

test('reports malformed tokens with specific error codes', () => {
  assert.deepStrictEqual(J.decode('   '), { ok: false, error: 'empty' });
  assert.strictEqual(J.decode('abc.def').error, 'parts');
  assert.strictEqual(J.decode('a.b.c.d').error, 'parts');
  assert.deepStrictEqual(J.decode('%%%.' + enc({}) + '.sig'), { ok: false, error: 'base64', part: 'header' });
  assert.strictEqual(J.decode(b64u('not json') + '.' + enc({}) + '.x').error, 'json');
  assert.strictEqual(J.decode(enc([1, 2]) + '.' + enc({}) + '.x').error, 'notObject');
  const badPayload = J.decode(enc({ alg: 'HS256' }) + '.' + b64u('{"a":') + '.x');
  assert.strictEqual(badPayload.error, 'json');
  assert.strictEqual(badPayload.part, 'payload');
  assert.strictEqual(J.decode(enc({ alg: 'HS256' }) + '.' + b64u(Buffer.from([0xff, 0xfe])) + '.x').error, 'utf8');
});

test('recognises JWE (5 parts) and reads its protected header', () => {
  const jwe = enc({ alg: 'RSA-OAEP', enc: 'A256GCM' }) + '.key.iv.ciphertext.tag';
  const d = J.decode(jwe);
  assert.strictEqual(d.ok, false);
  assert.strictEqual(d.error, 'jwe');
  assert.deepStrictEqual(d.header, { alg: 'RSA-OAEP', enc: 'A256GCM' });
});

test('alg "none" tokens are unsigned and never verify', async () => {
  const d = J.decode(enc({ alg: 'none' }) + '.' + enc({ sub: 'x' }) + '.');
  assert.strictEqual(d.ok, true);
  assert.strictEqual(d.unsigned, true);
  assert.deepStrictEqual(await J.verify(d, 'anything', subtle), { error: 'none' });
  assert.strictEqual(J.keyKind('none'), 'none');
});

test('time status: valid, expired, not yet valid, no exp, bad types', () => {
  const now = 1700000000;
  assert.strictEqual(J.timeStatus({ exp: now + 10, nbf: now - 10 }, now).state, 'valid');
  assert.strictEqual(J.timeStatus({ exp: now }, now).state, 'expired');
  assert.strictEqual(J.timeStatus({ exp: now - 1 }, now).state, 'expired');
  assert.strictEqual(J.timeStatus({ nbf: now + 5 }, now).state, 'notYet');
  assert.strictEqual(J.timeStatus({ sub: 'x' }, now).state, 'noExp');
  assert.strictEqual(J.timeStatus({ exp: '1700000000' }, now).state, 'invalid');
  assert.strictEqual(J.timeStatus({ exp: now - 30 }, now, 60).state, 'valid');
});

test('relative time picks a sensible unit', () => {
  assert.deepStrictEqual(J.relative(7200), { value: 2, unit: 'hour' });
  assert.deepStrictEqual(J.relative(-3 * 86400 - 5), { value: -3, unit: 'day' });
  assert.deepStrictEqual(J.relative(59), { value: 59, unit: 'second' });
  assert.deepStrictEqual(J.relative(-90), { value: -1, unit: 'minute' });
  assert.deepStrictEqual(J.relative(-2 * 365.25 * 86400), { value: -2, unit: 'year' });
});

test('HS256/384/512 verification with a secret (plain and base64)', async () => {
  for (const alg of ['HS256', 'HS384', 'HS512']) {
    const token = hsToken({ alg, typ: 'JWT' }, { sub: '1', n: 'বন্ধু' }, 'my-secret');
    const d = J.decode(token);
    assert.deepStrictEqual(await J.verify(d, 'my-secret', subtle), { valid: true }, alg);
    assert.deepStrictEqual(await J.verify(d, 'wrong', subtle), { valid: false }, alg);
  }
  const raw = nodeCrypto.randomBytes(32);
  const input = enc({ alg: 'HS256' }) + '.' + enc({ a: 1 });
  const token = input + '.' + b64u(nodeCrypto.createHmac('sha256', raw).update(input).digest());
  assert.deepStrictEqual(await J.verify(J.decode(token), raw.toString('base64'), subtle, { secretBase64: true }), { valid: true });
  assert.deepStrictEqual(await J.verify(J.decode(token), '', subtle), { error: 'noKey' });
});

test('tampered payload fails verification', async () => {
  const token = hsToken({ alg: 'HS256' }, { admin: false }, 's');
  const [h, , s] = token.split('.');
  const forged = h + '.' + enc({ admin: true }) + '.' + s;
  assert.deepStrictEqual(await J.verify(J.decode(forged), 's', subtle), { valid: false });
});

async function asymmetric(alg, genParams, signParams) {
  const kp = await subtle.generateKey(genParams, true, ['sign', 'verify']);
  const input = enc({ alg, typ: 'JWT' }) + '.' + enc({ sub: alg, name: 'টেস্ট' });
  const sig = await subtle.sign(signParams, kp.privateKey, Buffer.from(input));
  const spki = Buffer.from(await subtle.exportKey('spki', kp.publicKey)).toString('base64');
  const pem = '-----BEGIN PUBLIC KEY-----\n' + spki.match(/.{1,64}/g).join('\n') + '\n-----END PUBLIC KEY-----\n';
  const jwk = await subtle.exportKey('jwk', kp.publicKey);
  return { token: input + '.' + b64u(sig), pem, jwk };
}

const RSA = (name, hash) => ({ name, hash, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) });
const CASES = [
  ['RS256', RSA('RSASSA-PKCS1-v1_5', 'SHA-256'), { name: 'RSASSA-PKCS1-v1_5' }],
  ['RS512', RSA('RSASSA-PKCS1-v1_5', 'SHA-512'), { name: 'RSASSA-PKCS1-v1_5' }],
  ['PS256', RSA('RSA-PSS', 'SHA-256'), { name: 'RSA-PSS', saltLength: 32 }],
  ['ES256', { name: 'ECDSA', namedCurve: 'P-256' }, { name: 'ECDSA', hash: 'SHA-256' }],
  ['ES384', { name: 'ECDSA', namedCurve: 'P-384' }, { name: 'ECDSA', hash: 'SHA-384' }],
];

for (const [alg, gen, sign] of CASES) {
  test(alg + ' verification with a PEM (SPKI) public key and a JWK', async () => {
    const { token, pem, jwk } = await asymmetric(alg, gen, sign);
    const d = J.decode(token);
    assert.strictEqual(J.keyKind(alg), 'public');
    assert.deepStrictEqual(await J.verify(d, pem, subtle), { valid: true });
    assert.deepStrictEqual(await J.verify(d, JSON.stringify(jwk), subtle), { valid: true });
    const other = await asymmetric(alg, gen, sign);
    assert.deepStrictEqual(await J.verify(d, other.pem, subtle), { valid: false });
  });
}

test('RS256 token signed by node:crypto (independent implementation) verifies', async () => {
  const { publicKey, privateKey } = nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const input = enc({ alg: 'RS256' }) + '.' + enc({ sub: 'node' });
  const sig = nodeCrypto.sign('sha256', Buffer.from(input), privateKey);
  const pem = publicKey.export({ type: 'spki', format: 'pem' });
  assert.deepStrictEqual(await J.verify(J.decode(input + '.' + b64u(sig)), pem, subtle), { valid: true });
  // A DER-encoded ECDSA signature (wrong format for JWS) is reported, not crashed on.
  const ec = nodeCrypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const ein = enc({ alg: 'ES256' }) + '.' + enc({ sub: 'der' });
  const der = nodeCrypto.sign('sha256', Buffer.from(ein), ec.privateKey);
  const r = await J.verify(J.decode(ein + '.' + b64u(der)), ec.publicKey.export({ type: 'spki', format: 'pem' }), subtle);
  assert.deepStrictEqual(r, { error: 'sigFormat' });
});

test('key parsing errors are specific', async () => {
  const d = J.decode(enc({ alg: 'RS256' }) + '.' + enc({}) + '.' + b64u(Buffer.alloc(256)));
  assert.deepStrictEqual(await J.verify(d, '', subtle), { error: 'noKey' });
  assert.deepStrictEqual(await J.verify(d, '-----BEGIN RSA PUBLIC KEY-----\nAAAA\n-----END RSA PUBLIC KEY-----', subtle), { error: 'pkcs1' });
  assert.deepStrictEqual(await J.verify(d, '-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----', subtle), { error: 'privateKey' });
  assert.deepStrictEqual(await J.verify(d, '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----', subtle), { error: 'certificate' });
  assert.deepStrictEqual(await J.verify(d, 'hello world', subtle), { error: 'keyFormat' });
  assert.deepStrictEqual(await J.verify(d, '{"kty":"RSA","n":"x","e":"AQAB","d":"secret"}', subtle), { error: 'privateKey' });
  assert.deepStrictEqual(await J.verify(d, '{"keys":[]}', subtle), { error: 'jwks' });
  const ecPem = nodeCrypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey.export({ type: 'spki', format: 'pem' });
  assert.deepStrictEqual(await J.verify(d, ecPem, subtle), { error: 'badKey' });
  const odd = J.decode(enc({ alg: 'EdDSA' }) + '.' + enc({}) + '.AAAA');
  assert.deepStrictEqual(await J.verify(odd, ecPem, subtle), { error: 'unsupported' });
});

test('sample token is a verifiable, obviously fake demo', async () => {
  const token = await J.sample(1700000000, subtle);
  const d = J.decode(token);
  assert.strictEqual(d.ok, true);
  assert.strictEqual(d.payload.exp - d.payload.iat, 3600);
  assert.match(d.payload.iss, /example\.com/);
  assert.deepStrictEqual(await J.verify(d, J.SAMPLE_SECRET, subtle), { valid: true });
  assert.strictEqual(token, hsToken({ alg: 'HS256', typ: 'JWT' }, J.samplePayload(1700000000), J.SAMPLE_SECRET));
});
