// JSON to TypeScript page. Loaded with `defer` from <head>: runs after the DOM is parsed
// but before DOMContentLoaded, so the strings below exist for i18n's first apply().
(function () {
  'use strict';
  const I18N = window.JBI18N;
  const t = I18N.t;
  const TS = window.JBTS;
  const { copy, download } = window.JBTOOLS;

  I18N.extend({
    en: {
      'ts.title': 'JSON to TypeScript Interface Generator | JSON Bondhu',
      'ts.metaDesc': 'Paste JSON and get TypeScript interfaces or types. Nested objects, optional keys, unions and null are handled. Copy or download .ts. Runs in your browser.',
      'ts.root': 'Root name',
      'ts.style': 'Style',
      'ts.optional': 'Optional keys when merging',
      'ts.input': 'JSON input',
      'ts.input.placeholder': 'Paste JSON here…',
      'ts.output': 'TypeScript output',
      'ts.ready': 'Ready. Paste some JSON.',
      'ts.ok': '✓ Generated {n} type declarations',
      'ts.invalid': '✗ Invalid JSON{where}: {msg}',
      'ts.where': ' at line {line}, column {col}',
      'ts.nothing': 'Nothing to copy yet.',
    },
    bn: {
      'ts.title': 'JSON থেকে TypeScript ইন্টারফেস জেনারেটর | JSON বন্ধু',
      'ts.metaDesc': 'JSON পেস্ট করে TypeScript interface বা type পান। নেস্টেড অবজেক্ট, ঐচ্ছিক কী, ইউনিয়ন ও null সামলানো হয়। কপি বা .ts ডাউনলোড। ব্রাউজারেই চলে।',
      'ts.root': 'রুট নাম',
      'ts.style': 'স্টাইল',
      'ts.optional': 'মেলানোর সময় ঐচ্ছিক কী',
      'ts.input': 'JSON ইনপুট',
      'ts.input.placeholder': 'এখানে JSON পেস্ট করুন…',
      'ts.output': 'TypeScript আউটপুট',
      'ts.ready': 'প্রস্তুত। JSON পেস্ট করুন।',
      'ts.ok': '✓ {n}টি টাইপ ডিক্লারেশন তৈরি হয়েছে',
      'ts.invalid': '✗ JSON-এ ভুল আছে{where}: {msg}',
      'ts.where': ' লাইন {line}, কলাম {col}-এ',
      'ts.nothing': 'কপি করার মতো কিছু নেই।',
    },
  });

  const $ = (s) => document.querySelector(s);
  const input = $('#ts-in');
  const out = $('#ts-out');
  const statusEl = $('#status');

  const SAMPLE = {
    id: 101,
    name: 'Rahim Uddin',
    email: null,
    is_active: true,
    address: { city: 'Dhaka', zip: '1207' },
    tags: ['dev', 'bn'],
    orders: [
      { id: 1, total: 450.5, coupon: 'EID24' },
      { id: 2, total: 99, coupon: null, note: 'gift' },
    ],
    'user-agent': 'demo',
  };

  // The status stores a state so it can be re-rendered on a language switch.
  let state = { cls: '', key: 'ts.ready', vars: null };

  function renderStatus() {
    const vars = state.vars ? state.vars() : undefined;
    statusEl.className = 'status ' + state.cls;
    statusEl.textContent = t(state.key, vars);
  }
  function setStatus(cls, key, vars) { state = { cls, key, vars }; renderStatus(); }

  function options() {
    return {
      rootName: $('#ts-root').value.trim() || 'Root',
      style: $('input[name=ts-style]:checked').value,
      exportTypes: $('#ts-export').checked,
      optional: $('#ts-optional').checked,
      readonly: $('#ts-readonly').checked,
    };
  }

  function convert() {
    const r = TS.fromText(input.value, options());
    if (r.empty) { out.value = ''; setStatus('', 'ts.ready'); return; }
    if (!r.ok) {
      out.value = '';
      const where = () => (r.line ? t('ts.where', { line: r.line, col: r.col }) : '');
      setStatus('err', 'ts.invalid', () => ({ where: where(), msg: r.message }));
      return;
    }
    out.value = r.code;
    const n = (r.code.match(/^(?:export )?(?:interface|type) /gm) || []).length;
    setStatus('ok', 'ts.ok', () => ({ n }));
  }

  document.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const a = act.dataset.act;
    if (a === 'sample') { input.value = JSON.stringify(SAMPLE, null, 2); convert(); }
    if (a === 'clear') { input.value = ''; convert(); input.focus(); }
    if (a === 'copy') { if (out.value) copy(out.value); else window.JBTOOLS.toast(t('ts.nothing')); }
    if (a === 'download' && out.value) download(out.value, 'types.ts', 'text/plain');
  });
  $('#ts-form').addEventListener('submit', (e) => { e.preventDefault(); convert(); });
  $('#ts-form').addEventListener('input', convert);
  input.addEventListener('input', convert);
  window.addEventListener('jb:langchange', renderStatus);
  document.addEventListener('DOMContentLoaded', renderStatus);
})();
