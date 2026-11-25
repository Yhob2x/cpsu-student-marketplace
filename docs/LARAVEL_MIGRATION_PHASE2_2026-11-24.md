# Laravel + React migration: Phase 2

**Date:** 2026-11-24
**Branch:** `feature/laravel-migration` (uncommitted)
**Status:** Phase 2 complete. Authentication runs on Laravel. All other API routes still reach Express through the local-only bridge.

## What moved to Laravel

| Area | Implementation |
|---|---|
| Database layer | 39 Eloquent models and 18 PHP enums generated from `apps/api/prisma/schema.prisma` |
| Schema baseline | `database/schema/marketplace-baseline.sql`, built from all 18 Prisma migrations |
| Auth routes | Registration policy, register, login, refresh and logout |
| Tokens | HS256 access tokens through `firebase/php-jwt` v7, shared with Express during migration |
| Passwords | Argon2id with the existing parameters, so current hashes keep working |
| Sessions | Hashed, rotating refresh tokens. Reuse revokes all of the account's sessions |
| Roles | Student, reviewer and catalog rules in `App\Support\Permissions`, loaded from the database per request |
| Protection | Security headers, request IDs, CORS, 100 KB JSON limit, IP budgets and per-account failed-login limit |
| Health | `/health`, plus loopback-only `/internal/ready` |

## Compatibility decisions

- Table and column names are unchanged. Models use the existing camelCase schema, UTC timestamps and Prisma-style decimal output.
- `TrimStrings` and `ConvertEmptyStringsToNull` are disabled so passwords and messages are not altered.
- Laravel's starter `users`, `cache` and `jobs` migrations were removed. Cache uses files and sessions are not stored in the database.
- The baseline migration does nothing when the `User` table exists, and its rollback never drops data.
- **Do not run `php artisan migrate` on `cpsu_marketplace` yet.** It would add a `migrations` table. Prisma remains the schema owner until cutover.
- Malformed JSON still returns the existing `500 internal_error`, to preserve current behavior.
- Validation responses keep `validation_error`, but the detail inside `issues` is not identical to Zod. The frontend does not read `issues`.

## Verification

All write tests used a separate disposable MariaDB on port 33077.

| Check | Result |
|---|---|
| Baseline schema compared with Prisma migrations (columns, indexes, foreign keys) | Identical |
| Laravel feature and unit tests | 15 passed |
| Express and Laravel auth scenarios | 38/38 identical |
| Database effects of those scenarios | Identical |
| Passwords, JWTs and refresh rotation across both backends | 7/7 passed |
| Real browser sign-in, reload and sign-out through Laravel | Passed, no page errors |
| Signed-out screenshot and DOM comparison | 30/30 identical on the final run |
| Playwright on Laravel | 187 passed, same 5 existing failures as Phase 1 |

One earlier comparison run differed on `/dashboard` by 0.03% of pixels. The original app also differed from itself in 1 of 10 repeat renders, so this is rendering noise.

## Not yet verified

- Sign-in on `cpsu_marketplace`, because it has no accounts.
- Concurrent rate limiting across several PHP workers (see KI-034).
- Physical iPhone and Android devices.

## Run Laravel tests

Tests refuse to run unless they target the disposable database.

```bash
# First time only
/d/xampp/mysql/bin/mysql_install_db.exe --datadir=D:/tmp/cpsu-test-db --port=33077

# Keep this running in its own terminal
/d/xampp/mysql/bin/mysqld.exe --defaults-file=D:/tmp/cpsu-test-db/my.ini --port=33077 --bind-address=127.0.0.1 --lower-case-table-names=2 --console

# First time only, from laravel-project
/d/xampp/mysql/bin/mysql.exe -h 127.0.0.1 -P 33077 -u root -e "CREATE DATABASE cpsu_marketplace_laravel_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
APP_ENV=testing DB_HOST=127.0.0.1 DB_PORT=33077 DB_DATABASE=cpsu_marketplace_laravel_test DB_USERNAME=root DB_PASSWORD= CACHE_STORE=array php artisan migrate --force

# Run tests
php artisan test
```
