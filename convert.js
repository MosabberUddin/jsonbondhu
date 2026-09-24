// Pure conversion/repair helpers. No DOM access, so they can be unit-tested in Node.
(function (root) {
  'use strict';

  const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
  function bnNum(s) {
    return String(s).replace(/\d/g, (d) => BN_DIGITS[d]);
  }

  // Turn a JSON.parse error into { line, col, pos } across Chrome/Firefox/Safari messages.
  function errorLocation(err, text) {
    const msg = String(err && err.message);
    let m = msg.match(/line (\d+) column (\d+)/);
    if (m) {
      const line = +m[1], col = +m[2];
      const lines = text.split('\n');
      let pos = 0;
      for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
      return { line, col, pos: pos + col - 1 };
    }
    m = msg.match(/position (\d+)/);
    if (m) {
      const pos = +m[1];
      const before = text.slice(0, pos);
      return { line: before.split('\n').length, col: pos - before.lastIndexOf('\n'), pos };
    }
    return null;
  }

  // Fix the most common "almost JSON" mistakes: comments, trailing commas,
  // single-quoted strings, unquoted keys and Python literals (True/False/None).
  function repair(t) {
    let out = '';
    let i = 0;
    const n = t.length;
    const ident = /[A-Za-z_$]/;
    while (i < n) {
      const c = t[i];
      if (c === '"') {
        let j = i + 1;
        while (j < n && t[j] !== '"') j += t[j] === '\\' ? 2 : 1;
        out += t.slice(i, j + 1);
        i = j + 1;
        continue;
      }
      if (c === "'") {
        let j = i + 1, s = '';
        while (j < n && t[j] !== "'") {
          if (t[j] === '\\') { s += t[j] === '\\' && t[j + 1] === "'" ? "'" : t[j] + (t[j + 1] || ''); j += 2; continue; }
          s += t[j] === '"' ? '\\"' : t[j];
          j++;
        }
        out += '"' + s + '"';
        i = j + 1;
        continue;
      }
      if (c === '/' && t[i + 1] === '/') {
        while (i < n && t[i] !== '\n') i++;
        continue;
      }
      if (c === '/' && t[i + 1] === '*') {
        const e = t.indexOf('*/', i + 2);
        i = e < 0 ? n : e + 2;
        continue;
      }
      if (c === '}' || c === ']') {
        out = out.replace(/,\s*$/, '');
        out += c;
        i++;
        continue;
      }
      if (ident.test(c)) {
        let j = i;
        while (j < n && /[\w$]/.test(t[j])) j++;
        const word = t.slice(i, j);
        let k = j;
        while (k < n && /\s/.test(t[k])) k++;
        if (t[k] === ':') out += JSON.stringify(word);
        else if (word === 'True') out += 'true';
        else if (word === 'False') out += 'false';
        else if (word === 'None' || word === 'undefined') out += 'null';
        else out += word;
        i = j;
        continue;
      }
      out += c;
      i++;
    }
    return out;
  }

  function isContainer(v) {
    return v !== null && typeof v === 'object';
  }

  // ---------- YAML ----------
  const YAML_RESERVED = /^(true|false|null|yes|no|on|off|~|y|n)$/i;
  function yamlScalar(v) {
    if (v === null) return 'null';
    if (typeof v !== 'string') return String(v);
    const plain = /^[A-Za-zঀ-৿_][\w \-.\/ঀ-৿]*$/.test(v) &&
      !YAML_RESERVED.test(v) && !/\s$/.test(v);
    return plain ? v : JSON.stringify(v);
  }
  function yamlEmpty(v) {
    return Array.isArray(v) ? '[]' : '{}';
  }
  function toYaml(v, ind) {
    ind = ind || 0;
    const pad = '  '.repeat(ind);
    if (!isContainer(v)) return pad + yamlScalar(v);
    if (Array.isArray(v)) {
      if (!v.length) return pad + '[]';
      return v.map((x) => {
        if (isContainer(x) && Object.keys(x).length) return pad + '- ' + toYaml(x, ind + 1).trimStart();
        return pad + '- ' + (isContainer(x) ? yamlEmpty(x) : yamlScalar(x));
      }).join('\n');
    }
    const keys = Object.keys(v);
    if (!keys.length) return pad + '{}';
    return keys.map((k) => {
      const x = v[k];
      if (isContainer(x) && Object.keys(x).length) return pad + yamlScalar(k) + ':\n' + toYaml(x, ind + 1);
      return pad + yamlScalar(k) + ': ' + (isContainer(x) ? yamlEmpty(x) : yamlScalar(x));
    }).join('\n');
  }

  // ---------- XML ----------
  function xmlName(k) {
    let s = String(k).replace(/[^\w.\-ঀ-৿]/g, '_');
    if (!/^[A-Za-z_ঀ-৿]/.test(s)) s = '_' + s;
    return s;
  }
  function xmlEscape(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function xmlNode(v, name, ind) {
    const pad = '  '.repeat(ind);
    const tag = xmlName(name);
    if (v === null) return pad + '<' + tag + '/>';
    if (!isContainer(v)) return pad + '<' + tag + '>' + xmlEscape(v) + '</' + tag + '>';
    if (Array.isArray(v)) return v.map((x) => xmlNode(x, name, ind)).join('\n');
    const keys = Object.keys(v);
    if (!keys.length) return pad + '<' + tag + '/>';
    const inner = keys.map((k) => xmlNode(v[k], k, ind + 1)).filter(Boolean).join('\n');
    return pad + '<' + tag + '>\n' + inner + '\n' + pad + '</' + tag + '>';
  }
  function toXml(v) {
    const body = Array.isArray(v)
      ? '<root>\n' + v.map((x) => xmlNode(x, 'item', 1)).join('\n') + '\n</root>'
      : xmlNode(isContainer(v) ? v : { value: v }, 'root', 0);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + body;
  }

  // ---------- CSV ----------
  function flatten(obj, prefix, out) {
    out = out || {};
    for (const k of Object.keys(obj)) {
      const key = prefix ? prefix + '.' + k : k;
      const x = obj[k];
      if (isContainer(x) && !Array.isArray(x) && Object.keys(x).length) flatten(x, key, out);
      else out[key] = isContainer(x) ? JSON.stringify(x) : x;
    }
    return out;
  }
  function csvCell(v) {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(v) {
    const rows = (Array.isArray(v) ? v : [v]).map((x) =>
      isContainer(x) && !Array.isArray(x) ? flatten(x) : { value: isContainer(x) ? JSON.stringify(x) : x });
    const headers = [];
    const seen = new Set();
    for (const r of rows) for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); headers.push(k); }
    return [headers.map(csvCell).join(',')]
      .concat(rows.map((r) => headers.map((h) => csvCell(r[h])).join(',')))
      .join('\r\n');
  }

  // ---------- Stats / paths ----------
  function stats(v) {
    let nodes = 0, depth = 0;
    (function walk(x, d) {
      nodes++;
      if (d > depth) depth = d;
      if (isContainer(x)) for (const k of Object.keys(x)) walk(x[k], d + 1);
    })(v, 0);
    return { nodes, depth };
  }
  function pathJoin(parent, key, isIndex) {
    if (isIndex) return parent + '[' + key + ']';
    return /^[A-Za-z_$][\w$]*$/.test(key) ? parent + '.' + key : parent + '[' + JSON.stringify(key) + ']';
  }

  const api = { bnNum, errorLocation, repair, toYaml, toXml, toCsv, stats, pathJoin, isContainer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JB = api;
})(typeof self !== 'undefined' ? self : this);
