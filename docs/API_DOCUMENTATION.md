# API documentation (as built)

Base path: **`/api/v1`** (only `GET /health` sits outside it). JSON in, JSON out; `204` means no body. Errors use
`{ "error": { "code": string, "message"?: string, "issues"?: ZodIssue[] } }`.
There is no OpenAPI document; this file is the contract of record and must change with the routers.

## 1. Conventions

| Topic | Behavior |
|---|---|
| Auth (web) | `Authorization: Bearer <15-min JWT>` held in memory. A rotating refresh token lives in an `httpOnly` cookie scoped to `/api/v1/auth`; a second cookie scoped to `/api/v1/media` lets `<img>` authenticate. |
| Auth (legacy native API contract, not an active client) | The API still recognizes `X-Client: mobile` for future compatibility; the archived Expo prototype used secure device storage. The unified web/PWA uses the cookie-based web contract above. |
| Authorization | Roles are loaded from MySQL per request. Out-of-scope records return `404`. |
| Validation | Zod at the boundary; failures return `400 validation_error` with `issues`. |
| Pagination | `page` (≥1, default 1), `pageSize` (1–50, default 20); list responses are `{ total, page, pageSize, items }`. |
| Rate limits | 300 req/min/IP globally; `/auth/*` 30 per 15 min when `NODE_ENV=production`. |
| CORS | Only the configured `CORS_ORIGINS` allowlist is accepted; credentials enabled. The unified web/PWA uses the same-origin `/api` proxy, so it does not require the former Expo web `:8081` allowance. |
| Media | `/media/:id` streams the file with `X-Content-Type-Options: nosniff`. |

## 2. Health

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | none | `{ ok: true }`. |

## 3. Authentication — `/auth`

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET | `/auth/registration-policy` | none | — | `{ studentIdentityRequired: boolean }`; `Cache-Control: no-store`. Default **false** pending CPSU privacy approval and database activation. |
| POST | `/auth/register` | none | `email`, `password` (10–128), `displayName` (2–80), `campusId`. If `studentIdentityRequired=true`, also `fullName` (2–120) and `studentIdNumber` (3–48, text). | Creates the user plus a **pending** affiliation. A private one-to-one StudentIdentity is created atomically **only when the approved collection switch is on and schema exists**. When disabled, sending identity fields returns `409 student_identity_registration_unavailable`; ordinary registration remains unchanged. `201` with `{ accessToken }` (+ `refreshToken` for mobile). Errors: `400 invalid_campus`, `409 email_taken`. No private identity data is returned. |
| POST | `/auth/login` | none | `email`, `password` | `401 invalid_credentials` for wrong password **and** for a suspended account. Sets cookies on web. |
| POST | `/auth/refresh` | refresh token (cookie or body) | — | Rotates a valid token. A browser with no valid cookie receives `204` and stale cookies are cleared; spent-token reuse still revokes every session for that user. Legacy mobile requests (`X-Client: mobile`) receive `401 no_session` when absent or `401 session_expired` when invalid. |
| POST | `/auth/logout` | optional | — | Revokes the presented refresh token, clears cookies, `204`. |

**Missing versus blueprint MODULE 01:** password recovery, email verification, session listing/revocation per device.

## 4. Public discovery

| Method | Path | Auth | Query / notes |
|---|---|---|---|
| GET | `/campuses` | none | Active campuses: `id`, `code`, `name`. |
| GET | `/categories` | none | `id`, `parentId`, `name`, `listingType`. Seeded only. |
| GET | `/listings` | none | `q` (≤80), `categoryId`, `campusId`, `type`, `sellerType`, `minPrice`, `maxPrice`, `sort` (`newest` default, `price_asc`, `price_desc`), `page`, `pageSize`. Published + approved store only. An unknown `sort` value is a `400 validation_error`. |
| GET | `/listings/popular` | none | Up to 8 published listings ordered by saved count (those with ≥1 save). |
| GET | `/listings/:id` | optional | Published listings are public. A draft is visible only to its owner or a reviewer in scope; anyone else gets `404`. Owners/reviewers also receive `status`. |
| GET | `/seller-profiles/:id` | none | Approved store only: name, description, type, campus, badge text, published listings. |
| GET | `/media/:id` | optional | Allowed when the listing is published, the caller owns it, or the caller reviews its campus. Otherwise `404`. |

