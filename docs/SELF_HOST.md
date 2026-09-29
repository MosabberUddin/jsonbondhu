# Self-hosting (Node + MySQL + nginx)

The site can run without Cloudflare. The static site is served by nginx, and the
ad API and admin portal run the **same handlers in `functions/`** on a small Node
server (`server/`), with MySQL in place of Workers KV and nginx basic auth in
place of Cloudflare Access.

Live setup (Ubuntu 24.04, 43.134.115.217):

| Host | What |
|---|---|
| `jsonbondhu.irmaoshop.com` | Public site (`public/`) + `/api/ads`, `/api/track`. `/admin` redirects to the CMS host |
| `cms-jsonbondhu.irmaoshop.com` | Admin portal (`/admin/`) + `/api/admin/*`, every path behind a login |

## How it maps

| Cloudflare | Self-hosted |
|---|---|
| Pages Functions runtime | `server/server.js`: Node HTTP server calling the `onRequest` handlers, `_middleware` first |
| Workers KV (`ADS_KV`) | `server/kv-mysql.js`: one MySQL table `jsonbondhu.kv` (`server/schema.sql`), same keys |
| KV key expiry | `expires_at` column, hidden from reads, swept daily |
| `caches.default` (track dedupe) | `server/memory-cache.js`, in memory |
| Cloudflare Access | nginx `auth_basic` on the CMS host; user names are the admin emails |

KV's write quota does not apply, so `IMPRESSION_SAMPLE_RATE=1` records every
impression.

## Admin login and why the header is safe

nginx authenticates the admin, then sets `Cf-Access-Authenticated-User-Email`
to the basic-auth user name, **replacing** anything the client sent; the public
host clears that header. `auth.js` accepts it because
`ALLOW_UNVERIFIED_ACCESS_HEADER=1`, and still requires the name to be in
`ADMIN_EMAILS`.

This is only safe because the Node server listens on `127.0.0.1` and is reached
solely through that nginx config. Never expose its port or proxy to it without
overwriting the header.

Add or change an admin (the name must also be in `ADMIN_EMAILS`):

```bash
htpasswd -B /etc/nginx/jsonbondhu-cms.htpasswd someone@example.com
systemctl reload nginx
```

## Files on the server

| What | Where |
|---|---|
| Static site | `/var/www/jsonbondhu` (copy of `public/`) |
| API server | `/opt/jsonbondhu/app` (`functions/` + `server/`), runs as user `jsonbondhu` |
| Settings | `/opt/jsonbondhu/app/server/.env` (see `server/.env.example`) |
| Service | `systemctl status jsonbondhu-api`, logs `journalctl -u jsonbondhu-api -f` |
| nginx | `/etc/nginx/sites-available/jsonbondhu`, `.../jsonbondhu-cms` |

## Moving KV data across

`server/import-kv.mjs` loads a KV export (`[{name, value, metadata, expiration}]`)
into MySQL. The Cloudflare namespace held only four stats keys on 2026-09-28
(no saved config, so the site was on the built-in default, version 0); all four
were imported with their original expiry.

## Known differences

- Stats increments are atomic here: `MysqlKV.atomicUpdate` locks the row
  (`SELECT … FOR UPDATE`) for the read-modify-write, so simultaneous hits on the
  same campaign are never lost. (On Workers KV they still can be.)
- On shutdown the server stops taking requests and waits up to 3.5 s for
  in-flight track writes (`server/pending.js`) before closing the MySQL pool.
- Keys use `utf8mb4_0900_bin` (byte-wise, NO PAD) and values `LONGTEXT`, matching
  KV key and value-size semantics. Existing tables: run the `ALTER TABLE` at the
  end of `server/schema.sql` once.
- The track dedupe cache lives in one process and resets on restart.
- KV values can be up to 25 MiB, but MySQL only accepts a value smaller than
  `max_allowed_packet` (production: 64 MB; MySQL 8 default is 64 MB, older or
  distro configs may be 4-16 MB). Ad config and stats are a few KB. If you ever import
  or store something larger, raise `max_allowed_packet` under `[mysqld]` in the MySQL
  config; `server/import-kv.mjs` checks this up front and lists any key that would not fit.
