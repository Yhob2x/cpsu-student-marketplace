# WP3 Development Database Readiness — Implementation and Approval Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, but ONLY AFTER its separate approval gates. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely activate the already implemented C5/C1a WP3 transaction schema on the *local development* `cpsu_marketplace` database, only after verified retained backup, isolated restore rehearsal, migration integrity checks and explicit owner approval.

**Architecture:** Preserve the present Prisma migration chain and existing student data. Create a private, retained SQL + uploads backup, rehearse a **separate disposable restored database** with row/hash comparison and the one pending WP3 migration, and treat a development migration as an independent owner-authorized operation. Run the student-facing browser workflows with synthetic accounts against a separate local sandbox whenever possible; do not invent/seed real student data.

**Tech Stack:** Windows PowerShell, Bun 1.4.4, Prisma 6.1, TypeScript, Express 5, MySQL/MariaDB 10.11.16 via XAMPP at `127.0.0.1:3306`, React/Vite PWA, Supertest.

**Spec:** `docs/superpowers/specs/2026-11-16-wp3-transaction-design.md`; `MASTER_BLUEPRINT.md` PART XIII C5/C1a; `AGENTS.md`.

**Gate A final verification (2026-11-16): PASSED.** The user authorized a retained backup and isolated rehearsal only. The retained SQL and all 22 uploads were verified, and a disposable restored database was compared with the backup itself. A temporary Prisma migration tree included exactly five applied migrations plus WP3; two other agents' pending migrations were excluded without modifying the repository. WP3 applied successfully to the sandbox, seven foreign keys and original rows were validated, and the sandbox was removed. See `docs/WP3_GATE_A_BACKUP_AND_REHEARSAL_2026-11-16.md`. **Gate B, development/production migrations, commits, pushes and deployment remain unauthorized.**

## Current verified baseline (read-only inspection)

- Repository `C:\Users\acer\Downloads\cpsu-student-marketplace`; at inspection HEAD `461f922`. Many unrelated tracked/untracked edits are present, including Web Push UI/staging/graph data; never overwrite, discard, stage, commit or push them.
- `cd apps/api && bunx prisma migrate status` confirmed connection to local `cpsu_marketplace` at `127.0.0.1:3306`: **6 migration directories; only `20261116193000_wp3_transactions` pending**. The earlier `20261116094000_pwa_push_notifications` is already applied. If status changes, STOP and re-plan.
- `bunx prisma validate`: PASS. WP3 migration has additive `Listing.reservationTransactionId`, `Transaction`, `TransactionStatusLog`, indexes and seven FK constraints; no table/data drop statements were seen.
- WP3 migration SQL SHA-256 at inspection: `F14FD1971E96BE0F42A4618415D4B94EFBD2D70AD5736D41784ADC14E3B133D5`. Do not silently modify an already-tested migration.
- Working native CLI paths exist: `C:\xampp\mysql\bin\mysqldump.exe`, `mysql.exe`; client reports MariaDB 10.11.16.
- `apps/api/scripts/create-retained-backup.ts --development-backup` exists: SQL dump plus upload folder snapshot and JSON SHA-256 manifest under private `%USERPROFILE%\AppData\Local\CPSU-Marketplace\backups\<timestamp>`. Presence of prior backups (three folders observed) is **not evidence** of a fresh, restorable WP3 pre-migration backup.
- **Do not reuse** `apps/api/scripts/verify-integrity-restore.ts` for WP3. It is hard-coded to the old Stage 1 20-table snapshot and attempts to reapply 19 already-applied FK/index candidates; it is not a general WP3 restore test.
- `apps/api/test/run-integration.ts` migrated and tested the dedicated `cpsu_marketplace_test` database, not development. Last WP3 integration evidence: 35 passed, 0 failed; this does not prove restoration of the development data.
- `apps/web` routes include `/transactions`, `/transactions/:id`, and the profile/notification entry points.
- No sensitive rows, .env contents, passwords, backup contents or identifying student details were printed in preparation.

## Global constraints

