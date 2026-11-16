# WP3 Gate C — Automated Browser Acceptance (Isolated Local)

**Date:** 2026-11-16, Asia/Manila  
**Git HEAD during test:** `a4a36b5`  
**Scope:** Transaction PWA browser user journeys only; test-only users, test-only API, isolated DB, no development/student data writes, production, external services, commits, pushes or deployments.

## Executive outcome

**PASS — 30 automated Chrome UI and data-integrity checkpoints** across **two independent browser profiles**:
- Buyer: headless **Google Chrome 157**, **mobile emulation**, 390 × 844 CSS pixels with touch enabled.
- Seller: headless Google Chrome 157, desktop 1440 × 900 CSS pixels.

Both instances used temporary independent browser profiles, separate authentication sessions, and the same test-only website. **This is not a physical iPhone Safari test**; Safari-specific PWA, touch behavior, sounds, notification permissions, Add to Home Screen and push delivery still need device acceptance.

## Isolation and protection

- Reused existing **`cpsu_marketplace_test`**, but only after strictly verifying it had **26 expected tables**, **8 completed test migrations**, **0 non-migration rows**, and **0 other database sessions**. No reset of unknown/existing records was authorized.
- Synthetic student fixtures were created with existing `seedFixtures` in the test schema only and removed with the guarded `resetFixtures` once the test was over.
- Local API and website were hosted **temporarily on loopback ports 4195 and 5195**, with `DATABASE_URL` forced to `127.0.0.1:3306/cpsu_marketplace_test`; they **did not point to the active development API at port 4000**. Push enrollment and delivery were disabled for this test.
- Headless Chrome CDP ports **9345 and 9346** were isolated to loopback. Both temporary app servers and Chrome instances closed after the test; no remaining browser profile folder or listeners were found.
- Post-run database audit: test schema had **zero non-migration rows**, and no synthetic student identities remained.
- Independent development-database WP3 postcheck: **22 original listings, 0 WP3 transactions and logs, 0 reservations, all 7 FK constraints, 6 applied migrations**. Two unrelated managed-content migrations remain pending in development.

## Scenarios verified through actual UI interactions

1. Two synthetic verified students signed in using separate browser sessions.
2. Mobile listing page displayed **Request item**, and clicking it created a buyer-owned pending transaction with navigation to its detail page.
3. Seller desktop transaction page rendered **Accept request**. Clicking it moved to accepted and the server exclusively reserved the correct physical listing.
4. Buyer confirmation of meetup **did not** advance the status alone; after seller confirmation, UI showed **Meetup agreed**.
5. Seller completion confirmation alone **did not** mark the listing sold; buyer's separate completion confirmation moved to **Completed**, marked the listing sold, and preserved two meetup and two completion history events.
6. Completed state remained visible after the browser page reloaded.
7. A second synthetic physical listing could be requested and accepted, then cancelled from the buyer's **actual reason field** and **Cancel transaction** button; server returned its item to `available`.
8. An unrelated authenticated student received HTTP **404** trying to read the private completed transaction.
9. Mobile listing, pending, and completed transaction screens had working controls; the tested mobile-width pages produced **no document-wide horizontal overflow**. Desktop seller decision controls were also present.

## Checks and reproducibility

### Automated browser runner

```powershell
cd C:\Users\acer\Downloads\cpsu-student-marketplace\apps\api
bun test/run-wp3-browser.ts --isolated-browser-acceptance
```

**Safety:** The runner refuses execution without the exact `--isolated-browser-acceptance` argument, the exact local database identity, a pristine 26-table isolated test schema, complete test migration history, and no other connection to that test schema. It cleans up its own fixtures and private browser servers even on failure. **Do not run this against a database with data.**

The first two trial runs stopped on the browser harness's overly strict sign-in selector and incorrectly quoted status selector; both removed their synthetic fixtures. These errors were fixed in the **test harness only**. The final full run passed all **30 checkpoints**. No application route, schema, Prisma migration or user data was edited to obtain a passing result.

### Additional regressions

- `bun test` (API): **51 pass, 3 opt-in suites skipped, 0 fail**, 223 expectations.
- `bunx tsc -p . --noEmit` (API): **PASS**.
- `bun run build` (web, includes TypeScript): **PASS** (49 modules).
- `git diff --check`: **PASS**, with Windows line-ending warnings from unrelated files.
- Development WP3 postcheck: **PASS**.
- Synthetic test database cleanup audit: **PASS**.

## Remaining release gates

- **Real iPhone Safari** and desktop interactive human acceptance, including accessible focus order, touch target ergonomics and VoiceOver.
- Dedicated narrow-screen visual inspection beyond overflow/controls; layout aesthetics have not been certified.
- Realtime chat and push sound/notification behavior across actual devices; optional push integration suite was not executed here.
- Repeat concurrency tests under production-like load, independent privacy and security review, and campus approval before staging/production.
- Two managed-content migrations must be separately reviewed/approved before anyone deploys them to development; ordinary unscoped Prisma migration deploy would apply both.

**Change inventory:** Added only `apps/api/test/run-wp3-browser.ts` and this report in this continuation. Preserved all other agents' worktree edits; no commits or pushes.
