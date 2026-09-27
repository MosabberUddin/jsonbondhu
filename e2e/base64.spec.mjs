// End-to-end tests for the Base64 page.
import { test, expect } from '@playwright/test';

const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

test.beforeEach(async ({ page }) => {
  await page.goto('/base64/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('encodes text live and shows byte sizes', async ({ page }) => {
  await page.fill('#b64-in', 'hello world');
  await expect(page.locator('#b64-out')).toHaveValue('aGVsbG8gd29ybGQ=');
  await expect(page.locator('#b64-in-size')).toHaveText('11 characters · 11 bytes');
  await expect(page.locator('#b64-out-size')).toHaveText('16 characters · 16 bytes');
  await expect(page.locator('#status')).toHaveClass(/ok/);
});

test('Bangla text round-trips through encode → swap → decode', async ({ page }) => {
  const text = 'আমার সোনার বাংলা 😀';
  await page.fill('#b64-in', text);
  await expect(page.locator('#b64-out')).toHaveValue(Buffer.from(text, 'utf8').toString('base64'));
  await expect(page.locator('#b64-in-size')).toContainText('bytes');
  await page.click('[data-act=swap]');
  await expect(page.locator('[data-act=decode]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#b64-out')).toHaveValue(text);
});

test('URL-safe and padding options', async ({ page }) => {
  await page.fill('#b64-in', '??>');
  await expect(page.locator('#b64-out')).toHaveValue('Pz8+');
  await page.check('#b64-urlsafe');
  await expect(page.locator('#b64-out')).toHaveValue('Pz8-');
  await page.fill('#b64-in', 'M');
  await expect(page.locator('#b64-out')).toHaveValue('TQ==');
  await page.uncheck('#b64-pad');
  await expect(page.locator('#b64-out')).toHaveValue('TQ');
});

test('decodes URL-safe unpadded input', async ({ page }) => {
  await page.click('[data-act=decode]');
  await page.fill('#b64-in', '4Kas4Ka-4KaC4Kay4Ka-');
  await expect(page.locator('#b64-out')).toHaveValue('বাংলা');
});

test('invalid Base64 shows a clear error in both languages', async ({ page }) => {
  await page.click('[data-act=decode]');
  await page.fill('#b64-in', 'abc$def');
  await expect(page.locator('#status')).toHaveClass(/err/);
  await expect(page.locator('#status')).toContainText('unexpected character “$” at position 4');
  await expect(page.locator('#b64-out')).toHaveValue('');
  await page.click('[data-set-lang=bn]');
  await expect(page.locator('#status')).toContainText('৪ নম্বর অবস্থানে অপ্রত্যাশিত অক্ষর');
});

test('encodes a file, optionally as a data URI', async ({ page }) => {
  await page.setInputFiles('#b64-file', { name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('hi বন্ধু') });
  const b64 = Buffer.from('hi বন্ধু').toString('base64');
  await expect(page.locator('#b64-out')).toHaveValue(b64);
  await expect(page.locator('#b64-in-label')).toHaveText('File: note.txt');
  await expect(page.locator('#status')).toContainText('note.txt');
  await page.check('#b64-datauri');
  await expect(page.locator('#b64-out')).toHaveValue('data:text/plain;base64,' + b64);
  // Typing replaces the file.
  await page.fill('#b64-in', 'x');
  await expect(page.locator('#b64-out')).toHaveValue('eA==');
  await expect(page.locator('#b64-in-label')).toHaveText('Text');
});

test('decoded image shows a preview and downloads as a file', async ({ page }) => {
  await page.click('[data-act=decode]');
  await page.fill('#b64-in', PNG_1x1);
  await expect(page.locator('#b64-preview img')).toBeVisible();
  await expect(page.locator('#b64-preview figcaption')).toContainText('image/png · 1×1');
  await expect(page.locator('#status')).toHaveClass(/warn/);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=download]')]);
  expect(dl.suggestedFilename()).toBe('decoded.png');
  // A data URI works too; non-images never get a preview.
  await page.fill('#b64-in', 'data:image/png;base64,' + PNG_1x1);
  await expect(page.locator('#b64-preview img')).toBeVisible();
  await page.fill('#b64-in', 'aGVsbG8=');
  await expect(page.locator('#b64-preview')).toBeHidden();
  await expect(page.locator('#b64-preview img')).toHaveCount(0);
  await expect(page.locator('#b64-out')).toHaveValue('hello');
});

test('decoded text contains no live markup', async ({ page }) => {
  await page.click('[data-act=decode]');
  const html = '<img src=x onerror="window.__pwned=1">';
  await page.fill('#b64-in', Buffer.from(html).toString('base64'));
  await expect(page.locator('#b64-out')).toHaveValue(html);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  await expect(page.locator('main img')).toHaveCount(0);
});

test('language switch translates the page and dynamic text', async ({ page }) => {
  await page.fill('#b64-in', 'hello world');
  await expect(page.locator('[data-act=encode]')).toHaveText('Encode');
  await page.click('[data-set-lang=bn]');
  await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
  await expect(page.locator('[data-act=encode]')).toHaveText('এনকোড');
  await expect(page.locator('h1')).toHaveText('Base64 এনকোড / ডিকোড');
  await expect(page.locator('#b64-in-label')).toHaveText('টেক্সট');
  await expect(page.locator('#b64-in-size')).toHaveText('১১টি অক্ষর · ১১ বাইট');
  await expect(page.locator('.content h2:visible').first()).toHaveText('Base64 কী?');
  await expect(page).toHaveTitle(/JSON বন্ধু/);
  await page.click('[data-set-lang=en]');
  await expect(page.locator('#b64-in-size')).toHaveText('11 characters · 11 bytes');
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
  const secretB64 = Buffer.from(secret).toString('base64');
  const leaks = [];
  page.on('request', (r) => {
    const s = r.url() + (r.postData() || '');
    if (s.includes(secret) || s.includes(secretB64)) leaks.push(r.url());
  });
  await page.fill('#b64-in', secret);
  await page.check('#b64-urlsafe');
  await page.click('[data-act=swap]');
  await page.setInputFiles('#b64-file', { name: 'secret.txt', mimeType: 'text/plain', buffer: Buffer.from(secret) });
  await page.click('[data-act=decode]');
  await page.fill('#b64-in', 'data:image/png;base64,' + PNG_1x1);
  await page.waitForTimeout(500);
  expect(leaks).toEqual([]);
});

test('no horizontal scroll and no console errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/base64/');
  await page.fill('#b64-in', 'x'.repeat(400) + ' বাংলা');
  await page.click('[data-act=swap]');
  await page.click('[data-set-lang=bn]');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // /api/ads is served by a Cloudflare Function in production and 404s on the static test server.
  expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
});
