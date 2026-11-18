-- Add independent menu-management permission to every existing tenant.
-- Editors are not granted access automatically; an administrator can enable
-- Manage menus for the desired role under Settings -> Permissions.

insert into public.permissions (tenant_id, slug, label, description)
select id, 'menus.manage', 'Manage menus', 'Create, edit and delete navigation menus'
from public.tenants
on conflict (tenant_id, slug) do update
set label = excluded.label,
    description = excluded.description,
    updated_at = now();
