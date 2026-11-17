# CPSU Market — Foreground live updates (2026-11-17)

## Goal
New notifications, followed-store publications, listing decisions, affiliation reviews, moderation reports, and transaction changes appear without manually refreshing the web app. This is **near-real-time foreground synchronization**, not a WebSocket/SSE guarantee or background push delivery.

## Audited baseline
- Header unread counts previously refreshed every 30 seconds; notification inbox loaded only on entry or manual Refresh.
- Admin listing/affiliation review queue and reports loaded on entry/after an action, leaving new cases invisible until navigation or reload.
- My Store listing review status loaded on entry; transactions list loaded on entry. Transaction detail already polled at 15 seconds.
- Messages already polled at 3 seconds (thread) and 5 seconds (inbox).
- The existing transactional `store.new_listing` notification is created only for a genuinely first-time approved and published available listing; drafts and later reapprovals do not send a new-publication alert.

## Changes
- Added `apps/web/src/foreground-refresh.ts`: reusable visibility-aware timed refresh with focus/visibility resync, overlap guard, and cleanup on unmount. It does not poll hidden tabs.
- Header unread and authorized staff review badge: 5 s. Staff review badge now includes unresolved in-scope reports in addition to pending listings and affiliations. The report count is returned by the existing reviewer-authorized `GET /admin/review-queue`, now `Cache-Control: no-store`.
- Open notification inbox: 4 s; read actions are not intentionally interrupted by polling. Protected `GET /notifications` now sends `Cache-Control: no-store`.
- Open reviewer/admin workspace: pending listing, verification and report queues refresh every 5 s; overview stats every 15 s. Queue refresh does not reset typed reasons or photo inspection checkboxes.
- My Store listings: quiet update every 6 s (no loading flash; skips active save/mutation), so reviewer decisions appear in place. The private seller listing endpoint now sends `Cache-Control: no-store`.
- Transactions list: quiet update every 7 s. Open transaction detail: every 5 s while nonterminal. Existing in-app user-specific notifications remain authoritative.
- `/me` profile/affiliation refresh every 15 s; unchanged user state preserves React identity, transient network failure does not force logout.
- Entry point safe to import for pure notification formatting tests, without trying to mount React during Bun unit tests. No private notification content added to push payloads.
- Web Push settings, subscriptions, delivery switches, and device background behavior were **not** changed.

## Security and performance
- Existing bearer/session access checks, reviewer campus scoping and student record privacy are retained.
- No new table, migration, role or privileged API introduced; report count uses the same scope filter as the reviewer reports endpoint.
- No background network refresh from hidden tabs. Focus/visibility resumes immediately; slow tasks do not accumulate overlaps in the shared hook.
- Polling is approximate and requires the web app to be open and connected; it does not make closed-phone alerts work or guarantee sub-second delivery.

## Validation
- Web `bun test`: **63 passed, 0 failed**.
- API `bun run test`: **128 passed, 7 opt-in integration tests skipped, 0 failed**.
- Web `bun run build` (TypeScript + Vite): **passed**.
- API `bunx tsc -p . --noEmit`: **passed**.
- Targeted `git diff --check`: **passed** (Windows LF/CRLF advisories only).
- No authenticated two-browser live-event test, physical iPhone/Android device acceptance, outage/reconnect soak test, or production/staging acceptance was performed. These remain required before calling real-time delivery production-verified.

## Operational status
Code-only updates to the local working tree. Existing dirty files and concurrent edits preserved. No development database migration, seed, deployment, Git commit or push. Existing push subscription and delivery gates remain unchanged.
