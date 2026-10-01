// Taka in Words helpers. Pure functions; unit-tested in tests/taka.test.js.
// Uses the South Asian system (hazar, lakh, crore). Amounts above the crore
// are written as a multiple of crore, e.g. 9,999 crore.
(function (root) {
  'use strict';

  const MAX_INT = 99999999999n; // 99,99,99,99,999

  // Bangla names for 0-99 (irregular, so a full table).
  const BN = ('শূন্য এক দুই তিন চার পাঁচ ছয় সাত আট নয় ' +
    'দশ এগারো বারো তেরো চৌদ্দ পনেরো ষোলো সতেরো আঠারো ঊনিশ ' +
    'বিশ একুশ বাইশ তেইশ চব্বিশ পঁচিশ ছাব্বিশ সাতাশ আটাশ ঊনত্রিশ ' +
    'ত্রিশ একত্রিশ বত্রিশ তেত্রিশ চৌত্রিশ পঁয়ত্রিশ ছত্রিশ সাঁইত্রিশ আটত্রিশ ঊনচল্লিশ ' +
    'চল্লিশ একচল্লিশ বিয়াল্লিশ তেতাল্লিশ চুয়াল্লিশ পঁয়তাল্লিশ ছেচল্লিশ সাতচল্লিশ আটচল্লিশ ঊনপঞ্চাশ ' +
    'পঞ্চাশ একান্ন বাহান্ন তিপ্পান্ন চুয়ান্ন পঞ্চান্ন ছাপ্পান্ন সাতান্ন আটান্ন ঊনষাট ' +
    'ষাট একষট্টি বাষট্টি তেষট্টি চৌষট্টি পঁয়ষট্টি ছেষট্টি সাতষট্টি আটষট্টি ঊনসত্তর ' +
    'সত্তর একাত্তর বাহাত্তর তিয়াত্তর চুয়াত্তর পঁচাত্তর ছিয়াত্তর সাতাত্তর আটাত্তর ঊনআশি ' +
    'আশি একাশি বিরাশি তিরাশি চুরাশি পঁচাশি ছিয়াশি সাতাশি অষ্টাশি ঊননব্বই ' +
    'নব্বই একানব্বই বিরানব্বই তিরানব্বই চুরানব্বই পঁচানব্বই ছিয়ানব্বই সাতানব্বই আটানব্বই নিরানব্বই').split(' ');

  const EN_ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const EN_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

  function toBnDigits(s) {
    return String(s).replace(/[0-9]/g, (d) => BN_DIGITS[d]);
  }
  function toEnDigits(s) {
    return String(s).replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
  }

  function en99(n) {
    if (n < 20) return EN_ONES[n];
    return EN_TENS[Math.floor(n / 10)] + (n % 10 ? '-' + EN_ONES[n % 10] : '');
  }
  // 1..9999 -> words (thousands, hundreds, rest). Used for the crore multiple too.
  function en9999(n) {
    const parts = [];
    const th = Math.floor(n / 1000), h = Math.floor((n % 1000) / 100), r = n % 100;
    if (th) parts.push(en99(th) + ' Thousand');
    if (h) parts.push(EN_ONES[h] + ' Hundred');
    if (r) parts.push(en99(r));
    return parts.join(' ');
  }
  function bn9999(n) {
    const parts = [];
    const th = Math.floor(n / 1000), h = Math.floor((n % 1000) / 100), r = n % 100;
    if (th) parts.push(BN[th] + ' হাজার');
    if (h) parts.push(BN[h] + ' শো');
    if (r) parts.push(BN[r]);
    return parts.join(' ');
  }

  // Split a non-negative integer (<= MAX_INT) into crore multiple, lakh, thousand, rest.
  function split(n) {
    const v = BigInt(n);
    return {
      crore: Number(v / 10000000n),
      lakh: Number((v / 100000n) % 100n),
      thousand: Number((v / 1000n) % 100n),
      rest: Number(v % 1000n),
    };
  }

  function bnWords(n) {
    const v = BigInt(n);
    if (v === 0n) return BN[0];
    const s = split(v), parts = [];
    if (s.crore) parts.push(bn9999(s.crore) + ' কোটি');
    if (s.lakh) parts.push(BN[s.lakh] + ' লক্ষ');
    if (s.thousand) parts.push(BN[s.thousand] + ' হাজার');
    if (s.rest) parts.push(bn9999(s.rest));
    return parts.join(' ');
  }

  function enWords(n) {
    const v = BigInt(n);
    if (v === 0n) return EN_ONES[0];
    const s = split(v), parts = [];
    if (s.crore) parts.push(en9999(s.crore) + ' Crore');
    if (s.lakh) parts.push(en99(s.lakh) + ' Lakh');
    if (s.thousand) parts.push(en99(s.thousand) + ' Thousand');
    if (s.rest) parts.push(en9999(s.rest));
    return parts.join(' ');
  }

  // 1234567 -> "12,34,567"
  function groupLakh(intStr) {
    const s = String(intStr).replace(/^0+(?=\d)/, '');
    if (s.length <= 3) return s;
    const head = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return head + ',' + s.slice(-3);
  }

  // Parse user input. Returns { ok:true, int:BigInt, paisa:number } or { ok:false, error }.
  // error is 'empty' | 'invalid' | 'negative' | 'toolarge'. More than two decimals round half up.
  function parse(input) {
    let s = toEnDigits(String(input == null ? '' : input)).trim().replace(/,/g, '').replace(/\s+/g, '');
    if (s === '') return { ok: false, error: 'empty' };
    if (/^[-−–]/.test(s)) return { ok: false, error: /^[-−–]\d*\.?\d*$/.test(s) && /\d/.test(s) ? 'negative' : 'invalid' };
    if (!/^\d*\.?\d*$/.test(s) || !/\d/.test(s)) return { ok: false, error: 'invalid' };
    const [ip, fp = ''] = s.split('.');
    let total = BigInt(ip || '0') * 100n + BigInt((fp + '00').slice(0, 2));
    if (fp.length > 2 && fp.charCodeAt(2) >= 53) total += 1n; // third decimal digit >= 5
    const int = total / 100n;
    if (int > MAX_INT) return { ok: false, error: 'toolarge' };
    return { ok: true, int, paisa: Number(total % 100n) };
  }

  // Full conversion. opts.only (default true) adds "মাত্র" / "Only".
  function convert(input, opts) {
    const only = !opts || opts.only !== false;
    const p = parse(input);
    if (!p.ok) return p;
    const { int, paisa } = p;
    const bn = [], en = [];
    if (int > 0n || paisa === 0) {
      bn.push(bnWords(int) + ' টাকা');
      en.push(enWords(int) + ' Taka');
    }
    if (paisa > 0) {
      bn.push(BN[paisa] + ' পয়সা');
      en.push(en99(paisa) + ' Paisa');
    }
    const intStr = int.toString();
    const fmt = groupLakh(intStr) + (paisa ? '.' + String(paisa).padStart(2, '0') : '');
    return {
      ok: true,
      int,
      paisa,
      bn: bn.join(' ') + (only ? ' মাত্র' : ''),
      en: en.join(' and ') + (only ? ' Only' : ''),
      formatted: fmt,
      formattedBn: toBnDigits(fmt),
    };
  }

  const api = { MAX_INT, parse, convert, bnWords, enWords, groupLakh, toBnDigits, toEnDigits };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JBTAKA = api;
})(typeof self !== 'undefined' ? self : this);
