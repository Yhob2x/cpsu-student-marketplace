# Deploying the Laravel marketplace

**Status:** Templates only. Nothing has been deployed. Staging and production still need the approvals listed in `MASTER_BLUEPRINT.md` and the release gates in `progress/KNOWN_ISSUES.md`.

## Components

| Component | Runs as | Template |
|---|---|---|
| Nginx, HTTPS | Web server | `../nginx/marketplace.conf` |
| Laravel app and API | PHP-FPM pool | `php-fpm-pool.conf` |
| Private photo service | systemd on 127.0.0.1 only | `cpsu-photo-service.service` |
| MariaDB or MySQL | Existing database server | — |
| Encrypted backups | cron | `../backup/backup.sh` |

## Server requirements

- PHP 8.2 or later with `pdo_mysql`, `mbstring`, `openssl`, `fileinfo`, `curl` and OPcache.
- Composer, and Bun for building assets and running the photo service.
- A trusted TLS certificate. The service worker, push enrollment and secure cookies require HTTPS.

## Release steps

```bash
cd /var/www/cpsu-marketplace/laravel-project
composer install --no-dev --optimize-autoloader
bun install --frozen-lockfile
bun run build
(cd photo-service && bun install --frozen-lockfile)

php artisan migrate --force   # on an existing database this only records the baseline
php artisan optimize           # caches config, routes and events
```

Restart PHP-FPM and the photo service after each release. Run `php artisan optimize:clear` before editing `.env`, then cache again.

## Production `.env`

Start from `.env.example` and set at least:

| Setting | Value |
|---|---|
| `APP_ENV` / `APP_DEBUG` | `production` / `false` |
| `APP_KEY` | `php artisan key:generate` |
| `JWT_SECRET` | 32+ random characters. Reuse the old Express value to keep existing sign-ins valid. |
| `COOKIE_SECURE` | `true` (Laravel refuses to start in production otherwise) |
| `CORS_ORIGINS` | The exact public HTTPS origin |
| `DB_SOCKET` | The local database socket. If TCP must be used, set `DB_PERSISTENT=true` instead. |
| `CACHE_STORE` | `file` on a single server. Several servers need a shared atomic cache such as Redis. |
| `UPLOAD_DIR` | A private folder outside `public/`, included in backups |
| `PHOTO_SERVICE_URL` / `PHOTO_SERVICE_TOKEN` | `http://127.0.0.1:4310` and a 64-character random token shared with the photo service |
| `PUSH_SUBSCRIPTIONS_ENABLED` | `false` until the separate push release gates are approved |

Never commit `.env`. Restrict it to the `marketplace` user.

## Moving from the Express deployment

1. Stop the Express service.
2. Copy its uploaded photos into the new `UPLOAD_DIR` and compare checksums.
3. Keep the same database and `JWT_SECRET`, then run the release steps above.
4. Confirm `/health`, sign-in and a photo page before reopening traffic.

The archived Express service and staging templates were removed from disk on 2026-11-24. They remain in git history at commit `7bfeba0`, under `legacy/express-staging/`.
