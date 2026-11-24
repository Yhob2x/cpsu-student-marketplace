# CPSU Market — UX/UI Audit and Focused Refinement
**Date:** 2026-11-18 (Asia/Manila)
**Environment:** local Windows development application at `http://127.0.0.1:5173`, with existing development API
**Scope:** source inspection, public responsive browser audit, synthetic signed-in role checks, accessibility heuristics, focused storefront touch-target refinement and footer regression correction.

## A. Audit findings

| Priority | Page/component | Evidence / finding | Impact | Resolution | Status |
|---|---|---|---|---|---|
| P2 | Public store / follower counts | Browser measured two buttons at approximately 44×29px before changes. Later CSS specifically overrode the larger base hit-area. | Harder to tap on touch devices; below preferred 44px minimum. | Raise minimum hit area to 44×44px while preserving follower-dialog behavior. | **Fixed and verified** |
| P2 | Public store / category filters | Store category chip buttons measured 38–39px high across public routes. | Compact touch controls; harder to select accurately. | Use 44px minimum on desktop and mobile. | **Fixed and verified** |
| P2 | Public store / listing-type filters | Existing later stylesheet set a 42px minimum. | Inconsistent with shared 44px action standard. | Align tab controls to 44px. | **Fixed and verified** |
| P2 | Guest footer test | A legacy test expected a registration link that had been deliberately removed from public navigation. | Full frontend test suite failed despite approved footer behavior. | Update assertion to require sign-in and prohibit the old registration link. | **Fixed and verified** |
| P2 | Homepage live listing content | Real public listing titles included repeated characters and placeholder-like titles. | Reduces search and purchase confidence. | Keep the existing human-only readability/moderation advisory; do not alter student listings without authorization. | **Deferred: content moderation** |
| P2 | Public store live listing content | One listing titled “Brief” displayed a portrait image; appropriateness/match requires human review. | Potential listing-information mismatch. | Human reviewer should verify the content and image against seller intent. | **Deferred: content moderation** |
| P2 | Styling architecture | Base, themed, and route-specific CSS coexist in ordered imports. | Later overrides can silently shrink a control (confirmed above). | Prefer canonical shared tokens and add rendered-size regressions before larger CSS consolidation. | **Documented / further consolidation deferred** |
| Release gate | Authenticated mobile/PWA | Synthetic roles verified selected UI behavior, not real physical-device completion. | Cannot claim production UX acceptance. | Complete authenticated iPhone Safari/Android Chrome/installed PWA checks on approved HTTPS staging. | **Blocked / pending authorization and staging** |

No P0 or P1 blocker was confirmed within the public routes actually tested. This does **not** mean all authenticated app flows have been exhaustively audited.

## B. Design-system assessment

- **Typography:** `Inter` is the shared UI face. `EB Garamond` remains the homepage hero display face; browser computed style confirmed. Type roles are defined in `apps/web/src/typography.css`. Product titles are visually clamped and retain aligned card heights. Preserve deliberate distinctions among headings, prices, labels and metadata.
- **Colors:** Existing CPSU forest-green and neutral storefront theme retained, notably `--forest: #073b2a`, `--ink: #122a1f`, `--ink-soft: #4b6356`, `--line: #dce6de`, and `--focus-green: #086043`. No new palette was introduced. A complete automated pixel-level WCAG contrast scan was **not** performed.
- **Spacing:** Existing 4px-oriented practical spacing, grouped toolbar gaps and card interior padding retained. Avoid uncontrolled one-off variants.
- **Radius:** Inputs and buttons generally 8–11px, cards/panels 10–16px; small category controls may use pills. No global changes.
- **Buttons and links:** Store actions retain semantic `button` for changes and `a`/`Link` for navigation. Follow/Following uses stable reserved width. Focus outlines and disabled behavior retained.
- **Forms:** Public inspected routes had no visible, unnamed native form controls according to DOM heuristic checks.
- **Card patterns:** Listing image aspect ratio and equal card-height CSS present across the inspected public grids. No mismatch introduced by touch-target refinements.
- **Motion:** Existing restrained CSS transitions and reduced-motion safeguards retained. No new animation dependency.
- **PWA/mobile:** Floating chat, bottom navigation, header search behavior, static PWA assets and manifest preserved.

