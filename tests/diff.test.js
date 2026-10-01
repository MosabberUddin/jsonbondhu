const test = require('node:test');
const assert = require('node:assert');
const D = require('../public/lib/diff-core.js');

const types = (r) => r.ops.map((o) => o.t).join(',');

test('splitLines handles CRLF, CR, LF, BOM and trailing newline', () => {
  assert.deepStrictEqual(D.splitLines(''), []);
  assert.deepStrictEqual(D.splitLines('a'), ['a']);
  assert.deepStrictEqual(D.splitLines('a\n'), ['a']);
  assert.deepStrictEqual(D.splitLines('a\n\n'), ['a', '']);
  assert.deepStrictEqual(D.splitLines('a\r\nb\rc\nd'), ['a', 'b', 'c', 'd']);
  assert.deepStrictEqual(D.splitLines('﻿a'), ['a']);
});

test('identical texts have no changes', () => {
  const r = D.diffLines('a\nb\nc', 'a\nb\nc');
  assert.strictEqual(r.identical, true);
  assert.deepStrictEqual(r.stats, { added: 0, removed: 0, unchanged: 3 });
  assert.strictEqual(D.unified(r), '');
});

test('both sides empty', () => {
  const r = D.diffLines('', '');
  assert.strictEqual(r.identical, true);
  assert.deepStrictEqual(r.stats, { added: 0, removed: 0, unchanged: 0 });
  assert.deepStrictEqual(r.rows, []);
});

test('empty original: everything is added', () => {
  const r = D.diffLines('', 'x\ny');
  assert.deepStrictEqual(r.stats, { added: 2, removed: 0, unchanged: 0 });
  assert.strictEqual(types(r), 'add,add');
  assert.strictEqual(D.unified(r), '--- original\n+++ changed\n@@ -0,0 +1,2 @@\n+x\n+y');
});

test('empty changed: everything is removed', () => {
  const r = D.diffLines('x\ny', '');
  assert.deepStrictEqual(r.stats, { added: 0, removed: 2, unchanged: 0 });
  assert.strictEqual(D.unified(r), '--- original\n+++ changed\n@@ -1,2 +0,0 @@\n-x\n-y');
});

test('insertion in the middle', () => {
  const r = D.diffLines('a\nc', 'a\nb\nc');
  assert.strictEqual(types(r), 'eq,add,eq');
  assert.deepStrictEqual(r.stats, { added: 1, removed: 0, unchanged: 2 });
  assert.deepStrictEqual(r.rows.map((x) => x.type), ['eq', 'add', 'eq']);
  assert.strictEqual(r.rows[1].bNo, 2);
  assert.strictEqual(r.rows[1].left, null);
});

test('deletion in the middle', () => {
  const r = D.diffLines('a\nb\nc', 'a\nc');
  assert.strictEqual(types(r), 'eq,del,eq');
  assert.deepStrictEqual(r.stats, { added: 0, removed: 1, unchanged: 2 });
  assert.strictEqual(r.rows[1].aNo, 2);
  assert.strictEqual(r.rows[1].right, null);
});

test('replacement pairs lines and highlights changed words', () => {
  const r = D.diffLines('one\nthe quick brown fox\nthree', 'one\nthe slow brown fox\nthree');
  assert.deepStrictEqual(r.stats, { added: 1, removed: 1, unchanged: 2 });
  const row = r.rows[1];
  assert.strictEqual(row.type, 'change');
  assert.deepStrictEqual(row.leftSegs, [
    { text: 'the ', changed: false }, { text: 'quick', changed: true }, { text: ' brown fox', changed: false },
  ]);
  assert.deepStrictEqual(row.rightSegs, [
    { text: 'the ', changed: false }, { text: 'slow', changed: true }, { text: ' brown fox', changed: false },
  ]);
});

test('uneven replacement block: extra lines become pure add/del rows', () => {
  const r = D.diffLines('a\nb\nc\nd', 'a\nX\nd');
  assert.deepStrictEqual(r.rows.map((x) => x.type), ['eq', 'change', 'del', 'eq']);
  const r2 = D.diffLines('a\nb\nd', 'a\nX\nY\nd');
  assert.deepStrictEqual(r2.rows.map((x) => x.type), ['eq', 'change', 'add', 'eq']);
});

test('moved lines show as one removal and one addition', () => {
  const r = D.diffLines('a\nb\nc\nd', 'b\nc\nd\na');
  assert.deepStrictEqual(r.stats, { added: 1, removed: 1, unchanged: 3 });
  assert.strictEqual(r.rows[0].type, 'del');
  assert.strictEqual(r.rows[0].left, 'a');
  assert.strictEqual(r.rows[4].type, 'add');
});

