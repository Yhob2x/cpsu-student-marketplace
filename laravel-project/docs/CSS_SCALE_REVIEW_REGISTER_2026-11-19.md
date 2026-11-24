# CPSU Market — CSS scale review register
**Date:** November 19, 2026  
**Source:** `apps/web/src` CSS, current local working tree.  
**Status:** **OPEN — reviewed categories are not automatic approvals or release exceptions.**

## Applied in this implementation pass

- Replaced 97 near-scale padding, margin and gap literals with existing `--ui-space-*` tokens in eight stylesheets. Kept functions such as `calc()`, `clamp()` and `env()`, negative offsets, exact geometry, values outside the 4–64px spacing range and non-spacing declarations unchanged.
- Raised the newly introduced home/explore store-rating number from 11.2px to `var(--ui-type-xs)` (12px).
- Added `apps/web/test/ui-spacing-regression.test.ts`, preventing near-scale literals from returning in the eight migrated stylesheets. Existing `font-size-floor.test.ts` enforces positive authored CSS font sizes of at least 12px.
- Preserved the existing palette, interactions, and native component markup. Original modified files have copies under ignored `.tmp/ux-pass11-css-backups`.

## Remaining scope — two complementary scanners

The older conservative source heuristic reports **671 candidates** across **101 CSS/TSX files**, categorized as 447 spacing, 149 typography and 75 radius declarations. The PostCSS declaration parser reports **868 candidates** across 58 CSS files. These totals are **not directly comparable**: the PostCSS scanner traverses declarations that the first regex-based heuristic skips, including responsive expressions and compressed CSS. Neither count equals the number of verified visual defects.

| Pending review class | PostCSS instances | Intended handling |
|---|---:|---|
| Static non-scale values | 487 | Prioritize by active route and component; compare 360/768/1280px captures before/after replacement |
| Responsive formulas | 301 | Keep behavior-dependent values until their fluid range and wrapping are reviewed |
| Specialized surface shapes | 40 | Evaluate chat corners, image masking, and modal silhouettes individually |
| Negative layout offsets | 28 | Test stacked layers, bleed, safe areas and sticky elements; do not round blindly |
| Large spacing values | 7 | Review page composition, section rhythm, and desktop empty space |
| Display type sizes | 5 | Preserve the intended editorial hierarchy unless screenshot and WCAG reflow evidence supports changing |

**Provisional classification is NOT an exception approval.** Literal usage in a `clamp()` or decorative selector does not automatically make it accessible; it merely identifies the correct visual QA path.

## Highest priority source files

1. `styles.css` (30 pending manual-review instances): public/global component behavior; requires broad screenshot coverage.
2. `editorial-redesign.css` (29): hero, headline and CTA composition, including desktop-to-mobile transitions.
3. `floating-chat.css` (26): chat bubble geometry, keyboard focus and bottom-dock positioning.
4. `store-reviews.css` (26): rating control, star placement, and readable reviews.
5. `my-store.css` (25): seller workspace and editor responsiveness.
6. `storefront.css` (25): public seller identity, profile and listing cards.
7. `push-settings.css` (24): critical permission/error states and assistive-technology labeling.
8. `storefront-theme.css` (23): editorial display geometry and public store card hierarchy.

Review the exact selector and declaration in `.tmp/ux-pass10-scale-triage.json` before editing. A small code change should include a pre-change screenshot, a post-change screenshot, and a repeatable browser assertion. Keep other contributors' modifications intact.

## Exit criteria still open

- No increase in unsupported off-scale values and no unauthorized token/palette changes.
- Annotated, approved review of remaining static non-scale styles versus intentional design exceptions.
- Desktop and mobile synthetic viewport/keyboard/axe checks remain green.
- **Physical iOS and Android** PWA installation, permission handling, offline state, notifications, large text and VoiceOver/TalkBack tests completed with evidence.
- Real student, seller, reviewer and admin sessions approved for testing and exercised without synthetic fixtures.

**No production accessibility signoff should be inferred from automated Chrome or static scans alone.**
