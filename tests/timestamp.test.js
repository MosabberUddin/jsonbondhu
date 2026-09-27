const test = require('node:test');
const assert = require('node:assert');
const T = require('../public/lib/timestamp-core.js');

const T0 = 1700000000; // 2023-11-14T22:13:20Z

test('auto-detects seconds, milliseconds, microseconds and nanoseconds', () => {
  const cases = [
    ['1700000000', 's'],
    ['1700000000000', 'ms'],
    ['1700000000000000', 'us'],
    ['1700000000000000000', 'ns'],
  ];
  for (const [input, unit] of cases) {
    const r = T.parse(input);
    assert.strictEqual(r.ok, true, input);
    assert.strictEqual(r.unit, unit, input);
    assert.strictEqual(r.detected, true);
    assert.strictEqual(r.ms, T0 * 1000, input);
    assert.strictEqual(r.seconds, String(T0));
    assert.strictEqual(r.millis, String(T0 * 1000));
  }
  assert.strictEqual(T.parse('0').unit, 's');
  assert.strictEqual(T.parse('99999999999').unit, 's'); // year 5138 in seconds
});

test('manual unit override', () => {
  const r = T.parse('1700000000', 'ms');
  assert.strictEqual(r.unit, 'ms');
  assert.strictEqual(r.detected, false);
  assert.strictEqual(T.iso(r.ms), '1970-01-20T16:13:20.000Z');
});

test('keeps sub-second precision and floors negatives correctly', () => {
  const r = T.parse('1700000000.123456');
  assert.strictEqual(r.ms, 1700000000123);
  assert.ok(Math.abs(r.fracMs - 0.456) < 1e-9);
  const n = T.parse('-1.5');
  assert.strictEqual(n.ms, -1500);
  assert.strictEqual(n.seconds, '-2');
  assert.strictEqual(T.iso(n.ms), '1969-12-31T23:59:58.500Z');
  const ns = T.parse('1700000000123456789');
  assert.strictEqual(ns.ms, 1700000000123);
  assert.ok(Math.abs(ns.fracMs - 0.456789) < 1e-9);
});

test('negative timestamps (before 1970)', () => {
  const r = T.parse('-86400');
  assert.strictEqual(T.iso(r.ms), '1969-12-31T00:00:00.000Z');
  assert.strictEqual(T.rfc2822(r.ms), 'Wed, 31 Dec 1969 00:00:00 +0000');
  assert.strictEqual(T.parse('-1000000000000').unit, 'ms');
});

test('accepts separators and Bangla digits; rejects junk', () => {
  assert.strictEqual(T.parse(' 1,700,000,000 ').ms, T0 * 1000);
  assert.strictEqual(T.parse('1_700_000_000').ms, T0 * 1000);
  assert.strictEqual(T.parse('১৭০০০০০০০০').ms, T0 * 1000);
  assert.deepStrictEqual(T.parse(''), { ok: false, error: 'empty' });
  assert.strictEqual(T.parse('abc').error, 'invalid');
  assert.strictEqual(T.parse('1e9').error, 'invalid');
  assert.strictEqual(T.parse('12-34').error, 'invalid');
});

test('out-of-range values are reported, the edge of the Date range works', () => {
  assert.strictEqual(T.parse('8640000000000001', 'ms').error, 'range');
  assert.strictEqual(T.parse('99999999999999999999999').error, 'range');
  const max = T.parse('8640000000000', 's');
  assert.strictEqual(max.ok, true);
  assert.strictEqual(T.iso(max.ms), '+275760-09-13T00:00:00.000Z');
  assert.strictEqual(T.parse('-8640000000000', 's').ok, true);
});

test('Year 2038: int32 flag', () => {
  assert.strictEqual(T.parse('2147483647').int32, true);
  assert.strictEqual(T.iso(T.parse('2147483647').ms), '2038-01-19T03:14:07.000Z');
  assert.strictEqual(T.parse('2147483648').int32, false);
  assert.strictEqual(T.parse('-2147483648').int32, true);
});

