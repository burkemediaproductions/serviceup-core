import { Router } from 'express';
import { pool } from '../dbPool.js';
import platformAdmin from '../middleware/platformAdmin.js';

const router = Router();

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

router.use(platformAdmin);

router.get('/tenants', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `select t.id, t.slug, t.name, t.status, t.plan, t.created_at,
              coalesce(
                jsonb_agg(d.domain order by d.is_primary desc, d.domain)
                  filter (where d.id is not null),
                '[]'::jsonb
              ) as domains
         from tenants t
         left join tenant_domains d on d.tenant_id = t.id and d.is_active = true
        group by t.id
        order by t.name`,
    );
    return res.json(rows);
  } catch (error) {
    console.error('[GET /api/platform/tenants]', error);
    return res.status(500).json({ error: 'Failed to load clients' });
  }
});

router.post('/tenants', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const slug = normalizeSlug(req.body?.slug || name);
  const plan = String(req.body?.plan || 'shared').trim().toLowerCase();
  const domains = Array.isArray(req.body?.domains)
    ? req.body.domains.map((value) => String(value).trim().toLowerCase()).filter(Boolean)
    : [];

  if (!name || !slug) {
    return res.status(400).json({ error: 'Client name and slug are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tenant = await client.query(
      `insert into tenants (slug, name, plan)
       values ($1, $2, $3)
       returning id, slug, name, status, plan, created_at`,
      [slug, name, plan],
    );
    const created = tenant.rows[0];

    for (let index = 0; index < domains.length; index += 1) {
      await client.query(
        `insert into tenant_domains (tenant_id, domain, is_primary)
         values ($1, $2, $3)`,
        [created.id, domains[index], index === 0],
      );
    }

    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [created.id]);
    await client.query(
      `insert into roles (tenant_id, slug, label, is_system)
       values
         ($1, 'ADMIN', 'Administrator', true),
         ($1, 'EDITOR', 'Editor', true),
         ($1, 'VIEWER', 'Viewer', true)
       on conflict (tenant_id, slug) do nothing`,
      [created.id],
    );
    await client.query(
      `insert into permissions (tenant_id, slug, label, description)
       values
         ($1, 'roles.manage', 'Manage roles', 'Create roles and assign permissions'),
         ($1, 'users.manage', 'Manage users', 'Create and manage client users'),
         ($1, 'manage_content_types', 'Manage content types', 'Configure fields and views'),
         ($1, 'integrations.manage', 'Manage integrations', 'Configure client integrations'),
         ($1, 'pixels.manage', 'Manage Pixels', 'Upload and manage media assets'),
         ($1, 'profile.manage', 'Manage Profile', 'Update organization and contact information'),
         ($1, 'activities.manage', 'Manage Activity', 'Create notes, tasks and follow-ups')
       on conflict (tenant_id, slug) do nothing`,
      [created.id],
    );
    await client.query(
      `insert into tenant_users (tenant_id, user_id, role, status)
       values ($1, $2, 'ADMIN', 'active')`,
      [created.id, req.user.id],
    );
    await client.query(
      `insert into role_permissions (tenant_id, role_slug, permission_slug, allowed)
       values ($1, 'EDITOR', 'pixels.manage', true),
              ($1, 'EDITOR', 'profile.manage', true),
              ($1, 'EDITOR', 'activities.manage', true)
       on conflict (tenant_id, role_slug, permission_slug) do update set allowed = true`,
      [created.id],
    );

    await client.query('COMMIT');
    return res.status(201).json({ ...created, domains });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[POST /api/platform/tenants]', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'That client slug or domain is already in use' });
    }
    return res.status(500).json({ error: 'Failed to create client' });
  } finally {
    client.release();
  }
});

router.post('/tenants/:id/domains', async (req, res) => {
  const domain = String(req.body?.domain || '').trim().toLowerCase();
  if (!domain) return res.status(400).json({ error: 'Domain is required' });
  try {
    const { rows } = await pool.query(
      `insert into tenant_domains (tenant_id, domain, is_primary)
       values ($1, $2, $3)
       returning id, tenant_id, domain, is_primary, is_active`,
      [req.params.id, domain, req.body?.is_primary === true],
    );
    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error('[POST /api/platform/tenants/:id/domains]', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'That domain is already registered' });
    }
    return res.status(500).json({ error: 'Failed to register domain' });
  }
});

export default router;
