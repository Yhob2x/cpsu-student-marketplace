# Implementation status

**As of:** 11 November 2026. **Baseline:** `MASTER_BLUEPRINT.md` v1.0.
**Change in this update:** UI/UX work — web five-destination navigation, Profile page, notification centre, mobile Home tab and Profile notifications, and a session-refresh fix found while verifying it — plus documentation. No API route, Prisma model, migration, or dependency changed.

## 1. Verification actually performed (11 Nov 2026)

| Check | Command | Result |
|---|---|---|
| API unit tests | `cd apps/api && bun test` | **5 passed, 0 failed** (11 assertions, ~6 ms) |
| API typecheck | `bunx tsc -p apps/api/tsconfig.json --noEmit` | **Clean** |
| Web typecheck | `bunx tsc -p apps/web/tsconfig.json --noEmit` | **Clean** |
| Web production build | `cd apps/web && bun run build` | **Succeeded** — 35 modules, 202 kB JS / 64 kB gzip, 6.98 kB CSS |
| Schema/migration state | `cd apps/api && bunx prisma migrate status` | **Up to date**, 2 migrations, MySQL `cpsu_marketplace` reachable at 127.0.0.1:3306 |
| Mobile typecheck | `cd apps/mobile && bunx tsc -p tsconfig.json --noEmit` | **Clean** — Expo dependencies resolve from the workspace root |
| Runtime UI | Preview tab against `http://localhost:5173` with the API on :4000 | **Viewed**: Home renders the five-destination nav; signed in as `seller@dev.test` the header shows Saved / Inquiries / My store and an **Alerts 6** badge; `/profile` renders identity, email, affiliation, quick links and the settings form; `/notifications` lists 6 unread items **after a hard reload**, the case that previously failed (KI-029). Mobile was typechecked only, never launched |

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
