# CPSU Market — Stage 2 Local VAPID and HTTPS PWA QA

**Date:** 16 November 2026 (Philippines)  
**Device:** `DESKTOP-P5OAG7F` via Remote Desktop Commander  
**Repository:** `C:\Users\acer\Downloads\cpsu-student-marketplace`  
**Approval:** User requested continuation of the secure VAPID configuration and controlled HTTPS/device testing work.  
**Status:** Local configuration and desktop-browser HTTPS tests **PASS**. Public HTTPS hosting, real push delivery and physical mobile acceptance **NOT COMPLETE**.

## 1. Secret handling — complete locally

- Created one persistent P-256 VAPID keypair directly in existing Git-ignored `apps/api/.env`, without displaying or transmitting the private key.
- Source: `apps/api/scripts/setup-local-vapid.mjs --development`, guarded to local `127.0.0.1/localhost` and `cpsu_marketplace` only. Rerunning does not rotate a configured pair or overwrite a partial configuration.
- Independent `apps/api/scripts/verify-local-vapid.mjs` confirmed valid key lengths and *cryptographically matched* P-256 private/public keys; verified Git ignores `.env`. Short public-key SHA-256 fingerprint: `948c1c412b77` (not a secret).
- Restricted `.env` file ACL to the current Windows user, Administrators and SYSTEM; removed inherited permissions. Did not change any existing DB password or JWT secret.
- Local-only `VAPID_SUBJECT="https://localhost:8443/"` is **not a real monitored contact**. Replace it with a legitimate monitored mailto URL or HTTPS contact link before any public staging/deployment.
- Keys remain in the *local* untracked `.env`; no new credentials have been committed, pushed, exported to browsers or pasted into documentation. The existing main development server on port 4000 was not restarted, so it may still have the previous environment loaded.

## 2. Local-only HTTPS infrastructure — complete for QA

- Created a **7-day self-signed localhost certificate**, CN `localhost`, SAN `localhost` and `127.0.0.1`; expires **23 November 2026 02:45:30 GMT**.
- Certificate and private key live **outside the repository** under `%LOCALAPPDATA%\CPSU-Marketplace\staging-tls`; private key has restricted Windows ACL. A system-wide trusted root certificate was **not** installed.
- Reproducible certificate setup: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-local-https-cert.ps1 -LocalOnly`.
- `scripts/local-https-pwa-staging.mjs` serves a localhost-only HTTPS gateway on `127.0.0.1:8443` when `CPSU_LOCAL_PUSH_QA=1` is set. Static Vite preview assets proxy to `127.0.0.1:4173`; API routes proxy to `127.0.0.1:4400`. Only local `Host` values are accepted; the proxy has fixed upstream destinations.
- `apps/api/test/run-local-https-push-api.ts` provides an explicitly loopback-bound QA API on `127.0.0.1:4400`, pointed *only* to `cpsu_marketplace_push_test`, with `NODE_ENV=test` and outbound push delivery disabled. The listener and unauthorized API response were verified.
- The initial temporary API process used the regular application listener, which was not explicitly loopback-bound; that QA process was terminated. The replacement launcher is bound to `127.0.0.1` and was verified via `Get-NetTCPConnection`.
- The HTTPS certificate is **self-signed**. Chrome was launched in an isolated headless QA profile with a certificate-bypass flag **for that temporary session only**. This must **not** be used for CPSU students or claimed as a production TLS/phone test.

## 3. Browser verification (localhost HTTPS, no student accounts)

| Check | Result |
|---|---|
| HTTPS origin is a secure context | PASS |
| PWA service worker controls the page | PASS |
| Browser PushManager and Notification APIs | Available |
| Browser Badging API | Available (actual launcher badge not tested) |
| Notification permission | `default` (no prompt triggered) |
| Chrome PWA manifest errors | None |
| Chrome PWA installability errors | None |
| SW CacheStorage inspection | Only `offline.html` and five static icon assets |
| 320px, 390px, 768px, 1024px, 1440px | No document-level horizontal overflow |
| App navigation | Bottom navigation on mobile widths, hidden on desktop |
| `/notifications` while signed out | Redirected to `/login?next=%2Fnotifications` |
| HTTPS `/health` | HTTP 200 |
| HTTPS `/api/v1/push/config` without session | HTTP 401 |

**Not verified:** actual browser push subscription, consent prompt, vendor push-service delivery, actual OS lock-screen banner, launcher icon badge count, background wake-up when the PWA is closed, and installation on a physical Android/iPhone. Those require separate user-facing device acceptance in an approved HTTPS environment.

A disposable synthetic account in `cpsu_marketplace_push_test` was created for optional sign-in tests and then deleted together with its temporary credentials. Automated browser sign-in was blocked by an environment safety control and was **not bypassed**. Authenticated subscription and preferences were instead covered by the existing isolated HTTP integration tests. No messages or push subscriptions were created for real students.

## 4. Regression verification

- `bun run test`: **17 unit tests passed**; two opt-in integration suites intentionally skipped.
- `cd apps/api; bun run test:push:integration`: **7/7 passed**, synthetic subscriptions/permissions, isolated `cpsu_marketplace_push_test`.
- `cd apps/api; bun run test:integration`: **24/24 passed**, isolated `cpsu_marketplace_test`.
- `cd apps/api; bunx tsc -p . --noEmit`: PASS.
- `cd apps/web; bun run build`: PASS.
- `bun run pwa:check`: PASS.
- `git diff --check`: pending final check at closure.

No production or development database migration was run in Stage 2; Stage 1 had already applied the push migration to the development database. No real push notification was sent.

## 5. Follow-up gates

1. Obtain an approved monitored CPSU project contact email or HTTPS contact URL, and **replace the localhost-only VAPID subject**. Do not rotate the private/public pair unnecessarily.
2. Obtain approved staging HTTPS domain, valid publicly trusted TLS certificate, DNS and hosting, with explicit deployment permission. Do not use the self-signed `localhost` test cert on devices.
3. Use *synthetic, consented test accounts* and installed mobile PWA to verify Android Chrome and iPhone Safari (iOS 16.4+) permission requests, lock-screen banners, notification taps, app icon badges and app state restoration. Capture device/OS/version and screenshots; respect OS-level privacy settings.
4. Complete privacy, retention, browser push relay delivery, server backup/recovery, and CPSU governance/production acceptance before enabling real-student notifications.

**Safety:** No GitHub commit/push, public deployment, production migration, paid external service, VAPID key disclosure, or real student notification was undertaken. Temporary QA HTTPS/API/browser processes are shut down after testing; private local keys remain retained for authorized future local testing.
