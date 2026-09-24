// Unit tests for the pure ad logic. Deterministic, no network.
// Run: node --test tests/
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  addDays, aggregateStats, ctr, daySpan, defaultConfig, eligibleCampaigns, isLikelyBot, isValidDate,
  monthPrefixes, normalizeHttpsUrl, parseStatsKey, parseTrackEvent, pickWeighted, resolveSlot, sampleRate,
  statsKey, todayLocal, toPublicConfig, validateCampaign, validateConfig,
} from '../functions/_lib/ads-core.js';
import { parseAdminEmails } from '../functions/_lib/auth.js';

const TODAY = '2026-09-24';

function campaign(overrides = {}) {
  return {
    id: 'acme-top',
    name: 'Acme',
    advertiser: 'Acme Ltd',
    slot: 'top',
    type: 'text',
    imageUrl: '',
    headline: 'হেডলাইন',
    body: 'বিবরণ',
    ctaText: 'দেখুন',
    ctaUrl: 'https://acme.example/offer',
    bgColor: '',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    weight: 10,
    active: true,
    ...overrides,
  };
}

function config({ top = {}, bottom = {}, campaigns = [] } = {}) {
  const slot = (o) => ({ enabled: true, mode: 'direct', adsense: { client: '', slot: '' }, ...o });
  return { slots: { top: slot(top), bottom: slot(bottom) }, campaigns };
}

const house = (o = {}) => campaign({ id: 'house-top', advertiser: 'house', ...o });

// ---------------------------------------------------------------------------

describe('dates', () => {
  test('todayLocal uses Bangladesh time (UTC+6)', () => {
    assert.equal(todayLocal(new Date('2026-09-24T17:59:59Z')), '2026-09-24');
    assert.equal(todayLocal(new Date('2026-09-24T18:00:00Z')), '2026-09-25');
  });

  test('isValidDate rejects malformed and impossible dates', () => {
    assert.ok(isValidDate('2024-02-29'));
    assert.ok(!isValidDate('2026-02-29'));
    assert.ok(!isValidDate('2026-13-01'));
    assert.ok(!isValidDate('2026-9-1'));
    assert.ok(!isValidDate('2026-09-01T00:00'));
    assert.ok(!isValidDate(20260901));
  });

  test('addDays, daySpan, monthPrefixes', () => {
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
    assert.equal(daySpan('2026-09-01', '2026-09-01'), 1);
    assert.equal(daySpan('2026-09-01', '2026-09-30'), 30);
    assert.deepEqual(monthPrefixes('2026-11-15', '2027-02-02'), ['2026-11', '2026-12', '2027-01', '2027-02']);
    assert.deepEqual(monthPrefixes('2026-09-01', '2026-09-30'), ['2026-09']);
  });
});

describe('normalizeHttpsUrl', () => {
  test('accepts https', () => {
    assert.equal(normalizeHttpsUrl(' https://example.com/a?b=1 '), 'https://example.com/a?b=1');
  });
  for (const bad of [
    'http://example.com', 'javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', '//example.com',
    '/relative', 'https://user:pass@example.com', 'https://exa mple.com', '', null, 42, `https://e.com/${'a'.repeat(2100)}`,
  ]) {
    test(`rejects ${String(bad).slice(0, 40)}`, () => assert.equal(normalizeHttpsUrl(bad), null));
  }
});

