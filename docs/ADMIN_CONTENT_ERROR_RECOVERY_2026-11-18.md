# Admin Content missing-schema error recovery — 18 November 2026

## Scope and observed cause

The administrator reported `internal_error` under Homepage photos in Admin > Content. The homepage photo editor itself is a separate component and was displaying its saved draft. The lower admin content page loaded Guidelines and Announcements through one `Promise.all`, so one rejected request prevented both from being shown.

SELECT-only Prisma probes against the existing local `127.0.0.1:3306/cpsu_marketplace` database reproduced Prisma `P2021` for both:

- `GET /api/v1/admin/content/guidelines` — missing `GuidelineContent` table
- `GET /api/v1/admin/content/announcements` — missing `Announcement` table

The global HTTP handler returned HTTP 500/`internal_error` for those errors. The existing two managed-content migrations are still pending. Their absence is a release/activation gate, not grounds for applying an unapproved migration.

## Repair

- `apps/api/src/content-editor-errors.ts`: maps only managed admin content schema errors `P2021` (missing table) and `P2022` (missing column) to HTTP 503/`managed_content_unavailable`. Other errors remain visible to the ordinary error handler.
- `apps/api/src/routes/admin.ts`: mounts the scoped error mapping after the guidelines and announcement routes; existing global administrator permissions and audit requirements remain intact.
- `apps/web/src/pages-managed-content.tsx`: separates Guidelines and Announcements loading, errors, Retry, and actions. One unavailable editor does not stop the other or the independent homepage editor. Failed/unavailable editors disable content-changing controls.
- `apps/web/src/api.ts`: gives a plain-language explanation of `managed_content_unavailable`.
- Added focused API HTTP and web rendering/message regression tests.

## Verification

- SELECT-only database query probes: both endpoints raise `P2021` for missing tables (confirmed).
- In-process admin HTTP probes with a synthetic global-admin request context and real local SELECT-only queries: both endpoints return `503 managed_content_unavailable` (confirmed). The probe never opened a network port or changed authentication records.
- API tests: 11/11 focused content/home-page/permissions tests passed; new HTTP mapping tests 3/3 passed.
- Web tests: 77/77 passed.
- Web `bun run build`: TypeScript and Vite production build passed.
- API `bunx tsc -p . --noEmit`: passed.
- `git diff --check`: passed.

## Remaining activation and acceptance

The admin guidelines and announcements editors cannot save or publish until their schema migrations are independently reviewed and approved. The public guidelines/announcements fallbacks remain unchanged. No database migration, schema modification, production deployment, commit, push, or homepage publication was performed. Existing homepage hero draft remains unpublished. A signed-in browser walkthrough on a physical device remains unverified; code tests and synthetic local HTTP probing are not a substitute for that final acceptance.

## Local activation follow-up — 18 November 2026

The subsequent user-requested local activation completed successfully. The two required managed-content migrations have been selectively applied after a retained backup and isolated restore rehearsal. Both admin GET endpoints now return HTTP 200 and the editors have database backing. The separate student identity migration remains pending. Details: `docs/MANAGED_CONTENT_DEV_ACTIVATION_2026-11-18.md`.
