# B1.3 — iPhone Safari readiness, bounded conversation stress, B2 policy gates
Date: 2026-11-17
Scope: authorized CPSU Market local repo only.

1. Perform read-only iPhone LAN HTTPS preflight. If unsafe, stop before starting network listeners or changing OS firewall/network trust. Physical Safari requires a user-operated iPhone; do not claim browser/device acceptance.
2. Add an opt-in, deterministic, synthetic MySQL stress suite on the guarded `cpsu_marketplace_test` runner (LOCAL media mode only; Drive credentials cleared). Run **after** existing Stage 1, reports, B1.2 suites sequentially, not in parallel with fixture resets. Use bounded concurrency and many repeats without any student accounts. Capture statuses, 201-only inserts, one audit, post-close refusal. No silent retry of non-idempotent sends.
3. Keep blocking and private-conversation reports at **design/policy stage**. Produce owner and DPO approval checklist: blocking scope, consent/evidence minimization, retention, reviewer campus scoping, appeals, transaction obligations, abuse throttling, safe identity handling. NO schema migration and NO staff access to all private chats.
4. Verify ordinary API/web/unit/build, isolated integration, git diff check. Preserve unrelated uncommitted work.

Exit criteria: progress memo documenting true physical-device blockers, bounded stress results and limits, and pending approvals.
