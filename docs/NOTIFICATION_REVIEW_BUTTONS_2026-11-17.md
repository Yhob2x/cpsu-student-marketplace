# CPSU Market — Notification and Review Button Design Audit
Date: 2026-11-17
Surface: notifications and campus/university reviewer actions
Approach: Impeccable audit/polish/harden and shadcn/ui button hierarchy conventions, applied within the existing React/Vite CSS theme (shadcn component package not installed).

## Targeted audit verdict
Coherent CPSU product-specific control system: PASS for scoped implementation. **17/20** scoped audit, not a production or full accessibility certification.

| Dimension | Score | Evidence / remaining gaps |
|---|---|---|
| Accessibility | 3/4 | 44px+ visible targets, focus-visible, aria-pressed, record-aware reviewer labels, saving feedback; screen-reader and authenticated keyboard audit pending |
| Performance | 4/4 | No animation library or new network requests; styling and React state only |
| Theming | 3/4 | Existing forest-green and white actions preserved; some existing hard-coded light colors remain |
| Responsive | 3/4 | Synthetic 320, 390, 1280px and 320px/200%-font checks pass without page horizontal overflow; physical device validation pending |
| Integrity | 4/4 | One destination per notification, appropriately contrasted action hierarchy, existing server-owned review decisions intact |

## Findings and fixes
- **P2: Duplicate notification destination.** Whole-card link and separate View button opened the same item, adding unnecessary tab stops. Removed duplicate View link; kept full-card link with visual arrow, and distinct Mark read button.
- **P2: Visually competing destructive actions.** Reject previously used the same prominence as Approve/Verify. Scoped destructive-outline styling, retained green primary and secondary outline actions.
- **P2: Ambiguous in-progress moderation labels.** Busy buttons now describe Approving/Requesting/Rejecting, Verifying/Rejecting, or Resolving/Dismissing instead of showing an unrelated default label. Added record-specific labels where lists repeat controls, aria-busy and disabled concurrent review/report actions.
- **P2: Small mobile notification caption.** Increased the recent-notifications caption to 14px, including the narrow breakpoint.
- **P3: Heavy 3px unread-card stripe.** Replaced with a complete subtle outline, retaining the New marker and unread surface.
- **P3: Redundant CSS.** Removed unused styles for removed View action.
- **Positive:** Existing notification filter aria-pressed semantics, focus indicators, 44px action targets, human photo confirmation and required moderation reasons were preserved.
- **Detector false positive:** Skipped heading level in synthetic QA fixture is not evidence of a problem in the actual application.

## Validation
- Source detector for affected TSX/CSS: no findings before cleanup.
- Rendered Impeccable detector at 390x844: initially flagged tiny notification caption and unread stripe; after fixes only the synthetic-fixture heading issue remains.
- Browser synthetic UI at 320, 390 and 1280 px: no document overflow. All visible scoped buttons >=44px tall. At 320px with root font size doubled, no document overflow.
- Bun frontend tests and Vite TypeScript production build passed during implementation.
- **Not confirmed:** physical iPhone/Android, authenticated reviewer workflow with simultaneous cases, actual live notification updates, screen reader or long-text localization acceptance.

## Safety
Code/CSS-only refinement; no API, migrations, role/access, push or notification logic changes, no dependency installation. No live student data modified, no commit, push, or deployment. Preserve other local changes and pending test scratch files.
