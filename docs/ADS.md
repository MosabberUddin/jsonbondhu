# Ad serving and admin portal

JSON বন্ধু serves its own ads (direct-sold and "house" promotions) or Google AdSense in two
slots (`top`, `bottom`). Everything runs on Cloudflare's free tier: Pages for the static site,
Pages Functions for the API, and Workers KV for config and counters. There is no server to manage
and no npm runtime dependencies.

## Architecture

```
Browser (index.html)                        Cloudflare edge
┌──────────────────────┐   GET /api/ads     ┌───────────────────────────────┐
│ ads.js               │ ─────────────────► │ functions/api/ads.js          │──┐
│  - fills [data-ad]   │   (cached 60s)     │  public, resolved per slot    │  │
│  - IntersectionObs.  │   POST /api/track  ├───────────────────────────────┤  │  Workers KV (ADS_KV)
│  - sendBeacon        │ ─────────────────► │ functions/api/track.js        │──┼─► config:current
└──────────────────────┘                    │  bot filter, dedupe, sample   │  │   config:history (last 10)
                                            ├───────────────────────────────┤  │   stats:YYYY-MM-DD:<id>
Admin (/admin/)        Cloudflare Access    │ functions/api/admin/          │  │
┌──────────────────────┐   ┌──────────┐     │  _middleware.js (auth, CSRF)  │──┘
│ admin/index.html     │──►│ SSO/OTP  │───► │  config.js  GET/PUT           │
│ admin.js, admin.css  │   └──────────┘     │  stats.js   GET               │
└──────────────────────┘                    └───────────────────────────────┘
```

| Path | Role |
|---|---|
| `functions/_lib/ads-core.js` | Pure logic: validation, slot resolution, language targeting, weighted pick, stats aggregation. Shared by functions and tests. |
| `functions/_lib/auth.js` | Admin auth: Access JWT or header check, `ADMIN_EMAILS` allow-list, localhost-only dev bypass. |
| `functions/_lib/store.js` | KV reads and writes for the config and its history. |
| `functions/_lib/http.js` | JSON responses, a body-size-capped reader, and the same-origin check. |
| `functions/api/ads.js` | `GET /api/ads`: the public config. |
| `functions/api/track.js` | `POST /api/track`: impression and click counters. |
| `functions/api/admin/_middleware.js` | Auth and the CSRF guard for every `/api/admin/*` route. |
| `functions/api/admin/config.js` | `GET`/`PUT` for the full config, with history and rollback. |
| `functions/api/admin/stats.js` | `GET ?from&to`: impressions, clicks, and CTR. |
| `functions/admin/_middleware.js` | Guards the static `/admin/*` portal and adds a strict CSP. |
| `functions/package.json` | Makes `functions/` ES modules for Node tests. It does not affect the rest of the repo. |
| `ads.js`, `ads.css` | Site-side renderer. `ads.js` injects `ads.css` itself. |
| `admin/` | Admin portal (English / Bangla UI, strings in `admin/i18n.js`). Its preview uses `ads.js`, so it matches the site. |

## Data model

### Config (`config:current`)

```jsonc
{
  "schemaVersion": 1,
  "version": 12,                        // server-assigned, +1 per save
  "updatedAt": "2026-09-24T10:00:00Z",  // server-assigned
  "updatedBy": "owner@example.com",     // server-assigned (from Access identity)
  "slots": {
    "top":    { "enabled": true, "mode": "direct", "adsense": { "client": "", "slot": "" } },
    "bottom": { "enabled": true, "mode": "adsense",
                "adsense": { "client": "ca-pub-1234567890123456", "slot": "1234567890" } }
  },
  "campaigns": [
    {
      "id": "c-mf2k1x-a1b2c3",        // [a-z0-9-], ≤64, unique
      "name": "Dhaka Dev Shop — Sept", // admin-only label, ≤80
      "advertiser": "Dhaka Dev Shop",  // "house" = own promotion, ≤80
      "slot": "top",                   // "top" | "bottom"
      "lang": "bn",                    // "any" | "en" | "bn"; optional, missing = "any"
      "type": "text",                  // "text" | "image"
      "imageUrl": "",                  // https, required for image
      "headline": "ল্যাপটপে ১০% ছাড়",     // ≤60, required; alt text for image ads
      "body": "ডেভেলপারদের জন্য…",      // ≤140, text ads only
      "ctaText": "অর্ডার করুন",          // ≤24
      "ctaUrl": "https://example.com/offer", // https only, no credentials
      "bgColor": "#1e3a8a",            // optional #RRGGBB; text colour auto-contrasts
      "startDate": "2026-09-01",       // inclusive, Bangladesh time
      "endDate": "2026-09-30",         // inclusive, Bangladesh time
      "weight": 10,                    // integer 1–100
      "active": true
    }
  ]
}
```

