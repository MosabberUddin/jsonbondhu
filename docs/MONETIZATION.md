# JSON বন্ধু — Monetization Playbook

Researched: **24 September 2026**. Policies, fees and thresholds change often, so check each linked source before you act on it.
Legend: **[V]** = checked against the source linked in the same line. **[U]** = not verified or only from secondary sources. Confirm these yourself.
FX used for the maths: **1 USD ≈ ৳123** (mid-market, late Sep 2026, [Wise](https://wise.com/gb/currency-converter/usd-to-bdt-rate/history) / [exchange-rates.org](https://www.exchange-rates.org/exchange-rate-history/usd-bdt-2026)).

---

## TL;DR (read this first)

1. **AdSense supports Bengali (Bangla) today** [V] ([AdSense supported languages](https://support.google.com/adsense/answer/9727), [Google blog](https://blog.google/products/adsense/adsense-now-understands-bengali-bangla/)). A Bangla site is eligible.
2. The biggest risk for a JSON tool site is being **rejected for "Low value content"**. Pages that only hold a tool with little text often get rejected. Add real Bangla guides before you apply.
3. **Ad income from Bangladeshi and South Asian traffic is low.** Expect an RPM of roughly **$0.30–$1.50** [U]. Reaching **৳10,000/month** (≈ $81) needs roughly **55k–270k page views/month** from ads alone.
4. **Selling banner slots directly** to BD bootcamps, hosting companies and IT institutes will probably earn more than AdSense for a long time. A single ৳3,000–৳8,000/month sponsor can beat the network ad income.
5. **Stripe is not available to BD businesses** [V-secondary] ([HandyPay](https://tryhandypay.com/guides/stripe-alternative-bangladesh), [Stripe global](https://stripe.com/global)). **Lemon Squeezy lists Bangladesh for bank payouts** [V] ([LS supported countries](https://docs.lemonsqueezy.com/help/getting-started/supported-countries)). **Paddle** does not list BD as unsupported [V] ([Paddle](https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle)). Local gateways (SSLCommerz, bKash PGW, shurjoPay, aamarPay) **all need a trade license + TIN + a business bank account**.
6. Get your **e-TIN (free, online)** and a **trade license** early. Most other steps depend on them.

---

## 1. Google AdSense

### 1.1 Eligibility facts
- **Language:** Bengali (Bangla) is on the supported list [V] ([source](https://support.google.com/adsense/answer/9727)). Footnotes say some product UIs/help centres are not in Bengali. That does not affect eligibility.
- **ads.txt:** strongly recommended, not strictly mandatory. Without it you may get an "Earnings at risk" warning and lose demand [V] ([AdSense ads.txt guide](https://support.google.com/adsense/answer/12171612?hl=en)).
- **Consent (EEA/UK/Switzerland):** you must use a **Google-certified CMP integrated with IAB TCF v2.2** to serve ads to visitors from the EEA and UK (since 16 Jan 2024) and Switzerland (since 31 Jul 2024) [V] ([AdSense Help](https://support.google.com/adsense/answer/13554116?hl=en)). AdSense's built-in **Privacy & messaging → European regulations message** is certified and free [V] ([AdSense Help](https://support.google.com/adsense/answer/13790256?hl=en)). Your EU traffic will be tiny, but turn it on anyway. Without it those visitors get limited ads or none.
- Other usual requirements [U, standard AdSense policy]: owner 18+, your own top-level domain (not `*.pages.dev`), original content, a privacy policy that discloses Google cookies, and easy navigation.

### 1.2 Pre-application checklist (do all of this before you apply)
1. Buy a custom domain (e.g. `jsonbondhu.com` or `.com.bd`) and connect it to Cloudflare Pages. Do not apply with `*.pages.dev`.
2. Publish these pages in Bangla (with English where it helps): **About (আমাদের সম্পর্কে)**, **Contact (যোগাযোগ)** with a real email, **Privacy Policy (গোপনীয়তা নীতি)**, **Terms (ব্যবহারের শর্তাবলি)**.
3. The privacy policy must say that third parties, including Google, use cookies to serve ads based on prior visits, and link to Google's ad settings / `policies.google.com/technologies/ads`.
4. **Fix the "tool page with little text" problem.** Tool pages that show only an interface are a common cause of Low Value Content rejections [U] ([adstimate](https://adstimate.com/blog/low-value-content-fix.html), [yerman.uk](https://yerman.uk/adsense-low-value-checker/)). Under each tool, add 600–1,500 words of original Bangla explanation: what JSON is, how to use the tool, common errors, examples and an FAQ.
5. Publish **15–25 original Bangla articles** before applying, for example: "JSON কী?", "JSON vs XML", "JSON.parse error এর সমাধান", "JSON থেকে CSV", "API response পড়া শিখুন", "JavaScript এ JSON". Do not copy or machine-spin content.
6. Add a clear menu, a sitemap.xml and robots.txt. Verify the site in **Google Search Console** and submit the sitemap.
7. Wait until the pages are indexed and you have **some organic traffic**. Many people report approval after about 2–3 months of site age [U].
8. Keep the two ad slots out of pages that have no content. Never place ads next to the output box in a way that invites accidental clicks.
9. Test mobile speed with Lighthouse. Cloudflare Pages is fast, so keep the JS bundle small too.

### 1.3 Application steps
1. Go to `adsense.google.com` → Sign up with your Google account. Enter your site URL, country **Bangladesh**, and your payment account type (**Individual** is fine to start).
2. Fill in your name and address **exactly as on your NID and bank account**. The wire transfer name must match the bank record [V] ([AdSense wire](https://support.google.com/adsense/answer/3372975?hl=en)).
3. Paste the AdSense `<script>` snippet into the `<head>` of every page. This is a static site, so put it in the shared layout template.
4. Add **`/ads.txt`** at the domain root. On Cloudflare Pages, put it in the build output/public folder:
   `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`
   (Copy the exact line from AdSense → Sites. Your pub ID is under Account → Settings → Account information [V] ([guide](https://support.google.com/adsense/answer/12171612?hl=en)).)
5. In AdSense → Sites, click "Request review". Review usually takes days to a few weeks.
6. While you wait, set up **Privacy & messaging → European regulations message** (certified CMP) and optionally the **US state regulations** message.
7. After approval, create two **display ad units** (responsive) for the top and bottom banners. Set `min-height` on both containers so the layout does not jump (CLS).

### 1.4 Getting paid in Bangladesh
1. **Threshold:** default is **$100 or the local-currency equivalent** [V-secondary] ([AdPushup](https://www.adpushup.com/blog/google-adsense-payment/)). You also need to verify your address with a **PIN letter** once earnings pass the verification threshold (commonly $10) [U].
2. **Timeline:** earnings are finalised by the **3rd**. Payments are issued on the **21st–26th** if your balance reached the threshold by the 20th. A wire takes **up to 15 business days** [V] ([AdSense timeline](https://support.google.com/adsense/answer/7164703?hl=en)).
3. **Method:** BD publishers are generally paid by **international wire transfer (USD) to a local bank account**. You need your SWIFT/BIC and account number [V for the wire requirements; BD availability is U, check the payment methods shown in your own account] ([AdSense wire](https://support.google.com/adsense/answer/3372975?hl=en)).
4. Tips: open an account at a bank that handles inward remittance well (for example a large private bank). Tell the bank to expect Google Asia Pacific wires. Ask about a **USD-denominated account** or an ERQ account and about conversion fees [U].
5. **Tax info:** submit **US tax info (W-8BEN)** in AdSense → Payments → Settings → Manage settings → United States tax info. If you do not, Google may withhold up to **30%** on US-sourced earnings [V-secondary] ([MonetizeMore](https://www.monetizemore.com/blog/google-colecting-tax-from-adsense-accounts/)). The US–Bangladesh tax treaty may reduce withholding. Get advice before you claim a treaty article [U].
6. **Singapore tax info:** BD publishers are paid by Google Asia Pacific (Singapore) and may be asked for it. Claiming the exemption needs a **tax residency certificate** from NBR [V-secondary] ([AdSense community](https://support.google.com/adsense/thread/325552970/asking-for-singapore-tax-info-when-i-m-from-bangladesh?hl=en), [Google non-US tax info](https://support.google.com/adsense/answer/14131950?hl=en)). Leaving it blank usually only affects Singapore withholding, not your eligibility [U].
7. Re-submit W-8 forms every 3 years [V-secondary] ([MonetizeMore](https://www.monetizemore.com/blog/google-colecting-tax-from-adsense-accounts/)).

### 1.5 Common rejection reasons for tool sites (and fixes)
| Rejection | Fix |
|---|---|
| Low value content | Add long Bangla guides, examples and an FAQ to every tool page, plus a blog |
| Site down / unavailable | Make sure the apex domain and www both resolve and robots.txt does not block Googlebot |
| Policy violation / navigation | Add a visible menu, footer links to Privacy, About and Contact, and remove broken pages |
| "Google-served ads on screens without publisher content" | Keep ads off empty states, error pages and pages with only a tool |
| Duplicate/scraped content | Write everything yourself. Do not translate MDN or W3Schools word for word |

---

## 2. Alternatives (if rejected, or while you wait)

**Important BD constraints:** **PayPal cannot receive payments in Bangladesh** [U, widely known]. **Crypto payouts are illegal**: Bangladesh Bank has banned crypto transactions since 2017 and issued new warnings in 2025 [V-secondary] ([Lightspark](https://www.lightspark.com/knowledge/is-crypto-legal-in-bangladesh), [Disruption Banking](https://www.disruptionbanking.com/2025/12/03/bangladeshs-crypto-boom-that-refuses-to-be-banned/)). Use **bank wire or Payoneer** only.

| Network | Accepts small/new site? | Bangla content? | Pays BD? | Notes |
|---|---|---|---|---|
| **Ezoic** | **No** for new sign-ups: **250k+ monthly users** needed since 19 Feb 2026. Smaller sites can try the **Incubator** [V] ([Ezoic](https://support.ezoic.com/kb/article/getting-started-ezoics-requirements?id=getting-started-ezoics-requirements&lang=en-US)) | Yes, if the language is AdSense-supported [V] (same source) | Payoneer/bank [U] | Not realistic at launch |
| **Media.net** | Weak fit | **English only**, mostly US/UK/CA traffic [V-secondary] ([usro.net](https://blog.usro.net/2024/11/media-net-requirements-for-publishers/)) | [U] | Skip |
| **Adsterra** | Yes, no traffic minimum [U] | Yes | Payoneer/Paxum/wire (wire min $1,000). Local bank transfer from $50 in 40+ currencies, BD not confirmed [V-secondary] ([Adsterra blog](https://adsterra.com/blog/adsterra-minimum-payout-for-publishers/)) | Low-quality ads (popunders, social bar). **Use banner/native formats only.** Pop-unders will put off developers |
| **PropellerAds** | Yes [U] | Yes | **Payoneer min $20**, wire min $500 [V-secondary] ([Payoneer](https://www.payoneer.com/resources/business/propellerads/)) | Mostly push/pop formats. Same quality warning |
| **Carbon Ads** (BuySellAds) | ~**50k monthly page views**, curated, developer/design audience, 60% revenue share [V-secondary] ([Carbon FAQ](https://www.carbonads.net/faq), [Ghost Ads](https://blog.ghostads.io/blog/best-adsense-alternatives-2026/)) | Unclear; advertisers target English devs [U] | PayPal $20 / wire $500 + $35 fee [V-secondary] | Best brand fit later. Wire is the only BD option |
| **EthicalAds** | **≥ 50k page views/month** (exceptions for fast growth) [V] ([EthicalAds FAQ](https://www.ethicalads.io/publishers/faq/)) | [U] probably English-focused | Min payout $50, 70% share [V-secondary] ([Ghost Ads](https://blog.ghostads.io/blog/best-adsense-alternatives-2026/)); method [U] | CPM ~$2.50 **for EU/NA traffic**. BD traffic will earn much less [V] |
| **BuySellAds marketplace** | No traffic minimum to list [V-secondary] ([BSA](https://discover.buysellads.com/carbon)) | Yes | wire [U] | Few buyers for BD-audience inventory |
| **BD Ads Network** (local) | Claims CPM/CPC network for BD publishers [U] ([bdadsnetwork.com](https://bdadsnetwork.com/)) | Yes | Local [U] | Not vetted. Check reputation in FB groups first |

**Recommended order:** AdSense → (while pending) **direct sponsors** (Section 3) → Adsterra banners only if you must → Carbon/EthicalAds once you pass 50k page views with some English traffic.

---

## 3. Selling ads directly to Bangladeshi companies

For a developer audience, direct deals usually pay much more per slot than network ads from BD traffic. Your advantage is simple: *every visitor is a developer or CS student in Bangladesh.*

### 3.1 Target list (build a spreadsheet of 50)
1. **Bootcamps / IT training:** programming course platforms, BITM, Creative IT, ed-tech YouTube channels, university coaching.
2. **Hosting/domain providers:** local web hosting and cloud resellers.
3. **Software firms that are hiring:** employer-branding and "we're hiring" banners.
4. **Dev tools / SaaS built in BD:** payment gateways (developer docs campaigns), SMS APIs, cloud providers.
5. **Job boards / tech events:** hackathons, tech conferences, community meetups.
Find contacts via LinkedIn, Facebook pages and company websites (marketing@ / hr@).

### 3.2 Rate card (starting point, raise as traffic grows)
| Slot | Flat monthly (BDT) | CPM option |
|---|---|---|
| Top banner (728×90 desktop / 320×100 mobile), sitewide | ৳3,000 – ৳8,000 | ৳150–৳300 per 1,000 impressions |
| Bottom banner, sitewide | ৳1,500 – ৳4,000 | ৳80–৳150 per 1,000 |
| Both slots, exclusive ("Sponsored by X") | ৳5,000 – ৳12,000 | — |
| Sponsored Bangla tutorial / blog post | ৳2,000 – ৳5,000 one-off | — |
These numbers are my estimate for a new site, not market data [U]. Give 3-month deals a 15–20% discount. Always offer a **free 2-week trial** to the first 2–3 sponsors so you have case studies.

**How it works technically (static site):** serve direct ads from a small JSON config (`ads.json` in the repo). Rotate slots client-side. Track clicks with UTM links (`?utm_source=jsonbondhu&utm_medium=banner`) and impressions with Cloudflare Web Analytics or a privacy-friendly counter. Fall back to AdSense when a slot is unsold.

### 3.3 Media kit outline (1–2 page PDF in Bangla + English)
1. What JSON বন্ধু is (one line) + screenshot
2. Audience: monthly page views, users, % Bangladesh, % mobile, top cities (from Cloudflare/GA4)
3. Who uses it: students, junior/mid developers, freelancers
4. Ad slots: sizes, placement screenshots, and how many sponsors share each slot
5. Prices (the rate card) + package deals
6. Rules: no gambling, betting, adult content, crypto or MLM. Creative specs (PNG/WebP, <150 KB, no auto-play)
7. Reporting: a monthly impressions/clicks screenshot
8. Contact + payment methods

### 3.4 Outreach email template (Bangla)
```
বিষয়: বাংলাদেশি ডেভেলপারদের কাছে পৌঁছান — JSON বন্ধু-তে স্পনসরশিপ

আসসালামু আলাইকুম / শুভেচ্ছা [নাম] ভাই/আপু,

আমি [আপনার নাম], "JSON বন্ধু" (jsonbondhu.com)-এর নির্মাতা — বাংলা ভাষায় প্রথম
ফ্রি অনলাইন JSON ফরম্যাটার, ভিউয়ার ও কনভার্টার। প্রতি মাসে [X] জন ডেভেলপার ও
CS শিক্ষার্থী আমাদের টুল ব্যবহার করেন, যাদের [Y]% বাংলাদেশ থেকে।

[কোম্পানির নাম]-এর [কোর্স/হোস্টিং/নিয়োগ] ঠিক এই অডিয়েন্সের জন্যই। আমরা সাইটের
উপরের ব্যানারটি মাসিক ৳[মূল্য]-তে একটি মাত্র স্পনসরকে দিচ্ছি। প্রথম ২ সপ্তাহ
ফ্রি ট্রায়াল — ফলাফল (ইমপ্রেশন ও ক্লিক) দেখে তারপর সিদ্ধান্ত নিন।

মিডিয়া কিট সংযুক্ত করলাম। ১০ মিনিটের একটি কল বা মিটিং কি সম্ভব?

ধন্যবাদান্তে,
[নাম] | [ফোন] | [ইমেইল]
JSON বন্ধু — https://jsonbondhu.com
```
Follow up once after 5–7 days. Also send the same message through the company's Facebook page, where many BD SMEs reply faster.

### 3.5 Invoicing & collecting payment
1. Send a simple invoice (Google Docs/Sheets template) with an invoice no., date, client name, slot and period, amount in BDT, and payment details. If you have a trade license, add the license no. and TIN.
2. Collect via **bank transfer (BEFTN/NPSB)** to your account. Or use a **bKash/Nagad merchant or "Personal Retail" account**. bKash offers a Personal Retail Account for people without a trade license [V-secondary] ([bKash business](https://www.bkash.com/en/business/merchant), summary via [bizmend](https://bizmend.com/blog/bkash-merchant-account-register-and-get-payment/)). Avoid collecting business payments into a personal send-money wallet; it breaks MFS terms and caps [U].
3. Take **payment in advance** each month and start the campaign only after it clears.
4. Larger companies may deduct **AIT/VDS (source tax)** from your invoice and ask for a TIN/BIN. Keep their deduction certificates for your return [U, confirm with a tax advisor].

---

## 4. "Remove ads" one-time payment

### 4.1 Options compared
| Gateway | BD merchant OK? | Needs | Buyers | Notes |
|---|---|---|---|---|
| **SSLCommerz** | Yes | **Trade license, NID, TIN, bank account + cheque leaf, DBID, signed MEF**, photo [V] ([SSLCommerz onboarding](https://sslcommerz.com/onboarding-requirements/)). Show the trade license/TIN no. on the site footer or About page [V-secondary] | Local cards, bKash, Nagad, net banking | Biggest aggregator. Pricing is not public; ask sales [V] |
| **bKash PGW (tokenized checkout)** | Yes | Trade license, NID, TIN, business bank account, website URL; 1–3 weeks [V-secondary] ([bKash online business](https://www.bkash.com/en/business/online-business)) | bKash only | Most users have bKash. Good as the single option at launch |
| **shurjoPay** | Yes | Application form, trade license, stamped sub-merchant agreement (৳300 stamp), TIN/VAT cert, NID, photos, separate bank account [V-secondary] ([shurjoPay T&C](https://shurjopay.com.bd/terms-shurjopay-merchant-register)) | Cards, MFS | — |
| **aamarPay** | Yes | Trade license, TIN, business bank account [V-secondary] ([WHMCS listing](https://marketplace.whmcs.com/product/5185-aamarpay-for-whmcs)) | Cards, MFS | Setup fee reportedly **৳4,999–৳15,999** by plan [U] ([ARN Tech](https://arntechbd.com/blog/payment-gateways-in-bangladesh/)) |
| **Stripe** | **No**, BD is not a supported merchant country (as of mid-2026) [V-secondary] ([HandyPay](https://tryhandypay.com/guides/stripe-alternative-bangladesh), [Stripe global](https://stripe.com/global)) | A US LLC workaround exists. Not worth it for this | — | Skip |
| **Lemon Squeezy** (MoR, owned by Stripe) | **Bangladesh is listed for bank payouts** [V] ([LS countries](https://docs.lemonsqueezy.com/help/getting-started/supported-countries)) | Identity verification, live site, refund policy | International cards (not bKash) | Still takes sign-ups, but Stripe is moving merchants to "Stripe Managed Payments" [V] ([LS 2026 update](https://www.lemonsqueezy.com/blog/2026-update)). Long-term future is uncertain |
| **Paddle** (MoR) | BD not on the unsupported list [V] ([Paddle](https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle)) | Software business review; may reject very small sellers [U] | International cards | Handles global VAT for you |

### 4.2 Recommended path
1. **Launch without a gateway.** Offer "remove ads" by **manual bKash/Nagad payment plus an unlock code** (enter the TrxID in a form and you email a code). This is fine at low volume, but see the MFS caution in §3.5.
2. For a static site, save the unlock as a signed token in `localStorage`. Verify the signature client-side (HMAC or Ed25519 public key), or use a tiny **Cloudflare Pages Function / Worker** to check it. Accept that some people will bypass it; this is a goodwill purchase, not DRM.
3. Once you have a trade license + TIN + business bank account, apply to **bKash PGW** first, then **SSLCommerz** for cards.
4. For international buyers, add **Lemon Squeezy** (or Paddle). Price in USD ($3–$5). Local price could be ৳199–৳299 one-time [U, suggestion].
5. Publish a **Refund Policy** and **Terms** page. Gateways and MoRs check for these.

---

## 5. Legal & compliance basics in Bangladesh

Consult a tax lawyer or chartered accountant before filing. The list below is a practical overview, not legal advice.

1. **e-TIN:** free, online, takes minutes. You need your NID, mobile and email. Apply at `secure.incometax.gov.bd` [V] ([NBR e-TIN](https://secure.incometax.gov.bd/TINHome)). File an annual return once you earn.
2. **Trade license:** from your City Corporation / Pourashava / Union Parishad. Dhaka North and South have online e-trade license portals. The fee depends on business type and area [U]. Almost every gateway requires it.
3. **DBID (Digital Business Identification):** required for digital-commerce businesses and listed by SSLCommerz. Apply online at [dbid.gov.bd](https://dbid.gov.bd/application-info) [V-secondary] ([LegalSeba](https://legalseba.com/bd-services/digital-business-id-dbid-registration-in-bangladesh/)).
4. **Business bank account** in the trade-license name. Needed for gateways and to receive AdSense wires cleanly.
5. **Income tax:** income from qualifying **IT/ITES services** is **100% exempt from 1 Jul 2024 to 30 Jun 2027** if received through banking channels [V-secondary] ([LegalSeba ITES](https://legalseba.com/bd-resources/tax-exemption-for-information-technology-enabled-services-ites-in-bangladesh/), [nsave](https://www.nsave.com/bangladesh/income-tax)). Whether ad income from your own website counts as "ITES" is **[U]**. The **Budget 2026-27 (proposed June 2026)** would exempt **all freelancing and content-creation income** and set **0% turnover tax for tech startups** [V] ([BSS](https://www.bssnews.net/national-budget-2026-2027/394849), [Daily Star](https://www.thedailystar.net/business/bangladesh-budget-2026-27/news/relief-low-income-groups-businesses-4196771)). Check the final Finance Act 2026. Either way, **bring all income in through a bank** and still file your return.
6. **VAT:** small businesses under the turnover-tax threshold (commonly cited: under ৳50 lakh/year exempt; ৳50 lakh–3 crore pay turnover tax) usually do not need full VAT registration [U]. Selling **advertising space** may count as a VAT-able service, and corporate clients may deduct VDS [U]. Get a **BIN** only when a client or gateway requires it.
7. **Privacy policy:** Bangladesh's personal data protection law (Personal Data Protection Ordinance 2025) is new and its enforcement status is **[U]**. In practice, follow Google's policy requirements (§1.2), be GDPR-friendly through the CMP, and say that JSON you paste is **processed only in the browser and never uploaded**, if that is true. That promise is itself a selling point.
8. Keep a simple ledger (Google Sheet) of every ad deal, AdSense payment, bank credit and invoice.

---

## 6. Realistic revenue expectations

### 6.1 RPM reality
- South Asian traffic (BD, PK, NP) often has an AdSense RPM **below $1** [U-secondary] ([techconda](https://www.techconda.com/2026/02/adsense-rpm-benchmarks.html), [Medium](https://medium.com/@dutta.rajib/the-unspoken-truth-about-adsense-earnings-why-a-us-visitor-is-worth-50x-one-from-india-25d7d67bf9c7)).
- Developer audiences use **ad blockers heavily**. Assume 25–40% of page views show no ads [U].
- Tool pages have **short visits and few page views per visit**, which is bad for ad income.
- Working assumption for JSON বন্ধু: **page RPM $0.30 (pessimistic) / $0.70 (base) / $1.50 (optimistic)** [U, estimate].

### 6.2 Page views needed for ৳10,000/month (≈ $81)
| Page RPM | Page views/month needed (ads only) |
|---|---|
| $0.30 | ~270,000 |
| $0.70 | ~116,000 |
| $1.50 | ~54,000 |
Compare: **one direct sponsor at ৳5,000–৳8,000/month** can cover half or more of that goal with only 10–20k monthly page views. **Go after direct sales first.**

"Remove ads" at ৳249 × 1% of 10k monthly users ≈ ৳25,000 **in total**, not per month. Expect conversion well under 1% for a free tool [U]. Treat it as a bonus.

### 6.3 Growth checklist
1. **Bangla SEO:** target keywords such as "JSON ফরম্যাট", "JSON কি", "JSON ভিউয়ার", "JSON থেকে Excel", "API কি", "JSON error সমাধান". Also target mixed Banglish queries ("json formatter bangla"). Use one URL per tool with a Bangla title and meta description, and add FAQ schema.
2. **Add more tools** to catch more searches: JSON↔CSV/Excel, JSON↔YAML, JSON Schema validator, JWT decoder, Base64, URL encode, regex tester, and a Bangla↔Unicode/Bijoy converter (high demand locally [U]).
3. **Facebook groups:** share useful posts, not spam, in BD developer groups (e.g. Programming Hero community, JS Bangladesh, Python Bangladesh, CSE student groups). Share short "JSON tip" images.
4. **YouTube (Bangla):** make 5–10 minute tutorials ("API থেকে আসা JSON কিভাবে পড়বেন") that use the tool on screen and link to it. Shorts and Reels work well too.
5. **Partnerships:** offer bootcamps a free "Recommended by [Bootcamp]" badge in exchange for linking to you from their course material. This can later turn into a paid sponsorship.
6. **University reach:** CSE club events, and ask teachers to recommend the site in labs.
7. Launch on Product Hunt, Hacker News "Show HN", dev.to and r/bangladesh. Some foreign traffic will raise RPM.
8. **Keep English UI as a toggle.** English pages can rank globally and pull higher-RPM traffic.
9. Track page views, sources and RPM monthly. Review pricing every quarter.

---

## Master action plan (in order)
1. [ ] Register domain → Cloudflare Pages → Search Console + sitemap.
2. [ ] Write About/Contact/Privacy/Terms/Refund pages in Bangla.
3. [ ] Add Bangla guide text + FAQ under every tool. Publish 15–25 articles.
4. [ ] Get **e-TIN** (online, free). Start the **trade license** + business bank account.
5. [ ] Build the media kit + rate card and email 20 target sponsors (first 2 get a free trial).
6. [ ] Apply to AdSense once content and organic traffic exist. Add ads.txt and the certified CMP message.
7. [ ] Submit W-8BEN in AdSense and keep bank/SWIFT details ready.
8. [ ] Launch "remove ads" with a manual bKash unlock → apply for bKash PGW / SSLCommerz after the trade license.
9. [ ] Add Lemon Squeezy/Paddle for international buyers (optional).
10. [ ] Apply to Carbon/EthicalAds after 50k page views/month.
