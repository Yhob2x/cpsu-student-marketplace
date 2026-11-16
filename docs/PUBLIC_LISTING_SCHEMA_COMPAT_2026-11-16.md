# Public listing reads during the WP3 migration gate

The development API returned `500 internal_error` for Home listing requests while the WP3 migration remained pending. Prisma's default `Listing` selection requested the new `reservationTransactionId` column, which the current development database does not yet have. `GET /api/v1/categories` remained healthy.

The public listing routes now select only the fields needed for their responses and visibility checks. This covers listing discovery, popular listings, listing detail, and published listings within seller profiles. It preserves the response contract without changing the database or activating WP3 transactions.

Verification on the local development API: the three Home listing requests failed with HTTP 500 before the change and returned HTTP 200 afterward; listing detail also returned HTTP 200. API TypeScript check passed. `bun test` passed outside the restricted sandbox: 41 passed, 3 opt-in integration tests skipped, 0 failed. The sandboxed attempt returned `EPERM` before running tests.

The WP3, managed-content, and announcement migrations remain pending on the development database. Transaction and administrative content routes still require their separately approved migrations. The normal Gate B approval and fresh backup requirements remain in force.

## Conversation follow-up

The conversation page later showed “Conversation unavailable.” A read-only Prisma probe confirmed `P2022` for `cpsu_marketplace.Listing.reservationTransactionId` in the thread-detail query. The inquiry routes now select only the Listing fields used to open a conversation and render its participant-authorized detail. Authorization checks and message receipts are unchanged.

The original read-only query failed with `P2022`; the revised selections succeeded on the unmigrated development schema using nonexistent IDs, without reading private conversations. The isolated HTTP integration suite passed 36/36 tests with 348 expectations and a clean integrity audit. API TypeScript also passed. No development database schema or student records were changed by this fix.
