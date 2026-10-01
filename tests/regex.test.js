const test = require('node:test');
const assert = require('node:assert');
const R = require('../public/lib/regex-core.js');

test('finds all matches with index and groups', () => {
  const r = R.run('(\\d)(x)?', 'g', 'a1 b2x');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.matches.length, 2);
  assert.deepStrictEqual(r.matches[0], { index: 1, end: 2, text: '1', groups: ['1', undefined], named: null });
  assert.strictEqual(r.matches[1].text, '2x');
  assert.strictEqual(r.matches[1].index, 4);
});

test('without g only the first match is returned', () => {
  assert.strictEqual(R.run('a', '', 'aaa').matches.length, 1);
  assert.strictEqual(R.run('a', 'g', 'aaa').matches.length, 3);
});

test('named groups', () => {
  const r = R.run('(?<y>\\d{4})-(?<m>\\d{2})', 'g', '2026-03 and 1999-12');
  assert.deepStrictEqual(r.matches[1].named, { y: '1999', m: '12' });
  assert.deepStrictEqual(r.matches[0].groups, ['2026', '03']);
});

test('flags: i, m, s, d', () => {
  assert.strictEqual(R.run('abc', 'i', 'ABC').matches.length, 1);
  assert.strictEqual(R.run('abc', '', 'ABC').matches.length, 0);
  assert.strictEqual(R.run('^b', 'gm', 'a\nb').matches.length, 1);
  assert.strictEqual(R.run('^b', 'g', 'a\nb').matches.length, 0);
  assert.strictEqual(R.run('a.b', 's', 'a\nb').matches.length, 1);
  assert.strictEqual(R.run('a.b', '', 'a\nb').matches.length, 0);
  const d = R.run('(b)', 'd', 'ab');
  assert.deepStrictEqual(d.matches[0].spans, [[1, 2], [1, 2]]);
});

test('sticky flag matches only at lastIndex', () => {
  assert.strictEqual(R.run('a', 'gy', 'aab').matches.length, 2);
  assert.strictEqual(R.run('b', 'gy', 'aab').matches.length, 0);
});

test('empty matches do not loop forever', () => {
  const r = R.run('', 'g', 'abc');
  assert.strictEqual(r.matches.length, 4);
  assert.deepStrictEqual(r.matches.map((m) => m.index), [0, 1, 2, 3]);
  const star = R.run('x*', 'g', 'axb');
  assert.deepStrictEqual(star.matches.map((m) => m.text), ['', 'x', '', '']);
  assert.strictEqual(R.run('', 'g', '').matches.length, 1);
});

test('unicode: u flag steps over astral code points', () => {
  const s = 'a\u{1F600}b';
  assert.strictEqual(R.run('', 'gu', s).matches.length, 4);
  assert.strictEqual(R.run('', 'g', s).matches.length, 5);
  assert.strictEqual(R.run('\\p{Emoji_Presentation}', 'gu', s).matches[0].text, '\u{1F600}');
  assert.strictEqual(R.run('[ক-হ]+', 'g', 'abc কাল xyz').matches[0].text, 'ক');
});

test('invalid pattern returns a clear error, not a throw', () => {
  const r = R.run('(abc', 'g', 'x');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'syntax');
  assert.ok(r.message.length > 0);
  assert.strictEqual(R.run('[', '', 'x').ok, false);
  assert.strictEqual(R.run('(?<n>a)(?<n>b)', '', 'x').ok, false);
});

test('invalid and duplicate flags', () => {
  assert.strictEqual(R.run('a', 'gg', 'a').code, 'flags');
  assert.strictEqual(R.run('a', 'z', 'a').code, 'flags');
  assert.strictEqual(R.checkFlags('dgimsuy').ok, true);
});

test('match cap and input cap', () => {
  const r = R.run('a', 'g', 'a'.repeat(5000));
  assert.strictEqual(r.matches.length, R.MAX_MATCHES);
  assert.strictEqual(r.truncated, true);
  const small = R.run('a', 'g', 'aaaa', { maxMatches: 2 });
  assert.strictEqual(small.matches.length, 2);
  assert.strictEqual(small.truncated, true);
  const long = R.run('a', 'g', 'a'.repeat(100), { maxInput: 10 });
  assert.strictEqual(long.inputTruncated, true);
  assert.strictEqual(long.text.length, 10);
  assert.strictEqual(R.run('a', 'g', 'aa').truncated, false);
  assert.strictEqual(R.run('a'.repeat(R.MAX_PATTERN + 1), '', 'a').code, 'tooLong');
});

test('risky pattern heuristic', () => {
  assert.strictEqual(R.looksRisky('(a+)+$'), true);
  assert.strictEqual(R.looksRisky('(\\w*)*x'), true);
  assert.strictEqual(R.looksRisky('^[a-z]+@[a-z]+$'), false);
  assert.strictEqual(R.looksRisky('(ab)+'), false);
  assert.strictEqual(R.run('(a+)+$', 'g', 'aaa').risky, true);
});

test('replace with $1, $<name>, $& and $$', () => {
  assert.strictEqual(R.replace('(\\w+)@(\\w+)', 'g', 'a@b c@d', '$2:$1').result, 'b:a d:c');
  const d = R.replace('(?<y>\\d{4})-(?<m>\\d{2})', 'g', '2026-03', '$<m>/$<y>');
  assert.strictEqual(d.result, '03/2026');
  assert.strictEqual(d.count, 1);
  assert.strictEqual(R.replace('b', 'g', 'abc', '[$&]$$').result, 'a[b]$c');
});

test('replace without g changes only the first match; empty matches work', () => {
  assert.strictEqual(R.replace('a', '', 'aaa', 'b').result, 'baa');
  assert.strictEqual(R.replace('', 'g', 'ab', '-').result, '-a-b-');
  assert.strictEqual(R.replace('x', 'g', 'abc', 'y').count, 0);
});

test('replace reports invalid patterns', () => {
  assert.strictEqual(R.replace('(', 'g', 'a', 'b').ok, false);
});

test('segments split text for highlighting', () => {
  const text = 'a1b22';
  const r = R.run('\\d+', 'g', text);
  const segs = R.segments(text, r.matches);
  assert.deepStrictEqual(segs.map((s) => [s.text, s.match]), [['a', -1], ['1', 0], ['b', -1], ['22', 1]]);
  assert.strictEqual(segs.map((s) => s.text).join(''), text);
  const e = R.segments('ab', R.run('', 'g', 'ab').matches);
  assert.strictEqual(e.filter((s) => s.empty).length, 3);
  assert.strictEqual(e.map((s) => s.text).join(''), 'ab');
});

test('presets compile and match their sample text', () => {
  for (const p of R.PRESETS) {
    const r = R.run(p.pattern, p.flags, p.text);
    assert.ok(r.ok, p.id);
    assert.ok(r.matches.length > 0, p.id);
  }
  const phone = R.PRESETS.find((p) => p.id === 'phone');
  const m = R.run(phone.pattern, phone.flags, phone.text).matches.map((x) => x.text);
  assert.deepStrictEqual(m, ['01712345678', '+8801812345678']);
  const email = R.PRESETS.find((p) => p.id === 'email');
  assert.strictEqual(R.run(email.pattern, email.flags, email.text).matches.length, 2);
  const date = R.PRESETS.find((p) => p.id === 'date');
  assert.strictEqual(R.run(date.pattern, date.flags, date.text).matches.length, 2);
});
