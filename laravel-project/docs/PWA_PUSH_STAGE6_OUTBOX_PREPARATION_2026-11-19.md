# CPSU Market — Stage 6A durable Web Push preparation

**Date:** 19 November 2026 (Asia/Manila)
**Authorization:** Owner requested continuation and approved the architecture planning. Approval permits preparing local source/schema/tests; it does **not** establish a public domain, institutional privacy approval, live push subscriptions, or authorization to migrate a student-data database.
**Status:** **SOURCE-ONLY PREPARATION COMPLETE; QUEUE / DELIVERY NOT ACTIVATED.**

## What is implemented in this stage

1. **Additive Prisma schema and SQL migration draft** at `apps/api/prisma/migrations/20261119150000_push_delivery_outbox/migration.sql`:
   - `PushOutbox` with exactly one row per canonical `Notification.id`, leased scheduling fields, a nullable `budgetReservedAt` marker for a single atomic daily-budget reservation per notice, one-hour expiry, and no lock-screen payload or endpoint URL.
   - `PushAttempt` keyed by (`outboxId`, SHA-256 `endpointHash`) for future best-effort per-device retry bookkeeping. No device credential URLs, p256dh, auth keys or private message text in this table.
   - `PushDailyBudget` keyed by (recipient, **Asia/Manila day**) for future atomic quota reservations across devices.
   - `PushDailyMetric` containing only aggregate (day, category, outcome) counters.
   - `PushPreference.masterEnabled` (account-wide switch, default true for users who already explicitly enrolled their device) plus nullable `quietStartMinute`/`quietEndMinute` (quiet hours disabled until configured). Neither is exposed in the current browser UI yet.
2. **Pure domain policy** at `apps/api/src/push-delivery-controls.ts`: active-user/category/account/registered-device checks, configurable half-open quiet-hour intervals (including overnight), five recipient-wide notices per Manila calendar day, invalid budget/interval fail-closed behavior, and bounded retry time for network, HTTP 408/429/5xx with Retry-After and expiry. Five is an approved **proposed policy** pending institutional review; no production budget enforcement is active.
3. **Transaction-bound producer hooks** in `apps/api/src/push-outbox.ts`, `audit.ts`, `routes/admin.ts`, `routes/transactions.ts` and `store-publication-notifications.ts`. The standalone `insertPushOutbox()` prepares a row without sensitive payload, and throws on a queue insert failure for enclosing transactions to roll back. A gated wrapper is placed alongside existing notification creates. The default `pushOutboxWritesActivated = false` ensures no new schema is referenced by active development routes and no existing in-app delivery behavior is changed.
4. **Hard outbound fail-closed guard** `durableOutboxWorkerActivated = false` in `apps/api/src/push.ts`. `pushDeliveryReady` is false even if both legacy environment switches were accidentally set true. This is intentional until the real leased worker and transactional preferences/quotas have passed isolated acceptance. It is not a new environment toggle and cannot be enabled by installing VAPID keys.
5. **Static/pure tests**, `apps/api/test/push-delivery-controls.test.ts`, `push-outbox-schema.test.ts`, and `push-outbox.test.ts`, cover date rollover, quiet hours, recipient cap, retry codes, payload minimization, schema identity, atomic-writer error propagation and disabled gates.

## Exact verification

- **Prisma schema validation:** PASS. Source `schema.prisma` is syntactically valid. The new SQL migration has **not** been executed, so DDL compatibility and FK semantics have **not** been confirmed against an isolated MariaDB restore.
- **Read-only `prisma migrate status`:** development schema `cpsu_marketplace` has **two unapplied migrations**, `20261117230000_private_student_identity` and the new `20261119150000_push_delivery_outbox`. **Do not run `migrate dev`, `migrate deploy`, or `db:deploy` against development, staging, or production as a shortcut:** Prisma would include the unrelated pending student-identity migration, whose privacy approval remains separate.
- **New focused tests:** **22/22** pass; no database access, push-service traffic, or subscription enrollment.
- **Full API unit suite:** **317 passed, 8 opt-in integration suites skipped, 0 failed**; API TypeScript check passes.
- **Full web unit suite:** **199 passed, 0 failed**; web TypeScript and Vite production build pass (known >500 kB chunk warnings).
- **PWA asset validator:** PASS; Nginx push staging templates **16/16 PASS**; tracked Git diff whitespace check PASS.
- **Physical Android/iOS and real push relay:** NOT tested. Earlier browser PWA suite passed 24/24 in local Chrome emulation; it was not rerun for this schema-only stage.
- **Database changes in this iteration:** NONE. Generated Prisma Client, running API, existing push endpoints and live release flags remain unchanged.

## Required follow-on work before switching either guard to true

**Worker and data integrity:** Implement a bounded leased worker with atomic claim/ack and crash recovery, worker-wide concurrency cap, per-device idempotency using `PushAttempt`, expiry, 429 Retry-After, exponential backoff/jitter and 404/410 cleanup. At the moment these are schema columns and pure algorithms only, **not an operating durable service**. Keep Web Push best-effort; never promise exactly once after provider acceptance and a process crash.

**Quota/consent:** Atomically upsert the daily-budget row, then increment only while `count < 5` inside a DB transaction with the job's single reservation marker; otherwise concurrent workers could exceed quota. Enforce master-off/category/quiet hours on the server at dispatch time and confirm policy when students revoke consent. Decide whether quiet hours **suppress rather than replay** outbox items, and whether important transaction alerts have exemptions. By default do not send stale catch-up banners: canonical in-app notices remain available. Add authenticated PATCH/GET settings and UI only after migration/isolated API tests, without falsely showing an unconfigured setting as active.

**Monitoring:** Persist aggregate counters by day/type/outcome, instrument queue age/depth and failed-delivery ratio, and configure a private institutional operator alert. Neither logs nor metrics may contain student IDs, endpoints, message bodies, review reasons, or credential material. Decide aggregate retention and raw attempt-record deletion windows with CPSU DPO, then test the purge procedure in isolation.

**Migration and restoration:** Use an explicitly named **disposable, synthetic** MariaDB database, a verified backup, and a migration rehearsal that applies **only** the reviewed outbox migration after confirming compatible prerequisites. Verify FK/collation/case rules, unique notification and per-device keys, concurrent budget increment and lease CAS, rollback, and no changes to `cpsu_marketplace`. Do not activate or migrate the separate pending student-identity feature implicitly. Regenerate Prisma Client in a controlled environment after code/migration QA.

**Release approval:** Independent CPSU privacy/security authorization, an approved monitored VAPID contact, an approved public HTTPS staging domain, trusted TLS, isolated staging DB, permission and lock-screen/badge acceptance on real iPhone/Android Home Screen PWAs, plus measured failure/throughput/load tests. Only then review switching the compiled guards and the existing independent environment flags. The first genuine remote push should be sent only to a consenting synthetic test account.

## Operator decision

Stage 6A is **safe to retain in Git as a staged, reviewed source change**, but **NOT safe to deploy as an active queue**. All external push delivery is hard-disabled; core in-app notifications remain the source of truth. Avoid claims of production readiness until the worker and the staged-release checks pass.
