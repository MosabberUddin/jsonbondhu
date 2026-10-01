import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/regex-tester/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('loads the email example with highlighted matches and a list', async ({ page }) => {
  await expect(page.locator('#rx-highlight mark')).toHaveCount(2);
  await expect(page.locator('#rx-highlight mark').first()).toHaveText('hello@example.com');
  await expect(page.locator('#status')).toHaveText('2 matches');
  await expect(page.locator('#rx-matches tr')).toHaveCount(3);
});

test('live matching, flags and groups', async ({ page }) => {
  await page.fill('#rx-pattern', '(?<word>b[a-z]+)');
  await page.fill('#rx-text', 'Bat bit bot');
  await expect(page.locator('#status')).toHaveText('2 matches');
  await page.check('#rx-flags input[value=i]');
  await expect(page.locator('#status')).toHaveText('3 matches');
  await expect(page.locator('#rx-matches')).toContainText('word: "Bat"');
  await expect(page.locator('#rx-matches')).toContainText('1: "Bat"');
  await page.uncheck('#rx-flags input[value=g]');
  await expect(page.locator('#status')).toHaveText('1 match');
});

test('invalid pattern shows a clear error', async ({ page }) => {
  await page.fill('#rx-pattern', '(abc');
  await expect(page.locator('#rx-error')).toBeVisible();
  await expect(page.locator('#rx-error')).toContainText('Invalid pattern');
  await page.fill('#rx-pattern', 'abc');
  await expect(page.locator('#rx-error')).toBeHidden();
});

test('replace preview with $1 and $<name>', async ({ page }) => {
  await page.click('[data-preset=date]');
  await expect(page.locator('#rx-replace-out')).toHaveValue(/Launched on 26\/03\/2026, updated 01\/12\/2026\./);
  await page.fill('#rx-replace', '$3.$2.$1');
  await expect(page.locator('#rx-replace-out')).toHaveValue(/26\.03\.2026/);
});

test('Bangladeshi mobile preset', async ({ page }) => {
  await page.click('[data-preset=phone]');
  await expect(page.locator('#rx-highlight mark')).toHaveCount(2);
  await expect(page.locator('#rx-highlight mark').nth(1)).toHaveText('+8801812345678');
});

test('user text is never interpreted as HTML', async ({ page }) => {
  await page.fill('#rx-pattern', '<b>.*</b>');
  await page.fill('#rx-text', 'x <b>bold</b> <img src=x onerror="window.__xss=1">');
  await expect(page.locator('#rx-highlight mark')).toHaveText('<b>bold</b>');
  await expect(page.locator('#rx-highlight img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

test('caps matches and survives empty-match patterns', async ({ page }) => {
  await page.fill('#rx-pattern', 'a');
  await page.fill('#rx-text', 'a'.repeat(3000));
  await expect(page.locator('#rx-warn')).toContainText('first 1,000 matches');
  await expect(page.locator('#rx-matches tr')).toHaveCount(1001);
  await page.fill('#rx-pattern', 'x*');
  await page.fill('#rx-text', 'abc');
  await expect(page.locator('#status')).toHaveText('4 matches');
});

test('language switch updates labels', async ({ page }) => {
  await page.click('[data-set-lang=bn]');
  await expect(page.locator('#rx-pattern')).toHaveAttribute('placeholder', /স্ল্যাশ/);
  await expect(page.locator('[data-preset=email]')).toHaveText('ইমেইল');
  await expect(page.locator('#status')).toHaveText('২টি মিল');
  await expect(page).toHaveTitle(/রেজেক্স টেস্টার/);
});

test('makes no network requests after load and has no console errors', async ({ page }) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/regex-tester/');
  page.on('request', (r) => { if (!r.url().includes('/api/ads')) requests.push(r.url()); });
  await page.fill('#rx-pattern', '[0-9]+');
  await page.fill('#rx-text', 'a1 b22');
  await page.waitForTimeout(300);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
