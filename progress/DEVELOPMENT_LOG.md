# Development log

**2026-11-24 — Laravel + React migration, Phase 2:** Ported the database layer, authentication, role rules and API security middleware to Laravel. On disposable MariaDB, the baseline schema matched all Prisma migrations, 15 Laravel tests passed, 38/38 auth scenarios matched Express, and 7/7 cross-backend checks passed. Browser sign-in, reload and sign-out passed through Laravel. Signed-out UI comparison is 30/30, and Playwright remains 187 of 192 with the same 5 existing failures. No `apps/api`, `apps/web` or `cpsu_marketplace` changes. See `docs/LARAVEL_MIGRATION_PHASE2_2026-11-24.md`.

**2026-11-23 — Laravel + React migration, Phase 1:** Owner-approved move to Laravel 12 with React TypeScript in `laravel-project/resources/`, on branch `feature/laravel-migration`. The frontend is served by Laravel, while `/api` still reaches Express through a temporary local-only bridge. Signed-out screenshots and DOM matched on 30/30 route and viewport combinations. Playwright passed 187 of 192, and the same 5 tests fail on the original build. No `apps/api`, `apps/web` or database changes. See `docs/LARAVEL_MIGRATION_PHASE1_2026-11-23.md`.

**2026-11-23 — API reference data cache:** Added a 30-second, per-process cache for active campuses, listing categories, published guidelines, and published announcements. Concurrent refreshes share one query. Successful catalog writes, guideline publication, and announcement publication or archival clear their affected entries. Focused cache tests passed 4/4, the full API suite passed 347 with 8 opt-in skips, and API TypeScript checks passed. Refreshed Graphify. No schema or data migration. See `docs/API_DOCUMENTATION.md`.

**2026-11-23 — PWA Web Push audit remediation:** Restored visible foreground notifications for Safari, kept category preferences compatible with the legacy schema, serialized the eight-device cap, and connected leased outbox delivery to a consent-checked, quota-reserved worker with per-device retries. Verified enrollment on both schemas and durable dispatch with a simulated relay on disposable MariaDB. The existing migration was applied only to that disposable instance. Production delivery remains gated pending approved staging and physical-device acceptance. See `docs/PWA_PUSH_AUDIT_2026-11-19.md`.

**2026-11-18 — Managed guidelines and announcements activated locally:** User-requested fix for the disabled Admin > Content editors. Guarded activation applied only `20261116220000_managed_student_content` and `20261116221000_pending_announcement_edits` after a private retained SQL/media backup and isolated restore rehearsal. Postchecks preserved all old application rows and homepage content; StudentIdentity remains unapplied. Both admin GET routes and three public endpoints returned HTTP 200; API focused tests 11/11 and web tests 77/77 passed, with API typecheck and web build green. No production deployment or published content changes. See `docs/MANAGED_CONTENT_DEV_ACTIVATION_2026-11-18.md`.

**2026-11-18 — Admin Content error recovery (no migration):** Reproduced Prisma P2021 in SELECT-only local checks for both managed guidelines and announcements admin endpoints. The targeted admin routes now return actionable HTTP 503 `managed_content_unavailable` rather than internal_error; the admin UI loads/retries each editor independently and disables unavailable write controls. Synthetic in-process HTTP probes confirmed 503 for both, 11 focused API tests and 77 web tests passed, API typecheck and web build passed. Existing pending migrations and unpublished homepage image were not changed. See `docs/ADMIN_CONTENT_ERROR_RECOVERY_2026-11-18.md`.

**2026-11-17 — PWA console cleanup:** Added the generic mobile web app meta tag alongside the Apple tag. Browser refresh probes now return `204` for absent or expired cookie sessions and clear stale cookies; the web client treats `204` as signed out without JSON parsing. Legacy mobile refresh errors remain `401`. The existing custom Install app button still calls the saved browser prompt on click; Chrome's deferred-banner notice is expected until that interaction. No schema change. See API documentation and regression tests.

**2026-11-17 — Security assessment remediation batch:** Upgraded Multer, fixed trusted-proxy and production binding policy, added per-account failed-login throttling, made refresh claims atomic, added local-media no-store headers, and encrypted/restricted future Linux backups. Guarded isolated MySQL suite, focused security tests, API typecheck and backup shell syntax passed. Staff MFA, email ownership, backup restore, retention and production network verification remain open. See `docs/SECURITY_ASSESSMENT_BATCH_2026-11-17.md`.

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

