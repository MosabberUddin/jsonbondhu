// Handler-level tests for the Pages Functions using an in-memory KV fake.
// Deterministic, no network (JWT mode is not exercised: it needs Access certs).
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { onRequest as adsHandler } from '../functions/api/ads.js';
import { onRequest as trackHandler } from '../functions/api/track.js';
import { onRequest as adminMiddleware } from '../functions/api/admin/_middleware.js';
import { onRequest as configHandler } from '../functions/api/admin/config.js';
import { onRequest as statsHandler } from '../functions/api/admin/stats.js';
import { onRequest as portalMiddleware } from '../functions/admin/_middleware.js';
import { defaultConfig, statsKey, todayLocal } from '../functions/_lib/ads-core.js';

// Silence expected error logs from fail-closed paths.
console.error = () => {};
console.log = () => {};

class FakeKV {
  constructor() { this.map = new Map(); this.writes = 0; }
  async get(key, opts) {
    const e = this.map.get(key);
    if (!e) return null;
    return opts?.type === 'json' ? JSON.parse(e.value) : e.value;
  }
  async getWithMetadata(key, opts) {
    const e = this.map.get(key);
    return { value: e ? (opts?.type === 'json' ? JSON.parse(e.value) : e.value) : null, metadata: e?.metadata ?? null };
  }
  async put(key, value, opts = {}) { this.writes++; this.map.set(key, { value, metadata: opts.metadata ?? null }); }
  async list({ prefix = '' } = {}) {
    const keys = [...this.map.keys()].filter((k) => k.startsWith(prefix)).sort()
      .map((name) => ({ name, metadata: this.map.get(name).metadata }));
    return { keys, list_complete: true };
  }
}

const ORIGIN = 'https://jsonbondhu.com';
const ADMIN = 'owner@example.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

let env;
// Most tests exercise the header path; the JWT requirement itself is tested in 'admin auth'.
beforeEach(() => { env = { ADS_KV: new FakeKV(), ADMIN_EMAILS: `${ADMIN}, second@example.com`, ALLOW_UNVERIFIED_ACCESS_HEADER: '1' }; });

function ctx(request, next) {
  const waits = [];
  return {
    request, env, data: {}, waits,
    waitUntil: (p) => waits.push(p),
    next: next || (async () => new Response('downstream', { status: 200 })),
  };
}

function req(path, { method = 'GET', headers = {}, body, host = ORIGIN } = {}) {
  return new Request(host + path, { method, headers, body });
}

/** Run an admin API request through the middleware and the route, like Pages does. */
async function admin(route, path, opts = {}) {
  const headers = { 'Cf-Access-Authenticated-User-Email': ADMIN, Origin: opts.host || ORIGIN, ...opts.headers };
  const c = ctx(req(path, { ...opts, headers }));
  c.next = () => route(c);
  return adminMiddleware(c);
}

function putConfig(config, baseVersion, extra = {}) {
  return admin(configHandler, '/api/admin/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...extra.headers },
    body: JSON.stringify({ baseVersion, config }),
    ...extra,
  });
}

function editable(cfg) { return { slots: cfg.slots, campaigns: cfg.campaigns }; }

// ---------------------------------------------------------------------------

describe('GET /api/ads', () => {
  test('serves English and Bangla house ads when KV is empty, cacheable ~60s', async () => {
    const res = await adsHandler(ctx(req('/api/ads')));
    assert.equal(res.status, 200);
    assert.match(res.headers.get('Cache-Control'), /max-age=60/);
    const body = await res.json();
    for (const slot of ['top', 'bottom']) {
      assert.equal(body.slots[slot].mode, 'house');
      assert.deepEqual(body.slots[slot].campaigns.map((c) => c.lang).sort(), ['bn', 'en']);
    }
  });

  test('serves a legacy stored config (campaigns without lang) as "any"', async () => {
    const legacy = defaultConfig();
    legacy.version = 3;
    legacy.campaigns = legacy.campaigns.filter((c) => c.lang === 'bn');
    for (const c of legacy.campaigns) delete c.lang;
    await env.ADS_KV.put('config:current', JSON.stringify(legacy));
    const body = await (await adsHandler(ctx(req('/api/ads')))).json();
    assert.equal(body.version, 3);
    assert.deepEqual(body.slots.top.campaigns.map((c) => [c.id, c.lang]), [['house-premium-top', 'any']]);
  });

  test('still works if the KV binding is missing', async () => {
    delete env.ADS_KV;
    const res = await adsHandler(ctx(req('/api/ads')));
    assert.equal(res.status, 200);
  });

  test('rejects other methods', async () => {
    assert.equal((await adsHandler(ctx(req('/api/ads', { method: 'POST' })))).status, 405);
  });
});

