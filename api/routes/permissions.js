// api/routes/permissions.js
import { Router } from 'express';
import { checkPermission } from '../middleware/checkPermission.js';

const router = Router();

// GET /api/permissions
// All permissions, all role mappings, all roles
router.get(
  '/',
  checkPermission('roles.manage'),
  async (req, res) => {
    try {
      const perms = await req.db.query(
        'select * from public.permissions order by slug'
      );
      const rolePerms = await req.db.query(
        'select * from public.role_permissions'
      );
      const roles = await req.db.query(
        'select * from public.roles order by slug'
      );

      res.json({
        permissions: perms.rows,
        role_permissions: rolePerms.rows,
        roles: roles.rows,
      });
    } catch (e) {
      console.error('[GET /api/permissions]', e);
      res.status(500).json({ error: 'Failed to load permissions' });
    }
  }
);

// POST /api/permissions
// Create a new permission definition
router.post(
  '/',
  checkPermission('roles.manage'),
  async (req, res) => {
    const { slug, label, description } = req.body || {};
    if (!slug || !label) {
      return res.status(400).json({ error: 'Slug and label are required.' });
    }

    try {
      const { rows } = await req.db.query(
        `insert into public.permissions (slug, label, description)
         values ($1, $2, $3)
         returning *`,
        [slug.trim(), label.trim(), description || null]
      );
      res.status(201).json(rows[0]);
    } catch (e) {
      console.error('[POST /api/permissions]', e);
      res.status(500).json({ error: 'Failed to create permission' });
    }
  }
);

// PATCH /api/permissions/:slug
// Update label/description of a permission
router.patch(
  '/:slug',
  checkPermission('roles.manage'),
  async (req, res) => {
    const { slug } = req.params;
    const { label, description } = req.body || {};

    try {
      const { rows } = await req.db.query(
        `update public.permissions
         set label = coalesce($2, label),
             description = coalesce($3, description),
             updated_at = now()
         where slug = $1
         returning *`,
        [slug, label || null, description || null]
      );
      if (!rows.length) {
        return res.status(404).json({ error: 'Permission not found' });
      }
      res.json(rows[0]);
    } catch (e) {
      console.error('[PATCH /api/permissions/:slug]', e);
      res.status(500).json({ error: 'Failed to update permission' });
    }
  }
);

// GET /api/permissions/by-role/:role_slug
// Returns permissions + whether that role has each one
router.get(
  '/by-role/:role_slug',
  async (req, res) => {
    const { role_slug } = req.params;
    const requestedRole = String(role_slug || '').toUpperCase();
    const ownRole = String(req.user?.role || '').toUpperCase();
    if (ownRole !== 'ADMIN' && requestedRole !== ownRole) {
      return res.status(403).json({ error: 'Cannot inspect another role' });
    }
    try {
      const perms = await req.db.query(
        'select * from public.permissions order by slug'
      );
      const rolePerms = await req.db.query(
        'select permission_slug, allowed from public.role_permissions where role_slug = $1',
        [role_slug]
      );
      const allowedMap = new Map(
        rolePerms.rows.map((r) => [r.permission_slug, r.allowed])
      );

      const result = perms.rows.map((p) => ({
        ...p,
        allowed: allowedMap.get(p.slug) === true,
      }));

      res.json(result);
    } catch (e) {
      console.error('[GET /api/permissions/by-role/:role_slug]', e);
      res.status(500).json({ error: 'Failed to load permissions for role' });
    }
  }
);

// POST /api/permissions/assign
// Assign / unassign a permission to a role
router.post(
  '/assign',
  checkPermission('roles.manage'),
  async (req, res) => {
    const { role_slug, permission_slug, allowed } = req.body || {};

    if (!role_slug || !permission_slug) {
      return res.status(400).json({ error: 'role_slug and permission_slug are required.' });
    }

    try {
      // Upsert based on (role_slug, permission_slug)
      const { rows } = await req.db.query(
        `insert into public.role_permissions (tenant_id, role_slug, permission_slug, allowed)
         values ($1, $2, $3, $4)
         on conflict (tenant_id, role_slug, permission_slug)
         do update set allowed = excluded.allowed
         returning *`,
        [req.tenantId, role_slug, permission_slug, !!allowed]
      );
      res.json(rows[0]);
    } catch (e) {
      console.error('[POST /api/permissions/assign]', e);
      res.status(500).json({ error: 'Failed to assign permission' });
    }
  }
);

export default router;