## 2026-11-16 — Package B1: Conversation ending / safety guard
Added participant-only, audited `POST /inquiries/:id/close` using the existing InquiryThread status; closed-thread messaging denied in both new inquiry and existing message routes. Added explicit `End chat` confirmation, safe messaging, compact short-iPhone controls and readable thread_closed error. No schema change or deployment; see `docs/CONVERSATION_SAFETY_B1_2026-11-16.md` and the B2 approval-gated design. Full integration/concurrency/iPhone acceptance remains pending.

### 2026-11-16 — Package B1 concurrency hardening
Both inquiry message entry paths and close now use Prisma/MySQL `Serializable` transactions to serialize status checks against closure; rejected messages do not create a notification. Added mocked-transaction regression checks for closed/missing threads. Full fresh API suite 69 pass, 4 opt-in skips; web suite 31 pass; TypeScript and Vite build pass; PWA validation pass. No DB migration or student-data writes. Real concurrent two-account database and iPhone acceptance remain release gates. See `docs/CONVERSATION_SAFETY_B1_2026-11-16.md`.

## 2026-11-17 — Package B2a report target security
Hardened the existing student `/reports` endpoint without schema change: exactly one positive target, strict request payload, 10–1000-character reason, approved/active public target checks, self-report prevention, and atomic report+audit creation. Unit tests 16 passed for the new helper/route guard; full API suite 85 passed / 4 integration skips, web suite 31 passed; TypeScript and Vite build passed. No data migration or external service deployed. See `docs/SECURITY_REPORT_TARGET_B2A_2026-11-17.md`. Password recovery, cross-listing blocking and private-message reports remain pending formal approvals.

## 2026-11-17 — Package B2a synthetic HTTP acceptance
Extracted a dependency-injectable report request handler, kept the production `/reports` endpoint wired to it, and added 10 Express/Supertest synthetic HTTP checks for happy paths, signed-out/staff denial, forged/invalid payloads, own/nonpublic targets, and modeled atomic audit failure. Targeted reporting checks 26 pass; full API 95 pass / 4 opt-in skipped; web 31 pass; API TypeScript, Vite production build and diff check pass. No MySQL or student writes; a dedicated isolated-DB integration test is still required for release. See `docs/SECURITY_REPORT_HTTP_B2A_2026-11-17.md`.

## 2026-11-17 — B2a.3 guarded MySQL report acceptance and media isolation
Added four real-MySQL integration cases with synthetic two-campus users, audits, cross-campus denial and SQL transaction rollback. Kept them sequential after the 36 Stage 1 cases inside the existing guarded local `cpsu_marketplace_test` runner. Identified and closed an inherited Google Drive configuration gap: test children are forced to `MEDIA_STORAGE=local`, Drive credentials are blanked, and test fixture guards refuse nonlocal media storage. The initial attempt stopped at 35/36 Stage 1 due to an external storage path; one synthetic Drive WebP may remain orphaned for operator review (no guessed or remote deletion). The final protected run passed 36/36 Stage 1 + 4/4 reporting, read-only integrity audit; ordinary API 97 pass/5 skipped; web 34 pass; typecheck, build, PWA and git diff check passed. No application database changes, migrations, commit or deployment. See `docs/SECURITY_REPORT_MYSQL_B2A_2026-11-17.md`.

## 2026-11-17 — B1.2 conversation closure real-MySQL acceptance
Added a guarded, separate real-MySQL inquiry-close integration suite and placed it sequentially after Stage 1 and public reporting in the local test-only runner. Fixed the exposed post-close typing/presence signal bug: both heartbeat routes now reject `409 thread_closed`; history responses mask stale cached activity even during close races. Verified participant-only, idempotent close with single audit, retained read access, both send entry points rejecting after close without notifications, and five concurrent send/close races. Final isolated MySQL: Stage 1 36, report 4, close 4 pass; read-only integrity audit passed. Ordinary API 103 pass/6 opt-in skips; web 42 pass; TypeScript, Vite build, PWA and git diff checks pass. Only synthetic records in the guarded `cpsu_marketplace_test` DB; no production or development migrations, live student data changes, commit or deployment. See `docs/CONVERSATION_SAFETY_B1_MYSQL_2026-11-17.md`.

