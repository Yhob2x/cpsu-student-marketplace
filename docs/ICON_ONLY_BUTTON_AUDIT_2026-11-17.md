# CPSU Market — Icon-only button clarity pass
Date: 2026-11-17

## Decision
Interpret "remove the buttons names if it's understandable" as replacing **only familiar, unambiguous utility button text** with icons. Keep visible action text for safety-sensitive, consequential, stateful and context-dependent operations. This is a refinement of the existing white/forest-green design, not a design-system replacement.

## All-screen inventory decisions
The frontend button inventory covered public browsing and product cards, Explore filters, messages/floating chat, store dashboard and editor, profile and notifications, reviewer/university-admin operations, managed content, store following, transactions, push settings, avatar editing and the photo viewer.

- Icon-only: notification refresh, individual mark-as-read, transaction status refresh. Photo viewer zoom in/out and close use the existing app icon family instead of literal text glyphs.
- Already icon-first: header search, gallery navigation, favorite heart, floating chat, filter toggles where accompanied by a descriptive accessible name.
- **Keep text**: mark all read (bulk action), All/Unread filters, retry after failure, Approve/Reject/Verify/Request changes, publish/archive, financial or transaction decisions, report resolution, Follow/Unfollow, Save/Edit/Remove, and account security controls. An icon alone could hide scope, consequence or state.

## Implementation
- `apps/web/src/icon-action.tsx` + `icon-action.css`: shared 44px icon-only action with `aria-label`, native `title`, `aria-busy`, disabled-on-busy behavior, visible keyboard focus and reduced-motion-aware refresh animation.
- `apps/web/src/icons.tsx`: refresh, minus, close line symbols in the incumbent Icon system.
- Notifications: replaced Check now/Mark read text with icon actions, per-notification accessible descriptions; bulk action remains a labeled button.
- Transaction details: manual refresh uses the icon button and an in-progress state.
- Image zoom: zoom plus/minus/close symbols use the established inline SVG icon family and native tooltips.
- Notification mobile row: reposition the 44px check control beside the card content so it does not consume a separate full-width row. Maintain a reserved no-overlap area and full notification content.

## Accessibility and verification
- Browser synthetic fixture at 320px and 390px: no document-level horizontal overflow, 44×44px utility buttons, accessible labels and titles. This was a synthetic control-preview, not authenticated end-to-end acceptance.
- Also inspected 200% simulated root type sizing at 320px: no horizontal overflow; readability at extreme zoom still deserves further manual testing.
- Impeccable source scan of affected components and rendered fixture: no findings in the tested states.
- Icon-action unit tests ensure title/name/loading semantics and actual notification-page use; full web tests and production build must pass before acceptance.
- Not tested on physical iPhone/Android or VoiceOver/TalkBack. No server authorization, real-time API, push subscription, deployment, or database changes were needed.

## Concurrency note
Another local process committed changes to this repository during the pass (commit `6d6f662`, observed after it appeared). This review did not invoke Git commit/push. A temporary QA fixture had entered that commit while being used; it was deleted from the local working tree afterward. Unrelated edits made by other work were not reverted.
