// Self-hosted runtime for the Pages Functions in functions/.
//
// Runs the same handlers Cloudflare runs, with:
//   - ADS_KV backed by MySQL (server/kv-mysql.js) instead of Workers KV
//   - caches.default as a small in-memory cache (used by /api/track dedupe)
//   - the admin portal files served from public/admin behind its middleware
//
// Admin identity: nginx does the login (HTTP basic auth on the CMS host) and
// passes the user name in Cf-Access-Authenticated-User-Email, overwriting any
// value the client sent. auth.js trusts it because ALLOW_UNVERIFIED_ACCESS_HEADER
// is set. That is only safe because this server listens on 127.0.0.1 and is
// reachable solely through that nginx config; see docs/SELF_HOST.md.
//
//   node --env-file=.env server/server.js

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

import { onRequest as adsHandler } from '../functions/api/ads.js';
import { onRequest as trackHandler } from '../functions/api/track.js';
import { onRequest as apiAdminMiddleware } from '../functions/api/admin/_middleware.js';
import { onRequest as configHandler } from '../functions/api/admin/config.js';
import { onRequest as statsHandler } from '../functions/api/admin/stats.js';
import { onRequest as portalMiddleware } from '../functions/admin/_middleware.js';
import { MysqlKV } from './kv-mysql.js';
import { MemoryCache } from './memory-cache.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(process.env.PUBLIC_DIR || path.join(HERE, '..', 'public'));
const ADMIN_DIR = path.join(PUBLIC_DIR, 'admin');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT) || 8788;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const pool = mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 10, enableKeepAlive: true, charset: 'utf8mb4' });
const kv = new MysqlKV(pool);
globalThis.caches = { default: new MemoryCache() };

// Same shape as the Pages env: bindings plus string vars.
const env = {
  ADS_KV: kv,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS || '',
  IMPRESSION_SAMPLE_RATE: process.env.IMPRESSION_SAMPLE_RATE || '1',
  ALLOW_UNVERIFIED_ACCESS_HEADER: process.env.ALLOW_UNVERIFIED_ACCESS_HEADER || '',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Pages routing: a folder's _middleware runs before every handler below it.
function route(pathname) {
  if (pathname === '/api/ads') return [adsHandler];
  if (pathname === '/api/track') return [trackHandler];
  if (pathname === '/api/admin/config') return [apiAdminMiddleware, configHandler];
  if (pathname === '/api/admin/stats') return [apiAdminMiddleware, statsHandler];
  if (pathname.startsWith('/api/admin/')) return [apiAdminMiddleware, notFound];
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return [portalMiddleware, serveAdminFile];
  return [notFound];
}

function run(chain, context, i = 0) {
  context.next = () => run(chain, context, i + 1);
  return chain[i](context);
}

async function notFound() {
  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function serveAdminFile({ request }) {
  const { pathname } = new URL(request.url);
  if (pathname === '/admin') return Response.redirect(new URL('/admin/', request.url), 301);
  const rel = decodeURIComponent(pathname.slice('/admin/'.length)) || 'index.html';
  const file = path.resolve(ADMIN_DIR, rel);
  if (!file.startsWith(ADMIN_DIR + path.sep)) return notFound();
  try {
    const info = await stat(file);
    if (!info.isFile()) return notFound();
    const body = request.method === 'HEAD' ? null : await readFile(file);
    return new Response(body, {
      headers: { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return notFound();
  }
}

function toRequest(req) {
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const url = `${proto}://${req.headers.host || 'localhost'}${req.url}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  }
  // track.js keys its dedupe cache on the client IP.
  if (req.headers['x-real-ip']) headers.set('CF-Connecting-IP', req.headers['x-real-ip']);
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? 'half' : undefined,
  });
}

async function send(res, response, method) {
  const headers = {};
  response.headers.forEach((v, k) => { headers[k] = v; });
  res.writeHead(response.status, headers);
  if (!response.body || method === 'HEAD') return res.end();
  Readable.fromWeb(response.body).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const request = toRequest(req);
    const context = {
      request,
      env,
      params: {},
      data: {},
      waitUntil: (p) => Promise.resolve(p).catch((e) => console.error('waitUntil task failed', e)),
    };
    const response = await run(route(new URL(request.url).pathname), context);
    await send(res, response, req.method);
  } catch (e) {
    console.error('request failed', req.method, req.url, e);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Internal error' }));
  }
});

// Cloudflare expires stats keys itself; here we sweep once a day.
const sweep = setInterval(() => {
  kv.purgeExpired().then((n) => n && console.log(`purged ${n} expired keys`)).catch((e) => console.error('purge failed', e));
}, 24 * 60 * 60 * 1000);
sweep.unref();

server.listen(PORT, HOST, () => {
  console.log(`jsonbondhu API listening on http://${HOST}:${PORT} (public dir ${PUBLIC_DIR})`);
});

function shutdown() {
  server.close();
  server.closeIdleConnections?.();
  pool.end().finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