test('CRLF and LF compare as equal; mixed endings work', () => {
  assert.strictEqual(D.diffLines('a\r\nb\r\nc', 'a\nb\nc').identical, true);
  assert.strictEqual(D.diffLines('a\r\nb\n', 'a\nb').identical, true);
  assert.strictEqual(D.diffLines('a\rb', 'a\nb').identical, true);
});

test('a trailing newline alone is not a difference, an extra blank line is', () => {
  assert.strictEqual(D.diffLines('a\nb\n', 'a\nb').identical, true);
  const r = D.diffLines('a\nb\n', 'a\nb\n\n');
  assert.deepStrictEqual(r.stats, { added: 1, removed: 0, unchanged: 2 });
});

test('ignoreWhitespace', () => {
  assert.strictEqual(D.diffLines('a  b\n\tc', 'a b\nc').identical, false);
  const r = D.diffLines('a  b\n\tc', 'a b\nc', { ignoreWhitespace: true });
  assert.strictEqual(r.identical, true);
  assert.deepStrictEqual(r.stats, { added: 0, removed: 0, unchanged: 2 });
  assert.strictEqual(D.diffLines('ab', 'a b', { ignoreWhitespace: true }).identical, true);
});

test('ignoreTrailing only ignores spaces at the end of a line', () => {
  assert.strictEqual(D.diffLines('a  \nb', 'a\nb').identical, false);
  assert.strictEqual(D.diffLines('a  \nb\t', 'a\nb', { ignoreTrailing: true }).identical, true);
  assert.strictEqual(D.diffLines('a b', 'a  b', { ignoreTrailing: true }).identical, false);
  assert.strictEqual(D.diffLines('  a', 'a', { ignoreTrailing: true }).identical, false);
});

test('ignoreCase', () => {
  assert.strictEqual(D.diffLines('Hello', 'hello').identical, false);
  const r = D.diffLines('Hello\nWORLD', 'hello\nworld', { ignoreCase: true });
  assert.strictEqual(r.identical, true);
  // The shown text keeps its original case.
  assert.strictEqual(r.rows[0].left, 'Hello');
  assert.strictEqual(r.rows[0].right, 'hello');
});

test('ignore options also apply inside word highlighting', () => {
  const w = D.diffWords('Foo  bar', 'foo bar baz', { ignoreCase: true, ignoreWhitespace: true });
  assert.deepStrictEqual(w.left.filter((s) => s.changed), []);
  assert.deepStrictEqual(w.right.filter((s) => s.changed).map((s) => s.text), [' baz']);
});

test('unified output: header, hunk ranges, markers and context', () => {
  const a = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].join('\n');
  const b = ['1', '2', '3', '4', 'five', '6', '7', '8', '9', '10'].join('\n');
  const u = D.unified(D.diffLines(a, b));
  assert.strictEqual(u, [
    '--- original', '+++ changed', '@@ -2,7 +2,7 @@',
    ' 2', ' 3', ' 4', '-5', '+five', ' 6', ' 7', ' 8',
  ].join('\n'));
});

test('unified output: single-line ranges omit the count, custom labels and context', () => {
  const u = D.unified(D.diffLines('x', 'y'), { labelA: 'a.txt', labelB: 'b.txt' });
  assert.strictEqual(u, '--- a.txt\n+++ b.txt\n@@ -1 +1 @@\n-x\n+y');
  const u0 = D.unified(D.diffLines('a\nb\nc', 'a\nB\nc'), { context: 0 });
  assert.strictEqual(u0, '--- original\n+++ changed\n@@ -2 +2 @@\n-b\n+B');
});

test('unified output: distant changes make separate hunks, near ones merge', () => {
  const lines = Array.from({ length: 20 }, (_, i) => 'l' + (i + 1));
  const far = lines.slice();
  far[1] = 'X';
  far[17] = 'Y';
  const u = D.unified(D.diffLines(lines.join('\n'), far.join('\n')));
  assert.strictEqual(u.split('\n').filter((l) => l.startsWith('@@')).length, 2);
  const near = lines.slice();
  near[1] = 'X';
  near[6] = 'Y';
  const un = D.unified(D.diffLines(lines.join('\n'), near.join('\n')));
  assert.strictEqual(un.split('\n').filter((l) => l.startsWith('@@')).length, 1);
});

test('unified output: pure insertion at the top names line 0 for the original', () => {
  const u = D.unified(D.diffLines('b', 'a\nb'), { context: 0 });
  assert.strictEqual(u, '--- original\n+++ changed\n@@ -0,0 +1 @@\n+a');
});

