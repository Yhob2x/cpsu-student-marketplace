# Concise controls and PWA copy — 19 November 2026

## Scope and design decisions

Applied Humanizer copy-editing and Impeccable distill/clarify/craft-floor guidance to the existing CPSU Market responsive website and installable PWA. Preserved the white/forest-green visual identity, working routes, authorization, notifications, fixed floating chat, and all marketplace behavior.

- Shortened repetitive brand, header, notification, storefront and My Store copy without changing marketplace facts or verification requirements.
- Used the existing IconAction abstraction and accessible icon labels for secondary actions: Explore filter reset, listing pagination, My Store edit, storefront reset, notifications bulk mark read and header activity links.
- Kept the PWA bottom navigation's visible Home, Explore, Sell/Review and Profile labels; these are destinations, not universally obvious glyphs.
- Kept visible text on primary actions, search and form labels, status and validation, moderation, purchases, destructive actions and recovery guidance. Screen-reader names, tooltip titles, keyboard focus, and at least 44px hit targets remain mandatory.
- Added a scoped stylesheet (`apps/web/src/concise-controls.css`) last in the styles import order so pre-existing CSS refinements remain intact.

## Verification

- `bun test` in `apps/web`: 125 passed, 0 failed.
- `bun run build` in `apps/web`: TypeScript and Vite production build passed.
- `bun run pwa:check`: manifest, icons, Apple metadata and service-worker contract passed.
- Playwright `e2e/reflow-keyboard.pw.ts` on mobile Chrome: 9 passed, including reflow at 320px/390px, keyboard and floating-chat clearance.
- Playwright `e2e/accessibility.pw.ts` on mobile Chrome: 9 passed (axe WCAG checks).
- `git diff --check`: passed.

No API, database migration, PWA manifest or service-worker changes. Physical iOS/Android testing, actual installation, safe-area and VoiceOver/TalkBack verification remain release acceptance tasks.
