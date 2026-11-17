# CPSU Market — Isolated iPhone QA migration and synthetic fixture acceptance

**Date:** 2026-11-17  
**Status:** **PASS: isolated schema upgraded, two synthetic accounts + one listing created, HTTP smoke verified. Physical iPhone Safari pending.**

## Exact scope and preservation

- Target: local `127.0.0.1:3306/cpsu_marketplace_push_test` **only**. The development schema `cpsu_marketplace` is used solely to derive an already-authorized local connection and is not migrated or written.
- Current `schema.prisma` and `20261117123000_seller_avatar_review/migration.sql` **both require only `avatarPath`**. Earlier notes mentioning `pendingAvatarPath` reflected another in-progress source revision; no edit to either owner/other-agent file was necessary.
- The three reviewed additive migrations, applied in sequence only to the isolated QA schema:
  1. `20261116220000_managed_student_content`
  2. `20261116221000_pending_announcement_edits`
  3. `20261117123000_seller_avatar_review`
- The preexisting active Cauayan campus row, id `9`, was preserved unchanged.

## Private pre-migration backup — completed before DDL

- Retained in the Windows **owner-only** ACL folder `%LOCALAPPDATA%\CPSU-Marketplace\iphone-lan-https\iphone-schema-pre-migrate-e5ECUS\`
- Filename: `cpsu_marketplace_push_test.sql`
- Size: **31,971 bytes**; 24 original tables and six original completed migration records
- SHA-256: `7b20e8b56a6879619859422291c5f2dc0c7799f12803a0c64d80ca103d20ac74`
- `manifest.json` contains checksum, source identity, pre-change table row counts, completed migration names and the three reviewed SQL source hashes.
- Verified with independent Windows `Get-FileHash`. SQL file ACL permits only owner `acer`, SYSTEM and Administrators. Backup retained; **not a production backup and no restoration performed**.

## Isolated schema acceptance — passed

- `bun scripts/iphone-qa-migration.ts --backup`: exit **0**, snapshot/manifest/hash validated.
- `bun scripts/iphone-qa-migration.ts --migrate <verified backup folder>`: exit **0**, verified Prisma target identity, expected pending chain, unchanged SQL hashes, and completed migration ledger.
- Post-migration: **26 tables; nine completed migrations**. Seller avatar column present, managed content and announcements tables present.
- Preserved Cauayan campus `1` row; pre-fixture `User=0`, `Listing=0`; no destructive resets.
- Guarded read-only inventory `bun scripts/wp3-iphone-qa-readonly.ts --read-only` passed **READY** after fixture creation.

## Approved synthetic Safari fixtures — passed

- `apps/api/test/iphone-safari-qa-fixture.ts prepare`: created exactly **two synthetic students** (buyer and seller, with verified test-campus affiliation), **one** approved synthetic seller profile, **one** published synthetic textbook listing **ID 9**, and **one** test-only category.
- Credentials: two separate randomly generated high-entropy passwords, saved **only** in `%LOCALAPPDATA%\CPSU-Marketplace\iphone-lan-https\CPSU-iPhone-Safari-QA-credentials.json`; never logged or committed. Windows ACL confirmed owner/SYSTEM/Administrators only. Open locally with Notepad; do not paste credentials into chat or screenshots.
- `verify` passed for record identity, active status, published listing/approved seller, and Argon2 hashes matching both private passwords **without** creating login sessions.
- Read-only in-memory HTTP smoke `apps/api/test/iphone-safari-qa-http-smoke.ts` passed: health 200, campus 200, public listing collection 200, listing details 200, anonymous inquiry inbox 401; no listener, message or session created.
- Test-only runtime `apps/api/test/run-iphone-lan-pwa-api.ts` hardened to **force local TEMP media storage**, wipe inherited Google Drive credentials, keep push disabled, and bind only `127.0.0.1:4400`.
- API TypeScript `tsc --noEmit` and changed tracked QA-script diff check passed.

## Pending physical Safari session — not yet performed

- Security prestart `node scripts/wp3-iphone-lan-readiness-readonly.mjs --read-only --prestart` passed: all firewall profiles enabled, home Wi-Fi Private, unrestricted Bun allowances disabled, existing HTTPS CA/leaf/SAN/private-key ACL checks valid.
- iPhone-only Windows inbound rule `CPSU-iPhone-QA-8445`: TCP, local `192.168.0.133:8445`, remote `192.168.0.224`, Private profile.
- **No gateway started in this migration/fixture phase.** Ports `4173`, `4400`, `8445` remained without test listeners.
- When the owner is physically ready with their iPhone on trusted home Wi-Fi, verify the above prestart, then in the project root run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-iphone-lan-https.ps1 -LocalOnly`. The QA launcher opens three local terminals; the user then visits **`https://192.168.0.133:8445/`** in **real Safari**, with the local CA trusted only after verifying its fingerprint. Do not bypass TLS warnings.
- Manual keyboard/composer, iOS safe-area, swipe, typing, message receipts/sound, close-flow, VoiceOver, reduced-motion and push/lock-screen checks are still **PENDING**. Backend tests cannot claim real iPhone acceptance.

## Cleanup when physical testing ends

First stop the three designated test-only terminals, check no listeners on 8445/4400/4173, and remove the temporary local CA trust from the iPhone. The existing guarded fixture script supports explicit `cleanup` from `apps/api` only with `NODE_ENV=test` and `CPSU_IPHONE_QA_FIXTURES=approved`; it verifies private record ownership and refuses cleanup when unknown extra users/listings appear. Preserve the private backup for the required retention/recovery period; remove the iPhone-only firewall rule after device QA.

**No** live student conversations, development/prod migrations, user network/firewall rules, commits, pushes or deployments were changed by this database/fixture acceptance.