describe('validateCampaign', () => {
  test('valid campaign passes and is normalised', () => {
    const r = validateCampaign(campaign({ bgColor: '#AABBCC', name: '  Acme  ', extra: 'dropped' }));
    assert.deepEqual(r.errors, []);
    assert.equal(r.value.name, 'Acme');
    assert.equal(r.value.bgColor, '#aabbcc');
    assert.ok(!('extra' in r.value));
  });

  const cases = [
    ['non-https ctaUrl', { ctaUrl: 'http://acme.example' }, 'ctaUrl'],
    ['javascript ctaUrl', { ctaUrl: 'javascript:alert(1)' }, 'ctaUrl'],
    ['image without imageUrl', { type: 'image', imageUrl: '' }, 'imageUrl'],
    ['http imageUrl', { type: 'image', imageUrl: 'http://x.example/a.png' }, 'imageUrl'],
    ['headline too long', { headline: 'অ'.repeat(61) }, 'headline'],
    ['body too long', { body: 'x'.repeat(141) }, 'body'],
    ['ctaText too long', { ctaText: 'x'.repeat(25) }, 'ctaText'],
    ['missing headline', { headline: '   ' }, 'headline'],
    ['newline in headline', { headline: 'a\nb' }, 'headline'],
    ['control char', { name: 'a\u0000b' }, 'name'],
    ['bad start date', { startDate: '2026-02-30' }, 'startDate'],
    ['end before start', { startDate: '2026-09-10', endDate: '2026-09-09' }, 'endDate'],
    ['weight zero', { weight: 0 }, 'weight'],
    ['weight float', { weight: 1.5 }, 'weight'],
    ['weight string', { weight: '5' }, 'weight'],
    ['bad slot', { slot: 'sidebar' }, 'slot'],
    ['bad type', { type: 'video' }, 'type'],
    ['bad id', { id: 'Bad ID!' }, 'id'],
    ['bad color', { bgColor: 'red' }, 'bgColor'],
    ['active not boolean', { active: 'yes' }, 'active'],
    ['non-string text', { headline: { html: '<b>' } }, 'headline'],
  ];
  for (const [name, patch, field] of cases) {
    test(`rejects ${name}`, () => {
      const r = validateCampaign(campaign(patch));
      assert.ok(r.errors.some((e) => e.path === `campaign.${field}`), JSON.stringify(r.errors));
    });
  }

  test('headline length counts characters, not UTF-16 units', () => {
    assert.deepEqual(validateCampaign(campaign({ headline: '😀'.repeat(60) })).errors, []);
  });

  test('markup in text is kept as text (escaping happens at render time)', () => {
    const r = validateCampaign(campaign({ headline: '<img src=x onerror=alert(1)>' }));
    assert.deepEqual(r.errors, []);
    assert.equal(r.value.headline, '<img src=x onerror=alert(1)>');
  });
});

describe('validateConfig', () => {
  test('default config is valid', () => {
    const r = validateConfig(defaultConfig());
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.ok(!('version' in r.value), 'server-owned metadata must not come from input');
  });

  test('rejects non-object and missing parts', () => {
    assert.equal(validateConfig(null).ok, false);
    assert.equal(validateConfig([]).ok, false);
    const r = validateConfig({});
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.path === 'slots'));
    assert.ok(r.errors.some((e) => e.path === 'campaigns'));
  });

  test('rejects duplicate campaign ids', () => {
    const r = validateConfig(config({ campaigns: [campaign(), campaign()] }));
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.path === 'campaigns[1].id'));
  });

  test('adsense mode requires valid client and slot when enabled', () => {
    assert.equal(validateConfig(config({ top: { mode: 'adsense' } })).ok, false);
    assert.equal(validateConfig(config({ top: { mode: 'adsense', enabled: false } })).ok, true);
    const bad = validateConfig(config({ top: { mode: 'adsense', adsense: { client: 'pub-1', slot: 'abc' } } }));
    assert.ok(bad.errors.some((e) => e.path === 'slots.top.adsense.client'));
    assert.ok(bad.errors.some((e) => e.path === 'slots.top.adsense.slot'));
    const good = validateConfig(config({ top: { mode: 'adsense', adsense: { client: 'ca-pub-1234567890123456', slot: '1234567890' } } }));
    assert.equal(good.ok, true, JSON.stringify(good.errors));
  });

  test('rejects unknown mode and non-boolean enabled', () => {
    const r = validateConfig(config({ top: { mode: 'popup', enabled: 1 } }));
    assert.ok(r.errors.some((e) => e.path === 'slots.top.mode'));
    assert.ok(r.errors.some((e) => e.path === 'slots.top.enabled'));
  });

  test('caps number of campaigns', () => {
    const many = Array.from({ length: 201 }, (_, i) => campaign({ id: `c${i}` }));
    assert.equal(validateConfig(config({ campaigns: many })).ok, false);
  });

  test('error paths point at the offending campaign', () => {
    const r = validateConfig(config({ campaigns: [campaign(), campaign({ id: 'b', ctaUrl: 'ftp://x' })] }));
    assert.deepEqual(r.errors.map((e) => e.path), ['campaigns[1].ctaUrl']);
  });
});

