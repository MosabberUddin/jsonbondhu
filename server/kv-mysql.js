// A Workers-KV-compatible store backed by one MySQL table, so the Pages
// Functions in functions/ run unchanged on a self-hosted Node server.
// Implements the subset they use: get, getWithMetadata, put, list.
//
// Unlike Cloudflare KV this is strongly consistent and has no write quota.

const LIST_LIMIT = 1000;
const MAX_LOCK_RETRIES = 5;

// ER_LOCK_DEADLOCK (1213) and ER_LOCK_WAIT_TIMEOUT (1205): the transaction was
// rolled back and can safely be run again.
function isRetryableLockError(e) {
  return e?.errno === 1213 || e?.errno === 1205 || e?.code === 'ER_LOCK_DEADLOCK' || e?.code === 'ER_LOCK_WAIT_TIMEOUT';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MysqlKV {
  /** @param {import('mysql2/promise').Pool} pool */
  constructor(pool) {
    this.pool = pool;
  }

  async #row(key) {
    const [rows] = await this.pool.query(
      'SELECT v, metadata FROM kv WHERE k = ? AND (expires_at IS NULL OR expires_at > ?)',
      [key, nowSec()],
    );
    return rows[0] || null;
  }

  async get(key, opts) {
    const row = await this.#row(key);
    if (!row) return null;
    return decode(row.v, opts);
  }

  async getWithMetadata(key, opts) {
    const row = await this.#row(key);
    return {
      value: row ? decode(row.v, opts) : null,
      metadata: row ? parseJson(row.metadata) : null,
    };
  }

  /** The exact statement and parameters put() sends (the importer measures them). */
  static putQuery(key, value, opts = {}) {
    const expiresAt = opts.expiration
      ? Number(opts.expiration)
      : opts.expirationTtl
        ? nowSec() + Number(opts.expirationTtl)
        : null;
    const metadata = opts.metadata === undefined ? null : JSON.stringify(opts.metadata);
    return {
      sql: `INSERT INTO kv (k, v, metadata, expires_at) VALUES (?, ?, ?, ?) AS new
       ON DUPLICATE KEY UPDATE v = new.v, metadata = new.metadata, expires_at = new.expires_at`,
      params: [key, String(value), metadata, expiresAt],
    };
  }

  async put(key, value, opts = {}) {
    const { sql, params } = MysqlKV.putQuery(key, value, opts);
    await this.pool.query(sql, params);
  }

  /**
   * Atomic read-modify-write of one JSON value (not part of the Workers KV API).
   * The row is locked for the whole update, so concurrent callers on the same key
   * are serialised and no increment is lost. `mutate` gets the current value
   * (null when missing or expired) and returns the new one; with `withMetadata`
   * the new value is also stored as the key's metadata, as track.js expects.
   */
  async atomicUpdate(key, mutate, opts = {}) {
    // Concurrent first writes to a new key can deadlock in InnoDB (the duplicate
    // INSERT IGNORE checks take shared locks before FOR UPDATE wants exclusive
    // ones). InnoDB rolls back one side; retry it. `mutate` must be pure.
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.#atomicOnce(key, mutate, opts);
      } catch (e) {
        if (!isRetryableLockError(e) || attempt >= MAX_LOCK_RETRIES) throw e;
        await sleep(10 * 2 ** attempt + Math.floor(Math.random() * 10));
      }
    }
  }

  async #atomicOnce(key, mutate, { expirationTtl, withMetadata = false } = {}) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      // Make sure a row exists to lock (an already-expired placeholder reads as missing).
      await conn.query('INSERT IGNORE INTO kv (k, v, metadata, expires_at) VALUES (?, ?, NULL, 0)', [key, 'null']);
      const [rows] = await conn.query('SELECT v, expires_at FROM kv WHERE k = ? FOR UPDATE', [key]);
      const row = rows[0];
      const live = row && (row.expires_at === null || Number(row.expires_at) > nowSec());
      const next = mutate(live ? parseJson(row.v) : null);
      const text = JSON.stringify(next);
      const expiresAt = expirationTtl ? nowSec() + Number(expirationTtl) : null;
      await conn.query('UPDATE kv SET v = ?, metadata = ?, expires_at = ? WHERE k = ?',
        [text, withMetadata ? text : null, expiresAt, key]);
      await conn.commit();
      return next;
    } catch (e) {
      await conn.rollback().catch(() => {});
      throw e;
    } finally {
      conn.release();
    }
  }

  // Keys sorted by name; the cursor is the last key of the previous page.
  async list({ prefix = '', cursor, limit = LIST_LIMIT } = {}) {
    const n = Math.min(Math.max(Number(limit) || LIST_LIMIT, 1), LIST_LIMIT);
    const [rows] = await this.pool.query(
      `SELECT k, metadata, expires_at FROM kv
       WHERE k LIKE ? AND k > ? AND (expires_at IS NULL OR expires_at > ?)
       ORDER BY k LIMIT ?`,
      [escapeLike(prefix) + '%', cursor || '', nowSec(), n + 1],
    );
    const page = rows.slice(0, n);
    const keys = page.map((r) => ({
      name: r.k,
      metadata: parseJson(r.metadata),
      ...(r.expires_at ? { expiration: Number(r.expires_at) } : {}),
    }));
    const complete = rows.length <= n;
    return complete
      ? { keys, list_complete: true }
      : { keys, list_complete: false, cursor: page[page.length - 1].k };
  }

  /** Drop expired rows. KV does this itself; here the server calls it daily. */
  async purgeExpired() {
    const [res] = await this.pool.query('DELETE FROM kv WHERE expires_at IS NOT NULL AND expires_at <= ?', [nowSec()]);
    return res.affectedRows || 0;
  }
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function decode(text, opts) {
  return opts?.type === 'json' ? JSON.parse(text) : text;
}

function parseJson(text) {
  if (text == null) return null;
  if (typeof text === 'object') return text;
  try { return JSON.parse(text); } catch { return null; }
}

function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (c) => '\\' + c);
}
