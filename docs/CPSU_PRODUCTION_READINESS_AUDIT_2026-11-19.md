# CPSU Student Marketplace — production-readiness audit

**Date:** 2026-11-19 · **Latest iteration:** 4/5 (iteration 1 preserved below) · **Disposition:** NOT PRODUCTION-CAPACITY-CERTIFIED

## Scope, evidence, and hard safety boundaries

Inspected the local Windows monorepo (`apps/api`, `apps/web`, `performance`, `infrastructure`), without staging or production load. User planning assumptions are 10,000 registered users, 500 concurrent users, and 100 RPS for 10 minutes; **none are measured capacity**. The documented local database is MariaDB 10.11, while the supplied hypothetical plan says MySQL 8 and `max_connections=151`; verify the actual deployment before using those numbers. There is no confirmed separately approved 50,000-row synthetic performance DB or k6 installation.

Preserved pre-existing uncommitted web changes. No SQL, migrations, shared databases, external traffic, deployments, commits, Redis, queues, CDNs or paid services were added or run. The 118 source-level literal route registrations are enumerated in `docs/API_ROUTE_INVENTORY_2026-11-19.md` with route-family access controls and directly visible Prisma models. It is a **static scan**, not an exact runtime per-route query trace: imported helpers and dynamic registrations require isolated tracing.

## Measured baseline and after — iteration 1/5

| Goal | Baseline / observed source | After this batch | Target/status |
|---|---|---|---|
| G1 read/write p95 at load | Unmeasured / unmeasured | Unmeasured / unmeasured | <=300/500 ms; **unverified** |
| G2 N+1, max queries per list | No traced values | No traced values | 0, <=5; **unverified** |
| G3 full scans, hot SQL >100 ms | No EXPLAIN/slow-log | No EXPLAIN/slow-log | 0, 0; **unverified** |
| G4 peak DB pool usage | `new PrismaClient()` shared in `db.ts`; explicit cap absent | No pool change | <=80% of actual max; **unverified** |
| G5 cache hit ratio | No measured cacheable endpoint ratio | No cache added | >=80%; **unverified** |
| G6 slow/external work in-request | No trace | No queue added | 0; **unverified** |
| G7 2-instance / graceful shutdown | No shutdown handler, presence/typing in process memory | SIGINT/SIGTERM drain and Prisma disconnect added; one isolated unit test passes | 2 instances + killover **unverified**; in-memory state remains |
| G8 payload/bundle/image | Web build output: main JS **155.90 KB gzip**, lazy meetup map **342.59 KB gzip**, main CSS **65.04 KB gzip**; API list defaults 20/max 50 | No payload change | Initial JS <=250 KB gzip **build artifact passes**; list/image/LCP network budgets **unverified** |
| G9 rate limits | Source: 300 non-GET/min/IP, 900 GET/min/IP; prod auth 30 requests/15 min/IP. 429 + Retry-After tested | Unchanged | Coverage/5-attempts-per-minute/shared counters **not certified** |
| G10 CDN/Lighthouse/LCP | No approved deployed CDN or browser benchmark | No change | CDN 100%, score >=90, LCP <=2.5 s **unverified** |
| G11 monitoring | Basic `/health`, no structured HTTP access logs/request IDs; no evidenced external uptime/alerts | `X-Request-ID` and optional structured duration/status logs added, production default on; tests pass | Request logs **implemented**, external aggregation, error tracker, uptime probe and five alerts **not verified** |
| G12 10-minute 100 RPS/500 users | 0 sustained runs; error rate, memory unknown | 0 sustained runs | <1% errors, flat memory; **unverified** |
| G13 regressions | 6/6 offline performance tests; initial API typecheck wrapper blocked by Windows Prisma DLL lock | 240 API unit pass, 1 intentional skip, 0 fail; 19 focused pass; direct API `tsc --noEmit` pass; direct Bun API bundle pass (43.61 MB); web production build pass | No new detected failures in tested scope; full Prisma-regenerating build/lint/integration/device tests **unverified** |
| G14 secrets/cache/metrics exposure | Static guard review; no complete security probe | New request logs intentionally exclude URL, query, body, user IDs and client-supplied IDs; 2 privacy tests pass | Cross-user leaks, secrets and internal endpoint exposure **not comprehensively verified** |
| G15 iterations | 0 | 1/5 | Paused for isolated staging evidence rather than guessing |

