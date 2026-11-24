# CPSU Market — Mobile listing browsing in both directions

**Date:** 2026-11-16  
**Scope:** Home Popular/Fresh/Services rails and Explore listing results, mobile widths up to 640 CSS px.

## User-reported problem

The 2¼-card mobile peek looked horizontally swipeable, but the user could not swipe right. At the **beginning** of a naturally scrolling left-to-right carousel, swiping a finger to the right has no earlier card to reveal, and browser edge-navigation may intercept a large rightward gesture. Once advanced, a rightward gesture should return toward earlier cards.

## Improvement

- Keep the existing 2¼-card preview, authentic native horizontal touch scrolling, Snap points and two-row Explore browsing for five or more results.
- Add clear **Previous** (left arrow) and **Next** (right arrow) buttons for each populated Home listing strip and for Explore results. Controls are displayed on phones only, below the listing strip, and their state follows actual `scrollLeft`. They cannot navigate past the first/last listing.
- Contextual, restrained on-screen help: **Swipe left for more**, **Swipe left or right**, **Swipe right to go back**.
- Scrolling moves by the measured card width plus the CSS column gap, using smooth behavior except when the student prefers reduced motion.
- Both listing areas remain named, keyboard-focusable regions with arrow-key scrolling; each arrow button has a specific accessible action label and a 44px minimum tap size.
- Keep the custom carousel scoped to mobile. Desktop Explore remains the existing grid, and homepage, seller pages, Saved, API queries, filter/sort, pagination, listing links, and Save actions keep their behavior.
- Three or more results are required for controls. We never invent an extra card to make a partial peek.

## Source changes

- **New:** `apps/web/src/mobile-browse-controls.tsx` — shared state-aware, accessible mobile navigation and reusable Home rail.
- **Updated:** `apps/web/src/pages-public.tsx` — surgical integration in the existing Home rails and Explore results, preserving concurrent developer changes. Explore resets horizontal scroll when search/filter/sort/page changes.
- **Updated:** `apps/web/src/mobile-refinements.css` — mobile-only arrow styling and native pan allow-list; no brand changes.

No backend, database, permissions, PWA installation or Web Push switches, external libraries, or hosting changed.

## Isolated Chrome touch-emulation QA (synthetic listings only)

Using synthetic listing responses intercepted in an isolated Chrome QA browser (no real MySQL data):

| Page / width | First view | Next button | Previous button | Horizontal overflow |
|---|---|---|---|---|
| Explore / 320px | 2¼ cards | 0 → 131px | 131 → 0px | No page overflow |
| Explore / 390px | 2¼ cards | 0 → 162px | 162 → 0px | No page overflow |
| Home / 390px | 2¼ cards | 0 → 162px | 162 → 0px | No page overflow |
| Explore / 1024px | Desktop grid | Hidden | Hidden | No page overflow |

The **Previous** button is disabled at scroll position 0 and enables after advancing. **Next** is enabled when more cards remain. A Chrome mobile-emulated rightward touch drag after advancing also returned an Explore strip to the beginning in a test where the drag started inside the listing strip. A rightward drag from position 0 is *not* supposed to advance the carousel; native browsers may treat that as a navigation-edge gesture.

## Verification

- Web `bun run build`: TypeScript / Vite pass.
- Impeccable detector: no findings in the mobile stylesheet.
- `git diff --check` for affected existing source files: pass.
- Real iPhone Safari touch swipes and the exact OS browser-back gesture: **pending physical-device acceptance**. Chrome cannot fully establish iPhone Safari behavior.

## iPhone manual acceptance

1. Refresh CPSU Market in Safari and open **Explore** or a Home listing row with at least three items.
2. Observe **Swipe left for more** and an enabled right arrow. Tap the **right arrow** to reveal more items.
3. Observe **Swipe left or right**, then physically swipe the cards **right** to go back to earlier listings; alternatively tap the **left arrow**.
4. On the first card, the left arrow is disabled. Swipe left or tap the right arrow to progress.
5. Confirm you can still tap a listing, Save a listing and scroll the page vertically; search and filter changes reset the horizontal position.
6. Test both Safari and, if applicable, your Home Screen app. This does not test Web Push or lock-screen audio.