## 2026-11-17 — B1.3 bounded conversation contention and physical Safari preflight
Read-only iPhone preflight remained NOT READY: Wi-Fi Public, Windows Firewall Domain/Private/Public disabled. No unsafe LAN server started and no real Safari device connected. Added guarded, sequential, isolated-MySQL bounded contention suite and preserved global 300/min rate limiting; final 4/4 stress cases passed (40 send/close races, 20 double closes, 10 replay waves, 301st request 429) after 36/36 Stage 1, 4/4 report and 4/4 B1.2 closure cases passed. Measured 120 accepted contested sends, 31 explicit transaction conflicts, zero post-close insert/notification, no duplicate closure audit, local race p95 15 ms (not a production benchmark). Ordinary API 104 pass / 7 optional skips; web 42 pass; API typecheck, web build, PWA, git diff all pass. Created owner-only physical iPhone runbook and DPO/owner blocking+private-reporting approval memo. No live student data, development/production migrations, application-network/firewall edits, commit, push or deployment. See `docs/CONVERSATION_STRESS_SAFARI_B2_GATE_2026-11-17.md`.

### B1.3 final Git-state qualification
After the B1.3 QA checks, a concurrent unrelated edit to `apps/web/src/mobile-refinements.css` introduced a blank line at EOF (line 712), so a later **whole-worktree** `git diff --check` exited 2. The **B1.3 package's tracked-file-only** diff check passed. No unrelated CSS was edited or reset by this package. All API/web/test/build/PWA checks above remained green.

## 2026-11-17 — iPhone LAN preflight firewall encoding regression
Verified Windows Firewall Domain, Private and Public now enabled. Found PowerShell `Get-NetFirewallProfile` JSON emits numeric `1` for enabled, while the preflight falsely required Boolean `true`. Corrected strict decoding and hardened missing/duplicate profile failure paths, including Wi-Fi. Four Node regression checks and JS syntax check pass. Re-ran read-only preflight: all firewall profiles pass; **Wi-Fi still Public**, exit 2. Read-only test-only iPhone QA inventory found 0 user/session/listing/transaction records and no QA ports 8445/4400/4173 listening. Physical Safari not tested. No Windows/network changes, test data, server start, migration, commit, push or deployment. See `docs/IPHONE_SAFARI_PREFLIGHT_FIREWALL_SERIALIZATION_2026-11-17.md`.

## 2026-11-17 — iPhone-only firewall-scope guard
User confirmed phone IPv4 192.168.0.224, PC Wi-Fi 192.168.0.133/24, host preflight initially passed. Read-only firewall audit discovered four enabled unrestricted Bun allow rules (TCP/UDP, Private/Public, Any remote address/port); development API listened 0.0.0.0:4000. No port-8445 allowance or QA listener. Hardened the read-only prestart safety script to fail on unrestricted Private-profile Bun inbound allowances; regression suite 5/5 and syntax pass. Current prestart exit 2 (one new safety blocker). Requested owner/admin review before disabling any existing rule or creating scoped TCP8445 Private 192.168.0.224-only allow. No OS rules, test data, services, production/dev DB, commit or deployment changed. See `docs/IPHONE_ONLY_FIREWALL_RULE_2026-11-17.md`.

## 2026-11-17 — Approved iPhone QA synthetic fixture attempt blocked safely by schema mismatch
Owner approved exactly two temporary buyer/seller student test identities and one synthetic listing in isolated `cpsu_marketplace_push_test`. Prepared guarded fixture script `apps/api/test/iphone-safari-qa-fixture.ts` with strict loopback/source/target checks, high-entropy private credentials outside repo, preservation of existing Cauayan campus id9, scoped future cleanup. First prepare was rolled back by Prisma P2022 because target SellerProfile lacks `avatarPath`; no identities/listings saved, credential file removed. Read-only investigation found six applied migrations but three pending repo migrations (managed content, pending announcement edits, seller avatars) and a further discrepancy: Prisma model declares `pendingAvatarPath` while the latest seller-avatar migration SQL only adds `avatarPath`. Added fail-closed schema guard before any fixture writes; rerun refused safely. Hardened `wp3-iphone-qa-readonly.ts` to identify pending migrations/missing columns; read-only check exit 2 with five blockers. TypeScript passes; dev/prod databases, migrations, live student data, firewall, QA listeners, commits and deployment untouched. Requires separate approval for *test-only* migration reconciliation and application. See `docs/IPHONE_SAFARI_QA_SCHEMA_APPROVAL_GATE_2026-11-17.md`.

