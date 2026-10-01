const test = require('node:test');
const assert = require('node:assert');
const T = require('../public/lib/taka-core.js');

const bn = (s, o) => T.convert(s, o).bn;
const en = (s, o) => T.convert(s, o).en;

test('Bangla names 0-99 are correct and complete', () => {
  const expected = { 0: 'শূন্য', 1: 'এক', 2: 'দুই', 9: 'নয়', 10: 'দশ', 11: 'এগারো', 12: 'বারো', 15: 'পনেরো', 16: 'ষোলো', 19: 'ঊনিশ',
    20: 'বিশ', 21: 'একুশ', 22: 'বাইশ', 25: 'পঁচিশ', 29: 'ঊনত্রিশ', 30: 'ত্রিশ', 31: 'একত্রিশ', 35: 'পঁয়ত্রিশ', 39: 'ঊনচল্লিশ',
    40: 'চল্লিশ', 49: 'ঊনপঞ্চাশ', 50: 'পঞ্চাশ', 51: 'একান্ন', 59: 'ঊনষাট', 60: 'ষাট', 69: 'ঊনসত্তর', 70: 'সত্তর', 79: 'ঊনআশি',
    80: 'আশি', 88: 'অষ্টাশি', 89: 'ঊননব্বই', 90: 'নব্বই', 91: 'একানব্বই', 99: 'নিরানব্বই' };
  for (const [n, w] of Object.entries(expected)) assert.strictEqual(T.bnWords(n), w, n);
  assert.strictEqual(new Set(Array.from({ length: 100 }, (_, i) => T.bnWords(i))).size, 100);
});

test('zero and small amounts', () => {
  assert.strictEqual(bn('0'), 'শূন্য টাকা মাত্র');
  assert.strictEqual(en('0'), 'Zero Taka Only');
  assert.strictEqual(bn('1'), 'এক টাকা মাত্র');
  assert.strictEqual(en('1'), 'One Taka Only');
  assert.strictEqual(bn('10'), 'দশ টাকা মাত্র');
  assert.strictEqual(bn('11'), 'এগারো টাকা মাত্র');
  assert.strictEqual(en('11'), 'Eleven Taka Only');
  assert.strictEqual(bn('21'), 'একুশ টাকা মাত্র');
  assert.strictEqual(en('21'), 'Twenty-One Taka Only');
  assert.strictEqual(bn('99'), 'নিরানব্বই টাকা মাত্র');
  assert.strictEqual(en('99'), 'Ninety-Nine Taka Only');
});

test('hundreds, thousands, lakhs, crores', () => {
  assert.strictEqual(bn('100'), 'এক শো টাকা মাত্র');
  assert.strictEqual(en('100'), 'One Hundred Taka Only');
  assert.strictEqual(bn('101'), 'এক শো এক টাকা মাত্র');
  assert.strictEqual(bn('1000'), 'এক হাজার টাকা মাত্র');
  assert.strictEqual(en('1000'), 'One Thousand Taka Only');
  assert.strictEqual(bn('100000'), 'এক লক্ষ টাকা মাত্র');
  assert.strictEqual(en('100000'), 'One Lakh Taka Only');
  assert.strictEqual(bn('100000000'), 'দশ কোটি টাকা মাত্র');
  assert.strictEqual(en('100000000'), 'Ten Crore Taka Only');
  assert.strictEqual(bn('10000000'), 'এক কোটি টাকা মাত্র');
  assert.strictEqual(bn('12345678'),
    'এক কোটি তেইশ লক্ষ পঁয়তাল্লিশ হাজার ছয় শো আটাত্তর টাকা মাত্র');
  assert.strictEqual(en('12345678'),
    'One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight Taka Only');
  assert.strictEqual(bn('12000500'), 'এক কোটি বিশ লক্ষ পাঁচ শো টাকা মাত্র');
});

test('above one hundred crore uses crore multiples, up to the cap', () => {
  assert.strictEqual(bn('99,99,99,99,999'),
    'নয় হাজার নয় শো নিরানব্বই কোটি নিরানব্বই লক্ষ নিরানব্বই হাজার নয় শো নিরানব্বই টাকা মাত্র');
  assert.strictEqual(en('99,99,99,99,999'),
    'Nine Thousand Nine Hundred Ninety-Nine Crore Ninety-Nine Lakh Ninety-Nine Thousand Nine Hundred Ninety-Nine Taka Only');
  assert.strictEqual(bn('1000000000'), 'এক শো কোটি টাকা মাত্র');
  assert.strictEqual(en('1000000000'), 'One Hundred Crore Taka Only');
});

