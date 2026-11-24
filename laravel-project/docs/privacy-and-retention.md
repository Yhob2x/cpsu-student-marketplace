# Privacy and retention (checklist, not legal advice)

Needs CPSU's data protection officer and legal review under the Data Privacy Act of 2012 before launch.

- Collected: name shown to others, email, password hash (Argon2id), campus affiliation, listings and photos, inquiry messages, audit entries.
- Not collected: student ID images, class schedules, phone numbers, exact location. Public pages show store name, campus, listings only.
- **Proposed, not enabled (2026-11-17):** Private full name and Student ID number are staged for registration but collection remains OFF pending CPSU DPO approval and a separately approved database migration. The ID number would be stored as text in a private one-to-one StudentIdentity record, never on public profiles; the retention/deletion period, verification authority, access purpose, correction rights and applicable privacy notice are UNDECIDED. See `docs/PRIVATE_STUDENT_ID_REGISTRATION_2026-11-17.md`.
- Message access by staff: **undecided**. Define the conditions before enabling any moderation view of private inquiries (none exists in v1).
- Retention and deletion periods: **undecided**. Needed for messages, audit logs, expired affiliations, and uploaded media.
- Optional Google Drive storage integration is implemented but disabled until operator OAuth setup, security testing, and CPSU data-protection approval. If activated, listing photos are transferred to Google's infrastructure as a private processor-hosted repository and proxied by the authorized application API; no direct student Drive permissions or public shared links are granted. Review data residency, processor contracts, retention, access revocation, and backup/restore before using real student photos.
- Analytics suppress counts below 5. Inquiries are never presented as completed sales.
