create table if not exists public.activities (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
 activity_type text not null default 'note', title text, body text, status text not null default 'open', due_at timestamptz,
 entity_type text, entity_id uuid, assigned_to uuid references public.users(id) on delete set null, created_by uuid references public.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_activities_tenant_created on public.activities (tenant_id,created_at desc);
create index if not exists idx_activities_entity on public.activities (tenant_id,entity_type,entity_id);
alter table public.activities enable row level security; alter table public.activities force row level security;
drop policy if exists tenant_isolation on public.activities;
create policy tenant_isolation on public.activities using (tenant_id=public.current_tenant_id()) with check (tenant_id=public.current_tenant_id());
drop trigger if exists trg_activities_set_updated_at on public.activities;
create trigger trg_activities_set_updated_at before update on public.activities for each row execute function public.set_updated_at();
insert into public.permissions (tenant_id,slug,label,description) select id,'activities.manage','Manage Activity','Create notes, tasks and follow-ups' from public.tenants on conflict (tenant_id,slug) do nothing;
insert into public.role_permissions (tenant_id,role_slug,permission_slug,allowed) select id,'EDITOR','activities.manage',true from public.tenants on conflict (tenant_id,role_slug,permission_slug) do update set allowed=true;
grant select,insert,update,delete on public.activities to serviceup_api;
