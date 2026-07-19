-- ServiceUp 005: tenant Organization Profile.

create table if not exists public.organization_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id()
    references public.tenants(id) on delete cascade,
  display_name text not null default '',
  legal_name text,
  legal_name_public boolean not null default false,
  description text,
  phone_numbers jsonb not null default '[]'::jsonb,
  email_addresses jsonb not null default '[]'::jsonb,
  addresses jsonb not null default '[]'::jsonb,
  websites jsonb not null default '[]'::jsonb,
  social_profiles jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organization_profiles add column if not exists tenant_id uuid;
update public.organization_profiles
   set tenant_id = '00000000-0000-0000-0000-000000000000'
 where tenant_id is null;
alter table public.organization_profiles alter column tenant_id set default public.current_tenant_id();
alter table public.organization_profiles alter column tenant_id set not null;
alter table public.organization_profiles drop constraint if exists organization_profiles_tenant_id_fkey;
alter table public.organization_profiles add constraint organization_profiles_tenant_id_fkey
  foreign key (tenant_id) references public.tenants(id) on delete cascade;

create unique index if not exists organization_profiles_one_per_tenant
  on public.organization_profiles (tenant_id);

alter table public.organization_profiles enable row level security;
alter table public.organization_profiles force row level security;
drop policy if exists tenant_isolation on public.organization_profiles;
create policy tenant_isolation on public.organization_profiles
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

drop trigger if exists trg_organization_profiles_set_updated_at on public.organization_profiles;
create trigger trg_organization_profiles_set_updated_at
before update on public.organization_profiles
for each row execute function public.set_updated_at();

insert into public.permissions (tenant_id, slug, label, description)
select id, 'profile.manage', 'Manage Profile', 'Update organization and contact information'
from public.tenants
on conflict (tenant_id, slug) do nothing;

insert into public.role_permissions (tenant_id, role_slug, permission_slug, allowed)
select id, 'EDITOR', 'profile.manage', true from public.tenants
on conflict (tenant_id, role_slug, permission_slug)
do update set allowed = true;

grant select, insert, update, delete on public.organization_profiles to serviceup_api;