**Build details:** Web build transformed 2,360 modules and warned about chunks over 500 KB uncompressed. `apps/web` has no `lint` script. Standard API `bun run typecheck` invokes Prisma generation and failed with Windows `EPERM` while renaming the Prisma engine DLL; **standalone TypeScript checking passed**, so do not conflate that lock with a compiler failure. The API direct bundle was built to ignored `.tmp` without Prisma generation or deployment.

## Findings register — evidence-based, ranked by impact and prevalence risk

| ID | Priority | Area / location | Evidence | Decision / status |
|---|---|---|---|---|
| PR-01 | P1 | Monitoring, `src/app.ts` | No structured per-request timings/IDs before change | **Fixed** request IDs and privacy-safe structured logs; actual deployment/alert collection pending |
| PR-02 | P1 | Graceful shutdown, `src/index.ts` | Startup previously called `.listen()` with no signal handler | **Fixed in code and unit test**; kill-instance test still pending |
| PR-03 | P1 | Multi-instance chat, `routes/inquiries.ts` | `typing` and `presence` live in in-process Maps | **Open**: 2-instance consistency cannot pass as designed; specify shared strategy after approval |
| PR-04 | P1 | Conversation reads, `GET /inquiries/:id/messages` | `findMany` has no `take` or cursor; GET also updates delivery receipts | **Open**: profile synthetic short/long threads; preserve read receipts and response contract |
| PR-05 | P1 | Store detail, `sendPublicStore` | Fetches all published listings as a nested relation with no `take` | **Open**: measure store-size distribution/payload; propose backward-compatible pagination only after evidence |
| PR-06 | P1 | Scalability/rate limits, `src/app.ts` | `express-rate-limit` uses default memory store; 900 GET/min/IP. 50 focused chats polling every 3 s would make 1,000 GET/min through one NAT (scenario, not observed traffic) | **Open**: verify real NAT mix before changing limits; 2-instance shared counters need design |
| PR-07 | P1 | Capacity testing | No approved isolated staging with representative data; no k6 runs | **Blocked** by isolation/approval/tooling; cannot state concurrent-user or RPS capacity |
| PR-08 | P1 | Monitoring/incident response | No verified external metrics aggregation, 5 alerts, error tracker or uptime probes | **Open**: request logs provide first input; deployment plumbing remains |
| PR-09 | P1 | Auth brute-force budget | Prod auth router permits burst of 30 attempts per 15 minutes/IP, not strict 5 attempts within each minute | **Open**: reconcile security target with campus NAT and auth semantics; no rate-limit change made |
| PR-10 | P2 | DB pooling, `src/db.ts` | One shared Prisma client; no explicit pool/timeout settings checked in resolved DB URL | **Open**: inspect actual DB limits and pool telemetry before tuning |
| PR-11 | P2 | Listing search | Public query uses `contains` text filters, `count + findMany` and OFFSET; index exists on `(status, categoryId, campusId, createdAt)` | **Open**: measure slow-log/EXPLAIN on isolated 50k+ rows before indexes/cursor changes |
| PR-12 | P2 | Payloads/images | Lazy meetup map chunk is 342.59 KB gz; no measured device LCP/images | **Open**: benchmark cold map-open separately; initial main JS below 250 KB target |
| PR-13 | P2 | Cache/CDN | Some private routes correctly use `no-store`; no measured public cache hit ratio or deployed CDN | **Open**: no server cache/CDN without clear benefit/invalidation and host approval |
| PR-14 | P2 | Async push/media | No measured outbound-work duration/queue backlog or recovery semantics | **Unverified**: profile isolated requests; do not add a broker on speculation |
| PR-15 | P2 | N+1/index coverage | Static code alone cannot establish request query counts or SQL plans | **Unverified**: sample Prisma query logs on staging by journey |

No P0 exploit or incident was established in this static/offline review; that is **not** a clean security certification. The P1 label above identifies risk or clear mismatch to a stated design objective, not necessarily observed latency failure.

## Change batch (7 API files, 2 new documents; no schema/service changes)

