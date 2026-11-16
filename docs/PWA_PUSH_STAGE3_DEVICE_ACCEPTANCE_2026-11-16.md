# Stage 3 — CPSU Market PWA Web Push Device Acceptance

**Prepared:** 16 November 2026  
**Status:** TEST PROCEDURE READY — **PHYSICAL AND REMOTE DELIVERY NOT EXECUTED**  
**Scope:** One React/Vite PWA for desktop, Android and iPhone; no APK, Expo, Firebase or payment provider.  
**Prerequisites:** CPSU-approved staging domain and monitored contact, valid publicly trusted HTTPS certificate, isolated nonproduction test accounts, student consent and device access.

## 1. Current blockers

The local read-only `bun run push:staging:check` deliberately reports **BLOCKED** while:

- `VAPID_SUBJECT` remains the development-only `https://localhost:8443/`. An institution-approved, **monitored** real `mailto:` or HTTPS contact URL is required; do not rotate the existing VAPID keypair.
- No approved public HTTPS staging URL has been supplied. The localhost self-signed QA certificate cannot be used on student phones.

No public deployment or real push send is authorized. Do not connect the isolated test database to production or use existing real student accounts.

## 2. Local developer smoke test (no remote push)

After the site is served on an approved HTTPS origin and a **synthetic test account** has voluntarily enabled notifications:

1. Open **Notifications → Phone and desktop alerts**.
2. Select **Enable alerts**. The permission request must originate from the user's explicit button click. Denial must leave in-app notifications working.
3. Once enabled, select **Preview a test alert**.
4. The browser requests a local service-worker notification with generic test text and an internal `/notifications` destination.
5. Check that the banner is displayed (subject to OS Focus/notification settings), and tapping it opens the Notifications page or authentication first.

**Important:** Preview is implemented using `ServiceWorkerRegistration.showNotification`. It does **not** use the push relay, does not prove background delivery, and creates no in-app notification row. A browser may suppress previews when the app is foregrounded or Focus/Do Not Disturb is active.

## 3. Real Android test — physical Chrome-installed PWA

Use a consenting adult tester and a nonproduction account, never a real student's account without authorization.

- [ ] Record device manufacturer/model, Android version, Chrome version, date and test origin.
- [ ] Visit CPSU-approved HTTPS staging; confirm the certificate is trusted without browser warning.
- [ ] Install the PWA via Chrome's **Install app** (or equivalent); verify home-screen label, icon and standalone window.
- [ ] On the installed app, sign in as a synthetic seller; select **Enable alerts** and grant permission.
- [ ] Confirm one subscription is registered to the correct synthetic user. Do not display/log the subscription endpoint or keys.
- [ ] Try the **Preview a test alert** action. Record whether the OS shows a banner; note this is local display only.
- [ ] Lock the device, or background/close the installed PWA.
- [ ] From a second synthetic buyer account, send a legitimate test inquiry to the synthetic seller's approved staging listing. Confirm one background Web Push from the external browser push relay reaches the seller. **Do not use real students, messages or production content.**
- [ ] Tap the banner. Confirm authentication is required if signed out; the correct conversation opens after sign-in.
- [ ] Test reply, listing approved/rejected (reviewer synthetic action), and account-verification events. Confirm all lock-screen bodies omit names, message previews, listing titles and review reasons.
- [ ] Verify unread Messages and Alerts navigation counts and any supported launcher badge. Badge count/appearance may vary by launcher.
- [ ] Read only the first of two new messages; verify the second remains unread.
- [ ] Disable Messages in preferences; confirm message push is suppressed while allowed in-app notifications continue.
- [ ] Disable alerts on the device; verify subscription removal and no new push delivery to that device.
- [ ] Check permission denied, Focus mode, poor network, screen rotation and background app state.

## 4. Real iPhone test — Safari Home Screen web app (iOS 16.4+)

- [ ] Record device, iOS version, Safari version, date and approved staging URL.
- [ ] In Safari, **Share → Add to Home Screen**, then launch the installed CPSU Market icon.
- [ ] Confirm the app displays without the regular browser chrome and bottom navigation respects the Home Indicator.
- [ ] Sign in with a synthetic account; enable alerts from the **installed Home Screen app**, not an ordinary Safari tab.
- [ ] Grant notification permission, and verify the iPhone app notification permission appears in system settings.
- [ ] Use **Preview a test alert** only to check notification appearance, not background delivery.
- [ ] With the app backgrounded or phone locked, trigger a new inquiry from a separate synthetic account. Verify remote Web Push and tap-to-conversation behavior.
- [ ] Check notifications in Notification Center/Lock Screen and app-icon badges where supported; iOS Focus and notification preferences control visibility.
- [ ] Test two unread messages, marking one read, notifications disabled, user sign-out and sign-in again.
- [ ] Test VoiceOver labels, large text, keyboard open/close and the fixed bottom navigation.

