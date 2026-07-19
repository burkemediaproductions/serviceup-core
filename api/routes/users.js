// api/routes/users.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { checkPermission } from '../middleware/checkPermission.js';

const router = Router();

/* Helpers ---------------------------------------------------------- */

function normalizeRole(role, fallback = 'EDITOR') {
  const r = typeof role === 'string' ? role.trim() : '';
  return (r || fallback).toUpperCase();
}

function parseBool(v, defaultValue = false) {
  if (v === undefined || v === null || v === '') return defaultValue;
  const s = String(v).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(s)) return false;
  return defaultValue;
}

async function syncRoleToSupabase(userRow) {
  if (!supabaseAdmin || !userRow.supabase_id) return;

  try {
    const metaPatch = {
      name: userRow.name || null,
    };

    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      userRow.supabase_id,
      {
        email: userRow.email,
        user_metadata: metaPatch,
      }
    );

    if (error) {
      console.error('[supabase sync] updateUserById error', error);
    }
  } catch (err) {
    console.error('[supabase sync] updateUserById failed', err);
  }
}

/* Routes ----------------------------------------------------------- */

// GET /api/users?q=search
router.get('/', checkPermission('users.manage'), async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const params = [req.tenantId];
    let sql = `
      select u.id, u.email, u.name, tu.role, tu.status,
             u.supabase_id, u.created_at, u.updated_at
        from public.users u
        join public.tenant_users tu on tu.user_id = u.id
       where tu.tenant_id = $1`;

    if (q) {
      sql += ` and (u.email ilike $2 or u.name ilike $2)`;
      params.push(`%${q}%`);
    }

    sql += ' order by u.created_at desc';

    const { rows } = await req.db.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('[GET /api/users]', e);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

/**
 * GET /api/users/picker?q=mic&role=ADMIN&onlyActive=true&limit=20
 * Lightweight endpoint intended for user relationship pickers in the admin UI.
 */
router.get('/picker', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const role = String(req.query.role || '').trim();
    const onlyActive = parseBool(req.query.onlyActive, true);
    const limitRaw = parseInt(String(req.query.limit || '20'), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;

    const params = [req.tenantId];
    let where = 'where tu.tenant_id = $1';

    if (q) {
      params.push(`%${q}%`);
      where += ` and (u.email ilike $${params.length} or u.name ilike $${params.length})`;
    }

    if (role) {
      params.push(normalizeRole(role, role));
      where += ` and tu.role = $${params.length}`;
    }

    if (onlyActive) {
      where += ` and tu.status = 'active'`;
    }

    params.push(limit);

    const sql = `
      select u.id, u.email, u.name, tu.role, tu.status
      from public.users u
      join public.tenant_users tu on tu.user_id = u.id
      ${where}
      order by name asc nulls last, email asc
      limit $${params.length}
    `;

    const { rows } = await req.db.query(sql, params);
    res.json({ ok: true, users: rows });
  } catch (e) {
    console.error('[GET /api/users/picker]', e);
    res.status(500).json({ error: 'Failed to load picker users' });
  }
});

/**
 * POST /api/users/resolve
 * Body: { ids: ["uuid", "uuid"] }
 * Returns a map for fast lookup: { ok: true, users: [{id,name,email,role,status}], byId: { [id]: user } }
 *
 * This is a key building block for "Option B" (auto-expanding relation_user fields).
 */
router.post('/resolve', async (req, res) => {
  try {
    const idsRaw = req.body?.ids;
    const ids = Array.isArray(idsRaw)
      ? idsRaw.map((x) => String(x).trim()).filter(Boolean)
      : [];

    if (!ids.length) {
      return res.json({ ok: true, users: [], byId: {} });
    }

    const { rows } = await req.db.query(
      `
        select u.id, u.email, u.name, tu.role, tu.status
        from public.users u
        join public.tenant_users tu on tu.user_id = u.id
        where tu.tenant_id = $1
          and u.id = any($2::uuid[])
      `,
      [req.tenantId, ids]
    );

    const byId = {};
    for (const u of rows) byId[u.id] = u;

    res.json({ ok: true, users: rows, byId });
  } catch (e) {
    console.error('[POST /api/users/resolve]', e);
    res.status(500).json({ error: 'Failed to resolve users' });
  }
});

