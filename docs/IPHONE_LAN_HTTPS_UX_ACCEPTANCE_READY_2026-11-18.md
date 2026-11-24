# CPSU Market — Local HTTPS iPhone/Android UX Acceptance Handoff

**Date:** 2026-11-18 (Asia/Manila)
**Status:** **LAN HTTPS HOST READY; PHYSICAL DEVICE ACCEPTANCE NOT YET RUN**
**Environment:** Authorized Windows local developer PC (DESKTOP-P5OAG7F); trusted home Wi-Fi only
**No public hosting purchased.** No deployment, DNS, public certificates, cloud tunnel or Git push.

## Safe local access and current endpoints

- Local phone URL: `https://192.168.0.133:8445/` (valid only while the PC stays on the same trusted Wi-Fi with those QA terminals running; the address can change when Wi-Fi changes).
- Guarded phone HTTPS gateway: `192.168.0.133:8445`, exposes only the local subnet.
- Production-built React/PWA preview: `127.0.0.1:4173` (loopback).
- Isolated, test-mode Bun API: `127.0.0.1:4400` (loopback; points to `cpsu_marketplace_push_test`, NOT the main `cpsu_marketplace` schema).
- Device setup is limited to the owner's private Wi-Fi, with a previously approved local-only CA. Use no external users or real student records. Do not bypass TLS trust warnings. The test leaf expires **2026-11-30**. The private CA/key files remain under the owner's restricted `%LOCALAPPDATA%\CPSU-Marketplace\iphone-lan-https` directory, not the Git repository.
- `PUSH_SUBSCRIPTIONS_ENABLED=false` and `PUSH_DELIVERY_ENABLED=false` are explicitly set by the isolated API launcher; no Web Push enrollment or remote delivery is authorized.

## Executed checks (PASS, not real device tests)

1. `node scripts/wp3-iphone-lan-readiness-readonly.mjs --read-only --prestart`: all firewall profile, trusted Private Wi-Fi, inbound Bun rule, CA fingerprint, CA and server certificate validity, SAN and private-key ACL checks passed. Local Wi-Fi IP matched the current certificate.
2. `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-iphone-lan-https.ps1 -LocalOnly`: guarded build and LAN-only three-process launch succeeded; TypeScript/Vite build passed.
3. `node scripts/wp3-iphone-lan-readiness-readonly.mjs --read-only`: all checks, including the expected **exact** listener interfaces for ports 4173/4400/8445, passed after launch.
4. `CPSU_IPHONE_LAN_QA=1 CPSU_IPHONE_LAN_IP=192.168.0.133 node scripts/verify-iphone-lan-https.mjs` (set environment appropriately on Windows): all HTTPS endpoint checks passed **with chain validation ON**: homepage, manifest, service worker, Apple icon, API health, public listing GET. Anonymous push configuration HTTP 401 and unexpected Host HTTP 421 were confirmed.
5. `node --test scripts/iphone-lan-preflight-status.test.mjs`: 5/5 passed.
6. `bun run pwa:check`: icons, manifest, Apple metadata, install shortcuts and offline worker contracts passed.
7. The previous P1/P2 real-auth local browser suite passed with 8 checkpoints, including photo publication privacy and mobile chat. The previous keyboard suite passed at 320px and 390px, but desktop emulation is not physical acceptance.
8. A synthetic iPhone QA credentials file exists under the private local QA directory. Its contents and any student credentials were **not read or printed** here.

## Real iPhone Safari user checklist — NOT YET RUN

Use a consenting tester's actual iPhone on the **same trusted Wi-Fi** as this PC. The local CA must already be installed and trusted; if iOS displays a certificate warning, stop and resolve certificate trust locally rather than bypassing security.

- [ ] In iPhone Safari, open `https://192.168.0.133:8445/` and confirm no certificate error and correct CPSU Market homepage.
- [ ] In Safari, Share → Add to Home Screen → Add, then launch the installed CPSU Market icon. Confirm standalone web-app appearance and the correct icon.
- [ ] Check the home indicator, bottom navigation, responsive hero and **View all** button; scroll home/explore without unwanted horizontal scrolling or chat obscuring actions.
- [ ] Open Explore; swipe through Campus and Category chip rows, use edge arrow cues, select filters and confirm search and back navigation behave correctly. **Do not introduce dropdowns.**
- [ ] Open the floating Messages launcher; verify opening, closing, rapid repeated taps, list scrolling, composer position, tap targets and keyboard appearance/disappearance. Check that chat doesn't cover focused inputs.
- [ ] Test at increased iOS text size and with Reduce Motion enabled. Check for clipped labels, overlapping controls or unwanted animation.
- [ ] Turn on VoiceOver if available; confirm major landmarks, buttons, filter selection announcements, chat dialog focus/close, listing card links and save buttons are readable.
- [ ] If using a verified **synthetic** account from the private local QA fixture, confirm sign-in, store and follow behavior only against the isolated test API. Do not use any personal/real student credentials or submit real ID documents.
- [ ] Record device/iOS/Safari version, time, screenshot filename (without sensitive content), pass/fail per case, and any observed defect.

**Do not test Web Push enrollment or lock-screen background delivery here.** Enrollment and delivery are separately gated behind approved public HTTPS staging, institutional/privacy approval and explicit consent. The local HTTPS certificate is not a CPSU-approved public production certificate.

## Physical Android Chrome user checklist — NOT YET RUN

- [ ] Connect an authorized Android phone to the same private network and open the local HTTPS URL with an actually trusted test certificate; never click through an invalid certificate warning.
- [ ] Verify app installation/standalone behavior where supported, navigation and bottom safe area, filter swipe/buttons, floating chat and soft-keyboard layout.
- [ ] With Android's large font size and TalkBack, check focus order, labels, tap targets and unread/selected states.
- [ ] Document make/model, Android and Chrome versions, pass/fail and sanitized screenshots. Mark Web Push/background delivery **not tested**.

## Credentials and privacy

The existing synthetic QA credentials (if needed) stay in a local private file:

`%LOCALAPPDATA%\CPSU-Marketplace\iphone-lan-https\CPSU-iPhone-Safari-QA-credentials.json`

Open it locally on the authorized PC. Do not paste the file or password into ChatGPT, commit it, or transmit it over LAN. The app and API are for synthetic test users only. The existing local dev API port is untouched.

## Stopping LAN QA

Close only the three **CPSU iPhone QA** terminal windows opened by the guarded launcher: the web preview on 4173, the test API on 4400 and the HTTPS gateway on 8445. Verify these ports are closed afterward. Do not stop unrelated development processes on ports 4000/5173.

## Release gate

**READY for the owner's manual physical-iPhone Safari acceptance; NOT approved for public deployment.**
Required next: documented iPhone/Android real-device observations and human assistive-technology checks. Approved public HTTPS hosting, institutional DPO/security decisions, staging migrations and Web Push remain separate future gates.

**Changes in this step:** Local-only QA processes started; production web build regenerated. No main DB migration/write, public server deployment, firewall or trust store mutation, Git commit/push, synthetic credentials disclosure, or push activation.
