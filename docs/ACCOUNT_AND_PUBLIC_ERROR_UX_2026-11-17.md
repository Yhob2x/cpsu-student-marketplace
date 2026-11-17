# Account and public-page recovery UX — 17 November 2026

## Implemented

- Registration keeps entered values while campus options load or fail. It announces loading, offers **Retry campuses**, and blocks submission until an active campus list is available. The server still validates the chosen campus.
- Listing and store detail pages distinguish an API 404 from a failed request. Only a 404 says the resource is unavailable; other errors offer Retry and a route back to Explore. A stale response cannot replace a newer request after route changes or retry.
- Guest save and message entry points use a listing-specific sign-in URL. Sign-in and registration accept only an explicit allowlist of local destinations, including a positive numeric listing URL, then return to that listing. No action is automatically submitted after sign-in.

## Password recovery dependency

Password recovery is required by blueprint Module 01 and tracked as KI-004/WP7. The API currently has no mail transport or sender configuration. A secure self-service flow requires an approved delivery channel for single-use tokens, plus token storage, expiry, rate limits, session revocation, and end-to-end testing. No reset endpoint or UI was added without a verified delivery channel. The institutional transport and sender are requested from the project owner; KI-004 remains open.

## Verification

Web TypeScript and Vite production build passed; focused tests cover the return-path allowlist and 404 classification. Headless Chrome checked registration, 404 listing/store pages, and retention of the listing destination on the sign-in page. Network-failure Retry interaction and physical-device acceptance remain to be exercised.
