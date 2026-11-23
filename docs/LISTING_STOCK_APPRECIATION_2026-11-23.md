# CPSU Marketplace — per-listing appreciation and physical-product stock

Status (2026-11-23): **ACTIVE in local development database `cpsu_marketplace`**. Still **not deployed to staging or production**; real authenticated student acceptance remains pending.

## Local development database activation — completed (2026-11-23)
- Two private MariaDB backups made outside the repository under the current Windows user's restricted ACL; the second was taken while the API was stopped. Do not commit or distribute these backups.
- Both full-data restore rehearsals passed: **31 tables matched source row counts**, with no raw student records logged. Each disposable restore schema was deleted; protected backup files were retained privately.
- Generated the new Prisma client after stopping the API. Applied **only** `20261123164500_listing_stock_and_appreciations/migration.sql` to `cpsu_marketplace` with `prisma db execute`, then verified data invariants and marked the migration applied with `prisma migrate resolve --applied`.
- On Windows MariaDB, information_schema reports table names in lowercase. An initial validation false alarm was corrected without rerunning the migration. Both target tables were present, and final validation passed.
- Read-only database verification: **15 physical-product inventory rows, 0 reserved, 0 missing, 0 service stock**, `ListingAppreciation` composite primary key `(userId, listingId)` present; historic store appreciation table preserved.
- Restarted the CPSU API on port 4000. Live public API returned 15/15 physical product stock quantities, per-product and batched appreciation availability, and denied unauthenticated appreciation writes (HTTP 401). The active local web proxy at `http://localhost:5173` also reported appreciation availability.
- API TypeScript check and 11 targeted stock/appreciation tests passed after migration.
- **Still pending, deliberately:** `20261117230000_private_student_identity` and `20261119150000_push_delivery_outbox` (separate privacy/authorization gates). Never run an unscoped `prisma migrate dev` or `prisma migrate deploy` to activate these unintentionally.
- **Still required before release:** real signed-in seller/buyer acceptance (like/unlike, inventory changes and competing purchases), separate PostgreSQL/MariaDB concurrency/transaction verification as applicable, reviewed integration, CI, and deployment approval.
- No deletion of existing development rows, no push, no merge and no deployment.

## Approved behavior implemented
- Appreciations belong to individual listings; one verified CPSU student account can appreciate each published listing once and can undo it. Cannot appreciate one's own listing or act as campus staff.
- Legacy `StoreAppreciation` rows are preserved. Store-level API/UI are retired; counts are never arbitrarily copied to listings.
- Batched per-listing appreciation state for public product cards (up to 50 per read). Cards show only a hollow thumbs-up before liking and a filled thumbs-up after liking, **no visible number**; the product detail page and seller's listing statistics retain per-listing counts.
- Physical products have seller-controlled integer available stock; services have no inventory rows. Public card and detail show available stock only when a true count can be read.
- Each accepted physical-product request reserves one unit atomically; cancellation releases it; completion consumes it. On one-off legacy rows, existing single-item reservation behavior remains available until schema/client activation.
- Stock-only edits do not reset moderation if title/description/type/condition/category are unchanged.
- Unavailable DB features show dash rather than fabricated zero, and writes fail closed.

## New code
- Prisma: `ListingInventory`, `ListingAppreciation`, additive migration `20261123164500_listing_stock_and_appreciations`
- API: `listing-appreciations.ts`, `listing-inventory.ts`, `listing-stock-transactions.ts`; seller, public and transaction route integration.
- UI: `listing-appreciation.tsx`, `listing-appreciation.css`, card, detail, storefront, My Store.
- Tests: dedicated API, UI, and browser fixtures.

## Activation history and outstanding release gates
1. Preserve all ongoing local edits; this checkout already has unrelated push, admin, message, and catalog work in progress.
2. Existing development migration ledger has three migrations not yet applied as of this audit: `20261117230000_private_student_identity`, `20261119150000_push_delivery_outbox`, `20261123164500_listing_stock_and_appreciations`. Do not blindly run `migrate deploy`: it applies pending earlier migrations.
3. Obtain separately authorized private backup and full restore acceptance for real dev records before touching the development schema. Isolated schema-only acceptance does NOT replace a private data restore rehearsal.
4. Review the migration order, original SQL checksums and privacy-related pending migrations. Do not mark an unapplied migration as applied.
5. Coordinate Prisma client generation and API restart; the current Windows DLL is in use by running Bun API processes. Never activate tables while the old generated client is still accepting stock-changing transactions.
6. Validate data backfill for legacy sold, manual reserved, and in-flight transaction reservations; verify all physical listings have exactly one stock record; verify no service inventory rows.
7. Re-run transaction concurrency and authenticated seller/buyer acceptance in the local development system after activation, including mobile PWA.
8. No remote push, merge or deployment until full CI and release gates pass.

