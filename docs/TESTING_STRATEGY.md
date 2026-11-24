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

**Historical (11 November) statement:** That initial five-case baseline did not exercise HTTP, the database, or a UI. As of 17 November, dedicated isolated DB integration tests exist as opt-in suites, and `apps/api/test/report-http.test.ts` exercises reporting with real Express + Supertest against synthetic in-memory database stubs. It does **not** prove real-MySQL rollback or two-student end-to-end behavior. See `docs/SECURITY_REPORT_HTTP_B2A_2026-11-17.md`.

## 2. Test layers to add, in order

### 2.1 API integration (Supertest against `createApp()`)

Prefer a dedicated test database (`DATABASE_URL` pointing at `cpsu_marketplace_test`), reset between test files, and a seeded fixture:
one active campus, one suspended campus, one verified student, one pending student, one reviewer per campus, one global admin, one store,
one published listing, one prohibited-category listing.

| Area | Cases PART X demands | Additional cases to add |
|---|---|---|
| Authentication | Invalid credentials rejected | Unverified cannot create a store; suspended cannot log in; refresh reuse revokes all sessions; expired access token → 401 |
| Listings | Edit only own; invalid price rejected | Another seller's listing id → 404; material edit of a published listing reverts to draft; submit without a photo → 422; prohibited category → 422; >5 images (sixth upload) → 409 |
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

## 2026-11-17 — Isolated real-MySQL public reporting acceptance
The opt-in `cd apps/api && bun run test:integration` now executes Stage 1 (36 passed) and a new reporting suite (4 passed) **sequentially** against only `cpsu_marketplace_test`. New cases cover report/audit persistence, denied roles and invalid/hidden targets, reviewer campus scoping and resolution, and true Prisma/MySQL transaction rollback when a test audit write throws. The test subprocess now forces local-only media storage and clears Drive credentials; the fixtures guard rejects nonlocal media mode. Ordinary `bun test` still skips integration. Full ordinary API: 97 pass/5 skipped; web: 34 pass; API typecheck/build/PWA checks passed. See `docs/SECURITY_REPORT_MYSQL_B2A_2026-11-17.md` for the initial inherited-Drive incident and cautious cleanup note. This is not a production migration or real-device QA pass.

## 2026-11-17 — Real isolated-MySQL conversation closure acceptance (B1.2)
The guarded `cd apps/api && bun run test:integration` now runs **three independent suites sequentially** in the local `cpsu_marketplace_test` database: Stage 1 36/36, public reports 4/4, and conversation closure 4/4; no student DB writes. The new suite checks two participant roles, outsider/staff denial, idempotent close + one audit, retained history, both post-close message entry paths, no rejected-send notification, typing/presence suppression, and **five simultaneous send/close races**. It exposed the previously accepted post-close heartbeat bug (204) and verified the new `409 thread_closed` safeguard; thread responses now mask stale cached activity. Regular API `bun test`: 103 pass / 6 opt-in skips; web: 42 pass; API TypeScript/web build/PWA pass. See `docs/CONVERSATION_SAFETY_B1_MYSQL_2026-11-17.md`. These checks are not a replacement for a full concurrency stress test or physical iPhone/Safari QA.

## 2026-11-17 — B1.3 bounded MySQL contention and iPhone preflight
The opt-in integration runner now adds `test/integration/inquiry-close-stress.test.ts` after the 36 Stage 1, 4 public-report, and 4 conversation-close cases. The additional stress suite passes 40 send-versus-close rounds (three sends each), 20 two-party close rounds, 10 post-close replay waves and one rate-limit boundary test. Observed 31 conflict responses under deliberate contention, with idempotent close retries in test only; no post-close writes or duplicate closure audits. No production middleware is weakened: each independent phase uses a fresh `createApp()` instance, and the 301st /health request on one fresh instance returns 429. Synthetic DB only, local media storage, Drive credentials cleared. Full ordinary API 104 pass/7 opt-in skipped; web 42 pass; API typecheck, Vite build, PWA, diff check pass. Physical iPhone Safari preflight returned NOT READY: Windows Firewall Domain/Private/Public disabled and Wi-Fi Public. See `docs/CONVERSATION_STRESS_SAFARI_B2_GATE_2026-11-17.md`, `docs/IPHONE_SAFARI_CONVERSATION_ACCEPTANCE_2026-11-17.md`. No physical device acceptance has been claimed.

**B1.3 final worktree caveat:** A subsequent entire-repository `git diff --check` failed on an unrelated concurrently modified `apps/web/src/mobile-refinements.css` EOF blank line; B1.3's tracked-file-only diff check passed. Do not mark the whole worktree whitespace-clean until that independent edit is reviewed.
