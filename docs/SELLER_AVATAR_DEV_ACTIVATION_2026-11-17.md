# CPSU Market — Approved seller-avatar development migration activation

**Date:** November 17, 2026 (Asia/Manila)
**Approved scope:** Apply only the reviewed `20261117123000_seller_avatar_review` migration to the existing local development database. Preserve all current application data and leave the two older managed-content migrations unapplied.
**Outcome:** PASS — development database migrated and verified, no deployment.

## Target and source
- Local target: `127.0.0.1:3306/cpsu_marketplace` (MariaDB / MySQL).
- Exact reviewed SQL: `ALTER TABLE SellerProfile ADD COLUMN avatarPath VARCHAR(255) NULL;`.
- The migration directory retains its historical `_review` name, but uploaded seller avatars publish immediately after the seller's authorized upload and image sanitization; no human avatar approval column/queue is required.
- Migration SHA-256: `9183574c569804e603371466d76d50477b0c7603ae3022bc73a8a54f2c0ac91f`.

## Fresh backup and isolated rehearsal
The authorized activation script `apps/api/scripts/seller-avatar-approved-dev-activation.ts` executed with `--apply-approved-avatar-only`. Prior to persistent development DDL it:
1. Verified local DB identity, existing migration ledger, migration SQL hash, and pre-migration source row digests across **24** tables.
2. Created a fresh private backup at `%LOCALAPPDATA%\\CPSU-Marketplace\\backups\\seller-avatar-dev-approval-2026-11-17T02-11-48-802Z-1fd7aa\\pre-activation.sql`.
3. Backup: **329,658 bytes**, SHA-256 `2ff192e02d4707be7950f423b2dc1a6edd06cd37291c2b47283274a241112dc0`. Stored outside Git with inherited ACL entries removed and owner/SYSTEM/Administrators permissions.
4. Restored the snapshot into a uniquely named disposable local database; verified identical table inventory, row counts, and content hashes.
5. Applied the exact one-column migration to **only that disposable restore**.
6. Executed the locally installed Prisma `migrate resolve --applied 20261117123000_seller_avatar_review` against the disposable restore and verified only that migration was marked applied, leaving older migrations absent.
7. Verified the original data remained unchanged, excluding the new nullable avatar column and migration-ledger entry.

## Authorized local development change
After source identity and unchanged data were reconfirmed:
- Executed exactly the approved additive SQL against `cpsu_marketplace.SellerProfile`.
- Executed Prisma `migrate resolve --applied 20261117123000_seller_avatar_review` **only on that local development database**.
- Verified `avatarPath varchar(255) NULL`, migration checksum and successful ledger entry.
- Compared existing application rows and values against the pre-migration digests across all original tables; **all preserved**. The expected extra Prisma migration-history row is the only ledger change.
- Deleted only the uniquely named disposable restore schema; retained the protected backup.

## Independent postchecks
- `bun scripts/seller-avatar-migration-readonly.ts`: development now has `avatarPath` and the recorded avatar migration; the older two remain absent.
- `bunx prisma migrate status`: the following two migrations remain unapplied in development:
  - `20261116220000_managed_student_content`
  - `20261116221000_pending_announcement_edits`
- `bun test test/seller-avatar-update.test.ts test/upload-security.test.ts test/photo-review.test.ts`: **14 passed, 0 failed**.
- The separate `cpsu_marketplace_test` schema was not modified in this activation. `cpsu_marketplace_push_test` already had the avatar migration before this activation; it was not touched.
- No production/staging migration, Git commit, push, deployment, seed, student account data update, or other pending migration executed.

## Remaining acceptance (not part of approved migration)
- The seller-owned multipart upload, public image retrieval, replacement, removal, and physical mobile UI have not been manually exercised against the newly migrated development database. Those operations require a safe synthetic user/permissioned workflow; do not use a real student's account without authorization.
- The running local API process and Prisma client were not forcibly regenerated/restarted. A prior local client inspection found the `avatarPath` model field present, but verify the API process is serving the current source before expecting the UI to work.
- Image format validation and WebP sanitization do **not** detect prohibited content; the existing post-publication reporting mechanism remains relevant.