- `apps/api/src/request-diagnostics.ts` — generated, server-trusted request ID and optional concise structured route/status/duration record; no request body, URL, query, credentials or per-user values logged.
- `apps/api/src/app.ts` — register diagnostics before rate limit/auth, so rejected requests are identifiable; default logging on in production, explicit opt-in available outside production.
- `apps/api/src/env.ts` — optional validated `HTTP_ACCESS_LOG_ENABLED=true|false` setting.
- `apps/api/src/graceful-shutdown.ts` and `apps/api/src/index.ts` — drain active requests on SIGTERM/SIGINT, then disconnect Prisma; 15-second watchdog for stuck HTTP connections.
- `apps/api/test/request-diagnostics.test.ts` and `apps/api/test/graceful-shutdown.test.ts` — synthetic privacy, header/shape and idempotent-drain tests.
- `docs/API_ROUTE_INVENTORY_2026-11-19.md` — static route index, labeled partial model mapping.
- `docs/CPSU_PRODUCTION_READINESS_AUDIT_2026-11-19.md` — this report.

## Diff self-review (Step 8) and regression evidence

Reviewed changed code for response contract changes, sensitive logging, spoofed request IDs, exception paths, and shutdown idempotency. Request IDs are generated, not adopted from client headers. Logging only route templates prevents storing query strings, route parameters and request bodies. No shared cache, invalidation, job retries, migrations, rate-limit changes, new service endpoints or secrets were introduced, so the corresponding risks are unchanged rather than claimed solved. Shutdown unit test confirms disconnect happens after HTTP close and repeated signal callbacks do not double-close. Full 2-instance killover and 15-second forced drain behavior still require isolated acceptance.

**Offline checks run:** `bun test performance/config.test.js` 6/6; targeted API HTTP/security/diagnostic/shutdown 19/19; safe top-level API suite 240 pass, 1 intentional skip, 0 fail across 49 files; `bunx tsc -p . --noEmit` pass; web `bun run build` pass; direct Bun API bundling pass. No destructive DB tests, schema updates, load or external network tests were executed. Do **not** interpret Supertest request-loop durations as 100 RPS capacity evidence.

## Remaining approvals, runbook and price/capacity notes

1. Approve a private **synthetic-only** staging host and MariaDB/MySQL schema, legal/privacy retention rules, and 50,000+ representative rows; verify active DB identity and `max_connections`, sizes, users/roles before running any load.
2. Install/approve k6; use the existing `performance/README.md` guards, run the isolated one-user smoke first, then explicit tier-by-tier approval for concurrency. Monitor p50/p95/p99, RPS, error/429, SQL time and EXPLAIN, CPU/RAM/disk/pool, file/image bytes, logs and recovery. Obtain human stop authority and realistic per-user journeys.
3. Collect request logs and aggregate request rate, error rate, duration, tagged by known route template. Configure alerts for high 5xx rate, p95 latency, DB connections, disk/memory pressure, and queue backlog **only if a queue is actually deployed**; until then substitute a separate process/uptime alert. Add destinations and retention/redaction policy before production.
4. On staging, verify 2 API processes, shared sessions/uploads/presence/typing/rate-limit behavior and the kill-one-instance recovery drill. Do not enable two instances as-is and assume in-memory presence works. Decide on shared store only from measured needs and actual hosting constraints.
5. Perform browser tests with low-end Android/3G throttling, real-user LCP/Lighthouse, image payloads, lazy map load, and cache headers; verify staging HTTPS and Nginx config. Production DB migrations, DNS and CDN setup remain explicitly manual and separately approved.
6. Review personally: logging privacy/retention, any future cache keys and invalidation, migrations/index order and lock time, rate-limit fairness at shared campus NAT, queue idempotency and retry storms, and whether any health/metrics route discloses internals.

**Capacity estimate:** Unknown. The evidence establishes exactly **zero approved sustained performance runs**; it cannot support a numeric maximum VU/RPS, first-bottleneck claim or hosting-size guarantee. Prior 2-vCPU/4-GiB staging suggestion is only an unverified planning envelope. **Cost:** No new paid infrastructure or service was added. Cheapest next step is approved isolated single VPS + built-in Prisma/MySQL timings and structured logs; consider Redis, broker or CDN only when measured benefit and budget justify them, with a no-new-service fallback.

**Exit:** G1–G14 not proven, iteration 1/5; continue only after isolated data and measurements exist. No commit, deployment or migration performed.


---

## Iteration 2/5 — correct HTTP metrics, offline analysis, internal readiness

