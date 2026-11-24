# Homepage search and hierarchy simplification — 18 November 2026

## Scope
UI-only work on the existing CPSU Student Marketplace home and Explore routes. Preserve all active marketplace and admin functions, published data, search query parameters and category IDs.

## Changes
- Home and Explore now omit the redundant desktop masthead search; the masthead search remains on other routes.
- Homepage hero retains one functional search, removes duplicate Explore/Sell CTAs and reassurance chips. Explore navigation, selling CTA and trust details remain available elsewhere on the page.
- Category cards use context-specific line icons; category names and destinations are unchanged.
- Reduced hero/category/listing spacing; mobile search precedes the editorial hero image. Mobile Search remains icon-only with an accessible label.
- Added a small last-loaded CSS override instead of replacing existing editorial design or admin-managed content styling.

## Files
- Modified: `apps/web/src/main.tsx`, `apps/web/src/pages-public.tsx`, `apps/web/src/icons.tsx`
- Added: `apps/web/src/home-simplification.css`

## Validation
- `bun run build` from `apps/web`: PASS (TypeScript and Vite).
- `bun test apps/web/test/home-listings.test.mjs apps/web/test/home-page-content.test.ts`: 4 passed, 0 failed.
- Local Playwright browser: desktop Home 1 hero search / 0 masthead searches, Explore 1 dedicated search / 0 masthead searches, Guidelines keeps 1 masthead search.
- Entered 'calculator' in the Home search; navigated to `/explore?q=calculator` as expected.
- Mobile browser widths 320px, 360px, 390px, 768px: no document-width overflow in measured checks; icon-only Home search at 320px and 390px; search appears before hero art at 320px/390px.
- Category options loaded from existing API; no seeded or fabricated listings.

## Not performed
No API or database changes, migrations, deployments, Git commits, pushes or production operations. Existing unrelated local modifications were preserved.

## Remaining acceptance
Physical iPhone Safari and Android Chrome tap/keyboard checks and visual review on the target devices were not performed.

## Hero positioning refinement — 18 November 2026
- Replaced absolutely positioned hero photography and floating search with a two-row CSS grid at desktop widths: copy/photo followed by a dedicated search row.
- Removed the large green pseudo-element and overlapping photo decorations; preserved the admin-managed hero image.
- At 900px and below, copy/search/photo stack in ordinary flow without overlapping.
- Local browser viewport checks at 320, 360, 390, 768, 900, 1024 and 1440px showed zero photo/search overlap and no horizontal document overflow. The green decoration computed as `content: none`.
- Inspected desktop and mobile rendered screenshots; full web build and four focused homepage tests passed. No API, database, migration, deploy, commit or push changes.

## Artistic asymmetrical hero photo — 18 November 2026
- Implemented a normalized SVG clipping path for the public hero photo, following the user-provided curved/uneven reference, with responsive CSS border-radius fallback.
- Added small amber and terracotta accents BEHIND the image within its own grid area. The large green background shape remains removed.
- Search remains in its own row, never over the image. Admin-managed hero source and error fallback remain unchanged.
- Files modified: `apps/web/src/pages-public.tsx`, `apps/web/src/home-simplification.css`.
- Browser screenshot review on desktop (1440px) and mobile (390px). Verified no photo/search, photo/text or search/category overlap and no horizontal overflow at 320/360/390/768/900/1024/1440px.
- `bun run build`: passed; `bun test apps/web/test/home-listings.test.mjs apps/web/test/home-page-content.test.ts`: 4 passed.
- No DB operations, migrations, deployments, commits, or pushes.

## Larger, smooth continuous hero crop — 18 November 2026
- Adjusted the normalized SVG `clipPath` on the existing admin-managed hero photo to a fully curved, closed outline without straight cut edges or hard corners.
- Increased the desktop artwork grid share to 1.09fr and height to a maximum of 465px; increased tablet and mobile artwork height appropriately.
- Softened the amber and terracotta shapes with rounded elliptical borders behind the photo, leaving all UI controls, uploaded image source, and fallback behavior intact.
- Local Playwright visual checks: desktop 1440px with loaded admin photo, mobile 390px using the compiled Vite preview; measured no overlaps and no horizontal overflow at 320, 360, 390, 768, 900, 1024, and 1440px.
- `bun run build`: PASS on the hero changes before a separate concurrent `header-search-polish.css` import appeared in main.tsx; four focused homepage tests: PASS.
- Unrelated current dev-server blocker observed during verification: main.tsx references `header-search-polish.css`, which does not currently exist. This was not changed as part of hero work.
- No backend/database changes, migration, deployment, commit or push.

### Concurrent header-search compatibility verified
- The missing `header-search-polish.css` import was subsequently supplied by another local change; no modification was made to that unrelated work.
- A concurrent homepage change moved search into the header. Added CSS `:not(:has(> .hero-search))` handling so the hero uses a clean 2-column copy/art layout without an empty search row, and stacks copy/art on smaller viewports.
- Final `bun run build` with both sets of local changes: PASS. Local browser: one header search, no obsolete hero search, correct responsive grid at 1440px and 390px.

## Larger organic hero artwork — final sizing pass
- Increased the actual active header-layout hero image dimensions: at desktop 1440px from ~563 × 420px to ~653 × 535px (about 48% more area). Increased phone image height to 281px at 390px screen width.
- Updated the hero grid proportions, internal gap and padding to allocate more width to the photo without overlapping headline or other elements. Changed both `home-simplification.css` and active later-loaded `header-search-polish.css` styles so CSS precedence no longer cancels the enlargement.
- Preserved the admin-managed hero photo, organic SVG crop, and mustard/terracotta decorative accents. No additional search fields were introduced.
- Browser acceptance at 320, 360, 390, 768, 900, 1024 and 1440px: no horizontal page overflow, no headline clipping, no photo overlap with copy or categories; one header search remains functional in the DOM.
- `bun run build` succeeded and four homepage tests passed. No database, deployment, migration, Git commit or push.

## Hero text-to-image proportion audit — 18 November 2026
- Measured the 1440px baseline: image 653×535px, headline 64.8px, body 16px, copy group 296px high. Text felt under-scaled compared with the expanded image.
- Updated the active `apps/web/src/header-search-polish.css`: desktop headline up to 78px, body up to 18px, eyebrow 12px; adjusted line-height, tracking, spacing and responsive type sizing. Copy remains the current admin-managed content.
- Corrected the unexpected stacked hero at 861–900px to retain the split text/photo layout; other tablet breakpoints remain split and phones stack correctly.
- Verified in-browser across 320, 360, 390, 560, 701, 768, 860, 900, 901, 1024 and 1440px: no heading scroll overflow, zero photo/copy and hero/category overlap, no page-width overflow, all headline lines retain their intended grouping.
- Inspected desktop, tablet and phone screenshots at 1440, 768, 390 and 320px. TypeScript/Vite production build passed; 4 focused homepage tests passed.
- Preserved search, listings, managed image, shape and all other functions. No database changes, migrations, deployment, commit or push.
