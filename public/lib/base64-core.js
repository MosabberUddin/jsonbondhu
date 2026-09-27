// Base64 helpers (RFC 4648, standard and URL-safe alphabets). Pure functions that
// work on bytes; unit-tested in tests/base64.test.js.
(function (root) {
  'use strict';

  const STD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const URL_SAFE = STD.slice(0, 62) + '-_';
  // Decoding accepts both alphabets, so "+/" and "-_" input both work.
  const LOOKUP = new Int16Array(128).fill(-1);
  for (let i = 0; i < 64; i++) {
    LOOKUP[STD.charCodeAt(i)] = i;
    LOOKUP[URL_SAFE.charCodeAt(i)] = i;
  }

  function utf8Encode(str) {
    return new TextEncoder().encode(str);
  }

  // Returns the text, or null when the bytes are not valid UTF-8.
  function utf8Decode(bytes) {
    try {
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch (e) {
      return null;
    }
  }

  function encodeBytes(bytes, opts) {
    const o = opts || {};
    const abc = o.urlSafe ? URL_SAFE : STD;
    const pad = o.pad !== false;
    const parts = [];
    let s = '';
    const n = bytes.length;
    let i = 0;
    for (; i + 2 < n; i += 3) {
      const v = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      s += abc[v >> 18] + abc[(v >> 12) & 63] + abc[(v >> 6) & 63] + abc[v & 63];
      if (s.length >= 8192) { parts.push(s); s = ''; }
    }
    if (n - i === 1) {
      const v = bytes[i] << 16;
      s += abc[v >> 18] + abc[(v >> 12) & 63] + (pad ? '==' : '');
    } else if (n - i === 2) {
      const v = (bytes[i] << 16) | (bytes[i + 1] << 8);
      s += abc[v >> 18] + abc[(v >> 12) & 63] + abc[(v >> 6) & 63] + (pad ? '=' : '');
    }
    parts.push(s);
    return parts.join('');
  }

  // Error codes: 'char' (with index + char), 'padding', 'length'.
  function B64Error(code, extra) {
    const e = new Error('Invalid Base64: ' + code);
    e.code = code;
    Object.assign(e, extra || {});
    return e;
  }

  // Decodes standard or URL-safe Base64, with or without padding. Whitespace
  // (line breaks from MIME/PEM wrapping) is ignored. Throws B64Error.
  function decodeToBytes(input) {
    const str = String(input);
    const vals = [];
    let padAt = -1;
    let padCount = 0;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      if (c === 32 || c === 9 || c === 10 || c === 13 || c === 12) continue;
      if (c === 61) { // '='
        if (padAt < 0) padAt = vals.length;
        padCount++;
        if (padCount > 2) throw B64Error('padding', { index: i });
        continue;
      }
      const v = c < 128 ? LOOKUP[c] : -1;
      if (v < 0 || padAt >= 0) {
        if (v >= 0) throw B64Error('padding', { index: i });
        throw B64Error('char', { index: i, char: String.fromCodePoint(str.codePointAt(i)) });
      }
      vals.push(v);
    }
    const rem = vals.length % 4;
    if (rem === 1) throw B64Error('length');
    if (padCount && (rem === 0 || (rem === 2 && padCount !== 2) || (rem === 3 && padCount !== 1))) {
      throw B64Error('padding', { index: str.lastIndexOf('=') });
    }
    const out = new Uint8Array(Math.floor(vals.length * 3 / 4));
    let o = 0;
    let i = 0;
    for (; i + 3 < vals.length; i += 4) {
      const v = (vals[i] << 18) | (vals[i + 1] << 12) | (vals[i + 2] << 6) | vals[i + 3];
      out[o++] = v >> 16; out[o++] = (v >> 8) & 255; out[o++] = v & 255;
    }
    if (rem === 2) {
      out[o++] = ((vals[i] << 18) | (vals[i + 1] << 12)) >> 16;
    } else if (rem === 3) {
      const v = (vals[i] << 18) | (vals[i + 1] << 12) | (vals[i + 2] << 6);
      out[o++] = v >> 16; out[o++] = (v >> 8) & 255;
    }
    return out;
  }

  function encodeText(text, opts) {
    return encodeBytes(utf8Encode(text), opts);
  }

  // Parses "data:[<mime>][;params][;base64],<data>". Returns null if not a data URI.
  function parseDataUri(str) {
    const m = /^\s*data:([^,]*?),/i.exec(String(str));
    if (!m) return null;
    const meta = m[1].split(';').map((s) => s.trim());
    const isBase64 = meta.length > 1 && meta[meta.length - 1].toLowerCase() === 'base64';
    const mime = (meta[0] || 'text/plain').toLowerCase();
    return { mime, base64: isBase64, data: String(str).slice(m[0].length).trim() };
  }

  // Recognizes common image formats from their magic bytes.
  function sniffMime(b) {
    if (!b || b.length < 4) return null;
    const at = (i, arr) => arr.every((v, k) => b[i + k] === v);
    if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
    if (at(0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
    if (at(0, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
    if (b.length >= 12 && at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp';
    if (at(0, [0x25, 0x50, 0x44, 0x46])) return 'application/pdf';
    if (at(0, [0x50, 0x4b, 0x03, 0x04])) return 'application/zip';
    return null;
  }

  // Decodes Base64 or a data URI. Result:
  // { bytes, text (string | null if binary), mime (declared or sniffed, may be null) }
  function decode(input) {
    const uri = parseDataUri(input);
    let bytes;
    let mime = null;
    if (uri) {
      mime = uri.mime;
      if (uri.base64) {
        bytes = decodeToBytes(uri.data);
      } else {
        let raw;
        try { raw = decodeURIComponent(uri.data); } catch (e) { raw = uri.data; }
        bytes = utf8Encode(raw);
      }
    } else {
      bytes = decodeToBytes(input);
    }
    const sniffed = sniffMime(bytes);
    if (sniffed && (!mime || mime === 'text/plain' || mime === 'application/octet-stream')) mime = sniffed;
    const text = sniffed ? null : utf8Decode(bytes);
    return { bytes, text: text !== null && looksLikeText(text) ? text : null, mime };
  }

  // Valid UTF-8 can still be binary; treat lots of control characters as binary.
  function looksLikeText(s) {
    if (!s) return true;
    let ctrl = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if ((c < 32 && c !== 9 && c !== 10 && c !== 13 && c !== 12) || c === 0x7f) ctrl++;
    }
    return ctrl === 0 || ctrl / s.length < 0.02;
  }

  function toDataUri(bytes, mime, opts) {
    return 'data:' + (mime || 'application/octet-stream') + ';base64,' + encodeBytes(bytes, opts);
  }

  const EXT = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg',
    'application/pdf': 'pdf', 'application/zip': 'zip', 'application/json': 'json', 'text/plain': 'txt',
    'text/html': 'html', 'text/css': 'css', 'text/csv': 'csv',
  };
  function extFor(mime, isText) {
    return EXT[mime] || (isText ? 'txt' : 'bin');
  }

  const api = { encodeBytes, encodeText, decodeToBytes, decode, utf8Encode, utf8Decode, parseDataUri, sniffMime, toDataUri, extFor, looksLikeText };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JBBASE64 = api;
})(typeof self !== 'undefined' ? self : this);
