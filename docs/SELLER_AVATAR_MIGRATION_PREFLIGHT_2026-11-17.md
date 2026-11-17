# CPSU Market — Seller avatar migration safety preflight
**Date:** 2026-11-17 (Asia/Manila)
**Host:** DESKTOP-P5OAG7F, local Windows development PC
**Status:** READ-ONLY AND TEMPORARY-TABLE SQL REHEARSAL PASS; permanent migration NOT authorized/applied

## Background
The CPSU Market owner requested immediate publication of manually selected seller profile pictures after secure image processing. Current repository migration `20261117123000_seller_avatar_review` has a historical name but now adds **only** nullable `SellerProfile.avatarPath VARCHAR(255)`. The original reviewer queue/pending image column is superseded and absent from the schema and migration SQL.

## Inspection performed and evidence
1. `bunx prisma migrate status` connected to **127.0.0.1:3306/cpsu_marketplace**, reporting 9 repository migration directories and exactly 3 unapplied: `20261116220000_managed_student_content`, `20261116221000_pending_announcement_edits`, and `20261117123000_seller_avatar_review`. No migration was executed.
2. Read-only script `apps/api/scripts/seller-avatar-migration-readonly.ts` verified that the SQL file matches the exact reviewed one-column additive statement. SHA-256 **9183574c569804e603371466d76d50477b0c7603ae3022bc73a8a54f2c0ac91f**.
3. Metadata-only schema inspections found:
   - `cpsu_marketplace`: neither `avatarPath` nor legacy `pendingAvatarPath` exists; none of the three pending migrations applied.
   - `cpsu_marketplace_test`: `avatarPath` absent; two earlier managed-content migrations are applied; avatar migration not applied.
   - `cpsu_marketplace_push_test`: `avatarPath` absent; none of these three migrations applied.
4. XAMPP `C:\xampp\mysql\bin\mysqldump.exe` is available, though not present in `PATH`. The existing private backup directory under `%LOCALAPPDATA%\CPSU-Marketplace\backups` exists, with 120 files; the newest file's last-modified timestamp was **2026-11-16 16:18:17** local. No backup validity or restorability was established; a **fresh, protected backup** is required before changing development data.
5. `apps/api/scripts/seller-avatar-migration-temp-table-test.ts` guarded local source identity, connected only to `cpsu_marketplace_test`, cloned the SellerProfile table *structure* into a **connection-local temporary table** (no data rows copied), executed the equivalent reviewed ALTER against the temporary table, validated exactly `avatarPath varchar(255) NULL`, then dropped the temporary table. Result: **PASS**. Existing persistent table and migration ledger were not modified.
6. Previous source-only checks: web TypeScript/Vite, Prisma schema validation, API TypeScript via temporary generated client, and avatar security/concurrency synthetic tests passed; this preflight does not constitute full authenticated upload or server acceptance.

## Why automatic migration deployment is blocked
`bunx prisma migrate deploy` / `bun run db:deploy` would apply **all 3 pending migrations** to the configured development database, not just the requested avatar column. Unrelated managed-content edits are in progress. Never use an unguarded migrate/deploy command here.

## Required approval gates before activation
1. Obtain explicit owner authorization for **backed-up, isolated migration acceptance** and, separately, for **development-only migration application**. Preserve unrelated work and live data.
2. Capture a fresh protected development backup with verified integrity, checksum and a successful isolated restore/rehearsal. Never print credentials, dump rows or store backups in Git.
3. On a dedicated disposable local test schema restored from a validated snapshot, apply **only** the reviewed avatar-column SQL and run MySQL-backed integration tests for upload, ownership, replacement, audit transaction rollback, public retrieval, guest visibility and removal. Test that unrelated schema and row counts remain intact.
4. Only after that acceptance, explicitly authorize and apply the single reviewed avatar change to `127.0.0.1:3306/cpsu_marketplace`; reconcile Prisma migration ledger for this singular migration without marking or executing unrelated migrations. Keep a recorded SQL hash, verified source DB identity and post-migration schema check.
5. Coordinate stopping only the approved running local API process to regenerate its Prisma Client; then restart and perform browser smoke (seller uploads synthetic photo; it is immediately public to a guest; replacement/removal work; listing photo review stays gated). Do not stop other Bun processes without approval.
6. No staging/production deployment, Git commit, push, unrelated schema migration, real student record mutation or media-storage credential change is authorized by this preflight.

## Current conclusion
The source SQL is structurally valid against a temporary table; all three target databases remain unmodified. Database activation is **BLOCKED** pending a fresh restorable backup, explicitly authorized isolated migration acceptance, and a separate development-only approval.