**Decision:** Continue evidence collection tooling; stop before unapproved staging load, schema or infrastructure changes. No external/database traffic or production-specific measurements. Earlier iteration 1 measurements remain in the table above.

### Iteration 2 scoreboard (do not infer capacity from synthetic tests)

| Goal | Iteration 2 result | Pass status |
|---|---|---|
| G1 | Read/write p95 **unmeasured in real load**; offline analyzer computes these once staging logs exist. | UNVERIFIED |
| G2 | Query counts/request and N+1 **not traced**; existing query structure unchanged. | UNVERIFIED |
| G3 | SQL EXPLAIN/slow-query counts **not measured**. | UNVERIFIED |
| G4 | DB peak connections **not measured**; no pool reconfiguration. | UNVERIFIED |
| G5 | Public cache hit ratio **not measured**; no cache added. | UNVERIFIED |
| G6 | Slow in-request external work **not measured**; no job service added. | UNVERIFIED |
| G7 | Internal-only DB readiness implementation and tests pass; graceful shutdown tests pass. Actual DB-readiness, 2-instance shared state and failover **not tested**. | PARTIAL; 2-instance UNVERIFIED |
| G8 | Vite produced main JS **157.28 KB gzip**, lazy meetup-map JS **342.59 KB gzip**, CSS **65.75 KB gzip**; this build includes unrelated ongoing UI work. API list/image payload bytes remain unmeasured. | Initial JS size below 250-KB build threshold; remaining UNVERIFIED |
| G9 | Existing 429/request-budget tests pass; no shared rate-limit store, no all-routes coverage or NAT trial. | UNVERIFIED at scale |
| G10 | CDN, Lighthouse and device LCP **not measured**. | UNVERIFIED |
| G11 | Server emits privacy-safe full API route templates, UTC timestamp, method/status/duration and generated request ID. Offline analyzer unit tests **3/3** pass and CLI works on three **synthetic** records. No verified production alert destinations, uptime checks or external metrics aggregation. | PARTIAL, not 5/5 |
| G12 | **0** approved 10-minute load runs; error rate/memory under load unknown. | UNVERIFIED |
| G13 | Safe top-level API unit suite: **246 passed, 1 intentionally skipped, 0 failed**, 50 files. Performance tests **9/9**. Direct API `tsc --noEmit` passed; web production build passed. Full API `prisma generate`/lint/e2e remain unverified. | No new failures in tested scope; FULL goal not verified |
| G14 | Diagnostic tests assert that real path IDs, query strings and bodies are excluded. Internal readiness denies non-loopback/forwarded requests (tested). Broader security scan/multi-instance leak checks not completed. | PARTIAL |
| G15 | **2/5** implementation iterations reached. | Continue only after isolated staging evidence |

**Synthetic-only CLI smoke evidence:** A file of exactly 3 fabricated records yielded accepted=3, observedSeconds=2, averageRps=1.5, peakOneSecondRps=2, successful read p95=120 ms, write p95=430 ms and 1 fabricated HTTP 503. These are **tool-correctness sample numbers, not server performance observations** and cannot be used against G1 or G12.

### Additional findings and corrections

| ID | Priority | Issue / evidence | Resolution / status |
|---|---|---|---|
| PR-16 | P1 | Actual synthetic mounted Express route diagnostic originally omitted the `/api/v1` mount prefix. A dedicated test failed on this case, then passed after the fix. | FIXED; full route templates and timestamp included, no URL parameters logged. |
| PR-17 | P1 | A mounted router's `/` root initially produced an extra trailing slash (`/api/v1/home-page/`), which the analyzer did not group. | FIXED via route canonicalization and regression test. |
| PR-18 | P1 | Only `/health` was defined, checking process liveness rather than database readiness. | FIXED in source via loopback-only `/internal/ready` with `SELECT 1` and 1.5-second deadline; synthetic tests pass, real DB failure still untested. |
| PR-19 | P1 | No existing route latency/error-rate log summarizer; no way to produce G1 summaries from current structured JSON lines. | FIXED offline summarizer and unit tests; **real metrics remain unmeasured** until isolated staging. |

### Iteration 2 modified/added files (no migrations)

