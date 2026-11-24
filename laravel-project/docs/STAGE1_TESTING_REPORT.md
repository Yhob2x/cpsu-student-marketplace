# Stage 1 — Integration test foundation implementation report

**Restore rehearsal update (2026-11-11):** Local development-data SQL dump/restoration verified all 20 tables (402 rows, counts and SHA-256 digests match). The 19-FK/index candidate applied successfully to restored data with no record changes. Cleanup completed. See `docs/STAGE1_RESTORE_DRILL_REPORT.md`. Active Prisma schema/migrations remain unchanged; deployment approval still required.

**Follow-up (2026-11-11):** Read-only development database preflight completed with `bun run db:integrity-preflight`. Among 19 selected undeclared foreign-key relationships, 19 are missing constraints and zero orphan references were found in local `cpsu_marketplace`. The proposed listing discovery composite index is absent. See `docs/STAGE1_DATABASE_INTEGRITY_APPROVAL.md` for precise relationships, risk analysis, and the unapproved migration gate. No development schema changes or data updates were made.

**Date:** 2026-11-11  
**Blueprint:** `MASTER_BLUEPRINT.md` PART X / XI, `docs/DEVELOPMENT_ROADMAP.md` Stage 1  
**Scope:** Test infrastructure only. No application route, production schema, historical migration, credential, or business-rule change.

## Implemented

- `apps/api/test/run-integration.ts` — opt-in integration runner; only local `cpsu_marketplace` source may provision the distinct `cpsu_marketplace_test` database. Runner enforces `NODE_ENV=test`, a dedicated temporary upload directory, and an explicit integration flag. It deploys existing migrations *only to the test database*.
- `apps/api/test/integration/fixtures.ts` — guarded isolated database cleanup and repeatable two-campus fixtures.
- `apps/api/test/integration/stage1.test.ts` — Supertest against `createApp()`, authenticates with real JWT/session flows, 14 cases covering auth/session reuse, ownership, draft privacy, category rules, search validation/pagination, favorites, messaging isolation, admin scope/audit and uniqueness.
- `apps/api/scripts/integrity-audit.ts` — read-only foreign-key/orphan/index audit restricted to the test database.
- `apps/api/package.json` — added `test:integration` script, preserving the normal `test` command.

## How to run

From `apps/api`:

```powershell
bun test
bun run test:integration
bunx tsc -p tsconfig.json --noEmit
```

The integration runner must be run where the local MySQL application account has CREATE DATABASE permission. It never drops the application database. **It does reset all rows in the dedicated test database**, so do not use `cpsu_marketplace_test` for other work. Ordinary `bun test` skips the integration suite unless the separate guarded runner is used.

## Verified results

- Existing unit tests: **5 passed, 0 failed**.
- Integration suite: **14 passed, 0 failed**, 63 assertions.
- API TypeScript check: **clean**.
- Test database: `cpsu_marketplace_test`; two existing versioned migrations deployed successfully. No third application migration created.
- Foreign-key audit: **10/10 selected missing FK declarations** in the isolated database schema, **zero orphan rows** at audit time (after fixture cleanup, not proof of production data integrity).
- Listing index audit: primary key and individual FK-support indexes; **no composite discovery index** in the test schema.

## Remaining Stage 1 items and approval gates

1. **Stage 1 schema gate is not complete:** the declared-relation repairs and discovery index are still proposals. Review actual dev/production data *read-only*, owner-approve each constraint and index, then perform a separate additive migration with a verified backup and rollback strategy. Do not alter the deployed tables in this test-only package.
2. Additional integration security scenarios should be added before MVP launch: real image upload/magic-byte validation, full reviewer decision and notification paths, cross-origin/rate limiting, error cases, and further browsing/authorization boundary cases.
3. Build / device / browser QA are separate from Stage 1's backend test foundation.
4. C1–C7 governance conflicts in `docs/MVP_SCOPE.md` remain unresolved. WP2 (condition and controlled availability) requires the C4 decision before changes.
5. Preserve pre-existing Git working-tree changes before additional implementation. No baseline commit or reset was performed.

## Completion statement

**Stage 1 testing foundation: implemented and verified. Stage 1 database integrity migration gate: pending approval.** No WP2 feature has been implemented in this package.
