# CPSU Market — P1 UX remediation & authenticated/PWA acceptance
Date: 2026-11-18 (Asia/Manila)
Environment: Authorized local Windows development repository; physical-device staging NOT authorized or available.
Release decision: **BLOCKED — do not deploy or enable remote Web Push.**

## Requested scope
Resolve the P1 audit findings without changing marketplace rules: 429 listing failures, chat covering student actions, and homepage photo draft/publish confusion. Prepare and run all feasible local tests and assess the real-account/physical-device acceptance gates.

## Changes made
1. **API request limits** (`apps/api/src/app.ts`): bounded independent per-IP one-minute windows, 300 non-GET operations and 900 GET reads. GET /health is exempt from the two shared budgets to preserve liveness. The pre-existing authentication-specific limiter remains in force. No public API was made unmetered except the lightweight liveness endpoint; no auth bypasses were introduced. This fixes the observed 429 starvation where browsing traffic exhausted login and listing reads together.
2. **Public listing/store recovery** (`apps/web/src/public-resource-error.ts`, `pages-public.tsx`): 429 now tells the user the request budget was reached and to wait about a minute. Genuine 404 retains its distinct unavailable state; ordinary network/server errors retain retry controls.
3. **Mobile floating chat** (`apps/web/src/mobile-chat-dock.css`, `main.tsx`): the existing compact chat launcher retains its yellow visual treatment, popup, notifications, accessibility name, keyboard handling, and guest sign-in redirect. At <=860px, the tabbar reserves space for the launcher so it does not cover page links or cards. The opened chat panel floats above the navigation.
4. **Homepage editor** (`apps/web/src/home-page-content.ts`, `home-page-editor.tsx`, `home-admin-publish.css`): draft/live status is explicit. Text save remains directly after text fields; Publish saved draft is immediately after the three photo inputs, with a state explanation. Draft photos are NOT published automatically; existing revision and dirty-text protections remain.

## Fresh verification evidence
- Focused API request-budget test: 4/4 passed. This includes 305 read requests not starving auth/writes; 302 writes retain 300/minute limit; 902 read requests retain the 900/minute limit. All tests run in-process on synthetic non-existing routes and health; no database changes.
- Full web suite: 83/83 passed, 0 failed (existing React server-render warnings observed; no new failing tests).
- Root API unit suite: 156 passed, 7 intentionally skipped opt-in/isolated integration tests, 0 failed on the final full run (after the bounded-read regression addition).
- Web TypeScript/Vite production build: passed. API TypeScript check: passed.
- PWA validator: passed manifest, icons, maskable icons, Apple metadata, offline-only cache contract.
- Live local GET `/api/v1/listings/23`: HTTP 200; listing and photo gallery rendered after the shared quota remediation. Earlier audit reproduced 429 on the same listing.
- Chrome mobile smoke tests at 320, 390 and 768px: fixed chat launcher is fully inside the reserved tabbar region, overlaps zero bottom-navigation targets, obstructs no page controls, remains >=44x44 CSS px, and causes no horizontal overflow.
- Chrome mobile at 200% root-font sizing (320/390/768): no navigation/chat overlap and no horizontal overflow.
- Synthetic-only browser session fixtures (all network mutations blocked, zero real user changes): student chat opens/closes with empty inbox, university admin sees unpublished homepage state and Publish below photos, campus reviewer sees scoped navigation and no global account/content management.
- Local development push preflight: development enrollment/delivery switches remain OFF. Missing approved public HTTPS staging and monitored VAPID contact are BLOCKED.

## Acceptance matrix
| Journey | Status | Evidence/remaining work |
|---|---|---|
| Guest Home -> Explore -> listing | Local browser PASS | Live listing request 200; repeated GET budget tests pass |
| Guest -> Sell -> sign-in | Previously checked | Return URL preserved; real login still needs staging test |
| Synthetic signed-in Student floating chat | Browser fixture PASS | UI only; not a real authenticated backend session |
| Synthetic Reviewer / University Admin navigation | Browser fixture PASS | UI only; no real role or server authorization acceptance |
| Admin draft photo -> publish -> student view | UI/state PASS; full flow NOT RUN | No publication action performed; approved synthetic staging required |
| Student listing submit -> reviewer approve -> buyer inquiry/transaction | NOT RUN | Needs isolated synthetic accounts and authorized state-changing staging test |
| Physical iPhone Safari PWA install, offline, keyboard, VoiceOver | BLOCKED | No connected accessible iPhone and no approved HTTPS staging origin |
| Physical Android Chrome PWA install, offline, keyboard, TalkBack | BLOCKED | No connected accessible Android test device and no approved HTTPS staging origin |
| Genuine external Web Push while device locked / background | BLOCKED | No authorized public HTTPS staging, monitored VAPID contact, DPO approval, or independent push switches |
| OS badges, permission denial, account switching / sign-out on real devices | BLOCKED | Must be observed on consenting physical phones with synthetic staging accounts |

## Required physical/staging acceptance procedure (once approved)
1. Obtain CPSU-approved staging hostname, publicly trusted HTTPS certificate, responsible operator, monitored VAPID contact, privacy/retention approval, and separate synthetic-only database with reviewed migrations. Keep PUSH_SUBSCRIPTIONS_ENABLED and PUSH_DELIVERY_ENABLED OFF until each is independently authorized.
2. Test with nonproduction buyer, seller, campus reviewer and university-admin accounts. Sign in and out normally (no browser API mocks). Verify review, publish, public visibility, chat, follow, request, acceptance, meetup and completion; record all HTTP/console errors and notification timing.
3. On physical iPhone (Safari Add to Home Screen) and Android (Chrome Install), confirm launcher icon, standalone mode, bottom nav, safe areas, viewport keyboard, focus management, 200% text, VoiceOver/TalkBack, offline fallback and reconnect. Record device model, OS/browser version, date, screenshots and pass/fail.
4. Only after distinct enrollment and delivery approvals, enable a consenting synthetic staging subscription. Lock each device and trigger message, followed-store publication and critical transaction events. Verify generic lock-screen content (no names/private text), click destination, badges, denial, opt-out, logout/account-switch cleanup, stale subscription handling and reliable remote delivery.
5. Re-run security/release preflight; attach evidence and obtain institutional release sign-off. Do not treat local `showNotification` preview or Chrome emulation as remote OS delivery.

## Change controls
- No Prisma migrations, DB writes, student account changes, server-side publication, staff decisions, push enrollment or delivery, hosting/DNS/TLS changes, Git commits, or pushes.
- Existing uncommitted code and mixed working tree were preserved; review the full diff before releasing.
- New repeatable browser scripts: `apps/web/test/mobile-chat-layout.smoke.js`, `mobile-enlarged-text.smoke.js`, `synthetic-role-ui.smoke.js`. Browser fixtures do not authenticate against the actual API.
