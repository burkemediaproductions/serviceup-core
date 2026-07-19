import bcrypt from 'bcryptjs';
import { pool } from './dbPool.js';
import { DEFAULT_TENANT_ID } from './lib/deployment.js';

async function seed() {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const password_hash = await bcrypt.hash(password, 10);
  const role = 'ADMIN';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [DEFAULT_TENANT_ID]);
    const tenant = await client.query(
      `insert into tenants (id, slug, name, plan)
       values ($1, 'default', 'Default Client', 'dedicated')
       on conflict (id) do update set updated_at = now()
       returning id`,
      [DEFAULT_TENANT_ID],
    );
    const user = await client.query(
      `insert into users (email, password_hash, role, status)
       values ($1, $2, $3, 'ACTIVE')
       on conflict (email) do update set updated_at = now()
       returning id`,
      [email, password_hash, role],
    );
    await client.query(
      `insert into tenant_users (tenant_id, user_id, role, status)
       values ($1, $2, $3, 'active')
       on conflict (tenant_id, user_id)
       do update set role = excluded.role, status = 'active', updated_at = now()`,
      [tenant.rows[0].id, user.rows[0].id, role],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  console.log('Seed complete');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