describe('selection', () => {
  test('eligibleCampaigns: active, same slot, inclusive date range', () => {
    const cfg = config({
      campaigns: [
        campaign({ id: 'a' }),
        campaign({ id: 'starts-today', startDate: TODAY, endDate: TODAY }),
        campaign({ id: 'ended', endDate: '2026-09-23' }),
        campaign({ id: 'future', startDate: '2026-09-25' }),
        campaign({ id: 'inactive', active: false }),
        campaign({ id: 'bottom', slot: 'bottom' }),
      ],
    });
    assert.deepEqual(eligibleCampaigns(cfg, 'top', TODAY).map((c) => c.id), ['a', 'starts-today']);
  });

  test('direct: paid campaigns win over house', () => {
    const cfg = config({ campaigns: [house(), campaign()] });
    const r = resolveSlot(cfg, 'top', TODAY);
    assert.equal(r.mode, 'direct');
    assert.deepEqual(r.campaigns.map((c) => c.id), ['acme-top']);
  });

  test('direct: falls back to house when no paid campaign is live', () => {
    const cfg = config({ campaigns: [house(), campaign({ endDate: '2026-09-01' })] });
    const r = resolveSlot(cfg, 'top', TODAY);
    assert.equal(r.mode, 'house');
    assert.deepEqual(r.campaigns.map((c) => c.id), ['house-top']);
  });

  test('house advertiser match is case/space-insensitive', () => {
    const r = resolveSlot(config({ campaigns: [house({ advertiser: ' House ' })] }), 'top', TODAY);
    assert.equal(r.mode, 'house');
  });

  test('direct: hides the slot when nothing is eligible', () => {
    assert.deepEqual(resolveSlot(config({ campaigns: [] }), 'top', TODAY), { mode: 'off' });
  });

  test('house mode ignores paid campaigns', () => {
    const cfg = config({ top: { mode: 'house' }, campaigns: [campaign()] });
    assert.deepEqual(resolveSlot(cfg, 'top', TODAY), { mode: 'off' });
  });

  test('off mode and disabled slots are hidden', () => {
    assert.deepEqual(resolveSlot(config({ top: { mode: 'off' }, campaigns: [campaign()] }), 'top', TODAY), { mode: 'off' });
    assert.deepEqual(resolveSlot(config({ top: { enabled: false }, campaigns: [campaign()] }), 'top', TODAY), { mode: 'off' });
    assert.deepEqual(resolveSlot({}, 'top', TODAY), { mode: 'off' });
  });

  test('adsense mode returns ids; falls back to house when ids are missing', () => {
    const ids = { client: 'ca-pub-1234567890123456', slot: '1234567890' };
    assert.deepEqual(resolveSlot(config({ top: { mode: 'adsense', adsense: ids } }), 'top', TODAY), { mode: 'adsense', adsense: ids });
    const r = resolveSlot(config({ top: { mode: 'adsense' }, campaigns: [house(), campaign()] }), 'top', TODAY);
    assert.equal(r.mode, 'house');
  });
});

describe('pickWeighted', () => {
  const list = [{ id: 'a', weight: 1 }, { id: 'b', weight: 3 }];

  test('respects weight boundaries', () => {
    assert.equal(pickWeighted(list, () => 0).id, 'a');
    assert.equal(pickWeighted(list, () => 0.2499).id, 'a');
    assert.equal(pickWeighted(list, () => 0.25).id, 'b');
    assert.equal(pickWeighted(list, () => 0.9999).id, 'b');
  });

  test('distribution roughly follows weights (seeded PRNG)', () => {
    let seed = 42;
    const rand = () => { seed = (seed * 1664525 + 1013904223) % 2 ** 32; return seed / 2 ** 32; };
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 20_000; i++) counts[pickWeighted(list, rand).id]++;
    const share = counts.b / 20_000;
    assert.ok(share > 0.72 && share < 0.78, `b share ${share}`);
  });

  test('empty list and bad weights', () => {
    assert.equal(pickWeighted([]), null);
    assert.equal(pickWeighted(null), null);
    assert.equal(pickWeighted([{ id: 'x', weight: -5 }], () => 0.5).id, 'x');
  });
});