test('limit is enforced', () => {
  assert.strictEqual(T.parse('100000000000').error, 'toolarge');
  assert.strictEqual(T.parse('99999999999.99').ok, true);
  assert.strictEqual(T.parse('99999999999.995').error, 'toolarge');
});

test('decimals become paisa', () => {
  assert.strictEqual(bn('0.05'), 'পাঁচ পয়সা মাত্র');
  assert.strictEqual(en('0.05'), 'Five Paisa Only');
  assert.strictEqual(bn('.5'), 'পঞ্চাশ পয়সা মাত্র');
  assert.strictEqual(bn('0.99'), 'নিরানব্বই পয়সা মাত্র');
  assert.strictEqual(bn('1.5'), 'এক টাকা পঞ্চাশ পয়সা মাত্র');
  assert.strictEqual(en('1.5'), 'One Taka and Fifty Paisa Only');
  assert.strictEqual(bn('1234567.50'), 'বারো লক্ষ চৌত্রিশ হাজার পাঁচ শো সাতষট্টি টাকা পঞ্চাশ পয়সা মাত্র');
  assert.strictEqual(bn('5.00'), 'পাঁচ টাকা মাত্র');
  assert.strictEqual(bn('5.'), 'পাঁচ টাকা মাত্র');
});

test('more than two decimals round half up, with carry', () => {
  assert.strictEqual(T.convert('1.234').paisa, 23);
  assert.strictEqual(T.convert('1.235').paisa, 24);
  assert.strictEqual(T.convert('1.999').int, 2n);
  assert.strictEqual(T.convert('1.999').paisa, 0);
  assert.strictEqual(en('0.004'), 'Zero Taka Only');
  assert.strictEqual(en('0.005'), 'One Paisa Only');
  assert.strictEqual(en('0.994'), 'Ninety-Nine Paisa Only');
  assert.strictEqual(en('0.995'), 'One Taka Only');
});

test('only suffix is optional', () => {
  assert.strictEqual(bn('5', { only: false }), 'পাঁচ টাকা');
  assert.strictEqual(en('5', { only: false }), 'Five Taka');
  assert.strictEqual(en('5.25', { only: false }), 'Five Taka and Twenty-Five Paisa');
  assert.strictEqual(bn('5', { only: true }), 'পাঁচ টাকা মাত্র');
});

test('Bangla digits, commas and spaces are accepted', () => {
  assert.strictEqual(bn('১২,৩৪,৫৬৭.৫০'), bn('1234567.50'));
  assert.strictEqual(bn(' ১০০ '), 'এক শো টাকা মাত্র');
  assert.strictEqual(en('1,00,000'), 'One Lakh Taka Only');
  assert.strictEqual(en('১২৩.৪৫'), 'One Hundred Twenty-Three Taka and Forty-Five Paisa Only');
  assert.strictEqual(en('1,234,567'), en('12,34,567'));
});

test('lakh/crore grouping in both digit scripts', () => {
  const r = T.convert('1234567.5');
  assert.strictEqual(r.formatted, '12,34,567.50');
  assert.strictEqual(r.formattedBn, '১২,৩৪,৫৬৭.৫০');
  assert.strictEqual(T.convert('0').formatted, '0');
  assert.strictEqual(T.convert('999').formatted, '999');
  assert.strictEqual(T.convert('1000').formatted, '1,000');
  assert.strictEqual(T.convert('100000').formatted, '1,00,000');
  assert.strictEqual(T.convert('10000000').formatted, '1,00,00,000');
  assert.strictEqual(T.convert('99999999999').formatted, '99,99,99,99,999');
  assert.strictEqual(T.convert('0007').formatted, '7');
  assert.strictEqual(T.groupLakh('123456789'), '12,34,56,789');
});

test('invalid, empty and negative input', () => {
  for (const bad of ['abc', '1.2.3', '12a', '--5', '.', '..', '1e5', '$5', '১২ক']) {
    assert.deepStrictEqual(T.convert(bad), { ok: false, error: 'invalid' }, bad);
  }
  assert.strictEqual(T.convert('').error, 'empty');
  assert.strictEqual(T.convert('   ').error, 'empty');
  assert.strictEqual(T.convert(null).error, 'empty');
  assert.strictEqual(T.convert('-5').error, 'negative');
  assert.strictEqual(T.convert('-0.5').error, 'negative');
  assert.strictEqual(T.convert('-').error, 'invalid');
});

test('digit helpers', () => {
  assert.strictEqual(T.toBnDigits('0123456789'), '০১২৩৪৫৬৭৮৯');
  assert.strictEqual(T.toEnDigits('০১২৩৪৫৬৭৮৯'), '0123456789');
});
