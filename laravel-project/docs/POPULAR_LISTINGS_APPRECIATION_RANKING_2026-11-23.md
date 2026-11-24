# Popular listings: appreciation-aware ranking (2026-11-23)

## Status
Implemented in the local CPSU Marketplace source and verified through the live local API. This is not a deployment approval.

## Motivation and policy
The previous homepage `Popular listings` rail ranked only by `SavedListing` count; genuine, per-product `ListingAppreciation` records were ignored. The updated algorithm uses only persisted interactions on the specific listing. Store followers, store-level appreciations, impressions, fake views, sales, paid promotion and other listings' activity never contribute.

### Score
`score = (3 * appreciations + saves) / (1 + ageHours / 720)`, where `ageHours = max(0, elapsed whole hours since Listing.createdAt)`.

- One appreciation has 3x the weight of one save.
- At 30 days of age, identical engagement scores half the new-listing score, without excluding older listings.
- Count rows separately in the database so a student who both saved and appreciated does not multiply counts.
- Eligibility requires published + available + not soft-deleted listings, an approved student seller, an active owner with no staff roles and a current verified affiliation on an active campus.
- Exclude listings with zero real saves and zero real appreciations; no fabricated popularity. Tie-breaks: appreciation total descending, saves descending, newer creation date, larger listing ID.
- Calculate on every public request across the entire eligible database before selecting the top eight. Return only existing public listing details and a non-sensitive ranking mode, not private user identities or counts.
- A pre-activation database without `ListingAppreciation` falls back to ranking genuine saved rows and responds with `ranking: "saves_only"`. Unexpected database errors propagate.
- A successful appreciate/unlike action refreshes Popular on a mounted homepage; failed actions do not trigger a popularity refresh. Response headers prevent cache staleness.

## Files
- `apps/api/src/popular-listing-ranking.ts` — DB ranking query, score helper and migration-safe fallback.
- `apps/api/src/routes/public.ts` — ranked ID selection, public-only hydration and response.
- `apps/api/test/popular-listing-ranking.test.ts` — score, tie-break query, eligibility SQL, raw-query fallback and errors.
- `apps/web/src/listing-appreciation.tsx` — confirmed engagement event.
- `apps/web/src/pages-public.tsx` — popularity rail refresh.
- `apps/web/test/listing-appreciation.test.tsx` — appreciate and undo refresh event.

## Verification
- Focused API unit suite: 10/10 passing (`popular-listing-ranking`, `listing-appreciations`).
- API TypeScript typecheck passed.
- Local GET `http://127.0.0.1:4000/api/v1/listings/popular` returned HTTP 200, `ranking=appreciations_and_saves` and five eligible listing IDs; no private data inspected.
- Web component tests, TypeScript checks and production build passed. Existing Vite large-chunk warning and preexisting React testing warnings are unrelated.
- No database migration or data writes, no deletion, no Git commit, push, merge or deployment.
- Remaining acceptance: real signed-in student testing of changing order with actual appreciates and saves; full browser/CI coverage and production release gates still apply.

## Superseded by 2026-11-23 per-listing view tracking
The old appreciation-plus-save ranking described above was superseded later on 2026-11-23. Current implementation uses **per-listing appreciation and real listing-detail views** and excludes saves. The authoritative updated implementation and activation record is `docs/LISTING_VIEWS_POPULAR_RANKING_2026-11-23.md`.
