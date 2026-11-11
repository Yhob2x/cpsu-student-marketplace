# Database design

**Source of truth for the schema:** `apps/api/prisma/schema.prisma`.
**Migrations:** `apps/api/prisma/migrations/20261110063101_init` and `20261110090354_message_status` (adds `deliveredAt`, `seenAt`).
**Engine:** MySQL 8, `utf8mb4_unicode_ci`. All tables use an auto-increment integer surrogate key.

> No table, column, or relation has been added, renamed, or removed to match the blueprint. Structural reconciliation is conflict **C2/C5**
> in `docs/MVP_SCOPE.md` §4 and requires owner approval (RULE 06).

## 1. Tables as built (19)

### Campus
`id`, `code` (unique), `name`, `active`. Referenced by affiliation, store, listing, policy, restricted category.

### Category
`id`, `parentId` (nullable, **no self-relation defined**), `name`, `listingType` enum (`physical_product` | `service`),
`policyRiskLevel` int (0 = normal, >0 = sensitive). No unique constraint on `(name, listingType)`; the seed dedupes by name in code.

### User
`id`, `email` (unique), `displayName`, `passwordHash` (Argon2id), `status` enum (`active` | `suspended`).
Blueprint's `student_profiles` fields (student ID, college, course, year level, photo) are **absent**.

### Affiliation *(pilot-only; blueprint folds this into `user_campus_affiliations`)*
`id`, `userId`, `campusId`, `verificationStatus` enum (`unverified` | `pending` | `verified` | `rejected` | `suspended`),
`verifiedAt`, `expirationAt`, unique `(userId, campusId)`. FKs to `User`, `Campus`.

### UserRole *(pilot-only)*
`id`, `userId`, `role` enum (`campus_reviewer` | `university_admin` | `system_admin` | `establishment`), `campusId` nullable.
**No unique constraint** on `(userId, role, campusId)` and no FK declared for `campusId`.

### Session
`id`, `userId`, `refreshTokenHash` (unique, SHA-256 of the token), `device` (user-agent, truncated to 190), `expiresAt`, `revokedAt`,
`createdAt`. **No FK to `User` is declared**, and no index on `(userId, revokedAt)`.

### CampusPolicy *(pilot-only)*
`id`, `campusId`, `version`, `effectiveDate`, `approvedBy`, `documentRef`, unique `(campusId, version)`.
`approvedBy` currently holds the string `"PLACEHOLDER - pending CPSU approval"`.

### RestrictedCategory
`id`, `campusId`, `categoryId`, `policyAction` enum (`review` | `prohibit`), `policyVersionId` nullable FK to `CampusPolicy`,
unique `(campusId, categoryId)`.

### SellerProfile *(pilot-only; no blueprint equivalent)*
`id`, `ownerUserId`, `campusId`, `storeName`, `description` TEXT, `sellerType` enum (`student` | `establishment`),
`approvalStatus` enum (`pending` | `approved` | `rejected` | `suspended`), `createdAt`.
No unique constraint on `ownerUserId`, although the API allows one store per user.

### Listing
`id`, `sellerProfileId`, `campusId`, `categoryId`, `type` enum (`physical_product` | `service`), `title`, `description` TEXT,
`price` DECIMAL(10,2), `priceBasis`, `currency` (default `PHP`), `availability` **VarChar default `'available'`**,
`handoffNote` VarChar(200), `status` enum (`draft` | `pending_review` | `changes_requested` | `published` | `rejected` | `suspended`),
`flags` JSON, `createdAt`, `updatedAt`.
FKs to `SellerProfile`, `Campus`, `Category`. **No `condition` column. No soft-delete column. No composite discovery index.**

### ListingMedia (blueprint `listing_images`)
`id`, `listingId`, `mediaPath` (basename on disk), `mimeType`, `position`. FK to `Listing`. Max 6 enforced in the API, not the database.

### ListingReview
`id`, `listingId`, `reviewerId`, `decision` enum (`approved` | `changes_requested` | `rejected`), `reason` TEXT,
`policyVersionId` nullable, `createdAt`. **No FK relations are declared** on `listingId`, `reviewerId`, or `policyVersionId`.

### InquiryThread (blueprint `conversations`)
`id`, `listingId`, `buyerUserId`, `sellerProfileId`, `status` enum (`open` | `closed`), `createdAt`,
unique `(listingId, buyerUserId)`. FKs to `Listing`, `SellerProfile`. `buyerUserId` has **no FK to `User`**.

