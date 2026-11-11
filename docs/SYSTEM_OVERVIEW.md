# System overview

**Document status:** As-built description of the repository on 11 November 2026, plus the blueprint relationship.
**Authoritative requirements:** `MASTER_BLUEPRINT.md` (v1.0).

## 1. What this repository is

A working modular-monolith pilot for the CPSU Student Marketplace, built before the master blueprint was adopted. It implements the
"proposed architecture" in `docs/architecture.md`. It is **not** an approved CPSU system: policy, verification method and hosting must be
confirmed by CPSU (`docs/architecture.md` §16).

The blueprint and the pilot agree on the product shape (students only, no payments, campus-aware, human review) and disagree on several
data-model details. Every disagreement is listed in `docs/MVP_SCOPE.md` §4 and is treated as **pending owner approval** — no reconciliation
has been implemented.

## 2. Stack as implemented

| Layer | Implementation | Location |
|---|---|---|
| REST API | Node.js, Express 5, TypeScript, Prisma 6, MySQL 8, Zod, Argon2id, JWT | `apps/api` |
| Web (students + admin) | React 18, TypeScript, Vite 6, React Router 6 | `apps/web` |
| Mobile (iOS/Android) | React Native, Expo 52, React Navigation 6, expo-secure-store | `apps/mobile` |
| Review/verification console | Web only, `/admin` route in the same web app | `apps/web/src/pages-admin.tsx` |
| Media | Local filesystem (`UPLOAD_DIR`), path recorded in `ListingMedia` | `apps/api/uploads` |

Planned in the blueprint but **not present**: shared `packages/contracts`, PWA manifest/service worker, email/password-recovery delivery,
push notifications, automated test suite beyond five unit tests.

## 3. Runtime topology

```text
Browser (apps/web)  ──HTTPS──►  Nginx  ──►  Express API :4000  ──►  MySQL 8
Expo app (apps/mobile) ─HTTPS─►          │                     └──►  uploads/ (disk)
Admin browser (same web app, /admin) ────┘
```

- Clients never touch MySQL; all access is through `/api/v1` (`apps/api/src/app.ts`).
- Web sessions: short-lived access JWT (15 min) held in memory + a rotating refresh token in an `httpOnly` cookie scoped to
  `/api/v1/auth`. A second cookie scoped to `/api/v1/media` lets `<img>` tags authenticate (`apps/api/src/auth.ts`).
- Mobile sessions: refresh token in the platform keychain/keystore via `expo-secure-store`; access token in memory. Clients identify
  themselves with `X-Client: mobile` so the API returns tokens in the body instead of cookies (`apps/api/src/routes/auth.ts`).
- Roles are re-read from the database on every request; nothing in the token is trusted (`authenticate` in `apps/api/src/auth.ts`).

## 4. Source layout (actual)

```text
cpsu-student-marketplace/
├── MASTER_BLUEPRINT.md          # approved baseline (this repo's single source of truth)
├── docs/                        # blueprint-required documentation set + pilot design docs
├── progress/                    # implementation status, known issues, development log
├── apps/
│   ├── api/                     # Express + Prisma; prisma/schema.prisma, migrations/, test/
│   ├── web/                     # Vite + React; pages-public / pages-account / pages-admin
│   └── mobile/                  # Expo; App.tsx holds all screens
├── infrastructure/              # nginx, systemd unit, backup script
├── package.json                 # bun workspaces (apps/*)
└── README.md                    # run instructions
```

The blueprint's `src/` tree is represented by `apps/*`; PART XII permits this ("the actual source code directory may differ").

## 5. Existing pilot documents (kept, not superseded)

| File | Purpose |
|---|---|
| `docs/architecture.md` | The pilot's proposed architecture, roles, flows, and the decisions CPSU must confirm (§16). |
| `docs/roles-and-permissions.md` | Terse per-role API capability table as implemented. |
| `docs/campus-policy-rules.md` | Placeholder policy; explains that the rules engine only flags. |
| `docs/privacy-and-retention.md` | Data collected / not collected, and open retention questions. |

These remain valid as design notes. Where they conflict with `MASTER_BLUEPRINT.md`, the blueprint wins for requirements and this
repository's `docs/MVP_SCOPE.md` records the unresolved conflict.

## 6. Current functional state (summary)

Working end to end: registration and login, staff-verified campus affiliation, store opening, product/service listings with photo upload,
submit-for-review, human approval with reason, campus-scoped review, public discovery with search/filter/pagination, saved items, inquiry
threads with polling and a handoff record, reports, per-campus analytics with small-count suppression, and audit rows for privileged actions.

Not built (blueprint-MVP items): purchase requests, transaction records and status history, notification UI, account suspension/reactivation,
category administration, announcements, admin audit-log viewer, listing deletion and sold state, condition field, and sort options.

Exact per-requirement status with evidence: `docs/MVP_SCOPE.md`.
