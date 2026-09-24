// Workers KV access for ad config. Keys:
//   config:current  -> the live config (JSON, includes version metadata)
//   config:history  -> array of the last HISTORY_LIMIT saved configs, newest first
//   stats:YYYY-MM-DD:<campaignId> -> counters (see functions/api/track.js)

import { defaultConfig, HISTORY_LIMIT } from './ads-core.js';

export const CONFIG_KEY = 'config:current';
export const HISTORY_KEY = 'config:history';

/**
 * Load the live config. Falls back to the built-in default (version 0) when the
 * namespace is empty, unbound, or unreadable, so the public site never breaks.
 * @param {{cacheTtl?: number}} opts cacheTtl lets public reads use KV's edge cache.
 */
export async function loadConfig(env, { cacheTtl } = {}) {
  if (!env.ADS_KV) {
    console.error('ADS_KV binding missing; serving default ad config');
    return defaultConfig();
  }
  try {
    const cfg = await env.ADS_KV.get(CONFIG_KEY, cacheTtl ? { type: 'json', cacheTtl } : { type: 'json' });
    return cfg && typeof cfg === 'object' ? cfg : defaultConfig();
  } catch (e) {
    console.error('Failed to read ad config from KV', e);
    return defaultConfig();
  }
}

export async function loadHistory(env) {
  const h = await env.ADS_KV.get(HISTORY_KEY, { type: 'json' });
  return Array.isArray(h) ? h : [];
}

/**
 * Persist a validated config as a new version and prepend it to history.
 * KV has no transactions: the caller's baseVersion check is best-effort
 * optimistic concurrency (fine for a handful of admins).
 */
export async function saveConfig(env, validated, { baseVersion, email }) {
  const current = await loadConfig(env);
  const currentVersion = Number(current.version) || 0;
  if (baseVersion !== currentVersion) {
    return { ok: false, conflict: true, currentVersion };
  }
  const next = {
    ...validated,
    version: currentVersion + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: email,
  };
  const history = [next, ...(await loadHistory(env)).filter((h) => h && h.version !== next.version)]
    .slice(0, HISTORY_LIMIT);
  // Write the live config first: if the history write fails the site still has the new config.
  await env.ADS_KV.put(CONFIG_KEY, JSON.stringify(next));
  await env.ADS_KV.put(HISTORY_KEY, JSON.stringify(history));
  return { ok: true, config: next };
}
