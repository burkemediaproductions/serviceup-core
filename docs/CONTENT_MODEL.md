# ServiceUp content model

ServiceUp manages structured content; the separate website or app repository owns frontend layout and presentation.

## Core terms

- **Content type**: a reusable structure such as Blog Posts, Case Studies, Services, Testimonials, Pages, or Team Members.
- **Entry**: one record within a content type.
- **Section**: an optional structured part of a Page entry, used only when a page needs controlled editorial flexibility.
- **Widget**: a small component displayed inside the ServiceUp dashboard. Widget does not mean a public website section.
- **Pixel**: an image, video, document, or other managed media asset. Pixels stores searchable metadata while Supabase Storage holds the file bytes.

Headers and footers remain frontend components. Their editable values—logo, navigation, contact information, calls to action, legal links, and similar fields—come from Site Settings, Menus, or Content entries.

ServiceUp should not become a general visual website builder. BurkeMedia or another implementer builds the frontend in its own repository, while clients use ServiceUp to update the information they are responsible for maintaining.

## Recommended public-content pattern

1. Define a structured Content type.
2. Create and publish Entries in ServiceUp.
3. Read only published entries through the public API.
4. Render those entries using components in the website/app repository.

Examples of website-facing content that should not be modeled as Widgets include heroes, calls to action, feature grids, testimonials, galleries, FAQs, and reusable promotional sections.
