# CPSU Market — Web Push audit remediation and release gates

**Date:** 2026-11-17 (Asia/Manila)
**Scope:** Local source code and synthetic/unit tests only. No remote push delivery, public deployment, database migration, production changes, credentials, or Git commit/push were authorized.
**Release status:** BLOCKED pending formal CPSU approval, isolated staging with trusted HTTPS, and real-device tests.

## Implemented (code only)
1. **Consistent copy:** `apps/web/public/sw.js` now accepts the exact server-approved followed-store body and safe `/transactions/<id>` links. `apps/api/test/push.test.ts` executes the actual service-worker script in a synthetic worker runtime, checking the body and allowed destination.
2. **Subscription ownership:** The authenticated `POST /api/v1/push/subscriptions/status` accepts a private endpoint in a request body (not query string) and returns only `registered: boolean` for the current active user. The client no longer equates an old browser subscription with the current account's enrollment. Login/account changes attempt to detach subscriptions associated with another account. Sign-out sends a current-device endpoint as a fallback to `POST /auth/logout`, where only a valid session can atomically revoke its own subscription with session revocation. Other devices remain enrolled. The push route has account-scoped limits instead of a shared per-campus-IP limit. The global API limit remains IP-based and must be load-tested behind a campus NAT.
3. **Transaction opt-in:** Existing `accountUpdates` preference now explicitly covers important purchase/service-request activity, CPSU affiliation decisions and new listings from followed stores. Critical transaction events are `requested`, `accepted`, `rejected`, `meetup_confirmed`, `completion_confirmed` and `cancelled`. `negotiating` stays in-app only to limit noise. The transaction handler returns the exact durable notification ID from inside its successful transaction, and attempts privacy-safe push **only after commit**. No new preference column or database migration. Dedicated transaction preference would require a separately approved schema change.
4. **Reliability:** Automatically remove expired registrations before delivery and enrollment-count checks, remove 404/410 and untrusted stored endpoints, retry transient 408/5xx/network errors at most once, and never immediately retry provider 429 or credential errors. Process-local aggregate counts and safe per-category error logs help diagnosis without logging user IDs, endpoints, message text or keys. Followed-store fan-out is limited to four concurrent recipients.

## Deliberately unchanged
- In-app notifications are durable and do not depend on Web Push.
- Listing availability and noncritical transaction negotiating changes remain **in-app only**.
- No new table, Prisma migration, queue worker, scheduled tasks, push activation switches or VAPID key rotations.
- Outbound delivery is **best effort** and not a durable outbox. Process shutdown, provider throttling or prolonged outage can still lose a phone alert. An approved persistent queue/outbox is a separate design and migration gate.
- Unsubscribing a previous user's browser may leave a stale server record until expiration or a provider 404/410. The device should no longer receive the prior account's push, but actual cross-browser/device behavior awaits physical tests.
- In-memory counters reset on restart. Central monitoring thresholds and incident response have not been approved or deployed.

## Local verification
- `cd apps/api; bun test test/push.test.ts test/push-policy.test.ts test/push-delivery.test.ts test/store-publication-notifications.test.ts`
- `cd apps/api; bunx tsc -p . --noEmit` (does not regenerate Prisma or apply migrations)
- `cd apps/web; bun run build`
- `cd apps/web; bun test test/followed-store-notifications.test.ts`
- `bun run pwa:check`
- `bun run push:staging:check` (expected BLOCKED until contact/domain approval)
- `bun run push:staging:preflight` (expected BLOCKED by default placeholders)
- `bun run push:staging:templates`
- `git diff --check`

**Integration tests prepared, not executed:** `apps/api/test/integration/push.test.ts` now verifies anonymous denial, account ownership reassignment, and session-authenticated per-device logout cleanup. Do not execute the isolated DB integration harness without a reviewed migration inventory and authorization: its runner can apply *all* pending Prisma migrations to its isolated test schema.

## Staging release acceptance — separate approvals required
- [ ] CPSU authorizes a specific staging domain, hostname operator, approver and approval reference.
- [ ] A real monitored `mailto:` or HTTPS VAPID contact is approved by CPSU, replacing localhost-only contact **without rotating the existing matching keys**.
- [ ] Publicly trusted HTTPS is in place; API is loopback-only behind reverse proxy; secure cookies and exact CORS origin verified on staging.
- [ ] CPSU privacy/DPO signs off explicit user consent wording, endpoint retention/deletion, provider transfer, incident response and logs. Do not invent a retention period.
- [ ] Dedicated synthetic-only staging DB and operating-system identity; encrypted backup and restore rehearsal accepted. Review *every* pending migration separately before any deploy.
- [ ] Source release snapshot reviewed separately from unrelated UI/hierarchy changes and graphify-generated files.
- [ ] Independently authorize subscription enrollment before authorizing outbound delivery. Keep switches OFF otherwise.

## Physical device acceptance (not executed)
**iPhone:** iOS 16.4+; add the approved HTTPS PWA to Home Screen via Safari; use a consenting synthetic account; enable alerts in installed app; lock phone; trigger inquiry, followed-store publication, and critical transaction change from another synthetic account. Verify delivery from the external push relay, safe body, authenticated deep link, badge, opt-out, sign-out and account switch.
**Android:** Repeat on Chrome-installed PWA with lock screen, background/closed app, Focus/DND or disabled notifications, multiple accounts and device unsubscribes.
**Across both:** Verify failure and retry behavior using synthetic/fault-injected tests, and capture approved anonymized evidence. A local `showNotification` preview does not establish actual Web Push delivery.

**No physical iPhone/Android, external push relay, public TLS, or CPSU sign-off has been verified.**
