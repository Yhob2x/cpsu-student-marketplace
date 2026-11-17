# CPSU Market — Role-focused administration and moderation

Date: November 17, 2026
Scope: Local web admin workspace and one report-resolution API validation/audit improvement.

## Intent and boundaries
Create a **review-first** workspace for campus reviewers and a **management-first** dashboard for global university administrators. Preserve the existing authorization, review queue, reports, user management, student data, visual palette, and uncommitted work.

## Phase 1 — decision safety
- Report resolution and dismissal require a written investigation reason (10–1000 characters). The API validates it and stores it in the existing audit-event metadata inside the same database transaction as the report-status change; **no database migration**.
- The Reports area displays action failures without hiding the queue or discarding the entered findings.
- The Approve button requires a reason of at least 20 characters on academic-integrity flagged listings, matching the existing API requirement. Changes requested and reject retain the general five-character minimum.
- Listing, affiliation, report and student-account status decisions now show a success notice after the server confirms the action.
- Affiliation queue displays name, campus, email and affiliation ID, with explicit guidance to consult authorized campus records because the queue itself does not supply proof. This does **not** constitute campus verification.
- Reviewer account management displays an actionable campus-list load error with Retry.
- Admin load is gated on authenticated user availability to avoid wrong first-route selection and premature unauthorized requests.
- Updated existing isolated integration tests that call the report-resolution endpoint to include a reason. Existing tests must be run only against an authorized isolated test DB.

## Phase 2 — role-oriented navigation
- Campus reviewers start on **Listing reviews**, with grouped navigation to Verifications, Reports, Transactions and Campus overview.
- Global university administrators start on **Overview**, with Management (Students, Reviewer accounts, Content), Review & safety (Listings, Verifications, Reports), and Monitoring (Transactions, Audit history).
- Responsive desktop sidebar and mobile section selector preserve existing controls and routes.
- Listing reviews have a selectable desktop queue and one case-detail inspector. The mobile layout uses a listing selector above the detail view. Existing moderation actions, required reasons and human-photo confirmation remain intact.
- Overview shortcuts link to existing review workloads, using actual loaded counts and a placeholder dash while pending.

## Files involved
- apps/web/src/pages-admin.tsx
- apps/web/src/pages-reviewers.tsx
- apps/web/src/admin-workspace.css (new)
- apps/api/src/routes/admin.ts
- apps/api/test/integration/stage1.test.ts
- apps/api/test/integration/report.test.ts (pre-existing untracked test file, call sites adjusted)

## Verification and limits
- Web TypeScript + Vite build: passed.
- API TypeScript check without Prisma generate: passed.
- Full API `bun run typecheck` attempt was blocked by a Windows Prisma DLL rename EPERM during `prisma generate`; generated-client TypeScript check was run separately.
- Scoped `git diff --check`: passed (only Windows LF/CRLF advisory).
- Focused existing frontend unit test: passed (2 tests).
- API normal unit suite: 104 passed, 7 intentionally skipped integration/remote tests, 0 failed (no database access).
- No authorized isolated MySQL integration, authenticated rendered admin acceptance, mobile physical-device acceptance, or screen-reader audit completed in this pass.
- No migrations, seed operations, live student data changes, push/PWA changes, commit, push or deployment.
- Remaining improvement packages: API queue pagination/search, formal affiliation evidence access policy, report investigation lifecycle/status, and role-authenticated responsive browser/accessibility acceptance.
