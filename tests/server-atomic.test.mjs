// Atomic stats increments (MysqlKV.atomicUpdate + track.js) and shutdown draining.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { MysqlKV } from '../server/kv-mysql.js';
import { resolveAdminFile } from '../server/admin-path.js';
import { PendingTasks } from '../server/pending.js';
import { increment } from '../functions/api/track.js';

// A tiny in-memory stand-in for a mysql2 pool that models InnoDB's row lock: the
// upsert (INSERT ... ON DUPLICATE KEY UPDATE) takes the exclusive lock, the same
// transaction's SELECT ... FOR UPDATE reuses it, and commit/rollback releases it.
function fakePool() {
  const rows = new Map();
  const locks = new Map(); // key -> promise that resolves when the lock is released
  const calls = [];
  const pool = {
    rows,
    calls,
    async getConnection() {
      let release = null;
      let held = null; // key this transaction holds the lock on
      const acquire = async (k) => {
        if (held === k) return;
        while (locks.has(k)) await locks.get(k);
        let resolve;
        locks.set(k, new Promise((r) => { resolve = r; }));
        held = k;
        release = () => { locks.delete(k); held = null; resolve(); };
      };
      const conn = {
        async beginTransaction() { calls.push('begin'); },
        async query(sql, params) {
          const s = sql.replace(/\s+/g, ' ').trim();
          if (s.startsWith('INSERT INTO kv') && s.includes('ON DUPLICATE KEY UPDATE k = k')) {
            const [k, v] = params;
            await acquire(k);
            if (!rows.has(k)) rows.set(k, { v, metadata: null, expires_at: 0 });
            await new Promise((r) => setImmediate(r)); // give other callers a chance to race
            return [{}];
          }
          if (s.startsWith('SELECT v, expires_at FROM kv WHERE k = ? FOR UPDATE')) {
            const [k] = params;
            await acquire(k); // already held from the upsert
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

describe('MysqlKV.atomicUpdate locking statement', () => {
  test('creates the row with an exclusive-lock upsert, never INSERT IGNORE', async () => {
    const sqls = [];
    const conn = {
      async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
      async query(sql) {
        sqls.push(sql.replace(/s+/g, ' ').trim());
        return [sql.includes('SELECT') ? [{ v: 'null', expires_at: 0 }] : {}];
      },
    };
    await new MysqlKV({ getConnection: async () => conn }).atomicUpdate('k', () => ({ n: 1 }));
    assert.ok(sqls[0].startsWith('INSERT INTO kv') && sqls[0].endsWith('ON DUPLICATE KEY UPDATE k = k'), sqls[0]);
    assert.ok(!sqls.some((q) => q.includes('INSERT IGNORE')));
    assert.ok(sqls[1].includes('FOR UPDATE'));
  });
});

describe('MysqlKV.atomicUpdate deadlock handling', () => {
  // A pool whose first N transactions die with an InnoDB deadlock (errno 1213).
  function flakyPool(failures, errno = 1213) {
    const inner = fakePool();
    let left = failures;
    const getConnection = inner.getConnection;
    inner.getConnection = async () => {
      const conn = await getConnection();
      const query = conn.query.bind(conn);
      conn.query = async (sql, params) => {
        if (left > 0 && sql.includes('FOR UPDATE')) {
          left--;
          const err = new Error('Deadlock found when trying to get lock; try restarting transaction');
          err.errno = errno;
          throw err;
        }
        return query(sql, params);
      };
      return conn;
    };
    return inner;
  }

  test('retries after a deadlock and still records the count once', async () => {
    const pool = flakyPool(2);
    const kv = new MysqlKV(pool);
    const out = await kv.atomicUpdate('k', (v) => ({ n: (v?.n || 0) + 1 }));
    assert.deepEqual(out, { n: 1 });
    assert.equal(JSON.parse(pool.rows.get('k').v).n, 1);
    assert.equal(pool.calls.filter((c) => c === 'rollback').length, 2);
    assert.equal(pool.calls.filter((c) => c === 'release').length, 3);
  });

  test('gives up (and surfaces the error) after repeated deadlocks', async () => {
    const pool = flakyPool(99);
    const kv = new MysqlKV(pool);
    await assert.rejects(kv.atomicUpdate('k', () => ({ n: 1 })), (e) => e.errno === 1213);
    assert.equal(pool.calls.filter((c) => c === 'release').length, 5);
  });

  test('does not retry unrelated errors', async () => {
    const pool = flakyPool(1, 1064);
    const kv = new MysqlKV(pool);
    await assert.rejects(kv.atomicUpdate('k', () => ({ n: 1 })), (e) => e.errno === 1064);
    assert.equal(pool.calls.filter((c) => c === 'release').length, 1);
  });
});

describe('MysqlKV.putQuery / put', () => {
  test('put sends exactly the statement putQuery describes', async () => {
    const seen = [];
    const kv = new MysqlKV({ query: async (sql, params) => { seen.push({ sql, params }); return [{}]; } });
    await kv.put('k', { a: 1 }, { metadata: { m: 1 }, expiration: 1900000000 });
    const expected = MysqlKV.putQuery('k', { a: 1 }, { metadata: { m: 1 }, expiration: 1900000000 });
    assert.deepEqual(seen, [expected]);
    assert.deepEqual(expected.params, ['k', '[object Object]', '{"m":1}', 1900000000]);
    assert.ok(expected.sql.startsWith("INSERT INTO kv (k, v, metadata, expires_at)"));
  });
  test('works with any object that has query(), e.g. a transaction connection', async () => {
    const seen = [];
    const conn = { query: async (sql, params) => { seen.push(params[0]); return [{}]; } };
    await new MysqlKV(conn).put('via-conn', 'v');
    assert.deepEqual(seen, ['via-conn']);
  });
});

describe('resolveAdminFile', () => {
  const dir = path.resolve('/srv/public/admin');
  test('maps normal paths inside the admin folder', () => {
    assert.equal(resolveAdminFile('/admin/', dir), path.join(dir, 'index.html'));
    assert.equal(resolveAdminFile('/admin/admin.js', dir), path.join(dir, 'admin.js'));
    assert.equal(resolveAdminFile('/admin/sub%20dir/a.css', dir), path.join(dir, 'sub dir', 'a.css'));
  });
  test('returns null for malformed percent-encoding instead of throwing', () => {
    assert.equal(resolveAdminFile('/admin/%E0', dir), null);
    assert.equal(resolveAdminFile('/admin/%', dir), null);
    assert.equal(resolveAdminFile('/admin/%E0%A6', dir), null);
  });
  test('returns null for traversal and NUL bytes', () => {
    assert.equal(resolveAdminFile('/admin/../secret', dir), null);
    assert.equal(resolveAdminFile('/admin/%2e%2e/secret', dir), null);
    assert.equal(resolveAdminFile('/admin/a%00.js', dir), null);
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