Validation lives in `validateConfig()` in `ads-core.js`, and the server runs it on every `PUT`.
Unknown fields are dropped. Server metadata never comes from the client. Text is trimmed and
length-checked in characters. Control characters are rejected. URLs must be absolute
`https:` with no user or password. Dates must be real calendar dates with `end >= start`.
The limit is 200 campaigns. `lang` must be `any`, `en`, or `bn`. A missing `lang` (configs
saved before language targeting) is read as `any` and saved as `any` on the next `PUT`.

Each validation error is `{path, code, message, params?}`. `code` is stable (for example
`url.https`, `text.tooLong` with `params.max`, or `lang.invalid`), and the portal translates it
through the `e.<code>` keys in `admin/i18n.js`. `message` is a Bangla fallback for other clients.

### Slot resolution (`resolveSlot()`)

| Slot mode | Result |
|---|---|
| `enabled: false` or `off` | Slot hidden |
| `adsense` with valid client and slot | `<ins class="adsbygoogle">`, and the script loads once |
| `adsense` with missing IDs | Same as `house` |
| `direct` | Active, in-date, non-house campaigns for the slot. If there are none, house campaigns. If there are none, hidden. |
| `house` | House campaigns only. If there are none, hidden. |

"In-date" means `startDate <= today <= endDate`, where today is `Asia/Dhaka` (UTC+6, no DST).
The API returns the eligible **pool** per slot. The browser picks one with weighted random
selection, so a 60-second cached response still rotates ads across page views. The pick mirrors
`pickWeighted()`.

### Language targeting

The site language is `document.documentElement.lang`: `en` (the default) or `bn`. A campaign
shows only to visitors whose language matches its `lang`, or to everyone when `lang` is `any`.
The table above applies **per language**: `resolveSlot(config, slot, today, lang)`. In
`direct` mode, a paid Bangla campaign replaces house ads for Bangla visitors only, and English
visitors still get the English house ad. A slot with nothing for a language is hidden for that
language.

`/api/ads` stays a single cacheable response with no language parameter. For each campaign slot,
it returns the union of the English and Bangla pools, with `lang` on every campaign. `mode` is
`direct` if either language resolved to paid campaigns. `ads.js` narrows the pool with
`poolForLang()`: it keeps the visitor's language and `any`, and if any of those are paid, it
drops the house ads. A unit test checks that this equals `resolveSlot(..., lang)` for every
combination. Campaigns without `lang`, including responses from an older deploy, count as `any`.

When the site dispatches `jb:langchange` on `window` (after it updates `documentElement.lang`),
`ads.js` re-renders the campaign slots from the response it already has, without a new request.
A campaign that also fits the new language stays. Otherwise it picks again. AdSense slots are not
touched. The small label reads **Ad** in English and **বিজ্ঞাপন** in Bangla. Impressions are sent
at most once per campaign per page view, so switching back and forth never double-counts.

`GET /api/ads` exposes only `id, type, imageUrl, headline, body, ctaText, ctaUrl, bgColor,
weight, lang, house`. It never exposes advertiser names, schedules, or history. If KV is empty or
unreachable, it serves `defaultConfig()`: four house ads for the "remove ads" upgrade, one
English (`lang: "en"`) and one Bangla (`lang: "bn"`) in each slot. The Bangla ones keep their
original ids (`house-premium-top`, `house-premium-bottom`) so their stats continue. The English
ones are `house-premium-top-en` and `house-premium-bottom-en`.