## 2026-11-17 — Approved isolated iPhone QA migrations/fixtures PASS
User approved reconciling seller-avatar schema, backing up `cpsu_marketplace_push_test`, and applying three reviewed migrations **only** to isolated schema. Current schema and avatar SQL both required `avatarPath` only; no owner file edit needed. Created owner-only 31,971-byte SQL dump with checksum `7b20e8b56a6879619859422291c5f2dc0c7799f12803a0c64d80ca103d20ac74`. Migrated 24→26 tables / six→nine applied migrations, preserved existing Cauayan campus. Used previously approved fixture authorization to create exactly two synthetic students, one approved seller profile and one published QA textbook listing ID 9. Private random passwords stored outside repo with restricted Windows ACL, Argon2 verified without logging. Isolated read-only QA audit and in-memory HTTP smoke passed (200 browse/detail/campus, 401 guest inbox). Test-only QA API wrapper forces local TEMP media and clears inherited Google Drive credentials, with push delivery disabled. API typecheck passed. **No** dev/prod DB writes, QA listeners started, firewall changes, commits, pushes or deployments. Real iPhone Safari testing pending. See `docs/IPHONE_SAFARI_QA_MIGRATION_FIXTURES_PASS_2026-11-17.md`.

## 2026-11-17 — Physical iPhone Safari buyer message confirmed
Owner verified that synthetic buyer logged in, opened their profile, and sent a synthetic listing inquiry on physical iPhone Safari; message appeared in conversation. Independent read-only query against only `cpsu_marketplace_push_test` confirmed 1 active buyer login session, 1 buyer/listing inquiry thread, and 1 persisted inquiry message; content and credentials never read or logged. The local helper `apps/api/scripts/iphone-qa-message-readonly.ts` enforces source/target schema identity and performs no writes. Seller-side receipt/reply, real-time delivery, notification sound, PWA/keyboard/accessibility and cleanup still pending.

## 2026-11-17 — iPhone WP3 reservation acceptance discrepancy (read-only)
Owner reported request/acceptance visible on iPhone. Isolated QA verification on `cpsu_marketplace_push_test` found **0 Transaction**, **0 TransactionStatusLog**, synthetic listing ID 9 `availabilityState=available` and `reservationTransactionId=NULL`; messages and prior synthetic logins confirmed. Actual listing UI button is **Request item**, not the prior assistant's approximate label **Request to Buy**. Therefore purchase-request/acceptance/reservation cannot be marked backend PASS. No record writes performed; retest by tapping Request item as synthetic buyer, then seller decision and verify before proceeding to meetup. Updated guarded read-only QA helper to print transaction/availability metadata without message content.

## 2026-11-17 — Owner chose to skip remaining WP3 manual iPhone transaction checks
Owner requested closing the current transaction QA process and proceeding to the next stage. Record WP3 purchase request / acceptance / reservation as **DEFERRED — NOT BACKEND-VERIFIED**, NOT PASS: isolated `cpsu_marketplace_push_test` has zero Transaction and TransactionStatusLog rows and synthetic listing ID 9 remains `available` with no reservation transaction ID. Meetup, completion and cancellation scenarios not exercised. Messaging remains buyer/seller user-confirmed and database-verified (two persisted messages). Next independent manual QA: iPhone Safari PWA Add to Home Screen, standalone launch, navigation, responsive/keyboard, and safe background/foreground checks. No DB mutation or deployment approved by this change.

## 2026-11-17 — iPhone PWA keyboard/scrolling accepted (manual)
Owner confirmed CPSU Market launched from iPhone Home Screen and the floating message composer stays visible above the iOS keyboard while the conversation scrolls correctly. Record **PASS — user-confirmed on physical iPhone**, not automated cross-device verification. Continue to foreground unread-badge/incoming-sound acceptance. WP3 transaction work remains deferred, not passed.