describe('toPublicConfig', () => {
  test('exposes only public fields, per slot', () => {
    const cfg = { ...config({ bottom: { mode: 'off' }, campaigns: [campaign(), house({ id: 'h', slot: 'bottom' })] }), version: 7 };
    const pub = toPublicConfig(cfg, TODAY);
    assert.equal(pub.version, 7);
    assert.deepEqual(pub.slots.bottom, { mode: 'off' });
    const [c] = pub.slots.top.campaigns;
    assert.deepEqual(Object.keys(c).sort(), ['bgColor', 'body', 'ctaText', 'ctaUrl', 'headline', 'house', 'id', 'imageUrl', 'type', 'weight']);
    assert.equal(c.house, false);
    const json = JSON.stringify(pub);
    for (const secret of ['Acme Ltd', 'startDate', 'endDate', 'advertiser', 'updatedBy']) {
      assert.ok(!json.includes(secret), `leaked ${secret}`);
    }
  });

  test('default config serves Bangla house ads in both slots', () => {
    const pub = toPublicConfig(defaultConfig(), TODAY);
    for (const s of ['top', 'bottom']) {
      assert.equal(pub.slots[s].mode, 'house');
      assert.equal(pub.slots[s].campaigns[0].house, true);
      assert.match(pub.slots[s].campaigns[0].headline, /[ঀ-৿]/);
    }
  });
});

describe('tracking & stats helpers', () => {
  test('parseTrackEvent validates shape', () => {
    assert.deepEqual(parseTrackEvent({ campaignId: 'acme-top', event: 'click', extra: 1 }), { campaignId: 'acme-top', event: 'click' });
    assert.equal(parseTrackEvent({ campaignId: 'acme-top', event: 'hover' }), null);
    assert.equal(parseTrackEvent({ campaignId: '../../x', event: 'click' }), null);
    assert.equal(parseTrackEvent({ campaignId: 'a:b', event: 'click' }), null);
    assert.equal(parseTrackEvent('click'), null);
    assert.equal(parseTrackEvent(null), null);
  });

  test('statsKey round-trips', () => {
    const k = statsKey('2026-09-24', 'acme-top');
    assert.equal(k, 'stats:2026-09-24:acme-top');
    assert.deepEqual(parseStatsKey(k), { date: '2026-09-24', campaignId: 'acme-top' });
    assert.equal(parseStatsKey('config:current'), null);
  });

  test('isLikelyBot', () => {
    const chrome = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36';
    assert.equal(isLikelyBot(chrome), false);
    assert.equal(isLikelyBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'), true);
    assert.equal(isLikelyBot('Mozilla/5.0 HeadlessChrome/128.0'), true);
    assert.equal(isLikelyBot('curl/8.4.0'), true);
    assert.equal(isLikelyBot(''), true);
    assert.equal(isLikelyBot(null), true);
  });

  test('sampleRate parsing', () => {
    assert.equal(sampleRate(undefined), 1);
    assert.equal(sampleRate('0.1'), 0.1);
    assert.equal(sampleRate('0'), 1);
    assert.equal(sampleRate('2'), 1);
    assert.equal(sampleRate('abc'), 1);
  });

  test('aggregateStats sums days, computes CTR, joins names, keeps deleted campaigns', () => {
    const { rows, totals } = aggregateStats(
      [
        { campaignId: 'acme-top', impressions: 100, clicks: 3 },
        { campaignId: 'acme-top', impressions: 300, clicks: 5 },
        { campaignId: 'gone', impressions: 10, clicks: 0 },
        { campaignId: 'no-meta', impressions: undefined, clicks: undefined },
      ],
      [campaign()],
    );
    assert.deepEqual(rows[0], { campaignId: 'acme-top', name: 'Acme', advertiser: 'Acme Ltd', slot: 'top', impressions: 400, clicks: 8, ctr: 2 });
    assert.equal(rows[1].campaignId, 'gone');
    assert.equal(rows[1].name, null);
    assert.equal(rows[2].ctr, 0);
    assert.deepEqual(totals, { impressions: 410, clicks: 8, ctr: 1.95 });
  });

  test('ctr handles zero impressions', () => {
    assert.equal(ctr(5, 0), 0);
    assert.equal(ctr(1, 3), 33.33);
  });
});

describe('auth helpers', () => {
  test('parseAdminEmails trims, lowercases and drops empties', () => {
    assert.deepEqual(parseAdminEmails(' A@x.com, ,b@Y.com ,'), ['a@x.com', 'b@y.com']);
    assert.deepEqual(parseAdminEmails(undefined), []);
  });
});
