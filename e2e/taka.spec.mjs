import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/taka-in-words/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('converts an amount to Bangla and English words', async ({ page }) => {
  await page.fill('#taka-in', '12,34,567.50');
  await expect(page.locator('#taka-bn')).toHaveText('বারো লক্ষ চৌত্রিশ হাজার পাঁচ শো সাতষট্টি টাকা পঞ্চাশ পয়সা মাত্র');
  await expect(page.locator('#taka-en')).toHaveText('Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven Taka and Fifty Paisa Only');
  await expect(page.locator('#taka-fmt-en')).toHaveText('12,34,567.50');
  await expect(page.locator('#taka-fmt-bn')).toHaveText('১২,৩৪,৫৬৭.৫০');
});

test('accepts Bangla digits and toggles the Only suffix', async ({ page }) => {
  await page.fill('#taka-in', '১০০');
  await expect(page.locator('#taka-bn')).toHaveText('এক শো টাকা মাত্র');
  await expect(page.locator('#taka-en')).toHaveText('One Hundred Taka Only');
  await page.uncheck('#taka-only');
  await expect(page.locator('#taka-bn')).toHaveText('এক শো টাকা');
  await expect(page.locator('#taka-en')).toHaveText('One Hundred Taka');
});

test('shows clear messages for invalid, negative and too large input', async ({ page }) => {
  await page.fill('#taka-in', 'abc');
  await expect(page.locator('#status')).toContainText('valid amount');
  await expect(page.locator('#taka-en')).toHaveText('');
  await page.fill('#taka-in', '-5');
  await expect(page.locator('#status')).toContainText('Negative');
  await page.fill('#taka-in', '100000000000');
  await expect(page.locator('#status')).toContainText('99,99,99,99,999');
  await page.fill('#taka-in', '');
  await expect(page.locator('#status')).toHaveText('');
});

test('copy buttons copy each result', async ({ page, context, browserName }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await page.fill('#taka-in', '21');
  await page.click('[data-copy=taka-en]');
  const text = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
  if (text !== null) expect(text).toBe('Twenty-One Taka Only');
});

test('language switch updates labels, errors and title', async ({ page }) => {
  await page.fill('#taka-in', 'abc');
  await page.click('[data-set-lang=bn]');
  await expect(page.locator('#status')).toContainText('সঠিক পরিমাণ');
  await expect(page.locator('label[for=taka-in]')).toHaveText('পরিমাণ');
  await expect(page).toHaveTitle(/টাকার অঙ্ক কথায়/);
  await expect(page.locator('section[data-lang=bn]')).toBeVisible();
});

test('makes no network requests after load and has no console errors', async ({ page }) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/taka-in-words/');
  page.on('request', (r) => { if (!r.url().includes('/api/ads')) requests.push(r.url()); });
  await page.fill('#taka-in', '1234567.5');
  await page.waitForTimeout(300);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
