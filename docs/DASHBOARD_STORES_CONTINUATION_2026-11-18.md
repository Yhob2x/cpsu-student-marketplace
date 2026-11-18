# CPSU Market — Dashboard and Storefront continuation
Date: 2026-11-18 (Asia/Manila)
Environment: authorized local development PC. Scope: finish interrupted verification and close identified code-only audit gaps.

## Preserved owner decisions
- Continue using the already-approved readable and rename-sensitive store URLs. No slug schema change or alias migration.
- Hide public student stores unless their owners meet CPSU affiliation requirements.
- Keep the owner-only authenticated follower endpoint and the subsequently approved public follower/following lists; minimize public fields.
- Do not alter the listing, chat, purchase, PWA, or payment behavior beyond visibility restrictions required by the rule.

## Continued and finished
- Resumed previous worktree without resetting, undoing, committing, or pushing.
- Confirmed category loading/error/retry behavior and newest-request-only listing refresh in Dashboard.
- Wired the existing `openEditor` discard guard into every listing Edit button. Changing existing/new cover images now marks an edit dirty, so Cancel or editor switching prompts to discard.
- `POST /inquiries` now uses the shared `rowAccess.publicListing()` query predicate, preventing a new inquiry from beginning on a no-longer-public listing.
- Public listing/store report target resolution now uses the shared public predicates instead of former approval+active-only checks.
- Public student store eligibility now checks owner active, no staff role, approved student store, verified and unexpired affiliation on an **active CPSU campus**. The avatar visibility check was aligned with the same eligibility conditions.
- Updated report-safety structural test expectations for the stricter public eligibility predicate.
- Preserved public Followers/Following fields and the counts-only refresh behavior already approved in the Store Connections project record.

## Verification in this continuation
- Initial resumed checkpoint: 29 API focused tests and 16 web focused tests passed; API TS passed; web production build passed.
- Final API full local `bun test`: **175 passed, 8 opt-in integration skips, 0 failed** across 46 files.
- Final web full local `bun test`: **91 passed, 0 failed** across 27 files.
- API TypeScript (`bunx tsc -p . --noEmit`): **passed**.
- Web production build (`bun --filter @cpsu/web build`): **passed**.
- Expected React Router `useLayoutEffect` SSR warnings remain in render-to-string tests, not failures.

## Release gates and open decisions
1. Authenticated end-to-end tests with multiple real/synthetic user sessions and campus reviewers in an approved isolated DB.
2. Physical-device iPhone Safari, Android Chrome and installed PWA acceptance, including the editing warning, follower dialog, and floating chat.
3. Stable indexed slug would need a separate data migration and approval; current rename-sensitive URL behavior remains intentionally unchanged.
4. Review whether affiliation revocation/expiry should also change the **private** dashboard status label and whether establishment sellers have a separate approved verification pathway. Public student-store filtering is enforced independently.
5. Full API authorization and concurrency verification remain release gates; app-enforced MariaDB row scopes are not native PostgreSQL RLS.

No database migration, SQL write, live user-record change, deployment, Git commit or push was performed.
