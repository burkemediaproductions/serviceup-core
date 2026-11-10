import { Router } from 'express';
import { checkPermission } from '../middleware/checkPermission.js';

const router = Router();
const guard = checkPermission('roles.manage');
const FORMAT = 'serviceup-tenant-migration/v1';
const SECTIONS = ['content_types', 'taxonomies', 'menus', 'entries', 'entry_views', 'list_views', 'dashboard'];
const list = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value || '').trim();
const roleList = (value) => list(value).map((role) => text(role).toUpperCase()).filter(Boolean);

function summarize(manifest = {}) {
  return {
    content_types: list(manifest.content_types).length,
    fields: list(manifest.content_types).reduce((sum, type) => sum + list(type.fields).length, 0),
    panel_definitions: list(manifest.panel_definitions).length,
    taxonomies: list(manifest.taxonomies).length,
    terms: list(manifest.taxonomies).reduce((sum, taxonomy) => sum + list(taxonomy.terms).length, 0),
    menus: list(manifest.menus).length,
    entries: list(manifest.entries).length,
    media_inventory: list(manifest.media).length,
    entry_views: list(manifest.entry_views).length,
    list_views: list(manifest.list_views).length,
    dashboard_navigation: list(manifest.dashboard?.navigation).length,
    dashboard_widgets: list(manifest.dashboard?.widgets).length,
  };
}

function validate(manifest, tenant) {
  const errors = [], warnings = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { errors: ['The uploaded file is not a ServiceUp migration object.'], warnings };
  }
  if (manifest.format !== FORMAT) errors.push(`Unsupported format. Expected ${FORMAT}.`);
  if (!text(manifest.tenant_slug)) errors.push('tenant_slug is required.');
  if (tenant?.slug && text(manifest.tenant_slug).toLowerCase() !== text(tenant.slug).toLowerCase()) {
    errors.push(`This package is for “${manifest.tenant_slug}”, but this dashboard is “${tenant.slug}”.`);
  }
  const typeSlugs = new Set();
  list(manifest.content_types).forEach((type, index) => {
    const slug = text(type?.slug);
    if (!slug) errors.push(`Content type ${index + 1} has no slug.`);
    if (slug && typeSlugs.has(slug)) errors.push(`Duplicate content type slug: ${slug}.`);
    typeSlugs.add(slug);
    if (!text(type?.singular) || !text(type?.plural)) errors.push(`Content type ${slug || index + 1} needs singular and plural labels.`);
    const keys = new Set();
    list(type?.fields).forEach((field) => {
      const key = text(field?.key || field?.field_key);
      if (!key) errors.push(`Content type ${slug || index + 1} contains a field without a key.`);
      if (key && keys.has(key)) errors.push(`Duplicate field ${key} in ${slug}.`);
      keys.add(key);
    });
  });
  list(manifest.entries).forEach((entry, index) => {
    if (!text(entry?.content_type_slug)) errors.push(`Entry ${index + 1} has no content_type_slug.`);
    if (!text(entry?.slug)) errors.push(`Entry ${index + 1} has no slug.`);
    if (text(entry?.content_type_slug) && !typeSlugs.has(text(entry.content_type_slug))) {
      warnings.push(`Entry “${entry?.title || entry?.slug || index + 1}” references a type not included in the package.`);
    }
  });
  if (list(manifest.media).length) warnings.push(`${manifest.media.length} media records are inventory-only; files are not uploaded by this import.`);
  return { errors, warnings };
}

