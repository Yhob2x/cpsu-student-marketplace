# CPSU Market — Profile UX refinement

**Date:** November 17, 2026 (Asia/Manila)  
**Request:** Reorder Profile, clarify CPSU verification status, compact Quick Links and improve name-editing feedback while retaining the approved palette.

## Scope and implementation

The student-side `/profile` page was rearranged for mobile-first task priority:

1. Your account — identity, private email address and a simple initials avatar.
2. CPSU affiliation — explicit status, campus and next permitted step.
3. Account settings — editable display name and clear validation/save feedback.
4. Quick links — compact, accessible full-row links to My listings, Saved items, Transactions and Notifications; staff retain relevant admin/notification links.
5. Install app — optional PWA promotion moved to the bottom.

The desktop profile layout uses two columns at 820px and above; smaller screens use a single-column document order. Existing forest-green, ivory/white, and gold tokens remain. No new service, authentication flow, or backend endpoint was created.

### Campus status

- **Verified:** show verified affiliation, link to existing `/dashboard` (manage listings or open a store).
- **Pending:** explain campus reviewer verification and direct to `/notifications` for available updates.
- **Rejected:** direct to `/notifications` for decision/reason if recorded, plus `/guidelines`. Recommend contacting campus reviewer via official CPSU channels; do not falsely imply in-app resubmission.
- **Missing:** explain lack of affiliation record and direct to `/guidelines`. No unsupported registration retry action.
- **Staff:** no student verification panel; preserve Administration (where role permits) and Notifications.

Server remains authoritative: students cannot approve, change or reapply to affiliation through this UI.

### Name editing

- A valid, changed display name is required before Save is enabled (trimmed, 2–80 characters).
- Changing text clears previous success/error state; invalid input exposes an inline error associated with `aria-describedby` and `aria-invalid`.
- Saving disables the field and button to prevent concurrent edits; success is announced through `role=status`, errors through `role=alert`.
- If PATCH succeeds but account refresh fails, the message requests a reload rather than falsely asserting refreshed state.
- A single Sign out action remains in the existing main header; it is removed from the profile form.

## Code changes

- `apps/web/src/pages-profile.tsx`: Profile component replaced in scope; pre-existing Notifications section preserved byte-for-byte.
- `apps/web/src/profile-presentation.ts`: pure status and name-change helpers.
- `apps/web/src/profile-refinements.css`: scoped responsive profile layout and controls.
- `apps/web/src/main.tsx`: imports the scoped CSS after existing theme layers.
- `apps/web/test/profile-presentation.test.ts`: seven focused policy/presentation tests.

## Verification

- `bun test test/profile-presentation.test.ts test/auth-field-error.test.ts test/auth-return.test.ts`: **10 passed**.
- Initial `bun run build` immediately after the Profile changes **PASSED**, including TypeScript. A later repository-wide build **failed on an unrelated, concurrent Admin/Reviewer workspace type mismatch** in `apps/web/src/pages-admin.tsx` at the `ReviewerAdmin` props (`campusesError` and `onRetryCampuses`). These other uncommitted files were not changed or repaired as part of the Profile work.
- `bunx vite build`: **PASS** with the Profile changes and the current frontend tree (bundling verified; this command does not enforce TypeScript).
- Impeccable source detector and layout detector on the Profile component: **no findings reported**.
- Chrome CDP with intercepted synthetic responses: **PASS**, in fresh browser profile at 320, 390, 768, and 1280 CSS pixels, testing verified/pending/rejected/missing affiliation and reviewer/staff layouts. No document horizontal overflow.
- Simulated name save: PATCH intercepted and fulfilled locally, single synthetic mutation, successful feedback confirmed, name reloaded, save disabled again, further edit cleared success and raised invalid-field message for too-short input.
- At 390px, Account settings begins at approximately 703px, versus approximately 1236px before the change (533px earlier).
- No live account session, database row, student photo, app deployment, migration, commit or push was performed.

## Remaining release acceptance

Perform a real iPhone Safari and Android Chrome check for tap targets, large text accessibility, screen reader focus/announcement behavior, PWA install placement and genuine account-error recovery. Browser/device emulation is not physical hardware certification.

## Limitations

The backend does not expose a self-service student-affiliation correction or resubmission route. Adding one requires a separate approval-gated backend/security workflow; this refinement deliberately provides accurate guidance through the routes that actually exist.
