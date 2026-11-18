# CPSU Market — Continued Real-Login P1/P2 UX Acceptance

**Date:** November 18, 2026 (Asia/Manila)
**Environment:** Authorized local Windows PC, Bun, React/Vite and Express/MariaDB
**Outcome:** **LOCAL AUTHENTICATED UI ACCEPTANCE PASSED. Physical-device / HTTPS staging still blocked.**

## Goal and isolation

Continue the previous P1/P2 UX remediation acceptance (mobile floating chat, photo publishing workflow, Explore chip navigation, staff mobile hierarchy and advisory listing readability) against the real React app and actual HTTP authentication, not only mocked browser state.

The guarded runner `apps/api/test/run-isolated-browser-acceptance.ts` uses synthetic logins exclusively on loopback ports 4011/5187 and the dedicated `cpsu_marketplace_test` schema. It requires opt-in `CPSU_BROWSER_ACCEPTANCE=1`; resets only the test schema; forces local media, keeps both Web Push switches **OFF**; checks server process-tree shutdown; and verifies zero rows among eight sensitive test tables afterward. It never uses local development/prod student accounts, third-party storage or public services.

## Findings resolved

1. **Stale real-login seller acceptance selector:** `StoreFollowersView` now presents a count button instead of a heading. Updated the real-browser journey to click **View 1 followers**, inspect the **Store connections** dialog, verify the buyer is listed, and close with **Close connections**. No production follower behavior or data changed.
2. **Real admin photo publication proof:** Extended real-login browser acceptance to upload a repository-owned PNG to the *synthetic* homepage draft, verify the public homepage's hero image URL remains unchanged before publication, confirm the status/publish button are inside the photo workflow, publish explicitly, and confirm the guest homepage uses the new image and headline. This passed.
3. **Misleading homepage editor copy:** The Hero photo helper previously claimed a missing hero photo would show recent listing photos. The actual fallback is the original bundled marketplace illustration. Added a regression assertion that failed on the old wording, corrected the helper, and verified it passes.
4. **Synthetic upload-media retention gap:** Database fixture deletion did not remove local test photos. Added `apps/api/test/isolated-media-cleanup.ts` and its regression tests. The runner snapshots existing filenames before the synthetic test, then only unlinks *newly created*, validated media files from the fixed, dedicated local test-media path. Existing files are untouched. Most recent full run removed **one new test image**, counted **zero records** in eight test database tables, and verified both temporary ports closed.
5. **Keyboard mobile acceptance:** Added a repeatable Playwright Chrome script `apps/web/test/keyboard-p1p2-ux.smoke.js`. At **320px and 390px**, keyboard Enter scrolls campus filter chips, keyboard selection updates the campus filter URL, the floating chat hides during mobile search input focus, and it reappears when focus leaves; no horizontal overflow in those checks. The first run encountered a transient missing-control wait; the repeat run passed all four checkpoints once options loaded.

## Repeatable browser suites

- `cd apps/api && set CPSU_BROWSER_ACCEPTANCE=1 && bun test/run-isolated-browser-acceptance.ts` (Windows CMD): **8/8 actual-browser checkpoints passed** with actual login/API queries, including post-upload draft privacy and guest image publication, and verified cleanup.
- `apps/web/test/keyboard-p1p2-ux.smoke.js`: **4/4 checks passed** through `playwright-cli` using the running local dev site. This exercises browser keyboard input, not a physical phone.
- Prior `apps/web/test/p1p2-layout-smoke.js`: responsive 320/390/768px chat/category geometry, mouse/touch-style scroll controls and category URL behavior passed.
- Prior `apps/web/test/synthetic-role-ui.smoke.js`: synthetic role-scope/admin-publish visual arrangement passed; the real-browser scenario is the stronger acceptance for actual HTTP requests.

## Fresh code/test results

| Check | Result |
|---|---|
| Frontend `bun test` | **91 passed, 0 failed** (preexisting React SSR warnings) |
| API root `bun run test` | **175 passed, 8 intentionally skipped opt-in integrations, 0 failed** on final rerun |
| New local-media helper tests | **2 passed, 0 failed** |
| Frontend `bun run build` | **PASS** TypeScript and Vite |
| API `bunx tsc -p . --noEmit` | **PASS** |
| `bun run pwa:check` | **PASS** icons, manifest, offline-only worker |

During a full-suite run, two tests for report-target visibility initially failed because their prior assertions expected weaker seller-selection predicates. Concurrent source changes updated those tests to explicitly assert the current eligibility and visibility conditions, including student seller type, active/verified owner, and campus eligibility. A targeted rerun then passed **18/18 report tests**, and the final full API run passed **175 tests**. No authorization rule was weakened, and this acceptance change did not edit production report-handling code.

## Boundaries and release gates

- No main development database mutation, real student content edit, Git commit, Git push, deployment, DNS, firewall, migration or Web Push enablement in this follow-up.
- All real-login writes happened on the dedicated *synthetic test schema*; the runner verified cleanup afterward.
- User has confirmed **no hosting yet**. Therefore approved HTTPS staging, actual physical iPhone Safari/Android Chrome PWA checks, OS lock-screen push, institutional/privacy authorizations, and release signoff remain **NOT COMPLETE**.
- Emulator-sized Chrome windows and synthetic logins are local acceptance evidence, **not** physical-device or CPSU production readiness.
