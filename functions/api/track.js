// POST /api/track  body: {"campaignId": "...", "event": "impression" | "click"}
// Sent by ads.js via navigator.sendBeacon (text/plain body). Always answers fast;
// the KV write happens in waitUntil().
//
// Counters live at stats:YYYY-MM-DD:<campaignId> (Bangladesh date) as JSON
// {i, c} mirrored into KV metadata so the stats endpoint can read a whole month
// with a single list() call instead of one get() per key.
//
// KNOWN LIMITS (see docs/ADS.md): KV is eventually consistent and this is a
// read-modify-write, so concurrent increments on the same key can be lost; KV
// also allows ~1 write/sec per key and the free plan allows 1,000 writes/day.
// IMPRESSION_SAMPLE_RATE (0 < r <= 1) records only a fraction of impressions,
// each weighted 1/r, to stay within that budget.
import {
  isLikelyBot, parseTrackEvent, sampleRate, statsKey, todayLocal,
} from '../_lib/ads-core.js';
import { error, isSameOrigin, methodNotAllowed, noContent, readBodyText } from '../_lib/http.js';
import { loadConfig } from '../_lib/store.js';

const MAX_BODY_BYTES = 512;
const DEDUPE_SECONDS = 15;
const STATS_TTL_SECONDS = 400 * 24 * 60 * 60; // keep ~13 months of daily counters

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  // Silently drop anything we do not want to count; the beacon ignores responses anyway.
  if (!isSameOrigin(request)) return error(403, 'Cross-origin request rejected');
  if (isLikelyBot(request.headers.get('User-Agent'))) return noContent();

  const text = await readBodyText(request, MAX_BODY_BYTES);
  if (text === null) return error(413, 'Too large');
  let evt;
  try { evt = parseTrackEvent(JSON.parse(text)); } catch { evt = null; }
  if (!evt) return error(400, 'Invalid event');

  if (!env.ADS_KV) return noContent();

  // Only count campaigns that exist in the live config (or the built-in default).
  const config = await loadConfig(env, { cacheTtl: 60 });
  if (!config.campaigns?.some((c) => c.id === evt.campaignId)) return noContent();

  let weight = 1;
  if (evt.event === 'impression') {
    const rate = sampleRate(env.IMPRESSION_SAMPLE_RATE);
    if (rate < 1) {
      if (Math.random() >= rate) return noContent();
      weight = 1 / rate;
    }
  }

  if (await isDuplicate(request, evt)) return noContent();

  context.waitUntil(increment(env, evt, weight).catch((e) => console.error('track increment failed', e)));
  return noContent();
}

/**
 * Naive per-client rate limit using the colo-local Cache API (no KV writes).
 * Key = hash(IP + UA + campaign + event); one event per DEDUPE_SECONDS.
 * Best effort only: the cache is per data centre and may be a no-op on
 * *.pages.dev preview hosts. IP/UA are hashed and never stored.
 */
async function isDuplicate(request, evt) {
  try {
    const cache = globalThis.caches?.default;
    if (!cache) return false;
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ua = request.headers.get('User-Agent') || '';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}|${ua}|${evt.campaignId}|${evt.event}`));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const key = new Request(`https://track-dedupe.invalid/${hex}`);
    if (await cache.match(key)) return true;
    await cache.put(key, new Response('1', { headers: { 'Cache-Control': `max-age=${DEDUPE_SECONDS}` } }));
    return false;
  } catch {
    return false;
  }
}

export async function increment(env, evt, weight) {
  const key = statsKey(todayLocal(), evt.campaignId);
  const bump = (value) => {
    const cur = { i: Number(value?.i) || 0, c: Number(value?.c) || 0 };
    if (evt.event === 'impression') cur.i += weight; else cur.c += weight;
    return cur;
  };
  // The self-hosted MySQL store can update atomically; Workers KV cannot.
  if (typeof env.ADS_KV.atomicUpdate === 'function') {
    await env.ADS_KV.atomicUpdate(key, bump, { expirationTtl: STATS_TTL_SECONDS, withMetadata: true });
    return;
  }
  const { value } = await env.ADS_KV.getWithMetadata(key, { type: 'json' });
  const cur = bump(value);
  await env.ADS_KV.put(key, JSON.stringify(cur), { metadata: cur, expirationTtl: STATS_TTL_SECONDS });
}
