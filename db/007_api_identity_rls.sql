-- Permit only the trusted ServiceUp API role to use global identity and tenant
-- lookup tables when Supabase RLS is enabled. Browser roles remain revoked by
-- 002_multitenancy.sql, and tenant-owned data keeps its tenant policies.

alter table public.users enable row level security;
drop policy if exists serviceup_api_access on public.users;
create policy serviceup_api_access on public.users
  for all to serviceup_api
  using (true)
  with check (true);

alter table public.tenants enable row level security;
drop policy if exists serviceup_api_access on public.tenants;
create policy serviceup_api_access on public.tenants
  for all to serviceup_api
  using (true)
  with check (true);

grant select, insert, update, delete on public.users to serviceup_api;
grant select, insert, update, delete on public.tenants to serviceup_api;
