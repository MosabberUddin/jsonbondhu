// Hub page (tool catalogue), shared navigation, and the 404 page.
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('lists every tool with a working link', async ({ page }) => {
  const cards = page.locator('[data-tool-grid] .tool-card');
  await expect(cards).toHaveCount(13);
  const hrefs = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  for (const href of hrefs) {
    const res = await page.request.get(href);
    expect(res.status(), href).toBe(200);
  }
});

test('search filters tools in either language', async ({ page }) => {
  await page.fill('#tool-search', 'jwt');
  await expect(page.locator('.tool-card:visible')).toHaveCount(1);
  await expect(page.locator('.tool-card:visible')).toContainText('JWT Decoder');
  await page.fill('#tool-search', 'টাইমস্ট্যাম্প');
  await expect(page.locator('.tool-card:visible')).toHaveCount(1);
  await page.fill('#tool-search', 'zzzz');
  await expect(page.locator('.tool-card:visible')).toHaveCount(0);
  await expect(page.locator('#tool-empty')).toBeVisible();
  await page.fill('#tool-search', '');
  await expect(page.locator('.tool-card:visible')).toHaveCount(13);
});

test('switches the hub to Bangla', async ({ page }) => {
  await page.click('[data-set-lang=bn]');
  await expect(page.locator('h1')).toHaveText('আপনার ডেটার প্রতি শ্রদ্ধাশীল ডেভেলপার টুল');
  await expect(page.locator('.tool-card').first()).toContainText('JSON ফরম্যাটার');
  await expect(page.locator('[data-year]')).toHaveText(/^[০-৯]{4}$/);
  await expect(page).toHaveTitle(/JSON বন্ধু/);
});

test('tool pages link back to the hub and to other tools', async ({ page }) => {
  await page.goto('/json-formatter/');
  await expect(page.locator('[data-more-tools] .tool-card')).toHaveCount(12);
  await page.click('.top-nav a[href="/"]');
  await expect(page).toHaveURL(/\/$/);
});

test('premium link from a tool page lands on the hub section', async ({ page }) => {
  await page.goto('/uuid-generator/');
  await page.click('.top-nav a.pill');
  await expect(page.locator('#premium')).toBeInViewport();
});

test('unknown pages show the not-found page', async ({ page }) => {
  await page.goto('/404.html');
  await expect(page.locator('h1:visible')).toHaveText('Page not found');
  await expect(page.locator('[data-more-tools] .tool-card')).toHaveCount(13);
});

test('no console errors and no horizontal scroll on the hub', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
