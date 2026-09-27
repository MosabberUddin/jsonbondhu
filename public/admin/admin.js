/* JSON বন্ধু — ad admin portal. Vanilla JS, no dependencies.
 * All API data is treated as untrusted: the DOM is built with textContent /
 * properties only (see h()). The only thing kept in localStorage is the UI
 * language ("jb_lang", shared with the public site); auth is the Cloudflare
 * Access session cookie, and the server re-validates everything.
 * UI strings live in admin/i18n.js (English / Bangla); English is the default.
 */
(function () {
  'use strict';

  var API_CONFIG = '/api/admin/config';
  var API_STATS = '/api/admin/stats';
  var SLOTS = ['top', 'bottom'];
  var LANGS = ['en', 'bn'];                  // UI and site languages
  var CAMPAIGN_LANGS = ['any', 'en', 'bn'];  // campaign targeting ("any" = every visitor)
  var MODES = ['adsense', 'direct', 'house', 'off'];
  var LANG_KEY = 'jb_lang';
  var LOCALES = { en: 'en-GB', bn: 'bn-BD' };
  var MAX_STATS_RANGE_DAYS = 92;             // same limit as the server
  var STRINGS = window.JBAdminStrings || { en: {}, bn: {} };

  var state = {
    me: '',
    baseVersion: 0,     // version the draft is based on (sent as baseVersion on PUT)
    saved: null,        // last config from the server (for discard)
    draft: null,        // {slots, campaigns} being edited
    history: [],
    stats: null,        // last stats response, re-rendered on language change
    statsError: null,   // () => message when the last stats load failed
    dirty: false,
    saving: false,      // a PUT is in flight
    editingIndex: -1,   // -1 = new campaign
    editorErrors: [],   // message keys currently listed in the editor
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

  // --- language --------------------------------------------------------------

  function storedLang() {
    try {
      var v = window.localStorage.getItem(LANG_KEY);
      return LANGS.indexOf(v) === -1 ? 'en' : v;
    } catch (e) { return 'en'; }
  }

  var lang = storedLang();
  var fmt = makeFormatters(lang);

  function makeFormatters(l) {
    var locale = LOCALES[l];
    return {
      num: new Intl.NumberFormat(locale),
      pct: new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      dateTime: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }),
      date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
    };
  }

  /** Translate `key`, filling {name} placeholders from `params` (values used as-is). */
  function t(key, params) {
    var s = STRINGS[lang][key];
    if (s == null) s = STRINGS.en[key];
    if (s == null) return key;
    return params ? s.replace(/\{(\w+)\}/g, function (m, p) { return params[p] != null ? String(params[p]) : m; }) : s;
  }

  function num(n) { return fmt.num.format(n); }

  function fmtDate(ymd) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return '—';
    return fmt.date.format(new Date(ymd + 'T00:00:00Z'));
  }

  function slotLabel(name) { return SLOTS.indexOf(name) === -1 ? String(name || '—') : t('slot.' + name); }
  function campaignLang(c) { return c.lang == null ? 'any' : c.lang; }
  function langLabel(l) { return CAMPAIGN_LANGS.indexOf(l) === -1 ? String(l) : t('lang.' + l); }

  /** Apply the current language to static markup: [data-i18n] text, [data-i18n-<attr>] attributes. */
  function applyStatic() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach(function (n) { n.textContent = t(n.getAttribute('data-i18n')); });
    ['aria-label', 'placeholder', 'title'].forEach(function (attr) {
      $$('[data-i18n-' + attr + ']').forEach(function (n) { n.setAttribute(attr, t(n.getAttribute('data-i18n-' + attr))); });
    });
    $$('[data-set-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === lang)); });
  }

  function setLang(next) {
    if (LANGS.indexOf(next) === -1 || next === lang) return;
    lang = next;
    fmt = makeFormatters(lang);
    try { window.localStorage.setItem(LANG_KEY, lang); } catch (e) { /* private mode: not persisted */ }
    applyStatic();
    // The static save label was just reset; keep "Saving…" while a save is in flight.
    if (state.saving) $('#save').textContent = t('saving');
    if (state.draft) renderAll();
    renderStats();
    if (dialog && dialog.open) {
      $('#editor-title').textContent = t(state.editingIndex >= 0 ? 'editor.edit' : 'editor.new');
      showErrors(state.editorErrors);
      syncEditor();
    }
    refreshNotice();
  }

  function initLang() {
    applyStatic();
    $$('[data-set-lang]').forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.getAttribute('data-set-lang')); });
    });
  }

  // --- dates & campaign helpers --------------------------------------------------

  // Business dates are Bangladesh time (UTC+6, no DST) — same rule as the server.
  function todayDhaka() {
    return new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10);
  }
  function addDays(ymd, n) {
    var d = new Date(ymd + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function daySpan(from, to) {
    return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000) + 1;
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
  var noticeMessage = null; // () => string, so a visible notice follows language changes

  /** Show a notice. `message` is a function returning the (translated) text. */
  function notify(message, kind, sticky) {
    var n = $('#notice');
    noticeMessage = message;
    n.textContent = message();
    n.className = 'notice ' + (kind || 'info');
    n.hidden = false;
    clearTimeout(noticeTimer);
    if (!sticky) noticeTimer = setTimeout(hideNotice, 6000);
  }

  function hideNotice() {
    $('#notice').hidden = true;
    noticeMessage = null;
  }

  function refreshNotice() {
    if (noticeMessage && !$('#notice').hidden) $('#notice').textContent = noticeMessage();
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
    if (r.status === 0) return t('err.network');
    if (r.status === 401 || r.status === 403) return t('err.denied', { status: r.status });
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
    $$('.tab').forEach(function (other) {
      var on = other === tab;
      other.setAttribute('aria-selected', String(on));
      other.tabIndex = on ? 0 : -1;
      $('#' + other.getAttribute('aria-controls')).hidden = !on;
    });
    if (tab.id === 'tab-stats' && !$('#stats-rows').childElementCount) loadStats();
  }

  function initTabs() {
    var tabs = $$('.tab');
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { selectTab(tab); });
      tab.addEventListener('keydown', function (e) {
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
        h('td', { 'data-label': t('col.campaign') },
          h('div', { class: 'cell-title', text: c.name }),
          h('div', { class: 'cell-sub' },
            isHouse(c) ? h('span', { class: 'tag house', text: t('tag.house') }) : c.advertiser)),
        h('td', { 'data-label': t('col.slot'), text: slotLabel(c.slot) }),
        h('td', { 'data-label': t('col.lang'), text: langLabel(campaignLang(c)) }),
        h('td', { 'data-label': t('col.type'), text: c.type === 'image' || c.type === 'text' ? t('type.' + c.type) : c.type }),
        h('td', { 'data-label': t('col.period'), text: fmtDate(c.startDate) + ' – ' + fmtDate(c.endDate) }),
        h('td', { 'data-label': t('col.weight'), class: 'num', text: num(c.weight) }),
        h('td', { 'data-label': t('col.status') }, h('span', { class: 'status ' + st, text: t('status.' + st) })),
        h('td', { class: 'actions' },
          h('button', { type: 'button', class: 'btn small', text: t('btn.edit'), onclick: function () { openEditor(i); } }),
          h('button', { type: 'button', class: 'btn small ghost', text: t('btn.duplicate'), onclick: function () { duplicateCampaign(i); } }),
          h('button', { type: 'button', class: 'btn small danger', text: t('btn.delete'), onclick: function () { deleteCampaign(i); } }))));
    });
    tbody.replaceChildren.apply(tbody, rows);
    $('#campaign-empty').hidden = rows.length > 0;
  }

  function duplicateCampaign(i) {
    var c = clone(state.draft.campaigns[i]);
    c.id = newId();
    c.name = (c.name + t('copySuffix')).slice(0, 80);
    c.active = false;
    state.draft.campaigns.splice(i + 1, 0, c);
    setDirty(true);
    renderAll();
    notify(function () { return t('msg.duplicated'); }, 'info');
  }

  function deleteCampaign(i) {
    var c = state.draft.campaigns[i];
    if (!window.confirm(t('confirm.delete', { name: c.name }))) return;
    state.draft.campaigns.splice(i, 1);
    setDirty(true);
    renderAll();
  }

  // --- editor ----------------------------------------------------------------

  var form, dialog;

  function blankCampaign() {
    var today = todayDhaka();
    return {
      id: newId(), name: '', advertiser: '', slot: 'top', lang: 'any', type: 'text', imageUrl: '',
      headline: '', body: '', ctaText: t('editor.defaultCta'), ctaUrl: '', bgColor: '',
      startDate: today, endDate: addDays(today, 29), weight: 10, active: true,
    };
  }

  function openEditor(index) {
    state.editingIndex = index;
    var c = index >= 0 ? state.draft.campaigns[index] : blankCampaign();
    $('#editor-title').textContent = t(index >= 0 ? 'editor.edit' : 'editor.new');
    $('#f-id').textContent = c.id;
    form.dataset.id = c.id;
    form.elements.name.value = c.name;
    form.elements.advertiser.value = isHouse(c) ? '' : c.advertiser;
    form.elements.isHouse.checked = isHouse(c);
    form.elements.slot.value = c.slot;
    // Campaigns saved before language targeting have no lang: they show to everyone.
    form.elements.lang.value = campaignLang(c);
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
      lang: el.lang.value,
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

  /** Client-side checks for fast feedback. Returns message keys; the server is authoritative. */
  function validateForm(c) {
    var errs = [];
    if (!c.name) errs.push('v.name');
    if (!c.advertiser) errs.push('v.advertiser');
    if (CAMPAIGN_LANGS.indexOf(c.lang) === -1) errs.push('v.lang');
    if (!c.headline) errs.push('v.headline');
    if (!c.ctaText) errs.push('v.ctaText');
    if (!isHttpsUrl(c.ctaUrl)) errs.push('v.ctaUrl');
    if (c.type === 'image' && !isHttpsUrl(c.imageUrl)) errs.push('v.imageUrl');
    if (!c.startDate || !c.endDate) errs.push('v.dates');
    else if (c.endDate < c.startDate) errs.push('v.dateOrder');
    if (!(c.weight >= 1 && c.weight <= 100)) errs.push('v.weight');
    var dup = state.draft.campaigns.some(function (o, i) { return o.id === c.id && i !== state.editingIndex; });
    if (dup) errs.push('v.duplicateId');
    return errs;
  }

  function showErrors(keys) {
    state.editorErrors = keys;
    var ul = $('#editor-errors');
    ul.replaceChildren.apply(ul, keys.map(function (k) { return h('li', { text: t(k) }); }));
    ul.hidden = keys.length === 0;
  }

  function syncEditor() {
    var el = form.elements;
    var type = el.type.value || 'text';
    $$('[data-show]', form).forEach(function (n) { n.hidden = n.getAttribute('data-show') !== type; });
    el.advertiser.disabled = el.isHouse.checked;
    el.bgColor.disabled = !el.useBg.checked;
    $$('.counter', form).forEach(function (n) {
      var input = el[n.getAttribute('data-for')];
      n.textContent = num(Array.from(input.value).length) + '/' + num(input.maxLength);
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
      msg.textContent = t('preview.missing');
      return;
    }
    var card = window.JBAds.buildCard(c, {
      // The "Ad" label as visitors of the campaign's language see it.
      lang: LANGS.indexOf(c.lang) === -1 ? lang : c.lang,
      onClick: function (e) { e.preventDefault(); },
    });
    slot.replaceChildren(card || h('span', { class: 'preview-empty', text: t('preview.empty') }));
    msg.textContent = c.type === 'image' ? t('preview.imageAlt') : '';
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
        notify(function () { return t('msg.applied'); }, 'info');
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
      // What each site language can show today (a campaign with lang "any" counts for both).
      var counts = LANGS.map(function (l) {
        var forLang = live.filter(function (c) { var cl = campaignLang(c); return cl === 'any' || cl === l; });
        var paid = forLang.filter(function (c) { return !isHouse(c); }).length;
        return t('slot.liveCounts', { lang: t('lang.' + l), paid: num(paid), house: num(forLang.length - paid) });
      });
      var uid = 'slot-' + name;

      var modeSel = h('select', { id: uid + '-mode' });
      MODES.forEach(function (m) {
        var o = h('option', { value: m, text: t('mode.' + m) });
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
          h('h3', { text: slotLabel(name) + ' (' + name + ')' }),
          h('label', { class: 'check switch', for: uid + '-enabled' }, enabled, ' ' + t('slot.on'))),
        h('label', { class: 'field', for: uid + '-mode' }, t('slot.mode'), modeSel),
        adsenseBox,
        h('p', { class: 'hint', text: t('slot.liveToday') + ' — ' + counts.join(' · ') }));
    });
    wrap.replaceChildren.apply(wrap, cards);
  }

  // --- history ---------------------------------------------------------------

  function renderHistory() {
    var tbody = $('#history-rows');
    var rows = state.history.map(function (v) {
      var current = v.version === state.baseVersion;
      return h('tr', current ? { class: 'current' } : null,
        h('td', { class: 'num', 'data-label': t('col.version'), text: num(v.version) }),
        h('td', { 'data-label': t('col.time'), text: v.updatedAt ? fmt.dateTime.format(new Date(v.updatedAt)) : '—' }),
        h('td', { 'data-label': t('col.savedBy'), text: v.updatedBy || '—' }),
        h('td', { class: 'num', 'data-label': t('col.campaigns'), text: num(v.campaigns) }),
        h('td', { class: 'actions' }, current
          ? h('span', { class: 'status live', text: t('history.current') })
          : h('button', { type: 'button', class: 'btn small', text: t('history.load'), onclick: function () { loadVersion(v.version); } })));
    });
    tbody.replaceChildren.apply(tbody, rows);
    $('#history-empty').hidden = rows.length > 0;
  }

  function loadVersion(version) {
    if (state.dirty && !window.confirm(t('confirm.lose'))) return;
    api(API_CONFIG + '?version=' + encodeURIComponent(version)).then(function (r) {
      if (!r.ok) {
        notify(function () { return authError(r) || t('err.loadVersion'); }, 'error');
        return;
      }
      state.draft = { slots: clone(r.data.config.slots), campaigns: clone(r.data.config.campaigns) };
      setDirty(true);
      renderAll();
      selectTab($('#tab-campaigns'));
      notify(function () { return t('msg.versionLoaded', { v: num(version) }); }, 'info', true);
    });
  }

  // --- stats -----------------------------------------------------------------

  function setRange(days) {
    var to = todayDhaka();
    $('#stats-to').value = to;
    $('#stats-from').value = addDays(to, -(days - 1));
  }

  function statsMessageRow(text) {
    return h('tr', null, h('td', { colspan: '6', class: 'empty', text: text }));
  }

  function loadStats() {
    var from = $('#stats-from').value;
    var to = $('#stats-to').value;
    var tbody = $('#stats-rows');
    state.stats = null;
    state.statsError = null;
    // Same rules as the server, so the admin gets a message in their language.
    if (!from || !to || from > to || daySpan(from, to) > MAX_STATS_RANGE_DAYS) {
      state.statsError = function () { return t('err.statsRange', { max: num(MAX_STATS_RANGE_DAYS) }); };
      renderStats();
      return;
    }
    tbody.replaceChildren(statsMessageRow(t('loading')));
    $('#stats-foot').replaceChildren();
    $('#stats-note').textContent = '';
    var qs = '?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to);
    api(API_STATS + qs).then(function (r) {
      if (r.ok) state.stats = r.data;
      else {
        state.statsError = function () {
          return authError(r) || (r.status === 400 ? t('err.statsRange', { max: num(MAX_STATS_RANGE_DAYS) }) : t('err.stats'));
        };
      }
      renderStats();
    });
  }

  /** Render the last stats result (or error) in the current language. */
  function renderStats() {
    var tbody = $('#stats-rows');
    var foot = $('#stats-foot');
    var note = $('#stats-note');
    if (state.statsError) {
      tbody.replaceChildren(statsMessageRow(state.statsError()));
      foot.replaceChildren();
      note.textContent = '';
      return;
    }
    var d = state.stats;
    if (!d) return; // not loaded yet, or a load is in flight
    var rows = (d.rows || []).map(function (row) {
      return h('tr', null,
        h('td', { 'data-label': t('col.campaign') },
          h('div', { class: 'cell-title', text: row.name || t('stats.deleted') }),
          h('div', { class: 'cell-sub mono', text: row.campaignId })),
        h('td', { 'data-label': t('col.advertiser'), text: row.advertiser === 'house' ? t('tag.house') : (row.advertiser || '—') }),
        h('td', { 'data-label': t('col.slot'), text: row.slot ? slotLabel(row.slot) : '—' }),
        h('td', { class: 'num', 'data-label': t('col.impressions'), text: num(row.impressions) }),
        h('td', { class: 'num', 'data-label': t('col.clicks'), text: num(row.clicks) }),
        h('td', { class: 'num', 'data-label': t('col.ctr'), text: fmt.pct.format(row.ctr) + '%' }));
    });
    if (!rows.length) rows = [statsMessageRow(t('stats.noData'))];
    tbody.replaceChildren.apply(tbody, rows);
    var tot = d.totals || { impressions: 0, clicks: 0, ctr: 0 };
    foot.replaceChildren(h('tr', null,
      h('th', { scope: 'row', colspan: '3', text: t('stats.total') }),
      h('td', { class: 'num', text: num(tot.impressions) }),
      h('td', { class: 'num', text: num(tot.clicks) }),
      h('td', { class: 'num', text: fmt.pct.format(tot.ctr) + '%' })));
    var text = t('stats.note');
    if (d.impressionSampleRate && d.impressionSampleRate < 1) {
      text += t('stats.sampled', { pct: num(Math.round(d.impressionSampleRate * 100)) });
    }
    note.textContent = text;
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
        notify(function () { return authError(r) || t('err.loadConfig'); }, 'error', true);
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

  var FIELD_KEYS = {
    id: 'f.id', name: 'f.name', advertiser: 'f.advertiser', slot: 'f.slot', lang: 'f.lang', type: 'f.type',
    imageUrl: 'f.imageUrl', headline: 'f.headline', body: 'f.body', ctaText: 'f.ctaText', ctaUrl: 'f.ctaUrl',
    bgColor: 'f.bgColor', startDate: 'f.startDate', endDate: 'f.endDate', weight: 'f.weight', active: 'f.active',
  };

  /** Server validation error -> text in the admin's language (falls back to the server's message). */
  function errorText(e) {
    var key = 'e.' + e.code;
    if (!e.code || STRINGS.en[key] == null) return e.message || '';
    var params = {};
    Object.keys(e.params || {}).forEach(function (k) {
      var v = e.params[k];
      params[k] = typeof v === 'number' ? num(v) : v;
    });
    return t(key, params);
  }

  function describeError(e) {
    // "campaigns[3].ctaUrl" -> "“name” — Button link (https): message"
    var m = /^campaigns\[(\d+)\]\.?(.*)$/.exec(e.path || '');
    if (m) {
      var c = state.draft.campaigns[Number(m[1])];
      var field = m[2] ? (FIELD_KEYS[m[2]] ? t(FIELD_KEYS[m[2]]) : m[2]) : '';
      return '“' + (c ? c.name || c.id : '#' + m[1]) + '”' + (field ? ' — ' + field : '') + ': ' + errorText(e);
    }
    // "slots.top.adsense.client" -> "Top — adsense.client: message"
    var s = /^slots\.(\w+)\.?(.*)$/.exec(e.path || '');
    if (s) return slotLabel(s[1]) + (s[2] ? ' — ' + s[2] : '') + ': ' + errorText(e);
    return (e.path ? e.path + ': ' : '') + errorText(e);
  }

  function save() {
    var btn = $('#save');
    state.saving = true;
    btn.disabled = true;
    btn.textContent = t('saving');
    api(API_CONFIG, { method: 'PUT', body: { baseVersion: state.baseVersion, config: state.draft } }).then(function (r) {
      state.saving = false;
      btn.textContent = t('save');
      if (r.ok) {
        acceptServerConfig(r.data.config);
        var saved = state.baseVersion;
        notify(function () { return t('msg.saved', { v: num(saved) }); }, 'ok');
        return api(API_CONFIG).then(function (r2) {
          if (r2.ok) state.history = r2.data.history || [];
          renderAll();
        });
      }
      btn.disabled = false;
      if (r.status === 422 && Array.isArray(r.data.errors)) {
        var errors = r.data.errors;
        notify(function () {
          return t('err.saveInvalid', { errors: errors.slice(0, 5).map(describeError).join(' • ') }) +
            (errors.length > 5 ? t('err.more', { n: num(errors.length - 5) }) : '');
        }, 'error', true);
      } else if (r.status === 409) {
        var current = r.data.currentVersion || 0;
        notify(function () { return t('err.conflict', { v: num(current) }); }, 'error', true);
      } else {
        notify(function () { return authError(r) || t('err.saveFailed', { status: r.status }); }, 'error', true);
      }
    });
  }

  function discard() {
    if (!window.confirm(t('confirm.discard'))) return;
    acceptServerConfig(state.saved);
    renderAll();
    hideNotice();
  }

  function init() {
    initLang();
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