> **Stored configs are not migrated.** A config already saved in KV has Bangla-only house ads with
> no `lang`, which means `any`. English visitors keep seeing them until an admin adds English
> house campaigns (or sets languages) in the portal and saves.

### History (`config:history`)

This key holds an array of the last 10 saved configs, newest first. To roll back, the portal
loads an old version as a draft (`GET /api/admin/config?version=N`), and the admin saves it
as a new version. History is never rewritten.

Saves use optimistic concurrency. The `PUT` body carries `baseVersion`, and a stale base
returns `409`. KV has no transactions, so this is best-effort, but it is enough for a
handful of admins.

### Counters (`stats:YYYY-MM-DD:<campaignId>`)

Each counter's value and KV **metadata** are `{"i": impressions, "c": clicks}`. It expires
after about 400 days. The stats endpoint reads metadata through `list()`, one call per
calendar month in range (max range 92 days), so it never does one `get` per key.

## Tracking

* **Impression:** sent after at least 50% of the card is visible for 1 second while the tab
  is visible (`IntersectionObserver`), at most once per campaign per page view, including
  across language switches.
* **Click:** `navigator.sendBeacon` fires on CTA `click`/middle-click. The link opens normally
  (`target=_blank`, `rel="sponsored noopener"`; house ads use `rel="noopener"`). The whole card
  is clickable through a stretched link, so the accessibility tree has one link.
* **Server-side filtering (naive):** the server requires a same-origin `Origin` (or
  `Sec-Fetch-Site`) and drops bot and tool user agents. It counts only campaigns in the live
  config and dedupes 1 event per 15 s per (IP + UA + campaign + event) with the colo-local
  Cache API. IPs are hashed and never stored. This is not fraud-proof. For paid campaigns,
  treat the numbers as indicative.

### KV limits (read this before launch)

| Workers KV free tier | Limit | Impact |
|---|---|---|
| Writes | **1,000 / day per account** | Each counted event is 1 write. A config save is 2 writes. |
| Reads | 100,000 / day | `/api/ads` uses `cacheTtl: 60`, so most requests hit the edge cache. |
| List | 1,000 / day | The stats page uses about 1–4 per view. |
| Same-key writes | ~1 / second | A busy campaign's counter can drop increments. |
| Consistency | Eventual, up to ~60 s | Increments are read-modify-write, so concurrent events can be lost. Counts are approximate. |

`IMPRESSION_SAMPLE_RATE` (set to `0.1` in `wrangler.toml`) records 1 in 10 impressions,
weighted ×10. Clicks are always recorded. At that rate, about 5k pageviews/day × 2 slots ≈ 1,000
impression writes plus clicks. That exhausts the free quota, and **config saves then fail with
503 until the next UTC day**. The admin sees an error, and the live site keeps working.

**Upgrade path, in order of preference:**
1. **Workers Analytics Engine.** It is built for this: `writeDataPoint()` per event, no
   read-modify-write, and SQL queries. It has a free allocation. Replace `increment()` in
   `track.js` and query it from `stats.js` with the SQL API (needs an API token secret).
2. **D1 (SQLite).** 100k writes/day free. Use `INSERT … ON CONFLICT DO UPDATE SET i = i + 1`
   for atomic counters, and keep KV for the config.
3. **Workers Paid ($5/month).** 1M KV writes/month are included, and the code stays as it is.

## Security model

