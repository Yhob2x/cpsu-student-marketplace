# Laravel + React migration: Phase 5

**Date:** 2026-11-24
**Branch:** `feature/laravel-migration`
**Status:** Complete. Laravel runs on its own with Express stopped.

## Laravel-only verification

The temporary bridge to Express was switched off and Express was stopped.

| Check | Result |
|---|---|
| Unmatched API path | `404 not_found` from Laravel, nothing forwarded |
| Real browser crawl, 4 roles on two viewports | 75 pages, 813 API responses, no failures, no requests to Express |
| Laravel tests | 43 passed |
| Playwright | 187 passed, same 5 existing failures (KI-038) |
| Express and Laravel request comparison | 1,061/1,061 identical, identical database effects |

## Concurrency across eight PHP workers

The same 17 checks ran against Express (one process) and Laravel (eight `php -S` workers sharing one database and cache).

| Check | Laravel | Express baseline |
|---|---|---|
| Duplicate purchase, oversell, double accept, joint confirmation, cancel during completion | Pass | Pass |
| Simultaneous first messages share one conversation | Pass | Fail, two `500` responses |
| Repeated save, follow and like | Pass | Fail, `500` responses |
| Refresh-token double spend, approval, report resolution, stock edits, push device limit | Pass | Pass |
| Photo limit under concurrent uploads | Pass after fix | Fail, 11 of 5 photos |
| Duplicate registration | Pass after fix (409 `email_taken`) | One account, but `500` responses |
| Failed-login lockout and write rate limit | Pass after fix | Pass |

Fixes made in this phase:

- **Rate limits were not atomic across workers.** Limiter updates are now serialized with OS file locks on a fixed set of 64 lock files. This is correct on one server. Several servers need a shared atomic cache.
- **The 5-photo limit could be exceeded.** Uploads now lock the listing row. This was also an Express bug.
- **Simultaneous sign-ups returned 500.** They now return `409 email_taken`.
- Expected lock conflicts are no longer logged as errors.

## Load

The catalog had 3,000 listings and 200 stores. Visitors loaded categories, listings, fresh listings and one listing detail.

| Scenario | Express | Laravel, 16 workers |
|---|---|---|
| 500 visitors at once, distinct IPs | 2,000/2,000 OK, p95 3.3 s | 2,000/2,000 OK, p95 1.7 s |
| 500 visitors behind one IP | 900 OK, 500 rate-limited | 900 OK, 500 rate-limited |
| 40 students for 30 seconds | 564 requests/s, p95 198 ms | 501 requests/s, p95 206 ms, no failures |

Fixes made in this phase:

- **Listing visibility was checked once per listing row.** Each store is now evaluated once, which scaled listing throughput from 32 to 187 requests per second on eight workers.
- **High traffic exhausted local TCP ports**, because each PHP request opened a new database connection. `DB_PERSISTENT=true` or a database socket (`DB_SOCKET`) prevents this. The deployment guide requires one of them.
- The 30-second public reference-data cache was restored with admin invalidation (KI-036).

Laravel was tested with OPcache and cached configuration, as production would run. Each request takes 6 to 34 ms on one worker.

## Not yet verified

- PHP-FPM on Linux. The load tests used `php -S` on Windows.
- Several application servers sharing one cache.
- Physical iPhone and Android devices.
