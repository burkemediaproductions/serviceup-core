import { Router } from 'express';
import { checkPermission } from '../middleware/checkPermission.js';

const router = Router();
const credentialsKey = () => process.env.SERVICEUP_CREDENTIALS_KEY || '';

router.get('/', checkPermission('integrations.manage'), async (req, res) => {
  try {
    const { rows } = await req.db.query(
      `select id, slug, is_enabled, config, created_at, updated_at,
              credentials_encrypted is not null as has_credentials
         from tenant_integrations
        order by slug`,
    );
    return res.json(rows);
  } catch (error) {
    console.error('[GET /api/integrations]', error);
    return res.status(500).json({ error: 'Failed to load integrations' });
  }
});

router.get('/:slug', checkPermission('integrations.manage'), async (req, res) => {
  try {
    const { rows } = await req.db.query(
      `select id, slug, is_enabled, config, created_at, updated_at,
              credentials_encrypted is not null as has_credentials
         from tenant_integrations
        where slug = $1 limit 1`,
      [req.params.slug],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Integration not found' });
    return res.json(rows[0]);
  } catch (error) {
    console.error('[GET /api/integrations/:slug]', error);
    return res.status(500).json({ error: 'Failed to load integration' });
  }
});

router.put('/:slug', checkPermission('integrations.manage'), async (req, res) => {
  const { config = {}, credentials, is_enabled = true } = req.body || {};
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return res.status(400).json({ error: 'config must be an object' });
  }
  if (credentials !== undefined && (
    !credentials || typeof credentials !== 'object' || Array.isArray(credentials)
  )) {
    return res.status(400).json({ error: 'credentials must be an object' });
  }
  if (credentials !== undefined && !credentialsKey()) {
    return res.status(500).json({ error: 'SERVICEUP_CREDENTIALS_KEY is not configured' });
  }

  try {
    const { rows } = await req.db.query(
      `insert into tenant_integrations
         (tenant_id, slug, is_enabled, config, credentials_encrypted)
       values (
         $1, $2, $3, $4,
         case when $5::text is null then null else pgp_sym_encrypt($5::text, $6) end
       )
       on conflict (tenant_id, slug)
       do update set
         is_enabled = excluded.is_enabled,
         config = excluded.config,
         credentials_encrypted = case
           when $5::text is null then tenant_integrations.credentials_encrypted
           else pgp_sym_encrypt($5::text, $6)
         end,
         updated_at = now()
       returning id, slug, is_enabled, config, created_at, updated_at,
                 credentials_encrypted is not null as has_credentials`,
      [
        req.tenantId,
        req.params.slug,
        !!is_enabled,
        config,
        credentials === undefined ? null : JSON.stringify(credentials),
        credentialsKey(),
      ],
    );
    return res.json(rows[0]);
  } catch (error) {
    console.error('[PUT /api/integrations/:slug]', error);
    return res.status(500).json({ error: 'Failed to save integration' });
  }
});

router.delete('/:slug', checkPermission('integrations.manage'), async (req, res) => {
  try {
    const result = await req.db.query(
      'delete from tenant_integrations where slug = $1',
      [req.params.slug],
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Integration not found' });
    return res.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/integrations/:slug]', error);
    return res.status(500).json({ error: 'Failed to delete integration' });
  }
});

export default router;
