// JSON Web Token helpers (RFC 7519 / RFC 7515). Pure logic; unit-tested in tests/jwt.test.js.
// Signature verification uses the Web Crypto API (`subtle` is passed in, so the same
// code runs in the browser and in Node). Nothing here touches the network.
(function (root) {
  'use strict';

  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const B64_INDEX = (() => {
    const m = new Int16Array(128).fill(-1);
    for (let i = 0; i < 64; i++) m[B64.charCodeAt(i)] = i;
    m['+'.charCodeAt(0)] = 62; // tolerate standard base64 too
    m['/'.charCodeAt(0)] = 63;
    return m;
  })();

  // base64url (or standard base64, padded or not) -> Uint8Array. Throws on bad input.
  function b64urlDecode(str) {
    const s = String(str).replace(/=+$/, '');
    if (s.length % 4 === 1) throw new Error('base64');
    const out = new Uint8Array(Math.floor((s.length * 3) / 4));
    let bits = 0, acc = 0, o = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      const v = c < 128 ? B64_INDEX[c] : -1;
      if (v < 0) throw new Error('base64');
      acc = (acc << 6) | v;
      bits += 6;
      if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 0xff; }
    }
    return out;
  }

  function b64urlEncode(bytes) {
    let s = '';
    let i = 0;
    for (; i + 2 < bytes.length; i += 3) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      s += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    }
    if (i < bytes.length) {
      const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8);
      s += B64[n >> 18] + B64[(n >> 12) & 63];
      if (i + 1 < bytes.length) s += B64[(n >> 6) & 63];
    }
    return s;
  }

  const utf8 = (s) => new TextEncoder().encode(s);
  const b64urlJSON = (obj) => b64urlEncode(utf8(JSON.stringify(obj)));

  // Strip whitespace, surrounding quotes and an "Authorization: Bearer " prefix.
  function normalize(input) {
    let s = String(input == null ? '' : input).trim();
    s = s.replace(/^authorization\s*:\s*/i, '').replace(/^bearer\s+/i, '');
    s = s.replace(/^["'`]+|["'`]+$/g, '');
    return s.replace(/\s+/g, '');
  }

  function decodeJSONPart(part, which) {
    let bytes;
    try { bytes = b64urlDecode(part); } catch (e) { return { error: 'base64', part: which }; }
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) { return { error: 'utf8', part: which }; }
    let value;
    try { value = JSON.parse(text); } catch (e) { return { error: 'json', part: which }; }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'notObject', part: which };
    return { value, text };
  }

  // Returns { ok: true, header, payload, signature, signingInput, alg, unsigned }
  // or { ok: false, error, part?, header? } where error is one of:
  // empty | parts | jwe | base64 | utf8 | json | notObject
  function decode(input) {
    const token = normalize(input);
    if (!token) return { ok: false, error: 'empty' };
    const parts = token.split('.');
    if (parts.length === 5) {
      // JWE: the protected header is readable, the payload is encrypted.
      const h = decodeJSONPart(parts[0], 'header');
      return { ok: false, error: 'jwe', header: h.value || null };
    }
    if (parts.length !== 3) return { ok: false, error: 'parts', count: parts.length };
    const h = decodeJSONPart(parts[0], 'header');
    if (h.error) return { ok: false, error: h.error, part: 'header' };
    const p = decodeJSONPart(parts[1], 'payload');
    if (p.error) return { ok: false, error: p.error, part: 'payload', header: h.value };
    try { b64urlDecode(parts[2]); } catch (e) { return { ok: false, error: 'base64', part: 'signature' }; }
    const alg = typeof h.value.alg === 'string' ? h.value.alg : '';
    return {
      ok: true,
      token,
      header: h.value,
      payload: p.value,
      signature: parts[2],
      signatureBytes: b64urlDecode(parts[2]).length,
      signingInput: parts[0] + '.' + parts[1],
      alg,
      unsigned: alg.toLowerCase() === 'none',
    };
  }

  const REGISTERED = ['iss', 'sub', 'aud', 'exp', 'nbf', 'iat', 'jti'];
  const TIME_CLAIMS = ['exp', 'nbf', 'iat'];
  const isNumericDate = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 8.64e12;

  // Where does "now" fall relative to nbf/exp?  -> { state, exp?, nbf? }
  // state: valid | expired | notYet | noExp (no time limits) | invalid (exp/nbf not a number)
  function timeStatus(payload, nowSec, leewaySec) {
    const leeway = leewaySec || 0;
    const has = (k) => Object.prototype.hasOwnProperty.call(payload || {}, k);
    if ((has('exp') && !isNumericDate(payload.exp)) || (has('nbf') && !isNumericDate(payload.nbf))) return { state: 'invalid' };
    if (has('exp') && nowSec >= payload.exp + leeway) return { state: 'expired', exp: payload.exp };
    if (has('nbf') && nowSec < payload.nbf - leeway) return { state: 'notYet', nbf: payload.nbf };
    if (!has('exp') && !has('nbf')) return { state: 'noExp' };
    return { state: 'valid', exp: payload.exp, nbf: payload.nbf };
  }

  // Signed difference -> { value, unit } for Intl.RelativeTimeFormat (value < 0 = past).
  function relative(diffSec) {
    const a = Math.abs(diffSec);
    const sign = diffSec < 0 ? -1 : 1;
    const pick = (value, unit) => ({ value: sign * Math.trunc(value), unit });
    if (a < 60) return pick(a, 'second');
    if (a < 3600) return pick(a / 60, 'minute');
    if (a < 86400) return pick(a / 3600, 'hour');
    if (a < 86400 * 30) return pick(a / 86400, 'day');
    if (a < 86400 * 365) return pick(a / (86400 * 30.44), 'month');
    return pick(a / (86400 * 365.25), 'year');
  }

  // ---------- Signature verification (Web Crypto) ----------
  const SHA = { 256: 'SHA-256', 384: 'SHA-384', 512: 'SHA-512' };
  function algSpec(alg) {
    const m = /^(HS|RS|PS|ES)(256|384|512)$/.exec(alg || '');
    if (!m) return null;
    const hash = SHA[m[2]];
    const bits = Number(m[2]);
    switch (m[1]) {
      case 'HS': return { kind: 'secret', import: { name: 'HMAC', hash }, verify: { name: 'HMAC' } };
      case 'RS': return { kind: 'public', import: { name: 'RSASSA-PKCS1-v1_5', hash }, verify: { name: 'RSASSA-PKCS1-v1_5' } };
      case 'PS': return { kind: 'public', import: { name: 'RSA-PSS', hash }, verify: { name: 'RSA-PSS', saltLength: bits / 8 } };
      case 'ES': {
        const curve = { 256: 'P-256', 384: 'P-384', 512: 'P-521' }[bits];
        const sigLen = { 256: 64, 384: 96, 512: 132 }[bits];
        return { kind: 'public', import: { name: 'ECDSA', namedCurve: curve }, verify: { name: 'ECDSA', hash }, sigLen };
      }
    }
    return null;
  }
  const SUPPORTED = ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512'];

  // What kind of key does this alg need?  'secret' | 'public' | 'none' | 'unsupported'
  function keyKind(alg) {
    if (String(alg).toLowerCase() === 'none') return 'none';
    const s = algSpec(alg);
    return s ? s.kind : 'unsupported';
  }

  // Parses a PEM (SPKI "PUBLIC KEY"), bare base64 DER, or a public JWK (JSON).
  // -> { format: 'spki', der } | { format: 'jwk', jwk } | { error }
  function parsePublicKey(text) {
    const s = String(text || '').trim();
    if (!s) return { error: 'noKey' };
    if (s[0] === '{') {
      let jwk;
      try { jwk = JSON.parse(s); } catch (e) { return { error: 'keyFormat' }; }
      if (!jwk || typeof jwk !== 'object') return { error: 'keyFormat' };
      if (Array.isArray(jwk.keys)) return { error: 'jwks' };
      if (jwk.d !== undefined || jwk.p !== undefined) return { error: 'privateKey' };
      const pub = {};
      for (const k of ['kty', 'n', 'e', 'crv', 'x', 'y']) if (jwk[k] !== undefined) pub[k] = jwk[k];
      return { format: 'jwk', jwk: pub };
    }
    const m = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/.exec(s);
    let body;
    if (m) {
      const label = m[1];
      if (/PRIVATE KEY/.test(label)) return { error: 'privateKey' };
      if (label === 'RSA PUBLIC KEY') return { error: 'pkcs1' };
      if (label === 'CERTIFICATE') return { error: 'certificate' };
      if (label !== 'PUBLIC KEY') return { error: 'keyFormat' };
      body = m[2];
    } else if (/-----BEGIN/.test(s)) {
      return { error: 'keyFormat' };
    } else {
      body = s;
    }
    try {
      const der = b64urlDecode(body.replace(/\s+/g, ''));
      if (der.length < 32) return { error: 'keyFormat' };
      return { format: 'spki', der };
    } catch (e) {
      return { error: 'keyFormat' };
    }
  }

  // Verifies decoded.signingInput against decoded.signature using the token's own alg.
  // key: the HMAC secret (string) or the public key text.  opts.secretBase64: decode the secret first.
  // -> { valid: boolean } | { error: none | unsupported | noKey | keyFormat | pkcs1 | certificate | privateKey | jwks | badKey | sigFormat | noCrypto }
  async function verify(decoded, key, subtle, opts) {
    const o = opts || {};
    const alg = decoded.alg;
    if (decoded.unsigned) return { error: 'none' };
    const spec = algSpec(alg);
    if (!spec) return { error: 'unsupported' };
    if (!subtle) return { error: 'noCrypto' };
    const data = utf8(decoded.signingInput);
    const sig = b64urlDecode(decoded.signature);
    let cryptoKey;
    if (spec.kind === 'secret') {
      if (key == null || key === '') return { error: 'noKey' };
      let raw;
      if (o.secretBase64) {
        try { raw = b64urlDecode(String(key).trim()); } catch (e) { return { error: 'keyFormat' }; }
        if (!raw.length) return { error: 'noKey' };
      } else {
        raw = utf8(String(key));
      }
      try {
        cryptoKey = await subtle.importKey('raw', raw, spec.import, false, ['verify']);
      } catch (e) { return { error: 'badKey' }; }
    } else {
      const parsed = parsePublicKey(key);
      if (parsed.error) return { error: parsed.error };
      try {
        cryptoKey = parsed.format === 'jwk'
          ? await subtle.importKey('jwk', parsed.jwk, spec.import, false, ['verify'])
          : await subtle.importKey('spki', parsed.der, spec.import, false, ['verify']);
      } catch (e) { return { error: 'badKey' }; }
      if (spec.sigLen && sig.length !== spec.sigLen) return { error: 'sigFormat' };
    }
    try {
      return { valid: await subtle.verify(spec.verify, cryptoKey, sig, data) };
    } catch (e) {
      return { error: 'badKey' };
    }
  }

  // Builds an HMAC-signed token (used for the demo sample and in tests).
  async function signHS(header, payload, secret, subtle) {
    const spec = algSpec(header.alg);
    if (!spec || spec.kind !== 'secret') throw new Error('HS* only');
    const input = b64urlJSON(header) + '.' + b64urlJSON(payload);
    const k = await subtle.importKey('raw', utf8(secret), spec.import, false, ['sign']);
    const sig = new Uint8Array(await subtle.sign('HMAC', k, utf8(input)));
    return input + '.' + b64urlEncode(sig);
  }

  const SAMPLE_SECRET = 'demo-secret-jsonbondhu-not-real';
  // An obviously fake demo token valid for one hour from nowSec.
  function samplePayload(nowSec) {
    return {
      iss: 'https://auth.example.com',
      sub: 'demo-user-0001',
      aud: 'jsonbondhu-demo',
      iat: nowSec,
      nbf: nowSec,
      exp: nowSec + 3600,
      jti: 'demo-' + nowSec.toString(36),
      name: 'রহিম উদ্দিন (Demo User)',
      role: 'example-only',
      note: 'This is a fake token for testing — এটি একটি নমুনা টোকেন',
    };
  }
  function sample(nowSec, subtle) {
    return signHS({ alg: 'HS256', typ: 'JWT' }, samplePayload(nowSec), SAMPLE_SECRET, subtle);
  }

  const api = {
    b64urlDecode, b64urlEncode, b64urlJSON, normalize, decode, timeStatus, relative,
    REGISTERED, TIME_CLAIMS, isNumericDate, keyKind, parsePublicKey, verify, signHS,
    sample, samplePayload, SAMPLE_SECRET, SUPPORTED,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JBJWT = api;
})(typeof self !== 'undefined' ? self : this);
