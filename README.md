# JSON বন্ধু (jsonbondhu)

A free, Bangla-language online JSON formatter, validator, tree viewer, and converter
(JSON → CSV / YAML / XML). It is supported by ads and a one-time "remove ads" upgrade.
Everything runs in the browser. User JSON never leaves the device.

## Features
- Format (2/4 spaces or tab), minify, validate, and sort keys
- Error line and column shown in Bangla, with the caret moved to the error
- **Auto-repair**: fixes comments, trailing commas, single quotes, unquoted keys, and Python `True/False/None`
- Tree view: lazy rendering for large files, search, and click-to-copy JSONPath (`$.users[0].name`)
- Convert to CSV (UTF-8 BOM, so Bangla opens correctly in Excel), YAML, and XML
- File open, drag and drop, download, Ctrl+Enter, and the last input saved in localStorage
- Light and dark mode, mobile-friendly, and SEO metadata (bn locale, JSON-LD)

## Structure
| Path | Purpose |
|---|---|
| `index.html`, `styles.css`, `app.js` | The tool UI |
| `convert.js` | Pure logic (repair, converters, error location), unit-tested |
| `privacy.html` | Privacy policy (required by AdSense) |
| `ads.js`, `admin/`, `functions/` | Ad serving, admin portal, and API. See `docs/ADS.md` |
| `docs/MONETIZATION.md` | AdSense, local ad sales, payments, and revenue plan |
| `robots.txt`, `sitemap.xml`, `ads.txt`, `_headers` | Launch and hosting files |
| `tests/` | `node --test tests/` |
| `.github/workflows/ci.yml` | CI runs the tests on every PR |

## Run locally
```bash
python -m http.server 8765
```
Then open http://localhost:8765. For the ad API and admin portal, use `npx wrangler pages dev .` (see `docs/ADS.md`).

## Deploy (Cloudflare Pages, free)
1. Push this folder to a GitHub repo.
2. In the Cloudflare dashboard, go to Workers & Pages → Create → Pages → connect the repo. There is no build command, and the output dir is `/`.
3. Add a custom domain (for example `jsonbondhu.com`), then replace `jsonbondhu.com` in `index.html`, `robots.txt`, and `sitemap.xml`.
4. Follow `docs/ADS.md` to set up KV, admin email, and Cloudflare Access.
5. Submit `sitemap.xml` in Google Search Console.

## Review workflow (for the DevOps reviewer)
- Use `main` as a protected branch, with all changes made through PRs. CI must pass.
- Claude can open PRs and address review comments, and `/code-review` can run an automated pass before human review.
- Things to check first: ad-rendering escaping in `ads.js`, auth on `functions/api/admin/*`, and KV write limits.

## Before launch checklist
- [ ] Buy the domain and replace the placeholder domain/email
- [ ] Fill in the date in `privacy.html`, and get legal advice if needed
- [ ] Deploy, verify in Search Console, and add analytics (Cloudflare Web Analytics is free and cookieless)
- [ ] Apply to AdSense. After approval, fill in `ads.txt` and the publisher ID
- [ ] Set up a consent banner (CMP) for EEA/UK visitors if AdSense requires it
- [ ] Integrate a payment gateway for the "remove ads" upgrade (see `docs/MONETIZATION.md`)
