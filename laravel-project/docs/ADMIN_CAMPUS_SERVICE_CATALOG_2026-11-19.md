# CPSU Market — University admin campus and product/service category editor

**Scope:** local web/PWA administration. No schema migration, deployment, Git commit, seed, or real database mutation.

## Admin interface

- Under **Management → Campuses & categories**, campus management remains available (add, edit, deactivate/reactivate with confirmation).
- Campus forms check the trimmed code and name before submitting. Codes use 2–24 letters, digits, hyphens, or underscores and are stored in uppercase. Campus names may contain spaces. Forms highlight and focus the first invalid field with a specific message. The API still validates the submitted values.
- A two-option **Products / Services** selector controls which category list and creation form are shown.
- The form asks what product or service category should be added and creates the correct `listingType` (`physical_product` or `service`). Each type preserves its own unsaved name draft when switching.
- Both types support rename-in-place, retaining listing IDs, category relationships, history and moderation records. Category type is fixed after creation, to avoid converting existing listings.
- Category names displayed in seller forms and Explore are supplied by the existing public `/api/v1/categories` endpoint; no separate hardcoded list or database table was added.
- Existing shared admin save-feedback pattern and responsive styling are reused.

## API / controls

- Global university administrators only. Campus reviewers and other roles cannot perform catalog changes.
- `GET /api/v1/admin/catalog` returns campuses and categories (with type and listing count).
- `POST /api/v1/admin/catalog/categories` accepts `{name, listingType}` (product or service); `PATCH /api/v1/admin/catalog/categories/:id` accepts `{name}` only.
- Prior service-specific API routes remain for compatibility; the updated interface uses type-aware routes.
- Strict Zod validation rejects unsupported types and type changes; same-type duplicate names are checked before adding/renaming.
- Audit logs record category creation and name updates with type. Campus changes retain their audit events.
- Campus deactivation is non-destructive but can hide student stores until reactivation; no hard deletion is available.

## Verification and boundaries

- Tests: global-admin authorization and rejected invalid payloads; web type selector, product and service submission, existing category rename, campus editing, confirmation on deactivation.
- Normal API/web Bun unit suites, separate TypeScript checks and web production build are run without using an actual student database.
- Creating or renaming a category does not automatically approve university policy for that category. Existing campus review rules still apply.
- Authenticated write-path acceptance against a controlled isolated test database is not part of ordinary unit tests.
