# ServiceUp tenancy and infrastructure

ServiceUp supports one maintained codebase in two deployment modes.

## Shared mode

Shared mode is intended for smaller BurkeMedia clients:

- One Render API service
- One Supabase project
- Multiple client organizations (`tenants`)
- Separate Netlify websites/dashboards as needed
- Tenant selected through a registered frontend domain or `X-ServiceUp-Tenant`
- Tenant membership, PostgreSQL row-level security, and tenant-scoped Storage paths

```env
SERVICEUP_MODE=shared
SERVICEUP_DB_ROLE=serviceup_api
SERVICEUP_PLATFORM_ADMINS=owner@example.com
SERVICEUP_CREDENTIALS_KEY=<long-random-encryption-key>
```

Each Netlify dashboard can identify its client explicitly:

```env
VITE_SERVICEUP_TENANT=client-slug
VITE_API_BASE=https://shared-api.example.com
VITE_SUPABASE_URL=https://shared-project.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

Register every production frontend hostname in `tenant_domains`. Domain resolution is used for CORS and for public website/app requests. Server-to-server callers should send `X-ServiceUp-Tenant`.

Stripe webhooks cannot send the tenant header. Shared Stripe webhooks therefore use:

```text
https://shared-api.example.com/api/gizmos/stripe/webhook/client-slug
```

## Dedicated mode

Dedicated mode is intended for larger, sensitive, high-traffic, or independently owned installations:

- Dedicated Render service
- Dedicated Supabase project
- The same ServiceUp repository and release
- One configured default tenant

```env
SERVICEUP_MODE=dedicated
DEFAULT_TENANT_ID=00000000-0000-0000-0000-000000000000
SERVICEUP_DB_ROLE=serviceup_api
SERVICEUP_CREDENTIALS_KEY=<long-random-encryption-key>
```

The API ignores tenant-selection headers in dedicated mode and binds every request to `DEFAULT_TENANT_ID`.

## Trust boundaries

ServiceUp does not trust tenant IDs found in request bodies or content records.

1. The API resolves the tenant from deployment mode, a registered domain, or a tenant key.
2. Authentication verifies the user has an active membership in that tenant.
3. A request-scoped PostgreSQL transaction sets `app.tenant_id`.
4. The transaction switches to the restricted `serviceup_api` database role.
5. Row-level security filters and validates tenant-owned records.
6. Supabase Storage separately verifies `auth.uid()` through `is_tenant_member()`.

Tenant-owned Storage objects use:

```text
<tenant_uuid>/<supabase_user_uuid>/<category>/<filename>
```

## Tenant-specific integrations

`tenant_integrations` stores configuration separately for each organization. Credentials are encrypted with `SERVICEUP_CREDENTIALS_KEY`, and API responses never return them.

Supported configuration foundations include:

- `stripe`: `secret_key`, `webhook_secret`, `automatic_tax`, `site_url`
- `fitdegree`: `api_key`, `base_url`, `company_id`, authentication header/scheme

Dedicated installations can continue using environment-variable fallbacks. Shared installations should store each client’s integration configuration through `/api/integrations/:slug`.

## Adding a shared client

Platform administrators are listed in `SERVICEUP_PLATFORM_ADMINS`. An authenticated platform administrator can use:

```text
GET  /api/platform/tenants
POST /api/platform/tenants
POST /api/platform/tenants/:id/domains
```

Creating a tenant also creates its core roles and permissions and makes the creating platform administrator an administrator of the new tenant.

## Moving a client to dedicated infrastructure

1. Create the dedicated Supabase project and Render service.
2. Apply the core schema and tenancy migration.
3. Export only the client’s tenant-owned rows and Storage prefix.
4. Import them into the dedicated project, retaining UUID relationships.
5. Configure `SERVICEUP_MODE=dedicated` and the migrated tenant UUID.
6. Update the dashboard and website environment variables.
7. Verify authentication, files, integrations, webhooks, and public content.

Automated export/import tooling remains a follow-up before the first production graduation from shared to dedicated.
