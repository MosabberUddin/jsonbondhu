// Base64 encode/decode page. Loaded with `defer` from <head>: runs after the DOM is
// parsed but before DOMContentLoaded, so the strings below exist for i18n's first apply().
(function () {
  'use strict';
  const I18N = window.JBI18N;
  const t = I18N.t;
  const B = window.JBBASE64;
  const { copy, download, toast } = window.JBTOOLS;

  I18N.extend({
    en: {
      'base64.title': 'Base64 Encode / Decode — UTF-8, URL-safe, files & images | JSON Bondhu',
      'base64.mode': 'Direction',
      'base64.encode': 'Encode',
      'base64.decode': 'Decode',
      'base64.swap': 'Swap',
      'base64.swap.title': 'Use the output as the new input and switch direction',
      'base64.openFile': 'Encode a file',
      'base64.urlSafe': 'URL-safe (- and _)',
      'base64.padding': 'Padding (=)',
      'base64.dataUri': 'Files as data URI',
      'base64.in.placeholder': 'Type or paste text here, or drop a file…',
      'base64.in.placeholderDecode': 'Paste Base64 or a data: URI here…',
      'base64.label.text': 'Text',
      'base64.label.base64': 'Base64',
      'base64.label.file': 'File: {name}',
      'base64.label.decoded': 'Decoded text',
      'base64.size': '{chars} characters · {bytes} bytes',
      'base64.sizeBytes': '{bytes} bytes',
      'base64.ok.encoded': 'Encoded {bytes} bytes to {chars} Base64 characters',
      'base64.ok.file': '“{name}” encoded ({bytes} bytes)',
      'base64.ok.decodedText': 'Decoded {bytes} bytes of UTF-8 text',
      'base64.warn.binary': 'Decoded {bytes} bytes of binary data ({mime}) — use Download to save it',
      'base64.binaryPlaceholder': '(binary data — not shown as text)',
      'base64.unknownType': 'unknown type',
      'base64.nothingToCopy': 'Nothing to copy',
      'base64.err.char': 'Not valid Base64: unexpected character “{char}” at position {pos}. Base64 only uses A–Z, a–z, 0–9, + / (or - _) and = at the end.',
      'base64.err.length': 'Not valid Base64: the length is wrong — it looks cut off or has one character too many.',
      'base64.err.padding': 'Not valid Base64: “=” padding in the wrong place (position {pos}). It may only appear at the end, at most twice.',
      'base64.err.surrogate': 'The text contains a broken character (an unpaired surrogate) and cannot be encoded.',
      'base64.err.tooBig': 'That file is too large (limit {mb} MB).',
      'base64.preview.alt': 'Preview of the decoded image',
      'base64.preview.cap': 'Image preview · {mime} · {w}×{h} px',
    },
    bn: {
      'base64.title': 'Base64 এনকোড / ডিকোড — UTF-8, URL-safe, ফাইল ও ছবি | JSON বন্ধু',
      'base64.mode': 'দিক',
      'base64.encode': 'এনকোড',
      'base64.decode': 'ডিকোড',
      'base64.swap': 'অদলবদল',
      'base64.swap.title': 'আউটপুটকে নতুন ইনপুট বানান এবং দিক পাল্টান',
      'base64.openFile': 'ফাইল এনকোড করুন',
      'base64.urlSafe': 'URL-safe (- ও _)',
      'base64.padding': 'প্যাডিং (=)',
      'base64.dataUri': 'ফাইল data URI হিসেবে',
      'base64.in.placeholder': 'এখানে টেক্সট লিখুন বা পেস্ট করুন, অথবা ফাইল ছেড়ে দিন…',
      'base64.in.placeholderDecode': 'এখানে Base64 বা data: URI পেস্ট করুন…',
      'base64.label.text': 'টেক্সট',
      'base64.label.base64': 'Base64',
      'base64.label.file': 'ফাইল: {name}',
      'base64.label.decoded': 'ডিকোড করা টেক্সট',
      'base64.size': '{chars}টি অক্ষর · {bytes} বাইট',
      'base64.sizeBytes': '{bytes} বাইট',
      'base64.ok.encoded': '{bytes} বাইট এনকোড হয়ে {chars}টি Base64 অক্ষর হয়েছে',
      'base64.ok.file': '“{name}” এনকোড হয়েছে ({bytes} বাইট)',
      'base64.ok.decodedText': '{bytes} বাইট UTF-8 টেক্সট ডিকোড হয়েছে',
      'base64.warn.binary': '{bytes} বাইট বাইনারি ডেটা ডিকোড হয়েছে ({mime}) — সেভ করতে “ডাউনলোড” চাপুন',
      'base64.binaryPlaceholder': '(বাইনারি ডেটা — টেক্সট হিসেবে দেখানো হচ্ছে না)',
      'base64.unknownType': 'অজানা ধরন',
      'base64.nothingToCopy': 'কপি করার মতো কিছু নেই',
      'base64.err.char': 'সঠিক Base64 নয়: {pos} নম্বর অবস্থানে অপ্রত্যাশিত অক্ষর “{char}”। Base64-এ শুধু A–Z, a–z, 0–9, + / (অথবা - _) এবং শেষে = থাকে।',
      'base64.err.length': 'সঠিক Base64 নয়: দৈর্ঘ্য ভুল — মনে হচ্ছে কেটে গেছে বা একটি অক্ষর বেশি আছে।',
      'base64.err.padding': 'সঠিক Base64 নয়: “=” প্যাডিং ভুল জায়গায় ({pos} নম্বর অবস্থান)। এটি শুধু শেষে, সর্বোচ্চ দুবার থাকতে পারে।',
      'base64.err.surrogate': 'টেক্সটে একটি ভাঙা অক্ষর (জোড়াহীন সারোগেট) আছে, তাই এনকোড করা যাচ্ছে না।',
      'base64.err.tooBig': 'ফাইলটি অনেক বড় (সীমা {mb} MB)।',
      'base64.preview.alt': 'ডিকোড করা ছবির প্রিভিউ',
      'base64.preview.cap': 'ছবির প্রিভিউ · {mime} · {w}×{h} পিক্সেল',
    },
  });

  const $ = (s) => document.querySelector(s);
  const inEl = $('#b64-in');
  const outEl = $('#b64-out');
  const inLabel = $('#b64-in-label');
  const outLabel = $('#b64-out-label');
  const inSize = $('#b64-in-size');
  const outSize = $('#b64-out-size');
  const urlSafeEl = $('#b64-urlsafe');
  const padEl = $('#b64-pad');
  const dataUriEl = $('#b64-datauri');
  const fileEl = $('#b64-file');
  const grid = $('#b64-grid');
  const preview = $('#b64-preview');
  const previewCap = $('#b64-preview-cap');
  const statusEl = $('#status');
  const MAX_MB = 25;

  let mode = 'encode';
  let file = null; // { name, type, bytes } when a file is being encoded
  let decoded = null; // last decode result { bytes, text, mime }
  let previewUrl = null;
  let previewKey = null;

  // Grouped number with localized digits (1,234 → ১,২৩৪ in Bangla).
  const n = (x) => I18N.num(x.toLocaleString('en-US'));
  const utf8Len = (s) => B.utf8Encode(s).length;

  function setStatus(cls, key, vars) {
    statusEl.className = 'status' + (cls ? ' ' + cls : '');
    statusEl.textContent = key ? t(key, vars) : '';
  }

  function sizeText(s) {
    return t('base64.size', { chars: n([...s].length), bytes: n(utf8Len(s)) });
  }

  function clearPreview() {
    preview.hidden = true;
    const img = preview.querySelector('img');
    if (img) img.remove();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    previewKey = null;
  }

  function showPreview(bytes, mime, key) {
    if (previewKey === key && previewUrl) {
      updateCaption();
      return;
    }
    clearPreview();
    previewUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
    previewKey = key;
    const img = document.createElement('img');
    img.alt = t('base64.preview.alt');
    img.decoding = 'async';
    img.addEventListener('load', () => { preview.hidden = false; updateCaption(); });
    img.addEventListener('error', () => { clearPreview(); });
    img.src = previewUrl;
    preview.insertBefore(img, previewCap);
    preview.dataset.mime = mime;
  }

  function updateCaption() {
    const img = preview.querySelector('img');
    if (!img) return;
    img.alt = t('base64.preview.alt');
    previewCap.textContent = t('base64.preview.cap', { mime: preview.dataset.mime, w: img.naturalWidth, h: img.naturalHeight });
  }

  function renderLabels() {
    if (mode === 'encode') {
      inLabel.textContent = file ? t('base64.label.file', { name: file.name }) : t('base64.label.text');
      outLabel.textContent = t('base64.label.base64');
      inEl.placeholder = t('base64.in.placeholder');
    } else {
      inLabel.textContent = t('base64.label.base64');
      outLabel.textContent = t('base64.label.decoded');
      inEl.placeholder = t('base64.in.placeholderDecode');
    }
    for (const b of document.querySelectorAll('.b64-mode [data-act]')) {
      const on = b.dataset.act === mode;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('primary', on);
    }
  }

  function encodeOpts() {
    return { urlSafe: urlSafeEl.checked, pad: padEl.checked };
  }

  function runEncode() {
    decoded = null;
    clearPreview();
    if (file) {
      const out = dataUriEl.checked
        ? B.toDataUri(file.bytes, file.type || 'application/octet-stream') // data URIs always use the standard alphabet
        : B.encodeBytes(file.bytes, encodeOpts());
      outEl.value = out;
      inSize.textContent = t('base64.sizeBytes', { bytes: n(file.bytes.length) });
      outSize.textContent = t('base64.size', { chars: n(out.length), bytes: n(out.length) });
      setStatus('ok', 'base64.ok.file', { name: file.name, bytes: n(file.bytes.length) });
      return;
    }
    const text = inEl.value;
    inSize.textContent = text ? sizeText(text) : '';
    if (!text) { outEl.value = ''; outSize.textContent = ''; setStatus('', null); return; }
    if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(text)) {
      outEl.value = ''; outSize.textContent = '';
      setStatus('err', 'base64.err.surrogate');
      return;
    }
    const out = B.encodeText(text, encodeOpts());
    outEl.value = out;
    outSize.textContent = t('base64.size', { chars: n(out.length), bytes: n(out.length) });
    setStatus('ok', 'base64.ok.encoded', { bytes: n(utf8Len(text)), chars: n(out.length) });
  }

  function runDecode() {
    const src = inEl.value;
    inSize.textContent = src ? sizeText(src) : '';
    decoded = null;
    if (!src.trim()) { outEl.value = ''; outSize.textContent = ''; clearPreview(); setStatus('', null); return; }
    try {
      decoded = B.decode(src);
    } catch (e) {
      outEl.value = ''; outSize.textContent = ''; clearPreview();
      const pos = n((e.index || 0) + 1);
      if (e.code === 'char') setStatus('err', 'base64.err.char', { char: e.char, pos });
      else if (e.code === 'padding') setStatus('err', 'base64.err.padding', { pos });
      else setStatus('err', 'base64.err.length');
      return;
    }
    const { bytes, text, mime } = decoded;
    outSize.textContent = t('base64.sizeBytes', { bytes: n(bytes.length) });
    if (text !== null) {
      outEl.value = text;
      outEl.placeholder = '';
      setStatus('ok', 'base64.ok.decodedText', { bytes: n(bytes.length) });
    } else {
      outEl.value = '';
      outEl.placeholder = t('base64.binaryPlaceholder');
      setStatus('warn', 'base64.warn.binary', { bytes: n(bytes.length), mime: mime || t('base64.unknownType') });
    }
    if (mime && mime.startsWith('image/') && bytes.length) showPreview(bytes, mime, src);
    else clearPreview();
  }

  function run() {
    renderLabels();
    if (mode === 'encode') { outEl.placeholder = ''; runEncode(); } else runDecode();
  }

  function setMode(m) {
    if (m === mode) return run();
    if (file) { file = null; inEl.value = ''; }
    mode = m;
    run();
  }

  function swap() {
    if (mode === 'decode' && decoded && decoded.text === null) {
      // Binary output cannot become text input; keep the data as a "file" instead.
      file = { name: 'decoded.' + B.extFor(decoded.mime, false), type: decoded.mime || '', bytes: decoded.bytes };
      inEl.value = '';
      mode = 'encode';
      return run();
    }
    const out = outEl.value;
    file = null;
    mode = mode === 'encode' ? 'decode' : 'encode';
    inEl.value = out;
    run();
  }

  function loadFile(f) {
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) { setStatus('err', 'base64.err.tooBig', { mb: MAX_MB }); return; }
    const reader = new FileReader();
    reader.onload = () => {
      file = { name: f.name, type: f.type, bytes: new Uint8Array(reader.result) };
      inEl.value = '';
      mode = 'encode';
      run();
    };
    reader.onerror = () => toast(t('toast.readFailed'));
    reader.readAsArrayBuffer(f);
  }

  function doDownload() {
    if (mode === 'decode' && decoded) {
      const isText = decoded.text !== null;
      const mime = decoded.mime || (isText ? 'text/plain' : 'application/octet-stream');
      download(decoded.bytes, 'decoded.' + B.extFor(decoded.mime, isText), mime);
      return;
    }
    if (!outEl.value) { toast(t('toast.nothingToDownload')); return; }
    const base = file ? file.name.replace(/\.[^.]*$/, '') || 'file' : 'base64';
    download(outEl.value, base + '.b64.txt', 'text/plain');
  }

  document.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'encode': setMode('encode'); break;
      case 'decode': setMode('decode'); break;
      case 'swap': swap(); break;
      case 'open': fileEl.click(); break;
      case 'copy': if (outEl.value) copy(outEl.value); else toast(t('base64.nothingToCopy')); break;
      case 'download': doDownload(); break;
      case 'clear':
        file = null; decoded = null; inEl.value = ''; run(); inEl.focus(); break;
      default: break;
    }
  });

  inEl.addEventListener('input', () => { file = null; run(); });
  for (const el of [urlSafeEl, padEl, dataUriEl]) el.addEventListener('change', run);
  fileEl.addEventListener('change', () => { loadFile(fileEl.files[0]); fileEl.value = ''; });
  grid.addEventListener('dragover', (e) => { e.preventDefault(); grid.classList.add('dragover'); });
  grid.addEventListener('dragleave', () => grid.classList.remove('dragover'));
  grid.addEventListener('drop', (e) => {
    grid.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); loadFile(e.dataTransfer.files[0]); }
  });
  window.addEventListener('jb:langchange', run);
  document.addEventListener('DOMContentLoaded', run);
})();
