const test = require('node:test');
const assert = require('node:assert');
const U = require('../public/lib/uuid-core.js');

const fixed = (byte) => () => new Uint8Array(16).fill(byte);

test('v4 sets version and variant bits', () => {
  assert.strictEqual(U.v4(fixed(0xff)), 'ffffffff-ffff-4fff-bfff-ffffffffffff');
  assert.strictEqual(U.v4(fixed(0x00)), '00000000-0000-4000-8000-000000000000');
});

test('v7 encodes the millisecond timestamp and sorts by time', () => {
  const a = U.v7(1700000000000, fixed(0));
  assert.strictEqual(a.slice(0, 13), '018bcfe5-6800');
  assert.strictEqual(a[14], '7');
  assert.strictEqual(U.inspect(a).timestampMs, 1700000000000);
  assert.ok(U.v7(1700000000001, fixed(0)) > a);
});

test('inspect accepts common spellings and reports version/variant', () => {
  const r = U.inspect('{550E8400E29B41D4A716446655440000}');
  assert.deepStrictEqual(r, { valid: true, canonical: '550e8400-e29b-41d4-a716-446655440000', version: 4, variant: 'rfc' });
  assert.strictEqual(U.inspect('urn:uuid:550e8400-e29b-41d4-a716-446655440000').valid, true);
  assert.strictEqual(U.inspect('00000000-0000-0000-0000-000000000000').variant, 'nil');
  assert.strictEqual(U.inspect('not-a-uuid').valid, false);
  assert.strictEqual(U.inspect('550e8400-e29b-41d4-a716-44665544000').valid, false);
});

test('inspect decodes v1 timestamps', () => {
  // 2023-11-14T22:13:20.000Z
  const r = U.inspect('04afc000-833b-11ee-8000-000000000000');
  assert.strictEqual(r.version, 1);
  assert.strictEqual(new Date(r.timestampMs).toISOString(), '2023-11-14T22:13:20.000Z');
});

test('format options', () => {
  const id = '550e8400-e29b-41d4-a716-446655440000';
  assert.strictEqual(U.format(id, { uppercase: true, hyphens: false }), '550E8400E29B41D4A716446655440000');
  assert.strictEqual(U.format(id, { braces: true }), '{550e8400-e29b-41d4-a716-446655440000}');
});
