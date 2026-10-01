import { test, expect } from '@playwright/test';

const ABC = {
  'MD5': '900150983cd24fb0d6963f7d28e17f72',
  'SHA-1': 'a9993e364706816aba3e25717850c26c9cd0d89d',
  'SHA-256': 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  'SHA-512': 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
};
const val = (page, algo) => page.locator(`code[data-algo="${algo}"]`);

test.beforeEach(async ({ page }) => {
  await page.goto('/hash-generator/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('empty input shows the empty-string hashes on load', async ({ page }) => {
  await expect(val(page, 'MD5')).toHaveText('d41d8cd98f00b204e9800998ecf8427e');
  await expect(val(page, 'SHA-256')).toHaveText('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('hashes text with every algorithm and switches output format', async ({ page }) => {
  await page.fill('#hash-input', 'abc');
  for (const [algo, hex] of Object.entries(ABC)) await expect(val(page, algo)).toHaveText(hex);
  await expect(val(page, 'SHA-384')).toHaveText(/^cb00753f45a35e8b/);
  await page.check('input[name=hash-enc][value="hex-upper"]');
  await expect(val(page, 'MD5')).toHaveText('900150983CD24FB0D6963F7D28E17F72');
  await page.check('input[name=hash-enc][value="base64"]');
  await expect(val(page, 'MD5')).toHaveText('kAFQmDzST7DWlj99KOF/cg==');
});

test('Bangla text is hashed as UTF-8', async ({ page }) => {
  const expected = await page.evaluate(async () => {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('বাংলা'));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  });
  await page.fill('#hash-input', 'বাংলা');
  await expect(val(page, 'SHA-256')).toHaveText(expected);
});

test('HMAC mode matches RFC 2202 and RFC 4231 vectors', async ({ page }) => {
  await page.fill('#hash-input', 'what do ya want for nothing?');
  await page.check('input[name=hash-mode][value="hmac"]');
  await expect(page.locator('#hash-key')).toBeVisible();
  await page.fill('#hash-key', 'Jefe');
  await expect(val(page, 'MD5')).toHaveText('750c783e6ab0b503eaa86e310a5db738');
  await expect(val(page, 'SHA-256')).toHaveText('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
});

test('compare box detects matches case-insensitively and mismatches', async ({ page }) => {
  await page.fill('#hash-input', 'abc');
  await page.fill('#hash-compare', ABC['SHA-256'].toUpperCase());
  await expect(page.locator('#hash-compare-result')).toContainText('Match: this is the SHA-256 hash');
  await page.fill('#hash-compare', ABC['SHA-1'].slice(0, -1) + 'b');
  await expect(page.locator('#hash-compare-result')).toContainText('No match');
});

test('hashes a chosen file without uploading it', async ({ page }) => {
  await page.setInputFiles('#hash-file', { name: 'abc.txt', mimeType: 'text/plain', buffer: Buffer.from('abc') });
  await expect(val(page, 'SHA-1')).toHaveText(ABC['SHA-1']);
  await expect(page.locator('#status')).toContainText('abc.txt');
  await page.click('#hash-clear-file');
  await expect(val(page, 'SHA-1')).toHaveText('da39a3ee5e6b4b0d3255bfef95601890afd80709');
});

test('rejects files over 100 MB with a message', async ({ page }) => {
  // Fake a File object with a huge size without allocating it.
  await page.evaluate(() => {
    const f = new File(['x'], 'big.bin');
    Object.defineProperty(f, 'size', { value: 101 * 1024 * 1024 });
    const dt = new DataTransfer();
    dt.items.add(f);
    const input = document.querySelector('#hash-file');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('#status')).toContainText('larger than 100 MB');
});

test('warns that MD5 and SHA-1 are not safe and links the guide', async ({ page }) => {
  await expect(page.locator('.badge.warn')).toHaveCount(2);
  await expect(page.locator('a[href="/guides/encoding-vs-encryption-vs-hashing/"]').first()).toBeAttached();
});

test('language switch updates labels and keeps results', async ({ page }) => {
  await page.fill('#hash-input', 'abc');
  await page.click('[data-set-lang=bn]');
  await expect(page.locator('label[for=hash-input]')).toHaveText('হ্যাশ করার টেক্সট');
  await expect(val(page, 'SHA-256')).toHaveText(ABC['SHA-256']);
  await expect(page).toHaveTitle(/হ্যাশ জেনারেটর/);
});

test('makes no network requests after load and has no console errors', async ({ page }) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/hash-generator/');
  page.on('request', (r) => { if (!r.url().includes('/api/ads')) requests.push(r.url()); });
  await page.fill('#hash-input', 'abc');
  await page.check('input[name=hash-mode][value="hmac"]');
  await page.fill('#hash-key', 'k');
  await page.waitForTimeout(300);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
