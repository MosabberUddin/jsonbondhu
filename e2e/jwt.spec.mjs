import { test, expect } from '@playwright/test';
import { webcrypto, createHmac, generateKeyPairSync, sign } from 'node:crypto';

// Fixed "now" so expiry checks are deterministic: 2023-11-14T22:13:20Z.
const NOW = 1700000000;
const b64u = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
function hs256(payload, secret, header = { alg: 'HS256', typ: 'JWT' }) {
  const input = b64u(header) + '.' + b64u(payload);
  return input + '.' + createHmac('sha256', secret).update(input).digest('base64url');
}

test.use({ timezoneId: 'Asia/Dhaka' });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW * 1000);
  await page.goto('/jwt-decoder/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('decodes a token with a Bearer prefix and Unicode claims', async ({ page }) => {
  const token = hs256({ sub: 'u1', name: 'রহিম 🔐', iat: NOW - 60, exp: NOW + 7200 }, 's3cret');
  await page.fill('#jwt-input', '  Bearer ' + token + '\n');
  await expect(page.locator('#jwt-header')).toContainText('"alg": "HS256"');
  await expect(page.locator('#jwt-payload')).toContainText('"name": "রহিম 🔐"');
  await expect(page.locator('#jwt-sig')).toHaveText(token.split('.')[2]);
  await expect(page.locator('#status')).toContainText('Decoding is not verifying');
  await expect(page.locator('#jwt-state')).toHaveAttribute('data-state', 'valid');
  const exp = page.locator('#jwt-claims tr[data-claim=exp]');
  await expect(exp).toContainText('Expires in 2 hours');
  await expect(exp).toContainText('UTC: Wed, 15 Nov 2023, 00:13:20 UTC');
  await expect(exp).toContainText('Your time: Wed, 15 Nov 2023, 06:13:20 GMT+6');
  await expect(page.locator('#jwt-claims tr[data-claim=iat]')).toContainText('Issued 1 minute ago');
  await expect(page.locator('#jwt-claims tr[data-claim=sub]')).toContainText('u1');
});

test('shows expired and not-yet-valid states', async ({ page }) => {
  await page.fill('#jwt-input', hs256({ exp: NOW - 3 * 86400 }, 'k'));
  await expect(page.locator('#jwt-state')).toHaveAttribute('data-state', 'expired');
  await expect(page.locator('#jwt-claims tr[data-claim=exp]')).toContainText('Expired 3 days ago');
  await page.fill('#jwt-input', hs256({ nbf: NOW + 600, exp: NOW + 1200 }, 'k'));
  await expect(page.locator('#jwt-state')).toHaveAttribute('data-state', 'notYet');
  await expect(page.locator('#jwt-claims tr[data-claim=nbf]')).toContainText('Becomes valid in 10 minutes');
});

test('clear errors for malformed tokens, JWE and alg none', async ({ page }) => {
  await page.fill('#jwt-input', 'abc.def');
  await expect(page.locator('#status')).toHaveText('A JWT has 3 parts separated by dots — this has 2.');
  await page.fill('#jwt-input', '%%%.' + b64u({}) + '.x');
  await expect(page.locator('#status')).toHaveText('The header is not valid base64url.');
  await page.fill('#jwt-input', b64u({ alg: 'HS256' }) + '.' + b64u('{oops') + '.x');
  await expect(page.locator('#status')).toHaveText('The payload is not valid JSON.');
  await page.fill('#jwt-input', b64u({ alg: 'RSA-OAEP', enc: 'A256GCM' }) + '.a.b.c.d');
  await expect(page.locator('#status')).toContainText('encrypted token (JWE');
  await expect(page.locator('#jwt-header')).toContainText('A256GCM');
  await page.fill('#jwt-input', b64u({ alg: 'none' }) + '.' + b64u({ sub: 'x' }) + '.');
  await expect(page.locator('#status')).toContainText('NOT signed');
  await expect(page.locator('#jwt-verify-hint')).toContainText('unsigned');
  await expect(page.locator('[data-act=verify]')).toBeDisabled();
});

