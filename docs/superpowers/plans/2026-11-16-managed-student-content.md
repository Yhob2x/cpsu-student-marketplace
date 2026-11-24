# Managed student content

## Scope

Global university administrators can save and publish a plain-text/heading guideline document and create, edit, publish, or archive announcements. Students see only published content. Existing guideline copy remains the public fallback until first publication. No campus reviewer can edit institution-wide content.

## Implementation

1. Add additive `GuidelineContent` singleton and `Announcement` models with migration. Preserve existing data.
2. Add public read routes and global-admin write routes with input validation, draft/publish state, and audit logging. Test authorization and visibility in isolated integration DB.
3. Add admin editing controls and student-facing rendering. Plain text only; no HTML injection. Preserve current visual system and loading/error states.
4. Run API/web typechecks, isolated integration suite, web build, and refresh Graphify. Update API/UI documentation and progress.

## Limits

Publishing is an explicit university-admin action. This local implementation does not represent CPSU institutional approval or deploy to production.
