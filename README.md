# ServiceUp

ServiceUp is a reusable, installable CRM/CMS dashboard for managing a client's people, records, content, taxonomies, permissions, dashboards, websites, apps, and optional integrations from one source of truth.

## Architecture

- `dashboard/` — canonical React/Vite management dashboard
- `api/` — canonical Express API, authentication, permissions, public endpoints, and integration gizmos
- `db/` — canonical PostgreSQL schema and Supabase Storage policies

The dashboard and API are the product core. Client-specific behavior should be modeled through content types, fields, views, roles, settings, gizmo packs, and integration modules—not by copying or forking core application files.

## Local setup

Requirements: Node.js 20+, npm, PostgreSQL/Supabase.

1. Copy `api/.env.example` to `api/.env` and add the deployment's secrets.
2. Copy `dashboard/.env.example` to `dashboard/.env` and point it at the API and Supabase project.
3. Apply `db/serviceup_schema.sql`, migrations `002` through `007` in order, followed by `db/storage_policies.sql`.
4. Run `npm run install:all` from the repository root.
5. Run `npm run seed --prefix api` from the repository root to create/link the
   first ServiceUp and Supabase Auth administrator.
6. Run `npm run doctor`, then run `npm run dev:api` and `npm run dev:dashboard` in separate terminals.

Useful root commands:

- `npm run build` — production dashboard build
- `npm run check` — API architecture checks plus dashboard build
- `npm run doctor` — verify environment variables, database connectivity, migrations, and tenant configuration
- `npm run tenant:create -- --name "Client Name" --slug client-name --domain dashboard.example.com --admin owner@example.com` — create a shared tenant
- `npm run migrate` — apply new numbered database migrations with a checksum ledger
- `npm test` — run the initial architecture regression tests
- `npm start` — production API

## Repeatable client installations

ServiceUp supports shared and dedicated infrastructure from the same codebase. See `docs/TENANCY.md` for the full model and deployment settings.
Use `docs/INSTALLATION.md` as the canonical setup and production-acceptance checklist.
See `docs/BRANDING.md`, `docs/PROFILE.md`, and `docs/BURKEMEDIA_STARTERS.md` for the first pilot-facing systems.
See `docs/PANELS.md` for template-aware website sections and their public data shape.
See `docs/PROVIDER_ROADMAP.md` for the planned generic PostgreSQL, Netlify Database, and MySQL provider architecture after the Supabase pilot.

Each installation should receive its own environment configuration, tenant/default settings, branding, users, roles, and enabled gizmo packs. Keep secrets in environment variables and never commit `.env` files.

Use these extension boundaries:

- Content/data structure: content types, fields, taxonomies, entry views, and list views
- Access: users, roles, and permissions
- Presentation: settings, dashboard layouts and Widgets, menus, headers, footers, and Gadgets
- External services: self-contained folders under `api/src/gizmos/<slug>/`
- Reusable presets: `api/gizmo-packs/`

Avoid placing application code at the repository root or outside the canonical `dashboard/src` and `api` trees.

## Current product boundary

ServiceUp is intended to remain a unified CRM/CMS backend and management dashboard that can serve multiple websites and apps. It should not become a separate custom application for every client. Client needs that are broadly reusable belong in the core; vendor- or client-specific connections belong in gizmos; configuration belongs in data and environment settings.

Terminology is intentionally narrow: **Widgets** are small dashboard components, **Gizmos** are capabilities or integrations, **Gadgets** are installable solutions/module packs, **Pixels** are media assets, and **Panels** are typed website sections arranged through Page Templates. **Profile** is the conventional Organization Profile holding reusable contact and identity details. Website heroes, calls to action, testimonials, and other editable sections use Panels or ordinary related Content entries—not Widgets.

## Known follow-up work

- Replace the placeholder permissions JSON screen with a permission matrix UI.
- Add automated API tests against a disposable database and frontend component/flow tests.
- Decide whether `api/site/` remains a supported reference public site or moves to an example package.
- Build tenant export/import tooling before moving the first shared client to dedicated infrastructure.
