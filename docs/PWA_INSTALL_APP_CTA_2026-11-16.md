# CPSU Market — Install App CTA (PWA)

Date: 16 November 2026. Local development changes only.

## Requirement and scope
The user requested a visible, app-like Download/Install button. The supported artifact is the existing unified React/Vite Progressive Web App, not an APK/IPA, app store listing, or offline marketplace. The existing `manifest.webmanifest`, launcher icons, and offline-only service worker are reused unchanged.

## Implementation
- New shared `apps/web/src/install-app.tsx`: “Install app” action, app icon, platform instructions, installed-app detection. On supporting Chromium browsers, `beforeinstallprompt` is retained and shown only from a direct click. Detects `appinstalled`; hides the promotion for standalone launch. On iOS, tapping displays Safari Share → Add to Home Screen → Open as Web App → Add guidance. On other unsupported browsers, it provides manual browser-menu guidance without a fake download.
- New isolated `apps/web/src/install-app.css`: responsive and accessible install banner matching the established forest-green, ivory and neutral palette.
- `pages-public.tsx`: CTA after Home hero for all visitors; `pages-profile.tsx`: reusable install panel for signed-in users.
- `main.tsx`, `icons.tsx`: stylesheet import and small Download glyph.
- `pages-account.tsx`, `message-motion.css`: current chat polish places active typing in a dock outside the scrollable message history, above the reply composer, so users can scroll older messages while still seeing typing.

## Security and behavior
- No user account access, API calls, notification permission requests, telemetry, download files, local storage, or third-party libraries added for installation.
- The user's phone screenshot shows an HTTP LAN IP `192.168.0.133:5174`. This is not a secure context: a full installable service-worker PWA requires trusted HTTPS on the phone; localhost is a secure-context exception only for the *local* device. The install instructions surface this limitation instead of claiming success.
- Device OS controls the final installed-app prompt and home-screen result. iOS does not support `beforeinstallprompt`.
- The worker continues to cache only the offline fallback and static icons; sensitive marketplace data remain network-only.

## Validation
- Web `bun run build` — TypeScript/Vite passes (local).
- Root `bun run pwa:check` — icons/manifest/SW contracts pass (local).
- Chrome headless on local `localhost:5173`: rendered Home and visible Install app CTA.
- Git diff whitespace check — passes.
- Physical iPhone Safari, Android Chrome install prompts, home-screen launch, keyboard/typing and screen reader checks still require separate device acceptance. No production deployment, database changes, commits, or push.
