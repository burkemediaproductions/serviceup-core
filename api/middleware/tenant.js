import { pool } from '../dbPool.js';
import {
  DEFAULT_TENANT_ID,
  IS_DEDICATED,
  SERVICEUP_MODE,
  SERVICEUP_DB_ROLE,
} from '../lib/deployment.js';

function normalizeHostname(value = '') {
  try {
    const candidate = value.includes('://') ? new URL(value).hostname : value;
    return String(candidate || '').split(':')[0].trim().toLowerCase();
  } catch {
    return '';
  }
}

function requestedTenant(req) {
  const webhookTenant = String(req.originalUrl || req.url || '').match(
    /^\/api\/gizmos\/[^/]+\/webhook\/([^/?#]+)/,
  );
  if (webhookTenant?.[1]) {
    return { type: 'key', value: decodeURIComponent(webhookTenant[1]) };
  }

  const explicit = String(req.headers['x-serviceup-tenant'] || '').trim();
  if (explicit) return { type: 'key', value: explicit };

  const originHost = normalizeHostname(req.headers.origin || '');
  if (originHost) return { type: 'domain', value: originHost };

  const forwardedHost = normalizeHostname(req.headers['x-forwarded-host'] || '');
  if (forwardedHost) return { type: 'domain', value: forwardedHost };

  const host = normalizeHostname(req.headers.host || '');
  if (host) return { type: 'domain', value: host };

  return null;
}

export async function resolveTenant(req, res, next) {
  try {
    if (IS_DEDICATED) {
      req.tenant = { id: DEFAULT_TENANT_ID, mode: SERVICEUP_MODE };
      return next();
    }

    const requested = requestedTenant(req);
    if (!requested) {
      return res.status(400).json({ error: 'Unable to determine ServiceUp tenant' });
    }

    const result = requested.type === 'domain'
      ? await pool.query(
          `SELECT t.id, t.slug, t.name, t.status
             FROM tenant_domains d
             JOIN tenants t ON t.id = d.tenant_id
            WHERE lower(d.domain) = lower($1)
              AND d.is_active = true
              AND t.status = 'active'
            LIMIT 1`,
          [requested.value],
        )
      : await pool.query(
          `SELECT id, slug, name, status
             FROM tenants
            WHERE (id::text = $1 OR lower(slug) = lower($1))
              AND status = 'active'
            LIMIT 1`,
          [requested.value],
        );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Unknown ServiceUp tenant' });
    }

    req.tenant = { ...result.rows[0], mode: SERVICEUP_MODE };
    return next();
  } catch (error) {
    console.error('[resolveTenant]', error);
    return res.status(500).json({ error: 'Tenant resolution failed' });
  }
}

export async function tenantDatabaseSession(req, res, next) {
  const tenantId = req.tenant?.id;
  if (!tenantId) {
    return res.status(500).json({ error: 'Tenant context missing' });
  }

  const client = await pool.connect();
  let closed = false;

  async function close(commit) {
    if (closed) return;
    closed = true;
    try {
      await client.query(commit ? 'COMMIT' : 'ROLLBACK');
    } catch (error) {
      console.error('[tenantDatabaseSession] close failed', error);
    } finally {
      client.release();
    }
  }

  try {
    await client.query('BEGIN');
    if (!/^[a-z_][a-z0-9_]*$/i.test(SERVICEUP_DB_ROLE)) {
      throw new Error('Invalid SERVICEUP_DB_ROLE');
    }
    await client.query(`SET LOCAL ROLE "${SERVICEUP_DB_ROLE}"`);
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
    req.db = client;
    req.tenantId = tenantId;

    res.on('finish', () => void close(res.statusCode < 500));
    res.on('close', () => void close(false));
    return next();
  } catch (error) {
    await close(false);
    console.error('[tenantDatabaseSession]', error);
    return res.status(500).json({ error: 'Unable to establish tenant database session' });
  }
}

export async function requireTenantMembership(req, res, next) {
  if (!req.user?.id || !req.tenantId) {
    return res.status(401).json({ error: 'Unauthenticated tenant request' });
  }

  try {
    const { rows } = await req.db.query(
      `SELECT role, status
         FROM tenant_users
        WHERE tenant_id = $1 AND user_id = $2
        LIMIT 1`,
      [req.tenantId, req.user.id],
    );
    const membership = rows[0];
    if (!membership || membership.status !== 'active') {
      return res.status(403).json({ error: 'No active membership for this tenant' });
    }

    req.membership = membership;
    req.user = { ...req.user, role: membership.role, tenant_id: req.tenantId };
    return next();
  } catch (error) {
    console.error('[requireTenantMembership]', error);
    return res.status(500).json({ error: 'Tenant membership check failed' });
  }
}
