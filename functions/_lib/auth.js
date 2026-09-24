// Admin authentication. Cloudflare Access is the primary gate for /admin/* and
// /api/admin/*; this module is defence in depth so the app fails CLOSED if an
// Access policy is ever removed or misconfigured.
//
// Env:
//   ADMIN_EMAILS        comma-separated allow-list (required; empty => nobody)
//   ACCESS_TEAM_DOMAIN  e.g. "jsonbondhu.cloudflareaccess.com"   (recommended)
//   ACCESS_AUD          Access application AUD tag               (recommended)
//   DEV_ADMIN_BYPASS    "1" allows access on localhost only (wrangler pages dev)
//
//   ALLOW_UNVERIFIED_ACCESS_HEADER  "1" trusts the email header without a JWT (tests only)
//
// When ACCESS_TEAM_DOMAIN and ACCESS_AUD are set, the Cf-Access-Jwt-Assertion
// JWT is cryptographically verified and its email claim is used. Without them
// every admin request is denied, because the bare email header can be forged
// wherever Access is NOT in front of the route.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const CERTS_TTL_MS = 60 * 60 * 1000;
let certsCache = { domain: '', fetchedAt: 0, keys: [] };

export function parseAdminEmails(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * @returns {Promise<{ok: true, email: string, via: string} | {ok: false, status: number, reason: string}>}
 */
export async function authenticateAdmin(request, env) {
  const url = new URL(request.url);

  if (env.DEV_ADMIN_BYPASS === '1') {
    if (LOCAL_HOSTS.has(url.hostname)) {
      return { ok: true, email: 'dev@localhost', via: 'dev-bypass' };
    }
    console.error('DEV_ADMIN_BYPASS is set on a non-local host; ignoring it');
  }

  const allowed = parseAdminEmails(env.ADMIN_EMAILS);
  if (allowed.length === 0) {
    console.error('ADMIN_EMAILS is empty; denying all admin requests');
    return { ok: false, status: 403, reason: 'Admin access is not configured' };
  }

  const headerEmail = (request.headers.get('Cf-Access-Authenticated-User-Email') || '').trim().toLowerCase();
  let email = headerEmail;
  let via = 'access-header';
  const jwtMode = Boolean(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD);

  // Without JWT verification the email header can be forged on any hostname that
  // Access doesn't cover (e.g. *.pages.dev), so header-only mode is opt-in.
  if (!jwtMode && env.ALLOW_UNVERIFIED_ACCESS_HEADER !== '1') {
    console.error('ACCESS_TEAM_DOMAIN/ACCESS_AUD not set; denying all admin requests');
    return { ok: false, status: 503, reason: 'Admin access is not configured' };
  }

  if (jwtMode) {
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!token) return { ok: false, status: 401, reason: 'Missing Access token' };
    const claims = await verifyAccessJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD).catch((e) => {
      console.error('Access JWT verification error', e);
      return null;
    });
    const jwtEmail = typeof claims?.email === 'string' ? claims.email.trim().toLowerCase() : '';
    if (!jwtEmail) return { ok: false, status: 401, reason: 'Invalid Access token' };
    if (headerEmail && headerEmail !== jwtEmail) return { ok: false, status: 401, reason: 'Identity mismatch' };
    email = jwtEmail;
    via = 'access-jwt';
  }

  if (!email) return { ok: false, status: 401, reason: 'Not authenticated' };
  if (!allowed.includes(email)) return { ok: false, status: 403, reason: 'Not an admin' };
  return { ok: true, email, via };
}

// --- Access JWT (RS256) verification with WebCrypto ------------------------

function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlJson(s) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));
}

async function getCerts(teamDomain, forceRefresh = false) {
  const fresh = certsCache.domain === teamDomain && Date.now() - certsCache.fetchedAt < CERTS_TTL_MS;
  if (fresh && !forceRefresh) return certsCache.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`certs fetch failed: ${res.status}`);
  const body = await res.json();
  const keys = Array.isArray(body.keys) ? body.keys : [];
  certsCache = { domain: teamDomain, fetchedAt: Date.now(), keys };
  return keys;
}

export async function verifyAccessJwt(token, teamDomain, aud) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const header = b64urlJson(h);
  if (header.alg !== 'RS256' || !header.kid) return null;

  let keys = await getCerts(teamDomain);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    // Key rotation: refresh once.
    keys = await getCerts(teamDomain, true);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlToBytes(s),
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!valid) return null;

  const claims = b64urlJson(p);
  const now = Math.floor(Date.now() / 1000);
  const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!auds.includes(aud)) return null;
  if (claims.iss !== `https://${teamDomain}`) return null;
  if (typeof claims.exp !== 'number' || claims.exp < now - 30) return null;
  if (typeof claims.nbf === 'number' && claims.nbf > now + 30) return null;
  return claims;
}