`publicListing()` (`routes/public.ts`) whitelists response fields, so seller email/password material cannot leak through an include.

## 5. Account — authenticated

| Method | Path | Notes |
|---|---|---|
| GET | `/me` | Own id, email, display name, roles, affiliations (campus + status), `storeId`. |
| PATCH | `/me` | `displayName` only (2–80). |
| GET | `/notifications` | Last 50, newest first. |
| POST | `/notifications/read` | Marks all unread as read, `204`. |
| GET | `/saved` | Saved listings still published. |
| PUT | `/saved/:listingId` | Idempotent add. `404` if not published. **No own-listing check.** |
| DELETE | `/saved/:listingId` | Idempotent remove, `204`. |
| POST | `/reports` | Authenticated student only. Exactly one positive integer `listingId` **or** `sellerProfileId`, plus a trimmed `reason` (10–1000); no additional fields. Target must be a published, nondeleted listing with approved/active seller, or an approved/active seller profile. Cannot report own listing/store. Missing/nonpublic: `404`; self-report: `400`; malformed: `400`. Report and audit recorded atomically. Private conversation reports not enabled. |

## 6. Seller — `/seller` (authenticated)

| Method | Path | Notes |
|---|---|---|
| GET | `/seller/store` | Own store or `null`. |
| POST | `/seller/store` | `storeName` (2–80), `description` (10–1000). Requires verified affiliation; `403 affiliation_not_verified`, `409 store_exists`. Campus copied from the verified affiliation. |
| GET | `/seller/listings` | Own listings with media and category, newest edit first. |
| POST | `/seller/listings` | `type`, `categoryId`, `title` (3–120), `description` (10–3000), `price` (>0, ≤1,000,000), `priceBasis`, `availability`, `handoffNote?`. Requires an approved store; creates a `draft`. |
| PATCH | `/seller/listings/:id` | Partial body. `409 not_editable` for `pending_review`/`suspended`/`rejected`. A material edit to a published listing reverts it to `draft`. |
| POST | `/seller/listings/:id/media` | Authenticated owner only, checked **before writing upload bytes**. `multipart/form-data` field `image`; declared JPEG/PNG/WebP ≤ 3 MB, fully decoded format must match MIME, ≤ 24 MP, single frame. Re-encodes to WebP (up to 2400px, strips metadata). Max 5 photos (at least 1 required for review; drafts may have none). The browser supports selecting several images together and sends each sequentially to this single-image endpoint; it reports partial success instead of retrying already uploaded photos. Adding a photo to a published listing returns it to draft for renewed campus review. Errors: `400 invalid_image`, `409 too_many_images`/`not_editable`. |
| PATCH | `/seller/listings/:id/media/cover` | Authenticated student owner only. Strict JSON `{ "mediaId": positiveInteger }`; photo must belong to this editable, nondeleted, unreserved listing. Atomically makes the selected attached photo position 0, normalizes remaining positions, and writes an audit row. Existing approved photos may be reordered without adding unreviewed bytes; uploading new photos still returns a published listing to draft. Response `{ "coverMediaId": number }`. Missing/foreign listing or photo: `404`; locked listing: `409`. |
| POST | `/seller/listings/:id/submit` | Runs the rules engine; `422 category_prohibited` for a prohibited category, `422 incomplete_listing` for no image or bad price. Moves to `pending_review` and audits the flags. |

**Not present:** a per-photo deletion endpoint. Listing removal, availability updates, and thread closing are documented in their current sections.

## 7. Inquiries — `/inquiries` (authenticated)

