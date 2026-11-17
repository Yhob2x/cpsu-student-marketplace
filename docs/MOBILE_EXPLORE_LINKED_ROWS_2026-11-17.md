# CPSU Market — Linked two-row browsing in mobile Explore

**Date:** 2026-11-17  
**Scope:** Explore results on phones, when enough listings are returned to populate two rows.

## User intent
Swiping horizontally across **either** the upper row or the lower row should move **both** rows the same amount, keeping cards aligned by column. Vertical page scrolling and independent card Save/open actions must continue working.

## Diagnosis
The existing Explore implementation already used one horizontally scrollable CSS grid with `grid-auto-flow: column` and two rows when 5+ results were present. It was **not** two independent scrollbars. Synthetic Chrome mobile touch tests confirmed this: top-row swipe and bottom-row swipe both changed the same `scrollLeft`.

The two-row mode was previously inferred by CSS `:has(> .product-card:nth-child(5))`, an indirect selector. The user-facing controls did not explicitly communicate that the two rows moved together.

## Refinement
- In `apps/web/src/pages-public.tsx`, derive `data-scrollable` (3+ listings) and `data-linked-rows` (5+ listings) directly from the loaded results; pass the linked-row state into the existing browsing controls.
- In `apps/web/src/mobile-refinements.css`, use those explicit attributes for the mobile one-/two-row layout, overflow, snap and touch rules. Do not create separate row scroll containers or extra JavaScript scroll synchronization.
- In `apps/web/src/mobile-browse-controls.tsx`, add a compact, visible **Both rows move together** hint for two-row Explore results. Existing Next/Previous behavior and scroll position tracking remain unchanged.
- Preserve the existing 2¼-column peek, page-level vertical scroll, real listing order, filtering/sorting, pagination, image links, Save, keyboard controls, desktop layout and brand palette.
- Do not change other carousel screens, APIs, migrations, credentials or PWA/Push settings.

## Synthetic browser acceptance
An isolated Chrome mobile emulation session intercepted the Explore API responses and used twelve synthetic listings. The QA browser never wrote to or inspected the live student database.

| Screen width | Gesture | Shared `scrollLeft` | Visible outcome |
|---|---|---|---|
| 390px | Initial | 0px | Both rows start aligned |
| 390px | Top-row swipe left | 324px | Both rows shift left together |
| 390px | Bottom-row swipe right | 0px | Both rows return to beginning |
| 320px | Initial | 0px | Both rows start aligned |
| 320px | Top-row swipe left | 262px | Both rows shift left together |
| 320px | Bottom-row swipe right | 0px | Both rows return to beginning |

Both sizes reported `data-linked-rows="true"`, two grid rows, and document scroll width exactly equal to the viewport width. The mobile screenshot showed both rows, the partial third column, the synced-row hint and the existing arrows.

## Validation and remaining checks
- `cd apps/web; bun run build`: TypeScript and Vite production build passed (59 modules).
- Impeccable CSS detector: `[]` (no reported findings).
- Scoped `git diff --check`: passed.
- Physical iPhone Safari acceptance still pending. Refresh Explore on Safari and swipe either row left or right; check both rows move together and taps on cards/Save still work. Swipe vertically to confirm the page scrolls normally. 
- No Git commit/push, deployment or database operation performed.
