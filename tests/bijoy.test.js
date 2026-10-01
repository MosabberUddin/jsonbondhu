const test = require('node:test');
const assert = require('node:assert');
const B = require('../public/lib/bijoy-core.js');

// Expected Unicode strings use the precomposed য় / ড় / ঢ় (U+09DF / U+09DC / U+09DD),
// which is what the converter emits and what keyboards produce.
const YA = 'য়';

// Known Bijoy <-> Unicode pairs, in the standard SutonnyMJ layout.
const PAIRS = [
  ['Avwg evsjvq Mvb MvB', `আমি বাংলা${YA} গান গাই`], // basic letters, i-kar before consonant
  ['evsjv', 'বাংলা'],
  ['wKš‘', 'কিন্তু'],           // i-kar + conjunct ntu
  ['Av', 'আ'],
  ['A', 'অ'],
  ['AvB', 'আই'],
  ['‡Kv_vq', `কোথা${YA}`],       // e-kar + aa-kar -> o-kar
  ['‡KŠkj', 'কৌশল'],             // e-kar + au length mark -> au-kar
  ['‡K', 'কে'],
  ['ˆK', 'কৈ'],
  ['Kg©', 'কর্ম'],               // reph
  ['m~h©', 'সূর্য'],
  ['`yb©xwZ', 'দুর্নীতি'],        // reph before ii-kar
  ['mvg_©¨', 'সামর্থ্য'],         // reph with ya-phala
  ['e¨envi', 'ব্যবহার'],           // ya-phala
  ['cÖ_g', 'প্রথম'],              // ra-phala
  ['MÖvg', 'গ্রাম'],
  ['`ªæZ', 'দ্রুত'],              // lower ra-phala with u-kar
  ['ivóª', 'রাষ্ট্র'],
  ['gš¿x', 'মন্ত্রী'],
  ['A¯¿', 'অস্ত্র'],
  ['¯’vb', 'স্থান'],
  ['hZœ', 'যত্ন'],
  ['Rb¥', 'জন্ম'],
  ['cÖkœ', 'প্রশ্ন'],
  ['wek^', 'বিশ্ব'],
  ['Zvi¯^‡i', 'তারস্বরে'],
  ['n„`q', `হৃদ${YA}`],
  ['ïay', 'শুধু'],
  ['‡`k', 'দেশ'],
  ['‡`‡ki', 'দেশের'],
  ['12|', '১২।'],
  ['evsjv‡`k 2024', 'বাংলাদেশ ২০২৪'],
];

test('Bijoy -> Unicode known pairs', () => {
  for (const [bijoy, unicode] of PAIRS) {
    assert.strictEqual(B.bijoyToUnicode(bijoy), unicode, `bijoy "${bijoy}"`);
  }
});

test('Unicode -> Bijoy known pairs', () => {
  for (const [bijoy, unicode] of PAIRS) {
    assert.strictEqual(B.unicodeToBijoy(unicode), bijoy, `unicode "${unicode}"`);
  }
});

test('headline example from the spec', () => {
  assert.strictEqual(B.bijoyToUnicode('Avwg evsjvq Mvb MvB').normalize('NFD'), 'আমি বাংলায় গান গাই'.normalize('NFD'));
  assert.strictEqual(B.bijoyToUnicode('evsjv'), 'বাংলা');
  assert.strictEqual(B.bijoyToUnicode('wKš‘'), 'কিন্তু');
});

test('pre-kars move after the consonant cluster, including conjuncts', () => {
  assert.strictEqual(B.bijoyToUnicode('wKš‘'), 'কিন্তু');
  assert.strictEqual(B.bijoyToUnicode('‡Kš‘'), 'কেন্তু');
  assert.strictEqual(B.bijoyToUnicode('w`b'), 'দিন');
  assert.strictEqual(B.bijoyToUnicode('‡cÖg'), 'প্রেম');
  assert.strictEqual(B.unicodeToBijoy('প্রেম'), '‡cÖg');
  assert.strictEqual(B.unicodeToBijoy('কিন্তু'), 'wKš‘');
});

test('reph attaches to the following consonant and is not a conjunct', () => {
  assert.strictEqual(B.bijoyToUnicode('Kg©'), 'ক' + 'র্ম');
  assert.strictEqual(B.unicodeToBijoy('কর্ম'), 'Kg©');
  assert.strictEqual(B.unicodeToBijoy('ধর্ম'), 'ag©');
  assert.strictEqual(B.bijoyToUnicode('ag©'), 'ধর্ম');
});

test('ra + ya-phala is stored with ZWJ so it does not turn into a reph', () => {
  const u = B.bijoyToUnicode('i¨vc');
  assert.strictEqual(u, 'র‍্যাপ');
  assert.strictEqual(B.unicodeToBijoy(u), 'i¨vc');
  assert.notStrictEqual(B.unicodeToBijoy('র্যাব'), B.unicodeToBijoy(u));
});

test('digits and punctuation', () => {
  assert.strictEqual(B.bijoyToUnicode('0123456789'), '০১২৩৪৫৬৭৮৯');
  assert.strictEqual(B.unicodeToBijoy('০১২৩৪৫৬৭৮৯'), '0123456789');
  assert.strictEqual(B.bijoyToUnicode('Avwg, Zywg|'), 'আমি, তুমি।');
  assert.strictEqual(B.unicodeToBijoy('আমি, তুমি।'), 'Avwg, Zywg|');
  assert.strictEqual(B.bijoyToUnicode('ÔevsjvÕ'), '‘বাংলা’');
});

