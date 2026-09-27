// URL encode/decode + URL parser page. Loaded with `defer` from <head>: runs after the
// DOM is parsed but before DOMContentLoaded, so the strings below exist for i18n's first apply().
(function () {
  'use strict';
  const I18N = window.JBI18N;
  const t = I18N.t;
  const U = window.JBURL;
  const { copy, toast } = window.JBTOOLS;

  I18N.extend({
    en: {
      'url.title': 'URL Encode / Decode & URL Parser — percent-encoding online | JSON Bondhu',
      'url.mode': 'Direction',
      'url.encode': 'Encode',
      'url.decode': 'Decode',
      'url.swap': 'Swap',
      'url.swap.title': 'Use the output as the new input and switch direction',
      'url.scope': 'Treat input as',
      'url.scope.component': 'Component — encodeURIComponent',
      'url.scope.uri': 'Full URL — encodeURI',
      'url.plus': '“+” means space (form encoding)',
      'url.in.placeholder': 'Type or paste text to encode…',
      'url.in.placeholderDecode': 'Paste percent-encoded text to decode, e.g. %E0%A6%95…',
      'url.label.text': 'Text',
      'url.label.encoded': 'Encoded',
      'url.label.decoded': 'Decoded',
      'url.ok.encoded': '{a} characters → {b} characters',
      'url.ok.decoded': '{a} characters → {b} characters',
      'url.err.malformed': 'Malformed escape “{seq}” at position {pos}. Everything else was decoded; broken sequences are left as they are.',
      'url.err.surrogate': 'The text contains a broken character (an unpaired surrogate) and cannot be encoded.',
      'url.nothingToCopy': 'Nothing to copy',
      'url.parse.h': 'Parse a URL',
      'url.parse.label': 'URL to parse',
      'url.parse.placeholder': 'Paste a URL, e.g. https://example.com/search?q=বাংলা',
      'url.parse.invalid': 'Not a valid URL',
      'url.parse.valid': 'Valid URL',
      'url.parse.assumed': 'No scheme given — read as https://',
      'url.part.protocol': 'Protocol',
      'url.part.username': 'Username',
      'url.part.password': 'Password',
      'url.part.host': 'Host',
      'url.part.port': 'Port',
      'url.part.portDefault': '{port} (default)',
      'url.part.path': 'Path',
      'url.part.query': 'Query string',
      'url.part.hash': 'Fragment (#)',
      'url.part.origin': 'Origin',
      'url.params.h': 'Query parameters',
      'url.params.count': '{n} parameters',
      'url.params.key': 'Key',
      'url.params.value': 'Value (decoded)',
      'url.params.empty': '(empty)',
      'url.params.repeat': '{i} of {n}',
      'url.params.repeated': 'Repeated: {keys}',
    },
    bn: {
      'url.title': 'URL এনকোড / ডিকোড ও URL পার্সার — পার্সেন্ট-এনকোডিং | JSON বন্ধু',
      'url.mode': 'দিক',
      'url.encode': 'এনকোড',
      'url.decode': 'ডিকোড',
      'url.swap': 'অদলবদল',
      'url.swap.title': 'আউটপুটকে নতুন ইনপুট বানান এবং দিক পাল্টান',
      'url.scope': 'ইনপুটের ধরন',
      'url.scope.component': 'কম্পোনেন্ট — encodeURIComponent',
      'url.scope.uri': 'পুরো URL — encodeURI',
      'url.plus': '“+” মানে স্পেস (ফর্ম এনকোডিং)',
      'url.in.placeholder': 'এনকোড করতে টেক্সট লিখুন বা পেস্ট করুন…',
      'url.in.placeholderDecode': 'ডিকোড করতে পার্সেন্ট-এনকোড করা টেক্সট পেস্ট করুন, যেমন %E0%A6%95…',
      'url.label.text': 'টেক্সট',
      'url.label.encoded': 'এনকোড করা',
      'url.label.decoded': 'ডিকোড করা',
      'url.ok.encoded': '{a}টি অক্ষর → {b}টি অক্ষর',
      'url.ok.decoded': '{a}টি অক্ষর → {b}টি অক্ষর',
      'url.err.malformed': '{pos} নম্বর অবস্থানে ভুল গঠনের এস্কেপ “{seq}”। বাকি সব ডিকোড করা হয়েছে; ভাঙা অংশগুলো যেমন ছিল তেমনই রাখা হয়েছে।',
      'url.err.surrogate': 'টেক্সটে একটি ভাঙা অক্ষর (জোড়াহীন সারোগেট) আছে, তাই এনকোড করা যাচ্ছে না।',
      'url.nothingToCopy': 'কপি করার মতো কিছু নেই',
      'url.parse.h': 'URL বিশ্লেষণ',
      'url.parse.label': 'যে URL বিশ্লেষণ করবেন',
      'url.parse.placeholder': 'একটি URL পেস্ট করুন, যেমন https://example.com/search?q=বাংলা',
      'url.parse.invalid': 'সঠিক URL নয়',
      'url.parse.valid': 'সঠিক URL',
      'url.parse.assumed': 'স্কিম দেওয়া নেই — https:// ধরে নেওয়া হয়েছে',
      'url.part.protocol': 'প্রোটোকল',
      'url.part.username': 'ইউজারনেম',
      'url.part.password': 'পাসওয়ার্ড',
      'url.part.host': 'হোস্ট',
      'url.part.port': 'পোর্ট',
      'url.part.portDefault': '{port} (ডিফল্ট)',
      'url.part.path': 'পাথ',
      'url.part.query': 'কুয়েরি স্ট্রিং',
      'url.part.hash': 'ফ্র্যাগমেন্ট (#)',
      'url.part.origin': 'অরিজিন',
      'url.params.h': 'কুয়েরি প্যারামিটার',
      'url.params.count': '{n}টি প্যারামিটার',
      'url.params.key': 'কী',
      'url.params.value': 'মান (ডিকোড করা)',
      'url.params.empty': '(খালি)',
      'url.params.repeat': '{n}টির মধ্যে {i}',
      'url.params.repeated': 'বারবার এসেছে: {keys}',
    },
  });

  const $ = (s) => document.querySelector(s);
  const inEl = $('#url-in');
  const outEl = $('#url-out');
  const inLabel = $('#url-in-label');
  const outLabel = $('#url-out-label');
  const plusEl = $('#url-plus');
  const statusEl = $('#status');
  const parseIn = $('#url-parse-in');
  const partsEl = $('#url-parts');
  const paramsEl = $('#url-params');
  const paramsH = $('#url-params-h');
  const SAMPLE = 'https://example.com:8080/খুঁজুন/results?q=%E0%A6%AC%E0%A6%BE%E0%A6%82%E0%A6%B2%E0%A6%BE&tag=json&tag=api&sort=new+first&empty=#top';

  let mode = 'encode';

  const scope = () => $('input[name=url-scope]:checked').value;
  const len = (s) => [...s].length;

  function setStatus(cls, key, vars) {
    statusEl.className = 'status' + (cls ? ' ' + cls : '');
    statusEl.textContent = key ? t(key, vars) : '';
  }

  function renderLabels() {
    inLabel.textContent = t(mode === 'encode' ? 'url.label.text' : 'url.label.encoded');
    outLabel.textContent = t(mode === 'encode' ? 'url.label.encoded' : 'url.label.decoded');
    inEl.placeholder = t(mode === 'encode' ? 'url.in.placeholder' : 'url.in.placeholderDecode');
    for (const b of document.querySelectorAll('.url-mode [data-act]')) {
      const on = b.dataset.act === mode;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('primary', on);
    }
  }

  function run() {
    renderLabels();
    const src = inEl.value;
    if (!src) { outEl.value = ''; setStatus('', null); return; }
    const opts = { plus: plusEl.checked };
    try {
      const out = mode === 'encode' ? U.encode(src, scope(), opts) : U.decode(src, scope(), opts);
      outEl.value = out;
      setStatus('ok', mode === 'encode' ? 'url.ok.encoded' : 'url.ok.decoded', { a: len(src), b: len(out) });
    } catch (e) {
      if (e.code === 'malformed') {
        outEl.value = U.decodeLenient(src, scope(), opts);
        setStatus('err', 'url.err.malformed', { seq: e.seq, pos: e.index + 1 });
      } else {
        outEl.value = '';
        setStatus('err', 'url.err.surrogate');
      }
    }
  }

  function setMode(m) {
    mode = m;
    run();
  }

  // ---- URL parser ----
  function cell(tag, text, className) {
    const c = document.createElement(tag);
    c.textContent = text;
    if (className) c.className = className;
    return c;
  }
  function badge(cls, text) {
    const b = document.createElement('span');
    b.className = 'badge ' + cls;
    b.textContent = text;
    return b;
  }
  function row(labelKey, value, mono) {
    const tr = document.createElement('tr');
    tr.append(cell('th', t(labelKey)), cell('td', value, mono ? 'mono' : ''));
    tr.dataset.part = labelKey.replace('url.part.', '');
    return tr;
  }

  function parse() {
    partsEl.textContent = '';
    paramsEl.textContent = '';
    paramsEl.hidden = true;
    paramsH.hidden = true;
    const v = parseIn.value.trim();
    if (!v) return;
    const r = U.parse(v);
    const cap = document.createElement('caption');
    partsEl.append(cap);
    if (!r) { cap.append(badge('err', '✗ ' + t('url.parse.invalid'))); return; }
    cap.append(badge('ok', '✓ ' + t('url.parse.valid')));
    if (r.assumedScheme) cap.append(badge('warn', t('url.parse.assumed')));

    partsEl.append(row('url.part.protocol', r.protocol, true));
    if (r.username) partsEl.append(row('url.part.username', r.username, true));
    if (r.password) partsEl.append(row('url.part.password', r.password, true));
    if (r.hostname) partsEl.append(row('url.part.host', r.hostname, true));
    if (r.port) partsEl.append(row('url.part.port', I18N.num(r.port), true));
    else if (r.defaultPort) partsEl.append(row('url.part.port', t('url.part.portDefault', { port: Number(r.defaultPort) }), true));
    partsEl.append(row('url.part.path', r.pathname || '/', true));
    if (r.search) partsEl.append(row('url.part.query', r.search, true));
    if (r.hash) partsEl.append(row('url.part.hash', r.hash, true));
    if (r.origin && r.origin !== 'null') partsEl.append(row('url.part.origin', r.origin, true));

    if (!r.params.length) return;
    paramsH.hidden = false;
    paramsEl.hidden = false;
    const pcap = document.createElement('caption');
    pcap.append(badge('', t('url.params.count', { n: r.params.length })));
    if (r.repeatedKeys.length) pcap.append(badge('warn', t('url.params.repeated', { keys: r.repeatedKeys.join(', ') })));
    paramsEl.append(pcap);
    const thead = document.createElement('thead');
    const htr = document.createElement('tr');
    const thK = cell('th', t('url.params.key'));
    const thV = cell('th', t('url.params.value'));
    thK.scope = 'col';
    thV.scope = 'col';
    htr.append(thK, thV);
    thead.append(htr);
    const tbody = document.createElement('tbody');
    for (const p of r.params) {
      const tr = document.createElement('tr');
      const th = cell('th', p.key, 'mono');
      th.scope = 'row';
      const td = p.value === '' ? cell('td', t('url.params.empty'), 'empty') : cell('td', p.value, 'mono');
      if (p.total > 1) td.append(badge('warn', t('url.params.repeat', { i: p.occurrence, n: p.total })));
      tr.append(th, td);
      tbody.append(tr);
    }
    paramsEl.append(thead, tbody);
  }

  document.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'encode': setMode('encode'); break;
      case 'decode': setMode('decode'); break;
      case 'swap': {
        const out = outEl.value;
        mode = mode === 'encode' ? 'decode' : 'encode';
        inEl.value = out;
        run();
        break;
      }
      case 'copy': if (outEl.value) copy(outEl.value); else toast(t('url.nothingToCopy')); break;
      case 'clear': inEl.value = ''; run(); inEl.focus(); break;
      case 'sample': parseIn.value = SAMPLE; parse(); break;
      default: break;
    }
  });

  inEl.addEventListener('input', run);
  for (const el of document.querySelectorAll('input[name=url-scope], #url-plus')) el.addEventListener('change', run);
  parseIn.addEventListener('input', parse);
  window.addEventListener('jb:langchange', () => { run(); parse(); });
  document.addEventListener('DOMContentLoaded', () => { run(); parse(); });
})();
