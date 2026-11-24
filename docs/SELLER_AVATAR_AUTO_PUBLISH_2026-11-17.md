# CPSU Market — Seller profile photo instant publication
Date: November 17, 2026 (Asia/Manila)
Status: **source implemented; seller-avatar column applied to local development on November 17, 2026; authenticated browser acceptance still pending**

## Owner decision
The owner explicitly removed the reviewer approval step **for seller/store profile pictures only**. Store identity photos are manually selected and uploaded by the seller; they are not automatically harvested from student accounts or listing images. A successful authorized upload publishes the sanitized image immediately on the store and seller listing identities. Existing campus affiliation verification, seller eligibility, and product/listing-photo review continue unchanged.

## Seller experience
- From **/dashboard#store-profile**, seller chooses a single JPEG/PNG/WebP image (max 3 MB), sees a local preview, and presses **Upload profile picture**.
- The API validates that the caller owns an approved store, verifies the actual file format and pixel count, strips source EXIF/GPS metadata, converts it to a square 512 × 512 WebP, and stores it via the existing configured private media adapter.
- The image is committed directly to `SellerProfile.avatarPath` and becomes public immediately on a successful HTTP 200 response.
- UI confirms success and refreshes the image URL; replacement keeps the previous photo until the new image and audit record commit, then attempts to delete the old photo. The seller can also remove the image and return to initials.
- A guest or buyer sees the photo only while the seller account/store are approved and active. No private storage path or Google Drive ID is sent to public clients.
- **This does not perform automated explicit-content or abuse detection.** User reporting and marketplace rules remain available if a prohibited photo is published.

## Removed review dependencies
- Pending-avatar state, deletion endpoint, pending image endpoint, reviewer moderation endpoint/queue, UI controls, review navigation/badges.
- The original `pendingAvatarPath` database column was removed from the **unapplied** prepared migration and schema.
- No new third-party APIs, payment flows or storage vendors were introduced.

## Key code paths
- `apps/api/src/seller-avatar-update.ts` — owner-only conditional write, transactionally audited public replacement.
- `apps/api/src/routes/seller.ts` — sanitized upload, immediate public HTTP response, cleanup/rollback, photo removal.
- `apps/api/src/routes/public.ts` — only active public avatar media endpoint.
- `apps/api/src/routes/admin.ts`, `apps/web/src/pages-admin.tsx`, `apps/web/src/main.tsx` — reviewer queue removal.
- `apps/web/src/seller-avatar-editor.tsx` — upload/replace/remove, success feedback, no pending state.
- `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/20261117123000_seller_avatar_review/migration.sql` — one additive nullable avatar column. Migration folder retains its historical name despite no review requirement.
- `apps/api/test/seller-avatar-update.test.ts` — synthetic owner, replacement, concurrency and audit-rollback tests.
- `apps/api/test/iphone-safari-qa-fixture.ts` — isolated QA schema preflight expects only `avatarPath`.
- `MASTER_BLUEPRINT.md` — original review requirement retained as a clearly superseded historical entry; current owner decision recorded below it.

## Verification
- Web TypeScript + production Vite build — PASS.
- API TypeScript with a separate temporary generated Prisma Client — PASS; no running client overwritten.
- Prisma schema validation — PASS.
- Focused image sanitation, photo review (listings) and avatar database-contract tests — 14 PASS, 0 FAIL.
- Ordinary API suite — 110 PASS, 7 guarded integration tests SKIPPED, 0 FAIL (no database access).
- `git diff --check` on changed tracked source files — PASS; Windows line-ending advisory only.
- The migration was confirmed **unapplied** in local `cpsu_marketplace` using read-only Prisma migration status.
- No authorized MySQL migration, live uploaded-image HTTP smoke, authenticated browser/physical iPhone acceptance, deployment, commit or push.

## Migration safety preflight — November 17, 2026
The exact one-column SQL passed a disposable temporary-table rehearsal in `cpsu_marketplace_test`. Read-only checks confirmed `avatarPath` is absent in development and both test schemas. No persistent migration was executed. A fresh protected, restorable backup and explicit approvals are still required. See `docs/SELLER_AVATAR_MIGRATION_PREFLIGHT_2026-11-17.md` for evidence and safeguards.

## Development migration activation — November 17, 2026
**Approved and completed:** the one-column seller-avatar migration was applied only to local `cpsu_marketplace`, with fresh protected backup, isolated restore rehearsal, Prisma ledger reconciliation, 24-table data integrity comparisons, and 14 targeted test passes. Both older managed-content migrations remain pending. See `docs/SELLER_AVATAR_DEV_ACTIVATION_2026-11-17.md` for details. Authenticated multipart browser acceptance remains open; do not deploy automatically.

## Superseded activation-gate record
The existing local development DB has additional earlier unapplied migrations, so do not blindly run `prisma migrate dev` or `db:deploy`. Reconcile the migration history, back up the database, and test the single-column migration and full upload/replacement/removal flow on an isolated restored database first. Explicitly authorize local development DB changes before applying, regenerate the standard Prisma Client after safely releasing its Windows DLL, and verify image rendering as a seller and guest. Do not deploy to production by default.
