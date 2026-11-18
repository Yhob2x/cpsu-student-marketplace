# CPSU Market — Seller follower list (owner-only)
**Date:** 18 November 2026, Philippines
**Environment:** Authorized local development code, no deployment.

## What was added
- **My Store** now includes **Your followers** beneath CPSU affiliation and above New listing.
- A follower count and the two most recent follower display names/dates are shown by default.
- **Show more followers** expands to six results per page; **Previous/Next** page through the full list; **Refresh** fetches changes.
- Responsive styling at 320, 390, 768 and 1280 CSS px. It preserves the existing floating Messages box and other seller tools.

## Access and privacy
- New owner-only authenticated GET endpoint: `/api/v1/store-follows/mine?page=1`.
- Finds the seller profile using the **current authenticated account's user ID**; accepts no target seller/store ID from the client.
- Returns only `{ total, page, pageSize, items: [{ displayName, followedAt }] }`.
- Prisma uses strict `select` for display name and follow date. It never returns email addresses, private legal names, student ID numbers, campus verification records or follower account IDs.
- An account without ownership cannot see the list; signed-out users receive 401, staff 403 and other students 404. Public storefronts continue to expose only aggregate follower counts.
- Cache-Control: `private, no-store`, bounded pages, 6 records per request; missing feature schema/client yields a meaningful 503 rather than incorrectly showing zero followers.
- No follower notification or messaging permission was added.

## Code
- `apps/api/src/store-follows.ts` — private GET route, strict select, pagination and owner authorization.
- `apps/web/src/pages-account.tsx` — owner-only card under My Store.
- New `apps/web/src/store-followers.tsx` and `store-followers.css` — responsive list, states, pagination, refresh, empty/retry.
- New `apps/api/test/store-followers-private.test.ts` — mock authorization, privacy, pagination and missing-table tests.

## Acceptance
- API targeted follow tests: **9 passed / 0 failed** across existing and new tests.
- API TypeScript check: **passed**.
- Frontend TypeScript + Vite build: **passed**.
- Frontend unit tests: **77 passed / 0 failed**.
- Synthetic browser session and intercepted data verified the My Store follower card at **320/390/768/1280px**, no document-wide overflow, no email exposure in rendered card, two-item preview, expanded results, pagination and refresh. Synthetic names were for QA only; no real user records or follower data were read or changed.
- Evidence screenshots: `.tmp/store-followers-390.png` and `.tmp/store-followers-1280.png`.
- **Not yet done:** real-account end-to-end acceptance with existing followers in an authorized isolated environment; physical iPhone Safari/Android Chrome accessibility and safe-area checks; deployment or API restart.

**Change control:** No database migrations, credentials, live user records, commits, pushes, or deployments were modified. Other in-progress local changes were left untouched.
