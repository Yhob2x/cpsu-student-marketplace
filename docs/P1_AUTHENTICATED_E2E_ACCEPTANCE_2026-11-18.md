# CPSU Market — P1 Real-Authentication and End-to-End Acceptance

**Date:** 2026-11-18 (Asia/Manila)  
**Environment:** Local Windows PC, Bun 1.4.4, dedicated MariaDB schema `cpsu_marketplace_test`  
**Result:** **LOCAL AUTHENTICATED ACCEPTANCE PASSED; PUBLIC / PHYSICAL-DEVICE RELEASE REMAINS BLOCKED.**

## Scope and safeguards

This follow-up extends `docs/P1_UX_AUTH_PWA_ACCEPTANCE_2026-11-18.md`. It closes the previous **real authenticated testing** gap with actual login credentials generated solely for synthetic fixtures, actual Express and MariaDB queries, and actual React pages. No browser API mocking is used for the final browser journey.

- The isolated runner checks that the configured source points to **local `cpsu_marketplace`**, then derives `cpsu_marketplace_test`. Destructive fixture reset additionally demands `NODE_ENV=test`, `CPSU_INTEGRATION_TESTS=1`, `MEDIA_STORAGE=local`, and a dedicated temporary upload directory.
- Both browser-acceptance servers bind only to `127.0.0.1` (API port 4011 and Vite port 5187). The ordinary development server at 4000/5173 is untouched.
- The browser runner requires explicit `CPSU_BROWSER_ACCEPTANCE=1`; the normal Vite config is unchanged. Test-only Vite config proxies requests to the synthetic API.
- Real Web Push enrollment and outbound delivery are explicitly disabled. No external push provider, third-party identity provider, or real student account was used.

## Findings resolved in this follow-up

**A. Outdated stress acceptance:** The existing stress test expected `/health` to return 429 after 300 GETs, contradicting the previously approved split-limit design. It failed during the first isolated full runner execution. The test now verifies the real 900/minute GET budget, unchanged liveness access, and separation from the bounded write quota. The stress suite now passes (4/4).

**B. Incomplete synthetic fixture cleanup:** The new real end-to-end scenario created actual `StoreFollow` rows. Their foreign key blocked cleanup of `SellerProfile`. The guarded fixture reset now deletes `StoreFollow` records before deleting seller profiles. The full isolated runner subsequently passed.

**C. Orphaned temporary Windows test server:** The first browser test run passed but its shutdown left a Bun/Vite subprocess listening. The test-only harness now terminates the child process tree while the parent shim remains alive, checks that both loopback ports are closed, checks eight sensitive synthetic database table counts are zero, and fails if cleanup is incomplete. A subsequent full browser run passed with both ports closed.

## Full isolated MySQL integration verification (final rerun)

| Suite | Result |
|---|---:|
| Existing Stage 1 API, authorization and transaction cases | 41 passed, 0 failed |
| New real-login student→seller→reviewer→transaction and admin publishing scenarios | 2 passed, 0 failed |
| Public report authorization | 4 passed, 0 failed |
| Conversation closing and privacy | 4 passed, 0 failed |
| Concurrent conversation stress including bounded rate limit | 4 passed, 0 failed |
| **Total** | **55 passed, 0 failed** |

The isolated schema migrations were deployed in the designated **test-only** database by the existing guarded integration runner. The final integrity audit reported no orphan rows for its checked foreign keys. The main `cpsu_marketplace` schema was not migrated or changed by this acceptance work.

### New real-login HTTP coverage

`apps/api/test/integration/authenticated-journey.test.ts` verifies an actual authenticated buyer follows a store, the seller creates a draft and uploads an image, the campus reviewer publishes after explicit photo attestation, the follower receives an in-app notification, buyer/seller messaging works, both users approve meetup and completion, the physical listing becomes sold, and university administration can monitor transaction status without private correspondence. A separate scenario checks that only the university admin can publish a homepage draft and that guest content does not update prematurely.

## Real React browser acceptance

Command (from `apps/api` on the authorized PC):

```cmd
set CPSU_BROWSER_ACCEPTANCE=1
bun test/run-isolated-browser-acceptance.ts
```

The test-only runner is destructive **only inside the dedicated isolated synthetic test database**; do not run concurrently with other isolated test suites. It requires an already migrated `cpsu_marketplace_test` schema.

The latest runner exited **0** and reported six browser checkpoints:

1. Guest opened an actually published synthetic listing.
2. Buyer signed in using real credentials, restored the session, followed the store, and used floating chat.
3. Seller signed in and saw the private follower list updated.
4. Campus reviewer signed in and saw a campus-scoped review workspace without university-management controls.
5. University admin signed in, saved homepage copy as a draft, and published it using actual UI actions.
6. Guest saw the changed published homepage.

No endpoint response was mocked. Browser source was served using the same Vite 6.4.6 version as the web build. The runner cleared synthetic users, sessions, sellers, follows, listings, homepage drafts, transactions and notifications, and verified both temporary ports closed.

## Non-integrated build and PWA checks

- API ordinary unit suite: **164 passed, 8 intentional opt-in skips, 0 failed**.
- Frontend unit suite: **83 passed, 0 failed**.
- API TypeScript `tsc -p . --noEmit`: passed.
- Frontend `bun run build` (TypeScript + Vite): passed.
- PWA static validation: passed all manifest, icon and offline-contract checks.
- Push staging preflight: **blocked by design** due to absent approved public HTTPS origin and approved monitored VAPID contact; development push switches remain OFF.

## Remaining independent release gates

1. **Physical iPhone Safari acceptance:** Install from Safari, verify standalone app, keyboard/viewport/safe areas, 200% text, VoiceOver, offline and rejoin behavior.
2. **Physical Android Chrome acceptance:** Install, TalkBack, large text, background/foreground behavior, notification permission and offline recovery.
3. **Real approved HTTPS staging:** Institutional hosting authorization, trusted TLS, monitored VAPID contact, DPO/privacy and retention approval, dedicated staging database with review of every pending migration.
4. **Genuine push relay delivery:** Separately authorize device enrollment and remote delivery, use consenting synthetic accounts, verify locked-screen delivery, badges, privacy-preserving payloads, and account-switch cleanup.
5. **Final release sign-off:** Complete real physical-device and authorized HTTPS acceptance before rollout. Passing local API/browser acceptance does **not** prove real OS notifications.

## Source and evidence

- Added `apps/api/test/integration/authenticated-journey.test.ts` and added its sequential execution to `apps/api/test/run-integration.ts`.
- Updated `apps/api/test/integration/inquiry-close-stress.test.ts` to align with approved bounded GET/write behavior.
- Updated isolated test cleanup in `apps/api/test/integration/fixtures.ts`.
- Added `apps/web/vite.acceptance.config.ts`, `apps/web/test/real-auth-browser-acceptance.smoke.js`, and guarded orchestrator `apps/api/test/run-isolated-browser-acceptance.ts`.
- Local logs in `.tmp/p1-next-real-auth-integration.log`, `.tmp/p1-real-browser-journey.log`, `.tmp/p1-real-browser-close.log`, `.tmp/p1-next-web-test.log`, `.tmp/p1-next-api-unit.log`, `.tmp/p1-next-web-build.log`, and `.tmp/p1-next-push-block.log`.
- No Git commit/push, main database migration, production deployment, real-person data modification, external Web Push, or changes to normal development port listeners.
