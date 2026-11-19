# CPSU Market — isolated capacity-test harness

Prepared 2026-11-18. **Not permission to run a load test.** No performance load is authorized or executed by these files.

## What exists

- `config.js`: gated stage profiles and weighted workload selection.
- `load.js`: configurable k6 journeys: homepage, Explore, details, inbox, seller reads, store connections/reviews, transactions and notifications.
- `writes.js`: separate, one-iteration synthetic follow/unfollow/message smoke. It **changes synthetic records**, and is disabled unless independently approved.
- `fixtures.example.json`: intentionally no accounts or actual IDs. Never store real credentials here.
- `config.test.js`: offline Bun unit tests for safety and workload setup.
- `PERFORMANCE_READINESS_2026-11-18.md`: assessment and release gates.

## Stop before generating any traffic

1. Obtain explicit permission for the **exact** target, concurrency stage, traffic type, and time window.
2. Establish a separate synthetic MariaDB schema named `cpsu_marketplace_test`, `cpsu_marketplace_perf`, or `cpsu_marketplace_staging`. Existing dev database `cpsu_marketplace` is **not allowed**.
3. Start a dedicated test API process configured to use that schema and test-only uploads, secrets, push switches off, and outbound integrations disabled. Verify its actual resolved DB connection, not just an environment-variable claim. Use a separate port; do not point this harness at the ongoing developer API.
4. Confirm no real student accounts, conversations, media, push recipients, external services or university endpoints are reachable. Do not trigger real transactions.
5. Install k6 separately through an approved mechanism. It is **not currently installed** on the Windows workstation.
6. Use synthetic `.test` accounts only. For mixed-load stages above baseline, fixture account count must meet or exceed stage maximum VUs and contain buyer and seller roles. Choose a dedicated distinct account per virtual user.
7. Verify logs/monitoring before load (API p50/p95/p99, HTTP 429/5xx, DB queries and pool, CPU, memory, disk, network and recovery).

The harness only validates the **operator's declaration** of `PERF_DB_NAME` and `PERF_DB_VERIFIED`; it cannot independently inspect which database the running server uses. A human or approved isolated preflight must confirm the live process points at the isolated DB.

## Offline test (safe to run now)

```powershell
cd C:\Users\acer\Downloads\cpsu-student-marketplace
bun test performance/config.test.js
```

## Future one-user smoke example — only after isolation is verified

```powershell
$env:PERF_ISOLATED = 'I_CONFIRM_SYNTHETIC_ONLY'
$env:PERF_DB_NAME = 'cpsu_marketplace_test'
$env:PERF_DB_VERIFIED = 'I_CHECKED_API_DATABASE_TARGET'
$env:PERF_BASE_URL = 'http://127.0.0.1:4401'
$env:PERF_PROFILE = 'smoke'
$env:PERF_FIXTURES = './performance/fixtures.local.json'
k6 run performance/load.js --summary-export performance/results/smoke.json
```

Create `performance/results/` only when a test is approved. Create `fixtures.local.json` from `fixtures.example.json` with **synthetic test accounts**, e.g. `{"email":"buyer0001@load.cpsu.test","password":"<test-only value>","role":"student"}`, and `{"email":"seller0001@load.cpsu.test","password":"<test-only value>","role":"seller"}`. The test buyer must be a legitimate participant in any listed test conversation. Never commit fixture credentials.

**Important:** Running smoke with an empty fixture covers public endpoints only. Auth-required journeys are skipped and results cannot represent the specified mixed workload.

## Significant stages — locked

`PERF_PROFILE` can be `baseline` (up to 10 VUs), `normal` (300), `busy` (750), `peak` (1,500), `stress` (3,000), `maximum` (15,000), or `soak` (300 over two hours).

For **normal and above**, set `PERF_APPROVED_STAGE` to the exact profile name and `PERF_STAGING_APPROVED=YES` only after formal stage-specific approval. Above 300 VUs also requires `PERF_CAPACITY_APPROVED=YES` and appropriately sized isolated load generators. Approved non-loopback targets require exact `PERF_APPROVED_HOST`, HTTPS, and staging approval. Campus live sites and CPSU services must never be load tested.

