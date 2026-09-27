// The tool catalogue: one list drives the hub grid, its search box and the
// "More free tools" links on every tool page. Names/descriptions live in i18n.js
// as tool.<id>.name / tool.<id>.desc.
(function (root) {
  'use strict';

  const TOOLS = [
    { id: 'json', path: '/json-formatter/', icon: '{ }' },
    { id: 'base64', path: '/base64/', icon: '64' },
    { id: 'jwt', path: '/jwt-decoder/', icon: 'JWT' },
    { id: 'csv', path: '/csv-json/', icon: 'CSV' },
    { id: 'url', path: '/url-encode/', icon: '%' },
    { id: 'uuid', path: '/uuid-generator/', icon: 'ID' },
    { id: 'timestamp', path: '/timestamp-converter/', icon: '⏱' },
  ];

  function el(tag, props, children) {
    const e = document.createElement(tag);
    Object.assign(e, props || {});
    for (const c of children || []) e.append(c);
    return e;
  }
  function i18nText(tag, key, className) {
    const e = el(tag, { className: className || '' });
    e.dataset.i18n = key;
    e.textContent = root.JBI18N.t(key);
    return e;
  }

  function card(tool) {
    const a = el('a', { className: 'tool-card', href: tool.path });
    a.dataset.toolId = tool.id;
    a.append(
      el('span', { className: 'tool-icon', textContent: tool.icon, ariaHidden: 'true' }),
      el('span', { className: 'tool-text' }, [
        i18nText('strong', 'tool.' + tool.id + '.name'),
        i18nText('span', 'tool.' + tool.id + '.desc', 'tool-desc'),
      ]),
    );
    return a;
  }

  // Matches the query against both languages so either script finds the tool.
  function matches(tool, q) {
    if (!q) return true;
    const S = root.JBI18N.STRINGS;
    const hay = [tool.id, tool.path]
      .concat(['en', 'bn'].flatMap((l) => [S[l]['tool.' + tool.id + '.name'], S[l]['tool.' + tool.id + '.desc']]))
      .join(' ')
      .toLowerCase();
    return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
  }

  function renderGrid(grid) {
    for (const tool of TOOLS) grid.append(card(tool));
    const search = document.getElementById('tool-search');
    const empty = document.getElementById('tool-empty');
    if (!search) return;
    search.addEventListener('input', () => {
      const q = search.value.trim();
      let shown = 0;
      for (const c of grid.children) {
        const tool = TOOLS.find((x) => x.id === c.dataset.toolId);
        const ok = matches(tool, q);
        c.hidden = !ok;
        if (ok) shown++;
      }
      if (empty) empty.hidden = shown > 0;
    });
  }

  function renderMore(list, current) {
    for (const tool of TOOLS) {
      if (tool.id === current) continue;
      list.append(el('li', {}, [card(tool)]));
    }
  }

  function renderYear() {
    const y = root.JBI18N.num(new Date().getFullYear());
    for (const e of document.querySelectorAll('[data-year]')) e.textContent = y;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const current = document.documentElement.dataset.tool || '';
    for (const grid of document.querySelectorAll('[data-tool-grid]')) renderGrid(grid);
    for (const list of document.querySelectorAll('[data-more-tools]')) renderMore(list, current);
    renderYear();
  });
  root.addEventListener('jb:langchange', renderYear);

  // ---- Shared helpers for tool pages ----
  let toastTimer;
  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) {
      t = el('div', { id: 'toast', className: 'toast' });
      t.setAttribute('role', 'status');
      document.body.append(t);
    }
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
  }
  async function copy(text) {
    const t = root.JBI18N.t;
    try {
      await navigator.clipboard.writeText(text);
      toast(t('toast.copied'));
    } catch (e) {
      toast(t('toast.copyFailed'));
    }
  }
  // `data` may be a string (saved as UTF-8 text) or binary (Uint8Array / ArrayBuffer / Blob).
  function download(data, name, mime) {
    const type = typeof data === 'string' ? (mime || 'text/plain') + ';charset=utf-8' : (mime || 'application/octet-stream');
    const a = el('a', { href: URL.createObjectURL(new Blob([data], { type })), download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  root.JBTOOLS = { TOOLS, matches, toast, copy, download };
})(typeof self !== 'undefined' ? self : this);
