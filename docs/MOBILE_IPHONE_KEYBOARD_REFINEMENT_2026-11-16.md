# CPSU Market — iPhone Safari keyboard-focused Messages layout

**Date:** 2026-11-16  
**Status:** CSS implementation validated in synthetic browser QA; real iPhone acceptance pending.

## Goal

Keep the reply input and recent messages visible above the iPhone software keyboard, without requiring the student to scroll the whole page. Preserve the existing forest-green theme, incoming-only `ting` sound, message receipts, typing status, and authenticated backend behavior.

## Root cause observed

The existing `Thread` page already listens to `window.visualViewport` and puts `--chat-visible-height` on `document.body` when the software keyboard obscures the reply. But the app masthead, back link, presence, and Sound on / Test sound / View listing controls still occupied most of that shortened height. The existing input-focus rule also did not reliably hide the bottom tabs in the isolated mobile-browser simulation.

**Before**, with simulated keyboard overlays, message history was ~26px tall at 320×568 and 390×844 viewport sizes, and on some screens the composer extended below the keyboard-visible area.

## Implementation

In **`apps/web/src/mobile-refinements.css`** only, added a keyboard-only compact mode:

- Use the app's existing body `--chat-visible-height` to detect an obscured reply (not ordinary focus, so external keyboard navigation stays normal).
- While the software keyboard is shown, temporarily hide the global masthead, tabbar, back link, presence line and secondary chat actions; retain the participant's short, ellipsized name.
- Keep the chat log as the flexible scroll area; retain the typing dock and the composer at the bottom of the visible viewport. Preserve 48px reply / Send controls and safe-area-aware behavior.
- Provide a compact responsive fallback for phones whose **layout viewport** shrinks rather than relying on the `visualViewport` override.
- Once the reply loses focus and the viewport returns, all hidden navigation and sound controls reappear automatically. The full name remains in the DOM for assistive technologies.
- No JavaScript, API route, backend, database, auth, notification, PWA or Web Push changes were made.

## Synthetic iPhone-scale acceptance

Chrome 157 DevTools mobile emulation using synthetic authenticated API responses intercepted in the temporary QA browser (the browser never called the real student database). A script simulated `visualViewport` height changes and triggered the existing resize listener, focusing and then blurring the reply field.

| Phone viewport | Simulated keyboard | Visible height | Chat history after | Composer bottom | Result |
|---|---:|---:|---:|---:|---|
| 320 × 568 | 260px | 308px | 158px (was 26px) | 304px | Fits |
| 375 × 667 | 290px | 377px | 227px (was 26px) | 373px | Fits |
| 390 × 844 | 340px | 504px | 354px (was 26px) | 500px | Fits |
| 430 × 932 | 380px | 552px | 402px (was 69px) | 548px | Fits |

A 390×844 no-keyboard focus case preserved 361px chat history and the full masthead, tabbar and secondary conversation actions. In every keyboard test the bottom tabbar and secondary actions were hidden only while the simulated keyboard was open, and all controls returned after blur. No horizontal document overflow observed in sampled widths.

## Automated verification

- `cd apps/web && bun run build`: **PASS**, TypeScript and Vite (49 modules).
- Installed Impeccable 4.9.1 context loaded; `.agents/skills/impeccable/scripts/impeccable.cmd detect --json apps/web/src/mobile-refinements.css`: **[]**, no reported issues.
- `git diff --check`: **PASS**.
- Tested using synthetic users/listings/messages only; no database migration, credential changes, deployment, commits, pushes or server config changes.
- Concurrent changes to `apps/web/src/pages-account.tsx` and `apps/web/src/main.tsx` were preserved, not edited by this keyboard refinement.

## Still to validate on the physical iPhone

In iPhone Safari over the authorized same Wi-Fi, open a demo conversation, tap the reply field, check the latest message + typing dots + composer remain above the keyboard, type and send, dismiss the keyboard to confirm Sound / View listing / Back / bottom tabs return. Rotate the phone, test Safari browser vs Add to Home Screen, and optionally VoiceOver or large text. The simulated `visualViewport` results do **not** establish physical iOS WebKit keyboard acceptance.
