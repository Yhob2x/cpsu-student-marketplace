# MVP scope, gap analysis, and conflicts requiring approval

**Blueprint MVP:** MVP-001 … MVP-024 (`MASTER_BLUEPRINT.md` §5.2). **Assessment date:** 11 November 2026.
**Verdict: Version 1.0 is not complete.** 2 items are done, 12 are partial, 6 are missing outright, and 4 more are blocked by the six
scope conflicts in §4. Nothing in §4 has been reconciled — each one needs the project owner's decision first (RULE 04, PART XIII).

## 1. MVP checklist status

| ID | Feature | Status | What is actually there / what is missing |
|---|---|---|---|
| MVP-001 | Student registration | **Partial** | Email, password, display name, campus. Missing student ID, college, course, year level, email verification. |
| MVP-002 | Login and logout | **Done** | Argon2id, 15-min JWT, rotating refresh token, reuse detection, web cookies + mobile keychain. |
| MVP-003 | Student verification | **Partial** | Staff-verified campus affiliation with reason, audit, notification; gates selling. Missing email verification and the identity data needed to verify a real student. |
| MVP-004 | Student profile | **Partial** | Display name and campus status only. No student ID, college, course, year level, profile photo; only `displayName` is editable. |
| MVP-005 | Product listings | **Partial** | Create/edit/view, submit, approve. Missing delete, `condition`, real `sold` state. |
| MVP-006 | Service listings | **Partial** | Same table with `type=service`, rate + basis, service categories. Missing delete and service-specific availability. |
| MVP-007 | Listing image uploads | **Done** | Up to 6 JPEG/PNG/WebP ≤ 3 MB, ownership-checked, access-controlled serving. |
| MVP-008 | Marketplace categories | **Partial** | Read-only seeded catalog whose names differ from the blueprint's lists. No admin CRUD. |
| MVP-009 | Search and filtering | **Partial** | Keyword, category, campus, type, price range, pagination. Missing condition filter and both sorts. |
| MVP-010 | Recently added listings | **Done** | Home section from the newest feed. |
| MVP-011 | Popular listings | **Partial** | Most-saved top 8. No views or inquiry-activity signal. |
| MVP-012 | Favorites | **Partial** | Add/remove/list, idempotent. Missing own-listing block and availability-change display. |
| MVP-013 | Student messaging | **Partial** | Threads per listing, participants-only, 3 s polling, handoff note. Missing block-user, report-conversation, and a close action. |
| MVP-014 | Purchase requests | **Missing** | No request entity, no accept/reject. |
| MVP-015 | Transaction management | **Missing** | No transaction, no status log, no transition rules. Only a self-reported `Handoff`. |
| MVP-016 | In-app notifications | **Partial** | Backend table, endpoints, five event types, a web notification centre with unread badge and mark-all-read, and a mobile list in Profile. Missing transaction/availability/announcement events, because those features do not exist. |
| MVP-017 | Listing reports | **Done** | Reason ≥10 chars, admin list + resolve, audit. (No investigation notes.) |
| MVP-018 | User reports | **Partial** | API accepts a seller id, but neither client offers it; no account action follows a report. |
| MVP-019 | Admin dashboard | **Partial** | One `/admin` page: review queue + analytics. Missing Students, Transactions, Categories, Announcements, Audit Logs, Settings, Reports UI. |
| MVP-020 | User management | **Missing** | No student list/search, no suspend/reactivate. `User.status` is unreachable from the API. |
| MVP-021 | Listing moderation | **Partial** | Queue, approve/changes/reject with reason, suspend. Missing an all-listings browser and unpublish-with-restore. |
| MVP-022 | Category management | **Missing** | Seed-only. |
| MVP-023 | Basic marketplace analytics | **Partial** | Per-campus storefronts, published, services, pending, inquiries, <5 suppression. Missing registered/verified/active students, completed transactions, popular categories, monthly activity, report counts. |
| MVP-024 | Administrative audit logs | **Partial** | Rows are written for implemented actions. No read endpoint or viewer, so administrators cannot actually review them. |

**Score:** 4 done (MVP-002, MVP-007, MVP-010, MVP-017), 16 partial (001, 003, 004, 005, 006, 008, 009, 011, 012, 013,
016, 018, 019, 021, 023, 024), 4 missing (MVP-014, MVP-015, MVP-020, MVP-022) — 24 total.

## 2. Module-level gap summary

| Module | Coverage | Blocking gap |
|---|---|---|
| 01 Authentication | ~70% | Password recovery, email verification, profile fields, account status control |
| 02 Listings | ~65% | `condition`, delete, sold state |
| 03 Services | ~65% | Delete, portfolio differentiation |
| 04 Discovery | ~55% | Sort, condition filter, Recommended/Campus sections |
| 05 Favorites | ~70% | Own-listing block |
| 06 Messaging | ~70% | Block/report user, close thread |
| 07 Transactions | **0%** | Entire module |
| 08 Notifications | ~40% | No UI; missing events |
| 09 Administration | ~45% | User management, categories, announcements, audit viewer |
| 10 Reporting/audit | ~60% | Findings, action-after-report, audit viewer |

## 3. Non-MVP work already present (keep; do not extend)

