# Mobile conversation viewport polish — 16 November 2026

## Problem
On iPhone Safari, the conversation was a short fixed-height box embedded in a longer page. The last message, typing indicator and reply field required additional scrolling to reach or stay visible.

## Scope
- `apps/web/src/message-motion.css`: mobile/tablet (<=860px) thread uses the visible viewport. Only message history scrolls; the reply composer stays at the bottom, above the existing five-item tab bar. Recent messages and typing appear at the bottom of a short history; old messages remain scrollable. Composer is more compact. The unrelated pages and desktop layout are unaffected.
- `apps/web/src/pages-account.tsx`: follow latest message and typing changes when already at the end of the conversation. Respect intentional scrollback. Observe log resizing for keyboard/rotation changes; on supported Safari viewports, shrink the conversation layout for the onscreen keyboard.
- Existing API presence, typing heartbeat, read receipts, authorization and data handling are unchanged.

## Checks / limits
- Web TypeScript + production Vite build and Git whitespace checks to be run.
- Physical iPhone Safari check is required for keyboard overlay, active typing, long history, touch scrolling and mobile bottom bar. No physical-device acceptance is claimed here.
- No database, migrations, credentials, deployments or Git commits/pushes.
