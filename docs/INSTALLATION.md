# ServiceUp installation

This checklist is the canonical path for a new shared or dedicated ServiceUp installation.

## 1. Prepare services

- Node.js 20 or newer
- A Supabase project for PostgreSQL, Auth, and Storage
- A Render web service for `api/`
- A Netlify site with `dashboard/` as its base directory

Small clients can share the Supabase and Render services. Large or sensitive clients use the same repository in dedicated mode.

## 2. Configure locally

```bash
cp api/.env.example api/.env
cp dashboard/.env.example dashboard/.env
npm run install:all
```

Replace every placeholder in both environment files. Generate independent, long random values for `JWT_SECRET` and `SERVICEUP_CREDENTIALS_KEY`.

## 3. Apply the database

Run these files in the Supabase SQL editor, in order:

1. `db/serviceup_schema.sql`
2. `db/002_multitenancy.sql`
3. `db/003_dashboard_widgets_only.sql`
4. `db/004_pixels_media_library.sql`
5. `db/005_organization_profile.sql`
6. `db/006_activity_and_tasks.sql`
7. `db/007_api_identity_rls.sql`
8. `db/storage_policies.sql` after creating the buckets described in `db/storage.md`

Database migrations must be run with the project owner/migration connection. The runtime API switches to the restricted `serviceup_api` role for tenant requests.

## 4. Create the first identity

Configure `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then run:

```bash
npm run seed --prefix api
```

Run that command from the repository root. If the terminal is already inside
`api/`, use `npm run seed` instead. The seed is safe to rerun: it repairs the
administrator password and active tenant membership, and creates/links the
matching Supabase Auth identity required for Storage uploads.

For shared mode, list the same email under `SERVICEUP_PLATFORM_ADMINS`.

## 5. Verify the installation

```bash
npm run doctor
npm run check
```

`doctor` verifies secrets, database connectivity, required migration tables, and the configured dedicated tenant. `check` validates API source and tenant architecture, then builds the dashboard.

After the core schema is present, future upgrades can use `npm run migrate`. The migration ledger refuses to silently run a migration whose contents changed after application.

## 6. Add a shared client

Use **ServiceUp Clients** in the dashboard, or run:

```bash
npm run tenant:create -- \
  --name "Client Name" \
  --slug client-name \
  --domain dashboard.client.com \
  --admin owner@example.com
```

The administrator must already exist as a ServiceUp/Supabase user. Register both dashboard and public website domains when they call the API directly.

## 7. Deploy

### Render API

- Root directory: `api`
- Build command: `npm ci`
- Start command: `npm start`
- Health check: `/api/health`

### Netlify dashboard

- Base directory: `dashboard`
- Build command: `npm ci && npm run build`
- Publish directory: `dist`

Keep client websites and apps in separate repositories and deployments. They consume ServiceUp through its public/authenticated API.

## 8. Production acceptance

Before importing real client data:

- Create two non-production tenants.
- Confirm each can create and read its own content.
- Attempt cross-tenant API and Storage access and verify it is denied.
- Test login, logout, password recovery, roles, uploads, and integration settings.
- Confirm database backups and error monitoring are enabled.
- Record the installed schema version and deployment URLs.
