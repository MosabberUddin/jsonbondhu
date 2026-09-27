import { test, expect } from '@playwright/test';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test.beforeEach(async ({ page }) => {
  await page.goto('/uuid-generator/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('generates v4 UUIDs on load', async ({ page }) => {
  const lines = (await page.inputValue('#uuid-out')).split('\n');
  expect(lines).toHaveLength(5);
  for (const l of lines) expect(l).toMatch(UUID_V4);
  expect(new Set(lines).size).toBe(5);
  await expect(page.locator('#status')).toHaveText('5 UUIDs generated');
});

test('bulk v7 IDs are unique and strictly increasing', async ({ page }) => {
  await page.check('input[name=uuid-version][value="7"]');
  await page.fill('#uuid-count', '200');
  await page.click('[data-act=generate]');
  const lines = (await page.inputValue('#uuid-out')).split('\n');
  expect(lines).toHaveLength(200);
  for (const l of lines) expect(l).toMatch(UUID_V7);
  expect([...lines].sort()).toEqual(lines);
  expect(new Set(lines).size).toBe(200);
});

test('format options and count limit', async ({ page }) => {
  await page.check('#uuid-upper');
  await page.uncheck('#uuid-hyphens');
  await page.check('#uuid-braces');
  const first = (await page.inputValue('#uuid-out')).split('\n')[0];
  expect(first).toMatch(/^\{[0-9A-F]{32}\}$/);
  await page.fill('#uuid-count', '5000');
  await page.click('[data-act=generate]');
  await expect(page.locator('#uuid-count')).toHaveValue('1000');
});

test('validates UUIDs and reads v7 creation time', async ({ page }) => {
  await page.fill('#uuid-check', '018bcfe5-6800-7000-8000-000000000000');
  await expect(page.locator('#uuid-result')).toContainText('Valid');
  await expect(page.locator('#uuid-result')).toContainText('2023-11-14T22:13:20.000Z');
  await page.fill('#uuid-check', 'nope');
  await expect(page.locator('#uuid-result')).toContainText('Not a valid UUID');
});

test('language switch updates labels and results', async ({ page }) => {
  await page.fill('#uuid-check', '550e8400-e29b-41d4-a716-446655440000');
  await page.click('[data-set-lang=bn]');
  await expect(page.locator('[data-act=generate]')).toHaveText('তৈরি করুন');
  await expect(page.locator('#uuid-result')).toContainText('সঠিক');
  await expect(page.locator('#status')).toHaveText('৫টি UUID তৈরি হয়েছে');
  await expect(page).toHaveTitle(/UUID জেনারেটর/);
});

test('makes no network requests after load and has no console errors', async ({ page }) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/uuid-generator/');
  page.on('request', (r) => { if (!r.url().includes('/api/ads')) requests.push(r.url()); });
  await page.click('[data-act=generate]');
  await page.fill('#uuid-check', '550e8400-e29b-41d4-a716-446655440000');
  await page.waitForTimeout(300);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
