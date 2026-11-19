# CPSU Market — Physical-device and assistive-technology acceptance
**Date:** 19 November 2026  
**Status:** **NOT EXECUTED / NO PHYSICAL PHONE CONNECTED.** Automated Chrome emulation does not satisfy these gates.

## Prerequisites
- Use a test/staging deployment served over **HTTPS** for real PWA installation, Service Worker and Web Push acceptance. A phone visiting a PC's local HTTP LAN IP is **not** a secure origin; localhost exceptions apply only to that device itself. Do not expose a development API or production identities just to enable a test.
- Create authorized **synthetic student, seller, reviewer and administrator** accounts and non-sensitive listings. Keep push VAPID keys and credentials out of screenshots and reports.
- Record device model, OS version, browser version, precise staging origin, build/commit, test account role, result, reproducible steps and timestamp. Store no real personal IDs or private student messages in evidence.

## Android Chrome + TalkBack matrix

| Test | Required result | Status |
|---|---|---|
| Install PWA through Chrome's install flow | Correct CPSU icon/name, standalone launch and start page | NOT VERIFIED |
| Offline after one online visit | Understandable offline shell; no infinite loading/error loop | NOT VERIFIED |
| Reconnect and refresh | Previously selected tab/context is safe; data catches up | NOT VERIFIED |
| Allow, deny and later revoke push permission | Clear permission explanation and recovery; no push without consent | NOT VERIFIED |
| Push notification with app backgrounded and locked | Correct banner, title/body, and opening the relevant in-app destination | NOT VERIFIED |
| TalkBack linear and landmark navigation | Descriptive button names, logical reading order, no focus traps except modal | NOT VERIFIED |
| Increase Android font size / display size | No clipped forms, actions or navigation at large system settings | NOT VERIFIED |
| Keyboard and external-switch navigation | Search, gallery, seller chat, transactions and modal can be completed without gestures | NOT VERIFIED |

## iPhone Safari + VoiceOver matrix

| Test | Required result | Status |
|---|---|---|
| Safari → Share → Add to Home Screen | Correct icon/name, standalone launch and safe-area padding | NOT VERIFIED |
| iOS web push (installed app on supported iOS) | Permission requested from user action; app receives visible banner/lock-screen push after consent | NOT VERIFIED |
| Offline and reconnect behavior | Understandable offline shell, safe retry, updated state when online | NOT VERIFIED |
| VoiceOver rotor and swipe navigation | Headings, links, buttons, fields, status messages and modal labels announced correctly | NOT VERIFIED |
| Safari text zoom / Larger Text settings | No overlapping controls, hidden validation or clipped action buttons | NOT VERIFIED |
| Gallery zoom/swipe vs page scroll | Gallery gesture stays in viewer, close restores focus and scroll position | NOT VERIFIED |

## Windows Narrator / keyboard matrix

| Test | Required result | Status |
|---|---|---|
| Narrator or NVDA reading order | Logical headings/landmarks and correct form labels | NOT VERIFIED |
| Tab, Shift+Tab, Enter, Space, arrows and Escape | Keyboard reaches all actionable controls, modal trap/restore works | NOT VERIFIED |
| High contrast, 200% browser zoom and reduced motion | Visible focus, readable content and no horizontal document overflow | AUTOMATED CHROME COVERAGE ONLY |

## Authorized-account journeys

Verify real role authorization independently of synthetic Playwright fixtures: student listing discovery, messaging, save, transaction request and completion; seller listing management; completed-purchase-only rating; reviewer assignment, review decisions and permissions; admin campus/category actions and suspension/reinstatement. Record HTTP and UI error/success states with masked synthetic IDs. **None of these live authenticated acceptance steps have been run in this audit.**

## Existing automated coverage (not device sign-off)
- Run from `apps/web`: `bun test`, `bun run build`, and `bunx playwright test --config=playwright.ui-audit.config.ts --output=../../.tmp/ux-device-preflight`.
- From repository root: `bun run pwa:check`. These check code, browser emulation, assets, accessibility rules and local synthetic fixtures only.
- For outstanding CSS declarations: `cd apps/web && bun scripts/css-scale-review.cjs` for a summary, `--json` for exact selectors. `--strict` currently fails by design until every candidate has been addressed or an approved scope decision made.

**Release decision: HOLD** until the real-device, screen-reader and authorized-role matrices above are executed and signed off.