describe('admin auth (fails closed)', () => {
  test('no identity header -> 401', async () => {
    const c = ctx(req('/api/admin/config'));
    assert.equal((await adminMiddleware(c)).status, 401);
  });

  test('email not on the allow-list -> 403', async () => {
    const res = await admin(configHandler, '/api/admin/config', { headers: { 'Cf-Access-Authenticated-User-Email': 'evil@example.com' } });
    assert.equal(res.status, 403);
  });

  test('ADMIN_EMAILS unset -> 403 even with a header', async () => {
    env.ADMIN_EMAILS = '';
    assert.equal((await admin(configHandler, '/api/admin/config')).status, 403);
  });

  test('allow-list match is case-insensitive', async () => {
    const res = await admin(configHandler, '/api/admin/config', { headers: { 'Cf-Access-Authenticated-User-Email': 'Owner@Example.com' } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
  });

  test('DEV_ADMIN_BYPASS works on localhost only', async () => {
    env.DEV_ADMIN_BYPASS = '1';
    env.ADMIN_EMAILS = '';
    const local = ctx(req('/api/admin/config', { host: 'http://localhost:8788' }));
    local.next = () => configHandler(local);
    assert.equal((await adminMiddleware(local)).status, 200);

    const prod = ctx(req('/api/admin/config'));
    prod.next = () => configHandler(prod);
    assert.equal((await adminMiddleware(prod)).status, 403);
  });

  test('without Access JWT config, a forged email header is refused', async () => {
    delete env.ALLOW_UNVERIFIED_ACCESS_HEADER;
    assert.equal((await admin(configHandler, '/api/admin/config')).status, 503);
    const portal = await portalMiddleware(ctx(req('/admin/', { headers: { 'Cf-Access-Authenticated-User-Email': ADMIN } })));
    assert.equal(portal.status, 503);
  });

  test('JWT mode requires the Access token', async () => {
    env.ACCESS_TEAM_DOMAIN = 'team.cloudflareaccess.com';
    env.ACCESS_AUD = 'aud';
    assert.equal((await admin(configHandler, '/api/admin/config')).status, 401);
  });

  test('portal HTML is guarded and gets a CSP', async () => {
    assert.equal((await portalMiddleware(ctx(req('/admin/')))).status, 401);
    const ok = await portalMiddleware(ctx(req('/admin/', { headers: { 'Cf-Access-Authenticated-User-Email': ADMIN } })));
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  });
});

describe('/api/admin/config', () => {
  test('GET returns the default config and identity', async () => {
    const body = await (await admin(configHandler, '/api/admin/config')).json();
    assert.equal(body.me, ADMIN);
    assert.equal(body.config.version, 0);
    assert.deepEqual(body.history, []);
  });

  test('PUT saves version 1, records author, and serves it publicly', async () => {
    const cfg = editable(defaultConfig());
    cfg.slots.bottom.mode = 'off';
    const res = await putConfig(cfg, 0);
    assert.equal(res.status, 200);
    const saved = (await res.json()).config;
    assert.equal(saved.version, 1);
    assert.equal(saved.updatedBy, ADMIN);

    const pub = await (await adsHandler(ctx(req('/api/ads')))).json();
    assert.equal(pub.version, 1);
    assert.deepEqual(pub.slots.bottom, { mode: 'off' });
  });

  test('PUT rejects invalid config with 422 and field paths', async () => {
    const cfg = editable(defaultConfig());
    cfg.campaigns[0].ctaUrl = 'javascript:alert(1)';
    const res = await putConfig(cfg, 0);
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.errors[0].path, 'campaigns[0].ctaUrl');
    assert.equal(body.errors[0].code, 'url.https');
    assert.equal(env.ADS_KV.writes, 0);
  });

  test('PUT validates campaign lang and fills "any" for campaigns without it', async () => {
    const bad = editable(defaultConfig());
    bad.campaigns[0].lang = 'fr';
    const res = await putConfig(bad, 0);
    assert.equal(res.status, 422);
    const { errors } = await res.json();
    assert.deepEqual(errors.map((e) => [e.path, e.code]), [['campaigns[0].lang', 'lang.invalid']]);

    const legacy = editable(defaultConfig());
    delete legacy.campaigns[0].lang;
    const ok = await putConfig(legacy, 0);
    assert.equal(ok.status, 200);
    const saved = (await ok.json()).config;
    assert.deepEqual(saved.campaigns.map((c) => c.lang), ['any', 'bn', 'en', 'bn']);
  });

  test('PUT with a stale baseVersion -> 409', async () => {
    const cfg = editable(defaultConfig());
    assert.equal((await putConfig(cfg, 0)).status, 200);
    assert.equal((await putConfig(cfg, 0)).status, 409);
  });

  test('PUT from another origin -> 403 (CSRF)', async () => {
    const res = await putConfig(editable(defaultConfig()), 0, { headers: { Origin: 'https://evil.example' } });
    assert.equal(res.status, 403);
  });

  test('PUT requires JSON content type and a size-capped body', async () => {
    const wrongType = await putConfig(editable(defaultConfig()), 0, { headers: { 'Content-Type': 'text/plain' } });
    assert.equal(wrongType.status, 415);
    const huge = await admin(configHandler, '/api/admin/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(300 * 1024),
    });
    assert.equal(huge.status, 413);
  });

  test('keeps the last 10 versions and can fetch one for rollback', async () => {
    const cfg = editable(defaultConfig());
    for (let v = 0; v < 12; v++) {
      cfg.campaigns[0].weight = v + 1;
      assert.equal((await putConfig(cfg, v)).status, 200);
    }
    const body = await (await admin(configHandler, '/api/admin/config')).json();
    assert.equal(body.config.version, 12);
    assert.deepEqual(body.history.map((h) => h.version), [12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);

    const old = await (await admin(configHandler, '/api/admin/config?version=5')).json();
    assert.equal(old.config.campaigns[0].weight, 5);
    assert.equal((await admin(configHandler, '/api/admin/config?version=1')).status, 404);

    // Rollback = PUT the old content as a new version.
    const rolled = await (await putConfig(editable(old.config), 12)).json();
    assert.equal(rolled.config.version, 13);
    assert.equal(rolled.config.campaigns[0].weight, 5);
  });
});

describe('POST /api/track and GET /api/admin/stats', () => {
  function track(payload, headers = {}) {
    const c = ctx(req('/api/track', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'User-Agent': UA, 'Content-Type': 'text/plain;charset=UTF-8', ...headers },
      body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    }));
    return trackHandler(c).then(async (res) => { await Promise.all(c.waits); return res; });
  }
  const key = () => statsKey(todayLocal(), 'house-premium-top');

  test('counts impressions and clicks for known campaigns', async () => {
    assert.equal((await track({ campaignId: 'house-premium-top', event: 'impression' })).status, 204);
    await track({ campaignId: 'house-premium-top', event: 'impression' });
    await track({ campaignId: 'house-premium-top', event: 'click' });
    const m = env.ADS_KV.map.get(key()).metadata;
    assert.deepEqual(m, { i: 2, c: 1 });

    const stats = await (await admin(statsHandler, '/api/admin/stats')).json();
    assert.equal(stats.rows[0].campaignId, 'house-premium-top');
    assert.equal(stats.rows[0].impressions, 2);
    assert.equal(stats.rows[0].clicks, 1);
    assert.equal(stats.rows[0].ctr, 50);
  });

  test('ignores unknown campaigns, bots and cross-origin posts', async () => {
    assert.equal((await track({ campaignId: 'nope', event: 'click' })).status, 204);
    assert.equal((await track({ campaignId: 'house-premium-top', event: 'click' }, { 'User-Agent': 'curl/8.0' })).status, 204);
    assert.equal((await track({ campaignId: 'house-premium-top', event: 'click' }, { Origin: 'https://evil.example' })).status, 403);
    assert.equal(env.ADS_KV.writes, 0);
  });

  test('rejects malformed bodies', async () => {
    assert.equal((await track('not json')).status, 400);
    assert.equal((await track({ campaignId: 'house-premium-top', event: 'hover' })).status, 400);
    assert.equal((await track('x'.repeat(2000))).status, 413);
  });

  test('stats validates the date range', async () => {
    assert.equal((await admin(statsHandler, '/api/admin/stats?from=2026-09-10&to=2026-09-01')).status, 400);
    assert.equal((await admin(statsHandler, '/api/admin/stats?from=2026-01-01&to=2026-12-31')).status, 400);
    assert.equal((await admin(statsHandler, '/api/admin/stats?from=bad')).status, 400);
    const ok = await admin(statsHandler, '/api/admin/stats?from=2026-09-01&to=2026-09-30');
    assert.equal(ok.status, 200);
  });
});
