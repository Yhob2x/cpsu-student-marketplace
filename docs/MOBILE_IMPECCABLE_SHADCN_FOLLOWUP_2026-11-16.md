# CPSU Market — Mobile UX follow-up: short iPhone screens

**Date:** 2026-11-16  
**Context:** Follow-up to `docs/MOBILE_IMPECCABLE_SHADCN_REFINEMENT_2026-11-16.md`.

## Scope and safety

- Used the project's installed Impeccable guidance and existing shadcn-style CSS conventions (not an actual Radix/Tailwind installation).
- Read current code and Git status first; other agents have unrelated work in `apps/web/src/main.tsx`, `apps/web/src/pages-account.tsx`, WP3 scripts, and My Store styling. **None of those files were edited by this pass.**
- Only changed the existing `apps/web/src/mobile-refinements.css` owned by the earlier mobile refinement pass.
- No database operations, credentials, API modifications, migrations, push switches, repository commits, pushes or deployments.

## Verified defect and resolution

Using an isolated Chrome DevTools device-emulation session and **synthetic authenticated responses** intercepted in the temporary QA browser (never written to a server/database):

- The 320×568 px conversation was initially nearly unusable: its name/action header was 188 px tall, leaving **26 px** of visible message history.
- At ≤640 px width / ≤700 px viewport height, the conversation now compresses long participant names visually to a single-line ellipsis (while retaining full DOM text for assistive technology), arranges Sound on, Test sound and View listing on one touch-friendly row, and compacts the typing indicator without removing it. The message-history viewport measures **124 px** at 320×568 (about 4.8× previous).
- At 375×667, the conversation offers **223 px** of visible history; at 390×844, the existing noncompact layout remains **361 px**.
- On 320×568 Messages inbox, the three controls fit on a **single 44px row** instead of wrapping to 96 px.
- On a 320×568 item-detail page with long title/empty gallery, compacting the blank photo area to 150px and adjusting title typography reveals the **listing name and price above the fixed app tab bar**. At 390×844, the larger 242px gallery composition remains unchanged.

All edits are responsive, presentation-only CSS. Messages retain their API-based sent/read status, notification audio, keyboard-reply behavior, listing context, permission gates, tap targets, and verified-student access controls.

## Measured viewport results (synthetic visual data)

| Route | Screen | Document width | Main result |
|---|---|---|---|
| /inquiries/7 | 320×568 | 320 px | History 124px (was 26px); header 99px (was 188px) |
| /inquiries/7 | 375×667 | 375 px | History 223px |
| /inquiries/7 | 390×844 | 390 px | History 361px, layout unchanged |
| /inquiries/7 | 430×932 | 430 px | History 449px |
| /inquiries | 320×568 | 320 px | Sound/preview/listing controls share a single 44px row |
| /inquiries | 390×844 | 390 px | Controls remain on one row |
| /listings/1 | 320×568 | 320 px | Blank-gallery area ~159px, price visible near first screen |
| /listings/1 | 390×844 | 390 px | Gallery ~242px |
| /profile | 390×844 | 390 px | No document overflow |
| /explore | 390×844 | 390 px | Two-column listing cards, no document overflow |

All tested widths had **0 horizontal document overflow**.

## Automated checks

- `cd apps/web && bun run build`: **PASS**, TypeScript and Vite (49 modules transformed).
- `.agents/skills/impeccable/scripts/impeccable.cmd detect --json apps/web/src/mobile-refinements.css`: **[]**, no mechanical findings.
- `git diff --check`: **PASS**.
- QA browser API interceptions did not reach MySQL or real user sessions.

## Remaining device testing

- iPhone Safari manual acceptance for small/large screens, iOS safe-area/home indicator, keyboard transition with open chat, VoiceOver on truncated name and controls, 200% text scaling, touch input, and reduced motion.
- Full multi-user messaging and Marketplace state tests against a deliberately isolated test backend when separately approved. No real student profile was used to accept this change.

**QA note:** Synthetic emulation demonstrates layout behavior, not a production push/installation/security acceptance or actual iPhone Safari test.