async function backupTenant(db, tenant) {
  const content_types = (await db.query('select * from content_types order by slug')).rows;
  const ids = content_types.map((row) => row.id);
  const content_fields = ids.length ? (await db.query('select * from content_fields where content_type_id=any($1::uuid[]) order by content_type_id, order_index', [ids])).rows : [];
  const entries = ids.length ? (await db.query('select * from entries where content_type_id=any($1::uuid[]) order by content_type_id, slug', [ids])).rows : [];
  const taxonomies = (await db.query('select * from taxonomies order by slug')).rows;
  const taxonomyIds = taxonomies.map((row) => row.id);
  const terms = taxonomyIds.length ? (await db.query('select * from terms where taxonomy_id=any($1::uuid[]) order by taxonomy_id, name', [taxonomyIds])).rows : [];
  const menus = (await db.query('select * from menus order by slug')).rows;
  const entry_views = ids.length ? (await db.query('select * from entry_editor_views where content_type_id=any($1::uuid[]) order by content_type_id, slug', [ids])).rows : [];
  const list_views = ids.length ? (await db.query('select * from entry_list_views where content_type_id=any($1::uuid[]) order by content_type_id, slug', [ids])).rows : [];
  const settings = (await db.query("select value from app_settings where key='global' limit 1")).rows[0]?.value || {};
  const dashboard_layouts = (await db.query('select * from dashboard_layouts order by role nulls last, user_id nulls last')).rows;
  return { format: 'serviceup-tenant-export/v1', exported_at: new Date().toISOString(), tenant, content_types, content_fields, entries, taxonomies, terms, menus, entry_views, list_views, settings, dashboard_layouts };
}

// Older ServiceUp exports used the database-shaped `serviceup-tenant-export/v1`
// format, while Import expects the portable migration shape. Normalize those
// exports so a file downloaded from Import & Export can be uploaded again.
function normalizeManifest(input = {}) {
  if (input?.format !== 'serviceup-tenant-export/v1') return input;

  const types = list(input.content_types);
  const typeSlugById = new Map(types.map((type) => [type.id, text(type.slug)]));
  const dashboardLayouts = list(input.dashboard_layouts);
  const dashboardLayout = [...dashboardLayouts]
    .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
    .find((row) => row.user_id || String(row.role || '').toUpperCase() === 'ADMIN')
    || dashboardLayouts[0];
  const termsByTaxonomy = new Map();
  for (const term of list(input.terms)) {
    const values = termsByTaxonomy.get(term.taxonomy_id) || [];
    values.push({ name: term.name, slug: term.slug, description: term.description, image: term.image, seo: term.seo });
    termsByTaxonomy.set(term.taxonomy_id, values);
  }

  return {
    format: FORMAT,
    exported_at: input.exported_at,
    tenant_slug: text(input.tenant?.slug),
    source: { site: 'ServiceUp tenant export' },
    content_types: types.map((type) => ({
      slug: type.slug,
      singular: type.label_singular || type.name,
      plural: type.label_plural || type.name,
      type: type.type,
      description: type.description,
      icon: type.icon,
      fields: list(input.content_fields)
        .filter((field) => field.content_type_id === type.id)
        .map((field) => ({
          key: field.field_key,
          label: field.label,
          type: field.type,
          required: field.required,
          help_text: field.help_text,
          order_index: field.order_index,
          config: field.config || {},
        })),
    })),
    entries: list(input.entries).map((entry) => ({
      content_type_slug: typeSlugById.get(entry.content_type_id),
      title: entry.title,
      slug: entry.slug,
      status: entry.status,
      data: entry.data || {},
    })),
    taxonomies: list(input.taxonomies).map((taxonomy) => ({
      slug: taxonomy.slug,
      label: taxonomy.label,
      is_hierarchical: taxonomy.is_hierarchical,
      terms: termsByTaxonomy.get(taxonomy.id) || [],
    })),
    menus: list(input.menus).map((menu) => ({
      label: menu.label,
      slug: menu.slug,
      items: list(menu.config?.items),
    })),
    entry_views: list(input.entry_views).map((view) => ({
      content_type_slug: typeSlugById.get(view.content_type_id),
      slug: view.slug,
      label: view.label,
      roles: view.config?.roles || (view.role ? [view.role] : []),
      default_roles: view.config?.default_roles || (view.is_default && view.role ? [view.role] : []),
      core: view.config?.core || {},
      sections: view.config?.sections || view.config?.widgets || [],
    })),
    list_views: list(input.list_views).map((view) => ({
      content_type_slug: typeSlugById.get(view.content_type_id),
      slug: view.slug,
      label: view.label,
      roles: view.config?.roles || (view.role ? [view.role] : []),
      default_roles: view.config?.default_roles || (view.is_default && view.role ? [view.role] : []),
      config: view.config || {},
    })),
    dashboard: {
      settings: input.settings || {},
      navigation: list(input.settings?.navSidebar).map((item) => ({
        label: item.label,
        url: item.to || item.url,
        roles: item.roles || [],
      })),
      widgets: list(dashboardLayout?.layout),
    },
  };
}

