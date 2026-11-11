# Development log

Chronological record of work performed in this repository. Newest first. Each entry states what was inspected, what changed, what was
verified, and what remains.

## 2026-11-11 — Agent rules adopted (AGENTS.md)

**Change:** added `AGENTS.md` verbatim (sections 1–12 plus the final rule); `README.md` now names both instruction files and their roles.
**Cross-check against `CLAUDE.md`** (required by both documents): no contradictory requirement found. The excluded-feature lists match
(no payments, wallets, escrow, delivery, commission, subscriptions, external vendors, ads, auctions, loyalty, chatbots, advanced
recommendations). Both require server-side authorization, input validation, migrations over ad-hoc schema edits, and a completion report.
`CLAUDE.md` adds the document-authority order and the seven-step procedure; `AGENTS.md` adds the per-task reading requirement and
multi-agent safety rules. Where they overlap, they agree.
**Not changed:** no application source, schema, migration, or dependency.
**Still open:** the eight conflicts in `docs/MVP_SCOPE.md` §4, and the missing git repository (KI-025), which makes the diff-inspection
in AGENTS.md §10 impossible to perform reliably.

## 2026-11-11 — Governance instructions adopted; UI/UX update completed

**Change:** added `CLAUDE.md` (the supplied project governance instructions, reproduced verbatim) and a README pointer to it.
**Verified:** every document §1 requires exists and is non-empty — `MASTER_BLUEPRINT.md`, `docs/MVP_SCOPE.md`,
`docs/FUNCTIONAL_REQUIREMENTS.md`, `docs/BUSINESS_RULES.md`, `docs/DATABASE_DESIGN.md`, `progress/IMPLEMENTATION_STATUS.md`.
**Not changed:** no application source, schema, migration, or dependency.

**Open items that this governance does not resolve** (they need the owner, per §10 and blueprint PART XIII): the eight conflicts in
`docs/MVP_SCOPE.md` §4 — role model (C1), administrator participation (C1a), stores (C2), guest browsing (C3), availability/condition (C4),
transactions (C5), PWA (C6), category catalog (C7). Until these are decided, transaction work (WP3) cannot start without inventing a state
machine, which §3 and RULE 04 forbid.

**Multi-agent note (§9):** four application files carry mtimes of 08:26–08:27 on 11 Nov, before this session's first write, and the folder
has no git repository — so another agent or session may have edited `apps/api/src/routes/public.ts`, `apps/web/src/main.tsx`,
`apps/web/src/pages-public.tsx` and `apps/web/src/styles.css`. Their current content was inspected and is consistent with this
repository's documented state, but their authorship and diff cannot be verified without version control.

## 2026-11-11 — UI/UX update (web + mobile)

- Web: five-destination primary navigation (Home, Explore, Sell, Messages, Profile), new `/profile` and `/notifications` pages, header
  unread badge, design-system additions.
- Mobile: Home tab, category chips folded into Explore, notifications and Saved under Profile.
- Fixed KI-029 (session revocation on hard reload) with a single-flight refresh and user-scoped loaders.
- Verified: API tests 5/5, API/web/mobile typechecks clean, web build succeeded, and Home, `/profile`, `/notifications` viewed in the
  preview against the live API. Mobile typechecked only, never launched.

## 2026-11-11 — Baseline inspection and documentation foundation

**Request:** adopt the approved `MASTER_BLUEPRINT.md` v1.0 as the governing specification for this repository.

**Step 1 — Project inspection (PART XI)**
- Confirmed there is no git repository in the folder; `.gitignore`, `README.md`, `bun.lock`, `package-lock.json`, `node_modules` are present.
- Read every API source file (`app.ts`, `auth.ts`, `permissions.ts`, `rules.ts`, `http.ts`, `audit.ts`, `db.ts`, `env.ts`, `index.ts`, all six
  routers), the Prisma schema and both migrations, the seed script, and the only test file.
- Read the whole web client (`main.tsx`, `api.ts`, `pages-public.tsx`, `pages-account.tsx`, `pages-admin.tsx`, `styles.css`) and the whole
  mobile client (`App.tsx`, `api.ts`, `theme.ts`).
- Read the four existing pilot documents and the README.
- Grepped for `DELETE` routes, `announcement`, `orderBy`, and `notifications` in the web client to confirm which features do not exist rather
  than assuming.

**Step 2 — Requirements mapping**
- Mapped MODULE 01–10 to the code and recorded each requirement as Implemented / Partial / Missing in `docs/FUNCTIONAL_REQUIREMENTS.md`.
- Mapped all 24 MVP items (4 done, 16 partial, 4 missing) in `docs/MVP_SCOPE.md` §1.
- Identified eight conflicts between the blueprint and the pilot (roles, administrator participation, stores, guest access, availability and
  condition, transactions, PWA, category catalog) in `docs/MVP_SCOPE.md` §4.

**Step 3 — Documentation (no code changes)**
- Added `MASTER_BLUEPRINT.md` verbatim as the repo's single source of truth.
- Added the thirteen documents PART XII requires plus three progress files.
- Kept the pilot's four design documents intact and cross-referenced them instead of rewriting them (RULE 05).

**Step 4 — Verification**
- `cd apps/api && bun test` → 5 pass, 0 fail.
- `bunx tsc -p apps/api/tsconfig.json --noEmit` → no errors.
- `bunx tsc -p apps/web/tsconfig.json --noEmit` → no errors.
- `cd apps/api && bunx prisma migrate status` → schema up to date; MySQL reachable.
- Mobile typecheck skipped: dependencies not installed.
- No server started, no page viewed, no database row written.

**Not done, deliberately**
- No schema, route, component, dependency, or configuration change. Every blueprint/pilot conflict is recorded for approval instead of being
  silently resolved (RULE 04, PART XIII).

**Next action:** owner decisions on C1–C7, then WP2 (listing completeness) or WP3 (transactions) per `docs/DEVELOPMENT_ROADMAP.md`.

## 2026-11-10 — Pilot implementation

Reconstructed from migration folder names (`20261110063101_init`, `20261110090354_message_status`), file timestamps, and the code itself; no
log was kept at the time, so this entry describes the resulting state rather than the session.

- Built the Express/Prisma/MySQL API with Argon2id auth, rotating refresh sessions, campus affiliations, seller stores, product and service
  listings, image uploads, submit-for-review, campus-scoped human review with policy versions, inquiry threads, handoff records, reports,
  in-app notifications, audit writes, and suppressed small-count analytics.
- Built the React/Vite web client and the Expo mobile client against the same API.
- Added the pilot design docs, Nginx config, systemd unit, and database+media backup script.
- Added five authorization unit tests.

**Known at the time:** no transaction module, no password recovery, no admin user management, and test coverage limited to pure helpers.
Carried into `progress/KNOWN_ISSUES.md`.