| Method | Path | Notes |
|---|---|---|
| GET | `/inquiries` | Participant-only threads. Each row includes `otherStudentName` (the other participant's profile display name), listing title, viewer role, and last message with `mine` and `receipt` (`sent`, `delivered`, `read`). Only authorized participants can see the name; no email or credentials are included. |
| POST | `/inquiries` | `listingId`, `body` (1–1000). Published listings only; `400 own_listing` on your own listing. Creates or reuses the thread and notifies the seller. |
| GET | `/inquiries/:id/messages` | Participants only. Returns thread (including `thread.otherStudentName`), `listing` context (`id`, `title`, `type`, numeric `price`, `priceBasis`, `condition`, `availability`, `imageUrl`), messages with `mine`, author name, `receipt`, `seenAt`, handoff and `typing`. `imageUrl` is the first photo ordered by media position; it is `null` and `availability` becomes `unavailable` when the listing is no longer publicly visible. Only participants can fetch this response. On recipient retrieval, previously undelivered incoming messages receive `deliveredAt` (real delivery). Response also includes `otherActiveInChat` from a short-lived, participant-only heartbeat. |
| POST | `/inquiries/:id/messages` | `body` (1–1000). `409 thread_closed`; never inserts/alerts after close. Notifies the other party on successful send. |
| POST | `/inquiries/:id/close` | Buyer or seller participant only. Idempotent `204`; atomically marks closed + audits once. Rejects further messages via both entry paths and suppresses typing/presence signals. History remains readable; not a global block. |
| POST | `/inquiries/:id/typing` | Participant-only 5-second heartbeat; in-memory, per instance. Closed thread returns `409 thread_closed`; no new typing signal. |
| POST | `/inquiries/:id/seen` | Participants only. Body `{ upToId: positive integer }`. Recipient's client calls after the incoming message is visible and the page is active. Sets `seenAt` only on incoming messages in that thread with `id <= upToId`, and ensures `deliveredAt`; `204`, no body. Author cannot acknowledge own messages. Others get `404`. |
| POST | `/inquiries/:id/presence` | Participants only; 204 on open threads. Refreshes ephemeral 25-second presence in **this thread**, not global user status. Closed thread returns `409 thread_closed`. Conversation reads mask stale presence/typing after closure; no database migration. |
| PUT | `/inquiries/:id/handoff` | `method`, `timeWindow` (≤80), `generalLocation` (≤120), `status` (default `proposed`). Upserts one handoff per thread. Self-reported, **not** a transaction record. |

## 8. Administration — `/admin` (authenticated + review scope)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/review-queue` | Pending listings and pending affiliations inside the caller's campus scope. |
| POST | `/admin/listings/:id/decision` | `decision` (`approved`/`changes_requested`/`rejected`), `reason` (5–1000; ≥20 when flagged for academic integrity). For `approved`, the reviewer must send `photosReviewed: true`; zero-photo or unchecked approvals return `422 photo_review_required`. Other decisions need no attestation. `409 not_pending`. Writes `ListingReview` + policy version, audits reviewer/photo count and notifies. **Human review, not automatic NSFW detection.** |
| POST | `/admin/affiliations/:id/verify` | `decision` (`verified`/`rejected`), `reason` (3–500). Audits and notifies. |
| POST | `/admin/listings/:id/suspend` | `reason` (5–500). Sets `suspended`, audits, notifies. |
| GET | `/admin/reports` | Open/reviewing reports, oldest first, max 100. |
| POST | `/admin/reports/:id/resolve` | `status` (`resolved`/`dismissed`), assigns the caller, audits. |
| GET | `/admin/analytics/overview` | Per-campus: active storefronts, published listings, service listings, pending review, inquiries. Counts in 1–4 render as `<5`. Response carries the "not completed sales" note. |

**Not present:** student list/search, suspend/reactivate account, category CRUD, announcements, audit-log viewer, transaction monitoring,
report detail/findings, all-listings browser.

## 9. Error codes in use

`unauthenticated` (401), `forbidden` (403), `not_found` (404), `invalid_credentials` (401), `no_session` (401), `session_expired` (401),
`email_taken` (409), `invalid_campus` (400), `validation_error` (400), `not_editable` (409), `no_approved_store` (403),
`affiliation_not_verified` (403), `store_exists` (409), `invalid_image` (400), `too_many_images` (409), `photo_review_required` (422), `not_submittable` (409),
`category_prohibited` (422), `incomplete_listing` (422), `own_listing` (400), `not_pending` (409), `reason_too_short` (422),
`thread_closed` (409), `internal_error` (500). The active web/PWA maps these to plain-language messages in `apps/web/src/api.ts`; the retired native prototype is preserved under `legacy/expo-mobile/src/api.ts`.

## 10. Before exposing this API publicly

1. Publish an OpenAPI description generated from the Zod schemas, and keep it in CI.
2. Add contract tests per endpoint (none exist today).
3. Decide the public/guest browsing question (conflict **C3**) so §4 is intentional rather than incidental.

## Web Push — `/push` (new, authenticated, opt-in)

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/push/config` | — | `{ enabled, deliveryEnabled, publicKey }` (never the private key). Enrollment and outbound delivery have separate, default-OFF server switches; `deliveryEnabled=false` means no background pushes will be sent |
| GET | `/push/preferences` | — | `{ messages, listingReviews, accountUpdates }` for the signed-in user |
| PATCH | `/push/preferences` | Partial booleans of the above | Updated preferences; requires configured VAPID |
| POST | `/push/subscriptions` | Browser PushSubscription JSON: `endpoint, keys: { p256dh, auth }, expirationTime?` | `201 { ok: true }`. Only trusted HTTPS push-provider hosts; max eight devices per student |
| DELETE | `/push/subscriptions` | `{ endpoint }` | `204`. Only revokes the currently authenticated student's endpoint |
| GET | `/notifications/unread-count` | — | `{ total, messages }`; scoped to the authenticated user |

Web Push is **best-effort** and never blocks the existing in-app notification or the creation of a message/review. No recipient names, message contents, review reasons, or listing titles are sent in lock-screen payloads. The PWA service worker only opens approved same-origin app paths. All three `VAPID_*` variables, an approved additive migration, production HTTPS/cookie/CORS settings, and *explicit* `PUSH_SUBSCRIPTIONS_ENABLED=true` and `PUSH_DELIVERY_ENABLED=true` server flags are required for outbound delivery. Both flags default **false**; enrollment can be enabled alone without outbound delivery. In `NODE_ENV=test`, external delivery is always suppressed. Real push-provider delivery is not verified by synthetic integration tests.

For migration, key generation, private data handling and acceptance tests see `docs/PWA_PUSH_NOTIFICATIONS_2026-11-16.md`.


## WP3 — Transactions (approved 2026-11-16; local source and isolated TEST database only)

All participant endpoints require an authenticated **active, verified CPSU student** with **no administrator/establishment role**. They do not perform payments, deliveries or verified sale certification. Idempotent active requests and server-side checks prevent duplicate or unauthorized transitions. The root prefix is `/api/v1`.

| Method | Path | Body/query | Behavior |
|---|---|---|---|
| POST | `/transactions` | `{ listingId: number }` | Buyer requests published/available listing; creates thread and pending transaction, status 201; retry returns 200 with same active id. |
| GET | `/transactions?page=1&pageSize=20` | Bounded to 30/page | Participant's own requests/orders, paginated and newest-first. |
| GET | `/transactions/:id` | — | Buyer/seller only; status, original price, history and optional separate Handoff. Nonparticipant gets 404. |
| POST | `/transactions/:id/decision` | `{ action:'accept' }` or `{ action:'reject',reason:'10–500 chars' }` | Owning seller only; pending only; acceptance reserves available physical item atomically. |
| POST | `/transactions/:id/negotiating` | `{}` | Buyer or seller moves accepted → negotiating. |
| POST | `/transactions/:id/confirm-meetup` | `{}` | Buyer/seller independent acknowledgment. Both required to reach for_meetup. |
| POST | `/transactions/:id/confirm-completion` | `{}` | Both independently confirm after for_meetup; second advances to completed; physical item becomes sold. |
| POST | `/transactions/:id/cancel` | `{ reason:'10–500 chars' }` | Either participant before completed/cancelled; append history; release only own physical reservation. |
| GET | `/admin/transactions?page=1&pageSize=20` | Bounded to 30/page | Read-only, scoped to reviewer authorized campus; global university admin sees all. No chat history, payment details, passwords or student email addresses. |

Transaction notifications include `transaction.requested`, `transaction.accepted`, `transaction.rejected`, `transaction.negotiating`, `transaction.meetup_confirmed`, `transaction.completion_confirmed`, `transaction.cancelled`. Updates and audit logs are stored atomically with every transition. Clients should display conflict HTTP 409 when the item/state changes concurrently.

**Deployment reminder:** Development/production schemas have not received this migration, by explicit owner restriction. Earlier sections describing missing transactions are historical and superseded by this WP3 section for the local code state only.
# Student account directory pagination (2026-11-16)

`GET /admin/users` remains restricted to global university administrators and excludes staff and establishment roles. Optional query parameters: `q` (name/email, max 80 characters), `campusId`, `status` (`active` or `suspended`), `verification` (`unverified`, `pending`, `verified`, `rejected`, `suspended`), `page` (default 1), and `pageSize` (default 25, maximum 50). The response contains `{ items, total, page, pageSize }`. Affiliation filters apply to the same affiliation record. Results are ordered by descending user ID and never include password hashes.

## Campus reviewer accounts (local implementation)

Global university administrators only: `GET /admin/reviewers?q=&page=1&pageSize=25` lists campus reviewers separately from students. `POST /admin/reviewers` creates a staff-only account with `{ displayName, email, campusId, password }` and no student affiliation. `PATCH /admin/reviewers/:id` accepts one or more of `displayName`, `email`, `campusId`, `status` (`active` or `suspended`), or `password`, plus a required 10–500 character `reason`. Passwords must be 12–128 characters. Email uniqueness and active campus are checked on the server. Email, password, campus, or status changes revoke active refresh sessions. Every create/edit is audited without recording passwords. The endpoint cannot grant university or system administrator roles.

Staff roles cannot use student seller, inquiry, saved-listing, reporting, or transaction actions. Existing mixed accounts retain their history and affiliation records, but their staff role blocks student actions. Public browsing and moderation remain available.

## Managed student-facing content (local implementation)

Public: `GET /guidelines` returns `{ body, publishedAt }` with the existing text as fallback; `GET /announcements` returns `{ items }` containing the 10 newest published notices only. Global university administrators only: `GET|PUT /admin/content/guidelines`, `POST /admin/content/guidelines/publish`, `GET|POST /admin/content/announcements`, `PATCH /admin/content/announcements/:id`, and `POST /admin/content/announcements/:id/publish|archive`. Guidelines use `{ body }` for draft saves and `{ expectedBody }` for publishing. Announcements use `{ title, body }` for create/edit and `{ expectedTitle, expectedBody }` for publishing. Published announcement edits remain pending until publish. See `docs/MANAGED_STUDENT_CONTENT_2026-11-16.md` for local migration and release limits.

## Conversation ending (local Package B1)

`POST /inquiries/:id/close` requires an authenticated active student participant of the indicated thread. The positive numeric `id` is validated server-side, and nonparticipants receive `404 not_found`. An open thread is changed to `closed` in a database transaction with an audit record (`inquiry.closed`); repeated closes are idempotent and return HTTP 204. It does not delete messages, revoke transaction rights, block that student across other listings, or expose private message contents to administrators.

Both `POST /inquiries` (create/reuse thread) and `POST /inquiries/:id/messages` now return `409 thread_closed` for closed threads. The web UI renders an explicit confirmation before closing; the saved message history stays visible. Local source/unit/build checks have passed, but race-condition and real two-account DB/browser acceptance are **not yet complete**. No database migration is required: `InquiryStatus.closed` already exists. Dedicated user blocking and conversation reports remain design-only until CPSU policy/privacy approvals: `docs/superpowers/plans/2026-11-16-account-recovery-blocking-reporting-b2-design.md`.
