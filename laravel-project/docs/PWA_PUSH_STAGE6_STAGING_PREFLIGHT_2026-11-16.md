# CPSU Market — Stage 6 HTTPS Staging Release Preflight

**Date:** 16 November 2026 (Asia/Manila)  
**Machine:** authorized `DESKTOP-P5OAG7F` via Remote Desktop Commander  
**Repository:** `C:\Users\acer\Downloads\cpsu-student-marketplace`  
**Owner instruction:** “approved” following the Stage 5 proposal to continue HTTPS staging.  
**Outcome:** **Source-only release preflight implemented. External staging deployment remains BLOCKED.**

## Authorization and scope

The user approved continuing staging preparation. The CPSU project does not yet identify an approved public HTTPS staging origin, monitored VAPID contact or accessible staging host. The approval does **not** establish domain ownership, grant network access, define institutional DPO sign-off, approve all Prisma migrations or authorize sending notifications to real students. This task did not use a remote browser, hosting console, DNS, certificates, SSH credentials or real user data.

## Stage 6 additions

| Local file | Purpose |
|---|---|
| `scripts/push-staging-release-preflight.mjs` | **Read-only** release preflight; evaluates source state, staging approval manifest, all Prisma migrations, deployment prerequisites, private-secret exclusion and OFF notification switches |
| `scripts/push-staging-release-preflight.test.mjs` | Eight Node tests for bad domains, invalid VAPID contacts, missing authorizations, unreviewed migrations, dirty source, secret-bearing profiles and accidental activation |
| `infrastructure/staging/staging-approval.example.json` | Placeholder-only **approval checklist** without passwords or private keys; not a claim of actual institution approval |
| Root `package.json` | Adds `bun run push:staging:preflight` |

### Usage

From the repository root:

```powershell
bun run push:staging:preflight
node --test scripts/push-staging-release-preflight.test.mjs
```

The first command uses the deliberately incomplete example and **must exit 2** (blocked) at present. When a real, documented institutional staging plan exists, the hosting operator can create a **private, untracked, non-secret approval JSON** (outside the repo is preferable) based on the example and run:

```powershell
node scripts/push-staging-release-preflight.mjs --profile=C:\private\cpsu-staging-approval.json
```

Do not put credentials or VAPID private keys into the approval manifest. The checker never renders deployment configs or connects to an external service. Even an entirely green result is **not** a license to deploy or activate the push relay; it only establishes local prerequisite completeness.

## Evidence observed

- **Stage 6 preflight (default placeholder manifest): 4/16 checks pass, 12 blocked** — the expected safe state.
- The six current migration directories were enumerated and their SQL SHA-256 short fingerprints recorded by the read-only script:
  - `20261110063101_init`
  - `20261110090354_message_status`
  - `20261111160700_stage1_integrity`
  - `20261111161500_wp2_listing_states`
  - `20261116094000_pwa_push_notifications`
  - `20261116193000_wp3_transactions`
- The WP3 transaction migration is not automatically approved by staging/push authorization; **Prisma's deploy command applies every pending migration**. Do not apply it outside an explicitly approved, isolated staging schema.
- The staging env template leaves both `PUSH_SUBSCRIPTIONS_ENABLED=false` and `PUSH_DELIVERY_ENABLED=false`; the real ignored API `.env` was not modified.
- Local web build was inspected for private VAPID material and forbidden secret-bearing file names; no detected match. This is an automated check, not a comprehensive secret audit.
- The release working tree contained unrelated WP3, admin and Graphify edits, including staged work from another process. Stage 6 **did not** commit, reset, stash, discard or deploy them.

## Test evidence

- `node --test scripts/push-staging-release-preflight.test.mjs`: **8 passed, 0 failed**.
- `bun run test`: **25 passed, 3 opt-in integration suites skipped**, 0 failed.
- `bun run pwa:check`: PASS.
- `bun run push:staging:templates`: **16/16** passed.
- `git diff --check`: PASS at preparation time.
- Real-device Android/iPhone push, actual remote push-provider delivery, DNS/TLS domain validation and public staging deployment: **NOT EXECUTED**.

## Current blocking approvals and implementation dependencies

1. An **approved staging hostname** on a domain the responsible CPSU operator controls; proof of hosting authorization and a publicly trusted TLS certificate.
2. A real, **monitored VAPID contact** (approved institutional email or HTTPS contact page).
3. Named hosting operator, deployment approver and written approval reference.
4. CPSU privacy/DPO approval covering synthetic test account access, notification consent, logs, push subscription endpoint retention/deletion and staging data.
5. A **dedicated staging MySQL schema and OS identity**, no real student data imported, and an approved backup-and-restore test.
6. Explicit approval for **all six existing migrations**, especially unrelated WP3 transaction changes, before a fresh staging deployment.
7. A reviewed, clean release source snapshot; never publish the current mixed uncommitted working tree.
8. Human authorization for staging rollout. **Enrollment and delivery require independent later switch approvals**; Stage 6 keeps both off.

**Release decision:** **BLOCKED; staging not deployed.** No GitHub push, commit, DNS modification, production migration, credential change, physical-device push test or notification to a real student was performed in this task. Normal local development work remains intact.
