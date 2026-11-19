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

---

## Continuation checkpoint — shared JSX migration, 320px forced colors, CSS and browser regression (19 Nov 2026)

This entry supersedes older test counts where they differ. Working tree is concurrently modified by other project tasks; no commit or Git staging was deliberately performed by this audit.

### Implementation
- Migrated **38** more JSX form labels into the shared native `Field` wrapper and **15** legacy panels into `Panel`, without changing native tags or handlers. A TypeScript-AST migration affected `pages-admin.tsx` (11/6), `pages-account.tsx` (26/5) and `pages-profile.tsx` (1/4). Original backups saved under ignored `.tmp/ux-primitives-before-*`.
- Before/after synthetic authenticated screenshot comparison at 360, 768 and 1280px showed 26 of 27 frames pixel-identical; one changed by 0.04%, with zero automated accessibility, overflow, touch-target or runtime errors in those route samples.
- Corrected the footer in `footer-refinements.css` for Windows forced-colors mode using system `Canvas`, `CanvasText` and `Highlight` values, without changing the regular theme. Added `e2e/ui-reflow.pw.ts` checking nine screens at 320px under forced-colors plus keyboard skip-link/search. **10/10** browser tests passed.
- Applied a conservative spacing batch: **53 substitutions** across `admin-workspace.css`, `catalog-admin.css`, `profile-refinements.css`, `guidelines-page.css` and `async-feedback.css`; original backups `.tmp/ux-spacing6-backups`. The scan briefly reached 801 off-scale declarations (562 spacing, 166 type, 73 radius). A later scan on a changing source denominator found **806** (565 spacing, 167 type, 74 radius) across 98 CSS/TSX files. These figures are static heuristics; the strict zero target remains OPEN.
- Fixed test-only mock compatibility with concurrently introduced paginated messaging (`/inquiries/.../messages?limit=50` and `/inquiries` returning `{items,hasMore,nextBeforeId}`). Did not alter production pagination logic or APIs.
- Updated old Playwright locators to the current visible controls: radio-category filtering, Message the seller, Send message, Report this listing, Reason for reporting. The tests still check actual navigation, message sending, report saving and review permissions.
- Unified home listing-card price with Explore using the **existing** `--color-primary` palette token; no new color or token was introduced. The theme assertions now verify the same primary price and existing badge tokens across both views.
- Focused regression: **22/22** Chrome desktop/mobile marketplace, accessibility-state, and theme browser tests passed after updates.
- Most recent full web unit suite during this continuation: **180 passed / 0 failed**; Vite/TypeScript production build and `bun run pwa:check` passed. Large Vite chunks still generate an existing warning.
- Initial broad browser run before test contract updates: **107 passed / 13 failed**, predominantly stale selectors plus a transient Notifications load failure. The corrected full-suite rerun was started; record its final outcome separately and do not falsely claim it passed.

### Pending release gates
Real iOS Safari/VoiceOver and Android Chrome/TalkBack sessions, hands-on Windows screen reader and actual authorized student/admin sessions cannot be verified from the connected PC. Strict zero off-scale source values, full legacy button consolidation, media API intermittent failures and Vite large-chunk warnings are also not closed. The audit did **not** create a commit.

### Final continuation verification — broad Playwright rerun

- `bunx playwright test`: **119/120 passed**, **one interrupted accessibility scan**. The only failed test was the desktop seller listing composer axe scan, which threw `Execution context was destroyed, most likely because of a navigation`; it **did not report a WCAG failure**.
- Immediately repeated all three desktop accessibility-state tests twice: **6/6 passed**, including the seller composer twice, report dialog twice, and floating-chat quick view twice, with no axe WCAG A/AA findings.
- Corrected an obsolete test fixture contract for the concurrently updated paged inbox; synthetic responses now return `{ items, hasMore, nextBeforeId }`. Fixed outdated accessible locators in marketplace/reporting tests without relaxing functional assertions. Focused marketplace/report/theme suite: **22/22 passed** on desktop and mobile Chrome.
- Home and Explore listing prices now use the existing `--color-primary` token consistently; the approved palette remains unchanged and theme assertions enforce it.
- Latest web unit suite: **180 passed / 0 failed**, production build/typecheck **PASS**, `bun run pwa:check` **PASS**, and `git diff --check` **PASS**.
- Latest scan reported **806** potential off-scale CSS declarations (565 spacing, 167 font-size, 74 radius) across 98 CSS/TSX files due to concurrent additions; strict zero remains open.
- Repository HEAD changed concurrently (last observed `d218231`), not by this audit. No commit was created deliberately by this audit. Physical phones, real screen-reader sessions, live authenticated role behavior and remaining offscale work are **NOT VERIFIED**.

