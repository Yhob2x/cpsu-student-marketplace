# Explore mobile vertical grid — 17 November 2026

The latest Explore direction is a normal vertical results grid. This supersedes the linked-row interaction described in `MOBILE_EXPLORE_LINKED_ROWS_2026-11-17.md` and `MOBILE_EXPLORE_SAFARI_TOUCH_SWIPE_FIX_2026-11-17.md` for the current implementation.

## Implementation

- Explore renders the existing `ListingCard` components in the responsive `.listing-grid` without a scroll container, swipe hint, arrow controls, or Explore touch handler. Phone widths show two complete columns; enlarged text may reduce the grid to one column to prevent overflow.
- The listing price now follows the title in the card markup, before category, seller, and campus details. Explore removes the reserved two-line title height so one-line titles do not leave a blank gap above the price.
- The mobile type chips remain the single visible type control. The detailed panel retains the type selector on wider screens. Both update the same URL filter and API query.
- Mobile spacing above results is tightened. Search, detailed filters, sorting, pagination, Save, and listing links retain their existing behavior. Home carousels and product-gallery gestures are unchanged.

## Product-card emphasis

The supplied shopping-app screenshot informed the relationship between the browsing background and cards. Explore now uses the existing pale gray-green `--surface-neutral` behind white listing cards, with subtle borders and shadows, square edge-to-edge photo areas, and forest-green prices. The mobile canvas runs to the screen edges while card content stays inside the safe layout gutters. This uses the approved CPSU palette and does not add discounts, sales counts, ratings, shipping claims, or other data the marketplace does not have. Loading placeholders occupy the same canvas; empty and error states do not leave an empty colored grid behind.

## Search access while browsing

On phone and tablet widths, the Explore search toolbar sticks to the top of the viewport as the listing grid scrolls. Its visible label collapses to save space while the input retains an accessible label and a descriptive placeholder. On desktop widths, the existing masthead, which contains the global listing search, stays visible. The mobile bottom navigation and listing controls remain independent.

Headless Chrome confirmed the mobile toolbar at the viewport top after scrolling at 320, 390, and 430 px, with a 48 px input, no horizontal overflow, and a focusable labelled field. At 200% text size on 320 px it remained sticky without overflow. The desktop header search stayed visible at 1024 px. Physical iPhone Safari keyboard and safe-area behavior still need device acceptance.

No API, database, migration, or business-rule change was required.

## Verification

- Web TypeScript, production Vite build, and web unit tests passed.
- Isolated headless Chrome with synthetic listings at 320, 390, and 430 px showed two complete columns and no horizontal overflow. The first card began at approximately 532 px at 320 and 474 px at 390. At 200% root text size on 320 px, the grid used one column without overflow.
- Chrome touch emulation scrolled the page vertically. Type filtering, sorting, page two navigation, guest Save return path, and listing-card navigation passed. The browser run used synthetic API responses and made no student database changes.
- Physical iPhone Safari testing remains necessary before claiming device acceptance.
