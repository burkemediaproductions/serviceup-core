import { Router } from 'express';
import { checkPermission } from '../middleware/checkPermission.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const router = Router();
const allowedBuckets = new Set(['uploads-public', 'uploads-private']);

router.use(checkPermission('pixels.manage'));

router.get('/', async (req, res) => {
  const search = String(req.query.q || '').trim();
  const mime = String(req.query.mime || '').trim();
  try {
    const { rows } = await req.db.query(
      `select id, title, original_name, bucket, storage_path, public_url,
              mime_type, size_bytes, alt_text, caption, uploaded_by,
              created_at, updated_at
         from pixels
        where ($1 = '' or title ilike '%' || $1 || '%'
                      or coalesce(original_name, '') ilike '%' || $1 || '%'
                      or coalesce(alt_text, '') ilike '%' || $1 || '%')
          and ($2 = '' or coalesce(mime_type, '') like $2 || '%')
        order by created_at desc
        limit 500`,
      [search, mime],
    );
    return res.json(rows);
  } catch (error) {
    console.error('[GET /api/pixels]', error);
    return res.status(500).json({ error: 'Failed to load Pixels' });
  }
});

router.post('/', async (req, res) => {
  const body = req.body || {};
  const bucket = String(body.bucket || '');
  const storagePath = String(body.storage_path || '');
  const title = String(body.title || body.original_name || '').trim();

  if (!title || !allowedBuckets.has(bucket) || !storagePath.startsWith(`${req.tenantId}/`)) {
    return res.status(400).json({ error: 'Valid title, bucket, and tenant storage path are required' });
  }

  let publicUrl = null;
  if (bucket === 'uploads-public' && supabaseAdmin) {
    publicUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath).data?.publicUrl || null;
  }

  try {
    const { rows } = await req.db.query(
      `insert into pixels
         (tenant_id, title, original_name, bucket, storage_path, public_url,
          mime_type, size_bytes, alt_text, caption, uploaded_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       returning *`,
      [
        req.tenantId, title, body.original_name || null, bucket, storagePath,
        publicUrl, body.mime_type || null, Number.isFinite(Number(body.size_bytes))
          ? Number(body.size_bytes) : null,
        body.alt_text || null, body.caption || null, req.user.id,
      ],
    );
    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error('[POST /api/pixels]', error);
    if (error.code === '23505') return res.status(409).json({ error: 'That file is already registered' });
    return res.status(500).json({ error: 'Failed to register Pixel' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { rows } = await req.db.query(
      `update pixels
          set title = coalesce(nullif($2, ''), title),
              alt_text = $3,
              caption = $4,
              updated_at = now()
        where id = $1
        returning *`,
      [req.params.id, String(req.body?.title || '').trim(), req.body?.alt_text || null, req.body?.caption || null],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Pixel not found' });
    return res.json(rows[0]);
  } catch (error) {
    console.error('[PATCH /api/pixels/:id]', error);
    return res.status(500).json({ error: 'Failed to update Pixel' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await req.db.query(
      'select bucket, storage_path from pixels where id = $1 limit 1',
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Pixel not found' });
    if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase Storage is not configured' });

    const { error } = await supabaseAdmin.storage
      .from(rows[0].bucket)
      .remove([rows[0].storage_path]);
    if (error) throw error;
    await req.db.query('delete from pixels where id = $1', [req.params.id]);
    return res.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/pixels/:id]', error);
    return res.status(500).json({ error: 'Failed to delete Pixel' });
  }
});

export default router;
