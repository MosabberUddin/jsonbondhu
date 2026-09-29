// Pure, dependency-free ad logic shared by Pages Functions and tests.
// No I/O here: everything takes plain data in and returns plain data out.

export const SCHEMA_VERSION = 1;
export const SLOT_NAMES = Object.freeze(['top', 'bottom']);
export const MODES = Object.freeze(['adsense', 'direct', 'house', 'off']);
export const CAMPAIGN_TYPES = Object.freeze(['image', 'text']);
// Site UI languages (document.documentElement.lang on the public site).
export const SITE_LANGS = Object.freeze(['en', 'bn']);
// Campaign targeting: "any" shows in every language. Stored campaigns without `lang` mean "any".
export const CAMPAIGN_LANGS = Object.freeze(['any', ...SITE_LANGS]);
export const TRACK_EVENTS = Object.freeze(['impression', 'click']);
export const HOUSE_ADVERTISER = 'house';
export const HISTORY_LIMIT = 10;
export const MAX_CAMPAIGNS = 200;
export const MAX_STATS_RANGE_DAYS = 92;

// Business dates (campaign start/end, stats buckets) are in Bangladesh time.
// Asia/Dhaka is UTC+6 with no DST, so a fixed offset is exact.
export const TZ_OFFSET_MINUTES = 6 * 60;

