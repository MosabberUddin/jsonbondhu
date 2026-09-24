// GET /api/admin/stats?from=YYYY-MM-DD&to=YYYY-MM-DD  (auth enforced by ./_middleware.js)
// Defaults to the last 7 days (Bangladesh time). Range is inclusive, max 92 days.
// Reads counters via KV list() metadata, one list per calendar month in range.
import {
  addDays, aggregateStats, daySpan, isValidDate, MAX_STATS_RANGE_DAYS, monthPrefixes, parseStatsKey, sampleRate,
  todayLocal,
} from '../../_lib/ads-core.js';
import { error, json, methodNotAllowed } from '../../_lib/http.js';
import { loadConfig } from '../../_lib/store.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  if (!env.ADS_KV) return error(500, 'ADS_KV binding is not configured');

  const url = new URL(request.url);
  const today = todayLocal();
  const to = url.searchParams.get('to') || today;
  const from = url.searchParams.get('from') || addDays(to, -6);
  if (!isValidDate(from) || !isValidDate(to)) return error(400, 'from/to must be YYYY-MM-DD');
  if (from > to) return error(400, 'from must not be after to');
  if (daySpan(from, to) > MAX_STATS_RANGE_DAYS) return error(400, `Range may not exceed ${MAX_STATS_RANGE_DAYS} days`);

  const rows = [];
  for (const month of monthPrefixes(from, to)) {
    let cursor;
    do {
      const page = await env.ADS_KV.list({ prefix: `stats:${month}-`, cursor });
      for (const k of page.keys) {
        const parsed = parseStatsKey(k.name);
        if (!parsed || parsed.date < from || parsed.date > to) continue;
        const m = k.metadata || {};
        rows.push({ campaignId: parsed.campaignId, impressions: m.i, clicks: m.c });
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  }

  const config = await loadConfig(env);
  const { rows: out, totals } = aggregateStats(rows, config.campaigns || []);
  return json({
    from,
    to,
    timezone: 'Asia/Dhaka',
    impressionSampleRate: sampleRate(env.IMPRESSION_SAMPLE_RATE),
    rows: out,
    totals,
  });
}
