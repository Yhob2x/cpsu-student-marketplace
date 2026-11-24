# CPSU Market — Physical iPhone Safari Conversation Acceptance Runbook

**Date:** 2026-11-17
**Device acceptance status:** **BLOCKED; not executed on physical Safari**.
**Test scope:** private home Wi-Fi, synthetic buyer and seller identities, isolated QA database only.

## Read-only environment check (performed)
Command: `node scripts/wp3-iphone-lan-readiness-readonly.mjs --read-only --prestart`.
- Passed: single local Wi-Fi interface; valid server certificate, CA chain, matching local-IP SAN and private-key ACLs.
- **Blocked:** Windows Defender Firewall disabled for all three profiles (Domain, Private, Public), and Wi-Fi categorized **Public**, not Private.
- Check returned **2 / NOT READY**. This does not prove personal home-network trust, external access, or actual Safari functionality.
- The connected remote device is Windows; there is **no attached physical iPhone Safari session** to inspect/control. No HTTP gateway, firewall changes, account creation, credential reset, network policy changes or iPhone CA installation were initiated.

## Owner-controlled prerequisites — before any testing
1. Verify this is a **trusted, personally controlled home Wi-Fi**, not a university/campus/public network. If it truly is the home network, change Windows Wi-Fi network profile to **Private** in Windows Settings.
2. Turn ON Windows Defender Firewall for Domain, Private and Public profiles. An isolated inbound exception, if necessary, must allow **TCP 8445 only from the personal iPhone's current local IP**, not all devices. API port 4400 and web preview port 4173 must remain loopback-only; audit unrelated dev ports (4000, 5173). Do not broaden the firewall rule.
3. Re-run the read-only readiness checks before any service startup. Use `node scripts/wp3-iphone-lan-readiness-readonly.mjs --read-only --prestart`. Refuse startup on any blocker. Have the owner approve any currently active legacy gateway shutdown; do not kill unknown processes.
4. Provision **two dedicated synthetic student accounts** and one approved synthetic listing only through the approved isolated QA process. No deleted-demo credentials, real student identities, student email addresses, private photos or production records. The prior readiness audit showed no QA users; reverify current counts. Never expose passwords in chat or screenshots.
5. Use `scripts/start-iphone-lan-https.ps1 -LocalOnly` **only after** network/security and QA-identity preconditions pass. Verify TLS end to end with `scripts/verify-iphone-lan-https.mjs` and no certificate bypass. Existing local CA profile and short-lived leaf cert are test-only; the leaf expires **2026-11-30**.
6. On the **owner's personal iPhone**, install only the local `CPSU-Local-Dev-CA.cer` public certificate if explicitly comfortable with the risk of trusting a new root CA. Confirm the trusted CA SHA-256 fingerprint from `docs/WP3_GATE_C3_IPHONE_SAFARI_READINESS_2026-11-16.md`. Never export a private key, bypass Safari TLS errors, or install this CA on another person's/school-managed phone.
7. Connect phone to the same trusted home Wi-Fi and open the LAN HTTPS site in **Safari**. Do not use the test setup on school/public Wi-Fi. Verify buyer login and seller login on separately authenticated browsers/devices.

## Physical device acceptance checklist — all pending
**Record** phone model, iOS version, Safari vs Home Screen PWA mode, viewport size, network and relevant sanitized screenshot/video for each failure. Do not store raw credentials or private conversations.

- [ ] HTTPS opens in Safari without warnings or bypasses; correct icon, home-screen install, safe navigation/back.
- [ ] Conversation inbox loads with the buyer/seller synthetic accounts; matching listing card appears at start, followed by messages.
- [ ] Seller receives a new buyer message; sender stays silent, recipient alert sounds once only after audio is enabled by user gesture. No sound on page history load or return from background.
- [ ] Messages align left/right correctly, sent/delivered/read receipts are accurate, no overlap at 320, 375, 390, and landscape widths.
- [ ] Typing dots and scoped active-in-chat status appear only when the other party is actually in that chat, and disappear after the other party leaves or heartbeat expires.
- [ ] On tapping the message input, iOS keyboard does not cover the composer or send button; messages remain scrollable, the current typed message stays visible, and no page-wide accidental scroll occurs.
- [ ] Scroll to old messages while the other student types or sends; a new incoming message does not unexpectedly force the reader away from history. Returning to bottom is clear.
- [ ] Two fast sends, duplicate taps, network loss/reconnect, tab background/foreground and Safari reload do not duplicate messages or mark unread as read falsely.
- [ ] Confirm the End conversation action is reachable without hiding message content; cancel leaves it open. Confirm once; both participants see **Closed** and cannot send further messages.
- [ ] After close, old messages remain readable, no typing/active status is displayed, and repeat close is idempotent. Attempts to restart inquiry on same listing are refused.
- [ ] VoiceOver navigation: all inputs and actions have meaningful labels, focus/reading order works, and live status changes are announced without duplicates.
- [ ] iOS Larger Text / 200% zoom, portrait, landscape, bottom home-indicator safe area and reduced-motion setting do not make controls inaccessible.
- [ ] Third unrelated synthetic account cannot read or close the buyer/seller thread.

## Cleanup and release gate
Shut down the test-only listener processes and verify ports 8445/4173/4400 are no longer listening. Revoke/delete only the specifically authorized synthetic QA accounts, sessions and test-only images after reviewing dependencies. Remove the iPhone's local test CA profile and full SSL trust. Restore firewall to protective state; never leave it disabled. Archive only sanitized acceptance results.

**Release decision:** Physical Safari acceptance **NOT PASSED** until the owner executes the above on a real iPhone after passing security preflight. Desktop/emulated WebKit and backend MySQL tests must never be represented as physical iPhone verification.

## 2026-11-17 — owner prestart PASS verified independently
The owner provided the final `--read-only --prestart` output reporting `WP3 IPHONE LAN PREFLIGHT: LOCAL HOST CHECKS PASS`. The remote PC independently reran the same command: **exit 0**, with all Windows Firewall profiles enabled, Wi-Fi categorized Private, and existing certificate chain/leaf/SAN/ACL checks passing. This supersedes the *historical* "blocked" host-network observations above, not the uncompleted physical-device tests.

**Remaining readiness prerequisites:**
- QA listeners `8445`, `4400`, and `4173` were **not** running. Developer API `0.0.0.0:4000` was present; it must not be repurposed or exposed as the phone QA API.
- No active enabled inbound firewall allow rule was found for TCP `8445`. Configure a **Private-profile, port-8445-only, exact personal-iPhone LAN IP** rule after confirming the phone's IP on the same trusted home Wi-Fi; no broad subnet/all-address exceptions.
- The isolated `cpsu_marketplace_push_test` database has its required six completed migrations and 24 tables, but **0 users, sessions, listings, transactions, transaction logs**. Synthetic test-only buyer/seller identities and a listing require separate authorization before writes.
- A real iPhone Safari interaction, installation, keyboard/scroll/VoiceOver acceptance, and cleanup are all pending.

No firewall rule, phone profile, test identity, DB row, listener, commit or deployment was changed by this verification. Do not start the LAN launcher until the narrow inbound-rule and synthetic identity gates are satisfied.
