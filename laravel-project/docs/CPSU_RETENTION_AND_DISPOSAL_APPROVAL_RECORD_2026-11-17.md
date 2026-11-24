# CPSU Market — Personal-data retention, deletion and disposal decision record

**Record ID:** CPSU-PRIV-RET-01 | **Version:** 1.0 working draft | **Prepared:** 2026-11-17
**State:** DPO / LEGAL SIGN-OFF REQUIRED. All numerical periods below are **UNDECIDED**; no period may be inferred from a technical script or previous experiment.
**Scope:** Account and affiliation records, content, messages, financial/transaction metadata (if approved later), notifications, reports, audit logs, security telemetry, email/MFA credentials, stored media and offsite backups.

## Institutional authority
- CPSU Personal Information Controller / policy owner: **PENDING OFFICIAL NAME / OFFICE**
- DPO: **PENDING**
- University legal/records office: **PENDING**
- IT operations/security/data processors: **PENDING**
- Effective date, policy version, notice and data subject request contact: **PENDING**

## Retention schedule — every cell marked PENDING requires explicit approval
| Data category | Trigger for clock | Duration and disposal action requiring sign-off | Legal basis/hold / responsible officer |
| --- | --- | --- | --- |
| Account name, contact, password hash and roles | Account closure, last activity or institutional eligibility end (choose one) | **PENDING period; delete or irreversibly deidentify when eligible** | **PENDING** |
| Proposed private full legal name and student ID number (StudentIdentity; collection currently OFF) | Graduation, eligibility end, account closure or completion of verification (CPSU to decide) | **PENDING specific necessity, period, restricted verifier access, correction and deletion controls** | **PENDING DPO/registrar approval** |
| Campus affiliations, verification outcomes and historical reviewer decisions | Affiliation expiry/withdrawal/denial | **PENDING period; ensure appeal/review window** | **PENDING** |
| Store profiles, listings, descriptions, product photos and historical media | Listing removal, sale, suspension or account closure | **PENDING period, hidden-media purge and asset derivatives** | **PENDING** |
| Inquiry threads, message content, read receipts, and attachment metadata | Conversation closed / last interaction / subject request | **PENDING period; participants, abuse-evidence hold, redaction** | **PENDING** |
| Purchase requests/transaction state logs (if policy approved and deployed) | Completion, dispute resolution or cancellation | **PENDING period; regulatory/legal records review** | **PENDING** |
| Reports, moderation evidence and appeals | Case closure or legal hold release | **PENDING period and narrowly scoped reviewer access** | **PENDING** |
| Privileged audit, authentication security events and sessions | Log creation, session expiry or investigation closure | **PENDING event category periods; revoke sessions promptly** | **PENDING** |
| MFA enrollment/recovery and email verification metadata (when implemented) | Factor removal, token expiry or account deletion | **PENDING period; destroy secrets/codes, retain minimum approved audit** | **PENDING** |
| Push subscriptions, device tokens and notification payloads | Device uninstall, consent withdrawal, failed delivery or expiry | **PENDING period, promptly invalidate endpoint and token** | **PENDING** |
| Backup database/media encrypted archives and decryption keys | Backup creation, replacement, key rotation or legal hold | **PENDING archive window, rotation, test/restore/secure disposal** | **PENDING** |
| Third-party processors (e.g. optional Drive, mail delivery) | Contract end, data deletion event or consent/legal change | **PENDING processor contract and deletion confirmation** | **PENDING** |

## Procedures requiring approved choices
1. **Purpose limitation:** Define collection purpose, access owners and lawful basis per category. Do not collect student ID scans, schedules or precise location just to complete this table; separate privacy review and necessity assessment are mandatory.
2. **Data subject rights:** Specify notice, identity-proofing without overcollection, access/correction/erasure request workflow, response clock, appeals and lawful refusal criteria. Protect other chat participants and preserve minimum evidence when legally required.
3. **Deletion:** Identify all relational rows, uploaded media, generated thumbnails, cached derivatives, device subscriptions and backups; choose referential rules and tombstone vs hard deletion by category. Never equate soft delete or public invisibility with secure disposal.
4. **Legal holds:** DPO/legal initiate/record a purpose-limited hold, protect access, prevent automated purge of covered artifacts, review periodically, and approve hold release before deletion resumes.
5. **Encryption and keys:** Limit access to encrypted archives and separate recovery identity; define key access, rotation, restoration personnel, testing interval and evidence retention. A lost key or undecryptable backup is an incident requiring operations response.
6. **Jobs and audit:** After approved periods, implement dry-run inventories, bounded deletion batches, rerun-safe idempotency, error alerts, counts and redacted execution log. Test on synthetic test accounts and media before any live purge.
7. **Third-party processing:** Review storage geography, processing agreements, breach notification, processor access and deletion commitments before real personal data enters an external storage or email service.

## Existing source conflict to resolve BEFORE scheduling real backups
`infrastructure/backup/backup.sh` has `find "$DEST" ... -mtime +30 -delete`. **Thirty days is a current code behavior, not an approved CPSU retention policy.** Do not run this automation against actual institutional backups until the DPO-approved period, legal-hold mechanics and retention implementation are reviewed. Archive recovery test retention and production backup retention may differ; neither is approved here. Do not indiscriminately delete existing backups to achieve compliance.

## Required acceptance evidence
- Signed categories, minimum periods, per-category clock triggers, legal bases, deletion/retention exceptions, accountable offices and effective date.
- Updated privacy notice, processor inventory and operational access/retention schedule matched to source models, file storage and backup locations.
- Unit/integration tests for per-category expiry, legal holds, mixed message ownership, user request, session revocation, media derivatives and idempotent purge; confirm no unintended cascade of audit/report evidence.
- Proof of irrecoverability when required, backup expiration review, redacted deletion log and independent sign-off on an isolated restore.
- Security/IT handoff for running, monitoring and rollback; physical-device data clearing and push subscription revocation checks.

## Institutional approval
**Decision:** [ ] APPROVED WITH ATTACHED SCHEDULE [ ] RETURNED [x] NOT APPROVED — DURATION / LEGAL BASIS UNDECIDED

DPO/date: ____________________
University legal/records/date: ____________________
IT/data processor operations/date: ____________________
Policy owner/date: ____________________
**Gate status:** BLOCKED. Numeric defaults **must not** be treated as approved until signed.

**Source baseline:** docs/privacy-and-retention.md; docs/SECURITY_ASSESSMENT_BATCH_2026-11-17.md; infrastructure/backup/backup.sh; MASTER_BLUEPRINT.md.
