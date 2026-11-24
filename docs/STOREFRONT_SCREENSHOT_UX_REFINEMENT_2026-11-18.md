# CPSU Market — screenshot-led public storefront UX refinement
Date: 18 November 2026 (Asia/Manila)
Scope: Local website/PWA storefront presentation only, based on the Kalabasa owner-store screenshot provided.

## Screenshot audit
- Large decorative cover gives weak value relative to occupied height.
- Store owner Browse action competes with the owner Edit action; guest Follow/Chat must remain available.
- Statistics and filter controls create long vertical scanning distance before the first listing.
- Store-specific product cards need more consistent spacing.
- Existing brand palette, shared listing component, and 44px interaction standard are already useful and should be retained.

## Implemented
- Shorter, plain forest-green store cover; tighter avatar, identity and action composition.
- Owner Edit my store is primary. Guest Follow is primary and follows the same reserved-width pattern when its state changes; Chat remains secondary. Browse listings remains a real in-page link, styled as tertiary navigation.
- Condensed statistics, toolbar and category spacing; unchanged product/service/category/search filter logic.
- Contextual Clear filters appears after a non-default type, category or nonblank search, and resets the existing client-side filters.
- Scoped listing-card spacing, responsive facts layout and 44px+ controls. No global listing-card or homepage restyling.
- Fixed a previously defined forest background on the old Browse action that initially made the new tertiary link illegible.
- Added a regression test for owner-action order and browse-anchor preservation.

## Files changed
- apps/web/src/pages-storefront.tsx
- apps/web/src/storefront-page-polish.css
- apps/web/test/storefront-chat.test.tsx

## Verified on local Windows development environment
- Web Bun test suite: 118 passed, 0 failed (33 files).
- TypeScript check: passed.
- Production Vite build (runner config loader): passed.
- Headless installed Chrome on /store/yobyob: 320, 360, 390, 430, 768, 1024, 1440px all without document overflow and all inspected store actions, category chips, and listing-type buttons at least 44px in both dimensions.
- Chrome 200% root-text at 320, 390, 768px: no document overflow; Browse link retained 44px+ height, readable forest text on transparent background.
- Switching to Products reveals Clear filters, which resets to All listings.
- Screenshots taken locally: .tmp/storefront-refined-390.png and .tmp/storefront-refined-1440.png.
- git diff --check passed (line-ending warnings from pre-existing Windows Git settings; no whitespace errors).

## Limits / release gate
- Browser verified a public guest storefront using live local data; it did not exercise an authenticated owner session or the exact Kalabasa store screenshot under the current account.
- Owner actions have SSR markup coverage but still need physical authenticated owner/browser interaction acceptance.
- No full manual WCAG audit, iPhone Safari/Android Chrome physical-device check, screen-reader audit or installed PWA acceptance performed.
- Some published listing titles/images appear mismatched or placeholder-like and require human moderation rather than unapproved data edits.
- No backend changes, schema changes, migrations, credentials, payment handling, deployments, commits, pushes or alteration of other agents' edits.
- Graphify's existing graph JSON was absent, so graph queries were unavailable; do not regenerate a large binary/graph output as part of this scoped visual fix.
