# WP2 Listing Management — Development implementation and verification

**Date:** 2026-11-11  
**Scope:** Stage 1 integrity migration plus Stage 2 WP2, local development only  
**Governance:** C4 approved by project owner, recorded in `MASTER_BLUEPRINT.md` PART XIII. Other conflicts remain open.

## State observed

- On entry to the active project code inspection, both Stage 1 and WP2 migration directories, active Prisma schema changes, and core WP2 API routes were already present as uncommitted work. Do not attribute these initial changes to this session or overwrite them.
- `bunx prisma migrate status` reported **4 applied migrations and database schema up to date** on local `cpsu_marketplace`. Both new migrations were applied before this verification; no extra migration was run during this session.
- Stage 1 integrity migration: 19 FK relations with restrictive deletion rules and Listing discovery index.
- WP2 migration: nullable `Listing.condition`, enum `Listing.availabilityState`, nullable `Listing.deletedAt`; legacy `availability` retained.
- Read-only legacy audit: **21 listings** with `available / available` legacy/canonical status; **13 existing products** need condition selected if resubmitted. No guessing/backfilling condition.

## API functionality verified

- Product condition validation; a product requires condition before submission, service condition is not applicable.
- Owner-only availability update to available/reserved/sold. Sold is terminal.
- Only available listings are returned from discovery; a reserved/sold listing cannot receive a new inquiry or save.
- Existing favorites can be removed even when unavailable, and owner cannot favorite own listing.
- Soft-deletion hides public listing and preserves inquiry history, audit and reports; other sellers cannot delete it.
- Moderation state is separate from product availability.

## Web and mobile changes

- Web store: create/edit product condition, availability selector, sold state and remove actions.
- Web discovery: product condition filter, URL-based search state, sort and pagination.
- Web cards/detail: item condition/status, no save of own listing, new inquiry disabled when unavailable, ability to remove existing favorite.
- Mobile browsing: shows condition and availability; blocks new inquiry/save when unavailable or own item.

## Verification

- Integration tests on isolated `cpsu_marketplace_test`: **17 passing**, including three new WP2 cases.
- Additional backend typecheck: passed.
- Web TypeScript check and Vite production build: passed.
- Mobile TypeScript check: passed.
- The Stage 1 integrity audit now finds FKs present in its ten selected relationship checks, and discovery index exists.
- Browser-click QA and physical-device testing have not yet been performed.

## Backup caveat

A **retained post-migration** logical SQL backup was created at
`C:\Users\acer\Documents\CPSU-Marketplace-Backups\cpsu_marketplace_20261111T074048Z.sql`, with adjacent `.sha256` checksum.
This contains account/student data; keep private and outside version control.
It is **not a pre-migration backup**, because migration application predated this check. The preceding isolated restore drill was successful but its SQL dump was intentionally deleted. No pre-migration restore point was verified in this session.

## Remaining gates

- Stage 1 development migration has been detected as deployed; production deployment is **not** approved.
- Final institutional review of FK delete semantics and retention rules remains open.
- Preserve Git working-tree changes; perform independent browser/mobile QA before launch.
- WP3 Transactions is **not approved**; C5 requires an explicit state-machine/Handoff decision.
