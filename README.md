# JSON বন্ধু (jsonbondhu)

A free, bilingual (English / Bangla) online JSON formatter, validator, tree viewer, and converter
(JSON → CSV / YAML / XML). It is supported by ads and a one-time "remove ads" upgrade.
Everything runs in the browser. User JSON never leaves the device.

## Features

- Format (2/4 spaces or tab), minify, validate, and sort keys
- English and Bangla UI with an EN | বাংলা switch (auto-detects Bangla browsers; `?lang=bn` works too)
- Error line and column shown in the chosen language, with the caret moved to the error
- **Auto-repair**: fixes comments, trailing commas, single quotes, unquoted keys, and Python `True/False/None`
- Tree view: lazy rendering for large files, search, and click-to-copy JSONPath (`$.users[0].name`)
- Convert to CSV (UTF-8 BOM, so Bangla opens correctly in Excel), YAML, and XML
- File open, drag and drop, download, Ctrl+Enter, and the last input saved in localStorage
- Light and dark mode, mobile-friendly, and SEO metadata (bn locale, JSON-LD)

## Structure

| Path | Purpose |
|---|---|
| `public/` | Everything that is published (Cloudflare Pages output dir) |
| `public/index.html` | Hub: tool catalogue with search |
| `public/<tool>/` | One folder per tool: `index.html` + page script |
| `public/lib/*-core.js`, `public/convert.js` | Pure tool logic, unit-tested in `tests/` |
| `public/i18n.js`, `public/tools.js` | Shared: EN/বাংলা strings + switch; tool list, copy/download/toast helpers |
| `public/ads.js`, `public/admin/`, `functions/` | Ad serving, admin portal, and API. See `docs/ADS.md` |
| `docs/` | Monetization, ads and release process |
| `tests/`, `e2e/` | `npm test` (unit/backend), `npm run test:e2e` (Playwright, desktop + mobile) |

### Adding a tool

Copy `public/uuid-generator/` (page + script) and `public/lib/uuid-core.js` + `tests/uuid.test.js`, add the tool to
`TOOLS` in `public/tools.js` and its `tool.<id>.name/desc` strings to `public/i18n.js`, and add the URL to `public/sitemap.xml`.

## Run locally

```bash
python -m http.server 8765 --directory public
```

Then open http://localhost:8765. For the ad API and admin portal, use `npm run dev` (runs `wrangler pages dev`, which serves `public/` + `functions/`) (see `docs/ADS.md`).

## Deploy (Cloudflare Pages, free)

1. Push this folder to a GitHub repo.
2. In the Cloudflare dashboard, go to Workers & Pages → Create → Pages → connect the repo. There is no build command, and the output dir is `public` (`wrangler.toml` sets `pages_build_output_dir = "public"`; never publish the repository root).
3. Add a custom domain (for example `jsonbondhu.com`), then replace every `jsonbondhu.irmaoshop.com` with it:
   canonical/hreflang/JSON-LD URLs in `public/**/index.html`, `public/robots.txt`, `public/sitemap.xml`, and the
   house-ad links in `functions/_lib/ads-core.js`. `git grep -l jsonbondhu.irmaoshop.com` lists every file to change.
4. Follow `docs/ADS.md` to set up KV, admin email, and Cloudflare Access.
5. Submit `sitemap.xml` in Google Search Console.

## Review workflow

- `main` is protected: every change goes through a PR that needs CI (unit + e2e) and CodeRabbit's approval. Human review is optional.
- Claude can open PRs and address review comments, and `/code-review` can run an extra automated pass.
- Areas worth a human look when time allows: ad-rendering escaping in `ads.js`, auth on `functions/api/admin/*`, and KV write limits.

## Before launch checklist

- [ ] Buy the domain and replace the placeholder domain/email
- [ ] Fill in the date in `privacy.html`, and get legal advice if needed
- [ ] Deploy, verify in Search Console, and add analytics (Cloudflare Web Analytics is free and cookieless)
- [ ] Apply to AdSense. After approval, fill in `ads.txt` and the publisher ID
- [ ] Set up a consent banner (CMP) for EEA/UK visitors if AdSense requires it
- [ ] Integrate a payment gateway for the "remove ads" upgrade (see `docs/MONETIZATION.md`)
