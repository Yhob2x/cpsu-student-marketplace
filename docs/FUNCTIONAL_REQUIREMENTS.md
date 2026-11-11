# Functional requirements — status by module

**Legend:** Implemented = works end to end and is permission-checked. Partial = some required functions exist. Missing = no implementation.
**Evidence** points at the file that owns the behavior. Requirement IDs come from `MASTER_BLUEPRINT.md` PART IV and PART V.

## MODULE 01 — Authentication and student verification

| Requirement | Status | Evidence / note |
|---|---|---|
| Student registration | Partial | `POST /auth/register` — email, password (10–128), display name, campus. No student ID, college, course, year level (`routes/auth.ts`). |
| Login / logout | Implemented | Argon2id verify, active-status check, refresh rotation, token-reuse revokes all sessions. |
| University email verification | Missing | No email delivery or verification token anywhere. |
| Student account verification | Partial | Staff verify a campus affiliation (`pending → verified/rejected`) with reason + audit row; verified status gates selling. Identity data collected is too thin to verify against. |
| Password recovery | Missing | No endpoint, no mail transport. |
| Account status management | Partial | `User.status` (`active`/`suspended`) is enforced at login and on every request, but **nothing can set it** — no suspend/reactivate endpoint. |
| Secure session management | Implemented | Hashed refresh tokens in `Session`, 15-min access JWT, revocation, per-IP rate limits. |
| Profile fields: student ID, full name, campus, college, course, year level, photo, verification status | Partial | Only display name + campus affiliation + derived status. No `student_profiles` table, no photo, no college/course/year. |

## MODULE 02 — Marketplace listings

| Requirement | Status | Evidence / note |
|---|---|---|
| Create / edit / view | Implemented | `POST/PATCH /seller/listings`, `GET /listings/:id`. Material edits pull a published listing back to draft (`permissions.ts isMaterialChange`). |
| Delete own listing | Missing | No `DELETE` route exists. |
| Set price | Implemented | `Decimal(10,2)`, `> 0`, `≤ 1,000,000`, `priceBasis` free text. |
| Set condition | Missing | No `condition` column; the guidance lives only in free-text description. |
| Set availability / mark sold | Partial | `availability` is a free `VarChar(191)` defaulting to `"available"`; no enum, no transitions, no "sold" action, and it does not affect discovery. |
| Upload multiple images | Implemented | 1 per request, max 6, JPEG/PNG/WebP ≤ 3 MB, ownership checked, served behind an access check (`routes/seller.ts`, `routes/public.ts /media/:id`). |
| Report listings | Implemented | `POST /reports` + admin queue. |
| Prohibited products blocked | Partial | Prohibited categories are rejected at submit; other prohibited content relies on human review. |
| Categories manageable by admin | Missing | Seed-only; no create/rename/deactivate endpoint. |

## MODULE 03 — Student services

| Requirement | Status | Evidence / note |
|---|---|---|
| Create / edit service | Implemented | Same `Listing` table, `type = 'service'`, category must be a service category, rate in `price` + `priceBasis`. |
| Delete service | Missing | Same missing `DELETE` route. |
| Portfolio images | Implemented (shared) | Uses the same 6-image upload; no separate portfolio concept. |
| Receive/manage service inquiries | Implemented | Same inquiry threads as products. |
| Academic-integrity screening | Partial | Keyword flags (`academic_integrity_concern`) plus a 20-character minimum reason if approved; keyword list is not policy. |

## MODULE 04 — Search and discovery

| Requirement | Status | Evidence / note |
|---|---|---|
| Keyword search | Implemented | `q` matches title/description (`contains`). |
| Category / campus / type / price filter | Implemented | `categoryId`, `campusId`, `type`, `sellerType`, `minPrice`, `maxPrice`, `page`, `pageSize` (≤50). |
| Condition filter | Missing | No condition column. |
| Sort by newest / price | Missing | Order is hard-coded `createdAt desc`. No `sort` parameter. |
| Recently added | Implemented | Home slices the newest feed (`pages-public.tsx`). |
| Popular listings | Partial | Most-saved, top 8 (`GET /listings/popular`). No views or inquiry-activity signal. |
| Homepage sections | Partial | Search, featured (= newest), categories, recently added, student services, popular. **Recommended** and **campus-based** sections absent. |
| Only active/available listings public; suspended sellers hidden | Partial | Published-only is enforced; suspended *students* do not hide their listings because account suspension is not implemented. |
| Banned product discovery rule | Implemented | Drafts/pending/changes-requested/rejected/suspended are never in public results. |

## MODULE 05 — Favorites ("Saved")

| Requirement | Status | Evidence / note |
|---|---|---|
| Add / remove / list | Implemented | `PUT/DELETE /saved/:listingId`, `GET /saved`; unique `(userId, listingId)` makes it idempotent. |
| Auth required | Implemented | `requireAuth` on the account router. |
| Cannot favorite own listing | Missing | No owner check in `PUT /saved/:listingId`. |
| Availability changes shown for saved items | Missing | List re-reads live listings; no change notification or badge. |
| Deleted/unavailable handled | Partial | Saved list filters to `status = 'published'`; rows are retained after a listing leaves public view. |

