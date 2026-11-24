# CPSU Market — Store ratings and written reviews
Date: 18 November 2026 (Asia/Manila)
Environment: Authorized local Windows CPSU Market repo, Bun + Express + Prisma + MariaDB

## Scope and protection
- Five-star store ratings; optional written review up to 800 characters.
- Only the authenticated verified student **buyer** of a self-reported completed transaction may leave a rating. One rating per transaction enforced by a unique database key. Store owners and staff are blocked.
- Ratings begin as `pending`; campus-scoped reviewers approve/reject, with a required recorded reason and audit event. A published rating can be hidden.
- Public store pages show only published review count, average, and paginated review text (no buyer identity/contact/transaction details). UI labels buyers generically, and states that completion is self-reported.
- Public review reads honor the existing approved, active, currently affiliated student-store eligibility.
- No fabricated reviews or zero-rating fallback when the migration is missing. The UI explains that the feature is being prepared.

## Code added and connected
- `apps/api/src/store-reviews.ts`: public review pagination/summary, buyer submit/status, reviewer queue and audited decisions, feature gating.
- `apps/api/src/app.ts`: router registration.
- `apps/web/src/store-review-widgets.tsx`, `store-reviews.css`: public ratings, buyer form, review moderation.
- `apps/web/src/pages-storefront.tsx`: ratings section under public store.
- `apps/web/src/pages-transactions.tsx`: review form on completed buyer transactions.
- `apps/web/src/pages-admin.tsx`: Store ratings moderation workspace section.
- `apps/web/src/api.ts`: understandable review error messages.
- `apps/api/test/store-reviews-http.test.ts`, `store-reviews-moderation.test.ts`: synthetic authorization, state transitions, campus scoping and audit tests.
- `apps/api/prisma/schema.prisma`: StoreReview model already persisted in local schema, validated.
- `apps/api/prisma/migrations/20261118160000_store_reviews/migration.sql`: additive migration STAGED ONLY.
- `apps/api/scripts/store-reviews-synthetic-ddl.ts`: opt-in disposable MariaDB DDL acceptance script.

## Local verification
- `bunx prisma validate`: PASS.
- `bunx tsc -p . --noEmit` from apps/api: PASS after narrowing the optional review-client boundary.
- `bun --filter @cpsu/web build`: PASS (latest).
- `bun test test/store-reviews-http.test.ts test/store-reviews-moderation.test.ts`: 13 pass, 0 fail.
- Full API suite before the final moderation test addition: 181 pass, 8 guarded integration skips, 0 fail.
- Web test suite after unrelated footer source changed: 99 pass, 1 fail; failed test expects a signed-out registration link in `site-footer.test.tsx`. This is outside store review files; do not revert other work.
- `bun scripts/store-reviews-synthetic-ddl.ts --synthetic-only`: PASS against a BRAND-NEW scratch MariaDB schema containing synthetic User/SellerProfile/Transaction parents; tested pending default, unique transaction, rating range, FK enforcement, delete restrict, and count after failed writes. Scratch DB cleanup: PASS.
- `git diff --check` on integration edits: PASS.

## Change control
- Code-only installer backed up modified local sources at:
  `.tmp/store-reviews-code-backup-20261118-152950`
- No migration was applied to `cpsu_marketplace`. No existing student, seller, store, review or transaction data was modified.
- No deployment, Git commit, push, or bulk process termination was performed.
- Existing unrelated dirty worktree was preserved.

## Remaining activation gate
1. Review and approve specifically migration `20261118160000_store_reviews` for the CPSU local development database, after a backup/restore rehearsal appropriate to existing records and with unrelated pending migrations held.
2. Regenerate Prisma client after checking/stopping only processes holding its Windows DLL (do not kill unrelated services).
3. Restart authorized local API and run authenticated buyer/reviewer/browser E2E scenarios, including a completed synthetic transaction, publication and hiding.
4. Validate on physical iPhone Safari and Android Chrome, including keyboard focus and moderation dialog.
5. Repair the unrelated footer test in its own change, without altering the review feature.

**Status: code implemented and isolated SQL acceptance passed; development activation explicitly pending separate approval.**
