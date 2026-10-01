// Hash helpers: MD5 (pure JS, RFC 1321), SHA family via an injected SubtleCrypto, HMAC, encoders, compare.
// Pure and unit-tested in tests/hash.test.js.
(function (root) {
  'use strict';

  const ALGOS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
  const BLOCK = { 'MD5': 64, 'SHA-1': 64, 'SHA-256': 64, 'SHA-384': 128, 'SHA-512': 128 };

  function utf8(str) {
    return new TextEncoder().encode(String(str));
  }

  // ---- MD5 (RFC 1321) ----
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;

  function md5(bytes) {
    const len = bytes.length;
    const total = (((len + 8) >>> 6) + 1) << 6;
    const buf = new Uint8Array(total);
    buf.set(bytes);
    buf[len] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 8, (len << 3) >>> 0, true);
    dv.setUint32(total - 4, Math.floor(len / 536870912) >>> 0, true);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    const M = new Uint32Array(16);
    for (let off = 0; off < total; off += 64) {
      for (let j = 0; j < 16; j++) M[j] = dv.getUint32(off + j * 4, true);
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) & 15; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) & 15; }
        else { F = C ^ (B | ~D); g = (7 * i) & 15; }
        F = (F + A + K[i] + M[g]) | 0;
        A = D; D = C; C = B;
        const s = S[((i >> 4) << 2) | (i & 3)];
        B = (B + ((F << s) | (F >>> (32 - s)))) | 0;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    const out = new Uint8Array(16);
    const odv = new DataView(out.buffer);
    odv.setUint32(0, a0 >>> 0, true); odv.setUint32(4, b0 >>> 0, true);
    odv.setUint32(8, c0 >>> 0, true); odv.setUint32(12, d0 >>> 0, true);
    return out;
  }

  function concat(a, b) {
    const o = new Uint8Array(a.length + b.length);
    o.set(a); o.set(b, a.length);
    return o;
  }

  function assertAlgo(algo) {
    if (!ALGOS.includes(algo)) throw new Error('Unsupported algorithm: ' + algo);
  }

  // Digest of bytes (Uint8Array). MD5 is local; SHA-* use the injected SubtleCrypto.
  async function digest(algo, bytes, subtle) {
    assertAlgo(algo);
    if (algo === 'MD5') return md5(bytes);
    return new Uint8Array(await subtle.digest(algo, bytes));
  }

  // HMAC (RFC 2104) built on digest(), so an empty key works everywhere
  // (some browsers refuse a zero-length key in subtle.importKey).
  async function hmac(algo, key, bytes, subtle) {
    assertAlgo(algo);
    const block = BLOCK[algo];
    let k = key;
    if (k.length > block) k = await digest(algo, k, subtle);
    const ipad = new Uint8Array(block).fill(0x36);
    const opad = new Uint8Array(block).fill(0x5c);
    for (let i = 0; i < k.length; i++) { ipad[i] ^= k[i]; opad[i] ^= k[i]; }
    const inner = await digest(algo, concat(ipad, bytes), subtle);
    return digest(algo, concat(opad, inner), subtle);
  }

  // Compute every algorithm. opts: { key?: Uint8Array } (HMAC when key is given).
  async function hashAll(bytes, subtle, opts) {
    const key = opts && opts.key;
    const out = {};
    for (const a of ALGOS) out[a] = key ? await hmac(a, key, bytes, subtle) : await digest(a, bytes, subtle);
    return out;
  }

  function toHex(bytes, upper) {
    let s = '';
    for (const b of bytes) s += (b < 16 ? '0' : '') + b.toString(16);
    return upper ? s.toUpperCase() : s;
  }

  function toBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function format(bytes, encoding) {
    if (encoding === 'base64') return toBase64(bytes);
    return toHex(bytes, encoding === 'hex-upper');
  }

  // Compare without early exit on the first differing character (length is not secret here).
  function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  // Does `input` (hex in any case, or Base64) match one of the computed digests?
  // Returns { match, algo?, encoding? }.
  function compare(input, results) {
    const raw = String(input || '').trim();
    if (!raw) return { match: false, empty: true };
    const hex = raw.replace(/[\s:]/g, '');
    for (const a of ALGOS) {
      const bytes = results[a];
      if (!bytes) continue;
      if (/^[0-9a-f]+$/i.test(hex) && timingSafeEqual(hex.toLowerCase(), toHex(bytes))) return { match: true, algo: a, encoding: 'hex' };
      if (timingSafeEqual(raw, toBase64(bytes))) return { match: true, algo: a, encoding: 'base64' };
    }
    return { match: false };
  }

  const api = { ALGOS, utf8, md5, digest, hmac, hashAll, toHex, toBase64, format, timingSafeEqual, compare };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JBHASH = api;
})(typeof self !== 'undefined' ? self : this);
