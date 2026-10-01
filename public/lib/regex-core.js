// Regex Tester helpers (JavaScript RegExp engine). Pure functions; unit-tested in tests/regex.test.js.
(function (root) {
  'use strict';

  const MAX_MATCHES = 1000;
  const MAX_INPUT = 50000;
  const MAX_PATTERN = 2000;
  const FLAG_ORDER = 'dgimsuy';

  const PRESETS = [
    { id: 'email', pattern: '[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+', flags: 'g', replace: '<$&>',
      text: 'Write to hello@example.com or support@jsonbondhu.irmaoshop.com.\nNot an address: user@, @host.com' },
    { id: 'phone', pattern: '(?<!\\d)(?:\\+?88)?(01[3-9]\\d{8})(?!\\d)', flags: 'g', replace: '$1',
      text: '01712345678\n+8801812345678\n01212345678 (invalid operator code)\n0171234567 (too short)' },
    { id: 'date', pattern: '\\b(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\\d|3[01])\\b', flags: 'g', replace: '$<day>/$<month>/$<year>',
      text: 'Launched on 2026-03-26, updated 2026-12-01.\nNot a date: 2026-13-45' },
  ];

  function checkFlags(flags) {
    flags = String(flags || '');
    for (let i = 0; i < flags.length; i++) {
      if (FLAG_ORDER.indexOf(flags[i]) < 0) return { ok: false, code: 'flags', message: 'Unsupported flag "' + flags[i] + '"' };
      if (flags.indexOf(flags[i]) !== i) return { ok: false, code: 'flags', message: 'Duplicate flag "' + flags[i] + '"' };
    }
    return { ok: true };
  }

  // Compile with the user's flags. Returns { ok, re } or { ok:false, code, message }.
  function compile(pattern, flags) {
    pattern = String(pattern == null ? '' : pattern);
    const f = checkFlags(flags);
    if (!f.ok) return f;
    if (pattern.length > MAX_PATTERN) return { ok: false, code: 'tooLong', message: 'Pattern is longer than ' + MAX_PATTERN + ' characters' };
    try {
      return { ok: true, re: new RegExp(pattern, String(flags || '')) };
    } catch (e) {
      return { ok: false, code: 'syntax', message: String((e && e.message) || e).replace(/^Invalid regular expression: /, '') };
    }
  }

  // Heuristic only: a group that contains a quantifier and is itself quantified, e.g. (a+)+ or (\w*)*.
  // These are the classic catastrophic-backtracking shapes. The engine cannot be interrupted, so we warn.
  function looksRisky(pattern) {
    return /\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)(?:[+*]|\{\d+,\d*\})/.test(String(pattern));
  }

  function toMatch(m) {
    const o = { index: m.index, end: m.index + m[0].length, text: m[0], groups: Array.prototype.slice.call(m, 1), named: null };
    if (m.groups) o.named = Object.assign({}, m.groups);
    if (m.indices) o.spans = Array.prototype.map.call(m.indices, (p) => (p ? [p[0], p[1]] : null));
    return o;
  }

  // Find matches. Without the g flag only the first match is returned (like String.prototype.match).
  function run(pattern, flags, text, opts) {
    const maxMatches = (opts && opts.maxMatches) || MAX_MATCHES;
    const maxInput = (opts && opts.maxInput) || MAX_INPUT;
    const c = compile(pattern, flags);
    if (!c.ok) return c;
    const re = c.re;
    let s = String(text == null ? '' : text);
    const inputTruncated = s.length > maxInput;
    if (inputTruncated) s = s.slice(0, maxInput);
    const matches = [];
    let truncated = false;
    const global = re.global;
    re.lastIndex = 0;
    for (;;) {
      const m = re.exec(s);
      if (!m) break;
      if (matches.length >= maxMatches) { truncated = true; break; }
      matches.push(toMatch(m));
      if (!global) break;
      if (m[0] === '') {
        // Zero-length match: step forward (a whole code point under the u flag) to avoid looping forever.
        let step = 1;
        if (re.unicode) {
          const cp = s.codePointAt(re.lastIndex);
          if (cp !== undefined && cp > 0xffff) step = 2;
        }
        re.lastIndex += step;
        if (re.lastIndex > s.length) break;
      }
    }
    return { ok: true, matches, truncated, inputTruncated, risky: looksRisky(pattern), text: s };
  }

  // Replace using JavaScript replacement syntax ($1, $<name>, $&, $`, $', $$).
  function replace(pattern, flags, text, replacement, opts) {
    const r = run(pattern, flags, text, opts);
    if (!r.ok) return r;
    const c = compile(pattern, flags);
    let result;
    try {
      result = r.text.replace(c.re, String(replacement == null ? '' : replacement));
    } catch (e) {
      return { ok: false, code: 'syntax', message: String((e && e.message) || e) };
    }
    return { ok: true, result, count: r.matches.length, truncated: r.truncated, inputTruncated: r.inputTruncated };
  }

  // Split text into plain and matched pieces for highlighting.
  // Zero-length matches become { text: '', match: n, empty: true } so the UI can draw a marker.
  function segments(text, matches) {
    const out = [];
    let pos = 0;
    matches.forEach((m, i) => {
      if (m.index > pos) out.push({ text: text.slice(pos, m.index), match: -1 });
      if (m.end > m.index) out.push({ text: text.slice(m.index, m.end), match: i });
      else out.push({ text: '', match: i, empty: true });
      pos = Math.max(pos, m.end);
    });
    if (pos < text.length) out.push({ text: text.slice(pos), match: -1 });
    return out;
  }

  const api = { MAX_MATCHES, MAX_INPUT, MAX_PATTERN, PRESETS, checkFlags, compile, looksRisky, run, replace, segments };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JBREGEX = api;
})(typeof self !== 'undefined' ? self : this);
