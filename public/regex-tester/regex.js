// Regex Tester page. Loaded with `defer` from <head>: runs after the DOM is parsed
// but before DOMContentLoaded, so the strings below exist for i18n's first apply().
// User text is only ever inserted with textContent / text nodes, never innerHTML.
(function () {
  'use strict';
  const I18N = window.JBI18N;
  const t = I18N.t;
  const R = window.JBREGEX;
  const { copy } = window.JBTOOLS;

  I18N.extend({
    en: {
      'regex.title': 'Regex Tester: JavaScript RegExp, live matches | JSON Bondhu',
      'regex.metaDesc': 'Test JavaScript regular expressions live: highlighted matches, capture and named groups, flags and a replace preview. Runs in your browser.',
      'rx.presets': 'Examples',
      'rx.preset.email': 'Email',
      'rx.preset.phone': 'BD mobile number',
      'rx.preset.date': 'Date (YYYY-MM-DD)',
      'rx.pattern': 'Pattern',
      'rx.pattern.placeholder': 'Type a regular expression, without slashes',
      'rx.flags': 'Flags',
      'rx.text': 'Test text',
      'rx.text.placeholder': 'Paste or type the text to search…',
      'rx.highlighted': 'Highlighted matches',
      'rx.matchList': 'Match list',
      'rx.replaceWith': 'Replace with',
      'rx.replace.placeholder': 'e.g. $1 or $<name>',
      'rx.copyResult': 'Copy result',
      'rx.replaceResult': 'Replace result',
      'rx.cheat': 'Cheat sheet',
      'rx.c.dot': 'Any character except a line break',
      'rx.c.classes': 'Digit, word character, whitespace (capitals mean the opposite)',
      'rx.c.set': 'Character set, negated set, range',
      'rx.c.anchors': 'Start, end, word boundary',
      'rx.c.quant': 'Repeat: 0 or more, 1 or more, optional, a range (add ? for lazy)',
      'rx.c.groups': 'Capturing group, non-capturing group, named group',
      'rx.c.alt': 'Either a or b',
      'rx.c.look': 'Lookahead and lookbehind',
      'rx.c.repl': 'In the replacement: group, named group, whole match, a literal $',
      'rx.col.n': '#',
      'rx.col.index': 'Index',
      'rx.col.match': 'Match',
      'rx.col.groups': 'Groups',
      'rx.empty': '(empty match)',
      'rx.unmatchedGroup': '(no match)',
      'rx.noMatches': 'No matches',
      'rx.count': '{n} matches',
      'rx.count.one': '1 match',
      'rx.noPattern': 'Enter a pattern to start',
      'rx.err.syntax': 'Invalid pattern: {msg}',
      'rx.err.flags': 'Invalid flags: {msg}',
      'rx.err.tooLong': 'Pattern is too long (limit {n} characters)',
      'rx.capped': 'Showing only the first {n} matches.',
      'rx.inputCapped': 'Only the first {n} characters of the text are searched.',
      'rx.risky': 'Warning: nested quantifiers like (a+)+ can take exponentially long on some inputs.',
      'rx.replaced': '{n} replaced',
    },
    bn: {
      'regex.title': 'রেজেক্স টেস্টার: JavaScript RegExp, সরাসরি মিল | JSON বন্ধু',
      'regex.metaDesc': 'JavaScript রেগুলার এক্সপ্রেশন সরাসরি পরীক্ষা করুন: হাইলাইট করা মিল, গ্রুপ ও নামযুক্ত গ্রুপ, ফ্ল্যাগ এবং রিপ্লেস প্রিভিউ। ব্রাউজারেই চলে।',
      'rx.presets': 'উদাহরণ',
      'rx.preset.email': 'ইমেইল',
      'rx.preset.phone': 'বাংলাদেশি মোবাইল নম্বর',
      'rx.preset.date': 'তারিখ (YYYY-MM-DD)',
      'rx.pattern': 'প্যাটার্ন',
      'rx.pattern.placeholder': 'স্ল্যাশ ছাড়া একটি রেগুলার এক্সপ্রেশন লিখুন',
      'rx.flags': 'ফ্ল্যাগ',
      'rx.text': 'পরীক্ষার টেক্সট',
      'rx.text.placeholder': 'যে টেক্সটে খুঁজবেন তা পেস্ট বা টাইপ করুন…',
      'rx.highlighted': 'হাইলাইট করা মিল',
      'rx.matchList': 'মিলের তালিকা',
      'rx.replaceWith': 'যা দিয়ে বদলাবেন',
      'rx.replace.placeholder': 'যেমন $1 বা $<name>',
      'rx.copyResult': 'ফলাফল কপি',
      'rx.replaceResult': 'রিপ্লেসের ফলাফল',
      'rx.cheat': 'চিটশিট',
      'rx.c.dot': 'নতুন লাইন ছাড়া যেকোনো অক্ষর',
      'rx.c.classes': 'সংখ্যা, শব্দের অক্ষর, ফাঁকা স্থান (বড় হাতের হলে উল্টো)',
      'rx.c.set': 'অক্ষরের সেট, নেগেটেড সেট, পরিসর',
      'rx.c.anchors': 'শুরু, শেষ, শব্দের সীমানা',
      'rx.c.quant': 'পুনরাবৃত্তি: ০ বা বেশি, ১ বা বেশি, ঐচ্ছিক, নির্দিষ্ট পরিসর (লেজির জন্য শেষে ? দিন)',
      'rx.c.groups': 'ক্যাপচারিং গ্রুপ, নন-ক্যাপচারিং গ্রুপ, নামযুক্ত গ্রুপ',
      'rx.c.alt': 'a অথবা b',
      'rx.c.look': 'লুকঅ্যাহেড ও লুকবিহাইন্ড',
      'rx.c.repl': 'রিপ্লেসমেন্টে: গ্রুপ, নামযুক্ত গ্রুপ, পুরো মিল, আক্ষরিক $',
      'rx.col.n': '#',
      'rx.col.index': 'ইনডেক্স',
      'rx.col.match': 'মিল',
      'rx.col.groups': 'গ্রুপ',
      'rx.empty': '(ফাঁকা মিল)',
      'rx.unmatchedGroup': '(মিল নেই)',
      'rx.noMatches': 'কোনো মিল নেই',
      'rx.count': '{n}টি মিল',
      'rx.count.one': '১টি মিল',
      'rx.noPattern': 'শুরু করতে একটি প্যাটার্ন লিখুন',
      'rx.err.syntax': 'প্যাটার্ন সঠিক নয়: {msg}',
      'rx.err.flags': 'ফ্ল্যাগ সঠিক নয়: {msg}',
      'rx.err.tooLong': 'প্যাটার্ন অনেক বড় (সীমা {n} অক্ষর)',
      'rx.capped': 'শুধু প্রথম {n}টি মিল দেখানো হচ্ছে।',
      'rx.inputCapped': 'টেক্সটের শুধু প্রথম {n} অক্ষরে খোঁজা হয়েছে।',
      'rx.risky': 'সতর্কতা: (a+)+-এর মতো নেস্টেড কোয়ান্টিফায়ার কিছু ইনপুটে অস্বাভাবিক সময় নিতে পারে।',
      'rx.replaced': '{n}টি বদলানো হয়েছে',
    },
  });

  const $ = (s) => document.querySelector(s);
  const patternEl = $('#rx-pattern');
  const textEl = $('#rx-text');
  const replaceEl = $('#rx-replace');
  const replaceOut = $('#rx-replace-out');
  const hlEl = $('#rx-highlight');
  const tableEl = $('#rx-matches');
  const errEl = $('#rx-error');
  const warnEl = $('#rx-warn');
  const statusEl = $('#status');
  const flagEls = Array.from(document.querySelectorAll('#rx-flags input'));
  const num = (n) => (I18N.lang === 'bn' ? n.toLocaleString('bn-BD') : n.toLocaleString('en-US'));

  const getFlags = () => flagEls.filter((c) => c.checked).map((c) => c.value).join('');

  function showMsg(el, msg) {
    el.hidden = !msg;
    el.textContent = msg || '';
  }

  function errorText(r) {
    if (r.code === 'flags') return t('rx.err.flags', { msg: r.message });
    if (r.code === 'tooLong') return t('rx.err.tooLong', { n: R.MAX_PATTERN });
    return t('rx.err.syntax', { msg: r.message });
  }

  function cell(tag, text, cls) {
    const e = document.createElement(tag);
    e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }

  function renderHighlight(text, matches) {
    hlEl.textContent = '';
    for (const seg of R.segments(text, matches)) {
      if (seg.match < 0) {
        hlEl.append(document.createTextNode(seg.text));
      } else if (seg.empty) {
        const s = document.createElement('span');
        s.className = 'empty';
        s.title = t('rx.empty');
        hlEl.append(s);
      } else {
        const m = document.createElement('mark');
        if (seg.match % 2) m.className = 'alt';
        m.textContent = seg.text;
        hlEl.append(m);
      }
    }
  }

  function groupsCell(m) {
    const td = document.createElement('td');
    const add = (label, value) => {
      const d = document.createElement('div');
      d.textContent = label + ': ' + (value === undefined ? t('rx.unmatchedGroup') : JSON.stringify(value));
      td.append(d);
    };
    m.groups.forEach((g, i) => add(String(i + 1), g));
    if (m.named) for (const k of Object.keys(m.named)) add(k, m.named[k]);
    return td;
  }

  function renderTable(matches) {
    tableEl.textContent = '';
    if (!matches.length) return;
    const head = document.createElement('tr');
    for (const k of ['rx.col.n', 'rx.col.index', 'rx.col.match', 'rx.col.groups']) head.append(cell('th', t(k)));
    tableEl.append(head);
    matches.forEach((m, i) => {
      const tr = document.createElement('tr');
      tr.append(cell('td', String(i + 1)), cell('td', m.index + '-' + m.end));
      tr.append(cell('td', m.text === '' ? t('rx.empty') : m.text));
      tr.append(groupsCell(m));
      tableEl.append(tr);
    });
  }

  function update() {
    const pattern = patternEl.value;
    const flags = getFlags();
    const text = textEl.value;
    showMsg(errEl, '');
    showMsg(warnEl, '');
    statusEl.className = 'status';
    delete statusEl.dataset.n;
    replaceOut.value = '';
    if (!pattern) {
      renderHighlight(text, []);
      renderTable([]);
      statusEl.textContent = t('rx.noPattern');
      return;
    }
    const r = R.run(pattern, flags, text);
    if (!r.ok) {
      showMsg(errEl, errorText(r));
      renderHighlight(text, []);
      renderTable([]);
      statusEl.textContent = '';
      return;
    }
    renderHighlight(r.text, r.matches);
    renderTable(r.matches);
    const warnings = [];
    if (r.risky) warnings.push(t('rx.risky'));
    if (r.truncated) warnings.push(t('rx.capped', { n: num(R.MAX_MATCHES) }));
    if (r.inputTruncated) warnings.push(t('rx.inputCapped', { n: num(R.MAX_INPUT) }));
    showMsg(warnEl, warnings.join(' '));
    statusEl.dataset.n = r.matches.length;
    statusEl.textContent = !r.matches.length ? t('rx.noMatches') : r.matches.length === 1 ? t('rx.count.one') : t('rx.count', { n: num(r.matches.length) });
    statusEl.classList.add(r.matches.length ? 'ok' : 'warn');
    if (replaceEl.value !== '') {
      const rep = R.replace(pattern, flags, text, replaceEl.value);
      if (rep.ok) replaceOut.value = rep.result;
    }
  }

  function applyPreset(id) {
    const p = R.PRESETS.find((x) => x.id === id);
    if (!p) return;
    patternEl.value = p.pattern;
    textEl.value = p.text;
    replaceEl.value = p.replace;
    for (const c of flagEls) c.checked = p.flags.indexOf(c.value) >= 0;
    update();
  }

  document.addEventListener('click', (e) => {
    const preset = e.target.closest('[data-preset]');
    if (preset) return applyPreset(preset.dataset.preset);
    if (e.target.closest('[data-act=copy-replaced]')) copy(replaceOut.value);
  });
  for (const el of [patternEl, textEl, replaceEl]) el.addEventListener('input', update);
  for (const c of flagEls) c.addEventListener('change', update);
  window.addEventListener('jb:langchange', update);
  document.addEventListener('DOMContentLoaded', () => applyPreset('email'));
})();
