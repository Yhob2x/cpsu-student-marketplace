# Store connections dialog — 18 November 2026

The seller's My Store facts row now shows clickable Followers and Following counts. Either count opens the same accessible dialog on the selected tab. The dialog uses private, paged data with empty, loading, error, and Retry states. Follower rows show only display name and follow date; Following rows show public store name, campus and link. It does not copy Behance's Appreciations or other out-of-scope social features.

The existing owner-only `GET /store-follows/mine` route accepts validated `view=followers|following` and `page` parameters. Both views derive identity from the authenticated account; neither accepts another seller's ID. The Following view counts and lists only approved stores with active owners. The public storefront retains aggregate follower information and exposes no list of student followers. Missing follow schema still produces a 503 instead of a false zero.

The separate follower preview card was removed from My Store; its list, paging and recovery behavior moved into the dialog. No manual Refresh button was added. No database schema, migration, auth rule, listing workflow, chat, notification or PWA worker changed.

Synthetic owner API tests cover the Following response, authorization, field minimization and invalid view values. Component tests cover count controls, tabs, rows, empty states and recovery. A synthetic dialog fixture in `apps/web/test/fixtures/store-follow-qa.html` was used for headless Chrome visual inspection at 500 and 1280px. Headless Chrome's 390px window capture cropped a wider minimum viewport, so it is not evidence of a real 390px layout. Physical phone, installed PWA and real authenticated account acceptance remain open.

Final checks: web tests 83 passed/0 failed; API tests 165 passed/8 guarded skips/0 failed; web production build and API TypeScript check passed. Existing React Router server-render warnings appeared in the web test output. `graphify update .` was attempted but the installed launcher points to an inaccessible Python executable.

## Public storefront follow-up — 2026-11-18

The owner subsequently requested that visitors to any public store see Followers and Following counts and open both lists. The public storefront now reuses the two-tab dialog. A separate unauthenticated, paged `GET /seller-profiles/:id/connections` read accepts only a positive store ID, `view=followers|following`, and bounded page. The server first verifies that the store is approved and its owner active. Public follower rows are limited to active followers' display names and follow dates; following rows contain only approved active stores' public name, campus, ID for the store link, and follow date. Email, student ID, legal name, user ID and account status never appear in the response. The existing owner-only `/store-follows/mine` route and follow/unfollow write rules remain unchanged. An absent follow table returns 503, never zero.

Synthetic HTTP tests cover guest access, hidden stores, invalid input, field selection and unavailable storage. Component tests cover public copy and both count controls. Local anonymous HTTP returned one follower display name and one followed store for Yobyob; headless Chrome rendered clickable counts of one each on `/store/yobyob`. No schema migration or database row changed.

Final checks for this follow-up: API unit suite 171 passed, 8 guarded skips, 0 failed; web suite 90 passed, 0 failed; API TypeScript and web production build passed. `graphify update .` was attempted but remains blocked by the inaccessible local Python launcher.