## Completed evidence
- Isolated rehearsal: `cd apps/api && bun scripts/listing-stock-isolated-rehearsal.ts --isolated-rehearsal` passed on a newly created and deleted schema-only MariaDB clone. No private student records were copied. Verified initial stock, historical sold/manual reserve backfill, service isolation, independent listing appreciation, duplicate primary key rejection, atomic stock hold/release.
- API and web TypeScript checks passed in local development; Vite production build succeeded (existing large-chunk warning remains).
- API targeted tests: 17 passed (inventory activation, permissions, listing appreciation, stock transactions).
- Browser E2E (synthetic API): 4 passed across desktop and mobile Chrome for stock and per-listing appreciation, including appreciate/undo. Fixed a pointer-events bug caught by this test.
- Axe WCAG A/AA accessibility: 4 passed across Explore and Listing detail on desktop and mobile Chrome.
- Run again: `cd apps/web && bunx playwright test e2e/listing-stock-appreciation.pw.ts e2e/accessibility.pw.ts`.
- Live development API read-only smoke: homepage/marketplace listing and new appreciation summaries route returned HTTP 200 with feature unavailable until activation; no live DB writes.

## Read-only pre-activation snapshot (November 23, 2026; historical)
Command: `cd apps/api && bun scripts/listing-stock-activation-preflight.ts --audit-only`.

- **Gate BLOCKED**, deliberately: 3 prior/pending migrations have not been independently approved.
- 17 migration directories, 14 completed ledger entries; their checksums match the local files.
- 15 physical-product listings currently `available`. The additive migration would backfill 15 inventory rows with one available unit each.
- Zero legacy physical-product holds; zero detected active physical reservation mismatches.
- Two transactions exist and both concern **services**: one `for_meetup`, one `completed`.
- `ListingInventory`, `ListingAppreciation`, `StudentIdentity`, and `PushOutbox` tables all absent. No partial stock activation.
- Counts only were retrieved: no student IDs, names, messages or private identity values queried.
- The private-student-identity migration explicitly requires CPSU DPO retention approval; the push-outbox migration explicitly requires privacy and separate database authorization. Do not bypass those gates for stock activation.

## Real authenticated acceptance — still outstanding
Use real signed-in authorized CPSU test students only after separately approved activation; do not store passwords, tokens, sensitive identity evidence, or exported browser cookies in this repository.

1. Seller: create a physical product with stock 4; verify public Explore, homepage, storefront, and detail all show 4.
2. Buyer A: appreciate product A once (1); repeat appreciate (still 1); appreciate product B in the same store (B independently 1); withdraw A (A back to 0, B remains 1).
3. Seller account and university staff cannot appreciate seller's own listing; unsigned user follows the intended login path. Hidden/draft listings cannot be appreciated.
4. Buyer A and Buyer B: submit separate requests. Seller accepts both; available stock goes 4 → 3 → 2 and reserved stock 0 → 1 → 2. A third request must not oversell if stock reaches zero.
5. Buyer A cancels an accepted request; available +1 and reserved -1. Buyer B and seller complete their transaction; reserved -1 without returning the unit.
6. Seller edits available stock only: moderation state and published title remain unchanged. Seller cannot overwrite inventory while active reservations exist.
7. Confirm services never show stock, historical store appreciations remain stored but are not transferred to listings, and the mobile PWA works at 360px and 390px.
8. Independently verify production-build safety, real MariaDB transaction concurrency, action feedback, and accessibility. Do not merge or deploy based on synthetic-only testing.

## Product card polish and unavailable-appreciation UX
- Screenshot-driven card polish applies to Home, Explore, and storefront listing cards with the approved light-mode palette. The photo count sits in the lower-left of the image, away from the save icon. The card has a restrained border, consistent title clamping, aligned price/category/stock, and a campus footer. The redundant card arrow and generic `per item` price suffix were retired.
- A hollow thumbs-up remains icon-only on cards; filled state is shown after a successful like. Counts stay on listing detail and seller management. Card actions have separate accessible names.
- If the server reports an unactivated appreciation table, the like control is visibly disabled with the tooltip `Likes temporarily unavailable`. It no longer opens a misleading success or repetitive `Appreciation unavailable` toast; it never fabricates a count or writes local-only likes.
- Browser E2E was moved to an isolated port via `CPSU_E2E_PORT=5191` because another process ran a **preview** at the historical default port 5189. Desktop/mobile card layout and like/undo tests on fresh source passed (6/6); axe WCAG Home/Explore/detail/storefront tests passed (8/8). Web production build passed with an existing bundle-size warning.
- Per-listing appreciation is **active in the local development database** after the targeted migration and Prisma client regeneration. Other pending privacy/push migrations remain unapproved: **do not run generic `prisma migrate dev` or `prisma migrate deploy`** until those have separate authorization.

## Safety notes
- `stockQuantity` represents units not currently held; `reservedQuantity` represents accepted-but-unclosed physical requests.
- A stock record missing after migration must fail closed; do not silently fall back to one-off behavior once inventory is active.
- Preserving prior one-off sold semantics remains intentional pending a separate replenishment/relist policy. Do not reset historical sold listings automatically.
