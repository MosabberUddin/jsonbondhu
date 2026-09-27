// URL percent-encoding helpers and a URL parser. Pure functions; unit-tested in
// tests/url.test.js. Uses only the standard URL / URLSearchParams APIs.
(function (root) {
  'use strict';

  function UrlError(code, extra) {
    const e = new Error('URL ' + code);
    e.code = code;
    Object.assign(e, extra || {});
    return e;
  }

  // mode: 'component' (encodeURIComponent) | 'uri' (encodeURI).
  // opts.plus: form encoding — spaces become "+" (and a literal "+" becomes %2B).
  function encode(str, mode, opts) {
    const fn = mode === 'uri' ? encodeURI : encodeURIComponent;
    let out;
    try {
      out = fn(String(str));
    } catch (e) {
      // Only thrown for lone UTF-16 surrogates.
      throw UrlError('surrogate');
    }
    if (opts && opts.plus) out = out.replace(/\+/g, '%2B').replace(/%20/g, '+');
    return out;
  }

  // Length (1–4) of the valid UTF-8 escape sequence starting at bytes[i], or 0.
  function validSeqLength(bytes, i, fn) {
    for (let len = 1; len <= 4 && i + len <= bytes.length; len++) {
      try { fn(bytes.slice(i, i + len).join('')); return len; } catch (e) { /* need more bytes */ }
    }
    return 0;
  }

  // Finds the first malformed escape: "%" not followed by two hex digits, or a
  // run of %XX bytes that is not valid UTF-8. Returns { index, seq } or null.
  function findMalformed(str) {
    const re = /%(?![0-9A-Fa-f]{2})|(?:%[0-9A-Fa-f]{2})+/g;
    let m;
    while ((m = re.exec(str))) {
      if (m[0] === '%') return { index: m.index, seq: str.slice(m.index, m.index + 3) };
      try {
        decodeURIComponent(m[0]);
      } catch (e) {
        // Narrow down to the first byte that does not start a valid UTF-8 sequence.
        const bytes = m[0].match(/%[0-9A-Fa-f]{2}/g);
        let i = 0;
        while (i < bytes.length) {
          const len = validSeqLength(bytes, i, decodeURIComponent);
          if (!len) return { index: m.index + i * 3, seq: bytes[i] };
          i += len;
        }
        return { index: m.index, seq: bytes[0] };
      }
    }
    return null;
  }

  // mode 'uri' keeps reserved characters (like %2F, %3F, %26) encoded, as decodeURI does.
  // opts.plus: treat "+" as a space (application/x-www-form-urlencoded).
  // Throws UrlError('malformed', { index, seq }) on bad input.
  function decode(str, mode, opts) {
    let s = String(str);
    if (opts && opts.plus) s = s.replace(/\+/g, ' ');
    const fn = mode === 'uri' ? decodeURI : decodeURIComponent;
    try {
      return fn(s);
    } catch (e) {
      throw UrlError('malformed', findMalformed(s) || { index: 0, seq: '' });
    }
  }

  // Best-effort decode: decodes every valid escape and leaves broken ones as-is.
  function decodeLenient(str, mode, opts) {
    let s = String(str);
    if (opts && opts.plus) s = s.replace(/\+/g, ' ');
    const fn = mode === 'uri' ? decodeURI : decodeURIComponent;
    return s.replace(/(?:%[0-9A-Fa-f]{2})+/g, (run) => {
      try { return fn(run); } catch (e) {
        // Decode byte by byte groups that are valid; keep the rest.
        const bytes = run.match(/%[0-9A-Fa-f]{2}/g);
        let out = '';
        let i = 0;
        while (i < bytes.length) {
          const len = validSeqLength(bytes, i, fn);
          if (len) { out += fn(bytes.slice(i, i + len).join('')); i += len; } else { out += bytes[i]; i++; }
        }
        return out;
      }
    });
  }

  function safeDecode(s) {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  const DEFAULT_PORTS = { 'http:': '80', 'https:': '443', 'ws:': '80', 'wss:': '443', 'ftp:': '21' };

  // Splits a URL into parts. Input without a scheme ("example.com/a?b=1") is
  // read as https://. Returns null if it cannot be parsed.
  function parse(input) {
    const raw = String(input).trim();
    if (!raw) return null;
    let u = null;
    let assumed = false;
    try { u = new URL(raw); } catch (e) { /* try with a scheme */ }
    // "example.com:8080/x" parses with the scheme "example.com:", so retry those too.
    const hostLikeScheme = u && !u.host && /[.]|^localhost:$/i.test(u.protocol);
    if ((!u || hostLikeScheme) && !/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && /^(?:[^\s/?#:]+\.[^\s/?#]+|localhost(?:[:/?#]|$))/i.test(raw)) {
      try { u = new URL('https://' + raw); assumed = true; } catch (e) { u = null; }
    }
    if (!u) return null;
    const params = [];
    const counts = new Map();
    for (const [key, value] of u.searchParams) {
      const n = (counts.get(key) || 0) + 1;
      counts.set(key, n);
      params.push({ key, value, occurrence: n });
    }
    for (const p of params) p.total = counts.get(p.key);
    return {
      href: u.href,
      assumedScheme: assumed,
      protocol: u.protocol,
      username: safeDecode(u.username),
      password: u.password ? '•'.repeat(Math.min(8, u.password.length)) : '',
      hostname: u.hostname,
      port: u.port,
      defaultPort: u.port ? '' : (DEFAULT_PORTS[u.protocol] || ''),
      origin: u.origin,
      pathname: safeDecode(u.pathname),
      search: u.search,
      hash: safeDecode(u.hash.replace(/^#/, '')),
      params,
      repeatedKeys: [...counts].filter(([, n]) => n > 1).map(([k]) => k),
    };
  }

  const api = { encode, decode, decodeLenient, findMalformed, parse };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JBURL = api;
})(typeof self !== 'undefined' ? self : this);
