# CPSU Market — UI/UX consistency audit
**Date:** 19 November 2026
**Environment:** Windows, Bun 1.4.4, React/Vite web/PWA, Microsoft Edge headless
**Scope:** Visual consistency only, light mode, existing CPSU palette; no application logic, routes, database or API intentionally changed.
**Review:** Codex skipped by owner request; no independent approval claimed. No commit was created by this audit.

## Source inventory and denominator
Active client: `apps/web` (responsive website, installed PWA, seller and admin views). Archived native Expo is **not** an active product target.
- Public route screens (7): Home `/`, Explore `/explore`, listing `/listings/:id`, stores `/store/:slug` / `/stores/:id` (same view), Guidelines `/guidelines`, Login `/login`, Not found `*`.
- Student route screens (8): Dashboard `/dashboard`, Messages `/inquiries`, Thread `/inquiries/:id`, Saved `/saved`, Transactions `/transactions`, Transaction detail `/transactions/:id`, Profile `/profile`, Notifications `/notifications`.
- Staff route screen (1): Admin `/admin`, internally using reviewer, managed-content, catalogue/campus and other administrative sections.
- Redirect-only aliases: `/register`, `/stores`.
- Shared surfaces inspected by source: header, bottom navigation, listing cards, action feedback, filter options, seller links, PWA install action, icon action, shadcn Button, floating chat and its panel, image zoom, followers dialog.
- State inventory required per screen: loading, empty, error, success and offline. These were **not all browser-tested** (especially protected routes).
- Browser coverage: 4 public routes × 3 widths (360, 768, 1280) = **12/48 route-width combinations (25%)** for the 16 primary route screens. Admin subviews and authenticated variants are additional surfaces not included in that denominator.
- Source scan inventory at start: 89 CSS/TSX files. Final scan: 91 (other work changed the working tree during the audit).

## Before/after scoreboard
| Check | Before | Last observed | Status |
| --- | ---: | ---: | --- |
| G1 Off-scale spacing declarations (heuristic) | 1,347 | 1,370 | Open |
| G1 Off-scale font-size declarations (heuristic) | 493 | 509 | Open |
| G1 Off-scale radius declarations (heuristic) | 249 | 252 | Open |
| G1 Total off-scale declarations | 2,089 | 2,131 | Open; scanner denominator changed |
| G2 Duplicate functional component implementations | Not established | Shared Button variants normalized, legacy `.btn` remains | Open |
| G3 Missing full interaction states | Not established | Core controls have rules; screen-by-screen census pending | Unverified |
| G4 Missing loading/empty/error states | Not established | Several screens have these, full census pending | Unverified |
| G5 Small touch targets | Public 360px: 1–21 per route in early scan | 0 on 4 public routes at 360/768 | Pass for sampled routes only |
| G6 Missing form labels/helper/errors | Not established | Axe found no WCAG form violations on public samples | Unverified globally |
| G7 Horizontal document overflow | 0 on 12 public route-width checks | 0 on 12 checks | Pass for overflow only; overlap/truncation unverified |
| G8 Missing alt/labels | Scanner reports 1 apparent `<img>` in code comment | 0 unnamed rendered buttons in 12 checks | Unverified globally |
| G9 Copy/date/currency | Not established | Category/PWA accessible names aligned | Open |
| G10 Lighthouse accessibility | Unverified | Not run; Axe WCAG A/AA: 0 violations in all 12 sampled combinations | Unverified |
| G11 Web typecheck/build | Failed at baseline (concurrent unfinished review component) | PASS | Pass; build retains chunk-size warning |
| G11 Web test suite | 131 pass, 4 test files failed initially | 158 pass, 0 fail at last verified run | Pass |
| G11 Lint | Script not defined in web package | Unverified | Unverified |
| G12 Logic/routing/data/API changed by this audit | None intended | No server/API/migration edits by this audit | Preserved in audit-owned edits |
| G13 P0/P1 open | No exhaustive baseline | P1 open as listed below | Not met |
| G14 P2 open | No exhaustive baseline | Not fully enumerated | Unverified |
| G15–G16 Independent Codex reviews | Required in original task | Explicitly waived by owner | Skipped, not approved |
| G17 Implementation iteration cap | 5 | Five targeted polish/verification passes | Reached without full exit criteria |

