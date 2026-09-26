// English / Bangla UI strings and the language switch.
// Contract (shared with ads.js and the admin portal):
//   - current language is on document.documentElement.lang ("en" | "bn")
//   - choice is saved in localStorage "jb_lang"
//   - switching dispatches window "jb:langchange" with detail { lang }
// Long-form content (about, FAQ, privacy) lives in the HTML as parallel
// [data-lang="en"] / [data-lang="bn"] blocks; CSS hides the inactive one.
(function (root) {
  'use strict';

  const STORE_KEY = 'jb_lang';
  const LANGS = ['en', 'bn'];

  // Note: tree.items / tree.keys intentionally wrap the count in the container's own
  // brackets, like JSON: an array shows "[3 items]" and an object shows "{3 keys}".
  const STRINGS = {
    en: {
      'meta.title': 'JSON Bondhu — Online JSON Formatter, Viewer & Converter',
      'meta.description': 'Free online JSON formatter, validator and tree viewer. Convert JSON to CSV, YAML and XML. Your data never leaves your browser. Available in English and Bangla.',
      'privacy.title': 'Privacy Policy — JSON Bondhu',
      brand: 'JSON Bondhu',
      tagline: 'JSON formatter & viewer',
      'nav.about': 'What is JSON?',
      'nav.faq': 'FAQ',
      'nav.premium': 'Go ad-free',
      'lang.label': 'Language',
      'ad.placeholder': 'Ad space',
      'ad.label': 'Advertisement',
      'tab.text': 'Text',
      'tab.tree': 'Tree view',
      'tab.convert': 'Convert',
      'toolbar.label': 'Tools',
      'btn.format': 'Format',
      'btn.format.title': 'Ctrl + Enter',
      'indent.label': 'Indent',
      'indent.2': '2 spaces',
      'indent.4': '4 spaces',
      'indent.tab': 'Tab',
      'btn.minify': 'Minify',
      'btn.validate': 'Validate',
      'btn.repair': 'Fix errors',
      'btn.repair.title': 'Fixes comments, trailing commas, single quotes and more',
      'btn.sort': 'Sort keys',
      'btn.paste': 'Paste',
      'btn.copy': 'Copy',
      'btn.open': 'Open file',
      'btn.download': 'Download',
      'btn.sample': 'Sample',
      'btn.clear': 'Clear',
      'input.placeholder': 'Paste JSON here or drop a file…\n\nYour data is never sent to any server.',
      'btn.expand': 'Expand all',
      'btn.collapse': 'Collapse all',
      'search.placeholder': 'Search keys or values…',
      'search.label': 'Search',
      'path.label': 'Path:',
      'convert.format': 'Format:',
      'convert.csv': 'CSV (Excel)',
      'btn.convert': 'Convert',
      'output.placeholder': 'Converted output appears here',
      'footer.privacy': 'Privacy policy',
      'footer.contact': 'Contact',
      'footer.back': '← Back to the tool',
      'status.ready': 'Ready — paste some JSON.',
      'status.empty': 'Nothing to process — paste some JSON first.',
      'status.valid': '✓ Valid JSON — {size}, {nodes} values, depth {depth}',
      'status.invalid': '✗ Invalid JSON{where}. Try “Fix errors”.',
      'status.where': ' at line {line}, column {col}',
      'status.sample': 'Sample JSON loaded — try the Tree view or Convert tabs.',
      'size.bytes': '{n} bytes',
      'tree.invalid': 'The JSON has errors — fix it in the Text tab.',
      'tree.empty': 'Nothing to show — paste JSON in the Text tab.',
      'tree.items': '[{n} items]',
      'tree.keys': '{{n} keys}',
      'toast.copied': 'Copied',
      'toast.copyFailed': 'Could not copy — select the text and copy it manually',
      'toast.nothingToDownload': 'Nothing to download',
      'toast.repaired': 'Fixed',
      'toast.repairFailed': 'Could not fix it automatically',
      'toast.sorted': 'Keys sorted alphabetically',
      'toast.pasteManually': 'Press Ctrl + V to paste',
      'toast.tooBig': 'The data is very large — not everything was expanded',
      'toast.matches': '{n} matches found',
      'toast.noMatches': 'No matches',
      'toast.opened': '{name} opened',
      'toast.readFailed': 'Could not read the file',
    },
    bn: {
      'meta.title': 'JSON বন্ধু — অনলাইন JSON ফরম্যাটার, ভিউয়ার ও কনভার্টার (বাংলায়)',
      'meta.description': 'বিনামূল্যে বাংলায় JSON ফরম্যাট, যাচাই, মিনিফাই ও ট্রি-ভিউতে দেখুন। JSON থেকে CSV, YAML, XML-এ রূপান্তর করুন। আপনার ডেটা ব্রাউজারের বাইরে যায় না।',
      'privacy.title': 'গোপনীয়তা নীতি — JSON বন্ধু',
      brand: 'JSON বন্ধু',
      tagline: 'বাংলায় JSON ফরম্যাটার ও ভিউয়ার',
      'nav.about': 'JSON কী?',
      'nav.faq': 'প্রশ্নোত্তর',
      'nav.premium': 'বিজ্ঞাপনমুক্ত করুন',
      'lang.label': 'ভাষা',
      'ad.placeholder': 'বিজ্ঞাপনের স্থান',
      'ad.label': 'বিজ্ঞাপন',
      'tab.text': 'টেক্সট',
      'tab.tree': 'ট্রি ভিউ',
      'tab.convert': 'রূপান্তর',
      'toolbar.label': 'সরঞ্জাম',
      'btn.format': 'ফরম্যাট',
      'btn.format.title': 'Ctrl + Enter',
      'indent.label': 'ইন্ডেন্ট',
      'indent.2': '২ স্পেস',
      'indent.4': '৪ স্পেস',
      'indent.tab': 'ট্যাব',
      'btn.minify': 'মিনিফাই',
      'btn.validate': 'যাচাই',
      'btn.repair': 'ভুল ঠিক করুন',
      'btn.repair.title': 'কমেন্ট, শেষের কমা, সিঙ্গেল কোট ইত্যাদি ঠিক করে',
      'btn.sort': 'কী সাজান',
      'btn.paste': 'পেস্ট',
      'btn.copy': 'কপি',
      'btn.open': 'ফাইল খুলুন',
      'btn.download': 'ডাউনলোড',
      'btn.sample': 'নমুনা',
      'btn.clear': 'মুছুন',
      'input.placeholder': 'এখানে JSON পেস্ট করুন অথবা ফাইল টেনে এনে ছাড়ুন…\n\nআপনার ডেটা কোনো সার্ভারে পাঠানো হয় না।',
      'btn.expand': 'সব খুলুন',
      'btn.collapse': 'সব বন্ধ',
      'search.placeholder': 'কী বা মান খুঁজুন…',
      'search.label': 'খুঁজুন',
      'path.label': 'পাথ:',
      'convert.format': 'ফরম্যাট:',
      'convert.csv': 'CSV (এক্সেল)',
      'btn.convert': 'রূপান্তর করুন',
      'output.placeholder': 'রূপান্তরিত ফলাফল এখানে দেখাবে',
      'footer.privacy': 'গোপনীয়তা নীতি',
      'footer.contact': 'যোগাযোগ',
      'footer.back': '← টুলে ফিরে যান',
      'status.ready': 'প্রস্তুত — JSON পেস্ট করুন।',
      'status.empty': 'কোনো JSON নেই — আগে কিছু পেস্ট করুন।',
      'status.valid': '✓ সঠিক JSON — {size}, {nodes}টি মান, গভীরতা {depth}',
      'status.invalid': '✗ JSON-এ ভুল আছে{where}। “ভুল ঠিক করুন” চেষ্টা করে দেখুন।',
      'status.where': ' লাইন {line}, কলাম {col}-এ',
      'status.sample': 'নমুনা JSON লোড হয়েছে — ট্রি ভিউ বা রূপান্তর ট্যাব দেখুন।',
      'size.bytes': '{n} বাইট',
      'tree.invalid': 'JSON-এ ভুল আছে — টেক্সট ট্যাবে গিয়ে ঠিক করুন।',
      'tree.empty': 'দেখানোর মতো কিছু নেই — টেক্সট ট্যাবে JSON পেস্ট করুন।',
      'tree.items': '[{n}টি আইটেম]',
      'tree.keys': '{{n}টি কী}',
      'toast.copied': 'কপি হয়েছে',
      'toast.copyFailed': 'কপি করা যায়নি — নিজে সিলেক্ট করে কপি করুন',
      'toast.nothingToDownload': 'ডাউনলোড করার মতো কিছু নেই',
      'toast.repaired': 'ঠিক করা হয়েছে',
      'toast.repairFailed': 'স্বয়ংক্রিয়ভাবে ঠিক করা গেল না',
      'toast.sorted': 'কী বর্ণানুক্রমে সাজানো হয়েছে',
      'toast.pasteManually': 'Ctrl + V চেপে পেস্ট করুন',
      'toast.tooBig': 'ডেটা অনেক বড় — সব একসাথে খোলা হয়নি',
      'toast.matches': '{n}টি মিল পাওয়া গেছে',
      'toast.noMatches': 'কোনো মিল নেই',
      'toast.opened': '{name} খোলা হয়েছে',
      'toast.readFailed': 'ফাইল পড়া যায়নি',
    },
  };

  function storage(value) {
    try {
      if (value === undefined) return localStorage.getItem(STORE_KEY);
      localStorage.setItem(STORE_KEY, value);
    } catch (e) { /* storage unavailable */ }
    return null;
  }

  // Priority: ?lang= in the URL, then the saved choice, then the browser language.
  function detect() {
    try {
      const q = new URLSearchParams(location.search).get('lang');
      if (LANGS.includes(q)) return q;
    } catch (e) { /* no URL API */ }
    const saved = storage();
    if (LANGS.includes(saved)) return saved;
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    return /^bn\b/i.test(nav) ? 'bn' : 'en';
  }

  let lang = detect();

  function num(n) {
    const s = String(n);
    return lang === 'bn' ? s.replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]) : s;
  }

  // t('status.where', { line: 3 }) — numbers are localized automatically.
  function t(key, vars) {
    const table = STRINGS[lang] || STRINGS.en;
    let s = key in table ? table[key] : (STRINGS.en[key] !== undefined ? STRINGS.en[key] : key);
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, (m, k) => {
        if (!(k in vars)) return m;
        return typeof vars[k] === 'number' ? num(vars[k]) : String(vars[k]);
      });
    }
    return s;
  }

  // Apply strings to [data-i18n] (text) and [data-i18n-attr="attr:key;attr:key"].
  function apply(scope) {
    const doc = scope || document;
    for (const el of doc.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    for (const el of doc.querySelectorAll('[data-i18n-attr]')) {
      for (const pair of el.dataset.i18nAttr.split(';')) {
        const [attr, key] = pair.split(':').map((s) => s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      }
    }
    for (const btn of doc.querySelectorAll('[data-set-lang]')) {
      btn.setAttribute('aria-pressed', String(btn.dataset.setLang === lang));
    }
    const titleKey = document.documentElement.dataset.titleKey || 'meta.title';
    document.title = t(titleKey);
    const desc = document.querySelector('meta[name="description"]');
    if (desc && !document.documentElement.dataset.titleKey) desc.setAttribute('content', t('meta.description'));
  }

  function set(next) {
    if (!LANGS.includes(next) || next === lang) return;
    lang = next;
    storage(lang);
    document.documentElement.lang = lang;
    apply();
    root.dispatchEvent(new CustomEvent('jb:langchange', { detail: { lang } }));
  }

  // Set the attribute immediately (this script loads in <head>) so CSS shows the
  // right [data-lang] blocks before first paint; text strings apply on DOM ready.
  document.documentElement.lang = lang;
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-set-lang]');
      if (btn) set(btn.dataset.setLang);
    });
  });

  root.JBI18N = { t, num, set, apply, get lang() { return lang; }, STRINGS };
})(typeof self !== 'undefined' ? self : this);