1. The *only* approved work right now is this read-only preparation plan. Do not infer development migration authority from the C5 feature approval or Stage 1 Push migration authorization.
2. No production/staging/remote database access or migrations; no Git push, commit, deploy, VAPID/Push activation, credential change, student notification delivery or seeding into real student data.
3. On any failure or environment mismatch, **STOP**, report evidence, and do not attempt a manual corrective DDL, reset, migration resolve, or rollback without separate approval.
4. Backups contain private student data and media; store outside Git, prevent external access, use encryption/access-control as approved by CPSU, verify retention rules with the DPO. Never paste SQL, credentials or student records into chat.
5. Backups must be **retained AND independently restorable**. SQL file existence, byte count or a checksum alone is insufficient; compare all table counts and per-table content hashes including `_prisma_migrations` and the Push tables.
6. Stop API and background writers for the actual migration after an approved maintenance window; verify backups remain available before any restart. Neither service readiness nor application recovery can be inferred from a successful Prisma exit code.
7. Prisma migration history is append-only; never edit existing applied migrations or bypass drift with `migrate resolve`. Avoid `prisma migrate dev` for controlled activation because it can prompt for reset or create new migrations.
8. Preserve existing inquiry threads, handoffs, files, notifications, listings and approved C4 terminal-sold rules. WP3 self-reported transaction completion never certifies payment/delivery.
9. Use the Superpowers RED → GREEN → REFACTOR workflow for *any new tool/script code* and isolated automated tests.

## Review focus: risks the plan must catch

- **Unexpected extra pending migrations or checksum drift:** halt before deployment, never apply extra unknown schema changes.
- **False-safe backup:** reject a dump that cannot restore fully; validate data and uploads *in addition* to SHA-256.
- **Wrong target database:** enforce loopback host + exact source/restore database names at both connection-string parse and `SELECT DATABASE()`; refusal must not fall back to default DB.
- **Hidden startup/Prisma lock problem:** verify an independent new Prisma Client generation and API startup; existing Windows Prisma engine DLL file lock is a known prior issue.
- **Concurrent writes/transaction states:** physical inventory double-acceptance and buyer-verification revocation must remain enforced; test only with isolated synthetic fixtures.

---

## Task 1 — Reconfirm immutable preflight (READ-ONLY; may be executed now)

**Files:** Inspect `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20261116193000_wp3_transactions/migration.sql`, `apps/api/test/run-integration.ts`, `apps/api/.env` only through non-secret identity checks.

**Interfaces:** Inputs are current local `DATABASE_URL` and migration directories; output is a signed-off, redacted readiness record.

- [ ] Step 1. Check device identity, Git HEAD and `git status --short`; preserve every existing diff. Expected: no unexpected target change and no writes.
- [ ] Step 2. In `apps/api`, run `bunx prisma migrate status`, `bunx prisma validate`; no `migrate dev` or `deploy`. Expected: `cpsu_marketplace` at loopback; exactly one pending migration named `20261116193000_wp3_transactions`.
- [ ] Step 3. Compare `Get-FileHash prisma/migrations/20261116193000_wp3_transactions/migration.sql -Algorithm SHA256` with the pinned SHA-256 above. Expected: exact match or STOP.
- [ ] Step 4. Run `bun scripts/integrity-preflight.ts --audit-only` (read-only) and check all listed FK/integrity assertions. Inspect `_prisma_migrations` status using read-only Prisma commands; if drift, failed migration or orphan exists: STOP.
- [ ] Step 5. Record active service processes and a maintenance window; no service stop until separate authorization.

**Approval A:** Owner explicitly approves making a private retained backup and performing a **new isolated restore/migration rehearsal**. Approval A **does not** authorize changing the development DB.

## Task 2 — Create verifiable retained backup (ONLY AFTER APPROVAL A)

**Files:** `apps/api/scripts/create-retained-backup.ts`; any script improvement must first have a failing test and separate code review.

- [ ] Step 1. Confirm exact local `cpsu_marketplace` source, no production mode, valid XAMPP client, secure storage and adequate free space. Coordinate stopping in-flight schema changes/DDL, downloads/uploads, and new writes during snapshot; confirm dump tool permissions.
- [ ] Step 2. Run only the existing scoped command from `apps/api`: `bun scripts/create-retained-backup.ts --development-backup`. Expected: timestamped directory outside repo, SQL dump, uploads copy, `manifest.json`; the development DB remains query-only.
- [ ] Step 3. Independently verify the SQL SHA-256 matches `manifest.json`, nontrivial size/expected tables including both Push tables, expected migration history, upload count and sampled upload hashes; reject malformed SQL containing schema selection or destructive database statements.
- [ ] Step 4. Protect/encrypt the backup; keep a second offline/private copy per project policy; record only path, date, counts, SHA-256, classification and success—not raw student data.
- [ ] Step 5. Verify backup retention/security expectations with the CPSU owner/DPO; a checksum without encryption/access restrictions does not pass for production data.

