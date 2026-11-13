# ServiceUp Core API patches (no credentials)

This directory contains **four isolated API route changes** based on your uploaded `Core App.zip`:

- `publicSite.js`: Adds tenant-isolated public `GET /api/public/menu/:slug`, so the build can read the editable Main Menu without logging in.
- `menus.js`: Schedules the tenant's Netlify build hook when a Menu is created, edited, or deleted.
- `profile.js`: Schedules a rebuild when the public organization Profile is edited.
- `tenantTransfer.js`: Schedules a rebuild after a successful tenant import. Dry-run imports do not rebuild.

Merge the `.patch` files into your **shared** ServiceUp Core repository and deploy its API on Render **before** your website's ServiceUp build. Full modified files are supplied for comparison. Never overwrite a newer core version without reviewing its differences.

No `.env`, private data, secret credentials, database backups, Supabase service key or JWT is included. The existing API's published `/api/content/:slug`, tenant middleware/RLS and `scheduleSiteRebuild` are reused rather than replaced.
