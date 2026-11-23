# CPSU Market — per-listing view counts and appreciation-led Popular listings
Date: 2026-11-23. Status: implemented and activated only in local development.

## Product behavior
- A shared listing card in Home, Explore and storefront shows compact, accessible thumbs-up and eye numbers for **that listing**. Detail view shows both as well. Save/favorite remains a separate personal action, but its count is not shown or considered in popularity.
- Thumbs-up remains an authenticated, individually reversible appreciation. Listing view counts represent detail-page opens, not impressions from scrolling cards. Counts may begin at zero because no historic views were collected.
- Views are deduplicated by browser token, listing and UTC day. Repeated opens in the same browser/day do not increment. A different listing gets an independent view. An authenticated seller viewing their own product and authenticated staff are not counted.
- Browser token is a random 24-byte value in a secure-when-configured, HttpOnly, SameSite=Lax, one-day cookie scoped to the listings API. Only a server-HMAC digest per listing per UTC day is saved for deduplication, with opportunistic two-day cleanup. No IP address, student ID, user agent, raw cookie token or cross-listing browsing history is stored by this feature. Browser cookie clearing or automated traffic may still affect totals, so counts are indicators, not verified unique humans.
- When the view migration is not activated, the UI displays an em dash rather than inventing a zero.

## Algorithm
At request time, the server ranks **all** eligible published/available, non-deleted listings from approved, active verified-student stores before selecting the top eight. Saves, store followers and store-level metrics are excluded.

`score = (4 * listingAppreciations + log2(1 + listingDetailViews)) / (1 + listingAgeHours / 720)`.

Appreciation carries the stronger signal. The logarithmic view signal means raw page traffic cannot overwhelm genuine support linearly. Thirty days halves an otherwise identical score. Exclude zero-engagement listings; order ties by appreciation total, views, newest listing and stable listing ID. If view storage is missing, rank strictly by existing per-listing appreciations; do not fall back to saves. If appreciation storage is missing too, report unavailable rather than fabricate a leaderboard. A confirmed appreciation/withdrawal refreshes the mounted homepage Popular rail.

## Storage & activation
- Migration: `apps/api/prisma/migrations/20261123190000_listing_views/migration.sql`.
- Two additive MariaDB tables: `ListingViewCounter` (aggregate per listing) and `ListingViewDedup` (HMAC digest per listing/day for recent deduplication).
- Activation executed **only** on local `cpsu_marketplace` after a new private backup and isolated full-schema restore rehearsal. Private backup stays outside Git with restricted Windows ACL. 33 source tables matched the restored table row counts. Scratch migration, dedup uniqueness and FK checks passed, and disposable schema was deleted.
- Applied only the named migration via `prisma db execute --file`, performed read-only validation, and marked that exact migration applied. No historical view counters were backfilled (both new tables initially had zero rows).
- Other migrations **still pending and not touched**: `20261117230000_private_student_identity`, `20261119150000_push_delivery_outbox`. Never run unscoped `prisma migrate dev` or `migrate deploy` to activate them unintentionally.

## Implementation files
- API: `src/listing-views.ts`, `src/popular-listing-ranking.ts`, `src/app.ts`, `src/routes/public.ts`.
- Web: `src/pages-public.tsx`, `src/listing-views.tsx`, `src/listing-views.css`, `src/icons.tsx`.
- Prisma schema and the scoped migration.
- Targeted API tests, web component tests and browser E2E fixtures/tests.
- Controlled backup and verification scripts: `scripts/listing-views-private-restore-rehearsal.ts`, `scripts/listing-views-verify-activation.ts`.

## Verification results
- Local GET `/api/v1/listing-views?ids=23,20` returned `available:true` for both with actual count zero after activation.
- Local GET `/api/v1/listings/popular` returned `ranking:appreciations_and_views`.
- API targeted tests: 15/15 pass; API TypeScript and Prisma validation passed.
- Web unit/component tests: 6/6 pass; web TypeScript and production Vite build passed (pre-existing large-bundle warning).
- Playwright product/detail and responsive checks: 10/10 pass across desktop and 390px mobile Chrome.
- Automated axe WCAG scans: 18/18 pass across desktop/mobile.
- No push, merge, production or staging deployment. Real authenticated student end-to-end acceptance, broader CI and production privacy/release reviews remain required.
