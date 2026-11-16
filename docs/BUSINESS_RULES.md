# Business rules — as enforced in code

Only rules with an actual enforcement point are marked **Enforced**. Everything else is a blueprint rule that still needs implementation
or institutional approval; those carry the module that owns them.

## 1. Identity and verification (MODULE 01)

| Rule | Status | Where |
|---|---|---|
| Registration requires a valid, active campus | Enforced | `routes/auth.ts` checks `campus.active`. |
| Email is unique and stored lowercase | Enforced | `User.email @unique`, Zod `.toLowerCase()`. |
| Passwords ≥ 10 characters, stored as Argon2id | Enforced | `hashPassword`, `argon2.argon2id`. |
| A suspended or nonexistent account cannot log in | Enforced | `login` filters `status === 'active'`; `authenticate` ignores non-active users. |
| Students cannot modify their own verification status | Enforced | No client-reachable field writes `Affiliation.verificationStatus`; only `POST /admin/affiliations/:id/verify`. |
| Unverified accounts cannot publish | Enforced | `POST /seller/store` and `submit` require a verified, unexpired affiliation. |
| Verification decisions are recorded with actor and reason | Enforced | `audit('affiliation.verified|rejected')` + notification. |
| A verified affiliation can expire | Enforced (data) | `expirationAt` is checked by `verifiedCampus`; no job sets it yet. |
| University email verification | Not implemented | No mail transport. |
| Verification method approved by CPSU | **Open decision** | `docs/architecture.md` §16; the seed writes `approvedBy = "PLACEHOLDER - pending CPSU approval"`. |

## 2. Listings (MODULES 02, 03)

| Rule | Status | Where |
|---|---|---|
| Only a verified student with an approved store can create a listing | Enforced | `POST /seller/listings` requires `sellerProfiles.approvalStatus = 'approved'`. |
| A listing belongs to its store's campus; the client cannot choose a campus | Enforced | `campusId` is copied from the store, never read from the body. |
| Sellers can modify only their own listings | Enforced | `ownListing()` filters by `seller.ownerUserId`; another seller's id yields `404`, not `403`. |
| A listing under review, rejected, or suspended is not editable | Enforced | `PATCH` returns `409 not_editable`. |
| Material edits (title, description, category, type, campus) to a published listing pull it back to draft | Enforced | `isMaterialChange` in `permissions.ts`. |
| A listing needs a price > 0 and at least one photo before review | Enforced | `submit` returns `422 incomplete_listing`. |
| A prohibited category on a campus cannot be submitted | Enforced | `restricted_prohibited` → `422 category_prohibited`. |
| A listing is publicly visible only when published and its store is approved | Enforced | `GET /listings`, `/listings/:id`, `/media/:id`. |
| At most 5 photos per listing (browser supports multi-select and sequential single-file uploads; partial failures retain successfully uploaded photos), input JPEG/PNG/WebP ≤ 3 MB, decoded-format validation, ≤ 24 MP, still-image normalization to metadata-free WebP | Enforced for new uploads | `routes/seller.ts`, `src/upload-security.ts`; no retroactive legacy-media processing. |
| A new photo on an already published listing cannot appear without fresh review | Enforced | Photo upload changes published → draft atomically with media creation. |
| A campus reviewer must explicitly confirm inspecting all photos before approval | Enforced as reviewer attestation, **not automatic content scanning** | `/admin/listings/:id/decision` requires `photosReviewed: true` for approval and audits the confirmation. |
| Food and other establishment-overlapping categories need human approval | Partial | Flagged for review (`rules.ts`); the decision is human. |
| Academic dishonesty is prohibited | Partial | Keyword flag + 20-character reason on approval; keyword list is not policy. |
| Products carry a condition (new / like new / good / fair) | Not implemented | No column. |
| Availability is available / reserved / sold, and sold items leave discovery | Partial | Free-text `availability`; discovery ignores it. |
| Commercial food selling requires explicit university approval | **Open decision** | Placeholder policy in `docs/campus-policy-rules.md`. |

