# CPSU Market — 2¼-card mobile browsing peek

**Date:** 2026-11-16  
**Scope:** Existing mobile Home listing rails and Explore search results.

## Request

The mobile browsing layout should not end neatly after exactly two full cards. It should display roughly **two complete cards plus one-quarter of the next**, a natural clue that more results can be swiped into view.

## What changed

**Only** `apps/web/src/mobile-refinements.css` was modified for this request. Existing desktop layouts, listing data, React components, Save-heart buttons, filtering, sorting and API pagination remain unchanged.

- **Home:** The existing Popular, Fresh and Services horizontal rails use a calculated 2.25-card visible width when three or more real listing cards are present.
- **Explore (≤640 CSS px):** The normal results grid becomes a horizontally swipeable, scroll-snapping strip when three or more listings exist. For 3–4 results it uses one row; for 5+ results it uses two rows of cards so students can scan more results per horizontal stop while still seeing a quarter of the next *column*.
- **Fewer than three cards:** No artificial placeholder is added. Existing grid/rail behavior is retained when there isn't another card to preview.
- **Desktop/tablet:** Mobile-only rules do not replace the normal desktop Explore grid. Saved listings and seller Store grids are not affected.
- **Affordance:** The actual cropped third card signals swipe direction; a restrained browser scrollbar is retained with a thin themed thumb. Native iOS touch scrolling remains active. Existing link and Save control keyboard accessibility is preserved.

Sizing uses `calc((100% - 1.5rem) / 2.25)` with two 0.75rem gutters across 2.25 visible card widths, in the existing forest-green/white design.

## Visual acceptance with synthetic, isolated browsing data

Tested in Chrome DevTools device-emulation with twelve **synthetic** listing records intercepted entirely within a temporary browser session. The mock was never written to the real database.

| Screen | Home: cards and peek | Explore: cards and peek | Document overflow |
|---|---|---|---|
| 320px | 8 cards; 118.8px card; third peek **0.25** | 12 cards; 118.8px card; third-column peek **0.25** | 0px |
| 390px | 8 cards; 149.9px card; third peek **0.25** | 12 cards; 149.9px card; third-column peek **0.25** | 0px |
| 430px | Not separately measured on Home | 12 cards; 167.6px card; third-column peek **0.25** | 0px |
| 1024px | Unchanged by mobile-only rule | 12 cards, normal four-column grid | 0px |

- Verified that the mobile content containers actually scroll horizontally under the browser's scroll APIs; normal desktop Explore does not.
- Visually reviewed the Home and Explore synthetic screenshots; real listing metadata, price hierarchy and Save targets remain present even when the next card is partly shown.
- An initial QA mock omitted the `/announcements` response expected by the current Home screen, making Home render blank **only inside that mock**; after correcting the synthetic response to `{items:[]}`, the Home layout rendered and its 2¼-card peek was measured.
- The local QA Chrome session is not physical iPhone Safari. Final touch feel, iOS scroll indicators and larger text accessibility still require on-device acceptance.

## Validation and safety

- `cd apps/web && bun run build`: TypeScript/Vite production build passed.
- Impeccable mechanical detector: no findings.
- No dependencies, backend services, migrations, credentials, notifications, Web Push switches, hosting, or production files changed.
- `apps/web/src/pages-public.tsx` was **already modified by another agent** and was not edited for this request; this is scoped CSS-only.
- `git diff --check` across the full working tree found an **unrelated** extra blank line in `progress/DEVELOPMENT_LOG.md`. Leave that file and other developers' in-progress changes alone; validate this stylesheet specifically.
- No Git commit, push, or deployment was performed.

## iPhone manual test

Refresh CPSU Market in Safari over the same Wi-Fi. On Home, scroll to **Popular listings** or **Fresh listings** and confirm two full cards plus part of the next card are visible if at least three listings exist. Swipe left/right, tap a listing, and separately tap Save. On Explore, confirm the same peek in the results, test Filters/Sort and the Previous/Next pagination actions when applicable. Verify that the interface does not scroll horizontally as a whole.
