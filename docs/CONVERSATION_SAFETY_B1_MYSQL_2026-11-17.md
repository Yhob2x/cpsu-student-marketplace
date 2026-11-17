# Package B1.2 — Real MySQL Conversation Closure Acceptance

**Date:** 2026-11-17
**Scope:** CPSU Market, authorized local test repository; synthetic students and listings only.
**Status:** Real isolated-MySQL test acceptance passed; physical device and production rollout not yet accepted.

## New coverage and fix
- Added opt-in `apps/api/test/integration/inquiry-close.test.ts` (four real Express/JWT/Prisma/MySQL cases) to the established sequential Stage 1 runner.
- A buyer or seller can end a thread; staff, outsiders and anonymous users cannot. Repeated close is 204 and creates exactly one `inquiry.closed` audit. Both participants retain readable history.
- Both `POST /inquiries` and `POST /inquiries/:id/messages` return 409 after closure, without creating a message or sending notifications.
- The real database test found a bug: closed chats still accepted fresh `/:id/typing` and `/:id/presence` heartbeats (204). Fixed by returning `409 thread_closed` on both routes when `status !== open`.
- Thread reads now mask stale cached typing and presence even if a heartbeat races with closing, preventing false online/typing indicators in closed conversations. Reading history and acknowledging old messages remain allowed.
- Five real simultaneous send/close trials checked that messages reflect the winning transaction, conflicts are explicit, the final thread is closed with one audit, and subsequent messages cannot be inserted. Serializable deadlock conflict (409) may require safe user retry; no silent stale writes accepted in these trials.
- The test-only runner remains loopback + `cpsu_marketplace_test` guarded, forces `MEDIA_STORAGE=local` and clears Google Drive credentials, resets synthetic rows and runs each suite sequentially.

## Verification results — fresh, 2026-11-17
- Guarded isolated MySQL: Stage 1 **36 passed**, public reporting **4 passed**, conversation closure **4 passed** = **44 passed** and read-only integrity audit succeeded.
- Ordinary API unit: **103 passed, 6 optional guarded skips, 0 failed**.
- Web: **42 passed, 0 failed**.
- API TypeScript, web TypeScript + Vite production build, PWA asset validation, `git diff --check`: all passed.
- Both failing-test states were observed before fixing: integration typing after closure returned 204 rather than 409, then source-level stale-presence masking test failed before implementation.

## Release limitations
- This is five concurrent race samples, **not full load/stress testing** and does not prove all possible MySQL scheduling paths.
- Real two-device, two-logged-in-student browser test and iPhone Safari conversation dock/scroll/UI test remain pending.
- Durable user blocking and private-message reports are **not implemented** and still require the separate institutional policy, DPO privacy and migration gates.
- No application database writes/migration, Google Drive test upload, external email/auth changes, deployment, commit, push, or student-data edits were performed in this package.

## Files
`apps/api/test/integration/inquiry-close.test.ts` (new), `apps/api/test/run-integration.ts`, `apps/api/src/routes/inquiries.ts`, `apps/api/test/inquiry-safety.test.ts`, corresponding plan, this report, API docs, business rules, testing strategy, and development log.
