# Explore listing filters — breathing room and simplified chip rails

**Date:** 18 November 2026  
**Scope:** UI-only polish on the CPSU Market desktop/mobile/PWA Explore screen.

## Changes
- Removed the separate previous/next arrow buttons from Campus and Category filters.
- Kept native horizontal scrolling, keyboard focus and accessible filter buttons; overflowing chip rails now have a subtle edge fade and thin scroll thumb instead of an arrow overlay.
- Improved hierarchy by placing labels above each set of options and increasing the gap between Campus, Category, Condition and Price.
- Increased panel padding, button spacing, and breathing room around the All/Products/Services tabs and listing-count/sort toolbar.
- Kept the same URL-backed filter state, sorting, price validation, reset, search, listings, responsive grid, and existing features.
- No dropdowns or new controls added. No API, schema, record, authentication or security change.

## Files
- `apps/web/src/explore-scroll-options.tsx`
- `apps/web/src/explore-scroll-cues.css`
- `apps/web/src/explore-page-polish.css`

## Verification
- Focused Bun tests for Explore filtering and scroll-state behavior: **7/7 passed**.
- `bun run build` from `apps/web`: TypeScript and Vite build **passed**.
- Read-only local headless Chrome verification at 320, 390, 768, 1440 px: **no arrow controls, no horizontal page overflow**.
- At 390 px, the overflowing Campus filter rail moved from scrollLeft 0 to 158 px when scrolled.
- Existing product cards and accessible selected button states remained present in the tested page.
- Physical Safari/Android testing still pending; Chrome emulation is not equivalent to physical-device approval.

No database migrations, deployments or Git commits.