**Important counting limit:** The off-scale scanner counts literal px/rem tokens in selected CSS property declarations, including legitimate fluid expressions; it does not inspect computed styles or every inline style. Increased totals partly reflect newly added frontend files and unrelated concurrent changes. Do not interpret as proof that visuals became worse.

## Imperfection register
| ID | Screen/component | Category | Problem | Severity | Fix / outcome | Status |
| --- | --- | --- | --- | --- | --- | --- |
| UX-001 | Global CSS | Tokens | Thousands of off-scale spacing, type and radius values in layered CSS | P1 | Defined target scale and normalized shared roles; requires controlled per-file cleanup with screenshot comparisons | Open |
| UX-002 | Buttons | Components | Legacy `.btn` plus largely unused shadcn Button and IconAction patterns have differing variants | P1 | Normalized shadcn API to 3×3; kept legacy markup to avoid behavior changes | Partial |
| UX-003 | Common controls | States | Focus, pressed, hover and disabled semantics were not fully uniform | P1 | Shared focus/touch/hover/disabled treatment in final stylesheet; unknown one-offs remain | Partial |
| UX-004 | Public listing links | Touch targets | Seller name and category links had too-small hit areas on touch layouts | P1 | Expanded CSS hit areas; 360/768 browser samples now clean | Fixed in samples |
| UX-005 | Bottom nav, breadcrumbs, filters | Touch targets | Some links and filter expand controls were below 44px | P1 | Final shared stylesheet; 360/768 browser samples now clean | Fixed in samples |
| UX-006 | Home categories | Accessibility | Short visual category name differed from accessible name on 360px | P1 | Accessible name now begins with displayed short name | Fixed; Axe rerun |
| UX-007 | Header PWA Install | Accessibility | Accessible name omitted visible “Install app” text | P1 | Aligned accessible label and updated 3 matching test selectors | Fixed; Axe + tests rerun |
| UX-008 | Login, listing/seller/admin forms | Form UX | Visible labels, helper text, validation consistency not fully enumerated | P1 | Preserve current forms; run protected-screen audit next | Unverified |
| UX-009 | Loading/empty/error/offline states | Screen states | Full inventory of variant-specific states incomplete | P1 | No unsafe global replacement of conditional content | Unverified |
| UX-010 | Authenticated seller/admin/PWA | Responsive | 360/768/1280 visual and keyboard QA not exercised with real authenticated roles | P1 | Public route samples tested; authenticated roles remain | Open |
| UX-011 | Copy, dates, money, icons | Consistency | All screen terminology and formats not audited against single rules | P1 | Reused existing style/copy; no unreviewed global rewrite | Open |
| UX-012 | Hero/detail/specialized surfaces | Type/shape | Existing editorial hero and complex image viewers need human comparison before forcing scale values | P2 | Deferred to prevent visual regressions | Deferred |
| UX-013 | Build tooling | Performance warning | Vite reports bundle chunk >500kB | P2 | Leave splitting/optimization outside visual-only scope | Deferred |
| UX-014 | Reviews widget | Syntax | An incomplete in-progress JSX element prevented baseline web build | P0 at baseline | Corrected concurrently in working tree, build and tests now pass; not attributed to this audit | Resolved externally |

## Design-system summary
- Spacing: `4, 8, 12, 16, 24, 32, 48, 64` px; existing aliases retained for compatibility.
- Type: `12, 14, 16, 18, 20, 24, 30` px; Inter for UI, EB Garamond reserved for homepage editorial title. Target weights: `400, 500, 700`; legacy weights still exist.
- Radius: `6, 12, 9999` px. Shadows: sm, md, lg tokens. Icon sizes: 16, 20, 24.
- Button design target: primary, secondary, ghost × sm, md, lg with 44/48/56px minimum heights. Existing legacy button variants intentionally kept so functional destructive actions continue to work.
- Shared current code includes `components/ui/button.tsx`, `icon-action.tsx`, `action-feedback.tsx`. Input, Card, Modal, Badge, EmptyState, ErrorState, Skeleton are not all consolidated into a single component each; G2 remains open.
- Palette is sourced from `apps/shared/theme.css` and was not changed by audit-owned edits.

