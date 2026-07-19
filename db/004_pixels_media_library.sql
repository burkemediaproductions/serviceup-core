-- ServiceUp 004: Pixels media library metadata.
-- File bytes remain in tenant-scoped Supabase Storage buckets.

create table if not exists public.pixels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id()
    references public.tenants(id) on delete cascade,
  title text not null,
  original_name text,
  bucket text not null,
  storage_path text not null,
  public_url text,
  mime_type text,
  size_bytes bigint,
  alt_text text,
  caption text,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pixels add column if not exists tenant_id uuid;
update public.pixels
   set tenant_id = '00000000-0000-0000-0000-000000000000'
 where tenant_id is null;
alter table public.pixels alter column tenant_id set default public.current_tenant_id();
alter table public.pixels alter column tenant_id set not null;

alter table public.pixels drop constraint if exists pixels_tenant_id_fkey;
alter table public.pixels add constraint pixels_tenant_id_fkey
  foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.pixels drop constraint if exists pixels_storage_unique;
create unique index if not exists pixels_tenant_storage_unique
  on public.pixels (tenant_id, bucket, storage_path);
create index if not exists idx_pixels_tenant on public.pixels (tenant_id);
create index if not exists idx_pixels_created on public.pixels (tenant_id, created_at desc);

alter table public.pixels enable row level security;
alter table public.pixels force row level security;
drop policy if exists tenant_isolation on public.pixels;
create policy tenant_isolation on public.pixels
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

drop trigger if exists trg_pixels_set_updated_at on public.pixels;
create trigger trg_pixels_set_updated_at
before update on public.pixels
for each row execute function public.set_updated_at();

insert into public.permissions (tenant_id, slug, label, description)
select id, 'pixels.manage', 'Manage Pixels', 'Upload and manage media assets'
from public.tenants
on conflict (tenant_id, slug) do nothing;

insert into public.role_permissions (tenant_id, role_slug, permission_slug, allowed)
select id, 'EDITOR', 'pixels.manage', true from public.tenants
on conflict (tenant_id, role_slug, permission_slug)
do update set allowed = true;

grant select, insert, update, delete on public.pixels to serviceup_api;
