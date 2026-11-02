-- Persistent, tenant-scoped navigation menus.

create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id()
    references public.tenants(id) on delete cascade,
  label text not null,
  slug text not null,
  config jsonb not null default '{"items":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists menus_tenant_slug_unique
  on public.menus (tenant_id, slug);
create index if not exists idx_menus_tenant on public.menus (tenant_id);

alter table public.menus enable row level security;
alter table public.menus force row level security;
drop policy if exists tenant_isolation on public.menus;
create policy tenant_isolation on public.menus
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

grant select, insert, update, delete on public.menus to serviceup_api;