* **Cloudflare Access** is the front door for `/admin/*` and `/api/admin/*`.
* **Defence in depth (fails closed):** every admin request goes through `authenticateAdmin()`:
  * `ADMIN_EMAILS` empty or unset: **403 for everyone**.
  * If `ACCESS_TEAM_DOMAIN` **and** `ACCESS_AUD` are set, the `Cf-Access-Jwt-Assertion` JWT is
    verified (RS256 against the team's `/cdn-cgi/access/certs`, plus `aud`, `iss`, and `exp`).
    Its email must be in `ADMIN_EMAILS`. **Both are required.**
  * If either is missing, **every admin request gets a 503**. The bare
    `Cf-Access-Authenticated-User-Email` header can be forged on any hostname that Access doesn't
    cover (such as `*.pages.dev`), so it is trusted only when `ALLOW_UNVERIFIED_ACCESS_HEADER=1`.
    That flag is for tests only. Never set it in Cloudflare.
  * `DEV_ADMIN_BYPASS=1` works only when the request host is `localhost`, `127.0.0.1`, or
    `[::1]`. It is ignored and logged anywhere else.
* **CSRF:** non-GET admin requests need a same-origin `Origin` and `Content-Type: application/json`.
* **Input:** bodies are size-capped (256 KB config, 512 B track) and validated server-side.
  The portal's own checks are only for UX.
* **Rendering:** `ads.js` and `admin.js` build DOM with `textContent`/`setAttribute` only,
  translated strings included.
  There is no `innerHTML` with data. URLs are re-checked for `https:` in the browser.
  `bgColor` must match `#RRGGBB`.
* **Admin portal headers:** strict CSP (`script-src 'self'`, `frame-ancestors 'none'`),
  `no-store`, `noindex`.

## Setup

Prerequisites: Node ≥ 22 and a Cloudflare account. Run all commands from the repo root.

### 1. Create the KV namespaces

```bash
npx wrangler login
npx wrangler kv namespace create ADS_KV            # production
npx wrangler kv namespace create ADS_KV_PREVIEW    # PR preview deployments
```

Paste the two `id`s into `wrangler.toml` (production under `[[kv_namespaces]]`, preview
under `[[env.preview.kv_namespaces]]`). Namespace IDs are not secret. Previews get their own
namespace so that testing on a PR URL can never change production ads.

### 2. Configure Cloudflare Access (Zero Trust, free up to 50 users)

1. Go to Zero Trust → Settings and find your team domain. Note it
   (`<team>.cloudflareaccess.com`) and put it in `ACCESS_TEAM_DOMAIN` in `wrangler.toml`.
2. Go to Zero Trust → Access → Applications → **Add → Self-hosted**, and name it
   "JSON বন্ধু admin".
3. Add **every hostname** that serves the site, each with **two paths**, `admin` and
   `api/admin`:
   * `jsonbondhu.com/admin`, `jsonbondhu.com/api/admin`
   * `jsonbondhu.pages.dev/admin`, `jsonbondhu.pages.dev/api/admin`
   * `*.jsonbondhu.pages.dev/admin`, `*.jsonbondhu.pages.dev/api/admin` (previews)
   Keep them in **one** application so there is a single AUD tag.
4. Policy: **Allow**, Include → Emails → the admin addresses. Session duration: 24h.
5. Copy the application's **AUD tag** from its Overview tab.
6. Optional: Pages → Settings → "Enable access policy" also puts preview deployments behind
   Access, as `docs/RELEASE.md` recommends.

### 3. Set secrets

```bash
npx wrangler pages secret put ADMIN_EMAILS --project-name jsonbondhu   # a@x.com,b@y.com
npx wrangler pages secret put ACCESS_AUD   --project-name jsonbondhu   # AUD tag from step 2.5
```

For previews, add the same two secrets in the dashboard under Pages → jsonbondhu → Settings →
Variables and Secrets, with the environment set to **Preview**. Never set `DEV_ADMIN_BYPASS` in Cloudflare.

### 4. Deploy

Production deploys from `main` through the Git integration (see `docs/RELEASE.md`):
Framework preset *None*, build command empty, output directory `/`. Wrangler reads the
bindings and vars from `wrangler.toml`.

For a manual deploy: `npx wrangler pages deploy`. Direct upload publishes the **whole folder**,
so make sure no `.dev.vars` or other local secrets are in it (see Open issues).

### 5. Verify

* `https://jsonbondhu.com/api/ads` returns JSON with `"version": 0` and the house ads.
* `https://jsonbondhu.com/admin/` redirects to the Access login. After login, the portal shows your email.
* `curl -H "Cf-Access-Authenticated-User-Email: you@x.com" https://jsonbondhu.pages.dev/api/admin/config`
  must return **401** (JWT mode rejects forged headers).

## Local development

```powershell
Copy-Item .dev.vars.example .dev.vars   # DEV_ADMIN_BYPASS=1, ADMIN_EMAILS=...
npm install                             # dev tools only (wrangler, playwright)
npx wrangler pages dev .                # http://localhost:8788
```

* Site: http://localhost:8788/. Admin: http://localhost:8788/admin/. Locally you are signed in
  as `dev@localhost`.
* Wrangler simulates KV locally in `.wrangler/state/` (git-ignored). Delete that folder to reset.
* `python -m http.server` (the plain static server) also works. `/api/ads` 404s there, so
  `ads.js` leaves the placeholders as they are, which is what the e2e tests expect.
* Unit and handler tests: `node --test` (see the note on `node --test tests/` in Open issues).
* To see ads again after testing premium: `localStorage.removeItem('jb_premium')`.
* Language: the portal and the site share the `localStorage` key `jb_lang` (`en` | `bn`). The
  portal has its own **EN | বাংলা** switch in the header. English is the default.

## How a local advertiser's campaign goes live

1. **Agree terms.** Agree on the slot, dates, and price (see `docs/MONETIZATION.md`). Collect:
   headline (≤60 characters), body (≤140), button text (≤24), an **https** landing URL, and
   optionally a banner (728×90 or 320×90, WebP/PNG, < 50 KB).
2. **Host the creative on our domain.** For example, commit it under `/ads-img/` through a PR,
   or use R2. Then the advertiser cannot swap the image after approval or collect visitor IPs.
3. **Create the campaign.** In `/admin/`, go to **Campaigns → + New campaign** (Bangla UI:
   **ক্যাম্পেইন → + নতুন ক্যাম্পেইন**). Fill in the fields and set **Language** to the language the
   copy is written in. **Any** shows it to everyone. Check the **Live preview** in desktop and
   mobile widths, set the start and end dates and the weight, and switch on **Active**. Then click
   **Apply**.
4. **Check the slot mode.** In **Slot settings**, the slot must be in **Direct** mode. In AdSense
   mode, direct campaigns do not show. Each slot card lists what is live today for English and
   for Bangla visitors.
5. **Publish.** Click **Save & publish**. The server validates the config and stores it as a
   new version. Visitors see it within about 2 minutes (KV propagation plus the 60 s cache).
   If the start date is in the future, it goes live automatically at 00:00 Bangladesh time.
6. **Verify.** Open the site in a private window. With several campaigns in one slot, reload a
   few times to see the rotation.
7. **Report.** Use **Statistics** to pick the date range and send impressions, clicks, and CTR
   to the advertiser. Numbers are approximate (see KV limits).
8. **End.** After `endDate` the campaign stops automatically, and the slot falls back to the
   house ad. If something goes wrong, go to **Version history → Load this version → Save & publish**. This rolls
   back instantly and needs no deploy.

## Open issues / owner decisions

* **KV write quota:** tracking and admin saves share 1,000 writes/day on the free plan. Move
  tracking to Analytics Engine or D1 before traffic grows (see above).
* **`ACCESS_AUD` is effectively mandatory** because the site is also reachable on `*.pages.dev`.
* **AdSense:** a consent/CMP banner is needed for EEA/UK traffic. AdSense can still shift layout
  if Google serves a taller unit. The `<ins>` is locked to the reserved height with
  `data-ad-format="horizontal"`.
* **Output dir is the repo root**, so `docs/`, `tests/`, `wrangler.toml`, and
  `.dev.vars.example` are publicly fetchable. None of them contain secrets, but moving public
  files to `public/` would be cleaner.
* **Premium flag:** `jb_premium` in localStorage is a client-side honour flag with no
  verification, which is fine for hiding ads. A real purchase flow should set it from a
  signed server response.
