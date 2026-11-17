# CPSU Market — Seller profile picture implementation

> **Historical record — superseded on November 17, 2026.** The owner changed the requirement to immediate public photo publication, with no reviewer step. See `SELLER_AVATAR_AUTO_PUBLISH_2026-11-17.md` for the current workflow. The pending-review design below is retained only as historical implementation notes.

**Date:** November 17, 2026 (Asia/Manila)
**Scope:** Add optional photo identity to student seller stores, protect unreviewed images, preserve existing listing-media policy.

## Feature design
- My store shows an independently uploadable seller profile picture, with local preview, pending-review indicator, refresh, withdraw, and remove-current buttons.
- Accept one still JPEG/PNG/WebP (3 MB maximum, decode limited to 24 MP); reencode to a square 512x512 WebP without EXIF/location metadata. Existing listing-image limits remain 5.
- Store pending and approved images separately. A new upload cannot replace the public photo automatically; only approved content appears in marketplace listing cards, listing details, and the public storefront. When no photo is approved, display initials.
- An authorized campus reviewer (or global university administrator) sees the new Profile photos queue. Approval requires successful image load, human inspection confirmation, and a recorded reason; rejection requires a reason. Other campuses cannot access pending images or make decisions.
- Public avatar endpoint is **/api/v1/media/seller-avatar/:id**. Owner/reviewer-only pending image endpoint is **/api/v1/media/seller-avatar/:id/pending**; both use private no-store responses and the existing media-scoped session cookie. Private Google Drive file identifiers and server storage paths are never included in public JSON.
- Upload, withdraw, approval/rejection, and removal actions use transactions with audit metadata. Replaced or rejected media are deleted after the successful DB transaction on a best-effort basis; cleanup errors are logged. Approval/rejection attempts to notify the seller via the existing in-app notification infrastructure.

## Files changed
- `apps/api/prisma/schema.prisma`: additive `SellerProfile.avatarPath` and `SellerProfile.pendingAvatarPath`.
- `apps/api/prisma/migrations/20261117123000_seller_avatar_review/migration.sql`: migration **prepared, not run**.
- `apps/api/src/routes/seller.ts`: owner-only upload, private status, withdraw, remove.
- `apps/api/src/routes/public.ts`: public projection and permission-gated avatar bytes.
- `apps/api/src/routes/admin.ts`: campus-scoped pending photo review/decision.
- `apps/api/src/upload-security.ts`: optional square sanitization for avatars.
- `apps/web/src/seller-avatar.tsx`, `seller-avatar.css`, `seller-avatar-editor.tsx`, `seller-avatar-editor.css`: reusable fallback, upload preview and actions.
- `apps/web/src/pages-account.tsx`, `pages-public.tsx`, `pages-admin.tsx`, `admin-workspace.css`, `main.tsx`: UI integration, reviewer queue and nav badge.
- `apps/api/test/upload-security.test.ts`: isolated synthetic WebP EXIF and crop acceptance.
- `MASTER_BLUEPRINT.md`: approved change record.

## Validation (without user data)
- `apps/web: bun run build` — passed.
- `apps/api: bunx prisma validate` — passed.
- `apps/api: bun test test/upload-security.test.ts test/photo-review.test.ts` — 9 passed, 0 failed.
- API compile using an independent **temporary** generated Prisma Client matching the changed schema — passed. Temporary client and tsconfig removed after use. The active `node_modules/.prisma/client` was not replaced.
- `git diff --check` on touched tracked source files — passed; only Windows line-ending notices.
- Standard `bunx prisma generate` using the live workspace client is **blocked** by Windows `EPERM` on `query_engine-windows.dll.node` while the database client is in use. Do not terminate other processes without approval.
- **Not run:** database migration, production API smoke, reviewer-authenticated browser checks, actual upload/storage/approve/reject acceptance, physical-phone acceptance.

## Activation gates (not authorized by this source-only change)
1. Inspect current development DB migration history, backup MySQL, record a checksum, and confirm the target schema is not a production/staging database.
2. Approve and execute the migration on a dedicated restored **test database** first; run isolated API acceptance that tests permission separation, content review, denied media fetches and cleanup. Coordinate with any other agent changing migrations.
3. Only after test acceptance and explicit approval, apply the additive migration to the development DB. Regenerate Prisma Client **after stopping only the approved local API process** so Windows can release the native DLL; restart API.
4. As an authorized seller, upload a synthetic photo from /dashboard. Check it is private while pending. As an authorized campus reviewer, inspect and decide in /admin → Profile photos. Check public store/listing avatar updates, wrong-campus/guest denial, and remove/withdraw.
5. Do not publish, commit or push without explicit authorization.

## Follow-ups
- API review queue currently loads first 100 pending avatar records; consider pagination if adoption reaches that limit.
- Browser checks on mobile and desktop, keyboard/screen reader acceptance and real iPhone Safari acceptance remain pending.
