# Security and User-Flow Closure — Package A

**Date:** 2026-11-16 (Asia/Manila)
**Environment:** Local CPSU Market worktree, no migration, deployment or student-data write.

## Delivered

1. Login and Register now use a shared single-flight submission guard, accessible busy state, disabled buttons and in-progress labels. Errors unlock the form for a retry.
2. The Saved route waits for session restoration and redirects signed-out users to `/login?next=%2Fsaved`. The login deep-link allowlist now recognizes exactly `/saved`.
3. Logout no longer creates an unhandled rejection when server revocation fails. A visible alert explicitly says the session may still be active, and the user may retry. Duplicate logout presses are prevented. Local credentials are cleared only after the server reports success.
4. A verified public store profile includes a seller-report action for signed-in non-staff students who are not its owner. Reports use the existing `POST /api/v1/reports` endpoint, an audited reason of 10-1000 characters, and accessible feedback. No moderation authorization was changed.

## Files changed or added by Package A

- Modified: `apps/web/src/main.tsx`, `apps/web/src/pages-account.tsx`, `apps/web/src/pages-public.tsx`.
- Added: `apps/web/src/auth-submit.ts`, `apps/web/test/auth-submit.test.ts`, `apps/web/test/security-user-flow-closure.test.ts`, `apps/web/test/guest-saved-browser-smoke.ts`.
- Added this record and the package plan in `docs/superpowers/plans/`.
- Existing uncommitted changes in these files and elsewhere were preserved through focused edits; no commit/push.

## Verification — fresh checks

- Targeted UI guard/flow source regressions and runtime submission-lock tests: **6 pass, 0 fail**.
- Web test suite: **27 pass, 0 fail** (includes source-level assertions; not all are runtime DOM tests).
- API unit suite: **63 pass, 4 opt-in skipped, 0 fail**.
- Web TypeScript and Vite production build: **PASS**.
- PWA asset validation: **PASS**.
- Read-only guest Chrome smoke via locally served Vite: **PASS**. Signed-out `/saved` shows the sign-in page, not the former permanent loading message.
- `git diff --check`: **PASS** (unrelated CRLF conversion warnings).
- Not performed: authenticated end-to-end seller reporting, real iPhone/Android acceptance, load testing, isolated DB integration, production deployment.

## Deferred — separate design/approval gates

- Password recovery requires approved identity verification, reset transport and privacy/retention decisions.
- User blocking and conversation reporting require new data model, authorization design, and transition/moderation tests.
- Verification eligibility conflict (guest/new user inquiries vs verified-only transactions) requires approved campus policy.
- Category CRUD, investigation/appeal lifecycle, announcement migrations and WP3 development migration remain separately gated.
- All Windows firewall profiles were reported disabled during the earlier read-only audit; **this work did not modify firewall/network settings**. Restore protections before accessing shared or school networks under an approved configuration change.
- Google Drive, push, and private student data require their established data protection and release gates.

**Status:** Package A locally implemented and source/unit/browser-guest verified, **not production approved**.
