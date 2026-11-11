# CPSU Student Marketplace & Services

Working MVP of the proposed architecture in `docs/architecture.md` (v1.0, 10 Nov 2026). Not an approved CPSU system: policies, verification method and hosting
must be confirmed by CPSU first (architecture section 16).

> **Governing specification:** `MASTER_BLUEPRINT.md` (v1.0) is the single source of truth for scope, rules and MVP boundaries.
> Where this README or the pilot documents disagree with it, the blueprint wins. Current status against its MVP checklist, and the
> decisions it raises, are tracked in `docs/MVP_SCOPE.md` and `progress/IMPLEMENTATION_STATUS.md`.
>
> **Agent instructions:** `CLAUDE.md` holds the development governance (required reading, document authority, MVP protection, and the
> inspect → analyze → plan → implement → test → document → report procedure). `AGENTS.md` holds the agent rules (first action, security
> and authorization, database handling, multi-agent safety, completion reporting). Both defer to `MASTER_BLUEPRINT.md`.

| Part | Stack | Where |
|---|---|---|
| REST API | Node.js, Express 5, TypeScript, Prisma, MySQL 8, Zod | `apps/api` |
| Web (shoppers, sellers, reviewers) | React, TypeScript, Vite | `apps/web` |
| iOS and Android | React Native, Expo | `apps/mobile` |

## Run it locally
```bash
npm install
cp apps/api/.env.example apps/api/.env      # set DATABASE_URL and a 32+ character JWT_SECRET
npm -w apps/api run db:migrate -- --name init
npm run db:seed                              # dev campuses, categories, demo accounts (refuses in production)
npm run api        # http://localhost:4000
npm run web        # http://localhost:5173 (proxies /api)
npm run mobile     # Expo; set extra.apiUrl in apps/mobile/app.json
npm test
```
Demo accounts after seeding (password `DevPassword!123`): `seller@`, `buyer@`, `reviewer@`, `admin@` + `dev.test`. The reviewer and admin are for the Cauayan campus.

## Try the full flow
1. Sign in as seller, open My store, create a store, add a listing with a photo, Submit for review.
2. Sign in as reviewer, open Review, read the flags, approve with a reason.
3. Sign in as buyer, find the listing in Discover, send an inquiry. The seller sees it under Inquiries.

## What is in v1 and what is not
In: registration with staff-verified affiliation, stores, product and service listings with photos, campus filters and search, flag-then-human review with
audit log and notifications, inquiry threads and handoff records, reports, saved items, campus analytics with small-count suppression.
Deferred per the architecture: payments, couriers, real-time chat, push or email notifications, ratings, establishment directory, block-user control,
shared `packages/contracts`, appeals UI, mobile listing creation (use the web dashboard), mobile admin.

## Deploy (Ubuntu VPS)
`infrastructure/nginx/marketplace.conf`, `infrastructure/deploy/cpsu-marketplace-api.service`, and `infrastructure/backup/backup.sh` (database **and** photos).
Set `NODE_ENV=production`, `COOKIE_SECURE=true`, and keep MySQL off public interfaces.
