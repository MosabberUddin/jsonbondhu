// CSV <-> JSON converter page. Loaded with `defer` from <head>: runs after the DOM is
// parsed but before DOMContentLoaded, so the strings below exist for i18n's first apply().
(function () {
  'use strict';
  const I18N = window.JBI18N;
  const t = I18N.t;
  const C = window.JBCSV;
  const { copy, download, toast } = window.JBTOOLS;

  I18N.extend({
    en: {
      'csv.title': 'CSV to JSON & JSON to CSV Converter — free, online | JSON Bondhu',
      'csv.direction': 'Conversion direction',
      'csv.dir.csv2json': 'CSV → JSON',
      'csv.dir.json2csv': 'JSON → CSV',
      'csv.swap': '⇄ Swap',
      'csv.swap.title': 'Use the output as the new input and switch direction',
      'csv.delimiter': 'Delimiter',
      'csv.delim.auto': 'Auto-detect',
      'csv.delim.autoFound': 'Auto-detect ({name})',
      'csv.delim.comma': 'Comma ,',
      'csv.delim.semicolon': 'Semicolon ;',
      'csv.delim.tab': 'Tab',
      'csv.delim.pipe': 'Pipe |',
      'csv.name.comma': 'comma',
      'csv.name.semicolon': 'semicolon',
      'csv.name.tab': 'tab',
      'csv.name.pipe': 'pipe',
      'csv.header': 'First row is header',
      'csv.headerRow': 'Include header row',
      'csv.rowsAs': 'Rows as',
      'csv.rows.objects': 'Objects',
      'csv.rows.arrays': 'Arrays',
      'csv.infer': 'Detect numbers, true/false, null',
      'csv.trim': 'Trim spaces',
      'csv.nest': 'Rebuild nested objects (a.b → {"a":{"b"}})',
      'csv.guard': 'Protect against spreadsheet formulas',
      'csv.guard.help': "Cells that start with = + - or @ can run as formulas when the CSV is opened in Excel or Google Sheets. When this is on, such text cells get a leading ' so they are shown as plain text. Leave it off if another program needs the exact values.",
      'csv.in.csv': 'CSV input',
      'csv.in.json': 'JSON input',
      'csv.out.json': 'JSON output',
      'csv.out.csv': 'CSV output',
      'csv.in.placeholder': 'Paste CSV or JSON here, or drop a file…\n\nYour data never leaves your browser.',
      'csv.preview': 'Preview',
      'csv.preview.first': 'Showing the first {shown} of {total} rows. The output contains all rows.',
      'csv.status.empty': 'Paste data, open a file or try the sample.',
      'csv.status.working': 'Converting…',
      'csv.status.csv': '{rows} rows × {cols} columns · delimiter: {delim}',
      'csv.status.json': '{rows} rows × {cols} columns',
      'csv.status.ragged': '{n} rows have a different number of fields than the header ({expected}) — lines {lines}',
      'csv.status.unclosed': 'A quoted field starting on line {line} is never closed — the rest of the file was read into it.',
      'csv.err.json': 'Invalid JSON — check the input or switch to CSV → JSON.',
      'csv.nothing': 'Nothing to copy',
      'csv.out.truncated': 'The output is large (about {size} MB), so only the beginning is shown here. Copy and Download include everything.',
    },
    bn: {
      'csv.title': 'CSV থেকে JSON ও JSON থেকে CSV কনভার্টার — ফ্রি, অনলাইন | JSON বন্ধু',
      'csv.direction': 'রূপান্তরের দিক',
      'csv.dir.csv2json': 'CSV → JSON',
      'csv.dir.json2csv': 'JSON → CSV',
      'csv.swap': '⇄ অদলবদল',
      'csv.swap.title': 'আউটপুটকে নতুন ইনপুট বানান এবং দিক বদলান',
      'csv.delimiter': 'ডিলিমিটার',
      'csv.delim.auto': 'স্বয়ংক্রিয়',
      'csv.delim.autoFound': 'স্বয়ংক্রিয় ({name})',
      'csv.delim.comma': 'কমা ,',
      'csv.delim.semicolon': 'সেমিকোলন ;',
      'csv.delim.tab': 'ট্যাব',
      'csv.delim.pipe': 'পাইপ |',
      'csv.name.comma': 'কমা',
      'csv.name.semicolon': 'সেমিকোলন',
      'csv.name.tab': 'ট্যাব',
      'csv.name.pipe': 'পাইপ',
      'csv.header': 'প্রথম সারি হেডার',
      'csv.headerRow': 'হেডার সারি রাখুন',
      'csv.rowsAs': 'সারির রূপ',
      'csv.rows.objects': 'অবজেক্ট',
      'csv.rows.arrays': 'অ্যারে',
      'csv.infer': 'সংখ্যা, true/false, null চিনে নিন',
      'csv.trim': 'বাড়তি স্পেস বাদ দিন',
      'csv.nest': 'নেস্টেড অবজেক্ট আবার তৈরি করুন (a.b → {"a":{"b"}})',
      'csv.guard': 'স্প্রেডশিট ফর্মুলা থেকে সুরক্ষা',
      'csv.guard.help': "= + - বা @ দিয়ে শুরু হওয়া ঘর Excel বা Google Sheets-এ খুললে ফর্মুলা হিসেবে চলে যেতে পারে। এটি চালু থাকলে এমন টেক্সট ঘরের শুরুতে একটি ' বসে, ফলে সেগুলো সাধারণ লেখা হিসেবে দেখায়। অন্য কোনো প্রোগ্রামে হুবহু মান দরকার হলে এটি বন্ধ রাখুন।",
      'csv.in.csv': 'CSV ইনপুট',
      'csv.in.json': 'JSON ইনপুট',
      'csv.out.json': 'JSON আউটপুট',
      'csv.out.csv': 'CSV আউটপুট',
      'csv.in.placeholder': 'এখানে CSV বা JSON পেস্ট করুন, অথবা ফাইল টেনে আনুন…\n\nআপনার ডেটা ব্রাউজারের বাইরে যায় না।',
      'csv.preview': 'প্রিভিউ',
      'csv.preview.first': 'মোট {total}টি সারির প্রথম {shown}টি দেখানো হচ্ছে। আউটপুটে সব সারি আছে।',
      'csv.status.empty': 'ডেটা পেস্ট করুন, ফাইল খুলুন অথবা নমুনা দেখুন।',
      'csv.status.working': 'রূপান্তর হচ্ছে…',
      'csv.status.csv': '{rows}টি সারি × {cols}টি কলাম · ডিলিমিটার: {delim}',
      'csv.status.json': '{rows}টি সারি × {cols}টি কলাম',
      'csv.status.ragged': '{n}টি সারিতে হেডারের ({expected}) চেয়ে আলাদা সংখ্যক ঘর আছে — লাইন {lines}',
      'csv.status.unclosed': '{line} নম্বর লাইনে শুরু হওয়া একটি উদ্ধৃতি (") বন্ধ হয়নি — ফাইলের বাকি অংশ ওই ঘরেই পড়া হয়েছে।',
      'csv.err.json': 'JSON সঠিক নয় — ইনপুট দেখুন অথবা CSV → JSON বেছে নিন।',
      'csv.nothing': 'কপি করার মতো কিছু নেই',
      'csv.out.truncated': 'আউটপুট অনেক বড় (প্রায় {size} MB), তাই এখানে শুধু শুরুর অংশ দেখানো হচ্ছে। কপি ও ডাউনলোডে সবকিছু থাকবে।',
    },
  });

  const $ = (s) => document.querySelector(s);
  const input = $('#csv-in');
  const output = $('#csv-out');
  const table = $('#csv-table');
  const note = $('#preview-note');
  const outNote = $('#out-note');
  const statusEl = $('#status');
  const fileEl = $('#csv-file');
  const inPane = $('#in-pane');
  const autoOpt = $('#csv-delim option[value=auto]');
  const PREVIEW_ROWS = 50;
  const NAMES = { ',': 'comma', ';': 'semicolon', '\t': 'tab', '|': 'pipe' };

  let dir = 'csv2json';
  let outText = '';       // exact output (the textarea normalizes CRLF)
  let fileBase = 'data';
  let renderStatus = () => {}; // re-run on language change
  let renderNote = () => {};
  let detected = '';

  const SAMPLE_CSV = [
    'id,name,phone,active,score,address.city,address.zip,note',
    '00123,রহিম উদ্দিন,01712345678,true,88.5,ঢাকা,1207,"বলল ""হ্যালো"""',
    '00124,"Karim, Jr.",+8801812345678,false,,Chattogram,4000,',
    '00125,Nusrat Jahan,01911223344,TRUE,92,সিলেট,3100,"দুই\nলাইন"',
  ].join('\r\n');
  const SAMPLE_JSON = JSON.stringify([
    { id: '00123', name: 'রহিম উদ্দিন', active: true, score: 88.5, address: { city: 'ঢাকা', zip: '1207' }, tags: ['admin', 'bn'] },
    { id: '00124', name: 'Karim, Jr.', active: false, score: null, address: { city: 'Chattogram', zip: '4000' }, tags: [] },
    { id: '00125', name: 'Nusrat Jahan', active: true, score: 92, address: { city: 'সিলেট', zip: '3100' }, note: '=1+1' },
  ], null, 2);

  function delimValue(sel) {
    const v = $(sel).value;
    return v === 'tab' ? '\t' : v;
  }

  function setStatus(fn, cls) {
    renderStatus = fn;
    statusEl.className = 'status' + (cls ? ' ' + cls : '');
    fn();
  }

  function updateAutoLabel() {
    autoOpt.textContent = detected ? t('csv.delim.autoFound', { name: t('csv.name.' + NAMES[detected]) }) : t('csv.delim.auto');
  }

  // Painting multi-MB text into a textarea takes seconds, so only the start is
  // shown; Copy, Download and Swap always use the full output (outText).
  const DISPLAY_LIMIT = 200000;
  let renderOutNote = () => {};
  function showOutput(text) {
    outText = text;
    if (text.length <= DISPLAY_LIMIT) {
      output.value = text;
      outNote.hidden = true;
      renderOutNote = () => {};
      return;
    }
    let cut = text.lastIndexOf('\n', DISPLAY_LIMIT);
    if (cut < DISPLAY_LIMIT / 2) cut = DISPLAY_LIMIT;
    output.value = text.slice(0, cut) + '\n…';
    const mb = Math.round(text.length / 104857.6) / 10;
    renderOutNote = () => { outNote.textContent = t('csv.out.truncated', { size: mb }); };
    renderOutNote();
    outNote.hidden = false;
  }

  // ---------- Preview table (DOM APIs only) ----------
  function renderTable(tbl, total) {
    table.textContent = '';
    if (!tbl || !tbl.rows.length) { note.textContent = ''; renderNote = () => {}; return; }
    const rows = tbl.rows.slice(0, PREVIEW_ROWS);
    let width = tbl.headers ? tbl.headers.length : 0;
    for (const r of rows) if (r.length > width) width = r.length;
    const headers = tbl.headers || Array.from({ length: width }, (_, i) => 'col' + (i + 1));
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    const corner = document.createElement('th');
    corner.textContent = '#';
    corner.scope = 'col';
    hr.append(corner);
    for (let c = 0; c < width; c++) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = c < headers.length ? headers[c] : 'col' + (c + 1);
      th.title = th.textContent;
      hr.append(th);
    }
    thead.append(hr);
    const tbody = document.createElement('tbody');
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      const n = document.createElement('td');
      n.className = 'num';
      n.textContent = I18N.num(i + 1);
      tr.append(n);
      for (let c = 0; c < width; c++) {
        const td = document.createElement('td');
        const v = r[c];
        if (v === null || v === undefined) { td.className = 'null'; td.textContent = v === null ? 'null' : ''; }
        else td.textContent = String(v);
        if (td.textContent.length > 28) td.title = td.textContent;
        tr.append(td);
      }
      tbody.append(tr);
    });
    table.append(thead, tbody);
    renderNote = () => {
      note.textContent = total > PREVIEW_ROWS ? t('csv.preview.first', { shown: PREVIEW_ROWS, total }) : '';
      for (const td of tbody.querySelectorAll('td.num')) td.textContent = I18N.num(td.parentNode.rowIndex);
    };
    renderNote();
  }

  // ---------- Conversion ----------
  function convert() {
    clearTimeout(timer);
    const text = input.value;
    detected = '';
    if (!text.trim()) {
      showOutput('');
      renderTable(null);
      updateAutoLabel();
      setStatus(() => { statusEl.textContent = t('csv.status.empty'); });
      return;
    }
    if (dir === 'csv2json') csvToJson(text);
    else jsonToCsv(text);
    updateAutoLabel();
  }

  function csvToJson(text) {
    const sel = delimValue('#csv-delim');
    const arrays = $('#csv-rows').value === 'arrays';
    const header = $('#csv-header').checked;
    const res = C.csvToJson(text, {
      delimiter: sel === 'auto' ? undefined : sel,
      header, arrays,
      infer: $('#csv-infer').checked,
      trim: $('#csv-trim').checked,
      nest: $('#csv-nest').checked,
    });
    if (sel === 'auto') detected = res.delimiter;
    outText = JSON.stringify(res.data, null, 2);
    showOutput(outText);
    const preview = arrays
      ? { headers: header ? res.headers : null, rows: res.data.slice(header ? 1 : 0, PREVIEW_ROWS + (header ? 1 : 0)) }
      : C.jsonToTable(res.data.slice(0, PREVIEW_ROWS));
    renderTable(preview, res.rowCount);
    const warn = res.ragged.length || res.unclosedQuote;
    setStatus(() => {
      statusEl.textContent = t('csv.status.csv', { rows: res.rowCount, cols: res.colCount, delim: t('csv.name.' + NAMES[res.delimiter]) });
      if (res.ragged.length) {
        const shown = res.ragged.slice(0, 8).map((r) => I18N.num(r.line)).join(', ') + (res.ragged.length > 8 ? '…' : '');
        const s = document.createElement('small');
        s.textContent = t('csv.status.ragged', { n: res.ragged.length, expected: res.ragged[0].expected, lines: shown });
        statusEl.append(s);
      }
      if (res.unclosedQuote) {
        const s = document.createElement('small');
        s.textContent = t('csv.status.unclosed', { line: res.unclosedQuote });
        statusEl.append(s);
      }
    }, warn ? 'warn' : 'ok');
  }

  function jsonToCsv(text) {
    let value;
    try {
      value = JSON.parse(C.stripBom(text));
    } catch (e) {
      showOutput('');
      renderTable(null);
      const detail = String(e && e.message);
      setStatus(() => {
        statusEl.textContent = t('csv.err.json');
        const s = document.createElement('small');
        s.textContent = detail;
        statusEl.append(s);
      }, 'err');
      return;
    }
    const tbl = C.jsonToTable(value);
    outText = C.tableToCsv(tbl, {
      delimiter: delimValue('#json-delim'),
      header: $('#json-header').checked,
      guard: $('#json-guard').checked,
    });
    showOutput(outText);
    renderTable({ headers: tbl.headers, rows: tbl.rows.slice(0, PREVIEW_ROWS) }, tbl.rows.length);
    let cols = tbl.headers ? tbl.headers.length : 0;
    if (!tbl.headers) for (const r of tbl.rows) if (r.length > cols) cols = r.length;
    const rows = tbl.rows.length;
    setStatus(() => { statusEl.textContent = t('csv.status.json', { rows, cols }); }, 'ok');
  }

  // Debounce typing; wait longer for big inputs so a 5 MB paste doesn't re-parse per key.
  let timer;
  function schedule() {
    clearTimeout(timer);
    const n = input.value.length;
    const wait = n > 1e6 ? 800 : n > 1e5 ? 350 : 150;
    if (n > 1e6) setStatus(() => { statusEl.textContent = t('csv.status.working'); });
    timer = setTimeout(convert, wait);
  }

  function setDir(next) {
    dir = next;
    for (const b of document.querySelectorAll('[data-dir]')) b.setAttribute('aria-pressed', String(b.dataset.dir === dir));
    for (const f of document.querySelectorAll('form[data-for]')) f.hidden = f.dataset.for !== dir;
    const inKey = dir === 'csv2json' ? 'csv.in.csv' : 'csv.in.json';
    const outKey = dir === 'csv2json' ? 'csv.out.json' : 'csv.out.csv';
    $('#in-label').dataset.i18n = inKey;
    $('#in-label').textContent = t(inKey);
    $('#out-label').dataset.i18n = outKey;
    $('#out-label').textContent = t(outKey);
  }

  function loadText(text, name) {
    input.value = text;
    if (name) {
      const ext = (name.match(/\.([^.]+)$/) || [])[1];
      const lower = (ext || '').toLowerCase();
      if (lower === 'json') setDir('json2csv');
      else if (lower === 'csv' || lower === 'tsv') setDir('csv2json');
      else setDir(/^\s*[[{]/.test(C.stripBom(text.slice(0, 200))) ? 'json2csv' : 'csv2json');
      fileBase = name.replace(/\.[^.]+$/, '') || 'data';
    }
    convert();
  }

  function loadFile(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      loadText(String(r.result), file.name);
      toast(t('toast.opened', { name: file.name }));
    };
    r.onerror = () => toast(t('toast.readFailed'));
    r.readAsText(file);
  }

  const actions = {
    swap() {
      const next = dir === 'csv2json' ? 'json2csv' : 'csv2json';
      const text = outText;
      setDir(next);
      input.value = text;
      convert();
    },
    open() { fileEl.click(); },
    async paste() {
      try {
        const text = await navigator.clipboard.readText();
        loadText(text);
      } catch (e) {
        input.focus();
        toast(t('toast.pasteManually'));
      }
    },
    sample() {
      fileBase = 'data';
      loadText(dir === 'csv2json' ? SAMPLE_CSV : SAMPLE_JSON);
    },
    clear() {
      fileBase = 'data';
      loadText('');
      input.focus();
    },
    copy() {
      if (!outText) return toast(t('csv.nothing'));
      copy(outText);
    },
    download() {
      if (!outText) return toast(t('toast.nothingToDownload'));
      if (dir === 'csv2json') download(outText + '\n', fileBase + '.json', 'application/json');
      // UTF-8 BOM so Excel shows Bangla correctly.
      else download('﻿' + outText + '\r\n', fileBase + '.csv', 'text/csv');
    },
  };

  document.addEventListener('click', (e) => {
    const d = e.target.closest('[data-dir]');
    if (d) { if (d.dataset.dir !== dir) { setDir(d.dataset.dir); convert(); } return; }
    const act = e.target.closest('[data-act]');
    if (act && actions[act.dataset.act]) actions[act.dataset.act]();
  });
  for (const f of document.querySelectorAll('form[data-for]')) {
    f.addEventListener('submit', (e) => { e.preventDefault(); convert(); });
    f.addEventListener('change', convert);
  }
  input.addEventListener('input', schedule);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); convert(); }
  });
  fileEl.addEventListener('change', () => { loadFile(fileEl.files[0]); fileEl.value = ''; });
  inPane.addEventListener('dragover', (e) => { e.preventDefault(); inPane.classList.add('dragover'); });
  inPane.addEventListener('dragleave', () => inPane.classList.remove('dragover'));
  inPane.addEventListener('drop', (e) => {
    e.preventDefault();
    inPane.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
  });

  window.addEventListener('jb:langchange', () => {
    const cls = statusEl.className;
    statusEl.textContent = '';
    renderStatus();
    statusEl.className = cls;
    renderNote();
    renderOutNote();
    updateAutoLabel();
  });
  document.addEventListener('DOMContentLoaded', () => {
    setDir(dir);
    convert();
  });
})();
