// Guide catalogue: drives /guides/ and the "Related guides" list on each guide.
// Loaded synchronously in <head> after /i18n.js and /tools.js.
(function (root) {
  'use strict';
  const I18N = root.JBI18N;

  // tool: the matching tool id from tools.js; minutes: reading time per language version.
  const GUIDES = [
    { slug: 'fix-json-errors', tool: 'json', minutes: 7 },
    { slug: 'what-is-json', tool: 'json', minutes: 6 },
    { slug: 'json-vs-yaml-vs-xml', tool: 'json', minutes: 6 },
    { slug: 'read-api-json-responses', tool: 'json', minutes: 7 },
    { slug: 'decode-jwt', tool: 'jwt', minutes: 7 },
    { slug: 'jwt-security-mistakes', tool: 'jwt', minutes: 8 },
    { slug: 'base64-explained', tool: 'base64', minutes: 6 },
    { slug: 'encoding-vs-encryption-vs-hashing', tool: 'base64', minutes: 6 },
    { slug: 'csv-to-json-and-excel-bangla', tool: 'csv', minutes: 7 },
    { slug: 'url-encoding-explained', tool: 'url', minutes: 6 },
    { slug: 'uuid-v4-vs-v7', tool: 'uuid', minutes: 6 },
    { slug: 'unix-timestamps-and-time-zones', tool: 'timestamp', minutes: 7 },
  ];
  const UPDATED = '2026-09-27';

  I18N.extend({
    en: {
      'guide.fix-json-errors.title': 'How to fix common JSON errors (Unexpected token, trailing commas and more)',
      'guide.fix-json-errors.desc': 'What each JSON error message really means, how to find the exact line, and how to fix the ten mistakes that cause almost all of them.',
      'guide.what-is-json.title': 'What is JSON? A beginner’s guide with examples',
      'guide.what-is-json.desc': 'Objects, arrays, strings, numbers, true/false and null — the whole JSON format explained in plain language, with real API examples.',
      'guide.json-vs-yaml-vs-xml.title': 'JSON vs YAML vs XML: which one should you use?',
      'guide.json-vs-yaml-vs-xml.desc': 'The same data in three formats, what each is good at, and how to choose for APIs, config files and documents.',
      'guide.read-api-json-responses.title': 'How to read and debug JSON API responses',
      'guide.read-api-json-responses.desc': 'Inspect API responses with the browser, curl and Postman, find the value you need with a JSON path, and spot common API mistakes.',
      'guide.decode-jwt.title': 'How to decode a JWT (and why decoding is not verifying)',
      'guide.decode-jwt.desc': 'The three parts of a JSON Web Token, what every standard claim means, how to read expiry times, and how signature verification works.',
      'guide.jwt-security-mistakes.title': '8 JWT security mistakes developers still make',
      'guide.jwt-security-mistakes.desc': 'alg: none, weak secrets, tokens in localStorage, missing expiry and more — what goes wrong and how to do it safely.',
      'guide.base64-explained.title': 'Base64 explained: what it is, how it works, when to use it',
      'guide.base64-explained.desc': 'Why Base64 exists, how 3 bytes become 4 characters, URL-safe Base64, data URIs, and why the output is 33% bigger.',
      'guide.encoding-vs-encryption-vs-hashing.title': 'Encoding vs encryption vs hashing: the difference that matters',
      'guide.encoding-vs-encryption-vs-hashing.desc': 'Base64 is not encryption and MD5 is not for passwords. A clear guide to which one protects your data and which one doesn’t.',
      'guide.csv-to-json-and-excel-bangla.title': 'Convert CSV to JSON — and open Bangla CSV files correctly in Excel',
      'guide.csv-to-json-and-excel-bangla.desc': 'Delimiters, quotes, headers and data types explained, plus the UTF-8 BOM trick that stops Excel from breaking Bangla text.',
      'guide.url-encoding-explained.title': 'URL encoding explained: %20, + and when to encode',
      'guide.url-encoding-explained.desc': 'Why URLs need percent-encoding, encodeURIComponent vs encodeURI, spaces as %20 or +, and how Bangla text travels in a URL.',
      'guide.uuid-v4-vs-v7.title': 'UUID v4 vs v7: which one to use for database keys',
      'guide.uuid-v4-vs-v7.desc': 'How UUIDs are built, why random v4 keys slow down database indexes, and when time-ordered v7 is the better choice.',
      'guide.unix-timestamps-and-time-zones.title': 'Unix timestamps and time zones explained (with Dhaka time)',
      'guide.unix-timestamps-and-time-zones.desc': 'Seconds vs milliseconds, UTC vs local time, storing dates correctly, the Year 2038 problem, and converting to Bangladesh time.',
    },
    bn: {
      'guide.fix-json-errors.title': 'JSON-এর সাধারণ ভুল কীভাবে ঠিক করবেন (Unexpected token, শেষের কমা ও আরও)',
      'guide.fix-json-errors.desc': 'প্রতিটি JSON এরর মেসেজের আসল মানে, ঠিক কোন লাইনে ভুল তা খোঁজার উপায়, আর যে দশটি ভুলে প্রায় সব এরর হয় সেগুলো ঠিক করার পদ্ধতি।',
      'guide.what-is-json.title': 'JSON কী? উদাহরণসহ নতুনদের জন্য গাইড',
      'guide.what-is-json.desc': 'অবজেক্ট, অ্যারে, স্ট্রিং, সংখ্যা, true/false ও null — পুরো JSON ফরম্যাট সহজ ভাষায়, বাস্তব API-এর উদাহরণসহ।',
      'guide.json-vs-yaml-vs-xml.title': 'JSON, YAML না XML: কোনটি ব্যবহার করবেন?',
      'guide.json-vs-yaml-vs-xml.desc': 'একই ডেটা তিন ফরম্যাটে, কোনটি কীসে ভালো, আর API, কনফিগ ফাইল ও ডকুমেন্টের জন্য কীভাবে বেছে নেবেন।',
      'guide.read-api-json-responses.title': 'API-এর JSON রেসপন্স কীভাবে পড়বেন ও ডিবাগ করবেন',
      'guide.read-api-json-responses.desc': 'ব্রাউজার, curl ও Postman দিয়ে API রেসপন্স দেখা, JSON পাথ দিয়ে দরকারি মান খোঁজা, আর API-এর সাধারণ ভুল চেনা।',
      'guide.decode-jwt.title': 'JWT কীভাবে ডিকোড করবেন (এবং কেন ডিকোড করা মানে যাচাই করা নয়)',
      'guide.decode-jwt.desc': 'JSON Web Token-এর তিনটি অংশ, প্রতিটি স্ট্যান্ডার্ড ক্লেইমের মানে, মেয়াদ শেষের সময় পড়ার উপায়, আর সিগনেচার যাচাই কীভাবে কাজ করে।',
      'guide.jwt-security-mistakes.title': 'JWT নিয়ে ৮টি নিরাপত্তা-ভুল যা ডেভেলপাররা এখনো করেন',
      'guide.jwt-security-mistakes.desc': 'alg: none, দুর্বল সিক্রেট, localStorage-এ টোকেন, মেয়াদ না থাকা ও আরও — কী ভুল হয় আর কীভাবে নিরাপদে করবেন।',
      'guide.base64-explained.title': 'Base64 সহজ ভাষায়: কী, কীভাবে কাজ করে, কখন ব্যবহার করবেন',
      'guide.base64-explained.desc': 'Base64 কেন দরকার, কীভাবে ৩ বাইট ৪টি অক্ষর হয়, URL-safe Base64, data URI, আর কেন আউটপুট ৩৩% বড় হয়।',
      'guide.encoding-vs-encryption-vs-hashing.title': 'এনকোডিং, এনক্রিপশন ও হ্যাশিং: যে পার্থক্যটা জরুরি',
      'guide.encoding-vs-encryption-vs-hashing.desc': 'Base64 এনক্রিপশন নয়, আর MD5 পাসওয়ার্ডের জন্য নয়। কোনটি আপনার ডেটা সুরক্ষিত রাখে আর কোনটি রাখে না — পরিষ্কার গাইড।',
      'guide.csv-to-json-and-excel-bangla.title': 'CSV থেকে JSON — এবং এক্সেলে বাংলা CSV ঠিকমতো খোলার উপায়',
      'guide.csv-to-json-and-excel-bangla.desc': 'ডিলিমিটার, কোট, হেডার ও ডেটা টাইপের ব্যাখ্যা, আর UTF-8 BOM-এর কৌশল যাতে এক্সেলে বাংলা ভেঙে না যায়।',
      'guide.url-encoding-explained.title': 'URL এনকোডিং সহজ ভাষায়: %20, + আর কখন এনকোড করবেন',
      'guide.url-encoding-explained.desc': 'URL-এ কেন পার্সেন্ট-এনকোডিং লাগে, encodeURIComponent বনাম encodeURI, স্পেস %20 না +, আর বাংলা লেখা কীভাবে URL-এ যায়।',
      'guide.uuid-v4-vs-v7.title': 'UUID v4 না v7: ডেটাবেস কী-এর জন্য কোনটি',
      'guide.uuid-v4-vs-v7.desc': 'UUID কীভাবে তৈরি হয়, কেন র‍্যান্ডম v4 কী ডেটাবেস ইনডেক্স ধীর করে, আর কখন সময়ভিত্তিক v7 ভালো।',
      'guide.unix-timestamps-and-time-zones.title': 'ইউনিক্স টাইমস্ট্যাম্প ও টাইম জোন সহজ ভাষায় (ঢাকার সময়সহ)',
      'guide.unix-timestamps-and-time-zones.desc': 'সেকেন্ড বনাম মিলিসেকেন্ড, UTC বনাম স্থানীয় সময়, তারিখ সঠিকভাবে সংরক্ষণ, ২০৩৮ সালের সমস্যা, আর বাংলাদেশের সময়ে রূপান্তর।',
    },
  });

  function el(tag, props, children) {
    const e = document.createElement(tag);
    Object.assign(e, props || {});
    for (const c of children || []) e.append(c);
    return e;
  }
  function text(tag, key, className) {
    const e = el(tag, { className: className || '' });
    e.dataset.i18n = key;
    e.textContent = I18N.t(key);
    return e;
  }
  function card(g) {
    const a = el('a', { className: 'guide-card', href: '/guides/' + g.slug + '/' });
    const meta = el('span', { className: 'guide-meta' });
    meta.dataset.minutes = g.minutes;
    a.append(text('strong', 'guide.' + g.slug + '.title'), text('span', 'guide.' + g.slug + '.desc', 'guide-desc'), meta);
    return a;
  }
  function formatDate(iso) {
    return new Intl.DateTimeFormat(I18N.lang === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'));
  }
  // Reading time / updated date are rebuilt on every language switch.
  function renderMeta() {
    for (const m of document.querySelectorAll('.guide-meta[data-minutes]')) m.textContent = I18N.t('guides.minutes', { n: Number(m.dataset.minutes) });
    for (const m of document.querySelectorAll('[data-guide-updated]')) {
      m.textContent = I18N.t('guides.minutes', { n: Number(m.dataset.minutes) }) + ' · ' + I18N.t('guides.updated', { date: formatDate(UPDATED) });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    for (const grid of document.querySelectorAll('[data-guide-grid]')) for (const g of GUIDES) grid.append(el('li', {}, [card(g)]));
    const current = document.documentElement.dataset.guide;
    const me = GUIDES.find((g) => g.slug === current);
    for (const list of document.querySelectorAll('[data-related-guides]')) {
      // Same-tool guides first, then the rest, up to four.
      const others = GUIDES.filter((g) => g.slug !== current);
      const related = others.filter((g) => me && g.tool === me.tool).concat(others.filter((g) => !me || g.tool !== me.tool)).slice(0, 4);
      for (const g of related) list.append(el('li', {}, [card(g)]));
    }
    renderMeta();
  });
  root.addEventListener('jb:langchange', renderMeta);

  root.JBGUIDES = { GUIDES, UPDATED };
})(typeof self !== 'undefined' ? self : this);
