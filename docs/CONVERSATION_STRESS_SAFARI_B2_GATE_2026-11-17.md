# B1.3 — Conversation Safety Stress and iPhone/B2 Readiness

**Date:** 2026-11-17
**Status:** Local isolated-MySQL bounded stress passed; physical iPhone Safari blocked; B2 awaiting institutional approvals.

## Executed work
- Ran `scripts/wp3-iphone-lan-readiness-readonly.mjs --read-only --prestart`: the signed QA TLS certificate, current LAN IP SAN and private-key permissions pass, but **all three Windows Firewall profiles remain disabled**, and Wi-Fi is **Public**. Preflight exit 2 (not ready). No unsafe LAN service or physical Safari interaction was attempted.
- Added `apps/api/test/integration/inquiry-close-stress.test.ts` as a **sequential, opt-in** synthetic integration suite in `apps/api/test/run-integration.ts`.
- The existing runner is loopback, `cpsu_marketplace_test` only, enforces isolated fixture guard, forces local media storage and clears Google Drive credentials. No real student account/record or development database writes.
- Test phases each create a fresh real Express application instance with the **normal, unchanged 300-request/minute rate limiter**. This prevents one scenario's request budget contaminating the next scenario, without disabling production-style throttling.

## Bounded MySQL contention test results
The **final guarded run passed**:
- Stage 1 HTTP/MySQL: **36/36**
- Public-report HTTP/MySQL: **4/4**
- B1.2 conversation closing HTTP/MySQL: **4/4**
- New B1.3 contention/stress: **4/4** tests across 40 send-versus-close rounds with three send requests per thread, 20 simultaneous two-party closes, 10 waves of replay (10 requests/wave), and one true rate-limit check.
- **120 contested send responses were successful**, and message counts and notifications exactly matched these successful writes. All post-close replays were denied without new messages or notifications; every closed thread had exactly one closure audit.
- **31 serializable transaction conflicts** (expected HTTP 409) occurred in the send/close/double-close tests and required explicit idempotent close retry. These did not create duplicate audits or allow post-close writes.
- Local race-batch wall-clock p95 **15 ms**, max **21 ms**, as measured inside the synthetic test runner. **Do not** use these figures as production throughput or Safari responsiveness indicators.
- Rate-limit assertion verified the first 300 requests of one fresh app instance to `GET /health` succeeded and the **301st returned HTTP 429**.
- The first attempt *correctly* hit the global limiter halfway through all phases (429) before a test expected 204; the final runner uses separate per-phase Express instances rather than bypassing or weakening rate limits. Both observations are recorded, not hidden.
- Existing read-only test-schema integrity audit completed successfully.

## Risks and next engineering gates
- **Conflict UX:** 31 conflicts under deliberate collision are evidence that the close action may surface a retryable 409. Before production, assess safe **bounded automatic retries for idempotent close only** and clear mobile user messaging. Do **not** silently retry non-idempotent message sends, as duplicates are possible.
- This is **bounded synthetic contention, NOT a sustained production-scale load test**. Additional independent process/connection pool, latency under network delay, long-duration soak, rate-limiter distribution, deadlock frequency, push notification behavior and server failover tests are not complete.
- Physical iPhone Safari keyboard, viewport, safe-area, scroll, sound and VoiceOver were **not tested**. Network security prerequisites are failing; test with a personal phone only after remediation. See `docs/IPHONE_SAFARI_CONVERSATION_ACCEPTANCE_2026-11-17.md`.
- User blocking and private-message reporting remain **design-only**, subject to CPSU owner/DPO/DB migration gates in `docs/BLOCKING_AND_MESSAGE_REPORTS_APPROVAL_GATE_2026-11-17.md`.

## Files added/changed
- Added: `apps/api/test/integration/inquiry-close-stress.test.ts`, `docs/IPHONE_SAFARI_CONVERSATION_ACCEPTANCE_2026-11-17.md`, `docs/BLOCKING_AND_MESSAGE_REPORTS_APPROVAL_GATE_2026-11-17.md`, B1.3 plan, this report.
- Modified: `apps/api/test/inquiry-safety.test.ts` (guarded stress runner wiring assertion), `apps/api/test/run-integration.ts` (sequential new suite), relevant progress and documentation only.
- **No** code change to production rate limiter, live messaging routes, database schema or runtime infrastructure in B1.3.

**Release recommendation:** Keep physical Safari QA and new blocking/message-reporting features blocked until the stated security/privacy decisions and real-device acceptance are complete.

## Final regression summary and concurrent-edit note
- Ordinary API suite **104 passed, 7 opt-in skipped, 0 failed**.
- Web suite **42 passed, 0 failed**; API TypeScript **passed**; web TypeScript + Vite production build **passed**; PWA asset validation **passed**.
- `git diff --check` limited to this package's tracked changed files **passed**. A later **repository-wide** `git diff --check` returned **2** due to an unrelated concurrently modified file `apps/web/src/mobile-refinements.css` (new blank line at EOF, line 712). This package **did not modify or clean up that file**, preserving other ongoing work. Release-wide lint/whitespace status must be rechecked after that separate edit is resolved.
- Both the physical iPhone and blocking/private message reporting decisions remain pending as documented above.
