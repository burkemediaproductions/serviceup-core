import 'dotenv/config';
import { pool } from '../dbPool.js';

function options(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith('--')) continue;
    parsed[argv[index].slice(2)] = argv[index + 1] && !argv[index + 1].startsWith('--')
      ? argv[++index]
      : true;
  }
  return parsed;
}

const args = options(process.argv.slice(2));
const name = String(args.name || '').trim();
const slug = String(args.slug || name)
  .trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const domain = String(args.domain || '').trim().toLowerCase();
const adminEmail = String(args.admin || '').trim().toLowerCase();
const plan = String(args.plan || 'shared').trim().toLowerCase();

if (!name || !slug || !adminEmail) {
  console.error('Usage: npm run tenant:create -- --name "Client Name" --slug client-name --domain dashboard.example.com --admin owner@example.com');
  process.exit(1);
}

const client = await pool.connect();
try {
  await client.query('BEGIN');
  const user = await client.query('select id from users where lower(email) = $1 limit 1', [adminEmail]);
  if (!user.rows[0]) {
    throw new Error(`No ServiceUp user exists for ${adminEmail}. Create the user through Supabase/Auth and ServiceUp first.`);
  }
  const result = await client.query(
    `insert into tenants (slug, name, plan)
     values ($1, $2, $3)
     returning id, slug, name, status, plan`,
    [slug, name, plan],
  );
  const tenant = result.rows[0];
  if (domain) {
    await client.query(
      'insert into tenant_domains (tenant_id, domain, is_primary) values ($1, $2, true)',
      [tenant.id, domain],
    );
  }
  await client.query(`select set_config('app.tenant_id', $1, true)`, [tenant.id]);
  await client.query(
    `insert into roles (tenant_id, slug, label, is_system) values
      ($1, 'ADMIN', 'Administrator', true),
      ($1, 'EDITOR', 'Editor', true),
      ($1, 'VIEWER', 'Viewer', true)
     on conflict (tenant_id, slug) do nothing`,
    [tenant.id],
  );
  await client.query(
    `insert into permissions (tenant_id, slug, label, description) values
      ($1, 'roles.manage', 'Manage roles', 'Create roles and assign permissions'),
      ($1, 'users.manage', 'Manage users', 'Create and manage client users'),
      ($1, 'manage_content_types', 'Manage content types', 'Configure fields and views'),
      ($1, 'integrations.manage', 'Manage integrations', 'Configure client integrations'),
      ($1, 'pixels.manage', 'Manage Pixels', 'Upload and manage media assets'),
      ($1, 'profile.manage', 'Manage Profile', 'Update organization and contact information'),
      ($1, 'activities.manage', 'Manage Activity', 'Create notes, tasks and follow-ups')
     on conflict (tenant_id, slug) do nothing`,
    [tenant.id],
  );
  await client.query(
    `insert into tenant_users (tenant_id, user_id, role, status)
     values ($1, $2, 'ADMIN', 'active')
     on conflict (tenant_id, user_id) do update set role = 'ADMIN', status = 'active'`,
    [tenant.id, user.rows[0].id],
  );
  await client.query(
    `insert into role_permissions (tenant_id, role_slug, permission_slug, allowed)
     values ($1, 'EDITOR', 'pixels.manage', true),
            ($1, 'EDITOR', 'profile.manage', true),
            ($1, 'EDITOR', 'activities.manage', true)
     on conflict (tenant_id, role_slug, permission_slug) do update set allowed = true`,
    [tenant.id],
  );
  await client.query('COMMIT');
  console.log(JSON.stringify({ ...tenant, domain: domain || null, admin: adminEmail }, null, 2));
} catch (error) {
  await client.query('ROLLBACK');
  console.error(`Tenant creation failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
