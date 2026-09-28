// The self-hosted stand-in for caches.default (server/memory-cache.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MemoryCache } from '../server/memory-cache.js';

const key = new Request('https://track-dedupe.invalid/abc');

test('match returns what put stored until max-age passes', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  const cache = new MemoryCache();
  assert.equal(await cache.match(key), undefined);

  await cache.put(key, new Response('1', { headers: { 'Cache-Control': 'max-age=15' } }));
  assert.equal(await (await cache.match(key)).text(), '1');

  t.mock.timers.tick(14_000);
  assert.ok(await cache.match(key));
  t.mock.timers.tick(1_000);
  assert.equal(await cache.match(key), undefined);
});

test('responses without max-age are not stored', async () => {
  const cache = new MemoryCache();
  await cache.put(key, new Response('1'));
  assert.equal(await cache.match(key), undefined);
});