Campus-scoped reviewer role, store profiles, listing review history with policy version, campus restriction table, analytics suppression,
typing indicator, mobile app. These are stricter or larger than the blueprint and are harmless for MVP, but new features must not grow them
without approval.

## 4. Conflicts requiring owner approval

| # | Conflict | Blueprint says | Code does | Impact if unresolved | Recommended resolution |
|---|---|---|---|---|---|
| **C1** | Role model | 2 roles: Student, Administrator | 4 roles: `campus_reviewer`, `university_admin`, `system_admin`, `establishment` | Admin UI, permission tests, and docs disagree about who may review | Keep the split; treat `campus_reviewer` + `university_admin` as two Administrator tiers and amend PART III |
| **C1a** | Administrator participation | Admin does not create listings or send messages | Roles are additive, so an administrator can also act as a student | Unclear whether staff may transact | Allow it (staff are students too) and audit; OR strip student abilities when an admin role exists. **Needs a decision either way** |
| **C2** | Stores | Listings belong to a student; no store entity | Every listing requires an approved `SellerProfile` ("My store") | Renaming or removing stores changes schema, URLs, and UI copy | Keep `SellerProfile` as the seller profile (one per user) and describe it in the blueprint as the seller's public profile |
| **C3** | Guest access | Access matrix lists only Student and Administrator; "public guest transactions" excluded | Anyone can browse published listings anonymously | Determines whether discovery is open (SEO, sharing) or login-walled | Keep anonymous read-only browsing; add a Visitor row to the matrix. Transactions stay student-only |
| **C4** | Availability and condition | `availability` ∈ {available, reserved, sold}, plus `condition` ∈ {new, like new, good, fair} | `availability` is free text and ignored by discovery; no `condition` | Sold items can look available; no condition filter | Add both as enums in one additive migration; keep moderation `status` separate |
| **C5** | Transactions | MODULE 07 is **Critical**: `transactions` + `transaction_status_logs`, six statuses | Nothing; only `Handoff` | The largest MVP gap and the one most likely to be built wrong without a decision on the state machine | Approve the status machine, who may set each transition, and whether `Handoff` becomes a detail of a transaction or is retired |
| **C6** | PWA | Platform is "Responsive Web Application / PWA" | Responsive SPA; no manifest, no service worker | Installability promised but absent | Approve a light PWA (manifest + icon + offline shell; never cache API responses) and confirm it with CPSU IT |
| **C7** | Category catalog | Fixed product and service category lists | Different seed names (Handmade goods, Pre-loved items, Food & drinks, Printing & supplies, …) | Listings already reference the current rows; a rename is a data migration | Approve the blueprint's category names and map existing rows to them in one migration |

## 5. Recommended sequence (needs approval before coding)

Work packages are ordered so each one is independently shippable and testable. No package starts until §4 decisions are recorded.

| WP | Scope | MVP IDs | Risk | Why this order |
|---|---|---|---|---|
| **WP1** | Approve and record §4 decisions; amend the blueprint | — | none | Removes ambiguity for everything below |
| **WP2** | Listing completeness: `condition`, availability enum, sold action, delete (soft), sort + condition filter, own-listing favorite block | 005, 006, 012, 009 | Low — additive migration | Small, high user-visible value; unblocks "sold" correctness |
| **WP3** | Transactions: `transactions`, `transaction_status_logs`, purchase request → accept/reject → negotiate → for-meetup → completed/cancelled, participant-only transitions | 014, 015 | **High** — new schema + state machine | Blueprint treats it as Critical; everything else about "completed" depends on it |
| **WP4** | Notifications UI (web + mobile) and missing events from WP3 | 016 | Low — endpoints exist | Cheap, closes a Done-in-backend/not-in-UI gap |
| **WP5** | Admin completion: student list + suspend/reactivate, category CRUD, audit-log viewer, reports UI with findings | 019, 020, 022, 024, 018 | Medium — new privileged surface, each needs audit | Security-sensitive; do after the transaction model is stable |
| **WP6** | Announcements (table, routes, admin UI, home banner) | 008/019 adjacent | Low | Listed in MODULE 09 and referenced by MODULE 08 |
| **WP7** | Profile fields: student ID (private), college, course, year level, photo; colleges table; password recovery | 001, 003, 004 | Medium — PII, retention rules, privacy review | Needs DPO sign-off on what is collected |
| **WP8** | Analytics completion: registered/verified/active students, categories, monthly activity, reports | 023 | Low | Only after WP3 so "completed transactions" is real |
| **WP9** | PWA + test suite (integration/authorization/DB per PART X) | — | Low | Do not launch without the PART X tests |

## 6. Out of scope — do not build

Payments, wallet, escrow, delivery/courier, commission, subscriptions, ads, external vendor registration, guest transactions, AI chatbot,
advanced recommendations, loyalty points, auctions, live streaming, crypto. Also deferred by the pilot's own architecture: ratings/reviews,
real-time chat transport, push/email delivery, establishment directory, native admin app, microservices.

## 7. Definition of Version 1.0 complete

All 24 rows in §1 read **Done**, PART X tests exist and pass for authentication, listings, messaging, transactions, and administration,
analytics reflect real rows, audit logs are viewable by administrators, and the app is usable on a phone and a desktop browser. A finished
UI alone (RULE 09) does not count.
