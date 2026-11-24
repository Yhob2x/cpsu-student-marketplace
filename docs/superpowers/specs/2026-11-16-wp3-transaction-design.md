# WP3 — Purchase requests and transactions: C5 design proposal

**Date:** 2026-11-16
**Status:** APPROVED by project owner on 2026-11-16 for C5 Approach A and C1a student-only transactions, including unilateral reason-required cancellation before completion. Authorized: test-first local implementation and isolated `cpsu_marketplace_test` migration **only**. Development/production migrations, push and deployments are not authorized.
**Project:** CPSU Student Marketplace V1.0
**Sources of truth:** `MASTER_BLUEPRINT.md` Modules 01, 05–09, PART VII, PART XIII; `AGENTS.md`; `docs/MVP_SCOPE.md` conflict C5, and the current local code.
**Objective:** Let verified CPSU students request products/services and track a real, auditable *self-reported* transaction without payments, escrow, or courier services.

## 1. What exists now

- `InquiryThread` uniquely identifies a listing + buyer. Participant-only chat, notifications, and `Handoff` already exist.
- `Handoff` is an optional one-per-thread self-reported method/time/place/outcome. Either participant can update it; it must not be treated as a verified transaction.
- Listings distinguish moderation `status` from `availabilityState: available | reserved | sold`; `sold` is terminal under approved C4.
- Auth re-loads account roles/status; an affiliation may be verified or expire; `SellerProfile` is the existing seller owner.
- No `Transaction` or `TransactionStatusLog` Prisma models, transaction endpoints, or transaction UI exist.
- Current worktree has many uncommitted push, moderation, and admin modifications. Preserve them. `C5` and `C1a` remain unresolved.

## 2. Approaches considered

**A. Structured transactions with two-person confirmation — RECOMMENDED.**
Distinct transaction + append-only history; the buyer requests; the seller accepts/rejects; both agree before meetup/completion. Reuse existing inquiry chat and preserve the existing `Handoff` data as an optional logistical detail, *not* a status source. Best auditability and fewer unilateral false-completion claims. More server-side complexity and acceptance tests.

**B. Minimal one-person state changes.**
One of the participants can independently advance to `for_meetup` and `completed`. Faster MVP but misleading completion claims, disputes, and status abuse; **not recommended** for campus trust.

**C. Treat `Handoff` as the transaction.**
Requires fewer new tables but violates the blueprint's explicit `transactions` and `transaction_status_logs` requirements and confuses logistics with authorization/history; **rejected**.

## 3. Proposed student workflow (requires C5 approval)

1. A **verified, active buyer** opens a published, available listing and chooses **Request item / Request service**. Never let a seller request their own listing. The server reuses or creates that listing+buyer inquiry thread and creates a **pending** transaction; a repeated HTTP submission must not create a duplicate active request.
2. The **active, approved seller** decides **Accept** or **Reject** on a pending request. Reject means status **cancelled** with log reason code `seller_rejected`, not a seventh status. Buyer withdrawal is also `cancelled` with reason `buyer_withdrew`.
3. After acceptance, either party can begin **negotiating** through existing chat. No automated price renegotiation or payment collection. The transaction records a snapshot of the requested amount/currency; changing the listing later must not silently rewrite the original request.
4. When the parties have agreed on arrangements, both independently **Confirm meetup**. Status becomes **for_meetup** only after both confirmations. The original `Handoff` stays optional, connected via inquiry thread, and keeps existing records intact.
5. From **for_meetup**, both independently **Confirm completed**. Only the second confirmation moves status to **completed**. A completion is a **mutual self-report, not verified payment, shipment, or independent proof of sale**. Completion is terminal.
6. A buyer can withdraw before acceptance. After acceptance, either party may initiate **cancelled** with a mandatory reason; the other party is notified and the cancellation is audited. Cancellation is terminal. Whether unilateral cancellation is allowed even after a meetup has been confirmed is **an owner decision**.
7. For physical products, **proposal**: seller acceptance atomically reserves an available listing so two buyers cannot both obtain acceptance. Once both confirm completed, the listing becomes `sold` (terminal per C4); cancellation may release *only the reservation owned by that transaction*. For services, do not automatically mark sold; service listings may handle multiple clients. **This inventory coupling requires explicit approval.**

## 4. Proposed status transition table

| From | Event | Authorized actor | To |
|---|---|---|---|
| None | request | Verified active buyer (not owner) | pending |
| pending | accept | Active seller | accepted |
| pending | reject | Active seller | cancelled (reason `seller_rejected`) |
| pending | withdraw | Original buyer | cancelled (reason `buyer_withdrew`) |
| accepted | discuss | Either participant | negotiating |
| accepted / negotiating | meetup confirmations | Each participant confirms independently; last confirmation commits | for_meetup |
| accepted / negotiating / for_meetup | cancel (pending owner decision on late cancellation) | Participant with reason | cancelled |
| for_meetup | completion confirmations | Both participants; last confirmation commits | completed |
| completed / cancelled | any transition | Nobody | 409 conflict |

Never infer a confirmation from viewing chat, changing `Handoff`, or a single user's click. Retain event history even when the listing is soft-deleted; protect historical access by participant checks.

## 5. Proposed data design — ADDITIVE ONLY

