# ServiceUp Storage Buckets

## branding
- Public read
- Authenticated upload/update/delete
- Used for logos, brand assets

## uploads-public
- Public read
- Authenticated users can write only to: `<tenant_uuid>/<uid>/...`
- Used by Pixels for user-facing images, video, and downloads

## uploads-private
- Private
- Authenticated users can write only to: `<tenant_uuid>/<uid>/...`
- Used by Pixels for sensitive documents and internal media

Pixels metadata is stored in `public.pixels`. Deleting a Pixel through the dashboard removes both its Storage object and metadata record.
