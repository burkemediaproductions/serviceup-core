import { Router } from 'express';
import auth from '../middleware/auth.js';

/**
 * Settings router
 *
 * This router exposes two endpoints for reading and writing application‑wide
 * settings from the database. All settings are stored as a single JSON
 * document under the key "global" in the `app_settings` table. If no row
 * exists yet, the GET handler will return an empty object. The PUT handler
 * will upsert the row and return the saved settings.
 */
const router = Router();

// GET / → load the "global" settings blob
router.get('/', async (req, res) => {
  try {
    const { rows } = await req.db.query(
      'SELECT value FROM app_settings WHERE key = $1 LIMIT 1',
      ['global'],
    );
    if (rows.length > 0) {
      // Postgres will automatically cast jsonb to JS object
      res.json(rows[0].value || {});
    } else {
      // No record yet; return empty object
      res.json({});
    }
  } catch (err) {
    console.error('[GET /api/settings] failed to load settings', err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// PUT / → upsert the "global" settings blob
router.put('/', auth, async (req, res) => {
  const incoming = req.body || {};
  try {
    // Use an upsert to either insert or update the row. We also update
    // updated_at via the table trigger defined in the schema (if any).
    await req.db.query(
      `INSERT INTO app_settings (tenant_id, key, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, key) DO UPDATE
       SET value = EXCLUDED.value,
           updated_at = now()`,
      [req.tenantId, 'global', incoming],
    );
    res.json(incoming);
  } catch (err) {
    console.error('[PUT /api/settings] failed to save settings', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

export default router;
