# CPSU Market — Seller avatar migration safety preflight
**Date:** 2026-11-17 (Asia/Manila)
**Host:** DESKTOP-P5OAG7F, local Windows development PC
**Status:** HISTORICAL PREFLIGHT — seller-avatar development migration was subsequently approved and successfully applied on November 17, 2026. See `SELLER_AVATAR_DEV_ACTIVATION_2026-11-17.md`. The original preflight below is retained for traceability.

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

## Continuation — fresh protected backup and isolated acceptance PASS

A fresh backup and independent isolated-restore migration acceptance were run on the connected Windows desktop after the owner requested continuation. Results:
- **Protected backup created and retained** outside the repository under `%LOCALAPPDATA%\\CPSU-Marketplace\\backups\\seller-avatar-2026-11-17T02-03-31-052Z-8b90dd\\development-schema-data.sql`.
- Backup bytes: **328565**; SHA-256: `46d260afce664456327b97bdc44412b128cf46bf2c95a1607d9c8b7ab47acb7f`. A second local hash check verified the stored backup. Windows ACL inheritance was **disabled** on the backup directory and exactly three intended principals (owner, SYSTEM, Administrators) held access.
- The backup restored into a new, uniquely named disposable local database. All **24** source tables had matching row counts and content hashes.
- The exact approved one-column avatar SQL was applied to **only the disposable restore**. Column attributes were `varchar(255) NULL`. Pre-existing rows and all 24 table content hashes remained unchanged when the new column was excluded.
- Only synthetic records were used to test immediate photo record publication, photo replacement, unauthorized owner denial and audit creation against real MariaDB in the disposable restore. These all **passed**. This did not simulate the full multipart HTTP upload or image retrieval.
- Source database baseline/postcheck row counts and content digests matched. The disposable restore schema was dropped after successful acceptance. The private backup was retained.
- Post-run `bunx prisma migrate status` still listed **all three migrations unapplied** against `127.0.0.1:3306/cpsu_marketplace`. No development schema or application data was modified.

New guarded scripts:
- `apps/api/scripts/seller-avatar-backup-restore-acceptance.ts` — fresh locked-down backup, checksum, restore, synthetic DB acceptance, schema teardown
- `apps/api/scripts/seller-avatar-migration-readonly.ts` — read-only migration and schema checks
- `apps/api/scripts/seller-avatar-migration-temp-table-test.ts` — temporary-table SQL rehearsal

## Current conclusion

**Isolated backup-and-migration acceptance passed.** Development activation remains **BLOCKED** until explicitly authorized as a separate owner decision. Before writing development, plan and rehearse the Prisma migration-ledger reconciliation required to mark only `20261117123000_seller_avatar_review` applied while leaving `20261116220000_managed_student_content` and `20261116221000_pending_announcement_edits` unapplied. Do not use unscoped `prisma migrate deploy`. Live multipart/browser tests remain outstanding. No commit, push, deployment or unrelated migration has occurred.
