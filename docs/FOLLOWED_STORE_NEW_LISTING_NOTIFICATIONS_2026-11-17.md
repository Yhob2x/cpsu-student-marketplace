# CPSU Market — New listings from followed stores

Date: November 17, 2026
Scope: Local development; no production release or additional database migration.

## Problem

Before this change, Follow/Unfollow stored a user↔store relationship but publication did not create a follower notification. Students could follow a store and miss newly approved listings, even though the app already had in-app notifications, unread badges and an opt-in Web Push service.

## Approved behavior

- A first-time reviewer approval (`pending_review` → `published`) of a genuinely new, available product or service in an approved store with an active owner creates one persistent `store.new_listing` in-app notification per active non-staff follower.
- Recipients are the actual following users at publication time. Owners, non-followers, suspended users and staff are excluded. Unfollowing prevents future alerts.
- No alert is sent when a seller saves a draft, submits for review, revises an existing previously approved listing, receives a rejection, or re-approves an earlier published listing after edits. No historical backfill was performed.
- Reviewer approval, review history, audit entry, owner decision notification and follower notices now commit in one guarded SERIALIZABLE transaction. A concurrent/repeated decision cannot produce duplicate notifications. If a follower-notification database write fails, publication rolls back rather than silently losing an alert.
- Existing `/notifications` displays “New from a followed store”, the public store name and product/service title. Clicking it opens only a validated `/listings/<numeric id>` link. Unread badge uses the existing foreground refresh (about every five seconds).
- Best-effort privacy-safe push is passed through the existing delivery gates and push opt-in. Lock-screen text is generic; no listing/store titles or private details are sent. The existing `accountUpdates` preference bucket now explicitly says **Account and followed stores**. No new preference column or migration is introduced.
- Local development **does not enable push delivery**: production HTTPS, required consents, subscriptions and administrator delivery gates remain necessary. In-app notices work without push.

## Implementation files

- `apps/api/src/store-publication-notifications.ts` — selection, atomic enqueue, best-effort push after commit.
- `apps/api/src/routes/admin.ts` — first successful public-approval transition, idempotent guarded update and transaction.
- `apps/api/src/push.ts` — privacy-safe push category, body and internal link for `store.new_listing`.
- `apps/web/src/followed-store-notice.ts` — pure in-app formatting, safe internal navigation and kind label.
- `apps/web/src/pages-profile.tsx` — notification feed rendering.
- `apps/web/src/push-settings.tsx` — accurate preference text.
- `apps/web/src/pages-storefront.tsx` — Following state explains when new listings are notified.
- `apps/api/test/store-publication-notifications.test.ts`, `apps/api/test/push.test.ts`, `apps/web/test/followed-store-notifications.test.ts`.
- `apps/api/scripts/store-follower-notification-http-acceptance.ts` — guarded synthetic local approval acceptance + cleanup.

## Acceptance evidence

- Web suite: **63/63 passed**; API TypeScript: passed; web TypeScript + Vite build: passed.
- Focused API/Web notification/push tests: **11/11 passed**.
- Full local authenticated Express HTTP acceptance, using an isolated in-process server instance against the local development database, PASSED:
  - An unpublished pending item produced no follower alert.
  - First approval produced exactly two alerts for two active followers; unrelated, suspended and store-owner accounts received none.
  - Follower GET /notifications showed the new unread event; GET /notifications/unread-count increased total by one but did not increase message-count; listing link was public.
  - Repeating reviewer approval returned 409 and no duplicate alert.
  - Re-approval of a previously approved listing after edits and rejection created no follower “new” event.
  - After one follower unfollowed, a second new publication notified only the remaining follower.
  - Temporary test users, store, follows, photos, listing reviews, audit logs, and notification records were all removed. No demo store was left published.
- The initial test against the heavily used shared dev server was blocked by its pre-existing 429 rate limit. The real routes were therefore tested with a fresh in-process Express HTTP instance; rate limits were not disabled.
- Physical iPhone Safari/Android and actual off-device Web Push delivery **not yet tested**. Do not claim lock-screen success.

## Change controls

No schema change, Prisma migration, external push release toggle, production deployment, Git commit or Git push. All existing repository changes were preserved. The previous StoreFollow migration status remains unchanged.
