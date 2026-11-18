# CPSU Market — Institutional Staging Hosting Proposal

**Prepared:** 18 November 2026 (Asia/Manila)
**Status:** **PROPOSAL ONLY — NO HOSTING, DOMAIN, PRIVACY OR RELEASE AUTHORIZATION YET**
**Project:** CPSU Student Marketplace web application and installable PWA
**Prepared for review by:** CPSU ICT/IT office, project supervisor/owner, authorized hosting/deployment approver and Data Privacy Officer (DPO)
**Existing reference:** `docs/P1_AUTHENTICATED_E2E_ACCEPTANCE_2026-11-18.md`, `docs/P1_STAGING_RELEASE_GATE_RECHECK_2026-11-18.md`, `infrastructure/staging/README.md`

## Decision requested

Authorize **planning for a nonproduction, test-only HTTPS staging environment** so CPSU Market can complete authenticated, physical iPhone/Android PWA acceptance. This request does **not** ask to launch production, collect actual student IDs, enroll users in push, deliver real Web Push, purchase hosting, or apply database migrations.

CPSU's ICT office should decide who controls the staging server, approved public HTTPS hostname, service monitoring, incident contact and credentials. The project owner should separately obtain the DPO's privacy and retention rules and a documented decision for every current Prisma migration. Until these are recorded, source-only preparation and local synthetic tests may continue, but external deployment remains blocked.

## Options evaluated

| Option | Description | Advantages | Constraints / decision |
|---|---|---|---|
| **A — Preferred: CPSU-managed staging VM** | CPSU ICT provides or allocates a dedicated nonproduction VM under university administration and an approved DNS subdomain | University-controlled access, oversight, lifecycle and institutional identity; no separate third-party hosting procurement if capacity exists | ICT must confirm capacity, DNS, network, ownership, maintenance, external HTTPS and backup responsibilities |
| **B — CPSU-authorized external VPS** | ICT/procurement approves an external Ubuntu VPS with a CPSU-approved hostname and documented contract | Independent capacity and clear network separation from university production systems; practical when no campus VM exists | Written procurement/hosting approval, contractual privacy review, recurring fees, university-administered credentials and named operator |
| **C — Local/LAN-only development** | Continue on authorized local Windows development machine with isolated synthetic test database | No new infrastructure expense, enough for code/API/desktop browser checks | Does **not** satisfy approved public HTTPS staging, remote accessibility or real iOS/Android background Web Push acceptance; retain as fallback, not release evidence |

**Recommendation:** Request option A from CPSU ICT first. If it is unavailable or unsuitable, submit option B for formal procurement and security/privacy approval. Do not provision any option from this document alone.

## Proposed nonproduction baseline (subject to ICT sizing)

- One isolated **Ubuntu LTS** instance, initial planning envelope **2 vCPU / 4 GiB RAM / 40–80 GiB SSD**, to be adjusted after measured concurrency, log and upload needs. This is not a performance guarantee or a commercial price quote.
- **Nginx:** dedicated approved HTTPS hostname, static Vite/React build, same-origin API proxy, HTTP-to-HTTPS redirect, appropriate security headers, no indexing or caching of private APIs. Public inbound HTTPS 443; HTTP 80 only for redirect/certificate process if IT approves.
- **Bun API:** existing Express/Prisma application on `127.0.0.1:4400`, supervised by systemd as an unprivileged staging-only OS account. Never expose port 4400 directly.
- **MariaDB/MySQL:** compatible version confirmed against the project's tested Prisma schema, separate `cpsu_marketplace_staging` database with a least-privilege staging-only account; bind to localhost/private interface, never publicly expose port 3306.
- **Private media:** staging-only local upload storage with permissions, quotas and retention; do not copy real user uploads, production databases, or private student identity data.
- **Secrets:** separate staging JWT secret, DB credentials, and eventually a DPO-approved VAPID identity, stored outside the repository and public web root. Existing `.env` and keypairs are not to be exported or pasted into reports.
- **Security:** `NODE_ENV=production` for production-like controls, `COOKIE_SECURE=true`, `BIND_HOST=127.0.0.1`, exact `CORS_ORIGINS` for the approved HTTPS hostname; no wildcard origins. Limit SSH to authorized administrative access, log administrative changes and monitor patching.
- **Safe initial flags:** `STUDENT_ID_COLLECTION_ENABLED=false`, `PUSH_SUBSCRIPTIONS_ENABLED=false`, `PUSH_DELIVERY_ENABLED=false`. These are independent policy gates; no enrollment/delivery activation is requested.
- **Backups:** approved encrypted backups stored separately from the active VM, restricted access, a documented restoration rehearsal, retention period and tested deletion procedure. Responsible operator and budget to be assigned by ICT/DPO.
- **Monitoring:** TLS expiry, host disk/memory, API health, server errors and failed/stale push attempts **only after push is approved**, without logging credentials, full push endpoints or private conversations.

