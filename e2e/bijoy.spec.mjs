import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/bijoy-unicode/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('pasted Bijoy text shows as Unicode by default', async ({ page }) => {
  await page.fill('#bj-in', 'Avwg evsjvq Mvb MvB');
  const out = await page.inputValue('#bj-out');
  expect(out.normalize('NFD')).toBe('আমি বাংলায় গান গাই'.normalize('NFD'));
  await page.fill('#bj-in', 'wKš‘');
  await expect(page.locator('#bj-out')).toHaveValue('কিন্তু');
  await expect(page.locator('#status')).toContainText('→');
});

test('Unicode to Bijoy, swap and clear', async ({ page }) => {
  await page.click('[data-act=u2b]');
  await expect(page.locator('[data-act=u2b]')).toHaveAttribute('aria-pressed', 'true');
  await page.fill('#bj-in', 'বাংলা');
  await expect(page.locator('#bj-out')).toHaveValue('evsjv');
  await page.click('[data-act=swap]');
  await expect(page.locator('[data-act=b2u]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#bj-in')).toHaveValue('evsjv');
  await expect(page.locator('#bj-out')).toHaveValue('বাংলা');
  await page.click('[data-act=clear]');
  await expect(page.locator('#bj-in')).toHaveValue('');
  await expect(page.locator('#bj-out')).toHaveValue('');
});

test('sample button loads text for the current direction', async ({ page }) => {
  await page.click('[data-act=sample]');
  await expect(page.locator('#bj-in')).toHaveValue('Avwg evsjvq Mvb MvB');
  await page.click('[data-act=u2b]');
  await page.click('[data-act=sample]');
  await expect(page.locator('#bj-out')).toHaveValue('Avwg evsjvq Mvb MvB');
});

test('hint appears for Bijoy text in the wrong direction and switches in one click', async ({ page }) => {
  await page.click('[data-act=u2b]');
  await page.fill('#bj-in', 'Avwg evsjvq Mvb MvB');
  await expect(page.locator('#bj-hint')).toBeVisible();
  await page.click('[data-act=hint-switch]');
  await expect(page.locator('[data-act=b2u]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#bj-hint')).toBeHidden();
  expect((await page.inputValue('#bj-out')).normalize('NFD')).toBe('আমি বাংলায় গান গাই'.normalize('NFD'));
});

test('hint appears for Unicode text in the Bijoy direction', async ({ page }) => {
  await page.fill('#bj-in', 'আমি বাংলায় গান গাই');
  await expect(page.locator('#bj-hint')).toBeVisible();
  await page.click('[data-act=hint-switch]');
  await expect(page.locator('#bj-out')).toHaveValue('Avwg evsjvq Mvb MvB');
});

test('download saves the converted text', async ({ page }) => {
  await page.fill('#bj-in', 'evsjv');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=download]')]);
  expect(dl.suggestedFilename()).toBe('unicode.txt');
});

test('language switch updates labels, hint and title', async ({ page }) => {
  await page.click('[data-set-lang=bn]');
  await expect(page.locator('[data-act=b2u]')).toHaveText('বিজয় → ইউনিকোড');
  await expect(page.locator('#bj-in-label')).toHaveText('বিজয় লেখা (সুতন্বী এমজে)');
  await expect(page).toHaveTitle(/বিজয়/);
  await expect(page.locator('article.content section[data-lang=bn]')).toBeVisible();
  await expect(page.locator('article.content section[data-lang=en]')).toBeHidden();
});

test('has canonical, hreflang and a short title and description', async ({ page }) => {
  expect((await page.title()).length).toBeLessThanOrEqual(60);
  // Crawlers read the static HTML; i18n.js swaps the live tag for the short tool blurb.
  const html = await (await page.request.get('/bijoy-unicode/')).text();
  const desc = html.match(/<meta name="description" content="([^"]*)"/)[1];
  expect(desc.length).toBeGreaterThanOrEqual(120);
  expect(desc.length).toBeLessThanOrEqual(155);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://jsonbondhu.irmaoshop.com/bijoy-unicode/');
  await expect(page.locator('link[rel=alternate][hreflang=bn]')).toHaveCount(1);
});

test('makes no network requests after load and has no console errors', async ({ page }) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/bijoy-unicode/');
  page.on('request', (r) => { if (!r.url().includes('/api/ads')) requests.push(r.url()); });
  await page.fill('#bj-in', 'Kg© `yb©xwZ');
  await page.click('[data-act=swap]');
  await page.waitForTimeout(300);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
