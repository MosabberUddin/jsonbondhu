const test = require('node:test');
const assert = require('node:assert');
const T = require('../public/lib/ts-core.js');

const gen = (v, o) => T.generate(v, o);

test('maps primitives and handles top-level primitives', () => {
  assert.strictEqual(gen('x'), 'export type Root = string;\n');
  assert.strictEqual(gen(1.5), 'export type Root = number;\n');
  assert.strictEqual(gen(true), 'export type Root = boolean;\n');
  assert.strictEqual(gen(null), 'export type Root = null;\n');
  assert.strictEqual(gen('x', { exportTypes: false, rootName: 'Name' }), 'type Name = string;\n');
});

test('simple object as interface and as type', () => {
  const v = { id: 1, name: 'a', ok: true, none: null };
  assert.strictEqual(gen(v), 'export interface Root {\n  id: number;\n  name: string;\n  ok: boolean;\n  none: null;\n}\n');
  assert.strictEqual(gen(v, { style: 'type', exportTypes: false }), 'type Root = {\n  id: number;\n  name: string;\n  ok: boolean;\n  none: null;\n};\n');
});

test('readonly applies to properties and arrays', () => {
  const r = gen({ a: [1], b: [] }, { readonly: true });
  assert.match(r, /readonly a: readonly number\[\];/);
  assert.match(r, /readonly b: readonly unknown\[\];/);
  assert.strictEqual(gen([1, 'a'], { readonly: true }), 'export type Root = readonly (string | number)[];\n');
});

test('nested objects become PascalCase named interfaces', () => {
  const r = gen({ user_address: { geo_point: { lat: 1 } } });
  assert.match(r, /user_address: UserAddress;/);
  assert.match(r, /interface UserAddress \{\n  geo_point: GeoPoint;\n\}/);
  assert.match(r, /interface GeoPoint \{\n  lat: number;\n\}/);
});

test('root is declared first', () => {
  assert.ok(gen({ a: { b: 1 } }).startsWith('export interface Root {'));
});

test('array of objects merges; missing keys become optional', () => {
  const r = gen({ items: [{ id: 1, a: 'x' }, { id: 2, b: true }] });
  assert.match(r, /items: Item\[\];/);
  assert.match(r, /interface Item \{\n  id: number;\n  a\?: string;\n  b\?: boolean;\n\}/);
});

test('optional merging off keeps different shapes as union members', () => {
  const r = gen({ items: [{ id: 1, a: 'x' }, { id: 2, b: true }, { id: 3, a: 'y' }] }, { optional: false });
  assert.match(r, /items: \(Item \| Item2\)\[\];/);
  assert.match(r, /interface Item \{\n  id: number;\n  a: string;\n\}/);
  assert.match(r, /interface Item2 \{\n  id: number;\n  b: boolean;\n\}/);
  assert.ok(!r.includes('?:'));
});

test('null merged with a type becomes T | null', () => {
  assert.match(gen({ a: [{ x: 'p' }, { x: null }] }), /x: string \| null;/);
  assert.match(gen({ a: ['s', null] }), /a: \(string \| null\)\[\];/);
  assert.match(gen({ a: [{ x: 1 }, {}] }), /x\?: number;/);
});

test('missing and null combine into an optional nullable key', () => {
  assert.match(gen([{ k: null }, {}, { k: 'v' }]), /k\?: string \| null;/);
});

test('mixed arrays become unions, empty arrays unknown[]', () => {
  const r = gen({ m: [1, 'a', true, null], e: [], n: [[1], ['a']], z: [[]] });
  assert.match(r, /m: \(string \| number \| boolean \| null\)\[\];/);
  assert.match(r, /e: unknown\[\];/);
  assert.match(r, /n: \(string \| number\)\[\]\[\];/);
  assert.match(r, /z: unknown\[\]\[\];/);
});

test('empty array merged with typed array takes the typed element', () => {
  assert.match(gen({ a: [[], [1]] }), /a: number\[\]\[\];/);
});

test('empty object becomes Record<string, unknown>', () => {
  assert.match(gen({ a: {} }), /a: Record<string, unknown>;/);
  assert.strictEqual(gen({}), 'export type Root = Record<string, unknown>;\n');
});

test('identical shapes share one type', () => {
  const r = gen({ home: { city: 'a' }, work: { city: 'b' } });
  assert.match(r, /home: Home;/);
  assert.match(r, /work: Home;/);
  assert.strictEqual((r.match(/interface /g) || []).length, 2);
});

