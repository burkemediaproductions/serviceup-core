# Organization Profile

Profile is the tenant's reusable source of truth for organization identity and contact information.

The dashboard editor is available at `/admin/profile`. It stores repeatable phone numbers, email addresses, locations, websites, and social profiles. Each item can be marked primary and public. Only one item in each group should be primary; the editor enforces that selection.

Authenticated editors use:

```text
GET /api/profile
PUT /api/profile
```

Websites and apps use:

```text
GET /api/public/organization-profile
```

The public response excludes every item marked private and excludes the legal name unless explicitly made public. It includes both a `profile` object and a `schema` object formatted for Schema.org Organization structured data.

Frontend projects should use Profile for headers, footers, contact pages, social links, `tel:`/`mailto:` actions, and organization schema instead of duplicating those values in multiple Content entries.