- `apps/api/src/request-diagnostics.ts` — add timestamp, correct `/api/v1` mount grouping, normalize router root; protect from dynamic mount leakage.
- `apps/api/test/request-diagnostics.test.ts` — add full-route/PII and router-root assertions.
- `apps/api/src/readiness.ts` — loopback-only, bounded internal DB readiness handler.
- `apps/api/src/app.ts` — register `/internal/ready` before auth/budgets; existing API contracts intact.
- `apps/api/test/readiness.test.ts` — happy path, DB failure, forwarded non-loopback denial and real app route registration tests.
- `performance/summarize-requests.mjs` — offline read/write p95, total/peak RPS, 5xx/429 and route-level analysis; safe validation, no DB/HTTP.
- `performance/summarize-requests.test.js` — synthetic calculations, malformed/private route rejection and nearest-rank percentile.
- `performance/README.md` — operator procedure, private log handling, safety conditions and internal readiness route.
- `docs/API_ROUTE_INVENTORY_2026-11-19.md` — now **118** static routes; internal probe marked loopback-only and raw SQL.
- This report, with iteration 2 verification and remaining blockers.

### Self-review, stop conditions and remaining authorization gates

- Cross-user caches: **none added**; no invalidation or stale-cache regression introduced. Future caching needs separate hit-rate, TTL and invalidation proof.
- DB: **no schema, index, pool or SQL execution performed**; the readiness route is only wired, not called against any existing DB in tests. Query/connection goals remain unverified.
- Logging: request IDs are generated rather than trusting incoming headers; the event contains a route template, never original URLs, user IDs, tokens or request bodies. Analyzer validates route templates and excludes unrecognized raw lines from output. Operator must set log retention, access control and aggregate monitoring before using real logs.
- Security/internal endpoints: readiness is outside `/api/v1` and denies non-loopback physical peers or forwarded clients; production Nginx currently proxies only `/api/`. Do not expose it to public traffic. The unit test only mocks DB success/failure; validate real staging DB connectivity later.
- HTTP API: existing response shapes/statuses unchanged; diagnostic `X-Request-ID` is additive, the new health-detail route is internal only.
- Multi-instance delivery, local uploads, in-memory chat presence/typing, per-process rate limiting, slow queries, queue retries, CDN and alert destinations were **not altered without evidence/approval**. G1–G14 therefore remain not collectively met.
- No commit/deploy, real load, k6, production data access, migrations or new paid services occurred. The web working tree was preserved.

**Iteration 2 exit:** Correctness tests pass, observability tooling and internal readiness improved. Actual sustained 100-RPS/500-user capacity, two-instance behavior, query counts and five alert rules remain **unverified**. Before further tuning, approve a separate synthetic staging database/host with realistic data, instrument per-request SQL/pool measurements, then run a guarded and approved one-user smoke followed by progressively authorized stages.


---

## Iteration 3/5 — remove unnecessary auth data, ensure bounded exit, measure response Content-Length

**Scope:** Code-only, no schema, no new service and no change to existing API JSON contracts or business logic. This iteration fixes confirmed source-level issues; there are still no approved sustained staging measurements.

### Scoreboard (iteration 3)

| Goal(s) | Evidence / after change | Result |
|---|---|---|
| G1, G2, G3 | Real p95, query-count-per-request, N+1 and EXPLAIN are still unavailable without isolated realistic DB and traffic. | UNMEASURED |
| G4, G5, G6 | Pool utilization, cache hit rates and slow background work still lack staging measurements. No speculative pool/cache/queue added. | UNMEASURED |
| G7 | Shutdown now has one deadline across HTTP drain **and** DB disconnect; synthetic hanging-disconnect test reproduced old timeout failure and now passes. Two-instance behavior is still untested. | PARTIAL |
| G8 | New opt-in response `Content-Length` telemetry and offline analyzer report known size counts and maximum per route. This is *not* gzip wire size. Latest web build: main JS **157.35 KB gzip**, lazy map JS **342.59 KB gzip** and main CSS **66.10 KB gzip**; device/payload target not verified. | PARTIAL |
| G9, G10 | No change to rate budgets, shared-store guarantees, CDN, Lighthouse or LCP. | UNVERIFIED |
| G11 | Existing structured request logs now include `responseBytes` when available; analyzer unit test confirms aggregation and unknown-size handling. External monitoring/alert destinations still unverified. | PARTIAL |
| G12 | 0 approved 10-minute staging load tests, error rate under load unknown. | UNVERIFIED |
| G13 | **249 pass, 1 intentional skip, 0 fail**, across 51 safe top-level API unit files; **10/10** offline performance tests; standalone API TypeScript and Bun bundle pass; web production build pass. No full integration/DB/e2e/migration tests run. | PASS in tested scope only |
| G14 | Authentication `findUnique` now explicitly selects **id, email, displayName, status, role and campusId**; it never fetches the password hash for JWT authorization. Existing live status/roles checks preserved. | FIXED specific overfetch; broader security UNVERIFIED |
| G15 | Iteration **3/5**. | Partial exit; do not claim G1-G14 passed |

