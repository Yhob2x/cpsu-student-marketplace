# PWA Push Notifications and App Badges — Local Implementation

**Date:** 16 November 2026  
**Project:** CPSU Student Marketplace  
**Scope:** Local React/Vite PWA, Express API and MySQL, one codebase for desktop/Android/iPhone.  
**Status:** Implemented. **Stage 1** applied the local development push migration after a retained backup. **Stage 2** stored persistent VAPID keys privately and verified an isolated localhost HTTPS PWA in Chrome. **No public deployment, real push delivery, or physical Android/iPhone acceptance**. See `docs/PWA_PUSH_STAGE1_LOCAL_ACTIVATION_2026-11-16.md` and `docs/PWA_PUSH_STAGE2_LOCAL_HTTPS_2026-11-16.md`.
**Governing specification:** `MASTER_BLUEPRINT.md` Module 08. Push is classed as a *future-phase* delivery channel by the blueprint; the project owner explicitly authorized developing this enhancement now. Institutional/privacy approval is still required before production launch.

## Architecture

1. Existing in-app notification events remain the source of truth in `Notification`.
2. `notify()` persists an in-app row first, then attempts encrypted Web Push **only if** configured and subscribed. Push errors cannot break messages or review decisions.
3. `PushSubscription` stores each browser's high-entropy HTTPS endpoint and encryption keys, scoped to an authenticated user. `endpointHash` is unique (SHA-256), enabling device reassignment on account switch.
4. `PushPreference` stores per-user messages, listing reviews, account update toggles. No promotional category. Defaults true, but nothing is sent until the user deliberately subscribes.
5. `GET /notifications/unread-count` returns `{ total, messages }` scoped to the session. The header and installed PWA icon may display *all unread notifications*; the mobile Messages tab displays only unread inquiry/reply notifications. Each new inquiry/reply notice records the specific `messageId` so acknowledgments from the conversation's visibility-based `/:id/seen` API clear only those messages actually seen; newer incoming notifications remain unread.
6. The existing `sw.js` shows generic notifications from push events, updates supported badges using `navigator.setAppBadge`, refreshes foreground unread counts, and opens a whitelisted same-origin route on tap.
7. `/notifications` includes an accessible, opt-in settings panel. A student grants permission by clicking a button, can disable this device, and can change each alert category independently.
8. If the user is signed out, message alerts redirect through `/login?next=<safe internal path>`; the whitelist prevents external redirect URLs.

## Private lock-screen content

| Event | Lock-screen text | Destination after authentication |
|---|---|---|
| `inquiry.new` | You have a new marketplace inquiry. | `/inquiries/:id` |
| `inquiry.reply` | You have a new message. | `/inquiries/:id` |
| `listing.decision` approved | Your listing was approved. | `/listings/:id` |
| `listing.decision` other | Your listing has a review update. | `/listings/:id` |
| `listing.suspended` | A listing needs your attention. | `/listings/:id` |
| `affiliation.decision` | Your CPSU account verification has an update. | `/profile` |

No sender names, message bodies, listing titles, private review reasons, student IDs, or email addresses are included in the push payload. Delivery is best-effort; the browser/OS controls lock-screen previews, banner presentation, Do Not Disturb and launcher badge appearance.

## Configuration and activation — manual gate

**Do not put the private VAPID key in ChatGPT, Git, client code, screenshots or publicly reachable files.**