test('applying the edit script to the original reproduces the changed text', () => {
  const cases = [
    ['a\nb\nc\nd\ne', 'a\nx\nc\nd\ny\ne'],
    ['', 'p\nq'],
    ['p\nq', ''],
    ['same', 'same'],
    ['1\n2\n3\n4\n5\n6', '6\n5\n4\n3\n2\n1'],
    ['a\na\na\nb', 'a\nb\nb\nb'],
  ];
  for (const [a, b] of cases) {
    const r = D.diffLines(a, b);
    const rebuilt = [];
    for (const o of r.ops) {
      if (o.t === 'eq') rebuilt.push(r.linesA[o.a]);
      if (o.t === 'add') rebuilt.push(r.linesB[o.b]);
    }
    assert.deepStrictEqual(rebuilt, D.splitLines(b), JSON.stringify([a, b]));
  }
});

test('Myers finds a minimal script on a classic example', () => {
  const r = D.diffLines('A\nB\nC\nA\nB\nB\nA', 'C\nB\nA\nB\nA\nC');
  assert.strictEqual(r.stats.added + r.stats.removed, 5); // edit distance 5
});

test('Bangla words diff as whole words and conjuncts stay intact', () => {
  const w = D.diffWords('আমি ভাত খাই', 'আমি রুটি খাই');
  assert.deepStrictEqual(w.left.filter((s) => s.changed).map((s) => s.text), ['ভাত']);
  assert.deepStrictEqual(w.right.filter((s) => s.changed).map((s) => s.text), ['রুটি']);
  // A conjunct (ক্ষ) and a vowel sign must never be split between segments.
  const c = D.diffWords('বিক্ষোভ', 'বিক্ষেপ');
  assert.deepStrictEqual(c.left, [{ text: 'বিক্ষোভ', changed: true }]);
  assert.deepStrictEqual(D.tokenize('র‍্যাব x'), ['র‍্যাব', ' ', 'x']);
});

test('tokenize keeps emoji sequences and words together', () => {
  assert.deepStrictEqual(D.tokenize('ab, cd'), ['ab', ',', ' ', 'cd']);
  const family = '\u{1F468}‍\u{1F469}‍\u{1F467}';
  assert.deepStrictEqual(D.tokenize('x' + family + 'y'), ['x', family, 'y']);
  assert.deepStrictEqual(D.tokenize(''), []);
});

test('Bangla lines are compared with NFC normalization', () => {
  // U+09DF (য়) vs U+09AF U+09BC are canonically equivalent.
  assert.strictEqual(D.diffLines('য়', 'য়').identical, true);
});

test('checkLimits rejects huge input with a reason', () => {
  assert.deepStrictEqual(D.checkLimits('a', 'b'), { ok: true });
  const big = D.checkLimits('x'.repeat(D.LIMITS.maxChars + 1), '');
  assert.strictEqual(big.ok, false);
  assert.strictEqual(big.reason, 'chars');
  const many = D.checkLimits('', '\n'.repeat(D.LIMITS.maxLines + 1));
  assert.strictEqual(many.ok, false);
  assert.strictEqual(many.reason, 'lines');
});

test('very different large inputs fall back instead of hanging', () => {
  const a = Array.from({ length: 5000 }, (_, i) => 'a' + i).join('\n');
  const b = Array.from({ length: 5000 }, (_, i) => 'b' + i).join('\n');
  const t0 = Date.now();
  const r = D.diffLines(a, b);
  assert.ok(Date.now() - t0 < 5000);
  assert.strictEqual(r.truncated, true);
  assert.deepStrictEqual(r.stats, { added: 5000, removed: 5000, unchanged: 0 });
});

test('large mostly-equal inputs are fast and exact', () => {
  const base = Array.from({ length: 20000 }, (_, i) => 'line ' + i);
  const edited = base.slice();
  edited[100] = 'changed';
  edited.splice(15000, 1);
  const t0 = Date.now();
  const r = D.diffLines(base.join('\n'), edited.join('\n'));
  assert.ok(Date.now() - t0 < 3000);
  assert.strictEqual(r.truncated, false);
  assert.deepStrictEqual(r.stats, { added: 1, removed: 2, unchanged: 19998 });
});

test('over-long lines skip word highlighting but still diff', () => {
  const l = 'x'.repeat(D.LIMITS.maxWordLineChars + 1);
  const w = D.diffWords(l, l + 'y');
  assert.deepStrictEqual(w.left, [{ text: l, changed: true }]);
});
