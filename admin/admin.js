/* JSON বন্ধু — ad admin portal. Vanilla JS, no dependencies.
 * All API data is treated as untrusted: the DOM is built with textContent /
 * properties only (see h()). Nothing is stored in localStorage; auth is the
 * Cloudflare Access session cookie, and the server re-validates everything.
 */
(function () {
  'use strict';

  var API_CONFIG = '/api/admin/config';
  var API_STATS = '/api/admin/stats';
  var SLOTS = ['top', 'bottom'];
  var SLOT_LABEL = { top: 'উপরে', bottom: 'নিচে' };
  var TYPE_LABEL = { text: 'টেক্সট', image: 'ছবি' };
  var MODE_LABEL = { adsense: 'AdSense', direct: 'সরাসরি (পেইড → হাউস)', house: 'শুধু হাউস', off: 'বন্ধ' };
  var STATUS_LABEL = { live: 'চলমান', scheduled: 'নির্ধারিত', ended: 'শেষ', inactive: 'নিষ্ক্রিয়' };

  var state = {
    me: '',
    baseVersion: 0,     // version the draft is based on (sent as baseVersion on PUT)
    saved: null,        // last config from the server (for discard)
    draft: null,        // {slots, campaigns} being edited
    history: [],
    dirty: false,
    editingIndex: -1,   // -1 = new campaign
  };

  // --- helpers ---------------------------------------------------------------

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /** Safe element builder: text via textContent, attributes via setAttribute, handlers via on*. */
  function h(tag, props) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v == null || v === false) return;
        if (k === 'text') node.textContent = v;
        else if (k === 'class') node.className = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : String(v));
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var bnNum = new Intl.NumberFormat('bn-BD');
  var bnPct = new Intl.NumberFormat('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var bnDateTime = new Intl.DateTimeFormat('bn-BD', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' });
  var bnDate = new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  function fmtDate(ymd) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return '—';
    return bnDate.format(new Date(ymd + 'T00:00:00Z'));
  }

  // Business dates are Bangladesh time (UTC+6, no DST) — same rule as the server.
  function todayDhaka() {
    return new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10);
  }
  function addDays(ymd, n) {
    var d = new Date(ymd + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function isHouse(c) { return String(c.advertiser || '').trim().toLowerCase() === 'house'; }

  function statusOf(c, today) {
    if (!c.active) return 'inactive';
    if (today < c.startDate) return 'scheduled';
    if (today > c.endDate) return 'ended';
    return 'live';
  }

  function newId() {
    var bytes = new Uint8Array(3);
    crypto.getRandomValues(bytes);
    var rnd = Array.prototype.map.call(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    return 'c-' + Date.now().toString(36) + '-' + rnd;
  }

  function isHttpsUrl(v) {
    try { var u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; } catch (e) { return false; }
  }

  // --- notices ---------------------------------------------------------------

  var noticeTimer = null;
  function notify(message, kind, sticky) {
    var n = $('#notice');
    n.textContent = message;
    n.className = 'notice ' + (kind || 'info');
    n.hidden = false;
    clearTimeout(noticeTimer);
    if (!sticky) noticeTimer = setTimeout(function () { n.hidden = true; }, 6000);
  }

  // --- API -------------------------------------------------------------------

  function api(url, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (opts.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    return fetch(url, init).then(function (res) {
      var ct = res.headers.get('Content-Type') || '';
      var parse = ct.indexOf('application/json') === 0 ? res.json() : Promise.resolve({});
      return parse.then(function (data) { return { status: res.status, ok: res.ok, data: data || {} }; });
    }, function () {
      // Network error or Access redirecting an expired session to its login page (CORS).
      return { status: 0, ok: false, data: { error: 'network' } };
    });
  }

  function authError(r) {
    if (r.status === 0) return 'সার্ভারে পৌঁছানো যায়নি অথবা লগইন সেশন শেষ। পেজটি রিলোড করুন।';
    if (r.status === 401 || r.status === 403) return 'প্রবেশাধিকার নেই (' + r.status + ')। আবার লগইন করুন।';
    return null;
  }

  // --- dirty state -----------------------------------------------------------

  function setDirty(d) {
    state.dirty = d;
    $('#dirty').hidden = !d;
    $('#discard').hidden = !d;
    $('#save').disabled = !d;
  }

  window.addEventListener('beforeunload', function (e) {
    if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  // --- tabs ------------------------------------------------------------------

  function selectTab(tab) {
    $$('.tab').forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
    if (tab.id === 'tab-stats' && !$('#stats-rows').childElementCount) loadStats();
  }

  function initTabs() {
    var tabs = $$('.tab');
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { selectTab(t); });
      t.addEventListener('keydown', function (e) {
        var j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
        if (j === null) return;
        e.preventDefault();
        var next = tabs[(j + tabs.length) % tabs.length];
        next.focus();
        selectTab(next);
      });
    });
  }

  // --- campaigns list --------------------------------------------------------

  function renderCampaigns() {
    var tbody = $('#campaign-rows');
    var today = todayDhaka();
    var fSlot = $('#filter-slot').value;
    var fStatus = $('#filter-status').value;
    var q = $('#filter-q').value.trim().toLowerCase();

    var rows = [];
    state.draft.campaigns.forEach(function (c, i) {
      var st = statusOf(c, today);
      if (fSlot && c.slot !== fSlot) return;
      if (fStatus && st !== fStatus) return;
      if (q && (c.name + ' ' + c.advertiser).toLowerCase().indexOf(q) === -1) return;

      rows.push(h('tr', null,
        h('td', { 'data-label': 'ক্যাম্পেইন' },
          h('div', { class: 'cell-title', text: c.name }),
          h('div', { class: 'cell-sub' },
            isHouse(c) ? h('span', { class: 'tag house', text: 'হাউস' }) : c.advertiser)),
        h('td', { 'data-label': 'স্লট', text: SLOT_LABEL[c.slot] || c.slot }),
        h('td', { 'data-label': 'ধরন', text: TYPE_LABEL[c.type] || c.type }),
        h('td', { 'data-label': 'সময়কাল', text: fmtDate(c.startDate) + ' – ' + fmtDate(c.endDate) }),
        h('td', { 'data-label': 'ওজন', class: 'num', text: bnNum.format(c.weight) }),
        h('td', { 'data-label': 'অবস্থা' }, h('span', { class: 'status ' + st, text: STATUS_LABEL[st] })),
        h('td', { class: 'actions' },
          h('button', { type: 'button', class: 'btn small', text: 'সম্পাদনা', onclick: function () { openEditor(i); } }),
          h('button', { type: 'button', class: 'btn small ghost', text: 'অনুলিপি', onclick: function () { duplicateCampaign(i); } }),
          h('button', { type: 'button', class: 'btn small danger', text: 'মুছুন', onclick: function () { deleteCampaign(i); } }))));
    });
    tbody.replaceChildren.apply(tbody, rows);
    $('#campaign-empty').hidden = rows.length > 0;
  }

  function duplicateCampaign(i) {
    var c = clone(state.draft.campaigns[i]);
    c.id = newId();
    c.name = (c.name + ' (কপি)').slice(0, 80);
    c.active = false;
    state.draft.campaigns.splice(i + 1, 0, c);
    setDirty(true);
    renderAll();
    notify('অনুলিপি তৈরি হয়েছে (নিষ্ক্রিয় অবস্থায়)। সম্পাদনা করে সক্রিয় করুন।', 'info');
  }

  function deleteCampaign(i) {
    var c = state.draft.campaigns[i];
    if (!window.confirm('“' + c.name + '” মুছে ফেলবেন? সংরক্ষণ না করা পর্যন্ত সাইটে প্রভাব পড়বে না।')) return;
    state.draft.campaigns.splice(i, 1);
    setDirty(true);
    renderAll();
  }

  // --- editor ----------------------------------------------------------------

  var form, dialog;

  function blankCampaign() {
    var today = todayDhaka();
    return {
      id: newId(), name: '', advertiser: '', slot: 'top', type: 'text', imageUrl: '',
      headline: '', body: '', ctaText: 'বিস্তারিত', ctaUrl: '', bgColor: '',
      startDate: today, endDate: addDays(today, 29), weight: 10, active: true,
    };
  }

  function openEditor(index) {
    state.editingIndex = index;
    var c = index >= 0 ? state.draft.campaigns[index] : blankCampaign();
    $('#editor-title').textContent = index >= 0 ? 'ক্যাম্পেইন সম্পাদনা' : 'নতুন ক্যাম্পেইন';
    $('#f-id').textContent = c.id;
    form.dataset.id = c.id;
    form.elements.name.value = c.name;
    form.elements.advertiser.value = isHouse(c) ? '' : c.advertiser;
    form.elements.isHouse.checked = isHouse(c);
    form.elements.slot.value = c.slot;
    form.elements.type.value = c.type;
    form.elements.imageUrl.value = c.imageUrl || '';
    form.elements.headline.value = c.headline;
    form.elements.body.value = c.body || '';
    form.elements.ctaText.value = c.ctaText;
    form.elements.ctaUrl.value = c.ctaUrl;
    form.elements.startDate.value = c.startDate;
    form.elements.endDate.value = c.endDate;
    form.elements.weight.value = c.weight;
    form.elements.useBg.checked = !!c.bgColor;
    form.elements.bgColor.value = c.bgColor || '#0f766e';
    form.elements.active.checked = !!c.active;
    showErrors([]);
    syncEditor();
    dialog.showModal();
    $('.editor-body', dialog).scrollTop = 0;
    // Keep the live preview (shown first on narrow screens) in view.
    form.elements.name.focus({ preventScroll: true });
  }

  function readForm() {
    var el = form.elements;
    var house = el.isHouse.checked;
    return {
      id: form.dataset.id,
      name: el.name.value.trim(),
      advertiser: house ? 'house' : el.advertiser.value.trim(),
      slot: el.slot.value,
      type: el.type.value || 'text',
      imageUrl: el.type.value === 'image' ? el.imageUrl.value.trim() : '',
      headline: el.headline.value.trim(),
      body: el.type.value === 'text' ? el.body.value.trim() : '',
      ctaText: el.ctaText.value.trim(),
      ctaUrl: el.ctaUrl.value.trim(),
      bgColor: el.useBg.checked ? el.bgColor.value.toLowerCase() : '',
      startDate: el.startDate.value,
      endDate: el.endDate.value,
      weight: parseInt(el.weight.value, 10),
      active: el.active.checked,
    };
  }

  /** Client-side checks for fast feedback. The server is authoritative. */
  function validateForm(c) {
    var errs = [];
    if (!c.name) errs.push('নাম দিন।');
    if (!c.advertiser) errs.push('বিজ্ঞাপনদাতার নাম দিন (অথবা “হাউস বিজ্ঞাপন” চিহ্নিত করুন)।');
    if (!c.headline) errs.push('শিরোনাম দিন।');
    if (!c.ctaText) errs.push('বোতামের লেখা দিন।');
    if (!isHttpsUrl(c.ctaUrl)) errs.push('বোতামের লিংক অবশ্যই https:// দিয়ে শুরু হওয়া বৈধ লিংক হতে হবে।');
    if (c.type === 'image' && !isHttpsUrl(c.imageUrl)) errs.push('ছবির লিংক অবশ্যই https:// দিয়ে শুরু হওয়া বৈধ লিংক হতে হবে।');
    if (!c.startDate || !c.endDate) errs.push('শুরু ও শেষের তারিখ দিন।');
    else if (c.endDate < c.startDate) errs.push('শেষের তারিখ শুরুর আগে হতে পারে না।');
    if (!(c.weight >= 1 && c.weight <= 100)) errs.push('ওজন ১–১০০ এর মধ্যে দিন।');
    var dup = state.draft.campaigns.some(function (o, i) { return o.id === c.id && i !== state.editingIndex; });
    if (dup) errs.push('এই আইডি ইতিমধ্যে আছে।');
    return errs;
  }

  function showErrors(list) {
    var ul = $('#editor-errors');
    ul.replaceChildren.apply(ul, list.map(function (m) { return h('li', { text: m }); }));
    ul.hidden = list.length === 0;
  }

  function syncEditor() {
    var el = form.elements;
    var type = el.type.value || 'text';
    $$('[data-show]', form).forEach(function (n) { n.hidden = n.getAttribute('data-show') !== type; });
    el.advertiser.disabled = el.isHouse.checked;
    el.bgColor.disabled = !el.useBg.checked;
    $$('.counter', form).forEach(function (n) {
      var input = el[n.getAttribute('data-for')];
      n.textContent = bnNum.format(Array.from(input.value).length) + '/' + bnNum.format(input.maxLength);
    });
    renderPreview();
  }

  function renderPreview() {
    var slot = $('#preview-slot');
    var msg = $('#preview-msg');
    var c = readForm();
    c.house = c.advertiser === 'house';
    if (!window.JBAds || typeof window.JBAds.buildCard !== 'function') {
      slot.replaceChildren();
      msg.textContent = 'প্রিভিউ লোড হয়নি (ads.js পাওয়া যায়নি)।';
      return;
    }
    var card = window.JBAds.buildCard(c, {
      onClick: function (e) { e.preventDefault(); },
    });
    slot.replaceChildren(card || h('span', { class: 'preview-empty', text: 'প্রিভিউ দেখাতে শিরোনাম, বোতামের লেখা ও বৈধ https লিংক দিন।' }));
    msg.textContent = c.type === 'image' ? 'ছবির বিজ্ঞাপনে শিরোনামটি alt টেক্সট হিসেবে ব্যবহৃত হয় (দেখা যায় না)।' : '';
  }

  function applyEditor() {
    var c = readForm();
    var errs = validateForm(c);
    if (errs.length) { showErrors(errs); return false; }
    if (state.editingIndex >= 0) state.draft.campaigns[state.editingIndex] = c;
    else state.draft.campaigns.unshift(c);
    setDirty(true);
    renderAll();
    return true;
  }

  function initEditor() {
    dialog = $('#editor');
    form = $('#editor-form');
    form.addEventListener('input', syncEditor);
    form.addEventListener('change', syncEditor);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (applyEditor()) {
        dialog.close();
        notify('পরিবর্তন খসড়ায় যোগ হয়েছে। প্রকাশ করতে “সংরক্ষণ ও প্রকাশ” চাপুন।', 'info');
      }
    });
    $$('[data-close]', dialog).forEach(function (b) { b.addEventListener('click', function () { dialog.close(); }); });
    $$('.seg', dialog).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.seg', dialog).forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        $('#preview-frame').classList.toggle('mobile', b.getAttribute('data-width') === 'mobile');
      });
    });
    $('#new-campaign').addEventListener('click', function () { openEditor(-1); });
    ['#filter-slot', '#filter-status', '#filter-q'].forEach(function (s) {
      $(s).addEventListener('input', renderCampaigns);
    });
  }

  // --- slots -----------------------------------------------------------------

  function renderSlots() {
    var wrap = $('#slot-cards');
    var today = todayDhaka();
    var cards = SLOTS.map(function (name) {
      var s = state.draft.slots[name];
      var live = state.draft.campaigns.filter(function (c) { return c.slot === name && statusOf(c, today) === 'live'; });
      var paid = live.filter(function (c) { return !isHouse(c); }).length;
      var house = live.length - paid;
      var uid = 'slot-' + name;

      var modeSel = h('select', { id: uid + '-mode' });
      Object.keys(MODE_LABEL).forEach(function (m) {
        var o = h('option', { value: m, text: MODE_LABEL[m] });
        if (s.mode === m) o.selected = true;
        modeSel.appendChild(o);
      });
      var enabled = h('input', { type: 'checkbox', id: uid + '-enabled' });
      enabled.checked = !!s.enabled;
      var client = h('input', { id: uid + '-client', placeholder: 'ca-pub-XXXXXXXXXXXXXXXX', autocomplete: 'off', spellcheck: 'false', pattern: 'ca-pub-\\d{10,20}' });
      client.value = s.adsense.client || '';
      var adSlot = h('input', { id: uid + '-adslot', placeholder: '1234567890', inputmode: 'numeric', autocomplete: 'off', pattern: '\\d{6,20}' });
      adSlot.value = s.adsense.slot || '';
      var adsenseBox = h('div', { class: 'adsense-fields' },
        h('label', { class: 'field', for: uid + '-client' }, 'AdSense client', client),
        h('label', { class: 'field', for: uid + '-adslot' }, 'AdSense slot', adSlot));
      adsenseBox.hidden = s.mode !== 'adsense';

      function update() {
        s.enabled = enabled.checked;
        s.mode = modeSel.value;
        s.adsense.client = client.value.trim();
        s.adsense.slot = adSlot.value.trim();
        adsenseBox.hidden = s.mode !== 'adsense';
        setDirty(true);
      }
      [modeSel, enabled, client, adSlot].forEach(function (n) { n.addEventListener('input', update); });

      return h('article', { class: 'slot-card' },
        h('header', null,
          h('h3', { text: SLOT_LABEL[name] + ' (' + name + ')' }),
          h('label', { class: 'check switch', for: uid + '-enabled' }, enabled, ' চালু')),
        h('label', { class: 'field', for: uid + '-mode' }, 'মোড', modeSel),
        adsenseBox,
        h('p', { class: 'hint', text: 'আজ চলমান: পেইড ' + bnNum.format(paid) + 'টি, হাউস ' + bnNum.format(house) + 'টি' }));
    });
    wrap.replaceChildren.apply(wrap, cards);
  }

  // --- history ---------------------------------------------------------------

  function renderHistory() {
    var tbody = $('#history-rows');
    var rows = state.history.map(function (v) {
      var current = v.version === state.baseVersion;
      return h('tr', current ? { class: 'current' } : null,
        h('td', { class: 'num', 'data-label': 'সংস্করণ', text: bnNum.format(v.version) }),
        h('td', { 'data-label': 'সময়', text: v.updatedAt ? bnDateTime.format(new Date(v.updatedAt)) : '—' }),
        h('td', { 'data-label': 'যিনি', text: v.updatedBy || '—' }),
        h('td', { class: 'num', 'data-label': 'ক্যাম্পেইন', text: bnNum.format(v.campaigns) }),
        h('td', { class: 'actions' }, current
          ? h('span', { class: 'status live', text: 'বর্তমান' })
          : h('button', { type: 'button', class: 'btn small', text: 'এই সংস্করণ লোড করুন', onclick: function () { loadVersion(v.version); } })));
    });
    tbody.replaceChildren.apply(tbody, rows);
    $('#history-empty').hidden = rows.length > 0;
  }

  function loadVersion(version) {
    if (state.dirty && !window.confirm('অসংরক্ষিত পরিবর্তন হারিয়ে যাবে। চালিয়ে যাবেন?')) return;
    api(API_CONFIG + '?version=' + encodeURIComponent(version)).then(function (r) {
      if (!r.ok) { notify(authError(r) || 'সংস্করণ লোড করা যায়নি।', 'error'); return; }
      state.draft = { slots: clone(r.data.config.slots), campaigns: clone(r.data.config.campaigns) };
      setDirty(true);
      renderAll();
      selectTab($('#tab-campaigns'));
      notify('সংস্করণ ' + bnNum.format(version) + ' খসড়ায় লোড হয়েছে। পর্যালোচনা করে “সংরক্ষণ ও প্রকাশ” চাপলে এটি চালু হবে।', 'info', true);
    });
  }

  // --- stats -----------------------------------------------------------------

  function setRange(days) {
    var to = todayDhaka();
    $('#stats-to').value = to;
    $('#stats-from').value = addDays(to, -(days - 1));
  }

  function loadStats() {
    var from = $('#stats-from').value;
    var to = $('#stats-to').value;
    var tbody = $('#stats-rows');
    var foot = $('#stats-foot');
    tbody.replaceChildren(h('tr', null, h('td', { colspan: '6', class: 'empty', text: 'লোড হচ্ছে…' })));
    foot.replaceChildren();
    var qs = '?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to);
    api(API_STATS + qs).then(function (r) {
      if (!r.ok) {
        tbody.replaceChildren(h('tr', null, h('td', { colspan: '6', class: 'empty', text: authError(r) || (r.data.error || 'পরিসংখ্যান লোড করা যায়নি।') })));
        return;
      }
      var d = r.data;
      var rows = (d.rows || []).map(function (row) {
        return h('tr', null,
          h('td', { 'data-label': 'ক্যাম্পেইন' },
            h('div', { class: 'cell-title', text: row.name || '(মুছে ফেলা ক্যাম্পেইন)' }),
            h('div', { class: 'cell-sub mono', text: row.campaignId })),
          h('td', { 'data-label': 'বিজ্ঞাপনদাতা', text: row.advertiser === 'house' ? 'হাউস' : (row.advertiser || '—') }),
          h('td', { 'data-label': 'স্লট', text: SLOT_LABEL[row.slot] || '—' }),
          h('td', { class: 'num', 'data-label': 'ইমপ্রেশন', text: bnNum.format(row.impressions) }),
          h('td', { class: 'num', 'data-label': 'ক্লিক', text: bnNum.format(row.clicks) }),
          h('td', { class: 'num', 'data-label': 'CTR', text: bnPct.format(row.ctr) + '%' }));
      });
      if (!rows.length) rows = [h('tr', null, h('td', { colspan: '6', class: 'empty', text: 'এই সময়ে কোনো ডেটা নেই।' }))];
      tbody.replaceChildren.apply(tbody, rows);
      var t = d.totals || { impressions: 0, clicks: 0, ctr: 0 };
      foot.replaceChildren(h('tr', null,
        h('th', { scope: 'row', colspan: '3', text: 'মোট' }),
        h('td', { class: 'num', text: bnNum.format(t.impressions) }),
        h('td', { class: 'num', text: bnNum.format(t.clicks) }),
        h('td', { class: 'num', text: bnPct.format(t.ctr) + '%' })));
      var note = 'সময়: বাংলাদেশ (Asia/Dhaka)। সংখ্যা আনুমানিক — KV-তে কয়েক মিনিট দেরিতে হালনাগাদ হয় এবং একসাথে আসা কিছু ইভেন্ট বাদ পড়তে পারে।';
      if (d.impressionSampleRate && d.impressionSampleRate < 1) {
        note += ' ইমপ্রেশন ' + bnNum.format(Math.round(d.impressionSampleRate * 100)) + '% নমুনা থেকে অনুমান করা।';
      }
      $('#stats-note').textContent = note;
    });
  }

  function initStats() {
    setRange(7);
    $('#stats-form').addEventListener('submit', function (e) { e.preventDefault(); loadStats(); });
    $$('[data-range]').forEach(function (b) {
      b.addEventListener('click', function () { setRange(parseInt(b.getAttribute('data-range'), 10)); loadStats(); });
    });
  }

  // --- load / save -----------------------------------------------------------

  function renderAll() {
    renderCampaigns();
    renderSlots();
    renderHistory();
  }

  function acceptServerConfig(cfg) {
    state.saved = cfg;
    state.baseVersion = Number(cfg.version) || 0;
    state.draft = { slots: clone(cfg.slots), campaigns: clone(cfg.campaigns) };
    setDirty(false);
  }

  function load() {
    return api(API_CONFIG).then(function (r) {
      $('#loading').hidden = true;
      if (!r.ok) {
        notify(authError(r) || 'কনফিগ লোড করা যায়নি।', 'error', true);
        return;
      }
      state.me = r.data.me || '';
      state.history = Array.isArray(r.data.history) ? r.data.history : [];
      $('#me').textContent = state.me;
      acceptServerConfig(r.data.config);
      renderAll();
      if (!$$('.panel').some(function (p) { return !p.hidden; })) selectTab($('.tab[aria-selected="true"]'));
    });
  }

  function describeError(e) {
    // "campaigns[3].ctaUrl" -> "“নাম” — ctaUrl: message"
    var m = /^campaigns\[(\d+)\]\.?(.*)$/.exec(e.path || '');
    if (m) {
      var c = state.draft.campaigns[Number(m[1])];
      return '“' + (c ? c.name || c.id : '#' + m[1]) + '”' + (m[2] ? ' — ' + m[2] : '') + ': ' + e.message;
    }
    return (e.path ? e.path + ': ' : '') + e.message;
  }

  function save() {
    var btn = $('#save');
    btn.disabled = true;
    btn.textContent = 'সংরক্ষণ হচ্ছে…';
    api(API_CONFIG, { method: 'PUT', body: { baseVersion: state.baseVersion, config: state.draft } }).then(function (r) {
      btn.textContent = 'সংরক্ষণ ও প্রকাশ';
      if (r.ok) {
        acceptServerConfig(r.data.config);
        notify('সংস্করণ ' + bnNum.format(state.baseVersion) + ' সংরক্ষিত হয়েছে। সাইটে দেখাতে সর্বোচ্চ ~২ মিনিট লাগতে পারে।', 'ok');
        return api(API_CONFIG).then(function (r2) {
          if (r2.ok) state.history = r2.data.history || [];
          renderAll();
        });
      }
      btn.disabled = false;
      if (r.status === 422 && Array.isArray(r.data.errors)) {
        notify('সংরক্ষণ হয়নি — ' + r.data.errors.slice(0, 5).map(describeError).join(' • ') +
          (r.data.errors.length > 5 ? ' • আরও ' + bnNum.format(r.data.errors.length - 5) + 'টি ভুল' : ''), 'error', true);
      } else if (r.status === 409) {
        notify('অন্য কেউ এর মধ্যে কনফিগ পরিবর্তন করেছেন (সংস্করণ ' + bnNum.format(r.data.currentVersion || 0) + ')। আপনার পরিবর্তন কপি করে রাখুন, তারপর পেজ রিলোড করুন।', 'error', true);
      } else {
        notify(authError(r) || ('সংরক্ষণ ব্যর্থ (' + r.status + ')। পরে আবার চেষ্টা করুন।'), 'error', true);
      }
    });
  }

  function discard() {
    if (!window.confirm('সব অসংরক্ষিত পরিবর্তন বাতিল করবেন?')) return;
    acceptServerConfig(state.saved);
    renderAll();
    $('#notice').hidden = true;
  }

  function init() {
    initTabs();
    initEditor();
    initStats();
    $('#save').addEventListener('click', save);
    $('#discard').addEventListener('click', discard);
    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
