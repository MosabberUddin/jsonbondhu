// Every guide in the registry (public/guides/guides.js) must exist, be bilingual,
// link only to real pages and fit a phone screen.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const registry = readFileSync(new URL('../public/guides/guides.js', import.meta.url), 'utf8');
const SLUGS = [...registry.matchAll(/\{ slug: '([a-z0-9-]+)'/g)].map((m) => m[1]);

const ignorable = (msg) => /api\/ads|Failed to load resource/.test(msg);

test('guides index lists every guide', async ({ page }) => {
  await page.goto('/guides/');
  await expect(page.locator('[data-guide-grid] .guide-card')).toHaveCount(SLUGS.length);
  const hrefs = await page.locator('[data-guide-grid] .guide-card').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  expect(hrefs).toEqual(SLUGS.map((s) => `/guides/${s}/`));
});

test('every page header links to the guides', async ({ page }) => {
  for (const path of ['/', '/json-formatter/', '/uuid-generator/', '/privacy.html']) {
    await page.goto(path);
    await expect(page.locator('.top-nav a[href="/guides/"]'), path).toHaveCount(1);
  }
});

for (const slug of SLUGS) {
  test.describe(`guide: ${slug}`, () => {
    test('is complete in English and Bangla', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
      await page.goto(`/guides/${slug}/`);
      await page.evaluate(() => localStorage.clear());
      await page.goto(`/guides/${slug}/?lang=en`);

      for (const lang of ['en', 'bn']) {
        if (lang === 'bn') await page.click('[data-set-lang=bn]');
        const keyTitle = await page.evaluate((s) => window.JBI18N.t(`guide.${s}.title`), slug);
        await expect(page).toHaveTitle(keyTitle);
        await expect(page.locator('h1:visible')).toHaveCount(1);
        const article = page.locator(`article[data-lang="${lang}"]`);
        await expect(article).toBeVisible();
        await expect(page.locator(`article[data-lang="${lang === 'en' ? 'bn' : 'en'}"]`)).toBeHidden();
        await expect(article.locator('.byline')).not.toBeEmpty();
        await expect(article.locator('.try-tool a.button')).toHaveCount(1);
        expect((await article.innerText()).length, `${lang} length`).toBeGreaterThan(2500);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${lang} horizontal overflow`).toBeLessThanOrEqual(0);
      }
      await expect(page.locator('[data-related-guides] .guide-card')).toHaveCount(4);
      expect(errors).toEqual([]);
    });

    test('has valid metadata and only working internal links', async ({ page, request }) => {
      await page.goto(`/guides/${slug}/`);
      await expect(page.locator('html')).toHaveAttribute('data-guide', slug);
      await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://jsonbondhu.irmaoshop.com/guides/${slug}/`);
      const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
      expect(ld['@type']).toBe('TechArticle');
      const links = await page.locator('main a[href^="/"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href').split('#')[0]))]);
      for (const href of links) {
        const res = await request.get(href);
        expect(res.status(), href).toBe(200);
      }
    });
  });
}
