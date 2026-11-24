# Package B2a — Public Report Integrity Hardening
**Date:** 2026-11-17
**Project:** CPSU Student Marketplace (local source only)

## Security improvement
- `POST /api/v1/reports` now accepts **exactly one** positive integer `listingId` or `sellerProfileId`, plus a trimmed, 10–1000-character reason. Unexpected attributes and ambiguous targets are rejected.
- The server resolves the report target in the actual database: listings must be published and not deleted, and their seller must be approved and active; seller-profile reports require an approved, active seller.
- A student cannot report their own listing/store. An absent or non-public target receives `404 not_found`; own target receives a client error. Staff continue to be denied by `requireStudent`.
- A single Prisma transaction persists the report and its minimal `report.create` audit log. An audit write failure rolls back report creation.
- The existing campus-scope restriction for reviewers and the same public reporting UI remain in place. No private chat evidence or student identity material was introduced.

## Fresh verification
- **16 new target/validation/audit tests**: passed, after intentionally observing a failing missing-module test and a failing route-wiring test.
- Full API unit suite **85 passed, 4 opt-in skipped, 0 failed**.
- Web suite **31 passed, 0 failed**; API TypeScript and web TypeScript/Vite production build passed.
- Tests cover forged/negative/fractional IDs, both targets, neither target, unexpected keys including fabricated message IDs, reason length, unavailable/own targets, DB filter shape and atomic audit callback.
- **2026-11-17 follow-up:** added 10 passing Express/Supertest HTTP checks for role denial, student reporting, invalid targets and simulated audit rollback, with an in-memory synthetic database. The production route mounts this tested handler. Full current suite: API 95 pass / 4 opt-in skips; web 31 pass; TypeScript and web build pass. See `docs/SECURITY_REPORT_HTTP_B2A_2026-11-17.md`.
- **Not yet accepted**: real signed-in buyer/reviewer end-to-end reporting against an isolated synthetic MySQL database; actual DB rollback/concurrency, rate-abuse/load checks and physical iPhone/Android browser validation.

## Change set
- `apps/api/src/report-safety.ts` (new)
- `apps/api/src/routes/account.ts`
- `apps/api/test/report-safety.test.ts` (new)
- This report; `docs/API_DOCUMENTATION.md`; `docs/BUSINESS_RULES.md`; `docs/SECURITY_GUIDELINES.md`; `progress/DEVELOPMENT_LOG.md`; Package B2a plan.

## Remaining separate approvals
Password recovery delivery and email ownership; genuine cross-listing user blocking; private conversation/message reporting; reviewer evidence exposure and retention; student affiliation messaging policy. These require the prior Package B2 design and CPSU privacy/security approvals.

**Release status:** locally implemented and unit/type/build verified, **not deployed**. No credentials, student data, database migrations, external services or firewall settings changed.
