// Diff checker page. Loaded with `defer` from <head>: runs after the DOM is parsed
// but before DOMContentLoaded, so the strings below exist for i18n's first apply().
// User text is only ever placed into the page with textContent (never innerHTML).
(function () {
  'use strict';
  const I18N = window.JBI18N;
  const t = I18N.t;
  const D = window.JBDIFF;
  const { copy, toast } = window.JBTOOLS;

  I18N.extend({
    en: {
      'diff.title': 'Diff Checker, Compare Two Texts Online | JSON Bondhu',
      'diff.desc': 'Compare two texts side by side or as a unified diff, with word-level highlights and options to ignore case and spaces. Runs in your browser.',
      'diff.ignoreWs': 'Ignore whitespace',
      'diff.ignoreCase': 'Ignore case',
      'diff.ignoreTrail': 'Ignore trailing spaces',
      'diff.view': 'View',
      'diff.view.side': 'Side by side',
      'diff.view.unified': 'Unified',
      'diff.compare': 'Compare',
      'diff.loadA': 'Load original file',
      'diff.loadB': 'Load changed file',
      'diff.swap': 'Swap sides',
      'diff.copy': 'Copy unified diff',
      'diff.original': 'Original',
      'diff.changed': 'Changed',
      'diff.ph.a': 'Paste the original text here…',
      'diff.ph.b': 'Paste the changed text here…',
      'diff.resultLabel': 'Comparison result',
      'diff.added': '+ {n} added',
      'diff.removed': '- {n} removed',
      'diff.unchanged': '{n} unchanged',
      'diff.identical': 'The two texts are identical.',
      'diff.identicalIgnoring': 'No differences with the current options.',
      'diff.empty': 'Paste text on both sides to compare.',
      'diff.err.chars': 'Too much text: each side can have up to {n} characters.',
      'diff.err.lines': 'Too many lines: each side can have up to {n} lines.',
      'diff.err.file': 'That file is too large to compare here.',
      'diff.truncated': 'These texts are very different, so the changed part is shown as one removal and one addition.',
      'diff.cappedRows': 'Showing the first {n} rows. Use “Copy unified diff” to get the full result.',
      'diff.nothingToCopy': 'No differences to copy',
      'diff.lineA': 'Line in original',
      'diff.lineB': 'Line in changed',
    },
    bn: {
      'diff.title': 'ডিফ চেকার, দুটি লেখা অনলাইনে তুলনা | JSON বন্ধু',
      'diff.desc': 'দুটি লেখা পাশাপাশি বা ইউনিফাইড ডিফে তুলনা করুন। শব্দ ধরে হাইলাইট, বড়-ছোট হরফ ও স্পেস উপেক্ষার অপশন, সবই ব্রাউজারে চলে।',
      'diff.ignoreWs': 'হোয়াইটস্পেস উপেক্ষা',
      'diff.ignoreCase': 'বড়-ছোট হাতের অক্ষর উপেক্ষা',
      'diff.ignoreTrail': 'লাইনের শেষের স্পেস উপেক্ষা',
      'diff.view': 'দেখার ধরন',
      'diff.view.side': 'পাশাপাশি',
      'diff.view.unified': 'ইউনিফাইড',
      'diff.compare': 'তুলনা করুন',
      'diff.loadA': 'মূল ফাইল খুলুন',
      'diff.loadB': 'বদলানো ফাইল খুলুন',
      'diff.swap': 'দুই পাশ অদলবদল',
      'diff.copy': 'ইউনিফাইড ডিফ কপি করুন',
      'diff.original': 'মূল লেখা',
      'diff.changed': 'বদলানো লেখা',
      'diff.ph.a': 'মূল লেখা এখানে পেস্ট করুন…',
      'diff.ph.b': 'বদলানো লেখা এখানে পেস্ট করুন…',
      'diff.resultLabel': 'তুলনার ফলাফল',
      'diff.added': '+ {n}টি যোগ',
      'diff.removed': '- {n}টি বাদ',
      'diff.unchanged': '{n}টি অপরিবর্তিত',
      'diff.identical': 'দুটি লেখা হুবহু একই।',
      'diff.identicalIgnoring': 'বর্তমান অপশন অনুযায়ী কোনো পার্থক্য নেই।',
      'diff.empty': 'তুলনা করতে দুই পাশেই লেখা দিন।',
      'diff.err.chars': 'লেখা অনেক বেশি: প্রতি পাশে সর্বোচ্চ {n} অক্ষর নেওয়া যায়।',
      'diff.err.lines': 'লাইন অনেক বেশি: প্রতি পাশে সর্বোচ্চ {n} লাইন নেওয়া যায়।',
      'diff.err.file': 'ফাইলটি এখানে তুলনার জন্য অনেক বড়।',
      'diff.truncated': 'লেখা দুটি অনেক আলাদা, তাই বদলানো অংশটি একটি বাদ ও একটি যোগ হিসেবে দেখানো হয়েছে।',
      'diff.cappedRows': 'প্রথম {n}টি সারি দেখানো হচ্ছে। পুরো ফলাফলের জন্য “ইউনিফাইড ডিফ কপি করুন” ব্যবহার করুন।',
      'diff.nothingToCopy': 'কপি করার মতো কোনো পার্থক্য নেই',
      'diff.lineA': 'মূল লেখার লাইন',
      'diff.lineB': 'বদলানো লেখার লাইন',
    },
  });

  const $ = (s) => document.querySelector(s);
  const aEl = $('#diff-a');
  const bEl = $('#diff-b');
  const outEl = $('#diff-out');
  const sumEl = $('#diff-summary');
  const statusEl = $('#status');
  const fileEl = $('#diff-file');
  const MAX_ROWS = 4000;
  const MAX_FILE_BYTES = 4 * 1024 * 1024;

  let result = null;
  let msg = null; // { key, vars, cls } shown in the status bar
  let loadTarget = 'a';
  let timer = 0;

  const opts = () => ({
    ignoreWhitespace: $('#diff-ws').checked,
    ignoreCase: $('#diff-case').checked,
    ignoreTrailing: $('#diff-trail').checked,
  });
  const view = () => $('input[name=diff-view]:checked').value;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function cell(cls, text) { return el('td', cls, text === null || text === undefined ? '' : String(text)); }

  // Builds a text cell. kind is 'del', 'add' or '' ; list holds word segments (or null).
  function textCell(text, list, kind) {
    const td = el('td', 'tx' + (kind ? ' ' + kind : ''));
    if (list) {
      for (const s of list) {
        if (s.changed) td.append(el('span', kind === 'del' ? 'w-del' : 'w-add', s.text));
        else td.append(document.createTextNode(s.text));
      }
    } else td.textContent = text;
    return td;
  }

  function renderSide(rows) {
    const table = el('table', 'diff-table side');
    const tb = el('tbody');
    for (const r of rows) {
      const tr = el('tr', 'r-' + r.type);
      const hasL = r.left !== null;
      const hasR = r.right !== null;
      const lk = r.type === 'eq' ? '' : 'del';
      const rk = r.type === 'eq' ? '' : 'add';
      tr.append(
        cell('ln' + (hasL ? '' : ' empty'), hasL ? r.aNo : ''),
        cell('mk' + (hasL && lk ? ' ' + lk : hasL ? '' : ' empty'), hasL && lk ? '-' : ''),
        hasL ? textCell(r.left, r.leftSegs || null, lk) : cell('tx empty', ''),
        cell('ln' + (hasR ? '' : ' empty'), hasR ? r.bNo : ''),
        cell('mk' + (hasR && rk ? ' ' + rk : hasR ? '' : ' empty'), hasR && rk ? '+' : ''),
        hasR ? textCell(r.right, r.rightSegs || null, rk) : cell('tx empty', ''),
      );
      tb.append(tr);
    }
    table.append(tb);
    return table;
  }

  function renderUnified(rows) {
    const table = el('table', 'diff-table uni');
    const tb = el('tbody');
    const line = (cls, a, b, mark, td) => {
      const tr = el('tr', cls);
      tr.append(cell('ln', a), cell('ln', b), cell('mk' + (cls === 'r-eq' ? '' : cls === 'r-del' ? ' del' : ' add'), mark), td);
      tb.append(tr);
    };
    for (const r of rows) {
      if (r.type === 'eq') line('r-eq', r.aNo, r.bNo, '', textCell(r.left, null, ''));
      if (r.type === 'del' || r.type === 'change') line('r-del', r.aNo, '', '-', textCell(r.left, r.leftSegs || null, 'del'));
      if (r.type === 'add' || r.type === 'change') line('r-add', '', r.bNo, '+', textCell(r.right, r.rightSegs || null, 'add'));
    }
    table.append(tb);
    return table;
  }

  function badge(cls, key, n) {
    const b = el('span', 'badge ' + cls, t(key, { n }));
    b.dataset.count = n;
    return b;
  }

  function render() {
    outEl.textContent = '';
    sumEl.textContent = '';
    let note = msg;
    if (result) {
      const s = result.stats;
      sumEl.append(badge('ok', 'diff.added', s.added), badge('err', 'diff.removed', s.removed), badge('', 'diff.unchanged', s.unchanged));
      sumEl.querySelector('.badge:nth-child(1)').id = 'sum-added';
      sumEl.querySelector('.badge:nth-child(2)').id = 'sum-removed';
      sumEl.querySelector('.badge:nth-child(3)').id = 'sum-unchanged';
      if (!result.identical) {
        const rows = result.rows.length > MAX_ROWS ? result.rows.slice(0, MAX_ROWS) : result.rows;
        outEl.append(view() === 'unified' ? renderUnified(rows) : renderSide(rows));
        if (result.rows.length > MAX_ROWS) note = { key: 'diff.cappedRows', vars: { n: MAX_ROWS }, cls: 'warn' };
        else if (result.truncated) note = { key: 'diff.truncated', cls: 'warn' };
      }
    }
    statusEl.className = 'status' + (note && note.cls ? ' ' + note.cls : '');
    statusEl.textContent = note ? t(note.key, note.vars) : '';
  }

  function run() {
    clearTimeout(timer);
    const a = aEl.value;
    const b = bEl.value;
    result = null;
    if (!a && !b) { msg = { key: 'diff.empty' }; render(); return; }
    const lim = D.checkLimits(a, b);
    if (!lim.ok) { msg = { key: 'diff.err.' + lim.reason, vars: { n: lim.limit }, cls: 'err' }; render(); return; }
    result = D.diffLines(a, b, opts());
    if (result.identical) {
      const o = opts();
      const strict = a.replace(/\r\n?/g, '\n') === b.replace(/\r\n?/g, '\n');
      msg = { key: strict || !(o.ignoreWhitespace || o.ignoreCase || o.ignoreTrailing) ? 'diff.identical' : 'diff.identicalIgnoring', cls: 'ok' };
    } else msg = null;
    render();
  }

  function schedule() { clearTimeout(timer); timer = setTimeout(run, 200); }

  function loadFile(f) {
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) { msg = { key: 'diff.err.file', cls: 'err' }; render(); return; }
    const reader = new FileReader();
    reader.onload = () => {
      (loadTarget === 'a' ? aEl : bEl).value = String(reader.result || '');
      run();
    };
    reader.onerror = () => toast(t('toast.readFailed'));
    reader.readAsText(f);
  }

  document.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'compare': run(); break;
      case 'load-a': loadTarget = 'a'; fileEl.value = ''; fileEl.click(); break;
      case 'load-b': loadTarget = 'b'; fileEl.value = ''; fileEl.click(); break;
      case 'swap': {
        const tmp = aEl.value;
        aEl.value = bEl.value;
        bEl.value = tmp;
        run();
        break;
      }
      case 'clear': aEl.value = ''; bEl.value = ''; run(); break;
      case 'copy': {
        if (!result || result.identical) { toast(t('diff.nothingToCopy')); break; }
        copy(D.unified(result, { labelA: 'original', labelB: 'changed' }));
        break;
      }
    }
  });
  fileEl.addEventListener('change', () => loadFile(fileEl.files[0]));
  aEl.addEventListener('input', schedule);
  bEl.addEventListener('input', schedule);
  $('#diff-form').addEventListener('submit', (e) => { e.preventDefault(); run(); });
  for (const i of document.querySelectorAll('#diff-form input')) i.addEventListener('change', run);
  window.addEventListener('jb:langchange', render);
  document.addEventListener('DOMContentLoaded', run);
})();
