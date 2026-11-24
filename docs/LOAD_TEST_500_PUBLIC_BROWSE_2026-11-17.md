# Public browsing load check — 17 November 2026

## Scope

Simulated 500 visitors browsing the local API concurrently. Each visitor requested categories, a listings page (`pageSize=8`), fresh listings, and the first listing detail. Requests were GET only; no student account, credential, database write, or external service was used. The first run gave each visitor a distinct benchmark IP. The second run placed all visitors behind one benchmark IP to model a crowded campus network. Response times reflect a local machine, not production capacity.

## Results

| Scenario | Requests | Successful | Failed | Elapsed |
| --- | ---: | ---: | ---: | ---: |
| 500 distinct IPs | 2,000 | 2,000 | 0 | 1,064 ms |
| 500 visitors sharing one IP | 1,500 | 300 | 1,200 | 170 ms |

For distinct IPs, p95 response time was 134 ms for categories, 473 ms for listing pages, 534 ms for fresh listings, and 254 ms for listing detail. All responses were HTTP 200. In the shared-IP run, categories returned 300 HTTP 200 and 200 HTTP 429. Every listing-page and fresh-listings request returned HTTP 429; no visitor reached detail. The API remained healthy afterward: `/health` and `/api/v1/listings?pageSize=1` returned HTTP 200 from a fresh IP.

## Finding

The global API rate limit of 300 requests per minute per IP can prevent students on the same campus Wi-Fi or NAT from browsing even when the service itself is healthy. The simultaneous 500-visitor pattern is a worst case, so this does not establish the failure rate under ordinary traffic. Review separate limits for anonymous public reads and sensitive actions, plus cache behavior, before changing the security policy. No rate-limit or database change was made in this check.
