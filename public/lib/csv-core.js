// CSV <-> JSON helpers. Pure functions (no DOM); unit-tested in tests/csv.test.js.
// JSON -> CSV flattening matches public/convert.js (JB.toCsv) so both tools agree.
(function (root) {
  'use strict';

  const DELIMITERS = [',', ';', '\t', '|'];

  function stripBom(s) {
    return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
  }

  function isContainer(v) {
    return v !== null && typeof v === 'object';
  }

  // Assign without ever touching Object.prototype (a CSV header may be "__proto__").
  function setKey(obj, k, v) {
    if (k === '__proto__') Object.defineProperty(obj, k, { value: v, enumerable: true, writable: true, configurable: true });
    else obj[k] = v;
  }
  function hasOwn(obj, k) {
    return Object.prototype.hasOwnProperty.call(obj, k);
  }

  // ---------- Delimiter detection ----------
  // Counts each candidate outside quotes on the first lines and prefers the one
  // that appears the same number of times on every line.
  function detectDelimiter(text, maxLines) {
    text = stripBom(String(text || ''));
    maxLines = maxLines || 20;
    const counts = DELIMITERS.map(() => []);
    let cur = DELIMITERS.map(() => 0);
    let inQ = false, lines = 0, any = false;
    const n = Math.min(text.length, 200000);
    for (let i = 0; i < n && lines < maxLines; i++) {
      const c = text[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (inQ) continue;
      if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        if (any) { counts.forEach((a, d) => a.push(cur[d])); lines++; }
        cur = DELIMITERS.map(() => 0);
        any = false;
        continue;
      }
      any = true;
      const d = DELIMITERS.indexOf(c);
      if (d >= 0) cur[d]++;
    }
    if (any && lines < maxLines) counts.forEach((a, d) => a.push(cur[d]));
    let best = ',', bestScore = 0;
    DELIMITERS.forEach((d, idx) => {
      const a = counts[idx];
      if (!a.length || !a[0]) return;
      const consistent = a.filter((x) => x === a[0]).length / a.length;
      const score = consistent * 1000 + Math.min(a[0], 999);
      if (score > bestScore) { bestScore = score; best = d; }
    });
    return best;
  }

  // ---------- RFC 4180 parser ----------
  // Returns { rows: string[][], lines: number[] (1-based source line of each row),
  //           unclosedQuote: line number | 0 }.
  // Lenient where RFC 4180 is silent: a quote inside an unquoted field is literal,
  // text after a closing quote is appended, blank lines are skipped.
  function parse(text, opts) {
    text = stripBom(String(text || ''));
    const delim = (opts && opts.delimiter) || detectDelimiter(text);
    const rows = [], lines = [];
    const n = text.length;
    let row = [], field = '', i = 0, line = 1, rowLine = 1, unclosed = 0;
    let quotedRow = false; // row had at least one quoted field (so a lone "" is not a blank line)

    function endRow() {
      row.push(field);
      field = '';
      if (!(row.length === 1 && row[0] === '' && !quotedRow)) { rows.push(row); lines.push(rowLine); }
      row = [];
      quotedRow = false;
    }

    while (i < n) {
      const c = text[i];
      if (c === '"' && field === '') {
        // Quoted field.
        quotedRow = true;
        const start = line;
        i++;
        let buf = '';
        for (;;) {
          const q = text.indexOf('"', i);
          if (q < 0) {
            buf += text.slice(i);
            for (let k = i; k < n; k++) if (text[k] === '\n') line++;
            i = n;
            unclosed = unclosed || start;
            break;
          }
          const chunk = text.slice(i, q);
          for (let k = 0; k < chunk.length; k++) if (chunk.charCodeAt(k) === 10) line++;
          buf += chunk;
          if (text[q + 1] === '"') { buf += '"'; i = q + 2; continue; }
          i = q + 1;
          break;
        }
        field = buf;
        // Anything after the closing quote up to the delimiter is kept as-is.
        while (i < n && text[i] !== delim && text[i] !== '\n' && text[i] !== '\r') field += text[i++];
        continue;
      }
      if (c === delim) { row.push(field); field = ''; i++; continue; }
      if (c === '\r' || c === '\n') {
        endRow();
        i += c === '\r' && text[i + 1] === '\n' ? 2 : 1;
        line++;
        rowLine = line;
        continue;
      }
      // Fast path: copy a run of ordinary characters.
      let j = i + 1;
      while (j < n) {
        const d = text[j];
        if (d === delim || d === '\n' || d === '\r') break;
        j++;
      }
      field += text.slice(i, j);
      i = j;
    }
    if (field !== '' || row.length || quotedRow) endRow();
    return { rows, lines, delimiter: delim, unclosedQuote: unclosed };
  }

  // ---------- Type inference ----------
  // Only converts values whose JSON form is identical to the text, so IDs like
  // "00123", phone numbers "+8801…", "1.50", "1e5" and huge integers stay strings.
  const NUM = /^-?(0|[1-9]\d*)(\.\d+)?$/;
  function inferValue(s) {
    if (s === '' || s === 'null') return null;
    if (/^true$/i.test(s)) return true;
    if (/^false$/i.test(s)) return false;
    if (NUM.test(s)) {
      const x = Number(s);
      if (Number.isFinite(x) && String(x) === s) return x;
    }
    return s;
  }

  // Cells that hold a JSON object/array (how convert.js writes nested arrays).
  function maybeJson(s) {
    if (typeof s !== 'string' || s.length < 2) return s;
    const a = s[0], b = s[s.length - 1];
    if (!((a === '[' && b === ']') || (a === '{' && b === '}'))) return s;
    try {
      const v = JSON.parse(s);
      return isContainer(v) ? v : s;
    } catch (e) {
      return s;
    }
  }

  // ---------- Unflatten "a.b.c" keys ----------
  // A key is nested only when none of its prefixes is itself a column
  // ("a" and "a.b" together would collide), so no value is ever lost.
  function unflatten(flat) {
    const keys = Object.keys(flat);
    const all = new Set(keys);
    const out = {};
    for (const key of keys) {
      const parts = key.split('.');
      let nest = parts.length > 1 && !parts.some((p) => p === '');
      for (let p = 1; nest && p < parts.length; p++) if (all.has(parts.slice(0, p).join('.'))) nest = false;
      if (!nest) { if (!hasOwn(out, key)) setKey(out, key, flat[key]); continue; }
      let o = out;
      for (let p = 0; p < parts.length - 1; p++) {
        const k = parts[p];
        if (!hasOwn(o, k)) setKey(o, k, {});
        o = o[k];
      }
      setKey(o, parts[parts.length - 1], flat[key]);
    }
    return out;
  }

  // ---------- CSV rows -> JSON ----------
  function uniqueHeaders(row, width) {
    const seen = new Map();
    const out = [];
    for (let c = 0; c < width; c++) {
      let h = c < row.length ? row[c] : '';
      if (h === '') h = 'col' + (c + 1);
      let name = h, k = 2;
      while (seen.has(name)) name = h + '_' + k++;
      seen.set(name, true);
      out.push(name);
    }
    return out;
  }

  // opts: { header: bool, arrays: bool, infer: bool, trim: bool, nest: bool }
  // Returns { data, headers, rowCount, colCount, ragged: [{ line, expected, got }] }.
  function rowsToJson(parsed, opts) {
    opts = opts || {};
    const rows = parsed.rows, lines = parsed.lines || [];
    const header = opts.header !== false;
    const clean = (s) => (opts.trim ? s.trim() : s);
    const value = (s) => {
      let v = clean(s);
      if (opts.infer) v = inferValue(v);
      if (opts.nest) v = maybeJson(v);
      return v;
    };
    const ragged = [];
    const first = header && rows.length ? rows[0].map(clean) : null;
    const start = first ? 1 : 0;
    let width = first ? first.length : 0;
    for (let r = start; r < rows.length; r++) if (!first && rows[r].length > width) width = rows[r].length;
    const expected = first ? first.length : width;
    for (let r = start; r < rows.length; r++) {
      if (rows[r].length !== expected) ragged.push({ line: lines[r] || r + 1, expected, got: rows[r].length });
    }

    if (opts.arrays) {
      const data = [];
      if (first) data.push(first);
      for (let r = start; r < rows.length; r++) data.push(rows[r].map(value));
      return { data, headers: first || [], rowCount: rows.length - start, colCount: width, ragged };
    }

    let maxW = width;
    for (let r = start; r < rows.length; r++) if (rows[r].length > maxW) maxW = rows[r].length;
    const headers = uniqueHeaders(first || [], maxW);
    const missing = opts.infer ? null : '';
    const data = [];
    for (let r = start; r < rows.length; r++) {
      const row = rows[r];
      let o = {};
      for (let c = 0; c < headers.length; c++) {
        if (c < row.length) setKey(o, headers[c], value(row[c]));
        else if (c < expected) setKey(o, headers[c], missing);
      }
      if (opts.nest) o = unflatten(o);
      data.push(o);
    }
    return { data, headers, rowCount: data.length, colCount: headers.length, ragged };
  }

  function csvToJson(text, opts) {
    opts = opts || {};
    const parsed = parse(text, { delimiter: opts.delimiter });
    const res = rowsToJson(parsed, opts);
    res.delimiter = parsed.delimiter;
    res.unclosedQuote = parsed.unclosedQuote;
    return res;
  }

  // ---------- JSON -> table -> CSV ----------
  // Same flattening as convert.js: nested objects become dot keys, arrays and
  // empty objects become JSON text.
  function flatten(obj, prefix, out) {
    out = out || {};
    for (const k of Object.keys(obj)) {
      const key = prefix ? prefix + '.' + k : k;
      const x = obj[k];
      if (isContainer(x) && !Array.isArray(x) && Object.keys(x).length) flatten(x, key, out);
      else setKey(out, key, isContainer(x) ? JSON.stringify(x) : x);
    }
    return out;
  }

  // Returns { headers: string[] | null, rows: any[][] }. An array whose items are
  // all arrays is written row by row (the inverse of "rows as arrays").
  function jsonToTable(v) {
    const list = Array.isArray(v) ? v : [v];
    if (list.length && list.every(Array.isArray)) {
      return { headers: null, rows: list.map((r) => r.map((x) => (isContainer(x) ? JSON.stringify(x) : x))) };
    }
    const objs = list.map((x) =>
      isContainer(x) && !Array.isArray(x) ? flatten(x) : { value: isContainer(x) ? JSON.stringify(x) : x });
    const headers = [];
    const seen = new Set();
    for (const r of objs) for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); headers.push(k); }
    return { headers, rows: objs.map((r) => headers.map((h) => (hasOwn(r, h) ? r[h] : undefined))) };
  }

  const FORMULA = /^[=+\-@\t\r]/;
  function cell(v, delim, guard) {
    if (v === null || v === undefined) return '';
    let s = String(v);
    if (guard && typeof v === 'string' && FORMULA.test(s)) s = "'" + s;
    const needs = s.includes(delim) || s.includes('"') || s.includes('\n') || s.includes('\r');
    return needs ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  // opts: { delimiter: ',', header: true, guard: false, eol: '\r\n' }
  function tableToCsv(table, opts) {
    opts = opts || {};
    const d = opts.delimiter || ',';
    const eol = opts.eol || '\r\n';
    const guard = !!opts.guard;
    const out = [];
    if (table.headers && opts.header !== false) out.push(table.headers.map((h) => cell(h, d, guard)).join(d));
    for (const r of table.rows) out.push(r.map((x) => cell(x, d, guard)).join(d));
    return out.join(eol);
  }

  function jsonToCsv(v, opts) {
    return tableToCsv(jsonToTable(v), opts);
  }

  const api = {
    DELIMITERS, stripBom, detectDelimiter, parse, inferValue, maybeJson, unflatten,
    rowsToJson, csvToJson, flatten, jsonToTable, tableToCsv, jsonToCsv,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JBCSV = api;
})(typeof self !== 'undefined' ? self : this);
