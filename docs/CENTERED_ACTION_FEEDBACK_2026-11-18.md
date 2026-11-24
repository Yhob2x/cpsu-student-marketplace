# CPSU Market — Centered Action Feedback Refinement (18 Nov 2026)

## Scope
Presentation-only refinement of the existing web/PWA `ActionFeedbackHost`, informed by the installed local `.agents/skills/emil-design-eng/SKILL.md`. No new dependency, backend API, database change, permission, or route. Preserve unrelated working changes.

## UX decisions
- Significant, confirmed milestones may opt into `presentation: 'center'`. The confirmation is centered within the viewport, with a large semantic icon above concise centered text, no blocking backdrop, no focus trap, and a visible 44px dismiss button.
- Routine saves, favorites, follow/unfollow, messages, and administrative queue activity keep the lightweight default `toast`, now top-center rather than top-right.
- Success uses existing CPSU forest-green/mint/ivory tokens; errors use the existing semantic danger token, and warnings use the existing restrained gold. Do not copy the reference image's unrelated blue palette.
- Motion is 200ms ease-out for entry and 140ms for exit, using opacity and transforms; reduced-motion settings suppress movement. Feedback never animates keyboard-initiated page actions.
- Centered confirmations dismiss after 4 seconds, other non-errors after 5 seconds; errors remain until dismissed. Automatic timers are suspended while the browser tab is hidden and restart when visible.
- The existing event-based `showActionFeedback()` API remains valid; the optional presentation property is backwards compatible.

## Emil design engineering review

| Before | After | Why |
| --- | --- | --- |
| All notices floated top-right | High-impact completions centered; routine updates top-center | Draw attention only when it matters |
| Blue icon on every confirmation | Branded forest/mint success, danger red for error, contextual gold for warning | Cohesive feedback with clear state |
| One horizontally laid out message | Centered milestone state uses a larger icon above message | Matches the reference hierarchy without using a blocking modal |
| Single enter-only keyframe | Short interruptible opacity/transform transitions | More responsive and subtle |
| Auto-dismiss while the tab may be hidden | Foreground-aware dismissal timer | Avoid losing status information |
| Same component for all roles | Shared optional presentation property for student, seller and admin actions | Extensible without changing authorization or business logic |

## Important milestones using centered feedback
- Store created, listing submitted for review.
- Buyer request created, report submitted to reviewer.
- Transaction status updated.

Other existing feedback events continue to render as compact notifications unless explicitly opted in.

## Changed files
- `apps/web/src/action-feedback.tsx`
- `apps/web/src/action-feedback.css`
- `apps/web/src/pages-account.tsx`
- `apps/web/src/pages-public.tsx`
- `apps/web/src/pages-transactions.tsx`
- `apps/web/test/action-feedback.test.tsx`
- `apps/web/e2e/action-feedback.pw.ts`

## Verification
- `cd apps/web; bun test test/action-feedback.test.tsx`: 4 passed, 0 failed.
- `cd apps/web; bun test`: 120 passed, 0 failed.
- `cd apps/web; bun run build`: TypeScript and Vite production build passed.
- `cd apps/web; bunx playwright test e2e/action-feedback.pw.ts`: 6 passed, 0 failed (desktop 1280x800 and mobile 390x844 Chromium). Checked true viewport centering, compact toast placement, non-modal semantics, focus preservation and reduced-motion rendering.
- Physical Safari/Android visual and screen-reader acceptance remains a separate gate.
- No database, migration, production deployment, Git commit or push was performed.
