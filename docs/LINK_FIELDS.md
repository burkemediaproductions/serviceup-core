# Link fields

ServiceUp URL fields are presented to editors as Link fields with two destination modes:

- **Content** selects a content type or taxonomy and then a specific entry or term.
- **Custom** accepts an internal path, external URL, anchor, email link, or telephone link.

Each link can open in the same tab (`_self`) or a new tab (`_blank`). Legacy string URL values remain readable. Newly edited values use this shape:

```json
{
  "type": "content",
  "source_kind": "content_type",
  "source_id": "uuid",
  "source_slug": "pages",
  "item_id": "uuid",
  "item_slug": "about",
  "url": "/about/",
  "target": "_self"
}
```

Frontend renderers should support both formats:

```js
const href = typeof link === "string" ? link : link?.url || link?.href || "";
const target = typeof link === "object" && link?.target === "_blank" ? "_blank" : "_self";
```

When `target` is `_blank`, render `rel="noopener noreferrer"` as well.

By convention, Page entries resolve to `/{entry-slug}/`. Other content types and taxonomies resolve to `/{source-slug}/{entry-or-term-slug}/`. A URL field can override that convention through its field config with `contentPath`, for example `/articles/{slug}/` or `/{source}/{slug}/`.
