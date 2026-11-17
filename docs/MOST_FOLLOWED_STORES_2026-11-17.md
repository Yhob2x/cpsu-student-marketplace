# CPSU Market — Most followed stores (2026-11-17)

## Product decision
The owner approved adding a Most Followed Stores section to the home discovery page. It uses real StoreFollow relationships rather than a vaguely defined "popular" metric. The existing Popular Listings (based on saves) is unchanged.

## Implementation
- The unauthenticated GET /api/v1/stores/most-followed returns up to four approved stores with active owners, at least one available published listing and at least one actual follower.
- Rankings sort by real follower count descending, with store ID ascending as a deterministic tie-break. Counts come from persisted StoreFollow and filtered Listing relations. No names or identities of followers are exposed.
- The response includes existing public store identity data: store ID, name, campus, optional sanitized avatar URL, real follower count and number of published/available listings. It sets Cache-Control: no-store to avoid presenting obsolete counts as a fresh ranking.
- Older API clients or databases without StoreFollow return available=false and no items. Missing data is not represented as 0 followers. Unexpected API errors still surface.
- Home renders four responsive cards after Fresh, Popular and Student Services rails. Each links to /stores/:id. If there are no followed eligible stores, the section is omitted rather than inventing placeholders.
- No new user action, schema/table, migration, external API, payment, ranking purchase, or premium placement was added.

## Verification
- API TypeScript: bunx tsc -p . --noEmit — PASS.
- API synthetic tests: 3/3 PASS (real-field query, unavailable-table/client, unexpected errors).
- Web TypeScript + Vite production build — PASS.
- Complete web test suite: 73/73 PASS, including the new component-specific tests.
- Local live endpoint probe returned HTTP 429 (rate limiter); live data, device/browser display and interactive runtime verification remain **not confirmed**, not falsely marked PASS.
- No DB writes/migrations, deployment, commit or push were performed. Existing unrelated dirty files were preserved.

## Files
- New: apps/api/src/most-followed-stores.ts, apps/api/test/most-followed-stores.test.ts, apps/web/src/most-followed-stores.tsx, apps/web/src/most-followed-stores.css, apps/web/test/most-followed-stores.test.tsx.
- Modified: apps/api/src/routes/public.ts, apps/web/src/pages-public.tsx.
