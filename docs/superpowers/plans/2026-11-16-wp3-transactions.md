# WP3 Transaction Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** Complete approved C5 and C1a student-only purchase-request transactions using TDD and isolated MySQL tests.

**Architecture:** Additive MySQL models for Transaction and append-only TransactionStatusLog, plus nullable inventory reservation owner on Listing. Use one authenticated, role-gated transaction router, atomic guarded state changes, and existing inquiry threads for messaging and handoff logistics. Preserve C4 terminal sold behavior. Build PWA participant timeline and campus-scoped administrative monitoring after backend tests.

**Tech Stack:** Bun 1.4, TypeScript, Express 5, Prisma 6/MySQL, Zod, Supertest, React/Vite.
**Spec:** `docs/superpowers/specs/2026-11-16-wp3-transaction-design.md`

## Global Constraints
- Run schema changes and integration fixtures **only on** local isolated `cpsu_marketplace_test`. No development/production migration or deploy.
- Do not modify existing `Handoff` rows, other agents' changes, production credentials, or external integrations.
- Purchases only by active, affiliated verified students with no administrator/establishment role.
- Approved C5: both parties independently confirm meetup/completion; seller accepts/rejects; reason-required unilateral cancellation before completion; physical products exclusively reserve at acceptance, release on own cancellation, sold on mutual completion; service supply not auto-sold; repeated orders after terminal status allowed.
- In-app notifications are durable, delivery of optional push is best effort and does not block transactions.
- Participant-only history, server-owned price and identity, append-only transition logs.

## Review Focus
- Concurrent seller acceptance of two requests for one physical item cannot both succeed; inventory cannot be released by an unrelated cancellation.
- Simultaneous confirmations must not falsely claim mutual completion or lose one party's confirmation.
- Suspended/unverified/administrator/establishment accounts cannot mutate transactions, including late transitions.
- A seller manually changing listing availability or deleting it must not bypass an active reservation.
- Existing inquiry/handoff/read-only history and C4 sold terminal semantics survive transaction changes.

## Task 1 — Record approval and prepare isolated test harness
- [ ] Record approved C5 and C1a in `MASTER_BLUEPRINT.md` PART XIII and update the design status.
- [ ] Prepare `apps/api/test/integration/wp3.test.ts` with integration runner protection, RED HTTP tests for request creation, role isolation, duplicate request, illegal change and seller decision.
- [ ] Run RED: `cd apps/api && bun run test:integration`; expected missing route 404 while existing suite stays green.
- [ ] Add fixtures teardown for transaction logs/transactions, keeping exact test-database safety check.

## Task 2 — Additive schema + test-only migration
- [ ] Add models/enums to `apps/api/prisma/schema.prisma` and a reviewed new migration; never touch existing migrations.
- [ ] Prisma validate and generate client; fail if MySQL cannot apply to test only.
- [ ] Deploy new migration solely through the isolated `test/run-integration.ts` runner. Expected: only test database schema updated.

## Task 3 — Buyer request + seller decision
- [ ] Implement `src/routes/transactions.ts`, mount in `app.ts`.
- [ ] Make initial request/accept/reject RED tests GREEN; seller acceptance physical reservation atomic; cancellation owner and log.
- [ ] Add hostile-input and concurrency RED tests, make GREEN, retest.

## Task 4 — Confirmations, cancellation and immutable log
- [ ] Write RED tests: negotiating, first/second meetup confirmations, first/second completion confirmations, cancellation by either participant, terminal replays, privacy.
- [ ] Implement atomic guarded state mutation and log append; do not infer completion from `Handoff`.
- [ ] Verify all isolated tests and rollback behavior.

## Task 5 — PWA and admin transaction read view
- [ ] Add `apps/web/src/pages-transactions.tsx` and routes/links for self-reported transactions.
- [ ] Add accessible request/decision/confirmation UI with loading/error/conflict feedback, and update navigation.
- [ ] Add read-only campus-scoped `GET /api/v1/admin/transactions`, tests for data minimization and scope, then UI.
- [ ] Check `bunx tsc -p . --noEmit`, `bun run build`, isolated integration and unit tests.

## Task 6 — Final verification + release record
- [ ] Full `bun run test:integration`, `bun run test:push:integration`, `bun test`, web build and `git diff --check`, record exact counts.
- [ ] Self-review security/privacy/concurrency, preserve unrelated edits and clearly report no dev/prod migration or deployment.
- [ ] Record any unfinished tests/screens or decisions in docs. Do not claim production-ready from unit tests alone.

**Deployment gate:** This plan never authorizes production or development migration. Separate approval, backup, restore evidence, change review and CPSU governance gates remain mandatory.
