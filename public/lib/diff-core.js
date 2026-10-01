// Text diff helpers: Myers line diff, word-level diff inside changed lines, unified output.
// Pure functions; unit-tested in tests/diff.test.js. No external libraries.
(function (root) {
  'use strict';

  const LIMITS = {
    maxChars: 1000000, // per side
    maxLines: 20000, // per side
    maxEditLines: 2000, // Myers edit distance cap for lines (keeps memory ~16 MB)
    maxEditWords: 600, // Myers edit distance cap for words inside one line
    maxWordLineChars: 2000, // longer lines are not word-highlighted
  };

  const DEFAULTS = { ignoreWhitespace: false, ignoreCase: false, ignoreTrailing: false };

  function splitLines(text) {
    let s = String(text == null ? '' : text);
    if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
    const lines = s.split(/\r\n|\r|\n/);
    if (lines[lines.length - 1] === '') lines.pop(); // a final line break does not add a line
    return lines;
  }

  // The string two lines are compared by (the original text is still what gets shown).
  function normalizeLine(line, opts) {
    let s = line.normalize('NFC');
    if (opts.ignoreWhitespace) s = s.replace(/\s+/g, '');
    else if (opts.ignoreTrailing) s = s.replace(/\s+$/, '');
    if (opts.ignoreCase) s = s.toLowerCase();
    return s;
  }

  // Myers O(ND) shortest edit script over arrays of small integers.
  // Returns [{t:'eq'|'del'|'add', a, b}] (a/b are 0-based indices) or null if the
  // edit distance exceeds maxD.
  function myers(a, b, maxD) {
    const n = a.length;
    const m = b.length;
    if (n === 0) return b.map((_, j) => ({ t: 'add', a: -1, b: j }));
    if (m === 0) return a.map((_, i) => ({ t: 'del', a: i, b: -1 }));
    const max = Math.min(n + m, maxD);
    const off = max + 1;
    const v = new Int32Array(2 * max + 3);
    const snaps = [];
    let found = -1;
    for (let d = 0; d <= max && found < 0; d++) {
      for (let k = -d; k <= d; k += 2) {
        let x;
        if (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) x = v[off + k + 1];
        else x = v[off + k - 1] + 1;
        let y = x - k;
        while (x < n && y < m && a[x] === b[y]) { x++; y++; }
        v[off + k] = x;
        if (x >= n && y >= m) { found = d; break; }
      }
      if (found < 0) snaps.push(v.slice(off - d, off + d + 1));
    }
    if (found < 0) return null;
    const ops = [];
    let x = n;
    let y = m;
    for (let d = found; d > 0; d--) {
      const p = snaps[d - 1];
      const get = (kk) => p[kk + d - 1];
      const k = x - y;
      const prevK = (k === -d || (k !== d && get(k - 1) < get(k + 1))) ? k + 1 : k - 1;
      const prevX = get(prevK);
      const prevY = prevX - prevK;
      while (x > prevX && y > prevY) { ops.push({ t: 'eq', a: x - 1, b: y - 1 }); x--; y--; }
      if (x === prevX) { ops.push({ t: 'add', a: -1, b: y - 1 }); y--; }
      else { ops.push({ t: 'del', a: x - 1, b: -1 }); x--; }
    }
    while (x > 0 && y > 0) { ops.push({ t: 'eq', a: x - 1, b: y - 1 }); x--; y--; }
    return ops.reverse();
  }

  // Diff two arrays of comparable keys. Trims the common head/tail first, which keeps
  // typical edits fast. If the middle is too different (edit distance > maxD) it falls
  // back to "delete all, add all" for that middle part and reports truncated = true.
  function diffKeys(ka, kb, maxD) {
    const ids = new Map();
    const id = (s) => { let i = ids.get(s); if (i === undefined) { i = ids.size; ids.set(s, i); } return i; };
    const a = ka.map(id);
    const b = kb.map(id);
    let head = 0;
    while (head < a.length && head < b.length && a[head] === b[head]) head++;
    let tail = 0;
    while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
    const midA = a.slice(head, a.length - tail);
    const midB = b.slice(head, b.length - tail);
    let mid = myers(midA, midB, maxD);
    let truncated = false;
    if (mid === null) {
      truncated = true;
      mid = [];
      for (let i = 0; i < midA.length; i++) mid.push({ t: 'del', a: i, b: -1 });
      for (let j = 0; j < midB.length; j++) mid.push({ t: 'add', a: -1, b: j });
    }
    const ops = [];
    for (let i = 0; i < head; i++) ops.push({ t: 'eq', a: i, b: i });
    for (const o of mid) ops.push({ t: o.t, a: o.a < 0 ? -1 : o.a + head, b: o.b < 0 ? -1 : o.b + head });
    for (let i = 0; i < tail; i++) ops.push({ t: 'eq', a: a.length - tail + i, b: b.length - tail + i });
    return { ops, truncated };
  }

  // ---- word level ----

  let segmenter = null;
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  } catch (e) { segmenter = null; }

  function graphemes(s) {
    if (segmenter) return Array.from(segmenter.segment(s), (x) => x.segment);
    return s.match(/[\s\S][\p{M}‌‍]*/gu) || [];
  }

  // Splits into words (letters/digits, with their combining marks), whitespace runs and
  // single other graphemes. Works on grapheme clusters so Bangla conjuncts and emoji
  // sequences are never cut in the middle.
  function tokenize(s) {
    const out = [];
    let prev = '';
    for (const g of graphemes(s)) {
      const c = /^[\p{L}\p{N}_]/u.test(g) ? 'w' : /^\s/u.test(g) ? 's' : 'o';
      if (c !== 'o' && out.length && prev === c) out[out.length - 1] += g;
      else out.push(g);
      prev = c;
    }
    return out;
  }

  function wordKey(tok, opts) {
    if (opts.ignoreWhitespace && /^\s+$/.test(tok)) return ' ';
    let k = tok.normalize('NFC');
    if (opts.ignoreCase) k = k.toLowerCase();
    return k;
  }

  function pushSeg(list, text, changed) {
    if (!text) return;
    const last = list[list.length - 1];
    if (last && last.changed === changed) last.text += text;
    else list.push({ text, changed });
  }

  // Returns { left: [{text, changed}], right: [...] } for two paired lines.
  function diffWords(l, r, options) {
    const opts = Object.assign({}, DEFAULTS, options);
    const whole = () => ({ left: [{ text: l, changed: true }], right: [{ text: r, changed: true }] });
    if (l.length > LIMITS.maxWordLineChars || r.length > LIMITS.maxWordLineChars) return whole();
    const ta = tokenize(l);
    const tb = tokenize(r);
    const { ops, truncated } = diffKeys(ta.map((x) => wordKey(x, opts)), tb.map((x) => wordKey(x, opts)), LIMITS.maxEditWords);
    if (truncated) return whole();
    const left = [];
    const right = [];
    for (const o of ops) {
      if (o.t === 'eq') { pushSeg(left, ta[o.a], false); pushSeg(right, tb[o.b], false); }
      else if (o.t === 'del') pushSeg(left, ta[o.a], true);
      else pushSeg(right, tb[o.b], true);
    }
    return { left, right };
  }

  // ---- line level ----

  function checkLimits(textA, textB) {
    const a = String(textA || '');
    const b = String(textB || '');
    if (a.length > LIMITS.maxChars || b.length > LIMITS.maxChars) return { ok: false, reason: 'chars', limit: LIMITS.maxChars };
    const countLines = (s) => { let c = 1; for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) c++; return c; };
    if (countLines(a) > LIMITS.maxLines || countLines(b) > LIMITS.maxLines) return { ok: false, reason: 'lines', limit: LIMITS.maxLines };
    return { ok: true };
  }

  // Full result: ops, side-by-side rows, counts.
  function diffLines(textA, textB, options) {
    const opts = Object.assign({}, DEFAULTS, options);
    const linesA = splitLines(textA);
    const linesB = splitLines(textB);
    const { ops, truncated } = diffKeys(
      linesA.map((x) => normalizeLine(x, opts)),
      linesB.map((x) => normalizeLine(x, opts)),
      LIMITS.maxEditLines,
    );
    const stats = { added: 0, removed: 0, unchanged: 0 };
    const rows = [];
    let dels = [];
    let adds = [];
    const flush = () => {
      const pairs = Math.min(dels.length, adds.length);
      for (let i = 0; i < pairs; i++) {
        const l = linesA[dels[i].a];
        const r = linesB[adds[i].b];
        const w = diffWords(l, r, opts);
        rows.push({ type: 'change', aNo: dels[i].a + 1, bNo: adds[i].b + 1, left: l, right: r, leftSegs: w.left, rightSegs: w.right });
      }
      for (let i = pairs; i < dels.length; i++) rows.push({ type: 'del', aNo: dels[i].a + 1, bNo: null, left: linesA[dels[i].a], right: null });
      for (let i = pairs; i < adds.length; i++) rows.push({ type: 'add', aNo: null, bNo: adds[i].b + 1, left: null, right: linesB[adds[i].b] });
      dels = [];
      adds = [];
    };
    for (const o of ops) {
      if (o.t === 'eq') {
        flush();
        stats.unchanged++;
        rows.push({ type: 'eq', aNo: o.a + 1, bNo: o.b + 1, left: linesA[o.a], right: linesB[o.b] });
      } else if (o.t === 'del') { stats.removed++; dels.push(o); }
      else { stats.added++; adds.push(o); }
    }
    flush();
    return { ops, rows, stats, truncated, identical: stats.added === 0 && stats.removed === 0, linesA, linesB };
  }

  // ---- unified output ----

  function range(start, count) {
    // GNU/git style: "N" when count is 1, "N,M" otherwise; an empty range names the line before.
    const s = count === 0 ? start : start + 1;
    return count === 1 ? String(s) : s + ',' + count;
  }

  function unified(result, options) {
    const o = Object.assign({ context: 3, labelA: 'original', labelB: 'changed' }, options);
    const ops = result.ops;
    const ctx = Math.max(0, o.context | 0);
    const changed = [];
    ops.forEach((op, i) => { if (op.t !== 'eq') changed.push(i); });
    if (!changed.length) return '';
    // Prefix counts: lines of A / B consumed before each op index.
    const aBefore = [0];
    const bBefore = [0];
    for (const op of ops) {
      aBefore.push(aBefore[aBefore.length - 1] + (op.t !== 'add' ? 1 : 0));
      bBefore.push(bBefore[bBefore.length - 1] + (op.t !== 'del' ? 1 : 0));
    }
    const hunks = [];
    for (const i of changed) {
      const s = Math.max(0, i - ctx);
      const e = Math.min(ops.length - 1, i + ctx);
      const last = hunks[hunks.length - 1];
      if (last && s <= last.e + 1) last.e = Math.max(last.e, e);
      else hunks.push({ s, e });
    }
    const out = ['--- ' + o.labelA, '+++ ' + o.labelB];
    for (const h of hunks) {
      const aCount = aBefore[h.e + 1] - aBefore[h.s];
      const bCount = bBefore[h.e + 1] - bBefore[h.s];
      out.push('@@ -' + range(aBefore[h.s], aCount) + ' +' + range(bBefore[h.s], bCount) + ' @@');
      for (let i = h.s; i <= h.e; i++) {
        const op = ops[i];
        if (op.t === 'eq') out.push(' ' + result.linesA[op.a]);
        else if (op.t === 'del') out.push('-' + result.linesA[op.a]);
        else out.push('+' + result.linesB[op.b]);
      }
    }
    return out.join('\n');
  }

  const api = { LIMITS, splitLines, normalizeLine, myers, diffKeys, tokenize, diffWords, checkLimits, diffLines, unified };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JBDIFF = api;
})(typeof self !== 'undefined' ? self : this);
