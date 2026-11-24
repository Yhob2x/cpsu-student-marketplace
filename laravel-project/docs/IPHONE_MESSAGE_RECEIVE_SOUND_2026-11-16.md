# CPSU Market — Sound only for new incoming messages

**Date:** 16 November 2026  
**Scope:** Local React/Vite website/PWA, logged-in Messages inbox and open inquiry conversation.

## Approved behavior

- **Outgoing send: silent.** Clicking Send or pressing Enter no longer plays a sound. Message errors and Sent/Delivered/Read indicators remain independent and truthful.
- **New incoming: 'ting'**. Play one original locally synthesized ~580ms bell tone when a newly received message from the other participant first appears in a foreground, focused conversation (polled approximately every 3 seconds) or the foreground Messages inbox (polled approximately every 5 seconds).
- **No historical rings.** Suppress the first history/inbox load, repeated polls, own messages, hidden/unfocused views and the first refresh after returning from the background. An incoming batch rings once, not for every message. No audio is sent to the server.
- **Optional, persisted sound.** Keep Sound on/off and Test sound controls in both inbox and conversation. A previous sender-sound opt-out is respected if no receiving-sound preference has been saved; subsequent choices use the receiving-sound key. The opt-out persists where browser storage is permitted.
- **iOS user-gesture limitation.** The page silently prepares Web Audio following a real touch/key interaction, so an incoming polling callback can play when Safari permits it. On iPhone, use **Test sound** once to ensure audio is unlocked, and confirm the phone is not silenced or routed to Bluetooth. The browser may still block audio; in-page playback cannot replace genuine lock-screen push notifications.
- **Safety.** No new API, migration, database change, external audio/download, notification permission, push delivery switch, deployment, or Git action. Only authenticated API results in the existing current-user inbox/conversation are used.
- **Resilience.** Inbox polling retains previously loaded conversations if a later refresh fails and shows a retry message.

## Implementation

- `apps/web/src/message-receive-sound.ts` — local bell synthesis, persisted user mute, silent gesture unlock, incoming-only gate, one-ring playback, active Web Audio mute.
- `apps/web/src/pages-account.tsx` — removes outgoing send sound; detects new incoming IDs in foreground thread refresh; adds foreground inbox polling and sound controls.
- `apps/web/src/message-motion.css` — responsive inbox controls and existing conversation tap targets.
- `apps/web/test/message-receive-sound.test.ts` — verifies real WAV, distinct incoming messages, silent outgoing, initial history, background/refocus, repeat polls, batches, mute and browser storage failure.

## Verification status

- Focused sound policy/audio tests: **8 passed, 0 failed** (rerun after final edits).
- React/TypeScript/Vite web production build: **passed** (rerun after final edits).
- Real iPhone Safari audio and synthetic two-account end-to-end test: **pending physical-device verification**.
- The original iPhone-style waveform uses the Zedge 'iPhone'/'ting' listing as a style reference only; no third-party recording has been copied.

## Manual same-Wi-Fi QA

1. Open CPSU Market on a PC (demo seller) and iPhone Safari (different demo buyer), both in the same chat. On iPhone enable **Sound on** and tap **Test sound** once.
2. From iPhone send one valid message. **No sound** should play on iPhone; the PC receives a single 'ting' when its chat refresh detects the incoming message.
3. From PC reply. **No sound** should play on PC; the iPhone should play a single 'ting' when it refreshes and is foreground/focused.
4. Leave iPhone on Messages inbox. Send another synthetic message from PC. Expect one sound and an updated preview within approximately 5 seconds.
5. Refresh or reopen the chat, or return from another app. The existing messages should not ring again.
6. Mute the receiving sound, then receive a new message. No sound should play.
7. This is in-app foreground sound only: Safari on a local HTTP Wi-Fi address is not an approved Web Push/lock-screen notification test.
