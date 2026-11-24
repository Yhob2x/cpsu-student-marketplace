# Managed guidelines and announcements

**Scope:** Local implementation for the approved MVP announcement module and the owner's request to let authorized university administration manage the student-facing guidelines. No production deployment or institutional policy approval is implied.

## Behavior

- Global `university_admin` accounts can edit guideline drafts and explicitly publish them. Campus reviewers cannot. Students see only the last published body; before first publication, the existing guideline copy remains visible.
- Global university administrators can create, edit, publish and archive announcements. New records are drafts. Edits to a published announcement remain pending until another explicit publish action. Archived announcements are removed from public results.
- Public content is plain text with `# ` heading lines on the guideline page. Server validation rejects HTML markup. Publish requests include the reviewed draft text; a stale editor receives a conflict instead of publishing another administrator's revision.
- Admin changes are recorded in the existing audit log. The public announcement query returns at most 10 currently published items, newest first, for the student Home page.

## Storage and deployment

Additive `GuidelineContent` and `Announcement` tables are defined by two migrations. Only the isolated `cpsu_marketplace_test` database was migrated during verification; development and production databases were not changed. The running development API must have the migrations deployed and be restarted with the regenerated Prisma client before the editor can work there. Production requires the project's normal migration and policy approval gates.

Until those tables exist, the public guidelines API returns the existing guideline text and the public announcements API returns an empty list. This fallback applies only to Prisma's missing-table error; other database failures remain errors. The admin editor still requires the migrations.

## Verification

Isolated integration tests cover global-admin versus campus-reviewer write access, fallback and published guideline visibility, private drafts, stale-publish conflicts, announcement revisions, publication and archive. API typecheck and web production build pass. Browser and assistive-technology acceptance remain open. Announcement-triggered in-app notifications are not included in this change.

## Local development activation — 18 November 2026

The earlier pending-development status above has been superseded for the local `cpsu_marketplace` database only. The owner requested activation of the previously prepared editors. Both `20261116220000_managed_student_content` and `20261116221000_pending_announcement_edits` were backed up, rehearsed in a restored disposable database, and successfully applied to local development. Only `20261117230000_private_student_identity` remains pending. See `docs/MANAGED_CONTENT_DEV_ACTIVATION_2026-11-18.md`. Production remains unmodified.
