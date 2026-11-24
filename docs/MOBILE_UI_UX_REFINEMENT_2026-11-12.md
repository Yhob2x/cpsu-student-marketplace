# Mobile UI/UX audit and refinement — CPSU Student Marketplace

**Date:** 12 November 2026  
**Scope:** Local Windows workspace only, `apps/web` React/Vite PWA  
**Design authority:** `MASTER_BLUEPRINT.md`, `docs/UI_UX_GUIDELINES.md`; retain the white/forest-green theme and all existing APIs, listing data, permissions and workflows.  
**Method:** Read incumbent UI code, consulted installed UI UX Pro Max and Impeccable guidance, inspected rendered Chrome mobile screenshots, implemented only scoped mobile refinements, then retested.

## Prioritized evidence-backed findings

| Priority | Element | Verified before | Resolution |
|---|---|---|---|
| P1 | Home decorative `.hero-art` and tall `.hero` | 320px viewport: 847px hero; first category at y≈981px. 390px: 682px hero. | Phone: hide decorative photo/placeholder collage, compact heading/body and hero spacing. Tablet with mobile bottom bar: hide decorative art too. Desktop imagery preserved. |
| P1 | Explore full `.filters.filter-panel` | First product card at y≈714px on 320px, y≈653px on 390px. | Keep search prominent, add immediate All/Products/Services controls, collapse detailed filters by default on phones, preserve URL-backed filtering. |
| P2 | Narrow Campus/Category selects | Two cramped columns at 320px; long choices visibly cut off. | In the expanded 320px mobile panel give all six fields a full-width column. Desktop filter grid remains unchanged. |
| P2 | Listing card body and price metadata | Some card labels were only ≈12px and card gutters compact. | Raise titles to ≈14.9px; rebalance metadata and card padding while preserving the two-column mobile grid, independent Save control and overflow checks. |
| P2 | Bottom app navigation hit targets | ≈46.7px tab height on 320–390px. | Set mobile minimum to 48px without changing five destinations or active-state semantics. |
| P2 | Login/register card top whitespace and Messages heading action | Form top margin 24px, Messages action 40px on small screens. | Trim form top margin and restore ≥44px Messages action. |

## Implemented local changes

- `apps/web/src/pages-public.tsx` — mobile-only three-state listing type chips bound to the existing URL query; advanced filters toggle with `aria-expanded`, `aria-controls` and a visible active count; no new API logic or library.
- `apps/web/src/icons.tsx` — tiny SVG sliders and chevron glyphs, in the existing inline icon style.
- `apps/web/src/mobile-refinements.css` — scoped mobile responsive styles: compact content-first hero, accessible filter controls, phone-sized text/spacing, 48px bottom navigation, full-width advanced fields at ≤360px, tablet PWA hero refinement, and reduced-motion-aware interaction styles.
- `apps/web/src/main.tsx` — imports the scoped stylesheet after the existing CSS layers.

## Before vs after (measured in local Chrome browser emulation)

| Metric | Before | After |
|---|---:|---:|
| Home hero height at 320px | 847px | **508px** |
| Home hero height at 390px | 682px | **394px** |
| Explore first card top at 320px | ≈714px | **≈529px** |
| Explore first card top at 390px | ≈653px | **≈472px** |
| Tablet Home hero at 768px | ≈698px | **436px** |
| Mobile bottom tab hit height | ≈46.7px | **48px minimum** |

## Interaction and regression checks

- Chrome responsive checks (production build): 320, 360, 390, 414, 560, 768 and 1024px; **no document-level horizontal overflow**.
- Mobile advanced filter panel closed by default; toggles open/closed and 320px fields have full usable width.
- All / Products / Services chips: `aria-pressed` changes correctly; URL query, actual result counts and items update from the API (7 service listings in the tested local API sample). Selection keeps other active advanced filters; choosing Service clears incompatible product-condition filters.
- Selected campus gives `1 active` on the filter toggle when collapsed; existing Reset control clears the URL and chips.
- 200% root font at 320px: no horizontal overflow, no clipped bottom-nav labels; visible input text remains at a readable size.
- Desktop 1024px: the original advanced three-column grid remains visible and mobile-only type chips/toggle are hidden.
- Production Vite/TypeScript build passed and Bun API unit suite passed (5 pass, 1 integration suite intentionally skipped in root command).
- `bun run pwa:check` passed: PWA manifest, normal/maskable icons, and offline-only caching contracts preserved.
- Axe-core WCAG/best-practice scans at 320px and 390px for Home, Explore and Login: **0 confirmed violations**. Axe still returned inconclusive contrast results on decorative stretched listing-card links (Home 96 nodes, Explore 119 nodes); these require manual review.
- No physical phone or assistive-technology testing performed. This is browser emulation, not actual device sign-off.
- A Vite dev-server interruption invalidated one browser run on tablet/desktop; those readings were discarded and the final production-preview checks passed without runtime exceptions.

## QA screenshots

- `docs/qa/mobile-home-320-refined.png`
- `docs/qa/mobile-explore-320-refined.png`
- `docs/qa/mobile-home-390-refined.png`
- `docs/qa/mobile-explore-390-refined.png`

Screenshots are from Chrome's mobile-width emulation, not physical-device captures.

## Outstanding release gates

- Physical Android Chrome and iPhone Safari installation, notch/home-indicator safe-area, landscape, keyboard, scrolling and touch hit-area checks.
- VoiceOver/TalkBack real announcements and manual visual-contrast review of listing cards.
- Institution/branding approvals and previous privacy/security gates from `MASTER_BLUEPRINT.md` still apply.

**Safety:** No GitHub push, commit, production deployment, user database migration or credential modification. Existing unrelated local modifications were preserved.