**Disposition:** UI changes are validated by targeted browser tests and build. The broad-run one-test interruption prevents claiming 120/120 clean. Production physical-device accessibility signoff remains pending.

---

## Continuation checkpoint — catalog controls, shared panels and complete browser/PWA verification (19 Nov 2026)

**Environment:** Connected local Windows CPSU Market monorepo, Bun-only project tooling, React/Vite. All test log outputs and rollback copies are retained locally under ignored `.tmp/ux-*`. No code changes to the API, database, authentication, campus decisions, actual push delivery, or application routes were made by this UI work. No commit, push or deployment was initiated.

### Applied UI-only changes
- **Catalog administrator tap targets:** Replaced the legacy `.catalog-admin-actions .btn { min-height: 40px }` with `min-height: var(--ui-touch-target)` (**44px**). Populated campus and product/service categories now expose meaningful accessible button names such as **Edit campus CPSU Main Campus**, **Deactivate campus CPSU Main Campus** and **Edit product category Books**, avoiding indistinguishable repeated "Edit" controls.
- **15 targeted presentation substitutions:** Tokenized small remaining declarations in `admin-workspace.css` (5), `catalog-admin.css` (4) and `async-feedback.css` (6). This includes gaps, margins, skeleton geometry and a 650-weight progress title normalized to the existing bold role. A guarded one-match-per-replacement tool preserved pre-edit originals in `.tmp/ux-css8-originals`.
- **6 more shared native `Panel` wrappers:** Two in `pages-catalog-admin.tsx`, one in `pages-reviewers.tsx`, one in `pages-managed-content.tsx`, two in `store-review-widgets.tsx`. Native section/article/aside/div semantics and all original CSS classes, validation/handlers and publication decisions remain unchanged. AST-based migration had parse validation and rollback copies `.tmp/ux-panel9-originals`.
- **Populated admin UI browser test** `apps/web/e2e/ui-catalog-actions.pw.ts`: synthetic campus and two listing-type categories, width 360/768/1280, Chrome desktop and mobile emulation. Tests focus on descriptive controls, 44px edit actions, preserved content, no overflow, no WCAG A/AA violations, no mutation requests.

### Current measurements and interpretation
| Verification | Latest observation |
|---|---|
| Static CSS off-scale **heuristic** | **806 → 800** flagged declarations; zero-scale exit remains open, with 559 spacing / 167 font-size / 74 radius on this scan. Reported token count is a lower bound because the regex does not parse every nested CSS expression |
| New populated catalog browser checks | **6/6 PASS**, no synthetic writes |
| Production TypeScript + Vite build | **PASS** (pre-existing large-chunk warning remains) |
| Full web unit/component suite | **180 PASS / 0 FAIL**; 705 assertions on last run |
| Complete UI Playwright suite | **137/140 passed**. Two failures were Playwright `browserContext.close` trace-file ENOENTs and one was a report-button timeout; none established a reproduced WCAG issue |
| Isolated rerun of all three failures | **6/6 PASS** (each problematic scenario repeated twice, with dedicated output dir) |
| Static PWA asset validation | **PASS**, manifest/icons/offline and update contracts |
| Chromium PWA browser tests | **16/16 PASS**, desktop and 390px mobile emulation; offline/failure-safe/notification permission and edited-input-preserving A→B update |
| `git diff --check` | **PASS** |
| Screenshot comparison | Public 12 viewports: zero overflow/errors; authenticated 27 role-width snapshots: no runtime/axe/overflow failure. Changes were primarily small admin spacing shifts; Explore list text changed with live content from an independent task and should not be mistaken for a CSS regression |
| Image accessibility AST inspection | **0 genuine `<img>` elements missing `alt`**; earlier regex heuristic's 1 was a false positive |

