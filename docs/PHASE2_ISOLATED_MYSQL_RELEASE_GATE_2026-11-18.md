# CPSU Market — Local MySQL Integration Release Gate

**Date:** 2026-11-18 (Asia/Manila)  
**Connected PC:** DESKTOP-P5OAG7F  
**Operation type:** Source and SELECT-only testing, safety-guard changes, ordinary Bun unit tests.  
**Not performed:** MySQL schema creation, migration, fixture reset, insertion, backup restoration, deployment, push, Git commit or push.

## What changed

| File | Purpose |
| --- | --- |
| `apps/api/src/integration-target-policy.ts` | Pure fail-closed checks: exact local MySQL source; test schema must exist and be empty; every on-disk migration must have an identically named completed test migration record; unexpected, incomplete, duplicated, or pending migrations block. |
| `apps/api/scripts/integration-target-preflight.ts` | Read-only `information_schema` / `SELECT COUNT(*)` preflight with `--audit-only`; does not expose credentials, users or student content. Exits 1 if fixture reset/migration would be unsafe. |
| `apps/api/test/integration-target-policy.test.ts` | 13 DB-free regression cases for local/remote source restrictions, existing data, absent target, pending and incomplete migration history. |
| `apps/api/test/run-integration.ts` | The normal integration runner now **requires** read-only preflight before any synthetic fixture writes, does not provision a database or run `prisma migrate deploy`, runs test files serially, disables external media/push and ID collection, and repeats the read-only audit after cleanup. `--preflight-only` never runs fixtures. |
| `apps/api/package.json` | Added `test:integration:preflight` alias. |

Existing synthetic integration tests and application behavior were not changed.

## Verified data-source state

The existing read-only Gate C audit and the new preflight independently confirm:

- Source connection: local `127.0.0.1:3306/cpsu_marketplace`; credentials were **not** printed.
- Inspected target: dedicated `cpsu_marketplace_test`; **29 tables**, **0 non-migration rows**, **0 accounts**, **12 completed migrations**.
- Checked-in Prisma migration directories: **13**.
- **Blocked migration:** `20261118160000_store_reviews`, SHA-256 `3ADB399A1122F8951491CC87549A14E3610BCA516EC6E24183532116596D3147`.
- Its source SQL is an additive `StoreReview` table with transaction, buyer and seller foreign keys, indexes, `rating BETWEEN 1 AND 5` and one-review-per-transaction uniqueness. Source review is not an authorization to apply it.
- The preflight returned **exit 1** with a precise pending-migration reason. The `--preflight-only` runner returned **exit 1** before starting suites. These are **expected safety failures**, not functional test pass results.
- A second independent read-only Gate C audit after the dry run still showed **29 tables, 0 non-migration rows and 12 applied migrations**.

## Testing

| Check | Observed outcome |
| --- | --- |
| New safety policy focused tests | **13 passed, 0 failed** |
| Full backend `bun test` | **213 passed, 8 intentionally skipped, 0 failed; 738 assertions, 50 files** |
| Backend `bunx tsc -p . --noEmit` | **PASS** |
| New `bun run test:integration:preflight` | **BLOCKED (exit 1)** — one required migration pending |
| Runner `bun test/run-integration.ts --preflight-only` | **BLOCKED (exit 1)** — no fixture work performed |
| Final SELECT-only test schema inventory | **PASS** — unchanged target, no data rows |

The 8 opt-in tests remain skipped, so full real-MySQL multi-role acceptance is **not** complete. A successful preflight would establish only the test target's safety; a separate migration review and integration execution are still needed.

## Next approval gate

Do **not** run `bun run test:integration`, `prisma migrate deploy` or reset fixtures yet.

1. Explicitly review and approve the **single pending** `20261118160000_store_reviews` migration **for `cpsu_marketplace_test` only**. This is not approval for `cpsu_marketplace` development or any staging/production database.
2. Have an authorized operator independently confirm the throwaway nature of this exact empty test schema, its account privileges, and no live student records. Preserve a private, redacted audit/rollback record before any approved DDL.
3. Apply **only the reviewed test migration** under a separate approval. Re-run `bun run test:integration:preflight`; it must report **13/13 complete migrations, zero data rows and exit 0**.
4. Only then run `bun run test:integration` to execute guarded sequential synthetic test suites without schema migration. Recheck zero rows and permissions at the end.
5. Keep the **distinct** push integration runner and HTTPS/physical-device/PWA release gates pending their own approval and preflight. Do not interpret this local test approval as CPSU institutional hosting/privacy/push approval.

This pass did not touch application data or the existing concurrent UI work. Existing unrelated changes in the shared working tree are outside this report.