async function conflicts(db, manifest) {
  const typeSlugs = list(manifest.content_types).map((item) => text(item.slug)).filter(Boolean);
  const menuSlugs = list(manifest.menus).map((item) => text(item.slug)).filter(Boolean);
  const types = typeSlugs.length ? (await db.query('select slug from content_types where slug=any($1::text[])', [typeSlugs])).rows : [];
  const menus = menuSlugs.length ? (await db.query('select slug from menus where slug=any($1::text[])', [menuSlugs])).rows : [];
  return { existing_content_types: types.map((row) => row.slug), existing_menus: menus.map((row) => row.slug) };
}

router.post('/validate', guard, async (req, res) => {
  try {
    const manifest = normalizeManifest(req.body?.manifest);
    const result = validate(manifest, req.tenant);
    const found = result.errors.length ? { existing_content_types: [], existing_menus: [] } : await conflicts(req.db, manifest);
    return res.status(result.errors.length ? 400 : 200).json({ ok: !result.errors.length, tenant: req.tenant, summary: summarize(manifest), conflicts: found, available_sections: SECTIONS, ...result });
  } catch (error) {
    console.error('[tenant-transfer validate]', error);
    return res.status(500).json({ error: 'Could not validate this package.' });
  }
});

router.get('/export', guard, async (req, res) => {
  try { return res.json(normalizeManifest(await backupTenant(req.db, req.tenant))); }
  catch (error) { console.error('[tenant-transfer export]', error); return res.status(500).json({ error: 'Could not export this tenant.' }); }
});

router.get('/history', guard, async (req, res) => {
  try {
    const { rows } = await req.db.query('select id, manifest_format, source_name, status, selected_sections, summary, created_at from tenant_imports order by created_at desc limit 20');
    return res.json(rows);
  } catch (error) { return res.status(500).json({ error: 'Could not load import history. Apply migration 009 first.' }); }
});

router.get('/backups/:id', guard, async (req, res) => {
  try {
    const { rows } = await req.db.query('select backup from tenant_imports where id=$1::uuid limit 1', [req.params.id]);
    return rows[0] ? res.json(rows[0].backup) : res.status(404).json({ error: 'Backup not found.' });
  } catch { return res.status(500).json({ error: 'Could not load this backup.' }); }
});