## 2026-11-17 — StoreFollow migration isolated acceptance (PASS; no development migration)

Retained a private, checksum-verified 365,108-byte development SQL backup and 24 upload files. Restored and compared all 24 existing tables, applied **StoreFollow only to a disposable restored database**, verified composite uniqueness, foreign keys, secondary index, and synthetic follow/unfollow behavior. Source row hashes unchanged; disposable schema deleted; 0 errors. See `docs/STORE_FOLLOW_CATEGORIES_2026-11-17.md`. Development activation requires separate owner approval because two other migrations remain pending.

## 2026-11-17 — Store Follow development activation and public-store chat

Owner-approved development activation PASS: applied only StoreFollow; verified fresh private SQL+upload backup, unchanged old records and only two unrelated migrations remaining pending. Generated Prisma v6.1.0 in isolated directory to avoid a locked byte-identical Windows engine DLL; synchronized 11 generated metadata/type files, restarted API. Authenticated Follow HTTP tests and synthetic cleanup PASS. Added public-store Chat with seller inline composer using listing-scoped inquiries and existing inbox; authenticated synthetic messaging/notification test PASS and cleanup. Corrected strict safe-login return to include `/stores/:id`. Web 60/60 tests, API 5/5 Follow tests, typechecks and Vite build passed. Browser 320/390/1280 no page overflow; signed-in synthetic store chat form and login return verified. See `docs/STORE_FOLLOW_CATEGORIES_2026-11-17.md`. No deploy, commit or push.

## 2026-11-17 — Followed-store new-product notifications

Fixed missing fanout from first reviewer approval to active followers. Added transactional `store.new_listing` in-app notifications, safe direct listing link, seller/product/service feed text, bell-count refresh integration, and privacy-safe optional push through pre-existing account-and-store preferences. No alerts for drafts, rejected, edited/reapproved items, non-followers, suspended accounts, or unfollows. New synthetic HTTP acceptance passed with all QA rows deleted; Web 63/63, focused API/web 11/11, typechecks and build passed. Local push delivery remains gated off. See `docs/FOLLOWED_STORE_NEW_LISTING_NOTIFICATIONS_2026-11-17.md`. No new migration, deployment, commit or push.

## 2026-11-18 — Admin-editable editorial homepage

Owner requested admin editing for homepage text and images. Added shared shipped copy, additive `HomePageContent` singleton migration, global university-admin draft/save/publish API with audit and revision checks, three sanitized photo slots, public published-only delivery, and Admin > Content editor. The public homepage keeps shipped design defaults when no managed version is published or the table is not yet present. Isolated MySQL integration suite passed, including draft privacy, role restrictions, image upload and stale revision handling; web build and API typecheck passed. Migration applied only to `cpsu_marketplace_test`; development and production activation remain pending. See `docs/EDITORIAL_UI_REDESIGN_2026-11-18.md`.

## 2026-11-18 — Artistic hero layout restored

Reinstated the owner's reference composition in the homepage hero: three-line editorial headline, cream/green/mustard/rust abstract shapes, curved image frame, Explore and Start selling actions, reassurance cues, and overlapping search panel. Added a nonfigurative local SVG placeholder while retaining the admin-published hero image override and managed copy. Web build and 75 web tests passed; layout detector returned no findings. Browser screenshot capture was unavailable in this environment, so final visual/device inspection remains open. No database, API, deployment, commit or push change.

## 2026-11-18 — Local homepage content activation

Owner continued the build after the pending homepage migration blocked image uploads. Added a guarded, single-migration local activation script. Its first rehearsal safely refused a Windows MariaDB table-name case mismatch before development DDL; a read-only isolated-table check confirmed lowercase `homepagecontent`, and the validator was corrected. The successful second run retained a private checksum-verified SQL/upload backup, restored it to a disposable schema, rehearsed only `HomePageContent`, then applied only `20261118120000_managed_home_page_content` to local `cpsu_marketplace`. Existing application rows and the three unrelated pending migrations were verified unchanged; disposable restore removed. Local public homepage API returned HTTP 200 and anonymous admin endpoint HTTP 401. Production database, deployment, commit and push unchanged. See `docs/EDITORIAL_UI_REDESIGN_2026-11-18.md`.

