/* JSON বন্ধু — ad slot renderer. Vanilla JS, no dependencies.
 *
 * - Fetches /api/ads and fills every [data-ad="<slot>"] element.
 * - AdSense mode: inserts <ins class="adsbygoogle"> and loads adsbygoogle.js once.
 * - Direct/house mode: renders a card built with DOM APIs only (textContent /
 *   setAttribute), never innerHTML, so advertiser text cannot inject markup.
 * - Impression beacon once the card is >= 50% visible for 1s; click beacon on CTA.
 * - localStorage jb_premium = "1" hides all ads.
 * - Any failure (file://, offline, API down, bad data) leaves the placeholders as they are.
 *
 * Also exposes window.JBAds.buildCard for the admin preview, so the portal shows
 * exactly what the site renders.
 */
(function () {
  'use strict';

  var API_ADS = '/api/ads';
  var API_TRACK = '/api/track';
  var ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
  var FETCH_TIMEOUT_MS = 5000;
  var DWELL_MS = 1000;
  var ADSENSE_CLIENT_RE = /^ca-pub-\d{10,20}$/;
  var ADSENSE_SLOT_RE = /^\d{6,20}$/;
  var COLOR_RE = /^#[0-9a-fA-F]{6}$/;
  var ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

  var script = document.currentScript;

  function isPremium() {
    try { return window.localStorage.getItem('jb_premium') === '1'; } catch (e) { return false; }
  }

  function safeHttpsUrl(value) {
    if (typeof value !== 'string' || !value) return null;
    try {
      var u = new URL(value);
      return u.protocol === 'https:' && !u.username && !u.password ? u.href : null;
    } catch (e) { return null; }
  }

  function str(v, max) {
    return typeof v === 'string' ? v.slice(0, max) : '';
  }

  // Mirrors pickWeighted() in functions/_lib/ads-core.js (unit-tested there).
  function pickWeighted(list) {
    if (!list || !list.length) return null;
    var total = 0;
    var weights = list.map(function (c) {
      var w = typeof c.weight === 'number' && c.weight > 0 ? c.weight : 1;
      total += w;
      return w;
    });
    var r = Math.random() * total;
    for (var i = 0; i < list.length; i++) {
      r -= weights[i];
      if (r < 0) return list[i];
    }
    return list[list.length - 1];
  }

  // Pick black or white text for a custom background (WCAG relative luminance).
  function inkFor(hex) {
    var rgb = [1, 3, 5].map(function (i) {
      var c = parseInt(hex.substr(i, 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    var lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    return lum > 0.179 ? '#111111' : '#ffffff';
  }

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text) n.textContent = text;
    return n;
  }

  /**
   * Build a sponsored card from untrusted campaign data. Returns null if the
   * campaign is unusable (bad URL, missing text). opts.onClick is called on CTA click.
   */
  function buildCard(c, opts) {
    opts = opts || {};
    if (!c || typeof c !== 'object') return null;
    var ctaUrl = safeHttpsUrl(c.ctaUrl);
    var headline = str(c.headline, 60).trim();
    var ctaText = str(c.ctaText, 24).trim();
    var isImage = c.type === 'image';
    var imageUrl = isImage ? safeHttpsUrl(c.imageUrl) : null;
    if (!ctaUrl || !headline || !ctaText || (isImage && !imageUrl)) return null;

    var card = el('div', 'jb-ad ' + (isImage ? 'jb-ad--image' : 'jb-ad--text'));
    if (typeof c.bgColor === 'string' && COLOR_RE.test(c.bgColor)) {
      card.style.setProperty('--jb-ad-bg', c.bgColor);
      card.style.setProperty('--jb-ad-ink', inkFor(c.bgColor));
      card.classList.add('jb-ad--custom');
    }

    card.appendChild(el('span', 'jb-ad__label', 'বিজ্ঞাপন'));

    if (isImage) {
      var media = el('div', 'jb-ad__media');
      var img = document.createElement('img');
      img.src = imageUrl;
      img.alt = headline;
      img.decoding = 'async';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      media.appendChild(img);
      card.appendChild(media);
    } else {
      var text = el('div', 'jb-ad__text');
      text.appendChild(el('p', 'jb-ad__headline', headline));
      var body = str(c.body, 140).trim();
      if (body) text.appendChild(el('p', 'jb-ad__body', body));
      card.appendChild(text);
    }

    var a = el('a', 'jb-ad__cta', ctaText);
    a.href = ctaUrl;
    var sameOrigin = false;
    try { sameOrigin = new URL(ctaUrl).origin === window.location.origin; } catch (e) { /* noop */ }
    if (!sameOrigin) a.target = '_blank';
    a.rel = c.house ? 'noopener' : 'sponsored noopener';
    // Screen readers hear the headline with the CTA (image ads have no visible headline text).
    a.setAttribute('aria-label', ctaText + ' — ' + headline + ' (বিজ্ঞাপন)');
    if (typeof opts.onClick === 'function') {
      a.addEventListener('click', opts.onClick);
      // Middle-click / open-in-new-tab.
      a.addEventListener('auxclick', function (e) { if (e.button === 1) opts.onClick(e); });
    }
    card.appendChild(a);
    return card;
  }

  // --- tracking -------------------------------------------------------------

  function beacon(campaignId, event) {
    if (!ID_RE.test(campaignId)) return;
    var payload = JSON.stringify({ campaignId: campaignId, event: event });
    try {
      // A string body is sent as text/plain (CORS-safelisted); the CTA navigates normally.
      if (navigator.sendBeacon && navigator.sendBeacon(API_TRACK, payload)) return;
    } catch (e) { /* fall through */ }
    try {
      fetch(API_TRACK, {
        method: 'POST', body: payload, keepalive: true, credentials: 'same-origin',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      }).catch(function () {});
    } catch (e) { /* ignore */ }
  }

  function observeImpression(node, campaignId) {
    if (!('IntersectionObserver' in window)) return; // under-count rather than over-count
    var timer = null;
    var visible = false;
    var done = false;
    var io;

    function fire() {
      timer = null;
      if (done || !visible) return;
      if (document.visibilityState !== 'visible') return; // resumes on visibilitychange
      done = true;
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      beacon(campaignId, 'impression');
    }
    function arm() { if (!timer && !done) timer = setTimeout(fire, DWELL_MS); }
    function disarm() { if (timer) { clearTimeout(timer); timer = null; } }
    function onVis() {
      if (document.visibilityState === 'visible' && visible) arm(); else disarm();
    }

    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        visible = e.isIntersecting && e.intersectionRatio >= 0.5;
        if (visible) arm(); else disarm();
      });
    }, { threshold: [0, 0.5] });
    io.observe(node);
    document.addEventListener('visibilitychange', onVis);
  }

  // --- slot rendering -------------------------------------------------------

  function hideSlot(slot) {
    slot.setAttribute('data-ad-state', 'off');
    slot.style.display = 'none';
  }

  function reserveHeight(slot) {
    // Lock the rendered ad to the height the placeholder already reserved (no CLS).
    var h = Math.max(slot.clientHeight, 90);
    slot.style.setProperty('--jb-ad-h', h + 'px');
  }

  var adsenseLoaded = false;
  function loadAdSense(client) {
    if (adsenseLoaded) return;
    adsenseLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = ADSENSE_SRC + '?client=' + encodeURIComponent(client);
    document.head.appendChild(s);
  }

  function renderAdSense(slot, cfg) {
    var client = cfg && cfg.client;
    var adSlot = cfg && cfg.slot;
    if (!ADSENSE_CLIENT_RE.test(client || '') || !ADSENSE_SLOT_RE.test(adSlot || '')) return false;
    reserveHeight(slot);
    var ins = el('ins', 'adsbygoogle jb-adsense');
    ins.setAttribute('data-ad-client', client);
    ins.setAttribute('data-ad-slot', adSlot);
    ins.setAttribute('data-ad-format', 'horizontal');
    ins.setAttribute('data-full-width-responsive', 'false');
    slot.replaceChildren(ins);
    slot.setAttribute('data-ad-state', 'adsense');
    loadAdSense(client);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* ad blockers */ }
    return true;
  }

  function renderCampaign(slot, pool) {
    // Try weighted picks until one renders; drop unusable entries from the pool.
    var candidates = (pool || []).slice();
    while (candidates.length) {
      var c = pickWeighted(candidates);
      var id = c.id;
      var card = ID_RE.test(id || '') && buildCard(c, { onClick: function () { beacon(id, 'click'); } });
      if (card) {
        reserveHeight(slot);
        slot.replaceChildren(card);
        slot.setAttribute('data-ad-state', 'card');
        observeImpression(card, id);
        return true;
      }
      candidates.splice(candidates.indexOf(c), 1);
    }
    return false;
  }

  function renderSlot(slot, decision) {
    if (!decision || typeof decision !== 'object') return; // unknown slot: leave placeholder
    var ok = false;
    if (decision.mode === 'adsense') ok = renderAdSense(slot, decision.adsense);
    else if (decision.mode === 'direct' || decision.mode === 'house') ok = renderCampaign(slot, decision.campaigns);
    if (!ok) hideSlot(slot);
  }

  function injectStyles() {
    if (document.querySelector('link[data-jb-ads-css]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('ads.css', (script && script.src) || window.location.href).href;
    link.setAttribute('data-jb-ads-css', '');
    document.head.appendChild(link);
  }

  function run() {
    var slots = Array.prototype.slice.call(document.querySelectorAll('[data-ad]'));
    if (!slots.length) return;
    if (isPremium()) { slots.forEach(hideSlot); return; }
    if (!/^https?:$/.test(window.location.protocol) || !window.fetch) return;

    injectStyles();
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT_MS) : null;

    fetch(API_ADS, { credentials: 'omit', signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) {
        if (!res.ok || !/json/.test(res.headers.get('Content-Type') || '')) throw new Error('ads api ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || typeof data.slots !== 'object' || !data.slots) return;
        slots.forEach(function (slot) {
          var name = slot.getAttribute('data-ad');
          if (Object.prototype.hasOwnProperty.call(data.slots, name)) renderSlot(slot, data.slots[name]);
        });
      })
      .catch(function () { /* leave placeholders untouched */ })
      .then(function () { if (t) clearTimeout(t); });
  }

  window.JBAds = Object.freeze({ buildCard: buildCard });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
