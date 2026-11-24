# CPSU Market — Store profile-picture replacement visibility fix

**Date:** November 17, 2026 (Asia/Manila)
**Scope:** Existing seller avatar replacement; no database migration or user-data writes.

## Reported symptom
Seller uploaded a replacement picture, but the previous store avatar continued showing.

## Investigation
A read-only, aggregate-only check of local development `cpsu_marketplace` showed:
- Seller profile records with avatar: **1** (active/approved).
- Seller avatar-published audit events: **2**.
- The stored image uses the already configured **Google Drive** storage adapter.
- Both public and owner APIs previously reused the same image URL (`/api/v1/media/seller-avatar/:id`) on every replacement, allowing browser image reuse when React sees the unchanged `src`.

A read-only localhost API probe after the fix confirmed:
- Public avatar GET returns **HTTP 200**, `image/webp` (5326 bytes), `Cache-Control: private, no-store`.
- Public store JSON returns the expected versioned image URL (without exposing the Drive ID).

## Fix
- Added `apps/api/src/seller-avatar-url.ts`, which derives a short SHA-256 URL version token from the private storage reference and returns `/api/v1/media/seller-avatar/:id?v=<version>` without exposing the reference.
- Both public listing/store JSON and the seller's private store GET/upload response now use this URL builder.
- Removed the redundant client-side `?v` appending from `apps/web/src/seller-avatar-editor.tsx`, avoiding malformed nested query parameters.
- Version changes whenever a different stored file is successfully uploaded. The photo URL is unchanged for repeated reads of the same stored file. Public media-access rules and `no-store` responses remain unchanged.

## Tests
- `bun test test/seller-avatar-url.test.ts test/seller-avatar-update.test.ts` — **8 PASS, 0 FAIL**.
- `bunx tsc -p . --noEmit` in apps/api — PASS.
- `bun run build` in apps/web — PASS.
- `git diff --check` on touched tracked sources — PASS, Windows LF/CRLF advisory.
- Read-only HTTP public avatar and seller-profile probe — PASS.

## Limits
No additional picture was uploaded by this diagnostic, and no real seller data was changed. The buyer's exact browser state/cache was not inspected, so this resolves the identified stale URL source but does not prove every previously cached tab will update without refresh. The user should reload My Store and then View public store or reopen their store page. No user account or password was accessed, no migration/deployment/commit/push occurred.
