# CPSU Market — UI hierarchy implementation and acceptance

Date: 2026-11-17 (Asia/Manila)
Scope: local frontend-only refinement following `docs/UI_HIERARCHY_AUDIT_2026-11-17.md`.

## Changes implemented
1. **Registration** — Active inputs are ordered Display name → Email → Password → Campus. When private student ID collection is disabled by `GET /auth/registration-policy`, no disabled identity fields appear; a short informational note follows the account submission action. If that existing server policy returns `studentIdentityRequired: true`, the separate private Full name / Student ID fields are rendered as required, labelled, and focusable. Existing policy gate, validations, and API payload are unchanged. Error focus now targets the correct field.
2. **Floating Chat** — On responsive widths up to 860px, the launcher occupies a fifth slot in the existing fixed bottom navigation; no longer overlays product cards, seller content, or text. Desktop floating launcher and authenticated conversation panel remain. Hidden where existing chat route, login, registration, or staff gating already applies. Mobile Chat panel anchors above the bottom tabs, with keyboard behavior preserved.
3. **Storefront** — Browse listings is the primary call to action and the store catalog's heading precedes filters. Follow and Chat are retained as secondary actions. On small screens the cover, identity, controls, and factual metadata are more compact. 370–700px uses a concise four-column factual row; 320px retains a two-row layout.
4. **Explore** — On desktop, Campus, Category, and Type appear immediately. Condition and price range are behind an accessible More filters disclosure, with visible active count, while URL-backed filters remain authoritative. Mobile More filters retains all six controls and existing animation behavior.
5. **Desktop primary navigation** — Removed the duplicate All listings entry while retaining Explore and the other approved destinations.
6. **Categories** — Human-readable mobile category captions (Hand-made, Pre-loved, Books, Food, Printing, Design, Tutoring, Tech help, Photo & video) keep full names as accessible labels.
7. **Profile** — Replaced redundant future CISS placeholders with one campus-on-record field plus a truthful note. The verified/pending/rejected affiliation section and real account edits stay primary; no CISS API integration was activated.
8. **320px guest header** — A visibly abbreviated CPSU Market brand preserves the full accessible name and keeps Sign in / Sign up on one row.

## Code changed
- `apps/web/src/pages-account.tsx`
- `apps/web/src/pages-storefront.tsx`
- `apps/web/src/pages-public.tsx`
- `apps/web/src/pages-profile.tsx`
- `apps/web/src/main.tsx`
- New, scoped: `apps/web/src/hierarchy-polish.css`

## Verification executed
- `cd apps/web && bun run build`: TypeScript and Vite production bundle **passed** after implementation.
- `cd apps/web && bun test`: **73 passed, 0 failed** across 22 files (existing SSR React Router warnings, not failures).
- Impeccable source detector on `apps/web/src`: `[]` (no findings, not a WCAG certification).
- Local Chrome browser, public Home, Explore, Store, Listing Detail and Registration at **320, 390, 768, 1280** CSS px: **20/20 screens no document-width overflow**; all applicable mobile pages showed Chat **within the tabbar bounds**, not floating over the content. 320px homepage at 200% root text also had no document-width overflow.
- Desktop Explore's More filters toggle rendered the additional controls when opened.
- Registration live browser with current inactive policy: fields omitted, explanation rendered. Separate **synthetic browser route override only**, forcing `studentIdentityRequired=true`, rendered both required private fields without altering server policy or collecting a real ID. A simultaneous real campus endpoint rate limit meant that test could not submit a registration; this is intentionally **not** a signup E2E pass.
- Authenticated browser presentation with **synthetic intercepted responses only**: Student Profile, My Store, Campus Reviewer, University Admin each rendered at **390 and 1280** without recorded UI alerts or overflow; not real authenticated end-to-end acceptance. Synthetic role and queue statistics are not live platform data.
- QA evidence: screenshots in the untracked local `.tmp` directory; do not treat these as production screenshots.

## Remaining acceptance / cautions
- **Real iPhone Safari and Android Chrome** physical-device validation remains pending. Remote access reaches the authorized Windows computer only; no attached physical phone browser could be controlled or verified. Check safe-area/keyboard behavior, pinch zoom, VoiceOver/TalkBack, rapid Chat open/close, screen reader heading order and tap sizes on actual devices.
- Authenticated **end-to-end** tests with separately approved synthetic user accounts, real API and isolated database remain pending. Mocked browser responses validated presentation, not authorization correctness.
- Current CISS verification/identity collection, authentication and account eligibility policies are deliberately unchanged.
- No database migration, new dependency, production deployment, Git commit, push, or real user-data mutation was performed.