test('anusvara, visarga, candrabindu, khanda-ta', () => {
  assert.strictEqual(B.bijoyToUnicode('msL¨v'), 'সংখ্যা');
  assert.strictEqual(B.bijoyToUnicode('`yt‡L'), 'দুঃখে');
  assert.strictEqual(B.bijoyToUnicode('Pvu`'), 'চাঁদ');
  assert.strictEqual(B.bijoyToUnicode('rrr'), 'ৎৎৎ');
});

test('decomposed nukta letters are accepted as input', () => {
  assert.strictEqual(B.unicodeToBijoy('বায়'), 'evq');
  assert.strictEqual(B.unicodeToBijoy('বড়'), 'eo');
  assert.strictEqual(B.unicodeToBijoy('অা'), 'Av');
});

test('non-Bangla text passes through the Unicode -> Bijoy direction untouched', () => {
  assert.strictEqual(B.unicodeToBijoy('Hello, world! 123'), 'Hello, world! 123');
  assert.strictEqual(B.unicodeToBijoy('a\nb\tc'), 'a\nb\tc');
  assert.strictEqual(B.bijoyToUnicode(''), '');
  assert.strictEqual(B.bijoyToUnicode(null), '');
  assert.strictEqual(B.unicodeToBijoy(undefined), '');
});

test('multi-line input keeps its line breaks', () => {
  assert.strictEqual(B.bijoyToUnicode('evsjv\nevsjv'), 'বাংলা\nবাংলা');
});

test('stray kars and signs do not throw', () => {
  assert.doesNotThrow(() => B.bijoyToUnicode('vwx‡ˆ©¨ÖŠ'));
  assert.doesNotThrow(() => B.unicodeToBijoy('াি্‍ ্র'));
});

test('every conjunct in the table round-trips Unicode -> Bijoy -> Unicode', () => {
  const { PAIRS: P } = B._tables;
  const keys = Object.keys(P);
  assert.ok(keys.length > 40);
  for (const conj of keys) {
    const word = 'অ' + conj + 'া';
    const bijoy = B.unicodeToBijoy(word);
    assert.strictEqual(B.bijoyToUnicode(bijoy), word, `conjunct ${conj} -> ${bijoy}`);
    assert.strictEqual(B.unicodeToBijoyDetailed(word).unmapped, 0);
  }
});

test('round trip Unicode -> Bijoy -> Unicode on running text', () => {
  const samples = [
    `আমার সোনার বাংলা, আমি তোমায় ভালোবাসি। চিরদিন তোমার আকাশ, তোমার বাতাস, আমার প্রাণে বাজায় বাঁশি।`,
    `বাংলাদেশের স্বাধীনতা সংগ্রামে মুক্তিযোদ্ধাদের অবদান অবিস্মরণীয়। রাষ্ট্র, মন্ত্রী, অস্ত্র, স্থান, সম্পর্ক।`,
    `সূর্য উঠে, কর্মীরা কাজ করে। দুর্নীতি দূর হোক। ব্যবহার, ব্যক্তি, প্রশ্ন, যত্ন, বিশ্ব, জন্ম, শুধু।`,
    `কোথায় যাবে? কেন যাবে? কৌশল, শৈশব, ঐশ্বর্য, গ্রাম, ক্রম, অক্ষর, জ্ঞান, পঞ্চাশ, উচ্ছ্বাস।`,
    `ঢাকা, বড়, গাছ।`,
    `১২৩৪৫ টাকা, ৫০০।`,
  ];
  for (const s of samples) {
    const normalized = s.replace(/য়/g, YA).replace(/ড়/g, 'ড়');
    const r = B.unicodeToBijoyDetailed(normalized);
    assert.strictEqual(r.unmapped, 0, `unmapped conjuncts in: ${s}`);
    assert.strictEqual(B.bijoyToUnicode(r.text), normalized, `round trip: ${s}`);
  }
});

test('Bijoy -> Unicode -> Bijoy returns the original for text from the table', () => {
  const originals = ['Avwg evsjvq Mvb MvB', 'wKš‘ ‡Kv_vq?', 'Kg© `yb©xwZ m~h©', 'cÖ_g cÖkœ hZœ', 'MÖvg ivóª gš¿x', 'ïay ‡KŠkj'];
  for (const o of originals) assert.strictEqual(B.unicodeToBijoy(B.bijoyToUnicode(o)), o);
});

test('conjuncts without a known glyph are counted, not hidden', () => {
  const r = B.unicodeToBijoyDetailed('অক্খ');
  assert.strictEqual(r.unmapped, 1);
  assert.strictEqual(B.unicodeToBijoyDetailed('বাংলা').unmapped, 0);
});

test('looksLikeBijoy detects Bijoy text and ignores Unicode and English', () => {
  assert.strictEqual(B.looksLikeBijoy('Avwg evsjvq Mvb MvB'), true);
  assert.strictEqual(B.looksLikeBijoy('wKš‘ Avwg ‡Kv_vq hve?'), true);
  assert.strictEqual(B.looksLikeBijoy('e¨envi cÖ_g'), true);
  assert.strictEqual(B.looksLikeBijoy('আমি বাংলায় গান গাই'), false);
  assert.strictEqual(B.looksLikeBijoy('Hello world, this is plain English text.'), false);
  assert.strictEqual(B.looksLikeBijoy('Copyright © 2024 Acme'), false);
  assert.strictEqual(B.looksLikeBijoy(''), false);
});

test('hasBangla', () => {
  assert.strictEqual(B.hasBangla('abc বাংলা'), true);
  assert.strictEqual(B.hasBangla('evsjv'), false);
});
