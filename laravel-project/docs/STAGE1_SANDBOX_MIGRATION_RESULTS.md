# Stage 1 database integrity — isolated candidate verification

**Follow-up (2026-11-11):** A real local development-data SQL backup/restore rehearsal succeeded after the earlier synthetic fixture test. Restored 20 tables / 402 rows with matching per-table SHA-256 content digests, applied all 19 proposed FKs plus the discovery index, reverified unchanged content, and removed the temporary SQL dump and restored schema. Full results: `docs/STAGE1_RESTORE_DRILL_REPORT.md`. This does **not** authorize deployment.

**Date:** November 11, 2026  
**Decision:** The project owner approved migration **preparation and isolated testing only**. This is **not deployment approval** for `cpsu_marketplace` or production.

## Candidate artifacts

- `apps/api/prisma/candidates/stage1-integrity/schema.prisma` — valid Prisma schema candidate. Source application `prisma/schema.prisma` is **unchanged**.
- `apps/api/prisma/candidates/stage1-integrity/candidate.sql` — candidate generated with `prisma migrate diff`: exactly 19 FK additions, one `Listing_discovery_idx`, no deletes or drops.
- `apps/api/scripts/prepare-integrity-candidate.ts` — reproducible candidate-schema generator.
- `apps/api/scripts/test-integrity-candidate.ts` — guarded disposable-MySQL rehearsal. It refuses to overwrite any preexisting sandbox schema, applies only the approved-shaped candidate statements, validates row counts, foreign keys, discovery index, invalid-reference rejection, and audit-record preservation; then drops only its own newly-created sandbox.

## Tested

1. Prisma 6.1 `validate --schema prisma/candidates/stage1-integrity/schema.prisma`: **valid**.
2. Prisma `migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datamodel prisma/candidates/stage1-integrity/schema.prisma`: **generated 20 additive statements**.
3. Temporary database `cpsu_marketplace_stage1_fk_candidate` created anew, baseline 2 migrations applied, 19 tables seeded with wholly synthetic fixtures.
4. Candidate SQL statements applied: **20/20**.
5. Row counts: **unchanged across all 19 tables**.
6. Foreign key test: **19 new constraints present**, bad reference rejected.
7. Composite index: `status, categoryId, campusId, createdAt` present in correct order.
8. Deletion of user referenced by historical audit row: **rejected as intended**.
9. Temporary candidate database was **dropped after the rehearsal**.

**Limitations:** This was a clean, synthetic fixture database, **not** a restored copy of existing development or production data. Backup/restore drill, real-data migration rehearsal, foreign-key delete semantics and deployment approval remain outstanding. The candidate intentionally uses `RESTRICT/CASCADE` for other references and `NO ACTION/NO ACTION` for the Category self-reference, which requires separate policy confirmation.

**Reproduce:** From `apps/api`, execute `bun scripts/prepare-integrity-candidate.ts`, Prisma validation and migrate diff (the exact commands above), then `bun scripts/test-integrity-candidate.ts --sandbox`.

**Deployment gate:** Do not copy this candidate into the active migrations directory or edit the canonical Prisma schema until owner approves exact schema/SQL and a verified backup/restore plan. WP2 remains separate and C4 is unresolved.
