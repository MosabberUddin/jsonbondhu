// One-off import of a Workers KV export into MySQL.
//
// Export first (needs `wrangler login`):
//   npx wrangler kv key list --namespace-id <id> --remote > keys.json
//   then for each key: npx wrangler kv key get <name> --namespace-id <id> --remote
// and save [{name, value, metadata, expiration}] as kv-export.json.
//
//   node --env-file=.env import-kv.mjs kv-export.json
//
// All-or-nothing: every entry is written in one transaction, so a failure leaves
// the table exactly as it was. Before writing, each statement is measured the way
// mysql2 sends it (escaping included) against max_allowed_packet.
import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';
import { MysqlKV } from './kv-mysql.js';

const file = process.argv[2];
if (!file) {
  console.error('usage: node --env-file=.env import-kv.mjs <kv-export.json>');
  process.exit(1);
}
const entries = JSON.parse(readFileSync(file, 'utf8')).map((e) => ({
  ...e,
  value: typeof e.value === 'string' ? e.value : JSON.stringify(e.value),
}));
const pool = mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 1 });
const conn = await pool.getConnection();
try {
  const [[{ limit }]] = await conn.query('SELECT @@global.max_allowed_packet AS `limit`');
  const tooBig = entries.filter((e) => {
    const { sql, params } = MysqlKV.putQuery(e.name, e.value, { metadata: e.metadata ?? undefined, expiration: e.expiration || undefined });
    return Buffer.byteLength(mysql.format(sql, params)) >= Number(limit);
  });
  if (tooBig.length) {
    console.error(`These keys exceed max_allowed_packet (${limit} bytes) once escaped; raise it in the MySQL config and retry:`);
    for (const e of tooBig) console.error('  ' + e.name);
    process.exit(1);
  }

  const kv = new MysqlKV(conn); // a connection has the same query() as a pool
  await conn.beginTransaction();
  try {
    for (const e of entries) {
      await kv.put(e.name, e.value, { metadata: e.metadata ?? undefined, expiration: e.expiration || undefined });
      console.log('imported', e.name);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Import failed; nothing was written.');
    throw err;
  }
  const { keys } = await new MysqlKV(pool).list();
  console.log(`Done. ${entries.length} imported, ${keys.length} keys in MySQL.`);
} finally {
  conn.release();
  await pool.end();
}