## Audit-owned files touched
The following were edited in this pass; **the working tree contains other unrelated concurrent edits** and some audit edits may have been picked up by external commits during the run:
`apps/web/src/ui-consistency.css`,
`apps/web/src/main.tsx`,
`apps/web/src/components/ui/button.tsx`,
`apps/web/src/shadcn.css`,
`apps/web/src/typography.css`,
`apps/web/src/styles.css`,
`apps/web/src/icon-action.css`,
`apps/web/src/action-feedback.css`,
`apps/web/src/pages-public.tsx`,
`apps/web/src/install-app.tsx`,
`apps/web/test/install-app-header.test.tsx`.
Temporary local-only scripts and screenshots were placed under ignored `.tmp/ux-*`.

## Verification evidence
- `cd apps/web && bun run build` — TypeScript and Vite compilation pass; existing bundle warning.
- `cd apps/web && bun test` — latest 158 pass, 0 fail.
- `git diff --check` — last run exit 0. Windows LF/CRLF advisory warnings still shown by Git.
- Microsoft Edge production preview `http://127.0.0.1:4173`; four public routes across 360/768/1280: 0 document horizontal overflows, 0 page JavaScript errors, 0 unnamed buttons; 0 small rendered touch targets on 360/768 when radios were measured using their parent labels.
- `@axe-core/playwright` WCAG 2 A/AA and 2.1 A/AA: 0 violations for the same 12 route-width combinations. This is **not** a Lighthouse score and does not prove screen reader compliance.
- No full-role device/PWA acceptance, offline slow-network, keyboard focus-order walkthrough or Lighthouse run.

## Human decisions / next verification
1. Approve any deliberate exceptions to strict spacing/font scales for the editorial hero, image zoom canvas, safe area and geometry calculations.
2. Perform role-authenticated checks for seller listings, transactions, chat, profiles, admin reviewer, catalogue and managed-content workflows at 360/768/1280, including empty/loading/error/disabled.
3. Test physical Android Chrome, iPhone Safari, installed PWA offline behavior, text zoom and a screen reader.
4. Decide whether to consolidate legacy .btn usage into shadcn Button despite the required broad markup refactor (still UI-only but higher regression risk).
5. Schedule the large per-file scale cleanup separately after stabilizing concurrent work, with visual snapshots and no changes to routes, data, APIs or palette.

**Overall result:** Targeted public-facing polish is implemented and regression-tested, but the all-product exit criteria are **not met**. No Codex approval, complete component census, or Lighthouse ≥95 claim is made.

---

## Follow-on consolidation and device-readiness pass — 19 November 2026

This section **supersedes the first-pass scoreboard above** where the figures differ. Work was carried out on the currently connected Windows PC without a commit, Codex, production credential, business-logic change, API change or database mutation. Other frontend edits were occurring concurrently; do not assume all changes in `git status` are from this audit.

### Completed presentation work
- Introduced source-scale CSS custom properties and normalized **1,612 literal CSS tokens in four controlled passes** (850 + 265 + 108 + 389 substitutions), across **36 distinct existing stylesheets**. The fourth pass reused 12 first-pass files and was A/B inspected with an isolated rollback against the concurrently updated hero.
- Shared `IconAction` now delegates to the existing shared shadcn Button (ghost/sm) while retaining type, 44px target, accessible name, busy state and disabled state.
- Added `components/ui/screen-state.tsx` with shared LoadingState, EmptyState and ErrorState. Consolidated their display in Messages and Saved without changing fetches, retries, routing or API calls.
- Added touch-target rules for store follower counts and transaction filters; fixed tablet Explore sort wrapping.
- Added five regression tests for shared states, Button delegation, accessibility and existing palette-token usage.
- No CSS colors were changed and light mode remains the only supported mode.

