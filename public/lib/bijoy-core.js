// Bijoy (SutonnyMJ / "ANSI") <-> Unicode Bangla. Pure functions; unit-tested in tests/bijoy.test.js.
//
// Bijoy text is ordinary Latin/Windows-1252 text drawn with a special font, so there is no
// standard to "decode": this table is the widely used Bijoy keyboard layout. Letters, kars,
// reph, ya-phala, ra-phala and the common conjunct glyphs are covered. Rare conjuncts that
// have no entry are reported (see `unmapped`) instead of being silently guessed.
(function (root) {
  'use strict';

  const HAS = '্';   // hasant (virama)
  const ZWJ = '‍';
  const ZWNJ = '‌';
  const NUKTA_DDA = 'ড়', NUKTA_DDHA = 'ঢ়', NUKTA_YA = 'য়';
  const O_KAR = 'ো', AU_KAR = 'ৌ', E_KAR = 'ে', AA_KAR = 'া', AU_LEN = 'ৗ';

  // ---------- Bijoy glyph -> Unicode ----------
  // type: v = independent letter/sign, c = consonant (plain, prefix or ready-made conjunct),
  //       h = half form that already carries its hasant, j = joiner glyph (phala or second
  //       half of a conjunct; its Unicode starts with hasant), pre = kar drawn before the
  //       consonant, post = kar drawn after it, reph = r-with-hasant mark.
  const G = Object.create(null);
  function def(type, map) { for (const k of Object.keys(map)) G[k] = { t: type, u: map[k] }; }

  def('v', {
    A: 'অ', B: 'ই', C: 'ঈ', D: 'উ', E: 'ঊ', F: 'ঋ', G: 'এ', H: 'ঐ', I: 'ও', J: 'ঔ',
    r: 'ৎ', s: 'ং', t: 'ঃ', u: 'ঁ',
  });
  def('c', {
    K: 'ক', L: 'খ', M: 'গ', N: 'ঘ', O: 'ঙ', P: 'চ', Q: 'ছ', R: 'জ', S: 'ঝ', T: 'ঞ',
    U: 'ট', V: 'ঠ', W: 'ড', X: 'ঢ', Y: 'ণ', Z: 'ত', _: 'থ', '`': 'দ', a: 'ধ', b: 'ন',
    c: 'প', d: 'ফ', e: 'ব', f: 'ভ', g: 'ম', h: 'য', i: 'র', j: 'ল', k: 'শ', l: 'ষ',
    m: 'স', n: 'হ', o: NUKTA_DDA, p: NUKTA_DDHA, q: NUKTA_YA,
  });
  // Prefix glyphs: the first consonant of a conjunct, drawn without its right-hand stem.
  def('c', { '¯': 'স', 'š': 'ন', '¤': 'ম', '™': 'দ' });
  // Ready-made conjunct glyphs.
  def('c', {
    '°': 'ক্ক', '±': 'ক্ট', '³': 'ক্ত', 'µ': 'ক্র', '¶': 'ক্ষ', '·': 'ক্ষ্ণ', '¸': 'ক্ষ্ম', '¹': 'ক্স',
    '¼': 'ঙ্ক', '½': 'ঙ্গ', '”': 'চ্ছ', 'Á': 'জ্ঞ', 'Â': 'ঞ্চ', 'Ã': 'ঞ্ছ', 'Ä': 'ঞ্জ',
    'Û': 'ণ্ড', 'Ë': 'ত্ত', 'Î': 'ত্র', 'î': 'ত্র', 'Ï': 'দ্দ', '×': 'দ্ধ', 'Ü': 'ন্ধ', 'Ý': 'ন্স',
    'ó': 'ষ্ট', '÷': 'স্ট', 'ð': 'শ্চ', 'ý': 'হ্ন', 'þ': 'হ্ম', 'ï': 'শু',
  });
  def('h', { '›': 'ন্' });
  def('pre', { '‡': 'ে', '†': 'ে', 'ˆ': 'ৈ', w: 'ি' });
  def('post', { v: 'া', x: 'ী', y: 'ু', z: 'ু', 'æ': 'ু', '~': 'ূ', 'ƒ': 'ূ', '„': 'ৃ', 'Š': 'ৗ' });
  def('j', {
    '¨': '্য', 'Ö': '্র', 'ª': '্র', '^': '্ব', '¡': '্ব', 'œ': '্ন', '¥': '্ম', '§': '্ম', 'ø': '্ল',
    '’': '্থ', 'ú': '্প', '¢': '্ভ', '‹': '্ক', 'Í': '্ত', '¿': '্ত্র', '‘': '্তু',
  });
  def('reph', { '©': 'র' + HAS });

  const DIGITS_BN = '০১২৩৪৫৬৭৮৯';
  const OTHER_B2U = { '|': '।', 'Ô': '‘', 'Õ': '’', 'Ò': '“', 'Ó': '”' };

  // ---------- Unicode -> Bijoy ----------
  const CONS = /[ক-হড়ঢ়য়]/;
  const isCons = (ch) => ch !== undefined && CONS.test(ch);

  // Plain letters (ASCII Bijoy keys only).
  const PLAIN = Object.create(null);
  const LETTER = Object.create(null); // standalone letters and signs
  for (const k of Object.keys(G)) {
    if (k.charCodeAt(0) >= 128) continue;
    if (G[k].t === 'c') PLAIN[G[k].u] = k;
    if (G[k].t === 'v') LETTER[G[k].u] = k;
  }
  LETTER['আ'] = 'Av';

  // Conjuncts: Unicode (joined with hasant) -> Bijoy text. First the ready-made glyphs...
  const PAIRS = Object.create(null);
  for (const k of Object.keys(G)) {
    if (G[k].t === 'c' && k.charCodeAt(0) >= 128 && G[k].u.includes(HAS) && !(G[k].u in PAIRS)) PAIRS[G[k].u] = k;
  }
  // ...then prefix-glyph combinations.
  Object.assign(PAIRS, {
    'স্ক': '¯‹', 'স্থ': '¯’', 'স্ত': '¯Í', 'স্ত্র': '¯¿', 'স্ব': '¯^',
    'ন্ত': 'šÍ', 'ন্ত্র': 'š¿', 'ন্দ': '›`', 'ন্ট': '›U',
    'ম্প': '¤ú', 'ম্ম': '¤§', 'ম্ভ': '¤¢', 'ম্ব': '¤^',
    'দ্ভ': '™¢',
  });
  // Phala-style glyphs that follow any plain consonant.
  const AFTER = { 'য': '¨', 'র': 'Ö', 'ব': '^', 'ম': '¥', 'ন': 'œ', 'ল': 'ø' };
  const RA_LOW = new Set(['ট', 'ঠ', 'ড', 'ঢ', 'দ', 'ছ']); // these take the lower ra-phala glyph

  const KAR_PRE = { 'ি': 'w', 'ে': '‡', 'ৈ': 'ˆ' };
  const KAR_POST = { 'া': 'v', 'ী': 'x', 'ু': 'y', 'ূ': '~', 'ৃ': '„', 'ৗ': 'Š' };
  const QUOTES_U2B = { '‘': 'Ô', '’': 'Õ', '“': 'Ò', '”': 'Ó', '।': '|' };

  // ---------- Bijoy -> Unicode ----------
  function bijoyToUnicode(src) {
    src = String(src == null ? '' : src);
    let out = '';
    let cl = null; // current consonant cluster: { pre, text, reph, post, open }
    const flush = () => {
      if (!cl) return;
      let kar = cl.pre + cl.post;
      kar = kar.replace(E_KAR + AA_KAR, O_KAR).replace(E_KAR + AU_LEN, AU_KAR);
      out += (cl.reph && cl.text ? 'র' + HAS : '') + cl.text + kar;
      cl = null;
    };
    const fresh = () => { if (!cl) cl = { pre: '', text: '', reph: false, post: '', open: false }; return cl; };

    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === 'A' && src[i + 1] === 'v') { flush(); out += 'আ'; i++; continue; }
      const g = G[ch];
      if (!g) {
        flush();
        if (ch >= '0' && ch <= '9') out += DIGITS_BN[ch.charCodeAt(0) - 48];
        else out += OTHER_B2U[ch] || ch;
        continue;
      }
      switch (g.t) {
        case 'v': flush(); out += g.u; break;
        case 'pre':
          if (cl && cl.text) flush();
          fresh().pre += g.u;
          break;
        case 'c':
        case 'h':
          if (cl && cl.text && !cl.open) flush();
          fresh();
          cl.text += g.u;
          cl.open = g.t === 'h';
          break;
        case 'j':
          fresh();
          // ra + ya-phala is not a reph: keep it as ra, ZWJ, hasant, ya.
          if (g.u === '্য' && /(^|[^্])র$/.test(cl.text)) cl.text += ZWJ;
          cl.text += g.u;
          cl.open = false;
          break;
        case 'post': fresh().post += g.u; break;
        case 'reph':
          if (cl && cl.text) cl.reph = true; else out += g.u;
          break;
      }
    }
    flush();
    return out;
  }

  // ---------- Unicode -> Bijoy ----------
  function normalize(s) {
    return String(s == null ? '' : s)
      .replace(/ড়/g, NUKTA_DDA)
      .replace(/ঢ়/g, NUKTA_DDHA)
      .replace(/য়/g, NUKTA_YA)
      .replace(/অা/g, 'আ')
      .replace(new RegExp(ZWNJ, 'g'), '');
  }

  // Glyphs for the consonant list L (each joined to the previous one by a hasant).
  function clusterGlyphs(L, reph, karList, state) {
    const parts = []; // { g, phala }
    let i = 0;
    let prev = '';
    while (i < L.length) {
      const a = L[i];
      if (i + 1 < L.length) {
        const k3 = i + 2 < L.length ? a + HAS + L[i + 1] + HAS + L[i + 2] : null;
        const k2 = a + HAS + L[i + 1];
        if (k3 && PAIRS[k3]) { parts.push({ g: PAIRS[k3] }); prev = L[i + 2]; i += 3; continue; }
        if (PAIRS[k2]) { parts.push({ g: PAIRS[k2] }); prev = L[i + 1]; i += 2; continue; }
      }
      if (i === 0) {
        parts.push({ g: PLAIN[a] });
      } else if (AFTER[a]) {
        let g = AFTER[a];
        if (a === 'র' && RA_LOW.has(prev)) g = 'ª';
        if (a === 'ব' && prev === 'জ') g = '¡';
        parts.push({ g, phala: true });
      } else {
        state.unmapped++; // no glyph known for this conjunct: written without the joiner
        parts.push({ g: PLAIN[a] });
      }
      prev = a;
      i++;
    }

    // ু / ূ have special glyphs after some letters.
    const post = [];
    for (const k of karList) {
      const last = parts[parts.length - 1];
      if (k === 'ু' && !reph && L.length === 1 && L[0] === 'শ') { parts[0].g = 'ï'; continue; }
      if (k === 'ু' && last.g.endsWith('šÍ')) { last.g = last.g.slice(0, -1) + '‘'; continue; }
      if ((k === 'ু' || k === 'ূ') && ((L.length === 1 && L[0] === 'র') || last.g === 'Ö' || last.g === 'ª')) {
        post.push(k === 'ু' ? 'æ' : 'ƒ');
        continue;
      }
      post.push(KAR_POST[k]);
    }

    if (reph) {
      let t = parts.length;
      while (t > 1 && parts[t - 1].phala) t--;
      parts.splice(t, 0, { g: '©' });
    }
    return parts.map((p) => p.g).join('') + post.join('');
  }

  function unicodeToBijoyDetailed(src) {
    const s = normalize(src);
    const state = { unmapped: 0 };
    let out = '';
    for (let i = 0; i < s.length;) {
      const ch = s[i];
      if (isCons(ch)) {
        let j = i;
        let reph = false;
        if (ch === 'র' && s[j + 1] === HAS && isCons(s[j + 2])) { reph = true; j += 2; }
        const L = [s[j]];
        j++;
        for (;;) {
          const k = s[j] === ZWJ ? j + 1 : j;
          if (s[k] === HAS && isCons(s[k + 1])) { L.push(s[k + 1]); j = k + 2; } else break;
        }
        if (s[j] === ZWJ && s[j + 1] === HAS) j += 2; else if (s[j] === HAS) j++; // dangling hasant
        let pre = '';
        const post = [];
        for (; j < s.length; j++) {
          const k = s[j];
          if (KAR_PRE[k]) pre += KAR_PRE[k];
          else if (k === O_KAR) { pre += '‡'; post.push('া'); }
          else if (k === AU_KAR) { pre += '‡'; post.push('ৗ'); }
          else if (KAR_POST[k]) post.push(k);
          else break;
        }
        out += pre + clusterGlyphs(L, reph, post, state);
        i = j;
        continue;
      }
      i++;
      if (LETTER[ch]) out += LETTER[ch];
      else if (ch >= '০' && ch <= '৯') out += String(ch.charCodeAt(0) - 0x09E6);
      else if (QUOTES_U2B[ch]) out += QUOTES_U2B[ch];
      else if (KAR_PRE[ch]) out += KAR_PRE[ch];
      else if (KAR_POST[ch]) out += KAR_POST[ch];
      else if (ch === O_KAR) out += '‡v';
      else if (ch === AU_KAR) out += '‡Š';
      else if (ch === HAS || ch === ZWJ) { /* no Bijoy equivalent on its own */ }
      else out += ch;
    }
    return { text: out, unmapped: state.unmapped };
  }

  const unicodeToBijoy = (s) => unicodeToBijoyDetailed(s).text;

  // ---------- Detection ----------
  const STRONG = '‡†ˆ„¨¯¶µ³°±·¸¹¼½¿Š';
  const WEAK = 'ÖÛËÎÏÜÝ×óðþýšœ™›¤¥§¢úøæƒï©ªÁÂÃÄ’‘';
  const COMMON = /(^|[^A-Za-z])(Avwg|Avcwb|Avgiv|Zywg|Ges|evsjv\w*|Gi|Zvi|nq|bq|wKš‘|Mvb|MvB|n‡e|Av‡Q|Zv‡`i|Avgv‡`i)(?=[^A-Za-z]|$)/g;
  const BANGLA = /[ঀ-৿]/g;

  // True when the text most likely is Bijoy (Latin letters standing for Bangla), not Unicode.
  function looksLikeBijoy(text) {
    const s = String(text == null ? '' : text);
    const bangla = (s.match(BANGLA) || []).length;
    let strong = 0, weak = 0, letters = 0;
    for (const ch of s) {
      if (STRONG.includes(ch)) strong++;
      else if (WEAK.includes(ch)) weak++;
      else if (/[A-Za-z]/.test(ch)) letters++;
    }
    if (bangla > strong + weak) return false;
    const words = (s.match(COMMON) || []).length;
    const marks = strong + weak;
    if (letters + marks < 3) return false;
    return words >= 2 || (words >= 1 && marks >= 1) || (strong >= 1 && marks >= 2 && marks / (letters + marks) >= 0.05);
  }

  const hasBangla = (text) => /[ঀ-৿]/.test(String(text == null ? '' : text));

  const api = { bijoyToUnicode, unicodeToBijoy, unicodeToBijoyDetailed, looksLikeBijoy, hasBangla, _tables: { G, PAIRS } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JBBIJOY = api;
})(typeof self !== 'undefined' ? self : this);
