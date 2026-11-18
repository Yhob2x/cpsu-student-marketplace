# CPSU Market Explore — UI/UX Pro Max correction
Date: 18 November 2026
Scope: React/Vite PWA Explore page, UI-only. Owner feedback: earlier hide-everything solution was a poor execution.

## UX assessment
The earlier design placed campus, category, condition and price behind one Filters disclosure. This reduced visible buttons but added an extra click to everyday campus/category browsing. Expanded, it still presented a large dense grid of choices. On desktop, multiple competing rounded button groups and a separate sort bar diluted the focus on listings.

Using the installed UI/UX Pro Max guidelines (touch targets, scanability, state consistency, progressive disclosure and chip readability) and Impeccable distill/craft guidance, the correct approach is **direct access to core discovery options, progressive access only to secondary refinements**. Prior discussions also explicitly ruled out dropdown menus and scroll-arrow buttons.

## Implemented
- Keep All / Products / Services as the primary listing-type control.
- Restore always-visible Campus and Category filters in two quiet, horizontal, keyboard-focusable, swipeable chip rails. A student can switch either without opening a panel.
- Remove separate big Filters disclosure. Only Price & condition expands in place when needed.
- Keep a count and terse active summary for hidden price/condition choices, without repeating the already-visible campus/category selection.
- Reduce nonselected chip chrome, heavy borders and extra panel layers. Keep forest green for selected chips across desktop and mobile (rather than inconsistent yellow mobile selection).
- Keep results, sorting, reset and listing-card links directly accessible. Sorting remains a quiet single-row direct choice; no new dropdown.
- Preserve URL filters, search, deep links, category compatibility, price errors, pagination, loading/retry paths, and backend contract.
- If an incoming deep link has an invalid price range, open Price & condition automatically so the correction fields are reachable.

## Files edited
- apps/web/src/pages-public.tsx
- apps/web/src/explore-page-polish.css
Other previously changed working-tree files are preserved; this pass did not migrate or touch MariaDB.

## Verification
- Focused Bun tests: 8/8 pass.
- Web TypeScript and Vite production build pass.
- Local headless Chrome at 320, 390, 768, 1440 px: campus/category visible without extra click; secondary refinements closed by default and operable; no page overflow or scroll-arrow controls; URL filter selection, sorting and Reset pass.
- Invalid price deep link opens the correction panel with its validation message.
- Source and responsive screenshots inspected. This does not replace physical Safari/Android accessibility QA.
