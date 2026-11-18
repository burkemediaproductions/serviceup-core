-- ServiceUp shared/dedicated tenancy migration
-- Apply after serviceup_schema.sql.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'serviceup_api') then
    create role serviceup_api nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
  execute format('grant serviceup_api to %I', current_user);
end $$;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status text not null default 'active',
  plan text not null default 'shared',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.tenants (id, slug, name, plan)
values ('00000000-0000-0000-0000-000000000000', 'default', 'Default Client', 'dedicated')
on conflict (id) do nothing;

insert into public.tenants (id, slug, name, plan)
select distinct tenant_id,
       'legacy-' || left(replace(tenant_id::text, '-', ''), 12),
       'Imported Client',
       'dedicated'
from public.taxonomies
where tenant_id <> '00000000-0000-0000-0000-000000000000'
on conflict (id) do nothing;

create table if not exists public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  domain text not null,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (domain)
);

create table if not exists public.tenant_users (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'VIEWER',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table if not exists public.tenant_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  is_enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  credentials_encrypted bytea,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

alter table public.tenant_integrations
  add column if not exists credentials_encrypted bytea;

insert into public.tenant_users (tenant_id, user_id, role)
select '00000000-0000-0000-0000-000000000000', id, role
from public.users
on conflict (tenant_id, user_id) do nothing;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

select set_config(
  'app.tenant_id',
  '00000000-0000-0000-0000-000000000000',
  true
);

alter table public.tenant_users enable row level security;
alter table public.tenant_users no force row level security;
drop policy if exists tenant_isolation on public.tenant_users;
create policy tenant_isolation on public.tenant_users
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create or replace function public.is_tenant_member(check_tenant_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.tenant_users tu
      join public.users u on u.id = tu.user_id
     where tu.tenant_id::text = check_tenant_id
       and u.supabase_id = auth.uid()
       and tu.status = 'active'
  )
$$;

revoke all on function public.is_tenant_member(text) from public;
grant execute on function public.is_tenant_member(text) to authenticated;
revoke all on table public.users from anon, authenticated;
revoke all on table public.tenant_users from anon, authenticated;
revoke all on table public.tenants from anon, authenticated;
revoke all on table public.tenant_domains from anon, authenticated;
revoke all on table public.tenant_integrations from anon, authenticated;

grant usage on schema public to serviceup_api;
grant select, insert, update, delete on all tables in schema public to serviceup_api;
grant usage, select, update on all sequences in schema public to serviceup_api;
grant execute on all functions in schema public to serviceup_api;
alter default privileges in schema public
  grant select, insert, update, delete on tables to serviceup_api;
alter default privileges in schema public
  grant usage, select, update on sequences to serviceup_api;
alter default privileges in schema public
  grant execute on functions to serviceup_api;

alter table public.tenant_integrations enable row level security;
alter table public.tenant_integrations force row level security;
drop policy if exists tenant_isolation on public.tenant_integrations;
create policy tenant_isolation on public.tenant_integrations
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Tables containing tenant-owned configuration or data.
do $$
declare
  table_name text;
  tenant_tables text[] := array[
    'settings', 'app_settings', 'roles', 'permissions', 'role_permissions',
    'content_types', 'content_fields', 'fields', 'entries', 'pixels', 'organization_profiles',
    'entry_versions', 'entry_relations', 'entry_list_views',
    'entry_editor_views', 'dashboard_settings', 'dashboard_layouts',
    'gadgets', 'gizmos', 'gadget_gizmos'
  ];
begin
  foreach table_name in array tenant_tables loop
    execute format('alter table public.%I add column if not exists tenant_id uuid', table_name);
    execute format(
      'update public.%I set tenant_id = %L where tenant_id is null',
      table_name,
      '00000000-0000-0000-0000-000000000000'
    );
    execute format(
      'alter table public.%I alter column tenant_id set default public.current_tenant_id()',
      table_name
    );
    execute format('alter table public.%I alter column tenant_id set not null', table_name);
    execute format(
      'create index if not exists %I on public.%I (tenant_id)',
      'idx_' || table_name || '_tenant',
      table_name
    );
  end loop;
end $$;

-- Existing tenant-aware tables receive the same safe default and ownership link.
alter table public.taxonomies alter column tenant_id set default public.current_tenant_id();
alter table public.terms alter column tenant_id set default public.current_tenant_id();
alter table public.entry_terms alter column tenant_id set default public.current_tenant_id();

do $$
declare
  table_name text;
  tenant_tables text[] := array[
    'settings', 'app_settings', 'roles', 'permissions', 'role_permissions',
    'content_types', 'content_fields', 'fields', 'entries', 'pixels', 'organization_profiles',
    'entry_versions', 'entry_relations', 'taxonomies', 'terms', 'entry_terms',
    'entry_list_views', 'entry_editor_views', 'dashboard_settings',
    'dashboard_layouts', 'gadgets', 'gizmos', 'gadget_gizmos'
  ];
begin
  foreach table_name in array tenant_tables loop
    execute format(
      'alter table public.%I drop constraint if exists %I',
      table_name,
      table_name || '_tenant_id_fkey'
    );
    execute format(
      'alter table public.%I add constraint %I foreign key (tenant_id) references public.tenants(id) on delete cascade',
      table_name,
      table_name || '_tenant_id_fkey'
    );
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('drop policy if exists tenant_isolation on public.%I', table_name);
    execute format(
      'create policy tenant_isolation on public.%I using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id())',
      table_name
    );
  end loop;
end $$;

-- Replace global natural-key constraints with tenant-scoped equivalents.
alter table public.app_settings drop constraint if exists app_settings_key_unique;
create unique index if not exists app_settings_tenant_key_unique
  on public.app_settings (tenant_id, key);

alter table public.roles drop constraint if exists roles_slug_unique;
create unique index if not exists roles_tenant_slug_unique
  on public.roles (tenant_id, slug);

alter table public.permissions drop constraint if exists permissions_slug_unique;
create unique index if not exists permissions_tenant_slug_unique
  on public.permissions (tenant_id, slug);

alter table public.role_permissions drop constraint if exists role_permissions_unique;
create unique index if not exists role_permissions_tenant_unique
  on public.role_permissions (tenant_id, role_slug, permission_slug);

alter table public.content_types drop constraint if exists content_types_slug_unique;
create unique index if not exists content_types_tenant_slug_unique
  on public.content_types (tenant_id, slug);

drop index if exists public.entries_content_type_slug_unique;
create unique index if not exists entries_tenant_type_slug_unique
  on public.entries (tenant_id, content_type_id, slug) where slug is not null;

alter table public.taxonomies drop constraint if exists taxonomies_slug_unique;

alter table public.gadgets drop constraint if exists gadgets_slug_unique;
create unique index if not exists gadgets_tenant_slug_unique
  on public.gadgets (tenant_id, slug);

alter table public.gizmos drop constraint if exists gizmos_slug_unique;
create unique index if not exists gizmos_tenant_slug_unique
  on public.gizmos (tenant_id, slug);

alter table public.dashboard_settings drop constraint if exists dashboard_settings_pkey;
alter table public.dashboard_settings add primary key (tenant_id, id);

alter table public.dashboard_layouts drop constraint if exists dashboard_layouts_user_id_unique;
alter table public.dashboard_layouts drop constraint if exists dashboard_layouts_role_unique;
create unique index if not exists dashboard_layouts_tenant_user_unique
  on public.dashboard_layouts (tenant_id, user_id) where user_id is not null;
create unique index if not exists dashboard_layouts_tenant_role_unique
  on public.dashboard_layouts (tenant_id, role) where role is not null;

insert into public.roles (tenant_id, slug, label, is_system)
values
  ('00000000-0000-0000-0000-000000000000', 'ADMIN', 'Administrator', true),
  ('00000000-0000-0000-0000-000000000000', 'EDITOR', 'Editor', true),
  ('00000000-0000-0000-0000-000000000000', 'VIEWER', 'Viewer', true)
on conflict (tenant_id, slug) do nothing;

insert into public.permissions (tenant_id, slug, label, description)
values
  ('00000000-0000-0000-0000-000000000000', 'roles.manage', 'Manage roles', 'Create roles and assign permissions'),
  ('00000000-0000-0000-0000-000000000000', 'users.manage', 'Manage users', 'Create and manage client users'),
  ('00000000-0000-0000-0000-000000000000', 'manage_content_types', 'Manage content types', 'Configure fields and views'),
  ('00000000-0000-0000-0000-000000000000', 'integrations.manage', 'Manage integrations', 'Configure client integrations'),
  ('00000000-0000-0000-0000-000000000000', 'pixels.manage', 'Manage Pixels', 'Upload and manage media assets'),
  ('00000000-0000-0000-0000-000000000000', 'profile.manage', 'Manage Profile', 'Update organization and contact information')
on conflict (tenant_id, slug) do nothing;
