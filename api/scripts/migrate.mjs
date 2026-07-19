import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { pool } from '../dbPool.js';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbRoot = path.resolve(apiRoot, '..', 'db');
const includeCore = process.argv.includes('--include-core');
const files = (await fs.readdir(dbRoot))
  .filter((name) => /^\d{3}_.+\.sql$/.test(name))
  .sort();
if (includeCore) files.unshift('serviceup_schema.sql');

const client = await pool.connect();
try {
  await client.query(`create table if not exists public.serviceup_migrations (
    filename text primary key, checksum text not null, applied_at timestamptz not null default now()
  )`);
  await client.query(`select pg_advisory_lock(hashtext('serviceup_migrations'))`);
  for (const filename of files) {
    const sql = await fs.readFile(path.join(dbRoot, filename), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    const previous = await client.query('select checksum from public.serviceup_migrations where filename = $1', [filename]);
    if (previous.rows[0]) {
      if (previous.rows[0].checksum !== checksum) throw new Error(`${filename} changed after it was applied`);
      console.log(`SKIP ${filename}`); continue;
    }
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into public.serviceup_migrations (filename, checksum) values ($1,$2)', [filename, checksum]);
      await client.query('commit'); console.log(`APPLY ${filename}`);
    } catch (error) { await client.query('rollback'); throw error; }
  }
} finally {
  await client.query(`select pg_advisory_unlock(hashtext('serviceup_migrations'))`).catch(() => {});
  client.release(); await pool.end();
}
