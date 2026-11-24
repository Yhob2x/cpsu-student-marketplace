# CPSU Market — Performance and Capacity Readiness, 18 November 2026

**Status: PREPARATION ONLY. NO k6 TRAFFIC GENERATED. NO MEASURED CAPACITY CLAIM.**

## A. Executive summary

The codebase is operational as a local React/Vite PWA backed by Express 5, Bun, Prisma, and MariaDB/MySQL. Its ability to support a university population of ~15,000 students **cannot be established** until an isolated deployment, synthetic adoption dataset, instrumentation, and approved workload exist. Enrollment population is not concurrent users. No domain or approved production-like HTTPS staging server exists in the current project hosting proposal.

The Windows development workstation reports Intel i7-13700, 16 physical cores/24 logical processors, ~31.7 GiB RAM and ~236.7 GiB free on C:. This is **not production-host capacity**. k6 is not installed. The working tree contains extensive unrelated concurrent work, including staged store review features: no existing source or schema was changed in this task.

## B. What is measured (and what is not)

| Metric | Actual result as of 2026-11-18 |
|---|---|
| Highest k6 virtual users | **Not tested** |
| Completed sustained-load scenarios | **0** |
| Measured RPS / successful RPS | **Not available** |
| Peak concurrent HTTP sessions | **Not measured** |
| API p50 / p95 / p99 under load | **Not measured** |
| HTTP error rate under load | **Not measured** |
| Database CPU / pool under load | **Not measured** |
| Recovery time after saturation | **Not measured** |
| k6 installed | **No** |
| Offline guard/workload unit tests | **6 passing** |

Earlier isolated conversation close/send contention is documented in `docs/CONVERSATION_STRESS_SAFARI_B2_GATE_2026-11-17.md`: 40 contention rounds, 120 successful contested sends and 31 expected HTTP 409 serialization conflicts, with consistent resulting message and notification counts. This evidence is for bounded isolated correctness tests, **not sustained RPS, capacity, or real-device latency**.

## C. Current route and architecture inventory

- Public read routes: `/api/v1/home-page`, `/categories`, `/listings` (search, category, campus, type, condition, min/max price, sorting, pagination), `/listings/fresh`, `/listings/popular`, `/listings/:id`, `/seller-profiles/:id`, `/stores/most-followed`, `/seller-profiles/:id/connections`, and optional `/seller-profiles/:id/reviews`.
- Identity: `/auth/login`, `/auth/refresh`, `/me`. Access tokens expire after **15 minutes**, and each authenticated API request retrieves the user's current account/roles from MariaDB.
- Messaging: `/inquiries`, `/:id/messages`, presence/typing/seen. Transport is HTTP polling, not WebSocket. Client polling includes 3-second focused-thread and 5-second list refresh intervals.
- Seller: `/seller/store`, `/seller/listings`, follower aggregates; draft and media mutations exist but are excluded from default read-load.
- Transactions: `/transactions`, `/:id` and guarded state-changing endpoints. Reviews are linked to completed transactions and feature-gated until database activation.
- Notifications: `/notifications/unread-count` and `/notifications`; Web Push is separately policy-gated.
- Database: indexed listing discovery, store follows, transaction participant/state and review moderation lookups. Actual index choices and table sizes must be tested with `EXPLAIN` against **synthetic** datasets.

## D. Priority findings to validate under approved load

| Priority | Potential bottleneck / observation | Required evidence |
|---|---|---|
| P1 | Express per-IP budget of **900 GET/min** and **300 non-GET/min** is a possible fairness issue behind shared campus NAT. At a 3-second foreground poll, 50 clients can generate ~16.7 reads/second from one public IP before any other requests, above 900/60=15 reads/second. These figures are an arithmetic scenario, not observed CPSU traffic. | Distribution by IP, 429 rates by route/identity, NAT modeling and appropriate security review. **Do not disable limits.** |
| P1 | Every bearer-authenticated request performs a user + roles lookup. This increases database work at higher read rates. | Query count/request, p95 under read load, DB CPU and pool waits. |
| P1 | `GET /inquiries/:id/messages` retrieves **all messages in the thread** without page-size caps and updates unread delivery receipts on GET. High-volume or long conversations may be costly. | Vary conversation lengths, rows/bytes/query, lock/contention, polling volume, delivery correctness. |
| P1 | Public store details include **all available published listings** for a seller, without explicit pagination in that nested relation. | Store size distribution, payload size, p95/p99 as listings grow. |
| P2 | Listing search performs a `count` and paginated `findMany`, and text `contains` filters may not use a selective search index. | `EXPLAIN`, scans/temporary sorts at 1k/5k/15k synthetic student scales, first vs deep pages. |
| P2 | Frequent unread counts, follower aggregate reads and popular/fresh listing queries may amplify load; review migration is a separate compatibility gate. | Per-route QPS, slow-query trace, counts and sort plans; optional schema readiness. |
| P2 | PWA caches static offline assets only, not API responses or user content; repeat browsing still calls the network. | LCP/INP/CLS, transfer bytes and round trips on real phones and throttled networks. |
| P2 | Message send/close serializable transactions can return HTTP 409 under collision, as observed in bounded isolated tests. | Correct retry UI, no duplicate/lost operations, 409 rate by workload. |

