import express from 'express';
import { checkPermission } from '../middleware/checkPermission.js';

const router = express.Router();

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeMenuItems(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 100).map((item, index) => ({
    id: String(item?.id || `menu-item-${index + 1}`).slice(0, 100),
    label: String(item?.label || '').trim().slice(0, 160),
    url: String(item?.url || '').trim().slice(0, 2048),
    target: item?.target === '_blank' ? '_blank' : '_self',
  })).filter((item) => item.label && item.url);
}

router.get('/', checkPermission('manage_content_types'), async (req, res) => {
  try {
    const { rows } = await req.db.query(
      `select id, label, slug, config, created_at, updated_at
         from public.menus
        order by label asc, created_at asc`
    );
    return res.json(rows);
  } catch (err) {
    console.error('[GET /api/menus]', err);
    return res.status(500).json({ error: 'Failed to load menus' });
  }
});

router.post('/', checkPermission('manage_content_types'), async (req, res) => {
  const label = String(req.body?.label || '').trim();
  if (!label) return res.status(400).json({ error: 'Menu label is required' });

  const baseSlug = slugify(req.body?.slug || label) || 'menu';

  try {
    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const existing = await req.db.query(
        'select 1 from public.menus where slug = $1 limit 1',
        [slug]
      );
      if (!existing.rows.length) break;
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    const { rows } = await req.db.query(
      `insert into public.menus (label, slug, config)
       values ($1, $2, $3::jsonb)
       returning id, label, slug, config, created_at, updated_at`,
      [label, slug, JSON.stringify({ items: [] })]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /api/menus]', err);
    return res.status(500).json({ error: 'Failed to create menu' });
  }
});

router.get('/:id', checkPermission('manage_content_types'), async (req, res) => {
  try {
    const { rows } = await req.db.query(
      `select id, label, slug, config, created_at, updated_at
         from public.menus where id = $1::uuid limit 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Menu not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('[GET /api/menus/:id]', err);
    return res.status(500).json({ error: 'Failed to load menu' });
  }
});

router.put('/:id', checkPermission('manage_content_types'), async (req, res) => {
  const label = String(req.body?.label || '').trim();
  const slug = slugify(req.body?.slug || label);
  if (!label) return res.status(400).json({ error: 'Menu label is required' });
  if (!slug) return res.status(400).json({ error: 'Menu slug is required' });
  const config = { items: normalizeMenuItems(req.body?.config?.items ?? req.body?.items) };

  try {
    const { rows } = await req.db.query(
      `update public.menus
          set label = $1, slug = $2, config = $3::jsonb, updated_at = now()
        where id = $4::uuid
        returning id, label, slug, config, created_at, updated_at`,
      [label, slug, JSON.stringify(config), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Menu not found' });
    return res.json(rows[0]);
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Another menu already uses that slug' });
    }
    console.error('[PUT /api/menus/:id]', err);
    return res.status(500).json({ error: 'Failed to save menu' });
  }
});

router.delete('/:id', checkPermission('manage_content_types'), async (req, res) => {
  try {
    const result = await req.db.query(
      'delete from public.menus where id = $1::uuid returning id',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Menu not found' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/menus/:id]', err);
    return res.status(500).json({ error: 'Failed to delete menu' });
  }
});

export default router;
