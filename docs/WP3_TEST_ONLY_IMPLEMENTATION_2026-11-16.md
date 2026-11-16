# WP3 — Transaction Management: Local Test-Only Implementation

**Date:** 2026-11-16
**Approval:** Owner-approved C5 Approach A and C1a student-only transactions under `MASTER_BLUEPRINT.md` PART XIII.
**Status:** IMPLEMENTED IN LOCAL SOURCE; isolated automated tests passed. **NOT deployed, not migrated to development or production, not production-ready.**

## What was implemented

- Additive Prisma `Transaction`, `TransactionStatusLog` and nullable unique `Listing.reservationTransactionId` with FK constraints; new migration `20261116193000_wp3_transactions`.
- Active verified CPSU students without administrative/establishment roles can submit one active request per listing+buyer, with safe repeated request behavior; accepted/rejected by the owning verified student seller only.
- Canonical statuses: `pending`, `accepted`, `negotiating`, `for_meetup`, `completed`, `cancelled`. Rejection and cancellation are terminal, recorded with event name, actor and reason.
- Both participants independently confirm meetup and completion. A single confirmation never claims a completed transaction. `Handoff` remains a separate self-reported logistics record and is never promoted to a canonical transaction status.
- Physical products are exclusively reserved by the accepted transaction, atomically released only by that transaction on cancellation, and marked sold after mutual completion. Services do not auto-reserve or auto-sell, and new service requests are allowed after terminal status.
- Seller listing edits, photo additions, manual availability changes and soft deletion are blocked during an active physical-item reservation.
- Append-only status logs, audit records and per-event in-app notifications are created atomically with each transition. Push transport is optional and not a transaction dependency.
- New `/api/v1/transactions` participant endpoints and read-only `/api/v1/admin/transactions` campus-scoped monitoring.
- Web/PWA: listing purchase-request action, My Transactions index, transaction details/timeline/confirmations/cancellation with required reasons, mobile-accessible Profile link, and notification copy/deep links; admin monitoring panel.
- MySQL deadlock/write-conflict P2034 maps to a safe HTTP 409 so competing physical-item acceptance reports conflict rather than 500.

## Source paths

`apps/api/prisma/schema.prisma`
`apps/api/prisma/migrations/20261116193000_wp3_transactions/migration.sql`
`apps/api/src/routes/transactions.ts`
`apps/api/src/routes/seller.ts`
`apps/api/src/routes/admin.ts`
`apps/api/src/app.ts`
`apps/api/src/http.ts`
`apps/api/test/integration/stage1.test.ts`
`apps/api/test/integration/fixtures.ts`
`apps/web/src/pages-transactions.tsx`
`apps/web/src/pages-public.tsx`
`apps/web/src/pages-profile.tsx`
`apps/web/src/pages-admin.tsx`
`apps/web/src/main.tsx`
`apps/web/src/api.ts`

## Database boundaries

The only database schema modified was `cpsu_marketplace_test`, via the guard-checked `apps/api/test/run-integration.ts` runner, on local `127.0.0.1`. Synthetic fixture cleanup is restricted by environment/database-name/localhost checks. The runner performs an integrity audit without mutating constraints.

`cpsu_marketplace` (local development) was **not migrated**. Production/nonlocal databases were **not accessed or migrated**. There was no push, deploy or Git commit. Existing unrelated local changes were preserved. The source uses the new schema and **will not function as a transaction feature against an unmigrated development or production database**; this is intentional until separately authorized.

Windows Prisma Client engine DLL generation was locked by another process. Schema validation succeeded; the generator produced the new Prisma JS/TS metadata in an alternate local directory, which was copied into the standard `node_modules/.prisma/client` without replacing the locked DLL. Subsequent API typechecking and isolated tests validated this workaround. A clean environment build still needs to be proven before release.

## Acceptance evidence (local synthetic only)

- TDD RED checks observed for absent transaction endpoints and admin monitoring.
- HTTP tests exercise student role/verification, seller-only decisions, per-student visibility, idempotent active request, reason validation, logs and notifications, physical reservation conflict, same-item concurrent acceptances, cancellation and release, service repeat requests and mutual completion, two-party meetup/completion, Handoff preservation, and admin campus isolation.
- Isolated `bun run test:integration` passed 32/32 as of initial local interface implementation; subsequent final verification counts recorded separately.
- `bunx tsc -p . --noEmit` API passed; `apps/web` `bun run build` passed.
- Existing Stage 1 integrity audit showed 0/10 missing reviewed FK targets; the new schema adds additional transaction FKs.

## Remaining gates / known limitations

1. Development migration requires **new explicit owner approval**, current database backup, a tested restore plan and migration preflight; **do not automatically run `bun run db:migrate`**. Production requires a separate decision and privacy/security approval.
2. Mobile Safari/Chrome and real browser keyboard/screen reader QA have not been done; automated build does not prove all UI workflows or push-delivery behavior.
3. Transaction status is a **mutual self-report**, not CPSU-confirmed trade, payment or goods delivery. No ratings, escrow, electronic payment, delivery, automatic sales or refund disputes are claimed.
4. An account suspension or lost verification during a reserved transaction may require a staff-approved resolution procedure. Admin monitoring is read-only and cannot override student transaction status; no privileged dispute workflow was authorized.
5. The project still has unrelated MVP release blockers (privacy/data retention, account recovery, category administration, user block/report, announcements, device QA, etc.). No readiness or launch certification follows from this package.
6. Test-only migration means the actual web transaction experience is not yet possible on the unmigrated development database. Use the isolated test runner for verification, not real students.

**Next approval gate:** A separate, reviewed local development-database migration and browser QA plan. Do not perform it under the current authorization.