## MODULE 06 — Messaging

| Requirement | Status | Evidence / note |
|---|---|---|
| Create conversation, send/receive, history | Implemented | `InquiryThread` unique per `(listingId, buyerUserId)`; messages ordered; 3-second polling on web and mobile. |
| Related listing shown | Implemented | Thread payload includes `listingId`; list shows the title. |
| Product and service inquiries | Implemented | Same mechanism for both types. |
| Participants-only access | Implemented | Non-participants get `404` (`participantThread`). |
| Block users | Missing | No block table or check. |
| Report a conversation/user | Partial | Reports accept `listingId` or `sellerProfileId`; no thread-scoped report and no UI to report a person from chat. |
| Typing indicator | Implemented (bonus) | In-memory map, per-instance, resets on restart (`routes/inquiries.ts`). |
| Closed threads | Partial | `status` exists and blocks writes, but nothing can close a thread. |

## MODULE 07 — Transaction management

**Status: Missing.** The only artifact is `Handoff` (method, time window, general location, status
`proposed/agreed/completed/cancelled/not_confirmed`) attached 1:1 to an inquiry thread. There is no purchase-request entity, no
accept/reject, no `transactions` table, no `transaction_status_logs`, no transition validation, and no completion record. Notifications
for transaction events do not exist because the events do not.

This is the largest MVP gap and the highest-risk one to add, because it introduces new tables (see `docs/MVP_SCOPE.md` §4, conflict C5).

## MODULE 08 — Notifications

| Requirement | Status | Evidence / note |
|---|---|---|
| Storage + read API | Implemented | `Notification` table; `GET /notifications` (last 50), `POST /notifications/read`. |
| New message events | Implemented | `inquiry.new`, `inquiry.reply`. |
| Verification result | Implemented | `affiliation.decision`. |
| Listing decisions / suspension | Implemented | `listing.decision`, `listing.suspended`. |
| Purchase request / acceptance / status events | Missing | No transaction module. |
| Listing availability / favorite changes | Missing | No events emitted. |
| Announcements | Missing | No announcements module or table. |
| In-app notification UI | Missing | No notifications screen in web or mobile; endpoints are unused by both clients. |

## MODULE 09 — Administration and moderation

| Requirement | Status | Evidence / note |
|---|---|---|
| Admin dashboard (separate interface) | Partial | One `/admin` page in the same SPA; no separate shell. |
| Review queue (listings + affiliations) | Implemented | `GET /admin/review-queue`, scoped by campus. |
| Verify students | Implemented | `POST /admin/affiliations/:id/verify` with reason + audit + notification. |
| Suspend / reactivate accounts | Missing | No endpoint; `User.status` is unreachable. |
| View students | Missing | No student list/search. |
| Review reported listings | Partial | `GET /admin/reports`, `POST /admin/reports/:id/resolve`; **no UI** and no investigation-notes field. |
| Remove prohibited listings | Implemented | `POST /admin/listings/:id/suspend` with reason, audit, notification. |
| Manage categories | Missing | — |
| Manage / publish / archive announcements | Missing | No table, routes, or UI. |
| Monitor listings / transactions | Partial | Only the pending-review queue; no browsing all listings, no transaction monitoring. |
| Analytics | Partial | Per-campus storefronts, published, services, pending, inquiries; counts < 5 suppressed (`GET /admin/analytics/overview`). Missing students, completed transactions, popular categories, monthly activity, report counts. |
| Audit logs | Missing | Rows are written but there is no read endpoint or viewer. |

## MODULE 10 — Reporting and audit logs

| Requirement | Status | Evidence / note |
|---|---|---|
| Student reports a listing | Implemented | Web listing page + mobile listing screen; reason 10–1000 chars. |
| Student reports a user | Partial | API accepts `sellerProfileId`; no client surfaces it. |
| Report status lifecycle | Implemented | `open → resolved / dismissed`; `reviewing` exists in the enum but is never set. |
| Investigation findings | Missing | No field for findings; only a status flip. |
| Moderation action from a report | Missing | Resolving a report does not suspend the listing or account. |
| Audit records for required actions | Partial | Written for verify/reject, listing decisions, suspension, report resolution, listing submit, report create. **Missing** for account suspension/reactivation, category modification, configuration changes (features absent). |
| Audit viewer | Missing | No `GET /admin/audit-logs`. |

## Cross-cutting: access control matrix (blueprint §3.2)

Enforced correctly: browse/search, create/edit own listings, messaging, favorites, reporting, verification, moderation, analytics.
Enforced but unreachable because the action is unbuilt: delete own listings, suspend accounts, manage categories, view audit logs.
Not applicable yet: manage/monitor transactions.