### Findings register (iteration 3)

| ID | Priority | Evidence before | Change and verification | Status |
|---|---|---|---|---|
| PR-20 | P1 security/data minimization | Every bearer-authenticated request called `user.findUnique({ include: { roles: true } })`, retrieving unused `User` scalars including `passwordHash`. | Use typed minimal `select` for used fields/roles; synthetic projection test and API typecheck passed. No query-time improvement was measured. | FIXED |
| PR-21 | P1 restart reliability | Graceful-shutdown watchdog was cleared when HTTP closed, even if `prisma.$disconnect()` hung indefinitely. A regression test failed under the previous implementation. | One 15s total deadline; force-close lingering connections and exit nonzero if drain/disconnect does not finish; 2 synthetic tests pass. Runtime shutdown drill still needed. | FIXED IN CODE |
| PR-22 | P2 liveness | `/health` was registered after `authenticate`; a valid bearer could trigger an unnecessary user/roles lookup on a liveness request. | Route now registered before authentication, with unchanged public JSON. Existing high-volume health/budget tests and valid-JWT liveness response test pass. | FIXED IN CODE |
| PR-23 | P2 payload visibility | HTTP diagnostic log had no response size; G8 was not measurable from it. | Add optional application-side `Content-Length` bytes and offline per-route size summary; tests pass, compressed wire payload remains unmeasured. | FIXED IN CODE (measurement ready) |

**No optimization claims without measurements:** Row/byte reduction in auth is established by the source-level projection, not a timed SQL baseline. The 100 RPS, 500 VU, query-index/connection/queue, 2-instance and cache/CDN objectives remain explicitly **unverified**.

### Files changed in this iteration

- `apps/api/src/auth.ts`, `apps/api/test/auth-query-projection.test.ts` — minimal authorized-user projection and test.
- `apps/api/src/graceful-shutdown.ts`, `apps/api/test/graceful-shutdown.test.ts` — end-to-end deadline across HTTP and DB disconnect.
- `apps/api/src/app.ts`, `apps/api/test/http-request-budgets.test.ts` — liveness route registered before authentication with contract tests.
- `apps/api/src/request-diagnostics.ts`, `apps/api/test/request-diagnostics.test.ts` — optional response `Content-Length` log and test.
- `performance/summarize-requests.mjs`, `performance/summarize-requests.test.js`, `performance/README.md` — size counts and explicit pre-gzip limitations.
- `docs/CPSU_PRODUCTION_READINESS_AUDIT_2026-11-19.md` — updated scoreboard and evidence.

### Self-review and pending gates

- No new cache keys or background jobs. Existing user data remains uncached. No route response field/status was changed; new log fields are internal diagnostic records.
- No raw URLs, tokens, credentials, user IDs or SQL are exposed by access logs. `Content-Length` is numeric only and nullable when not known; no source log lines are printed by the analyzer.
- A test originally using a Prisma delegate spy could not reliably prove zero DB reads because Prisma delegates are proxied; it was replaced by a direct liveness contract test, and the route ordering itself now statically ensures authentication is skipped. Avoid claiming this is a live DB outage test.
- Shutdown code now force-exits after a bounded timeout to permit a supervisor restart; the timeout/real SIGTERM killover requires verification on an isolated staging host.
- The remaining priority blockers are PR-03 through PR-15 as applicable: multi-instance chat state, unbounded conversation/store-detail reads, rate-limit shared storage, query/index/pool measurements, alerts and capacity testing. Follow `performance/README.md` and obtain explicit host/traffic/data authorization before proceeding.

**Exit: Iteration 3 completed with safe code fixes and passing offline regressions; full production readiness remains unverified. No migrations, deployments, commits, or shared-database changes.**


---

## Iteration 4/5 — bounded PWA message polling and cursor-based chat history

