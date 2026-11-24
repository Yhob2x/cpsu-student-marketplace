# Laravel + React migration: Phase 4

**Date:** 2026-11-24
**Branch:** `feature/laravel-migration`
**Status:** Phase 4 complete. All 121 Express API routes now exist in Laravel. Express remains in the repository until the project owner approves removing it.

## What moved to Laravel

| Area | Behavior preserved |
|---|---|
| Account | Profile, notifications, saved listings and public reports |
| Messaging | Inbox paging, receipts, typing, presence, mute, hide, close and handoffs |
| Transactions | Request, decision, negotiation, meetup, two-party completion, cancellation and audit history |
| Stock | One unit held per accepted product, released on cancel and settled on completion |
| Store reviews | Completed-transaction eligibility and mandatory moderation |
| Moderation | Campus-scoped listing review, photo attestation, affiliations, suspensions, reports and analytics |
| University admin | Users, reviewers, audit logs, catalog, guidelines, announcements and home page editor |
| Push | Device enrollment and preferences behind the same release gates |

## Push delivery

Express has outbound push hard-disabled through `durableOutboxWorkerActivated = false`. Laravel preserves that state: it writes no outbox rows and contains no sender. A Laravel delivery worker must be separately approved and built before phone alerts can be enabled.

## Bugs found and fixed by parity testing

- `INSERT IGNORE` consumed an id on repeat inquiries and shifted later records.
- Rows with equal timestamps were returned in a different order.
- Cleared cookies had a different `HttpOnly` attribute.

## Verification

Write tests used a disposable MariaDB on port 33077.

| Check | Result |
|---|---|
| Route inventory, Express and Laravel | 121/121, none missing or extra |
| Express and Laravel request comparison | 1,061/1,061 identical |
| Database effects of those requests | Identical across all compared tables |
| Cross-backend and real-browser checks | 13/13 passed |
| Laravel tests | 43 passed, 895 assertions |
| Signed-out design, 15 routes on two viewports | 30/30 have a pixel-identical render and identical DOM |
| Signed-in design, four roles on two viewports | 56/56 have a pixel-identical render and identical DOM |
| React and CSS source compared with `apps/web` | 75 source files and 63 stylesheets, no unexpected differences |
| Playwright on Laravel | 187 passed, same 5 existing failures |

Screenshots can vary between repeated renders. The original build varied against itself on 10 of 30 signed-out and 8 of 56 signed-in checks, so design checks compare repeated renders from both builds.

## Not yet verified

- Laravel with Express stopped.
- Concurrent writes and rate limits across several PHP workers.
- Load comparable to the earlier public browse test.
- Physical iPhone and Android devices.
- Real explicit-image samples and live Google Drive.
