# Development log

**2026-11-11 — WP2:** User approved C4 and local development migration plan. Found Stage 1/WP2 migrations and active API work already present when inspected; preserved existing uncommitted changes. Added web/mobile controls for item condition and availability, seller soft-delete, own-favorite restrictions, and condition filtering/pagination. Added three WP2 integration cases; 17/17 passed; five unit tests and typechecks/build passed. Current data audit: 21 available listings; 13 legacy products have unset conditions. Created a retained post-migration backup, not a pre-migration recovery point. See `docs/WP2_IMPLEMENTATION_REPORT.md`.

**2026-11-11 — Stage 1 restore rehearsal:** MariaDB logical dump of the local development database was successfully restored into a new disposable database (20 tables/402 rows; identical per-table content hashes). Candidate SQL applied there, preserving all rows; temp DB/dump cleaned. No active schema/migration changes; `docs/STAGE1_RESTORE_DRILL_REPORT.md`. Next: owner approval of FK delete semantics and predeployment backup, then WP2 C4 decision.

**2026-11-11 — Stage 1 approved isolation work:** Candidate Prisma schema validated; 19 FK additions plus a discovery index applied successfully on a fresh disposable synthetic-fixture DB; 19-table row counts unchanged and invalid FK/forbidden audit actor delete checks passed. Candidate sandbox deleted. Deployment/retention policy approvals remain open. See `docs/STAGE1_SANDBOX_MIGRATION_RESULTS.md`.

## 2026-11-11 — Stage 1 database integrity preflight (no schema change)

- Ran SELECT-only integrity scan against local development `cpsu_marketplace`. All 19 audited relationships lack FK declarations, with 0 orphan references at scan time; composite discovery index absent.
- Added guarded repeatable `bun run db:integrity-preflight` command and detailed migration approval dossier at `docs/STAGE1_DATABASE_INTEGRITY_APPROVAL.md`.
- Re-ran integration suite 14/14, unit suite 5/5, and API typecheck clean. No schema migrations applied or old migrations edited.
- **Awaiting approval:** FK deletion semantics, data retention, composite index, backup restore validation and controlled Prisma migration. WP2 still blocked by governance C4.

## 2026-11-11 — Stage 1 isolated integration foundation

- Added opt-in guarded test runner, isolated MySQL test fixtures, 14 HTTP/DB integration cases, and read-only schema integrity audit.
- Verification: 14 integration cases passed, 5 existing unit tests passed, API typecheck clean. See `docs/STAGE1_TESTING_REPORT.md`.
- Stage 1 outstanding: owner approval for the discovery index and missing foreign-key migrations. No application schema/route changes; no WP2 implementation.


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

### 2026-11-11 — UI UX Pro Max web refinement
- Completed blueprint-constrained web-only UI/UX improvements to listing card save feedback, focus visibility, form labels, font spacing, authentication form presentation, listing detail gallery, and desktop/mobile listing detail layout.
- Files modified in this pass: `apps/web/src/main.tsx`, `pages-public.tsx`, `pages-account.tsx`, `styles.css`; see `docs/HALLMARK_UI_UX_FIXES_2026-11-11.md` for rationale and QA.
- Production frontend build and automated headless browser layout/interaction checks passed at 320, 360, 390, 768, 1024, 1440 pixels. No data or backend change.
- Follow-up remains manual screen-reader, physical-device and authenticated end-to-end workflow QA.

### 2026-11-11 — Storefront-inspired light theme (UI UX Pro Max)

- Implemented an approved web-only single light theme: white surfaces, pale neutral listing/photo panels, and dark forest-green navigation, banners, actions, and footer. Removed Auto/Light/Dark control and system dark overrides. The UI reference inspired visual design only; no unapproved commercial e-commerce features were added.
- Existing files modified in this pass: apps/web/index.html; apps/web/src/main.tsx; apps/web/src/pages-public.tsx; apps/web/src/styles.css. New file: apps/web/src/storefront-theme.css.
- Kept all existing search, authentication, saved-listing, messaging, listing management and moderation logic. Fixed category rail initially showing the last categories after async load by removing a redundant final tile, while retaining the View all link.
- Production web build passed. Browser QA at 320, 360, 390, 768, 1024 and 1440 px under simulated dark OS preference found the page stays light with no dark toggle or horizontal overflow. Card price rows aligned and the heart retained a 44px touch target. Guest save still opened sign-in.
- Backend, database, credentials and native Expo app untouched. Screen-reader, real-device, and full authenticated workflow checks remain release QA items.

### 2026-11-12 — Messaging motion, grouping, and real receipts

- Used UI UX Pro Max guidance on reduced motion, motion restraint, and status feedback; inspected existing chat routes, Prisma schema, UI, and migration before editing.
- Implemented Sent/Delivered/Read receipt API using existing InquiryMessage.deliveredAt and seenAt fields: recipient GET marks delivery; authorized POST /inquiries/:id/seen with upToId marks visible incoming messages read, without marking future messages. Exposed receipt in conversation and inbox preview.
- Web: 240ms upward entry animation only for newly fetched messages; animated typing dots from the existing typing heartbeat; day dividers and compact per-group timestamps; forest-green sent bubbles/send action, white incoming bubbles, status under latest outgoing message. Reduced-motion CSS disables animation. No changes to payment, inquiry creation, or authorization rules.
- Modified apps/api/src/routes/inquiries.ts, apps/web/src/pages-account.tsx, apps/web/src/icons.tsx and apps/web/src/main.tsx; added apps/web/src/message-motion.css and guarded integration coverage in apps/api/test/integration/stage1.test.ts. Updated API and UI/UX documentation.
- No new database migration, production data changes or external dependencies. API unit tests and isolated integration suite pass (18/18, 112 assertions); browser verified 240ms/0ms reduced motion at 320,390,768,1440, no horizontal overflow. Native app unchanged. Manual physical-device and screen-reader QA remains.

