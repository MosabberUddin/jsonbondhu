// Hash generator page. Loaded with `defer` from <head>: runs after the DOM is parsed
// but before DOMContentLoaded, so the strings below exist for i18n's first apply().
(function () {
  'use strict';
  const I18N = window.JBI18N;
  const t = I18N.t;
  const H = window.JBHASH;
  const { copy } = window.JBTOOLS;

  const MAX_FILE = 100 * 1024 * 1024; // 100 MB

  I18N.extend({
    en: {
      'hash.title': 'Hash Generator: SHA-256, MD5, HMAC online | JSON Bondhu',
      'hash.metaDesc': 'Free online hash generator: SHA-256, SHA-1, SHA-512 and MD5 of text or a file, plus HMAC. Runs in your browser, nothing is uploaded.',
      'hash.input': 'Text to hash',
      'hash.input.placeholder': 'Type or paste text (UTF-8, Bangla works)…',
      'hash.file': 'Or choose a file',
      'hash.clearFile': 'Remove file',
      'hash.mode': 'Mode',
      'hash.mode.hash': 'Plain hash',
      'hash.mode.hmac': 'HMAC (with secret key)',
      'hash.output': 'Output',
      'hash.enc.hex': 'Hex (lowercase)',
      'hash.enc.hexUpper': 'Hex (UPPERCASE)',
      'hash.enc.base64': 'Base64',
      'hash.key': 'Secret key',
      'hash.key.placeholder': 'Secret key (text, UTF-8)',
      'hash.copy': 'Copy',
      'hash.weak': 'Not safe for passwords or security',
      'hash.compare': 'Compare with a hash',
      'hash.compare.placeholder': 'Paste a hash (hex or Base64) to check it matches…',
      'hash.match': 'Match: this is the {algo} hash ({enc})',
      'hash.match.hex': 'hex',
      'hash.match.base64': 'Base64',
      'hash.noMatch': 'No match. The pasted value is not equal to any hash above.',
      'hash.done': 'Hashed {n} bytes in your browser. Nothing was uploaded.',
      'hash.doneFile': 'Hashed file {name} ({n} bytes) in your browser. Nothing was uploaded.',
      'hash.tooBig': 'This file is larger than 100 MB. Choose a smaller file.',
      'hash.readError': 'Could not read the file.',
      'hash.computing': 'Working…',
      'hash.hmacNote': 'HMAC mode: the key is used as UTF-8 text.',
    },
    bn: {
      'hash.title': 'হ্যাশ জেনারেটর: SHA-256, MD5, HMAC অনলাইনে | JSON বন্ধু',
      'hash.metaDesc': 'টেক্সট বা ফাইলের SHA-256, SHA-1, SHA-512 ও MD5 হ্যাশ বের করুন, HMAC সহ। সবকিছু ব্রাউজারেই হয়, কিছু আপলোড হয় না। বিনামূল্যে।',
      'hash.input': 'হ্যাশ করার টেক্সট',
      'hash.input.placeholder': 'টেক্সট লিখুন বা পেস্ট করুন (UTF-8, বাংলা চলবে)…',
      'hash.file': 'অথবা একটি ফাইল বেছে নিন',
      'hash.clearFile': 'ফাইল সরান',
      'hash.mode': 'মোড',
      'hash.mode.hash': 'সাধারণ হ্যাশ',
      'hash.mode.hmac': 'HMAC (গোপন চাবি সহ)',
      'hash.output': 'আউটপুট',
      'hash.enc.hex': 'হেক্স (ছোট হাতের)',
      'hash.enc.hexUpper': 'হেক্স (বড় হাতের)',
      'hash.enc.base64': 'Base64',
      'hash.key': 'গোপন চাবি',
      'hash.key.placeholder': 'গোপন চাবি (টেক্সট, UTF-8)',
      'hash.copy': 'কপি',
      'hash.weak': 'পাসওয়ার্ড বা নিরাপত্তার জন্য নিরাপদ নয়',
      'hash.compare': 'হ্যাশের সাথে মেলান',
      'hash.compare.placeholder': 'মিলছে কি না দেখতে একটি হ্যাশ (হেক্স বা Base64) পেস্ট করুন…',
      'hash.match': 'মিলেছে: এটি {algo} হ্যাশ ({enc})',
      'hash.match.hex': 'হেক্স',
      'hash.match.base64': 'Base64',
      'hash.noMatch': 'মেলেনি। পেস্ট করা মান ওপরের কোনো হ্যাশের সমান নয়।',
      'hash.done': 'আপনার ব্রাউজারেই {n} বাইট হ্যাশ হয়েছে। কিছু আপলোড হয়নি।',
      'hash.doneFile': 'আপনার ব্রাউজারেই ফাইল {name} ({n} বাইট) হ্যাশ হয়েছে। কিছু আপলোড হয়নি।',
      'hash.tooBig': 'ফাইলটি ১০০ মেগাবাইটের বেশি বড়। ছোট ফাইল বেছে নিন।',
      'hash.readError': 'ফাইলটি পড়া যায়নি।',
      'hash.computing': 'হিসাব চলছে…',
      'hash.hmacNote': 'HMAC মোড: চাবিটি UTF-8 টেক্সট হিসেবে ধরা হয়।',
    },
  });

  const $ = (s) => document.querySelector(s);
  const inputEl = $('#hash-input');
  const fileEl = $('#hash-file');
  const clearFileEl = $('#hash-clear-file');
  const keyEl = $('#hash-key');
  const keyRow = $('#hash-key-row');
  const table = $('#hash-results');
  const compareEl = $('#hash-compare');
  const compareRes = $('#hash-compare-result');
  const statusEl = $('#status');
  const subtle = window.crypto && window.crypto.subtle;

  let file = null;
  let results = null; // { algo: Uint8Array } for the current input
  let seq = 0;
  let statusState = null; // { key, params, cls } so the message follows language changes

  // One row per algorithm, built once; values are updated in place.
  const cells = {};
  for (const algo of H.ALGOS) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = algo;
    const td = document.createElement('td');
    const code = document.createElement('code');
    code.className = 'mono';
    code.dataset.algo = algo;
    td.append(code);
    if (algo === 'MD5' || algo === 'SHA-1') {
      const warn = document.createElement('div');
      const badge = document.createElement('span');
      badge.className = 'badge warn';
      badge.dataset.i18n = 'hash.weak';
      badge.textContent = t('hash.weak');
      warn.append(badge);
      td.append(warn);
    }
    const tdBtn = document.createElement('td');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.copyAlgo = algo;
    btn.dataset.i18n = 'hash.copy';
    btn.textContent = t('hash.copy');
    btn.setAttribute('aria-label', t('hash.copy') + ' ' + algo);
    tdBtn.append(btn);
    tr.append(th, td, tdBtn);
    table.append(tr);
    cells[algo] = { code, btn };
  }

  const encoding = () => $('input[name=hash-enc]:checked').value;
  const mode = () => $('input[name=hash-mode]:checked').value;

  function setStatus(key, params, cls) {
    statusState = key ? { key, params, cls } : null;
    renderStatus();
  }
  function renderStatus() {
    statusEl.className = 'status' + (statusState && statusState.cls ? ' ' + statusState.cls : '');
    statusEl.textContent = statusState ? t(statusState.key, statusState.params) : '';
  }

  function renderValues() {
    const enc = encoding();
    for (const algo of H.ALGOS) {
      const v = results ? H.format(results[algo], enc) : '';
      cells[algo].code.textContent = v;
      cells[algo].btn.disabled = !results;
    }
    renderCompare();
  }

  function renderCompare() {
    const v = compareEl.value;
    if (!results || !v.trim()) { compareRes.hidden = true; compareRes.textContent = ''; return; }
    const r = H.compare(v, results);
    compareRes.hidden = false;
    compareRes.className = 'status ' + (r.match ? 'ok' : 'err');
    compareRes.textContent = r.match
      ? '✓ ' + t('hash.match', { algo: r.algo, enc: t('hash.match.' + r.encoding) })
      : '✗ ' + t('hash.noMatch');
  }

  async function getBytes() {
    if (file) return new Uint8Array(await file.arrayBuffer());
    return H.utf8(inputEl.value);
  }

  async function run() {
    const my = ++seq;
    keyRow.hidden = mode() !== 'hmac';
    if (!subtle) { setStatus('hash.readError', null, 'err'); return; }
    try {
      if (file) setStatus('hash.computing');
      const bytes = await getBytes();
      const opts = mode() === 'hmac' ? { key: H.utf8(keyEl.value) } : undefined;
      const res = await H.hashAll(bytes, subtle, opts);
      if (my !== seq) return; // a newer run replaced this one
      results = res;
      renderValues();
      if (file) setStatus('hash.doneFile', { name: file.name, n: bytes.length }, 'ok');
      else setStatus('hash.done', { n: bytes.length }, 'ok');
      statusEl.dataset.n = bytes.length;
    } catch (e) {
      if (my !== seq) return;
      results = null;
      renderValues();
      setStatus('hash.readError', null, 'err');
    }
  }

  function clearFile() {
    file = null;
    fileEl.value = '';
    clearFileEl.hidden = true;
    inputEl.disabled = false;
  }

  fileEl.addEventListener('change', () => {
    const f = fileEl.files && fileEl.files[0];
    if (!f) { clearFile(); run(); return; }
    if (f.size > MAX_FILE) {
      clearFile();
      seq++;
      results = null;
      renderValues();
      setStatus('hash.tooBig', null, 'err');
      return;
    }
    file = f;
    clearFileEl.hidden = false;
    inputEl.disabled = true;
    run();
  });

  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-copy-algo]');
    if (c && results) { copy(H.format(results[c.dataset.copyAlgo], encoding())); return; }
    const act = e.target.closest('[data-act]');
    if (act && act.dataset.act === 'clear-file') { clearFile(); run(); }
  });
  $('#hash-form').addEventListener('submit', (e) => e.preventDefault());
  inputEl.addEventListener('input', run);
  keyEl.addEventListener('input', run);
  for (const r of document.querySelectorAll('input[name=hash-mode]')) r.addEventListener('change', run);
  for (const r of document.querySelectorAll('input[name=hash-enc]')) r.addEventListener('change', renderValues);
  compareEl.addEventListener('input', renderCompare);
  window.addEventListener('jb:langchange', () => {
    renderStatus();
    renderCompare();
    for (const algo of H.ALGOS) cells[algo].btn.setAttribute('aria-label', t('hash.copy') + ' ' + algo);
  });
  document.addEventListener('DOMContentLoaded', run);
})();
