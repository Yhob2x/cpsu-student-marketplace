# CPSU Market — P1 HTTPS Staging and Physical Device Release Gate Recheck

**Date:** 2026-11-18, Asia/Manila
**Connected PC:** DESKTOP-P5OAG7F
**Owner instruction:** "i approve" (approval to continue investigating and preparing release acceptance)
**Conclusion:** Local preparation verified. **DO NOT DEPLOY OR ENABLE REMOTE WEB PUSH.**

## Approval scope

The owner's conversation approval permits continued review, local safety checks and preparation. It is **not documentation of an approved CPSU-owned domain, campus IT hosting permission, designated deployment approver, Data Privacy Officer authorization, legal retention policy, independent Web Push enrollment/delivery switch approvals, or physical device test outcome**.

This recheck executed only source inspection and read-only commands. Existing student/development data, real or public servers, DNS, TLS and API secrets were not changed.

## Live recheck findings

- `bun run push:staging:preflight`: **4/16 PASS, 12 BLOCKED** with the tracked placeholder-only staging approval template.
- `node --test scripts/push-staging-release-preflight.test.mjs`: **8/8 PASS**.
- `bun run push:staging:templates`: **16/16 PASS**.
- `bun run pwa:check`: **PASS** (all PWA icons, manifest and offline-only worker contracts).
- `bun run push:staging:check`: both push release switches remain **OFF**. Blocked by localhost-only VAPID contact and absent approved public HTTPS origin. Private VAPID key material is not printed.
- No physical iPhone or Android was detected by Windows Present-Only PnP device-name inspection. No ADB or libimobiledevice executable was found via local command lookup. This is **not** proof that no phones are available elsewhere; physical acceptance is NOT RUN.
- No temporary isolated acceptance service listening on localhost ports 4011 or 5187 during this inspection.

## Exact staging migration review inventory

**None of the following is approved for public staging merely by listing it.** Source-only migration enumeration found all these current directories:

| Migration | SHA-256 prefix from preflight | Human stage-review status |
|---|---|---|
| `20261110063101_init` | `4c61e8fa141d` | Pending |
| `20261110090354_message_status` | `de1c7f227b27` | Pending |
| `20261111160700_stage1_integrity` | `e7e064ede5a8` | Pending |
| `20261111161500_wp2_listing_states` | `815cccd1abf2` | Pending |
| `20261116094000_pwa_push_notifications` | `8df53f073dc8` | Pending |
| `20261116193000_wp3_transactions` | `f14fd1971e96` | Pending |
| `20261116220000_managed_student_content` | `4d02db939aec` | Pending |
| `20261116221000_pending_announcement_edits` | `151eb0b58209` | Pending |
| `20261117123000_seller_avatar_review` | `9183574c5698` | Pending |
| `20261117180000_store_follows` | `292d3510e8ad` | Pending |
| `20261117230000_private_student_identity` | `5cce88e82e1b` | Pending |
| `20261118120000_managed_home_page_content` | `bfe9c06ec226` | Pending |

`prisma migrate deploy` applies **all pending migrations**, so these must receive separate explicit staging review before invoking it on any hosting environment.

## Unresolved 12/16 release checks

- Provide an actually approved public HTTPS origin (not localhost or a placeholder).
- Provide a monitored and authorized institutional VAPID contact.
- Name the authorized staging hosting operator.
- Name deployment approver and written institutional approval reference.
- Record a CPSU privacy/DPO reference covering consent, logs, subscriber endpoint retention/deletion and synthetic tester access.
- Record hosting permission.
- Verify real, publicly trusted TLS on the actual staging origin.
- Provide an isolated nonproduction host and `cpsu_marketplace_staging` MySQL schema with distinct credentials.
- Confirm staging uses synthetic accounts only.
- Complete a documented encrypted staging backup-and-restore rehearsal.
- Explicitly approve the current 12 migration files for staging.
- Reconcile and review the mixed uncommitted source tree into an approved release snapshot.

## Physical device release test requirements (not executed)

For a consenting adult on each **real** device, record model, OS/browser version, date, staging URL, screenshots and results. Install Chrome PWA on Android and Safari Add-to-Home-Screen web app on iPhone. Verify standalone launch, navigation/safe areas, 200% text, keyboard and screen readers, offline and reconnect behavior.

After **separate written CPSU approvals** for enrollment and relay delivery, test explicit permissions, generic privacy-preserving lock-screen notification body, genuine background remote delivery, deep links, badges, notification preferences, denial, logout/account switching and stale-subscription cleanup. A local `showNotification` preview or emulator does not count.

## Gate before any public infrastructure action

**Missing essential input:** the approved public HTTPS staging domain and identity/authority of the staging hosting operator. Obtain these before any DNS, hosting, TLS, remote environment, migration, or push change. Use the existing placeholder-only `infrastructure/staging/staging-approval.example.json` strictly as an unpopulated template; put real (non-secret) evidence in a private approval manifest rather than the tracked example.

**State preserved:** Both `PUSH_SUBSCRIPTIONS_ENABLED=false` and `PUSH_DELIVERY_ENABLED=false`. No database migration, deployment, Git commit or push performed during this recheck. The local real-login suite from `docs/P1_AUTHENTICATED_E2E_ACCEPTANCE_2026-11-18.md` remains distinct from physical-device acceptance.