## C. Implementation summary

| File | Change | Behavioral impact | Verification |
|---|---|---|---|
| `apps/web/src/storefront-page-polish.css` | Follower count hit area 44×44px minimum; category chips 44px at all widths; listing-type tabs 44px. | No routing, follower logic, API or auth changes; only clickable area and small layout adjustments. | Verified all 11 viewport widths, 200% root text at 320/390/768px, desktop/mobile screenshots. |
| `apps/web/test/site-footer.test.tsx` | Guest expectation now asserts registration link is absent. | Tests only; production footer unchanged. | Full frontend Bun test suite passes. |

Transient test scripts and captures were placed in the local `.tmp` directory; these are local QA artifacts, not production code. Existing uncommitted work on API, pages, filters and reviews was not overwritten.

## D. Responsive and test acceptance

| Coverage | Result | Limits |
|---|---|---|
| Public route sweep | 7 routes × 4 viewport widths (320/390/768/1440): no document horizontal overflow, no unlabeled visible form fields or icon-only buttons detected by DOM heuristics, no homepage chat/View-all collision. | Public guest UI; DOM heuristics do not replace a screen-reader test. |
| Store touch-target acceptance | Canonical `/store/yobyob` at 320, 360, 375, 390, 414, 768, 820, 1024, 1280, 1440 and 1920px: **11/11 pass**. | Chrome desktop browser viewport emulation. |
| 200% text | Store at 320, 390 and 768px: no horizontal overflow; interactive controls retained 44px+ hit areas. | Emulated root-font enlargement, not physical OS text scaling. |
| Signed-in role smoke | Synthetic student: chat open/close and empty state. Synthetic university admin: photo publish hierarchy and status. Synthetic campus reviewer: scoped navigation, content clarity notice, mobile search shortcut. | Mocked API fixture, no real student/admin write actions. |
| Frontend unit suite | **101 passed, 0 failed** across 29 files. | React SSR `useLayoutEffect` warnings remain in test output. |
| TypeScript and Vite build | **Passed** after changes. | Local build only; no deployment. |
| PWA static validator | **Passed**, including icon assets, manifest and offline-service-worker contract. | Does not establish OS-level push or installed-device behavior. |
| Screenshots reviewed | Local `.tmp/cpsu-store-verified-390.png` and `.tmp/cpsu-store-verified-1440.png`. | Browser captures, not physical devices. |

The initial width-dependent store test navigated via an ID alias and occasionally observed transient redirect states. The final acceptance check uses the canonical store URL, requires controls to appear before measuring, and passed at every specified width.

## E. Remaining issues and release gates

**Fixed and verified:** Store follow-count, category and type control hit areas; outdated footer regression assertion.

**Implemented, not fully verified:** Existing review/rating UI, notifications, product card and authenticated form refinements were outside this focused code change. Their underlying business logic and live device behavior were not retested end-to-end here.

**Blocked:** Physical iPhone/Android, HTTPS staging, notification background delivery, real authenticated staff/seller sessions and CPSU institution-specific approval requirements.

**Deferred:** Published placeholder-style titles, ambiguous image/content pairings, complete WCAG 2.2 AA manual audit and cross-role visual screenshots for every protected workspace.

**Out of scope:** Authentication changes, database migrations, modifying real student content, API contract changes, commits, pushes, deployment or infrastructure.

## Final gate

The inspected **public** routes and modified store hit targets passed the checks described above. A complete all-roles UX/UI and installed-PWA acceptance cannot yet be certified without full authenticated journey coverage and physical-device/staging tests. No database migration, production data edit, deployment, Git commit or push was performed.
