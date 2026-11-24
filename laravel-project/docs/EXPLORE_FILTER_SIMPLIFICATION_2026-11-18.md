# Explore filters — simpler default UI

**Date:** 18 November 2026  
**Scope:** UI only. No API, schema, migration, deployment, or Git commit.

## Change
- All / Products / Services remain one-tap primary choices.
- The long Campus, Category, Condition, and Price panel is collapsed until students choose **Filters**. It is an inline disclosure, **not a dropdown** or modal.
- When refinements are active, the collapsed control shows a count and a readable summary (campus, category, condition, price). Shared links and URL-driven state remain the source of truth.
- Sorting stays directly accessible without a dropdown and uses quieter text/underline styling rather than another large filled segmented control.
- Filter choices remain native horizontal swipe/keyboard scroll chips, no arrows. Price, reset, URL history, category compatibility, and existing error recovery remain available.
- Invalid price ranges automatically expand the panel so the user can fix the fields.

## Files edited
- `apps/web/src/pages-public.tsx`
- `apps/web/src/explore-filters.ts`
- `apps/web/src/explore-direct-filters.css`
- `apps/web/src/explore-page-polish.css`
- `apps/web/test/explore-filters.test.ts`

## Verification
- Bun focused tests: **8 passed, 0 failed**.
- Web TypeScript and Vite build: **passed**.
- Local headless Chrome checks at 320 / 390 / 768 / 1440 px: default advanced controls hidden, Filters expands and collapses, campus selection remains visible in summary with count, sorting preserves URL filters, reset clears refinements, no page overflow.
- Invalid shared-link price range automatically expands the panel with an error message.
- Real iPhone Safari and Android device acceptance remains pending.

Existing user data and application service behavior were not changed.
