# CPSU Market — Stage 5 Web Push Release Safety

**Date:** 16 November 2026 (Asia/Manila)  
**Repository:** `C:\Users\acer\Downloads\cpsu-student-marketplace`  
**Status:** **LOCAL SAFETY CONTROLS IMPLEMENTED; NO PUBLIC STAGING OR GENUINE REMOTE PUSH DELIVERY.**

## Goal and authorization boundary

Following the approved local setup, desktop HTTPS checks and unactivated staging templates, this phase adds a **fail-closed deployment safeguard**. Installing valid VAPID credentials must **never** by itself make devices eligible for remote pushes. A separate approval is required before actual browser push relay delivery. This stage does not approve public hosting, a real CPSU contact, device enrollment, student data transfer, notification permission prompts, or migration/deployment of the main database.

## Two independent default-OFF controls

| Server setting | Default | Purpose |
|---|---|---|
| `PUSH_SUBSCRIPTIONS_ENABLED` | `false` | Whether authenticated users may explicitly register/update their browser device subscription and notification categories. |
| `PUSH_DELIVERY_ENABLED` | `false` | Whether the server may send genuine Web Push messages through external browser push providers. |
| `NODE_ENV` | `development` on local PC | In `test`, synthetic subscription routes can be exercised but **all outbound push delivery is suppressed**, even when both flags are true. In `development`, neither flag can enable enrollment or delivery; the approved staging template uses `production` security behavior against a staging-only database. |

Both flags must be explicitly provisioned as private server environment variables; no switch was enabled in the real local `apps/api/.env`. In-app notifications are unaffected and remain the source of truth.

### API behavior by release phase

| Phase | Enrollment | Background relay delivery |
|---|---|---|
| Local development (current) | Off | Off |
| Isolated synthetic integration tests | On in test runner only | Always off |
| Public HTTPS staging, initially | On **only after approval** | Off |
| Controlled remote device acceptance | On | On **only after separate approval** |
| Production student rollout | Requires independent institutional privacy/security approval | Requires independent institutional privacy/security approval |

Server-side prerequisites for production-mode enrollment include valid matching P-256 VAPID keys, a syntactically valid *public* VAPID contact (no localhost or reserved example domains), secure cookies and an HTTPS-only explicit CORS allowlist. These conditions **do not prove institutional ownership or that the contact is actually monitored**, so human approval remains mandatory. Outbound delivery requires all the same conditions plus its own distinct switch.

With both switches disabled, authenticated `GET /api/v1/push/config` returns:

```json
{ "enabled": false, "deliveryEnabled": false, "publicKey": null }
```

`POST /api/v1/push/subscriptions` and `PATCH /api/v1/push/preferences` return HTTP **503**. Students may still opt out via `DELETE /api/v1/push/subscriptions` (authenticated, owner-scoped). Existing in-app notifications are not disabled. When enrollment is on but delivery off, `GET /push/config` reports `enabled: true, deliveryEnabled: false`, and the UI states that background delivery is paused.

## Implemented files

- `apps/api/src/push-policy.ts`: pure, separately testable policy for valid VAPID pairs, contact syntax, HTTPS CORS allowlist and independent enrollment/delivery gates.
- `apps/api/src/env.ts`: both flags parsed as exact `'true'|'false'` with `false` defaults.
- `apps/api/src/push.ts`: both exported policy states; `deliverPush()` returns before DB or remote service usage unless outbound delivery is expressly permitted.
- `apps/api/src/routes/push.ts`: authenticated config includes `deliveryEnabled`, and enrollment/writes fail closed.
- `apps/web/src/push-client.ts`, `push-settings.tsx`: browser configuration contract and honest paused-delivery status.
- `apps/api/.env.example`, `infrastructure/staging/staging.env.example`: both switches explicitly documented as OFF; real secrets never added.
- `apps/api/test/push-policy.test.ts`: eight unit tests, including invalid contacts, mismatched VAPID keys, HTTP/wildcard origin, insecure cookies, split switches and test/development network suppression.
- `apps/api/test/integration/push-disabled.test.ts`: three authenticated fail-closed HTTP tests using the isolated push test database and a disposable synthetic account. Tests require both switches off and verify 503 and no subscription/preference records.
- `apps/api/test/run-push-integration.ts`: first runs seven preexisting opt-in tests with enrollment on/outbound off, then launches a **separate process** with both switches off for three fail-closed tests.
- `scripts/check-push-staging.mjs`: read-only local check rejects activating release flags in development.
- `scripts/validate-push-staging-templates.mjs`: checks independent default-OFF flags in the staging template and API environment schema.

## Verification results (16 November 2026)

- `bun run test`: **25 unit tests passed, 3 opt-in integration suites skipped by default, 0 failures**.
- `cd apps/api; bun run test:push:integration`: **10 authenticated integration tests passed** — seven opted-in route/permission tests and three explicit gate-OFF tests using `cpsu_marketplace_push_test`. No remote push delivery.
- `cd apps/api; bun run test:integration`: **35/35 marketplace integration tests passed** using the separate `cpsu_marketplace_test` schema (includes the concurrent WP3 transaction test cases). No development or production migrations.
- `cd apps/api; bunx tsc -p . --noEmit`: PASS.
- `cd apps/web; bun run build`: PASS.
- `bun run pwa:check`: PASS.
- `bun run push:staging:templates`: **16/16 checks passed**.
- `bun run push:staging:check`: **expected BLOCKED** — no approved public HTTPS domain, and the development-only localhost VAPID contact has not been replaced. Local release switches remain OFF.

## Safety checks and known limitations

- Matching VAPID P-256 public/private keys are checked without printing secrets.
- The server refuses dangerous contact candidates and rejects localhost or insecure/wildcard production origins.
- A human must still confirm certificate trust, domain ownership, dedicated staging database, approved VAPID contact, privacy, logging, retention and true phone permission/banner behavior.
- The safety policy does not guarantee successful Web Push service delivery or OS badge presentation.
- Real-device testing requires a separately authorized, publicly trusted HTTPS staging origin and consenting synthetic test accounts.
- The opted-in push subscription endpoint remains a secret capability URL; never expose it in screenshots/logs.
- Existing local server processes may need a later controlled restart to load updated source. **No local main API restart** or public staging server was requested by this task.
- No existing `cpsu_marketplace` database migration is required by Stage 5. The isolated integration runner may apply unrelated pending repository migrations to **`cpsu_marketplace_push_test`** only; review such migrations before any staging or real database deployment.

## Acceptance commands

```powershell
cd C:\Users\acer\Downloads\cpsu-student-marketplace
bun run test
bun run pwa:check
bun run push:staging:templates
bun run push:staging:check  # expected to BLOCK while contact/domain are absent
cd apps\api
bun run test:push:integration # isolated local database ONLY
bunx tsc -p . --noEmit
cd ..\web
bun run build
```

**Device result:** Not tested. **Public staging:** Not deployed. **Production:** Not approved. **Private keys:** Remain only in ignored local API environment; no key rotation, contact change, or remote delivery during this stage.
