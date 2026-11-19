# Store appreciation and review continuation — November 19, 2026

## Implemented in code

- Public student storefronts have an Appreciate / Appreciated action with a real unique-user count, an undo action, and explicit success/error feedback. Owners see only their store's count.
- Appreciate is not Follow, a purchase, a rating, or a CPSU endorsement. One appreciation is stored per verified CPSU student per store. The owner cannot appreciate their own store. Staff and guests cannot write.
- Public counts never expose student names, identity documents, or other personal information. Hidden stores do not expose counts.
- Public ratings display the distribution of moderated 1–5-star reviews. Reviews remain linked to completed transactions and require a current verified student affiliation to submit. Existing ratings are moderated before publication.
- Review moderation has a confirmation before hiding published reviews, action-feedback confirmations, and request-order protection for slow page changes.
- Review eligibility and buyer UI now agree on the student-affiliation requirement.

## API

- `GET /api/v1/seller-profiles/:id/appreciations` — public count and signed-in viewer state for a visible store
- `PUT /api/v1/store-appreciations/:id` — idempotent student appreciation, verified affiliation required
- `DELETE /api/v1/store-appreciations/:id` — idempotent removal
- Existing store-review endpoints continue to enforce completed-transaction eligibility and campus-scoped moderation

## Database activation — approved local development only

- **Activated on November 19, 2026:** `20261119093000_store_appreciations`, individually on local `127.0.0.1:3306/cpsu_marketplace` after explicit owner approval. Prisma migration metadata records this exact migration as applied.
- Backup: protected private, Windows CurrentUser DPAPI-encrypted dump under `%LOCALAPPDATA%/CPSU-Marketplace/backups/store-appreciation-2026-11-19T02-18-38-209Z-c68c52/`. Verified the decrypted backup hash and restored row digests in a unique disposable database; the scratch database was removed. No plaintext dump retained.
- Isolated rehearsal passed: additive `StoreAppreciation` table, composite key, restrictive foreign keys, index, test appreciation/duplicate rejection/removal, and no original-row changes. The source was verified unchanged before activation.
- The local API was briefly stopped to unlock `query_engine-windows.dll.node`. Prisma Client v6.1.0 was regenerated, then the API restarted on port 4000.
- The new table started empty; the public endpoint now returns `available: true, count: 0` for a visible store. An unauthenticated write was rejected (HTTP 401) without database mutation.
- **Still pending and not activated:** `20261117230000_private_student_identity`. Do not use blanket `prisma migrate deploy` without auditing outstanding migrations. No real student-ID data collection was activated.
- This approval was for local development only, not production or future deployment. The API continues to return `available: false` and a nonnumeric count in environments lacking the migration or regenerated client.

## Verification

- `bunx prisma validate` passed.
- Focused API and component tests passed.
- API full suite: 232 pass, 8 expected skip, 0 fail.
- Web production build succeeded. Full web unit suite: 131 pass, 1 fail in separately edited private meetup map pin test; appreciation and store UI tests passed.
- Following local approval, appreciation-only migration activation passed all database guards; 6 focused API tests and 9 focused web tests passed. Live public count and guest rejection verified; no pre-existing user or store records were altered. No Git push was performed.

## Store reviews follow-up (November 19, 2026)

- Confirmed the existing `StoreReview` database table and generated Prisma model are active on local `cpsu_marketplace`. Live public reviews endpoint: HTTP 200 with `available: true` and an actual numeric summary; unauthenticated moderation requests: HTTP 401.
- Read-only database inventory found **0 completed transactions, 0 pending reviews and 0 published reviews**. No demo or fake reviews were inserted.
- Public ratings include only published, campus-moderated reviews. Existing complete-transaction, verified-buyer, one-review-per-transaction, and campus-scoped moderator protections remain intact.
- Corrected the buyer eligibility endpoint so it also checks the current public visibility and ownership of the seller's store, matching the write endpoint. Buyers now receive a useful reason when affiliation or store eligibility blocks reviewing.
- Improved the transaction review form to use accessible 1–5 star radio controls, with a selected-rating caption and explicit submission error feedback.
- Completed buyers now see a clearer transaction-list entry point ("View transaction & review"). Moderation errors also show the standard action-feedback message, without disturbing moderation permissions.
- Synthetic HTTP/API tests: **15 passed, 0 failed**; focused web workflow/storefront tests: **10 passed, 0 failed**; API typecheck and web production build passed (existing nonblocking Vite chunk-size warning).
- No additional migrations, existing records, or private student data were changed. True multi-user browser acceptance requires a legitimate completed transaction and reviewer account; none existed in the local database at verification time.

## Public storefront: Write a review (November 19, 2026)

- Added a visible **Write a review** action directly inside the `Ratings & reviews` section, centered under the concise `No reviews yet` empty state when no public reviews exist; remains available with published reviews.
- Guests use the existing sign-in return path. Staff and owners do not get a buyer review action. Clicking as a signed-in student checks eligible completed purchases instead of assuming every account can rate the store.
- New private `GET /api/v1/seller-profiles/:id/review-opportunities?page=N` requires a student session, a visible CPSU student store and a verified current campus affiliation; it returns only that buyer's completed, unreviewed transactions with that store, with 10-item pagination. The response exposes only transaction ID, listing title, and transaction creation date; no other buyer or contact details. It is `private, no-store`.
- Eligible buyers select the relevant purchase, then reuse the existing `TransactionStoreReview` rating and optional text form and existing submission endpoint; submitted ratings still await campus moderation, and public averages remain unaffected until publication.
- Empty/ineligible states include a concise explanation and link to `My transactions`. The star-rating entry point uses normal keyboard-accessible buttons and controls; the existing feedback pattern reports submission outcome.
- No migration or actual database data was changed. A live unauthenticated request to the new endpoint was denied (HTTP 401). Focused API and UI workflow tests cover route filters, pagination, guest sign-in, empty state and valid synthetic submissions.
- A real buyer-to-reviewer acceptance test is still pending because the local development database contained no completed transactions at the time of testing.

- Final verification for the public write-review entry: 18 API review/moderation tests and 16 focused web review/store tests passed (34 total, 0 failures); API TypeScript check and web production build passed. The existing Vite large-chunk warning is non-blocking. Actual database query with `storeReview: { is: null }` executed successfully in read-only mode, and a guest request to the new HTTP endpoint returned 401.
