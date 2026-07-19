# ServiceUp provider portability roadmap

Supabase remains the default and first production-tested backend because it provides PostgreSQL, Auth, and Storage together.

After the BurkeMedia Supabase pilot is stable, ServiceUp should separate provider-specific behavior behind three interfaces:

- Database provider
- Authentication provider
- Storage provider

## Planned order

1. Prove and document the Supabase installation.
2. Move database access behind repository/service modules.
3. Move Supabase Auth operations behind an Auth adapter.
4. Move Pixels operations behind a Storage adapter.
5. Move integration credential encryption into an application-level vault.
6. Add a generic PostgreSQL provider supporting Supabase, Netlify Database, Neon, Render PostgreSQL, RDS, and compatible hosts.
7. Validate Netlify Database connections, deploy-preview branches, and migrations.
8. Add a MySQL schema/query dialect with explicit tenant enforcement.
9. Run the same tenant-isolation suite against every supported database provider.
10. Document supported Database/Auth/Storage combinations and migration paths.

MySQL support must not be considered production-ready until tenant isolation is independently proven because it does not provide PostgreSQL's existing RLS defense in the same form.