## 2026-11-18 — Homepage hero polish

Replaced the automatic three-listing photo collage with the existing marketplace illustration as the default hero visual. Published administrator-selected hero images still render. Simplified hero decoration, moved search into the hero layout, and kept the existing search and Explore routes. Web tests passed 75/75 and Vite build passed. Desktop Chrome preview inspected; physical phone and true device-emulated viewport remain unverified. No database change or deployment. See `docs/EDITORIAL_UI_REDESIGN_2026-11-18.md`.

## 2026-11-18 — Name-based public store URLs

Added canonical `/store/<name-slug>` routes and API slug resolution for approved, active storefronts. Legacy `/stores/<id>` visits replace the browser address with the canonical route. Duplicate names receive an ID suffix; sign-in returns accept safe slug routes. No database change. Focused tests, API typecheck, web build, complete API unit suite and local slug endpoint passed. Complete web suite remains at 83 pass / 1 unrelated missing-module failure (`src/listing-quality.ts`). See `docs/STORE_NAME_URLS_2026-11-18.md`.

## 2026-11-18 — Duplicate store URL and follower count follow-up

Found two approved stores named Yobyob. Adjusted canonical slug assignment so store 1 uses `/store/yobyob` and store 2 uses `/store/yobyob--2`; the existing `/store/yobyob--1` link remains valid and redirects to the canonical address. Confirmed local API and Chrome show store 1's real public follower count of one. Follower identities remain owner-only under the approved privacy rule. No database change. See `docs/STORE_NAME_URLS_2026-11-18.md`.

## 2026-11-18 — Public followers and following on store pages

At the owner's request, public store pages now show both clickable counts and the existing two-tab connections dialog. Added a paged anonymous API read with approved/active store checks, active follower display names only, and followed approved/active stores only. The earlier owner-only visibility rule for connection lists is superseded by this explicit owner request; private account fields remain excluded. Existing follow writes and owner dashboard remain intact. Local Yobyob HTTP and Chrome checks confirmed one follower and one followed store. No database migration or data change. See `docs/STORE_CONNECTION_DIALOG_2026-11-18.md`.
## 2026-11-18 — Dashboard and storefront audit remediation

Added category retry, editor discard confirmation, listing refresh sequencing, foreground/event follower count refresh via count-only reads, current-affiliation public store visibility, `/stores` redirect to Explore, and storefront search/chat spacing. Owner kept the approved name URL behavior and chose immediate public hiding for expired/revoked seller affiliations. No migration or live data change. Focused API 18/18 and storefront component 8/8 passed; both TypeScript checks passed. Vite production build passed after a sandbox-approved local run; authenticated browser acceptance remains outstanding. The repository graph was updated. Persistent indexed slug performance remains open. See `docs/DASHBOARD_STORES_AUDIT_2026-11-18.md`.

## 2026-11-19 — Stage 6A Web Push outbox source preparation (owner-approved continuation)

Prepared additive outbox schema/migration (not applied), transactional notification producer hooks (compile-disabled), per-device attempt ledger, Manila-day five-notice budget, account master-off and optional quiet-hour fields, aggregate metrics schema, pure policy/retry logic and synthetic tests. Outbound push has a separate compile-disabled guard until a durable worker is implemented and verified; in-app notifications remain operational. Prisma validate passed; 22 new focused tests passed; full API 317 pass / 8 opt-in skips; full web 199 pass; TypeScript and web build passed. Read-only development migration status found both the separate pending student-identity migration and this pending outbox migration, so no blanket migration was attempted. No DB change, environment flags, real push delivery, commits or deployment. See `docs/PWA_PUSH_STAGE6_OUTBOX_PREPARATION_2026-11-19.md`.

## 2026-11-19 — Stage 6B dormant leased push worker and quota reservation

