# Package B2a.3 — Real Isolated MySQL Reporting Acceptance
**Date:** 2026-11-17
**Status:** Local test-only work; no production schema or student data changes.
**Authority:** MASTER_BLUEPRINT.md MODULE 10, AGENTS.md, docs/STAGE1_TESTING_REPORT.md, docs/SECURITY_REPORT_HTTP_B2A_2026-11-17.md.
**Goal:** Complete genuine MySQL test acceptance for existing public reports without activating private-message reporting.
**Safety:** Reuse Stage 1's guarded opt-in runner. Runner requires source database name cpsu_marketplace at loopback, directs writes/migrations ONLY to cpsu_marketplace_test, enforces NODE_ENV=test and guard CPSU_INTEGRATION_TESTS=1, provisions temporary test upload directory, and calls resetFixtures before/after testing. No ordinary bun test database writes.
**Implementation:** Add a dedicated opt-in report integration suite with synthetic two-campus fixtures, actual Express/JWT/Prisma writes and persisted audit verification. Test cross-campus report visibility and resolution; malformed reports, staff/anonymous/self and nonpublic denials; check actual transaction rollback on injected audit error. Run it **sequentially after** the original stage1 suite, not concurrently, to avoid overlapping fixture cleanup. No production API code changes anticipated.
**Acceptance:** Observe failing runner-coverage guard, wire runner, green isolated MySQL integration, green ordinary API/web/type/build suites, git diff check. If connection/migration guard fails, stop and report without bypassing; do not migrate application DB or edit credentials.
