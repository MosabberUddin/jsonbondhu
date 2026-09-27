const test = require('node:test');
const assert = require('node:assert');
const C = require('../public/lib/csv-core.js');
const JB = require('../public/convert.js');

const rows = (text, delimiter) => C.parse(text, { delimiter }).rows;

test('parses simple CSV with LF, CRLF and a trailing newline', () => {
  assert.deepStrictEqual(rows('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
  assert.deepStrictEqual(rows('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
  assert.deepStrictEqual(rows('a,b\n1,2\n'), [['a', 'b'], ['1', '2']]);
  assert.deepStrictEqual(rows('a,b\r1,2'), [['a', 'b'], ['1', '2']]);
});

test('quoted fields: delimiters, escaped quotes, newlines inside quotes', () => {
  assert.deepStrictEqual(rows('"a,b","say ""hi""","line1\nline2"\n'), [['a,b', 'say "hi"', 'line1\nline2']]);
  assert.deepStrictEqual(rows('"x\r\ny",z'), [['x\r\ny', 'z']]);
  assert.deepStrictEqual(rows('"",a'), [['', 'a']]);
  assert.deepStrictEqual(rows('""'), [['']]);
  assert.deepStrictEqual(rows('a,"",'), [['a', '', '']]);
});

test('empty fields and empty trailing field', () => {
  assert.deepStrictEqual(rows('a,,c\n,,\n'), [['a', '', 'c'], ['', '', '']]);
  assert.deepStrictEqual(rows('a,b,\n'), [['a', 'b', '']]);
});

test('strips a UTF-8 BOM and skips blank lines', () => {
  assert.deepStrictEqual(rows('﻿id,name\n\n1,x\n\n'), [['id', 'name'], ['1', 'x']]);
});

test('lenient with stray quotes and reports an unclosed quote', () => {
  assert.deepStrictEqual(rows('5"x,b'), [['5"x', 'b']]);
  assert.deepStrictEqual(rows('"a"x,b'), [['ax', 'b']]);
  const p = C.parse('a,b\n1,"open\n2,3');
  assert.strictEqual(p.unclosedQuote, 2);
  assert.deepStrictEqual(p.rows[1], ['1', 'open\n2,3']);
});

test('tracks source line numbers across multi-line quoted fields', () => {
  const p = C.parse('h1,h2\n"a\nb",1\nc,2\n');
  assert.deepStrictEqual(p.lines, [1, 2, 4]);
});

test('detects comma, semicolon, tab and pipe', () => {
  assert.strictEqual(C.detectDelimiter('a,b,c\n1,2,3'), ',');
  assert.strictEqual(C.detectDelimiter('a;b;c\n1,5;2,5;3'), ';');
  assert.strictEqual(C.detectDelimiter('a\tb\n1\t2'), '\t');
  assert.strictEqual(C.detectDelimiter('a|b|c\n1|2|3'), '|');
  assert.strictEqual(C.detectDelimiter('"x;y;z",b\n"1;2",3'), ',');
  assert.strictEqual(C.detectDelimiter('single'), ',');
  assert.strictEqual(C.detectDelimiter(''), ',');
  assert.strictEqual(C.parse('a;b\n1;2').delimiter, ';');
});

test('manual delimiter override', () => {
  assert.deepStrictEqual(rows('a,b;c', ';'), [['a,b', 'c']]);
  assert.deepStrictEqual(rows('a|"b|c"', '|'), [['a', 'b|c']]);
});

test('type inference never mangles IDs, phones or precise decimals', () => {
  const I = C.inferValue;
  assert.strictEqual(I('42'), 42);
  assert.strictEqual(I('-3.25'), -3.25);
  assert.strictEqual(I('0'), 0);
  assert.strictEqual(I('0.5'), 0.5);
  assert.strictEqual(I('true'), true);
  assert.strictEqual(I('FALSE'), false);
  assert.strictEqual(I(''), null);
  assert.strictEqual(I('null'), null);
  for (const s of ['00123', '01712345678', '+8801712345678', '1.50', '1e5', '-0', '.5', '5.',
    '12345678901234567890', ' 42', '1,000', 'NaN', 'Infinity', '0x1F', 'True story', 'NULL']) {
    assert.strictEqual(I(s), s, s);
  }
});

test('CSV -> JSON with header, inference and Bangla text', () => {
  const r = C.csvToJson('id,নাম,active\n00123,রহিম,true\n7,করিম,', { header: true, infer: true });
  assert.deepStrictEqual(r.data, [
    { id: '00123', 'নাম': 'রহিম', active: true },
    { id: 7, 'নাম': 'করিম', active: null },
  ]);
  assert.strictEqual(r.rowCount, 2);
  assert.strictEqual(r.colCount, 3);
  assert.deepStrictEqual(r.ragged, []);
});

test('without inference everything stays a string', () => {
  const r = C.csvToJson('a,b\n1,true\n,x', { header: true });
  assert.deepStrictEqual(r.data, [{ a: '1', b: 'true' }, { a: '', b: 'x' }]);
});

test('no header: col1, col2… keys or arrays of arrays', () => {
  assert.deepStrictEqual(C.csvToJson('a,b\n1,2', { header: false }).data,
    [{ col1: 'a', col2: 'b' }, { col1: '1', col2: '2' }]);
  assert.deepStrictEqual(C.csvToJson('a,b\n1,2', { header: false, arrays: true, infer: true }).data,
    [['a', 'b'], [1, 2]]);
  // With a header, arrays mode keeps the header row as-is and infers data rows.
  assert.deepStrictEqual(C.csvToJson('1,true\n1,true', { header: true, arrays: true, infer: true }).data,
    [['1', 'true'], [1, true]]);
});

test('trim toggle', () => {
  assert.deepStrictEqual(C.csvToJson(' a , b \n 1 , x ', { trim: true, infer: true }).data, [{ a: 1, b: 'x' }]);
  assert.deepStrictEqual(C.csvToJson(' a , b \n 1 , x ', {}).data, [{ ' a ': ' 1 ', ' b ': ' x ' }]);
});

test('blank and duplicate headers get unique names', () => {
  const r = C.csvToJson('a,,a,a\n1,2,3,4', {});
  assert.deepStrictEqual(r.headers, ['a', 'col2', 'a_2', 'a_3']);
});

test('ragged rows are reported with line numbers, not dropped', () => {
  const r = C.csvToJson('a,b,c\n1,2,3\n4,5\n6,7,8,9\n', { infer: true });
  assert.strictEqual(r.data.length, 3);
  assert.deepStrictEqual(r.data[1], { a: 4, b: 5, c: null });
  assert.deepStrictEqual(r.data[2], { a: 6, b: 7, c: 8, col4: 9 });
  assert.deepStrictEqual(r.ragged, [{ line: 3, expected: 3, got: 2 }, { line: 4, expected: 3, got: 4 }]);
});

test('rebuilds nested objects from dot keys (inverse of flattening)', () => {
  const r = C.csvToJson('id,address.city,address.geo.lat,tags\n1,ঢাকা,23.8,"[""a"",""b""]"', { infer: true, nest: true });
  assert.deepStrictEqual(r.data, [{ id: 1, address: { city: 'ঢাকা', geo: { lat: 23.8 } }, tags: ['a', 'b'] }]);
});

test('unflatten keeps colliding keys flat and never touches prototypes', () => {
  assert.deepStrictEqual(C.unflatten({ a: 1, 'a.b': 2 }), { a: 1, 'a.b': 2 });
  assert.deepStrictEqual(C.unflatten({ 'a.': 1, '.b': 2, 'x.y': 3 }), { 'a.': 1, '.b': 2, x: { y: 3 } });
  const o = C.unflatten({ '__proto__.polluted': 'yes' });
  assert.strictEqual({}.polluted, undefined);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(o, '__proto__'), true);
  const r = C.csvToJson('__proto__,x\nevil,1', {});
  assert.strictEqual({}.evil, undefined);
  assert.strictEqual(JSON.stringify(r.data), '[{"__proto__":"evil","x":"1"}]');
});

test('maybeJson only parses real JSON containers', () => {
  assert.deepStrictEqual(C.maybeJson('[1,2]'), [1, 2]);
  assert.deepStrictEqual(C.maybeJson('{}'), {});
  assert.strictEqual(C.maybeJson('[not json]'), '[not json]');
  assert.strictEqual(C.maybeJson('"x"'), '"x"');
});

test('JSON -> CSV matches convert.js with default options', () => {
  const samples = [
    [{ a: 1, b: { c: 'x' } }],
    [{ name: 'রহিম, উদ্দিন', note: 'says "hi"', multi: 'a\nb' }, { extra: true, name: null }],
    { single: 1, arr: [1, 2], empty: {}, deep: { x: { y: [{ z: 1 }] } } },
    [1, 'two', null, { k: 'v' }],
    [],
  ];
  for (const s of samples) assert.strictEqual(C.jsonToCsv(s), JB.toCsv(s), JSON.stringify(s));
});

test('JSON -> CSV options: delimiter, no header, arrays of arrays', () => {
  const v = [{ a: 'x;y', b: 2 }];
  assert.strictEqual(C.jsonToCsv(v, { delimiter: ';' }), 'a;b\r\n"x;y";2');
  assert.strictEqual(C.jsonToCsv(v, { delimiter: '\t', header: false }), 'x;y\t2');
  assert.strictEqual(C.jsonToCsv([['h1', 'h2'], [1, [2]]], {}), 'h1,h2\r\n1,[2]');
  assert.strictEqual(C.jsonToCsv(v, { eol: '\n' }), 'a,b\nx;y,2');
});

test('formula-injection guard prefixes risky strings only when enabled', () => {
  const v = [{ f: '=SUM(A1)', p: '+880', m: '-x', at: '@cmd', n: -5, ok: 'safe' }];
  assert.strictEqual(C.jsonToCsv(v), 'f,p,m,at,n,ok\r\n=SUM(A1),+880,-x,@cmd,-5,safe');
  assert.strictEqual(C.jsonToCsv(v, { guard: true }), "f,p,m,at,n,ok\r\n'=SUM(A1),'+880,'-x,'@cmd,-5,safe");
  assert.strictEqual(C.jsonToCsv([{ '=h': '=1,2' }], { guard: true }), "'=h\r\n\"'=1,2\"");
});

test('round-trip CSV -> JSON -> CSV is lossless (Bangla, quotes, newlines)', () => {
  const csv = 'id,নাম,ঠিকানা.শহর,নোট\r\n00123,রহিম উদ্দিন,ঢাকা,"বলল ""হ্যালো"", তারপর\nচলে গেল"\r\n2,Karim,Chattogram,';
  for (const nest of [false, true]) {
    const j = C.csvToJson(csv, { header: true, nest });
    assert.strictEqual(C.jsonToCsv(j.data), csv);
  }
});

test('round-trip JSON -> CSV -> JSON with inference and nesting', () => {
  const data = [
    { id: '00123', name: 'রহিম', score: 88.5, active: true, address: { city: 'ঢাকা', zip: '1207' }, tags: ['a', 'b'] },
    { id: '00124', name: 'Karim, Jr.', score: null, active: false, address: { city: 'Chattogram', zip: '4000' }, tags: [] },
  ];
  const csv = C.jsonToCsv(data);
  const back = C.csvToJson(csv, { header: true, infer: true, nest: true }).data;
  // zip "1207" becomes 1207 through inference (it is a plain integer); everything else is exact.
  back.forEach((r) => { r.address.zip = String(r.address.zip); });
  assert.deepStrictEqual(back, data);
  for (const d of [';', '\t', '|']) {
    const again = C.csvToJson(C.jsonToCsv(data, { delimiter: d }), { delimiter: d, nest: true, infer: true }).data;
    assert.strictEqual(again[1].name, 'Karim, Jr.');
    assert.strictEqual(C.jsonToCsv(again, { delimiter: d }), C.jsonToCsv(back, { delimiter: d }));
  }
});

test('handles a ~5 MB file quickly', () => {
  const line = '00123,রহিম উদ্দিন,"ঢাকা, বাংলাদেশ",88.5,true\n';
  const big = 'id,name,addr,score,ok\n' + line.repeat(Math.ceil(5e6 / line.length));
  const t0 = Date.now();
  const r = C.csvToJson(big, { infer: true });
  const ms = Date.now() - t0;
  assert.ok(r.rowCount > 60000);
  assert.deepStrictEqual(r.data[0], { id: '00123', name: 'রহিম উদ্দিন', addr: 'ঢাকা, বাংলাদেশ', score: 88.5, ok: true });
  assert.ok(ms < 3000, 'took ' + ms + 'ms');
  const back = C.jsonToCsv(r.data);
  assert.ok(back.length > 4e6);
});