export const LIMITS = Object.freeze({
  id: 64,
  name: 80,
  advertiser: 80,
  headline: 60,
  body: 140,
  ctaText: 24,
  url: 2048,
});

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const ADSENSE_CLIENT_RE = /^ca-pub-\d{10,20}$/;
const ADSENSE_SLOT_RE = /^\d{6,20}$/;
// C0/C1 control chars except tab/newline (which we also reject in single-line fields).
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2028\u2029]/;

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** YYYY-MM-DD for `now` in Bangladesh time. */
export function todayLocal(now = new Date(), offsetMinutes = TZ_OFFSET_MINUTES) {
  return new Date(now.getTime() + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** True if `s` is a real calendar date in YYYY-MM-DD form. */
export function isValidDate(s) {
  if (typeof s !== 'string') return false;
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Add whole days to a YYYY-MM-DD string. */
export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive day count between two valid dates (to - from + 1). */
export function daySpan(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Distinct YYYY-MM prefixes covering [from, to]. */
export function monthPrefixes(from, to) {
  const out = [];
  let [y, m] = from.slice(0, 7).split('-').map(Number);
  const [ey, em] = to.slice(0, 7).split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

// ---------------------------------------------------------------------------
// URL & text helpers
// ---------------------------------------------------------------------------

/** Returns the normalised URL string if it is an absolute https URL without credentials, else null. */
export function normalizeHttpsUrl(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s || s.length > LIMITS.url || CONTROL_RE.test(s) || /\s/.test(s)) return null;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) return null;
  return u.href;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate and normalise an untrusted config object (e.g. a PUT body).
 * Unknown fields are dropped. Server-owned metadata (version, updatedAt, ...)
 * is never taken from input.
 *
 * Each error has a stable `code` (plus `params` when the text needs values) so
 * the admin portal can show it in the admin's language; `message` is a Bangla
 * fallback for other API clients.
 * @returns {{ok: true, value: object} | {ok: false, errors: {path: string, code: string, message: string, params?: object}[]}}
 */
export function validateConfig(input) {
  const errors = [];
  const err = (path, code, message, params) => errors.push(makeError(path, code, message, params));

  if (!isPlainObject(input)) {
    return { ok: false, errors: [makeError('', 'config.type', 'কনফিগ একটি অবজেক্ট হতে হবে')] };
  }

  // --- slots ---
  const slots = {};
  const rawSlots = isPlainObject(input.slots) ? input.slots : {};
  if (!isPlainObject(input.slots)) err('slots', 'slots.type', 'slots অবজেক্ট প্রয়োজন');
  for (const name of SLOT_NAMES) {
    const s = isPlainObject(rawSlots[name]) ? rawSlots[name] : {};
    const p = `slots.${name}`;
    if (!isPlainObject(rawSlots[name])) err(p, 'slot.missing', 'স্লটের সেটিংস নেই');
    const enabled = s.enabled === true;
    if (typeof s.enabled !== 'boolean') err(`${p}.enabled`, 'slot.enabled', 'enabled true/false হতে হবে');
    const mode = MODES.includes(s.mode) ? s.mode : 'off';
    if (!MODES.includes(s.mode)) err(`${p}.mode`, 'slot.mode', `mode অবশ্যই ${MODES.join(' | ')}`, { allowed: MODES.join(' | ') });
    const a = isPlainObject(s.adsense) ? s.adsense : {};
    const client = cleanText(a.client);
    const slot = cleanText(a.slot);
    if (client && !ADSENSE_CLIENT_RE.test(client)) err(`${p}.adsense.client`, 'adsense.client', 'AdSense client হবে ca-pub-XXXXXXXXXXXXXXXX আকারে');
    if (slot && !ADSENSE_SLOT_RE.test(slot)) err(`${p}.adsense.slot`, 'adsense.slot', 'AdSense slot শুধু সংখ্যা (৬–২০ অঙ্ক)');
    if (enabled && mode === 'adsense' && (!client || !slot)) {
      err(`${p}.adsense`, 'adsense.required', 'AdSense মোডে client ও slot দুটোই দিতে হবে');
    }
    slots[name] = { enabled, mode, adsense: { client, slot } };
  }

  // --- campaigns ---
  const campaigns = [];
  if (!Array.isArray(input.campaigns)) {
    err('campaigns', 'campaigns.type', 'campaigns একটি অ্যারে হতে হবে');
  } else if (input.campaigns.length > MAX_CAMPAIGNS) {
    err('campaigns', 'campaigns.tooMany', `সর্বোচ্চ ${MAX_CAMPAIGNS}টি ক্যাম্পেইন রাখা যাবে`, { max: MAX_CAMPAIGNS });
  } else {
    const seen = new Set();
    input.campaigns.forEach((c, i) => {
      const r = validateCampaign(c, `campaigns[${i}]`);
      errors.push(...r.errors);
      if (r.value) {
        if (seen.has(r.value.id)) err(`campaigns[${i}].id`, 'id.duplicate', `আইডি "${r.value.id}" একাধিকবার আছে`, { id: r.value.id });
        seen.add(r.value.id);
        campaigns.push(r.value);
      }
    });
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { schemaVersion: SCHEMA_VERSION, slots, campaigns } };
}

/** Validate a single campaign. Returns the normalised value (possibly with errors). */
export function validateCampaign(c, path = 'campaign') {
  const errors = [];
  const err = (field, code, message, params) => errors.push(makeError(`${path}.${field}`, code, message, params));
  if (!isPlainObject(c)) {
    return { value: null, errors: [makeError(path, 'campaign.type', 'ক্যাম্পেইন একটি অবজেক্ট হতে হবে')] };
  }

  const text = (field, { required = false, max }) => {
    const v = cleanText(c[field]);
    if (c[field] != null && typeof c[field] !== 'string') err(field, 'text.type', 'টেক্সট হতে হবে');
    else if (required && !v) err(field, 'text.required', 'এই ঘরটি পূরণ করা আবশ্যক');
    else if ([...v].length > max) err(field, 'text.tooLong', `সর্বোচ্চ ${max} অক্ষর`, { max });
    else if (CONTROL_RE.test(v) || (field !== 'body' && /[\r\n\t]/.test(v))) err(field, 'text.chars', 'অননুমোদিত অক্ষর আছে');
    return v;
  };

  const id = cleanText(c.id);
  if (!ID_RE.test(id)) err('id', 'id.format', 'আইডি: ছোট হাতের a-z, 0-9 ও - (সর্বোচ্চ ৬৪)');

  const type = CAMPAIGN_TYPES.includes(c.type) ? c.type : 'text';
  if (!CAMPAIGN_TYPES.includes(c.type)) err('type', 'type.invalid', 'type হবে image বা text');

  const slot = SLOT_NAMES.includes(c.slot) ? c.slot : 'top';
  if (!SLOT_NAMES.includes(c.slot)) err('slot', 'slot.invalid', `slot হবে ${SLOT_NAMES.join(' বা ')}`, { allowed: SLOT_NAMES.join(' | ') });

  // Optional for backward compatibility: configs saved before language targeting have no `lang`.
  const lang = c.lang == null ? 'any' : c.lang;
  if (!CAMPAIGN_LANGS.includes(lang)) err('lang', 'lang.invalid', `lang হবে ${CAMPAIGN_LANGS.join(' | ')}`, { allowed: CAMPAIGN_LANGS.join(' | ') });

  const name = text('name', { required: true, max: LIMITS.name });
  const advertiser = text('advertiser', { required: true, max: LIMITS.advertiser });
  // headline doubles as the image alt text, so it is required for both types.
  const headline = text('headline', { required: true, max: LIMITS.headline });
  const body = text('body', { max: LIMITS.body });
  const ctaText = text('ctaText', { required: true, max: LIMITS.ctaText });

  const ctaUrl = normalizeHttpsUrl(c.ctaUrl);
  if (!ctaUrl) err('ctaUrl', 'url.https', 'বৈধ https:// লিংক দিন');

  let imageUrl = '';
  if (type === 'image' || cleanText(c.imageUrl)) {
    imageUrl = normalizeHttpsUrl(c.imageUrl) || '';
    if (!imageUrl) err('imageUrl', 'url.https', 'ছবির জন্য বৈধ https:// লিংক দিন');
  }

  let bgColor = cleanText(c.bgColor);
  if (bgColor && !COLOR_RE.test(bgColor)) err('bgColor', 'color.format', 'রং হবে #RRGGBB আকারে');
  bgColor = bgColor.toLowerCase();

  const startDate = cleanText(c.startDate);
  const endDate = cleanText(c.endDate);
  if (!isValidDate(startDate)) err('startDate', 'date.invalid', 'শুরুর তারিখ সঠিক নয় (YYYY-MM-DD)');
  if (!isValidDate(endDate)) err('endDate', 'date.invalid', 'শেষের তারিখ সঠিক নয় (YYYY-MM-DD)');
  if (isValidDate(startDate) && isValidDate(endDate) && endDate < startDate) {
    err('endDate', 'date.order', 'শেষের তারিখ শুরুর আগে হতে পারে না');
  }

  const weight = c.weight;
  if (!Number.isInteger(weight) || weight < 1 || weight > 100) err('weight', 'weight.range', 'ওজন ১ থেকে ১০০-এর মধ্যে পূর্ণসংখ্যা');

  if (typeof c.active !== 'boolean') err('active', 'active.type', 'active true/false হতে হবে');

  return {
    errors,
    value: {
      id, name, advertiser, slot, lang: CAMPAIGN_LANGS.includes(lang) ? lang : 'any', type, imageUrl, headline, body, ctaText,
      ctaUrl: ctaUrl || '', bgColor, startDate, endDate,
      weight: Number.isInteger(weight) ? weight : 1,
      active: c.active === true,
    },
  };
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export function isHouse(c) {
  return String(c.advertiser).trim().toLowerCase() === HOUSE_ADVERTISER;
}

/** A campaign's target language; campaigns stored before targeting existed have none and mean "any". */
export function campaignLang(c) {
  return c?.lang == null ? 'any' : c.lang;
}

/** True if campaign `c` may be shown to a visitor whose site language is `lang`. */
export function matchesLang(c, lang) {
  const l = campaignLang(c);
  return l === 'any' || l === lang;
}

/**
 * Active, in-date (inclusive, Bangladesh time) campaigns for a slot.
 * With `lang`, only campaigns targeting that language (or "any"); without it, every language.
 */
export function eligibleCampaigns(config, slotName, today, lang) {
  const list = Array.isArray(config?.campaigns) ? config.campaigns : [];
  return list.filter((c) =>
    c && c.active === true && c.slot === slotName &&
    typeof c.startDate === 'string' && typeof c.endDate === 'string' &&
    c.startDate <= today && today <= c.endDate &&
    (lang === undefined || matchesLang(c, lang)));
}

/**
 * Decide what a slot shows today (for visitors in `lang`, or all languages if omitted).
 *  - off / disabled                 -> {mode: 'off'}
 *  - adsense with both IDs           -> {mode: 'adsense', adsense}
 *  - adsense missing IDs             -> treated like 'house'
 *  - direct                          -> paid in-date campaigns, else house, else off
 *  - house                           -> house campaigns, else off
 * Returned campaigns are the pool the client picks from with pickWeighted().
 */
export function resolveSlot(config, slotName, today, lang) {
  const s = config?.slots?.[slotName];
  if (!s || s.enabled !== true || s.mode === 'off' || !MODES.includes(s.mode)) return { mode: 'off' };

  if (s.mode === 'adsense') {
    const client = s.adsense?.client || '';
    const slot = s.adsense?.slot || '';
    if (ADSENSE_CLIENT_RE.test(client) && ADSENSE_SLOT_RE.test(slot)) {
      return { mode: 'adsense', adsense: { client, slot } };
    }
  }

  const eligible = eligibleCampaigns(config, slotName, today, lang);
  if (s.mode === 'direct') {
    const paid = eligible.filter((c) => !isHouse(c));
    if (paid.length) return { mode: 'direct', campaigns: paid };
  }
  const house = eligible.filter(isHouse);
  if (house.length) return { mode: 'house', campaigns: house };
  return { mode: 'off' };
}

/** Weighted random pick. `rand` returns [0, 1). Returns null for an empty list. */
export function pickWeighted(list, rand = Math.random) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const weights = list.map((c) => (Number.isFinite(c?.weight) && c.weight > 0 ? c.weight : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < list.length; i++) {
    r -= weights[i];
    if (r < 0) return list[i];
  }
  return list[list.length - 1];
}

/**
 * Client-side step (mirrored in ads.js): narrow a public slot pool to one language.
 * Keeps campaigns for `lang` or "any"; if any of those are paid, house ads are dropped.
 * Applied to toPublicConfig() output this yields exactly resolveSlot(config, slot, today, lang).
 */
export function poolForLang(campaigns, lang) {
  const matching = (Array.isArray(campaigns) ? campaigns : []).filter((c) => c && matchesLang(c, lang));
  const paid = matching.filter((c) => !c.house);
  return paid.length ? paid : matching;
}

const PUBLIC_CAMPAIGN_FIELDS = ['id', 'type', 'imageUrl', 'headline', 'body', 'ctaText', 'ctaUrl', 'bgColor', 'weight'];

/**
 * Shape served by GET /api/ads: resolved per slot, public fields only, no schedules or advertiser names.
 * One response serves every language (so it stays cacheable): a campaign slot's pool is the union
 * of the per-language pools, each campaign tagged with `lang`, and ads.js narrows it with
 * poolForLang(). `mode` is "direct" if any language resolved to paid campaigns.
 */
export function toPublicConfig(config, today) {
  const slots = {};
  for (const name of SLOT_NAMES) {
    const byLang = SITE_LANGS.map((lang) => resolveSlot(config, name, today, lang));
    const pools = byLang.filter((r) => r.campaigns);
    if (!pools.length) {
      // off / adsense do not depend on the language.
      slots[name] = byLang[0];
      continue;
    }
    // Union in config order (same order resolveSlot() returns for each language).
    const inPool = new Set(pools.flatMap((r) => r.campaigns));
    const union = config.campaigns.filter((c) => inPool.has(c));
    slots[name] = {
      mode: pools.some((r) => r.mode === 'direct') ? 'direct' : 'house',
      campaigns: union.map((c) => {
        const o = {};
        for (const k of PUBLIC_CAMPAIGN_FIELDS) o[k] = c[k];
        o.lang = campaignLang(c);
        o.house = isHouse(c);
        return o;
      }),
    };
  }
  return { version: Number(config?.version) || 0, date: today, slots };
}

// ---------------------------------------------------------------------------
// Tracking & stats
// ---------------------------------------------------------------------------

export function isValidCampaignId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

/** Validate an untrusted tracking payload. */
export function parseTrackEvent(body) {
  if (!isPlainObject(body)) return null;
  const { campaignId, event } = body;
  if (!isValidCampaignId(campaignId) || !TRACK_EVENTS.includes(event)) return null;
  return { campaignId, event };
}

export function statsKey(date, campaignId) {
  return `stats:${date}:${campaignId}`;
}

/** Parse "stats:YYYY-MM-DD:id" -> {date, campaignId} or null. */
export function parseStatsKey(key) {
  const m = /^stats:(\d{4}-\d{2}-\d{2}):([a-z0-9][a-z0-9-]{0,63})$/.exec(key);
  return m ? { date: m[1], campaignId: m[2] } : null;
}

// Naive bot filter: known crawler / tool / headless signatures, or no UA at all.
const BOT_UA_RE = /bot|crawl|spider|slurp|scrap|fetch|preview|monitor|lighthouse|headless|phantom|puppeteer|playwright|selenium|curl|wget|python|httpclient|okhttp|java\/|go-http|axios|node-fetch|postman|insomnia|facebookexternalhit|embedly|whatsapp|telegram/i;

export function isLikelyBot(userAgent) {
  if (typeof userAgent !== 'string' || userAgent.length < 20) return true;
  return BOT_UA_RE.test(userAgent);
}

/**
 * Aggregate raw counter rows [{campaignId, impressions, clicks}] into per-campaign
 * totals with CTR (percentage, 2 decimals), joined with config metadata.
 */
export function aggregateStats(rows, campaigns = []) {
  const byId = new Map();
  for (const r of rows) {
    const cur = byId.get(r.campaignId) || { campaignId: r.campaignId, impressions: 0, clicks: 0 };
    cur.impressions += Number(r.impressions) || 0;
    cur.clicks += Number(r.clicks) || 0;
    byId.set(r.campaignId, cur);
  }
  const meta = new Map(campaigns.map((c) => [c.id, c]));
  const out = [...byId.values()].map((r) => {
    const c = meta.get(r.campaignId);
    const impressions = Math.round(r.impressions);
    const clicks = Math.round(r.clicks);
    return {
      campaignId: r.campaignId,
      name: c ? c.name : null,
      advertiser: c ? c.advertiser : null,
      slot: c ? c.slot : null,
      impressions,
      clicks,
      ctr: ctr(clicks, impressions),
    };
  });
  out.sort((a, b) => b.impressions - a.impressions || a.campaignId.localeCompare(b.campaignId));
  const totals = out.reduce((t, r) => ({ impressions: t.impressions + r.impressions, clicks: t.clicks + r.clicks }), { impressions: 0, clicks: 0 });
  totals.ctr = ctr(totals.clicks, totals.impressions);
  return { rows: out, totals };
}

/** Parse IMPRESSION_SAMPLE_RATE: a number in (0, 1], anything else means 1 (record everything). */
export function sampleRate(value) {
  const r = Number(value);
  return Number.isFinite(r) && r > 0 && r <= 1 ? r : 1;
}

export function ctr(clicks, impressions) {
  return impressions > 0 ? Math.round((clicks / impressions) * 10_000) / 100 : 0;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const PREMIUM_URL = 'https://jsonbondhu.irmaoshop.com/#premium';

/** A default house campaign promoting the ad-free version. */
function houseAd({ id, name, slot, lang, headline, body, ctaText }) {
  return {
    id, name, advertiser: HOUSE_ADVERTISER, slot, lang, type: 'text', imageUrl: '',
    headline, body, ctaText, ctaUrl: PREMIUM_URL, bgColor: '',
    startDate: '2024-01-01', endDate: '2099-12-31', weight: 1, active: true,
  };
}

/**
 * Config served when KV is empty. Only house ads (one per slot and language), both slots
 * in "direct" so paid ads slot in once added. The Bangla ids predate language targeting
 * and are kept so their stats continue.
 */
export function defaultConfig() {
  return {
    schemaVersion: SCHEMA_VERSION,
    version: 0,
    updatedAt: null,
    updatedBy: null,
    slots: {
      top: { enabled: true, mode: 'direct', adsense: { client: '', slot: '' } },
      bottom: { enabled: true, mode: 'direct', adsense: { client: '', slot: '' } },
    },
    campaigns: [
      houseAd({
        id: 'house-premium-top-en',
        name: 'Ad-free version (top, English)',
        slot: 'top',
        lang: 'en',
        headline: 'Use JSON Bondhu without ads',
        body: 'One-time payment for lifetime ad-free use — bKash, Nagad or card. New features first.',
        ctaText: 'Learn more',
      }),
      houseAd({
        id: 'house-premium-top',
        name: 'বিজ্ঞাপনমুক্ত সংস্করণ (উপরে, বাংলা)',
        slot: 'top',
        lang: 'bn',
        headline: 'বিজ্ঞাপন ছাড়া JSON বন্ধু ব্যবহার করুন',
        body: 'একবার পেমেন্টে আজীবন বিজ্ঞাপনমুক্ত — বিকাশ, নগদ বা কার্ডে। নতুন ফিচার সবার আগে।',
        ctaText: 'বিস্তারিত দেখুন',
      }),
      houseAd({
        id: 'house-premium-bottom-en',
        name: 'Ad-free version (bottom, English)',
        slot: 'bottom',
        lang: 'en',
        headline: 'Enjoying JSON Bondhu? Support us',
        body: 'Buy the ad-free version to help keep this tool free.',
        ctaText: 'Go ad-free',
      }),
      houseAd({
        id: 'house-premium-bottom',
        name: 'বিজ্ঞাপনমুক্ত সংস্করণ (নিচে, বাংলা)',
        slot: 'bottom',
        lang: 'bn',
        headline: 'JSON বন্ধু ভালো লাগছে? পাশে থাকুন',
        body: 'বিজ্ঞাপনমুক্ত সংস্করণ কিনে এই বাংলা টুলটি বিনামূল্যে চালু রাখতে সাহায্য করুন।',
        ctaText: 'বিজ্ঞাপনমুক্ত করুন',
      }),
    ],
  };
}

function makeError(path, code, message, params) {
  return params ? { path, code, message, params } : { path, code, message };
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
