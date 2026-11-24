# Managed content editor activation — 18 November 2026

## Issue and scope

The admin guidelines and announcements editors showed `managed_content_unavailable` because the local development database lacked `GuidelineContent` and `Announcement`. Both GET endpoints previously failed with Prisma `P2021` as diagnosed in `docs/ADMIN_CONTENT_ERROR_RECOVERY_2026-11-18.md`.

The owner requested that both editors be fixed. Only the two related additive migrations were activated in local development:

- `20261116220000_managed_student_content`: creates `GuidelineContent` and `Announcement`
- `20261116221000_pending_announcement_edits`: adds the announcement draft-edit columns

The unrelated `20261117230000_private_student_identity` migration remains pending. No production/staging database, seller record, listing, student identity record or homepage draft/publication was changed.

## Controlled local activation

Executed `bun scripts/managed-content-approved-dev-activation.ts --apply-content-only` with a strict local database-name/host and migration SHA-256 guard.

- The expected tables were absent in the source; the previously activated `HomePageContent` migration and existing records were present.
- A private SQL and media backup was retained at `C:\Users\acer\AppData\Local\CPSU-Marketplace\backups\managed-content-dev-2026-11-18T02-08-03-567Z-688c17`.
- The backup restored successfully into a disposable MySQL database. Both migration scripts ran there and the expected 2 new tables/columns appeared. All pre-existing rows matched their pre-migration snapshots.
- The local `cpsu_marketplace` development database received only the same reviewed migrations, with checksums recorded in `_prisma_migrations`.
- Post-activation checks confirmed all pre-existing application rows unchanged, the homepage record preserved and the identity migration still unapplied.
- The isolated scratch database was removed.

## Functional verification

- In-process Express HTTP GETs using a synthetic (not persisted) global-admin request context: `/api/v1/admin/content/guidelines` returned HTTP 200; `/api/v1/admin/content/announcements` returned HTTP 200 with zero entries.
- Public `/api/v1/guidelines`, `/api/v1/announcements`, and `/api/v1/home-page` also returned HTTP 200 in-process.
- The running local API returned HTTP 200 for all three public endpoints.
- HomePageContent still existed and was untouched by activation.
- Focused API tests: 11 passed; API TypeScript check passed.
- Web: 77 tests passed; TypeScript/Vite production build passed.
- Prisma migration status: only `20261117230000_private_student_identity` pending.

## Remaining checks

Editors are now active at the database/API level. A manual signed-in Admin > Content browser test can confirm input/save/publish interactions, using authorized test content if appropriate. No test notice or guideline was created in the development database; real publication still requires the administrator to explicitly publish. No Git commit, push, or production deployment.
