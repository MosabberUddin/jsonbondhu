// One-off import of a Workers KV export into MySQL.
//
// Export first (needs `wrangler login`):
//   npx wrangler kv key list --namespace-id <id> --remote > keys.json
//   then for each key: npx wrangler kv key get <name> --namespace-id <id> --remote
// and save [{name, value, metadata, expiration}] as kv-export.json.
//
//   node --env-file=.env import-kv.mjs kv-export.json
import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';
import { MysqlKV } from './kv-mysql.js';

const file = process.argv[2];
if (!file) {
  console.error('usage: node --env-file=.env import-kv.mjs <kv-export.json>');
  process.exit(1);
}
const entries = JSON.parse(readFileSync(file, 'utf8'));
const pool = mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 1 });
const kv = new MysqlKV(pool);
try {
  // A value larger than MySQL's max_allowed_packet cannot be stored: check before
  // importing anything, so a big export fails up front rather than partway through.
  const [[{ limit }]] = await pool.query('SELECT @@global.max_allowed_packet AS `limit`');
  const tooBig = entries.filter((e) => Buffer.byteLength(typeof e.value === 'string' ? e.value : JSON.stringify(e.value)) + 4096 > Number(limit));
  if (tooBig.length) {
    console.error(`These keys exceed max_allowed_packet (${limit} bytes); raise it in the MySQL config and retry:`);
    for (const e of tooBig) console.error('  ' + e.name);
    process.exit(1);
  }
  for (const e of entries) {
    await kv.put(e.name, typeof e.value === 'string' ? e.value : JSON.stringify(e.value), {
      metadata: e.metadata ?? undefined,
      expiration: e.expiration || undefined,
    });
    console.log('imported', e.name);
  }
  const { keys } = await kv.list();
  console.log(`Done. ${entries.length} imported, ${keys.length} keys in MySQL.`);
} finally {
  await pool.end();
}