Owner requested continuation after Stage 6A. Implemented source-only bounded 90-second lease state machine (8 candidates/2 parallel jobs), compare-and-set Prisma-shaped claim/settle adapter, explicit expiry/attempt cleanup, and a Serializable recipient/day budget transaction with one-time per-notice marker and rollback on lost leases. Entry point, producers, and outbound delivery remain independently hard-disabled. Stage 6B 23/23 focused synthetic/query tests pass; combined Stage 6A/B 45/45; full API 347 pass / 8 opt-in skips; full web 200 pass; API/web TypeScript and production build pass. No new migration applied, no provider traffic, no external phones or staging deployment. Development still has separate pending student-identity and push outbox migrations. See `docs/PWA_PUSH_STAGE6B_LEASED_WORKER_2026-11-19.md`.

## 2026-11-23 — Photo-first marketplace listing cards

Updated the shared card on Home, Explore, Saved, and storefronts. A borderless 4:3 image sits above the title, seller, price, and listing details. Save and photo count stay on the image. Appreciation has its own 44 px target beside the heading. Explore loading placeholders match the new photo proportions. TypeScript and the production build passed. The focused Chrome suite passed 26 checks, including desktop and mobile axe scans. Responsive checks at 320, 390, 768 and 1280 px verified no card overflow with a long title, store rating, and large price. The full web unit run reported 205 passes and four failures in concurrent workspace changes covering the CSS font floor, retired store appreciation, and the Field count. No database changes.

Follow-up from the Explore screenshot removed a second stylesheet from the web entry page that was restoring borders, shadows, and fixed body spacing. Titles and seller details now use the full card width. Unbroken titles ellipsize on one line and longer phrases use at most two lines. Appreciation moved beside the price and metadata, and the Explore grid sits directly on the page. The browser regression checks the full accessible listing name and title width. The production build and responsive checks from 320 to 1280 px passed. No database changes.

The campus line now anchors to the bottom of the shared listing card so it aligns across each row, including listings with stock information or wrapping titles. The production build and 12 focused Chrome checks passed. Responsive checks confirmed alignment without overflow from 320 to 1280 px. No database changes.

## 2026-11-23 — Appreciation-aware Popular listings

Replaced saves-only homepage popularity with server-ranked, per-listing real appreciation (weight 3) plus save (weight 1), decayed by listing age (30-day half-life). SQL ranks the full eligible published listing set before LIMIT 8 with verified student seller/active campus visibility guards, independent aggregate counts, stable tie-breaking, and a saves-only fallback if the optional appreciation table is missing. The response includes a ranking-mode indicator without private engagement identities. After a confirmed like/unlike, the mounted homepage refreshes the rail; card appreciation counts remain hidden. Live local GET /api/v1/listings/popular returned ranking=appreciations_and_saves with five eligible listings. API 10/10 focused tests and API/web typecheck passed; web production build passed with existing Vite chunk warning. No DB migration, data deletion, Git push/merge or deployment. Real signed-in ranking-change acceptance remains pending. See docs/POPULAR_LISTINGS_APPRECIATION_RANKING_2026-11-23.md.

## 2026-11-23 — Per-listing thumbs-up count, view counter, and Popular re-ranking (supersedes saves ranking)

Added compact thumbs-up and eye totals on product cards/Explore/Home/storefront and on listing detail; saved-listing count not surfaced or used in ranking. Introduced per-listing aggregate view counter with same-browser/per-listing/UTC-day dedup (HMAC, short-lived scoped HttpOnly visitor cookie, two-day dedup cleanup, no raw IP/student ID saved), and owner/staff/nonpublic protection. Popular rankings now use `(4 * appreciations + log2(1 + views)) / (1 + ageHours / 720)`, never saves or store totals; missing view migration falls back to appreciation-only. Scoped migration `20261123190000_listing_views` applied only to local development after ACL-protected private backup, full 33-table row-count restore rehearsal, disposable migration tests, and verification; both tables start empty. Only unrelated private-identity and push-outbox migrations remain pending. Local API returned available view counters and `appreciations_and_views` mode. API focused 15/15, web unit 6/6, E2E desktop/mobile 10/10, axe accessibility desktop/mobile 18/18, Prisma validate, API/web TypeScript and web build pass (existing bundle warning). No remote deployment/push/merge; authenticated live acceptance and broader release checks pending. See `docs/LISTING_VIEWS_POPULAR_RANKING_2026-11-23.md`.
