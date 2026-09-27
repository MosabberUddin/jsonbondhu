// End-to-end tests for the CSV <-> JSON converter (/csv-json/).
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const out = async (page) => page.evaluate(() => document.querySelector('#csv-out').value);

test.beforeEach(async ({ page }) => {
  await page.goto('/csv-json/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('converts CSV to JSON without mangling IDs or phone numbers', async ({ page }) => {
  await page.click('[data-act=sample]');
  await expect(page.locator('#status')).toContainText('3 rows × 8 columns · delimiter: comma');
  const data = JSON.parse(await out(page));
  expect(data[0]).toEqual({
    id: '00123', name: 'রহিম উদ্দিন', phone: '01712345678', active: true, score: 88.5,
    'address.city': 'ঢাকা', 'address.zip': 1207, note: 'বলল "হ্যালো"',
  });
  expect(data[1].phone).toBe('+8801812345678');
  expect(data[1].score).toBeNull();
  expect(data[2].note).toBe('দুই\nলাইন');
  expect(await out(page)).toContain('\n  {\n    "id": "00123"'); // 2-space pretty print
  await expect(page.locator('#csv-table tbody tr')).toHaveCount(3);
  await expect(page.locator('#csv-table thead th').nth(1)).toHaveText('id');
});

test('options: nesting, no inference, no header, arrays, trim', async ({ page }) => {
  await page.fill('#csv-in', 'id,address.city\n 007 ,ঢাকা');
  await page.check('#csv-nest');
  await expect.poll(async () => JSON.parse(await out(page))).toEqual([{ id: ' 007 ', address: { city: 'ঢাকা' } }]);
  await page.check('#csv-trim');
  await page.uncheck('#csv-infer');
  await expect.poll(async () => JSON.parse(await out(page))).toEqual([{ id: '007', address: { city: 'ঢাকা' } }]);
  await page.uncheck('#csv-header');
  await expect.poll(async () => JSON.parse(await out(page))[0]).toEqual({ col1: 'id', col2: 'address.city' });
  await page.selectOption('#csv-rows', 'arrays');
  await expect.poll(async () => JSON.parse(await out(page))).toEqual([['id', 'address.city'], ['007', 'ঢাকা']]);
});

test('auto-detects semicolons and allows a manual delimiter', async ({ page }) => {
  await page.fill('#csv-in', 'a;b\n1,5;2');
  await expect(page.locator('#status')).toContainText('delimiter: semicolon');
  await expect(page.locator('#csv-delim option[value=auto]')).toHaveText('Auto-detect (semicolon)');
  expect(JSON.parse(await out(page))).toEqual([{ a: '1,5', b: 2 }]);
  await page.selectOption('#csv-delim', ',');
  await expect.poll(async () => JSON.parse(await out(page))).toEqual([{ 'a;b': 1, col2: '5;2' }]);
});

test('reports ragged rows instead of dropping them', async ({ page }) => {
  await page.fill('#csv-in', 'a,b,c\n1,2,3\n4,5\n6,7,8,9');
  await expect(page.locator('#status')).toHaveClass(/warn/);
  await expect(page.locator('#status')).toContainText('2 rows have a different number of fields than the header (3) — lines 3, 4');
  expect(JSON.parse(await out(page))).toHaveLength(3);
});

test('JSON to CSV with delimiter, header and formula protection; swap round-trips', async ({ page }) => {
  await page.click('[data-dir=json2csv]');
  await expect(page.locator('#json-options')).toBeVisible();
  await expect(page.locator('#csv-options')).toBeHidden();
  await expect(page.locator('#in-label')).toHaveText('JSON input');
  await page.fill('#csv-in', JSON.stringify([{ n: 'রহিম', a: { city: 'ঢাকা' }, f: '=1+1', tags: [1, 2] }]));
  await expect.poll(() => out(page)).toBe('n,a.city,f,tags\n' + 'রহিম,ঢাকা,=1+1,"[1,2]"');
  await page.check('#json-guard');
  await expect.poll(() => out(page)).toContain("'=1+1");
  await page.uncheck('#json-guard');
  await page.selectOption('#json-delim', 'tab');
  await expect.poll(() => out(page)).toBe('n\ta.city\tf\ttags\nরহিম\tঢাকা\t=1+1\t[1,2]');
  await page.uncheck('#json-header');
  await expect.poll(() => out(page)).toBe('রহিম\tঢাকা\t=1+1\t[1,2]');
  await page.check('#json-header');
  await expect(page.locator('#status')).toContainText('1 rows × 4 columns');
  await page.click('[data-act=swap]');
  await expect(page.locator('[data-dir=csv2json]')).toHaveAttribute('aria-pressed', 'true');
  await page.selectOption('#csv-delim', 'auto');
  await page.check('#csv-nest');
  await expect.poll(async () => JSON.parse(await out(page))).toEqual([{ n: 'রহিম', a: { city: 'ঢাকা' }, f: '=1+1', tags: [1, 2] }]);
});

test('shows a clear error for invalid JSON', async ({ page }) => {
  await page.click('[data-dir=json2csv]');
  await page.fill('#csv-in', '{"a":');
  await expect(page.locator('#status')).toHaveClass(/err/);
  await expect(page.locator('#status')).toContainText('Invalid JSON');
  expect(await out(page)).toBe('');
});

test('opens CSV and JSON files and picks the direction', async ({ page }) => {
  await page.setInputFiles('#csv-file', { name: 'people.csv', mimeType: 'text/csv', buffer: Buffer.from('﻿নাম;বয়স\r\nরহিম;30\r\n') });
  await expect(page.locator('#status')).toContainText('1 rows × 2 columns');
  expect(JSON.parse(await out(page))).toEqual([{ 'নাম': 'রহিম', 'বয়স': 30 }]);
  await page.setInputFiles('#csv-file', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('[{"z":true}]') });
  await expect(page.locator('[data-dir=json2csv]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => out(page)).toBe('z\ntrue');
});

test('downloads CSV with a UTF-8 BOM and JSON without one', async ({ page }) => {
  await page.click('[data-dir=json2csv]');
  await page.fill('#csv-in', '[{"নাম":"রহিম"}]');
  await expect.poll(() => out(page)).toBe('নাম\nরহিম');
  const [csvDl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=download]')]);
  expect(csvDl.suggestedFilename()).toBe('data.csv');
  const csv = await readFile(await csvDl.path(), 'utf8');
  expect(csv).toBe('﻿নাম\r\nরহিম\r\n');
  await page.click('[data-act=swap]');
  const [jsonDl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=download]')]);
  expect(jsonDl.suggestedFilename()).toBe('data.json');
  expect(JSON.parse(await readFile(await jsonDl.path(), 'utf8'))).toEqual([{ 'নাম': 'রহিম' }]);
});

test('handles a large paste without re-parsing on every key', async ({ page }) => {
  const line = '00123,রহিম উদ্দিন,"ঢাকা, বাংলাদেশ",88.5,true\n';
  const big = 'id,name,addr,score,ok\n' + line.repeat(40000);
  await page.evaluate((text) => {
    const el = document.querySelector('#csv-in');
    el.value = text;
    el.dispatchEvent(new Event('input'));
  }, big);
  await expect(page.locator('#status')).toContainText('40000 rows × 5 columns', { timeout: 10000 });
  await expect(page.locator('#csv-table tbody tr')).toHaveCount(50);
  await expect(page.locator('#preview-note')).toContainText('first 50 of 40000');
  // The textarea only shows the beginning; copy/download keep the full output.
  await expect(page.locator('#out-note')).toBeVisible();
  await expect(page.locator('#out-note')).toContainText('Download include everything');
  expect((await out(page)).length).toBeLessThan(250000);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=download]')]);
  expect(JSON.parse(await readFile(await dl.path(), 'utf8'))).toHaveLength(40000);
});

test('user data is never sent over the network', async ({ page }) => {
  const secret = 'TOP_SECRET_' + Date.now();
  const leaks = [];
  page.on('request', (r) => {
    if ((r.url() + (r.postData() || '')).includes(secret)) leaks.push(r.url());
  });
  await page.fill('#csv-in', 'k,v\nsecret,' + secret);
  await expect(page.locator('#status')).toContainText('1 rows');
  await page.check('#csv-nest');
  await page.click('[data-act=swap]');
  await page.check('#json-guard');
  await page.click('[data-act=copy]').catch(() => {});
  await page.waitForTimeout(500);
  expect(leaks).toEqual([]);
});

test('no horizontal scroll with a wide table, and no console errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // /api/ads is a Cloudflare Pages function that the static test server does not have.
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/api/ads')) errors.push(r.status() + ' ' + r.url()); });
  await page.goto('/csv-json/');
  const cols = Array.from({ length: 30 }, (_, i) => 'a_rather_long_column_name_' + i);
  await page.fill('#csv-in', cols.join(',') + '\n' + cols.map((c) => c + '_value_that_is_long').join(','));
  await expect(page.locator('#csv-table thead th')).toHaveCount(31);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const wrap = await page.evaluate(() => {
    const w = document.querySelector('.csv-table-wrap');
    return w.scrollWidth > w.clientWidth;
  });
  expect(wrap).toBe(true);
  await page.click('[data-dir=json2csv]');
  await page.click('[data-act=sample]');
  expect(errors).toEqual([]);
});

