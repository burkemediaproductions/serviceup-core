// api/middleware/checkPermission.js
/**
 * Simple in-memory cache so we don’t hit DB on every request.
 * Safe to clear on redeploy.
 */
const rolePermCache = new Map();
let lastCacheLoad = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

async function loadPermissionsIntoCache(db, tenantId) {
  const now = Date.now();
  if (now - lastCacheLoad < CACHE_TTL_MS && rolePermCache.has(`loaded::${tenantId}`)) return;

  const { rows } = await db.query(`
    select role_slug, permission_slug, allowed
    from public.role_permissions
  `);

  for (const row of rows) {
    const key = `${tenantId}::${row.role_slug.toUpperCase()}::${row.permission_slug}`;
    rolePermCache.set(key, !!row.allowed);
  }
  rolePermCache.set(`loaded::${tenantId}`, true);
  lastCacheLoad = now;
}

/**
 * Single-permission guard.
 * Example: router.get('/api/users', auth, checkPermission('roles.manage'), handler)
 */
export function checkPermission(permissionSlug) {
  return async function (req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthenticated' });
      }

      const role = (req.user.role || '').toUpperCase();

      // 🔓 SUPERUSER BYPASS
      // ADMIN can do everything, even if role_permissions table is empty.
      if (role === 'ADMIN') {
        return next();
      }

      await loadPermissionsIntoCache(req.db, req.tenantId);

      const key = `${req.tenantId}::${role}::${permissionSlug}`;
      const allowed = rolePermCache.get(key);

      if (!allowed) {
        return res
          .status(403)
          .json({ error: `Forbidden: missing permission ${permissionSlug}` });
      }

      next();
    } catch (err) {
      console.error('[checkPermission]', err);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

/**
 * Multi-permission guard – allow if the user has *any* of the given permissions.
 * Example: checkAnyPermission(['entries.manage', 'entries.edit:movie'])
 */
export function checkAnyPermission(permissionSlugs = []) {
  return async function (req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthenticated' });
      }

      const role = (req.user.role || '').toUpperCase();

      // 🔓 SUPERUSER BYPASS
      if (role === 'ADMIN') {
        return next();
      }

      if (!permissionSlugs.length) {
        return res
          .status(500)
          .json({ error: 'Permission check misconfigured (no permissions provided)' });
      }

      await loadPermissionsIntoCache(req.db, req.tenantId);

      let ok = false;
      for (const slug of permissionSlugs) {
        const key = `${req.tenantId}::${role}::${slug}`;
        if (rolePermCache.get(key)) {
          ok = true;
          break;
        }
      }

      if (!ok) {
        return res.status(403).json({
          error: `Forbidden: requires one of [${permissionSlugs.join(', ')}]`,
        });
      }

      next();
    } catch (err) {
      console.error('[checkAnyPermission]', err);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}
