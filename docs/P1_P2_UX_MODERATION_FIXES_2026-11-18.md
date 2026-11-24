# CPSU Market — P1/P2 Homepage, Explore, Admin and Listing Readability Refinement

**Date:** 2026-11-18 (Asia/Manila)
**Environment:** Authorized Windows local development app at 127.0.0.1:5173, API at 127.0.0.1:4000
**Scope:** Frontend-only UX and advisory listing-quality checks. Existing data, publication semantics, floating chat, route behavior, authentication and marketplace rules preserved.

## Findings addressed

| Priority | Finding | Change | Verification |
|---|---|---|---|
| P1 | Floating mobile chat overlaps category "View all" | Preserved fixed floating chat, explicitly reserved an end slot in the mobile bottom tabbar, added safe-area-aware positioning and scroll margins for nearby category/listing section actions | Chrome 320, 390 and 768px: zero chat/View-all overlap, no horizontal overflow, View all successfully navigates to Explore. 200% root text: no chat/tabbar link overlap, no horizontal overflow |
| P1 | Homepage photo draft/publish confusion | Kept image selection and draft saving unchanged. Moved draft/live status next to the three photo controls and placed Publish saved draft within the same photo-editing group immediately after uploads. Added note when a saved draft image is not yet live | Synthetic admin UI verifies pending badge, publish control inside photo section, ordering after image grid, and no staff floating chat |
| P2 | Horizontal Explore filters lack cues | Added edge fade and focusable Previous/More arrow buttons only when campus/category chips overflow. Native swipe and selected URL filters retained; no dropdowns introduced | Chrome 390px: campus and category arrows scroll respective rails, selecting category updates `categoryId` in URL |
| P2 | Global marketplace search distracts on admin mobile | Suppressed the global header search while on the admin workspace at ≤860px; added a compact "Search marketplace" link beside admin workspace heading to Explore, where search is still available | Synthetic reviewer browser verifies the compact workspace, scoped navigation, search shortcut and real Explore navigation |
| P2 | Placeholder-like titles/readability | Added nonblocking title/description clarity helper, reviewer queue/detail advisory, seller-create guidance and flagged-listing edit guidance. **Never automatically reject, rewrite or publish any student's listing** | 4 new helper unit tests pass; synthetic campus reviewer verifies guidance. Read-only development API audit reviewed 25 public listings, flagged 5 for review |

## Read-only listing-quality findings

`apps/web/test/listing-quality-readonly-audit.ts` fetched only public listings via the local GET endpoint, paginated, and assessed title and description readability. It did not view private profiles, write data or alter listings. Of **25** visible public listings, **5** were flagged for at least one advisory. Public listing IDs: `37, 29, 25, 24, 1`. The check found short/non-descriptive titles and/or descriptions lacking detail. These are **suggestions for a human seller/reviewer**, not proof of policy violations; genuinely clear short product names may need no changes.

No published title, description, price, photo, store or moderation decision was changed.

## Source files

- Updated `apps/web/src/mobile-chat-dock.css` behavior through final cascade rules in `apps/web/src/p1p2-ux-fixes.css` (the original chat remains).
- Updated `apps/web/src/home-page-editor.tsx` and `apps/web/src/home-admin-publish.css` for photo-scoped draft/live publishing.
- Added `apps/web/src/explore-scroll-options.tsx` and `apps/web/src/explore-scroll-cues.css`; wired into `apps/web/src/pages-public.tsx`, retaining URL-backed filters.
- Updated `apps/web/src/pages-admin.tsx` for staff search shortcut and manual clarity audit.
- Added `apps/web/src/listing-quality.ts`; integrated with reviewer UI and seller create/edit UI in `apps/web/src/pages-account.tsx`.
- Updated `apps/web/src/main.tsx` stylesheet imports.
- Added focused tests `apps/web/test/listing-quality.test.ts`, `apps/web/test/explore-scroll-options.test.ts`, and read-only audit script `apps/web/test/listing-quality-readonly-audit.ts`.
- Updated repeatable browser tests `apps/web/test/p1p2-layout-smoke.js`, `apps/web/test/synthetic-role-ui.smoke.js`.

## Fresh verification

- **Frontend Bun unit tests:** **88 passed, 0 failed** (27 files; some preexisting React SSR warning noise).
- **API Bun unit tests:** **168 passed, 8 intentionally skipped opt-in integration suites, 0 failed**; no API code changed for these UI issues.
- **Frontend TypeScript and Vite production build:** PASS.
- **PWA manifest/icon/offline static validator:** PASS.
- **Browser responsive/interaction smoke:** PASS at 320, 390 and 768px, including category View all click navigation and campus/category scroll-arrow + URL selection.
- **Browser 200% text smoke:** PASS at 320, 390 and 768px; chat stays inside tabbar and avoids all primary nav targets.
- **Synthetic student/university-admin/campus-reviewer browser fixture:** PASS; it uses mocked API responses to check role-specific UI without changing actual users.
- **Focused tracked-file `git diff --check`:** no whitespace errors; only Windows LF/CRLF warnings.

## Qualifications

Browser testing was in desktop Chrome with mobile viewport simulation, **not** a physical iPhone/Android PWA acceptance. Background Web Push, HTTPS staging, institutional approval and real OS notifications remain separately blocked.

No Git commit, push, Prisma migration, database write, live listing edit, admin approval, deployment, firewall change or Web Push activation was performed. Existing uncommitted project changes were preserved.
