-- Tenant-scoped import history and automatic pre-import backups.
create table if not exists public.tenant_imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  manifest_format text not null,
  source_name text,
  status text not null default 'completed',
  selected_sections jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  backup jsonb not null default '{}'::jsonb,
  imported_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_tenant_imports_tenant_created on public.tenant_imports (tenant_id, created_at desc);
alter table public.tenant_imports enable row level security;
alter table public.tenant_imports force row level security;
drop policy if exists tenant_isolation on public.tenant_imports;
create policy tenant_isolation on public.tenant_imports
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
grant select, insert, update, delete on public.tenant_imports to serviceup_api;
