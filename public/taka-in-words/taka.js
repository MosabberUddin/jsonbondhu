// Taka in Words page. Loaded with `defer` from <head>: runs after the DOM is parsed
// but before DOMContentLoaded, so the strings below exist for i18n's first apply().
(function () {
  'use strict';
  const I18N = window.JBI18N;
  const t = I18N.t;
  const T = window.JBTAKA;
  const { copy } = window.JBTOOLS;

  I18N.extend({
    en: {
      'taka.title': 'Taka in Words, Bangla & English | JSON Bondhu',
      'taka.metaDesc': 'Convert any taka amount to words in Bangla and English. Handles lakh, crore, paisa and Bangla digits, with an optional Only suffix for cheques.',
      'taka.amount': 'Amount',
      'taka.placeholder': 'e.g. 12,34,567.50 or ১২৩৪৫৬৭.৫০',
      'taka.only': 'Add “Only / মাত্র”',
      'taka.bn': 'In Bangla words',
      'taka.en': 'In English words',
      'taka.fmtEn': 'Formatted (0-9)',
      'taka.fmtBn': 'Formatted (০-৯)',
      'taka.err.invalid': 'Please enter a valid amount using digits, commas and one decimal point.',
      'taka.err.negative': 'Negative amounts are not supported. Enter a positive amount.',
      'taka.err.toolarge': 'This amount is above the limit of 99,99,99,99,999 taka (9,999 crore and more). Please enter a smaller amount.',
    },
    bn: {
      'taka.title': 'টাকার অঙ্ক কথায়, বাংলা ও ইংরেজি | JSON বন্ধু',
      'taka.metaDesc': 'যেকোনো টাকার অঙ্ক বাংলা ও ইংরেজিতে কথায় লিখুন। লক্ষ, কোটি, পয়সা ও বাংলা অঙ্ক চলে, চেকের জন্য ঐচ্ছিক মাত্র সহ। ব্রাউজারেই হয়, কিছু আপলোড হয় না।',
      'taka.amount': 'পরিমাণ',
      'taka.placeholder': 'যেমন ১২,৩৪,৫৬৭.৫০ বা 1234567.50',
      'taka.only': '“মাত্র / Only” যোগ করুন',
      'taka.bn': 'বাংলা কথায়',
      'taka.en': 'ইংরেজি কথায়',
      'taka.fmtEn': 'সাজানো (0-9)',
      'taka.fmtBn': 'সাজানো (০-৯)',
      'taka.err.invalid': 'অঙ্ক, কমা ও একটি দশমিক বিন্দু দিয়ে সঠিক পরিমাণ লিখুন।',
      'taka.err.negative': 'ঋণাত্মক পরিমাণ সমর্থিত নয়। ধনাত্মক পরিমাণ লিখুন।',
      'taka.err.toolarge': 'পরিমাণটি ৯৯,৯৯,৯৯,৯৯,৯৯৯ টাকার সীমার বেশি। অনুগ্রহ করে ছোট পরিমাণ লিখুন।',
    },
  });

  const $ = (s) => document.querySelector(s);
  const inEl = $('#taka-in');
  const onlyEl = $('#taka-only');
  const statusEl = $('#status');
  const ids = { bn: '#taka-bn', en: '#taka-en', formatted: '#taka-fmt-en', formattedBn: '#taka-fmt-bn' };

  function render() {
    const r = T.convert(inEl.value, { only: onlyEl.checked });
    statusEl.classList.toggle('err', !r.ok && r.error !== 'empty');
    if (!r.ok) {
      for (const k in ids) $(ids[k]).textContent = '';
      statusEl.dataset.err = r.error;
      statusEl.textContent = r.error === 'empty' ? '' : t('taka.err.' + r.error);
      return;
    }
    delete statusEl.dataset.err;
    for (const k in ids) $(ids[k]).textContent = r[k];
    statusEl.textContent = '';
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy]');
    if (b) copy($('#' + b.dataset.copy).textContent);
  });
  $('#taka-form').addEventListener('submit', (e) => { e.preventDefault(); render(); });
  inEl.addEventListener('input', render);
  onlyEl.addEventListener('change', render);
  window.addEventListener('jb:langchange', render);
  document.addEventListener('DOMContentLoaded', render);
})();