The profiles are starting proposals, not estimates of real peak usage or safe server capacity. Keep the existing rate limits enabled and **record 429s instead of bypassing security**. Stop on error rate / latency thresholds and operator-defined CPU, memory, I/O, pool saturation, and campus-network thresholds. The k6 thresholds cannot monitor host safety unaided: pair with out-of-band telemetry and an operator kill switch.

## Mutation smoke — separately approved

Use `performance/writes.js` only after the above safety gate plus:
```powershell
$env:PERF_ENABLE_WRITES = 'YES'
$env:PERF_APPROVED_WRITES = 'I_APPROVE_SYNTHETIC_MUTATIONS'
$env:PERF_WRITE_FIXTURES_VERIFIED = 'I_VERIFIED_ALL_SYNTHETIC_IDS'
```
Fixtures must contain `writePlan.followStoreId` for a visible synthetic store **not owned by the buyer**, and `writePlan.threadId` for an already open synthetic conversation in which the buyer participates. The script follows, unfollows, and creates exactly one synthetic message. This message is not automatically deleted, so dispose of the isolated database after the experiment under approved retention rules. Listing updates, publishing, actual purchases, real push and admin decisions are intentionally **not** automated.

## Measurement and interpretation

- Each VU executes weighted **journeys**, with realistic 3–20 s think time; endpoint count and request rate are derived from observed k6 requests, not directly inferred from VU count.
- Default weights reflect the supplied hypothetical mix: home 25%, Explore 25%, detail/store 20%, chat 10%, seller 8%, social 5%, transactions 5%, notifications 2%. Report skipped journeys and auth errors; do not treat incomplete data as representative.
- HTTP-based messages may mark delivery receipts read in the database even on GET; run only on synthetic accounts.
- k6 VUs are API clients, **not full browser-rendered sessions**. Report browser LCP, INP, CLS, image, PWA and mobile throttling separately with real Playwright or device tests when installed and permitted.
- Do not estimate server size from VU count alone. Capture achieved RPS, actual request mix, percentiles, CPU/RAM/pool usage, and recovery.
- If any planned API or optional schema is unavailable, record the skipped feature rather than fabricating results. Store reviews may be staged/not ready depending on migration activation.

## Data-growth scenarios (not seeded)

The planned isolated datasets should model 1,000, 5,000 and 15,000 synthetic students, explicit verified-affiliation and seller proportions, listings/store, message-thread lengths, followers, transaction states and review counts. Record all distribution assumptions; only seed after separate authorization. Never reuse development/production student tables.

## Iteration 2: offline request-log summary (no traffic generated)

API responses now include a generated `X-Request-ID`. Structured `http_request` JSON log lines are enabled by default when `NODE_ENV=production`; use `HTTP_ACCESS_LOG_ENABLED=true` to opt in on an approved isolated test API, or `false` to opt out. Each record includes an ISO UTC timestamp, HTTP method, **route template** (never the request URL), response status and total request duration in milliseconds. No query strings, URL IDs, request/response bodies, auth tokens or student identifiers are logged.

Capture **only the isolated staging instance's** JSONL console logs into an operator-owned, access-controlled local file. With a verified private file, analyze it offline using Bun:

```powershell
bun performance/summarize-requests.mjs .tmp/staging-access.jsonl
bun test performance/config.test.js performance/summarize-requests.test.js
```

The analyzer prints observed read/write p95, route-level p95, server errors, 429 counts, average requests/sec over the observed window, and the peak one-second count. It skips unrelated/malformed lines and refuses to present a summary if **zero** valid diagnostic records exist. The analyzer makes no network calls, reads no DB, and never prints source log lines. The results are **not a capacity certification** unless the input covers a verified 10-minute approved isolated mixed workload, with load generator metrics, SQL traces, CPU/RAM/pool and recovery evidence. Keep diagnostic files private and define retention before collecting real logs.

Internal readiness is available at `GET http://127.0.0.1:<PORT>/internal/ready` only from loopback, not under the public `/api/` Nginx proxy. It checks `SELECT 1` with a 1.5 s response deadline and returns only `{ "ok": true|false }`; non-loopback or forwarded public IPs receive 404. It is **not** a replacement for the cheap public `GET /health` liveness probe. Do not expose `/internal/ready` through Nginx.
