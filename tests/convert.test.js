const test = require('node:test');
const assert = require('node:assert');
const JB = require('../public/convert.js');

test('bnNum converts digits', () => {
  assert.strictEqual(JB.bnNum('2026'), '২০২৬');
});

test('errorLocation from position message', () => {
  const text = '{\n  "a": 1,\n}';
  let err;
  try { JSON.parse(text); } catch (e) { err = e; }
  const loc = JB.errorLocation(err, text);
  assert.ok(loc, 'location found for: ' + err.message);
  assert.strictEqual(loc.line, 3);
});

test('errorLocation from line/column message (Firefox style)', () => {
  const loc = JB.errorLocation({ message: 'JSON.parse: bad at line 2 column 3 of the JSON data' }, 'ab\ncdef');
  assert.deepStrictEqual(loc, { line: 2, col: 3, pos: 5 });
});

test('repair fixes comments, trailing commas, quotes, bare keys, Python literals', () => {
  const src = "{\n  // comment\n  name: 'Rahim', /* x */\n  'ok': True, n: None,\n  list: [1, 2, 3,],\n  url: \"http://a.com/b\",\n}";
  assert.deepStrictEqual(JSON.parse(JB.repair(src)), {
    name: 'Rahim', ok: true, n: null, list: [1, 2, 3], url: 'http://a.com/b',
  });
});

test('repair leaves strings containing tricky text alone', () => {
  const src = '{"a": "x, }", "b": "// not a comment"}';
  assert.deepStrictEqual(JSON.parse(JB.repair(src)), { a: 'x, }', b: '// not a comment' });
});

test('toCsv flattens nested objects and escapes', () => {
  const csv = JB.toCsv([{ a: 1, b: { c: 'x,y' } }, { a: 2, d: [1, 2] }]);
  assert.strictEqual(csv, 'a,b.c,d\r\n1,"x,y",\r\n2,,"[1,2]"');
});

test('toYaml emits nested structures', () => {
  const y = JB.toYaml({ name: 'ঢাকা', tags: ['a', 'true'], o: { k: 1 }, e: [] });
  assert.strictEqual(y, 'name: ঢাকা\ntags:\n  - a\n  - "true"\no:\n  k: 1\ne: []');
});

test('toYaml handles arrays of objects', () => {
  assert.strictEqual(JB.toYaml([{ a: 1, b: 2 }]), '- a: 1\n  b: 2');
});

test('toXml escapes and sanitizes names', () => {
  const x = JB.toXml({ '1st key': '<b>&', list: [1, 2], none: null });
  assert.strictEqual(x,
    '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n  <_1st_key>&lt;b&gt;&amp;</_1st_key>\n  <list>1</list>\n  <list>2</list>\n  <none/>\n</root>');
});

test('pathJoin uses bracket notation for unusual keys', () => {
  assert.strictEqual(JB.pathJoin('$', 'name', false), '$.name');
  assert.strictEqual(JB.pathJoin('$', 'নাম', false), '$["নাম"]');
  assert.strictEqual(JB.pathJoin('$.a', '0', true), '$.a[0]');
});
