# CPSU Market — Phase 2 Continued: Accessibility, Reflow, and Keyboard

**Date:** 2026-11-18 (Asia/Manila)  
**Workspace:** `apps/web` plus existing `apps/api` test runner; Windows local development.  
**Change policy:** no new production feature, database operation, migration, Git commit/push, or deployment. All Playwright responses are synthetic and intercepted.

## Findings and fixes

The expanded `@axe-core/playwright` diagnostic surfaced WCAG-tagged **serious** findings which the prior critical-only gate did not catch:

| Finding | Surgical fix | File |
| --- | --- | --- |
| Floating chat label insufficient color contrast on desktop | Use the existing dark `--on-mango` foreground for normal and hover states; retain the existing mango background/position | `apps/web/src/floating-chat.css` |
| Mobile brand link's accessible label did not contain visible `CPSU Market` | Accessible name now includes both `CPSU Market` and `CPSU Student Marketplace` | `apps/web/src/main.tsx` |
| Reviewer navigation accessible name omitted contiguous visible badge text | Use `Review N waiting` and include a visible space before the existing badge | `apps/web/src/main.tsx` |
| Sound and test buttons omitted visible text from ARIA labels | Accessible names now begin `Sound on`, `Sound off`, and `Test sound`, followed by action description | `apps/web/src/pages-account.tsx` |
| `Mark all read` voice-control mismatch | Accessible label contains the exact visible phrase before the longer description | `apps/web/src/pages-profile.tsx` |
| Explore loading skeleton carried `aria-label` on a generic div | Give the loading skeleton explicit `role="status"` | `apps/web/src/pages-public.tsx` |

The related source-string assertion was updated in `apps/web/test/icon-action.test.tsx` to enforce the corrected accessible-name contract. It is not suppressed or skipped.

## New/strengthened regression gates

- `apps/web/e2e/accessibility.pw.ts`: nine page scenarios in desktop and mobile Chrome. Fails on **all** axe WCAG 2.0/2.1/2.2 A/AA violations, regardless of impact level. `CPSU_A11Y_DIAGNOSTICS=1` can print severity and affected selectors for local diagnosis.
- `apps/web/e2e/accessibility-states.pw.ts`: visible seller listing composer, reporting form and floating chat quick-view scanned in both browser projects.
- `apps/web/e2e/reflow-keyboard.pw.ts`: Home/Explore/listing/store/profile document overflow at 320px and 390px; skip-link activation, sign-in field tab order, keyboard open/Escape-close/focus restoration, and chat-vs-mobile-nav overlap in both browser projects.
- `apps/web/e2e/marketplace.pw.ts`: resilient locator for real Books category chip after concurrent Explore UI work.
- `apps/web/package.json`: `test:a11y` now includes both static-route and open-interaction a11y suites.

## Confirmed results (last full run)

| Test gate | Result |
| --- | --- |
| `apps/web: bun test` | **115 passed, 0 failed; 426 assertions, 32 files; 0 React warnings** |
| `apps/api: bun test` | **200 passed, 8 intentionally skipped, 0 failed; 721 assertions, 49 files** |
| `apps/web: bunx playwright test` | **54 passed, 0 failed**, including 24 accessibility snapshots (12 page/interaction scenarios × desktop/mobile), 18 reflow/keyboard checks, and 12 original marketplace journey checks |
| `apps/web: bun run build` | TypeScript and Vite production build passed |
| `git diff --check` | Check before final delivery; do not stage/commit unrelated work |

The initial diagnostic showed serious contrast, accessible-name and skeleton-ARIA issues. After the fixes, its 18 original route scans reported **zero axe WCAG-tagged violations**, and the 6 newly added open-state scans also passed. The strict all-severity regression check passed during the 54-test full browser run.

## Scope and remaining acceptance

- These are **synthetic, intercepted frontend tests** and isolated middleware unit tests, not real MySQL end-to-end tests.
- The eight database-backed/HTTPS/Web Push integration suites remain opt-in and require explicit CPSU authorization, guarded `cpsu_marketplace_test`, and appropriate isolated media storage. Do not run them against `cpsu_marketplace`.
- The mobile project uses Chrome touch/viewport emulation. Actual iOS Safari, Android, assistive-technology screen readers, installed PWA background delivery, and HTTPS staging are unverified.
- Automated axe coverage is not proof of complete WCAG compliance. Manual keyboard traps, high zoom, color contrast across all states, speech input, and screen reader testing remain valuable.
- Concurrent Explore UI edits were preserved; only a narrow skeleton semantic change and one test selector update were applied in that area.

### Repeat commands

```powershell
cd apps/api
bun test
cd ../web
bun test
bun run build
bun run test:a11y
bun run test:e2e
```