The table identifies **suspected risks**, not benchmark-proven bottlenecks. Do not change indexes, code, rate limits or architecture based on hypotheses alone.

## E. Model for approximately 15,000 enrolled students

| Hypothetical concurrent fraction | Virtual users / students | Interpretation |
|---:|---:|---|
| 0.5% | 75 | Light simultaneous participation |
| 2% | 300 | Moderate campus activity |
| 5% | 750 | Busy-hour planning case |
| 10% | 1,500 | Aggressive campus peak |
| 20% | 3,000 | Stress scenario, not a demand forecast |
| 100% | 15,000 | Maximum investigation only; not normal expected use |

No conversion from these concurrent-client counts to RPS is defensible without observed request sequencing, browser background behavior, think times, and caching. The prepared k6 journey mix is **hypothetical**: homepage 25%, Explore 25%, detail 20%, messaging 10%, seller reads 8%, store interactions 5%, transactions 5%, notifications 2%.

These mixes are weighted by **journey**, not raw HTTP requests. One journey may generate multiple requests. Browser tab visibility, login cadence, and think-time strongly affect arrival rate. Separate browser timings from API VU measurements.

## F. Hosting planning, not capacity guarantees

The existing staging proposal `docs/CPSU_MARKET_STAGING_HOSTING_PROPOSAL_2026-11-18.md` suggests an **unverified planning envelope** of 2 vCPU, 4 GiB RAM, and 40–80 GiB SSD for a dedicated test environment. It explicitly requires CPSU ICT and DPO decisions. It should **not** be advertised as sufficient for 300, 750, 1,500 or 15,000 concurrent users.

Before specifying hosting tiers, collect workload RPS/peak connections, HTTP and SQL percentiles, storage growth per synthetic cohort, CPU/RAM saturation, upload bandwidth and media size, backup/restore cost and safe headroom. Include Nginx and Bun API separation, DB least privilege/connection limits, storage quotas, encrypted backups and actionable monitoring. No automatic Redis/broker/paid-service introduction.

## G. Acceptance and stop conditions

Preliminary API targets from the provided test plan are p95 under 500 ms and p99 under 1,500 ms for ordinary reads, unexpected error rate <1%, successful valid operations >=99.9%, message delivery p95 <2 s, healthy DB connections, CPU preferably below 80% sustained and no unbounded memory growth or corrupt writes.

These are **objectives**, not achieved results. Per-route budgets and expected 4xx must be separately tracked. Configure k6's 429/5xx and latency thresholds to stop tests. Additional CPU/pool/disk/network stop signals require external monitoring/operator action; the prepared harness does not have privileged host telemetry. Do not execute C–G until approved and appropriately provisioned.

## H. Work delivered and next authorization gates

1. Created `performance/config.js` with strict target/profile/DB declaration guards, eight weighted journey categories, and smoke through maximum/soak stages.
2. Created `performance/load.js` with stateful synthetic authentication, read journeys, 3–20-second randomized think-time, selective media loading, 15-minute-token renewal planning, taggable endpoints and k6 latency/error abort thresholds.
3. Created separately gated `performance/writes.js` for **one** synthetic follow, unfollow and message in an already authorized test thread. No write scenario was run.
4. Added empty `fixtures.example.json`, offline safety tests, `README.md` and a local fixtures/results ignore policy.
5. Confirmed **6/6 Bun offline config tests pass**. A network smoke test, k6 execution and browser LCP/INP/CLS tests remain **not run** because there is no verified isolated running target or k6 installation.

**Next:** institution-approved isolated test database and dedicated API, explicit synthetic data retention/cleanup plan, k6 availability, host/API/DB monitoring, then one-user smoke. Obtain separate permission for any significant load profile. Keep real student traffic, university infrastructure, external push and real transactions out of scope.
