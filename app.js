(function () {
  'use strict';
  const JB = window.JB;
  const I18N = window.JBI18N;
  const t = I18N.t;
  const $ = (s) => document.querySelector(s);
  const input = $('#input');
  const output = $('#output');
  const statusEl = $('#status');
  const treeEl = $('#tree');
  const pathEl = $('#path');
  const STORE_KEY = 'jb_last_input';
  const MAX_TREE_NODES = 50000;

  const SAMPLES = {
    en: {
      name: 'Rahim Uddin', age: 28, city: 'Dhaka', developer: true, website: null,
      skills: ['JavaScript', 'Python', 'SQL'],
      address: { area: 'Mirpur', postcode: '1216', country: 'Bangladesh' },
      projects: [
        { title: 'E-commerce API', stars: 120 },
        { title: 'Bangla font converter', stars: 85 },
      ],
    },
    bn: {
      নাম: 'রহিম উদ্দিন', বয়স: 28, শহর: 'ঢাকা', ডেভেলপার: true, ওয়েবসাইট: null,
      দক্ষতা: ['JavaScript', 'Python', 'SQL'],
      ঠিকানা: { এলাকা: 'মিরপুর', পোস্টকোড: '1216', দেশ: 'বাংলাদেশ' },
      প্রজেক্ট: [
        { শিরোনাম: 'ই-কমার্স API', তারকা: 120 },
        { শিরোনাম: 'বাংলা ফন্ট কনভার্টার', তারকা: 85 },
      ],
    },
  };

  let parsed;          // last successfully parsed value
  let parsedFrom = null; // the text it was parsed from
  let lastFileName = 'data';

  // ---------- helpers ----------
  function store(get, val) {
    try {
      if (get) return localStorage.getItem(STORE_KEY);
      localStorage.setItem(STORE_KEY, val);
    } catch (e) { /* storage unavailable (private mode etc.) */ }
    return null;
  }
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 1800);
  }
  // The status line stores its message key so it can be re-rendered on a language switch.
  let lastStatus = { kind: '', key: 'status.ready', vars: null, detail: null };
  function renderStatus() {
    const { kind, key, vars, detail } = lastStatus;
    statusEl.className = 'status ' + (kind || '');
    statusEl.textContent = t(key, vars && vars());
    if (detail) {
      const s = document.createElement('small');
      s.textContent = detail;
      statusEl.appendChild(s);
    }
  }
  // vars is a function so values like sizes are re-localized on a language switch.
  function setStatus(kind, key, vars, detail) {
    lastStatus = { kind, key, vars: vars || null, detail: detail || null };
    renderStatus();
  }
  function sizeLabel(bytes) {
    if (bytes < 1024) return t('size.bytes', { n: bytes });
    if (bytes < 1048576) return I18N.num((bytes / 1024).toFixed(1)) + ' KB';
    return I18N.num((bytes / 1048576).toFixed(2)) + ' MB';
  }
  function indentValue() {
    const v = $('#indent').value;
    return v === 'tab' ? '\t' : +v;
  }
  function download(text, name, mime) {
    const blob = new Blob([text], { type: mime + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast(t('toast.copied'));
    } catch (e) {
      toast(t('toast.copyFailed'));
    }
  }

  // Parse the editor content; report errors in Bangla and move the caret to them.
  function parse(quiet) {
    const text = input.value;
    if (!text.trim()) {
      parsed = undefined; parsedFrom = null;
      if (!quiet) setStatus('warn', 'status.empty');
      return false;
    }
    if (text === parsedFrom) return true;
    try {
      parsed = JSON.parse(text);
      parsedFrom = text;
      const st = JB.stats(parsed);
      const bytes = new Blob([text]).size;
      setStatus('ok', 'status.valid', () => ({ size: sizeLabel(bytes), nodes: st.nodes, depth: st.depth }));
      return true;
    } catch (err) {
      parsed = undefined; parsedFrom = null;
      const loc = JB.errorLocation(err, text);
      setStatus('err', 'status.invalid',
        () => ({ where: loc ? t('status.where', { line: loc.line, col: loc.col }) : '' }), err.message);
      if (loc && !quiet) {
        input.focus();
        input.setSelectionRange(loc.pos, Math.min(loc.pos + 1, text.length));
      }
      return false;
    }
  }

  function setInput(text) {
    input.value = text;
    store(false, text);
    parse(true);
    if (currentTab === 'tree') renderTree();
  }

  function sortKeys(v) {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (!JB.isContainer(v)) return v;
    const o = {};
    for (const k of Object.keys(v).sort((a, b) => a.localeCompare(b))) o[k] = sortKeys(v[k]);
    return o;
  }

  // ---------- tree view ----------
  let nodeCount = 0;
  function leafValue(v) {
    const span = document.createElement('span');
    if (v === null) { span.className = 'null'; span.textContent = 'null'; }
    else if (typeof v === 'string') { span.className = 'str'; span.textContent = JSON.stringify(v); }
    else if (typeof v === 'number') { span.className = 'num'; span.textContent = String(v); }
    else { span.className = 'bool'; span.textContent = String(v); }
    return span;
  }
  function keySpan(label, path) {
    const k = document.createElement('span');
    k.className = 'key';
    k.textContent = label;
    k.dataset.path = path;
    return k;
  }
  function buildNode(label, v, path, depth) {
    nodeCount++;
    if (!JB.isContainer(v) || !Object.keys(v).length) {
      const d = document.createElement('div');
      d.className = 'leaf';
      if (label !== null) d.append(keySpan(label, path), ': ');
      d.append(JB.isContainer(v) ? Object.assign(document.createElement('span'), { className: 'meta', textContent: Array.isArray(v) ? '[ ]' : '{ }' }) : leafValue(v));
      return d;
    }
    const det = document.createElement('details');
    const sum = document.createElement('summary');
    const isArr = Array.isArray(v);
    const n = isArr ? v.length : Object.keys(v).length;
    if (label !== null) sum.append(keySpan(label, path), ' ');
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = t(isArr ? 'tree.items' : 'tree.keys', { n });
    sum.append(meta);
    det.append(sum);
    det._value = v;
    det._path = path;
    det._depth = depth;
    det.addEventListener('toggle', () => { if (det.open) fill(det); });
    if (depth < 2 && n <= 200) { fill(det); det.open = true; }
    return det;
  }
  // Children are built lazily so huge documents stay responsive.
  function fill(det) {
    if (det._filled) return;
    det._filled = true;
    const v = det._value;
    const isArr = Array.isArray(v);
    const frag = document.createDocumentFragment();
    for (const k of Object.keys(v)) {
      const childPath = JB.pathJoin(det._path, k, isArr);
      frag.append(buildNode(isArr ? k : k, v[k], childPath, det._depth + 1));
    }
    det.append(frag);
  }
  function renderTree() {
    treeEl.textContent = '';
    nodeCount = 0;
    if (!parse(true)) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = t(input.value.trim() ? 'tree.invalid' : 'tree.empty');
      treeEl.append(p);
      return;
    }
    treeEl.append(buildNode(null, parsed, '$', 0));
    pathEl.textContent = '$';
  }
  function expandAll() {
    for (;;) {
      const closed = treeEl.querySelectorAll('details:not([open])');
      if (!closed.length) return true;
      for (const d of closed) {
        if (nodeCount > MAX_TREE_NODES) {
          toast(t('toast.tooBig'));
          return false;
        }
        fill(d);
        d.open = true;
      }
    }
  }
  function search(q) {
    for (const m of treeEl.querySelectorAll('mark')) m.replaceWith(m.textContent);
    treeEl.normalize();
    if (!q) return;
    expandAll();
    const needle = q.toLowerCase();
    let first = null, count = 0;
    for (const el of treeEl.querySelectorAll('.key, .str, .num, .bool, .null')) {
      const t = el.textContent;
      const i = t.toLowerCase().indexOf(needle);
      if (i < 0) continue;
      const mark = document.createElement('mark');
      mark.textContent = t.slice(i, i + q.length);
      el.textContent = '';
      el.append(t.slice(0, i), mark, t.slice(i + q.length));
      first = first || mark;
      count++;
    }
    if (first) first.scrollIntoView({ block: 'center' });
    toast(count ? t('toast.matches', { n: count }) : t('toast.noMatches'));
  }

  // ---------- tabs ----------
  let currentTab = 'text';
  function showTab(name) {
    currentTab = name;
    for (const t of document.querySelectorAll('.tab')) {
      const on = t.dataset.tab === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on);
    }
    for (const p of document.querySelectorAll('.panel')) p.hidden = p.dataset.panel !== name;
    if (name === 'tree') renderTree();
  }

  // ---------- actions ----------
  const actions = {
    format() {
      if (!parse()) return;
      setInput(JSON.stringify(parsed, null, indentValue()));
    },
    minify() {
      if (!parse()) return;
      setInput(JSON.stringify(parsed));
    },
    validate() { parse(); },
    repair() {
      const fixed = JB.repair(input.value);
      try {
        const v = JSON.parse(fixed);
        setInput(JSON.stringify(v, null, indentValue()));
        toast(t('toast.repaired'));
      } catch (e) {
        parse();
        toast(t('toast.repairFailed'));
      }
    },
    sort() {
      if (!parse()) return;
      setInput(JSON.stringify(sortKeys(parsed), null, indentValue()));
      toast(t('toast.sorted'));
    },
    async paste() {
      try {
        setInput(await navigator.clipboard.readText());
        actions.format();
      } catch (e) {
        input.focus();
        toast(t('toast.pasteManually'));
      }
    },
    copy() { copyText(input.value); },
    open() { $('#file').click(); },
    download() {
      if (!input.value) return toast(t('toast.nothingToDownload'));
      download(input.value, lastFileName.replace(/\.json$/i, '') + '.json', 'application/json');
    },
    sample() {
      setInput(JSON.stringify(SAMPLES[I18N.lang] || SAMPLES.en, null, indentValue()));
      setStatus('ok', 'status.sample');
    },
    clear() {
      setInput('');
      output.value = '';
      treeEl.textContent = '';
      setStatus('', 'status.ready');
      input.focus();
    },
    expand() { expandAll(); },
    collapse() {
      for (const d of treeEl.querySelectorAll('details[open]')) d.open = false;
      const root = treeEl.querySelector('details');
      if (root) root.open = true;
    },
    copypath() { copyText(pathEl.textContent); },
    convert() {
      if (!parse()) { output.value = ''; return; }
      const t = $('#target').value;
      output.value = t === 'csv' ? JB.toCsv(parsed) : t === 'yaml' ? JB.toYaml(parsed) : JB.toXml(parsed);
    },
    copyout() {
      if (!output.value) actions.convert();
      if (output.value) copyText(output.value);
    },
    downloadout() {
      if (!output.value) actions.convert();
      if (!output.value) return;
      const t = $('#target').value;
      const base = lastFileName.replace(/\.json$/i, '');
      // BOM makes Excel open UTF-8 CSV with Bangla text correctly.
      if (t === 'csv') download('﻿' + output.value, base + '.csv', 'text/csv');
      else if (t === 'yaml') download(output.value, base + '.yaml', 'text/yaml');
      else download(output.value, base + '.xml', 'application/xml');
    },
  };

  function loadFile(file) {
    if (!file) return;
    lastFileName = file.name;
    const r = new FileReader();
    r.onload = () => {
      setInput(String(r.result));
      if (parse()) actions.format();
      toast(t('toast.opened', { name: file.name }));
    };
    r.onerror = () => toast(t('toast.readFailed'));
    r.readAsText(file);
  }

  // ---------- wiring ----------
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (btn && actions[btn.dataset.act]) { actions[btn.dataset.act](); return; }
    const tab = e.target.closest('.tab');
    if (tab) { showTab(tab.dataset.tab); return; }
    const key = e.target.closest('.tree .key');
    if (key) {
      e.preventDefault(); // don't toggle the <details> when picking a path
      pathEl.textContent = key.dataset.path;
      pathEl.title = key.dataset.path;
    }
  });
  $('#file').addEventListener('change', (e) => { loadFile(e.target.files[0]); e.target.value = ''; });
  $('#target').addEventListener('change', actions.convert);
  let searchTimer;
  $('#search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => search(e.target.value.trim()), 300);
  });

  let saveTimer;
  input.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { store(false, input.value); parse(true); }, 400);
  });
  input.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); actions.format(); }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      input.setRangeText('  ', input.selectionStart, input.selectionEnd, 'end');
    }
  });

  const textPanel = document.querySelector('[data-panel="text"]');
  textPanel.addEventListener('dragover', (e) => { e.preventDefault(); textPanel.classList.add('dragover'); });
  textPanel.addEventListener('dragleave', () => textPanel.classList.remove('dragover'));
  textPanel.addEventListener('drop', (e) => {
    e.preventDefault();
    textPanel.classList.remove('dragover');
    loadFile(e.dataTransfer.files[0]);
  });

  function renderYear() { $('#year').textContent = I18N.num(new Date().getFullYear()); }
  renderYear();
  renderStatus();
  window.addEventListener('jb:langchange', () => {
    renderYear();
    renderStatus();
    if (currentTab === 'tree') renderTree();
  });
  const saved = store(true);
  if (saved) { input.value = saved; parse(true); }
})();
