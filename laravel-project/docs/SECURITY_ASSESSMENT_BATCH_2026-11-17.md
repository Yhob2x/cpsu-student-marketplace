# Security assessment remediation batch — 17 November 2026

This batch addresses the confirmed, policy-independent findings in the local assessment. It is not a release approval.

| Finding | Status | Implementation and evidence |
|---|---|---|
| SEC-01 Multer | Implemented and tested | Upgraded runtime to 2.5.0 and types to 2.3.0 in `apps/api/package.json` and `bun.lock`. Existing sanitized-image, 3 MB and temporary-file checks remain. Isolated upload HTTP and focused upload tests passed. |
| SEC-02 proxy spoofing | Implemented and tested locally | Development/test ignore forwarded IP headers; production trusts loopback only. Production startup requires loopback binding and secure cookies. Both Nginx templates overwrite `X-Forwarded-For` with `$remote_addr`. The isolated HTTP regression verifies the development bucket is shared. External firewall exposure still needs deployment verification. |
| SEC-03 account throttling | Partly implemented and tested | Login now limits ten failed attempts per normalized email per 15 minutes while retaining the IP limiter. Keys are HMACs, so raw addresses are not stored as limiter keys. This in-process store needs a shared backend if multiple API instances are deployed. Staff MFA requires an approved enrollment, recovery and delivery policy; password-only staff access is still a release blocker. |
| SEC-04 refresh rotation | Implemented and tested | The refresh row is claimed with a conditional database update before replacement is issued. Two simultaneous synthetic requests yield one 200 and one 401; the existing later-replay revocation test still passes. |
| SEC-05 email ownership | Pending institutional decision | Registration still issues a session. CPSU must approve the email delivery method and decide which student actions require verified campus affiliation before a schema migration and complete verification flow are built. |
| SEC-06 media cache | Implemented and tested | Both local and Drive listing media responses set `Cache-Control: private, no-store` and `nosniff`. The local-media HTTP regression passed. |
| SEC-07 backups and retention | Partly implemented | The Linux backup script now requires an `age` recipient, encrypts both archives, creates a 0700 directory and uses umask 077. Shell syntax was checked. A real encrypted backup and restore were not run; an approved recipient, protected recovery key and operational restore rehearsal remain required. Existing plaintext archives, if any, require an operator inventory and secure disposition. Retention periods and deletion rules still require CPSU DPO approval. |

No application database schema or production data changed. The guarded test runner used `cpsu_marketplace_test`, forced local media storage and cleared Drive credentials for synthetic uploads. The already present unrelated web changes were preserved.

## Operator follow-up

1. Configure `BACKUP_RECIPIENT` as an approved age public recipient and keep its private identity separate from the archives. Do a disposable restore of both `db-*.sql.gz.age` and `media-*.tar.gz.age` before relying on the job.
2. Confirm that the API listener is unreachable except through same-host Nginx and that the firewall denies direct API port access.
3. Approve staff MFA enrollment/recovery, email ownership delivery, campus eligibility for buyer actions, and per-record retention periods. Implement and retest those decisions in separate batches.
