# CPSU Market — Phase 2 Hardening Acceptance

**Date:** 2026-11-18 (Asia/Manila)  
**Environment:** Authorized Windows local CPSU student marketplace monorepo.  
**Safety:** Synthetic accounts and request-intercepted Playwright data only. No migration, privileged real account, production server, database write, deployment, push activation, Git commit or push was performed as part of this phase.

## Scope and change inventory

| Phase | Files created/changed | What is covered |
| --- | --- | --- |
| P6 — API HTTP security | `apps/api/test/phase2-security-http.test.ts` | Twelve additional Supertest assertions for unauthenticated private endpoints, expired bearer tokens, malformed login/registration, refresh/logout boundaries, mutation rate limits and actual `Retry-After` headers. Uses `createApp()` with requests deliberately rejected **before** private database reads/writes. |
| P7 — Browser flows | `apps/web/playwright.config.ts`, `apps/web/e2e/support/mock-marketplace.ts`, `apps/web/e2e/marketplace.pw.ts` | Six user journeys, each run in desktop and touch/mobile-emulated Chrome. API responses/interactions are synthetic and in memory. A seller's three-photo draft must **not** appear in public browsing before approval. |
| P5 — Component interactions | `apps/web/test/behavior/storefront-and-gallery.test.tsx`, `apps/web/test/behavior/photo-picker.test.tsx`, `apps/web/bunfig.toml`, `apps/web/test/happydom.ts` | Follow/unfollow without slot movement, product/service filter clicks, gallery navigation, floating chat keyboard/badge, photo input selection, cover switching, and rejecting six photos. React Testing Library with happy-dom; no real network or database. |
| P8 — Accessibility | `apps/web/e2e/accessibility.pw.ts` | Nine per-viewport axe WCAG-tagged scans: Home, Explore, listing detail, public storefront, sign-in, Inbox, Notifications, Profile and reviewer workspace. Fail on **critical** violations; does **not** assert zero serious/moderate violations or replace manual accessibility acceptance. |
| P9 — Polling lifecycle | `apps/web/test/behavior/foreground-refresh.test.tsx` | Controlled fake-interval tick tests: mount/unmount cleanup, hidden tab pause and foreground resume, no concurrent polls, retry after failure, disabled state, initial/own/repeated/background messages silent, storage-blocked mute preference. |
| Tooling / safety | `apps/web/package.json`, `bun.lock`, `.gitignore` | Bun-installed dev test dependencies; `test:components`, `test:e2e`, `test:a11y` scripts; generated browser trace/report paths ignored in Git. |

Playwright browser suites use the `*.pw.ts` suffix so the default Bun unit test run does not accidentally execute browser tests. They start an isolated local Vite frontend on `http://127.0.0.1:5189` and intercept all requests to `/api/v1/**` before any backend access. Unknown mutation requests are rejected by the synthetic handler.

## Verification

| Check | Outcome |
| --- | --- |
| Backend full unit/HTTP suite (`cd apps/api && bun test`) | 200 passed, 8 opt-in integration suites skipped, 0 failed, 721 assertions, 49 test files |
| Frontend Bun suite (`cd apps/web && bun test`) | **114 passed, 0 failed, 421 assertions, 32 test files; zero React warnings** |
| Playwright desktop Chrome (`bun run test:e2e --project desktop-chrome` equivalent) | 15 passed: six E2E + nine axe checks |
| Playwright mobile Chrome emulation (`bun run test:e2e --project mobile-chrome` equivalent) | 15 passed: six E2E + nine axe checks |
| Frontend TypeScript/Vite production build (`bun run build`) | Passed |
| Focused new photo picker interaction tests | 2 passed, 0 failed |

These browser results are **synthetic UI acceptance**, not a full integration test of real server-side transactions. Request and auth HTTP tests cover the actual Express middleware but do not create real accounts. Existing API suites already test upload sanitation and limits (`test/upload-security.test.ts`, `test/listing-photo-limit.test.ts`), row scopes (`test/permissions.test.ts`, `test/row-access.test.ts`), chat closure (`test/inquiry-safety.test.ts`), report validation/auditing (`test/report-http.test.ts`, `test/report-safety.test.ts`), and rate budgets (`test/http-request-budgets.test.ts`); their execution was included in the full backend suite.

## Commands

Run at the monorepo root in Windows PowerShell:

```powershell
cd apps/api
bun test
cd ../web
bun test
bun run test:components
bun run build
bun run test:e2e
bun run test:a11y
```

For PowerShell 5.1 wrapper noise, invoke `bun` through `cmd /c` and judge test success by exit code. The `NativeCommandError` wrapper may appear when Bun reports normal status on stderr, even though test exit code is zero.

## Release blockers / deferred hardening

- Eight API integration suites are opt-in and intentionally skipped in ordinary tests. Real MySQL-backed registration/login, concurrent authorization, upload/storage, close/send messaging and reviewer approval acceptance require a *guarded isolated database and explicitly authorized test credentials*. Do not point these tests at the existing CPSU student database.
- Browser auth, uploads, reviewer actions, transactions and notifications were validated against synthetic mocked API state. They do not assert actual persistence, mail delivery, media screening, Web Push or MySQL transaction semantics.
- Mobile browser testing uses Chrome viewport/touch emulation, **not physical iPhone Safari, Android hardware or an installed PWA**; HTTPS staging and institution authorization remain required before release.
- Axe checks enforce **zero critical WCAG-tagged violations only**. Run comprehensive serious/moderate review, screen readers, keyboard, focus, contrast and reflow audits separately.
- Component tests cover high-priority interactions; real browser tests cover sign-in and draft creation. A dedicated DOM-level authenticated registration form test and richer multi-user concurrency tests remain opportunities.
- UI development in the Explore area was modified concurrently by another workflow; Phase 2 did not overwrite or deliberately refactor those files. Test results reflect the current shared working tree.

**No release-ready certification is implied by green synthetic tests.**
