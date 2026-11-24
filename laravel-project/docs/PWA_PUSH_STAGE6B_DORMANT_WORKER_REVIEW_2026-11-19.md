# CPSU Market — Stage 6B dormant outbox worker safety review

**Date:** 19 November 2026 (Asia/Manila)
**Scope:** Source-only worker/Prisma adapter and quota policy review. No database migration, Prisma Client generation, live worker start, push enrollment, real relay send, deployment or git commit.
**Status:** Local state-machine verification passed; release and data-integrity acceptance remain **BLOCKED**.

## Reused Stage 6A / 6B draft

The current repository already has an unapplied additive `PushOutbox`, `PushAttempt`, `PushDailyBudget`, `PushDailyMetric` migration, fail-closed producer/delivery gates, and the following dormant source modules:

- `apps/api/src/push-outbox-worker.ts`: maximum eight jobs claimed per tick, two concurrent job handlers by default, 90-second lease tokens, per-job completion states, retry/reschedule, stale-lease rejection and no startup timers. The `runPushOutboxTick` function is exported but no live API entry point calls it.
- `apps/api/src/push-outbox-repository.ts`: a Prisma-shaped compare-and-set adapter to claim pending/expired-lease jobs, acknowledge by token, and expire exhausted/expired rows.
- `apps/api/src/push-outbox-budget.ts`: serializable transaction port for a once-per-notification recipient-wide reservation before any device fan-out.
- `apps/api/src/push-delivery-controls.ts`: Asia/Manila calendar-day evaluation, half-open quiet hours, a **proposed** five-notification daily cap and expiry-bounded retry scheduling.

The compiled `pushOutboxTickActivated`, `pushOutboxWritesActivated` and `durableOutboxWorkerActivated` guards are **false**. Neither a generated migration nor valid VAPID keys can start dispatch.

## Incremental correction: no previous-day quota on a new day

**Problem:** If a notification was reserved at 23:59 Asia/Manila and a retry occurred after midnight, the existing `budgetReservedAt` short-circuit could return `already_reserved`. The old day's reservation must not authorize an alert in the new day's recipient budget, or a student could receive old retries on top of the next day's five notices.

**Fix:** `reserveRecipientBudget` now checks that the prior reservation timestamp belongs to the **same Asia/Manila calendar date** as dispatch. If the dates differ, it returns `stale_day` without creating or incrementing a new-day counter. A future delivery adapter must interpret `stale_day` as a terminal **suppressed** outcome (no catch-up banner); the canonical in-app notice remains available.

**Coverage:** Added a rollover regression with a still-live 90-second lease crossing 00:00 Manila and a worker-state test ensuring `stale_day` suppression is terminal rather than retried.

**Files edited in this continuation:** `apps/api/src/push-outbox-budget.ts`, `apps/api/test/push-outbox-budget.test.ts`, `apps/api/test/push-outbox-worker.test.ts`. Existing app/UI files, unrelated concurrent work and all migration source files were preserved.

## Verification

| Check | Outcome |
|---|---|
| Focused delivery-controls, budget and lease-worker synthetic tests | **29 passed, 0 failed** |
| Full API Bun unit tests | **343 passed, 8 opt-in integration tests skipped, 0 failed** |
| API TypeScript `tsc --noEmit` | **PASS** |
| Prisma `validate` | **PASS**, schema syntax only |
| Live delivery / app worker startup | **NOT ACTIVE** |
| Actual serializable MariaDB lease, reservation and FK acceptance | **NOT VERIFIED** |
| Provider acceptance, background iOS/Android PWA notifications | **NOT VERIFIED** |
| Production release | **BLOCKED** |

Tested only with Bun synthetic mocks. This is **not** a claim that MariaDB isolation, lease persistence or provider delivery is production-safe. No database or external push service was contacted by the focused tests.

## Mandatory next gates before any activation

1. **Transactional correctness in a disposable synthetic MariaDB database:** rehearsal must isolate the new outbox SQL from the unrelated unapplied `20261117230000_private_student_identity` migration, preserve existing development data, compare Prisma client/schema, verify FK/collation/indexes, and prove two real connections cannot both claim a lease or reserve a sixth daily notice. Obtain a reviewed backup/restore and migration rollback plan.
2. **Implement the delivery adapter completely:** query live consent and account status at send time, validate each endpoint, enforce quiet-hours and master-off, call `reserveRecipientBudget` before fanout, translate `stale_day` to suppression, persist `PushAttempt` outcomes and suppress already-accepted endpoint retries. Reconfirm lease/expiry before provider calls. No exactly-once claim is possible after relay acceptance followed by a crash.
3. **Worker operation and monitoring:** implement supervised lifecycle only after data-layer acceptance, worker-wide concurrency and emergency stop, persistent aggregate counters and privacy-reviewed retention, queue age/depth/expired thresholds, bounded 429 Retry-After, 404/410 cleanup, and an approved operator alert route. A failure must not disable in-app notices.
4. **Institutional consent/policy:** approve five/day recipient-wide cap, quiet-hour timezone and suppression/exemption rules, account master-off UI and retention. The current policy is a proposal, not an institutional decision.
5. **Controlled device release:** obtain approved HTTPS staging domain, monitored VAPID subject, isolated staging database, trusted TLS and consenting synthetic-device acceptance on real iOS and Android. Keep both existing environment switches **OFF** and all compiled gates **false** until reviewed.

**Decision:** Retain this as a source-only hardening step. Do not apply the outbox migration to `cpsu_marketplace`, enable an API worker, set push flags, create real subscriptions, send real alerts or declare production ready.