**Transaction**: `id` PK; `inquiryThreadId` FK; `listingId` FK; `buyerUserId` FK; `sellerUserId` FK; `status` enum (six blueprint statuses); price/currency snapshot; distinct buyer/seller meetup and completion acknowledgment timestamps; `createdAt`, `updatedAt`, terminal timestamps as needed; indexes by user/status and campus/listing. For repeat service requests, use an active-request uniqueness guard (e.g., nullable unique `activeThreadId` which is null on terminal status; MySQL allows multiple NULLs), not a lifetime unique constraint on `inquiryThreadId`.

**TransactionStatusLog**: `id` PK; `transactionId` FK; `actorUserId` FK; `fromStatus` optional; `toStatus`; `event` (`requested`, `accepted`, `rejected`, `withdrawn`, `meetup_confirmed`, `completion_confirmed`, `cancelled`); optional bounded reason code and human reason; `createdAt`; `(transactionId, id)` index. Write logs inside the same Prisma/MySQL database transaction as every transition.

**Handoff compatibility:** Do not drop, rename, rewrite, or backfill `Handoff` rows. Show old `Handoff` history with explicit *self-reported* labeling. The transaction is the source of truth for the new status.

**Safety:** One atomic conditional update per expected status/version (plus reservation guards) to stop double-acceptance and simultaneous confirmations; no write-before-authorization; never trust client-submitted owner/status/price IDs. Preserve audit and privacy boundaries.

## 6. Proposed API / UI boundaries

- `POST /api/v1/transactions` ({ `listingId` }): buyer creates a pending request, authenticated, verified, available listing, anti-duplicate.
- `GET /api/v1/transactions`: authenticated buyer/seller list with bounded pagination and server-side ownership filtering.
- `GET /api/v1/transactions/:id`: participants only (with immutable history). Unauthorized IDs return 404.
- `POST /api/v1/transactions/:id/decision`: seller accepts/rejects pending with mandatory reason for rejection.
- `POST /api/v1/transactions/:id/negotiating`, `.../confirm-meetup`, `.../confirm-completion`, `.../cancel`: only authenticated eligible participants, transition rules enforced on server.
- `GET /api/v1/admin/transactions`: read-only monitor, scoped to approved campus authorization; no student private chat or payment details.
- In the PWA, a purchase request action on a listing, an accessible **My Transactions** view, a per-transaction timeline, and in-conversation status/confirmation actions. Clear pending/failed states, no misleading “payment verified” copy.
- In-app notifications for requests, decisions, meetup/completion confirmations, cancellation and status updates. Push remains optional/opt-in and not a dependency of successful transaction commits.

## 7. Tests and deployment gates

1. TDD: first RED tests for buyer request, seller decision, unrelated student/cross-campus denial, unverified/inactive users, duplicate requests, illegal state transitions, and two-person confirmations; then implementation.
2. Additive Prisma schema and migration reviewed separately. Run only in **`cpsu_marketplace_test`**, with destructive fixture guard and generated-client compatibility. Never apply to a development, production, or unknown database without a separate approval/backup gate.
3. Concurrency tests: two buyers accepting a one-off product, duplicate confirmation requests, stale transitions and reservation rollback.
4. Regression: listing availability (C4), inquiry status, suspended seller privacy, image restrictions, notification badge counts and audit logs.
5. Web and API TypeScript checks, unit and isolated integration tests, real device/browser flows and accessibility checks.
6. No live credentials, real buyers, payment integration, native-app divergence, or automatic "verified sale" claim.

## 8. Approved owner decisions (2026-11-16)

- **C5-A:** Use Approach A with both parties' independent confirmation for meetup and completion; rejection maps to `cancelled`; existing `Handoff` remains as a separate optional detail.
- **C5-B:** Physical products reserve automatically on seller acceptance, safely release only their own reservation on cancellation, and turn `sold` only after both confirm completion; services do not auto-sell.
- **C5-C (APPROVED):** Either participant can unilaterally cancel before completion, including `for_meetup`, with a mandatory audit reason; cancellation is terminal.
- **C1a (separate role gate):** Follow blueprint matrix (students transact, administrator roles monitor only); existing additive staff/student roles currently leave participation ambiguous. Decide explicitly before coding authorization.
- **C5-D:** One active request per listing+buyer thread; allow new requests after cancelled/completed (important for repeat service orders).

**Owner approval:** Received 2026-11-16 for C5 A/B/C/D and C1a transaction-only student participation. Production deployment and development-database migrations are **not** authorized.

## 9. Implementation order after approval

**WP3.1:** Record owner decision in `MASTER_BLUEPRINT.md` PART XIII; identify data dependencies and write integration test matrix.  
**WP3.2:** Add transaction schema + reviewed additive migration; apply to isolated test DB and run integrity checks (no dev DB writes).  
**WP3.3:** TDD request creation/idempotence/authorization and seller accept/reject; test concurrent physical-item acceptance.  
**WP3.4:** TDD negotiating, meetup and completion confirmations, cancellation and history; preserve handoff and C4 availability constraints.  
**WP3.5:** Student transaction PWA screens and in-app notification flows; accessible error/loading states.  
**WP3.6:** Read-only campus-scoped admin monitoring; full regression + mobile QA; record remaining launch blockers.

### Local inspection / no source mutation

At the time this proposal was written, the current baseline still had 17/17 API unit tests passing (two isolated integration suites skip by default), API TypeScript check passing and web production build passing. No transaction code, migration, development DB rows, Git commits, pushes or deploys were created as part of this design step.
