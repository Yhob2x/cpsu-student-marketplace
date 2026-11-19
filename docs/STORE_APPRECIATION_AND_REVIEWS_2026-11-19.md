# Store appreciation and review continuation — November 19, 2026

## Implemented in code

- Public student storefronts have an Appreciate / Appreciated action with a real unique-user count, an undo action, and explicit success/error feedback. Owners see only their store's count.
- Appreciate is not Follow, a purchase, a rating, or a CPSU endorsement. One appreciation is stored per verified CPSU student per store. The owner cannot appreciate their own store. Staff and guests cannot write.
- Public counts never expose student names, identity documents, or other personal information. Hidden stores do not expose counts.
- Public ratings display the distribution of moderated 1–5-star reviews. Reviews remain linked to completed transactions and require a current verified student affiliation to submit. Existing ratings are moderated before publication.
- Review moderation has a confirmation before hiding published reviews, action-feedback confirmations, and request-order protection for slow page changes.
- Review eligibility and buyer UI now agree on the student-affiliation requirement.

## API

- `GET /api/v1/seller-profiles/:id/appreciations` — public count and signed-in viewer state for a visible store
- `PUT /api/v1/store-appreciations/:id` — idempotent student appreciation, verified affiliation required
- `DELETE /api/v1/store-appreciations/:id` — idempotent removal
- Existing store-review endpoints continue to enforce completed-transaction eligibility and campus-scoped moderation

## Database activation gate

- **Not yet activated:** `apps/api/prisma/migrations/20261119093000_store_appreciations/migration.sql`.
- The API intentionally returns `available: false`, `count: null` when the Prisma client/model or table is not active. UI does not invent a zero count.
- Do not run `prisma migrate deploy` on the development database until outstanding migrations are individually audited. As observed when this work began, `20261117230000_private_student_identity` was also pending.
- Before activating, use an approved backup and isolated restore/test acceptance. Regenerate Prisma Client only with appropriate Windows process locks cleared, and repeat the read-only schema/inventory verification. Do not activate real student-ID collection implicitly.
- No DB migration was applied by this change.

## Verification

- `bunx prisma validate` passed.
- Focused API and component tests passed.
- API full suite: 232 pass, 8 expected skip, 0 fail.
- Web production build succeeded. Full web unit suite: 131 pass, 1 fail in separately edited private meetup map pin test; appreciation and store UI tests passed.
- No user records were modified and no changes were pushed by this task.
