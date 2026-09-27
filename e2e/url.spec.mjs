// End-to-end tests for the URL encode/decode page.
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/url-encode/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('encodes as a component by default, and as a full URL on request', async ({ page }) => {
  await page.fill('#url-in', 'https://x.com/a b?q=1&r=2');
  await expect(page.locator('#url-out')).toHaveValue('https%3A%2F%2Fx.com%2Fa%20b%3Fq%3D1%26r%3D2');
  await page.check('input[name=url-scope][value=uri]');
  await expect(page.locator('#url-out')).toHaveValue('https://x.com/a%20b?q=1&r=2');
});

test('Bangla round-trips via swap', async ({ page }) => {
  const text = 'আমার সোনার বাংলা & more';
  await page.fill('#url-in', text);
  await expect(page.locator('#url-out')).toHaveValue(/^%E0%A6%86/);
  await page.click('[data-act=swap]');
  await expect(page.locator('[data-act=decode]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#url-out')).toHaveValue(text);
});

test('"+" as space for form encoding', async ({ page }) => {
  await page.click('[data-act=decode]');
  await page.fill('#url-in', 'new+york%2B1');
  await expect(page.locator('#url-out')).toHaveValue('new+york+1');
  await page.check('#url-plus');
  await expect(page.locator('#url-out')).toHaveValue('new york+1');
  await page.click('[data-act=encode]');
  await page.fill('#url-in', 'a b+c');
  await expect(page.locator('#url-out')).toHaveValue('a+b%2Bc');
});

test('malformed percent sequences give a graceful error in both languages', async ({ page }) => {
  await page.click('[data-act=decode]');
  await page.fill('#url-in', '50%25 off 100%');
  await expect(page.locator('#status')).toHaveClass(/err/);
  await expect(page.locator('#status')).toContainText('“%” at position 14');
  await expect(page.locator('#url-out')).toHaveValue('50% off 100%');
  await page.click('[data-set-lang=bn]');
  await expect(page.locator('#status')).toContainText('১৪ নম্বর অবস্থানে');
});

test('parses a URL into parts and decoded query params with repeated keys', async ({ page }) => {
  await page.fill('#url-parse-in', 'https://user@example.com:8080/p/%E0%A6%95?tag=a&tag=b+c&q=%E0%A6%AC&empty=#sec%201');
  const parts = page.locator('#url-parts');
  await expect(parts.locator('tr[data-part=protocol] td')).toHaveText('https:');
  await expect(parts.locator('tr[data-part=host] td')).toHaveText('example.com');
  await expect(parts.locator('tr[data-part=port] td')).toHaveText('8080');
  await expect(parts.locator('tr[data-part=path] td')).toHaveText('/p/ক');
  await expect(parts.locator('tr[data-part=hash] td')).toHaveText('sec 1');
  const rows = page.locator('#url-params tbody tr');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0).locator('th')).toHaveText('tag');
  await expect(rows.nth(0).locator('td')).toContainText('a');
  await expect(rows.nth(0).locator('td .badge')).toHaveText('1 of 2');
  await expect(rows.nth(1).locator('td')).toContainText('b c');
  await expect(rows.nth(2).locator('td')).toHaveText('ব');
  await expect(rows.nth(3).locator('td')).toHaveText('(empty)');
  await expect(page.locator('#url-params caption')).toContainText('Repeated: tag');
  await page.click('[data-set-lang=bn]');
  await expect(rows.nth(0).locator('td .badge')).toHaveText('২টির মধ্যে ১');
  await expect(parts.locator('tr[data-part=port] td')).toHaveText('৮০৮০');
});

test('parse handles bare hosts, invalid input and the sample', async ({ page }) => {
  await page.fill('#url-parse-in', 'example.com/x?y=1');
  await expect(page.locator('#url-parts caption')).toContainText('read as https://');
  await page.fill('#url-parse-in', 'not a url');
  await expect(page.locator('#url-parts caption')).toContainText('Not a valid URL');
  await expect(page.locator('#url-params')).toBeHidden();
  await page.click('[data-act=sample]');
  await expect(page.locator('#url-params tbody tr')).toHaveCount(5);
  await expect(page.locator('#url-parts tr[data-part=path] td')).toContainText('খুঁজুন');
});

test('parsed values are shown as text, never as markup', async ({ page }) => {
  await page.fill('#url-parse-in', 'https://a.com/?x=%3Cimg%20src%3Dx%20onerror%3D%22window.__pwned%3D1%22%3E');
  await expect(page.locator('#url-params tbody td')).toHaveText('<img src=x onerror="window.__pwned=1">');
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  await expect(page.locator('main img')).toHaveCount(0);
});

test('language switch translates the page and dynamic text', async ({ page }) => {
  await page.fill('#url-in', 'a b');
  await expect(page.locator('#status')).toHaveText('3 characters → 5 characters');
  await page.click('[data-set-lang=bn]');
  await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
  await expect(page.locator('h1')).toHaveText('URL এনকোড / ডিকোড');
  await expect(page.locator('[data-act=decode]')).toHaveText('ডিকোড');
  await expect(page.locator('#url-in-label')).toHaveText('টেক্সট');
  await expect(page.locator('#status')).toHaveText('৩টি অক্ষর → ৫টি অক্ষর');
  await expect(page.locator('.content h2:visible').first()).toHaveText('URL এনকোডিং কী?');
  await expect(page).toHaveTitle(/JSON বন্ধু/);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
  await page.click('[data-set-lang=en]');
  await expect(page.locator('[data-act=decode]')).toHaveText('Decode');
});

test('every string has English and Bangla', async ({ page }) => {
  const missing = await page.evaluate(() => {
    const { STRINGS } = window.JBI18N;
    const keys = new Set([...document.querySelectorAll('[data-i18n]')].map((e) => e.dataset.i18n));
    for (const e of document.querySelectorAll('[data-i18n-attr]')) {
      for (const pair of e.dataset.i18nAttr.split(';')) keys.add(pair.split(':')[1].trim());
    }
    for (const k of Object.keys(STRINGS.en)) keys.add(k);
    for (const k of Object.keys(STRINGS.bn)) keys.add(k);
    return [...keys].filter((k) => !(k in STRINGS.en) || !(k in STRINGS.bn));
  });
  expect(missing).toEqual([]);
});

test('user input is never sent over the network', async ({ page }) => {
  const secret = 'TOP_SECRET_' + Date.now();
  const leaks = [];
  page.on('request', (r) => {
    if ((r.url() + (r.postData() || '')).includes(secret)) leaks.push(r.url());
  });
  await page.fill('#url-in', secret + ' বাংলা');
  await page.click('[data-act=swap]');
  await page.check('#url-plus');
  await page.fill('#url-parse-in', 'https://evil.example/' + secret + '?k=' + secret + '#' + secret);
  await page.waitForTimeout(500);
  expect(leaks).toEqual([]);
});

test('no horizontal scroll and no console errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/url-encode/');
  await page.fill('#url-in', 'x'.repeat(300));
  await page.fill('#url-parse-in', 'https://example.com/' + 'verylongsegment'.repeat(20) + '?key=' + 'v'.repeat(200));
  await page.click('[data-set-lang=bn]');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // /api/ads is served by a Cloudflare Function in production and 404s on the static test server.
  expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
});
