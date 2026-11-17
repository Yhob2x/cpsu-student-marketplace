# CPSU Market — Mobile Alerts button wording

Date: November 17, 2026
Environment: Authorized local development repository; code/CSS only.

## Request and interpretation
Reduce redundant visible button wording on the phone's Alerts/Notifications experience without removing instructions needed for consequential operations or the All/Unread filter.

## Changes
- `apps/web/src/main.tsx`: The mobile header's Alerts link shows a bell and unread badge only. Its accessible name still says Alerts and the exact unread total; the desktop label is preserved.
- `apps/web/src/notifications.css`: Mobile header link has a 44px tap area and compact readable badge. At widths <=520px, the bulk mark-as-read control becomes a 44px double-check icon beside the notification summary, instead of a separate full-width text button. The decorative summary bell is hidden on phones to prevent redundant imagery and leave more room for the summary.
- `apps/web/src/pages-profile.tsx`: Bulk button has explicit accessible name, native tooltip, busy/disabled states, and a text span that stays visible at tablet/desktop widths. The existing bulk operation and authorization are untouched.
- `apps/web/test/icon-action.test.tsx`: Added regression coverage for label visibility semantics and accessible names.

The All and Unread filter names remain visible to identify the selection. Recovery, bulk semantics, and push-enable permission labels are not silently renamed or hidden. Existing individual mark-as-read and refresh icon buttons remain unchanged.

## Verification
- Impeccable source detector for affected TSX/CSS: no findings.
- Synthetic Chrome browser fixture at 320px, 390px, 768px and 1024px: no document-level horizontal overflow. Mobile Alerts/mark-all text hidden; desktop wording retained.
- At 320px with the root font doubled: summary remains within viewport without horizontal overflow, and the bulk button stays 44px.
- 320px simulated header with a Sign out button: unread badge does not overlap Sign out.
- Rendered Impeccable check at 390px: no findings.
- Tests and production build verified locally.
- These measurements use a synthetic preview of the actual CSS and control markup, not a signed-in iPhone session; physical device, accessibility screen-reader, and authenticated interaction tests remain outstanding.

## Safety
No database migration, deployment, explicit Git commit, or push was performed for this task. No backend, Web Push or real-time alert behavior was altered. Existing unrelated files preserved. Temporary browser fixture removed after verification.
