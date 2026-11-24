# CPSU Market — isolated capacity-test harness

Prepared 2026-11-18. **Not permission to run a load test.** No performance load is authorized or executed by these files.

## What exists

- `config.js`: gated stage profiles and weighted workload selection.
- `target-probe.js`: authenticated k6 preflight; rejects a running API that cannot attest its verified synthetic database identity.
- `apps/api/src/perf-isolation.ts` and `perf-start.ts`: a separate **loopback-only** performance API entrypoint that checks the actual selected MariaDB database and counts non-synthetic accounts **before binding port 4401**. Normal API startup does not contain the probe endpoint.
- `apps/api/test/perf-isolation.test.ts` and `performance/perf-gates.test.js`: offline fail-closed safety tests.
- `load.js`: configurable k6 journeys: homepage, Explore, details, inbox, seller reads, store connections/reviews, transactions and notifications.
- `writes.js`: separate, one-iteration synthetic follow/unfollow/message smoke. It **changes synthetic records**, and is disabled unless independently approved.
- `fixtures.example.json`: intentionally no accounts or actual IDs. Never store real credentials here.
- `config.test.js`: offline Bun unit tests for safety and workload setup.
- `PERFORMANCE_READINESS_2026-11-18.md`: assessment and release gates.

## Stop before generating any traffic

1. Obtain explicit permission for the **exact** target, concurrency stage, traffic type, and time window.
2. Establish a separate **dedicated** synthetic MariaDB schema named exactly `cpsu_marketplace_perf`. The general integration schema `cpsu_marketplace_test`, shared staging schema `cpsu_marketplace_staging`, and development DB `cpsu_marketplace` are **not allowed** by the guarded performance launcher.
3. Start a dedicated test API process configured to use that schema and test-only uploads, secrets, push switches off, and outbound integrations disabled. Verify its actual resolved DB connection, not just an environment-variable claim. Use a separate port; do not point this harness at the ongoing developer API.
4. Confirm no real student accounts, conversations, media, push recipients, external services or university endpoints are reachable. Do not trigger real transactions.
5. Install k6 separately through an approved mechanism. It is **not currently installed** on the Windows workstation.
6. Use synthetic `.test` accounts only. For every mixed-load profile **other than smoke**, provide **at least `maxVus` distinct buyers AND `maxVus` distinct sellers** (e.g., 10+10 for a 10-VU baseline), with no duplicate email addresses across pools. Each VU gets a private buyer/seller pair. The alternative `PERF_PUBLIC_ONLY=YES` explicitly skips authenticated journeys and must never be described as mixed load.
7. Verify logs/monitoring before load (API p50/p95/p99, HTTP 429/5xx, DB queries and pool, CPU, memory, disk, network and recovery).

**New mandatory runtime proof:** Declarations `PERF_DB_NAME` and `PERF_DB_VERIFIED` alone cannot authorize traffic. The dedicated API entrypoint `bun src/perf-start.ts` (run from `apps/api`) first checks the exact private migration approval and SHA-256 of each reviewed `migration.sql` source file, then verifies the URL, queries `SELECT DATABASE()` to confirm the **actual selected schema**, checks the applied `_prisma_migrations` names/checksums/completion dates against reviewed source, and counts users whose email does not end in `.test`. Any mismatch, missing schema, or real-user account blocks server startup. The process binds only to `127.0.0.1:4401`, with production-like protections and push/identity collection explicitly disabled. Every k6 load/write script first requests a token-protected **loopback** `/__perf/identity` endpoint from that process and refuses all workload requests if its attestation does not match. No real account data is logged. This is a safeguard, not a substitute for independent host authorization, migration approval and a synthetic-only data inventory.

## Offline test (safe to run now)

```powershell
cd C:\Users\acer\Downloads\cpsu-student-marketplace
bun test performance/config.test.js performance/fixture-policy.test.js performance/perf-gates.test.js performance/summarize-requests.test.js
cd apps/api
bun test test/perf-isolation.test.ts test/perf-migration-policy.test.ts
bun scripts/perf-migration-preflight.ts --audit-only  # Currently exits 1 (BLOCKED), as intended
```

These tests validate simulated/mocked inputs only. They do **not** connect to MariaDB, start the API, or certify capacity.

### Migration approval gate (read-only; currently BLOCKED)

The repository currently has **15** migration folders, including the uncommitted `20261119150000_push_delivery_outbox`. Every new, removed or changed migration must be explicitly reviewed before loading synthetic data. This is not approval for push enrollment or delivery.

Run `bun scripts/perf-migration-preflight.ts --audit-only` from `apps/api`. It lists only migration names and SHA-256 checksums and **returns a nonzero BLOCKED result** until a private approval record exists. The tracked `performance/perf-approval.example.json` is inert. After a designated host/privacy/migration reviewer actually approves an exact schema snapshot, record the evidence references and **every** `{ "name": "<migration folder>", "sha256": "<full fingerprint>" }` in untracked `performance/perf-approval.local.json`; never copy the example and flip flags without real approvals. The private file is Git-ignored and must contain no secrets or personal data. This gate is part of the guarded API startup itself, not just documentation.

The launcher also reads only the actual synthetic database's Prisma migration history and refuses mismatched, missing, changed, incomplete or rolled-back applied migrations. It does **not** invoke Prisma migration commands, seed records or connect to any database during an offline preflight. Separate independent checks are still necessary to ensure all synthetic records/media are approved, not merely that user email addresses end in `.test`.

