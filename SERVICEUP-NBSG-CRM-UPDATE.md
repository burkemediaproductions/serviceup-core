# ServiceUp NBSG CRM Update

## Core deployment

This release changes both the dashboard and API.

1. Commit and push the updated Core source.
2. Confirm the Netlify dashboard deployment finishes.
3. Confirm the Render API deployment finishes.
4. No database migration is required.

## NBSG configuration

After both deployments complete, import `NBSG-ServiceUp-CRM-Import-v2.json` into
the NBSG dashboard. Apply these sections:

- Content types
- Entry views
- List views

The import is tenant-safe and updates the existing NBSG definitions.

## What to test

1. Create a new Surrogate and Intended Parent; each should default to Published.
2. Assign an Intended Parent from a Surrogate and save. Open the Intended Parent
   and confirm the Surrogate appears automatically, with a link back.
3. Remove the relationship from either side and confirm the inverse side updates.
4. Drag a PDF into Related documents on both Surrogate and Intended Parent records.
5. Preview the PDF and test Full screen / Exit full screen.
6. Edit Pixels and a Document entry and test the same preview controls.
7. Click Add new in a related-record panel. Cancel should keep the current page;
   OK should save the current entry before continuing.
8. Open the Surrogates and Intended Parents lists and confirm wide columns scroll
   horizontally.

## Reusable controls

- Entry Views: choose a default new-entry status.
- Entry Views: create a Related records panel and toggle document drag-and-drop.
- List Views: toggle horizontal scrolling and set a minimum table width.
- Relationship fields: enable Two-way relation and choose the inverse field key.
- Relationship fields: choose primary and secondary display fields, a custom
  label template, searchable fields, and search placeholder text.
- Optional template groups can be wrapped in brackets, for example
  `{title}[ — Partner: {partner_name}]`; the bracketed text disappears when
  the partner field is empty.
- Relationship pickers use a search bar plus an add dropdown and show selected
  records as readable cards.
- Opening a selected relationship asks to save the current entry first.
- Document areas provide separate Upload from computer and Choose from Pixels /
  Media Library actions.
