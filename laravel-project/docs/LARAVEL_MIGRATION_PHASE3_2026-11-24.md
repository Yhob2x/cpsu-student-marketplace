# Laravel + React migration: Phase 3

**Date:** 2026-11-24
**Branch:** `feature/laravel-migration` (Phase 3 uncommitted)
**Status:** Phase 3 complete. Public browsing, listings, stores and photo uploads run on Laravel. Messages, transactions, notifications, account, push, store reviews and admin routes still reach Express through the local-only bridge.

## What moved to Laravel

| Area | Routes and behavior |
|---|---|
| Public content | Campuses, categories, guidelines, announcements, home page and home images |
| Discovery | Search, filters, sorting, paging, Fresh, Popular and listing details |
| Stores | Public store pages, slugs, connections, most followed and follows |
| Engagement | Listing appreciations and privacy-preserving view counts |
| Seller tools | Store settings, listings, stock, availability, submission, cover photo and soft delete |
| Media | Authorized listing photos, store photos, local storage and the Google Drive adapter |

Laravel now owns 43 API routes.

## Photo service decision

`laravel-project/photo-service` is a small private Node service bound to `127.0.0.1`. Laravel calls it with a shared token.

The approved design used it for explicit-content screening. Implementation also moved **image sanitization** there because PHP GD cannot reproduce the current `sharp` result. GD drops color profiles and decodes damaged files less strictly, which would change photos and weaken upload checks. The service uses the same `sharp`, `nsfwjs` and TensorFlow versions and the same settings as Express.

If the service is unavailable, listing uploads return `503 photo_processing_unavailable` and store photos fail closed. Existing content is unchanged.

## Compatibility decisions

- During migration, `UPLOAD_DIR` points to `apps/api/uploads`, so both backends read the same photos.
- Laravel expects all 18 migrations to be applied. It does not include Express's fallbacks for missing optional tables.
- The 30-second Express cache for public reference data was not ported yet. Express admin routes still change that data, and a separate Laravel cache could show stale values.
- PHP keeps only the last file when a request repeats the `image` field, while Express rejects the request. The React app sends one file.

## Bugs found and fixed by parity testing

- Laravel's file response marked private student photos as publicly cacheable.
- A condition filter combined with `type=service` returned different listings.
- Unusual numeric ids returned different errors.
- MySQL changed-row counts could have reported unchanged edits as conflicts.
- A JSON `null` response for sellers without a store could have become `{}`.

## Verification

Write tests used a disposable MariaDB on port 33077.

| Check | Result |
|---|---|
| Express and Laravel request comparison | 343/343 identical |
| Database effects of those requests | Identical |
| Sanitized photo bytes from both backends | Identical |
| Cross-backend listing and photo checks | 6/6 passed |
| Real browser journey | 7/7 passed, no page or server errors |
| Laravel tests | 30 passed |
| Signed-out screenshot and DOM comparison | 30/30 identical |
| Playwright on Laravel | 187 passed, same 5 existing failures |

## Not yet verified

- The classifier with real explicit images. Blocking and fail-closed paths are tested with simulated verdicts.
- Live Google Drive upload and download.
- Photo uploads on `cpsu_marketplace`.
- Concurrent load across several PHP workers.
- Physical iPhone and Android devices.

## Run locally

```powershell
# Terminal 1, from the repository root
bun run api

# Terminal 2
cd laravel-project/photo-service
bun install
bun run start

# Terminal 3
cd laravel-project
bun run build
php artisan serve --host=127.0.0.1 --port=8010
```

Open http://127.0.0.1:8010/.
