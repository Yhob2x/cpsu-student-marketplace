# Laravel + React migration: Phase 6

**Date:** 2026-11-24
**Branch:** `feature/laravel-migration`
**Status:** Complete. Laravel is the only active application. The Express API and Vite app are archived in `legacy/`.

## Design parity

The original React + Vite build and the Laravel build were compared on identical copies of one rich database.

| Check | Result |
|---|---|
| Compiled CSS | 4,474/4,474 rules identical, plus the map stylesheet |
| Compiled JavaScript | Identical except the asset folder (`/build/` instead of `/`) |
| React source | `main.tsx` and all components identical. Only stylesheet import paths differ. |
| Document head | Identical metadata, icons, manifest and fonts |
| Screens | 625 compared: 8 accounts, 5 screen sizes (320 px to 1,440 px), every admin section, listings, stores, chats, transactions, empty, error and 404 states |

All 625 screens have a pixel-identical render and identical page structure. Eight screens first differed for reasons outside the design, and all eight matched once each cause was controlled:

- Chrome loads off-screen lazy images earlier when a server responds faster.
- The test crawler briefly reached the shared 900-reads-per-minute limit.
- Admin photo previews use temporary `blob:` addresses that include the server port.
- A gallery attribute is set after a layout measurement.

The original app varied against its own renders on 24 screens, so pixel checks compare repeated renders.

Fixes for exact parity:

- Two CSS rules generated from test strings in the original build are kept, so compiled CSS matches rule for rule.
- `resources/js/app.ts` adds Vite's module-preload polyfill, which the original `index.html` build added automatically.
- Laravel's empty default `favicon.ico` was removed.
- Lists with equal timestamps now use the original query ordering.

## Replacement

| Before | After |
|---|---|
| `apps/api` (Express + Prisma) | `legacy/express-api` |
| `apps/web` (React + Vite) | `legacy/react-vite-web` |
| `apps/shared` | `legacy/shared`, copied into `laravel-project/resources/shared` |
| Web unit tests and Playwright tests | `laravel-project/tests/frontend` and `laravel-project/tests/e2e` |
| Push staging, iPhone LAN and Express performance tooling | `legacy/express-qa-scripts`, `legacy/express-staging`, `legacy/express-performance` |
| Express deployment unit and Nginx proxy | Laravel Nginx, PHP-FPM pool and photo service unit in `infrastructure/` |
| Root `bun run api` / `web` | `bun run serve`, `web`, `photo`, `build`, `db:migrate`, `db:seed`, `test` |
| Prisma seed | `laravel-project/database/seeders/DatabaseSeeder.php` |
| Temporary Express bridge | Removed |
| Uploads in `apps/api/uploads` | `laravel-project/storage/app/marketplace-media` (no local photos existed to move) |

The local `cpsu_marketplace` database now has Laravel's `migrations` table, with the baseline recorded as applied. No schema or data changed, and Prisma's history is kept. A backup taken before this step is in `laravel-project/storage/app/backups/`, which is git-ignored.

## Verification after replacement

| Check | Result |
|---|---|
| Laravel tests | 43 passed |
| Frontend unit tests, moved from `apps/web` | 208 passed, same 4 existing failures as before the move |
| Playwright, run from `laravel-project` | 187 passed, same 5 existing failures |
| API routes | 121, no bridge |
| `bun run pwa:check` | Passed |
| Seeder | Same data as the Prisma seed, safe to rerun, refuses production |

## Remaining before production

See `progress/KNOWN_ISSUES.md`. The main gates are physical-device acceptance, an approved deployment on HTTPS, a shared cache if several servers are used, push delivery (KI-037), Laravel versions of the archived push-staging and iPhone LAN tooling (KI-039), and the existing CPSU approvals.
