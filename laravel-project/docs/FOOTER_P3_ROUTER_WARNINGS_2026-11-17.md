# CPSU Market — P3 Mobile Footer and React Router Future Flags

**Date:** November 17, 2026 (Asia/Manila)  
**Scope:** Next low-risk improvements following P0 listing discovery recovery, P1 error/retry handling, and P2 Sell login return.  
**Authorization:** Local source-only UX and compatibility refinements. No migration, external deployment, production connection or student data modifications.

## Baseline (real local page, Playwright Chrome)

- Footer on `/guidelines` measured **399px** at 320px and 360px, **382px** at 390px, 768px and 860px.
- 92px of the initial footer height was reserved below content for clearance above the fixed 66–68px mobile tab navigation.
- The mobile footer repeated an introductory description and a second institutional branding line; it already offered the required Help and role-specific utility links.
- Browser console showed two React Router v6 future-flag warnings: `v7_startTransition` and `v7_relativeSplatPath`.

## Implemented

- `apps/web/src/footer-refinements.css`: reduce mobile footer padding and trim redundant introduction/second metadata line. Keep the logo + CPSU name, listing review/payment-handoff safety notice, copyright, and the three guest utility links. Keep all account-specific links rendered by the existing footer component. The 44px minimum link targets and keyboard focus treatment remain. Lower bottom clearance from 92px to 80px, still higher than the 66–68px fixed tab.
- `apps/web/src/main.tsx`: enable existing compatible React Router v6 flags on `BrowserRouter` without upgrading dependencies. Preserve absolute NotFound links and the dashboard login redirect.

## Acceptance

- Playwright browser checks at CSS widths **320, 360, 390, 768, 860, 1280px** passed. No document horizontal overflow.
- Mobile/tablet footer heights: **257px** at all 320–860px widths (vs initial 399px at 320/360 and 382px at 390–860). Desktop remained 288px at 1280px.
- All mobile/footer links maintained **44px measured height**. Footer base stayed above the fixed bottom navigation at page end. Footer safety notice remained visible.
- React Router future-flag warnings: **0 after change**, down from 2 before.
- Route smoke: unknown URL shows Not Found, Explore link opens Explore, guest Sell preserves `/dashboard` as sign-in return URL. All passed.
- `bun run build` (web TypeScript + Vite): passed.
- `bun test test/site-footer.test.tsx test/auth-return.test.ts test/profile-presentation.test.ts`: **15 passed, 0 failed**.
- `git diff --check`: passed.

## Boundaries

- No edits to account roles, API routes, database records, seller media, authentication credentials, Playwright test fixtures, migrations, PWA registration or package manifests.
- Existing unrelated uncommitted changes were preserved. No Git commit, push or deployment.
- Read-only desktop/browser emulation does not certify physical iPhone Safari, Android Chrome, VoiceOver, installed-PWA safe-area behavior, or on-screen-keyboard interactions. Those remain separate device acceptance checks documented in `docs/DEVICE_ACCESSIBILITY_ACCEPTANCE_2026-11-12.md` and the iPhone Safari QA documents.