### InquiryMessage (blueprint `messages`)
`id`, `threadId`, `authorUserId`, `body` TEXT, `deliveredAt`, `seenAt`, `createdAt`. FKs to `InquiryThread`, `User`.
The two timestamp columns are written by no code path yet (reserved).

### Handoff
`id`, `inquiryThreadId` (unique), `method` enum (`campus_pickup` | `scheduled_meeting` | `seller_delivery` | `off_campus` |
`digital_delivery` | `appointment`), `timeWindow`, `generalLocation`, `status` enum (`proposed` | `agreed` | `completed` |
`cancelled` | `not_confirmed`), `createdAt`. **No FK declared.**

### SavedListing (blueprint `favorites`)
`id`, `userId`, `listingId`, `createdAt`, unique `(userId, listingId)`. FK to `Listing` only.

### Report
`id`, `reporterUserId`, `listingId` nullable, `sellerProfileId` nullable, `reason` TEXT,
`status` enum (`open` | `reviewing` | `resolved` | `dismissed`), `assignedReviewerId` nullable, `createdAt`.
No FK relations; no check that exactly one target is set (the API enforces "at least one").

### AuditLog (blueprint `admin_logs`)
`id`, `actorUserId` nullable, `action`, `targetType`, `targetId` nullable, `metadata` JSON, `createdAt`.
Append-only by convention; nothing prevents `UPDATE`/`DELETE` at the database level.

### Notification
`id`, `userId`, `type`, `payload` JSON, `readAt`, `createdAt`. No FK; no index on `(userId, readAt)`.

## 2. Blueprint entity coverage

| Blueprint table | As-built | Verdict |
|---|---|---|
| `users` | `User` | Present, missing profile fields |
| `student_profiles` | — | **Missing** |
| `campuses` | `Campus` | Present |
| `colleges` | — | **Missing** |
| `categories` | `Category` | Present, extra `listingType`/`policyRiskLevel`, no admin CRUD |
| `listings` | `Listing` | Present, missing `condition`, weak `availability` |
| `listing_images` | `ListingMedia` | Renamed, equivalent |
| `favorites` | `SavedListing` | Renamed, equivalent |
| `conversations` | `InquiryThread` | Renamed, about equivalent |
| `messages` | `InquiryMessage` | Renamed, equivalent |
| `transactions` | — | **Missing** |
| `transaction_status_logs` | — | **Missing** |
| `reviews` | — | **Missing** (blueprint: usable after completed transactions) |
| `reports` | `Report` | Present, no findings field |
| `notifications` | `Notification` | Present, no UI |
| `announcements` | — | **Missing** |
| `admin_logs` | `AuditLog` | Present, no read path |

Pilot-only tables with no blueprint counterpart: `Affiliation`, `UserRole`, `Session`, `CampusPolicy`, `RestrictedCategory`,
`SellerProfile`, `ListingReview`, `Handoff`.

## 3. Data standards check (blueprint §7.2)

| Standard | Status |
|---|---|
| Primary keys | Met (every table) |
| Foreign keys / referential integrity | **Partial** — `Session`, `UserRole.campusId`, `ListingReview`, `Handoff`, `SavedListing.userId`, `Report`, `Notification`, `InquiryThread.buyerUserId`, `Category.parentId` have no declared relations |
| Appropriate indexes | **Partial** — unique constraints only; no discovery or inbox index |
| Timestamps on important records | Met for listing, message, review, audit, notification, session; `Affiliation` lacks `createdAt`/`updatedAt` |
| Soft deletion | **Not implemented** — listings are status-based, everything else is hard rows |
| Transaction status history | **Not applicable yet** (no transactions) |
| No duplicate information | Mostly met; `SellerProfile.campusId` duplicates the owner's verified campus and can drift if an affiliation expires |
| Client **and** server validation | Client `required`/`minLength` plus Zod on the server; server is authoritative |
| Migrations for structural change | Met — two versioned migrations, `migrate status` clean |
| No plaintext passwords | Met — Argon2id |

## 4. Migration policy going forward

1. Every structural change is a new `prisma migrate dev --name <reason>` migration; never edit an applied migration.
2. Additive first (new nullable column or new table), then backfill in a script, then tighten constraints — so the pilot's data survives.
3. Renames are refused by RULE 06 unless the owner approves; prefer adding a column and migrating reads.
4. Document each change in `docs/CHANGELOG.md`, `progress/DEVELOPMENT_LOG.md`, and this file in the same commit.
