# CPSU Market — Three Purposeful Motion Refinements

**Date:** 2026-11-17 (Asia/Manila)  
**Scope:** UI-only motion refinements requested after the read-only Emil Kowalski and Playwright audit.

## Decisions and implementation

### Product photo viewer
- Existing zoom viewer now uses a 200ms opacity-based entrance and **140ms pointer-initiated exit** using `cubic-bezier(.23, 1, .32, 1)`. The exit keeps the overlay mounted until its own `opacity` transition ends, then preserves the selected photo and restores focus via the existing gallery close path.
- Keyboard opening (Enter/Space), keyboard Close and Escape are **immediate**. `prefers-reduced-motion: reduce` disables the transition; first paint is fully visible. A very early pointer close unmounts immediately to prevent an exit without a transition-end event.
- Existing pinch-to-zoom, drag, wheel, photo navigation, focus trapping, body scroll locking, and image error feedback remain unchanged.
- Source: `apps/web/src/image-zoom.tsx`, `image-zoom.css`, `listing-gallery.tsx`.

### Explore advanced filters
- Retains the existing **180ms entrance** and adds a **145ms closing fade + 5px upward motion**. The panel stays rendered until `cpsu-filter-dismiss` finishes. During exit, `aria-expanded` is false, the panel is hidden from accessibility and inert, and it does not receive pointer interactions.
- Keyboard clicks and reduced-motion preferences open/close instantly without animation. A quick second click during closing safely reverses the panel to open, without an arbitrary timer.
- All filters remain URL-driven. No changes to category options, results query, sorting, paging, filter values, or desktop browsing.
- Source: `apps/web/src/pages-public.tsx`, `student-motion.css`.

### Notification preferences
- Keeps the native `<details>/<summary>` disclosure for semantics and keyboard behavior. Adds a wrapper around the existing `PushSettings` component: **185ms entrance**, **145ms exit**, subtle 5–6px translation and opacity only.
- Click-based closing keeps `<details>` open until its content exit animation completes, then collapses natively. Enter/Space toggle natively and immediately; the chevron transition is also suppressed for keyboard and reduced-motion actions.
- Rapid close/reopen uses the existing disclosure content and returns to an open state correctly. No height-animation or changes to push-notification permissions or storage were added.
- Source: `apps/web/src/pages-profile.tsx`, `notifications.css`.

## Verification

- `bun run build` (TypeScript check + Vite) — PASS.
- Targeted `bun test` regression checks (gallery navigation, login returns, footer and profile presentation): **18 passed, 0 failed** before final edge-case regression; final checks recorded in terminal.
- Playwright Chrome on 390×844 CSS viewport:
  - Photo zoom pointer exit waits for a 0.14s transition, keyboard enter/close and Escape are immediate, reduced-motion transition is 0s and closes instantly.
  - Advanced filters animate in and out, then become display:none; keyboard and reduced-motion paths have no animation.
  - Preferences animate in and out, finish correctly with native open state, keyboard has 0s chevron transition, reduced-motion opens/closes without animation.
  - No document-level horizontal overflow (390px viewport/390px document).
- Additional Playwright edge-case QA at 320×650 and 768×900:
  - Rapid filter exit/reopen retained the open panel and final close worked.
  - Rapid notification-preference exit/reopen retained the open settings and final close worked.
  - Quick pointer photo-viewer close completed without a stuck dialog.
  - Reduced-motion photo-viewer opacity was 1 at opening.
  - No document-level horizontal overflow.
- Real **published listing** was used only to inspect the public image gallery, while notification/session responses came from isolated browser fixtures. No live student account or private message was read, and no HTTP mutation was issued.
- Real iPhone Safari/Android keyboard and assistive-technology acceptance remains outstanding.

## Change boundaries

- No business rules, account permissions, API endpoints, databases, migrations, production deployment, Git commit, or push were changed.
- Existing unrelated uncommitted source changes were preserved. This document describes a local development change only.