test('name clashes with different shapes get numeric suffixes', () => {
  const r = gen({ a: { item: { x: 1 } }, b: { item: { y: 1 } }, c: { item: { z: 1 } } });
  assert.match(r, /interface Item \{\n  x: number;/);
  assert.match(r, /interface Item2 \{\n  y: number;/);
  assert.match(r, /interface Item3 \{\n  z: number;/);
});

test('child named like the root does not collide with it', () => {
  const r = gen({ root: { a: 1 } });
  assert.match(r, /root: Root2;/);
  assert.match(r, /interface Root2 \{/);
});

test('nested names avoid shadowing globals', () => {
  assert.match(gen({ date: { y: 1 } }), /date: Date2;/);
});

test('keys that are not identifiers are quoted', () => {
  const r = gen({ 'my-key': 1, 'a b': 2, '1x': 3, '': 4, ok_1: 5, $dollar: 6, 'quo"te': 7 });
  assert.match(r, /  "my-key": number;/);
  assert.match(r, /  "a b": number;/);
  assert.match(r, /  "1x": number;/);
  assert.match(r, /  "": number;/);
  assert.match(r, /  ok_1: number;/);
  assert.match(r, /  \$dollar: number;/);
  assert.match(r, /  "quo\\"te": number;/);
});

test('Bangla keys stay unquoted and make Bangla type names', () => {
  const r = gen({ নাম: 'রহিম', ঠিকানা: { শহর: 'ঢাকা' } });
  assert.match(r, /  নাম: string;/);
  assert.match(r, /  ঠিকানা: ঠিকানা;/);
  assert.match(r, /interface ঠিকানা \{\n  শহর: string;\n\}/);
  assert.strictEqual(T.isIdent('নাম'), true);
  assert.strictEqual(T.isIdent('a-b'), false);
});

test('keys with only symbols still produce a valid type name', () => {
  const r = gen({ '---': { a: 1 } });
  assert.match(r, /"---": Type;/);
  assert.match(r, /interface Type \{/);
});

test('digit-leading keys give a valid type name', () => {
  assert.match(gen({ '2fa': { on: true } }), /interface _2fa \{/);
});

test('deep nesting', () => {
  const r = gen({ a: { b: { c: { d: { e: [{ f: 1 }] } } } } });
  for (const n of ['A', 'B', 'C', 'D', 'E']) assert.match(r, new RegExp('interface ' + n + ' \\{'));
  assert.match(r, /interface D \{\n  e: E\[\];\n\}/);
  assert.match(r, /interface E \{\n  f: number;\n\}/);
});

test('top-level array of objects', () => {
  const r = gen([{ id: 1 }, { id: 2, n: 'x' }]);
  assert.strictEqual(r, 'export type Root = RootItem[];\n\nexport interface RootItem {\n  id: number;\n  n?: string;\n}\n');
});

test('top-level empty array and array of primitives', () => {
  assert.strictEqual(gen([]), 'export type Root = unknown[];\n');
  assert.strictEqual(gen([1, 2]), 'export type Root = number[];\n');
});

test('custom root name is PascalCased; invalid names fall back to Root', () => {
  assert.ok(gen({ a: 1 }, { rootName: 'api_response' }).includes('interface ApiResponse {'));
  assert.ok(gen({ a: 1 }, { rootName: '***' }).includes('interface Root {'));
  assert.ok(gen([{ a: 1 }], { rootName: 'Users' }).includes('type Users = UsersItem[];'));
});

test('singular names for array elements', () => {
  assert.match(gen({ addresses: [{ a: 1 }] }), /addresses: Address\[\];/);
  assert.match(gen({ categories: [{ a: 1 }] }), /categories: Category\[\];/);
  assert.match(gen({ boxes: [{ a: 1 }] }), /boxes: Box\[\];/);
  assert.match(gen({ status: [{ a: 1 }] }), /status: Status\[\];/);
});

test('object union members inside unions render by name', () => {
  assert.match(gen({ v: [{ a: 1 }, 'x', [1]] }), /v: \(string \| V \| number\[\]\)\[\];/);
});

test('fromText parses valid JSON', () => {
  const r = T.fromText('{"a": [1, 2]}');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.code, 'export interface Root {\n  a: number[];\n}\n');
});

test('fromText reports empty input', () => {
  assert.deepStrictEqual(T.fromText('  \n'), { ok: false, empty: true, message: '' });
});

test('fromText reports invalid JSON with a location when available', () => {
  const r = T.fromText('{\n  "a": 1,\n  "b": }');
  assert.strictEqual(r.ok, false);
  assert.ok(r.message.length > 0);
  if (r.line !== undefined) assert.strictEqual(r.line, 3); // location depends on the JS engine message
  if (r.col !== undefined) assert.ok(r.col >= 1);
  assert.strictEqual(T.fromText('{"a":').ok, false);
});

test('errorLocation understands both message formats', () => {
  assert.deepStrictEqual(T.errorLocation(new Error('Unexpected token (line 4 column 9)'), ''), { line: 4, col: 9 });
  assert.deepStrictEqual(T.errorLocation(new Error('bad at position 5'), 'ab\ncdef'), { line: 2, col: 3 });
  assert.strictEqual(T.errorLocation(new Error('nope'), ''), null);
});

test('__proto__ key from JSON is handled as a normal key', () => {
  const r = T.fromText('{"__proto__": 1, "a": 2}');
  assert.strictEqual(r.ok, true);
  assert.match(r.code, /__proto__: number;/);
});
