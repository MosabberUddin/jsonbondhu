// Unix timestamp converter page. Loaded with `defer` from <head>: runs after the DOM is
// parsed but before DOMContentLoaded, so the strings below exist for i18n's first apply().
(function () {
  'use strict';
  const I18N = window.JBI18N;
  const t = I18N.t;
  const T = window.JBTS;
  const { copy } = window.JBTOOLS;

  I18N.extend({
    en: {
      'timestamp.title': 'Unix Timestamp Converter — epoch to date & back, Dhaka time | JSON Bondhu',
      'timestamp.now': 'Current Unix time',
      'timestamp.useNow': 'Convert the current time',
      'timestamp.toDate': 'Timestamp → date',
      'timestamp.toUnix': 'Date → timestamp',
      'timestamp.input': 'Unix timestamp',
      'timestamp.input.placeholder': 'e.g. 1700000000 or 1700000000000',
      'timestamp.unit': 'Unit',
      'timestamp.unit.auto': 'Auto-detect',
      'timestamp.unit.s': 'Seconds',
      'timestamp.unit.ms': 'Milliseconds',
      'timestamp.unit.us': 'Microseconds',
      'timestamp.unit.ns': 'Nanoseconds',
      'timestamp.unitname.s': 'seconds',
      'timestamp.unitname.ms': 'milliseconds',
      'timestamp.unitname.us': 'microseconds',
      'timestamp.unitname.ns': 'nanoseconds',
      'timestamp.assumed.auto': 'Assumed {unit} (auto-detected from {n} digits). Wrong guess? Choose the unit.',
      'timestamp.assumed.manual': 'Read as {unit}.',
      'timestamp.y2038': '⚠ This value does not fit in a signed 32-bit integer (the Year 2038 problem) — older systems may store it wrongly.',
      'timestamp.err.empty': 'Enter a Unix timestamp to convert it.',
      'timestamp.err.invalid': 'That is not a number. Use digits only, e.g. 1700000000 (a minus sign and decimals are fine).',
      'timestamp.err.range': 'Out of range — dates can only be shown up to about 275,000 years before or after 1970.',
      'timestamp.row.utc': 'UTC',
      'timestamp.row.local': 'Your time ({zone})',
      'timestamp.row.dhaka': 'Dhaka (Asia/Dhaka)',
      'timestamp.row.iso': 'ISO 8601',
      'timestamp.row.rfc2822': 'RFC 2822',
      'timestamp.row.http': 'HTTP date',
      'timestamp.row.relative': 'Relative',
      'timestamp.row.seconds': 'Unix seconds',
      'timestamp.row.millis': 'Unix milliseconds',
      'timestamp.copyRow': 'Copy {label}',
      'timestamp.dt': 'Date and time',
      'timestamp.dt.now': 'Now',
      'timestamp.zone': 'Time zone',
      'timestamp.zone.local': 'My time zone ({zone})',
      'timestamp.zone.dhaka': 'Asia/Dhaka (Bangladesh)',
      'timestamp.dt.empty': 'Pick a date and time.',
      'timestamp.dt.invalid': 'That date and time is not valid.',
      'timestamp.dt.ok': 'Read as {zone} time.',
    },
    bn: {
      'timestamp.title': 'ইউনিক্স টাইমস্ট্যাম্প কনভার্টার — epoch থেকে তারিখ ও উল্টো, ঢাকার সময় | JSON বন্ধু',
      'timestamp.now': 'এখনকার ইউনিক্স সময়',
      'timestamp.useNow': 'এখনকার সময় রূপান্তর করুন',
      'timestamp.toDate': 'টাইমস্ট্যাম্প → তারিখ',
      'timestamp.toUnix': 'তারিখ → টাইমস্ট্যাম্প',
      'timestamp.input': 'ইউনিক্স টাইমস্ট্যাম্প',
      'timestamp.input.placeholder': 'যেমন 1700000000 বা 1700000000000',
      'timestamp.unit': 'একক',
      'timestamp.unit.auto': 'স্বয়ংক্রিয় শনাক্ত',
      'timestamp.unit.s': 'সেকেন্ড',
      'timestamp.unit.ms': 'মিলিসেকেন্ড',
      'timestamp.unit.us': 'মাইক্রোসেকেন্ড',
      'timestamp.unit.ns': 'ন্যানোসেকেন্ড',
      'timestamp.unitname.s': 'সেকেন্ড',
      'timestamp.unitname.ms': 'মিলিসেকেন্ড',
      'timestamp.unitname.us': 'মাইক্রোসেকেন্ড',
      'timestamp.unitname.ns': 'ন্যানোসেকেন্ড',
      'timestamp.assumed.auto': '{unit} ধরে নেওয়া হয়েছে ({n} অঙ্ক দেখে স্বয়ংক্রিয়ভাবে)। অনুমান ভুল? একক বেছে নিন।',
      'timestamp.assumed.manual': '{unit} হিসেবে পড়া হয়েছে।',
      'timestamp.y2038': '⚠ এই মান সাইনড ৩২-বিট পূর্ণসংখ্যায় আঁটে না (২০৩৮ সালের সমস্যা) — পুরোনো সিস্টেম এটি ভুলভাবে রাখতে পারে।',
      'timestamp.err.empty': 'রূপান্তর করতে একটি ইউনিক্স টাইমস্ট্যাম্প লিখুন।',
      'timestamp.err.invalid': 'এটি সংখ্যা নয়। শুধু অঙ্ক ব্যবহার করুন, যেমন 1700000000 (মাইনাস চিহ্ন ও দশমিক চলবে)।',
      'timestamp.err.range': 'সীমার বাইরে — ১৯৭০-এর আগে বা পরে প্রায় ২,৭৫,০০০ বছর পর্যন্তই তারিখ দেখানো যায়।',
      'timestamp.row.utc': 'UTC',
      'timestamp.row.local': 'আপনার সময় ({zone})',
      'timestamp.row.dhaka': 'ঢাকা (Asia/Dhaka)',
      'timestamp.row.iso': 'ISO 8601',
      'timestamp.row.rfc2822': 'RFC 2822',
      'timestamp.row.http': 'HTTP তারিখ',
      'timestamp.row.relative': 'এখন থেকে',
      'timestamp.row.seconds': 'ইউনিক্স সেকেন্ড',
      'timestamp.row.millis': 'ইউনিক্স মিলিসেকেন্ড',
      'timestamp.copyRow': '{label} কপি করুন',
      'timestamp.dt': 'তারিখ ও সময়',
      'timestamp.dt.now': 'এখন',
      'timestamp.zone': 'টাইম জোন',
      'timestamp.zone.local': 'আমার টাইম জোন ({zone})',
      'timestamp.zone.dhaka': 'Asia/Dhaka (বাংলাদেশ)',
      'timestamp.dt.empty': 'একটি তারিখ ও সময় বেছে নিন।',
      'timestamp.dt.invalid': 'এই তারিখ ও সময় সঠিক নয়।',
      'timestamp.dt.ok': '{zone} সময় হিসেবে পড়া হয়েছে।',
    },
  });

  const $ = (s) => document.querySelector(s);
  const nowS = $('#ts-now-s');
  const nowMs = $('#ts-now-ms');
  const tsInput = $('#ts-input');
  const tsUnit = $('#ts-unit');
  const tsStatus = $('#ts-status');
  const tsResult = $('#ts-result');
  const dtInput = $('#dt-input');
  const dtZone = $('#dt-zone');
  const dtStatus = $('#dt-status');
  const dtResult = $('#dt-result');
  const localZone = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'; } catch (e) { return 'local'; }
  })();

  let relCell = null;   // the "Relative" value cell, refreshed every second
  let relMs = null;

  const lang = () => I18N.lang;
  const locale = () => (lang() === 'bn' ? 'bn-BD' : 'en-GB');

  function setStatus(elm, text, cls) {
    elm.textContent = text;
    elm.className = 'status' + (cls ? ' ' + cls : '');
  }

  function relText(ms) {
    const r = T.relative(ms - Date.now());
    return new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' }).format(r.value, r.unit);
  }

  function row(table, key, label, value) {
    const tr = document.createElement('tr');
    tr.dataset.row = key;
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = label;
    const td = document.createElement('td');
    const span = document.createElement('span');
    span.className = 'ts-val';
    span.textContent = value;
    td.append(span);
    const tdc = document.createElement('td');
    tdc.className = 'ts-copy';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'small';
    btn.textContent = t('btn.copy');
    btn.setAttribute('aria-label', t('timestamp.copyRow', { label }));
    btn.dataset.copyValue = value;
    tdc.append(btn);
    tr.append(th, td, tdc);
    table.append(tr);
    return span;
  }

  // ---------- Timestamp -> date ----------
  function convertTs() {
    tsResult.textContent = '';
    relCell = null;
    relMs = null;
    const r = T.parse(tsInput.value, tsUnit.value);
    if (!r.ok) {
      setStatus(tsStatus, t('timestamp.err.' + r.error), r.error === 'empty' ? '' : 'err');
      return;
    }
    const digits = T.clean(tsInput.value).replace(/^[-+]/, '').split('.')[0].replace(/^0+(?=\d)/, '').length;
    let msg = r.detected
      ? t('timestamp.assumed.auto', { unit: t('timestamp.unitname.' + r.unit), n: digits })
      : t('timestamp.assumed.manual', { unit: t('timestamp.unitname.' + r.unit) });
    if (!r.int32) msg += ' ' + t('timestamp.y2038');
    setStatus(tsStatus, msg, r.int32 ? 'ok' : 'warn');
    tsStatus.dataset.unit = r.unit;
    const ms = r.ms;
    const L = lang();
    row(tsResult, 'utc', t('timestamp.row.utc'), T.formatIn(ms, L, 'UTC'));
    row(tsResult, 'local', t('timestamp.row.local', { zone: localZone }), T.formatIn(ms, L));
    row(tsResult, 'dhaka', t('timestamp.row.dhaka'), T.formatIn(ms, L, 'Asia/Dhaka'));
    row(tsResult, 'iso', t('timestamp.row.iso'), T.iso(ms));
    row(tsResult, 'rfc2822', t('timestamp.row.rfc2822'), T.rfc2822(ms));
    row(tsResult, 'http', t('timestamp.row.http'), T.httpDate(ms));
    relCell = row(tsResult, 'relative', t('timestamp.row.relative'), relText(ms));
    relMs = ms;
    row(tsResult, 'seconds', t('timestamp.row.seconds'), r.seconds);
    row(tsResult, 'millis', t('timestamp.row.millis'), r.millis);
  }

  // ---------- Date -> timestamp ----------
  const pad = (n, w) => String(n).padStart(w || 2, '0');
  function localNowValue() {
    const d = new Date(Math.floor(Date.now() / 1000) * 1000);
    return pad(d.getFullYear(), 4) + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' +
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }
  function zoneValue() { return dtZone.value === 'local' ? undefined : dtZone.value; }
  function zoneName() { return dtZone.value === 'local' ? localZone : dtZone.value; }

  function convertDt() {
    dtResult.textContent = '';
    const v = dtInput.value;
    if (!v) { setStatus(dtStatus, t('timestamp.dt.empty'), ''); return; }
    const ms = T.zonedToEpoch(v, zoneValue());
    if (ms === null) { setStatus(dtStatus, t('timestamp.dt.invalid'), 'err'); return; }
    setStatus(dtStatus, t('timestamp.dt.ok', { zone: zoneName() }), 'ok');
    row(dtResult, 'seconds', t('timestamp.row.seconds'), String(Math.floor(ms / 1000)));
    row(dtResult, 'millis', t('timestamp.row.millis'), String(ms));
    row(dtResult, 'iso', t('timestamp.row.iso'), T.iso(ms));
    row(dtResult, 'utc', t('timestamp.row.utc'), T.formatIn(ms, lang(), 'UTC'));
  }

  function localizeZoneOption() {
    $('#dt-zone-local').textContent = t('timestamp.zone.local', { zone: localZone });
  }

  // ---------- Live clock ----------
  let lastSec = null;
  function tick() {
    const now = Date.now();
    const sec = Math.floor(now / 1000);
    nowMs.textContent = I18N.num(now);
    nowMs.dataset.value = String(now);
    if (sec !== lastSec) {
      lastSec = sec;
      nowS.textContent = I18N.num(sec);
      nowS.dataset.value = String(sec);
      if (relCell && relMs !== null) relCell.textContent = relText(relMs);
    }
  }

  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-copy-value]');
    if (c) { copy(c.dataset.copyValue); return; }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const a = act.dataset.act;
    if (a === 'copy-now-s') copy(String(Math.floor(Date.now() / 1000)));
    if (a === 'copy-now-ms') copy(String(Date.now()));
    if (a === 'use-now') {
      tsInput.value = String(Math.floor(Date.now() / 1000));
      tsUnit.value = 'auto';
      convertTs();
    }
    if (a === 'dt-now') { dtInput.value = localNowValue(); dtZone.value = 'local'; convertDt(); }
  });
  tsInput.addEventListener('input', convertTs);
  tsUnit.addEventListener('change', convertTs);
  dtInput.addEventListener('input', convertDt);
  dtInput.addEventListener('change', convertDt);
  dtZone.addEventListener('change', convertDt);
  window.addEventListener('jb:langchange', () => {
    lastSec = null;
    tick();
    localizeZoneOption();
    convertTs();
    convertDt();
  });
  document.addEventListener('DOMContentLoaded', () => {
    localizeZoneOption();
    if (!tsInput.value) tsInput.value = String(Math.floor(Date.now() / 1000));
    if (!dtInput.value) dtInput.value = localNowValue();
    convertTs();
    convertDt();
    tick();
    setInterval(tick, 200);
  });
})();
