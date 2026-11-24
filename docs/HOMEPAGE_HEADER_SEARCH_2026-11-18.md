# CPSU Market — Homepage Header Search & Typography Refinement
**Date:** 18 November 2026 (Asia/Manila)
**Environment:** Authorized local CPSU Student Marketplace (Vite React frontend)
**Intent:** Use the supplied Shopee screenshot only as an information-hierarchy reference. Preserve CPSU identity, functional search and managed homepage content.

## Implemented
- Restored **HeaderSearch** on Home and Explore, and kept it available on all other routes. Reused the existing query submission logic: `/explore?q=<URL-encoded term>`; no API, storage or authentication changes.
- Removed the entire homepage hero search form and its local query state. The hero now contains only the existing admin-managed heading/copy and approved hero image; admin-managed text/image publication is unchanged.
- Refined the header's brand → search → account hierarchy: full-width search with icon action, consistently sized inputs/buttons, even gaps and typography, aligned desktop utility/nav rows. Deliberately did **not** copy Shopee's color scheme, trademark, fake cart or promotions.
- On screens up to 860px, the header has a compact brand/account first row and a full-width search second row. The earlier four-item bottom nav and floating Messages icon remain intact.
- Reduced excess homepage hero spacing, scoped the hero overrides with `.home-hero`, kept headline in DM Serif Display and UI in Inter, and corrected tablet (701–860px) hero placement alongside the image.
- At 320px, kept the category heading and View all on the same row.
- Header controls retain accessible names, keyboard focus indicator and input sizing to avoid iOS zoom.

## Files in scope
- `apps/web/src/main.tsx` — render global HeaderSearch on every route; add scoped stylesheet
- `apps/web/src/pages-public.tsx` — remove homepage hero search and unused local state; add `home-hero` class
- `apps/web/src/header-search-polish.css` — new responsive header, spacing and typography refinements

## Verification
- `cd apps/web && bun run build`: passed (TypeScript and Vite production bundle).
- `cd apps/web && bun test`: **77 passed, 0 failed** across 24 files.
- Impeccable source detector: `[]` (no findings; not a full WCAG assessment).
- Local Chrome guest tests at **320, 360, 390, 768, 1024, 1280 CSS px**: 1 visible header search, 0 hero search, no document-wide overflow, no search/account overlap. Search term `handmade books` navigated to `/explore?q=handmade%20books`.
- Synthetic signed-in browser tests at **320, 390, 768, 1024, 1280 CSS px**: header search visible, no brand/account/search overlap or document overflow, no hero search. Synthetic auth was intercepted only in the browser; no real account changed. Header search also present on Explore.
- Tablet follow-up verified CSS grid `"copy art"` with photo to the right. Guest screenshots kept under local `.tmp/header-search-*.png`; synthetic signed-in evidence under `.tmp/header-signed-*.png`.
- Physical iPhone Safari/Android Chrome and true account end-to-end acceptance remain pending.

**Change controls:** No database migrations, API changes, deployments, Git commits, pushes, or existing user-data mutations. Unrelated in-progress code and content-management work was preserved.
