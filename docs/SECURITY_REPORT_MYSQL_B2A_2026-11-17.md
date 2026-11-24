# Package B2a.3 — Isolated MySQL Report Acceptance and Test-Storage Isolation
**Date:** 2026-11-17
**Project:** CPSU Student Marketplace
**Status:** Test-only implementation verified. No live DB migrations, real student changes, commit, push, or deployment.

## What changed
- Added `apps/api/test/integration/report.test.ts` — opt-in 4-case real-MySQL / full Express/JWT/Prisma acceptance suite with synthetic two-campus fixtures.
- Updated `apps/api/test/run-integration.ts` — Stage 1 and reporting suites run **sequentially**, not concurrently; migrations/fixtures only target local `cpsu_marketplace_test`.
- The runner now explicitly forces `MEDIA_STORAGE=local` and clears all `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, and `GOOGLE_DRIVE_FOLDER_ID` variables in child test processes. Temporary WebP uploads stay within the test-only local directory.
- `apps/api/test/integration/fixtures.ts` refuses to reset the test database unless the media provider is local, in addition to the existing database name, host, test flags and upload-path requirements.
- Added regression assertions to `apps/api/test/report-safety.test.ts` for test-suite wiring and storage isolation.

## Actual MySQL integration evidence
**Guarded command:** `cd apps/api && bun run test:integration`.
- Existing Stage 1: **36 passed, 0 failed**.
- New B2a reporting: **4 passed, 0 failed**, **38 assertions**:
  1. Valid public listing and seller complaints persist with normalized reason and exactly one audit record each.
  2. Signed-out, staff, own-store/own-listing, draft, soft-deleted and suspended-seller complaints are denied; forged/ambiguous payloads do not write a report or audit.
  3. Campus A/B reviewers can only see and resolve in-scope reports; global university administrator can see both; resolution creates an audit and is not repeatable.
  4. A real Prisma/MySQL transaction rolls back a newly inserted report when a synthetic audit-writing error is thrown. This proves database rollback behavior, but a database-induced audit insertion failure and concurrency/abuse stress testing remain untested.
- Runner completed the **read-only test-database integrity audit**: no orphan records in checked relationships; no schema modifications in this package.
- General API unit suite **97 passed, 5 opt-in skipped, 0 failed**; web tests **34 passed**; API TypeScript, web TypeScript + production build, PWA validation, and `git diff --check` passed.

## Important finding: initial test-mode Drive inheritance
The **first attempt** ran with the developer's configured `MEDIA_STORAGE=google_drive` inherited by the integration subprocess. One synthetic 48×32 PNG was accepted and converted to WebP through the external storage path before the old Stage 1 assertion (`mediaPath.endsWith('.webp')`) failed; **35 passed, 1 failed** in that attempt and the reporting suite was not reached. Since Drive media paths are `gdrive:<fileId>`, the suffix assertion was for local storage only. The revised runner **forces local-only uploads**; its second full run passed 36+4, confirming this path.

**Potential cleanup:** The first attempt likely created a **synthetic test WebP in the operator's connected Google Drive folder**. Test-database fixture cleanup deletes its database record but does not perform remote Drive deletion. The remote file ID was not retained in this report; do **not** guess or delete existing student photos. Operator should review the authorized Drive folder for a newly created synthetic test WebP from this acceptance attempt and delete it **only after unambiguous verification**. No automatic remote Drive cleanup was performed.

## Remaining release gates
Physical iPhone Safari and desktop browser reporting QA; per-user anti-abuse/rate-limit policy tests; app deployment; password-recovery channel/privacy approval; cross-listing blocking policy and migration; private-message evidence access/retention policy. All latter features remain design-only.

## Files added or updated
`apps/api/test/integration/report.test.ts`, `apps/api/test/run-integration.ts`, `apps/api/test/integration/fixtures.ts`, `apps/api/test/report-safety.test.ts`, the B2a.3 plan, this report, project docs and the development log.