test('sample token decodes and verifies with the demo secret', async ({ page }) => {
  await page.click('[data-act=sample]');
  await expect(page.locator('#jwt-payload')).toContainText('demo-user-0001');
  await expect(page.locator('#jwt-verify-result')).toHaveAttribute('data-result', 'valid');
  await page.fill('#jwt-key', 'wrong-secret');
  await expect(page.locator('#jwt-verify-result')).toHaveAttribute('data-result', 'invalid');
  await expect(page.locator('#jwt-verify-result')).toContainText('Invalid signature');
});

test('verifies RS256 and ES256 with PEM public keys', async ({ page }) => {
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const input = b64u({ alg: 'RS256' }) + '.' + b64u({ sub: 'rsa' });
  const token = input + '.' + sign('sha256', Buffer.from(input), rsa.privateKey).toString('base64url');
  await page.fill('#jwt-input', token);
  await expect(page.locator('#jwt-key-label')).toHaveText('Public key (PEM or JWK)');
  await page.fill('#jwt-key', rsa.publicKey.export({ type: 'spki', format: 'pem' }));
  await page.click('[data-act=verify]');
  await expect(page.locator('#jwt-verify-result')).toHaveAttribute('data-result', 'valid');

  const kp = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const ein = b64u({ alg: 'ES256' }) + '.' + b64u({ sub: 'ec' });
  const sig = Buffer.from(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, Buffer.from(ein))).toString('base64url');
  const spki = Buffer.from(await webcrypto.subtle.exportKey('spki', kp.publicKey)).toString('base64');
  await page.fill('#jwt-input', ein + '.' + sig);
  await page.fill('#jwt-key', '-----BEGIN PUBLIC KEY-----\n' + spki + '\n-----END PUBLIC KEY-----');
  await expect(page.locator('#jwt-verify-result')).toHaveAttribute('data-result', 'valid');
  await page.fill('#jwt-key', '-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----');
  await expect(page.locator('#jwt-verify-result')).toHaveAttribute('data-result', 'privateKey');
});

test('language switch re-renders status, claims and verification', async ({ page }) => {
  await page.fill('#jwt-input', hs256({ exp: NOW - 3 * 86400 }, 'k'));
  await page.fill('#jwt-key', 'k');
  await expect(page.locator('#jwt-verify-result')).toHaveAttribute('data-result', 'valid');
  await page.click('[data-set-lang=bn]');
  await expect(page).toHaveTitle(/JWT ডিকোডার/);
  await expect(page.locator('[data-act=sample]')).toHaveText('নমুনা টোকেন');
  await expect(page.locator('#jwt-state')).toHaveText('✗ মেয়াদ শেষ');
  await expect(page.locator('#jwt-claims tr[data-claim=exp]')).toContainText('৩ দিন আগে');
  await expect(page.locator('#jwt-verify-result')).toContainText('সিগনেচার সঠিক');
  await expect(page.locator('.content h2:visible').first()).toHaveText('JWT কী?');
  await page.fill('#jwt-input', 'a.b');
  await expect(page.locator('#status')).toContainText('৩টি অংশ');
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

test('token and secret are never sent over the network; no errors; no overflow', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const secret = 'SECRET_' + Date.now();
  const token = hs256({ sub: 'LEAKCHECK', exp: NOW + 60 }, secret);
  const leaks = [];
  page.on('request', (r) => {
    const blob = r.url() + (r.postData() || '') + JSON.stringify(r.headers());
    if (blob.includes(secret) || blob.includes(token.split('.')[1]) || blob.includes(token.split('.')[2])) leaks.push(r.url());
  });
  await page.fill('#jwt-input', token);
  await page.fill('#jwt-key', secret);
  await page.click('[data-act=verify]');
  await expect(page.locator('#jwt-verify-result')).toHaveAttribute('data-result', 'valid');
  await page.click('[data-set-lang=bn]');
  await page.waitForTimeout(300);
  expect(leaks).toEqual([]);
  expect(errors.filter((e) => !/api\/ads|Failed to load resource/.test(e))).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
