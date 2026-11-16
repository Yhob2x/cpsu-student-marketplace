# Stage 4 — Push HTTPS staging deployment preparation

**Date:** 16 November 2026 (Asia/Manila)  
**Project:** CPSU Student Marketplace · one React/Vite PWA + Express/Bun + Prisma/MySQL  
**Machine:** authorized Windows desktop `DESKTOP-P5OAG7F`  
**Status:** **STAGING PACKAGE PREPARED LOCALLY — NOT DEPLOYED; NO DEVICE ACCEPTANCE.**

## Objectives and approved boundary

The project owner requested continuation after Stage 3 device-readiness preparation. Stage 4 prepared a **separate staging-only deployment package** so a future approved HTTPS instance can support real Android/iPhone Web Push testing. The owner did **not** supply a domain, contact address, host credentials or authorization to perform public deployment. No DNS, VPS, Nginx installation, production DB, real student accounts or browser push service was touched.

## Inspected source architecture

- Existing `infrastructure/nginx/marketplace.conf` is an unactivated general production example using a placeholder domain.
- Existing `infrastructure/deploy/cpsu-marketplace-api.service` uses `/usr/bin/node dist/index.js`, while the current API build script uses Bun as its target. This should receive a separate production deployment review; **Stage 4 did not edit the existing unit**.
- `apps/api/src/index.ts` previously listened on `env.PORT` without an explicit host. Stage 4 added a configurable `BIND_HOST` so **staging** can listen on `127.0.0.1`; default `0.0.0.0` preserves the current development network behavior.
- Existing `docs/PWA_PUSH_STAGE3_DEVICE_ACCEPTANCE_2026-11-16.md` and `scripts/check-push-staging.mjs` document public staging blockers, physical-device testing and VAPID readiness.

## Implemented, source-only

| File | Purpose |
|---|---|
| `infrastructure/staging/nginx.conf.template` | HTTPS Nginx staging virtual host, correct cache policies, no indexing, hidden-file blocking and API proxy to loopback-only port 4400; **unresolved placeholders** |
| `infrastructure/staging/cpsu-marketplace-staging-api.service.template` | Bun-based, dedicated staging Linux service under restricted OS identity, writable-media confinement and private `EnvironmentFile` |
| `infrastructure/staging/staging.env.example` | Placeholders for staging-only DB, JWT, VAPID and CORS; `COOKIE_SECURE=true`, `BIND_HOST=127.0.0.1`, `NODE_ENV=production` |
| `infrastructure/staging/README.md` | Manual approval, staging isolation, migration review, trusted TLS, deployment, safe device testing and rollback/cleanup workflow |
| `apps/api/src/env.ts`, `apps/api/src/index.ts` | API bind-host configuration without altering the default for existing development users |
| `apps/api/.env.example` | Documents the bind setting; **did not modify the real `.env`** |
| `scripts/validate-push-staging-templates.mjs` | Offline safety validator for staging placeholders, Bun runtime, isolated database, loopback bind and non-caching; no credentials read |
| Root `package.json` | Adds `bun run push:staging:templates` |

## Verification evidence

- `bun run push:staging:templates`: **15/15 checks PASS**. During implementation a mistyped escaped Nginx hidden-file regex was identified by this validator and corrected before completion.
- `cd apps/web; bun run build`: PASS. `bun run test`: 17 unit tests pass; 2 opt-in integration suites skipped by default. `bun run pwa:check`: PASS.
- **Concurrent code change observed:** The first `cd apps/api; bunx tsc -p . --noEmit` run reported three WP3 transaction-route errors at lines 68–69. Following a separate concurrent local commit, `461f922`, a fresh API TypeScript check **passed (exit 0)**. Stage 4 did not edit the WP3 route to fix those errors. The build may still require further real staging/server acceptance; a local TypeScript pass is not production approval.
- **Separate Git activity:** Commit `461f922` appeared during this task and includes staging assets, WP3 work and Graphify-generated files. It was **not created or pushed by this assistant**. Preserve that commit and review its scope before any future GitHub push; other users' staged changes were not reset.
- Source templates contain **no real private keys, JWT values, DB credentials, approved domain or contact**.
- Existing production Nginx/systemd templates were **not edited**.
- The public readiness check `bun run push:staging:check` remains appropriately blocked on the two known requirements: the localhost-only VAPID subject and missing approved HTTPS staging URL.
- **No staging server was started**, Nginx was not installed locally, no config was applied, and phone notifications were not tested.
- Concurrent WP3 transaction changes and other uncommitted work were preserved. Stage 3's isolated integration run previously applied a WP3 migration only to the push **test** schema; this is why every migration requires explicit staging approval.

## Remaining external gates

1. Approved HTTPS **staging domain** and hosting operator, with confirmed domain ownership and legitimate TLS certificate.
2. Approved, actively monitored VAPID contact; the existing `https://localhost:8443/` value remains for local development only.
3. Independently isolated staging database, secrets, users and uploaded files; verified backup/recovery and no import of private student data.
4. Review all pending Prisma migrations, especially concurrent WP3 work, **before** any staging migration command.
5. Explicit approval to render/configure/install/run staging services. Validate Nginx and systemd as configured on the real host.
6. Physical Android Chrome and iPhone Safari installation, push permission and **genuine remote background delivery**, lock-screen banners, icon badges, taps and privacy behaviors, using synthetic consenting testers.
7. Separate production release approval and CPSU privacy/retention assessment.

**Current release decision: BLOCKED.** The staging artifacts are local preparation, not a deployed site or proof of real background push. No GitHub commit/push, public deployment, development/production database migration, or notification to a real user was performed by this Stage 4 task.
