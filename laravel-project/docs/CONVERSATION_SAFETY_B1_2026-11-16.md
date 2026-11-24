# Package B1 — Student Conversation Safety Closure

**Date:** 2026-11-16 | **Environment:** authorized local repo, source-only edits; no database/test-fixture changes.

## Implemented

- New `POST /api/v1/inquiries/:id/close` server route for active student participants only. Positive ID validation, participant-only 404 authorization, idempotent 204 response.
- A serializable Prisma/MySQL transaction reads and locks the authorized thread row, changes `open → closed` and audits `inquiry.closed` exactly once. Repeated close requests are idempotent; stale typing/presence entries are cleared.
- Fixed bypass: `POST /inquiries` checks thread status after upsert/reuse and both inquiry entry paths re-check inside serializable send transactions before writing a message. A closed thread returns `409 thread_closed` with no message inserted or notification sent. Both routes retain existing listing/student authorization.
- Chat UI adds an *End chat* action with confirmation, status/error feedback and a clear explanation: it closes this listing's conversation for both participants, not their accounts or other listings; existing messages remain readable and transaction records are unchanged.
- The short-iPhone layout keeps the chat safety action reachable by omitting *Test sound* in the action strip on short screens. Sound preview remains on the inbox page. No changes to message receipt, mute, keyboard, or chat bubble logic.
- New friendly `thread_closed` API error message.

## Files changed/added by this package

- Modified: `apps/api/src/routes/inquiries.ts`; `apps/web/src/pages-account.tsx`, `apps/web/src/api.ts`, `apps/web/src/mobile-refinements.css`; `docs/API_DOCUMENTATION.md`, `docs/BUSINESS_RULES.md`, `progress/DEVELOPMENT_LOG.md`.
- Added: `apps/api/src/inquiry-safety.ts`, `apps/api/test/inquiry-safety.test.ts`, `apps/web/test/conversation-safety.test.ts`.
- Added design and plan: `docs/superpowers/plans/2026-11-16-conversation-safety-b1.md` and `2026-11-16-account-recovery-blocking-reporting-b2-design.md`.
- Existing unrelated uncommitted edits preserved. No commit or push.

## Verification and limits

- TDD regression checks confirmed missing close path, bypass guard and chat UI before implementation, then passed. The extra transaction-safety tests verify the status re-check and that missing/closed threads cannot trigger an insert in an isolated mocked transaction.
- Fresh verification: API 69 pass / 4 guarded integration skips / 0 fail; web 31 pass / 0 fail; API TypeScript, web TypeScript/Vite production build and PWA asset validation pass. Live two-account and concurrent-DB acceptance remain pending.
- **Not verified:** two-logged-in-account DB/browser end-to-end, close-vs-send concurrency stress, Android/iPhone Safari live interaction. This cannot be treated as production security acceptance.
- No deployment or migrations, external provider connections or configuration changes, no local/real student data writes, and no administrator access to private messages.
- Closing a thread does not constitute durable per-user blocking, nor an official complaint/report. Full blocking, complaint evidence, recovery and verification policy remain pending privacy/security decisions described in B2 design.

**Status at original implementation:** Source/unit/build tested; real DB and live-device acceptance pending.

**Follow-up, 2026-11-17:** Real isolated-MySQL acceptance passed: 4 closure cases (including five concurrent send/close trials), after 36 Stage 1 and 4 reporting tests passed. Fixed the integration-discovered typing/presence acceptance bug; closed threads reject both heartbeats, and reads mask stale cached activity. API 103 pass / 6 guarded skips; web 42 pass, TypeScript, build and PWA pass. **Real-device QA and stress testing still pending.** See `docs/CONVERSATION_SAFETY_B1_MYSQL_2026-11-17.md`.
