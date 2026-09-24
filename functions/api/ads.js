// GET /api/ads — public, cacheable ad decision data for the site.
// Returns per-slot resolved pools (no schedules, advertiser names or history).
import { toPublicConfig, todayLocal } from '../_lib/ads-core.js';
import { json, methodNotAllowed } from '../_lib/http.js';
import { loadConfig } from '../_lib/store.js';

const MAX_AGE = 60;

export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed(['GET', 'HEAD']);
  // cacheTtl lets KV serve from the edge cache, so most requests cost no KV read.
  const config = await loadConfig(env, { cacheTtl: MAX_AGE });
  return json(toPublicConfig(config, todayLocal()), {
    cache: `public, max-age=${MAX_AGE}, stale-while-revalidate=${MAX_AGE * 5}`,
  });
}