### Latest off-scale scan (heuristic, not full stylelint)
| Metric | Initial follow-on baseline | Last observed | Remaining |
|---|---:|---:|---|
| Spacing | 1,370 | 649 | Not 0 |
| Font-size | 509 | 218 | Not 0 |
| Radius | 252 | 95 | Not 0 |
| Combined | **2,131** | **962** | **Not met** |

The scan's file denominator changed from 91 to 93 CSS/TSX source files as other work was added. It counts off-scale literal values within selected CSS properties, including deliberate fluid design values, and is not a rendered defect count. Remaining values require manual review of editorial hero, geometry, complex functions, dynamically sized images, layered responsive rules and concurrently edited styles. Do not mass-replace these numbers without new screenshot and keyboard acceptance.

### Browser and accessibility evidence
- Public: 4 routes × 360/768/1280 = **12 route-width checks**; zero document-level horizontal overflow; automated axe WCAG A/AA checks returned zero violations in the tested fixtures.
- Authenticated empty-state fixtures (synthetic responses, not real login): 6 student + 3 administrator routes × 360/768/1280 = **27 checks**, zero JavaScript runtime errors, zero document-level horizontal overflow, zero undersized touch targets, zero axe A/AA violations.
- Synthetic API-failure scenario: 9 authenticated routes at 360px; error/retry presentation rendered without JavaScript errors, overflow or undersized controls. This checks the UI fallback, **not** live server response behavior.
- PWA: `bun run pwa:check` passed; Chromium confirmed standalone manifest, service-worker control, cached offline shell/public icons only, offline fallback page and keyboard focus order. No private API/page cache was found in the service-worker cache.
- After normalization, the web production build/typecheck and **163/163 web tests passed**; Vite still reports a >500kB chunk warning.
- **Lighthouse >=95, native screen-reader performance, physical phone installation, iOS Safari, Android Chrome and real push delivery are unverified.** No phone was available via WPD/ADB; Windows Narrator exists but was not operated. See `docs/PWA_PHYSICAL_ACCESSIBILITY_ACCEPTANCE_2026-11-19.md`.

### Remaining imperfection register updates
| ID | Priority | Current outcome |
|---|---|---|
| UX-001 | P1 | Improved by 1,169 heuristic off-scale declarations; **962 remain**, G1 open |
| UX-002 | P1 | IconAction unified with Button and shared state components introduced; large legacy button/form/card markup still uses .btn/.panel; G2 partial |
| UX-004, UX-005 | P1 | Touch issues corrected for sampled public/student/admin fixtures |
| UX-006, UX-007 | P1 | Accessible category and install names corrected; axe checks clean in samples |
| UX-008, UX-009 | P1 | Empty and error-state fixtures inspected; actual authenticated form validation, real data loading and permission-dependent variants not exhaustively tested |
| UX-010 | P1 | Synthetic responsive role checks pass, physical phone acceptance open |
| UX-011 | P1 | Complete date/currency/terminology census remains open |
| UX-012 | P2 | Editorial/geometry exceptions intentionally deferred to avoid unsafe blanket changes |
| UX-013 | P2 | Existing Vite chunk-size warning not addressed; code splitting is a separate performance task |

