# Stage 1 — Development database backup, restore, and migration rehearsal

**Date:** November 11, 2026  
**Result:** PASS (local development-data rehearsal only)  
**Approval scope:** Sandbox verification, not application/database deployment.

## Environment and safeguards

- Source: local `127.0.0.1` database `cpsu_marketplace`, accessed for SELECT-only comparison and backup.
- Native tools: `C:\xampp\mysql\bin\mysqldump.exe` and `mysql.exe` (MariaDB 10.11.16 client).
- Temporary restore database: `cpsu_marketplace_stage1_real_restore` (created by this script and deleted afterward).
- Dump: OS temporary directory, outside repository, deleted afterward; contains actual development database data **only while the drill runs**. No credentials in CLI args or report. Password passed through child process environment.
- Strict guards prevent nonlocal, unexpectedly named, or production DB use, and prevent overwriting any preexisting sandbox schema.
- Script: `apps/api/scripts/verify-integrity-restore.ts`; repeat with `cd apps/api && bun run db:restore-rehearsal`. Note: this re-reads real development data; use only when authorized.

## Measured results

| Step | Result |
|---|---|
| Development DB snapshot | 20 tables including Prisma migration history; **402 total rows** at time of test |
| SQL logical dump | **98,649 bytes**, SHA-256 prefix `b8537027d21053aa` |
| Dump format checks | Contains schema and data; no unexpected database switching, database drops, or table drops |
| Development DB unchanged during backup | Before/after per-table hash comparison matched |
| SQL restore | Successfully imported into fresh named sandbox |
| Restore verification | **20/20 tables: counts and SHA-256 content digests match** |
| Candidate integrity migration | **20/20 additive SQL statements applied** in restored sandbox |
| Post-migration records | **20/20 tables: counts and SHA-256 content digests still match** |
| Candidate constraints | **19 foreign keys** detected, `Listing_discovery_idx` columns/order verified |
| Cleanup | Temporary restored schema dropped; local SQL dump deleted |
| Source development database | **No schema migration, data updates, or deletion performed** |

These checks cover database tables, not uploaded photo files. The repository's `infrastructure/backup/backup.sh` also includes media; that media restore still needs its own rehearsal for full pilot readiness.

## Limitations and gates

- The SQL dump was intentionally **ephemeral**. It is **not** a retained recovery backup. Before any deployment, create a separate appropriately protected, durable backup and verify that it can be restored.
- The local data is not production data. Rerun migration preflight against the actual environment to be changed.
- This is a successful *forward* migration rehearsal, not a verified rollback of an already migrated production database.
- Schema candidate lives only under `apps/api/prisma/candidates/stage1-integrity/`. The canonical `prisma/schema.prisma`, migration history, and development DB remain unchanged.
- Final `ON DELETE` semantics and applicable CPSU data-retention policies have not been formally approved. The candidate uses restrict-by-default, except the self-referencing category relation uses NO ACTION.
- An `EXPLAIN` query-plan check using representative listing volume is still recommended before optimizing composite indexes.
- Stage 2 WP2 should begin *after* Stage 1 deployment approval and a recorded C4 decision on condition and availability.

## Recommended next development package

**Stage 2 — WP2 Listing Management Completion** (after governance approval): add listing condition, controlled availability (`available`, `reserved`, `sold`), mark-as-sold, soft delete, condition filtering and own-listing favorite restriction. Keep moderation status separate. Build with fresh integration tests and additive migration; protect historical messages/reports and existing listing media.
