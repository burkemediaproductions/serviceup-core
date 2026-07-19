import 'dotenv/config';
import { pool } from '../dbPool.js';
import { SERVICEUP_MODE, DEFAULT_TENANT_ID } from '../lib/deployment.js';

const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SERVICEUP_CREDENTIALS_KEY',
];

let failed = false;
const report = (ok, label, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed = true;
};

console.log(`ServiceUp installation doctor (${SERVICEUP_MODE} mode)\n`);
for (const name of required) {
  const value = process.env[name];
  report(Boolean(value && !/replace|your-/i.test(value)), name, value ? 'configured' : 'missing');
}

if (SERVICEUP_MODE === 'shared') {
  report(Boolean(process.env.SERVICEUP_PLATFORM_ADMINS), 'SERVICEUP_PLATFORM_ADMINS');
}

try {
  const { rows } = await pool.query(`
    select
      to_regclass('public.tenants') is not null as tenants,
      to_regclass('public.tenant_users') is not null as memberships,
      to_regclass('public.tenant_domains') is not null as domains,
      to_regclass('public.tenant_integrations') is not null as integrations,
      to_regclass('public.pixels') is not null as pixels,
      to_regclass('public.organization_profiles') is not null as profiles,
      to_regclass('public.activities') is not null as activities
  `);
  report(true, 'Database connection');
  for (const [name, exists] of Object.entries(rows[0])) {
    report(exists, `Migration table: ${name}`);
  }

  if (rows[0].tenants) {
    const tenants = await pool.query('select id, slug, status from tenants order by created_at');
    report(tenants.rowCount > 0, 'Tenant configuration', `${tenants.rowCount} tenant(s)`);
    if (SERVICEUP_MODE === 'dedicated') {
      report(
        tenants.rows.some((tenant) => tenant.id === DEFAULT_TENANT_ID),
        'DEFAULT_TENANT_ID',
        DEFAULT_TENANT_ID,
      );
    }
  }
} catch (error) {
  report(false, 'Database connection', error.message);
} finally {
  await pool.end();
}

console.log(failed ? '\nServiceUp is not ready. Fix the failed checks above.' : '\nServiceUp is ready.');
process.exitCode = failed ? 1 : 0;
