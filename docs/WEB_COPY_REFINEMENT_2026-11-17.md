# Web copy refinement — 17 November 2026

## Scope

Shortened student and administrator interface copy in the responsive web PWA. Removed repeated introductions from Home, Explore, My store, Messages, Profile and Notifications. Tightened helper text in registration, listing management, storefronts, transactions, review queues, reviewer accounts and managed content.

## Decisions

- Keep action labels, validation limits, loading and error feedback, and required reasons visible.
- Keep consequential guidance: campus verification before selling, photo review and prohibited images, direct payment, student-reported transaction status, and the effects of moderation decisions.
- Remove text that repeats an adjacent heading or control. No business rule, route, API response, or database schema changed.
- Preserve the existing visual system and the unrelated work already present in shared admin and profile files.

## Verification

- Web unit suite: 63 passed, 0 failed.
- TypeScript and Vite production build: passed.
- Rendered mobile and desktop copy review remains open.
