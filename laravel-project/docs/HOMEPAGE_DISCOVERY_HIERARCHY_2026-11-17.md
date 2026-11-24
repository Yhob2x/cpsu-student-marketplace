# CPSU Market — Homepage discovery hierarchy (2026-11-17)

## Scope and rationale
Frontend presentation only, following the approved MASTER_BLUEPRINT.md discovery module. Preserve existing listing API queries, URL category filtering, listing cards, permissions, announcements, PWA installation, footer, and visual theme. No database, migration, or deployment operations.

The homepage now follows:
1. Hero and search (one Explore CTA on desktop, no redundant mobile CTA).
2. All categories before listings (one row where links remain comfortably sized; five columns / two rows at narrow phone widths, no horizontal scroll).
3. Fresh listings, Popular listings, Student services together without promotional interruptions.
4. Published campus announcements only if available.
5. How it works.
6. Single prominent Start Selling CTA for eligible non-staff visitors.
7. Install App strip for visitors who have not installed the PWA.
8. Trust information and existing footer.

Removed duplicate promo cards for services, pre-loved items, and selling. On phones the short hero copy, reduced padding and hidden redundant hero actions/trust details prioritize actual listings. Desktop Explore CTA and search remain available. All categories still link to the existing Explore categoryId filter; full names stay accessible via label and title.

## Verification (local browser, synthetic or development data only)
- Existing web tests: 57 passed, 0 failed.
- Bun TypeScript/Vite production build: passed; git diff --check passed.
- Browser: local 127.0.0.1:4173, 320, 390, 768, 1280 px, all with no document horizontal overflow.
- At 320px: 9 categories; first tile about 55 by 58px; first Fresh Listings heading at 532px (before audit: 739px).
- At 390px: categories ~67 by 59px, Fresh Listings at 515px.
- At 768 and 1280px: all nine categories remain in a single row, with tiles ~79px and ~123px wide respectively.
- At 320px with 200% root font size, there is no horizontal overflow; page and category tiles become much taller and require more vertical scrolling. No claim of full accessibility certification.
- Some unrelated Explore mobile-filter animation work was present concurrently. A one-line inert attribute compatibility adjustment was required to pass TypeScript without changing its animation state logic.
- Physical iPhone Safari, screen-reader, keyboard and production-data acceptance remain open.

## Notes
Announcements and listing sections remain conditional on their existing responses; empty or unpublished content is not invented. No live data, database records, or API logic were changed.