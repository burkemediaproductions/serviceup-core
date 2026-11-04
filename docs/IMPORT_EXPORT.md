# Tenant Import & Export

ServiceUp administrators can move tenant configuration and content through **Settings → Import & Export**.

## Production deployment

1. Deploy the API and dashboard from the same release.
2. In the Render shell, from `api`, run:

   ```bash
   npm run migrate
   ```

   This applies `009_tenant_imports.sql` and creates the tenant-scoped backup/history table.
3. Confirm the API health endpoint is healthy and the dashboard loads.
4. Open the target tenant's dashboard. Tenant selection is still determined by its registered domain or `VITE_SERVICEUP_TENANT`.

## Import workflow

1. Extract the client migration ZIP locally.
2. Upload the complete canonical manifest, such as `asas-serviceup-import.json`. Do not upload the ZIP or the smaller reference JSON files.
3. ServiceUp validates the format and requires `manifest.tenant_slug` to equal the current dashboard tenant.
4. Choose the sections to import.
5. Run the dry test. It performs validation and conflict reporting without writes.
6. Type the displayed tenant slug and start the production import.
7. ServiceUp takes a complete pre-import snapshot, then applies all selected sections in the request transaction. Errors roll the import back.
8. Download the pre-import backup from Import history when desired.

## Conflict behavior

- Content types, fields, taxonomies, terms, menus, and entries are updated by stable tenant-scoped slugs rather than duplicated.
- Imported Entry and List Views replace only views with the same content type and view slug.
- Existing default views are demoted before the imported default view is installed.
- Dashboard settings are merged with existing tenant branding. Imported navigation and widgets replace those specific arrays only.
- Fields absent from a later package are not deleted automatically.
- Pixel/media inventory records are reported but binary media is not uploaded in version 1.

## Permissions and isolation

- Import, export, history, and backups require `roles.manage`; administrators retain the normal bypass.
- Every request uses the already resolved tenant database session and forced RLS.
- A package whose `tenant_slug` does not match the active tenant is rejected before writes.
- Backups and import history are themselves tenant-scoped and protected by RLS.