## 3. Discovery (MODULE 04)

| Rule | Status | Where |
|---|---|---|
| Draft, pending, changes-requested, rejected, suspended listings never appear publicly | Enforced | `status: 'published'` in every public query. |
| Search and filters are validated and bounded | Enforced | Zod caps `q` at 80 chars, `pageSize` at 50. |
| Popularity comes from real data, never invented counts | Enforced | `orderBy savedListings._count`; no fake sales figures anywhere. |
| "Featured" is not an editorial claim | Enforced by labeling | Home shows newest listings under Featured; the code comments say so. |
| Suspended students' listings must not be publicly accessible | Not implemented | Account suspension doesn't exist yet. |

## 4. Favorites (MODULE 05)

| Rule | Status | Where |
|---|---|---|
| Authentication required; one row per student/listing | Enforced | `requireAuth`, unique index, `upsert`. |
| Cannot favorite your own listing | Not implemented | Missing owner check. |
| Only published listings can be saved | Enforced | `PUT` requires `status = 'published'`. |
| Saved list hides listings that left public view | Enforced | `GET /saved` filters `status:'published'`. |

## 5. Messaging (MODULE 06)

| Rule | Status | Where |
|---|---|---|
| Only authenticated users can message | Enforced | `requireAuth` on the inquiries router. |
| A conversation is tied to one listing and one buyer | Enforced | Unique `(listingId, buyerUserId)`. |
| Only participants can read or write a thread | Enforced | `participantThread()`; others get `404`. |
| Sellers cannot inquire on their own listing | Enforced | `400 own_listing`. |
| Only published listings can receive inquiries | Enforced | `POST /inquiries` filters `status:'published'`. |
| Closed threads reject new messages | Enforced (data) | `status = 'closed'` → `409`; nothing sets it. |
| Messages are bounded to 1000 characters | Enforced | Zod. |
| Block users / report a conversation | Not implemented | — |

## 6. Transactions (MODULE 07)

| Rule | Status | Where |
|---|---|---|
| No payments, wallet, escrow, commission, or courier dispatch | Enforced by absence | No such code or schema. UI states payment is arranged directly. |
| Purchase requests, accept/reject, status history, participant-only updates | Implemented locally (test DB only) | `routes/transactions.ts`, `Transaction`, `TransactionStatusLog`; 2-party meetup/completion, guarded inventory, role and affiliation checks, cancellation reasons. No development/production schema migration permitted yet. |
| Self-reported handoff outcome is not a verified sale | Enforced by language | Analytics note: "Inquiries are not completed sales"; outcome stored on `Handoff.status`. |

## 7. Moderation and administration (MODULES 09, 10)

| Rule | Status | Where |
|---|---|---|
| Review authority is campus-scoped | Enforced | `canReview`; out-of-scope records return `404`. |
| A system administrator cannot approve listings | Enforced | `canReview` ignores `system_admin`; unit-tested. |
| A listing decision requires a reason of ≥ 5 characters | Enforced | Zod on the decision endpoint (and 20 chars when flagged for academic integrity). |
| Only pending listings can be decided | Enforced | `409 not_pending`. |
| Every privileged action is audited | Partial | Verify, listing decisions, suspend, report resolution, submit. Missing where features are missing. |
| Analytics never expose an individual student | Enforced | Counts between 1 and 4 render as `<5`. |
| Administrators only access authorized operational data | Enforced | Campus scope on queue, decisions, analytics. |

## 8. Notifications

| Rule | Status | Where |
|---|---|---|
| Notify on verification result, listing decision/suspension, new inquiry/reply | Enforced | `notify()` calls in `admin.ts`, `inquiries.ts`. |
| In-app only in v1; no push/email dependency | Enforced by absence | No transport code. |
| Notification UI | Not implemented | — |