The installed codebase already provides **inert staging templates** at `infrastructure/staging/nginx.conf.template`, `cpsu-marketplace-staging-api.service.template`, and `staging.env.example`. They deliberately contain placeholders and must not be copied as ready-to-deploy configuration.

## Proposed stages and acceptance gates

**Stage 0 — Governance and source freeze (current):**
- Name the CPSU authority, hosting operator and backup owner; obtain DNS/hosting permission and DPO approval.
- Identify testers and use synthetic accounts only. Agree on permitted test data, logs, deletion/retention and consent language.
- Choose A or B and document the approved hostname. Real DNS should be allocated by ICT, not invented by the development team.
- Reconcile the mixed worktree into a reviewed release source snapshot. Review all **12** current migrations, including `20261117230000_private_student_identity`, and record explicit staging-schema approvals.
- Keep both push switches OFF. No service is deployed during Stage 0.

**Stage 1 — Approved HTTPS staging host (requires separate implementation approval):**
- Provision isolated host and database, staging-only OS/database credentials, TLS certificate and backup/restore rehearsal. Never import the development or real student database.
- Validate configuration and migrations on the dedicated staging database. Do not run generic `prisma migrate deploy` before every pending migration is explicitly approved, since it applies all unapplied migrations.
- Build Bun API and Vite web assets from the approved release snapshot. Test HTTPS origin, install metadata, browser auth/session, Nginx access logs, API loopback isolation, cache headers and production-only security settings.
- **Do not enable push enrollment or delivery in Stage 1.**

**Stage 2 — Authenticated physical-device PWA UX acceptance (requires available real phones):**
- On a consenting tester's **physical iPhone Safari**, add the approved HTTPS site to Home Screen and open the installed standalone app; verify login, bottom nav, 200% text, VoiceOver, keyboard, safe areas, offline fallback and reconnect.
- On a **physical Android Chrome** device, install the PWA, repeat the tests with TalkBack and Android notification/permission settings.
- Test guest browsing, student follow/unfollow, seller storefront, campus reviewer scoping, university admin publication, messaging and transaction flow using synthetic accounts.
- Record device model, OS/browser version, test date, case result, screenshots and defects. A desktop emulated mobile viewport is not a physical device result.

**Stage 3 — Consented notification enrollment (separate CPSU/DPO decision):**
- With staging HTTPS, real devices and explicit consent, request approval to turn on `PUSH_SUBSCRIPTIONS_ENABLED` **only**. Confirm permission refusal has a usable fallback, account switching removes device ownership and privacy/retention behavior is auditable.
- Keep `PUSH_DELIVERY_ENABLED=false`. A local `showNotification` preview is not genuine remote delivery.

