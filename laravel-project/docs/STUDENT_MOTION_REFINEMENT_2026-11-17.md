# CPSU Market — Purposeful Student Motion (2026-11-17)

## Scope and approval
User request: 'add motions for the appropriate area'. This is a narrowly scoped student-side CSS-only interaction enhancement, not a redesign. Follow MASTER_BLUEPRINT.md Part VIII and existing design tokens; respect all pre-existing uncommitted files.

## Review of existing motion
Existing animations already cover chat messages and typing, image zoom and gallery navigation, and some navigation/filter state transitions. Do not add overlapping effects to those mechanisms. Listing rails and Explore grid must retain native/gesture scrolling without moving card columns.

| Before | After | Rationale |
|---|---|---|
| Save heart state changes abruptly | Press scales only the SVG to 90%, 140 ms with custom deceleration; selected background/fill transition 150–170 ms | Confirms intent without delaying async save; React and API remain the source of truth |
| Advanced mobile filters appear instantly | Opening panel fades/slides in over 180 ms, from opacity .35 and translateY(-5px) | Small spatial explanation; avoids layout-height animation |
| Desktop product photos have no hover feedback | Image alone scales to 1.025 over 190 ms, behind same card and badges | Indicates card interaction without moving card or scrollable grid |
| Seller cover choice changes abruptly | Color, border and text colors transition over 150 ms | Reinforces state choice without reordering thumbnails or changing backend |

## Rejected motion
- No page-load or route-wide entrance choreography: frequently visited marketplace views should load immediately.
- No sliding/staggering individual product cards: would interfere with linked-row swipe and drag behavior, and distract from real photos.
- No extra animations on chat sends, typing indicators, image gallery or fullscreen zoom: already animated and sensitive to gesture latency.
- No keyboard-driven animation, changing layout dimensions, bouncing buttons, or autoplay.

## Implementation
- New file: `apps/web/src/student-motion.css`, imported last from `apps/web/src/main.tsx`.
- Uses existing forest/gold/mint palette, shared easing curve `(0.23,1,0.32,1)`, opacity/transform feedback, fine-pointer hover gating, no package additions.
- `prefers-reduced-motion: reduce` disables these new effects. Focus outlines, state labels (`aria-pressed`), and the saved-item result remain functional without motion.
- No database, API, moderation, authentication, payments, or Google Drive changes.

## Verification
- `cd apps/web; bun run build` — PASS (TypeScript and Vite).
- `bun test test/gallery-navigation.test.mjs test/listing-gallery-render.test.tsx test/home-listings.test.mjs test/explore-touch-swipe.test.ts` — 13 passed, 0 failed.
- Chrome synthetic browser acceptance: Explore at 390px with filters open, reduced-motion variant, and desktop 1280px. All PASS: filter `cpsu-filter-reveal` only in normal mode, reduced-motion animation `none`, no horizontal document overflow, save-heart transition present, desktop photo transform transition present.
- Impeccable static scan returned no findings.
- Physical iPhone Safari/Android and authenticated seller cover-selection motion require separate manual checks; the CSS/browser tests are not a claim of device certification.
