# Static site publishing hooks

ServiceUp can request a static-site rebuild after an entry is created, updated,
or deleted. The API response is never blocked by the external build service.
Changes saved within 15 seconds are combined into one request.

Configure one of these Render environment variables:

- `NETLIFY_BUILD_HOOK_URL`: one dedicated site's Netlify build-hook URL.
- `SERVICEUP_SITE_BUILD_HOOKS`: JSON object mapping tenant slug or tenant ID to
  its Netlify build-hook URL. Use this for the shared API.

Optional: `SERVICEUP_PUBLISH_DELAY_MS` changes the debounce delay (minimum one
second; default 15000).

Build-hook failures are logged but never roll back the successful ServiceUp
content save. Netlify retains its previous successful deployment if the next
static build fails.
