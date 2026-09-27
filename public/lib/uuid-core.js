// UUID helpers (RFC 9562). Pure functions; unit-tested in tests/uuid.test.js.
(function (root) {
  'use strict';

  const HEX = '0123456789abcdef';

  function toHex(bytes) {
    let s = '';
    for (const b of bytes) s += HEX[b >> 4] + HEX[b & 15];
    return s.slice(0, 8) + '-' + s.slice(8, 12) + '-' + s.slice(12, 16) + '-' + s.slice(16, 20) + '-' + s.slice(20);
  }

  // Version 4: 122 random bits. `random16` returns 16 random bytes (injectable for tests).
  function v4(random16) {
    const b = random16();
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    return toHex(b);
  }

  // Version 7: 48-bit Unix milliseconds, then random bits; sorts by creation time.
  function v7(nowMs, random16) {
    const b = random16();
    let ms = Math.floor(nowMs);
    for (let i = 5; i >= 0; i--) { b[i] = ms % 256; ms = Math.floor(ms / 256); }
    b[6] = (b[6] & 0x0f) | 0x70;
    b[8] = (b[8] & 0x3f) | 0x80;
    return toHex(b);
  }

  const UUID_RE = /^[{(]?([0-9a-f]{8})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{12})[})]?$/i;

  // Returns { valid, canonical, version, variant, timestampMs? } for any common spelling
  // (with or without hyphens/braces, upper or lower case, optional "urn:uuid:").
  function inspect(input) {
    const s = String(input || '').trim().replace(/^urn:uuid:/i, '');
    const m = s.match(UUID_RE);
    if (!m) return { valid: false };
    const hex = m.slice(1).join('').toLowerCase();
    const canonical = hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
    if (/^0{32}$/.test(hex)) return { valid: true, canonical, version: 0, variant: 'nil' };
    if (/^f{32}$/.test(hex)) return { valid: true, canonical, version: 15, variant: 'max' };
    const version = parseInt(hex[12], 16);
    const v = parseInt(hex[16], 16);
    const variant = v < 8 ? 'ncs' : v < 12 ? 'rfc' : v < 14 ? 'microsoft' : 'future';
    const out = { valid: true, canonical, version, variant };
    if (version === 7) out.timestampMs = parseInt(hex.slice(0, 12), 16);
    if (version === 1) {
      // 60-bit count of 100ns intervals since 1582-10-15.
      const ts = BigInt('0x' + hex.slice(13, 16) + hex.slice(8, 12) + hex.slice(0, 8));
      out.timestampMs = Number((ts - 122192928000000000n) / 10000n);
    }
    return out;
  }

  function format(uuid, { uppercase = false, hyphens = true, braces = false } = {}) {
    let s = hyphens ? uuid : uuid.replace(/-/g, '');
    if (uppercase) s = s.toUpperCase();
    return braces ? '{' + s + '}' : s;
  }

  const api = { v4, v7, inspect, format };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JBUUID = api;
})(typeof self !== 'undefined' ? self : this);
