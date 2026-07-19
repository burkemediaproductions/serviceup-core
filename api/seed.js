import bcrypt from 'bcryptjs';
import { pool } from './dbPool.js';
import { DEFAULT_TENANT_ID } from './lib/deployment.js';
import { supabaseAdmin } from './lib/supabaseAdmin.js';

async function seed() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured before seeding.');
  }

  const password_hash = await bcrypt.hash(password, 10);
  const role = 'ADMIN';
  const client = await pool.connect();

  try {
    // Storage policies require a matching Supabase Auth identity. Reuse an
    // existing identity or create and confirm it when the service key exists.
    let supabaseId = null;
    const existingAuth = await client.query(
      `select id from auth.users where lower(email) = lower($1) limit 1`,
      [email],
    );
    supabaseId = existingAuth.rows[0]?.id || null;

    if (!supabaseId && supabaseAdmin) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw new Error(`Unable to create Supabase Auth administrator: ${error.message}`);
      supabaseId = data?.user?.id || null;
    }

    if (!supabaseId) {
      console.warn(
        'Seeded the ServiceUp administrator without Supabase Auth; Storage uploads will remain unavailable until the identities are linked.',
      );
    }

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
      `insert into users (email, password_hash, role, status, supabase_id)
       values ($1, $2, $3, 'ACTIVE', $4)
       on conflict (email) do update
         set password_hash = excluded.password_hash,
             role = excluded.role,
             status = 'ACTIVE',
             supabase_id = coalesce(excluded.supabase_id, users.supabase_id),
             updated_at = now()
       returning id`,
      [email, password_hash, role, supabaseId],
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
