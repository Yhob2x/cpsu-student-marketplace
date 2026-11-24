# Archived code

Nothing in this folder is part of the active application. The CPSU Student Marketplace now runs as one Laravel + React app in `laravel-project/`.

| Folder | What it was | Archived |
|---|---|---|
| `expo-mobile/` | Expo prototype | 2026-11-12 |
| `express-api/` | Express + Prisma API (`apps/api`) | 2026-11-24 |
| `react-vite-web/` | React + Vite frontend (`apps/web`) | 2026-11-24 |
| `shared/` | Theme and home page defaults shared by the two apps (`apps/shared`) | 2026-11-24 |
| `express-staging/` | Express systemd unit and push staging templates | 2026-11-24 |
| `express-qa-scripts/` | Push staging gates and iPhone LAN tooling written against Express and the Vite preview | 2026-11-24 |
| `express-performance/` | Express load-test harness | 2026-11-24 |

The Laravel version was verified against these sources before archiving: 1,061 identical API responses and database effects, 625 identical screens, and identical compiled CSS. See `docs/LARAVEL_MIGRATION_PHASE6_2026-11-24.md`.

- Not part of any workspace, install or startup command.
- Paths inside these files still refer to their old `apps/` locations and are not maintained.
- Local `.env` files moved with their apps and remain git-ignored. Do not commit them.
- Prisma migration history remains here for reference. Laravel now owns schema changes through `laravel-project/database/migrations`.
