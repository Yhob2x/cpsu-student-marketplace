# CPSU Market — StoreReview local development activation
**Date:** November 18, 2026 (Asia/Manila)
**Authorization:** User explicitly approved the StoreReview migration on local development only.

## Database change applied

- Target: **cpsu_marketplace**, MariaDB at **127.0.0.1:3306**.
- Applied **only** the additive DDL from `20261118160000_store_reviews/migration.sql`. The StoreReview table has six enforced constraints (PK, unique transaction, rating range CHECK, three foreign keys).
- Verified StoreReview initially held **zero records**.
- Registered the **single** migration in `_prisma_migrations` via `bunx prisma migrate resolve --applied 20261118160000_store_reviews` after verifying the table.
- `bunx prisma migrate status` still reports **20261117230000_private_student_identity** as pending and returns a nonzero status. That migration was NOT applied; do not use `migrate dev` or `migrate deploy` indiscriminately, because they may apply it.

## Prior mandatory backup and restore gate

- Created private ACL-restricted local backup; restored **all 28 existing tables** into a unique disposable MariaDB schema.
- Verified restored table content hashes and row counts against the source, then rechecked that the source did not change during rehearsal.
- Encrypted retained backup using Windows DPAPI **CurrentUser**, then verified decryption/hash and deleted temporary plaintext.
- Encrypted backup directory (on the authorized Windows PC only):
  `%LOCALAPPDATA%\\CPSU-Marketplace\\backups\\store-review-2026-11-18T07-47-33-336Z-d4ff5e5536f6\\`
- Files: `dev-backup.dpapi`, `manifest.json`. DPAPI backup recovery requires the same authorized Windows user profile/DPAPI keys; it is **not portable to another computer**.
- Disposable restore database removed successfully. No backup or student records were copied off the Windows PC.

## Post-activation verification

- `bun test` from API: **188 pass, 8 opt-in integration skips, 0 fail**.
- API TypeScript: **pass**.
- Review-specific synthetic authorization/moderation tests: **13 pass, 0 fail**.
- Web production build: **pass**.
- Web unit suite: **100 pass, 1 fail**, in unrelated `site-footer.test.tsx` expecting a `/register` link on signed-out footer. Not modified in this activation.
- Live local API `GET /api/v1/seller-profiles/1/reviews`: HTTP **200**, available=true, count=0, average=null (no invented ratings).
- Anonymous `GET /api/v1/admin/store-reviews` and `GET /api/v1/transactions/1/store-review`: **401**, protected as expected.
- Headless Chrome on `http://localhost:5173/stores/1`: rendered ratings/review content without application error boundary.
- Prisma client already includes `StoreReview` types and is functioning with live read queries. **An additional `prisma generate` attempt was blocked by Windows EPERM** because two existing Bun processes hold `query_engine-windows.dll.node` (active API and an iPhone LAN QA process). The processes were NOT stopped; this is a follow-up maintenance action, not evidence of failed activation.
- No full authenticated buyer-to-review-to-campus-moderation device E2E yet. Synthetic authorization tests and isolated MariaDB DDL tests pass.

## Change control

- Source data remained unchanged during backup and restore rehearsal.
- The **only approved development database change** was StoreReview DDL + its Prisma migration-history record; no user data insert, fabricated review, or other migration was performed.
- No hosting or production deployment; no git commit/push; no killing unrelated application or QA processes.
- Existing review API/UI and floating chat were preserved.

**Status:** Local development StoreReview **activated and publicly readable**, with authenticated write and moderation flows requiring real-account/physical-device acceptance before release. The unrelated footer test and locked Prisma generator remain separately tracked.
