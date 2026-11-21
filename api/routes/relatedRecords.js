import { Router } from 'express';

const router = Router();
const safeKey = (value) => /^[a-zA-Z][\w]*$/.test(String(value || ''));
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));

function relationTarget(config = {}) {
  const relation = config?.relation && typeof config.relation === 'object' ? config.relation : {};
  const raw = relation.content_type_slug || relation.contentType || relation.content_type || relation.slug ||
    config.relatedType || config.content_type || config.contentType || config.targetType || config.target;
  return typeof raw === 'object' ? raw.slug || raw.content_type || raw.relatedType : raw;
}

function idsFromValue(value) {
  const values = Array.isArray(value) ? value : [value];
  return values.map((item) => typeof item === 'object' ? item?.id || item?.value : item)
    .map((item) => String(item || '').trim()).filter(isUuid);
}

router.get('/related-records/:targetType/:targetId', async (req, res) => {
  const sourceType = String(req.query.source_type || '').trim();
  const relationshipField = String(req.query.relationship_field || '').trim();
  const statusField = String(req.query.status_field || '').trim();
  const statuses = String(req.query.status || '').split(',').map((v) => v.trim()).filter(Boolean);
  if (!sourceType || !safeKey(relationshipField) || (statusField && !safeKey(statusField))) {
    return res.status(400).json({ error: 'source_type and a valid relationship_field are required' });
  }
  try {
    const target = await req.db.query(
      `select e.id,e.slug from entries e join content_types ct on ct.id=e.content_type_id
       where ct.slug=$1 and (e.id::text=$2 or e.slug=$2) limit 1`,
      [req.params.targetType, req.params.targetId],
    );
    if (!target.rows[0]) return res.status(404).json({ error: 'Target entry not found' });
    const source = await req.db.query('select id from content_types where slug=$1 limit 1', [sourceType]);
    if (!source.rows[0]) return res.status(404).json({ error: 'Source content type not found' });
    const field = await req.db.query(
      'select type,config from content_fields where content_type_id=$1 and field_key=$2 limit 1',
      [source.rows[0].id, relationshipField],
    );
    if (!field.rows[0] || !['relation', 'relationship'].includes(String(field.rows[0].type).toLowerCase())) {
      return res.status(400).json({ error: 'Configured field is not a relationship' });
    }
    const configuredTarget = relationTarget(field.rows[0].config || {});
    if (configuredTarget && configuredTarget !== req.params.targetType) {
      return res.status(400).json({ error: 'Relationship points to a different content type' });
    }
    const params = [source.rows[0].id, relationshipField, target.rows[0].id, target.rows[0].slug];
    let statusSql = '';
    if (statusField && statuses.length) {
      params.push(statusField, statuses);
      statusSql = `and coalesce(e.data->>$5,'') = any($6::text[])`;
    }
    const result = await req.db.query(
      `select e.* from entries e where e.content_type_id=$1
       and (e.data->>$2 = $3::text or e.data->>$2 = $4 or e.data-> $2 @> to_jsonb(array[$3::text]))
       ${statusSql} order by e.updated_at desc nulls last,e.created_at desc`,
      params,
    );
    const relationFields = (await req.db.query(
      `select field_key,config from content_fields where content_type_id=$1 and lower(type) in ('relation','relationship')`,
      [source.rows[0].id],
    )).rows;
    const labels = new Map();
    for (const def of relationFields) {
      const ids = [...new Set(result.rows.flatMap((row) => idsFromValue(row.data?.[def.field_key])))];
      if (!ids.length) continue;
      const found = await req.db.query('select id,title,slug from entries where id=any($1::uuid[])', [ids]);
      labels.set(def.field_key, Object.fromEntries(found.rows.map((row) => [row.id, row.title || row.slug || row.id])));
    }
    res.json(result.rows.map((row) => ({
      ...row,
      _relationship_labels: Object.fromEntries([...labels].map(([key, map]) => [key, map])),
    })));
  } catch (error) {
    console.error('[GET /related-records]', error);
    res.status(500).json({ error: 'Could not load related records' });
  }
});

export default router;
