import { test, expect } from '@playwright/test';

// Fixed clock (2023-11-14T22:13:20Z) and a non-Dhaka local zone, so the
// "Your time" and "Dhaka" rows differ and all output is deterministic.
const NOW = 1700000000;
test.use({ timezoneId: 'America/New_York' });

const cell = (page, table, row) => page.locator(`${table} tr[data-row=${row}] .ts-val`);

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW * 1000);
  await page.goto('/timestamp-converter/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('shows the current Unix time and pre-fills the converter', async ({ page }) => {
  await expect(page.locator('#ts-now-s')).toHaveText(String(NOW));
  await expect(page.locator('#ts-now-ms')).toHaveText(String(NOW * 1000));
  await expect(page.locator('#ts-input')).toHaveValue(String(NOW));
  await expect(cell(page, '#ts-result', 'relative')).toHaveText('now');
});

test('converts seconds to UTC, local, Dhaka, ISO, RFC 2822 and HTTP date', async ({ page }) => {
  await page.fill('#ts-input', '1700000000');
  await expect(page.locator('#ts-status')).toContainText('Assumed seconds (auto-detected from 10 digits)');
  await expect(cell(page, '#ts-result', 'utc')).toHaveText('Tue, 14 Nov 2023, 22:13:20 UTC');
  await expect(cell(page, '#ts-result', 'local')).toHaveText('Tue, 14 Nov 2023, 17:13:20 GMT-5');
  await expect(page.locator('#ts-result tr[data-row=local] th')).toHaveText('Your time (America/New_York)');
  await expect(cell(page, '#ts-result', 'dhaka')).toHaveText('Wed, 15 Nov 2023, 04:13:20 GMT+6');
  await expect(cell(page, '#ts-result', 'iso')).toHaveText('2023-11-14T22:13:20.000Z');
  await expect(cell(page, '#ts-result', 'rfc2822')).toHaveText('Tue, 14 Nov 2023 22:13:20 +0000');
  await expect(cell(page, '#ts-result', 'http')).toHaveText('Tue, 14 Nov 2023 22:13:20 GMT');
  await expect(cell(page, '#ts-result', 'millis')).toHaveText('1700000000000');
});

test('auto-detects ms / µs / ns and allows overriding the unit', async ({ page }) => {
  for (const [v, unit] of [['1700000000000', 'ms'], ['1700000000000000', 'us'], ['1700000000123456789', 'ns']]) {
    await page.fill('#ts-input', v);
    await expect(page.locator('#ts-status')).toHaveAttribute('data-unit', unit);
    await expect(cell(page, '#ts-result', 'seconds')).toHaveText('1700000000');
  }
  await expect(cell(page, '#ts-result', 'iso')).toHaveText('2023-11-14T22:13:20.123Z');
  await page.fill('#ts-input', '1700000000');
  await page.selectOption('#ts-unit', 'ms');
  await expect(page.locator('#ts-status')).toHaveText('Read as milliseconds.');
  await expect(cell(page, '#ts-result', 'iso')).toHaveText('1970-01-20T16:13:20.000Z');
});

test('negative, 2038, invalid and out-of-range input', async ({ page }) => {
  await page.fill('#ts-input', '-86400');
  await expect(cell(page, '#ts-result', 'iso')).toHaveText('1969-12-31T00:00:00.000Z');
  await expect(cell(page, '#ts-result', 'relative')).toHaveText('53 years ago');
  await page.fill('#ts-input', '2147483648');
  await expect(page.locator('#ts-status')).toContainText('Year 2038');
  await expect(page.locator('#ts-status')).toHaveClass(/warn/);
  await page.fill('#ts-input', 'hello');
  await expect(page.locator('#ts-status')).toContainText('not a number');
  await expect(page.locator('#ts-result tr')).toHaveCount(0);
  await page.fill('#ts-input', '99999999999999999999999');
  await expect(page.locator('#ts-status')).toContainText('Out of range');
});

test('date → timestamp in local, UTC and Dhaka zones', async ({ page }) => {
  await page.fill('#dt-input', '2023-11-15T04:13:20');
  await page.selectOption('#dt-zone', 'Asia/Dhaka');
  await expect(cell(page, '#dt-result', 'seconds')).toHaveText('1700000000');
  await expect(cell(page, '#dt-result', 'millis')).toHaveText('1700000000000');
  await page.selectOption('#dt-zone', 'UTC');
  await expect(cell(page, '#dt-result', 'iso')).toHaveText('2023-11-15T04:13:20.000Z');
  await page.selectOption('#dt-zone', 'local');
  await expect(cell(page, '#dt-result', 'iso')).toHaveText('2023-11-15T09:13:20.000Z');
  await page.click('[data-act=dt-now]');
  await expect(page.locator('#dt-input')).toHaveValue('2023-11-14T17:13:20');
  await expect(cell(page, '#dt-result', 'seconds')).toHaveText(String(NOW));
});

test('language switch: Bangla labels, bn-BD dates and Bangla digits', async ({ page }) => {
  await page.click('[data-set-lang=bn]');
  await expect(page).toHaveTitle(/ইউনিক্স টাইমস্ট্যাম্প/);
  await expect(page.locator('#ts-now-s')).toHaveText('১৭০০০০০০০০');
  await expect(page.locator('#ts-status')).toContainText('১০ অঙ্ক');
  await expect(cell(page, '#ts-result', 'dhaka')).toContainText('০৪:১৩:২০');
  await expect(cell(page, '#ts-result', 'relative')).toHaveText('এখন');
  await expect(page.locator('#dt-zone-local')).toHaveText('আমার টাইম জোন (America/New_York)');
  await expect(page.locator('.content h2:visible').first()).toHaveText('ইউনিক্স টাইমস্ট্যাম্প কী?');
  await page.click('[data-set-lang=en]');
  await expect(cell(page, '#ts-result', 'dhaka')).toContainText('04:13:20');
});

test('every page string exists in English and Bangla', async ({ page }) => {
  const missing = await page.evaluate(() => {
    const { STRINGS } = window.JBI18N;
    const keys = new Set([...document.querySelectorAll('[data-i18n]')].map((e) => e.dataset.i18n));
    for (const k of Object.keys(STRINGS.en)) keys.add(k);
    for (const k of Object.keys(STRINGS.bn)) keys.add(k);
    return [...keys].filter((k) => !(k in STRINGS.en) || !(k in STRINGS.bn));
  });
  expect(missing).toEqual([]);
});

test('input is never sent over the network (only static fonts may load), no console errors, no overflow', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const requests = [];
  page.on('request', (r) => { if (!r.url().startsWith('https://fonts.gstatic.com/') && !r.url().includes('/api/ads')) requests.push(r.url()); if ((r.url() + (r.postData() || '')).includes('1234567890123')) requests.push('LEAK ' + r.url()); });
  await page.fill('#ts-input', '1234567890123');
  await page.fill('#dt-input', '2020-02-29T12:00:30');
  await page.click('[data-set-lang=bn]');
  await page.waitForTimeout(300);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
