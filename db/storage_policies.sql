-- Drop existing policies (safe to rerun)
DROP POLICY IF EXISTS "Allow authenticated uploads 1ym05q3_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads 1ym05q3_1" ON storage.objects;

DROP POLICY IF EXISTS "Allow authenticated uploads for branding 1ym05q3_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads for branding 1ym05q3_1" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads for branding 1ym05q3_2" ON storage.objects;

DROP POLICY IF EXISTS "Allow public read 1ym05q3_0" ON storage.objects;

DROP POLICY IF EXISTS "private-delete xpzcy0_0" ON storage.objects;
DROP POLICY IF EXISTS "private-insert xpzcy0_0" ON storage.objects;
DROP POLICY IF EXISTS "private-update xpzcy0_0" ON storage.objects;
DROP POLICY IF EXISTS "private-select tenant" ON storage.objects;

DROP POLICY IF EXISTS "public_delete 16dgef8_0" ON storage.objects;
DROP POLICY IF EXISTS "public_insert 16dgef8_0" ON storage.objects;
DROP POLICY IF EXISTS "public_update 16dgef8_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read uploads-public" ON storage.objects;



-- Recreate policies (matching your JSON)

-- Tenant membership is verified by mapping Supabase auth.uid() to ServiceUp users.
-- All managed objects use: <tenant_uuid>/<supabase_user_uuid>/...

-- Branding bucket: active tenant members can write/update/delete; public can read
CREATE POLICY "Allow authenticated uploads for branding 1ym05q3_0"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'branding'
  AND split_part(name, '/', 2) = auth.uid()::text
  AND public.is_tenant_member(split_part(name, '/', 1))
);

CREATE POLICY "Allow authenticated uploads for branding 1ym05q3_1"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'branding'
  AND split_part(name, '/', 2) = auth.uid()::text
  AND public.is_tenant_member(split_part(name, '/', 1))
);

CREATE POLICY "Allow authenticated uploads for branding 1ym05q3_2"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'branding'
  AND split_part(name, '/', 2) = auth.uid()::text
  AND public.is_tenant_member(split_part(name, '/', 1))
);

CREATE POLICY "Allow public read 1ym05q3_0"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'branding');

-- uploads-private: active member, matching tenant and UID path.
CREATE POLICY "private-insert xpzcy0_0"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uploads-private'
  AND split_part(name, '/', 2) = auth.uid()::text
  AND public.is_tenant_member(split_part(name, '/', 1))
);

CREATE POLICY "private-update xpzcy0_0"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'uploads-private'
  AND split_part(name, '/', 2) = auth.uid()::text
  AND public.is_tenant_member(split_part(name, '/', 1))
)
WITH CHECK (
  bucket_id = 'uploads-private'
  AND split_part(name, '/', 2) = auth.uid()::text
  AND public.is_tenant_member(split_part(name, '/', 1))
);

CREATE POLICY "private-delete xpzcy0_0"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'uploads-private'
  AND split_part(name, '/', 2) = auth.uid()::text
  AND public.is_tenant_member(split_part(name, '/', 1))
);

CREATE POLICY "private-select tenant"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'uploads-private'
  AND split_part(name, '/', 2) = auth.uid()::text
  AND public.is_tenant_member(split_part(name, '/', 1))
);

-- uploads-public: authenticated can manage files inside their own folder (uid/...)
CREATE POLICY "public_insert 16dgef8_0"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uploads-public'
  AND split_part(name, '/', 2) = auth.uid()::text
  AND public.is_tenant_member(split_part(name, '/', 1))
);

CREATE POLICY "public_update 16dgef8_0"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'uploads-public'
  AND split_part(name, '/', 2) = auth.uid()::text
  AND public.is_tenant_member(split_part(name, '/', 1))
)
WITH CHECK (
  bucket_id = 'uploads-public'
  AND split_part(name, '/', 2) = auth.uid()::text
  AND public.is_tenant_member(split_part(name, '/', 1))
);

CREATE POLICY "public_delete 16dgef8_0"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'uploads-public'
  AND split_part(name, '/', 2) = auth.uid()::text
  AND public.is_tenant_member(split_part(name, '/', 1))
);

-- uploads-public: allow public read
CREATE POLICY "Allow public read uploads-public"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'uploads-public');