**Stage 4 — Background Web Push acceptance (another separate CPSU decision):**
- With independently approved relay delivery, set `PUSH_DELIVERY_ENABLED` for test-only staging users. From a second synthetic account, trigger an accepted event while the first device is backgrounded or locked.
- Verify remote delivery, generic lock-screen text with no identifying details, deep-link routing, badge counts where supported, disable/opt-out behavior, logout cleanup, stale subscription removal, network errors and recoverability.
- Restore both switches OFF after testing unless a later release decision explicitly permits them to remain enabled.

**Stage 5 — Release signoff:** ICT, DPO, project reviewer and designated deployment approver review staging evidence, outstanding defects and approved migration set. Production launch is an entirely separate approval and deployment.

## Migration-control warning

The latest local source scan found **12 migration folders**:
`20261110063101_init`, `20261110090354_message_status`,
`20261111160700_stage1_integrity`, `20261111161500_wp2_listing_states`,
`20261116094000_pwa_push_notifications`, `20261116193000_wp3_transactions`,
`20261116220000_managed_student_content`,
`20261116221000_pending_announcement_edits`,
`20261117123000_seller_avatar_review`, `20261117180000_store_follows`,
`20261117230000_private_student_identity`,
`20261118120000_managed_home_page_content`.
The current Stage 6 preflight reports **4/16 passed, 12 blocked** because the tracked example profile intentionally contains no institutional approvals. Neither the user's chat approval nor the successful isolated local tests authorize this staging migration inventory.

## Decisions for ICT / CPSU authorities (unfilled until verified)

| Decision | Responsible authority / evidence |
|---|---|
| Staging model: CPSU-managed VM (A) or approved external VPS (B) | Pending ICT/procurement decision |
| Approved hostname / owner of DNS changes | Pending CPSU ICT |
| Host operator, staging account access and incident response contact | Pending ICT designation |
| Staging deployment approval reference | Pending authorized CPSU decision |
| DPO/privacy approval for synthetic testers, cookie/notification consent and data retention | Pending DPO |
| Encrypted backup retention, restoration evidence and deletion date | Pending ICT/DPO |
| Review/approval of each of 12 migrations and release source snapshot | Pending authorized technical reviewer |
| Real iPhone and Android testers/devices and acceptance records | Pending tester coordination |
| Web Push enrollment approval | **Not requested yet** |
| Remote Web Push delivery approval | **Not requested yet; separate decision** |

## Ready-to-forward CPSU ICT request

**Subject: Request for Nonproduction HTTPS Staging Hosting — CPSU Student Marketplace**

Good day,

We would like to request an assessment of available university-managed hosting for a **nonproduction HTTPS staging environment** for the CPSU Student Marketplace web application and Progressive Web App (PWA).

The project currently runs locally and has passed authenticated synthetic-user API and browser acceptance testing. However, physical iPhone/Android installation, browser accessibility and background-notification verification require a properly authorized HTTPS staging environment.

Our preferred option is an isolated CPSU-managed Ubuntu virtual server with an ICT-approved staging subdomain. An externally hosted VPS would be considered only if university hosting is unavailable and after ICT, procurement and privacy approval. The requested server would use a separate nonproduction database and synthetic accounts only, with Web Push subscription enrollment and remote delivery **disabled by default**.

May the ICT office advise whether a suitable staging server and subdomain can be allocated, who the hosting/operator approver will be, and what security, privacy and infrastructure documentation is required before any deployment?

This request is for **staging feasibility and institutional approval**, not production launch or Web Push activation.

Thank you.

## Relevant technical references

- Apple documentation: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- WebKit guidance: https://webkit.org/blog/13878/
- MDN PWA installation: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- Local acceptance record: `docs/P1_AUTHENTICATED_E2E_ACCEPTANCE_2026-11-18.md`
- Release preflight: `bun run push:staging:preflight`
- Physical-device procedure: `docs/PWA_PUSH_STAGE3_DEVICE_ACCEPTANCE_2026-11-16.md`

**Safety statement:** This proposal is documentation only. No hosting, DNS, TLS, staging schema, migrations, deployment, user records, notification subscriptions, push delivery, commits or pushes are authorized or performed by preparing it.
