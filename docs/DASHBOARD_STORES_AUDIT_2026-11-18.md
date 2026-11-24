# CPSU Market — /dashboard and public storefront audit

Date: 2026-11-18 (Asia/Manila)
Environment: authorized local Windows development project.
Scope: UI/UX, routing, data loading, owner actions, followers, messaging, authorization, public-store API.
Method: read-only source inspection, live local public API/Chrome checks, synthetic tests, no authenticated real-account testing.

## Routes verified
- `/dashboard`: seller workspace, signed-out visitors are redirected to sign-in with return URL; staff users are redirected to profile.
- `/stores/:id`: supported store-detail compatibility route, redirects to `/store/:slug`.
- `/store/:slug`: public canonical store-detail route.
- `/stores`: **no route**, renders Page Not Found. Implement a directory only if it is intended to be a supported destination.

## Prioritized findings

### P1 — Store links are not immutable
The slug is computed from editable `storeName` (apps/api/src/store-slug.ts), and the frontend replaces `/stores/:id` with `/store/:slug` (apps/web/src/pages-public.tsx, StorePage).
A synthetic before/after rename confirmed `campus-books` -> `campus-supplies` and the old URL no longer resolves. Duplicate handling mitigates some collisions but does not preserve prior renamed links.
**Recommendation:** keep permanent links stable by using an immutable stored slug, guaranteed-ID canonical URLs, or a historical slug redirect table. Add rename/duplicate/deletion regression tests.

### P1 — Dashboard category-fetch failure blocks authoring
`Dashboard` (apps/web/src/pages-account.tsx) catches `/categories` failure into a generic `err`, leaves the select list empty, and has no retry.
**Recommendation:** add `categoriesLoading/categoriesError`, an explicit Retry action, disabled form submission when categories unavailable, and an error-state test.

### P1 — Verification badge and live affiliation validity are not equivalent
The public-store API (apps/api/src/routes/public.ts, sendPublicStore) displays 'Verified CPSU community member' whenever sellerType is `student`, while visibility checks `approvalStatus='approved'` and active owner. It does not revalidate current affiliation status/expiration in this public lookup.
**Recommendation:** define CPSU verification revocation and expiry behavior, then derive badge/public exposure from the authoritative status or explicitly relabel the badge as historic approval. Do not claim a real student is currently misclassified without live verification.

### P2 — Editing does not protect unsaved changes
The create form uses `createDirty`, but inline listing edit Cancel and changing the selected listing clear editor state immediately.
**Recommendation:** track edit dirty state, confirm discard/navigate, and restore focus to the edited listing.

### P2 — Followers count refresh
`StoreFollowers` (apps/web/src/store-followers.tsx) fetches on storeId, selected tab, page, or manual retry only. A new follower does not update the owner's visible count until a trigger or page remount.
**Recommendation:** lightweight foreground/event-driven count refresh; avoid fetching private follower names when dialog is closed.

### P2 — Out-of-order listing requests
`Dashboard.load()` and the 6s foreground refresh can overlap, with no request generation guard.
**Recommendation:** use request IDs or AbortController, retaining the newest successful response. Preserve drafts and ongoing edits.

### P2 — Store slug resolution does table-wide lookups
`visibleStoreNames()` is used for canonical slug generation even for numeric-ID access, and lookup recomputes slug candidates. This is a potential scaling concern.
**Recommendation:** use an indexed immutable slug or ID-based canonical lookup and avoid all-store scans on each profile view.

### P3 — Storefront polish
At desktop width, the in-store search input reserves only 180px and truncates the placeholder. The floating chat button visually floats over part of a listing-card image; preserve the launcher but audit obstruction of card controls while scrolling.

## Positive checks
- `/stores/1` returned public profile JSON with a canonical slug, real listing count, and follow summary; public storefront rendered.
- Storefront responsive geometry measured in real Chrome iframes at 320, 360, 390, and 768px: **no document-level horizontal overflow**. A headless full-window mobile screenshot was misleading due to capture geometry, not a confirmed responsive defect.
- Authenticated seller and private follower routes have ownership checks; public store filters act on supplied listings and distinguish products from services.
- Store messaging is tied to a published, available listing; no fabricated listings observed.
- 10 web-focused tests passed across storefront-chat, storefront-filter, and store-followers-view; web TypeScript check passed.
- 13 API-focused tests passed across store-slug, store-follows-http, and store-followers-private.
- Tests emitted React server-render warnings (`useLayoutEffect`, list key) but no failures. Review test harness key warnings separately.

## Limits and safety
- No real student/store-owner login was used. The authenticated /dashboard visual state and full user-to-user authorization paths were assessed from source and synthetic tests, not a live signed-in browser walkthrough.
- No API writes, database migrations, code changes, deployments, commits, or pushes were performed in this audit.
- Temporary local browser probe was removed; diagnostic screenshots remain under .tmp.
- The working tree was already modified by other work. Source changed during this audit; verify current file revisions before implementing fixes.

## Suggested order
1. Decide whether `/stores` should be a store directory or redirect to Explore.
2. Stabilize canonical store links and fix category retry/error states.
3. Agree campus verification/badge policy with CPSU.
4. Protect unsaved edits, refresh follower counts, guard request races.
5. Optimize slug lookup and polish storefront search/floating chat.

## Remediation update — 2026-11-18

- `/stores` now redirects to Explore, the existing discovery screen. No unapproved store directory was added.
- Listing authoring has an independent category loading/error state, Retry action, and disabled submission until categories are available. Listing refresh responses are sequenced so an older request cannot overwrite a newer result.
- Inline editing asks before discarding dirty changes on Cancel or when another listing editor is opened, and returns focus to the listing card after Cancel.
- Follower counts refresh on foreground return and after a follow action. Closed dialogs request only aggregate counts; names are fetched when the dialog opens.
- Public student store visibility now requires an active owner with a currently verified, unexpired affiliation. The same predicate covers storefront lookup, public listings, follow connections, and Most Followed Stores. The avatar route checks affiliation before returning a public image. Revocation and expiry therefore remove the public store and its listings from discovery; owner and authorized reviewer access remain available.
- The desktop store search field is wider, and desktop listing cards reserve a right-side lane for the existing floating chat launcher.
- The owner confirmed the approved name-based URL rule remains: renaming a store may expire an old name URL. Numeric `/stores/:id` links remain the durable fallback. Persistent indexed slugs and historical aliases would require a separate database design and migration; the table-wide slug lookup performance finding remains open.
- No database migration, live records, deployment, commit, or push was performed in this remediation. Focused API tests passed 18/18, storefront component tests passed 8/8, and API/web TypeScript checks passed. The Vite production build passed after a sandbox-approved local run; authenticated browser acceptance remains outstanding. The repository graph was updated.
