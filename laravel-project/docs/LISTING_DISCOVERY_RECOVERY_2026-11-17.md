# CPSU Market — Discovery API P0 and Recovery UI (November 17, 2026)

## Scope and change controls

Owner requested: fix the live product-listing HTTP 500 blocker, improve Explore's listing-error recovery, and preserve the intended seller dashboard through sign-in. Follow `AGENTS.md`, `MASTER_BLUEPRINT.md`, and the approval-gated database policies. This work is source-only, with read-only database diagnostics and public HTTP checks. No development or production database migration, seed, data edit, software installation, push, deployment, or account login was authorized or performed.

### P0 root cause, confirmed

The running Prisma Client had an optional `SellerProfile.avatarPath` selection, but the local `cpsu_marketplace` database did not contain that column. A read-only Prisma query with the field raised `P2022` (`SellerProfile.avatarPath` missing). The same query without the avatar field succeeded.

Read-only inspection confirmed `20261116193000_wp3_transactions` is already applied in this local development database, while the newer seller-avatar migration is not. No assumption was made about production state.

### P0 implementation

- New `apps/api/src/optional-seller-avatar.ts` checks `INFORMATION_SCHEMA.COLUMNS` for this single optional column, reads only, and caches the result for the current API process. Transient SQL errors are not silently interpreted as a missing column. Restart the API after a *separately authorized* schema migration.
- `apps/api/src/routes/public.ts`: selection of the avatar column is conditional in public listing collections, Fresh/Popular feeds, individual listings, and seller storefronts.
- The seller-store query uses an explicit scalar projection, preventing Prisma's implicit selection of all model fields before the avatar migration is approved.
- Public listing media is fetched with a narrow seller relation projection instead of selecting the entire SellerProfile row.
- The optional avatar media route returns `404` when its storage column is not installed, rather than failing with `500`.
- Existing publication, seller approval, account suspension, privacy, and owner/reviewer scope checks were preserved.
- When the avatar column is absent, the existing seller initials fallback is used. When present, the avatar URL behavior is preserved and tested at the selector level.

### P1 — Explore recovery

- `apps/web/src/pages-public.tsx`: list-fetch failures show plain-language guidance in a labelled alert panel, not raw `internal_error`.
- A real `Retry listings` button reissues the *same* URL/filter query without navigating away or clearing filters.
- A 429 rate-limit error gives a wait message rather than encouraging rapid repeated requests.
- Stale asynchronous responses remain ignored using the existing effect cleanup.
- Empty results remain separate from network/API errors.

### P2 — Sell sign-in return

- `apps/web/src/auth-return.ts`: adds only the literal `/dashboard` path to the same-origin, exact-match allowlist; malformed, external, and query-bearing variants remain rejected.
- `apps/web/src/main.tsx`: unauthenticated access to `/dashboard` redirects to `/login?next=%2Fdashboard`, and waits for session restoration first to avoid an unnecessary initial dashboard fetch.
- Existing Login/Register already consume `safeLoginReturn`, so successful student sign-in returns to the dashboard. Staff users are still redirected away from student selling actions by their existing role guard.

## Verification

- Read-only local SQL confirms missing `avatarPath` and existing published listings; no student details or secrets included in this report.
- Real API checks: `/api/v1/listings?type=service&pageSize=8` returned HTTP 200 with eight results; `/api/v1/listings/fresh` returned HTTP 200 with 23 results; `/api/v1/listings/popular` returned HTTP 200.
- Playwright synthetic fault/repair acceptance (all HTTP mock responses local to its browser session): HTTP 500 showed a plain-language alert and Retry button; clicking Retry recovered to a listing on attempt 2, with the original URL unchanged and no technical `internal_error`. Synthetic sign-in followed `/dashboard -> /login?next=%2Fdashboard -> /dashboard`; no real credentials or writes.
- Playwright **real published public data** at 390 CSS pixels: nine homepage cards, 20 Explore cards, one real five-photo listing, Next changed `1 / 5` to `2 / 5`, zoom and Escape-to-close passed, the seller storefront loaded, media responses comprised 23 HTTP 200 and 3 HTTP 304. No document-level horizontal overflow.
- Targeted Bun API and web tests, TypeScript checks, production frontend build and Git diff checks are run after implementation; see terminal QA results for final counts.
- No physical iPhone Safari/Android Chrome gestures, VoiceOver/TalkBack, or actual authenticated student workflow was tested. Those remain acceptance gates.

## Files changed in scope

- `apps/api/src/optional-seller-avatar.ts` (new)
- `apps/api/src/routes/public.ts` (narrow compatibility/selection changes)
- `apps/api/test/public-avatar-compat.test.ts` (new pure regression test)
- `apps/web/src/pages-public.tsx` (Explore error/retry)
- `apps/web/src/auth-return.ts`, `apps/web/src/main.tsx` (dashboard login return)
- `apps/web/test/auth-return.test.ts` (allowlist regression assertions)
- This implementation report.

Pre-existing uncommitted edits, especially seller-avatar and transaction migrations, were preserved. P3 mobile-footer shortening and React Router future compatibility warnings were not included in this approved priority package.

## Release cautions

- The seller-avatar migration is still approval gated; do not run it just to show avatars.
- Seller-management routes tied to new optional avatar fields may remain migration-gated; this package restores **public discovery** without claiming the entire schema-dependent seller workspace is release-ready.
- Local development P0 resolution does not establish production-readiness, and the approved physical phone acceptance checks are still pending.
