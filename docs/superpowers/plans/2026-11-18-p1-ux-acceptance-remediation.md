# P1 UX Remediation and Acceptance Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task with test-first checks. Do not commit or push the owner's dirty main worktree.

**Goal:** Restore reliable local CPSU browsing, eliminate the mobile floating-chat overlap, make draft publication obvious, and record honest authenticated/device acceptance status.

**Architecture:** Separate HTTP GET and mutation request budgets while preserving throttling. Locate the retained floating launcher within the mobile tabbar's reserved visual space and keep its popup above content. Clarify draft/publication status and place its publish actions next to photo editing. Test the public flow with real local HTTP and synthetic-only browser contexts; physical checks require approved devices and HTTPS staging.

**Tech Stack:** Bun, Express, express-rate-limit, React/Vite, CSS, Playwright CLI, MySQL for existing runtime only.

**Spec:** User instruction on 2026-11-18 approving the P1 UX findings of the preceding audit.

## Global Constraints

- No database migrations, seed, real user changes, push enrollment/delivery, staging deploy, secrets, commits, or pushes.
- Preserve signed-in/guest navigation, store followers, messenger-style floating chat, admin decisions and content publication authorization.
- Never treat emulator/synthetic browser results as genuine physical iPhone/Android or remote push.
- Preserve all existing uncommitted project work.

## Review Focus

- Local campus NAT IP traffic should not exhaust login when one tab browses many GETs.
- Non-GET writes and authentication attempts must still be rate-limited.
- At 320/390/768px, launcher may not overlap bottom tabs or actionable content.
- Uploaded homepage photos must still be private until explicitly published, and dirty text must require save first.
- Staging-only push remains OFF pending institutional approvals.

---

### Task 1: Request-budget isolation and clear public recovery

**Files:** `apps/api/src/app.ts`, `apps/api/test/http-request-budgets.test.ts`, `apps/web/src/public-resource-error.ts`, `apps/web/src/pages-public.tsx`, `apps/web/test/public-resource-error.test.ts`.

- [ ] Test: 305 GET /health and public GET requests cannot consume the mutation budget; POSTs remain limited.
- [ ] Run the test RED (currently responses turn 429 after 300 GETs).
- [ ] Separate 60-second GET budget (900) from mutating budget (300), exempt inexpensive health from the two, retain /auth limiter.
- [ ] Run the test GREEN.
- [ ] Test: HTTP 429 on listing/store shows a request-limit explanation instead of misleading unavailable-network text.
- [ ] Run RED, implement minimal public error presentation, run GREEN.

### Task 2: Mobile chat collision prevention

**Files:** `apps/web/src/student-ux-polish.css` (or new scoped stylesheet), `apps/web/test/mobile-chat-layout.smoke.js`.

- [ ] Create a Playwright browser check at 320/390/768 with bounding-rectangle comparisons between fixed launcher, visible tab links, and main interactive content.
- [ ] Observe initial RED on the homepage 'View all' action.
- [ ] Move the floating launcher into a separately reserved mobile tabbar slot, retaining icon, button/link behavior, badge, keyboard hide and floating panel.
- [ ] Run GREEN at each viewport for guest, and in synthetic browser session for signed-in.
- [ ] Check reduced motion and enlarged text.

### Task 3: Admin photo publication clarity

**Files:** `apps/web/src/home-page-editor.tsx`, `apps/web/src/home-page-content.ts`, `apps/web/test/home-page-content.test.ts`.

- [ ] Test draft publication status for no live publication, dirty draft, and fully published version (RED).
- [ ] Implement status helper (GREEN), and show clear Draft/Live labels.
- [ ] Keep explicit Publish button next to image controls after draft edits, guard dirty text and revision conflicts, and preserve existing published data.
- [ ] Verify backend remains unchanged and no content is published during acceptance.

### Task 4: Verification and gate report

**Files:** `docs/P1_UX_AUTH_PWA_ACCEPTANCE_2026-11-18.md`.

- [ ] Run full web tests, API focused tests, typechecks/build and PWA validator.
- [ ] Use live local browser checks for guest and synthetic authorization fixtures (no persisted user/account changes).
- [ ] Check phone/USB availability and approved HTTPS staging prerequisites; record unavailable genuine device steps as BLOCKED, never passed.
- [ ] Record exact findings, environment and outstanding release gates.
