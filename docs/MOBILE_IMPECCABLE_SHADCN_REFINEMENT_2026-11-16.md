# CPSU Market — Mobile UX polish (Impeccable + shadcn-style patterns)

**Date:** 16 November 2026  
**Scope:** React/Vite responsive web/PWA, mobile-first UI; no redesign, no API or database changes.

## Design authority and constraints

- Read `AGENTS.md`, `MASTER_BLUEPRINT.md` Part VIII, `docs/UI_UX_GUIDELINES.md`, current CSS and existing React controls.
- Ran installed Impeccable 4.8.2 context; loaded its craft-floor and responsive adaptation/polish guidance. Followed `ui-styling` (shadcn/ui design patterns) and UI UX Pro Max guidance.
- Retained the existing light, forest-green, white, cream and gold design, fonts, five-item mobile navigation, listing card layout, routing and application semantics.
- This project does **not** have the Tailwind + Radix dependencies used by the actual shadcn/ui package. Implemented the relevant accessible segmented-control, focus, control-state and layout principles in the existing CSS without changing the dependency graph or running the shadcn CLI.

## Focused improvements

Only **`apps/web/src/mobile-refinements.css`** was edited.

- **App navigation (≤860px):** edge-to-edge fixed bottom bar, predictable home-indicator safe-area padding, minimum 54px mobile touch targets, slightly more readable labels, unified icon size, restrained selected-tab highlighting and visible keyboard focus. Keep “Messages” on one line even on narrow iPhones.
- **Home and Explore:** preserve compact hero, use consistent 16px inputs to prevent Safari keyboard zoom, align mobile filters and sort controls; redesign the existing three accessible `aria-pressed` type options to a cohesive shadcn-style segmented group. Filtering logic and URL state are unchanged.
- **Listing cards:** maintain two-column mobile grid; loosen card information spacing, increase title/price readability, keep all metadata and independent 44px heart/save targets, and preserve borderless photos.
- **Forms and details:** bigger form inputs and submit targets, simpler mobile authentication panel, consistent listing-detail spacing and image corners.
- **Messages:** roomier inbox rows and mobile sound controls; chat sending/receiving functionality, keyboard behavior and receipt semantics untouched.
- **Accessibility and motion:** reduced-motion overrides for new transitions, explicit focus outlines, safe-area and responsive sizing; no auto-animation or external images.

## Verification

- `cd apps/web && bun run build`: **PASS**, TypeScript check and Vite production build (48 modules).
- Impeccable mechanical detector on the changed mobile stylesheet: **[]** (no reported findings).
- `git diff --check`: **PASS**.
- Local temporary Chrome DevTools device-emulated visual checks (authenticated session not available) at **320, 390 and 768 CSS px** for Home, **320 and 390** for Explore, and **390** for Login. Every sampled page had `documentElement.scrollWidth === window.innerWidth` and the mobile bottom bar matched the viewport width. At 320px the “Messages” label now remains on one line.
- Limitations: the local API at port 4000 was unavailable during visual QA, so Home/Explore showed their existing connection error UI, and the Messages route redirected to Login. The dynamic listing cards, authenticated Messages, notifications, iPhone Safari keyboard and VoiceOver **were not** visually acceptance-tested. These still need real-device checks.
- Did not start or modify the development database, create migrations, alter hosting/push switches, commit, push, or deploy. Other agents' concurrent changes were left alone.

## Manual iPhone follow-up

With both API and web running, test Home, Explore segmented controls + expand/collapse filters, two-column cards with long product names/prices, Save button tap area, Messages inbox and fixed composer, login fields (no zoom), fixed bottom nav and landscape/zoom. Verify a physically real iPhone and VoiceOver before public release.
