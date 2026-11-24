# CPSU Market — iPhone Explore shared-row swipe fix

**Date:** November 17, 2026  
**Scope:** Explore mobile listing results only.

## User-observed defect
The user supplied a 400px mobile screenshot and reported that swiping a listing in the upper row did not reliably move the lower row along with it. The expected design is a **two-row grid with synchronized horizontal movement**—not independently scrollable rows—while keeping the 2¼-column preview.

## Findings
- Explore already used a *single* horizontally scrollable CSS grid with `grid-auto-flow: column`, `grid-template-rows: repeat(2, auto)`, and 2¼ visible column widths for 5+ items.
- Native swipe worked in Chrome emulation, but the user's iPhone/Responsive experience remained inconsistent. The grid relied on the browser's native touch handling while card links, Save buttons, scroll snapping and potential Safari edge gestures competed for the same interaction.
- Rather than add a second independent row/scroller, retain one shared scrollLeft and explicitly own deliberate horizontal one-finger drags on mobile. Do not interfere with vertical page scrolling or normal taps.

## Changes
- **New `apps/web/src/explore-touch-swipe.ts`:** a narrowly scoped React hook attaches native touchstart/move/end/cancel listeners to the single Explore grid only when 3+ listings are present. It waits for a 9px movement threshold, uses a horizontal vs vertical intent check, and takes over only horizontal drags. Changing the container's `scrollLeft` necessarily moves the upper and lower cards together.
- Keeps vertical swipes and multi-touch gestures browser-native. On finger release, aligns to the nearest shared column and clamps to the first/last scroll boundary. Prevents accidental card activation after an actual swipe but immediately allows the next separate tap.
- **Updated `apps/web/src/pages-public.tsx`:** uses the touch hook on Explore's existing grid; leaves desktop mouse dragging, filter/sort URLs, pagination, Save, and Home listing carousels intact.
- **Updated `apps/web/src/mobile-refinements.css`:** allows native vertical panning/pinch-zoom but sends horizontal movement to the explicit Explore handler; temporarily disables snapping during the gesture. No changes to the established forest-green/ivory design.
- **New `apps/web/test/explore-touch-swipe.test.ts`:** tests gesture classification, click/tap threshold, vertical-scroll priority, shared-column snapping and boundaries.

## Automated acceptance
- `bun test test/explore-touch-swipe.test.ts`: **5 passed**.
- Initial `bun run build`: TypeScript + Vite production build passed (62 modules) before concurrent edits elsewhere. **The final full TypeScript gate is now blocked** by six `TS2304` missing-name errors for `newSelectedCount` / `setNewSelectedCount` / `editSelectedCount` / `setEditSelectedCount` in `apps/web/src/pages-account.tsx` (another developer's Messages work; untouched here). Final independent `bunx vite build` **passed** (65 modules). Do not claim the complete application typecheck is green until the separate Messages change is resolved.
- Impeccable mobile stylesheet scan: **[]** (no findings).
- Synthetic Chrome mobile touch simulation at **320px** and **400px**, with an isolated browser and synthetic listings (no real student database):
  - **320px:** top-row left swipe moved shared grid from scrollLeft 0 → 131px; bottom-row right swipe returned 131 → 0px; vertical swipe scrolled the page by 90px while grid stayed at 0; no document-wide overflow.
  - **400px:** top-row left swipe moved shared grid 0 → 333px; bottom-row right swipe returned 333 → 0px; vertical swipe scrolled the page by 90px; no document-wide overflow.
  - Upper and lower card X-coordinates shifted by identical amounts in each horizontal case.
  - A normal tapped listing link navigated to `/listings/1` after the swipe tests.
- This is an automated Chrome test using touch emulation, **not physical iPhone Safari acceptance**.

## Manual iPhone Safari acceptance
Refresh the app in iPhone Safari (and reload the installed Home Screen version if applicable). With five or more Explore results, swipe an upper card **left**: both rows should move left by the same amount. Swipe a lower card **right**: both rows should return. Swipe **vertically** over a card to scroll the page, and tap a card or its Save control normally. Test on the user's actual iPhone before declaring device acceptance.

**Safety:** No database changes, migrations, credentials, backend edits, Push/PWA switches, commits, pushes or deployment. Other agents' uncommitted files were preserved.
