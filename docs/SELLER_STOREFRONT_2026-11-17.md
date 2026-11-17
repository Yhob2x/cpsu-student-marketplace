# CPSU Market — Seller storefront implementation

> **Update, November 17, 2026:** The storefront remains valid, but the avatar-review step described below is superseded. Seller photos publish immediately after successful owner-upload and file processing. See `SELLER_AVATAR_AUTO_PUBLISH_2026-11-17.md`.
Date: November 17, 2026. Scope: Source-only implementation, no live migration.

## User request and source references
The user provided screenshots of a related-shops section and a dedicated shop homepage, and asked for specific seller stores with manually uploaded seller profile pictures. The design follows the *structure*, not the third-party branding or commerce features.

## Delivered
- One public store per existing approved seller profile: `/stores/:id` (no new store table or slug).
- Custom storefront identity header: seller-chosen profile photo after campus review (initials fallback), store name, campus affiliation, actual number of available published listings, store opening date, description, and a prominent browse button.
- Store catalog with local title/description/category search, All/Products/Services tabs, category dropdown, empty state, mobile-responsive grid, and owner-only `Edit my store` link.
- Store identity management on `/dashboard#store-profile` with existing explicit photo selection/submission and a new name/description editor.
- A scoped authenticated `PATCH /api/v1/seller/store` that validates name/description with Zod, restricts to the store owner, updates the record, and writes an audit record in the same transaction. No photo data can be injected via JSON.
- Sellers appear as clickable names on listing cards. When a search term is present, Explore shows up to three stores *represented in that page of results* with thumbnails linking to real listings. This section does not claim to search all stores.
- Public store response includes the seller's campus and creation date, derived from existing data. It continues to return only publicly available published listings; no private enrollment evidence is included.
- No automatic profile-picture upload, no invented ratings/followers/coupons, and no new payment or storage providers.

## Code
- New: `apps/web/src/pages-storefront.tsx`, `storefront.css`, `storefront-filter.ts`, `stores-in-results.tsx`, `stores-in-results.css`, `seller-store-details.tsx`, `seller-store-details.css`.
- Updated: `apps/web/src/pages-public.tsx`, `pages-account.tsx`, `my-store.css`, `seller-avatar.css`, `seller-avatar-editor.tsx`; `apps/api/src/routes/public.ts` and `seller.ts`.
- New tests: `apps/web/test/storefront-filter.test.ts`.
- Existing master blueprint updated with requested scope.

## Validation
- Web TypeScript and production Vite build passed.
- `bun test test/storefront-filter.test.ts`: 4 passed, 0 failed.
- Prisma schema `validate`: passed.
- API TypeScript check against a newly generated independent **temporary** Prisma Client: passed; the active client and databases were not changed.
- Git whitespace validation: passed, Windows line-ending advisory only.
- No authenticated browser or iPhone screenshots for this new storefront, and no end-to-end upload or approval acceptance.

## Activation gates
The profile-picture implementation from the previous change has a separate prepared additive migration (`20261117123000_seller_avatar_review`) that has **not** been applied. The current local API's Prisma client can also remain outdated while its Windows DLL is locked by a running process. Source builds do not mean seller avatars will work immediately. Obtain an isolated-backup-and-migration approval, run synthetic test acceptance, then explicitly authorize a development migration and Prisma Client regeneration. Do not apply to production by default.

No database migration, live student data update, seed, commit, push, deployment or firewall/configuration change was made for this request.
