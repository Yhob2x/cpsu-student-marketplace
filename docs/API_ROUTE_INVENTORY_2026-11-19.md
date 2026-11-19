# CPSU Market API route inventory — static source scan (19 Nov 2026)

Found **118** literal HTTP route registrations in source. This is **not** an authoritative runtime/authorization or SQL-execution trace. The “security” column reflects router-level guards or broad route-family intent; **verify conditional guards per endpoint**. The “direct models” column only recognizes direct Prisma model calls inside the route text and can miss imported helpers, nested business logic and dynamic routes. No database was accessed.

| Method | Route | Security (module level) | Direct Prisma models (partial) | File:line |
|---|---|---|---|---|
| GET | `/internal/ready` | Loopback-only internal readiness | Prisma `SELECT 1` (raw) | `apps/api/src/app.ts:45` |
| GET | `/health` | Public health | Indirect/none | `apps/api/src/app.ts:56` |
| GET | `/api/v1/me` | Authenticated; saved/reports require student | affiliation, sellerProfile | `apps/api/src/routes/account.ts:14` |
| PATCH | `/api/v1/me` | Authenticated; saved/reports require student | user | `apps/api/src/routes/account.ts:22` |
| GET | `/api/v1/notifications/unread-count` | Authenticated; saved/reports require student | notification | `apps/api/src/routes/account.ts:28` |
| GET | `/api/v1/notifications` | Authenticated; saved/reports require student | notification | `apps/api/src/routes/account.ts:37` |
| POST | `/api/v1/notifications/read` | Authenticated; saved/reports require student | notification | `apps/api/src/routes/account.ts:41` |
| POST | `/api/v1/notifications/:id/read` | Authenticated; saved/reports require student | notification | `apps/api/src/routes/account.ts:45` |
| GET | `/api/v1/saved` | Authenticated; saved/reports require student | savedListing | `apps/api/src/routes/account.ts:53` |
| PUT | `/api/v1/saved/:listingId` | Authenticated; saved/reports require student | listing, savedListing | `apps/api/src/routes/account.ts:60` |
| DELETE | `/api/v1/saved/:listingId` | Authenticated; saved/reports require student | savedListing | `apps/api/src/routes/account.ts:71` |
| POST | `/api/v1/reports` | Authenticated; saved/reports require student | Indirect/none | `apps/api/src/routes/account.ts:76` |
| GET | `/api/v1/admin/review-queue` | Authenticated reviewer/admin | affiliation, listing, report | `apps/api/src/routes/admin.ts:33` |
| POST | `/api/v1/admin/listings/:id/decision` | Authenticated reviewer/admin | auditLog, campusPolicy, listing, listingReview, notification | `apps/api/src/routes/admin.ts:45` |
| POST | `/api/v1/admin/affiliations/:id/verify` | Authenticated reviewer/admin | affiliation | `apps/api/src/routes/admin.ts:109` |
| POST | `/api/v1/admin/listings/:id/suspend` | Authenticated reviewer/admin | listing | `apps/api/src/routes/admin.ts:123` |
| GET | `/api/v1/admin/transactions` | Authenticated reviewer/admin | transaction | `apps/api/src/routes/admin.ts:140` |
| GET | `/api/v1/admin/reports` | Authenticated reviewer/admin | report | `apps/api/src/routes/admin.ts:160` |
| POST | `/api/v1/admin/reports/:id/resolve` | Authenticated reviewer/admin | auditLog, report | `apps/api/src/routes/admin.ts:164` |
| GET | `/api/v1/admin/content/guidelines` | Authenticated reviewer/admin | guidelineContent | `apps/api/src/routes/admin.ts:191` |
| PUT | `/api/v1/admin/content/guidelines` | Authenticated reviewer/admin | guidelineContent | `apps/api/src/routes/admin.ts:196` |
| POST | `/api/v1/admin/content/guidelines/publish` | Authenticated reviewer/admin | guidelineContent | `apps/api/src/routes/admin.ts:203` |
| GET | `/api/v1/admin/content/announcements` | Authenticated reviewer/admin | announcement | `apps/api/src/routes/admin.ts:216` |
| POST | `/api/v1/admin/content/announcements` | Authenticated reviewer/admin | announcement | `apps/api/src/routes/admin.ts:222` |
| PATCH | `/api/v1/admin/content/announcements/:id` | Authenticated reviewer/admin | announcement | `apps/api/src/routes/admin.ts:229` |
| POST | `/api/v1/admin/content/announcements/:id/publish` | Authenticated reviewer/admin | announcement | `apps/api/src/routes/admin.ts:240` |
| POST | `/api/v1/admin/content/announcements/:id/archive` | Authenticated reviewer/admin | announcement | `apps/api/src/routes/admin.ts:260` |
| GET | `/api/v1/admin/audit-logs` | Authenticated reviewer/admin | auditLog | `apps/api/src/routes/admin.ts:274` |
| GET | `/api/v1/admin/users` | Authenticated reviewer/admin | user | `apps/api/src/routes/admin.ts:293` |
| POST | `/api/v1/admin/users/:id/assign-reviewer` | Authenticated reviewer/admin | affiliation, auditLog, campus, session, user, userRole | `apps/api/src/routes/admin.ts:326` |
| PATCH | `/api/v1/admin/users/:id/status` | Authenticated reviewer/admin | auditLog, notification, session, user | `apps/api/src/routes/admin.ts:361` |
| GET | `/api/v1/admin/analytics/overview` | Authenticated reviewer/admin | campus, inquiryThread, listing, sellerProfile | `apps/api/src/routes/admin.ts:392` |
| GET | `/api/v1/auth/registration-policy` | Public/session-specific | Indirect/none | `apps/api/src/routes/auth.ts:42` |
| POST | `/api/v1/auth/register` | Public/session-specific | campus, user | `apps/api/src/routes/auth.ts:47` |
| POST | `/api/v1/auth/login` | Public/session-specific | user | `apps/api/src/routes/auth.ts:70` |
| POST | `/api/v1/auth/refresh` | Public/session-specific | session, user | `apps/api/src/routes/auth.ts:77` |
| POST | `/api/v1/auth/logout` | Public/session-specific | pushSubscription, session | `apps/api/src/routes/auth.ts:111` |
| GET | `/api/v1/admin/catalog/` | Authenticated catalog administrator | campus, category | `apps/api/src/routes/catalog-admin.ts:43` |
| POST | `/api/v1/admin/catalog/campuses` | Authenticated catalog administrator | auditLog, campus | `apps/api/src/routes/catalog-admin.ts:60` |
| PATCH | `/api/v1/admin/catalog/campuses/:id` | Authenticated catalog administrator | auditLog, campus | `apps/api/src/routes/catalog-admin.ts:75` |
| POST | `/api/v1/admin/catalog/services` | Authenticated catalog administrator | auditLog, category | `apps/api/src/routes/catalog-admin.ts:104` |
| PATCH | `/api/v1/admin/catalog/services/:id` | Authenticated catalog administrator | auditLog, category | `apps/api/src/routes/catalog-admin.ts:117` |
| POST | `/api/v1/admin/catalog/categories` | Authenticated catalog administrator | auditLog, category | `apps/api/src/routes/catalog-admin.ts:137` |
| PATCH | `/api/v1/admin/catalog/categories/:id` | Authenticated catalog administrator | auditLog, category | `apps/api/src/routes/catalog-admin.ts:151` |
| GET | `/api/v1/admin/content/home-page/` | Authenticated reviewer | homePageContent | `apps/api/src/routes/home-page-admin.ts:91` |
| PUT | `/api/v1/admin/content/home-page/` | Authenticated reviewer | Indirect/none | `apps/api/src/routes/home-page-admin.ts:97` |
| POST | `/api/v1/admin/content/home-page/publish` | Authenticated reviewer | auditLog, homePageContent | `apps/api/src/routes/home-page-admin.ts:106` |
| GET | `/api/v1/admin/content/home-page/images/:slot` | Authenticated reviewer | homePageContent | `apps/api/src/routes/home-page-admin.ts:135` |
| POST | `/api/v1/admin/content/home-page/images/:slot` | Authenticated reviewer | Indirect/none | `apps/api/src/routes/home-page-admin.ts:143` |
| DELETE | `/api/v1/admin/content/home-page/images/:slot` | Authenticated reviewer | Indirect/none | `apps/api/src/routes/home-page-admin.ts:179` |
| GET | `/api/v1/home-page/` | Public | homePageContent | `apps/api/src/routes/home-page-public.ts:11` |
| GET | `/api/v1/home-page/images/:slot` | Public | homePageContent | `apps/api/src/routes/home-page-public.ts:26` |
| GET | `/api/v1/inquiries/` | Authenticated student | inquiryThread | `apps/api/src/routes/inquiries.ts:40` |
| POST | `/api/v1/inquiries/` | Authenticated student | inquiryThread, listing | `apps/api/src/routes/inquiries.ts:63` |
| GET | `/api/v1/inquiries/:id/messages` | Authenticated student | handoff, inquiryMessage, transaction | `apps/api/src/routes/inquiries.ts:86` |
| POST | `/api/v1/inquiries/:id/presence` | Authenticated student | Indirect/none | `apps/api/src/routes/inquiries.ts:125` |
| POST | `/api/v1/inquiries/:id/seen` | Authenticated student | inquiryMessage, notification | `apps/api/src/routes/inquiries.ts:134` |
| POST | `/api/v1/inquiries/:id/typing` | Authenticated student | Indirect/none | `apps/api/src/routes/inquiries.ts:158` |
| POST | `/api/v1/inquiries/:id/messages` | Authenticated student | Indirect/none | `apps/api/src/routes/inquiries.ts:165` |
| POST | `/api/v1/inquiries/:id/close` | Authenticated student | auditLog, inquiryThread | `apps/api/src/routes/inquiries.ts:180` |
| PUT | `/api/v1/inquiries/:id/handoff` | Authenticated student | handoff, transaction | `apps/api/src/routes/inquiries.ts:201` |
| GET | `/api/v1/campuses` | Public with optional identity | campus | `apps/api/src/routes/public.ts:45` |
| GET | `/api/v1/categories` | Public with optional identity | category | `apps/api/src/routes/public.ts:46` |
| GET | `/api/v1/guidelines` | Public with optional identity | guidelineContent | `apps/api/src/routes/public.ts:48` |
| GET | `/api/v1/announcements` | Public with optional identity | announcement | `apps/api/src/routes/public.ts:60` |
| GET | `/api/v1/listings` | Public with optional identity | listing | `apps/api/src/routes/public.ts:71` |
| GET | `/api/v1/listings/popular` | Public with optional identity | listing | `apps/api/src/routes/public.ts:101` |
| GET | `/api/v1/listings/fresh` | Public with optional identity | listing | `apps/api/src/routes/public.ts:114` |
| GET | `/api/v1/listings/:id` | Public with optional identity | listing, sellerProfile | `apps/api/src/routes/public.ts:127` |
| GET | `/api/v1/stores/most-followed` | Public with optional identity | listing, sellerProfile | `apps/api/src/routes/public.ts:140` |
| GET | `/api/v1/seller-profiles/by-slug/:slug` | Public with optional identity | Indirect/none | `apps/api/src/routes/public.ts:179` |
| GET | `/api/v1/seller-profiles/:id` | Public with optional identity | sellerProfile | `apps/api/src/routes/public.ts:188` |
| GET | `/api/v1/media/seller-avatar/:id` | Public with optional identity | Indirect/none | `apps/api/src/routes/public.ts:218` |
| GET | `/api/v1/media/:id` | Public with optional identity | listingMedia | `apps/api/src/routes/public.ts:220` |
| GET | `/api/v1/push/config` | Authenticated | Indirect/none | `apps/api/src/routes/push.ts:33` |
| POST | `/api/v1/push/subscriptions/status` | Authenticated | pushSubscription | `apps/api/src/routes/push.ts:40` |
| GET | `/api/v1/push/preferences` | Authenticated | pushPreference | `apps/api/src/routes/push.ts:51` |
| PATCH | `/api/v1/push/preferences` | Authenticated | pushPreference | `apps/api/src/routes/push.ts:59` |
| POST | `/api/v1/push/subscriptions` | Authenticated | pushSubscription | `apps/api/src/routes/push.ts:71` |
| DELETE | `/api/v1/push/subscriptions` | Authenticated | pushSubscription | `apps/api/src/routes/push.ts:100` |
| GET | `/api/v1/admin/reviewers/` | Authenticated administrator | user | `apps/api/src/routes/reviewers.ts:21` |
| POST | `/api/v1/admin/reviewers/` | Authenticated administrator | auditLog, campus, user | `apps/api/src/routes/reviewers.ts:45` |
| PATCH | `/api/v1/admin/reviewers/:id` | Authenticated administrator | auditLog, campus, session, user, userRole | `apps/api/src/routes/reviewers.ts:69` |
| POST | `/api/v1/seller/store` | Authenticated student | sellerProfile | `apps/api/src/routes/seller.ts:61` |
| GET | `/api/v1/seller/store` | Authenticated student | listing, sellerProfile | `apps/api/src/routes/seller.ts:69` |
| PATCH | `/api/v1/seller/store` | Authenticated student | auditLog, sellerProfile | `apps/api/src/routes/seller.ts:92` |
| POST | `/api/v1/seller/store/avatar` | Authenticated student | sellerProfile | `apps/api/src/routes/seller.ts:118` |
| DELETE | `/api/v1/seller/store/avatar` | Authenticated student | auditLog, sellerProfile | `apps/api/src/routes/seller.ts:157` |
| GET | `/api/v1/seller/listings` | Authenticated student | listing | `apps/api/src/routes/seller.ts:179` |
| POST | `/api/v1/seller/listings` | Authenticated student | listing, sellerProfile | `apps/api/src/routes/seller.ts:184` |
| PATCH | `/api/v1/seller/listings/:id` | Authenticated student | listing | `apps/api/src/routes/seller.ts:195` |
| POST | `/api/v1/seller/listings/:id/media` | Authenticated student | auditLog, listing, listingMedia | `apps/api/src/routes/seller.ts:216` |
| PATCH | `/api/v1/seller/listings/:id/media/cover` | Authenticated student | Indirect/none | `apps/api/src/routes/seller.ts:274` |
| POST | `/api/v1/seller/listings/:id/submit` | Authenticated student | listing | `apps/api/src/routes/seller.ts:276` |
| PATCH | `/api/v1/seller/listings/:id/availability` | Authenticated student | auditLog, listing, notification, savedListing | `apps/api/src/routes/seller.ts:293` |
| DELETE | `/api/v1/seller/listings/:id` | Authenticated student | auditLog, listing | `apps/api/src/routes/seller.ts:328` |
| POST | `/api/v1/transactions/` | Authenticated student | inquiryThread, listing, transaction | `apps/api/src/routes/transactions.ts:77` |
| GET | `/api/v1/transactions/` | Authenticated student | transaction | `apps/api/src/routes/transactions.ts:144` |
| GET | `/api/v1/transactions/:id` | Authenticated student | handoff, transactionStatusLog | `apps/api/src/routes/transactions.ts:166` |
| POST | `/api/v1/transactions/:id/decision` | Authenticated student | listing, transaction, user | `apps/api/src/routes/transactions.ts:179` |
| POST | `/api/v1/transactions/:id/negotiating` | Authenticated student | transaction | `apps/api/src/routes/transactions.ts:232` |
| PUT | `/api/v1/transactions/:id/meetup-location` | Authenticated student | handoff, transaction | `apps/api/src/routes/transactions.ts:252` |
| POST | `/api/v1/transactions/:id/confirm-meetup` | Authenticated student | transaction | `apps/api/src/routes/transactions.ts:299` |
| POST | `/api/v1/transactions/:id/confirm-completion` | Authenticated student | listing, transaction | `apps/api/src/routes/transactions.ts:328` |
| POST | `/api/v1/transactions/:id/cancel` | Authenticated student | listing, transaction | `apps/api/src/routes/transactions.ts:361` |
| GET | `/api/v1/store-follows/mine` | Public summary; student mutations/private mine | Indirect/none | `apps/api/src/store-follows.ts:77` |
| PUT | `/api/v1/store-follows/:id` | Public summary; student mutations/private mine | Indirect/none | `apps/api/src/store-follows.ts:136` |
| DELETE | `/api/v1/store-follows/:id` | Public summary; student mutations/private mine | Indirect/none | `apps/api/src/store-follows.ts:155` |
| GET | `/api/v1/seller-profiles/:id/connections` | Public summary; student mutations/private mine | Indirect/none | `apps/api/src/store-follows.ts:176` |
| GET | `/api/v1/seller-profiles/:id/reviews` | Public review reads; buyer/reviewer mutations | Indirect/none | `apps/api/src/store-reviews.ts:48` |
| GET | `/api/v1/seller-profiles/:id/review-opportunities` | Public review reads; buyer/reviewer mutations | Indirect/none | `apps/api/src/store-reviews.ts:88` |
| GET | `/api/v1/transactions/:id/store-review` | Public review reads; buyer/reviewer mutations | Indirect/none | `apps/api/src/store-reviews.ts:126` |
| POST | `/api/v1/transactions/:id/store-review` | Public review reads; buyer/reviewer mutations | auditLog, transaction | `apps/api/src/store-reviews.ts:167` |
| GET | `/api/v1/admin/store-reviews` | Public review reads; buyer/reviewer mutations | Indirect/none | `apps/api/src/store-reviews.ts:217` |
| POST | `/api/v1/admin/store-reviews/:id/decision` | Public review reads; buyer/reviewer mutations | auditLog | `apps/api/src/store-reviews.ts:240` |
| GET | `/api/v1/seller-profiles/:id/appreciations` | Public summary; student mutations | Indirect/none | `apps/api/src/store-appreciations.ts:52` |
| PUT | `/api/v1/store-appreciations/:id` | Public summary; student mutations | Indirect/none | `apps/api/src/store-appreciations.ts:61` |
| DELETE | `/api/v1/store-appreciations/:id` | Public summary; student mutations | Indirect/none | `apps/api/src/store-appreciations.ts:90` |

To complete the exact endpoint → table inventory, collect Prisma query traces for each synthetic journey on isolated staging and compare with this static index.
