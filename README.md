# CPSU Student Marketplace & Services

A **single mobile-first web application** for CPSU students, sellers and authorized reviewers. One Laravel app serves both the API and the React frontend, on desktop and mobile browsers, and can be added to a phone's home screen as a Progressive Web App (PWA).

> **Governing specification:** `MASTER_BLUEPRINT.md` remains the approved development baseline. The student-verification method, policies and hosting require CPSU authorization before production release.
>
> **Project rules:** Preserve the approved forest-green theme, published data, authentication, permissions and existing application behavior.

| Part | Stack | Location |
|---|---|---|
| Web app and REST API | Laravel 12, PHP 8.2, MySQL/MariaDB | `app/`, `routes/`, `database/` |
| Frontend (mobile + desktop PWA) | React 18, TypeScript, Vite, Tailwind | `resources/js` and `resources/css` |
| Private photo service | Bun, `sharp`, `nsfwjs` (loopback only) | `photo-service/` |

The Laravel app sits directly in the repository root, together with the blueprint, `docs/`, `progress/`, `infrastructure/` and `scripts/`. The browser always talks to the same origin and `/api/v1`. There is no separate API server to configure.

## Run locally on Windows (XAMPP)

Run every command from the repository root.

1. Install dependencies once: `bun run setup` (Composer, Bun and the photo service).
2. In `.env`, set your MySQL `DB_*` values, `JWT_SECRET` (32+ characters) and a random `PHOTO_SERVICE_TOKEN`. Start from `.env.example` on a new machine.
3. Prepare the database: `bun run db:migrate`, then optionally `bun run db:seed` for demo data.
4. Start these in **separate terminals**:

```powershell
bun run serve   # Laravel app and API on http://127.0.0.1:8000
bun run dev     # Vite dev server with hot reload (optional)
bun run photo   # Private photo service, needed for photo uploads
```

Without `bun run dev`, Laravel serves the last build. Run `bun run build` after frontend changes.

Demo accounts from the seeder are `seller@dev.test`, `buyer@dev.test`, `reviewer@dev.test` and `admin@dev.test` with password `DevPassword!123`. Use them only in development.

For phone layout checks on trusted Wi-Fi, run `php artisan serve --host=0.0.0.0` and open `http://<YOUR-PC-LAN-IP>:8000/`. **PWA installation and service workers require HTTPS (or localhost).**

## Test

```powershell
bun run test            # Laravel tests (uses a disposable MariaDB on port 33077)
bun run test:frontend   # React unit tests
bun run build; bun run test:e2e   # Browser tests with mocked API responses
bun run pwa:check       # PWA manifest, icons and service worker
```

The Laravel tests refuse to run against any database except `cpsu_marketplace_laravel_test` on port 33077. Setup steps are in `docs/LARAVEL_MIGRATION_PHASE2_2026-11-24.md`.

Do not deploy without completing `docs/DEVICE_ACCESSIBILITY_ACCEPTANCE_2026-11-12.md`, `docs/PWA_MOBILE_FINALIZATION_2026-11-12.md` and the other blueprint approval gates.

## Try the full flow

1. Sign in as a verified seller, open My store, create or edit a listing and submit it for review.
2. Sign in as an authorized reviewer, open Review, inspect the listing and record a decision with a reason.
3. Sign in as a buyer, discover the published listing, save it, send an inquiry and follow the conversation.

Payments, handoffs and confirmations remain arranged directly between students. The marketplace does not process payments.

## PWA icons

Regenerate and validate the installable app icons:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-pwa-icons.ps1
bun run pwa:check
```

**Actual Android and iPhone installation remains a required release acceptance test.**

## Deployment

**Not deployed.** Laravel deployment templates and steps are in `infrastructure/deploy/README.md` and `infrastructure/nginx/marketplace.conf`. They cover Nginx, PHP-FPM, the photo service and the production `.env`.

## Mobile alerts

Students can opt in to Web Push device enrollment behind fail-closed release gates (`PUSH_SUBSCRIPTIONS_ENABLED=false` by default). **No push messages are sent.** Outbound delivery was disabled in the Express API and has no Laravel sender yet (KI-037). The old Express staging and push gates are kept only in git history (commit `7bfeba0`, `legacy/`).

## Migration history

The app moved from Express + Vite to Laravel + React between 23 and 24 November 2026, keeping the same database, API contract and design. The old code was removed from disk afterward and remains in git history at commit `7bfeba0`. See `docs/LARAVEL_MIGRATION_PHASE1_2026-11-23.md` to `docs/LARAVEL_MIGRATION_PHASE6_2026-11-24.md`.
