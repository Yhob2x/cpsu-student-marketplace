# Testing strategy and current results

**Current platform update (12 November 2026):** One responsive web/PWA replaces the active Expo mobile workspace. Test the same `apps/web` frontend on desktop and mobile browsers and validate its production PWA shell; the API integration suite uses a dedicated isolated MySQL database. Any Expo-related history below is not a current startup instruction. See `docs/UNIFIED_WEB_PWA_2026-11-12.md`.

**Stage 1 implementation update (2026-11-11):** The previous baseline below is historical. An isolated Supertest + MySQL integration runner now exists: `cd apps/api && bun run test:integration`. It passes **14/14** HTTP/database cases; regular `bun test` passes **5/5** unit cases and skips the opt-in integration file. See `docs/STAGE1_TESTING_REPORT.md` for fixture/database safeguards and the read-only foreign-key/index audit. Additional Stage 1 schema migrations remain pending approval.


Blueprint PART X requires functional, validation, authorization, database, responsive, error-handling, and integration testing for every
module, and PART XI STEP 5 requires the agent to actually run them. This file records the strategy and the honest current state.

## 1. What exists today

| Suite | Command | Result on 11 Nov 2026 |
|---|---|---|
| Authorization unit tests (5 cases, pure functions) | `cd apps/api && bun test` | **5 passed, 0 failed**, 11 assertions, ~6 ms |
| API typecheck | `bunx tsc -p apps/api/tsconfig.json --noEmit` | **Clean** |
| Web typecheck | `bunx tsc -p apps/web/tsconfig.json --noEmit` | **Clean** |
| Schema state | `cd apps/api && bunx prisma migrate status` | **Up to date** (2 migrations applied) |
| Mobile browser/PWA typecheck | `cd apps/web && bun run build` | Same responsive React frontend as desktop; validate on physical phones before release |

`apps/api/test/permissions.test.ts` covers: campus reviewer limited to their campus, global admin reviewing any campus, system administrator
denied review, plain student has no scope, and material-change detection.

**No test exercises an HTTP route, the database, or a UI.** Every "Verified" claim elsewhere in these docs is code inspection, not a test run.

## 2. Test layers to add, in order

### 2.1 API integration (Supertest against `createApp()`)

Prefer a dedicated test database (`DATABASE_URL` pointing at `cpsu_marketplace_test`), reset between test files, and a seeded fixture:
one active campus, one suspended campus, one verified student, one pending student, one reviewer per campus, one global admin, one store,
one published listing, one prohibited-category listing.

| Area | Cases PART X demands | Additional cases to add |
|---|---|---|
| Authentication | Invalid credentials rejected | Unverified cannot create a store; suspended cannot log in; refresh reuse revokes all sessions; expired access token → 401 |
| Listings | Edit only own; invalid price rejected | Another seller's listing id → 404; material edit of a published listing reverts to draft; submit without a photo → 422; prohibited category → 422; >6 images → 409 |
| Messaging | Non-participants blocked | Own-listing inquiry → 400; message >1000 chars → 400; closed thread → 409 |
| Transactions (after WP3) | Invalid transition rejected; participants only; history recorded | Buyer cannot accept their own request; completed is terminal; every transition writes a status-log row |
| Administration | Students cannot reach `/admin`; actions audited | Reviewer of campus A gets 404 for campus B's listing; `system_admin` gets 403; analytics suppression renders `<5` at 1–4 |

### 2.2 Database tests

- Migration from an empty database succeeds (`prisma migrate deploy`).
- Unique constraints hold: duplicate favorite, duplicate affiliation, duplicate thread per buyer/listing.
- Foreign keys are the ones declared; document the undeclared ones that `docs/DATABASE_DESIGN.md` lists before adding constraints.

### 2.3 Contract tests

A single shared schema module (the pilot's planned `packages/contracts`) validated against real API responses, so web and mobile cannot drift.

### 2.4 UI and responsive

- Component tests for listing cards, forms, and error states once a runner is chosen.
- Manual device matrix: 360 px, 390 px, 768 px, 1280 px; iOS Safari, Android Chrome, desktop Chrome and Firefox.
- Keyboard-only pass on sign-in, create-listing, and the review queue.
- Screen-reader pass on the mobile listing card and inquiry thread.

### 2.5 Security regression

- Foreign-origin write returns no CORS approval.
- Upload of a `.png` renamed from an executable is rejected (after S3 is fixed, add a magic-byte test).
- Rate limit returns 429 after the configured budget.
- Media for an unpublished listing is 404 for anonymous and for another campus's reviewer.

## 3. Definition of done for a feature (enforced in review)

1. Route has auth + scope + Zod schema + audit call.
2. UI has loading, empty, error, and success states.
3. At least one integration test for the happy path and one for the permission boundary.
4. `docs/API_DOCUMENTATION.md`, `docs/BUSINESS_RULES.md`, `progress/IMPLEMENTATION_STATUS.md`, and `docs/CHANGELOG.md` updated.
5. Typecheck and the full API suite green in the same run.

## 4. Commands reference

```bash
bun test                                  # all workspace tests (currently api only)
cd apps/api && bun test                   # API suite
cd apps/api && bun run typecheck          # prisma generate + tsc
bunx tsc -p apps/web/tsconfig.json --noEmit
cd apps/web && bun run build                 # shared desktop + phone frontend
cd apps/api && bunx prisma migrate status
```

## 5. Honest limitations

- No load, accessibility-audit, or browser-matrix testing has been performed.
- No backup/restore drill has been run in this environment.
- Mobile behavior has never been executed here; the code typechecks only when its dependencies are installed.
