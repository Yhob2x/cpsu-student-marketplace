# CPSU Student Marketplace & Services

A **single mobile-first web application** for CPSU students, sellers and authorized reviewers. The same React/Vite frontend runs in desktop and mobile browsers and can be added to a phone's home screen as a Progressive Web App (PWA). There is **no separate Expo server or mobile app to start**.

> **Governing specification:** `MASTER_BLUEPRINT.md` remains the approved development baseline. The student-verification method, policies and hosting require CPSU authorization before production release.
>
> **Project rules:** Follow `AGENTS.md` and `CLAUDE.md`; preserve the approved forest-green theme, published data, authentication, permissions and existing application behavior.

| Part | Stack | Location |
|---|---|---|
| Shared mobile + desktop web app / PWA | React, TypeScript, Vite | `apps/web` |
| REST API | Express, TypeScript, Prisma, MySQL, Zod | `apps/api` |
| Historical native prototype (inactive) | React Native, Expo | `legacy/expo-mobile` |

Both mobile and desktop web use **the same origin and `/api/v1`**. There is no `extra.apiUrl` setup, native client authentication, or duplicated frontend to maintain.

## Run locally on Windows (VS Code / PowerShell)

1. Install dependencies once from the repository root: `bun install`.
2. Keep your existing `apps/api/.env` settings. On first setup, copy `apps/api/.env.example` to `apps/api/.env`, then provide your own valid MySQL `DATABASE_URL` and `JWT_SECRET`. Do not reset an existing database or change credentials.
3. Start these two commands in **separate terminals**:

```powershell
# Terminal 1 — backend API (localhost:4000)
bun run api

# Terminal 2 — one web frontend for mobile and desktop (localhost:5173)
bun run web
```

Open **http://localhost:5173/** on the development computer. The Vite dev server proxies requests from `/api` to `http://localhost:4000` so the web app doesn't need a separately configured API address.

For mobile-browser QA on the same trusted Wi-Fi network, run `cd apps/web; bun run dev --host 0.0.0.0` and open `http://<YOUR-PC-LAN-IP>:5173/` on the phone. Keep the API running locally, and allow the dev port in your firewall only for the trusted test network. **PWA installation and service workers require HTTPS (or localhost)**; remote mobile HTTP testing is for browser layout checks only.

## Install on a phone (after HTTPS deployment)

- Android Chrome: open the deployed site and choose **Install app** or **Add to Home screen**.
- iPhone Safari: open the deployed site, use **Share → Add to Home Screen**.

The web app uses the same navigation, saved listings, messages, store dashboard, profile, and reviewer tools on all screen sizes. The PWA offers an **offline connection-required page only**. It does not cache student data, API responses or private messages; those require an internet connection.

## PWA icon and mobile navigation QA

The installable PWA uses the original CPSU Market C-and-sparkle icon in forest green, cream and gold. This is not an official university seal. Android receives separate 192px/512px maskable icons; iPhone uses an Apple touch icon and the short home-screen name **CPSU Market**. Phones have five fixed bottom tabs: Home, Explore, Sell, Messages and Profile.

