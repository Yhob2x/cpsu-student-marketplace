# Changelog

Format: date, then added / changed / fixed / docs. Dates are the dates the work was recorded in this repository.

## 2026-11-11 — UI/UX update: navigation, Profile, notification centre

**Added**
- `apps/web/src/pages-profile.tsx`: Profile (identity, affiliation state, account settings with display-name editing, marketplace links) and
  Notifications (unread markers, relative time, mark-all-read, loading skeleton, empty and error states).
- Web header "Alerts" link with an unread count badge fed by the existing `/notifications` endpoint.
- Mobile Home tab (intro, search entry, category chips, recently added, student services) and a `Chip` component shared with Explore.
- Mobile notifications section in Profile with mark-all-read, plus Saved listings as a stack screen.
- `timeAgo()` helper and a `not_found` message in the web API layer.
- Design-system additions: `.page-head`, `.profile-grid`, `.facts`, `.quick`, `.notif`, `.nav-badge`, `label.field`, and status badges for
  `verified`/`approved`/`pending`/`cancelled`.

**Changed**
- Web primary navigation is now the blueprint's five destinations (Home, Explore, Sell, Messages, Profile); `/profile` and `/notifications`
  are signed-in routes.
- Web tab bar spacing reduced so five destinations fit a 360 px screen.
- Mobile tabs are Home, Explore, Messages, Profile; Categories folded into Explore's chips and Saved moved under Profile, per PART VI.
- `Me` type on web now includes `email` (already returned by `/me`) for the Profile page.

**Fixed**
- Notifications were written by the API but had no surface anywhere; the core event types are now readable on both clients (KI-003).
- Web had no Profile destination and mobile had no Home (KI-027, partially).
- **Session loss on hard reload (KI-029).** A signed-in page's mount-time request and the shell's session restore each refreshed the token;
  the API rotates tokens and treats a second use as theft, so it revoked every session and the page showed `unauthenticated`. Web refresh
  is now single-flight, and Saved, Messages and Notifications wait for the restored session before fetching.

**Verified**
- `bunx tsc -p apps/web/tsconfig.json --noEmit` → clean.
- `cd apps/mobile && bunx tsc -p tsconfig.json --noEmit` → clean (dependencies installed at the workspace root).
- `bunx tsc -p apps/api/tsconfig.json --noEmit` → clean; `bun test` → 5 passed.
- `cd apps/web && bun run build` → success, 35 modules, 202 kB JS / 64 kB gzip, 6.98 kB CSS.

**Not changed**
- No API route, Prisma model, migration, or dependency was modified. Admin navigation, transaction UI, and the mobile Sell/Offer composer
  remain open (KI-027, `docs/MVP_SCOPE.md`).

## 2026-11-11 — Documentation baseline

**Added**
- `MASTER_BLUEPRINT.md`: the approved v1.0 blueprint, archived as the single source of truth (RULE 01).
- `docs/SYSTEM_OVERVIEW.md`, `docs/FUNCTIONAL_REQUIREMENTS.md`, `docs/NON_FUNCTIONAL_REQUIREMENTS.md`, `docs/BUSINESS_RULES.md`,
  `docs/USER_ROLES_PERMISSIONS.md`, `docs/DATABASE_DESIGN.md`, `docs/API_DOCUMENTATION.md`, `docs/UI_UX_GUIDELINES.md`,
  `docs/SECURITY_GUIDELINES.md`, `docs/TESTING_STRATEGY.md`, `docs/MVP_SCOPE.md`, `docs/DEVELOPMENT_ROADMAP.md`, `docs/CHANGELOG.md`.
- `progress/IMPLEMENTATION_STATUS.md`, `progress/KNOWN_ISSUES.md`, `progress/DEVELOPMENT_LOG.md`.

**Changed**
- None. No application source, schema, migration, dependency, or configuration was modified in this entry.

**Verified**
- `cd apps/api && bun test` → 5 passed, 0 failed.
- `bunx tsc -p apps/api/tsconfig.json --noEmit` → clean.
- `bunx tsc -p apps/web/tsconfig.json --noEmit` → clean.
- `cd apps/api && bunx prisma migrate status` → 2 migrations applied, schema up to date.
- Mobile typecheck not run: `apps/mobile/node_modules` absent.

**Recorded, not resolved**
- Eight scope conflicts (C1, C1a, C2, C3, C4, C5, C6, C7) in `docs/MVP_SCOPE.md` §4, awaiting owner approval.
- Six missing MVP features (014, 015, 020, 022, plus the missing halves of 016 and 024) and twelve partial ones.

## 2026-11-10 — Pilot implementation (initial)

Reconstructed from migrations `20261110063101_init` and `20261110090354_message_status` and file timestamps.

**Added**
- Express + Prisma + MySQL API: authentication with rotating refresh sessions, campus affiliations, seller stores, product/service listings,
  image uploads, submit-for-review, campus-scoped review with reasons and policy versions, inquiry threads, handoff records, reports,
  notifications, audits, analytics with small-count suppression.
- React + Vite web client: home, explore, listing detail, store page, guidelines, auth, store dashboard, inquiries, saved, review queue.
- Expo mobile client: explore, categories, listing detail, inquiries, saved, profile, auth.
- Nginx, systemd unit, and database+media backup script under `infrastructure/`.
- Pilot design docs: `docs/architecture.md`, `docs/roles-and-permissions.md`, `docs/campus-policy-rules.md`, `docs/privacy-and-retention.md`.
- Five authorization unit tests.
