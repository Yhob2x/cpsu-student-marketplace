# CPSU Market — Stage 6B leased push worker (code-only)

**Date:** 19 November 2026 (Asia/Manila)
**State:** **Worker and quota core implemented and tested synthetically; not connected to production, not enabled.** The existing in-app notification remains canonical. This continuation did not authorize changing the real student database or sending Web Push to external providers.

## New Stage 6B implementation

- `apps/api/src/push-outbox-worker.ts` — bounded claim/drain state machine; 90-second leases, maximum 8 candidates per tick and 2 concurrently processed jobs; waiting jobs are never auto-started by the API. Conditional send outcomes are settled as `sent`, `pending`, `skipped` or `failed`. Transient network/408/429/5xx outcomes use the Stage 6A exponential retry policy and provider Retry-After, limited by job TTL and attempt count. Provider exception details are not logged. If persistence fails, the tick fails loudly. The explicit `pushOutboxTickActivated = false` guard stays OFF.
- `apps/api/src/push-outbox-repository.ts` — a Prisma-shaped, injectable persistence adapter that enumerates only unexpired due jobs with fewer than five prior claims; claim uses a single `updateMany` compare-and-set (CAS), including exact due-state and expiry predicates. A lease token fences acknowledgment and prevents stale workers overwriting another worker's state. Expired jobs and exhausted-attempt jobs have explicit terminal cleanup transitions. This module has **not** been executed against MariaDB yet.
- `apps/api/src/push-outbox-budget.ts` — a separately testable Serializable DB transaction that validates the current lease and existing budget reservation; atomically creates/updates a per-recipient Asia/Manila daily budget with `count < 5`, then writes `PushOutbox.budgetReservedAt` within the same transaction. Reclaimed jobs with a prior reservation are not double-charged. A prior-day reservation returns `stale_day` after Manila midnight, and must be suppressed instead of counting against or bypassing the next day's quota. A failed CAS throws internally so the transaction rolls back the increment. Transaction deadlock or persistence errors propagate and **never authorize a provider send**.
- Added no dependencies, API routes, browser permissions, systemd worker service, startup process, global schedules or outgoing provider hooks.

## Acceptance evidence

| Test | Outcome |
| --- | --- |
| Stage 6B synthetic worker, competing claims, retries, crash recovery | **8/8 PASS** |
| Stage 6B recipient-wide serializable budget simulation | **8/8 PASS** |
| Stage 6B Prisma query/CAS adapter shape | **7/7 PASS** |
| Stage 6A + 6B focused source/policy/schema tests | **45/45 PASS** |
| Full API Bun unit suite | **347 passed / 8 opt-in integration suites skipped / 0 failed** |
| API TypeScript check | **PASS** (a transient concurrent change in `perf-start.ts` caused two unrelated errors earlier in this turn; these were absent in the full rerun) |
| Full web Bun unit suite | **200 passed / 0 failed** |
| Web TypeScript and Vite build | **PASS**; existing large bundle warnings |
| Prisma schema validation | **PASS** |
| PWA assets | **PASS** |
| Staging Nginx and process template validator | **16/16 PASS** |
| Live provider throughput and real installed phone notifications | **NOT TESTED** |
| MariaDB outbox migration, lease CAS, isolation and rollback | **NOT TESTED** |

The concurrency budget test is a **serialized in-memory fake** with transaction rollback simulation. This does not certify MySQL/MariaDB Serializable isolation, deadlock handling, record locking or capacity under concurrent network workers. The lease adapter's query predicates were checked structurally, not against actual generated Prisma Client with the new schema.

## Hard release and compatibility constraints

**Queue producers and outbound delivery remain inactive:**
- `pushOutboxWritesActivated = false` in `push-outbox.ts` prevents new writes to an unapplied migration.
- `durableOutboxWorkerActivated = false` in `push.ts` blocks the legacy Web Push relay path.
- `pushOutboxTickActivated = false` in `push-outbox-worker.ts` is the proposed worker entrypoint gate. The injectable pure test runner explicitly receives `enabled: true` only under synthetic tests; it is not imported or scheduled in a live process.
- Both original environment settings `PUSH_SUBSCRIPTIONS_ENABLED` and `PUSH_DELIVERY_ENABLED` still default OFF. No source component automatically starts the worker.

**Pending migrations in development:** `20261117230000_private_student_identity` (separate approval) and `20261119150000_push_delivery_outbox` (source-only draft). No `migrate dev` or `migrate deploy` has run. Never run a general migration against development or production because it could apply the unrelated privacy-gated student identity table.

## Outstanding tasks before a real worker could be approved

1. Finish dispatch adapter: load the canonical Notification inside an account-scoped query, verify active recipient and freshly opted-in subscription, enforce account master-off, category flags and quiet hours at **send time**; never leak private payload into the lock screen. Call `reserveRecipientBudget` before contacting any provider.
2. Implement real `PushAttempt` per-device records keyed only by `(outboxId, endpointHash)`, with CAS-controlled `sent` and transient retry outcomes. On a lease restart, skip endpoints already accepted. Exactly-once remote delivery remains **impossible to guarantee** if a provider accepts the push just before a process crash.
3. Implement a separately gated worker bootstrap/service with graceful stop, bounded process-wide inflight jobs, renewed leases if needed, and aggregate-only telemetry. Provide private operator alerts and DPO-approved retention/cleanup; never log device capability URLs, names, message bodies or private IDs.
4. Conduct an explicitly approved **isolated MariaDB restore rehearsal** applying **only** the push outbox migration (not the unrelated identity migration), generate Prisma Client safely, test real concurrent lease claims, quota CAS, rollback, index/FK/case behavior, forced crash and retry. Then build staging with documented rollback.
5. Add authenticated account-wide/quiet-hour settings UI and HTTP endpoints once the schema is validated. Do not present draft options as already saved.
6. Obtain an institution-approved HTTPS staging origin, trusted TLS, monitored VAPID contact, DPO retention and privacy review, synthetic 2,000-notices/min load acceptance without student endpoints, and real consenting iPhone/Android background/lock-screen/badge acceptance.

## Decision

**Stage 6B is ready for code review, NOT deployment or live delivery.** The queue foundation is prepared, unit-tested and source-inert. Next step is the per-device dispatch/permission adapter and isolated SQL acceptance; a production Web Push readiness claim remains prohibited.