// POST /api/users
router.post('/', checkPermission('users.manage'), async (req, res) => {
  const { email, name, password, role = 'EDITOR' } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const normalizedRole = normalizeRole(role, 'EDITOR');

    // A global identity may already belong to another tenant.
    const { rows: existing } = await req.db.query(
      'select id, email, name, supabase_id from public.users where email = $1 limit 1',
      [email.trim().toLowerCase()]
    );
    if (existing.length) {
      const identity = existing[0];
      const membership = await req.db.query(
        `insert into public.tenant_users (tenant_id, user_id, role, status)
         values ($1, $2, $3, 'active')
         on conflict (tenant_id, user_id) do nothing
         returning role, status`,
        [req.tenantId, identity.id, normalizedRole],
      );
      if (!membership.rows.length) {
        return res.status(409).json({ error: 'That user already belongs to this client.' });
      }
      return res.status(201).json({
        ...identity,
        role: normalizedRole,
        status: 'active',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create Supabase auth user first (if configured)
    let supabaseId = null;
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: email.trim().toLowerCase(),
          password,
          email_confirm: true,
          user_metadata: {
            name: name || null,
          },
        });
        if (error) {
          console.error('[supabase] createUser error', error);
        } else if (data?.user?.id) {
          supabaseId = data.user.id;
        }
      } catch (err) {
        console.error('[supabase] createUser exception', err);
      }
    }

    // Insert into our local users table
    const { rows } = await req.db.query(
      `insert into public.users (email, name, password_hash, role, status, supabase_id)
       values ($1, $2, $3, $4, 'ACTIVE', $5)
       returning id, email, name, role, status, supabase_id, created_at, updated_at`,
      [
        email.trim().toLowerCase(),
        name || null,
        passwordHash,
        normalizedRole,
        supabaseId,
      ]
    );

    const user = rows[0];
    await req.db.query(
      `insert into public.tenant_users (tenant_id, user_id, role, status)
       values ($1, $2, $3, 'active')`,
      [req.tenantId, user.id, normalizedRole],
    );
    res.status(201).json({ ...user, role: normalizedRole, status: 'active' });
  } catch (e) {
    console.error('[POST /api/users]', e);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PATCH /api/users/:id
router.patch('/:id', checkPermission('users.manage'), async (req, res) => {
  const { id } = req.params;
  const { email, name, password, role, status } = req.body || {};

  try {
    const { rows: existingRows } = await req.db.query(
      `select u.*, tu.role as tenant_role, tu.status as tenant_status
         from public.users u
         join public.tenant_users tu on tu.user_id = u.id
        where u.id = $1 and tu.tenant_id = $2`,
      [id, req.tenantId]
    );
    if (!existingRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    const existing = existingRows[0];

    const newEmail = email ? email.trim().toLowerCase() : existing.email;
    const newName = typeof name === 'string' ? name : existing.name;
    const newRole = role ? normalizeRole(role, existing.tenant_role) : existing.tenant_role;
    const newStatus = String(status || existing.tenant_status || 'active').toLowerCase();

    let newPasswordHash = existing.password_hash;
    if (password && password.trim()) {
      newPasswordHash = await bcrypt.hash(password.trim(), 10);
    }

    const { rows } = await req.db.query(
      `update public.users
       set email = $1,
           name = $2,
           password_hash = $3
       where id = $4
       returning id, email, name, supabase_id, created_at, updated_at`,
      [newEmail, newName, newPasswordHash, id]
    );

    await req.db.query(
      `update public.tenant_users
          set role = $1, status = $2, updated_at = now()
        where tenant_id = $3 and user_id = $4`,
      [newRole, newStatus, req.tenantId, id],
    );

    const user = { ...rows[0], role: newRole, status: newStatus };

    // Sync to Supabase auth, if applicable
    await syncRoleToSupabase(user);

    res.json(user);
  } catch (e) {
    console.error('[PATCH /api/users/:id]', e);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', checkPermission('users.manage'), async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: existingRows } = await req.db.query(
      `delete from public.tenant_users
        where tenant_id = $1 and user_id = $2
        returning user_id`,
      [req.tenantId, id]
    );
    if (!existingRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    const remaining = await req.db.query(
      'select count(*)::int as count from public.tenant_users where user_id = $1',
      [id],
    );
    if (remaining.rows[0].count > 0) {
      return res.json({ ok: true, identityRetained: true });
    }

    const deletedIdentity = await req.db.query(
      'delete from public.users where id = $1 returning id, supabase_id',
      [id],
    );
    const deleted = deletedIdentity.rows[0];

    if (supabaseAdmin && deleted.supabase_id) {
      try {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(
          deleted.supabase_id
        );
        if (error) {
          console.error('[supabase] deleteUser error', error);
        }
      } catch (err) {
        console.error('[supabase] deleteUser exception', err);
      }
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/users/:id]', e);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
