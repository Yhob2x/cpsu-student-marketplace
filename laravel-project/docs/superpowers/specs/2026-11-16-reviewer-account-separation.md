# Reviewer account separation

The project owner chose separate staff-only login accounts for reviewers. University administrators manage campus reviewers in a dedicated Staff section. Student account search excludes administrative accounts. A reviewer has a User record and a campus-scoped `campus_reviewer` role, without a student Affiliation; no new table is needed.

Administrators can create reviewers and edit name, email, campus, account status, and reset a password. The server validates all input, rejects email collisions, audits changes, and revokes sessions when credentials, scope, or status change. Reviewer accounts cannot buy, sell, save listings, report as students, or use student messaging, even if a legacy account still has an affiliation. Public browsing and moderation remain available. University administrators cannot use this workflow to grant university or system administrator powers.

Existing reviewer accounts are listed as staff without deleting affiliations or marketplace history. Any organizational decision to replace a legacy mixed account with a new person/account requires a separate controlled migration, not an automatic rewrite of real identities.

No development or production database migration is required. Automated checks cover role gating, reviewer-management validation and UI build; database-backed acceptance remains pending where the local environment cannot access its database credentials.
