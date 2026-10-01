import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/json-to-typescript/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

const setJson = (page, text) => page.fill('#ts-in', text);

test('converts JSON to an interface with nested and optional types', async ({ page }) => {
  await setJson(page, '{"user_name":"a","orders":[{"id":1},{"id":2,"note":"x"}]}');
  const out = await page.inputValue('#ts-out');
  expect(out).toContain('export interface Root {');
  expect(out).toContain('  user_name: string;');
  expect(out).toContain('  orders: Order[];');
  expect(out).toContain('export interface Order {\n  id: number;\n  note?: string;\n}');
  await expect(page.locator('#status')).toContainText('2 type declarations');
});

test('options change the output', async ({ page }) => {
  await setJson(page, '{"a":[1],"b":{"c":null}}');
  await page.check('input[name=ts-style][value=type]');
  await page.uncheck('#ts-export');
  await page.check('#ts-readonly');
  await page.fill('#ts-root', 'api_data');
  const out = await page.inputValue('#ts-out');
  expect(out).toContain('type ApiData = {');
  expect(out).not.toContain('export');
  expect(out).toContain('readonly a: readonly number[];');
  expect(out).toContain('readonly c: null;');
});

test('optional merging toggle', async ({ page }) => {
  await setJson(page, '[{"a":1},{"b":2}]');
  expect(await page.inputValue('#ts-out')).toContain('a?: number;');
  await page.uncheck('#ts-optional');
  const out = await page.inputValue('#ts-out');
  expect(out).not.toContain('?:');
  expect(out).toContain('RootItem2');
});

test('invalid JSON shows a clear error', async ({ page }) => {
  await setJson(page, '{\n  "a": 1,\n  "b": }');
  await expect(page.locator('#status')).toHaveClass(/err/);
  await expect(page.locator('#status')).toContainText('Invalid JSON');
  expect(await page.inputValue('#ts-out')).toBe('');
});

test('sample and clear buttons', async ({ page }) => {
  await page.click('[data-act=sample]');
  expect(await page.inputValue('#ts-out')).toContain('"user-agent": string;');
  await page.click('[data-act=clear]');
  expect(await page.inputValue('#ts-in')).toBe('');
  expect(await page.inputValue('#ts-out')).toBe('');
  await expect(page.locator('#status')).toHaveText('Ready. Paste some JSON.');
});

test('downloads a .ts file', async ({ page }) => {
  await page.click('[data-act=sample]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=download]')]);
  expect(dl.suggestedFilename()).toBe('types.ts');
});

test('language switch updates labels and status', async ({ page }) => {
  await page.click('[data-act=sample]');
  await page.click('[data-set-lang=bn]');
  await expect(page.locator('label[for=ts-out]')).toHaveText('TypeScript আউটপুট');
  await expect(page.locator('#status')).toContainText('টাইপ ডিক্লারেশন');
  await expect(page).toHaveTitle(/JSON থেকে TypeScript/);
});

test('makes no network requests after load and has no console errors', async ({ page }) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/json-to-typescript/');
  page.on('request', (r) => { if (!r.url().includes('/api/ads')) requests.push(r.url()); });
  await page.click('[data-act=sample]');
  await setJson(page, '{"a":1}');
  await page.waitForTimeout(300);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
