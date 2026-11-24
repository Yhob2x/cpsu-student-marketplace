# CPSU Market — Optional private Google Drive listing photo storage
Date: 2026-11-16

## Status
Implemented as an OPT-IN backend. **Connected and verified against real Google Drive using synthetic files. New listing photo uploads are enabled in the operator's LOCAL DEVELOPMENT `.env` (`MEDIA_STORAGE=google_drive`) as of 2026-11-16.**
The checked-in application's default remains `MEDIA_STORAGE=local` for new installations.
**Existing marketplace media has NOT been migrated.** Existing local listing images continue to resolve from `UPLOAD_DIR`.
Any migration of existing database media references requires a fresh approved backup, coordination to pause live uploads and independent verification.
No schema migration is required: `ListingMedia.mediaPath` can contain an opaque
`gdrive:<file ID>` reference for new Drive-backed images; original filenames still
resolve from `UPLOAD_DIR`. The web/PWA URLs remain `/api/v1/media/:id`.

Scope: **listing photographs**. Chat messages do not currently have upload attachments.
This change does not add student ID uploads, account photo uploads, or automatic NSFW detection.

## Security architecture

1. Seller must pass existing authentication, listing ownership/state, 5-photo quota. The browser permits selecting up to the remaining slots in one operation and sends one file per authenticated request in sequence; failed later uploads do not undo earlier successful images.
2. Incoming images are staged locally (3MB maximum), checked with Sharp against declared
   MIME type, decoded, converted to stripped WebP (2400px max), and originals deleted.
3. If `MEDIA_STORAGE=google_drive`, the sanitized WebP is uploaded using a backend-only
   Google OAuth refresh grant. The Google API must confirm size and MD5 checksum.
4. The database stores `gdrive:<file ID>`; the sanitized local intermediary is removed.
5. Browser requests still go through `/api/v1/media/:id`. The Express API decides whether
   a photo is published or accessible to an authorized seller/reviewer, then proxies
   private Drive content. Drive file IDs, URLs, and credentials never appear in public API data.
6. Failed database writes trigger best-effort Drive cleanup. If cleanup fails, a generic
   server log entry records the issue without revealing credentials.
7. Soft-deleted listings retain media under existing retention policy; DO NOT activate
   automatic Drive file purging until CPSU approves a retention schedule.

Do not give the Drive folder public link access. Do not use Google Drive's direct
sharing/view URLs in the website. Google Drive is a document store, not an image CDN:
higher latency, API rate limits, service availability and shared storage quota apply.

## Owner setup — performed ON THE PRIVATE DEVELOPMENT PC

1. Go to https://console.cloud.google.com/ and create/select a project under an account
   designated for CPSU Market operations. Enable **Google Drive API**.
2. Configure **Google Auth Platform / OAuth consent screen** and create an **OAuth client
   ID of type Desktop app**. Use the narrow `drive.file` scope only. Add the operator's
   account as a test user if applicable. An External app in Testing normally gets refresh
   tokens that expire after 7 days for Drive scope; plan for production app verification
   and an approved owner before a persistent deployment.
3. In `apps/api/.env` on the API server, add:
   ```dotenv
   MEDIA_STORAGE="local"
   GOOGLE_DRIVE_CLIENT_ID="your-desktop-oauth-client-id"
   GOOGLE_DRIVE_CLIENT_SECRET="your-desktop-oauth-client-secret"
   ```
   Never send the actual secrets into chat, put them in apps/web, or commit .env.
4. In **one PowerShell window** run:
   ```powershell
   cd C:\Users\acer\Downloads\cpsu-student-marketplace\apps\api
   bun scripts/google-drive-authorize.ts
   ```
   Open the Google authorization URL in the LOCAL browser on that same PC and grant
   `drive.file`. The callback is limited to 127.0.0.1. Privately copy the emitted
   `GOOGLE_DRIVE_REFRESH_TOKEN` into `apps/api/.env`.
5. Prefer `bun scripts/google-drive-setup.ts` to create an app-owned PRIVATE folder.
   Add its `GOOGLE_DRIVE_FOLDER_ID` to `apps/api/.env`.
   `drive.file` grants access to app-created/selected files, not all of My Drive.
   The operator's chosen existing folder was tested on 2026-11-16: a synthetic photo upload,
   retrieval and cleanup all succeeded using the configured OAuth grant. Do not replace
   this folder unless explicitly switching storage.
6. Verify that a backup of **both** MySQL and `apps/api/uploads` has been made and
   restored in a separate test environment. Pause live seller uploads during migration.
7. Dry-run the migration (read-only):
   ```powershell
   bun scripts/migrate-media-to-google-drive.ts
   ```
   Investigate missing local media, invalid names, or unexpected file types.
8. Verify a **synthetic** Google Drive upload/read/delete (real Google endpoints):
   `bun --env-file=.env scripts/google-drive-smoke-test.ts`.
   2026-11-16 result: **PASS** upload, byte-for-byte download, cleanup; no real student
   media uploaded. Unit tests use mocks and do not access Google.
   Isolated end-to-end acceptance also **PASSED** on 2026-11-16 using an entirely new disposable MySQL schema (`scripts/google-drive-real-http-runner.ts`): actual seller upload, private owner/reviewer read, unauthorized 404, mandatory reviewer attestation, published guest photo, original cleanup. The first test timed out due to a 5-second test harness limit; the corrected 45-second run passed. The exact-match interrupted synthetic orphan was independently identified and removed; no other Drive files were modified.
9. After the backup and tests, migrate actual database references with explicit flags:
   ```powershell
   bun scripts/migrate-media-to-google-drive.ts --execute --backup-confirmed --uploads-paused-confirmed
   ```
   Check listing pictures on both owner/moderator and published guest views. The migration
   never deletes local originals; keep them as a rollback copy until restoration tests pass.
10. For an approved **development-only trial of new photos**, change `MEDIA_STORAGE="google_drive"` and restart API. Completed on 2026-11-16; API health was HTTP 200 after restart. This controls **new** uploads only. Previously stored local files continue to serve through the same API. Full existing-media migration is a separate, unexecuted step. Existing `gdrive:` paths remain readable in local mode as long as Drive credentials remain configured.
11. Do not delete a Drive account, folder or OAuth grant without first restoring image
    data to another supported medium. Back up Google content independently; MySQL backups
    do not contain the image bytes.

## Commands and verification
```powershell
cd C:\Users\acer\Downloads\cpsu-student-marketplace\apps\api
bun test test/google-drive-storage.test.ts test/upload-security.test.ts
bunx tsc -p . --noEmit
```

## Rollback
For **new** uploads: set `MEDIA_STORAGE=local` and restart API. It does not relocate
already uploaded Drive-backed images. Do not unset Drive credentials while any
`gdrive:` database paths remain. Existing originals from migration are left intact
so a separate, verified restore can switch those database pointers back if required.

## Outstanding production gates
- Authorized university data protection / institutional approval, processor and
  cross-border data handling, privacy notice, retention and disposal policies.
- OAuth, synthetic Google API, and authorized app image-route end-to-end testing **passed on 2026-11-16** in an isolated database; remaining: production storage quota/cost/throughput planning,
  documented account recovery and token rotation, backups including image bytes.
- Existing pre-hardening files are **not** automatically cleaned by migration;
  metadata/privacy and content review remain separate remediation work.
- Human photo review remains mandatory. This implementation does not claim to detect
  explicit or otherwise prohibited images automatically.
