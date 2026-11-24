# CPSU Market typography system — 18 November 2026

## Scope and decision

This pass changes presentation only. EB Garamond is reserved for the homepage hero headline. Inter is the interface face for navigation, discovery, listing cards, stores, student and seller workflows, chat, notifications, and admin pages. The existing warm CPSU palette, routes, data, actions, mobile bottom navigation, floating chat, and PWA behavior remain in place.

The shared scale lives in `apps/web/src/typography.css`, imported after the existing presentation layers. It sets reusable caption, metadata, body, card title, section, and page tokens. The Google Fonts request in `apps/web/index.html` loads only the two selected families. System and Georgia fallbacks keep text legible if the web fonts are unavailable.

## Audit findings addressed

- The prior editorial layer applied a serif heading token beyond the hero, including section headings, trust guidance, seller calls to action, and admin content editing.
- Listing card titles could change height between Explore and homepage cards; a shared two-line measure now reserves the same title space.
- Price and supporting listing text used inconsistent face and size declarations. The shared layer gives prices Inter and tabular numerals while keeping metadata subordinate.
- Mobile bottom navigation labels and form controls now have a readable type floor. Form controls use at least 16px on narrow screens to avoid iPhone Safari focus zoom.
- The homepage hero uses a fluid EB Garamond size with narrower limits at tablet and phone widths, keeping its text within the existing copy column and stacked mobile layout.

## Verification and limits

`bun test` in `apps/web` passed 83 tests with no failures. `git diff --check` passed. The TypeScript and Vite production build passed when given filesystem access to the project configuration. Headless Chrome captures of the local production preview were inspected at 390, 768, and 1440px window sizes. The headline and artwork remain separated at those sizes, and the mobile bottom navigation remains present. These are visual spot checks of the public homepage, not full authenticated workflow or device acceptance. Physical iPhone Safari, Android Chrome, and installed PWA visual inspection remain outstanding. `graphify update .` was attempted but its installed launcher points to a Python executable that this environment cannot access.
