# CPSU Market — staging-only deployment templates

**Prepared:** 16 November 2026. **Not deployed or authorized for public use.**

These are inert, intentionally incomplete templates for an independently approved, test-only HTTPS instance of the CPSU Student Marketplace PWA. They do **not** provision servers, domains, credentials, databases, real students, browser subscriptions or notification delivery.

## Files and what they do

| File | Purpose |
|---|---|
| `nginx.conf.template` | HTTPS static PWA + same-origin API to local port 4400. Blocks hidden files and indexing, avoids API/HTML caching. |
| `cpsu-marketplace-staging-api.service.template` | Separate Linux service that runs the Bun-targeted API as `marketplace-staging`, with basic filesystem restrictions. |
| `staging.env.example` | Required variables and **placeholders only**. Do not rename/copy into Git or insert secrets into this file. |

Run **`bun run push:staging:templates`** from the project root to check that the templates are structurally safe. A passed template check does not authorize deployment. Separately run **`bun run push:staging:check`** to confirm that the monitored contact and approved staging host are configured; this is expected to report blockers until provided.

## Mandatory external approvals — do not skip

1. Confirm the student marketplace **staging hostname** belongs to an approved domain under the control of CPSU or a designated responsible operator, with an explicit deployment decision. No hostname is currently supplied.
2. Establish a **monitored project contact** for VAPID, preferably an institutional email. The existing local `https://localhost:8443/` contact is **not appropriate** on a public server.
3. Choose an authorized, isolated Linux staging host, valid publicly trusted certificate and restricted staging-only database. **No real students, copied student DB, private uploads, or production account credentials.**
4. Approve *all* pending Prisma migrations for this staging schema. `prisma migrate deploy` applies **every pending migration**, including potentially concurrent WP3 work. The separate WP3 transaction implementation is not implicitly authorized by this push-staging plan.
5. Approve privacy/retention and test notices. Use consenting testers and synthetic user identities. Record an expiration/cleanup date for subscriptions and staging accounts.

## Staging isolation and configuration requirements

- **Dedicated DB:** e.g. `cpsu_marketplace_staging`, separate from `cpsu_marketplace`, `cpsu_marketplace_push_test`, any production database and all existing local test schemas. No live-user import.
- **Dedicated OS identity:** `marketplace-staging` with permission only for staging files and staging upload directory.
- **Dedicated secrets:** unique staging JWT secret, DB role, and preferably a dedicated staging VAPID pair. These remain outside source control in `/etc/cpsu-marketplace/staging.env` (restrict to root/systemd as appropriate).
- **Exact origin:** `CORS_ORIGINS=https://<approved-domain>`, `COOKIE_SECURE=true`, `NODE_ENV=production`.
- **Network confinement:** `BIND_HOST=127.0.0.1`, `PORT=4400`; only Nginx has public HTTPS access. Firewall denies direct port 4400.
- **Web root:** deploy `apps/web/dist` *without source files, server secrets or uploaded photos* to a dedicated staging web root. The built PWA's `start_url` and service-worker scope assume the root of its own subdomain.
- **Runtime:** the current build uses Bun (`bun build --target bun`). The staging service intentionally uses an explicit `__STAGING_BUN_PATH__` placeholder, not Node. Verify the installed Bun runtime path and API build on the authorized Linux host.
- **TLS:** trusted and correctly renewed TLS certificate, verified on actual phones; never the localhost self-signed certificate used in Stage 2. Confirm HTTPS first, then decide on HSTS with administrators.
- **CSP/security:** preserve Express Helmet and avoid a permissive wildcard CORS. Review media routes and storage retention. The Nginx template explicitly requests no-cache/no-store for the PWA shell and personal API responses.

## Safe future manual deployment process (requires a new explicit approval)

This is a **procedure**, not commands executed in the current Stage 4 task.

1. Record the approved domain, contact, host, authorized person, staging-only database and rollback owner.
2. Review all uncommitted changes, source integrity and currently pending migrations (WP3 is being developed concurrently). Obtain migrations approval **separately**.
3. Provision the isolated VPS/account/database and create credentials *on that host*; back up and verify restore instructions. Do not expose keys through logs, chat or a tracked project file.
4. Render and review these templates in a **private, untracked** staging configuration directory; ensure all `__PLACEHOLDER__` markers are eliminated in the deployed copies. Keep this source template untouched.
5. Build API using its Bun build script and web with its Vite production build; check expected static assets. Do not ship `.env` or test databases inside the web root.
6. On the authorized host, check pending migrations; apply only the set approved for the dedicated staging database and confirm migration history and foreign keys.
7. Verify TLS and Nginx syntax with `nginx -t` *before* explicitly starting the Nginx service. Verify the API binds `127.0.0.1:4400` only.
8. Perform read-only public HTTPS smoke checks first: `/`, `/manifest.webmanifest`, `/sw.js`, `/api/v1/push/config` (unauthenticated returns 401), cache headers, permitted TLS. Ensure no media or credentials leak.
9. Have synthetic users **explicitly consent** on installed Android/iPhone PWAs. Test local notification preview separately from genuine background Web Push. Exercise message/inquiry/review triggers with staging-only content. Follow `docs/PWA_PUSH_STAGE3_DEVICE_ACCEPTANCE_2026-11-16.md`.
10. After acceptance, revoke test subscriptions, archive/redact evidence, clean up synthetic users, decide whether to shut staging down and record sign-off. Production rollout is a **different authorization gate**.

## Known stopping conditions

- **No approved hostname/contact:** stop before DNS, certificate requests or any hosting changes.
- **Secrets/template copied into web root:** stop, revoke potentially exposed keys and review incident scope.
- **Unapproved migration:** stop; `prisma migrate deploy` is not a selective migration mechanism.
- **Actual personal data present:** stop and switch to isolated synthetic fixtures.
- **Browser install/permission or device lock-screen behavior not verified:** do not mark Stage 3 or 4 complete as real-device acceptance.

Related records: `docs/PWA_PUSH_STAGE1_LOCAL_ACTIVATION_2026-11-16.md`, `docs/PWA_PUSH_STAGE2_LOCAL_HTTPS_2026-11-16.md`, `docs/PWA_PUSH_STAGE3_DEVICE_ACCEPTANCE_2026-11-16.md`.
