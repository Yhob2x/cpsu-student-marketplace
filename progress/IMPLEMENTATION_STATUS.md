# Implementation status

**Platform consolidation (2026-11-12):** The primary interface for desktop, tablets and phones is now **one responsive React/Vite PWA** (`apps/web`), supported by `apps/api`. The prior Expo app and its local uncommitted source are safely archived at `legacy/expo-mobile` and removed from the workspaces. `npm run mobile`/`bun run mobile` and the `extra.apiUrl` setup are no longer required. See `README.md`, `docs/SYSTEM_OVERVIEW.md` and `docs/UNIFIED_WEB_PWA_2026-11-12.md`. Older entries below describe historical work.

**WP2 status (2026-11-11):** C4 approved; local Prisma reports four applied migrations (Stage 1 FK/index + WP2 states included). Product condition, availability management, sold terminal status, soft delete, search filter, favorite restriction, web seller UI, and mobile browse safety are implemented. 17 integration tests, five unit tests, API/web/mobile typechecks and web build pass. Browser/mobile-device acceptance testing outstanding; no production release. Full report: `docs/WP2_IMPLEMENTATION_REPORT.md`.

**Stage 1 restore evidence (2026-11-11):** Full SQL backup and restore of local dev data succeeded in an isolated schema, preserving 402 records across 20 tables. Candidate integrity migration tested successfully on restored data and discarded with the sandbox. Dev/production schema unchanged, migration deployment gate pending. See `docs/STAGE1_RESTORE_DRILL_REPORT.md`.

**Stage 1 isolated migration rehearsal (2026-11-11):** Candidate (19 FKs + 1 composite Listing index) was generated and tested successfully against a temporary synthetic MySQL database. Main `prisma/schema.prisma`, tracked migrations and development/production DBs unchanged. Production-like restore testing and owner approval of FK semantics/deployment remain outstanding. See `docs/STAGE1_SANDBOX_MIGRATION_RESULTS.md`.

**Additional Stage 1 preflight (2026-11-11):** Local `cpsu_marketplace` read-only audit verified 19 missing FK declarations among 19 audited references, no orphan references at the time of the scan, and no composite discovery index. An approval dossier exists at `docs/STAGE1_DATABASE_INTEGRITY_APPROVAL.md`. Migration is NOT applied; Stage 1 schema gate remains pending while existing tests pass (14 integration, 5 unit).

**Stage 1 update (2026-11-11):** Test foundation implemented: opt-in isolated `cpsu_marketplace_test` integration suite (14/14 passing), existing unit tests (5/5 passing), TypeScript API check clean. A read-only integrity audit identified ten missing foreign-key declarations and no composite listing discovery index in the test schema. Database repair/index migrations remain unapproved and unapplied. See `docs/STAGE1_TESTING_REPORT.md`. Existing MVP counts are unchanged.


**As of:** 11 November 2026. **Baseline:** `MASTER_BLUEPRINT.md` v1.0.
**Change in this update:** UI/UX work — web five-destination navigation, Profile page, notification centre, mobile Home tab and Profile notifications, and a session-refresh fix found while verifying it — plus documentation. No API route, Prisma model, migration, or dependency changed.

## 1. Verification actually performed (11 Nov 2026)

| Check | Command | Result |
|---|---|---|
| API unit tests | `cd apps/api && bun test` | **5 passed, 0 failed** (11 assertions, ~6 ms) |
| API typecheck | `bunx tsc -p apps/api/tsconfig.json --noEmit` | **Clean** |
| Web typecheck | `bunx tsc -p apps/web/tsconfig.json --noEmit` | **Clean** |
| Web production build | `cd apps/web && bun run build` | **Succeeded** — 35 modules, 202 kB JS / 64 kB gzip, 6.98 kB CSS |
| Expo web bundle | `cd apps/mobile && bunx expo export --platform web` | **Succeeded** — 435 modules, 672 kB (2.9 MB dev bundle), no resolution errors |
| Schema/migration state | `cd apps/api && bunx prisma migrate status` | **Up to date**, 2 migrations, MySQL `cpsu_marketplace` reachable at 127.0.0.1:3306 |
| Mobile typecheck | `cd apps/mobile && bunx tsc -p tsconfig.json --noEmit` | **Clean** — Expo dependencies resolve from the workspace root |
| Runtime UI | Preview tab against `http://localhost:5173` with the API on :4000 | **Viewed**: Home renders the five-destination nav; signed in as `seller@dev.test` the header shows Saved / Inquiries / My store and an **Alerts 6** badge; `/profile` renders identity, email, affiliation, quick links and the settings form; `/notifications` lists 6 unread items **after a hard reload**, the case that previously failed (KI-029). Expo web target (`:8081`) renders Home with live listings and category chips after the display fixes. **Native iOS/Android builds were not run** |

