# API documentation (as built)

Base path: **`/api/v1`** (only `GET /health` sits outside it). JSON in, JSON out; `204` means no body. Errors use
`{ "error": { "code": string, "message"?: string, "issues"?: ZodIssue[] } }`.
There is no OpenAPI document; this file is the contract of record and must change with the routers.

## 1. Conventions

| Topic | Behavior |
|---|---|
| Auth (web) | `Authorization: Bearer <15-min JWT>` held in memory. A rotating refresh token lives in an `httpOnly` cookie scoped to `/api/v1/auth`; a second cookie scoped to `/api/v1/media` lets `<img>` authenticate. |
| Auth (mobile) | Send `X-Client: mobile`; tokens come back in the JSON body, refresh token stored in the OS keychain/keystore. |
| Authorization | Roles are loaded from MySQL per request. Out-of-scope records return `404`. |
| Validation | Zod at the boundary; failures return `400 validation_error` with `issues`. |
| Pagination | `page` (≥1, default 1), `pageSize` (1–50, default 20); list responses are `{ total, page, pageSize, items }`. |
| Rate limits | 300 req/min/IP globally; `/auth/*` 30 per 15 min when `NODE_ENV=production`. |
| CORS | `CORS_ORIGINS` allowlist, credentials enabled. In development the Expo web origins (`:8081`) are added automatically; production uses the allowlist only. |
| Media | `/media/:id` streams the file with `X-Content-Type-Options: nosniff`. |

## 2. Health

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | none | `{ ok: true }`. |

## 3. Authentication — `/auth`

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/auth/register` | none | `email`, `password` (10–128), `displayName` (2–80), `campusId` | Creates the user plus a **pending** affiliation. `201` with `{ accessToken }` (+ `refreshToken` for mobile). Errors: `400 invalid_campus`, `409 email_taken`. |
| POST | `/auth/login` | none | `email`, `password` | `401 invalid_credentials` for wrong password **and** for a suspended account. Sets cookies on web. |
| POST | `/auth/refresh` | refresh token (cookie or body) | — | Rotates the token. Reuse of a spent token revokes every session for that user (`401 session_expired`). `401 no_session` when absent. |
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
| POST | `/reports` | `reason` (10–1000) + at least one of `listingId`, `sellerProfileId`. Audited. |

## 6. Seller — `/seller` (authenticated)

| Method | Path | Notes |
|---|---|---|
| GET | `/seller/store` | Own store or `null`. |
| POST | `/seller/store` | `storeName` (2–80), `description` (10–1000). Requires verified affiliation; `403 affiliation_not_verified`, `409 store_exists`. Campus copied from the verified affiliation. |
| GET | `/seller/listings` | Own listings with media and category, newest edit first. |
| POST | `/seller/listings` | `type`, `categoryId`, `title` (3–120), `description` (10–3000), `price` (>0, ≤1,000,000), `priceBasis`, `availability`, `handoffNote?`. Requires an approved store; creates a `draft`. |
| PATCH | `/seller/listings/:id` | Partial body. `409 not_editable` for `pending_review`/`suspended`/`rejected`. A material edit to a published listing reverts it to `draft`. |
| POST | `/seller/listings/:id/media` | `multipart/form-data` field `image`. JPEG/PNG/WebP ≤ 3 MB, max 6. `400 invalid_image`, `409 too_many_images`. |
| POST | `/seller/listings/:id/submit` | Runs the rules engine; `422 category_prohibited` for a prohibited category, `422 incomplete_listing` for no image or bad price. Moves to `pending_review` and audits the flags. |

**Not present:** `DELETE /seller/listings/:id`, mark-as-sold, reorder/delete a photo, close a thread.

## 7. Inquiries — `/inquiries` (authenticated)

| Method | Path | Notes |
|---|---|---|
| GET | `/inquiries` | Threads where the caller is buyer or the store owner; last message + viewer role. |
| POST | `/inquiries` | `listingId`, `body` (1–1000). Published listings only; `400 own_listing` on your own listing. Creates or reuses the thread and notifies the seller. |
| GET | `/inquiries/:id/messages` | Participants only. Returns thread summary, messages with `mine`, author name, handoff, and `typing`. |
| POST | `/inquiries/:id/messages` | `body` (1–1000). `409 thread_closed`. Notifies the other party. |
| POST | `/inquiries/:id/typing` | 5-second heartbeat; in-memory, per instance. |
| PUT | `/inquiries/:id/handoff` | `method`, `timeWindow` (≤80), `generalLocation` (≤120), `status` (default `proposed`). Upserts one handoff per thread. Self-reported, **not** a transaction record. |

## 8. Administration — `/admin` (authenticated + review scope)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/review-queue` | Pending listings and pending affiliations inside the caller's campus scope. |
| POST | `/admin/listings/:id/decision` | `decision` (`approved`/`changes_requested`/`rejected`), `reason` (5–1000; ≥20 when flagged for academic integrity). `409 not_pending`. Writes `ListingReview` + policy version, audits, notifies. |
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
`affiliation_not_verified` (403), `store_exists` (409), `invalid_image` (400), `too_many_images` (409), `not_submittable` (409),
`category_prohibited` (422), `incomplete_listing` (422), `own_listing` (400), `not_pending` (409), `reason_too_short` (422),
`thread_closed` (409), `internal_error` (500). Clients map these to plain-language messages (`apps/web/src/api.ts`, `apps/mobile/src/api.ts`).

## 10. Before exposing this API publicly

1. Publish an OpenAPI description generated from the Zod schemas, and keep it in CI.
2. Add contract tests per endpoint (none exist today).
3. Decide the public/guest browsing question (conflict **C3**) so §4 is intentional rather than incidental.