### 2026-11-12 — Final conversation-alignment refinement

- Applied requested 4/18/20 chat rhythm: 4px within a message run, 18px between runs, 20px bubble radius, outgoing right/incoming left, and no repeated thread avatars/names. Reduced visual time clutter to one date divider per day and one visible latest-message timestamp; exact older stamps remain accessible.
- Outgoing bubbles and send action use the existing accent green (#10543A). White text against that background measures 8.93:1 contrast. Receipts are shown below the latest outgoing message and subtly animate on real server state changes, with reduced motion respected.
- Added ephemeral participant-only 25-second per-thread active-presence heartbeat to apps/api/src/routes/inquiries.ts and foreground-only heartbeat to apps/web/src/pages-account.tsx. Thread response reports otherActiveInChat. It does not infer global online status or persist tracking data.
- Updated apps/web/src/message-motion.css and guarded isolated integration assertions for presence authorization and receipt truthfulness. No migration, DB credential change, new external dependency, or native-app modification.
- Production web build and API TypeScript passed; isolated integration suite 18/18 with 117 assertions passed. Headless browser confirmed spacing, radius, left/right positions, single divider/stamp, presence and 240ms motion (0ms reduced motion) at 320, 390, 768 and 1440px. Manual real-device/screen-reader walkthrough still required.

### 2026-11-12 — Show conversation partner's name in Messages

- Explained the existing Online model: chat-scoped focused-tab heartbeat every 10s with 25s expiry, not login-wide presence or inbox activity.
- Added `otherStudentName` from authorized buyer/seller User.displayName relations to inquiry list and thread payloads in `apps/api/src/routes/inquiries.ts` without schema change.
- Updated `apps/web/src/pages-account.tsx`: person-first inbox cards (name, matching avatar initials, listing title, preview with optional `You:` prefix), and person name in chat header. Added compact inbox name/listing styles to `apps/web/src/message-motion.css`.
- Expanded isolated integration assertions for buyer/seller reciprocal names and email non-disclosure. Web build, API typecheck and isolated integration suite (18/18, 123 assertions) passed; headless 320/390/768/1440px inbox/thread checks passed with no horizontal overflow.
- Existing chat authorization, read receipts, typing and presence logic retained. No database migration, credentials, native-app, or production data changed. Manual screen-reader/physical-device QA remains.

### 2026-11-12 — Notifications page UI/UX enhancement (web PWA)

- Followed MASTER_BLUEPRINT.md Module 08, UI UX Pro Max guidance, and the existing CPSU white/forest-green theme. Used only existing GET /notifications, POST /notifications/read, POST /notifications/:id/read endpoints; preserved backend authorization and notification types.
- Reworked the Notifications component in apps/web/src/pages-profile.tsx and imported the new scoped apps/web/src/notifications.css from apps/web/src/main.tsx. Added grouped feed, unread summary, filters, contextual icons, per-row read actions, refresh, and differentiated loading/empty/error/success feedback.
- Confirmed TypeScript/Vite production build, Git diff whitespace check, headless Chrome at 320/360/390/768/1024/1440px, 44px targets, correct filter/read behavior, 503 retry without false empty state, link navigation and mark-read, unknown notification without a link, and empty state. Browser fixtures were mock-only, no production data mutated.
- No API, Prisma, migration, database credentials, PWA service worker, mobile-archive or external dependency changed. Manual screen-reader/physical-device checks remain open.

### 2026-11-16 — Managed student guidelines and announcements (local implementation)

- Added global-university-admin draft/publish controls for marketplace guidelines and draft/edit/publish/archive controls for announcements. Public endpoints return only published content; existing guideline copy remains the fallback before first publication. Publish requests reject stale drafts.
- Added two additive migrations, public Home and Guidelines rendering, admin Content section, audit actions, and isolated authorization/visibility tests. Web build, API typecheck and isolated integration suite passed; no development or production migration was applied.
- Development activation remains gated because the development database also has the separately test-only WP3 migration pending. Running a blanket migration command would apply WP3 without its database approval. Browser/device acceptance and announcement in-app notifications remain open. See `docs/MANAGED_STUDENT_CONTENT_2026-11-16.md`.
# 2026-11-16 — Reviewer account separation

The owner chose dedicated staff-only reviewer logins. Added global university administrator reviewer management (create, list, edit, suspend/reactivate and password reset), separate Staff UI, student-only server authorization and staff navigation. Existing mixed-role records are preserved; student actions are denied whenever a staff role is present. No schema migration or live account rewrite. See `docs/superpowers/specs/2026-11-16-reviewer-account-separation.md` and the matching plan.

## 2026-11-16 — Security and User-Flow Closure, Package A
Implemented login/register submission locks, guest Saved redirect with safe return, recoverable logout error feedback, and direct seller reporting from public store profiles. No schema, migration, firewall, credentials, deployment or student records changed. Fresh web tests 27/27; API unit 63 pass/4 opt-in skipped; web build, PWA check and guest Chrome Saved redirect smoke passed. Authenticated seller-report acceptance, real-device QA and institutional security/privacy gates remain open. See `docs/SECURITY_USER_FLOW_CLOSURE_A_2026-11-16.md`.