Nothing below claims runtime behavior that was not either executed above or read in the code.

## 2. Module completion

Percentages are judgement calls based on the requirement lists in `docs/FUNCTIONAL_REQUIREMENTS.md`, not lines of code.

| Module | Done | Partial | Missing | Estimate |
|---|---|---|---|---|
| 01 Authentication and verification | Login/logout, sessions, staff verification | Registration fields, profile, account status | Email verification, password recovery | 70% |
| 02 Product listings | Create/edit/view/upload/submit/report | Condition, availability, delete | — | 65% |
| 03 Student services | Create/edit/upload/inquire | Delete, portfolio | — | 65% |
| 04 Search and discovery | Keyword/category/campus/type/price/pagination | Sort, condition filter, sections | — | 55% |
| 05 Favorites | Add/remove/list | Own-listing block, change display | — | 70% |
| 06 Messaging | Threads, history, participants-only | Block, report thread, close | — | 70% |
| 07 Transactions | — | — | Everything | **0%** |
| 08 Notifications | Events for 5 types, read API, web + mobile surfaces | Transaction/availability events | Announcement delivery | 60% |
| 09 Administration | Queue, decisions, suspend listing, analytics | Reports UI, dashboard sections | User management, categories, announcements | 45% |
| 10 Reporting and audit | Report create/resolve, audit writes | Findings, action-after-report | Audit viewer | 60% |

## 3. MVP checklist roll-up

4 done · 16 partial · 4 missing — the full table with per-item evidence is `docs/MVP_SCOPE.md` §1.

## 4. Functional completeness by surface

| Surface | State |
|---|---|
| API | Runs; 30 routes; validation, authorization, audit on privileged paths. Missing the transaction, category-admin, user-admin, announcement, and audit-read surfaces. |
| Web | Browse, auth, store dashboard, inquiries, saved, review queue. No notifications page, no transaction UI, no admin sub-sections, no profile page. |
| Mobile | Browse, categories, listing detail, inquiries, saved, profile, auth. No home tab, no sell/offer, no notifications, no admin. |
| Infrastructure | Nginx, systemd, backup script present; no monitoring, no restore drill. |

## 5. Environment notes

- Workspace is a **bun** workspace (`apps/*`) but also contains a `package-lock.json` and a `bun.lock`; README says `npm install` while the
  root scripts call `bun`. Pick one before onboarding contributors (KI-025).
- `apps/api/.env` exists locally (git-ignored); `.env.example` documents only `DATABASE_URL` and `JWT_SECRET`, while `env.ts` also reads
  `PORT`, `CORS_ORIGINS`, `COOKIE_SECURE`, `UPLOAD_DIR`. Document them.
- **No git repository is initialized in this folder** (`.gitignore` exists but `.git` does not), so changes cannot be diffed or reverted.
  Initializing one is recommended before feature work.

## 6. What is next

`docs/MVP_SCOPE.md` §4 holds eight decisions the owner must make; §5 sequences the work. Nothing in Stages 2–9 should start before those
decisions are recorded in the blueprint.

**Notifications visual/interaction refinement (2026-11-12):** The unified web PWA notifications centre now has an accessible All/Unread filter, unread summary, Today/Yesterday/Earlier groups, distinct notification cards, direct Mark read controls, and graceful loading/error/empty feedback. This is UI polish on existing API contracts, not completion of still-missing MVP notification event types. Frontend production build and headless browser checks (320–1440px) passed; device/screen-reader acceptance remains outstanding. See `docs/UI_UX_GUIDELINES.md` §14.
