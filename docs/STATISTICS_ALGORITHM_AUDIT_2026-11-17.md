# CPSU Market — Data & statistics algorithm audit

**Date:** 2026-11-17 (Asia/Manila)  
**Scope:** Authorized local development copy only, `127.0.0.1/cpsu_marketplace`.  
**Method:** Source inspection + strictly read-only Prisma/database recalculation + synthetic unit tests. No production assertion. No sensitive user details, IDs, passwords or private notification payloads are published in this report.

## 1. Snapshot: actual database aggregates

| Metric | Local read-only result | Interpretation |
| --- | ---: | --- |
| All listings | 29 | Includes drafts, unavailable and unapproved statuses. |
| Publicly discoverable listings | 25 | Published + available + not deleted + approved store + active owner. |
| Approved stores / active approved stores | 3 / 3 | Currently equal; future suspension must change active totals. |
| Persisted follows | 1 | Actual StoreFollow rows, not fabricated popularity. |
| Persisted saves | 1 | Actual SavedListing rows. |
| Notifications / unread | 111 / 1 | Total historic notification rows vs current unread rows. |
| Unread message notifications | 1 | The count is unread notification rows with inquiry types, not chat-message rows. |
| Transactions | 1 | Its status is `for_meetup`, NOT a completed sale. |
| Home fresh-query rows | 24 | API limit 24, homepage displays first 8. |
| Most-followed eligible stores | 1 | Up to 4; one currently meets the follower + available catalog conditions. |
| Popular eligible listings | 1 | Up to 8; requires at least one actual save. |

By active campus, public listing counts are MAIN 4 (services 2), CAUAYAN 21 (services 8); HINOBAAN, ILOG, SIPALAY and CANDONI all 0. Total: 25 visible listings, 10 available services. Each campus had zero pending-review listings at the time of the check.

No saved rows from suspended users, no follow rows from suspended users, and no staff-follow relationships were found at the time of this check.

## 2. Algorithm correctness and independent parity

| Area | Finding |
| --- | --- |
| Most Followed Stores | **PASS.** Compared the actual endpoint ranking logic with independently grouped persisted StoreFollow totals. Order, totals and per-store eligible listing counts agree. Stable ties use ascending store ID. |
| Public store listing count | **PASS.** Checked 3 active approved stores: nested visible-listing totals matched independent per-store counts. |
| Popular Listings | **PASS in current dataset.** Ordered by saved-listing relationship count; 1 eligible listing, correct descending sort. Code lacked a deterministic tie-break, now corrected. |
| Fresh Listings | **PASS.** Compared all 24 IDs with independent newest-approval recalculation. Order matched. No listing had multiple approvals in this snapshot. |
| Admin storefront, published listing and service counts | **PASS in current dataset; corrected latent bug.** Previously the analytics counted owners who might later be suspended and published listings from ineligible stores. Fixed to use active approved stores / public discovery visibility. |
| Admin small-count privacy | **Corrected.** Pending-review analytics previously leaked exact 1–4 counts despite claiming all small figures were suppressed. All displayed analytics now use the same suppression helper. The authorized review queue itself retains exact operational details. |
| Unread alert count | **PASS in current dataset.** Unread totals follow unread Notification rows and the message badge follows inquiry notification types; current unread total is 1. |
| Transactions | **PASS for status semantics.** One `for_meetup` transaction; it must not be presented as a sale. Inquiries are historical conversation threads, not successful trades. |
| Explore listings total | **Code inspected.** Uses the same filtered `where` predicate for `listing.count` and paginated items, with stable sorting. No separate live HTTP browser acceptance performed. |

## 3. Repairs made (source-only, safe and additive)

1. `apps/api/src/routes/public.ts`: Popular Listings now sorts by descending save count, **then descending listing ID** for equal counts. `apps/api/src/popular-listing-ranking.ts` contains the reusable definition; regression test added.
2. `apps/api/src/routes/admin.ts`: Active storefronts count approved stores with active owners. Published listings and services now exclude inactive or unapproved sellers, matching what actual users can browse.
3. `apps/api/src/routes/admin.ts` + `apps/api/src/analytics-privacy.ts`: All campus analytics counts, including pending review, consistently suppress counts from 1 to 4 as `<5`; exact zero stays 0. Regression test added.
4. `apps/api/scripts/audit-statistics-readonly.ts`: Repeatable guard-railed aggregate audit (refuses nonlocal or unexpected databases), checks store rank parity, store counts, fresh order, popular order, student privacy flags and admin metrics.

## 4. Known definitions and remaining risks

- **Popularity is saves, not sales, views or ratings.** The current API name `popular` is correct only when students understand the definition. No invented views or purchases should be shown.
- **Fresh means latest approval, not necessarily first publication.** Editing and reapproving an existing listing can resurface it. This matches the current documented design; changing it requires a product decision.
- **Follower count is total persisted follows.** If a follower is subsequently suspended or assigned a staff role, the persisted relationship still contributes to both storefront and leaderboard totals. There are **zero such rows currently**, so there is no present numeric discrepancy. Decide whether to count only currently eligible users before changing that business definition.
- **Notification seen-endpoint pagination:** `POST /inquiries/:id/seen` considers at most the 200 latest unread message-notification rows. With >200 unread, the oldest may remain flagged after viewing. **No current account has >200 unread inquiry notices**; load testing and a paginated correction are advisable.
- **Homepage rank freshness:** The home page fetches the ranking on mount/retry, not as a server-pushed live subscription. Counts can become stale while an already-open home tab remains open.
- **No completed sales can be inferred** from message count, inquiry threads or the one `for_meetup` transaction.

## 5. Validation and limits

- Prisma read-only source audit: **PASS** with exact recalculation of 24 Fresh IDs, 1 most-followed store, 3 storefront catalogs, and campus totals.
- Backend TypeScript typecheck: **PASS**. Targeted synthetic backend tests: **11 passed, 0 failed** (privacy suppression, stable popular ranking, fresh ordering, store following and most-followed ranking).
- Website TypeScript + Vite build: **PASS**. Complete web unit suite: **73 passed, 0 failed**. Git whitespace check: **PASS**. Project code graph refreshed.
- Production database, deployed API, real-time browser rendering, multiple concurrent follow/unfollow clients and physical devices were **not** verified. Prior local HTTP request to `/api/v1/stores/most-followed` returned HTTP 429 (rate limited); direct read-only database verification succeeded.
- A sequence of read-only queries does not provide a single point-in-time repeatable-read snapshot under concurrent writes; the local results showed no observed disagreement.
- No database migration, seed, data repair, authentication change, external service, Git commit, push or deployment was performed. Existing uncommitted source edits in other files were preserved.
