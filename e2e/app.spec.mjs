// End-to-end tests against the real page in Chromium (and a phone viewport).
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/json-formatter/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('formats valid JSON and reports stats (English by default)', async ({ page }) => {
  await page.fill('#input', '{"a":1,"b":[1,2]}');
  await page.click('[data-act=format]');
  await expect(page.locator('#input')).toHaveValue('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}');
  await expect(page.locator('#status')).toContainText('Valid JSON');
});

test('minifies', async ({ page }) => {
  await page.fill('#input', '{\n  "a": 1\n}');
  await page.click('[data-act=minify]');
  await expect(page.locator('#input')).toHaveValue('{"a":1}');
});

test('shows error line/column and does not modify input', async ({ page }) => {
  await page.fill('#input', '{\n"a": 1,\n}');
  await page.click('[data-act=validate]');
  await expect(page.locator('#status')).toContainText('line 3');
  await expect(page.locator('#input')).toHaveValue('{\n"a": 1,\n}');
});

test('repairs almost-JSON', async ({ page }) => {
  await page.fill('#input', "{name: 'x', ok: True, list: [1,2,],}");
  await page.click('[data-act=repair]');
  expect(JSON.parse(await page.inputValue('#input'))).toEqual({ name: 'x', ok: true, list: [1, 2] });
});

test('tree view renders and copies a path', async ({ page }) => {
  await page.click('[data-act=sample]');
  await page.click('[data-tab=tree]');
  await expect(page.locator('#tree')).toContainText('Rahim Uddin');
  await page.locator('.tree .key', { hasText: /^city$/ }).click();
  await expect(page.locator('#path')).toHaveText('$.city');
});

test('tree search highlights matches', async ({ page }) => {
  await page.click('[data-act=sample]');
  await page.click('[data-tab=tree]');
  await page.fill('#search', 'python');
  await expect(page.locator('#tree mark')).toHaveCount(1);
});

test('converts to CSV, YAML and XML', async ({ page }) => {
  await page.fill('#input', '[{"a":1,"b":{"c":"x"}}]');
  await page.click('[data-tab=convert]');
  await page.selectOption('#target', 'csv');
  await page.click('[data-act=convert]');
  await expect(page.locator('#output')).toHaveValue('a,b.c\n1,x');
  await page.selectOption('#target', 'yaml');
  await expect(page.locator('#output')).toHaveValue('- a: 1\n  b:\n    c: x');
  await page.selectOption('#target', 'xml');
  await expect(page.locator('#output')).toHaveValue(/<c>x<\/c>/);
});

test('loads a dropped/opened file', async ({ page }) => {
  await page.setInputFiles('#file', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"z":true}') });
  await expect(page.locator('#input')).toHaveValue('{\n  "z": true\n}');
});

test('restores last input after reload', async ({ page }) => {
  await page.fill('#input', '{"keep":1}');
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.locator('#input')).toHaveValue('{"keep":1}');
});

test('user JSON is never sent over the network', async ({ page }) => {
  const secret = 'TOP_SECRET_' + Date.now();
  const leaks = [];
  page.on('request', (r) => {
    if ((r.url() + (r.postData() || '')).includes(secret)) leaks.push(r.url());
  });
  await page.fill('#input', JSON.stringify({ secret }));
  for (const act of ['format', 'minify', 'validate', 'repair', 'sort']) await page.click(`[data-act=${act}]`);
  await page.click('[data-tab=tree]');
  await page.click('[data-tab=convert]');
  await page.click('[data-act=convert]');
  await page.waitForTimeout(500);
  expect(leaks).toEqual([]);
});

test('no horizontal scroll and no console errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/json-formatter/');
  await page.click('[data-act=sample]');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test.describe('language', () => {
  test('switches to Bangla and back, and remembers the choice', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('[data-act=format]')).toHaveText('Format');
    await page.click('[data-set-lang=bn]');
    await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
    await expect(page.locator('[data-act=format]')).toHaveText('ফরম্যাট');
    await expect(page.locator('#faq h2:visible')).toHaveText('প্রশ্নোত্তর');
    await expect(page).toHaveTitle(/JSON বন্ধু/);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
    await page.click('[data-set-lang=en]');
    await expect(page.locator('[data-act=format]')).toHaveText('Format');
    await expect(page.locator('#faq h2:visible')).toHaveText('FAQ');
  });

  test('re-localizes the current status and uses Bangla digits', async ({ page }) => {
    await page.fill('#input', '{\n"a": 1,\n}');
    await page.click('[data-act=validate]');
    await expect(page.locator('#status')).toContainText('line 3');
    await page.click('[data-set-lang=bn]');
    await expect(page.locator('#status')).toContainText('লাইন ৩');
  });

  test('switching language keeps tree expansion, selected path and search results', async ({ page }) => {
    await page.click('[data-act=sample]');
    await page.click('[data-tab=tree]');
    await page.fill('#search', 'python');
    await expect(page.locator('#tree mark')).toHaveCount(1);
    await page.locator('.tree .key', { hasText: /^city$/ }).click();
    const openBefore = await page.locator('#tree details[open]').count();
    await page.click('[data-set-lang=bn]');
    await expect(page.locator('#tree mark')).toHaveCount(1);
    await expect(page.locator('#path')).toHaveText('$.city');
    expect(await page.locator('#tree details[open]').count()).toBe(openBefore);
    await expect(page.locator('#tree summary .meta').first()).toHaveText('{৮টি কী}');
  });

  test('?lang=bn opens in Bangla', async ({ page }) => {
    await page.goto('/json-formatter/?lang=bn');
    await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
    await expect(page.locator('[data-tab=tree]')).toHaveText('ট্রি ভিউ');
  });

  test('every label has both English and Bangla text', async ({ page }) => {
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

  test('privacy page follows the chosen language', async ({ page }) => {
    await page.click('[data-set-lang=bn]');
    await page.goto('/privacy.html');
    await expect(page.locator('h1:visible')).toHaveText('গোপনীয়তা নীতি');
    await page.click('[data-set-lang=en]');
    await expect(page.locator('h1:visible')).toHaveText('Privacy Policy');
  });
});

test.describe('Bangla browser', () => {
  test.use({ locale: 'bn-BD' });
  test('defaults to Bangla when the browser language is Bangla', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
    await expect(page.locator('[data-act=format]')).toHaveText('ফরম্যাট');
  });
});