## Future one-user smoke — BLOCKED until independent isolation approvals and fixtures exist

**DO NOT run now.** First approve the staging database creation and migration inventory, provision a separate *synthetic-only* MariaDB schema/DB account, confirm private upload storage/retention, set a separate JWT key, then install k6. None is confirmed yet. A working k6 client **cannot** by itself prove API/database isolation.

The guarded API launcher (not the ordinary `src/index.ts`) requires these environment settings on the dedicated API process: `PERF_ISOLATED=I_CONFIRM_SYNTHETIC_ONLY`, `PERF_DB_VERIFIED=I_CHECKED_API_DATABASE_TARGET`, `PERF_DB_NAME=cpsu_marketplace_perf`, `DATABASE_URL=mysql://<synthetic-DB-user>:<secret>@127.0.0.1:3306/cpsu_marketplace_perf`, `NODE_ENV=production`, `PORT=4401`, `BIND_HOST=127.0.0.1`, `COOKIE_SECURE=true`, `PUSH_SUBSCRIPTIONS_ENABLED=false`, `PUSH_DELIVERY_ENABLED=false`, `STUDENT_ID_COLLECTION_ENABLED=false`, `MEDIA_STORAGE=local`, local-only `CORS_ORIGINS`, and an **absolute** `UPLOAD_DIR` inside the repository `.tmp/perf-uploads` scratch directory. A separately generated random `PERF_TARGET_TOKEN` of at least 32 characters must be passed securely to both the guarded API process and k6; do not commit or paste the token or any database password. The entrypoint checks `SELECT DATABASE()` and aggregate non-`.test` account count before listening. Start it from `apps/api` with `bun src/perf-start.ts` **only** after approved provisioning; on failure, no port should open.

After independent host/DB verification, set the **matching** k6 process environment, including `PERF_TARGET_TOKEN`, `PERF_BASE_URL=http://127.0.0.1:4401`, `PERF_PROFILE=smoke` and the other `PERF_*` declarations, then use:

```powershell
# Approved separately; not executed by this audit.
cd C:\Users\acer\Downloads\cpsu-student-marketplace
k6 run performance/load.js --summary-export performance/results/smoke.json
```

In k6 `setup()`, the first request is only to the token-protected `/__perf/identity`; every workload is aborted unless it reports the exact synthetic database. This probe is loopback-only; it is not a public deployment endpoint. Later remote HTTPS load requires a separately designed approved private probe channel rather than exposing it through public Nginx. Read p95 threshold is **300ms** and synthetic write p95 threshold is **500ms**; neither has been measured on a real isolated workload.

Create `performance/results/` only when a test is approved. Create `fixtures.local.json` from `fixtures.example.json` with **synthetic test accounts**, e.g. `{"email":"buyer0001@load.cpsu.test","password":"<test-only value>","role":"student"}`, and `{"email":"seller0001@load.cpsu.test","password":"<test-only value>","role":"seller"}`. The test buyer must be a legitimate participant in any listed test conversation. Never commit fixture credentials.

**Important:** Running smoke with an empty fixture covers public endpoints only. For baseline and above, `PERF_PUBLIC_ONLY=YES` explicitly opts out of authentication; otherwise the fixture gate enforces separate buyer/seller identities for each VU. A public-only run is never mixed-load evidence.

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

API responses now include a generated `X-Request-ID`. Structured `http_request` JSON log lines are enabled by default when `NODE_ENV=production`; use `HTTP_ACCESS_LOG_ENABLED=true` to opt in on an approved isolated test API, or `false` to opt out. Each record includes an ISO UTC timestamp, HTTP method, **route template** (never the request URL), response status, total request duration in milliseconds, and `responseBytes` when the API's `Content-Length` header is available. This byte count is the application response size before any reverse-proxy compression; it is **not gzipped transfer bytes**. The offline analyzer reports known-size counts and maximum declared sizes separately; missing sizes remain unknown. No query strings, URL IDs, request/response bodies, auth tokens or student identifiers are logged.

Capture **only the isolated staging instance's** JSONL console logs into an operator-owned, access-controlled local file. With a verified private file, analyze it offline using Bun:

```powershell
bun performance/summarize-requests.mjs .tmp/staging-access.jsonl
bun test performance/config.test.js performance/summarize-requests.test.js
```

The analyzer prints observed read/write p95, route-level p95, server errors, 429 counts, average requests/sec over the observed window, and the peak one-second count. It skips unrelated/malformed lines and refuses to present a summary if **zero** valid diagnostic records exist. The analyzer makes no network calls, reads no DB, and never prints source log lines. The results are **not a capacity certification** unless the input covers a verified 10-minute approved isolated mixed workload, with load generator metrics, SQL traces, CPU/RAM/pool and recovery evidence. Keep diagnostic files private and define retention before collecting real logs.

Internal readiness is available at `GET http://127.0.0.1:<PORT>/internal/ready` only from loopback, not under the public `/api/` Nginx proxy. It checks `SELECT 1` with a 1.5 s response deadline and returns only `{ "ok": true|false }`; non-loopback or forwarded public IPs receive 404. It is **not** a replacement for the cheap public `GET /health` liveness probe. Do not expose `/internal/ready` through Nginx.