**Unverified:** Physical iPhone/Android install, native safe areas, screen readers (VoiceOver/TalkBack/NVDA), live push delivery and actual student/admin accounts; strict zero off-scale CSS, remaining non-shared buttons/forms, intermittent public media failures, and the Vite JavaScript size warning. Prior homepage Lighthouse 97/100/100/100 was not remeasured in this pass. Production/mobile accessibility **not signed off**.

---

## Continuation pass 7 — shared public/transaction components, readable text, isolated browser suite (19 Nov 2026)

**Scope guard:** Presentation and accessibility only. The existing light palette, business actions, navigation, API contracts and database were not intentionally changed. Another process may be modifying the repository concurrently; the audit did not create a Git commit.

### Changes
- Migrated 13 further legacy JSX controls: **4 native labels** into `Field` and **9 native panels** into `Panel`, within `pages-public.tsx` and `pages-transactions.tsx`. Native HTML elements, classes, labels and handlers were preserved. Existing wrapper regression tests expanded to cover these pages.
- Normalized **42 near-scale padding/margin/gap declarations** across `transactions-polish.css`, `storefront-theme.css`, `storefront-page-polish.css` and `explore-page-polish.css`. The pass avoids fluid expressions, offsets below 4px, values above 64px, and non-spacing geometry. Backups stored in ignored `.tmp/ux-spacing6-backups` or `.tmp/ux-text-before` as applicable.
- Replaced **9 under-12px functional text rules** with `var(--ui-type-xs)` (12px): chat timestamps/type labels, small avatar initials, category labels, alert badge, PWA badge, image-zoom help, photo fallback label, and bottom-navigation text. Kept intentional editorial/photo-signature and third-party map-attribution rules untouched. No new color, font family or weight roles.
- Added `e2e/ui-text-zoom.pw.ts` with 7 routes under 200%-root-relative-font emulation at 360px. All seven passed in a standalone mobile-Chrome run. This is a **browser approximation only**, not physical iPhone or Android font scaling.
- Added `test/semantic-image-alt.test.ts`, using the TypeScript JSX AST to require an `alt` attribute on every native `<img>`. The standalone audit found **15 of 15 images declare alt**, including intentional empty decorative alts; no source image attribute changes were required.
- Updated `test/catalog-admin.test.tsx` to select the existing specific accessible button names (e.g. Edit campus Main Campus) after unrelated concurrent UI refinements. No production catalog behavior changed; the focused catalog tests returned 2/2 passing.
- Strengthened `e2e/accessibility-states.pw.ts` against a rare destroyed browser context during a late navigation: retries axe **only once** when the error is explicitly a destroyed execution context, and re-verifies the exact expected UI state before scanning again. Real violations still fail.
- Created `playwright.ui-audit.config.ts` with a dedicated server on port **5293** to avoid collisions with other Playwright runs using the default port 5189. Browser evidence is saved under an isolated ignored `.tmp` path.

### Verified evidence
| Gate | Current |
|---|---|
| Static off-scale count (98 CSS/TSX scanned) | **766** potential declarations: 533 spacing, 159 type, 74 radius; strict zero NOT met |
| Text readability rules raised to the smallest approved scale | 9 |
| Additional shared native wrappers in this pass | 13 |
| Additional conservative spacing replacements | 42 |
| Standalone 200% root-relative font checks | 7/7 pass |
| Isolated mobile Chrome marketplace, a11y states and text zoom | 16/16 pass |
| Unit tests (before extra image-alt regression test) | 180 passed, 0 failed |
| Production build / TS | Pass; pre-existing >500KB Vite chunk warning remains |
| PWA manifest/offline-shell validator | Pass, including current update/repair safeguards |
| `git diff --check` | Pass |
| Physical phones, TalkBack/VoiceOver/Narrator, live student/admin login | **Not verified** |

