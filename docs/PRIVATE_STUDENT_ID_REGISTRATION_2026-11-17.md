# CPSU Market — Private full name and student ID registration fields

**Date:** 2026-11-17
**Scope:** Owner request to add **Full name** and **Student ID number** alongside Display name, Email, Password and Campus on Create account.
**Status:** **UI + API code prepared and gated OFF. Not collecting real ID numbers.** Requires a distinct database migration and CPSU privacy/retention approval for activation.

## UX and policy

- Create account visibly contains two new labeled fields, with helper text that these are private details, not public display names and not automatic campus verification.
- Both inputs are **disabled** until the server responds with `studentIdentityRequired: true`. If the policy check fails, account creation is paused with a retry instead of silently dropping confidential data. While disabled by policy, the old registration flow still works normally; disabled fields are omitted from the request.
- Full name: 2–120 characters, stored separately from public `displayName`. Student ID number: **string**, 3–48 characters; leading zeros preserved. No CPSU-specific pattern or institution-wide uniqueness is assumed without an approved policy.
- A student number is *not proof of identity or enrollment*. Campus affiliation still enters the existing **pending** reviewer workflow. Email ownership verification and staff MFA stay separate release blockers.
- Sensitive data is **never** returned through `/me`, public listing/store responses, notification payloads or account-create success messages. No ID upload/photo is introduced.

## Private schema candidate (not applied)

- New `StudentIdentity` table: `userId` (1:1 PK/FK to `User`), `fullName`, `studentIdNumber`, `createdAt`. Original `User` and `Affiliation` tables remain unchanged. No pre-existing students are backfilled or blocked.
- Migration: `apps/api/prisma/migrations/20261117230000_private_student_identity/migration.sql`. **UNAPPLIED**. No database migration, restore, import, deployment or credentials change was authorized by the UI request.
- API: `GET /api/v1/auth/registration-policy` returns `{ studentIdentityRequired: false }` by default with `Cache-Control: no-store`. `POST /auth/register` creates the private identity only if the flag is on (nested atomic Prisma user creation).
- Inactive mode rejects explicit identifier fields with `409 student_identity_registration_unavailable` instead of accepting and silently discarding them.
- The runtime switch `STUDENT_ID_COLLECTION_ENABLED` defaults to **false**, and switching it on requires a nonempty `STUDENT_ID_PRIVACY_APPROVAL_REF`. That string is an operator policy control, **not** substitute for a real signed CPSU DPO decision.

## Mandatory activation prerequisites

1. CPSU DPO and student-affairs approve collection necessity, lawful purpose, access restrictions, student ID format/uniqueness across campuses, correction workflow, full-name comparison standard, privacy notice, individual retention/deletion periods and incident response. Include private identifier data in the signed retention schedule.
2. Approve secure access for authorized institutional verifiers only. No broad staff browse or arbitrary search by student ID number without a separate privacy decision. Default public/admin responses never include it.
3. Back up development data privately and verify isolated restoration. Run this candidate migration **only in isolated synthetic database**, preserving all other pending migrations and existing development/production data; inspect actual DDL, foreign keys, Prisma client regeneration and rollback plans.
4. Approve **only the separately tested migration** against the local development database; avoid `prisma migrate deploy` if unrelated migrations remain pending. Regenerate Prisma client with Bun, confirm current running API process is safely stopped or coordinated to avoid Windows DLL locks. No permission to stop running servers was assumed here.
5. After database schema and client are verified, record approval reference and enable flag in the approved environment; retest authenticated registration on synthetic identities and privacy isolation. Activate real-student collection only after separate operational/privacy sign-off.
6. Verify responsive registration at 320px, 390px and desktop, keyboard-only/screen reader, duplicate email, attempts to submit identifiers while disabled, casing/leading zeroes, retries and policy flip, deleted/suspended users, sessions and unauthorized API reads.

## Implemented files

- `apps/web/src/pages-account.tsx` — new form inputs, accessible helper/validation and policy fetch.
- `apps/web/src/auth-field-error.ts`, `apps/web/src/api.ts` — field union and clear privacy-gate error.
- `apps/api/src/routes/auth.ts`, `apps/api/src/env.ts`, `apps/api/src/student-identity-registration.ts` — private conditional persistence, API flag, validation.
- `apps/api/prisma/schema.prisma` and **unapplied** migration SQL — private 1:1 entity.
- `apps/api/test/student-identity-registration.test.ts` — validation and fail-closed API tests.

## Tests and limits

- Prisma `validate`: PASS.
- Focused synthetic API tests: **4 PASS**, no DB writes.
- API TypeScript check: PASS with existing generated client.
- Web TypeScript and Vite build: PASS.
- Prisma client regeneration: **BLOCKED** by Windows `EPERM` locked `query_engine-windows.dll.node` (concurrent Bun process). Do not stop another session or force a rename without separate coordination.
- Local `GET /api/v1/auth/registration-policy` returned `{ studentIdentityRequired: false }`.
- Chrome headless guest registration at `http://127.0.0.1:5173/register`: **PASS**, both new fields rendered with the privacy-gate notice; no registration was submitted.
- Complete local API unit suite: **135 passed, 7 opt-in DB suites skipped, 0 failed**.
- Complete local web test suite: **73 passed, 0 failed**; TypeScript/Vite build passed.
- Targeted Git whitespace check and Graphify refresh: **PASS**.
- Isolated migration rehearsal, activation path, real registration storage and physical device checks: **NOT DONE**.

**Release status:** STILL BLOCKED by staff MFA, email ownership, DPO retention and restore/port acceptance. A displayed registration field does not grant campus eligibility.