Expected: `BACKUP VERIFIED`, no student data printed, checksum and uploads confirmed. Failure → STOP, do not migrate.

## Task 3 — Prove full restore and forward migration in disposable schema (ONLY AFTER APPROVAL A)

**Files:** New focused test-only `apps/api/scripts/verify-wp3-retained-restore.ts` and its guard/restore test, if approved. Do NOT repurpose the obsolete Stage 1 restore script as-is.

- [ ] Step 1 (RED). Add an isolated test asserting: refuses remote/production/wrong source DB; refuses any pre-existing target DB; refuses SQL with `USE`/`CREATE DATABASE`/`DROP DATABASE`/`DROP TABLE`; refuses missing/failed checksum; never prints secrets or student rows.
- [ ] Step 2 (RED). Add restore comparison tests for every current application table (catalog dynamically from `information_schema`, excluding only explicitly justified system tables) including Push and `_prisma_migrations`; assert equality of row counts and canonical row digests, plus uploaded photo counts/digests.
- [ ] Step 3 (GREEN). Implement *guarded, explicit* temporary name `cpsu_marketplace_wp3_restore` and refuse if already present. Restore the **retained backup** there with MySQL CLI, using securely passed credentials and explicit destination, not the active development DB. Preserve sensitive dump only in private local files.
- [ ] Step 4. Verify source vs restored contents and migration-history checksums (no source writes). Fail if source changed after snapshot or when snapshot is stale for the intended maintenance window.
- [ ] Step 5. Apply **only the pinned WP3 migration** to that restored sandbox using `prisma migrate deploy` with an explicitly overridden, guard-validated `DATABASE_URL` pointing at `cpsu_marketplace_wp3_restore`. Expected: one migration applied, Push already present; never run deploy with the development DB URL at this stage.
- [ ] Step 6. Compare pre/post restored data for all pre-existing tables and upload bytes; all previously existing rows must survive. Inspect `Transaction`, `TransactionStatusLog`, reservation column, seven WP3 FKs, expected indexes and migration history.
- [ ] Step 7. Run isolated synthetic transaction HTTP tests with a dedicated test API that **cannot access the development DB**; include single-winner product acceptance, withdrawal, two-person completion, invalid-role denial and suspended-buyer-after-request acceptance. Keep synthetic writes out of restored real student rows or use a second disposable clone.
- [ ] Step 8. Remove sandbox only when it was created by this test, has the exact allowed name, and its validations completed; on failure preserve diagnostics privately, never auto-delete an unknown schema. Keep retained backup.

Expected: `RESTORE PASS` and `WP3 FORWARD-MIGRATION PASS`, with count/hash match and zero unexpected changes to source. If either fails → STOP.

**Approval B:** Owner separately approves exactly the local development `cpsu_marketplace` migration and a brief maintenance window *after* reviewing Tasks 1–3 evidence. No production approval is implied.

## Task 4 — Activate the development schema (ONLY AFTER APPROVAL B)

**Files:** Existing `apps/api/prisma/migrations/20261116193000_wp3_transactions/migration.sql`; do not change it.

- [ ] Step 1. Capture fresh pre-change Git status, source DB identification, migration status, selected row counts, and WP3 SQL checksum. Confirm no schema changes since backup rehearsal and no extra pending migration.
- [ ] Step 2. Stop local API, web dev server and any scheduled write jobs; confirm no active transactions, uploads or other agent migrations. Take a **fresh retained backup** immediately before deployment and verify it can restore (old backup is not enough if data changed).
- [ ] Step 3. Reconfirm owner Approval B *specifically* covers `20261116193000_wp3_transactions` on `127.0.0.1:3306/cpsu_marketplace`.
- [ ] Step 4. In `apps/api`, use **`bunx prisma migrate deploy`**, only after confirming it will execute exactly the one pending WP3 migration. Expected: exit 0, exactly WP3 applied. If not, STOP; do not try `migrate reset`, `db push` or hand-edit `_prisma_migrations`.
- [ ] Step 5. Run `bunx prisma migrate status` and read-only integrity checks; expected: no pending migration, `Transaction`/history tables and reservation FK present, previous row counts unchanged, no orphan references, Push tables preserved.
- [ ] Step 6. Regenerate Prisma Client when no API process holds the Windows query-engine DLL: `bunx prisma generate`; run `bunx tsc -p . --noEmit` and web `bun run build` before restarting services.
- [ ] Step 7. Restore local API/web services with only development endpoints and push delivery still disabled; inspect health and server logs without printing private data. If validation fails, stop service and move to the recovery gate instead of partially activating users.

