# Development roadmap

Derived from `docs/MVP_SCOPE.md`. Each stage has a gate: the next stage does not start until the gate is met, and no stage may widen scope
beyond MVP-001…024.

## Stage 0 — Governance (blocking)

| Item | Owner | Done when |
|---|---|---|
| Approve conflicts C1, C1a, C2, C3, C4, C5, C6, C7 | Project owner | Decisions recorded in `MASTER_BLUEPRINT.md` §Change log and in `docs/MVP_SCOPE.md` §4 |
| Confirm verification method, allowed categories, food/establishment rules, pickup zones, retention periods | CPSU offices | `docs/campus-policy-rules.md` and `docs/privacy-and-retention.md` lose their PLACEHOLDER markers |
| Confirm hosting and who operates the service | CPSU IT | `docs/architecture.md` §16 answered |

**Gate:** written decisions. Until then Stages 1–7 must stay inside the additive, non-controversial items.

## Stage 1 — Baseline and safety net

- Archive the blueprint (done), documentation set (done), verification run (done).
- Add the API integration test harness, fixture seeding, and a test database.
- Add the missing discovery index and the declared-relation audit from `docs/DATABASE_DESIGN.md` §3.

**Gate:** `bun test` covers authentication, listing authorization, and messaging boundaries; all green.

## Stage 2 — Listing completeness (WP2)

`condition` enum, `availability` enum with reserve/sold, mark-as-sold, soft delete, sort by newest/price, condition filter, own-listing
favorite block.

**Gate:** PART X listing cases pass, including "a sold listing cannot be presented as available".

## Stage 3 — Transactions (WP3)

`transactions` + `transaction_status_logs`, purchase request, accept/reject, negotiating, for-meetup, completed, cancelled, participant-only
transitions, status history, notifications on each transition. Decide `Handoff`'s fate first (C5).

**Gate:** every invalid transition returns a typed 4xx; history rows exist for every change; two-account isolation test passes.

## Stage 4 — Notifications (WP4)

In-app notification centre on web and mobile, unread badge, mark-as-read, plus transaction/availability events.

**Gate:** a full flow (inquiry → request → accept → meetup → complete) produces the expected notification per party.

## Stage 5 — Administration completion (WP5, WP6)

Student list with suspend/reactivate, category CRUD, announcements, audit-log viewer, reports UI with findings and a moderation action.

**Gate:** every privileged action writes an audit row; a student cannot reach any of it; campus scope enforced in tests.

## Stage 6 — Identity depth (WP7)

Student profile fields with privacy controls, `colleges`, profile photo, password recovery, email verification (if CPSU supplies a transport).

**Gate:** DPO approval of the field list; reset and verification flows tested end to end; no PII on public pages.

## Stage 7 — Analytics, PWA, pilot readiness (WP8, WP9)

Registered/verified/active students, popular categories, monthly activity, report counts; manifest and offline shell; backup restore drill;
accessibility and device matrix.

**Gate:** all 24 MVP rows read Done; PART X suites green; restore drill recorded; mobile build runs on a real device.

## Stage 8 — Pilot

Recruit approved sellers and campus reviewers, train them, monitor usage, collect feedback. No new features during the pilot except
safety fixes.

## Sequencing constraints

- Stage 3 before Stage 5's transaction monitoring and Stage 7's completion metrics.
- Stage 2 before Stage 3, because a transaction needs a reliable listing state.
- Stage 6 last among feature stages: it carries the most privacy risk and the least immediate marketplace value.
- PWA work may run in parallel with any stage after Stage 2.
