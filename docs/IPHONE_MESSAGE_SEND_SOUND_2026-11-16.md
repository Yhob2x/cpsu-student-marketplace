# CPSU Market — Historical send-sound prototype (superseded)

> **Superseded on 16 November 2026:** The user approved receiving-only sound. Outgoing Send is now silent; new incoming messages ring in foreground chats and the inbox. Current implementation and checks: `docs/IPHONE_MESSAGE_RECEIVE_SOUND_2026-11-16.md`.

**Updated:** 16 November 2026 — refined to the user's GDSKhera Zedge 'iPhone'/'ting' reference  
**Scope:** Foreground chat send-tap audio in the existing React/Vite PWA.

## User-reported issue

- Sound was audible on PC but lagged behind the send tap because it waited for the asynchronous message POST.
- Sound was silent on iPhone Safari. The old audio path tried to play Web Audio **after** awaiting that POST; Safari may reject audio playback without an immediate user gesture. Device silent mode, volume and WebKit interruptions may also prevent output.

## Updated behavior

- The sound is now an **immediate, original ~580ms 'ting'** with one bright glass-bell strike, soft metallic overtones and a progressively fading tail. The second delayed musical note was removed to produce a cleaner notification character. It begins synchronously when a permitted, non-empty Send/Enter action occurs, before awaiting the API. This is **not confirmation of successful delivery**; the existing error message and Sent/Delivered/Read indicators remain authoritative.
- Safari-compatible first choice: a locally generated, preloaded `data:audio/wav` buffer using `HTMLAudioElement.play()` inside the Send gesture. No external download, third-party service or notification permission.
- If the media element cannot be created or synchronously fails, fall back to layered Web Audio oscillators using the same original bell pitches; interrupted/blocked audio must never prevent sending or report false delivery.
- The conversation has **Sound on/off** and a separate **Test sound** button when unmuted. Test sound is a direct gesture and does not send a message. Browser-local sound preference persists where storage is available, and muting immediately stops current audio.
- No incoming/background push sound is provided. The iPhone Ring/Silent switch, volume, connected headphones/Bluetooth and Safari/WebKit audio restrictions can still prevent speaker audio, even with correct code. Physical testing is required.

## Changed files

- `apps/web/src/message-send-sound.ts`: locally synthesized original one-strike glass-bell WAV (~580ms) with immediate attack and fading overtones; comparable Web Audio fallback. The Zedge file itself is not downloaded, embedded, redistributed or claimed to be licensed for reuse.
- `apps/web/src/pages-account.tsx`: sound starts on the Send gesture; preview control and audio preloading; no API/server changes.
- `apps/web/test/message-send-sound.test.ts`: new sound and mute tests.
- `docs/UI_UX_GUIDELINES.md`, `docs/CHANGELOG.md`: corrected description.

## Verification

- `cd apps/web; bun test test/message-send-sound.test.ts`: **6 focused audio tests** including WAV duration, strike/tail amplitude, send-tap timing, muting, and unavailable browser storage.
- `cd apps/web; bun run build`: **TypeScript and Vite passed**, 48 modules transformed.
- `bun run test`: **46 API unit tests passed**; 3 optional integration suites were skipped by their runners.
- `git diff --check`: PASS.
- iPhone speaker audibility: **not yet verified on a physical iPhone**.

## Manual iPhone acceptance

1. In iPhone Safari, refresh the page or reopen the local Wi-Fi URL (if needed, reload once without stale cache). Open a conversation and turn **Sound on**.
2. Turn up **media volume**, check the physical Ring/Silent switch or Action Button, disable Silent Mode for the test, and disconnect unexpected Bluetooth audio outputs.
3. Tap **Test sound**. It should produce a single bright **“ting”** with a soft fading tail, without creating any chat record.
4. Send a valid test message using a synthetic account. Confirm the click happens immediately on tap, then check the actual message status separately.
5. Toggle **Sound off** and retry **Send**; there should be no sound.
6. If there is still no sound, report iPhone model, iOS version, Safari vs installed Home Screen web app, whether Test sound worked, Silent Mode status and audio output device. WebKit has known intermittent Web Audio/HTMLMediaElement interruption bugs on some iOS versions; avoid claiming a guaranteed browser-side fix.

**Safety:** Did not change database, backend, production/staging release switches, DNS, push credentials or any server. Did not commit or push changes; unrelated WP3 work preserved.