Expected: local development DB is migrated and functioning *only after* Approval B. No push, commit or remote deployment.

## Task 5 — Browser QA & accessibility (approval tied to test environment)

**Files:** `apps/web/src/pages-transactions.tsx`, `pages-public.tsx`, `pages-profile.tsx`, `pages-admin.tsx`, `main.tsx`, `apps/api/src/routes/transactions.ts`.

- [ ] Step 1. Run automated regressions against isolated `cpsu_marketplace_test`: from `apps/api` `bun run test:integration`, `bun test`, `bunx tsc -p . --noEmit`; from `apps/web` `bun run build`; root `bun run pwa:check`. Record exact counts.
- [ ] Step 2. Start locally with root `bun run api` and `bun run web` in **separate terminals** only after approval B; verify `http://localhost:5173`, `/api/v1/health`, and SPA transaction route loads. Do not use `bun run dev` at the root (script does not exist).
- [ ] Step 3. In a dedicated disposable sandbox with synthetic accounts, test buyer request, seller accept/reject and mandatory rejection reason; unauthorized student cannot view or mutate others' transactions.
- [ ] Step 4. Test physical-item exclusive reservation and cancel-releases-own-reservation; services support repeat requests and do not mark sold automatically.
- [ ] Step 5. Test both-party meetup and completion confirmations, terminal state protections, append-only history, existing `Handoff` preservation, and visible correct self-report notices.
- [ ] Step 6. Test suspended/unverified buyer/seller and admin/establishment role exclusion, campus-scoped admin read-only monitoring, privacy of participant identity, and unchanged prior inquiry/media features.
- [ ] Step 7. Test phone widths, keyboard focus/labels/errors/loading states, Safari/Chrome browser behavior, sign-out and no private data in offline caches; no real push enrollment/delivery.
- [ ] Step 8. Report failures with screenshots/logs containing synthetic data only; fix via tests first and repeat checks. Development-site validation should use read-only smoke checks unless the owner separately authorizes synthetic fixture creation/cleanup in development.

## Task 6 — Recovery plan & final sign-off

- [ ] If *before* migration, stop on any failing backup or restore check; no rollback required because development data was untouched.
- [ ] If *during/after* migration, halt all writers; collect read-only logs and current `_prisma_migrations`; keep failed source intact as evidence. MySQL DDL can partially commit; never assume an automatic transaction rollback.
- [ ] Restore path is **backup → newly created quarantine schema → independently verify content and media → approved controlled application cutover or exact-schema recovery**. Never `DROP DATABASE cpsu_marketplace` as an automatic recovery step.
- [ ] A destructive replacement of the development schema, any connection-string change or media folder replacement requires a **new explicit recovery approval**, even if the forward migration approval was given.
- [ ] Once stable: record DB status, verification outputs, new migrations applied, backup/restore evidence, known browser issues and sign-off. Preserve all unrelated Git changes; do not commit/push without separate request.
- [ ] Production migration/release continues to require CPSU privacy/security review, HTTPS/device QA, separate backups and **separate explicit deployment approval**.

## Status and approval requests

| Gate | State as of plan creation | Requirement |
|---|---|---|
| Source and migration preflight | **READ-ONLY checked** | Recheck immediately before execution |
| Fresh retained backup + isolated restore rehearsal | **GATE A PASS** | Verified private backup and isolated restore; see Gate A report |
| Verified full restore + WP3 sandbox migration | **PASS / SANDBOX REMOVED** | Pinned WP3-only temporary migration chain; other work excluded |
| Development WP3 schema deployment | **NOT AUTHORIZED / NOT EXECUTED** | Owner Approval B after restore evidence |
| Browser QA using synthetic data | **NOT EXECUTED** | Approved isolated test environment / maintenance window |
| Production DB, release, Git push | **OUT OF SCOPE** | Separate institutional gates |

**Recommended next action:** Gate A evidence is ready for review. Before seeking Gate B, coordinate a genuine multi-agent migration freeze, review the three now-pending development migrations and the WP3-only activation strategy, prepare a maintenance window, and require a new fresh retained backup plus restore evidence. Only a *new explicit Gate B approval* may authorize the local development migration. Production remains separate.