To regenerate and validate the icons from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-pwa-icons.ps1
bun run pwa:check
```

Chrome browser-emulated installation, icon shape and navigation checks are recorded in `docs/PWA_MOBILE_FINALIZATION_2026-11-12.md`. **Actual Android and iPhone installation remains a required release acceptance test.**

## Test

```powershell
cd apps/web
bun run build
# Back at project root:
cd ../..
bun run test
# Optional: isolated integration test database only
cd apps/api
bun run test:integration
```

Do not deploy without completing `docs/DEVICE_ACCESSIBILITY_ACCEPTANCE_2026-11-12.md`, `docs/PWA_MOBILE_FINALIZATION_2026-11-12.md` and other blueprint approval gates.

## Try the full flow

1. Sign in as a verified seller, open My store, create or edit a listing and submit it for review.
2. Sign in as an authorized reviewer, open Review, inspect the listing and record a decision with a reason.
3. Sign in as a buyer, discover the published listing, save it, send an inquiry and follow the conversation.

Payments, handoffs and confirmations remain arranged directly between students; the marketplace does not process payments.

## Deployment

**Push staging is not deployed.** Dedicated, incomplete HTTPS staging templates live in `infrastructure/staging/`, with a manual approval and isolation runbook. Stage 6 also adds `bun run push:staging:preflight` to audit staging approval evidence, migration selection and a clean, secret-free release candidate; it currently blocks deployment. See `docs/PWA_PUSH_STAGE6_STAGING_PREFLIGHT_2026-11-16.md`. Check the static templates using `bun run push:staging:templates`; check the *separate* public-domain/contact gates using `bun run push:staging:check`. Neither command deploys or sends push messages. See `docs/PWA_PUSH_STAGE4_STAGING_PREPARATION_2026-11-16.md`.

The self-hosted Nginx config in `infrastructure/nginx/marketplace.conf` serves the **single** `apps/web/dist` frontend and proxies `/api` to Express. Serve the PWA over HTTPS, protect API access, keep database backups, and don't cache API responses or authenticated content in the service worker.

**Legacy note:** The former `apps/mobile` directory was moved intact to `legacy/expo-mobile` to preserve unfinished local work. It is not included in workspaces, dependency installation, startup scripts, or active releases. Historical documentation may still mention it; see `docs/UNIFIED_WEB_PWA_2026-11-12.md`.

## Optional mobile lock-screen alerts and badges

The unified CPSU Market PWA supports **opt-in Web Push** for new messages and inquiries, listing-review decisions, and CPSU account verification updates. Students can enable it and choose categories in **Notifications → Phone and desktop alerts**. The mobile Messages tab shows unread-message counts; supported installed PWAs may display an app-icon badge for total unread notifications. Lock-screen alerts never show private message contents or sender names.

**Stage 5 safeguards:** Both `PUSH_SUBSCRIPTIONS_ENABLED=false` and `PUSH_DELIVERY_ENABLED=false` are the default server settings. VAPID keys alone do not enroll devices or send notifications. An approved HTTPS staging setup can activate enrollment first, independently from remote delivery. No environment switches were enabled in the local `.env` file. Details: `docs/PWA_PUSH_STAGE5_RELEASE_SAFETY_2026-11-16.md`.

**Local development status (16 November 2026):** The approved additive push migration is applied to `cpsu_marketplace`. Stage 2 securely stored one persistent VAPID keypair in the Git-ignored `apps/api/.env` with restricted Windows permissions. The VAPID contact is currently `https://localhost:8443/` **for local QA only**, not a monitored contact; replace it before public staging. Do not regenerate the existing keys, expose them to Vite variables, commit them, or use this temporary contact for real students. Browser-emulated HTTPS PWA checks passed; **real lock-screen push delivery has not been tested or enabled for students**.

```powershell
# Synthetic, isolated push migration + API tests (development database untouched):
cd apps/api
bun run test:push:integration
```

### Stage 3 — Device testing readiness

Students who voluntarily enabled alerts can choose **Preview a test alert** on the Notifications page. It requests a local service-worker notification using generic wording. **This is not a genuine background Web Push test** and does not send data to an external push provider.

Run the **read-only** staging readiness check from the project root:

```powershell
bun run push:staging:check
```

It currently reports blocked public-staging gates because the localhost VAPID contact must be replaced by an approved monitored contact and no approved public HTTPS staging URL has been provided. It does not deploy, modify the DB or send alerts. The full Android/iPhone manual checklist is in `docs/PWA_PUSH_STAGE3_DEVICE_ACCEPTANCE_2026-11-16.md`.

Actual lock-screen banners and home-screen badges depend on iOS/Android settings. On iPhone, install the approved HTTPS PWA to Home Screen first. Follow `docs/PWA_PUSH_NOTIFICATIONS_2026-11-16.md` and `docs/PWA_PUSH_STAGE2_LOCAL_HTTPS_2026-11-16.md` for the configuration history and release gates.