## 5. Privacy and failure checks

- Push payloads must be generic, with internal whitelisted destinations only.
- No private message content, sender name, student identifier, listing title or moderation reason in OS notifications.
- No anonymous subscription/push preference writes. Cross-user read, deletion and preference modification must fail.
- New notification rows must persist even if the browser push service is unavailable.
- A revoked or expired subscription must not continue to receive pushes.
- Ensure no private endpoint, VAPID key, test user credentials or captured real student data in logs/screenshots.
- Test with permission denied, browser unsupported, no connection, Focus/Do Not Disturb and app closed.
- Before publicly enabling: CPSU privacy approval, consent copy, retention/deletion rules, secure backups, monitored HTTPS and origin control.

## 6. Device test results — fill in only after real tests

| Evidence | Android result | iPhone result |
|---|---|---|
| OS/browser version | Not tested | Not tested |
| Installed icon and standalone launch | Pending | Pending |
| Explicit notification permission | Pending | Pending |
| Local preview banner | Pending | Pending |
| Genuine background Web Push | Pending | Pending |
| Lock-screen banner | Pending | Pending |
| Tap-to-login/deep link | Pending | Pending |
| Launcher/app icon badge | Pending | Pending |
| Privacy-safe payload | Pending | Pending |
| Disable alerts/unsubscribe | Pending | Pending |
| Accessibility testing | Pending | Pending |
| Tester, date, screenshot/evidence reference | Pending | Pending |

**Sign-off:** Do not mark any device row PASS based on Chrome emulation, unit tests, the local self-signed TLS gateway, or a simulated worker event.

## 7. Safe commands

From the repository root:

```powershell
bun run pwa:check
bun run push:staging:check
# Only when an HTTPS staging URL is separately approved:
node scripts/check-push-staging.mjs --url=https://your-approved-staging-host.example
```

Replace the sample staging URL with an actual approved domain. The readiness checker is **read-only** and only validates syntax and local artifacts; it does not verify DNS/TLS ownership or contact monitoring. Expected to report blockers until approval and configuration are complete.

The local Stage 1 migration and Stage 2 localhost HTTPS report remain separate:
`docs/PWA_PUSH_STAGE1_LOCAL_ACTIVATION_2026-11-16.md` and `docs/PWA_PUSH_STAGE2_LOCAL_HTTPS_2026-11-16.md`.

**Release decision:** NOT APPROVED for public push. The current local development keypair should remain private and unchanged. No new schema migration is required for the preview feature or readiness checker.


## 8. Stage 3 local implementation and verification (16 November 2026)

- Implemented `previewLocalNotification()` in `apps/web/src/push-client.ts`, called only from an explicit **Preview a test alert** button in `apps/web/src/push-settings.tsx` after push has been enabled. It calls `ServiceWorkerRegistration.showNotification` with a generic body and safe `/notifications` destination. It never sends a remote push or stores a notification row.
- Added `scripts/check-push-staging.mjs`, exposed as `bun run push:staging:check` in the root `package.json`. The script is read-only, never prints VAPID secrets, and validates matching keys, Git exclusion, non-local VAPID contact, explicit HTTPS staging URL, manifest, service worker handlers, local preview code and absence of the private key in built web assets.
- Current readiness checker result: **6 PASS, 2 BLOCKED**. Blockers: localhost-only VAPID subject and no approved HTTPS staging URL. Exit code **2** is intentional; it is a **release gate**, not a code error.
- `cd apps/web; bun run build`: PASS (44 transformed modules). `bun run test`: 17 passed and 2 opt-in suites skipped. `bun run pwa:check`: PASS. `git diff --check`: PASS. The normal local API (:4000) and web (:5173) remained reachable, QA ports 4400/4173/8443 closed.
- `cd apps/api; bun run test:push:integration`: 7 passed, 0 failed. **Environment detail:** Because the existing isolated test runner automatically applies all repository Prisma migrations, it also applied a concurrently added `20261116193000_wp3_transactions` migration to **`cpsu_marketplace_push_test` only** during this run. This was *not* a push feature schema requirement; the main development and production databases were **not migrated** by Stage 3. Separate WP3 work was not edited or approved by this task.
- No physical device acceptance, real browser push delivery, public TLS/hosting, monitored VAPID contact or student rollout occurred.

**Next external inputs required:** An owner-approved HTTPS staging domain with a publicly trusted certificate, an approved monitored project contact, and consenting Android/iPhone testers with installed PWAs. Until provided, retain Stage 3 as **prepared but not signed off**.