### Visual regression review
- 12 public snapshots were taken before/after native JSX consolidation; no document overflow, undersized visible mobile hit targets or page errors. Max sampled pixel delta over threshold: ~1.91% (Explore at 768px).
- Additional 12 public and 3 synthetic transaction screenshots were taken before/after the four-file CSS spacing pass. Maximum observed delta: Explore 360px ~7.93%; transaction mobile ~5.19%. Inspected before/after images: slightly more compact card and empty-state spacing, no visible clipping. This is an intentional spacing refinement, not exact pixel parity.
- Nine small-text changes were compared in 12 more public screenshots: max changed pixels over the 12-channel threshold ~1.85% (Explore tablet); mobile samples <0.35%; no overflow, undersized hit targets or JS errors found.
- Source-only scanner previously marked one `img` as missing alt; the stricter AST audit found no missing native JSX alt attributes, confirming this was a static-parser false positive.

### Browser infrastructure caveat
A full browser run on shared port 5189 suffered widespread `ERR_CONNECTION_REFUSED` when its server was stopped by competing test jobs. Its results are **invalid as a UI failure score**. The dedicated 5293 audit runner was launched to obtain isolated results; append its verified final outcome separately below rather than treating the failed shared-port run as a product regression.

**Release status remains pending:** remaining off-scale declarations, legacy buttons/modal consolidation, real-device and real-screen-reader testing, and authorized live-account acceptance.

### Final verified results — pass 7

- **Isolated complete desktop/mobile Playwright suite: 140/140 passed, 0 failed**, using `bunx playwright test --config=playwright.ui-audit.config.ts --output=../../.tmp/ux-full-5293-output`. Separate server port **5293** remained available for the complete ~2.7-minute run; no browser tests failed.
- **Bun web unit/component tests: 181/181 passed, 0 failed**, including the new native image-alt contract test.
- **Production build / TypeScript check: PASS**, `bun run pwa:check`: **PASS**, `git diff --check`: **PASS**.
- Fresh local production-preview Lighthouse homepage scores: **Performance 97 / Accessibility 100 / Best Practices 100 / SEO 100**. There were **0 console errors** in this run. The extra agentic-browsing category scored 50 and is not in the requested core UI/a11y release gate. Earlier scores retained with no regression.
- Final measured static scan: **766 off-scale candidates** (533 spacing, 159 type, 74 radius) across 98 CSS/TSX files. This is not zero and includes possible intentional geometry/editorial exceptions; keep strict full-normalization criterion OPEN.
- The full suite succeeds **only after isolating** its web server and output directory. A previous run on the shared default port 5189 failed when that server disappeared; its 135 connection-refused errors are not considered product failures.
- Physical iPhone Safari and Android Chrome PWA install/push checks, VoiceOver/TalkBack/Narrator hands-on sessions, and real logged-in university accounts are still **NOT VERIFIED**. These require direct access to actual devices and authorized accounts. No production approval or real-device acceptance is claimed.
- No Git commit, backend changes, authentication changes, database changes or color-palette edits were intentionally made in this audit.

---

## Continuation checkpoint — store ratings and reviews consistency (19 November 2026)

**Scope:** UI-only presentation and test reliability. All sources were checked on the connected Windows CPSU Market repository. No Codex, API/schema modifications, credentials, staging flags, Git commit, push or deployment. Other tasks were modifying parts of the working tree concurrently.

### Implementation
- Normalized **16 store-review CSS declarations** using the existing spacing scale. Changes were limited to review section gaps and padding; did not alter color tokens, star-rating logic, moderation, routes, database or API contracts. Original stylesheet backed up at ignored `.tmp/ux-review-scale-backup.css`.
- Consolidated **three native review form labels** into the shared `Field` component: buyer's optional review text, administrator's moderation reason, and the eligible-transaction chooser. Native label association and form event handlers remain intact. Touched only `store-review-widgets.tsx` and `store-review-entry.tsx`.
- Added persistent `apps/web/e2e/ui-store-review.pw.ts` with **10 new Chrome desktop/mobile checks**: 360/768/1280 populated public review sections, published five-star distribution, responsive overflow, approved-review empty state, 44px star selection targets, accessible native radio selection, and axe WCAG A/AA. Only synthetic API data; no review submission or live student records.
- Improved the existing student and administrator UI test harnesses to retry **only** an interrupted axe scan when session navigation destroys the browser evaluation context. Reassert expected page visibility, retain zero-violation expectations and fail all other errors. No production app logic changed.

