# Laravel + React migration: Phase 1

**Date:** 2026-11-23
**Branch:** `feature/laravel-migration` (uncommitted)
**Status:** Phase 1 complete. The API is still Express. Phases 2 to 6 are not started.

## Approved decisions

- Backend moves to Laravel 12 in `laravel-project/`. React TypeScript lives in `laravel-project/resources/`.
- React remains a single-page app. Inertia is not used, so pages are not rewritten.
- `/api/v1` URLs, JSON, error codes, cookies, database tables and column names stay the same.
- Seller photo screening will stay on `nsfwjs` in a small private Node service called only by Laravel.
- Express is removed only after parity is proven and the project owner approves.

## What changed

- `resources/js`: React source copied from `apps/web/src`. Only stylesheet and shared-file import paths changed.
- `resources/css`: all application stylesheets, in the same import order.
- `resources/shared`: theme and home page defaults copied from `apps/shared`.
- `resources/views/app.blade.php`: same document head as `apps/web/index.html`.
- `public/`: PWA manifest, service worker, icons, illustrations and offline page.
- `routes/web.php`: serves the React shell for browser routes, with session and CSRF middleware removed from this stateless shell.
- `routes/api.php` and `LegacyApiProxyController`: **temporary, local-only** bridge from `/api` to Express. Remove at cutover.

`apps/api`, `apps/web` and the database were not changed.

## Build safeguards

- Frontend packages are pinned to the versions verified by `apps/web`.
- `vite.config.ts` passes a forward-slash entry path. On Windows, a backslash path bundles `main.tsx` twice and mounts the app twice.
- `shadcn.css` scans `resources/js` and `resources/css`, and keeps five utilities the old scan generated.

## Verification

| Check | Result |
|---|---|
| Laravel TypeScript and production build | Passed |
| Screenshot and DOM comparison, 15 routes on desktop and mobile, signed out, empty database | 30/30 identical |
| Playwright suite on Laravel | 187 passed, 5 failed |
| Same 3 failing spec files on the original build | Same 5 tests fail |
| `php artisan test` (starter tests only) | 2 passed |

The five existing failures are in `store-appreciations-stat`, `listing-card-vignette` and `marketplace`.

## Not yet verified

- Signed-in pages against real data. Playwright covers them with mocked API responses only.
- File uploads and login cookies through the temporary bridge.
- Physical iPhone and Android devices.

## Run locally

```powershell
# Terminal 1, from the repository root
bun run api

# Terminal 2
cd laravel-project
bun run build
php artisan serve --host=127.0.0.1 --port=8010
```

Open http://127.0.0.1:8010/.
