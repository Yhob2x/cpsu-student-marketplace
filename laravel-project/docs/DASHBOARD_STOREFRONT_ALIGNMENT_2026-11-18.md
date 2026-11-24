# My Store and public storefront alignment — 18 November 2026

The seller dashboard now uses the public storefront's banner, avatar, store name, campus identity, verified status, and facts row. Its actions remain owner-specific: New listing, View public store, and Store settings. Management cards share the public listing card's surface and type treatment while retaining all editing, review, availability, and removal controls.

The facts row shows the seller's actual listing count, follower count, and the number of stores the seller follows. Follower and following counts come from the existing owner-only `/store-follows/mine` response, which now includes `followingCount`. The server derives both counts from the authenticated user and does not accept a target account ID. If the follow feature is unavailable, the dashboard omits those counts instead of displaying false zeroes. The private follower list still reveals only display names and follow dates to the owner.

The routine Refresh button was removed from the follower card. Error-state Try again remains. Automatic listing updates and messaging/notification refresh behavior remain in place.

No database structure, migration, payment flow, navigation route, PWA worker, or listing permission changed. The existing owner endpoint returns one additional aggregate field.

Verification: web TypeScript/Vite production build passed; web tests passed 83/83; API tests passed 164 with 8 guarded integration skips and no failures. The private follower endpoint and follower card were tested with synthetic data. Physical phone and real authenticated visual acceptance remain outstanding.
