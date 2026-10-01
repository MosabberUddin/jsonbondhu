// Bijoy <-> Unicode page. Loaded with `defer` from <head>: runs after the DOM is parsed
// but before DOMContentLoaded, so the strings below exist for i18n's first apply().
(function () {
  'use strict';
  const I18N = window.JBI18N;
  const t = I18N.t;
  const B = window.JBBIJOY;
  const { copy, download, toast } = window.JBTOOLS;

  I18N.extend({
    en: {
      'bijoy.title': 'Bijoy to Unicode Converter, Both Ways, Online | JSON Bondhu',
      'bijoy.metaDesc': 'Convert Bijoy (SutonnyMJ) Bangla text to Unicode and back in your browser. Handles reph, kars and common conjuncts. Free, nothing is uploaded.',
      'bijoy.mode': 'Direction',
      'bijoy.b2u': 'Bijoy → Unicode',
      'bijoy.u2b': 'Unicode → Bijoy',
      'bijoy.swap': 'Swap',
      'bijoy.swap.title': 'Use the output as the new input and switch direction',
      'bijoy.label.bijoy': 'Bijoy text (SutonnyMJ)',
      'bijoy.label.unicode': 'Unicode Bangla',
      'bijoy.in.placeholderB2U': 'Paste Bijoy text here, e.g. evsjv‡`k',
      'bijoy.in.placeholderU2B': 'Paste Unicode Bangla here, e.g. বাংলাদেশ',
      'bijoy.sample.b2u': 'Avwg evsjvq Mvb MvB',
      'bijoy.sample.u2b': 'আমি বাংলায় গান গাই',
      'bijoy.ok': '{a} characters → {b} characters',
      'bijoy.warn.unmapped': '{n} conjunct(s) have no Bijoy glyph in this table and were written without the joiner. Please check them.',
      'bijoy.hint.looksBijoy': 'This looks like Bijoy text, not Unicode.',
      'bijoy.hint.looksBijoy.btn': 'Switch to Bijoy → Unicode',
      'bijoy.hint.looksUnicode': 'This already looks like Unicode Bangla.',
      'bijoy.hint.looksUnicode.btn': 'Switch to Unicode → Bijoy',
      'bijoy.nothingToCopy': 'Nothing to copy',
    },
    bn: {
      'bijoy.title': 'বিজয় থেকে ইউনিকোড কনভার্টার, দুই দিকেই | JSON বন্ধু',
      'bijoy.metaDesc': 'বিজয় (সুতন্বী এমজে) বাংলা লেখা ব্রাউজারেই ইউনিকোডে এবং ইউনিকোড থেকে বিজয়ে রূপান্তর করুন। রেফ, কার ও প্রচলিত যুক্তবর্ণ চলে। বিনামূল্যে, কিছু আপলোড হয় না।',
      'bijoy.mode': 'দিক',
      'bijoy.b2u': 'বিজয় → ইউনিকোড',
      'bijoy.u2b': 'ইউনিকোড → বিজয়',
      'bijoy.swap': 'অদলবদল',
      'bijoy.swap.title': 'আউটপুটকে নতুন ইনপুট বানান এবং দিক পাল্টান',
      'bijoy.label.bijoy': 'বিজয় লেখা (সুতন্বী এমজে)',
      'bijoy.label.unicode': 'ইউনিকোড বাংলা',
      'bijoy.in.placeholderB2U': 'এখানে বিজয় লেখা পেস্ট করুন, যেমন evsjv‡`k',
      'bijoy.in.placeholderU2B': 'এখানে ইউনিকোড বাংলা পেস্ট করুন, যেমন বাংলাদেশ',
      'bijoy.sample.b2u': 'Avwg evsjvq Mvb MvB',
      'bijoy.sample.u2b': 'আমি বাংলায় গান গাই',
      'bijoy.ok': '{a}টি অক্ষর → {b}টি অক্ষর',
      'bijoy.warn.unmapped': '{n}টি যুক্তবর্ণের জন্য এই তালিকায় বিজয় গ্লিফ নেই, তাই জোড়া ছাড়া লেখা হয়েছে। দয়া করে মিলিয়ে দেখুন।',
      'bijoy.hint.looksBijoy': 'এটি ইউনিকোড নয়, বিজয় লেখা বলে মনে হচ্ছে।',
      'bijoy.hint.looksBijoy.btn': 'বিজয় → ইউনিকোডে যান',
      'bijoy.hint.looksUnicode': 'এটি আগে থেকেই ইউনিকোড বাংলা বলে মনে হচ্ছে।',
      'bijoy.hint.looksUnicode.btn': 'ইউনিকোড → বিজয়ে যান',
      'bijoy.nothingToCopy': 'কপি করার মতো কিছু নেই',
    },
  });

  const $ = (s) => document.querySelector(s);
  const inEl = $('#bj-in');
  const outEl = $('#bj-out');
  const inLabel = $('#bj-in-label');
  const outLabel = $('#bj-out-label');
  const statusEl = $('#status');
  const hintEl = $('#bj-hint');
  const hintText = $('#bj-hint-text');
  const hintBtn = $('#bj-hint-btn');

  let mode = 'b2u'; // b2u = Bijoy -> Unicode
  let lastStatus = null;
  const len = (s) => [...s].length;

  function setStatus(cls, key, vars) {
    lastStatus = key ? { cls, key, vars } : null;
    statusEl.className = 'status' + (cls ? ' ' + cls : '');
    statusEl.textContent = key ? t(key, vars) : '';
  }

  function renderLabels() {
    const b2u = mode === 'b2u';
    inLabel.textContent = t(b2u ? 'bijoy.label.bijoy' : 'bijoy.label.unicode');
    outLabel.textContent = t(b2u ? 'bijoy.label.unicode' : 'bijoy.label.bijoy');
    inEl.placeholder = t(b2u ? 'bijoy.in.placeholderB2U' : 'bijoy.in.placeholderU2B');
    inEl.classList.toggle('bj-unicode', !b2u);
    outEl.classList.toggle('bj-unicode', b2u);
    inEl.lang = b2u ? 'en' : 'bn';
    outEl.lang = b2u ? 'bn' : 'en';
    for (const b of document.querySelectorAll('.bj-mode [data-act]')) {
      const on = b.dataset.act === mode;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('primary', on);
    }
  }

  // Suggest the other direction when the pasted text clearly belongs to it.
  let hintTarget = null;
  function renderHint(src) {
    hintTarget = null;
    if (src && mode === 'u2b' && B.looksLikeBijoy(src)) hintTarget = 'b2u';
    else if (src && mode === 'b2u' && B.hasBangla(src) && !B.looksLikeBijoy(src)) hintTarget = 'u2b';
    hintEl.hidden = !hintTarget;
    if (!hintTarget) return;
    const k = hintTarget === 'b2u' ? 'bijoy.hint.looksBijoy' : 'bijoy.hint.looksUnicode';
    hintText.textContent = t(k);
    hintBtn.textContent = t(k + '.btn');
  }

  function run() {
    renderLabels();
    const src = inEl.value;
    renderHint(src);
    if (!src) { outEl.value = ''; setStatus('', null); return; }
    let out;
    let unmapped = 0;
    if (mode === 'b2u') {
      out = B.bijoyToUnicode(src);
    } else {
      const r = B.unicodeToBijoyDetailed(src);
      out = r.text;
      unmapped = r.unmapped;
    }
    outEl.value = out;
    if (unmapped) setStatus('warn', 'bijoy.warn.unmapped', { n: unmapped });
    else setStatus('ok', 'bijoy.ok', { a: len(src), b: len(out) });
  }

  function setMode(next) {
    mode = next;
    run();
  }

  document.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'b2u': setMode('b2u'); break;
      case 'u2b': setMode('u2b'); break;
      case 'hint-switch': if (hintTarget) setMode(hintTarget); break;
      case 'swap':
        inEl.value = outEl.value;
        setMode(mode === 'b2u' ? 'u2b' : 'b2u');
        break;
      case 'sample':
        inEl.value = t(mode === 'b2u' ? 'bijoy.sample.b2u' : 'bijoy.sample.u2b');
        run();
        break;
      case 'copy':
        if (outEl.value) copy(outEl.value); else toast(t('bijoy.nothingToCopy'));
        break;
      case 'download':
        if (outEl.value) download(outEl.value + '\n', mode === 'b2u' ? 'unicode.txt' : 'bijoy.txt', 'text/plain');
        else toast(t('bijoy.nothingToCopy'));
        break;
      case 'clear':
        inEl.value = '';
        run();
        inEl.focus();
        break;
    }
  });
  inEl.addEventListener('input', run);
  window.addEventListener('jb:langchange', () => {
    renderLabels();
    renderHint(inEl.value);
    if (lastStatus) setStatus(lastStatus.cls, lastStatus.key, lastStatus.vars);
  });
  document.addEventListener('DOMContentLoaded', run);
})();
