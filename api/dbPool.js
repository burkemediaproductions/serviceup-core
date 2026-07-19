// api/dbPool.js
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === 'false'
      ? false
      : { require: true, rejectUnauthorized: false },
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30_000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 10_000),
});

export default pool;
