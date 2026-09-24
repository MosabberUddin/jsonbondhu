// /api/admin/config  (auth enforced by ./_middleware.js)
//   GET                 -> { me, config, history: [{version, updatedAt, updatedBy, campaigns}] }
//   GET ?version=N      -> { config } for a version still in history (for rollback)
//   PUT { baseVersion, config } -> validates, saves as version+1, returns { config }
//       409 if baseVersion is stale, 422 with { errors } if invalid.
// Rollback = load an old version with GET ?version=N, then PUT it as a new version.
import { validateConfig } from '../../_lib/ads-core.js';
import { error, json, methodNotAllowed, readJson } from '../../_lib/http.js';
import { loadConfig, loadHistory, saveConfig } from '../../_lib/store.js';

const MAX_BODY_BYTES = 256 * 1024;

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.ADS_KV) return error(500, 'ADS_KV binding is not configured');
  switch (request.method) {
    case 'GET': return handleGet(context);
    case 'PUT': return handlePut(context);
    default: return methodNotAllowed(['GET', 'PUT']);
  }
}

async function handleGet({ request, env, data }) {
  const url = new URL(request.url);
  const history = await loadHistory(env);

  if (url.searchParams.has('version')) {
    const v = Number(url.searchParams.get('version'));
    const found = Number.isInteger(v) ? history.find((h) => h.version === v) : null;
    return found ? json({ config: found }) : error(404, 'Version not found in history');
  }

  const config = await loadConfig(env);
  return json({
    me: data.admin.email,
    config,
    history: history.map((h) => ({
      version: h.version,
      updatedAt: h.updatedAt,
      updatedBy: h.updatedBy,
      campaigns: Array.isArray(h.campaigns) ? h.campaigns.length : 0,
    })),
  });
}

async function handlePut({ request, env, data }) {
  const ct = request.headers.get('Content-Type') || '';
  if (!ct.toLowerCase().startsWith('application/json')) return error(415, 'Content-Type must be application/json');

  const body = await readJson(request, MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  const { baseVersion, config } = body.value || {};
  if (!Number.isInteger(baseVersion) || baseVersion < 0) return error(400, 'baseVersion (integer) is required');

  const result = validateConfig(config);
  if (!result.ok) return json({ error: 'Validation failed', errors: result.errors }, { status: 422 });

  let saved;
  try {
    saved = await saveConfig(env, result.value, { baseVersion, email: data.admin.email });
  } catch (e) {
    // Most likely the account's daily KV write quota (shared with tracking) is exhausted.
    console.error('ad config save failed', e);
    return error(503, 'Could not write to KV (daily write limit reached?). Try again later.');
  }
  if (!saved.ok) {
    return error(409, 'Config was changed by someone else. Reload and try again.', { currentVersion: saved.currentVersion });
  }
  console.log(JSON.stringify({ msg: 'ad config saved', version: saved.config.version, by: data.admin.email }));
  return json({ config: saved.config });
}
