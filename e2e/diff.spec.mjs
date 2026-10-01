import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/diff-checker/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function fill(page, a, b) {
  await page.fill('#diff-a', a);
  await page.fill('#diff-b', b);
}

test('metadata: title, description, canonical, hreflang', async ({ page }) => {
  const title = await page.title();
  expect(title.length).toBeLessThanOrEqual(60);
  expect(title).not.toContain('—');
  const desc = await page.getAttribute('meta[name=description]', 'content');
  expect(desc.length).toBeGreaterThanOrEqual(120);
  expect(desc.length).toBeLessThanOrEqual(155);
  expect(desc).not.toContain('—');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://jsonbondhu.irmaoshop.com/diff-checker/');
  await expect(page.locator('link[hreflang=bn]')).toHaveCount(1);
});

test('shows a prompt before any input', async ({ page }) => {
  await expect(page.locator('#status')).toHaveText('Paste text on both sides to compare.');
  await expect(page.locator('#diff-out table')).toHaveCount(0);
});

test('side-by-side diff with counts, markers and word highlights', async ({ page }) => {
  await fill(page, 'one\nthe quick brown fox\nthree\nfour', 'one\nthe slow brown fox\nthree\nfive\nsix');
  await expect(page.locator('#sum-added')).toHaveText('+ 3 added');
  await expect(page.locator('#sum-removed')).toHaveText('- 2 removed');
  await expect(page.locator('#sum-unchanged')).toHaveText('2 unchanged');
  await expect(page.locator('.diff-table.side')).toBeVisible();
  await expect(page.locator('.w-del').first()).toHaveText('quick');
  await expect(page.locator('.w-add').first()).toHaveText('slow');
  // Not colour alone: -/+ markers are present as text.
  await expect(page.locator('td.mk.del').first()).toHaveText('-');
  await expect(page.locator('td.mk.add').first()).toHaveText('+');
});

test('unified view and copy unified diff', async ({ page, context, browserName }) => {
  await fill(page, 'a\nb\nc', 'a\nB\nc');
  await page.check('input[name=diff-view][value=unified]');
  await expect(page.locator('.diff-table.uni')).toBeVisible();
  await expect(page.locator('.diff-table.uni tr.r-del td.tx')).toContainText('b');
  await expect(page.locator('.diff-table.uni tr.r-add td.tx')).toContainText('B');
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.click('[data-act=copy]');
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
  if (clip !== null) expect(clip.replace(/\r\n/g, '\n')).toBe('--- original\n+++ changed\n@@ -1,3 +1,3 @@\n a\n-b\n+B\n c');
});

test('identical text and ignore options', async ({ page }) => {
  await fill(page, 'Hello  World', 'hello world');
  await expect(page.locator('#sum-removed')).toHaveText('- 1 removed');
  await page.check('#diff-case');
  await expect(page.locator('#sum-removed')).toHaveText('- 1 removed');
  await page.check('#diff-ws');
  await expect(page.locator('#status')).toHaveText('No differences with the current options.');
  await expect(page.locator('#diff-out table')).toHaveCount(0);
  await page.uncheck('#diff-case');
  await page.uncheck('#diff-ws');
  await fill(page, 'same\r\ntext', 'same\ntext');
  await expect(page.locator('#status')).toHaveText('The two texts are identical.');
});

test('swap and clear', async ({ page }) => {
  await fill(page, 'left', 'right');
  await page.click('[data-act=swap]');
  await expect(page.locator('#diff-a')).toHaveValue('right');
  await expect(page.locator('#diff-b')).toHaveValue('left');
  await page.click('[data-act=clear]');
  await expect(page.locator('#diff-a')).toHaveValue('');
  await expect(page.locator('#diff-b')).toHaveValue('');
  await expect(page.locator('#status')).toHaveText('Paste text on both sides to compare.');
});

test('load file buttons fill the matching side', async ({ page }) => {
  const chooser = page.waitForEvent('filechooser');
  await page.click('[data-act=load-b]');
  (await chooser).setFiles({ name: 'b.txt', mimeType: 'text/plain', buffer: Buffer.from('from file\nline2') });
  await expect(page.locator('#diff-b')).toHaveValue('from file\nline2');
  await expect(page.locator('#diff-a')).toHaveValue('');
});

test('user text is never interpreted as HTML', async ({ page }) => {
  await fill(page, '<img src=x onerror="window.__pwned=1">', '<b>bold</b>');
  await expect(page.locator('#sum-removed')).toHaveText('- 1 removed');
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  await expect(page.locator('#diff-out img')).toHaveCount(0);
  await expect(page.locator('#diff-out')).toContainText('<b>bold</b>');
});

test('huge input is refused with a clear message', async ({ page }) => {
  await page.evaluate(() => {
    document.querySelector('#diff-a').value = 'x'.repeat(1000001);
    document.querySelector('#diff-b').value = 'y';
  });
  await page.click('[data-act=compare]');
  await expect(page.locator('#status')).toContainText('Too much text');
  await expect(page.locator('#diff-out table')).toHaveCount(0);
});

test('Bangla text diffs by word and language switch updates labels', async ({ page }) => {
  await fill(page, 'আমি ভাত খাই', 'আমি রুটি খাই');
  await expect(page.locator('.w-del')).toHaveText('ভাত');
  await expect(page.locator('.w-add')).toHaveText('রুটি');
  await page.click('[data-set-lang=bn]');
  await expect(page.locator('[data-act=compare]')).toHaveText('তুলনা করুন');
  await expect(page.locator('#sum-added')).toHaveText('+ ১টি যোগ');
  await expect(page).toHaveTitle(/ডিফ চেকার/);
  const desc = await page.getAttribute('meta[name=description]', 'content');
  expect(desc).toContain('ডিফ');
});

test('no network requests after load, no console errors, no horizontal overflow', async ({ page }) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/diff-checker/');
  page.on('request', (r) => { if (!r.url().includes('/api/ads')) requests.push(r.url()); });
  await fill(page, 'a\nb', 'a\nc');
  await page.click('[data-act=compare]');
  await page.waitForTimeout(300);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
