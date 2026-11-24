# CPSU Market — Synthetic encrypted backup/restore QA runbook

**Record ID:** CPSU-OPS-BACKUP-QA-01 | **Prepared:** 2026-11-17
**Status:** PREPARED ONLY — NOT EXECUTED; not production restore acceptance.
**Owner, isolated host, encryption recipient and activation window:** **PENDING CPSU OPERATIONS APPROVAL**.
**Safety boundary:** Only throwaway synthetic data is permitted. No `cpsu_marketplace`, development student accounts, live uploads, production keys, prior archive paths or production schema may be accessed.

## Purpose, stages and limitations
- **Stage A (prepared runnable fixture):** Test the *same archive formats* as `infrastructure/backup/backup.sh`: gzip SQL piped to age, tar+gzip media piped to age, decrypt both into a temporary private location and compare source/restored bytes. Does **not** contact MySQL/MariaDB.
- **Stage B (future separate approval):** Import the recovered synthetic SQL into a **new, isolated, allowlisted QA database** using a dedicated least-privilege test account; verify sample row, media path and app read, cleanup. This is mandatory before declaring complete recovery readiness.
- **Stage C (future separate approval):** Rehearse a real configured *synthetic staging database* and protected upload tree using the scheduled job, an independently safeguarded recipient, actual operator restore instructions, rotation and failure recovery. Do not substitute the ephemeral script identity for a real key-recovery plan.

## Source inspection and risks
- `infrastructure/backup/backup.sh` currently encrypts DB archives (`db-*.sql.gz.age`) and uploaded media (`media-*.tar.gz.age`) with the `age` public recipient. It also deletes files older than **30 days**; this is **not DPO-approved** and must be resolved before scheduling it on institutional data.
- It does not currently demonstrate encrypted-archive recovery, successful app rehydration or safe real-world key custody. Earlier Stage 1 restore evidence covers a plaintext development DB test, not the encrypted media+database pair.
- The source backup script has no restore tool; Stage B/C are necessary to demonstrate operational recoverability, including server permissions and failure mode behavior.
- A successful temporary encryption round trip does **not** prove that MariaDB import, actual age key custody, backup completeness, or production restore works.

## Stage A — opt-in, synthetic-only test (no database)
**Preflight** (on an explicitly approved disposable Linux QA host):
1. Review the shell script and confirm `age`, `age-keygen`, `gzip`, `tar`, `mktemp`, `cmp` and Bash are installed.
2. Work in a filesystem/tmpfs that is private to the tester; do not run from a production backup directory. Restrict logs and never upload a private age identity to tickets, chat or Git.
3. Run the script with no argument first; it prints a preview and should touch no data.
4. With approval for **synthetic temporary file creation only**, run:

    bash scripts/qa-synthetic-encrypted-backup-roundtrip.sh --run-synthetic-only

5. Expected output includes `PASS: synthetic SQL + media age encryption, decryption, extraction and byte equality.` The script leaves no standing archive on normal exit; the EXIT trap removes temporary data and its synthetic key. Abrupt host termination or forced kill can leave residual temporary files, which the operator must locate and dispose of securely. **Do not use as a retained recovery backup.**
6. Record UTC date, isolated host ID, script commit/tree hash, age version, observed PASS/FAIL and a redacted log. Absence of `age` means **BLOCKED**, not PASS.

## Stage B — disposable MySQL import checklist (NOT AUTHORIZED TO RUN BY THIS RECORD)
1. Obtain **separate written approval to create one fresh QA schema** named `cpsu_marketplace_synthetic_restore_qa` or a similarly clearly isolated name. Use an account with zero access to `cpsu_marketplace`, real student tables, development/production media directories or any staging non-test schema. Check schema does **not** already exist; stop if it does.
2. Create the empty disposable schema with the dedicated QA operator; never run `prisma migrate deploy` or a destructive `DROP DATABASE` as part of this checklist. Record database version.
3. Rerun the Stage A fixture generation *as a deliberately retained, bounded temp artifact only after a separately reviewed change to the script* or use a separately approved synthetic-only archive created by the QA operator. The Stage A script intentionally deletes its artifacts.
4. Decrypt the archive into a `0700` temporary directory outside web roots, validate archive entry names **before extraction**, scan for unexpected paths or live identifiers, compare SHA-256 checksums and import **only the synthetic SQL fixture** into the empty isolated schema.
5. Read back the single known sample row from `synthetic_restore_probe`; verify `id=1` and `label='cpsu-qa-only'`. Verify extracted media `uploads/README.txt` byte hash and read access under a dedicated QA service identity.
6. Confirm negative test: wrong/missing age recovery key cannot decrypt; wrong schema name causes an operator abort; intentionally corrupt copy fails checksum. Keep evidence free of private keys and credentials.
7. The database owner must approve final cleanup. Remove **only** the named QA schema after confirming no production/development connection and no overlapping test; do not automate schema dropping from documentation. Securely dispose of temp plaintext and redacted evidence per the approved retention policy.

## Stage C — later production-like operator rehearsal acceptance
Required before backup/restore gate can pass: separate offline-held recovery key, independent custodian, original scheduled backup with synthetic staging records and image, archive pair recency, recovered DB tables and hashes, media hashes, application read of sample record/image, RPO/RTO measurement against a CPSU target, alert delivery, missing-key and corrupt-archive exercise, legal-hold handling, cleanup and signed operator/witness review. Record backups' geographic storage and restricted access. **No real student records without distinct privacy and environment approval.**

## Stop conditions
- Any path, account or schema resembles production/development; any real student record is found; no isolated permission boundary; a source archive includes unexpected file entries; recipient/recovery identity is missing; backup retention not approved; or a test is being used to justify production launch without Stage B/C.
- On any failure: stop, preserve a redacted error report, revoke temporary access if needed, do not attempt a live restore.

## Acceptance form (not completed)
Stage A result/date/operator: **NOT RUN**
Stage B isolated SQL import/date/operator: **NOT RUN / NOT AUTHORIZED**
Stage C scheduled paired restore/date/operator: **NOT RUN / NOT AUTHORIZED**
DPO retention/hold approval: **PENDING**
Operations custodian and witness signatures: ____________________
**Gate:** BLOCKED until all required criteria are observed on approved infrastructure.
