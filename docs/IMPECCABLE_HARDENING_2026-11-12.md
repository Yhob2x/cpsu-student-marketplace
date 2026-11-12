# Impeccable — Interaction Reliability Hardening
Date: 2026-11-12
Scope: CPSU Student Marketplace, local development only. Follow-up to the read-only Impeccable UI/UX audit.

## Constraints
- Preserved MASTER_BLUEPRINT.md scope, existing color theme, navigation, review workflow, API contracts and database schema.
- No payment, delivery, monetization, vendor, or authorization features introduced.
- Existing uncommitted work was not reset or overwritten intentionally.

## Changes
### apps/mobile/src/App.tsx
- Conversation replies: do not clear the composer until the API confirms success; display send errors, prevent concurrent sends, respect closed threads and preserve unsent content.
- Inbox and conversation loading: distinguish loading/empty/error states; show retry controls; guard late results against stale or unmounted requests.
- Listing details: add a retryable load-failure state, protect in-flight actions, and retain inquiry text when sending fails.
- Reporting: require a user-entered reason of at least 10 characters, capped at 1000 characters to match the existing API; provide cancel, progress and success/failure feedback.
- Home, profile, registration: expose otherwise silent network errors with a recovery path for featured sections, categories, notifications, seller listings and campus choices.
- Conversation refresh: pause periodic polling while the app is not active.

### apps/web/src/pages-account.tsx
- Validate photo type and 3 MiB maximum before creating or editing a listing.
- If a draft/details save succeeds but the photo upload fails, state that the listing **was saved**, keep it available for editing, and direct users to retry the photo on the existing listing.
- Prevent rapid duplicate listing-creation and edit requests through immediate in-flight guards and disabled submit actions.

## Verification
- Mobile: `npm run typecheck` passed.
- Web: `npm run build` passed.
- API authorization unit tests: 5 passed, 0 failed (`bun test test/permissions.test.ts`).
- Impeccable source detector for changed web file: `[]` (no deterministic findings).
- `git diff --check`: no whitespace errors.
- Browser smoke test: a fresh temporary Expo web bundle was loaded with mocked API replies. A simulated HTTP 500 for sending a message left the reply text intact and displayed failure feedback; no real marketplace data was created.
- The pre-existing Expo preview on port 8081 served stale JavaScript during verification. A separate port 8082 preview loaded the new code, and the initial preview was left untouched.

## Remaining verification
- Test iOS/Android physical devices: keyboard avoidance, VoiceOver/TalkBack, background/foreground, interruption and touch targets.
- End-to-end testing of photo-upload partial success with a controlled API failure still needs a dedicated frontend test harness.
- No persistent automated frontend UI test suite was added; the current checks are compiler, unit and mocked-browser smoke checks.
