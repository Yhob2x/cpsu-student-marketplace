# CPSU Marketplace — access-control remediation and admin operations
**Date:** 16 November 2026
**Status:** Local implementation and automated tests passed. **Not a production approval.**
**Baseline:** `MASTER_BLUEPRINT.md`, `AGENTS.md`, and the current working tree. Existing uncommitted push/image-safety work was preserved.

## Implemented in this remediation

### 1. Report authorization
- `GET /api/v1/admin/reports` now filters by authenticated review authority. Campus reviewers only see reports whose listing/seller target belongs to their permitted campus. If a legacy report specifies both targets, both must pass campus scope. Un-targeted reports are excluded from campus queues.
- `POST /api/v1/admin/reports/:id/resolve` applies the same scope to lookup **and** atomic update. An out-of-campus or nonexistent report returns 404; replay of an already completed decision returns 409 and does not write a second audit event.
- University-wide reviewers retain their explicitly global scope. Ordinary students cannot use admin routes.

### 2. Suspended-seller privacy and access
- Suspended owners are excluded from public search, popular results, listing details, seller profiles and image serving, plus signed-in saved items and favorites creation.
- New inquiry creation rejects a suspended seller; already-open threads do not accept new replies to that seller. Existing participants can still read their message history, but the old public image URL is not exposed via the conversation response.
- Newly issued refresh tokens are denied when a user's current database account status is suspended, even if an old session row was not revoked.

### 3. Account suspension/reactivation
- Global university administrators can use `GET /api/v1/admin/users?q=<term>` (limited to 25, with no password hashes) and `PATCH /api/v1/admin/users/:id/status` with `{ status: "active" | "suspended", reason: string }` (10–500 characters).
- Campus reviewers and students cannot administer accounts. The action rejects self-suspension, staff-account changes, no-op transitions and invalid IDs.
- Status, revocation of all active refresh sessions on suspension, administrator audit log and in-app account-status notice are persisted in a database transaction. Reactivation requires a fresh login; old revoked refresh sessions remain revoked.
- The existing /admin page now includes a search and reason-required status action for eligible accounts. The interface hides these actions on protected staff accounts. Manual browser accessibility QA is still required.

### 4. Audit viewing
- `GET /api/v1/admin/audit-logs?limit=25&cursor=<id>` returns newest-first records (maximum 50 per page) to global university administrators only. Students and campus reviewers cannot view university-wide audit history.
- The existing /admin page displays these events and a Load older events button. No passwords are returned.
- This is not a dedicated investigation workflow or a fully featured administrative reporting system.

## Verification executed on the authorized local computer
- Before each fix, new isolated MySQL integration tests reproduced cross-campus report leakage, suspended-seller public visibility, old-session refresh of a suspended user, missing account status controls and the absent audit-log endpoint.
- `cd apps/api && bun run test:integration`: **24 passed, 0 failed**; uses `cpsu_marketplace_test` only, followed by read-only FK/index audit.
- `cd apps/api && bun run test:push:integration`: **7 passed, 0 failed**, synthetic endpoints, `cpsu_marketplace_push_test` only.
- `cd apps/api && bun test`: **17 passed, 2 explicitly skipped integration suites, 0 failed**.
- `cd apps/api && bunx tsc -p . --noEmit`: passed.
- `cd apps/web && bun run build`: passed (TypeScript and Vite).
- `git diff --check`: no whitespace errors; line-ending warnings were from Windows/Git.
- Attempting `bunx prisma generate` earlier encountered a Windows locked engine DLL (EPERM); the subsequent API typecheck and isolated suites passed using the already present generated client. **Fresh regeneration is not independently verified.**

## Changed files in this work package
- `apps/api/src/routes/admin.ts`
- `apps/api/src/routes/public.ts`
- `apps/api/src/routes/account.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/src/routes/inquiries.ts`
- `apps/api/test/integration/stage1.test.ts`
- `apps/web/src/pages-admin.tsx`
- this report, progress issue statuses, and the MVP status note.

No database schema change, development/production migration, credential rotation, Git commit, push or deployment was performed. Isolated test databases were used for synthetic fixtures. Existing uncommitted files remain in place.

## Still blocking a production release

1. **Critical — MVP-014/015 transaction module.** No purchase-request/transaction/status-log implementation. The C5 state machine, authorized transitions and relationship to existing `Handoff` need a recorded owner decision before a new migration.
2. **High — identity/verification and recovery.** CPSU-approved email verification method and private student fields, password reset delivery, privacy assessment and retention policy are still missing. Do not gather student ID scans without institutional approval.
3. **High — full administrator scope.** Category CRUD/catalog mapping (C7), announcements, investigation findings, richer analytics and broader report lifecycle remain incomplete. The new global account/audit controls are not a substitute.
4. **High — release operations.** HTTPS domain, monitoring and alerts, scheduled backups and tested restore, secret rotation, data deletion/retention rules, and physical Android/iPhone and accessibility acceptance remain pending.
5. **High — upstream work.** Concurrent PWA push implementation is locally testable but its migration and real-device delivery have not been approved or verified for real students. Image moderation still requires policy review and retrospective handling of existing files.
6. **Medium — student safety.** Blocking users and reporting conversations, complete notification events, realistic search pagination/mobile-data UAT remain unresolved.

**Release decision: NOT READY FOR PRODUCTION.** Next engineering package should start with documented C5 authorization/transaction rules and an additive schema migration plan, while the institute decides identity and role/catalog policies. Do not deploy until test, security, privacy and real-device gates pass.
