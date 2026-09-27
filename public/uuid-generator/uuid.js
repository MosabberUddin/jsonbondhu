// UUID generator page. Loaded with `defer` from <head>: runs after the DOM is parsed
// but before DOMContentLoaded, so the strings below exist for i18n's first apply().
(function () {
  'use strict';
  const I18N = window.JBI18N;
  const t = I18N.t;
  const U = window.JBUUID;
  const { copy, download } = window.JBTOOLS;

  I18N.extend({
    en: {
      'uuid.title': 'UUID Generator — v4 & v7, bulk, online | JSON Bondhu',
      'uuid.version': 'Version',
      'uuid.v4': 'v4 (random)',
      'uuid.v7': 'v7 (time-ordered)',
      'uuid.count': 'How many',
      'uuid.uppercase': 'Uppercase',
      'uuid.hyphens': 'Hyphens',
      'uuid.braces': 'Braces { }',
      'uuid.generate': 'Generate',
      'uuid.copyAll': 'Copy all',
      'uuid.output': 'Generated UUIDs',
      'uuid.check': 'Check a UUID',
      'uuid.check.placeholder': 'Paste a UUID to validate it…',
      'uuid.valid': 'Valid',
      'uuid.invalid': 'Not a valid UUID',
      'uuid.canonical': 'Standard form',
      'uuid.versionLabel': 'Version',
      'uuid.variant': 'Variant',
      'uuid.created': 'Created',
      'uuid.variant.rfc': 'RFC 9562 (standard)',
      'uuid.variant.ncs': 'NCS (legacy)',
      'uuid.variant.microsoft': 'Microsoft (legacy)',
      'uuid.variant.future': 'Reserved',
      'uuid.variant.nil': 'Nil UUID (all zeros)',
      'uuid.variant.max': 'Max UUID (all ones)',
      'uuid.generated': '{n} UUIDs generated',
    },
    bn: {
      'uuid.title': 'UUID জেনারেটর — v4 ও v7, একসাথে অনেকগুলো | JSON বন্ধু',
      'uuid.version': 'ভার্সন',
      'uuid.v4': 'v4 (র‍্যান্ডম)',
      'uuid.v7': 'v7 (সময় অনুযায়ী সাজানো)',
      'uuid.count': 'কতগুলো',
      'uuid.uppercase': 'বড় হাতের অক্ষর',
      'uuid.hyphens': 'হাইফেন',
      'uuid.braces': 'ব্রেস { }',
      'uuid.generate': 'তৈরি করুন',
      'uuid.copyAll': 'সব কপি',
      'uuid.output': 'তৈরি হওয়া UUID',
      'uuid.check': 'UUID যাচাই করুন',
      'uuid.check.placeholder': 'যাচাই করতে একটি UUID পেস্ট করুন…',
      'uuid.valid': 'সঠিক',
      'uuid.invalid': 'সঠিক UUID নয়',
      'uuid.canonical': 'স্ট্যান্ডার্ড রূপ',
      'uuid.versionLabel': 'ভার্সন',
      'uuid.variant': 'ভ্যারিয়েন্ট',
      'uuid.created': 'তৈরির সময়',
      'uuid.variant.rfc': 'RFC 9562 (স্ট্যান্ডার্ড)',
      'uuid.variant.ncs': 'NCS (পুরোনো)',
      'uuid.variant.microsoft': 'Microsoft (পুরোনো)',
      'uuid.variant.future': 'সংরক্ষিত',
      'uuid.variant.nil': 'Nil UUID (সব শূন্য)',
      'uuid.variant.max': 'Max UUID (সব এক)',
      'uuid.generated': '{n}টি UUID তৈরি হয়েছে',
    },
  });

  const $ = (s) => document.querySelector(s);
  const out = $('#uuid-out');
  const countEl = $('#uuid-count');
  const checkEl = $('#uuid-check');
  const resultEl = $('#uuid-result');
  const statusEl = $('#status');
  const MAX = 1000;

  const random16 = () => crypto.getRandomValues(new Uint8Array(16));

  function generate() {
    const n = Math.min(MAX, Math.max(1, parseInt(countEl.value, 10) || 1));
    countEl.value = n;
    const version = $('input[name=uuid-version]:checked').value;
    const opts = { uppercase: $('#uuid-upper').checked, hyphens: $('#uuid-hyphens').checked, braces: $('#uuid-braces').checked };
    const lines = [];
    let last = '';
    for (let i = 0; i < n; i++) {
      let id = version === '7' ? U.v7(Date.now(), random16) : U.v4(random16);
      // Keep v7 strictly increasing inside one batch (same-millisecond ids).
      if (version === '7' && id <= last) id = U.v7(U.inspect(last).timestampMs + 1, random16);
      last = id;
      lines.push(U.format(id, opts));
    }
    out.value = lines.join('\n');
    statusEl.dataset.n = n;
    statusEl.textContent = t('uuid.generated', { n });
  }

  function row(labelKey, value) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = t(labelKey);
    const td = document.createElement('td');
    td.textContent = value;
    tr.append(th, td);
    return tr;
  }

  function check() {
    resultEl.textContent = '';
    const v = checkEl.value.trim();
    if (!v) return;
    const r = U.inspect(v);
    const badge = document.createElement('span');
    badge.className = 'badge ' + (r.valid ? 'ok' : 'err');
    badge.textContent = r.valid ? '✓ ' + t('uuid.valid') : '✗ ' + t('uuid.invalid');
    const cap = document.createElement('caption');
    cap.append(badge);
    resultEl.append(cap);
    if (!r.valid) return;
    resultEl.append(row('uuid.canonical', r.canonical));
    resultEl.append(row('uuid.versionLabel', 'v' + r.version));
    resultEl.append(row('uuid.variant', t('uuid.variant.' + r.variant)));
    if (r.timestampMs !== undefined) {
      const d = new Date(r.timestampMs);
      const local = new Intl.DateTimeFormat(I18N.lang === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'medium', timeStyle: 'medium' }).format(d);
      resultEl.append(row('uuid.created', local + '  (' + d.toISOString() + ')'));
    }
  }

  document.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'generate') generate();
    if (act.dataset.act === 'copy') copy(out.value);
    if (act.dataset.act === 'download') download(out.value + '\n', 'uuids.txt', 'text/plain');
  });
  $('#uuid-form').addEventListener('submit', (e) => { e.preventDefault(); generate(); });
  for (const e of document.querySelectorAll('#uuid-form input')) e.addEventListener('change', generate);
  checkEl.addEventListener('input', check);
  window.addEventListener('jb:langchange', () => {
    check();
    if (statusEl.dataset.n) statusEl.textContent = t('uuid.generated', { n: Number(statusEl.dataset.n) });
  });
  document.addEventListener('DOMContentLoaded', generate);
})();
