# System overview

**Current architecture (12 November 2026): One responsive web frontend / PWA.**
`MASTER_BLUEPRINT.md` remains authoritative. This is a working pilot, **not an officially approved CPSU production system**.

## Runtime topology

```text
Desktop browser ───┐
Android browser ───┼── HTTPS / same origin ── Nginx ── React/Vite PWA (apps/web)
iPhone Safari ─────┘                         │
                                             └── /api/v1 ── Express API (apps/api) ── MySQL
                                                                        └── private / public media
```

There is **one UI codebase, one set of routes, one authorization model, one API, and one database**. React responsive CSS supplies the mobile and desktop layouts. Buyer, seller, messaging, profile, and campus reviewer screens are all in `apps/web`. The PWA manifest permits adding the web app to supported phone home screens.

## Active source layout

```text
cpsu-student-marketplace/
├── MASTER_BLUEPRINT.md
├── apps/
│   ├── api/                 # Express, Prisma migrations, MySQL and tests
│   └── web/                 # React, Vite, mobile + desktop responsive UX
│       ├── src/             # Pages, shared navigation, API client and design tokens
│       └── public/          # PWA manifest, app icons, offline page, service worker
├── legacy/
│   └── expo-mobile/         # Archive of earlier Expo prototype, not a workspace
├── infrastructure/          # Nginx, API service unit, backups
├── docs/                    # Governance, API contract, QA and history
├── progress/                # Status, issues and development log
└── package.json             # Only apps/api and apps/web are active workspaces
```

## Authentication, data and security

- The web frontend communicates with relative `/api/v1` URLs, so phone and desktop browsers do **not** need a device-specific `extra.apiUrl` setting.
- Existing access tokens remain in memory and rotating refresh sessions use HttpOnly cookies. The API owns authentication, roles, listing moderation and data validation.
- The service worker caches **only** the static offline explanation page and app icon files. It never caches API requests, user-generated pages, private messages, images, session data or authentication responses.
- Offline attempts display a clear connection-required page; the platform does not support offline transactions or submissions.
- PWA service worker registration runs **only in production builds on a secure context**. Local Vite development stays network-only.
- Expo/React Native sources and any local uncommitted edits have been moved intact to `legacy/expo-mobile`. They are **not built, installed, started or deployed**. Native iOS/Android remains a future option subject to separate approval.

## Local development

From the repository root, install dependencies once with `bun install`. Then run `bun run api` and `bun run web` in separate terminals. Open `http://localhost:5173`. For a phone on trusted Wi-Fi, use Vite's `--host 0.0.0.0` option and the PC's LAN IP; PWA installation requires an HTTPS origin.

## Known release gates

- CPSU must approve official verification, student policies, hosting and privacy procedures.
- Real iPhone/Android and VoiceOver/TalkBack testing remain required (`docs/DEVICE_ACCESSIBILITY_ACCEPTANCE_2026-11-12.md`).
- Deployment is not included in this consolidation.

## Historical references

`docs/architecture.md` proposed three frontends (web, iOS Expo, Android Expo). It and earlier implementation records remain in the repository as historical design evidence, not as current operational instructions. The current implementation is documented here, in `README.md`, and in `docs/UNIFIED_WEB_PWA_2026-11-12.md`.
