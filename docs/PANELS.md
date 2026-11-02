# ServiceUp Panels

Panels are typed website sections stored in a normal ServiceUp entry field. A Page Template limits which Panel types are available and can optionally lock their order.

## Create a Panels field

1. Open **QuickBuilder** and select the Page content type.
2. Add a field with type **Panels (page sections)**.
3. Open its configuration and choose **Install starter Panels + templates**.
4. Save the fields.

The starter set includes Hero, Rich Text, Image + Text, Call to Action, and Contact Intro Panels. It also includes Standard Page, Homepage, About Page, and Contact Page templates.

The visual builder supports adding, duplicating, removing, and reordering Panel Types and their fields. Flexible templates use checkboxes for allowed and default Panels. Fixed templates use an ordered slot editor. Advanced JSON remains available in a collapsed section for uncommon field configuration.

## Stored value

Panels stay inside `entries.data`, so existing content endpoints, permissions, revisions, exports, and tenant isolation continue to apply.

```json
{
  "template": "homepage",
  "panels": [
    {
      "id": "panel-id",
      "type": "hero",
      "data": {
        "heading": "Welcome",
        "image": { "url": "https://example.com/hero.jpg" }
      }
    }
  ]
}
```

The public website maps each `type` to a real frontend component. ServiceUp controls content and permitted arrangement; the website controls styling and responsive behavior.

## Template options

- `allowed`: Panel type keys available on flexible templates.
- `defaults`: Panel types created when an empty entry selects a flexible template.
- `fixed: true`: prevents adding, removing, duplicating, or rearranging Panels.
- `slots`: ordered Panel types created and enforced for a fixed template.

Panels should relate to ordinary Content entries when information is reusable. For example, a Team Panel can select Staff entries rather than duplicating every staff member inside the page.
