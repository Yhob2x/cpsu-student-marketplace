# Stage 1 database integrity — migration approval dossier

**Backup/restore gate update (2026-11-11):** Verified a real development-data logical backup and isolated restore (20 tables / 402 rows); candidate SQL applied to restored data with unchanged records. See `docs/STAGE1_RESTORE_DRILL_REPORT.md`. Final FK deletion semantics, a durable predeployment backup, media restore drill, and deployment authorization are **still pending**.

**Isolated candidate update (2026-11-11):** User approved candidate preparation and isolated testing. Prisma-valid candidate + additive SQL (19 FK constraints, 1 discovery index) were successfully exercised in a temporary synthetic-fixture database; row counts preserved, bad FK rejected, audit actor protected. See `docs/STAGE1_SANDBOX_MIGRATION_RESULTS.md`. **No deployment approval.** Delete behavior, real-data restore drill, and active migration remain pending.

**Status:** PROPOSED / NOT APPROVED / NOT APPLIED  
**Audit date:** 2026-11-11  
**Authority:** `MASTER_BLUEPRINT.md` RULE 06 and PART VII/X/XI; `docs/DEVELOPMENT_ROADMAP.md` Stage 1  
**Connection audited:** local MySQL `127.0.0.1`, database `cpsu_marketplace` (development only).

## 1. Verified read-only preflight

Executed: `cd apps/api && bun scripts/integrity-preflight.ts --audit-only`.

- 19 selected child-column references examined against actual `information_schema.KEY_COLUMN_USAGE`.
- **19 missing foreign-key constraints** across those selected references.
- **0 orphaned references** across those checked relationships at the time of the audit. This does NOT certify all data, future writes, or production data.
- Listing indexes observed: `PRIMARY(id)`, `Listing_sellerProfileId_fkey(sellerProfileId)`, `Listing_campusId_fkey(campusId)`, `Listing_categoryId_fkey(categoryId)`.
- Proposed `(status, categoryId, campusId, createdAt)` discovery composite index is absent.
- No data values or student identifiers were printed; no database changes performed.

## 2. Proposed FK additions (all require owner decision on delete behavior)

The candidate below uses **RESTRICT on delete / CASCADE on update** for every relation as a conservative data-preservation default. This is a *proposal*, not approval to deploy. Several foreign keys could eventually need `SET NULL` or `CASCADE` for lawful account-deletion/retention workflows; decide with CPSU policy first.

| Child | Field | Parent | Risk / approval note |
|---|---|---|---|
| Session | userId | User.id | Account deletion and session cleanup policy |
| UserRole | campusId | Campus.id | Prevent orphan reviewer campus; do not change scope to global |
| ListingReview | listingId | Listing.id | Preserve historical listing review |
| ListingReview | reviewerId | User.id | Preserve actor traceability |
| ListingReview | policyVersionId | CampusPolicy.id | Nullable policy reference |
| Handoff | inquiryThreadId | InquiryThread.id | Preserve conversation-linked handoffs |
| SavedListing | userId | User.id | Account deletion policy |
| Report | reporterUserId | User.id | Privacy and reporting retention |
| Report | listingId | Listing.id | Nullable report target; maintain evidence |
| Report | sellerProfileId | SellerProfile.id | Nullable report target; maintain evidence |
| Report | assignedReviewerId | User.id | Nullable reviewer, preserve investigation history |
| Notification | userId | User.id | Account deletion/retention |
| InquiryThread | buyerUserId | User.id | Conversation privacy/retention |
| Category | parentId | Category.id | Nullable self-reference; category hierarchy |
| CampusPolicy | campusId | Campus.id | Campus policy continuity |
| RestrictedCategory | campusId | Campus.id | Policy enforcement integrity |
| RestrictedCategory | categoryId | Category.id | Policy enforcement integrity |
| SellerProfile | campusId | Campus.id | Store/campus alignment |
| AuditLog | actorUserId | User.id | Audit retention vs legitimate account erasure |

**Prisma requirement:** before running any FK migration, add corresponding `@relation(fields: ..., references: ...)` and reverse relation fields in `apps/api/prisma/schema.prisma`. For relationships with multiple edges between models (e.g. `Report` to `User`), use explicit relation names. Check for Prisma's automatically generated index names and use deliberate, stable `map` names. Do not edit either existing applied migration.

## 3. Proposed listing discovery index

Planned additive Prisma declaration under `Listing` (after approval):

```prisma
@@index([status, categoryId, campusId, createdAt], map: "Listing_discovery_idx")
```

Purpose: combined moderation-status, category, campus and recency queries. **Query-plan caveat:** default browsing omits category and campus, so this single index might not accelerate default newest-first feed. Assess `EXPLAIN` on realistic data and consider a separate `[status, createdAt]` index only if justified, without adding indexes speculatively.

## 4. Additive migration plan, NOT YET EXECUTED

1. Obtain owner approval for exact 19 FK targets, their `ON DELETE`/ `ON UPDATE` actions, and the composite discovery index. CPSU privacy/retention confirmation is necessary before choosing destructive cascades.
2. Re-run the read-only preflight immediately before migration. Block if any orphan appears; report orphans rather than deleting or overwriting.
3. Back up MySQL (schema + data), verify backup archive, and perform an actual restore drill in an isolated environment.
4. Produce new versioned Prisma migration with the schema changes, **not** `db push` or applied-migration editing. Run `prisma migrate diff` / `validate` and review generated SQL for unexpected table rebuilds, drops, or renames.
5. Apply the candidate to an isolated restored/staging database; verify data counts, existing tests, foreign keys and query plans.
6. After explicit deployment approval, apply to development during a controlled window, re-run all tests and the audit. Production deployment requires a separate approval.
7. Update `docs/DATABASE_DESIGN.md`, `docs/CHANGELOG.md`, `progress/DEVELOPMENT_LOG.md`, and `progress/IMPLEMENTATION_STATUS.md` with observed results.

## 5. Blocking conditions / approval request

- No existing application or production schema was modified by this preflight.
- Do **not** treat zero orphan references in today's development data as permission to add FKs.
- Governance conflicts C1/C1a/C2/C3/C4/C5/C6/C7 remain awaiting official decisions, particularly the eventual category catalog and account deletion policies.
- This dossier is a migration readiness artifact, **not** a migration script and not evidence of a tested rollback.

**Next gate:** explicit authorization of the FK/index changes, delete semantics, and a verified backup/restore strategy before applying migrations.
