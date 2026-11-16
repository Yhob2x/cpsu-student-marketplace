# CPSU Market — PWA Push Stage 1 Local Database Activation

**Date:** 16 November 2026 (Asia/Manila)  
**Authority:** Explicit project-owner approval for **local development database backup and applying the previously tested PWA Push migration**, not deployment, VAPID key setup, or notification delivery.  
**Device:** `DESKTOP-P5OAG7F` via authorized Remote Desktop Commander.  
**Repository:** `C:\Users\acer\Downloads\cpsu-student-marketplace`  
**Database:** `cpsu_marketplace`, MySQL/MariaDB at `127.0.0.1:3306`, local development only.  
**Result:** **PASS — migration applied and validated.**

## 1. Database safeguards and preflight

- Verified local host and exact `cpsu_marketplace` database identity before migration; refused production context.
- Confirmed five Prisma migration directories; only `20261116094000_pwa_push_notifications` was pending.
- Prisma schema validated successfully.
- Executed `apps/api/scripts/integrity-preflight.ts --audit-only` before migration: 19/19 selected foreign keys present; 0 orphaned references; expected listing discovery index present. No data modifications.

## 2. Retained pre-migration backup — verified

Used existing `apps/api/scripts/create-retained-backup.ts --development-backup`, with the established Windows XAMPP `mysqldump.exe`.

**Private backup location, outside the Git repository:**

```text
C:\Users\acer\AppData\Local\CPSU-Marketplace\backups\2026-11-16T02-27-18-160Z
```

| Backup property | Verification |
|---|---|
| Source database | `cpsu_marketplace` only |
| SQL file | `cpsu_marketplace.sql` |
| SQL size | 175,557 bytes |
| SQL SHA-256 | `becadf6de47a2e71a01122182866177de17e503a4ced30e7bdd330b212bb20f4` |
| Upload files saved | 22 |
| SHA-256 verification | PASS: independent file hash matches manifest |
| Expected SQL table definitions | PASS: `User`, `Notification`, `Listing`, `InquiryMessage`, `_prisma_migrations` |
| Unexpected database switching/creation/deletion SQL | Not found |
| Backup location | Private user-profile directory, not tracked by Git |

**Privacy:** This backup contains real local development data (student records and files). Keep it private; never publish, upload, or commit it. Do not share its SQL contents in chats. Backups should be encrypted and subject to the project's retention policy before a production rollout.

**Restore limitation:** This specific retained backup passed structural, size, checksum, and upload-count checks, **but was not imported into a fresh restore database during this Stage 1 run**. An earlier independent development backup/restore drill passed on 11 November 2026; see `docs/STAGE1_RESTORE_DRILL_REPORT.md`. Check recovery against a disposable local restore environment before relying on this snapshot for recovery.

## 3. Approved migration executed

Executed under an additional guard checking the local database identity and the backup SHA-256 before running `bun run db:deploy`.

Prisma applied exactly:

```text
20261116094000_pwa_push_notifications
```

This additive migration created `PushSubscription` and `PushPreference`, their user foreign keys, and indexes. No existing data tables were replaced or dropped.

## 4. Post-migration verification

- `bunx prisma migrate status`: **Database schema is up to date** (all five migrations applied).
- `bunx prisma validate`: PASS.
- `bunx tsc -p . --noEmit`: PASS.
- Read-only SQL query: new push tables present, each with 0 rows; both user foreign keys present (2); migration recorded finished and not rolled back (1).
- Read-only counts of existing tables after migration (do not imply a pre/post record-by-record comparison): 4 users, 55 notifications, 22 listings, 34 messages.
- Reran integrity preflight: 19/19 selected foreign keys present, 0 orphans.
- `bun run test`: 17 unit tests pass, 2 opt-in integration suites skipped by default.
- `bun run pwa:check`: PASS (PWA manifest, icons and service worker contracts).

## 5. Boundaries and next approval gate

- **No VAPID keys configured**: verified 0/3 VAPID settings in the local `apps/api/.env`, without exposing secrets. Push remains disabled.
- No subscriptions or notification preferences created on behalf of users.
- No real push notifications sent; Android/iPhone testing and HTTPS deployment remain pending.
- No production database connection, migrations, credentials, GitHub push, commits, or deployment.
- Existing unrelated user work and unstaged files preserved.

**Next stage requires separate authorization:** generate/persist a private VAPID key pair locally and then test push permission, subscriptions, and lock-screen behavior in a private HTTPS staging environment with synthetic accounts. Do not proceed with real-student delivery until CPSU privacy and launch approval.