### Measured results
| Metric | Result |
|---|---|
| Source-scale heuristic | **766 → 758 off-scale declarations**, with source-file denominator **98 → 99** because other work was added (525 spacing, 159 font-size, 74 radius at checkpoint); strict zero remains open |
| Web unit/component tests | **192 passed, zero failed** (includes concurrent unrelated test additions) |
| New store-review browser tests | **10/10 passed** across desktop/mobile Chrome |
| Combined review + student + administrator Playwright | **44/44 passed** on final isolated-output rerun, after an earlier run had one transient Saved-listings/navigation scan and another had one admin Transactions/navigation scan |
| Mobile Saved-listings isolated replay | **3/3 passed** |
| Review section screenshots | Before/after at 360, 768, 1280: same content, review distribution and controls, no clipping. Review section height changed by +5px at 360 and +2px at 768/1280; widths unchanged |
| Production TypeScript/Vite build | **PASS**; known >500KB JavaScript chunk warning remains |
| Git diff whitespace check | **PASS** at last check; recheck at release since concurrent files continue to change |

### Remaining gates
- **Physical** iPhone/Android installed PWA, VoiceOver/TalkBack/Narrator, 200% OS-level text enlargement, HTTPS/native push delivery and actual authorized accounts remain **UNVERIFIED**.
- Static CSS audit is a **heuristic**, not a proof of incorrect rendering. The remaining 758 flagged expressions include intentional editorial/geometry values and require selector-by-selector inspection with screenshots.
- Existing large Vite chunk warning, media outages and production backend constraints are out of the current visual-only work and not claimed fixed.
- Tests were run against local synthetic fixtures; no real review data or moderation decision was changed.

**Disposition:** Current UI normalization batch and automated review/student/admin test acceptance **PASS**. Strict all-screens zero off-scale and physical-device accessibility release sign-off **remain open**.

---

## Continuation pass 8 — legacy button compatibility, modal keyboard audit and mixed-token cleanup (19 Nov 2026)

**Working-tree policy:** The repository is being edited by other project tasks. This UI pass did not stage files, create a commit, change existing light-mode colors, alter production APIs, or perform database migrations. Existing functionality, route semantics, and native form submit defaults were preserved.

### Shared controls
- Added `components/ui/legacy-button.tsx` as a **transitional compatibility wrapper** around the native HTML `<button>` and existing `.btn` CSS. It forwards refs and all native button props, preserves caller-provided `type`, `onClick`, `aria-*`, `disabled`, and class suffixes (ghost, danger, storefront, CTA). It deliberately does **not** set a default `type` that could break forms, nor does it inject shadcn classes into legacy layouts.
- Migrated **55 exact static `.btn` controls** via a TypeScript-AST transformation with original source backups saved in ignored `.tmp/ux-legacy-before-*`:
  `pages-managed-content.tsx` 8, `pages-reviewers.tsx` 7, `pages-catalog-admin.tsx` 11, `pages-public.tsx` 13, `pages-transactions.tsx` 10, `pages-storefront.tsx` 6.
- Added `test/ui-legacy-button.test.tsx` to assert native markup, class compatibility, explicit and implicit submit semantics, accessibility attrs and migration coverage. This is a safe bridge toward the shared shadcn `Button`; it does not imply all old `.btn` usages are gone.

### Visual verification
- Nine synthetic admin section screenshots (catalog, content, reviewer staff at 360, 768, 1280px) were **pixel-identical before/after** the 26-button admin batch. All nine had zero automated WCAG A/AA violations, JavaScript errors, horizontal overflow and undersized visible controls in the synthetic fixtures.
- The remaining 29 buttons were compared through 12 public-page and 3 synthetic transaction snapshots before/after: all three transaction screenshots were pixel-identical. Other public frames were identical or had small content-timing differences; the largest changed-pixel percentage was ~1.74% in Explore desktop, caused by dynamic listing imagery rather than the button geometry.
- The source wrapper continues to render the exact same native class selectors, therefore no new color, shape, focus or layout rules were introduced.