1. Back up the *development* database. The push migration is additive and does not delete existing rows.
2. **Stage 2 completed local key generation** with `bun scripts/setup-local-vapid.mjs --development`. Do **not** rerun the old key-printing generator: the persistent local keys are already in the ignored `apps/api/.env` with restricted Windows ACL. Verify non-secret readiness using `bun scripts/verify-local-vapid.mjs`. Never paste the private key in a chat, public file or issue tracker.
3. The current local `apps/api/.env` contains `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and **development-only** `VAPID_SUBJECT="https://localhost:8443/"`. Before *any public* HTTPS staging or production use, securely change **only** the subject to an approved, monitored `mailto:<your-project-contact>` or real HTTPS contact URL and retain the same private/public pair. Browser push services may reject an inappropriate contact subject. Never expose the private key as a Vite `VITE_*` variable.
4. **Local development migration completed with owner approval on 16 November 2026.** The reviewed additive migration `20261116094000_pwa_push_notifications` is already applied to backed-up `cpsu_marketplace`. Do not rerun it unnecessarily. **Production deployment is not authorized**. See the Stage 1 activation report for backup and verification evidence.
5. Restart the API and production PWA served over HTTPS. Navigate to **Notifications → Phone and desktop alerts** while signed in and choose **Enable alerts**. Browser permission must come from this user action. On iPhone/iPad, install the PWA with Safari **Add to Home Screen** and launch that installed app first.
6. Choose Messages, Listing reviews and Account verification toggles. Use **Disable alerts on this device** to revoke the endpoint on the server and unsubscribe locally.
7. Test with dedicated nonproduction buyer/seller/reviewer accounts, never real students, before switching on production delivery.

Without *all three* VAPID settings, `GET /push/config` returns `enabled: false` and the browser settings show a disabled state. In-app notifications continue to work. No paid notification service, Firebase SDK, Expo, APK, polling-only workaround, or new platform account is required. Actual Web Push still uses the browser vendors' push relay infrastructure.

## Security and privacy decisions

- All push routes require the existing Bearer authentication. Subscription create/delete and preference changes are scoped to `req.user!.id`. Each endpoint is unique by hash; signing into another account and enabling alerts on the same browser transfers the endpoint to that user.
- Invalid or private-origin endpoints are denied, with an HTTPS hostname allowlist of known Apple, Google, Mozilla and Windows push providers to avoid server-side request forgery.
- Subscriptions are capped at 8 per user. Expired/invalid endpoints (HTTP 404/410) are cleaned up. Other delivery failures are logged without endpoint, payload or key data.
- Separate per-IP throttling applies to `/push` routes. All subscription input is validated with Zod.
- Only general notification text appears on the lock screen. The service worker validates destination paths again before navigating, and caches no API responses, private messages or authenticated HTML.
- The Web Push subscription endpoint, p256dh and auth secrets are credential-like personal device data. They must have restricted database access, be excluded from exports/logs, and receive DPO-reviewed retention/deletion rules. User opt-out or expired endpoint cleanup removes associated credentials.
- On sign-out, the frontend attempts to revoke only that device's subscription and clear its badge, preserving other devices. Failed network cleanup requires manual permission/session revocation follow-up; do not assume every remote device is revoked.
- Push attempts are explicitly suppressed in `NODE_ENV=test`. Synthetic tests do not contact real push providers.

## Local verification

- `cd apps/web; bun run build` — TypeScript/Vite production build.
- `cd apps/api; bunx prisma validate; bunx tsc -p . --noEmit` — schema/types.
- `cd apps/api; bun test test/push.test.ts` — provider allowlist, privacy payload, SW notification and safe navigation tests.
- `cd apps/api; bun run test:push:integration` — provision **`cpsu_marketplace_push_test` only**, apply migration, run **7 authenticated tests** with synthetic users and synthetic VAPID keys, including per-message read/notification clearing; no external delivery.
- `bun run test` — existing API unit tests (plus new push unit suite).
- `bun run pwa:check` — manifest, icons and offline-only service worker assets.

**Browser QA:** A signed-in synthetic browser session at 320px, 390px and desktop width confirmed a readable notification settings panel, three preferences, 44px Enable button, independent Messages (2) and Alerts (4) indicators, no horizontal overflow, and a signed-out push deep link to `/login?next=%2Finquiries%2F21`. Screenshot: `docs/qa/pwa-push-settings-390.png` (browser emulation, not a device capture).

**Remaining production acceptance:** actual Android and iPhone Home Screen installation on HTTPS; notification permission, lock-screen banner, Focus mode, launcher badge and OS notification settings; physical-device keyboard and screen-reader QA; real remote push relay verification in a controlled nonproduction environment; server backups, VAPID key management, DPO privacy review and CPSU launch approval.

## Files

- API: `apps/api/src/push.ts`, `routes/push.ts`, `src/audit.ts`, `routes/account.ts`, `src/app.ts`, `src/env.ts`, `prisma/schema.prisma`, `prisma/migrations/20261116094000_pwa_push_notifications/migration.sql`, `apps/api/.env.example`.
- Web: `apps/web/src/push-client.ts`, `push-settings.tsx`, `push-settings.css`, `pages-profile.tsx`, `main.tsx`, `pages-account.tsx`, `public/sw.js`.
- Tests: `apps/api/test/push.test.ts`, `test/integration/push.test.ts`, `test/run-push-integration.ts`; `apps/api/scripts/generate-vapid-keys.mjs`.
