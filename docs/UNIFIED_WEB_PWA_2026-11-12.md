# Unified Responsive Web / PWA Implementation Report

**Date:** 12 November 2026  
**Project:** CPSU Student Marketplace  
**Scope:** Local Windows project only  
**Blueprint authority:** `MASTER_BLUEPRINT.md`  
**Deployment:** Not performed. Existing production and development database contents are not modified.

## Decision and current architecture

The primary CPSU experience is one React/Vite application in `apps/web`, responsive across desktop, tablets and phones. Seller, buyer, profile, messaging and reviewer routes are shared; there is no separate Android/iOS Expo implementation to build, launch or maintain during the MVP.

```text
Desktop browser / Android Chrome / iPhone Safari (optionally installed PWA)
                     │
           same-origin HTTPS
                     │
        Nginx + apps/web/dist
                     │ /api/v1
                Express API
                     │
                  MySQL
```

## Changes

- Removed the root `mobile` script and replaced the wildcard workspace list with `apps/api` + `apps/web`. There is no `npm run mobile` / `bun run mobile` startup command.
- Moved the previous `apps/mobile` directory intact to `legacy/expo-mobile`, including local edits to `src/App.tsx` and the old Expo config. No mobile source content was discarded. This archive is outside active workspaces.
- Pruned Expo/React Native workspace dependencies from the maintained `bun.lock` and `package-lock.json`.
- Added `apps/web/public/manifest.webmanifest`, 192/512px PNG icons, an Apple touch icon, an explicit offline page, and `sw.js`.
- Registered the service worker only from production builds under secure contexts. Vite development is unaffected.
- The service worker only caches `/offline.html` and two static icons; it does **not** cache `/api`, HTML from authenticated navigations, messages, personal data, media or session responses. All full navigation requests use network-first with `cache: 'no-store'`.
- Enabled the same-origin API proxy in Vite production preview (port 4173). Production Nginx was updated to prevent stale manifest and service-worker scripts.
- Removed obsolete Expo web port 8081 from the API's *development-only* CORS exceptions; configured `CORS_ORIGINS` remains the source of truth.
- Updated current startup instructions, technical overview, historical architecture disclaimer, security/testing references, known issues and changelog.

## Start the unified app locally

From the project root:

```powershell
bun install
# Terminal 1
bun run api
# Terminal 2
bun run web
```

Open `http://localhost:5173/`. This is the **same frontend** used on Android Chrome and iPhone Safari, with responsive styles. For testing from a phone on a trusted LAN use `cd apps/web; bun run dev --host 0.0.0.0` and your PC's LAN IP. HTTPS is required for the service worker/home-screen installation on a remote phone.

## Technical validation and evidence

- Root scripts: API, web, migrate, seed, test, and no-dependency `pwa:check`. Still no separate mobile startup.
- Active workspaces: only `apps/api` and `apps/web`. Both maintained lockfiles have no Expo workspace or Expo package entries.
- Production web TypeScript + Vite build passed.
- API TypeScript passed using `bunx tsc -p . --noEmit` (Prisma generation was avoided because the running API locks the existing Windows DLL).
- API unit suite passed (5/5).
- Preview HTTP checks returned 200 for root, manifest, service worker, offline page, both PNG icons and same-origin `/api/v1/listings`.
- PWA mobile finalization: refined forest-green C + gold-sparkle icon, SVG master, reproducible generator, 192/512px normal and maskable PNGs, Apple 180px icon, and short home-screen label `CPSU Market`.
- All icon dimensions and Android maskable safe-area bounds verified. The manifest has Explore, Sell and Messages shortcuts; `bun run pwa:check` passes.
- Chrome CDP `Page.getAppManifest`: no manifest errors. `Page.getInstallabilityErrors`: empty list.
- Installed service worker: active and controlling the page.
- Responsive production-preview checks at 320, 360, 390, 768, 1024 and 1440px: no horizontal overflow; 20 listing cards rendered at each width; the independent Save-heart target remained 44px; the five-destination bottom tab bar appeared at mobile/tablet widths and was hidden on desktop.
- Cache inspection after icon refresh: `/offline.html` and the five static launcher icons only (cache v2); no `/api` entries.
- Actual offline fallback was tested by stopping only the local production preview server and navigating while the PWA was controlled. It rendered `You're offline` with a retry link and no private data. Preview was then restarted successfully.
- No deployment, GitHub push, commit, credentials change, database schema change or production migration was performed.

## Limitations and pending acceptance

- Browser and installability emulation is **not** real iPhone/Android home-screen installation. See `docs/PWA_MOBILE_FINALIZATION_2026-11-12.md` for the Android/iOS human acceptance checklist and browser-based navigation evidence.
- Physical iPhone Safari, Android Chrome, VoiceOver and TalkBack approval remain pending in `docs/DEVICE_ACCESSIBILITY_ACCEPTANCE_2026-11-12.md`.
- Offline content is intentionally limited to a connection-required page. Searching, listing actions and messaging require live connectivity.
- The historical native source is archived but not an active native binary; future native development requires a separate explicit design/approval decision.
- Existing CPSU institutional verification, privacy, and production launch gates remain in force.

**Conclusion:** One responsive web/PWA frontend replaces the dual web/Expo development workflow locally. Release readiness remains subject to physical-device acceptance and CPSU approval.
