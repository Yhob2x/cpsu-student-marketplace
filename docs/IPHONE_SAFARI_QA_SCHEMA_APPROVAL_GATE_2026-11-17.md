# CPSU Market — Approved iPhone QA fixture attempt and schema-migration approval gate

**Date:** 2026-11-17
**Host:** DESKTOP-P5OAG7F
**Approved operation:** exactly two disposable synthetic buyer/seller accounts and one test listing **only** in `cpsu_marketplace_push_test`, private random passwords, reversible scoped cleanup.
**Outcome:** **Blocked safely; no synthetic identities or listing created.**

## Security and isolation checks
- Local HTTPS prestart **passed** with Windows Firewall all profiles enabled, Wi-Fi Private, previously broad Bun inbound rules disabled, signed TLS chain valid and new TCP 8445 Private rule constrained to remote iPhone `192.168.0.224`, local `192.168.0.133`.
- Existing iPhone QA listener ports 8445, 4400, 4173 were not listening; not started.
- Fixture script `apps/api/test/iphone-safari-qa-fixture.ts` requires `NODE_ENV=test`, an explicit fixture approval flag, **loopback** MySQL source identity `cpsu_marketplace`, and explicitly redirects only its own Prisma client to `cpsu_marketplace_push_test`. It does **not** import or reset the application database.
- Reused the existing Cauayan test-campus row (id 9) without changing it; the isolated QA schema already contained it. The first fixture attempt correctly failed closed because a campus existed; code was adapted to preserve and reuse precisely that preexisting campus.
- Passwords generated for QA would reside outside Git under the owner/SYSTEM/Administrators-only ACL of `%LOCALAPPDATA%\\CPSU-Marketplace\\iphone-lan-https`. **No password file currently exists**.

## Actual blocker discovered
- The repository Prisma model expects `SellerProfile.avatarPath` and `SellerProfile.pendingAvatarPath`.
- The isolated iPhone QA schema has **six** completed migrations (through `20261116193000_wp3_transactions`) and has **neither** avatar column.
- Pending repository migrations:
  1. `20261116220000_managed_student_content` (creates `GuidelineContent` and `Announcement`).
  2. `20261116221000_pending_announcement_edits` (adds pending announcement fields).
  3. `20261117123000_seller_avatar_review` (at inspection time the SQL adds `avatarPath` only).
- **Critical source/migration mismatch:** Current `schema.prisma` declares `pendingAvatarPath`, but the inspected migration SQL does not add it. Applying all migrations as-is would still not match the current Prisma client. Preserve unrelated in-progress migration edits; reconcile this with the owner before any migration.
- First `prepare` attempted a single Prisma transaction and received P2022 missing column on `SellerProfile`. The transaction rolled back. A read-only follow-up confirmed **0 users, 0 categories, 0 seller profiles, 0 listings, 0 conversations, 0 transactions**; the preexisting Cauayan campus remains; no credentials file.
- A subsequent fixture preparation was tested with a new **read-only schema compatibility gate** and aborted **before any credential write or transaction**, explicitly reporting both missing avatar columns.

## Read-only checks and verification
- Updated `apps/api/scripts/wp3-iphone-qa-readonly.ts` to warn about all three unapplied repo migrations, missing Prisma-required avatar columns, and the absence of approved test identities. Final read-only result **NOT READY (5 blockers), exit 2**.
- API TypeScript compilation **passed**; modified tracked QA script `git diff --check` **passed**.
- No application schema/data migrations, edits to production/development data, credential exposure, app listener startup, firewall changes, commit, push or deployment by this attempt.

## Explicit additional approval required BEFORE continuing
**Proposed narrow approval:** reconcile the current Prisma model and seller-avatar SQL migration, inspect/backup the preexisting isolated QA schema, then apply only the reviewed additive repository migrations in order **to `127.0.0.1:3306/cpsu_marketplace_push_test`**. Do not use the unscoped application DB URL. Never apply migrations to `cpsu_marketplace` (dev) or any remote/production DB under this approval. After migrations, verify table/column availability and data integrity before running `prepare` to create exactly two synthetic users and one synthetic listing. Test only locally; outbound Google Drive uploads and push delivery remain disabled. A separate authorized owner procedure is required to start the physical Safari session, transfer the *public* CA certificate and remove temporary credentials afterward.

Do **not** run `bunx prisma migrate deploy` against the ordinary application `.env` as a workaround. It may target the wrong database and, with the current SQL mismatch, it will not necessarily complete a compatible test schema.

**Status:** Owner-approved synthetic fixture preparation was attempted, but migration reconciliation/isolated migration execution needs **separate explicit authorization**.
