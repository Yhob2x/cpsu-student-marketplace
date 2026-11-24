# CPSU Market — Security release gates and institutional decision record

**Date:** 2026-11-17
**Scope:** Local repository read-only assessment and acceptance plan, **not** a security clearance or production deployment authorization.
**Source evidence:** `docs/SECURITY_ASSESSMENT_BATCH_2026-11-17.md`, `docs/SECURITY_REMEDIATION_2026-11-16.md`, `docs/privacy-and-retention.md`, `infrastructure/backup/backup.sh`, staging and production service/Nginx templates, `apps/api/src/env.ts` and `apps/api/src/index.ts`.

## Decision and evidence matrix

| Gate | Current verified source status | CPSU decision / operator dependency | Exit evidence required |
| --- | --- | --- | --- |
| Staff MFA | **BLOCKED** — password-based staff access exists; full step-up MFA absent | Appoint auth owner; decide covered staff roles, factor(s), enrollment and account bootstrap, lost-device recovery, break-glass process, account lockout, accessibility and audit/notification policies | Signed policy + MFA server-side enforcement on all privileged staff sessions and sensitive operations; isolated positive/negative, recovery, replay, role and session-revocation tests; staff device UAT |
| Email ownership verification | **BLOCKED** — registration issues a session; no approved delivery or email-confirmation lifecycle | Approve institutional mail transport and authorized sender/domain; whether personal email is accepted, campus/affiliation eligibility criteria, restricted actions pending verification, resend/expiry/change-of-email/recovery, privacy handling | Approval + time-limited single-use token implementation (hashed at rest), mail delivery/bounce handling, resend throttling, unverified-access denial and isolated E2E proof |
| Retention and deletion | **BLOCKED** — per-record periods and deletion rules undecided | DPO/legal approval for user profiles, affiliations, listings/media, inquiries, reports/records, logs, push subscriptions and backups, plus legal holds, data-subject requests, processors and disposal | Signed retention schedule, tested deletion jobs, access/audit records, backup expiration and legal hold coverage; no new personal-data collection beyond approved scope |
| Encrypted backup/restore | **BLOCKED** — script encrypts DB+media via age; only plaintext earlier test-DB rehearsal is documented, not encrypted production-like archive restore | Security/operations owner designates age public recipient, separate safeguarded recovery identity, isolated restore destination and approval to run a synthetic rehearsal; approve backup retention | Verify **both** paired age-encrypted artifacts decrypt into an isolated DB/upload directory, match DB counts and media hashes, confirm application can read restored synthetic data, test recovery key controls and record cleanup |
| API direct-port isolation | **BLOCKED** — production env rejects non-loopback binding; Nginx templates proxy to loopback, but deployed host is unverified | Approve actual host/staging topology, domain/TLS, firewall and external source for authorized probe | On deployed approved host: inspect effective process listener and firewall, ensure only `127.0.0.1:<API_PORT>` listens; from authorized independent machine direct TCP requests to the host's API port **fail** while HTTPS through Nginx **succeeds**, with timestamps/host ID and redacted evidence |

## Findings from source inspection

1. `apps/api/src/env.ts` requires `NODE_ENV=production` to set `BIND_HOST=127.0.0.1` and `COOKIE_SECURE=true`; `src/index.ts` passes the bind host to the listener. This prevents accidental wildcard binding in production mode, but **does not attest to a deployed listener or firewall**. Staging template routes `/api/` to `127.0.0.1:4400`, production template to `127.0.0.1:4000`. No approved staging domain or deployed port test is evidenced.
2. `infrastructure/backup/backup.sh` requires `age` and `BACKUP_RECIPIENT`, uses private temp files and mode-0700 archive directory. **It also automatically deletes matching encrypted files older than 30 days** with `find ... -mtime +30 -delete` despite no approved backup retention period. Treat this as an unapproved policy default: do not schedule/run the script on real archives until retention has been approved and the deletion behavior reviewed.
3. The production systemd unit uses `ExecStart=/usr/bin/node dist/index.js`, while `apps/api/package.json` builds `bun --target bun` and starts with `bun dist/index.js`. This **runtime mismatch needs resolution and acceptance before deployment**; staging deliberately requires an approved Bun path. Do not change a live service or claim it will run correctly without verification.
4. An earlier Stage 1 local development DB restore matched 20 tables (and included no media files); **it does not satisfy the encrypted backup-plus-media restore gate**.
5. No real deployment, firewall state, actual age recipient or restore exercise was inspected in this task.

## Recommended execution order

1. Record CPSU security/authentication decision owners and DPO approval authority. Issue short approval documents with scope, rollback owner and signed decisions for MFA, email and retention. **Do not invent institutional policy**.
2. Correct unapproved backup retention assumptions only after backup schedule approval; nominate recipient/restore owner and prepare a **synthetic, disposable** encrypted backup+media restore rehearsal, strictly separated from real student data.
3. Align production service runtime with the Bun build using an approved change and test on an isolated staging host.
4. Once an explicitly authorized staging host exists, verify active loopback binding, firewall deny and external direct-port failure; preserve evidence.
5. Implement CPSU-approved MFA and email verification in separate tested packages, with all affected staff/student role pathways, user recovery and accessibility acceptance.
6. Re-run full security, privacy, mobile and operations acceptance. Final production release remains a separate signed authorization.

**Do not:** create accounts or mail transports, collect private student ID files, restore real DBs, change retention jobs, touch a host firewall, migrate data, deploy, rotate credentials, or remove release gates without separate explicit approval.

## Prepared owner-review and QA artifacts (2026-11-17; pending decisions)

- `docs/CPSU_STAFF_MFA_APPROVAL_RECORD_2026-11-17.md` — proposed factor, staff enrollment, recovery, step-up and synthetic acceptance requirements; all CPSU signatures pending.
- `docs/CPSU_EMAIL_OWNERSHIP_APPROVAL_RECORD_2026-11-17.md` — mailbox ownership separated from campus eligibility, mail transport decisions, route-access matrix and token acceptance.
- `docs/CPSU_RETENTION_AND_DISPOSAL_APPROVAL_RECORD_2026-11-17.md` — DPO/legal per-category retention, hold and deletion schedule awaiting actual periods and responsible officers.
- `docs/CPSU_SYNTHETIC_ENCRYPTED_BACKUP_RESTORE_RUNBOOK_2026-11-17.md` + `scripts/qa-synthetic-encrypted-backup-roundtrip.sh` — temporary, synthetic-only `age` SQL/media archive format test; **not** a database import or real key custody proof.
- `docs/CPSU_API_PORT_ISOLATION_VERIFICATION_RUNBOOK_2026-11-17.md` + `scripts/verify-api-port-isolation.ps1` — operator-approved on-host configuration evidence plus one external TCP negative and HTTPS API positive check; script defaults to no-network preview.

All five gates remain blocked. These additions contain no CPSU policy signatures, code activation, production network evidence or approval to restore/drop a database.

**Local preparation checks (2026-11-17):** PowerShell parser PASS; no-network TCP/HTTPS check preview PASS; localhost rejection PASS; Git Bash `bash -n` for the synthetic archive script PASS; no-write Bash preview PASS; `git diff --check` PASS; code graph refreshed. The connected Windows machine does not have the `age` / `age-keygen` executables on its normal PATH, so the **actual encrypted archive round trip was not executed**. No synthetic MySQL import or live external port test was executed.

**Current verdict: NOT READY FOR RELEASE.** This document is an evidence/decision checklist only, not evidence that any of the five gates passed.
