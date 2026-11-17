# CPSU Market — Follow stores and browse store categories (2026-11-17)

## Approved product change
Owner requested a Follow function and categories for the existing dedicated My Store/public storefront, using a reference screenshot. Keep the existing CPSU theme, listing approval policy and student-only actions. No fabricated followers, ratings, reviews, sales or response statistics.

## Implementation
- Public store GET /api/v1/seller-profiles/:id adds follow: { count: number|null, isFollowing: boolean, available: boolean } without exposing personal follower identities; no-store caching.
- Signed-in student follow: PUT /api/v1/store-follows/:id. Unfollow: DELETE /api/v1/store-follows/:id. Both are idempotent, permission-checked and respond with current membership/count.
- Signed-out user sees Follow and is sent to sign-in with a safe return URL for the store. Staff actions are unavailable; users cannot follow their own store. Store must be approved and owned by an active account.
- Additive StoreFollow model has composite primary key userId + sellerProfileId and a seller/time index. Only genuine persisted follows affect count.
- Before the gated migration AND Prisma client regeneration, following is disabled with an honest message. An absent database table is treated as unavailable, not zero followers.
- Public storefront shows 44px-minimum category chips derived only from the actual public store listings, in addition to all/products/services filters and the existing search. Category/type selections are independent; selecting a category resets the type filter to All.
- The About section follows the catalog, keeping the store discovery navigation near the top. Responsive tab/chip wrapping preserves keyboard focus and reduced-motion compatibility. No external APIs or account data exposure.

## Migration activation — NOT APPROVED
Prepared only: apps/api/prisma/migrations/20261117180000_store_follows/migration.sql.
Do not run prisma migrate dev/deploy, db push, or apply this SQL to the development or production database without a specific approval, verified backup and isolated restore testing. Older pending migrations must not be applied as a side effect. After controlled migration, regenerate the Prisma client with the development API stopped and restart it in a supervised window.

## Validation
- Schema validation: Prisma accepted the schema.
- Synthetic HTTP tests: 5/5 passing, including duplicate follow, unfollow, anonymous/staff/owner denial, malformed/missing store and unmigrated table.
- Web unit tests: 57/57 passing.
- Web TypeScript + Vite production build: passing.
- API TypeScript check: passing without client regeneration, using a staged optional delegate.
- Prisma generation into the shared node_modules failed with Windows EPERM because active Bun API processes hold the query-engine DLL. We did not terminate them or migrate the database.
- Browser preview at http://127.0.0.1:4173/stores/3: real active store Kalabasa displayed the correct listing/type filters and two actual category chips. At 1280px, selecting Design & creative reduced the store results from 2 to 1 and updated aria-pressed. At 320px and 390px the storefront had no document horizontal overflow; Follow was visible but disabled because the migration is unapplied.
- Physical iPhone/Android, screen reader, and post-migration database integration tests remain pending.

## Files
- apps/web/src/pages-storefront.tsx; apps/web/src/storefront.css; apps/web/src/pages-public.tsx; apps/web/src/api.ts.
- apps/api/src/store-follows.ts; apps/api/src/app.ts; apps/api/src/routes/public.ts; apps/api/prisma/schema.prisma.
- apps/api/prisma/migrations/20261117180000_store_follows/migration.sql; apps/api/test/store-follows-http.test.ts.

Existing dirty work, credentials and database rows were preserved. No commit, push or deployment was performed.

## 2026-11-17 — Backup verification and isolated migration acceptance (PASS)

**Authorization scope:** approved backup and isolated migration testing only. **The development database was not migrated.**

- Guarded local source: `127.0.0.1:3306/cpsu_marketplace`; the script requires `--isolated-acceptance`, forbids production, and validates the exact StoreFollow-only SQL.
- Static migration SHA-256: `292d3510e8ad2971fcd250ced7d8be2de9d4a2bc785b0d4b70d6a4cf19ddcae1`.
- Fresh **private, retained** MariaDB development backup directory: `C:\Users\acer\AppData\Local\CPSU-Marketplace\backups\store-follow-2026-11-17T05-28-49-636Z-fdb556`. Source SQL and uploads remain outside Git; private Windows ACL was applied.
- SQL dump: **365,108 bytes**; SHA-256: `9f4796a248fcbc127033abe7855eae2f286ac360bec273ff2ea0758a24042eb4`. SQL checksum re-read from disk and validated; backup manifest retained.
- **24/24 existing database tables** inventoried; canonical row counts and content SHA-256 signatures matched before/after source backup, after isolated restore, and after isolated StoreFollow migration.
- **24 local uploads** were copied and verified by individual SHA-256 hashes.
- Fresh randomly named `cpsu_follow_isolated_*` test database restored from that SQL dump and verified; **only** `20261117180000_store_follows/migration.sql` applied to the disposable restored database.
- Verified `StoreFollow` two-column composite primary key, seller/time index, both FK references with RESTRICT delete behavior, unchanged preexisting rows, two independent followers, duplicate rejection, invalid FK rejection, restricted store deletion, and follower decrement after unfollow.
- Source database rechecked byte-equivalent by per-table counts/content digests; test database automatically dropped. **Result: PASS; errorCount=0.**
- Test runner: `apps/api/scripts/store-follow-backup-isolated-acceptance.ts --isolated-acceptance` (only with local `apps/api/.env`). Do not rerun without reason: it creates an additional sensitive retained backup.
- Read-only Prisma migration status on source: `20261117123000_seller_avatar_review` already applied; `20261116220000_managed_student_content`, `20261116221000_pending_announcement_edits`, and `20261117180000_store_follows` still pending.