### Accessible photo modal
- Added `e2e/ui-photo-modal.pw.ts` using synthetic listing photos from already-shipped public icon assets; no real student images/data are involved. Both desktop/mobile Chrome verify keyboard focus trap, Shift+Tab/Tab wrapping, Escape-to-close with focus restoration, ArrowRight/ArrowLeft photo navigation, and keyboard + / - zoom. **4/4 focused browser tests passed.**
- Exported `syntheticListing` from the Playwright-only mock fixture for this test; no production listing/API behavior was changed.

### CSS scale pass
- Converted **14 additional near-scale mixed spacing literals** in seven non-editorial stylesheet candidates, using existing `--ui-space-*` tokens. The scanner skips `clamp()`, `calc()`, negative offsets, non-spacing values, and function interiors. Backups are retained in ignored `.tmp/ux-mixed8-before`.
- The latest static scan reports **748 potential off-scale declarations** across 99 CSS/TSX files (515 spacing, 159 type, 74 radius). The strict zero target is **still open**; fluid/semantic geometry requires manual exceptions and inspection.
- Repeated public screenshots after the mixed-token pass: no horizontal overflow, accessibility target regression or route errors in sampled views. A ~4.14%-pixel difference on Explore 360px came from an asynchronously loaded listing image; manual image comparison did not show a layout regression.

### Test reliability
- `playwright.ui-audit.config.ts` now accepts validated optional `UI_AUDIT_PORT` (default 5293) so browser suites can start independent dev servers on free ports rather than collide with other work. Output directories remain isolated under ignored `.tmp`.
- The unit suite after the mixed-token pass: **193 passed / 0 failed**; production TypeScript + Vite build passed; existing >500kB chunk warning remains.
- A new complete desktop/mobile Playwright run has been launched on isolated port 5593. Append the final result separately when verified rather than inferring a pass in advance.

### Open acceptance gates
Physical iOS Safari/VoiceOver, Android Chrome/TalkBack, installed-PWA push tests, hands-on Windows Narrator/NVDA, real credential/permission acceptance and the remaining strict off-scale count are **not verified**. Do not treat synthetic browser/a11y results as real-device production signoff.

### Pass 8 final release-gate verification — measured, not assumed

- **Complete isolated browser suite: 154/154 Playwright tests passed (0 failed)** on desktop and mobile Chrome, with a distinct `UI_AUDIT_PORT=5593` and ignored output directory `.tmp/ux-pass8-full-e2e`. This includes the additional photo-modal and populated catalog tests.
- **Web unit/component tests: 193/193 passed (0 failed)** after the mixed CSS and legacy-button migrations. Existing API, database and production authentication logic were not modified in this pass.
- Production Vite/TypeScript build: **PASS**, with pre-existing >500KB script-chunk warning.
- PWA manifest/icons/offline/update/repair validator: **PASS**.
- `git diff --check`: **PASS**.
- Fresh homepage Lighthouse (local production preview): **Performance 97 / Accessibility 100 / Best Practices 100 / SEO 100**, zero Lighthouse console errors. Extra `agentic-browsing` category 50 remains outside the requested core UI/a11y target.
- Latest off-scale source audit: **740 candidates** (509 spacing, 157 type, 74 radius) across **99 CSS/TSX files**. This rolling source count differs slightly from the earlier 748 reading because other source files changed concurrently. The strict zero-offscale requirement is **NOT MET**.
- User-facing accessibility results above are **automated/synthetic browser checks only**, not a physical iPhone/Android, TalkBack/VoiceOver, hands-on Narrator, real account or production PWA push acceptance.
- No Git commit or stage action was performed. Current repository HEAD remained `d218231` during verification; other working-tree files belong to concurrent projects and should not be discarded by this audit.

**Disposition:** The updated UI batch passes automated tests and visual regression checks. A full production signoff remains open until actual-device/assistive-technology acceptance, real authenticated-role journeys and residual CSS exceptions are reviewed.