**Goal addressed:** Stop both PWA chat readers from repeatedly downloading an entire growing conversation every three seconds, without hiding history or breaking existing clients. No database, schema, index, production traffic, deployment or external service was modified.

### Before / after (source and test evidence)

| Dimension | Before | After | Evidence / remaining scope |
|---|---|---|---|
| Full-page chat 3-second polling | `GET /inquiries/:id/messages` returned every message in the thread | `GET /inquiries/:id/messages?limit=50` | The Prisma query uses `take: 51` solely to identify whether an earlier page exists; at most 50 messages are returned. Source/test verified; no live SQL timed. |
| Floating chat 3-second polling | Same unbounded history | Same 50-message recent window; link to full chat for earlier history | PWA code and focused tests verified. |
| Access to older history | Complete history returned on every poll | Full conversation provides explicit “Load earlier messages”; `beforeId` retrieves earlier IDs without offset scan | Older pages are deduplicated and merged by ID, preserving already loaded receipts and the reader's scroll anchor. |
| Delivery receipt semantics | Recipient GET marked all other-participant messages delivered | Paged GET marks only fetched recipient messages delivered, with no update if none are pending | Legacy unpaged GET keeps old delivery semantics. Real DB race testing pending. |
| Authorization | `participantThread` guard before message read | Same participant guard plus bounded input validation before DB lookup | Static and unit tests pass; real auth+DB integration remains pending. |
| Legacy HTTP clients | Original unpaged JSON response | Original unpaged JSON response retained, including whole-history behavior | **Still unbounded for legacy requests**; deliberate temporary compatibility, not full eradication of this risk. |

### Verification

- API safe top-level suite: **252 passed, 1 intentionally skipped, 0 failed** across 52 files, 899 assertions.
- Web safe suite: **162 passed, 0 failed** across 44 test files, 633 assertions.
- API TypeScript and Bun bundling: passed.
- Web TypeScript and Vite production build: passed; main JS **157.94 kB gzip**, lazy meetup-map JS **342.61 kB gzip**. These are build sizes, not mobile device/Lighthouse measurements.
- New API `test/message-pages.test.ts`: pagination sorting, `take: limit+1`, `beforeId` filter, stable chronology and rejection of bad/too-large cursor values.
- New web `test/message-history.test.ts`: deduplicated merge, refreshed read receipts, bounded chat-view requests and explicit older-page controls.
- No query plan, DB connection-pool traces, seeded DB, multi-instance chat, browser accessibility trial, or approved k6 traffic was run. Hence **no claim of measured p95 speedup or 100-RPS capacity**.

### Source changes

- `apps/api/src/routes/inquiries.ts` — optional `limit`/`beforeId` paged messages, participant-first protection, receipt update scoped to returned IDs, `hasEarlier` metadata only for paginated requests; legacy unchanged.
- `apps/api/src/message-pages.ts` — standalone parser, query builder, page transformation.
- `apps/api/test/message-pages.test.ts` — bounded query/cursor validation tests.
- `apps/web/src/pages-account.tsx` — page on demand, merge history during polling, preserve scroll position, visible loading/error feedback.
- `apps/web/src/floating-chat-panel.tsx` — bounded quick-view messages and “View earlier messages in full chat” link.
- `apps/web/src/message-history.ts`, `apps/web/test/message-history.test.ts` — pure stable merge with tests.

### Remaining priority risks / iteration 5 candidates

1. `GET /inquiries` still reads all conversation threads; add opt-in or coordinated default pagination with consumer support.
2. Public store detail still fetches every published listing in the nested store query, and slug resolution loads all visible store names. Measure and add paged catalog data without breaking store routing or slug uniqueness.
3. Legacy unpaged `/inquiries/:id/messages` is still an unbounded compatibility path. Once deployed PWA clients are migrated, plan a versioned change or backwards-compatible limit policy; **do not silently truncate chat history** for clients that lack an older-message control.
4. Validate actual query plans for `(threadId, id)`, transaction/receipt updates and store-related queries on a separately authorized isolated staging DB before designing indexes; no migration authorized yet.
5. Two-instance presence/typing, per-process rate limiting and 10-minute 100-RPS/500-concurrent capacity targets remain entirely **unverified**. Do not add Redis or queues without measurement and operations approval.

**Disposition: iteration 4/5 complete in source and offline regression tests; system still NOT production-capacity-certified. No commit, deploy, shared database operation or staging traffic.**