**Separate development activation approval is still required.** Approval must identify only `20261117180000_store_follows`; do not use unrestricted `prisma migrate dev` or `migrate deploy` because older unrelated migrations remain pending. Before activation, revalidate the retained backup, source migration-history/schema drift, and absence of active DB writes. Generate Prisma Client after an authorized pause of only the active API process to release the Windows Prisma engine DLL. Run authenticated follow/unfollow end-to-end acceptance after activation, and retain the recovery backup until acceptance is signed off. No deployment, commit, or push is authorized by this test.

## 2026-11-17 — Owner-approved StoreFollow development activation (PASS)

**Scope:** The owner explicitly authorized application of only `20261117180000_store_follows` to the local development database, regeneration of Prisma Client, and authenticated tests. **This section supersedes the earlier “NOT APPROVED” activation gate above for local development only.**

- Guarded exact migration SQL hash: `292d3510e8ad2971fcd250ced7d8be2de9d4a2bc785b0d4b70d6a4cf19ddcae1`; one `CREATE TABLE StoreFollow` SQL statement applied to `127.0.0.1:3306/cpsu_marketplace`, then only that migration was recorded with Prisma `migrate resolve --applied`.
- Fresh retained and protected pre-activation backup: `C:\Users\acer\AppData\Local\CPSU-Marketplace\backups\store-follow-dev-approval-2026-11-17T05-37-24-814Z-be89d8`. SQL **366,606 bytes**; SHA-256 `e710606cca3e5f8dd51ef115ee9355f1c298b80fa2ad6d2d14cf6ff4822ce638`; 24 local uploads copied. Existing application records verified unchanged after DDL.
- Post-activation Prisma status: `StoreFollow` is applied. The **only two pending migrations** are `20261116220000_managed_student_content` and `20261116221000_pending_announcement_edits`, unchanged and unapplied. No general migrate command used.
- Only the identified API Bun watcher processes were paused; the existing Vite server was preserved. Ordinary `bunx prisma generate` encountered Windows EPERM renaming the locked native query-engine DLL. An **isolated Prisma Client v6.1.0** was successfully generated; its native DLL SHA-256 matched the already installed one exactly. Backed up previous generated JS metadata to `node_modules/.prisma/client-storefollow-previous`; copied 11 regenerated client metadata/type files to the active `node_modules/.prisma/client` **without replacing the locked, byte-identical DLL**. The disposable schema-generation file was deleted. Restarted API at :4000; the live storefront returned `follow.available=true`, a genuine count and the correct published listings.
- Authenticated real-HTTP local synthetic Follow acceptance PASS: public count/state, student follow twice (idempotence), own-store, missing-store, anonymous and staff denial, buyer/guest privacy, repeated unfollow and final read. All synthetic test identities/store/follows cleaned up. Script `apps/api/scripts/store-follow-dev-http-acceptance.ts`.
- API TypeScript typecheck passed. Synthetic Follow HTTP test suite **5/5 passed**.
- No production deployment, Git commit or push was performed.

## 2026-11-17 — Chat with seller on public storefront (PASS)

The owner explicitly requested a **Chat with seller** button next to Follow on the existing public store page. It reuses the current authenticated `POST /api/v1/inquiries` messaging path, not a second chat system. A student clicks Chat, selects one of the actual available published listings in the store, writes a message and is taken to the existing Messages conversation after successful submission. The existing server enforces student-only access, self-message denial, listing availability, participant-only history, and seller notifications. Guests are sent to sign-in with safe store return; staff/owners cannot initiate buyer chat. If a store has no available published listings, chat is disabled with a clear explanation (the existing InquiryThread schema requires a listing ID). No unreviewed listing or fictional direct-store thread is created.

- Browser at 320px, 390px and 1280px: Follow and Chat actions visible for eligible viewers, no horizontal page overflow. Guest Chat leads to sign-in. Signed-in synthetic browser account opened the on-store composer at 390px, observed its actual listing choices and disabled-empty / enabled-draft Send states. **No test message was sent to a real seller.**
- Fixed `apps/web/src/auth-return.ts` to recognize **only** exact numeric store paths `/stores/:id`, preserving strict rejection of malformed/off-site return URLs. Verified login from `/login?next=%2Fstores%2F3` actually returns to the Kalabasa store. The temporary browser QA account and sessions were deleted.
- Authenticated synthetic HTTP Store Chat acceptance PASS: posting a valid listing-scoped inquiry, rejecting guest/owner attempts, reading the message from buyer/seller existing inbox, verifying the standard in-app notification. All synthetic rows cleaned up. Script `apps/api/scripts/store-chat-dev-http-acceptance.ts`.
- Web TypeScript/Vite build PASS; complete web tests **60/60 PASS** (includes 3 storefront-chat tests and store-return safety tests); API typecheck PASS. Existing React server-render test warnings (`useLayoutEffect`) are not failing tests.
- Open device QA: physical iPhone Safari, Android and screen-reader verification not completed. No commit/push, external hosting, additional schema migration or production changes.
