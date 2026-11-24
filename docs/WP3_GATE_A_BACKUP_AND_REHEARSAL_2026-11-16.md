# WP3 Gate A — Verified retained backup and WP3-only isolated restore rehearsal

**Date:** 2026-11-16 (Asia/Manila)
**Decision:** **GATE A PASSED (LOCAL SYNTHETIC MIGRATION REHEARSAL ONLY)**. This is **not** Gate B approval, a development migration, a deploy, or production readiness.
**Scope:** Back up the existing local CPSU development database and uploads, verify the retained backup, restore it into a freshly created disposable local MySQL schema, apply the **approved WP3 migration only**, verify original data/constraints, remove the disposable schema, and preserve all other developer work.
**Computer:** `DESKTOP-P5OAG7F`, repository `C:\Users\acer\Downloads\cpsu-student-marketplace`.
**Source:** `127.0.0.1:3306/cpsu_marketplace`, **read-only** for all Gate A database operations.

## 1. Retained backup evidence

Private retained backup, outside Git:
`C:\Users\acer\AppData\Local\CPSU-Marketplace\backups\2026-11-16T03-50-59-111Z`

- Existing guarded command: `cd apps/api && bun scripts/create-retained-backup.ts --development-backup`.
- SQL file: `cpsu_marketplace.sql`, **196,363 bytes**, SHA-256 `b54206d5645d3baf847749099b9e3ad4774f5b1a830bb5fff0104ff6ba364042`.
- SQL schema: **22 original tables**, including `_prisma_migrations`, `listing`, `user`, `session`, `pushsubscription` and `pushpreference`. No dump-driven schema switching, create/drop database or drop-table statements.
- Upload backup: **22 files**. Every backed-up file matched its source SHA-256; the count matched the private `manifest.json`.
- Windows ACL: owner `acer`, SYSTEM and Administrators only for all **26 backup objects**. Previously inherited broad read permission was removed and independently rechecked: **0 unexpected broad-reader grants**.
- **Privacy:** backup is not encrypted at rest; access-controlled local copy is **not** production-grade data protection. Do not commit, share or upload SQL/media. CPSU owner/DPO must set backup encryption, retention and secure disposal policies before production.

## 2. Safely reconciled migration chain

- At Gate A start, the live local development database had **five applied migrations** and the originally approved `20261116193000_wp3_transactions` was pending. Source WP3 SQL SHA-256 stayed pinned to:
  `F14FD1971E96BE0F42A4618415D4B94EFBD2D70AD5736D41784ADC14E3B133D5`.
- Two other agents' pending directories were detected and **never changed, deleted, staged or applied**:
  `20261116220000_managed_student_content`;
  `20261116221000_pending_announcement_edits`.
- A temporary, private Prisma migration tree was built with **exactly** five applied migrations and the pinned WP3 migration, using byte-checked copies from source. The full eight-migration source inventory was SHA-256 fingerprinted and rechecked before sandbox deployment to catch concurrent changes.
- The temporary Prisma schema used an environment URL **explicitly targeting only** `cpsu_marketplace_wp3_restore`. No source migrations were renamed/hidden on disk. The project repository remains with three pending development migrations; use of `bunx prisma migrate deploy` directly against the project database remains **UNAUTHORIZED**.
- The migration freeze was **scoped to this rehearsal through isolated files, a verified inventory snapshot and change detection**. It was **not** an OS-level or multi-agent write lock; other agents may still edit the repository. A coordinated freeze is required before Gate B.

## 3. Restore and WP3 migration results

- Created fresh disposable schema `cpsu_marketplace_wp3_restore` only after checking it was absent; restored SQL by native local MariaDB `mysql.exe` with an explicit sandbox target.
- Ran an independent `mysqldump.exe` of the restored sandbox and compared **all existing INSERT statements table-by-table** with the retained backup. **PASS**. This directly validates the backup snapshot rather than falsely requiring time-varying live login sessions to match an older snapshot.
- All **21 non-session source tables** agreed with their restored pre-WP3 values, and uploaded-file digests remained unchanged. Live `session` row count had increased after the backup due to ongoing activity; restored session contents matched the retained SQL instead.
- Applied only `20261116193000_wp3_transactions` using Prisma migrate deploy with the private scratch migration tree and sandbox-only URL. **PASS**.
- After the migration, reopened the Prisma Client so its query metadata matched the updated schema (otherwise an old client may surface the added column as `f19`). Verified **22/22 original Listing rows and every preexisting Listing field** unchanged; new `reservationTransactionId` was NULL for all restored listings.
- Checked all other original tables' row counts and content digests (except Prisma migration history, which intentionally gained a record), historical migration checksums, **seven new WP3 foreign keys**, required unique/history indexes, and both new transaction tables initially empty. **PASS**.
- At end, read-only comparison reconfirmed all non-session development row hashes unchanged and all 22 local upload hashes unchanged. **No development DDL or DML** from the Gate A scripts.
- Disconnected sandbox client, then dropped **only** the script-created disposable schema `cpsu_marketplace_wp3_restore`. **CLEANUP PASS**. The retained backup remains in its private location.

## 4. Superpowers/TDD and independent checks

- Test-first RED failures observed before implementing safety helpers and fixes.
- Gate A safety suite: **16 pass, 0 fail**, **57 expectations**, covering target DB restrictions, private backup location, SQL/manifest checks, exact independent restore rows, source session drift, exclusive WP3 chain, concurrent migration checks, old listing-field integrity, stale Prisma metadata defense and safe sandbox cleanup.
- General API `bun test`: **41 passed, 3 opt-in integration suites skipped, 0 failed**, 177 expectations.
- `bunx prisma validate`: **PASS**.
- Final development `bunx prisma migrate status` (read-only): eight source migrations, **three still pending**: WP3, managed content and announcement edits; Prisma exits 1 for expected pending status. **Development schema did not change**.
- This Gate A run did **not** rerun the Stage 1 full integration suite because its runner would deploy all concurrently pending migrations to `cpsu_marketplace_test`. Prior WP3 isolated HTTP integration results remain separate evidence.
- Existing unrelated worktree changes were preserved, and no commit, push, production/staging access or app deployment occurred.

## 5. Follow-up gates

1. **Gate B needs separate explicit owner approval** for migrating only local `127.0.0.1:3306/cpsu_marketplace` after a coordinated pause of all schema-writing agents, stable migration inventory, maintenance window, **new fresh retained and independently restored backup**, and reviewed strategy for the now-three pending repository migrations. Do not run the repository's normal `db:migrate`/`db:deploy` yet.
2. Before Gate B, decide whether to apply only WP3 through a specifically approved controlled migration approach, or separately approve and test the other pending migrations. **Gate A approval does not extend to those changes**.
3. After a separately approved development migration: restart Prisma/Express so cached field metadata is refreshed; browser QA with synthetic buyers/sellers and mobile/accessibility checks must pass.
4. Production/staging migrations, deployments, payments, push delivery, Git commit or push are **not approved** by this record.

**Final verdict: GATE A PASS; GATE B NOT AUTHORIZED.**
