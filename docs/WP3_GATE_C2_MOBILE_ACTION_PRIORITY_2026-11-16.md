# WP3 Gate C2 — Mobile Action Priority and Accessibility Follow-through

**Date:** 2026-11-16 (Asia/Manila)  
**Project:** CPSU Student Marketplace  
**Test environment:** Local **isolated** `cpsu_marketplace_test` + loopback-only synthetic API/web servers + two independent headless Chrome profiles  
**Result:** **PASS — 47 browser checkpoints** after a targeted WP3 transaction UI refinement; physical iPhone Safari still untested.

## Why the refinement was needed

A visual review of a real synthetic transaction screenshot at 390 CSS px showed that the **Next action** panel was buried below the large current-status card and several navigation links. Students had to scroll past ancillary actions to discover the state-dependent task.

We wrote a browser regression assertion first: `Next action` must come **before** the secondary chat, refresh and listing links, and start within the initial mobile viewport. The initial run failed that assertion **as expected** (RED), and securely cleaned the test fixtures.

## What changed

**Application change:** `apps/web/src/pages-transactions.tsx`

- Keep the current status, including its distinct status badge, first.
- Shorten the explanatory text without weakening the fact that transactions are student-reported and CPSU Market does **not** verify payments, deliveries, or item condition.
- Move the active **Next action** panel immediately after status, ahead of secondary links.
- Group **Discuss arrangements**, **Refresh status** and **View listing** under **More options**, after the primary action.
- Use a concise **Completed** badge while keeping the explicit mutual self-report explanation next to the completed transaction.

**Test improvement:** `apps/api/test/run-wp3-browser.ts`

- Assert correct mobile document order and initial viewport placement for the action panel.
- Run explicit 320px, 375px and 390px browser emulations.
- Fail if there is horizontal overflow on these tested sizes, any actionable main button is below 44 × 44 CSS px, the cancellation textarea lacks a visible associated label, or the main/heading landmarks are absent.
- Confirm seller acceptance remains keyboard-focusable and the seller mobile viewport does not overflow.
- Require cancellation to stay disabled until a reason of at least 10 characters is entered.
- Preserve original buyer/seller request, acceptance, exclusive reservation, 2-person meetup/completion, cancellation release, privacy and refresh acceptance.
- Capture **synthetic-only** screenshots as visual QA evidence in `docs/wp3-browser-evidence/`.

## Validation

| Check | Outcome |
|---|---|
| RED before UI change | Expected failure: primary action appeared after secondary links |
| GREEN after UI change | **47 browser checkpoints passed** |
| 320 / 375 / 390px pending view | No page-wide overflow, labeled textarea, main heading, 44px touch targets |
| Buyer mobile transaction | Next action ahead of secondary links and within first viewport |
| Seller desktop | Decision control visible and keyboard-focusable |
| Seller at 390px | No page-wide horizontal overflow |
| Browser two-person transaction state machine | Passed: status progression, reservation, audit history, completion |
| Cancellation | Disabled without valid reason, enabled with valid reason; reservation release confirmed |
| Unrelated student access | HTTP 404 for someone else's transaction |
| Web `bun run build` | PASS; Vite build and TypeScript |
| API `bunx tsc -p . --noEmit` | PASS |
| API `bun test` | **56 passed, 3 opt-in suites skipped, 0 failed** (additional tests from other concurrently developed features exist) |
| `git diff --check` | PASS (unrelated Windows line-ending warnings) |
| Isolated database after test | PASS: 0 non-migration rows, 8 test migrations unchanged |
| Local development database | PASS: 22 legacy listings, 0 WP3 transactions/logs, 7 WP3 FKs, 6 applied migrations |
| Ephemeral test server/CDP ports 4195, 5195, 9345, 9346 | Closed after test |

The development schema retains exactly two **separately gated** pending migrations:
`20261116220000_managed_student_content` and
`20261116221000_pending_announcement_edits`.

### Screenshot evidence

Synthetic fixtures only (no real student data):

- `docs/wp3-browser-evidence/buyer-pending-mobile-390.png`
- `docs/wp3-browser-evidence/seller-decision-desktop-1440.png`
- `docs/wp3-browser-evidence/buyer-completed-mobile-390.png`

These show the updated current-status panel, action priority and preservation of the site's existing green/ivory/yellow theme. They are visual artifacts, not a replacement for device testing.

## Remaining limitations and next acceptance

- Headless **Chrome mobile emulation is not iPhone Safari**. Test on an actual iPhone with a securely served synthetic-data environment; do not create test orders on a real student's account.
- Manually verify Safari address bar and on-screen keyboard, scrolling under the fixed tab bar, VoiceOver rotor/focus, touch target ergonomics, screen rotation, refresh while logged in, and buyer/seller synchronization between physical devices.
- Validate genuine foreground/background notification behavior only in separately approved push test staging; this run deliberately disabled push and did not test remote delivery.
- Browser tests verify dynamic state and basic DOM semantics but are **not a complete WCAG, color-contrast, or VoiceOver certification**.
- Production deployment, real student onboarding, campus compliance approval, and the two unrelated content migrations are not authorized by this test.

## Safe rerun

From `apps/api`, after building the web project and confirming `cpsu_marketplace_test` has **no existing rows**:

```powershell
bun test/run-wp3-browser.ts --isolated-browser-acceptance
```

The runner refuses unexpected database identities and nonempty test schemas, creates and removes synthetic data inside `cpsu_marketplace_test`, uses only temporary loopback ports, and shuts down its own browser sessions. Do not repurpose it for development or production databases.

**Scope boundaries:** No schema migration, modification of real student records, deployment, commit, push, database reset, or changing unrelated agents' work was performed in this continuation.