test('RFC 2822 and HTTP dates', () => {
  assert.strictEqual(T.rfc2822(T0 * 1000), 'Tue, 14 Nov 2023 22:13:20 +0000');
  assert.strictEqual(T.httpDate(T0 * 1000), 'Tue, 14 Nov 2023 22:13:20 GMT');
  assert.strictEqual(T.httpDate(T0 * 1000), new Date(T0 * 1000).toUTCString());
});

test('time zone offsets: Dhaka is UTC+6 (and was +7 during 2009 DST)', () => {
  assert.strictEqual(T.zoneOffsetMs(T0 * 1000, 'Asia/Dhaka'), 6 * 3600000);
  assert.strictEqual(T.zoneOffsetMs(T0 * 1000, 'UTC'), 0);
  assert.strictEqual(T.zoneOffsetMs(Date.UTC(2009, 7, 1), 'Asia/Dhaka'), 7 * 3600000);
  assert.strictEqual(T.zoneOffsetMs(Date.UTC(2023, 6, 1), 'America/New_York'), -4 * 3600000);
  assert.strictEqual(T.zoneOffsetMs(Date.UTC(2023, 0, 1), 'Asia/Kolkata'), 5.5 * 3600000);
});

test('date-time in a zone -> Unix time', () => {
  assert.strictEqual(T.zonedToEpoch('2023-11-14T22:13:20', 'UTC'), T0 * 1000);
  assert.strictEqual(T.zonedToEpoch('2023-11-15T04:13:20', 'Asia/Dhaka'), T0 * 1000);
  assert.strictEqual(T.zonedToEpoch('2023-11-15T04:13', 'Asia/Dhaka'), (T0 - 20) * 1000);
  assert.strictEqual(T.zonedToEpoch('2023-11-15T04:13:20.5', 'Asia/Dhaka'), T0 * 1000 + 500);
  assert.strictEqual(T.zonedToEpoch('1970-01-01T06:00', 'Asia/Dhaka'), 0);
  assert.strictEqual(T.zonedToEpoch('1969-12-31T23:59:59', 'UTC'), -1000);
  assert.strictEqual(T.zonedToEpoch('0050-06-01T00:00', 'UTC'), Date.parse('0050-06-01T00:00:00Z'));
  // DST: 2023-07-01 12:00 in New York is 16:00 UTC
  assert.strictEqual(T.zonedToEpoch('2023-07-01T12:00', 'America/New_York'), Date.UTC(2023, 6, 1, 16));
  assert.strictEqual(T.zonedToEpoch('2023-02-31T00:00', 'UTC'), null);
  assert.strictEqual(T.zonedToEpoch('nonsense', 'UTC'), null);
  assert.strictEqual(T.zonedToEpoch('', 'UTC'), null);
});

test('relative time', () => {
  assert.deepStrictEqual(T.relative(0), { value: 0, unit: 'second' });
  assert.deepStrictEqual(T.relative(2 * 3600000 + 5), { value: 2, unit: 'hour' });
  assert.deepStrictEqual(T.relative(-3 * 86400000), { value: -3, unit: 'day' });
  assert.deepStrictEqual(T.relative(-60 * 86400000), { value: -1, unit: 'month' });
  assert.deepStrictEqual(T.relative(10 * 365.25 * 86400000), { value: 10, unit: 'year' });
});

test('formats in fixed time zones for English and Bangla', () => {
  const ms = T0 * 1000;
  const en = T.formatIn(ms, 'en', 'UTC');
  assert.match(en, /Tue/);
  assert.match(en, /14 Nov 2023/);
  assert.match(en, /22:13:20/);
  assert.match(en, /UTC/);
  const dhaka = T.formatIn(ms, 'en', 'Asia/Dhaka');
  assert.match(dhaka, /Wed/);
  assert.match(dhaka, /15 Nov 2023/);
  assert.match(dhaka, /04:13:20/);
  assert.match(dhaka, /GMT\+6/);
  const bn = T.formatIn(ms, 'bn', 'Asia/Dhaka');
  assert.match(bn, /১৫/);
  assert.match(bn, /২০২৩/);
  assert.match(bn, /০৪:১৩:২০/);
  assert.match(T.formatIn(ms + 250, 'en', 'UTC'), /22:13:20\.250/);
  assert.match(T.formatIn(-86400000, 'en', 'UTC'), /31 Dec 1969/);
});