### Added/modified files attributable to this pass
- **New:** `apps/web/src/components/ui/screen-state.tsx`, `apps/web/test/ui-consistency-shared.test.tsx`, `docs/PWA_PHYSICAL_ACCESSIBILITY_ACCEPTANCE_2026-11-19.md`.
- **Modified shared UX:** `apps/web/src/icon-action.tsx`, `apps/web/src/pages-account.tsx`, `apps/web/src/ui-consistency.css`.
- **Normalized CSS (36 distinct files):** `styles.css`, `storefront-theme.css`, `editorial-redesign.css`, `header-search-polish.css`, `notifications.css`, `footer-refinements.css`, `explore-page-polish.css`, `mobile-refinements.css`, `storefront-page-polish.css`, `my-store-polish.css`, `listing-detail-polish.css`, `message-motion.css`, `explore-simple-filters.css`, `home-simplification.css`, `hierarchy-polish.css`, `student-ux-polish.css`, `storefront-hierarchy.css`, `my-store.css`, `storefront.css`, `store-reviews.css`, `listing-gallery.css`, `image-zoom.css`, `listing-composer-polish.css`, `p1p2-ux-fixes.css`, `action-feedback.css`, `catalog-admin.css`, `explore-direct-filters.css`, `explore-scroll-cues.css`, `admin-workspace.css`, `mobile-chat-dock.css`, `most-followed-stores.css`, `seller-avatar-editor.css`, `store-appreciation.css`, `store-followers.css`, `seller-avatar.css`, `seller-store-details.css`.
- Temporary browser probe, visual diff, audit data, source backups and mock fixture scripts are under ignored `.tmp/ux-*` and remain available on this PC. No original code was deleted.

**Follow-on exit decision:** Source consistency and browser/PWA simulation have materially improved, but **strict global zero off-scale values, full component consolidation, Lighthouse score and physical/screen-reader acceptance remain open**. Do not mark a release gate as approved on these automated checks alone.

---

## Continuation pass — additional consolidation, responsive admin tests, Lighthouse (19 Nov 2026)

This section is the **latest checkpoint** and supersedes older measurements where the source denominator changed. No Codex CLI, automatic commit, production login, business logic edits, API route edits, or database operations were performed in this UI scope.

### Additional implementation
- Normalized **210 near-scale CSS tokens** in seven more stylesheets: `floating-chat.css`, `profile-refinements.css`, `guidelines-page.css`, `transactions-polish.css`, `home-color-polish.css`, `async-feedback.css`, and `install-app.css`. Values were converted to existing spacing/type/radius variables. Stored original copies under ignored `.tmp/ux-css-originals`.
- Normalized **95 non-editorial font-weight declarations** across 18 CSS files to the shared roles `--ui-weight-regular: 400`, `--ui-weight-medium: 500`, and `--ui-weight-bold: 700`. Preserve the editorial hero's approved font and weights.
- Created native, presentational `Panel` and `Field` components. Migrated **20 label wrappers** across managed content, catalog and reviewer forms and one guidelines section panel. Markup, focus association, submit handlers, fields, validation, native section landmarks and legacy CSS classes remain intact.
- Added `apps/web/test/ui-consistency-primitives.test.tsx` with 3 wrapper tests; the web unit suite now runs **169 passing tests, 0 failures**.
- Extended **test-only synthetic mock personas** to university administrators, plus explicit admin editor, catalog, reviewer, transaction and store-rating GET fixtures.
- Added durable `ui-consistency-admin.pw.ts`: 11 admin subviews × desktop and mobile Chrome = **22 passing browser tests**. Each checks visibility, horizontal overflow, 44px controls, and axe WCAG A/AA.
- Added `ui-consistency-student.pw.ts`: six student/seller routes × desktop and mobile Chrome = **12 passing browser tests** with console error, overflow, hit-target and axe checks. Total added browser regression coverage: **34/34 passing**.
- Added a standards-compliant `apps/web/public/robots.txt` allowing public discovery while requesting crawlers avoid account, admin, transactions, messages, API and login paths. This is advisory for crawlers, not authorization.

