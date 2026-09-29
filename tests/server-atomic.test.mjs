// Atomic stats increments (MysqlKV.atomicUpdate + track.js) and shutdown draining.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MysqlKV } from '../server/kv-mysql.js';
import { PendingTasks } from '../server/pending.js';
import { increment } from '../functions/api/track.js';

// A tiny in-memory stand-in for a mysql2 pool that honours SELECT ... FOR UPDATE:
// the row lock is held until commit/rollback, like InnoDB.
function fakePool() {
  const rows = new Map();
  const locks = new Map(); // key -> promise that resolves when the lock is released
  const calls = [];
  const pool = {
    rows,
    calls,
    async getConnection() {
      let release = null;
      const conn = {
        async beginTransaction() { calls.push('begin'); },
        async query(sql, params) {
          const s = sql.replace(/\s+/g, ' ').trim();
          if (s.startsWith('INSERT IGNORE')) {
            const [k, v] = params;
            if (!rows.has(k)) rows.set(k, { v, metadata: null, expires_at: 0 });
            return [{}];
          }
          if (s.startsWith('SELECT v, expires_at FROM kv WHERE k = ? FOR UPDATE')) {
            const [k] = params;
            while (locks.has(k)) await locks.get(k);
            let resolve;
            locks.set(k, new Promise((r) => { resolve = r; }));
            release = () => { locks.delete(k); resolve(); };
            await new Promise((r) => setImmediate(r)); // give other callers a chance to race
            return [[{ ...rows.get(k) }]];
          }
          if (s.startsWith('UPDATE kv SET')) {
            const [v, metadata, expires_at, k] = params;
            rows.set(k, { v, metadata, expires_at });
            return [{}];
          }
          throw new Error('unexpected SQL: ' + s);
        },
        async commit() { calls.push('commit'); release?.(); },
        async rollback() { calls.push('rollback'); release?.(); },
        release() { calls.push('release'); },
      };
      return conn;
    },
  };
  return pool;
}

describe('MysqlKV.atomicUpdate', () => {
  test('100 concurrent increments on one key are all kept', async () => {
    const pool = fakePool();
    const kv = new MysqlKV(pool);
    const bump = (v) => ({ n: (v?.n || 0) + 1 });
    await Promise.all(Array.from({ length: 100 }, () => kv.atomicUpdate('stats:x', bump, { expirationTtl: 60 })));
    assert.equal(JSON.parse(pool.rows.get('stats:x').v).n, 100);
  });

  test('treats an expired row as missing and stores metadata when asked', async () => {
    const pool = fakePool();
    pool.rows.set('k', { v: JSON.stringify({ n: 41 }), metadata: null, expires_at: 1 });
    const kv = new MysqlKV(pool);
    const out = await kv.atomicUpdate('k', (v) => ({ n: (v?.n || 0) + 1 }), { withMetadata: true });
    assert.deepEqual(out, { n: 1 });
    assert.equal(pool.rows.get('k').metadata, JSON.stringify({ n: 1 }));
    assert.equal(pool.rows.get('k').expires_at, null);
  });

  test('rolls back and releases the connection when mutate throws', async () => {
    const pool = fakePool();
    const kv = new MysqlKV(pool);
    await assert.rejects(kv.atomicUpdate('k', () => { throw new Error('boom'); }), /boom/);
    assert.deepEqual(pool.calls.slice(-2), ['rollback', 'release']);
  });
});

describe('track.js increment', () => {
  const evt = (event) => ({ campaignId: 'house-premium-top-en', event });

  test('uses the atomic path when the store offers it', async () => {
    const pool = fakePool();
    const env = { ADS_KV: new MysqlKV(pool) };
    await Promise.all([
      ...Array.from({ length: 30 }, () => increment(env, evt('impression'), 1)),
      ...Array.from({ length: 5 }, () => increment(env, evt('click'), 1)),
    ]);
    const [row] = [...pool.rows.values()];
    assert.deepEqual(JSON.parse(row.v), { i: 30, c: 5 });
    assert.deepEqual(JSON.parse(row.metadata), { i: 30, c: 5 });
  });

  test('falls back to get + put on Workers KV', async () => {
    const store = new Map();
    const env = {
      ADS_KV: {
        async getWithMetadata(k) { return { value: store.has(k) ? JSON.parse(store.get(k).v) : null, metadata: null }; },
        async put(k, v, opts) { store.set(k, { v, opts }); },
      },
    };
    await increment(env, evt('impression'), 10);
    await increment(env, evt('click'), 1);
    const [entry] = [...store.values()];
    assert.deepEqual(JSON.parse(entry.v), { i: 10, c: 1 });
    assert.deepEqual(entry.opts.metadata, { i: 10, c: 1 });
  });
});

describe('PendingTasks (shutdown draining)', () => {
  const later = (ms, fn) => new Promise((r) => setTimeout(() => { fn?.(); r(); }, ms));

  test('drain waits for tracked tasks, including ones added while draining', async () => {
    const p = new PendingTasks();
    const done = [];
    p.track(later(20, () => { done.push('a'); p.track(later(20, () => done.push('b'))); }));
    assert.equal(await p.drain(1000), true);
    assert.deepEqual(done, ['a', 'b']);
    assert.equal(p.size, 0);
  });

  test('drain gives up after the timeout', async () => {
    const p = new PendingTasks();
    p.track(new Promise(() => {}));
    assert.equal(await p.drain(30), false);
  });

  test('a failing task is logged, not thrown', async () => {
    const p = new PendingTasks();
    const orig = console.error;
    const logged = [];
    console.error = (...a) => logged.push(a.join(' '));
    try {
      await p.track(Promise.reject(new Error('db down')));
      assert.equal(await p.drain(100), true);
    } finally {
      console.error = orig;
    }
    assert.match(logged.join('\n'), /db down/);
  });
});
