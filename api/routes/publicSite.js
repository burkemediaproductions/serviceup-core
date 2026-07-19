// api/routes/publicSite.js
import express from 'express';

const router = express.Router();

/**
 * Load a Gadget, its enabled Gizmos, and a published Page entry.
 */
async function loadSitePayload(db, gadgetSlug, pageSlug) {
  // 1) Load gadget by slug
  const { rows: gadgetRows } = await db.query(
    'SELECT * FROM gadgets WHERE slug = $1 AND is_active = true LIMIT 1',
    [gadgetSlug],
  );

  if (!gadgetRows.length) {
    const err = new Error('Gadget not found');
    err.statusCode = 404;
    throw err;
  }

  const gadget = gadgetRows[0];

  // 2) Load gizmos attached to this gadget, if gadget_gizmos exists
  let gizmos = [];
  try {
    const { rows: gizmoRows } = await db.query(
      `
        SELECT g.*
        FROM gizmos g
        JOIN gadget_gizmos gg ON gg.gizmo_id = g.id
        WHERE gg.gadget_id = $1 AND g.is_enabled = true
        ORDER BY g.created_at ASC
      `,
      [gadget.id],
    );
    gizmos = gizmoRows;
  } catch (err) {
    console.error(
      '[publicSite] gizmos query failed (maybe no gadget_gizmos table yet)',
      err.message,
    );
  }

  // 3) Find the page content_type (support both 'page' and 'pages')
  const { rows: ctRows } = await db.query(
    `SELECT id FROM content_types WHERE slug IN ('page', 'pages') LIMIT 1`,
  );
  if (!ctRows.length) {
    const e = new Error('Content type "page/pages" not found');
    e.statusCode = 404;
    throw e;
  }
  const pageTypeId = ctRows[0].id;

  // 4) Load the page entry by slug
  const { rows: entryRows } = await db.query(
    `
      SELECT *
      FROM entries
      WHERE content_type_id = $1
        AND slug = $2
        AND lower(coalesce(status, '')) = 'published'
      LIMIT 1
    `,
    [pageTypeId, pageSlug],
  );

  if (!entryRows.length) {
    const e = new Error('Page entry not found');
    e.statusCode = 404;
    throw e;
  }

  const page = entryRows[0];

  return { gadget, gizmos, page };
}

/**
 * ORIGINAL ROUTE:
 * GET /api/sites/:gadgetSlug/pages/:pageSlug
 *
 * Returns:
 * {
 *   ok,
 *   gadget,
 *   gizmos,
 *   page
 * }
 */
router.get('/sites/:gadgetSlug/pages/:pageSlug', async (req, res) => {
  const { gadgetSlug, pageSlug } = req.params;

  try {
    const payload = await loadSitePayload(req.db, gadgetSlug, pageSlug);
    return res.json({ ok: true, ...payload });
  } catch (err) {
    const status = err.statusCode || 500;
    console.error('[GET /api/sites/:gadgetSlug/pages/:pageSlug] error', err);
    return res.status(status).json({
      ok: false,
      error: err.message || 'Server error',
    });
  }
});

/**
 * NEW ROUTE TO MATCH FRONTEND:
 * GET /api/public/pages/:pageSlug?gadget=serviceup-site
 *
 * Returns:
 *   { page: {...} }
 *
 * - If `gadget` is provided, it will try to use the same gadget-aware logic.
 * - If `gadget` is missing, it just loads the page by slug.
 */
router.get('/public/pages/:pageSlug', async (req, res) => {
  const { pageSlug } = req.params;
  const { gadget } = req.query || {};

  try {
    if (gadget) {
      // Use the same helper for gadget-aware loading
      const payload = await loadSitePayload(req.db, gadget, pageSlug);
      return res.json({ page: payload.page });
    }

    // No gadget: just load the page entry by slug.
    const { rows: ctRows } = await req.db.query(
      `SELECT id FROM content_types WHERE slug IN ('page', 'pages') LIMIT 1`,
    );
    if (!ctRows.length) {
      return res
        .status(404)
        .json({ error: 'Content type "page/pages" not found' });
    }
    const pageTypeId = ctRows[0].id;

    const { rows: entryRows } = await req.db.query(
      `
        SELECT *
        FROM entries
        WHERE content_type_id = $1
          AND slug = $2
          AND lower(coalesce(status, '')) = 'published'
        LIMIT 1
      `,
      [pageTypeId, pageSlug],
    );

    if (!entryRows.length) {
      return res.status(404).json({ error: 'Page entry not found' });
    }

    const page = entryRows[0];
    return res.json({ page });
  } catch (err) {
    console.error('[GET /api/public/pages/:pageSlug] error', err);
    return res.status(500).json({
      error: 'Failed to load page',
      detail: err.message,
    });
  }
});

export default router;