### Latest scale and verification scoreboard
| Measure | Latest |
|---|---|
| CSS/TSX files scanned | 96 files (56 CSS + 40 TSX), denominator changes with concurrent work |
| Off-scale literal CSS declarations | **828** (593 spacing; 165 type; 70 radius), **NOT ZERO** |
| CSS token replacements across all five batches | 850 + 265 + 108 + 389 + 210 = **1,822** |
| Additional non-editorial font-weight rules normalized | 95 |
| Shared Field wrappers migrated | 20 |
| Web unit/component tests | **169 passed / 0 failed** |
| Chrome Playwright, new administrator tests | **22 passed / 0 failed** |
| Chrome Playwright, new student/seller tests | **12 passed / 0 failed** |
| Production build / TypeScript | **PASS**; existing >500KB JavaScript chunk warning remains |
| PWA manifest / icons / offline-shell validator | **PASS** |
| Lighthouse local production-preview homepage, mobile-mode | **Performance 97 / Accessibility 100 / Best Practices 100 / SEO 100** |
| Default Lighthouse agentic-browsing category | 50; experimental/extra category, outside UI target |
| Actual physical iPhone/Android and VoiceOver/TalkBack/Narrator sessions | **NOT VERIFIED** |

### Visual-regression evidence and caveats
- Captured 12 public route-width screenshots (360px/768px/1280px) before and after the seven-file batch and font-weight pass. No horizontal document overflow, no undersized mobile targets, and no JavaScript page errors were detected in these samples.
- Batch-five pixel comparison on the 12 snapshots showed a maximum of ~5% pixels changing beyond an average channel threshold of 12, on Guidelines at 360px. Manual comparison showed small spacing/line-wrap changes but no clipped controls.
- The weight-normalization snapshot comparison was below 2% changed pixels at that threshold for all 12 public views (maximum observed Guidelines 360px ~1.61%). This is a sampling regression check, **not a guarantee that all signed-in modes or physical devices are visually identical**.
- Before robots.txt, the first local Lighthouse run showed 97/100/96/92 and intermittent HTTP 500s on several image/media URLs. A later run scored 97/100/100/100 with no console errors. **Do not infer intermittent backend media failures are fixed:** those API errors are a separate backend concern and are out of this visual-only task.
- The strict 'zero off-scale CSS' exit condition remains open. The remaining declarations include fluid/negative geometry, layered responsive rules, and some intentional exceptions; separately inspect each rather than mechanically changing values.

### Unverified gates (still open)
- Actual student/admin login, real role permissions, real-data loading and errors end-to-end (the tests above use synthetic fixtures only).
- Physical-device PWA install and push permission/delivery; iOS Safari/VoiceOver, Android Chrome/TalkBack, and hands-on Narrator/NVDA; magnification/200% text.
- Fully consolidated old `.btn`, `.panel`, badge and modal internals (only targeted shared wrappers migrated; wholesale markup replacement would risk regressions).
- Lighthouse score consistency on authenticated routes and additional physical/mobile devices; the measured scores are from one local homepage audit.
- Fixing pre-existing Vite large-chunk warning and intermittent image/media HTTP 500s, outside the current presentation-only scope.

**Latest disposition:** Public and synthetic authenticated UI checks pass, and the measured homepage Lighthouse goals are met. Production release approval is **NOT** granted until the remaining real-device, authenticated and zero-scale gates are verified.

### Final verification refresh (working tree changed concurrently)
- Latest shared-source scan: **845** potential off-scale declarations (**606 spacing, 166 type, 73 radius**) across 96 CSS/TSX files. The scan was 828 shortly before, but independent frontend files changed afterward; this is a rolling denominator, not a new regression attributable to the UI-normalization batch.
- Full web unit suite after the added `robots.txt` regression test: **170 passed / 0 failed**.
- Both new browser suites rerun together against current frontend: **34 passed / 0 failed** (Chrome desktop and mobile emulation).
- Final measured mobile Lighthouse homepage scores remain **Performance 97, Accessibility 100, Best Practices 100, SEO 100**. The additional agentic-browsing category scores 50 and is not part of the requested UI/a11y gate.
- `bun run build`, `bun run pwa:check` and `git diff --check` all passed; Vite >500kB chunk warning persists.
- Independent work changed repository HEAD during the audit (`f3237b9` observed after an earlier `bc43113`); **the UI audit did not create any commit**. Preserve others' in-progress API, production-readiness, transaction and hero changes.
- Physical phones, actual screen readers, live login/permission flows and the remaining strict zero-offscale condition are **still not verified**, and production release approval must remain open.