test('keyboard: controls are reachable and Ctrl+Enter converts', async ({ page }) => {
  await page.focus('#csv-in');
  await page.keyboard.insertText('a\n1');
  await page.keyboard.press('Control+Enter');
  expect(JSON.parse(await out(page))).toEqual([{ a: 1 }]);
  await page.focus('[data-dir=json2csv]');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-dir=json2csv]')).toHaveAttribute('aria-pressed', 'true');
});

test.describe('language', () => {
  test('switches to Bangla, re-localizes status and preview note', async ({ page }) => {
    await page.click('[data-act=sample]');
    await expect(page.locator('#status')).toContainText('3 rows');
    await page.click('[data-set-lang=bn]');
    await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
    await expect(page).toHaveTitle(/JSON বন্ধু/);
    await expect(page.locator('h1')).toHaveText('CSV ↔ JSON কনভার্টার');
    await expect(page.locator('#status')).toContainText('৩টি সারি × ৮টি কলাম · ডিলিমিটার: কমা');
    await expect(page.locator('#in-label')).toHaveText('CSV ইনপুট');
    await expect(page.locator('#csv-delim option[value=auto]')).toHaveText('স্বয়ংক্রিয় (কমা)');
    await expect(page.locator('#csv-table tbody td.num').first()).toHaveText('১');
    await expect(page.locator('.content h2:visible').first()).toHaveText('সংক্ষেপে CSV আর JSON');
    await page.click('[data-dir=json2csv]');
    await expect(page.locator('#in-label')).toHaveText('JSON ইনপুট');
    await page.click('[data-set-lang=en]');
    await expect(page.locator('#in-label')).toHaveText('JSON input');
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
});