router.post('/import', guard, async (req, res) => {
  const manifest = normalizeManifest(req.body?.manifest);
  const dryRun = req.body?.dry_run !== false;
  const requested = list(req.body?.sections);
  const selected = (requested.length ? requested : SECTIONS).filter((section) => SECTIONS.includes(section));
  const checked = validate(manifest, req.tenant);
  if (checked.errors.length) return res.status(400).json({ ok: false, summary: summarize(manifest), ...checked });
  if (dryRun) return res.json({ ok: true, dry_run: true, tenant: req.tenant, selected_sections: selected, summary: summarize(manifest), warnings: checked.warnings, conflicts: await conflicts(req.db, manifest) });

  const db = req.db;
  try {
    const backup = await backupTenant(db, req.tenant);
    await db.query('SAVEPOINT tenant_manifest_import');
    const typeIds = new Map();
    if (selected.includes('content_types')) {
      for (const type of list(manifest.content_types)) {
        const result = await db.query(
          `insert into content_types (tenant_id,slug,name,type,label_singular,label_plural,description,icon,is_system)
           values ($1,$2,$3,$4,$5,$6,$7,$8,false)
           on conflict (tenant_id,slug) do update set name=excluded.name,type=excluded.type,label_singular=excluded.label_singular,
             label_plural=excluded.label_plural,description=excluded.description,icon=excluded.icon,updated_at=now() returning id`,
          [req.tenantId, text(type.slug), text(type.plural), text(type.type) || 'content', text(type.singular), text(type.plural), text(type.description), type.icon || null],
        );
        const id = result.rows[0].id;
        typeIds.set(text(type.slug), id);
        for (const [index, field] of list(type.fields).entries()) {
          const key = text(field.key || field.field_key);
          await db.query(
            `insert into content_fields (tenant_id,content_type_id,field_key,label,type,required,help_text,order_index,config)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
             on conflict (content_type_id,field_key) do update set label=excluded.label,type=excluded.type,required=excluded.required,
               help_text=excluded.help_text,order_index=excluded.order_index,config=excluded.config,updated_at=now()`,
            [req.tenantId, id, key, text(field.label) || key, text(field.type) || 'text', !!field.required, text(field.help_text), Number.isInteger(field.order_index) ? field.order_index : index, JSON.stringify(field.config || {})],
          );
        }
      }
    }
    const getTypeId = async (slug) => {
      if (typeIds.has(slug)) return typeIds.get(slug);
      const result = await db.query('select id from content_types where slug=$1 limit 1', [slug]);
      if (!result.rows[0]) throw new Error(`Content type not found: ${slug}`);
      typeIds.set(slug, result.rows[0].id); return result.rows[0].id;
    };
    if (selected.includes('taxonomies')) {
      for (const taxonomy of list(manifest.taxonomies)) {
        const result = await db.query(
          `insert into taxonomies (tenant_id,slug,label,is_hierarchical,is_visible) values ($1,$2,$3,$4,true)
           on conflict (tenant_id,slug) do update set label=excluded.label,is_hierarchical=excluded.is_hierarchical,is_visible=true returning id`,
          [req.tenantId, text(taxonomy.slug), text(taxonomy.label), !!taxonomy.is_hierarchical],
        );
        for (const raw of list(taxonomy.terms)) {
          const term = typeof raw === 'string' ? { name: raw } : raw;
          const name = text(term.name || term.label);
          const slug = text(term.slug) || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          await db.query(
            `insert into terms (tenant_id,taxonomy_id,name,slug,description,image,seo) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)
             on conflict (tenant_id,taxonomy_id,lower(slug)) do update set name=excluded.name,description=excluded.description,image=excluded.image,seo=excluded.seo,updated_at=now()`,
            [req.tenantId, result.rows[0].id, name, slug, text(term.description), JSON.stringify(term.image || null), JSON.stringify(term.seo || null)],
          );
        }
      }
    }
    if (selected.includes('menus')) {
      for (const menu of list(manifest.menus)) await db.query(
        `insert into menus (tenant_id,label,slug,config) values ($1,$2,$3,$4::jsonb)
         on conflict (tenant_id,slug) do update set label=excluded.label,config=excluded.config,updated_at=now()`,
        [req.tenantId, text(menu.label), text(menu.slug), JSON.stringify({ items: list(menu.items) })],
      );
    }
    if (selected.includes('entries')) {
      for (const entry of list(manifest.entries)) await db.query(
        `insert into entries (tenant_id,content_type_id,title,slug,status,data) values ($1,$2,$3,$4,$5,$6::jsonb)
         on conflict (tenant_id,content_type_id,slug) where slug is not null
         do update set title=excluded.title,status=excluded.status,data=excluded.data,updated_at=now()`,
        [req.tenantId, await getTypeId(text(entry.content_type_slug)), text(entry.title), text(entry.slug), text(entry.status) || 'draft', JSON.stringify(entry.data || {})],
      );
    }
    if (selected.includes('entry_views')) {
      for (const view of list(manifest.entry_views)) {
        const typeId = await getTypeId(text(view.content_type_slug));
        const assigned = roleList(view.roles), defaults = roleList(view.default_roles).filter((role) => assigned.includes(role));
        const sections = list(view.sections);
        const config = { roles: assigned, default_roles: defaults, core: view.core || {}, sections, widgets: sections, layout: { sections } };
        if (defaults.length) {
          await db.query(
            `update entry_editor_views set is_default=false,
               config=jsonb_set(coalesce(config,'{}'::jsonb),'{default_roles}','[]'::jsonb,true),updated_at=now()
             where content_type_id=$1`,
            [typeId],
          );
        }
        await db.query('delete from entry_editor_views where content_type_id=$1 and slug=$2', [typeId, text(view.slug)]);
        await db.query('insert into entry_editor_views (tenant_id,content_type_id,slug,label,role,is_default,config) values ($1,$2,$3,$4,$5,$6,$7::jsonb)', [req.tenantId, typeId, text(view.slug), text(view.label), assigned[0] || 'ADMIN', defaults.length > 0, JSON.stringify(config)]);
      }
    }
    if (selected.includes('list_views')) {
      for (const view of list(manifest.list_views)) {
        const typeId = await getTypeId(text(view.content_type_slug));
        const assigned = roleList(view.roles), defaults = roleList(view.default_roles).filter((role) => assigned.includes(role));
        const config = { ...(view.config || {}), roles: assigned, default_roles: defaults };
        if (defaults.length) {
          await db.query(
            `update entry_list_views set is_default=false,
               config=jsonb_set(coalesce(config,'{}'::jsonb),'{default_roles}','[]'::jsonb,true),updated_at=now()
             where content_type_id=$1`,
            [typeId],
          );
        }
        await db.query('delete from entry_list_views where content_type_id=$1 and slug=$2', [typeId, text(view.slug)]);
        await db.query('insert into entry_list_views (tenant_id,content_type_id,slug,label,role,is_default,config) values ($1,$2,$3,$4,$5,$6,$7::jsonb)', [req.tenantId, typeId, text(view.slug), text(view.label), assigned[0] || 'ADMIN', defaults.length > 0, JSON.stringify(config)]);
      }
    }
    if (selected.includes('dashboard')) {
      const current = (await db.query("select value from app_settings where key='global' limit 1")).rows[0]?.value || {};
      const navigation = list(manifest.dashboard?.navigation).map((item) => ({ label: item.label, to: item.url, roles: roleList(item.roles) }));
      const widgets = list(manifest.dashboard?.widgets).map((widget, index) => {
        const type = text(widget.type) || 'html-block';
        const config = widget.config || (type === 'html-block'
          ? { html: widget.html || '' }
          : type === 'quick-links'
            ? { links: list(widget.links).map((link, linkIndex) => ({ id: link.id || `link-${linkIndex + 1}`, label: link.label, href: link.href || link.url })) }
            : {});
        return { id: widget.id || `imported-${type}-${index + 1}`, type, title: widget.title || type, config, roles: roleList(widget.roles).length ? roleList(widget.roles) : ['ADMIN', 'EDITOR', 'VIEWER'] };
      });
      const merged = { ...current, ...(manifest.dashboard?.settings || {}), navSidebar: navigation.length ? navigation : current.navSidebar };
      await db.query(`insert into app_settings (tenant_id,key,value) values ($1,'global',$2::jsonb) on conflict (tenant_id,key) do update set value=excluded.value,updated_at=now()`, [req.tenantId, JSON.stringify(merged)]);
      if (widgets.length) {
        for (const role of ['ADMIN', 'EDITOR', 'VIEWER']) {
          const layout = widgets.filter((widget) => widget.roles.includes(role));
          await db.query(
            `insert into dashboard_layouts (tenant_id,role,layout) values ($1,$2,$3::jsonb)
             on conflict (tenant_id,role) where role is not null do update set layout=excluded.layout,updated_at=now()`,
            [req.tenantId, role, JSON.stringify(layout)],
          );
        }
      }
    }
    const summary = summarize(manifest);
    const inserted = await db.query(
      `insert into tenant_imports (tenant_id,manifest_format,source_name,selected_sections,summary,backup,imported_by)
       values ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7) returning id,created_at`,
      [req.tenantId, manifest.format, manifest.source?.site || manifest.source?.source_root || 'Uploaded manifest', JSON.stringify(selected), JSON.stringify(summary), JSON.stringify(backup), req.user?.id || null],
    );
    await db.query('RELEASE SAVEPOINT tenant_manifest_import');
    return res.json({ ok: true, dry_run: false, tenant: req.tenant, selected_sections: selected, summary, warnings: checked.warnings, import_id: inserted.rows[0].id, created_at: inserted.rows[0].created_at });
  } catch (error) {
    await db.query('ROLLBACK TO SAVEPOINT tenant_manifest_import').catch(() => {});
    console.error('[tenant-transfer import]', error);
    return res.status(500).json({ error: 'Import failed and was rolled back.', detail: error.message });
  }
});

export default router;
