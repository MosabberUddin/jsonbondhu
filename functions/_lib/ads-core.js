// Pure, dependency-free ad logic shared by Pages Functions and tests.
// No I/O here: everything takes plain data in and returns plain data out.

export const SCHEMA_VERSION = 1;
export const SLOT_NAMES = Object.freeze(['top', 'bottom']);
export const MODES = Object.freeze(['adsense', 'direct', 'house', 'off']);
export const CAMPAIGN_TYPES = Object.freeze(['image', 'text']);
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
 * @returns {{ok: true, value: object} | {ok: false, errors: {path: string, message: string}[]}}
 */
export function validateConfig(input) {
  const errors = [];
  const err = (path, message) => errors.push({ path, message });

  if (!isPlainObject(input)) {
    return { ok: false, errors: [{ path: '', message: 'কনফিগ একটি অবজেক্ট হতে হবে' }] };
  }

  // --- slots ---
  const slots = {};
  const rawSlots = isPlainObject(input.slots) ? input.slots : {};
  if (!isPlainObject(input.slots)) err('slots', 'slots অবজেক্ট প্রয়োজন');
  for (const name of SLOT_NAMES) {
    const s = isPlainObject(rawSlots[name]) ? rawSlots[name] : {};
    const p = `slots.${name}`;
    if (!isPlainObject(rawSlots[name])) err(p, 'স্লটের সেটিংস নেই');
    const enabled = s.enabled === true;
    if (typeof s.enabled !== 'boolean') err(`${p}.enabled`, 'enabled true/false হতে হবে');
    const mode = MODES.includes(s.mode) ? s.mode : 'off';
    if (!MODES.includes(s.mode)) err(`${p}.mode`, `mode অবশ্যই ${MODES.join(' | ')}`);
    const a = isPlainObject(s.adsense) ? s.adsense : {};
    const client = cleanText(a.client);
    const slot = cleanText(a.slot);
    if (client && !ADSENSE_CLIENT_RE.test(client)) err(`${p}.adsense.client`, 'AdSense client হবে ca-pub-XXXXXXXXXXXXXXXX আকারে');
    if (slot && !ADSENSE_SLOT_RE.test(slot)) err(`${p}.adsense.slot`, 'AdSense slot শুধু সংখ্যা (৬–২০ অঙ্ক)');
    if (enabled && mode === 'adsense' && (!client || !slot)) {
      err(`${p}.adsense`, 'AdSense মোডে client ও slot দুটোই দিতে হবে');
    }
    slots[name] = { enabled, mode, adsense: { client, slot } };
  }

  // --- campaigns ---
  const campaigns = [];
  if (!Array.isArray(input.campaigns)) {
    err('campaigns', 'campaigns একটি অ্যারে হতে হবে');
  } else if (input.campaigns.length > MAX_CAMPAIGNS) {
    err('campaigns', `সর্বোচ্চ ${MAX_CAMPAIGNS}টি ক্যাম্পেইন রাখা যাবে`);
  } else {
    const seen = new Set();
    input.campaigns.forEach((c, i) => {
      const r = validateCampaign(c, `campaigns[${i}]`);
      errors.push(...r.errors);
      if (r.value) {
        if (seen.has(r.value.id)) err(`campaigns[${i}].id`, `আইডি "${r.value.id}" একাধিকবার আছে`);
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
  const err = (field, message) => errors.push({ path: `${path}.${field}`, message });
  if (!isPlainObject(c)) {
    return { value: null, errors: [{ path, message: 'ক্যাম্পেইন একটি অবজেক্ট হতে হবে' }] };
  }

  const text = (field, { required = false, max }) => {
    const v = cleanText(c[field]);
    if (c[field] != null && typeof c[field] !== 'string') err(field, 'টেক্সট হতে হবে');
    else if (required && !v) err(field, 'এই ঘরটি পূরণ করা আবশ্যক');
    else if ([...v].length > max) err(field, `সর্বোচ্চ ${max} অক্ষর`);
    else if (CONTROL_RE.test(v) || (field !== 'body' && /[\r\n\t]/.test(v))) err(field, 'অননুমোদিত অক্ষর আছে');
    return v;
  };

  const id = cleanText(c.id);
  if (!ID_RE.test(id)) err('id', 'আইডি: ছোট হাতের a-z, 0-9 ও - (সর্বোচ্চ ৬৪)');

  const type = CAMPAIGN_TYPES.includes(c.type) ? c.type : 'text';
  if (!CAMPAIGN_TYPES.includes(c.type)) err('type', 'type হবে image বা text');

  const slot = SLOT_NAMES.includes(c.slot) ? c.slot : 'top';
  if (!SLOT_NAMES.includes(c.slot)) err('slot', `slot হবে ${SLOT_NAMES.join(' বা ')}`);

  const name = text('name', { required: true, max: LIMITS.name });
  const advertiser = text('advertiser', { required: true, max: LIMITS.advertiser });
  // headline doubles as the image alt text, so it is required for both types.
  const headline = text('headline', { required: true, max: LIMITS.headline });
  const body = text('body', { max: LIMITS.body });
  const ctaText = text('ctaText', { required: true, max: LIMITS.ctaText });

  const ctaUrl = normalizeHttpsUrl(c.ctaUrl);
  if (!ctaUrl) err('ctaUrl', 'বৈধ https:// লিংক দিন');

  let imageUrl = '';
  if (type === 'image' || cleanText(c.imageUrl)) {
    imageUrl = normalizeHttpsUrl(c.imageUrl) || '';
    if (!imageUrl) err('imageUrl', 'ছবির জন্য বৈধ https:// লিংক দিন');
  }

  let bgColor = cleanText(c.bgColor);
  if (bgColor && !COLOR_RE.test(bgColor)) err('bgColor', 'রং হবে #RRGGBB আকারে');
  bgColor = bgColor.toLowerCase();

  const startDate = cleanText(c.startDate);
  const endDate = cleanText(c.endDate);
  if (!isValidDate(startDate)) err('startDate', 'শুরুর তারিখ সঠিক নয় (YYYY-MM-DD)');
  if (!isValidDate(endDate)) err('endDate', 'শেষের তারিখ সঠিক নয় (YYYY-MM-DD)');
  if (isValidDate(startDate) && isValidDate(endDate) && endDate < startDate) {
    err('endDate', 'শেষের তারিখ শুরুর আগে হতে পারে না');
  }

  const weight = c.weight;
  if (!Number.isInteger(weight) || weight < 1 || weight > 100) err('weight', 'ওজন ১ থেকে ১০০-এর মধ্যে পূর্ণসংখ্যা');

  if (typeof c.active !== 'boolean') err('active', 'active true/false হতে হবে');

  return {
    errors,
    value: {
      id, name, advertiser, slot, type, imageUrl, headline, body, ctaText,
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

/** Active, in-date (inclusive, Bangladesh time) campaigns for a slot. */
export function eligibleCampaigns(config, slotName, today) {
  const list = Array.isArray(config?.campaigns) ? config.campaigns : [];
  return list.filter((c) =>
    c && c.active === true && c.slot === slotName &&
    typeof c.startDate === 'string' && typeof c.endDate === 'string' &&
    c.startDate <= today && today <= c.endDate);
}

/**
 * Decide what a slot shows today.
 *  - off / disabled                 -> {mode: 'off'}
 *  - adsense with both IDs           -> {mode: 'adsense', adsense}
 *  - adsense missing IDs             -> treated like 'house'
 *  - direct                          -> paid in-date campaigns, else house, else off
 *  - house                           -> house campaigns, else off
 * Returned campaigns are the pool the client picks from with pickWeighted().
 */
export function resolveSlot(config, slotName, today) {
  const s = config?.slots?.[slotName];
  if (!s || s.enabled !== true || s.mode === 'off' || !MODES.includes(s.mode)) return { mode: 'off' };

  if (s.mode === 'adsense') {
    const client = s.adsense?.client || '';
    const slot = s.adsense?.slot || '';
    if (ADSENSE_CLIENT_RE.test(client) && ADSENSE_SLOT_RE.test(slot)) {
      return { mode: 'adsense', adsense: { client, slot } };
    }
  }

  const eligible = eligibleCampaigns(config, slotName, today);
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

const PUBLIC_CAMPAIGN_FIELDS = ['id', 'type', 'imageUrl', 'headline', 'body', 'ctaText', 'ctaUrl', 'bgColor', 'weight'];

/** Shape served by GET /api/ads: resolved per slot, public fields only, no schedules or advertiser names. */
export function toPublicConfig(config, today) {
  const slots = {};
  for (const name of SLOT_NAMES) {
    const r = resolveSlot(config, name, today);
    if (r.campaigns) {
      slots[name] = {
        mode: r.mode,
        campaigns: r.campaigns.map((c) => {
          const o = {};
          for (const k of PUBLIC_CAMPAIGN_FIELDS) o[k] = c[k];
          o.house = isHouse(c);
          return o;
        }),
      };
    } else {
      slots[name] = r;
    }
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

/** Config served when KV is empty. Only house ads, both slots in "direct" so paid ads slot in once added. */
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
      {
        id: 'house-premium-top',
        name: 'বিজ্ঞাপনমুক্ত সংস্করণ (উপরে)',
        advertiser: HOUSE_ADVERTISER,
        slot: 'top',
        type: 'text',
        imageUrl: '',
        headline: 'বিজ্ঞাপন ছাড়া JSON বন্ধু ব্যবহার করুন',
        body: 'একবার পেমেন্টে আজীবন বিজ্ঞাপনমুক্ত — বিকাশ, নগদ বা কার্ডে। নতুন ফিচার সবার আগে।',
        ctaText: 'বিস্তারিত দেখুন',
        ctaUrl: 'https://jsonbondhu.com/#premium',
        bgColor: '',
        startDate: '2024-01-01',
        endDate: '2099-12-31',
        weight: 1,
        active: true,
      },
      {
        id: 'house-premium-bottom',
        name: 'বিজ্ঞাপনমুক্ত সংস্করণ (নিচে)',
        advertiser: HOUSE_ADVERTISER,
        slot: 'bottom',
        type: 'text',
        imageUrl: '',
        headline: 'JSON বন্ধু ভালো লাগছে? পাশে থাকুন',
        body: 'বিজ্ঞাপনমুক্ত সংস্করণ কিনে এই বাংলা টুলটি বিনামূল্যে চালু রাখতে সাহায্য করুন।',
        ctaText: 'বিজ্ঞাপনমুক্ত করুন',
        ctaUrl: 'https://jsonbondhu.com/#premium',
        bgColor: '',
        startDate: '2024-01-01',
        endDate: '2099-12-31',
        weight: 1,
        active: true,
      },
    ],
  };
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
